# Exploration: is the "New World" half of Scrip delivering?

Lens: crafting, trade and the shared world. Nothing here changes the game; this is a set of hypotheses and options to choose from.

The owner said: "I enjoyed a few hours, then got bored, unlike Brotato and New World", and "I'm not sure public town projects are strong enough to be engaging."

Sources read: `server/fusion.ts`, `server/provider.ts`, `server/bedrock.ts` (system prompt), `server/config.ts`, `src/shared/item.ts`, `src/shared/vocab.ts`, `src/shared/rules.ts`, `src/client/town/workshop.ts`, `townhall.ts`, `market.ts`, `docs/DESIGN.md` sections 4-6, `docs/research/research-economy.md`, `docs/critique/meta.md`, `docs/critique/meta-after.md`.

Experiment: `/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/design-craft/variety.mts`, output in `variety.out` next to it. It fuses every pair of the 70 fusable authored items (2,415 pairs) with the ProceduralProvider, the provider the **solo mode always uses** (`src/client/local/world.ts:101`) and the one any server without Bedrock credentials uses.

---

## 0. The one-paragraph answer

New World keeps people playing because its crafting loop always has a **known target** ("I need gear score 600 in this slot, and that needs level 200 Armoring, so I need 40 more levels, which means refining orichalcum"). Every gather, refine and trade then moves a visible bar toward that target. Other players are felt as suppliers, customers and rivals for the same goods.

Scrip's crafting and trade layer has **no known target**:
- Fusion is a blind pick between pairs. Its value is fixed by the inputs before the strike, and only its flavour is unknown.
- Nobody can become better at crafting, or a specialist in it.
- Marks and items have little you need to save for.
- Other players appear mostly as a name on a stamp and a row in a givers table.

The parts that work are the legibility, the no-RNG-after-a-long-pipeline rule, the raw market inside the Factor's band, and relics as the one real chase item. They are worth keeping. What is missing is the **goal structure** around them, not more mechanics.

---

## 1. Diagnosis

### H1. Fusion is legible but flat: value is decided before the strike, and only the flavour is a surprise

Evidence:
- Budget = round((points A + points B) x 1.4) (`item.ts fusionBudget`). The workshop shows that budget and the resulting tier **before** you strike (`workshop.ts` "Comes off: N points, tier T").
- Experiment: the result's tier matched the predicted tier in **93.4%** of 2,415 pairs. Realised points were 0.88 / 0.94 / 1.00 of budget (p10 / p50 / p90). Power is close to deterministic from the inputs.
- What is left to discover is *which* effects come out. Under the procedural provider:
  - **99%** of output effects are effects one of the parents already had.
  - **96%** of outputs are nothing but the parents' effects at higher levels. Only 77 of 7,070 output effects were a new special.
  - The provider adds +4 score for "held" effects against a random 0-1.5, so the union of the parents almost always wins (`provider.ts` scoring).
  - Procedural fusion is therefore "A + B, levelled up, with a name like *Grease plume*, *Food stew* or *Ore horn*". It holds no surprise and only sometimes reads well.
- The LLM provider is told to "prefer a reading of the pair that is a little unexpected" (`bedrock.ts`). That gives surprise in theme, but the code still fixes value. So the best case is a nice name for an item of known strength.
- A good slot machine needs variance in **value**. A good crafting system needs **agency over identity**. Fusion has neither: power is fixed, and identity is chosen by a model you cannot steer. research-economy.md section 3 states the lesson: "players accept RNG on minor outcomes and demand agency over identity-defining ones." Fusion inverts it. Power is guaranteed and identity is random.
- The anticipation beat is a 0.9 s meter (`workshop.ts strike`). That is fine for the strike itself, but nothing builds up to it. You never think "if this comes out with burn I have my build."

### H2. Crafting is blind pair-guessing, with no targets, no skill and no specialisation

Evidence:
- The search space is huge: 2,415 authored pairs, 144,000 second-generation items and billions after that (meta.md section 3.1). There is no way to aim at a result.
  - DESIGN.md 4.2 promises "silhouettes for pairs adjacent to what you know". That is not built: no silhouette code exists outside the art system (`grep silhouette`).
  - The codex shows only your own recipes and the latest 50 in the world (`fusion.ts codex`).
