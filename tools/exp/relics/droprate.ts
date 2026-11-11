// How rare is rare? One million eligible wins through the real roll.
//   npx tsx tools/exp/relics/droprate.ts [wins=1000000] [seed=20261111]
//
// Every win goes through rollRelic() from server/relics.ts with the odds in
// server/config.ts: the same function and numbers the server uses in run/end.
// The dice here are a seeded generator so the report can be reproduced; the
// server throws crypto.randomInt. Prints the observed rate per relic beside
// the configured one, then what the configured odds mean for the world's
// supply after 30 days at three sizes of player base.

import { RELIC_ONE_IN, RELIC_ROLLS_PER_DAY } from '../../../server/config.ts';
import { mulberry32 } from '../../../server/provider.ts';
import { relicChance, relicChanceOf, rollRelic } from '../../../server/relics.ts';
import { RELICS } from '../../../src/shared/content/relics.ts';

const wins = Number(process.argv[2] ?? 1_000_000);
const seed = Number(process.argv[3] ?? 20261111);

// Two 32-bit draws make one 53-bit uniform, so the 1-in-1,500 range is resolved finely.
const next = mulberry32(seed);
const rnd = (): number => (Math.floor(next() * 0x4000000) * 0x8000000 + Math.floor(next() * 0x8000000)) / 0x20000000000000;

const found = new Map<string, number>(RELICS.map((r) => [r.id, 0]));
let total = 0;
let thrown = 0;
for (let i = 0; i < wins; i++) {
  thrown++;
  const id = rollRelic('win', rnd);
  if (!id) continue;
  total++;
  found.set(id, found.get(id)! + 1);
}

const n = (v: number, d = 0): string => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const oneIn = (p: number): string => (p > 0 ? `1 in ${n(1 / p)}` : 'never');
const pad = (s: string, w: number): string => s.padEnd(w);
const lpad = (s: string, w: number): string => s.padStart(w);

console.log(`Relic drop rate: ${n(wins)} eligible full wins through rollRelic('win'), dice seed ${seed}.`);
console.log(`Dice thrown: ${n(thrown)} (one per win).`);
console.log('');
console.log(`${pad('relic', 18)}${lpad('found', 8)}${lpad('observed', 16)}${lpad('configured', 16)}${lpad('expected', 11)}${lpad('z', 8)}`);
const row = (name: string, got: number, p: number): void => {
  const exp = wins * p;
  const z = (got - exp) / Math.sqrt(exp * (1 - p));
  console.log(`${pad(name, 18)}${lpad(n(got), 8)}${lpad(oneIn(got / wins), 16)}${lpad(oneIn(p), 16)}${lpad(n(exp, 1), 11)}${lpad(z.toFixed(2), 8)}`);
};
for (const r of RELICS) row(r.name, found.get(r.id)!, relicChanceOf('win', r.id));
row('Any relic', total, relicChance('win'));
console.log('');
console.log('z is the distance from the configured rate in standard deviations. Within about 2 is chance.');

// ---- what that means for the world ------------------------------------------
console.log('');
console.log('Expected relics in the world after 30 days, from the configured odds (wins only):');
console.log(`${pad('relic', 18)}${[1_000, 10_000, 100_000].map((w) => lpad(`${n(w)} wins/day`, 18)).join('')}`);
const supply = (name: string, p: number): void =>
  console.log(`${pad(name, 18)}${[1_000, 10_000, 100_000].map((w) => lpad(n(w * 30 * p, 2), 18)).join('')}`);
for (const r of RELICS) supply(r.name, relicChanceOf('win', r.id));
supply('All relics', relicChance('win'));

console.log('');
console.log('The other two sources, per report:');
console.log(`  a death on wave 9 or later   ${oneIn(relicChance('lateDeath'))}`);
console.log(`  the scored daily, cleared    ${oneIn(relicChance('daily'))}`);
console.log(`One account can put at most ${RELIC_ROLLS_PER_DAY} reports to the roll in 24 hours;`);
console.log(`at the win rate that is at best ${oneIn(1 - (1 - 1 / RELIC_ONE_IN.win) ** RELIC_ROLLS_PER_DAY)} per account per day.`);
