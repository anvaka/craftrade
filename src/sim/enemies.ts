// Spawning, enemy behaviour, hazards and enemy shots.
import { AI, ENEMIES, ENEMY_INDEX } from './data/enemies.ts';
import {
  ARENA_H, ARENA_PAD, ARENA_W, BURN_PERIOD_TICKS, DT, GRID_CELL, LANE_NEAR, MAX_ENEMIES, MAX_ESHOTS, MAX_HAZARDS,
  MAX_PICKUPS, PLAYER_R, SPAWN_RING,
} from './data/tuning.ts';
import { TUSK_SUMMONS, WAVES } from './data/waves.ts';
import { SRC_BURN } from './data/weapons.ts';
import { clampX, clampY, damageEnemy, emit, hurtPlayer, killEnemy, spawnEnemy } from './core.ts';
import { rnd, Stream } from './rng.ts';
import { ES, HZ_RING, HZ_SHARD, type Enemy, type Run } from './types.ts';

const T_MITE = ENEMY_INDEX.mite;
/** Tell kinds carried in the `b` field of a 'tell' event. */
export const TELL_CHARGE = 0, TELL_SPIT = 1, TELL_SLAM = 2, TELL_SURFACE = 3, TELL_SUMMON = 4;

const A_WALK = 0, A_SWARM = 1, A_CHARGE = 2, A_SPIT = 3, A_THIEF = 4, A_BURROW = 5, A_SLAM = 6, A_STAG = 7, A_ROT = 8, A_TUSK = 9;
const AI_CODE = ENEMIES.map((d) => ['walk', 'swarm', 'charge', 'spit', 'thief', 'burrow', 'slam', 'stag', 'rotwood', 'tusk'].indexOf(d.ai));

/** The eight lane mouths on the treeline. */
export const LANE_MOUTHS: readonly (readonly [number, number])[] = [
  [ARENA_W * 0.5, 0], [ARENA_W, ARENA_H * 0.28], [ARENA_W, ARENA_H * 0.74], [ARENA_W * 0.72, ARENA_H],
  [ARENA_W * 0.26, ARENA_H], [0, ARENA_H * 0.7], [0, ARENA_H * 0.26], [ARENA_W * 0.2, 0],
];

let SX = 0, SY = 0;
/** Pick a spawn point for a lane into SX, SY. */
function spawnPoint(run: Run, lane: number, spread: number): void {
  const p = run.player;
  const mx = run.lanes[lane * 2], my = run.lanes[lane * 2 + 1];
  const dx = mx - p.x, dy = my - p.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const jx = (rnd(run.rng, Stream.Spawn) - 0.5) * 2 * spread, jy = (rnd(run.rng, Stream.Spawn) - 0.5) * 2 * spread;
  if (d <= LANE_NEAR) { SX = mx + jx; SY = my + jy; }
  else { SX = p.x + (dx / d) * SPAWN_RING + jx; SY = p.y + (dy / d) * SPAWN_RING + jy; }
  SX = clampX(SX); SY = clampY(SY);
}

export function spawnPack(run: Run, type: number, n: number): void {
  const lane = Math.floor(rnd(run.rng, Stream.Spawn) * run.laneCount);
  spawnPoint(run, lane, 40);
  const cx = SX, cy = SY;
  for (let k = 0; k < n; k++) {
    const jx = (rnd(run.rng, Stream.Spawn) - 0.5) * (40 + n * 14), jy = (rnd(run.rng, Stream.Spawn) - 0.5) * (40 + n * 14);
    if (spawnEnemy(run, type, cx + jx, cy + jy) < 0) return;
  }
}

/** Spawn what the wave's groups call for this tick. */
export function direct(run: Run): void {
  const def = WAVES[run.plan[run.wave - 1] - 1];
  const t = run.waveTime, frac = t / run.waveSeconds;
  for (let gi = 0; gi < def.groups.length; gi++) {
    const g = def.groups[gi];
    if (frac < g.from || frac > g.to) continue;
    if (t < run.groupNext[gi]) continue;
    run.groupNext[gi] = t + g.every * run.pace;
    spawnPack(run, ENEMY_INDEX[g.e], g.pack);
  }
  if (def.elite && !run.eliteSpawned && t >= 3) {
    run.eliteSpawned = true;
    const type = ENEMY_INDEX[def.elite];
    spawnPoint(run, Math.floor(rnd(run.rng, Stream.Spawn) * run.laneCount), 0);
    const idx = spawnEnemy(run, type, SX, SY, 1.2);
    if (idx >= 0) {
      run.eliteIdx = idx;
      const e = run.enemies[idx];
      e.n = ENEMIES[type].rank === 2 ? 1 : 0;
      e.t2 = 1; e.t3 = ENEMIES[type].ai === 'rotwood' ? AI.rotSlamEvery : 2;
      emit(run, ENEMIES[type].rank === 2 ? 'bossSpawn' : 'eliteSpawn', e.x, e.y, type);
    }
  }
}

