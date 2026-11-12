# How New World's loot feels over the whole journey, and what makes loot exciting

Written 2026-11-12 for round 3 of the pivot. Research only, nothing built.

The question behind it: the owner plays New World to "collect resources, turn
them into higher tiers, find loot that is rare, find rare schematics, craft
furniture and equipment, sell on the trade post, run dungeons". In Brotato the
best moment is "when you finally meet the curve with perks and upgrades and
can roll from there". In Scrip, "glimpses of discovery were fun". Three
one-slice prototypes were boring: calm gathering, a gather lull between waves,
and kills dropping raws toward one tracked recipe (`?proto=loot`). This file
asks what the loot part of New World actually feels like from level 1 to the
last season, which loot designs make players excited in other games, and what
that means for a small 2D phone game.

## How to read this file

- **[S]**: a web search result seen in this session says so. Sources are at
  the end, grouped by section.
- **[M]**: from memory or approximate. Treat the number as a rough shape.
- **Proposal** (section 5 and 6 only): our design suggestion, not a claim
  about any game.
- **Limits.** Only search-result summaries were reachable. Every page fetch
  (thegamer, studioloot, pcgamer, massivelyop, icy-veins, steamcommunity and
  the rest) was refused by the session's network policy, and the hosts listed
  as blocked were not tried. So no table or forum thread was read first-hand,
  and several "player moments" below are assembled from summaries rather than
  quoted. Where summaries disagreed, I say so.
- **Patch eras.** New World's loot was rebuilt five times: launch (Sep 2021),
  Mutations (Jan 2022), Rise of the Angry Earth (Oct 2023), Aeternum (Oct
  2024) and Nighthaven / Season 10 (Oct 2025). The game was delisted in
  January 2026 and servers close on 31 Jan 2027 [S]. When a sentence is only
  true for one era, it names the era.
- `research-new-world.md` (one folder up) already covers the gather, refine
  and town loop. This file is only about loot and its feeling.

---

## 0. The short version

1. **New World's loot is three different games stacked on top of each
   other.** While levelling, gear is a disposable trickle and the excitement
   comes from trade-skill dings and rare gathering procs, not drops. At 60
   (2021-2023) it became a per-slot number grind where every drop could nudge
   a hidden ceiling a few points. In the endgame it became a hunt for named
   items and perfect perks, decided by long odds and daily locks.
2. **What players remember is rarely a random drop.** It is the first craft
   that came out right after long preparation, a rare schematic or trophy that
   sold for a fortune, a named item after a drought, a rare material after
   thousands of nodes. The common thread: they knew the thing existed before
   they got it, it took effort, and it could be used, shown or sold.
3. **Amazon spent four years removing randomness and adding control:** perk
   locks, then a perk of your choice, then perk charms that swap for free;
   expertise (a per-slot cap) scrapped for "harder content drops better
   gear"; loot biased toward what you wear. Each fix cut a pain point. Taken
   together they also cut the jackpot: by Nighthaven one long-time player's
   blog described endgame gearing as mostly AFK farming [S], while a
   columnist said the same revamp "saved" the endgame, too late [S].
4. **Across genres the excitement has the same parts:** a signal before the
   reveal (glow, colour, sound), a few clearly ranked tiers where the top one
   is truly rare, top-tier loot that changes *how you play* rather than adding
   a number, a known chase list with an unknown timing, bad-luck protection,
   and no junk to clean up.
5. **The third prototype failed on most of these at once.** Its drops were
   raws already assigned to a recipe shown on screen, so each one was a +1 on
   a shopping list. There was no tier jump, no signal, no surprise, and the
   payoff (a tier-3 hatchet) was a stat bump delivered after the run.
6. Section 5 turns this into ten rules with numbers: what drops, how often,
   what each drop changes in the next ten seconds, and how to stage the
   reveal on a phone.

---

## 1. The loot journey, stage by stage

The rarity ladder is the genre standard: common (grey), uncommon (green),
rare (blue), epic (purple), legendary (orange) [M]. "Named" items are fixed,
hand-made items with set perks that drop from particular bosses or areas
[S]; "artifacts" (from Oct 2023) are named items with a unique rule-changing
perk and a quest line [S].

### Stage A: levelling 1-25, the starter zones

**What you get.** Quest rewards (coin, XP, a piece of gear, often off-build)
[S]; green and some blue drops from mobs; supply chests in villages and camps
with consumables, tools, low gear and the odd schematic [S]; your first
named items from named mobs and points-of-interest bosses [S]; and at about
level 25 the first expedition, Amrine Excavation. Its named drops (Simon
Grey's Toothpick, Simon's Hacksilver Ring, Darkness Defined and others) are
the first loot most players can *target*, and the quest line hands you one
free tuning orb to enter it [S].

**What is exciting.**
- Not the gear. Gear in this stage is replaced every few levels and most of
  it goes to salvage [M]. The excitement is in the many parallel bars: a
  trade skill dings, a new tier of node lights up, a crafted tool is better
  than what dropped (see `research-new-world.md`, section 9) [S].
- The first named item. It is the first time a drop has a *name* and a fixed
  identity you can look up and want.
- The first schematic. Most of them are furniture or special items rather
  than gear [M]. Some uncommon furniture schematics, such as the
  Starmetal-Braced Storage Chest (the "Hope" chest), drop at random from
  supply chests even in low zones like Monarch's Bluffs, and sell "for
  lucrative amounts" on the trading post [S]. A low-level player can find
  something a level-60 player wants to buy.

**What is a chore.** Encumbrance and bag clean-up; salvaging piles of greens
for a few coins and repair parts [S]; quest gear that does not fit your
weapon or attributes [S]; quest crafting parts salvaged by mistake, which
blocked the next quest step [S].

**How often something exciting happens [M].** A trade-skill ding every few
minutes. A drop worth equipping every 15-30 minutes, but "worth equipping" is
rarely "exciting". A named item a few times across the stage, almost all from
Amrine. A schematic perhaps once or twice.

### Stage B: levelling 25-60, the middle zones

**What you get.** A new expedition roughly every ten levels, each with its
named list [M]; crafted gear that starts to beat dropped gear; rare
gathering procs on ordinary nodes (fae iron from iron veins, petrified wood
from trees, and so on); trading-post income from materials and trophies.

**What is exciting.**
- **Crafting your own kit.** PCGamesN's reviewer found themselves "spending
  hard-earned gold on some ludicrously expensive rare materials ... just so I
  could make my first sateen hat with the right stats" [S]. PC Gamer: the
  "hypnotic crafting loop kept me logging back in, at least for a couple of
  hundred hours" [S]. The craft, not the drop, is the loot moment here.
