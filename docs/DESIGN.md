# Scrip (working title; repo: craftrade)

A wave-arena roguelite where the arena is also the mine. You fight through
12 short waves in a wilderness clearing, work resource nodes under fire,
build your kit at a bench between waves, and carry a small part of it home
to a town every player shares.

This document is the source of truth for the build. Numbers are starting
values to be tuned by the headless bot and by play, not final.

## 1. What the research said, and what we took from it

Six research briefs fed this design (arena combat, crafting economies,
LLM mechanics, AI-made tells, retention, web tech). Page fetches were
blocked for all six researchers, so their evidence is search extracts, not
full reads. Treat borrowed numbers as hypotheses.

Decisions taken:

| Question | Decision | Why |
|---|---|---|
| Where does gathering live? | Inside the wave, as a place you stand | The only praised precedent is spatial and concurrent with combat. A separate gathering mode would slow the loop. |
| What replaces the shop? | A bench that sells recipes priced in scrip plus raw materials | Keeps the 45 s fight / 30 s decide rhythm and gives every raw an in-run use. |
| How much do New World's 17 trades shrink? | 3 raw families, tools as weapons, 4 town stations | Interdependence survives; the tier treadmill and the chores do not. |
| Random perks on crafted gear? | No. Bench recipes are fixed. Fusion is unknown once, then known forever | New World's most hated feature was RNG after a costly pipeline. |
| What does the LLM do? | Chooses the theme of a fused item from a fixed effect vocabulary. Code owns every number | The mechanic lands when the answer becomes a small, permanent, legible fact. |
| What persists between runs? | Knowledge (codex), options (characters), consumable kit, raws, marks | Permanent stat power makes wins hollow. Researchers disagreed on a cap (10-35%); we use a slot cap instead of a percentage. |
| Is there real-time multiplayer? | No. Shared market, shared town, shared recipe book, daily board | Live lobbies die at low concurrency. Async still works with one player. |
| Look | "Blockprint Almanac": daylit relief print, 7 colours with fixed jobs | Positive rules, not just a list of things to avoid. |

Cut on purpose: haggling with an LLM merchant, AI flavour text, AI enemies,
free-text naming, energy timers, login streaks, loot boxes, a tutorial modal,
achievements for trivial actions.

## 2. The loop

```
        +--------------------- RUN (about 13 min) ----------------------+
        |  wave (20-60 s)  ->  bench  ->  wave  ->  bench ... -> wave 12 |
        |  fight + work nodes   spend scrip and raws, fuse, level up     |
        +-----------------------------+----------------------------------+
                                      | carry home: raws, 0-3 items, marks
                                      v
   TOWN:  stash  ->  workshop (fuse)  ->  market (sell, buy)  ->  town project
                                      |
                                      v  pack a kit of up to 2 items
                                    next run
```

- 5 minute player: the daily clearing (8 waves, fixed character, no kit, one scored try).
- 20 minute player: one run and a stop in town.
- 2 hour player: several characters, recipe hunting, market play.

Time targets: control within 10 s of page load, no sign-up, first 1-of-3
choice by 30 s. The town is skippable; "Go again" restarts in one press.

## 3. The run

### 3.1 Waves

12 waves. Durations in seconds: 20, 25, 30, 35, 40, 45, 50, 55, 60, 60, 60, 90.
Wave 6 and wave 9 bring an elite. Wave 12 is the boss; killing it ends the
wave early. The arena is one fixed clearing about 2.2 screens wide, ringed
by treeline. The camera follows the player.

You only move. Weapons fire on their own at the nearest target in range.
Keyboard (WASD / arrows) or a touch stick.

### 3.2 Scrip

Enemies drop scrip. Scrip is both money and experience, as in Brotato.
XP to next level = (level + 3)^2. Each level gives +1 Max HP and one
upgrade pick at the bench. Of the scrip left on the ground at wave end, 60%
is swept to the purse at once; the rest is banked and pays double on later
pickups until repaid.

### 3.3 Nodes and raws

