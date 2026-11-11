# Depth, after the rework

Follow-up to `depth.md` (score 3/10) and to section 1 of `fun.md` (novice
survival). Every number below was measured with the headless sim on the
same seeds as the first critique (`seed = s * 7919 + 13`, s = 1..N), Greenhorn
unless a row says otherwise, 200 seeds unless a row says otherwise. With 200
seeds a win rate carries about +/-7 points (95%); two rows need to differ by
about 10 points to be told apart. "Before" columns are the critic's published
numbers on the same seeds and the same bot.

Short answer: **6 out of 10.** Nine named ways to play now win between 30%
and 60%, a stack of one weapon or one class is reachable by wave 8, standing
at a node costs safety and pays for it, fusing well is worth about ten
points, and a new player no longer dies in wave 2. What is still short: the
late bench is still mostly "buy what is worth it", three melee-heavy builds
sit a few points above the 65% ceiling, the boss dies at 44 s instead of
50-70, two relics are over their +15 budget, and the expert bot with human
hands wins 14%, below the band the fun critic asked for.

## How to reproduce

| Script | What it does |
|---|---|
| `src/sim/bot.ts` | The bot now takes a `Policy` (what `tools/exp/depth/pbot.ts` used to be) and names every strategy in `POLICIES` / `STRATEGIES`. |
| `npx tsx src/sim/balance.ts 200 strategies` | The strategy table below, from the shipped code. `hazard` prints the ladder; `all` prints both after the per-character reports. |
| `tools/exp/depth/par.sh <dir> <seeds> <policy[@char]> ...` | Runs jobs across cores, one JSONL per job, one summary line per job. Policies take modifiers: `default+hz:3`, `tank+kit:anvil`, `default+stat:reach`. |
| `npx tsx tools/exp/depth/after.ts <dir> [wins curve bench build content]` | Every table here from the JSONL. |
| `tools/exp/depth/skill.sh 200` | The fun critic's three skill policies (`tools/exp/fun/`) on this tree. |
| `tools/exp/depth/maxima.sh <dir>` | Re-measures the server's report caps (`tools/exp/meta/maxima.ts`). |

## What changed, by system

1. **Early curve (fun.md 1.5, variant d, then more).** Base Max HP 16,
   0.75 s of grace on a hit and on a dodge, mite `hp 3.5 hpW 1.9 dmgW 0.45`,
   gnat `dmgW 0.4`, spitter 0.65, boar and burrower 0.7, lighter waves 1-2,
   spitters every 3.0 s at 170 px/s and sparser in waves 7/9/11/12. Damage
   taken is **no longer rounded** (`hurtPlayer`). The first offer of bench 1
   is always a weapon the player can pay for. 60% of scrip left lying at a
   wave's end is swept into the purse; base magnet 100.
2. **Difficulty moved late.** Ordinary enemies get a health multiplier that
   is 1 through wave 5 and 2.1 by wave 12 (`WAVE_HP`), and a damage one that
   is 1 through wave 6 and 1.6 by wave 12 (`WAVE_DMG`); spawn pace in waves
   7-12 is thinned 5-20%. Old Tusk 6,600 + 820 per wave (about 15,600).
3. **Weapon builds.** Copies are held side by side (no auto-combine while a
   slot is free) and each adds 4% damage to the others; combining twins is a
   bench action that frees a slot. Offer 1 is the rack: always a weapon, 55%
   one you hold, 35% one of a class you hold; other weapon offers 30% / 30%.
   Set bonuses roughly tripled and given a second stat; Shot sets pierce.
   **Tier up**: pay 80% of the next tier's price and one set of raws.
4. **Gathering.** From wave 3 work is loud (each unit of work calls 3 +
   wave/2 gnats from the nearest mouth, plus a burrower from wave 5, none
   carrying scrip), a hit taken while working lands twice as hard, and work
   left alone drains at 0.5/s. Rich nodes from wave 3, 8 raws, standing in
   the lane mouth. Any recipe's missing raws can be paid in scrip at
   2 + bench each, so a low-gather build is a real choice and not a toll.
