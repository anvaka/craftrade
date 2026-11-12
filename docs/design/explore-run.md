# Exploring the run: why the 50th Scrip run is less exciting than the 50th Brotato run

Lens: the run itself. Moment-to-moment excitement, the power curve, and the build fantasy.
Nothing in `src/`, `server/` or `tests/` was changed. The owner asked for options, not changes.

The owner's words: *"While I enjoyed playing a few hours I feel like I am getting bored / less motivated to play
(unlike Brotato / New World which keeps me engaged). Something is lacking in our game but I can't place my
finger on what."*

**Short answer.** The run is well balanced and fair, and that is part of the problem. It was tuned so that no
build outgrows the enemies (`WAVE_HP` exists to do exactly that), so the player never feels broken. Builds are
made of small numbers, not new behaviours, so few runs have a moment where the build clicks. There is not much
content to wander through (12 weapons in 3 attack shapes, 6 characters, the same 12-wave script every run), so a
few hours is enough to have seen most of it. Brotato keeps people because the second half of a run is a power
fantasy that looks different every time. Ours keeps a similar level of threat from start to finish and looks much the same every run.

---

## 0. Method and how sure each claim is

- **Code:** `src/sim/data/*.ts`, `src/sim/bench.ts`, `src/sim/core.ts`, `src/sim/weapons.ts`, `src/shared/vocab.ts`,
  `src/shared/content/items.ts`, `relics.ts`, and `docs/DESIGN.md`.
- **Prior measurements:** `docs/critique/depth-after.md` (strategy win rates, bench choice rates), `fun.md`
  (pacing, events, hooks), `feel-after.md`.
- **New measurements for this note.** I used the headless sim with the default bot, Greenhorn unless a row says
  otherwise, seeds `s*7919+13`. Outputs and scripts are in
  `/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/design-run/`:
  - `par.sh … 200` for 12 jobs (default, melee, shot, stack:sling, stack:pike, tank, lucky, economy, gatherer,
    plus default on Sawyer, Trapper and Clerk). These were analysed by `tools/power.ts` and saved to `power.txt`.
  - `tools/feel.ts` is a new instrumented loop. For each wave it measures how long a normal enemy lives after its
    spawn tell, the share killed by a single hit, overkill (raw hit damage divided by the enemy HP removed),
    attacks per second, the biggest hit and the elite kill time. I ran it on default (100 seeds) and on
    stack:sling, melee and tank (60 seeds each). Two curve variants were patched in memory, not in the repo
    (`VARIANT=flat`, `VARIANT=flat+dense`).
- **Caveat that matters.** The bot is not a person. It has zero latency, so it dodges better than a human, but it
  plays builds blandly. Survival numbers flatter it, and "excitement" numbers are proxies. Every claim below is
  about the system (what the numbers allow), not about how a person felt.
- **Web.** The wiki and review pages could not be fetched from this session
  (`brotato.wiki.spellsandguns.com` and `rogueranker.com` failed DNS). Brotato figures therefore come from
  search-result summaries and from `docs/research/research-arena.md`, which cites the wiki. Each is marked.

---

## 1. Content breadth: Scrip against Brotato

