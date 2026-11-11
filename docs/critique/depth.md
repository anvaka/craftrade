# Critique: combat and build depth

Question: how deep is a run of Scrip? Answered with the headless sim, not by
reading the design.

Short answer: **3 out of 10.** The run has one strategic axis. Buy every
weapon the bench shows, put every pick into offence, reroll until the slots
are full. Everything else I could force the bot to do is worse, and several
of the things the design is built around (gathering under fire, fusion,
weapon classes, defensive builds, the six characters) do not change the
outcome, or cannot be reached at all. What is good: movement matters, bench
choices matter a lot (8% to 63% between a random and a good buyer), and the
enemy roster asks for different dodges.

## 0. Method

Scripts are in `tools/exp/depth/`. Nothing under `src/`, `server/` or `tests/`
was edited. Raw runs are JSONL in `tools/exp/depth/out/`, one record per run;
`report.txt` there holds every table below in full.

| Script | What it does |
|---|---|
| `pbot.ts` | Copy of `src/sim/bot.ts` with a `Policy` object: movement mode, reaction time, gather mode, weapon and item filters, stat weights, buy and upgrade mode, reroll, lock, fusion mode, scrip reserve, mule share, free raws |
| `harness.ts` | Policy registry, instrumented run loop (per wave: damage taken, lowest HP, time at a node, damage taken at a node, kills, damage dealt, enemies alive; per bench: scrip, raws, offers affordable and blocked, purchases, rerolls, locks, legal fusions) |
| `verify.ts` | Checks the empty policy plays exactly like the shipped bot (30 runs, identical win, length, buy log, upgrade log, kills) |
| `recheck.ts` | The sim was edited by others at 13:10 UTC (relics). Replays 72 stored runs on the new sim: all identical, so runs before and after are comparable |
| `jobs.ts`, `worker.ts` | Run suites of (policy, character, seeds) jobs in parallel |
| `analyze.ts` | Reads the JSONL and prints every table |
| `fusion-space.ts` | Enumerates fusion outputs on the no-model path |
| `static.ts` | Content counts, weapon efficiency, set bonus size, price curve |

Seeds: `seed = s * 7919 + 13` for s = 1..N, the same as `src/sim/balance.ts`,
so every policy is played on the same seeds. N = 200 unless a table says
otherwise. 144 jobs, about 25,000 runs.

Limits:

- The bot is not a person. It reads telegraphs perfectly every 0.05 s and
  buys by a fixed formula. Differences between policies are the evidence;
  absolute win rates are not.
- 95% intervals are Wilson. With 200 seeds a win rate carries about +/-7
  points; two policies need to differ by about 10 to be told apart. The item
  kit test used 100 seeds: +/-10, differences under 14 are noise.
- Fusion was tested on the procedural provider and the bot's stand-in only.
  A live model could theme results better. It cannot change the budget rule.
- The machine was shared and overloaded, which is why some suites are 100 or
  150 seeds.

## 1. Build diversity

Script: `jobs.ts base` (shipped bot, 6 characters x 200 seeds), `stats`,
`kits`, `kitsRare`, `stack`; tables from `analyze.ts` sections 1a-1e.

### 1a. Archetypes among winners

Damage archetype = melee if melee weapons deal over 70% of weapon damage,
ranged if under 30%, else mixed, with a suffix if burn, burst, thorns, recoil
or shards deal over 20% of all damage. Effective number = exp(entropy).

| Character | Wins | Archetypes with >= 5% share | Effective number | Top archetypes | Weapon types held (of 6 slots) |
|---|---|---|---|---|---|
| greenhorn | 79 | 5 | 3.8 | mixed 52%, melee 15%, ranged 14%, ranged+burst 11% | 5.5 |
| sawyer | 98 | 3 | 3.4 | melee 44%, mixed 39%, mixed+burst 11% | 5.4 |
| smith | 81 | 4 | 3.7 | melee 44%, mixed 33%, mixed+burst 11% | 5.4 |
| trapper | 104 | 5 | 3.4 | mixed 57%, ranged 21%, mixed+burst 10% | 5.4 |
| tinker | 55 | 3 | 3.7 | melee 44%, mixed+burst 27%, mixed 22% | 3.7 (4 slots) |
| clerk | 47 | 5 | 4.1 | mixed 45%, melee 21%, ranged 17% | 5.4 |

This looks like 3 to 4 archetypes. It is one. Winners hold 5.7 weapons of
5.2 different types. The "archetype" is which weapons the bench happened to
show. Nobody wins with a chosen weapon build (section 2b). Of 464 winners,
35% hold 4 of a class and none hold 6.

### 1b. Weapons

