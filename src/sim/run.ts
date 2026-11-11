// Run lifecycle: create, step, next wave, summary, state hash.
import { fnv1a, type ItemSpec } from '../shared/item.ts';
import { RELIC } from '../shared/content/relics.ts';
import { DAILY_WAVES, KIT_SLOTS, RUN_WAVES } from '../shared/protocol.ts';
import { emptyRaws, RAWS, STATS, type RawBag } from '../shared/vocab.ts';
import { CHARACTER } from './data/characters.ts';
import {
  ARENA_H, ARENA_W, DT, GRID_CELL, MAX_ENEMIES, MAX_ESHOTS, MAX_EVENTS, MAX_HAZARDS, MAX_NODES, MAX_PICKUPS,
  MAX_SHOTS, PLAYER_BASE_HP,
} from './data/tuning.ts';
import { WAVE_PLAN, WAVES } from './data/waves.ts';
import { SOURCE_COUNT, SOURCE_IDS, WEAPON_INDEX } from './data/weapons.ts';
import { BENCH_OFFERS, newOffer } from './bench.ts';
import { buildGrid, clampX, clampY, rebuild, refresh, runBursts, SP, SPECIAL_COUNT, ST, xpForLevel } from './core.ts';
import { direct, updateEnemies, updateEShots, updateHazards } from './enemies.ts';
import { seedStreams } from './rng.ts';
import type { Enemy, EShot, Hazard, Pickup, ResNode, Run, RunOptions, Shot, SimEvent } from './types.ts';
import { makeWeapon, updateShots, updateWeapons } from './weapons.ts';
import { endWave, startWave, updateNodes, updatePickups } from './world.ts';

/** Player input for one tick: a direction with length 0..1. Longer vectors are normalised. */
export interface StepInput { mx: number; my: number }

const fill = <T>(n: number, make: () => T): T[] => Array.from({ length: n }, make);

const newEnemy = (): Enemy => ({
  alive: false, uid: 0, type: 0, x: 0, y: 0, px: 0, py: 0, kx: 0, ky: 0, hp: 0, maxHp: 0, dmg: 0, r: 0, state: 0,
  t: 0, t2: 0, t3: 0, dx: 1, dy: 0, tx: 0, ty: 0, burnDps: 0, burnT: 0, slowT: 0, slowF: 0, flash: 0, n: 0,
  loot0: 0, loot1: 0, loot2: 0, loot3: 0, work: 0, seed: 0,
});
const newShot = (): Shot => ({
  alive: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, dmg: 0, src: 0, r: 5, life: 0, pierce: 0, bounce: 0,
  np: 0, nb: 0, crit: false, knock: 0, burn: 0, slow: 0, hit: new Int32Array(12), hits: 0,
});
const newEShot = (): EShot => ({ alive: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, dmg: 0, r: 0, life: 0, type: 0, owner: -1, ownerUid: 0 });
const newPickup = (): Pickup => ({ alive: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, kind: 0, value: 0, pulled: false, claimed: -1 });
const newNode = (): ResNode => ({ alive: false, x: 0, y: 0, type: 0, rich: false, work: 0, need: 1, working: false, tickAcc: 0, regrown: false });
const newHazard = (): Hazard => ({ alive: false, kind: 0, x: 0, y: 0, r0: 0, r1: 0, t: 0, dur: 0, dmg: 0, type: 0, owner: -1, ownerUid: 0 });
const newEvent = (): SimEvent => ({ type: 'hit', x: 0, y: 0, a: 0, b: 0 });