Three node types stand in the clearing: **trees** (timber), **ore seams**
(ore), **carcasses** (hide). Standing inside a node's work ring works it;
you keep firing while you work. Work rate = 1 + Harvest/20, doubled if you
hold the matching tool. A node takes about 3 s at base rate and bursts into
3 raw pickups. Nodes stand 130-300 px inside a lane mouth. Rich nodes
(8 raws, 6 s of work) appear from wave 3 and stand in the mouth itself,
70-160 px in.

Working is a trade of safety for raws, and the first two waves are exempt
so a new player can learn it in peace. From wave 3:

- **Work is loud.** Every unit of work calls a pack from the nearest lane
  mouth: 3 + wave/2 gnats, and a burrower with them from wave 5. What work
  calls up carries no scrip.
- **Head down.** A hit taken while working lands twice as hard.
- **A job started is a job to finish.** Work on a node left alone drains at
  half a unit a second.

Measured (default bot, 200 seeds): damage taken per second is higher at a
node than away from one, and a build that never works a node still wins,
because a recipe's missing raws can be bought (3.8). See
`docs/critique/depth-after.md` for the numbers.

Tools are weapons. They take a weapon slot, fight worse than a pure weapon
of the same tier, and double work rate on their node: hatchet for trees,
pick for seams, skinning knife for carcasses. This is the New World tool
rule turned into a build choice.

Raws have three competing uses: pay for bench recipes now, pay for a fusion
now, or carry home.

### 3.4 Sending the mule

After waves 4 and 8 you may send the mule. Everything you choose to load
(raws only) is safe at home whatever happens next, and is gone from the run.
If you die, you keep the mule loads plus 30% of the raws you held. If you
win, you keep it all.

### 3.5 Stats

Thirteen stats. Every one must have a build that wants it.

| Stat | Effect |
|---|---|
| Max HP | Health. |
| Mend | HP per second: 0.25 for the first point, +0.14 after. |
| Armor | Damage taken = 1 / (1 + armor/20). Thorns and the recoil blast grow by a twelfth per point. |
| Dodge | Chance to avoid a hit, cap 60%. A dodge gives the same grace as a hit (0.75 s). |
| Speed | Move speed %. |
| Damage | All damage %. |
| Melee | Flat damage for melee weapons, scaled per weapon. |
| Ranged | Flat damage for ranged weapons, scaled per weapon. |
| Rate | Attack speed %. |
| Crit | Crit chance %, crits deal x2. |
| Reach | Weapon range. Melee gets half. |
| Harvest | Work rate, and +1 raw per node for every 10 points. |
| Luck | Rarity of bench offers and upgrade picks, and a third of a percent per point that a kill drops double scrip. |

Damage taken is not rounded. Base Max HP is 16 and a hit gives 0.75 s of
grace.

Against a pure-damage meta: several weapons scale with Armor, Max HP, Reach
or Harvest, and eleven conversion effects turn Armor, Max HP, Speed, Dodge,
Harvest, Luck, held scrip, a matched set of weapons or empty weapon slots
into damage or rate (section 4.1). Each has authored items at every tier, so
a build can be made around any of them.

### 3.6 Weapons

Six slots. Copies of one weapon are held side by side, and each copy adds
4% damage to every other copy of it. Two of the same weapon and tier can be
combined into the next tier (up to 4) at the bench, which frees a slot;
buying a twin with full hands combines at once. A held weapon can also be
raised a tier for scrip (3.8). Classes give a set bonus at 2/4/6 held.

| Weapon | Class | Notes |
|---|---|---|
| Hatchet | Edge, Tool | Sweep. Works trees x2. Scales with Harvest. |
| Pick | Blunt, Tool | Thrust. Works seams x2. Scales with Harvest. |
| Skinning knife | Edge, Tool | Fast, high crit. Works carcasses x2. Scales with Harvest. |
| Maul | Blunt | Slow, wide, heavy knockback. Scales with Max HP. |
| Pike | Edge | Long thrust. Scales with Reach. |
| Sling | Shot | Cheap, fast, weak. |
| Bow | Shot | Pierces 1. |
| Musket | Shot | Slow, heavy, pierces 2. |
| Throwing axe | Edge, Shot | Bounces 2. Scales with Melee and Ranged. |
| Firebrand | Blunt | Wide sweep that sets burn. Burn grows with Damage (so does burn from items). |
| Bola | Shot | Slows, pierces 1. A slowed enemy takes 25% more damage from everything. |
| Buckler | Blunt | Short bash. Gives Armor. Scales with Armor and Max HP. |

