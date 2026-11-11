import { describe, expect, it } from 'vitest';
import { BASE_ITEM } from '../src/shared/content/items.ts';
import { RELIC, RELICS } from '../src/shared/content/relics.ts';
import { effectText, fusionBlock, itemTier, relicLine, repairEffects, type ItemSpec } from '../src/shared/item.ts';
import { KIT_RELICS } from '../src/shared/protocol.ts';
import { PRIM, PRIMITIVES, RELIC_PRIMITIVES } from '../src/shared/vocab.ts';
import { addWeapon, applyFusion, buy, fuseCost, fusionResultBlock, reroll, scrapItem, toggleLock } from '../src/sim/bench.ts';
import { playRun, standInFusion } from '../src/sim/bot.ts';
import { hurtPlayer, rebuild, SP, ST, weaponSlots } from '../src/sim/core.ts';
import { WEAPONS, WEAPON_INDEX } from '../src/sim/data/weapons.ts';
import { carryLimit, createRun, hasBadNumber, nextWave, stateHash } from '../src/sim/run.ts';
import type { Run } from '../src/sim/types.ts';
import { endWave } from '../src/sim/world.ts';
import { disarm, quietRun, testItem, ticks } from './sim-helpers.ts';

const relic = (id: string): ItemSpec => RELIC[id];

/** Put a fresh node of the given type under the player. */
function nodeHere(run: Run, type = 0): void {
  const n = run.nodes[0];
  n.alive = true; n.x = run.player.x + 20; n.y = run.player.y; n.type = type; n.rich = false; n.work = 0; n.need = 3; n.tickAcc = 0; n.regrown = false;
}
/** Ticks until the node under the player breaks (or 2000). */
function ticksToBreak(run: Run): number {
  let breaks = 0, t = 0;
  while (breaks === 0 && t < 2000) {
    ticks(run, 1, 0, 0, (r) => { for (let i = 0; i < r.events.n; i++) if (r.events.list[i].type === 'break') breaks++; });
    t++;
  }
  return t;
}
const breaksIn = (run: Run, n: number): number => {
  let c = 0;
  ticks(run, n, 0, 0, (r) => { for (let i = 0; i < r.events.n; i++) if (r.events.list[i].type === 'break') c++; });
  return c;
};
const groundRaws = (run: Run): number => run.pickups.reduce((n, k) => n + (k.alive && k.kind !== 0 ? k.value : 0), 0);

describe('relics: the set', () => {
  it('is eight authored items, each with exactly one relic effect and no numbers', () => {
    expect(RELICS).toHaveLength(8);
    expect(new Set(RELICS.map((r) => r.id)).size).toBe(8);
    expect(new Set(RELICS.map((r) => r.name)).size).toBe(8);
    const used = new Set<string>();
    for (const r of RELICS) {
      expect(r.relic).toBe(true);
      expect(r.effects).toHaveLength(1);
      expect(RELIC_PRIMITIVES.some((p) => p.id === r.effects[0].p)).toBe(true);
      expect(Object.hasOwn(BASE_ITEM, r.id)).toBe(false);
      used.add(r.effects[0].p);
      expect(itemTier(r)).toBe(5);
      // One line, no figure to grow, dry voice.
      const text = effectText(r.effects[0]);
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toMatch(/[!—%]|\d/);
      // Names: plain, sentence case, no "of the".
      expect(r.name).toMatch(/^[A-Z][a-z]+( [a-z]+)?$/);
    }
    // Every relic effect belongs to one relic.
    expect(used.size).toBe(RELIC_PRIMITIVES.length);
  });

  it('keeps relic effects out of the fusion vocabulary', () => {
    for (const p of RELIC_PRIMITIVES) {
      expect(Object.hasOwn(PRIM, p.id)).toBe(false);
      expect(PRIMITIVES.some((x) => x.id === p.id)).toBe(false);
    }
    // repairEffects drops them whatever a provider says, and never picks one to fill a gap.
    const picks = RELIC_PRIMITIVES.map((p) => ({ p: p.id, l: 5 }));
    for (let seed = 0; seed < 200; seed++) {
      const fixed = repairEffects([...picks, { p: 'armor', l: 1 }], 40, seed);
      expect(fixed.every((e) => Object.hasOwn(PRIM, e.p))).toBe(true);
      const filled = repairEffects(picks, 40, seed);
      expect(filled.length).toBeGreaterThan(0);
      expect(filled.every((e) => Object.hasOwn(PRIM, e.p))).toBe(true);
    }
  });

  it('writes the serial line for a relic in hand and nothing for a bare one', () => {
    expect(relicLine({ serial: 3, by: 'Carter 412' })).toBe('No. 3 in the world, found by Carter 412');
    expect(relicLine({})).toBe('');
  });
});

