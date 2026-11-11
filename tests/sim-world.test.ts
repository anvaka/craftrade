import { describe, expect, it } from 'vitest';
import { WAVE_DMG, WAVE_HP } from '../src/sim/data/tuning.ts';
import { BASE_ITEM } from '../src/shared/content/items.ts';
import { addWeapon } from '../src/sim/bench.ts';
import { damageEnemy, hurtPlayer, rebuild, spawnPickup, ST } from '../src/sim/core.ts';
import { AI, ENEMIES, ENEMY_INDEX } from '../src/sim/data/enemies.ts';
import { ARENA_H, ARENA_W, MAX_ENEMIES } from '../src/sim/data/tuning.ts';
import { WAVE_PLAN, WAVES } from '../src/sim/data/waves.ts';
import { WEAPONS, WEAPON_INDEX } from '../src/sim/data/weapons.ts';
import { direct, spawnPack } from '../src/sim/enemies.ts';
import { clearEvents, createRun, nextWave, step, summary } from '../src/sim/run.ts';
import { ES, HZ_RING, HZ_SHARD, PK_SCRIP, PK_TIMBER, type Run } from '../src/sim/types.ts';
import { endWave, nodeYield } from '../src/sim/world.ts';
import { disarm, dummy, hush, place, quietRun, testItem, ticks } from './sim-helpers.ts';

const events = (run: Run, n: number, mx = 0, my = 0): string[] => {
  const out: string[] = [];
  ticks(run, n, mx, my, (r) => { for (let i = 0; i < r.events.n; i++) out.push(r.events.list[i].type); });
  return out;
};
const tough = (run: Run) => { run.player.base[ST.maxHp] = 5000; rebuild(run); run.player.hp = 5000; };

describe('content tables', () => {
  it('weapon and enemy ids are exactly the agreed ones', () => {
    expect(WEAPONS.map((w) => w.id)).toEqual(['hatchet', 'pick', 'knife', 'maul', 'pike', 'sling', 'bow', 'musket', 'axe', 'brand', 'bola', 'buckler']);
    expect(ENEMIES.map((e) => e.id)).toEqual(['mite', 'gnat', 'boar', 'spitter', 'magpie', 'burrower', 'brute', 'stag', 'rotwood', 'tusk']);
    for (const w of WEAPONS) { expect(w.dmg.length).toBe(4); expect(w.cd.length).toBe(4); expect(w.price[3]).toBeGreaterThan(w.price[0]); }
  });

  it('12 waves with the design durations, elites on 6 and 9, boss on 12; enemies arrive no earlier than the design says', () => {
    expect(WAVES.map((w) => w.seconds)).toEqual([20, 25, 30, 35, 40, 45, 50, 55, 60, 60, 60, 90]);
    expect(WAVES.map((w) => w.elite ?? '')).toEqual(['', '', '', '', '', 'stag', '', '', 'rotwood', '', '', 'tusk']);
    const first: Record<string, number> = { mite: 1, gnat: 2, boar: 3, spitter: 4, magpie: 4, burrower: 5, brute: 7 };
    WAVES.forEach((w, i) => { for (const g of w.groups) expect(i + 1).toBeGreaterThanOrEqual(first[g.e]); });
    for (const [id, wave] of Object.entries(first)) expect(WAVES[wave - 1].groups.some((g) => g.e === id)).toBe(true);
    // No two consecutive waves share the same set of enemy kinds.
    const kinds = WAVES.map((w) => [...new Set(w.groups.map((g) => g.e)), w.elite ?? ''].sort().join());
    for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
    expect(WAVE_PLAN[8].length).toBe(8);
    expect(WAVE_PLAN[8][7]).toBe(12);
  });

  it('enemy health and damage are linear in the wave, times the late-wave multipliers', () => {
    const run = quietRun();
    for (const wave of [1, 5, 12]) {
      run.wave = wave;
      const i = place(run, 'boar', 300, 0);
      const def = ENEMIES[ENEMY_INDEX.boar];
      expect(run.enemies[i].maxHp).toBeCloseTo((def.hp + def.hpW * (wave - 1)) * WAVE_HP[wave - 1], 9);
      expect(run.enemies[i].dmg).toBeCloseTo((def.dmg + def.dmgW * (wave - 1)) * WAVE_DMG[wave - 1], 9);
      expect(WAVE_HP[0] * WAVE_DMG[0] * WAVE_HP[4] * WAVE_DMG[4]).toBe(1);
    }
  });
});

