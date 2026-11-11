// Shared plumbing: events, pools, the spatial grid, stat maths, damage.
import { tcos, tsin } from './trig.ts';
import { effectValue, type ItemSpec } from '../shared/item.ts';
import { RELIC } from '../shared/content/relics.ts';
import { PRIM, PRIMITIVES, RELIC_PRIMITIVES, STATS, type Primitive, type RawId, type StatId } from '../shared/vocab.ts';
import { CHARACTER } from './data/characters.ts';
import { ENEMIES } from './data/enemies.ts';
import {
  ARENA_H, ARENA_PAD, ARENA_W, BASE_MAGNET, BLAST_RADIUS, DODGE_IFRAMES, GRID_CELL, HURT_BLAST_RADIUS, IFRAMES,
  HAZARD_HP, WAVE_DMG, WAVE_HP, KILL_BLAST_BASE, MAX_LIVE_NODES, NODE_WORK, NODE_WORK_RICH, KILL_BLAST_HP_FRACTION, MAX_ENEMIES, MAX_EVENTS, MAX_PICKUPS, NOISE_FROM_WAVE, PLAYER_SPEED,
  SCRIP_DAMAGE_AT, SLOW_VULN, SPAWN_TELL, SPECIAL_CAP, STAT_CAP, WORK_EXPOSED,
} from './data/tuning.ts';
import { BLUNT_KNOCK, SET_BONUS, SHOT_PIERCE, SRC_BURN, SRC_BURST, SRC_RECOIL, SRC_THORNS, WEAPONS, type WeaponClass } from './data/weapons.ts';
import { rnd, Stream } from './rng.ts';
import {
  ES, NODE_CARCASS, PK_HIDE, PK_ORE, PK_SCRIP, PK_TIMBER,
  type Enemy, type EventType, type Pickup, type ResNode, type Run,
} from './types.ts';

// ---- indices -------------------------------------------------------------

export const ST: Record<StatId, number> = Object.fromEntries(STATS.map((s, i) => [s, i])) as Record<StatId, number>;
const SPECIALS = PRIMITIVES.filter((p) => p.kind === 'special');
/** Index of each special primitive in Player.sp. Relic effects sit after the vocabulary's specials and are 0 or 1. */
export const SP: Record<string, number> = Object.fromEntries([...SPECIALS, ...RELIC_PRIMITIVES].map((p, i) => [p.id, i]));
export const SPECIAL_COUNT = SPECIALS.length + RELIC_PRIMITIVES.length;
const SP_CAPS = [...SPECIALS.map((p) => SPECIAL_CAP[p.id] ?? Infinity), ...RELIC_PRIMITIVES.map(() => 1)];
const STAT_MIN = STATS.map((s) => STAT_CAP[s][0]);
const STAT_MAX = STATS.map((s) => STAT_CAP[s][1]);
export const CLASSES: readonly WeaponClass[] = ['edge', 'blunt', 'shot', 'tool'];
export const RAW_OF_KIND: readonly (RawId | null)[] = [null, 'timber', 'ore', 'hide'];

/** Vocabulary lookup that ignores inherited keys such as '__proto__'. */
export function primOf(id: string): Primitive | undefined {
  return typeof id === 'string' && Object.hasOwn(PRIM, id) ? PRIM[id] : undefined;
}

// ---- events --------------------------------------------------------------

export function emit(run: Run, type: EventType, x: number, y: number, a = 0, b = 0): void {
  const q = run.events;
  if (q.n >= MAX_EVENTS) { q.dropped++; return; }
  const e = q.list[q.n++];
  e.type = type; e.x = x; e.y = y; e.a = a; e.b = b;
}

// ---- grid ----------------------------------------------------------------

/** Scratch list of enemy indices filled by queryGrid. */
export const Q = new Int16Array(MAX_ENEMIES + 8);

