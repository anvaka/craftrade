// Reads tools/exp/depth/out/*.jsonl and prints every table used in docs/critique/depth.md.
//   npx tsx tools/exp/depth/analyze.ts > tools/exp/depth/out/report.txt
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { itemTier } from '../../../src/shared/item.ts';
import { PRIMITIVES, STATS } from '../../../src/shared/vocab.ts';
import { ENEMIES } from '../../../src/sim/data/enemies.ts';
import { WEAPONS, WEAPON_INDEX } from '../../../src/sim/data/weapons.ts';
import type { Rec } from './harness.ts';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
const cache = new Map<string, Rec[] | null>();
function load(pol: string, ch = 'greenhorn'): Rec[] | null {
  const k = `${pol.replace(':', '-')}__${ch}`;
  if (!cache.has(k)) {
    const f = join(OUT, k + '.jsonl');
    cache.set(k, existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Rec) : null);
  }
  return cache.get(k)!;
}
const CHARS = ['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk'];
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);
const median = (a: number[]) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pc = (n: number, d: number, dp = 0) => (d ? ((100 * n) / d).toFixed(dp) + '%' : '-');
const f1 = (v: number) => v.toFixed(1);
const f2 = (v: number) => v.toFixed(2);
/** Wilson 95% interval, in percent. */
function wilson(k: number, n: number): string {
  if (!n) return '-';
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return `${Math.round(100 * (c - h))}-${Math.round(100 * (c + h))}`;
}
const wins = (r: Rec[]) => r.filter((x) => x.won).length;
/** z score of a difference of two proportions. */
function z2(k1: number, n1: number, k2: number, n2: number): number {
  if (!n1 || !n2) return 0;
  const p = (k1 + k2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  return se ? (k1 / n1 - k2 / n2) / se : 0;
}
function table(head: string[], rows: (string | number)[][]): void {
  console.log('| ' + head.join(' | ') + ' |');
  console.log('|' + head.map(() => '---').join('|') + '|');
  for (const r of rows) console.log('| ' + r.join(' | ') + ' |');
  console.log('');
}
const h = (s: string) => console.log(`\n## ${s}\n`);
const isMelee = (id: string) => WEAPONS[WEAPON_INDEX[id]]?.kind !== 'shot';
const WID = new Set(WEAPONS.map((w) => w.id));

const base: Record<string, Rec[]> = {};
for (const c of CHARS) { const r = load('default', c); if (r) base[c] = r; }
const allBase = Object.values(base).flat();

// ---------------------------------------------------------------- 0. baseline
h('0. Baseline: shipped bot, all characters');
table(['character', 'runs', 'win', '95% CI', 'median death wave', 'mean level', 'mean HP at win', 'won run seconds', 'scrip held at end (winners, median)', 'raws gathered'],
  CHARS.filter((c) => base[c]).map((c) => {
    const r = base[c], w = r.filter((x) => x.won), l = r.filter((x) => !x.won);
    return [c, r.length, pc(w.length, r.length), wilson(w.length, r.length), median(l.map((x) => x.endWave)), f1(mean(r.map((x) => x.level))),
      pc(mean(w.map((x) => x.minHp[11] ?? 0)), 1), Math.round(mean(w.map((x) => x.secs))), median(w.map((x) => x.scripHeld)), f1(mean(r.map((x) => x.gathered)))];
  }));

// ---------------------------------------------------------------- 1. build diversity
h('1a. Build archetypes among winners');
function archetype(r: Rec): { coarse: string; fine: string; set: string } {
  let m = 0, g = 0, aux = 0, tot = 0;
  const auxBy: Record<string, number> = {};
  for (const [k, v] of Object.entries(r.dmgBy)) {
    tot += v;
    if (WID.has(k)) { if (isMelee(k)) m += v; else g += v; } else { aux += v; auxBy[k] = v; }
  }
  const ms = m / Math.max(1, m + g);
  let coarse = ms > 0.7 ? 'melee' : ms < 0.3 ? 'ranged' : 'mixed';
  const topAux = Object.entries(auxBy).sort((a, b) => b[1] - a[1])[0];
  if (topAux && topAux[1] / tot > 0.2) coarse += '+' + topAux[0];
  const picks: Record<string, number> = {};
  for (const s of r.up) picks[s] = (picks[s] ?? 0) + 1;
  const top2 = Object.entries(picks).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 2).map((x) => x[0]).sort().join('+');
  const set = [...new Set(r.weapons.map((w) => w[0]))].sort().join('+');
  return { coarse, fine: coarse + ' / ' + top2, set };
}
function effective(counts: number[]): number { const n = sum(counts); let e = 0; for (const c of counts) if (c) e -= (c / n) * Math.log(c / n); return Math.exp(e); }
{
  const rows: (string | number)[][] = [];
  for (const c of CHARS) {
    if (!base[c]) continue;
    const w = base[c].filter((x) => x.won);
    const co = new Map<string, number>(), fi = new Map<string, number>(), se = new Map<string, number>();
    for (const r of w) { const a = archetype(r); co.set(a.coarse, (co.get(a.coarse) ?? 0) + 1); fi.set(a.fine, (fi.get(a.fine) ?? 0) + 1); se.set(a.set, (se.get(a.set) ?? 0) + 1); }
    const top = [...co.entries()].sort((a, b) => b[1] - a[1]);
    const share5 = [...co.values()].filter((v) => v / w.length >= 0.05).length;
    rows.push([c, w.length, co.size, share5, f1(effective([...co.values()])), top.slice(0, 4).map(([k, v]) => `${k} ${pc(v, w.length)}`).join(', '), fi.size, f1(effective([...fi.values()])), se.size,
      f1(mean(w.map((r) => new Set(r.weapons.map((x) => x[0])).size)))]);
  }
  table(['character', 'wins', 'damage archetypes', 'with >= 5% share', 'effective number', 'top archetypes', 'archetype x top-2 stats', 'effective number', 'distinct weapon sets', 'weapon types held'], rows);
  console.log('Damage archetype: melee if melee weapons deal > 70% of weapon damage, ranged if < 30%, else mixed; "+x" when burn, burst, thorns, recoil or shards deal > 20% of all damage. Effective number = exp(Shannon entropy).\n');
}