5. **Fusion.** `FUSION_BONUS` 1.12 -> 1.4. `MAX_POINTS` stays **110**. Raw
   cost by tier cut to 1 / 2 / 4 / 6 raws, and each further fusion at the
   same bench costs one more set (so "fuse everything" pays for it).
   Recipes are still global and deterministic; tier 4 still cannot be fused.
   `RULESET` left at 1 on purpose (the server owns the recipe cache).
6. **Characters as rules.** Sawyer: each tool counts twice toward the Tool
   set; every other weapon costs 1.5x. Smith: tier up for a third less and
   no raws. Trapper: elites and brutes leave a carcass node; every node
   broken heals 2. Tinker: first fusion per bench free; 5 slots. Clerk:
   interest (now capped at 6 x wave, shared with items) and rerolls cost
   1.5x; the -8% Damage that made the breakpoint is gone, and the mite is
   3.5 HP so the sling's 5 kills it in one.
7. **Late bench.** Rerolls compound by 1.35x each; prices rise a tenth per
   bench past 6; a **commission** from bench 5 (a tier 3-4 item at 1.35x,
   kept through rerolls, not lockable); tier 4 cap 15%, tier 3 cap 30%.
8. **Content.** Firebrand wider and its burn (and all item burn) scales with
   Damage; bola pierces and slowed enemies take +25% from everything;
   buckler scales with Armor and Max HP. Thorns and the recoil blast grow
   with Armor; mend 0.25 + 0.14/point; a dodge grants full grace; Luck adds
   double-scrip chance. **Eleven new primitives** (conversions) in
   `vocab.ts`, each implemented in the sim and probed in
   `tests/sim-primitives.test.ts`. Items **43 -> 80**: 13 dead items
   reworked (ids kept), 37 new, nearly all with a cost or a condition.
9. **Hazard ladder** 0-5 in `createRun({ hazard })`, five named rules, shown
   on the pause panel.
10. **Bot and report.** `STAT_WEIGHT` re-set from the measured pick values
    (Reach 0.5 -> 1.2, offence up, Dodge and Mend down); conversion
    primitives are weighted by the stat they read; the bot buys stacks and
    sets, tiers up, combines, and fuses only when the result is worth more
    than both parents plus the cost. `balance.ts` prints the strategy table
    and the hazard ladder.
11. **Replay.** The sim step no longer calls `Math.sin`, `Math.cos` or
    `Math.pow` (`src/sim/trig.ts`, IEEE-exact arithmetic only), so a replay
    matches across engines. New bench actions are logged in
    `src/shared/replay.ts` as `["t", i]` (tier up) and `["k", i]` (combine).

## Target 1. Several strategies, none dominant

| Strategy (Greenhorn, 200 seeds) | Before | After | 95% CI |
|---|---|---|---|
| Default bot | 40% | **49.0%** | 42-56 |
| Offence weights | 63% | 42.5% | 36-49 |
| Melee only | 30% | 68.0% | 61-74 |
| Ranged only | 10% | 27.0% | 21-34 |
| Edge only | - | 65.5% | 59-72 |
| Blunt only | - | 66.5% | 60-73 |
| Shot only | - | 19.5% | 14-26 |
| One weapon: sling | 0% | 39.0% | 32-46 |
| One weapon: pike | 1% | 56.5% | 50-63 |
| Tools and gathering (`gatherer`) | 25% (toolsHeavy) | 61.5% | 55-68 |
| Gather everything (`gatherMax`) | 32% | 43.5% | 37-50 |
| Never gather, pay scrip for raws (`lowGather`) | 5% | 48.5% | 42-55 |
| Armor, HP, thorns, conversions (`tank`) | 24% / thorns 11% | 55.5% | 49-62 |
| Speed and dodge (`evade`) | 35% | 42.0% | 35-49 |
| Interest and held scrip (`economy`) | 14% | 33.0% | 27-40 |
| Luck and crit (`lucky`) | - | 62.0% | 55-68 |