Set bonuses at 2 / 4 / 6:

| Class | Bonus |
|---|---|
| Edge | +3 / 7 / 12% Crit, +0 / 1 / 3 Melee |
| Blunt | +3 / 8 / 15 Max HP, +1 / 2 / 4 Armor, +3 / 6 / 10 knockback |
| Shot | +15 / 35 / 60 Reach, +0 / 1 / 3 Ranged, every shot pierces 1 / 2 / 3 more |
| Tool | +6 / 12 / 20 Harvest, +0 / 5 / 10% Damage |

The bench leans toward what is held (3.8). Measured: a player who buys only
one class holds 5.3 to 5.9 of it at the bench after wave 8, and one who buys
only one weapon holds 5.0 to 5.1 copies.

### 3.7 Enemies

Health = (base + perWave x (wave - 1)) x a late-wave multiplier that is 1
through wave 5 and climbs to 2.1 by wave 12 (`WAVE_HP`); damage has its own
(1 through wave 6, 1.6 by wave 12, `WAVE_DMG`). The early waves are flat so
that a first run reaches wave 4 or 5; the late ones climb because a build's
damage grows far faster than linear health. Each enemy is defined by what
it makes you do.

| Enemy | From wave | Behaviour |
|---|---|---|
| Mite | 1 | Walks at you. Fodder. |
| Gnat cloud | 2 | Fast, weak, arrives in packs of 8. |
| Boar | 3 | Paws the ground (0.7 s tell), then charges in a line. |
| Spitter | 4 | Keeps distance, lobs slow shots. |
| Magpie | 4 | Ignores you, grabs scrip and raws off the ground and runs for the treeline. Kill it to get them back. |
| Burrower | 5 | Surfaces next to a node you are working. Work calls one up from wave 5. |
| Brute | 7 | Slow, tough, ground slam with a visible ring. |
| Stag (elite, wave 6) | - | Charges, leaves antler shards that linger. |
| Rotwood (elite, wave 9) | - | A walking tree. Sheds mites. Can be worked like a node while it lives. |
| Old Tusk (boss, wave 12) | - | Three phases: charge, summon, slam rings. About 15,600 health in wave 12. |

Live enemy cap 300. Enemy shots are the only madder-coloured round shapes
on screen.

### 3.8 The bench

After every wave. No timer.

1. **Upgrades.** One pick of 4 per level gained, each raising one stat, tier I-IV.
2. **Offers.** Four recipes. Each is a weapon or an item with a price in scrip
   and usually one or two raws. Price = floor((base + wave + 0.1 x base x wave) x modifiers),
   and a tenth dearer for every bench past 6.
   The first offer is the rack: always a weapon, and it leans hard toward what you hold
   (55% a weapon you hold, 35% one of a class you hold). The other three are 65% item / 35% weapon
   (30% same weapon, 30% same class); the first two benches show 2 weapons + 2 items.
   The rack at bench 1 is always a weapon the player can pay for.
   Rarity: tier 2 from bench 2, tier 3 from bench 4, tier 4 from bench 8; caps 60 / 30 / 15%, scaled by Luck.
3. **Missing raws.** A recipe never locks for want of raws. Each raw the player is short of is
   charged in scrip at 2 + bench number. Dear early, a sink late. The same holds for fusions and tier-ups.
4. **The commission.** From bench 5 there is one more offer: always a tier 3 or tier 4 item,
   at 1.35 times its price. A reroll does not replace it and it cannot be locked.
5. **Reroll.** First reroll floor(0.5 x wave) + 1; each further one adds max(1, floor(0.4 x wave))
   and then costs a third more than the last. Resets each bench. Buying all four gives one free reroll.
6. **Lock.** Free. A locked offer stays and its price freezes.
7. **Tier up.** Raise a held weapon one tier for 80% of the next tier's price and one set of its raws.
   A tier opens at the bench where offers can first roll it (2, 4, 8).
