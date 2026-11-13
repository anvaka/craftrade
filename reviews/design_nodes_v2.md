# Design nodes, version 2 (after round-1 review)

Each: label | clock | role | verdict
description
audit note (includes what round 1 changed)

## Merging two identical weapons rerolls Gear Score in range
- id: merging-two-identical-weapons-rerolls-gear-score-in-range | clock: session | role: converter | verdict: keep
- 
- audit: The one in-run crafting verb; everything else at the merge step should hang off it.

## Behavior tree level-of-detail under the 100-enemy cap
- id: behavior-tree-level-of-detail-under-the-100-enemy-cap | clock: none | role: engineering | verdict: defer
- 
- audit: An implementation detail, not a design choice; it cannot be judged from the graph.

## Bag weight cap forces a bank-or-push choice
- id: bag-weight-cap-forces-a-bank-or-push-choice | clock: session | role: choice | verdict: keep
- In a run, collected materials have weight; going over the bag cap removes dodge and sprint as in New World, so between waves the player chooses to return to town and deposit or to keep fighting while heavy.
- audit: Model: the push-or-extract choice already exists from death risk alone, and a tight cap makes every skill level stop at the same depth. Keep the encumbrance penalty, tune the cap loose. Reworked by the gradual carry-weight node: keep the bank-or-push decision, drop the hard cap. Sim v2: a strong weight penalty was the only change among 13 parameter sets that made early extraction matter; lowering what is kept on death did not.

## Only banked materials survive a failed run
- id: only-banked-materials-survive-a-failed-run | clock: session | role: sink | verdict: keep-core
- Materials and schematics still in the bag are mostly lost on death (about a fifth is kept); what was extracted at a boss gate persists. There is no emergency recall.
- audit: Model: with 40% kept on death the best stopping depth differs by skill (3, 4, 5 segments), so the choice is real. Four other nodes depend on it. Round 1 review: min-maxer used the recall to bank before each boss; recall removed.

## Crafted bags as long-term carry upgrades
- id: crafted-bags-as-long-term-carry-upgrades | clock: season | role: sink | verdict: keep
- Bags are crafted from gathered materials and kept across runs, filling a small number of bag slots, with Extra Pockets style capacity perks and Burden style weight cuts for one material category.
- audit: Model: each bag step is worth about one more segment of depth, a clear long-term goal and a material sink.

## Town station tiers gate between-run recipes
- id: town-station-tiers-gate-between-run-recipes | clock: week | role: sink | verdict: keep-core
- The town's crafting and refining stations have tiers 1 to 5; the player spends banked materials on town-board style projects (gather, craft, kill goals) to raise a station tier and unlock the next tier of recipes for future runs.
- audit: A large material sink unrelated to gear upgrades, which the model says the economy lacks.

## Town standing cards as pick-one meta-progression
- id: town-standing-cards-as-pick-one-meta-progression | clock: week | role: reward | verdict: keep
- Runs earn town standing; each standing level offers a pick-one-of-three card with a permanent bonus such as more town storage, lower crafting fees or faster gathering, mirroring New World's Territory Standing cards.
- audit: Cheap, precedented, gives every session a persistent payout.

## Charm sockets set in the pre-run loadout
- id: charm-sockets-on-weapons-swapped-between-waves | clock: session | role: choice | verdict: keep
- Weapons have sockets for charms that add triggers or change the ability. Charms are chosen before the run with the rest of the loadout and are not swapped at camp.
- audit: Round 1 review: moved out of the camp to respect the three-decision limit. (Before review: Gives charms and oils a place to go.)

## Mixable 2/4 and 3/5 set bonuses across six weapon slots
- id: mixable-2-4-and-3-5-set-bonuses-across-six-weapon-slots | clock: season | role: choice | verdict: keep
- 
- audit: Build variety from a shipped system.

## Artifact weapon unlocks its perks through in-run objectives
- id: artifact-weapon-unlocks-its-perks-through-in-run-objectives | clock: week | role: goal | verdict: keep
- 
- audit: Per-item goals inside runs.

## Wave shop in-run, player market between sessions
- id: wave-shop-in-run-player-market-between-sessions | clock: session | role: structure | verdict: staged
- Keep the Brotato-style shop after every wave as a fixed in-run shop paid for with run materials, and place the player-driven Trading Post only in town between sessions, so market browsing never interrupts a run and one linked market serves every town.
- audit: Round 1 review: producer named the player market the single node most likely to sink the project: it makes the game a server-run service from day one, and the economy model shows a glut. Staged after the core minute is proven; the owner has said trading matters, so it is not cut. (Before review: The boundary that keeps the run loop and the market from breaking each other.)

## Only unequipped crafted gear and materials tradable
- id: only-unequipped-crafted-gear-and-materials-tradable | clock: none | role: structure | verdict: keep
- Make gathered materials, refined materials and never-equipped crafted gear tradable, while gear bought in the wave shop or dropped in a run binds to the player, so crafters have a market without letting coin buy a finished run build.
- audit: Needed for a crafter market to exist.

