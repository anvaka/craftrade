// Tables for docs/critique/depth-after.md from the JSONL written by run.ts.
//   npx tsx tools/exp/depth/after.ts <dir> [section ...]     sections: wins curve bench build content (default: all)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { PRIMITIVES, STATS } from '../../../src/shared/vocab.ts';
import { WEAPONS } from '../../../src/sim/data/weapons.ts';
import type { Rec } from './harness.ts';

const dir = process.argv[2];
const want = process.argv.slice(3);
const on = (s: string) => want.length === 0 || want.includes(s);
const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort();
const load = (f: string): Rec[] => readFileSync(join(dir, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const all = new Map<string, Rec[]>(files.map((f) => [f.replace('.jsonl', ''), load(f)]));
const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) + '%' : '-');
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const med = (a: number[]) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : 0);
const top = (m: Map<string, number>, total: number, n = 6) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${pct(v, total)}`).join(', ');
const bump = (m: Map<string, number>, k: string, v = 1) => m.set(k, (m.get(k) ?? 0) + v);
function wilson(k: number, n: number): string {
  if (!n) return '-';
  const z = 1.96, p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return `${Math.round((100 * (c - h)) / d)}-${Math.round((100 * (c + h)) / d)}`;
}

if (on('wins')) {
  console.log('\n| Job | Runs | Win | 95% CI | Mean end wave | Raws gathered | Wave time at a node | Damage per second at a node / away | Fusions | Weapons, most copies, largest class at bench 8 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (const [name, recs] of all) {
    const wins = recs.filter((r) => r.won).length;
    let wt = 0, wd = 0, at = 0, ad = 0;
    for (const r of recs) for (let w = 0; w < r.workT.length; w++) { wt += r.workT[w]; wd += r.hurtWork[w]; at += r.waveSecs[w] - r.workT[w]; ad += r.taken[w] - r.hurtWork[w]; }
    const r8 = recs.filter((r) => r.w8[0] >= 0);
    console.log(`| ${name} | ${recs.length} | ${pct(wins, recs.length)} | ${wilson(wins, recs.length)} | ${mean(recs.map((r) => r.endWave)).toFixed(1)} | ${Math.round(mean(recs.map((r) => r.gathered)))} | ${pct(wt, wt + at)} | ${(wd / Math.max(1, wt)).toFixed(2)} / ${(ad / Math.max(1, at)).toFixed(2)} | ${mean(recs.map((r) => r.fusions)).toFixed(1)} | ${mean(r8.map((r) => r.w8[0])).toFixed(1)}, ${mean(r8.map((r) => r.w8[1])).toFixed(1)}, ${mean(r8.map((r) => r.w8[2])).toFixed(1)} |`);
  }
}

if (on('curve')) {
  console.log('\n| Job | Die in wave 1 .. 12 (% of entrants) | Boss: pass rate of those who reach it | Killed (of wins) | Median kill time | Top killers |');
  console.log('|---|---|---|---|---|---|');
  for (const [name, recs] of all) {
    const row: string[] = [];
    for (let w = 1; w <= 12; w++) {
      const enter = recs.filter((r) => r.won || r.endWave >= w).length, die = recs.filter((r) => !r.won && r.endWave === w).length;
      row.push(enter ? ((100 * die) / enter).toFixed(0) : '-');
    }
    const reach = recs.filter((r) => r.won || r.endWave === 12), wins = recs.filter((r) => r.won);
    const killers = new Map<string, number>();
    for (const r of recs) if (!r.won) bump(killers, r.killedBy);
    console.log(`| ${name} | ${row.join(' ')} | ${pct(wins.length, reach.length)} | ${pct(wins.filter((r) => r.bossKilled).length, wins.length)} | ${med(wins.filter((r) => r.bossKilled).map((r) => r.bossT))} s | ${top(killers, recs.length - wins.length, 4)} |`);
  }
}

if (on('bench')) {
  for (const [name, recs] of all) {
    if (!name.startsWith('default__')) continue;
    console.log(`\n${name}: bench by bench`);
    console.log('| Bench | Scrip in | Unspent on leaving | Real choice among offers | Real choice counting tier-ups | Offers short of raws (of 4-5) | Blocked by slots | Rerolls | Tier-ups | Fusions |');
    console.log('|---|---|---|---|---|---|---|---|---|---|');
    for (let b = 1; b <= 11; b++) {
      const logs = recs.flatMap((r) => r.bench.filter((l) => l.bench === b));
      if (!logs.length) continue;
      console.log(`| ${b} | ${Math.round(mean(logs.map((l) => l.scripIn)))} | ${pct(logs.reduce((s, l) => s + l.scripOut, 0), logs.reduce((s, l) => s + l.scripIn, 0))} | ${pct(logs.filter((l) => l.realChoice).length, logs.length)} | ${pct(logs.filter((l) => l.realChoiceAny).length, logs.length)} | ${mean(logs.map((l) => l.shortRaws)).toFixed(2)} | ${mean(logs.map((l) => l.blockedSlot)).toFixed(2)} | ${mean(logs.map((l) => l.rerolls)).toFixed(1)} | ${mean(logs.map((l) => l.tierUps)).toFixed(1)} | ${mean(logs.map((l) => l.fused)).toFixed(2)} |`);
    }
    const wins = recs.filter((r) => r.won);
    console.log(`winners: scrip held at the end ${pct(wins.reduce((s, r) => s + r.scripHeld, 0), wins.reduce((s, r) => s + r.scripEarned, 0))} of scrip earned (median ${med(wins.map((r) => r.scripHeld))} of ${med(wins.map((r) => r.scripEarned))})`);
  }
}

if (on('build')) {
  console.log('\n| Job | Wins | Winners: damage sources | Winners: upgrade picks | Winners: items held | Weapon types held |');
  console.log('|---|---|---|---|---|---|');
  for (const [name, recs] of all) {
    const wins = recs.filter((r) => r.won);
    if (!wins.length) continue;
    const dmg = new Map<string, number>(), up = new Map<string, number>(), items = new Map<string, number>();
    let dt = 0, ut = 0, types = 0;
    for (const r of wins) {
      for (const [k, v] of Object.entries(r.dmgBy)) { bump(dmg, k, v); dt += v; }
      for (const s of r.up) { bump(up, s); ut++; }
      for (const i of new Set(r.items)) bump(items, i.startsWith('F:') ? 'fused' : i);
      types += new Set(r.weapons.map((w) => w[0])).size;
    }
    console.log(`| ${name} | ${wins.length} | ${top(dmg, dt, 5)} | ${top(up, ut, 5)} | ${top(items, wins.length, 6)} | ${(types / wins.length).toFixed(1)} |`);
  }
}

if (on('content')) {
  // Every weapon, stat, item and primitive: the strategy whose winners lean on it most.
  const wpn = new Map<string, [string, number]>(), itm = new Map<string, [string, number]>(), stat = new Map<string, [string, number]>(), prim = new Map<string, [string, number]>();
  const best = (m: Map<string, [string, number]>, k: string, job: string, v: number) => { const c = m.get(k); if (!c || v > c[1]) m.set(k, [job, v]); };
  for (const [name, recs] of all) {
    const wins = recs.filter((r) => r.won);
    if (wins.length < 8) continue;
    const dmg = new Map<string, number>(), held = new Map<string, number>(), up = new Map<string, number>(), sp = new Map<string, number>();
    let dt = 0, ut = 0;
    for (const r of wins) {
      for (const [k, v] of Object.entries(r.dmgBy)) { bump(dmg, k, v); dt += v; }
      for (const i of new Set(r.items)) bump(held, i);
      for (const s of r.up) { bump(up, s); ut++; }
      for (const k of Object.keys(r.sp)) bump(sp, k);
    }
    for (const w of WEAPONS) best(wpn, w.id, name, (dmg.get(w.id) ?? 0) / Math.max(1, dt));
    for (const i of BASE_ITEMS) best(itm, i.id, name, (held.get(i.id) ?? 0) / wins.length);
    for (const s of STATS) best(stat, s, name, (up.get(s) ?? 0) / Math.max(1, ut));
    for (const p of PRIMITIVES) if (p.kind === 'special') best(prim, p.id, name, (sp.get(p.id) ?? 0) / wins.length);
  }
  const show = (title: string, m: Map<string, [string, number]>, unit: string, dead: number) => {
    console.log(`\n${title} (best strategy, ${unit}):`);
    console.log([...m.entries()].sort((a, b) => a[1][1] - b[1][1]).map(([k, [j, v]]) => `${v < dead ? '**' : ''}${k} ${Math.round(100 * v)}% ${j.split('__')[0]}${v < dead ? '**' : ''}`).join('; '));
  };
  show('Weapons', wpn, "share of winners' damage", 0.05);
  show('Stats', stat, "share of winners' picks", 0.05);
  show('Items', itm, 'share of winners holding it', 0.05);
  show('Special primitives', prim, 'share of winners holding it', 0.05);
}