h('1b. Weapons: who holds them, and do they help (shipped bot, all characters pooled)');
{
  const reach7 = allBase.filter((r) => r.endWave >= 7);
  const rows: (string | number)[][] = [];
  for (const w of WEAPONS) {
    const win = allBase.filter((r) => r.won), lose = allBase.filter((r) => !r.won);
    const heldW = win.filter((r) => r.weapons.some((x) => x[0] === w.id)).length, heldL = lose.filter((r) => r.weapons.some((x) => x[0] === w.id)).length;
    // Bought at benches 1-6, among runs that reached wave 7.
    const early = (r: Rec) => { let n = 0; for (const b of r.bench) if (b.bench <= 6) n += b.bought; return r.buy.slice(0, n).includes(w.id); };
    const a = reach7.filter(early), b = reach7.filter((r) => !early(r));
    let dmg = 0, tot = 0;
    for (const r of win) { dmg += r.dmgBy[w.id] ?? 0; tot += sum(Object.values(r.dmgBy)); }
    const st = load(`stack:${w.id}`), sw = load(`start:${w.id}`);
    rows.push([w.id, pc(heldW, win.length), pc(heldL, lose.length), pc(dmg, tot, 1), a.length, pc(wins(a), a.length), pc(wins(b), b.length), f1(z2(wins(a), a.length, wins(b), b.length)),
      st ? `${pc(wins(st), st.length)} (${wilson(wins(st), st.length)})` : '-', st ? f1(mean(st.map((r) => r.endWave))) : '-', sw ? pc(wins(sw), sw.length) : '-']);
  }
  table(['weapon', 'held at end: winners', 'losers', 'share of winners\' damage', 'runs buying it by bench 6', 'win if bought early', 'win if not', 'z', 'only this weapon: win (CI)', 'mean end wave', 'as start weapon'], rows);
}

{
  const win = allBase.filter((r) => r.won);
  const cls = (r: Rec) => { const n: Record<string, number> = {}; for (const [id] of r.weapons) for (const c of WEAPONS[WEAPON_INDEX[id]].classes) n[c] = (n[c] ?? 0) + 1; return n; };
  const best = win.map((r) => Math.max(0, ...Object.values(cls(r))));
  console.log(`Set bonuses among ${win.length} winners: largest class count >= 2: ${pc(best.filter((n) => n >= 2).length, win.length)}, >= 4: ${pc(best.filter((n) => n >= 4).length, win.length)}, 6: ${pc(best.filter((n) => n >= 6).length, win.length)}.`);
  console.log(`Winners hold ${f1(mean(win.map((r) => r.weapons.length)))} weapons, ${f1(mean(win.map((r) => r.weapons.filter((w) => w[1] === 4).length)))} of them tier 4, ${f1(mean(win.map((r) => new Set(r.weapons.map((w) => w[0])).size)))} distinct types, ${f1(mean(win.map((r) => r.items.length)))} items.\n`);
}