## Trades settle server-side between sessions only
- id: trades-settle-server-side-between-sessions-only | clock: none | role: engineering | verdict: keep
- Allow no item or coin transfer during a run; every trade goes through server-held escrow in town, with a minimum account age and progression level before trading unlocks, so a duplication bug can be contained by pausing the market without stopping play.
- audit: Safety rule with a real precedent (the 2021 dupes).

## Ore and timber nodes inside waves, gathered under fire
- id: ore-and-timber-nodes-inside-waves-gathered-under-fire | clock: minute | role: source | verdict: prototype
- Put New World style ore veins, trees and hides on the wave arena so that gathering costs seconds of exposure during a 20 to 90 second wave, with gathering speed as a stat the build can invest in the way Deep Rock Galactic: Survivor treats mining speed.
- audit: The core bet. Three nodes depend on it and no paper method can test it.

## Boss gates offer rule-bending wild picks
- id: milestone-levels-offer-rule-bending-wild-picks | clock: session | role: choice | verdict: prototype
- After each boss the player picks one rule change in the style of Brotato characters, such as an extra weapon slot at a damage penalty per weapon. Three picks per run, each at a boss gate.
- audit: Round 1 review: moved from level milestones to boss gates so it does not add a camp decision. (Before review: The main 'wilder' lever inside a run; needs play to judge.)

## Permanent unlocks add options, not flat stats
- id: permanent-unlocks-add-options-not-flat-stats | clock: season | role: principle | verdict: keep
- To get stronger across weeks without power creep, make permanent progress widen the pool (new starting loadouts, weapon families, wild picks, recipes) rather than raise base stats, which avoids the roughly 2.5x baseline inflation described for Vampire Survivors and the gear gate players disliked in New World PvP.
- audit: Constraint on other nodes, five precedents.

## Two material classes: run currency resets, town ore persists
- id: two-material-classes-run-currency-resets-town-ore-persists | clock: session | role: structure | verdict: keep-core
- Run currency drops from kills, is spent in the wave shop on weapons and merges, and never leaves the run. Gathered trade materials go home if banked; inside a run their only use is the single camp craft. Persistent coin is a third thing, earned in small amounts.
- audit: Round 1 review: clarified so it no longer contradicts the camp craft. (Before review: Keep this one of the pair. Absorbed the run-materials-and-coin node: persistent coin is a third thing, earned in small amounts and drained by fees and repair.)

## Expedition keys rise on success and never fall below the week's best
- id: expedition-keys-upgrade-on-success-deplete-on-failure | clock: week | role: ladder | verdict: keep-core
- Each player holds one expedition key naming a biome and a danger level. Clearing the final boss raises it; failing leaves it where it is. Levels have no upper limit.
- audit: Round 1 review: producer: a depleting key turns one bad evening into negative progress for a 30-minute player. (Before review: Gives an endless next rung without new content; three precedents. Absorbed the danger-tier ladder node: key levels are the ladder into raids.)

## Weekly mutators shared by all players
- id: weekly-mutators-shared-by-all-players | clock: week | role: variety | verdict: keep
- Each week one fixed set of mutators applies to every key (for example enemies explode on death, ore nodes attract elites, the shop sells no healing), so the community theorycrafts the same week and the crafting market shifts toward that week's counters.
- audit: Cheap variety and shifts market demand each week.

## Weekly vault counted in runs completed
- id: weekly-vault-three-rows-gather-craft-fight | clock: week | role: reward | verdict: keep
- A weekly chest whose choices unlock by runs completed (1, 4 and 8), with one row each for what was gathered, crafted and fought, and the player takes one item. A player with time for one activity still fills a row.
- audit: Round 1 review: producer: three rows asked for three activities from someone with time for one. (Before review: The only node that pays gatherers, crafters and fighters on the same clock.)

## Mastery rank from levelling every weapon family
- id: mastery-rank-from-levelling-every-weapon-family | clock: season | role: progression | verdict: keep
- An account rank raised by taking each weapon family, bag type and trade skill to its cap once. Ranks unlock options (loadout slots, market order slots, recipe tiers), never raw stats, which gives collectors a months-long goal and keeps off-meta gear selling.
- audit: Model: gear sales fall about 80% across a season; breadth goals are a source of demand for non-best gear.

## Every session pays trade skill XP and standing
- id: every-session-pays-trade-skill-xp-and-standing | clock: session | role: reward | verdict: keep-core
- A run pays trade-skill experience, standing and vault progress in proportion to waves cleared, whether or not it ends in death; only the unbanked bag is lost. A run abandoned or lost in its first waves pays almost nothing.
- audit: Removes the zero-progress session. Absorbed the aptitude wheel node: past a skill's cap the XP pays account caches. Round 1 review: min-maxer would gather, die and repeat on the easiest key; pay now scales with waves cleared.

## Season adds a material tier and resets the ladder
- id: season-adds-a-material-tier-and-resets-the-ladder | clock: season | role: source | verdict: keep-core
- About every three months: key levels and leaderboards reset, the mutator pool changes, and one new material tier with its recipes arrives, so last season's best gear is the entry gear for the new top tier. Town, trade skills, bags and mastery persist.
- audit: Model: without the season tier, late-season gear sales halve and regular players finish by week 7.

