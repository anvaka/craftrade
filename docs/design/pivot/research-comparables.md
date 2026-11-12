# Comparables for the pivot: gather, craft and progress in a small 2D game

Question: how do small-scope games deliver an MMO-like gather / craft /
progress loop (the New World feeling), what pacing do they use, and which
hybrid structures fit a 2D top-down browser game with a horde-run heritage
that must play well on a phone?

No mechanics were changed. This file is research only.

## How to read this

- **Evidence level.** Web search (November 2026) was used for reviews,
  interviews and complaint patterns; those claims carry a source number
  like [12], listed at the end. Mechanical details without a number
  (level thresholds, timers, counts) are from general knowledge of the
  games and should be treated as approximate until checked against a wiki.
- **Not reached.** `www.gamedeveloper.com` and `en.wikipedia.org` are
  outside this session's allowed network hosts, so the Forager, Dome Keeper
  and Loop Hero developer articles [1][5][14] were read only as search
  excerpts, not in full. No GDC talk on pacing was found for any of the
  games; the Cult of the Lamb GDC talks that exist are about marketing and
  Twitch [10].
- **Session length** below means "one natural sitting unit" (a run, a day,
  a dive), not total playtime.

## The reference: what "New World feeling" is made of

Reviewers consistently call gathering, refining and crafting the best part
of New World, and wearing gear you made yourself the best reward [26].
The parts that carry the feeling:

- Nodes are visible in the world and tiered; each trade skill (0-200) has
  thresholds that open the next node (mining: iron at 0, silver ~10, gold
  ~45, starmetal ~100, orichalcum ~175), so a zone you already know gains
  new things to pick up as you level.
- Zones have a level band; higher zones hold higher nodes and harder mobs
  standing next to them. Gathering is calm, but the good node is guarded.
- Town stations have tiers (2-5); the tier of the station caps what you
  can craft, so the town itself is a progress bar.
- Houses hold storage and trophies that give small buffs (gather luck,
  craft luck, damage against a mob family) and act as a recall point.
- Chests have cooldowns and a rarity ladder; schematics drop rarely.

The documented failures are the ones to avoid: gather time per level grows
exponentially, there is a grind wall around level 100 of 200, the cheapest
way to level is to spam low items and salvage them, and the endgame has no
use for most of the world except material farming [26][27].

## Pacing at a glance

| Game | Calm / pressure pattern | Sitting unit | What gates the map |
|---|---|---|---|
| Dome Keeper | Mine in safety, timer to next wave, defend | 30-60 min run, wave cycle 1-2 min | Depth, drill power |
| DRG: Survivor | Mine while kiting a horde; 30 s escape | 5 stages of ~4-7 min | Dive depth, biome unlocks |
| Atomicrops | Day farm and raid, night defend | Day of a few minutes; ~30-40 min year | Biomes by risk, bridges |
| Kingdom Two Crowns | Day build, night wave | Day of a few minutes; island 30-60 min | Boat to next island |
| Loop Hero | Player sets the danger; retreat choice | 10-30 min expedition | Camp buildings unlock cards |
| Cult of the Lamb | Crusade then base chores | 10-15 min crusade | Follower count per region |
| Moonlighter | Dungeon dive then shop day | 15-30 min dive, 5 min shop | Dungeon boss opens next |
| Dave the Diver | Two dives then restaurant night | 5-10 min dive | Depth by suit and tank |
| Hades | Run then hub | 20-40 min run | Biome order inside the run |
| Stardew Valley | Clocked day, no hard fail | ~14 min day | Tools, mine floors, bundles |
| Core Keeper | Free roam, bosses on demand | Open; 20-60 min outings | Wall hardness vs tool tier, bosses |
| Valheim | Free roam, night danger, raids | Open; ~30 min day | Bosses give the key to next biome |
| V Rising | Night roam, day is hazard | Open | Boss kills unlock recipes |
| Dysmantle | Free roam, enemies return at rest | Open; campfire to campfire | Tool tier vs object hardness |
| Albion Online | Safe zones to full-loot zones | Open; 15-40 min gather trip | Zone colour and tier 1-8 |
| OSRS / Melvor | No pressure at all | Seconds to hours | Skill level thresholds |
| Brotato / VS / HoT | Constant pressure | 20-90 s waves; 20-30 min run | None (stage select) |

## Game notes

### Core Keeper (Pugstorm, 2D top-down mining sandbox, 1-8 players)
- **Loop:** dig outward from a central Core, find ore, smelt, craft the
  next pick and armour, summon and kill a boss, feed its trophy to the
  Core, repeat in the next biome.
- **Calm vs pressure:** mostly calm. Mobs live in biome pockets; bosses are
  fought when the player chooses (most need a crafted summon item). No
  timers, no hunger death spiral.
- **Session:** open-ended; an outing to a new biome and back is 20-60 min.
- **Long-term:** ore ladder (copper, tin, iron, scarlet, octarine,
  galaxite, solarite), about nine skills that level by doing with a talent
  point every few levels, base automation (drills, conveyors, farms).
- **Gating:** biomes are rings around the Core; walls of the next biome
  need the previous tier's tool; the three first bosses lower the Great
  Wall to the outer biomes [3].
- **Return hooks:** the map reveals as you dig (strong on little art: fog,
  tile colour, glow ores visible through walls), next-tier ore glints.
- **Complaints:** grind is the top negative theme in review aggregates;
  gathering to summon bosses is taxing; crafting and cooking skills level
  only if you grind them on purpose; difficulty spikes at biome edges [3].

