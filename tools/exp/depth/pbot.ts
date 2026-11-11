// Parameterised copy of src/sim/bot.ts for the depth experiments.
// With an empty Policy it is bit-identical to the shipped bot (checked by verify.ts).
// Every hook is a constraint or a re-weighting; movement and bench logic are otherwise the shipped ones.
import { effectPoints, fusedItemId, itemTier, repairEffects, type ItemSpec } from '../../../src/shared/item.ts';
import { GLYPHS, PRIM, RAWS, STATS, type StatId } from '../../../src/shared/vocab.ts';
import { CHARACTER } from '../../../src/sim/data/characters.ts';
import { AI, ENEMIES } from '../../../src/sim/data/enemies.ts';
import { ARENA_H, ARENA_W, MAX_ENEMIES, MAX_ESHOTS, MAX_HAZARDS, MAX_NODES, MAX_PICKUPS, NODE_RING, PLAYER_R } from '../../../src/sim/data/tuning.ts';
import { UPGRADE_VALUE } from '../../../src/sim/data/upgrades.ts';
import { WEAPONS, WEAPON_INDEX } from '../../../src/sim/data/weapons.ts';
import {
  applyFusion, buy, buyBlock, fuseCost, pickUpgrade, reroll, rerollCost, scrapWeapon, sendMule, toggleLock,
} from '../../../src/sim/bench.ts';
import { clearEvents, createRun, nextWave, step, type StepInput } from '../../../src/sim/run.ts';
import { ES, HZ_RING, PK_SCRIP, type Run, type RunOptions } from '../../../src/sim/types.ts';
import { weaponRange } from '../../../src/sim/weapons.ts';

export interface Policy {
  name?: string;
  /** Movement: the shipped steering, stand still, or run a fixed circle (no threat reading). */
  move?: 'bot' | 'still' | 'circle';
  /** Reaction: re-decide every N ticks (shipped: 3). */
  every?: number;
  /** never: no node goals and step out of work rings. max: nodes before pickups, accept crowds. */
  gather?: 'default' | 'never' | 'max';
  weaponOk?: (id: string) => boolean;
  itemOk?: (item: ItemSpec) => boolean;
  statW?: Partial<Record<StatId, number>>;
  specialW?: Record<string, number>;
  /** Multiplier on weapon offer utility per weapon id. */
  weaponW?: Record<string, number>;
  upgrade?: 'greedy' | 'random';
  buy?: 'greedy' | 'random' | 'none';
  reroll?: boolean;
  lock?: boolean;
  fuse?: 'standin' | 'never' | 'proc' | 'procAlways' | 'procSmart' | 'standinAlways';
  /** Scrip the bot refuses to dip below when buying or rerolling. */
  reserve?: (run: Run) => number;
  /** Share of held raws sent home on the mule (shipped bot: 0.5). */
  mule?: number;
  /** Top every raw up to 60 on entering each bench: takes the raw gate off recipes and fusions. */
  freeRaws?: boolean;
  startWeapon?: string;
  kit?: ItemSpec[];
  /** Added to player.base before wave 1. */
  startStats?: Partial<Record<StatId, number>>;
}

/** Counters the experiments read. Filled by the bench policy. */
export interface BenchLog {
  bench: number; scripIn: number; scripOut: number; rawsIn: number; rawsOut: number;
  /** Offers shown over the whole bench (first roll only for the choice counts below). */
  affordable: number; worth: number; affordableWorth: number; blockedScrip: number; blockedRaws: number; blockedSlot: number;
  /** True when at least two worth-buying offers were affordable one at a time but not together. */
  realChoice: boolean;
  bought: number; rerolls: number; locks: number; fused: number; fuseLegal: number; fuseAffordable: number;
  picks: number; pickSpread: number;
}