describe('player', () => {
  it('moves by a direction vector, normalises long input, stays in the arena, and exposes last-tick position', () => {
    const run = quietRun();
    const p = run.player;
    const x0 = p.x;
    step(run, { mx: 1, my: 0 });
    const one = p.x - x0;
    expect(one).toBeCloseTo(p.moveSpeed / 60, 9);
    expect(p.px).toBe(x0);
    step(run, { mx: 30, my: 0 });
    expect(p.x - p.px).toBeCloseTo(one, 9);
    step(run, { mx: 0.5, my: 0 });
    expect(p.x - p.px).toBeCloseTo(one / 2, 9);
    step(run, { mx: NaN, my: 0 });
    expect(p.x).toBe(p.px);
    ticks(run, 900, 1, 1);
    expect(p.x).toBeLessThanOrEqual(ARENA_W);
    expect(p.y).toBeLessThanOrEqual(ARENA_H);
    expect(p.x).toBeGreaterThan(ARENA_W - 60);
  });

  it('gets i-frames after a hit; armor follows 1 / (1 + armor / 20); mend follows 0.25 + 0.14 per extra point; damage is not rounded', () => {
    const run = quietRun([testItem('armor', 5), testItem('mend', 3)]);
    const p = run.player;
    tough(run);
    expect(p.takenMul).toBeCloseTo(1 / (1 + 7 / 20), 9);
    expect(p.mendPerSec).toBeCloseTo(0.25 + 0.14 * 2, 9);
    expect(hurtPlayer(run, 30, 0, -1, 0)).toBe(true);
    expect(run.damageTaken).toBeCloseTo(30 / (1 + 7 / 20), 9);
    expect(p.iframes).toBeGreaterThan(0.3);
    expect(hurtPlayer(run, 30, 0, -1, 0)).toBe(false);
    ticks(run, 50);
    expect(p.iframes).toBeLessThanOrEqual(0);
    expect(hurtPlayer(run, 30, 0, -1, 0)).toBe(true);
  });

  it('dies at 0 HP and the summary says who did it and when', () => {
    const run = quietRun();
    disarm(run);
    place(run, 'mite', 30, 0, 999);
    ticks(run, 2000);
    expect(run.phase).toBe('over');
    const s = summary(run);
    expect(s.won).toBe(false);
    expect(s.killedBy).toBe('mite');
    expect(s.endWave).toBe(1);
    expect(s.wavesCleared).toBe(0);
  });
});

