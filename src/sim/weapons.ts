// Player attacks: auto-targeting, melee shapes, shots.
import { tcos } from './trig.ts';
import {
  STACK_BONUS, BOUNCE_SEEK, BURN_SECONDS, DT, ELITE_FOCUS, SHOT_LEAD, TICK_HZ, MAX_SHOTS, MIN_COOLDOWN, NATIVE_CHAIN, ARENA_H, ARENA_W,
} from './data/tuning.ts';
import { ENEMIES } from './data/enemies.ts';
import { WEAPONS, WEAPON_INDEX, type WeaponDef } from './data/weapons.ts';
import { damageEnemy, emit, Q, queryGrid, SP, ST, targetable } from './core.ts';
import { rnd, Stream } from './rng.ts';
import type { Enemy, Player, Run, Shot, WeaponState } from './types.ts';

const DEG = Math.PI / 180;
const COS_HALF = WEAPONS.map((w) => tcos((w.width / 2) * DEG));

/** Reach in px of a weapon for this player. */
export function weaponRange(p: Player, def: WeaponDef): number {
  const reach = p.stat[ST.reach] * (def.kind === 'shot' || def.fullReach ? 1 : 0.5);
  const r = def.range + reach;
  return r < 36 ? 36 : r;
}

/** Damage of one hit before crits. */
export function weaponDamage(p: Player, def: WeaponDef, tier: number): number {
  let d = def.dmg[tier - 1];
  const sc = def.scale, s = p.stat;
  if (sc.melee) d += sc.melee * s[ST.melee];
  if (sc.ranged) d += sc.ranged * s[ST.ranged];
  if (sc.maxHp) d += sc.maxHp * p.maxHp;
  if (sc.armor) d += sc.armor * Math.max(0, s[ST.armor]);
  if (sc.reach) d += sc.reach * Math.max(0, s[ST.reach]);
  if (sc.harvest) d += sc.harvest * Math.max(0, s[ST.harvest]);
  // Every other copy of the same weapon held adds to all of them.
  const copies = p.copies[WEAPON_INDEX[def.id]];
  if (copies > 1) d *= 1 + STACK_BONUS * (copies - 1);
  d *= p.dmgMul;
  return d < 1 ? 1 : d;
}

export function weaponCooldown(p: Player, def: WeaponDef, tier: number): number {
  const c = def.cd[tier - 1] / (p.rateMul < 0.4 ? 0.4 : p.rateMul);
  return c < MIN_COOLDOWN ? MIN_COOLDOWN : c;
}

function applyStatus(e: Enemy, burn: number, slow: number): void {
  if (burn > 0 && (burn >= e.burnDps || e.burnT <= 0)) { e.burnDps = burn; e.burnT = BURN_SECONDS; }
  if (slow > 0) {
    const f = ENEMIES[e.type].rank > 0 ? slow * 0.5 : slow;
    if (f >= e.slowF || e.slowT <= 0) e.slowF = f;
    e.slowT = 2;
  }
}

