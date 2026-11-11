// Survival curve and pacing for one policy.
//   npx tsx tools/exp/fun/survival.ts <policy> [seeds=200] [label] [simRoot] [outDir]
// policy: novice | average | avg-novbench | avg-expbench | expert | expert-lag250 | expert-lag400 | expert-novbench
// simRoot: directory holding sim/ and shared/ (default src/, or a patched copy from mkvariant.mjs).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { average, expert, novice, type Policy } from './policies.ts';

const policyName = process.argv[2] ?? 'novice';
const seeds = Number(process.argv[3] ?? 200);
const label = process.argv[4] ?? 'base';
const simRoot = resolve(process.argv[5] || new URL('../../../src', import.meta.url).pathname);
const outDir = process.argv[6] ?? '';
const character = process.env.CHAR ?? 'greenhorn';
const sim = await import(`${simRoot}/sim/index.ts`);
// Things index.ts does not export but the policies want.
const up = await import(`${simRoot}/sim/data/upgrades.ts`);
const S = { ...sim, UPGRADE_VALUE: up.UPGRADE_VALUE };

function make(seed: number): Policy {
  switch (policyName) {
    case 'novice': return novice(S);
    case 'novice+': return novice(S, { cautious: true });
    case 'average': return average(S);
    case 'avg-novbench': return average(S, { bench: 'novice' });
    case 'avg-expbench': return average(S, { bench: 'expert' });
    case 'expert': return expert(S, seed);
    case 'expert-lag250': return expert(S, seed, { delay: 15 });
    case 'expert-lag400': return expert(S, seed, { delay: 24 });
    case 'expert-novbench': return expert(S, seed, { bench: 'novice' });
    default: throw new Error(`unknown policy ${policyName}`);
  }
}

const W = 12;
const VIEW_W = 1280, VIEW_H = 720;
const mk = () => new Array(W + 1).fill(0);
const deaths = mk(), reached = mk();
const killers: Record<string, number> = {};
const killersEarly: Record<string, number> = {};
let wins = 0;
// Pacing, per wave, summed over runs that played the wave to its end or died in it.
const secs = mk(), kills = mk(), hits = mk(), hurts = mk(), dmgTaken = mk(), levelups = mk(), breaks = mk(), nearDeath = mk(),
  onScreenSum = mk(), onScreenN = mk(), onScreenMax = mk(), liveMax = mk(), scrip = mk(), gapMax = mk(), gapSum = mk(), gapN = mk(),
  deadAir = mk(), raws = mk(), minHpFrac = mk(), wavesPlayed = mk(), tells = mk(), steals = mk(), scripLeft = mk();
const firstKill: number[] = [], firstBreak: number[] = [], firstHurt: number[] = [], firstLevel: number[] = [];
const benchScrip: number[][] = Array.from({ length: W + 1 }, () => []);
const benchAfford: number[][] = Array.from({ length: W + 1 }, () => []);
const levelAtBench: number[][] = Array.from({ length: W + 1 }, () => []);
const weaponsAtWave: number[][] = Array.from({ length: W + 1 }, () => []);
const runSeconds: number[] = [];