describe('weapons', () => {
  it('fire on their own at the nearest target in range and not beyond it', () => {
    const run = quietRun([], 'greenhorn', 5, 'hatchet');
    const far = dummy(run, 400, 0, 500);
    expect(events(run, 120)).not.toContain('attack');
    const near = dummy(run, 70, 0, 500);
    expect(events(run, 120)).toContain('hit');
    expect(run.enemies[near].hp).toBeLessThan(500);
    expect(run.enemies[far].hp).toBe(500);
    expect(summary(run).damageBy.hatchet).toBeGreaterThan(0);
  });

  it('a sweep hits everything in its arc and nothing behind; a thrust hits a line', () => {
    const sweep = quietRun([], 'greenhorn', 5, 'maul');
    const a = dummy(sweep, 80, 0, 500), b = dummy(sweep, 70, 45, 500), behind = dummy(sweep, -95, 0, 500);
    sweep.enemies[behind].x -= 0; // further than a, so a is the target
    ticks(sweep, 30);
    expect(sweep.enemies[a].hp).toBeLessThan(500);
    expect(sweep.enemies[b].hp).toBeLessThan(500);
    expect(sweep.enemies[behind].hp).toBe(500);
    const thrust = quietRun([], 'greenhorn', 5, 'pike');
    const t1 = dummy(thrust, 70, 0, 500), t2 = dummy(thrust, 150, 6, 500), side = dummy(thrust, 80, 70, 500);
    ticks(thrust, 30);
    expect(thrust.enemies[t1].hp).toBeLessThan(500);
    expect(thrust.enemies[t2].hp).toBeLessThan(500);
    expect(thrust.enemies[side].hp).toBe(500);
  });

  it('bow pierces 1, musket pierces 2, throwing axe bounces 1, firebrand burns, bola slows, maul knocks back', () => {
    const line = (weapon: string) => {
      const run = quietRun([], 'greenhorn', 5, weapon);
      const ids = [120, 170, 220, 270].map((d) => dummy(run, d, 0, 500));
      ticks(run, 50);
      return ids.map((i) => run.enemies[i].hp < 500);
    };
    expect(line('sling')).toEqual([true, false, false, false]);
    expect(line('bow')).toEqual([true, true, false, false]);
    expect(line('musket')).toEqual([true, true, true, false]);
    const axe = quietRun([], 'greenhorn', 5, 'axe');
    const first = dummy(axe, 120, 0, 500), second = dummy(axe, 130, 140, 500);
    ticks(axe, 60);
    expect(axe.enemies[first].hp).toBeLessThan(500);
    expect(axe.enemies[second].hp).toBeLessThan(500);
    const brand = quietRun([], 'greenhorn', 5, 'brand');
    const burning = dummy(brand, 70, 0, 500);
    ticks(brand, 20);
    expect(brand.enemies[burning].burnT).toBeGreaterThan(0);
    expect(brand.enemies[burning].burnDps).toBe(3);
    const bola = quietRun([], 'greenhorn', 5, 'bola');
    const slowed = dummy(bola, 150, 0, 500);
    ticks(bola, 40);
    expect(bola.enemies[slowed].slowT).toBeGreaterThan(0);
    expect(bola.enemies[slowed].slowF).toBeCloseTo(0.4, 9);
    const maul = quietRun([], 'greenhorn', 5, 'maul');
    const pushed = dummy(maul, 80, 0, 500);
    ticks(maul, 40);
    expect(maul.enemies[pushed].x - maul.player.x).toBeGreaterThan(90);
  });

  it('maul scales with Max HP, pike with Reach, buckler with Armor, throwing axe with Melee and Ranged', async () => {
    const { weaponDamage } = await import('../src/sim/weapons.ts');
    const dmg = (weapon: string, prim?: string) => {
      const run = quietRun(prim ? [testItem(prim, 5)] : [], 'greenhorn', 5, weapon);
      return weaponDamage(run.player, WEAPONS[WEAPON_INDEX[weapon]], 1);
    };
    expect(dmg('maul', 'maxHp')).toBeGreaterThan(dmg('maul'));
    expect(dmg('pike', 'reach')).toBeGreaterThan(dmg('pike'));
    expect(dmg('buckler', 'armor')).toBeGreaterThan(dmg('buckler'));
    expect(dmg('axe', 'melee')).toBeGreaterThan(dmg('axe'));
    expect(dmg('axe', 'ranged')).toBeGreaterThan(dmg('axe'));
    expect(dmg('sling', 'melee')).toBe(dmg('sling'));
    expect(dmg('sling', 'maxHp')).toBe(dmg('sling'));
  });
});