describe('relics: rules in the run', () => {
  it('lets only one relic into a kit', () => {
    expect(KIT_RELICS).toBe(1);
    const run = createRun({ seed: 3, character: 'greenhorn', kit: [relic('saddlescabbard'), relic('hideblind')] });
    expect(run.player.items.map((i) => i.id)).toEqual(['saddlescabbard']);
    expect(run.player.sp[SP.extraSlot]).toBe(1);
    expect(run.player.sp[SP.safeWork]).toBe(0);
    // A relic and an ordinary item still fit.
    const mixed = createRun({ seed: 3, character: 'greenhorn', kit: [BASE_ITEM.whetstone, relic('hideblind')] });
    expect(mixed.player.items.map((i) => i.id)).toEqual(['whetstone', 'hideblind']);
  });

  it('takes a relic effect from the authored table only', () => {
    // A relic id that does not exist is dropped at the door.
    const fake = { ...relic('hideblind'), id: 'goldenchest' };
    expect(createRun({ seed: 3, character: 'greenhorn', kit: [fake] }).player.items).toHaveLength(0);
    // A real relic id with made-up effects still does only what the real one does.
    const padded: ItemSpec = { ...relic('orderbook'), effects: [{ p: 'extraSlot', l: 1 }, { p: 'damage', l: 5 }] };
    const run = quietRun([padded]);
    expect(run.player.sp[SP.extraSlot]).toBe(0);
    expect(run.player.sp[SP.extraOffer]).toBe(1);
    expect(run.player.flat).toEqual(quietRun().player.flat);
    // An ordinary item cannot carry a relic effect.
    const smuggled = quietRun([{ ...testItem('armor', 1), effects: [{ p: 'extraSlot', l: 1 }, { p: 'safeWork', l: 1 }] }]);
    expect(smuggled.player.sp[SP.extraSlot]).toBe(0);
    expect(smuggled.player.sp[SP.safeWork]).toBe(0);
  });

  it('cannot be scrapped, fused, or come out of the anvil', () => {
    const run = quietRun([relic('seedcorn'), BASE_ITEM.whetstone]);
    run.player.items.push(BASE_ITEM.tallow); run.player.itemKit.push(false);
    run.player.raws = { timber: 50, ore: 50, hide: 50 };
    endWave(run);
    expect(run.phase).toBe('bench');
    expect(scrapItem(run, 0)).toBe(false);
    expect(run.player.items[0].id).toBe('seedcorn');
    expect(fusionBlock(relic('seedcorn'), BASE_ITEM.whetstone)).toBe('A relic cannot be fused.');
    expect(fuseCost(run, 0, 1).block).toBe('A relic cannot be fused.');
    expect(applyFusion(run, 0, 1, standInFusion(BASE_ITEM.whetstone, BASE_ITEM.tallow, 30))).toBe('A relic cannot be fused.');
    expect(run.player.items).toHaveLength(3);
    // Two ordinary items cannot be fused into a relic either.
    expect(fusionResultBlock(relic('seedcorn'), 110)).not.toBeNull();
    expect(applyFusion(run, 1, 2, relic('saddlescabbard'))).not.toBeNull();
    expect(run.player.items).toHaveLength(3);
    // It is never carried home from a run: it came in the kit.
    expect(run.player.itemKit[0]).toBe(true);
  });

  it('keeps the sim deterministic', () => {
    // The three whose rules reach deepest into the tick: slots, nodes, death.
    for (const r of [relic('saddlescabbard'), relic('seedcorn'), relic('brandyflask')]) {
      const a = playRun({ seed: 4242, character: 'greenhorn', waves: 8, kit: [r] });
      const b = playRun({ seed: 4242, character: 'greenhorn', waves: 8, kit: [r] });
      expect(stateHash(a), r.id).toBe(stateHash(b));
      expect(hasBadNumber(a), r.id).toBeNull();
    }
  }, 300_000);
});