8. **Combine.** Merge two held twins into one weapon of the next tier. Frees a slot.
9. **Scrap.** Sell a weapon or item for 25% of its current price.
10. **Fuse.** See below.

Items do not take slots. 80 authored items (25 / 25 / 20 / 10 by tier), each with a
clear effect in the fixed vocabulary, most with a cost as well as a gain.

### 3.9 Hazard

`createRun({ hazard })` takes a level 0 to 5. Level 0 is the game as described
and is the default. Each level keeps the rules below it and adds one, and
trims enemy health and spawn pace so the ladder falls evenly.

| Level | Rule | Enemy health | Default bot, Greenhorn, 200 seeds |
|---|---|---|---|
| 0 | The standard game | x1 | HZ0 |
| 1 | Early elites: the stag also comes in wave 5 and the rotwood in wave 8, and neither early one carries scrip | x1.37 | HZ1 |
| 2 | Lean nodes: every node holds 1 less | x1.40 | HZ2 |
| 3 | No rest: a new wave mends only half of what is missing | x1.45 | HZ3 |
| 4 | Volleys: spitters spit three at a time, each at 70% | x1.45 | HZ4 |
| 5 | Old Tusk gets up: the boss rises once more at half health | x1.50 | HZ5 |

The pause panel names the level and its rules in one line.

## 4. Fusion: the one LLM mechanic

Put two different items on the anvil. They are consumed and one new item
comes out. The first time anyone in the world tries a pair, a model decides
what the pair becomes. After that the pair is a fact: every player gets the
same result, the codex shows it, and the first finder's name is stamped on
the item for good.

This is Brotato's combine extended sideways: identical weapons merge by
rule; different items merge by meaning.

### 4.1 Rules

- An item is a name, a tier (1-4), tags, and up to 3 effects plus at most 1 drawback.
- An effect is a primitive from a fixed vocabulary (48: 13 stats, 24 specials, 11 conversions) at a level 1-5.
  A versioned price table in code turns (primitive, level) into points and into numbers.
- Fusion budget = round((points(A) + points(B)) x 1.4), at most 110 points. The result's tier follows from its budget. A fused item carries no drawback unless the model gives it one.
- The model receives the two items and the budget. It returns three candidate
  names and a list of (primitive, level) picks that suits the pair. Nothing a
  player typed reaches the model.
- Code validates the picks against the vocabulary, repairs them to the exact
  budget by a fixed deterministic procedure, checks names (letters and spaces,
  3-22 chars, blocklist, no duplicate of an existing item name) and stores the result.
- The cache stores levels, not numbers. A balance patch changes the price
  table and every recipe follows without being regenerated.
- Recipe key = hash(ruleset version, sorted input item ids). Item id = hash of
  the repaired spec, so different pairs can converge on one item.
- Tier 4 results are finished: they cannot be fused again.
- In a run, the first fusion at a bench costs raws by output tier (tier 1: 1 timber; tier 2: 1 timber, 1 ore; tier 3: 2, 1, 1; tier 4: 2, 2, 2). Each further fusion at the same bench costs one more set, so a bench is for one or two fusions, not eight. Raws that are missing are charged in scrip. A pair nobody has tried takes a second or two.
- In town, the workshop does the same from your stash.
- Each account gets 20 untried pairs a day (raised by the Assay Office). Known pairs are unlimited.
- If the model is unreachable, known recipes still work. An untried pair is refused and nothing is consumed.
- With no model configured at all (local development), a deterministic
  procedural generator stands in so the game is fully playable.
- Multiplicative stacking is held back in combat code with per-stat caps, since a point budget cannot do it.

Measured (Greenhorn, 200 seeds, `docs/critique/depth-after.md`): fusing when
the result is worth more to the build than both parents wins FUSEGAIN points
more than never fusing, and fusing every pair that can be paid for wins less
than fusing with judgement.

The conversions, which the model may pick like any other primitive:

| Primitive | Text |
|---|---|
| killHeal | Kills have a {v}% chance to heal 1 HP |
| armorDamage | +{v}% Damage per 2 Armor |
| hpDamage | +{v}% Damage per 10 Max HP |
| dodgeStrike | A dodge blasts nearby enemies for {v} |
| speedDamage | +{v}% Damage per 10% Speed |
| scripDamage | +{v}% Damage per 50 scrip held, counted up to 300 |
| harvestDamage | +{v}% Damage per 10 Harvest |
| luckCrit | +{v}% Crit per 20 Luck |
| workHaste | +{v}% Rate while working a node |
| pureSet | +{v}% Damage while every weapon held shares a class |
| fewWeapons | +{v}% Rate per empty weapon slot |

### 4.2 Why it should work

Curiosity with a permanent payoff: the codex shows silhouettes for pairs
adjacent to what you know; a find is yours by name; a good find is worth
money because others must either make it in a run or buy it.

## 5. Town (persistent, shared)

One page styled as a ledger. Four tabs.

- **Stash.** Unlimited. Raws, items, marks. Nothing to sort.
- **Workshop.** Fuse from the stash. Browse the codex: known recipes, who found them, silhouettes of near neighbours.
- **Market.** Items are posted at a price by players (2% listing fee, 5% sale tax, both destroyed). Raws trade against the Factor, an NPC who buys at about half and sells at about double a slow reference price that follows trade volume, with a daily volume limit. No auctions. No empty list: the Factor always quotes.
- **Town.** One project at a time, for example "Raise the sawmill to tier 2". Anyone donates raws; a share of market tax also counts. Targets scale with active players. Stations: Sawmill (+timber per tree), Smelter (+ore), Tannery (+hide), Assay Office (+untried pairs per day). Your standing with the town is a count of what you gave.

### 5.1 What you carry home

- Raws: mule loads, plus held raws (all on a win, 30% on a death).
- Items: you may carry floor(waves cleared / 4) items from your build, your choice.
- Marks: 1 per 10 scrip held at the end, plus a per-wave payout.

### 5.2 Kit

Pack up to 2 stash items for a run. A packed item has 3 charges; one is
spent per run started, then the item is gone. (A relic is the exception: see 5.6.) That wear is the main item
sink and the reason the market keeps moving. The daily clearing ignores
kits. Everyone can always run with no kit.

### 5.3 Characters

Unlocked by playing, win or lose, one per run for the first runs.

| Character | Twist |
|---|---|
| Greenhorn | No twist. |
| Sawyer | Each tool counts twice toward the Tool set. Every weapon that is not a tool costs half as much again. Starts with a hatchet. -4 Max HP. |
| Smith | Raises a held weapon one tier for a third less and without raws. +2 Armor, -10% Speed. |
| Trapper | Elites and brutes leave a carcass. Every node broken heals 2 HP. Carcasses appear twice as often. +6% Dodge, +2 Ranged, -2 Max HP. |
| Tinker | The first fusion at every bench costs no raws. 5 weapon slots. |
| Factor's clerk | Earns 8% interest on scrip at wave end, up to 6 per wave number. Rerolls cost half as much again. |

Each twist changes a rule, and each character's best strategy differs
(`docs/critique/depth-after.md`, target 5). Interest from items shares the
clerk's cap.

### 5.4 The daily clearing

Same seed, character and offers for everyone, 8 waves, one scored attempt
a day, unlimited practice. Score = waves cleared, then scrip earned. The
board shows your percentile and a copyable result line. Cumulative days
played are counted; there is no streak to lose.

### 5.5 First five runs

Each of the first five runs unlocks one thing, win or lose: workshop,
second character, market, daily clearing, town project. Before that those
tabs are not shown.

### 5.6 Relics

A tier above tier 4 that almost nobody has. The reference
is the one chest on a server that people stop to look at. There are eight,
authored, and each breaks one rule of the game. None is a bigger number.

