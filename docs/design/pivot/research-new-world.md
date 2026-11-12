# Research: how New World's gather / craft / town loop works, and why it feels good

Written 2026-11-12 for the pivot. Subject: Amazon Games' *New World* (launched
28 Sep 2021) and its relaunch *New World: Aeternum* (15 Oct 2024).

## How to read this file

- **[S]** = confirmed by a web search result in this session (source listed at
  the end). **[M]** = from general knowledge of the game, not re-verified today;
  treat the exact number as approximate.
- **Limit of this research:** only search-result summaries were reachable. Direct
  page fetches of every wiki and dev blog (newworld.com, nwdb.info,
  newworld.fandom.com, fextralife, icy-veins, studioloot, wikipedia) were blocked
  by the session's network allowlist, so no table was read first-hand. Where two
  sources disagreed I say so instead of picking one silently.
- Numbers changed a lot across patches (launch 2021, Brimstone Sands 2022, Rise
  of the Angry Earth 2023, Aeternum 2024). For a design reference the *shape*
  matters more than the patch-exact value.
- **Status of the game:** content development stopped after Season 10 /
  Nighthaven (announced Oct 2025); the game was delisted on 15 Jan 2026 and
  servers are scheduled to shut down on 31 Jan 2027 [S]. The wikis may not outlive it — copy any
  table you need soon.

---

## 1. Zones and territories

**Structure.** The island is cut into territories. Most have exactly one
settlement (town) with the full set of stations, a storage shed, a trading post,
town board and houses; a few endgame territories (Shattered Mountain, Edengrove,
Great Cleave at launch) have only outposts and cannot be owned [S]. 14
territories at launch [S]; Brimstone Sands (2022) and Elysian Wilds (2023, which
replaced First Light) were added later [M].

**Level bands** (guides disagree by a few levels; this is the consensus shape):

| Band | Territories | Confidence |
|---|---|---|
| 1-25 | Windsward, Monarch's Bluffs, Everfall, First Light (four starter zones, player is dropped on a random beach) | [S] |
| ~25-40 | Brightwood (26/27-35), Cutlass Keys (25-40 depending on source), Weaver's Fen (30-40) | [S] |
| ~40-50 | Restless Shore, Mourningdale, Great Cleave | [S] |
| 51-60 | Ebonscale Reach, Reekwater, Edengrove | [S] |
| 60+ | Shattered Mountain (elite endgame zone), Brimstone Sands, Elysian Wilds (60-65) | [S]/[M] |

**How resource tiers map to zones.** Tier 1-2 resources (iron, green wood, hemp,
rawhide, flint, bushes) are everywhere in starter zones. Each band adds the next
tier: silver/gold and aged trees in mid zones; starmetal, wyrdwood and silkweed
from roughly the 25-45 zones upward, typically on mountains and in dangerous
pockets; orichalcum, ironwood and wirefiber only in the 50+ zones and elite
areas [M]. Crucially the low tiers never stop being needed (see section 3), so
high-level players keep coming back through starter zones.

**Landmarks and elite areas.** Each territory is dotted with named points of
interest (farms, mines, ruins, forts, shipwrecks) that show on the map only after
you walk there. Supply chests cluster in abandoned villages and mines, ancient
chests in ruins [S]. Elite areas (Myrkgard and others in Shattered Mountain,
Malevolence in Edengrove, Imperial Palace in Ebonscale, Forecastle Drift in
Reekwater) are group-scaled POIs with elite chests and named bosses [M].

**What pulls a player into a new zone** — in rough order of strength:
1. A resource you can now gather but cannot find at home (your Mining hits 100,
   starmetal is in the next band).
2. The main quest and a new town's quests/town board.
3. Fog-of-war map: POIs and fast-travel shrines only unlock by visiting.
4. A different town's station tiers, taxes and prices (launch era).
5. A second and third house slot, and territory standing starting again at zero.
6. Elite chests and expeditions that drop the next gear band.

---

## 2. Gathering

**The five gathering skills** [S]: Mining (pickaxe), Logging (axe), Harvesting
(sickle), Skinning (knife, "Tracking & Skinning"), Fishing (rod). Each has its
own tool, its own skill bar and its own luck stat.

**Node families**
- *Ore veins:* iron, silver, gold, platinum, starmetal, orichalcum (later
  mythril). Also stone boulders, lodestone, saltpeter, oil seeps, crystal/gem
  deposits [S]/[M].
- *Trees:* young/mature (green wood), aged, wyrdwood, ironwood (later runewood);
  dead trees and bushes are harvestable with no skill [M].
- *Plants:* hemp, silkweed, wirefiber (fibers); farm crops; herbs; "magical"
  elemental plants [S].
- *Hides:* every animal is a node after you kill it; prey/predator size classes.
- *Fishing:* any water, plus hotspots.
- *Motes/essences:* five elements (fire, water, earth, air, soul plus life/death)
  come from magical plants (Harvesting 30+), magical creatures and alchemy stones
  (Mining 50+), used for Arcana and weapon/armour perks [S].