h('1c. Upgrade picks');
{
  const win = allBase.filter((r) => r.won), lose = allBase.filter((r) => !r.won && r.endWave >= 7);
  const d = load('default')!;
  const rows = STATS.map((s) => {
    const sw = sum(win.map((r) => r.up.filter((x) => x === s).length)), tw = sum(win.map((r) => r.up.length));
    const sl = sum(lose.map((r) => r.up.filter((x) => x === s).length)), tl = sum(lose.map((r) => r.up.length));
    const inj = load(`stat:${s}`);
    return [s, pc(sw, tw, 1), pc(sl, tl, 1), inj ? pc(wins(inj), inj.length) : '-', inj ? wilson(wins(inj), inj.length) : '-',
      inj && d ? ((100 * wins(inj)) / inj.length - (100 * wins(d.slice(0, inj.length))) / inj.length).toFixed(0) : '-', inj ? f2(mean(inj.map((r) => r.endWave)) - mean(d.slice(0, inj.length).map((r) => r.endWave))) : '-'];
  });
  table(['stat', 'share of picks: winners', 'losers past wave 6', 'win with 3 free tier I picks', '95% CI', 'points vs no gift', 'mean end wave vs no gift'], rows);
  if (d) console.log(`No gift (greenhorn, same seeds): ${pc(wins(d.slice(0, 200)), Math.min(200, d.length))} win.\n`);
}

h('1d. Items: bought, and do they help');
{
  const reach7 = allBase.filter((r) => r.endWave >= 7);
  const d = load('default');
  const rows: (string | number)[][] = [];
  for (const it of BASE_ITEMS) {
    const buys = allBase.filter((r) => r.buy.includes(it.id)).length;
    const early = (r: Rec) => { let n = 0; for (const b of r.bench) if (b.bench <= 6) n += b.bought; return r.buy.slice(0, n).includes(it.id); };
    const a = reach7.filter(early), b = reach7.filter((r) => !early(r));
    const kit = load(`kit:${it.id}`);
    rows.push([it.id, itemTier(it), it.effects.map((e) => `${e.p}${e.l}${e.neg ? '-' : ''}`).join(' '), pc(buys, allBase.length), a.length, pc(wins(a), a.length), pc(wins(b), b.length), f1(z2(wins(a), a.length, wins(b), b.length)),
      kit ? pc(wins(kit), kit.length) : '-', kit && d ? ((100 * wins(kit)) / kit.length - (100 * wins(d.slice(0, kit.length))) / kit.length).toFixed(0) : '-',
      kit && d ? f2(mean(kit.map((r) => r.endWave)) - mean(d.slice(0, kit.length).map((r) => r.endWave))) : '-']);
  }
  table(['item', 'tier', 'effects', 'runs that bought it', 'bought by bench 6 (reached wave 7)', 'win if bought early', 'win if not', 'z', 'win with it as a free kit', 'points vs no kit', 'mean end wave vs no kit'], rows);
  const tierShare = [0, 0, 0, 0, 0], tot = sum(allBase.map((r) => r.buy.filter((x) => !WID.has(x)).length));
  for (const r of allBase) for (const id of r.buy) { const it = BASE_ITEMS.find((i) => i.id === id); if (it) tierShare[itemTier(it)]++; }
  console.log(`Item buys by tier 1/2/3/4: ${tierShare.slice(1).map((n) => pc(n, tot)).join(' / ')} of ${tot} item buys; items per run ${f1(tot / allBase.length)}; weapons bought per run ${f1(mean(allBase.map((r) => r.buy.filter((x) => WID.has(x)).length)))}\n`);
}

