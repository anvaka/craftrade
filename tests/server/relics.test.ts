import Database from 'better-sqlite3';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { audit } from '../../server/audit.ts';
import { SYSTEM_PROMPT } from '../../server/bedrock.ts';
import { RELIC_LATE_DEATH_WAVE, RELIC_ONE_IN, RELIC_ROLLS_PER_DAY, RELIC_WEIGHT } from '../../server/config.ts';
import { MIGRATIONS, openDb } from '../../server/db.ts';
import { ProceduralProvider, validatePick } from '../../server/provider.ts';
import { devRelicForce, relicChance, relicChanceOf, relicSource, rollRelic, secureRandom } from '../../server/relics.ts';
import { BASE_ITEMS } from '../../src/shared/content/items.ts';
import { RELICS } from '../../src/shared/content/relics.ts';
import { fusionBudget } from '../../src/shared/item.ts';
import type {
  ApiError, FuseRes, HelloRes, MarketActionRes, MarketRes, RelicsRes, RunEndReq, RunEndRes, RunStartRes,
} from '../../src/shared/protocol.ts';
import { RELIC_PRIMITIVES } from '../../src/shared/vocab.ts';
import { DAY, HOUR, basePairs, report, world } from './helpers.ts';

const [A, B, C, D] = BASE_ITEMS.map((i) => i.id);
const MIN = 60_000;
const WIN: Partial<RunEndReq> = { wavesCleared: 12, won: true };
type W = ReturnType<typeof world>;

/** Dice that count how often they are thrown and always land on `value`. */
function dice(value: number) {
  const d = { thrown: 0, value, rng: () => { d.thrown++; return d.value; } };
  return d;
}
/** A throw that finds this relic on a win: the middle of its share of the hit range. */
function landOn(id: string): number {
  let before = 0;
  for (const r of RELICS) {
    if (r.id === id) return ((before + RELIC_WEIGHT[id] / 2) / 1000) * relicChance('win');
    before += RELIC_WEIGHT[r.id];
  }
  throw new Error(id);
}
const relicsOf = async (w: W, token: string) => (await w.me(token)).items.filter((i) => i.item.relic);
const worldCount = (w: W) => (w.db.prepare('SELECT COUNT(*) AS n FROM relics').get() as { n: number }).n;

describe('relics: the odds', () => {
  it('has a weight for every relic and the rates the design asks for', () => {
    expect(Object.keys(RELIC_WEIGHT).sort()).toEqual(RELICS.map((r) => r.id).sort());
    expect(Object.values(RELIC_WEIGHT).reduce((a, b) => a + b, 0)).toBe(1000);
    expect(RELIC_ONE_IN.win).toBe(1500);
    // The rarest is 1 in 20,000 wins; every share adds back up to 1 in 1,500.
    const perWin = RELICS.map((r) => relicChanceOf('win', r.id));
    expect(1 / Math.min(...perWin)).toBeCloseTo(20_000, 6);
    expect(1 / perWin.reduce((a, b) => a + b, 0)).toBeCloseTo(1500, 6);
    // The list is in order of rarity, and the other sources are much smaller.
    expect(perWin).toEqual([...perWin].sort((a, b) => b - a));
    expect(RELIC_ONE_IN.lateDeath).toBeGreaterThanOrEqual(RELIC_ONE_IN.win * 10);
    expect(RELIC_ONE_IN.daily).toBeGreaterThanOrEqual(RELIC_ONE_IN.win * 10);
  });

  it('rolls from one number: whether, and which', () => {
    const p = 1 / 1500;
    expect(rollRelic('win', () => 0)).toBe(RELICS[0].id);
    expect(rollRelic('win', () => p * 0.999999)).toBe(RELICS[RELICS.length - 1].id);
    expect(rollRelic('win', () => p)).toBeNull();
    expect(rollRelic('win', () => 0.5)).toBeNull();
    expect(rollRelic('win', () => 0.999999999)).toBeNull();
    expect(rollRelic('win', () => Number.NaN)).toBeNull();
    for (const r of RELICS) expect(rollRelic('win', () => landOn(r.id))).toBe(r.id);
    // The same throw that finds one on a win finds nothing on a late death or a daily: their ranges are far narrower.
    expect(rollRelic('lateDeath', () => p / 2)).toBeNull();
    expect(rollRelic('daily', () => p / 2)).toBeNull();
    expect(rollRelic('lateDeath', () => 1 / 30_001)).not.toBeNull();
    // Share boundaries follow the weights.
    let edge = 0;
    for (const r of RELICS) {
      expect(rollRelic('win', () => ((edge + 0.001) / 1000) * p)).toBe(r.id);
      edge += RELIC_WEIGHT[r.id];
      expect(rollRelic('win', () => ((edge - 0.001) / 1000) * p)).toBe(r.id);
    }
  });

  it('throws real dice by default, in [0, 1)', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const u = secureRandom();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      seen.add(u);
    }
    expect(seen.size).toBeGreaterThan(1990);
  });

  it('names which reports may roll at all', () => {
    const run = { mode: 'run' as const, scored: 0, waves: 12 };
    expect(relicSource(run, { won: true, wavesCleared: 12 })).toBe('win');
    expect(RELIC_LATE_DEATH_WAVE).toBe(9);
    expect(relicSource(run, { won: false, wavesCleared: 8 })).toBe('lateDeath'); // died on wave 9
    expect(relicSource(run, { won: false, wavesCleared: 11 })).toBe('lateDeath');
    expect(relicSource(run, { won: false, wavesCleared: 7 })).toBeNull(); // died on wave 8
    expect(relicSource(run, { won: false, wavesCleared: 0 })).toBeNull();
    // Leaving the run is not dying in it.
    expect(relicSource(run, { won: false, wavesCleared: 10, quit: true })).toBeNull();
    expect(relicSource({ mode: 'daily', scored: 1, waves: 8 }, { won: true, wavesCleared: 8 })).toBe('daily');
    expect(relicSource({ mode: 'daily', scored: 1, waves: 8 }, { won: false, wavesCleared: 7 })).toBeNull();
    expect(relicSource({ mode: 'daily', scored: 0, waves: 8 }, { won: true, wavesCleared: 8 })).toBeNull();
    expect(relicSource({ mode: 'practice', scored: 0, waves: 8 }, { won: true, wavesCleared: 8 })).toBeNull();
  });
});

