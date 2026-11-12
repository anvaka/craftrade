# Research: AI-generated content and a player economy that survives it

Research date: 2026-11-12. Scope: the pivot from the current run-based game to a New World-like game (zones, tiered
nodes, trade skills, schematics, stations, housing) that keeps LLM-invented content and works solo/offline.

## How to read this

- **[S]** stated by a source found by web search this session (URL given).
- **[P]** already established in this repo's earlier research (`docs/research/research-ai.md`,
  `docs/research/research-economy.md`); not re-searched, summarised here so this file stands alone.
- **[R]** my recollection, not re-checked this session. Verify before quoting.
- **[I]** my inference or recommendation.

**Verification limit.** Every [S] item comes from search-result summaries, not from reading the pages in full. Review
counts and percentages differ between snapshots; treat them as orders of magnitude. Gaps where I searched and found
nothing are listed in section 7.

## Summary

1. Generated content lands when the model's answer becomes a small, permanent, legible game fact that a player caused
   and owns. It feels hollow when it is ambience or open chat. That finding is unchanged and the current fusion design
   already follows it.
2. The pivot changes one thing that matters: items become persistent and tradeable. A point budget keeps a single item
   fair; it does not stop unbounded item *types* from splitting a small market into thousands of markets of one, and
   it does not stop tier creep through fusion chains. Both need new rules (sections 4.3 and 6).
3. The safest high-value uses of the model in the new game are those where it produces **demand and reasons**
   (commissions, town projects, rumours) and **names and provenance**, while code owns every number, price and drop.
4. Offline: ship a generated-and-reviewed content pack plus the procedural fallback. Do not ship a model in the
   browser as the default path.

---

## 1. Games and prototypes using generative AI

### 1.1 What each one shows

