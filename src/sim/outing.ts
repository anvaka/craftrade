// An outing: one visit to a zone. The first minutes are quiet; a threat meter
// climbs with time and with the noise of work, and what it brings gets worse
// until the player walks out at a camp, recalls, or falls.
//
// This file holds the zone, the skills, the bag and the per-tick hooks that
// run.ts calls in place of the wave director. It must not import run.ts.
import { tcos, tsin } from './trig.ts';
import { ENEMY_INDEX } from './data/enemies.ts';
import { DT, NODE_DECAY, NODE_RING, PICKUP_FLY_SPEED, PLAYER_R, WORK_TICK } from './data/tuning.ts';
import { WEAPONS } from './data/weapons.ts';
import { clampX, clampY, emit, spawnEnemy, spawnPickup, ST, standNode } from './core.ts';
import { rnd, Stream } from './rng.ts';
import { ES, NODE_CARCASS, NODE_PLANT, NODE_SEAM, NODE_TREE, type Outing, type Run } from './types.ts';

/** One gathering skill per node type, in node type order. */
export const SKILLS = ['logging', 'mining', 'skinning', 'harvesting'] as const;
export const SKILL_NAME: readonly string[] = ['Logging', 'Mining', 'Skinning', 'Harvesting'];
/** What each node type is called on an outing. */
export const OUTING_NODE: readonly string[] = ['tree', 'seam', 'carcass', 'plant'];

export interface MaterialDef { id: string; name: string; type: number; tier: number }
/** Index = node type x 2 + tier - 1. */
export const MATERIALS: readonly MaterialDef[] = [
  { id: 'greenwood', name: 'Green wood', type: NODE_TREE, tier: 1 },
  { id: 'agedwood', name: 'Aged wood', type: NODE_TREE, tier: 2 },
  { id: 'ironore', name: 'Iron ore', type: NODE_SEAM, tier: 1 },
  { id: 'silverore', name: 'Silver ore', type: NODE_SEAM, tier: 2 },
  { id: 'rawhide', name: 'Rawhide', type: NODE_CARCASS, tier: 1 },
  { id: 'thickhide', name: 'Thick hide', type: NODE_CARCASS, tier: 2 },
  { id: 'flax', name: 'Flax', type: NODE_PLANT, tier: 1 },
  { id: 'reed', name: 'Reed', type: NODE_PLANT, tier: 2 },
];
export const matIndex = (type: number, tier: number): number => type * 2 + tier - 1;
/** Pickup kinds from here up are materials: kind = PK_MAT + material index. */
export const PK_MAT = 4;

export const OUTING = {
  w: 4200, h: 3000,
  /** A bag slot holds this many of one material. */
  stack: 20,
  slots: 12,
  /** Seconds for the meter to fill by time alone. */
  threatSeconds: 480,
  /** Threat added per unit of work done on a node. */
  noise: 0.0008,
  /** Threat at which each stage begins: stirring, hunting, awake. */
  stages: [0.3, 0.6, 1] as readonly number[],
  campR: 120,
  /** Health mended per second while standing in a camp. */
  campHeal: 1,
  /** Share of the bag kept by how the outing ended. */
  keep: { camp: 1, recall: 0.6, dead: 0.3 } as Record<string, number>,
  /** Packs arrive this far from the player. */
  packRing: 720,
  /** Skill level a tier 2 node asks for. */
  tier2Level: 5,
  yield: [0, 3, 4] as readonly number[],
  xp: [0, 10, 28] as readonly number[],
} as const;
export const STAGE_NAME: readonly string[] = ['Quiet', 'Stirring', 'Hunting', 'Awake'];

/** Experience needed to go from `level` to the next. */
export const xpToNext = (level: number): number => 30 + 15 * level;
/** Level for a total of experience. Levels start at 1. */
export function skillLevel(xp: number): number {
  let level = 1, left = xp;
  while (left >= xpToNext(level)) { left -= xpToNext(level); level++; }
  return level;
}
/** Progress 0..1 through the current level. */
export function skillProgress(xp: number): number {
  let level = 1, left = xp;
  while (left >= xpToNext(level)) { left -= xpToNext(level); level++; }
  return left / xpToNext(level);
}