export function updateWeapons(run: Run): void {
  const p = run.player, es = run.enemies;
  for (let wi = 0; wi < p.weapons.length; wi++) {
    const w = p.weapons[wi];
    if (w.swing > 0) w.swing -= DT;
    if (w.cd > 0) { w.cd -= DT; if (w.cd > 0) continue; }
    const def = WEAPONS[w.def];
    const range = weaponRange(p, def);
    const n = queryGrid(run, p.x, p.y, range + 48);
    const shot = def.kind === 'shot';
    let best = -1, bestD = 1e12, spare = -1, spareD = 1e12;
    for (let k = 0; k < n; k++) {
      const e = es[Q[k]];
      if (!targetable(e)) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      const reachTo = range + e.r;
      const d2 = dx * dx + dy * dy;
      if (d2 > reachTo * reachTo) continue;
      // Nearest by edge distance, so big targets do not hide behind small ones; elites pull focus.
      let d = Math.sqrt(d2) - e.r;
      if (ENEMIES[e.type].rank > 0) d *= ELITE_FOCUS;
      // A shot is not wasted on an enemy that shots already in the air will kill: six slings
      // take six gnats, not one. If every target in range is spoken for, the nearest is shot anyway.
      if (shot && run.tick <= e.pendTick && e.pend >= e.hp) { if (d < spareD) { spareD = d; spare = Q[k]; } continue; }
      if (d < bestD) { bestD = d; best = Q[k]; }
    }
    if (best < 0) best = spare;
    if (best < 0) continue;
    const t = es[best];
    let ax = t.x - p.x, ay = t.y - p.y;
    if (def.kind === 'shot') {
      // Lead the target by its last-tick movement, so shots meet strafing spitters and fleeing magpies.
      const lead = (Math.sqrt(ax * ax + ay * ay) / def.shotSpeed!) * TICK_HZ * SHOT_LEAD;
      ax += (t.x - t.px) * lead; ay += (t.y - t.py) * lead;
    }
    const al = Math.sqrt(ax * ax + ay * ay) || 1;
    ax /= al; ay /= al;
    w.ax = ax; w.ay = ay; w.flip = !w.flip;
    w.cd = weaponCooldown(p, def, w.tier);
    w.swingDur = w.cd < 0.22 ? w.cd : 0.22; w.swing = w.swingDur;
    const dmg = weaponDamage(p, def, w.tier) * w.mul;
    const crit = p.critChance + def.crit / 100;
    // Burn follows Damage, so fire keeps pace with the rest of a build.
    const burn = ((def.burn ? def.burn[w.tier - 1] : 0) + p.sp[SP.burn]) * p.dmgMul;
    const knock = def.knock + p.knockAdd;
    emit(run, 'attack', p.x, p.y, w.def, wi);
    if (def.kind === 'shot') {
      // Mark the damage as on its way until the shot has had time to arrive.
      const lands = run.tick + Math.ceil((Math.sqrt((t.x - p.x) * (t.x - p.x) + (t.y - p.y) * (t.y - p.y)) / def.shotSpeed!) * TICK_HZ) + 2;
      t.pend = (run.tick <= t.pendTick ? t.pend : 0) + dmg;
      if (lands > t.pendTick) t.pendTick = lands;
      fireShot(run, p.x + ax * 12, p.y + ay * 12, ax, ay, def.shotSpeed!, dmg, w.def, range, def.pierce, def.bounce,
        rnd(run.rng, Stream.Combat) < crit, knock, burn, def.slow ? def.slow[w.tier - 1] : 0, true);
      continue;
    }
    const sweep = def.kind === 'sweep', cosHalf = COS_HALF[w.def], half = def.width / 2;
    for (let k = 0; k < n; k++) {
      const i = Q[k], e = es[i];
      if (!targetable(e)) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (sweep) {
        const rr = range + e.r, d2 = dx * dx + dy * dy;
        if (d2 > rr * rr) continue;
        const d = Math.sqrt(d2) || 1;
        // Widen the arc a little for fat targets up close.
        if ((dx * ax + dy * ay) / d < cosHalf - e.r / (d + e.r) * 0.5) continue;
      } else {
        const along = dx * ax + dy * ay;
        if (along < -e.r || along > range + e.r) continue;
        const perp = Math.abs(dx * ay - dy * ax);
        if (perp > half + e.r) continue;
      }
      const c = rnd(run.rng, Stream.Combat) < crit;
      applyStatus(e, burn, 0);
      damageEnemy(run, i, c ? dmg * 2 : dmg, w.def, c, ax, ay, knock);
    }
  }
}