h('1e. Special primitives held by winners and losers (levels summed over items held at the end)');
{
  const win = allBase.filter((r) => r.won), lose = allBase.filter((r) => !r.won && r.endWave >= 9);
  table(['primitive', 'winners holding any', 'losers (died wave 9+) holding any'],
    PRIMITIVES.filter((p) => p.kind === 'special').map((p) => [p.id, pc(win.filter((r) => r.sp[p.id]).length, win.length), pc(lose.filter((r) => r.sp[p.id]).length, lose.length)]));
}

// ---------------------------------------------------------------- 2. strategies
h('2. Forced strategies (greenhorn, 200 seeds unless noted)');
{
  const d = load('default');
  const names = ['default', 'meleeOnly', 'rangedOnly', 'toolsOnly', 'toolsHeavy', 'gatherNever', 'gatherMax', 'nofuse', 'fuseProc', 'fuseProcAlways', 'fuseProcSmart', 'fuseStandinAlways',
    'hoardLight', 'hoardFull', 'thorns', 'tank', 'glass', 'glassPure', 'glassMelee', 'glassRanged', 'glassNoGather', 'evade', 'lucky', 'burn', 'blast', 'nomule', 'muleAll', 'freeRaws', 'gatherNeverFreeRaws',
    'noItems', 'noWeapons', 'noBuy', 'noBuyNoUp', 'randomBuy', 'randomUpgrade', 'randomAll', 'noReroll', 'noLock', 'afk', 'circle', 'every9', 'every18', 'every30'];
  const rows: (string | number)[][] = [];
  for (const n of names) {
    const r = load(n);
    if (!r) continue;
    const dd = d ? d.slice(0, r.length) : [];
    rows.push([n, r.length, pc(wins(r), r.length), wilson(wins(r), r.length), dd.length ? f1(z2(wins(r), r.length, wins(dd), dd.length)) : '-', f1(mean(r.map((x) => x.endWave))),
      median(r.filter((x) => !x.won).map((x) => x.endWave)), f1(mean(r.map((x) => x.level))), f1(mean(r.map((x) => x.gathered))), f2(mean(r.map((x) => x.fusions))),
      pc(sum(r.filter((x) => x.won).map((x) => (x.bossKilled ? 1 : 0))), wins(r))]);
  }
  table(['strategy', 'runs', 'win', '95% CI', 'z vs default', 'mean end wave', 'median death wave', 'mean level', 'raws gathered', 'fusions', 'boss killed (of wins)'], rows);
}
h('2b. One weapon type only (greenhorn starts with it and may buy no other)');
{
  const rows = WEAPONS.map((w) => { const r = load(`stack:${w.id}`); return r ? [w.id, w.classes.join('/'), pc(wins(r), r.length), wilson(wins(r), r.length), f1(mean(r.map((x) => x.endWave))), median(r.filter((x) => !x.won).map((x) => x.endWave)),
    f1(mean(r.map((x) => x.weapons.length))), f1(mean(r.map((x) => Math.max(...x.weapons.map((y) => y[1])))))] : [w.id, '-', '-', '-', '-', '-', '-', '-']; });
  table(['weapon', 'class', 'win', '95% CI', 'mean end wave', 'median death wave', 'copies held at end', 'best tier'], rows);
}

h('2c. What the winning builds look like under each policy (greenhorn)');
{
  const rows: (string | number)[][] = [];
  for (const n of ['default', 'glass', 'glassPure', 'glassMelee', 'glassRanged', 'tank', 'thorns', 'evade', 'meleeOnly', 'rangedOnly', 'freeRaws']) {
    const r = load(n);
    if (!r) continue;
    const w = r.filter((x) => x.won);
    if (!w.length) continue;
    const co = new Map<string, number>(), wb = new Map<string, number>(); let tot = 0;
    for (const x of w) { const a = archetype(x); co.set(a.coarse, (co.get(a.coarse) ?? 0) + 1); for (const [k, v] of Object.entries(x.dmgBy)) { wb.set(k, (wb.get(k) ?? 0) + v); tot += v; } }
    const statMean = (s: string) => mean(w.map((x) => x.flat[STATS.indexOf(s as never)]));
    rows.push([n, w.length, [...co.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${pc(v, w.length)}`).join(', '), f1(effective([...co.values()])),
      [...wb.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${pc(v, tot)}`).join(', '), f1(mean(w.map((x) => new Set(x.weapons.map((y) => y[0])).size))),
      Math.round(statMean('maxHp')), f1(statMean('armor')), Math.round(statMean('damage')), Math.round(statMean('rate')), Math.round(mean(w.map((x) => x.dealt[10] / Math.max(1, x.waveSecs[10])))), pc(mean(w.map((x) => x.minHp[10])), 1)]);
  }
  table(['policy', 'wins', 'damage archetypes', 'effective number', 'damage sources (top 5)', 'weapon types held', 'max HP', 'armor', 'damage %', 'rate %', 'damage per second in wave 11', 'lowest HP in wave 11'], rows);
}

