// What the sim can actually produce, per wave: the source of the report caps in server/config.ts.
//   npx tsx tools/exp/meta/maxima.ts <cfg> <seeds> <shard> <shards> <out.jsonl>
//   cfg: expert | average | cap5 (expert, two cap-point kit items at full strength, stations 5) | st5 (expert, stations 5) | idle
// One JSON line per run. tools/exp/meta/maxima-report.ts turns the lines into the cap tables.
import { appendFileSync } from 'node:fs';
import { ProceduralProvider, validatePick } from '../../../server/provider.ts';
import { BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { fusedItemId, fusionBlock, fusionBudget, itemTier, recipeKey, type ItemSpec } from '../../../src/shared/item.ts';
import { RAWS } from '../../../src/shared/vocab.ts';
import { botBench, botInput, clearEvents, createBot, createRun, nextWave, step, summary, type Run } from '../../../src/sim/index.ts';
import { SKILLS, pts } from './simlib.ts';

const cfg = process.argv[2] ?? 'expert';
const N = Number(process.argv[3] ?? 300), shard = Number(process.argv[4] ?? 0), shards = Number(process.argv[5] ?? 1);
const out = process.argv[6] ?? '/tmp/maxima.jsonl';
const CHARS = ['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk'] as const;

const maxed: ItemSpec[] = [];
if (cfg === 'cap5') {
  const prov = new ProceduralProvider();
  const fuse = async (a: ItemSpec, b: ItemSpec): Promise<ItemSpec> => {
    const [x, y] = a.id < b.id ? [a, b] : [b, a];
    const key = recipeKey(x.id, y.id), budget = fusionBudget(x, y);
    const v = validatePick(await prov.propose(x, y, budget, key), budget, key)!;
    return { id: fusedItemId(v.effects), name: v.names[0] ?? 'x', glyph: v.glyph, tags: v.tags, effects: v.effects };
  };
  const fus = BASE_ITEMS.filter((i) => itemTier(i) < 4);
  const g1: ItemSpec[] = [];
  for (let i = 0; i < fus.length; i++) for (let j = i + 1; j < fus.length; j++) g1.push(await fuse(fus[i], fus[j]));
  const mids = g1.filter((i) => pts(i) >= 52 && pts(i) < 64);
  for (let i = 0; i < mids.length && maxed.length < 6; i++) for (let j = i + 1 + (i * 7) % 13; j < mids.length; j += 17) {
    if (fusionBlock(mids[i], mids[j])) continue;
    const o = await fuse(mids[i], mids[j]);
    if (pts(o) >= 102 && !maxed.some((m) => m.id === o.id)) { maxed.push(o); break; }
  }
}
const skill = cfg === 'average' ? SKILLS.average : SKILLS.expert;
const stations = cfg === 'cap5' || cfg === 'st5' ? { sawmill: 5, smelter: 5, tannery: 5, assay: 5 } : undefined;
let nrng = 99991 + shard;
const nr = () => { nrng = (Math.imul(nrng, 1664525) + 1013904223) >>> 0; return nrng / 4294967296; };
const total = (run: Run) => RAWS.reduce((n, r) => n + run.player.raws[r] + run.mule[r], 0);

for (let s = 1; s <= N; s++) {
  if (s % shards !== shard) continue;
  for (const character of CHARS) {
    const kit = cfg === 'cap5' ? [maxed[s % maxed.length], maxed[(s + 1) % maxed.length]] : [];
    const t0 = performance.now();
    const run = createRun({ seed: s * 7919 + 13 + CHARS.indexOf(character) * 101, character, kit, stations });
    const bot = createBot(s * 31 + 7, true);
    bot.every = skill.every;
    const input = { mx: 0, my: 0 };
    let hold = 0, hx = 0, hy = 0, waveStart = 0;
    // Cumulative values at the end of each wave played (index = wave number, 1-based).
    const earned: number[] = [], held: number[] = [], raws: number[] = [], perRaw: number[] = [], kills: number[] = [], ticks: number[] = [], waveTicks: number[] = [], maxTier: number[] = [];
    const mark = () => {
      const w = run.wave;
      earned[w] = run.scripEarned; held[w] = run.player.scrip; raws[w] = total(run);
      perRaw[w] = Math.max(...RAWS.map((r) => run.player.raws[r] + run.mule[r])); kills[w] = run.kills; ticks[w] = run.tick; waveTicks[w] = run.tick - waveStart;
      maxTier[w] = Math.max(0, ...run.player.items.filter((_, i) => !run.player.itemKit[i]).map((i) => itemTier(i)));
    };
    for (let g = 0; g < 300000 && run.phase !== 'over'; g++) {
      if (run.phase === 'wave') {
        if (cfg === 'idle') { input.mx = 0; input.my = 0; }
        else {
          botInput(run, bot, input);
          if (skill.noise > 0) {
            if (hold > 0) { hold--; input.mx = hx; input.my = hy; }
            else if (run.tick % 20 === 0 && nr() < skill.noise) { const a = nr() * 6.283; hx = Math.cos(a); hy = Math.sin(a); hold = 20; }
          }
        }
        step(run, input); clearEvents(run);
        if (run.phase !== 'wave') mark();
      } else {
        botBench(run, bot);
        waveStart = run.tick;
        nextWave(run);
      }
    }
    const sum = summary(run);
    appendFileSync(out, JSON.stringify({
      cfg, character, seed: s, ms: Math.round(performance.now() - t0), wavesCleared: sum.wavesCleared, won: sum.won, scripEarned: sum.scripEarned, scripHeld: sum.scripHeld,
      raws: sum.raws, mule: sum.mule, kills: sum.kills, level: sum.level, seconds: sum.seconds, fusions: sum.fusions.length,
      earned, held, rawsAt: raws, perRaw, killsAt: kills, ticks, waveTicks, maxTier,
    }) + '\n');
  }
}