export function newOuting(xp: readonly number[] | undefined): Outing {
  const o: Outing = {
    time: 0, threat: 0, stage: 0, nextPack: 0, camps: new Float64Array(6), campCount: 0, inCamp: 0, result: '',
    bag: new Int32Array(MATERIALS.length), bagSlots: OUTING.slots,
    xp: new Float64Array(SKILLS.length), gained: new Float64Array(SKILLS.length), broken: new Int32Array(SKILLS.length), quiet: 0,
  };
  for (let i = 0; i < SKILLS.length; i++) o.xp[i] = Math.max(0, Number(xp?.[i]) || 0);
  return o;
}

/** Bag slots in use. */
export function bagUsed(o: Outing): number {
  let n = 0;
  for (let i = 0; i < o.bag.length; i++) n += Math.ceil(o.bag[i] / OUTING.stack);
  return n;
}
/** Items carried in all. */
export function bagCount(o: Outing): number {
  let n = 0;
  for (let i = 0; i < o.bag.length; i++) n += o.bag[i];
  return n;
}
const canTake = (o: Outing, m: number): boolean => o.bag[m] % OUTING.stack !== 0 || bagUsed(o) < o.bagSlots;

/** True if the player's skill is too low to work this node. */
export function nodeLocked(run: Run, type: number, tier: number): boolean {
  return !!run.outing && tier > 1 && skillLevel(run.outing.xp[type]) < OUTING.tier2Level;
}

// ---- the zone --------------------------------------------------------------

const T_BOAR = ENEMY_INDEX.boar, T_SPITTER = ENEMY_INDEX.spitter, T_BADGER = ENEMY_INDEX.burrower, T_BEAR = ENEMY_INDEX.brute;
const T_MITE = ENEMY_INDEX.mite, T_GNAT = ENEMY_INDEX.gnat;