| Relic | The rule it breaks | Share of finds | One in this many wins | Bot win rate with it |
|---|---|---|---|---|
| Order book | The bench makes a fifth offer | 20.0% | 7,500 | 43.0% (-1.3, inside the noise) |
| Oilskin wrap | The item packed beside it loses no charge on a win | 17.0% | 8,824 | 44.3% (a town rule: the fight is the same) |
| Hide blind | Nothing can hurt you while you work a node | 15.0% | 10,000 | 47.3% (+3.0) |
| Pack saddle | Carry home one more item | 13.0% | 11,538 | 44.3% (a town rule: the fight is the same) |
| Seed corn | A broken node grows back once in the same wave | 10.5% | 14,286 | 51.7% (+7.4) |
| Company draft | Weapons at the bench need no raws | 9.0% | 16,667 | 55.0% (+10.7) |
| Brandy flask | Once a run, a killing blow leaves you standing at half health | 8.0% | 18,750 | 57.7% (+13.4) |
| Saddle scabbard | Hold one more weapon | 7.5% | 20,000 | 54.3% (+10.0) |

Win rates are the balance bot as a Greenhorn over 300 seeds with the relic
alone in the kit, against 44.3% on the same seeds with no kit
(`npx tsx tools/exp/relics/winrate.ts 300`). One standard error on a
difference is about 3 points. The target was a gain a player feels and
never more than about 15 points, and the stronger a relic is the rarer it
is. Three drafts went over and were cut back: every bench recipe free of
raws (+19), the flask at full health (+18), and the flask at half health
with a longer grace (+15). Two things the bot plays badly, so its figures
undersell them: it buys by price, so a fifth offer gives it little, and it
does not plan a fight around shelter. The Order book is the one relic whose
gain the bot cannot show at all.

**Where they come from.** Only the server's roll in `run/end`, on a report
that has passed its checks, with the server's own dice (`server/relics.ts`;
numbers in `server/config.ts`). The run seed plays no part and the client
sends nothing that can ask for one.

- A full 12-wave win: 1 in 1,500. This is the main source.
- A death on wave 9 or later of a full run: 1 in 30,000.
- The day's scored daily, all 8 waves cleared: 1 in 15,000.
- Practice, repeat dailies, runs left from the pause menu, refused reports and
  tickets that were never reported do not roll.
- No pity timer. Luck does nothing. Nothing can be bought that changes the odds.
- One account can put 40 reports to the roll in any 24 hours, far above what
  a person plays; the rest pay out as usual. A ticket cannot be reported
  sooner than its waves take, so one account cannot roll faster than it can play.
- At these odds a world with 10,000 wins a day holds about 200 relics after
  30 days, 15 of them Saddle scabbards (`npx tsx tools/exp/relics/droprate.ts`).

**The book.** Every relic that exists is a row in `relics`: its kind, its
number within that kind in the order found, who found it, when. The item
reads "No. 3 in the world, found by Carter 412" and keeps that line when it
is sold. `GET /api/relics` gives the whole roll and a count per kind; a kind
nobody has found is sent with no name, and the workshop page rules a blank
line for it. Who holds a relic now is not sent. For 24 hours after a find,
every home page carries one line: "Carter 412 brought home the Saddle
scabbard. No. 2 in the world."

**Rules.**

- It does not wear: packing it spends no charge.
- One relic to a kit. It takes one of the two kit slots.
- It cannot be fused, in a run or in town, and nothing fuses into one. Relic
  effects are not in the fusion vocabulary, so neither the model nor the
  procedural generator nor the repair step can hand one out.
- It cannot be salvaged or scrapped. A relic never leaves the world.
- It can be posted on the market at any price. The 2% fee and 5% tax apply.
- On the homecoming sheet it is shown last, alone, after a beat, between
  Ochre double rules, with its own sound. It is not a box and it is not
  opened; it is either there or, nearly always, not.

**Look.** An Ochre double rule above and below the row, the tier tally
struck through (four notches and a stroke: five), and the serial stamped
beside the name. No glow, no colour ladder, no banner.

**Development.** `RELIC_FORCE=<relic id>` makes every paying report bring that
relic home. It is ignored when `NODE_ENV` is `production`.

## 6. Economy guard rails

- Every faucet and sink writes to a ledger table. A check sums it.
- Runs start with a server ticket. The end-of-run report is checked against
  bounds (raws per wave, items that exist, carry limits). Replay
  verification of the deterministic sim is the next step, not in the first build.