- No crafting skill exists. Fusion number 500 plays exactly like fusion number 1. New World's 17 trade-skill bars, Albion's specialisation and OSRS skilling are all "get better at making things", and Scrip has none of that.
- Specialisation is impossible. Every player can fuse anything, and every character uses the same three raws. research-economy.md section 3 rule 5 lists five reasons to buy from someone else (capped specialisation, specialist efficiency, discovery monopoly, time arbitrage, divergent inputs). Scrip uses none of them for items.
- Discovery goals run out fast. First finds that count are only authored pairs. Those are used up in about 3 days at 100 players and on day 1 at 1,000 (meta.md section 3.2). The finds after that never run out, so they are worth nothing ("a counter that goes up when you press the button").
- Little Alchemy and Infinite Craft show that blind combining can be fun. Two things make it work there: (a) combining is free and instant, and (b) results land as delightful surprises because the outcome is a *concept*. In Scrip each town strike costs 15-200 marks plus raws and uses up two items, and the outcome is a stat block.

### H3. The economy has sinks but no goals: nothing is worth saving for

Evidence:
- What marks buy: stash shelves, repairs, town fusion fees, gifts to the town, and raws from the Factor. All of these are **upkeep**, not **aspiration**.
  - meta-after.md B2 calls the sinks "binding" for a player who uses them. But binding sinks with no aspiration make a tax, not a goal.
  - New World and OSRS have aspirational purchases: a house, a named weapon, the best-in-slot ring, a bond.
- Items are not a market. 40 players over 30 days produced **0 item sales to someone who used the item** (meta-after.md B4). The causes:
  - every player is a net producer of items (1.9-2.9 come home per run, the kit eats 0.67);
  - the kit cap (13 points at hazard 0) makes a strong item worth little;
  - anyone can fuse their own.
- Raws do trade: 62% of trades go to someone who used the goods, at about 6 marks a unit. But it is a three-good commodity market with no story. Nobody becomes "the ore seller".
- Profit as a game (OSRS flipping and merching, EVE station trading) needs many goods with different, *visible* prices and a reason for spreads to exist. Scrip has 3 raws, a Factor band, and no price history or ticker. research-economy.md section 2 says "a recent-trades ticker and price-history sparkline matter more than raw liquidity for the feeling of life", and neither exists in `market.ts`.
- Relics are the only chase item, and they are 1 in 1,500 wins with no path to them (DESIGN.md 5.6). That is right for a lottery-like legend, but it is not a goal a player can work toward.

### H4. Other players are barely felt, and the town project is a shared bar, not a shared story

Evidence:
- How other players show up:
  - finder names on recipes, which are invisible after week 1 because the codex lists only 50 recent ones;
  - a givers table in the town tab, which is hidden in solo (`townhall.ts`);
  - relic notices for 24 hours;
  - the daily board;
  - market listings.
- None of these is an interaction. You never receive something because of what another player did, apart from the station yield, which is diffuse.
- The town project is the owner's specific worry, and the numbers back it up (meta.md section 2.3):
  - It is too slow early (one tier step every 3-6 days) and then finished for good, after which "works" repeat four week-long perks for ever.
  - The pace per head is flat because targets scale with players, so a bigger town does not feel bigger.
  - There is no choice (no vote on which station), no event, no threat, no rivalry and no personal reward beyond a count.
  - New World's town projects work because they sit inside **faction territory control**: whose town it is, with upkeep, invasions, a governor and taxes. Remove the conflict and they are a donation bar.
  - Helldivers 2 Major Orders work because they are short, authored, time-boxed and narrated.
- At small player counts all of these go quiet. Async social systems need **artefacts left behind by other people** (ghosts, notes, named items, bounties, orders addressed to you). A count is not enough.

### H5. Crafting and the run do not feed each other's goals

Evidence:
- Run-to-town: the kit cap is 13 points at hazard 0 (DESIGN.md 5.2). It was right for balance, and it turns town crafting into "make something that matters at hazard 3+", which is a long way off for a few-hours player.
- Town-to-run: the run never asks for a *specific* item or material. Nothing says "the bench on wave 6 wants hide for X", and no bounty or contract pulls a player toward particular nodes.
- New World's loop is circular: content needs gear, gear needs crafting, crafting needs mats from content. Scrip's loop is a funnel. Runs produce stuff, the town absorbs it, and nothing in town reaches back to say "go get this".

### H6. Solo mode has the weakest version of all of it

Evidence: solo always uses the procedural provider. That means 99% inherited effects and generic names (H1), a private town with no givers and no world finds, and a Factor with nobody to trade with. If the owner played mostly solo or offline, the "New World half" was close to absent.

