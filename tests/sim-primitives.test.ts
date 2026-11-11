import { describe, expect, it } from 'vitest';
import { PRIMITIVES } from '../src/shared/vocab.ts';
import { offerOdds, rerollCost } from '../src/sim/bench.ts';
import { gainScrip, hurtPlayer, killEnemy, rebuild, SP, spawnPickup, ST } from '../src/sim/core.ts';
import { SRC_BURN, SRC_BURST, SRC_RECOIL, SRC_SHARDS, SRC_THORNS, WEAPONS, WEAPON_INDEX } from '../src/sim/data/weapons.ts';
import { PK_SCRIP, type Run } from '../src/sim/types.ts';
import { fireShot, weaponCooldown, weaponDamage, weaponRange } from '../src/sim/weapons.ts';
import { endWave } from '../src/sim/world.ts';
import { countEvents, disarm, dummy, place, quietRun, testItem, ticks } from './sim-helpers.ts';

type Probe = (run: Run) => number;

/** Put a fresh node of the given type under the player. */
function nodeHere(run: Run, type = 0): void {
  const n = run.nodes[0];
  n.alive = true; n.x = run.player.x + 20; n.y = run.player.y; n.type = type; n.rich = false; n.work = 0; n.need = 3; n.tickAcc = 0;
}
function groundRaws(run: Run): number { let c = 0; for (const k of run.pickups) if (k.alive && k.kind !== PK_SCRIP) c += k.value; return c; }
function shoot(run: Run, dx: number, dy: number): void {
  const p = run.player;
  fireShot(run, p.x, p.y, dx, dy, 600, 5, WEAPON_INDEX.sling, 400, 0, 0, false, 0, p.sp[SP.burn], 0, true);
}

/**
 * One probe per primitive: a number measured in a small scenario. The test
 * asserts that holding an item with that primitive moves the number in the
 * stated direction. A primitive with no probe fails the suite. (The
 * vocabulary holds 37 primitives: 13 stats and 24 specials.)
 */
