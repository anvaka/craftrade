// Experiment 3: fusion as content, with the procedural provider (the same propose + validatePick + repair path the server runs).
import { writeFileSync } from 'node:fs';
import { ProceduralProvider, validatePick } from '../../../server/provider.ts';
import { BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { effectPoints, fusedItemId, fusionBlock, fusionBudget, itemPoints, itemTier, recipeKey, type ItemSpec } from '../../../src/shared/item.ts';
import { mean, median, table } from './lib.ts';

const prov = new ProceduralProvider();
const sig = new AbortController().signal;
const known = new Map<string, ItemSpec>(BASE_ITEMS.map((i) => [i.id, i]));
async function fuse(a: ItemSpec, b: ItemSpec): Promise<ItemSpec> {
  const [x, y] = a.id < b.id ? [a, b] : [b, a];
  const key = recipeKey(x.id, y.id), budget = fusionBudget(x, y);
  const v = validatePick(await prov.propose(x, y, budget, key), budget, key)!;
  const id = fusedItemId(v.effects);
  return known.get(id) ?? { id, name: v.names[0] ?? id, glyph: v.glyph, tags: v.tags, effects: v.effects };
}
const pts = (i: ItemSpec) => itemPoints(i.effects);
const res: any = {};

// --- 1. Size of the space, generation by generation.
let all: ItemSpec[] = [...BASE_ITEMS];
let frontier: ItemSpec[] = all.filter((i) => itemTier(i) < 4);
const gens: any[] = [{ gen: 0, pairsTried: 0, newItems: 43, fusable: frontier.length, tier4: 4, meanPts: mean(all.map(pts)).toFixed(1), realizedOverBudget: '-' }];
const gen1: ItemSpec[] = [];
let evals = 0;
const CAP = 1_500_000;
let old: ItemSpec[] = [];
for (let g = 1; g <= 4 && evals < CAP; g++) {
  const fresh: ItemSpec[] = [];
  let pairs = 0, ratio = 0, sampled = false;
  const tryPair = async (a: ItemSpec, b: ItemSpec) => {
    if (fusionBlock(a, b)) return;
    pairs++; evals++;
    const out = await fuse(a, b);
    ratio += pts(out) / fusionBudget(a, b);
    if (!known.has(out.id)) { known.set(out.id, out); fresh.push(out); }
  };
  // New pairs this generation: frontier x frontier, and frontier x older fusable items.
  const total = frontier.length * (frontier.length - 1) / 2 + frontier.length * old.length;
  const p = Math.min(1, 300_000 / total);
  sampled = p < 1;
  let s = 987654321 + g;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < frontier.length; i++) {
    for (let j = i + 1; j < frontier.length; j++) if (p === 1 || rnd() < p) await tryPair(frontier[i], frontier[j]);
    for (const o of old) if (p === 1 || rnd() < p) await tryPair(frontier[i], o);
  }
  if (g === 1) gen1.push(...fresh);
  gens.push({
    gen: g, pairsTotal: total, pairsTried: pairs + (sampled ? ' (sample)' : ''), newItems: fresh.length,
    newPerPair: (fresh.length / pairs).toFixed(3),
    fusable: fresh.filter((i) => itemTier(i) < 4).length, tier4: fresh.filter((i) => itemTier(i) === 4).length,
    meanPts: mean(fresh.map(pts)).toFixed(1), realizedOverBudget: (ratio / pairs).toFixed(3),
  });
  old = [...old, ...frontier];
  frontier = fresh.filter((i) => itemTier(i) < 4);
  all = [...all, ...fresh];
  if (!frontier.length) break;
}
res.gens = gens;
console.log('## generations\n' + table(gens));