- **The rare proc.** A rare material from the 500th node is the purest
  surprise in the game, because it comes from an ordinary act.
- **The first big sale.** A rare drop that you cannot use becomes money.

**What is a chore.** Rare-proc rates are well under 1% without luck gear
[S]. In 2021 players reported "3-5k iron veins gathered" with luck food and
perks and no fae iron at all [S]. Part of that was a real bug: patch 1.3.2
(8 Feb 2022) fixed an issue that "could make it next to impossible for an
item to drop if your luck values were too high", naming fae iron, voidmetal,
phasefiber and petrified wood [S]. The players who invested most in luck
were the ones locked out.

**How often [M].** A named item from an expedition run every run or two
(but rarely the one you wanted). A rare proc every few hours of gathering
when it works, never when it does not. A good craft every session.

### Stage C: reaching 60, the gear-score grind (2021 to Oct 2023)

**What you get.** At 60 every drop has a gear score (GS). In the launch
design each of your slots had a hidden ceiling ("high watermark", renamed
**expertise** in Dec 2021). Drops rolled at or a little above that slot's
ceiling, and each better drop raised it a few points [S]. Gypsum, gathered
in daily-capped types and turned into orbs and casts, gave a guaranteed bump
for one slot type [S]. Elite chests in elite zones reset once a day and were
the best open-world source [S]. From Jan 2022 the cap moved from 600 to 625
with umbral shards earned in mutated expeditions [S].

**What is exciting.**
- **Every drop is a tiny ding.** A chest or boss can nudge a slot by a few
  points, and the number on the tooltip goes up. It is the same
  variable-interval reward as a trade skill [M].
- **The elite chest run.** At reset, groups of 20-50 swept a zone along a
  fixed route [S]. Myrkgard was "arguably the most famous, or perhaps
  infamous" run, with a chance at 580 GS items, legendary weapons and top-tier
  materials, and Amazon even disabled some chest spawns there "due to higher
  than intended drops" [S]. The excitement was social and dense: many chests,
  many rolls, in ten minutes.
- **The first 600 craft.** It needed skill 200 in the trade, three crafting
  trophies in your house, crafting food, a crafting outfit and a town buff
  [S]. With all of that the screen showed a range of 595-600, and some
  patterns guaranteed 600 [S]. A 600 tier-5 item was the only kind that could
  open the last perk slot and become legendary [S]. The preparation made the
  roll matter.

**What is a chore.**
- **Thirteen-odd slots climbed one at a time** [M], gated by dailies.
- **Expertise made bought and crafted gear weaker.** The Dec 2021 proposal
  scaled any item above your expertise down to your expertise: in Amazon's
  example a 550 hammer at expertise 520 behaved like 520 [S]. Crafters said
  it made crafting "worthless", since a maxed crafter could no longer let
  players skip the grind [S]. Players said they would need "dozens of hours"
  to keep using gear they already owned [S].
- **Perk lottery on the craft.** A forum calculation put the odds of a
  specific three-perk legendary at about 1 in 2,280, even after spending a
  timeless shard to lock the weapon perk [S]. Threads called crafting "a
  scam" and a "bigger lottery" after new perks were added in March 2022 [S].
- **Nothing to do with it.** GameSpot's 2021 review: "little to motivate
  players to grind their gear score to the max of 600" [S].

**How often [M].** Small ticks many times an evening; a real upgrade weekly;
a legendary craft with the perks you wanted, every few weeks if ever.

### Stage D: endgame (2022-2025)

**Expedition and mutation farming.** Mutations (Jan 2022) added ten
difficulty levels to the endgame expeditions and paid umbral shards [S]. Their
own gear had "decent stats, but static perks that ultimately make them less
than desirable" [S]. In a mutation with 35% luck, one player counted about
one named item per 30 gear drops, from a pool of five [S]. A 2025 guide sums
mutation rewards up as "hit or miss, with most not so great", though they
were the main source of dark matter and many artifacts [S].

**Named and best-in-slot hunting.** Named items are tied to specific bosses
or areas, so "unless you farm a specific named enemy or boss, you will never
see a legendary drop" [S]. One player quit after two days on one boss without
the drop [S]. Players planned on the database: find the named item whose two
fixed perks you want, then fill the rest [S].

**Perk-rerolling.** Pre-2024 tools: craft mods guaranteed one perk; timeless
shards locked one [S]. From Oct 2023, a gypsum kiln could upgrade a named
item to 700 and let you **choose** its third perk [S]. Chromatic seals
(one per day; sources quote about 20,000 faction tokens plus 2,000-5,000
gold) let players craft the named piece they wanted [S]; one player called that "a great
change", and another complained about "waiting three days and paying 15k"
for one item [S]. Nighthaven (Oct 2025) replaced most of this with **perk
charms**: gear drops with typed perk slots (mutations up to four, open world
three), and charms can be swapped "for free, at anytime", the old one being
destroyed [S]. Attributes were removed from gear at the same time [S].

**Crafting legendary items.** Still the premium route for some slots, and
still prepared for (trophies, food, outfit). From Aeternum the only 725 gear
with chosen perks you could craft was one raid set, according to one player
[S].

**Trading.** The trading post is the endgame's real loot table for many
players: a 2,000-hour reviewer says a competitive endgame item "often
requires well over 100,000 gold" [S]. But from Aeternum, gear at 695+ was
"about 90%" bind-on-pickup by that reviewer's count [S], so the best drops
could not be sold.

**Artifacts.** From Oct 2023, each artifact has a unique perk that changes
how a weapon or armour piece plays (Amazon's example: a light helm that adds
damage once your mana runs low), plus a quest line to unlock its other perks
[S]. Eight more came with Aeternum's first season [S]. Players liked what they
did and disliked the gating: quests in a fixed order, "you always have to
waste 500 dark matter" to upgrade [S].

**Aeternum's chase (Oct 2024 on).** The cap rose to 725 [S]. The best gear
sat behind a 10-player raid (Hive of Gorgons, with three raid-only perks) or
a free-for-all PvP zone, and mmorpg.com called the endgame "at odds with
itself, especially if you're a solo player" [S]. Other routes were the "Well
of Fortune", random chests bought with a seasonal currency (one player
counted 2,500 doubloons for a 725 jewel, whose perks were random) [S], and
crafted caches with random rolls [S]. Players called it "same crap loot on
gs 700 and 725" [S].