// ---------------------------------------------------------------- 3. gathering
h('3. Gathering');
{
  const rows: (string | number)[][] = [];
  for (const n of ['gatherNever', 'default', 'gatherMax', 'toolsHeavy', 'toolsOnly', 'nomule', 'freeRaws', 'gatherNeverFreeRaws']) {
    const r = load(n);
    if (!r) continue;
    const work = sum(r.map((x) => sum(x.workT))), secs = sum(r.map((x) => sum(x.waveSecs)));
    const hw = sum(r.map((x) => sum(x.hurtWork))), ht = sum(r.map((x) => sum(x.taken)));
    const dead = r.filter((x) => !x.won);
    rows.push([n, pc(wins(r), r.length), wilson(wins(r), r.length), f1(mean(r.map((x) => x.gathered))), pc(work, secs, 1), f2(hw / Math.max(1, work)), f2((ht - hw) / Math.max(1, secs - work)),
      pc(dead.filter((x) => x.diedWorking).length, dead.length), f1(mean(r.map((x) => x.buy.length))), f1(mean(r.filter((x) => x.won).map((x) => x.rawsHeld + x.muled))),
      f1(mean(r.map((x) => mean(x.bench.map((b) => b.blockedRaws)))))]);
  }
  table(['policy', 'win', '95% CI', 'raws gathered per run', 'wave time spent working', 'damage taken per second while working', 'while not working', 'deaths that happened while working', 'purchases per run', 'raws unspent at a win (held + muled)', 'offers blocked by raws per bench (of 4)'], rows);
  // By wave, default bot: risk at the node.
  const d = allBase;
  const rows2: (string | number)[][] = [];
  for (let w = 0; w < 12; w++) {
    const rr = d.filter((x) => x.endWave > w || (x.endWave === w + 1));
    const work = sum(rr.map((x) => x.workT[w])), secs = sum(rr.map((x) => x.waveSecs[w] || 0)) || 1;
    const hw = sum(rr.map((x) => x.hurtWork[w])), ht = sum(rr.map((x) => x.taken[w]));
    const mh = mean(rr.map((x) => x.maxHpW[w] || 10));
    rows2.push([w + 1, pc(work, secs, 1), f2(hw / Math.max(1, work)), f2((ht - hw) / Math.max(1, secs - work)), f1(mh)]);
  }
  console.log('Shipped bot, all characters, by wave:\n');
  table(['wave', 'time working', 'damage per second while working', 'while not working', 'mean max HP'], rows2);
}

// ---------------------------------------------------------------- 4. fusion
h('4. Fusion');
{
  const rows: (string | number)[][] = [];
  for (const n of ['nofuse', 'default', 'fuseProc', 'fuseProcSmart', 'fuseProcAlways', 'fuseStandinAlways']) {
    const r = load(n);
    if (!r) continue;
    const benches = r.flatMap((x) => x.bench);
    rows.push([n, pc(wins(r), r.length), wilson(wins(r), r.length), f1(mean(r.map((x) => x.endWave))), f2(mean(r.map((x) => x.fusions))), pc(benches.filter((b) => b.fuseLegal > 0).length, benches.length),
      pc(benches.filter((b) => b.fuseAffordable > 0).length, benches.length), f1(mean(r.filter((x) => x.won).map((x) => x.fusedHeld)))]);
  }
  table(['policy', 'win', '95% CI', 'mean end wave', 'fusions per run', 'benches with a legal pair', 'benches with an affordable pair', 'fused items held at a win'], rows);
  const rows2 = CHARS.filter((c) => base[c] && load('nofuse', c)).map((c) => { const a = base[c], b = load('nofuse', c)!; const aa = a.slice(0, b.length);
    return [c, pc(wins(aa), aa.length), pc(wins(b), b.length), f1(z2(wins(aa), aa.length, wins(b), b.length)), f2(mean(aa.map((x) => x.fusions)))]; });
  table(['character', 'win with fusion (shipped bot)', 'win with fusion off', 'z', 'fusions per run'], rows2);
}

