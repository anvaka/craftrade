// The forge game in the run: made weapons replace the free one, the bench sells none,
// tier 2 nodes want a tool of tier 2, and drops come in four colours with a floor under bad luck.
import { describe, expect, it } from 'vitest';
import {
  PARTS, PITY, PK_RELIC, botBench, botInput, clearEvents, createBot, createRun, nextWave, stateHash, step, summary, tierUpBlock,
  type MadeWeapon, type Run,
} from '../src/sim/index.ts';

const sling: MadeWeapon = { id: 'sling', tier: 1, mul: 1.05, cap: 2, sockets: 1 };
const pick2: MadeWeapon = { id: 'pick', tier: 2, mul: 1, cap: 3, sockets: 2 };

function playOut(run: Run, seed: number): Record<string, number> {
  const bot = createBot(seed), inp = { mx: 0, my: 0 };
  const seen: Record<string, number> = {};
  for (let g = 0; g < 400000 && run.phase !== 'over'; g++) {
    if (run.phase === 'bench') {
      for (const o of run.bench.offers) if (o.kind === 'weapon') seen.weaponOffer = (seen.weaponOffer ?? 0) + 1;
      botBench(run, bot); nextWave(run); continue;
    }
    botInput(run, bot, inp);
    step(run, inp);
    for (let i = 0; i < run.events.n; i++) { const e = run.events.list[i]; if (e.type === 'glint') seen[`glint${e.a}`] = (seen[`glint${e.a}`] ?? 0) + 1; if (e.type === 'locked') seen.locked = (seen.locked ?? 0) + 1; }
    clearEvents(run);
  }
  return seen;
}

describe('forge game', () => {
  it('is off unless asked for', () => {
    const a = createRun({ seed: 9, character: 'greenhorn' }), b = createRun({ seed: 9, character: 'greenhorn' });
    for (let t = 0; t < 60 * 40; t++) { step(a, { mx: 0, my: 0 }); step(b, { mx: 0, my: 0 }); }
    expect(a.forge).toBeNull();
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('takes the made weapons in place of the free one, with their quality and cap', () => {
    const run = createRun({ seed: 2, character: 'sawyer', forge: { zone: 1, pity: 0, weapons: [sling, pick2, { id: 'nope', tier: 1, mul: 1, cap: 2, sockets: 0 }], kit: [] } });
    expect(run.player.weapons.map((w) => `${w.id}${w.tier}x${w.mul}/${w.cap}`)).toEqual(['sling1x1.05/2', 'pick2x1/3']);
    expect(run.forge!.sockets).toBe(3);
    run.phase = 'bench'; run.player.scrip = 9999; run.bench.index = 11;
    run.player.weapons[0].tier = 2;
    expect(tierUpBlock(run, 0)).toMatch(/one tier/);
  });

  it('sells no weapons, drops in colours, and pays tier 2 and keys', () => {
    const lines: string[] = [];
    let weaponOffers = 0, t2 = 0, parts = 0, schem = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const run = createRun({ seed, character: 'greenhorn', forge: { zone: 1, pity: 0, weapons: [sling, { id: 'knife', tier: 1, mul: 1, cap: 2, sockets: 0 }], kit: [] } });
      const seen = playOut(run, seed);
      const s = summary(run), f = s.forge!;
      weaponOffers += seen.weaponOffer ?? 0;
      t2 += f.t2.reduce((a, b) => a + b, 0); parts += f.parts.length; schem += f.schematics;
      lines.push(`seed ${seed}: wave ${s.endWave}${s.won ? ' won' : ''}, raws ${s.rawsGathered.timber + s.rawsGathered.ore + s.rawsGathered.hide}, t2 ${f.t2.join('/')}, parts ${f.parts.map((p) => PARTS[p].id).join(',') || '-'} (fitted ${f.fitted.length}), schematics ${f.schematics}, relics ${f.relics.join(',') || '-'}, glints ${seen.glint2 ?? 0}/${seen.glint3 ?? 0}/${seen.glint4 ?? 0}, door bumps ${seen.locked ?? 0}`);
      expect(f.fitted.length).toBeLessThanOrEqual(1);
    }
    console.log(lines.join('\n'));
    expect(weaponOffers).toBe(0);
    expect(t2).toBeGreaterThan(0);
    expect(parts).toBeGreaterThan(0);
    expect(schem).toBeGreaterThan(0);
  }, 60000);

  it('the boss always drops a relic after a long enough drought', () => {
    let won = 0, relics = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const run = createRun({ seed, character: 'greenhorn', forge: { zone: 1, pity: PITY, weapons: [{ id: 'sling', tier: 3, mul: 1.1, cap: 4, sockets: 1 }], kit: [] } });
      run.player.base[0] += 200;
      playOut(run, seed);
      if (run.won) { won++; if (run.forge!.relics.length) relics++; }
    }
    expect(won).toBeGreaterThan(0);
    expect(relics).toBe(won);
    expect(PK_RELIC).toBe(17);
  }, 60000);

  it('the fen is harder', () => {
    const a = createRun({ seed: 4, character: 'greenhorn', forge: { zone: 1, pity: 0, weapons: [sling], kit: [] } });
    const b = createRun({ seed: 4, character: 'greenhorn', forge: { zone: 2, pity: 0, weapons: [sling], kit: [] } });
    for (let t = 0; t < 60 * 8; t++) { step(a, { mx: 0, my: 0 }); step(b, { mx: 0, my: 0 }); }
    const hp = (r: Run) => r.enemies.filter((e) => e.alive).reduce((m, e) => Math.max(m, e.maxHp), 0);
    expect(hp(b)).toBeGreaterThan(hp(a) * 1.5);
  });
});
