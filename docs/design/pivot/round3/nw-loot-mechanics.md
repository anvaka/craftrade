# How loot works in New World (2021 to 2025), with numbers

Written 2026-11-12 for the round-3 redesign. Subject: Amazon Games' *New World*
(launched 28 Sep 2021) and its relaunch *New World: Aeternum* (15 Oct 2024).
This file covers the whole loot model. Gathering, refining, the town and the
economy are already in `../research-new-world.md`, and this file only repeats
them where loot depends on them.

## How to read this file

- **[S]**: I read the claim first-hand on the page or data listed at the end.
  These sources are:
  - official patch notes and dev blogs on newworld.com;
  - nwdb.info item, recipe and gatherable data, plus its guides;
  - the fandom wiki through its API (wiki text, which often quotes
    developers).
- **[s]**: the claim comes only from a web-search excerpt, so it is weaker than
  [S].
- **[M]**: from memory of the game, or an approximation.
- **[D]**: arithmetic I derived from an [S] model. It is not a measured value.
- **Conflict:** where two sources disagree, both are given and neither is
  picked silently. Several conflicts from the first draft were settled by
  first-hand reads and are marked "settled".
- **Limits of this research.**
  - **No raw roll weights.** nwdb exposes loot *contents* and their tag
    conditions, but not the raw roll weights, so most per-item percentages come
    from developer posts and guides.
  - **Blocked hosts:** nw-buddy.de (it redirects to www.nw-buddy.de),
    tamtoucan.com, zegeger.net, Reddit, Icy Veins, MassivelyOP and PC Gamer.
    Claims from those sites stay [s].
  - **Search budget:** the session's web-search budget ran out before the
    first-hand reads began. Nothing below needed a new search.
  - **Patch-specific numbers:** many numbers are only true for one patch. The
    *shape* of each system is more reliable than any single value.
- **Status of the game.** Season 10 (Nighthaven, 13 Oct 2025) was announced as
  the last content release [S, nwdb "New World Shutting Down", 28 Oct 2025].
  The earlier note records delisting on 15 Jan 2026 and server shutdown on 31
  Jan 2027 [s].

### Eras used below

| Code | Era | Dates | Loot-relevant headline |
|---|---|---|---|
| **L** | Launch to patch 1.1 | 28 Sep 2021 to 18 Nov 2021 | Per-slot "high watermark"; gear score cap 600 [S] |
| **E** | Expertise era: patch 1.2 (Dec 2021), patch 1.3 "Mutators" (25 Jan 2022), Summer Medleyfaire (27 Jul 2022), **Brimstone Sands** 1.7 (18 Oct 2022), Season 1 (3 Apr 2023), Season 2 (5 Jul 2023) | Dec 2021 to Sep 2023 | Expertise and gypsum; umbral shards and cap 625; tuning orbs removed; season pass [S] |
| **R** | **Rise of the Angry Earth** (RotAE, Season 3), Season 4 (11 Dec 2023), Season 5 (29 Mar 2024) | 3 Oct 2023 to Oct 2024 | Expertise and umbral removed; cap 700; crafting stops rolling a range; artifacts; loot biasing [S] |
| **A** | **Aeternum** (Season 6 "Season of Opportunity") to Season 9 (Season 7 from 21 Jan 2025; Season 8 "Divide" from 13 May 2025; Season 9 "Banner" from 29 Jul 2025) | 15 Oct 2024 to Oct 2025 | Cap 725; Hive of Gorgons raid; Cursed Mists; world bosses [S] |
| **N** | Season 10 "Nighthaven" | 13 Oct 2025 onward | Cap 800, level 70; up to 4 charm sockets; umbral back as a capped currency; attribute perks removed; set bonuses; Catacombs [S] |

---

## 0. The pipeline in one paragraph

A loot event is a kill, opening a chest, gathering, finishing an expedition, or
opening a cache. Each event rolls one or more **loot tables**. Here is the
developers' own description [S, quoted on fandom "Luck"]:

> "Drop tables are divided up into overall rarities, with rarer groupings of
> items living 'higher' on the roll table than more common items … a 'Common'
> set, 'Family' sets, and 'Elite' sets. Rarer still are the more
> context-specific Expedition sets and Named Items."

The developers also define "bucket": "a type of generic 'container' that we
can attach to a loot roll so that there are lots of potential options when you
get loot from a specific source" [S, Loot Biasing Deep Dive, 26 Jan 2024].

**Tags filter what can drop.** Each creature carries loot tags. For example,
the named elite Orellani carries `angryearth, elite, protector, named,
reekwater, eternalpool, epoi` [S, nwdb]. Each bucket entry carries conditions
on content level, player level, zone or "Elite POI", for example
`{!clvl}50+` or `{!plvl}65+` [S, nwdb].

**Each loot event, step by step:**
1. **The roll.** Nearly all tables roll 0 to 100,000. The developers give this
   value for trees [S]; the figure "82% of tables" is a community count [s].
2. **Luck.** Luck adds integer points to that roll [S].
3. **The bucket.** If the roll lands in a bucket, one item is picked from the
   entries whose tags match [S].
4. **Gear score.** For gear, the gear score is rolled first [S, nwdb].
5. **Perks.** The perks come next, but only from perk buckets eligible at that
   gear score [S, nwdb].
6. **Rarity.** The rarity colour is the number of filled perk slots [S].
7. **Named items and artifacts** skip step 5: their perks are curated [S].
8. **Bind flag.** Last, the item carries a flag: bind-on-pickup (BoP) or
   bind-on-equip (BoE) [S].

**What luck does and does not touch.** Luck acts only on the roll position. It
does not change whether a bag drops, the gear score or the perk count [S, dev
blog quoted on fandom].

---

## 1. Every source of items and materials

### 1.1 Open-world mobs (normal, elite, named)

**What drops** [S, dev blog quoted on fandom]:
- **Equipment comes in layered sets.** Common sets have the broadest perk
  variety. "Family sets have slightly more narrow perk roll variety and a
  higher chance to roll perks". "Elite sets only come from Gold-Bar (elite)
  enemies and have narrower perk rolls and an even higher chance to roll
  perks."
- **Other drops:** coin, family materials, consumables, rare craft mods and
  schematics [S].
- **Bags are not guaranteed.** One nwdb guide notes that "most normal creatures
  only drop a bag around every 10 kills", while named enemies "guarantee bag
  drops" [S, nwdb gypsum guide, Dec 2021].
- Dropped loot lasts 3 minutes and no one else can pick it up [S, fandom
  "Equipment"].

**Gear score of drops by mob level.**
- *L:* gear score "normally progresses with character level" until level 60.
  From 60 the per-slot watermark governs (see 2.4) [S, fandom HWM].
- *E:* from Summer Medleyfaire (Jul 2022), there is "a small chance 600 Gear
  Score items can come from level 59+", and level-60 players "should earn more
  Epic and Rare loot instead of Uncommon" [S].
- *R onward:* "adjustments to the Gear Score drops from all creatures based on
  their level" replaced Expertise [S, RotAE notes]. A guide gives open-world
  mobs up to 690 and named enemies and chests up to 700 [s].

**Named mobs.**
- **R zone sets:** "Higher leveled zones now have 2 sets of named items. 1 set
  can be dropped by AI in the zone, and 1 set can be dropped by named AI and
  elite chests within Elite POI's" [S, RotAE notes]. The current data shows one
  such set: the Sporelight set, restricted to Elite POIs in Elysian Wilds,
  player level 61+ [S, nwdb].
- **Per-item rates are community figures.** A community dump puts a named
  mob's `ZoneNamedItems` bucket at 50%, which makes one specific bow 4.17% [s].
  Named item *sets* dropping from named mobs were cut from 50% to 25% [s].
- **Conflict on luck:** a forum post says it is a flat 10% and that luck does
  not apply [s]. The official Luck FAQ says global luck raises named drops
  from enemies [s].
- **Gypsum (E):** Obsidian Gypsum was "an 80% drop from any Named Elite level
  60+ enemy when they drop a bag", on a 10-13 minute per-enemy cooldown [S,
  nwdb].
- **Trophy materials:** each family's legendary trophy material drops from one
  named boss. For example, The Surgeon drops the Ancient Mandible, which is
  needed for the Major Ancients Combat Trophy. Usually "you will receive 100x
  Shards before receiving a legendary artifact" [S, fandom].

**Global named list.** A rare list (Absolute Terror is the usual example) sits
on a ClampMax table where luck barely helps [s].

**Tradeability:**
- Common (no-perk) items do not bind [S, fandom].
- Most open-world gear is BoE [S, fandom "Elite Chest Runs": "Bind on Equip"].
- From N, infix items are BoP [S, nwdb].

**Open-world PvP.** Before R, a flagged player who had been alive 10 minutes
dropped loot 75% of the time, and after 33 minutes 100%. From R the odds are
50% after 5 minutes and 75% after 10 [S, RotAE notes].

### 1.2 Chests

**Chests are per-player.** "This cooldown is not shared, so multiple players
may harvest from the same node at the same time" [S, fandom "Containers"].
Larger containers of a type "provide more resources … but have the same loot
pool" [S].

**What the current data shows.** These figures come from nwdb's Season 10 data
[S, nwdb gatherables].