export function addHazard(
  run: Run, kind: number, x: number, y: number, r0: number, r1: number, t: number, dmg: number,
  type: number, owner: number, ownerUid: number,
): void {
  const hs = run.hazards;
  for (let i = 0; i < MAX_HAZARDS; i++) {
    const h = hs[i];
    if (h.alive) continue;
    h.alive = true; h.kind = kind; h.x = x; h.y = y; h.r0 = r0; h.r1 = r1; h.t = t; h.dur = t; h.dmg = dmg;
    h.type = type; h.owner = owner; h.ownerUid = ownerUid;
    return;
  }
}

function fireSpit(run: Run, e: Enemy, idx: number): void {
  const p = run.player, ss = run.eshots;
  for (let i = 0; i < MAX_ESHOTS; i++) {
    const s = ss[i];
    if (s.alive) continue;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    s.alive = true; s.x = s.px = e.x; s.y = s.py = e.y;
    s.vx = (dx / d) * AI.spitSpeed; s.vy = (dy / d) * AI.spitSpeed;
    s.dmg = e.dmg; s.r = AI.spitR; s.life = AI.spitLife; s.type = e.type; s.owner = idx; s.ownerUid = e.uid;
    return;
  }
}

function startCharge(run: Run, e: Enemy, tell: number): void {
  const p = run.player;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
  e.dx = dx / d; e.dy = dy / d;
  e.state = ES.Windup; e.t = tell;
  emit(run, 'tell', e.x, e.y, e.type, TELL_CHARGE);
}

/** Advance a charge. Returns true when it has ended (time up or treeline reached). */
function charging(e: Enemy, speed: number): boolean {
  e.x += e.dx * speed * DT; e.y += e.dy * speed * DT;
  e.t -= DT;
  const hitWall = e.x <= ARENA_PAD || e.x >= ARENA_W - ARENA_PAD || e.y <= ARENA_PAD || e.y >= ARENA_H - ARENA_PAD;
  return e.t <= 0 || hitWall;
}

function slamRing(run: Run, e: Enemy, idx: number, r0: number, r1: number, t: number, mul: number): void {
  addHazard(run, HZ_RING, e.x, e.y, r0, r1, t, e.dmg * mul, e.type, idx, e.uid);
}

