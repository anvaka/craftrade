// The six characters. A twist is data here plus a few flags the sim reads.
import type { StatId } from '../../shared/vocab.ts';
import type { CharacterId } from '../../shared/protocol.ts';
import { WEAPONS } from './weapons.ts';

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
  /** Fusions per bench that cost no raws. */
  freeFusions?: number;
  /** Percent of held scrip paid at wave end (capped with item interest at INTEREST_CAP_PER_WAVE x wave). */
  interest?: number;
  /** Reroll price multiplier. */
  rerollMul?: number;
  /** Each tool counts twice toward the Tool set. */
  toolDouble?: boolean;
  /** Price multiplier for raising a held weapon one tier; with noUpgradeRaws it needs no raws either. */
  upgradeMul?: number;
  noUpgradeRaws?: boolean;
  /** Elites and brutes leave a carcass node where they fall. */
  eliteCarcass?: boolean;
  /** HP healed by every node broken. */
  nodeHeal?: number;
}

/** Sawyer's price list: everything but the three tools at 1.5. */
const NOT_TOOLS_DEAR: Record<string, number> = Object.fromEntries(WEAPONS.filter((w) => !w.tool).map((w) => [w.id, 1.5]));

export const CHARACTERS: readonly CharacterDef[] = [
  { id: 'greenhorn', name: 'Greenhorn', twist: 'Plain kit and no favours.', start: 'sling', stats: {}, slots: 6 },
  { id: 'sawyer', name: 'Sawyer', twist: 'Each tool counts twice toward the Tool set. Every weapon that is not a tool costs half as much again. Starts with a hatchet. -4 Max HP.',
    start: 'hatchet', stats: { maxHp: -4 }, slots: 6, toolDouble: true, weaponPrice: NOT_TOOLS_DEAR },
  { id: 'smith', name: 'Smith', twist: 'Raises a held weapon one tier for a third less and without raws. +2 Armor, -10% Speed.',
    start: 'pick', stats: { armor: 2, speed: -10 }, slots: 6, upgradeMul: 0.67, noUpgradeRaws: true },
  { id: 'trapper', name: 'Trapper', twist: 'Elites and brutes leave a carcass. Every node broken heals 2 HP. +6% Dodge, +2 Ranged, -2 Max HP.',
    start: 'bow', stats: { dodge: 6, ranged: 2, maxHp: -2 }, slots: 6, carcassMul: 2, eliteCarcass: true, nodeHeal: 2 },
  { id: 'tinker', name: 'Tinker', twist: 'The first fusion at every bench costs no raws. 5 weapon slots.',
    start: 'knife', stats: {}, slots: 5, freeFusions: 1 },
  { id: 'clerk', name: "Factor's clerk", twist: 'Earns 8% interest on scrip at wave end, up to 6 per wave number. Rerolls cost half as much again.',
    start: 'sling', stats: {}, slots: 6, interest: 8, rerollMul: 1.5 },
];

export const CHARACTER: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