describe('relics: one rule each', () => {
  it('Saddle scabbard: one more weapon slot', () => {
    const fill = (run: Run): number => {
      for (let i = 0; i < WEAPONS.length; i++) addWeapon(run, i, 1);
      return run.player.weapons.length;
    };
    const bare = quietRun(); disarm(bare);
    const held = quietRun([relic('saddlescabbard')]); disarm(held);
    expect(weaponSlots(bare)).toBe(6);
    expect(weaponSlots(held)).toBe(7);
    expect(fill(bare)).toBe(6);
    expect(fill(held)).toBe(7);
    // An eighth is refused, and the Tinker goes from five to six.
    expect(addWeapon(held, WEAPON_INDEX.buckler, 3)).toBe(false);
    expect(weaponSlots(quietRun([relic('saddlescabbard')], 'tinker'))).toBe(6);
  });

  it('Hide blind: nothing lands while a node is being worked', () => {
    const run = quietRun([relic('hideblind')]);
    disarm(run);
    // In the open it is hurt like anyone.
    expect(hurtPlayer(run, 3, 0, -1, 0)).toBe(true);
    const taken = run.damageTaken;
    run.player.iframes = 0;
    nodeHere(run);
    ticks(run, 2);
    expect(run.player.workingNode).toBe(0);
    for (let i = 0; i < 20; i++) { run.player.iframes = 0; expect(hurtPlayer(run, 50, 0, -1, 0)).toBe(false); }
    expect(run.damageTaken).toBe(taken);
    // The cover lasts as long as the work does: when the node breaks it is gone.
    ticksToBreak(run);
    ticks(run, 1);
    expect(run.player.workingNode).toBe(-1);
    run.player.iframes = 0;
    expect(hurtPlayer(run, 3, 0, -1, 0)).toBe(true);
    // The walking rotwood is not a node.
    run.player.iframes = 0; run.player.workingNode = -2;
    expect(hurtPlayer(run, 1, 0, -1, 0)).toBe(true);
    // Without the relic a worked node is no shelter.
    const bare = quietRun(); disarm(bare); nodeHere(bare); ticks(bare, 2);
    expect(hurtPlayer(bare, 3, 0, -1, 0)).toBe(true);
  });

  it('Seed corn: a broken node grows back once in the same wave', () => {
    const run = quietRun([relic('seedcorn')]);
    disarm(run);
    nodeHere(run);
    ticksToBreak(run);
    expect(run.nodes[0].alive).toBe(true);
    expect(run.nodes[0].work).toBe(0);
    expect(run.nodes[0].regrown).toBe(true);
    const first = groundRaws(run) + run.gathered.timber;
    expect(first).toBeGreaterThan(0);
    ticksToBreak(run);
    expect(run.nodes[0].alive).toBe(false);
    expect(groundRaws(run) + run.gathered.timber).toBe(first * 2);
    expect(breaksIn(run, 400)).toBe(0);
    // Next wave the same node can grow back again.
    nodeHere(run); run.nodes[0].regrown = true;
    endWave(run); nextWave(run);
    expect(run.nodes[0].regrown).toBe(false);
    // Without it, one break and the node is gone.
    const bare = quietRun(); disarm(bare); nodeHere(bare); ticksToBreak(bare);
    expect(bare.nodes[0].alive).toBe(false);
  });

  it('Company draft: weapons at the bench need no raws', () => {
    const rawsAsked = (kit: ItemSpec[]): { weapon: number; item: number } => {
      const total = { weapon: 0, item: 0 };
      for (let seed = 1; seed <= 6; seed++) {
        const run = quietRun(kit, 'greenhorn', seed);
        run.player.scrip = 10_000;
        endWave(run);
        for (let k = 0; k < 6; k++) {
          for (const o of run.bench.offers) total[o.kind] += o.raws.timber + o.raws.ore + o.raws.hide;
          reroll(run);
        }
      }
      return total;
    };
    const bare = rawsAsked([]), held = rawsAsked([relic('companydraft')]);
    expect(bare.weapon).toBeGreaterThan(10);
    expect(held.weapon).toBe(0);
    // Items are not weapons: they cost what they always cost.
    expect(held.item).toBe(bare.item);
    expect(held.item).toBeGreaterThan(10);
    // Nor is a fusion a bench recipe: it still costs raws.
    const run = quietRun([relic('companydraft')]);
    run.player.items.push(BASE_ITEM.whetstone, BASE_ITEM.tallow); run.player.itemKit.push(false, false);
    endWave(run);
    const q = fuseCost(run, 1, 2);
    expect(q.raws.timber + q.raws.ore + q.raws.hide).toBeGreaterThan(0);
  });

  it('Brandy flask: once a run, a killing blow leaves you standing at half health', () => {
    const run = quietRun([relic('brandyflask')]);
    disarm(run);
    run.player.base[ST.maxHp] = 40; rebuild(run); run.player.hp = 3;
    expect(hurtPlayer(run, 500, 0, -1, 0)).toBe(true);
    expect(run.phase).toBe('wave');
    expect(run.player.hp).toBe(Math.ceil(run.player.maxHp / 2));
    expect(run.player.secondLifeUsed).toBe(true);
    expect(run.player.iframes).toBeGreaterThan(0.5);
    // Once a run, not once a wave: it is still spent after the bench.
    endWave(run); nextWave(run);
    expect(run.player.secondLifeUsed).toBe(true);
    run.player.iframes = 0;
    hurtPlayer(run, 5000, 0, -1, 0);
    expect(run.phase).toBe('over');
    expect(run.won).toBe(false);
    // Without it the first blow ends the run.
    const bare = quietRun(); disarm(bare);
    hurtPlayer(bare, 5000, 0, -1, 0);
    expect(bare.phase).toBe('over');
    // A second wind item is used first, so the flask is kept for when it is needed.
    const both = quietRun([relic('brandyflask'), testItem('secondWind', 3)]); disarm(both);
    hurtPlayer(both, 5000, 0, -1, 0);
    expect(both.player.secondWindUsed).toBe(true);
    expect(both.player.secondLifeUsed).toBe(false);
  });

  it('Order book: the bench makes a fifth offer', () => {
    const run = quietRun([relic('orderbook')]);
    const bare = quietRun();
    run.player.scrip = bare.player.scrip = 5000;
    run.player.raws = { timber: 99, ore: 99, hide: 99 }; bare.player.raws = { timber: 99, ore: 99, hide: 99 };
    endWave(run); endWave(bare);
    expect(bare.bench.offers).toHaveLength(4);
    expect(run.bench.offers).toHaveLength(5);
    expect(run.bench.offers.every((o) => !o.sold && o.id !== '' && o.price > 0)).toBe(true);
    // The fifth is a real offer: it can be locked, bought, and it comes back on a reroll.
    expect(toggleLock(run, 4)).toBe(true);
    expect(toggleLock(run, 4)).toBe(true);
    const held = run.player.items.length + run.player.weapons.length;
    expect(buy(run, 4)).toBe(true);
    expect(run.player.items.length + run.player.weapons.length).toBeGreaterThanOrEqual(held);
    expect(run.bench.offers[4].sold).toBe(true);
    expect(reroll(run)).toBe(true);
    expect(run.bench.offers).toHaveLength(5);
    expect(run.bench.offers[4].sold).toBe(false);
    // Buying all five, not four, earns the free reroll.
    for (let i = 0; i < 4; i++) buy(run, i);
    if (run.bench.offers.slice(0, 4).every((o) => o.sold)) {
      expect(run.bench.freeReroll).toBe(false);
      buy(run, 4);
      expect(run.bench.freeReroll).toBe(run.bench.offers[4].sold);
    }
    // It is there at every bench.
    nextWave(run); run.waveSeconds = 0; ticks(run, 1);
    expect(run.phase).toBe('bench');
    expect(run.bench.offers).toHaveLength(5);
  });

  it('Pack saddle: carry home one more item', () => {
    const run = quietRun([relic('packsaddle')]);
    const bare = quietRun();
    for (const waves of [0, 3, 4, 8, 12]) {
      run.wavesCleared = bare.wavesCleared = waves;
      expect(carryLimit(run)).toBe(carryLimit(bare) + 1);
      expect(carryLimit(bare)).toBe(Math.floor(waves / 4));
    }
  });

  it('Pack saddle and Oilskin wrap leave the fight itself untouched', () => {
    // Same seed, same bot: the run plays out tick for tick as it does with no kit at all.
    const bare = playRun({ seed: 777, character: 'greenhorn', waves: 8 });
    for (const id of ['packsaddle', 'oilskinwrap']) {
      const held = playRun({ seed: 777, character: 'greenhorn', waves: 8, kit: [relic(id)] });
      expect(held.tick, id).toBe(bare.tick);
      expect(held.wavesCleared, id).toBe(bare.wavesCleared);
      expect(held.kills, id).toBe(bare.kills);
      expect(held.scripEarned, id).toBe(bare.scripEarned);
      expect(held.player.hp, id).toBe(bare.player.hp);
    }
  }, 300_000);

  it('Oilskin wrap: changes nothing inside the run (its rule is kept by the town)', () => {
    const run = quietRun([relic('oilskinwrap')]);
    const bare = quietRun();
    rebuild(run);
    expect(Array.from(run.player.stat)).toEqual(Array.from(bare.player.stat));
    expect(run.player.sp[SP.keepCharge]).toBe(1);
    expect(carryLimit(run)).toBe(carryLimit(bare));
    expect(weaponSlots(run)).toBe(weaponSlots(bare));
  });
});