| Weapon | Held at end: winners / losers | Share of winners' damage | Win if bought by bench 6 / if not (z) | Only this weapon: win | Copies held |
|---|---|---|---|---|---|
| hatchet | 59% / 52% | 8.7% | 42% / 38% (1.4) | 2% | 2.0 |
| pick | 55% / 49% | 8.5% | 41% / 40% (0.5) | 3% | 2.2 |
| knife | 56% / 60% | 6.3% | 39% / 42% (-1.2) | 2% | 2.2 |
| maul | 29% / 27% | 5.4% | 41% / 40% (0.3) | 2% | 1.4 |
| pike | 47% / 27% | 12.5% | 49% / 34% (5.1) | 1% | 1.6 |
| sling | 64% / 59% | 11.8% | 40% / 41% (-0.5) | 0% | 1.6 |
| bow | 57% / 48% | 12.5% | 44% / 37% (2.5) | 1% | 1.4 |
| musket | 28% / 26% | 4.8% | 42% / 40% (0.7) | 0% | 1.1 |
| axe | 40% / 32% | 7.2% | 45% / 37% (2.6) | 0% | 1.3 |
| brand | 30% / 38% | 3.7% | 35% / 43% (-2.7) | 1% | 1.6 |
| bola | 28% / 34% | 1.7% | 38% / 41% (-1.2) | 0% | 1.0 |
| buckler | 26% / 25% | 1.9% | 41% / 40% (0.2) | 0% | 1.2 |

"Win if bought by bench 6" is among the 1,153 runs that reached wave 7.

- Pike is the one weapon that predicts a win (+15 points, z 5.1). Bow and
  axe help a little.
- Firebrand lowers win rate (-8 points, z -2.7). Bola does 1.7% of damage
  for a slot. Buckler does 1.9%. Three of twelve weapons are dead.
- No weapon is dominant. That is because no weapon can be collected, not
  because the table is balanced: on paper the sling gives twice the damage
  per scrip of anything else (0.83 dps per base scrip against 0.20-0.60,
  `static.ts`).

### 1c. Stats

Each stat given as three free tier I picks at the start (150 seeds), against
40% with no gift. The standard error of a difference is about 6 points.

| Stat | Winners' share of picks | Win with 3 free picks | Points vs no gift |
|---|---|---|---|
| reach | 2.0% | 66% | +26 |
| melee | 14.6% | 56% | +16 |
| maxHp | 12.6% | 54% | +14 |
| rate | 14.7% | 54% | +14 |
| damage | 11.7% | 52% | +12 |
| speed | 7.6% | 51% | +11 |
| harvest | 1.2% | 51% | +11 |
| ranged | 6.8% | 49% | +9 |
| armor | 12.2% | 48% | +8 |
| crit | 4.3% | 47% | +7 |
| luck | 1.2% | 45% | +5 |
| mend | 1.8% | 43% | +3 |
| dodge | 9.1% | 39% | -1 |

- Dodge is dead: +9% dodge changes nothing, and the bot spends 9% of its
  picks on it. Mend and luck are inside the noise.
- Reach is the strongest stat in the game per pick and the shipped bot
  weights it 0.5, the lowest of all (`STAT_WEIGHT` in `src/sim/bot.ts`). The
  balance report therefore says reach is unwanted. It is the opposite.

### 1d. Items

Each authored item handed over as a free kit at wave 1 (100 seeds, baseline
38% on the same seeds, +/-14 for significance). A free tier 1 item is worth
about +9 points on average, so read each item against its tier.

| Verdict | Items (points vs no kit) |
|---|---|
| Strong | forgebellows +53, drillbrace +43, skippingstones +39, blastingkit +38, barbedquiver +37, emberjar +30, powderhorn +24, springsteel +20, factorseal +18, tallow +16, oilcloth +15 |
| Ordinary (+5 to +14) | hobnails, lodestone, surveyorglass, baitbag, fishhook, boilerplate, slate, hidebundle, saltpork, splint, tripod, quarrycharge, whetstone, saptap, timbersledge, coiledspring, gaffhook, rawhidegrip, pitch |
| Worth nothing for their tier | anvil +1 (tier 4), strongbox +1 (tier 3), horseshoe +4 (tier 3), moccasins +1, leadshot +1, prospectorpan +2, ballastbelt +3, burrs +4, fellingwedge +4 |
| Harmful as a free gift | tallybook -20, favourlist -13, rabbitfoot -3, smellingsalts -3 |

- The strong list is all rate, damage, burn, kill bursts, pierce and bounce.
  The dead list is all armor, dodge, interest, luck, hoards and thorns.
- Kill burst is the closest thing to a dominant effect: 87% of winners hold
  it against 62% of losers who died in wave 9 or later; burn 77% against
  45%. Buying a powder horn by bench 6 goes with a 60% win rate against 37%
  (z 5.9).
- The shipped bot never buys 12 of the 43 items (tallybook, burrs, fishhook,
  springsteel, smellingsalts, timbersledge, tripod, quarrycharge,
  coiledspring, favourlist, prospectorpan, factorseal). Three of those are
  good (springsteel +20, factorseal +18, fishhook +11). That is a bot fault,
  and it means `balance.ts` cannot be used to judge items.
- Tier 4 is almost never seen: 1% of 14,019 item buys.

### Dead content, in one list

Weapons: bola, buckler, firebrand. Stats: dodge, mend, luck. Items: anvil,
strongbox, horseshoe, moccasins, leadshot, prospectorpan, ballastbelt, burrs,
fellingwedge, rabbitfoot, smellingsalts, tallybook, favourlist. Primitives
that no winner build leans on: thorns, hurtBlast, interest, rerollCut,
hoardOre, hoardHide, hoardTimber, lowHpRate, stillDamage, richNodes, magnet.
Set bonuses: all four (a 6-set is worth 2.3 to 3.3 tier I picks and nobody
reaches it).