**How often [M].** A drop that matters to *you* (the right named item with
the right perks, or a raid perk) took days to weeks. Mutations and chests
gave a roll every few minutes, but almost all of it was salvage.

### The journey in one table

| Stage | What carries the excitement | Main chore | Exciting moments, roughly [M] |
|---|---|---|---|
| 1-25 | Trade dings, first named item (Amrine), first schematic | Bag weight, salvaging greens, off-build quest gear | Dings every few minutes; a "named" a few times |
| 25-60 | Your own crafts, rare procs, first big sale | Sub-1% procs, 2021 luck bug | A good craft per session; a proc every few hours |
| 60, 2021-23 | Each drop a small expertise tick; chest runs; the prepared 600 roll | 13 slots one at a time, dailies, perk lottery (1 in 2,280) | Ticks many times a night; a real upgrade weekly |
| Endgame | Named/BiS hunt, artifacts, perk choice, big trades | Long odds, daily locks, BoP, raid-or-die | A personally meaningful drop every few days to weeks |

The curve of *felt* excitement is not the curve of *loot quality*. It peaks
twice: in the mid levels, when crafting and the trading post open up, and at
60 when chests and ticks are dense. It then falls off as the odds lengthen
and the rewards move behind group content.

---

## 2. Moments players remember

I could not open forum threads or reviews directly, so this is a list of the
moment types that recur in the summaries, with the evidence for each.

1. **The craft that came out right.** The "first sateen hat with the right
   stats" (PCGamesN) [S]; the 600 craft from a 595-600 range after buying
   trophies and food [S]. Remembered because the player prepared and the
   screen showed what was at stake.
2. **The schematic that someone else wanted.** The Hope storage chest
   schematic: a random supply-chest drop, found even in a starter zone,
   sold for "lucrative amounts" [S]. A low player holding a high player's
   wish.
3. **The trophy or rare that paid for a week.** A chest-farm video promised
   "trophies that sell for thousands", and commenters reported 2-3k a piece
   depending on the server [S].
4. **The rare gather proc, and its absence.** Fae iron and petrified wood are
   famous more for the droughts (thousands of veins, nothing) than for the
   drops [S]. The relief after the Feb 2022 fix is the moment people talk
   about [S].
5. **The chest run at reset.** Twenty to fifty players on a route, Myrkgard
   chests too generous for Amazon's taste [S]. Remembered as an event, not as
   a particular item.
6. **The named drop after a drought, or the artifact from a mutation.** For
   example the Blooddrinker ring, an artifact with a chance to drop from the
   boss of mutated Starstone Barrows [S]. One player recorded a two-day
   drought on a boss and quit [S]; the ones who got it remember the run.
7. **The perfect three-perk roll.** At roughly 1 in 2,280 [S], it is a story
   when it happens, which is the point and the problem.
8. **Gear that is too expensive to buy.** "Well over 100,000 gold" for a
   competitive item [S]. Selling one is a fortune; owning one is a status
   symbol.

The same pattern shows outside New World. Destiny's community has a holiday,
"Gjallarhorn Day", for 14 Aug 2015, the day the vendor Xur finally sold the
rocket launcher everyone had been failing to get for a year; a website had
existed only to answer "Is Xur selling the Gjallarhorn?" [S].

**What the remembered moments share.** (a) The item was known and wanted
before it arrived. (b) Getting it took effort or preparation, or followed a
drought. (c) It changed what the player could do, or could be sold or shown.
(d) Something on screen made the stakes visible: a range, a price, a name.
Random greens and blues, the bulk of the loot by count, appear in none of
them.

---

## 3. Pain points and what Amazon did

| Pain | What players hit | Amazon's response | What it did to the feeling |
|---|---|---|---|
| **Perk RNG on long grinds** | Days of gathering for one craft that rolls the wrong perks; 1 in 2,280 for a set of three [S]; "lottery", "scam" [S] | Craft mods (one perk), timeless shards (lock a perk) [S] → kiln upgrade lets you choose the third perk of a named item (Oct 2023) [S] → chromatic seals to craft named gear (time-gated) [S] → perk charms, swappable for free (Oct 2025) [S] | Each step turned a lottery into a plan, which players asked for. But a jackpot needs a lottery: once any perk can be slotted at will, a drop's perks stop mattering, and the drop becomes mostly a GS and slot-count number. One player's blog described Nighthaven gearing as mostly AFK farming [S]; a columnist said the revamp "saved" the endgame [S]. |
| **Bind-on-pickup** | Named and high-GS gear could not be traded; one reviewer counts ~90% of 695+ gear as BoP [S]; requests for a 30-60 minute window to give a drop to a group member [S] | Mostly kept. Chromatic seals and kiln upgrades made BoP named gear *craftable* rather than tradable [S] | Protects "I earned this", kills "I can sell my luck". In a game sold on its trading post, the best drops sat outside the economy. |
| **Expertise / watermark** | A per-slot ceiling that rose a few points per drop; the Dec 2021 plan scaled bought and crafted gear down to it; "crafting worthless" [S] | Walked back within days: crafted, quest and faction-shop gear exempted, others scaled to a midpoint instead [S]; named items at 590+ later exempted [S]; removed in Rise of the Angry Earth (Oct 2023), replaced by "gear score drops based on creature level" and a GS floor on elite chests [S] | The backlash was about *ownership*: something you had bought or made was quietly reduced. Removal made the rule simple ("harder content, better gear") and let new players catch up, but it took away the constant small tick that made every drop worth checking. |
| **Gear-score inflation** | Cap 600 (2021) → 625 (Jan 2022) → 700 (Oct 2023) → 725 (Oct 2024) → 800 (Oct 2025) [S]. In the last step, gear under 700 could not be upgraded [S]. "The 710 gear score items from The Well are pretty much just useless" [S] | Upgrade paths each time: umbral shards (removed 2023) [S], kiln and dark matter [S], Goldcursed Coconuts for artifacts in Season 7 [S], an umbral currency for any gear of 700+ in Season 10 [S] | Each raise reset the chase and wiped the value of last year's best-in-slot and its trading-post price. Good for returning players, bad for the people who kept the market going. |
| **Dead loot** | Weapons dropped with attribute perks that did not suit their scaling, armour with perks for weapons you do not use; "basically garbage that you will just salvage" [S] | **Loot biasing** (explained Jan 2024): drops weighted toward your equipped armour weight, attributes and weapon types; non-relevant attribute perks "drastically reduced" [S]. Named items and artifacts excluded so they stay farmable [S] | Fewer feel-bad drops. A German outlet's headline put it as New World "cheats on loot, so you feel better" [S]; a commenter there said buying gear from players already made loot feel worthless [S]. Biasing fixed the *fit*; it could not fix the *surprise*. |
| **Salvage spam** | Most drops are salvaged for coin and repair parts; mass salvage by rarity [S]; Nighthaven guide: salvage "anything that doesn't have a gem slot" [S] | Faster salvage tools [S]; loot biasing to reduce junk [S] | Every drop costs a second of attention and gives nothing. Shamus Young on Borderlands: a dud is better than having to pick up and sell garbage [S]. |
| **2022 loot and luck fixes** | High luck made rare procs nearly impossible (2021) [S]; expedition loot thin [S] | 1.3 (Jan 2022): mutations, umbral shards, "higher rarity loot more frequently with improved perk spread" from expeditions [S]. 1.3.2 (Feb 2022): the high-luck bug fixed, plus a PvP-flag bonus of +10% luck and +30% gathering luck (figures vary by source) [S]. A 2022 Luck FAQ: luck raises the chance of a better *bucket*, not of a better item inside it; global loot is "luck safe" so luck cannot scale wildly; gathering is not [S] | Restored the rare-proc jackpot and made luck a visible knob you can turn with food, gear and risk. It also taught players that the system had been broken while they ground it, which hurt trust. |
| **Aeternum's changes (Oct 2024 to Oct 2025)** | 725 behind a raid or PvP zone [S]; "raid or die" [S]; Season 7 "doubles down on punishing solo and casual players" [S]; random chests and caches [S] | Season 10 Nighthaven: level 70, GS 800, perk charms, attributes removed, more slots on mutation gear [S]; named-set drop chance from named mobs cut from 50% to 25% while raising other sources [S] | Build freedom went up a lot. But the endgame loot remained "a confusing, random-reward endgame" for returning players, in one blogger's words [S], and content ended with this season [S]. |

