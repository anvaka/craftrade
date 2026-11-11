# Critique: the persistent layer ("how deep is the game?")

Reviewer brief: live-service economy and meta-progression review of everything
that survives a run: stash, kit, marks, Factor, listings, town project, fusion
codex, daily clearing, unlocks. Answers are from experiments against the real
server code, not from reading the design.

Short answer: **not deep. 3 out of 10 for long-term depth.** The authored goals
are finished at run 9. The one system that touches run power (the kit) is not
a nudge, it decides the run: the same bot goes from a 20% win rate to 92%.
Every currency inflates without a sink. The market has nothing to clear. First
finds never run out, so they stop meaning anything. And none of it is safe to
ship with a shared economy, because one device can mint about 180,000 marks an
hour with a two-line script.

The bones are good (the codex is a real idea, the ledger is honest, the
transactions are sound). The numbers and the goal structure are not there yet.

## 0. Method

All scripts are in `tools/exp/meta/`. Nothing in `src/`, `server/` or `tests/`
was changed.

| Script | What it does |
|---|---|
| `lib.ts` | In-process server (`createApp`, in-memory SQLite, controlled clock, procedural provider), bot runner, table printer |
| `career.ts`, `career-report.ts` | Experiment 1. One player, 100-150 runs, every step through the API: `run/start`, the sim bot on the ticket's seed, kit and stations, in-run fusion through `/api/fuse`, `run/end`, then town actions |
| `kitab.ts`, `buildsize.ts` | Experiment 1b. Same seeds and bot, four kits. Also writes the outcome pool used by `econ.ts` |
| `econ.ts` | Experiment 2. 10-1000 players, 30 simulated days, five strategies, all through the API |
| `fusion.ts`, `chains.ts`, `fusepop.ts` | Experiment 3. The procedural provider's item space, power creep, cheapest chains, first-find exhaustion |
| `exploits.ts` | Experiment 4. Real HTTP server, rate limits on, real clock |

Skill levels are the sim bot with a slower reaction and random mistakes:

| Skill | Bot re-decides every | Mistakes (a random 1/3 s walk) | Win rate, no kit |
|---|---|---|---|
| expert | 3 ticks | none | 42% (career, 100 runs) |
| average | 8 ticks | 6% of chances | 20-24% |
| novice | 16 ticks | 15% of chances | 0-5% |

Limits you should hold against these results:

- The bot is not a person. It gathers less than a person would (17-60 raws a
  run) and it hoards scrip on the last wave. Ratios between conditions are
  more trustworthy than absolute values.
- The machine was shared and heavily loaded, so samples are small: 60 seeds
  per kit cell, one 100-run career per skill and policy (three for expert
  optimal). Win rates carry roughly +/-10 points.
- The economy sim samples run outcomes from the bot pool (by skill and kit
  class) instead of replaying the sim, and its agents follow rules I wrote.
  What is measured is structure (who needs what, where currency goes), not a
  price forecast.
- The server was started as instructed but on port 8842: port 8802 was
  already held by an unrelated process on this machine. Provider was
  procedural throughout. No AWS credentials were used.

## 1. Career: what is left to want at run 10, 30, 100

### 1.1 Is the kit felt? It is the whole game

Same 60 seeds, same bot, only the kit changes (`kitab.ts`):

| Skill | Kit | Win rate | Waves cleared | Marks home | Raws home | Items home |
|---|---|---|---|---|---|---|
| average | none | 20% | 8.8 | 85 | 17 | 1.93 |
| average | two authored tier 2 (~37 pts) | 23% | 8.5 | 90 | 18 | 1.83 |
| average | two authored tier 4 (~138 pts) | 68% | 10.8 | 134 | 36 | 2.60 |
| average | two fused at the cap (~205 pts) | **92%** | 11.7 | 132 | 41 | 2.90 |
| novice | none | 0-5% | 5.8-6.1 | 45-47 | 8 | 1.1-1.2 |
| novice | two authored tier 2 | 7-10% | 6.8-7.2 | 62 | 9-12 | 1.4-1.5 |
| novice | two authored tier 4 | 48% | 9.0-9.1 | 116-120 | 19-22 | 2.0-2.1 |
| novice | two fused at the cap | **65-80%** | 10.6-11.3 | 123-133 | 24-29 | 2.5-2.7 |

(Novice rows are two independent batches of 60; the range is both.)

Context: a build that reaches wave 12 holds 14.2 items worth 282 item points
on average (`buildsize.ts`). A cap kit hands over 205 points, 73% of a finished
build's items, at wave 1. The research brief asked for 25-35% of end-of-run
power and "gear is a key, not a multiplier" (research-economy.md, section 4).
The build did neither.

Consequences:

- A player who cannot beat the game at all (novice, 0-5%) wins two runs in
  three by packing two items. Wins stop being evidence of anything.
- The kit also raises income: +55% marks and +110-140% raws per run for the
  average bot. Rich get richer.
- A weak kit (two tier 2 items) does nothing measurable. So the kit is either
  irrelevant or decisive, depending only on point total. There is no "sidegrade
  with a cost" middle.

### 1.2 Careers through the API

`optimal` = kit the two strongest items, fuse the stash upward in the workshop,
give all raws to the project, spend spare marks at the Factor on what the
project still needs. `naive` = kit the two strongest carried items, never fuse,
sell raws to the Factor. `nokit` = naive without a kit. Each career is alone in
its world.

Average skill, optimal policy (1 career):

| run | win% (last 10) | marks | raws | stash | kit pts used | station tiers (4-20) | finds | chars | features |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 91 | 15 | 1 | 0 | 4 | 1 | 1 | 1 |
| 3 | 67 | 406 | 81 | 4 | 143 | 4 | 4 | 2 | 2 |
| 5 | 80 | 525 | 47 | 6 | 143 | 4 | 6 | 2 | 4 |
| 10 | 70 | 17 | 75 | 7 | 173 | 6 | 18 | 6 | 4 |
| 20 | 100 | 4 | 185 | 17 | 152 | 10 | 47 | 6 | 4 |
| 30 | 90 | 0 | 76 | 27 | 152 | 13 | 74 | 6 | 4 |
| 50 | 90 | 13 | 321 | 44 | 171 | 17 | 126 | 6 | 4 |
| 75 | 50 | 1,040 | 1,962 | 63 | 152 | 20 | 190 | 6 | 4 |
| 100 | 90 | 3,315 | 5,129 | 89 | 146 | 20 | 240 | 6 | 4 |