## 2. Forced strategies

Script: `jobs.ts strategies stack glass`; greenhorn, 200 seeds each.

| Strategy | Win | 95% CI | z vs default | Mean end wave | Verdict |
|---|---|---|---|---|---|
| Offence weights, no gathering, raws given (`glassNoGather`) | 78% | 71-83 | 7.7 | 11.0 | not a legal strategy; shows the ceiling |
| Offence weights (`glass`) | 63% | 56-69 | 4.7 | 10.4 | best legal strategy found |
| Offence weights, defence at zero (`glassPure`) | 59% | 52-66 | 3.9 | 10.4 | same |
| No mule (`nomule`) | 49% | 42-56 | 1.9 | 10.5 | viable |
| Shipped bot (`default`) | 40% | 33-46 | - | 10.4 | reference |
| Fusion in any mode (5 policies) | 40-42% | | 0.1-0.4 | 10.3-10.6 | no effect |
| Speed and dodge (`evade`) | 35% | 28-41 | -1.0 | 10.3 | viable, weaker |
| Offence weights, melee only (`glassMelee`) | 35% | 29-42 | -0.9 | 9.7 | viable, weaker |
| Gather as much as possible (`gatherMax`) | 32% | 25-38 | -1.7 | 9.9 | viable, weaker |
| Melee only (`meleeOnly`) | 30% | 24-37 | -2.0 | 10.0 | weak |
| Random upgrade picks (`randomUpgrade`) | 26% | 20-32 | -3.0 | 10.0 | |
| Tools and harvest first (`toolsHeavy`) | 25% | 19-31 | -3.2 | 9.5 | trap |
| Armor, HP, mend, dodge (`tank`) | 24% | 19-30 | -3.3 | 10.2 | trap |
| Slow hands, 0.3 s reaction (`every18`) | 23% | 18-29 | -3.6 | 9.9 | |
| Hold scrip for interest (`hoardLight`, `hoardFull`) | 14% | 10-19 | -5.8 | 9.0 | trap |
| Random purchases (`randomBuy`) | 14% | 10-19 | -5.8 | 8.9 | |
| Offence weights, ranged only (`glassRanged`) | 12% | 8-17 | -6.3 | 7.3 | trap |
| Thorns and defence (`thorns`) | 11% | 7-16 | -6.6 | 9.8 | trap |
| Ranged only (`rangedOnly`) | 10% | 7-15 | -6.8 | 8.0 | trap |
| Random purchases and picks (`randomAll`) | 8% | 5-13 | -7.4 | 8.4 | |
| No rerolls (`noReroll`) | 6% | 3-10 | -8.1 | 9.0 | |
| No items (`noItems`) | 6% | 3-10 | -8.1 | 9.9 | |
| Tools only (`toolsOnly`) | 5% | 2-8 | -8.4 | 8.2 | trap |
| Never gather (`gatherNever`) | 5% | 3-9 | -8.3 | 9.8 | trap (a gate, see 3) |
| No new weapons (`noWeapons`) | 1% | 0-3 | -9.8 | 7.7 | |
| Stand still (`afk`) / run laps (`circle`) | 0% | 0-2 | -9.9 | 2.0 / 3.2 | |

### 2b. One weapon type only

Greenhorn starts with the weapon and may buy no other (200 seeds each).

| | hatchet | pick | knife | maul | pike | sling | bow | musket | axe | brand | bola | buckler |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Win | 2% | 3% | 2% | 2% | 1% | 0% | 1% | 0% | 0% | 1% | 0% | 0% |
| Copies held at end | 2.0 | 2.2 | 2.2 | 1.4 | 1.6 | 1.6 | 1.4 | 1.1 | 1.3 | 1.6 | 1.0 | 1.2 |

Every one of the twelve fails, and for the same reason: the bench does not
offer the weapon often enough to fill six slots. 35% of offers are weapons,
20% of those repeat a held weapon. A run sees about two usable copies.
Stacking one weapon is the core build in Brotato. Here it cannot be done.

### What this says

- **One viable direction.** Offence weights beat the shipped bot by 23
  points and every defensive or economic direction loses to it by 10 to 50.
  Offence winners finish wave 11 with their lowest HP at 97% while holding
  24 max HP and -2.8 armor. Tank winners hold 55 HP and 11 armor and drop to
  48%. Killing first is the only defence that works.
- **Weapon restrictions only cost.** Melee only 30-35%, ranged only 10-12%,
  against 40-63% unrestricted. The reason is slot fill, not weapon quality:
  ranged-only winners deal the same damage per second in wave 11 (230) as
  everyone else. They just get there less often.
- **Thorns cannot work.** With thorns values tripled (still capped at 60 by
  `SPECIAL_CAP`) the thorns policy wins 15%. A wave 11 brute has 150 HP.
- **Interest cannot work.** The clerk's interest caps at 15 a wave, items at
  20, against an income of 150 a wave by wave 6 and 650-880 by waves 10-11.