const PROBES: Record<string, { probe: Probe; dir: 1 | -1; weapon?: string }> = {
  maxHp: { dir: 1, probe: (r) => r.player.maxHp },
  mend: { dir: 1, probe: (r) => { disarm(r); r.player.hp = 2; ticks(r, 300); return r.player.hp; } },
  armor: { dir: -1, probe: (r) => { hurtPlayer(r, 9, 0, -1, 0); return r.damageTaken; } },
  dodge: { dir: 1, probe: (r) => { let d = 0; r.player.base[ST.maxHp] = 9999; rebuild(r); r.player.hp = 9999;
    for (let i = 0; i < 400; i++) { r.player.iframes = 0; if (!hurtPlayer(r, 1, 0, -1, 0)) d++; } return d; } },
  speed: { dir: 1, probe: (r) => { const x = r.player.x; ticks(r, 60, 1, 0); return r.player.x - x; } },
  damage: { dir: 1, weapon: 'maul', probe: (r) => { const i = dummy(r, 60, 0, 5000); ticks(r, 30); return 5000 - r.enemies[i].hp; } },
  melee: { dir: 1, weapon: 'hatchet', probe: (r) => weaponDamage(r.player, WEAPONS[WEAPON_INDEX.hatchet], 1) },
  ranged: { dir: 1, weapon: 'bow', probe: (r) => { const i = dummy(r, 200, 0, 5000); ticks(r, 60); return 5000 - r.enemies[i].hp; } },
  rate: { dir: 1, probe: (r) => { dummy(r, 200, 0); return countEvents(r, 600, 'attack'); } },
  crit: { dir: 1, probe: (r) => { dummy(r, 200, 0); return countEvents(r, 3000, 'crit'); } },
  reach: { dir: 1, probe: (r) => { let hit = 0;
    for (const d of [290, 320, 335, 350, 380, 410]) { const i = dummy(r, 0, d); ticks(r, 70); if (r.enemies[i].hp < 1e6) hit++; killEnemy(r, i, false); }
    return hit; } },
  harvest: { dir: -1, probe: (r) => { disarm(r); nodeHere(r); let t = 0; while (r.nodes[0].alive && t < 600) { ticks(r, 1); t++; } return t; } },
  luck: { dir: 1, probe: (r) => { endWave(r); return offerOdds(r, 3)[2]; } },

  thorns: { dir: 1, probe: (r) => { disarm(r); const i = place(r, 'boar', 5, 0, 500); ticks(r, 4); return 500 - r.enemies[i].hp + r.dmgBy[SRC_THORNS]; } },
  nodeBurst: { dir: 1, probe: (r) => { disarm(r); nodeHere(r); dummy(r, 85, 0, 900);
    ticks(r, 220); return r.dmgBy[SRC_SHARDS]; } },
  nodeHeal: { dir: 1, probe: (r) => { disarm(r); r.player.hp = 3; nodeHere(r); ticks(r, 200); return r.player.hp; } },
  richNodes: { dir: 1, probe: (r) => { disarm(r); let total = 0;
    for (let k = 0; k < 30; k++) { for (const pk of r.pickups) pk.alive = false; nodeHere(r); r.nodes[0].work = 2.99; ticks(r, 3); total += groundRaws(r) + r.gathered.timber; r.gathered.timber = 0; }
    return total; } },
  killScrip: { dir: 1, probe: (r) => { for (let k = 0; k < 80; k++) { place(r, 'mite', 40, 0, 1); ticks(r, 40); } ticks(r, 60); return r.scripEarned; } },
  interest: { dir: 1, probe: (r) => { r.player.scrip = 150; endWave(r); return r.player.scrip; } },
  hoardTimber: { dir: 1, probe: (r) => { r.player.raws.timber = 25; ticks(r, 1); return r.player.stat[ST.damage]; } },
  hoardOre: { dir: 1, probe: (r) => { r.player.raws.ore = 30; ticks(r, 1); hurtPlayer(r, 9, 0, -1, 0); return r.player.stat[ST.armor] * 100 - r.damageTaken; } },
  hoardHide: { dir: 1, probe: (r) => { r.player.raws.hide = 25; ticks(r, 1); return r.player.maxHp; } },
  lowHpRate: { dir: 1, probe: (r) => { r.player.hp = 2; dummy(r, 250, 0); return countEvents(r, 120, 'attack'); } },
  stillDamage: { dir: 1, weapon: 'bow', probe: (r) => { const i = dummy(r, 250, 0); ticks(r, 120); return 1e6 - r.enemies[i].hp; } },
  movingDodge: { dir: 1, probe: (r) => { ticks(r, 2, 1, 0); return r.player.dodge; } },
  waveShield: { dir: -1, probe: (r) => { hurtPlayer(r, 4, 0, -1, 0); return r.damageTaken - r.player.shield; } },
  killBlast: { dir: 1, probe: (r) => { for (let k = 0; k < 60; k++) { place(r, 'mite', 45, 0, 1); if (k === 0) dummy(r, 70, 40); ticks(r, 40); } return r.dmgBy[SRC_BURST]; } },
  hurtBlast: { dir: 1, probe: (r) => { disarm(r); const i = dummy(r, 90, 0, 900); ticks(r, 1); hurtPlayer(r, 2, 0, -1, 0); return 900 - r.enemies[i].hp + r.dmgBy[SRC_RECOIL]; } },
  pierce: { dir: 1, probe: (r) => { disarm(r); dummy(r, 80, 0, 900); const far = dummy(r, 160, 0, 900);
    ticks(r, 1); shoot(r, 1, 0); ticks(r, 40); return 900 - r.enemies[far].hp; } },
  bounce: { dir: 1, probe: (r) => { disarm(r); dummy(r, 80, 0, 900); const side = dummy(r, 80, 150, 900);
    ticks(r, 1); shoot(r, 1, 0); ticks(r, 60); return 900 - r.enemies[side].hp; } },
  burn: { dir: 1, probe: (r) => { dummy(r, 200, 0, 5000); ticks(r, 240); return r.dmgBy[SRC_BURN]; } },
  knockback: { dir: 1, weapon: 'hatchet', probe: (r) => { const i = dummy(r, 60, 0, 5000); ticks(r, 30); return r.enemies[i].x - r.player.x; } },
  rerollCut: { dir: -1, probe: (r) => { for (let k = 0; k < 6; k++) { endWave(r); if (k < 5) { r.phase = 'bench'; r.wave++; r.phase = 'wave'; } } r.bench.index = 8; return rerollCost(r); } },
  eliteDamage: { dir: 1, probe: (r) => { const i = dummy(r, 200, 0, 5000, 'stag'); ticks(r, 120); return 5000 - r.enemies[i].hp; } },
  magnet: { dir: 1, probe: (r) => { disarm(r); spawnPickup(r, r.player.x + 115, r.player.y, PK_SCRIP, 7, 0); ticks(r, 60); return r.player.scrip; } },
  xpGain: { dir: 1, probe: (r) => { gainScrip(r, 10); return r.player.xp; } },
  secondWind: { dir: 1, probe: (r) => { hurtPlayer(r, 500, 0, -1, 0); return r.phase === 'wave' ? r.player.hp : 0; } },
};

