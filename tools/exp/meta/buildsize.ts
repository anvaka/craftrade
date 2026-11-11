// How big is a finished build, in item points? (Context for what a 2-item kit is worth.)
import { summary } from '../../../src/sim/index.ts';
import { SKILLS, mean, playSim, pts } from './lib.ts';
const w6: number[] = [], w12: number[] = [], n12: number[] = [];
for (let s = 1; s <= 24; s++) {
  const run = await playSim({ seed: s * 7919 + 13, character: 'greenhorn' }, SKILLS.expert, s * 31 + 7, null);
  const sum = summary(run);
  if (sum.wavesCleared >= 11) { w12.push(run.player.items.reduce((n, i) => n + pts(i), 0)); n12.push(run.player.items.length); }
}
console.log(`runs reaching wave 12: ${w12.length}; items held ${mean(n12).toFixed(1)}; item points held ${mean(w12).toFixed(0)} (min ${Math.min(...w12)}, max ${Math.max(...w12)})`);