**Met:** nine strategies between 30% and 60% (default, offence, sling stack,
pike stack, gatherMax, lowGather, tank, evade, economy); default 49% is in
45-60. **Short:** melee 68%, blunt 66.5% and edge 65.5% are a few points
over "about 65"; ranged and shot remain weak (27%, 19.5%), mostly killed by
gnats (75-78% of their deaths), which a ranged build cannot keep off.

## Target 2. Weapon builds reachable

At the bench after wave 8 (runs that got there):

| Build | Weapons held | Most copies of one weapon | Largest class |
|---|---|---|---|
| Default bot, before | - | about 2 (end of run) | 0 of 464 winners at 6 |
| Default bot, after | 5.9 | 2.0 | 4.3 |
| Sling only | 5.1 | **5.1** | 5.1 |
| Pike only | 5.0 | **5.0** | 5.0 |
| Edge only | 5.5 | 2.5 | **5.5** |
| Blunt only | 5.4 | 2.5 | **5.4** |
| Shot only | 5.6 | 2.3 | **5.6** |

**Met:** a player who wants one weapon or one class holds 5-6 of it by wave 8,
and those builds win 39-67% instead of 0-3%.

## Target 3. Gathering is a risk and pays

| | Before | After |
|---|---|---|
| Damage per second while working / away (default) | 0.01 / 0.20 | **0.34 / 0.21** |
| Same, gatherer build | 0.04 / 0.27 | 0.24 / 0.19 |
| Never gather | 5% | **48.5%** (scrip buys raws) |
| Tools and gathering build | 25% | **61.5%** (302 raws a run) |
| Gather everything, carelessly | 32% | 43.5% |

**Met:** working costs safety (1.6x the damage rate of kiting for the
default bot), a low-gather build wins well over 25%, and a build made for
gathering is rewarded. Greed is punished: the bot that works through crowds
wins 18 points less than the gatherer.

## Target 4. Fusion matters

| Policy | Before | After |
|---|---|---|
| Never fuse | 41% | 39.5% |
| Coin flip, first two items (old bot) | 40% | 39.0% |
| Fuse every affordable pair | 40% | 42.0% |
| Fuse when the result beats both parents and the cost (default) | 41% | **49.0%** |

**Met:** fusing with judgement is worth +9.5 points against never fusing,
and "always" (42%) is not best. Tinker without fusion: 32% (100 seeds)
against 55.5% with it. `MAX_POINTS` is **110**, unchanged.

## Target 5. Characters differ

| Character | Before | After (default bot, 200 seeds) | Best strategy found (100 seeds each) |
|---|---|---|---|
| Greenhorn | 40% | 49.0% | melee 68% |
| Sawyer | 49% | 62.5% | tank 62%, gatherer 61% |
| Smith | 41% | 55.0% | melee 60% |
| Trapper | 52% | 50.0% | melee 65%, tank 65% |
| Tinker | 28% | 55.5% | tank 71% |
| Clerk | 24% | 59.0% | melee 70%; economy 50% (33% on the Greenhorn) |

Strategy by character (100 seeds, Greenhorn at 200):

| | greenhorn | sawyer | smith | trapper | tinker | clerk |
|---|---|---|---|---|---|---|
| melee | 68 | 53 | 60 | 65 | 59 | 70 |
| ranged | 27 | 13 | 5 | 38 | 28 | 29 |
| gatherer | 62 | 61 | 50 | 54 | 55 | 61 |
| tank | 56 | 62 | 47 | 65 | 71 | 65 |
| evade | 42 | 50 | 44 | 34 | 45 | 49 |
| economy | 33 | 41 | 32 | 23 | 28 | 50 |

**Met:** all six default win rates lie within 13.5 points (49-62.5%), every
twist is a rule, and the clerk breakpoint is gone (59%). **Partly met:** the
rankings differ (ranged is best on the Trapper and nearly dead on the Smith,
whose -10% Speed loses the kite; economy is a real build only for the
clerk; Tinker and Sawyer lean tank), but melee or tank is the top build on
all six.