## Systems, not zones, carry the content load
- id: systems-not-zones-carry-the-content-load | clock: season | role: principle | verdict: keep
- Months of play should come from recombining arenas, mutators, key levels, recipes and the player market, with each season adding rules and materials instead of hand-built zones and story, so a small team can sustain the cadence.
- audit: Constraint on scope.

## Named elites drop recipe-specific parts
- id: named-elites-drop-recipe-specific-parts | clock: week | role: source | verdict: keep
- Each named elite and boss drops its own part, and each named weapon or bag recipe asks for a specific part, so a player who wants an item knows which enemy, biome and key level to farm, and breaking a boss's weak point mid-fight pays an extra part.
- audit: Turns 'I want that item' into a known target. Absorbed the elite-dropped crafting modifier node: an elite part can also guarantee one perk on the next merge.

## Deterministic floor, random ceiling on crafted perks
- id: deterministic-floor-random-ceiling-on-crafted-perks | clock: week | role: rule | verdict: keep
- A crafter can always choose the build-defining perk (the scarab ladder widens this from one to two chosen perks), but the last perk slot and the exact Gear Score roll stay random. Builds are never blocked by luck, and a perfect item stays rare enough to chase and sell.
- audit: Two opposing precedents agree on the middle. Absorbed the scarab ladder node: account progress widens the floor from one to two chosen perks.

## Raid materials are bound; crafters work on commission
- id: raid-materials-are-bound-crafters-work-on-commission | clock: week | role: social | verdict: defer
- Raid and top-key materials bind to the player who earned them, but any crafter can use a customer's bound materials through a town commission order with a fee, so the best gear needs both a raider and a master crafter and neither can be bought outright.
- audit: Depends on raids existing. Round 1 review: min-maxer showed commission output would be tradable gear made from bound materials; the output must bind to the customer.

## Reagents carry four hidden effects found by brewing
- id: reagents-carry-four-hidden-effects-found-by-brewing | clock: season | role: collection | verdict: keep
- Every herb, ore dust and creature part gathered in a run carries four effects from a fixed list of a few dozen (burn, chill, leech, haste, magnet, thorns and so on), hidden until the player brews two reagents that share one. Filling in the reagent book is a collection goal of its own.
- audit: Collection goal with a strong precedent.

## Alchemy makes flasks, oils and charms, not new items
- id: alchemy-makes-flasks-oils-and-charms-not-new-items | clock: session | role: sink | verdict: keep-core
- Brewing produces consumables only: flasks drunk between waves, weapon oils that last one expedition, and one-run charms for a socket. The wild effects live in things that get used up, so a broken combination burns itself out and permanent gear stays on the stat budget.
- audit: Model: consumables burning 25% of session yield lifted crafter income from 0.14x to about 1.0x a normal player and cut unsold stock from 3.3 to 1.2 weeks (held in 32 of 40 shaken runs).

## Up to three traits transfer from reagents
- id: up-to-three-traits-transfer-from-reagents | clock: season | role: depth | verdict: defer
- Reagents also carry quality and traits (potent, lingering, volatile); a brew keeps at most three, chosen by the player, and a brew can itself be used as a reagent, so a master alchemist chains crafts toward a best-in-slot flask.
- audit: A depth layer to add after the base brewing loop is proven.

## Volatile brews trade a big effect for a stated downside
- id: volatile-brews-trade-a-big-effect-for-a-stated-downside | clock: session | role: choice | verdict: prototype
- The strongest brews always pair their effect with a fixed, visible cost, the way many Brotato items lower one stat to raise another, for example double attack speed with no healing for the wave. That is how runs get wilder without raising the power ceiling.
- audit: The 'wilder without stronger' lever; needs play.

## Effect atoms are hand-authored and perceptibly distinct
- id: effect-atoms-are-hand-authored-and-perceptibly-distinct | clock: none | role: principle | verdict: keep
- Each effect on the fixed list must change what the player sees or does (a projectile that chains, a puddle that slows), not a number. Fewer, clearly different atoms that combine avoid the bland-blend problem of parameter-driven generation.
- audit: Constraint on alchemy content.

## Stat budget and simulated runs gate every recipe
- id: stat-budget-and-simulated-runs-gate-every-recipe | clock: none | role: process | verdict: keep
- Every recipe output is priced against a stat budget for its tier, and before shipping, scripted bot runs test each new effect pair for outliers in clear time and survival. Recipes that fail are retuned by a designer, never patched at runtime.
- audit: Constraint on alchemy content.

## Language models only draft tables at authoring time
- id: language-models-only-draft-tables-at-authoring-time | clock: none | role: process | verdict: keep
- If AI is used at all it is a designer's tool: proposing reagent-to-effect tables, flavour text and candidate effect pairs, which people then cut, name and balance. Players never see generated names or stats, and supply and prices come only from players and fixed rules.
- audit: Your stated boundary on AI.

