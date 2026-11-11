import { createApp, type AppOptions } from '../../server/app.ts';
import { openDb } from '../../server/db.ts';
import { ProceduralProvider } from '../../server/provider.ts';
import { BASE_ITEMS } from '../../src/shared/content/items.ts';
import type { HelloRes, Profile, RunEndReq, RunEndRes, RunStartReq, RunStartRes } from '../../src/shared/protocol.ts';
import { emptyRaws } from '../../src/shared/vocab.ts';

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

/** A server on an in-memory database with a clock the test controls. */
export function world(opts: AppOptions = {}) {
  let t = Date.UTC(2026, 10, 11, 9);
  const db = opts.db ?? openDb(':memory:');
  const app = createApp({ db, provider: new ProceduralProvider(), now: () => t, rateLimit: false, ...opts });

  async function call<T = any>(method: 'GET' | 'POST', path: string, token?: string, body?: unknown) {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { 'x-device': token } : {}) },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    });
    return { status: res.status, body: (await res.json()) as T };
  }
  const get = <T = any>(path: string, token?: string) => call<T>('GET', path, token);
  const post = <T = any>(path: string, token?: string, body?: unknown) => call<T>('POST', path, token, body);

  async function player(runs = 0): Promise<string> {
    const { body } = await post<HelloRes>('/api/hello');
    if (runs) db.prepare('UPDATE players SET runs = ? WHERE name = ?').run(runs, body.profile.name);
    return body.token;
  }
  const me = async (token: string): Promise<Profile> => (await post<HelloRes>('/api/hello', token)).body.profile;

  /** Start a run, let enough time pass, and report it. */
  async function run(token: string, end: Partial<RunEndReq> = {}, start: Partial<RunStartReq> = {}) {
    const s = await post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [], ...start });
    if (s.status !== 200) throw new Error(`start failed: ${JSON.stringify(s.body)}`);
    t += 20 * 60_000;
    const e = await post<RunEndRes>('/api/run/end', token, report(s.body.runId, end));
    return { start: s.body, status: e.status, end: e.body };
  }

  /** Put authored items in a stash the honest way: carry them home from runs. */
  async function grant(token: string, ids: string[]) {
    for (let i = 0; i < ids.length; i += 3) {
      const r = await run(token, { wavesCleared: 12, won: true, carry: ids.slice(i, i + 3) });
      if (r.status !== 200) throw new Error(`grant failed: ${JSON.stringify(r.end)}`);
    }
    return (await me(token)).items;
  }

  return { db, app, get, post, player, me, run, grant, now: () => t, advance: (ms: number) => { t += ms; } };
}

export function report(runId: string, over: Partial<RunEndReq> = {}): RunEndReq {
  return {
    runId, wavesCleared: 3, won: false, scripEarned: 120, scripHeld: 40, level: 3,
    raws: emptyRaws(), mule: emptyRaws(), carry: [], kills: 60, fusions: [], ...over,
  };
}

/** Every unordered pair of authored items, in a stable order. */
export function basePairs(): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < BASE_ITEMS.length; i++) for (let j = i + 1; j < BASE_ITEMS.length; j++) out.push([BASE_ITEMS[i].id, BASE_ITEMS[j].id]);
  return out;
}