| Game | What it does | What worked | What felt hollow or broke | Consistency / cost | Status |
|---|---|---|---|---|---|
| Little Alchemy 1/2 | Hand-authored combine table (about 580 and 720 items) | Complete, curated, every result makes sense; a finite codex gives a finish line | Runs out; no surprise; nothing is yours | Static data, zero cost, fully offline | [R] |
| Infinite Craft | LLM result for any untried pair, shared by all players, "First Discovery" label | Half-second answers, funny and shareable results, shared database turned into personal ownership | Elements mean nothing mechanically; firsts become a function of name length; bots brute-force the API; client can be spoofed | Checks the database first and only calls the model for an unseen pair; Llama 2 hosted by Together AI; rate limit; "I'm never going to financially recover from this" (Agarwal, quoted on Wikipedia draft). No cost figure and no technical write-up by Agarwal found | [S] https://en.wikipedia.org/wiki/Infinite_Craft , https://www.pcgamer.com/this-browser-based-endless-crafting-game-starts-you-off-with-fire-and-water-but-it-quickly-escalates-to-god-the-big-bang-and-yin-yoda ; detail in [P] |
| Infinite Craft clones | OpenCraft, Infinite Sides, local WebLLM version | Prove the technique is trivial | A clone with an empty cache has nothing | The recipe database, not the model, is the game | [P] |
| AI Roguelite | LLM decides crafting output from ingredient names; all mechanics model-directed | Closest prior art; small loyal audience (hundreds of Steam reviews, roughly 78% to 90%+ positive depending on snapshot) | Unbounded, unshared, single-player; store page has to explain that failed actions are intended | Local or cloud model per player | [S] https://store.steampowered.com/app/1889620/AI_Roguelite |
| Alchemy Unbound | Crafting game, LLM generates some items; **generation can be switched off** | Shows the "base game without the model" pattern on Steam | Mixed (about 69% of 85 reviews); early-access generation problems | Whether recipes are shared between players: not found | [S] https://store.steampowered.com/app/2858840 |
| AI Dungeon | Free-text story with a model | Open-endedness | Memory loss and drift; the 2021 filter episode made the studio a content moderator of private text | Per-turn cost is permanent | [P] |
| Vaudeville (LLM detective) | Free chat with suspects | Novelty | Steam reviews cite hallucination and NPCs forgetting earlier talk; players disengage | - | [S] academic review summarised at https://samucox.github.io/files/CONVERSATIONS'23%20Paper.pdf |
| Inworld Origins and other NPC demos | Question LLM witnesses | Tech demo | "Even if an NPC can say something surprising to me, my player agency remains just as hemmed in" (PC Gamer). One guide says Inworld moved from consumer NPC work to infrastructure (secondhand) | A written line is paid for once; a generated line is paid for every time | [S] https://www.pcgamer.com/gaming-industry/i-tried-two-demos-of-machine-learning-ai-npcs-and-they-didnt-convince-me-the-ai-will-lead-to-anything-that-immersive-sims-like-deus-ex-havent-already-done-better/ , https://app.cinevva.com/guides/ai-npcs-dialogue |
| Suck Up! | Talk your way into NPC homes | Silly tone absorbs odd output; a code-side trust meter bounds the model | Each NPC exchange spends an "AI token"; players can hit a hard cap; Steam score in the high 50s [P] | Cloud only; cost passed to the player | [S] https://themagicrain.com/?p=42121 , https://store.steampowered.com/app/2726370 |
| 1001 Nights | Steer an AI king into saying weapon words, which become weapons for a battle phase | Model output mapped onto a small fixed set of game objects; demo Very Positive (about 125 reviews) | The king reads as moody and arbitrary to some; real-time scene generation was cut [P] | Sources name GPT-4 + Stable Diffusion, later Qwen | [S] https://arxiv.org/abs/2308.12915 , https://store.steampowered.com/app/2782660 |
| Dreamio | Single-player generated choose-your-own-adventure | About 87-88% positive on 150-170 reviews | Requires internet; reviewers hope for image generation to be restored | Token system, or bring your own API key, or a free model, or a local model from the Workshop | [S] https://store.steampowered.com/app/2795060 |
| Whispers from the Star | Voice/text conversation with one character, Stella | About 82% positive on about 1,600 reviews; peak 964 concurrent players | Coverage notes a split among players over heavy AI use | One authored character and situation, not an open world | [S] https://www.notebookcheck.net/Steam-launch-New-interactive-fiction-game-debuts-to-Very-Positive-reviews-may-divide-gamers-over-heavy-AI-integration.1087821.0.html |
| inZOI Smart Zoi | On-device small model writes NPC inner thoughts | Makes autonomous behaviour easier to read | Experimental, hardware-gated (off for older Nvidia cards); the game's wider reviews call it soulless and scripted | Local inference, no per-call cost, high hardware cost | [S] https://www.gamepressure.com/newsroom/inzoi-implements-experimental-feature-called-smart-zoi-you-must-h/ze7c04 |
| Death by AI, What Beats Rock | Model gives a verdict on a player's answer | A one-bit verdict is a complete mechanic | Players cheat by editing requests | - | [P] |
| Freysa | Pay to persuade an agent to release money | - | Broken on attempt 482. If model output moves value, players will break it | - | [P] |

### 1.2 Research

- **Word2World** (Nasir, James, Togelius, 2024): one model writes a story, then builds a 2D tile world in two passes
  (environment, then characters and interactive tiles). Algorithmic checks clean the output, and A* playability checks
  plus model evaluations are fed back into later rounds. Lesson: generate, check with ordinary code, feed the failure
  back, repeat. [S] https://arxiv.org/abs/2405.06686
- **RuleSmith** (2026): multi-agent self-play plus Bayesian optimisation tunes rule parameters for balance. It balances
  rules, not items; the transferable idea is that balance is found by simulation, not by asking the model. [S]
  https://arxiv.org/abs/2602.06232
- **quest-forge** (GitHub project, not a paper): generates quests, items and loot, validates against balance
  constraints, and repairs failures by re-prompting. [S] https://github.com/Koval09/quest-forge
- **Quest generation**: grounding the model in a knowledge graph of the world's places, NPCs and items raises rated
  fluency and consistency, but memory and long-session consistency stay weak. [S] survey https://arxiv.org/abs/2411.00308 ;
  earlier baseline https://arxiv.org/abs/1909.06283
- I found **no paper on LLM item generation under a point budget**. The repo's own scheme (fixed vocabulary, levels,
  deterministic repair) is ahead of what I could find published.

### 1.3 Pattern