## One to four player expeditions with shared waves
- id: one-to-four-player-expeditions-with-shared-waves | clock: session | role: social | verdict: defer
- The default session is solo or a party of up to four on one arena, each player with their own bag, shop and build; enemy count scales with party size and gathering nodes are shared, so one player can mine while others hold the line.
- audit: Round 1 review: producer would cut for lack of population; kept as deferred because the owner wants PvP and raids in the long run. (Before review: Keep, but after the solo minute is proven.)

## One survivor's extraction banks the party haul
- id: one-survivor-extraction-banks-the-party-haul | clock: session | role: rule | verdict: defer
- As in Catacombs, a party's bags are banked if at least one member reaches the exit after a boss; if nobody does, most of the unbanked haul is lost. Downed players can be revived only between waves.
- audit: Travels with co-op.

## Boss gate choice: push deeper or extract
- id: boss-gate-choice-push-deeper-or-extract | clock: session | role: choice | verdict: keep-core
- After each boss (every fifth wave) the party votes to extract with full bags or push on, where difficulty jumps and material tier rises. This puts the bank-or-push decision at a fixed, readable moment.
- audit: Model: the choice is interior for every skill level at 0% to 80% kept on death.

## Ten-player raid of three boss arenas with jobs
- id: ten-player-raid-of-three-boss-arenas-with-jobs | clock: week | role: goal | verdict: defer
- A raid is three linked boss arenas for ten players. Each has a mechanic that needs split jobs alongside damage: a gatherer crew feeding ore to a siege engine, a carrier running a relic while encumbered, a group holding a lane. Trade skills and bags matter inside the raid, not only weapons.
- audit: Round 1 review: producer would cut for lack of population; kept as deferred because the owner wants PvP and raids in the long run. (Before review: Long prerequisite chain: co-op, keys, roles.)

## Raid-exclusive perks and a bound crafting material
- id: raid-exclusive-perks-and-a-bound-crafting-material | clock: week | role: reward | verdict: defer
- Raids pay two things found nowhere else: a small set of perks and the bound material for the top crafted tier. Loot is not capped per week, but the capped upgrade currency limits how fast it turns into power.
- audit: Travels with raids.

## Key level thresholds open raid entry
- id: key-level-thresholds-open-raid-entry | clock: week | role: gate | verdict: defer
- Raid entry needs a cleared key at a set level in each of the raid's biomes, so the solo and small-group ladder is the attunement, and a raid group can read a stranger's readiness from their key history.
- audit: Travels with raids.

## Rival ghost builds invade as elites
- id: rival-ghost-builds-invade-as-elites | clock: week | role: social | verdict: keep
- Every extracted build is saved as a snapshot. On marked waves a rival snapshot of similar key level enters the arena as an elite using that player's weapons and charms; beating it pays PvP track XP, and the owner earns a little when their ghost wins. PvP without queues, netcode or griefing.
- audit: Cheapest PvP in the graph: no queue or live netcode.

## Seeded weekly race on identical waves and shops
- id: seeded-weekly-race-on-identical-waves-and-shops | clock: week | role: social | verdict: keep
- One weekly seed gives every entrant the same waves, shop rolls and mutators with a fixed loaner kit; rank is by deepest wave then time. Pure skill and build reading, cheap to run, and a natural spectator format.
- audit: Nearly free once waves are seeded.

## Equalized queue and scaled queue for live arenas
- id: equalized-queue-and-scaled-queue-for-live-arenas | clock: week | role: social | verdict: defer
- Live 3 vs 3 arenas come in two queues: equalized (perks off, fixed Gear Score, as in Outpost Rush Barebones) for new players and purists, and scaled (gear compressed toward a ceiling, perks and brews on) where crafted gear earns a small, bounded edge. First to three rounds, healing decays.
- audit: Round 1 review: producer would cut for lack of population; kept as deferred because the owner wants PvP and raids in the long run. (Before review: Real-time PvP in a top-down auto-shooter is unproven.)

## Opt-in lawless arena puts only the bag at risk
- id: opt-in-lawless-arena-puts-only-the-bag-at-risk | clock: session | role: social | verdict: defer
- An optional expedition type where several parties share one large arena with richer nodes. A downed player drops their unbanked bag for anyone to take; equipped gear and banked goods are never lost. Matchmaking uses loadout score brackets fixed at entry.
- audit: Round 1 review: producer would cut for lack of population; kept as deferred because the owner wants PvP and raids in the long run. (Before review: Needs population and bracket tuning.)

## PvP track pays the same tier as raids
- id: pvp-track-pays-the-same-tier-as-raids | clock: week | role: reward | verdict: keep
- All PvP, ghost fights included, feeds one reward track whose currency buys set pieces and charms of the same tier as raid drops, so a PvP player is never sent into raids for gear, and the reverse.
- audit: Works with ghosts alone.

## Company wars for town tax come last
- id: company-wars-for-town-tax-come-last | clock: season | role: social | verdict: defer
- Only once the population supports it: companies compete in a weekly scheduled fight for control of a town, and the winner sets its crafting and trading tax inside fixed limits and collects a share. This is the long-run goal that gives guilds a reason to exist.
- audit: Round 1 review: producer would cut for lack of population; kept as deferred because the owner wants PvP and raids in the long run. (Before review: Already marked as last.)