// --- 2. Power creep: fused generation 1 against authored items of the same tier.
const byTier = (items: ItemSpec[], t: number) => items.filter((i) => itemTier(i) === t);
const dominates = (f: ItemSpec, a: ItemSpec) => {
  // f is strictly better than a: every positive effect of a is matched at >= level, f's drawback is no worse, and f has more points.
  for (const e of a.effects.filter((e) => !e.neg)) { const m = f.effects.find((x) => x.p === e.p && !x.neg); if (!m || m.l < e.l) return false; }
  const fn = f.effects.find((e) => e.neg), an = a.effects.find((e) => e.neg);
  if (fn && (!an || an.p !== fn.p || an.l < fn.l)) return false;
  return pts(f) > pts(a);
};
const creep: any[] = [];
for (let t = 1; t <= 4; t++) {
  const A = byTier([...BASE_ITEMS], t), F = byTier(gen1, t);
  const maxA = Math.max(...A.map(pts));
  creep.push({
    tier: t, authored: A.length, authoredPts: `${Math.min(...A.map(pts))}-${maxA} (mean ${mean(A.map(pts)).toFixed(0)})`,
    authoredWithDrawback: `${Math.round(100 * A.filter((i) => i.effects.some((e) => e.neg)).length / A.length)}%`,
    fusedGen1: F.length, fusedPts: F.length ? `${Math.min(...F.map(pts))}-${Math.max(...F.map(pts))} (mean ${mean(F.map(pts)).toFixed(0)})` : '-',
    fusedWithDrawback: F.length ? `${Math.round(100 * F.filter((i) => i.effects.some((e) => e.neg)).length / F.length)}%` : '-',
    fusedAboveAuthoredMax: F.length ? `${Math.round(100 * F.filter((i) => pts(i) > maxA).length / F.length)}%` : '-',
    fusedDominatingAnAuthored: F.length ? `${Math.round(100 * F.filter((f) => A.some((a) => dominates(f, a))).length / F.length)}%` : '-',
    authoredDominated: `${A.filter((a) => F.some((f) => dominates(f, a))).length}/${A.length}`,
  });
}
res.creep = creep;
console.log('\n## power creep (gen 1 vs authored, same tier)\n' + table(creep));
// All fused tier 4 from every generation.
const t4 = all.filter((i) => itemTier(i) === 4 && !BASE_ITEMS.includes(i));
const hist: Record<string, number> = {};
for (const i of t4) { const b = `${Math.floor(pts(i) / 10) * 10}s`; hist[b] = (hist[b] ?? 0) + 1; }
res.t4 = { count: t4.length, at110: t4.filter((i) => pts(i) >= 108).length, hist, authoredMax: 73 };
console.log('\nfused tier 4 found:', t4.length, 'points histogram', hist, 'authored tier 4 tops out at 73');
// Which primitives do max items converge on?
const primCount: Record<string, number> = {};
for (const i of t4.filter((i) => pts(i) >= 100)) for (const e of i.effects) if (!e.neg) primCount[e.p] = (primCount[e.p] ?? 0) + 1;
res.t4prims = Object.entries(primCount).sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('top primitives on 100+ point items', res.t4prims.map(([k, v]: any) => `${k} ${v}`).join(', '));

// --- 3. Degenerate chains: the cheapest road to the 110 cap.
// Greedy in town (no raw cost): how few base items, at which tiers, reach >= 108 points?
async function chain(start: ItemSpec[]): Promise<{ n: number; pts: number; steps: string[] }> {
  let pool = start.slice(); const steps: string[] = [];
  while (pool.length > 1) {
    pool.sort((a, b) => pts(a) - pts(b));
    const a = pool.shift()!, b = pool.shift()!;
    if (fusionBlock(a, b)) { pool.push(pts(a) > pts(b) ? a : b); continue; }
    const o = await fuse(a, b); steps.push(`${pts(a)}+${pts(b)}->${pts(o)}`); pool.push(o);
  }
  return { n: start.length, pts: pts(pool[0]), steps };
}
const t1 = BASE_ITEMS.filter((i) => itemTier(i) === 1), t2 = BASE_ITEMS.filter((i) => itemTier(i) === 2), t3 = BASE_ITEMS.filter((i) => itemTier(i) === 3);
res.chains = [];
for (const [label, src, n] of [['2 tier-3 authored', t3, 2], ['3 tier-3 authored', t3, 3], ['4 tier-2 authored', t2, 4], ['6 tier-2 authored', t2, 6], ['8 tier-1 authored', t1, 8], ['12 tier-1 authored', t1, 12], ['16 tier-1 authored', t1, 16]] as const) {
  const c = await chain(src.slice(0, n));
  const inScrip = src.slice(0, n).reduce((x, i) => x + (i.price ?? 0), 0);
  res.chains.push({ inputs: label, inputPoints: src.slice(0, n).reduce((x, i) => x + pts(i), 0), benchScripAtWave0: inScrip, result: c.pts, steps: c.steps.join('  ') });
}
console.log('\n## chains\n' + table(res.chains));
// Charge refresh: worn 63-point tier 3 + 2-point junk.
const junk = BASE_ITEMS.slice().sort((a, b) => pts(a) - pts(b))[0];
const big = all.filter((i) => itemTier(i) === 3).sort((a, b) => pts(b) - pts(a))[0];
const refreshed = await fuse(big, junk);
res.refresh = { worn: pts(big), junk: `${junk.id} (${pts(junk)} pts, ${junk.price} scrip)`, out: pts(refreshed), outTier: itemTier(refreshed) };
console.log('\ncharge refresh:', res.refresh);

writeFileSync(process.argv[2] ?? '/tmp/fusion.json', JSON.stringify(res, null, 1));
