// The forge game's content: materials in two tiers, refining, stations, recipes, trophies, prices.
// First guesses, meant to be tuned by play. Nothing here reaches the real town.
import type { ItemSpec } from '../../shared/item.ts';

export const MATS = [
  'timber', 'ore', 'hide', 'agedwood', 'silver', 'thickhide',
  'planks', 'iron', 'leather', 'agedplanks', 'silveringot', 'thickleather',
] as const;
export type Mat = (typeof MATS)[number];
export type Bag = Partial<Record<Mat, number>>;
export const MAT_NAME: Record<Mat, string> = {
  timber: 'Timber', ore: 'Iron ore', hide: 'Hide', agedwood: 'Aged wood', silver: 'Silver ore', thickhide: 'Thick hide',
  planks: 'Planks', iron: 'Iron bar', leather: 'Leather', agedplanks: 'Aged planks', silveringot: 'Silver bar', thickleather: 'Thick leather',
};
/** 1: tier 1 raw, 2: tier 2 raw, 3: tier 1 refined, 4: tier 2 refined. */
export const MAT_KIND: Record<Mat, 1 | 2 | 3 | 4> = {
  timber: 1, ore: 1, hide: 1, agedwood: 2, silver: 2, thickhide: 2, planks: 3, iron: 3, leather: 3, agedplanks: 4, silveringot: 4, thickleather: 4,
};
/** Tier 2 raws in the sim's order (PK_T2 + i). */
export const T2_MATS: readonly Mat[] = ['agedwood', 'silver', 'thickhide'];
/** What the trader pays for one, and asks for a tier 1 raw. */
export const SELL: Record<1 | 2 | 3 | 4, number> = { 1: 1, 2: 5, 3: 4, 4: 18 };
export const BUY_RAW = 3;
export const SELL_PART = 12;

export type SkillId = 'smithing' | 'outfitting' | 'cooking';
export const SKILLS: readonly SkillId[] = ['smithing', 'outfitting', 'cooking'];
export const SKILL_NAME: Record<SkillId, string> = { smithing: 'Smithing', outfitting: 'Outfitting', cooking: 'Cooking' };
/** Experience from one level to the next. */
export const xpToNext = (level: number): number => 20 * level;
export function levelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1, left = xp;
  while (left >= xpToNext(level)) { left -= xpToNext(level); level++; }
  return { level, into: left, need: xpToNext(level) };
}
/** Skill level a tier 2 recipe asks for. */
export const T2_LEVEL = 3;

export type StationId = 'forge' | 'outfitter' | 'kitchen';
export interface StationDef { id: StationId; name: string; skill: SkillId; up: Bag; upCoin: number; what: string }
export const STATIONS: readonly StationDef[] = [
  { id: 'forge', name: 'Forge', skill: 'smithing', up: { iron: 8, planks: 6 }, upCoin: 40, what: 'Weapons and tools. Planks and bars.' },
  { id: 'outfitter', name: 'Outfitter', skill: 'outfitting', up: { leather: 6, planks: 4 }, upCoin: 30, what: 'Armour. Leather.' },
  { id: 'kitchen', name: 'Kitchen', skill: 'cooking', up: { planks: 4, leather: 4 }, upCoin: 20, what: 'Food for the next run.' },
];

export interface Refine { out: Mat; needs: Bag; station: StationId; tier: 1 | 2 }
export const REFINES: readonly Refine[] = [
  { out: 'planks', needs: { timber: 3 }, station: 'forge', tier: 1 },
  { out: 'iron', needs: { ore: 3 }, station: 'forge', tier: 1 },
  { out: 'agedplanks', needs: { planks: 2, agedwood: 3 }, station: 'forge', tier: 2 },
  { out: 'silveringot', needs: { iron: 2, silver: 3 }, station: 'forge', tier: 2 },
  { out: 'leather', needs: { hide: 3 }, station: 'outfitter', tier: 1 },
  { out: 'thickleather', needs: { leather: 2, thickhide: 3 }, station: 'outfitter', tier: 2 },
];

export type Makes =
  | { kind: 'weapon'; weapon: string }
  | { kind: 'armour'; item: ItemSpec }
  | { kind: 'food'; item: ItemSpec };
