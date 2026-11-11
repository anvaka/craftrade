import { describe, expect, it } from 'vitest';
import { BASE_ITEM } from '../src/shared/content/items.ts';
import { basePrice, fusionBudget, itemTier } from '../src/shared/item.ts';
import { FUSE_RAW_COST, RAWS } from '../src/shared/vocab.ts';
import {
  addWeapon, applyFusion, buy, buyBlock, fuseCost, itemPrice, pickUpgrade, priceAt, reroll, rerollCost, scrapItem,
  scrapValueWeapon, scrapWeapon, sendMule, toggleLock, weaponPrice,
} from '../src/sim/bench.ts';
import { standInFusion } from '../src/sim/bot.ts';
import { gainScrip, rebuild, ST } from '../src/sim/core.ts';
import { WEAPONS, WEAPON_INDEX } from '../src/sim/data/weapons.ts';
import { carryLimit, createRun, nextWave, setCarry, step, summary } from '../src/sim/run.ts';
import type { Run } from '../src/sim/types.ts';
import { endWave } from '../src/sim/world.ts';
import { hush, quietRun } from './sim-helpers.ts';

/** Skip to the bench after the current wave. */
function toBench(run: Run): Run {
  hush(run);
  endWave(run);
  return run;
}
function benchAt(n: number, seed = 3, character: Parameters<typeof quietRun>[1] = 'greenhorn'): Run {
  const run = quietRun([], character, seed);
  toBench(run);
  for (let i = 1; i < n; i++) { nextWave(run); toBench(run); }
  return run;
}
const rich = (run: Run) => { run.player.scrip = 100000; run.player.raws = { timber: 500, ore: 500, hide: 500 }; };

