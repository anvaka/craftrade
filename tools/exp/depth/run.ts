// Play a list of jobs in this process and print one summary line per job.
//   npx tsx tools/exp/depth/run.ts <outDir> <seeds> <policy>[@character] ...
// Writes <outDir>/<policy>__<character>.jsonl (one record per run) unless outDir is '-'.
// To use every core, start several of these with disjoint job lists (see par.sh).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CharacterId } from '../../../src/shared/protocol.ts';
import { playPolicy, policy, seedOf, type Rec } from './harness.ts';

const [out, seedsArg, ...jobs] = process.argv.slice(2);
const seeds = Number(seedsArg);
if (out !== '-') mkdirSync(out, { recursive: true });
const med = (a: number[]) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export function line(name: string, recs: Rec[]): string {
  const n = recs.length, W = 12;
  const wins = recs.filter((r) => r.won);
  const deaths = new Array(W + 1).fill(0);
  for (const r of recs) if (!r.won) deaths[r.endWave]++;
  const reach12 = recs.filter((r) => r.won || r.endWave === 12);
  const bossT = med(wins.filter((r) => r.bossKilled).map((r) => r.bossT));
  let wt = 0, wd = 0, at = 0, ad = 0, spent = 0, earned = 0;
  for (const r of recs) {
    for (let w = 0; w < r.workT.length; w++) { wt += r.workT[w]; wd += r.hurtWork[w]; at += r.waveSecs[w] - r.workT[w]; ad += r.taken[w] - r.hurtWork[w]; }
    if (r.won) { earned += r.scripEarned; spent += r.scripHeld; }
  }
  const r8 = recs.filter((r) => r.w8[0] >= 0);
  return `${name.padEnd(26)} win ${((100 * wins.length) / n).toFixed(1).padStart(5)}%  deaths ${deaths.slice(1).join(' ')}  boss pass ${reach12.length ? Math.round((100 * wins.length) / reach12.length) : 0}% kill ${wins.length ? Math.round((100 * wins.filter((r) => r.bossKilled).length) / wins.length) : 0}% at ${bossT}s`
    + `  dmg/s node ${(wd / Math.max(1, wt)).toFixed(3)} away ${(ad / Math.max(1, at)).toFixed(3)} work ${Math.round((100 * wt) / Math.max(1, wt + at))}%  raws ${Math.round(mean(recs.map((r) => r.gathered)))}`
    + `  fus ${mean(recs.map((r) => r.fusions)).toFixed(1)}  unspent ${earned ? Math.round((100 * spent) / earned) : 0}%  w8 n${mean(r8.map((r) => r.w8[0])).toFixed(1)} cop${mean(r8.map((r) => r.w8[1])).toFixed(1)} cls${mean(r8.map((r) => r.w8[2])).toFixed(1)}`;
}

for (const job of jobs) {
  const [polName, ch = 'greenhorn'] = job.split('@');
  const pol = policy(polName);
  const recs: Rec[] = [];
  for (let s = 1; s <= seeds; s++) recs.push(playPolicy(ch as CharacterId, seedOf(s), pol));
  if (out !== '-') writeFileSync(join(out, `${polName.replace(/[:=+]/g, '-')}__${ch}.jsonl`), recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(line(job, recs));
}
