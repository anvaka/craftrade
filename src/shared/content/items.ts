import type { ItemSpec } from '../item.ts';

// Authored items sold at the bench. Ids are stable; never rename an id.
// Every item is built from the vocabulary in ../vocab.ts. Most carry a cost
// as well as a gain. This starter list is extended by the sim content pass.
export const BASE_ITEMS: readonly ItemSpec[] = [
  { id: 'whetstone', name: 'Whetstone', glyph: 'stone', tags: ['stone', 'edge'], effects: [{ p: 'crit', l: 2 }], raws: { ore: 1 } },
  { id: 'tallow', name: 'Tallow', glyph: 'candle', tags: ['fat', 'grease'], effects: [{ p: 'rate', l: 2 }, { p: 'armor', l: 1, neg: true }], raws: { hide: 1 } },
  { id: 'hobnails', name: 'Hobnail boots', glyph: 'boot', tags: ['iron', 'boots'], effects: [{ p: 'speed', l: 2 }, { p: 'knockback', l: 1 }], raws: { ore: 1, hide: 1 } },
  { id: 'saltpork', name: 'Salt pork', glyph: 'bowl', tags: ['food', 'salt'], effects: [{ p: 'maxHp', l: 2 }], raws: { hide: 1 } },
  { id: 'pitch', name: 'Pine pitch', glyph: 'flask', tags: ['resin', 'fire'], effects: [{ p: 'burn', l: 1 }], raws: { timber: 2 } },
  { id: 'lodestone', name: 'Lodestone', glyph: 'stone', tags: ['ore', 'pull'], effects: [{ p: 'magnet', l: 2 }], raws: { ore: 1 } },
  { id: 'tallybook', name: 'Tally book', glyph: 'sack', tags: ['paper', 'numbers'], effects: [{ p: 'interest', l: 1 }, { p: 'damage', l: 1, neg: true }], raws: { hide: 1 } },
  { id: 'burrs', name: 'Burr coat', glyph: 'pelt', tags: ['hide', 'spikes'], effects: [{ p: 'thorns', l: 2 }, { p: 'speed', l: 1, neg: true }], raws: { hide: 2 } },
];

export const BASE_ITEM: Record<string, ItemSpec> = Object.fromEntries(BASE_ITEMS.map((i) => [i.id, i]));