- **Bench skill is real.** Random buying 14%, shipped formula 40%, offence
  weights 63%. Rerolling is not optional: 6% without it.
- **Execution skill is real.** A 0.3 s reaction costs 17 points. A player who
  ignores telegraphs dies by wave 3.

## 3. Does gathering matter

Script: `jobs.ts strategies` (`gatherNever`, `gatherMax`, `toolsHeavy`,
`toolsOnly`, `nomule`, `freeRaws`, `gatherNeverFreeRaws`). `freeRaws` tops
every raw up to 60 at each bench, so recipes and fusions are never blocked.

| Policy | Win | Raws gathered | Wave time at a node | Damage taken per second at a node / away | Deaths at a node | Purchases per run | Offers blocked by raws per bench (of 4) |
|---|---|---|---|---|---|---|---|
| Never gather | 5% | 13.5 | 1.3% | 0.21 / 0.27 | 1% | 19.2 | 3.0 |
| Shipped bot | 40% | 91.7 | 13.8% | 0.01 / 0.20 | 0% | 24.7 | 0.7 |
| Gather as much as possible | 32% | 158.7 | 26.4% | 0.04 / 0.22 | 1% | 21.3 | 0.2 |
| Tools and harvest first | 25% | 216.8 | 21.6% | 0.04 / 0.27 | 1% | 21.0 | 0.2 |
| Tools only | 5% | 174.6 | 17.3% | 0.06 / 0.26 | 1% | 14.8 | 0.1 |
| No mule | 49% | 92.2 | | | | | |
| Raws given, gathers as usual | 61% | 95.3 | 13.9% | 0.02 / 0.16 | 3% | 30.7 | 0.0 |
| Raws given, never gathers | 67% | 16.4 | 1.4% | 0.07 / 0.12 | 0% | 32.0 | 0.0 |

By wave, shipped bot, all six characters (1,200 runs):

| Wave | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Time at a node | 32% | 19% | 23% | 20% | 19% | 17% | 11% | 7% | 7% | 6% | 6% | 6% |
| Damage per second at a node | 0.03 | 0.05 | 0.02 | 0.01 | 0.02 | 0.01 | 0.00 | 0.02 | 0.09 | 0.05 | 0.02 | 0.04 |
| Damage per second away | 0.07 | 0.17 | 0.13 | 0.08 | 0.10 | 0.07 | 0.10 | 0.18 | 0.23 | 0.37 | 0.46 | 0.50 |

Findings:

- **Gathering is a toll, not a trade.** Without raws 3 of 4 offers are
  locked and the run dies (5%). With raws handed out the bot wins 61%, and
  67% if it also never touches a node. The only thing gathering does for a
  run is unlock the shop. Raws are the binding constraint: removing them is
  worth +21 points, more than anything except the offence weights.
- **"Work under fire" does not exist in the numbers.** Standing at a node is
  the safest place to be in every wave, 3 to 20 times safer than not
  working, and 0-1% of deaths happen there. The bot only walks to a node
  when it is quiet, but the bot that accepts crowds (`gatherMax`) still
  takes 0.04 a second at a node against 0.22 away. Nodes do sit 170-360 px
  inside a lane mouth, but weapons keep firing while you work, a node takes
  3 s, and a pack from the lane is fodder for the build that is standing
  there. The position costs nothing.
- **There is a real margin, and it is not danger.** Gathering 159 raws
  instead of 92 costs 8 points, and the cost is scrip left on the ground
  (level 12.9 against 14.9), not damage. Extra raws have no use in the run:
  winners on `gatherMax` end with 117 unspent.
- **Tools are a trap.** A tool slot is a weak weapon, and harvest only makes
  more of a resource that is already sufficient at 92 a run.
- **The mule is a real decision.** Sending half home after waves 4 and 8
  costs 9 points of win rate (40% against 49%). This is the one place where
  the take-it-home trade works as designed.

## 4. Does fusion matter

Scripts: `jobs.ts strategies matrix2` (fusion policies), `fusion-space.ts`.

| Policy (greenhorn, 200 seeds) | Win | Fusions per run | Benches with a legal pair | With an affordable pair |
|---|---|---|---|---|
| Fusion off | 41% | 0 | 66% | 30% |
| Shipped bot (stand-in result, half the benches) | 40% | 1.09 | 66% | 24% |
| Same, result from the procedural provider | 42% | 1.09 | 66% | 24% |
| Fuse only when the result is worth more to the bot than both parents | 41% | 1.36 | 66% | 21% |
| Fuse every affordable pair | 40% | 1.92 | 64% | 17% |

| Character (100-200 seeds) | Fusion on | Fusion off | z |
|---|---|---|---|
| greenhorn | 40% | 41% | -0.2 |
| sawyer | 52% | 54% | -0.3 |
| smith | 40% | 39% | 0.1 |
| trapper | 49% | 48% | 0.1 |
| tinker (free fusion, 3.3 a run) | 34% | 24% | 1.6 |
| clerk | 21% | 23% | -0.3 |

Fusion space on the procedural path (`fusion-space.ts`):

