# Pivot plan: from wave arena to a gathering and crafting world

Status: proposal, nothing built. Research behind it is in this folder:
`research-new-world.md`, `research-comparables.md`, `research-ai-economy.md`.
Caveat on the research: most wikis and dev blogs were blocked by this
session's network rules, so numbers come from search summaries or memory and
are marked as such in those files. They are good enough to design from, not
to quote.

## What the research says

1. **New World's pull is a handful of cheap mechanics, not its 3D world.**
   Dense nodes on every path; one skill bar per gathering verb that ticks on
   every action; locked nodes you can see with the level on them; tools that
   make you faster; a tier chain where high-tier goods eat low-tier goods; a
   craft screen that shows the outcome range and lets preparation move it;
   a town whose stations level from hand-ins; a house that is a rack of
   buff trophies; recipes found as drops; very good strike sounds.
2. **Its failures are avoidable.** A player market as the only source of
   value (it deflated to barter), dupes, the grind wall at mid skill levels,
   perk lottery on top of long grinds, encumbrance, travel time, upkeep taxes.
3. **The best-liked small games alternate calm and combat; they do not layer
   them.** Our current run layers them: gathering happens under full attack,
   and it is the top killer of new players. Calm should be really calm,
   bursts short (20-90 s per 2-5 min), and the player should choose the dose.
4. **Sessions need an end.** A fully open world has none, which is bad on a
   phone. Expeditions of 6-12 minutes with a clean exit fit.
5. **AI content works when it becomes a small permanent fact the player
   caused and owns** (a discovery with their name on it). It feels hollow as
   chat or ambience. It stays safe when the model only chooses from a closed
   vocabulary and code owns every number, which we already do.
6. **Two economy risks are new with persistent gear.** Each discovery can
   only raise the best item, so power creeps; and our fusion budget rule,
   (A + B) x 1.4, becomes a power faucet. Tier must come from materials and
   station, not from chaining fusions.

## The proposed game

You live in a town at the edge of a country of five zones. You go out on
expeditions to gather, open chests and fight what guards them; you come home,
refine and craft at stations the town has built, fill your house, and take on
a harder zone.

### The loop

- **Expedition (6-12 min).** Pick a zone on the map. You start at a camp.
  Nodes are everywhere: trees, ore, plants, carcasses from kills. The first
  minutes are quiet. Rich nodes and chests have guards. A threat meter rises
  with time and with noisy work; when it fills, the woods wake and packs hunt
  you. Leaving is your call:
  - walk out at a camp: keep 100% of the bag;
  - recall from the field: keep 60%;
  - die: keep 30%.
  The pressure the owner finds "engaging but too much" becomes the last third
  of an outing, and the player decides how long to stay in it.
- **Town (as long as you like).** Refine, craft, hand in to town projects,
  take commissions, trade, furnish the house.

### Zones that reshuffle, and charts that hold a place still

Decided by the owner: zones reshuffle. A zone keeps its identity (tier, node
kinds, creatures, look) but its layout is new on every outing. Variety comes
free, and no route goes stale.

What reshuffling loses is "I know a spot". **Charts** give it back. A chart
is an item that names one composed place and is good for three visits; while
you hold it, that place stays exactly as it was. Charts drop from chests and
bosses, are sold by the Factor, and can be traded. See "Where the AI goes".

| Zone | Tier | Nodes first seen | Gate to enter |
|---|---|---|---|
| Home wood | 1 | green wood, iron, flax, small game | none |
| Fen | 2 | aged wood, silver, reed, boar | home wood boss key, or Logging 10 |
| Highland | 3 | hardwood, starmetal-like ore, wool | two gates, either one |
| Burn | 4 | ironwood, deep ore, fire plants | two gates, either one |
| Old forest | 5 | the rare tier, relic chests | two gates, either one |

Each outing also holds a few nodes one tier above the zone, visible with
"Mining 20" on them. A zone is about 4 x 4 phone screens, with landmarks,
2-3 camps, 6-10 chests and one boss.