## Auto light attacks plus one aimed ability per weapon
- id: auto-light-attacks-manual-abilities-on-two-swappable-weapons | clock: minute | role: verb | verdict: prototype
- Light attacks stay automatic. Each of the two equipped weapons brings one aimed ability on a cooldown, and swapping weapons is the only rotation. More abilities are added only if the screen proves readable in a prototype.
- audit: Round 1 review: veteran counted 18 things to track per wave and producer costed six abilities at 3x; cut to one per weapon. (Before review: New World's combat finally enters the minute loop; whether aimed abilities fit a crowded screen needs hands.)

## Dodge and heavy swing share one stamina bar
- id: dodge-and-heavy-swing-share-one-stamina-bar | clock: minute | role: choice | verdict: prototype
- A dodge with brief invulnerability and a charged heavy swing both draw on stamina. The heavy swing breaks armour and shields and is also the strike that mines and fells, so defence, burst and gathering compete for the same bar every few seconds.
- audit: One resource ties fighting to gathering; needs tuning by feel. Not yet audited by anyone but its author.

## Weapon type decides what enemies drop
- id: how-you-kill-decides-what-you-collect | clock: minute | role: source | verdict: keep
- Each weapon family has a harvest property fixed at build time: blades skin hides, fire leaves ash and charcoal, frost leaves shards, hammers leave bone and ore dust. What a run brings home follows from the weapons merged, so the build is chosen partly for what the town needs.
- audit: Round 1 review: veteran and producer: automatic attacks on a 100-enemy screen take the finishing blow, so a per-kill choice is impossible and holding fire is un-fun. Moved to build time. (Before review: Pillar. Makes every kill a gathering decision; Doom Eternal proves the pattern at speed.)

## Enemy roles each demand a different answer
- id: enemy-roles-each-demand-a-different-answer | clock: minute | role: variety | verdict: keep
- The roster is built from roles, not stat tiers: shield-bearers need a heavy swing, swarms need area damage, spitters must be closed on, and burrowers attack gathering nodes. A wave is a mix of roles, and each route leans toward one, so no single build answers every route. First playable ships three roles.
- audit: Round 1 review: thief role removed with the bag-down rule; producer asks for three roles first. (Before review: Direct answer to the solved-build complaint; uses the existing behavior-tree nodes.)

## Pressure holds until the last third, then the build may break the wave
- id: power-never-outruns-the-wave | clock: session | role: principle | verdict: keep
- For the first two segments the player is always one mistake from trouble. In the final segment a finished build (an evolution, a completed set of triggers) is allowed to outrun the wave: the genre's payoff is kept, and it is earned.
- audit: Round 1 review: veteran and producer: the genre's reward is outrunning the wave, and the sim showed 0% easy runs at every skill level. (Before review: Constraint on tuning, taken from the best-reviewed game in the genre.)

## Gathering reshapes the arena
- id: gathering-reshapes-the-arena | clock: minute | role: choice | verdict: defer
- A felled tree lands as a barricade or a bridge, a mined rock face opens a tunnel or a choke point, cut reeds remove cover that hides spitters, and a drained ore vein leaves a pit enemies path around. What is harvested, and from which side, decides where the next fight happens.
- audit: Round 1 review: producer costed it at 4x the whole first playable with dynamic pathing in every arena; veteran called it real depth but least likely to ship. First test fixed arenas where gathering opens preset gates and removes cover. (Before review: Pillar. The single strongest precedent in the genre; cost is real terrain tech.)

## Struck nodes make noise that raises heat
- id: struck-nodes-make-noise-that-raises-heat | clock: minute | role: choice | verdict: prototype
- Every strike on a node adds to a visible heat meter that sets how many and which enemies arrive; rich nodes are loud. Heat cools while the player fights without gathering. The player, not a hidden system, sets how hard the wave gets.
- audit: Pillar. Greed buys danger by a rule the player can read; this is not adaptive AI. Not yet audited by anyone but its author.

## Carry weight slows by degrees
- id: carry-weight-slows-by-degrees-and-the-bag-can-be-set-down | clock: minute | role: choice | verdict: prototype
- Each unit carried trims speed and stamina regeneration a little, replacing the on-off encumbrance cap. Bigger crafted bags flatten the curve. The bag stays on the player.
- audit: Round 1 review: veteran: setting the bag down cancels carry weight, and thieves then exist only to punish the workaround. Both removed. (Before review: Reworks the bag-weight node: the model showed a hard cap flattens the push-or-extract choice.)

## Rich nodes sit where the danger is
- id: rich-nodes-sit-where-the-danger-is | clock: minute | role: choice | verdict: keep
- Common nodes are near the centre and open at once; the best veins and oldest trees sit at spawn edges or in elite territory and only surface during the swell. Each is marked from the start of the wave so the trip can be planned.
- audit: Round 1 review: tied to the swell so the lull cannot be used to strip the arena. (Before review: Cheap to build and makes every arena a small route-planning problem.)

## Gathering tools are build slots with combat perks
- id: gathering-tools-are-build-slots-with-combat-perks | clock: session | role: build | verdict: keep
- Pickaxe, axe, sickle and skinning knife are equipped items with their own perks that fire in combat: a felling strike throws splinters, a perfect mining hit staggers nearby enemies, skinning restores stamina. A gatherer build is a combat build.
- audit: Lets a player specialise in collecting without leaving the fight. Not yet audited by anyone but its author.

## One camp craft per wave: use it now or carry it home
- id: every-material-has-two-uses-power-now-or-progress-later | clock: session | role: choice | verdict: keep
- At each camp the player may make one recipe from their loadout using materials gathered this run: a weapon variant, a flask, a trap. It costs a fixed bundle of one material family and gives a discrete effect. Anything not used stays in the bag for town. It is a yes-or-no craft, not a spend slider.
- audit: Round 1 review: min-maxer broke the spend slider with one rule (spend everything for the first few waves, then bank), and producer noted it erased the two-material split. Now one discrete craft. (Before review: Pillar. The one decision that makes collecting matter inside the session and ties the run to the long game.)

## Recipe merges: weapon plus material makes a variant
- id: recipe-merges-weapon-plus-material-makes-a-variant | clock: session | role: converter | verdict: keep
- Besides merging two identical weapons, a weapon can be merged with a specific gathered material to become a variant: sword plus ember resin burns, bow plus sinew pierces, hammer plus ore dust quakes. Recipes are discovered by trying them and kept in a book.
- audit: Gives gathered materials an immediate, visible use and a discovery layer. Not yet audited by anyone but its author.

## Evolution needs a maxed weapon, an elite part and a boss chest
- id: evolution-needs-a-maxed-weapon-an-elite-part-and-a-boss-chest | clock: session | role: goal | verdict: keep
- A top-tier weapon holding the part of one named elite transforms when a boss chest is opened, changing how it attacks. It is the one moment per run where the screen-clearing fantasy is allowed, and it gives the run a plan from the first wave.
- audit: Round 1 review: kept; it is the earned breakout of the last third. (Before review: Proven chase structure; ties the elite-part node into the run.)

## Triggers on gather, on dodge, on swap make verb builds
- id: triggers-on-gather-on-dodge-on-swap-make-verb-builds | clock: session | role: build | verdict: prototype
- Charms and tool perks are written as triggers on the player's own verbs: on a perfect strike, on a dodge through an enemy, on a weapon swap, on setting the bag down. Stacking them builds a character around one verb, such as a miner whose every strike detonates.
- audit: The 'wilder' source that does not raise raw stats; needs a first set of ten to judge. Not yet audited by anyone but its author.

## Multiplying effects and an end-of-wave tally
- id: multiplying-effects-and-an-end-of-wave-tally | clock: session | role: feedback | verdict: keep
- A few effects multiply others instead of adding to them, and the end of each wave plays a short tally in which each source steps up and shows what it contributed in damage and materials. The player sees the build work and sees which piece is weak.
- audit: Cheap, teaches the build, and is the payoff moment the genre's best games stage. Not yet audited by anyone but its author.

## Exactly three decisions at camp
- id: fewer-bigger-choices-between-waves | clock: session | role: principle | verdict: keep
- The camp between waves holds three decisions and nothing else: one shop action (buy or merge) with run currency, one camp craft or none, and the route. Level-ups are automatic. Charms and recipes are set before the run; rule-bending picks come only at boss gates.
- audit: Round 1 review: veteran and producer both counted eight to nine camp actions against a stated limit of three. (Before review: Guards against the three-choices-every-45-seconds failure and protects flow.)

## Each wave has a lull, a swell and a peak
- id: each-wave-has-a-lull-a-swell-and-a-peak | clock: minute | role: pacing | verdict: keep
- A wave is scripted in three beats: a lull with few enemies where only common nodes are open, a swell where rich nodes surface and enemy roles mix, and a short peak announced by an alarm. Valuable gathering therefore always happens under fire; the lull is for cheap materials and positioning.
- audit: Round 1 review: veteran and producer: a safe lull made 'gathered under fire' meaningless because everyone would mine in the lull. (Before review: Gives gathering and fighting each a time to dominate inside one minute.)

## Route choice between kinds of ground
- id: route-choice-between-waves-with-rewards-shown | clock: session | role: choice | verdict: keep
- After the camp the player picks from two or three grounds that differ in kind: each has its own material family, leans toward one enemy role, and is good or bad for certain weapon types. The best route depends on the build and on what the town needs, not only on current health.
- audit: Round 1 review: auditor and min-maxer: 'take the rich route when healthy' solved it. Routes now differ in kind, so no route is best for every build. (Before review: Turns a fixed 20-wave line into a planned route; replaces the single arena critics fault.)

## Wave objectives beyond surviving
- id: wave-objectives-beyond-surviving | clock: minute | role: variety | verdict: keep
- Many waves carry one extra objective from a small set: hold a supply drop while it lands, escort a pack cart that collects dropped bags as it crosses the arena, break nests before they hatch elites, or bring down a named elite for its part.
- audit: Varies the same minute by context, which is the actual lesson of the Halo line. Not yet audited by anyone but its author.

## Shrine route: a priced curse for a named prize
- id: opt-in-curses-with-a-prize-shown-up-front | clock: session | role: choice | verdict: keep
- A shrine appears as one of the route options. It names its prize (a schematic from a stated list) and its price, which lasts to the end of the segment: lower maximum health, a locked weapon slot, or no camp craft. The price is set so that taking it is right for some builds and health states and wrong for others.
- audit: Round 1 review: all four reviewers: 'the prize is always better' made it a non-choice; the sim took it in 40 of 40 shaken runs. (Before review: Risk the player chooses; the Dead Cells lesson sets the reward rule.)

## Every strike and pickup is layered feedback
- id: every-strike-and-pickup-is-layered-feedback | clock: minute | role: feedback | verdict: prototype
- Each hit, felled tree and pickup gets several small answers at once: a short pause on impact, a kick of the camera, debris that stays, and a pitched sound that climbs as pickups chain. Materials fly to the bag with a count-up when a lull begins.
- audit: Feel cannot be judged on paper; it is also the cheapest thing to iterate in a prototype. Not yet audited by anyone but its author.

## Sound carries the threat and the reward
- id: sound-carries-the-threat-and-the-reward | clock: minute | role: feedback | verdict: keep
- No music during a peak: enemy ambience grows with their number and each role has its own call, so a player can hear a thief or a burrower before seeing it. Gathering has the richest sounds in the game, different for each material and location.
- audit: Two shipped precedents; also the readability layer a crowded screen needs. Not yet audited by anyone but its author.

## Provisional tuning targets for the session
- id: provisional-tuning-targets-for-the-session | clock: session | role: principle | verdict: keep
- Until there is a prototype: inside a wave the player should succeed at most individual actions (roughly five in six); a well-played run should usually be survived but often feel close; no single policy should beat the rest for every player; and a failed run should show the player what to change. These are starting points to be replaced by playtest data.
- audit: The literature does not agree on an optimal difficulty, so these are stated as provisional on purpose. Not yet audited by anyone but its author.

## A new pattern to learn every few hours
- id: a-new-pattern-to-learn-every-few-hours | clock: week | role: principle | verdict: keep
- Verbs, enemy roles, recipe families and mutators are introduced on a schedule so that the player meets something to learn every few hours for the first fifty, and every week after that, instead of meeting everything in the first session.
- audit: Koster's account of boredom, applied as a content schedule; also the answer to first-session overload. Not yet audited by anyone but its author.

## Rewards inform; they do not pay for attendance
- id: rewards-inform-they-do-not-pay-for-attendance | clock: week | role: principle | verdict: keep
- Weekly and per-session rewards are tied to something the player did well and say what it was; nothing is paid for logging in, there are no streaks, and missing a week costs nothing that cannot be earned back.
- audit: Guards the vault and every-session-pays nodes against the crowding-out effect. Not yet audited by anyone but its author.

## The player drives difficulty; nothing hidden adapts
- id: the-player-drives-difficulty-nothing-hidden-adapts | clock: session | role: principle | verdict: keep
- Every difficulty control is a visible choice inside play: heat from gathering, route picked, curse taken, key level run, depth pushed. No system reads the player's performance and quietly adjusts spawns.
- audit: Chen's argument, and the owner's stated dislike of AI steering the game. Not yet audited by anyone but its author.

## Schematics drop in runs and ride in the bag
- id: schematics-drop-in-runs-and-ride-in-the-bag | clock: session | role: source | verdict: keep
- Schematics come from named elites, shrine routes and boss chests, with each source owning its own list. A schematic is an item in the bag: it is lost with the bag on death unless extracted.
- audit: Round 1 review: thief mention removed. (Before review: Puts the collection inside the push-or-extract decision; the sim counts schematics in a run's value.)

## Three kinds: learned recipes, one-use patterns, town blueprints
- id: three-kinds-learned-recipes-one-use-patterns-town-blueprints | clock: week | role: structure | verdict: keep
- A recipe is learned for good and adds a merge variant, brew or charm to the player's options. A pattern is used up to craft one named item whose roll depends on the crafter. A blueprint raises a town station or unlocks a bag type and needs materials banked over several sessions.
- audit: Three shipped forms with different rhythms: permanent, consumable, long project. Not yet audited by anyone but its author.

## Known recipes decide what you can make inside a run
- id: known-recipes-decide-what-you-can-make-inside-a-run | clock: session | role: build | verdict: keep
- Recipe merges, evolutions and camp brews are only available in a run if the player has learned them. Two players on the same ground with the same drops have different options, and a new recipe changes how the next session is played, not just a number.
- audit: The link that makes a collection matter to the minute loop; options, not stats. Not yet audited by anyone but its author.

## Unlearned schematics are tradable; learned ones are not
- id: unlearned-schematics-are-tradable-learned-ones-are-not | clock: week | role: social | verdict: keep
- A schematic can be sold on the market until it is learned. Fighters who do not craft sell to crafters; collectors buy the ones their play style never drops. Patterns stay tradable, so a master crafter can be paid to use a customer's pattern.
- audit: Gives non-crafters something crafters want and gives the market a second good besides materials. Not yet audited by anyone but its author.

## Duplicates turn into fragments toward a missing schematic
- id: duplicates-turn-into-fragments-toward-a-missing-schematic | clock: week | role: pity | verdict: keep
- A duplicate of a learned schematic can be sold or broken into fragments; four fragments buy a random unlearned schematic from the same source list. The codex shows each source's list with silhouettes, so the player knows what is missing and where it drops.
- audit: Sim: with this rule a regular player's 13-week collection rises from 59% to 70% of 120; without it most drops in the late season are dead duplicates. Not yet audited by anyone but its author.

## Codex ranks and a new page each season
- id: codex-ranks-and-a-new-page-each-season | clock: season | role: progression | verdict: keep
- Filling the codex earns ranks that feed the mastery rank. Each season adds a page of schematics tied to that season's material tier and mutators, because a fixed list runs out.
- audit: Sim: a 20-session-a-week player with the fragment rule completes 120 schematics by week 7 and finds nothing new after week 8. Not yet audited by anyone but its author.

## Starting kits each bend one rule
- id: starting-kits-each-bend-one-rule | clock: season | role: variety | verdict: keep
- Twenty or more starting kits, unlocked over time, each with different stats, weapons and one rule change: a gatherer who cannot dodge but mines at double speed, a kit with one weapon slot that evolves twice, a kit that earns no run currency and crafts at every camp.
- audit: veteran: characters are the main reason Brotato lasts 500 hours, and the design had none.

## Recipe loadout: eight known recipes per run
- id: recipe-loadout-eight-known-recipes-per-run | clock: session | role: build | verdict: keep
- Before a run the player picks eight of their learned recipes. Only those can be crafted at camp and only their families matter, so each new recipe is a choice to slot, not one more item diluting a pool.
- audit: veteran: without a loadout every unlock dilutes the pool and collecting makes runs worse.

## Persistent gear sets the kit; the run supplies the power
- id: persistent-gear-sets-the-kit-the-run-supplies-the-power | clock: season | role: rule | verdict: keep
- Crafted, persistent gear decides which two weapon families, tools, charms and bag a run starts with, and at what perk quality. It starts every run at the lowest power tier; merges, crafts and evolutions inside the run supply the power.
- audit: veteran: the design never said whether crafted gear enters runs. If it brings power the build arc dies; if it brings nothing crafting is pointless.

## A run is twelve waves, three bosses, about 25 minutes
- id: a-run-is-twelve-waves-three-bosses-about-25-minutes | clock: session | role: structure | verdict: keep
- Three segments of four waves, each ending in a boss gate with the push-or-extract choice. The run saves at every camp so it can be left and resumed.
- audit: veteran and producer: the design read as 45 to 60 minutes and the sim's best play ended near wave 10 of 20.

## Six things to track in a wave
- id: six-things-to-track-in-a-wave | clock: minute | role: principle | verdict: keep
- A hard budget: position, health, stamina, one ability cooldown, heat, and the wave beat. Anything else a wave needs must replace one of these or be readable without attention, such as weight shown as movement speed.
- audit: veteran counted 18 against Brotato's three and called it unplayable.

## First playable: one arena, five waves, gathering on and off
- id: first-playable-one-arena-five-waves-gathering-on-and-off | clock: none | role: process | verdict: keep-core
- The first thing to build: one arena, five waves, automatic attacks, dodge, a heavy swing that also mines, ore nodes, the heat meter and three enemy roles. It is played against the same build with gathering switched off. If gathering under fire is not more fun than not gathering, the design stops here.
- audit: producer's build-first recommendation; the auditor found gathering worth 0 to 10% of run value in the first sim.

## Teaching order over the first five sessions
- id: teaching-order-over-the-first-five-sessions | clock: week | role: process | verdict: keep
- Session 1: move, automatic attack, hold to mine, one currency, shop; five waves, no loss. Session 2: dodge, stamina, heavy swing, merging. Session 3: the bag, the boss gate, losing the bag; town with one station. Session 4: the aimed ability, the camp craft, route choice. Session 5: heat, rich nodes, key level 1, the first schematic.
- audit: producer: as first written, 18 concepts arrived before the first wave ended and could not be taught.

## Depth pays in things that farming the first boss cannot give
- id: depth-pays-in-things-that-farming-the-first-boss-cannot-give | clock: session | role: rule | verdict: keep
- The second and third segments each have their own material family and their own schematic lists, needed for the upper recipe tiers, and key levels rise only on a full clear. Repeating the first segment yields none of these however many times it is run.
- audit: min-maxer: extracting at the first boss paid as much per wave as going deep. Sim v2: scaling yield with depth was a knife edge, either farming wins or always pushing wins, in 6 of 8 shaken runs.

## Waves run on a timer and nodes lock between beats
- id: waves-run-on-a-timer-and-nodes-lock-between-beats | clock: minute | role: rule | verdict: keep
- A wave ends when its clock does, as in Brotato, so the last enemy cannot be kited while the arena is stripped. Rich nodes close when the swell ends and during spawn pauses.
- audit: min-maxer: heat could be dodged by gathering in the post-peak pause, worth 16 to 22% in the first sim.