### Forager (HopFrog, 2D top-down, solo)
- **Loop:** hit everything, gain XP, pick a skill, build a structure,
  earn coins, buy the next land tile, find its puzzle or dungeon.
- **Design intent:** "an idle game the player does not want to leave
  idle"; the over-powered late game is treated as the reward [1].
- **Calm vs pressure:** almost all calm. Enemies are a nuisance on the
  field; real combat lives in four short dungeons the player enters by
  choice. Resources respawn fast enough to be overwhelming, not scarce.
- **Session:** no unit; "one more land" every 5-15 min. Finishes in
  10-20 h.
- **Long-term:** 64-skill grid in four quadrants (each skill unlocks a
  building or recipe, not a stat), land grid, museum bundles, feats.
- **Gating:** price of land and five biome colours (grass, desert, ice,
  graveyard, fire). One tileset recolour and a few props per biome.
- **Return hooks:** a new unlock every few minutes for the first hours;
  the museum gives collection targets.
- **Complaints:** slow first hour, then runaway automation makes manual
  gathering pointless; little to do once the grid is full; touch controls
  on the mobile port drew criticism [1][2].

### Moonlighter (Digital Sun, 2D top-down action plus shop)
- **Loop:** dive a dungeon at night, fill a 20-slot bag, leave by pendant
  (cheap, one way) or emblem (dear, can return), price and sell in your
  shop by day, spend gold on gear and town shops.
- **Calm vs pressure:** combat is the gathering. The calm half is the
  shop, a short pricing mini-game where customer faces reveal the right
  price. Bag curses make packing a small puzzle.
- **Session:** dive 15-30 min, shop day about 5 min.
- **Long-term:** four dungeons plus a finale, three floors and a boss
  each; gear tiers made from that dungeon's drops; town upgrades.
- **Gating:** pure boss gate; each dungeon is a palette and enemy set.
- **Return hooks:** deeper floors hold much better loot, so each dive asks
  "one more room or leave now".
- **Complaints:** repetition; players saw too little depth or reason to
  re-run a dungeon, and the gear grind between dungeons felt padded. The
  studio rebuilt those layers in the sequel but kept the two-life loop [8].

### Cult of the Lamb (Massive Monster, 2D-ish action plus colony)
- **Loop:** crusade through a short room-based dungeon for followers and
  materials, return to feed, house and preach, spend devotion on buildings
  and doctrine, crusade again.
- **Calm vs pressure:** strict alternation, and the base keeps ticking
  while you fight (hunger, faith, illness), so a long crusade costs you at
  home. The developers say the game only works when each half feeds the
  other [9].
- **Session:** crusade 10-15 min, base visit 5-10 min.
- **Long-term:** four progress tracks at once (devotion tree, doctrines,
  story, lamb level), so no activity ever feels wasted [11].
- **Gating:** each of four regions opens at a follower count; each needs
  several crusades before its boss.
- **Return hooks:** named followers who age and die; sermon and ritual
  cooldowns that are ready when you come back.
- **Complaints:** shallow combat, base chores (cleaning, cooking) that
  become busywork, a thin endgame at launch.

### Dave the Diver (Mintrocket, 2D side view)
- **Loop:** two dives per day for fish and materials, then run the sushi
  bar at night; money upgrades suit, tank, cargo box and weapons.
- **Calm vs pressure:** oxygen is both air and health and drains with
  depth and damage; cargo has a weight limit. Calm at the surface layer,
  tense at depth. The map reshuffles each dive.
- **Session:** dive 5-10 min, night 3-5 min. Very phone-shaped; it shipped
  on mobile-class hardware (Switch) well.
- **Long-term:** depth bands opened by gear tier, staff levelling, recipe
  upgrades fed by duplicate fish, farm and fish farm later.
- **Gating:** depth = tier. Same sea, new band, new fish list.
- **Return hooks:** a new system arrives whenever the last one fades;
  some reviewers call pacing its gift [12].
- **Complaints:** the same trait read the other way: too many shallow
  mini-games, loss of focus, the core loop running out of steam over ~35
  hours, and catching more than the restaurant can sell [12].

### Stardew Valley (ConcernedApe, 2D top-down)
- **Loop:** a clocked day (about 14 min real time) with an energy bar;
  water, gather, mine or fish, sell overnight, sleep.
- **Calm vs pressure:** no fail state. The day clock makes you choose
  because you cannot do everything [24]. Combat exists only in the mines,
  entered by choice, with an elevator checkpoint every five floors.
- **Session:** one day; a perfect save-and-stop unit.
- **Long-term:** five skills to level 10 with a profession choice at 5 and
  10, tool tiers (copper, steel, gold, iridium), Community Centre bundles
  that turn "collect everything" into rooms that each unlock a map change
  (bus, minecart, bridge, greenhouse).
- **Gating:** tool gates (a log needs a steel axe), bundle gates, floor
  depth in the mine.
- **Return hooks:** goals without deadlines [24]; crops that will be ready
  tomorrow; the bundle checklist always shows what is missing.
- **Complaints:** slow first week, energy starvation early, inventory
  fiddling.

### Melvor Idle (Games by Malcs, menu idle game, phone first)
- **Loop:** choose one skill action, let it tick, come back, spend the
  output on another skill or on combat gear.
- **Origin:** a solo developer turning RuneScape's skills and combat into
  a menu-based idle format; later published by Jagex [13].
