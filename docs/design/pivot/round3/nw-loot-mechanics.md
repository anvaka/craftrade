# How loot works in New World (2021 to 2025), with numbers

Written 2026-11-12 for the round-3 redesign. Subject: Amazon Games' *New World*
(launched 28 Sep 2021) and its relaunch *New World: Aeternum* (15 Oct 2024).
This file covers the whole loot model. Gathering, refining, the town and the
economy are already in `../research-new-world.md`, and this file only repeats
them where loot depends on them.

## How to read this file

- **[S]**: a web search result in this session confirms the claim. The source
  is in the list near the end.
- **[M]**: from memory of the game, or an approximation. Treat the number as
  roughly right, not exact.
- **[D]**: arithmetic I derived from an [S] model. It is not a measured value.
- **Conflict:** where two sources disagree, both are given and neither is
  picked silently.
- **Limits of this research.**
  - Only search-result summaries were available. Page fetches were refused:
    WebFetch could not resolve icy-veins.com or newworldpacifist.github.io,
    and `curl` through the proxy got 403 for every game site tried (pcgamer,
    massivelyop, studioloot, game8 and about 45 others).
  - The session's shared web-search budget ran out near the end. A last
    search, for trophy luck values, was refused. Those values therefore rest
    on the earlier research note and on [M].
  - Many sources are fan guides written for one patch. Numbers moved a lot,
    so the *shape* of each system is more reliable than any single value.
- **Status of the game.** Season 10 (Nighthaven, 13 Oct 2025) was announced as
  the last content season [S]. The earlier note records delisting on 15 Jan
  2026 and server shutdown on 31 Jan 2027 [S].

### Eras used below

| Code | Era | Dates | Loot-relevant headline |
|---|---|---|---|
| **L** | Launch to patch 1.1 | 28 Sep 2021 to 18 Nov 2021 | Per-slot "high watermark"; gear score cap 600 [S] |
| **E** | Expertise era (patch 1.2 "Winter Convergence", patch 1.3 "Mutators", Summer Medleyfaire, **Brimstone Sands** 1.7, Seasons 1-2) | Dec 2021 to Sep 2023 | Expertise and gypsum (Dec 2021). Umbral shards and cap 625 (25 Jan 2022). Brimstone Sands on 18 Oct 2022. Season pass from Season 1 (Apr 2023) [S] |
| **R** | **Rise of the Angry Earth** (RotAE, Season 3) to Season 5 | 2/3 Oct 2023 (sources differ by a day) to Oct 2024 | Expertise and umbral removed; cap 700; artifacts; loot biasing [S] |
| **A** | **Aeternum** (Season 6 "Season of Opportunity") to Season 9 | 15 Oct 2024 to Oct 2025 | Cap 725; first raid (Hive of Gorgons); Seasons 7-9 (21 Jan 2025 to 29 Jul 2025) [S] |
| **N** | Season 10 "Nighthaven" | 13 Oct 2025 onward | Cap 800, level 70; perk-charm sockets; umbral back as an upgrade currency; attributes removed from gear [S] |

---

## 0. The pipeline in one paragraph

Any loot event (a kill, opening a chest, gathering, finishing an expedition,
opening a cache) rolls one or more **loot tables**. A table rolls a number from
0 to its MaxRoll, which is usually 100,000. An entry drops if the roll reaches
that entry's threshold [S]. An entry can point to another table or to a
**bucket**, a list of items filtered by tags such as zone, level, creature
family or item type. The game then picks from the bucket, often with equal
weights [S]. If the result is gear, two more steps follow. First its **gear
score** is set from the content and, in some eras, from your per-slot history.
Then its **perks** are rolled from the item type's pool, but only from the
perk "buckets" that are eligible at that gear score [S]. Its **rarity** is
simply how many of those slots were filled. Named items and artifacts skip the
perk roll, because their perks are curated [S]. Last, the item carries a bind
flag: bind-on-pickup (BoP) or bind-on-equip (BoE) [S]. Luck only enters at the
table-roll step [S].

---

## 1. Every source of items and materials

### 1.1 Open-world mobs (normal, elite, named)

- **Drop chance.** Each kill can drop a loot bag. Luck does **not** change the
  chance that a bag drops [S].
- **What drops:**
  - coin;
  - family-specific materials (hides from beasts, scraps and linen from humans
    and the Lost, motes from elementals) [M];
  - consumables;
  - gear whose tier follows the mob's level;
  - rarely craft mods [S] and schematics [S].
- **Gear score by mob level.**
  - *L/E:* while you level, drops follow roughly the mob's level (about
    level x 10) [M]. At 60, one guide gives this ladder: level 61 mobs drop GS
    500-530, level 62 drop 530-560, level 63 drop 560-591, level 64+ drop
    590-600 [S]. Another guide breaks it at different levels [S, conflict].
  - *R onward:* the gear score of a drop is set by the content and the
    creature's level [S]. One guide gives open-world mobs up to 690, and named
    enemies and chests up to 700 [S].
- **Elite** mobs sit in elite POIs. They hit harder, carry better tables, and
  in E had a better chance of an Expertise bump than ordinary mobs. Elite
  *chests* had a better chance still [S].
- **Named** mobs have their own table:
  - A community dump shows `CreatureLootNamed` with a `ZoneNamedItems` bucket
    at 50,000/100,000 (50%). In its example the chance of one specific bow from
    a Brimstone named mob comes out at 4.17% [S].
  - The chance of a named item *set* (Woodgrain, Lifering) dropping from a
    named mob was cut from 50% to 25% [S].
  - **Conflict:** one forum post says a named open-world mob has a flat 10%
    chance of its own named item and that luck does not affect it [S]. The
    official Luck FAQ says global luck *does* raise named drops from enemies,
    with Lazarus Bow from Cilla as its example [S].
  - In E, a level 60+ named elite dropped Obsidian Gypsum 80% of the time it
    dropped a bag [S].
- **"Global named" list.** A short list of items (Absolute Terror is the usual
  example) can drop from many sources. It sits on a ClampMax table where luck
  barely helps, and it is "*super* rare" [S].
- **Repeatability:** unlimited, paced only by respawn.
- **Tradeability:**
  - Materials are tradeable [S].
  - Open-world gear is mostly BoE [M]. One wiki says boss uniques are "often
    Bind on Equip" [S].
- **Open-world PvP.** From R, a flagged player who has been alive for 5
  minutes has a 50% chance to drop loot when killed [S].

### 1.2 Chests

| Type | Where | What it drops | Respawn and lockout | Conf. |
|---|---|---|---|---|
| Provisions (cache, crate, stockpile: the size grows, the pool stays the same) | farms, camps | Cooking ingredients, each found in at most three zones (salt: Everfall, Brightwood; sugar: Windsward, Ebonscale, Reekwater) | About 60 min | [S] |
| Supply (cache, crate, stockpile) | villages, camps, mines | Consumables, refining reagents, tools, low-tier gear, schematics | Shorter than elite chests; exact timer not found | [S] contents, [M] timer |
| Ancient (coffer, urn) | ruins | Arcane materials, motes, gems, schematics | As above | [S] contents, [M] timer |
| Alchemy | — | Alchemy materials | — | [S] that the type exists |
| **Elite** (Elite Supply, Elite Ancient, Grave Offering, Beast Hoard, later Glyph chests) | Guarded elite POIs | Best open-world gear (the classic target was "GS 600+ Legendary, Bind on Equip"); trophy materials (Loaded Dice, Stacked Decks); rare crafting materials (Brilliant Animus, Squirming Vines); Golden Scarabs; schematics; in E, Expertise bumps; in N, infix gear | Once per character per day. **Conflict:** nwdb lists a 23 h respawn; the fandom guide says a fixed daily reset at 5 AM EST | [S] |

- **Chests are per-player.** Opening one does not use it up for others. The
  cooldown is "not shared", so whole groups loot the same chest [S]. This is
  what made the **elite chest run** possible: 20-50 players sweeping a fixed
  route every day [S].
- **Elite-chest gear score.** From R, an elite chest sets a gear-score floor by
  the level of its POI [S].
- **Coin.** In mid-2022 about 80% of the coin that expedition bosses used to
  pay was moved into elite chests and breach-completion bonuses [S].
- **Golden Scarab** (Brimstone Sands onward):
  - about 7% from Sulfur Pools grave offerings at max luck [S];
  - about 2% from Heliopolis glyph chests [S];
  - capped at 10 looted per day [S];
  - tradeable [S].
  - One player reported 4 scarabs from one run of about 27 elite grave
    offerings [S, anecdote].
- **Schematics from chests** are covered in section 4.
- **N:** infix (unique-perk) items can drop from Elite Supply and Elite Ancient
  chests in most level 65+ areas, but not from those in Brimstone Sands or
  Elysian Wilds [S].

### 1.3 Expeditions (dungeons), mutations, boss and end chests

**Getting in.**
- *L:* entering needed a **Tuning Orb**: one party member had to hold one,
  orbs were crafted, and crafts were limited per week [S].
