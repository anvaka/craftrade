// How a packed item enters a run.
//
// A kit is a key, not a win button. An item packed for a run brings at most a
// fixed number of points with it, set by the hazard level of the run. An item
// over that is packed down: its effects are lowered, highest first, until it
// fits, and its drawback is kept. The item in the stash is not changed. The
// higher the hazard, the more of a strong item may be used, so a strong item
// is what opens a harder clearing rather than what flattens the easy one.
//
// The server packs the kit when it writes the run ticket; the client uses the
// same function to show what an item will be worth before heading out.

import { isRelic, itemPoints, fnv1a, repairEffects, type ItemSpec } from './item.ts';

export const MAX_HAZARD = 5;

/**
 * The most points one packed item brings into a run, by hazard level.
 * Measured with tools/exp/meta/kitab.ts: at hazard 0 the best kit there is
 * should be worth about 10 to 15 points of win rate to an average player.
 * The top level admits any item whole.
 */
export const KIT_POINT_CAP: readonly number[] = [14, 26, 40, 58, 80, 999];

export const kitPointCap = (hazard: number): number => KIT_POINT_CAP[Math.max(0, Math.min(MAX_HAZARD, Math.floor(hazard) || 0))];

/** The item as it enters a run at this hazard. Same id and name; effects lowered to fit the cap. A relic is never changed. */
export function packItem(item: ItemSpec, hazard = 0, cap = kitPointCap(hazard)): ItemSpec {
  if (isRelic(item) || itemPoints(item.effects) <= cap) return item;
  // The same deterministic repair a fusion uses: gains are lowered, highest first, until the item is worth the cap.
  // A drawback is kept as it is. (Capping the gains alone was tried: items with a drawback then packed down to a net loss.)
  return { ...item, effects: repairEffects(item.effects.map((e) => ({ p: e.p, l: e.l, neg: e.neg })), cap, fnv1a(item.id)) };
}

/** True if packing would lower the item at this hazard. */
export const packedDown = (item: ItemSpec, hazard = 0): boolean => packItem(item, hazard) !== item;
