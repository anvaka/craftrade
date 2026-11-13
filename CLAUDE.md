# Project brief: New World x Brotato hybrid, first playable

## Direction changed by the owner on 2026-11-12 (this section overrides the brief below)
The first playable was built and played. Result: gathering on was more fun than off, and once heat was tuned to bite the owner left nodes alone and died to greed. The kill condition was not triggered. The owner then judged a thin slice not worth replaying and asked for **the full game from the design graph, built end to end**, with independent agents verifying it against the graph and for staying power.

Scope of the full build:
- Single player, in the browser, saved in localStorage. Same stack as below.
- Build every graph node that does not need a server or a player population: the 12-wave run with three boss gates, shop and merges, camp craft, routes and shrines, extraction and bag loss, town stations, crafting, alchemy, schematics and codex, kits, keys, weekly mutators, vault, standing, mastery.
- Not built, because they need servers or other players: player market and trade rules, co-op, raids, live PvP, company wars, commission crafting. Season reset is also not built.
- The "first playable scope", "kill condition" and "out of scope" sections below are history. The prototype is archived in `archive/first-playable/`.
- The owner still wants honest, sceptical reporting. Agents cannot measure fun; say so.

## What this is
A game concept crossing New World (gathering, crafting, bags with weight, trading) with Brotato (short waves, shop between waves, merging weapons). There is no game yet. Two rounds of sceptical review concluded that paper design and simulation have nothing more to say, and that the next step is a small prototype.

## Your task
Build the first playable described below, and nothing beyond it. Its only purpose is to answer one question: **is gathering under fire more fun than not gathering?**

### First playable scope
- One top-down 2D arena, five timed waves (about 30 to 60 seconds each), then a results screen.
- Player: move, automatic light attacks on the nearest enemy, a dodge with brief invulnerability, and a charged heavy swing. Dodge and heavy swing share one stamina bar.
- The heavy swing is also how you mine: ore nodes take two or three swings and drop material.
- Each wave has a lull, a swell and a short peak. Common nodes are open from the start; rich nodes only open during the swell, at the arena edges, and close when it ends.
- Heat meter: every strike on a node raises it; heat raises the number of enemies arriving; it cools while you are not gathering. Always visible.
- Three enemy roles: a swarm, a shield-bearer that needs the heavy swing, and a burrower that attacks nodes.
- Carried material slows the player a little per unit.
- A toggle to run the same five waves with **gathering switched off** (no nodes, no heat), for comparison.
- Results screen: material collected, damage taken, heat peak, time spent gathering.

### Kill condition
If, after tuning, playing with gathering on is not clearly more interesting than with it off, stop and report that. Do not add systems to rescue it.

### Out of scope (do not build)
Town, market, crafting stations, schematics, camp crafts, routes, shrines, kits, co-op, PvP, raids, accounts, servers, saving between sessions. These exist in the design graph and are deliberately deferred.

### Constraints the reviews set
- A wave should ask the player to track about six things: position, health, stamina, heat, the wave beat, and at most one cooldown. Do not add HUD elements beyond these.
- Waves end on a timer, never on kills.
- Feedback matters more than content: impact pause, camera kick, pitched pickup sounds, enemy sound that grows with their number.

## Decided by the owner (2026-11-12)
- Engine: TypeScript in the browser, plain 2D canvas and WebAudio, built with Vite. No game framework.
- Art: placeholder shapes.
- Controls: keyboard + mouse on desktop, touch on mobile.

