// Experiment 2: many players, 30 days, through the real API (in process, simulated clock).
// Run outcomes are sampled from the bot pool written by kitab.ts (skill x kit class), so the sim itself is not replayed here.
//   npx tsx tools/exp/meta/econ.ts <players> <days> <pool.json> <out.json> [mode=full|town]
import { readFileSync, writeFileSync } from 'node:fs';
import { BASE_ITEM } from '../../../src/shared/content/items.ts';
import { fusionBudget, itemTier } from '../../../src/shared/item.ts';
import type { Profile, StashItem } from '../../../src/shared/protocol.ts';
import { RAWS } from '../../../src/shared/vocab.ts';
import { DAY, idem, mean, median, pts, table, world } from './lib.ts';

const P = Number(process.argv[2] ?? 100), DAYS = Number(process.argv[3] ?? 30);
const pool = JSON.parse(readFileSync(process.argv[4], 'utf8')).pool as Record<string, any[]>;
const OUT = process.argv[5] ?? '/tmp/econ.json';
const MODE = process.argv[6] ?? 'full';
const KITS = Object.keys(pool).filter((k) => k.startsWith('average|')).map((k) => k.split('|')[1]); // none, t2, t4, cap
const kitClass = (p: number) => (p < 15 ? KITS[0] : p < 90 ? KITS[1] : p < 170 ? KITS[2] : KITS[3]);

let seed = 20261111;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];

type Strat = 'gatherer' | 'fighter' | 'trader' | 'fuser' | 'hoarder';
interface Agent { token: string; strat: Strat; skill: string; runsPerDay: number; prof: Profile; open?: { runId: string; kitPts: number }; spent: number; earned: number; ask: number }
const MIX: [Strat, number][] = [['gatherer', 0.3], ['fighter', 0.3], ['trader', 0.1], ['fuser', 0.15], ['hoarder', 0.15]];
const w = world();
const agents: Agent[] = [];
for (let i = 0; i < P; i++) {
  let r = (i + 0.5) / P, strat: Strat = 'gatherer';
  for (const [s, f] of MIX) { if (r < f) { strat = s; break; } r -= f; }
  const h = await w.hello();
  agents.push({ token: h.token, strat, skill: i % 2 ? 'average' : 'novice', runsPerDay: 1 + Math.floor(rnd() * 4), prof: h.profile, spent: 0, earned: 0, ask: 0.5 + rnd() * 2.5 });
}
const stationMul = (st: any) => ({ timber: (3 + st.sawmill - 1) / 3, ore: (3 + st.smelter - 1) / 3, hide: (3 + st.tannery - 1) / 3 });
const sales: any[] = []; const days: any[] = [];
let listed = 0, cancelled = 0, salvaged = 0, townFuse = 0, firstFinds = 0, factorRefused = 0;
const listedAt = new Map<string, number>();