- *Summer Medleyfaire, 2022:* orbs were removed. They were replaced with
  limits: 15 normal runs per day (105 per week) and 25 mutated runs per week
  [S]. Orbs left in bags became caches with "a roll from the sub-boss and main
  boss", plus coin worth 50% of the orb's old faction-shop price [S].
- *A, Season 8:* up to 35 mutated runs per week, resetting Tuesday 05:00 [S].

**Loot structure.**
- Sub-bosses and the final boss each roll their own table [S]. Named items
  that belong to an expedition sit on **AddToRoll** tables, so luck helps
  there more than anywhere else [S].
- *E:* every expedition boss guaranteed a random Expertise bump. Arena bosses
  did too [S].
- Expedition-only gems/sapphire: the final bosses of Lazarus Instrumentality
  and Garden of Genesis dropped Sapphire Gypsum [S].

**Mutations** (patch 1.3, 25 Jan 2022) [S]:
- A weekly rotation of expedition-and-mutator combinations, with 10
  difficulty levels.
- Mutators change the elite and named enemies.
- Scores are graded Bronze, Silver or Gold.
- Named-enemy drop rates inside mutations were "significantly increased".
- **Umbral shards per run** (Bronze / Silver / Gold):
  - M1: 27 / 33 / 40
  - M5: 133 / 167 / 200
  - M10: 4,000 / 5,000 / 6,000 [S, one guide]
- *Brimstone Sands:*
  - chests were moved to the end of the run;
  - gathering, bosses and minibosses now add to the mutation score;
  - lower difficulties pay more umbral [S].

**R:**
- **Difficulty tiers.** Mutation tiers were balanced at about 650 / 675 / 695+
  GS. The announcement called them Intermediate 650, Hard 675 and Elite 700
  [S].
- **Gear-score ranges.**
  - Each expedition and each mutator sets its own range [S].
  - Base expeditions drop up to 685 [S].
  - Any mutation level can drop up to 700. The *minimum* rises with the
    mutation level [S].
- **Artifacts.**
  - Expedition artifacts drop **only** from mutated runs, always at GS 700
    [S].
  - Players who finish Elite mutations "have a chance" at an artifact [S].

**A:**
- **Random-queue daily bonuses** [S]:
  - Expedition Bonus Cache and Role Bonus Cache: 2 per day each.
  - Mutator Bonus, Mutator Role and Mutator Carry caches: 1 per day each.
  - Carry bonus: earned when queued below your unlocked difficulty.
  - Reset at 05:00 local time.
  - No bonus if you pick the expedition by hand.
  - A level-65 player's daily take from these was quoted at about 400 coin
    and 15k faction tokens [S].
  - **Conflict:** a 2025 guide says 3 random runs and 2 mutator caches a day
    [S].
- *Season 6:* added repeatable expedition quests [S].
- *Season 8:*
  - M3 mutations pay **Damaged Gorgon's Eyes**: 1-3, 4-7 or 8-12 by rank [S].
  - Looting is capped at 90 Eyes per week [S].
  - 60 Eyes craft a *Mutator Combo Reward Box* that guarantees one GS 725 item
    [S].

**N:**
- Gear with 2-3 fixed perks and 2-3 sockets drops from every mutation level.
  4-socket gear drops **only from M3** [S, one guide].
- M3 is also a main source of Umbral Crystals [S].

**Binding:** expedition drops are mostly BoP [M]. Players complain that "gear
from expedition runs can't be traded to party members" [S].

### 1.4 World bosses, raids, corrupted breaches

**World bosses.**
- *L/E:* open-world world bosses in elite zones (for example Myrkgard) drop
  named items. Those sit on **ClampMax** tables, where luck barely helps [S].
- *A, 2025 "Expeditions Unleashed"* [S]:
  - Expedition bosses appeared as world events: Mahantaram on 20-26 May,
    Khepri on 17-23 Jun, Ifrit on 15-21 Jul.
  - Each boss drops its own set of **GS 710 legendary** gear.
  - Each also has a rare **GS 725 weapon**, at most once per week.
  - Bonus boxes are capped at 3 per day.
  - **Pity counter:** if the 725 has not dropped that week, it is guaranteed
    after 12 bonus boxes.
- *Season 8 (Divide):* world-boss events paid GS 715-725 [S].

**Raid: Hive of Gorgons** (launched with Aeternum, 15 Oct 2024) [S]:
- 10 players (it can be opened with 6) and three bosses.
- Each boss drops a Gorgon's Eye, one 725 "Hoplite" item and 1-2 Gorgon's
  items at 700-725. The Gorgon's items are loot-biased.
- The slot depends on the boss: jewellery from the first, armour from the
  second, weapons from Medusa.
- Clear rewards also include raid tokens, Chromatic Seals, inductors used to
  upgrade artifacts, and schematics for 725 gear.
- A special crafting material from the raid crafts 725 gear.
- **Lockout:** loot once per boss per character per week. One booster site
  says there is no lockout, only daily caps on materials [S, conflict]. People
  ran alts for extra weekly chances [S].

**Corrupted breaches** [S]:
- Closing one pays coin, Azoth, territory standing, crafting materials and a
  breach cache.
- The cache's contents scale with your level and the breach's level, and it
  holds one item of matching rarity.
- Higher-level breaches also pay Amethyst Gypsum.
- Corrupted Slivers come only from **Major** breach caches.
- You only get credit if you tag the objective.
- Breaches respawn as a world event in corrupted areas [M].

### 1.5 PvP: Outpost Rush, wars, arenas, flagging, Cursed Mists

**Outpost Rush (OPR)** [S]:
- **The cache** comes win or lose. It holds 2 OPR armour pieces and 1 OPR
  weapon, sometimes a 4th item, with a 2.5% chance of an OPR named item.
- **Thresholds:** 501 match points to get any reward, 3,000 for the maximum.
- **Other pay:** coin and Azoth scaled by result (a loss still paid 270 coin
  and 175 Azoth in one report), faction tokens, reputation, PvP-track XP and
  Azoth Salt.
- **Gypsum:** Ruby Gypsum for each of the first 2 matches per day.
- *E:* a guaranteed Expertise bump.
- One player claims luck and watermark do not affect OPR's legendary roll. The
  same player reported 100 matches of 500-510 GS items in 2021 [S, anecdote].

**Wars and invasions** pay "Event Reward Containers" [S]. In L/E these were
explicitly a weaker watermark source than expedition bosses [S].

**Arenas** [S]:
- Citrine Gypsum from arenas.
- Garnet Gypsum from 3v3 matches: 100% on a win, 50% on a loss.

**PvP reward track** [S]:
- Fed by PvP activity and paid out in Azoth Salt.
- Its rewards include gypsum, umbral shards (in E), potion packs, currency and
  at least one artifact (Pestilence).

**Flagging luck** [S]:
- Before 1.1: +1% loot luck and +3% gathering luck.
- Patch 1.1 (18 Nov 2021): +10% loot luck and +30% gathering luck.
- This made "flag up to farm" the norm, and players complained that it made
  gatherers into prey.
- A later source says flagging adds 1%, so the value may have been cut [S,
  conflict].

**Cursed Mists and the Well of Fortune** (A, an FFA PvP zone in Cutlass Keys)
[S]:
- *Doubloons.* Chests and quests in the zone pay Cursed Doubloons. They become
  Mystic Doubloons when you leave the zone.
- *Where they are spent.* The Well of Fortune shop sells two crates:
  - **Goldcursed Epic Crate:** 35 doubloons, "700 and higher".
  - **Apex Goldcursed Chest:** 1,500 doubloons (one source says 1,800) plus one
    **Goldcursed Coconut**. It guarantees a 725 item.
- *Weekly items.*
  - The Coconut comes only from a weekly elite chest in the zone.
  - The Glittering Gold Key costs 5 doubloons and can be bought once a week.
    It opens a chest that can hold 500+ doubloons.
- *Named upgrades.* Goldcursed named items at 710 were upgraded to 725 for
  1,250 doubloons + 1 Coconut + 300 Dark Matter. One guide adds a weaponsmith
  charm.

**Binding:** PvP gear and caches are BoP [M]. PvP *perks* were moved to BoE
[S].

### 1.6 Faction and territory shops, town board, quests, season pass

**Faction shop** [S]:
- **Currency:** faction tokens plus coin.
- **Rank gating:** stock is gated by faction rank. For example, rank 5 at
  49,000 reputation unlocks 35 more items, and the best items cost about
  7,000 tokens + 1,500 coin.
- **Stock:**
  - Azoth Inductor (BoP, once per 7 days, about 75k tokens);
  - Chromatic Seal;
  - Gypsum Orb;
  - Runes of Holding (only sold here, and among the best trading-post sellers
    of 2021);
  - Writ of Adventure;
  - Shard of Pride;
  - faction armour with a custom attribute seal, plus a Seal Extractor to
    remove it;
  - a few faction-only items.
- **Watermark:** buying from the faction vendor never raised your watermark
  [S].
- **Territory standing** gives perk cards (storage, tax cuts, gathering), not
  items [S, from the earlier note].

**Town board.**
- Pays coin, character XP and a lot of territory standing [S].
- Not a gear source [M].
- Players often buy the requested goods on the trading post [S].

