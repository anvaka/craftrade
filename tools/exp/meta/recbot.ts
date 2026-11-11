// A headless player whose every action goes through the replay recorder, so its runs can be sent
// to the server with a replay like a real client's. It steers with the sim bot's own botInput; the
// bench is a plain greedy policy written here, because the sim's botBench calls the bench functions
// directly and those calls would not be logged. It plays worse than botBench. That does not matter:
// it exists to make honest, recorded runs, not to measure balance.
import type { ItemSpec } from '../../../src/shared/item.ts';
import { itemTier } from '../../../src/shared/item.ts';
import { killsOf, rec, record, replayOf } from '../../../src/shared/replay.ts';
import { RAWS } from '../../../src/shared/vocab.ts';
import {
  botInput, buyBlock, carryLimit, carryable, clearEvents, createBot, createRun, fuseCost, rerollCost, summary,
  type Run, type RunOptions, type RunSummary,
} from '../../../src/sim/index.ts';

export interface Recorded { run: Run; summary: RunSummary; replay: string; killsBy: Record<string, number> }

/** Ask what a pair becomes (the server), or null to leave the anvil alone. */
export type FuseVia = (a: ItemSpec, b: ItemSpec) => Promise<ItemSpec | null>;

function bench(run: Run): void {
  const b = run.bench, p = run.player;
  while (b.picks > 0) if (!rec.pickUpgrade(run, 0)) break;
  for (let round = 0; round < 3; round++) {
    // Dearest affordable offer first.
    for (;;) {
      let best = -1;
      for (let i = 0; i < b.offers.length; i++) {
        const o = b.offers[i];
        if (o.sold || buyBlock(run, i) !== null) continue;
        if (best < 0 || o.price > b.offers[best].price) best = i;
      }
      if (best < 0 || !rec.buy(run, best)) break;
    }
    if (p.scrip < rerollCost(run) + 20 + 3 * b.index || !rec.reroll(run)) break;
  }
  if (b.mule) rec.sendMule(run, { timber: Math.floor(p.raws.timber / 2), ore: Math.floor(p.raws.ore / 2), hide: Math.floor(p.raws.hide / 2) });
}

/** Play a whole run, recorded. `stopAfter` abandons the run at the bench after that many waves (a player who quits). */
export async function playRecorded(opts: RunOptions & { hazard?: number }, botSeed = 7, fuseVia: FuseVia | null = null, stopAfter = 99): Promise<Recorded> {
  const run = createRun(opts);
  record(run);
  const bot = createBot(botSeed, false);
  const input = { mx: 0, my: 0 };
  for (let guard = 0; guard < 300000 && run.phase !== 'over'; guard++) {
    if (run.phase === 'wave') {
      botInput(run, bot, input);
      rec.step(run, input);
      clearEvents(run);
    } else {
      bench(run);
      if (fuseVia && run.player.items.length >= 2) {
        const p = run.player;
        let a = -1, c = -1;
        for (let i = 0; i < p.items.length; i++) {
          if (itemTier(p.items[i]) > 2 || p.itemKit[i]) continue;
          if (a < 0) a = i; else if (c < 0 && p.items[i].id !== p.items[a].id) c = i;
        }
        if (a >= 0 && c >= 0) {
          const q = fuseCost(run, a, c);
          if (!q.block && RAWS.every((r) => p.raws[r] >= q.raws[r])) {
            const out = await fuseVia(p.items[a], p.items[c]);
            if (out) rec.applyFusion(run, a, c, out);
          }
        }
      }
      if (run.wavesCleared >= stopAfter) rec.abandon(run);
      else rec.nextWave(run);
    }
  }
  const best = carryable(run).slice(0, carryLimit(run)).map((i) => i.id);
  rec.setCarry(run, best);
  return { run, summary: summary(run), replay: replayOf(run)!, killsBy: killsOf(run)! };
}

/** The body of POST /api/run/end for a recorded run. */
export function reportOf(runId: string, r: Recorded, quit = false) {
  const s = r.summary;
  return {
    runId, wavesCleared: s.wavesCleared, won: s.won, scripEarned: s.scripEarned, scripHeld: s.scripHeld, level: s.level,
    raws: s.raws, mule: s.mule, carry: s.carry, kills: s.kills, fusions: s.fusions, killsBy: r.killsBy, replay: r.replay,
    ...(quit ? { quit: true } : {}),
  };
}
