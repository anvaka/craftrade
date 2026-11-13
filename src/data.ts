// All hand-authored content. Nothing here is generated at runtime.

export type Fam = 'blade' | 'bow' | 'hammer' | 'fire' | 'frost';
export type NodeKind = 'ore' | 'wood' | 'herb';
export type Ground = 'quarry' | 'grove' | 'marsh';
export type EnemyKind = 'swarm' | 'shield' | 'burrower' | 'spitter' | 'charger' | 'bomber' | 'brute' | 'boss';
export type Beat = 'lull' | 'swell' | 'peak';

// ------------------------------------------------------------------ modifiers
// Every item, brew, perk, kit and pick is a list of [key, amount]. Amounts add up,
// except dmgMul, which multiplies (the "multiplying effects" of the design).
export type ModKey =
  | 'dmg' | 'dmgMul' | 'atk' | 'speed' | 'hp' | 'regen' | 'stam' | 'armor' | 'magnet' | 'crit' | 'range' | 'cd'
  | 'burn' | 'chill' | 'chain' | 'pierce' | 'leech' | 'thorns'
  | 'heatCool' | 'heatGain' | 'yield' | 'weight' | 'heavyCost' | 'heavyDmg' | 'scrap' | 'drops' | 'noHeal'
  | 'detonate' | 'splinter' | 'stagger' | 'slip' | 'quick' | 'wind' | 'furnace' | 'ballast' | 'ward' | 'still';
export type Mod = [ModKey, number];
export type Mods = Record<ModKey, number>;

const MOD_KEYS: ModKey[] = [
  'dmg', 'dmgMul', 'atk', 'speed', 'hp', 'regen', 'stam', 'armor', 'magnet', 'crit', 'range', 'cd', 'burn', 'chill', 'chain',
  'pierce', 'leech', 'thorns', 'heatCool', 'heatGain', 'yield', 'weight', 'heavyCost', 'heavyDmg', 'scrap', 'drops', 'noHeal',
  'detonate', 'splinter', 'stagger', 'slip', 'quick', 'wind', 'furnace', 'ballast', 'ward', 'still',
];

export function emptyMods(): Mods {
  const m = {} as Mods;
  for (const k of MOD_KEYS) m[k] = 0;
  m.dmgMul = 1;
  return m;
}
export function addMods(m: Mods, list: Mod[], scale = 1): void {
  for (const [k, v] of list) {
    if (k === 'dmgMul') m.dmgMul *= 1 + v * scale;
    else if (k === 'noHeal' || k === 'ward') m[k] += v;
    else m[k] += v * scale;
  }
}

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const flat = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`;
const MOD_TEXT: Record<ModKey, (v: number) => string> = {
  dmg: (v) => `${pct(v)} damage`,
  dmgMul: (v) => `damage ×${(1 + v).toFixed(2)}`,
  atk: (v) => `${pct(v)} attack speed`,
  speed: (v) => `${pct(v)} move speed`,
  hp: (v) => `${flat(v)} max health`,
  regen: (v) => `${flat(v)} health per second`,
  stam: (v) => `${pct(v)} stamina regeneration`,
  armor: (v) => `${flat(v)} armour (3 blunts hits by about a quarter, 10 by half)`,
  magnet: (v) => `${flat(v)} pickup reach`,
  crit: (v) => `${pct(v)} chance of a double hit`,
  range: (v) => `${pct(v)} weapon range`,
  cd: (v) => `ability cooldown ${Math.round(Math.min(0.6, v) * 100)}% shorter (60% at most)`, // the caps named in these texts are the ones in game.ts
  burn: (v) => `hits ignite for ${flat(v).replace('+', '')} base damage a second`, // "base": multiplied by your damage bonuses
  chill: (v) => `hits slow enemies by ${Math.round(Math.min(0.6, v) * 100)}% (60% at most, 30% on bosses)`,
  chain: (v) => `hits arc to a second enemy for ${Math.round(v * 100)}% damage`,
  pierce: (v) => `arrows and frost shards pierce ${flat(v)} more`,
  leech: (v) => `kills heal ${flat(v).replace('+', '')}`,
  thorns: (v) => `enemies that touch you take ${Math.round(v)}`,
  heatCool: (v) => `heat cools ${pct(v)} faster`,
  heatGain: (v) => `${pct(v)} heat from strikes`,
  yield: (v) => `${pct(v)} material from nodes`,
  weight: (v) => `carried weight counts ${Math.round(v * 100)}% less`,
  heavyCost: (v) => (v > 0 ? `heavy swing costs ${Math.round(Math.min(0.7, v) * 100)}% less stamina (70% at most)` : `heavy swing costs ${Math.round(-v * 100)}% more stamina`),
  heavyDmg: (v) => `${pct(v)} heavy swing damage`,
  scrap: (v) => `${pct(v)} scrap from kills and objectives`,
  drops: (v) => `${pct(v)} drops from kills`,
  noHeal: () => `no healing of any kind, the rest after a wave included (only a level-up pick's 2 still heals)`,
  detonate: (v) => `node strikes explode for ${Math.round(v)} base damage`,
  splinter: (v) => `node strikes throw ${Math.round(v)} splinters`,
  stagger: (v) => `node strikes stun nearby enemies for ${v.toFixed(Math.round(v * 100) % 10 === 0 ? 1 : 2)}s`, // 0.75s is not shown as 0.8s
  slip: (v) => `dodging through an enemy deals ${Math.round(v)} base damage and returns stamina`,
  quick: (v) => `swapping ability makes the next one hit ${pct(v)} harder`,
  wind: (v) => `kills return ${flat(v).replace('+', '')} stamina`,
  furnace: (v) => `damage rises with heat, up to ${pct(v)} at full heat`,
  ballast: (v) => `damage rises with carried weight, ${pct(v)} per 100`,
  ward: () => `enemies near open nodes are slowed and burrowers are hurt`,
  still: (v) => `${pct(v)} damage while standing still`,
};
export function modText(list: Mod[], scale = 1): string {
  return list.map(([k, v]) => MOD_TEXT[k](k === 'noHeal' || k === 'ward' ? v : v * scale)).join(', ');
}

// ------------------------------------------------------------------ materials
export interface Mat {
  id: string;
  name: string;
  cat: 'ore' | 'wood' | 'herb' | 'creature' | 'part';
  tier: number;
  weight: number;
  color: string;
  fx?: AtomId[]; // four hidden reagent effects
}
export type AtomId =
  | 'burn' | 'chill' | 'chain' | 'leech' | 'haste' | 'magnet' | 'thorns' | 'might' | 'guard' | 'feather'
  | 'frenzy' | 'greed' | 'detonate' | 'slip' | 'quick';