export function buildGrid(run: Run): void {
  const g = run.grid, es = run.enemies;
  const cells = g.cols * g.rows;
  g.fill.fill(0);
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = es[i];
    if (!e.alive) continue;
    g.fill[cellOf(g.cols, g.rows, e.x, e.y)]++;
  }
  let acc = 0;
  for (let c = 0; c < cells; c++) { g.start[c] = acc; acc += g.fill[c]; g.fill[c] = g.start[c]; }
  g.start[cells] = acc;
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = es[i];
    if (!e.alive) continue;
    g.items[g.fill[cellOf(g.cols, g.rows, e.x, e.y)]++] = i;
  }
}

function cellOf(cols: number, rows: number, x: number, y: number): number {
  let cx = (x / GRID_CELL) | 0, cy = (y / GRID_CELL) | 0;
  if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
  if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;
  return cy * cols + cx;
}

/** Fill Q with every enemy whose cell touches the square around (x, y). Returns the count. */
export function queryGrid(run: Run, x: number, y: number, r: number): number {
  const g = run.grid;
  let x0 = ((x - r) / GRID_CELL) | 0, x1 = ((x + r) / GRID_CELL) | 0;
  let y0 = ((y - r) / GRID_CELL) | 0, y1 = ((y + r) / GRID_CELL) | 0;
  if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
  if (x1 >= g.cols) x1 = g.cols - 1; if (y1 >= g.rows) y1 = g.rows - 1;
  let n = 0;
  for (let cy = y0; cy <= y1; cy++) {
    const row = cy * g.cols;
    const a = g.start[row + x0], b = g.start[row + x1 + 1];
    for (let k = a; k < b; k++) Q[n++] = g.items[k];
  }
  return n;
}

export function targetable(e: Enemy): boolean {
  return e.alive && e.state !== ES.Spawn && e.state !== ES.Burrowed && e.state !== ES.Surfacing;
}

// ---- stats ---------------------------------------------------------------

/** Recompute everything that only changes when the build changes. Call after any change to items, weapons or upgrades. */
export function rebuild(run: Run): void {
  const p = run.player;
  const flat = p.flat, sp = p.sp;
  for (let i = 0; i < flat.length; i++) flat[i] = p.base[i];
  sp.fill(0);
  let pierceMax = 0, bounceMax = 0;
  for (const item of p.items) {
    if (item.relic === true) {
      // A relic's effects come from the authored table, never from the spec that was handed in.
      const spec = Object.hasOwn(RELIC, item.id) ? RELIC[item.id] : undefined;
      if (spec) for (const e of spec.effects) sp[SP[e.p]] = 1;
      continue;
    }
    for (const e of item.effects) {
      const prim = primOf(e.p);
      if (!prim) continue;
      const v = effectValue(e);
      if (prim.kind === 'stat') { flat[ST[prim.stat!]] += v; continue; }
      const k = SP[prim.id];
      if (prim.id === 'hoardOre') sp[k] += 1 / v;
      else if (prim.id === 'pierce') { sp[k] += 1; if (v > pierceMax) pierceMax = v; }
      else if (prim.id === 'bounce') { sp[k] += 1; if (v > bounceMax) bounceMax = v; }
      else sp[k] += v;
    }
  }
  for (let k = 0; k < SPECIAL_COUNT; k++) if (k !== SP.hoardOre && sp[k] > SP_CAPS[k]) sp[k] = SP_CAPS[k];
  p.piercePct = pierceMax / 100;
  p.bouncePct = bounceMax / 100;
  p.classCount.fill(0);
  p.copies.fill(0);
  const ch = CHARACTER[run.character];
  let shared = 15;
  for (const w of p.weapons) {
    const def = WEAPONS[w.def];
    p.copies[w.def]++;
    let mask = 0;
    // Sawyer: a tool counts twice toward the Tool set.
    for (const c of def.classes) { const k = CLASSES.indexOf(c); mask |= 1 << k; p.classCount[k] += ch.toolDouble && c === 'tool' ? 2 : 1; }
    shared &= mask;
    if (def.passive) flat[ST[def.passive.stat]] += def.passive.v[w.tier - 1];
  }
  p.pure = p.weapons.length >= 2 && shared !== 0;
  p.emptySlots = Math.max(0, weaponSlots(run) - p.weapons.length);
  let setKnock = 0;
  p.setPierce = 0;
  for (let c = 0; c < CLASSES.length; c++) {
    const n = p.classCount[c];
    if (n < 2) continue;
    const step: 0 | 1 | 2 = n >= 6 ? 2 : n >= 4 ? 1 : 0;
    for (const b of SET_BONUS[CLASSES[c]]) flat[ST[b.stat]] += b.v[step];
    if (CLASSES[c] === 'blunt') setKnock = BLUNT_KNOCK[step];
    if (CLASSES[c] === 'shot') p.setPierce = SHOT_PIERCE[step];
  }
  p.knockAdd = sp[SP.knockback] + setKnock;
  refresh(run);
}

