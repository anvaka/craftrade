# Retention, motivation and meta-progression research for a wave-arena roguelite + crafting economy browser game

Date: 2026-11-11. Research only; no game code.

## How to read this report

Every claim carries one of three tags:

- **[V]** Verified this session from web search results (source URL given). Note: direct page fetches were blocked in this environment (lostgarden.com, gamedeveloper.com, theconversation.com, deceptive.design, docs.crazygames.com, defold.com all failed DNS resolution), so "verified" means confirmed via search-engine extracts of those pages, not a full read. Quotes are as returned by the search tool.
- **[M]** From my prior knowledge of the source, not re-confirmed this session. Likely right, but check before quoting publicly.
- **[I]** My own inference or design judgement.

Gaps I could not close: LocalThunk's own words on first-hour/unlock pacing; Mega Crit's stated reasoning for the unlock track; hard drop-off curves for web/io games (portals publish benchmarks, not funnels); Dan Cook's essay in full; Pecorella's idle-game retention figures; any measured data on streak-break churn.

---

## 1. What actually produces "one more run"

### 1.1 Short, legible runs with a hard end
- [V] Brotato: 20 waves. Wave 1 lasts 20 s, +5 s per wave until 60 s (reached at wave 9), waves 9-19 are 60 s, wave 20 is 90 s. https://brotato.wiki.spellsandguns.com/Waves
- [I, computed from the above] That is 1,050 s = 17.5 minutes of combat per full run, with 19 shop breaks. A decision arrives on average every ~55 s of combat, and the first one after 20 s. This is the single most copyable number in the report: the first wave is deliberately a 20-second taster.
- [V] Brotato runs are described as "less than 30 minutes"; 40+ characters at 1.0. https://www.chalgyr.com/2023/06/news-brotato-release.html
- [V] Gervraud's stated aim: combine survivor-likes with autochess-style shops "for building unique weapon combinations". https://en.wikipedia.org/wiki/Brotato
- [M] Vampire Survivors caps a standard run at 30 minutes; Slay the Spire runs are typically 45-60+ min; Balatro 30-45 min. The shorter the run, the cheaper the "one more" decision.

### 1.2 Variance + agency (not variance alone)
- [V] Galante: "Playing with a slot machine is about pressing a button and waiting to see if I've won something" (Rock Paper Shotgun, via search). Sources disagree on scope: a Game Informer interview summary says his gambling background only influenced the treasure-chest opening, not the whole design. https://pcgamer.com/vampire-survivors-saved-its-creator-from-working-on-mobile-gambling-games ; https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613
- [V] Near-miss research (Clark et al. 2009, Neuron): near-misses were rated less pleasant than full misses but increased desire to play, and "this effect was restricted to trials where the subject had personal control". https://pmc.ncbi.nlm.nih.gov/articles/PMC2658737
- [V] Persistence peaks at a moderate near-miss rate: an inverted-U "maximal around 30%" (Kassinove & Schare 2001); a 27% near-miss rate produced 33% longer play (Cote et al. 2003). A 2019 review reportedly failed to replicate the persistence effect, so treat magnitudes cautiously. Same source family as above.
- [I] Design reading: the near-miss effect depends on perceived control. In a roguelite the honest version is a death the player can attribute to a specific choice ("I should have taken armour at wave 12"). That is real control, not illusory, and it is the ethical form of the same pull. Engineer attributable deaths: show a death recap naming the damage source, wave reached, and the 2-3 shop decisions that mattered.