const mat = (id: string, name: string, cat: Mat['cat'], tier: number, weight: number, color: string, fx?: AtomId[]): Mat => ({
  id, name, cat, tier, weight, color, fx,
});
export const MATS: Record<string, Mat> = Object.fromEntries(
  [
    mat('iron', 'Iron ore', 'ore', 1, 1, '#7f9db6', ['might', 'guard', 'thorns', 'detonate']),
    mat('skysteel', 'Skysteel ore', 'ore', 2, 1, '#6fd0e0', ['chain', 'guard', 'haste', 'quick']),
    mat('sunmetal', 'Sunmetal ore', 'ore', 3, 1, '#ffb347', ['might', 'burn', 'frenzy', 'detonate']),
    mat('greenwood', 'Greenwood', 'wood', 1, 0.8, '#7bb661', ['guard', 'thorns', 'feather', 'leech']),
    mat('oldwood', 'Oldwood', 'wood', 2, 0.8, '#a9825a', ['feather', 'magnet', 'chill', 'slip']),
    mat('heartwood', 'Heartwood', 'wood', 3, 0.8, '#d0605e', ['leech', 'might', 'greed', 'quick']),
    mat('reed', 'Marsh reed', 'herb', 1, 0.4, '#b8c95a', ['haste', 'feather', 'magnet', 'chill']),
    mat('silkweed', 'Silkweed', 'herb', 2, 0.4, '#e6d9f2', ['slip', 'haste', 'leech', 'greed']),
    mat('ghostbloom', 'Ghostbloom', 'herb', 3, 0.4, '#b18cff', ['chain', 'frenzy', 'quick', 'magnet']),
    mat('hide', 'Hide', 'creature', 1, 0.15, '#c29a6b', ['guard', 'feather', 'leech', 'slip']),
    mat('sinew', 'Sinew', 'creature', 1, 0.15, '#e8b7a0', ['haste', 'quick', 'might', 'chain']),
    mat('bonedust', 'Bone dust', 'creature', 1, 0.15, '#e6e2d3', ['thorns', 'detonate', 'chill', 'greed']),
    mat('ash', 'Ash', 'creature', 1, 0.15, '#8d8d8d', ['burn', 'frenzy', 'might', 'thorns']),
    mat('shard', 'Frost shard', 'creature', 1, 0.15, '#a6e3ff', ['chill', 'chain', 'magnet', 'burn']),
    mat('maw', 'Gravel-Maw tooth', 'part', 1, 2, '#e08a3c'),
    mat('plate', 'Thornback plate', 'part', 1, 2, '#8f6fd6'),
    mat('bile', 'Bile Queen sac', 'part', 1, 2, '#9bd64a'),
    mat('pelt', 'Ashfang pelt', 'part', 1, 2, '#e2504a'),
    mat('seal', "Foreman's seal", 'part', 1, 2, '#ffd34d'),
    mat('heart', 'Brood heart', 'part', 2, 2, '#ff7ab8'),
    mat('core', 'Kiln core', 'part', 3, 2, '#ff5a2a'),
  ].map((m) => [m.id, m]),
);
export const NODE_MAT: Record<NodeKind, string[]> = {
  ore: ['iron', 'skysteel', 'sunmetal'],
  wood: ['greenwood', 'oldwood', 'heartwood'],
  herb: ['reed', 'silkweed', 'ghostbloom'],
};
export const ELITE_PARTS = ['maw', 'plate', 'bile', 'pelt'];

// --------------------------------------------------------------------- atoms
// Effect atoms for alchemy. m is the strength of the form: flask 2 (one wave), charm 1, oil 0.6 (whole run).
export interface Atom {
  id: AtomId;
  name: string;
  mods: (m: number) => Mod[];
  volatile?: string; // the stated downside
}
export const ATOMS: Record<AtomId, Atom> = {
  burn: { id: 'burn', name: 'Burn', mods: (m) => [['burn', 4 * m]] },
  chill: { id: 'chill', name: 'Chill', mods: (m) => [['chill', 0.12 * m]] },
  chain: { id: 'chain', name: 'Chain', mods: (m) => [['chain', 0.2 * m]] },
  leech: { id: 'leech', name: 'Leech', mods: (m) => [['leech', 0.4 * m]] },
  haste: { id: 'haste', name: 'Haste', mods: (m) => [['speed', 0.07 * m], ['atk', 0.08 * m]] },
  magnet: { id: 'magnet', name: 'Magnet', mods: (m) => [['magnet', 70 * m]] },
  thorns: { id: 'thorns', name: 'Thorns', mods: (m) => [['thorns', 12 * m]] },
  might: { id: 'might', name: 'Might', mods: (m) => [['dmg', 0.12 * m]] },
  guard: { id: 'guard', name: 'Guard', mods: (m) => [['armor', 1.5 * m]] },
  feather: { id: 'feather', name: 'Feather', mods: (m) => [['weight', 0.2 * m]] },
  frenzy: { id: 'frenzy', name: 'Frenzy', mods: (m) => [['atk', 0.45 * m], ['noHeal', 1]], volatile: 'no healing while it lasts, the rest after the wave included' },
  greed: { id: 'greed', name: 'Greed', mods: (m) => [['yield', 0.4 * m], ['heatGain', 0.5]], volatile: 'strikes make half again as much heat' },
  detonate: { id: 'detonate', name: 'Detonate', mods: (m) => [['detonate', 28 * m]] },
  slip: { id: 'slip', name: 'Slipstream', mods: (m) => [['slip', 22 * m]] },
  quick: { id: 'quick', name: 'Quickdraw', mods: (m) => [['quick', 0.5 * m]] },
};
export type BrewForm = 'flask' | 'oil' | 'charm';
export const FORM: Record<BrewForm, { name: string; m: number; lasts: string; station: number }> = {
  flask: { name: 'Flask', m: 2, lasts: 'one wave, drunk at camp', station: 1 },
  oil: { name: 'Weapon oil', m: 0.6, lasts: 'the whole expedition', station: 2 },
  charm: { name: 'Charm', m: 1, lasts: 'one expedition, in a socket', station: 3 },
};
export interface Brew {
  form: BrewForm;
  atoms: AtomId[];
}
export const brewMods = (b: Brew): Mod[] => b.atoms.flatMap((a) => ATOMS[a].mods(FORM[b.form].m));
export const brewName = (b: Brew): string => `${b.atoms.map((a) => ATOMS[a].name).join(' + ')} ${FORM[b.form].name.toLowerCase()}`;
export const brewKey = (b: Brew): string => `${b.form}:${[...b.atoms].sort().join('+')}`;