/** Start a run. The first wave is already under way when this returns. */
export function createRun(opts: RunOptions): Run {
  const ch = CHARACTER[opts.character];
  if (!ch) throw new Error(`Unknown character ${opts.character}`);
  const totalWaves = opts.waves === DAILY_WAVES ? DAILY_WAVES : RUN_WAVES;
  const cols = Math.ceil(ARENA_W / GRID_CELL), rows = Math.ceil(ARENA_H / GRID_CELL);
  const base = new Float64Array(STATS.length);
  base[ST.maxHp] = PLAYER_BASE_HP;
  for (const s of STATS) base[ST[s]] += ch.stats[s] ?? 0;
  const start = WEAPON_INDEX[opts.startWeapon ?? ch.start] ?? WEAPON_INDEX[ch.start];
  // Two kit items at most, and only one of them may be a relic.
  let relics = 0;
  const kit = (opts.kit ?? []).slice(0, KIT_SLOTS).filter((k) => k.relic !== true || (Object.hasOwn(RELIC, k.id) && ++relics === 1));
  const run: Run = {
    seed: opts.seed >>> 0, character: ch.id, totalWaves, plan: WAVE_PLAN[totalWaves],
    stations: { sawmill: 1, smelter: 1, tannery: 1, assay: 1, ...(opts.stations ?? {}) },
    rng: seedStreams(opts.seed), tick: 0, phase: 'wave', wave: 0, waveTime: 0, waveSeconds: 0, wavesCleared: 0, won: false,
    player: {
      x: ARENA_W / 2, y: ARENA_H / 2, px: ARENA_W / 2, py: ARENA_H / 2, fx: 0, fy: 1, moving: false,
      hp: PLAYER_BASE_HP, shield: 0, iframes: 0, level: 1, xp: 0, xpNext: xpForLevel(1), scrip: 0, bank: 0,
      raws: emptyRaws(), weapons: [makeWeapon(start, 1)], items: kit.slice(), itemKit: kit.map(() => true),
      base, stat: new Float64Array(STATS.length), sp: new Float64Array(SPECIAL_COUNT), flat: new Float64Array(STATS.length),
      piercePct: 0, bouncePct: 0, classCount: new Int32Array(4),
      maxHp: PLAYER_BASE_HP, mendPerSec: 0, takenMul: 1, dodge: 0, moveSpeed: 0, dmgMul: 1, rateMul: 1, critChance: 0,
      workRate: 1, magnetR: 0, knockAdd: 0, secondWindUsed: false, secondLifeUsed: false, workingNode: -1,
    },
    enemies: fill(MAX_ENEMIES, newEnemy), enemyCount: 0,
    shots: fill(MAX_SHOTS, newShot), eshots: fill(MAX_ESHOTS, newEShot), pickups: fill(MAX_PICKUPS, newPickup),
    nodes: fill(MAX_NODES, newNode), hazards: fill(MAX_HAZARDS, newHazard),
    events: { list: fill(MAX_EVENTS, newEvent), n: 0, dropped: 0 },
    grid: { cols, rows, start: new Int32Array(cols * rows + 1), items: new Int16Array(MAX_ENEMIES), fill: new Int32Array(cols * rows) },
    bench: { index: 0, picks: 0, choices: [], offers: fill(BENCH_OFFERS, newOffer), rerolls: 0, freeReroll: false, mule: false, interestPaid: 0 },
    eliteIdx: -1, lanes: new Float64Array(16), laneCount: 0,
    groupNext: new Float64Array(Math.max(...WAVES.map((w) => w.groups.length))),
    eliteSpawned: false, burstQ: new Float64Array(64 * 3), burstN: 0, nextUid: 1, bossDead: false,
    pace: 1, summonN: 0,
    scripEarned: 0, kills: 0, mule: emptyRaws(), gathered: emptyRaws(), dmgBy: new Float64Array(SOURCE_COUNT),
    damageTaken: 0, fusions: [], carry: [], killedBy: '', deathWave: 0,
    scripByWave: new Array(totalWaves + 1).fill(0), rawsByWave: new Array(totalWaves + 1).fill(0),
    upgradeLog: [], buyLog: [],
  };
  startWave(run);
  return run;
}

/** Advance the run by one 60 Hz tick. Does nothing unless a wave is in progress. */
export function step(run: Run, input: StepInput): void {
  if (run.phase !== 'wave') return;
  const p = run.player;
  run.tick++;
  run.waveTime += DT;

  // Player.
  p.px = p.x; p.py = p.y;
  let mx = input.mx, my = input.my;
  if (!(mx === mx) || !(my === my)) { mx = 0; my = 0; }
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 1) { mx /= len; my /= len; }
  p.moving = len > 0.05;
  refresh(run);
  if (p.moving) {
    p.x = clampX(p.x + mx * p.moveSpeed * DT);
    p.y = clampY(p.y + my * p.moveSpeed * DT);
    const l = len > 1 ? 1 : len;
    p.fx = mx / l; p.fy = my / l;
  }
  if (p.iframes > 0) p.iframes -= DT;
  if (p.mendPerSec > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.mendPerSec * DT);

  direct(run);
  buildGrid(run);
  updateEnemies(run);
  if (run.phase === 'wave') updateHazards(run);
  if (run.phase === 'wave') updateEShots(run);
  if (run.phase !== 'wave') return;
  updateWeapons(run);
  updateShots(run);
  runBursts(run);
  updateNodes(run);
  updatePickups(run);

  if (run.bossDead || run.waveTime >= run.waveSeconds) endWave(run);
}