describe('every effect primitive changes an outcome', () => {
  it('has a probe for each primitive in the vocabulary and nothing else', () => {
    expect(PRIMITIVES.length).toBe(37);
    expect(Object.keys(PROBES).sort()).toEqual(PRIMITIVES.map((p) => p.id).sort());
  });

  for (const prim of PRIMITIVES) {
    it(`${prim.id}: "${prim.text}"`, () => {
      const spec = PROBES[prim.id];
      const without = spec.probe(quietRun([], 'greenhorn', 5, spec.weapon));
      const withIt = spec.probe(quietRun([testItem(prim.id, 4)], 'greenhorn', 5, spec.weapon));
      expect(Number.isFinite(without) && Number.isFinite(withIt)).toBe(true);
      expect((withIt - without) * spec.dir).toBeGreaterThan(0);
      if (prim.kind === 'stat') {
        // A drawback pushes the same outcome the other way.
        const worse = spec.probe(quietRun([testItem(prim.id, 2, true)], 'greenhorn', 5, spec.weapon));
        if (prim.id !== 'dodge' && prim.id !== 'crit' && prim.id !== 'mend') expect((worse - without) * spec.dir).toBeLessThan(0);
        else expect((worse - without) * spec.dir).toBeLessThanOrEqual(0);
      }
    });
  }
});

describe('conditions hold only when they should', () => {
  it('stillDamage needs standing still, movingDodge needs moving, lowHpRate needs under half health', () => {
    const run = quietRun([testItem('stillDamage', 3), testItem('movingDodge', 3)]);
    const p = run.player;
    p.items.push(testItem('lowHpRate', 3)); p.itemKit.push(false); rebuild(run);
    ticks(run, 2);
    expect(p.stat[ST.damage]).toBe(24);
    expect(p.stat[ST.dodge]).toBe(0);
    expect(p.stat[ST.rate]).toBe(0);
    ticks(run, 2, 0, 1);
    expect(p.stat[ST.damage]).toBe(0);
    expect(p.stat[ST.dodge]).toBe(9);
    p.hp = p.maxHp * 0.4;
    ticks(run, 1);
    expect(p.stat[ST.rate]).toBe(28);
  });

  it('secondWind works once per wave; waveShield breaks with an event', () => {
    const run = quietRun([testItem('secondWind', 3), testItem('waveShield', 1)]);
    const p = run.player;
    expect(p.shield).toBe(5);
    let broke = 0, wind = 0;
    hurtPlayer(run, 500, 0, -1, 0);
    for (let i = 0; i < run.events.n; i++) { if (run.events.list[i].type === 'shieldBreak') broke++; if (run.events.list[i].type === 'secondWind') wind++; }
    expect([broke, wind]).toEqual([1, 1]);
    expect(p.hp).toBe(10);
    expect(run.phase).toBe('wave');
    p.iframes = 0;
    hurtPlayer(run, 500, 0, -1, 0);
    expect(run.phase).toBe('over');
    expect(run.killedBy).toBe('mite');
  });

  it('stat caps hold however much is stacked', () => {
    const many = Array.from({ length: 2 }, () => testItem('dodge', 5));
    const run = quietRun(many);
    const p = run.player;
    for (let i = 0; i < 40; i++) { p.items.push(testItem('dodge', 5), testItem('rate', 5), testItem('damage', 5), testItem('speed', 5), testItem('pierce', 5), testItem('killBlast', 5)); }
    while (p.itemKit.length < p.items.length) p.itemKit.push(false);
    rebuild(run);
    expect(p.dodge).toBe(0.6);
    expect(p.stat[ST.rate]).toBe(200);
    expect(p.stat[ST.damage]).toBe(300);
    expect(p.stat[ST.speed]).toBe(60);
    expect(p.sp[SP.pierce]).toBe(3);
    expect(p.sp[SP.killBlast]).toBe(60);
    expect(weaponCooldown(p, WEAPONS[WEAPON_INDEX.sling], 4)).toBeGreaterThanOrEqual(0.08);
    expect(weaponRange(p, WEAPONS[WEAPON_INDEX.sling])).toBe(330);
  });
});