export function updateEnemies(run: Run): void {
  const es = run.enemies, p = run.player, g = run.grid;
  const tick = run.tick, wv = run.wave - 1;
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = es[i];
    if (!e.alive) continue;
    e.px = e.x; e.py = e.y;
    if (e.flash > 0) e.flash--;
    if (e.burnT > 0) {
      e.burnT -= DT;
      if ((tick + e.uid) % BURN_PERIOD_TICKS === 0) {
        if (damageEnemy(run, i, e.burnDps * BURN_PERIOD_TICKS * DT, SRC_BURN, false, 0, 0, 0)) continue;
      }
    }
    let slow = 1;
    if (e.slowT > 0) { e.slowT -= DT; slow = 1 - e.slowF; }
    if (e.kx !== 0 || e.ky !== 0) {
      e.x += e.kx * DT; e.y += e.ky * DT;
      e.kx *= 0.86; e.ky *= 0.86;
      if (e.kx * e.kx + e.ky * e.ky < 4) { e.kx = 0; e.ky = 0; }
    }
    const def = ENEMIES[e.type], ai = AI_CODE[e.type];
    const pdx = p.x - e.x, pdy = p.y - e.y;
    const pd = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
    const ux = pdx / pd, uy = pdy / pd;
    const sp = (def.speed + def.speedW * wv) * slow * DT;
    let contact = 1;

    if (e.state === ES.Spawn) {
      e.t -= DT;
      if (e.t <= 0) {
        if (ai === A_BURROW) { e.state = ES.Burrowed; e.t = 3.5; } else e.state = ES.Move;
      }
      continue;
    }

    switch (ai) {
      case A_WALK:
        e.x += ux * sp; e.y += uy * sp; e.dx = ux; e.dy = uy;
        break;
      case A_SWARM: {
        const w = Math.sin(tick * 0.11 + e.seed) * AI.gnatWobble;
        let mx = ux - uy * w, my = uy + ux * w;
        const m = Math.sqrt(mx * mx + my * my) || 1;
        mx /= m; my /= m;
        e.x += mx * sp; e.y += my * sp; e.dx = mx; e.dy = my;
        break;
      }
      case A_CHARGE:
        if (e.state === ES.Move) {
          e.x += ux * sp; e.y += uy * sp; e.dx = ux; e.dy = uy;
          e.t2 -= DT;
          if (pd < AI.boarTrigger && e.t2 <= 0) startCharge(run, e, AI.boarTell);
        } else if (e.state === ES.Windup) {
          e.t -= DT;
          if (e.t <= 0) { e.state = ES.Charge; e.t = AI.boarChargeTime; }
        } else if (e.state === ES.Charge) {
          contact = AI.boarChargeDmg;
          if (charging(e, AI.boarChargeSpeed * slow)) { e.state = ES.Recover; e.t = AI.boarRecover; }
        } else {
          e.t -= DT;
          if (e.t <= 0) { e.state = ES.Move; e.t2 = 1.0; }
        }
        break;
      case A_SPIT:
        if (e.state === ES.Windup) {
          e.t -= DT;
          if (e.t <= 0) { fireSpit(run, e, i); e.state = ES.Move; e.t2 = AI.spitEvery; }
        } else {
          const side = e.seed > 3.14159 ? 1 : -1;
          if (pd > AI.spitFar) { e.x += ux * sp; e.y += uy * sp; }
          else if (pd < AI.spitNear) { e.x -= ux * sp; e.y -= uy * sp; }
          else { e.x += -uy * side * sp * 0.6; e.y += ux * side * sp * 0.6; }
          e.dx = ux; e.dy = uy;
          e.t2 -= DT;
          if (e.t2 <= 0 && pd < AI.spitFar + 90) {
            e.state = ES.Windup; e.t = AI.spitTell;
            emit(run, 'tell', e.x, e.y, e.type, TELL_SPIT);
          }
        }
        break;
      case A_THIEF:
        contact = 0;
        thief(run, e, i, sp);
        if (!e.alive) continue;
        break;
      case A_BURROW:
        if (e.state === ES.Burrowed) {
          contact = 0;
          let tx = p.x, ty = p.y;
          if (p.workingNode >= 0) {
            const nd = run.nodes[p.workingNode];
            const ndx = p.x - nd.x, ndy = p.y - nd.y, nl = Math.sqrt(ndx * ndx + ndy * ndy) || 1;
            tx = nd.x + (ndx / nl) * 34; ty = nd.y + (ndy / nl) * 34;
          }
          const bx = tx - e.x, by = ty - e.y, bd = Math.sqrt(bx * bx + by * by) || 1;
          const step = AI.burrowSpeed * DT;
          e.t -= DT;
          if (bd <= 46 || e.t <= 0) {
            e.state = ES.Surfacing; e.t = AI.burrowTell; e.tx = e.x; e.ty = e.y;
            addHazard(run, HZ_RING, e.x, e.y, 0, AI.burrowBlastR, AI.burrowTell, e.dmg * 1.3, e.type, i, e.uid);
            emit(run, 'tell', e.x, e.y, e.type, TELL_SURFACE);
          } else { e.x += (bx / bd) * step; e.y += (by / bd) * step; }
        } else if (e.state === ES.Surfacing) {
          contact = 0;
          e.t -= DT;
          if (e.t <= 0) { e.state = ES.Move; e.t = AI.burrowUp; }
        } else {
          e.x += ux * sp; e.y += uy * sp; e.dx = ux; e.dy = uy;
          e.t -= DT;
          if (e.t <= 0 && pd > 120) { e.state = ES.Burrowed; e.t = 3.5; }
        }
        break;
      case A_SLAM:
        if (e.state === ES.Slam) {
          e.t -= DT;
          if (e.t <= 0) { e.state = ES.Move; e.t2 = AI.slamRest; }
        } else {
          e.x += ux * sp; e.y += uy * sp; e.dx = ux; e.dy = uy;
          e.t2 -= DT;
          if (pd < AI.slamTrigger && e.t2 <= 0) {
            e.state = ES.Slam; e.t = AI.slamTell;
            slamRing(run, e, i, 0, AI.slamR, AI.slamTell, AI.slamDmg);
            emit(run, 'tell', e.x, e.y, e.type, TELL_SLAM);
          }
        }
        break;
      case A_STAG:
        if (e.state === ES.Move) {
          e.x += ux * sp; e.y += uy * sp; e.dx = ux; e.dy = uy;
          e.t2 -= DT;
          if (pd < AI.stagTrigger && e.t2 <= 0) { e.n = AI.stagCharges; startCharge(run, e, AI.stagTell); }
        } else if (e.state === ES.Windup) {
          e.t -= DT;
          if (e.t <= 0) { e.state = ES.Charge; e.t = AI.stagChargeTime; e.t3 = 0; }
        } else if (e.state === ES.Charge) {
          contact = 1.25;
          e.t3 -= DT;
          if (e.t3 <= 0) {
            e.t3 = AI.stagShardEvery;
            addHazard(run, HZ_SHARD, e.x, e.y, 0, AI.stagShardR, AI.stagShardLife, e.dmg * AI.stagShardDmg, e.type, -1, 0);
          }
          if (charging(e, AI.stagChargeSpeed * slow)) {
            e.n--;
            if (e.n > 0) startCharge(run, e, AI.stagTell * 0.85);
            else { e.state = ES.Recover; e.t = AI.stagRecover; }
          }
        } else {
          e.t -= DT;
          if (e.t <= 0) { e.state = ES.Move; e.t2 = 1.4; }
        }
        break;
      case A_ROT:
        e.t2 -= DT;
        if (e.t2 <= 0) {
          e.t2 = AI.rotShedEvery;
          for (let k = 0; k < AI.rotShed; k++) {
            const a = rnd(run.rng, Stream.Ai) * 6.2832;
            spawnEnemy(run, T_MITE, e.x + Math.cos(a) * (e.r + 14), e.y + Math.sin(a) * (e.r + 14), 0.35);
          }
        }
        if (e.state === ES.Slam) {
          e.t -= DT;
          if (e.t <= 0) { e.state = ES.Move; e.t3 = AI.rotSlamEvery; }
        } else {
          e.x += ux * sp; e.y += uy * sp; e.dx = ux; e.dy = uy;
          e.t3 -= DT;
          if (e.t3 <= 0 && pd < AI.rotSlamR * 0.9) {
            e.state = ES.Slam; e.t = AI.rotSlamTell;
            slamRing(run, e, i, 0, AI.rotSlamR, AI.rotSlamTell, 1.6);
            emit(run, 'tell', e.x, e.y, e.type, TELL_SLAM);
          }
        }
        break;
      case A_TUSK:
        contact = tusk(run, e, i, pd, ux, uy, sp, slow);
        break;
    }

    // Soft separation from neighbours in the same cell, so packs do not stack into one sprite.
    if (e.state === ES.Move) {
      let cx = (e.x / GRID_CELL) | 0, cy = (e.y / GRID_CELL) | 0;
      if (cx < 0) cx = 0; else if (cx >= g.cols) cx = g.cols - 1;
      if (cy < 0) cy = 0; else if (cy >= g.rows) cy = g.rows - 1;
      const c = cy * g.cols + cx;
      let a = g.start[c];
      const b = a + 8 < g.start[c + 1] ? a + 8 : g.start[c + 1];
      for (; a < b; a++) {
        const j = g.items[a];
        if (j === i) continue;
        const o = es[j];
        if (!o.alive || o.state === ES.Burrowed) continue;
        const ox = e.x - o.x, oy = e.y - o.y, rr = e.r + o.r;
        const d2 = ox * ox + oy * oy;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (rr - d) * 0.25 * (o.r >= e.r ? 1 : 0.4);
        e.x += (ox / d) * push; e.y += (oy / d) * push;
      }
    }
    // Clamped by hand: a call that returns a float would box it once per enemy per tick.
    if (e.state !== ES.Flee) {
      if (e.x < ARENA_PAD) e.x = ARENA_PAD; else if (e.x > ARENA_W - ARENA_PAD) e.x = ARENA_W - ARENA_PAD;
      if (e.y < ARENA_PAD) e.y = ARENA_PAD; else if (e.y > ARENA_H - ARENA_PAD) e.y = ARENA_H - ARENA_PAD;
    }

    if (contact > 0 && def.dmg > 0 && p.iframes <= 0) {
      const cdx = p.x - e.x, cdy = p.y - e.y, rr = e.r + PLAYER_R - 3;
      if (cdx * cdx + cdy * cdy < rr * rr) hurtPlayer(run, e.dmg * contact, e.type, i, e.uid);
    }
  }
}