- **Calm vs pressure:** none. Combat is an automated tick fight whose only
  risk is going in under-prepared.
- **Session:** 30 seconds to check in; offline progress runs for many
  hours.
- **Long-term:** 20-plus skills to 99, plus a per-item mastery level and a
  per-skill mastery pool that buy efficiency perks. Mastery is the clever
  part: every item has its own small ladder, so there is always a bar
  about to fill.
- **Gating:** skill level thresholds and gear requirements for dungeons.
- **Return hooks:** something has always finished while you were away.
- **Complaints:** it is a spreadsheet; late levels are pure waiting; no
  spatial play at all.

### RuneScape / OSRS skilling
- **Loop:** stand at a node, gather, bank, refine, craft, sell.
- **Curve:** XP per level doubles about every seven levels; level 92 is
  half of 99 and level 85 is a quarter [15].
- **Why the first half feels good:** unlocks land every 5-15 levels early
  (woodcutting: oak 15, willow 30, maple 45, yew 60, magic 75; a better
  axe at 6, 11, 21, 31, 41, 61), and each unlock changes where you stand
  and what you sell, not only a number.
- **Skills feed each other:** mining feeds smithing feeds combat gear;
  a quest needs level X in three skills, which gives a reason to level.
- **Session:** any; low attention ("AFK") by design.
- **Return hooks:** the 99 cape as a visible trophy; grand exchange
  prices; quests as skill-gated goals.
- **Complaints:** the back half is the textbook grind wall; best XP method
  is often the dullest; players burn out or bot.

### Albion Online (Sandbox Interactive, top-down MMO, on phones)
- **Loop:** gather in a zone, haul to a city, refine, craft, sell on the
  local market or carry it to a city where it is worth more.
- **Zones:** four colours of risk. Blue is safe; yellow has opt-in PvP
  with knockdown; red and black are full loot. Higher resource tiers sit
  in more dangerous zones [7].
- **Tiers:** every resource, tool, station and item is tier 1-8, shown by
  a colour and a roman numeral. One icon recoloured eight times is the
  whole art budget for a resource line.
- **Progression:** the Destiny Board replaces character levels. Each
  resource and each craft line is a node that fills with "fame" from doing
  that thing; mastery covers a family, specialisation one item [6].
- **Session:** a gather trip of 15-40 min with a natural end (bag and
  mount weight full).
- **Return hooks:** your bag is at risk until you bank it; the economy is
  entirely player-made, so every node has a buyer.
- **Complaints:** full loot scares off solo players; ganking; long fame
  grind at tiers 7-8; premium status speeds everything.

### Valheim (Iron Gate, 3D, 1-10 players)
- **Loop:** prepare (food, rested buff, gear), travel, gather the biome's
  metal, haul it home, upgrade stations and gear, kill the biome boss.
- **Gating:** each boss drops the key to the next biome (antler pickaxe,
  swamp key, wishbone to find silver, and so on). Bosses gate crafting,
  crafting gates biomes, biomes gate bosses [4].
- **Stations:** a workbench levels up when you build attachments near it
  (chopping block, tanning rack), and its level caps gear upgrades. The
  station is visibly bigger at each level.
- **Housing with purpose:** furniture adds comfort; comfort sets how long
  the rested buff lasts; only the best item per category counts, so
  variety is rewarded and spam is not [4].
- **Calm vs pressure:** biomes are the difficulty dial; night is more
  dangerous; base raids come as events after boss kills.
- **Friction as design:** metals cannot pass through portals, so hauling
  is a planned trip [4].
- **Complaints:** ore hauling and inventory weight, the swamp difficulty
  wall, long gaps between new content late on.

### V Rising (Stunlock, top-down ARPG survival)
- **Loop:** track a named boss, kill it, drink its blood to unlock a
  recipe, station or power, craft the next gear set, expand the castle.
- **Gating:** "gear level is character level"; each boss shows a level,
  and the tech tree is the boss list. Gathering exists to suit up for the
  next named enemy, not to fill a bar [16].
- **Calm vs pressure:** daylight burns, so day trips mean hopping between
  shadows; night is the free-roam window. A cheap, readable pressure that
  needs only a shadow layer.
- **Base:** castle floors by tier give bonuses to stations placed in a
  matching room; servants run timed off-screen hunts for resources.
- **Session:** open; 20-40 min boss outings.
- **Complaints:** progression is a single thread you cannot leave; hard
  gear roadblocks; material grind turns tedious early; castle progress
  locked behind specific bosses [16].

### Necesse (Fair Games, 2D top-down, tiny team)
- **Loop:** explore islands and caves, mine, kill the next boss in a fixed
  order, recruit settlers who farm, haul and craft for you.
- **Calm vs pressure:** calm overworld, dangerous caves, periodic raids on
  the settlement that scale with world progress [17].
- **Long-term:** gear tiers by boss, settlement growth, an end-game wizard
  fight that opens repeatable missions and new biomes [17].
- **Gating:** boss order; biome per island; deeper cave layers.
- **What it shows:** this is close to the scope in question, built by a
  very small team with simple top-down pixel art.
- **Praise:** chest sorting and settler hauling remove inventory pain [17].
- **Complaints:** early biomes feel disposable, progression is linear and
  quests repeat, settler gathering becomes overpowered, uneven boss
  balance [17].

### Dysmantle (10tons, top-down, on iOS and Android)
- **Loop:** smash every object for materials, upgrade the tool, smash
  harder objects, open the next region.