Average skill, naive policy (1 career):

| run | win% (last 10) | marks | raws | stash | kit pts used |
|---|---|---|---|---|---|
| 3 | 100 | 807 | 0 | 9 | 68 |
| 10 | 80 | 2,323 | 0 | 22 | 146 |
| 30 | 70 | 6,491 | 0 | 62 | 73 |
| 50 | 60 | 10,031 | 0 | 101 | 70 |
| 100 | 100 | 18,588 | 0 | 197 | 109 |

All careers, summary:

| Skill / policy | Runs | Win rate | Marks per run | Raws per run | Items per run | Marks at end | Raws at end | Stash at end | Town maxed at run |
|---|---|---|---|---|---|---|---|---|---|
| expert / optimal (x3) | 150 | 94% | +87 | +143 | 2.94 | 9,226 | 17,632 | 161 | 40, 45, 46 |
| expert / naive | 150 | 85% | +118 | +56 | 2.85 | 28,454 | 0 (sold) | 330 | never (gives nothing) |
| expert / nokit | 100 | 42% | +102 | +32 | 2.30 | 16,221 | 0 (sold) | about 230 | never |
| average / optimal | 100 | 87% | +100 | +88 | 2.80 | 3,315 | 5,129 | 89 | 62 |
| average / naive | 100 | 74% | +114 | +43 | 2.61 | 18,588 | 0 (sold) | 197 | never |
| average / nokit | 100 | 24% | +82 | +21 | 1.94 | 12,800 | 0 (sold) | 194 | never |
| novice / optimal | 100 | 79% | +108 | +64 | 2.71 | 2,065 | 2,893 | 79 | 81 |
| novice / naive | 100 | 33% | +91 | +27 | 1.99 | 14,419 | 0 (sold) | 135 | never |
| novice / nokit | 100 | 3% | +46 | +10 | 1.19 | 7,262 | 0 (sold) | 119 | never |

The ledger audit passed in every career.

### 1.3 What is there left to want?

| At run | Already done | Still open |
|---|---|---|
| 5 | All four features (workshop, market, daily, town). Kit already at 143-173 points: the first win carries home three items, usually tier 4 | Four characters, the town, first finds |
| 9 | All six characters. No challenge was involved: unlocks come from run count | The town, first finds, a slightly better kit (138 -> 205 points) |
| 10 | Win rate is at its ceiling for the player's skill | Same |
| 30 | Solo town 5-12 of its 16 tier steps done. Nothing else has changed since run 10 | Town |
| 40-81 | Solo town maxed (expert 40-46, average 62, novice 81) | Nothing the game tracks |
| 100 | 2,000-28,000 marks and up to 17,600 raws with no use; 80-330 items in the stash | Nothing |

When does a player run out of goals? **Authored goals: run 9. Systemic goals:
when the town maxes.** After that the only thing that still changes is the
finds counter, and section 3 shows why that does not hold.

What is missing between run 10 and run 100 is anything that asks the player to
get better: no harder tier, no per-character record, no list of things not yet
done.

### 1.4 Faucets and sinks

| Resource | Faucets | Sinks | Verdict |
|---|---|---|---|
| Marks | Run payout (+82 to +118 a run), Factor sell, salvage | Factor buy (optional, only useful for the town), 2% listing fee, 5% sale tax | **No sink a player must use.** In the 10-player sim fees and tax destroyed 430 marks against 52,197 minted by runs: 0.8%. Marks held grew linearly to 63,634 by day 30 |
| Raws | Runs (+21 to +143 a run) | Town project (finite), Factor sell (turns raws into marks) | Finite sink. After the town maxes, `town/give` returns `no_project` and raws only turn into more marks. Expert optimal career: 17,632 raws idle at run 150 |
| Items | Carry home, 1.9-2.9 a run | Kit wear, at most 0.67 a run (2 slots / 3 charges); fusion (2 -> 1); salvage (voluntary) | **Supply is 3-4x what the kit can eat.** Stash grows by 1-2 items a run forever. Wear is also undone by fusing (exploit E13) |
| First finds | Any untried pair, 20 a day | none | Unbounded (section 3) |
| Standing | Giving | none; it buys nothing | A number |

Does anything inflate without bound? Marks, raws after the town is done, stash
size, and the recipe count. Is there a sink for every faucet? No: marks have
none that binds, items have one that is three times too small, and raws have
one that ends.

## 2. Many players: market, Factor, town

`econ.ts`, 30 days, runs sampled from the bot pool, five strategies: gatherer
30% (sells raws, lists spare items), fighter 30% (fuses up, gives half, shops
for kit upgrades with up to 30% of marks), trader 10% (buys anything under 0.6
marks a point to relist), fuser 15% (fuses everything, lists the output, gives
all raws), hoarder 15% (keeps everything, no kit). Half average skill, half
novice, 1-4 runs a day each.

### 2.1 Does the market have a reason to exist? No

10 players, 30 days, 540 runs:

| | |
|---|---|
| Listings posted | 296 |
| Sold | 124 (42%) |
| Taken down unsold after 3 days and salvaged | 160 |
| Sales where the buyer wanted the item for a kit | **0** |
| Sales to the trader, buying to relist | 124 (112 from gatherers, 12 from the fuser) |
| Trader's result | spent 705 marks, resold nothing |
| Median price | 0.21 marks per point: a 73-point tier 4 item goes for about 15 marks, when one run pays 85-130 |
| Sales priced above the seller's salvage value | 32 of 124 |

40 players, 30 days, 2,820 runs (a 100-player full sim did not finish on
this machine; see E15 for the likely reason):