## The full build: map of the code
- `npm install`, `npm run dev` (add `-- --host` for a phone on the same network). `npm run build` typechecks and builds.
- `npm run bot` plays whole expeditions headless with scripted policies (`scripts/bot.ts`). It finds crashes and gross imbalance; it does not measure fun.
- `scripts/shots.sh <outdir> name=query ...` takes headless Chrome screenshots of the built game. Debug queries: `?demo=town|rich|wave|camp|gate|tally`, `&tab=Forge`, `&waves=N`, `&warp=N`, `&ground=quarry|grove|marsh`, `&obj=supply|nests|elite`, `&elite=id`. Demo mode uses a throwaway profile, never writes the save, and exposes `window.__cw`.
- `scripts/e2e-full.mjs` plays a whole game from a fresh save in headless Chrome with real key and mouse input (welcome, guided expeditions, camp, gate, summary, every town tab, a craft at each station). Run it against `npx vite preview --port 4181`. The other `scripts/e2e-*.mjs` were written against the first menus and touch layout and are stale.
- `src/data.ts`: all content tables and tuning numbers (materials, weapons, items, recipes, schematics, kits, wild picks, mutators, bosses, `CFG`).
- `src/game.ts`: one wave in the arena. No DOM. Takes a `WaveSpec`, returns a `WaveResult`.
- `src/run.ts`: one expedition as plain data: shop, merges, camp craft, routes, shrines, boss gates, extraction.
- `src/meta.ts`: the town and the save (localStorage key `craftworld.save.v2`): crafting, alchemy, schematics, standing, vault, keys, applying a finished run.
- `src/ui/`: every DOM screen. `app.ts` is the shell (state, tabs, action dispatch by `data-a`/`data-v`/`data-w`, keyboard shortcuts by `data-key`, windows, toast). `kit.ts` holds the shared pieces (item tile, tooltip, bars). `things.ts` turns any reference (`gear:`, `mat:`, `brew:`, `schem:` ...) into one description used by every tile and tooltip. `icons.ts` holds the drawn icons (`dev/icons.html` is a contact sheet). `town-inventory.ts`, `town-station.ts` (forge, workshop, apothecary), `town-expedition.ts`, `town-codex.ts`, `town-character.ts`, `modals.ts` are the town. `run-*.ts` are tally, camp, gate, summary, pause and welcome. `style.css` is the only stylesheet.
- `src/render.ts` draws the arena from `src/art/*` (terrain, nodes, creatures, pawn, items, effects, light). `src/hud.ts` draws everything on top of the arena, including the touch controls. `src/input.ts` holds the key bindings and the touch button layout (`buttons()`). `src/audio.ts`, `src/main.ts`: the rest of the shell.
- `src/log.ts`: the play log (localStorage key `craftworld.log.v1`, last 300 expeditions): one row per wave (health in and out, damage taken, heat, what was gathered, what each weapon did), every camp and gate action with its cost, every town action, and how each expedition ended. It is written at the end of each wave and from `dispatch` in `src/ui/app.ts`; demo mode writes nothing. The owner exports it from Character → Record → Play log (a file or the clipboard); `npm run log -- <file>` prints a balance report from it (`scripts/log-report.ts`). Nothing is sent anywhere.
- `archive/old-menus/`: the first menus (one `ui.ts` and an inline stylesheet), replaced on 2026-11-12.
- Rule for every figure a menu or the HUD shows: take it from the rules (`game.ts`, `run.ts`, `meta.ts`), or from a run with the action already applied (`afterBuy`, `mergeAfter`, `changeLines` in `src/ui/run-common.ts`), never from a second formula in the UI. A bug hunt on 2026-11-12 found about 90 places where a re-derived number or a sentence disagreed with the rules (a damage figure without the weight perk, a merge preview that ignored the set it broke). A fact the tally needs is recorded when it happens (`WaveResult.objScrap`, `run.last.rest`), not worked out afterwards.

## Look and menus, decided by the owner on 2026-11-12
- Menus follow New World: an inventory of item tiles with a loadout, tooltips that compare against what is equipped, three-pane crafting stations that show have/need, how many can be made now, a perk choice and a quantity. After a craft a window says what was made and where it is.
- The arena follows RimWorld's look: flat top-down ground, blocky ore, simple pawns, soft light. All art is drawn in code and is original; reference screenshots are never copied into the project.
- "Art: placeholder shapes" below is history.

## Where the build departs from the graph, on purpose
- Shop: buy as much as you can afford, reroll, lock. The graph's "one shop action per camp" is an unresolved node and both reviews said it guts the shop.
- Level-ups offer a pick of three (the graph says automatic). Added after the replay review: it is about eleven more decisions per run.
- Evolution needs tier III or higher (not the top tier) and the part of a named elite, for any family you brought or hold the recipe for, so the breakout can happen at gates 1 and 2.
- The key rises only on a full clear with all three bosses dead and a quota of node materials banked, so not mining is not the way up.
- Heat brings enemies on a curve and raises node yield, so holding some heat is a bet and not only a cost.
- Leaving the game mid-wave counts as a fall (it was a free retry). The run is saved at camp and at gates.
- Guided start is three expeditions, with heat on from the first (the graph's teaching order holds heat back to session five). A step only counts once the first boss gate is reached; falling earlier repeats the step.
- Surplus materials can be sold for a little coin (any amount, with an undo) or given to town projects for standing (a sink the graph does not have; there is no player market). Gear can be locked against dismantling.
- Six auto-firing weapon slots; the two crafted weapons you bring set two abilities on one shared cooldown, and Q swaps them.
- Enemies that arrive because of heat pay 30% scrap and xp and leave 30% of the drops, so greed buys danger and not income.
- Scale: 30 schematics (graph says 120), 6 kits (20+), 9 wild picks, 6 mutators, 4 named elites, 3 bosses.
- Not built: player market and all trade rules, co-op, raids, live PvP, company wars, commission crafting, season reset, rival ghosts, arena reshaping, trait transfer in alchemy, artifact weapons, the pack-cart objective. The weekly race exists but is local only.
- Known open problems from the agent reviews: base pressure is low for a player who never gathers; ranged weapons outperform melee in scripted play; content runs out after roughly 20 to 25 expeditions; the owner has not decided whether trade skills may give flat stats (yield, drops, bag comfort).

## Where things are
- `design/game-design-graph.dot`: the full design graph (Graphviz DOT, 331 nodes). Nodes with a `verdict` attribute are design proposals; `verdict="unresolved"` marks the open problems. Nodes with a `url` are sourced references. `design/full-graph.svg` is a render.
- `reviews/design_nodes_v2.md`: every design proposal as readable text. Start here, not with the DOT file.
- `reviews/r2_player_producer.md` and `reviews/r2_breaker.md`: the latest critiques. Read both before making design choices; `veteran.md`, `producer.md`, `auditor.md`, `minmaxer.md` are round 1.
- `design/session_sim2.py`, `design/economy_model.py`: the author's simulations. Reviewers found their conclusions weak; use them for context, not as targets.

## Owner's stated preferences
- No AI controlling crafting supply, naming items, or silently adjusting difficulty.
- Likes New World's inventory, bags, towns, perks, crafting and trading; wants long-term progression, later PvP and raids.
- Wants honest, sceptical feedback, not agreement.