### Gathering and trade skills

- **Four gathering skills:** Logging, Mining, Harvesting, Skinning.
- **Four crafting skills:** Smithing (weapons, tools), Outfitting (armour,
  bags, trinkets), Cooking (food buffs, luck food), Joinery (furniture,
  trophies, storage).
- Levels 1-50 each. Every action ticks the bar. Every 1-2 levels unlocks
  something: a node tier, tracking on the compass strip, a recipe, a yield
  bonus. A level must always fit in one sitting; that is the rule that avoids
  the grind wall.
- **Tools change speed, never permission** (roughly x1, x1.25, x2.5, x4).
- **Rare siblings:** any node can drop its rare (resin, gems, a perfect hide)
  on a luck roll that food, tool perks and trophies raise.
- **Tier chain, kept shallow:** a tier-N refined good takes 2-3 tier-(N-1)
  refined goods plus new raws plus one cross-skill input (charcoal, flux).
  Low tiers stay wanted without a pyramid.

### Chests, schematics and loot

- Chests are seeded with the zone: common ones respawn, landmark ones are
  guarded, one per zone opens only with the boss key.
- They hold materials, the odd made item, and **schematics**: recipes as
  items, learned on use, with "?/N known" always shown. Schematics are
  tradeable and can be donated to a town station so everyone can use them.

### Your character

- One persistent character (the six current characters become starting
  backgrounds). Level 1-30 from everything you do, with points in a few
  attributes.
- Gear slots: weapon x2, tool x3, armour, trinket x2, bag. Gear is crafted;
  drops are the exception.
- Two short weapon mastery lines to give crafted weapons a purpose.
- No between-wave shop. Temporary power on an expedition comes from food you
  cooked and shrines you find.

### Town and stations

- Stations: sawmill, smelter, loom, tannery, forge, kitchen, joiner's shop,
  assay. Each has tiers 1-5 and is raised by hand-ins, by one player in a
  solo world and by everyone in a shared one. Station tier sets the highest
  tier you can refine or craft there.
- A board with 3-5 rotating requests ("the smith needs 20 iron bars") that
  pay coin and town standing. Standing levels give a pick-one permanent card.
- The craft screen shows the outcome range and what would move it (food,
  outfit, station tier, trophy, material quality). You choose the main perk;
  no lottery.

### House

- A plot bought with coin, with three sizes.
- Storage chests, five trophy slots (narrow buffs: +luck in Mining, +yield
  from boars, +craft quality in Smithing), free recall home.
- Furniture from Joinery raises comfort; comfort gives a rested buff on the
  next expedition, scaled by variety rather than count.
- A shelf for relics and your world-first discoveries.

### Where the AI goes

The first draft used the model for names and flavour. This draft gives it
three jobs the game cannot do without it. The rule under all of them is
unchanged: the model composes from closed kits, code builds and counts.

