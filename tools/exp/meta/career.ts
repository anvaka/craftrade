// Experiment 1: careers through the real API. npx tsx tools/exp/meta/career.ts <skill> <runs> <seed> <policy> [out.json]
// policy:
//   'regular'  kit the two best items for the hazard, fuse authored pairs for the almanac, repair what wears, buy a shelf
//              when the stash fills, give half the spare raws to the town. No Factor trades.
//   'optimal'  as regular, gives every raw, and spends spare marks at the Factor on what the project still needs.
//   'naive'    kit the two best items, never fuse or repair, sell raws to the Factor.
//   'nokit'    naive without a kit.
// A policy name ending in "+climb" plays every run at the highest hazard open for the character. The sim does not
// scale with hazard yet (createRun ignores it), so a climbing career wins more than it should; what it shows is
// what the sinks cost once strong items are worth packing, not how hard the ladder is.
import { writeFileSync } from 'node:fs';
import { BASE_ITEM } from '../../../src/shared/content/items.ts';
import { fusionBlock, fusionBudget, itemTier, tierOf } from '../../../src/shared/item.ts';
import { kitPointCap, packItem } from '../../../src/shared/kit.ts';
import type { Profile, StashItem } from '../../../src/shared/protocol.ts';
import { canPay, repairCost, stashNextCost, townFuseCost } from '../../../src/shared/rules.ts';
import { RAWS } from '../../../src/shared/vocab.ts';
import { DAY, SKILLS, apiRun, idem, pts, world } from './lib.ts';

const skill = SKILLS[process.argv[2] ?? 'average'];
const RUNS = Number(process.argv[3] ?? 120);
const seed = Number(process.argv[4] ?? 1);
const policyArg = process.argv[5] ?? 'regular';
const climb = policyArg.endsWith('+climb');
const policy = policyArg.replace('+climb', '');
const out = process.argv[6] ?? `/tmp/career-${skill.name}-${policyArg}-${seed}.json`;
const RUNS_PER_DAY = 5;
const CHARS = ['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk'];
let HAZARD = 0;
const FLOAT = Number(process.env.FLOAT ?? 300);
let funded = 0;

const w = world();
const token = (await w.hello()).token;
let prof: Profile = (await w.hello(token)).profile;
const rows: any[] = [];
let firsts = 0, townFuses = 0, kitFuses = 0, repairs = 0, shelves = 0, townDoneRun = -1, bought = 0, worksDone = 0;
const purse = () => ({ marks: prof.marks, raws: prof.raws });
const packed = (i: StashItem) => pts(packItem(i.item, HAZARD));
const made = new Set<string>();

/** The kit: the two items worth most once packed for the hazard; among equals, the one that is cheapest to wear out. */
const kitPick = () => prof.items.filter((i) => !i.item.relic).slice().sort((a, b) => packed(b) - packed(a) || pts(a.item) - pts(b.item) || a.charges - b.charges).slice(0, 2);

/** Build the kit up to what the hazard lets in: fuse the two strongest spare items while that beats the weaker kit item. */
async function buildKit(reserve: number) {
  const cap = kitPointCap(HAZARD);
  for (let guard = 0; guard < 3; guard++) {
    const kit = kitPick();
    const weakest = kit.length < 2 ? 0 : Math.min(...kit.map((k) => pts(k.item)));
    if (weakest >= Math.min(cap, 100)) return;
    const pool = prof.items.filter((i) => !i.item.relic && itemTier(i.item) < 4).sort((a, b) => pts(b.item) - pts(a.item));
    let best: [StashItem, StashItem] | null = null, bestBudget = weakest;
    for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
      if (fusionBlock(pool[i].item, pool[j].item)) continue;
      const budget = fusionBudget(pool[i].item, pool[j].item);
      // No point making more than the hazard lets in, or wasting points over the item cap.
      if (budget <= bestBudget || budget > cap * 1.3 + 8) continue;
      if (!canPay({ marks: prof.marks - reserve, raws: prof.raws }, townFuseCost(tierOf(budget)))) continue;
      best = [pool[i], pool[j]]; bestBudget = budget;
    }
    if (!best) return;
    const r = await w.post('/api/fuse', token, { a: best[0].item.id, b: best[1].item.id, ctx: 'town', uidA: best[0].uid, uidB: best[1].uid });
    if (r.status !== 200) return;
    townFuses++; kitFuses++; if (r.body.counted) firsts++;
    prof = r.body.profile;
  }
}

