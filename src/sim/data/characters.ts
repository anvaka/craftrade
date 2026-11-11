// The six characters. A twist is data here plus a few flags the sim reads.
import type { StatId } from '../../shared/vocab.ts';
import type { CharacterId } from '../../shared/protocol.ts';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  twist: string;
  /** Default starting weapon. createRun can override it. */
  start: string;
  stats: Partial<Record<StatId, number>>;
  slots: number;
  /** Price multiplier per weapon id. */
  weaponPrice?: Record<string, number>;
  /** +1% Damage per this much timber held. */
  timberDamagePer?: number;
  /** Ore taken off every bench recipe. */
  oreDiscount?: number;
  /** Carcass node count multiplier. */
  carcassMul?: number;
  freeFusion?: boolean;
  /** Percent of held scrip paid at wave end, and its cap. */
  interest?: number;
  interestCap?: number;
}

export const CHARACTERS: readonly CharacterDef[] = [
  { id: 'greenhorn', name: 'Greenhorn', twist: 'No twist.', start: 'sling', stats: {}, slots: 6 },
  { id: 'sawyer', name: 'Sawyer', twist: 'Hatchets cost half. +1% Damage per 4 timber held. Starts with a hatchet.',
    start: 'hatchet', stats: {}, slots: 6, weaponPrice: { hatchet: 0.5 }, timberDamagePer: 4 },
  { id: 'smith', name: 'Smith', twist: 'Bench recipes need 1 less ore. +3 Armor, -10% Speed.',
    start: 'pick', stats: { armor: 3, speed: -10 }, slots: 6, oreDiscount: 1 },
  { id: 'trapper', name: 'Trapper', twist: '+6% Dodge, +2 Ranged. Carcasses appear twice as often. -2 Max HP.',
    start: 'bow', stats: { dodge: 6, ranged: 2, maxHp: -2 }, slots: 6, carcassMul: 2 },
  { id: 'tinker', name: 'Tinker', twist: 'Fusions cost no raws. 4 weapon slots. +25% Rate.',
    start: 'knife', stats: { rate: 25 }, slots: 4, freeFusion: true },
  { id: 'clerk', name: "Factor's clerk", twist: 'Earns 8% interest on scrip at wave end, up to 15. -8% Damage.',
    start: 'sling', stats: { damage: -8 }, slots: 6, interest: 8, interestCap: 15 },
];

export const CHARACTER: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