- **Gating:** tool tier against object hardness. The world is full of
  things you cannot break yet, and each tool upgrade re-values every area
  you have already crossed. This is the cheapest "new content" trick in
  the whole list.
- **Calm vs pressure:** enemies stand between you and objects; resting at
  a campfire saves, heals and lets you upgrade, but brings enemies back.
  Campfires are the save and upgrade points [18]. Death drops what you
  carried at the spot for you to fetch.
- **Session:** campfire to campfire, 5-15 min; resumable anywhere.
- **Long-term:** character level from XP for breaking and killing, tool
  and gear tiers, region completion percentages on the map.
- **Return hooks:** completion percent per region; "come back with a
  better crowbar".
- **Complaints:** repetitive combat, shallow survival layer, thin story
  and direction [18].

### Graveyard Keeper (Lazy Bear, 2D top-down)
- **Loop:** process bodies, craft, sell, unlock tech with three colours of
  points earned from different kinds of work.
- **Use as a warning.** Reviews name the failures precisely: grind to
  refine, grind for points, grind for money; no quality-of-life upgrades
  to buy (speed, bag, energy, selling); energy that only returns with
  sleep or food; long walks home when it runs out; NPCs available one day
  a week so quests stall [19].
- **What it did right:** three point colours tie tech to the type of work
  done, and the workyard visibly fills with stations.
- **Lesson:** deep recipe chains need short legs: storage near stations,
  fast travel early, and upgrades that remove chores.

### Loop Hero (Four Quarters)
- **Loop:** the hero walks a loop and fights by himself; the player places
  tiles that spawn enemies and so sets his own danger and income.
- **Extraction rule:** retreat at the camp tile and keep 100% of the
  resources; retreat mid-loop and keep 60%; die and keep 30% [14]. The
  retreat choice became the game's main tension.
- **Session:** 10-30 min expeditions, 1.5 years of development [14].
- **Long-term:** a camp you build with expedition resources; each building
  unlocks a class, a card or a mechanic.
- **Calm vs pressure:** the player is the difficulty slider; greed is the
  enemy.
- **Complaints:** camp upgrades need a lot of resource farming; the
  mid-game drags; hands-off combat is not for everyone.

### Vampire Survivors, Brotato, Halls of Torment (the heritage, for contrast)
- **Loop:** move only, weapons fire themselves, level up every few
  seconds, survive a fixed time.
- **Pressure:** constant and rising. Brotato uses 20 short waves (20-90 s)
  with a shop between; Vampire Survivors a continuous 30 min; Halls of
  Torment about 30 min with a boss [20].
- **Meta:** flat stat purchases and unlocks; Halls of Torment adds quests
  (each one an achievement) and gear slots [21].
- **A pattern worth stealing from Halls of Torment:** gear found in a run
  is only kept if you send it up the well, and at first you may send one
  item per run. A tiny extraction choice inside a horde game.
- **Why they tire:** no place, no rest, nothing persistent in the world.
  This is the "too much" the owner feels.
- **What they prove for phones:** one thumb is enough when attack is
  automatic.

### Deep Rock Galactic: Survivor (Funday, the closest relative)
- **Loop:** a dive of five stages. In each stage you kite a horde through
  destructible rock, mine gold and nitra (spent between stages), collect
  permanent-currency minerals, kill the elite, then reach the drop pod.
- **Calm vs pressure:** not alternated but layered. Mining is done under
  attack; tunnelling is both gathering and escape route, because bugs path
  around rock. Mining is widely praised as what makes it more than a
  clone [22].
- **The escape:** a 30 s run to the pod, "while weighing the urge to
  detour for a bit of mining" [22].
- **Session:** stage ~4-7 min, dive ~25-35 min.
- **Long-term:** class and weapon unlocks, mineral-bought permanent
  stats, biome masteries.
- **Complaints:** the 30 s pod timer is the most common gripe (terrain can
  make it impossible); directional weapons fight with mining; some say it
  is a good Deep Rock game but a weak survivor game [22].

### Hades (Supergiant)
- **Loop:** run, die, return to the House with several currencies.
- **Hub lessons:** each currency has its own sink (mirror for stats, keys
  for unlocks, gems for the contractor's renovations, nectar for
  relationships), so every run pays into something [23]. The house
  visibly changes, and characters react to what just happened in the run.
- **Calm vs pressure:** the hub is a two-minute exhale between 20-40 min
  runs.
- **Complaints:** little relevant here; cosmetic renovations feel hollow
  to some players once the functional ones are bought.

### Kingdom Two Crowns (Noio, Coatsink; on phones)
- **Loop:** ride left or right and drop coins. Coins recruit, build and
  upgrade. The Greed attack at night and grow stronger each night [25].
- **Calm vs pressure:** day is economy, night is defence, a blood moon is
  a spike. The player never attacks directly.
- **Controls:** two directions and one action. The minimal end of phone
  design.
- **Long-term:** five islands reached by boat; gems unlock mounts and
  hermits that persist; steady growth rather than fast expansion [25].
- **Complaints:** rules are never explained, a lot of waiting and riding,
  an earlier entry was judged too simple for its ambition [25].

### Atomicrops (Bird Bath Games)
- **Loop:** by day plant and water, and raid the surrounding biomes for
  seeds, tools and upgrades; at night defend the field; then a short town
  visit. Four seasons of three days, a boss per season.
- **Calm vs pressure:** there is no calm. Farming is done while shooting.
  Short cycles keep a frantic pace, which reviewers either love or find
  frustrating [28].