describe('prices', () => {
  it('follow floor((base + wave + 0.1 x base x wave) x modifiers)', () => {
    expect(priceAt(70, 1)).toBe(78);
    expect(priceAt(70, 20)).toBe(230);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const run = quietRun([], 'greenhorn', seed);
      for (let b = 1; b <= 11; b++) {
        toBench(run);
        expect(run.bench.index).toBe(b);
        for (let r = 0; r < 3; r++) {
          for (const o of run.bench.offers) {
            const base = o.kind === 'weapon' ? WEAPONS[WEAPON_INDEX[o.id]].price[o.tier - 1] : basePrice(BASE_ITEM[o.id]);
            expect(o.price).toBe(Math.floor(base + b + 0.1 * base * b));
            expect(o.price).toBeGreaterThan(0);
            for (const raw of RAWS) expect(o.raws[raw]).toBeGreaterThanOrEqual(0);
          }
          run.player.scrip = 9999;
          reroll(run);
        }
        nextWave(run);
      }
    }
  });

  it('Sawyer pays half for hatchets and Smith needs 1 less ore', () => {
    const saw = benchAt(3, 1, 'sawyer'), green = benchAt(3, 1);
    expect(weaponPrice(saw, 'hatchet', 2)).toBe(Math.floor((24 + 3 + 0.1 * 24 * 3) * 0.5));
    expect(weaponPrice(green, 'hatchet', 2)).toBe(Math.floor(24 + 3 + 0.1 * 24 * 3));
    expect(weaponPrice(saw, 'bow', 1)).toBe(weaponPrice(green, 'bow', 1));
    let seen = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const smith = benchAt(2, seed, 'smith'), other = benchAt(2, seed);
      for (let i = 0; i < 4; i++) {
        const a = smith.bench.offers[i], b = other.bench.offers[i];
        if (a.id !== b.id || a.tier !== b.tier) continue;
        expect(a.raws.ore).toBe(Math.max(0, b.raws.ore - 1));
        if (b.raws.ore > 0) seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('reroll starts at floor(0.5 x wave) + 1, rises by max(1, floor(0.4 x wave)), resets each bench', () => {
    const run = benchAt(5);
    run.player.scrip = 1000;
    expect(rerollCost(run)).toBe(3);
    expect(reroll(run)).toBe(true);
    expect(run.player.scrip).toBe(997);
    expect(rerollCost(run)).toBe(5);
    reroll(run);
    expect(rerollCost(run)).toBe(7);
    nextWave(run); toBench(run);
    expect(rerollCost(run)).toBe(Math.floor(0.5 * 6) + 1);
    run.player.scrip = 0;
    expect(reroll(run)).toBe(false);
  });
});

describe('offers', () => {
  it('first two benches show 2 weapons and 2 items; later ones mix', () => {
    let weapons = 0, total = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const run = quietRun([], 'greenhorn', seed);
      for (let b = 1; b <= 6; b++) {
        toBench(run);
        const kinds = run.bench.offers.map((o) => o.kind);
        if (b <= 2) expect(kinds).toEqual(['weapon', 'weapon', 'item', 'item']);
        else { total += 4; weapons += kinds.filter((k) => k === 'weapon').length; }
        nextWave(run);
      }
    }
    expect(weapons / total).toBeGreaterThan(0.25);
    expect(weapons / total).toBeLessThan(0.45);
  });

  it('rarity gates: tier 2 from bench 2, tier 3 from bench 4, tier 4 from bench 8', () => {
    const maxTier = new Array(12).fill(0);
    for (let seed = 1; seed <= 40; seed++) {
      const run = quietRun([], 'greenhorn', seed);
      run.player.weapons.length = 0; // no held weapon, so no same-weapon tier carry-over
      for (let b = 1; b <= 11; b++) {
        toBench(run);
        for (let r = 0; r < 4; r++) {
          for (const o of run.bench.offers) maxTier[b] = Math.max(maxTier[b], o.tier);
          run.player.scrip = 9999; reroll(run);
        }
        run.player.scrip = 0;
        nextWave(run);
      }
    }
    expect(maxTier[1]).toBe(1);
    expect(maxTier[2]).toBe(2);
    expect(maxTier[3]).toBe(2);
    expect(maxTier[4]).toBe(3);
    expect(maxTier[7]).toBe(3);
    expect(Math.max(...maxTier.slice(8))).toBe(4);
  });

  it('weapon offers lean toward what is held', () => {
    const count = (held: boolean) => {
      let same = 0, n = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const run = quietRun([], 'greenhorn', seed, 'maul');
        if (!held) run.player.weapons.length = 0;
        for (let b = 1; b <= 4; b++) {
          toBench(run);
          for (const o of run.bench.offers) if (o.kind === 'weapon') { n++; if (o.id === 'maul') same++; }
          nextWave(run);
        }
      }
      return same / n;
    };
    expect(count(true)).toBeGreaterThan(count(false) + 0.1);
  });

  it('a locked offer survives rerolls and the next bench with its price frozen', () => {
    const run = benchAt(3);
    const o = run.bench.offers[1];
    const id = o.id, price = o.price;
    expect(toggleLock(run, 1)).toBe(true);
    run.player.scrip = 500;
    reroll(run); reroll(run);
    expect(run.bench.offers[1].id).toBe(id);
    nextWave(run); toBench(run);
    expect(run.bench.offers[1].id).toBe(id);
    expect(run.bench.offers[1].price).toBe(price);
    expect(run.bench.offers[1].locked).toBe(true);
    toggleLock(run, 1);
    run.player.scrip = 500;
    reroll(run);
    expect(run.bench.offers[1].locked).toBe(false);
  });

  it('buying charges scrip and raws, refuses what cannot be paid, and all four bought gives one free reroll', () => {
    const run = benchAt(2);
    run.player.scrip = 0;
    expect(buy(run, 0)).toBe(false);
    expect(buyBlock(run, 0)).toBe('Not enough scrip.');
    rich(run);
    const before = { scrip: run.player.scrip, raws: { ...run.player.raws } };
    const o = run.bench.offers[2];
    const cost = { price: o.price, raws: { ...o.raws } };
    expect(buy(run, 2)).toBe(true);
    expect(run.player.scrip).toBe(before.scrip - cost.price);
    for (const r of RAWS) expect(run.player.raws[r]).toBe(before.raws[r] - cost.raws[r]);
    expect(run.player.items.length).toBe(1);
    expect(buy(run, 2)).toBe(false);
    expect(run.bench.freeReroll).toBe(false);
    for (const i of [0, 1, 3]) expect(buy(run, i)).toBe(true);
    expect(run.bench.freeReroll).toBe(true);
    expect(rerollCost(run)).toBe(0);
    const scrip = run.player.scrip;
    expect(reroll(run)).toBe(true);
    expect(run.player.scrip).toBe(scrip);
    expect(run.bench.rerolls).toBe(0);
    expect(rerollCost(run)).toBeGreaterThan(0);
    expect(run.bench.offers.every((x) => !x.sold)).toBe(true);
  });
});