async function sellRaws(a: Agent, keep = 0) {
  for (const raw of RAWS) {
    let n = Math.floor(a.prof.raws[raw] * (1 - keep));
    while (n > 0) {
      const q = Math.min(100, n);
      const r = await w.post('/api/market/factor', a.token, { raw, side: 'sell', qty: q, idem: idem() });
      if (r.status !== 200) { factorRefused++; break; }
      a.prof = r.body.profile; n -= q;
    }
  }
}
async function donate(a: Agent, frac: number) {
  const raws: any = {}; for (const r of RAWS) raws[r] = Math.floor(a.prof.raws[r] * frac);
  if (raws.timber + raws.ore + raws.hide === 0) return;
  const g = await w.post('/api/town/give', a.token, { raws });
  if (g.status === 200) a.prof = g.body.profile;
}
async function fuseUp(a: Agent, keepFresh: boolean) {
  for (let guard = 0; guard < 12; guard++) {
    const items = a.prof.items.filter((i) => itemTier(i.item) < 4).sort((x, y) => pts(x.item) - pts(y.item));
    let best: [StashItem, StashItem] | null = null, score = -1;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      if (items[i].item.id === items[j].item.id) continue;
      const waste = Math.max(0, (pts(items[i].item) + pts(items[j].item)) * 1.12 - 106);
      const s = fusionBudget(items[i].item, items[j].item) - 2 * waste + 3 * (6 - items[i].charges - items[j].charges);
      if (s > score) { score = s; best = [items[i], items[j]]; }
    }
    if (!best) return;
    const r = await w.post('/api/fuse', a.token, { a: best[0].item.id, b: best[1].item.id, ctx: 'town', uidA: best[0].uid, uidB: best[1].uid });
    if (r.status !== 200) return;
    townFuse++; if (r.body.first) firstFinds++;
    a.prof = r.body.profile;
    if (keepFresh && a.prof.items.length <= 2) return;
  }
}
const top2 = (a: Agent) => a.prof.items.slice().sort((x, y) => pts(y.item) - pts(x.item)).slice(0, 2);
async function listSpare(a: Agent, keepN: number) {
  if (!a.prof.features.includes('market') || a.prof.runs < 3) return;
  const spare = a.prof.items.slice().sort((x, y) => pts(y.item) - pts(x.item)).slice(keepN);
  for (const it of spare.slice(0, 4)) {
    const price = Math.max(2, Math.round(pts(it.item) * (it.charges / 3) * a.ask));
    if (a.prof.marks < Math.ceil(price * 0.02) + 1) break;
    const r = await w.post('/api/market/list', a.token, { uid: it.uid, price, idem: idem() });
    if (r.status !== 200) break;
    a.prof = r.body.profile; listed++;
    const mine = r.body.market.listings.filter((l: any) => l.mine);
    for (const l of mine) if (!listedAt.has(l.id)) listedAt.set(l.id, w.now());
  }
}
/** Buy the listing that most improves the kit, paying at most `share` of marks. */
async function shop(a: Agent, share: number, day: number) {
  if (!a.prof.features.includes('market')) return;
  const m = (await w.get('/api/market', a.token)).body;
  const mine = top2(a); const weakest = mine.length < 2 ? 0 : pts(mine[1].item);
  let best: any = null, bestV = 0;
  for (const l of m.listings) {
    if (l.mine || l.price > a.prof.marks * share) continue;
    const gain = (pts(l.item) - weakest) * (l.charges / 3);
    if (gain < 10) continue;
    const v = gain / l.price;
    if (v > bestV) { bestV = v; best = l; }
  }
  if (!best) return;
  const r = await w.post('/api/market/buy', a.token, { listingId: best.id, idem: idem() });
  if (r.status !== 200) return;
  // Could the buyer have made an item at least this strong from the stash it already had?
  const own = a.prof.items.filter((i) => itemTier(i.item) < 4).map((i) => pts(i.item)).sort((x, y) => y - x);
  const selfSupply = own.length >= 2 && Math.min(106, (own[0] + own[1]) * 1.12 * 0.92) >= pts(best.item);
  a.prof = r.body.profile; a.spent += best.price;
  const seller = agents.find((x) => x.prof.name === best.seller);
  if (seller) seller.earned += best.price - Math.ceil(best.price * 0.05);
  sales.push({ day, price: best.price, pts: pts(best.item), charges: best.charges, perPt: best.price / (pts(best.item) * best.charges / 3), salvage: Math.max(1, Math.round(pts(best.item) * best.charges / 15)), selfSupply, buyer: a.strat, seller: seller?.strat ?? '?', fused: !BASE_ITEM[best.item.id] });
}
/** Trader: buy anything listed under 60% of 1 mark a point, to relist. */
async function flip(a: Agent, day: number) {
  if (!a.prof.features.includes('market')) return;
  const m = (await w.get('/api/market', a.token)).body;
  for (const l of m.listings) {
    if (l.mine) continue;
    const fair = pts(l.item) * (l.charges / 3) * 1.0;
    if (l.price > fair * 0.6 || l.price > a.prof.marks * 0.5) continue;
    const r = await w.post('/api/market/buy', a.token, { listingId: l.id, idem: idem() });
    if (r.status !== 200) continue;
    a.prof = r.body.profile; a.spent += l.price;
    const seller = agents.find((x) => x.prof.name === l.seller); if (seller) seller.earned += l.price - Math.ceil(l.price * 0.05);
    sales.push({ day, price: l.price, pts: pts(l.item), charges: l.charges, perPt: l.price / (pts(l.item) * l.charges / 3), salvage: Math.max(1, Math.round(pts(l.item) * l.charges / 15)), selfSupply: false, buyer: 'trader', seller: seller?.strat ?? '?', fused: !BASE_ITEM[l.item.id] });
  }
}