/** Apply conditional effects and caps. Cheap; runs every tick. */
export function refresh(run: Run): void {
  const p = run.player, s = p.stat, f = p.flat, sp = p.sp, ch = CHARACTER[run.character];
  for (let i = 0; i < s.length; i++) s[i] = f[i];
  const raws = p.raws;
  if (sp[SP.hoardHide] > 0) s[ST.maxHp] += Math.min(SPECIAL_CAP.hoardHide, sp[SP.hoardHide] * Math.floor(raws.hide / 5));
  if (sp[SP.hoardTimber] > 0) s[ST.damage] += Math.min(SPECIAL_CAP.hoardTimber, sp[SP.hoardTimber] * Math.floor(raws.timber / 5));
  if (sp[SP.hoardOre] > 0) s[ST.armor] += Math.min(SPECIAL_CAP.hoardOre, Math.floor(raws.ore * sp[SP.hoardOre] + 1e-9));
  if (ch.timberDamagePer) s[ST.damage] += Math.min(20, Math.floor(raws.timber / ch.timberDamagePer));
  let mh = s[ST.maxHp];
  if (mh < STAT_MIN[ST.maxHp]) mh = STAT_MIN[ST.maxHp]; else if (mh > STAT_MAX[ST.maxHp]) mh = STAT_MAX[ST.maxHp];
  p.maxHp = mh;
  if (p.hp > mh) p.hp = mh;
  if (sp[SP.lowHpRate] > 0 && p.hp < mh / 2) s[ST.rate] += sp[SP.lowHpRate];
  if (sp[SP.stillDamage] > 0 && !p.moving) s[ST.damage] += sp[SP.stillDamage];
  if (sp[SP.movingDodge] > 0 && p.moving) s[ST.dodge] += sp[SP.movingDodge];
  // Conversions. Each reads a stat as it stands before caps, except Max HP which is already final.
  if (sp[SP.armorDamage] > 0 && s[ST.armor] > 0) s[ST.damage] += sp[SP.armorDamage] * s[ST.armor] / 2;
  if (sp[SP.hpDamage] > 0) s[ST.damage] += sp[SP.hpDamage] * mh / 10;
  if (sp[SP.speedDamage] > 0 && s[ST.speed] > 0) s[ST.damage] += sp[SP.speedDamage] * Math.min(s[ST.speed], STAT_MAX[ST.speed]) / 10;
  if (sp[SP.scripDamage] > 0) s[ST.damage] += sp[SP.scripDamage] * Math.min(p.scrip, SCRIP_DAMAGE_AT) / 50;
  if (sp[SP.harvestDamage] > 0 && s[ST.harvest] > 0) s[ST.damage] += sp[SP.harvestDamage] * Math.min(s[ST.harvest], STAT_MAX[ST.harvest]) / 10;
  if (sp[SP.pureSet] > 0 && p.pure) s[ST.damage] += sp[SP.pureSet];
  if (sp[SP.luckCrit] > 0 && s[ST.luck] > 0) s[ST.crit] += sp[SP.luckCrit] * Math.min(s[ST.luck], STAT_MAX[ST.luck]) / 20;
  if (sp[SP.fewWeapons] > 0) s[ST.rate] += sp[SP.fewWeapons] * p.emptySlots;
  if (sp[SP.workHaste] > 0 && p.workingNode !== -1) s[ST.rate] += sp[SP.workHaste];
  for (let i = 0; i < s.length; i++) {
    if (s[i] < STAT_MIN[i]) s[i] = STAT_MIN[i]; else if (s[i] > STAT_MAX[i]) s[i] = STAT_MAX[i];
  }
  const mend = s[ST.mend];
  p.mendPerSec = mend >= 1 ? 0.25 + 0.14 * (mend - 1) : 0;
  const armor = s[ST.armor];
  p.takenMul = armor >= 0 ? 1 / (1 + armor / 20) : 1 - armor / 15;
  p.dodge = s[ST.dodge] / 100;
  p.moveSpeed = PLAYER_SPEED * (1 + s[ST.speed] / 100);
  p.dmgMul = 1 + s[ST.damage] / 100;
  p.rateMul = 1 + s[ST.rate] / 100;
  p.critChance = s[ST.crit] / 100;
  p.workRate = Math.max(0.25, 1 + s[ST.harvest] / 20);
  p.magnetR = BASE_MAGNET * (1 + sp[SP.magnet] / 100);
}