## Target 6. The bench to the end

Default bot, bench by bench (200 runs):

| Bench | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Real choice, before | 69% | 47% | 55% | 36% | 16% | 12% | 8% | 0% | 0% | 0% | 0% |
| Real choice among offers, after | 98% | 95% | 80% | 53% | 59% | 55% | 28% | 8% | 3% | 1% | 0% |
| Real choice counting tier-ups | 98% | 100% | 100% | 100% | 100% | 100% | 97% | 96% | 76% | 41% | 19% |
| Scrip unspent on leaving, after | 29% | 22% | 14% | 11% | 8% | 8% | 7% | 6% | 8% | 11% | 19% |

Scrip held at the end of a winning run: **25%** of scrip earned (before 32%);
most of it is wave 12's own income, which has no bench to spend at.

**Partly met.** Counting tier-ups as a way to spend, there is a real choice
at 96-100% of benches through bench 8, but it falls to 41% and 19% at
benches 10 and 11, and among offers alone choice still ends at bench 7.
Unspent scrip is under 15% at benches 3-10, not overall. The late economy
still outruns the late prices.

## Target 7. The curve

Share of entrants who die in each wave (default bot):

| Wave | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Before (6 characters) | 0.0 | 0.8 | 1.0 | 0.8 | 0.9 | 0.5 | 5.6 | 4.5 | 12.2 | 18.8 | 28.2 | 12.8 |
| After | 0 | 0 | 0 | 1 | 2 | 1 | 1 | 5 | 2 | 6 | 6 | 38 |

| Boss | Before | After |
|---|---|---|
| Pass rate of runs that reach it | 87% | **62%** |
| Median kill time (of wins that kill him) | 28-31 s of 90 | 44 s |
| Wins that kill him rather than outlast the clock | 92% | 80% |

The fun critic's skill tiers (`tools/exp/fun`, 200 seeds):

| Policy | Win before | Win after | Dead in waves 1-2 before / after | Reach wave 4 before / after | Median death wave before / after |
|---|---|---|---|---|---|
| novice (400 ms) | 0% | 0% | **94% / 0%** | 1.5% / **69.5%** | 2 / 4 |
| average (250 ms) | 0% | **10%** | 18.5% / 0% | 64% / 100% | 4 / 9 |
| expert bot, 250 ms late | 2.5% | 14% | 0.5% / 0% | 95% / 100% | 7 / 9 |
| expert bot (default) | 39.5% | 49% | 0.5% / 0% | 98.5% / 100% | 10 / - |
| Standing still | 0% | 0% (dies in wave 2 or 4) | | | |

**Met:** novice deaths in waves 1-2 0 of 200 (upper bound about 1.8%); a
first run reaches wave 4 70% of the time; the average policy wins 10%;
the wave 9-11 spike is gone (2/6/6% against 12/19/28%); the boss pass rate
is in 55-75%. **Not met:** the boss dies at a median 44 s, under the 50-70 s
band (raising his health further pushed the pass rate below 55% in
trials); the expert bot with 250 ms hands wins 14%, below the 50-65% the
fun critic wanted, because I put the difficulty back into waves 7-12 as
asked and that is exactly where slow hands lose (spitters and burrowers
are 57% of its deaths). The novice's main killer is now the gnats that work
calls from wave 3 (75 of 200 deaths): a novice stands on nodes.

## Target 8. Dead content

Each weapon's best share of winners' damage in any strategy: musket 10%
(ranged), bola 12% (shot), axe 18%, firebrand 18% (blunt), buckler 20%
(tank), pick 21%, knife 22%, bow 33%, maul 44%, hatchet 53%, sling 90%,
pike 99%. Before, bola, buckler and firebrand were under 2% everywhere.

Each stat's best share of winners' picks: mend 9% (tank), crit 11%, harvest
17% (gatherer), reach 18%, rate 19%, damage 20%, speed 20% and dodge 22%
(evade), armor 22%, maxHp 23% (tank), luck 25% (lucky), ranged 26%, melee
27%. Every stat now leads some strategy.