export interface Recipe {
  id: string; name: string; station: StationId; tier: 1 | 2; needs: Bag; fee: number; makes: Makes;
  /** True if it must be learned from a schematic. */
  schematic?: boolean;
}
const armour = (id: string, name: string, effects: ItemSpec['effects']): Makes => ({ kind: 'armour', item: { id, name, glyph: 'pelt', tags: ['armour'], effects } });
const food = (id: string, name: string, effects: ItemSpec['effects']): Makes => ({ kind: 'food', item: { id, name, glyph: 'bowl', tags: ['food'], effects } });
export const RECIPES: readonly Recipe[] = [
  { id: 'sling', name: 'Sling', station: 'forge', tier: 1, needs: { planks: 2, leather: 1 }, fee: 2, makes: { kind: 'weapon', weapon: 'sling' } },
  { id: 'hatchet', name: 'Hatchet', station: 'forge', tier: 1, needs: { planks: 2, iron: 2 }, fee: 2, makes: { kind: 'weapon', weapon: 'hatchet' } },
  { id: 'pick', name: 'Pick', station: 'forge', tier: 1, needs: { planks: 1, iron: 3 }, fee: 2, makes: { kind: 'weapon', weapon: 'pick' } },
  { id: 'knife', name: 'Skinning knife', station: 'forge', tier: 1, needs: { iron: 2, leather: 1 }, fee: 2, makes: { kind: 'weapon', weapon: 'knife' } },
  { id: 'bow', name: 'Bow', station: 'forge', tier: 1, needs: { planks: 4, leather: 2 }, fee: 3, makes: { kind: 'weapon', weapon: 'bow' }, schematic: true },
  { id: 'silverpick', name: 'Silver pick', station: 'forge', tier: 2, needs: { agedplanks: 1, silveringot: 3 }, fee: 8, makes: { kind: 'weapon', weapon: 'pick' }, schematic: true },
  { id: 'silversling', name: 'Silver sling', station: 'forge', tier: 2, needs: { agedplanks: 2, thickleather: 1, silveringot: 1 }, fee: 8, makes: { kind: 'weapon', weapon: 'sling' }, schematic: true },
  { id: 'silverhatchet', name: 'Silver hatchet', station: 'forge', tier: 2, needs: { agedplanks: 2, silveringot: 2 }, fee: 8, makes: { kind: 'weapon', weapon: 'hatchet' }, schematic: true },
  { id: 'silverknife', name: 'Silver knife', station: 'forge', tier: 2, needs: { silveringot: 2, thickleather: 1 }, fee: 8, makes: { kind: 'weapon', weapon: 'knife' }, schematic: true },
  { id: 'agedbow', name: 'Aged bow', station: 'forge', tier: 2, needs: { agedplanks: 4, thickleather: 2 }, fee: 10, makes: { kind: 'weapon', weapon: 'bow' }, schematic: true },
  { id: 'hidejerkin', name: 'Hide jerkin', station: 'outfitter', tier: 1, needs: { leather: 3 }, fee: 2, makes: armour('hidejerkin', 'Hide jerkin', [{ p: 'armor', l: 2 }, { p: 'maxHp', l: 2 }]) },
  { id: 'thickjerkin', name: 'Thick jerkin', station: 'outfitter', tier: 2, needs: { thickleather: 3, silveringot: 1 }, fee: 8, makes: armour('thickjerkin', 'Thick jerkin', [{ p: 'armor', l: 4 }, { p: 'maxHp', l: 3 }]), schematic: true },
  { id: 'stew', name: 'Stew', station: 'kitchen', tier: 1, needs: { hide: 2, timber: 1 }, fee: 1, makes: food('stew', 'Stew', [{ p: 'maxHp', l: 2 }, { p: 'mend', l: 2 }]) },
  { id: 'huntersstew', name: "Hunter's stew", station: 'kitchen', tier: 2, needs: { thickhide: 2, agedwood: 1 }, fee: 4, makes: food('huntersstew', "Hunter's stew", [{ p: 'luck', l: 3 }, { p: 'crit', l: 2 }]), schematic: true },
];
/** The order in which schematic drops teach: the first one not yet known. */
export const SCHEMATIC_ORDER: readonly string[] = ['silverpick', 'silversling', 'thickjerkin', 'bow', 'silverhatchet', 'huntersstew', 'silverknife', 'agedbow'];

/** Trophies for the house. Parts are indexes into the sim's PARTS. */
export interface Trophy { id: string; name: string; parts: Record<number, number>; needs: Bag; what: string; item?: ItemSpec; floor?: number }
export const TROPHIES: readonly Trophy[] = [
  { id: 'tuskmount', name: 'Tusk mount', parts: { 0: 2 }, needs: { planks: 3 }, what: 'Luck in every run: rarer drops.',
    item: { id: 'trophy:tuskmount', name: 'Tusk mount', glyph: 'bone', tags: ['trophy'], effects: [{ p: 'luck', l: 3 }] } },
  { id: 'antlerrack', name: 'Antler rack', parts: { 4: 1 }, needs: { agedplanks: 3 }, what: 'Every craft rolls 6 higher.', floor: 6 },
  { id: 'bearrug', name: 'Bear rug', parts: { 3: 1 }, needs: { thickleather: 2 }, what: 'Health and armour in every run.',
    item: { id: 'trophy:bearrug', name: 'Bear rug', glyph: 'pelt', tags: ['trophy'], effects: [{ p: 'maxHp', l: 2 }, { p: 'armor', l: 1 }] } },
  { id: 'heartmantel', name: 'Heartwood mantel', parts: { 5: 1 }, needs: { agedplanks: 2 }, what: 'Every craft rolls 4 higher.', floor: 4 },
];
export const RACK = 3;

/** Quality: the range a craft can land in, before it is made. */
export function qualityRange(skillLevel: number, stationTier: number, floor: number): [number, number] {
  const lo = Math.min(90, 45 + 4 * (skillLevel - 1) + 6 * (stationTier - 1) + floor);
  return [lo, Math.min(100, lo + 30)];
}
/** At or above this a craft is a masterwork: one more socket, and a name. */
export const MASTERWORK = 95;
export const weaponMul = (q: number): number => Math.round((0.85 + q * 0.003) * 1000) / 1000;
export const CHARGES = 5;
/** Coin from a run. */
export const runCoin = (scripHeld: number, waves: number): number => Math.floor(scripHeld / 4) + 2 * waves;
/** Share of materials home after a fall. Keys always come home. */
export const FALL_KEEP = 0.5;
/** What the first visit finds in the shed. */
export const START: Bag = { timber: 12, ore: 12, hide: 6 };
export const START_COIN = 20;
