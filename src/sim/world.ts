// Nodes, pickups, wave start and wave end.
import { tcos, tsin } from './trig.ts';
import { CHARACTER } from './data/characters.ts';
import { AI, ENEMY_INDEX } from './data/enemies.ts';
import {
  ARENA_H, ARENA_W, DT, HAZARD_PACE, INTEREST_CAP_PER_WAVE, MAX_ENEMIES, MAX_ESHOTS, MAX_HAZARDS, MAX_LIVE_NODES, MAX_NODES, MAX_PICKUPS,
  MAX_SHOTS, NODE_RING, NODE_WORK, NODE_WORK_RICH, NODE_YIELD, NODE_YIELD_RICH, PICKUP_FLY_SPEED, PLAYER_R,
  NODE_DECAY, NODE_INWARD, NODE_INWARD_RICH, NOISE_EVERY, NOISE_FROM_WAVE, RICH_CHANCE, RICH_FROM_WAVE, SHARD_DAMAGE, SHARD_DAMAGE_PER_WAVE,
  SWEEP_SHARE, WORK_TICK,
} from './data/tuning.ts';
import { MULE_AFTER, PLAN_PACE, WAVES } from './data/waves.ts';
import { SRC_SHARDS, WEAPONS } from './data/weapons.ts';
import { openBench } from './bench.ts';
import { damageEnemy, emit, gainScrip, killEnemy, RAW_OF_KIND, rebuild, SP, spawnEnemy, spawnPickup, ST, targetable } from './core.ts';
import { LANE_MOUTHS } from './enemies.ts';
import { rnd, Stream } from './rng.ts';
import { skillLevel } from './outing.ts';
import { ES, NODE_CARCASS, NODE_CHEST, NODE_TREE, PK_SCRIP, PK_TIMBER, type ResNode, type Run } from './types.ts';
import { fireShot } from './weapons.ts';

export const NODE_IDS = ['tree', 'seam', 'carcass'] as const;
const NODE_STATION = ['sawmill', 'smelter', 'tannery'] as const;
const T_ROT = ENEMY_INDEX.rotwood, T_GNAT = ENEMY_INDEX.gnat, T_BURROWER = ENEMY_INDEX.burrower;

function hasTool(run: Run, nodeType: number): boolean {
  for (const w of run.player.weapons) if (WEAPONS[w.def].tool === NODE_IDS[nodeType]) return true;
  return false;
}

/** Raws a node of this type gives the current build, before the double roll. */
export function nodeYield(run: Run, nodeType: number, rich: boolean): number {
  const p = run.player;
  const station = Math.max(0, (run.stations[NODE_STATION[nodeType]] ?? 1) - 1);
  // Hazard 2: lean nodes hold 1 less.
  return (rich ? NODE_YIELD_RICH : NODE_YIELD) + Math.floor(Math.max(0, p.stat[ST.harvest]) / 10) + station - (run.hazard >= 2 ? 1 : 0);
}

