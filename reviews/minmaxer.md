# Min-maxer review: session loop and economy

## 1. Verdict

The author's "real choices" come from testing only 384 fixed policies: a state-dependent player earns 2.6x to 2.9x the author's best at every skill level, with the same build order each time. Spend-or-save, curses, route and extraction depth are scripted by wave number; only gather throttling still needs judgement.

## 2. The dominant strategy

Same model, same rules and random draws (my re-implementation reproduces the author's numbers exactly). I searched a 111-parameter policy with a cross-entropy search and scored it on 40,000 held-out runs. The search kept finding better basins, so my figures are lower bounds.

| Skill | Author's best (re-scored) | Author's death rate | My best | Gain | My death rate | My depth (author's) | One-line rule |
|---|---|---|---|---|---|---|---|
| Casual | 107 | 3% | 289 | +169% | 5% | boss 3 (2) | 212 |
| Regular | 145 | 16% | 371 | +155% | 2% | boss 3 (2) | 277 |
| Hardcore | 175 | 40% | 503 | +187% | 8% | boss 4 (3) | 398 |

**Snowball, then hoard.**
- Pick your boss: 3 for casual and regular, 4 for hardcore.
- Spend 100% of materials until about eight waves before it, then spend nothing.
- Take the rich route until the last two or three waves.
- Take every curse.
- Gather only as much as keeps your power level with the wave; stop on the boss wave.

The bag holds under 3 units for the first 7 to 12 waves, so there is nothing to lose while the run is dangerous.

**Is it solved?** The shape is; the tuning is not. One shared rule, with only the target boss varying, reaches 73% to 79% of my best and about 2x the author's best. A fixed per-wave table that ignores hp and heat reaches 38%, 79% and 88% (casual, regular, hardcore).

Deviations from that rule (the "One-line rule" column), in value per run:

| Deviation | Casual | Regular | Hardcore |
|---|---|---|---|
| Rule as written | 212 | 276 | 398 |
| No curses | 125 | 159 | 222 |
| Never rich | 125 | 206 | 117 |
| Spend 33% while hoarding | 193 | 220 | 323 |
| Never spend | 47 | 55 | 60 |
| Gather flat-out | 39 | 105 | 137 |

## 3. Degenerate strategies, ranked by damage

1. **Five-wave reset farming.** Extracting at boss 1 pays 19.6, 21.5 and 24.1 value per wave at 3% to 4% death, against 19.3, 24.8 and 25.1 for my deep runs. Depth buys nothing per hour. Breaks *boss gate choice*, *expedition keys*, *power never outruns the wave*.
2. **Death does not matter.** Changing the share kept on death from 0% to 80% moves my best by at most 3%. Breaks *only banked materials survive*. Not modelled: the emergency recall banks before the boss and skips the *extraction run*.
3. **Curses are mandatory.** The design states the prize always beats the safe option, so it is not a choice. Breaks *opt-in curses*.
4. **Bag set down.** Drop it behind a felled-tree barricade, fight at full speed, collect it in the scripted spawn pause. Removing bag weight is worth only 8% to 16% anyway. Breaks *carry weight*, *crafted bags*, the *extraction run*.
5. **Heat dodged by timing.** Gather in the lull and the post-peak pause; if waves end on kills, kite the last enemy and strip the arena. Avoiding heat is worth 16% to 22%. Breaks *struck nodes raise heat*, *rich nodes sit where the danger is*.
6. **Kill method equals weapon.** Auto-attacks cannot be withheld, so the build is the drop table. Everyone runs the element whose drop sells best and buys the rest. Breaks *how you kill decides what you collect*, *enemy roles*.
7. **Schematics by proxy.** Crafted gear is tradable, so one crafter with the full book serves everyone. The collection only matters to crafters.
8. **Evolution tier list.** One part, one weapon, planned from wave 1; rich is always taken, so the part is free. Breaks *recipe merges* as variety.
9. **Alts and ghosts.** Front-loaded weekly rewards and per-account vaults make three wins on each alt beat extra wins on the main. Extracting a stripped build seeds easy ghosts for the PvP track.
10. **Failure farming.** Failed runs still pay trade-skill experience and vault progress, and a failed key drops a level: gather, die, repeat, on the easiest key that drops the part.

## 4. Exploiting the economy

- **Sell early, never hold.** Material price falls from 0.84 to 0.15 over the season. Rebuy at the floor only if old materials feed the new tier.
- **Do not craft for margin.** Crafters earn 0.14x a median player at baseline. The consumables fix assumes a fixed 15% margin and clears the glut in only 20 of 40 shaken runs.
- **Skip consumables.** Optimal farming runs die 2% to 8% of the time and already buy power in-run. The sink falls on weak players: regulars at top tier drop from 85% to 62%.
- **Coin is worthless.** Only 3% is sunk. Expect barter and coin-priced raid carries.
- **Commission launders bound materials.** The output is never-equipped crafted gear, which is tradable. An arbitrary fee is also an untaxed coin transfer.
- **The weekly cap is noise.** It held in 3 of 40 runs; hardcore players reach top tier by week 8 regardless.

## 5. Nodes that never matter to an optimiser

Bag weight cap; carry weight by degrees; crafted bags; only banked materials survive; two uses per material (decided by the clock); opt-in curses; route choice; boss gate choice; fewer bigger choices (all three camp choices are scripted); timed strike (always do it); capped weekly currency; gear wear; buy orders; standing cards (one best pick); bound raid materials.

## 6. Three rule changes

1. **Break the clock.** Give in-run spending diminishing returns per segment and make early materials valuable in town, so "spend everything early, hoard late" stops being a schedule.
2. **Pay for depth and risk.** Reward per wave must rise with depth, with deep-only bound outputs; remove the recall; lose more of the bag the deeper you die.
3. **Price the free lunches.** Curses and the rich route should draw on one shared budget and not be strictly better. A dropped bag should attract enemies; nodes should lock during spawn pauses; commission output should bind.

Work files: `/home/claude/out/reviews/work-minmaxer/` (`mm.py`, `deep2.py`, `search3.py`, `final.py`, `rules2.py`).
