# Exploring motivation: meta progression, goals and reasons to come back

Lens: after a few hours, what does the player want next, and does Scrip give
them something to want? Exploration only. No game code was changed.

Owner's words: "While I enjoyed playing a few hours I feel like I am getting
bored / less motivated to play (unlike Brotato / New World which keeps me
engaged). Something is lacking in our game but I can't place my finger on what."

**Short answer.** Scrip front-loads all of its *new things* into the first
~10 runs (about 1.5-2 hours), then switches to goals that are either gated on
wins a human gets 1 time in 7-10, or are so large (2,415 pairs, 1 relic per
~1,500 wins) that they read as "never". Meanwhile what the player earns
(marks, raws, items) mostly buys *more capacity for the same thing* (shelves,
repairs, station tiers that give more raws), and at hazard 0 the kit cap makes
63 of 80 items, and every fusion, enter the run as the same 13 points. So
around hour 2-3 the player stops seeing a next thing, and what they do see is
upkeep. Brotato hands out a new character or item on most wins for dozens of
hours. New World makes a personal number go up every session. Scrip has
neither for a mid-skill player after hour 2.

## Sources and method

- Code: `server/config.ts` (FEATURE_AT, `charactersFor`, stations, works,
  relic odds), `server/runs.ts` (payout, unlock events), `server/almanac.ts`
  and `src/shared/almanac.ts` (lists, titles), `src/shared/rules.ts` and
  `src/shared/kit.ts` (sinks, kit cap), `src/client/town/home.ts`,
  `homecoming.ts`, `almanac.ts`, `daily.ts`, `words.ts` (what the player sees).
- Docs: `docs/DESIGN.md` 5.x, `docs/critique/meta.md`, `meta-after.md`,
  `depth-after.md`, `fun.md`, `docs/research/research-retention.md`.
- Counts computed from the content files (scripts in the scratchpad):
  80 authored items (tier 1: 25, tier 2: 25, tier 3: 20, tier 4: 10), 2,415
  authored pairs, 10 enemy kinds, almanac total 2,563 entries, 15 titles.
  Item points: tier 1 = 6-15, tier 2 = 16-28, tier 3 = 32-58, tier 4 = 64-85.
  Kit cap at hazard 0 is 13, so **8 of 25 tier 1 items and all 55 tier 2-4
  items pack down to the same 13 points at hazard 0**.
- Experiment: two 60-run careers through the real API
  (`tools/exp/meta/career.ts novice|average 60 1 regular+climb`), outputs in
  `/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/design-meta/`
  (`nov.json`, `avg.json`, `*.txt`). Caveats: (1) the bots win far more than
  people (the "novice" bot won 20 of 60; `depth-after.md` measures a learner
  at about 10% and an expert with human hands at 14% at hazard 0); (2)
  `apiRun` in `tools/exp/meta/lib.ts` does not pass `hazard` to `playSim`, so
  climbing careers do not feel the hazard rules (the script predates the
  sim's ladder); (3) the script sends no `killsBy`, so "kinds of enemy killed"
  reads 0 there (the real client does send it). Read the careers as an upper
  bound on how fast goals fall.
- Human pacing estimate used below: a learner's death run averages wave 6-8,
  about 6-8 minutes with benches; a win is about 13-15 minutes; plus 1-2
  minutes in town. **About 6 runs an hour.** Human win rate 10-14% at hazard 0,
  falling down the ladder like the bot's 49/42/32/22/14/6 (so roughly
  14/12/9/6/4/2% for a good human).

## 1. Timeline: what the player gets and wants

