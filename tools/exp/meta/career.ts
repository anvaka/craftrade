// Experiment 1: careers through the real API. npx tsx tools/exp/meta/career.ts <skill> <runs> <seed> <policy>
// policy: 'optimal' (fuse up, refresh charges, donate, buy raws with spare marks) | 'naive' (kit best items, no fusing, sell raws)
import { writeFileSync } from 'node:fs';
import { RAWS } from '../../../src/shared/vocab.ts';
import { itemTier, fusionBudget } from '../../../src/shared/item.ts';
import type { Profile, StashItem } from '../../../src/shared/protocol.ts';
import { DAY, SKILLS, apiRun, idem, pts, world } from './lib.ts';

const skill = SKILLS[process.argv[2] ?? 'average'];
const RUNS = Number(process.argv[3] ?? 120);
const seed = Number(process.argv[4] ?? 1);
const policy = process.argv[5] ?? 'optimal';
const out = process.argv[6] ?? `/tmp/career-${skill.name}-${policy}-${seed}.json`;
const RUNS_PER_DAY = 5;
const CHARS = ['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk'];

const w = world();
const token = (await w.hello()).token;
let prof: Profile = (await w.hello(token)).profile;
const rows: any[] = [];
let firsts = 0, townFuses = 0, refreshes = 0, townDoneRun = -1, bought = 0;

/** Workshop: fuse the stash upward. Keeps nothing back: the output is always at least as strong as the stronger input. */
async function workshop() {
  for (let guard = 0; guard < 40; guard++) {
    const items = prof.items.filter((i) => itemTier(i.item) < 4).sort((a, b) => pts(b.item) - pts(a.item));
    if (items.length < 2) return;
    // Pick the pair with the highest budget that does not waste points over the 110 cap; prefer refreshing a worn item.
    let best: [StashItem, StashItem] | null = null, bestScore = -1;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      if (items[i].item.id === items[j].item.id) continue;
      const raw = (pts(items[i].item) + pts(items[j].item)) * 1.12;
      const budget = fusionBudget(items[i].item, items[j].item);
      const waste = Math.max(0, raw - 110);
      const worn = (3 - items[i].charges) + (3 - items[j].charges);
      const score = budget - waste * 2 + worn * 3;
      if (score > bestScore) { bestScore = score; best = [items[i], items[j]]; }
    }
    if (!best) return;
    const [a, b] = best;
    // Do not fuse two fresh items if the result is not better than what is already the best kit pair (keeps going until the stash is two items deep).
    const r = await w.post('/api/fuse', token, { a: a.item.id, b: b.item.id, ctx: 'town', uidA: a.uid, uidB: b.uid });
    if (r.status !== 200) return; // novel limit: stop for today
    townFuses++; if (r.body.first) firsts++;
    if (a.charges < 3 || b.charges < 3) refreshes++;
    prof = r.body.profile;
  }
}

for (let n = 1; n <= RUNS; n++) {
  if ((n - 1) % RUNS_PER_DAY === 0 && n > 1) w.setNow(Math.floor(w.now() / DAY) * DAY + DAY + 9 * 3600_000);
  // Kit: the two strongest stash items.
  const kit = policy === 'nokit' ? [] : prof.items.slice().sort((a, b) => pts(b.item) - pts(a.item) || a.charges - b.charges).slice(0, 2).map((i) => i.uid);
  const character = CHARS[(n - 1) % prof.characters.length];
  const r = await apiRun(w, token, skill, { kit, character: prof.characters.includes(character as any) ? character : 'greenhorn', botSeed: seed * 100003 + n });
  prof = r.profile;
  const feats = new Set(prof.features);

  if (policy === 'optimal') {
    if (feats.has('workshop')) await workshop();
    if (feats.has('town')) {
      const town = (await w.get('/api/town', token)).body;
      if (town.project) {
        const g = await w.post('/api/town/give', token, { raws: prof.raws });
        if (g.status === 200) prof = g.body.profile;
        // Spare marks have no other use: buy what the project still needs from the Factor.
        const t2 = (await w.get('/api/town', token)).body;
        if (t2.project && feats.has('market')) {
          for (const raw of RAWS) {
            let need = t2.project.need[raw] - t2.project.have[raw];
            while (need > 0) {
              const m = (await w.get('/api/market', token)).body;
              const q = m.factor[raw];
              const qty = Math.min(need, 100, q.buyLeft, Math.floor(prof.marks / q.buy));
              if (qty < 1) break;
              const b = await w.post('/api/market/factor', token, { raw, side: 'buy', qty, idem: idem() });
              if (b.status !== 200) break;
              prof = b.body.profile; bought += qty; need -= qty;
            }
          }
          const g2 = await w.post('/api/town/give', token, { raws: prof.raws });
          if (g2.status === 200) prof = g2.body.profile;
        }
      } else if (townDoneRun < 0) townDoneRun = n;
    }
  } else if (feats.has('market')) {
    // Naive: sell all raws to the Factor.
    for (const raw of RAWS) {
      while (prof.raws[raw] > 0) {
        const s = await w.post('/api/market/factor', token, { raw, side: 'sell', qty: Math.min(100, prof.raws[raw]), idem: idem() });
        if (s.status !== 200) break;
        prof = s.body.profile;
      }
    }
  }
  const st = r.ticket.stations;
  const stash = prof.items.map((i) => pts(i.item)).sort((a, b) => b - a);
  rows.push({
    n, won: r.sum.won ? 1 : 0, waves: r.sum.wavesCleared, kit: r.kitPoints, marks: prof.marks,
    raws: prof.raws.timber + prof.raws.ore + prof.raws.hide, stash: prof.items.length, top2: (stash[0] ?? 0) + (stash[1] ?? 0),
    gainedRaws: RAWS.reduce((x, k) => x + r.end.gained.raws[k], 0), gainedMarks: r.end.gained.marks, gainedItems: r.end.gained.items.length,
    standing: prof.standing, stations: st.sawmill + st.smelter + st.tannery + st.assay, finds: prof.finds, chars: prof.characters.length, feats: prof.features.length,
  });
}
const a = w.audit();
const ledger = w.db.prepare('SELECT kind, SUM(marks) AS marks, SUM(timber+ore+hide) AS raws, COUNT(*) AS n FROM ledger GROUP BY kind').all();
writeFileSync(out, JSON.stringify({ skill: skill.name, policy, seed, rows, firsts, townFuses, refreshes, townDoneRun, bought, auditOk: a.ok, ledger }));
console.log(skill.name, policy, seed, 'done; wins', rows.reduce((x, r) => x + r.won, 0), '/', RUNS, 'marks', prof.marks, 'townDone', townDoneRun, 'audit', a.ok);