**Quests.**
- Pay fixed or chosen gear and coin [M].
- Loot biasing does **not** apply to quest rewards [S].
- *A:* the Season 6 repeatable Soul Trials paid a "measly" 25 coin each, by
  one critic [S].

**Season pass** (from Season 1, Apr 2023) [S]:
- **Structure:** a free and a premium track, 100 levels each. Levels come from
  the Season Journey, challenges and activities.
- **Rewards:**
  - mostly cosmetics and transmog tokens;
  - in Season 1, "Legendary Gear (Gearscore 600 Items)";
  - from about Season 4, **artifacts**: Unquenchable Thirst is the level-100
    reward of one season.
- **Paying in:** premium can be bought late and pays retroactively. A
  head-start of +20 levels cost 30,000 Marks of Fortune.
- **Expiry:** unclaimed unique rewards are vaulted at season end. Before
  Season 6 they could only be claimed on Legacy worlds.
- **Binding:** BoP [M].

### 1.7 Fishing

- **Luck sources** [S]:
  - the rod;
  - bait (the top tier is quoted at +8,500 luck);
  - gear;
  - trophies: Minor 2,500. **Conflict** on the rest: one guide gives Basic
    3,500 and Major 5,000, another Basic 5,000 and Major 9,000.
- **Hotspots dwarf everything else:**
  - one guide gives a 2-star hotspot +159,900 luck and a 3-star +243,300;
  - so a 3-star hotspot gives "only Treasure Chests and Legendary Fish" [S].
  - Legendary fish are under 5% even at rare hotspots, and best at secret
    hotspots [S].
- **A different luck model.** A 2021 developer post says gatherables use a
  "relative odds" model and fishing does not [S].
- **What fishing drops:**
  - fish, the cooking input;
  - treasure chests with gear, coin and materials [M];
  - craft mods from salvaging uncommon or rare fish [S, one guide];
  - pearls [M].
- **Hotspot fish counts and respawns** are in the earlier note (broad about 30
  fish; 15-90 min by star) [S].
- **Tradeability:** catches are tradeable [M].

### 1.8 Salvage

- **Salvaging gear** gives coin, repair parts and occasionally raw materials.
  There is no vendor to sell gear to, so salvage *is* the junk sink [S].
- **Perfect Salvage** (E, about 2022-23): a 5% chance per salvage. It yields
  scraps (salvage again for many repair parts) or fragments (used to extract
  materials, fabricate items or make gypsum orbs) [S].
- **Umbral shards from salvage.**
  - *E:* legendary gear always salvaged to fragments and 50 umbral shards. The
    exceptions were legendaries from OPR caches and gypsum casts [S].
  - *R:* umbral was retired, and shards could be salvaged for 0.1 coin each
    [S].
- *R:* craft mods made obsolete by the perk rework could be salvaged into
  attribute craft mods [S, one video].
- *N:* one low-quality guide says charms come "rarely" from salvaging
  legendary gear [S, weak].
- **Artifacts** cannot be salvaged or discarded [S, from PTR notes].

### 1.9 Gypsum, orbs and casts (the deterministic loot source)

Introduced in patch 1.2 (Dec 2021) as the guaranteed counterweight to random
Expertise bumps.

**The loop** [S]:
- Each activity drops its own colour of gypsum.
- Enough of one colour crafts a **Gypsum Orb** at the T5 Gypsum Kiln.
- Once you have earned enough for an orb, that colour stops dropping for 23
  hours.
- Orbs craft a **Gypsum Cast** of a weapon, armour or jewellery type. Each cast
  type can be crafted once per day.
- Opening a cast **guarantees an Expertise bump and an item of that type**.
- A bump raised Expertise by **2 to 5 points** [S].
- In the same patch, random bump odds were cut: "Elite chest odds were reduced
  a little and open world bosses were reduced a lot" [S].

**Colours, sources and daily caps:**

| Colour | Source | Daily cap / per orb | Conf. |
|---|---|---|---|
| Obsidian | Level 60+ open-world named bosses (80% when they drop a bag) | 3 / 3 | [S] |
| Topaz | Level 55+ creatures, only after drinking an Attunement Potion (its cooldown was cut from weekly to daily) | 15 / 5 (**conflict:** another source says 10 per day and 10 per orb) | [S] |
| Amethyst | Breaches (corrupted portals) | 7 / 7 | [S] |
| Sapphire | Final bosses of Lazarus Instrumentality and Garden of Genesis | 2 / 1 | [S] |
| Ruby | Outpost Rush (first 2 matches per day) | 2 / 1 | [S] |
| Citrine | Arena | 2 / 1 (another source says 1) | [S] |
| Emerald | Trade-skill Aptitude containers | 2 / 1 (another source says 1) | [S] |
| Garnet | 3v3 arena | 2 / 1 | [S] |
| Diamond | Seasonal events (Aeternum) | 6 / 3 | [S] |

**R:**
- **The kiln became the upgrade bench for named items** [S]. It raises a
  named item to 700 and sets its final perk.
  - Cost: Matrix + 250 Dark Matter + 1 Gypsum Orb + 3 Chromatic Seals, plus an
    optional craft mod for the perk.
  - **Conflict:** an older guide gives Matrix + 500 Dark Matter + 5 Orbs + 1
    Seal.
- **Artifacts:** Matrix + 5 Orbs. The artifact loses any gem or appearance
  [S].
- **Spores** from Elysian Wilds make one orb per day [S].
- Orbs can also be bought at the faction shop [S].

**N:**
- Umbral replaces the kiln for the 700 to 725 to 800 path, and the 725 kiln
  recipes were removed [S].
- The kiln is now where you add perk-charm slots [S].

**Binding:** cast items are BoP [M].

### 1.10 Gathering rares (rare siblings)

The earlier note covers this in depth: the boar test, void ore odds, and the
rare siblings for each resource. The parts that matter for loot:

**Thresholds above the maximum roll.**
- Rare gathering tables are often set above the 100,000 maximum. The logging
  rare table needs a roll of 101,000 or more [S]. Another entry needs 101,450
  [S].
- With no luck these items are impossible.
- One guide lists "luck required": Tier 2-3 need 1,000, Tier 4 1,450, Tier 5
  1,800 [S]. Those line up exactly with thresholds of 101,000 / 101,450 /
  101,800 [D].

**Tables nest.** For example, a 5% chance to reach the rare table times a 25%
chance of the item inside it gives about 1.25% overall [S].

**Asmodeum's inputs come from gathering.** Tolvium and Cinnabar drop from
**Orichalcum veins**. Tolvium needs Mining 175 and 1,800 mining luck just to
be possible [S].

**Craft mods** have "a small chance" from trees, boulders and creatures [S,
official].

**The Rabbit's Foot** (needed for the Minor Loot Luck Trophy recipe) comes
only from rabbits [S].

**Tradeable:** yes, all gathered rares [S].

### 1.11 Crafting, and the trading post, as "sources"

Crafting gets its own section (5). It counts as a loot source for two reasons:
- the craft itself is a roll (gear score in L/E, perks in every era);
- the containers paid for crafting are loot. **Trade-skill Aptitude**: after a
  skill reaches its cap, each aptitude level is split into three containers (a
  parcel, a crate, then a "package of specialised materials"). They hold craft
  mods, special ingredients, schematics, recipes, Emerald Gypsum, and for the
  gear skills a small chance of equipment patterns [S].

The **trading post** is a source for anything tradeable [S]:
- BoE gear;
- all raw and refined materials;
- Golden Scarabs, armour matrices, craft mods and schematics.

It is one linked market across all towns from patch 1.1, with no NPC buyer
[S]. Prices quoted in guides (server-dependent):
- Golden Steel (Orichalcum-braced) Storage Chest schematic: **150,000 to
  600,000 coin** [S].
- Golden Scarab: 500+ coin each [S].
- Basic trophies: cost 700-1,200 coin in materials to make and sell for
  2,500-4,000 [S].
- Engineering tools at 580+ GS: 300-500 coin each [S].

---

## 2. How a single gear drop is generated

### 2.1 Loot tables, buckets and where luck enters

**The roll.** About 82% of loot RNG is a 0-100,000 roll against
thresholds [S]. Tables nest, and buckets hold items that share tags.
- One example bucket, the storage-chest schematic bucket, holds 22 items at
  equal weight.
- 11 of those 22 can drop only in Ebonscale Reach. So farming elsewhere
  doubles your chance of the one you want [S].

**Luck is an integer.** 1% luck = 100 points on a 100,000 table [S]. A player
killed 1,000+ boars to test this: 7.5% observed against 8.44% predicted,
supporting 100 per 1% and ruling out 1,000 per 1% [S].
- **Conflict:** a forum post and one gathering guide claim 1,000 points = 1%
  [S]. In gathering contexts luck is usually *quoted* in points (trophy +500,
  food +1,000, bait +8,500), which may be the cause of the confusion [S].

**Two table modes decide how much luck matters** [S]:
- **AddToRoll:** your luck points are added to the roll.
  - Zegeger's example: 1% base becomes about 7% at 6,000 points [S]. Check: a
    threshold of 99,000, roll range 6,000..106,000, gives P = 7% [D].
  - With 40% luck (4,000) against a 99,500 bucket, 0.5% base becomes 4.5% [D].
  - An item with a 101,450 threshold needs at least 1,450 points. At 5,000 it
    is 3.55% [D].