1. **It composes the places you go.** Every chart is written by the model
   from a kit: a landmark set, a node mix, what guards it, a named boss with
   two or three moves from the move list, and one or two twists ("flooded:
   reed everywhere, ore scarce, boars slow"). Code prices each twist, so a
   harder chart always pays more and none pays out of band. A chart is
   therefore a small unique place with a name, a reason and a trade value.
   In a shared world the week's charts are the same for everyone, so "the
   Sunken Orchard is out this week" is something players talk about.
2. **It decides what materials make.** Materials carry properties (iron:
   hard, heavy; reed: light, supple; saltglass: brittle, bright). Rare nodes
   yield invented materials whose name and properties the model picked from
   the property list. At a station you choose materials and one of three
   directions the model offers for that set ("a blade", "a hook", "a
   charm"); it then spends the tier's budget on effects that follow from the
   properties. The first maker names it and owns the schematic. Crafting
   becomes experiment: what does saltglass do in a hatchet? Nobody knows
   until someone tries, and then the whole world knows.
3. **It runs the country.** Each week code picks levers that net to zero
   (one material scarce, one creature rabid, one station paying more) and
   the model turns them into one event with a cause, a board of requests
   that follow from it, and the rumours that point at charts. Townsfolk
   commissions come from the same event and are graded by the model on a
   four-step fit scale; code pays.

Smaller uses that ride on these: item histories built from real events, and
a house visitor's remark on what you display.

What keeps this safe: invented materials belong to a fixed tier and family
and stand in for the common material in basic recipes, so the market does
not fragment; twists, moves, properties and effects are closed lists;
players never type text the model reads; one answer per key is stored for
the world.

Offline play ships a pack of pre-composed charts, materials and events plus
the procedural generator. The game is complete with the model off; it is
less surprising.

### Economy rules

- The model chooses, code counts. Yield, price and drop effects are not in
  the model's vocabulary.
- Tier comes from materials and station; nothing chains upward.
- Nothing generated is a faucet. Every craft eats inputs and a fee, and an
  item always salvages for less than it cost.
- The market trades a fixed set of goods: materials, reagents, schematics.
  Made items are salvageable so they never need their own market.
- The Factor stays as the NPC price floor and ceiling on materials, with
  saturation. This is what New World lacked at launch.
- The best gear is made or commissioned, never bought outright.
- Sinks are things players want (station tiers, house, tools), not upkeep
  taxes. Faucets and sinks are measured with bots from the first build, as
  we do today.
- Leave out: encumbrance, travel cost, weekly taxes, daily lockouts,
  first-come shared nodes.

## What happens to the current game

- **Kept:** item and effect vocabulary and budgets; the provider interface
  and procedural fallback; market, Factor, ledger; town projects; relics;
  almanac; solo world and offline; tooltips; replay checking (generalised);
  enemies, weapons, stats, the node-work model; art and sound kits.
- **Replaced:** the fixed arena and lanes; the 12-wave script; the
  between-wave bench; scrip as a run currency; per-wave payout caps; the
  hazard ladder.
- **The horde survives** as what the full threat meter brings, as zone
  bosses, and optionally as a separate "stand" at the camp for players who
  want the old pace.
- **Saves are reset.** There is no player base, so no migration.

## Build order, with a test at each step

Each step ends with something playable on the Pages link and a question to
answer before going on.

1. **One zone, calm then threat.** A reshuffling home wood, three node kinds in
   two tiers, the four gathering bars, a bag, the threat meter, camps and the
   100/60/30 rule. Town unchanged. *Question: is ten minutes of this more
   fun than a run, on the phone?* If not, stop and rethink before building
   anything else.
2. **The chain.** Refining, station tiers, tools, Smithing and Cooking, the
   craft screen with a range. Character level and gear slots. The bench
   goes. *Question: do you always know what you are gathering for?*
3. **Finds.** Chests, schematics, rare siblings and luck, discovery at
   stations with naming, commissions. *Question: does an outing surprise
   you?*
4. **The country.** Zones 2 and 3 with bosses and gates, tracking, the
   house with trophies and Joinery. *Question: does a new zone re-value the
   old ones?*
5. **The economy.** Bot-measured faucets and sinks, the board and standing,
   rumours, shared-world rules. Zones 4 and 5. *Question: does anything
   pile up unused or run dry?*

## Decisions for the owner

1. **Is the AI's role now strong enough?** It composes places, decides what
   materials make, and runs the weekly event. The alternative I held back is
   free text: you tell the smith what you want in your own words. It is the
   most "AI" option and the hardest to keep fair and safe.
2. **How much of the horde to keep?** As proposed it is the end of an outing
   and the bosses. The alternative is to keep the current run as a second
   mode, which doubles what has to be balanced.
3. **Is step 1 the right first test?** It is the cheapest way to find out
   whether calm gathering in 2D holds your attention before the rest is
   built.
