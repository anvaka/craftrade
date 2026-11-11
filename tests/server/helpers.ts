import { createHash } from 'node:crypto';
import { createApp, type AppOptions } from '../../server/app.ts';
import initSqlJs from 'sql.js';
import { openDb, setupDb } from '../../server/db.ts';
import { wrapSqlJs } from '../../src/client/local/sqlite.ts';
import { ProceduralProvider } from '../../server/provider.ts';
import { BASE_ITEMS } from '../../src/shared/content/items.ts';
import type { HelloRes, Profile, RunEndReq, RunEndRes, RunStartReq, RunStartRes } from '../../src/shared/protocol.ts';
import { emptyRaws } from '../../src/shared/vocab.ts';

// SCRIP_DB=sqljs runs every test world on the browser's database engine (the solo world's), to prove the server code is the same on both.
const sqljs = process.env.SCRIP_DB === 'sqljs' ? await initSqlJs() : null;

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

/**
 * A server on an in-memory database with a clock the test controls. Replay
 * checking and the limit on paying runs are off unless a test turns them on,
 * so tests can report made-up runs one after another.
 */
export function world(opts: AppOptions = {}) {
  let t = Date.UTC(2026, 10, 11, 9);
  const db = opts.db ?? (sqljs ? setupDb(wrapSqlJs(new sqljs.Database()).db) : openDb(':memory:'));
  const app = createApp({ db, provider: new ProceduralProvider(), now: () => t, rateLimit: false, replay: 'off', runRate: false, ...opts });

  async function call<T = any>(method: 'GET' | 'POST', path: string, token?: string, body?: unknown) {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { 'x-device': token } : {}) },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    });
    return { status: res.status, body: (await res.json()) as T };
  }
  const get = <T = any>(path: string, token?: string) => call<T>('GET', path, token);

  // An in-run fusion needs an open run that could be holding the items. A test that asks for one
  // without naming a run gets a run of its own, ten minutes in, so any authored item is plausible.
  const fuseRuns = new Map<string, Promise<{ runId: string; n: number }>>();
  async function runForFuse(token: string): Promise<string> {
    let entry = fuseRuns.get(token);
    const stale = entry && (await entry).n >= 20;
    if (!entry || stale) {
      entry = (async () => {
        const s = await call<RunStartRes>('POST', '/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
        if (s.status !== 200) throw new Error(`start failed: ${JSON.stringify(s.body)}`);
        t += 10 * 60_000;
        return { runId: s.body.runId, n: 0 };
      })();
      fuseRuns.set(token, entry);
    }
    const e = await entry;
    e.n++;
    return e.runId;
  }
  async function post<T = any>(path: string, token?: string, body?: unknown) {
    const b = body as { ctx?: string; runId?: string } | undefined;
    if (path === '/api/fuse' && token && b?.ctx === 'run' && !b.runId) body = { ...b, runId: await runForFuse(token) };
    return call<T>('POST', path, token, body);
  }

  /** A new player. With `runs`, one that has played that many paid runs and has been in town for a month. */
  async function player(runs = 0): Promise<string> {
    const { body } = await post<HelloRes>('/api/hello');
    if (runs) db.prepare('UPDATE players SET runs = ?, created = created - ? WHERE name = ?').run(runs, 30 * DAY, body.profile.name);
    return body.token;
  }
  /** Put marks and raws in a player's hands, with the ledger row that keeps the audit true. */
  function fund(token: string, marks: number, raws = 0) {
    const p = db.prepare('SELECT id FROM players WHERE name = (SELECT name FROM players WHERE token_hash = ?)').get(hashOf(token)) as { id: number };
    db.prepare('UPDATE players SET marks = marks + ?, timber = timber + ?, ore = ore + ?, hide = hide + ? WHERE id = ?').run(marks, raws, raws, raws, p.id);
    db.prepare(`INSERT INTO ledger (ts, player_id, kind, marks, timber, ore, hide, reason) VALUES (?, ?, 'test_fund', ?, ?, ?, ?, '')`).run(t, p.id, marks, raws, raws, raws);
  }
  const me = async (token: string): Promise<Profile> => (await post<HelloRes>('/api/hello', token)).body.profile;

  /** Start a run, let enough time pass, and report it. */
  async function run(token: string, end: Partial<RunEndReq> = {}, start: Partial<RunStartReq> = {}) {
    const s = await post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [], ...start });
    if (s.status !== 200) throw new Error(`start failed: ${JSON.stringify(s.body)}`);
    fuseRuns.delete(token); // starting a run voids the one the fuse helper had open
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

  return { db, app, call, get, post, player, me, run, grant, fund, now: () => t, advance: (ms: number) => { t += ms; } };
}

const hashOf = (token: string) => createHash('sha256').update(token).digest('hex');

export function report(runId: string, over: Partial<RunEndReq> = {}): RunEndReq {
  return {
    runId, wavesCleared: 3, won: false, scripEarned: 40, scripHeld: 40, level: 3,
    raws: emptyRaws(), mule: emptyRaws(), carry: [], kills: 30, fusions: [], ...over,
  };
}

/** Every unordered pair of authored items, in a stable order. */
export function basePairs(): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < BASE_ITEMS.length; i++) for (let j = i + 1; j < BASE_ITEMS.length; j++) out.push([BASE_ITEMS[i].id, BASE_ITEMS[j].id]);
  return out;
}
