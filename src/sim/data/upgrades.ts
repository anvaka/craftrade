// Level-up picks: one stat each, tier I-IV.
import type { StatId } from '../../shared/vocab.ts';

type T4 = readonly [number, number, number, number];

/** Value of an upgrade pick by tier. */
export const UPGRADE_VALUE: Record<StatId, T4> = {
  maxHp: [3, 6, 9, 12],
  mend: [2, 3, 4, 5],
  armor: [1, 2, 3, 4],
  dodge: [3, 6, 9, 12],
  speed: [3, 6, 9, 12],
  damage: [5, 8, 12, 16],
  melee: [2, 4, 6, 8],
  ranged: [1, 2, 3, 4],
  rate: [5, 10, 15, 20],
  crit: [3, 5, 7, 9],
  reach: [15, 30, 45, 60],
  harvest: [5, 8, 10, 12],
  luck: [5, 10, 15, 20],
};

/** Tier gates for picks by level: [first level, chance per level past it, cap]. */
export const UPGRADE_RARITY = [
  null,
  null,
  { from: 2, per: 0.07, cap: 0.6 },
  { from: 5, per: 0.035, cap: 0.25 },
  { from: 9, per: 0.012, cap: 0.08 },
] as const;