- *Size classes:* most nodes come small / medium / large; bigger takes longer,
  yields more, respawns slower [S].

**Skill gates: "can gather at X, shows on compass at X+25"** — this pairing is
one of the most copyable ideas in the game.

| Resource | Gather at | Track on compass at | Conf. |
|---|---|---|---|
| Iron | 0 | 25 | [S] |
| Silver | 10 | 35 | [S] |
| Gold | 45 | 70 | [S] |
| Starmetal | 100 | 125 | [S] |
| Platinum | 110 | 135 | [S] |
| Orichalcum | 175 | 200 | [S] |
| Green wood (young/mature) | 0 | — | [M] |
| Aged wood | ~50 | ~75 | [M] |
| Wyrdwood | 100 | 125 | [S] |
| Ironwood | 175 | 175-200 (sources differ) | [S] |
| Hemp | 0 | 25 | [S] |
| Silkweed | 100 | 125 | [S] |
| Wirefiber | 175 (one source says 150) | 200 | [S] |
| Skinning: small prey / medium / large prey | — | 25 / 50 / 75 | [S] |
| Skinning: small / large predators | — | 125 / 175 | [S] |

Trade skills capped at 200 at launch and 250 from Rise of the Angry Earth [S].

**Tools.** Five tiers — flint, iron, steel, starmetal, orichalcum (later
mythril). Gathering speed: 100% / 125% / 250% / 400% / 625%, mythril 850-1100%
[S]. Tools are crafted (Engineering 0/0/50/100/150) and gated by character level
(steel ~17, starmetal ~37, orichalcum ~60) [S, sources vary]. Tools roll perks:
yield (+10-19%), luck (+2-9.3% rare chance), "alignment" perks that drop motes,
and Azoth extraction [S]. Tool tier does **not** gate what you can gather; skill
level does. The tool only makes it faster. That keeps the gate legible (one
number) and the tool a pure quality-of-life upgrade you feel in your hands.

**Respawn.** Timer per node, longer for larger and rarer nodes. Orichalcum:
small ~17-24 min, medium 21-30, large ~24-34 [S]. Iron is quoted anywhere from
8-16 to 21-40 min depending on source and patch [S, conflicting]. Nodes are
shared and first-come: a mined vein is gone for everyone. Fishing hotspots:
broad (1 star) ~15-30 min, rare (2 star) ~30-45, secret (3 star) ~45-90 [S].

**Luck and rare drops.** Community-reverse-engineered model: each gather rolls
0-100,000, your luck is added, and each rare has a threshold (legendary hide from
a boar needs 101,150, i.e. impossible without luck) [S]. 1% luck = 1,000 points
[S]. Sources stack additively: food (+20% for tier 5), each trophy (+5% minor,
+10% basic, +15% major), tool perk, armour perks, amulet/charm [S]. Gathering
luck is per skill and separate from combat/chest luck [S]. A player killed 1,000+
boars to show luck works: 7.5% observed vs 8.44% predicted [S].
- Every base resource has rarer siblings from the same node: *fae iron*,
  *voidmetal*, shards/gems from ore; *petrified wood*, *whisperwood*, later
  *glittering ebony* inputs from trees; *wildwood/barbvine*-type rares from
  wood; *scarhide, smolderhide* from hides; *silk threads/wireweave* from fibers
  [M]. These are the "+gear score" ingredients (section 3).
- Void ore from orichalcum: about 0.0045% with no luck, ~0.105% at +5,000 luck
  — a ~23x multiplier from investment, but still a jackpot [S].
- Devs acknowledged petrified wood/whisperwood were "way too rare" early on [S].

**Fishing.** Cast-and-tension minigame; hotspots are visible splashing circles
with a finite fish count (broad ~30 fish), star tiers gated by Fishing skill,
bait modifies rarity, treasure chests can be hooked [S].

**Why the act itself is satisfying**
- *Sound.* Widely singled out. Each ore type has its own strike sound; the same
  swing echoes in a cave and dies away in open air; chopping carries across a
  valley and you can locate other players (and nodes) by ear [S]. One reviewer
  titled a piece "New World's sound design makes me want to mine rocks forever";
  another had played MMOs muted for 15 years until this game [S].
- *Animation and physics.* Trees crack, lean and fall; boulders split; the
  character does 3-6 visible swings, then a burst of item toasts.
- *Feedback stack per node:* resource count + possible rare + skill XP bar tick +
  character XP + territory standing XP. Five numbers move from one action.
- *The world is the UI.* Nodes are real objects you learn to spot by silhouette
  and colour (a blue-grey starmetal vein on a cliff), before the compass ever
  helps.

---

## 3. Refining and crafting

**Trade skills (17 at launch)** [S]
- Gathering (5): Mining, Logging, Harvesting, Skinning, Fishing.
- Refining (5): Smelting, Woodworking, Leatherworking (Tanning), Weaving,
  Stonecutting.