describe('relics: the fusion vocabulary never holds one', () => {
  it('keeps relic effects out of the model prompt and out of any validated pick', () => {
    for (const p of RELIC_PRIMITIVES) expect(SYSTEM_PROMPT).not.toMatch(new RegExp(`\\b${p.id}\\b`));
    for (const r of RELICS) expect(SYSTEM_PROMPT).not.toContain(r.name);
    // A provider that answers with nothing but relic effects has given no usable answer.
    const onlyRelic = { names: ['Golden chest'], glyph: 'ring', tags: [], effects: RELIC_PRIMITIVES.map((p) => ({ p: p.id, l: 1 })) };
    expect(validatePick(onlyRelic, 40, 'k')).toBeNull();
    // Mixed in with a real effect, they are dropped.
    const mixed = validatePick({ ...onlyRelic, effects: [...onlyRelic.effects, { p: 'armor', l: 2 }] }, 40, 'k')!;
    expect(mixed.effects.map((e) => e.p)).toEqual(['armor']);
  });

  it('never comes out of the procedural generator', async () => {
    const provider = new ProceduralProvider();
    const relicIds = new Set(RELIC_PRIMITIVES.map((p) => p.id));
    const byId = Object.fromEntries(BASE_ITEMS.map((i) => [i.id, i]));
    for (const [a, b] of basePairs().filter((_, i) => i % 7 === 0)) {
      const pick = await provider.propose(byId[a], byId[b], fusionBudget(byId[a], byId[b]), `1:${a}+${b}`);
      expect(pick.effects.some((e) => relicIds.has(e.p))).toBe(false);
    }
  });
});