| | Generation 1 (authored x authored) | Generation 2 (with gen-1 outputs) |
|---|---|---|
| Legal pairs | 741 (of 903; 4 tier 4 items cannot fuse) | 269,004 |
| Distinct outputs | 717 | 143,551 |
| Distinct sets of positive primitives | 631 | 7,292 |
| Output tiers 1/2/3/4 | 47 / 323 / 326 / 21 | 91 / 3,836 / 63,221 / 76,403 |
| Effects inherited from a parent | 99.0% | 99.2% |
| A parent's positive effect is dropped | 24% | 36.5% |
| Net points out minus both parents | +1.2 on a mean of 32.4 | +3.1 on 63.4 |
| Pairs with a net gain of zero or less | 42% | 18% |

Two generations reach 143,979 distinct items and 7,314 of the 8,473 possible
sets of one to three primitives.

Findings:

- **Fusion has no effect on winning.** Five policies, 40% to 42%. A fusion is
  never the right call for the run and never the wrong one. Only the tinker
  shows a hint (z 1.6 at 100 seeds, not established).
- **The reason is arithmetic.** The 1.12 bonus is eaten by level rounding in
  `repairEffects`: a first-generation fusion returns +1.2 points on 32, and
  42% of pairs return nothing. For that it charges raws, which are the
  binding constraint, and it drops a quarter of the parents' effects without
  letting the player choose which.
- **The space is huge and flat.** 144,000 items in two steps, 99% of them
  recombinations of the parents' own effects. Big for the codex, empty for
  the build. Nothing in it is something the bench cannot already sell.

## 5. Characters

Script: `jobs.ts base matrix matrix2 glass`.

| Character | Win | Killed by (top 3) | Winners' damage (top 4) | Melee share | Winners' picks (top 4) |
|---|---|---|---|---|---|
| greenhorn | 40% | brute 31%, spitter 25%, mite 18% | sling 19%, pike 14%, burst 13%, bow 12% | 47% | rate, damage, maxHp, armor |
| sawyer | 49% | spitter 42%, brute 35%, mite 8% | hatchet 17%, pike 14%, burst 11%, axe 9% | 64% | melee, rate, armor, maxHp |
| smith | 41% | spitter 46%, brute 28%, mite 8% | pick 17%, pike 11%, burst 11%, maul 9% | 65% | melee, rate, armor, maxHp |
| trapper | 52% | brute 26%, spitter 24%, gnat 20% | bow 24%, burst 13%, sling 12%, pike 10% | 42% | rate, maxHp, damage, armor |
| tinker | 28% | spitter 39%, brute 30%, mite 11% | knife 17%, burst 15%, pike 14%, hatchet 8% | 69% | melee, rate, armor, maxHp |
| clerk | 24% | brute 30%, mite 23%, spitter 20% | sling 22%, burst 13%, pike 13%, bow 8% | 50% | rate, maxHp, damage, melee |

Total variation distance between two characters' winner profiles (0 the same,
1 nothing shared), against the noise floor from splitting one character's
seeds in half:

| Profile | Between characters | Noise floor |
|---|---|---|
| Damage sources | 0.07-0.26 | 0.09-0.14 |
| Upgrade picks | 0.02-0.13 | 0.06-0.11 |
| Item buys | 0.08-0.20 | 0.10-0.16 |

Win rate by strategy and character (default 200 seeds, other cells 100-200):

| Strategy | greenhorn | sawyer | smith | trapper | tinker | clerk |
|---|---|---|---|---|---|---|
| offence weights | 63% | 61% | 68% | 64% | 49% | 42% |
| shipped bot | 40% | 49% | 41% | 52% | 28% | 24% |
| melee only | 30% | 39% | 27% | 35% | 32% | 30% |
| tools and harvest | 25% | 42% | 28% | 36% | 29% | 12% |
| thorns | 11% | 15% | 18% | 20% | 17% | 13% |
| ranged only (sling start) | 10% | 9% | 3% | 19% | 24% | 1% |

Findings:

- **They are stat reskins.** Upgrade picks and item buys are inside the
  noise floor. Damage sources differ only by the starting weapon. The best
  strategy is the same for all six and the order of strategies is the same
  for five of six. No character makes a trap viable.
- **Two are simply worse.** Tinker wins 12 points less than the greenhorn:
  it gives up two slots for free fusion, which is worth nothing (section 4). The clerk gets an
  interest that caps at 15 scrip a wave and a damage penalty that breaks the
  game's first breakpoint (below).
- **The clerk's 24% is an accident.** The sling does 4 damage and a wave 1
  mite has 4 HP. At -8% damage that is two stones instead of one. Kills in
  wave 1 fall from 23.0 to 13.4 and the run never catches up.

| Run (200 seeds unless noted) | Win | Kills in wave 1 |
|---|---|---|
| greenhorn | 40% | 23.0 |
| greenhorn with -4% Damage | 19% | 13.4 |
| greenhorn with a free Tally book (-4% Damage), 100 seeds | 18% | 13.5 |
| clerk | 24% | 13.4 |
| clerk with the -8% cancelled | 45% | 23.0 |
| clerk with +1 Ranged | 38% | 23.0 |

A 4% stat change that halves the win rate is a balance cliff. Any item with a
damage drawback bought at bench 1 walks off it.

## 6. Decision quality at the bench