---

## 2. Options

S/M/L is build cost. "Solo" says whether the option works in the offline mode.

### O1. Commissions and bounties: a known target every visit (H2, H3, H5)

- **What:** a board of 3-5 orders that refreshes daily, such as "an item with burn >= 2 and no drawback", "60 ore", "any tier 3 boot-glyph item". Each pays marks, and in the shared town also standing or a cosmetic stamp.
  - In the shared town, players can post orders too. This extends the existing buy orders from "named item" to an "effect spec", so a fighter can ask for exactly what their build needs.
- **Reference:** New World faction and town board missions, the OSRS Grand Exchange buy order, Potion Craft customers asking for a specific effect ([PC Gamer map guide](https://pcgamer.com/potion-craft-map-recipes), [HackerNoon review](https://hackernoon.com/a-look-at-potion-craft-an-alchemist-simulator)).
- **Cost:** M. NPC orders are generated from the vocabulary. Player spec-orders reuse the order book.
- **Risk:** it becomes a checklist chore. Keep it to 3 cards and never make them mandatory.
- **Cheapest test:** a hand-written board of 3 orders for a week of the owner's play, with "does a matching item exist in your stash" shown. Do you open the workshop with a purpose?
- **Solo:** yes (NPC orders). **Felt-other-players:** yes (player spec-orders).

### O2. Steerable fusion: catalysts and an effect preview (H1, H2)

- **What:** give the crafter agency over identity, not power.
  - **(a) Preview the effect pool:** show "likely: burn, rate; possible: killBlast" before striking. The procedural provider already scores primitives, and the LLM could be asked for a short shortlist that is cached.
  - **(b) A catalyst slot:** one raw, or a third tagged item, that pins one primitive or forbids a drawback, at extra cost.
- **Reference:** New World Golden Scarabs / "pick your perk" ([research-economy section 1](../research/research-economy.md)), Potion Craft's map, where each ingredient moves you toward a visible target.
- **Cost:** M. Note that a catalyst changes the recipe key, so the key would become a triple or "pair + pin".
- **Risk:**
  - a deterministic best-in-slot collapses the chase (the Path of Exile Harvest lesson);
  - the cached world-recipe model needs care so that one pair still has one canonical answer.
- **Cheapest test:** (a) only, client side: show the parents' effects plus the top 3 procedural scores as "the assayer's guess". Measure whether players strike more deliberately.
- **Solo:** yes.

### O3. Value variance with a pity floor: make the strike a moment (H1)

- **What:** keep the budget as the floor, and give an untried pair's first strike a chance of a **masterwork** (+1 level, or a 4th effect, or no drawback). The masterwork becomes the canonical recipe, so the world remembers that you struck it well. A known recipe stays deterministic.
- **Reference:** the Diablo/Path of Exile "good roll" moment, minus New World's RNG-after-pipeline failure, because the variance only applies to the first finder and the pipeline is short. Lost Ark honing pity.
- **Cost:** S.
- **Risk:** it re-opens power creep (meta.md section 3.3). Hold it within the tier band.
- **Cheapest test:** with RULESET bumped in a branch, run variety.mts with a 10% masterwork chance and count the shift in tier 4 items. Then 20 manual strikes: is the reveal more exciting?
- **Solo:** yes.

### O4. Crafting mastery: a per-glyph or per-tag skill line (H2)

- **What:** each fusion that is *used* (packed, sold or given) adds mastery in its output's glyph family (blades, boots, flasks...). Mastery tiers unlock steering for that family: preview, then a catalyst, then a cheaper strike. You can reach high mastery in only 2-3 families per season, which is the specialisation research-economy rule 5 asks for.
- **Reference:** New World trade skills, Albion specialisation (a specialist really is cheaper per unit), and research-economy rule 6 ("XP only for items that are used").
- **Cost:** M-L.
- **Risk:** grind, and New World's "vendor trash" levelling. Mitigate by counting only items that are used.
- **Cheapest test:** show "your boot-glyph fusions: 7" as a counter in the almanac, with no effect, and see whether it changes what the owner fuses.
- **Solo:** yes. **Felt-other-players:** specialists become people you buy boots from.

### O5. Finder royalties and a "made with your recipe" feed (H4)

- **What:**
  - When anyone strikes a known recipe, its finder gets a tiny royalty (1-2 marks, capped per day) and a line in a feed: "3 players made your *Pitch lantern* today."
  - Show the top recipes of the week by makes, with finder names, on the town page. meta.md change 8 already proposed a "recipe of the week".
- **Reference:** Wordle's shared result line as passive presence; Mario Maker "plays of your level"; Elite Dangerous / Death Stranding "your structure helped 12 players".
- **Cost:** S. `player_recipes` and the run_fusions tables already record makes.
- **Risk:** hunters (10% of players with 65% of finds) gain more. The daily cap and a royalty cap contain this.
- **Cheapest test:** a read-only query "how often were my recipes made by others this week" shown on the home page. No marks.
- **Felt-other-players:** yes, even at 5-10 players, because each make is an event addressed to you. **Solo:** no.

### O6. Ghost trade and NPC persona traders: a market that feels alive at low population (H3, H4, H6)

- **What:** populate the market with **named NPC traders**, each with a want and a stock that changes daily ("the Cooper wants hide-tagged items and pays 1.5x"), plus price history sparklines and a recent-trades ticker. In the shared town, mix real players' trades into the ticker.
- **Reference:** Prosperous Universe market makers (research-economy section 2), Potion Craft customers, Recettear, Moonlighter's price-reaction faces.
- **Cost:** M.
- **Risk:** NPCs become a faucet. Price them inside the existing per-player Factor caps.
- **Cheapest test:** one NPC with a daily rotating "wanted tag" that pays above salvage. Does selling become a decision?
- **Solo:** yes. This is the main fix for solo trade.

### O7. Season-scoped finite discovery: a numbered book to complete (H2, H3)

- **What:** each season (DESIGN.md 5.10) publishes a **book of 30-60 named target items**, authored or picked from what the generator can reach, shown as silhouettes with hints ("something iron that burns"). The world sees who made each first. A completion percentage applies per player and for the world.
- **Reference:**
  - Little Alchemy and Infinite Craft: discovery with hints, plus sharing unusual results ([Know Your Meme](https://amp.knowyourmeme.com/memes/sites/infinite-craft));
  - the Balatro and OSRS collection log;
  - the meta.md finding that "741 authored pairs is a fine collection; billions is not."
- **Cost:** M. It needs a reverse search: which pairs reach target X. The procedural provider is deterministic, so this can be computed offline.
- **Risk:** spoilers and wiki-solving. That is fine: in OSRS the wiki is part of the game.
- **Cheapest test:** hand-pick 10 targets from variety.mts output, list them as silhouettes on a scratch page, and play an evening.
- **Solo:** yes (a private book). **Felt-other-players:** world-first per target.

### O8. Contested town: two or three projects in parallel, with a vote by contribution and a weekly event (H4)

- **What:** replace the single bar with a choice. Two or three projects run in parallel, the first finished wins and the other decays. Add a weekly authored "order" with a deadline and a narrated outcome, such as "a trader caravan arrives Friday: the town needs 400 hide or it leaves". Show personal-percentile stamps.
- **Reference:** Helldivers 2 Major Orders, Elite Dangerous Community Goals with percentile rewards, New World town board upkeep (research-economy section 5).
- **Cost:** M.
- **Risk:** splitting thin populations. Scale targets per active giver, as today.
- **Cheapest test:** keep the current project, and add a 72-hour deadline with a consequence and a home-page line on success or failure.
- **Felt-other-players:** yes. A deadline makes each gift visible as progress. **Solo:** weak (a deadline only).

### O9. Async rivals: named ghost crafters and a weekly "best in show" (H4)

- **What:** each week, one category ("the best tier 3 boots", "the most points with no drawback", "the best item under 40 marks of input"). Players submit an item from their stash, and it is ranked by a published formula. The winner's item is displayed in town with their name. In solo, compete against 3 seeded NPC crafters with stable personalities.
- **Reference:** county-fair competitions (Stardew Valley's Grange Display), Path of Exile race seasons, the Wordle board.
- **Cost:** S-M. Ranking is a pure function of the item spec.
- **Risk:** it is solved by whoever fuses the most. Keep the categories odd and rotating.
- **Cheapest test:** one manual category and a leaderboard query over current stashes.
- **Felt-other-players:** yes, even with 3 players. **Solo:** yes (NPC rivals).

### O10. Divergent inputs: characters and stations that need different things (H3)

- **What:** give each character a material it uses heavily and gathers poorly (Smith wants ore, gets hide), and let fusion recipes in a glyph family use a *specific* raw. Each archetype then produces what another archetype wants, so raw trade carries meaning ("I sell my hide to smiths").
- **Reference:** research-economy rule 5 "divergent inputs", EVE's regional specialisation, Albion city bonuses.
- **Cost:** M. It touches run economy balance.
- **Risk:** it is a balance change, which is beyond "explore" scope. Flag it for later.
- **Cheapest test:** with no code, check the econ sim logs: do characters already end runs with skewed raw bags? If yes, just surface "smiths are buying ore" on the market.
- **Solo:** partly (via NPC traders).

### O11. Recipe notes and heirlooms: other players' words on things (H4)

- **What:** a finder can attach one picked line from a fixed phrasebook (no free text, which keeps the DESIGN.md ban on free-text naming) to a recipe. An item keeps a provenance chain ("made by A from B's recipe, sold by C"). A traded item shows its history, like a relic's line.
- **Reference:** Dark Souls messages (fixed phrase grammar), EVE killmails and ship provenance, relic serials already in Scrip.
- **Cost:** S-M.
- **Risk:** low.
- **Cheapest test:** show "first made by X" plus "this one was made by Y" on market listings. The data is mostly there.
- **Felt-other-players:** yes. **Solo:** no.

### O12. Pay the procedural provider's debt (H1, H6)

- **What:** make solo and offline fusion as surprising as the LLM.
  - Lower the inheritance bias (+4 against a 0-1.5 random) so that about 30-40% of effects are new readings.
  - Add tag-to-primitive "readings" (iron + fire leads to burn or armorDamage).
  - Grow the noun and modifier tables, or ship a pre-generated LLM recipe pack for the authored pairs and the first generation (2,415 + about 100k entries is small).
- **Reference:** Infinite Craft ships its results to everyone cached. Here they could ship baked.
- **Cost:** S (tuning) to M (baked pack).
- **Risk:** it changes recipes, so it needs a RULESET bump.
- **Cheapest test:** rerun variety.mts with the bias at +2 and compare the inherited share and a hand-read of 30 names.
- **Solo:** yes. This is the solo-mode fix.

---

## 3. Top 3 recommendations

1. **Give crafting known targets: O1 commissions plus O7 a finite seasonal book.**
   - This is the main thing New World has that Scrip lacks: a reason to fuse *this* pair today. It answers H2, H3 and H5 together, and it works solo.
   - Start with the cheapest test: 3 hand-written commissions and 10 silhouette targets.
   - If the owner opens the workshop "with a purpose" again, the diagnosis is confirmed.

2. **Make other players felt as events addressed to you: O5 royalties and feed, then O9 best in show.**
   - Both work at 5-10 players because they turn other people's play into notifications about *your* things.
   - O9 has an NPC-rival version for solo.
   - This is a better answer to "is the town project strong enough?" than tuning the project. The project is a bar, and bars do not create social presence. Artefacts and rivalries do.
   - If the town project stays, add O8's deadline and event first: it is the S-cost version.

3. **Move fusion's surprise from flavour to identity: O12 now, O2(a) the assayer's guess next.**
   - Fusing should feel like "I steered toward burn and got a good one", not "a stat union with a random name".
   - Fix the procedural provider first, because it is what solo players and offline tests see. 99% inherited effects is the flattest case of H1.
   - Then add a preview of the effect pool. Hold O3 masterworks in reserve as a cheap way to add a strike moment if the reveal still feels flat.

What to keep untouched: no RNG on known recipes, the code-owned numbers, relics as a lottery legend, raws traded inside the Factor band, and the kit cap. These are the parts of the design that avoid New World's documented failures.

---

## Sources (web, this session)

- Potion Craft map and discovery: https://pcgamer.com/potion-craft-map-recipes , https://hackernoon.com/a-look-at-potion-craft-an-alchemist-simulator , https://www.gamezebo.com/walkthroughs/potion-craft-maps/
- Infinite Craft spread through shared results: https://amp.knowyourmeme.com/memes/sites/infinite-craft
- OSRS flipping and merching as a game, the 2% GE tax: https://oldschool.runescape.wiki/w/Flipping , https://oldschool.runescape.wiki/w/Merchanting , https://gemargin.pages.dev/guides/flipping-guide
- New World, Albion, Prosperous Universe, Helldivers 2, Elite Dangerous, Path of Exile Harvest: the cited URLs in `docs/research/research-economy.md` sections 1-5.
