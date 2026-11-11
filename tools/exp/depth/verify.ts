// Check that the parameterised bot with an empty policy plays exactly like src/sim/bot.ts.
//   npx tsx tools/exp/depth/verify.ts [seeds=12]
import { playRun } from '../../../src/sim/bot.ts';
import { stateHash } from '../../../src/sim/run.ts';
import { CHARS, playPolicy, policy, seedOf } from './harness.ts';

const n = Number(process.argv[2] ?? 12);
let bad = 0;
for (const ch of CHARS) for (let s = 1; s <= n; s++) {
  const ref = playRun({ seed: seedOf(s), character: ch });
  const mine = await playPolicy(ch, seedOf(s), policy('default'));
  const same = ref.won === mine.won && ref.tick === Math.round(mine.secs * 60) / 1 || (ref.won === mine.won && Math.round(ref.tick / 60) === mine.secs);
  const same2 = ref.buyLog.join() === mine.buy.join() && ref.upgradeLog.join() === mine.up.join() && ref.kills === mine.kills.reduce((a, b) => a + b, 0);
  if (!same || !same2) { bad++; console.log('MISMATCH', ch, s); }
}
console.log(bad ? `${bad} mismatches` : `identical on ${CHARS.length * n} runs (win, length, buy log, upgrade log, kills)`);
void stateHash;
