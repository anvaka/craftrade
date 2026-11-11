// Shared helpers for the meta-layer experiments. Nothing here touches src/ or server/.
import { createApp, type AppOptions } from '../../../server/app.ts';
import { openDb } from '../../../server/db.ts';
import { ProceduralProvider } from '../../../server/provider.ts';
import { audit } from '../../../server/audit.ts';
import {
  createBot, botInput, botBench, createRun, step, clearEvents, nextWave, summary, setCarry, carryable, carryLimit,
  fuseCost, applyFusion, type Run,
} from '../../../src/sim/index.ts';
import { itemPoints, itemTier, type ItemSpec } from '../../../src/shared/item.ts';
import type { Profile, RunEndRes, RunStartRes, HelloRes, StationId } from '../../../src/shared/protocol.ts';

export const HOUR = 3600_000, DAY = 24 * HOUR;

export function world(startMs = Date.UTC(2026, 10, 11, 0), over: AppOptions = {}) {
  let t = startMs;
  const db = openDb(':memory:');
  // Replay checking and the limit on paying runs are off here: these experiments report bot runs in bulk,
  // without logs. tools/exp/meta/honest.ts is the experiment that sends recorded runs to a checking server.
  const app = createApp({ db, provider: new ProceduralProvider(), now: () => t, rateLimit: false, replay: 'off', runRate: false, ...over });
  async function call<T = any>(method: 'GET' | 'POST', path: string, token?: string, body?: unknown) {
    const res = await app.request(path, {
      method, headers: { 'content-type': 'application/json', ...(token ? { 'x-device': token } : {}) },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    });
    return { status: res.status, body: (await res.json()) as T };
  }
  const get = <T = any>(p: string, tok?: string) => call<T>('GET', p, tok);
  const post = <T = any>(p: string, tok?: string, b?: unknown) => call<T>('POST', p, tok, b);
  const hello = async (tok?: string) => (await post<HelloRes>('/api/hello', tok)).body;
  return { db, app, get, post, hello, now: () => t, advance: (ms: number) => { t += ms; }, setNow: (ms: number) => { t = ms; }, audit: () => audit(db) };
}
export type World = ReturnType<typeof world>;

export { SKILLS, playSim, pts, mean, median, table, type Skill } from './simlib.ts';
import { SKILLS, playSim, pts, type Skill } from './simlib.ts';

/** run/start, play with the bot on the ticket, run/end. Carries the highest-point items. Advances the clock by the run length. */
export async function apiRun(w: World, token: string, skill: Skill, o: { character?: string; kit?: string[]; mode?: string; fuse?: boolean; botSeed?: number; hazard?: number } = {}) {
  const s = await w.post<RunStartRes>('/api/run/start', token, { mode: o.mode ?? 'run', character: o.character ?? 'greenhorn', kit: o.kit ?? [], hazard: o.hazard ?? 0 });
  if (s.status !== 200) throw new Error('start ' + JSON.stringify(s.body));
  const t = s.body;
  const fuseVia = o.fuse === false ? null : async (a: ItemSpec, b: ItemSpec) => {
    // The server only answers for items the run could hold by now on its clock; the bot is at a bench mid-run.
    const r = await w.post('/api/fuse', token, { a: a.id, b: b.id, ctx: 'run', runId: t.runId });
    return r.status === 200 ? (r.body.item as ItemSpec) : null;
  };
  w.advance(8 * 60_000);
  const run = await playSim({ seed: t.seed, character: t.character, waves: t.waves, kit: t.kit, stations: t.stations }, skill, o.botSeed ?? (t.seed ^ 0x5bd1e995), fuseVia);
  const best = carryable(run).slice().sort((x, y) => pts(y) - pts(x)).slice(0, carryLimit(run)).map((i) => i.id);
  setCarry(run, best);
  const sum = summary(run);
  w.advance(Math.max(0, Math.ceil(sum.seconds * 1000) - 4 * 60_000)); // with the eight minutes above: waves plus bench time
  const e = await w.post<RunEndRes>('/api/run/end', token, {
    runId: t.runId, wavesCleared: sum.wavesCleared, won: sum.won, scripEarned: sum.scripEarned, scripHeld: sum.scripHeld,
    level: sum.level, raws: sum.raws, mule: sum.mule, carry: sum.carry, kills: sum.kills, fusions: sum.fusions,
  });
  if (e.status !== 200) throw new Error('end ' + JSON.stringify(e.body) + JSON.stringify(sum));
  return { ticket: t, sum, end: e.body, profile: e.body.profile as Profile, kitPoints: t.kit.reduce((n, i) => n + pts(i), 0) };
}

let idemN = 0;
export const idem = () => `k${Date.now().toString(36)}${(idemN++).toString(36).padStart(6, '0')}`;