**The arc in one sentence.** New World started with too much random and too
little control, fixed it by adding control step by step, and ended with lots
of control and little suspense. Neither end is what players remember. The
moments in section 2 sit in the middle: a known target, a visible range, a
real chance of failure, and preparation that tilts the odds.

---

## 4. What makes loot exciting, across games

### 4.1 Anticipation before the reveal

- **The signal comes before the item.** In Hearthstone an orange glow shows
  under a face-down card before you flip it [S]. A card-pack UX write-up by
  N3TWORK's UX director names this the first emotional peak: "users will get
  really excited when they realize there is a super-rare card in the deck. In
  some cases, this is even more exciting than seeing the actual card" [S].
  The same piece: reveal commons quickly, build drama only for rares, and
  make a rare win "obvious" [S]. Blizzard's art director says each pack
  animation is storyboarded so "it hits all the beats we want it to hit" [S].
- **The ceremony is the reward.** Vampire Survivors' creator, Luca Galante,
  says he liked a slot-machine jingle for a treasure chest but felt the
  animation "really didn't live up to" it, so he built "a super rewarding and
  over-the-top treasure chest animation that matches a catchy little sound"
  [S]. He also says his gambling-industry job was engineering, not game
  design [S].
- **Signals can be tiered and interactive.** Destiny's engrams drop
  coloured by rarity and are decoded later [M], and Clash Royale's newer
  "lucky chests" bump their rarity on each tap before the last tap reveals
  the prize [S]. Both stretch the anticipation over a short ritual.
- **A broken signal hurts more than none.** At Destiny's launch a purple
  engram was "much more likely" to turn into a worthless green or blue [S].
  The signal promised a tier and the reveal took it back.
- **The near miss.** In the fMRI study by Clark and others (2009), near
  misses on a slot-like task fired the same reward circuits as wins, were
  rated *less* pleasant than a plain miss, and still raised the wish to play
  on, more so when the player had controlled the spin [S]. That is a strong
  tool and an ethically loaded one: John Hopson, who brought reward schedules
  to game design in 2001, argues designers are responsible for the
  contingencies they build [S]. For us: a near miss is fair when it tells the
  truth ("one more silver for the sling", "the vein glinted: Mining 3 opens
  it") and manipulative when it is faked.

### 4.2 Rarity tiers and colours

- The colour ladder is a Diablo convention that every later loot game reused
  [S]. Players read it before they read text.
- **The top tier must be truly rare.** In Borderlands "you might play for a
  few game sessions without ever seeing a single orange" [S]. Gearbox's
  example table for one enemy: 10% for a purple, 1% for a legendary [S]. Gearbox later tested and then tripled legendary rates in Borderlands 2
  (2015) [S]: rare, but not so rare that players stop believing.
- **Brotato** has four tiers (tier 4, legendary, shown in red) [S]. Each has
  a minimum wave before it can appear; the average tier rises as waves pass;
  luck raises it further up to about 290 luck [S]. Elites from Danger 2 and
  wave-20 bosses drop a legendary crate that always holds a tier-4 item [S].
  Crate chance is divided by (1 + crates already dropped this wave), so luck
  cannot flood a wave [S]. The tier ladder *is* the power curve: by mid-run
  the shop starts showing purples and reds, and that is when the build can
  "meet the curve".
- Mosqueira's rule for Diablo III's fix: "drop fewer, drop better, make
  legendaries legendary, cheat" [S].

### 4.3 Build-enabling uniques versus stat bumps

- Borderlands 3's lead weapon designer, Kevin Duke: "there's a point where
  simply just upping the numbers isn't that exciting" [S].
- **The items players chase change rules.** Diablo II's Zod rune is one of
  the rarest drops in the game, and its main use is the Breath of the Dying
  runeword, whose poison nova on kill changes how a character clears [S].
  Vampire Survivors' evolutions need a maxed weapon, a matching passive and a
  chest from an elite or boss, and they turn knives or crosses into something
  that looks and plays differently; NME calls them "one of the most
  meaningful progression systems" and the game an "excellent power fantasy"
  [S]. New World's artifacts are the same idea, which is why players liked
  them despite the gates [S].
- **When top loot is a stat bag, players call it boring.** Diablo IV's
  launch headlines: "They've made looting boring", "underwhelming loot", "too
  much junk in the loot pool", and "legendaries are really only good for
  their affixes" [S]. Season 4, "Loot Reborn" (14 May 2024), cut niche
  affixes, added tempering and masterworking, and made gear more powerful;
  fans called it the "best season start so far" [S].
- Our own diagnosis said the same about Scrip: builds are "made of small
  numbers, not new behaviours, so few runs have a moment where the build
  clicks" (`docs/design/explore-run.md`, H1).

### 4.4 Target farming versus random surprise

- **Pure random fails.** Diablo III's launch drops were so stingy that
  everyone used the auction house; Mosqueira called it "a great experiment
  that ended up short-circuiting the core reward loop", and argued that
  killing monsters is "the most rewarding, the most satisfying, the most
  compelling way of getting your hands on those items" [S]. Blizzard had
  expected about 10% of players to use it [S].
- **Smart Loot** (Loot 2.0, early 2014 [M]): about 85% of legendaries roll
  for your class [S]. New World's loot biasing (2024) is the same idea [S].
- **Pure deterministic fails too.** Destiny 2 launched with fixed perks
  "for more precise control", at the cost, Destructoid noted, that players
  were less likely to feel they "hit the jackpot" [S]; Kotaku had argued the
  "flickering hope of getting a god roll" kept players for three years [S].
  Random rolls came back [S]. In Path of Exile, Chris Wilson's 2021 Harvest
  manifesto worried about "how deterministic some Harvest Crafts are and how
  easily players can craft near-perfect items" [S]. New World's perk charms
  are the deterministic end of the same swing.
- **What works is a known target with unknown timing, and skill that tilts
  the odds.** Monster Hunter shows the list of parts a monster can give, and
  each broken part is a separate roll: a top hunt that breaks everything and
  captures has about seven chances at a Rathalos ruby, at single-digit
  percentages per break [S]. Players still joke about a "desire sensor" that
  withholds what you want [S], and a melding vendor offers a slow,
  guaranteed route as a floor [S]. New World's named lists and chromatic
  seals had the same structure.

### 4.5 Crafting as loot

- **Path of Exile** has no gold: its currency items are crafting tools, so
  every currency drop is money and a chance to roll an item [S]. Wilson's
  2019 GDC talk, "Designing Path of Exile to Be Played Forever", puts the
  economy at the centre of item design [S]. A Mirror of Kalandra drop has its
  own sound, the same as the most famous unique [S]; one player calls the
  Divine Orb's drop sound "euphoria" even though they never trade [S].
- **Monster Hunter**: the loop is "hunting a monster, carving the parts,
  going back to the hub world, using those parts to craft new gear ... and
  then you go out and fight bigger, badder monsters" (producer Ryozo
  Tsujimoto) [S]. The drop *is* a recipe ingredient with a face on it.
