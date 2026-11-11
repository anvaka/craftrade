// The fixed effect vocabulary. Items are built only from these primitives.
// The model (or the procedural stand-in) picks primitives and levels; this
// table owns every number. Changing a number here rebalances every recipe
// ever discovered, because recipes store levels, not values.

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

  special('thorns', 'Attackers take {v} damage', [3, 6, 10, 16, 24], C, 'spikes, burrs, barbs'),
  special('nodeBurst', 'Breaking a node throws {v} shards', [3, 5, 7, 10, 14], DEAR, 'splinters, blasting, quarry work'),
  special('nodeHeal', 'Breaking a node heals {v} HP', [2, 4, 6, 9, 13], C, 'forage, sap, marrow'),
  special('richNodes', '{v}% chance a node gives double', [6, 12, 18, 26, 36], C, 'prospecting, careful work'),
  special('killScrip', '{v}% chance a kill drops double scrip', [5, 10, 16, 24, 34], C, 'bounties, ledgers, greed'),
  special('interest', '+{v}% of held scrip at wave end, up to 20', [2, 4, 6, 8, 11], C, 'lending, saving, strongboxes'),
  special('hoardTimber', '+{v}% Damage per 5 timber held', [1, 2, 3, 4, 6], C, 'wood, carrying timber'),
  special('hoardOre', '+1 Armor per {v} ore held', [14, 11, 9, 7, 5], C, 'ore, ballast, heavy pockets'),
  special('hoardHide', '+{v} Max HP per 5 hide held', [1, 2, 3, 4, 6], C, 'hides, layers, bundles'),
  special('lowHpRate', '+{v}% Rate below half health', [10, 18, 28, 40, 55], C, 'panic, spite, last efforts'),
  special('stillDamage', '+{v}% Damage while standing still', [8, 15, 24, 35, 48], C, 'bracing, stands, anchors'),
  special('movingDodge', '+{v}% Dodge while moving', [3, 6, 9, 12, 16], C, 'running, weaving'),
  special('waveShield', 'Start each wave with a {v} HP shield', [5, 10, 16, 24, 34], C, 'preparation, wards, wraps'),
  special('killBlast', 'Kills have a {v}% chance to burst', [6, 11, 17, 24, 33], DEAR, 'powder, gas, rot'),
  special('hurtBlast', 'When hurt, blast nearby enemies for {v}', [8, 15, 24, 36, 52], C, 'recoil, temper, springs'),
  special('pierce', 'Shots pierce 1 more at {v}% damage', [40, 55, 70, 85, 100], DEAR, 'needles, hard points'),
  special('bounce', 'Shots bounce 1 more at {v}% damage', [40, 55, 70, 85, 100], DEAR, 'rubber, springs, ricochet'),
  special('burn', 'Hits burn for {v} per second for 3 s', [1, 2, 3, 5, 7], DEAR, 'fire, pitch, embers'),
  special('knockback', '+{v} knockback', [4, 8, 12, 17, 23], CHEAP, 'weight, wedges, shoves'),
  special('rerollCut', 'Rerolls cost {v}% less', [10, 18, 26, 35, 45], MID, 'haggling, favours, lists'),
  special('eliteDamage', '+{v}% damage to elites and the boss', [10, 20, 32, 46, 64], MID, 'big game, traps, patience'),
  special('magnet', '+{v}% pickup range', [15, 30, 50, 75, 105], CHEAP, 'lodestones, nets, long arms'),
  special('xpGain', '+{v}% experience from scrip', [5, 10, 16, 23, 32], C, 'study, notes, practice'),
  special('secondWind', 'Once per wave, survive a killing blow with {v} HP', [1, 5, 10, 18, 30], [14, 18, 23, 29, 36], 'stubbornness, spare parts, luck'),
];

// Null prototype so keys like '__proto__' from untrusted input never resolve.
export const PRIM: Record<string, Primitive> = Object.assign(Object.create(null), Object.fromEntries(PRIMITIVES.map((p) => [p.id, p])));

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
export const FUSION_BONUS = 1.12;

/** Raw cost of a fusion made during a run, by output tier (index 1-4). */
export const FUSE_RAW_COST: readonly RawBag[] = [
  emptyRaws(),
  { timber: 2, ore: 1, hide: 1 },
  { timber: 3, ore: 2, hide: 2 },
  { timber: 5, ore: 4, hide: 3 },
  { timber: 8, ore: 6, hide: 5 },
];