- **ClampMax:** luck is subtracted from the thresholds *and* the MaxRoll,
  which squeezes the range. With 4,000 points, a 0.5% bucket becomes about
  0.52% [D]. The forum FAQ calls the effect "so insignificant as to almost be
  meaningless" [S].
  - **Conflict:** another write-up says ClampMax only moves the floor of the
    range [S].
- **Which tables use which:** named items from **expeditions** are AddToRoll.
  Named items from **world bosses** and the **global named list** are ClampMax
  [S]. Tam Toucan's conclusion: loot luck has a "tiny effect overall" except
  on one Season-10 table [S].

**What luck does not touch** [S]:
- whether a bag drops;
- the rarity colour of a non-named item;
- gear score;
- the number of perks.

The official FAQ adds that high luck creates no "dead zones": it never makes
common items impossible [S].

### 2.2 Rarity tiers: what each colour means

**What sources say about the tiers.**

| Source and era | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| Official 2021 article (counts perks only) | 0 perks | 1 | 2 | 3 | Named and Legendary are a separate class with curated perks and fixed GS [S] |
| Fandom (E) | — | 1 perk | 2 | 3 | 3 perks + guaranteed gem slot [S] |
| Utopian Organ (R) | — | — | — | attribute + gem + 2 perks | attribute + gem + 3 perks; gold at 600-625 and 675+; **Artifact** is orange at 700+ [S] |
| "Dev count" | Developers count the attribute and the gem socket as perks, so a Legendary has 5 "perks", which players call 3 [S] |
| German guide (**conflict**) | | | | at most 3 effects including the gem | at most 4 [S] |

**The model that fits most sources.** An item has up to five slots: one
**inherent** attribute line, one **gem socket**, and three **generated
perks**. The colour is the count of filled slots: 5 is Legendary, 4 Epic
[S], and lower counts give the lower colours [M].

- **Perk buckets are gated by gear score.** An item only rolls the perk
  buckets its GS allows. A Tier V item needs **GS 600** (later 590) to unlock
  its last slot, which is what Legendary requires [S].
- **A low-GS item can carry a predefined last perk.** It is shown, but stays
  disabled until the GS is high enough [S].
- So in L/E a random (non-named) Legendary could only exist at 590/600+. That
  is why the last few gear-score points felt so large.
- **Gem slot.** Items "occasionally" drop with an empty gem slot. Jewellery
  came with a pre-socketed gem that could not be replaced (2021) [S].
- **Inherent perk = the attribute bonus** (+X to one or two attributes) [M]. In
  N, attribute perks were **removed** from gear and their points moved into
  the levelling pool [S].

### 2.3 Perk pools

- **One pool per item type.** Weapons, armour by slot and jewellery each have
  their own [S]. Each perk carries an exclusivity "label", so two perks from
  the same family cannot roll together [S, that labels exist; M, on how they
  work].
- **Perk strength scales with the item's gear score.** For example, the Luck
  perk scales with GS [S].
- **R:** removed Creature Bane, Creature Ward, Resilience and the Expertise
  perks "to widen build variety" [S].
- **Loot biasing** (R, explained in a 24 Jan 2024 deep dive) [S]:
  - It skews drops toward your equip load, your main and secondary attributes,
    and the weapon types you have equipped.
  - In practice it removes non-matching items from the candidate list.
  - The odds of the bias applying are tuned up at higher levels, and raised
    or guaranteed in PvP modes.
  - Attributes are biased; weapon perks are not.
  - Named items and artifacts are excluded. A roll can therefore land on a
    named item you then do not receive.
- **N:**
  - Generic gear carries up to 2 **fixed perks** and up to 3 **perk-charm
    sockets** [S]. Another source says up to 4 sockets, all random in type,
    so 4 of the same type is possible [S].
  - Socket count probably follows rarity (1 green, 2 blue, 3 purple, 4
    legendary), but one source calls this "likely", not confirmed [S].
  - Charm types: three (Defensive, Offensive, Skill) according to the official
    announcement, four (adding Gem) according to Icy Veins [S, conflict].
  - **Infix** perks exist only on unique gear [S], and set pieces with set
    bonuses arrive for the first time [S].

### 2.4 Gear score: how the number is set

| Era | Cap | What sets a drop's GS | Conf. |
|---|---|---|---|
| L | 600 | Item tier by mob level. **Conflict:** one guide gives T2 100-299, T3 250-399, T4 350-499, T5 450-800 (overlapping); others give base values of 300 (T3) and 500 (T5). At level 60, a **per-slot high watermark** starts at 500. Drops are capped by your watermark for that slot and by the mob's level. Rolls more than about 5 above the watermark are "extremely slim". Every level 60+ kill without a raise slightly raises the chance next time (a soft pity). Expedition bosses always raised it. Crafting, trading and faction purchases did **not** count | [S] |
| E (patch 1.2) | 600, then 625 | The watermark became **Expertise**, shown per slot, with your old value kept. A bump raises it by 2-5 points. Gear above your Expertise was *scaled down*: first all the way to Expertise, then to the midpoint (a 560 hatchet at 500 Expertise counts as 530). Crafted gear could bump Expertise | [S] |
| E (patch 1.3, 25 Jan 2022) | 625 | **Umbral shards** upgrade an item from 600 to 625 (PTR feedback cut the start to 590; sources conflict). This needed Expertise 600 in that slot | [S] |
| R (Oct 2023) | 700 | Expertise removed. GS is set by content and creature level. Open world up to 690; named and chests up to 700; elite chests have a floor by POI level; expeditions and mutators set their own ranges; base expeditions reach 685. Umbral removed | [S] |
| A (Oct 2024) | 725 | Same model. Most endgame drops are 700-710. 725 comes from the raid, Apex Goldcursed chests, world-boss pity and (from Season 8) the Mutator Combo Box | [S] |
| N (Oct 2025) | 800 | Drops arrive at about 700-730. **Umbral Crystals** upgrade any item at 700+ up to 800. Weekly cap 4,000; the wallet cap is 4,000 or 1,000 depending on the source; about 900-1,000 crystals take an item from 700 to 800. PvP modes scale gear to 775 | [S] |

- **Umbral cost curve (E).** Cheap at the start, brutal at the end:
  - 600 to 601 costs 1 shard and 608 about 15-16 [S].
  - 620 costs 900, 621 costs 1,000 and 622 costs 1,400 [S].
  - Another table gives 623 at 1,900 and 624 at 2,500 [S].
  - One guide's summary: "extremely easy to upgrade items up to around 610 …
    very difficult to get all the way to 625" [S].
- **Umbral sources (E):** mutations (the main one); crafting 600 items; and
  opening gypsum casts once your Expertise was 600 [S].
- **What players felt (E).** The watermark was designed as the reward for
  playing high-level content. Players felt it as a penalty on crafted and
  bought gear: the "crafting worthless" backlash [S, from the earlier note].
- **What players felt (A).** A MassivelyOP critic: "it doesn't take too long to
  reach a point where you're effectively capped out". They argued for small,
  steady rewards up to the cap [S].

### 2.5 Named items and artifacts

**Named items** (orange, unique name):
- **What they are.** Curated perks, and in L a fixed gear score [S]. Each
  belongs to a specific boss, expedition or named mob, plus the rare
  global-named list [S].
- **E:** a named item at 590+ upgraded with umbral to 625 unlocks its final
  perk and becomes Legendary [S].
- **R:**
  - Named items carry two locked perks [S].
  - At the Gypsum Kiln they upgrade to 700, and **you choose the third perk
    with a craft mod** [S].
  - Named items that dropped *before* the expansion could not be raised past
    their old cap [M]. A critic called it a "poor progression model for named
    items" [S, title only].
- **A:**
  - Goldcursed named items at 710 upgrade to 725 (costs in 1.5) [S].
  - Some named items could not go past 700 [S].

**Artifacts** (R onward, a new top rarity):
- **Perks.** Six perks, one of them a unique, playstyle-defining perk [S].
- **Unlocking.** Only the first perk is active when the artifact drops. Each
  further perk needs its own **artifact quest**, and you can have up to 10
  active [S].
- **Drops.** Always at GS 700 [S]. You can only ever equip one [M]; the
  sources are unclear on this.
- **Kinds and sources.** Weapon, armour (shields count) and jewellery. Each
  comes from one fixed source, for example [S]:
  - Sin: Colossus of Memnon;
  - Pestilence: PvP reward track;
  - The Wall: the Ennead mutation;
  - Unquenchable Thirst: season pass level 100.
- **Upgrades.**
  - *R:* Matrix + 5 Gypsum Orbs [S].
  - *A:* to 725 via the Goldcursed Coconut [S].
  - *N:* umbral from 700 to 800 [S].
- **Shape in N:** one infix (unique) perk, two fixed perks and two charm
  sockets. An item cannot have an infix and a Skill socket at once [S].