function thief(run: Run, e: Enemy, idx: number, sp: number): void {
  const p = run.player, ps = run.pickups;
  if (e.state === ES.Flee) {
    const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.sqrt(dx * dx + dy * dy);
    const step = sp * AI.thiefFleeSpeed;
    if (d <= step + 4) {
      if (e.n > 0) emit(run, 'escape', e.x, e.y, e.n);
      killEnemy(run, idx, false);
      return;
    }
    e.x += (dx / d) * step; e.y += (dy / d) * step; e.dx = dx / d; e.dy = dy / d;
    return;
  }
  e.t += DT;
  if (e.n >= AI.thiefGrab || e.t > AI.thiefPatience) {
    // Run for the nearest stretch of treeline.
    const l = e.x, r = ARENA_W - e.x, u = e.y, d = ARENA_H - e.y;
    const m = Math.min(l, r, u, d);
    e.tx = m === l ? -30 : m === r ? ARENA_W + 30 : e.x;
    e.ty = m === u ? -30 : m === d ? ARENA_H + 30 : e.y;
    if (m === l || m === r) e.ty = e.y; else e.tx = e.x;
    e.state = ES.Flee;
    return;
  }
  // t3 holds the pickup index it is after, +1 (0 means none).
  let target = e.t3 - 1;
  if (target >= 0 && (!ps[target].alive || ps[target].pulled)) target = -1;
  if (target < 0 && (run.tick + idx) % 6 === 0) {
    let best = 1e12;
    for (let k = 0; k < MAX_PICKUPS; k++) {
      const pk = ps[k];
      if (!pk.alive || pk.pulled || (pk.claimed >= 0 && pk.claimed !== idx)) continue;
      const dx = pk.x - e.x, dy = pk.y - e.y, d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; target = k; }
    }
    if (target >= 0) ps[target].claimed = idx;
  }
  e.t3 = target + 1;
  if (target >= 0) {
    const pk = ps[target];
    const dx = pk.x - e.x, dy = pk.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d < e.r + 6) {
      pk.alive = false;
      if (pk.kind === 0) e.loot0 += pk.value; else if (pk.kind === 1) e.loot1 += pk.value;
      else if (pk.kind === 2) e.loot2 += pk.value; else e.loot3 += pk.value;
      e.n++; e.t3 = 0;
      emit(run, 'steal', e.x, e.y, pk.kind, pk.value);
    } else { e.x += (dx / d) * sp; e.y += (dy / d) * sp; e.dx = dx / d; e.dy = dy / d; }
  } else {
    // Nothing to take yet: circle the player at a distance, where the scrip will fall.
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    const want = 260, radial = d > want ? -1 : 0.6;
    const mx = (dx / d) * radial - (dy / d), my = (dy / d) * radial + (dx / d);
    const m = Math.sqrt(mx * mx + my * my) || 1;
    e.x += (mx / m) * sp * 0.8; e.y += (my / m) * sp * 0.8; e.dx = mx / m; e.dy = my / m;
  }
}