// ------------------------------------------------------------------- weapons
export interface WeaponDef {
  fam: Fam;
  name: string;
  color: string;
  dmg: number;
  every: number;
  range: number;
  harvest: string; // what kills with this family leave behind
  ability: { name: string; cd: number; text: string };
  evolved: string;
  evolvedText: string;
  set: [number, Mod[], number, Mod[]]; // tier points needed, bonus, tier points, bonus (a tier III weapon counts three)
  text: string;
}
export const WEAPONS: Record<Fam, WeaponDef> = {
  blade: {
    fam: 'blade', name: 'Sword', color: '#d9dee6', dmg: 18, every: 0.7, range: 130, harvest: 'hide',
    ability: { name: 'Whirl', cd: 8, text: 'Spin: heavy damage to everything around you that is not behind a shield' },
    evolved: 'Stormblade', evolvedText: 'every sweep is a full circle with nearly twice the reach',
    set: [3, [['crit', 0.1]], 6, [['leech', 0.5]]],
    text: 'Sweeps an arc at close range. Kills leave hide.',
  },
  bow: {
    fam: 'bow', name: 'Bow', color: '#c9b27a', dmg: 12, every: 0.55, range: 380, harvest: 'sinew',
    ability: { name: 'Volley', cd: 8, text: 'A fan of seven piercing arrows where you aim' },
    evolved: 'Splitbow', evolvedText: 'arrows pierce two more and split in two on every hit',
    set: [3, [['range', 0.15]], 6, [['pierce', 1]]],
    text: 'Single arrows at long range. Kills leave sinew.',
  },
  hammer: {
    fam: 'hammer', name: 'Hammer', color: '#b08d6a', dmg: 26, every: 1.3, range: 135, harvest: 'bonedust',
    ability: { name: 'Quake', cd: 10, text: 'Stuns and damages everything around you; shields block it and bosses are not stunned' },
    evolved: 'Worldbreaker', evolvedText: 'each slam sends out a second, wider shockwave',
    set: [4, [['armor', 2]], 8, [['heavyDmg', 0.6]]],
    text: 'Slow slams that hit an area and knock back. Kills leave bone dust.',
  },
  fire: {
    fam: 'fire', name: 'Fire staff', color: '#ff8a3c', dmg: 12, every: 1.0, range: 320, harvest: 'ash',
    ability: { name: 'Meteor', cd: 10, text: 'A delayed blast where you aim that sets the ground alight' },
    evolved: 'Pyre staff', evolvedText: 'every fireball leaves burning ground',
    set: [4, [['burn', 3]], 8, [['dmg', 0.25]]],
    text: 'Fireballs that burst and ignite. Kills leave ash.',
  },
  frost: {
    fam: 'frost', name: 'Frost staff', color: '#8fd8ff', dmg: 8, every: 0.8, range: 280, harvest: 'shard',
    ability: { name: 'Nova', cd: 12, text: 'Freezes everything near you for two seconds; shields block it and bosses are only slowed' },
    evolved: 'Blizzard staff', evolvedText: 'a wide, constant aura chills and wears down everything near you',
    set: [3, [['chill', 0.1]], 6, [['cd', 0.2]]],
    text: 'Three shards in a fan that slow. Kills leave frost shards.',
  },
};
export const FAMS = Object.keys(WEAPONS) as Fam[];
export const TIER_MUL = [0, 1, 1.5, 2.2, 3.2];
export const WEAPON_PRICE = [0, 18, 36, 70, 130];
export const MAX_TIER = 4;
export const EVOLVE_TIER = 3;
export const EVOLVE_MUL = 2; // damage of an evolved weapon against its plain form

/** Perks on crafted, persistent weapons. They shape the kit; the run supplies the power. */
export const PERKS: Record<string, { name: string; mods: Mod[] }> = {
  keen: { name: 'Keen', mods: [['crit', 0.06]] },
  swift: { name: 'Swift', mods: [['atk', 0.06]] },
  reach: { name: 'Reach', mods: [['range', 0.1]] },
  focus: { name: 'Focus', mods: [['cd', 0.12]] },
  harvester: { name: 'Harvester', mods: [['drops', 0.25]] },
  siphon: { name: 'Siphon', mods: [['wind', 1.2]] },
  hauler: { name: 'Hauler', mods: [['weight', 0.08]] },
  temper: { name: 'Temper', mods: [['heavyCost', 0.1]] },
};

// ---------------------------------------------------------------- shop items
export interface Item {
  id: string;
  name: string;
  tier: number;
  mods: Mod[];
  heal?: number;
}
const item = (id: string, name: string, tier: number, mods: Mod[], heal?: number): Item => ({ id, name, tier, mods, heal });
export const ITEMS: Record<string, Item> = Object.fromEntries(
  [
    item('whetstone', 'Whetstone', 1, [['dmg', 0.08]]),
    item('boots', 'Light boots', 1, [['speed', 0.06]]),
    item('vest', 'Padded vest', 1, [['hp', 15]]),
    item('lungs', 'Iron lungs', 1, [['stam', 0.2]]),
    item('lodestone', 'Lodestone', 1, [['magnet', 50]]),
    item('bandolier', 'Bandolier', 1, [['atk', 0.1]]),
    item('coin', 'Lucky coin', 1, [['scrap', 0.15]]),
    item('rations', 'Field rations', 1, [], 35),
    item('plate', 'Heavy plate', 2, [['armor', 3], ['speed', -0.06]]),
    item('draught', "Berserker's draught", 2, [['dmg', 0.18], ['hp', -15]]),
    item('coolant', 'Coolant flask', 2, [['heatCool', 0.4]]),
    item('bellows', 'Bellows', 2, [['yield', 0.25], ['heatGain', 0.3]]),
    item('brace', "Miner's brace", 2, [['heavyCost', 0.2]]),
    item('spikes', 'Spiked shield', 2, [['thorns', 10], ['armor', 1]]),
    item('tar', 'Tar pot', 2, [['burn', 3]]),
    item('frostcore', 'Frost core', 2, [['chill', 0.1]]),
    item('conductor', 'Conductor', 2, [['chain', 0.2]]),
    item('fang', 'Leech fang', 2, [['leech', 0.3]]),
    item('quiver', 'Deep quiver', 2, [['pierce', 1]]),
    item('furnace', 'Furnace heart', 3, [['furnace', 0.5]]),
    item('ballast', 'Ballast harness', 3, [['ballast', 0.3]]),
    item('scope', 'Long scope', 3, [['range', 0.2], ['crit', 0.08]]),
    item('metronome', 'Metronome', 3, [['atk', 0.2], ['speed', -0.05]]),
    item('troll', 'Troll blood', 3, [['regen', 1.2]]),
  ].map((i) => [i.id, i]),
);
export const ITEM_PRICE = [0, 20, 42, 80];