- **Binding:** cannot be salvaged or discarded [S]. BoP [M].

### 2.6 Upgrade and reroll paths, by era

| Era | Raise GS | Control perks | Reset or swap |
|---|---|---|---|
| L | Only by finding or crafting better | Azoth raises the odds of extra perks; one **craft mod** guarantees one chosen perk on a craft [S] | None: a bad roll is salvage |
| E | Umbral 600→625 (expensive at the top) [S] | Brimstone-era **Timeless Shards** (fixed attribute + 1 perk) and **Golden Scarabs**: "combined with timeless shards allows a crafter to select two perk items" [S]. Runestone Stopwatch (choose a perk, 598-600 roll) [S, from the earlier note] | Still none |
| R | Kiln: named items to 700; artifacts upgraded at the kiln [S] | **Chromatic Seal**: daily, 2 chosen perks. **Prismatic Scarab** + **Azoth Inductor**: weekly, GS 700 with *all* perks chosen [S]. A crafted item gets 1 random + 2 predetermined perks, and "the random perk can be changed at some expense" [S] | The kiln sets the final perk on named items [S] |
| A | 725 through raid crafting (a Gorgon material), Goldcursed upgrades and the Apex chest [S] | Same as R | Same as R |
| N | **Umbral Crystals**, 700→800, from right-click "Upgrade" [S] | **Perk charms** go into sockets; crafted charms come from endgame drops [S]. Craft mods lock a fixed perk on crafted gear [S] | Replacing a socketed charm **destroys** the old one [S]. "Perk charms basically allow you to change perks on gear … as you see fit" [S] |

**Direction of change.** Over four years the game moved from a pure roll
toward picking your perks, with each pick gated by daily or weekly cooldowns.
In N the randomness moved into the *socket layout* of drops [S]. Heartlessgamer
complained that there was "no longer a deterministic way to obtain the exact
gear you want" [S].

---

## 3. Luck stats

New World has three separate luck stats [S]:
- **global (loot) luck**, for chests and kills;
- **gathering luck**, one per gathering skill;
- **fishing luck**.

None of them crosses over into another [S].

### 3.1 Global (loot) luck

**What it affects** [S]:
- the chance of *low drop-chance* entries from enemies and chests: named
  weapons and armour, rare resources, recipes and schematics, trade-skill
  armour, trophy materials, Golden Scarabs, and unique armour from expedition
  bosses;
- not drop rate, colour, gear score or perk count;
- it is weak on ClampMax tables and strongest on AddToRoll expedition tables.

**Sources and values.** Mostly older fan data, so treat as approximate.

| Source | Value | Conf. |
|---|---|---|
| Luck perk on a gear piece | +0.5% each (Fextralife, Game8); scales with item GS (Fandom); stacks across pieces ("sometimes bugged") | [S] |
| Pearl in a socket, T1-T4 | 0.25 / 0.35 / 0.45 / 0.5% | [S] |
| Loot Luck trophies: Minor / Basic / Major (up to 3 count) | 0.5 / 1 / 1.5% (Zegeger) | [S] |
| Luck food | 4.95% (Zegeger) | [S] |
| Rabbit's Foot and similar consumables | exists; value not found | [S] / [M] |
| PvP flag | +10% from patch 1.1 (was +1%) | [S] |
| Territory your faction controls | "small boost" | [S] |
| Zegeger's total of everything | about 61.6%, from an unlabelled table | [S] |

- **Your weapon counts while sheathed.** The luck on your active weapon (and
  shield) still applies when you open chests with the weapon away. Off-hand
  weapons and pearls may not count, which the author marks as a guess [S].
- **Trophies.** The Minor Loot Luck Trophy needs Furnishing 100, a T3 workshop
  and a Rabbit's Foot. Basic needs about 150 and Major about 200 (from a PTR
  database) [S].
- **Caps.** None was found in any source [S, absence]. In practice the caps
  come from the table design: ClampMax tables, item-specific "luck does not
  affect" flags (the storage-chest schematic) [S], and daily caps on the drop
  itself (Golden Scarab 10/day) [S].

### 3.2 Gathering luck

- **Per skill:** mining, logging, harvesting, skinning [S].
- **What it does.** It does not change yield, only the chance of rare
  siblings [S]. Gatherables use a relative-odds model [S].