- Crafting (7): Weaponsmithing, Armoring, Engineering, Jewelcrafting, Arcana,
  Cooking, Furnishing.
- Later "casual" additions: Music (2022), Riding (2023) [S]/[M].

Each is an independent 0-200 (later 0-250) bar. XP per action scales with the
tier of the item. Past the cap, **Aptitude** keeps the bar looping: every full
loop has 3 markers, each granting a skill-specific reward crate [S].

**The tiered chain (the single most important mechanic).** Higher-tier refined
goods consume the previous tier's *refined* good plus new raw material plus a
reagent:

| Tier | Ingot | Recipe | Smelting | Conf. |
|---|---|---|---|---|
| 2 | Iron | 4 iron ore | 0 | [S] |
| 3 | Steel | 3 iron ingot + 2 charcoal + 1 flux | 50 | [S] |
| 4 | Starmetal | 6 starmetal ore + 2 steel ingot + 2 charcoal + 1 flux | 100 | [S] |
| 5 | Orichalcum | 8 orichalcum ore + 2 starmetal ingot + 2 charcoal + 1 flux | 150 | [S] |
| 5+ | Asmodeum (legendary) | 5 orichalcum ingot + rare drops + reagents, daily cooldown at launch | 200 | [M] |

One orichalcum ingot therefore contains 8 orichalcum ore + 12 starmetal ore + 12
iron ore + 6 charcoal (wood) + flux. Wood (green wood -> timber -> lumber ->
wyrdwood planks -> ironwood planks), leather (rawhide -> coarse -> rugged ->
layered -> infused) and cloth (fibers -> linen -> sateen -> silk -> infused
silk) follow the same pattern [S for wood, M for the rest]. Charcoal ties wood
into metal; cross-dependencies like this make every gathering skill matter to
every crafter.

Consequences: (a) low-tier nodes never become worthless to *use*; (b) the
quantity pyramid is steep, which is where the grind complaints come from; (c)
reagents (flux, tannin, sandpaper, weave, solvent) were not gatherable — they
came from supply chests and the faction shop — and became the launch-era
bottleneck [M]. Higher refining skill and gear give a chance of bonus output [S].

**Stations.** Smelter, woodshop, tannery, loom, stonecutter, forge, workshop,
outfitting station, arcane repository, kitchen; a personal camp covers basic
cooking/tools/ammo [S]/[M]. Stations had tiers 2-5 at launch and a recipe
required both your skill level and the station tier (e.g. orichalcum tools: Tier
5 workshop + Engineering 150) [S; sources conflict on exact tiers].

**Gear score.** The universal item-power number. Tiers I-V; Tier V base is 500
[S]. Cap was 600 at launch (625 with umbral shards in 2022), 700 with Rise of the
Angry Earth, 725 in Aeternum [M]. A craft shows a **range** before you commit,
and everything you prepare moves the range:

| Source | Effect on roll | Conf. |
|---|---|---|
| Skill level | up to +25 to max | [S] |
| Better/rare materials | each secondary tier +/-5 to min; rare raw +5, rare refined +15 (up to ~+45) | [S] |
| Crafting food | +15 min and max | [S] |
| Crafter armour set + earring | +15 min and max | [S] |
| Trophies (3 houses) | +5 min each, +15 total | [S] |
| Town buff | +5 min (sources disagree) | [S] |
| All stacked | 595-600 (590-600 without town buff) | [S] |

**Perks, attributes, mods, Azoth.** A finished item rolls an attribute split, up
to several perks and maybe a gem socket; rarity colour is simply how many of
those it got [M]. Three levers reduce the randomness:
- *Azoth* (a capped magical currency also spent on fast travel and respecs):
  spending it raises the chance of extra perks/attributes/sockets [S].
- *Craft mods* (special resources, mostly drops from chests and elites): slot one
  to guarantee a specific perk or attribute; it also lowers the Azoth needed [S].
- *Late additions:* Timeless Shards (fixed attribute + one perk, mod slot still
  open), Golden Scarab (choose an attribute), Runestone Stopwatch (choose a perk,
  598-600 roll), Prismatic Scarab (guaranteed 700 and chosen perks, weekly
  cooldown) [S]. The direction over five years was steadily *away from pure RNG
  toward chosen outcomes behind time-gates*.

**Schematics / patterns / recipes.** Most recipes come with skill level. The
exciting ones are items: you find a schematic, salvage it, and the recipe is
learned permanently (even before you can craft it) [S]. They drop from supply
crates, ancient coffers/urns, elite chests and bosses, and are tradeable [S]. The
famous one: the Orichalcum-Braced Storage Chest schematic, from elite chests in
50+ zones at a tiny rate, or a 25% chance from a furnishing package to get 1-2
out of a pool of 227 schematics [S]. Named weapon patterns and armour "pattern"
drops work the same way.