### 1.3 Build discovery as the content
- [V] Koster: fun is the feedback the brain gives when absorbing patterns; boredom arrives when the pattern is mastered. (The line "fun is just another word for learning" is Chris Crawford's, per Koster's own afterword.) https://www.raphkoster.com/wp-content/uploads/2026/07/Theory-of-Fun-10-Years-Later.pdf ; https://www.shortform.com/blog/what-is-the-meaning-of-fun/
- [V] Dan Cook, Loops and Arcs: loops are repeated interactions where skill is built with immediate feedback and build "a holistic understanding of a complex system"; arcs are consumed content. https://lostgarden.com/2012/04/30/loops-and-arcs/ (via summaries: https://notes.scottshepp.com/202311202059)
- [I] A stat-build roguelite is a loop whose pattern space is combinatorial, so it takes hundreds of runs to exhaust. Crafting recipes are usually arcs (consumed once). To make the crafting layer retain, it must feed the loop (new build options) rather than be a checklist.
- [V] Balatro: 150 jokers; reviewers report "barely swam past the surface after 15 hours"; the Collection screen is described as the load-bearing replay surface. LocalThunk designed by trial and error and removed unnecessary systems. https://www.pcgamer.com/games/card-games/balatro-was-only-supposed-to-have-120-jokers-but-instead-of-correcting-a-publisher-mistake-localthunk-just-made-30-more-of-them/ ; https://localthunk.com/blog/balatro-timeline-3aarh
- [V] Slay the Spire balanced via data on every run because "we're not going to reasonably be able to balance this many cards"; goal was that every card/relic has a meaningful place, not equal power. https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder

### 1.4 Unlock cadence
- [V] Vampire Survivors: achievements are the unlock system, and the unlock screen is argued to be its key engagement tool; analysts contrast it with rivals where the first unlock takes multiple winning runs. https://loopandledger.beehiiv.com/p/the-overlooked-but-humble-magic-sauce-of-vampire-survivors ; https://game-wisdom.com/critical/success-vampire-survivors
- [V] Balatro: starts with one deck (Red); four colour decks unlock early through simple wins/milestones; later decks through wins with specific decks or stakes; 8 stakes, each unlocked per deck by beating the previous. https://casualgameguides.com/walkthroughs/balatro/unlock-guide-decks-jokers-stakes ; https://dotesports.com/indies/news/all-balatro-stakes-in-unlock-order
- [V] Slay the Spire: unlocks keyed to cumulative score per character, so losing runs still progress the track; Ascension has 20 levels, +1 per win per character, losses do not reduce it. https://slaythespire.info/en/how-to-unlock-characters-cards-and-relics-spoiler-warning/ ; https://www.pocketgamer.com/slay-the-spire/ascension-guide
- [M] Slay the Spire has 5 unlock tiers per character; Balatro ships with roughly 105 of 150 jokers available and ~45 locked behind specific feats.
- [I] Pattern across all three first hours: (a) one starting option, not a character select wall; (b) something unlocks after nearly every one of the first 3-5 runs, win or lose; (c) unlocks are new options, not stats; (d) once breadth is open, a difficulty ladder (Ascension / Stakes / Danger) takes over as the long-term mastery goal.

---

## 2. Meta-progression: widen options, do not sell power

### Evidence
- [V] Player sentiment (forum threads, not surveys): permanent stat upgrades make wins "feel hollow" because the player credits the bonuses; "grind by design, intending the player to fail and chase stat points" is disliked; defenders say the appeal is unlocking more content and that this differs from stat bumps. https://scribe.disroot.org/comment/9255518 ; https://indiecator.org/2022/03/30/on-roguelikes-and-progression-systems/
- [V] Commonly drawn line: Hades and Rogue Legacy make each run stronger through permanent upgrades; FTL, Slay the Spire, Into the Breach expand starting setups instead. Rogue Legacy 2's upgrades criticised as "too granular to have much impact"; Hades II's arcana/familiars criticised by some as flatly making the game easier. Dead Cells cited as the counter-example where unlocks raise difficulty. https://fullcleared.com/reviews/hades-ii-review/ ; https://lemmy.korz.dev/post/2392161/3025440
- [V] Hades is the well-executed version of power meta: Kasavin's goal was "how to take the sting of failure and reduce that as much as possible"; "You didn't die because you're bad, you died because that's just how the game works"; each death pays out story and relationships, not just currency; God Mode is an opt-in toggle. https://inverse.com/gaming/hades-god-mode-interview ; https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death
- [V] SDT/PENS: competence, autonomy and relatedness satisfaction predict enjoyment and continued play (Ryan, Rigby & Przybylski 2006, four studies). The vendor claim that PENS predicts sales is not peer reviewed. https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/
- [I] Power meta undermines the competence signal (was it me or the numbers?). Option meta feeds autonomy without touching competence. Hades gets away with power because its real reward on death is narrative (an arc), which you do not have.

