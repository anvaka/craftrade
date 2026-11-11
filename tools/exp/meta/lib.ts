// Shared helpers for the meta-layer experiments. Nothing here touches src/ or server/.
import { createApp } from '../../../server/app.ts';
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
export const pts = (i: ItemSpec) => itemPoints(i.effects);

export function world(startMs = Date.UTC(2026, 10, 11, 0)) {
  let t = startMs;
  const db = openDb(':memory:');
  const app = createApp({ db, provider: new ProceduralProvider(), now: () => t, rateLimit: false });
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

export interface Skill { name: string; every: number; noise: number }
export const SKILLS: Record<string, Skill> = {
  expert: { name: 'expert', every: 3, noise: 0 },
  average: { name: 'average', every: 8, noise: 0.06 },
  novice: { name: 'novice', every: 16, noise: 0.15 },
};

let nrng = 12345;
const nr = () => { nrng = (Math.imul(nrng, 1664525) + 1013904223) >>> 0; return nrng / 4294967296; };

/** Play a run headless. `fuseVia` asks the server what a pair becomes (in-run fusion), or null to skip fusing. */
export async function playSim(
  opts: { seed: number; character: any; waves?: number; kit?: ItemSpec[]; stations?: Partial<Record<StationId, number>> },
  skill: Skill, botSeed: number,
  fuseVia: ((a: ItemSpec, b: ItemSpec) => Promise<ItemSpec | null>) | null = null,
): Promise<Run> {
  const run = createRun(opts);
  const bot = createBot(botSeed, false);
  bot.every = skill.every;
  const input = { mx: 0, my: 0 };
  let hold = 0, hx = 0, hy = 0;
  for (let g = 0; g < 300000 && run.phase !== 'over'; g++) {
    if (run.phase === 'wave') {
      botInput(run, bot, input);
      if (skill.noise > 0) {
        // A mistake: walk a random way for a third of a second.
        if (hold > 0) { hold--; input.mx = hx; input.my = hy; }
        else if (run.tick % 20 === 0 && nr() < skill.noise) { const a = nr() * 6.283; hx = Math.cos(a); hy = Math.sin(a); hold = 20; }
      }
      step(run, input); clearEvents(run);
    } else {
      botBench(run, bot);
      if (fuseVia && run.player.items.length >= 2 && nr() < 0.5) {
        const p = run.player; let a = -1, c = -1;
        for (let i = 0; i < p.items.length; i++) {
          if (itemTier(p.items[i]) > 2) continue;
          if (a < 0) a = i; else if (c < 0 && p.items[i].id !== p.items[a].id) c = i;
        }
        if (a >= 0 && c >= 0 && !fuseCost(run, a, c).block) {
          const res = await fuseVia(p.items[a], p.items[c]);
          if (res) applyFusion(run, a, c, res);
        }
      }
      nextWave(run);
    }
  }
  return run;
}

/** run/start, play with the bot on the ticket, run/end. Carries the highest-point items. Advances the clock by the run length. */
export async function apiRun(w: World, token: string, skill: Skill, o: { character?: string; kit?: string[]; mode?: string; fuse?: boolean; botSeed?: number } = {}) {
  const s = await w.post<RunStartRes>('/api/run/start', token, { mode: o.mode ?? 'run', character: o.character ?? 'greenhorn', kit: o.kit ?? [] });
  if (s.status !== 200) throw new Error('start ' + JSON.stringify(s.body));
  const t = s.body;
  const fuseVia = o.fuse === false ? null : async (a: ItemSpec, b: ItemSpec) => {
    const r = await w.post('/api/fuse', token, { a: a.id, b: b.id, ctx: 'run' });
    return r.status === 200 ? (r.body.item as ItemSpec) : null;
  };
  const run = await playSim({ seed: t.seed, character: t.character, waves: t.waves, kit: t.kit, stations: t.stations }, skill, o.botSeed ?? (t.seed ^ 0x5bd1e995), fuseVia);
  const best = carryable(run).slice().sort((x, y) => pts(y) - pts(x)).slice(0, carryLimit(run)).map((i) => i.id);
  setCarry(run, best);
  const sum = summary(run);
  w.advance(Math.ceil(sum.seconds * 1000) + 4 * 60_000); // waves plus bench time
  const e = await w.post<RunEndRes>('/api/run/end', token, {
    runId: t.runId, wavesCleared: sum.wavesCleared, won: sum.won, scripEarned: sum.scripEarned, scripHeld: sum.scripHeld,
    level: sum.level, raws: sum.raws, mule: sum.mule, carry: sum.carry, kills: sum.kills, fusions: sum.fusions,
  });
  if (e.status !== 200) throw new Error('end ' + JSON.stringify(e.body) + JSON.stringify(sum));
  return { ticket: t, sum, end: e.body, profile: e.body.profile as Profile, kitPoints: t.kit.reduce((n, i) => n + pts(i), 0) };
}

export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const median = (a: number[]) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
export function table(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${cols.map((c) => String(r[c])).join(' | ')} |`)].join('\n');
}
let idemN = 0;
export const idem = () => `k${Date.now().toString(36)}${(idemN++).toString(36).padStart(6, '0')}`;