**Crafting bonuses from outside the bench** (the "preparation ritual"): eat the
food, put on the crafter set, be in a town with the buff, own the trophies. Each
is its own small project owned by a different trade skill [S].

---

## 4. Town

**Stations and town projects.** Every station in a town has its own tier. The
company (guild) that owns the territory picks upgrade projects on the Territory
Planning Board; each station upgrade is one project; all players then fill it by
handing in items and doing tasks at the **Town Project Board** [S]. Settlement
tier goes Village -> Town -> City -> Capitol; upkeep is due every 7 days and
unpaid upkeep or a lost Corrupted invasion downgrades things [S]. Later (2023)
stations were flattened to max tier everywhere and projects became temporary
"lifestyle" buffs — the tier lottery between towns was judged more annoying than
interesting [M].

**Town board missions.** "Bring 20 iron ingots / 15 rations / kill 8 wolves."
They pay coin, character XP and large territory-standing XP; board refreshes
about every 30 minutes with 3-5 offers; you can pre-craft or simply buy the goods
at the trading post [S]. This is the game's main "the town wants things from
you" loop, and the best levelling route for crafters.

**Territory standing.** A per-territory reputation bar (cap 300) fed by anything
you do there. Every level you pick one permanent card: +storage, +gathering
speed, +XP gain, +standing gain, -trading tax, -property tax (5% per pick),
-crafting fee; house ownership unlocks at standing 10 [S]. It makes a zone feel
like *yours* and gives returning to an old zone a reason.

**Storage sheds.** One per settlement, **not shared between towns** at launch,
1,000 weight each, expandable by standing cards and house chests. Moving goods
between sheds costs coin scaled by weight and only works between towns your
faction controls [S]. Later patches let you see and pull from all sheds [M].

**Taxes.** The owning company sets trading tax, crafting/refining fee and
property tax within developer bands; revenue pays town upkeep and company income
[S]. Trading tax was 2.5% and doubled to 5% in a late-2021 patch [S]. Housing tax
bands after patch 1.3: base 2.5-10% of house price per week, 5% default [S].

**Trading post.** Player-to-player order book: *sell orders* and *buy orders*.
Listing fee paid up front, scaling with duration (max shortened from 28 to 14
days); transaction tax charged on sale; expired goods return to that town's shed
[S]. At launch every town had its own separate market, so prices differed by town
and hauling goods was a profession. From patch 1.1 (18 Nov 2021) **all trading
posts were linked**, officially "to strengthen the economies of less-travelled
territories and ensure item availability" [S]. Traders lost the arbitrage game;
edge-of-map towns got usable markets [S]. Trading post was also locked behind
early quest progress to slow bots [S]. There is no NPC vendor buying goods, so
nothing sets a price floor [S].

---

## 5. Housing

| Tier | Price | Standing | Storage chests | Recall cooldown | Conf. |
|---|---|---|---|---|---|
| I | 5,000 | 10 | 1 | 4 h | [S] |
| II | 10,000 | 15 | 2 | 3 h | [S] |
| III | 15,000 | 20 | 3 | ~2.5 h | [S]/[M] |
| IV | 20,000 | 30 | 4 | ~2 h | [S]/[M] |

- Up to 3 houses, unlocked at character levels 15 / 35 / 55; first house 50%
  off (purchase only, not tax) [S]/[M].
- **Weekly property tax**, about 5% of price by default (125-500 for Tier I up
  to 500-2,000 for Tier IV across the band); period lengthened from 5 to 7 days
  [S]. Not paying never loses the house: it switches off decorating, trophy
  buffs and house recall until you pay [S]. Early complaint: 2,000/week for a
  20k house [S].
- **Recall:** free teleport to each house on a cooldown — in a game with costly
  fast travel this is the practical reason to buy [S].
- **Storage chests:** crafted furniture that adds weight capacity to that town's
  shed (roughly 200-600 each by tier) [S].
- **Trophies:** 5 per house, crafted by Furnishing from rare drops. Minor /
  basic / major = +500 / +1,000 / +1,500 luck for a gathering skill, or +5 min
  gear score for a crafting skill, or combat bonuses vs an enemy family; they
  stack across the three houses [S]. Trophies turn "decorating" into the
  best-in-slot long-term goal for gatherers and crafters.
- **Furnishing** is a full 0-200 skill; furniture is tradeable; houses are
  instanced (everyone owns "the same" house) with a visible-to-visitors ranking
  by decoration score [M].

---

## 6. Loot

- **Supply chests** (crates, caches, stockpiles; in villages, camps, mines):
  consumables, refining reagents, tools, low gear, schematics [S].
- **Ancient chests** (coffers, urns; in ruins): arcane materials, motes, gems,
  schematics [S].
- **Elite chests** (elite POIs, guarded): best open-world source of gear,
  expertise bumps, umbral shards, craft mods, trophy materials. Each elite chest
  lootable once per 24 h (reset ~5 am) [S]. This produced the "chest run": 20-50
  players sweeping a zone on a fixed route [S].
