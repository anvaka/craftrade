// Headless balance report.  npx tsx src/sim/balance.ts [seeds=200] [character|all] [waves=12]
import { CHARACTERS } from './data/characters.ts';
import { ENEMIES, ENEMY_INDEX } from './data/enemies.ts';
import { MAX_ENEMIES } from './data/tuning.ts';
import { WEAPONS } from './data/weapons.ts';
import { playRun } from './bot.ts';
import { spawnEnemy } from './core.ts';
import { clearEvents, createRun, step, summary } from './run.ts';
import { STATS } from '../shared/vocab.ts';
import type { CharacterId } from '../shared/protocol.ts';
import { fireShot } from './weapons.ts';

const seeds = Number(process.argv[2] ?? 200);
const who = process.argv[3] ?? 'all';
const waves = Number(process.argv[4] ?? 12);

const median = (a: number[]) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) + '%' : '-');
const top = (m: Map<string, number>, total: number, n = 13) =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${pct(v, total)}`).join(', ');

function report(character: CharacterId): void {
  let wins = 0, ticks = 0, ms = 0;
  const deathWaves: number[] = [], levels: number[] = [], killers = new Map<string, number>();
  const scripW: number[][] = [], rawsW: number[][] = [];
  const weaponBuys = new Map<string, number>(), statPicks = new Map<string, number>(), itemBuys = new Map<string, number>();
  const dmgShare = new Map<string, number>();
  let wBuys = 0, sPicks = 0, iBuys = 0, dmgTotal = 0, fusions = 0, hpEnd = 0;
  for (let s = 1; s <= seeds; s++) {
    const t0 = performance.now();
    const run = playRun({ seed: s * 7919 + 13, character, waves });
    ms += performance.now() - t0; ticks += run.tick;
    const sum = summary(run);
    levels.push(sum.level);
    fusions += sum.fusions.length;
    for (let w = 1; w <= run.totalWaves; w++) {
      if (w > sum.wavesCleared) break;
      (scripW[w] ??= []).push(run.scripByWave[w]); (rawsW[w] ??= []).push(run.rawsByWave[w]);
    }
    if (sum.won) {
      wins++; hpEnd += run.player.hp / run.player.maxHp;
      for (const id of run.buyLog) {
        if (WEAPONS.some((w) => w.id === id)) { weaponBuys.set(id, (weaponBuys.get(id) ?? 0) + 1); wBuys++; }
        else { itemBuys.set(id, (itemBuys.get(id) ?? 0) + 1); iBuys++; }
      }
      for (const st of run.upgradeLog) { statPicks.set(st, (statPicks.get(st) ?? 0) + 1); sPicks++; }
      for (const [k, v] of Object.entries(sum.damageBy)) { dmgShare.set(k, (dmgShare.get(k) ?? 0) + v); dmgTotal += v; }
    } else {
      deathWaves.push(sum.endWave);
      killers.set(sum.killedBy, (killers.get(sum.killedBy) ?? 0) + 1);
    }
  }
  const hist = new Array(waves + 1).fill(0);
  for (const w of deathWaves) hist[w]++;
  console.log(`\n== ${character} (${seeds} seeds, ${waves} waves) ==`);
  console.log(`win rate ${pct(wins, seeds)}   median death wave ${median(deathWaves)}   level at end: median ${median(levels)}, mean ${mean(levels).toFixed(1)}`);
  console.log(`deaths by wave: ${hist.slice(1).map((n, i) => `${i + 1}:${n}`).join(' ')}   (before wave 7: ${pct(deathWaves.filter((w) => w < 7).length, deathWaves.length)} of deaths)`);
  console.log(`killed by: ${top(killers, deathWaves.length)}`);
  console.log(`scrip per wave (mean): ${scripW.slice(1).map((a) => Math.round(mean(a))).join(' ')}`);
  console.log(`raws per wave (mean):  ${rawsW.slice(1).map((a) => mean(a).toFixed(1)).join(' ')}`);
  console.log(`winners: weapon buys: ${top(weaponBuys, wBuys)}`);
  console.log(`winners: upgrade picks: ${top(statPicks, sPicks)}`);
  console.log(`winners: item buys (top 10 of ${itemBuys.size} bought): ${top(itemBuys, iBuys, 10)}`);
  console.log(`winners: damage share: ${top(dmgShare, dmgTotal, 17)}`);
  console.log(`winners end at ${wins ? ((100 * hpEnd) / wins).toFixed(0) : '-'}% HP on average; fusions per run ${(fusions / seeds).toFixed(2)}`);
  console.log(`time per tick incl. bot: ${(ms / ticks).toFixed(4)} ms over ${ticks} ticks`);
}

/** Sim-only cost at the live cap: 300 enemies, shots in the air, pickups on the ground. */
function stress(): void {
  const run = createRun({ seed: 99, character: 'greenhorn' });
  run.wave = 10;
  const p = run.player;
  p.base[0] = 100000; p.hp = 100000;
  const input = { mx: 0, my: 0 };
  let worst = 0, total = 0, n = 0, peakE = 0, peakS = 0, peakP = 0;
  for (let t = 0; t < 3600; t++) {
    for (let k = run.enemyCount; k < MAX_ENEMIES; k++) {
      const type = [ENEMY_INDEX.mite, ENEMY_INDEX.gnat, ENEMY_INDEX.boar, ENEMY_INDEX.spitter, ENEMY_INDEX.brute, ENEMY_INDEX.burrower][(t + k) % 6];
      spawnEnemy(run, type, p.x + Math.cos(k * 2.4 + t) * (200 + (k % 9) * 55), p.y + Math.sin(k * 2.4 + t) * (200 + (k % 7) * 60), 0.1);
    }
    if (t % 2 === 0) for (let k = 0; k < 8; k++) fireShot(run, p.x, p.y, Math.cos(t + k), Math.sin(t + k), 600, 9, 5, 500, 1, 1, false, 4, 1, 0, true);
    p.hp = 100000; run.waveTime = 1; run.phase = 'wave';
    input.mx = Math.cos(t / 40); input.my = Math.sin(t / 40);
    const t0 = performance.now();
    step(run, input);
    const dt = performance.now() - t0;
    clearEvents(run);
    if (t > 300) { total += dt; n++; if (dt > worst) worst = dt; }
    let s = 0, pk = 0;
    for (const x of run.shots) if (x.alive) s++;
    for (const x of run.pickups) if (x.alive) pk++;
    if (run.enemyCount > peakE) peakE = run.enemyCount; if (s > peakS) peakS = s; if (pk > peakP) peakP = pk;
  }
  console.log(`\n== stress: sim only, ${peakE} enemies, up to ${peakS} shots and ${peakP} pickups ==`);
  console.log(`mean ${(total / n).toFixed(4)} ms per tick, worst ${worst.toFixed(3)} ms (budget 2 ms)`);
}

const list = who === 'all' ? CHARACTERS.map((c) => c.id) : who === 'stress' ? [] : [who as CharacterId];
for (const c of list) report(c);
stress();
void ENEMIES; void STATS;