/** Old Tusk. Returns the contact damage multiplier for this tick. */
function tusk(run: Run, e: Enemy, idx: number, pd: number, ux: number, uy: number, sp: number, slow: number): number {
  // Phases come with lost health, or with time if he is being ignored.
  const frac = e.hp / e.maxHp, tw = run.waveTime;
  const byHp = frac > AI.tuskPhase2 ? 1 : frac > AI.tuskPhase3 ? 2 : 3;
  const byTime = tw < AI.tuskPhase2At ? 1 : tw < AI.tuskPhase3At ? 2 : 3;
  const phase = byHp > byTime ? byHp : byTime;
  if (phase !== e.n) {
    e.n = phase; e.t3 = 1.5;
    emit(run, 'bossPhase', e.x, e.y, phase);
  }
  switch (e.state) {
    case ES.Windup:
      e.t -= DT;
      if (e.t <= 0) { e.state = ES.Charge; e.t = AI.tuskChargeTime; }
      return 1;
    case ES.Charge:
      if (charging(e, AI.tuskChargeSpeed * slow)) { e.state = ES.Recover; e.t = AI.tuskRecover; }
      return 1.6;
    case ES.Recover:
      e.t -= DT;
      if (e.t <= 0) { e.state = ES.Move; e.t2 = phase === 1 ? 0.9 : phase === 2 ? 3.6 : 2.4; }
      return 1;
    case ES.Summon:
      e.t -= DT;
      if (e.t <= 0) {
        const s = TUSK_SUMMONS[run.summonN++ % TUSK_SUMMONS.length];
        const type = ENEMY_INDEX[s.e];
        for (let k = 0; k < s.n; k++) {
          const a = rnd(run.rng, Stream.Ai) * 6.2832, d = e.r + 30 + rnd(run.rng, Stream.Ai) * 70;
          spawnEnemy(run, type, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 0.45);
        }
        e.state = ES.Move;
      }
      return 1;
    case ES.Slam:
      e.t -= DT;
      if (e.t <= 0) e.state = ES.Move;
      return 1;
  }
  // Move.
  const walk = phase === 2 ? 0.6 : 1;
  e.x += ux * sp * walk; e.y += uy * sp * walk; e.dx = ux; e.dy = uy;
  e.t2 -= DT; e.t3 -= DT; e.work -= DT;
  if (phase === 3 && e.work <= 0 && e.t3 > 0.5) {
    // The last phase keeps calling packs between rings (`work` is his second summon clock).
    e.work = AI.tuskSummonEvery * 1.6 * run.pace;
    e.state = ES.Summon; e.t = 0.9;
    emit(run, 'tell', e.x, e.y, e.type, TELL_SUMMON);
  } else if (phase === 2 && e.t3 <= 0) {
    e.t3 = AI.tuskSummonEvery * run.pace;
    e.state = ES.Summon; e.t = 0.9;
    emit(run, 'tell', e.x, e.y, e.type, TELL_SUMMON);
  } else if (phase === 3 && e.t3 <= 0 && pd < AI.tuskRingW * AI.tuskRings) {
    e.t3 = AI.tuskRingEvery;
    e.state = ES.Slam; e.t = AI.tuskRingTell + AI.tuskRingStep * (AI.tuskRings - 1);
    for (let k = 0; k < AI.tuskRings; k++) {
      slamRing(run, e, idx, k * AI.tuskRingW, (k + 1) * AI.tuskRingW, AI.tuskRingTell + k * AI.tuskRingStep, 1.5);
    }
    emit(run, 'tell', e.x, e.y, e.type, TELL_SLAM);
  } else if (e.t2 <= 0 && pd < 520) {
    startCharge(run, e, AI.tuskTell);
  }
  return 1;
}