| Container | Respawn | Entries in its loot list | Notable contents |
|---|---|---|---|
| Supply Cache, Supply Crate, Ancient Urn, Ancient Coffer (small and medium) | Not exposed by nwdb (there are ordinary per-player cooldowns) [M] | About 1,050 (shared list) | Refining materials, dyes, trade-skill clothing, 30 furniture schematics, potions. Flame Core 10% |
| Supply Stockpile, Ancient Chest (large) | As above | About 3,970 | Adds weapons and armour, 274 furniture schematics, and in N, charms that need at least 500 luck |
| Provisions Crate / Stockpile | About 60 min [s] | About 53 | Cooking ingredients by region; food recipes. Food-recipe drop rates were cut from 5% to 2% (small) and from 20% to 5% (large) in Season 5 [S] |
| Alchemy Crate / Stockpile | — | About 94 | Wisps, essences, motes, lodestones, alkahest |
| **Elite Supply Chest / Elite Ancient Chest** | **82,800 s = 23 h** per player; 5 s to open | About 3,074 | Gear (1,615 weapons, 557 armour), 296 schematics, Dark Matter, trophy materials, Mystic Doubloons, Void Essence (luck-gated). In N: charm materials that need at least **1,000 luck**, and infix items in 65+ areas. In N each chest also gives +15 umbral and +5 territory standing |
| Elite Grave Offerings, Glyph Chest (Brimstone Sands), Elite Beast Hoard (Elysian Wilds) | 23 h | About 2,060-3,680 | As elite chests, plus **Golden Scarab** and Glyph Stones (Brimstone) |
| Cursed Hoard (Cursed Mists PvP zone) | 900-1,000 s | About 153 | Cursed Doubloons, **Goldcursed Coconut**, charm materials |
| Locked Doubloon Cache | Weekly key | 1 | Mystic Doubloons |
| Catacombs Explorer's Chest (N) | — | — | Coin and Catacombs currency |

**How an elite chest rolls.** Its loot table IDs split the open into separate
rolls: `chestlootelite`, `chestlooteliteitemroll`,
`chestlooteliteitembonusroll` and `chestlootelitefurnitureroll` [S, nwdb
lootTableIds of the storage-chest schematic]. So one opening makes an item
roll, a bonus item roll and a furniture roll [D, from the table names].

**Reset.**
- **Conflict:** a fixed daily reset at "5:00am EST" (fandom guide) [S], or a
  23 h per-chest respawn (nwdb data) [S]. Both can be true: the data timer is
  23 h, and players describe it as daily.
- **The elite chest run** is built on this reset: 20-50 players following a
  fixed route, for example "CK → Imp → Mines → Myrk → Malv → Pool → Siren" [S,
  fandom].

**Other elite-chest facts:**
- **Coin.** From Jul 2022, elite chests had a 35% chance of a "Lost Sack" of 500
  coin. This came with moving "roughly 50%" of expedition-boss coin into elite
  chests and breaches [S, Summer Medleyfaire notes]. *Settled:* my first draft
  said 80%, from a search excerpt; the official figure is about 50%.
- **Gear-score floor.** From R, elite chests "set a unique floor value that Gear
  Score of looted items cannot be below based on the level of the POI" [S].
- **Transmog tokens** stopped dropping from elite chests in Aeternum [S].

**Golden Scarab** [s for the rates; S for the sources]:
- **Sources:** Brimstone grave offerings and glyph chests, Elysian beast hoards,
  and some event chests [S, nwdb lootTableIds].
- **Rates:** about 7% from Sulfur Pools grave offerings at max luck, and about
  2% from Heliopolis glyph chests [s].
- **Cap:** 10 per day [s].
- **Tradeable:** yes [S, nwdb shows no bind flag].

### 1.3 Expeditions (dungeons), mutations, boss and end chests

**Getting in.**
- *L:* one party member needed a **Tuning Orb**, crafted with a weekly limit
  [s].
- *Jan 2022:* clearing an expedition on normal gave its **Codex** and a
  one-time Mutated Tuning Orb [S].
- *Summer Medleyfaire (27 Jul 2022):* orbs were removed and replaced with "15
  Normal Expedition runs per player per day or 105 per week" and "25 Mutated
  Expedition runs per week" [S]. Orbs in bags became "armaments" caches: one
  loot roll on each boss, and for mutated orbs also 1,250 Umbral Shards [S].
- *R:* the weekly mutation limit was raised to 35 [S]. *Settled:* this was
  RotAE, not Season 8. The reset is Tuesday 05:00 [S, fandom].

**Loot structure.**
- Expedition chests and bosses roll their own tables, which include apparel,
  weapons, raw gems, craft mods, furnishing and named weapons [S, fandom].
- Expedition-specific named items sit on **AddToRoll** tables, so luck helps
  most here [s].
- *E:* every expedition boss guaranteed an Expertise bump [S, fandom HWM;
  official notes].
- *Jul 2022:* **Materia** was added "to help the player overcome the randomness
  of Expedition Loot". Salvaging an expedition named item, or killing the main
  boss, gives that expedition's Materia, which crafts "your desired drop" [S].
  In R, Materia recipes "will now always provide a GS 700 item" [S].

**Mutations.**
- *Patch 1.3 (25 Jan 2022)* [S]:
  - weekly rotation, 10 difficulty levels;
  - Bronze, Silver or Gold rank by score (time, kills, named takedowns, minus
    wipes and respawns);
  - "Drop rates for 'Named Enemies' in expeditions have been significantly
    increased".
- **Umbral per run (E)**, Bronze / Silver / Gold [S, nwdb guide]:
  - M1: 27 / 33 / 40
  - M5: 133 / 167 / 200
  - M6: 533 / 667 / 800
  - M10: 4,000 / 5,000 / 6,000
  - The step from M5 to M6 is about 4 times.
- *Jul 2022:* the unlock levels were shifted so lower difficulties dropped
  more variety, and every mutator could drop all 3 accessory types [S].
- *Brimstone Sands:* chests moved to the end of the run [s]. *Confirmed:*
  "There are no chests to loot throughout the Mutated Expeditions, they are all
  found at the end" [S, fandom].
- **R:**
  - Reduced to 3 levels: M1 balanced for 650, M2 for 675, M3 for 695+ [S].
  - A Gold cache needs 50,000 score and Silver 25,000. Caches hold Dense
    Mutator Materia and **Dark Matter** [S].
  - Dark Matter per rank (Bronze / Silver / Gold): M1 8 / 16 / 24, M2 16 / 24 /
    32, M3 24 / 32 / 40 [S, fandom].
  - Expedition **artifacts** drop only from mutated runs [S].
- **A (Season 6)** [S]:
  - Random-queue daily bonus raised to **3** regular (750 coin each) and **2**
    mutator (1,000 coin each); role bonuses 3 and 2.
  - Boss coin cut from a 15x modifier to 1.5x.
  - M3 completions pay 50 / 125 / 250 coin by tier.
  - *Settled:* the 2-per-day cap in the cross-world launch article is older.
    Aeternum raised it.
- **A (Season 7):** an inventory cache crafted from Damaged Gorgon's Eyes,
  Mutated Dust and an Azerit Focus gives "a few items that can roll up to 725".
  The stated intent was "pulling mutations back into the end game rewards
  loop" [S].
- **A (Season 8)** [S]:
  - M3 pays 1-3 / 4-7 / 8-12 Eyes by rank.
  - The raid and Sandwurm pay 30 Eyes.
  - Looting is capped at **90 Eyes per week**.
  - 60 Eyes craft the Mutator Raid Combo Rewards Box: "1 guaranteed 725 gear
    item, with a chance for up to two more 710-715 gear items, which have a 5%
    chance to be replaced by 725s".
- **N:** "4 socket gear only drops from M3" [s].

**Binding:** expedition gear is mostly BoP [M]. Players complain it "can't be
traded to party members" [s].

### 1.4 World bosses, raids, corrupted breaches, Catacombs

**World bosses.**
- *L/E:* elite-zone bosses drop named items from ClampMax tables [s].
- *A:* **"Expeditions Unleashed" (from 20 May 2025)** gives the full rule set
  [S, official article]:
  - **Normal Reward Box, unlimited per day:**
    - 100%: 1 weapon, armour or jewellery piece;
    - 66%: a GS 700 procedural item;
    - 33%: a named GS 710 legendary;
    - 100%: 2-3 potions.
  - **Bonus Reward Box, 3 per day:**
    - 100%: a named 710;
    - 100%: 1 Black Gypsum;
    - 100%: 25 Dark Matter;
    - **25%: a named GS 725 weapon, at most 1 per week**;
    - 10%: a skin-set box, 1 per week.
  - **Pity:** "after opening 12 Bonus Boxes": a guaranteed 725 weapon and skin
    box "if not already earned that week".
  - **Per boss:** each boss has its own 710 named set and one 725 weapon
    (Mahantaram: Footfall; Khepri: Beastfang).
- *Season 8:* "one guaranteed 725 GS item and multiple 710+ items" per event,
  with loot at GS 715-725 [S].

**Raids.**
- **Hive of Gorgons** (15 Oct 2024) [S, deep dive]:
  - The first 10-player raid.
  - "Increased the maximum Gear Score to 725".
  - Three raid-exclusive perks.
  - "A special new crafting material that players can use to craft 725 Gear
    Score equipment".
  - **Per boss** [s]: a Gorgon's Eye, one 725 Hoplite item and 1-2 Gorgon's
    items at 700-725, loot-biased.
  - **Lockout** [s]: once per boss per week, with one dissenting source.
  - **Schematics:** in Season 7 the raid's schematics "had their drop chance
    increased and more schematics are available". The developers said they were
    scarce at first "so that there could be some exciting high value drops …
    not intended to be a farmable item at launch" [S]. Season 9 added Gorgonite
    weapon schematics and improved the drop rate again [S].
- **Isle of Night** (N): a 10-player raid with three bosses [S]. Together with
  Catacombs and the PvP track, it is one of the three sources of the new
  **set-bonus** gear [S].

**Corrupted breaches.**
- *Jul 2022:* the Lost Sack of 500 coin is a 10% chance on minor breaches and
  100% on major ones [S].
- *E:* Amethyst Gypsum at 50% from level 60+ minor breaches and 100% from major
  ones [S, nwdb].