function placeNodes(run: Run): void {
  const def = WAVES[run.plan[run.wave - 1] - 1], ch = CHARACTER[run.character];
  let live = 0;
  const have = [0, 0, 0];
  for (const n of run.nodes) if (n.alive) { live++; have[n.type]++; }
  for (let type = 0; type < 3; type++) {
    let want = def.nodes[type];
    if (type === NODE_CARCASS && ch.carcassMul) want = Math.max(1, want) * ch.carcassMul;
    for (let k = have[type]; k < want && live < MAX_LIVE_NODES; k++) {
      let slot: ResNode | null = null;
      for (let i = 0; i < run.nodes.length; i++) if (!run.nodes[i].alive) { slot = run.nodes[i]; break; }
      if (!slot) return;
      let x = 0, y = 0, ok = false;
      // Decided before the spot is chosen: the richer the node, the nearer the lane mouth it stands.
      const rich = run.wave >= RICH_FROM_WAVE && rnd(run.rng, Stream.Spawn) < RICH_CHANCE;
      const band = rich ? NODE_INWARD_RICH : NODE_INWARD;
      // The first tree of a run stands close to the start, so the first thing
      // a new player learns is that the clearing can be worked.
      if (run.wave === 1 && type === NODE_TREE && k === 0) { x = ARENA_W / 2 + 230; y = ARENA_H / 2 - 110; ok = true; }
      for (let tries = 0; tries < 24 && !ok; tries++) {
        const lane = Math.floor(rnd(run.rng, Stream.Spawn) * run.laneCount);
        const mx = run.lanes[lane * 2], my = run.lanes[lane * 2 + 1];
        const cx = ARENA_W / 2 - mx, cy = ARENA_H / 2 - my, cl = Math.sqrt(cx * cx + cy * cy) || 1;
        const inward = band[0] + rnd(run.rng, Stream.Spawn) * band[1], side = (rnd(run.rng, Stream.Spawn) - 0.5) * (rich ? 300 : 680);
        x = mx + (cx / cl) * inward - (cy / cl) * side;
        y = my + (cy / cl) * inward + (cx / cl) * side;
        if (x < 60 || x > ARENA_W - 60 || y < 60 || y > ARENA_H - 60) continue;
        ok = true;
        for (const o of run.nodes) {
          if (!o.alive) continue;
          const dx = o.x - x, dy = o.y - y;
          if (dx * dx + dy * dy < 180 * 180) { ok = false; break; }
        }
      }
      if (!ok) continue;
      slot.alive = true; slot.x = x; slot.y = y; slot.type = type;
      slot.rich = rich; slot.tier = 1; slot.noise = 0;
      slot.work = 0; slot.need = slot.rich ? NODE_WORK_RICH : NODE_WORK; slot.working = false; slot.tickAcc = 0; slot.regrown = false;
      live++;
    }
  }
}

function throwShards(run: Run, x: number, y: number): void {
  const p = run.player, n = Math.round(p.sp[SP.nodeBurst]);
  if (n <= 0) return;
  const dmg = (SHARD_DAMAGE + SHARD_DAMAGE_PER_WAVE * run.wave) * p.dmgMul;
  const a0 = rnd(run.rng, Stream.Combat) * 6.2832;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * 6.2832;
    fireShot(run, x, y, tcos(a), tsin(a), 430, dmg, SRC_SHARDS, 300, 1, 0, false, 8, 0, 0, false);
  }
}

function breakNode(run: Run, x: number, y: number, type: number, rich: boolean, base: number): void {
  const p = run.player;
  let n = base;
  if (p.sp[SP.richNodes] > 0 && rnd(run.rng, Stream.Drop) * 100 < p.sp[SP.richNodes]) n *= 2;
  for (let k = 0; k < n; k++) spawnPickup(run, x, y, PK_TIMBER + type, 1, 170);
  const heal = p.sp[SP.nodeHeal] + (CHARACTER[run.character].nodeHeal ?? 0);
  if (heal > 0) p.hp = Math.min(p.maxHp, p.hp + heal);
  throwShards(run, x, y);
  emit(run, 'break', x, y, type, rich ? 1 : 0);
}

