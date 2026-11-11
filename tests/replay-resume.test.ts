import { describe, expect, it } from 'vitest';
import { BASE_ITEMS } from '../src/shared/content/items.ts';
import { fusedOf, playback, rec, record, replayOf, resumeInto } from '../src/shared/replay.ts';
import { botInput, clearEvents, createBot, createRun, stateHash, type Run } from '../src/sim/index.ts';

const OPTS = { seed: 4242, character: 'greenhorn' as const, waves: 12 };

/** Play one wave with the bot's hands, through the recorder. */
function wave(run: Run, bot: ReturnType<typeof createBot>): void {
  const input = { mx: 0, my: 0 };
  for (let guard = 0; guard < 200_000 && run.phase === 'wave'; guard++) {
    botInput(run, bot, input);
    rec.step(run, input);
    clearEvents(run);
  }
}

/** Spend at the bench through the recorder: every pick, then whatever the first offers allow. */
function shop(run: Run): void {
  while (run.bench.picks > 0 && rec.pickUpgrade(run, 0)) { /* take the first */ }
  for (let i = 0; i < 4; i++) rec.buy(run, i);
}

describe('a run saved at a bench', () => {
  it('is picked up exactly where it stood, and plays on to the same end', () => {
    const a = createRun(OPTS);
    record(a);
    const botA = createBot(7);
    for (let w = 0; w < 3; w++) {
      wave(a, botA);
      expect(a.phase).toBe('bench');
      shop(a);
      if (w < 2) rec.nextWave(a);
    }
    const save = { replay: replayOf(a)!, items: fusedOf(a) };
    const hashAtBench = stateHash(a);

    const b = createRun(OPTS);
    record(b);
    expect(resumeInto(b, save.replay, save.items)).toBe(true);
    expect(b.phase).toBe('bench');
    expect(b.wave).toBe(a.wave);
    expect(stateHash(b)).toBe(hashAtBench);
    expect(replayOf(b)).toBe(save.replay);

    // Both go on with the same hands and stay the same run.
    rec.nextWave(a);
    rec.nextWave(b);
    const input = { mx: 0, my: 0 };
    for (let t = 0; t < 600 && a.phase === 'wave'; t++) {
      input.mx = Math.cos(t / 40);
      input.my = Math.sin(t / 40);
      rec.step(a, input);
      rec.step(b, input);
      clearEvents(a);
      clearEvents(b);
    }
    expect(stateHash(b)).toBe(stateHash(a));
    expect(replayOf(b)).toBe(replayOf(a));
  });

  it('carries its fusions, and the whole log still passes the town’s playback', () => {
    const a = createRun(OPTS);
    record(a);
    const bot = createBot(7);
    wave(a, bot);
    // Two plain items in hand, fused into a third the way the bench does it.
    const [x, y] = BASE_ITEMS;
    a.player.items.push(x, y);
    a.player.itemKit.push(false, false);
    const out = { id: 'f_test', name: 'Test piece', glyph: x.glyph, tags: [], effects: x.effects };
    const ia = a.player.items.indexOf(x), ib = a.player.items.indexOf(y);
    a.player.raws.timber = a.player.raws.ore = a.player.raws.hide = 99;
    a.player.scrip = 999;
    expect(rec.applyFusion(a, ia, ib, out)).toBeNull();
    expect(fusedOf(a)).toHaveProperty('f_test');
    // The log names the fusion; without the fused item's spec it cannot be played.
    expect(replayOf(a)).toContain('f_test');
    const b = createRun(OPTS);
    record(b);
    expect(resumeInto(b, replayOf(a)!, {})).toBe(false);
  });

  it('refuses a log that is not at a bench, a log for another run, and a run already under way', () => {
    const a = createRun(OPTS);
    record(a);
    const bot = createBot(7);
    wave(a, bot);
    const atBench = replayOf(a)!;
    rec.nextWave(a);
    for (let t = 0; t < 30; t++) { rec.step(a, { mx: 1, my: 0 }); clearEvents(a); }
    const midWave = replayOf(a)!;

    const b = createRun(OPTS);
    record(b);
    expect(resumeInto(b, midWave, {})).toBe(false);

    const other = createRun({ ...OPTS, seed: 1 });
    record(other);
    // A different seed may or may not reach a bench on these inputs; it must never claim the same state.
    if (resumeInto(other, atBench, {})) expect(stateHash(other)).not.toBe(stateHash(createRun(OPTS)));

    const used = createRun(OPTS);
    record(used);
    rec.step(used, { mx: 0, my: 0 });
    expect(resumeInto(used, atBench, {})).toBe(false);

    const plain = createRun(OPTS);
    expect(resumeInto(plain, atBench, {})).toBe(false);
    expect(playback({ opts: OPTS, replay: atBench, items: {}, fusions: [] }).ok).toBe(false);
  });
});
