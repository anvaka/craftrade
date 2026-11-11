// Weapon table. Edit numbers here to tune; the sim reads nothing else.
import type { RawBag, StatId } from '../../shared/vocab.ts';

export type WeaponClass = 'edge' | 'blunt' | 'shot' | 'tool';
export type WeaponKind = 'sweep' | 'thrust' | 'shot';
export type NodeType = 'tree' | 'seam' | 'carcass';
type T4 = readonly [number, number, number, number];

export interface WeaponDef {
  id: string;
  name: string;
  classes: readonly WeaponClass[];
  kind: WeaponKind;
  /** Base damage at tiers 1-4. */
  dmg: T4;
  /** Seconds between attacks at tiers 1-4. */
  cd: T4;
  /** Reach of a melee shape, or how far a shot looks for a target. */
  range: number;
  /** Sweep: full arc in degrees. Thrust: width in px. */
  width: number;
  /** Flat damage added per point of each stat. */
  scale: Partial<Record<StatId, number>>;
  /** Extra crit chance in percent. */
  crit: number;
  knock: number;
  pierce: number;
  bounce: number;
  /** Burn per second at tiers 1-4. */
  burn?: T4;
  /** Slow fraction at tiers 1-4, for 2 s. */
  slow?: T4;
  /** Shot speed in px/s. */
  shotSpeed?: number;
  /** Stat granted while held, by tier. */
  passive?: { stat: StatId; v: T4 };
  /** Node this tool works at double rate. */
  tool?: NodeType;
  /** Melee gets half of Reach unless this is set. */
  fullReach?: boolean;
  /** Base scrip price at tiers 1-4. */
  price: T4;
  /** Raws per tier: a tier 3 costs three times this. */
  raws: Partial<RawBag>;
  /** Tier 1 costs scrip only, so a player with empty pockets can still buy a first tool. Higher tiers cost raws x (tier - 1). */
  plainAtOne?: boolean;
  /** Tooltip note. */
  note: string;
}

export const WEAPONS: readonly WeaponDef[] = [
  { id: 'hatchet', name: 'Hatchet', classes: ['edge', 'tool'], kind: 'sweep', dmg: [4, 7, 10, 15], cd: [0.95, 0.9, 0.84, 0.78],
    range: 96, width: 110, scale: { melee: 0.8, harvest: 0.15 }, crit: 3, knock: 6, pierce: 0, bounce: 0, tool: 'tree',
    price: [12, 24, 46, 90], plainAtOne: true, raws: { ore: 1 }, note: 'Sweep. Works trees at double rate. Scales with Harvest.' },
  { id: 'pick', name: 'Pick', classes: ['blunt', 'tool'], kind: 'thrust', dmg: [6, 9, 14, 20], cd: [1.15, 1.08, 1.0, 0.92],
    range: 108, width: 38, scale: { melee: 0.9, harvest: 0.2 }, crit: 0, knock: 9, pierce: 0, bounce: 0, tool: 'seam',
    price: [12, 24, 46, 90], plainAtOne: true, raws: { timber: 1 }, note: 'Thrust. Works seams at double rate. Scales with Harvest.' },
  { id: 'knife', name: 'Skinning knife', classes: ['edge', 'tool'], kind: 'thrust', dmg: [3, 5, 7, 10], cd: [0.5, 0.46, 0.42, 0.38],
    range: 78, width: 30, scale: { melee: 0.5, harvest: 0.1 }, crit: 20, knock: 2, pierce: 0, bounce: 0, tool: 'carcass',
    price: [12, 24, 46, 90], plainAtOne: true, raws: { ore: 1 }, note: 'Fast stab, high crit. Works carcasses at double rate. Scales with Harvest.' },
  { id: 'maul', name: 'Maul', classes: ['blunt'], kind: 'sweep', dmg: [10, 15, 22, 33], cd: [1.6, 1.5, 1.4, 1.3],
    range: 112, width: 170, scale: { melee: 1.0, maxHp: 0.3 }, crit: 0, knock: 24, pierce: 0, bounce: 0,
    price: [18, 36, 70, 135], raws: { timber: 1, ore: 1 }, note: 'Slow, wide, heavy knockback. Scales with Max HP.' },
  { id: 'pike', name: 'Pike', classes: ['edge'], kind: 'thrust', dmg: [6, 9, 13, 19], cd: [1.3, 1.22, 1.14, 1.05],
    range: 172, width: 30, scale: { melee: 0.8, reach: 0.06 }, crit: 5, knock: 7, pierce: 0, bounce: 0, fullReach: true,
    price: [16, 32, 62, 120], raws: { timber: 2 }, note: 'Long thrust. Scales with Reach.' },
  { id: 'sling', name: 'Sling', classes: ['shot'], kind: 'shot', dmg: [4, 6, 9, 13], cd: [0.6, 0.55, 0.5, 0.46],
    range: 330, width: 0, scale: { ranged: 0.9 }, crit: 3, knock: 2, pierce: 0, bounce: 0, shotSpeed: 560,
    price: [9, 18, 35, 68], plainAtOne: true, raws: { hide: 1 }, note: 'Cheap, fast, weak.' },
  { id: 'bow', name: 'Bow', classes: ['shot'], kind: 'shot', dmg: [8, 12, 17, 25], cd: [0.88, 0.83, 0.78, 0.72],
    range: 420, width: 0, scale: { ranged: 1.3 }, crit: 5, knock: 3, pierce: 1, bounce: 0, shotSpeed: 680,
    price: [15, 30, 58, 112], raws: { timber: 2 }, note: 'Pierces 1.' },
  { id: 'musket', name: 'Musket', classes: ['shot'], kind: 'shot', dmg: [20, 30, 45, 66], cd: [2.0, 1.9, 1.78, 1.65],
    range: 520, width: 0, scale: { ranged: 2.4 }, crit: 5, knock: 10, pierce: 2, bounce: 0, shotSpeed: 900,
    price: [20, 40, 78, 150], raws: { timber: 1, ore: 2 }, note: 'Slow, heavy, pierces 2.' },
  { id: 'axe', name: 'Throwing axe', classes: ['edge', 'shot'], kind: 'shot', dmg: [8, 12, 17, 25], cd: [1.1, 1.04, 0.97, 0.9],
    range: 300, width: 0, scale: { melee: 0.6, ranged: 0.6 }, crit: 5, knock: 5, pierce: 0, bounce: 2, shotSpeed: 440,
    price: [16, 32, 62, 120], raws: { timber: 1, ore: 1 }, note: 'Bounces 2. Scales with Melee and Ranged.' },
  { id: 'brand', name: 'Firebrand', classes: ['blunt'], kind: 'sweep', dmg: [5, 8, 11, 16], cd: [1.0, 0.95, 0.9, 0.84],
    range: 104, width: 150, scale: { melee: 0.5 }, crit: 0, knock: 4, pierce: 0, bounce: 0, burn: [3, 5, 8, 12],
    price: [15, 30, 58, 112], raws: { timber: 2 }, note: 'Wide sweep that sets burn. Burn grows with Damage.' },
  { id: 'bola', name: 'Bola', classes: ['shot'], kind: 'shot', dmg: [4, 6, 8, 11], cd: [0.8, 0.76, 0.72, 0.66],
    range: 360, width: 0, scale: { ranged: 0.6 }, crit: 0, knock: 0, pierce: 1, bounce: 0, slow: [0.4, 0.46, 0.52, 0.6], shotSpeed: 480,
    price: [11, 22, 42, 82], raws: { hide: 2 }, note: 'Slows, pierces 1. A slowed enemy takes 25% more damage from everything.' },
  { id: 'buckler', name: 'Buckler', classes: ['blunt'], kind: 'thrust', dmg: [4, 7, 10, 15], cd: [0.85, 0.8, 0.75, 0.7],
    range: 72, width: 56, scale: { melee: 0.5, armor: 1.5, maxHp: 0.1 }, crit: 0, knock: 16, pierce: 0, bounce: 0,
    passive: { stat: 'armor', v: [1, 2, 3, 4] },
    price: [15, 30, 58, 112], raws: { ore: 1, hide: 1 }, note: 'Short bash. Gives Armor. Scales with Armor and Max HP.' },
];