/** Work is loud. A pack comes out of the nearest lane mouth and heads for the node; later waves send a burrower with it. */
function callPack(run: Run, n: ResNode): void {
  let best = 0, bestD = 1e18;
  for (let i = 0; i < run.laneCount; i++) {
    const dx = run.lanes[i * 2] - n.x, dy = run.lanes[i * 2 + 1] - n.y, d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  const mx = run.lanes[best * 2], my = run.lanes[best * 2 + 1];
  // Gnats: quick enough to reach a worker before the node breaks.
  const count = 3 + Math.floor(run.wave / 2);
  for (let k = 0; k <= count; k++) {
    // The last one is a burrower from wave 5. What work calls up carries no scrip.
    const type = k < count ? T_GNAT : run.wave >= 5 ? T_BURROWER : -1;
    if (type < 0) break;
    const i = spawnEnemy(run, type, mx + (rnd(run.rng, Stream.Spawn) - 0.5) * 90, my + (rnd(run.rng, Stream.Spawn) - 0.5) * 90);
    if (i >= 0) run.enemies[i].called = true;
  }
}

export function updateNodes(run: Run): void {
  const p = run.player;
  p.workingNode = -1;
  for (let i = 0; i < run.nodes.length; i++) {
    const n = run.nodes[i];
    if (!n.alive) continue;
    const dx = p.x - n.x, dy = p.y - n.y;
    n.working = p.workingNode === -1 && dx * dx + dy * dy <= NODE_RING * NODE_RING;
    if (!n.working) { if (n.work > 0) n.work = Math.max(0, n.work - NODE_DECAY * DT); continue; }
    p.workingNode = i;
    // A skill level is 6% faster work on its kind of node.
    const skill = run.lull > 0 && n.type < 3 ? 1 + 0.06 * (skillLevel(run.skillXp[n.type]) - 1) : 1;
    const rate = p.workRate * (n.type < 3 && hasTool(run, n.type) ? 2 : 1) * skill * DT;
    n.work += rate; n.tickAcc += rate; n.noise += rate;
    // Nothing hears work during a lull.
    if (run.lullT > 0) n.noise = 0;
    else if (n.noise >= NOISE_EVERY && run.wave >= NOISE_FROM_WAVE) { n.noise -= NOISE_EVERY; callPack(run, n); }
    if (n.tickAcc >= WORK_TICK) { n.tickAcc -= WORK_TICK; emit(run, 'work', n.x, n.y, n.type); }
    if (n.work >= n.need) {
      // Seed corn: the first break of a node in a wave leaves it standing, unworked.
      if (p.sp[SP.regrow] > 0 && !n.regrown) { n.regrown = true; n.work = 0; n.tickAcc = 0; }
      else n.alive = false;
      n.working = false;
      p.workingNode = -1;
      if (n.type === NODE_CHEST) { n.alive = false; openChest(run, n.x, n.y); continue; }
      breakNode(run, n.x, n.y, n.type, n.rich, nodeYield(run, n.type, n.rich));
      if (run.lull > 0 && n.type < 3) {
        const before = skillLevel(run.skillXp[n.type]), gain = n.rich ? LULL.xpRich : LULL.xp;
        run.skillXp[n.type] += gain; run.skillGained[n.type] += gain;
        const after = skillLevel(run.skillXp[n.type]);
        emit(run, 'skill', n.x, n.y, n.type, gain, after > before ? after : 0);
      }
    }
  }
  // The rotwood is a tree that walks. Work it while it lives.
  if (p.workingNode === -1 && run.eliteIdx >= 0) {
    const e = run.enemies[run.eliteIdx];
    if (e.type === T_ROT && targetable(e)) {
      const dx = p.x - e.x, dy = p.y - e.y;
      if (dx * dx + dy * dy <= AI.rotWorkRing * AI.rotWorkRing) {
        p.workingNode = -2;
        const rate = p.workRate * (hasTool(run, NODE_TREE) ? 2 : 1) * DT;
        const before = e.work;
        e.work += rate;
        if (Math.floor(before / WORK_TICK) !== Math.floor(e.work / WORK_TICK)) emit(run, 'work', e.x, e.y, NODE_TREE);
        if (e.work >= AI.rotWork) {
          e.work = 0;
          breakNode(run, e.x, e.y, NODE_TREE, false, AI.rotTimber + Math.floor(Math.max(0, p.stat[ST.harvest]) / 10));
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          damageEnemy(run, run.eliteIdx, e.maxHp * AI.rotWorkDamage, SRC_SHARDS, false, -dx / d, -dy / d, 0);
        }
      }
    }
  }
}

/** The lull: how many nodes stand, what a chest holds, what a node teaches. */
export const LULL = {
  nodes: 9,
  richChance: 0.35,
  /** Rich nodes and the chest stand at least this far from where the player is when the fight stops. */
  farFrom: 620,
  chestFromWave: 2,
  chestChance: 0.5,
  chestWork: 2.5,
  chestScrip: [8, 5] as readonly [number, number],
  chestRaws: 2,
  xp: 10, xpRich: 28,
  /** How near the player may come before a guard turns on them. */
  aggro: 230,
} as const;

const T_BOAR = ENEMY_INDEX.boar, T_SPITTER = ENEMY_INDEX.spitter, T_BEAR = ENEMY_INDEX.brute;

/** Stand guards round a node. They wait there until the player comes near, and they are as strong as the wave just fought. */
function postGuards(run: Run, x: number, y: number, n: number, bear: boolean): void {
  for (let k = 0; k < n + (bear ? 1 : 0); k++) {
    const a = rnd(run.rng, Stream.Spawn) * 6.2832, d = 70 + rnd(run.rng, Stream.Spawn) * 60;
    const type = k >= n ? T_BEAR : rnd(run.rng, Stream.Spawn) < 0.3 && run.wave >= 4 ? T_SPITTER : T_BOAR;
    const i = spawnEnemy(run, type, x + tcos(a) * d, y + tsin(a) * d, 0);
    if (i < 0) return;
    const e = run.enemies[i];
    e.state = ES.Guard; e.t = 0; e.t2 = LULL.aggro;
  }
}

/** A chest pays scrip, a few raws of each kind, and one upgrade pick at the bench. */
function openChest(run: Run, x: number, y: number): void {
  const scrip = LULL.chestScrip[0] + LULL.chestScrip[1] * run.wave;
  const part = Math.ceil(scrip / 5);
  for (let i = 0; i < 5; i++) spawnPickup(run, x, y, PK_SCRIP, part, 200);
  for (let k = 0; k < 3; k++) for (let i = 0; i < LULL.chestRaws; i++) spawnPickup(run, x, y, PK_TIMBER + k, 1, 170);
  run.bench.picks++;
  emit(run, 'chest', x, y, part * 5);
  emit(run, 'break', x, y, NODE_CHEST, 0);
}

/** The fight stops. What is still in the clearing leaves, and the clearing fills with more than can be worked in the time. */
export function startLull(run: Run): void {
  const p = run.player;
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = run.enemies[i];
    if (!e.alive) continue;
    if (e.loot0 > 0) p.bank += e.loot0;
    if (e.loot1 > 0) grant(run, 1, e.loot1);
    if (e.loot2 > 0) grant(run, 2, e.loot2);
    if (e.loot3 > 0) grant(run, 3, e.loot3);
    killEnemy(run, i, false);
  }
  for (let i = 0; i < MAX_SHOTS; i++) run.shots[i].alive = false;
  for (let i = 0; i < MAX_ESHOTS; i++) run.eshots[i].alive = false;
  for (let i = 0; i < MAX_HAZARDS; i++) run.hazards[i].alive = false;
  run.burstN = 0;
  run.lullT = run.lull;
  const r = (): number => rnd(run.rng, Stream.Spawn);
  let live = 0;
  for (const n of run.nodes) if (n.alive) live++;
  const place = (type: number, rich: boolean, far: boolean): ResNode | null => {
    for (let tries = 0; tries < 30; tries++) {
      const x = 90 + r() * (run.w - 180), y = 90 + r() * (run.h - 180);
      const dx = x - p.x, dy = y - p.y, d2 = dx * dx + dy * dy;
      if (far ? d2 < LULL.farFrom * LULL.farFrom : d2 < 220 * 220) continue;
      let ok = true;
      for (const o of run.nodes) {
        if (!o.alive) continue;
        const ox = o.x - x, oy = o.y - y;
        if (ox * ox + oy * oy < 210 * 210) { ok = false; break; }
      }
      if (!ok) continue;
      for (const n of run.nodes) {
        if (n.alive) continue;
        n.alive = true; n.x = x; n.y = y; n.type = type; n.rich = rich; n.tier = 1;
        n.work = 0; n.need = type === NODE_CHEST ? LULL.chestWork : rich ? NODE_WORK_RICH : NODE_WORK;
        n.working = false; n.tickAcc = 0; n.regrown = false; n.noise = 0;
        return n;
      }
      return null;
    }
    return null;
  };
  let chest = 0;
  // An elite's wave always leaves a chest; other waves, a coin toss.
  const def = WAVES[run.plan[run.wave - 1] - 1];
  if (run.wave >= LULL.chestFromWave && (def.elite || r() < LULL.chestChance)) {
    const c = place(NODE_CHEST, false, true);
    // The chest is the best thing out there and the best guarded.
    if (c) { chest = 1; postGuards(run, c.x, c.y, 3, run.wave >= 6); }
  }
  for (let k = 0; live < LULL.nodes && k < LULL.nodes; k++) {
    const rich = r() < LULL.richChance;
    const n = place(k % 3, rich, rich);
    if (!n) continue;
    live++;
    // Plain nodes are free for the taking. Rich ones are guarded.
    if (rich) postGuards(run, n.x, n.y, 2, run.wave >= 9);
  }
  emit(run, 'lull', p.x, p.y, run.lull, live, chest);
}

