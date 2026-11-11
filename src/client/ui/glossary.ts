// What the game's own words mean, in one place. Every tooltip on a word
// reads from here, and the almanac prints the whole list, so a term is
// explained the same way wherever it shows up.
// Numbers come from the shared rules so a change there changes the text.

import type { StatId } from '../../shared/vocab.ts';
import { DAILY_WAVES, DEATH_RAW_KEEP, KIT_CHARGES, KIT_SLOTS, LISTING_FEE, RUN_WAVES, SALE_TAX } from '../../shared/protocol.ts';
import { HAZARD_MARKS, LISTING_MIN_RUNS, REPAIR, STASH } from '../../shared/rules.ts';

const pct = (n: number): string => `${Math.round(n * 100)}%`;

export const GLOSS = {
  scrip: 'Coins dropped in a run. Spend them at the bench between waves. Scrip still held when the run ends pays marks, 1 for every 20.',
  marks: `Town money. A paid run brings home 3 marks per wave cleared plus 1 per 20 scrip held, and ${pct(HAZARD_MARKS)} more per hazard level. Market sales and salvage pay marks too.`,
  raws: `Timber, ore and hide. Work trees, ore seams and carcasses in a run to break them into raws. Win and you keep all you hold. Die and you keep ${pct(DEATH_RAW_KEEP)}, plus whatever the mule took home.`,
  timber: 'A raw. Comes from trees in a run.',
  ore: 'A raw. Comes from ore seams in a run.',
  hide: 'A raw. Comes from carcasses in a run.',
  node: 'A tree, ore seam or carcass on the field. Stand inside its ring to work it. When it breaks it drops raws.',
  wave: `A run is ${RUN_WAVES} waves. Survive the clock to clear a wave, then the bench opens.`,
  hazard: `How hard a run is. Each level has tougher waves and pays ${pct(HAZARD_MARKS)} more marks. Win at a level to open the next one for that character.`,
  level: 'Picking up scrip also fills the level bar. Each level gives one upgrade pick at the bench.',
  bench: 'The stop between waves. Take a level-up, buy from four offers, fuse two items on the anvil, or send raws home with the mule.',
  anvil: 'Two different items go on, both are used up, and one new, stronger item comes off. The same pair always makes the same item for everyone.',
  untried: 'A pair nobody in the world has struck yet. Striking it invents a new item, and your name goes on that recipe for good. You get a few each day. Known recipes are unlimited.',
  known: 'A pair someone has already struck. It always makes the same item, and you can strike it as often as you like.',
  firstMade: 'The first player in the world to strike this pair. Their name stays on the recipe for good.',
  firstFind: 'A pair you struck before anyone else in the world. Your name is on it for good.',
  benchRecipe: 'A plain item from the bench offers. No player made it.',
  budget: 'How strong the result can be: about the two items’ strength added together, with a little extra. It sets the tier that comes off.',
  tier: 'How strong an item is, one to four notches. Fusing makes higher tiers. Tier 4 is finished and cannot be fused again.',
  relic: 'Extremely rare. Found in runs, never made. A relic does not wear out, cannot be fused, and is numbered in the order it was found.',
  charges: `An item comes home with ${KIT_CHARGES} charges. Each run you pack it for spends one, and at none it is gone. Mend in the stash puts a charge back, up to ${REPAIR.perItem} times per item.`,
  kit: `Up to ${KIT_SLOTS} stash items you take into the next run. They are packed down to the hazard’s strength cap and stay off the run anvil.`,
  stash: `Items you brought home. It holds ${STASH.base} to start; buy shelves for more. Relics do not take room.`,
  mule: 'Sends raws home now, safe even if you die. They leave this run, so you cannot spend them at the bench.',
  reroll: 'Swap the four offers for new ones, for scrip. A locked offer stays.',
  lock: 'Keeps an offer, at its price, when you reroll.',
  scrap: 'Sell an item or weapon back for some scrip.',
  carry: 'Items bought or made in a run that you take home to your stash. One for every four waves cleared.',
  factor: 'The town’s trader. He buys and sells raws for marks at his own prices, which follow trade, and only trades so much in a day.',
  factorPays: 'What the Factor gives you for each unit you sell him.',
  factorAsks: 'What the Factor charges for each unit you buy from him.',
  post: `Put an item up at your price for other players. It leaves your stash until it sells or you withdraw it. Posting costs ${pct(LISTING_FEE)}, and a sale pays ${pct(SALE_TAX)} tax. Opens after ${LISTING_MIN_RUNS} runs.`,
  lot: 'Raws you post at a price for each unit. Players buy from it.',
  order: 'Raws you want, at a price for each unit. The marks are set aside when it goes up, and players sell into it.',
  salvage: 'Break an item for a few marks. It is gone for good.',
  townProject: 'One station the whole town is raising. Raws given by any player count, and so does half of the market tax.',
  station: 'A town building every player shares. Higher tiers pay more raws from each node, and the Assay office allows more untried pairs a day.',
  standing: 'Everything you have given to the town project. It ranks you under Who gave.',
  daily: `${DAILY_WAVES} waves, the same for everyone today. Your first try is scored and paid. After that you can practise as often as you like, unpaid.`,
  practice: 'Play today’s daily again. Not scored and not paid.',
  codex: 'Every recipe the town knows, and who found it first.',
  twist: 'Each character plays a little differently. New ones head out after more runs.',
} as const;

export type GlossKey = keyof typeof GLOSS;

/** Names for the almanac's word list, in reading order. */
export const GLOSS_WORD: Record<GlossKey, string> = {
  scrip: 'Scrip', marks: 'Marks', raws: 'Raws', timber: 'Timber', ore: 'Ore', hide: 'Hide', node: 'Node', wave: 'Wave',
  hazard: 'Hazard', level: 'Level', bench: 'Bench', anvil: 'Anvil', untried: 'Untried pair', known: 'Known recipe',
  firstMade: 'First made by', firstFind: 'First find', benchRecipe: 'Bench recipe', budget: 'Budget', tier: 'Tier',
  relic: 'Relic', charges: 'Charges', kit: 'Kit', stash: 'Stash', mule: 'Mule', reroll: 'Reroll', lock: 'Lock',
  scrap: 'Scrap', carry: 'Carry home', factor: 'The Factor', factorPays: 'Factor pays', factorAsks: 'Factor asks',
  post: 'Post', lot: 'Lot', order: 'Order', salvage: 'Salvage', townProject: 'Town project', station: 'Station',
  standing: 'Standing', daily: 'Daily clearing', practice: 'Practice', codex: 'Codex', twist: 'Twist',
};

/** What each stat does, before any numbers. */
export const STAT_MEANING: Record<StatId, string> = {
  maxHp: 'Most health you can have.',
  mend: 'Health you get back each second.',
  armor: 'Takes a share off every hit.',
  dodge: 'Chance that a hit misses you. At most 60%.',
  speed: 'How fast you move.',
  damage: 'Raises all damage you deal.',
  melee: 'Flat damage added to close weapons.',
  ranged: 'Flat damage added to shooting weapons.',
  rate: 'How often your weapons attack.',
  crit: 'Chance that a hit deals double.',
  reach: 'Weapon range. Melee gets half.',
  harvest: 'How fast you work nodes, and every 10 adds a raw per node.',
  luck: 'Rarer offers at the bench.',
};