Script: `analyze.ts` section 6 on the base runs (1,200 runs, 11,363 benches).
"Worth it" = the bot's utility per scrip is over its buy threshold. "Real
choice" = two or more offers worth it and affordable one at a time, but not
together.

| Bench | Scrip in | Unspent on leaving | Blocked by raws (of 4) | Blocked by slots | Nothing worth buying | Real choice | Buy everything | Rerolls | Lock used |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 20 | 30% | 0.83 | 0.00 | 8% | 69% | 2% | 0.0 | 56% |
| 2 | 48 | 19% | 0.76 | 0.00 | 0% | 47% | 41% | 0.3 | 26% |
| 3 | 54 | 18% | 0.32 | 0.02 | 3% | 55% | 28% | 0.3 | 20% |
| 4 | 80 | 15% | 0.19 | 0.10 | 4% | 36% | 42% | 0.6 | 17% |
| 5 | 121 | 12% | 0.21 | 0.26 | 8% | 16% | 51% | 1.3 | 15% |
| 6 | 148 | 12% | 0.14 | 0.57 | 11% | 12% | 48% | 1.6 | 14% |
| 7 | 178 | 12% | 0.22 | 0.78 | 19% | 8% | 34% | 2.1 | 16% |
| 8 | 356 | 15% | 0.44 | 0.78 | 25% | 0% | 38% | 3.8 | 11% |
| 9 | 429 | 24% | 0.58 | 0.84 | 30% | 0% | 29% | 4.2 | 7% |
| 10 | 648 | 51% | 1.39 | 0.65 | 44% | 0% | 18% | 4.9 | 2% |
| 11 | 876 | 66% | 1.64 | 0.71 | 53% | 0% | 12% | 4.9 | 0% |

Findings:

- **Real choices end at bench 4.** Benches 1 to 3 have one about half the
  time. From bench 5 the common state is "buy everything worth having". From
  bench 8 a real choice never occurs.
- **Scrip stops mattering at wave 8.** Income doubles between waves 7 and 8
  (178 to 356) and prices rise linearly. Winners end holding a median of 896
  scrip; 32% of all scrip earned in a winning run is never spent.
- **The late shop is raw-starved and slot-blocked, not scrip-starved.** At
  benches 10 and 11, 1.4-1.6 of 4 offers are locked by raws and 0.7 by full
  slots, with 650-880 scrip in hand and nothing to turn it into.
- **Reroll is the main action, not a tool.** Five rerolls a bench late, and
  6% wins without it. Four offers are too few to build from, so the player
  pays to see twenty.
- **Lock is an early-game tool** (56% of first benches) and unused later.
- **Upgrade picks are a mild choice.** The second-best pick is worth 0.70 of
  the best by the bot's weights. Random picks cost 14 points; random buying
  costs 26.

## 7. Difficulty curve

Script: `analyze.ts` section 7 on the base runs; `afk`, `circle`, `noBuy`,
and the Old Tusk what-ifs (data table changed in memory, see `harness.ts`).

| Wave | Runs entering | Die here | Damage taken / max HP | Survivors below half HP | Survivors untouched | Damage dealt per second | Seconds of damage to kill a brute | Peak enemies |
|---|---|---|---|---|---|---|---|---|
| 1 | 1200 | 0.0% | 0.11 | 1% | 35% | 4 | 9.5 | 10 |
| 2 | 1200 | 0.8% | 0.32 | 19% | 15% | 8 | 6.5 | 21 |
| 3 | 1191 | 1.0% | 0.23 | 13% | 43% | 13 | 4.8 | 15 |
| 4 | 1179 | 0.8% | 0.15 | 5% | 53% | 18 | 4.0 | 23 |
| 5 | 1169 | 0.9% | 0.18 | 8% | 50% | 28 | 3.0 | 21 |
| 6 (stag) | 1159 | 0.5% | 0.12 | 4% | 58% | 31 | 3.0 | 18 |
| 7 | 1153 | 5.6% | 0.18 | 8% | 74% | 61 | 1.7 | 36 |
| 8 | 1088 | 4.5% | 0.30 | 20% | 42% | 95 | 1.2 | 65 |
| 9 (rotwood) | 1039 | 12.2% | 0.38 | 21% | 49% | 125 | 1.0 | 75 |
| 10 | 912 | 18.8% | 0.51 | 32% | 44% | 180 | 0.8 | 71 |
| 11 | 741 | 28.2% | 0.58 | 27% | 48% | 214 | 0.7 | 85 |
| 12 (Old Tusk) | 532 | 12.8% | 0.37 | 17% | 59% | 344 | 0.5 | 86 |

Killing blows: spitter 32%, brute 30%, mite 14%, boar 10%, gnat 7%, Old Tusk
3%, burrower 3%, stag 0%, rotwood 0%.

| What-if (greenhorn, 200 seeds) | Win | Win if wave 12 reached | Boss killed (of wins) | Median kill time |
|---|---|---|---|---|
| Shipped | 40% | 90% | 92% | 31 s of 90 |
| Old Tusk health x2.5 | 26% | 59% | 56% | 54 s |
| Old Tusk health x4 | 22% | 50% | 27% | 56 s |
| Offence weights, shipped boss | 63% | 98% | 100% | 20 s |
| Offence weights, health x4 | 37% | 58% | 76% | 53 s |

