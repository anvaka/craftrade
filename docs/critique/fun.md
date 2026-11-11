# Fun critique: is Scrip playable, and is it sticky

Reviewer stance: thousands of hours of Brotato, Vampire Survivors, Halls of Torment, 20 Minutes Till Dawn.
Everything below is measured or read from code. Nothing in `src/`, `server/` or `tests/` was edited.

## Verdict

| | Score | One line |
|---|---|---|
| First-minute experience | **3 / 10** | Boots in 0.7 s and looks like nothing else, then kills a new player 29 s later. A player who never touches a key dies 9 s into wave 2. |
| Mid-run fun (waves 3-9) | **5 / 10** | Enemy behaviours are distinct and telegraphs are the best thing in the build, but only a frame-perfect bot gets to see them. Scrip stops mattering after wave 8. |
| Pull to replay | **4 / 10** | Restart is fast (2 presses), unlocks are steady, but the death screen is two ledgers of zeros, there is no personal best, and the whole carry-home loop needs wave 4, which novices reach in 1.5% of runs. |

The single most important number: **a novice dies in wave 2 in 94% of runs, and nobody below bot-level reactions ever wins** (0 wins in 800 runs across four human-like policies; the shipped expert bot drops from 39.5% to 2.5% when its inputs are delayed by 250 ms).

The game underneath is good. The difficulty curve in front of it is tuned for a player that does not exist.

## Methods

All scripts are in `/home/user/craftrade/tools/exp/fun/`. Raw outputs are in
`/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/out/` (one `.json` and `.txt` per policy and variant) and screenshots in
`/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/shots/`.

| Script | What it does |
|---|---|
| `policies.ts` | Player policies. All read only public run state, like `src/sim/bot.ts`. |
| `survival.ts` | Runs one policy over N seeds (same seed list as `src/sim/balance.ts`: `s*7919+13`), Greenhorn, 12 waves. Prints death-wave histogram and per-wave pacing. |
| `mkvariant.mjs` | Copies `src/sim` + `src/shared` to a scratch directory and applies literal patches, so constants can be overridden without touching `src/`. |
| `batch.sh` | Runs several policies in parallel against one sim root. |
| `feel.cjs` | Playwright, `play.html` on Vite dev (port 8804), 1280x720, deviceScaleFactor 1, keyboard only. First-run walk-through, frame sequences, mid-game stills, benches, phone. |
| `loop.cjs` | Playwright against the real built app on the game server (port 8803, `CRAFT_PROVIDER=procedural`): page load to control, idle death, death to next run. |

Policies:

- **novice**: sees the world 400 ms late, re-decides every 150 ms, eight keyboard directions. Walks at the nearest pickup, else the nearest node, stands in the ring. Runs from the nearest enemy for 1 s only after being hit. Bench: leftmost upgrade, first affordable offer top to bottom, no reroll, lock, fusion or mule.
- **novice+**: the same, but also backs straight off anything within 95 px. A bracket for "cautious first-timer".
- **average**: 250 ms late, re-decides every 100 ms. Keeps a gap to what is closing, steps off charge lines and out of slam rings it has seen, sidesteps spit, collects when quiet, works a node when fewer than 3 enemies are near it, flees below 40% HP. Bench: fills weapon slots (twins first), then cheapest items, one reroll, sends half the raws on the mule.
- **expert**: the shipped bot (`src/sim/bot.ts`), which re-decides every 50 ms with zero latency over 17 candidate directions.
- **expert-lag250**: the shipped bot with its output delayed 250 ms. Same brain, human hands.
- **avg-novbench / avg-expbench / expert-novbench**: cross-overs to separate movement skill from bench skill.

Caveats. The policies are models, not people. The novice is deliberately naive, so read novice and novice+ as a floor and average as "a genre player on run 5-10". Baselines are 200 seeds each; tuning variants are 100 seeds each (binomial 95% interval about +-10 points at 50%), because the machine was shared and heavily loaded. Baselines and variants a-c were run on the working tree before commit `32eee1c` (relics); variant d and a re-check of the novice baseline were run on a copy of HEAD `b6df934`. Relics only enter through a kit, and these runs carry no kit.

One harness note: `play.html` is not served by the built server (`/play.html` on port 8803 returns the town `index.html`). It only works through Vite dev, so I ran `npx vite --port 8804` alongside the game server.

## 1. Survival curve

### 1.1 Baseline (current constants, Greenhorn, 200 seeds each)

| Policy | Win | Dead in waves 1-2 | Reached wave 4 | Reached wave 5 | Reached wave 7 | Median death wave |
|---|---|---|---|---|---|---|
| novice | 0.0% | **94.0%** | 1.5% | 0.0% | 0.0% | 2 |
| novice+ | 0.0% | **87.0%** | 4.5% | 0.5% | 0.0% | 2 |
| average | 0.0% | 18.5% | 64.0% | 36.5% | 12.5% | 4 |
| avg-novbench | 0.0% | 19.0% | 62.5% | 30.0% | 3.5% | 4 |
| avg-expbench | 0.0% | 18.5% | 67.0% | 42.5% | 16.0% | 4 |
| expert-novbench | 6.0% | 0.0% | 99.0% | 99.0% | 91.0% | 9 |
| expert-lag250 | **2.5%** | 0.5% | 95.0% | 87.5% | 72.0% | 7 |
| expert | 39.5% | 0.5% | 98.5% | 96.0% | 95.0% | 10 |

Deaths by wave:

| Policy | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| novice | 0 | 188 | 9 | 3 | | | | | | | | |
| novice+ | 0 | 174 | 17 | 8 | 1 | | | | | | | |
| average | 0 | 37 | 35 | 55 | 21 | 27 | 23 | 1 | 1 | | | |
| expert-lag250 | 0 | 1 | 9 | 15 | 23 | 8 | **81** | 10 | 22 | 8 | 10 | 8 |
| expert | 0 | 1 | 2 | 5 | 2 | 0 | 9 | 10 | 14 | 32 | 37 | 9 |

Killers: novice mite 153, gnat 42. Average mite 74, spitter 51, boar 29, gnat 19, stag 14. Expert-lag250 **spitter 91**, burrower 34, brute 23. Expert brute 37, spitter 30, mite 22.

Against the targets:

| Target | Measured | Gap |
|---|---|---|
| Novice almost never dies in waves 1-2 | 87-94% die there | Off by an order of magnitude. This is the emergency. |
| Novice usually reaches wave 4-6 on a first run | 1.5-4.5% reach wave 4 | Median death is wave 2. |
| Novice wins after roughly 5-15 runs of learning | The "learned" proxies (average, expert-lag250) win 0% and 2.5% | A player with human reactions needs something like 40 runs at expert decision quality. |
| Expert wins 50-70% with the starting character | 39.5% | 10-30 points low, and "expert" here means zero latency. |

### 1.2 Why wave 2 is a wall

Four constants stack up in the same 25 seconds:

1. **The sling stops one-shotting mites.** Mite health is `hp 4, hpW 2.2`: 4 in wave 1, 6.2 in wave 2. The sling does 4. Wave 2 asks for about 10.5 damage per second (`2 mites / 1.5 s` x 6.2 hp, plus a gnat pack of 8 every 8.5 s) and one sling gives 7.3 with perfect aim. Without a second weapon the pile only grows.
2. **Half of novices cannot buy that second weapon.** Scrip at bench 1 averages 19 (novice) to 22 (expert); tier 1 weapons cost 10-23 there and several need raws. Novices start wave 2 with 1.5 weapons on average.
3. **Mite damage doubles.** `dmg 1, dmgW 0.85` gives 1.85, and `hurtPlayer` rounds it to 2. Wave 1 costs the novice 2.8 HP; wave 2 costs 12.0 (8.0 hits) against 11 HP.
4. **Gnats arrive at 3 s** (`g('gnat', 8.5, 8, 0.12)`), at speed 191 against the player's 215, in a pack of 8 that a sling needs 4.4 s to clear.

The do-nothing test in the real client confirms it. A player who presses one key to start and then nothing dies at **0:29**, 8.9 s into wave 2, with 25-30 kills (`/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/shots/c05-end-screen.png`). From memory, and not measured here: an idle player in Vampire Survivors lasts well over a minute, and in Brotato clears wave 1.

### 1.3 Why reaction time decides everything after wave 6

Delaying the expert bot's inputs by 250 ms takes it from 39.5% to 2.5%, and 81 of its 195 deaths are in wave 7. Bench skill matters too (expert movement with novice buying wins 6%), but movement latency is the bigger lever.

Wave 7 is `g('spitter', 3.5, 2, 0.1)`: 26 spitters over 45 s. They hold at 250-400 px, auto-aim prefers nearer targets, so they accumulate, and each spits every 2.3 s. The sim emits **163 telegraph events in wave 7, 338 in wave 9, 285 in wave 11** (3-6 a second). No person reads six telegraphs a second. The bot does, which is why the bot's numbers look fine.

### 1.4 Proposed constants, and what was measured with them

Variants are patched copies of the sim (`mkvariant.mjs`), re-measured with the same policies and seeds.

| Variant | Changes |
|---|---|
| **a** (early only) | `PLAYER_BASE_HP` 10 -> 15; `IFRAMES` 0.45 -> 0.6; wave 1 `g('mite', 1.5, 2)` -> `g('mite', 1.25, 2)`; wave 2 `g('mite', 1.5, 2), g('gnat', 8.5, 8, 0.12)` -> `g('mite', 2.4, 2), g('gnat', 8.5, 5, 0.3)`; mite `dmgW` 0.85 -> 0.6; gnat `dmgW` 0.55 -> 0.4 |
| **b** | a, plus spitter `dmgW` 0.8 -> 0.55, `AI.spitSpeed` 200 -> 170, wave 7 spitters `3.5` -> `5`, brute `dmgW` 1.05 -> 0.8, boar and burrower `dmgW` 0.9 -> 0.65, mite `hpW` 2.2 -> 1.6 |
| **c** | b, with `PLAYER_BASE_HP` 16, mite `dmgW` 0.45, gnat `dmgW` 0.3, boar, burrower and spitter `dmgW` 0.5 |
| **d** | see 1.5 |

| Variant | Policy | Win | Dead in 1-2 | Reached 4 | Reached 5 | Reached 7 | Median death |
|---|---|---|---|---|---|---|---|
| base | novice | 0% | 94% | 1.5% | 0% | 0% | 2 |
| a | novice | 0% | 30% | 41% | 8% | 1% | 3 |
| a | novice+ | 0% | 28% | 34% | 7% | 0% | 3 |
| a | average | 0% | **0%** | 96% | 83% | 37% | 6 |
| b | novice+ | 0% | 15% | 54% | 24% | 5% | 4 |
| b | average | 1% | 0% | 97% | 90% | 46% | 6 |
| b | expert-lag250 | **32%** | 0% | 100% | 99% | 96% | 9 |
| b | expert | **81%** | 0% | 100% | 99% | 99% | 10 |
| c | novice | 0% | **2%** | **65%** | 41% | 4% | 4 |
| c | novice+ | 0% | **4%** | **63%** | 34% | 7% | 4 |
| c | average | 0% | 0% | 98% | 93% | 55% | 7 |
| c | expert | **86%** | 0% | 100% | 99% | 98% | 10 |