export const WEAPON_INDEX: Record<string, number> = Object.fromEntries(WEAPONS.map((w, i) => [w.id, i]));

/** Set bonuses at 2 / 4 / 6 weapons of a class held. */
export const SET_BONUS: Record<WeaponClass, { stat: StatId; v: readonly [number, number, number] }[]> = {
  edge: [{ stat: 'crit', v: [3, 7, 12] }, { stat: 'melee', v: [0, 1, 3] }],
  blunt: [{ stat: 'maxHp', v: [3, 8, 15] }, { stat: 'armor', v: [1, 2, 4] }],
  shot: [{ stat: 'reach', v: [15, 35, 60] }, { stat: 'ranged', v: [0, 1, 3] }, { stat: 'speed', v: [0, 0, 6] }],
  tool: [{ stat: 'harvest', v: [6, 12, 20] }, { stat: 'damage', v: [0, 5, 10] }],
};
/** Blunt also adds knockback at 2 / 4 / 6. */
export const BLUNT_KNOCK: readonly [number, number, number] = [3, 6, 10];
/** Shot also pierces: every shot goes through this many more at 2 / 4 / 6. */
export const SHOT_PIERCE: readonly [number, number, number] = [1, 2, 3];
export const CLASS_LABEL: Record<WeaponClass, string> = { edge: 'Edge', blunt: 'Blunt', shot: 'Shot', tool: 'Tool' };

/** Damage sources tracked for the recap: weapons first, then these. */
export const EXTRA_SOURCES = ['burn', 'thorns', 'burst', 'recoil', 'shards'] as const;
export const SRC_BURN = WEAPONS.length;
export const SRC_THORNS = WEAPONS.length + 1;
export const SRC_BURST = WEAPONS.length + 2;
export const SRC_RECOIL = WEAPONS.length + 3;
export const SRC_SHARDS = WEAPONS.length + 4;
export const SOURCE_COUNT = WEAPONS.length + EXTRA_SOURCES.length;
export const SOURCE_IDS: readonly string[] = [...WEAPONS.map((w) => w.id), ...EXTRA_SOURCES];