- **Works:** the model picks from a closed set; the pick is cached forever; a player caused it and is credited; the
  tone tolerates odd results; the game is complete without the model (Alchemy Unbound's off switch, this repo's
  procedural fallback).
- **Hollow:** open chat, ambient "thoughts", generated prose nobody asked for, anything where a surprising sentence
  changes nothing the player can do.
- **Costs:** every shipped approach is one of: global cache so cost falls over time (Infinite Craft); pass the cost to
  the player (Suck Up!, Dreamio); run locally and gate on hardware (inZOI). Only the first suits a free browser game.

---

## 2. Keeping generated items balanced

The current design (DESIGN.md section 4.1) already has the core: 48 primitives at levels 1-5, a versioned price
table, deterministic repair to an exact budget, cached levels rather than numbers, recipe key = hash(ruleset version,
sorted inputs), tier 4 cannot be fused again, no player text reaches the model. [P] What follows is what each
technique buys and where it stops.

| Technique | Stops | Does not stop |
|---|---|---|
| Typed effect grammar (model fills slots from a closed vocabulary) | Invented mechanics, unparseable output, prompt injection through item names | A bad primitive in the vocabulary; two primitives that multiply |
| Point budget with deterministic repair | One item being stronger than its tier | Synergy between items, and loadouts made only of best-in-budget picks |
| Tier cap and "finished" items | Endless chaining and long-name farming | Creep inside a tier as more recipes are discovered (see below) |
| Validate, repair, reject | Schema errors, banned names, duplicates | Tone drift, dull names |
| Canonical server cache keyed by inputs + ruleset version | Rerolling for a better result, per-player divergence, repeat cost | A poor first result being permanent |
| Store levels, not numbers | Regenerating after a balance patch | - |
| Per-stat caps in combat code | Multiplicative stacking | - |
| Flavour-only generation (model writes name and text; code picks mechanics) | Every balance risk | Loses "the pair's meaning decides the effect", which is the hook |

Points specific to the pivot [I]:

1. **Discovery is a max operator.** With N recipes per tier, players settle on the best few per slot. Every new
   recipe can only raise that maximum. A budget bounds each item; it does not bound the best of ten thousand. Counter:
   make primitives situational (tied to zone, enemy family, tool use or station) so "best" depends on the job, cap how
   many primitives of one family a loadout can carry, and run the existing headless sim over new recipes to flag
   outliers before they are stamped.
2. **Tier must come from the world, not from the chain.** Today's budget is (A + B) x 1.4, capped at 110. In a
   persistent game that is a faucet for power: fuse twice and you have outrun the zone. In the New World-like game,
   budget should be a function of *material tier and station tier*, and the model should only decide how the budget is
   spent. A T2 station cannot emit a T3 item whatever goes in.
3. **Split the output in two.** Mechanics are picked by the model inside the grammar. Name, description and
   provenance line are free text checked by validators. Keep them as separate fields so that flavour can be
   regenerated or localised without touching the cached mechanics.
4. **Quarantine before canon.** A first-made recipe is usable by its finder at once, but becomes world canon (and
   tradeable) only after an automatic check: budget exact, no primitive combination on a deny list, sim outlier score
   under a threshold. This costs nothing in feel and gives a place to stop a bad result.
5. **A recipe can be retired, never silently changed.** Infinite Craft's censored elements broke recipes that used to
   work. [P] Version the ruleset; if a recipe is pulled, existing copies become a named "relic" with the old effect at
   a legal level, and the finder keeps the credit.

---

## 3. Where AI adds felt value in a gather/craft game

Ranked by value against risk. [I], drawing on sections 1 and 2. "Calls" is how the cost behaves.