- **Named items:** fixed-perk uniques from specific bosses/expeditions; later
  "artifacts" with a unique rule-changing perk and a quest chain to upgrade [M].
- **Luck:** separate *loot luck* (gear, bags, food, PvP flag bonus) applies to
  kills and chests; gathering luck does not cross over [S].
- **Daily/weekly limits** became the main pacing tool: elite chests, gypsum
  types, top-tier refined materials, prismatic crafts [S]/[M].

---

## 7. Character progression

- **Level:** 1-60 at launch, 65 from 2023 [M]. About 190 attribute points by 60
  [S].
- **Attributes:** Strength, Dexterity, Intelligence, Focus, Constitution.
  Thresholds every 50 points grant a combat bonus *and a gathering bonus*: 50 STR
  mining speed, 50 DEX skinning speed, 50 INT harvesting speed, 50 CON logging
  speed, 50 FOC fishing tension; 300 STR 25% chance to mine in one swing [S].
  Respec is cheap. Combat build and gatherer build pull against each other, so
  people keep a "gathering set".
- **Weapon mastery:** classless. Each weapon type levels 1-20 by use; ~19 points
  across two trees; three active abilities slotted; two weapons equipped [S].
- **Gear score / expertise:** at 60 a per-slot "high watermark" (renamed
  Expertise, Dec 2021) rose a few points at a time from drops; items above your
  expertise were scaled down. Players were furious because it devalued crafted
  and bought gear ("crafting worthless") [S]. Reworked repeatedly and eventually
  dropped [M].
- **Faction rank and territory standing** are two further long bars.

Count the parallel bars at endgame: 1 level, ~15 weapons, 17+ trade skills, 15+
territory standings, faction rank, per-slot expertise. Roughly 50+ independent
progress bars, and nearly any action moves three of them.

---

## 8. Economy: what worked, what broke, what Amazon changed

**Design intent.** Player-driven: nearly every item is gathered or crafted by a
player; no NPC buys your goods; coin enters through quests, town board, kills,
salvage; coin leaves through taxes, house tax, repairs, crafting fees, respecs,
fast travel (Azoth), listing fees [S].

**Failures, in order**

1. **Launch deflation (Oct 2021).** Sinks outran faucets. Coin was scarce, goods
   were abundant (everyone gathers, nobody *needs* to buy), and with no vendor
   floor raw material prices slid toward the 0.01 minimum. Players bartered
   ("1,000 linen for 600 ore and 20 eggs"); professions could not earn [S].
   Amazon first said the economy was "performing within acceptable levels" with
   players net-positive daily but trending down [S]; patch 1.0.5 then raised coin
   rewards, removed coin cost from repair kits and adjusted Azoth costs [S].
2. **Dupes (Oct-Nov 2021).** A server-transfer gold dupe, then others; Amazon
   switched off *all* wealth transfer (trading post, player trade, coin mail,
   company treasuries) more than once. Players could not pay taxes or fund town
   upgrades; a compensation bug then created a new dupe [S]. Housing tax was cut
   90% for a month as redress, then halved permanently in 1.3 [S]. Lesson: an
   economy with one fragile currency and no offline fallback amplifies every bug.
3. **Raw materials worthless, reagents priceless.** Everybody can gather
   everything, so supply of ore/wood/hide is effectively the whole population,
   while demand is only crafters levelling. Value pooled in what could *not* be
   gathered: reagents, rare drops, time-gated materials [M, consistent with S].
4. **Low-tier craft spam.** Cheapest XP was mass-producing junk low-tier items.
   Patch 1.1.1 cut XP from low-tier crafts to push people to make things they
   might use [S]. It also made levelling slower and was read as "more grind".
5. **Crafting vs drops.** Expertise/watermark made crafted gear scale down;
   outrage; partial reversals. Devs later discussed more bind-on-pickup to stop
   the game being "just buy it at the auction house" [S]. The tension was never
   resolved: fully tradeable best-in-slot makes gold the only goal; bind-on-pickup
   makes crafters irrelevant to others.
6. **Linked trading posts** fixed dead towns and killed regional trade [S].
7. **Later inflation / wealth concentration.** By 2023 the team published
   quarterly economy reports tracking faucets vs sinks and a Gini index; PvP was
   ~1/5 of coin generation; they tuned expedition-boss and PvP coin [S].
8. **Daily cooldowns** on top-tier refined materials (10/day) were the tool used
   to hold value at the top; widely disliked as a login chore [M].

**Population context.** 913,027 peak concurrent on Steam (3 Oct 2021), under
400k three weeks later (-57%), 500k+ lost in the first month [S]. Cited causes:
thin PvE endgame (worst for solo players), tedium, exploits and bugs, and nerfs
that made things grindier (mote drops, craft XP) [S].

---

## 9. Why it feels good — and what players hated

### The hooks