export function fireShot(
  run: Run, x: number, y: number, ax: number, ay: number, speed: number, dmg: number, src: number, range: number,
  pierce: number, bounce: number, crit: boolean, knock: number, burn: number, slow: number, items: boolean,
): void {
  const ss = run.shots, p = run.player;
  for (let i = 0; i < MAX_SHOTS; i++) {
    const s = ss[i];
    if (s.alive) continue;
    s.alive = true; s.x = s.px = x; s.y = s.py = y;
    s.vx = ax * speed; s.vy = ay * speed;
    s.dmg = crit ? dmg * 2 : dmg; s.crit = crit; s.src = src; s.r = 5;
    s.life = (range / speed) * 1.2 + 0.05;
    // The Shot set's pierces count as the weapon's own and keep the weapon's share of damage.
    s.np = pierce + (items ? p.setPierce : 0); s.nb = bounce;
    s.pierce = s.np + (items ? p.sp[SP.pierce] : 0);
    s.bounce = bounce + (items ? p.sp[SP.bounce] : 0);
    s.knock = knock; s.burn = burn; s.slow = slow; s.hits = 0;
    return;
  }
}

function wasHit(s: Shot, uid: number): boolean {
  for (let k = 0; k < s.hits; k++) if (s.hit[k] === uid) return true;
  return false;
}

export function updateShots(run: Run): void {
  const ss = run.shots, es = run.enemies, p = run.player;
  for (let si = 0; si < MAX_SHOTS; si++) {
    const s = ss[si];
    if (!s.alive) continue;
    s.px = s.x; s.py = s.y;
    s.x += s.vx * DT; s.y += s.vy * DT;
    s.life -= DT;
    if (s.life <= 0 || s.x < 0 || s.x > run.w || s.y < 0 || s.y > run.h) { s.alive = false; continue; }
    const n = queryGrid(run, s.x, s.y, s.r + 44);
    for (let k = 0; k < n; k++) {
      const i = Q[k], e = es[i];
      if (!targetable(e)) continue;
      const dx = e.x - s.x, dy = e.y - s.y, rr = e.r + s.r;
      if (dx * dx + dy * dy > rr * rr) continue;
      if (wasHit(s, e.uid)) continue;
      if (s.hits < s.hit.length) s.hit[s.hits++] = e.uid;
      const v = Math.sqrt(s.vx * s.vx + s.vy * s.vy) || 1;
      applyStatus(e, s.burn, s.slow);
      damageEnemy(run, i, s.dmg, s.src, s.crit, s.vx / v, s.vy / v, s.knock);
      if (s.pierce > 0) {
        s.pierce--;
        if (s.np > 0) { s.np--; s.dmg *= NATIVE_CHAIN; } else s.dmg *= p.piercePct;
        continue;
      }
      if (s.bounce > 0) {
        s.bounce--;
        if (s.nb > 0) { s.nb--; s.dmg *= NATIVE_CHAIN; } else s.dmg *= p.bouncePct;
        // Turn toward the nearest enemy it has not hit yet.
        let best = -1, bestD = BOUNCE_SEEK * BOUNCE_SEEK;
        const m = queryGrid(run, s.x, s.y, BOUNCE_SEEK);
        for (let q = 0; q < m; q++) {
          const o = es[Q[q]];
          if (!targetable(o) || wasHit(s, o.uid)) continue;
          const ox = o.x - s.x, oy = o.y - s.y, d2 = ox * ox + oy * oy;
          if (d2 < bestD) { bestD = d2; best = Q[q]; }
        }
        if (best < 0) { s.alive = false; break; }
        const o = es[best], ox = o.x - s.x, oy = o.y - s.y, od = Math.sqrt(ox * ox + oy * oy) || 1;
        s.vx = (ox / od) * v; s.vy = (oy / od) * v;
        s.life = BOUNCE_SEEK / v + 0.1;
        break;
      }
      s.alive = false;
      break;
    }
  }
}

export function makeWeapon(def: number, tier: number): WeaponState {
  return { def, id: WEAPONS[def].id, tier, mul: 1, cap: 4, cd: 0.3, swing: 0, swingDur: 0.2, ax: 1, ay: 0, flip: false };
}