describe('weapons at the bench', () => {
  it('two of the same weapon and tier combine, and chains carry on up to tier 4', () => {
    const run = benchAt(1, 3);
    const p = run.player;
    p.weapons.length = 0;
    const bow = WEAPON_INDEX.bow;
    addWeapon(run, bow, 1);
    addWeapon(run, bow, 1);
    expect(p.weapons.map((w) => `${w.id}${w.tier}`)).toEqual(['bow2']);
    addWeapon(run, bow, 1); addWeapon(run, bow, 1);
    expect(p.weapons.map((w) => `${w.id}${w.tier}`)).toEqual(['bow3']);
    addWeapon(run, bow, 3);
    addWeapon(run, bow, 4);
    expect(p.weapons.map((w) => w.tier)).toEqual([4, 4]);
  });

  it('six slots (four for Tinker); a full hand can still take a twin', () => {
    for (const [ch, slots] of [['greenhorn', 6], ['tinker', 4]] as const) {
      const run = benchAt(1, 3, ch);
      run.player.weapons.length = 0;
      const ids = ['bow', 'maul', 'pike', 'axe', 'brand', 'bola', 'musket'];
      let held = 0;
      for (const id of ids) if (addWeapon(run, WEAPON_INDEX[id], 1)) held++;
      expect(held).toBe(slots);
      expect(addWeapon(run, WEAPON_INDEX.buckler, 1)).toBe(false);
      expect(addWeapon(run, WEAPON_INDEX.bow, 1)).toBe(true);
      expect(run.player.weapons.length).toBe(slots);
      expect(run.player.weapons.some((w) => w.id === 'bow' && w.tier === 2)).toBe(true);
    }
  });

  it('scrap pays 25% of the current price; the last weapon stays', () => {
    const run = benchAt(4);
    addWeapon(run, WEAPON_INDEX.musket, 2);
    const v = scrapValueWeapon(run, 1);
    expect(v).toBe(Math.floor(weaponPrice(run, 'musket', 2, 4) * 0.25));
    const scrip = run.player.scrip;
    expect(scrapWeapon(run, 1)).toBe(true);
    expect(run.player.scrip).toBe(scrip + v);
    expect(scrapWeapon(run, 0)).toBe(false);
    run.player.items.push(BASE_ITEM.anvil); run.player.itemKit.push(false); rebuild(run);
    const armor = run.player.stat[ST.armor];
    expect(armor).toBeGreaterThan(0);
    const s2 = run.player.scrip;
    expect(scrapItem(run, 0)).toBe(true);
    expect(run.player.scrip).toBe(s2 + Math.floor(itemPrice(run, BASE_ITEM.anvil, 4) * 0.25));
    expect(run.player.stat[ST.armor]).toBe(0);
  });

  it('class sets grant their bonus at 2, 4 and 6 held', () => {
    const run = benchAt(1);
    const p = run.player;
    p.weapons.length = 0; rebuild(run);
    const reach = () => p.stat[ST.reach];
    addWeapon(run, WEAPON_INDEX.sling, 1);
    expect(reach()).toBe(0);
    addWeapon(run, WEAPON_INDEX.bow, 1);
    expect(reach()).toBe(15);
    addWeapon(run, WEAPON_INDEX.musket, 1); addWeapon(run, WEAPON_INDEX.bola, 1);
    expect(reach()).toBe(30);
    addWeapon(run, WEAPON_INDEX.axe, 1); addWeapon(run, WEAPON_INDEX.sling, 2);
    expect(reach()).toBe(50);
  });
});