What this shows:

- **The novice targets are reachable with constants alone.** Variant c puts wave 1-2 deaths at 2-4% and the median first-run death at wave 4, inside the 4-6 band.
- The piece of a-c that matters most for wave 2 is **mite `dmgW` <= 0.49**, so that wave 2 mite damage rounds to 1 and not 2. Variant a still loses 30% of novices in wave 2 with 15 HP because they still take 7 hits at 2 each. Novices take about 7 hits in wave 2 whatever else changes; what can be tuned is what a hit costs.
- **The zero-latency bot is the wrong yardstick for "expert".** Variant b moves the bot from 39.5% to 81% and the same brain with 250 ms hands from 2.5% to 32%. A skilled person sits between those two lines. With today's constants that band is 2.5-39.5%; with b it is 32-81%, which brackets the 50-70% target. Tuning until the bot itself reads 50-70% leaves human experts far below it.
- **Softer damage alone does not carry a mid-skill player to a win.** The average policy goes from median death wave 4 to wave 7 under c and still wins 0-1%. Its top killer stays the spitter (36 of 100 deaths in c). What stops it is the volume of reaction checks in waves 7-11, not the size of each hit.

### 1.5 Variant d: aim the relief at reaction load, not at damage

@@D_SECTION@@

### 1.6 What I would ship, in order

1. The early set (waves 1-2 composition, mite and gnat `dmgW`, `PLAYER_BASE_HP` 16, `IFRAMES` >= 0.6). Measured: novice wave 1-2 deaths 94% -> 2%.
2. The spitter set (`AI.spitEvery`, `AI.spitSpeed`, spitter spawn intervals in waves 7, 9, 11, 12). Measured in d.
3. Then retune late-wave pressure for the expert with health and density, which a zero-latency bot feels, and not with damage per hit or shot count, which only humans feel.

Two changes need code and so were not simulated, but the data argues for them:

- **Stop rounding damage to integers** in `hurtPlayer` (`src/sim/core.ts`, `Math.max(1, Math.round(...))`). With 10-16 HP, rounding turns 1.45 -> 1.55 into a 100% damage increase. It is the hidden cliff behind wave 2.
- **Guarantee one affordable weapon at bench 1** (`rollOffers` in `src/sim/bench.ts`), or start the Greenhorn with enough scrip that the first weapon offer is always in reach. The wave 2 damage check assumes a purchase that half of novices cannot make.

## 2. Pacing

Expert bot, 200 seeds, current constants. "Event" means a level-up, a node broken, a hit taken, an elite or boss event, or a magpie theft. On screen assumes a 1280x720 view at zoom 1.

| Wave | Seconds | Kills/s | Damage numbers/s | On screen mean (max) | Level-ups | Nodes broken | Telegraphs | Mean gap between events (s) | Mean longest gap (s) | Scrip earned | Scrip left on ground | Scrip at the bench | Offers buyable (of 4) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 20 | 1.1 | 1.1 | 3.0 (13) | 1.0 | 2.2 | 0 | 4.2 | 6.5 | 22 | 1 | 22 | 2.6 |
| 2 | 25 | 1.6 | 2.2 | 10.7 (38) | 1.0 | 1.4 | 0 | 3.7 | 9.6 | 39 | 2 | 46 | 3.0 |
| 3 | 30 | 1.3 | 2.7 | 6.4 (31) | 1.0 | 2.8 | 12 | 5.0 | 10.9 | 43 | 3 | 52 | 3.5 |
| 4 | 35 | 1.9 | 3.5 | 8.3 (42) | 1.3 | 2.9 | 25 | 3.0 | 10.0 | 69 | 3 | 79 | 3.7 |
| 5 | 40 | 2.3 | 4.6 | 8.6 (43) | 1.5 | 2.7 | 27 | 6.4 | 15.2 | 106 | 5 | 120 | 3.5 |
| 6 | 45 | 1.9 | 4.3 | 5.5 (34) | 1.2 | 3.2 | 14 | 5.2 | 13.6 | 133 | 5 | 147 | 3.4 |
| 7 | 50 | 2.6 | 6.9 | 16.1 (48) | 1.2 | 2.3 | **163** | 8.9 | **23.5** | 161 | 26 | 181 | 2.9 |
| 8 | 55 | **6.3** | 11.3 | **28.3 (155)** | 2.0 | 1.6 | 100 | 0.8 | 7.8 | **326** | 58 | 353 | 2.7 |
| 9 | 60 | 5.1 | 11.3 | 30.3 (137) | 1.7 | 1.7 | **338** | 7.0 | **27.9** | 377 | 132 | 442 | 2.4 |
| 10 | 60 | 7.1 | 15.3 | 33.1 (179) | 1.9 | 1.5 | 78 | 8.7 | 24.9 | 504 | 154 | 662 | **1.7** |
| 11 | 60 | 6.4 | 14.5 | 34.8 (175) | 1.4 | 1.6 | **285** | 2.3 | 14.8 | 483 | 163 | **926** | **1.6** |
| 12 | 90 | 4.0 | 10.8 | 44.2 (297) | 0.9 | 1.2 | 131 | 10.6 | **58.1** | 391 | 204 | | |

Time to first events (median, sim seconds from the first frame): first kill 3.3-4.2 s, first node broken 3.8-4.3 s (100% of runs break a node in wave 1, the planted tree works), first level-up 16-17 s, first hit taken 13 s for the novice and 22-30 s for the others.

From the real page (`loop.cjs`, fresh device): page load to the Head out stamp **374 ms**, key press to canvas **259 ms**, so control at **0.73 s**. First kill about 5 s after load, first bench at about 21 s. All three design targets (control in 10 s, no sign-up, first choice by 30 s) are met with room to spare. This part is excellent.