describe('relics: the roll at run end', () => {
  it('finds a relic on a win when the dice say so, numbers it, and tells the world', async () => {
    const d = dice(landOn('hideblind'));
    const w = world({ rng: d.rng });
    const token = await w.player();
    const name = (await w.me(token)).name;
    const r = await w.run(token, { ...WIN, carry: [A] });
    expect(r.status).toBe(200);
    expect(d.thrown).toBe(1);
    expect(r.end.relic).toMatchObject({ id: 'hideblind', name: 'Hide blind', relic: true, serial: 1, by: name, found: '2026-11-11' });
    // It is not one of the carried items, and it is already in the stash.
    expect(r.end.gained.items.map((i) => i.id)).toEqual([A]);
    const held = r.end.profile.items.filter((i) => i.item.relic);
    expect(held).toHaveLength(1);
    expect(held[0].item).toMatchObject({ id: 'hideblind', serial: 1, by: name });
    expect(r.end.notice).toMatchObject({ relic: 'hideblind', name: 'Hide blind', serial: 1, finder: name });
    expect(audit(w.db).ok).toBe(true);

    // The second of its kind is No. 2, whoever finds it. Another kind starts at 1.
    const other = await w.player();
    const second = await w.run(other, WIN);
    expect(second.end.relic).toMatchObject({ id: 'hideblind', serial: 2, by: (await w.me(other)).name });
    d.value = landOn('seedcorn');
    expect((await w.run(other, WIN)).end.relic).toMatchObject({ id: 'seedcorn', serial: 1 });
    expect(worldCount(w)).toBe(3);
  });

  it('finds nothing, nearly always', async () => {
    const d = dice(0.37);
    const w = world({ rng: d.rng });
    const token = await w.player();
    for (let i = 0; i < 5; i++) {
      const r = await w.run(token, WIN);
      expect(r.end.relic).toBeUndefined();
      expect(r.end.notice).toBeNull();
    }
    expect(d.thrown).toBe(5);
    expect(worldCount(w)).toBe(0);
  });

  it('uses the smaller odds for a late death and for the scored daily', async () => {
    // A throw inside the win range but outside the other two.
    const d = dice((1 / 1500) * 0.5);
    const w = world({ rng: d.rng });
    const token = await w.player(4);
    expect((await w.run(token, { wavesCleared: 9 })).end.relic).toBeUndefined();
    expect(d.thrown).toBe(1);
    const s = await w.post<RunStartRes>('/api/run/start', token, { mode: 'daily', character: 'greenhorn', kit: [] });
    w.advance(10 * MIN);
    const e = await w.post<RunEndRes>('/api/run/end', token, report(s.body.runId, { wavesCleared: 8, won: true }));
    expect(e.body.daily!.scored).toBe(true);
    expect(e.body.relic).toBeUndefined();
    expect(d.thrown).toBe(2);
    // A throw inside their ranges finds one from either.
    d.value = 0;
    const death = await w.run(token, { wavesCleared: 8 });
    expect(death.end.relic).toMatchObject({ id: RELICS[0].id, serial: 1 });
    w.advance(DAY);
    const s2 = await w.post<RunStartRes>('/api/run/start', token, { mode: 'daily', character: 'greenhorn', kit: [] });
    w.advance(10 * MIN);
    const e2 = await w.post<RunEndRes>('/api/run/end', token, report(s2.body.runId, { wavesCleared: 8, won: true }));
    expect(e2.body.relic).toMatchObject({ id: RELICS[0].id, serial: 2 });
    expect(w.db.prepare('SELECT source FROM relics ORDER BY id').all()).toEqual([{ source: 'lateDeath' }, { source: 'daily' }]);
  });

  it('never rolls for practice, repeat dailies, early deaths, left runs or refused reports', async () => {
    const d = dice(0); // every throw would find one
    const w = world({ rng: d.rng });
    const token = await w.player(4);
    const start = (mode: 'run' | 'daily' | 'practice') => w.post<RunStartRes>('/api/run/start', token, { mode, character: 'greenhorn', kit: [] });
    const end = async (runId: string, over: Partial<RunEndReq>, wait = 20 * MIN) => {
      w.advance(wait);
      return w.post<RunEndRes & ApiError>('/api/run/end', token, report(runId, over));
    };

    // Practice, won.
    let s = await start('practice');
    let e = await end(s.body.runId, { wavesCleared: 8, won: true });
    expect([e.status, e.body.relic]).toEqual([200, undefined]);
    // The scored daily, lost on the last wave.
    s = await start('daily');
    e = await end(s.body.runId, { wavesCleared: 7 });
    expect([e.status, e.body.daily!.scored, e.body.relic]).toEqual([200, true, undefined]);
    // A second daily the same day is not scored, so winning it rolls nothing.
    s = await start('daily');
    e = await end(s.body.runId, { wavesCleared: 8, won: true });
    expect([e.status, e.body.daily!.scored, e.body.relic]).toEqual([200, false, undefined]);
    // A death before wave 9.
    for (const wavesCleared of [0, 3, 7]) {
      s = await start('run');
      e = await end(s.body.runId, { wavesCleared });
      expect([e.status, e.body.relic]).toEqual([200, undefined]);
    }
    // A run the player left on wave 11.
    s = await start('run');
    e = await end(s.body.runId, { wavesCleared: 10, quit: true });
    expect([e.status, e.body.relic]).toEqual([200, undefined]);
    // Reports that do not pass the checks: too fast, impossible raws, result that does not match.
    s = await start('run');
    e = await end(s.body.runId, WIN, MIN);
    expect([e.status, e.body.code]).toEqual([400, 'too_fast']);
    s = await start('run');
    e = await end(s.body.runId, { ...WIN, raws: { timber: 5000, ore: 0, hide: 0 } });
    expect([e.status, e.body.code]).toEqual([400, 'too_many_raws']);
    s = await start('run');
    e = await end(s.body.runId, { wavesCleared: 12, won: false });
    expect([e.status, e.body.code]).toEqual([400, 'bad_report']);
    // An abandoned ticket: replaced by a newer one and then reported, or reported twice, or too old.
    const old = await start('run');
    s = await start('run');
    e = await end(old.body.runId, WIN);
    expect([e.status, e.body.code]).toEqual([409, 'run_void']);
    e = await end(s.body.runId, WIN, 7 * HOUR);
    expect([e.status, e.body.code]).toEqual([410, 'run_expired']);

    expect(d.thrown).toBe(0);
    expect(worldCount(w)).toBe(0);
    expect(await relicsOf(w, token)).toHaveLength(0);

    // The same account, one honest win: now the dice are thrown, once.
    s = await start('run');
    e = await end(s.body.runId, WIN);
    expect(e.body.relic).toBeTruthy();
    // Reporting that win a second time does not throw them again.
    e = await end(s.body.runId, WIN, 0);
    expect([e.status, e.body.code]).toEqual([409, 'run_ended']);
    expect(d.thrown).toBe(1);
    expect(worldCount(w)).toBe(1);
  });

  it('cannot be asked for by the client', async () => {
    const d = dice(0.9);
    const w = world({ rng: d.rng });
    const token = await w.player();
    const s = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
    w.advance(20 * MIN);
    // Extra fields are ignored; a relic id in the carry list is a forged report.
    const stuffed = { ...report(s.body.runId, WIN), relic: 'saddlescabbard', rng: 0, seed: 1 };
    const ok = await w.post<RunEndRes>('/api/run/end', token, stuffed);
    expect([ok.status, ok.body.relic]).toEqual([200, undefined]);
    const s2 = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
    w.advance(20 * MIN);
    const forged = await w.post<ApiError>('/api/run/end', token, report(s2.body.runId, { ...WIN, carry: ['saddlescabbard'] }));
    expect([forged.status, forged.body.code]).toEqual([400, 'bad_carry']);
    expect(worldCount(w)).toBe(0);
  });

  it('stops one account rolling more than a keen player could in a day', async () => {
    const d = dice(0.5);
    const w = world({ rng: d.rng });
    const token = await w.player();
    // An account that reports a win every 9 minutes, round the clock: 60 in 9 hours.
    for (let i = 0; i < 60; i++) {
      const s = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
      w.advance(9 * MIN);
      expect((await w.post('/api/run/end', token, report(s.body.runId, WIN))).status).toBe(200);
    }
    // Only the first 40 were put to the roll. The rest still paid out.
    expect(d.thrown).toBe(RELIC_ROLLS_PER_DAY);
    expect((w.db.prepare('SELECT COUNT(*) AS n FROM runs WHERE relic_roll = 1').get() as { n: number }).n).toBe(RELIC_ROLLS_PER_DAY);
    expect((await w.me(token)).wins).toBe(60);
    // Another account is not held back by it.
    const other = await w.player();
    await w.run(other, WIN);
    expect(d.thrown).toBe(RELIC_ROLLS_PER_DAY + 1);
    // A day later the first account rolls again.
    w.advance(DAY);
    await w.run(token, WIN);
    expect(d.thrown).toBe(RELIC_ROLLS_PER_DAY + 2);
  });

  it('numbers relics without gaps or repeats when several processes write at once', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scrip-relics-'));
    const path = join(dir, 'world.db');
    try {
      openDb(path).close();
      const run = promisify(execFile);
      const here = fileURLToPath(new URL('.', import.meta.url));
      const worker = join(here, 'relic-worker.ts');
      const tsx = join(here, '../../node_modules/.bin/tsx');
      const WINS = 12;
      // Four writers; two always find the first relic, two the last.
      const throws = [0, 0, landOn('saddlescabbard'), landOn('saddlescabbard')];
      const outs = await Promise.all(throws.map((v) => run(tsx, [worker, path, String(WINS), String(v)], { env: { ...process.env, NODE_ENV: 'test' } })));
      const given = outs.flatMap((o) => JSON.parse(o.stdout.trim().split('\n').pop()!) as [string, number][]);
      expect(given).toHaveLength(4 * WINS);
      for (const id of [RELICS[0].id, 'saddlescabbard']) {
        const serials = given.filter(([r]) => r === id).map(([, n]) => n).sort((a, b) => a - b);
        expect(serials).toEqual(Array.from({ length: 2 * WINS }, (_, i) => i + 1));
      }
      // The book agrees, and each process saw the others' numbers interleaved with its own.
      const db = new Database(path, { readonly: true });
      const rows = db.prepare('SELECT relic, serial, finder FROM relics ORDER BY relic, serial').all() as { relic: string; serial: number; finder: number }[];
      expect(rows).toHaveLength(4 * WINS);
      expect(new Set(rows.map((r) => `${r.relic}#${r.serial}`)).size).toBe(4 * WINS);
      expect((db.prepare('SELECT COUNT(*) AS n FROM stash WHERE relic_ref IS NOT NULL').get() as { n: number }).n).toBe(4 * WINS);
      expect((db.prepare('SELECT COUNT(DISTINCT relic_ref) AS n FROM stash').get() as { n: number }).n).toBe(4 * WINS);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 240_000);
});

describe('relics: the rules', () => {
  /** A world where the first win of `token` finds `id`. Returns the stash uid of the relic. */
  async function withRelic(id: string, runs = 30) {
    const d = dice(landOn(id));
    const w = world({ rng: d.rng });
    const token = await w.player(runs);
    const r = await w.run(token, { ...WIN, scripHeld: 400 });
    expect(r.end.relic?.id).toBe(id);
    d.value = 0.9; // and nothing after that
    const uid = (await relicsOf(w, token))[0].uid;
    return { w, token, uid, d };
  }

  it('does not wear: a packed relic keeps its place run after run', async () => {
    const { w, token, uid } = await withRelic('saddlescabbard');
    for (let i = 0; i < 5; i++) {
      const r = await w.run(token, { wavesCleared: 2 }, { kit: [uid] });
      expect(r.status).toBe(200);
      expect(r.start.kit).toHaveLength(1);
      expect(r.start.kit[0]).toMatchObject({ id: 'saddlescabbard', relic: true, serial: 1 });
      expect(r.end.profile.items.find((i) => i.uid === uid)).toBeTruthy();
    }
    // An ordinary item beside it wears as usual.
    const whet = (await w.grant(token, [A])).find((i) => i.item.id === A)!;
    for (let i = 0; i < 3; i++) await w.run(token, { wavesCleared: 2 }, { kit: [uid, whet.uid] });
    const after = await w.me(token);
    expect(after.items.find((i) => i.uid === whet.uid)).toBeUndefined();
    expect(after.items.find((i) => i.uid === uid)).toBeTruthy();
  });

  it('allows one relic in a kit', async () => {
    const { w, token, uid, d } = await withRelic('saddlescabbard');
    d.value = landOn('hideblind');
    await w.run(token, WIN);
    const two = (await relicsOf(w, token)).map((i) => i.uid);
    expect(two).toHaveLength(2);
    const res = await w.post<ApiError>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: two });
    expect([res.status, res.body.code]).toEqual([400, 'kit_relics']);
    // Nothing was started and nothing was spent.
    expect((await relicsOf(w, token)).map((i) => i.uid).sort()).toEqual([...two].sort());
    expect((await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [uid] })).status).toBe(200);
  });

  it('cannot be fused, in a run or in town', async () => {
    const { w, token, uid } = await withRelic('seedcorn');
    const whet = (await w.grant(token, [A])).find((i) => i.item.id === A)!;
    for (const body of [
      { a: 'seedcorn', b: A, ctx: 'run' },
      { a: A, b: 'seedcorn', ctx: 'run' },
      { a: 'seedcorn', b: 'hideblind', ctx: 'run' },
      { a: 'seedcorn', b: A, ctx: 'town', uidA: uid, uidB: whet.uid },
      { a: A, b: 'seedcorn', ctx: 'town', uidA: whet.uid, uidB: uid },
    ]) {
      const res = await w.post<ApiError & FuseRes>('/api/fuse', token, body);
      expect([res.status, res.body.code]).toEqual([400, 'blocked']);
    }
    const after = await w.me(token);
    expect(after.items.map((i) => i.uid).sort()).toEqual([uid, whet.uid].sort());
    expect((w.db.prepare('SELECT COUNT(*) AS n FROM recipes').get() as { n: number }).n).toBe(0);
    // And a relic is never the result of a recipe: no stored item has a relic effect.
    await w.grant(token, [B, C]);
    w.fund(token, 500, 100);
    const items = (await w.me(token)).items;
    const b = items.find((i) => i.item.id === B)!, c = items.find((i) => i.item.id === C)!;
    const fused = await w.post<FuseRes>('/api/fuse', token, { a: B, b: C, ctx: 'town', uidA: b.uid, uidB: c.uid });
    expect(fused.status).toBe(200);
    expect(fused.body.item.relic).toBeUndefined();
    const relicIds = new Set(RELIC_PRIMITIVES.map((p) => p.id));
    expect(fused.body.item.effects.some((e) => relicIds.has(e.p))).toBe(false);
  });

  it('cannot be salvaged', async () => {
    const { w, token, uid } = await withRelic('orderbook');
    const marks = (await w.me(token)).marks;
    const res = await w.post<ApiError>('/api/market/salvage', token, { uid });
    expect([res.status, res.body.code]).toEqual([400, 'relic_kept']);
    const after = await w.me(token);
    expect(after.marks).toBe(marks);
    expect(after.items.find((i) => i.uid === uid)?.item.serial).toBe(1);
  });

  it('can be posted with no price cap and the usual fee and tax, and keeps its number and finder', async () => {
    const { w, token, uid } = await withRelic('saddlescabbard');
    const finder = (await w.me(token)).name;
    const buyer = await w.player(30);
    // Marks for the fees and for the purchase, entered in the ledger like any other.
    const give = async (t: string, marks: number) => {
      const name = (await w.me(t)).name;
      const row = w.db.prepare('SELECT id FROM players WHERE name = ?').get(name) as { id: number };
      w.db.prepare('UPDATE players SET marks = marks + ? WHERE id = ?').run(marks, row.id);
      w.db.prepare(`INSERT INTO ledger (ts, player_id, kind, marks, reason) VALUES (?, ?, 'test_grant', ?, '')`).run(w.now(), row.id, marks);
    };
    await give(token, 50_000);
    await give(buyer, 2_000_000);

    // An ordinary item still has its cap; the relic does not.
    const whet = (await w.grant(token, [A])).find((i) => i.item.id === A)!;
    const capped = await w.post<ApiError>('/api/market/list', token, { uid: whet.uid, price: 100_001, idem: 'cap-test-1' });
    expect(capped.status).toBe(400);
    const PRICE = 1_000_000;
    const before = (await w.me(token)).marks;
    const posted = await w.post<MarketActionRes>('/api/market/list', token, { uid, price: PRICE, idem: 'relic-post-1' });
    expect(posted.status).toBe(200);
    expect(posted.body.profile.marks).toBe(before - PRICE * 0.02);
    expect(posted.body.profile.items.some((i) => i.item.relic)).toBe(false);
    const listing = posted.body.market.listings.find((l) => l.item.relic)!;
    expect(listing).toMatchObject({ price: PRICE, mine: true, item: { id: 'saddlescabbard', serial: 1, by: finder } });

    // Withdrawn, it comes back as the same relic. Posted again and bought, it changes hands whole.
    const back = await w.post<MarketActionRes>('/api/market/cancel', token, { listingId: listing.id });
    const again = back.body.profile.items.find((i) => i.item.relic)!;
    expect(again.item).toMatchObject({ serial: 1, by: finder });
    const repost = await w.post<MarketActionRes>('/api/market/list', token, { uid: again.uid, price: PRICE, idem: 'relic-post-2' });
    const l2 = repost.body.market.listings.find((l) => l.item.relic)!;
    const sellerBefore = repost.body.profile.marks;
    const seen = (await w.get<MarketRes>('/api/market', buyer)).body.listings.find((l) => l.id === l2.id)!;
    expect(seen).toMatchObject({ mine: false, seller: finder, item: { serial: 1, by: finder } });
    const bought = await w.post<MarketActionRes>('/api/market/buy', buyer, { listingId: l2.id, idem: 'relic-buy-1' });
    expect(bought.status).toBe(200);
    expect(bought.body.profile.marks).toBe(2_000_000 - PRICE);
    // The buyer holds No. 1, still under the finder's name. The seller got the price less 5%.
    const got = bought.body.profile.items.find((i) => i.item.relic)!;
    expect(got.item).toMatchObject({ id: 'saddlescabbard', serial: 1, by: finder });
    expect((await w.me(token)).marks).toBe(sellerBefore + PRICE - PRICE * 0.05);
    expect(await relicsOf(w, token)).toHaveLength(0);
    // The buyer can pack it, and the world still counts exactly one.
    expect((await w.run(buyer, { wavesCleared: 1 }, { kit: [got.uid] })).start.kit[0]).toMatchObject({ serial: 1, by: finder });
    expect(worldCount(w)).toBe(1);
    expect(audit(w.db).ok).toBe(true);
  });

  it('Pack saddle: the town accepts one more carried item, only when it was packed', async () => {
    const { w, token, uid } = await withRelic('packsaddle');
    const bare = await w.run(token, { ...WIN, carry: [A, B, C, D] });
    expect([bare.status, (bare.end as unknown as ApiError).code]).toEqual([400, 'bad_carry']);
    const packed = await w.run(token, { ...WIN, carry: [A, B, C, D] }, { kit: [uid] });
    expect(packed.status).toBe(200);
    expect(packed.end.gained.items.map((i) => i.id)).toEqual([A, B, C, D]);
    // One more, not two; and it holds on a short run too.
    const s = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [uid] });
    w.advance(20 * MIN);
    const five = await w.post<ApiError>('/api/run/end', token, { ...report(s.body.runId, WIN), carry: [A, B, C, D, A] });
    expect(five.status).toBe(400);
    const short = await w.run(token, { wavesCleared: 5, carry: [A, B] }, { kit: [uid] });
    expect(short.status).toBe(200);
    expect((await w.run(token, { wavesCleared: 5, carry: [A, B, C] }, { kit: [uid] })).status).toBe(400);
  });

  it('Oilskin wrap: the item packed beside it loses no charge on a win, and does on a loss', async () => {
    const { w, token, uid } = await withRelic('oilskinwrap');
    const whet = (await w.grant(token, [A])).find((i) => i.item.id === A)!;
    const chargesOf = async () => (await w.me(token)).items.find((i) => i.uid === whet.uid)?.charges ?? 0;
    expect(await chargesOf()).toBe(3);
    // The charge is spent at the start whatever happens, so leaving a run is not free.
    const s = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [uid, whet.uid] });
    expect(s.body.profile.items.find((i) => i.uid === whet.uid)?.charges).toBe(2);
    w.advance(20 * MIN);
    await w.post('/api/run/end', token, report(s.body.runId, WIN));
    expect(await chargesOf()).toBe(3);
    // A loss keeps the charge spent.
    await w.run(token, { wavesCleared: 10 }, { kit: [uid, whet.uid] });
    expect(await chargesOf()).toBe(2);
    await w.run(token, { wavesCleared: 0 }, { kit: [uid, whet.uid] });
    expect(await chargesOf()).toBe(1);
    // On its last charge the item is gone during the run and comes back, same uid, after a win.
    const last = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [uid, whet.uid] });
    expect(last.body.profile.items.find((i) => i.uid === whet.uid)).toBeUndefined();
    w.advance(20 * MIN);
    await w.post('/api/run/end', token, report(last.body.runId, WIN));
    expect(await chargesOf()).toBe(1);
    // Without the wrap a win spends the charge and the item is gone for good.
    await w.run(token, WIN, { kit: [whet.uid] });
    expect(await chargesOf()).toBe(0);
    // The wrap itself is still there, unworn.
    expect((await relicsOf(w, token))[0].uid).toBe(uid);
  });
});