- Trades are single transactions with an idempotency key.
- A global switch turns trading off.
- Relics are rolled by the server alone, never by the client (5.6).
- New accounts can sell to the Factor at once but post listings only after 3 runs.

## 7. Look, sound and words

### 7.1 Blockprint Almanac

Seven colours, each with one job. No other colour appears anywhere.

| Name | Hex | Job |
|---|---|---|
| Ink | #1B2226 | Outlines, text |
| Bone | #D9D3BD | Paper: UI ground only |
| Moss | #7C8C5A | Clearing floor |
| Spruce | #2F4A3C | Treeline, shade |
| Ochre | #D99A2B | The player, raws, crafted goods, scrip |
| Madder | #B8402E | Enemies and danger only |
| Woad | #3E6C8A | Town, market, other players' names |

- Shapes: chunky silhouettes of 5-9 segments with cut corners. One outline
  weight (3 px at 1x). Shade is hatching or a flat second shape. Fills sit
  1-2 px off their outlines, seeded per sprite, like a print out of register.
- Type: Zilla Slab only (self-hosted, licence to be confirmed at install), tabular figures.
- UI: ledger rows and ink rules. No cards, no rounded rectangles, no shadows,
  no gradients, no blur, no glow, no emoji. Buttons are stamps that shift 2 px and invert when pressed.
- Feedback: white-less hit flash (the sprite turns solid ink for 2 frames),
  hit-stop only when you are hurt or an elite dies, angular chips for debris,
  trauma-based shake with a toggle. Damage numbers are aggregated per target.

### 7.2 Sound

Synthesised in WebAudio. Each node type has its own work sound (chop, clink,
scrape) because gathering audio was the most loved part of the source
pipeline. Pickup sounds rise in pitch in a streak. A mute button and a
volume slider are on screen from the first frame.

### 7.3 Words

Dry, practical, short. Sentence case. No exclamation marks in system text.
No em dashes. Tooltips say what a thing does with its number and nothing
else. Names are plain trade words (hatchet, tallow, whetstone), not
invented fantasy words. Enemy and place names are things a tired person
would call them.

## 8. Technology

- TypeScript, Vite, Vitest, Playwright.
- `src/sim`: pure deterministic simulation. Fixed 60 Hz tick, seeded RNG,
  spatial grid, pooled entities, no DOM. The bench and fusion logic live here too.
- `src/client`: Canvas2D renderer with sprites baked to offscreen canvases at
  boot, DPR capped at 2, interpolation between ticks, WebAudio, DOM for the
  bench and town. Canvas2D was chosen over PixiJS because the print style
  needs no blending or filters and the entity cap is 300; revisit if phones struggle.
- `server`: one Node process, Hono, SQLite. Anonymous device token.
  Endpoints for fusion, codex, stash, market, town, daily board.
- Claude on Bedrock for untried pairs, small fast model, structured output.
  The key stays on the server.

## 9. First build and later

First build (this branch): the full run, the bench, fusion with global
recipes and first-finder credit, stash, kit, Factor and listings, one town
project, the daily clearing, six characters.

Later: replay verification, seasons, order book for raws, contracts graded
by the model, more clearings, friends board.

## 10. Do not ship if

1. Any gradient, glow, blur, soft shadow, glass panel or purple.
2. Any emoji.
3. A colour outside the seven, or one used outside its job.
4. Rounded cards, nested boxes, three identical tiles in a row.
5. A second type family or a system font showing.
6. A title screen that is a centred logo, tagline and big button.
7. Em dashes, "delve", "tapestry", "testament", "it's not X, it's Y", triplet lists.
8. Invented fantasy names.
9. A tooltip that restates its label. Title Case. Exclamation marks.
10. A first-launch modal or an achievement for a first click.
11. An upgrade that is only a small percentage on one stat with no cost and no hook.
12. Any of arena, bench or town removable without the others noticing.
13. Wave 10 being wave 2 with bigger numbers.
14. More first-session time in menus than in play.
15. A hit with no flash, knockback or sound. No mute.
16. Resize, tab blur, pause or pixel-ratio change breaking layout, timing or input.
17. Dead buttons. Frame drops in a full wave. Progress lost on refresh.