Items: 80 authored (25 / 25 / 20 / 10 by tier). In the best strategy for
each, 66 are held by at least 5% of winners. **Still under 5% in every
strategy:** lodestone, timber sledge, spring steel, miner lamp, smelling
salts, snare twine, work gloves, splint, rabbit foot, fish hook, tar bucket
(14 with three at exactly 5%). Part of this is dilution (each item is now
offered half as often), part is real: these were not re-tested as free kits.
Primitives: only `magnet` is held by under 5% of winners anywhere.

## Target 9. Hazard ladder

| Level | Rule added | Target | Default bot, 200 seeds | Max scrip earned | Max raws gathered | Max kills |
|---|---|---|---|---|---|---|
| 0 | - | 50% | 49.0% | 6,490 | 189 | 4,305 |
| 1 | Early elites (stag in wave 5, rotwood in wave 8, no scrip) | 38% | 42.5% | 6,067 | 193 | 4,468 |
| 2 | Lean nodes: every node holds 1 less | 28% | 31.5% | 5,863 | 136 | 4,519 |
| 3 | No rest: a new wave mends half of what is missing | 20% | 21.5% | 6,393 | 140 | 4,544 |
| 4 | Volleys: spitters spit three, each at 70% | 12% | 13.5% | 6,733 | 99 | 4,584 |
| 5 | Old Tusk gets up once at half health | 6% | 6.0% | 5,170 | 93 | 4,373 |

**Met** within the noise. For the server: higher levels do not raise scrip
or raws (raws fall), and kills rise at most 6.5%, so a slack of
`1 + 0.25 x hazard` is far more than needed; `1 + 0.05 x hazard` on kills
and none on scrip and raws would be safe.

## Target 10. The bot and the report

`STAT_WEIGHT` now follows the measured value of a pick (the critic's
three-free-picks test): Reach 0.5 -> 1.2, Damage and Rate 1.1 -> 1.3, Dodge
0.85 -> 0.65, Mend 0.75 -> 0.6. Specials that convert a stat are weighted by
how much of that stat the build holds. `balance.ts strategies` prints the
target 1 table from the shipped code, `balance.ts hazard` the target 9 one.

## Relics (re-measured, 200 seeds, kit of one relic)

| Relic | Before | After | Against 49.0% |
|---|---|---|---|
| Order book | +(-1.3) | 54.5% | +5.5 |
| Hide blind | +3.0 | 55.5% | +6.5 |
| Seed corn | +7.4 | 58.0% | +9.0 |
| Brandy flask | +13.4 | 68.0% | **+19.0** |
| Saddle scabbard | +10.0 | 64.0% | +15.0 |
| Company draft | +10.7 | 77.0% (tier-ups no longer covered) | **+28.0** |

**Not met for two relics.** The draft's rule (weapons at the bench need no
raws) is worth much more now that raws are scarcer and stacking means many
weapon buys; the flask is worth more with 16 base HP and no rounding. Both
need a rule trim or a rarer roll on the server side; I did not change relic
rules beyond keeping tier-ups out of the draft.

## Score

**6 / 10.**

| For | Against |
|---|---|
| Nine strategies win 30-60%; stacking and class builds work | Melee/edge/blunt sit just over 65%; ranged and shot under 30% |
| Gathering is a trade with a cost and a reward; never gathering is viable | The late bench is still mostly "buy what is worth it" after bench 9 |
| Fusion is worth about 10 points, and greed is punished | Boss median 44 s, not 50-70 |
| Characters are rules, within 13.5 points of each other, and reorder the strategies | Melee or tank still tops every character |
| A novice survives waves 1-2 every time and a learner can win (10%) | An expert with human hands wins 14% |
| A hazard ladder that falls 49 / 42 / 32 / 22 / 14 / 6 | Two relics over budget; about 14 items still unused |

A 7 would need the late bench to keep asking questions, the ranged builds
pulled up, and characters whose best build differs at the top.