- **Gating:** biomes ring the farm, ordered by danger; bridges open the
  far ones.
- **Lesson:** a field you must both tend and defend splits attention too
  hard for many players. Valuable as the upper bound of pressure.

### Dome Keeper (Bippinbits; on phones)
- **Loop:** dig below the dome for iron, water and cobalt while a timer
  counts down to the next wave; carry ore back; spend it; defend.
- **Calm vs pressure:** the cleanest alternation in the list. You are
  completely safe while mining, yet the countdown never stops. The
  developer calls the emotional balance between tense fights and calm
  digging crucial, and says every mining decision is about using the time
  before the next wave [5].
- **The tension is travel time:** the deeper the ore, the longer the trip
  back, so greed is measured in seconds.
- **Session:** 30-60 min run; wave cycle of a minute or two.
- **Long-term:** thin (dome, gadget and keeper unlocks).
- **Complaints:** an optimal digging pattern is obvious and repetitive;
  limited long-term scope; "a game of two halves" [5].

## Synthesis

### 1. Mixing calm gathering with bursts of combat

Seven patterns, from least to most pressure:

1. **Opt-in combat pockets** (Stardew mines, Forager dungeons, Core Keeper
   bosses). The field is safe; danger is a door. Calmest, but loses the
   horde heritage entirely.
2. **Guarded nodes** (New World, Albion, Dysmantle). The better the node,
   the tougher what stands on it. Combat is a toll paid for a specific
   reward, in bursts of 10-30 s. Cheap: a spawn rule per node tier.
3. **Day / night** (Valheim, V Rising, Kingdom, Atomicrops). The clock
   says when to gather and when to be behind walls. Works when night is
   under a third of the cycle and the player can see it coming.
4. **Mine then defend** (Dome Keeper). Fully safe gathering on a visible
   countdown; the wave arrives whether you are home or not. Greed is paid
   in travel time.
5. **Rising threat with extraction** (Loop Hero, Halls of Torment's well,
   Albion's bag, Moonlighter's pendant, DRG:S pod). Calm at the start;
   danger grows with time or with how much you have taken; you choose when
   to leave; leaving early banks everything, dying banks part. Loop Hero's
   100 / 60 / 30 split is the proven tuning [14]. Full loss is too harsh
   for a calm game.
6. **Noise** (a variant of 5). Harvesting itself raises the threat, so the
   player controls the pace: pick herbs quietly or fell the big tree and
   bring a pack.
7. **Layered** (DRG:S, Atomicrops). Gather under attack all the time.
   This is the present game plus mining, and is the "too much" end.

What the good ones share:

- **The calm is real.** In Dome Keeper nothing can hurt you underground.
  Half-calm (a trickle of weak mobs) reads as noise, not rest.
- **The pressure is announced.** A countdown, a sky colour, a meter. Calm
  is only restful when the player knows how long it lasts.
- **The player sets the dose.** Depth, zone tier, tile placement, when to
  extract. The complaint about horde games is that the dose is fixed.