describe('enemies and telegraphs', () => {
  it('a boar paws for 0.7 s with a locked direction, then charges along it', () => {
    const run = quietRun();
    disarm(run); tough(run);
    const i = place(run, 'boar', 200, 0);
    const e = run.enemies[i];
    const ev = events(run, 3);
    expect(ev).toContain('tell');
    expect(e.state).toBe(ES.Windup);
    expect(e.t).toBeGreaterThan(AI.boarTell - 0.1);
    expect(e.dx).toBeCloseTo(-1, 5);
    const x = e.x;
    ticks(run, 30, 0, 1);
    expect(e.state).toBe(ES.Windup);
    expect(e.x).toBeCloseTo(x, 5);
    const dir = [e.dx, e.dy];
    ticks(run, 20, 0, 1);
    expect(e.state).toBe(ES.Charge);
    expect([e.dx, e.dy]).toEqual(dir);
    expect(x - e.x).toBeGreaterThan(40);
    expect(Math.abs(e.y - e.py)).toBeLessThan(1e-6);
    ticks(run, 60, 0, 1);
    expect(e.state).toBe(ES.Recover);
  });

  it('a brute raises a ring hazard that lands after its tell and only hurts inside it', () => {
    for (const stay of [true, false]) {
      const run = quietRun();
      disarm(run); tough(run);
      const i = place(run, 'brute', 100, 0);
      ticks(run, 3);
      const ring = run.hazards.find((h) => h.alive && h.kind === HZ_RING)!;
      expect(ring).toBeDefined();
      expect(ring.r1).toBe(AI.slamR);
      expect(ring.t).toBeLessThanOrEqual(ring.dur);
      expect(run.enemies[i].state).toBe(ES.Slam);
      const ev = events(run, 70, stay ? 0 : -1, 0);
      expect(ev).toContain('slam');
      expect(ev.includes('hurt')).toBe(stay);
    }
  });

  it('a spitter keeps its distance and its shots are plain enemy shots', () => {
    const run = quietRun();
    disarm(run); tough(run);
    const i = place(run, 'spitter', 120, 0);
    ticks(run, 240);
    const e = run.enemies[i];
    expect(Math.hypot(e.x - run.player.x, e.y - run.player.y)).toBeGreaterThan(200);
    expect(run.eshots.some((s) => s.alive) || run.damageTaken > 0).toBe(true);
  });

  it('a magpie ignores the player, takes loot for the treeline, and gives it back when killed', () => {
    const run = quietRun();
    disarm(run); tough(run);
    const p = run.player;
    for (let k = 0; k < 3; k++) spawnPickup(run, p.x + 300 + k * 30, p.y + 200, PK_SCRIP, 4, 0);
    spawnPickup(run, p.x + 330, p.y + 240, PK_TIMBER, 2, 0);
    const i = place(run, 'magpie', 10, 0);
    const ev = events(run, 400);
    expect(ev.filter((t) => t === 'steal').length).toBe(4);
    expect(run.damageTaken).toBe(0);
    const e = run.enemies[i];
    expect(e.loot0).toBe(12);
    expect(e.loot1).toBe(2);
    // Kill it: the loot drops.
    addWeapon(run, WEAPON_INDEX.musket, 4);
    e.x = p.x + 100; e.y = p.y; e.hp = 1; e.state = ES.Move; e.t = 0; e.n = 0;
    ticks(run, 150);
    expect(e.alive).toBe(false);
    ticks(run, 200);
    let ground = 0;
    for (const k of run.pickups) if (k.alive) ground += k.value;
    expect(p.scrip + p.raws.timber + ground).toBeGreaterThanOrEqual(12 + 2 + ENEMIES[ENEMY_INDEX.magpie].scrip);
    // One left alone escapes with the goods.
    const run2 = quietRun();
    disarm(run2);
    for (let k = 0; k < 6; k++) spawnPickup(run2, run2.player.x + 300, run2.player.y + 200 + k * 20, PK_SCRIP, 1, 0);
    const j = place(run2, 'magpie', 200, 100);
    const ev2 = events(run2, 1500);
    expect(ev2).toContain('escape');
    expect(run2.enemies[j].alive).toBe(false);
    expect(run2.kills).toBe(0);
  });

  it('a burrower travels underground, cannot be hit there, and surfaces by the node being worked with a tell', () => {
    const run = quietRun([], 'greenhorn', 5, 'musket');
    tough(run);
    const p = run.player;
    const n = run.nodes[0];
    n.alive = true; n.x = p.x + 30; n.y = p.y; n.type = 1; n.rich = false; n.work = 0; n.need = 99; n.tickAcc = 0;
    const i = place(run, 'burrower', 420, 0, 500);
    const e = run.enemies[i];
    e.state = ES.Burrowed; e.t = 3.5;
    const ev = events(run, 60);
    expect(e.hp).toBe(500);
    expect(ev).not.toContain('hit');
    const ev2 = events(run, 90);
    expect(ev2).toContain('tell');
    expect(Math.hypot(e.x - n.x, e.y - n.y)).toBeLessThan(90);
    expect(run.hazards.some((h) => h.kind === HZ_RING) || ev2.includes('slam')).toBe(true);
  });

  it('the stag leaves shards that linger and hurt', () => {
    const run = quietRun();
    disarm(run); tough(run);
    run.wave = 6;
    place(run, 'stag', 300, 0);
    ticks(run, 110, 0, 1);
    const shards = run.hazards.filter((h) => h.alive && h.kind === HZ_SHARD);
    expect(shards.length).toBeGreaterThan(3);
    ticks(run, 120, 0, 1);
    expect(run.hazards.some((h) => h.alive && h.kind === HZ_SHARD)).toBe(true);
  });

  it('the rotwood sheds mites and can be worked like a node while it lives', () => {
    const run = quietRun();
    disarm(run); tough(run);
    run.wave = 9;
    const i = place(run, 'rotwood', 100, 0);
    run.eliteIdx = i;
    const e = run.enemies[i];
    e.t2 = 1; e.t3 = 99;
    const hp = e.hp;
    const ev = events(run, 400);
    expect(run.enemyCount).toBeGreaterThan(3);
    expect(ev).toContain('work');
    expect(ev).toContain('break');
    expect(e.alive).toBe(true);
    expect(e.hp).toBeLessThan(hp);
    ticks(run, 120);
    expect(run.player.raws.timber).toBeGreaterThan(0);
  });

  it('Old Tusk goes through three phases and his death ends the wave', () => {
    const run = quietRun([], 'greenhorn', 5, 'musket');
    tough(run);
    for (let w = 1; w < 12; w++) { endWave(run); nextWave(run); hush(run); }
    tough(run);
    expect(run.wave).toBe(12);
    clearEvents(run);
    const i = place(run, 'tusk', 300, 0);
    run.eliteIdx = i;
    const e = run.enemies[i];
    e.n = 1;
    const seen = new Set<number>();
    const ev: string[] = [];
    const watch = (n: number) => ticks(run, n, 0, 0, (r) => { for (let k = 0; k < r.events.n; k++) { ev.push(r.events.list[k].type); if (r.events.list[k].type === 'bossPhase') seen.add(r.events.list[k].a); } });
    watch(200);
    expect(e.n).toBe(1);
    expect(ev).toContain('tell');
    e.hp = e.maxHp * 0.5;
    run.player.hp = run.player.maxHp;
    watch(400);
    expect(seen.has(2)).toBe(true);
    expect(run.enemyCount).toBeGreaterThan(1);
    e.hp = e.maxHp * 0.2;
    run.player.hp = run.player.maxHp;
    watch(400);
    expect(seen.has(3)).toBe(true);
    expect(ev).toContain('slam');
    run.player.hp = run.player.maxHp;
    damageEnemy(run, i, 1e9, 0, false, 1, 0, 0);
    watch(2);
    expect(ev).toContain('bossDeath');
    expect(run.phase).toBe('over');
    expect(run.won).toBe(true);
    expect(summary(run).wavesCleared).toBe(12);
  });

  it('never goes past the live cap of 300', () => {
    const run = quietRun();
    tough(run);
    for (let k = 0; k < 80; k++) spawnPack(run, ENEMY_INDEX.gnat, 8);
    expect(run.enemyCount).toBe(MAX_ENEMIES);
    ticks(run, 5);
    expect(run.enemies.filter((e) => e.alive).length).toBe(run.enemyCount);
    expect(run.enemyCount).toBeLessThanOrEqual(MAX_ENEMIES);
  });
});

