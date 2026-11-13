# Producer review: New World x Brotato design graph

## 1. Verdict

This is a live-service MMO economy bolted onto an untested 60-second loop: 75 nodes, none played, and the author's own models say the economy gluts and four of five in-run choices are already solved. Build one thing first: a single arena, five waves, auto-attack plus dodge plus a heavy swing that also mines, ore nodes, a heat meter and three enemy roles, then play it against the same build with the nodes switched off. If gathering under fire is not more fun than not gathering, there is no game.

## 2. Scope

Cost is relative to 1x = that solo first playable (my assumption: about 3 person-months for 2-3 people, top-down 2D, no server). Multipliers are rough estimates, not measurements.

| Node (group) | Bucket | Cost | Risk |
|---|---|---|---|
| Ore/timber nodes under fire; heat; rich nodes at the edges; lull-swell-peak | First playable | in 1x | The core bet; untested |
| Auto attacks, dodge and heavy swing on one stamina bar (one ability, no swap) | First playable | in 1x | Input overload if all six abilities ship |
| Enemy roles (three of five) | First playable | 3x for the full roster with LOD | Readability at 100 enemies |
| Layered feedback, sound, merge identical weapons, in-run shop, run currency | First playable | in 1x | Low |
| Boss gate, banked-only survival, every session pays, two material classes | First public | 0.5x | Tuning only |
| Town station tiers, standing cards, crafted bags, permanent unlocks as options | First public | 1x | Content volume |
| Recipe merges, named elite parts, evolution, alchemy consumables, effect atoms | First public | 3x | Each atom is hand-made content |
| Route choice, wave objectives, curses, wild picks, verb triggers, tally | First public (small sets) | 2x | Choice count |
| Keys, weekly mutators, vault, seeded race, season tier | First public (keys, mutators); later (rest) | 1.5x | Needs accounts and a server |
| Aimed abilities x6 with weapon swap | Later | 3x | Multiplies every weapon family |
| Gathering reshapes the arena | Later | 4x | Dynamic pathing; every arena re-authored |
| Rival ghost builds | Later | 3x | AI must pilot a human kit |
| One-to-four co-op, party extraction | Later | 6x | Netcode retrofit for 100 enemies |
| Player market with escrow, tradability rules, server-side settlement | Later | 6x plus permanent live ops | Sinks the project |
| Lawless arena | Never | 6x | Population |
| Live 3v3 queues | Never | 8x | Unproven genre fit |
| Company wars | Never | 8x | Population |
| Ten-player raid and its three dependants | Never | 10x+ | Needs co-op, keys, roles, bespoke arenas |
| Sets, artifacts, mastery, reagent book, trait transfer, commission | Later | 2x | Depth nobody has asked for |

**Most likely to sink the project:** `wave-shop-in-run-player-market-between-sessions`. It is marked keep-core, it turns a single-player roguelite into a server-authoritative online service from day one, and its own model shows coin inflating in 40 of 40 runs, material price falling to 0.15 and crafters earning 0.14x a normal player.

## 3. Contradictions

- `fewer-bigger-choices-between-waves` (three decisions at most) against the camp as designed: shop, merge, `azoth-spent-at-merge...`, `charm-sockets...`, `recipe-merges...`, `every-material-has-two-uses...`, flasks, `route-choice...`, `opt-in-curses...`, `milestone-levels...`. That is nine or more.
- `power-never-outruns-the-wave` against `evolution-needs-a-maxed-weapon...`, `multiplying-effects-and-an-end-of-wave-tally` and `triggers-on-gather-on-dodge-on-swap...`. The sim shows 0% cakewalk at every skill level, so the promised power fantasy never arrives.
- `every-session-pays-trade-skill-xp-and-standing` against `only-banked-materials-survive-a-failed-run`, `extraction-is-a-run-to-the-gate-with-a-full-bag`, thieves and `crafted-gear-wears-out...`. Hardcore best play dies 42% of the time.
- `each-wave-has-a-lull-a-swell-and-a-peak` (gathering is safe) against `ore-and-timber-nodes-inside-waves-gathered-under-fire` and `struck-nodes-make-noise-that-raises-heat` (heat cools only when not gathering).
- `how-you-kill-decides-what-you-collect` against `auto-light-attacks...`: the automatic attack takes the finishing blow.
- `permanent-unlocks-add-options-not-flat-stats` against `crafted-bags...` (one more segment per step), `town-standing-cards...` (faster gathering), `capped-weekly-upgrade-currency` and `season-adds-a-material-tier...`.
- `pvp-track-pays-the-same-tier-as-raids` against `raid-exclusive-perks-and-a-bound-crafting-material`. Flatly incompatible.
- `two-material-classes...` against `every-material-has-two-uses...`: the second erases the split the first is built on.
- `systems-not-zones-carry-the-content-load` against route biomes, named elites, reshapable terrain and raid arenas, all hand-built.
- `opt-in-curses...` and `route-choice...` are not choices: the sim solves both identically at all three skill levels.