1. **Always something to pick up.** Node density is high enough that between any
   two destinations there are 5-10 things worth stopping for. No trip is empty,
   and every stop pays in at least three currencies. PCGamesN: "gathering,
   refining, and crafting are by far the best parts"; PC Gamer: "you're always
   making progress" [S].
2. **Many parallel bars, staggered.** With ~50 bars, one is always about to
   level. Variable-interval reward with no dead time. The level-up fanfare for a
   trade skill is the same weight as a character level.
3. **Visible tier gates.** You walk past a starmetal vein at Mining 60 and the
   prompt says "requires Mining 100". The world advertises your future. The gate
   is one legible number, and the day you cross it a whole class of object you
   have been looking at for hours switches on.
4. **Tracking as a second unlock.** Being *able* to gather something and being
   able to *see it on the compass* are 25 levels apart. Between the two you find
   nodes by knowledge alone; after it the game confirms you were right.
5. **Sound and physicality.** Distinct strike sounds per material, environment
   echo, falling trees. The feedback is good enough that the verb is pleasant
   with zero reward attached [S].
6. **Map knowledge as skill.** Fixed node positions + timed respawn = routes.
   Players memorise loops ("the iron loop north of Windsward") and optimise them.
   Expertise lives in the player's head, which feels better than a stat.
7. **Self-sufficiency fantasy.** The sword you carry was ore you saw on a cliff.
   "There's no better feeling than wearing gear you've painstakingly assembled
   yourself" [S]. The lower-tier-feeds-higher chain means the whole history is in
   the item.
8. **Rare proc from a mundane act.** The 1,000th iron vein can still drop a gem
   or fae iron. Luck is visibly improvable (food, gear, trophies), so the jackpot
   feels earned, not random.
9. **Preparation rituals.** Before a big craft: eat, change clothes, go to the
   right town, check trophies, choose the mod, decide how much Azoth to burn,
   read the displayed range. The decision screen makes ten hours of prep legible
   as "590-600".
10. **A home base that accretes.** Storage, houses, trophies, standing cards: the
    town gets measurably better *for you* the more you use it.
11. **Danger around the pick.** Rich nodes sit in hostile pockets; PvP-flagged
    gathering adds a luck bonus. "Gathering 100 wood while 20 players try to
    murder you" [S].

### What players hated

- **Grind walls.** The pyramid at the top (hundreds of low-tier ingots per
  high-tier item; skill 150-200 needing thousands of crafts) and XP nerfs [S].
- **Inventory weight and scattered storage.** Encumbrance stops you mid-route;
  each town's shed is separate; transfers cost coin [S].
- **Travel time.** No mounts for two years; fast travel cost a capped currency
  scaled by distance and carried weight. Mounts (2023) were called "the lift New
  World needed" and fast-travel costs were cut hard [S].
- **Node contention and bots.** First-come nodes with long respawns on crowded
  servers; fishing/mining bots.
- **Endgame.** Once bars are full there was little to *do* with the gear,
  especially solo; chest-run zergs and daily lockouts replaced exploration [S].
- **Randomness on top of grind.** Days of gathering for one craft that rolls the
  wrong perks. The steady drift to deterministic crafting was the response [S].
- **Taxes and upkeep as punishment.** Weekly house tax felt like rent on fun [S].
- **Economy fragility.** Deflation, dupes and frozen trading destroyed trust in
  the one system that was meant to give crafting meaning [S].
- **Devaluing low tiers by price even while needing them by recipe** — a market
  problem, not a recipe problem.

---

## What transfers to a small 2D game

Ranked by feeling delivered per unit of build cost. All of this works solo.

1. **Dense nodes on every path.** Place gatherables so that no 5-10 second walk
   is empty. In top-down 2D this is tile placement and is nearly free. Carries
   hook 1 on its own.
2. **One skill bar per gathering verb, with a tick on every action** (3-5 verbs
   is enough: mine, chop, harvest, skin, fish). Small toast + bar fill + a real
   level-up moment. Carries hook 2.
3. **Visible locked nodes with the number on them.** Draw the tier-3 vein in the
   starter zone's corner, greyed prompt "Mining 40". Cheapest goal-setting device
   in the genre.
4. **Gather-at-X, track-at-X+N.** A compass strip or edge-of-screen pips that
   start showing a resource some levels after you can first harvest it. On a
   phone screen with a small view radius this is worth even more than in 3D.
5. **The tier chain where higher refined goods eat lower refined goods.** 4-5
   tiers, recipe = N previous-tier refined + M new raw + cross-skill input
   (charcoal). Keep the pyramid shallow (2-3x per tier, not 6-8x) to keep the
   meaning and drop the grind wall.
6. **Tool tiers that change speed, not permission.** 100/125/250/400/625% is a
   felt upgrade. One number, huge payoff, no content cost.
7. **Rare siblings from ordinary nodes plus an improvable luck stat** (food,
   tool perk, trophy). A flat-plus-threshold roll is ten lines of code.