| | Scrip (counted in code) | Brotato (source) |
|---|---|---|
| Weapons | **12**, in **3 attack shapes** (sweep, thrust, shot), 4 tiers | About 66 in current patches ([tier list, patch 1.1.6](https://rogueranker.com/brotato-tier-list/)); 47 at 1.0 launch ([press release](https://www.gamespress.com/Brotato-10-Release)). Shapes include melee, guns, explosives, elemental and structures/turrets. |
| Items | **80** (25/25/20/10 by tier). By positive effect: **8** pure stat, **49** a stat or conditional number, **23** with any visible new effect, and those 23 are levels of pierce, bounce, burn, blast, thorns or shards. | 158-177 by version ([biligame wiki](https://wiki.biligame.com/brotato/%E7%89%A9%E5%93%81), [press release](https://www.gamespress.com/Brotato-10-Release)) |
| Characters | **6**. Twists are mostly economic: prices, interest, fusion cost, tier-up cost. | 48 base, 62-64 with DLC ([fantasywarden](https://fantasywarden.com/games/brotato-beginners-guide), [bloxodes](https://bloxodes.com/wiki/brotato/characters)). Many are hard rules (one weapon only, no weapons, +200% XP needed). |
| Level-up picks | 13 flat stats x 4 tiers | About 16 flat stats x 4 tiers. The format is similar. |
| Effect vocabulary | 13 stats + 35 specials (`vocab.ts`) | n/a |
| Rule-breaking effects | 8 relics. **None can appear in a run's shop.** They come only from a rare server roll at the end of a run. | Many in the normal shop pool (from memory, not checked: Exoskeleton-style trades, Turret/Landmine structures, Lucky charms, and so on) |
| Normal enemies | 7 (mite, gnat, boar, spitter, magpie, badger, bear) | Several dozen (from memory, not checked) |
| Elites / bosses | 2 elites (always stag in wave 6 and rotwood in wave 9), 1 boss | Elites drawn from a pool at Danger 2+ on waves 11-18, horde waves, two bosses at D5 ([research-arena.md 2.1](../research/research-arena.md)) |
| Waves | 12, the same script every run. 570 s of combat (~13 min with benches). | 20, 1,050 s of combat (~25-30 min) |
| Difficulty ladder | Hazard 0-5 | Danger 0-5 per character. "Beat everyone on D5" is the long goal ([PS5 DLC review](https://www.playstationcountry.com/brotato-abyssal-terrors-dlc-ps5-review/)). |

What the numbers mean: at about 13 minutes a run, a few hours is 10-15 runs. In that many runs a player has
been offered every weapon several times, has met every enemy and both elites at the same waves every time,
and has played each character twice. The surface of Scrip is roughly **one fifth** of Brotato's on weapons,
**one half** on items and **one tenth** on characters. Brotato's surface is wide in behaviours, not only in counts.

---

## 2. Diagnosis

### H1. The curve is tuned so the player never outgrows the enemies, so there is no power fantasy

**Claim.** In Brotato, enemy HP grows linearly while player power grows multiplicatively. The second half of a
run is "deleting screens", and elites and the boss bring the check back
([research-arena.md 1.2](../research/research-arena.md)). Scrip copies the linear HP formula and then adds `WAVE_HP`,
a multiplier of 1.0 through wave 5 that rises to 2.1 by wave 12. DESIGN.md 3.7 gives the reason in so many
words: "the late ones climb because a build's damage grows far faster than linear health". The game
deliberately cancels the growth that the genre is built to show.

**Evidence (default bot, 100 seeds, normal enemies, `feel-default.txt`):**

| Wave | 2 | 4 | 6 | 8 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|
| Killed by one hit | 56% | 59% | 63% | 48% | 47% | **38%** | 41% |
| Median life after spawn tell (s) | 1.7 | 1.7 | 2.0 | 2.4 | 2.3 | 2.4 | **2.7** |
| Overkill (raw ÷ HP) | 1.64 | 1.78 | 1.84 | 1.72 | 1.72 | 1.66 | 1.70 |
| Attacks per second | 1.6 | 4.9 | 5.2 | 7.9 | 9.8 | 10.6 | 11.6 |

- Fodder gets *harder* to kill over the run. The one-hit share falls from about 60% to about 40%, and enemies live
  longer. Overkill stays flat at about 1.7, so at no point does the build overpower what it hits.
- Tank and melee show the same pattern: the tank's one-hit share goes from 58% to 33% by wave 11, and melee
  enemies live 3-4 s all run.
- Winners' median final sheet (default, 200 seeds): **+28% Damage, +54% Rate, +8% Crit**. Brotato winning builds
  usually carry several times that. That figure is from memory, not measured.
- Raw damage per second dealt is **almost the same for every strategy** in every wave (about 50 at wave 6 and
  about 520 at wave 11 for default, melee, tank, lucky, Sawyer and Clerk; `power.txt`). Kills are limited by
  how many enemies spawn, so the build changes *how* enemies die, not how many. That makes H1 the main lever
  on how power feels.
- **One build does break out: the sling stack.** Enemy life falls from 1.9 s to **1.05 s**, the one-hit share
  rises to 64% by wave 10, attacks reach 17/s, and Old Tusk dies in a **median 17.7 s** (others take 39-51 s), with a
  boss pass rate of 97%. This is the Brotato feeling, and it currently exists in one build out of fifteen.
- **Curve experiment.** With `WAVE_HP` held at 1.0 for all waves and nothing else changed, the late one-hit share
  rises to 67-68%, overkill to 2.3-2.7, and the bot's win rate goes from 60% (200-seed baseline) to **81%**. Adding
  30% more density in waves 7-12 (`flat+dense`) brought it back only to **80%**, so density alone does not replace
  the HP multiplier for this bot. If the power fantasy comes back, the difficulty has to move somewhere else:
  elites, hazards, or enemy behaviour.
- **Near-death is rare for winners and constant for people.** Winning bot runs spend 2-9% of wave time under 30%
  HP. The fun critic's average-latency policy dips under 30% in 96% of wave-7 runs (`fun.md` 2). The threat that
  is left is about reflexes, not about the build. The player experiences the late game as "survive harder", not
  as "now I'm strong".

### H2. Builds are made of numbers, not behaviours, so there are few "click" moments

**Claim.** A synergy clicks when two pieces multiply or change what happens on screen. Examples: a Vampire
Survivors evolution that turns a weapon into something new, or a Balatro xMult joker meeting a scaling joker.
Scrip's pieces mostly add.

**Evidence:**
- **Weapons come in 3 shapes.** The 12 weapons differ in numbers (damage, cooldown, arc, pierce, bounce) and in one
  status each (burn, slow, armour). There is no orbit, lob/AoE, beam, chain, trap, structure or summon.
- **Items are 71% conditional numbers.** 57 of 80 items only add a stat or a conditional "+x% per y". The 23
  "visible" ones are levels of the same eight effects (pierce, bounce, burn, kill blast, hurt blast, thorns, node
  burst, dodge strike).
- **The conversions are additive.** For example `armorDamage` +1-4% Damage per 2 Armor and `hpDamage` +1-6% per
  10 Max HP. They work, but with a winner's median 7 Armor they give about +7-14%. They let a build exist. They do
  not make it explode.
- **Stacking is gentle.** A copy of a weapon adds `STACK_BONUS` 4% to the others. The set bonuses at 6 are +12%
  Crit / +3 Melee, or +15 HP / +4 Armor. These are solid, but none is a breakpoint.
- **Fusion cannot make a new behaviour by construction.** A fused item is built from the same primitives under a
  points budget (`MAX_POINTS` 110, `FUSION_BONUS` 1.4). It is a bigger bag of numbers, not a new rule. Fusion is the
  game's most original idea and the world recipe book makes discovery social, but what you discover is a
  re-mixed stat line. `fun.md` 5: *"Nothing makes you say 'oh, that one'."*
- **The rule-breakers are kept out of the run.** The only effects that change how the run is played
  (`extraSlot`, `safeWork`, `regrow`, `secondLife`, `extraOffer`, `noRawCost`) are relics, which the shop never sells.
- **Variety is real but low-contrast.** Default winners hold quite different kits: the mean pairwise weapon
  Jaccard is 0.37, base-item Jaccard 0.04, and 101 distinct weapon sets among 120 winners. But the top damage source is the
  sling in 58% of wins (Greenhorn), the hatchet in 75% (Sawyer) and the bow in 56% (Trapper). Runs differ in their
  ledgers more than in what the screen does.

### H3. Not enough surface, and no variance in the script

**Claim.** Breadth is what keeps the 50th run new. Brotato's main variance engine is its roster of characters, each
a hard rule. On top of that come about 66 weapons, more than 150 items, and an elite/horde pool at higher Danger.
Ours runs out after a few hours.

**Evidence:** section 1. In addition:
- **The wave script is fixed.** The stag is always in wave 6, the rotwood in wave 9 and Old Tusk in wave 12, with the same mix
  per wave every run (`waves.ts`). The only variance between runs is the shop and the node placement. Hazard 1
  moves the elites a wave earlier. It does not vary them.
- **The characters do not reorder the top.** Melee or tank is the best strategy on all six characters
  (`depth-after.md` Target 5). Four of the six twists are economic (prices, interest, fusion, tier-up), which change the
  bench's spreadsheet but not the moment-to-moment play.

### H4. The run's second half has no new power arriving: the bench goes quiet just as the build should peak

**Evidence (`depth-after.md` Target 6, `fun.md` 2):**
- Real choice among offers falls 59% → 28% → 8% → 3% → 1% → 0% from bench 5 to bench 10. Counting tier-ups, it is
  still only 41% at bench 10 and 19% at bench 11.
- The bot reaches bench 10 with 662 scrip and bench 11 with 926, yet can buy 1.6-1.7 of the 4 offers. Slots are
  full (6.0 weapons from wave 10) and raws gate the rest.
- Wave 12 averages one 58 s stretch with no level-up, no node and no boss phase.
- So the build is finished by about wave 8-9, and waves 9-12 (about 4.5 of the 9.5 combat minutes) are the same
  build against tougher enemies (H1). In Brotato, tier 4 weapons and legendary items arrive from wave 8-15, and the
  final waves are where a run spikes.

### H5. The arena has few reward beats, and gathering is a tax, not a power moment

**Evidence:**
- **Level-ups are deferred and nearly invisible.** One arrives about every 35 s. It shows as a 46 px ring for 0.16 s,
  and the pick waits for the bench (`fun.md` 3.1).
- **No surprise drops.** There are no crates or chests. Elites drop scrip and some raws (`fun.md` 5: "Nothing here
  drops a surprise"). Elites die in 8.8-9.5 s for default and about 15-18 s for melee. That is a decent set piece
  with no payoff on the floor.
- **Gathering asks the player to stop being powerful.** Working a node means standing in a ring, taking `WORK_EXPOSED`
  double damage, and calling gnats from wave 3. The default bot works 16% of wave time and takes damage 2.3x
  faster while working (0.41 against 0.18 per second). It is the novice's top killer: 75 of 200 deaths
  (`depth-after.md` Target 7). The reward (raws) is spent only at the bench, so the moment itself feels like
  waiting. In Brotato, gathering is a by-product of killing: materials drop from kills, and Harvesting pays at the end
  of the wave. Ours is a good *risk* idea (DESIGN.md wanted risk), but a risk with a delayed, invisible
  reward does not thrill.
- **Projectile density is modest.** The default reaches 11.6 attacks per second at wave 12 and the sling stack 18. By
  comparison, six Brotato SMGs at a 0.17 s base cooldown come to about 35 shots per second before any attack speed
  (an estimate from the wiki cooldown in research-arena.md 2.7). The "screen fills with my stuff" fantasy is
  a third of the reference at most.

### H6. The run's ending and its hook do not ask for another run

**Evidence:**
- **The boss is the wall, not the payoff.** For the default bot, 43 of 200 runs die in wave 12, 26% of those who reach it
  (boss pass rate 74%; `par.sh` summary line in this note's run, and 62% in `depth-after.md` before the shot changes). Losing at minute 12-13 with a flat build (H1) is the least motivating way to lose,
  because there is no "if only I had X" to chase (H2).
- **No personal best, no damage breakdown.** The death screen has no best wave and no record. The killer is named
  (good), but there is no account of the build: no "your sling stack did 82% of damage, biggest hit 246"
  (`fun.md` 5).
- **Wins look alike.** The same three-stage script ends the same way. Balatro and Brotato end a win with an
  invitation (Endless mode, a higher Stake/Danger) and a new unlock. Our ladder exists (hazard 0-5) but is
  not tied to characters as a "turn the select screen gold" goal.

---

## 3. Options

Costs: **S** is data or tuning plus a little UI, about 1-3 days. **M** is a new mechanic in the sim, about 1-2 weeks. **L** is a new system or a content wave, several weeks.

### O1. Let the build win: move difficulty from enemy HP to threat
- **What.** Flatten or soften `WAVE_HP` so fodder melts by waves 8-10 (one-hit share 70%+ for an on-plan build).
  Put the late difficulty into what one-hit kills cannot solve: elite and boss HP and behaviour, spitter
  volleys, charge lanes, and the hazard ladder.
- **Answers:** H1.
- **Reference.** Brotato: linear HP, multiplicative player, and a re-check at elites and bosses. Vampire Survivors:
  the fodder becomes confetti.
- **Cost:** S. **Risk:** win rate jumps (81% in my test), and the game gets easy for the bot while staying hard for people,
  who die to reflex threats anyway. Late waves could become boring if nothing pushes back.
- **Cheapest test.** A sim variant matrix, already started: `WAVE_HP=1`, then add back difficulty one lever at a
  time (`WAVE_DMG`, elite HP, spitter cadence, `HAZARD_*`). The goal is late one-hit share ≥ 70% *and* win rate within
  55-65%. Then a 1-day playtest of the best two variants with the person who reported the boredom.

### O2. Breakpoint items: a few multiplicative or doubling effects per tier
- **What.** About 10-15 new effects that multiply or change shape. Examples: "every shot splits in two at 50%",
  "the 6th copy of a weapon doubles its fire rate", "burn spreads to neighbours on death", "kills chain a blast
  that can kill", "x1.5 Damage while all six slots hold one weapon". Make them rare (tier 3-4, the commission) so a
  run finds one or two. **Each should be visible on screen.**
- **Answers:** H1, H2.
- **Reference.** Balatro's xMult jokers (additive chips, multiplicative mult). Brotato's set-bonus breakpoints and items like
  Turret and Landmines. Vampire Survivors' Duplicator / Empty Tome.
- **Cost:** M (new primitives in `vocab.ts`, sim, render). **Risk:** stat caps and fusion budgets must keep them
  out of fusion, or out of the `RULESET` cache. Over-tuning is easy.
- **Cheapest test.** Implement 3 primitives in a branch. Run `balance.ts strategies` with each as a free kit
  (`+kit:`), plus `feel.ts` for one-hit share and attacks per second. Target: +10-20 points win rate when found
  at bench 6-8, and a visible jump in attacks per second. A paper list of 15 candidates first.

### O3. Masterworks: weapon evolutions found through the world recipe book
- **What.** A tier 4 weapon plus a specific item (or a tool plus its matching node count) *evolves* into a named
  weapon with a new behaviour. Examples: Hatchet + Grindstone → **Felling axe** (each 5th swing fells a phantom tree
  across the arena); Bola + Snare twine → **Gaucho's net** (slowed enemies are tethered together); Musket +
  Powder horn → **Blunderbuss** (a cone of 7). Recipes are hidden, and the first finder's name goes in the town
  book next to fusion pairs.
- **Answers:** H2 (click moment), H4 (late spike), H6 (a reason to come back), and it plugs the run into the
  town's discovery loop, which is Scrip's distinctive part.
- **Reference.** Vampire Survivors evolutions (weapon + passive + chest) and unions. Halls of Torment's
  item-trait combos, where the evolution is shown as a spectacle ([PC Gamer evolutions guide](https://pcgamer.com/vampire-survivors-evolve-weapons-evolutions-guide)).
- **Cost:** M for 4-6, L for 12. **Risk:** content cost per evolution (art and sound). If they are too
  strong they become the only goal. Recipes leak to wikis, but here that is a feature, since the town book *is* the wiki.
- **Cheapest test.** A 1-day spike with 2 evolutions, each as a new weapon id with a new shot pattern. Measure
  boss TTK and one-hit share in the sim. Playtest: does the reveal land?

### O4. Behaviour-diverse weapons rather than stat-diverse ones
- **What.** Add 6-8 weapons in new attack shapes: lob/AoE (powder keg), orbit (swung chain), structure (snare
  stake / spring gun, a turret you place on a node), chain (lightning rod), beam (burning glass), summon (dog).
  Give each class at least one.
- **Answers:** H2, H3, H5 (screen density).
- **Reference.** Brotato's Engineering line (structures) and elemental weapons. Vampire Survivors' distinct weapon shapes.
- **Cost:** M per shape (sim + telegraph + art). **Risk:** readability in crowds (`fun.md` 3.1 already worries about
  this). The bot needs to learn them.
- **Cheapest test.** Paper: list shapes against classes. Spike one structure weapon. Gathering could feed it: a
  turret on a node keeps working it.

### O5. Characters as hard rules, and more of them
- **What.** Ten or more characters whose twist changes *how you play*, not the prices. Examples: **One-handed** (one weapon slot, x3
  damage), **Drover** (no weapons; your mule fights), **Collier** (cannot buy weapons, nodes give weapons), **Fiddler**
  (level-ups happen in the wave, instantly), **Hermit** (no bench offers, only fusion). Tie each to the hazard ladder
  ("beat hazard 5 with everyone").
- **Answers:** H3 (variance between runs), H6 (long goal).
- **Reference.** Brotato's roster of 48-64 characters, each a rule. Slay the Spire characters and Ascension per character.
  Balatro decks × stakes.
- **Cost:** S-M each (flags in `characters.ts` and `core.ts`). **Risk:** balance spread. Some rules will need UI.
- **Cheapest test.** Sim the default bot on each paper character via policy flags (the harness already supports
  `@character` and kits). Target: each 35-65% and a *different* top strategy (today melee/tank tops all six).

### O6. Rule-breakers inside the run: elite chests with a choice of 3
- **What.** Elites (and, rarely, rich nodes or a fleeing magpie) drop a chest. Opening it at the bench offers 3
  **run-only boons**, some of which are rule-breakers: relic-like effects such as an extra slot, safe work or regrow, plus
  O2 breakpoints. The town relics stay rare and permanent; boons last one run.
- **Answers:** H2, H5 (in-arena surprise), H4 (a late spike from wave 9's rotwood).
- **Reference.** Slay the Spire elite relics. Vampire Survivors chests (Galante's slot-machine polish on the opening
  sequence, [research-retention.md 1.2](../research/research-retention.md)). Brotato crates.
- **Cost:** M. **Risk:** devalues the relic economy if boons look like relics. Name and style them differently.
- **Cheapest test.** Harness: give the bot a random relic at bench 6 and bench 9 (the kit plumbing exists) and measure the spread
  of win rate and of one-hit share. Paper: write 20 boons.

### O7. Reward beats in the wave: visible level-ups, pick-now option, near-miss in the HUD
- **What.** Make level-up a moment (a ring, a word, a sound, a counter of owed picks). Optionally a "Fiddler" rule or
  a setting that gives an instant pick for some levels. Add mid-wave crates (O6). Show the elite's drop on the floor.
- **Answers:** H5.
- **Reference.** Vampire Survivors: a pick every 10-20 s early. Brotato: an owed-level counter and crates.
- **Cost:** S. **Risk:** low.
- **Cheapest test.** The `fun.md` event-gap metric (mean and longest gap between memorable events per wave).
  Target: longest gap under 15 s in waves 7-12 (today 23-28 s, and 58 s in wave 12).

### O8. Make gathering a power moment, not a tax
- **What.** Keep the risk, but pay it in the arena. Breaking a node gives a short visible buff ("felled: +60%
  Rate for 6 s", "ore seam: a shrapnel ring", "carcass: heal and a frenzy"). Alternatively, the felled tree falls across the crowd
  and does damage. Shorter work time with a bigger payoff. `nodeBurst` already exists as an item; make a smaller version
  base behaviour.
- **Answers:** H5, and part of H1 (spike moments).
- **Reference.** Deep Rock Galactic: Survivor, where mining is part of combat and drills scale. Brotato, where materials are a by-product of kills.
- **Cost:** S-M. **Risk:** gathering may become mandatory. Keep the noise/gnats so it stays a trade.
- **Cheapest test.** Sim: give every break a 6 s rate buff. Measure working share, damage taken while working, and novice
  deaths. Playtest: ask "did you want to go to the node?"

### O9. A late sink and a finale: masterworks at the bench, or overtime after Tusk
- **What.** (a) At benches 9-11, the commission becomes a *masterwork* (O3) or a breakpoint (O2) that costs a lot of scrip,
  so the 662-926 scrip becomes a spike. (b) After killing Tusk, "Press on?" leads to endless waves with escalating
  rewards (marks, rarer relic odds) until death, with no penalty on the win.
- **Answers:** H4, H6.
- **Reference.** Brotato Endless mode. Balatro endless after Ante 8.
- **Cost:** S (a) to M (b). **Risk:** endless needs server report caps (`server/config.ts`).
- **Cheapest test.** Sim (a): change the commission pool and measure unspent scrip and real choice at benches 9-11
  (target: 50%+ real choice at bench 10).

### O10. Run variance: a shuffled wave script and run modifiers
- **What.** Pools instead of a fixed script. Wave 6 and wave 9 draw an elite from 4-5 candidates, horde waves come at random, and
  1-2 "conditions" are rolled per run and shown at the start ("Wet season: trees hold double, boars come in
  pairs"; "Fair day: the bench has 5 offers, magpies everywhere"). The daily seed already exists, so conditions
  make every daily distinct.
- **Answers:** H3.
- **Reference.** Brotato elite/horde waves at D2+. Balatro boss blinds. Hades Pact of Punishment.
- **Cost:** S for modifiers built from existing knobs, M for new elites. **Risk:** a bad roll feels unfair. Show it before
  the run.
- **Cheapest test.** Paper: 12 modifiers from existing tuning knobs. Sim each for win-rate spread (keep within
  ±10 points).

### O11. Run-end story: personal bests and a build recap
- **What.** On death or win, show the damage share per weapon, the biggest hit, the peak attacks per second, best wave and
  best boss damage, and "Old Tusk had 2,140 HP left". The data is already in the sim (`run.dmgBy`, events).
- **Answers:** H6. It also makes H1 and H2 *visible* when they happen.
- **Reference.** Brotato's end screen with damage per weapon. Balatro's "best hand".
- **Cost:** S. **Risk:** none.
- **Cheapest test.** Ship it. It is the cheapest hook missing (`fun.md` ranks personal best first among cheap hooks).

---

## 4. Top 3 recommendations

1. **Let runs get broken (O1 + O2).** This is the most likely single cause of "fades after a few hours". The
   measurements say the player never outgrows the enemies (one-hit share falls from about 60% to about 40%, overkill stays flat at 1.7),
   and the game was tuned on purpose to prevent it. The only build that escapes, the sling stack, is also the
   one whose numbers look like Brotato's. It is cheap to explore: the curve is two arrays, and the
   sim harness in this note measures the feeling proxies directly. Start with a variant matrix that keeps `WAVE_HP`
   near 1, puts the challenge back through elites, telegraphed threats and hazard, and adds 3 breakpoint
   primitives. Judge it by late one-hit share ≥ 70% for an on-plan build, boss TTK spread (some builds 15 s,
   some 60 s), and a win rate within 55-65%.

2. **Masterworks through the world recipe book (O3, with O9a as its late-bench sink).** This gives the run its
   "click" moment and its late spike, and it ties the run to the town, the thing only Scrip has. A first-finder's
   name on an *evolution* is far more exciting than one on a stat bag. Two hand-made evolutions in a 1-day spike
   will show whether the reveal lands before any LLM or fusion work.

3. **Breadth through rules, not counts (O5 + O10, using O6 for in-run rule-breakers).** Characters that change
   *how you play*, shuffled elites and run conditions make the 30th run different from the 10th at a fraction of
   the cost of authoring 50 more weapons. Each is mostly data on existing knobs and can be checked in the sim for
   balance spread before anyone draws anything.

Cheap and worth doing alongside: **O11** (personal best and damage recap, S) and **O7** (make level-ups a beat,
S). Neither fixes the core, but both make the core visible when it works.

Not recommended yet: lengthening the run toward Brotato's 20 waves. At 13 minutes the cost of "one more run" is
already lower than Brotato's. What is missing is what happens inside the run, not how long it lasts.

### Sources
- Code and measurements: listed in section 0. Raw tables in
  `/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/design-run/power.txt` and `feel-*.txt`.
- [Brotato 1.0 press release (47 weapons, 177 items at launch)](https://www.gamespress.com/Brotato-10-Release)
- [Rogueranker tier list, patch 1.1.6 (66 weapons)](https://rogueranker.com/brotato-tier-list/)
- [Bloxodes character list (64 characters)](https://bloxodes.com/wiki/brotato/characters), [Fantasywarden beginner guide (48 base / 62 with DLC)](https://fantasywarden.com/games/brotato-beginners-guide)
- [Biligame Brotato items (158)](https://wiki.biligame.com/brotato/%E7%89%A9%E5%93%81)
- [PlayStation Country, Abyssal Terrors review (Danger 5 per character as the long goal)](https://www.playstationcountry.com/brotato-abyssal-terrors-dlc-ps5-review/)
- [PC Gamer, Vampire Survivors evolutions](https://pcgamer.com/vampire-survivors-evolve-weapons-evolutions-guide)
- [Slay the Spire: Metrics Driven Design and Balance (GDC 2019, summary)](https://summ-www.pages.dev/en-GB/summary/slay-the-spire-metrics-driven-design)
- [Game Maker's Notebook: LocalThunk on Balatro's jokers](https://gamemakersnotebook.libsyn.com/balatro-creator-localthunk-talks-inspirations-and-jokers)
- Project research: `docs/research/research-arena.md` (Brotato curve, waves, prices, weapon DPS), `docs/research/research-retention.md`.
