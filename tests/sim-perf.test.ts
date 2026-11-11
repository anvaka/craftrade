import { describe, expect, it } from 'vitest';
import * as sim from '../src/sim/index.ts';
import { spawnEnemy } from '../src/sim/core.ts';
import { fireShot } from '../src/sim/weapons.ts';

describe('performance and API', () => {
  it('300 enemies with shots and pickups step in well under 2 ms', () => {
    const run = sim.createRun({ seed: 99, character: 'greenhorn' });
    run.wave = 10;
    const p = run.player;
    const types = ['mite', 'gnat', 'boar', 'spitter', 'brute', 'burrower'].map((id) => sim.ENEMY_INDEX[id]);
    let total = 0, n = 0, peak = 0;
    for (let t = 0; t < 1500; t++) {
      for (let k = run.enemyCount; k < sim.MAX_ENEMIES; k++) {
        spawnEnemy(run, types[(t + k) % 6], p.x + Math.cos(k * 2.4 + t) * (200 + (k % 9) * 55), p.y + Math.sin(k * 2.4 + t) * (200 + (k % 7) * 60), 0.1);
      }
      if (t % 2 === 0) for (let k = 0; k < 8; k++) fireShot(run, p.x, p.y, Math.cos(t + k), Math.sin(t + k), 600, 9, 5, 500, 1, 1, false, 4, 1, 0, true);
      p.base[sim.ST.maxHp] = 250; p.hp = 250; run.waveTime = 1; run.phase = 'wave';
      const t0 = performance.now();
      sim.step(run, { mx: Math.cos(t / 40), my: Math.sin(t / 40) });
      const dt = performance.now() - t0;
      sim.clearEvents(run);
      if (t > 300) { total += dt; n++; }
      if (run.enemyCount > peak) peak = run.enemyCount;
    }
    expect(peak).toBe(300);
    expect(sim.hasBadNumber(run)).toBeNull();
    // The budget is 2 ms; the mean is asserted with headroom for a busy CI machine.
    expect(total / n).toBeLessThan(1);
  });

  it('the event queue never grows past its pool and reports what it dropped', () => {
    const run = sim.createRun({ seed: 3, character: 'greenhorn' });
    for (let t = 0; t < 1200 && run.phase === 'wave'; t++) sim.step(run, { mx: 0, my: 0 });
    expect(run.events.n).toBeLessThanOrEqual(run.events.list.length);
    expect(run.events.n + run.events.dropped).toBeGreaterThan(0);
    sim.clearEvents(run);
    expect(run.events.n).toBe(0);
  });

  it('index exports the whole lifecycle', () => {
    for (const name of ['createRun', 'step', 'nextWave', 'summary', 'clearEvents', 'pickUpgrade', 'buy', 'reroll', 'toggleLock', 'scrapWeapon',
      'scrapItem', 'fuseCost', 'applyFusion', 'sendMule', 'setCarry', 'stateHash', 'playRun', 'WEAPONS', 'ENEMIES', 'WAVES', 'CHARACTERS']) {
      expect((sim as Record<string, unknown>)[name], name).toBeDefined();
    }
    expect(sim.CHARACTERS.map((c) => c.id)).toEqual(['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk']);
  });
});
