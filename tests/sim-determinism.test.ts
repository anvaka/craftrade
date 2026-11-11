import { describe, expect, it } from 'vitest';
import { RAWS } from '../src/shared/vocab.ts';
import { playRun } from '../src/sim/bot.ts';
import { hasBadNumber, stateHash, summary } from '../src/sim/run.ts';
import type { Run } from '../src/sim/types.ts';

function trace(seed: number, waves = 12): { hashes: number[]; run: Run } {
  const hashes: number[] = [];
  const run = playRun({ seed, character: 'greenhorn', waves }, 1234, (r) => { if (r.tick % 500 === 0 || r.phase !== 'wave') hashes.push(stateHash(r)); });
  hashes.push(stateHash(run));
  return { hashes, run };
}

describe('determinism', () => {
  it('same seed and inputs give an identical state hash through a full run', () => {
    const a = trace(20261111), b = trace(20261111);
    expect(a.hashes.length).toBeGreaterThan(10);
    expect(b.hashes).toEqual(a.hashes);
    expect(summary(b.run)).toEqual(summary(a.run));
  });

  it('different seeds diverge', () => {
    const a = trace(1), b = trace(2);
    expect(a.hashes[1]).not.toBe(b.hashes[1]);
    expect(a.hashes[a.hashes.length - 1]).not.toBe(b.hashes[b.hashes.length - 1]);
  });

  it('the 8-wave daily plan is deterministic too and ends by wave 8', () => {
    const a = trace(77, 8), b = trace(77, 8);
    expect(b.hashes).toEqual(a.hashes);
    expect(a.run.totalWaves).toBe(8);
    expect(a.run.wave).toBeLessThanOrEqual(8);
  });
});

describe('full bot runs stay sane', () => {
  it('no NaN, no negative scrip or raws, on any tick, for every character', () => {
    for (const character of ['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk'] as const) {
      for (const seed of [11, 12]) {
        let checks = 0;
        const run = playRun({ seed, character }, seed, (r) => {
          if (r.tick % 20 !== 0 && r.phase === 'wave') return;
          checks++;
          const bad = hasBadNumber(r);
          if (bad) throw new Error(`bad number in ${bad} at tick ${r.tick} (${character}, seed ${seed})`);
          if (r.player.scrip < 0 || r.player.bank < 0) throw new Error(`negative scrip at tick ${r.tick}`);
          for (const raw of RAWS) if (r.player.raws[raw] < 0 || r.mule[raw] < 0) throw new Error(`negative ${raw} at tick ${r.tick}`);
          if (r.enemyCount > 300 || r.enemyCount < 0) throw new Error('enemy cap broken');
        });
        expect(checks).toBeGreaterThan(50);
        expect(run.phase).toBe('over');
        expect(hasBadNumber(run)).toBeNull();
        const s = summary(run);
        expect(Number.isInteger(s.scripEarned)).toBe(true);
        expect(s.wavesCleared).toBeLessThanOrEqual(12);
        expect(s.won).toBe(s.wavesCleared === 12);
        if (!s.won) expect(s.killedBy).not.toBe('');
        let live = 0;
        for (const e of run.enemies) if (e.alive) live++;
        expect(live).toBe(run.enemyCount);
      }
    }
  }, 120000);
});