/** Weapon slots for this run: the character's, plus one with the Saddle scabbard. */
export function weaponSlots(run: Run): number {
  return CHARACTER[run.character].slots + (run.player.sp[SP.extraSlot] > 0 ? 1 : 0);
}

export function xpForLevel(level: number): number { return (level + 3) * (level + 3); }

/** Add scrip from a pickup: gold, banked double pay, experience, level-ups. */
export function gainScrip(run: Run, value: number): void {
  const p = run.player;
  let v = value;
  if (p.bank > 0) { const extra = Math.min(p.bank, value); p.bank -= extra; v += extra; }
  p.scrip += v;
  run.scripEarned += v;
  run.scripByWave[run.wave] += v;
  p.xp += v * (1 + p.sp[SP.xpGain] / 100);
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = xpForLevel(p.level);
    p.base[ST.maxHp] += 1;
    p.flat[ST.maxHp] += 1;
    p.hp += 1;
    run.bench.picks++;
    emit(run, 'levelup', p.x, p.y, p.level);
  }
}

// ---- pools ---------------------------------------------------------------

export function spawnPickup(run: Run, x: number, y: number, kind: number, value: number, scatter: number): void {
  const ps = run.pickups;
  let slot: Pickup | null = null;
  for (let i = 0; i < MAX_PICKUPS; i++) if (!ps[i].alive) { slot = ps[i]; break; }
  if (!slot) {
    // Pool full: fold the value into an existing pickup of the same kind so nothing is lost.
    for (let i = 0; i < MAX_PICKUPS; i++) if (ps[i].kind === kind) { ps[i].value += value; return; }
    return;
  }
  const ang = rnd(run.rng, Stream.Drop) * 6.283185307179586;
  const sp = scatter * (0.4 + 0.6 * rnd(run.rng, Stream.Drop));
  slot.alive = true; slot.kind = kind; slot.value = value; slot.pulled = false; slot.claimed = -1;
  slot.x = slot.px = clampX(x); slot.y = slot.py = clampY(y);
  slot.vx = tcos(ang) * sp; slot.vy = tsin(ang) * sp;
}

/** Stand a fresh node at (x, y) if a slot and the live cap allow. Returns false if not. */
export function spawnNode(run: Run, x: number, y: number, type: number, rich: boolean): boolean {
  let live = 0, slot: ResNode | null = null;
  for (const n of run.nodes) { if (n.alive) live++; else if (!slot) slot = n; }
  if (!slot || live >= MAX_LIVE_NODES) return false;
  slot.alive = true; slot.x = clampX(x); slot.y = clampY(y); slot.type = type; slot.rich = rich;
  slot.work = 0; slot.need = rich ? NODE_WORK_RICH : NODE_WORK; slot.working = false; slot.tickAcc = 0; slot.regrown = false; slot.noise = 0;
  return true;
}

