// The fixed effect vocabulary. Items are built only from these primitives.
// The model (or the procedural stand-in) picks primitives and levels; this
// table owns every number. Changing a number here rebalances every recipe
// ever discovered, because recipes store levels, not values.

// Recipes are keyed by this number. It was left at 1 when the fusion bonus went from 1.12 to 1.4 and the
// conversion primitives were added, because the server and its tests own the cache. Bump it there to re-roll
// recipes found under the old budget; until then an old recipe is simply a little under its new budget.
export const RULESET = 1;

export const STATS = [
  'maxHp', 'mend', 'armor', 'dodge', 'speed', 'damage', 'melee',
  'ranged', 'rate', 'crit', 'reach', 'harvest', 'luck',
] as const;
export type StatId = (typeof STATS)[number];

export const STAT_LABEL: Record<StatId, string> = {
  maxHp: 'Max HP', mend: 'Mend', armor: 'Armor', dodge: 'Dodge', speed: 'Speed',
  damage: 'Damage', melee: 'Melee', ranged: 'Ranged', rate: 'Rate', crit: 'Crit',
  reach: 'Reach', harvest: 'Harvest', luck: 'Luck',
};

/** Stats shown with a percent sign. */
export const STAT_PERCENT: Record<StatId, boolean> = {
  maxHp: false, mend: false, armor: false, dodge: true, speed: true,
  damage: true, melee: false, ranged: false, rate: true, crit: true,
  reach: false, harvest: false, luck: false,
};

export const RAWS = ['timber', 'ore', 'hide'] as const;
export type RawId = (typeof RAWS)[number];
export type RawBag = Record<RawId, number>;
export const emptyRaws = (): RawBag => ({ timber: 0, ore: 0, hide: 0 });

export type Levels = readonly [number, number, number, number, number];

export interface Primitive {
  id: string;
  kind: 'stat' | 'special';
  /** For kind 'stat'. */
  stat?: StatId;
  /** Tooltip text. {v} is replaced by the value at the item's level. */
  text: string;
  /** Value at levels 1-5. */
  values: Levels;
  /** Point cost at levels 1-5. */
  cost: Levels;
  /** Short hint for the model about what this primitive suits. */
  hint: string;
}

const C: Levels = [5, 10, 16, 24, 34];
const CHEAP: Levels = [3, 6, 10, 15, 21];
const MID: Levels = [4, 8, 13, 19, 27];
const DEAR: Levels = [6, 11, 17, 25, 35];

const stat = (id: StatId, values: Levels, hint: string): Primitive => ({
  id, kind: 'stat', stat: id, values, cost: C, hint,
  text: `+{v}${STAT_PERCENT[id] ? '%' : ''} ${STAT_LABEL[id]}`,
});
const special = (id: string, text: string, values: Levels, cost: Levels, hint: string): Primitive => ({
  id, kind: 'special', text, values, cost, hint,
});

