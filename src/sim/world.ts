// Nodes, pickups, wave start and wave end.
import { CHARACTER } from './data/characters.ts';
import { AI, ENEMY_INDEX } from './data/enemies.ts';
import {
  ARENA_H, ARENA_W, DT, INTEREST_CAP, MAX_ENEMIES, MAX_ESHOTS, MAX_HAZARDS, MAX_LIVE_NODES, MAX_NODES, MAX_PICKUPS,
  MAX_SHOTS, NODE_RING, NODE_WORK, NODE_WORK_RICH, NODE_YIELD, NODE_YIELD_RICH, PICKUP_FLY_SPEED, PLAYER_R,
  RICH_CHANCE, RICH_FROM_WAVE, SHARD_DAMAGE, SHARD_DAMAGE_PER_WAVE, WORK_TICK,
} from './data/tuning.ts';
import { MULE_AFTER, PLAN_PACE, WAVES } from './data/waves.ts';
import { SRC_SHARDS, WEAPONS } from './data/weapons.ts';
import { openBench } from './bench.ts';
import { damageEnemy, emit, gainScrip, killEnemy, RAW_OF_KIND, rebuild, SP, spawnPickup, ST, targetable } from './core.ts';
import { LANE_MOUTHS } from './enemies.ts';
import { rnd, Stream } from './rng.ts';
import { NODE_CARCASS, NODE_TREE, PK_SCRIP, PK_TIMBER, type ResNode, type Run } from './types.ts';
import { fireShot } from './weapons.ts';

export const NODE_IDS = ['tree', 'seam', 'carcass'] as const;
const NODE_STATION = ['sawmill', 'smelter', 'tannery'] as const;
const T_ROT = ENEMY_INDEX.rotwood;

function hasTool(run: Run, nodeType: number): boolean {
  for (const w of run.player.weapons) if (WEAPONS[w.def].tool === NODE_IDS[nodeType]) return true;
  return false;
}

/** Raws a node of this type gives the current build, before the double roll. */
export function nodeYield(run: Run, nodeType: number, rich: boolean): number {
  const p = run.player;
  const station = Math.max(0, (run.stations[NODE_STATION[nodeType]] ?? 1) - 1);
  return (rich ? NODE_YIELD_RICH : NODE_YIELD) + Math.floor(Math.max(0, p.stat[ST.harvest]) / 10) + station;
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
      for (let i = 0; i < MAX_NODES; i++) if (!run.nodes[i].alive) { slot = run.nodes[i]; break; }
      if (!slot) return;
      let x = 0, y = 0, ok = false;
      // The first tree of a run stands close to the start, so the first thing
      // a new player learns is that the clearing can be worked.
      if (run.wave === 1 && type === NODE_TREE && k === 0) { x = ARENA_W / 2 + 230; y = ARENA_H / 2 - 110; ok = true; }
      for (let tries = 0; tries < 16 && !ok; tries++) {
        const lane = Math.floor(rnd(run.rng, Stream.Spawn) * run.laneCount);
        const mx = run.lanes[lane * 2], my = run.lanes[lane * 2 + 1];
        const cx = ARENA_W / 2 - mx, cy = ARENA_H / 2 - my, cl = Math.sqrt(cx * cx + cy * cy) || 1;
        const inward = 170 + rnd(run.rng, Stream.Spawn) * 190, side = (rnd(run.rng, Stream.Spawn) - 0.5) * 520;
        x = mx + (cx / cl) * inward - (cy / cl) * side;
        y = my + (cy / cl) * inward + (cx / cl) * side;
        if (x < 110 || x > ARENA_W - 110 || y < 110 || y > ARENA_H - 110) continue;
        ok = true;
        for (const o of run.nodes) {
          if (!o.alive) continue;
          const dx = o.x - x, dy = o.y - y;
          if (dx * dx + dy * dy < 210 * 210) { ok = false; break; }
        }
      }
      if (!ok) continue;
      slot.alive = true; slot.x = x; slot.y = y; slot.type = type;
      slot.rich = run.wave >= RICH_FROM_WAVE && rnd(run.rng, Stream.Spawn) < RICH_CHANCE;
      slot.work = 0; slot.need = slot.rich ? NODE_WORK_RICH : NODE_WORK; slot.working = false; slot.tickAcc = 0;
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
    fireShot(run, x, y, Math.cos(a), Math.sin(a), 430, dmg, SRC_SHARDS, 300, 1, 0, false, 8, 0, 0, false);
  }
}