- **The burst is short.** 20-90 s of fighting per 2-5 min of gathering is
  the common ratio (Dome Keeper, Kingdom, Brotato's wave length).
- **Each half pays the other.** Loot from the fight is a crafting input;
  crafted gear makes the next fight shorter [5][9].

### 2. Zone and tier gating that works in 2D with little art

- **Tier colour plus numeral** (Albion). One node sprite, eight tints.
  Players learn the colour ladder once and read every screen with it.
- **Biome as palette swap** (Forager, Core Keeper, Moonlighter). Ground
  tint, two or three props, one ambient effect, an enemy recolour with one
  new behaviour. Five biomes is the usual count for a small team.
- **Tool gate** (Dysmantle, Stardew, Core Keeper walls). Show the locked
  thing early and often. Every tool upgrade then re-values old zones at no
  art cost. The best value pattern here.
- **Skill threshold on a visible node** (New World, OSRS). A greyed node
  with "Mining 12" on it is a goal the player sets for himself.
- **Boss gate that hands over a key** (Valheim, V Rising). The boss drop
  is the tool or station part for the next tier, so the gate and the
  reward are one object. Avoid V Rising's single thread: give two bosses
  per tier in either order [16].
- **Ring or depth layout** (Core Keeper rings, Dave's depth, Dome
  Keeper's rows). Distance from home is difficulty. Readable without a
  map, and it makes "how far do I dare" the trip decision.
- **Procedural fill, authored landmarks.** Scatter nodes by rule, but
  place by hand one chest vault, one elite camp and one oddity per zone.
  Forager's one puzzle per land tile is the model [1].
- **Zones that gain content as you level** (New World). Low zones should
  hold a few high nodes, locked, so old ground stays worth crossing.
- **Chests on cooldown, with a rarity ladder** and a small schematic
  chance. A daily reset gives a reason to re-run a zone that is otherwise
  out-levelled.

Avoid: early zones that become disposable (Necesse [17]), and biome
difficulty walls that need grinding to pass (Core Keeper, Valheim's
swamp [3]).

### 3. Housing and base that give purpose

- **Trophies with buffs** (New World). A small number of slots (3-5),
  each trophy a boss or zone feat, each a narrow buff (yield from ore,
  craft quality, damage to one mob family). Slots force a choice, so the
  house becomes a build.
- **Comfort by variety** (Valheim). Count only the best item per furniture
  category; the reward is a longer "rested" buff for the next outing [4].
  This rewards filling the house with different things, not copies.
- **Stations that grow in view** (Valheim attachments, New World station
  tiers). The upgrade is an object placed next to the bench. The town is
  the progress bar.
- **Display** (Forager museum, Stardew bundles, Core Keeper boss statues).
  Shelves that accept one of each item of a set; a completed set pays a
  permanent perk. Turns hoarding into a checklist.
- **Storage as a reward.** Chest capacity and auto-sort are upgrades
  players love (Necesse [17]) and their absence is hated (Graveyard
  Keeper [19]).
- **Somewhere the run is felt** (Hades, Cult of the Lamb). An NPC or pet
  that comments on what you brought back; work that finished while you
  were out.
- **Visitors** in a shared world: a guest book, a visible trophy wall, a
  shop shelf others buy from (Moonlighter's shop turned outward, Albion's
  player-owned stations with a usage fee).
- **Recall point.** The house as the fast-travel anchor gives it a use in
  every session.

Avoid cosmetic-only decoration as the main sink; it is the part of Hades'
contractor that players stop caring about.

### 4. Trade-skill levelling that stays fun

- **Few skills, short ladders.** Four to six skills, 20-30 levels each,
  beats 15 skills of 200. Stardew's ten levels with a choice at 5 and 10
  carry 80 hours.
- **An unlock at every level or two for the first half**, and every unlock
  is a thing in the world (a node, a recipe, a station part), never only
  +2%. OSRS's first 60 levels follow this; its last 30 do not [15].
- **XP that scales with tier**, so the newest node is always the best XP
  and nobody levels by spamming tier-1 items. New World's craft-and-
  salvage spam is the anti-pattern [27].
- **First-time bonuses.** Large XP for the first craft of each recipe and
  the first harvest of each node type. Rewards breadth, kills spam.
- **Mastery per item** (Melvor). A small 1-5 star ladder on each recipe or
  node (faster, chance of double, chance of quality). There is always a
  bar close to full.
- **Milestone choices** (Stardew professions, Core Keeper talents). A pick
  at set levels that changes how you play that skill.
- **Skills need each other and something needs them.** Commissions, town
  projects and boss summons that ask for specific goods give direction
  (New World's town board was praised for this [27]).
- **Levelling by doing, with a catch-up.** A rested bonus (Valheim) or
  first-nodes-of-the-day bonus suits short phone sessions and softens the
  wall.
- **Gate by level, not by volume.** If the next zone needs Mining 12, the
  time to get from 11 to 12 must be one or two outings. The grind wall is
  simply the point where one level stops fitting in one sitting.
- **Chase goals over bars** (V Rising at its best): gather to suit up for
  a named thing, not to fill a number [16].

### 5. Phone-friendly control and session patterns

- **One thumb, move only.** Floating stick anywhere on screen; attack is
  automatic (the Vampire Survivors lesson).
- **Gather by proximity.** Stand next to a node and the swing starts;
  walking away cancels. No aim, no tap target. Standing still to finish a
  big node while something approaches is a ready-made risk choice.
- **One context button at most**, on the thumb side, for chest, station
  and extract.
- **No inventory puzzles in the field.** Weight or slot count only; sorting
  happens in town. Moonlighter's bag puzzle and Graveyard Keeper's hauling
  are the phone-hostile end.
- **Sitting unit of 3-10 minutes with a clean end** (a Stardew day, a
  Dave dive, a DRG:S stage, a Dysmantle campfire hop). The end screen is
  the save point.
- **Resumable mid-outing.** Checkpoint at each camp, cleared camp or
  stage; a phone call must not cost the bag.
- **Timers that run while away** (Melvor, V Rising servants, smelters).
  Refining queues give the 30-second check-in session and make opening
  the game feel rewarded. Keep them short (minutes, not days) in a
  paid game.
- **Readable at 6 inches.** Tier by colour, big node sprites, few numbers
  on the field.
- **Premium works on phones for this genre:** Dysmantle, Dome Keeper,
  Stardew Valley and Kingdom Two Crowns all sell as paid mobile games.

### 6. Three hybrid structures that fit

"New World feeling in a small 2D game with a horde-run heritage."

#### A. Expedition with rising threat and extraction (recommended spine)

Pick a zone and tier from the town map. Land at a camp. The first minutes
are quiet: nodes, a chest, guarded rich nodes. A threat meter climbs with
time and with noisy harvesting. Leave at any camp tile and keep
everything; the exit is a 30-60 s horde hold (the existing arena wave).
Die and keep part of the bag. 6-10 min per expedition. Zones, skills,
stations and house persist; the zone layout can reshuffle.
Parents: Loop Hero, DRG: Survivor, Halls of Torment's well, Dave the
Diver, Moonlighter.

- **For:** keeps the run shape the code and the players already have;
  bounded phone sessions; the player doses the pressure; the horde becomes
  a climax instead of a constant; zones can be procedural, so little art;
  works solo and offline, and in a shared world (the same zone seed for
  everyone that day).
- **Against:** the world is a menu of instances, not a place, so the "I
  live here" feeling must come from the town and house; reshuffled zones
  weaken "I know where the iron is"; extraction timers are the most
  complained-about part of DRG:S [22], so the exit must be reachable and
  generous.
- **Cheapest test:** one zone, one threat meter, the 100 / 60 / 30 rule,
  existing waves as the exit hold.

#### B. Persistent zoned overworld with day and night

One saved map in rings or bands around the town, tier rising with
distance. Nodes respawn on timers. Day is calm with guarded nodes; night
brings roaming packs (or a bell the player rings to call a horde for
loot). Boss per ring hands over the next tool part. Walk out, fill the
bag, walk or recall home.
Parents: Valheim, Core Keeper, Dysmantle, Necesse, New World itself.

- **For:** closest to the New World feeling; a real place to learn; tool
  and skill gates re-value old ground; the strongest base and housing
  fantasy; shared world reads naturally as an MMO.
- **Against:** most content and most tuning for a tiny team; no natural
  session end, so phone play needs added structure (campfires, bag
  limits); persistent shared-world state is the hardest technical case;
  the horde heritage shrinks to night events; travel time on a phone is
  dead time unless the world is small.
- **Cheapest test:** a single screen-and-a-half ring around the town with
  three node tiers, a tool gate and a night pack.

#### C. Camp cycle: gather on a countdown, then defend

Each outing plants a camp in a zone. Rounds alternate: 60-120 s of fully
safe gathering around the camp while a countdown runs, then a wave at the
camp (the existing arena). Between rounds, spend what you gathered on camp
upgrades and decide whether to push one more round at a higher tier or
pack up. Nodes farther from camp are richer; being late to the wave costs
camp health.
Parents: Dome Keeper, Kingdom Two Crowns, Atomicrops.

- **For:** the smallest change from today (waves stay, calm is inserted
  between them); the alternation is the best-liked rhythm in the research
  [5]; very clear on a phone; rounds are natural checkpoints.
- **Against:** the tether to camp limits exploration, so it feels like a
  better arena rather than a world; Dome Keeper's own complaints apply
  (an optimal route appears, long-term scope is thin [5]); zone identity
  matters less; chests and discovery have little room.
- **Cheapest test:** stretch the bench break of the current run into a
  gathering field with a countdown.

#### How they combine

A is the spine, C supplies its ending, B supplies its memory. Concretely:
expeditions (A) into zones whose unlock state, tool gates, boss keys and
chest cooldowns persist (from B), ending in a camp hold (from C). If the
shared world later proves its worth, the town and one home ring can become
persistent without changing the loop.

## Cross-cutting warnings

- **Do not ship a second game on top of the first.** Dave the Diver's
  mixed reception for its side systems, and Moonlighter's shallow halves,
  both come from spreading thin [8][12]. One loop, two phases.
- **The grind wall is a session-fit problem.** Complaints start when one
  level, one tier or one summon stops fitting in one sitting
  (New World ~100, OSRS 70+, Core Keeper boss summons, V Rising
  materials) [3][15][16][27].
- **Buy the chores away.** Bag size, walk speed, auto-sort, fast travel
  and bulk craft must be purchasable early (the Graveyard Keeper
  lesson [19]).
- **Runaway automation ends the game** (Forager, Necesse settlers
  [1][17]). Automate refining, never gathering.
- **A fixed single-thread boss order feels like a corridor** (V Rising,
  Necesse [16][17]). Two gates per tier, any order.

## Sources

Found by web search in this session. Items marked (excerpt) could not be
opened in full from here.

1. Game Developer, "When grinding is fun: Forager's compelling approach to
   'idle game' design" (excerpt):
   https://www.gamedeveloper.com/design/when-grinding-is-fun-i-forager-i-s-compelling-approach-to-idle-game-design
2. Forager reviews: https://gamingtrend.com/reviews/one-tile-at-a-time-forager-review/ ,
   https://www.godisageek.com/reviews/forager-review/ ,
   https://pixelpoppers.com/review/forager/ , https://yal.cc/forager-retrospect/
3. Core Keeper: https://pcgamer.com/games/survival-crafting/core-keeper-review ,
   https://xgamingserver.com/blog/core-keeper-progression-guide/ ,
   https://vaporlens.app/app/1621690/core_keeper ,
   https://steamcommunity.com/app/1621690/discussions/0/4764333224361236897
4. Valheim: https://www.pcgamer.com/games/survival-crafting/valheim-biome-order/ ,
   https://turbo-wiki.pages.dev/game-loops/valheim-game-mechanics ,
   https://mobalytics.gg/gamebase/guides/valheim-progression-guide-for-all-biomes
5. Dome Keeper: Game Developer / Road to IGF interview with René Habermann
   (excerpt)
   https://www.gamedeveloper.com/road-to-igf-2023/how-dome-keeper-focuses-on-systems-that-feed-into-one-another ;
   https://shacknews.com/article/132448/dome-keeper-review ,
   https://gideonsgaming.com/dome-keeper-review/ ,
   https://store.steampowered.com/app/1637320
6. Albion Destiny Board: https://heaven-guardian.com/albion-online-destiny-board-guide/ ,
   https://www.engadget.com/2014/06/04/albion-online-redefines-character-progression-through-the-destin/
7. Albion zones: https://studioloot.com/articles/types-of-zones-in-albion-online ,
   https://itemlevel.net/albion-online-zone-types-explained/ ,
   https://altarofgaming.com/albion-online-gathering-guide/
8. Moonlighter: https://mcvuk.com/when-we-made-moonlighter/ ,
   https://www.pcgamer.com/games/roguelike/moonlighter-2-made-me-reckon-with-how-cozy-a-shopkeeping-roguelite-with-a-heavy-helping-of-hades-can-get ,
   https://www.gamesradar.com/games/roguelike/we-know-that-the-players-are-the-ones-actually-enjoying-the-game-moonlighter-2-owes-its-existence-to-its-devs-astonishingly-in-depth-approach-to-player-feedback
9. Cult of the Lamb, Unity interview:
   https://unity.com/en/blog/games/recipe-behind-smash-hit-cult-of-the-lamb
10. Cult of the Lamb GDC talks (marketing, Twitch):
    https://gdcvault.com/play/1029153/Growing-an-Internet-Cult-Cult ,
    https://gdcvault.com/play/1034489/Independent-Games-Summit-Cult-of
11. https://gamegrin.com/articles/cult-of-the-lamb-is-progression-done-right
12. Dave the Diver: https://www.destructoid.com/review-dave-the-diver/ ,
    https://vaporlens.app/app/1868140/dave_the_diver ,
    https://www.invenglobal.com/articles/22933/the-joy-of-dave-the-diver ,
    https://backloggd.com/u/ac_church/review/1330627
13. Melvor Idle: https://www.pcgamer.com/jagex-to-publish-runescape-inspired-idle-game-melvor-idle ,
    https://www.pocketgamer.com/new-releases/melvor-idle
14. Loop Hero: postmortem (excerpt) https://gamedeveloper.com/design/postmortem-loop-hero ;
    https://medium.com/@sacitsivri/game-design-breakdown-loop-hero-4a86d55142b8 ,
    https://www.inverse.com/gaming/loop-hero-interview ,
    https://en.wikipedia.org/wiki/Loop_Hero (excerpt)
15. OSRS: https://oldschool.runescape.wiki/w/Experience_table ,
    https://oldschool.runescape.wiki/w/Level
16. V Rising: https://www.windowscentral.com/gaming/v-rising-has-plenty-of-bite-but-big-issues-dull-its-fangs ,
    https://www.aggrogamer.com/article/11347/Review--V-Rising ,
    https://vaporlens.app/app/1604030/v_rising ,
    https://www.pushsquare.com/reviews/ps5/v-rising
17. Necesse: https://exploringthegames.substack.com/p/necesse-survival-colony-sim-review-fair-games-aps ,
    https://nichegamer.com/necesse-preview ,
    https://www.gamingonlinux.com/2023/08/open-world-colony-building-survival-game-necesse-gets-a-huge-expansion ,
    https://vaporlens.app/app/1169040/necesse
18. Dysmantle: https://en.wikipedia.org/wiki/Dysmantle (excerpt) ,
    https://www.gameskinny.com/reviews/dysmantle-review-break-em/ ,
    https://148apps.com/reviews/dysmantle-review
19. Graveyard Keeper: https://game-wisdom.com/analysis/graveyard-keeper ,
    https://gamegeeker.com/games/graveyard-keeper
20. Survivors-likes on mobile: https://choostgames.com/blog/mobile-games-like-vampire-survivors/ ,
    https://www.pocketgamer.com/halls-of-torment/out-now
21. Halls of Torment: https://rogueliker.com/halls-of-torment-review/ ,
    https://www.godisageek.com/reviews/halls-of-torment-review ,
    https://www.gematsu.com/games/halls-of-torment ,
    https://www.w4games.com/blog/w4-games-news-1/interview-with-chasing-carrots-developer-of-halls-of-torment-120
22. DRG: Survivor: https://www.pcgamer.com/games/roguelike/deep-rock-galactic-survivor-review ,
    https://gamespot.com/articles/deep-rock-galactics-vampire-survivors-style-game-excels-by-giving-you-something-new-to-do/1100-6521414/ ,
    https://rogueliker.com/deep-rock-galactic-survivor-review/ ,
    https://steamcommunity.com/app/2321470/discussions/0/4371376043391859503 ,
    https://techraptor.net/gaming/guides/deep-rock-galactic-survivor-guide
23. Hades: https://www.avclub.com/how-hades-rescues-the-roguelike-from-its-own-limit ,
    https://gamespot.com/articles/hades-changes-what-it-means-to-be-a-roguelike/1100-6483420/ ,
    https://www.gamesradar.com/hands-on-with-hades-supergiants-devilishly-stylish-underworld-dungeon-crawler
24. Stardew Valley: https://www.pcgamesn.com/stardew-valley/stardew-valley-map-design ,
    https://cannibalhalflinggaming.com/2024/04/11/stardew-valleys-closed-world/
25. Kingdom: https://gamedeveloper.com/design/-i-kingdom-two-crowns-i-and-the-practical-intersection-of-pixel-art-and-roguelike-design (excerpt) ,
    https://gideonsgaming.com/kingdom-two-crowns-review-money/ ,
    https://gamesbeat.com/kingdom-is-a-little-too-simple-for-what-it-wants-to-be/ ,
    https://medium.com/retronator-magazine/the-fall-and-rise-of-kingdom-f6a3da699f0d
26. New World praise and grind: https://pcgamer.com/im-only-a-few-hours-into-new-world-but-the-grind-is-already-frustrating ,
    https://www.pcgamesn.com/new-world/review-pc ,
    https://aggronaut.com/2021/11/02/new-world-systems-review/
27. New World crafting wall: https://aggronaut.com/2022/06/01/new-worlds-fatal-flaw ,
    https://massivelyop.com/2022/01/03/vitae-aeternum-explaining-new-worlds-level-30-wall/ ,
    https://www.denofgeek.com/?p=723534
28. Atomicrops: https://shacknews.com/article/110951/atomicrops-interview-sow-the-seeds-of-pain ,
    https://godisageek.com/reviews/atomicrops-review/ ,
    https://intothespine.com/2020/12/06/atomicrops-review/