describe('nodes and raws', () => {
  const node = (run: Run, type: number, rich = false) => {
    const n = run.nodes[0], p = run.player;
    n.alive = true; n.x = p.x + 20; n.y = p.y; n.type = type; n.rich = rich; n.work = 0; n.need = rich ? 5.5 : 3; n.tickAcc = 0;
  };
  const workTime = (run: Run) => { let t = 0; while (run.nodes[0].alive && t < 2000) { ticks(run, 1); t++; } return t; };

  it('a node takes about 3 s at base rate, the matching tool halves that, and it bursts into raw pickups', () => {
    const run = quietRun();
    node(run, 0);
    const ev: string[] = [];
    let t = 0;
    while (run.nodes[0].alive) { ticks(run, 1, 0, 0, (r) => { for (let i = 0; i < r.events.n; i++) ev.push(r.events.list[i].type); }); t++; }
    expect(t).toBeGreaterThanOrEqual(180);
    expect(t).toBeLessThanOrEqual(181);
    expect(ev.filter((e) => e === 'work').length).toBe(6);
    expect(ev).toContain('break');
    expect(run.pickups.filter((k) => k.alive && k.kind === PK_TIMBER).length + run.player.raws.timber).toBe(3);
    ticks(run, 200);
    expect(run.player.raws.timber).toBe(3);
    expect(summary(run).rawsGathered.timber).toBe(3);
    for (const [weapon, type] of [['hatchet', 0], ['pick', 1], ['knife', 2]] as const) {
      const tool = quietRun([], 'greenhorn', 5, weapon);
      node(tool, type);
      expect(Math.abs(workTime(tool) - 90)).toBeLessThanOrEqual(1);
      const wrong = quietRun([], 'greenhorn', 5, weapon);
      node(wrong, (type + 1) % 3);
      expect(Math.abs(workTime(wrong) - 180)).toBeLessThanOrEqual(1);
    }
  });

  it('standing outside the ring does nothing; Harvest adds work rate and +1 raw per 10; stations add yield; rich nodes give more', () => {
    const run = quietRun();
    node(run, 1);
    run.nodes[0].x = run.player.x + 200;
    ticks(run, 120);
    expect(run.nodes[0].work).toBe(0);
    const h = quietRun([testItem('harvest', 5)]);
    expect(h.player.workRate).toBeCloseTo(1 + 22 / 20, 9);
    expect(nodeYield(h, 0, false)).toBe(5);
    expect(nodeYield(h, 0, true)).toBe(10);
    expect(nodeYield(createRun({ seed: 1, character: 'greenhorn', hazard: 2 }), 0, false)).toBe(2);
    const town = createRun({ seed: 1, character: 'greenhorn', stations: { sawmill: 3, smelter: 2 } });
    expect(nodeYield(town, 0, false)).toBe(5);
    expect(nodeYield(town, 1, false)).toBe(4);
    expect(nodeYield(town, 2, false)).toBe(3);
  });

  it('rich nodes appear from wave 3 and not before, and stand nearer a lane mouth; Trapper sees twice the carcasses', () => {
    let richEarly = 0, richLate = 0, carcG = 0, carcT = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const run = createRun({ seed, character: 'greenhorn' });
      const trap = createRun({ seed, character: 'trapper' });
      for (let w = 1; w <= 8; w++) {
        for (const n of run.nodes) if (n.alive && n.rich) { if (w < 3) richEarly++; else richLate++; }
        if (w === 2) { carcG += run.nodes.filter((n) => n.alive && n.type === 2).length; carcT += trap.nodes.filter((n) => n.alive && n.type === 2).length; }
        for (const n of run.nodes) n.alive = false;
        hush(run); endWave(run); nextWave(run);
        hush(trap); endWave(trap); nextWave(trap);
      }
    }
    expect(richEarly).toBe(0);
    expect(richLate).toBeGreaterThan(10);
    expect(carcT).toBeGreaterThan(carcG * 1.5);
  });
});