| # | Feature | Felt value | Economic risk | Calls | Offline | Verdict |
|---|---|---|---|---|---|---|
| 1 | Discovery and naming rights: first combination picks one of three model names; name stamped for good | Very high: the proven hook | Low if the budget rules hold | Once per pair, world-wide | Pack + fallback | Keep; it is the identity of the game |
| 2 | Generated schematics: a schematic is a cached recipe made learnable and tradeable; found through discovery, commissions and rumours | High: turns a codex entry into property and into a trade good | Medium: schematics are the item-type faucet, so their supply must be rationed | Same call as 1 | Pack | Build; this is how fusion maps onto New World's schematic system |
| 3 | NPC orders and commissions with reasons: "the ferryman wants something that keeps rope dry, because..."; model writes the request from authored templates and grades submitted items on a four-value scale; code sets the pay | High: gives odd generated items a buyer, which a thin market cannot | Low to medium: pay is from a code table; cap per day | One per commission, one per (commission, item) grade, cached | Pre-generated pool; grading by tag match offline | Build; best value per risk after 1 |
| 4 | Item history: a provenance line assembled from real events (who first made it, where, what it was used for, who sold it) | Medium to high for the price: makes a hand-me-down item feel owned | None: text only | One per notable item, or none if templated | Template | Build cheaply; only for events that happened |
| 5 | Daily rumours pointing to nodes: code picks the node, zone and bonus; the model words the rumour | Medium: gives a reason to go somewhere today | Low: it only redirects gathering; cap the bonus | One small batch per day per world | Pre-generated bank | Build |
| 6 | Town projects and world events with a written cause | Medium: the sink gets a story | Low: quantities set by code | One per project | Pre-generated | Build as text on a code-driven system |
| 7 | Zone and landmark flavour: names and one-line descriptions for discovered places | Medium at first sight, then wallpaper | None | Once per place | Ship in pack | Pre-generate and edit by hand; not a live feature |
| 8 | House visitors' comments on what you have displayed | Low to medium: charming for a week | None | Per visit unless keyed to the set of displayed items | Template | Later, and only if keyed to tags so it caches |
| 9 | Generated quests with multi-step structure | Medium | Medium: quests are a currency faucet and coherence fails over long chains | Per quest | Poor | Skip; commissions cover the need |
| 10 | Open chat with NPCs, haggling | Low after novelty | High: free text, uncacheable, mints or moves value | Per message | None | Do not build |
| 11 | Generated enemies, nodes or loot tables | Low agency | High | - | - | Do not build |

Reading of the list: the model is most useful where it creates **demand, direction and ownership**, and least useful
where it creates **supply or chatter**. Features 3, 5 and 6 matter more in the new game than in the old one because a
small or solo world has no crowd to supply reasons to craft.

---

## 4. Player economy for small populations and solo

### 4.1 How large games control inflation, and what went wrong

| Game | Mechanism | Lesson for this pivot | Status |
|---|---|---|---|
| EVE Online | Publishes a Monthly Economic Report tracking faucets, sinks and a price index; main sinks are sales tax, broker fees and the loyalty store; a 2021 report showed faucets at nearly twice the sinks; events visibly move the faucets. Items are destroyed in combat, and most items are player-built | Measure faucets and sinks from the first day; destruction is what keeps crafters employed | [S] https://www.eveonline.com/news/view/monthly-economic-report-october-2025 ; destruction point [R] |
| Old School RuneScape | Grand Exchange tax (1% in December 2021, later 2%, capped per item); part of the tax buys chosen items and deletes them; per-item buy limits every four hours | A tax that turns into an **item sink** removes surplus goods as well as coin; buy limits blunt bots and cornering | [S] https://oldschool.runescape.wiki/w/Update:Grand_Exchange_Tax_&_Item_Sink ; rates in [P] |
| Albion Online | Gear is lost or destroyed on death in dangerous zones; crafting stations charge a usage fee; crafting returns a share of materials, more with a daily-limited "focus" resource; the Black Market buys player-crafted gear and re-issues it as monster drops | Dropped loot should never compete with crafters. A daily-limited crafting resource paces output without a hard cap. Critics note full loot mostly moves wealth between PvP players rather than removing it | [S] https://devtrackers.gg/albion/p/510446ae-usage-fee-and-crafting-changes-lands-awakened-update , https://gamedepth.onrender.com/posts/economy-wars-how-bdo-eve-and-albion-handle-wealth-redistribution ; Black Market in [P] |
| New World | Sinks: repair, crafting and trading taxes, housing tax, town upkeep. At launch sinks beat income, coin ran short, servers bartered, and with no NPC vendor there was no price floor. Two duplication waves forced Amazon to switch off all wealth transfer, which also froze town upkeep. Later fixes: linked trading posts, lower repair cost | It failed by **deflation**, not inflation. Anchor prices with an NPC floor; never make town function depend on trade tax alone; have a trade kill-switch; do not split a thin market by settlement | [S] https://shacknews.com/article/127240/new-worlds-economy-is-currently-suffering-from-deflation , https://invenglobal.com/articles/15691/new-world-takes-its-entire-economy-offline-again |
| Path of Exile | Every currency is a consumable that performs a crafting operation; GGG: most currency trades end with the item being consumed, so sinks such as repair are unnecessary. Side effect: the Chaos orb became a unit of account and lost its crafting identity. GGG: easier trade means lower drop rates | The cleanest design for a small game: **the money is the crafting input**, so using it destroys it. Expect one material to become the de facto coin | [S] https://pathofexile.com/forum/view-thread/55102 , https://saschb2b.github.io/game-mechanics/concepts/currency-as-crafting ; trade manifesto in [P] |
| Diablo 3 | Auction house (gold and real money). Jay Wilson: it "really hurt the game"; the game ended up tuned so the auction house felt necessary; seeing millions of players' items at once distorted rarity; removed in 2014 | If buying is the best way to get gear, playing stops mattering. In a gather/craft game the market must sell **inputs and conveniences**, and the best items must be made or commissioned, not browsed | [S] https://www.pcgamer.com/diablo-3-auction-house-jay-wilson , https://www.gamespot.com/articles/ten-years-later-lessons-from-diablo-iiis-auction-house-disaster-have-not-been-remembered/1100-6503489/ |

