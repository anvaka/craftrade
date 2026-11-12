// An outing: the zone is laid out from the seed, the first minutes are quiet,
// the meter climbs, and the three ways home keep what they say they keep.
import { describe, expect, it } from 'vitest';
import {
  ES, MATERIALS, OUTING, bagCount, bagUsed, clearEvents, createOuting, haul, leaveOuting, nodeLocked, skillLevel, stateHash, step, xpToNext,
  type Run,
} from '../src/sim/index.ts';

/** A plain player: nearest workable node, home when the bag is full or the woods are hunting. */
function play(run: Run, maxSeconds: number, leaveAt = 0.75): void {
  const o = run.outing!, p = run.player, inp = { mx: 0, my: 0 };
  for (let t = 0; t < maxSeconds * 60 && run.phase === 'wave'; t++) {
    let tx = o.camps[0], ty = o.camps[1];
    const home = bagUsed(o) >= o.bagSlots || o.threat >= leaveAt || p.hp < p.maxHp * 0.4;
    if (!home) {
      let best = 1e18;
      for (const n of run.nodes) {
        if (!n.alive || nodeLocked(run, n.type, n.tier)) continue;
        // Leave guarded ground alone.
        if (run.enemies.some((e) => e.alive && e.state === ES.Guard && (e.x - n.x) ** 2 + (e.y - n.y) ** 2 < 330 ** 2)) continue;
        const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
        if (d < best) { best = d; tx = n.x; ty = n.y; }
      }
    } else {
      let best = 1e18;
      for (let i = 0; i < o.campCount; i++) {
        const d = (o.camps[i * 2] - p.x) ** 2 + (o.camps[i * 2 + 1] - p.y) ** 2;
        if (d < best) { best = d; tx = o.camps[i * 2]; ty = o.camps[i * 2 + 1]; }
      }
      if (o.inCamp >= 0) { leaveOuting(run, 'camp'); break; }
    }
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    inp.mx = d > 30 ? dx / d : 0; inp.my = d > 30 ? dy / d : 0;
    step(run, inp);
    clearEvents(run);
  }
}

describe('outing', () => {
  it('lays the same zone out from the same seed', () => {
    const a = createOuting({ seed: 7, character: 'greenhorn' }), b = createOuting({ seed: 7, character: 'greenhorn' });
    expect(stateHash(a)).toBe(stateHash(b));
    play(a, 60); play(b, 60);
    expect(stateHash(a)).toBe(stateHash(b));
    expect(Array.from(a.outing!.bag)).toEqual(Array.from(b.outing!.bag));
  });

  it('has three camps, nodes of every kind and tier 2 in sight of the start', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const run = createOuting({ seed, character: 'greenhorn' }), o = run.outing!;
      expect(o.campCount).toBe(3);
      const nodes = run.nodes.filter((n) => n.alive);
      expect(nodes.length).toBeGreaterThan(50);
      for (const type of [0, 1, 3]) {
        expect(nodes.some((n) => n.type === type && n.tier === 1)).toBe(true);
        expect(nodes.some((n) => n.type === type && n.tier === 2 && Math.hypot(n.x - o.camps[0], n.y - o.camps[1]) < 500)).toBe(true);
      }
      expect(run.player.x).toBe(o.camps[0]);
    }
  });

  it('is quiet at first: nothing comes for the player before the meter stirs', () => {
    const run = createOuting({ seed: 11, character: 'greenhorn' });
    const guards = run.enemyCount;
    for (let t = 0; t < 60 * 60; t++) { step(run, { mx: 0, my: 0 }); clearEvents(run); }
    expect(run.outing!.stage).toBe(0);
    expect(run.enemyCount).toBe(guards);
    expect(run.player.hp).toBe(run.player.maxHp);
  });

  it('locks tier 2 nodes until the skill is level 5', () => {
    const low = createOuting({ seed: 3, character: 'greenhorn' });
    expect(nodeLocked(low, 0, 2)).toBe(true);
    expect(nodeLocked(low, 0, 1)).toBe(false);
    let xp = 0;
    for (let l = 1; l < OUTING.tier2Level; l++) xp += xpToNext(l);
    expect(skillLevel(xp)).toBe(OUTING.tier2Level);
    const high = createOuting({ seed: 3, character: 'greenhorn', xp: [xp, 0, 0, 0] });
    expect(nodeLocked(high, 0, 2)).toBe(false);
    expect(nodeLocked(high, 1, 2)).toBe(true);
  });

  it('a plain player fills a bag and walks out with all of it', () => {
    let kept = 0, home = 0;
    const lines: string[] = [];
    for (let seed = 1; seed <= 6; seed++) {
      const run = createOuting({ seed, character: 'greenhorn' });
      play(run, 900);
      const h = haul(run), o = run.outing!;
      lines.push(`seed ${seed}: ${h.result} at ${Math.round(h.seconds)}s, threat ${h.threat.toFixed(2)}, bag ${bagCount(o)}, hp ${run.player.hp.toFixed(1)}, kills ${h.kills}, broken ${h.broken.join('/')}`);
      if (h.result === 'camp') { home++; expect(h.kept).toEqual(h.carried); }
      kept += h.kept.reduce((a, b) => a + b, 0);
    }
    console.log(lines.join('\n'));
    expect(home).toBeGreaterThanOrEqual(5);
    expect(kept / 6).toBeGreaterThan(100);
  }, 30000);

  it('recall keeps 60% and a fall keeps 30%', () => {
    const run = createOuting({ seed: 5, character: 'greenhorn' });
    run.outing!.bag[0] = 10; run.outing!.bag[2] = 5;
    expect(leaveOuting(run, 'recall')).toBe(true);
    expect(haul(run).kept.slice(0, 3)).toEqual([6, 0, 3]);
    const dead = createOuting({ seed: 5, character: 'greenhorn' });
    dead.outing!.bag[0] = 10;
    dead.outing!.threat = 3;
    for (let t = 0; t < 60 * 600 && dead.phase === 'wave'; t++) { step(dead, { mx: 0, my: 0 }); clearEvents(dead); }
    expect(haul(dead).result).toBe('dead');
    expect(haul(dead).kept[0]).toBe(3);
    expect(MATERIALS.length).toBe(8);
  });

  it('the woods awake are too much to stand in', () => {
    const run = createOuting({ seed: 9, character: 'greenhorn' });
    run.outing!.threat = 1;
    let t = 0;
    for (; t < 60 * 600 && run.phase === 'wave'; t++) { step(run, { mx: 0, my: 0 }); clearEvents(run); }
    console.log(`standing still in the woken woods: down after ${Math.round(t / 60)}s`);
    expect(t / 60).toBeLessThan(240);
  });
});