/** The pool grows with town standing: these join the shop and the wild picks at the given standing level. */
export const POOL_UNLOCK: Record<string, number> = {
  quiver: 2, furnace: 2, conductor: 3, ballast: 3, fang: 4, scope: 4, metronome: 5, troll: 6,
  'wild:magpie': 3, 'wild:doubleedge': 5, 'wild:rooted': 7,
};
export const poolName = (key: string): string => (key.startsWith('wild:') ? `${WILDS.find((w) => `wild:${w.id}` === key)!.name} (wild pick)` : ITEMS[key].name);

/** Offered three at a time on every level-up. Half of them are about gathering, heat and weight. */
export interface LevelPick {
  id: string;
  name: string;
  mods: Mod[];
}
export const LEVEL_PICKS: LevelPick[] = [
  { id: 'edge', name: 'Edge', mods: [['dmg', 0.06]] },
  { id: 'tempo', name: 'Tempo', mods: [['atk', 0.06]] },
  { id: 'stride', name: 'Stride', mods: [['speed', 0.04]] },
  { id: 'vigor', name: 'Vigour', mods: [['hp', 10]] },
  { id: 'wind', name: 'Second wind', mods: [['stam', 0.12]] },
  { id: 'plating', name: 'Plating', mods: [['armor', 1]] },
  { id: 'eye', name: "Prospector's eye", mods: [['yield', 0.12]] },
  { id: 'cool', name: 'Cool head', mods: [['heatCool', 0.2]] },
  { id: 'lever', name: 'Leverage', mods: [['heavyCost', 0.08]] },
  { id: 'packer', name: 'Packer', mods: [['weight', 0.1]] },
  { id: 'brawn', name: 'Brawn', mods: [['heavyDmg', 0.25]] },
  { id: 'reach', name: 'Long arm', mods: [['range', 0.07]] },
  { id: 'drill', name: 'Drill', mods: [['cd', 0.08]] },
  { id: 'skinner', name: 'Skinner', mods: [['drops', 0.2]] },
  { id: 'scav', name: 'Scavenger', mods: [['scrap', 0.1]] },
  { id: 'pull', name: 'Pull', mods: [['magnet', 30]] },
];

// -------------------------------------------------------------- camp recipes
// Learned recipes. Only the eight in the loadout can be used in a run.
export interface Recipe {
  id: string;
  name: string;
  kind: 'variant' | 'evolution' | 'camp';
  fam?: Fam;
  cost?: { cat: Mat['cat'] | string; n: number }; // a material category or a specific id
  mods?: Mod[]; // camp crafts: applies to the next wave
  heal?: number;
  text: string;
}
const variant = (fam: Fam, name: string, matId: string, text: string): Recipe => ({
  id: `var-${fam}`, name, kind: 'variant', fam, cost: { cat: matId, n: 6 }, text,
});
const evo = (fam: Fam): Recipe => ({
  id: `evo-${fam}`, name: WEAPONS[fam].evolved, kind: 'evolution', fam,
  text: `At a boss chest, a tier ${EVOLVE_TIER}+ ${WEAPONS[fam].name.toLowerCase()} and the part of one named elite become the ${WEAPONS[fam].evolved}: ${WEAPONS[fam].evolvedText}. The recipe is not needed for a family you bring from town.`,
});
export const RECIPES: Record<string, Recipe> = Object.fromEntries(
  [
    variant('blade', 'Ember blade', 'wood', 'Sword + 6 wood for ember resin: its hits ignite.'),
    variant('bow', 'Sinew-strung bow', 'sinew', 'Bow + 6 sinew: arrows pierce two more.'),
    variant('hammer', 'Quake hammer', 'bonedust', 'Hammer + 6 bone dust: slams stun.'),
    variant('fire', 'Resin staff', 'wood', 'Fire staff + 6 wood: bursts are half again as wide.'),
    variant('frost', 'Shatter staff', 'shard', 'Frost staff + 6 shards: slowed enemies take 30% more from it.'),
    evo('blade'), evo('bow'), evo('hammer'), evo('fire'), evo('frost'),
    { id: 'mending', name: 'Mending tonic', kind: 'camp', cost: { cat: 'herb', n: 4 }, heal: 40, text: '4 herbs: heal 40 now.' },
    { id: 'stoneskin', name: 'Stoneskin plaster', kind: 'camp', cost: { cat: 'ore', n: 5 }, mods: [['armor', 4]], text: '5 ore: +4 armour next wave.' },
    { id: 'quicksilver', name: 'Quicksilver', kind: 'camp', cost: { cat: 'herb', n: 5 }, mods: [['speed', 0.14], ['atk', 0.16]], text: '5 herbs: faster feet and weapons next wave.' },
    { id: 'bloodrush', name: 'Blood rush', kind: 'camp', cost: { cat: 'creature', n: 5 }, mods: [['atk', 0.45], ['noHeal', 1]], text: '5 creature parts: +45% attack speed next wave. No healing in that wave or in the rest after it.' },
    { id: 'sharpen', name: 'Field sharpening', kind: 'camp', cost: { cat: 'ore', n: 5 }, mods: [['dmg', 0.15]], text: '5 ore: +15% damage next wave.' },
    { id: 'snare', name: 'Snare ring', kind: 'camp', cost: { cat: 'wood', n: 5 }, mods: [['ward', 1]], text: '5 wood: next wave, enemies near open nodes are slowed and burrowers are hurt.' },
  ].map((r) => [r.id, r as Recipe]),
);
export const STARTER_RECIPES = ['mending', 'sharpen', 'var-blade', 'snare'];