describe('levels and upgrade picks', () => {
  it('XP to next level is (level + 3)^2, each level gives +1 Max HP and one pick of 4', () => {
    const run = quietRun();
    const p = run.player;
    expect(p.xpNext).toBe(16);
    const hp = p.maxHp;
    gainScrip(run, 16 + 25 + 3);
    expect(p.level).toBe(3);
    expect(p.xp).toBe(3);
    expect(p.xpNext).toBe(36);
    toBench(run);
    expect(p.maxHp).toBe(hp + 2);
    expect(run.bench.picks).toBe(2);
    expect(run.bench.choices.length).toBe(4);
    expect(new Set(run.bench.choices.map((c) => c.stat)).size).toBe(4);
    const c = run.bench.choices[0];
    const before = p.stat[ST[c.stat]];
    expect(pickUpgrade(run, 0)).toBe(true);
    expect(p.stat[ST[c.stat]]).toBe(before + c.value);
    expect(run.bench.picks).toBe(1);
    expect(pickUpgrade(run, 1)).toBe(true);
    expect(run.bench.choices.length).toBe(0);
    expect(pickUpgrade(run, 0)).toBe(false);
  });
});

describe('scrip left on the ground', () => {
  it('is banked at wave end and pays double on later pickups until repaid', () => {
    const run = quietRun();
    const p = run.player;
    const k = run.pickups[0];
    k.alive = true; k.kind = 0; k.value = 5; k.x = k.px = p.x + 600; k.y = k.py = p.y; k.vx = k.vy = 0; k.pulled = false;
    endWave(run);
    expect(p.bank).toBe(5);
    expect(p.scrip).toBe(0);
    nextWave(run);
    gainScrip(run, 3);
    expect(p.scrip).toBe(6);
    expect(p.bank).toBe(2);
    gainScrip(run, 4);
    expect(p.scrip).toBe(12);
    expect(p.bank).toBe(0);
    gainScrip(run, 4);
    expect(p.scrip).toBe(16);
  });
});

describe('fusion', () => {
  const give = (run: Run, ...ids: string[]) => { for (const id of ids) { run.player.items.push(BASE_ITEM[id]); run.player.itemKit.push(false); } rebuild(run); };

  it('charges raws by the result tier, swaps the items and records [a, b, out]', () => {
    const run = benchAt(2);
    give(run, 'whetstone', 'saltpork', 'pitch');
    run.player.raws = { timber: 10, ore: 10, hide: 10 };
    const q = fuseCost(run, 0, 1);
    expect(q.block).toBeNull();
    expect(q.budget).toBe(fusionBudget(BASE_ITEM.whetstone, BASE_ITEM.saltpork));
    const result = standInFusion(BASE_ITEM.whetstone, BASE_ITEM.saltpork, q.budget);
    expect(applyFusion(run, 0, 1, result)).toBeNull();
    const cost = FUSE_RAW_COST[itemTier(result)];
    expect(run.player.raws).toEqual({ timber: 10 - cost.timber, ore: 10 - cost.ore, hide: 10 - cost.hide });
    expect(run.player.items.map((i) => i.id)).toEqual(['pitch', result.id]);
    expect(run.fusions).toEqual([['whetstone', 'saltpork', result.id]]);
    expect(summary(run).fusions).toEqual([['whetstone', 'saltpork', result.id]]);
    expect(run.player.stat[ST.crit]).toBeGreaterThan(0);
  });

  it('refuses the same item twice, a tier 4 input, a bad result, or empty pockets, and changes nothing', () => {
    const run = benchAt(2);
    give(run, 'whetstone', 'whetstone', 'anvil', 'saltpork');
    run.player.raws = { timber: 10, ore: 10, hide: 10 };
    const snapshot = () => JSON.stringify([run.player.items.map((i) => i.id), run.player.raws, run.fusions]);
    const s0 = snapshot();
    const ok = standInFusion(BASE_ITEM.whetstone, BASE_ITEM.saltpork, fusionBudget(BASE_ITEM.whetstone, BASE_ITEM.saltpork));
    expect(fuseCost(run, 0, 1).block).toMatch(/same item/);
    expect(applyFusion(run, 0, 1, ok)).toMatch(/same item/);
    expect(fuseCost(run, 2, 3).block).toMatch(/tier 4/);
    expect(applyFusion(run, 2, 3, ok)).toMatch(/tier 4/);
    expect(applyFusion(run, 0, 0, ok)).not.toBeNull();
    expect(applyFusion(run, 0, 9, ok)).not.toBeNull();
    expect(applyFusion(run, 0, 3, { ...ok, effects: [{ p: 'damage', l: 5 }, { p: 'rate', l: 5 }, { p: 'crit', l: 5 }] })).toBe('Over budget.');
    expect(applyFusion(run, 0, 3, { ...ok, effects: [{ p: 'flight', l: 1 }] })).toBe('Bad effect.');
    expect(applyFusion(run, 0, 3, { ...ok, effects: [{ p: 'burn', l: 1, neg: true }, { p: 'crit', l: 1 }] })).toBe('Bad drawback.');
    run.player.raws = { timber: 0, ore: 0, hide: 0 };
    expect(fuseCost(run, 0, 3).block).toMatch(/Not enough/);
    expect(applyFusion(run, 0, 3, ok)).toMatch(/Not enough/);
    run.player.raws = { timber: 10, ore: 10, hide: 10 };
    expect(snapshot()).toBe(s0);
    nextWave(run);
    expect(applyFusion(run, 0, 3, ok)).not.toBeNull();
  });

  it('Tinker pays no raws', () => {
    const run = benchAt(2, 3, 'tinker');
    give(run, 'whetstone', 'saltpork');
    run.player.raws = { timber: 0, ore: 0, hide: 0 };
    const q = fuseCost(run, 0, 1);
    expect(q.block).toBeNull();
    expect(q.raws).toEqual({ timber: 0, ore: 0, hide: 0 });
    expect(applyFusion(run, 0, 1, standInFusion(BASE_ITEM.whetstone, BASE_ITEM.saltpork, q.budget))).toBeNull();
    expect(run.player.items.length).toBe(1);
  });
});