Findings:

- **Waves 1 to 6 cannot kill a competent player.** Under 1% die per wave and
  a third to a half of survivors are never touched. Wave 1 cannot kill
  anyone: a player who stands still survives it 200 times in 200. Wave 2
  (the first gnat cloud) is the only early wave with teeth (19% drop below
  half HP). That is five minutes of a thirteen-minute run with no threat.
- **The run is decided in waves 9 to 11.** 12%, 19% and 28% of entrants die.
  This is a cliff, and the build that reaches it was fixed by bench 4.
- **Old Tusk is a formality.** 87% of runs that reach him win, he is dead at
  28 s of a 90 s wave, and offence builds kill him at 20 s. Wave 11 is twice
  as lethal as the boss. He is also optional: 7% of wins outlast the clock.
- **The two elites kill nobody.** Stag 0%, rotwood 0% of killing blows.
- **Time to kill collapses.** A brute takes 9.5 s of all damage in wave 1
  and 0.5 s in wave 12. Enemy health is linear (x4 to x7 over the run) and
  damage dealt per second grows x80. The late game is about density, not
  durability.

## 8. Against Brotato

Brotato numbers are from memory of the shipped game and its wiki, to the
nearest ten.

| | Brotato | Scrip today | Gap |
|---|---|---|---|
| Characters | 60+, most rewrite a rule (one slot, no ranged, HP as currency, stat conversions) | 6, all stat offsets; none changes the best strategy | about 10x, and in kind |
| Weapons | 50-70 with 4 tiers | 12 with 4 tiers, 3 of them dead | 5x |
| Weapon classes | about 14, set bonuses that shape the build, stacking six of one weapon is the norm | 4, bonuses worth 1 to 3 tier I picks, a 6-set is never reached, stacking is impossible (0-3%) | system exists, does nothing |
| Items | about 180, many unique rules, limited copies | 43 authored, 13 worth nothing; plus a fusion space of recombinations | 4x |
| Stats | 16 primary, incl. lifesteal, elemental, engineering | 13, 3 dead | no second damage axis, no sustain axis |
| Damage axes | melee, ranged, elemental, engineering (turrets) | melee, ranged, plus burn and bursts from items | 2 of 4 |
| Waves | 20, plus endless, 6 danger levels | 12, one difficulty | no difficulty ladder |
| Enemies | 40+ incl. several elites and bosses, random elite and horde waves | 10, fixed order | 4x |
| Viable builds per character | several | one direction | the real gap |

Scrip has two things Brotato does not: nodes in the arena and item fusion.
Measured, neither changes a run. So today this is a Brotato with a fifth of
the content and one build, plus a toll.

Cheapest depth for the effort, in order:

1. Make the existing weapon and class system reachable (tuning only, no new
   content). Unlocks 4 class builds and 12 stack builds that are already
   authored.
2. Six to ten characters that are rule changes, as data in
   `src/sim/data/characters.ts`. The `slots`, `weaponPrice`, `carcassMul`
   and `freeFusion` hooks already exist.
3. Give defence a conversion into offence with three or four items. The
   primitives exist; the numbers do not.
4. Make fusion the only source of something. The relic effects merged at
   13:10 are the right shape; in-run fusion needs the same idea.
5. A second difficulty and a boss that is a check.

## 9. Score

**3 / 10.**

| For | Against |
|---|---|
| Bench choices move win rate from 8% to 63% | Only one direction is right: offence, every weapon offered, reroll |
| Movement matters (0.3 s reaction: -17 points; no dodging: dead by wave 3) | No weapon, class or defensive build is viable; stacking is impossible |
| The mule is a real risk trade (9 points) | Gathering is a toll; nodes are the safest place in the arena |
| Enemy kinds kill in different ways (spitter, brute, mite, boar, gnat all on the board) | Fusion changes nothing; characters change nothing |
| No single dominant item or weapon | Choices end at bench 4; scrip is irrelevant from wave 8; waves 1-6 are safe; the boss is a formality |

A 5 would need two or three directions that win at similar rates. A 7 would
need characters that change which one is best. Brotato is about a 9.

## 10. Ranked changes

Each line: the change, where, and the measurement behind it.

1. **Let a weapon build be assembled.** `src/sim/data/tuning.ts`:
   `SAME_WEAPON_BIAS` 0.2 and `SAME_CLASS_BIAS` 0.15; `rollWeaponOffer` in
   `src/sim/bench.ts`. Guarantee one offer per bench that repeats a held
   weapon, and raise the class bias to about 0.4. Then make `SET_BONUS` in
   `src/sim/data/weapons.ts` worth a build (today a 6-set is 2.3-3.3 tier I
   picks). Reason: one-weapon runs win 0-3% for all twelve weapons with 1.0
   to 2.2 copies held; melee only 30%, ranged only 10%; winners hold 5.2
   types in 5.7 slots; 0 of 464 winners reach a 6-set.
