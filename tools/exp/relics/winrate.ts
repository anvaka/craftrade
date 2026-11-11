// Win-rate effect of each relic, measured with the balance bot.
//   npx tsx tools/exp/relics/winrate.ts [seeds=300] [character=greenhorn] [relic id,relic id | all]
// Every relic is played on the same seeds as the bare baseline (same run seed,
// same bot seed), so the difference is the relic and not the draw of seeds.
// A relic takes one of the two kit slots; the other is left empty here.
// "none" is the baseline. Runs for one id are independent of the others, so
// several ids can be measured in parallel processes and the lines joined.
import { RELICS } from '../../../src/shared/content/relics.ts';
import type { CharacterId } from '../../../src/shared/protocol.ts';
import { playRun } from '../../../src/sim/bot.ts';
import { summary } from '../../../src/sim/run.ts';

const seeds = Number(process.argv[2] ?? 300);
const character = (process.argv[3] ?? 'greenhorn') as CharacterId;
const which = process.argv[4] ?? 'all';

interface Row { id: string; wins: number; waves: number; raws: number; carry: number }

function play(id: string): Row {
  const relic = RELICS.find((r) => r.id === id);
  if (!relic && id !== 'none') throw new Error(`No relic called ${id}`);
  const row: Row = { id, wins: 0, waves: 0, raws: 0, carry: 0 };
  for (let s = 1; s <= seeds; s++) {
    const run = playRun({ seed: s * 7919 + 13, character, kit: relic ? [relic] : [] });
    const sum = summary(run);
    if (sum.won) row.wins++;
    row.waves += sum.wavesCleared;
    row.raws += sum.rawsGathered.timber + sum.rawsGathered.ore + sum.rawsGathered.hide;
    row.carry += sum.carryLimit;
    // Progress on stderr, so a long measurement that is cut short still says something.
    if (s % 50 === 0 && s < seeds) console.error(`${id} ${s}/${seeds} wins ${row.wins}`);
  }
  return row;
}

const ids = which === 'all' ? ['none', ...RELICS.map((r) => r.id)] : which.split(',');
const pct = (n: number) => ((100 * n) / seeds).toFixed(1);
for (const id of ids) {
  const r = play(id);
  console.log(
    `${id.padEnd(16)} seeds ${seeds}  win ${pct(r.wins).padStart(5)}%  waves cleared ${(r.waves / seeds).toFixed(2)}  raws gathered ${(r.raws / seeds).toFixed(1)}  carry limit ${(r.carry / seeds).toFixed(2)}`,
  );
}