/** Workshop: fuse pairs of authored items not yet made, for the almanac, while it can be paid for and a reserve is left. */
async function workshop(reserve: number) {
  const kit = new Set(kitPick().map((k) => k.uid));
  for (let guard = 0; guard < 6; guard++) {
    const spare = prof.items.filter((i) => !kit.has(i.uid) && BASE_ITEM[i.item.id] && itemTier(i.item) < 4);
    let best: [StashItem, StashItem] | null = null;
    for (let i = 0; i < spare.length && !best; i++) for (let j = i + 1; j < spare.length; j++) {
      const a = spare[i], b = spare[j];
      if (fusionBlock(a.item, b.item)) continue;
      const key = a.item.id < b.item.id ? `${a.item.id}+${b.item.id}` : `${b.item.id}+${a.item.id}`;
      if (made.has(key)) continue;
      const cost = townFuseCost(tierOf(fusionBudget(a.item, b.item)));
      if (!canPay({ marks: prof.marks - reserve, raws: prof.raws }, cost)) continue;
      best = [a, b];
      made.add(key);
      break;
    }
    if (!best) return;
    const [a, b] = best;
    const r = await w.post('/api/fuse', token, { a: a.item.id, b: b.item.id, ctx: 'town', uidA: a.uid, uidB: b.uid });
    if (r.status !== 200) return; // untried pairs used up for today
    townFuses++; if (r.body.counted) firsts++;
    prof = r.body.profile;
  }
}

/** Put a charge back on a kit item that is down to its last, if it is worth more packed than what would replace it. */
async function mend() {
  for (const k of kitPick()) {
    if (k.charges > 1 || (k.repairs ?? 0) >= 2) continue;
    const next = prof.items.filter((i) => i.uid !== k.uid && !i.item.relic).map(packed).sort((a, b) => b - a)[1] ?? 0;
    if (packed(k) <= next) continue; // a spare is as good: let it wear out
    if (!canPay(purse(), repairCost(k.item))) continue;
    const r = await w.post('/api/workshop/repair', token, { uid: k.uid, idem: idem() });
    if (r.status === 200) { repairs++; prof = r.body.profile; }
  }
}

async function shelf() {
  if (prof.stashLimit - prof.stashUsed > 3) return;
  const cost = stashNextCost(prof.stashBought);
  if (!cost || !canPay(purse(), cost)) return;
  const r = await w.post('/api/stash/expand', token, { idem: idem() });
  if (r.status === 200) { shelves++; prof = r.body.profile; }
}

/** Salvage the weakest spare items when the stash is nearly full and no shelf can be bought. */
async function clear() {
  const kit = new Set(kitPick().map((k) => k.uid));
  while (prof.stashLimit - prof.stashUsed < 3) {
    const junk = prof.items.filter((i) => !kit.has(i.uid) && !i.item.relic).sort((a, b) => pts(a.item) - pts(b.item))[0];
    if (!junk) return;
    const r = await w.post('/api/market/salvage', token, { uid: junk.uid });
    if (r.status !== 200) return;
    prof = r.body.profile;
  }
}