export const PRIMITIVES: readonly Primitive[] = [
  stat('maxHp', [3, 6, 10, 15, 22], 'food, padding, bulk'),
  stat('mend', [1, 2, 3, 5, 7], 'salves, rest, warmth'),
  stat('armor', [1, 2, 3, 5, 7], 'plates, hide, shields'),
  stat('dodge', [3, 6, 9, 13, 18], 'light, slippery, quick'),
  stat('speed', [3, 6, 9, 13, 18], 'boots, light loads'),
  stat('damage', [4, 8, 13, 19, 27], 'general force'),
  stat('melee', [1, 2, 4, 6, 9], 'edges, weights, grips'),
  stat('ranged', [1, 2, 3, 5, 7], 'shot, powder, strings'),
  stat('rate', [4, 8, 13, 19, 27], 'grease, drills, stimulants'),
  stat('crit', [3, 5, 8, 12, 17], 'sharpness, sights, precision'),
  stat('reach', [10, 20, 32, 46, 64], 'poles, lenses, long things'),
  stat('harvest', [3, 6, 10, 15, 22], 'tools, baskets, know-how'),
  stat('luck', [5, 10, 16, 24, 34], 'charms, coins, odd finds'),

  special('thorns', 'Attackers take {v} damage, more with Armor', [8, 15, 25, 40, 60], C, 'spikes, burrs, barbs'),
  special('nodeBurst', 'Breaking a node throws {v} shards', [3, 5, 7, 10, 14], DEAR, 'splinters, blasting, quarry work'),
  special('nodeHeal', 'Breaking a node heals {v} HP', [2, 4, 6, 9, 13], C, 'forage, sap, marrow'),
  special('richNodes', '{v}% chance a node gives double', [6, 12, 18, 26, 36], C, 'prospecting, careful work'),
  special('killScrip', '{v}% chance a kill drops double scrip', [5, 10, 16, 24, 34], C, 'bounties, ledgers, greed'),
  special('interest', '+{v}% of held scrip at wave end, up to 6 per wave number', [2, 4, 6, 8, 11], C, 'lending, saving, strongboxes'),
  special('hoardTimber', '+{v}% Damage per 5 timber held', [1, 2, 3, 4, 6], C, 'wood, carrying timber'),
  special('hoardOre', '+1 Armor per {v} ore held', [14, 11, 9, 7, 5], C, 'ore, ballast, heavy pockets'),
  special('hoardHide', '+{v} Max HP per 5 hide held', [1, 2, 3, 4, 6], C, 'hides, layers, bundles'),
  special('lowHpRate', '+{v}% Rate below half health', [10, 18, 28, 40, 55], C, 'panic, spite, last efforts'),
  special('stillDamage', '+{v}% Damage while standing still', [8, 15, 24, 35, 48], C, 'bracing, stands, anchors'),
  special('movingDodge', '+{v}% Dodge while moving', [3, 6, 9, 12, 16], C, 'running, weaving'),
  special('waveShield', 'Start each wave with a {v} HP shield', [5, 10, 16, 24, 34], C, 'preparation, wards, wraps'),
  special('killBlast', 'Kills have a {v}% chance to burst', [6, 11, 17, 24, 33], DEAR, 'powder, gas, rot'),
  special('hurtBlast', 'When hurt, blast nearby enemies for {v}, more with Armor', [8, 15, 24, 36, 52], C, 'recoil, temper, springs'),
  special('pierce', 'Shots pierce 1 more at {v}% damage', [40, 55, 70, 85, 100], DEAR, 'needles, hard points'),
  special('bounce', 'Shots bounce 1 more at {v}% damage', [40, 55, 70, 85, 100], DEAR, 'rubber, springs, ricochet'),
  special('burn', 'Hits burn for {v} per second for 3 s', [1, 2, 3, 5, 7], DEAR, 'fire, pitch, embers'),
  special('knockback', '+{v} knockback', [4, 8, 12, 17, 23], CHEAP, 'weight, wedges, shoves'),
  special('rerollCut', 'Rerolls cost {v}% less', [10, 18, 26, 35, 45], MID, 'haggling, favours, lists'),
  special('eliteDamage', '+{v}% damage to elites and the boss', [10, 20, 32, 46, 64], MID, 'big game, traps, patience'),
  special('magnet', '+{v}% pickup range', [15, 30, 50, 75, 105], CHEAP, 'lodestones, nets, long arms'),
  special('xpGain', '+{v}% experience from scrip', [5, 10, 16, 23, 32], C, 'study, notes, practice'),
  // Conversions: each turns a stat that does not kill into damage, so a build can be made around it.
  special('killHeal', 'Kills have a {v}% chance to heal 1 HP', [4, 8, 13, 19, 27], C, 'blood, broth, trophies'),
  special('armorDamage', '+{v}% Damage per 2 Armor', [1, 1.5, 2, 3, 4], DEAR, 'plate edges, shield rims, weight behind a blow'),
  special('hpDamage', '+{v}% Damage per 10 Max HP', [1, 2, 3, 4, 6], DEAR, 'bulk, big meals, broad shoulders'),
  special('dodgeStrike', 'A dodge blasts nearby enemies for {v}', [30, 50, 80, 120, 170], C, 'feints, counters, quick hands'),
  special('speedDamage', '+{v}% Damage per 10% Speed', [3, 5, 8, 11, 15], DEAR, 'momentum, running starts, light feet'),
  special('scripDamage', '+{v}% Damage per 50 scrip held, counted up to 300', [2, 3, 5, 7, 10], C, 'purses, payrolls, hired help'),
  special('harvestDamage', '+{v}% Damage per 10 Harvest', [2, 3, 4, 6, 8], DEAR, 'working tools, calluses, trade skill'),
  special('luckCrit', '+{v}% Crit per 20 Luck', [1, 2, 3, 4, 6], C, 'dice, omens, lucky shots'),
  special('workHaste', '+{v}% Rate while working a node', [10, 18, 28, 40, 55], MID, 'work songs, rhythm, busy hands'),
  special('pureSet', '+{v}% Damage while every weapon held shares a class', [6, 10, 15, 21, 28], C, 'matched sets, drill, uniform kit'),
  special('fewWeapons', '+{v}% Rate per empty weapon slot', [4, 7, 10, 14, 19], C, 'travelling light, one good tool'),
  special('secondWind', 'Once per wave, survive a killing blow with {v} HP', [1, 5, 10, 18, 30], [14, 18, 23, 29, 36], 'stubbornness, spare parts, luck'),
];

