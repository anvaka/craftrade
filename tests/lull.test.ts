// The lull: with it on, every wave but the last is followed by a stretch with no enemies and a clearing full of nodes.
import { describe, expect, it } from 'vitest';
import { ES, NODE_CHEST, clearEvents, createRun, stateHash, step, type Run } from '../src/sim/index.ts';

/** Walk to the nearest node (the chest first) and stand in it. */
function gather(run: Run, inp: { mx: number; my: number }): void {
  const p = run.player;
  let best = 1e18, tx = p.x, ty = p.y;
  for (const n of run.nodes) {
    if (!n.alive) continue;
    const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2 - (n.type === NODE_CHEST ? 1e7 : 0);
    if (d < best) { best = d; tx = n.x; ty = n.y; }
  }
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  inp.mx = d > 30 ? dx / d : 0; inp.my = d > 30 ? dy / d : 0;
}

describe('lull', () => {
  it('is off unless asked for, and the standard run is unchanged by the option being absent', () => {
    const a = createRun({ seed: 5, character: 'greenhorn' }), b = createRun({ seed: 5, character: 'greenhorn', lull: 0 });
    for (let t = 0; t < 60 * 25; t++) { step(a, { mx: 0, my: 0 }); step(b, { mx: 0, my: 0 }); }
    expect(a.lull).toBe(0);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('is safe for a player who keeps away: the only enemies are guards, and they stay where they stand', () => {
    const run = createRun({ seed: 3, character: 'greenhorn', lull: 30 });
    run.player.base[0] += 200;
    let guards = 0, moved = 0;
    for (let t = 0; t < 60 * 80 && run.phase === 'wave'; t++) {
      run.player.hp = run.player.maxHp;
      // Stand in a corner, far from everything.
      const p = run.player, inp = run.lullT > 0 ? { mx: p.x > 40 ? -1 : 0, my: p.y > 40 ? -1 : 0 } : { mx: 0, my: 0 };
      step(run, inp);
      if (run.lullT > 0 && run.lullT < 20) for (const e of run.enemies) if (e.alive) { guards++; if (e.state !== ES.Guard && Math.hypot(e.x - p.x, e.y - p.y) > 400) moved++; }
      clearEvents(run);
    }
    expect(run.phase).toBe('bench');
    expect(moved).toBe(0);
    expect(run.enemyCount).toBe(0);
    console.log(`guard-ticks seen: ${guards}`);
  });

  it('follows the wave: more nodes than before, guards on the rich ones, then the bench', () => {
    const run = createRun({ seed: 3, character: 'greenhorn', lull: 30 });
    const inp = { mx: 0, my: 0 };
    run.player.base[0] += 200; // stay alive without playing
    let sawLull = false, enemiesInLull = 0, nodesAtStart = 0, ticks = 0, gained = 0, events: string[] = [];
    for (let t = 0; t < 60 * 80 && run.phase === 'wave'; t++) {
      run.player.hp = run.player.maxHp;
      if (run.lullT > 0) {
        if (!sawLull) { sawLull = true; nodesAtStart = run.nodes.filter((n) => n.alive).length; }
        enemiesInLull = Math.max(enemiesInLull, run.enemies.filter((e) => e.alive && e.state !== ES.Guard && e.called).length);
        gather(run, inp);
        ticks++;
      } else { inp.mx = 0; inp.my = 0; }
      step(run, inp);
      for (let i = 0; i < run.events.n; i++) if (['lull', 'skill', 'chest'].includes(run.events.list[i].type)) events.push(run.events.list[i].type);
      clearEvents(run);
    }
    gained = run.skillGained.reduce((a, b) => a + b, 0);
    console.log(`lull: ${nodesAtStart} nodes, ${ticks / 60}s, skill xp gained ${gained}, raws ${JSON.stringify(run.player.raws)}, events ${events.join(',')}`);
    expect(sawLull).toBe(true);
    expect(enemiesInLull).toBe(0);
    expect(nodesAtStart).toBeGreaterThanOrEqual(7);
    expect(Math.round(ticks / 60)).toBe(30);
    expect(run.phase).toBe('bench');
    expect(gained).toBeGreaterThan(0);
    expect(run.nodes.some((n) => n.alive && n.type === NODE_CHEST)).toBe(false);
  });

  it('a chest pays an upgrade pick', () => {
    for (let seed = 1; seed < 40; seed++) {
      const run = createRun({ seed, character: 'greenhorn', lull: 30 });
      const inp = { mx: 0, my: 0 };
      let picks = -1, opened = false;
      for (let t = 0; t < 60 * 140 && run.phase !== 'over' && !opened; t++) {
        run.player.hp = run.player.maxHp;
        if (run.phase === 'bench') { run.phase = 'wave'; run.wave++; run.waveTime = run.waveSeconds; continue; }
        if (run.lullT > 0) { if (picks < 0) picks = run.bench.picks; gather(run, inp); } else { inp.mx = 0; inp.my = 0; picks = -1; }
        step(run, inp);
        for (let i = 0; i < run.events.n; i++) if (run.events.list[i].type === 'chest') { opened = true; expect(run.bench.picks).toBe(picks + 1); }
        clearEvents(run);
      }
      if (opened) return;
    }
    throw new Error('no chest was opened in 40 seeds');
  });
});