| | |
|---|---|
| Listings posted | 2,267 |
| Sold | 2,004 |
| Sales to a fighter who used the item | **8** (fighters spent 35 marks each on the market in a month, out of 10,641 held) |
| Sales to traders | 1,996, of which 986 were one trader buying from another |
| Traders' result | spent 3,489 marks each, earned 1,725, ended holding 342 unsold items each |
| Median price | 0.21 marks per point from day 7 on (it opened at 0.7-1.5 and fell as unsold listings were repriced) |
| Sales priced above the seller's salvage value | 158 of 2,004 (8%) |
| Marks minted by runs / destroyed by fees and tax | 285,778 / 4,397 (1.5%) |
| Marks held, day 1 -> day 30 | 7,681 -> 331,192 |

More players did not make a market. They made more speculators passing the
same surplus around at the salvage floor.

Why nothing clears between players who would use the item:

1. Every player is a net producer of items. A run brings home 1.9-2.9; a kit
   can consume 0.67. The fighter's own stash always beat what was listed.
2. The seller has nothing to want marks for. Marks buy raws (for a project
   that gives standing, which buys nothing) or items (which the seller is
   long). So asking prices have no anchor, and they fell to the salvage floor.
3. The best items are made, not found: four cheap items fuse to a 103-point
   item for free in town (section 3.3). A buyer who can fuse never needs a
   seller.
4. Raws, the one thing players consume in bulk for the town, cannot be listed
   at all. The Factor's band is 4x wide (pays 0.5x, charges 2x the reference).
   Player-to-player raw trades would clear inside that band, and that is the
   market this game could actually have.

### 2.2 Factor price paths

Quotes are sell/buy in marks per unit, 10-player full sim:

| Day | Timber | Ore | Hide | Units sold to Factor that day (t/o/h) | Daily cap per raw |
|---|---|---|---|---|---|
| 1 | 2/12 | 3/16 | 3/14 | 32/20/26 | 1,500 |
| 5 | 1/8 | 2/12 | 2/10 | 74/61/75 | 1,500 |
| 10 | 1/4 | 2/10 | 1/8 | 220/76/110 | 1,500 |
| 20 | 1/4 | 1/7 | 1/8 | 131/93/76 | 1,500 |
| 30 | 1/5 | 1/7 | 1/7 | 115/81/61 | 1,500 |

The reference falls to its floor (base / 3) within about ten days and stays
there, because players sell and almost nobody buys. From then on the Factor
pays 1 mark a unit. A gatherer's whole haul (20 raws) is worth 20 marks against
100 from simply finishing the run. "Gatherer" is not a viable way to play:
gatherers ended the month with 4,130 marks against the fighters' 11,329 (10
players), and 6,189 against 10,641 (40 players, where the floor was reached on
day 2).

Band exploits, tested against the live server (E10):

- Round trip (buy 100 hide, sell 100 hide): lost 1,000 of 2,540 marks. With
  buy at 2x and sell at 0.5x of one reference, a round trip only profits if
  the reference rises more than 4x between the two legs. The clamp allows 9x
  (base/3 to base x 3) but moving it takes 1,465 units of net trade (drift
  0.0015 per unit) and the mover pays the spread on all of them. No solo or
  two-account arbitrage found.
- Cornering: one device sold 900 timber and the Factor refused all further
  timber from **every** player until UTC midnight; the timber quote went from
  3/12 to 1/4. The cap is 150 x active players, and "active" includes devices
  that only said hello. With forged raws this is a one-minute griefing tool.
- The daily cap never bound honest players (115-220 sold against 1,500).

### 2.3 The town project at 10, 100, 1000 players

Upper bound first: "town" mode, where every player except hoarders gives every
raw they bring home and does nothing else.

| Players | Runs in 30 days | Raws given | Station tier steps done (of 16) by day 5 / 10 / 20 / 30 |
|---|---|---|---|
| 10 | 540 | 9,762 | 1 / 3 / 6 / 10 |
| 100 | 7,620 | 153,829 | 2 / 5 / 9 / 13 |
| 1000 | 17,843 in 7 days (stopped at day 7 for memory) | 267,843 in 7 days | 2 / - / - / - ; 4 by day 7, the same as 100 players on day 7 |

With the mixed strategies (full sim): 5 of 16 steps in 30 days at 10 players, 8 of 16 at 40.

Reading:

- Targets scale with active players (`projectScale` = half of them), so the
  pace per head is nearly flat across population sizes: the full town costs
  2,025 raws per active player (4,050 per assumed giver). At the pool's 17-41
  raws a run that is 50-120 runs each **if everyone gives everything**. More
  than a month at two runs a day.
- The solo careers finished in 40-81 runs because they used strong kits and
  rising stations (expert: +143 raws a run by the end).
- So: too slow for the first two weeks (one step every 3-6 days while there
  is nothing else to chase), then permanently finished. Neither end is right.
- The target is fixed when a project starts, from players seen in the last 7
  days. Launch week projects are sized for a handful of players and fall in
  hours; after a spike they are sized for players who have left.
- "Active" counts any device that called `/api/hello`. 2,880 free devices a
  day from one IP inflate every future target (E9).

After every station is at tier 5: `GET /api/town` returns `project: null`,
`POST /api/town/give` returns 400 `no_project`, sale tax has nowhere to go,
standing stops, and raws have no use but the Factor at 1 mark each. Raw yield
is by then at its highest (+4 per node from stations). The game's only shared
goal ends, and the faucet it fed is left wide open.

## 3. Fusion as content

### 3.1 How big is the space

`fusion.ts` walks the procedural provider generation by generation
(generation n = items first reachable with n fusions):

| Gen | Pairs available | Pairs tried | New items | New items per pair | Still fusable | Tier 4 (finished) | Mean points | Points realised / budget |
|---|---|---|---|---|---|---|---|---|
| 0 (authored) | - | - | 43 | - | 39 | 4 | 21.1 | - |
| 1 | 741 | 741 | 718 | 0.97 | 697 | 21 | 33.7 | 0.92 |
| 2 | 269,739 | all | 143,972 | 0.53 | 67,191 | 76,781 | 65.4 | 0.94 |
| 3 | ~2.3 billion | 299,666 (sample) | 88,525 | 0.30 | 1,953 | 86,572 | 89.4 | 0.91 |
| 4 | (from the sample) | 299,684 (sample) | 30,165 | 0.10 | 97 | 30,068 | 92.0 | 0.90 |