### What should persist in YOUR game (my recommendation, [I])
The crafting economy is already a persistent layer, so the danger is double-dipping: crafted gear becoming permanent run power means rich players win and the arena stops being a skill test.

| Persist | Do not persist |
|---|---|
| Unlocked characters, weapons, item pools (options) | Flat stat bonuses bought with currency |
| Raw and refined materials, recipes known, town buildings | Crafted gear that is strictly better than the base loadout |
| Crafted **loadout sidegrades**: a starting weapon variant, a trait with a cost attached, a starting-shop modifier | Anything that makes wave 1-10 trivially safe |
| Cosmetics, titles, discovery credit, codex entries | Consumables that can be stockpiled without limit |
| Difficulty ladder progress (Danger/Ascension equivalent) | |

Rules I would hold to:
1. A fresh account must be able to beat the base difficulty with starter kit. Meta gear changes how you win, not whether.
2. Crafted run items are **consumed or capped**: e.g. bring at most 1-2 crafted "provisions" per run, each a sidegrade with a trade-off. This creates the economy's sink and keeps the market alive, and it stops power stacking.
3. Ranked/daily runs use a fixed loadout (no crafted gear) so leaderboards measure skill.
4. Higher difficulty tiers pay better and rarer materials, so skill feeds the economy, not the reverse.

---

## 3. First session for a browser game

