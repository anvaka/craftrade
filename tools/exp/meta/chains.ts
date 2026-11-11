// Experiment 3c: cheapest road to the point cap, by random search over fusion orders (procedural provider).
import { ProceduralProvider, validatePick } from '../../../server/provider.ts';
import { BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { fusedItemId, fusionBlock, fusionBudget, itemPoints, itemTier, recipeKey, type ItemSpec } from '../../../src/shared/item.ts';
import { FUSE_RAW_COST } from '../../../src/shared/vocab.ts';
import { table } from './lib.ts';
const prov = new ProceduralProvider(); const cache = new Map<string, ItemSpec>();
const pts = (i: ItemSpec) => itemPoints(i.effects);
async function fuse(a: ItemSpec, b: ItemSpec) {
  const [x, y] = a.id < b.id ? [a, b] : [b, a]; const key = recipeKey(x.id, y.id);
  if (cache.has(key)) return cache.get(key)!;
  const budget = fusionBudget(x, y); const v = validatePick(await prov.propose(x, y, budget, key), budget, key)!;
  const o = { id: fusedItemId(v.effects), name: v.names[0] ?? 'x', glyph: v.glyph, tags: v.tags, effects: v.effects } as ItemSpec; cache.set(key, o); return o;
}
let s = 99; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const T = (t: number) => BASE_ITEMS.filter((i) => itemTier(i) === t);
async function search(tiers: number[], tries = 400) {
  let best = { pts: 0, steps: '', raws: 0, scrip: 0 };
  for (let k = 0; k < tries; k++) {
    let pool: ItemSpec[] = []; const used = new Set<string>();
    for (const t of tiers) { const c = T(t).filter((i) => !used.has(i.id)); const it = c[Math.floor(rnd() * c.length)]; used.add(it.id); pool.push(it); }
    const scrip = pool.reduce((n, i) => n + (i.price ?? 0), 0);
    const steps: string[] = []; let raws = 0;
    while (pool.length > 1) {
      const i = Math.floor(rnd() * pool.length); let j = Math.floor(rnd() * (pool.length - 1)); if (j >= i) j++;
      const a = pool[i], b = pool[j];
      if (fusionBlock(a, b)) break;
      const o = await fuse(a, b); const c = FUSE_RAW_COST[itemTier(o)]; raws += c.timber + c.ore + c.hide;
      steps.push(`${pts(a)}+${pts(b)}>${pts(o)}`); pool = pool.filter((_, x) => x !== i && x !== j); pool.push(o);
    }
    const top = Math.max(...pool.map(pts));
    if (pool.length === 1 && top > best.pts) best = { pts: top, steps: steps.join(' '), raws, scrip };
  }
  return best;
}
const rows: any[] = [];
for (const [label, tiers] of [['2 x tier 3', [3, 3]], ['2 x tier 3 + 2 x tier 1', [3, 3, 1, 1]], ['3 x tier 3 + 1 x tier 1', [3, 3, 3, 1]], ['4 x tier 2', [2, 2, 2, 2]], ['5 x tier 2', [2, 2, 2, 2, 2]], ['6 x tier 2', [2, 2, 2, 2, 2, 2]], ['4 x tier 2 + 2 x tier 1', [2, 2, 2, 2, 1, 1]], ['8 x tier 1', [1, 1, 1, 1, 1, 1, 1, 1]], ['12 x tier 1', new Array(12).fill(1)]] as [string, number[]][]) {
  const b = await search(tiers);
  rows.push({ inputs: label, 'best result (pts)': b.pts, 'bench scrip for inputs (wave 0 prices)': b.scrip, 'raws if fused in a run': b.raws, 'raws in town': 0, steps: b.steps });
}
console.log(table(rows));