/** Leave the bench and start the next wave. Unspent upgrade picks carry over. */
export function nextWave(run: Run): boolean {
  if (run.phase !== 'bench') return false;
  startWave(run);
  return true;
}

/** Give up. Counts as a death in the current wave. */
export function abandon(run: Run): void {
  if (run.phase === 'over') return;
  run.phase = 'over'; run.won = false; run.killedBy = 'abandoned'; run.deathWave = run.wave;
}

/** Empty the event queue after the presentation layer has read it. */
export function clearEvents(run: Run): void { run.events.n = 0; }

/** How many items may be carried home: floor(waves cleared / 4), and one more with the Pack saddle. */
export function carryLimit(run: Run): number { return Math.floor(run.wavesCleared / 4) + (run.player.sp[SP.extraCarry] > 0 ? 1 : 0); }

/** Items that may be carried home (everything held except kit items). */
export function carryable(run: Run): ItemSpec[] {
  return run.player.items.filter((_, i) => !run.player.itemKit[i]);
}

/** Choose which items to carry home. Only after the run is over. Returns false if the choice is not allowed. */
export function setCarry(run: Run, ids: string[]): boolean {
  if (run.phase !== 'over' || ids.length > carryLimit(run)) return false;
  const pool = carryable(run).map((i) => i.id);
  for (const id of ids) {
    const k = pool.indexOf(id);
    if (k < 0) return false;
    pool.splice(k, 1);
  }
  run.carry = ids.slice();
  return true;
}

/** The fields of RunEndReq except runId, plus what the recap screen shows. */
export interface RunSummary {
  wavesCleared: number;
  won: boolean;
  scripEarned: number;
  scripHeld: number;
  level: number;
  raws: RawBag;
  mule: RawBag;
  carry: string[];
  kills: number;
  fusions: [string, string, string][];
  // Recap only:
  character: string;
  totalWaves: number;
  /** Enemy id that landed the killing blow, 'abandoned', or '' on a win. */
  killedBy: string;
  /** Wave the run ended in (the last wave on a win). */
  endWave: number;
  /** Damage dealt per weapon id, plus burn, thorns, burst, recoil, shards. Zero entries are left out. */
  damageBy: Record<string, number>;
  damageTaken: number;
  rawsGathered: RawBag;
  carryLimit: number;
  seconds: number;
}

export function summary(run: Run): RunSummary {
  const p = run.player;
  const damageBy: Record<string, number> = {};
  for (let i = 0; i < SOURCE_COUNT; i++) if (run.dmgBy[i] > 0) damageBy[SOURCE_IDS[i]] = Math.round(run.dmgBy[i]);
  return {
    wavesCleared: run.wavesCleared, won: run.won, scripEarned: run.scripEarned, scripHeld: p.scrip, level: p.level,
    raws: { ...p.raws }, mule: { ...run.mule }, carry: run.carry.slice(), kills: run.kills,
    fusions: run.fusions.map((f) => [f[0], f[1], f[2]]),
    character: run.character, totalWaves: run.totalWaves, killedBy: run.killedBy,
    endWave: run.phase === 'over' && !run.won ? run.deathWave : run.wave,
    damageBy, damageTaken: run.damageTaken, rawsGathered: { ...run.gathered }, carryLimit: carryLimit(run),
    seconds: run.tick * DT,
  };
}

const HASH_BUF = new Float64Array(1);
const HASH_U32 = new Uint32Array(HASH_BUF.buffer);
let H = 0;
function hn(v: number): void {
  HASH_BUF[0] = v;
  H = Math.imul(H ^ HASH_U32[0], 0x01000193);
  H = Math.imul(H ^ HASH_U32[1], 0x01000193);
}