function free(run: Run, x: number, y: number, gap: number): boolean {
  for (const n of run.nodes) {
    if (!n.alive) continue;
    const dx = n.x - x, dy = n.y - y;
    if (dx * dx + dy * dy < gap * gap) return false;
  }
  return true;
}
function campGap(o: Outing, x: number, y: number): number {
  let best = 1e18;
  for (let i = 0; i < o.campCount; i++) {
    const dx = o.camps[i * 2] - x, dy = o.camps[i * 2 + 1] - y, d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
function stand(run: Run, x: number, y: number, type: number, tier: number): boolean {
  const i = standNode(run, x, y, type, tier);
  if (i < 0) return false;
  // Plants come up by hand: no tool doubles the rate, so they ask for less.
  if (type === NODE_PLANT) run.nodes[i].need *= 0.6;
  return true;
}
function guard(run: Run, type: number, x: number, y: number, level: number, aggro: number): void {
  const was = run.wave;
  run.wave = level;
  const i = spawnEnemy(run, type, x, y, 0);
  run.wave = was;
  if (i < 0) return;
  const e = run.enemies[i];
  // t2 holds how near the player may come before it turns on them. Nothing aims at it until then.
  e.state = ES.Guard; e.t = 0; e.t2 = aggro;
}

/** Lay out the zone from the run's seed: camps, groves, guards, game. The player arrives at the first camp. */
export function buildZone(run: Run): void {
  const o = run.outing!, W = run.w, H = run.h, r = (): number => rnd(run.rng, Stream.Spawn);
  // Camps: one near the middle, two more far from it and from each other.
  o.camps[0] = W * (0.35 + r() * 0.3); o.camps[1] = H * (0.35 + r() * 0.3); o.campCount = 1;
  for (let tries = 0; tries < 200 && o.campCount < 3; tries++) {
    const x = 320 + r() * (W - 640), y = 320 + r() * (H - 640);
    if (campGap(o, x, y) < 1400 - tries * 3) continue;
    o.camps[o.campCount * 2] = x; o.camps[o.campCount * 2 + 1] = y; o.campCount++;
  }
  const cx = o.camps[0], cy = o.camps[1], p = run.player;
  p.x = p.px = cx; p.y = p.py = cy;

  // One tier 2 node of each kind in sight of the start, so the first thing seen is something to grow into.
  const KINDS = [NODE_TREE, NODE_SEAM, NODE_PLANT];
  const a0 = r() * 6.2832;
  for (let k = 0; k < 3; k++) {
    const a = a0 + k * 2.0944, d = 330 + r() * 120;
    stand(run, cx + tcos(a) * d, cy + tsin(a) * d, KINDS[k], 2);
  }
  // Groves. Near the start they are tier 1; far ones are often tier 2 and guarded.
  const centres: number[] = [];
  for (let c = 0; c < 24; c++) {
    let x = 0, y = 0, ok = false;
    for (let tries = 0; tries < 40 && !ok; tries++) {
      x = 220 + r() * (W - 440); y = 220 + r() * (H - 440);
      ok = campGap(o, x, y) > 380;
      for (let k = 0; ok && k < centres.length; k += 2) {
        const dx = centres[k] - x, dy = centres[k + 1] - y;
        if (dx * dx + dy * dy < 400 * 400) ok = false;
      }
    }
    if (!ok) continue;
    centres.push(x, y);
    const type = KINDS[c % 3];
    const dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
    const tier = dist > 1150 && r() < 0.65 ? 2 : 1;
    const count = tier > 1 ? 2 + Math.floor(r() * 2) : 3 + Math.floor(r() * 3);
    for (let k = 0, tries = 0; k < count && tries < 30; tries++) {
      const a = r() * 6.2832, d = 50 + r() * 150;
      const nx = x + tcos(a) * d, ny = y + tsin(a) * d;
      if (nx < 80 || nx > W - 80 || ny < 80 || ny > H - 80 || !free(run, nx, ny, 120)) continue;
      if (stand(run, nx, ny, type, tier)) k++;
    }
    if (tier > 1) {
      const far = dist > 1850;
      const n = 2 + (r() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) {
        const a = r() * 6.2832, d = 90 + r() * 90;
        guard(run, r() < 0.3 ? T_SPITTER : T_BOAR, x + tcos(a) * d, y + tsin(a) * d, 2, 250);
      }
      if (far) guard(run, T_BEAR, x + 40, y + 30, 2, 250);
    }
  }
  // Loose nodes between the groves: no walk of a few seconds is empty.
  for (let k = 0, tries = 0; k < 26 && tries < 260; tries++) {
    const x = 100 + r() * (W - 200), y = 100 + r() * (H - 200);
    if (campGap(o, x, y) < 200 || !free(run, x, y, 150)) continue;
    if (stand(run, x, y, KINDS[k % 3], 1)) k++;
  }
  // Game. It keeps to itself until the player comes close.
  for (let k = 0, tries = 0; k < 9 && tries < 100; tries++) {
    const x = 150 + r() * (W - 300), y = 150 + r() * (H - 300);
    if (campGap(o, x, y) < 520) continue;
    guard(run, r() < 0.7 ? T_BOAR : T_BADGER, x, y, 1, 170);
    k++;
  }
}

// ---- per tick ----------------------------------------------------------------

function pack(run: Run, type: number, n: number, x: number, y: number): void {
  for (let k = 0; k < n; k++) {
    const jx = (rnd(run.rng, Stream.Spawn) - 0.5) * (50 + n * 14), jy = (rnd(run.rng, Stream.Spawn) - 0.5) * (50 + n * 14);
    if (spawnEnemy(run, type, x + jx, y + jy) < 0) return;
  }
}

/** Threat, its stages, and the packs they send. Also the camp the player stands in. */
export function outingDirect(run: Run): void {
  const o = run.outing!, p = run.player;
  o.time += DT;
  if (o.quiet > 0) o.quiet--;
  o.inCamp = -1;
  for (let i = 0; i < o.campCount; i++) {
    const dx = o.camps[i * 2] - p.x, dy = o.camps[i * 2 + 1] - p.y;
    if (dx * dx + dy * dy <= OUTING.campR * OUTING.campR) { o.inCamp = i; break; }
  }
  if (o.inCamp >= 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + OUTING.campHeal * DT);

  o.threat += DT / OUTING.threatSeconds;
  const st = OUTING.stages;
  const stage = o.threat >= st[2] ? 3 : o.threat >= st[1] ? 2 : o.threat >= st[0] ? 1 : 0;
  if (stage !== o.stage) {
    o.stage = stage;
    o.nextPack = stage === 1 ? 6 : 3;
    emit(run, 'stage', p.x, p.y, stage);
  }
  // What comes is as strong as the stage: wave 2 at first, then 3, then climbing while the woods are awake.
  const over = o.threat - 1;
  run.wave = stage === 0 ? 1 : stage < 3 ? stage + 1 : Math.min(12, 4 + Math.floor(over * 8));
  if (stage === 0) return;
  o.nextPack -= DT;
  if (o.nextPack > 0) return;
  // A point off the screen, on whichever side has room.
  let a = rnd(run.rng, Stream.Spawn) * 6.2832, x = 0, y = 0;
  for (let k = 0; k < 4; k++, a += 1.5708) {
    x = clampX(run, p.x + tcos(a) * OUTING.packRing); y = clampY(run, p.y + tsin(a) * OUTING.packRing);
    const dx = x - p.x, dy = y - p.y;
    if (dx * dx + dy * dy > 500 * 500) break;
  }
  const roll = rnd(run.rng, Stream.Spawn);
  if (stage === 1) {
    o.nextPack = 24;
    if (roll < 0.5) pack(run, T_MITE, 3, x, y); else pack(run, T_GNAT, 4, x, y);
  } else if (stage === 2) {
    o.nextPack = 14;
    pack(run, T_MITE, 4, x, y);
    pack(run, roll < 0.5 ? T_BOAR : T_SPITTER, 1, x, y);
  } else {
    o.nextPack = Math.max(4, 8 - over * 6);
    const mul = 1 + over * 1.5;
    pack(run, T_MITE, Math.round(5 * mul), x, y);
    pack(run, T_BOAR, Math.round(2 * mul), x, y);
    pack(run, T_SPITTER, Math.round(1 * mul), x, y);
    if (roll < 0.3 + over * 0.4) pack(run, T_BEAR, 1, x, y);
  }
}

function hasTool(run: Run, type: number): boolean {
  const id = OUTING_NODE[type];
  for (const w of run.player.weapons) if (WEAPONS[w.def].tool === id) return true;
  return false;
}

/** Work the node the player stands at. Work is noise, and noise is threat. */
export function outingNodes(run: Run): void {
  const o = run.outing!, p = run.player;
  p.workingNode = -1;
  for (let i = 0; i < run.nodes.length; i++) {
    const n = run.nodes[i];
    if (!n.alive) continue;
    const dx = p.x - n.x, dy = p.y - n.y;
    const inRing = p.workingNode === -1 && dx * dx + dy * dy <= NODE_RING * NODE_RING;
    if (inRing && nodeLocked(run, n.type, n.tier)) {
      n.working = false;
      if (o.quiet <= 0) { o.quiet = 150; emit(run, 'locked', n.x, n.y, n.type, OUTING.tier2Level); }
      continue;
    }
    n.working = inRing;
    if (!n.working) { if (n.work > 0) n.work = Math.max(0, n.work - NODE_DECAY * DT); continue; }
    p.workingNode = i;
    const rate = p.workRate * (hasTool(run, n.type) ? 2 : 1) * DT;
    n.work += rate; n.tickAcc += rate;
    o.threat += rate * OUTING.noise;
    if (n.tickAcc >= WORK_TICK) { n.tickAcc -= WORK_TICK; emit(run, 'work', n.x, n.y, n.type); }
    if (n.work < n.need) continue;
    n.alive = false; n.working = false; p.workingNode = -1;
    const m = matIndex(n.type, n.tier);
    const count = OUTING.yield[n.tier] + Math.floor(Math.max(0, p.stat[ST.harvest]) / 10);
    for (let k = 0; k < count; k++) spawnPickup(run, n.x, n.y, PK_MAT + m, 1, 150);
    emit(run, 'break', n.x, n.y, n.type, n.tier > 1 ? 1 : 0);
    const before = skillLevel(o.xp[n.type]), gain = OUTING.xp[n.tier];
    o.xp[n.type] += gain; o.gained[n.type] += gain; o.broken[n.type]++;
    const after = skillLevel(o.xp[n.type]);
    emit(run, 'skill', n.x, n.y, n.type, gain, after > before ? after : 0);
  }
}

/** Materials on the ground fly to the player while the bag has room for them. */
export function outingPickups(run: Run): void {
  const o = run.outing!, ps = run.pickups, p = run.player;
  const mr2 = p.magnetR * p.magnetR, take = (PLAYER_R + 8) * (PLAYER_R + 8);
  const fly = Math.max(PICKUP_FLY_SPEED, p.moveSpeed * 1.6) * DT;
  for (let i = 0; i < ps.length; i++) {
    const k = ps[i];
    if (!k.alive) continue;
    k.px = k.x; k.py = k.y;
    if (k.vx !== 0 || k.vy !== 0) {
      k.x += k.vx * DT; k.y += k.vy * DT;
      k.vx *= 0.88; k.vy *= 0.88;
      if (k.vx * k.vx + k.vy * k.vy < 9) { k.vx = 0; k.vy = 0; }
      k.x = clampX(run, k.x); k.y = clampY(run, k.y);
    }
    const m = k.kind - PK_MAT;
    if (m < 0 || m >= o.bag.length) { k.alive = false; continue; }
    const dx = p.x - k.x, dy = p.y - k.y, d2 = dx * dx + dy * dy;
    if (!canTake(o, m)) {
      k.pulled = false;
      if (d2 <= mr2 && o.quiet <= 0) { o.quiet = 180; emit(run, 'full', p.x, p.y); }
      continue;
    }
    if (!k.pulled && d2 <= mr2) k.pulled = true;
    let got = d2 <= take;
    if (!got && k.pulled) {
      const d = Math.sqrt(d2);
      if (d <= fly) got = true; else { k.x += (dx / d) * fly; k.y += (dy / d) * fly; }
    }
    if (got) { k.alive = false; o.bag[m] += k.value; emit(run, 'pickup', p.x, p.y, k.kind, k.value); }
  }
}

/** Called by step when the run is over: a fall is the only way that happens without leaveOuting. */
export function outingOver(run: Run): void {
  const o = run.outing!;
  if (o.result !== '') return;
  o.result = 'dead';
  emit(run, 'left', run.player.x, run.player.y, 2);
}

/** Walk out at a camp (only while standing in one) or recall from the field. */
export function leaveOuting(run: Run, how: 'camp' | 'recall'): boolean {
  const o = run.outing;
  if (!o || run.phase !== 'wave') return false;
  if (how === 'camp' && o.inCamp < 0) return false;
  o.result = how;
  run.phase = 'over'; run.won = how === 'camp';
  emit(run, 'left', run.player.x, run.player.y, how === 'camp' ? 0 : 1);
  return true;
}

export interface Haul {
  result: 'camp' | 'recall' | 'dead';
  /** Share of the bag kept. */
  share: number;
  carried: number[];
  kept: number[];
  /** Skill experience at the end, and what this outing added. */
  xp: number[];
  gained: number[];
  broken: number[];
  seconds: number;
  kills: number;
  threat: number;
}

/** What the outing brought home. Only meaningful once it is over. */
export function haul(run: Run): Haul {
  const o = run.outing!;
  const result = o.result === '' ? 'dead' : o.result;
  const share = OUTING.keep[result] ?? 0;
  const carried = Array.from(o.bag);
  return {
    result, share, carried, kept: carried.map((n) => Math.floor(n * share + 1e-9)),
    xp: Array.from(o.xp), gained: Array.from(o.gained), broken: Array.from(o.broken),
    seconds: o.time, kills: run.kills, threat: o.threat,
  };
}
