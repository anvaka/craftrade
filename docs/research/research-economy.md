# Research: crafting pipeline + async shared economy for a wave-arena roguelite

Date: 2026-11-11. Scope: design research only, no code.

## How to read this report (evidence labels)

- **[V]** = verified this session from web search results (the result text or summary supported the claim; URL given).
  Caveat: page fetching was blocked for the hosts I tried (raphkoster.com, shacknews.com are outside this session's
  network allowlist), so "verified" means "confirmed in search-result extracts", not "I read the full page".
  Numbers marked [V] should still be spot-checked before they go in a design doc that others rely on.
- **[V-weak]** = found this session, but only in forum posts, fan guides, or sources that conflict with each other.
- **[PK]** = my prior knowledge, not re-verified this session. Likely right, but treat as recall.
- **[INF]** = my own inference / design recommendation. All tuning numbers in section 6 are [INF] starting points, not precedents.

Not obtained: Koster's and Lost Garden's primary texts (hosts blocked), Lehdonvirta & Castronova's book text
(only a reader's summary), any GDC talk, Dome Keeper, Cult of the Lamb, and Dark and Darker's current rules.
Those parts lean on [PK] and are flagged.

---

## 1. Gather -> refine -> craft: what satisfies, what is a chore; New World's record

### What players loved in New World

- **The moment-to-moment feel of gathering.** Reviewers singled out audio and animation: a Twinfinite piece is titled
  around wanting to "mine rocks forever" because of the pickaxe sound, noting each vein type (iron, silver, gold,
  starmetal) sounds different; PCGamesN called gathering/refining/crafting the best parts of the game; MeinMMO noted
  the sound is functional (you can hear which ore someone nearby is mining); Prima said hearing other players chop and
  mine makes the world feel alive. [V]
  - https://twinfinite.net/2021/10/new-worlds-impressive-sound-design-makes-me-want-to-mine-rocks-forever/
  - https://www.pcgamesn.com/new-world/review-pc
  - https://mein-mmo.de/en/for-15-years-i-have-been-playing-mmorpgs-without-sound-but-that-changed-with-new-world,734284
  - https://primagames.com/featured/new-world-review
  - https://www.pcgamer.com/au/im-completely-hooked-on-new-worlds-fishing-and-crafting
- **Legible structure.** 5 gathering + 5 refining + 7 crafting skills (17), each refining skill paired with a gathering
  skill, stations with tiers 1-5 that gate recipes. [V]
  - https://newworld.wiki.fextralife.com/Trade+Skills , https://www.icy-veins.com/new-world/trade-skill-guides
  - https://newworld.fandom.com/wiki/Settlement
- **Opportunistic gathering** (you pass a node on the way to something else, and it is always worth a few seconds). [PK]

### What players hated

- **The treadmill shape.** AV Club described it as logging higher wood to refine higher timber to craft a higher axe
  "ad infinitum"; Digital Trends said the game succumbed to its emphasis on grind. [V]
  - https://www.avclub.com/new-world-mmo-review
- **RNG on the final step after a deterministic, expensive pipeline.** A forum thread "RNG Hell is Not an Endgame"
  compares crafting to a gacha; a widely shared player breakdown argued maxing Armoring is not worth it because after
  a week of gathering "you will be stuck with RNG that can easily result in useless stats or perks". [V]
  - https://forums.newworld.com/t/amazon-needs-to-know-rng-hell-is-not-an-endgame/644425?page=2
  - https://www.altchar.com/game-news/new-world-player-explains-why-armoring-painful-grind-is-not-worth-it-a3UjR7P1xYOY
- **Crafted gear undercut by drop systems.** The watermark/Expertise system meant crafted high-end gear was no better
  than drops, or was scaled down when equipped; TheGamer headlined it as making crafting "worthless"; GameSpot covered
  the backlash. Later, top-gear-score items gated behind a raid drew the same complaint. [V]
  - https://www.thegamer.com/new-world-watermark-update-crafting-worthless/
  - https://www.gamespot.com/articles/new-world-players-are-up-in-arms-about-the-games-newly-proposed-expertise-system/1100-6498587/
- **Skilling up produces vendor trash.** Levelling a trade skill meant mass-crafting items nobody wants, which floods
  the market and drives prices of low-tier outputs to the floor. [PK; consistent with the deflation reports below]
- **Economy incidents.** Autumn 2021: currency deflation to the point some servers bartered; Amazon stated (4 Nov 2021)
  all servers were creating more coin than was removed, while conceding the end-game was tighter. Then two gold/item
  dupe waves in November 2021 forced Amazon to disable all wealth transfer (trading post, player trade, company
  treasury) twice; over 1,200 players were banned. [V]
  - https://shacknews.com/article/127240/new-worlds-economy-is-currently-suffering-from-deflation
  - https://www.pcgamer.com/amp/amazon-says-new-worlds-economy-is-just-fine-thanks/
  - https://invenglobal.com/articles/15691/new-world-takes-its-entire-economy-offline-again
  - https://gamerant.com/new-world-wealth-transfer-disabled-mmo-economic-exploits-dissatisfaction/

### What Amazon changed

- **Linked all trading posts** into one server-wide market (late 2021) to keep item availability consistent; taxes still
  paid to the settlement you stand in. Critics said it killed regional arbitrage; supporters said populations were too
  low for local-only markets. [V] https://gamerant.com/new-world-trading-posts-economy-reduce-travel-expenses/ ,
  https://mein-mmo.de/en/new-world-makes-major-changes-to-the-trading-posts-could-destroy-the-economy,745948
- **Raised coin faucets** (expedition boss coin), lengthened housing tax period from 5 to 7 days. [V]
  https://vulkk.com/2021/12/02/new-world-update-1-1-1-and-current-issues-3-dev-blog-analysis/
- **Anti-RMT gates**: no player trading or currency transfer below level 10 or for accounts under 72 hours old; trading
  post locked behind an intro quest; Steam Family Sharing disabled. [V]
  https://gamespot.com/articles/new-world-patch-1-0-5-cracks-down-on-gold-sellers-addresses-gold-duplication-exploits/1100-6497722/ ,
  https://wccftech.com/new-world-devs-address-economy-changes-add-measures-to-fight-coin-sellers-including-turning-off-family-sharing-on-steam/
- **Exempted crafted items from Expertise scaling** after backlash. [V]
  https://www.altchar.com/game-news/new-world-expertise-changes-to-crafting-and-gear-nerfs-will-be-scaled-down-aUDfl0V9RD9j
- **Moved from RNG to targeted crafting.** Golden Scarabs let the crafter pick the attribute and two perks on eligible
  recipes (using Timeless Shards and craft mods); update 4.0.1 retuned the cost (3 scarabs + a matching Matrix, no
  Chromatic Seal); "Season of the Divide" accelerated crafting progression and simplified requirements; a 2023 overhaul
  was reported as guaranteed 3-perk bind-on-pickup crafts. [V]
  - https://gaming.tools/newworld/crafting-calculators/goldenscarab
  - https://newworld.com/en-us/news/articles/new-world-update-4-0-1
  - https://www.newworld.com/en-us/game/releases/season-of-the-divide
  - https://loltank.com/2023/05/17/new-world-crafting-overhaul-guaranteed-3-perk-bop-crafts-for-easier-bis-gearing-in-pvp-pve (fan summary)
- Context: Wikipedia reports Season 10 (Oct 2025) was announced as the last, with servers kept on "through 2026". [V]
  https://en.wikipedia.org/wiki/New_World_(video_game)

### Synthesis [INF]

Satisfying: tactile harvest feedback; visible conversion ratios (many raw -> few refined feels like compression of
effort into value); tier unlocks that change what you can do; opportunistic collection that rides on top of another
activity; other people visibly doing it.

Chore: travel and inventory weight; queue/timer watching; long linear tiers where tier N obsoletes tier N-1;
skill levelling by producing trash; the final step being a slot machine after deterministic effort; output that
the loot system makes irrelevant.

The direction of every New World fix was the same: one market instead of many, fewer steps, more determinism at the
top end, and protect the crafter's output from being trumped by drops. Start there rather than rediscovering it.

---

## 2. Async player markets for small games

### Market structures and fee precedents

| Game | Structure | Fees / limits | Label |
|---|---|---|---|
| Guild Wars 2 Trading Post | Global order book, buy and sell orders, first-listed-first-filled | 5% listing fee (non-refundable, charged even if cancelled) + 10% exchange fee on sale = 15% sink; no fee to place buy orders but coin is escrowed | [V] https://wiki.guildwars2.com/wiki/TP , https://help.guildwars2.com/hc/en-us/articles/222384087-Missing-Gold |
| OSRS Grand Exchange | Blind order matching with a guide price | Tax launched at 1% (Dec 2021), raised to 2% on 29 May 2025, capped at 5M coins per item; part of the tax funds an **item sink** that automatically buys chosen items and deletes them; per-item **buy limits every 4 hours** | [V] https://oldschool.runescape.wiki/w/Grand_Exchange_tax , https://oldschool.runescape.wiki/w/Update:Grand_Exchange_Tax_%26_Item_Sink , https://oldschool.runescape.wiki/w/RuneScape:Grand_Exchange_Market_Watch/Buying_limits |
| Albion Online | Local city order books | 2.5% setup fee per order; sales tax 4% with Premium, 8% (one guide says 6%) without | [V-weak, community guides conflict] https://albionmarket.gg/guides/best-refining-city-setup |
| EVE Online | Regional order books | Sales tax and broker fee in the low-to-mid single digits each, skill-reduced; CCP has moved the base rates several times (one CCP post lists 8% tax + 3% broker) | [V-weak, undated] https://www.eveonline.com/news/view/updates-to-sales-taxes-and-brokers-fees |
| New World | Posted sell + buy orders, linked server-wide after 2021 | Listing fee + transaction tax set partly by the owning company | [V] links in section 1 |
| Path of Exile 2 (0.4.0) | Async "Merchant Tabs": posted price, buyer can purchase while seller offline; separate Currency Exchange order book for fungibles | Buyer pays a gold fee; seller pays nothing | [V, mixed-quality sources] https://www.rpgsite.net/news/18278-path-exile-2-asynchronous-trade-system-in-game-market-gameplay-demo-video |

Pattern worth copying from PoE2 and OSRS [INF]: **two different market types for two different goods.** Fungible
stackables (raw and refined materials, gems) trade on an order book. Unique rolled items (gear with perks) trade as
posted-price listings with search filters. Timed auctions need concurrent bidders and are the wrong fit for a
low-population async game.

### Sinks, faucets, inflation and deflation

- Faucet/sink framing is standard in both practitioner and academic writing; a reader's summary of Lehdonvirta &
  Castronova lists transaction taxes, service fees and limited-lifespan items as the canonical sinks and notes the
  most effective sinks are usually the least acceptable to players. [V, secondary summary]
  https://www.antoinebuteau.com/virtual-economies-book-summary/
- Koster: players, not designers, control money creation ("when they run short, they mint more by killing things");
  the economy only needs to be healthy enough to keep players entertained. [V via summaries of
  https://www.raphkoster.com/?p=680 and Wired 2004; primary text not fetched]
- New World shows the **opposite failure**: sinks (repair, taxes, housing) outpaced what end-game players earned,
  coin got scarce, players bartered. With no NPC price anchor, goods could fall to the minimum listing price. [V]
  https://shacknews.com/article/127240/new-worlds-economy-is-currently-suffering-from-deflation
- Lost Ark: bots were the main inflation driver; Smilegate changed how gold is earned in response. [V]
  https://siliconera.com/?p=940307
- PoE Trade Manifesto: "easy trade means reducing drop rates" - the easier trade is, the more each player's supply
  is effectively the whole population's supply, so per-player drop rates must fall. [V]
  https://www.pathofexile.com/forum/view-thread/2025870
- Albion's Black Market: an NPC buyer of player-crafted gear that redistributes those exact items as PvE mob drops; the
  buy orders are funded out of mob silver drops. Result: all dropped gear was crafted by a player, so loot never
  competes with crafters. [V] https://www.albionbattlehub.com/en/guides/black-market ,
  https://nerdlodge.com/albion-online-black-market
- Albion gear destruction on full-loot death: one guide says ~30% destroyed, 70% lootable. [V-weak, single guide]

### Making a market feel alive at very low population

- **Prosperous Universe** (small-population browser economy game) is the closest precedent. Devlog #538 (July 2026):
  about ten static **market makers**, each with both a bid and an ask, giving unlimited supply of essentials for new
  players and an unlimited buyer for what they produce; the team is exploring dynamic market makers. **Price bands**
  (devlog #191): orders must fall within +/-25% of the 3-day average for unrated companies and +/-75% for others; bands
  always stretch to include the market-maker price. Forum discussion notes market makers act as a floor and ceiling
  and that removing them risks a deflationary spiral. [V]
  - https://prosperousuniverse.com/blog/2026/07/13/market-maker-momentum-538
  - https://prosperousuniverse.com/blog/2019/07/14/price-bands-191/
  - https://com.prosperousuniverse.com/t/nerfing-the-market-makers/1755/7
- **EVE** seeded basic minerals with fixed NPC buy/sell orders early on; since everything reprocesses to minerals,
  that anchored all prices. [V-weak, forum recollection] https://gamedev.net/forums/topic/636963-removing-npc-economy/
- **Pooling**: New World linking all trading posts is the canonical "don't fragment thin liquidity" lesson. [V]
- **OSRS item sink** is a market-maker in reverse: tax revenue buys surplus items and destroys them. [V]

Concrete mechanism for your game [INF]:
1. One global market, all players, all regions. No per-town markets.
2. NPC "Guild Factor" quotes a bid and an ask on every **raw and refined material only** (never finished gear),
   with a wide spread: e.g. buys at 50% of reference price, sells at 200%. Players trade inside the spread; the NPC is
   the backstop that guarantees you can always sell a haul and always finish a recipe.
3. Reference price = trailing 7-day volume-weighted player trade price, clamped to move at most ~5% per day, and
   initialised from a hand-authored table. This makes it manipulation-resistant at low volume.
4. NPC quantities are finite per day and scale with active players, so the NPC cannot be farmed as an infinite faucet
   or drained to corner a market.
5. Finished gear has no NPC ask. The NPC bid for gear is a salvage value (returns a fraction of materials), which is
   both a floor and an item sink.
6. A "recent trades" ticker and price-history sparkline matter more than raw liquidity for the feeling of life.

### Anti-bot / anti-dupe basics

- Server-authoritative inventory; remove-and-add as one atomic transaction; idempotency keys on every trade/craft/grant
  request (unique constraint in the DB); serialise concurrent operations on the same item or wallet; append-only ledger
  with a scheduled invariant check (sum created - sum destroyed = sum held, per item type); unique IDs on non-fungible
  items. [V, engineering blogs] https://heroiclabs.com/blog/designing-game-economies-that-survive-scale/ ,
  https://bugnet.io/blog/how-to-fix-inventory-item-duplication-bug
- New World's dupes came from exactly these classes of bug (transfers during failed/laggy states), and the remedy was a
  global trade kill-switch. Build that switch on day one. [V for the incidents; mechanism detail PK]
- Trade gates: account age and progress thresholds before trading (New World: level 10 and 72 hours; Tarkov: flea
  market at player level 15, with more categories unlocking up to level 40). [V]
  https://insider-gaming.com/tarkov-flea-market-locked-level-40/
- Per-item buy limits per 4-hour window (OSRS) blunt both bots and market cornering. [V]
- Browser-specific [INF]: the client is fully inspectable, so the **run result itself** is the main dupe/bot vector.
  Haul must be computed or validated server-side: seeded runs, server-issued run tokens, plausibility caps on haul per
  wave, and replay-verifying a sample of runs. Without this the market is flooded by forged hauls within days.

---

## 3. Crafting as decisions, not checklists

Precedents:

- **Star Wars Galaxies**: resources had stats (e.g. overall quality on a 1-1000 scale); spawns rotated and were
  replaced by variants with different stats; "you cannot craft past the ceiling set by your input materials"; crafters
  then ran an experimentation step to allocate quality into chosen item stats. Community consensus is that the resource
  network mattered more than skill boxes. Dissent exists: one Massively OP writer called it "still just click-to-craft".
  [V, fan/community sources] https://swgr.org/wiki/crafting ,
  https://massivelyop.com/2018/09/21/massively-overthinking-which-mmorpg-living-or-dead-offers-the-best-crafting-experience/
- **New World**: started with random perks plus a craft mod that could steer one perk [PK], ended with pick-your-attribute
  and pick-two-perks crafting via Golden Scarabs [V]. The lesson is that players accept RNG on *minor* outcomes and
  demand agency over *identity-defining* ones.
- **Path of Exile**: GGG's Harvest manifesto said deterministic crafts made near-perfect items too easy and the rest
  of crafting redundant, leaving "nothing left to achieve"; the community read the nerf as protecting the richest
  players. [V] https://www.pathofexile.com/forum/view-thread/3069670 ,
  https://gamerant.com/path-of-exile-harvest-nerf-fans-upset/
  So fully deterministic best-in-slot collapses the chase; fully random is gacha. Both ends are documented failures.
- **Albion**: specialisation and city bonuses change resource return rate (roughly 15% base, ~37% in the bonus city,
  ~54% with bonus plus focus), so a specialist is literally cheaper per unit than a generalist. [V-weak, community
  calculators] https://albionmarket.gg/guides/best-refining-city-setup
- **Lost Ark honing** uses a failure-accumulates-to-guarantee pity meter. [PK; not verified this session]

Design rules [INF]:

1. **Determinism where identity lives, variance where it doesn't.** Crafter chooses item type, tier and the *primary*
   perk (guaranteed). The secondary perk is drawn from a small pool the crafter can narrow. Only the gear-score roll
   within a band is random. A bad roll is still the item you meant to make.
2. **Input quality sets the ceiling** (SWG). Material quality comes from how it was gathered (deeper wave, higher danger,
   better tool), and the lowest-quality input caps output. This creates demand for *good* materials specifically, and a
   price gradient that rewards skilled runs rather than time.
3. **Decisions per craft, target three**: which perk to guarantee (spends a rare perk reagent), which quality of inputs
   to commit, and whether to spend a scarce "focus"/pity resource to push the roll. More than three becomes a spreadsheet.
4. **Pity, not pure gamble**: each craft that rolls in the bottom half of the band adds to a meter that guarantees a
   top-band roll when full.
5. **Why buy from another player** - five separate levers; use at least three:
   - *Capped specialisation*: an account can master only a subset of trades (per season), so nobody is self-sufficient.
   - *Specialist efficiency*: mastery gives material return and access to the top quality band (Albion's model).
   - *Recipe/perk discovery*: perk recipes are found in runs and are learnable by one account or sellable as an item;
     early discoverers have a temporary monopoly.
   - *Time arbitrage*: refining takes real-time hours per batch on a limited number of queue slots; players with idle
     queues sell throughput.
   - *Divergent inputs*: each build archetype naturally farms one resource family but needs gear made from another.
6. **No trash-craft levelling.** Trade skill XP comes from crafting items that are then *used* (sold, equipped in a run,
   or contributed to a town project), or from fulfilling buy orders - not from making and vendoring 300 daggers.
7. **Crafted gear must not be trumped by drops.** Either all persistent gear is crafted (drops are materials, recipes
   and reagents only), or drops are recycled crafts (Albion Black Market). The first is far simpler.

---

## 4. Connecting the persistent layer to runs without pre-winning them

### Precedents

- **Hades**: Kasavin says the Mirror of Night exists to make you "meaningfully more powerful" between runs, so a new
  player can eventually finish through permanent upgrades while an expert finishes far sooner. [V]
  https://www.tomsguide.com/features/hades-exclusive-interview-supergiant . Post-win, the Pact of Punishment (Heat)
  lets the player raise difficulty to keep rewards flowing, which re-opens the challenge that meta-power closed. [PK]
- **Roguelite community critique**: the recurring complaint is "when I succeed it doesn't feel rewarding because I
  know I only succeeded because of the meta progression"; Slay the Spire is the cited counter-model (unlocks add
  variety, not power). [V, forum sentiment] https://saschb2b.github.io/game-mechanics/concepts/meta-as-variety-not-power
- **Loop Hero**: retreat at the camp tile keeps 100% of gathered resources, retreat elsewhere keeps 60%, death keeps
  30%. The whole risk decision is "leave now or push one more loop". [V] https://en.wikipedia.org/wiki/Loop_Hero ,
  https://twinfinite.net/guides/loop-hero-return-to-camp-how/
- **Escape from Tarkov**: stash economy with periodic wipes; flea market gated by level 15+; the found-in-raid
  requirement to list items was removed in May 2024; one commentary argues the flea market makes the game boring by
  short-circuiting the loot hunt. [V] https://ggrecon.com/articles/ultimately-the-flea-market-makes-escape-from-tarkov-boring ,
  https://consolepcgaming.com/escape-from-tarkov-removes-fir-requirement-and-reduces-intertia
- **Dark and Darker**: gear-score-bracketed lobbies (mid-2024: a <=25 bracket and a >25 bracket for normals, later
  a 125 threshold; High Roller unbracketed). Players complain both ways: within a bracket "why even have gear", and
  brackets create a narrow meta at the cap. A mini-season ran solo-self-found for two weeks before opening the
  marketplace. Wipes are regular and one early wipe was forced by cheaters. [V-weak for bracket numbers, Steam forums;
  V for wipes] https://steamcommunity.com/app/2016590/discussions/0/6513974776604435292 ,
  https://darkanddarker.wiki.spellsandguns.com/Patch:6.8.5 ,
  https://www.pcgamer.com/dark-and-darker-wiped-character-progress-today-due-to-an-influx-of-cheaters/
- **Extraction genre generally**: commentary agrees loss gives the genre its tension, and that free kits lower the
  entry barrier but erode that tension if always available. [V] https://comicbook.com/gaming/feature/arc-raiders-free-kits-are-easing-entry-but-threatening-gear-fear/
- **Deep Rock Galactic**: overclocks are mostly sidegrades, earned on a weekly-capped cadence, permanent once crafted;
  hazard level is player-selected. [V for cadence/permanence; "sidegrade" characterisation PK]
  https://deeprockgalactic.wiki.gg/wiki/Development_Q%26A/Archive_Season_3
- **Brotato**: shop reroll price rises per reroll and resets each shop, scaled by wave. [V]
  https://brotato.wiki.spellsandguns.com/Shop . Danger levels 0-5 as player-selected difficulty; trees/Harvesting stat
  as an in-run material faucet. [PK]
- Dome Keeper, Cult of the Lamb, Albion full-loot specifics: not verified this session. [PK]: Dome Keeper's core
  tension is time spent mining versus time defending within a single run - structurally the closest match to
  "gather during a wave".

### The stake model that works [INF, built from the above]

The failure to avoid: persistent gear multiplies run power, so the grind (or the wallet) wins the run. The three
precedents that avoid it each use a different lever, and they combine cleanly:

1. **Gear is a key, not a multiplier** (Hades Heat / DRG hazard / Brotato Danger). Persistent gear raises the
   *difficulty tier you can enter*, and enemy scaling in that tier absorbs the gear's power. Rewards (material tier
   and quality) scale with tier. At the tier matched to your gear, a run is about as hard as a naked run at tier 0.
   Over-geared runs in low tiers are allowed but pay out low-tier materials you no longer need.
2. **Bounded contribution.** The loadout brought into a run is small (1 weapon, 1 armour, 1 tool, 1 trinket) and
   targets roughly 25-35% of end-of-run power at matched tier; the rest comes from the in-run shop and level-ups, as in
   Brotato. Perks should mostly *shape a build* (conditional, synergy-enabling) rather than add flat stats.
3. **Stake on the way out, not the way in** (Loop Hero). Resources gathered in a run are at risk; gear brought in is
   not lost outright. Bank points every 5 waves: leave now with 100% of the haul, or continue. Death keeps ~30% of the
   unbanked haul. Short sessions make full-loot gear loss feel terrible and it would strangle a thin market's demand
   side in the wrong way (people stop bringing good gear), so avoid Tarkov/Albion-style gear loss.
4. **Wear as the item sink.** Every run consumes durability; death consumes more. Repair costs materials and each repair
   lowers max durability, so gear has a finite life of roughly 15-30 runs. This is what keeps crafters employed
   forever without a wipe being the only sink (Koster/SWG decay logic; limited-lifespan items are one of the standard
   sinks in Lehdonvirta & Castronova per the summary cited above).
5. **A free baseline kit always exists** and can clear tier 0-1, so the market is never mandatory and a broke player
   is never locked out. Keep the free kit strictly below crafted tier-1 so it does not erase stakes.
6. **Gathering costs combat power inside the run.** The tool occupies a weapon slot (or nodes require standing still in
   a ring), so every material is bought with risk. That makes materials skill-priced rather than time-priced, which is
   the real defence against "pay-to-win via grind".

---

## 5. Shared-town and community goals, async and small scale

- **New World town projects**: stations upgrade from tier 1 to 5 through town projects; players pick individual tasks
  from a board; upkeep is due every 7 days and settlements **downgrade** if it is unpaid (or an invasion is lost);
  each upgrade raises weekly upkeep; only the governing company chooses projects. Town-project tasks give the most
  territory standing, which players spend on personal perks such as lower station fees. [V]
  https://newworld.fandom.com/wiki/Settlement , https://newworld.wiki.fextralife.com/Town+Project+Board ,
  https://gamerant.com/new-world-town-projects-explained-upgrades/
  Weak points [PK/INF]: governance by one company excludes most players from the decision; downgrades on a low-pop
  server punish everyone for population decline.
- **Helldivers 2 Major Orders**: one hand-authored, time-limited collective objective at a time; contribution is
  passive (normal missions count, no opt-in); reward goes to everyone. [V] https://helldivers.wiki.gg/wiki/Major_order ,
  https://www.gamesradar.com/helldivers-2-major-orders
- **Elite Dangerous Community Goals**: global tiers that raise the reward for all, plus personal reward by
  contribution percentile (top 25% / 50% etc.), ending at top tier or time limit, whichever comes first. [V-weak;
  thresholds not confirmed] https://elite-dangerous.fandom.com/wiki/Community_Goals
- **Wipes/seasons**: Tarkov and Dark and Darker reset stash/gold periodically; Dark and Darker has done semi-wipes that
  reset items and gold but kept quest progress, and solo-self-found openings before the market unlocks. [V]
  https://darkanddarker.wiki.spellsandguns.com/Patch:6.8.5

What works async at small scale [INF]:

1. **Passive contribution**: a fixed share of every haul and every market tax flows to the active town project
   automatically; direct donation is an optional extra. Nobody has to coordinate.
2. **Targets scale with active population** (rolling 7-day active accounts), so ten players and ten thousand both
   finish a project in about a week.
3. **Voting by contribution, not governance by guild**: the next project is chosen from 2-3 options weighted by donated
   materials.
4. **Decay without humiliation**: station tiers need weekly upkeep, but can drop at most one tier per week and never
   below tier 2.
5. **Two-layer rewards**: a global unlock for everyone (station tier, new recipe family) plus percentile-based personal
   cosmetics/titles. Never percentile-gate power.
6. **Seasons of 8-12 weeks** with a partial reset: coin, materials, gear and town tiers reset; recipes discovered,
   cosmetics, account trade-skill "legacy" levels (faster re-levelling) and stats persist. Seasons are the cleanest
   inflation control available to a tiny team and they also contain any dupe damage.
7. **One world.** Do not shard. If load ever forces shards, keep a single cross-shard market and town.
8. **Shared discoveries**: first account to craft a recipe/perk combination is named on it in the public codex; cheap,
   async, and it makes the world feel inhabited.

---

## 6. Recommendations for the fused design

All numbers here are [INF] starting values for playtest, not precedents.

### R1. Six trades, not seventeen: 3 material trades x 3 maker trades

- Material trades (each covers gathering in-run *and* refining in town): **Metal** (ore -> ingot), **Timber**
  (wood -> plank), **Hide** (pelt/fibre -> leather/cloth).
- Maker trades: **Arms** (weapons, tools), **Armour** (armour, trinkets), **Arcana** (gems, perk reagents, consumables).
- Stations: Smelter, Sawmill, Tannery, Forge, Outfitter, Arcane bench - one per trade, tiers 1-4.
- A fourth, non-gatherable input: **Essence**, dropped only by elites/bosses, used for perks and gems. It ties craft
  ceiling to combat skill.
- Interdependence rule: every finished recipe needs refined inputs from at least two material families plus, at tier 3+,
  an Arcana reagent. Each account can **master one material trade and one maker trade per season** (others capped at
  mid tier). With 3x3 there are 9 specialist profiles and every one of them needs the other two material families.
- Rationale: New World's 17 skills are 5 gather/refine pairs + 7 crafts; the interdependence comes from the pairing and
  from multi-family recipes, not from the count. Three families is the minimum where "I have A, need B and C" always
  holds; two families collapses into a single bilateral trade.
- Tiers: 4 material tiers. Lower tiers stay relevant because higher refining consumes lower refined goods as flux
  (New World does this [PK]), which keeps new players' output saleable to veterans - the main cure for the dead
  low-tier market.

### R2. Gather inside the wave, with an opportunity cost

Resource nodes spawn in the arena; the equipped tool takes a weapon slot and auto-harvests in a short radius, or nodes
need a 1-2 second channel. Deeper waves and higher danger tiers spawn higher-quality nodes. Give harvest hits the best
audio in the game; New World's most praised feature was the sound of a pickaxe.
Rationale: preserves the loved part (tactile, opportunistic) and removes the hated part (travel, weight), while pricing
materials in risk rather than time.

### R3. Gear is a key to harder tiers; stake the haul, wear the gear

Matched-tier scaling, 4-slot loadout worth ~25-35% of run power, bank-or-push every 5 waves (100% if you leave at a
bank point, ~30% of unbanked haul on death), durability giving gear a 15-30 run life, free baseline kit for tiers 0-1.
Rationale: section 4. This is the single most important decision for avoiding pre-won runs.

### R4. Targeted crafting with a quality ceiling from inputs

Crafter picks item, tier and one guaranteed perk (costs a perk reagent); second perk from a narrowed pool; gear score
rolls within a band whose top is set by the lowest-quality input; pity meter on low rolls. All persistent gear is
crafted; runs drop only materials, essence and recipes.
Rationale: New World ended at pick-your-perks after two years of gacha complaints; PoE shows that full determinism
removes the chase; SWG shows input-quality ceilings make gathering itself a skilled, tradeable activity.

### R5. One global async market: order book for stackables, posted listings for gear, NPC market maker on materials only

- Order book with buy and sell orders for materials/gems/reagents; posted-price searchable listings for gear.
- Fees: ~2% listing fee (non-refundable, discourages relist spam and undercut wars) + ~5% sale tax. Total sink of
  5-8% is enough at your scale; GW2's 15% is tuned for a mature inflationary economy, and New World shows the
  deflation risk of over-sinking a young one.
- NPC Guild Factor bid/ask on materials at ~50% / ~200% of a slow-moving reference price, finite daily volume scaled to
  active players; price bands of +/-50% around the 7-day average for player orders (Prosperous Universe uses
  +/-25%/75% around a 3-day average).
- Salvage as the NPC floor for gear (returns ~30-40% of materials).
- Buy limits per item per 4 hours; trading unlocks after N completed runs and 48-72 hours of account age.
- Route half of tax revenue into the town project fund and half into an OSRS-style item sink that buys the most
  oversupplied material each day.
Rationale: section 2. Posted price + order book both work with zero concurrent players; auctions do not.

### R6. Instrument faucets and sinks from day one and keep a kill-switch

Coin enters only from NPC bids and run completion rewards; coin leaves through fees, repair, station use fees and town
upkeep. Log every creation and destruction in an append-only ledger, run a nightly conservation check, publish a small
"economic report" page (EVE does this monthly and players treat it as content). Target sinks at 90-100% of faucets and
tune weekly. Build a global trade pause.
Rationale: New World had to take its whole economy offline twice in a month; a small team cannot afford to discover
that tooling during the incident.

### R7. Server-validated runs before any market exists

Seeded runs with a server-issued token; server recomputes or bounds the haul; sample replays; rate-limit runs per
account. Ship the market only after this is in place.
Rationale: in a browser game the forged run result is the dupe. Everything in R5 assumes hauls are real.

### R8. One shared town, passive contribution, 8-12 week seasons

Station tiers 1-4 raised by projects whose targets scale with active players; a share of every haul and all tax flows
in automatically; vote on the next project with contributions; soft decay; seasonal partial reset that keeps recipes,
codex credits, cosmetics and legacy levels. Consider a solo-self-found first week before the market opens each season
so the opening is about discovery rather than flipping (Dark and Darker precedent).
Rationale: section 5. Seasons double as inflation control and exploit containment, which matters more for a small team
than for Amazon.

### Open risks to test early [INF]

- At under ~200 weekly actives the NPC market maker will be most of the liquidity; check whether the game is still
  fun when the "market" is effectively a vendor with a spread. If it is not, interdependence (R1) is too strict for
  your population and the mastery cap should loosen dynamically.
- Tool-in-weapon-slot may make gathering builds feel like a tax. Alternative: a dedicated tool slot plus a positional
  cost (channel time near nodes).
- Durability sinks are unpopular (the Lehdonvirta/Castronova point about effective sinks being the least accepted).
  Frame wear as "runs remaining" on the item card from the moment of crafting, never as a surprise repair bill.

---

## Source list (all URLs referenced)

New World
- https://twinfinite.net/2021/10/new-worlds-impressive-sound-design-makes-me-want-to-mine-rocks-forever/
- https://www.pcgamesn.com/new-world/review-pc
- https://mein-mmo.de/en/for-15-years-i-have-been-playing-mmorpgs-without-sound-but-that-changed-with-new-world,734284
- https://primagames.com/featured/new-world-review
- https://www.pcgamer.com/au/im-completely-hooked-on-new-worlds-fishing-and-crafting
- https://www.avclub.com/new-world-mmo-review
- https://newworld.wiki.fextralife.com/Trade+Skills
- https://www.icy-veins.com/new-world/trade-skill-guides
- https://newworld.fandom.com/wiki/Settlement
- https://newworld.wiki.fextralife.com/Town+Project+Board
- https://gamerant.com/new-world-town-projects-explained-upgrades/
- https://www.newworld.com/en-us/news/articles/making-your-mark-on-aternum-settlements-and-governance
- https://forums.newworld.com/t/amazon-needs-to-know-rng-hell-is-not-an-endgame/644425?page=2
- https://www.altchar.com/game-news/new-world-player-explains-why-armoring-painful-grind-is-not-worth-it-a3UjR7P1xYOY
- https://www.altchar.com/game-news/new-world-expertise-changes-to-crafting-and-gear-nerfs-will-be-scaled-down-aUDfl0V9RD9j
- https://www.thegamer.com/new-world-watermark-update-crafting-worthless/
- https://www.gamespot.com/articles/new-world-players-are-up-in-arms-about-the-games-newly-proposed-expertise-system/1100-6498587/
- https://shacknews.com/article/127240/new-worlds-economy-is-currently-suffering-from-deflation
- https://www.pcgamer.com/amp/amazon-says-new-worlds-economy-is-just-fine-thanks/
- https://invenglobal.com/articles/15691/new-world-takes-its-entire-economy-offline-again
- https://gamerant.com/new-world-wealth-transfer-disabled-mmo-economic-exploits-dissatisfaction/
- https://gamespot.com/articles/new-world-patch-1-0-5-cracks-down-on-gold-sellers-addresses-gold-duplication-exploits/1100-6497722/
- https://wccftech.com/new-world-devs-address-economy-changes-add-measures-to-fight-coin-sellers-including-turning-off-family-sharing-on-steam/
- https://gamerant.com/new-world-trading-posts-economy-reduce-travel-expenses/
- https://mein-mmo.de/en/new-world-makes-major-changes-to-the-trading-posts-could-destroy-the-economy,745948
- https://vulkk.com/2021/12/02/new-world-update-1-1-1-and-current-issues-3-dev-blog-analysis/
- https://gaming.tools/newworld/crafting-calculators/goldenscarab
- https://newworld.com/en-us/news/articles/new-world-update-4-0-1
- https://www.newworld.com/en-us/game/releases/season-of-the-divide
- https://loltank.com/2023/05/17/new-world-crafting-overhaul-guaranteed-3-perk-bop-crafts-for-easier-bis-gearing-in-pvp-pve
- https://www.newworld.com/en-us/news/articles/crafting-in-new-world
- https://en.wikipedia.org/wiki/New_World_(video_game)

Markets and economies
- https://wiki.guildwars2.com/wiki/TP
- https://help.guildwars2.com/hc/en-us/articles/222384087-Missing-Gold
- https://oldschool.runescape.wiki/w/Grand_Exchange_tax
- https://oldschool.runescape.wiki/w/Update:Grand_Exchange_Tax_%26_Item_Sink
- https://oldschool.runescape.wiki/w/RuneScape:Grand_Exchange_Market_Watch/Buying_limits
- https://albionmarket.gg/guides/best-refining-city-setup
- https://www.albionbattlehub.com/en/guides/black-market
- https://nerdlodge.com/albion-online-black-market
- https://www.eveonline.com/news/view/updates-to-sales-taxes-and-brokers-fees
- https://gamedev.net/forums/topic/636963-removing-npc-economy/
- https://prosperousuniverse.com/blog/2026/07/13/market-maker-momentum-538
- https://prosperousuniverse.com/blog/2019/07/14/price-bands-191/
- https://com.prosperousuniverse.com/t/nerfing-the-market-makers/1755/7
- https://siliconera.com/?p=940307
- https://www.raphkoster.com/?p=680 (not fetched; via summaries)
- https://www.antoinebuteau.com/virtual-economies-book-summary/
- https://heroiclabs.com/blog/designing-game-economies-that-survive-scale/
- https://bugnet.io/blog/how-to-fix-inventory-item-duplication-bug

Crafting
- https://www.pathofexile.com/forum/view-thread/3069670 (Harvest manifesto)
- https://gamerant.com/path-of-exile-harvest-nerf-fans-upset/
- https://www.pathofexile.com/forum/view-thread/2025870 (Trade manifesto)
- https://www.rpgsite.net/news/18278-path-exile-2-asynchronous-trade-system-in-game-market-gameplay-demo-video
- https://swgr.org/wiki/crafting
- https://massivelyop.com/2018/09/21/massively-overthinking-which-mmorpg-living-or-dead-offers-the-best-crafting-experience/

Run loop and stakes
- https://www.tomsguide.com/features/hades-exclusive-interview-supergiant
- https://saschb2b.github.io/game-mechanics/concepts/meta-as-variety-not-power
- https://en.wikipedia.org/wiki/Loop_Hero
- https://twinfinite.net/guides/loop-hero-return-to-camp-how/
- https://insider-gaming.com/tarkov-flea-market-locked-level-40/
- https://ggrecon.com/articles/ultimately-the-flea-market-makes-escape-from-tarkov-boring
- https://consolepcgaming.com/escape-from-tarkov-removes-fir-requirement-and-reduces-intertia
- https://steamcommunity.com/app/2016590/discussions/0/6513974776604435292
- https://darkanddarker.wiki.spellsandguns.com/Patch:6.8.5
- https://www.pcgamer.com/dark-and-darker-wiped-character-progress-today-due-to-an-influx-of-cheaters/
- https://comicbook.com/gaming/feature/arc-raiders-free-kits-are-easing-entry-but-threatening-gear-fear/
- https://deeprockgalactic.wiki.gg/wiki/Development_Q%26A/Archive_Season_3
- https://brotato.wiki.spellsandguns.com/Shop

Community goals
- https://helldivers.wiki.gg/wiki/Major_order
- https://www.gamesradar.com/helldivers-2-major-orders
- https://elite-dangerous.fandom.com/wiki/Community_Goals