- **Caches** scale with your level and the breach's level [s]. Luck "does NOT
  affect inventory caches; such as Corruption Breach Caches" [S, fandom].
- **Slivers** come from Major caches only [s].
- *Season 2:* breach gear is "guaranteed to always roll 1 family bane or ward
  perk" [S].

**Catacombs (N).** Up to 3 players explore "a procedurally generated
dungeon". The challenge and reward "increased significantly each time a boss is
defeated". Players must choose between "pushing further … or safely making
their exit before time run out. Failure to make a safe exit results in loss of
the vast majority of the treasures collected". The mode pays two currencies,
Sterlings (anywhere) and Crowns (from the second boss on), spent at a vendor
[S, Nighthaven notes]. This is New World's own late version of a push-or-bank
loot loop.

### 1.5 PvP: Outpost Rush, wars, arenas, flagging, Cursed Mists

**Outpost Rush (OPR)** [s unless marked]:
- The cache comes win or lose: 2 OPR armour + 1 OPR weapon, sometimes a 4th
  item, with a 2.5% chance of a named item.
- Rewards need 501 points; 3,000 for the maximum.
- Ruby Gypsum is a "100% guaranteed drop" per full match, 2 per orb [S, nwdb].
- *R/Season 4:* OPR items are "guaranteed … loot biased", and level-65 caches
  roll an improved GS range [S].

**Wars, invasions, Influence Races.**
- Event reward containers "respect the current HWM and have a small chance of
  increasing it" [S, fandom].
- *R:* invasion caches were fixed to give named items, and "higher rarity
  caches now have an increased chance of giving a named item" [S].
- Influence Race caches roll a much better GS range [S, Season 4].

**Arenas.**
- Citrine Gypsum: 100% from an arena boss [S, nwdb].
- *Season 2:* "The first 2 arenas completed daily now award the player 1 extra
  weapon or armor each" [S].

**PvP reward track.**
- Paid in Azoth Salt.
- It held gypsum casts until R removed them [S].
- *Season 7:* "Artifacts are significantly more likely to roll on every level
  after PvP Track level 50" [S].
- *N:* one of the three set-bonus sources [S].

**Flagging luck** [S]:
- Patch 1.1 (18 Nov 2021) "Added a +10% Luck bonus and a +30% Gathering Luck
  bonus to players flagged for PvP".
- Season 1 updated the tooltip "to include the previously unmentioned Gathering
  and Global Luck bonuses".
- Pre-1.1 values of 1% / 3% come from one guide [s].

**Cursed Mists and the Well of Fortune** (A, FFA PvP in Cutlass Keys) [S
unless marked]:
- **Doubloons:** Cursed Doubloons become Mystic Doubloons once you leave the
  zone.
- **Goldcursed Coconut:** BoP. It drops from Cursed Hoards and from Season 7
  also from Spectral Chests, which then paid 45-55 doubloons (up from 14).
- **Season 9 changes:**
  - chests opened faster and paid twice the doubloons (large: 15 s,
    40-60);
  - "Non-Apex Crate Ranges are now 720-725 (was 685-710)";
  - grab bags: rare 690-700 and epic 700-720.
- **Apex Goldcursed Chest:** 1,500-1,800 doubloons plus a Coconut, and
  guarantees a 725 [s].

### 1.6 Faction shop, town board, quests, season pass

**Faction shop.**
- Paid in faction tokens + coin, and rank-gated [s].
- **Stock:**
  - **Azoth Inductor:** BoP; it crafts "an item up to GS700 with 3 specified
    perks" with Prismatic Scarabs [S, nwdb]; once per week [s];
  - **Chromatic Seal:** BoP [S, nwdb];
  - Gypsum Orb: BoP [S, nwdb];
  - Runes of Holding (only sold here), the T6 rune for expansion bags [S, RotAE
    notes];
  - faction gear [s].
- Faction purchases never raised the watermark [s].

**Town board:** coin, XP and territory standing; not a gear source [s/M].

**Quests:**
- fixed reward gear [M];
- loot biasing does not apply to quest rewards [s];
- Season 7 cut one repeatable quest's Gypsum Orb reward from 10 to 1 [S].

**Season pass** (from Season 1, 3 Apr 2023) [S]:
- Free and premium tracks, 100 levels each. In Season 6 premium cost 20,000
  Marks of Fortune.
- XP comes from the Season Journey, the activity card (from R: one free "Wild
  Card" stamp per daily login), gypsum-cast crafting, expedition bosses, OPR,
  arenas, wars, invasions and PvP kills.
- **Season 1 rewards:** mostly skins, plus "Legendary Gear (Gearscore 600
  Items)" [s].
- **Later seasons:** artifacts [S, Season 6 notes]. After rank 20, the PvP
  track paid named and prestige gear, Umbral Shards and Gypsum Orbs (Season 2)
  [S].
- **Binding:** BoP [M].

### 1.7 Fishing

- **Hotspots** [S, fandom]:
  - Broad hotspots respawn in 20-30 min, rare in 30-45 min and secret in 45-90
    min.
  - There are 80 in all: 27 broad, 25 rare, 28 secret.
  - Each depletes after about 10-20 fish.
  - A guide quotes hotspot luck at +159,900 (2-star) and +243,300 (3-star),
    so that a 3-star gives "only Treasure Chests and Legendary Fish" [s].
- **Bait** [S, fandom]:
  - rarity bait: +47% / +70% / +85%;
  - size bait: +150% / +300% / +500%.
- **Fishing trophies:** +2,500 / +5,000 / **+9,000** luck [S, fandom].
  *Settled:* the 3,500 / 5,000 figures were wrong. Season 1 "updated the text
  for the Basic and Major Fishing Trophies so they display the correct Luck
  values" [S]. The Ultimate Gathering Trophy gives +5,000 fishing luck, written
  as "50%" [S].
- **A different luck model.** Fishing does **not** use the gatherables' luck
  model [S, dev blog quoted on fandom].
- **Treasure Chest** (a catch) holds raw gems and ingots [S, fandom]. Season 2
  "added many new treasure chests, each with a chance for an additional rare
  reward", one of them holding fishing armour sets [S].
- **Legendary fish** are under 5% at rare hotspots [s].
- **Tradeability:** catches are tradeable [M]. Season 4 made some taxidermied
  legendary fish no longer BoP [S].

### 1.8 Salvage