export interface BotState {
  pol: Policy;
  log: BenchLog[];
  /** Fusion results queued by the async wrapper: key 'a|b' -> item. */
  fusionOf?: (a: ItemSpec, b: ItemSpec, budget: number) => ItemSpec;
  r2: number;
  /** Tiny RNG so two bots on one seed can differ in taste. */
  s: number;
  /** Taste: multiplier per stat and per weapon, fixed for the run. */
  statTaste: Record<string, number>;
  weaponTaste: Record<string, number>;
  mx: number; my: number;
  gx: number; gy: number; goal: number;
  fuse: boolean;
  /** Reaction: the bot re-decides every this many ticks. */
  every: number;
}

function brnd(b: BotState): number {
  b.s = (b.s + 0x6d2b79f5) >>> 0;
  let t = Math.imul(b.s ^ (b.s >>> 15), b.s | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createBot(seed: number, fuse = true, pol: Policy = {}): BotState {
  const b: BotState = { pol, log: [], r2: (seed ^ 0x1234567) >>> 0, s: seed >>> 0, statTaste: {}, weaponTaste: {}, mx: 0, my: 0, gx: 0, gy: 0, goal: 0, fuse, every: pol.every ?? 3 };
  for (const s of STATS) b.statTaste[s] = 0.6 + brnd(b) * 0.8;
  for (const w of WEAPONS) b.weaponTaste[w.id] = 0.6 + brnd(b) * 0.8;
  return b;
}

/** A second stream for policy-only randomness, so the shipped stream is untouched. */
function brnd2(b: BotState): number {
  b.r2 = (b.r2 + 0x6d2b79f5) >>> 0;
  let t = Math.imul(b.r2 ^ (b.r2 >>> 15), b.r2 | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const DIRS = 16;
const DX = new Float64Array(DIRS + 1), DY = new Float64Array(DIRS + 1);
for (let i = 0; i < DIRS; i++) { DX[i] = Math.cos((i / DIRS) * Math.PI * 2); DY[i] = Math.sin((i / DIRS) * Math.PI * 2); }
const NEAR = new Int16Array(MAX_ENEMIES);
const G_NONE = 0, G_PICKUP = 1, G_NODE = 2, G_ENGAGE = 3, G_FLEE = 4;

function chargeSpeed(type: number): number {
  const ai = ENEMIES[type].ai;
  return ai === 'charge' ? AI.boarChargeSpeed : ai === 'stag' ? AI.stagChargeSpeed : AI.tuskChargeSpeed;
}
function chargeTime(type: number): number {
  const ai = ENEMIES[type].ai;
  return ai === 'charge' ? AI.boarChargeTime : ai === 'stag' ? AI.stagChargeTime : AI.tuskChargeTime;
}

/** Decide this tick's move. Writes into `out`. */
export function botInput(run: Run, b: BotState, out: StepInput): void {
  if (b.pol.move === 'still') { out.mx = 0; out.my = 0; return; }
  if (b.pol.move === 'circle') {
    // A fixed lap of the clearing, 300 px radius, no reading of threats.
    const q = run.player, a = Math.atan2(q.y - ARENA_H / 2, q.x - ARENA_W / 2);
    const d = Math.hypot(q.x - ARENA_W / 2, q.y - ARENA_H / 2);
    const k = d < 300 ? 0.6 : -0.6;
    out.mx = -Math.sin(a) + Math.cos(a) * k; out.my = Math.cos(a) + Math.sin(a) * k;
    return;
  }
  if (run.tick % b.every !== 0) { out.mx = b.mx; out.my = b.my; return; }
  const p = run.player, es = run.enemies;
  const speed = p.moveSpeed;

  // Threats near enough to matter.
  let n = 0, nearest = -1, nearestD = 1e9, close = 0, cx = 0, cy = 0;
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = es[i];
    if (!e.alive) continue;
    const def = ENEMIES[e.type];
    if (def.ai === 'thief') continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
    if (e.state !== ES.Burrowed && e.state !== ES.Spawn && d - e.r < nearestD) { nearestD = d - e.r; nearest = i; }
    if (d > 460) continue;
    if (e.state === ES.Burrowed || e.state === ES.Surfacing) continue;
    if (e.state === ES.Spawn && e.t > 0.3) continue;
    NEAR[n++] = i;
    if (d < 210) { close++; cx += e.x; cy += e.y; }
  }

  // Goal, re-picked a few times a second.
  if (run.tick % (b.every * 4) === 0) pickGoal(run, b, nearest, nearestD, close, cx, cy);

  let best = DIRS, bestScore = -1e18;
  const H1 = 0.18, H2 = 0.42;
  for (let c = 0; c <= DIRS; c++) {
    const vx = DX[c] * speed, vy = DY[c] * speed;
    let ax = p.x + vx * H1, ay = p.y + vy * H1, bx = p.x + vx * H2, by = p.y + vy * H2;
    ax = clamp(ax, 24, ARENA_W - 24); ay = clamp(ay, 24, ARENA_H - 24);
    bx = clamp(bx, 24, ARENA_W - 24); by = clamp(by, 24, ARENA_H - 24);
    let score = 0;
    for (let k = 0; k < n; k++) {
      const e = es[NEAR[k]], def = ENEMIES[e.type];
      const w = 6 + e.dmg * 4;
      if (e.state === ES.Windup && def.ai !== 'spit') {
        // Stay off the charge line.
        const len = chargeSpeed(e.type) * chargeTime(e.type);
        const along = clamp((bx - e.x) * e.dx + (by - e.y) * e.dy, 0, len);
        const qx = e.x + e.dx * along - bx, qy = e.y + e.dy * along - by;
        const off = Math.sqrt(qx * qx + qy * qy) - e.r - PLAYER_R;
        if (off < 34) score -= w * 6 * (1 - off / 34 < 2 ? 1 - off / 34 : 2);
        continue;
      }
      let ex1 = e.x, ey1 = e.y, ex2 = e.x, ey2 = e.y;
      if (e.state === ES.Charge) {
        const cs = chargeSpeed(e.type);
        const t1 = Math.min(H1, e.t), t2 = Math.min(H2, e.t);
        ex1 += e.dx * cs * t1; ey1 += e.dy * cs * t1; ex2 += e.dx * cs * t2; ey2 += e.dy * cs * t2;
      } else if (e.state === ES.Move && def.ai !== 'spit') {
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const es0 = def.speed + def.speedW * (run.wave - 1);
        const s1 = Math.min(es0 * H1, d), s2 = Math.min(es0 * H2, d);
        ex1 += (dx / d) * s1; ey1 += (dy / d) * s1; ex2 += (dx / d) * s2; ey2 += (dy / d) * s2;
      }
      if (def.dmg <= 0) continue;
      const g1 = Math.sqrt((ax - ex1) * (ax - ex1) + (ay - ey1) * (ay - ey1)) - e.r - PLAYER_R;
      const g2 = Math.sqrt((bx - ex2) * (bx - ex2) + (by - ey2) * (by - ey2)) - e.r - PLAYER_R;
      const g = g1 < g2 ? g1 : g2;
      if (g < 6) score -= w * 5;
      else if (g < 70) { const f = (70 - g) / 64; score -= w * f * f * 1.6; }
    }
    for (let i = 0; i < MAX_HAZARDS; i++) {
      const h = run.hazards[i];
      if (!h.alive) continue;
      if (h.kind === HZ_RING) {
        if (h.t > 1.3) continue;
        // Where would this direction put us when it lands?
        const lx = clamp(p.x + vx * h.t, 24, ARENA_W - 24), ly = clamp(p.y + vy * h.t, 24, ARENA_H - 24);
        const d = Math.sqrt((lx - h.x) * (lx - h.x) + (ly - h.y) * (ly - h.y));
        if (d < h.r1 + PLAYER_R + 6 && d > h.r0 - PLAYER_R - 6) score -= 260;
      } else {
        const d1 = Math.sqrt((ax - h.x) * (ax - h.x) + (ay - h.y) * (ay - h.y));
        const d2 = Math.sqrt((bx - h.x) * (bx - h.x) + (by - h.y) * (by - h.y));
        if ((d1 < d2 ? d1 : d2) < h.r1 + PLAYER_R + 8) score -= 70;
      }
    }
    for (let i = 0; i < MAX_ESHOTS; i++) {
      const s = run.eshots[i];
      if (!s.alive) continue;
      // Closest approach over the next 0.6 s.
      const rx = s.x - p.x, ry = s.y - p.y, rvx = s.vx - vx, rvy = s.vy - vy;
      const vv = rvx * rvx + rvy * rvy;
      let t = vv > 0 ? -(rx * rvx + ry * rvy) / vv : 0;
      t = clamp(t, 0, 0.6);
      const qx = rx + rvx * t, qy = ry + rvy * t;
      if (qx * qx + qy * qy < (s.r + PLAYER_R + 10) * (s.r + PLAYER_R + 10)) score -= 90;
    }
    // Corners are where runs end.
    const edge = Math.min(bx, ARENA_W - bx, by, ARENA_H - by);
    if (edge < 90) score -= (90 - edge) * 0.25;
    if (b.goal !== G_NONE) {
      const d0 = Math.sqrt((p.x - b.gx) * (p.x - b.gx) + (p.y - b.gy) * (p.y - b.gy));
      const d1 = Math.sqrt((bx - b.gx) * (bx - b.gx) + (by - b.gy) * (by - b.gy));
      const pull = b.goal === G_FLEE ? 0.5 : b.goal === G_NODE ? 0.36 : 0.3;
      if (b.goal === G_NODE && d0 < NODE_RING - 14) score += c === DIRS ? 3 : (d1 < NODE_RING - 8 ? 1.5 : -6);
      else score += (d0 - d1) * pull;
    }
    if (b.pol.gather === 'never') {
      for (let i = 0; i < MAX_NODES; i++) {
        const nd = run.nodes[i];
        if (nd.alive && (bx - nd.x) * (bx - nd.x) + (by - nd.y) * (by - nd.y) < (NODE_RING + 10) * (NODE_RING + 10)) score -= 12;
      }
    }
    if (c === DIRS) score -= 0.5;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  b.mx = DX[best]; b.my = DY[best];
  out.mx = b.mx; out.my = b.my;
}

function clamp(v: number, a: number, b: number): number { return v < a ? a : v > b ? b : v; }

function pickGoal(run: Run, b: BotState, nearest: number, nearestD: number, close: number, cx: number, cy: number): void {
  const p = run.player, es = run.enemies;
  b.goal = G_NONE;
  const frail = p.hp < p.maxHp * 0.35;
  if (frail && close >= 2) {
    const dx = p.x - cx / close, dy = p.y - cy / close, d = Math.sqrt(dx * dx + dy * dy) || 1;
    // Flee along the open side, bending toward the middle so as not to be pinned.
    b.gx = clamp(p.x + (dx / d) * 260 + (ARENA_W / 2 - p.x) * 0.3, 80, ARENA_W - 80);
    b.gy = clamp(p.y + (dy / d) * 260 + (ARENA_H / 2 - p.y) * 0.3, 80, ARENA_H - 80);
    b.goal = G_FLEE;
    return;
  }
  // Scrip and raws on the ground.
  let bestP = -1, bestPD = 520 * 520;
  for (let i = 0; i < MAX_PICKUPS; i++) {
    const k = run.pickups[i];
    if (!k.alive || k.pulled) continue;
    const dx = k.x - p.x, dy = k.y - p.y;
    const d2 = (dx * dx + dy * dy) / (k.kind === PK_SCRIP ? 1 : 1.6);
    if (d2 < bestPD) { bestPD = d2; bestP = i; }
  }
  // A node worth the walk: quiet around it and around us.
  let bestN = -1, bestND = 1e12;
  const left = run.waveSeconds - run.waveTime;
  const gm = b.pol.gather ?? 'default';
  if (gm !== 'never' && (gm === 'max' ? p.hp > p.maxHp * 0.2 && close <= 8 : !frail && close <= 3)) {
    for (let i = 0; i < MAX_NODES; i++) {
      const nd = run.nodes[i];
      if (!nd.alive) continue;
      const dx = nd.x - p.x, dy = nd.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
      const need = d / p.moveSpeed + (nd.need - nd.work) / p.workRate;
      if (need > left - 1) continue;
      let crowd = 0;
      for (let j = 0; j < MAX_ENEMIES; j++) {
        const e = es[j];
        if (!e.alive || ENEMIES[e.type].ai === 'thief') continue;
        const ex = e.x - nd.x, ey = e.y - nd.y;
        if (ex * ex + ey * ey < 190 * 190) crowd += ENEMIES[e.type].rank > 0 ? 4 : 1;
      }
      if (crowd > (gm === 'max' ? 9 : 3)) continue;
      if (d < bestND) { bestND = d; bestN = i; }
    }
  }
  if (bestN >= 0 && p.workingNode === bestN) { b.goal = G_NODE; b.gx = run.nodes[bestN].x; b.gy = run.nodes[bestN].y; return; }
  if (gm === 'max' && bestN >= 0) { b.goal = G_NODE; b.gx = run.nodes[bestN].x; b.gy = run.nodes[bestN].y; return; }
  const short = p.raws.timber + p.raws.ore + p.raws.hide < 4;
  if (bestP >= 0 && bestPD < (short && bestN >= 0 ? 140 * 140 : 300 * 300)) { b.goal = G_PICKUP; b.gx = run.pickups[bestP].x; b.gy = run.pickups[bestP].y; return; }
  if (bestN >= 0) { b.goal = G_NODE; b.gx = run.nodes[bestN].x; b.gy = run.nodes[bestN].y; return; }
  if (bestP >= 0) { b.goal = G_PICKUP; b.gx = run.pickups[bestP].x; b.gy = run.pickups[bestP].y; return; }
  if (nearest >= 0) {
    // Close to the shortest weapon's range, so everything held is firing.
    let r = 1e9;
    for (const w of p.weapons) { const wr = weaponRange(p, WEAPONS[w.def]); if (wr < r) r = wr; }
    if (nearestD > r * 0.8) { b.goal = G_ENGAGE; b.gx = es[nearest].x; b.gy = es[nearest].y; return; }
  }
  if (Math.abs(p.x - ARENA_W / 2) > 500 || Math.abs(p.y - ARENA_H / 2) > 330) { b.goal = G_ENGAGE; b.gx = ARENA_W / 2; b.gy = ARENA_H / 2; }
}

// ---- bench policy --------------------------------------------------------

const STAT_WEIGHT: Record<StatId, number> = {
  maxHp: 1.0, mend: 0.75, armor: 1.0, dodge: 0.85, speed: 0.8, damage: 1.1, melee: 1.0, ranged: 1.0, rate: 1.1,
  crit: 0.8, reach: 0.5, harvest: 0.6, luck: 0.5,
};
const SPECIAL_WEIGHT: Record<string, number> = {
  thorns: 0.6, nodeBurst: 0.5, nodeHeal: 0.6, richNodes: 0.5, killScrip: 0.9, interest: 0.8, hoardTimber: 0.6,
  hoardOre: 0.6, hoardHide: 0.6, lowHpRate: 0.5, stillDamage: 0.4, movingDodge: 0.9, waveShield: 0.9, killBlast: 1.0,
  hurtBlast: 0.6, pierce: 0.8, bounce: 0.8, burn: 1.0, knockback: 0.5, rerollCut: 0.3, eliteDamage: 0.7, magnet: 0.6,
  xpGain: 0.9, secondWind: 1.0,
};

function shares(run: Run): { melee: number; ranged: number } {
  let m = 0, r = 0;
  for (const w of run.player.weapons) { const d = WEAPONS[w.def]; if (d.scale.melee) m++; if (d.scale.ranged) r++; }
  const n = Math.max(1, run.player.weapons.length);
  return { melee: m / n, ranged: r / n };
}

function primWeight(run: Run, b: BotState, id: string): number {
  const prim = PRIM[id];
  if (prim.kind === 'special') {
    if ((id === 'pierce' || id === 'bounce') && shares(run).ranged === 0) return 0.1;
    return b.pol.specialW?.[id] ?? SPECIAL_WEIGHT[id] ?? 0.5;
  }
  const sh = shares(run);
  let w = (b.pol.statW?.[prim.stat!] ?? STAT_WEIGHT[prim.stat!]) * b.statTaste[prim.stat!];
  if (id === 'melee') w *= sh.melee * 1.6;
  if (id === 'ranged') w *= sh.ranged * 1.6;
  return w;
}

function itemUtility(run: Run, b: BotState, item: ItemSpec): number {
  let u = 0;
  for (const e of item.effects) u += effectPoints(e) * primWeight(run, b, e.p) * (e.neg ? 1.2 : 1);
  return (u * 1.45 + 4) * (1 + run.bench.index * 0.1);
}

function offerUtility(run: Run, b: BotState, i: number): number {
  const o = run.bench.offers[i], p = run.player;
  if (o.sold) return 0;
  if (o.kind === 'item') return b.pol.itemOk && !b.pol.itemOk(o.item!) ? 0 : itemUtility(run, b, o.item!);
  if (b.pol.weaponOk && !b.pol.weaponOk(o.id)) return 0;
  const def = WEAPONS[WEAPON_INDEX[o.id]];
  let twin = false;
  for (const w of p.weapons) if (w.id === o.id && w.tier === o.tier && o.tier < 4) twin = true;
  const free = p.weapons.length < CHARACTER[run.character].slots;
  if (!twin && !free) return 0;
  return def.price[o.tier - 1] * (1 + run.bench.index * 0.1) * b.weaponTaste[o.id] * (b.pol.weaponW?.[o.id] ?? 1) * (twin ? 1.9 : 1.5) + run.bench.index;
}

/** A stand-in for the server's fusion: merge the two effect lists and repair to the budget. Tests and the bot only. */
export function standInFusion(a: ItemSpec, b: ItemSpec, budget: number): ItemSpec {
  const picks = [...a.effects, ...b.effects].filter((e) => !e.neg).sort((x, y) => effectPoints(y) - effectPoints(x));
  const effects = repairEffects(picks.map((e) => ({ p: e.p, l: e.l })), budget, 7);
  const id = fusedItemId(effects);
  return { id, name: `${a.name.split(' ')[0]} ${b.name.split(' ').pop()!.toLowerCase()}`, glyph: GLYPHS[0], tags: [...a.tags.slice(0, 1), ...b.tags.slice(0, 1)], effects };
}

/** Weighted worth of an item to this bot: points x weight, drawbacks counted 1.2x. */
export function itemWorth(run: Run, b: BotState, item: ItemSpec): number {
  let u = 0;
  for (const e of item.effects) u += effectPoints(e) * primWeight(run, b, e.p) * (e.neg ? 1.2 : 1);
  return u;
}

export type Fuser = (a: ItemSpec, b: ItemSpec, budget: number) => Promise<ItemSpec> | ItemSpec;

function newLog(run: Run): BenchLog {
  const p = run.player;
  return {
    bench: run.bench.index, scripIn: p.scrip, scripOut: 0, rawsIn: p.raws.timber + p.raws.ore + p.raws.hide, rawsOut: 0,
    affordable: 0, worth: 0, affordableWorth: 0, blockedScrip: 0, blockedRaws: 0, blockedSlot: 0, realChoice: false,
    bought: 0, rerolls: 0, locks: 0, fused: 0, fuseLegal: 0, fuseAffordable: 0, picks: 0, pickSpread: 0,
  };
}

/** Play one whole bench: upgrades, purchases, mule, maybe a fusion. Does not start the next wave. */
export async function botBench(run: Run, b: BotState, procFuser?: Fuser): Promise<void> {
  const p = run.player, bench = run.bench, pol = b.pol;
  if (pol.freeRaws) for (const r of RAWS) if (p.raws[r] < 60) p.raws[r] = 60;
  const L = newLog(run);
  b.log.push(L);
  while (bench.picks > 0) {
    let best = 0, bestU = -1, second = -1;
    for (let i = 0; i < bench.choices.length; i++) {
      const c = bench.choices[i];
      const u = primWeight(run, b, c.stat) * (c.value / UPGRADE_VALUE[c.stat][0]) * (0.9 + brnd(b) * 0.2);
      if (u > bestU) { second = bestU; bestU = u; best = i; } else if (u > second) second = u;
    }
    if (pol.upgrade === 'random') best = Math.floor(brnd2(b) * bench.choices.length);
    L.picks++; L.pickSpread += bestU > 0 ? Math.max(0, second) / bestU : 0;
    if (!pickUpgrade(run, best)) break;
  }
  const reserve = pol.reserve ? pol.reserve(run) : 0;
  const canBuy = (i: number) => buyBlock(run, i) === null && p.scrip - bench.offers[i].price >= reserve;
  // What the first roll puts in front of the player.
  {
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      const o = bench.offers[i];
      if (o.sold) continue;
      const blk = buyBlock(run, i);
      const good = offerUtility(run, b, i) / Math.max(1, o.price) > 0.75;
      if (blk === null) L.affordable++;
      else if (blk === 'Not enough scrip.') L.blockedScrip++;
      else if (blk === 'No free weapon slot.') L.blockedSlot++;
      else L.blockedRaws++;
      if (good) L.worth++;
      if (good && blk === null) { L.affordableWorth++; sum += o.price; }
    }
    L.realChoice = L.affordableWorth >= 2 && sum > p.scrip;
  }
  const mode = pol.buy ?? 'greedy';
  for (let round = 0; round < 7 && mode !== 'none'; round++) {
    let bought = true;
    while (bought) {
      bought = false;
      let best = -1, bestR = 0.75;
      if (mode === 'random') {
        const ok: number[] = [];
        for (let i = 0; i < 4; i++) {
          const o = bench.offers[i];
          if (o.sold || !canBuy(i)) continue;
          if (o.kind === 'weapon' ? pol.weaponOk && !pol.weaponOk(o.id) : pol.itemOk && !pol.itemOk(o.item!)) continue;
          ok.push(i);
        }
        if (ok.length) best = ok[Math.floor(brnd2(b) * ok.length)];
      } else {
        for (let i = 0; i < 4; i++) {
          const o = bench.offers[i];
          if (o.sold) continue;
          const r = offerUtility(run, b, i) / Math.max(1, o.price);
          if (r <= bestR) continue;
          if (!canBuy(i)) continue;
          best = i; bestR = r;
        }
      }
      if (best >= 0) { bought = buy(run, best); if (bought) L.bought++; }
    }
    // Full hands: trade the weakest weapon for a clearly better offer.
    if (mode === 'greedy' && p.weapons.length >= CHARACTER[run.character].slots) {
      for (let i = 0; i < 4; i++) {
        const o = bench.offers[i];
        if (o.sold || o.kind !== 'weapon' || p.scrip < o.price + reserve) continue;
        if (pol.weaponOk && !pol.weaponOk(o.id)) continue;
        let low = 0;
        for (let k = 1; k < p.weapons.length; k++) if (p.weapons[k].tier < p.weapons[low].tier) low = k;
        if (o.tier >= p.weapons[low].tier + 2 && RAWS.every((r) => p.raws[r] >= o.raws[r])) { scrapWeapon(run, low); if (buy(run, i)) L.bought++; }
      }
    }
    // Hold one good offer that only scrip stands in the way of, then reroll while there is scrip to spend.
    let held = false;
    for (let i = 0; i < 4; i++) if (bench.offers[i].locked) held = true;
    for (let i = 0; i < 4 && !held && mode === 'greedy' && pol.lock !== false; i++) {
      const o = bench.offers[i];
      if (o.sold || o.locked || o.price <= p.scrip || o.price > p.scrip * 2 + 20) continue;
      if (offerUtility(run, b, i) / Math.max(1, o.price) < 1.1 || !RAWS.every((r) => p.raws[r] >= o.raws[r])) continue;
      held = toggleLock(run, i);
      if (held) L.locks++;
    }
    if (pol.reroll === false) break;
    const cost = rerollCost(run);
    if (round >= 5 || p.scrip < cost + 14 + 2 * bench.index + reserve) break;
    if (!reroll(run)) break;
    L.rerolls++;
  }
  // Fusion.
  const fm = pol.fuse ?? (b.fuse ? 'standin' : 'never');
  {
    let legal = 0, aff = 0;
    for (let i = 0; i < p.items.length; i++) for (let j = i + 1; j < p.items.length; j++) {
      if (p.items[i].id === p.items[j].id || itemTier(p.items[i]) === 4 || itemTier(p.items[j]) === 4) continue;
      legal++;
      if (!fuseCost(run, i, j).block) aff++;
    }
    L.fuseLegal = legal; L.fuseAffordable = aff;
  }
  if ((fm === 'standin' || fm === 'proc') && p.items.length >= 2 && brnd(b) < 0.5) {
    // Fuse the two cheapest unfinished items if the raws are there.
    let a = -1, c = -1;
    for (let i = 0; i < p.items.length; i++) {
      if (itemTier(p.items[i]) > 2) continue;
      if (a < 0) a = i; else if (c < 0 && p.items[i].id !== p.items[a].id) c = i;
    }
    if (a >= 0 && c >= 0) {
      const q = fuseCost(run, a, c);
      if (!q.block) {
        const out = fm === 'proc' ? await procFuser!(p.items[a], p.items[c], q.budget) : standInFusion(p.items[a], p.items[c], q.budget);
        if (applyFusion(run, a, c, out) === null) L.fused++;
      }
    }
  } else if (fm === 'procAlways' || fm === 'standinAlways' || fm === 'procSmart') {
    for (let guard = 0; guard < 8; guard++) {
      let ba = -1, bc = -1, bestV = fm === 'procSmart' ? 0 : -1e9, bestOut: ItemSpec | null = null;
      for (let i = 0; i < p.items.length; i++) for (let j = i + 1; j < p.items.length; j++) {
        const q = fuseCost(run, i, j);
        if (q.block) continue;
        const out = fm === 'standinAlways' ? standInFusion(p.items[i], p.items[j], q.budget) : await procFuser!(p.items[i], p.items[j], q.budget);
        // Smart: gain in weighted worth. Always: cheapest pair first.
        const v = fm === 'procSmart'
          ? itemWorth(run, b, out) - itemWorth(run, b, p.items[i]) - itemWorth(run, b, p.items[j])
          : -(effectPoints2(p.items[i]) + effectPoints2(p.items[j]));
        if (v > bestV) { bestV = v; ba = i; bc = j; bestOut = out; }
      }
      if (ba < 0 || !bestOut) break;
      if (applyFusion(run, ba, bc, bestOut) !== null) break;
      L.fused++;
    }
  }
  if (bench.mule) {
    const m = pol.mule ?? 0.5;
    sendMule(run, { timber: Math.floor(p.raws.timber * m), ore: Math.floor(p.raws.ore * m), hide: Math.floor(p.raws.hide * m) });
  }
  L.scripOut = p.scrip; L.rawsOut = p.raws.timber + p.raws.ore + p.raws.hide;
}

function effectPoints2(it: ItemSpec): number { let n = 0; for (const e of it.effects) n += effectPoints(e); return n; }