export function updatePickups(run: Run): void {
  const ps = run.pickups, p = run.player;
  const mr2 = p.magnetR * p.magnetR, take = (PLAYER_R + 8) * (PLAYER_R + 8);
  const fly = Math.max(PICKUP_FLY_SPEED, p.moveSpeed * 1.6) * DT;
  for (let i = 0; i < MAX_PICKUPS; i++) {
    const k = ps[i];
    if (!k.alive) continue;
    k.px = k.x; k.py = k.y;
    if (k.vx !== 0 || k.vy !== 0) {
      k.x += k.vx * DT; k.y += k.vy * DT;
      k.vx *= 0.88; k.vy *= 0.88;
      if (k.vx * k.vx + k.vy * k.vy < 9) { k.vx = 0; k.vy = 0; }
      if (k.x < 30) k.x = 30; else if (k.x > run.w - 30) k.x = run.w - 30;
      if (k.y < 30) k.y = 30; else if (k.y > run.h - 30) k.y = run.h - 30;
    }
    const dx = p.x - k.x, dy = p.y - k.y, d2 = dx * dx + dy * dy;
    if (!k.pulled && d2 <= mr2) k.pulled = true;
    if (d2 <= take) { collect(run, k.kind, k.value); k.alive = false; continue; }
    if (k.pulled) {
      const d = Math.sqrt(d2);
      if (d <= fly) { collect(run, k.kind, k.value); k.alive = false; continue; }
      k.x += (dx / d) * fly; k.y += (dy / d) * fly;
    }
  }
}

