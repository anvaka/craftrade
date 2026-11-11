// Town rules that both the server and the town pages need: prices of the
// sinks, limits, gates. The server enforces them; the pages only show them.
// Numbers are starting values, set from tools/exp/meta (see docs/critique/meta-after.md).

import { itemPoints, type ItemSpec } from './item.ts';
import { KIT_CHARGES } from './protocol.ts';
import { FUSE_RAW_COST, RAWS, type RawBag } from './vocab.ts';

export { MAX_HAZARD, KIT_POINT_CAP, kitPointCap, packItem, packedDown } from './kit.ts';

/** Marks paid for a run are multiplied by 1 + this for each hazard level. Relic odds do not move with hazard. */
export const HAZARD_MARKS = 0.1;

// Sinks. Every price here is destroyed, not paid to anyone.

/** Town fusion costs the run's raw price for the result's tier, times this, plus marks by tier (index 1-4). */
export const TOWN_FUSE_RAW_MUL = 3;
export const TOWN_FUSE_MARKS: readonly number[] = [0, 15, 40, 90, 200];
export interface Cost { marks: number; raws: RawBag }
export function townFuseCost(tier: number): Cost {
  const base = FUSE_RAW_COST[tier] ?? FUSE_RAW_COST[1];
  return {
    marks: TOWN_FUSE_MARKS[tier] ?? TOWN_FUSE_MARKS[1],
    raws: { timber: base.timber * TOWN_FUSE_RAW_MUL, ore: base.ore * TOWN_FUSE_RAW_MUL, hide: base.hide * TOWN_FUSE_RAW_MUL },
  };
}

/** One charge back on a worn item: marks and each raw per point of the item. Twice per item at most. */
export const REPAIR = { marksPerPoint: 2, minMarks: 15, rawsPerPoint: 0.125, perItem: 2 };
/** `discount` is the granary perk: 0.75 while it lasts, else 1. */
export function repairCost(item: Pick<ItemSpec, 'effects'>, discount = 1): Cost {
  const points = itemPoints(item.effects);
  const each = Math.max(1, Math.ceil(points * REPAIR.rawsPerPoint * discount));
  return { marks: Math.ceil(Math.max(REPAIR.minMarks, points * REPAIR.marksPerPoint) * discount), raws: { timber: each, ore: each, hide: each } };
}

/** The stash holds this many items (relics are not counted). More room is bought, a shelf at a time. */
export const STASH = { base: 24, step: 8, max: 96, marks: [150, 300, 600, 1000, 1500, 2000, 2500, 3000, 3500] as readonly number[], rawsEach: 20 };
export const stashLimit = (bought: number): number => Math.min(STASH.max, STASH.base + STASH.step * bought);
/** Price of the next shelf, or null when the stash is as large as it gets. */
export function stashNextCost(bought: number): Cost | null {
  if (stashLimit(bought) >= STASH.max) return null;
  const each = STASH.rawsEach * (bought + 1);
  return { marks: STASH.marks[Math.min(bought, STASH.marks.length - 1)], raws: { timber: each, ore: each, hide: each } };
}

export const canPay = (have: { marks: number; raws: RawBag }, cost: Cost): boolean =>
  have.marks >= cost.marks && RAWS.every((r) => have.raws[r] >= cost.raws[r]);

// Market.

/** Paid runs before an account may post, buy, fill or place an order. The Factor trades with anyone. */
export const LISTING_MIN_RUNS = 10;
/** An item may be priced at most this many marks per point, scaled by charges left. */
export const LISTING_MARKS_PER_POINT = 20;
export function priceCeiling(item: Pick<ItemSpec, 'effects'>, charges: number): number {
  return Math.max(1, Math.floor((itemPoints(item.effects) * LISTING_MARKS_PER_POINT * Math.max(1, charges)) / KIT_CHARGES));
}
/** Both sides of a relic sale need this many paid runs and an account this old. A relic has no price cap, so this is the only brake. */
export const RELIC_TRADE = { runs: 30, ageMs: 3 * 24 * 3600 * 1000 };
/** Most units in one raw lot or one raw order. */
export const MAX_LOT = 500;

/**
 * Marks given to the town are spent for it at the Factor's selling price on
 * whatever the project needs most. One player can fund this many units a day.
 */
export const TOWN_FUND_PER_DAY = 300;

/** A name may be changed once in this long. */
export const NAME_REROLL_MS = 7 * 24 * 3600 * 1000;
