# Why motivation fades: an engagement exploration

Lens: the psychology of engagement (session structure, reward cadence, juice, identity).
Question from the owner: "I enjoyed a few hours, then got bored. Brotato and New World keep me. Something is lacking."
Nothing in the game was changed. This is a map of options, not a plan.

Evidence used:

- Code read: `src/client/game/*`, `src/client/audio/*`, `src/client/town/homecoming.ts`, `src/sim/data/*`, `src/shared/content/items.ts`, `src/client/ui/theme.css`, `docs/DESIGN.md` 7 and 10.
- Earlier critiques: `docs/critique/fun.md`, `feel-after.md`, `depth-after.md`, `meta-after.md`, `docs/research/research-retention.md`.
- Fresh pacing run on today's tree: `VERBOSE=1 npx tsx tools/exp/fun/survival.ts expert|average 30` (30 seeds each, so treat as indicative, about +-15 points on rates).
- Screenshots of the live dev server (1280x720 and a 390x844 phone) in
  `/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/design-feel/` (named below as `design-feel/...`).

Frameworks, with the one idea taken from each:

| Framework | The idea used here | Source |
|---|---|---|
| Self-Determination Theory (Ryan, Rigby, Przybylski 2006) | Games hold people when they feed competence, autonomy and relatedness; enjoyment and intent to return track all three | [Motivation and Emotion 30(4)](https://doi.org/10.1007/s11031-006-9051-8) |
| Quantic Foundry, 12 motivations (Yee) | Action (Destruction, Excitement), Social (Competition, Community), Mastery (Challenge, Strategy), Achievement (Completion, Power), Immersion (Fantasy, Story), Creativity (Design, Discovery) | [quanticfoundry.com](https://quanticfoundry.com/), [GDC 2019 talk](https://gdcvault.com/play/1025742) |
| Bartle | Achievers, explorers, socialisers, killers: the town economy speaks to achievers and socialisers only if other people are visibly there | Bartle 1996, "Hearts, Clubs, Diamonds, Spades" |
| Variable-ratio rewards | Unpredictable payouts sustain behaviour; ethical when there is no money, no loss-chasing and the odds are legible. Vampire Survivors' chest animation is the genre's named example | [The Conversation on VS](https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613), [Game Developer](https://gamedeveloper.com/design/vampire-survivors-development-sounds-like-an-open-source-fueled-fever-dream) |
| Flow (Csikszentmihalyi) | Challenge rising with skill, with rests; boredom is too little challenge or too little change, not only too little difficulty | |
| Compulsion loop vs intrinsic loop | A loop that pays out extrinsics (currency) burns out once the numbers stop meaning anything; an intrinsic loop (discovery, expression, mastery) does not | |
| Goal-gradient (Hull; Kivetz, Urminsky, Zheng 2006) | Effort speeds up as a visible goal gets close; a progress bar that is 80% full pulls harder than an abstract total | [JMR 43(1)](https://doi.org/10.1509/jmkr.43.1.39) |
| Zeigarnik / open loops | Unfinished tasks stay in mind; a session that ends one step from something concrete is remembered and resumed | |
| Juice | "Juice it or lose it" (Jonasson and Purho, 2012) and "The art of screenshake" (Nijman, 2013): feedback amplitude is how a player feels power | [YouTube](https://www.youtube.com/watch?v=Fy0aCDmgnxg), [YouTube](https://www.youtube.com/watch?v=AJdEqssNZ-U) (links from memory, not fetched) |

Brotato facts used (20 waves, first 20 s, last 90 s, crates dropped in battle, items with trade-offs in four tiers): [Wikipedia](https://en.wikipedia.org/wiki/Brotato), [bloxodes wiki](https://bloxodes.com/wiki/brotato). I found no Blobfish design interview; claims about Brotato's feel below are from play knowledge and are marked as such.

## 1. Audit

What has already been fixed matters: since `fun.md`, the early wall is gone (novice dies in waves 1-2 in 0% of runs), level-up and wave-clear are beats, deaths are attributed, there is a work song, a "Best / Close / Next" recap and a "Go again" with focus. So the problem the owner feels after a few hours is not the first-hour problem. The table is about hour 2 onward.

| Motivation | What Scrip offers now | What Brotato / New World offer | Gap |
|---|---|---|---|
| **Destruction / power (QF Action, Achievement)** | A small ochre figure with 6 tiny orbiting sprites; 15 px ink damage numbers, 20 px crits; hit flash is 2 frames of ink. Mean enemies on screen 4-12 in waves 1-7, 22-36 in waves 8-11 (expert). At wave 10, level 14, six weapons, the frame looks like wave 3 with more numbers (`design-feel/w10-20000.png`). DESIGN 7.1 and 10 forbid glow, blur, extra colours, UI animation over 80 ms | Brotato: six visible weapons firing in all directions, enemies by the dozen melting, a potato that is visibly absurd by wave 15 (play knowledge). New World: big weapon swings, heavy sound | **Large.** The game never says "you are now terrifying". Rules written against AI slop also cap the power fantasy |
| **Excitement / surprise (variable reward)** | Arena payouts are fixed: scrip per enemy, fixed node yields, an elite drops a card "The stag is down. It dropped 40 scrip." (`design-feel/w6-26000.png`). No crates, chests, rare drops. All variance lives in the 4 bench offers, which are mostly stat lines | Brotato: crates mid-wave, opened at the shop, legendary chance. VS: chests with a slot-machine sequence. New World: named drops, gear score rolls | **Large.** Nothing in the arena can surprise you |
| **Reward cadence in a run** | Measured "dead air" (seconds per wave with no level, node, hit taken or elite event): expert 12, 10, 25, 23, 30, 7, 48 s in waves 5-7 and 9-12; longest silent stretch 19-44 s. Level-ups about 1.5-2 a wave and the pick waits for the bench | Brotato waves are denser and the level-ups are counted on screen; VS gives a choice every 10-20 s early on (fun.md 2) | **Medium.** Kills tick on, but memorable moments are 9-12 s apart in the back half |
| **Strategy / autonomy (build expression)** | 13 weapons, about 80 items, 6 characters. The average policy has 6 of 6 weapon slots full by wave 5; after that the bench is tier up, combine, scrap. 600-950 scrip sits unspent at benches 9-11. Level picks are "+10% Rate / +2 Ranged / +3 Max HP / +7% Dodge" (`design-feel/bench4-4000.png`) | Brotato: dozens of characters with rule-breaking twists, items that bend builds (trade-offs on every item), a build that keeps growing to wave 20 (play knowledge) | **Large in the second half of a run.** The build is "done" at wave 5-6 of 12 |
| **Challenge / competence and mastery feedback** | Now good: hit direction wedge, "A mite got you", near-miss line, best wave, a 36-cell hazard ladder. Average policy wins about half its runs | Brotato: Danger 0-5 per character, a clear "beat it on D5" target (play knowledge) | Small. The ladder exists but `meta-after.md` says it "has no teeth until the sim scales with hazard" |
| **Completion (collection, goals across runs)** | Character unlocks at runs 2, 6, 7, 8, 9, "won or lost". Codex is a search box; DESIGN 4.2 promises silhouettes, not built (fun.md 5). An 852-entry almanac and titles exist | Brotato: characters and items unlocked by deeds ("win with X"), each a small build challenge. New World: gear score, trade levels, map completion | **Large after run 9.** Unlocks are by attendance, so they never pull toward playing differently; at run 9 they stop |
| **Fantasy / identity** | Frontier tradesman in a clearing; "Greenhorn: Plain kit and no favours."; enemies are pests (mites, gnats, toads, badgers); voice rules: dry, no exclamation marks, "things a tired person would call them"; default name "Hooper 834" | Brotato: a comic potato with a minigun, absurd characters (play knowledge). New World: adventurer on a haunted island | **Medium-large.** The fantasy is honest work under pressure, which is coherent and handsome but not aspirational; there is no joke and no hero |
| **Discovery (QF Creativity)** | Fusion: a pair nobody has tried gets your name forever. The one unique hook. Reached about once a run by the bot | Brotato: none of this. New World: recipe discovery is mild | Scrip leads here, but it is gated behind two bought items and dry names |
| **Relatedness / community** | Shared town, market, daily board, first-finder stamps, Woad names. Solo mode has none of it. Others appear as rows in ledgers | New World: people everywhere, companies, wars, trade with faces. Brotato: none, and does not need it | **Medium.** The shared world exists on paper; you rarely feel anyone else in it |
| **Session structure / friction** | Control in 0.73 s; death to focused "Go again" in 1.5 s; run 12 waves in about 13 minutes; 11 benches | Brotato: 20 waves, 19 shops, 25-35 min; New World: open-ended sessions | Friction is excellent. 13 min with 11 benches gives fewer build moments than Brotato's 19 |
| **Session end open loop** | Recap now has "Close", "Best", "Next: clear wave 4 and one item comes home" | Brotato: "1 more win unlocks X" (play knowledge). New World: a half-full skill bar, an expedition tomorrow | Good inside a run's arc; weak across sessions once carry and characters are done |

## 2. Diagnosis

### H1. The power fantasy is capped by the art rules, so growth is invisible

Evidence:
- `docs/DESIGN.md` 7.1 and 10: seven colours with one job each, no glow or blur, "nothing animates for longer than 80 ms" in UI, hit-stop "only when you are hurt or an elite dies" (since loosened to 2 frames on big blows). These rules were written to avoid generic AI look and they succeed, but they also forbid most of the vocabulary of power: bloom, colour-cycling crits, screen-filling bursts.
- Damage numbers are 15 px ink, crits 20 px ochre (`render.ts` around line 1050), the same size at wave 1 and wave 12.
- Weapons are small orbiting sprites; six weapons at tier 3 look like one figure with a halo (`design-feel/w10-20000.png`, `design-feel/w6-14000.png`).
- Density: mean on screen 4.4, 2.6, 6.2, 6.9, 9.3, 8.9, 12.6 in waves 1-7 (expert, today). Phone view at wave 6 shows zero enemies (`design-feel/phone6-8000.png`); wave 8 "A raid" at 7 s shows zero (`design-feel/w8-f2.png`).
- The design itself names Power (QF) as a goal only implicitly; "Destruction" is the top motivation of the survivor-like audience (inference from the genre's success; Quantic Foundry publishes per-genre profiles but I did not fetch them).

Why it matters: in SDT terms, competence is felt through feedback. When level 14 looks like level 2 the player stops perceiving progress even though the numbers went up. This is the classic reason a compulsion loop with numeric rewards burns out after a few hours.

### H2. The arena never surprises; all randomness sits in a list at the bench

Evidence: no crates, chests or rare drops in the sim (`grep crate|chest src/sim` finds nothing); elites pay scrip ("It dropped 40 scrip"); node yields are fixed; rich nodes from wave 3. Level picks are flat stat lines that break DESIGN 10.11 ("an upgrade that is only a small percentage on one stat with no cost and no hook"), visible on today's bench (`design-feel/bench4-4000.png`). fun.md 5: "Nothing makes you say 'oh, that one'."

Why it matters: variable-ratio reward is what makes the next 30 seconds interesting. Without it the run is a known quantity after a handful of runs, which is exactly the "few hours" horizon the owner describes. VS's chest sequence is the genre's proof (The Conversation, Game Developer, above).

### H3. The build is finished halfway through the run

Evidence (today's tree, average policy, 30 seeds): weapons at wave start 4.0, 5.4, 6.0 from waves 3, 4, 5; scrip held at benches 9-11 is 646, 829, 946; affordable offers 2.8-3.4 of 4. Expert: 6.0 weapons from wave 10, 584-800 scrip at benches 9-11. `depth-after.md`: "the late bench is still mostly 'buy what is worth it'".

Why it matters: autonomy (SDT) and Strategy (QF) live in decisions with consequence. Waves 7-12 are 6 of 13 minutes, the hardest and most dramatic, and they are the ones with the fewest interesting choices. The run peaks in the middle and then plays out.

### H4. Long-term goals are by attendance, then stop, and they do not ask you to play differently

Evidence: town shows "Heads out after 2 / 6 / 7 / 8 / 9 more runs, won or lost" (`design-feel/town-full.png`). Features open at runs 1, 3, 4, 5. After run 9 the remaining goals are economic (marks, raws, a town project, hazard cells, an 852-line almanac). A few hours of play is roughly 10-15 runs: the owner's boredom lands right after the last attendance unlock. Codex silhouettes from DESIGN 4.2 are not built.

Why it matters: goal-gradient and Zeigarnik both need a concrete, visible, near goal. "Raise the station" is a total; "Win with four bows held to unlock the Bowyer" is a near goal that also gives a reason to try a new build (autonomy plus competence). Brotato's achievement unlocks do this (play knowledge).

### H5. The fantasy is coherent but not aspirational, and the voice leaves no room for a laugh

Evidence: "Greenhorn: Plain kit and no favours."; pests as enemies; DESIGN 7.3 "Dry, practical, short ... no exclamation marks"; names like "Hooper 834"; fusion fallback names "tarred knife" (fun.md 6). The hero is a labourer with a sling in a field. Character twists are book-keeping ("Rerolls cost half as much again").

Why it matters: QF Fantasy is a minor motivation for this genre but identity is how a player remembers a game and tells a friend about it. Brotato's potato works because it is a joke that the game commits to; New World's because it is a hero. Scrip's tone is neither. Humour is also the cheapest surprise there is (H2).

### H6. The shared world is invisible from inside the run, and absent in solo

Evidence: other players appear as Woad names in market and board ledgers; solo mode shows "World: Solo" and nothing else. No other player's work ever enters your run, apart from first-finder names on fused items. The owner likely plays solo or in a near-empty town.

Why it matters: relatedness is the third SDT need and the thing New World has that Brotato does not. Async presence (Dark Souls messages, Death Stranding structures, a daily leaderboard rival) is enough; it does not need live multiplayer.

Not a main cause, in my reading: friction (excellent), death clarity (now good), difficulty (in a sensible band since the rework).

## 3. Options

Costs: S = days, M = 1-2 weeks, L = more. "Cheapest test" is meant to be run before committing.

| # | What | Hypothesis | Reference | Cost | Risk | Cheapest test |
|---|---|---|---|---|---|---|
| O1 | **Visible power ladder.** Weapons drawn bigger and with more of themselves per tier (a tier IV pike is a different silhouette); shot count and sweep arcs readable at a glance; damage numbers grow with the hit (15 px to 30 px by size of blow); a "print burst" kill effect in ochre and ink that scales with overkill. Stays in palette; relaxes the "hit-stop only when hurt" spirit for the arena only | H1 | Brotato's weapon ring, VS evolutions, Nijman's screenshake talk | M | Readability in crowds (the player was already hard to find in wave 12 before `feel-after.md`); phone perf | Behind a `?juice=1` dev flag: number size by damage and tier-scaled sprites only. Record wave 3 and wave 10 side by side and ask 3 players "how strong do you feel" on a 1-7 scale |
| O2 | **Horde density pass.** More, weaker enemies in waves 1-7 (for example twice the count at half the health) so the screen fills and clears; same damage per second against the player | H1 | VS, Brotato | S (data only) | Phone perf at 300 cap; spitters must not double | Patched sim via `tools/exp/fun/mkvariant.mjs`: spawn interval x0.5, hp x0.5 for mites, gnats, boars; check kills/s, onScreen and novice survival with `survival.ts`, then watch one bot run |
| O3 | **Arena surprises.** A crate or "bundle" dropped by elites and rarely by ordinary enemies, opened with a beat at the bench: one item of a tier above the bench, a free fusion, or an untried pair. A rare "lode" node that pays a relic chance. Odds shown in the codex | H2 | Brotato crates, VS chests (with the ethics: no money, no pity timers to exploit, no loss-chasing) | M | Inflation of power; LLM fusion cost if bundles can trigger it | Elite death guarantees one tier+1 item at the next bench. Ask testers afterwards "what do you remember from that run"; count mentions |
| O4 | **Picks with a hook.** Replace flat stat picks with picks that change behaviour or carry a cost ("+30% Rate, shots wobble"; "Every 10th kill throws a powder blast"), following DESIGN 10.11 | H2, H3 | Brotato items with trade-offs, Hades boons | M (design heavy) | Balance surface grows | Write 12 hook picks on paper, swap them in through `upgrades.ts` data for one playtest weekend, compare pick-time hesitation and "favourite pick" answers |
| O5 | **A build that grows to wave 12.** Weapon evolutions as a bench action from wave 7 (two tier IV weapons plus a matching item make a named fifth-tier weapon); or slot growth tied to sets; a late scrip sink (buy raws, reforge) | H3 | VS evolutions, Brotato late stat stacking | M-L | Scope; depth balance re-measure | Sim-only: give the bot a scrip-for-raws exchange from bench 7 and measure affordable offers and unspent scrip; if it drops to near zero, the sink works |
| O6 | **Deed-gated unlocks and visible near-goals.** Characters, weapons and items unlocked by doing something ("Reach wave 8 holding four bows", "Break 20 nodes in one run", "Fuse a pair nobody has tried"). Show the three nearest as progress bars on the town page and the recap ("Bowyer: 3 of 4 bows held") | H4 | Brotato and VS unlock lists, Balatro's collection | S-M | DESIGN 10.10 bans achievements for trivial actions; these are not trivial, keep them about builds | Add 5 deed goals to the recap's "Next" line only (no new content, just tracking) and see if testers try the named build in the next run |
| O7 | **Collection made visible.** Codex as a grid with silhouettes for unknown fusions next to known ones ("14 of 903 pairs known to you, 212 to the town"), and a "found today" line in town | H4, H6 | Balatro collection, VS grid | S | None obvious | One static count line on the town page; watch whether testers open the codex more |
| O8 | **Identity and humour pass.** Keep the print look; give the frontier a tall-tale register: characters with outrageous but grounded twists (a one-armed logger who throws the axe, a preacher whose kills heal, a drunk surveyor who walks off-line), wave briefs with a wink, enemies with personality, a name generator that is not "Trade 834" | H5, H2 | Brotato's characters, Darkest Dungeon's narrator, Paul Bunyan tall tales | S for words, M for art | Breaks the dry voice the project is proud of; humour that misses is worse than none | Paper test: write 6 characters in two registers (current dry vs tall tale), show to 5 genre players, ask which they would pick first |
| O9 | **Async presence in the run.** Other players' fused items appear in your offers with their names; a "ghost" ledger line at the bench ("Baker 158 reached wave 11 with this seed"); the daily shows your rival one rank above. In solo, the same with named NPC rivals | H6 | Dark Souls messages, Death Stranding, Spelunky daily | M | Server load; solo needs a fiction for it | Show one line on the recap, "Two other players fell to the stag today", from existing board data |
| O10 | **Run structure variants.** An endless mode after wave 12 (Brotato has one), or a "long haul" 20-wave run with shorter waves and more benches | H3, H4 | Brotato endless, Brotato's 20 waves | S-M | Balance, replay caps | Dev flag letting the run continue past 12 with wave 12 rules escalating; see if testers keep going |
| O11 | **Mid-wave micro-goals to fill dead air.** A marked bounty enemy, a 15 s node rush, a magpie carrying a prize | H2 | Risk of Rain shrines, Halls of Torment | M | Clutter, more telegraphs | Sim measure: one bounty per wave in waves 7-12 cuts measured dead air from 25-48 s to what? |
| O12 | **Listen to it.** Nobody has heard the audio (`feel-after.md`). A kill and crit sound with weight, a level-up jingle, the work song audible on phone speakers | H1 | Nijman: sound is half of feel | S | None | One hour with headphones and a phone speaker, notes per sound |

## 4. Top three

1. **Make power visible (O1 with O2, and O12).** This is the most likely single reason the game feels flat after a few hours: the numbers grow and the screen does not. Start with the cheapest pieces, damage numbers that scale with the hit and tier-scaled weapon sprites behind a dev flag, plus a density variant in the sim. Decide openly which DESIGN 7.1 and 10 rules are about avoiding slop and which are accidentally about avoiding power. A sharper print style can still burst.

2. **Put surprise in the arena and keep the build growing (O3 with O4 or O5).** A crate from elites, opened at the bench, gives the run a variable reward that is honest (no money, odds in the codex), and gives waves 7-12 something to want. Pair it with either hook picks or a late evolution step, so the second half of the run has decisions again. Cheapest test: elite death guarantees a tier+1 item at the next bench.

3. **Give every session a concrete next goal that asks for a different build (O6 with O7).** Replace "heads out after N runs" with deeds, show the three nearest as bars on the recap and town page, and show the fusion collection as a count with silhouettes. This turns the end of each session into an open loop ("one bow short of the Bowyer") and steers players into new builds, which feeds autonomy and makes the content they already have feel bigger.

Identity (O8) and presence (O9) are worth a later decision: they change what Scrip is, not how it plays, and the owner should choose deliberately between the dry almanac and a funnier tall tale.