function collect(run: Run, kind: number, value: number): void {
  const p = run.player;
  if (kind === PK_SCRIP) gainScrip(run, value);
  else {
    const raw = RAW_OF_KIND[kind]!;
    p.raws[raw] += value;
    run.gathered[raw] += value;
    run.rawsByWave[run.wave] += value;
  }
  emit(run, 'pickup', p.x, p.y, kind, value);
}

export function startWave(run: Run): void {
  const p = run.player;
  run.wave++;
  const def = WAVES[run.plan[run.wave - 1] - 1];
  run.phase = 'wave';
  run.waveTime = 0;
  run.waveSeconds = def.seconds;
  run.pace = PLAN_PACE[run.totalWaves][run.wave - 1] * HAZARD_PACE[run.hazard];
  run.bossRose = false;
  run.eliteSpawned = false; run.eliteIdx = -1; run.bossDead = false;
  run.burstN = 0;
  for (let i = 0; i < MAX_ENEMIES; i++) run.enemies[i].alive = false;
  run.enemyCount = 0;
  for (let i = 0; i < MAX_SHOTS; i++) run.shots[i].alive = false;
  for (let i = 0; i < MAX_ESHOTS; i++) run.eshots[i].alive = false;
  for (let i = 0; i < MAX_HAZARDS; i++) run.hazards[i].alive = false;
  // Open lanes: a seeded start, then evenly round the treeline so packs come from different sides.
  const first = Math.floor(rnd(run.rng, Stream.Spawn) * 8);
  run.laneCount = def.lanes;
  for (let i = 0; i < def.lanes; i++) {
    const m = LANE_MOUTHS[(first + Math.round((i * 8) / def.lanes)) % 8];
    run.lanes[i * 2] = m[0]; run.lanes[i * 2 + 1] = m[1];
  }
  for (let gi = 0; gi < run.groupNext.length; gi++) {
    run.groupNext[gi] = gi < def.groups.length ? def.groups[gi].from * def.seconds + 0.5 + gi * 0.35 : 1e9;
  }
  p.x = p.px = ARENA_W / 2; p.y = p.py = ARENA_H / 2;
  p.moving = false; p.iframes = 0; p.secondWindUsed = false; p.workingNode = -1;
  rebuild(run);
  // Hazard 3: no rest. A new wave mends only half of what is missing.
  p.hp = run.hazard >= 3 && run.wave > 1 ? Math.min(p.maxHp, p.hp + (p.maxHp - p.hp) / 2) : p.maxHp;
  p.shield = p.sp[SP.waveShield];
  for (let i = 0; i < p.weapons.length; i++) { p.weapons[i].cd = 0.25 + i * 0.07; p.weapons[i].swing = 0; }
  for (let i = 0; i < run.nodes.length; i++) run.nodes[i].regrown = false;
  placeNodes(run);
  emit(run, 'waveStart', p.x, p.y, run.wave, run.plan[run.wave - 1]);
}