- 741 authored pairs give 718 distinct items: almost no convergence.
- The second generation alone holds 144,000 items; the third has billions of
  recipes. The space will never be explored and never needs to be.
- The repair step leaves about 8% of the budget unspent, so the 1.12 fusion
  bonus is really about 1.03.
- `MAX_POINTS` = 110 is unreachable. Three effects at level 5 cost 102-106, so
  the practical cap is about 103. No item at 108+ was found among 193,442
  fused tier 4 items.

### 3.2 How fast are first finds used up, and does credit matter after week 1

`fusepop.ts`: real `/api/fuse` calls. 90% of players fuse 2-6 times a day from
what a run hands them (30% of the time with one of their own earlier results);
10% are hunters who work from a shared list and spend the whole allowance.
A second wave of players (20%) joins on day 8.

10 players:

| Day | Fusions | First finds | First % | Casual first % | Authored pairs found (of 741) | World recipes |
|---|---|---|---|---|---|---|
| 1 | 53 | 52 | 98 | 97 | 47 | 52 |
| 7 | 61 | 50 | 82 | 73 | 275 | 349 |
| 14 | 72 | 59 | 82 | 59 | 623 | 780 |
| 21 | 77 | 51 | 66 | 30 | 741 | 1,130 |
| 30 | 83 | 55 | 66 | 35 | 741 | 1,601 |

100 players:

| Day | Fusions | First finds | First % | Casual first % | Week-2 joiner first % | Authored pairs found (of 741) | World recipes | Top 10% share of finds |
|---|---|---|---|---|---|---|---|---|
| 1 | 548 | 477 | 87 | 80 | - | 387 | 477 | 42% |
| 2 | 546 | 377 | 69 | 51 | - | 655 | 854 | 47% |
| 3 | 566 | 322 | 57 | 33 | - | 741 | 1,176 | 51% |
| 7 | 560 | 317 | 57 | 33 | - | 741 | 2,399 | 58% |
| 8 | 657 | 364 | 55 | 30 | 26 | 741 | 2,763 | 59% |
| 14 | 651 | 363 | 56 | 30 | 25 | 741 | 4,970 | 62% |
| 30 | 657 | 339 | 52 | 24 | 24 | 741 | 10,629 | 65% |

1000 players (3 days only, for machine time):

| Day | Fusions | First finds | First % | Casual first % | Authored pairs found (of 741) | World recipes | Top 10% share of finds | Players with no find yet |
|---|---|---|---|---|---|---|---|---|
| 1 | 5,579 | 3,048 | 55 | 29 | 741 | 3,048 | 66% | 322 |
| 2 | 5,582 | 3,015 | 54 | 29 | 741 | 6,063 | 66% | 99 |
| 3 | 5,539 | 2,957 | 53 | 27 | 741 | 9,020 | 67% | 31 |

Two things happen and both are bad:

1. **The finds that matter are gone at once.** The 741 authored pairs are the
   ones every player meets at the bench. 1000 players finish them on day 1
   (a third of players end that day with no find at all); 100 players on day
   3; 10 players by day 21. A player who joins in week 2 will never name a recipe
   that anyone else sees.
2. **The finds that are left never run out, so they are worth nothing.** At
   day 30, one casual fusion in four is still a world first, for veterans and
   newcomers alike, because any pair with a second-generation item is new.
   120 players had stamped 10,013 items by day 30. Nobody will ever be handed
   an item with a stranger's name on it, which was the point of the stamp.
   The codex shows only your own recipes and the latest 50 in the world, so
   most of the book is invisible anyway.

First-finder credit therefore matters for about three days at 100 players,
and after that it is a counter that goes up when you press the button.
Hunters (10% of players) hold 65% of finds by day 30, at 20 a day each; the
daily limit is what sets the scoreboard, not ingenuity. And the limit is per
device, with free devices (E12b).

### 3.3 Power creep against authored items

Generation 1 fused items against authored items of the same tier:

| Tier | Authored | Authored points | Authored with a drawback | Fused (gen 1) | Fused points | Fused with a drawback | Fused above the authored maximum | Authored items strictly beaten by a fused one |
|---|---|---|---|---|---|---|---|---|
| 1 | 20 | 2-13 (mean 9) | 25% | 47 | 6-15 (mean 12) | 43% | 40% | 11 of 20 |
| 2 | 12 | 17-20 (mean 19) | 100% | 323 | 16-31 (mean 24) | 54% | 65% | 12 of 12 |
| 3 | 7 | 32-34 (mean 33) | 100% | 327 | 32-59 (mean 44) | 66% | 90% | 5 of 7 |
| 4 | 4 | 64-73 (mean 69) | 100% | 21 | 66-73 (mean 70) | 62% | 0% | 0 of 4 |

"Strictly beaten" = a fused item of the same tier has every positive effect
at an equal or higher level, no worse drawback, and more points.

- Tiers are bands 16 or 32 points wide and authored items sit at the bottom of
  each band. A fused tier 3 item averages 44 points against 33; 90% of them
  exceed every authored tier 3 item.