function breakNode(run: Run, x: number, y: number, type: number, rich: boolean, base: number): void {
  const p = run.player;
  let n = base;
  if (p.sp[SP.richNodes] > 0 && rnd(run.rng, Stream.Drop) * 100 < p.sp[SP.richNodes]) n *= 2;
  for (let k = 0; k < n; k++) spawnPickup(run, x, y, PK_TIMBER + type, 1, 170);
  if (p.sp[SP.nodeHeal] > 0) p.hp = Math.min(p.maxHp, p.hp + p.sp[SP.nodeHeal]);
  throwShards(run, x, y);
  emit(run, 'break', x, y, type, rich ? 1 : 0);
}

export function updateNodes(run: Run): void {
  const p = run.player;
  p.workingNode = -1;
  for (let i = 0; i < MAX_NODES; i++) {
    const n = run.nodes[i];
    if (!n.alive) continue;
    const dx = p.x - n.x, dy = p.y - n.y;
    n.working = p.workingNode === -1 && dx * dx + dy * dy <= NODE_RING * NODE_RING;
    if (!n.working) continue;
    p.workingNode = i;
    const rate = p.workRate * (hasTool(run, n.type) ? 2 : 1) * DT;
    n.work += rate; n.tickAcc += rate;
    if (n.tickAcc >= WORK_TICK) { n.tickAcc -= WORK_TICK; emit(run, 'work', n.x, n.y, n.type); }
    if (n.work >= n.need) {
      n.alive = false; n.working = false;
      p.workingNode = -1;
      breakNode(run, n.x, n.y, n.type, n.rich, nodeYield(run, n.type, n.rich));
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
      if (k.x < 30) k.x = 30; else if (k.x > ARENA_W - 30) k.x = ARENA_W - 30;
      if (k.y < 30) k.y = 30; else if (k.y > ARENA_H - 30) k.y = ARENA_H - 30;
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
  run.pace = PLAN_PACE[run.totalWaves][run.wave - 1];
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
  p.hp = p.maxHp;
  p.shield = p.sp[SP.waveShield];
  for (let i = 0; i < p.weapons.length; i++) { p.weapons[i].cd = 0.25 + i * 0.07; p.weapons[i].swing = 0; }
  placeNodes(run);
  emit(run, 'waveStart', p.x, p.y, run.wave, run.plan[run.wave - 1]);
}

export function endWave(run: Run): void {
  const p = run.player, ch = CHARACTER[run.character];
  emit(run, 'waveEnd', p.x, p.y, run.wave);
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
  // Scrip left on the ground is banked; raws are swept up.
  for (let i = 0; i < MAX_PICKUPS; i++) {
    const k = run.pickups[i];
    if (!k.alive) continue;
    k.alive = false;
    if (k.kind === PK_SCRIP) p.bank += k.value; else grant(run, k.kind, k.value);
  }
  for (let i = 0; i < MAX_SHOTS; i++) run.shots[i].alive = false;
  for (let i = 0; i < MAX_ESHOTS; i++) run.eshots[i].alive = false;
  for (let i = 0; i < MAX_HAZARDS; i++) run.hazards[i].alive = false;
  run.burstN = 0;
  let interest = 0;
  if (ch.interest) interest += Math.min(ch.interestCap ?? INTEREST_CAP, Math.floor(p.scrip * ch.interest / 100));
  if (p.sp[SP.interest] > 0) interest += Math.min(INTEREST_CAP, Math.floor(p.scrip * p.sp[SP.interest] / 100));
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