export function clampX(x: number): number { return x < ARENA_PAD ? ARENA_PAD : x > ARENA_W - ARENA_PAD ? ARENA_W - ARENA_PAD : x; }
export function clampY(y: number): number { return y < ARENA_PAD ? ARENA_PAD : y > ARENA_H - ARENA_PAD ? ARENA_H - ARENA_PAD : y; }

/** Take an enemy slot. Returns its index or -1 at the live cap. */
export function spawnEnemy(run: Run, type: number, x: number, y: number, tell = SPAWN_TELL): number {
  if (run.enemyCount >= MAX_ENEMIES) return -1;
  const es = run.enemies;
  let idx = -1;
  for (let i = 0; i < MAX_ENEMIES; i++) if (!es[i].alive) { idx = i; break; }
  if (idx < 0) return -1;
  const e = es[idx], def = ENEMIES[type], w = run.wave - 1;
  e.alive = true; e.uid = run.nextUid++; e.type = type;
  e.x = e.px = clampX(x); e.y = e.py = clampY(y);
  e.kx = e.ky = 0;
  e.hp = e.maxHp = (def.hp + def.hpW * w) * HAZARD_HP[run.hazard] * (def.rank === 0 ? WAVE_HP[w] ?? 1 : 1);
  e.dmg = (def.dmg + def.dmgW * w) * (WAVE_DMG[w] ?? 1);
  e.r = def.r;
  e.state = ES.Spawn; e.t = tell; e.t2 = 0; e.t3 = 0;
  e.dx = 1; e.dy = 0; e.tx = e.x; e.ty = e.y;
  e.burnDps = 0; e.burnT = 0; e.slowT = 0; e.slowF = 0; e.flash = 0; e.n = 0;
  e.loot0 = e.loot1 = e.loot2 = e.loot3 = 0; e.work = 0; e.called = false;
  e.seed = rnd(run.rng, Stream.Ai) * 6.283185307179586;
  run.enemyCount++;
  return idx;
}

// ---- damage --------------------------------------------------------------

/**
 * Damage an enemy. (kdx, kdy) is the unit push direction and knock its size in px.
 * Returns true if it died.
 */
export function damageEnemy(
  run: Run, idx: number, dmg: number, src: number, crit: boolean, kdx: number, kdy: number, knock: number,
): boolean {
  const e = run.enemies[idx];
  if (!e.alive) return false;
  const def = ENEMIES[e.type];
  if (def.rank > 0) dmg *= 1 + run.player.sp[SP.eliteDamage] / 100;
  if (e.slowT > 0) dmg *= 1 + SLOW_VULN;
  const dealt = dmg < e.hp ? dmg : e.hp;
  e.hp -= dmg;
  run.dmgBy[src] += dealt;
  e.flash = 2;
  if (knock > 0) { const k = knock * 9 / def.mass; e.kx += kdx * k; e.ky += kdy * k; }
  if (src !== SRC_BURN) emit(run, crit ? 'crit' : 'hit', e.x, e.y, dmg, idx);
  if (e.hp <= 0) {
    // Hazard 5: Old Tusk gets up once, at half health.
    if (def.rank === 2 && run.hazard >= 5 && !run.bossRose) {
      run.bossRose = true;
      e.hp = e.maxHp * 0.5;
      emit(run, 'bossPhase', e.x, e.y, 3);
      return false;
    }
    killEnemy(run, idx, true);
    return true;
  }
  return false;
}

