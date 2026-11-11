// The only place the client talks to the server. Every endpoint in
// src/shared/protocol.ts has one typed wrapper here.
//
//   - The device token lives in localStorage under "scrip.device". If storage
//     is blocked it lives in memory and the account lasts for the session.
//   - Every failure becomes an ApiFail with the server's { error, code }.
//     A server that cannot be reached is code "unreachable".
//   - Requests time out (4 s by default). Nothing here waits for ever.
//   - Market POSTs carry an idempotency key and are retried once with the
//     same key, so a lost reply cannot buy or sell twice.

import type { ItemSpec } from '../../shared/item.ts';
import type {
  ApiError, CharacterId, CodexRes, DailyRes, FuseReq, FuseRes, GiveRes, HelloRes, ItemsRes, MarketActionRes, MarketRes,
  NameRes, RunEndReq, RunEndRes, RunStartReq, RunStartRes, TownRes,
} from '../../shared/protocol.ts';
import type { RawBag, RawId } from '../../shared/vocab.ts';

const TOKEN_KEY = 'scrip.device';
const DEFAULT_TIMEOUT = 4000;
export const UNREACHABLE = 'unreachable';

export class ApiFail extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
  ) {
    super(message);
  }
  get unreachable(): boolean {
    return this.code === UNREACHABLE;
  }
}

export const asFail = (e: unknown): ApiFail =>
  e instanceof ApiFail ? e : new ApiFail('client_error', 'Something went wrong on this page.');

let token: string | null = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  // storage blocked: the token is kept in memory for this session
}

function keepToken(t: string): void {
  token = t;
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    // session only
  }
}

/** True if this browser has met the server before. */
export const hasToken = (): boolean => !!token;

let reachable = true;
const statusListeners = new Set<(online: boolean) => void>();
function setReachable(v: boolean): void {
  if (v === reachable) return;
  reachable = v;
  for (const fn of statusListeners) fn(v);
}
/** Called when the server stops or starts answering. */
export function onReachable(fn: (online: boolean) => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}
export const isReachable = (): boolean => reachable;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A key for one player action. Reused only when that same action is retried. */
export function newIdem(): string {
  const b = new Uint8Array(12);
  try {
    crypto.getRandomValues(b);
  } catch {
    for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function raw<T>(method: 'GET' | 'POST', path: string, body: unknown, timeoutMs: number): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try {
    const headers: Record<string, string> = {};
    if (token) headers['x-device'] = token;
    if (method === 'POST') headers['content-type'] = 'application/json';
    res = await fetch(path, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      signal: ctl.signal,
      cache: 'no-store',
    });
  } catch {
    setReachable(false);
    throw new ApiFail(UNREACHABLE, 'The town is out of reach.');
  } finally {
    clearTimeout(timer);
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = undefined;
  }
  if (res.ok && data !== undefined) {
    setReachable(true);
    return data as T;
  }
  const err = data as Partial<ApiError> | undefined;
  if (err && typeof err.code === 'string' && typeof err.error === 'string') {
    setReachable(true);
    throw new ApiFail(err.code, err.error, res.status);
  }
  // No JSON body: a proxy or a dead process answered, not the game server.
  setReachable(false);
  throw new ApiFail(UNREACHABLE, 'The town is out of reach.', res.status);
}

let helloInFlight: Promise<HelloRes> | null = null;

/** Introduce this device. Creates the account on first contact. */
export function hello(timeoutMs = 8000): Promise<HelloRes> {
  helloInFlight ??= raw<HelloRes>('POST', '/api/hello', {}, timeoutMs)
    .then((res) => {
      keepToken(res.token);
      return res;
    })
    .finally(() => {
      helloInFlight = null;
    });
  return helloInFlight;
}

/** A call that needs the device. If the server forgot the token, say hello and try once more. */
async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, timeoutMs = DEFAULT_TIMEOUT): Promise<T> {
  if (!token) await hello();
  try {
    return await raw<T>(method, path, body, timeoutMs);
  } catch (e) {
    if (e instanceof ApiFail && e.code === 'no_device') {
      await hello();
      return raw<T>(method, path, body, timeoutMs);
    }
    throw e;
  }
}

/** Run a keyed POST. One retry with the same key if the reply was lost. */
async function keyed<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const withKey = { ...body, idem: newIdem() };
  try {
    return await call<T>('POST', path, withKey);
  } catch (e) {
    if (!(e instanceof ApiFail) || !e.unreachable) throw e;
    await sleep(500);
    return call<T>('POST', path, withKey);
  }
}

export const api = {
  hello,
  rerollName: () => call<NameRes>('POST', '/api/name/reroll', {}),

  /** An untried pair waits on the model, so this one is given longer. */
  fuse: (req: FuseReq) => call<FuseRes>('POST', '/api/fuse', req, 22_000),
  items: (ids: string[]) => call<ItemsRes>('GET', `/api/items?ids=${encodeURIComponent(ids.join(','))}`),
  codex: () => call<CodexRes>('GET', '/api/codex'),

  runStart: (mode: RunStartReq['mode'], character: CharacterId, kit: string[]) =>
    call<RunStartRes>('POST', '/api/run/start', { mode, character, kit } satisfies RunStartReq, 3000),

  /**
   * Report a finished run. Tried three times if the town cannot be reached.
   * A repeat that finds the run already reported means an earlier try landed
   * and only its reply was lost; that surfaces as code "run_ended".
   */
  async runEnd(req: RunEndReq): Promise<RunEndRes> {
    let last: ApiFail | null = null;
    for (let i = 0; i < 3; i++) {
      try {
        return await call<RunEndRes>('POST', '/api/run/end', req, 5000);
      } catch (e) {
        last = asFail(e);
        if (!last.unreachable) throw last;
        await sleep(600 * (i + 1));
      }
    }
    throw last!;
  },

  market: () => call<MarketRes>('GET', '/api/market'),
  factor: (rawId: RawId, side: 'buy' | 'sell', qty: number) => keyed<MarketActionRes>('/api/market/factor', { raw: rawId, side, qty }),
  list: (uid: string, price: number) => keyed<MarketActionRes>('/api/market/list', { uid, price }),
  buy: (listingId: string) => keyed<MarketActionRes>('/api/market/buy', { listingId }),
  cancel: (listingId: string) => call<MarketActionRes>('POST', '/api/market/cancel', { listingId }),
  salvage: (uid: string) => call<MarketActionRes>('POST', '/api/market/salvage', { uid }),

  town: () => call<TownRes>('GET', '/api/town'),
  give: (raws: Partial<RawBag>) => call<GiveRes>('POST', '/api/town/give', { raws }),

  daily: () => call<DailyRes>('GET', '/api/daily'),
};

export type { ItemSpec };
