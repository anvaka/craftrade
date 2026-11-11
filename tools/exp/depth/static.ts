// Static content audit: counts, weapon efficiency, set bonus size, price against income.
// No runs; reads the data tables only.   npx tsx tools/exp/depth/static.ts
import { BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { itemPoints, itemTier } from '../../../src/shared/item.ts';
import { PRIMITIVES, STATS } from '../../../src/shared/vocab.ts';
import { CHARACTERS } from '../../../src/sim/data/characters.ts';
import { ENEMIES } from '../../../src/sim/data/enemies.ts';
import { UPGRADE_VALUE } from '../../../src/sim/data/upgrades.ts';
import { WAVES } from '../../../src/sim/data/waves.ts';
import { SET_BONUS, WEAPONS } from '../../../src/sim/data/weapons.ts';
import { priceAt } from '../../../src/sim/bench.ts';

const f1 = (v: number) => v.toFixed(1), f2 = (v: number) => v.toFixed(2);
console.log('## Content counts\n');
const tiers = [0, 0, 0, 0, 0];
for (const i of BASE_ITEMS) tiers[itemTier(i)]++;
console.log(`characters ${CHARACTERS.length}; weapons ${WEAPONS.length} x 4 tiers; items ${BASE_ITEMS.length} (tier 1/2/3/4: ${tiers.slice(1).join('/')}); stats ${STATS.length}; special primitives ${PRIMITIVES.length - STATS.length}; enemies ${ENEMIES.length} (${ENEMIES.filter((e) => e.rank === 0).length} regular, 2 elites, 1 boss); waves ${WAVES.length}; weapon classes ${Object.keys(SET_BONUS).length}`);
const used = new Map<string, number>();
for (const i of BASE_ITEMS) for (const e of i.effects) if (!e.neg) used.set(e.p, (used.get(e.p) ?? 0) + 1);
console.log(`primitives carried by exactly one authored item: ${PRIMITIVES.filter((p) => used.get(p.id) === 1).map((p) => p.id).join(', ')}`);
console.log(`primitives carried by no authored item: ${PRIMITIVES.filter((p) => !used.has(p.id)).map((p) => p.id).join(', ') || 'none'}`);
console.log(`items with a drawback: ${BASE_ITEMS.filter((i) => i.effects.some((e) => e.neg)).length} of ${BASE_ITEMS.length}; items that change a rule rather than add a number (special primitive): ${BASE_ITEMS.filter((i) => i.effects.some((e) => !e.neg && !STATS.includes(e.p as never))).length}`);
console.log(`mean points per item by tier: ${[1, 2, 3, 4].map((t) => f1(BASE_ITEMS.filter((i) => itemTier(i) === t).reduce((n, i) => n + itemPoints(i.effects), 0) / tiers[t])).join(' / ')}`);

console.log('\n## Weapons: single-target damage per second with no stats, and per scrip of base price\n');
console.log('| weapon | class | T1 dps | T4 dps | T4/T1 | T1 dps per base scrip | T4 dps per scrip spent on 8 T1 copies | dps gained per point of its stat | per tier I upgrade pick | hits many |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const w of WEAPONS) {
  const dps = (t: number) => (w.dmg[t] * (1 + w.crit / 100)) / w.cd[t] + (w.burn ? w.burn[t] : 0);
  const sc = w.scale.ranged ? ['ranged', w.scale.ranged] as const : ['melee', w.scale.melee ?? 0] as const;
  const perPoint = sc[1] / w.cd[0];
  console.log(`| ${w.id} | ${w.classes.join('/')} | ${f1(dps(0))} | ${f1(dps(3))} | ${f1(dps(3) / dps(0))} | ${f2(dps(0) / w.price[0])} | ${f2(dps(3) / (8 * w.price[0]))} | ${f2(perPoint)} (${sc[0]}) | ${f2(perPoint * UPGRADE_VALUE[sc[0]][0])} | ${w.kind === 'sweep' ? `arc ${w.width}` : w.pierce ? `pierce ${w.pierce}` : w.bounce ? `bounce ${w.bounce}` : w.kind === 'thrust' ? `line ${w.width}px` : 'no'} |`);
}
console.log('\nSix tier 1 copies against one tier 4 (8 copies merged, 1 slot): a T4 is worth this many T1 of the same weapon in dps:');
console.log(WEAPONS.map((w) => `${w.id} ${f1((w.dmg[3] / w.cd[3]) / (w.dmg[0] / w.cd[0]))}`).join(', '));

console.log('\n## Set bonuses against one upgrade pick\n');
for (const [c, bs] of Object.entries(SET_BONUS)) for (const b of bs) {
  console.log(`${c}: +${b.v.join(' / ')} ${b.stat} at 2 / 4 / 6 held = ${b.v.map((v) => f1(v / UPGRADE_VALUE[b.stat][0])).join(' / ')} tier I picks of ${b.stat}`);
}

console.log('\n## Enemy health and damage by wave (linear)\n');
console.log('| enemy | hp w1 | hp w6 | hp w12 | x | dmg w1 | dmg w12 | x |');
console.log('|---|---|---|---|---|---|---|---|');
for (const e of ENEMIES) console.log(`| ${e.id} | ${e.hp} | ${f1(e.hp + e.hpW * 5)} | ${f1(e.hp + e.hpW * 11)} | ${f1((e.hp + e.hpW * 11) / e.hp)} | ${e.dmg} | ${f1(e.dmg + e.dmgW * 11)} | ${e.dmg ? f1((e.dmg + e.dmgW * 11) / e.dmg) : '-'} |`);
console.log('\nPlayer starts with 10 max HP and gains 1 per level. A wave 12 mite hit is ' + f1(1 + 0.85 * 11) + ' before armor.');

console.log('\n## Bench price of a base-48 (tier 3) item and a tier 1 sling by bench\n');
console.log('| bench | ' + [1, 3, 5, 7, 9, 11].join(' | ') + ' |\n|---|---|---|---|---|---|---|');
console.log('| item, base 48 | ' + [1, 3, 5, 7, 9, 11].map((b) => priceAt(48, b)).join(' | ') + ' |');
console.log('| item, base 16 | ' + [1, 3, 5, 7, 9, 11].map((b) => priceAt(16, b)).join(' | ') + ' |');
console.log('| sling T1, base 9 | ' + [1, 3, 5, 7, 9, 11].map((b) => priceAt(9, b)).join(' | ') + ' |');