Findings:

- **Dead air, wave 1.** Three enemies on screen, one kill a second, one 4-damage number at a time. It is 20 s, so it passes, but it is the first impression and nothing in it says "horde". The sling throws a small stone at a small bug.
- **No punctuation in the long waves.** Kills are constant from wave 7, but the things a player remembers (a level, a node, a hit, an elite) are 9 s apart on average in waves 7, 9, 10 and the longest gap averages 23-28 s. Wave 12 averages one 58 s stretch with no level-up, no node and no boss phase. Level-ups arrive about once per 35 s all run and are not a choice when they arrive (the pick waits for the bench). Vampire Survivors hands you a choice every 10-20 s early on. Brotato defers too, but its waves are denser and it shows the pending level-up count.
- **Overload cliff at wave 8.** Kills/s 2.6 -> 6.3, on-screen 16 -> 28 (max 48 -> 155), scrip 161 -> 326 in one step. Waves 3-7 are a gentle ramp and wave 8 is a different game. That is fine as a set piece ("a raid"), but the waves after it never come back down, so there is no rhythm of tension and release.
- **Telegraph overload** in waves 7, 9, 11 (3-6 tells a second, see 1.3). The telegraph sound is throttled to one per 0.12 s, so it becomes a continuous rattle with no information in it.
- **Scrip stops being a decision after wave 8.** The bot arrives at bench 10 with 662 scrip and bench 11 with 926, and can buy 1.6-1.7 of the 4 offers. Slots are full (6.0 weapons from wave 10) and raws gate the rest (7-12 raws a wave against tier 3-4 recipes that need 4-8). The "45 s fight, 30 s decide" loop loses its second half exactly when builds should be peaking. Either add a scrip sink (Brotato's answer is that rerolls scale and items never stop being buyable; here raws block the purchase) or let scrip buy raws at the bench at a bad rate.
- **A third of late scrip is never picked up.** 132-204 scrip a wave is left on the ground in waves 9-12 and banked. The "banked, pays double" rule then cannot pay back because the next wave leaves even more. The HUD shows "216 banked, pays double" at the boss (`/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/shots/d08-wave12-tusk.png`). `BASE_MAGNET` 85 is small for this density; Brotato sweeps everything at wave end.
- **Near-death is rare for the bot and constant for people.** The bot dips under 30% HP in 2-8% of early waves; the average policy does in 28-61% of waves 2-4 and 96% of wave 7. Near-misses are a hook when they are occasional. At 96% they are just the death animation starting early.

## 3. Game feel audit

Driven in the real client with the keyboard. Stills are 1280x720 at deviceScaleFactor 1.

### 3.1 What the frames show

- **Hit and kill** (`.../shots/seq-kill.png`, 8 consecutive frames at 1/6 speed; built from `b02-kill-0..7.png`): the mite turns solid ink for 2 ticks, a small "4" floats, one madder chip, then an 85 ms ghost, 3 chips and a coin. It is correct and it is quiet. A wave 1 kill is about 12 pixels of feedback. No hit-stop, no scale pop, no flash on the shooter, no recoil worth seeing on a sling.
- **Getting hurt** (`.../shots/a08-first-hurt.png`, `.../shots/c02-hurt-0.png`): player turns solid ink, a madder "-1", 5 ochre chips, 60 ms hit-stop, shake (trauma 0.42), HP bar flashes for 80 ms. Readable. What is missing is **who did it**: no flash on the attacker, no direction mark, and in a crowd several mites overlap the player. On the recap the killer is named ("Killed by: Mite"), which is good.
- **Telegraphs** (`.../shots/d06-wave8-raid.png`): boar charge lanes are hatched madder strips that fill as the windup runs, slam rings fill the same way, spawn marks are madder diamonds on the ground, lane mouths have chevrons. These are the best-executed thing in the client. One boar lane is unmistakable. Six overlapping lanes plus gnats plus magpies in wave 8 is a red carpet, not a warning.
- **Spit** (`.../shots/d02-wave4-spitters-magpie.png`): enemy shots are 14 px dark-red dots, the same hue as every enemy, drawn under the same crowd. The design rule "the only madder round shapes" holds, but they are small and low-contrast against moss. Given that spitters are the top killer of human-latency players, this is the readability bug that costs the most runs.
- **Player in a crowd** (`.../shots/d08-wave12-tusk.png`): the player is ochre, scrip is ochre, raws are ochre, crit numbers are ochre. In wave 12 there are about 80 coins on screen and I could not find the player in the still without the HP bar. The player and enemy numbers also slide under the top-left HUD panel, which is opaque.
- **Pickups, nodes, enemies at a glance** (`.../shots/a07-raws-on-ground.png`, `.../shots/d05-wave7-brutes.png`): the three families separate cleanly by colour: madder is danger, ochre is yours, spruce and ink are terrain. Nodes with their dashed ring are obvious. This palette discipline works.
- **Level-up**: read from code (`render.ts` `case 'levelup'`): one 46 px ochre ring for 0.16 s and the `levelUp` sound. No text, no HUD count of picks owed, no pause. I could not capture it standing still because an idle player never collects 16 scrip. For the main reward beat of the genre it is close to invisible.
- **Death** (`.../shots/seq-death.png`, from `c04-death-0..2.png`): the sprite goes to ink, 20 chips, shake 0.7, 120 ms freeze, then the scene holds for 1.5 s and cuts to a ledger. No slow-motion, no zoom, no fall, no ring. Measured death to end screen: **1575 ms**.
- **Run end** (`.../shots/c05-end-screen.png`, then `.../shots/g05-homecoming-first-death.png`): two screens in a row with nearly the same tables. Screen 1 says "Down in wave 2", screen 2 says "Died on wave 2". On a first death both are tables of zeros.
- **Death to next run**: 1.5 s beat, Enter ("Head back to town"), Enter ("Go again", which has focus). **2 presses, about 3 s** for someone who knows. Second run started 212 ms after the press. That is as fast as anything in the reference set. The redundancy is the cost: the first screen exists only to pick the carry, and when the carry limit is 0 (every run that ends before wave 4) it has nothing to ask.
- **Phone** (`.../shots/f01-phone-wave5.png`, `.../shots/f02-phone-bench4.png`): the bench reflows well. Not audited further.

### 3.2 Juice checklist

| Element | Best in class | Scrip | Evidence |
|---|---|---|---|
| Enemy hit flash | yes | Yes, 2 ticks solid ink | `core.ts` `e.flash = 2`, `seq-kill.png` |
| Knockback on hit | yes | Yes, but sling knock is 2, about 2 px of push, invisible | `weapons.ts` data |
| Damage numbers | yes | Yes, merged per target inside 0.34 s, crits ochre | `render.ts number()` |
| Hit-stop on kill or big hit | VS no, Brotato light, HoT yes | Only on player hurt (60 ms), elite death and death (120 ms) | `render.ts` |
| Screen shake | yes, with toggle | Yes, trauma model, toggle in pause, persisted | `render.ts`, `mount.ts` |
| Screen flash or vignette when hurt | yes | **No**. Sprite flash and an 80 ms HP bar flash only | `hud.ts hurt()` |
| Low-health warning (vignette, heartbeat, pulse) | yes | **Weak**. HP bar turns madder at 30%. No audio, no screen edge | `hud.ts` |
| Attacker highlight or damage direction | sometimes | **No** | |
| Death animation and beat | yes | **Weak**. Ink sprite, chips, 1.5 s hold | `seq-death.png` |
| Kill debris | yes | Yes, chips and ghost | |
| Corpses or decals that persist | HoT yes | Node stumps only | `remKind` |
| Pickup magnet with fly-in | yes | Yes (`PICKUP_FLY_SPEED` 520) | |
| Pickup sound that rises in a streak | yes | **Only for raws.** Scrip uses sound id `scrip`; the streak code checks `id === 'pickup'` | `audio/index.ts` line 161, `sound.ts` |
| Counter tick-up | yes | Yes, with an ink flash | `hud.ts` |
| Level-up fanfare and choice | yes | **Weak**. 46 px ring, one sound, no text, choice deferred, no count of picks owed on the HUD | `render.ts` |
| Wave-clear beat | yes | **Missing**. `waveEnd` sound, then a hard cut to the bench. Raws are swept with no animation | `mount.ts` |
| Wave-start banner | yes | Yes, one notice line for 3.6 s | `hud.notice` |
| Boss intro | yes | Notice line, sound, shake 0.55. No camera move, no name card | |
| Boss health bar | yes | Yes | `hud.ts` elite bar |
| Off-screen indicators | yes | Yes: elite arrow, nearest-node chevron | `render.ts` line 734 |
| Enemy spawn tells | Brotato yes | Yes, 0.6 s ground diamond | |
| Attack telegraphs | yes | Yes, strong (lanes, rings, mound) | |
| Weapon swing or muzzle visuals | yes | Sprites orbit and swing; shots are tiny | `drawPlayer` |
| Crit emphasis | yes | Ochre number, 3 chips, own sound | |
| Kill-streak or combo feedback | VS no, others some | No | |
| Music | yes | **None** | no music code in `src/client/audio` |
| Ambient bed | yes | **None** | |
| Per-weapon sounds | yes | Yes, 4 voices pitched across 12 weapons, throttled per class | `sound.ts VOICE` |
| Gathering sounds | n/a | Yes: chop, clink, scrape and a break for each. A genuine strength | `sounds.ts` |
| Mute and volume on screen | yes | Yes, from the first frame | |
| Win fanfare | yes | `win` sound and a 1.7 s hold. No visual | `mount.ts` |
| Pause on blur | yes | Yes | |

### 3.3 Audio, reasoned from code

Everything is synthesised one-shots: `attack` (per weapon class, throttled 0.1-0.2 s), `hit` (0.045 s gap), `crit`, `kill` (0.05 s gap), `hurt`, `dodge`, `scrip`, `pickup`, work and break per node type, `levelUp`, `telegraph` (pitched by kind: charge 1.0, spit 1.5, slam 0.7, surface 0.85, summon 1.2), `slam`, `burst`, `elite`, `boss`, `steal`, `waveStart`, `waveEnd`, `death`, `win`, and bench sounds (`buy`, `reroll`, `lock`, `combine`, `anvil`, `reveal`, `revealFirst`, `mule`, `stamp`).

- There is **no music and no ambience**. With sound on, wave 1 is a sling tick about twice a second and a kill tick once a second over silence. Every game in the reference set has a loop that carries the first minute.
- The **scrip streak is not wired** (table above). Scrip is 90% of pickups, so the most satisfying audio idea in the design doc is absent from the most common action.
- At 15 hits/s and 7 kills/s (wave 10) the throttles cap `hit` at 22/s and `kill` at 20/s. That is a wall of clicks, and the telegraph cue (the only sound that carries information the player must act on) is in the same register. Telegraphs should duck the rest.
- No low-HP audio. `secondWind` reuses `levelUp` at 0.7 pitch, which is a strange thing to hear when you nearly died.

## 4. First-run teaching

Walk-through with `?first=1`, then the real app with a fresh device.

| Moment | What the player gets | Screenshot | Verdict |
|---|---|---|---|
| Town, before the run | "You only move: WASD or the arrow keys, or drag anywhere on a touch screen. Weapons fire on their own." A movement key starts the run. 144 words on the page. | `.../shots/g01-first-page.png` | Good. No modal, one press. But five locked characters and an Account block compete with it. |
| Move | One line under the player: "Move with WASD or the arrow keys", gone after 0.7 s of movement. | `.../shots/a01-first-frame.png` | Good. |
| Auto-fire | Nothing in the run. First kill at about 4 s with no input. | `.../shots/a09-wave1-04.png` | Fine, self-evident. |
| Work ring | "Stand in a ring to work the tree", a planted tree 255 px from the start, shown until a node breaks. | `.../shots/a03-after-move-work-line.png`, `.../shots/a04-in-ring-working.png`, `.../shots/a05-working-progress.png`, `.../shots/a06-node-break.png` | Good, and 100% of simulated runs break a node in wave 1. The progress arc on the ring is thin; a first-timer cannot tell 30% from 80%. |
| That enemies hurt, keep moving | Nothing. | `.../shots/a08-first-hurt.png` | **Gap.** The work line tells the player to stand still in a ring. The first hit lands at about 13-15 s. Nothing says move. |
| Scrip is also experience | Nothing. The bar under HP says "Level 1". | | Gap, minor. |
| The bench | One italic line: "Scrip and raws buy these. Spend what you can, then start the next wave." Keys 1-4 and Enter are on the buttons. | `.../shots/a10-bench-1.png` | Adequate. But the first bench shows 13 stat rows that all read 0, two identical slings, and two items struck out for want of 1 ore. With 10-19 scrip the "choice" is one sling. |
| Upgrade pick | "Level 3: pick one", four rows with "Now 0, then 15". The Wave and Reroll buttons are struck through until you pick; the reason only appears if you press them. | `.../shots/e-bench-2.png` | Adequate. "+15 Reach" has no unit and no picture of what changes. |
| Fusion | "Needs two different items. They are used up and one new item comes out." | `.../shots/e-bench-2.png`, `.../shots/e-bench-8.png` | **Not taught, and mostly not reachable.** A novice holds two items in almost no run before dying. The one LLM mechanic, the reason this game is different, is not in the first session. |
| Mule | Appears after wave 4 with three sentences. | `.../shots/e-bench-4.png` | Fine when reached. Novices reach bench 4 in 0% of baseline runs. |
| Carry home | End screen: "No items go home this time. Clear wave 4 and you carry 1." | `.../shots/c05-end-screen.png` | Good. This is the best line in the game: a concrete next goal at the moment of loss. |
| Second run | No teaching at all. `firstRun` is `profile.runs === 0`. | `.../shots/g06-second-run.png` | **Bug in spirit.** I died at 0:29 without moving or working a node, and run 2 showed nothing. Teach lines should persist until the action has been done, not until a run has ended. |

Where a new player is confused, in order of cost:

1. Why they died. Standing in the ring, as told, with mites arriving.
2. What to buy with 10 scrip when two offers are the weapon they already hold.
3. What "raws" are (the word is never introduced; it is on the bench, the end screen and the town).
4. "216 banked, pays double": banked where, pays when.
5. The workshop "opens" after run 1 with an empty stash and no way to fill it short of clearing wave 4.

No wall of text anywhere. The restraint is right. The gap is not too many words, it is that the two words that matter ("keep moving") are missing and the best mechanic is behind a wall novices do not climb.

## 5. Addiction loop audit

Implemented means I saw it in code or on screen, not in DESIGN.md.

| Hook | Implemented | Evidence | Strength against Brotato / VS / Balatro |
|---|---|---|---|
| Variable rewards: shop rolls | Yes | 4 offers, tier odds by bench and Luck (`bench.ts rollTier`), lock and reroll | Comparable to Brotato in structure. Weaker in feel: 65% of offers are stat items and level picks are "+5% Rate". Nothing makes you say "oh, that one". |
| Variable rewards: fusion | Yes | `applyFusion`, first-finder name, `revealFirst` sound | The real differentiator, and strong on paper. Reached by the bot 1.09 times a run; by novices, never. |
| Variable rewards: drops in the arena | Weak | Scrip values are fixed per enemy; nodes give fixed yields; no chests, no rare drops, no elite loot table beyond scrip and 4 hide or 6 timber | VS chests and Brotato crates are the mid-wave dopamine. Nothing here drops a surprise. |
| Near-miss | Partial | "Clear wave 4 and you carry 1" on the end screen; wave N of 12 in the title | The right idea. Missing: how close you were (boss health left, seconds left in the wave), and any comparison with your own past. |
| Visible goals in a run | Yes | Wave x of 12, timer, elite bar | Standard. No build goals: set bonuses exist (2/4/6) but are below the fold on the bench. |
| Visible goals across runs | Partial | "Heads out after N more runs" on five characters; feature tabs unlock at runs 1, 3, 4, 5; character at 2, 6, 7, 8, 9 | Steady drip for 9 runs, all by participation. Nothing is earned by doing well, so nothing pulls toward playing better. After run 9 there is no account goal at all. |
| Session-end hook | Yes | "Go again" has focus on the homecoming, 2 presses, about 3 s | Good. Undercut by two near-identical recap screens. |
| Personal best, records | **No** | No best-wave field in `Profile` (`src/shared/protocol.ts`); account shows Runs, Wins, First finds | Every reference game shows a best. The cheapest missing hook in the build. |
| Streaks | No, by design | "There is no streak to lose" (`daily.ts`) | Correct call. A win streak that only counts up and never punishes would be fine and is absent. |
| Daily | Yes, from run 4 | 8 waves, shared seed, one scored attempt, percentile, copyable line (`homecoming.ts dailyLine`) | Well built and not manipulative. Gated behind 4 runs, which at a 94% wave-2 death rate is about 2.5 minutes of dying. |
| Collection completion | Weak | Codex lists known recipes and pairs in your stash (`workshop.ts`); no "x of y found", no silhouettes of near neighbours (DESIGN.md 4.2 promises them; the only silhouettes in `src/client` are locked characters) | Balatro's collection screen and VS's unlock grid are the long tail of those games. Here the codex is a search box. |
| Social proof | Partial | First finder's name stamped on fused items; daily board top twenty; market listings carry seller names | The finder stamp is a good, honest hook. It needs a place to be seen (a "found today" line) to work. |
| Loss softening | Yes | Mule loads are safe; 30% of held raws; marks on any run (+3 marks for a 29 s death) | Good, non-manipulative. |
| Meta progression that makes the next run different | Weak for novices | Kit of 2 items with 3 charges, from the stash | Needs wave 4 cleared. Baseline: novices 0%, average policy 36.5%. For most first sessions, run 2 is identical to run 1. |

What is missing or weak, in order of value:

1. **A reason run 2 differs from run 1.** In Brotato it is a new character every win and new weapons from play; in VS it is gold for permanent power and a new weapon most runs; in Balatro it is a new deck or joker almost every session. Here the first character arrives after run 2 and the first carried item needs wave 4.
2. **Personal bests on the death screen**: "Wave 2. Best: wave 3." One line.
3. **Mid-wave surprises**: an elite that drops a guaranteed item, a rare rich node from wave 2 and not wave 5 (`RICH_FROM_WAVE`), a magpie that carries a prize in.
4. **Codex completion**: "14 of 903 pairs known to you, 212 known to the town" (43 base items make 903 pairs before fused items are counted). The fusion space is the collection. Show it.
5. **Build identity**: the bench is a list of stat lines. Set bonuses and "You hold one. Two make a tier 2" are the only places the bench talks about your build.

Deliberately not recommended: streak loss, energy, pay-to-skip, countdown offers, loot boxes. The design doc already rules them out and it is right to.

## 6. Writing and UI

The voice is the most consistent thing in the project: dry, short, sentence case, no exclamation marks. Most of what follows is where it slips or where dryness becomes opacity.

Unclear or confusing:

- **"Raws"** is used everywhere and introduced nowhere. First sighting is "Scrip and raws buy these."
- **"Scrip" and "marks"** are two paper-money words for two currencies, and scrip is also experience. A new player has no way to guess which is which.
- **"216 banked, pays double"** (HUD). Banked where, pays when, double what.
- **Upgrade rows**: "+15 Reach. Now 0, then 15." "+2 Melee. Now 0, then 2." "+5 Luck." No unit and no consequence. The stat panel elsewhere does translate ("Rare offers x1.05"), so the words exist; they are not on the pick. These rows are also exactly what DESIGN.md section 10 item 11 says not to ship ("an upgrade that is only a small percentage on one stat with no cost and no hook").
- **"Down in wave 2"** (end screen) then **"Died on wave 2"** (homecoming). Pick one preposition and one verb.
- The raws table appears twice with different headers: "Gathered / Mule / Held / Goes home" then "Held at the end / Sent by mule / Came home".
- **"Your account is kept on this device. There is nothing to sign."** Nothing to sign reads as a mistranslation of "no sign-up".
- **"Needs two different items. They are used up and one new item comes out."** Accurate and inert. This is the headline mechanic. It could say what is at stake: nobody may have tried this pair.
- **"Untried by you this run"** on the anvil, against "Untried by you" in the workshop. Is it per run or per account.
- **"Take your upgrade first."** only appears after pressing a struck-through button.

Generic or filler:

- Wave 11 brief: **"Everything"**. Wave 1: "Mites". Compare wave 8, "A raid: boars, gnats and thieving magpies", which has a voice.
- Enemy names **Spitter, Brute, Burrower** are stock genre nouns. Mite, Gnat cloud, Boar, Magpie, Stag, Rotwood, Old Tusk are things a tired person would call them, which is the stated rule. Three of ten miss it.
- **Greenhorn: "No twist."** True, and the first thing a new player reads about their character.
- Weapon notes: "Cheap, fast, weak." (sling) is good. "Pierces 1." "Bounces 1. Scales with Melee and Ranged." are tooltips restating stats (section 10 item 9).
- Player names: **"Baker 158"**. Trade plus number reads like a default username. It is also the largest text on the first page, in an ochre block.
- Procedural fusion names (`server/provider.ts`): modifier plus noun from fixed tables ("tarred knife", "waxed hoop"), or two parent words glued together (the harness produced **"Whetstone moccasins"**). These are the names that get a finder's name stamped on them for good. With the model off they read as filler, and the dev harness is what most testers will see.
- Item names are the strong part: Tallow, Hobnail boots, Salt pork, Lodestone, Smelling salts, Prospector pan, Favour list. Plain trade words with a cost and a gain. "Lucky horseshoe" and "Rabbit foot" are the two that could be from any game.

UI that reads as a default:

- Nothing looks like a framework template. The ledger rules, stamp buttons and tier pips are bespoke and hold together across the bench, end screen and town. No gradients, cards or emoji anywhere I looked.
- What reads as unfinished is **density without hierarchy**: the bench at 720p shows offers and a 13-row stat table that is all zeros, with weapons, sets, items, the anvil and the mule below the fold (`.../shots/a10-bench-1.png`, full page in `.../shots/a10-bench-1-full.png`). The first bench should not show thirteen zeros.
- The end screen is a spreadsheet at the emotional peak of the run (`.../shots/c05-end-screen.png`). On-style, but a death deserves one large line before the ledger.
- The top-left HUD panel is opaque and the camera lets the player and damage numbers go under it (`.../shots/d08-wave12-tusk.png`).

## 7. Ranked changes

Ranked by expected effect on "a new player is still here in ten minutes". Each has its file or constant and the measurement behind it.

| # | Change | Where | Measured reason |
|---|---|---|---|
| 1 | Make waves 1-2 survivable: mite `dmgW` 0.85 -> 0.45, gnat `dmgW` 0.55 -> 0.3-0.4, `PLAYER_BASE_HP` 10 -> 16, `IFRAMES` 0.45 -> 0.6+, wave 2 groups `g('mite', 2.4, 2), g('gnat', 8.5, 5, 0.3)`, wave 1 `g('mite', 1.25, 2)` | `src/sim/data/enemies.ts`, `tuning.ts`, `waves.ts` | Novice deaths in waves 1-2: 94% -> 2% (variant c). Reached wave 4: 1.5% -> 65%. |
| 2 | Cut reaction load from spitters: `AI.spitEvery` 2.3 -> 3.0, `AI.spitSpeed` 200 -> 170, spitter intervals in waves 7, 9, 11, 12 x1.4-1.6; draw enemy shots larger with an ink outline | `src/sim/data/enemies.ts`, `waves.ts`, `src/client/game/render.ts` | 250 ms of latency takes the bot from 39.5% to 2.5%; 81 of those deaths are wave 7; spitters are 47% of its deaths. 163-338 telegraphs per wave. @@D_ONE_LINE@@ |
| 3 | Stop integer rounding of damage; show one decimal less often, or keep HP as a float and round only the display | `hurtPlayer` in `src/sim/core.ts` | Wave 2 mite damage 1.85 rounds to 2: a 100% jump at 10 HP. Variant a (15 HP, mites still 2) still loses 30% of novices in wave 2. |
| 4 | Guarantee the first bench can sell a weapon the player can afford and use (no raws, price <= scrip held) | `rollOffers` in `src/sim/bench.ts` | Scrip at bench 1 is 19-22; novices enter wave 2 with 1.5 weapons; wave 2 needs about 10.5 damage a second and one sling gives 7.3. |
| 5 | Give run 2 something new: let the first item come home at wave 2 or 3 on the first few runs, or grant one starter stash item with the workshop unlock; add "Best: wave N" to the profile and both recap screens | `carryLimit` in `src/sim/run.ts`, `server/config.ts`, `Profile` in `src/shared/protocol.ts`, `end.ts`, `homecoming.ts` | Carry needs wave 4 cleared: 0% of novice runs, 36.5% of average runs. Workshop opens after run 1 with an empty stash. No personal best exists anywhere. |
| 6 | Make level-up an event: bigger ring, the word "Level 4" over the player for a second, a count of picks owed next to the level label, a wave-clear beat (0.6 s sweep of pickups into the player) before the bench | `render.ts` `case 'levelup'`, `hud.ts`, `mount.ts` | Level-ups are once per 35 s and currently a 46 px ring for 0.16 s. Longest event gaps average 23-58 s in waves 7-12. Wave end is a hard cut. |
| 7 | Wire the rising streak to scrip; add a quiet music or ambient loop; duck hits and kills under telegraph cues; add a low-HP cue | `src/client/audio/index.ts` line 161 (`id === 'pickup'`), `sound.ts`, `sounds.ts` | Scrip is the common pickup and has no streak. No music or ambience in the code. Up to 22 hit and 20 kill sounds a second mask the only cue that carries information. |
| 8 | Fix the late economy: sweep scrip at wave end (or raise `BASE_MAGNET` 85 -> 130 and grow it per wave), and give scrip a late sink (buy raws at the bench, or scrip-only reforge) | `endWave` in `src/sim/world.ts`, `tuning.ts`, `bench.ts` | 132-204 scrip a wave left on the ground in waves 9-12. Bot holds 662-926 scrip at benches 10-11 and can buy 1.6 of 4 offers. |
| 9 | Keep the player findable: ink outline or a contrasting marker under the player, cap coin draw density, keep the camera from putting the player under the HUD, make the HUD panel translucent to the player sprite | `render.ts`, `game.css` | Wave 12 still: about 80 ochre coins and an ochre player under the HP panel. |
| 10 | Teach the two missing things and stop un-teaching: "Keep moving. Touch hurts." after the first hit; keep teach lines until the action is done and not until `runs > 0`; say "raws" once ("Timber, ore and hide are raws"); merge the two recap screens when the carry limit is 0 | `mount.ts teach()`, `firstRun` in `src/client/town/run.ts`, `bench.ts`, `end.ts` | Idle player dies at 0:29 and run 2 shows no teaching. First hit lands at 13-15 s while the only instruction on screen says to stand in a ring. |
| 11 | Replace flat stat picks with picks that have a hook ("+15 Reach, shots fly 15% further"; or pair every pick with a small cost) and hide zero rows in the stat panel until they are non-zero | `src/sim/data/upgrades.ts`, `bench.ts` | Violates the project's own ship rule 11. First bench shows 13 zeros. |
| 12 | Retune the expert band after 1-4 using enemy health and density, not damage per hit | `enemies.ts` `hpW`, `waves.ts` | Variant c: bot 86%, human-latency policy 0%. Damage softening helps the bot more than people. |
| 13 | Names and words: rename Spitter, Brute, Burrower; give wave 11 a brief; one verb for death; give the Greenhorn a line; better fallback fusion names | `enemies.ts`, `waves.ts`, `end.ts`, `homecoming.ts`, `characters.ts`, `server/provider.ts` | Section 6. |
