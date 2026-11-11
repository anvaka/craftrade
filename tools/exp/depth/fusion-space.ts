// Experiment 4b: size and shape of the fusion space on the game's no-model path
// (server/provider.ts ProceduralProvider -> validatePick -> repairEffects -> fusedItemId).
//   npx tsx tools/exp/depth/fusion-space.ts
import { BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { effectPoints, fusionBlock, fusionBudget, itemPoints, itemTier, type ItemSpec } from '../../../src/shared/item.ts';
import { PRIMITIVES } from '../../../src/shared/vocab.ts';
import { standInFusion } from '../../../src/sim/bot.ts';
import { procFuse } from './harness.ts';

const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) + '%' : '-');
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const posPoints = (it: ItemSpec) => it.effects.filter((e) => !e.neg).reduce((n, e) => n + effectPoints(e), 0);
const primSet = (it: ItemSpec) => it.effects.filter((e) => !e.neg).map((e) => e.p).sort().join('+');

interface Gen { pairs: number; outs: Map<string, ItemSpec>; rows: { a: ItemSpec; b: ItemSpec; out: ItemSpec; budget: number }[] }

async function generation(pool: ItemSpec[], mustInclude?: Set<string>): Promise<Gen> {
  const g: Gen = { pairs: 0, outs: new Map(), rows: [] };
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    const a = pool[i], b = pool[j];
    if (mustInclude && !mustInclude.has(a.id) && !mustInclude.has(b.id)) continue;
    if (fusionBlock(a, b)) continue;
    g.pairs++;
    const budget = fusionBudget(a, b);
    const out = await procFuse(a, b, budget);
    g.outs.set(out.id, out);
    g.rows.push({ a, b, out, budget });
  }
  return g;
}

function describe(label: string, g: Gen, known: Set<string>): void {
  const outs = [...g.outs.values()];
  const tiers = [0, 0, 0, 0, 0];
  for (const o of outs) tiers[itemTier(o)]++;
  const sets = new Set(outs.map(primSet));
  const fresh = outs.filter((o) => !known.has(o.id)).length;
  // Does the result keep what the parents did, or invent?
  let inherited = 0, total = 0, withNeg = 0, parentNeg = 0, lost = 0, lostTotal = 0;
  const gain: number[] = [], gainPos: number[] = [], nEff: number[] = [];
  const used = new Map<string, number>();
  for (const r of g.rows) {
    const parents = new Set([...r.a.effects, ...r.b.effects].filter((e) => !e.neg).map((e) => e.p));
    for (const e of r.out.effects) {
      if (e.neg) continue;
      total++; if (parents.has(e.p)) inherited++;
      used.set(e.p, (used.get(e.p) ?? 0) + 1);
    }
    const kept = new Set(r.out.effects.filter((e) => !e.neg).map((e) => e.p));
    for (const p of parents) { lostTotal++; if (!kept.has(p)) lost++; }
    if (r.out.effects.some((e) => e.neg)) withNeg++;
    if ([...r.a.effects, ...r.b.effects].some((e) => e.neg)) parentNeg++;
    gain.push(itemPoints(r.out.effects) - itemPoints(r.a.effects) - itemPoints(r.b.effects));
    gainPos.push(posPoints(r.out) - posPoints(r.a) - posPoints(r.b));
    nEff.push(r.out.effects.filter((e) => !e.neg).length);
  }
  console.log(`\n== ${label} ==`);
  console.log(`legal pairs ${g.pairs}; distinct outputs ${outs.length} (${pct(outs.length, g.pairs)} of pairs); not seen before ${fresh}`);
  console.log(`distinct sets of positive primitives (levels ignored) ${sets.size}`);
  console.log(`output tiers 1/2/3/4: ${tiers.slice(1).join(' / ')}`);
  console.log(`positive effects per output: mean ${mean(nEff).toFixed(2)}; inherited from a parent ${pct(inherited, total)}; a parent's positive effect is dropped ${pct(lost, lostTotal)} of the time`);
  console.log(`pairs with a parent drawback ${pct(parentNeg, g.pairs)}; outputs with a drawback ${pct(withNeg, g.pairs)}`);
  console.log(`net points out - (A + B): mean ${mean(gain).toFixed(2)}, min ${gain.reduce((a, b) => (b < a ? b : a))}, max ${gain.reduce((a, b) => (b > a ? b : a))}, against a mean A + B of ${mean(g.rows.map((r) => itemPoints(r.a.effects) + itemPoints(r.b.effects))).toFixed(1)}; share of pairs with net gain <= 0: ${pct(gain.filter((x) => x <= 0).length, gain.length)}`);
  console.log(`positive points out - (A + B): mean ${mean(gainPos).toFixed(2)}`);
  const never = PRIMITIVES.filter((p) => !used.has(p.id)).map((p) => p.id);
  const top = [...used.entries()].sort((x, y) => y[1] - x[1]);
  console.log(`primitives never produced: ${never.join(', ') || 'none'}`);
  console.log(`most produced: ${top.slice(0, 6).map(([k, v]) => `${k} ${pct(v, total)}`).join(', ')}; least: ${top.slice(-6).map(([k, v]) => `${k} ${pct(v, total)}`).join(', ')}`);
}

const authored = BASE_ITEMS.slice();
console.log(`authored items ${authored.length}; tier 4 (cannot be fused) ${authored.filter((i) => itemTier(i) === 4).length}; all pairs ${(authored.length * (authored.length - 1)) / 2}`);
const g1 = await generation(authored);
describe('generation 1: authored x authored, procedural provider', g1, new Set(authored.map((i) => i.id)));

// The bot's stand-in, for comparison with what the balance report exercises.
{
  const ids = new Set<string>(); let n = 0; const gain: number[] = [];
  for (let i = 0; i < authored.length; i++) for (let j = i + 1; j < authored.length; j++) {
    if (fusionBlock(authored[i], authored[j])) continue;
    n++;
    const out = standInFusion(authored[i], authored[j], fusionBudget(authored[i], authored[j]));
    ids.add(out.id);
    gain.push(itemPoints(out.effects) - itemPoints(authored[i].effects) - itemPoints(authored[j].effects));
  }
  console.log(`\n== generation 1 with the bot's standInFusion ==\nlegal pairs ${n}; distinct outputs ${ids.size}; net points gain mean ${mean(gain).toFixed(2)}`);
}

const g1open = [...g1.outs.values()].filter((o) => itemTier(o) < 4);
const pool2 = [...authored, ...g1open];
const g2 = await generation(pool2, new Set(g1open.map((o) => o.id)));
describe(`generation 2: (authored + ${g1open.length} open gen-1 outputs), pairs with at least one gen-1 item`, g2, new Set([...authored.map((i) => i.id), ...g1.outs.keys()]));
const all = new Set([...g1.outs.keys(), ...g2.outs.keys()]);
const allSets = new Set([...g1.outs.values(), ...g2.outs.values()].map(primSet));
console.log(`\nreachable in two generations: ${all.size} distinct fused items, ${allSets.size} distinct primitive sets`);
// The ceiling: how many items can the vocabulary express at all?
console.log(`vocabulary: ${PRIMITIVES.length} primitives; sets of 1-3 positive primitives: ${PRIMITIVES.length + (PRIMITIVES.length * (PRIMITIVES.length - 1)) / 2 + (PRIMITIVES.length * (PRIMITIVES.length - 1) * (PRIMITIVES.length - 2)) / 6}`);