describe('relics: the world roll and the notice', () => {
  it('lists every kind, found or not, and every find by name, without saying who holds it', async () => {
    const d = dice(landOn('brandyflask'));
    const w = world({ rng: d.rng });
    const [p1, p2] = [await w.player(3), await w.player(3)];
    const empty = (await w.get<RelicsRes>('/api/relics', p1)).body;
    expect(empty.total).toBe(0);
    expect(empty.roll).toEqual([]);
    expect(empty.kinds).toHaveLength(8);
    expect(empty.kinds.every((k) => k.id === null && k.name === null && k.found === 0)).toBe(true);

    await w.run(p1, WIN);
    w.advance(3 * DAY);
    await w.run(p2, WIN);
    d.value = landOn('orderbook');
    await w.run(p2, WIN);
    const [n1, n2] = [(await w.me(p1)).name, (await w.me(p2)).name];
    const res = (await w.get<RelicsRes>('/api/relics', p2)).body;
    expect(res.total).toBe(3);
    expect(res.roll.map((f) => [f.name, f.serial, f.finder, f.date])).toEqual([
      ['Brandy flask', 1, n1, '2026-11-11'],
      ['Brandy flask', 2, n2, '2026-11-14'],
      ['Order book', 1, n2, '2026-11-14'],
    ]);
    // Found kinds first with their counts, then a blank line for each kind nobody has.
    expect(res.kinds.slice(0, 2)).toEqual([{ id: 'brandyflask', name: 'Brandy flask', found: 2 }, { id: 'orderbook', name: 'Order book', found: 1 }]);
    expect(res.kinds.slice(2)).toEqual(Array(6).fill({ id: null, name: null, found: 0 }));
    // No holder, no uid, no player id anywhere in it.
    expect(JSON.stringify(res)).not.toMatch(/holder|uid|player/);
    expect(Object.keys(res.roll[0]).sort()).toEqual(['date', 'finder', 'name', 'relic', 'serial', 'ts']);
    // It needs a device like every other endpoint.
    expect((await w.get('/api/relics')).status).toBe(401);
  });

  it('tells everyone for 24 hours and then stops', async () => {
    const d = dice(landOn('seedcorn'));
    const w = world({ rng: d.rng });
    const [finder, stranger] = [await w.player(), await w.player()];
    expect((await w.post<HelloRes>('/api/hello', stranger)).body.notice).toBeNull();
    await w.run(finder, WIN);
    const name = (await w.me(finder)).name;
    const told = (await w.post<HelloRes>('/api/hello', stranger)).body.notice;
    expect(told).toMatchObject({ finder: name, name: 'Seed corn', serial: 1 });
    // A run ticket carries it too, so a player coming back from the clearing sees it.
    d.value = 0.9;
    const s = await w.post<RunStartRes>('/api/run/start', stranger, { mode: 'run', character: 'greenhorn', kit: [] });
    expect(s.body.notice).toMatchObject({ finder: name, serial: 1 });
    w.advance(23 * HOUR);
    expect((await w.post<HelloRes>('/api/hello', stranger)).body.notice).toMatchObject({ serial: 1 });
    w.advance(HOUR);
    expect((await w.post<HelloRes>('/api/hello', stranger)).body.notice).toBeNull();
    // The roll keeps it for good.
    expect((await w.get<RelicsRes>('/api/relics', stranger)).body.total).toBe(1);
  });
});