export function updateHazards(run: Run): void {
  const hs = run.hazards, p = run.player;
  for (let i = 0; i < MAX_HAZARDS; i++) {
    const h = hs[i];
    if (!h.alive) continue;
    h.t -= DT;
    const dx = p.x - h.x, dy = p.y - h.y, d2 = dx * dx + dy * dy;
    if (h.kind === HZ_RING) {
      if (h.t > 0) continue;
      h.alive = false;
      emit(run, 'slam', h.x, h.y, h.r1, h.r0);
      // The ring is cancelled if whoever raised it died first.
      if (h.owner >= 0 && !(run.enemies[h.owner].alive && run.enemies[h.owner].uid === h.ownerUid)) continue;
      const inner = h.r0 > 0 ? h.r0 - PLAYER_R * 0.5 : 0, outer = h.r1 + PLAYER_R * 0.5;
      if (d2 <= outer * outer && d2 >= inner * inner) hurtPlayer(run, h.dmg, h.type, h.owner, h.ownerUid);
    } else {
      if (h.t <= 0) { h.alive = false; continue; }
      const rr = h.r1 + PLAYER_R * 0.6;
      if (d2 < rr * rr) hurtPlayer(run, h.dmg, h.type, -1, 0);
    }
    if (run.phase !== 'wave') return;
  }
}

export function updateEShots(run: Run): void {
  const ss = run.eshots, p = run.player;
  for (let i = 0; i < MAX_ESHOTS; i++) {
    const s = ss[i];
    if (!s.alive) continue;
    s.px = s.x; s.py = s.y;
    s.x += s.vx * DT; s.y += s.vy * DT;
    s.life -= DT;
    if (s.life <= 0 || s.x < 0 || s.x > ARENA_W || s.y < 0 || s.y > ARENA_H) { s.alive = false; continue; }
    const dx = p.x - s.x, dy = p.y - s.y, rr = s.r + PLAYER_R - 2;
    if (dx * dx + dy * dy < rr * rr) {
      s.alive = false;
      hurtPlayer(run, s.dmg, s.type, s.owner, s.ownerUid);
      if (run.phase !== 'wave') return;
    }
  }
}
