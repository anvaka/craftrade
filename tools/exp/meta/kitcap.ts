// Experiment B1: how much should a packed item bring? Same seeds, same bot, the two strongest kits
// (two authored tier 4 items; two fused cap items), each packed down to a range of point caps.
//   npx tsx tools/exp/meta/kitcap.ts <seeds> <out.json> [skill] [caps csv, 0 = no kit, 999 = whole]
import { writeFileSync } from 'node:fs';
import { ProceduralProvider, validatePick } from '../../../server/provider.ts';
import { BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { fusedItemId, fusionBlock, fusionBudget, itemTier, recipeKey, type ItemSpec } from '../../../src/shared/item.ts';
import { packItem } from '../../../src/shared/kit.ts';
import { summary } from '../../../src/sim/index.ts';
import { SKILLS, mean, playSim, pts, table } from './simlib.ts';

const N = Number(process.argv[2] ?? 100);
const out = process.argv[3] ?? '/tmp/kitcap.json';
const skill = SKILLS[process.argv[4] ?? 'average'];
const caps = (process.argv[5] ?? '0,16,24,32,40,48,64,999').split(',').map(Number);

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
const t4 = BASE_ITEMS.filter((i) => itemTier(i) === 4);
const KITS: Record<string, (s: number) => ItemSpec[]> = {
  'authored tier 4': (s) => [t4[s % 4], t4[(s + 1) % 4]],
  'fused cap': (s) => [maxed[s % maxed.length], maxed[(s + 1) % maxed.length]],
};

const rows: any[] = [];
const cell = async (label: string, cap: number, kitOf: (s: number) => ItemSpec[]) => {
  const o: any[] = [];
  for (let s = 1; s <= N; s++) {
    const kit = kitOf(s).map((i) => packItem(i, 0, cap));
    const run = await playSim({ seed: s * 7919 + 13, character: 'greenhorn', kit }, skill, s * 31 + 7, null);
    const sum = summary(run);
    o.push({ won: sum.won ? 1 : 0, waves: sum.wavesCleared, marks: Math.floor(sum.scripHeld / 10) + 3 * sum.wavesCleared, kitPts: kit.reduce((n, i) => n + pts(i), 0) });
  }
  const row = { skill: skill.name, kit: label, cap: cap === 999 ? 'whole' : cap, runs: N, kitPts: Math.round(mean(o.map((r) => r.kitPts))), winRate: (100 * mean(o.map((r) => r.won))).toFixed(1) + '%', wavesCleared: mean(o.map((r) => r.waves)).toFixed(2), marks: Math.round(mean(o.map((r) => r.marks))) };
  rows.push(row);
  console.log(JSON.stringify(row));
  writeFileSync(out, JSON.stringify(rows, null, 1));
};
if (caps.includes(0)) await cell('none', 0, () => []);
for (const cap of caps.filter((c) => c > 0)) for (const [name, kitOf] of Object.entries(KITS)) await cell(name, cap, kitOf);
console.log(table(rows));
