import type { ItemSpec } from '../item.ts';

// Relics: the tier above 4. A small authored set. Each breaks one rule of the
// game and none of them is a bigger number. They are never sold at the bench,
// never come out of the anvil and never enter the fusion model's vocabulary.
// The only source is the server's roll at the end of a paying run
// (server/relics.ts); odds live in server/config.ts. Ids are stable; never
// rename one, because the world roll of found relics refers to them.
//
// Listed from the most often found to the rarest.
export const RELICS: readonly ItemSpec[] = [
  { id: 'orderbook', name: 'Order book', glyph: 'feather', tags: ['paper', 'orders'], effects: [{ p: 'extraOffer', l: 1 }], relic: true },
  { id: 'oilskinwrap', name: 'Oilskin wrap', glyph: 'rope', tags: ['cloth', 'oil'], effects: [{ p: 'keepCharge', l: 1 }], relic: true },
  { id: 'hideblind', name: 'Hide blind', glyph: 'pelt', tags: ['hide', 'cover'], effects: [{ p: 'safeWork', l: 1 }], relic: true },
  { id: 'packsaddle', name: 'Pack saddle', glyph: 'sack', tags: ['leather', 'load'], effects: [{ p: 'extraCarry', l: 1 }], relic: true },
  { id: 'seedcorn', name: 'Seed corn', glyph: 'leaf', tags: ['seed', 'grain'], effects: [{ p: 'regrow', l: 1 }], relic: true },
  { id: 'companydraft', name: 'Company draft', glyph: 'coin', tags: ['paper', 'credit'], effects: [{ p: 'noRawCost', l: 1 }], relic: true },
  { id: 'brandyflask', name: 'Brandy flask', glyph: 'flask', tags: ['spirit', 'tin'], effects: [{ p: 'secondLife', l: 1 }], relic: true },
  { id: 'saddlescabbard', name: 'Saddle scabbard', glyph: 'blade', tags: ['leather', 'sheath'], effects: [{ p: 'extraSlot', l: 1 }], relic: true },
];

export type RelicId = string;

// Null prototype so keys like '__proto__' from untrusted input never resolve.
export const RELIC: Record<string, ItemSpec> = Object.assign(Object.create(null), Object.fromEntries(RELICS.map((r) => [r.id, r])));

export const isRelicId = (id: unknown): id is RelicId => typeof id === 'string' && Object.hasOwn(RELIC, id);