describe('relics: development and old databases', () => {
  it('honours RELIC_FORCE outside production only', async () => {
    expect(devRelicForce({ NODE_ENV: 'development', RELIC_FORCE: 'hideblind' })).toBe('hideblind');
    expect(devRelicForce({ RELIC_FORCE: 'hideblind' })).toBe('hideblind');
    expect(devRelicForce({ NODE_ENV: 'production', RELIC_FORCE: 'hideblind' })).toBeNull();
    expect(devRelicForce({ NODE_ENV: 'production' }, 'hideblind')).toBeNull();
    expect(devRelicForce({ NODE_ENV: 'development', RELIC_FORCE: 'goldenchest' })).toBeNull();
    expect(devRelicForce({ NODE_ENV: 'development', RELIC_FORCE: '__proto__' })).toBeNull();
    expect(devRelicForce({ NODE_ENV: 'development' })).toBeNull();

    // Forced, any paying report finds it, even a death on wave 1 with dice that never hit.
    const d = dice(0.99);
    const w = world({ rng: d.rng, relicForce: 'hideblind' });
    const token = await w.player(4);
    expect((await w.run(token, { wavesCleared: 0 })).end.relic).toMatchObject({ id: 'hideblind', serial: 1 });
    // Practice still pays nothing.
    const s = await w.post<RunStartRes>('/api/run/start', token, { mode: 'practice', character: 'greenhorn', kit: [] });
    w.advance(10 * MIN);
    expect((await w.post<RunEndRes>('/api/run/end', token, report(s.body.runId, { wavesCleared: 8, won: true }))).body.relic).toBeUndefined();

    // In production the option is dead.
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const prod = world({ rng: d.rng, relicForce: 'hideblind' });
      const t = await prod.player();
      expect((await prod.run(t, WIN)).end.relic).toBeUndefined();
      expect(worldCount(prod)).toBe(0);
    } finally {
      process.env.NODE_ENV = env;
    }
  });

  it('migrates a database made before relics, keeping what was in it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scrip-migrate-'));
    const path = join(dir, 'old.db');
    try {
      // A version 1 file with a player, a stash item, a listing and a finished run.
      const old = new Database(path);
      old.exec(MIGRATIONS[0] as string);
      old.pragma('user_version = 1');
      old.prepare(`INSERT INTO players (id, token_hash, name, marks, runs, created, last_seen) VALUES (1, 'h', 'Carter 412', 50, 6, 0, 0)`).run();
      old.prepare(`INSERT INTO stash (uid, player_id, item_id, charges, created) VALUES ('u1', 1, ?, 2, 0)`).run(A);
      old.prepare(`INSERT INTO listings (id, seller, item_id, charges, price, status, created) VALUES ('l1', 1, ?, 3, 40, 'open', 0)`).run(B);
      old.prepare(`INSERT INTO runs (id, player_id, mode, character, seed, waves, kit, day, scored, status, started, ended) VALUES ('r1', 1, 'run', 'greenhorn', 1, 12, '[]', '2026-11-01', 0, 'ended', 0, 1)`).run();
      old.close();

      const db = openDb(path);
      expect(db.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length);
      expect(db.prepare('SELECT uid, item_id, charges, relic_ref FROM stash').all()).toEqual([{ uid: 'u1', item_id: A, charges: 2, relic_ref: null }]);
      expect(db.prepare('SELECT id, relic_ref FROM listings').all()).toEqual([{ id: 'l1', relic_ref: null }]);
      expect(db.prepare('SELECT relic_roll, kit_uids FROM runs').all()).toEqual([{ relic_roll: 0, kit_uids: '[]' }]);
      // Opening it a second time changes nothing.
      db.close();
      const again = openDb(path);
      expect(again.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length);

      // The migrated world plays on: the old listing shows, and a win can find a relic.
      const d = dice(landOn('packsaddle'));
      const w = world({ db: again, rng: d.rng });
      const token = await w.player(3);
      expect((await w.get<MarketRes>('/api/market', token)).body.listings.map((l) => [l.id, l.seller])).toEqual([['l1', 'Carter 412']]);
      expect((await w.run(token, WIN)).end.relic).toMatchObject({ id: 'packsaddle', serial: 1 });
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