## 4. Newcomer

As written, a new player meets about 18 concepts before wave one ends: move, auto-attack, three abilities, swap, stamina, dodge, heavy swing, gathering, timed strike, heat, weight, bag drop, finisher types, five roles, wave beats, an objective, two currencies. That cannot be taught. The sim agrees: a median policy earns 31% of the best one. A cut version can be taught:

1. Session 1: move, auto-attack, hold to mine, one currency, shop. Five waves, a boss, automatic extraction, no loss.
2. Session 2: dodge and stamina; heavy swing against one shield enemy; merge two identical weapons.
3. Session 3: the bag, the boss gate, losing the bag on death; town with one station.
4. Session 4: one ability per weapon; spend or save; route choice.
5. Session 5: heat and rich nodes; key level 1; first schematic.

Hide until later: swap, charms, alchemy, curses, wild picks, weight, vault, market.

## 5. The 30-minute player

Assumption: 30 minutes is one run a day, so seven a week, between the model's casual (3) and regular (8) cohorts. Twenty waves do not fit; the model's best play stops at about 10 waves anyway. Over 13 weeks they collect roughly half the 120 schematics (casual 35-38%, regular 59-70%) and reach top tier around week 12 at the earliest, one week before the season makes it entry gear. Casual players never reach it in 40 of 40 runs. They never see waves 11-20 as routine, raids, wars, or a finished collection.

The weekly systems punish them. The cap closes the gap in 3 of 40 runs and front-loading fixes it in 1 of 40. A depleting key turns one bad evening into negative progress. A three-row vault asks for three activities from someone with time for one. Recommendation: no key depletion, vault counted in runs completed, delete the cap.

## 6. Schematics

A schematic is as cheap as what it unlocks. Under `effect-atoms-are-hand-authored-and-perceptibly-distinct`, 120 distinct ones are expensive (my estimate: 6-12 person-months a season), and hardcore players finish by week 7-8 regardless. Minimum viable: schematics are the recipe-merge book. About 12 atoms across 6 weapon families gives 72 table-driven variants; ship 30, drop them from named elites so each is a known target, and unlock the merge permanently. Drop "discovered by trying" and the separate reagent book: one collection, not three.

## 7. Cut list

- Ten-player raid, raid perks, raid entry thresholds, commission crafting: four nodes for a mode needing 10 concurrent players.
- Company wars: a population you do not have.
- Live 3v3 queues: the author calls it unproven.
- Lawless arena: bracket tuning for an empty lobby.
- Buy orders: the author's model shows a glut, so nobody posts them.
- PvP track: no PvP to pay out.
- Capped weekly currency: fails in 37 of 40 runs.
- Gear wear: mild does nothing, harsh leaves 17% of casuals with broken gear.
- Bag weight cap: superseded by the gradual node.
- Extraction run: a second failure point after the decision.
- Trait transfer: depth on an unproven loop.
- Fleeing prey: a third gathering source before the first works.
- Timed strike: test it, expect a chore.
- Six aimed abilities with swap: one ability until the screen proves readable.