/** Remove an enemy. With `slain` it drops loot and counts as a kill. */
export function killEnemy(run: Run, idx: number, slain: boolean): void {
  const e = run.enemies[idx];
  if (!e.alive) return;
  e.alive = false;
  run.enemyCount--;
  if (run.eliteIdx === idx) run.eliteIdx = -1;
  if (!slain) return;
  const def = ENEMIES[e.type], p = run.player;
  run.kills++;
  emit(run, 'kill', e.x, e.y, e.type, def.rank);
  if (def.scrip > 0 && !e.called) {
    let v = def.scrip;
    // Luck finds a second coin: a third of a percent per point, on top of any bounty.
    const twice = p.sp[SP.killScrip] + Math.max(0, p.stat[ST.luck]) / 3;
    if (twice > 0 && rnd(run.rng, Stream.Drop) * 100 < twice) v *= 2;
    if (def.rank > 0) { const part = Math.ceil(v / 5); for (let i = 0; i < 5; i++) spawnPickup(run, e.x, e.y, PK_SCRIP, part, 220); }
    else spawnPickup(run, e.x, e.y, PK_SCRIP, v, 60);
  }
  // A magpie gives back what it took.
  if (e.loot0 > 0) spawnPickup(run, e.x, e.y, PK_SCRIP, e.loot0, 120);
  if (e.loot1 > 0) spawnPickup(run, e.x, e.y, PK_TIMBER, e.loot1, 120);
  if (e.loot2 > 0) spawnPickup(run, e.x, e.y, PK_ORE, e.loot2, 120);
  if (e.loot3 > 0) spawnPickup(run, e.x, e.y, PK_HIDE, e.loot3, 120);
  if (def.id === 'stag') for (let i = 0; i < 4; i++) spawnPickup(run, e.x, e.y, PK_HIDE, 1, 200);
  if (def.id === 'rotwood') for (let i = 0; i < 6; i++) spawnPickup(run, e.x, e.y, PK_TIMBER, 1, 220);
  if (p.sp[SP.killHeal] > 0 && p.hp < p.maxHp && rnd(run.rng, Stream.Combat) * 100 < p.sp[SP.killHeal]) p.hp = Math.min(p.maxHp, p.hp + 1);
  if (CHARACTER[run.character].eliteCarcass && (def.rank === 1 || def.id === 'brute')) spawnNode(run, e.x, e.y, NODE_CARCASS, false);
  if (def.rank === 1) emit(run, 'eliteDeath', e.x, e.y, e.type);
  if (def.rank === 2) { emit(run, 'bossDeath', e.x, e.y, e.type); run.bossDead = true; }
  if (p.sp[SP.killBlast] > 0 && def.rank === 0 && rnd(run.rng, Stream.Combat) * 100 < p.sp[SP.killBlast]) {
    queueBurst(run, e.x, e.y, KILL_BLAST_BASE + e.maxHp * KILL_BLAST_HP_FRACTION);
  }
}

export function queueBurst(run: Run, x: number, y: number, dmg: number): void {
  if (run.burstN * 3 >= run.burstQ.length) return;
  const k = run.burstN++ * 3;
  run.burstQ[k] = x; run.burstQ[k + 1] = y; run.burstQ[k + 2] = dmg;
}

/** Damage every enemy within r of (x, y), pushing them outward. */
export function blast(run: Run, x: number, y: number, r: number, dmg: number, src: number, knock: number): void {
  const n = queryGrid(run, x, y, r + 48);
  const es = run.enemies;
  for (let k = 0; k < n; k++) {
    const i = Q[k], e = es[i];
    if (!targetable(e)) continue;
    const ddx = e.x - x, ddy = e.y - y, rr = r + e.r;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 > rr * rr) continue;
    const d = Math.sqrt(d2) || 1;
    damageEnemy(run, i, dmg, src, false, ddx / d, ddy / d, knock);
  }
}

/** Resolve bursts queued by kills. A few per tick, so chains ripple outward. */
export function runBursts(run: Run): void {
  const n = run.burstN < 4 ? run.burstN : 4;
  if (n === 0) return;
  const q = run.burstQ;
  // Copy out first: blasts may queue more.
  for (let b = 0; b < n; b++) {
    const x = q[b * 3], y = q[b * 3 + 1], d = q[b * 3 + 2];
    emit(run, 'burst', x, y, BLAST_RADIUS);
    BURST_TMP[b * 3] = x; BURST_TMP[b * 3 + 1] = y; BURST_TMP[b * 3 + 2] = d;
  }
  q.copyWithin(0, n * 3, run.burstN * 3);
  run.burstN -= n;
  for (let b = 0; b < n; b++) blast(run, BURST_TMP[b * 3], BURST_TMP[b * 3 + 1], BLAST_RADIUS, BURST_TMP[b * 3 + 2], SRC_BURST, 6);
}
const BURST_TMP = new Float64Array(12);