8. **Craft screen that shows the outcome range and lets preparation move it.**
   Food, outfit, town buff, trophy, material quality each shift min/max; a mod
   slot guarantees one perk. Prefer chosen outcomes over perk lottery from day
   one — Amazon spent five years walking toward that.
9. **Zone bands by resource tier, with fog-of-war POIs and fixed node positions
   on respawn timers.** Fixed positions are what let routes and map knowledge
   emerge. Per-player nodes (not first-come) remove contention in a small shared
   world.
10. **Town that visibly levels from your hand-ins.** Station tiers as town
    projects; a board with 3-5 rotating "bring me X" requests paying coin + town
    standing; standing levels give a pick-one permanent card.
11. **A house as a buff rack.** Storage chest slots + 5 trophy slots + free
    recall. Skip instanced decorating at first; the trophies are the hook.
12. **Recipes as findable items** (schematics in chests, learned on use), with a
    visible "?/N known" count.
13. **Sound.** Per-material strike sounds with 3-4 round-robin variants, a
    distinct final-hit sound, a short reverb switch for caves, and distance
    falloff. A few dozen short samples; arguably the highest return on this list.

### What does not transfer (or should be left out on purpose)

- **Player-driven market as the source of value.** Needs thousands of players;
  with few it deflates to zero exactly as New World's did. For solo/small worlds
  use NPC demand with a price floor (the town board *is* the buyer), and let
  player-to-player trade be a bonus.
- **Territory ownership, company-set taxes, wars, invasions.** Population
  mechanics. Keep "the town has tiers and wants things"; drop governance.
- **First-come shared nodes and long respawns.** Contention is only interesting
  with PvP stakes; on a small server it is just griefing.
- **Weekly upkeep/property tax.** A punishment sink that exists to fight MMO
  inflation. A small game can use opt-in sinks (upgrades, trophies) instead.
- **Encumbrance and per-town storage.** Bad on PC, worse on a phone. If hauling
  matters, make it a deliberate choice (cart, pack animal), not a default tax.
- **Azoth-style travel cost and long walks.** Mobile sessions are 3-10 minutes;
  recall should be cheap.
- **Daily lockouts on chests/materials** as the main pacing tool.
- **Per-slot expertise / watermark.** Solved a trading problem you will not have
  and made crafting feel pointless.
- **Perk-roll lottery on top of long material grinds.**
- **3D audio-visual spectacle** (falling trees, vistas, cave echo by geometry).
  Replace with strong 2D juice: screen shake on final hit, node break animation,
  item fountain, the sound set above.
- **Classless action combat and 20-level weapon trees x 15 weapons.** The owner's
  love is for the economy side; one or two small weapon trees are enough to give
  crafted gear a purpose.

---

## Sources (search results consulted 2026-11-12)

Zones / general
- https://progameguides.com/new-world/all-territories-in-new-world/
- https://dotesports.com/mmo/news/all-territories-in-new-world
- https://game-maps.com/NW/Brightwood-Map.asp (and sibling territory pages)
- https://earlyguides.pages.dev/new-world-aeternum/maps
- https://mein-mmo.de/en/new-world-level-65-guide-how-to-quickly-reach-maximum-level-in-2024,542682

Gathering, tools, luck, tracking
- https://www.highgroundgaming.com/new-world-gathering-guide/
- https://www.wepc.com/gaming/new-world/how-to-track-resources-new-world/
- https://www.magicgameworld.com/?p=127336
- https://game8.co/games/New-World/archives/341811 , /339095 , /339186
- https://gamerant.com/new-world-everything-about-mining-information-guide-help/
- https://progametalk.com/new-world/gathering-tools-guide/
- https://www.studioloot.com/new-world/articles/gathering-tools-perks
- https://gamingdope.com/how-long-does-it-take-resources-to-respawn-in-new-world/
- https://newworld.wiki.fextralife.com/Orichalcum+Vein+(Small)
- https://www.pcgamer.com/new-world-luck-bonus-percentage (1,000 boars test)
- https://mein-mmo.de/en/new-world-everything-about-luck-how-to-more-easily-get-rare-weapons-and-items,740965
- https://nwdb.info/guides/new-world-void-ore-drop-rate
- https://west-games.com/new-world-gathering-luck-calculator/
- https://devtrackers.gg/new-world/p/014cfc77-petrified-wood-and-whisper-wood-way-too-rare
- https://www.wepc.com/gaming/new-world/new-world-fishing-hotspots/
- https://dotesports.com/?p=463123 (motes)

Sound
- https://twinfinite.net/2021/10/new-worlds-impressive-sound-design-makes-me-want-to-mine-rocks-forever/
- https://mein-mmo.de/en/for-15-years-i-have-been-playing-mmorpgs-without-sound-but-that-changed-with-new-world,734284
- https://newworld.com/en-us/news/articles/forged-in-aeternum-sound-design
- https://www.asoundeffect.com/new-world-game-audio/