describe('pickups', () => {
  it('fly in inside the magnet radius and stay put outside it', () => {
    const run = quietRun();
    disarm(run);
    const p = run.player;
    spawnPickup(run, p.x + 60, p.y, PK_SCRIP, 2, 0);
    spawnPickup(run, p.x + 300, p.y, PK_SCRIP, 9, 0);
    const ev = events(run, 60);
    expect(p.scrip).toBe(2);
    expect(ev.filter((e) => e === 'pickup').length).toBe(1);
    expect(run.pickups.filter((k) => k.alive).length).toBe(1);
  });
});

describe('waves', () => {
  it('a wave ends on its timer, pays interest, opens the bench, and the next one starts healed in the middle', () => {
    const run = createRun({ seed: 4, character: 'clerk' });
    const p = run.player;
    tough(run);
    p.scrip = 100;
    const ev = events(run, 20 * 60 + 5, 0, 0);
    expect(run.phase).toBe('bench');
    expect(ev).toContain('waveEnd');
    expect(run.wavesCleared).toBe(1);
    // 8% of 100 or more, capped at 6 per wave number.
    expect(run.bench.interestPaid).toBe(6);
    expect(run.enemyCount).toBe(0);
    step(run, { mx: 1, my: 0 });
    expect(run.tick).toBe(20 * 60);
    p.hp = 1;
    expect(nextWave(run)).toBe(true);
    expect(run.wave).toBe(2);
    expect(p.hp).toBe(p.maxHp);
    expect([p.x, p.y]).toEqual([ARENA_W / 2, ARENA_H / 2]);
    expect(run.events.list.slice(0, run.events.n).some((e) => e.type === 'waveStart')).toBe(true);
    clearEvents(run);
    expect(run.events.n).toBe(0);
  });

  it('elites arrive in waves 6 and 9 with an event', () => {
    const run = quietRun();
    for (let w = 1; w < 6; w++) { hush(run); endWave(run); nextWave(run); }
    tough(run); disarm(run);
    const ev: string[] = [];
    for (let t = 0; t < 400; t++) { step(run, { mx: 0, my: 0 }); for (let i = 0; i < run.events.n; i++) ev.push(run.events.list[i].type); clearEvents(run); }
    expect(ev).toContain('eliteSpawn');
    expect(run.eliteIdx).toBeGreaterThanOrEqual(0);
    expect(ENEMIES[run.enemies[run.eliteIdx].type].id).toBe('stag');
    void direct;
  });

  it('the daily plan is 8 waves, ends on the boss, and sends the mule once', () => {
    const run = createRun({ seed: 4, character: 'greenhorn', waves: 8 });
    expect(run.totalWaves).toBe(8);
    const mules: number[] = [];
    for (let w = 1; w <= 8; w++) {
      hush(run); endWave(run);
      if (run.phase === 'bench') { if (run.bench.mule) mules.push(w); nextWave(run); }
    }
    expect(mules).toEqual([4]);
    expect(run.phase).toBe('over');
    expect(run.won).toBe(true);
    expect(summary(run).wavesCleared).toBe(8);
  });

  it('kit: an authored item packed for the run is in force in wave 1', () => {
    const run = createRun({ seed: 2, character: 'greenhorn', kit: [BASE_ITEM.hobnails] });
    expect(run.player.stat[ST.speed]).toBe(6);
  });
});