- **Last Epoch**: uniques drop with a "legendary potential" number that
  says how many affixes can be fused onto them, so a drop is a promise of a
  future craft [S].
- **New World**: the craft roll with a shown range (595-600) is the game's
  best reveal [S]. Its weakness was that *materials* were rarely a reveal:
  the drops were mostly commodities headed for a known recipe, much like our
  third prototype.

### 4.6 Droughts and bad-luck protection

- A Game Developer article on loot and emotion: a designer who balances only
  the average drop rate "effectively neglects seventy-five percent of players
  on any single drop" [S].
- Hearthstone guarantees a legendary within a new set's first ten packs [S].
  Old School RuneScape uses drop rates that rise as you approach a threshold
  [S]. Monster Hunter has the melder [S]. New World had almost nothing of
  this kind for named items, and the fae-iron drought became folklore [S].

### 4.7 Loot you can show off or sell

- Gjallarhorn Day [S], the Mirror of Kalandra worth "10s of thousands of
  chaos orbs" [S], New World's 100k+ gold items [S]. Value in a market, or a
  community's shared memory, multiplies the thrill of the drop.
- A Massively OP columnist's fix for Aeternum's endgame was "chase items":
  rare, highly desirable drops that keep players running content after they
  need nothing else, mostly cosmetic to avoid power creep [S].
- Bind-on-pickup and transmog tokens that are "not tradable" [S] cut this
  link on purpose.

### 4.8 The games side by side

| | Reveal | Tiers | Top tier changes play? | Target vs random | Crafting hybrid | Show / sell |
|---|---|---|---|---|---|---|
| **New World** | Tooltip after pickup; crafting screen shows range [S]/[M] | 5 colours + named + artifact | Artifacts yes; most named, perks only | Named lists by boss; later perk choice | Craft with preparation, range shown | Trading post; BoP at the top |
| **Diablo II** | Coloured name on the ground, rune sounds [M] | 4-5 + runes | Runewords, uniques | Random, boss runs | Cube recipes, runewords | Player trading [M] |
| **Diablo III (RoS)** | Orange beam and sound [M] | 5 + sets | Legendary powers define builds [M] | Smart Loot 85% [S], Kadala, Cube | Cube | None after AH removed [S] |
| **Diablo IV** | Beam and sound [M] | 5 + greater affixes | After S4, more so [S] | Boss-targeted uniques [M] | Tempering, masterworking [S] | Limited trade [M] |
| **Path of Exile** | Filter-chosen colours and sounds [S] | 4 + currency | Uniques, crafted rares | Mostly random, filter-curated | Currency *is* crafting [S] | Barter market [S] |
| **Borderlands** | Coloured beams on the ground [M] | 5 | Manufacturer quirks, legendaries | Random, boss farming | None to speak of | Show off, little trade |
| **Destiny** | Engram colour, decoded later [M] | 5 | Exotics change play | Activity pools, vendors | Weapon crafting later [M] | Show off only |
| **Monster Hunter** | Reward screen after the hunt [M] | Rarity per part | Weapon types and skills | Part list known, breaks add rolls [S] | Parts *are* the recipe [S] | None |
| **Vampire Survivors** | Over-the-top chest with jingle [S] | Chests of 1/3/5 items [M] | Evolutions [S] | Random, conditions known | Evolution = recipe found in a chest | None |
| **Brotato** | Shop slots with tier colour; crates [S] | 4 [S] | Some items break rules [M] | Random shop, reroll for gold [S] | Weapons combine to tier up [M] | None |

---

## 5. Ten principles for a small 2D phone game

These are proposals. Scrip today: 12 waves of about 47 seconds each (about
13 minutes a run), weapons that fire on their own, benches between waves, and
a town where things last (`docs/design/explore-run.md`, `round2/decisions.md`).
The aim is loot that feels like New World's good moments and like Brotato's
"meeting the curve", not like a shopping list.

**1. Drop little, and make every visible drop change something.** Materials
should arrive as a background stream that only moves a counter (no ceremony,
no pickup chore). Everything that gets its own moment on screen must change
play or a decision within about ten seconds: a pick, a new behaviour, an
unlocked bench craft. Rough budget per 13-minute run: 8-12 small finds, 2-3
rare ones, at most 1 top-tier one. ("Drop fewer, drop better" [S].)

