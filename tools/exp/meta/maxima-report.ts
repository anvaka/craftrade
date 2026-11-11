// Turn the lines written by maxima.ts into the cap tables in server/config.ts, and check the tables
// against every run measured: the false-refusal rate must be 0.
//   npx tsx tools/exp/meta/maxima-report.ts <dir with *.jsonl> [check]
// With "check", the tables printed are ignored and the ones in server/config.ts are tested instead.
import { readdirSync, readFileSync } from 'node:fs';
import { BOSS_WAVE_MIN_SECONDS, MIN_REPORT_SECONDS, REPORT_CAPS, SCRIP_PAID_CAP } from '../../../server/config.ts';
import { minDurationMs } from '../../../server/runs.ts';
import { table } from './simlib.ts';

const dir = process.argv[2];
const check = process.argv[3] === 'check';
const rows: any[] = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
  for (const line of readFileSync(`${dir}/${f}`, 'utf8').split('\n')) if (line.trim()) rows.push(JSON.parse(line));
}
const base = rows.filter((r) => r.cfg === 'expert' || r.cfg === 'average' || r.cfg === 'idle');
const st5 = rows.filter((r) => r.cfg === 'st5');
const all = rows;
console.log(`${rows.length} runs: ${['expert', 'average', 'idle', 'st5', 'cap5'].map((c) => `${c} ${rows.filter((r) => r.cfg === c).length}`).join(', ')}`);
console.log(`characters: ${[...new Set(rows.map((r) => r.character))].join(', ')}; seeds per character (expert): ${new Set(rows.filter((r) => r.cfg === 'expert').map((r) => r.seed)).size}`);
const ms = rows.filter((r) => r.cfg === 'expert').map((r) => r.ms / Math.max(1, r.seconds));
console.log(`sim speed while measuring (three processes on a shared machine): ${(1000 / (ms.reduce((a, b) => a + b, 0) / ms.length)).toFixed(0)}x real time on average`);

/** Largest cumulative value at the end of wave w (1..12) over a set of runs. */
const maxAt = (set: any[], field: string, w: number) => Math.max(0, ...set.map((r) => r[field][w] ?? 0));
const WAVES = 12;
// Index k = waves cleared: the run died in wave k + 1, so it holds at most what a run held at the end of wave k + 1.
const envelope = (set: any[], field: string, mul: number, round = 5) => {
  const out: number[] = [];
  for (let k = 0; k <= WAVES; k++) {
    const w = Math.min(WAVES, k + 1);
    const v = Math.ceil((maxAt(set, field, w) * mul) / round) * round;
    out.push(Math.max(v, out[k - 1] ?? 0));
  }
  return out;
};
const noKit = all.filter((r) => r.cfg !== 'cap5' && r.cfg !== 'st5');
const stationsOne = all.filter((r) => r.cfg !== 'st5' && r.cfg !== 'cap5');
const rawsOne = envelope(stationsOne, 'rawsAt', 1.5, 1);
const eachOne = envelope(stationsOne, 'perRaw', 1.5, 1);
// Station lift: how much more the tier 5 runs gathered than tier 1 runs at their worst wave, spread over four tier steps.
let lift = 0;
for (let w = 1; w <= WAVES; w++) {
  const a = maxAt(base, 'rawsAt', w), b = maxAt(rows.filter((r) => r.cfg === 'st5' || r.cfg === 'cap5'), 'rawsAt', w);
  const c = maxAt(base, 'perRaw', w), d = maxAt(rows.filter((r) => r.cfg === 'st5' || r.cfg === 'cap5'), 'perRaw', w);
  if (a > 0) lift = Math.max(lift, b / a - 1);
  if (c > 0) lift = Math.max(lift, d / c - 1);
}
const perTier = Math.ceil((lift / 4) * 100) / 100;
const wins = all.filter((r) => r.won);
const boss = Math.min(...wins.map((r) => r.waveTicks[12] / 60));
const idle = rows.filter((r) => r.cfg === 'idle');
const idleDeath = idle.length ? Math.min(...idle.map((r) => r.seconds)) : NaN;
const firstDeath = Math.min(...all.filter((r) => !r.won).map((r) => r.seconds));