export function endWave(run: Run): void {
  const p = run.player, ch = CHARACTER[run.character];
  // A chest not reached in the lull is gone.
  for (const n of run.nodes) if (n.alive && n.type === NODE_CHEST) n.alive = false;
  // Magpies still in the clearing drop what they took.
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = run.enemies[i];
    if (!e.alive) continue;
    if (e.loot0 > 0) p.bank += e.loot0;
    if (e.loot1 > 0) grant(run, 1, e.loot1);
    if (e.loot2 > 0) grant(run, 2, e.loot2);
    if (e.loot3 > 0) grant(run, 3, e.loot3);
    killEnemy(run, i, false);
  }
  // Raws are swept up.
  let left = 0, rawsSwept = 0;
  for (let i = 0; i < MAX_PICKUPS; i++) {
    const k = run.pickups[i];
    if (!k.alive) continue;
    k.alive = false;
    if (k.kind === PK_SCRIP) left += k.value; else { grant(run, k.kind, k.value); rawsSwept += k.value; }
  }
  // Most of the scrip left lying is swept up at once; the rest is banked and pays double on later pickups.
  const swept = Math.round(left * SWEEP_SHARE);
  if (swept > 0) gainScrip(run, swept);
  p.bank += left - swept;
  // a: wave number; b: scrip swept into the purse; c: scrip banked; d: raws swept up.
  emit(run, 'waveEnd', p.x, p.y, run.wave, swept, left - swept, rawsSwept);
  for (let i = 0; i < MAX_SHOTS; i++) run.shots[i].alive = false;
  for (let i = 0; i < MAX_ESHOTS; i++) run.eshots[i].alive = false;
  for (let i = 0; i < MAX_HAZARDS; i++) run.hazards[i].alive = false;
  run.burstN = 0;
  let interest = 0;
  const rate = (ch.interest ?? 0) + p.sp[SP.interest];
  if (rate > 0) interest = Math.min(INTEREST_CAP_PER_WAVE * run.wave, Math.floor(p.scrip * rate / 100));
  p.scrip += interest;
  run.scripEarned += interest;
  run.scripByWave[run.wave] += interest;
  run.wavesCleared = run.wave;
  if (run.wave >= run.totalWaves) {
    run.phase = 'over';
    run.won = true;
    return;
  }
  run.phase = 'bench';
  openBench(run, interest, MULE_AFTER.includes(run.wave));
}

function grant(run: Run, kind: number, value: number): void {
  const raw = RAW_OF_KIND[kind]!;
  run.player.raws[raw] += value;
  run.gathered[raw] += value;
  run.rawsByWave[run.wave] += value;
}