// ---------------------------------------------------------------- 5. characters
h('5. Characters');
{
  const rows: (string | number)[][] = [];
  for (const c of CHARS) {
    if (!base[c]) continue;
    const r = base[c], w = r.filter((x) => x.won), l = r.filter((x) => !x.won);
    const kb = new Map<string, number>();
    for (const x of l) kb.set(x.killedBy, (kb.get(x.killedBy) ?? 0) + 1);
    const wb = new Map<string, number>(); let tot = 0;
    for (const x of w) for (const [k, v] of Object.entries(x.dmgBy)) { wb.set(k, (wb.get(k) ?? 0) + v); tot += v; }
    let m = 0, g = 0;
    for (const [k, v] of wb) if (WID.has(k)) { if (isMelee(k)) m += v; else g += v; }
    const up = new Map<string, number>(); let ut = 0;
    for (const x of w) for (const s of x.up) { up.set(s, (up.get(s) ?? 0) + 1); ut++; }
    rows.push([c, pc(w.length, r.length), [...kb.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${pc(v, l.length)}`).join(', '),
      [...wb.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${pc(v, tot)}`).join(', '), pc(m, m + g),
      [...up.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${pc(v, ut)}`).join(', '), f1(mean(r.map((x) => x.gathered))), f2(mean(r.map((x) => x.fusions)))]);
  }
  table(['character', 'win', 'killed by (top 3)', 'winners\' damage (top 4 sources)', 'melee share of weapon damage', 'winners\' upgrade picks (top 4)', 'raws gathered', 'fusions'], rows);
  // Total variation distance between characters' winner profiles.
  const prof = (c: string, f: (r: Rec) => Record<string, number>) => { const m: Record<string, number> = {}; let t = 0; for (const r of base[c].filter((x) => x.won)) for (const [k, v] of Object.entries(f(r))) { m[k] = (m[k] ?? 0) + v; t += v; } for (const k in m) m[k] /= t || 1; return m; };
  const tv = (a: Record<string, number>, b: Record<string, number>) => { let d = 0; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) d += Math.abs((a[k] ?? 0) - (b[k] ?? 0)); return d / 2; };
  const cs = CHARS.filter((c) => base[c]);
  const dm = cs.map((c) => prof(c, (r) => r.dmgBy)), um = cs.map((c) => prof(c, (r) => { const m: Record<string, number> = {}; for (const s of r.up) m[s] = (m[s] ?? 0) + 1; return m; }));
  const im = cs.map((c) => prof(c, (r) => { const m: Record<string, number> = {}; for (const s of r.buy) if (!WID.has(s)) m[s] = (m[s] ?? 0) + 1; return m; }));
  {
    // Noise floor: the same character split by odd and even seed index.
    const half = (c: string, odd: number, f: (r: Rec) => Record<string, number>) => { const m: Record<string, number> = {}; let t = 0; base[c].forEach((r, i) => { if (!r.won || i % 2 !== odd) return; for (const [k, v] of Object.entries(f(r))) { m[k] = (m[k] ?? 0) + v; t += v; } }); for (const k in m) m[k] /= t || 1; return m; };
    const up = (r: Rec) => { const m: Record<string, number> = {}; for (const s of r.up) m[s] = (m[s] ?? 0) + 1; return m; };
    const it = (r: Rec) => { const m: Record<string, number> = {}; for (const s of r.buy) if (!WID.has(s)) m[s] = (m[s] ?? 0) + 1; return m; };
    console.log('Noise floor (same character, odd seeds against even seeds): ' + cs.map((c) => `${c} ${f2(tv(half(c, 0, (r) => r.dmgBy), half(c, 1, (r) => r.dmgBy)))} / ${f2(tv(half(c, 0, up), half(c, 1, up)))} / ${f2(tv(half(c, 0, it), half(c, 1, it)))}`).join('; ') + '\n');
  }
  console.log('Total variation distance between winners\' profiles (0 = identical, 1 = disjoint): damage sources / upgrade picks / item buys\n');
  table(['', ...cs], cs.map((a, i) => [a, ...cs.map((_, j) => (i === j ? '-' : `${f2(tv(dm[i], dm[j]))} / ${f2(tv(um[i], um[j]))} / ${f2(tv(im[i], im[j]))}`))]));
  // Strategy x character.
  const strats = ['default', 'glass', 'meleeOnly', 'rangedOnly', 'toolsHeavy', 'thorns', 'hoardFull', 'hoardLight', 'nofuse', 'gatherNever'];
  const got = strats.filter((s) => CHARS.some((c) => c !== 'greenhorn' && load(s, c)));
  console.log('Win rate by strategy and character (default 200 seeds; greenhorn 200; other cells 100):\n');
  table(['strategy', ...CHARS], got.map((s) => [s, ...CHARS.map((c) => { const r = load(s, c); return r ? pc(wins(r), r.length) : '-'; })]));
  // Best strategy per character and rank agreement.
  table(['character', 'best forced strategy', 'worst', 'spread (points)'], CHARS.map((c) => {
    const xs = got.filter((s) => s !== 'default' && load(s, c)).map((s) => [s, (100 * wins(load(s, c)!)) / load(s, c)!.length] as [string, number]).sort((a, b) => b[1] - a[1]);
    return xs.length ? [c, `${xs[0][0]} ${xs[0][1].toFixed(0)}%`, `${xs[xs.length - 1][0]} ${xs[xs.length - 1][1].toFixed(0)}%`, (xs[0][1] - xs[xs.length - 1][1]).toFixed(0)] : [c, '-', '-', '-'];
  }));
}

// ---------------------------------------------------------------- 6. decisions
h('6. Bench decisions (shipped bot, all characters)');
{
  const rows: (string | number)[][] = [];
  for (let b = 1; b <= 11; b++) {
    const L = allBase.flatMap((r) => r.bench.filter((x) => x.bench === b));
    if (!L.length) continue;
    rows.push([b, L.length, Math.round(mean(L.map((x) => x.scripIn))), Math.round(mean(L.map((x) => x.scripOut))), pc(sum(L.map((x) => x.scripOut)), sum(L.map((x) => x.scripIn))), f1(mean(L.map((x) => x.rawsIn))),
      f2(mean(L.map((x) => x.affordable))), f2(mean(L.map((x) => x.blockedScrip))), f2(mean(L.map((x) => x.blockedRaws))), f2(mean(L.map((x) => x.blockedSlot))), f2(mean(L.map((x) => x.worth))),
      pc(L.filter((x) => x.affordableWorth === 0).length, L.length), pc(L.filter((x) => x.affordableWorth === 1).length, L.length), pc(L.filter((x) => x.realChoice).length, L.length),
      pc(L.filter((x) => x.affordableWorth >= 2 && !x.realChoice).length, L.length),
      f1(mean(L.map((x) => x.bought))), f1(mean(L.map((x) => x.rerolls))), pc(L.filter((x) => x.locks > 0).length, L.length), f1(mean(L.map((x) => x.picks))), f2(mean(L.filter((x) => x.picks > 0).map((x) => x.pickSpread / x.picks)))]);
  }
  table(['bench', 'n', 'scrip in', 'scrip out', 'left unspent', 'raws in', 'offers affordable (of 4)', 'blocked by scrip', 'blocked by raws', 'blocked by slots', 'offers the bot rates worth it',
    'nothing worth buying', 'exactly one', 'real choice (2+ worth it, cannot afford all)', 'buy everything (2+ worth it, all affordable)', 'bought', 'rerolls', 'benches using lock', 'upgrade picks', 'second-best pick utility / best'], rows);
  const win = allBase.filter((r) => r.won);
  console.log(`Winners: scrip held at the end, median ${median(win.map((r) => r.scripHeld))}, mean ${Math.round(mean(win.map((r) => r.scripHeld)))}; scrip earned mean ${Math.round(mean(win.map((r) => r.scripEarned)))}; so ${pc(sum(win.map((r) => r.scripHeld)), sum(win.map((r) => r.scripEarned)))} of all scrip earned is never spent.`);
  console.log(`Raws: winners gather ${f1(mean(win.map((r) => r.gathered)))}, mule ${f1(mean(win.map((r) => r.muled)))}, end holding ${f1(mean(win.map((r) => r.rawsHeld)))}.`);
  for (const n of ['noReroll', 'noLock', 'randomBuy', 'randomUpgrade', 'randomAll', 'noBuy', 'noItems', 'noWeapons']) {
    const r = load(n); const d = load('default');
    if (r && d) console.log(`${n}: win ${pc(wins(r), r.length)} (${wilson(wins(r), r.length)}) vs default ${pc(wins(d.slice(0, r.length)), r.length)}; mean end wave ${f1(mean(r.map((x) => x.endWave)))} vs ${f1(mean(d.slice(0, r.length).map((x) => x.endWave)))}`);
  }
}

// ---------------------------------------------------------------- 7. difficulty
h('7. Difficulty curve (shipped bot)');
{
  const rows: (string | number)[][] = [];
  for (const c of CHARS) { if (!base[c]) continue; const l = base[c].filter((x) => !x.won); const hist = new Array(13).fill(0); for (const x of l) hist[x.endWave]++; rows.push([c, ...hist.slice(1), wins(base[c])]); }
  table(['deaths in wave', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'wins'], rows);
  const rows2: (string | number)[][] = [];
  for (let w = 0; w < 12; w++) {
    const rr = allBase.filter((x) => x.endWave >= w + 1);
    const died = rr.filter((x) => !x.won && x.endWave === w + 1).length;
    const surv = rr.filter((x) => x.won || x.endWave > w + 1);
    const dps = mean(surv.map((x) => x.dealt[w] / Math.max(1, x.waveSecs[w])));
    const brute = ENEMIES.find((e) => e.id === 'brute')!, mite = ENEMIES[0];
    rows2.push([w + 1, rr.length, pc(died, rr.length, 1), f2(mean(rr.map((x) => x.taken[w] / Math.max(1, x.maxHpW[w] || 10)))), pc(mean(surv.map((x) => x.minHp[w])), 1), pc(surv.filter((x) => x.minHp[w] < 0.5).length, surv.length),
      pc(surv.filter((x) => x.taken[w] === 0).length, surv.length), f1(dps), f1(mean(surv.map((x) => x.kills[w]))), Math.round(mean(surv.map((x) => x.peak[w]))), Math.round(mean(surv.map((x) => x.left[w]))),
      f2((mite.hp + mite.hpW * w) / Math.max(0.1, dps)), f1((brute.hp + brute.hpW * w) / Math.max(0.1, dps))]);
  }
  table(['wave', 'runs entering', 'die here', 'damage taken / max HP', 'lowest HP (survivors, mean)', 'survivors who dropped below half HP', 'survivors untouched', 'damage dealt per second', 'kills', 'peak enemies alive', 'alive at the bell',
    'seconds of all damage to kill one mite', 'one brute'], rows2);
  const at12 = allBase.filter((x) => x.endWave >= 12), w12 = at12.filter((x) => x.won);
  console.log(`Boss: ${at12.length} runs reach wave 12; ${pc(w12.length, at12.length)} win. Of the wins ${pc(w12.filter((x) => x.bossKilled).length, w12.length)} kill Old Tusk (median at ${median(w12.filter((x) => x.bossKilled).map((x) => x.bossT))} s of 90); the rest outlast the clock. Winners' lowest HP in wave 12: mean ${pc(mean(w12.map((x) => x.minHp[11])), 1)}.`);
  const hb = new Map<string, number>(); let t = 0;
  for (const r of allBase) for (const [k, v] of Object.entries(r.hurtBy)) { hb.set(k, (hb.get(k) ?? 0) + v); t += v; }
  console.log(`Damage taken by source, all runs: ${[...hb.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, t)}`).join(', ')}`);
  const kb = new Map<string, number>(); const dead = allBase.filter((x) => !x.won);
  for (const r of dead) kb.set(r.killedBy, (kb.get(r.killedBy) ?? 0) + 1);
  console.log(`Killing blows: ${[...kb.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, dead.length)}`).join(', ')}`);
  for (const n of ['afk', 'circle', 'every9', 'every18', 'every30', 'noBuy', 'noBuyNoUp']) {
    const r = load(n);
    if (!r) continue;
    const hist = new Array(13).fill(0); for (const x of r.filter((y) => !y.won)) hist[x.endWave]++;
    console.log(`${n}: win ${pc(wins(r), r.length)}; deaths by wave ${hist.slice(1).join(' ')}; mean end wave ${f1(mean(r.map((x) => x.endWave)))}`);
  }
}
console.log(`\nFiles read: ${readdirSync(OUT).filter((f) => f.endsWith('.jsonl')).length}`);