Standard tools, for reference [P][R]: transaction tax and listing fee; station fees; durability and repair; salvage
returning a fraction of inputs; bind-on-equip (an item leaves the market once used); bind-on-pickup for top rewards;
upkeep (housing); consumables; and item destruction. The sinks that work best are the ones players like least, so
attach each to something they wanted to do anyway.

### 4.2 Faking a market when there are few or no players

- **Price function of stock.** A single-player trading game's write-up: price = base x a logarithmic function of
  supply and demand, so early sales barely move the price and flooding a market collapses it. [S]
  https://forums.unrealengine.com/t/simulating-a-dynamic-economy-in-unreal-engine-5-blueprints-only/2695799
- **Agent markets** (BazaarBot): simulated traders adjust price beliefs and change jobs when a good gluts. Developers
  report these can fail to converge. Too heavy and too opaque for this game. [S]
  https://hehe.gamedev.net/tutorials/programming/general-and-gameplay-programming/bazaarbot-an-open-source-economics-engine-r3206
- **Fixed prices** (Stardew Valley's shipping bin pays the listed price next morning, always). Predictable and
  exploitable: the best crop is solved once. [S] https://stardewvalleywiki.com/Shipping
- **Shopkeeper games.** Moonlighter: each item has an ideal price found from customer reactions, and a popularity
  multiplier that falls when you oversell and shifts on special days. Recettear rewards pricing near what each
  customer type will pay, and (from memory) runs news events that raise or crash a category. [S]
  https://primagames.com/tips/moonlighter-2-shop-guide-pricing-furniture-perks-explained ,
  https://pcgamer.com/10-years-on-recettear-an-item-shops-tale-is-still-the-best-fantasy-shopkeeper-tycoon-game ;
  Recettear events [R]
- **Market makers and price bands** (Prosperous Universe): static NPC bids and asks on essentials, with orders
  restricted to a band around the recent average. [P]

Recommended shape [I], one model for solo and shared worlds so the game is the same in both:

1. **NPC factor on materials only.** Buys at a floor and sells at a ceiling with a wide spread; daily quantity is
   finite. In solo it is the whole market; in a shared world players trade inside the spread.
2. **Saturation and recovery.** Each sale to the factor lowers that good's price for you by a step; prices recover
   toward the reference over a few days. This is the anti-grind rule: it rewards variety of gathering.
3. **Seeded drift.** The reference price of each material family follows a slow seeded walk plus dated events (a
   rumour or project raises demand for a week). Deterministic from the world seed and date, so it works offline.
4. **Commissions are the demand for finished goods.** NPCs do not buy gear at a list price. They post orders with
   requirements; pay comes from a code table by tier and fit. This is where generated items get a use.
5. **Town projects are the bulk sink.** Stations, storage and zone access are bought by delivering materials and
   crafted goods, not coin. In solo the project is sized for one player; in a shared world it scales with active
   players. Do not fund upkeep from trade tax (New World).
6. **Coin is scarce by design and backed by a material.** Following Path of Exile, let the higher crafting operations
   consume a tradeable reagent, so the thing people hoard is also the thing crafting burns.

### 4.3 What breaks when content is unbounded or generated, and the fix

| Failure | Why generated content makes it worse | Prevention |
|---|---|---|
| Power creep | Each discovery can only raise the best-in-slot (2.1) | Tier from materials and station, never from the chain; situational primitives; loadout family caps; sim screening; seasonal ruleset versions |
| Market fragmentation | Thousands of item types, each a market of one, in a world with ten sellers | Trade happens in a **small fixed set of fungible goods** (raw and refined materials, reagents, schematics). Finished generated items are listed and searched by attributes (slot, tier, tags, primitives), not by name. Everything salvages to the common materials, so every item has a floor price and an exit |
| Type explosion in storage, UI and codex | Unbounded names | Cap active recipes per station tier per season; items share a fixed set of archetypes for icon and slot; codex groups by archetype |
| Arbitrage loops | A generated recipe whose output salvages or sells for more than its inputs | Invariant checked in code on every new recipe: salvage value < input value x 0.5, and factor bid for outputs < factor ask for inputs. Reject or repair before caching |
| Faucet through generation | Fusion or discovery that creates value from nothing (budget multiplier above 1 with free inputs) | Crafting always consumes inputs plus a station fee; discovery rewards are titles and schematic rights, not coin or materials |
| Exploit from an effect | A primitive that touches economy variables (yield, price, drop rate, durability) compounds | Keep economy-affecting primitives out of the model's vocabulary, or cap them additively per character in code |
| Reroll and cache gaming | Players try to steer the stored result | Key by inputs and ruleset only; no player text; one result per key; server-side only |
| Bots farming firsts | Firsts carry status | Daily untried-pair allowance (already 20), inputs really consumed, account-age gate, counted firsts restricted to a defined set [P] |
| Dupes | More item types means more code paths | Atomic transfers, idempotency keys, ledger invariant, kill-switch [P] |
| Solo save editing leaking into a shared world | Offline worlds are client-trusted | Solo and shared inventories never mix; a solo discovery is re-derived by the server when the same pair is first tried online |
| A bad result made permanent | Canon is forever | Quarantine step (2.4) and retire-to-relic rule (2.5) |
| Moderation | Names are public | Three model-proposed names, validators, blocklist, no free text [P] |

---

## 5. Offline: what to ship and what to generate live

Constraint check on running a model in the browser: WebLLM supports JSON-schema-constrained output and caches weights
after first load, but a small model is hundreds of megabytes to about a gigabyte (SmolLM2-1.7B: about 925 MB), needs
WebGPU and enough GPU memory, and I found no latency figures for integrated GPUs. [S]
https://arxiv.org/abs/2412.15803 , https://simonwillison.net/2024/Nov/29/structured-generation-smollm2-webgpu/
Conclusion [I]: not the default. It could be an opt-in "local forge" later; the grammar and repair step would make a
weak model safe, only duller.

| Content | Ship pre-generated (reviewed) | Generate live | Offline behaviour |
|---|---|---|---|
| Recipes for pairs of authored items | Yes: generate the whole authored-pair space (2,415 pairs today) with the real model, screen with the sim, ship as a data pack | Only pairs involving generated items | Pack answers known pairs; procedural generator answers the rest, marked as local |
| Second-generation recipes | The most likely few thousand, chosen from play data | The long tail | Procedural |
| Schematics | Derived from the pack | Same as recipes | Pack |
| Zone, landmark, node and station names and descriptions | All of it, hand-edited | None | Pack |
| Commission and order texts | A bank of several hundred per NPC and tier, built from templates with slots | Fresh ones for a shared world; grading of unusual submissions | Bank; grading by tag and primitive match in code |
| Rumours and event texts | A dated bank per zone and season | Daily batch for a shared world | Bank selected by seed and date |
| Item history lines | Templates | Optional rewrite for notable items | Templates filled from the event log |
| Visitor comments | Bank keyed by tag sets | None at first | Bank |
| Prices, drops, budgets, pay | Code and tables only | Never | Identical online and offline |

Rules for the two modes [I]:

- The online model is an **upgrade to wording and to recipe choice**, never to numbers. A solo offline player and an
  online player face the same budgets, prices and sinks.
- Pack and server cache share one key scheme and ruleset version, so the pack is simply the cache's first rows.
- Offline firsts are local. When a solo world connects, its untried pairs are asked of the server; the server's answer
  is canon, the local name is kept as a private nickname. This prevents a tampered client from writing to the shared
  world.
- Live generation is batched and asynchronous wherever the player is not waiting: rumours nightly, commissions when
  the board refreshes. Only a first fusion needs an answer within a second or two.

---

## 6. Recommendations

### 6.1 Rules for "AI content that cannot break the economy"

1. **The model chooses, code counts.** The model only picks from a closed vocabulary of primitives and levels and
   writes names and text. Every number, price, drop, payout and quantity comes from versioned tables in code.
2. **Tier comes from materials and station.** An item's budget is set by the tier of what was consumed and where it
   was made. No chain of generated steps can raise it.
3. **Nothing generated is a faucet.** Generation never creates coin or materials. Every craft consumes inputs and a
   fee; every generated reward is status, a schematic right or text.
4. **Every recipe passes conservation checks before it is cached.** Salvage value and NPC bid of the output are below
   the cost of the inputs by a fixed margin; budget is exact; no denied primitive pair.
5. **Economy levers are not in the vocabulary.** Yield, price, drop rate, durability and tax effects are authored, or
   capped additively per character in code.
6. **One canonical answer per key, held on the server.** Key = ruleset version + sorted inputs. No player text, no
   reroll, no client authority. Solo worlds use the shipped pack and never write to shared canon.
7. **Trade in a fixed set of fungible goods.** Materials, reagents and schematics are the market. Generated items are
   searched by attribute, and all of them salvage to common materials, so no item type needs its own liquidity.
8. **Ration new types.** A daily allowance of untried combinations per account, a cap on recipes that can become
   canon per tier per season, and "finished" items that cannot be combined further.
9. **Quarantine, then canon; retire, never rewrite.** A first is usable at once by its finder, joins the world after
   automatic screening, and if later pulled becomes a relic with the finder's credit intact.
10. **Sinks are attached to wanted actions and sized to the world.** Station fees, wear, salvage loss, housing upkeep
    and town projects scale with active players. Measure faucets and sinks from day one, and keep a trade kill-switch.
11. **The game is complete with the model off.** Same rules, prices and progression from the pack and the procedural
    generator; the model adds better choices and better words.
12. **The market sells inputs, not answers.** The best gear is made or commissioned. If buying beats making, lower
    drop and schematic supply rather than adding a tax.

### 6.2 The five AI features most worth building

1. **Discovery with naming rights, moved onto stations.** The first time a combination is made at a station, the
   model spends the tier's budget and offers three names; the finder picks one and is credited for good. Unchanged in
   spirit from today's fusion, with tier taken from materials and station.
2. **Generated schematics as property.** A discovery produces a schematic that can be learned, sold or donated to a
   town station. This is the bridge between "the AI invents" and New World's schematic system, and it gives the market
   a high-value fungible good.
3. **Commissions with reasons.** NPCs (and, in shared worlds, players) post requests written from authored templates;
   the model grades a submitted item on a four-step fit scale; code pays. It is the main demand source for generated
   items in a small or solo world.
4. **Rumours and town projects with a cause.** Code decides which node, zone or project is hot this week; the model
   writes why. It directs gathering, moves prices through the seeded drift, and gives the sinks a story.
5. **Item provenance.** A short history on notable items built from real events: first maker, place, commissions it
   filled, owners. Cheap, safe, and the reason a traded item is more than its stats.

Not in the five, on purpose: open NPC chat, haggling, generated quests, generated enemies or loot, and ambient text
with no player cause.

---

## 7. Gaps and things to check

- No technical write-up by Neal Agarwal on Infinite Craft's prompt, cache or costs was found; all detail is from
  press, Wikipedia and third-party scripts.
- No published work on budget-constrained LLM item generation was found.
- Nothing found on Inworld Origins' reception, or on whether Alchemy Unbound shares recipes between players.
- Albion and EVE fee figures were not confirmed from official pages; Recettear's price events are from memory.
- Steam review figures vary by snapshot and language page.
- In-browser model latency on ordinary laptops is unmeasured; test before considering a local forge.
- The claims in 2.1 (discovery as a max operator) and 4.3 are reasoning, not measurements. The existing headless sim
  is the tool to test the first; a faucet/sink ledger in a small playtest is the tool to test the second.

## Sources used this session

- https://en.wikipedia.org/wiki/Infinite_Craft
- https://www.pcgamer.com/this-browser-based-endless-crafting-game-starts-you-off-with-fire-and-water-but-it-quickly-escalates-to-god-the-big-bang-and-yin-yoda
- https://store.steampowered.com/app/1889620/AI_Roguelite
- https://store.steampowered.com/app/2858840
- https://store.steampowered.com/app/2795060
- https://store.steampowered.com/app/2726370
- https://themagicrain.com/?p=42121
- https://store.steampowered.com/app/2782660
- https://arxiv.org/abs/2308.12915
- https://www.notebookcheck.net/Steam-launch-New-interactive-fiction-game-debuts-to-Very-Positive-reviews-may-divide-gamers-over-heavy-AI-integration.1087821.0.html
- https://www.gamepressure.com/newsroom/inzoi-implements-experimental-feature-called-smart-zoi-you-must-h/ze7c04
- https://www.pcgamer.com/gaming-industry/i-tried-two-demos-of-machine-learning-ai-npcs-and-they-didnt-convince-me-the-ai-will-lead-to-anything-that-immersive-sims-like-deus-ex-havent-already-done-better/
- https://app.cinevva.com/guides/ai-npcs-dialogue
- https://samucox.github.io/files/CONVERSATIONS'23%20Paper.pdf
- https://arxiv.org/abs/2405.06686
- https://arxiv.org/abs/2602.06232
- https://github.com/Koval09/quest-forge
- https://arxiv.org/abs/2411.00308
- https://arxiv.org/abs/1909.06283
- https://shacknews.com/article/127240/new-worlds-economy-is-currently-suffering-from-deflation
- https://invenglobal.com/articles/15691/new-world-takes-its-entire-economy-offline-again
- https://www.pcgamer.com/diablo-3-auction-house-jay-wilson
- https://www.gamespot.com/articles/ten-years-later-lessons-from-diablo-iiis-auction-house-disaster-have-not-been-remembered/1100-6503489/
- https://pathofexile.com/forum/view-thread/55102
- https://saschb2b.github.io/game-mechanics/concepts/currency-as-crafting
- https://www.eveonline.com/news/view/monthly-economic-report-october-2025
- https://oldschool.runescape.wiki/w/Update:Grand_Exchange_Tax_&_Item_Sink
- https://oldschool.runescape.wiki/w/Sink_(economy)
- https://devtrackers.gg/albion/p/510446ae-usage-fee-and-crafting-changes-lands-awakened-update
- https://gamedepth.onrender.com/posts/economy-wars-how-bdo-eve-and-albion-handle-wealth-redistribution
- https://forums.unrealengine.com/t/simulating-a-dynamic-economy-in-unreal-engine-5-blueprints-only/2695799
- https://hehe.gamedev.net/tutorials/programming/general-and-gameplay-programming/bazaarbot-an-open-source-economics-engine-r3206
- https://stardewvalleywiki.com/Shipping
- https://primagames.com/tips/moonlighter-2-shop-guide-pricing-furniture-perks-explained
- https://pcgamer.com/10-years-on-recettear-an-item-shops-tale-is-still-the-best-fantasy-shopkeeper-tycoon-game
- https://arxiv.org/abs/2412.15803
- https://simonwillison.net/2024/Nov/29/structured-generation-smollm2-webgpu/