- Every authored tier 2 item is strictly beaten by something one fusion away.
- Authored items above tier 1 always carry a drawback ("a purchase is a
  trade"). A third to a half of fused items carry none.
- Across all generations, 193,442 fused tier 4 items were found: 72% are
  above 80 points and 9% above 100. The best authored item is 73.

### 3.4 Degenerate chains

Best result found by random search over fusion orders (`chains.ts`):

| Inputs | Best result | Bench scrip for the inputs | Raws if fused in a run | Raws in town | Steps |
|---|---|---|---|---|---|
| 2 x tier 3 | 73 | 95 | 19 | 0 | 32+34>73 |
| 2 x tier 3 + 2 x tier 1 | **104** | 122 | 43 | 0 | 10+33>48, 48+7>61, 34+61>104 |
| 4 x tier 2 | 96 | 109 | 43 | 0 | 18+20>43, 20+19>44, 44+43>96 |
| 5 x tier 2 | 103 | 137 | 55 | 0 | |
| 8 x tier 1 | 102 | 127 | 76 | 0 | |

For comparison an authored tier 4 item costs 88-98 scrip and about 8 raws for
64-73 points.

- Four ordinary items become a cap item (104 points, three level 5 effects).
  In town it costs nothing: no raws, no marks, no time.
- The rule that tier 4 is finished is the only brake, and it is avoided by
  keeping both halves under 64 points until the last fusion.
- Eight tier 1 items (2-13 points each) reach 102. Junk is as good as gold.
- **Fusing resets charges to 3.** A worn 63-point item plus a 2-point Tally
  book gave a fresh 68-point item (E13 shows it live with a 1-charge Drill
  brace). Below tier 4, kit wear does not exist for anyone who fuses.
- What cap items converge on (most common level 5 effects among 100+ point
  items): burn, bounce, pierce, kill blast, node burst. The procedural
  provider keeps what the parents had, so the space is wide in names and
  narrow in function.

## 4. Exploit hunt

Real server over HTTP, rate limits on, procedural provider. 16 devices, 1,016
seconds, 1,820 ledger rows. `server/audit.ts` reported "Ledger matches
balances" at the end: the ledger faithfully recorded 45,896 forged marks and
25,587 forged raws. The audit checks arithmetic, not truth.

| # | Attempt | Request | Result | Severity |
|---|---|---|---|---|
| E1 | Instant forged death | loop `POST /api/run/start {mode:"run"}` then `POST /api/run/end {wavesCleared:0, won:false, scripHeld:500, scripEarned:500, raws:{timber:30,ore:30,hide:30}, kills:600}` | Accepted every time. `minDurationMs(0)` is 0. 50 runs in 30 s on one device: +2,500 marks, +1,350 raws, all four features and all six characters unlocked in about 10 s. Sustained rate under the limiter (2 POSTs a second per device) is 1 run a second: **180,000 marks and 97,000-130,000 raws per device-hour**. An honest hour is about 400 marks and 150 raws. One device fills a 100-player town (202,500 raws) in about 100 minutes | **Critical** |
| E2a | Forged win at once | `run/end {wavesCleared:12, won:true}` 0 s after start | 400 `too_fast` | None |
| E2b | Forged 4-wave death at the bounds | `run/end {wavesCleared:4, scripHeld:2500, mule:{150,150,150}, carry:["anvil"], kills:3000}` 97 s after start | 200: +450 raws, +262 marks, an Anvil (tier 4) that was never offered. The mule bound makes the 30% death cut irrelevant. Any authored id is accepted as carried | **Critical** |
| E2c | Forged win at the bounds | `run/end {wavesCleared:12, won:true, scripHeld:6000, raws:{360,360,360}, carry:["forgebellows","factorseal",<fused tier 4>], fusions:[["strongbox","horseshoe",<id>]]}` 367 s after start | 200: +1,080 raws, +636 marks, three tier 4 items. The fused item was claimed by naming a known recipe; the inputs were never held. About 10 forged wins an hour per device: 29 tier 4 items an hour | **Critical** |
| E3 | Multi-device funnel | main: `market/list {uid:<anvil>, price:7030}`; feeder (marks from E1): `market/buy` | Main account 362 -> 6,899 marks. Price is unrelated to value; the 3-run listing gate is passed in 3 s with instant runs. A main account receives 93% of whatever free devices mint | **High** |
| E4 | Idempotency replays | `market/factor` twice with one key; same key, different body; same key on `market/list`; `town/give` twice; `run/end` twice | Factor replay returned the stored response, balance moved once. Changed body and cross-endpoint reuse: 409 `idem_reuse`. `run/end` replay: 409 `run_ended`. **`town/give` has no key: a retry gave twice** (timber 269 -> 259, standing +10) | Low |
| E5 | Bad numbers | qty -5, 0, 1.5, 1e308, "10", `NaN`, `1e999`; raw `__proto__`; price 0, -1, 1e9; negative raws; kit of 3; 70 KB body; 5,000-char token | All 400 `bad_request` (or a new device for the oversize token). A give of 99,999 of each raw took only what the project still needed. zod holds | None |
| E5b | Prototype keys as item ids | `POST /api/fuse {"a":"whetstone","b":"__proto__","ctx":"run"}` (also `constructor`) | **500 `server_error`**, `TypeError: effects is not iterable` in the log. `BASE_ITEM` is a plain object, so `getItem` returns `Object.prototype`. No state change | Low |
| E6a | Six devices buy one listing at once | `Promise.all` of 6 x `market/buy` | 200, then five 409 `listing_gone`. One sale, one item, seller paid once | None |
| E6b | Same item listed twice and packed as kit at once | 2 x `market/list {uid}` + `run/start {kit:[uid]}` | 200, 400, 400. No duplication | None |
| E7 | Abandon runs to shop for seeds | 5 x `run/start` with no kit, none ended; then end a superseded ticket | 5 tickets, 5 seeds, no cost, no cooldown, no loss recorded. Old ticket: 409 `run_void`. The seed is sent to the client and the sim is deterministic, so a client can simulate a seed and play only winners | Low now, Medium once replays are verified |
| E7b | Abandon with a kit | `run/start {kit:[uid]}` twice | Two charges gone, nothing gained. A page refresh mid-run costs the player a charge | Low (player-hostile) |
| E8a | Daily seed before the scored try | `run/start {mode:"practice"}` x2, then `{mode:"daily"}` | Same seed all three times; it is `fnv1a("daily:"+date)`, so it can be computed for any future day. Offline search, then one replay | Medium |
| E8b | Forged daily | `run/end {wavesCleared:8, won:true, scripEarned:4000}` on the scored ticket, 268 s after start | 200, rank 1. Also paid 424 marks and two tier 4 items. 4,000 is the bound (500 x 8), far above any real score, so the board becomes ties at 4,000 ordered by report time | **High** |
| E9 | Free devices count as active | 14 x `POST /api/hello` with no token | 9 issued, 5 refused (burst 10, then 1 per 30 s per IP: 2,880 a day; the limiter is in memory and forgets on restart). `activePlayers` 6 -> 15 with no run played. Project targets and the Factor's cap scale with it | **High** |
| E10 | Factor round trip and cornering | buy 100 hide, sell 100 hide; then sell timber until refused | Round trip lost 1,000 marks. After 900 timber: `factor_limit` for every player until midnight, quote 3/12 -> 1/4 | Medium |
| E11 | Wash trade for town progress | list high, second device buys | Works: tax x 0.5 becomes project units. 0.025 units per mark traded against about 0.07 per mark at the Factor, so it only matters because marks are free | Medium |
| E12 | First find without owning anything | `POST /api/fuse {"a":"strongbox","b":"horseshoe","ctx":"run"}` on a new device with no run open | 200 `first:true`, the item is stamped with that device's name for good. `ctx:"run"` is a lookup with no ownership or ticket check. It also reads out the whole recipe book | **High** |
| E12b | Novel limit under concurrency and per device | 30 untried pairs, 10 at a time, device with 0 runs | 20 firsts, 10 `novel_limit`. The limit holds per device. 38 free devices take all 741 authored pairs in about 15 minutes of hello calls | **High** |
| E13 | Fusing refreshes charges | kit a Drill brace twice (3 -> 1 charge), then `fuse {a:"drillbrace", b:"tallybook", ctx:"town"}` | New item with 3 charges. The item sink does not bind below tier 4 | **High** (design) |
| E14 | Name reroll, auth, unknown routes | 5 x `name/reroll`; no token; `POST /api/admin` | Five new names, free and unlimited (finder stamps and boards follow the current name). 401 `no_device`. 404 | Low |
| E15 | Idempotency store growth | measured in the 40-player sim (`SELECT COUNT(*), SUM(LENGTH(response)) FROM idem`) | Every keyed mutation stores its whole response (profile plus up to 200 listings) for 7 days; rows are purged only at process start. 9,012 records = 430.6 MB, 47.8 KB each. At that response size one device at the allowed 2 POSTs a second, trading 1 unit with the Factor each time, writes about 8 GB a day. A 100-player run of the harness ended when the kernel killed an 11.6 GB node process in its group (I did not confirm which process it was; the harness now clears the table daily) | Medium |

What held: input validation, transactions under concurrency, idempotency on
the market, the per-device novel limit under a race, the ledger's arithmetic.
The server is carefully written. It is the trust model that fails: the client
reports the run and the bounds are 8-20x wider than anything the sim produces.

Measured maxima across 480 bot runs, against the bounds in `config.ts`:

| | Bound | Largest seen |
|---|---|---|
| One raw, whole run | 480 (40 x 12) | 82 |
| All raws per wave attempted | 90 | 11.6 |
| Scrip held, 0-1 waves cleared | 500-1,000 | 50 |
| Scrip held, 4 waves cleared | 2,500 | 87 |
| Scrip held, 12 waves cleared | 6,000 | 2,625 |
| Kills per wave attempted | 600 | 261 |
| Time for a win | 366 s minimum | 490 s fastest, 511 s mean (waves only) |

Fixes are in section 8 (changes 1, 6 and 8).

## 5. Rarity: guidance for the chase items

Another engineer is building this; nothing here was implemented.

### 5.1 Drop rate against world supply

Expected drops a day = eligible runs a day x chance per run.

| Chance per run | 1,000 runs a day | 10,000 | 100,000 |
|---|---|---|---|
| 1 in 1,000 | 1 a day | 10 a day | 100 a day |
| 1 in 10,000 | 1 every 10 days | 1 a day | 10 a day |
| 1 in 100,000 | 1 every 100 days | 1 every 10 days | 1 a day |
| 1 in 1,000,000 | 1 every 2.7 years | 1 every 100 days | 1 every 10 days |

No fixed number is right at all three sizes. A "world event" wants about one
drop a week per world. So set the rate from the population:

- `RARE_TARGET_INTERVAL_DAYS = 7`
- chance per eligible run = 1 / (7 x mean eligible runs a day over the last 7
  days), recomputed at each day change, clamped to 1 in 2,000 at the generous
  end and 1 in 2,000,000 at the stingy end.
- At 1,000 runs a day that is 1 in 7,000. At 100,000 it is 1 in 700,000.

What a player sees: someone who plays 5 runs a day for a year (1,825 runs) has
a 23% chance at 1,000 runs a day, 2.6% at 10,000 and 0.26% at 100,000. At the
large end that is a lottery, which is what "golden chest" means, but it should
be said plainly in the game: the ledger should show the last finder, the date,
and how many exist.

### 5.2 Three rules before any number matters

1. **The server rolls it, never the client.** Today `checkReport` accepts any
   id in `BASE_ITEM` as a carried item (E2b). If the rare is an authored item,
   it is free to anyone with curl. Keep it out of `BASE_ITEM`; roll it in
   `endRun` from an HMAC of a server secret and the run id; add it to the
   stash server-side.
2. **Gate eligibility on things a forger cannot buy cheaply.** With E1 open,
   a 1 in 10,000 chance is one drop every 2.8 device-hours. Until replays are
   verified: full 12-wave runs only, wavesCleared >= 8, account at least 3
   days old with at least 10 paid runs, and one roll per account per 10
   minutes of real time.
3. **It must not add kit power.** Section 1.1: two items already move a
   novice from 5% to 65-80%. A stronger item finishes the job.

### 5.3 What the item should be

Follow the source of the idea. The Golden Steel chest was a schematic: a
tradeable recipe, consumed when learned, that let a crafter make a utility
item (storage) for sale. It was valuable without making anyone hit harder.
That maps directly onto "what persists is knowledge":

- The drop is a **pattern**, not an item. Unlearned, it can be sold once.
  Learned, it is bound to the account and listed in the codex with the
  finder's name and a serial number ("3 of 11 in this world").
- A learned pattern lets the holder craft the item at the workshop for a real
  price, for example 300 raws and 1,500 marks each. That is the marks and raw
  sink this economy lacks, and it makes the holder a supplier.
- The crafted item is a kit item with the normal 3 charges, tier 4 (finished,
  never fusable, so it cannot leak into the fusion space), at or below the
  current authored maximum of 73 points, built around **one effect that is not
  in the 37-primitive vocabulary and is not a stat**: for example "the mule
  also carries one item home", "carry one more item home", "the first reroll
  at each bench is free", "the bench shows a fifth offer". Sideways, not up.
- Ignored in the daily, like every kit.
- Three to five patterns at launch, each with its own roll, so there is more
  than one thing to hope for.

### 5.4 Tradeable?

Unlearned patterns: yes, once, but not through the present listing board.

- Marks have no sink, so any fixed price hits `LISTING.maxPrice` (100,000)
  and then the trade moves off-site for real money. Sell patterns by a 48-hour
  sealed-bid auction with a 10% burn, announced to the town.
- Do not open trading in patterns until run reports are verified (E1-E3). A
  forged-marks whale buying the first pattern in the world is the worst
  possible first event.
- Crafted items: tradeable as normal. Their price is bounded by craft cost.
- Learned patterns: never tradeable.

### 5.5 How other games handled it, and what failed

Web search was available but page fetches were not, so these are search
extracts and my own recollection; treat the numbers as rough.

- **New World, Golden Steel storage chest schematic.** Dropped from elite
  chests in level 50+ zones. Community sources disagree by orders of magnitude
  on the rate: one database analysis of the loot table gives about 0.00023%
  per roll with luck ignored; guides give about 0.165% from the furnishing
  package added in the December 2021 patch. Lessons: (a) a utility reward kept
  it out of combat balance; (b) adding a second, easier source later cut the
  value under people who had paid the early price; (c) New World's economy was
  repeatedly damaged by duplication bugs in late 2021 and trading had to be
  switched off, which is what a forged `run/end` is here.
- **Path of Exile, Mirror of Kalandra.** No official rate; community guesses
  are well under 0.001% per drop. It works because the item has a use (copying
  an item), because shards (20 make a mirror) give a slow sure path, and
  because leagues reset supply every few months.
- **Diablo 2, Zod rune.** About 1 in 5,171 of rune drops from the right
  monsters; the best single source is quoted near 1 in 3 million. Its rarity
  was real in single player and fictional online, where duplicated high runes
  became the currency. Rarity survives only as long as the item cannot be
  copied.
- **Old School RuneScape, 3rd age pickaxe.** Sources give odds from about 1
  in 31,000 to 1 in 313,000 per master clue. It mines no better than the
  dragon pickaxe. Pure prestige, tradeable, stable for years. The cleanest
  precedent for "rare, visible, not stronger".
- **Diablo 3 auction house.** Drop rates were tuned around trading, so playing
  felt worse than shopping; Blizzard closed it in 2014 saying it undermined
  the core game. If the best kit item is bought, the run is no longer where
  rewards come from.
- **Mounts that bind on pickup** (World of Warcraft's rare raid mounts, about
  1% as I recall): no economy risk at all, at the cost of no market story.

## 6. Meta depth against the comparators

| | Things to finish | How long it lasts | What the list looks like |
|---|---|---|---|
| Brotato | 6 danger levels (0-5), each win unlocks the next; 48 characters (62 with DLC), each tracked per danger: about 290-370 cells; items and weapons unlocked by named feats; endless mode | 100+ hours | A grid of characters with a danger badge on each |
| Vampire Survivors | An unlock list of a few hundred entries, each stating its condition; a collection page; secrets | 50-100 hours | A checklist you scroll |
| Balatro | 15 decks x 8 stakes = 120 cells; 150 jokers each with a stake sticker; challenge decks; a completion percentage | 100-300 hours; a player in the search results reports 290 for 100% | Stickers on every deck and joker |
| New World crafting | 17 trade skills with levels, gear score bands, schematics, station tiers per settlement | Hundreds of hours, much of it resented | Bars to fill; failed on RNG and chores, not on lack of goals |
| **Scrip** | 6 characters (all by run 9, by count, not by feat); 4 features (by run 5); 16 station steps (shared); a finds counter; days played | **About 2 hours of authored goals** (9 runs); the town is a month-long communal bar; nothing else | No list. Wins are a single number. The codex has no completion figure and cannot have one |

What is missing, in order of how much it hurts:

1. **A difficulty ladder.** The kit makes the base game a formality, and there
   is nowhere harder to take a good kit. The research brief recommended exactly
   this ("gear raises the tier you can enter; enemy scaling in that tier
   absorbs it") and the design dropped it.
2. **A record per character.** Six characters x "have I won with it, and how
   hard" is the cheapest grid there is, and the server does not store which
   character won.
3. **A collection log.** The game already records what would fill one (recipes
   made, items carried, standing) and shows none of it as "x of y".
4. **Titles.** Names are a surname and a number. There is nowhere to wear an
   achievement.
5. **A seasonal reset.** Everything in section 1.4 that inflates would be
   contained by one. DESIGN.md lists seasons under "later".
6. **Finite discovery.** 741 authored pairs is a fine collection. Billions is
   not a collection.

Honest placement: Balatro 9, Brotato 7, Vampire Survivors 7, New World's
crafting 5 (deep and unpleasant), **Scrip 3**. It gets 3 rather than 2 because
the fusion codex is a real, original hook and the shared town works as a first
month's goal. It would be a 6 with changes 2, 3, 5 and 7 below, none of which
needs new art or new sim systems beyond enemy scaling.

## 7. Score

**Long-term depth: 3 / 10.**

| Question | Answer |
|---|---|
| Goals run out | Authored: run 9. Systemic: when the town maxes (40-81 runs alone; over a month in a group) |
| Kit felt? | Too much: 20% -> 92% (average), 0-5% -> 65-80% (novice) |
| Inflation | Marks +82 to +118 a run with 0.8% burned; raws unbounded after the town; stash +1 to +2 items a run |
| Market | 0 use-driven sales in the 10-player month; prices fell to 0.21 marks a point |
| First finds | Authored pairs gone in 3 days at 100 players; after that 1 fusion in 4 is a "first" forever |
| Power creep | Fused cap item 103-104 points for 122 scrip of inputs, against 73 points for 88-98 scrip authored |
| Safe to ship shared? | No. 180,000 marks per device-hour |

## 8. Ranked changes

Names are as in the code today. Numbers are starting values from the
measurements above.

**1. Make run reports trustworthy (blocks E1, E2, E8; do before anything shared goes live).**
- `server/config.ts`, replace the flat `BOUNDS` with tables indexed by waves
  cleared, set at 1.5x the largest value the bot produced:
  `SCRIP_HELD_CAP = [75, 75, 80, 125, 135, 150, 275, 650, 1300, 2250, 3250, 3250, 4000]`
  (index = wavesCleared 0..12), `rawPerWave: 40 -> 12`,
  `rawTotalPerWave: 90 -> 18`, `killsPerWave: 600 -> 400`,
  and require `scripHeld <= scripEarned`.
- `minDurationMs`: add a floor of 10 s for any report, and
  `BOSS_WAVE_MIN_SECONDS: 15 -> 45` (the bot never killed the boss early: its
  fastest win was 490 s of waves; the server accepts 366 s).
- These caps come from one character and a bot. Re-measure with all six
  characters and with people before shipping, and treat an overrun as a flag
  for replay, not as proof.
- New `RUN_RATE = { perHour: 8, perDay: 60 }` paid runs per account.
- With those caps the instant death pays at most 7 marks and 5 raws and can
  be reported 8 times an hour: 56 marks an hour instead of 180,000.
- In-run fusions: add `runId` to `FuseReq` for `ctx:"run"`, require an open
  ticket owned by the caller, record `(run_id, key)` in a new `run_fusions`
  table, and have `checkReport` read that table instead of the client's
  `fusions` array. Also closes E12.
- Then replay verification: the client sends its input log, the server re-runs
  the sim (about 0.4 s of CPU a run). Verify every scored daily and every run
  that carries a tier 3+ item; sample 10% of the rest.

**2. Add a hazard ladder so a kit is a key, not a win button.**
- `RunStartReq.hazard: 0..5`. Per level: enemy health x (1 + 0.25h), enemy
  speed + 3%h, one extra elite from hazard 2, boss health x (1 + 0.4h).
- Payout: marks x (1 + 0.2h); authored tier 4 items can only be carried home
  from hazard 2 and up.
- New table `records(player_id, character, hazard, wins, best_seconds)`.
  A win at hazard n with a character unlocks n+1 for that character:
  6 x 6 = 36 cells.
- Tune with the bot so that a cap kit at hazard 3 wins about as often as no
  kit at hazard 0 (20-40% for the average bot).

**3. Give marks and raws something to be spent on, forever.**
- Town fusion costs what run fusion costs, times three, plus marks:
  `TOWN_FUSE_RAW_MUL = 3` on `FUSE_RAW_COST`, `TOWN_FUSE_MARKS = [0, 10, 25, 60, 150]` by output tier.
- Replace the charge refresh exploit with a priced repair:
  `POST /api/workshop/repair {uid}`, +1 charge for `4 x points` marks and
  `points / 4` of each raw, at most 2 repairs per item. A 100-point item costs
  400 marks a charge, about four runs of income.
- Salvage stays as is (it is small).

**4. Fix fusion so it stops outgrowing authored content.**
- `server/fusion.ts`: the output's charges = `min(charges of the two inputs)`,
  not `KIT_CHARGES`.
- `MAX_POINTS: 110 -> 80` (authored maximum is 73). `FUSION_BONUS: 1.12 -> 1.08`.
- `repairEffects`: when the budget is 48 or more and the picks carry no
  drawback, add one (level 2 of a stat the item does not raise). Authored
  items above tier 1 always have one.
- A third kit rule if the ladder (2) is late: `KIT_POINT_CAP = 80` across both
  slots, about 28% of a finished build.

**5. An almanac page (collection log) and titles.**
- Pages with "x of y": authored pairs you have fused (of 741), authored items
  carried home (43), weapons taken to tier 4 (12), enemies killed by type
  (10), characters won with (6), hazard cells (36), stations you gave to (4).
  `player_recipes` already holds the first; the rest need one counter table.
- Titles from finite feats, shown after the name ("Carter 412, sawyer of the
  fifth hazard"): about 20 at launch. `name/reroll` limited to once a week.

**6. Define "active" and "device" properly (E3, E9, E12b).**
- `activePlayers`: players with at least one paid run in the window, not
  `last_seen`.
- Untried pairs: `BASE_NOVEL_PER_DAY` applies only after 5 paid runs; before
  that, 3 a day.
- Listings: `price <= 40 x points x charges / 3`; buyers need 10 paid runs;
  `LISTING_MIN_RUNS: 3 -> 10`.
- `LIMITS.newDevice`: burst 3, then 1 per 10 minutes per IP, persisted.
- The Factor's cap: per player, 150 a day per raw, instead of one world pool
  that the first seller can drain.

**7. Keep the town alive after tier 5, and pace it.**
- `PROJECT_UNIT` halved (the first steps took 3-6 days in a group that gave
  everything) and `projectScale` recomputed daily instead of frozen at start.
- After the last station: repeating weekly "works" (a fair, a bridge, a
  beacon), target 300 raws x givers, each giving a one-week town effect
  (+5 untried pairs, or -1% sale tax) and a line in the almanac. Standing gets
  a use: it orders the vote on the next works.
- Add an idempotency key to `GiveReq`.

**8. Make first finds scarce again.**
- Count and display as "finds" only authored x authored pairs (741) and the
  first discovery of each finished (tier 4) item. Everything else is still
  stamped but does not move the counter.
- Show codex completion per player and for the world.
- A weekly "recipe of the week": the fused item carried home most often,
  with its finder named on the town page. That is credit other people see.

**9. Seasons of 8 weeks.**
- Reset marks, raws, stash, listings, station tiers and the Factor reference.
- Keep the codex and finder names, characters, titles, hazard records.
- Archive the season's givers and daily boards. Each season adds 6-10
  authored items, which reopens about 300-450 authored pairs.

**10. Let players trade raws, and stop the Factor being the only raw market.**
- Raw lots on the listing board: `ListReq` gains `{raw, qty}`; same fee and
  tax. The Factor's 4x band then acts as the floor and ceiling it was meant
  to be.
- `FACTOR.revert: 0.1 -> 0.25` a day so the reference does not sit on its
  floor for the whole month.

Also worth doing, small: null-prototype `BASE_ITEM` (E5b); purge `idem` rows
on a timer and store a short receipt instead of the full response (E15);
do not burn a kit charge until wave 1 is cleared (E7b); serve the daily seed
only on the scored ticket and derive it from a server secret (E8a).