- [V] Poki guidance (via Defold's Poki best-practices page): the best-performing games are designed for instant fun; test is "Can the player start having fun within ten seconds?". Benchmarks reported second-hand: 5+ min average playtime and 65%+ conversion-to-play. https://defold.com/extension-poki-sdk/best-practices ; https://gamedev.net/news/3701-best-practices-when-building-for-the-web/
- [V] CrazyGames: strong games "often achieve 10-15% Day 1 retention" and 10+ minutes average playtime. https://docs.crazygames.com/resources/basic-launch-metrics/
- [V] deltaDNA (5,000+ F2P games, mobile not web): games with an average first session under nine minutes only manage ~20% D1. https://www.gamedeveloper.com/business/how-first-session-length-impacts-game-performance
- [V] io-game pattern: ~five-second startup, mechanics learned in seconds, ephemeral leaderboards, one Play button plus a nickname field, no account. https://gitnation.com/contents/lessons-from-7-years-of-io-games-what-works-what-doesnt-work-where-to-go-from-here ; https://uxplanet.org/back-to-basics-what-ux-lessons-can-ux-designers-learn-from-io-games-c72f7eff60fa
- [V] Load time before first interaction is called the biggest onboarding drop-off risk (Playgama, a portal vendor blog; directional). https://playgama.com/blog/business-faqs/how-to-reduce-player-onboarding-friction-in-casual-browser-g/
- [I] Note the baseline: web D1 of 10-15% is "strong". Do not benchmark against mobile's 35-40%. Web retention is won by bookmark-worthy reasons to return (a daily, a persistent town), not by the first session alone.

### Recommended first-session timeline [I]
| Time | What happens |
|---|---|
| 0-5 s | Page loads to a playable arena. No signup, no menu beyond Play. Guest identity in local storage; account is offered later to "protect your town". |
| 5-25 s | Wave 1 (20 s, Brotato's number). Move only; weapon auto-fires. Enemies drop materials visibly. |
| ~25 s | First meaningful choice: pick 1 of 3 items. No tutorial text beyond one line per card. |
| 1-6 min | Waves 2-6. Shop introduces one new concept per wave (reroll, weapon merge, stat trade-off). |
| 6-10 min | First death or a shortened first-run win at wave 10. Death recap. One unlock granted regardless of outcome. |
| End of run 1 | The materials you picked up land in a single-slot workshop: one obvious refine button, one obvious craft. The craft is a starting item for run 2. That is the entire crafting tutorial. |
| Run 2-3 | Unlock the recipe book (with visible unknown slots). |
| Run 4-6 | Unlock the town and market, read-only at first (see what others are selling), then a sell slot. |

Principle: each layer is introduced at the moment the player has a surplus or a want that the layer resolves. Market appears when they hold a material they cannot use; recipes when they have seen a locked item on the death screen.

---

## 4. Async-online retention structures

### Daily seeded run
- [V] Spelunky Daily: one generated run per day, identical for everyone, one attempt, own leaderboard; reportedly inspired by a player's own one-run-a-night ritual. Criticisms: one attempt punishes a game about risk management, and players can watch someone else's run first. https://gamedeveloper.com/design/the-understated-genius-of-the-i-spelunky-i-daily-challenge ; https://theludite.com/2014/06/23/spelunky-when-scoring-goes-bad/
- [V] Slay the Spire Daily Climb: same seed for all, plus several modifiers from a pool of 15. https://www.pcgamesn.com/slay-the-spire/slay-the-spire-daily-challenge
- [V] Wordle: Wardle says one-a-day "enforced scarcity", leaves people wanting more, and takes "three minutes a day"; and that if the word were random per player "it wouldn't have caught on" — the shared puzzle is the social engine. Grew from 2 players to ~10 million daily by Feb 2022 with no ads or tracking. https://time.com/6143715/wordle-sale-josh-wardle-interview ; https://en.wikipedia.org/wiki/Wordle
- [M] The emoji share grid was invented by players and then adopted by Wardle; it works because it is spoiler-free, shows the shape of the struggle, and needs no link to be understood.

### Community goals
- [V] Helldivers 2 Major Orders: time-limited, game-wide, hand-authored objectives; everyone is rewarded; failure is written into the story; the director says personal progression must not conflict with the community goal. Weakness: little in-game guidance, coordination outsourced to Discord. https://www.gamesradar.com/helldivers-2-major-orders ; https://www.gfinityesports.com/article/why-helldivers-2-failed-major-orders-make-war-feel-real

### Small-population behaviour
- [V] "Most multiplayer games die within a week... because there aren't enough people playing online"; async competition (leaderboards, challenges, score comparison) was chosen by small teams precisely because it removes time dependency. https://nipsapp.com/small-budget-multiplayer-game ; https://joostdevblog.blogspot.nl/2015/09/designing-matchmaking-for-smaller.html
- [V] Koster on markets: a global auction house created "a perfect information economy" that removed variety and shut out small shopkeepers; SWG treated the economy as a game in itself. Sinks must hit all sides or you get mudflation (Mark Jacobs). https://www.raphkoster.com/?p=4080 ; https://massivelyop.com/2015/12/22/camelot-unchaineds-mark-jacobs-on-economy-crafting-and-star-wars-galaxies-inspiration/

### What works at 50 daily players vs. what feels dead [I]
| Works when nearly empty | Feels dead when empty |
|---|---|
| Daily seed with a board that shows percentile and friends, plus "ghost" bests from yesterday | Global top-100 boards with 6 names |
| Share string (works with zero other players; it is your acquisition channel) | Real-time lobbies, chat rooms, live matchmaking |
| Discovery credit ("first found by ...") — more valuable when the world is young | Player-only order-book market with no liquidity |
| Community goal scaled to active population, with a visible town change on completion | Fixed-size goals that never complete |
| Market backstopped by an NPC buyer/seller at poor prices, so every item always has a floor and a ceiling | Guilds, trading chat |
| Async ghosts: a recorded run or loadout of another player shown as a rival | Seasons with rank decay |

Liquidity rule: never show an empty list. Show 7-day history, the NPC price, and a "be the first to list" prompt that grants discovery-style credit.

---

## 5. Dark patterns, fatigue, and where the line sits

- [V] Zagal, Bjork & Lewis (2013) define dark game design patterns as design choices intentionally implemented that negatively affect players without their informed consent; three categories: temporal, monetary, social capital. https://deceptive.design/articles/dark-patterns-in-the-design-of-games ; https://research.chalmers.se/en/publication/177148
- [M] Their named patterns include grinding and playing-by-appointment (temporal), pay-to-skip and monetized rivalries (monetary), social pyramid schemes and impersonation (social).
- [V] Streaks work through loss aversion (losses weigh roughly twice gains, Kahneman & Tversky 1979); streak-expiry warnings and paid streak savers exploit this. Evidence on harm is mixed and mostly commentary. https://smashingmagazine.com/2026/02/designing-streak-system-ux-psychology/ ; https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs
- [V] Energy systems: the Dragon Age Legends post-mortem says the energy system limited game flow and real-time-tied mechanics were hard to balance. https://gamedeveloper.com/design/dragon-age-legends-post-mortem
- [V] Hades deliberately built narrative "stopping points" and did not intend to pressure players for their time. https://www.npr.org/2020/11/15/934539471/life-is-hellish-enough-thats-why-i-had-to-stop-playing-hades

### The line I would draw [I]
Test each hook with: "Would the player still thank us for this if they understood exactly how it works?"

| Fine | Not fine |
|---|---|
| One daily run that is the same for everyone; missing it costs nothing | Streak counters that reset, streak-loss warnings, paid streak repair |
| Refining that takes real time but never blocks playing a run | Energy/stamina that gates runs |
| Randomised shop offers with visible odds and rerolls bought with in-run currency | Paid random boxes; slot-machine reveal attached to purchases |
| Seasonal ladders that archive, with rewards that return later | Limited-time exclusive power; expiring currency |
| Near-miss that is true (boss at 4% HP) | Fabricated near-miss (faked reveal animations, rigged "almost") |
| Cumulative counters ("days played: 14") | Consecutive counters |

### Why players bounce from crafting-heavy games
- [V] Recurring forum complaints (anecdotal): inventory management as "the LEAST fun mechanic"; trips back to storage; stations that do not pull from nearby storage; "the game is just a menu"; upkeep that is too much. Player-requested fixes: unlimited material storage, crafting from storage, pickup filters. https://forum.norestforthewicked.com/t/early-game-inventory-management-is-a-huge-chore/1841 ; https://support.keenswh.com/medievalengineers/topic/0-7-1-crafting-is-now-tedious ; https://www.vintagestory.at/forums/topic/20775-crafting-is-killing-me/
- [V] Koster notes even SWG's well-designed harvesting was felt as grinding by players. https://www.raphkoster.com/?p=25717
- [I] Rules: materials have no inventory limit and auto-deposit at run end; craft from one global stash; one-click "craft max"; no decay, no upkeep, no mandatory collection; gathering happens inside the fun (the run), never as a separate chore mode; recipe depth should be at most 3 steps from raw to usable.

---

## 6. Curiosity and knowledge as progression

- [V] Outer Wilds: "not resources, abilities or upgrades, but snippets of knowledge" stored in the ship log as a web of rumours. (Edge review) https://www.pressreader.com/australia/edge/20190620/282278141843961
- [V] Infinite Craft: the same pair always yields the same result for all players, and the first person to create an element gets a "First Discovery" tag; press and players shared their firsts. https://en.wikipedia.org/wiki/Infinite_Craft ; https://www.pcgamer.com/this-browser-based-endless-crafting-game-starts-you-off-with-fire-and-water-but-it-quickly-escalates-to-god-the-big-bang-and-yin-yoda
- [V] Noita: three top-tier substances exist only through alchemy and their recipes are randomised per world; for a period there was no in-game way to learn them, so players used external seed tools. The Cauldron Room and nine Eye Messages kept the community decompiling the game for 5+ years. https://noita.wiki.gg/wiki/Cauldron ; https://noita.wiki.gg/wiki/Mysteries_and_Oddities
- [I] Lessons:
  1. Global-deterministic recipes (Infinite Craft) create shared knowledge and wiki culture; per-seed recipes (Noita) create tool-assisted frustration. Use global recipes, and reserve per-day variation for the daily seed only.
  2. A wiki will exist within days. Design for it: have two knowledge layers. Layer A (recipes) will be fully documented; that is fine, it is onboarding. Layer B (synergies that emerge from stat interactions, undocumented item-pair effects, conditional recipes that depend on how a material was obtained) keeps experts exploring.
  3. Show the shape of the unknown: recipe book with silhouettes and counts ("17/60 found, 3 found by nobody yet"). Koster's pattern-learning needs a visible frontier.
  4. Give in-game clues so curiosity is solvable by play, not only by datamining: partial hints from failed combinations, rumours bought from a town NPC.
  5. Server-wide "first discovered by" credit, plus personal "you discovered" credit so latecomers still get the moment. Add a small pool of new undiscovered recipes each season to reset the frontier.

---

## 7. Recommendations for the fused design

All [I], grounded in the evidence above.

### R1. Make the run the gathering step
Enemies and wave events drop raw materials; the run is 15-18 minutes in the Brotato shape (20 s first wave, shop every wave). There is no separate gathering mode. Core loop: **Run (gather + build) -> Workshop (refine, craft 1-2 sidegrade provisions, discover recipes) -> Town (sell surplus, contribute, check daily) -> Run.** The between-run stop should take under 60 seconds if the player wants it to.

### R2. Persist options and knowledge, never raw power
Follow the table in section 2. Crafted items are capped, consumed sidegrades; ranked play uses fixed loadouts; a difficulty ladder of ~5-10 tiers (Brotato has danger levels, Slay the Spire 20, its sequel cut to 10) is the long-term mastery track and pays better materials.

### R3. Guarantee an unlock after each of the first five runs, win or lose
Score-based like Slay the Spire, so a loss still progresses. Order them to teach: run 1 workshop, run 2 second character, run 3 recipe book, run 4 market, run 5 daily. After that, slow to roughly one unlock per 2-3 runs and let the ladder carry.

### R4. Ten seconds to control, twenty-five to the first choice, no signup
Guest play by default; offer an account only after the player has something to protect.

### R5. Make deaths attributable
Death recap with killer, wave, DPS curve against wave requirement, and the one material you were closest to completing a recipe with. This is the honest near-miss.

### R6. Kill crafting chores at the design stage
Unlimited stash, auto-deposit, craft-from-stash, no upkeep, timers never gate runs, max 3 recipe steps.

### R7. Backstop the economy for an empty server
NPC floor and ceiling prices, price history, population-scaled community goals, percentile and friends boards. Avoid a frictionless all-seeing auction house as the only market surface (Koster); let player stalls or limited listing slots give small sellers a niche.

### R8. Reset the frontier, not the player
Seasons add new undiscovered recipes and a new daily modifier pool, and archive leaderboards. No wipes of the town, no expiring currency.

### Session structures
- **5-minute player:** the Daily. Same seed for everyone, fixed loadout, shortened to ~8-10 waves (about 5-6 minutes), one scored attempt plus unlimited unscored practice (softens the Spelunky criticism). Ends with a share string and a percentile. Also collects finished refines and lists one item.
- **20-minute player:** one full run plus a workshop stop: refine, craft one provision for next time, try 2-3 unknown combinations, sell surplus. Leaves with a planned next run ("I now have the Frost Coil to start with").
- **2-hour player:** 4-5 runs across different characters, pushing a difficulty tier, with deliberate recipe hunting and market play between runs, and a contribution to the weekly town goal. The variety comes from characters and crafted sidegrades, not from longer runs.

### The three retention hooks to build first
1. **Daily seeded run + share string + percentile board.** Works with one player, is its own marketing, and creates a three-to-six-minute daily habit without punishing absence. Example string: game name, day number, wave reached, a row of emoji for build archetype, percentile. No spoilers of the seed.
2. **Global recipe discovery with first-finder credit and a visible, silhouetted codex.** Converts the crafting layer from chores into curiosity, seeds wiki/Discord culture, and is strongest when the server is young.
3. **Unlock track that widens the build space, then a difficulty ladder.** The proven Slay the Spire / Balatro / Brotato structure: breadth for the first hours, depth after.

Build weekly community goals fourth; they need a population to feel real, and the first three do not.

---

## Source list (all URLs cited above)

- https://brotato.wiki.spellsandguns.com/Waves
- https://en.wikipedia.org/wiki/Brotato
- https://www.chalgyr.com/2023/06/news-brotato-release.html
- https://pcgamer.com/vampire-survivors-saved-its-creator-from-working-on-mobile-gambling-games
- https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613
- https://loopandledger.beehiiv.com/p/the-overlooked-but-humble-magic-sauce-of-vampire-survivors
- https://game-wisdom.com/critical/success-vampire-survivors
- https://pmc.ncbi.nlm.nih.gov/articles/PMC2658737
- https://localthunk.com/blog/balatro-timeline-3aarh
- https://www.pcgamer.com/games/card-games/balatro-was-only-supposed-to-have-120-jokers-but-instead-of-correcting-a-publisher-mistake-localthunk-just-made-30-more-of-them/
- https://casualgameguides.com/walkthroughs/balatro/unlock-guide-decks-jokers-stakes
- https://dotesports.com/indies/news/all-balatro-stakes-in-unlock-order
- https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder
- https://slaythespire.info/en/how-to-unlock-characters-cards-and-relics-spoiler-warning/
- https://www.pocketgamer.com/slay-the-spire/ascension-guide
- https://www.pcgamesn.com/slay-the-spire/slay-the-spire-daily-challenge
- https://inverse.com/gaming/hades-god-mode-interview
- https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death
- https://www.npr.org/2020/11/15/934539471/life-is-hellish-enough-thats-why-i-had-to-stop-playing-hades
- https://scribe.disroot.org/comment/9255518
- https://indiecator.org/2022/03/30/on-roguelikes-and-progression-systems/
- https://fullcleared.com/reviews/hades-ii-review/
- https://lemmy.korz.dev/post/2392161/3025440
- https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/
- https://lostgarden.com/2012/04/30/loops-and-arcs/
- https://notes.scottshepp.com/202311202059
- https://www.raphkoster.com/wp-content/uploads/2026/07/Theory-of-Fun-10-Years-Later.pdf
- https://www.shortform.com/blog/what-is-the-meaning-of-fun/
- https://www.raphkoster.com/?p=4080
- https://www.raphkoster.com/?p=25717
- https://massivelyop.com/2015/12/22/camelot-unchaineds-mark-jacobs-on-economy-crafting-and-star-wars-galaxies-inspiration/
- https://defold.com/extension-poki-sdk/best-practices
- https://gamedev.net/news/3701-best-practices-when-building-for-the-web/
- https://docs.crazygames.com/resources/basic-launch-metrics/
- https://www.gamedeveloper.com/business/how-first-session-length-impacts-game-performance
- https://gitnation.com/contents/lessons-from-7-years-of-io-games-what-works-what-doesnt-work-where-to-go-from-here
- https://uxplanet.org/back-to-basics-what-ux-lessons-can-ux-designers-learn-from-io-games-c72f7eff60fa
- https://playgama.com/blog/business-faqs/how-to-reduce-player-onboarding-friction-in-casual-browser-g/
- https://gamedeveloper.com/design/the-understated-genius-of-the-i-spelunky-i-daily-challenge
- https://theludite.com/2014/06/23/spelunky-when-scoring-goes-bad/
- https://time.com/6143715/wordle-sale-josh-wardle-interview
- https://en.wikipedia.org/wiki/Wordle
- https://www.gamedeveloper.com/marketing/josh-wardle-reflects-on-the-the-unconventional-road-to-wordle-s-success
- https://www.gamesradar.com/helldivers-2-major-orders
- https://www.gfinityesports.com/article/why-helldivers-2-failed-major-orders-make-war-feel-real
- https://nipsapp.com/small-budget-multiplayer-game
- https://joostdevblog.blogspot.nl/2015/09/designing-matchmaking-for-smaller.html
- https://deceptive.design/articles/dark-patterns-in-the-design-of-games
- https://research.chalmers.se/en/publication/177148
- https://smashingmagazine.com/2026/02/designing-streak-system-ux-psychology/
- https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs
- https://gamedeveloper.com/design/dragon-age-legends-post-mortem
- https://forum.norestforthewicked.com/t/early-game-inventory-management-is-a-huge-chore/1841
- https://support.keenswh.com/medievalengineers/topic/0-7-1-crafting-is-now-tedious
- https://www.vintagestory.at/forums/topic/20775-crafting-is-killing-me/
- https://www.pressreader.com/australia/edge/20190620/282278141843961
- https://en.wikipedia.org/wiki/Infinite_Craft
- https://www.pcgamer.com/this-browser-based-endless-crafting-game-starts-you-off-with-fire-and-water-but-it-quickly-escalates-to-god-the-big-bang-and-yin-yoda
- https://noita.wiki.gg/wiki/Cauldron
- https://noita.wiki.gg/wiki/Mysteries_and_Oddities