const tables = {
  scripEarned: envelope(all, 'earned', 1.5),
  kills: envelope(all, 'killsAt', 1.5),
  rawsTotal: rawsOne,
  rawsEach: eachOne,
  held: envelope(all, 'held', 1.25),
};
console.log('\nLargest seen at the end of each wave (all configurations):');
console.log(table(Array.from({ length: WAVES }, (_, i) => ({
  wave: i + 1, 'scrip earned': maxAt(all, 'earned', i + 1), 'scrip held': maxAt(all, 'held', i + 1), kills: maxAt(all, 'killsAt', i + 1),
  'raws, stations 1': maxAt(stationsOne, 'rawsAt', i + 1), 'raws, stations 5': maxAt(st5.concat(rows.filter((r) => r.cfg === 'cap5')), 'rawsAt', i + 1),
  'one raw, stations 1': maxAt(stationsOne, 'perRaw', i + 1),
  'highest tier bought': Math.max(0, ...noKit.map((r) => r.maxTier[i + 1] ?? 0)),
}))));
console.log(`\nfastest boss wave: ${boss.toFixed(1)} s (of ${wins.length} wins); fastest win: ${Math.min(...wins.map((r) => r.seconds)).toFixed(0)} s of waves`);
console.log(`fastest death of a player who never moves: ${idleDeath.toFixed(1)} s; fastest death of any bot: ${firstDeath.toFixed(1)} s`);
console.log(`most fusions in one run: ${Math.max(...all.map((r) => r.fusions))}; station lift at tier 5: +${(lift * 100).toFixed(0)}% -> ${perTier} per tier step`);
console.log('\nFor server/config.ts:');
console.log(`  scripEarned: [${tables.scripEarned.join(', ')}],`);
console.log(`  kills: [${tables.kills.join(', ')}],`);
console.log(`  rawsTotal: [${tables.rawsTotal.join(', ')}],`);
console.log(`  rawsEach: [${tables.rawsEach.join(', ')}],`);
console.log(`  rawsPerStationTier: ${perTier},`);
console.log(`SCRIP_PAID_CAP = [${tables.held.join(', ')}];`);
// What an ordinary run holds: the 75th percentile over no-kit runs at tier 1 stations. An unchecked report is paid up to this.
const pctAt = (set: any[], field: string, w: number, q: number) => {
  const v = set.map((r) => r[field][w]).filter((x) => x !== undefined && x !== null).sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * q))] : 0;
};
const typical = (field: string) => {
  const out: number[] = [];
  for (let k = 0; k <= WAVES; k++) out.push(Math.max(Math.ceil(pctAt(base.filter((r) => r.cfg !== 'idle'), field, Math.min(WAVES, k + 1), 0.75)), out[k - 1] ?? 0));
  return out;
};
console.log(`UNCHECKED_PAY = { scripHeld: [${typical('held').join(', ')}], rawsTotal: [${typical('rawsAt').join(', ')}] };`);
console.log(`BOSS_WAVE_MIN_SECONDS = ${Math.floor(boss * 0.7)}; MIN_REPORT_SECONDS = ${Math.max(3, Math.floor(Math.min(idleDeath, firstDeath) * 0.6))};`);

if (check) {
  // Would the server refuse any measured run? The rules are those of checkReport in server/runs.ts.
  const k = (r: any) => Math.min(WAVES, r.wavesCleared + (r.wavesCleared >= WAVES ? 0 : 0));
  let refused = 0, clamped = 0; const why: Record<string, number> = {};
  const hit = (w: string) => { why[w] = (why[w] ?? 0) + 1; return true; };
  for (const r of all) {
    const i = k(r), tier = r.cfg === 'st5' || r.cfg === 'cap5' ? 5 : 1, l = 1 + REPORT_CAPS.rawsPerStationTier * (tier - 1);
    const each = ['timber', 'ore', 'hide'].map((x) => r.raws[x] + r.mule[x]);
    const muleTotal = r.mule.timber + r.mule.ore + r.mule.hide;
    const muleWaves = r.wavesCleared >= 8 ? 8 : r.wavesCleared >= 4 ? 4 : 0;
    let bad = false;
    if (r.scripEarned > REPORT_CAPS.scripEarned[i]) bad = hit('scripEarned');
    if (r.scripHeld > r.scripEarned + 400) bad = hit('held over earned');
    if (r.kills > REPORT_CAPS.kills[i]) bad = hit('kills');
    if (each.some((n) => n > REPORT_CAPS.rawsEach[i] * l)) bad = hit('rawsEach');
    if (each.reduce((a, b) => a + b, 0) > REPORT_CAPS.rawsTotal[i] * l) bad = hit('rawsTotal');
    if (muleTotal > (muleWaves ? REPORT_CAPS.rawsTotal[muleWaves - 1] * l : 0)) bad = hit('mule');
    if (r.fusions > REPORT_CAPS.fusions) bad = hit('fusions');
    if (r.seconds * 1000 < minDurationMs(r.wavesCleared)) bad = hit('too fast');
    if (r.cfg !== 'idle' && r.seconds < MIN_REPORT_SECONDS) hit('under the floor (unpaid, not refused)');
    if (r.scripHeld > SCRIP_PAID_CAP[i]) clamped++;
    if (bad) refused++;
  }
  console.log(`\nCHECK against server/config.ts: ${refused} of ${all.length} measured runs would be refused (${(100 * refused / all.length).toFixed(2)}%). ${JSON.stringify(why)}`);
  console.log(`runs whose scrip held is over the paid cap (paid at the cap, not refused): ${clamped}`);
  console.log(`BOSS_WAVE_MIN_SECONDS ${BOSS_WAVE_MIN_SECONDS}, MIN_REPORT_SECONDS ${MIN_REPORT_SECONDS}`);
  if (refused) process.exitCode = 1;
}