2. **Turn raws from a toll into a decision.** (a) In `buyBlock` and `buy`
   (`src/sim/bench.ts`), let scrip cover a missing raw at a steep price.
   (b) Make the node the dangerous place: `placeNodes` in
   `src/sim/world.ts` puts nodes near a lane mouth, but only the burrower,
   from wave 5, reacts to work, and `NODE_WORK` is 3 s. Start burrowers at
   wave 2, aim spitters and boars at a player who is working, and put the
   rich nodes (`RICH_CHANCE`, `NODE_WORK_RICH` 5.5 s) inside the lane mouth. Reason: raws given +21 points (40% to 61%), never
   gathering on top +6 more; damage at a node 0.01-0.09 a second against
   0.07-0.50 away; 0-1% of deaths at a node; benches 10-11 have 1.4-1.6
   offers locked by raws with 51-66% of scrip unspent.
3. **Give defence a way to win.** `thorns` values in `src/shared/vocab.ts`
   (8-60 flat) and `SPECIAL_CAP.thorns` 60 in tuning: scale thorns with
   Armor or with the hit taken. Buckler `scale.armor` 1.0 and maul
   `scale.maxHp` 0.2 in `data/weapons.ts` are the only conversions and they
   deal 1.9% and 5.4% of winners' damage: raise both and add two items that
   turn Armor or Max HP into damage. Consider not refilling HP at wave start
   (`startWave` in `world.ts`), which is what makes mend worthless. Reason:
   offence 63%, tank 24%, thorns 11% (15% with values tripled); dodge -1 and
   mend +3 points for three free picks; anvil, strongbox, horseshoe worth 0
   to +4 as free tier 3-4 items.
4. **Remove the wave 1 cliff, then rebalance the clerk on purpose.**
   `src/sim/data/enemies.ts` mite `hp` 4 to 3.5, or sling `dmg[0]` 4 to 4.5
   in `data/weapons.ts`. Reason: -4% Damage takes greenhorn from 40% to 19%;
   clerk 24%, 45% with the penalty cancelled; Tally book as a free item
   gives 18%.
5. **Make fusion pay or cut it from the run.** `FUSION_BONUS` 1.12 in
   `src/shared/vocab.ts` and the rounding in `repairEffects`
   (`src/shared/item.ts`). Either raise the bonus to about 1.4 and drop the
   parents' drawbacks, or give a fused item something the bench cannot sell
   (a fourth effect, or fusion-only primitives). Reason: 40-42% win with
   fusion off, on, smart or always; +1.2 points on 32 per fusion; 42% of
   pairs gain nothing; it spends the binding resource.
6. **Give the late bench something to decide.** `rerollCost` in
   `src/sim/bench.ts` (flat growth of `max(1, floor(0.4 x wave))` against an
   income that reaches 880) and `RARITY[4]` in tuning (cap 0.08 from bench
   8). Show 5-6 offers and make rerolls dear; raise the tier 4 cap to about
   0.25; add a scrip sink such as paying to raise a held weapon one tier.
   Reason: real choices 69% at bench 1, 16% at bench 5, 0% from bench 8;
   nothing worth buying at 44-53% of benches 10-11; 32% of scrip never
   spent; 6% wins without reroll; tier 4 is 1% of item buys.
7. **Flatten the wall and make the boss a check.** `data/enemies.ts` tusk
   `hp` 1500 and `hpW` 190: about x2.5 (kill time 28 s to 54 s). Pay for it
   by thinning waves 10 and 11 in `data/waves.ts` (mite every 0.6 and 0.5 s,
   brute every 3.8 and 4.5 s). Put one dangerous thing in each of waves 3 to
   5. Reason: 0-1% die per wave in waves 1-6; 12/19/28% in waves 9/10/11;
   87% of runs that reach the boss win; elites deal 0% of killing blows.
8. **Characters that change the rules.** `src/sim/data/characters.ts`.
   Replace the clerk's interest (cap 15 a wave, hoarding wins 14%) and the
   tinker's free fusion (worth 0) with rule changes, then add more. Reason:
   profiles between characters are inside the noise floor; best strategy is
   the same for all six.
9. **Cut or rework dead content.** Bola, buckler, firebrand; dodge, mend,
   luck; the thirteen items listed in 1d. Each fails the design's own rule
   that every stat must have a build that wants it.
10. **Fix the bot before trusting `balance.ts`.** `STAT_WEIGHT` and
    `SPECIAL_WEIGHT` in `src/sim/bot.ts`. Reason: offence weights +23
    points; reach is the best stat (+26) and has the lowest weight; 12 items
    are never bought, three of them strong; fusing the first two items held
    is noise. The 40% the report prints is a weak player's win rate.

## 11. Housekeeping

- A "work in progress snapshot" commit by someone else picked up 101 of my
  JSONL result files (about 62 MB) under `tools/exp/depth/out/`. I did not
  commit anything. I added `tools/exp/depth/.gitignore` for the rest. Before
  pushing, run `git rm -r --cached tools/exp/depth/out` and keep only
  `report.txt`, `static.txt` and `fusion-space.txt`.
- To reproduce: `npx tsx tools/exp/depth/jobs.ts all` (about 4 CPU hours),
  then `npx tsx tools/exp/depth/analyze.ts > tools/exp/depth/out/report.txt`.