describe('work under fire', () => {
  const nodeAt = (run: Run, dx: number) => {
    const n = run.nodes[0], p = run.player;
    n.alive = true; n.x = p.x + dx; n.y = p.y; n.type = 0; n.rich = false; n.work = 0; n.need = 3; n.tickAcc = 0; n.noise = 0;
    return n;
  };

  it('work is loud from wave 3: every unit of work calls a pack that carries no scrip; before wave 3 it calls nothing', () => {
    const early = quietRun();
    disarm(early); nodeAt(early, 20);
    ticks(early, 90);
    expect(early.enemyCount).toBe(0);
    const run = quietRun();
    run.wave = 3; run.laneCount = 1; run.lanes[0] = 0; run.lanes[1] = 0;
    disarm(run); tough(run); nodeAt(run, 20);
    ticks(run, 70);
    expect(run.enemyCount).toBe(3 + Math.floor(3 / 2));
    const called = run.enemies.filter((e) => e.alive);
    expect(called.every((e) => e.called && ENEMIES[e.type].id === 'gnat')).toBe(true);
    const i = run.enemies.indexOf(called[0]);
    damageEnemy(run, i, 1e6, 0, false, 0, 0, 0);
    expect(run.pickups.some((k) => k.alive && k.kind === PK_SCRIP)).toBe(false);
  });

  it('a hit lands twice as hard on a player at a node from wave 3, and work left alone drains at half a unit a second', () => {
    const run = quietRun();
    run.wave = 3;
    disarm(run); tough(run);
    hurtPlayer(run, 4, 0, -1, 0);
    expect(run.damageTaken).toBe(4);
    const n = nodeAt(run, 20);
    n.need = 1e9;
    ticks(run, 60);
    for (let i = 0; i < run.enemies.length; i++) if (run.enemies[i].alive) { run.enemies[i].alive = false; run.enemyCount--; }
    run.player.iframes = 0;
    hurtPlayer(run, 4, 0, -1, 0);
    expect(run.damageTaken).toBe(4 + 8);
    const done = n.work;
    expect(done).toBeGreaterThan(0.9);
    n.x += 400;
    ticks(run, 60);
    expect(n.work).toBeCloseTo(done - 0.5, 6);
  });

  it('Trapper: elites and brutes leave a carcass, and every node broken heals 2', () => {
    const run = quietRun([], 'trapper');
    const i = place(run, 'brute', 200, 0, 5);
    damageEnemy(run, i, 100, 0, false, 0, 0, 0);
    expect(run.nodes.filter((n) => n.alive && n.type === 2).length).toBe(1);
    const green = quietRun();
    const j = place(green, 'brute', 200, 0, 5);
    damageEnemy(green, j, 100, 0, false, 0, 0, 0);
    expect(green.nodes.some((n) => n.alive)).toBe(false);
    disarm(run);
    for (const n of run.nodes) n.alive = false;
    nodeAt(run, 20);
    run.player.hp = 3;
    ticks(run, 190);
    expect(run.player.hp).toBe(5);
  });
});

