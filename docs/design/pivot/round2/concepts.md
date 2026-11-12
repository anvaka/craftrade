# Round 2: eight game structures, before anyone commits

Proposal only; nothing built. Written after reading `../plan.md`,
`../crafting.md`, `../../synthesis.md` and `../research-comparables.md`.

## What the two failures say

Both prototypes put gathering *next to* the fight: a calm ring you stand in,
or a 30-second lull after a wave. Both were called boring. Read together:

1. **Gathering without a decision is dead time, calm or not.** Standing in a
   ring and picking which of six nodes to walk to in a lull are both "walk,
   wait". The owner's pull is pressure ("too much, but engaging").
2. **"Going in circles" is a missing destination.** Nothing told him what he
   was collecting *for*, so every node was the same node.
3. **Something has to grow every minute.** Brotato grows the build every
   wave; New World grows a bar every swing. A lull grows neither.

So every concept below has to pass three filters: gathering is a decision
taken under pressure (or is taken out of the player's hands altogether);
the player always knows what he wants next; and a number visibly moves at
least once a minute. None of them is "run, then gather".

Common test protocol for every kill-test below: the owner plays it on his
phone, three sittings over two days, without being asked between sittings.
Opening it a second day unprompted is the strongest pass signal we have.
Anything he calls "boring" or "same as before" is a stop, whatever the
numbers say.

---

## 1. Living Harvest: the nodes walk and fight back

**Hook.** There are no trees to stand at: bark-stags shed timber, ore crabs
crack into ore, briar swarms drop fibre, and your hatchet, pick and knife
are your weapons.

**Core verb: steer.** The arena is a pasture, not a spawn ring. Herds of
resource creatures graze in clumps and only charge when hit or approached.
Every 5-10 s the player chooses which herd to drag into his auto-attacks:
the ore crabs are slow and armoured (pick does x2), the bark-stags fast and
fragile (hatchet x2), and touching a second herd while fighting the first
is how you die. A glowing elite carrying a rare sibling (resin, a gem, a
perfect hide) appears for 20 s and then burrows; chase it or not. Some
creatures wear a level badge ("Mining 20"): your hits do nothing until you
have it, and you see them every run.

**Session.** Pick a zone (its herd roster is its tier), 6 waves of about
60 s, 6-8 minutes. Level-ups stay. Everything killed lands in the bag; death
ends the run but keeps the bag, so the run never punishes what it pays.

**Across sessions.** Four gathering bars that tick per kill of their family
("Mining 9 -> 10: crabs drop silver"); a town shopping list ("forge tier 2:
40 ore, 12 hide") that tells you which zone and which herd today; tool
weapons crafted from what you killed, which in turn kill that family faster.

**New World feeling.** The swing-tick of the skill bar, the visible locked
node with a level on it, tool tiers that change speed, the rare-sibling
pop, gear made from where you went.

**What the AI does.** It composes rare variants from the kit: a creature
base, one move from the existing telegraph list, two properties from the
material list ("saltglass crab: brittle, bright, splits in two when hit
hard"). Its drop is an invented material whose crafts nobody has tried.
A table gives you "crab, but blue"; the model gives you a named animal whose
body is a new crafting question.

**Reuse: about 80%.** `sim/enemies.ts`, `sim/weapons.ts` (hatchet, pick and
knife already carry the `tool` class and the `harvest` stat), waves, telegraphs,
level-ups, the node-work bars from `sim/outing.ts`, art and sound. New: an
aggro-on-contact herd AI, per-family drop tables, the tool-vs-family bonus,
the shopping list.

**Biggest risk.** It is Brotato with the coins renamed. If herds charge
anyway, steering is not a choice and the material is just a colour.

**Kill test (1.5 days).** In the current run: tag each existing enemy with a
material (boar and badger: hide; bear: timber via "rotwood bark"; mites and
gnats: fibre; a re-tinted spitter: ore), spawn 40% of each wave as idle
herds at the arena edges that only aggro when touched, give hatchet/pick/
knife x2 against their family, show four bars in the HUD with a level-up
toast, and put one shopping list on the run's start screen. Log seconds spent
within 150 px of each herd family. **Stop if** the logged share for the
listed material does not rise above its spawn share in at least 2 of 3
runs (he is not steering), or he says it plays like the old run.

---

## 2. Deep Shaft: extraction where your crafted gear is the stake

**Hook.** Go down a shaft of arena rooms wearing gear you forged; every floor
pays more, the way up gets harder, and if you die below you lose the bag and
the gear you brought.

**Core verb: push your luck.** Each floor is one 45-75 s room: the fight,
with a chest and two or three nodes standing inside it. Every 5-10 s: grab
the chest that sits in the bear's lane, or not; pick the dropped gem now that
your 8-slot bag is full, which means dropping silver. At each floor's end, one
card: **Down** (tier +1, loot x1.4) or **Rope** (the next room is a hold at
the rope: 20 s plus 8 s per floor below 1, then you are out with everything).
Die and keep one insured slot; the rest stays on the floor.

**Session.** A dive of 4-12 minutes that ends itself. Phones love a hard
end.

**Across sessions.** Deepest floor; replacing and improving lost kit; deep
schematics (floors 7+ only); the tier band you can "afford to lose".

**New World feeling.** Tiered materials by depth (floors 1-3 iron and green
wood, 4-6 silver and aged wood...), and town stations matter more than in any
other concept because you must rebuild. Gear loss is the steady sink New
World never had: crafting demand never runs out, so the economy works by
design.

**What the AI does.** Composes floors from the chart kit (twists such as
"flooded: ore scarce, boars slow"), priced by code. In a shared world, a
dead player's kit stays on that floor's weekly seed for others to find:
"Ana's pack, holding Glass Tooth, first made by Ana". The AI-invented item
is then the content other players dive for, with a history a table cannot
write.

**Reuse: about 65%.** The arena as rooms, waves as room contents, the lull
commit's chests and guarded nodes, town and crafting. New: floor sequence,
Down/Rope card in place of the bench, carried-gear loss, bag slots.

**Biggest risk.** Loss aversion. Losing a crafted item he loves can end the
game for him rather than raise the stakes.

**Kill test (1.5 days).** In the current run: before start, pick 2 owned
items to bring (deleted on death); replace each bench with the Down/Rope
card; Rope makes the next wave a 20 s+ hold, then a win screen; an 8-slot
bag for chest loot shown in the HUD; loot multiplier per depth on screen.
**Stop if** he takes Rope at floor 2-3 in all three sittings (no greed),
or after his first loss of brought gear he does not start another dive
that sitting, or he describes the Down/Rope card as obvious.

---

## 3. The Counter: a forge where customers are the waves

**Hook.** You are the town's smith: a queue of adventurers walks up with
problems the model wrote ("the fen boars keep breaking my haft"), and you
make, price and sell the answer before their patience runs out.

**Core verb: fit an order.** Customers arrive every 10-15 s with a patience
bar. Every 5-10 s: who to serve first, which material in which slot, and
the price slider while their face reacts. Rush hour is the Brotato pressure
in shop form (Papa's Pizzeria, Potion Craft). Customers return and report:
"your Glass Tooth broke on the third tree, refund?". Materials come from a
supplier stall (the Factor) and from short dives (the run) for rares only.

**Session.** A shop day of 3 minutes; three days a sitting.

**Across sessions.** Shop reputation opens the next street of customers
(the zone equivalent: richer, harder needs); station tiers; regulars with
names; the codex of items you named.

**New World feeling.** The craft screen with an outcome range, schematics,
stations and trade-skill levels. Weak on zones and nodes. This is the bet
that "crafting is the best part of New World" is true for him too.

**What the AI does.** Writes the need from a closed kit (zone, creature,
problem tag), grades each item against it on the four-step fit scale from
`plan.md` (code pays), invents untried combinations. Grading an arbitrary
invented item against an arbitrary need is exactly the thing a table cannot
do.

**Reuse: about 40%.** `shared/vocab.ts`, `shared/item.ts`, the fusion
provider and procedural fallback, market, Factor, ledger. The action sim is
used only for rare dives.

**Biggest risk.** The owner's pull is action, and model latency (2-5 s)
fights a timed counter, so needs must be pre-generated.

**Kill test (1 day).** One screen: 3 patterns, 8 materials with properties,
customers every 12 s with 30 s patience, needs from 20 procedural templates
(no model), fit scored by tag overlap, a price slider with a mood face.
**Stop if** after 15 minutes he says the right answer is obvious, or he does
not play a second day.

---

## 4. Foreman: idle crews, and you are the guard

**Hook.** You run a gathering crew in the woods; they log and mine while you
are away, and when you are there you are the fighter who keeps the woods off
them.

**Core verb: assign and protect.** Live shift: the arena with 3-6 workers
on nodes; waves target workers, not you. Every 5-10 s: which flank to cover,
drag a worker back from the rich node by the spawn edge, send two to the
guarded silver seam now that the bear is down. Offline: crews gather at a
slow rate (capped at 8 h), but tiered and rare nodes are only worked while
you are on shift, at 5x rate.

**Session.** Open, collect (10 s), reassign, optional 4-minute shift.
Melvor/Idleon shape.

**Across sessions.** Crew size; each worker's skill bars (they are the
skills); camp buildings; the next zone's crew contract. Wounded workers sit
out a day.

**New World feeling.** Tiered nodes, skill bars, a settlement that grows;
the camp is the house.

**What the AI does.** Workers get one trait from a closed list; the model
writes their history from real events ("Bera lost an eye to Old Tusk, works
ore only now"). This is the weakest AI role of the eight; it is flavour on
facts, which research says feels hollow unless the player caused it.

**Reuse: about 55%.** Sim, enemies (retarget to the nearest worker), nodes
from `sim/outing.ts`, town. New: worker AI, drag-to-assign, offline accrual.

**Biggest risk.** Escort-mission feel, two control schemes on one phone
screen, and the research warning that automating gathering ends the game.

**Kill test (2 days).** Current arena, 3 workers walking to nodes and
chopping, 50% of enemies targeting workers, drag a worker onto a node, one
4-wave shift. **Stop if** he calls guarding them frustrating, or asks to
gather himself.

---

## 5. Hunt Board: the gear you want is written on the beast

**Hook.** Each hunt is one named beast with breakable parts: break the
antlers for the bow, take the tail for the coat, and the board always says
which beast you need next.

**Core verb: read the telegraph, choose the part.** Each part has its own
HP and powers one move: break the tusks and the gore charge is gone. Every
5-10 s: which part to work (tap to mark it; auto-attacks prefer it), dodge
the telegraph, bait it into a tree so its charge fells the tree for timber,
or lure the slam onto an ore outcrop. Small adds keep Brotato's mob pace,
dialled down.

**Session.** A hunt of 3-5 minutes, two or three a sitting.

**Across sessions.** Armour and weapon sets per beast with a set bonus;
"Stag coat: antler 1/2, hide 3/3" always on screen; part-break rares (2%
heart gem); the next beast up the board.

**New World feeling.** Gear made from where you went; habitats as zones;
schematics from beasts. Answers "always know what you are gathering for"
more sharply than anything else here. Weaker on node fields.

**What the AI does.** Composes the weekly beast from a kit: body plan, 2-3
moves from the move list (stag, rotwood and tusk behaviours already exist),
parts with properties. Its parts are invented materials, so the beast is
also a new set of crafting questions. A table runs out of beasts; the model
keeps a bestiary with names and first slayers.

**Reuse: about 55%.** Boss AIs, telegraphs, weapons, adds. New: multi-part
hitboxes, per-part drops, mark-a-part targeting, set recipes.

**Biggest risk.** Auto-attack plus a phone makes part targeting fiddly; the
third hunt of the same beast can read as grind.

**Kill test (1.5 days).** Old Tusk with 3 parts (left tusk, right tusk,
hide), each with HP and a drop; breaking a tusk removes the gore move;
tap-to-mark; a craft screen with two items asking for specific parts.
**Stop if** after two hunts he does not mark parts (he does not care), or
calls the third Tusk hunt a grind.

---

## 6. Forge Your Run: the build is what you made in town

**Hook.** No shop in the arena: you walk in with the six weapons and four
trinkets you forged, and the arena pays you in the materials for the next
forge.

**Core verb.** In town, forge a loadout: patterns plus materials, where
properties decide behaviour (heavy: knockback, bright: crit bursts). In the
run, every 5-10 s is Brotato's movement; each level-up is a **temper**
choice that tilts one of your crafted items (+one effect from its materials'
list), so the per-wave decision survives.

**Session.** 2 minutes at the forge, an 8-minute run.

**Across sessions.** Material tiers; schematics; zone arenas by tier; a codex
of rule-breaking weapons you named. Novel combinations give weapon *rules*
(every fifth hit chains) inside the budget, which is the "builds are numbers,
not rules" fix the synthesis asked for.

**New World feeling.** Wearing what you made is the whole point; station
tier caps the build. No node fields: materials come from kills and chests.

**What the AI does.** Spends a tier's budget on rule-like effects that follow
from properties; the first finder names it. Every forge visit can be an
experiment.

**Reuse: about 85%.** The closest to today. New: forge screen, temper
picks, bench removed.

**Biggest risk.** The run itself is what he tired of after a few hours, and
this moves choice into menus. It may fix the hour-2 cliff and not the fun.

**Kill test (1 day).** A pre-run forge: pick 6 weapons from the existing
12, each filled with one of 10 materials that adds one effect; bench
replaced by temper picks; five runs. **Stop if** he forges the same loadout
three times running, or uses "same as last time" from run 3.

---

## 7. Claim the Map: paint the country hex by hex

**Hook.** The country is a fogged hex map; each hex is a 40-second fight that
claims it, and claimed land works for your town while the wild pushes back.

**Core verb: pick the next hex, then win it.** On the map, every 5-10 s:
read the revealed neighbours (ore hill, landmark, chest ruin, a tier-2 edge
with "Mining 20"), choose. In the hex: two short waves with that hex's mob
mix and its node standing in the middle of the fight. Claimed hexes yield a
daily trickle into town. Blight spreads back from wild hexes onto your border
(Loop Hero, Kingdom), so you defend as well as expand.

**Session.** 3-6 hexes, 5-8 minutes.

**Across sessions.** The painted map; the frontier creeping toward the old
forest; landmarks and their bosses; town projects fed by your land.

**New World feeling.** Territory (New World had it), zones as rings of tier,
a place you learn and that stays put, which fixes what reshuffling took away.

**What the AI does.** Composes each region as fog lifts: landmark name, its
twist, its boss, two lines of history; the weekly event travels along your
border. In a shared world everyone paints one map and first claimants are
named on landmarks.

**Reuse: about 65%.** Arena fights, wave mixes, nodes as yields, town
projects. New: hex map, claim state, yields, blight.

**Biggest risk.** Fights become a toll between map choices, and passive
yields take gathering out of his hands.

**Kill test (1.5 days).** A 7x7 hex map with fog, 4 hex kinds, tap a hex to
start a 2-wave fight of the current run with its mix, claiming adds to a town
counter, blight takes one border hex every 3 claims. **Stop if** after 10
hexes he cannot say why he picked the last one, or calls the fights filler.

---

## 8. Caravan: carry other people's inventions to towns that want them

**Hook.** You drive a wagon between five towns whose needs the model writes
each week; buy cheap, hold the road, and sell inventions the next town has
never seen.

**Core verb: route and defend.** On the road (an arena run), enemies go for
the wagon, and the magpie thief AI already steals. Every 5-10 s: chase the
magpie running off with a silver crate, or hold the bear off the axle. In a
town: buy and sell against the Factor's saturating prices, craft cheap local
raws into goods for the next stop.

**Session.** One leg: 2-minute town, 4-minute road.

**Across sessions.** Wagon size and parts, standing per town, route
knowledge, rare goods.

**New World feeling.** Trading posts and regions; the economy is the game.
Gathering is a roadside extra at most.

**What the AI does.** Each player's discoveries sell only in their home
town, so carrying them elsewhere is the async-social market: the AI-invented
item is the cargo other players travel for. Town needs come from the weekly
levers.

**Reuse: about 55%.** Market, Factor, ledger, magpie and enemies, the arena
as road. New: town map, cargo, wagon HP.

**Biggest risk.** Arbitrage is solved by a spreadsheet in an evening;
escort is a disliked format; exploits in a shared world.

**Kill test (1.5 days).** 3 towns, 6 goods, fixed price tables with
saturation, road = 3-wave run where 40% of enemies target a wagon with 10
crates. **Stop if** after 6 trips he repeats one loop, or calls escort
annoying.

---

## Ranking for this owner and this codebase

Weights: keeps the pressure he likes, gives a destination, moves a number
every minute, reuses the sim, cheap to kill.

| Rank | Concept | Why here |
|---|---|---|
| 1 | Living Harvest | Gathering becomes the fight itself; 80% reuse; the shopping list is the destination |
| 2 | Deep Shaft | Real stakes and a greed decision every floor; makes crafting endlessly needed |
| 3 | Hunt Board | Sharpest "I know what I want"; boss AIs exist; targeting on a phone is the doubt |
| 4 | Forge Your Run | Cheapest; fixes the hour-2 cliff, likely not the boredom |
| 5 | Claim the Map | Best sense of place; fights risk being a toll |
| 6 | Caravan | Strongest AI-economy story; escort and solvable routes |
| 7 | Foreman | Fits phones; escort feel and automation risk |
| 8 | The Counter | Most "AI-native", furthest from the action he likes |

## Prototype first: Living Harvest and Deep Shaft

- **They test the two different explanations of the failures.** Living
  Harvest asks: is gathering fun once it *is* the combat? Deep Shaft asks:
  was the missing piece stakes and a greed decision? If both fail, the
  problem is the run itself, and Hunt Board or the Counter become the next
  bets rather than more tuning.
- **Both keep the pressure he called engaging** and neither has a calm phase,
  which both failed prototypes had.
- **Both are 1.5 days on the current run code** and neither throws away the
  town, the crafting budget or the market.
- **They combine if both pass:** shaft floors full of herds, where the deeper
  herd carries the higher tier, and your crafted tool-weapons are what you
  risk bringing down.

Build them as two separate "Try it" entries, play-test in the same two days,
and decide on the protocol above, not on sim numbers.
