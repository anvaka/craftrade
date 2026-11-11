// Experiment 1b: is the kit felt? Same seeds, same bot, four kits. Also writes the outcome pool the economy sim samples from.
//   npx tsx tools/exp/meta/kitab.ts <seeds> <out.json> [skills csv]
import { writeFileSync } from 'node:fs';
import { ProceduralProvider, validatePick } from '../../../server/provider.ts';
import { BASE_ITEM, BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { fusedItemId, fusionBlock, fusionBudget, itemPoints, itemTier, recipeKey, type ItemSpec } from '../../../src/shared/item.ts';
import { packItem } from '../../../src/shared/kit.ts';
import { carryable, carryLimit, summary } from '../../../src/sim/index.ts';
import { SKILLS, mean, playSim, pts, table } from './simlib.ts';

const N = Number(process.argv[2] ?? 100);
const out = process.argv[3] ?? '/tmp/kitab.json';
const skills = (process.argv[4] ?? 'average,novice').split(',');

// Six real 108+ point items from the procedural provider (first ones found walking generation 2).
const prov = new ProceduralProvider();
async function fuse(a: ItemSpec, b: ItemSpec): Promise<ItemSpec> {
  const [x, y] = a.id < b.id ? [a, b] : [b, a];
  const key = recipeKey(x.id, y.id), budget = fusionBudget(x, y);
  const v = validatePick(await prov.propose(x, y, budget, key), budget, key)!;
  return { id: fusedItemId(v.effects), name: v.names[0] ?? 'x', glyph: v.glyph, tags: v.tags, effects: v.effects };
}
const fus = BASE_ITEMS.filter((i) => itemTier(i) < 4);
const g1: ItemSpec[] = [];
for (let i = 0; i < fus.length; i++) for (let j = i + 1; j < fus.length; j++) g1.push(await fuse(fus[i], fus[j]));
const mids = g1.filter((i) => pts(i) >= 52 && pts(i) < 64);
const maxed: ItemSpec[] = [];
for (let i = 0; i < mids.length && maxed.length < 6; i++) for (let j = i + 1 + (i * 7) % 13; j < mids.length; j += 17) {
  if (fusionBlock(mids[i], mids[j])) continue;
  const o = await fuse(mids[i], mids[j]);
  if (pts(o) >= 102 && !maxed.some((m) => m.id === o.id)) { maxed.push(o); break; }
}
const t2 = BASE_ITEMS.filter((i) => itemTier(i) === 2), t4 = BASE_ITEMS.filter((i) => itemTier(i) === 4);
const KITS: Record<string, (s: number) => ItemSpec[]> = {
  none: () => [],
  'two authored tier 2 (~37 pts)': (s) => [t2[s % t2.length], t2[(s + 5) % t2.length]],
  'two authored tier 4 (~138 pts)': (s) => [t4[s % 4], t4[(s + 1) % 4]],
  'two fused at the cap (~205 pts)': (s) => [maxed[s % 6], maxed[(s + 1) % 6]],
};
console.log('cap items used:', maxed.map((m) => `${m.name} ${pts(m)}: ${m.effects.map((e) => `${e.neg ? '-' : ''}${e.p}${e.l}`).join(' ')}`).join(' | '));

const rows: any[] = []; const pool: any = {};
for (const sk of skills) for (const [kitName, kitOf] of Object.entries(KITS)) {
  const o: any[] = [];
  for (let s = 1; s <= N; s++) {
    const kit = kitOf(s);
    // The kit enters the run packed down to the hazard 0 cap, as the server's ticket now writes it.
    const run = await playSim({ seed: s * 7919 + 13, character: 'greenhorn', kit: kit.map((i) => packItem(i, 0)) }, SKILLS[sk], s * 31 + 7, null);
    const sum = summary(run);
    const carry = carryable(run).filter((i) => BASE_ITEM[i.id]).sort((a, b) => pts(b) - pts(a)).slice(0, carryLimit(run)).map((i) => i.id);
    o.push({ wavesCleared: sum.wavesCleared, won: sum.won, scripEarned: sum.scripEarned, scripHeld: sum.scripHeld, level: sum.level, raws: sum.raws, mule: sum.mule, kills: sum.kills, carry, seconds: sum.seconds, kitPts: kit.reduce((n, i) => n + pts(i), 0) });
  }
  pool[`${sk}|${kitName}`] = o;
  const rawsHome = (r: any) => ['timber', 'ore', 'hide'].reduce((n, k) => n + (r.won ? r.raws[k] : Math.floor(r.raws[k] * 0.3)) + r.mule[k], 0);
  rows.push({
    skill: sk, kit: kitName, runs: N, winRate: (100 * mean(o.map((r) => (r.won ? 1 : 0)))).toFixed(0) + '%',
    wavesCleared: mean(o.map((r) => r.wavesCleared)).toFixed(1),
    marksHome: mean(o.map((r) => Math.floor(r.scripHeld / 10) + 3 * r.wavesCleared)).toFixed(0),
    rawsHome: mean(o.map(rawsHome)).toFixed(0), itemsHome: mean(o.map((r) => r.carry.length)).toFixed(2),
    carriedPts: mean(o.map((r) => r.carry.reduce((n: number, id: string) => n + itemPoints(BASE_ITEM[id].effects), 0))).toFixed(0),
    minutes: (mean(o.map((r) => r.seconds)) / 60).toFixed(1),
  });
  console.log(JSON.stringify(rows[rows.length - 1]));
}
console.log(table(rows));
writeFileSync(out, JSON.stringify({ rows, pool, maxed }));
