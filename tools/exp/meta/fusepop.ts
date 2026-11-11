// Experiment 3b: how fast does a population use up first finds? Real /api/fuse (ctx 'run', the in-run lookup), simulated clock.
//   npx tsx tools/exp/meta/fusepop.ts <players> <days> <out.json>
import { writeFileSync } from 'node:fs';
import { BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { itemTier, type ItemSpec } from '../../../src/shared/item.ts';
import { DAY, table, world } from './lib.ts';

const P = Number(process.argv[2] ?? 100), DAYS = Number(process.argv[3] ?? 30), OUT = process.argv[4] ?? '/tmp/fusepop.json';
let seed = 4242;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const fus = BASE_ITEMS.filter((i) => itemTier(i) < 4);
const byTier = [1, 2, 3].map((t) => fus.filter((i) => itemTier(i) === t));
// What a run hands you: mostly tier 1 and 2.
const benchItem = () => { const r = rnd(); const pool = byTier[r < 0.55 ? 0 : r < 0.87 ? 1 : 2]; return pool[Math.floor(rnd() * pool.length)]; };
const basePairs = new Set<string>(); for (let i = 0; i < fus.length; i++) for (let j = i + 1; j < fus.length; j++) basePairs.add([fus[i].id, fus[j].id].sort().join('+'));

const w = world();
interface A { token: string; hunter: boolean; joined: number; made: ItemSpec[]; finds: number; tries: number }
const agents: A[] = [];
const add = async (joined: number) => { agents.push({ token: (await w.hello()).token, hunter: agents.length % 10 === 0, joined, made: [], finds: 0, tries: 0 }); };
for (let i = 0; i < P; i++) await add(0);
const found = new Set<string>(); // base pairs found
const worldFusable: ItemSpec[] = []; // what a wiki would list
const rows: any[] = [];
for (let day = 0; day < DAYS; day++) {
  w.setNow(Date.UTC(2026, 10, 11) + day * DAY + 9 * 3600_000);
  if (day === 7) for (let i = 0; i < Math.max(2, Math.round(P * 0.2)); i++) await add(7); // a second wave of players in week 2
  let tries = 0, firsts = 0, refused = 0, lateTries = 0, lateFirsts = 0, casualTries = 0, casualFirsts = 0;
  for (const a of agents) {
    const n = a.hunter ? 30 : 2 + Math.floor(rnd() * 5); // hunters push past the allowance; others fuse 2-6 times a day
    for (let k = 0; k < n; k++) {
      let x: ItemSpec, y: ItemSpec;
      if (a.hunter) {
        // Works from a shared wiki: an untried authored pair if any are left, else an authored item with a known fused one.
        const left = [...basePairs].filter((p) => !found.has(p));
        if (left.length) { const [i, j] = left[Math.floor(rnd() * left.length)].split('+'); x = fus.find((f) => f.id === i)!; y = fus.find((f) => f.id === j)!; }
        else { x = worldFusable[Math.floor(rnd() * worldFusable.length)]; y = rnd() < 0.5 ? benchItem() : worldFusable[Math.floor(rnd() * worldFusable.length)]; }
      } else {
        x = benchItem();
        y = a.made.length && rnd() < 0.3 ? a.made[Math.floor(rnd() * a.made.length)] : benchItem();
      }
      if (x.id === y.id) continue;
      const r = await w.post('/api/fuse', a.token, { a: x.id, b: y.id, ctx: 'run' });
      if (r.status === 429) { refused++; if (a.hunter) break; continue; }
      if (r.status !== 200) continue;
      tries++; a.tries++;
      const key = [x.id, y.id].sort().join('+');
      if (basePairs.has(key)) found.add(key);
      if (r.body.first) { firsts++; a.finds++; if (itemTier(r.body.item) < 4) worldFusable.push(r.body.item); }
      if (!a.hunter) { casualTries++; if (r.body.first) casualFirsts++; }
      if (a.joined > 0 && !a.hunter) { lateTries++; if (r.body.first) lateFirsts++; }
      if (itemTier(r.body.item) < 4 && a.made.length < 40) a.made.push(r.body.item);
    }
  }
  const finds = agents.map((a) => a.finds).sort((x, y) => y - x);
  const total = finds.reduce((x, y) => x + y, 0);
  const top = finds.slice(0, Math.max(1, Math.round(agents.length * 0.1))).reduce((x, y) => x + y, 0);
  const cx = (await w.get('/api/codex', agents[0].token)).body;
  rows.push({
    day: day + 1, players: agents.length, fusions: tries, firstFinds: firsts, 'first %': Math.round(100 * firsts / Math.max(1, tries)),
    'casual first %': Math.round(100 * casualFirsts / Math.max(1, casualTries)), 'week-2 joiner first %': lateTries ? Math.round(100 * lateFirsts / lateTries) : '-',
    'authored pairs found (of 741)': found.size, worldRecipes: cx.worldRecipes, worldItems: cx.worldItems, 'top 10% share of finds': Math.round(100 * top / Math.max(1, total)) + '%',
    'players with 0 finds': finds.filter((f) => f === 0).length, refusedByLimit: refused,
  });
}
const sel = rows.filter((r) => [1, 2, 3, 5, 7, 8, 10, 14, 21, 30].includes(r.day));
console.log(`### ${P} players\n` + table(sel));
writeFileSync(OUT, JSON.stringify({ players: P, rows }, null, 1));
