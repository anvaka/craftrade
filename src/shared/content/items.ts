import type { ItemSpec } from '../item.ts';

// Authored items sold at the bench. Ids are stable; never rename an id.
// Every item is built from the vocabulary in ../vocab.ts. Tags name the
// material or the idea, because tags are what the fusion model reasons about.
// Above tier 1 nearly every item carries a drawback or a condition, so a
// purchase is a trade and not a small free percentage.
// A few tier 1 items cost scrip only, so the bench is never shut to empty pockets.
// Tier follows from points (see itemTier); the comments mark where tiers start.
// Each block ends with the conversion items: they turn Armor, Max HP, Speed, Dodge, Harvest, Luck, held scrip
// or a matched set of weapons into damage, so that a build can be made around any of them.
export const BASE_ITEMS: readonly ItemSpec[] = [
  // Tier 1
  { id: 'whetstone', name: 'Whetstone', glyph: 'stone', tags: ['stone', 'edge'], effects: [{ p: 'crit', l: 2 }], price: 17, raws: { ore: 1 } },
  { id: 'tallow', name: 'Tallow', glyph: 'candle', tags: ['fat', 'grease'], effects: [{ p: 'rate', l: 2 }, { p: 'armor', l: 1, neg: true }], price: 14, raws: { hide: 1 } },
  { id: 'hobnails', name: 'Hobnail boots', glyph: 'boot', tags: ['iron', 'boots'], effects: [{ p: 'speed', l: 2 }, { p: 'knockback', l: 1 }], price: 20, raws: { ore: 1, hide: 1 } },
  { id: 'saltpork', name: 'Salt pork', glyph: 'bowl', tags: ['food', 'salt'], effects: [{ p: 'maxHp', l: 2 }], price: 16 },
  { id: 'pitch', name: 'Pine pitch', glyph: 'flask', tags: ['resin', 'fire'], effects: [{ p: 'burn', l: 1 }], price: 15, raws: { timber: 2 } },
  { id: 'lodestone', name: 'Lodestone', glyph: 'stone', tags: ['ore', 'pull'], effects: [{ p: 'magnet', l: 2 }], price: 11, raws: { ore: 1 } },
  { id: 'tallybook', name: 'Tally book', glyph: 'sack', tags: ['paper', 'numbers'], effects: [{ p: 'interest', l: 2 }, { p: 'scripDamage', l: 1 }], price: 15 },
  { id: 'burrs', name: 'Burr coat', glyph: 'pelt', tags: ['hide', 'spikes'], effects: [{ p: 'thorns', l: 3 }, { p: 'speed', l: 1, neg: true }], price: 14, raws: { hide: 2 } },
  { id: 'splint', name: 'Splint', glyph: 'bone', tags: ['wood', 'binding'], effects: [{ p: 'mend', l: 2 }], price: 16, raws: { timber: 1 } },
  { id: 'baitbag', name: 'Bait bag', glyph: 'sack', tags: ['meat', 'lure'], effects: [{ p: 'killScrip', l: 2 }], price: 17, raws: { hide: 1 } },
  { id: 'saptap', name: 'Sap tap', glyph: 'leaf', tags: ['sap', 'tree'], effects: [{ p: 'nodeHeal', l: 2 }], price: 13, raws: { timber: 1 } },
  { id: 'fellingwedge', name: 'Felling wedge', glyph: 'wedge', tags: ['iron', 'wedge'], effects: [{ p: 'harvest', l: 2 }, { p: 'workHaste', l: 1 }], price: 16, raws: { ore: 1 } },
  { id: 'rabbitfoot', name: 'Rabbit foot', glyph: 'charm', tags: ['fur', 'charm'], effects: [{ p: 'luck', l: 2 }, { p: 'luckCrit', l: 1 }], price: 15, raws: { hide: 1 } },
  { id: 'leadshot', name: 'Lead shot', glyph: 'ring', tags: ['lead', 'shot'], effects: [{ p: 'ranged', l: 3 }, { p: 'speed', l: 1, neg: true }], price: 14, raws: { ore: 1 } },
  { id: 'rawhidegrip', name: 'Rawhide grip', glyph: 'rope', tags: ['hide', 'grip'], effects: [{ p: 'melee', l: 2 }], price: 16, raws: { hide: 1 } },
  { id: 'slate', name: 'Slate and chalk', glyph: 'stone', tags: ['slate', 'notes'], effects: [{ p: 'xpGain', l: 2 }], price: 16 },
  { id: 'oilcloth', name: 'Oilcloth', glyph: 'pelt', tags: ['cloth', 'oil'], effects: [{ p: 'waveShield', l: 2 }], price: 14, raws: { hide: 1 } },
  { id: 'fishhook', name: 'Fish hook', glyph: 'hook', tags: ['hook', 'barb'], effects: [{ p: 'pierce', l: 1 }], price: 15, raws: { ore: 1 } },
  { id: 'springsteel', name: 'Spring steel', glyph: 'cog', tags: ['steel', 'spring'], effects: [{ p: 'bounce', l: 1 }], price: 15, raws: { ore: 2 } },
  { id: 'smellingsalts', name: 'Smelling salts', glyph: 'flask', tags: ['salt', 'shock'], effects: [{ p: 'lowHpRate', l: 3 }, { p: 'killHeal', l: 1 }, { p: 'maxHp', l: 1, neg: true }], price: 19, raws: { ore: 1 } },

  { id: 'bonebroth', name: 'Bone broth', glyph: 'bowl', tags: ['broth', 'bone'], effects: [{ p: 'killHeal', l: 2 }, { p: 'mend', l: 1 }], price: 16, raws: { hide: 1 } },
  { id: 'ropesoles', name: 'Rope soles', glyph: 'boot', tags: ['rope', 'light'], effects: [{ p: 'speed', l: 2 }, { p: 'speedDamage', l: 1 }, { p: 'maxHp', l: 1, neg: true }], price: 15, raws: { hide: 1 } },
  { id: 'snaretwine', name: 'Snare twine', glyph: 'rope', tags: ['twine', 'trap'], effects: [{ p: 'dodgeStrike', l: 2 }, { p: 'movingDodge', l: 1 }], price: 16, raws: { hide: 1 } },
  { id: 'coinpurse', name: 'Coin purse', glyph: 'coin', tags: ['leather', 'coin'], effects: [{ p: 'scripDamage', l: 2 }, { p: 'killScrip', l: 1 }], price: 16 },
  { id: 'drillmanual', name: 'Drill manual', glyph: 'feather', tags: ['paper', 'drill'], effects: [{ p: 'pureSet', l: 2 }, { p: 'rate', l: 1 }], price: 16, raws: { timber: 1 } },
  { id: 'lightpack', name: 'Light pack', glyph: 'sack', tags: ['canvas', 'light'], effects: [{ p: 'fewWeapons', l: 2 }, { p: 'speed', l: 1 }], price: 15, raws: { hide: 1 } },

  // Tier 2
  { id: 'ballastbelt', name: 'Ballast belt', glyph: 'ring', tags: ['ore', 'belt'], effects: [{ p: 'hoardOre', l: 3 }, { p: 'armor', l: 2 }, { p: 'speed', l: 1, neg: true }], price: 27, raws: { ore: 2, hide: 1 } },
  { id: 'timbersledge', name: 'Timber sledge', glyph: 'wedge', tags: ['timber', 'sled'], effects: [{ p: 'hoardTimber', l: 3 }, { p: 'harvest', l: 1 }, { p: 'dodge', l: 1, neg: true }], price: 27, raws: { timber: 3 } },
  { id: 'hidebundle', name: 'Hide bundle', glyph: 'pelt', tags: ['hide', 'bundle'], effects: [{ p: 'hoardHide', l: 3 }, { p: 'maxHp', l: 1 }, { p: 'speed', l: 1, neg: true }], price: 27, raws: { hide: 3 } },
  { id: 'tripod', name: 'Tripod', glyph: 'nail', tags: ['stand', 'brace'], effects: [{ p: 'stillDamage', l: 3 }, { p: 'reach', l: 2 }, { p: 'speed', l: 2, neg: true }], price: 28, raws: { timber: 2, ore: 1 } },
  { id: 'moccasins', name: 'Soft moccasins', glyph: 'boot', tags: ['hide', 'soft'], effects: [{ p: 'movingDodge', l: 2 }, { p: 'dodge', l: 2 }, { p: 'dodgeStrike', l: 2 }, { p: 'armor', l: 1, neg: true }], price: 28, raws: { hide: 2 } },
  { id: 'powderhorn', name: 'Powder horn', glyph: 'horn', tags: ['powder', 'horn'], effects: [{ p: 'killBlast', l: 2 }, { p: 'ranged', l: 2 }, { p: 'mend', l: 1, neg: true }], price: 28, raws: { ore: 1, hide: 1 } },
  { id: 'quarrycharge', name: 'Quarry charge', glyph: 'candle', tags: ['powder', 'stone'], effects: [{ p: 'nodeBurst', l: 2 }, { p: 'harvest', l: 2 }, { p: 'luck', l: 1, neg: true }], price: 27, raws: { ore: 2 } },
  { id: 'coiledspring', name: 'Coiled spring', glyph: 'cog', tags: ['spring', 'recoil'], effects: [{ p: 'hurtBlast', l: 3 }, { p: 'knockback', l: 2 }, { p: 'rate', l: 1, neg: true }], price: 27, raws: { ore: 2 } },
  { id: 'favourlist', name: 'Favour list', glyph: 'feather', tags: ['paper', 'favours'], effects: [{ p: 'rerollCut', l: 3 }, { p: 'luck', l: 2 }, { p: 'killScrip', l: 1 }, { p: 'speed', l: 1, neg: true }], price: 26, raws: { hide: 1, timber: 1 } },
  { id: 'gaffhook', name: 'Gaff hook', glyph: 'hook', tags: ['hook', 'game'], effects: [{ p: 'eliteDamage', l: 3 }, { p: 'melee', l: 2 }, { p: 'rate', l: 1, neg: true }], price: 28, raws: { ore: 1, timber: 1 } },
  { id: 'prospectorpan', name: 'Prospector pan', glyph: 'bowl', tags: ['pan', 'ore'], effects: [{ p: 'richNodes', l: 3 }, { p: 'harvestDamage', l: 2 }, { p: 'melee', l: 1, neg: true }], price: 26, raws: { ore: 2 } },
  { id: 'boilerplate', name: 'Boiler plate', glyph: 'bell', tags: ['iron', 'plate'], effects: [{ p: 'armor', l: 4 }, { p: 'thorns', l: 1 }, { p: 'speed', l: 3, neg: true }], price: 29, raws: { ore: 3 } },

  { id: 'rivetedapron', name: 'Riveted apron', glyph: 'pelt', tags: ['leather', 'rivets'], effects: [{ p: 'armor', l: 3 }, { p: 'hpDamage', l: 2 }, { p: 'speed', l: 2, neg: true }], price: 27, raws: { hide: 2, ore: 1 } },
  { id: 'shieldrim', name: 'Shield rim', glyph: 'ring', tags: ['iron', 'rim'], effects: [{ p: 'armorDamage', l: 3 }, { p: 'armor', l: 2 }, { p: 'rate', l: 1, neg: true }], price: 28, raws: { ore: 3 } },
  { id: 'poultice', name: 'Poultice', glyph: 'leaf', tags: ['herb', 'salve'], effects: [{ p: 'mend', l: 3 }, { p: 'killHeal', l: 2 }, { p: 'damage', l: 1, neg: true }], price: 27, raws: { timber: 1, hide: 1 } },
  { id: 'raincape', name: 'Rain cape', glyph: 'pelt', tags: ['cloth', 'loose'], effects: [{ p: 'dodge', l: 3 }, { p: 'dodgeStrike', l: 3 }, { p: 'armor', l: 2, neg: true }], price: 28, raws: { hide: 3 } },
  { id: 'promissorynote', name: 'Promissory note', glyph: 'feather', tags: ['paper', 'debt'], effects: [{ p: 'interest', l: 3 }, { p: 'rerollCut', l: 2 }, { p: 'maxHp', l: 1, neg: true }], price: 25, raws: { timber: 1 } },
  { id: 'workgloves', name: 'Work gloves', glyph: 'pelt', tags: ['leather', 'work'], effects: [{ p: 'harvest', l: 2 }, { p: 'harvestDamage', l: 1 }], price: 24, raws: { hide: 2 } },
  { id: 'songsheet', name: 'Song sheet', glyph: 'bell', tags: ['paper', 'rhythm'], effects: [{ p: 'workHaste', l: 3 }, { p: 'harvest', l: 1 }], price: 25, raws: { timber: 2 } },
  { id: 'grindstone', name: 'Grindstone', glyph: 'stone', tags: ['stone', 'wheel'], effects: [{ p: 'harvestDamage', l: 3 }, { p: 'harvest', l: 3 }, { p: 'dodge', l: 2, neg: true }], price: 29, raws: { ore: 2, timber: 1 } },
  { id: 'minerlamp', name: 'Miner lamp', glyph: 'lantern', tags: ['lamp', 'tin'], effects: [{ p: 'richNodes', l: 2 }, { p: 'workHaste', l: 2 }, { p: 'nodeHeal', l: 1 }], price: 27, raws: { ore: 2 } },
  { id: 'matchedbrace', name: 'Matched brace', glyph: 'nail', tags: ['matched', 'set'], effects: [{ p: 'pureSet', l: 4 }, { p: 'crit', l: 2 }, { p: 'luck', l: 2, neg: true }], price: 29, raws: { ore: 2, timber: 1 } },
  { id: 'loadeddice', name: 'Loaded dice', glyph: 'bone', tags: ['bone', 'dice'], effects: [{ p: 'luckCrit', l: 3 }, { p: 'luck', l: 3 }, { p: 'maxHp', l: 2, neg: true }], price: 28, raws: { hide: 1, ore: 1 } },
  { id: 'tarbucket', name: 'Tar bucket', glyph: 'bowl', tags: ['tar', 'fire'], effects: [{ p: 'burn', l: 2 }, { p: 'stillDamage', l: 2 }, { p: 'speed', l: 1, neg: true }], price: 26, raws: { timber: 3 } },

  // Tier 3
  { id: 'strongbox', name: 'Strongbox', glyph: 'coin', tags: ['iron', 'savings'], effects: [{ p: 'interest', l: 4 }, { p: 'scripDamage', l: 3 }, { p: 'waveShield', l: 2 }, { p: 'speed', l: 2, neg: true }], price: 46, raws: { ore: 3, timber: 2 } },
  { id: 'horseshoe', name: 'Lucky horseshoe', glyph: 'charm', tags: ['iron', 'luck'], effects: [{ p: 'secondWind', l: 3 }, { p: 'luck', l: 3 }, { p: 'luckCrit', l: 3 }, { p: 'damage', l: 1, neg: true }], price: 48, raws: { ore: 4 } },
  { id: 'emberjar', name: 'Ember jar', glyph: 'lantern', tags: ['fire', 'glass'], effects: [{ p: 'burn', l: 3 }, { p: 'killBlast', l: 2 }, { p: 'damage', l: 2 }, { p: 'armor', l: 2, neg: true }], price: 47, raws: { timber: 4, ore: 1 } },
  { id: 'barbedquiver', name: 'Barbed quiver', glyph: 'feather', tags: ['barb', 'quiver'], effects: [{ p: 'pierce', l: 3 }, { p: 'ranged', l: 3 }, { p: 'crit', l: 1 }, { p: 'melee', l: 2, neg: true }], price: 47, raws: { hide: 3, ore: 2 } },
  { id: 'drillbrace', name: 'Drill brace', glyph: 'cog', tags: ['drill', 'crank'], effects: [{ p: 'rate', l: 4 }, { p: 'harvest', l: 3 }, { p: 'dodge', l: 2, neg: true }], price: 48, raws: { ore: 3, timber: 2 } },
  { id: 'surveyorglass', name: 'Surveyor glass', glyph: 'lantern', tags: ['lens', 'brass'], effects: [{ p: 'reach', l: 4 }, { p: 'crit', l: 3 }, { p: 'maxHp', l: 2, neg: true }], price: 48, raws: { ore: 3, hide: 1 } },
  { id: 'skippingstones', name: 'Skipping stones', glyph: 'stone', tags: ['stone', 'skip'], effects: [{ p: 'bounce', l: 3 }, { p: 'ranged', l: 2 }, { p: 'luck', l: 2 }, { p: 'armor', l: 1, neg: true }], price: 48, raws: { ore: 4 } },

  { id: 'nailboard', name: 'Nail board', glyph: 'nail', tags: ['wood', 'nails'], effects: [{ p: 'thorns', l: 4 }, { p: 'hurtBlast', l: 3 }, { p: 'dodge', l: 2, neg: true }], price: 46, raws: { timber: 3, ore: 2 } },
  { id: 'suetpudding', name: 'Suet pudding', glyph: 'bowl', tags: ['food', 'fat'], effects: [{ p: 'maxHp', l: 4 }, { p: 'hpDamage', l: 3 }, { p: 'speed', l: 2, neg: true }], price: 47, raws: { hide: 4 } },
  { id: 'campkettle', name: 'Camp kettle', glyph: 'bowl', tags: ['tin', 'fire'], effects: [{ p: 'mend', l: 4 }, { p: 'maxHp', l: 3 }, { p: 'nodeHeal', l: 2 }, { p: 'rate', l: 2, neg: true }], price: 48, raws: { ore: 3, timber: 2 } },
  { id: 'runningspikes', name: 'Running spikes', glyph: 'boot', tags: ['iron', 'spikes'], effects: [{ p: 'speed', l: 4 }, { p: 'speedDamage', l: 3 }, { p: 'movingDodge', l: 2 }, { p: 'armor', l: 2, neg: true }], price: 48, raws: { ore: 2, hide: 3 } },
  { id: 'paychest', name: 'Pay chest', glyph: 'coin', tags: ['iron', 'wages'], effects: [{ p: 'scripDamage', l: 4 }, { p: 'interest', l: 3 }, { p: 'speed', l: 2, neg: true }], price: 46, raws: { ore: 3, timber: 2 } },
  { id: 'crosscutsaw', name: 'Crosscut saw', glyph: 'blade', tags: ['steel', 'saw'], effects: [{ p: 'harvestDamage', l: 4 }, { p: 'harvest', l: 4 }, { p: 'nodeBurst', l: 2 }, { p: 'speed', l: 3, neg: true }], price: 49, raws: { ore: 4, timber: 1 } },
  { id: 'companyflag', name: 'Company flag', glyph: 'feather', tags: ['cloth', 'colours'], effects: [{ p: 'pureSet', l: 5 }, { p: 'damage', l: 3 }, { p: 'maxHp', l: 2 }, { p: 'speed', l: 2, neg: true }], price: 49, raws: { hide: 3, timber: 2 } },
  { id: 'wornhandle', name: 'Worn handle', glyph: 'wedge', tags: ['wood', 'grip'], effects: [{ p: 'fewWeapons', l: 4 }, { p: 'crit', l: 3 }, { p: 'melee', l: 2 }, { p: 'reach', l: 2, neg: true }], price: 47, raws: { timber: 4 } },
  { id: 'wishbone', name: 'Wishbone', glyph: 'bone', tags: ['bone', 'luck'], effects: [{ p: 'luck', l: 4 }, { p: 'luckCrit', l: 4 }, { p: 'killScrip', l: 3 }, { p: 'armor', l: 2, neg: true }], price: 49, raws: { hide: 4 } },
  { id: 'beartrap', name: 'Bear trap', glyph: 'tooth', tags: ['iron', 'jaws'], effects: [{ p: 'eliteDamage', l: 4 }, { p: 'hurtBlast', l: 3 }, { p: 'thorns', l: 2 }, { p: 'speed', l: 2, neg: true }], price: 47, raws: { ore: 5 } },
  { id: 'bandolier', name: 'Bandolier', glyph: 'rope', tags: ['leather', 'shot'], effects: [{ p: 'ranged', l: 4 }, { p: 'rate', l: 3 }, { p: 'pierce', l: 2 }, { p: 'armor', l: 2, neg: true }], price: 48, raws: { hide: 4, ore: 1 } },
  { id: 'whiskyjug', name: 'Whisky jug', glyph: 'flask', tags: ['spirit', 'clay'], effects: [{ p: 'lowHpRate', l: 4 }, { p: 'killHeal', l: 3 }, { p: 'damage', l: 2 }, { p: 'dodge', l: 2, neg: true }], price: 47, raws: { timber: 3, hide: 1 } },
  { id: 'longhandle', name: 'Long handle', glyph: 'wedge', tags: ['wood', 'pole'], effects: [{ p: 'reach', l: 4 }, { p: 'melee', l: 4 }, { p: 'knockback', l: 3 }, { p: 'rate', l: 2, neg: true }], price: 47, raws: { timber: 5 } },

  // Tier 4
  { id: 'blastingkit', name: 'Blasting kit', glyph: 'candle', tags: ['powder', 'fuse'], effects: [{ p: 'nodeBurst', l: 4 }, { p: 'killBlast', l: 4 }, { p: 'harvest', l: 4 }, { p: 'armor', l: 3, neg: true }], price: 88, raws: { ore: 5, timber: 3 } },
  { id: 'anvil', name: 'Anvil', glyph: 'hammer', tags: ['iron', 'anvil'], effects: [{ p: 'armor', l: 5 }, { p: 'armorDamage', l: 4 }, { p: 'knockback', l: 5 }, { p: 'speed', l: 3, neg: true }], price: 94, raws: { ore: 8 } },
  { id: 'factorseal', name: 'Factor seal', glyph: 'coin', tags: ['wax', 'seal'], effects: [{ p: 'interest', l: 5 }, { p: 'rerollCut', l: 5 }, { p: 'killScrip', l: 3 }, { p: 'damage', l: 2, neg: true }], price: 96, raws: { hide: 4, timber: 4 } },
  { id: 'forgebellows', name: 'Forge bellows', glyph: 'horn', tags: ['leather', 'air'], effects: [{ p: 'burn', l: 4 }, { p: 'rate', l: 4 }, { p: 'damage', l: 5 }, { p: 'dodge', l: 3, neg: true }], price: 98, raws: { hide: 5, timber: 3 } },
  { id: 'oxyoke', name: 'Ox yoke', glyph: 'ring', tags: ['wood', 'yoke'], effects: [{ p: 'maxHp', l: 5 }, { p: 'armorDamage', l: 4 }, { p: 'thorns', l: 3 }, { p: 'speed', l: 3, neg: true }], price: 92, raws: { timber: 5, hide: 3 } },
  { id: 'mustangbridle', name: 'Mustang bridle', glyph: 'rope', tags: ['leather', 'horse'], effects: [{ p: 'speed', l: 5 }, { p: 'speedDamage', l: 5 }, { p: 'dodgeStrike', l: 4 }, { p: 'armor', l: 3, neg: true }], price: 96, raws: { hide: 7 } },
  { id: 'assayscales', name: 'Assay scales', glyph: 'coin', tags: ['brass', 'weights'], effects: [{ p: 'scripDamage', l: 5 }, { p: 'killScrip', l: 4 }, { p: 'luck', l: 3 }, { p: 'armor', l: 3, neg: true }], price: 92, raws: { ore: 5, timber: 2 } },
  { id: 'steamdonkey', name: 'Steam donkey', glyph: 'cog', tags: ['boiler', 'winch'], effects: [{ p: 'harvest', l: 5 }, { p: 'harvestDamage', l: 5 }, { p: 'workHaste', l: 4 }, { p: 'dodge', l: 3, neg: true }], price: 95, raws: { ore: 6, timber: 2 } },
  { id: 'surgeonbag', name: 'Surgeon bag', glyph: 'sack', tags: ['leather', 'lint'], effects: [{ p: 'mend', l: 5 }, { p: 'killHeal', l: 5 }, { p: 'secondWind', l: 3 }, { p: 'damage', l: 2, neg: true }], price: 96, raws: { hide: 6, timber: 2 } },
  { id: 'signaldrum', name: 'Signal drum', glyph: 'bell', tags: ['hide', 'drum'], effects: [{ p: 'pureSet', l: 5 }, { p: 'rate', l: 4 }, { p: 'reach', l: 3 }, { p: 'luck', l: 3, neg: true }], price: 92, raws: { hide: 5, timber: 3 } },
];

export const BASE_ITEM: Record<string, ItemSpec> = Object.fromEntries(BASE_ITEMS.map((i) => [i.id, i]));
