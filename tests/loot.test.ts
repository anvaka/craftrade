// The loot prototype: kills drop raws, big kills drop rare materials and schematics; off, nothing changes.
import { describe, expect, it } from 'vitest';
import { botBench, botInput, clearEvents, createBot, createRun, nextWave, stateHash, step, summary, type Run } from '../src/sim/index.ts';

function playOut(run: Run, seed: number): { loot: number; rare: number } {
  const bot = createBot(seed), inp = { mx: 0, my: 0 };
  let loot = 0, rare = 0;
  for (let g = 0; g < 400000 && run.phase !== 'over'; g++) {
    if (run.phase === 'bench') { botBench(run, bot); nextWave(run); continue; }
    botInput(run, bot, inp);
    step(run, inp);
    for (let i = 0; i < run.events.n; i++) { const e = run.events.list[i]; if (e.type === 'loot') { loot++; if (e.a >= 0) rare++; } }
    clearEvents(run);
  }
  return { loot, rare };
}

describe('loot prototype', () => {
  it('is off unless asked for', () => {
    const a = createRun({ seed: 9, character: 'greenhorn' }), b = createRun({ seed: 9, character: 'greenhorn', loot: 0 });
    for (let t = 0; t < 60 * 40; t++) { step(a, { mx: 0, my: 0 }); step(b, { mx: 0, my: 0 }); }
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('pays raws from kills, rare materials, and schematics from elites', () => {
    const lines: string[] = [];
    let schem = 0, rares = 0, raws = 0, plainRaws = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const run = createRun({ seed, character: 'greenhorn', loot: 3 });
      playOut(run, seed);
      const s = summary(run);
      const plain = createRun({ seed, character: 'greenhorn' });
      playOut(plain, seed);
      const ps = summary(plain);
      const g = s.rawsGathered.timber + s.rawsGathered.ore + s.rawsGathered.hide, pg = ps.rawsGathered.timber + ps.rawsGathered.ore + ps.rawsGathered.hide;
      lines.push(`seed ${seed}: wave ${s.endWave}${s.won ? ' won' : ''}, raws ${g} (plain run ${pg}), rare ${s.rare.join('/')}, schematics ${s.found.join(',') || '-'}`);
      schem += s.found.length; rares += s.rare.reduce((a, b) => a + b, 0); raws += g; plainRaws += pg;
      expect(s.found.every((f) => f >= 0 && f < 3)).toBe(true);
    }
    console.log(lines.join('\n'));
    expect(raws).toBeGreaterThan(plainRaws * 1.3);
    expect(rares).toBeGreaterThan(0);
    expect(schem).toBeGreaterThan(0);
  }, 60000);

  it('brings crafted weapons along', () => {
    const run = createRun({ seed: 2, character: 'greenhorn', loot: 3, extraWeapons: [{ id: 'hatchet', tier: 3 }, { id: 'nope', tier: 2 }] });
    expect(run.player.weapons.map((w) => `${w.id}${w.tier}`)).toEqual(['sling1', 'hatchet3']);
  });
});