- **Sources:**
  - tool perks;
  - armour (for example a Miner's hat or shirt at 3.8-5% rare chance each)
    [S];
  - food (Roasted Cabbage is quoted at +1,000) [S];
  - gathering trophies (+500 / +1,000 / +1,500 per house; the earlier note
    puts this as about 5 / 10 / 15%) [S];
  - the PvP flag (+30% from patch 1.1) [S];
  - faction control-point bonuses [S];
  - attribute thresholds (for example 50 STR raises mining speed) [S, from the
    earlier note].
- **Hard minimums.** Some rares need a minimum luck before they can drop at
  all: Tolvium 1,800; T4 1,450; T5 1,800 [S]. This works as a gate you can see
  coming: build luck until the item becomes possible, then grind for it.

### 3.3 Fishing luck

See 1.7. Rod, bait, gear and trophies add a few thousand points. The
hotspot's star rating adds hundreds of thousands, so *where* you fish matters
more than how you are geared [S].

---

## 4. Rare materials and schematics

### 4.1 Schematics: how they work and how rare they are

- **How they work.** A schematic is an item. Using it teaches the recipe
  permanently, even before you could craft it [S, from the earlier note].
  Schematics are tradeable [S].
- **Sources:** supply crates, ancient coffers and urns, elite chests, bosses,
  and Aptitude containers [S]. One player reported legendary schematics from
  ordinary supply crates [S].
- **Drop rates:**
  - **Golden Steel (Orichalcum-braced) Storage Chest:**
    - **0.00023%** per Elite Supply or Elite Ancient chest in 50+ zones, and
      luck does **not** affect it [S];
    - 0.165% from a Package of Specialised Furnishing Materials, after a Dec
      2021 change [S];
    - it sold for 150k-600k coin [S].
  - **Furnishing aptitude crates (tier 3):** 25 chances at a schematic from a
    pool of 227 [S].
  - **Top rare furniture in general:** about 1 in 4,000 to 1 in 10,000 per
    elite chest [S, estimate].
  - **Equipment patterns:** a small chance from the Arcana, Weaponsmithing,
    Armoring and Engineering aptitude caches [S].
  - **Hive of Gorgons:** schematics for 725 gear [S].
  - Named-mob and expedition schematic rates were not found [S, absence].

### 4.2 Craft mods

- **What they do.** A craft mod guarantees one perk of your choice on a craft:
  "you can guarantee that the one perk you want on the item is there" [S,
  official]. It also lowers the Azoth needed [S, from the earlier note]. Their
  rarity is always Uncommon [S].
- **Sources** [S]:
  - a small chance from trees, boulders and creatures;
  - chests and enemies;
  - salvaging uncommon or rare fish;
  - Aptitude containers;
  - event items (Legacy of Crassus: 25% per day for a random mod).
- **Mods get a second job over time:**
  - in R, a mod sets the final perk on a named item at the kiln [S];
  - in N, a mod locks a fixed perk on a 730 craft [S].
- **Tradeable:** yes [M].

### 4.3 Faction and trophy recipes

- **Faction.** The faction shop sells faction gear with a custom attribute
  seal (removable with a Seal Extractor) and some faction-only items. These
  are rank-gated and paid in tokens plus coin [S].
- **Trophies:**
  - Furnishing recipes that need rare drops: a Rabbit's Foot for the loot-luck
    line [S]; Loaded Dice and Stacked Decks from elite chests [S].
  - Trophy buffs stack across 3 houses [S, from the earlier note].
  - Trophies are one of the best-margin trading-post goods [S].

### 4.4 How the rarest inputs gate the top of crafting

| Input | Recipe and gate | Source of the rare part | Conf. |
|---|---|---|---|
| **Asmodeum** (T5 metal) | 5 Orichalcum ingot + 1 Tolvium + 1 Cinnabar + 1 Obsidian Flux + 2 Charcoal; Smelting 200; **10 per 24 h** | Tolvium and Cinnabar from Orichalcum veins (Tolvium needs 1,800 luck) | [S] |
| Glittering Ebony, Runic Leather, Phoenixweave | The same pattern for wood, leather and cloth, each 10 per 24 h | Rare gathering siblings | [M]; [S] that they are top trade goods |
| **Prismatic Ingot** (R) | 1 Asmodeum + 10 Mythril ingot + 4 Obsidian Flux + 4 Charcoal; Smelting 250; 10 per 24 h | Built on the whole chain beneath it | [S] |
| **Prismatic Scarab** (R) | 10 Golden Scarabs + 1 Prismatic Block (was 3) + 500 Azoth + 50 Pure Solvent; Stonecutting 250; **weekly** | Golden Scarabs: elite chests, 10/day, tradeable | [S] |
| **Azoth Inductor** | Faction shop, BoP, once per 7 days (about 75k tokens) | Faction play | [S] |
| Chromatic Seal | Daily; guarantees 2 perks | Faction shop, raid | [S] |
| Gorgon raid material (A) | Crafts 725 gear | Hive of Gorgons, weekly | [S] |
| **Matrix Alloy** (N) | Forges **tradeable** GS 730 gear | Endgame drops | [S] |

The gate has three layers:
- **Luck** decides whether you can even find Tolvium.
- **Daily cooldowns** limit how fast the top bars can be made.
- **A weekly BoP part** (the Inductor) caps chosen-perk 700 crafts at about one
  per week per character.

In R, MassivelyOP noted that endgame crafting "will require more resources …
so as to avoid a glut", and Heartlessgamer reported that many high-end
components became BoP "so crafters have to put in time to gather them" [S].

---

## 5. Crafting versus drops

### 5.1 Caps and floors by era

| Era | Best crafted | How it's set | Conf. |
|---|---|---|---|
| L/E | 600; then 625 with umbral | A GS **range** shown before you craft; materials, skill, food, gear, trophies and the town buff move it (fully stacked: 595-600; see the earlier note's table) | [S] |
| R | 700 | **No longer a range**: you get the item at the stated GS, and buffs raise the maximum craftable GS. Prismatic materials alone reach about 645. 700 with chosen perks needs the Prismatic Scarab + Inductor, plus trophies, a full crafting set, jewellery and food | [S] |
| A | 725 | Through raid materials, not skill | [S] |
| N | 730 base; umbral to 800 | Crafted perk-slot gear always has 3 sockets + 2 fixed perks; a craft mod picks a fixed perk; Matrix Alloy makes tradeable 730 gear | [S] |

**Preparation that raised the crafted floor in L/E** [S, from the earlier
note]:
- trade-skill level: up to +25 to the maximum;
- materials: each lower tier of secondary material −5 to the minimum; a rare
  raw +5; a rare refined +15;
- crafting food: +15;
- crafter armour set and earring: +15;
- three crafting trophies: +5 each;
- the town buff.

In R the same buffs became "+max GS" instead of moving a range [S].

### 5.2 When each one wins

**Crafting wins on control:**
- you choose perks (craft mods, scarabs, seals);
- you are guaranteed a gear score;
- the result is tradeable (BoE), so a crafter can sell it.

**Drops win on:**
- **unique perks**: named items, artifacts, infixes, set pieces;
- **the top of the gear-score ladder** in eras where 725 came from the raid;
- **cost**: no daily-capped bars, no Inductor;
- **sometimes perks**: L/E drops could out-roll crafts at the same gear score.

**Watermark and Expertise (L/E) tilted the field toward drops.**
- Crafted and bought gear did not raise your watermark at launch [S].
- Expertise then *scaled down* gear above your level, crafted gear included.
  This caused the "crafting worthless" outcry [S].
- Amazon planned to exempt crafted gear [S], and the whole system was dropped
  in R [S].

### 5.3 How Amazon kept both relevant

1. **Drops feed crafting.** The key crafting inputs are themselves loot:
   - craft mods, Golden Scarabs and trophy materials (elite chests);
   - Dark Matter and gypsum orbs (activities);
   - Gorgon's Eyes and raid materials (raid);
   - Tolvium (luck-gated gathering).

   A lucky drop is often an input, not an item.
2. **Crafting is the "smart loot"** that fixes a bad roll. Its cost is time
   (daily and weekly gates), not RNG.
3. **Unique powers stay drop-only.** Named items, artifacts and infixes give
   the reason to run content even when crafting can reach the cap.
4. **Binding is used as a dial.** Top crafting components were made BoP, so
   crafters must play. The outputs stay BoE where Amazon wanted a market (N's
   tradeable 730 gear).

---

## 6. Bind rules and the trading post

### 6.1 Bind rules

- **The rule and its reason.** Every equippable item has a BoE or BoP flag,
  added in alpha. Amazon's reason: "an important step to protect our item
  economy and keep demand for quality items high". An equipped item leaves the
  market, which makes room for new sales or for salvage into repair parts [S].
- **What is BoE** (tradeable until worn):
  - open-world drops, including the classic elite-chest legendaries [S];
  - most crafted gear [M];
  - PvP perks were moved to BoE [S];
  - N's Matrix Alloy 730 gear [S].
- **What is BoP:**
  - expedition gear (players complain it "can't be traded to party members")
    [S];
  - the Azoth Inductor [S];
  - many high-end crafting components from R [S];
  - artifacts (cannot be salvaged or discarded [S]; BoP [M]);
  - gypsum-cast items, OPR, raid and season-pass gear [M].
  - **Conflict:** guides disagree on whether event-pattern crafts are BoE and
    expedition-replica crafts BoP [S].
- **Tradeable materials:** Golden Scarabs and armour matrices [S]; schematics
  [S]; gathered rares [S].

### 6.2 What sells, and how loot feeds the market

**The market itself.**
- One order book across all towns from patch 1.1 [S].
- No NPC buyer, so prices have no floor [S].
- Unwanted gear goes to salvage [S].

**What sells.** The high-value goods are mostly *capped or luck-gated inputs*:
- schematics (Golden Steel chest: 150k-600k);
- Golden Scarabs (500+);
- trophies (2,500-4,000);
- Runes of Holding;
- Asmodeum, Glittering Ebony, Runic Leather;
- consumables [S].

Raw materials go toward worthless because everyone gathers [S, from the
earlier note].

**Coin from loot.** About 80% of expedition-boss coin was moved into elite
chests and breach bonuses in 2022 [S]. Later reports tracked PvP as about a
fifth of coin creation [S, from the earlier note].

**How loot feeds the market.**
- A drop you cannot use becomes coin because it is BoE or tradeable.
- Daily caps on scarabs and Asmodeum hold their prices up.
- BoP on endgame gear keeps the best power *off* the market.
- So the market carries the inputs and mid-tier gear, and the top power has
  to be earned.

---

## 7. Time gates and what they did to behaviour

| Gate | Limit | Era | Conf. |
|---|---|---|---|
| Elite chests | Once per character per day (23 h by nwdb; daily 5 AM EST by fandom) | All | [S] |
| Gypsum, each colour | Per-colour daily cap; none for 23 h once an orb's worth is earned; each cast type once per day | E onward | [S] |
| Golden Scarab | 10 looted per day | Brimstone Sands onward | [S] |
| Asmodeum, Prismatic ingot (and siblings) | 10 per 24 h | L onward / R | [S] |
| Chromatic Seal / Prismatic Scarab / Azoth Inductor | Daily / weekly / weekly | R onward | [S] |
| Expeditions | Tuning orbs (craft-limited) → 15 per day and 25 mutated per week → 35 mutated per week | L → mid-2022 → A | [S] |
| Random-queue bonus caches | 2 per day (expedition), 1 per day (mutator) | A | [S] |
| OPR Ruby gypsum | First 2 matches per day | E | [S] |
| Raid | Loot once per boss per week | A | [S] |
| World bosses | 3 bonus boxes per day; the 725 weapon once per week, guaranteed after 12 boxes | A (2025) | [S] |
| Gorgon's Eyes | 90 per week | A (Season 8) | [S] |
| Cursed Mists | Coconut weekly; Gold Key once per week | A | [S] |
| Umbral Crystals | 4,000 per week | N | [S] |
| Expertise | One guide: "only … level up the expertise of each item slot once per day" | E | [S, single source] |

**What the gates did to behaviour:**

- **Routes replaced exploration.** Per-player daily elite chests produced the
  elite chest run: a zerg of 20-50 people on a fixed loop at reset [S]. It was
  efficient and social, but it was a commute, not a discovery.
- **Login chores.** Daily cooldowns on Asmodeum, gypsum and seals rewarded
  logging in every day to "spend your dailies", whether or not you wanted to
  play. Players described them as chores [M, consistent with S complaints].
- **Pity and guarantees.** Each new gate added a guaranteed outcome next to the
  random one:
  - E: the watermark's soft pity [S];
  - E: gypsum's guaranteed bumps, with random bump odds then cut [S];
  - A: world bosses' 12-box guarantee [S];
  - Season 8: the 60-Eye guaranteed 725 box [S].

  The pattern was to keep the jackpot, but put a floor under it.
- **Alts.** Weekly per-character lockouts (the raid) pushed people to gear
  alts [S].
- **Caps reached too fast.** By A, once the weekly items were collected there
  was little to chase. MassivelyOP's verdict: "effectively capped out" [S].
- **First-time bonuses.** Expedition quests paid one-time rewards at launch
  [M]. Season 6 made expedition quests repeatable [S], and the
  random-queue caches (A) reward the first runs each day [S].

---

## 8. Sources (search results consulted 2026-11-12)

Only search-result excerpts were read. Fetching any of these pages was blocked.

Loot tables, luck
- https://www.tamtoucan.com/public/new-world-loot-luck
- https://zegeger.net/category/new-world/loot/
- https://zegeger.net/global-luck/
- https://www.newworldpacifist.com/resources/rng-explained
- https://forums.newworld.com/t/luck-faq-best-thing-ive-seen-on-luck-is-it-up-to-date/762512/15
- https://devtrackers.gg/new-world/p/7f365209-dev-blog-luck-faq
- https://forums.newworld.com/t/follow-up-questions-about-luck-can-a-dev-please-respond/702690
- https://www.nme.com/news/gaming-news/new-world-player-massacres-over-1000-boars-to-prove-how-luck-works-3086674
- https://www.studioloot.com/new-world/articles/how-luck-works-in-new-world/
- https://newworld.fandom.com/wiki/Luck
- https://game8.co/games/New-World/archives/345620
- https://newworld.wiki.fextralife.com/Perks
- https://thegamescabin.com/what-is-luck-in-new-world-how-to-get-more-luck/
- https://steamcommunity.com/app/1063730/discussions/0/4477133359553264656
- https://www.altchar.com/game-news/new-world-luck-testing-reveals-how-the-stat-works-ajv0B3g4GUxM
- https://mein-mmo.de/en/new-world-brings-a-large-patch-1-1-with-over-100-adjustments-patch-notes,750458
- https://consolepcgaming.com/new-world-flagging-for-pvp-will-increase-the-luck-of-getting-higher-gear-score
- https://gamepur.com/?p=239947 (Minor Loot Luck Trophy)
- https://ptr.nwguide.cn/db/item/house_housingitem_buff_luck_bonus_t3

Items, rarity, perks, gear score
- https://www.newworld.com/en-us/news/articles/items-in-new-world
- https://newworldnews.org/gear-guide/
- https://nwdb.info/guides/upgrading-items-to-legendary-with-umbral-shards
- https://mein-mmo.de/en/new-world-everything-about-luck-how-to-more-easily-get-rare-weapons-and-items,740965
- https://www.pcgamesn.com/new-world/gear-best-max-level-progression
- https://www.icy-veins.com/new-world/named-item-guide
- https://www.icy-veins.com/forums/topic/61707-high-watermark-system-and-drop-sources-officially-explained/
- https://newworld.fandom.com/wiki/High_Watermark_System
- https://www.gamerevolution.com/guides/695546-new-world-gear-score-watermark-explained-how-does-it-work
- https://mein-mmo.de/en/how-does-loot-actually-work-in-new-world-a-developer-explains-it-in-detail,734725/
- https://gamerjournalist.com/new-world-watermark-gear-score/
- https://forums.newworld.com/t/dev-blog-end-game-update/619609/1
- https://devtrackers.gg/new-world/p/077f10cc-dev-blog-end-game-update-part-2-january-update
- https://newworldfans.com/articles/how-gear-score-and-expertise-works-in-new-world
- https://www.gamespot.com/articles/new-world-winter-convergence-update-brings-new-quests-big-endgame-changes-full-patch-notes/1100-6499064/
- https://www.newworld.com/en-us/news/articles/loot-biasing-deep-dive
- https://mmos.com/news/new-world-loot-biasing-deep-dive
- https://mein-mmo.de/en/new-world-mogelt-loot-steam,1084103/
- https://devtrackers.gg/new-world/p/0a160c41-new-world-forged-in-aeternum-community-q-a-november-2023

Gypsum, umbral, expertise
- https://nwdb.info/guides/gypsum-farming-guide
- https://game8.co/games/New-World/archives/353008
- https://newworldnews.org/everything-you-need-to-know-about-gypsum/
- https://www.touchtapplay.com/how-to-get-gypsum-in-new-world-gypsum-guide/
- https://nwnews.info/guides/expertise-system-guide/
- https://www.newworld.com/en-us/news/articles/january-expedition-mutator-update
- https://vulkk.com/2022/01/25/new-world-update-1-3-mutated-expeditions-changes-overview/
- https://www.aoeah.com/news/776--new-world-dungeon-mutation-system-guide-13-patch---rewards-difficulty-levels-rotations-scoring-umbral-shard--more
- https://steamcommunity.com/sharedfiles/filedetails/?id=2743738153 (umbral cost table)
- https://gamerant.com/new-world-umbral-shards-guide-tips-how-to-use-get/
- https://www.studioloot.com/new-world/articles/perfect-salvage-in-new-world
- https://www.studioloot.com/new-world/articles/new-world-umbral-shards/
- https://ghost.nwdb.info/new-world-trade-skill-aptitude-explained/

Expeditions, mutations, raids, world bosses, breaches
- https://www.newworld.com/en-gb/news/articles/summer-medleyfaire-update
- https://www.mmorpg.com/news/new-world-june-dev-update-talks-july-ptr-expedition-changes-removing-tuning-orbs-and-better-loot-2000125238
- https://vulkk.com/2022/10/18/new-world-1-7-brimstone-sands-update-changes-overview-and-patch-notes/
- https://www.studioloot.com/new-world/articles/new-world-dungeon-mutation-guide/
- https://www.newworld.com/en-us/news/articles/cross-world-expeditions-with-improved-group-finder
- https://thexamxam.com/2025/09/new-world-aeternum-daily-and-weekly-gold-sources-guide/
- https://www.newworld.com/en-us/game/releases/season-of-the-divide
- https://overgear.com/guides/new-world/season-of-the-divine-overview/
- https://www.newworld.com/en-us/news/articles/the-hive-of-the-gorgons-raid-deep-dive
- https://www.icy-veins.com/new-world/hive-of-gorgons-raid-walkthrough
- https://newworldnews.org/hive-of-gorgons/
- https://mmonster.co/blog/nw-the-hive-of-gorgons-raid-guide
- https://www.newworld.com/en-gb/news/articles/expeditions-unleashed-world-bosses-emerge
- https://studioloot.com/articles/new-world-corrupted-breach-guide
- https://newworld.wiki.fextralife.com/Into+the+Breaches

Chests, schematics, rare materials
- https://nwdb.info/db/gatherable/chestelitet5
- https://nwdb.info/db/gatherable/chesteliteancientt2
- https://newworld.fandom.com/wiki/Elite_Chest_Runs_(Guide)
- https://gamerjournalist.com/new-world-provisions-crates-locations/
- https://newworld.fandom.com/wiki/Provisions_Containers
- https://www.mmoexp.com/News/the-ultimate-guide-to-epic-chest-runs-ecrs-in-new-world.html
- https://www.iggm.com/news/new-world-season-10-chest-runs-in-nighthaven-elite-loot-farming
- https://nwdb.info/guides/how-to-get-the-orichalcum-braced-storage-chest-schematic
- https://www.aoeah.com/news/2079--new-world-rare-furniture-guide-beginneradvancedexpert-guide-to-rare-furniture
- https://www.studioloot.com/new-world/articles/new-world-golden-scarab-guide/
- https://progameguides.com/new-world/where-to-find-golden-scarabs-in-new-world/
- https://nwdb.info/db/recipe/ingott51 (Asmodeum)
- https://gamerjournalist.com/new-world-asmodeum/
- https://game8.co/games/New-World/archives/343785 (Tolvium)
- https://ptr.nwdb.info/db/recipe/ingott53 (Prismatic Ingot)
- https://nwdb.info/db/recipe/prismaticscarab
- https://newworldnews.org/armour-crafting/
- https://www.newworld.com/en-us/news/articles/crafting-in-new-world
- https://game8.co/games/New-World/archives/343187 (craft mods)
- https://newworld.fandom.com/wiki/Craft_Mods
- https://www.aoeah.com/news/1825--new-world-how-to-get-all-loot-for-legacy-of-crassus-event--farm-named-items-from-legacy-of-crassus-patch-183

Rise of the Angry Earth, Aeternum, Season 10
- https://www.newworld.com/en-us/news/articles/ptr-rise-of-the-angry-earth
- https://www.newworld.com/en-us/game/releases/rise-of-the-angry-earth
- https://www.newworld.com/en-us/news/articles/rise-of-the-angry-earth-announcement
- https://www.gamespot.com/articles/new-worlds-first-paid-expansion-adds-a-feature-fans-have-requested-for-years/1100-6517280/
- https://primagames.com/tips/new-world-rise-of-the-angry-earth-full-patch-notes-listed
- https://www.heartlessgamer.com/2023/09/new-new-world-gear-progression-changes.html
- https://www.heartlessgamer.com/2023/09/new-new-world-crafting-changes.html
- https://www.heartlessgamer.com/2023/10/poor-progression-model-for-named-items.html
- https://www.heartlessgamer.com/2025/10/nighthaven-week-later.html
- https://massivelyop.com/2023/08/30/previewing-new-worlds-rise-of-the-angry-earth-expansion-artifact-gear-endgame-crafting-and-onward/
- https://newworldnews.org/rotae-survival-guide/
- https://newworldnews.org/upgrading/
- https://thexamxam.com/2023/10/10-things-you-need-to-know-about-the-new-world-rise-of-the-angry-earth-expansion/
- https://www.aoeah.com/news/2773--new-world-expansion-700gs-guide-10-best-ways-to-reach-700-gear-score-fast
- https://guided.news/en/guides/new-world-gear-score-system-guide-how-to-reach-700-gs/
- https://mein-mmo.de/en/new-world-artifacts-guide-to-the-special-armors-and-weapons-and-where-you-can-find-them,1043103/
- https://www.icy-veins.com/new-world/artifacts-guide
- https://www.newworld.com/en-us/game/releases/season-of-opportunity
- https://inara.cz/morps/article/40560 (Season of Opportunity)
- https://www.godisageek.com/2024/12/new-world-aeternum-season-7-detailed-starting-january-21st
- https://newworld.fandom.com/wiki/Seasons
- https://www.studioloot.com/new-world/articles/how-to-get-to-700-gear-score-in-new-world/
- https://gamesfuze.com/guides/new-world-aeternum-how-to-get-725-gs-gear-fast/
- https://www.icy-veins.com/new-world/mystic-doubloon-farming-guide
- https://gameboost.com/blog/new-world-aeternum-gold-cursed-coconut
- https://www.mmopixel.com/news/how-to-easily-get-level-725-gear-score-weapon-in-new-world-aeternum-710-gear-score-named-gold-cursed-item-upgrade
- https://newworldnews.org/new-world-aeternum-sneak-peek/
- https://massivelyop.com/2024/11/04/vitae-aeternum-how-to-fix-new-world-aeternums-endgame-starting-with-rewards-and-content-relevance/
- https://massivelyop.com/2024/10/16/vitae-aeternum-new-world-aeternum-leaves-veterans-casuals-and-pc-players-behind/
- https://www.icy-veins.com/new-world/news/season-10-patch-notes/
- https://www.icy-veins.com/new-world/news/more-new-world-season-10-details-revealed/
- https://www.newworld.com/en-gb/news/articles/season-10-nighthaven-announcement
- https://www.mmorpg.com/news/full-details-revealed-for-new-world-aeternums-season-10-nighthaven-update-with-major-overhauls-and-new-features-2000136302
- https://thexamxam.com/2025/10/new-world-aeternum-nighthaven-gearing-and-perk-charms-guide/
- https://www.mmojugg.com/news/new-world-s10-nighthaven-bis-gear-crafting-guide.html
- https://www.mmogah.com/news/new-world/new-world-season-10-nighthaven-gear-system-overhaul-explained-new-runes-new-artifacts-and-new-goals
- https://gamesfuze.com/guides/new-world-season-10-gear-guide/
- https://www.icy-veins.com/new-world/umbral-crystals

PvP, faction, season pass, fishing, binding, trading post
- https://game8.co/games/New-World/archives/348199 (Outpost Rush)
- https://www.studioloot.com/new-world/articles/outpost-rush/
- https://steamcommunity.com/sharedfiles/filedetails/?id=2640045504
- https://www.studioloot.com/new-world/articles/pvp-reward-track
- https://mein-mmo.de/en/new-world-how-to-quickly-get-faction-tokens-and-what-you-need-them-for,737892
- https://www.icy-veins.com/new-world/new-world-factions
- https://vulkk.com/2023/04/04/new-world-season-pass-everything-you-need-to-know/
- https://www.newworld.com/news/articles/season-pass-free-and-premium-reward-tracks-faq
- https://noping.com/blog/new-world-unveils-all-100-season-pass-rewards-from-skins-dyes-supplies-to-emotes-and-two-new-artifacts
- https://gamesfuze.com/guides/new-world-fishing-luck-guide-how-to-catch-oysters/
- https://www.icy-veins.com/new-world/fishing-trade-skill-guide
- https://mmos.com/news/new-world-alpha-update-adds-a-new-zone-expedition-and-bind-on-equip-pickup-flags-for-all-equips
- https://steamcommunity.com/app/1063730/discussions/0/3090023948270337567/ (BoP complaints)
- https://forums.newworld.com/t/bind-on-pickup-crafted-iitems/583077
- https://www.slythergames.com/2021/10/01/new-world-what-to-do-with-old-gear/
- https://www.pcgamesn.com/new-world/money-farm-trading-posts
- https://www.mmogah.com/news/new-world/new-world-aeternum-season-9-gold-farming-guide-4-proven-methods-to-get-rich-fast
- https://www.mmopixel.com/news/new-world-aeternum-season-10-economy-guide-best-items-to-trade-make-gold

---

## Summary table

| Source | What it drops | How often | Tradeable? | Role in progression |
|---|---|---|---|---|
| Open-world normal mobs | Coin, family materials, tiered gear, rare mods and schematics | Unlimited (respawn) | Materials yes; gear mostly BoE | Levelling gear; bulk materials |
| Open-world named mobs | Own named items (about 4-10% each, by source), named sets 25%, Obsidian gypsum (E) | Unlimited (respawn) | Mostly BoE [M] | First "target" items; Expertise bumps in E |
| Provisions, supply and ancient chests | Cooking inputs; reagents, tools, low gear; arcane materials; rare schematics | Per player, about 60 min (provisions) | Yes | Background drip; the lottery ticket for schematics |
| Elite chests | Best open-world gear (GS floor by POI), trophy materials, Golden Scarabs (10/day), schematics (0.00023% for the famous one), infixes (N) | Once per chest per day | Gear BoE; materials yes | The daily chest-run economy; the main source of tradeable rares |
| Expeditions and mutations | Boss tables with expedition named items (luck helps most here), umbral (E), artifacts (M, R+), Gorgon's Eyes (A), 4-socket gear (M3, N) | 15/day (2022); 25 → 35 mutated per week | Gear mostly BoP | The core endgame gear ladder |
| World bosses | Named on ClampMax tables (L/E); 710 sets plus a weekly 725 with a 12-box pity (A) | Weekly / event | BoP [M] | Event-driven chase |
| Raid (Hive of Gorgons) | 725 Hoplite item and 700-725 Gorgon's items per boss, Eyes, tokens, seals, 725 schematics | Each boss once per week | BoP [M] | Top of the GS ladder in A |
| Corrupted breaches | Coin, Azoth, standing, level-scaled cache, Amethyst gypsum, Slivers (Major only) | Event spawns | Mostly yes [M] | Open-world group filler |
| OPR, wars, arenas, PvP track | OPR cache (2.5% named), Ruby, Citrine and Garnet gypsum, tokens, Azoth Salt, artifacts | Per match; gypsum 2/day | Gear BoP [M] | Parallel PvP ladder; flag luck +10% / +30% (1.1) |
| Cursed Mists / Well of Fortune | Doubloons → 700+ crates; Apex chest guarantees 725 (needs the weekly Coconut) | Weekly Coconut and Gold Key | BoP [M] | A PvP-zone route to cap |
| Faction shop | Inductor (weekly, BoP), seals, orbs, Runes of Holding, faction gear | Rank-gated, some weekly | Mixed | Turns faction play into crafting inputs |
| Town board and quests | Coin, XP, standing; fixed quest gear (no loot bias) | Board refreshes; quests one-off | — / BoP [M] | Levelling and standing, not loot |
| Season pass | Cosmetics, tokens, 600 legendary (Season 1), artifacts (later) | 100 levels per season | BoP [M] | Long-season retention |
| Fishing | Fish, treasure chests, legendary fish (under 5%), mods via salvage | Hotspots 15-90 min | Yes [M] | A luck-heavy side jackpot |
| Salvage | Coin, repair parts, rare materials; Perfect Salvage 5%; 50 umbral per legendary (E) | Per item | — | Junk sink; minor input |
| Gypsum orbs and casts | A guaranteed item of a chosen type plus an Expertise bump (E); kiln upgrades (R) | Per-colour daily caps; each cast once per day | Cast items BoP [M] | The deterministic floor under random loot |
| Gathering rares | Rare siblings at thresholds above 100k; Tolvium (1,800 luck) | Per node; respawn | Yes | Inputs for Asmodeum and top crafting |
| Crafting, Aptitude | Rolled gear (L/E) or set gear (R+), chosen perks; Aptitude caches with mods and schematics | Bars 10/day, scarab weekly | Mostly BoE | Controlled path to cap; the market's goods |
| Trading post | Anything tradeable | Any time | — | Turns any lucky drop into coin |

## Which three mechanics do most of the work, and why

Three things do most of the work.

**1. Every drop is a fresh, legible roll with a known ceiling.** Colour is
simply perk count, and the slots unlock at visible gear-score thresholds. So
even an ordinary green has a small chance of being a god roll you can read at
a glance, and the last few points of gear score unlock a whole extra slot.

**2. Named targets at a known address, behind odds you can improve.**
- The Lazarus Bow comes from Cilla, Tolvium from Orichalcum veins, the
  storage-chest schematic from elite chests in 50+ zones.
- Luck works through thresholds set above the base roll: investment (trophies,
  food, gear, the PvP flag, the right hotspot) turns "impossible" into "rare".
- Pity counters and guaranteed boxes cap the bad streaks.

The player always knows what they are hunting, where it lives, and that their
preparation moved the odds.

**3. One open market that turns luck into wealth.** Because most open-world
gear, all rare materials and all schematics are tradeable, a drop you cannot
use is still a windfall. The famous schematic was worth 150k-600k coin. And
because the top inputs are capped daily (scarabs, Asmodeum), their value lasts.

Time gates are not on this list because they pace the excitement rather than
create it. When Amazon leaned on them too hard, players experienced them as
chores and as "capped out". Our earlier slices copied only part of mechanic 2
(a tracked recipe from kills). They left out the readable per-drop roll and
the market that gives every drop a price, which is likely why they felt flat.