for (let n = 1; n <= RUNS; n++) {
  if ((n - 1) % RUNS_PER_DAY === 0 && n > 1) w.setNow(Math.floor(w.now() / DAY) * DAY + DAY + 9 * 3600_000);
  const character = CHARS[(n - 1) % prof.characters.length];
  if (climb) HAZARD = prof.hazard[(prof.characters.includes(character as any) ? character : 'greenhorn') as keyof typeof prof.hazard].open;
  const kit = policy === 'nokit' ? [] : kitPick().map((i) => i.uid);
  const r = await apiRun(w, token, skill, { kit, character: prof.characters.includes(character as any) ? character : 'greenhorn', botSeed: seed * 100003 + n, hazard: HAZARD });
  prof = r.profile;
  const feats = new Set(prof.features);

  if (policy === 'regular' || policy === 'optimal') {
    await mend();
    await shelf();
    if (feats.has('workshop')) { await buildKit(100); await workshop(150); }
    await clear();
    if (feats.has('town')) {
      const town = (await w.get('/api/town', token)).body;
      if (town.project.kind === 'works' && townDoneRun < 0) townDoneRun = n;
      // Keep a float of raws for fusing and repairs; the rest goes to the town (half of it for a regular player).
      const share = policy === 'optimal' ? 1 : 0.5;
      const give: any = {};
      for (const raw of RAWS) give[raw] = Math.floor(Math.max(0, prof.raws[raw] - 40) * share);
      // Marks over a float of about five runs' income go to the town too: the Factor delivers at his price.
      const spare = policy === 'regular' ? Math.max(0, prof.marks - FLOAT) : 0;
      if (give.timber + give.ore + give.hide > 0 || spare >= 30) {
        const before = prof.marks;
        const g = await w.post('/api/town/give', token, { raws: give, marks: spare, idem: idem() });
        if (g.status === 200) { prof = g.body.profile; funded += before - prof.marks; }
      }
      if (policy === 'optimal' && feats.has('market')) {
        // Spare marks: buy what the project still needs from the Factor, up to the day's allowance, and give it.
        const t2 = (await w.get('/api/town', token)).body;
        for (const raw of RAWS) {
          let need = t2.project.need[raw] - t2.project.have[raw];
          while (need > 0) {
            const q = (await w.get('/api/market', token)).body.factor[raw];
            const qty = Math.min(need, 100, q.buyLeft, Math.floor((prof.marks - 150) / q.buy));
            if (qty < 1) break;
            const b = await w.post('/api/market/factor', token, { raw, side: 'buy', qty, idem: idem() });
            if (b.status !== 200) break;
            prof = b.body.profile; bought += qty; need -= qty;
            const g2 = await w.post('/api/town/give', token, { raws: { [raw]: qty }, idem: idem() });
            if (g2.status === 200) prof = g2.body.profile;
          }
        }
      }
    }
  } else {
    await clear();
    if (feats.has('market')) {
      // Naive: sell all raws to the Factor, as far as it will take them today.
      for (const raw of RAWS) {
        while (prof.raws[raw] > 0) {
          const q = (await w.get('/api/market', token)).body.factor[raw];
          const qty = Math.min(100, prof.raws[raw], q.sellLeft);
          if (qty < 1) break;
          const s = await w.post('/api/market/factor', token, { raw, side: 'sell', qty, idem: idem() });
          if (s.status !== 200) break;
          prof = s.body.profile;
        }
      }
    }
  }
  worksDone = (w.db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE kind = 'works' AND done = 1`).get() as any).n;
  const st = r.ticket.stations;
  const stash = prof.items.map((i) => pts(i.item)).sort((a, b) => b - a);
  rows.push({
    n, won: r.sum.won ? 1 : 0, waves: r.sum.wavesCleared, kit: r.kitPoints, marks: prof.marks,
    raws: prof.raws.timber + prof.raws.ore + prof.raws.hide, stash: prof.items.length, top2: (stash[0] ?? 0) + (stash[1] ?? 0),
    gainedRaws: RAWS.reduce((x, k) => x + r.end.gained.raws[k], 0), gainedMarks: r.end.gained.marks, gainedItems: r.end.gained.items.length,
    standing: prof.standing, stations: st.sawmill + st.smelter + st.tannery + st.assay, finds: prof.finds, chars: prof.characters.length, feats: prof.features.length,
    stashLimit: prof.stashLimit, titles: prof.titles.length, works: worksDone, hazard: HAZARD,
  });
}
const a = w.audit();
const ledger = w.db.prepare('SELECT kind, SUM(marks) AS marks, SUM(timber+ore+hide) AS raws, COUNT(*) AS n FROM ledger GROUP BY kind').all();
const alm = (await w.get('/api/almanac', token)).body;
writeFileSync(out, JSON.stringify({ skill: skill.name, policy: policyArg, seed, kitFuses, funded, rows, firsts, townFuses, refreshes: repairs, repairs, shelves, townDoneRun, bought, worksDone, almanac: { have: alm.have, of: alm.of, lines: alm.lines }, titles: prof.titles, auditOk: a.ok, ledger }));
const income = rows.reduce((x, r) => x + r.gainedMarks, 0) / RUNS;
console.log(skill.name, policyArg, seed, 'done; wins', rows.reduce((x, r) => x + r.won, 0), '/', RUNS, 'marks', prof.marks, `(${(prof.marks / income).toFixed(1)} runs of income)`, 'raws', prof.raws.timber + prof.raws.ore + prof.raws.hide, 'stash', prof.items.length, 'town fuses', townFuses, `(${kitFuses} for the kit)`, 'top hazard', Math.max(...rows.map((r) => r.hazard)), 'marks to town', funded, 'repairs', repairs, 'shelves', shelves, 'stations done at run', townDoneRun, 'works', worksDone, 'almanac', `${alm.have}/${alm.of}`, 'titles', prof.titles.join(','), 'audit', a.ok);