Refining / crafting / progression
- https://www.newworld.com/en-us/news/articles/character-progression
- https://www.newworld.com/en-us/news/articles/crafting-in-new-world
- https://www.icy-veins.com/new-world/trade-skill-guides
- https://www.icy-veins.com/new-world/trade-skill-aptitude-guide
- https://icy-veins.com/new-world/smelting-trade-skill-guide
- https://newworld.wiki.fextralife.com/Smelting
- https://game8.co/games/New-World/archives/339383 , /344500 (schematics)
- https://nwdb.info/guides/how-to-craft-600-gear-score-items
- https://gamerjournalist.com/how-to-craft-maximum-gear-score-items-in-new-world/
- https://studioloot.com/new-world/articles/new-world-crafting-guide
- https://ghost.nwdb.info/timeless-shards-valuation-guide
- https://mx.nwdb.info/guides/how-to-get-the-orichalcum-braced-storage-chest-schematic
- https://newworld.wiki.fextralife.com/Core+Attributes
- https://www.pcgamesn.com/new-world/character-progression
- https://www.thegamer.com/new-world-watermark-update-crafting-worthless/
- https://www.gamespot.com/articles/new-world-players-are-up-in-arms-about-the-games-newly-proposed-expertise-system/1100-6498587/

Town, standing, storage, trading post, taxes
- https://newworld.wiki.fextralife.com/Town+Project+Board
- https://gamerant.com/new-world-town-projects-explained-upgrades/
- https://www.newworld.com/en-us/news/articles/making-your-mark-on-aternum-settlements-and-governance
- https://icy-veins.com/new-world/territory-standing
- https://www.thegamer.com/new-world-territory-standing-rewards-guide/
- https://gamerjournalist.com/new-world-project-board-leveling/
- https://twinfinite.net/guides/new-world-settlement-storage-size-increase/
- https://www.icy-veins.com/forums/topic/61915-developer-blog-on-most-current-new-world-issues/
- https://mein-mmo.de/en/new-world-makes-major-changes-to-the-trading-posts-could-destroy-the-economy,745948
- https://vulkk.com/2021/11/04/new-world-update-1-05-changes-overview-and-patch-notes/
- https://west-games.com/?p=31791 (fee calculator)

Housing, trophies, chests
- https://newworld.wiki.fextralife.com/Housing
- https://studioloot.com/new-world/articles/new-world-housing
- https://www.gamewatcher.com/news/new-world-house-tax
- https://www.gfinityesports.com/new-world/housing-taxes-reduced-in-new-world-until-december-update-to-fix-duplication-exploits/
- https://vulkk.com/2022/01/25/new-world-update-1-3-mutated-expeditions-changes-overview/
- https://www.thegamer.com/new-world-trophy-crafting-effects-guide/
- https://www.iggm.com/news/new-world-season-10-chest-runs-in-nighthaven-elite-loot-farming

Economy and failures
- https://www.newworld.com/en-gb/news/articles/economy-balance-deep-dive
- https://mmorpg.gg/analyzing-new-worlds-in-game-economy-key-takeaways-from-forged-in-aeternum-episode-71/
- https://www.mmobomb.com/news/new-world-economy-update-take-look-pvp-gold-inflation-control
- https://www.thegamer.com/new-world-economy-deflation-barter-system/
- https://kotaku.com/new-worlds-economy-is-so-busted-players-are-bartering-1847904272
- https://www.pcgamer.com/amazon-says-new-worlds-economy-is-just-fine-thanks
- https://invenglobal.com/articles/15691/new-world-takes-its-entire-economy-offline-again
- https://mein-mmo.de/en/new-world-disables-coin-transfer-because-players-escalate-with-gold-dupes,743155
- https://vulkk.com/2021/12/02/new-world-update-1-1-1-and-current-issues-3-dev-blog-analysis/
- https://www.mmobomb.com/news/new-world-forged-aeternum-talks-rewards-progression

Reception, decline, relaunch, shutdown
- https://www.pcgamesn.com/new-world/review-pc
- https://pcgamer.com/new-world-review
- https://www.digitaltrends.com/game-reviews/new-world-game-review/
- https://www.pcgamesn.com/new-world-has-lost-over-500000-players-in-a-month
- https://www.denofgeek.com/?p=723534
- https://massivelyop.com/2023/10/09/vitae-aeternum-rise-of-the-angry-earth-mounts-and-flail-are-the-lift-new-world-needed/
- https://massivelyop.com/2024/10/16/vitae-aeternum-new-world-aeternum-leaves-veterans-casuals-and-pc-players-behind/
- https://gamingbolt.com/new-world-aeternum-review-a-realm-reborn
- https://www.thesixthaxis.com/2026/01/15/new-world-aeternum-is-dead-game-delisting-and-server-shutdown-confirmed/
- https://ghost.nwdb.info/new-world-shutting-down