/**
 * Hurt the player. `type` is the enemy type index for the recap; owner and
 * ownerUid name the attacker for thorns (-1 if none). Returns true if damage landed.
 */
export function hurtPlayer(run: Run, dmg: number, type: number, owner: number, ownerUid: number): boolean {
  const p = run.player;
  if (p.iframes > 0 || run.phase !== 'wave') return false;
  // Hide blind: nothing lands while a node is being worked. The walking rotwood (-2) is not a node.
  if (p.workingNode >= 0 && p.sp[SP.safeWork] > 0) return false;
  if (p.dodge > 0 && rnd(run.rng, Stream.Combat) < p.dodge) {
    p.iframes = DODGE_IFRAMES;
    emit(run, 'dodge', p.x, p.y);
    if (p.sp[SP.dodgeStrike] > 0) {
      emit(run, 'burst', p.x, p.y, HURT_BLAST_RADIUS);
      blast(run, p.x, p.y, HURT_BLAST_RADIUS, p.sp[SP.dodgeStrike] * p.dmgMul, SRC_RECOIL, 14);
    }
    return false;
  }
  // No rounding: with 16 HP a rounded hit turns a small change in enemy damage into a cliff.
  let d = dmg * p.takenMul;
  // Head down at a node: hits land harder.
  if (p.workingNode !== -1 && run.wave >= NOISE_FROM_WAVE) d *= WORK_EXPOSED;
  if (d < 0.25) d = 0.25;
  p.iframes = IFRAMES;
  if (p.shield > 0) {
    const a = Math.min(p.shield, d);
    p.shield -= a; d -= a;
    if (p.shield <= 0) emit(run, 'shieldBreak', p.x, p.y);
  }
  if (d > 0) {
    p.hp -= d;
    run.damageTaken += d;
    emit(run, 'hurt', p.x, p.y, d, type);
  }
  const sp = p.sp;
  // Thorns and the recoil blast both grow with Armor: one twelfth more per point.
  const plate = 1 + Math.max(0, p.stat[ST.armor]) / 12;
  if (sp[SP.thorns] > 0 && owner >= 0) {
    const e = run.enemies[owner];
    if (e.alive && e.uid === ownerUid) {
      const ddx = e.x - p.x, ddy = e.y - p.y, dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      damageEnemy(run, owner, sp[SP.thorns] * plate, SRC_THORNS, false, ddx / dd, ddy / dd, 6);
    }
  }
  if (sp[SP.hurtBlast] > 0 && d > 0) {
    emit(run, 'burst', p.x, p.y, HURT_BLAST_RADIUS);
    blast(run, p.x, p.y, HURT_BLAST_RADIUS, sp[SP.hurtBlast] * plate, SRC_RECOIL, 18);
  }
  if (p.hp <= 0) {
    if (sp[SP.secondWind] > 0 && !p.secondWindUsed) {
      p.secondWindUsed = true;
      p.hp = Math.min(p.maxHp, sp[SP.secondWind]);
      p.iframes = 1.2;
      emit(run, 'secondWind', p.x, p.y, p.hp);
    } else if (sp[SP.secondLife] > 0 && !p.secondLifeUsed) {
      // Brandy flask: once a run, back on the feet at half health.
      p.secondLifeUsed = true;
      p.hp = Math.max(1, Math.ceil(p.maxHp / 2));
      p.iframes = 0.8;
      emit(run, 'secondWind', p.x, p.y, p.hp);
    } else {
      p.hp = 0;
      run.phase = 'over';
      run.won = false;
      run.killedBy = ENEMIES[type]?.id ?? 'unknown';
      run.deathWave = run.wave;
      emit(run, 'death', p.x, p.y, type);
    }
  }
  return d > 0;
}

export function hasItem(run: Run, id: string): boolean {
  for (const it of run.player.items) if (it.id === id) return true;
  return false;
}
export type { ItemSpec };