let townDoneDay = -1; let idemRows = 0, idemBytes = 0;
for (let day = 0; day < DAYS; day++) {
  w.setNow(Date.UTC(2026, 10, 11) + day * DAY + 8 * 3600_000);
  for (let round = 0; round < 4; round++) {
    const playing = agents.filter((a) => a.runsPerDay > round);
    for (const a of playing) {
      const kit = a.strat === 'hoarder' ? [] : top2(a);
      const s = await w.post('/api/run/start', a.token, { mode: 'run', character: 'greenhorn', kit: kit.map((k) => k.uid) });
      if (s.status !== 200) throw new Error(JSON.stringify(s.body));
      a.open = { runId: s.body.runId, kitPts: s.body.kit.reduce((n: number, i: any) => n + pts(i), 0) };
      (a as any).st = s.body.stations;
    }
    w.advance(16 * 60_000);
    for (const a of playing) {
      const o = pick(pool[`${a.skill}|${kitClass(a.open!.kitPts)}`]);
      const mul = stationMul((a as any).st);
      const sc = (bag: any) => ({ timber: Math.round(bag.timber * mul.timber), ore: Math.round(bag.ore * mul.ore), hide: Math.round(bag.hide * mul.hide) });
      const e = await w.post('/api/run/end', a.token, { runId: a.open!.runId, wavesCleared: o.wavesCleared, won: o.won, scripEarned: o.scripEarned, scripHeld: o.scripHeld, level: o.level, raws: sc(o.raws), mule: sc(o.mule), carry: o.carry, kills: o.kills, fusions: [] });
      if (e.status !== 200) throw new Error(JSON.stringify(e.body));
      a.prof = e.body.profile;
      const f = new Set(a.prof.features);
      if (MODE === 'town') { if (f.has('town')) await donate(a, a.strat === 'hoarder' ? 0 : 1); continue; }
      switch (a.strat) {
        case 'gatherer': if (f.has('market')) { await sellRaws(a); await listSpare(a, 2); } break;
        case 'fighter':
          if (f.has('workshop')) await fuseUp(a, true);
          if (f.has('town')) await donate(a, 0.5);
          if (f.has('market')) { await sellRaws(a); await shop(a, 0.3, day); }
          break;
        case 'trader': if (f.has('market')) { await sellRaws(a); await flip(a, day); await listSpare(a, 2); } break;
        case 'fuser':
          if (f.has('workshop')) await fuseUp(a, false);
          if (f.has('town')) await donate(a, 1);
          if (f.has('market')) await listSpare(a, 2);
          break;
        case 'hoarder': break;
      }
    }
  }
  // End of day: stale listings (3 days) are taken down and salvaged.
  if (MODE === 'full') for (const a of agents) {
    if (!a.prof.features.includes('market')) continue;
    const m = (await w.get('/api/market', a.token)).body;
    for (const l of m.listings.filter((l: any) => l.mine)) {
      if (w.now() - (listedAt.get(l.id) ?? w.now()) < 3 * DAY) continue;
      const c = await w.post('/api/market/cancel', a.token, { listingId: l.id });
      if (c.status !== 200) continue;
      cancelled++; a.prof = c.body.profile; a.ask = Math.max(0.2, a.ask * 0.7);
      const it = a.prof.items[a.prof.items.length - 1];
      const sv = await w.post('/api/market/salvage', a.token, { uid: it.uid });
      if (sv.status === 200) { salvaged++; a.prof = sv.body.profile; }
    }
  }
  // The idempotency table keeps every full response for 7 days. Measure it, then clear it so the harness fits in memory.
  { const r = w.db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(response)), 0) AS b FROM idem').get() as any; idemRows += r.n; idemBytes += r.b; w.db.prepare('DELETE FROM idem').run(); }
  if (day % 5 === 4) console.error(`day ${day + 1} done`);
  const viewer = agents[0].token;
  const m = (await w.get('/api/market', viewer)).body; const t = (await w.get('/api/town', viewer)).body;
  const st = t.stations; const tiers = st.sawmill + st.smelter + st.tannery + st.assay;
  if (!t.project && townDoneDay < 0) townDoneDay = day + 1;
  const ds = sales.filter((s) => s.day === day);
  const marks = agents.map((a) => a.prof.marks);
  const fac = w.db.prepare('SELECT raw, ref, bought, sold FROM factor').all() as any[];
  days.push({
    day: day + 1, marksTotal: marks.reduce((x, y) => x + y, 0), marksMedian: median(marks), rawsHeld: agents.reduce((n, a) => n + a.prof.raws.timber + a.prof.raws.ore + a.prof.raws.hide, 0),
    stashItems: agents.reduce((n, a) => n + a.prof.items.length, 0), openListings: m.listings.length, sales: ds.length, medPricePerPt: ds.length ? median(ds.map((s) => s.perPt)).toFixed(2) : '-',
    timber: `${m.factor.timber.sell}/${m.factor.timber.buy}`, ore: `${m.factor.ore.sell}/${m.factor.ore.buy}`, hide: `${m.factor.hide.sell}/${m.factor.hide.buy}`,
    factorSold: fac.map((f) => f.sold).join('/'), cap: 150 * t.activePlayers, stationTiers: tiers,
    project: t.project ? `${t.project.station}>${t.project.toTier} ${Math.round(100 * (t.project.have.timber + t.project.have.ore + t.project.have.hide) / (t.project.need.timber + t.project.need.ore + t.project.need.hide))}%` : 'all maxed',
  });
}
const ledger = w.db.prepare('SELECT kind, SUM(marks) AS marks, SUM(timber+ore+hide) AS raws, COUNT(*) AS n FROM ledger GROUP BY kind ORDER BY kind').all();
const runs = w.db.prepare(`SELECT COUNT(*) AS n FROM runs WHERE status = 'ended'`).get() as any;
const byStrat = (['gatherer', 'fighter', 'trader', 'fuser', 'hoarder'] as Strat[]).map((s) => {
  const g = agents.filter((a) => a.strat === s);
  return { strategy: s, players: g.length, marksMean: Math.round(mean(g.map((a) => a.prof.marks))), rawsMean: Math.round(mean(g.map((a) => a.prof.raws.timber + a.prof.raws.ore + a.prof.raws.hide))), stashMean: mean(g.map((a) => a.prof.items.length)).toFixed(1), kitTop2: Math.round(mean(g.map((a) => top2(a).reduce((n, i) => n + pts(i.item), 0)))), winRate: (100 * mean(g.map((a) => a.prof.wins / Math.max(1, a.prof.runs)))).toFixed(0) + '%', marketSpent: Math.round(mean(g.map((a) => a.spent))), marketEarned: Math.round(mean(g.map((a) => a.earned))), standing: Math.round(mean(g.map((a) => a.prof.standing))) };
});
const a = w.audit();
const res = { players: P, days: DAYS, mode: MODE, idemRows, idemBytes, runs: runs.n, townDoneDay, listed, cancelled, salvaged, townFuse, firstFinds, factorRefused, sales: sales.length, salesAboveSalvage: sales.filter((s) => s.price > s.salvage).length, salesBuyerCouldSelfSupply: sales.filter((s) => s.selfSupply).length, salesFused: sales.filter((s) => s.fused).length, medianPerPt: sales.length ? median(sales.map((s) => s.perPt)) : 0, pairs: Object.entries(sales.reduce((m: any, s) => { const k = `${s.seller}->${s.buyer}`; m[k] = (m[k] ?? 0) + 1; return m; }, {})), daysTable: days, ledger, byStrat, auditOk: a.ok };
writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log(`players ${P} days ${DAYS} mode ${MODE}: runs ${runs.n}, town done day ${townDoneDay}, listings ${listed}, sales ${sales.length}, cancelled ${cancelled}, audit ${a.ok}`);
console.log(`idempotency records written: ${idemRows}, ${(idemBytes / 1e6).toFixed(1)} MB of stored responses (${idemRows ? Math.round(idemBytes / idemRows) : 0} bytes each)`);
console.log(table(days.filter((d) => [1, 2, 3, 5, 7, 10, 14, 20, 25, 30].includes(d.day))));
console.log(table(byStrat)); console.log(table(ledger as any));