// ---------------------------------------------------------------- schematics
export type SchemSource = 'elite' | 'shrine' | 'boss1' | 'boss2' | 'boss3';
export interface Schematic {
  id: string;
  name: string;
  kind: 'recipe' | 'pattern' | 'blueprint';
  source: SchemSource;
  ref: string; // recipe id, pattern id or blueprint id
}
export const SOURCE_NAME: Record<SchemSource, string> = {
  elite: 'Named elites', shrine: 'Shrines', boss1: 'The Foreman', boss2: 'The Broodmother', boss3: 'The Kiln',
};
const sc = (kind: Schematic['kind'], source: SchemSource, ref: string, name: string): Schematic => ({ id: `${kind[0]}-${ref}`, name, kind, source, ref });
export const SCHEMATICS: Record<string, Schematic> = Object.fromEntries(
  [
    sc('recipe', 'elite', 'var-bow', 'Recipe: Sinew-strung bow'),
    sc('recipe', 'elite', 'var-hammer', 'Recipe: Quake hammer'),
    sc('recipe', 'elite', 'var-fire', 'Recipe: Resin staff'),
    sc('recipe', 'elite', 'var-frost', 'Recipe: Shatter staff'),
    sc('recipe', 'elite', 'stoneskin', 'Recipe: Stoneskin plaster'),
    sc('recipe', 'elite', 'quicksilver', 'Recipe: Quicksilver'),
    sc('pattern', 'elite', 'pick-maw', 'Pattern: Gravel-Maw pick'),
    sc('pattern', 'elite', 'bag-thorn', 'Pattern: Thornback satchel'),
    sc('recipe', 'shrine', 'bloodrush', 'Recipe: Blood rush'),
    sc('recipe', 'shrine', 'evo-frost', 'Recipe: Blizzard staff'),
    sc('pattern', 'shrine', 'wpn-bile', 'Pattern: Bilethrower'),
    sc('pattern', 'shrine', 'wpn-pelt', 'Pattern: Ashfang cleaver'),
    sc('blueprint', 'shrine', 'apothecary-3', 'Blueprint: Apothecary III'),
    sc('blueprint', 'shrine', 'apothecary-4', 'Blueprint: Apothecary IV'),
    sc('blueprint', 'shrine', 'apothecary-5', 'Blueprint: Apothecary V'),
    sc('recipe', 'boss1', 'evo-blade', 'Recipe: Stormblade'),
    sc('recipe', 'boss1', 'evo-bow', 'Recipe: Splitbow'),
    sc('blueprint', 'boss1', 'forge-3', 'Blueprint: Forge III'),
    sc('blueprint', 'boss1', 'workshop-3', 'Blueprint: Workshop III'),
    sc('pattern', 'boss1', 'wpn-seal', "Pattern: Foreman's maul"),
    sc('recipe', 'boss2', 'evo-hammer', 'Recipe: Worldbreaker'),
    sc('recipe', 'boss2', 'evo-fire', 'Recipe: Pyre staff'),
    sc('blueprint', 'boss2', 'forge-4', 'Blueprint: Forge IV'),
    sc('blueprint', 'boss2', 'workshop-4', 'Blueprint: Workshop IV'),
    sc('pattern', 'boss2', 'bag-brood', 'Pattern: Broodsilk pack'),
    sc('pattern', 'boss2', 'wpn-heart', 'Pattern: Heartstring bow'),
    sc('blueprint', 'boss3', 'forge-5', 'Blueprint: Forge V'),
    sc('blueprint', 'boss3', 'workshop-5', 'Blueprint: Workshop V'),
    sc('pattern', 'boss3', 'wpn-core', 'Pattern: Kilnfire staff'),
    sc('pattern', 'boss3', 'bag-kiln', 'Pattern: Kiln-forged frame'),
  ].map((s) => [s.id, s]),
);
export const CODEX_RANKS = [4, 10, 18, 26]; // learned schematics needed for each codex rank

// ------------------------------------------------------- persistent gear defs
export interface GearWeapon {
  kind: 'weapon';
  uid: number;
  fam: Fam;
  name: string;
  gs: number;
  perks: string[];
  named?: boolean;
  rolled?: string; // the perk the forge rolled at random (the others were chosen)
  grade?: number; // the grade it was forged at; older saves infer it from the gear score
  roll?: [number, number]; // the gear-score range it was rolled in, as it stood at the moment of the craft
  isNew?: boolean; // made or found since the player last looked at it
  locked?: boolean; // cannot be dismantled
}
export interface GearBag {
  kind: 'bag';
  uid: number;
  type: string;
  name: string;
  comfort: number; // weight carried before any slowing
  burden?: Mat['cat']; // this category weighs 40% less
  isNew?: boolean;
  locked?: boolean;
}
export interface GearTool {
  kind: 'tool';
  uid: number;
  node: NodeKind | 'knife';
  name: string;
  tier: number;
  isNew?: boolean;
  locked?: boolean;
}
export type Gear = GearWeapon | GearBag | GearTool;

export const TOOLS: Record<GearTool['node'], { name: string; mats: Mat['cat']; text: string; mods: (tier: number) => Mod[] }> = {
  ore: { name: 'Pickaxe', mats: 'ore', text: 'Each swing takes an extra bite out of an ore vein: a common vein falls in 2 swings instead of 3, a rich one in 2 instead of 4. A mining hit staggers enemies nearby.', mods: (t) => [['stagger', 0.5 + 0.25 * t]] },
  wood: { name: 'Felling axe', mats: 'wood', text: 'Each swing takes an extra bite out of a tree: a common tree falls in 2 swings instead of 3, a rich one in 2 instead of 4. A felling strike throws splinters.', mods: (t) => [['splinter', 4 + 2 * t]] },
  herb: { name: 'Sickle', mats: 'herb', text: 'Each swing takes an extra bite out of a reed bed: a common bed falls in 2 swings instead of 3, a rich one in 2 instead of 4. Strikes on nodes explode in a small burst.', mods: (t) => [['detonate', 10 + 8 * t]] },
  knife: { name: 'Skinning knife', mats: 'creature', text: 'Kills leave more, and skinning restores stamina.', mods: (t) => [['drops', 0.2 + 0.15 * t], ['wind', 0.6 + 0.4 * t]] },
};

export const BAG_TYPES: Record<string, { name: string; comfort: number; station: number; cost: Record<string, number> }> = {
  sack: { name: 'Rough sack', comfort: 40, station: 1, cost: { hide: 8, reed: 6 } },
  pack: { name: "Traveller's pack", comfort: 65, station: 3, cost: { hide: 20, silkweed: 14, oldwood: 8 } },
  frame: { name: 'Expedition frame', comfort: 95, station: 5, cost: { hide: 30, ghostbloom: 16, heartwood: 12, skysteel: 10 } },
};