// Null prototype so keys like '__proto__' from untrusted input never resolve.
export const PRIM: Record<string, Primitive> = Object.assign(Object.create(null), Object.fromEntries(PRIMITIVES.map((p) => [p.id, p])));

/**
 * Relic-only effects. Each one breaks a rule of the game instead of raising a
 * number, so it has no level, no value and no point cost. They are kept out of
 * PRIMITIVES and PRIM on purpose: the fusion model's vocabulary, the
 * procedural generator, validatePick and repairEffects all read those two
 * tables, so none of them can ever hand a relic effect out. The sim honours
 * them only on an item flagged `relic` (see src/shared/content/relics.ts).
 */
export interface RelicPrimitive {
  id: string;
  /** The whole tooltip. One line. */
  text: string;
  /** Where the rule lives: in the run simulation or in the town's books. */
  where: 'run' | 'town';
}

export const RELIC_PRIMITIVES: readonly RelicPrimitive[] = [
  { id: 'extraSlot', where: 'run', text: 'Hold one more weapon' },
  { id: 'safeWork', where: 'run', text: 'Nothing can hurt you while you work a node' },
  { id: 'regrow', where: 'run', text: 'A broken node grows back once in the same wave' },
  { id: 'noRawCost', where: 'run', text: 'Weapons at the bench need no raws' },
  { id: 'secondLife', where: 'run', text: 'Once a run, a killing blow leaves you standing at half health' },
  { id: 'extraOffer', where: 'run', text: 'The bench makes a fifth offer' },
  { id: 'extraCarry', where: 'town', text: 'Carry home one more item' },
  { id: 'keepCharge', where: 'town', text: 'The item packed beside it loses no charge on a win' },
];

export const RELIC_PRIM: Record<string, RelicPrimitive> = Object.assign(
  Object.create(null),
  Object.fromEntries(RELIC_PRIMITIVES.map((p) => [p.id, p])),
);

/** Fraction of cost refunded by a drawback (a stat primitive taken negative). */
export const DRAWBACK_REFUND = 0.6;

/** Drawn icons an item can use. The renderer has one drawing per glyph. */
export const GLYPHS = [
  'blade', 'hammer', 'ring', 'flask', 'bone', 'feather', 'cog', 'rope',
  'lantern', 'boot', 'horn', 'sack', 'stone', 'coin', 'leaf', 'tooth',
  'bell', 'nail', 'pelt', 'bowl', 'candle', 'hook', 'wedge', 'charm',
] as const;
export type GlyphId = (typeof GLYPHS)[number];

/** Points at which an item reaches tiers 2, 3 and 4. */
export const TIER_AT = [0, 16, 32, 64] as const;
export const MAX_POINTS = 110;
export const FUSION_BONUS = 1.4;

/** Raw cost of a fusion by output tier (index 1-4). The town workshop charges a multiple of this (server/config.ts). */
export const FUSE_RAW_COST: readonly RawBag[] = [
  emptyRaws(),
  { timber: 2, ore: 1, hide: 1 },
  { timber: 3, ore: 2, hide: 2 },
  { timber: 5, ore: 4, hide: 3 },
  { timber: 8, ore: 6, hide: 5 },
];
/** Raw cost of the first fusion at a bench during a run, by output tier (index 1-4). Each further fusion at the same bench costs one more set. */
export const RUN_FUSE_RAW_COST: readonly RawBag[] = [
  emptyRaws(),
  { timber: 1, ore: 0, hide: 0 },
  { timber: 1, ore: 1, hide: 0 },
  { timber: 2, ore: 1, hide: 1 },
  { timber: 2, ore: 2, hide: 2 },
];