const t0 = Date.now();
for (let s = 1; s <= seeds; s++) {
  const seed = s * 7919 + 13;
  const run = S.createRun({ seed, character });
  const pol = make((seed ^ 0x5bd1e995) >>> 0);
  const input = { mx: 0, my: 0 };
  let fk = -1, fb = -1, fh = -1, fl = -1;
  let lastEventT = 0, low = false, waveMinHp = 1, lastWave = 1, waveGapMax = 0;
  reached[1]++;
  weaponsAtWave[1].push(run.player.weapons.length);
  const closeWave = (w: number, t: number): void => {
    const g = t - lastEventT;
    if (g > waveGapMax) waveGapMax = g;
    if (g > 8) deadAir[w] += g - 8;
    gapMax[w] += waveGapMax; wavesPlayed[w]++; minHpFrac[w] += waveMinHp; secs[w] += t;
  };
  for (let guard = 0; guard < 400000 && run.phase !== 'over'; guard++) {
    if (run.phase === 'wave') {
      const w = run.wave;
      pol.input(run, input);
      S.step(run, input);
      const tnow = run.phase === 'wave' ? run.waveTime : run.waveSeconds;
      const q = run.events;
      for (let i = 0; i < q.n; i++) {
        const ev = q.list[i];
        let meaningful = false;
        switch (ev.type) {
          case 'kill': kills[w]++; if (fk < 0) fk = run.tick / 60; break;
          case 'hit': case 'crit': hits[w]++; break;
          case 'hurt': hurts[w]++; dmgTaken[w] += ev.a; if (fh < 0) fh = run.tick / 60; meaningful = true; break;
          case 'levelup': levelups[w]++; if (fl < 0) fl = run.tick / 60; meaningful = true; break;
          case 'break': breaks[w]++; if (fb < 0) fb = run.tick / 60; meaningful = true; break;
          case 'eliteSpawn': case 'bossSpawn': case 'eliteDeath': case 'bossPhase': case 'bossDeath': meaningful = true; break;
          case 'tell': tells[w]++; break;
          case 'steal': steals[w]++; meaningful = true; break;
        }
        if (meaningful) {
          const g = tnow - lastEventT;
          if (g > waveGapMax) waveGapMax = g;
          if (g > 8) deadAir[w] += g - 8;
          gapSum[w] += g; gapN[w]++;
          lastEventT = tnow;
        }
      }
      S.clearEvents(run);
      const p = run.player;
      const frac = p.hp / p.maxHp;
      if (frac < waveMinHp) waveMinHp = Math.max(0, frac);
      if (frac < 0.3 && !low) { low = true; nearDeath[w]++; } else if (frac > 0.5) low = false;
      if (run.tick % 30 === 0) {
        let n = 0;
        for (let i = 0; i < S.MAX_ENEMIES; i++) {
          const e = run.enemies[i];
          if (e.alive && Math.abs(e.x - p.x) < VIEW_W / 2 && Math.abs(e.y - p.y) < VIEW_H / 2) n++;
        }
        onScreenSum[w] += n; onScreenN[w]++;
        if (n > onScreenMax[w]) onScreenMax[w] = n;
        if (run.enemyCount > liveMax[w]) liveMax[w] = run.enemyCount;
      }
      if (run.phase !== 'wave') {
        closeWave(w, tnow);
        scrip[w] += run.scripByWave[w]; raws[w] += run.rawsByWave[w];
        scripLeft[w] += p.bank;
        if (run.phase === 'over' && !run.won) {
          deaths[w]++;
          killers[run.killedBy] = (killers[run.killedBy] ?? 0) + 1;
          if (w <= 4) killersEarly[run.killedBy] = (killersEarly[run.killedBy] ?? 0) + 1;
        }
      }
    } else {
      const w = run.wave;
      benchScrip[w].push(run.player.scrip);
      levelAtBench[w].push(run.player.level);
      let can = 0;
      for (let i = 0; i < 4; i++) if (S.buyBlock(run, i) === null) can++;
      benchAfford[w].push(can);
      pol.bench(run);
      S.nextWave(run);
      reached[run.wave]++;
      weaponsAtWave[run.wave].push(run.player.weapons.length);
      lastEventT = 0; low = false; waveMinHp = 1; waveGapMax = 0; lastWave = run.wave;
    }
  }
  void lastWave;
  if (run.won) wins++;
  firstKill.push(fk); firstBreak.push(fb); firstHurt.push(fh); firstLevel.push(fl);
  runSeconds.push(run.tick / 60);
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const med = (a: number[]) => { const v = a.filter((x) => x >= 0).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : NaN; };
const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '-');
const div = (a: number, b: number) => (b ? a / b : NaN);

