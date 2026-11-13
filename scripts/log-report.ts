// Reads a play log exported from the game (Character → Record → Play log → Save as a file) and prints what it says
// about balance. Usage: npm run log -- path/to/craftworld-log.json
// It reports what happened. It does not judge fun.
// @ts-expect-error the project carries no Node type definitions
import fs from 'node:fs';
import type { LogRun, LogTown } from '../src/log';

declare const process: { argv: string[]; exit(code: number): never };
const file = process.argv[2];
if (!file) {
  console.error('usage: npm run log -- <exported log file>');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { exported: string; since: string; waves: number; now: Record<string, unknown>; runs: LogRun[]; town: LogTown[] };
const runs = data.runs;
const done = runs.filter((r) => r.end);
const WAVES = data.waves || 12;

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f0 = (n: number) => n.toFixed(0);
const f1 = (n: number) => n.toFixed(1);
const sum = (rec: Record<string, number>) => Object.values(rec).reduce((a, b) => a + b, 0);
const tally = (xs: string[]) => Object.entries(xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
const list = (rows: [string, number][], of = 0, top = 12) => rows.slice(0, top).map(([k, n]) => `${k} ${n}${of ? ` (${f0((n / of) * 100)}%)` : ''}`).join(', ') || 'none';
const head = (t: string) => console.log(`\n${t}\n${'-'.repeat(t.length)}`);

console.log(`Play log exported ${data.exported.slice(0, 16).replace('T', ' ')}, kept since ${data.since.slice(0, 10)}.`);
console.log(`${runs.length} expeditions (${done.length} finished), ${data.town.length} town actions.`);
const now = data.now as { coin: number; key: number; stats: { runs: number; clears: number; deaths: number; bestWave: number }; gear: string[] };
console.log(`Now: coin ${now.coin}, key ${now.key}, ${now.stats.runs} begun, ${now.stats.clears} full clears, ${now.stats.deaths} falls, deepest wave ${now.stats.bestWave}, ${now.gear.length} pieces of gear.`);
if (!runs.length) process.exit(0);

head('Expeditions');
console.log(`${pad('#', 4)}${pad('date', 12)}${pad('kit', 11)}${pad('dgr', 4)}${pad('start', 7)}${pad('outcome', 11)}${lpad('waves', 5)}${lpad('lvl', 5)}${lpad('min', 6)}${lpad('kept', 6)}${lpad('lost', 6)}${lpad('coin', 6)}  ended by`);
runs.forEach((r, i) => {
  const e = r.end;
  const last = r.waves[r.waves.length - 1];
  console.log(`${pad(i + 1, 4)}${pad(r.at.slice(5, 10) + ' ' + r.at.slice(11, 16), 12)}${pad(r.kit, 11)}${pad(r.danger, 4)}${pad(r.race ? 'race' : r.guidedStep ? `g${r.guidedStep}` : 'open', 7)}${pad(e?.outcome ?? 'unfinished', 11)}${lpad(e?.wavesCleared ?? r.waves.filter((w) => !w.died).length, 5)}${lpad(e?.level ?? last?.level ?? 1, 5)}${lpad(f1((e?.secs ?? 0) / 60), 6)}${lpad(e ? sum(e.kept) : '', 6)}${lpad(e ? sum(e.lost) : '', 6)}${lpad(e?.coin ?? '', 6)}  ${last?.died ? `${last.killer ?? 'a fall'} in wave ${last.i + 1}` : e?.outcome === 'died' ? 'left or abandoned' : ''}`);
});

head('How expeditions ended');
console.log(list(tally(done.map((r) => r.end!.outcome)), done.length));
const deaths = runs.flatMap((r) => r.waves.filter((w) => w.died));
console.log(`Falls by wave: ${Array.from({ length: WAVES }, (_, i) => deaths.filter((w) => w.i === i).length).map((n, i) => `${i + 1}:${n}`).join('  ')}`);
console.log(`Killed by: ${list(tally(deaths.map((w) => w.killer ?? 'unknown')), deaths.length)}`);
const pushes = runs.flatMap((r) => r.events.filter((e) => e.a === 'push' || e.a === 'extract'));
console.log(`At gates: pushed on ${pushes.filter((e) => e.a === 'push').length}, extracted ${pushes.filter((e) => e.a === 'extract').length}.`);

head('By wave (averages over the times each wave was played)');
console.log(`${pad('wave', 6)}${lpad('played', 7)}${lpad('fell', 6)}${lpad('hp in%', 8)}${lpad('dmg', 6)}${lpad('kills', 7)}${lpad('hot', 6)}${lpad('heat pk', 9)}${lpad('gather s', 10)}${lpad('units', 7)}${lpad('+heat', 7)}${lpad('scrap', 7)}${lpad('bag/comf', 10)}${lpad('obj%', 6)}`);
for (let i = 0; i < WAVES; i++) {
  const ws = runs.flatMap((r) => r.waves.filter((w) => w.i === i));
  if (!ws.length) continue;
  const withObj = ws.filter((w) => w.objective !== 'none');
  console.log(`${pad(`${i + 1}${ws[0].boss ? ' B' : ''}`, 6)}${lpad(ws.length, 7)}${lpad(ws.filter((w) => w.died).length, 6)}${lpad(f0(avg(ws.map((w) => (w.hpStart / Math.max(1, w.maxHp)) * 100))), 8)}${lpad(f0(avg(ws.map((w) => w.dmgTaken))), 6)}${lpad(f0(avg(ws.map((w) => w.kills))), 7)}${lpad(f0(avg(ws.map((w) => w.hotSpawned))), 6)}${lpad(f0(avg(ws.map((w) => w.heatPeak))), 9)}${lpad(f1(avg(ws.map((w) => w.gatherSecs))), 10)}${lpad(f0(avg(ws.map((w) => sum(w.gathered)))), 7)}${lpad(f0(avg(ws.map((w) => w.heatBonus))), 7)}${lpad(f0(avg(ws.map((w) => w.scrap))), 7)}${lpad(`${f0(avg(ws.map((w) => w.bagWeight)))}/${f0(avg(ws.map((w) => w.comfort)))}`, 10)}${lpad(withObj.length ? f0((withObj.filter((w) => w.objDone).length / withObj.length) * 100) : '-', 6)}`);
}
const bossW = runs.flatMap((r) => r.waves.filter((w) => w.boss));
if (bossW.length) console.log(`Boss waves: ${bossW.length} played, boss killed in ${bossW.filter((w) => w.bossKilled).length}, fell in ${bossW.filter((w) => w.died).length}.`);

head('By ground');
for (const [g] of tally(runs.flatMap((r) => r.waves.map((w) => w.ground)))) {
  const ws = runs.flatMap((r) => r.waves.filter((w) => w.ground === g));
  console.log(`${pad(g, 8)} ${ws.length} waves, ${ws.filter((w) => w.died).length} falls, ${f0(avg(ws.map((w) => w.dmgTaken)))} damage taken, ${f0(avg(ws.map((w) => sum(w.gathered))))} units, heat peak ${f0(avg(ws.map((w) => w.heatPeak)))}`);
}

head('What did the damage');
const dmg: Record<string, { dmg: number; kills: number; slots: number }> = {};
let heavy = 0;
let ability = 0;
for (const w of runs.flatMap((r) => r.waves)) {
  for (const x of w.weapons) {
    const fam = x.w.replace(/ (I|II|III|IV|V)( \(.*\))?$/, '').replace(/ \(.*\)$/, '');
    const d = (dmg[fam] ??= { dmg: 0, kills: 0, slots: 0 });
    d.dmg += x.dmg;
    d.kills += x.kills;
    d.slots++;
  }
  heavy += w.heavyDmg;
  ability += w.abilityDmg;
}
const total = Object.values(dmg).reduce((a, d) => a + d.dmg, 0) + heavy + ability || 1;
for (const [k, d] of Object.entries(dmg).sort((a, b) => b[1].dmg - a[1].dmg)) console.log(`${pad(k, 22)}${lpad(f0((d.dmg / total) * 100), 4)}% of all damage · ${lpad(f0(d.dmg / d.slots), 6)} a wave for each slot it held (${d.slots} slot-waves) · ${d.kills} kills`);
console.log(`${pad('Heavy swing', 22)}${lpad(f0((heavy / total) * 100), 4)}%`);
console.log(`${pad('Abilities and effects', 22)}${lpad(f0((ability / total) * 100), 4)}%`);

head('Camp');
const ev = runs.flatMap((r) => r.events);
const of = (a: string) => ev.filter((e) => e.a === a);
console.log(`Bought: ${list(tally(of('buy').map((e) => (e.what ?? '?').replace(/ for \d+$/, ''))), 0, 20)}`);
console.log(`Rerolls: ${of('reroll').length} (${f1(of('reroll').length / Math.max(1, runs.length))} an expedition) · merges ${of('merge').length} · sold ${of('sell').length} · evolved ${of('evolve').length}`);
console.log(`Camp crafts: ${list(tally(of('craft').map((e) => e.what ?? '?')))}`);
console.log(`Flasks drunk: ${list(tally(of('drink').map((e) => e.what ?? '?')))}`);
console.log(`Level picks: ${list(tally(of('levelpick').map((e) => e.what ?? '?')), 0, 20)}`);
console.log(`Wild picks: ${list(tally(of('wild').map((e) => e.what ?? '?')))}`);
const routes = of('route');
console.log(`Routes chosen: ${list(tally(routes.map((e) => (e.what ?? '?').split(' · ')[0])), routes.length)}`);
console.log(`Objectives chosen: ${list(tally(routes.map((e) => (e.what ?? '?').split(' · ')[1]?.split(':')[0] ?? '?')), routes.length)} · shrines taken ${routes.filter((e) => /shrine/.test(e.what ?? '')).length}`);
console.log(`Scrap left unspent at the end: ${f0(avg(done.map((r) => r.end!.scrapLeft)))} on average.`);

head('Town');
const made = data.town.filter((t) => t.a === 'make' || t.a === 'brew');
console.log(`Crafts and brews: ${made.length}. ${list(tally(made.map((t) => `${t.a} ${(t.what ?? '').split(' · ')[0]}`.trim())), 0, 15)}`);
console.log(`Sold ${data.town.filter((t) => t.a === 'sellmat').length} times, gave to projects ${data.town.filter((t) => t.a === 'donate').length}, dismantled ${data.town.filter((t) => t.a === 'scrapgear').length}, learned ${data.town.filter((t) => t.a === 'learn').length}, cards ${data.town.filter((t) => t.a === 'card').length}.`);
const first = runs[0].town;
const lastRun = runs[runs.length - 1].town;
console.log(`From the first logged expedition to the last: key ${first.key} → ${lastRun.key}, standing ${first.standing} → ${lastRun.standing}, coin ${first.coin} → ${lastRun.coin}.`);
const grow = (a: Record<string, number>, b: Record<string, number>) => Object.keys(b).filter((k) => b[k] !== a[k]).map((k) => `${k} ${a[k] ?? 1} → ${b[k]}`).join(', ') || 'no change';
console.log(`Skills: ${grow(first.skills, lastRun.skills)}`);
console.log(`Mastery: ${grow(first.mastery, lastRun.mastery)}`);
console.log(`Stations: ${grow(first.stations, lastRun.stations)}`);