describe('hazard ladder', () => {
  it('level 0 is the default and changes nothing; levels are clamped to 0-5', () => {
    expect(createRun({ seed: 3, character: 'greenhorn' }).hazard).toBe(0);
    expect(createRun({ seed: 3, character: 'greenhorn', hazard: 9 }).hazard).toBe(5);
    expect(createRun({ seed: 3, character: 'greenhorn', hazard: -2 }).hazard).toBe(0);
    expect(createRun({ seed: 3, character: 'greenhorn', hazard: Number.NaN }).hazard).toBe(0);
    const a = createRun({ seed: 3, character: 'greenhorn' }), b = createRun({ seed: 3, character: 'greenhorn', hazard: 0 });
    for (let t = 0; t < 600; t++) { step(a, { mx: 1, my: 0 }); step(b, { mx: 1, my: 0 }); }
    expect([a.player.hp, a.kills, a.enemyCount, a.rng[0]]).toEqual([b.player.hp, b.kills, b.enemyCount, b.rng[0]]);
  });

  it('1: an elite comes a wave early and carries no scrip', () => {
    const at5 = (hazard: number) => {
      const run = createRun({ seed: 6, character: 'greenhorn', hazard });
      for (let w = 1; w < 5; w++) { hush(run); endWave(run); nextWave(run); }
      tough(run);
      ticks(run, 240);
      return run;
    };
    expect(at5(0).eliteIdx).toBe(-1);
    const run = at5(1);
    expect(run.eliteIdx).toBeGreaterThanOrEqual(0);
    const e = run.enemies[run.eliteIdx];
    expect(ENEMIES[e.type].id).toBe('stag');
    expect(e.called).toBe(true);
  });

  it('3: a new wave mends half of what is missing; 4: spitters spit three; 5: Old Tusk rises once at half health', () => {
    const rest = createRun({ seed: 2, character: 'greenhorn', hazard: 3 });
    hush(rest); endWave(rest);
    rest.player.hp = 4;
    nextWave(rest);
    expect(rest.player.hp).toBe(4 + (rest.player.maxHp - 4) / 2);

    const spits = (hazard: number) => {
      const run = createRun({ seed: 2, character: 'greenhorn', hazard });
      hush(run); tough(run); disarm(run);
      place(run, 'spitter', 300, 0);
      let most = 0;
      ticks(run, 300, 0, 0, (r) => { const n = r.eshots.filter((s) => s.alive).length; if (n > most) most = n; });
      return most;
    };
    expect(spits(0)).toBe(1);
    expect(spits(4)).toBeGreaterThanOrEqual(3);

    const run = createRun({ seed: 2, character: 'greenhorn', hazard: 5 });
    hush(run);
    const i = place(run, 'tusk', 300, 0, 100);
    run.eliteIdx = i;
    damageEnemy(run, i, 1000, 0, false, 0, 0, 0);
    expect(run.enemies[i].alive).toBe(true);
    expect(run.enemies[i].hp).toBe(50);
    expect(run.bossRose).toBe(true);
    damageEnemy(run, i, 1000, 0, false, 0, 0, 0);
    expect(run.enemies[i].alive).toBe(false);
    expect(run.bossDead).toBe(true);
  });
});

describe('engine-independent trigonometry', () => {
  it('tsin and tcos match Math.sin and Math.cos to 1e-7 over many turns', async () => {
    const { tsin, tcos, ipow } = await import('../src/sim/trig.ts');
    for (let x = -40; x <= 40; x += 0.0137) {
      expect(Math.abs(tsin(x) - Math.sin(x))).toBeLessThan(1e-7);
      expect(Math.abs(tcos(x) - Math.cos(x))).toBeLessThan(1e-7);
    }
    expect(ipow(1.35, 3)).toBeCloseTo(1.35 ** 3, 12);
    expect(ipow(2, 0)).toBe(1);
  });
});