const perWave = [];
for (let w = 1; w <= W; w++) {
  const n = wavesPlayed[w];
  perWave.push({
    wave: w, reached: reached[w], deaths: deaths[w], played: n,
    meanSeconds: div(secs[w], n), killsPerSec: div(kills[w], secs[w]), hitsPerSec: div(hits[w], secs[w]),
    hurtsPerWave: div(hurts[w], n), dmgTakenPerWave: div(dmgTaken[w], n), minHpFrac: div(minHpFrac[w], n),
    nearDeathPerWave: div(nearDeath[w], n), levelupsPerWave: div(levelups[w], n), breaksPerWave: div(breaks[w], n),
    onScreenMean: div(onScreenSum[w], onScreenN[w]), onScreenMax: onScreenMax[w], liveMax: liveMax[w],
    scripPerWave: div(scrip[w], n), rawsPerWave: div(raws[w], n), scripLeftOnGround: div(scripLeft[w], n),
    meanGap: div(gapSum[w], gapN[w]), meanLongestGap: div(gapMax[w], n), deadAirSecPerWave: div(deadAir[w], n),
    tellsPerWave: div(tells[w], n),
    benchScrip: mean(benchScrip[w]), benchAffordable: mean(benchAfford[w]), levelAtBench: mean(levelAtBench[w]),
    weaponsAtStart: mean(weaponsAtWave[w]),
  });
}
const out = {
  policy: policyName, label, character, seeds, simRoot, wins, winRate: wins / seeds,
  deaths: deaths.slice(1), reached: reached.slice(1), killers, killersEarly,
  diedBy2: (deaths[1] + deaths[2]) / seeds, reachedWave4: reached[4] / seeds, reachedWave5: reached[5] / seeds, reachedWave7: reached[7] / seeds,
  medianDeathWave: (() => { const a: number[] = []; for (let w = 1; w <= W; w++) for (let k = 0; k < deaths[w]; k++) a.push(w); return a.length ? a[Math.floor(a.length / 2)] : null; })(),
  firstKillMedian: med(firstKill), firstBreakMedian: med(firstBreak), firstHurtMedian: med(firstHurt), firstLevelMedian: med(firstLevel),
  firstBreakShare: firstBreak.filter((x) => x >= 0 && x <= 20).length / seeds,
  meanRunSeconds: mean(runSeconds), perWave, wallSeconds: (Date.now() - t0) / 1000,
};
if (outDir) { mkdirSync(outDir, { recursive: true }); writeFileSync(`${outDir}/${policyName}.${label}.json`, JSON.stringify(out, null, 1)); }

console.log(`\n== ${policyName} / ${label} / ${character} (${seeds} seeds) ==`);
console.log(`win ${f(100 * out.winRate)}%  died in waves 1-2: ${f(100 * out.diedBy2)}%  reached wave 4: ${f(100 * out.reachedWave4)}%  wave 5: ${f(100 * out.reachedWave5)}%  wave 7: ${f(100 * out.reachedWave7)}%  median death wave ${out.medianDeathWave}`);
console.log(`deaths by wave: ${out.deaths.map((n, i) => `${i + 1}:${n}`).join(' ')}`);
console.log(`killed by: ${Object.entries(killers).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
if (process.env.VERBOSE) {
  console.log(`first kill ${f(out.firstKillMedian)} s, first hurt ${f(out.firstHurtMedian)} s, first level ${f(out.firstLevelMedian)} s, first node ${f(out.firstBreakMedian)} s (in wave 1 for ${f(100 * out.firstBreakShare)}%)`);
  console.log('wave  n   k/s  hit/s hurts dmg  minHP nearD lvl  node onScr max  scrip raws gap  longGap deadAir benchScrip afford weapons');
  for (const r of perWave) {
    console.log([r.wave, r.played, f(r.killsPerSec), f(r.hitsPerSec), f(r.hurtsPerWave), f(r.dmgTakenPerWave), f(r.minHpFrac, 2), f(r.nearDeathPerWave, 2),
      f(r.levelupsPerWave), f(r.breaksPerWave), f(r.onScreenMean), r.onScreenMax, f(r.scripPerWave, 0), f(r.rawsPerWave), f(r.meanGap), f(r.meanLongestGap),
      f(r.deadAirSecPerWave), f(r.benchScrip, 0), f(r.benchAffordable), f(r.weaponsAtStart)].map((x) => String(x).padStart(5)).join(' '));
  }
}
