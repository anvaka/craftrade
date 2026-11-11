import { createBot, botInput, botBench, createRun, step, clearEvents, nextWave, summary } from '../../../src/sim/index.ts';
import { BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { itemPoints, itemTier } from '../../../src/shared/item.ts';
const pts = BASE_ITEMS.map(i => itemPoints(i.effects));
console.log('base items', BASE_ITEMS.length, 'points min/max/mean', Math.min(...pts), Math.max(...pts), (pts.reduce((a,b)=>a+b)/pts.length).toFixed(1));
const tiers=[0,0,0,0,0]; for (const i of BASE_ITEMS) tiers[itemTier(i)]++; console.log('tiers', tiers);
for (const every of [3, 6, 10, 16]) {
  let wins = 0, waves = 0, raws = 0, scrip=0; const t0 = performance.now(); const N = 30;
  for (let s = 1; s <= N; s++) {
    const run = createRun({ seed: s * 7919 + 13, character: 'greenhorn' });
    const bot = createBot(s * 31 + 7); bot.every = every;
    const input = { mx: 0, my: 0 };
    for (let g = 0; g < 200000 && run.phase !== 'over'; g++) {
      if (run.phase === 'wave') { botInput(run, bot, input); step(run, input); clearEvents(run); } else { botBench(run, bot); nextWave(run); }
    }
    const sum = summary(run); wins += sum.won ? 1 : 0; waves += sum.wavesCleared; raws += sum.raws.timber+sum.raws.ore+sum.raws.hide+sum.mule.timber+sum.mule.ore+sum.mule.hide; scrip+=sum.scripHeld;
  }
  console.log(`every=${every} win ${(wins / N).toFixed(2)} waves ${(waves / N).toFixed(1)} raws ${(raws/N).toFixed(0)} scripHeld ${(scrip/N).toFixed(0)}  ${((performance.now() - t0) / N).toFixed(0)} ms/run`);
}