**2. Four tiers, fixed colours, and a signal before the reveal.** White,
blue, purple, orange (or red, as in Brotato). The colour shows on the drop
while it flies to you, about half a second before you learn what it is (the
Hearthstone glow, the engram). Commons get no ceremony, so they never slow
the wave. A purple gets a chime and a short glow. An orange gets about 0.4 s
of hit-stop, a unique sound, a phone vibration and its name on screen. The
signal must never lie: an orange glow always holds an orange item.

**3. The top tiers break rules, the bottom tiers add numbers.** Every purple
and orange should be a new behaviour you can see in the next ten seconds:
pierce turns into chaining, kills while moving leave fire, the pick hits
twice on ore. Stats belong to whites and blues. If a top drop's effect cannot
be seen on screen, it is the wrong item for that tier.

**4. Named things with a known list and an unknown timing.** Each elite,
boss and rare vein has three or four named drops, shown in a bestiary as
"?/4 found" once you have met it. You know what you hunt and where to hunt
it; you do not know when it lands. Choosing a biome or a target elite is the
target farming. Breaking an elite's armour or killing it in time adds a roll,
as part breaks do in Monster Hunter [S], so skill tilts the odds.

**5. Schedule the rhythm and protect against droughts.** Small finds about
every 30-60 seconds; a rare at each elite (waves 6 and 9) and at a vein; the
boss rolls an orange about one run in three. A pity counter guarantees an
orange by the third or fourth run and is shown on screen ("the vein is
stirring"), so a drought builds anticipation instead of folklore. Never let
gear, luck or skill make the jackpot *harder* (New World's 2021 luck bug
[S]).

**6. Let the build meet the curve inside the run.** Brotato's moment comes
when tiers and synergies stack mid-run [S]; Vampire Survivors' when a
recipe found in a chest evolves a weapon [S]. So rare drops should combine
in the run: two parts of a set, or a weapon plus the right rare, make an
evolution at the next bench, aimed at waves 7-9. Loot that only pays at home
after the run (the third prototype) cannot make that moment.

**7. Make the craft a second reveal, with the range shown.** The bench shows
the possible outcome and how each material moves it, then rolls (round 2's
"forge roll"). Let one rare slot add a perk you *choose* from a short list,
as the kiln and perk charms did [S], and let quality stay random inside the
shown range, with a small chance (about 1 in 20) of a named masterwork above
it. Choice where it hurts to lose, chance where it is fun to win. A schematic
is itself a drop with a tier and should open a new kind of item, never just
a stronger copy.

**8. No junk, and no wrong-build drops.** Anything you do not want turns
into currency or material the moment it lands, with a running tally, never a
salvage screen. Bias drops toward your character and weapons as Smart Loot
(85% [S]) and New World's biasing [S] did, but keep a little off-build loot,
since it can tempt a new build. A dud is better than garbage [S].

**9. Make loot something you can show or sell.** Every orange and every
named item gets a place on a trophy shelf in town, with the run, wave and
date it was found. Spare rares and rare schematics sell for coin that buys
something real (a station tier, a house piece, a scarce reagent). A small
simulated market (or friends' towns) gives the "someone wanted this" moment
of the Hope chest schematic [S]. Bind only the very top, if anything.

**10. Do not inflate the past away.** When a new tier opens, old finds keep a
job: an upgrade path, a reagent, furniture, a permanent trophy bonus. New
World's five cap raises wiped last year's best gear and its price each time
[S]. On a phone the player measures progress in weeks; a town that only ever
grows (round 2 decisions: "the town grows stronger over years; each run can
become wilder") is the place where loot lasts.

### How to make the reveal land on a phone

- **Small screen:** the colour and the sound do the work. Use a short beam
  or ring on the drop, not a text pop-up in the middle of a wave.
- **Do not stop the action for anything below purple.** For an orange, stop
  for under half a second, then let play run on and give the full card at
  the next bench (one tap to read).
- **Haptics by tier:** none, a tick, a double tick, a long buzz.
- **A recap at the bench** shows what dropped this wave, in order of rarity,
  revealed one by one, commons fast and rares slow (the card-pack lesson
  [S]). This moves most of the reading out of the fight.
- **Name every rare.** "Silver ore" is a commodity; "Kestrel's Eye, from the
  rotwood stag" is a story.

---

## 6. Why the third prototype felt like a shopping list

Read against the principles above, using the numbers in `src/sim/core.ts`
(`LOOT_TABLE`) and `src/client/loot/content.ts`:

| Principle | `?proto=loot` | What broke |
|---|---|---|
| 1. Each drop changes something | A mite drops a raw 1.2% of the time, a gnat 0.6%; bigger enemies drop a rare 0.3-5% of the time, mites and gnats never | Drops were rare *and* meaningless one by one: each moved a counter |
| 2. Tiers and a signal | Two material tiers, no colour ladder; a schematic briefly stops the picture | Only the schematic had a reveal; the rest had no anticipation |
| 3. Rule-breakers at the top | The schematics make a tier-3 hatchet, a tier-4 sling, a jerkin (+3 armour, +3 health) | The top reward was a stat bump |
| 4. Known list, unknown timing | The HUD strip showed "Iron 7/10 for a Steel hatchet" | The target was known *and* the drops were predictable, so no surprise was left |
| 5. Rhythm and pity | Elites drop a schematic 35% of the time, the boss 70% | Fine for schematics; nothing else had a schedule |
| 6. Meet the curve in the run | Everything is spent at home after the run; made things last 3 runs | No in-run payoff, so nothing to "roll from" |
| 7. Craft as a reveal | Fixed recipe, known output | The craft was a checkout, not a roll |
| 9. Show or sell | Nothing to sell, nowhere to show | No outside value |

The prototype tested New World's chain (raw → refined → schematic → item)
without the parts of New World that make the chain exciting: the rare proc,
the named drop, the shown range on the craft, the sale. It kept the
bookkeeping and dropped the suspense.

A test that would follow from this (a suggestion for a test card, not one):
keep the run as it is; give each elite a named drop list of three
rule-breaking items with a pity counter; give the drop a coloured flight and
an orange hit-stop; let the item take effect immediately in the run; show
the shelf in town afterwards. Stop if, after three runs, the owner cannot
name a drop they were glad of.

---

## Sources (search results consulted 2026-11-12)

Only result summaries were seen; pages could not be opened.

**New World: stages, systems, fixes**
- Named-item drops, expertise exemption at 590+: https://forums.newworld.com/t/named-item-drops-in-new-update/755517
- Legendary drops tied to named bosses (2021 thread): https://steamcommunity.com/app/1063730/discussions/0/3163210610842545533
- Expertise proposal and backlash: https://www.gamespot.com/articles/new-world-players-are-up-in-arms-about-the-games-newly-proposed-expertise-system/1100-6498587/ , https://www.thegamer.com/new-world-watermark-update-crafting-worthless/ , https://gamespot.com/articles/amazon-walks-back-new-world-expertise-system-following-community-backlash/1100-6498697/ , https://www.mmobomb.com/news/new-world-adjusts-progression-changes-won-t-nerf-players-existing-gear , https://massivelyop.com/2021/12/03/new-world-bans-botters-begins-testing-winter-event-plans-unpopular-endgame-gear-system/
- Gypsum, 600-625, chest runs: https://www.studioloot.com/new-world/articles/how-gear-score-and-expertise-works-in-new-world/ , https://newworldfans.com/articles/how-gear-score-and-expertise-works-in-new-world , https://itemlevel.net/new-world-how-to-max-out-great-sword-600-625-brimstone-sands/ , https://steamcommunity.com/app/1063730/discussions/0/3203743641836742106
- Patch 1.3 (Jan 2022), mutations, umbral shards: https://vulkk.com/2022/01/25/new-world-update-1-3-mutated-expeditions-changes-overview/ , https://vulkk.com/2022/01/07/new-world-1-3-expedition-mutators-and-new-gear-score-cap-now-on-ptr/ , https://www.newworld.com/en-us/news/articles/january-expedition-mutator-update
- Patch notes incl. 1.3.2 luck fix and PvP luck: https://newworld.wiki.fextralife.com/Patch_Notes
- Luck FAQ (2022) and luck guides: https://devtrackers.gg/new-world/p/7f365209-dev-blog-luck-faq , https://www.tamtoucan.com/public/new-world-loot-luck , https://www.studioloot.com/new-world/articles/how-luck-works-in-new-world/
- Fae iron and petrified wood droughts: https://forums.newworld.com/t/fae-iron-petrified-wood-drop-rates-make-0-sense/288328/5 , https://steamcommunity.com/app/1063730/discussions/0/2961670721748147644/ , https://www.pcgamesn.com/new-world/iron-fae-locations , https://diamondlobby.com/new-world/how-to-find-fae-iron-in-new-world/
- 600 crafting: https://ghost.nwdb.info/how-to-craft-600-gear-score-items/ , https://www.aoeah.com/news/1655--new-world-crafting-guide-2023-best-way-to-craft-600-gear-score--increase-crafting-odds
- Perk odds and "crafting is a scam": https://forums.newworld.com/t/what-are-the-odds-of-getting-the-3-perks-i-want/710181?page=2 , https://forums.newworld.com/t/crafting-is-a-scam/696565?page=15 , https://forums.newworld.com/t/crafting-will-have-control-on-perks-and-quality/715837
- Amrine Excavation: https://www.icy-veins.com/new-world/amrine-excavation-expedition-guide , https://gamerjournalist.com/new-world-amrine-tuning-orb/
- Schematics and trophies: https://screenrant.com/new-world-hope-storage-chest-crafting-guide/ , https://newworld.video.tm/new-world-chest-farm-route-get-trophies-that-sell-for-thousands , https://steamcommunity.com/app/1063730/discussions/0/3201493834347105119
- Salvage: https://www.studioloot.com/new-world/articles/how-to-salvage-gear-in-new-world/ , https://diamondlobby.com/new-world/how-to-get-repair-parts-in-new-world/ , https://newworldnews.org/nighthaven-survival-guide/
- Myrkgard chest runs: https://zerowastesonoma.org/blog/new-world-cast-chest-runs , https://gamesfuze.com/guides/best-season-10-chest-run-to-gear-up-fast-in-new-world-aeternum/
- Rise of the Angry Earth (expertise and shards removed, 700, chest floor, artifacts): https://www.gamespot.com/articles/new-worlds-first-paid-expansion-adds-a-feature-fans-have-requested-for-years/1100-6517280/ , https://primagames.com/tips/new-world-rise-of-the-angry-earth-full-patch-notes-listed , https://www.newworld.com/en-us/game/releases/rise-of-the-angry-earth , https://mmos.com/news/new-world-season-3-balance-changes , https://newworld.com/en-gb/news/articles/behind-the-scenes-artifacts , https://mein-mmo.de/en/new-world-guide-to-dark-matter-how-to-get-it-and-what-you-can-do-with-it,1047206
- Loot biasing: https://www.newworld.com/en-us/news/articles/loot-biasing-deep-dive , https://www.mmorpg.com/news/how-new-worlds-loot-biasing-system-is-tailoring-loot-drops-better-and-reducing-bad-feeling-scenarios-2000130252 , https://massivelyop.com/2024/01/27/new-worlds-loot-biasing-should-reduce-bad-feelings-over-rng/ , https://mein-mmo.de/en/new-world-mmorpg-by-amazon-on-steam-cheats-on-loot-so-you-feel-better,1084103/ , https://mein-mmo.de/en/how-does-loot-actually-work-in-new-world-a-developer-explains-it-in-detail,734725/
- Named upgrades, kiln, chromatic seals: https://www.icy-veins.com/new-world/named-item-guide , https://primagames.com/tips/how-to-get-chromatic-seal-in-new-world , https://steamcommunity.com/app/1063730/discussions/0/3959288052798442437
- Bind-on-pickup: https://steamcommunity.com/app/1063730/discussions/0/4477133359558765938/ , https://forums.newworld.com/t/tradable-bind-on-pickup-items/656989 , https://steamcommunity.com/id/RandomCoderZ/reviews
- Aeternum and its columns: https://gamingtrend.com/reviews/new-world-aeternum-review-a-welcome-rebirth/ , https://www.mmorpg.com/reviews/new-world-aeternum-review-2000133364 , https://massivelyop.com/2024/10/16/vitae-aeternum-new-world-aeternum-leaves-veterans-casuals-and-pc-players-behind/ , https://massivelyop.com/2024/11/04/vitae-aeternum-how-to-fix-new-world-aeternums-endgame-starting-with-rewards-and-content-relevance/ , https://massivelyop.com/2024/11/05/vitae-aeternum-how-to-fix-new-world-aeternums-endgame-with-chase-items-and-solo-play/ , https://massivelyop.com/2025/01/28/vitae-aeternum-new-world-season-7-doubles-down-on-punishing-solo-and-casual-players/ , https://www.newworld.com/en-gb/news/articles/season-of-opportunity-artifacts , https://www.heartlessgamer.com/2025/01/new-world-pve.html , https://steamcommunity.com/app/1063730/discussions/0/4634861989070484282/ , https://steamcommunity.com/app/1063730/discussions/0/715609968122857498
- Nighthaven / Season 10: https://massivelyop.com/2025/10/29/vitae-aeternum-too-late-nighthavens-catacombs-and-perk-revamp-saved-new-worlds-endgame/ , https://www.heartlessgamer.com/2025/10/nighthaven-week-later.html , https://www.heartlessgamer.com/2025/10/nighthaven-day-2-aka-what-is-up-with.html , https://thexamxam.com/2025/10/new-world-aeternum-nighthaven-gearing-and-perk-charms-guide/ , https://www.newworld.com/en-us/news/articles/season-10-nighthaven-announcement , https://www.iggm.com/news/new-world-aeternum-season-10-equipment-system-changes-and-catch-up-guide
- Reviews: https://www.pcgamesn.com/new-world/review-pc , https://www.pcgamer.com/new-world-review/ , https://www.gamespot.com/reviews/new-world-review-faction-war-never-changes/1900-6417769/ , https://steamcommunity.com/app/1063730/reviews/
- Shutdown: https://www.gamespot.com/articles/amazons-big-mmo-that-started-strong-is-shutting-down/1100-6537436/ , https://www.icy-veins.com/new-world/news/aeternum-closes-its-doors/

**Other games and loot design**
- Diablo III Loot 2.0, Smart Loot, Mosqueira GDC 2015: https://www.purediablo.com/josh-mosqueira-diablo-3-presentation-gdc-2015 , https://www.pcgamesn.com/diablo-iii/diablo-3s-josh-mosqueria-on-launch-failures-mistakes-and-the-road-to-redemption , https://www.d3guides.de/en/news/loot-2-0-patch-2-0-itemization , https://www.diablowiki.net/Loot_2.0 , https://icy-veins.com/d3/how-to-farm-legendary-and-set-items-guide , https://gamesbeat.com/no-auction-house-no-problem-diablo-iii-reaper-of-souls-sales-surpass-2-7-million-in-first-week/
- Diablo IV launch and Loot Reborn: https://www.gamespot.com/articles/diablo-4-season-4-loot-overhaul-is-going-over-very-well-with-fans/1100-6523491/ , https://dotesports.com/diablo/news/diablo-4-players-agree-underwhelming-loot-system-desperately-needs-a-retune , https://mein-mmo.de/en/why-does-the-game-insist-on-being-so-boring-items-frustrate-players-in-diablo-4,1087697/
- Diablo II runes: https://www.icy-veins.com/d2/rune-finding-guide , https://diablo.fandom.com/wiki/Zod_Rune
- Path of Exile: https://www.classcentral.com/course/youtube-designing-path-of-exile-to-be-played-forever-158083 , https://www.mmorpg.com/news/path-of-exile-shares-plan-for-harvest-crafting-2000121290 , https://www.pathofexile.com/forum/view-thread/3070005 , https://pathofexilegems.com/path-of-exile-item-filter-scripts/ , https://steamcommunity.com/app/2694490/discussions/0/565867707171371285
- Borderlands: https://www.fandom.com/articles/borderlands-3-how-trusting-an-algorithm-accidentally-built-gearbox-an-empire , https://www.gearboxsoftware.com/?p=10260 , https://www.gamesradar.com/borderlands-2-and-pre-sequel-triple-legendary-drop-rates , https://www.shamusyoung.com/twentysidedtale/?p=15131 , https://www.shamusyoung.com/twentysidedtale/?p=38071
- Destiny: https://www.forbes.com/sites/insertcoin/2017/06/30/good-riddance-to-chasing-perfect-god-roll-legendary-weapons-in-destiny-2/ , https://www.destructoid.com/destiny-2-does-away-with-random-item-rolls/ , https://www.psychologyofgames.com/2014/10/the-psychology-of-destinys-loot-systems/ , https://mein-mmo.de/en/destiny-happy-gjallarhorn-day-a-year-ago-today-it-happened,104638/ , https://time.com/3999269/destiny-gjallarhorn-sale/
- Monster Hunter: http://www.nintendoworldreport.com/feature/42880/monster-hunter-generations-e3-interview , https://www.toomuchgaming.net/blog-news/2018/2/how-to-get-rathalos-ruby-and-other-rare-rubies-in-monster-hunter-world , https://www.grindosaur.com/en/games/monster-hunter-rise/items/rathalos-ruby , https://steamcommunity.com/app/1446780/discussions/0/4772128648804088967
- Vampire Survivors: https://www.androidpolice.com/vampire-survivors-developer-interview/ , https://www.thexboxhub.com/the-treasure-chest-trick-behind-vampire-survivors/ , https://nme.com/reviews/game-reviews/vampire-survivors-review-3332668 , https://www.gamespot.com/articles/vampire-survivors-how-to-evolve-weapons/1100-6508815/
- Brotato: https://brotato.wiki.spellsandguns.com/Luck , https://brotato.wiki.spellsandguns.com/Crate , https://brotato.wiki.spellsandguns.com/Shop , https://shapes.inc/fandom/brotato/items , https://adrianhon.substack.com/p/brotato , https://choostgames.com/blog/brotato-build-guide/
- Last Epoch: https://afkgaming.com/gaming/general/last-epoch-what-is-legendary-potential-and-how-does-it-affect-crafting
- Reveal design: https://medium.com/n3twork/choreographed-emotion-6-steps-to-a-great-card-reveal-ux-a6e6bb8487dd , https://toucharcade.com/2017/04/04/designing-hearthstone-card-packs-animations-iterations-ungoro-and-more-with-art-director-ben-thompson/ , https://hearthstone.fandom.com/wiki/Card_pack , https://playhearthstone.com/en-gb/blog/20852959/ , https://royaletracker.gg/chest-simulator
- Randomness, pity, near misses, reward schedules: https://www.gamedeveloper.com/design/emotions-and-randomness-loot-drops , https://oldschool.runescape.wiki/w/Bad_luck_mitigation , https://pmc.ncbi.nlm.nih.gov/articles/PMC2658737 , https://www.sciencenews.org/article/gamblers-brains-almost-counts , https://gamedeveloper.com/design/10-years-of-behavioral-game-design-with-bungie-s-research-boss
