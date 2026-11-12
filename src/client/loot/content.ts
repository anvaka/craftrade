// The loot prototype's content: two tiers of material, two refined goods, three schematics.
// Kept apart from the real game. Numbers are first guesses.
import type { ItemSpec } from '../../shared/item.ts';

export const MATS = ['timber', 'ore', 'hide', 'silver', 'thickhide', 'steel', 'leather'] as const;
export type Mat = (typeof MATS)[number];
export const MAT_NAME: Record<Mat, string> = {
  timber: 'Timber', ore: 'Ore', hide: 'Hide', silver: 'Silver ore', thickhide: 'Thick hide', steel: 'Steel bar', leather: 'Leather',
};
/** Rare materials in pickup-kind order (PK_RARE + i). */
export const RARE_MATS: readonly Mat[] = ['silver', 'thickhide'];

export interface Refine { out: Mat; needs: Partial<Record<Mat, number>>; verb: string }
export const REFINES: readonly Refine[] = [
  { out: 'steel', needs: { ore: 4, timber: 1 }, verb: 'Smelt' },
  { out: 'leather', needs: { hide: 4 }, verb: 'Cure' },
];

export type Made =
  | { kind: 'weapon'; id: string; tier: number }
  | { kind: 'item'; item: ItemSpec };

export interface Schematic { id: string; name: string; needs: Partial<Record<Mat, number>>; makes: Made; what: string }
export const SCHEMATICS: readonly Schematic[] = [
  { id: 'steelhatchet', name: 'Steel hatchet', needs: { steel: 3, timber: 4 }, makes: { kind: 'weapon', id: 'hatchet', tier: 3 },
    what: 'A tier 3 hatchet, carried in besides your own weapon.' },
  { id: 'hidejerkin', name: 'Hide jerkin', needs: { leather: 3, thickhide: 2 },
    makes: { kind: 'item', item: { id: 'hidejerkin', name: 'Hide jerkin', glyph: 'pelt', tags: ['hide', 'leather'], effects: [{ p: 'armor', l: 3 }, { p: 'maxHp', l: 3 }] } },
    what: 'Armor and health from the first second.' },
  { id: 'silversling', name: 'Silver sling', needs: { steel: 3, silver: 4 }, makes: { kind: 'weapon', id: 'sling', tier: 4 },
    what: 'A tier 4 sling, carried in besides your own weapon.' },
];
/** Runs a made thing lasts. */
export const CHARGES = 3;

/** What a schematic asks for, counted in raws: refined goods turned back into what they are made of. */
export function rawNeeds(s: Schematic, have: Partial<Record<Mat, number>>): Partial<Record<Mat, number>> {
  const out: Partial<Record<Mat, number>> = {};
  const add = (m: Mat, n: number): void => { if (n > 0) out[m] = (out[m] ?? 0) + n; };
  for (const [m, n] of Object.entries(s.needs) as [Mat, number][]) {
    const r = REFINES.find((x) => x.out === m);
    if (!r) { add(m, n); continue; }
    const missing = Math.max(0, n - (have[m] ?? 0));
    for (const [rm, rn] of Object.entries(r.needs) as [Mat, number][]) add(rm, rn * missing);
  }
  return out;
}
