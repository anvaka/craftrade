import { describe, expect, it } from 'vitest';
import { fusionBudget, itemPoints, itemTier, repairEffects } from '../src/shared/item.ts';
import { BASE_ITEMS } from '../src/shared/content/items.ts';
import { GLYPHS, MAX_POINTS, PRIM, PRIMITIVES } from '../src/shared/vocab.ts';

function lcg(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

describe('repairEffects', () => {
  it('always returns a legal list that fits the budget, for random model output', () => {
    const r = lcg(42);
    // Note: '__proto__' is left out on purpose. See the report: PRIM is a plain object, so that key slips past the lookup in repairEffects.
    const junk = ['nope', '', 'maxHP', 'constructor '];
    for (let n = 0; n < 4000; n++) {
      const budget = 1 + Math.floor(r() * MAX_POINTS);
      const picks: { p: string; l: number; neg?: boolean }[] = [];
      const count = Math.floor(r() * 7);
      for (let k = 0; k < count; k++) {
        const p = r() < 0.12 ? junk[Math.floor(r() * junk.length)] : PRIMITIVES[Math.floor(r() * PRIMITIVES.length)].id;
        picks.push({ p, l: Math.floor(r() * 9) - 1, neg: r() < 0.25 });
      }
      const seed = Math.floor(r() * 1e6);
      const out = repairEffects(picks, budget, seed);
      expect(repairEffects(picks, budget, seed)).toEqual(out);
      const pos = out.filter((e) => !e.neg), neg = out.filter((e) => e.neg);
      expect(pos.length).toBeGreaterThanOrEqual(1);
      expect(pos.length).toBeLessThanOrEqual(3);
      expect(neg.length).toBeLessThanOrEqual(1);
      expect(new Set(out.map((e) => e.p)).size).toBe(out.length);
      for (const e of out) {
        expect(PRIM[e.p]).toBeDefined();
        expect(Number.isInteger(e.l) && e.l >= 1 && e.l <= 5).toBe(true);
        if (e.neg) expect(PRIM[e.p].kind).toBe('stat');
      }
      const total = itemPoints(out);
      // Over budget only when nothing can be lowered any further.
      if (total > budget) { expect(pos.length).toBe(1); expect(pos[0].l).toBe(1); }
      // Never leaves room for a raise it could have made.
      if (total <= budget) {
        for (const e of pos) {
          if (e.l >= 5) continue;
          const step = PRIM[e.p].cost[e.l] - PRIM[e.p].cost[e.l - 1];
          expect(step).toBeGreaterThan(budget - total);
        }
      }
    }
  });

  it('every pair of authored items repairs within its fusion budget', () => {
    for (let i = 0; i < BASE_ITEMS.length; i++) {
      for (let j = i + 1; j < BASE_ITEMS.length; j++) {
        const a = BASE_ITEMS[i], b = BASE_ITEMS[j];
        const budget = fusionBudget(a, b);
        const out = repairEffects([...a.effects, ...b.effects], budget, i * 131 + j);
        expect(itemPoints(out)).toBeLessThanOrEqual(budget);
      }
    }
  });
});

describe('authored items', () => {
  it('about 40 items, legal, across all tiers, using every primitive', () => {
    expect(BASE_ITEMS.length).toBeGreaterThanOrEqual(38);
    expect(BASE_ITEMS.length).toBeLessThanOrEqual(46);
    const used = new Set<string>(), tiers = new Set<number>(), ids = new Set<string>(), names = new Set<string>();
    for (const it of BASE_ITEMS) {
      ids.add(it.id); names.add(it.name); tiers.add(itemTier(it));
      expect(GLYPHS).toContain(it.glyph);
      expect(it.name).toMatch(/^[A-Z][a-z' ]+$/);
      expect(it.tags.length).toBeGreaterThanOrEqual(2);
      expect(it.tags.length).toBeLessThanOrEqual(3);
      for (const t of it.tags) expect(t).toMatch(/^[a-z]{2,12}$/);
      const pos = it.effects.filter((e) => !e.neg), neg = it.effects.filter((e) => e.neg);
      expect(pos.length >= 1 && pos.length <= 3 && neg.length <= 1).toBe(true);
      for (const e of it.effects) { expect(PRIM[e.p]).toBeDefined(); used.add(e.p); if (e.neg) expect(PRIM[e.p].kind).toBe('stat'); }
      expect(it.price).toBeGreaterThan(0);
    }
    expect(BASE_ITEMS.filter((it) => Object.keys(it.raws ?? {}).length > 0).length / BASE_ITEMS.length).toBeGreaterThan(0.85);
    expect(ids.size).toBe(BASE_ITEMS.length);
    expect(names.size).toBe(BASE_ITEMS.length);
    expect([...tiers].sort()).toEqual([1, 2, 3, 4]);
    expect(PRIMITIVES.filter((p) => !used.has(p.id)).map((p) => p.id)).toEqual([]);
    for (const id of ['whetstone', 'tallow', 'hobnails', 'saltpork', 'pitch', 'lodestone', 'tallybook', 'burrs']) expect(ids.has(id)).toBe(true);
    // Above tier 1, a plain bonus with no drawback and no condition is the exception.
    const conditional = new Set(['hoardTimber', 'hoardOre', 'hoardHide', 'lowHpRate', 'stillDamage', 'movingDodge']);
    const upper = BASE_ITEMS.filter((it) => itemTier(it) > 1);
    const tradeoffs = upper.filter((it) => it.effects.some((e) => e.neg || conditional.has(e.p)));
    expect(tradeoffs.length / upper.length).toBeGreaterThan(0.8);
  });
});