| Hour (runs) | What they get | What they want next | Is the want visible and near? |
|---|---|---|---|
| **0** (run 0-1) | The run itself. Workshop opens after run 1. Homecoming says "clear wave 4 and one item comes home". | Survive longer; see the next wave; carry an item. | Yes. Best wave is tracked and said on every death (`homecoming.ts` 142-155). Strong. |
| **1** (runs ~5-6) | Sawyer (run 2), market (3), daily (4), town project (5). Something new after every run. Stash fills with tier 1-2 items. | Try the new tabs; first win; next character. | Yes. Characters 3-6 are promised at runs 6, 7, 8, 9 (`CHARACTER_AT` in `words.ts`). This is the best hour of the meta. |
| **2-3** (runs ~12-18) | Smith, Trapper, Tinker, Clerk (runs 6-9). Player trading opens (run 10). "Ten runs home" title (run 10). Probably 1-2 wins: hazard 1 opens for one character. **Stash of 24 fills around run 16-20** (about 1.3 items carried a run); after that items are salvaged at the door or a 150-mark shelf is bought. First repairs. | Win with each character; climb a hazard; fuse something good; raise a station. | **This is where the wants run out.** There is no further unlock on a schedule. Every remaining title or almanac line needs wins (10-14% each) or hundreds of actions. The homecoming "Next" line has nothing to say after wave 12 is reached. |
| **6** (runs ~35) | Maybe 4-5 wins in total. Hazard 1-2 on one or two characters. Solo town: first station tier (100 raws for tier 2; 4,050 raws for all four stations at tier 5, at ~20 raws a human run). Around 10-20 fused recipes. | "Ten wins" (needs ~80 runs at 12%), "won with every hand", "third hazard". | Visible in the almanac, but far: the next title is 10+ hours away. Almanac reads about "60 of 2,563". |
| **10** (runs ~55-60) | The bot careers at run 60 hold 5-6 titles, 100-132 of 2,563 almanac entries (4-5%), stations at tier 1-2, stash 37/40, marks 280-314 (3-5 runs of income: sinks hold). A human: perhaps 2-3 titles. | Ladder cells, "allhands", relic. | The ladder (36 cells) is the only mid-size goal, and each cell gives +10% marks and a bigger kit cap, nothing new to play. |
| **20** (runs ~110-120) | ~13 human wins. Expected relics found: 0.009 (1 in 1,500 wins). Ladder perhaps 8-12 of 36. Solo town maybe half-built. | Hazard 5, the whole ladder, full book, relic. | The whole ladder is roughly 780 runs (~130 h) for a good human; the full book 2,415 untried pairs at 20 a day and 15-200 marks each; a relic about 2,000 hours. These are lifetime goals with no rungs in between. |

**Where the wants run out:** at about run 10, hour 1.5-2.5. Before it, a new
option arrives every run. After it, the next *new thing* (rather than a
bigger number) is nothing: no more characters, items, rules, places or
cosmetics exist to be unlocked. That lines up with "enjoyed a few hours, then
less motivated".

## 2. Diagnosis

### H1. The unlock schedule ends at run 10, and the next goals are win-gated at a human win rate of 10-14%

Evidence:
- `FEATURE_AT = { workshop: 1, market: 3, daily: 4, town: 5 }`, characters at
  runs 2, 6, 7, 8, 9 (`charactersFor`), player trading at run 10
  (`LISTING_MIN_RUNS`). Nothing in the code unlocks on run count after 10.
- Remaining progress: apart from "ten runs home" and "met everything"
  (kill all 10 enemy kinds), every title needs wins, hazard clears or totals
  in the dozens to thousands (`server/almanac.ts` EARNED). The hazard ladder opens only on a
  win (`server/runs.ts` 391-401).
- `depth-after.md`: a learner wins about 10%, an expert with human hands 14%.
  So for a person the step after "unlocked everything" is ~7-10 runs of no
  reward, then one ladder pip.
- `research-retention.md` 1.4: the pattern in Vampire Survivors, Balatro and
  Slay the Spire is an unlock on nearly every early run, then a *slowed but
  continuing* cadence ("roughly one unlock per 2-3 runs") before the
  difficulty ladder takes over. Scrip goes from one per run to zero.
- Slay the Spire unlocks by cumulative score so losses still progress; Scrip's
  long goals only count wins.

### H2. Wins and climbs give nothing new to play