describe('mule, kit and carrying home', () => {
  it('the mule leaves only after waves 4 and 8 and its load is out of the run', () => {
    const run = quietRun();
    for (let b = 1; b <= 9; b++) {
      toBench(run);
      run.player.raws = { timber: 6, ore: 4, hide: 2 };
      const ok = sendMule(run, { timber: 5, ore: 99 });
      expect(ok).toBe(b === 4 || b === 8);
      expect(run.bench.mule).toBe(b === 4 || b === 8);
      if (ok) expect(run.player.raws).toEqual({ timber: 1, ore: 0, hide: 2 });
      else expect(run.player.raws).toEqual({ timber: 6, ore: 4, hide: 2 });
      nextWave(run);
    }
    expect(run.mule).toEqual({ timber: 10, ore: 8, hide: 0 });
    expect(summary(run).mule).toEqual({ timber: 10, ore: 8, hide: 0 });
  });

  it('kit items apply from the first tick and cannot be carried home; carry is floor(waves cleared / 4)', () => {
    const run = createRun({ seed: 9, character: 'greenhorn', kit: [BASE_ITEM.saltpork, BASE_ITEM.whetstone, BASE_ITEM.anvil] });
    expect(run.player.items.length).toBe(2);
    expect(run.player.maxHp).toBe(16);
    expect(run.player.hp).toBe(16);
    for (let b = 1; b <= 5; b++) { toBench(run); nextWave(run); }
    run.player.items.push(BASE_ITEM.pitch, BASE_ITEM.burrs); run.player.itemKit.push(false, false);
    expect(setCarry(run, ['pitch'])).toBe(false);
    hush(run);
    run.player.hp = 0.5; run.player.iframes = 0;
    run.enemies.forEach((e) => { e.alive = false; });
    // die
    run.phase = 'over'; run.won = false; run.wavesCleared = 5;
    expect(carryLimit(run)).toBe(1);
    expect(setCarry(run, ['pitch', 'burrs'])).toBe(false);
    expect(setCarry(run, ['saltpork'])).toBe(false);
    expect(setCarry(run, ['tallow'])).toBe(false);
    expect(setCarry(run, ['burrs'])).toBe(true);
    expect(summary(run).carry).toEqual(['burrs']);
  });

  it('the summary carries every RunEndReq field except runId', () => {
    const run = quietRun();
    step(run, { mx: 1, my: 0 });
    const s = summary(run);
    for (const k of ['wavesCleared', 'won', 'scripEarned', 'scripHeld', 'level', 'raws', 'mule', 'carry', 'kills', 'fusions']) expect(s).toHaveProperty(k);
    expect(s.raws).toEqual({ timber: 0, ore: 0, hide: 0 });
  });
});