/** One-use patterns: named items with a fixed, special property. */
export interface Pattern {
  id: string;
  name: string;
  station: 'forge' | 'workshop';
  cost: Record<string, number>;
  make: (uid: number, gs: number) => Gear;
  text: string;
}
export const PATTERNS: Record<string, Pattern> = {
  'pick-maw': {
    id: 'pick-maw', name: 'Gravel-Maw pick', station: 'forge', cost: { maw: 1, iron: 20, greenwood: 10 },
    make: (uid) => ({ kind: 'tool', uid, node: 'ore', name: 'Gravel-Maw pick', tier: 3 }),
    text: 'A pickaxe of the top grade, whatever your forge.',
  },
  'bag-thorn': {
    id: 'bag-thorn', name: 'Thornback satchel', station: 'workshop', cost: { plate: 1, hide: 16, reed: 10 },
    make: (uid) => ({ kind: 'bag', uid, type: 'named', name: 'Thornback satchel', comfort: 60, burden: 'ore' }),
    text: 'Comfort 60, and ore weighs 40% less in it.',
  },
  'wpn-bile': {
    id: 'wpn-bile', name: 'Bilethrower', station: 'forge', cost: { bile: 1, skysteel: 14, oldwood: 10 },
    make: (uid, gs) => ({ kind: 'weapon', uid, fam: 'fire', name: 'Bilethrower', gs, perks: ['harvester', 'reach', 'swift'], named: true }),
    text: 'A fire staff with Harvester, Reach and Swift.',
  },
  'wpn-pelt': {
    id: 'wpn-pelt', name: 'Ashfang cleaver', station: 'forge', cost: { pelt: 1, iron: 18, hide: 10 },
    make: (uid, gs) => ({ kind: 'weapon', uid, fam: 'blade', name: 'Ashfang cleaver', gs, perks: ['keen', 'siphon', 'swift'], named: true }),
    text: 'A sword with Keen, Siphon and Swift.',
  },
  'wpn-seal': {
    id: 'wpn-seal', name: "Foreman's maul", station: 'forge', cost: { seal: 1, iron: 24, greenwood: 12 },
    make: (uid, gs) => ({ kind: 'weapon', uid, fam: 'hammer', name: "Foreman's maul", gs, perks: ['temper', 'focus', 'hauler'], named: true }),
    text: 'A hammer with Temper, Focus and Hauler.',
  },
  'bag-brood': {
    id: 'bag-brood', name: 'Broodsilk pack', station: 'workshop', cost: { heart: 1, silkweed: 20, hide: 20 },
    make: (uid) => ({ kind: 'bag', uid, type: 'named', name: 'Broodsilk pack', comfort: 85, burden: 'herb' }),
    text: 'Comfort 85, and herbs weigh 40% less in it.',
  },
  'wpn-heart': {
    id: 'wpn-heart', name: 'Heartstring bow', station: 'forge', cost: { heart: 1, oldwood: 18, sinew: 12 },
    make: (uid, gs) => ({ kind: 'weapon', uid, fam: 'bow', name: 'Heartstring bow', gs, perks: ['swift', 'reach', 'keen'], named: true }),
    text: 'A bow with Swift, Reach and Keen.',
  },
  'wpn-core': {
    id: 'wpn-core', name: 'Kilnfire staff', station: 'forge', cost: { core: 1, sunmetal: 16, heartwood: 12 },
    make: (uid, gs) => ({ kind: 'weapon', uid, fam: 'frost', name: 'Kilnfire staff', gs, perks: ['focus', 'keen', 'reach'], named: true }),
    text: 'A frost staff with Focus, Keen and Reach.',
  },
  'bag-kiln': {
    id: 'bag-kiln', name: 'Kiln-forged frame', station: 'workshop', cost: { core: 1, sunmetal: 14, hide: 30 },
    make: (uid) => ({ kind: 'bag', uid, type: 'named', name: 'Kiln-forged frame', comfort: 115, burden: 'wood' }),
    text: 'Comfort 115, and wood weighs 40% less in it.',
  },
};

// -------------------------------------------------------------------- town
export type StationId = 'forge' | 'workshop' | 'apothecary';
export const STATIONS: Record<StationId, { name: string; text: string; tiers: string[] }> = {
  forge: {
    name: 'Forge', text: 'Weapons and tools.',
    tiers: ['Iron-grade weapons and tools', 'Named patterns; fees fall 10%', 'Skysteel-grade gear', 'Fees fall another 10%', 'Sunmetal-grade gear'],
  },
  workshop: {
    name: 'Workshop', text: 'Bags.',
    tiers: ['Rough sack', 'Named bag patterns', "Traveller's pack", 'Choose which material a bag lightens', 'Expedition frame'],
  },
  apothecary: {
    name: 'Apothecary', text: 'Flasks, oils and charms from reagents.',
    tiers: ['Flasks', 'Weapon oils', 'Charms', 'Each brew makes two', 'Each brew makes three'],
  },
};
/** Material cost to raise a station to tiers 3..5. These also need the blueprint. */
export const STATION_COST: Record<number, Record<string, number>> = {
  3: { iron: 90, skysteel: 60, oldwood: 50, hide: 40 },
  4: { skysteel: 120, oldwood: 90, silkweed: 70, sinew: 40 },
  5: { sunmetal: 110, heartwood: 90, ghostbloom: 70, skysteel: 90 },
};
/** Tier 2 asks for one material, so a first expedition on the matching ground can pay for it. */
export const STATION_T2: Record<StationId, Record<string, number>> = {
  forge: { iron: 40 },
  workshop: { greenwood: 40 },
  apothecary: { reed: 40 },
};

export const SKILLS = ['mining', 'logging', 'harvesting', 'skinning', 'smithing', 'outfitting', 'alchemy'] as const;
export type Skill = (typeof SKILLS)[number];
export const SKILL_CAP = 20;
export const FAM_CAP = 10;
export const skillXpFor = (lvl: number) => 40 + lvl * 30;