- **Gear** salvages to coin and repair parts. There is no vendor, so salvage is
  the junk sink [S, fandom; economy dev blog: "we do not have vendors for
  players to sell their gear"].
- **Perfect Salvage** (E): a 5% chance per salvage, giving scraps or fragments
  [s].
- **Legendary salvage (E):** legendary gear salvaged to 50 umbral shards [s].
- **R:** umbral was retired, and leftover shards salvage for 0.1 coin each [S].
- **Materia (E/R):** expedition named items salvage to that expedition's
  Materia [S].
- **Runestone Stopwatch (R):** removed; stopwatches salvage into 10 Runestones
  [S].
- **Artifacts** "cannot be salvaged or discarded" [S, RotAE].

### 1.9 Gypsum, orbs and casts (the deterministic loot source)

Introduced in patch 1.2 (Dec 2021) as the guaranteed counterweight to random
Expertise bumps.

**How it worked** [S]:
- Each activity drops its own colour of gypsum.
- A full day's worth of one colour makes **one Gypsum Orb** at the T5 Gypsum
  Kiln.
- Once you have earned enough for an orb, that colour stops for about 23 hours.
- An orb crafts a **Gypsum Cast** of one gear type. Opening it "guarantee[s]
  an Expertise bump for that type of gear as well as an item of that type".
- **Rules** [S, fandom "Gypsum"]:
  - "You will only be able to level up the expertise of each item slot once per
    day."
  - It takes "approximately 31 Orbs to level a slot from 500 Gear Score to
    maximum".
  - Once a slot is maxed, casts give a "guaranteed GS range of 591-600".
- **Bump size:** at least 2 [S, official notes]. Aptitude-cache bumps were 2-5
  [s].
- **Random bumps cut.** When casts arrived, random bump odds were cut: "Elite
  chest odds were reduced a little and open world bosses were reduced a lot"
  [s, GameSpot copy of the patch notes].
- **At 600 Expertise** casts paid umbral instead of a bump: 100 shards at
  Expertise 600, up 12 per point, to 400 at 625 [S, nwdb].

**Colours at launch of the system** (Dec 2021 values) [S, nwdb gypsum guide]:

| Colour | Source and drop chance | Per orb | Time per day |
|---|---|---|---|
| Ruby | Every full OPR match (100%) | 2 | 50-60 min |
| Obsidian | Level 60+ named elites, 80% when they drop a bag; 10-13 min cooldown per enemy | 3 | 10-40 min |
| Topaz | Level 55+ creatures while the 1-hour Attunement Potion is active, 75% per bag; 1-3 min cooldown | 10 | About 40 min |
| Citrine | Arena boss (100%) | 1 | 20-30 min |
| Amethyst | Level 60+ breaches: 50% minor, 100% major | 7 | 40-60 min |
| Sapphire | Final boss of Garden of Genesis or Lazarus (100%) | 1 | 20-30 min |
| Emerald | Each third of a Trade-skill Aptitude level | 1 | 10-30 min |
| Diamond | Town trees during the winter event | 3 | 1-2 min |

"You can obtain enough Gypsum fragments to craft up to eight of these orbs per
day" [S]. A drop counts toward the cap "on drop, not on pickup, so if you miss
a bag it's impossible to hit ten" [S]. **Conflict:** a later guide lists
different caps (for example Topaz 15 at 5 per orb) [s]. Treat those as
post-2022 values.

**Gypsum's later lives.**
- *Season 2:* "Legendary Gypsum Casts" from 5 gypsum + 1,000 umbral "always
  give a legendary item" [S].
- *R:* the Kiln became the **named and artifact upgrade bench** (2.5).
- *Season 4:* a weekly Kiln cache: 20 Gypsum Orbs for 1,500 gold + 250 Dark
  Matter, BoP [S].
- *Season 5:* "Removed Legacy Gypsum Casts from the Gypsum Kiln" [S].
- **Binding:** casts are BoP [S, fandom item box], and orbs are BoP [S, nwdb].

### 1.10 Gathering rares (rare siblings)

**The developers' own model** [S, dev blog quoted on fandom]:
- "Gatherables (but not Fishing) use method #2": luck widens the roll range.
  "If your luck values are totally unmodified, there are some items in those
  tables that it are impossible for you to obtain without a bonus."
- **Example:** "The roll range on regular tree is 100,000 … somewhere above
  that range, say 105,000, is a chance to get a fish … if your luck was
  modified by say, 10,000, your roll range increases from 0-100,000 to
  10,000-110,000, which gives you a (roughly) 5% chance."
- **Design intent:** "That's why our luck increases from things like food and
  equipment are pretty chunky." Tables "'open up' more as your base luck grows
  … to plant little surprises and new things to find as you level".
- **Skill level is luck:** "Level 200 granting a total bonus of 2000 to your
  base rolls" (10 per level). "There aren't any cases … where not having a
  luck bonus will prevent you from getting an item as long as the associated
  Trade Skill is at 200."

**Measured rates** (Mining 200 plus extra luck) [S, nwdb void-ore guide]:

| Extra mining luck | Void Ore | Cinnabar or Tolvium |
|---|---|---|
| 0 | 0.0045% | 0.1% |
| 1,000 | 0.0235% | 0.6% |
| 5,000 | 0.105% | 2.6% |
| 11,000 | 0.225% | 5.6% |

- Over time you get "at least 140 times more Cinnabar and Tolvium (combined)
  than Void Ore" [S].
- **The maximum mining luck at 600 GS** was "over 11,000" [S]:
  - tool perk: 927;
  - amulet perk: 955;
  - five armour perks: 500 each, 2,500;
  - food: 2,000;
  - 3 Major trophies: 4,500;
  - lifestyle buff: 500.

**A bug that taught a lesson.** Patch 1.1 fixed "probabilities … multiplying
each other resulting in a near-zero chance". It also fixed an issue "that
could make it next to impossible for an item to drop if your luck values were
too high", which had created a "luck sweet spot" [S]. Fae Iron, Voidmetal,
Phasefiber and Petrified Wood became properly obtainable afterwards [S].

**R additions** [S]:
- new nodes at skill 205: Mythril, Runewood, Spinfiber, Dark Hide, Prismatic
  Barb;
- new rare "research" finds, limited to 3 crafts per day per item.

**Tradeable:** yes. Tolvium, Cinnabar and Void Essence have no bind flag [S,
nwdb].

### 1.11 Crafting, and the trading post, as "sources"

Crafting counts as a loot source in two ways. The craft itself is a roll (gear
score in L/E, perks in every era), and the containers that crafting pays out
are loot.

**Trade-skill Aptitude** [S]:
- After a skill reaches its cap, "each Aptitude Level is split in 3 equal
  parts, each one of them giving you a reward cache". The caches are a Parcel,
  a Crate, then a Package of Specialised Materials.
- XP needed, for example: Mining 16,328 XP per third, Furnishing 654,720 per
  third [S].
- The caches hold "Craft Mods, special ingredients, and even schematics and
  recipes", plus Emerald Gypsum.
- The four gear skills have a small chance of **Equipment Patterns**, which
  craft a "guaranteed Gear Score 600 item" with fixed looks and rolled perks
  [S].
- The storage-chest schematic now sits in the `postcap*` (Aptitude) tables of
  every trade skill [S, nwdb].
- Luck does not affect "Aptitude Supply Crates" [S, fandom].

**The trading post.**
- One linked market across all towns from patch 1.1, with orders lasting at
  most 14 days [S].
- No NPC buyer: "there's no artificial floor or ceiling" [S, economy dev
  blog].
- Prices quoted in guides (server-dependent) [s]:
  - Golden Steel Storage Chest schematic: 150,000-600,000 coin;
  - Golden Scarab: 500+;
  - basic trophies: cost 700-1,200 to make, sell for 2,500-4,000.

---

## 2. How a single gear drop is generated

### 2.1 Loot tables, buckets and where luck enters

**Two luck models, in the developers' words** [S, dev blog quoted on fandom]:

1. **Enemies and containers:** "anything in their drop list can occur, and
   your luck stat increases the likelihood of you getting the less common items
   in the list".
2. **Gatherables:** the "movable odds range" in 1.10, which can unlock items
   placed above the base maximum roll.

The developers add: "We don't use percentages in our data notation, we use
integer-based roll ranges". In New World's tables, "AND" tables give more
items as the roll goes higher, and "OR" tables pick one. Widening the range is
only used on AND tables "or it would … eliminate your chances of getting items
in the lower roll ranges" [S].

**Units.** 1% luck = 100 points [S]:
- the Luck perk "+50 GlobalRollMod — 0.5% chance at rare items" [S, nwdb];
- Loot Luck trophies are +50 / +100 / +150 global luck [S, fandom];
- the Ultimate Gathering Trophy shows "+1500 ROL … 15% luck" [S, fandom].

*Settled:* the "1,000 points = 1%" claims were wrong. The boar test agreed:
7.5% observed against 8.44% predicted at 100 per 1% [s].

**Community model of the table modes** [s; not re-read first-hand, since
zegeger and tamtoucan are blocked]:
- **AddToRoll:** luck is added to the roll.
  - Example: 1% base becomes about 7% at 6,000 points [D].
  - With 40% luck against a 0.5% bucket at 99,500, the chance is 4.5% [D].
- **ClampMax:** luck is subtracted from the thresholds and the maximum, so the
  same 4,000 points take 0.5% only to about 0.52% [D].
- Expedition named items use AddToRoll. World bosses and the global named list
  use ClampMax [s].

**Thresholds above the maximum in N data.** These match the developers'
"open-up" design and now apply to **chests** too [S, nwdb `needsLuck`]:
- Elite chests: charm materials (Feather Shard, Reinforcing Alloy, Leaded
  Chunk, Blade Splinters) need **1,000** luck (10%).
- Large supply and ancient chests: charms need **500**.
- Void Essence needs any luck at all (1 point).

**Worked example of a 22-item bucket** [S, nwdb guide]. The storage-chest
schematic bucket holds 22 items at equal weight, 11 of them limited to
Ebonscale Reach. "If you get lucky enough to reach the loot bucket, you will
get one item at random". So farming outside Ebonscale doubles your chance.
**Base chance 0.00023% per elite chest, "not influenced by luck"** [S].

**What luck does not touch** [S]:
- "Luck doesn't increase your chance to get higher gear score rolls or roll
  more perks, but it does increase your chances of seeing item drops that have
  higher chances of rolling bonuses" [dev blog quoted on fandom].
- Inventory caches are excluded [fandom].
- The Summer Medleyfaire update (Jul 2022) fixed "luck bonuses from inactive
  weapons" triggering [S].

### 2.2 Rarity tiers: what each colour means

| Source and era | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| Official "Items in New World" (Jun 2020, counts generated perks only) | 0 perks | 1 | 2 | 3 | Named and Legendary are separate: "curated Perks and fixed Gear Scores" [S] |
| Fandom "Equipment" | 0 ("does not bind on equip") | 1 | 2 | 3 | "3 Perks + Guaranteed Gem Slot" [S] |
| nwdb technical model (E) | | | | | "Items can have up to 5 perks … attributes and gems (or gem slots) are just perks" [S] |
| R onward | | | | | Plus **Artifact**, a separate rarity above Legendary [S] |

**How the slots unlock** [S, nwdb]:
- "The maximum amount of perks an item can have is decided by the item's Tier
  and Gear Score. A Tier 5 item needs 600 Gear Score for … the last perk slot"
  (590 for umbral eligibility from Jan 2022).
- "Random Tier 5 items under 600 Gear Score will never be able to roll the last
  perk, meaning they can't be legendary" [S].
- So in L/E a random Legendary existed only at GS 600, and the last few points
  of gear score switched on a whole extra perk.
- **Preset perks on low-GS items:** items with a preset list keep the last
  perk, but it stays "disabled" until the GS is high enough [S].
- **Shields can never be Legendary** [S, Season 1 notes].

**Gem slot.**
- In L: "Occasionally, items can drop with an empty Gem Slot". Jewellery "come
  with a pre-socketed Gem that cannot be replaced" [S].
- In N the gem slot became one of up to **four charm sockets** of four types:
  "Gem, Defensive, Offensive, and Skill" [S]. *Settled:* my first draft listed
  this as a 3-vs-4 conflict; the official notes say 4.

**Inherent (attribute) perk.**
- An attribute bonus line was perk slot one. RotAE "drastically reduced the
  chance for non-relevant Attribute Perks on weapons" [S].
- **N removed attribute perks** entirely: "the attribute perk slot has either
  been swapped out for a standard perk or replaced by a unique Infix perk" [S].

### 2.3 Perk pools

**How perks roll.**
- Each item class has a pool. Each perk has an `ExclusiveLabels` group (Luck's
  is "Luck"), which stops two perks from one family appearing together [S,
  nwdb].
- From Jul 2022 perks "first roll by label and then by perk", to raise variety
  [S].
- Perk power scales with the item's gear score. For example, Luck scales at
  0.00909 per GS, capped at 625 [S, nwdb; RotAE "Luck: Scaling has been capped
  and will no longer scale after 625 Gear Score"].

**Curated pools by source** (Season 2) [S]. "Items will now use a more curated
set of perks based on the activity type they are sourced from (generally split
between PvE and PvP content types)." The aim was to stop combinations "such as
Lost Ward with Resilient". Most crafting kept the open pools.

**R rework** [S]:
- "Dropped gear should have a much higher chance of yielding 3 usable Perks".
- Removed Creature Bane and Ward, Resilience, the Expertise perks and the chain
  perks.
- Merged STR/DEX and DEX/STR.
- Stopped the Refreshing Ward and Evasion perks from generating.

**Loot biasing** (R; deep dive on 26 Jan 2024) [S]:
- "Removes certain entries from that bucket", so if you have "a Great Axe and a
  War Hammer equipped, then that bucket … becomes weighted towards Great Axes
  and War Hammers".
- It covers armour weight and attributes.
- "There's a generic chance for loot biasing to kick in … we usually either
  increase that rate or flat out guarantee it for some content like PvP modes",
  and the rate is tuned up for higher-level players.
- "We had to prevent Named Items and Artifacts from factoring into the system at
  all".

**N**:
- Generic gear carries fixed perks plus random sockets [S, Nighthaven notes].
- **Infix** perks sit on unique items.
- **Set bonuses** come at 2/4 or 3/5 pieces, from the raid, Catacombs and the
  PvP track.
- A "stat squash" lowered old perk values [S].
- Season 8 had already made "all weaponskill perks … a possible roll on loot
  items from all locations" [S].

### 2.4 Gear score: how the number is set

| Era | Cap | How a drop's GS is set | Conf. |
|---|---|---|---|
| L | 600 | Below 60, GS tracks character level. At 60 a **per-slot high watermark** (HWM) starts at 500 [S]. "The moment the item drops, your relevant HWM is increased, regardless of if the item is equipped, or even picked up. Crafting an item or buying one from the Trading Post does not affect your HWM" [S]. Level 61 enemies raise it reliably to 530; level 64+ enemies drop up to 600 reliably [S]. **Soft pity:** "each time a level 60+ enemy is defeated and gear isn't dropped that increases its type's HWM, the chance … goes up" [S]. Expedition bosses "always" raise it [S] | [S] |
| E, patch 1.2 | 600 | HWM became **Expertise**, with old values converted. Bumps of 2+ points; casts guarantee one | [S] |
| E, patch 1.3 | 625 | **Umbral** upgrades from 590 to 625, once Expertise is 600 in that slot. "Upgrading any item via Umbral Shards binds the item to player." Items bought or traded after the patch have "effective gear score scaled down to the mid point of players Expertise and the items gear score". Crafting a 600 item under 600 Expertise gives a bump | [S] |
| R | 700 | Expertise and umbral removed. GS is set by creature level. "Expeditions and Mutators now uniquely set a range"; elite chests have a floor by POI level; PvP rewards scale "based on player level". M1 / M2 / M3 are balanced at 650 / 675 / 695+ | [S] |
| A | 725 | 725 comes from the raid, world bosses (weekly, pity 12), the Season 8 box (guaranteed), Season 9 doubloon crates (720-725) and the Apex chest. Most other endgame drops are 700-710 | [S] |
| N | 800 | **Umbrals** "any gear with GS of at least 700 can be upgraded", now "a currency with a wallet cap of 4,000 and a weekly rate limit". The stated goal was to stop umbral "value from deteriorating". PvP modes scale gear to 775 | [S] |

**Umbral cost curve (E).** Cost per +1 point [S, nwdb]:
- **From 590:** 2, 4, 6, 10, 20, 35, 50, 65, 90, 125.
- **From 600:** 1, 2, 3, 4, 5, 6, 8, 10, 15, 20 (600 to 609).
- **Then:** 25, 35, 50, 65, 90, 125, 175, 250, 325, 450 (610 to 619).
- **Then:** 700, 1,000, 1,400, 1,900, 2,500 (620 to 624).
- "You need more shards to upgrade an item from 624 → 625 than to upgrade an
  item from 600 → 619" [S]. Season 1 later re-costed it "to better align with
  when a piece of gear will see attribute or perk strength increases" [S].

**What players felt.**
- The watermark made crafted and bought gear feel worse ("crafting
  worthless") [s].
- By A, one critic said players were "effectively capped out" soon after
  reaching max level [s].

### 2.5 Named items and artifacts

**Named items:**
- **What they are.** "Pre-determined perks and gem slots … a higher chance of
  a Named item dropping from more difficult creatures and mutated dungeons, but
  there are items of this rarity at all skill levels" [S, fandom].
- **E:** an Epic named item at 590+ upgraded to 600 unlocks its disabled last
  perk and becomes Legendary. AGS confirmed this was intended [S, nwdb].
  Season 1 extended this to War, Invasion and OPR item sets: "Upon upgrading to
  600 GS these items will gain a 5th, random perk" [S].
- **R:**
  - New named sets were added for every mode, and old named items "should also
    no longer drop for higher leveled players from major game modes" [S].
  - **Matrices** "can also be used to re-roll the final perk in some of the new
    Named Items", with a Chromatic Seal required from the PTR onward. Seals
    became BoP [S].
  - The named items that can be upgraded go to 700 at the Gypsum Kiln [s].
- **A:**
  - Named items at 710 from world bosses and Goldcursed sources.
  - 725 versions exist for some of them [S].
  - Season 8 "balance changes" for named items "with illegal perk
    combinations" [S].

**Artifacts (R onward):**
- **Basics** [S, RotAE notes]:
  - "Artifacts always drop at GS 700".
  - "Each Artifact has a perk that is unique to that item".
  - "Each Artifact has its own set of objectives to unlock additional perks".
- **Equip limit:** "1 Weapon, 1 Piece of Armor (… Shields are categorized as
  armor), 1 Piece of Jewelry. So 3 Artifacts can be equipped at once" [S].
  *Correction:* my first draft guessed one.
- **Cannot** be salvaged or discarded [S].
- **Unique per character:** "You can only loot each of these items once" [S,
  Season 4].
- **Pity** (Season 5): "Artifacts now have a pity mechanic which will guarantee
  a drop after a set number of kills" [S].
- **Upgrade at the Kiln (R)** [S, fandom]:
  - a Matrix of the right type;
  - 500 Dark Matter;
  - 5 Gypsum Orbs;
  - 1 Chromatic Seal;
  - 1,000 coin tax.
- **Season 8:** "streamlined access to fully unlocked Artifacts" [S].
- **N:** 725 artifact recipes removed, because umbral now works from 700. The
  perks were rebuilt as fixed or slottable, with no attribute portion [S].
- **Sources:** named bosses, M3 final bosses (Endless Thirst from mutated
  Savage Divide), OPR caches (Tumbler Feetwraps), the PvP track and the season
  pass [S].

### 2.6 Upgrade and reroll paths, by era

| Era | Raise GS | Control perks | Reset or swap |
|---|---|---|---|
| L | Only by finding or crafting better | Azoth raises "the chance of items rolling with either a perk, a gem slot, or both". One **craft mod** guarantees one chosen perk [S] | None; salvage it |
| E | Umbral 590/600 → 625 (binds the item) [S] | **Timeless Shards** (fixed attribute) and **Golden Scarabs** ("combined with timeless shards allows a crafter to select two perk items") [S]; Runestone Stopwatch [s] | Named and OPR Epics become Legendary at 600 [S] |
| R | Named items and artifacts at the Kiln [S] | **Prismatic Scarab + Azoth Inductor**: "a GS 700 item with all of the perks that you would like". The scarab is tradeable [S]; the inductor is BoP [S]. Chromatic-seal crafts pick 2 perks [s] | **Matrix + seal re-rolls the final perk** on artifacts and some named items [S] |
| A | 725 from raid crafting (Gorgon Essence and Gorgonite Inductor), Goldcursed upgrades and the Apex chest [S/s] | Season 7: Gorgonite recipes take attribute perk items to pick the attribute [S] | Same as R |
| N | **Umbrals** 700 → 800 (capped currency) [S] | **Charms** go into sockets; they are "more commonly … crafted with rare materials which drop from endgame content" [S] | Replacing a charm destroys the old one [s] |

**Direction of change.** Over four years the game moved from a pure roll to
**chosen outcomes behind cooldowns**. In N the randomness moved into the
*socket layout* of a drop, and one critic complained there was "no longer a
deterministic way to obtain the exact gear you want" [s].

---

## 3. Luck stats

New World has three separate luck stats [S]:
- **global (loot) luck**, for chests and kills;
- **gathering luck**, one per gathering skill;
- **fishing luck**.

They never mix: "General Luck is separate from gathering-related luck" [S].

### 3.1 Global (loot) luck

**What it affects** [S, fandom citing nwdb]:
- "the potential for low drop-chance items to be earned";
- "the chance that the weapon/armor will be named";
- "the chance that other items than weapon/armor will be rare".

A developer adds that for "furniture schematics and found furniture items, the
higher-end storage items are among the most rare. Increasing your Luck will
definitely make this more likely to occur" [S].

**Sources and values:**

| Source | Value | Conf. |
|---|---|---|
| Luck perk (shields, armour, jewellery, bags) | Base +50 points (0.5%), times a GS multiplier. It scales up to GS 625, then stops (RotAE). Stacks to 25 | [S] nwdb, RotAE |
| Pearl in a socket | Value set by pearl tier | [S] fandom; values [s] (0.25-0.5%) |
| Loot Luck trophies: Minor / Basic / Major (up to 3 houses) | +50 / +100 / +150 (0.5 / 1 / 1.5%) | [S] fandom |
| Consumables (Roasted Monstrous Turkey Dinner, Defiled Rabbit's Foot, Springtide Dram) | Exists. RotAE cut the Dram "to make it more similar to other Luck consumables" | [S]; values [s] (food about 4.95%) |
| PvP flag | +10% from patch 1.1 | [S] |
| Territory your faction controls | "small boost" | [s] |

**Trophy recipes** (Furnishing levels from a PTR database) [s]:
- Minor needs Furnishing 100 and a Rabbit's Foot.
- Basic needs about 150.
- Major needs about 200.

**Example build** [S, nwdb]. "Around 43% luck … from 9x Pristine Pearl, 3x
Major Loot Luck Trophy and 12x Luck perks." That turns 0.00023% into about
0.0195% (about 85x) on a table where luck applies.

**Caps.**
- The developers built in no hard cap. Patch 1.1 fixed a bug where too *much*
  luck blocked drops [S].
- **Effective caps** come from three places:
  - the Luck perk stops scaling at GS 625 [S];
  - flags such as "not influenced by luck" (the storage-chest schematic) [S],
    and inventory caches being excluded [S];
  - daily caps on the item itself (Golden Scarab 10/day [s]).

### 3.2 Gathering luck

- **Per skill:** logging, harvesting, mining, skinning [S].
- **What it does.** It does not change yield, only the chance of rare
  siblings [s].
- **Sources** [S, fandom "Luck"/"Trophies"; nwdb void-ore guide]:
  - **trade-skill level:** +10 per level (+2,000 at 200);
  - **food per skill:** +1,000 / 1,400 / 1,700 / 1,900 / 2,000 (for example
    Roasted Potatoes up to Salted Roasted Vegetables for mining);
  - **trophies:** +500 / 1,000 / 1,500 each, over 3 houses;
  - **Ultimate Gathering Trophy:** +1,500 to each skill;
  - **perks:** the tool's luck perk (927 at 600), an amulet perk (955), and an
    armour perk (up to 500 per piece);
  - **lifestyle buff:** +500;
  - **PvP flag:** +30% (patch 1.1);
  - **a festival buff:** +2-5% for 30-90 minutes;
  - **attributes:** Aeternum made the CON 50 bonus "1.5% gathering luck
    instead of tool durability" [S].
- **How it shows up:** as unlocks. Items "open up" as luck rises (1.10).

### 3.3 Fishing luck

- **Base sources:** trophies (+2,500 / +5,000 / +9,000) and the Ultimate
  Gathering Trophy (+5,000) [S].
- **Bait:** for rarity and size (1.7) [S].
- **Hotspots** dominate with hundreds of thousands of points [s].
- **Its own model:** fishing does not use the gatherable model [S].

---

## 4. Rare materials and schematics

### 4.1 Schematics: how they work and how rare they are

- **How they work.** A schematic is an item that you consume to learn the
  recipe permanently, "even if the player at the moment … doesn't have the
  required amount of skill" [S, Fextralife].
- **Tradeable** [S, nwdb: no bind flag on the storage-chest schematic].
- **Where they come from** [S, nwdb]:
  - **Elite chests:** 296 schematic entries in the S10 elite chest lists, all
    furniture.
  - **Large supply and ancient chests:** 274.
  - **Small and medium chests:** 30.
  - **Aptitude tables:** the storage-chest schematic sits in the `postcap`
    (Aptitude) tables of every trade skill.
- **Named weapon schematics** (Eruption, Stonerend, Windsinger and others) also
  exist [S, Fextralife].
- **Drop rates:**
  - **Golden Steel (Orichalcum-braced) Storage Chest** [S, nwdb]:
    - **0.00023%** per Elite Supply or Ancient chest in 50+ zones, "not
      influenced by luck";
    - from 16 Dec 2021, the Package of Specialised Furnishing Materials gives
      it at "around 0.165%": "a 25% chance to get 1-2 items … out of a pool of
      227 different schematics".
  - **Hive of Gorgons schematics:** scarce on purpose at launch, then made more
    common (1.4) [S].
  - **Food recipes from containers:** 5% → 2% (small) and 20% → 5% (large),
    in Season 5 [S].
  - **Named-mob and expedition schematic rates:** not found [S, absence].

### 4.2 Craft mods

- **What they do.** "You can guarantee that the one perk you want on the item
  is there" [S, official].
- **Sources:** "Everything from trees and boulders to specific types of
  creatures have a small chance to drop a crafting modifier" [S, official].
  Also Aptitude caches [S], and an "increased chance to get a craft mod from a
  small chest" (Season 5) [S].
- **Patch 1.1** cleaned up mods that "were dropping in game but were unable to
  be traded on the Trading Post" [S]. That implies mods are meant to be
  tradeable [D].
- **Later roles:**
  - *R:* they set a named item's re-rolled perk [s];
  - *Season 9:* the "perk items" for Season 8's new perks were added to
    mutation and Influence Race caches "to address low accessibility" [S];
  - *N:* attribute perk items were deprecated [S].

### 4.3 Faction and trophy recipes

- **Faction.** The faction shop sells the BoP crafting keys: the Azoth
  Inductor and Chromatic Seal, plus Runes of Holding, which bags and storage
  chests need. The Hope Storage Chest, for example, needs a Greater Rune of
  Holding [S].
- **Trophies:**
  - combat trophies give +3 / 4 / 5% damage against a family [S];
  - crafting trophies give +5 GS [S];
  - gathering and loot-luck trophies are covered in section 3;
  - legendary trophy materials come from one named boss per family, usually
    after about 100 shards [S, fandom];
  - Loaded Dice and Stacked Decks come from elite chests [S].

### 4.4 How the rarest inputs gate the top of crafting

| Input | Recipe and gate | Rare part comes from | Bind | Conf. |
|---|---|---|---|---|
| **Asmodeum** (T5 metal) | 5 Orichalcum ingot + Tolvium + Cinnabar + Obsidian Flux + Charcoal; Smelting 200; **10 per 86,400 s** | Tolvium and Cinnabar from Orichalcum veins (0.1-5.6% by luck) | Tradeable | [S] nwdb |
| Glittering Ebony, Phoenixweave, Runic Leather | The same daily pattern for wood, cloth and leather | Rare gathering siblings | Tradeable | [M] |
| **Prismatic** Ingot, Plank, Cloth, Leather, Block (R) | Prismatic Ingot = 1 Asmodeum + 10 Mythril + 4 Flux + 4 Charcoal; Smelting 250; "daily cooldown limit of 10" | The whole chain beneath it | — | [S] |
| **Prismatic Scarab** (R) | 500 Azoth + 1 Prismatic Block + 10 Golden Scarabs + 50 Pure Solvent; Stonecutting 250 | Golden Scarabs from elite Brimstone and Elysian chests | **Tradeable** (RotAE: "This item is BoE") | [S] |
| **Azoth Inductor** | Faction vendor | Faction play | **BoP** | [S] nwdb |
| Chromatic Seal | Faction vendor, raid | — | **BoP** | [S] |
| Dark Matter | Mutations (8-40), world bosses (25), raid | Endgame play | **BoP** | [S] |
| Gorgon raid materials (A) | Craft 725 gear | Hive of Gorgons, weekly | — | [S] |
| Matrix Alloy (N) | Forges tradeable 730 gear | Endgame drops | — | [s] |

**The gate has three layers:**
- **Luck** decides whether the Asmodeum inputs appear at all.
- **Daily cooldowns** cap how fast the top bars can be made.
- **A weekly, BoP key** (the Inductor) caps chosen-perk crafts.

The *tradeable* parts (bars, scarabs, prismatic scarabs, schematics) feed the
market. The *bound* parts (inductor, seals, Dark Matter, coconuts) force each
player to play the content themselves.

---

## 5. Crafting versus drops

### 5.1 Caps and floors by era

**L/E: a gear-score range set by preparation** [S, nwdb "How to Craft
Legendary 600 Gear Score Items"]. Weaponsmithing example (minimum / maximum):

| Bonus | Min | Max |
|---|---|---|
| Level 200 Weaponsmithing (base) | 500 | 525 |
| Asmodeum (rare primary) | +15 | +15 |
| Glittering Ebony (rare secondary) | +15 | +15 |
| Runic Leather (rare secondary) | +15 | +15 |
| Major crafting trophy x3 | +15 | 0 |
| Food (Savory Vegetable Medley) | +15 | +15 |
| Weaponsmith Mastery perk | +5 | +5 |
| Weaponsmith Expertise perk x5 | +10 | +10 |
| Lifestyle buff | +5 | 0 |
| **Total** | **595** | **600** |

- **Arcana** only reached 595-600 from patch 1.1 [S].
- The developers' original pitch: an Iron Sword starts at "200-210", and the
  range widens with skill. A skilled smith can make a lower-tier weapon that
  beats a less skilled smith's next tier [S, official "Crafting in New World"].

**R: no more range** [S]:
- "We have removed the roll range for crafting … you will now get an item at
  the Gear Score the game states". The example: a Starmetal Longsword that used
  to roll 420-440 now always makes 440.
- "All buffs have been shifted to increase the max gear score … you will still
  need your clothing, jewelry, trophies, food, etc".
- Lifestyle buffs also moved to the maximum.

**A:** the 725 crafts come from raid materials, not skill [S]. **N:** crafted
perk-slot gear sits at a fixed 730 with sockets [s].

### 5.2 When each one wins

**Crafting wins on control:**
- you choose perks (craft mods, scarabs, inductor);
- your gear score is guaranteed;
- the result is tradeable: scarab crafts are "Bind on Equip as intended" [S,
  Aeternum notes].

**Drops win on:**
- unique powers: named items, artifacts, infixes, set bonuses;
- the top of the ladder (725 raid and world-boss items, 800 through umbral
  only);
- cost, since drops need no daily-capped bars.

**The tilt in L/E.** Watermark and Expertise tilted the field toward drops.
Crafted or bought items did not raise your HWM, and traded items were scaled
to the midpoint [S].

### 5.3 How Amazon kept both relevant

1. **Drops feed crafting.** The key crafting inputs are themselves loot:
   - schematics, Golden Scarabs and trophy materials from elite chests;
   - Dark Matter, Eyes and raid materials from group content;
   - Materia salvaged from expedition named items;
   - Tolvium from luck-gated gathering.

   A lucky drop is often an *input*, not an item.
2. **Crafting is the "smart loot"** that fixes a bad roll. Its cost is time
   (daily and weekly gates), not RNG.
3. **Unique powers stay drop-only.** Named items, artifacts, infixes and set
   gear give the reason to run content even when crafting can reach the cap.
4. **Binding is used as a dial.** The keys are BoP (Inductor, seals, Dark
   Matter, coconut). The tradeable inputs and outputs keep the market alive.
   The stated original intent: crafted items "at parity with, or better than
   dropped gear … by being more specific in targeting desired Perks" [S,
   fandom citing a 2020 developer interview].

---

## 6. Bind rules and the trading post

### 6.1 Bind rules

**The rule and its reason.** Every equippable item has a BoE or BoP flag,
added in alpha "to protect our item economy and keep demand for quality items
high" [s]. Common items "do not bind on equip" [S].

**Tradeable or BoE (current nwdb data unless noted):**
- Golden Scarab, Prismatic Scarab, Tolvium, Cinnabar, Void Essence, the N charm
  materials (for example Feather Shard), and the Golden Steel Storage Chest
  schematic [S];
- open-world and elite-chest legendaries (BoE) [S];
- scarab crafts (BoE) [S];
- PvP trade-skill perk items, from Season 2 [S];
- trade-skill armour (BoP drops were a bug, fixed in Season 5) [S].

**BoP:**
- Azoth Inductor, Chromatic Seal (from R), Gypsum Orb, Gypsum Casts, Dark
  Matter, Goldcursed Coconut, Depleted Umbral Shards [S];
- any item upgraded with umbral in E [S];
- the Season 2 Artisan crafting line ("GS 600 and Bind on Pickup") and the
  Season 4 Kiln cache [S];
- N infix items [S];
- artifacts, which cannot be salvaged or discarded [S]; BoP [M];
- expedition, raid and season-pass gear [M], with player complaints [s].

### 6.2 What sells, and how loot feeds the market

**The market itself.** There is no NPC buyer, so prices have no floor. Players
speculate: Golden Scarabs jumped before RotAE "only to fall back down", by the
developers' own account [S, economy dev blog].

**Coin from loot.** In mid-2022 about **50%** of expedition-boss coin was moved
into elite-chest and breach coin sacks [S]. Aeternum then cut boss coin by 90%
and moved coin into daily random-queue bonuses [S].

**What sells** [s]: luck-gated or daily-capped *inputs* and the items they
make:
- schematics;
- Golden Scarabs;
- trophies;
- Asmodeum, Glittering Ebony, Runic Leather;
- Runes of Holding;
- consumables.

Raw materials sink toward worthless because everyone gathers [s].

**How loot feeds the market.**
- Loot luck turns an elite chest into a ticket on tradeable jackpots
  (schematics, scarabs).
- Daily caps hold their value.
- BoP keys keep the top crafts personal.
- BoP endgame drops keep the best power off the market.

---

## 7. Time gates and what they did to behaviour

| Gate | Limit | Era | Conf. |
|---|---|---|---|
| Elite chests | Once per character per chest, every 23 h | All | [S] |
| Gypsum, each colour | Daily allotment per colour; for example Obsidian has a 10-13 min per-enemy cooldown and Topaz 1-3 min; Expertise bump once per slot per day | E | [S] |
| Golden Scarab | 10 looted per day | Brimstone Sands onward | [s] |
| Asmodeum, Prismatic bars | 10 per 24 h | L onward / R | [S] |
| Gatherable research items | 3 crafts per day per item | R | [S] |
| Expeditions | Tuning orbs → 15 per day and 25 mutated per week (Jul 2022) → 35 mutated per week (R) | — | [S] |
| Random-queue bonus | 2 → 3 regular per day; 1 → 2 mutator per day (Aeternum) | A | [S] |
| Raid | Loot once per boss per week | A | [s] |
| World bosses | Bonus box 3 per day; the 725 at most 1 per week, guaranteed after 12 boxes | A | [S] |
| Gorgon's Eyes | 90 per week | A (Season 8) | [S] |
| Kiln cache | 1 per week | R (Season 4) | [S] |
| Coconut, Gold Key | Weekly | A | [S/s] |
| Umbral Crystals | Wallet 4,000, weekly earn limit | N | [S] |
| Artifacts | One copy per character; pity after a set number of kills | R | [S] |

**What the gates did to behaviour:**

- **Routes replaced exploration.** Per-player daily elite chests produced the
  elite chest run: routes recruited in chat ("X ECR"), 20-50 players, and the
  warning that "you will *get lucky* in time, but do not expect any items worth
  selling from every elite chest run loop" [S, fandom].
- **A daily checklist.**
  - Gypsum alone was up to 8 orbs a day, spread over five or six different
    activities (OPR, arena runs, breaches, expeditions, aptitude) [S, nwdb].
    By nwdb's own time estimates that adds up to roughly 3-4 hours [D].
  - Daily cooldowns on Asmodeum and prismatics made "spend your dailies" a
    login task [M].
- **Guarantees under every jackpot.** Each gate added a floor under the random
  roll:
  - E: the HWM's soft pity [S];
  - E: gypsum's guaranteed bumps, with random bump odds then cut [s];
  - R: the artifact pity [S];
  - A: the world-boss pity at 12 boxes [S];
  - Season 8: the guaranteed 725 box [S].
- **Scarcity on purpose, then relief.** Raid schematics were held scarce "so
  that there could be some exciting high value drops", then made more common
  [S]. Food recipes went the other way, made scarcer because players "had many
  of these recipes" [S].
- **First-time and per-character rewards:**
  - first normal clear: the Codex and a one-time mutation orb (Jan 2022) [S];
  - a daily Wild Card stamp (R) [S];
  - artifacts lootable once each [S].
- **Caps reached too fast.** By A, weekly guarantees made the 725 cap
  reachable, and critics said the chase ran out [s]. N answered with an
  800-point umbral climb throttled per week, so the chase would last [S].

---

## 8. Sources

**Read first-hand this session** (the basis for [S]):

Official (newworld.com)
- https://www.newworld.com/en-us/news/articles/items-in-new-world (3 Jun 2020)
- https://www.newworld.com/en-us/news/articles/crafting-in-new-world (10 Jun 2020)
- https://www.newworld.com/en-us/game/releases/into-the-void (patch 1.1)
- https://www.newworld.com/en-us/game/releases/january-update-mutators (1.3)
- https://www.newworld.com/en-us/game/releases/summer-medleyfaire-update (27 Jul 2022)
- https://www.newworld.com/en-us/news/articles/brimstone-sands-release
- https://www.newworld.com/en-us/game/releases/season-one-fellowship-and-fire (3 Apr 2023)
- https://www.newworld.com/en-us/game/releases/season-two-blood-of-the-sands (5 Jul 2023)
- https://www.newworld.com/en-us/game/releases/rise-of-the-angry-earth
- https://www.newworld.com/en-us/news/articles/economy-balance-deep-dive (30 Oct 2023)
- https://www.newworld.com/en-us/game/releases/eternal-frost (11 Dec 2023)
- https://www.newworld.com/en-us/news/articles/loot-biasing-deep-dive (26 Jan 2024)
- https://www.newworld.com/en-us/game/releases/season-of-the-guardian (29 Mar 2024)
- https://www.newworld.com/en-us/game/releases/season-of-opportunity
- https://www.newworld.com/en-us/news/articles/the-hive-of-the-gorgons-raid-deep-dive
- https://www.newworld.com/en-us/game/releases/season-of-conquerers
- https://www.newworld.com/en-us/game/releases/season-of-the-divide
- https://www.newworld.com/en-us/news/articles/expeditions-unleashed-world-bosses-emerge (20 May 2025)
- https://www.newworld.com/en-us/game/releases/season-of-the-banner
- https://www.newworld.com/en-us/game/releases/nighthaven

nwdb.info (JSON data and guides)
- Gatherables: chestelitet5, chesteliteancientt5, 16bs_elitelegiontomb, 16bs_legionstonetomb_sulfur, 17dw_ancientstonetomb_02, 09fl_elitebeastglyphchest_01_05, abandoned_t3_s, smelting_t3_m/_l, ancient_t3_s/_m/_l, provisioning_t3_m/_l, alchemy_t3_m, 10ws_cursedoubloonchest_large, 10ws_doubloonchestweekly_locked, catacombs_lootchest_gold (https://nwdb.info/db/gatherable/<id>)
- Items: goldenscarab, prismaticscarab, azothinductor, chromaticseal, gypsumorb, darkmatter, doubloonantique05, tolviumt1, cinnabart1, voidessence, perkcharmmaterial_9, schematic_house_housingitem_storage_t4_cheststeel, infix_blockcleanse_1htowershield (https://nwdb.info/db/item/<id>)
- Perk perkid_common_luck; recipes ingott51 (Asmodeum), ingott53 (Prismatic Ingot), prismaticscarab; creature swamp_dryad_beast_named_elite_05wc10
- Guides: how-to-get-the-orichalcum-braced-storage-chest-schematic, new-world-void-ore-drop-rate, gypsum-farming-guide, umbral-shards-by-the-numbers, upgrading-items-to-legendary-with-umbral-shards, how-to-craft-600-gear-score-items, new-world-trade-skill-aptitude-explained, new-world-shutting-down (https://nwdb.info/guides/<slug>)

newworld.fandom.com (MediaWiki API, wiki text)
- Luck (quotes the 2021 dev blogs "Update on Current Issues" 1 and 2), Equipment, Gear Score, Rarity, Containers, Elite Chest Runs (Guide), High Watermark System, Gypsum, Gypsum Cast, Gypsum Sword Cast, Mutators, Artifact Equipment, Depleted Umbral Shards, Season 3, Aptitude, Trophies, Trophy Material Farming, Crafting, Craft Mods, Hope Storage Chest, Dark Matter, Fishing, Fishing Hotspots, Bait, Trading Post, Salvage, Expedition Chest, Treasure Chest

newworld.wiki.fextralife.com
- Luck (perk), Schematics

**Search excerpts only** (the basis for [s]; pages not fetched):
- https://www.tamtoucan.com/public/new-world-loot-luck
- https://zegeger.net/category/new-world/loot/ and https://zegeger.net/global-luck/
- https://forums.newworld.com/t/luck-faq-best-thing-ive-seen-on-luck-is-it-up-to-date/762512/15
- https://devtrackers.gg/new-world/p/7f365209-dev-blog-luck-faq
- https://www.nme.com/news/gaming-news/new-world-player-massacres-over-1000-boars-to-prove-how-luck-works-3086674
- https://www.gamespot.com/articles/new-world-winter-convergence-update-brings-new-quests-big-endgame-changes-full-patch-notes/1100-6499064/
- https://mmos.com/news/new-world-alpha-update-adds-a-new-zone-expedition-and-bind-on-equip-pickup-flags-for-all-equips
- https://game8.co/games/New-World/archives/348199 (Outpost Rush)
- https://www.studioloot.com/new-world/articles/new-world-golden-scarab-guide/
- https://progameguides.com/new-world/where-to-find-golden-scarabs-in-new-world/
- https://gamesfuze.com/guides/new-world-fishing-luck-guide-how-to-catch-oysters/
- https://gamesfuze.com/guides/new-world-aeternum-how-to-get-725-gs-gear-fast/
- https://www.icy-veins.com/new-world/hive-of-gorgons-raid-walkthrough
- https://www.icy-veins.com/new-world/news/season-10-patch-notes/
- https://thexamxam.com/2025/10/new-world-aeternum-nighthaven-gearing-and-perk-charms-guide/
- https://www.mmojugg.com/news/new-world-s10-nighthaven-bis-gear-crafting-guide.html
- https://www.mmogah.com/news/new-world/new-world-season-10-nighthaven-gear-system-overhaul-explained-new-runes-new-artifacts-and-new-goals
- https://www.heartlessgamer.com/2023/09/new-new-world-crafting-changes.html
- https://www.heartlessgamer.com/2025/10/nighthaven-week-later.html
- https://massivelyop.com/2024/11/04/vitae-aeternum-how-to-fix-new-world-aeternums-endgame-starting-with-rewards-and-content-relevance/
- https://steamcommunity.com/app/1063730/discussions/0/3090023948270337567/ (BoP complaints)
- https://www.mmogah.com/news/new-world/new-world-aeternum-season-9-gold-farming-guide-4-proven-methods-to-get-rich-fast
- https://www.pcgamesn.com/new-world/money-farm-trading-posts
- https://gamepur.com/?p=239947 and https://ptr.nwguide.cn/db/item/house_housingitem_buff_luck_bonus_t3 (loot-luck trophy recipes)

---

## Summary table

| Source | What it drops | How often | Tradeable? | Role in progression |
|---|---|---|---|---|
| Open-world normal mobs | Coin, family materials, Common, Family and Elite gear sets, rare mods and schematics | Unlimited; a bag about every 10 kills | Materials yes; gear mostly BoE; Common never binds | Levelling gear; bulk materials |
| Open-world named mobs | A guaranteed bag; their own named sets (R: one set from zone AI, one from Elite-POI named mobs and chests); trophy materials; Obsidian gypsum (E) | Respawn; gypsum on a 10-13 min cooldown | Mostly BoE; N infixes BoP | First "target" items; Expertise bumps in E |
| Small and medium chests | Refining materials, dyes, potions, about 30 schematics, food recipes (2-5%) | Per-player cooldown | Yes | Background drip |
| Large stockpiles and chests | Adds gear and about 274 schematics; charms at 500+ luck (N) | Per-player cooldown | Yes / BoE | Mid-tier lottery tickets |
| Elite chests | Item roll + bonus roll + furniture roll: legendaries (GS floor by POI), 296 schematics (storage chest 0.00023%), trophy materials, scarabs (10/day), Dark Matter, coin sack 35% (2022), +15 umbral (N) | Once per chest per 23 h | Gear BoE; materials yes; Dark Matter BoP | The daily chest-run economy; the main source of tradeable rares |
| Expeditions and mutations | Boss tables with expedition named items (luck helps most), Materia (choose a drop), umbral (E), Dark Matter 8-40, artifacts (mutated only), Eyes (Season 8), 4-socket gear (M3) | 15/day (2022); 25 → 35 mutated per week; random bonus 3 + 2 per day (A) | Mostly BoP | The core endgame ladder |
| World bosses (A) | Normal box: 66% GS 700, 33% named 710. Bonus box: named 710, gypsum, 25 Dark Matter, 25% chance of a 725 | Bonus 3/day; the 725 once per week, pity at 12 | BoP [M] | An event chase with a floor |
| Raids | 725 items, Eyes, seals, schematics (scarce, then more common), set gear (N) | Each boss weekly | BoP [M] | Top of the ladder |
| Breaches | Coin sack (10% minor, 100% major), Amethyst gypsum (50% / 100%), level-scaled cache (luck excluded) | Event spawns | Mostly yes [M] | Open-world group filler |
| OPR, arenas, wars, PvP track | Caches (2.5% named), Ruby and Citrine gypsum, artifacts (more likely after track level 50), set gear (N) | Per match; arena bonus 2 per day | Gear BoP [M] | A parallel PvP ladder; flag luck +10% / +30% |
| Cursed Mists | Doubloons → 700-725 crates; Coconut weekly → 725 | Hoards every 15-17 min; weekly key | Coconut BoP | A PvP-zone route to cap |
| Catacombs (N) | Sterlings, Crowns → vendor, set gear | Per run; you lose most loot if you fail to extract | — | Push-or-bank risk loop |
| Faction shop | Inductor, seals, orbs (BoP); Runes of Holding | Rank-gated; inductor weekly | Mixed | Turns faction play into crafting keys |
| Town board, quests | Coin, XP, standing; fixed quest gear (no bias) | Board refreshes; quests one-off | — / BoP [M] | Levelling, not loot |
| Season pass | Cosmetics, tokens, 600 legendaries (Season 1), artifacts | 100 levels per season | BoP [M] | Long-season retention |
| Fishing | Fish, treasure chests (gems, ingots, rare extras), legendary fish (under 5%) | Hotspots 20-90 min, 10-20 fish each | Yes [M] | A luck-heavy side jackpot |
| Salvage | Coin, repair parts; Materia from named items; Perfect Salvage 5% (E) | Per item | — | The only junk sink (no vendor) |
| Gypsum orbs and casts | A guaranteed item of a chosen type plus a bump (E); later the upgrade fuel at the Kiln | Up to 8 orbs per day; one bump per slot per day | BoP | The deterministic floor under random loot |
| Gathering rares | Rare siblings above the 100k roll; Tolvium and Cinnabar 0.1-5.6% by luck; Void Ore 0.0045-0.225% | Per node | Yes | The luck-gated inputs for Asmodeum and the top of crafting |
| Crafting, Aptitude | Range rolls (L/E) or set gear score (R+), chosen perks; Aptitude caches with mods, schematics, patterns | Bars 10 per day; inductor weekly | Mostly BoE | The controlled path to cap; the market's goods |
| Trading post | Anything tradeable | Any time | — | Turns any lucky drop into coin |

## Which three mechanics do most of the work, and why

Three things do most of the work.

**1. Every drop is a fresh roll you can read at a glance, with a ceiling you
can see.** Colour is simply the number of filled perk slots. The last slot
unlocks at a visible gear-score threshold (600 at launch), so even an ordinary
drop might be a god roll. The last few gear-score points also switch on a
whole extra perk.

**2. Named targets at a known address, behind odds you can improve and a floor
under bad luck.** You know where things live: Footfall from Mahantaram,
Tolvium from Orichalcum veins, the storage-chest schematic from elite chests in
50+ zones.
- **Luck works through thresholds placed above the base roll.** The
  developers deliberately made luck sources "pretty chunky", so that
  preparation (food, trophies, perks, skill level, the flag, the right hotspot)
  turns "impossible" into "rare". In N even elite chests hide charm materials
  behind 1,000 luck.
- **Pity counters and guaranteed boxes** cap the bad streaks: the HWM soft
  pity, gypsum casts, artifact pity, the 12-box world-boss pity and the
  60-Eye box.

**3. One open market that turns luck into wealth.** Open-world gear, rare
materials, scarabs and schematics are all tradeable. So a drop you cannot use
is still a windfall: the storage-chest schematic, at 0.00023% per chest, sold
for 150k-600k coin. Daily caps on scarabs and Asmodeum keep that value in
place, and bound keys such as the Inductor stop money from buying the very top.

**Time gates are not on this list** because they pace the excitement rather
than create it; when overused they read as chores.

**Why our earlier slices fell flat.** They copied only part of mechanic 2: a
tracked recipe from kills, with no luck to build and no floor. They left out
the readable per-drop roll and the market that gives every drop a price.
Nighthaven's Catacombs, a push-or-extract loot run where failing to get out
costs "the vast majority of the treasures collected", is the game's own late
answer to adding stakes to the roll.