Evidence:
- What a win pays: marks, raws, up to 3 items (which pack down to 13 points
  at hazard 0), +1 hazard for that character. A hazard level pays +10% marks
  (`HAZARD_MARKS`) and a larger kit cap. Relic odds do not move with hazard.
- In Brotato the danger ladder *is* the unlock engine: winning at Danger 0-5
  unlocks a character each (One-Armed at D0 ... Demon at D5), and characters
  and items also come from kill counts, materials and feats
  ([Brotato wiki: Dangers](https://brotato.wiki.spellsandguns.com/Dangers),
  [unlock guide](https://commonsensegamer.com/brotato-how-to-unlock-all-characters/),
  [all unlockables](https://gamepretty.com/brotato-all-unlockables-guide-how-to-unlock/)).
  Every win at a new danger or with a new character tends to open a new toy.
- Balatro: each joker earns a stake sticker when you win with it, which
  turns 150 jokers x 8 stakes into a visible per-item collection
  ([Balatro wiki: Stickers](https://balatrogame.fandom.com/wiki/Stickers)).
  The top of it is a grind few finish (0.2% on PS5,
  [trophieshunter](https://trophieshunter.com/games/balatro-ps5/achievements/completionist-f844f59b-9b41-4a94-936a-a6371b06cffc)),
  but every win adds a sticker, so every win is visible progress.
- Hades: Heat is opt-in difficulty paired with opt-in reward, and every run,
  even a failed one, pays something permanent
  ([rpgsite on Heat](https://rpgsite.net/feature/10287-hades-pact-of-punishment-heat-modifiers-and-how-to-maximize-your-rewards),
  [Mirror analysis](https://saschb2b.github.io/game-mechanics/games/hades/meta-progression)).
- Scrip has 6 characters x 6 hazards = 36 cells, each cell an inked square
  and nothing else. Brotato's long tail is more than 40 characters x danger
  levels, and the *characters are the reward for the cells*.

### H3. Power plateaus at hazard 0, and items turn into bookkeeping just as unlocks end

Evidence:
- `KIT_POINT_CAP = [13, 26, 40, 58, 80, 999]`. At hazard 0, 63 of 80 authored
  items (every tier 2-4 item and 8 tier 1s) and every fused item a player
  would bother making enter the run as 13 points. The stash fills with
  "better" items that are not better where a human spends most of their runs
  (hazard 0-1, because the ladder opens slowly).
- Measured value of the very best kit at hazard 0: +13.5 points of win rate
  (`meta-after.md` B1). That was the right fix for "kit is a win button", but
  it also removed the New World feeling of "my gear got better tonight".
- Charges: 3 per item, one per run started, mending 2 marks a point (min 15)
  plus raws, twice per item (`REPAIR`). Stash 24, shelves 150/300/600... marks
  (`STASH`). Items carried home ~1.3 a run for a human, so the stash fills at
  about run 16-20 (the careers: 26/32 by run 15), the same hour unlocks stop.
  From then on, homecoming means choosing what to salvage, mend or shelve.
- `research-retention.md` 5: inventory management and upkeep are the most
  common complaint about crafting games ("the LEAST fun mechanic").
- New World's pull and its failure are both about this: gear score is the
  number that goes up every session; retention fell when the climb went
  opaque or was devalued ("my fully crafted 600GS set ... is soon to be
  worthless")
  ([TheGamer on max gear score](https://www.thegamer.com/new-world-how-to-reach-max-gear-score-quickly/),
  [GameSpot on Expertise](https://www.gamespot.com/articles/new-world-players-are-up-in-arms-about-the-games-newly-proposed-expertise-system/1100-6498587/),
  [Massively OP on endgame](https://massivelyop.com/2024/11/04/vitae-aeternum-how-to-fix-new-world-aeternums-endgame-starting-with-rewards-and-content-relevance/)).

### H4. Marks and raws only buy more of themselves

Evidence (every sink in `src/shared/rules.ts` and `server/config.ts`):

| Sink | What you get | Is it a new experience? |
|---|---|---|
| Stash shelf | Room for 8 more items | No: capacity |
| Mend | A charge back | No: upkeep |
| Town fusion | A recipe, usually an item packed down to 13 at H0 | Some: discovery, but capped power |
| Give to the town | Station tiers: +1 raw per node a tier; Assay: +5 untried pairs a day | No: more raws, more fusion capacity |
| Works | A week of a perk (no fee, more pairs, +20% Factor, cheaper repairs) | No: cheaper currency |
| Factor / market | Marks <-> raws | No: conversion |

- Every sink converts currency into maintenance or into *more currency
  throughput*. None buys a new character, a rule, a place, a look, or a way
  to say "this is mine". The careers bear it out: marks held stay at 3-5
  runs of income because they are spent, but on nothing the player would
  describe as a goal.
- New World's town had the same project board, but it sat beside a house you
  own and decorate, trophies that give you a personal buff, territory
  standing and trade-skill levels
  ([New World housing](https://www.newworld.com/en-us/news/articles/making-your-mark-on-aeternum-player-housing),
  [Settlements](https://newworld.wiki.fextralife.com/Settlements),
  [Town Project Board](https://newworld.wiki.fextralife.com/Town+Project+Board)).
  Scrip borrowed the project board and the station tiers, but not the
  personal layer (house, trophies, skill levels) that the project board
  served.

### H5. The collections are the wrong size: too big to chase, too few rungs

Evidence:
- Almanac: 2,563 entries, of which 2,415 (94%) are authored pairs. The page
  opens on "x of 2,563 entries filled"; the bot careers sit at 4-5% after 60
  runs. A meter that barely moves after 10 hours discourages instead of
  pulling.
- Titles jump by factors of ten with nothing between: ten runs, then ten
  wins, then a hundred pairs, thirty dailies, a thousand raws given, the full
  book. There is no "first win", "first fusion", "won with the Smith".
- Relics: 1 in 1,500 wins. At ~0.7-0.9 human wins an hour that is about
  1,700-2,100 hours to a first relic, so for this player relics do not
  exist. The DESIGN reference ("the one chest people stop to look at") needs
  a population. Alone, the chest is never seen.
- Goal-gradient effect: effort rises as a goal gets nearer (Kivetz, Urminsky
  and Zheng 2006, coffee-card study). Scrip's goals are all far or done.
  Balatro and Brotato goals are broken into many small per-item, per-character
  rungs.

### H6. The return hooks need other people, and the owner is mostly alone

Evidence:
- Solo mode is a private town (`src/client/town/api.ts` 20-28,
  `src/local/world.ts`): daily board of one, "first in the world" is
  automatic, no player listings, no buyers for items, no relic notices, and
  the town project is just your own grind at `projectScale = 1`.
- The daily: 8 waves, fixed character, one scored try, normal pay. Its pull
  is the shared board (Wordle, Spelunky). Without a crowd it is a shorter
  run with fewer choices. Its only own reward is "thirty dailies".
- `research-retention.md` 4 lists exactly these (thin global boards, an
  empty player market) under "feels dead when empty".
- Even in the shared town at the owner's current scale (a handful of
  players), the same is mostly true.

## 3. Options

Each option is a direction, not a spec. Costs: S = days, M = 1-3 weeks,
L = a month or more.

| # | What | Hypotheses | Reference | Cost | Risk | Cheapest test |
|---|---|---|---|---|---|---|
| 1 | **"Next" on every homecoming.** End every run, win or lose, on the nearest unearned thing and how far it is: "1 win as the Smith opens hazard 1", "3 more pairs for a chapter", "40 hide to the sawmill's next tier". Also on the home page above Head out. | H1, H5 | Hades post-death room; Dead Cells; goal-gradient research | S | Low. Only as good as the goals behind it. | Compute it by hand from the almanac data for 10 of the owner's sessions and show it as a printed line; ask whether it makes them want one more run. |
| 2 | **Wins unlock content.** Tie new things to ladder cells: each character's first win adds 2-3 items to the bench pool; hazard 2 and 4 wins add a weapon or a character variant; the 36 cells become a content tree. Start with some items locked so there is something to unlock. | H1, H2 | Brotato (character per danger, items per character win), Balatro decks per stake | M (content, and a locked-pool rule) | Medium: locking items narrows early builds; needs depth balance re-run. | Pick the 14 items under 5% use (`depth-after.md`) and announce them as "unlocked by a win as X". Measure whether the owner chases them. |
| 3 | **Progress that counts losses.** A per-character score track (best wave, waves cleared at each hazard, kills) with rungs every few runs, so a 10-14% win rate still moves something every run. | H1 | Slay the Spire score unlocks; Brotato kill and material totals | S-M | Low. Could feel like a grind bar if rewards are thin. | Show "best wave at hazard n" per ladder cell in the almanac (data is in `records`/runs) and see if the owner aims at it. |
| 4 | **Per-item stickers.** Mark each authored item with the highest hazard it was carried to a win with (or carried home from). 80 items x 6 hazards, every win adds stickers. | H2, H5 | Balatro stake stickers | S | Low. Encourages kit variety, which helps the item market. | Mock the almanac item list with stickers drawn from the owner's history; ask if it changes what they pack. |
| 5 | **Smaller, chaptered collections.** Split the 2,415 pairs into chapters by theme (hide x hide, tools x blades...), 20-40 each, each with a title or a cosmetic stamp; show the chapter, not the 2,563 total. Add rungs to titles ("first win", "won as each hand", "fifty pairs"). | H5 | Pokedex regions; Stardew community-centre bundles; Infinite Craft firsts | S | Low. Writing 10-20 chapters and titles. | Rewrite the almanac header to show the nearest chapter on paper; count how many titles a human would earn in hours 3-10 (target: one every 1-2 hours). |
| 6 | **A personal place: the cabin.** A small home in town that holds trophies from feats (first win per character, each hazard, chapters), each trophy a tiny sidegrade or a look, bought partly with marks and raws. Gives currencies an outward sink and the account an identity. | H3, H4, H6 | New World housing and trophies; Hades House Contractor | M | Medium: trophy buffs must stay sidegrades; the art budget. | Paper: list 15 trophies and what they would cost; ask the owner which 3 they would work for first. |
| 7 | **A personal craft level.** Workshop mastery that rises with every fusion and mend and unlocks workshop moves: lock one effect when fusing, re-theme, add a charge, see a pair's tier before fusing. The "number goes up" every session that New World's trade skills gave. | H3, H4 | New World trade skills; Dead Cells forge | M | Medium: must not reopen kit power (moves are about choice, not points). | Count how many fusions a human makes by hour 3 / 10 (the careers: 37-82 recipes by run 60) and draft 8 levels against it. |
| 8 | **Let the kit grow in a way the cap allows.** Instead of one flat 13 at hazard 0, give each character a kit rank raised by wins with that character (13, 16, 19...), or show what each stash item would bring at each hazard, so a strong item is a visible reason to climb ("brings 58 at hazard 3"). | H2, H3 | Hades II Arcana grasp budget; New World gear score | S (display) / M (rank) | Medium: the rank variant changes the balance measured in `kitcap.ts`. | The display variant only: add the per-hazard number to the item tooltip in a mock and see if it pulls the owner up the ladder. |
| 9 | **Contracts from the town.** The Factor and townsfolk post requests: "a 30-point hide item, 3 charges, pays 400 marks", "win with the Trapper at hazard 1 with a Snare in the kit", "60 ore by Friday". Gives items buyers and runs a purpose even alone. | H4, H6 | New World town board and faction missions; Stardew bundles; Hades prophecies | M | Medium: becomes a chore list if too many or too dull. Three at a time, no expiry penalty. | Hand-write 10 contracts and give them to the owner for a week of play; count how many they pursue. |
| 10 | **A daily with its own reason.** One rule from a pool on each day's clearing (StS Daily Climb modifiers); a weekly clearing with a one-off stamp or title; in solo, a board of your own past dailies plus a few seeded ghost bot scores so there is a line to beat. | H6 | Slay the Spire Daily Climb; Spelunky daily; Wordle share line | S-M | Low. Ghost bots must say they are bots. | Run the existing bots on the day's seed and print their waves next to the owner's result for a week. |
| 11 | **Taste of a relic.** Keep the numbered relics as rare as they are, but let the player borrow one for a run now and then (a rare bench offer or a contract reward, unnumbered, gone after the run), so the eight rules are known and wanted. | H5 | Balatro rental jokers; Hades keepsakes | S | Medium: dilutes "almost nobody has seen one". | Use `RELIC_FORCE` locally for the owner for 3 runs; ask if relics now feel like a goal. |
| 12 | **Seasons, or in solo "chapters".** Built per `DESIGN.md` 5.10: a fresh economy, 6-10 new items, a season title, archive. In solo, a chapter can reset the town and stash with a new rule and keep the almanac. | H1, H4, H5 | Path of Exile leagues; Diablo seasons | L | High: a big build; resets annoy some; needs content every 8 weeks. | Not testable cheaply; decide after 1-5 show whether the core meta holds without a reset. |

Notes on the references:
- Path of Exile's leagues work because everyone starts again together and
  the economy is fresh, with a new mechanic each time
  ([Game-Wisdom on PoE 2 seasons](https://game-wisdom.com/general/design-philosophy-behind-poe-2s-seasonal-model-resetting-everything-works),
  [poewiki: League](https://www.poewiki.net/wiki/League)); GGG still says a
  league's own design decides retention, not the reset
  ([GamesBeat interview](https://gamesbeat.com/path-of-exile-interview-an-expedition-into-some-big-changes/)).
  That is why option 12 is last: a reset multiplies a good meta, it does not
  replace one.
- New World players complain that trade-skill investment was devalued and the
  gear climb became opaque
  ([Steam thread](https://steamcommunity.com/app/1063730/discussions/0/4634862623030012125),
  [TheGamer on crafting](https://www.thegamer.com/new-world-watermark-update-crafting-worthless/)).
  Options 7 and 8 should keep a climb readable and never take it back.

## 4. Top 3 recommendations

1. **Wins unlock content (option 2), read through the ladder.** This is the
   one thing Brotato does that Scrip does not, and it answers H1 and H2
   together: the 36-cell ladder stops being 36 inked squares and becomes the
   delivery route for new items, weapons and character variants. Start by
   relabelling content that already exists (the 14 rarely used items, the
   relic rules as taste runs, the five hazard rules) so the first test costs
   no new art. Pair it with option 3 so a 10-14% human win rate still moves a
   per-character track every run.

2. **Always say what is next, and make the next thing close (options 1 + 5).**
   Rewrite the goal surface: the homecoming and home page name the nearest
   reward and the distance to it; titles get rungs between "ten runs" and
   "the whole ladder"; the 2,415 pairs are shown as chapters of 20-40. Aim for
   one earned thing every 1-2 hours from hour 2 to hour 20. Cheap, low risk,
   and it makes every other option visible.

3. **Give marks, raws and items a personal, outward use (options 6 + 9).**
   A cabin with trophies earned by feats, and three town contracts at a time
   that want specific items and feats. Together they turn the stash from
   upkeep into supplies for something the player chose, give items a buyer
   even in solo, and borrow New World's real pull (a place that is yours,
   a board that asks for you) rather than only its project board.

What not to do first: seasons (L, and they multiply whatever meta exists),
raising relic odds (it would end the one-in-the-world story without fixing
the solo problem; option 11 does that better), or lifting the hazard 0 kit
cap (it was measured as a win button at +70 points).

Two inputs from outside this lens would sharpen all of this: (a) the human
win rate, since every win-gated goal is 3-5x further away for a person than
for the bots; and (b) how the owner plays (solo or shared town, and how many
runs they have), which decides whether H6 is the main problem or a side one.