export interface Card {
  id: string;
  name: string;
  text: string;
  max: number;
}
export const CARDS: Card[] = [
  { id: 'fees', name: 'Guild rates', text: 'Crafting fees fall by 15%.', max: 3 },
  { id: 'swing', name: 'Practised hands', text: 'The heavy swing winds up 6% faster.', max: 3 },
  { id: 'reroll', name: 'Friend of the quartermaster', text: 'One free shop reroll at every camp.', max: 2 },
  { id: 'keep', name: 'Stitched lining', text: 'Keep 8% more of the bag when you fall.', max: 3 },
  { id: 'scrap', name: 'Seed money', text: 'Start each expedition with 15 more scrap.', max: 3 },
  { id: 'belt', name: 'Flask belt', text: 'Carry one more flask.', max: 2 },
  { id: 'recipes', name: 'Thicker notebook', text: 'One more recipe in the loadout.', max: 2 },
  { id: 'vault', name: 'Vault key', text: 'The weekly vault offers one more choice per row.', max: 1 },
];

// -------------------------------------------------------------------- kits
export interface Kit {
  id: string;
  name: string;
  text: string;
  rank: number; // mastery rank needed
  mods: Mod[];
  noDodge?: boolean;
  strike?: number; // extra strike power on every node
  slots?: number;
  crafts?: number; // camp crafts per camp
  heatHolds?: boolean;
}
export const KITS: Kit[] = [
  { id: 'wayfarer', name: 'Wayfarer', text: 'No twist. Six weapon slots, one camp craft.', rank: 0, mods: [] },
  { id: 'prospector', name: 'Prospector', text: 'Cannot dodge. Every node takes fewer swings and yields 30% more.', rank: 1, mods: [['yield', 0.3]], noDodge: true, strike: 1 },
  { id: 'duelist', name: 'Duelist', text: 'Two weapon slots. You deal 90% more damage.', rank: 2, mods: [['dmg', 0.9]], slots: 2 },
  { id: 'tinker', name: 'Tinker', text: 'Half the scrap from kills and objectives (a boss chest still holds 40). Two camp crafts at every camp, each for half the materials, rounded up.', rank: 3, mods: [['scrap', -0.5]], crafts: 2 },
  { id: 'firebrand', name: 'Firebrand', text: 'Heat never cools during a wave. Damage rises with heat, up to +80%.', rank: 4, mods: [['furnace', 0.8]], heatHolds: true },
  { id: 'mule', name: 'Pack mule', text: 'Carried weight counts half. You deal 10% less damage.', rank: 5, mods: [['weight', 0.5], ['dmg', -0.1]] },
];

// ------------------------------------------------------------- wild picks
export interface Wild {
  id: string;
  name: string;
  text: string;
  mods: Mod[];
}
export const WILDS: Wild[] = [
  { id: 'slot', name: 'Seventh hand', text: 'One more weapon slot. Every weapon you carry costs you 2% damage.', mods: [] },
  { id: 'veins', name: 'Open veins', text: 'Rich veins stay open through the peak. Strikes make 30% more heat.', mods: [['heatGain', 0.3]] },
  { id: 'freedodge', name: 'Light feet', text: 'Dodging costs half the stamina. The heavy swing costs 30% more.', mods: [['heavyCost', -0.3]] },
  { id: 'haggler', name: 'Haggler', text: 'Shop prices fall 30%, and a weapon you sell pays 30% less. No rest heal after a wave, and the shop sells no healing.', mods: [] },
  { id: 'stoneback', name: 'Stone back', text: 'Weight never slows you. Maximum health falls by 30.', mods: [['hp', -30]] },
  { id: 'rooted', name: 'Rooted', text: '+60% damage while standing still. 12% slower on your feet.', mods: [['still', 0.6], ['speed', -0.12]] },
  { id: 'glass', name: 'Glass edge', text: '+40% damage of every kind. Maximum health falls by 30.', mods: [['dmg', 0.4], ['hp', -30]] },
  { id: 'doubleedge', name: 'Sledge', text: 'The heavy swing hits three times as hard. Stamina returns 30% slower.', mods: [['heavyDmg', 2], ['stam', -0.3]] },
  { id: 'magpie', name: 'Magpie', text: '+60% scrap from kills and objectives. Kills leave no creature materials (named parts still drop).', mods: [['scrap', 0.6], ['drops', -10]] },
];

export const CURSES: Record<string, { name: string; text: string }> = {
  frail: { name: 'Frail', text: 'maximum health is cut by a quarter' },
  bound: { name: 'Bound', text: 'your last weapon is sealed and does not fire' },
  barren: { name: 'Barren', text: 'no camp craft' },
};

// --------------------------------------------------------------- mutators
export const MUTATORS: Record<string, { name: string; text: string }> = {
  volatile: { name: 'Volatile dead', text: 'Enemies burst a moment after they die.' },
  loud: { name: 'Loud ore', text: 'Strikes make 50% more heat and nodes yield 25% more.' },
  thick: { name: 'Thick hides', text: 'Enemies have 30% more health and leave 30% more behind.' },
  dryshop: { name: 'Dry shop', text: 'The shop sells no healing.' },
  eliteveins: { name: 'Guarded veins', text: 'Breaking a rich vein wakes a brute.' },
  longswell: { name: 'Long swell', text: 'The swell lasts longer and the lull is shorter.' },
};
export function weekNumber(now = Date.now()): number {
  return Math.floor((now / 86400000 + 3) / 7); // weeks since the epoch, turning over on Monday
}
export function weekMutators(week: number): string[] {
  const ids = Object.keys(MUTATORS);
  const a = week % ids.length;
  const b = (a + 1 + ((week * 7) % (ids.length - 1))) % ids.length;
  return [ids[a], ids[b]];
}

// ------------------------------------------------------------- grounds etc.
export const GROUNDS: Record<Ground, { name: string; node: NodeKind; floor: string; lean: EnemyKind; text: string }> = {
  quarry: { name: 'Quarry', node: 'ore', floor: '#5d5754', lean: 'shield', text: 'Ore veins. From wave 2 on, shield-bearers hold this ground: bring stamina for heavy swings.' },
  grove: { name: 'Grove', node: 'wood', floor: '#604e3b', lean: 'swarm', text: 'Trees. Swarms pour through the trunks: area damage pays.' },
  marsh: { name: 'Marsh', node: 'herb', floor: '#424b37', lean: 'spitter', text: 'Reeds. From wave 3 on, spitters keep their distance: reach or speed pays.' },
};
export const GROUND_IDS = Object.keys(GROUNDS) as Ground[];

export type Objective = 'none' | 'supply' | 'nests' | 'elite';
export const OBJECTIVES: Record<Objective, { name: string; text: string }> = {
  none: { name: 'Survive', text: '' },
  supply: { name: 'Supply drop', text: 'Stand in the marked circle for 10 seconds: scrap and a heal.' },
  nests: { name: 'Nests', text: 'Break three nests with the heavy swing before the peak, or each hatches a brute.' },
  elite: { name: 'Named elite', text: 'A named elite arrives in the swell. It carries a part and may carry a schematic.' },
};