/** A hash of everything that matters to the outcome. Equal seeds and inputs give equal hashes. */
export function stateHash(run: Run): number {
  const p = run.player;
  H = 0x811c9dc5;
  hn(run.tick); hn(run.wave); hn(run.phase === 'wave' ? 1 : run.phase === 'bench' ? 2 : 3); hn(run.waveTime);
  hn(p.x); hn(p.y); hn(p.hp); hn(p.shield); hn(p.level); hn(p.xp); hn(p.scrip); hn(p.bank);
  for (const r of RAWS) { hn(p.raws[r]); hn(run.mule[r]); hn(run.gathered[r]); }
  for (let i = 0; i < p.base.length; i++) { hn(p.base[i]); hn(p.stat[i]); }
  for (const w of p.weapons) { hn(w.def); hn(w.tier); hn(w.cd); }
  for (const it of p.items) hn(fnv1a(it.id));
  for (let i = 0; i < run.rng.length; i++) hn(run.rng[i]);
  for (const e of run.enemies) if (e.alive) { hn(e.uid); hn(e.type); hn(e.x); hn(e.y); hn(e.hp); hn(e.state); hn(e.t); }
  for (const s of run.shots) if (s.alive) { hn(s.x); hn(s.y); hn(s.dmg); }
  for (const s of run.eshots) if (s.alive) { hn(s.x); hn(s.y); }
  for (const k of run.pickups) if (k.alive) { hn(k.x); hn(k.y); hn(k.kind); hn(k.value); }
  for (const n of run.nodes) if (n.alive) { hn(n.x); hn(n.y); hn(n.type); hn(n.work); }
  for (const h of run.hazards) if (h.alive) { hn(h.x); hn(h.y); hn(h.t); }
  for (const o of run.bench.offers) { hn(fnv1a(o.id)); hn(o.price); hn(o.tier); hn(o.sold ? 1 : 0); hn(o.locked ? 1 : 0); }
  hn(run.kills); hn(run.scripEarned); hn(run.damageTaken);
  for (let i = 0; i < run.dmgBy.length; i++) hn(run.dmgBy[i]);
  return H >>> 0;
}

/** True if any number in the state is NaN or infinite. For tests. */
export function hasBadNumber(run: Run): string | null {
  const p = run.player;
  const bad = (v: number) => !Number.isFinite(v);
  const chk: [string, number][] = [
    ['p.x', p.x], ['p.y', p.y], ['p.hp', p.hp], ['p.maxHp', p.maxHp], ['p.xp', p.xp], ['p.scrip', p.scrip], ['p.bank', p.bank],
    ['p.shield', p.shield], ['p.moveSpeed', p.moveSpeed], ['p.dmgMul', p.dmgMul], ['p.rateMul', p.rateMul], ['p.takenMul', p.takenMul],
    ['scripEarned', run.scripEarned], ['waveTime', run.waveTime], ['damageTaken', run.damageTaken],
  ];
  for (const [k, v] of chk) if (bad(v)) return k;
  for (const r of RAWS) if (bad(p.raws[r]) || bad(run.mule[r]) || bad(run.gathered[r])) return `raws.${r}`;
  for (let i = 0; i < p.stat.length; i++) if (bad(p.stat[i]) || bad(p.base[i]) || bad(p.flat[i])) return `stat.${STATS[i]}`;
  for (let i = 0; i < p.sp.length; i++) if (bad(p.sp[i])) return `sp.${i}`;
  for (let i = 0; i < run.dmgBy.length; i++) if (bad(run.dmgBy[i])) return `dmgBy.${i}`;
  for (const e of run.enemies) if (e.alive && (bad(e.x) || bad(e.y) || bad(e.hp) || bad(e.kx) || bad(e.ky) || bad(e.t))) return `enemy.${e.type}`;
  for (const s of run.shots) if (s.alive && (bad(s.x) || bad(s.y) || bad(s.dmg) || bad(s.vx))) return 'shot';
  for (const s of run.eshots) if (s.alive && (bad(s.x) || bad(s.y))) return 'eshot';
  for (const k of run.pickups) if (k.alive && (bad(k.x) || bad(k.y) || bad(k.value))) return 'pickup';
  for (const h of run.hazards) if (h.alive && (bad(h.x) || bad(h.t))) return 'hazard';
  for (const o of run.bench.offers) if (bad(o.price)) return 'offer';
  return null;
}