export interface EliteDef {
  id: string;
  name: string;
  base: EnemyKind;
  part: string;
  ground: Ground;
}
export const ELITES: EliteDef[] = [
  { id: 'maw', name: 'Gravel-Maw', base: 'burrower', part: 'maw', ground: 'quarry' },
  { id: 'thornback', name: 'Old Thornback', base: 'shield', part: 'plate', ground: 'grove' },
  { id: 'queen', name: 'The Bile Queen', base: 'spitter', part: 'bile', ground: 'marsh' },
  { id: 'ashfang', name: 'Ashfang', base: 'swarm', part: 'pelt', ground: 'quarry' },
];

export interface BossDef {
  name: string;
  part: string;
  source: SchemSource;
  hp: number;
  speed: number;
  color: string;
  chargeEvery: number;
  radialEvery: number;
  radialN: number;
  spreadEvery: number;
  summonEvery: number;
  summon: EnemyKind;
  armorAt: number[]; // health fractions at which it armours up; a heavy swing breaks it
}
export const BOSSES: BossDef[] = [
  { name: 'The Foreman', part: 'seal', source: 'boss1', hp: 650, speed: 70, color: '#ffd34d', chargeEvery: 5, radialEvery: 0, radialN: 0, spreadEvery: 0, summonEvery: 9, summon: 'shield', armorAt: [1, 0.5] },
  { name: 'The Broodmother', part: 'heart', source: 'boss2', hp: 1500, speed: 52, color: '#ff7ab8', chargeEvery: 0, radialEvery: 4, radialN: 10, spreadEvery: 0, summonEvery: 6, summon: 'burrower', armorAt: [1, 0.6, 0.3] },
  { name: 'The Kiln', part: 'core', source: 'boss3', hp: 2800, speed: 60, color: '#ff5a2a', chargeEvery: 7, radialEvery: 6, radialN: 16, spreadEvery: 2.6, summonEvery: 9, summon: 'swarm', armorAt: [1, 0.66, 0.33] },
];

// ------------------------------------------------------------------ tuning
export const CFG = {
  arena: { w: 1500, h: 950 },
  wavesPerSegment: 4,
  segments: 3,
  waveDur: [40, 45, 50, 60, 50, 55, 60, 70, 55, 60, 65, 80], // index 3, 7, 11 are boss waves
  beats: { lull: 0.3, swell: 0.48 },
  healBetweenWaves: 12,
  keptOnDeath: 0.2,

  player: {
    r: 14, speed: 235, hp: 100, hurtInvuln: 0.25,
    stamina: 100, staminaRegen: 24, staminaDelay: 0.7,
    dodgeCost: 28, dodgeTime: 0.2, dodgeSpeed: 640, dodgeIframes: 0.3, dodgeEvery: 0.55,
    heavyCost: 34, chargeTime: 0.5, chargeMoveMul: 0.55, heavyRange: 100, heavyArc: 1.15, heavyDmg: 40, heavyKnock: 320,
    magnet: 95,
    slowPerWeight: 0.0018, // speed and stamina regeneration lost per unit of weight over the bag's comfort
    slowMax: 0.45,
  },

  // Heat brings enemies on a curve (a little heat is cheap, a lot is not) and raises what a strike yields.
  heat: { common: 9, rich: 22, max: 100, coolDelay: 3, coolRate: 4, spawnBonus: 2.6, curve: 1.6, yieldBonus: 0.6, hotPay: 0.3 },
  // drops[i] is what strike i releases. The right tool takes one more stage per swing: 3 swings become 2 on a common node, 4 become 2 on a rich one.
  nodes: { common: { count: 6, drops: [1, 1, 2], r: 22 }, rich: { count: 3, drops: [2, 3, 4, 6], r: 28 } },

  spawn: {
    rate: { lull: 0.5, swell: 1.3, peak: 2.4 },
    waveMul: [1.1, 1.3, 1.5, 0.9, 1.8, 2.0, 2.2, 1.2, 2.5, 2.8, 3.1, 1.6],
    hpMul: [1, 1, 1.1, 1.2, 1.5, 1.7, 1.9, 2.1, 2.6, 2.9, 3.2, 3.5],
    cap: 90,
    cost: { swarm: 4, shield: 4, burrower: 3, spitter: 3, charger: 4, bomber: 3, brute: 8, boss: 0 } as Record<EnemyKind, number>,
  },

  enemies: {
    swarm: { r: 9, hp: 18, speed: 150, dmg: 5, hitEvery: 0.6, scrap: 1, xp: 1, drop: 0.1, color: '#a44c68' },
    shield: { r: 20, hp: 70, speed: 78, dmg: 12, hitEvery: 0.9, scrap: 4, xp: 4, drop: 0.4, color: '#75506f' },
    burrower: { r: 15, hp: 30, speed: 115, dmg: 10, hitEvery: 0.8, scrap: 3, xp: 3, drop: 0.35, color: '#cf97a4' },
    spitter: { r: 13, hp: 26, speed: 85, dmg: 9, hitEvery: 1, scrap: 3, xp: 3, drop: 0.35, color: '#e58fb8' },
    charger: { r: 16, hp: 50, speed: 70, dmg: 15, hitEvery: 0.8, scrap: 4, xp: 4, drop: 0.4, color: '#4a424c' },
    bomber: { r: 14, hp: 36, speed: 112, dmg: 18, hitEvery: 1, scrap: 3, xp: 3, drop: 0.35, color: '#ff9cc4' },
    brute: { r: 26, hp: 160, speed: 95, dmg: 16, hitEvery: 0.9, scrap: 10, xp: 10, drop: 1, color: '#8a3d58' },
    boss: { r: 44, hp: 1, speed: 60, dmg: 20, hitEvery: 0.8, scrap: 60, xp: 60, drop: 0, color: '#fff' },
  } as Record<EnemyKind, { r: number; hp: number; speed: number; dmg: number; hitEvery: number; scrap: number; xp: number; drop: number; color: string }>,
  burrower: { speedUnder: 170, emergeTime: 0.7, biteEvery: 1.3, huntTime: 5 },
  spitter: { keep: 300, every: 2.3, shotSpeed: 250 },

  // danger level of the key: each level above 1 adds this much
  key: { hp: 0.14, dmg: 0.07, rate: 0.05, yield: 0.06 },
};
