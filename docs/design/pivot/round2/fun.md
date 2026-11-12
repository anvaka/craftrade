# What is actually fun: New World and Brotato, second by second

Written 2026-11-12. Analysis only: no code or other docs were changed.

## Sources and how sure this is

- The two research notes (`../research-new-world.md`, `../research-comparables.md`),
  `../../synthesis.md` and the four `../../explore-*.md` files, read in full or by
  section.
- Web search this session (result summaries only). Every direct page fetch
  failed because the hosts were outside the network allowlist (pcgamer.com,
  substack, inkl). That means no Reddit thread was read first-hand. The player
  quotes below come from search excerpts and from the sources the earlier notes
  cite. **[S]** marks a claim backed by a search result; **[J]** marks my own
  judgement as a designer. Judgement carries most of the ranking, and the
  ranking should be read that way.
- Code read: `src/sim/outing.ts`, `src/sim/world.ts` (`startLull`,
  `updateNodes`, `LULL`), `src/client/outing/store.ts`, the event handling in
  `src/client/game/mount.ts` and `src/client/outing/mount.ts`, and
  `src/client/game/sound.ts`.

---

## 1. New World, second by second

### What a gathering trip feels like, as a timeline

| t | What happens | What the player feels |
|---|---|---|
| 0 s | Walk out of town; music thins to ambience | Calm. The trip has a purpose the player chose ("I need 40 starmetal for my bow") |
| 5 s | A grey-blue vein shows on the cliff and its icon slides onto the compass | Small hit of recognition: *I know what that is*. Then a choice: is it worth the 40 m detour? |
| 8 s | First pick strike. Clang, echo, a spark | The verb is pleasant on its own. "A hypnotic sound I've linked to the act of levelling up" [S, Twinfinite] |
| 11 s | 3-6 strikes, then the vein cracks. A column of toasts: `+4 Starmetal Ore`, `+31 Mining XP`, sometimes `+1 Fae Iron` in a rare colour | Five numbers move at once. The rare line is the jackpot glance: you *read* the toast column hoping for a coloured line |
| 12 s | The Mining bar is visibly 92% full | Anticipation. "Two more veins and I hit 100, then I can see orichalcum" |
| 40 s | Ding: Mining 100. Fanfare equal to a character level | A threshold, not a percentage: a class of object you have walked past for hours now switches on |
| 2 min | Wolves near the good node. Short fight | A toll for the specific reward. Being interrupted is what makes the node feel guarded and worth it |
| 20 min | Bag heavy; recall or walk home | The pleasure is in the *count*, and in the plan it enables |
| 25 min | Smelt, then stand at the forge. The screen shows `Gear Score 590-600`. Press craft | The single biggest reveal moment. Weeks of preparation compressed into one number and a perk roll. Also the biggest letdown when it rolls wrong [S, players on perk RNG] |
| 30 min | Equip it. The weapon you saw as ore on a cliff | Ownership: "no better feeling than wearing gear you've painstakingly assembled yourself" [S, PCGamesN via earlier note] |
| later | Trading post, town board, house trophies | Context: these give the rest a *why*, but they are not felt second by second |

### The listed moments, ranked by how much they carry the experience

Ranked by my judgement [J], informed by what reviewers single out [S]. "Carry"
means: if you removed it, how much of the fun would go?

| Rank | Moment | Carries | Needs 3D / scale / others / hours? | Notes |
|---|---|---|---|---|
| 1 | **The skill-level "ding" and the gate it opens** | Very high | **Hours.** The ding means something because the bar took an hour and the gate was visible all along | Reviewers: "you're always making progress" [S, PC Gamer]. With ~50 bars, one is always about to fill. The ding is the payout of *anticipation*, so the fun is the seconds of watching the bar, not the jingle |
| 2 | **Crafting the gear-score roll** | Very high | Hours (the inputs), not 3D or other players | Preparation made legible as a range, then a reveal. The single best idea to copy, and it can be shrunk |
| 3 | **Rare proc from a mundane node** (fae iron, a gem) | High | No. A roll and a coloured toast | Turns every routine strike into a lottery ticket. Cheapest of all to copy |
| 4 | **The hit sound and break** | High *per second*, low on its own | 3D helps (echo, falling trees) but a good 2D sound set gets most of it | Two reviewers wrote whole pieces on it [S]. It is what makes 20 minutes of repetition tolerable. It is a *multiplier* on the reward beats, not a reason to play |
| 5 | **Deciding which node to detour for** | Medium-high | Scale. It needs a big world with many nodes and a goal list in your head | The real moment-to-moment choice in gathering. It only works when the player holds a concrete need ("40 starmetal") |
| 6 | **Walk through a zone, nodes on the compass** | Medium | **3D, scale, art.** Vistas, the compass, the silhouette spotting | Pleasant for an adult on a PC with an hour. On a phone, top-down, in 3 minutes, it is "walking" |
| 7 | **The fight that interrupts gathering** | Medium | No | Valued as a *toll* on a good node, never for itself. New World PvE combat was widely criticised [S, PC Gamer "abysmal PvE"] |
| 8 | **Anticipation of a rare chest drop** | Medium | Hours and daily lockouts | Players report long dry streaks ("31 runs for one item") [S, Steam]. The fun is real, but it is the same reveal as rank 3, paid in a slower currency |
| 9 | **Trip home with a full bag** | Low-medium | Hours | The count is nice. Encumbrance itself was a top complaint |
| 10 | **Showing off a trophy / house** | Low second by second | Others and hours | Trophies matter as *buffs* (luck, gear score) more than as display. Decorating is a long tail for some players |
| 11 | **Being part of a town** | Low second by second | **Other players and scale** | Town boards and projects give purpose; the feeling of belonging needs a population |
| 12 | **Checking the trading post** | Low, often negative | **Other players and scale** | "Hours of gathering ... peanuts next to trading post prices" [S, Metacritic user]. The market deflated at launch |
| — | **Ambience and music** | A background mood, not a beat | 3D and production budget | It sets the calm that makes the work feel like rest. It does not carry a session, and on a phone in public it is often muted |

**Reading the table.** The top four are all **beats of reward with a reveal**:
a bar that fills and then pops, a range that collapses to one number, a rare
line in a toast column, a strike that cracks. The middle ranks (detour, walk,
fight) are the *setting* those beats happen in. They depend most on scale, 3D
and hours. The bottom ranks are social context that a solo phone game cannot
fake.

So the core of New World's gathering is not "walking in a calm place picking
things up". It is **many small reveals, each pushing a bar towards a visible
threshold, all feeding one big reveal (the craft) that makes you stronger**.
The calm world is the stage. In New World it is a beautiful stage, and a
beautiful stage hides how thin the moment-to-moment verb is. In 2D on a phone
the stage is gone, and only the verb is left. That is exactly what the owner
tested.

---

## 2. Brotato, second by second

### A run, as a timeline

| t | What happens | What the player feels |
|---|---|---|
| 0-20 s | Wave 1: you move, guns fire themselves, aliens pop, green materials fall | Easy, quick competence. Every kill pays something you can see on the floor |
| every ~5 s | Material pickup with a tick sound; XP bar fills; "LEVEL UP" text | A steady drizzle of rewards. You never go 5 s without a number going up |
| wave end | Materials vacuum to you; the count in the corner jumps | A small sum shown as one total |
| shop, 10-30 s | Level-up picks (choose 1 of 4 stats), then 4 shop items, reroll, lock | **The main decision.** "Two SMGs or the third shotgun?" A choice you will *feel* in the next 30 s. Early picks pay strongly at the end [S] |
| waves 3-8 | Synergies start: a second weapon of a class, a set bonus, an item that converts a stat | You notice a rule clicking: "every crit heals me" or "my engineering turrets are doing half the work" |
| waves 8-14 | **The power spike.** Tier III/IV weapons, the stat you stacked crosses a threshold | The screen changes. Enemies die before they reach you. You stop dodging and start *harvesting* the wave. This is the fantasy [S, explore-run H1] |
| waves 15-20 | Elites, wave 20 boss pair, the "hellfest" waves [S, Steam] | Near-death. HP bar in red, a gap closing in the horde, survive by a second |
| win or loss | Run summary, unlock a character or Danger level | A loss had a cause you can name ("I had no armour"); the next run is 30 min and starts fresh [S] |

### Why each beat works

- **The build choice at the shop.** The choice is between known pieces whose
  effect you can predict and then *see*. The shop is the decision; the wave is
  the test of the decision, 20-90 s later. The feedback loop between
  choosing and seeing is short. The choices also shut each other out [S], so a
  run has an identity.
- **Synergies snowballing.** In Brotato a piece *multiplies* what you already
  have: a weapon class bonus at 2/4/6, a stat that converts to another. The
  explore notes measured that Scrip's pieces mostly *add* (`explore-run.md`
  H2). A snowball is felt when the 10th piece is worth more than the 1st.
- **The power spike.** Enemy HP grows linearly and the build grows
  multiplicatively, so the middle of a run is "deleting screens". Scrip
  cancelled this with `WAVE_HP` (`explore-run.md` H1). This is the reward the
  whole run is aimed at.
- **The near-death.** It comes at the end, after the spike, and it tests a
  build you made. It is near-death with a story: "I survived *because of*
  the dodge I stacked", or "I died *because* I skipped armour".
- **One more run.** The run is short; a loss names a cause; the next run is a
  clean slate with a new random shop, so it promises a different build [S].
  Unlocks add a "turn the select screen gold" goal. And luck: "next time I'll
  definitely get the items" [S].

### What Brotato is *not*

It has no world, no calm, no crafting, no persistence of materials. Its
materials are spent within 60 seconds of picking them up. That is the point:
**the gap between picking something up and feeling it is one shop, never
more than a wave.**

---

## 3. The overlap: one psychological core

Testing each candidate motive against both games:

| Motive | New World | Brotato | Shared core? |
|---|---|---|---|
| **Power growth you can feel** | Gear you crafted makes fights and gathering faster; tool tiers are 100% to 625% speed | The power spike; deleting screens | **Yes, the centre** |
| **Anticipation then reveal** | Bar at 92%; the gear-score range; the toast column; the chest | Level-up picks; the shop reroll; the next tier showing | **Yes** |
| **Meaningful choice** | Which node, which recipe, which perk mod | Which item, which weapon class, reroll or keep | **Yes**, but in NW it is slow and in Brotato fast |
| **Ownership** | "Gear I made from ore I saw" | "A build I made" | **Yes**, both are *my* creation |
| **Mastery** | Routes, luck stacking, crafting prep | Dodging, reading synergies | Partly. Brotato's is reflexive, NW's is planning |
| **Collection** | Schematics, trophies, 50 bars | Character unlocks, Danger ladder | Secondary, a long-term wrapper in both |
| **Calm / rest** | Yes, a big part of the mood | No, none | **No.** Not shared |
| **Place and belonging** | Town, territory, house | None | **No.** Not shared |

**The shared core, in one sentence:**
> *Something I chose to pick up is revealed, it pushes me towards a threshold I
> can see, and when I cross it I am visibly stronger, because of what I chose.*

Four parts, each necessary:
1. **Choice** (I picked this node, this item).
2. **Reveal** (what did I get? did it roll well?).
3. **Visible threshold** (I know what happens at the next step).
4. **Felt power** (crossing the threshold changes what my next 30 seconds look
   like).

Calm and place are the two things the owner loves about New World that
Brotato does *not* have, and they are exactly what the two prototypes tried to
deliver. That is why they failed: they delivered New World's *mood* without
its *core*, and removed Brotato's core to make room for it.

### The owner's list against the core

| Owner's item | Serves the core? | How |
|---|---|---|
| **Nodes of different level** | **Core** | A visible threshold; a gated reveal |
| **Progression of your own character** | **Core** | Felt power |
| **Chests dropping loot** | **Core** | Pure reveal; can carry a power pick |
| **Schematics** | **Core** if they unlock a new thing to build *now*; trapping if just a list entry | Reveal plus a new choice |
| **Skill trades** | **Core** if each level does something felt; trapping if 6% faster | Visible threshold |
| **Different resource levels** | Core, as the material behind the gear-score roll | Feeds the reveal |
| **Town with work stations** | Mostly **trapping** at prototype scale; it is where the craft reveal happens | The place of the reveal, not the reveal |
| **Different zones** | **Trapping** at first. A zone is a container for a different node tier and enemy set | A later goal ("unlock the next zone"), not a moment |
| **Plants, trees** | **Trapping** | Variety of the same verb. More node types do not add a new feeling |
| **House you fill in** | **Trapping** second by second; long-term collection | Works as a trophy rack (buffs), as in NW |

The owner listed the *nouns* of New World. The fun is in the *verbs* between
them: reveal, cross a threshold, get stronger. Building more nouns (zones,
plants, a house) before the verbs work will feel like the same failure again.

---

## 4. The two prototypes against the core

### Prototype 1: the calm outing (`src/sim/outing.ts`)

What the player actually did, from the code:

- Walk a 4200 x 3000 zone (`OUTING.w/h`). Stand inside a node's ring
  (`NODE_RING` 78 px). Work accrues at `workRate` (x2 with the right tool);
  a node needs `NODE_WORK` 3 s base. A `'work'` event fires every
  `WORK_TICK` 0.5 s (a chip and a chop sound).
- On break: 3 materials (tier 1) or 4 (tier 2) fly out (`OUTING.yield`),
  plus 10 or 28 XP. A toast `+10 Logging` shows. Levels take
  `30 + 15 x level` XP, so level 2 is 3 nodes, level 5 is ~16 nodes.
- At skill 5 the tier 2 node opens (`OUTING.tier2Level`). That is the only
  thing a level does.
- A threat meter rises over 480 s plus noise. Packs come at stages.
- Leave at a camp to keep 100%, recall 60%, die 30% (`OUTING.keep`).
- The haul goes to a store that, per its own comment, **"nothing in the town
  reads"** (`src/client/outing/store.ts`).

Against the core:

| Part | Present? | Why |
|---|---|---|
| Choice | Barely | Which node is nearest. Every node of a kind is the same; there is no need that makes one node matter more |
| Reveal | **No** | Yield is fixed (3 or 4). No rare roll, no chest, no variance at all. The toast always says the same thing |
| Visible threshold | Weak | One threshold (skill 5), shown as a greyed node. The good part of the design, but there is one of it |
| Felt power | **No** | Nothing changes the player's power during or after the outing. Skill 5 opens a node that also gives nothing usable. The combat build is the starting kit for the whole outing |

The verb itself: stand still for 3 s while a ring fills, in a calm with
nothing in it. The New World verb survives on sound, 3D physics and the stage
around it. Here the stage is a flat field. "All of it" was boring because
there was no reason under any of it: **the materials led nowhere**. Every
part of the core was missing, not just one. The plan's own post-mortem says
the same: "no decision, no skill and no risk ... nothing grows ... no
surprises" (`../plan.md`).

### Prototype 2: the 30-second lull (`startLull` in `src/sim/world.ts`)

What the player actually did:

- A wave ends. Every enemy is removed and the card says "Cleared, 30 seconds
  to gather" (`LULL_SECONDS` 30).
- 9 nodes stand (`LULL.nodes`), 35% rich (`richChance`). Rich nodes and the
  chest are placed at least 620 px away (`farFrom`) and guarded by 2-3 boars
  (`postGuards`) that wait until you come within 230 px.
- Plain node: 3 s of work, 3 raws. Rich node: 6 s, 8 raws, 28 XP. Chest
  (half the waves from wave 2): 2.5 s, some scrip, 2 raws of each kind, **+1
  upgrade pick at the bench** (`openChest`).
- A skill level gives "You work that kind of node 6% faster" (`updateNodes`,
  the client notice in `mount.ts`).
- Raws go into `p.raws`, which pay for bench recipes.
- Edge-of-screen pips point to off-screen nodes (`mount.ts`).

Against the core:

| Part | Present? | Why |
|---|---|---|
| Choice | **Yes, a little** | Rich-and-guarded versus plain-and-free, chest or nodes, in 30 s. This was the right instinct |
| Reveal | **Almost no** | The chest is a known quantity (it always says the same). Nodes are fixed yield. No rare roll |
| Visible threshold | **No** | Skill levels give 6% speed, which nobody can feel in a 30 s window. No gated node exists in the lull (`n.tier = 1` always) |
| Felt power | **Indirect and late** | Raws and the chest pick are spent at the bench, one screen later, mixed with everything else bought there. The player cannot trace "that rich node" to "this weapon". The power is real but anonymous |

The deeper problem: **the lull stops the Brotato core to start a weaker one.**
For 30 s the build cannot be used (no enemies but the guards), so the player's
only verb is "walk to a dot, stand 3-6 s". Then the bench. Gathering is a
pause *between* the parts that are fun, with a reward folded into a pile.
"Going in circles" is accurate: it was prototype 1's verb again, moved into
the run, with the run's power held off during it.

### What neither prototype had, and both games have

1. **Variance in what a node gives.** Neither had a single rare roll. This is
   the cheapest reveal there is, and both games are built on reveals.
2. **A path from what you picked up to a power change you can name.** In
   Brotato it is one shop; in New World it is the craft. In prototype 1 it
   was nowhere; in prototype 2 it was blended into the bench.
3. **Thresholds that change the next minute.** A 6% speed level, or a second
   node tier that gives more of the same, is not a threshold.

---

## 5. What a prototype would need: three small experiences

Each is meant to be built in a day on top of the **existing run** (the fight
is the part that already holds the owner), and judged in 10 minutes on a
phone. Each targets one part of the core, so if one works and another does
not, we learn which part matters. None of them adds a calm phase.

### Experience A: "Strike gold" (reveal inside the fight)

**Question:** does a lottery ticket on every node make nodes worth detouring
for *during a wave*?

- Nodes stay where they are in the run (`placeNodes`). Remove the noise
  penalty for this test (`NOISE_FROM_WAVE` high), so working is not punished.
- Each node break rolls: **70% common** (raws, as now), **25% good** (double
  raws, gold-flecked), **5% vein** (a jackpot).
- Before the break, at 80% work, the node shows a **glint** if it will be
  good or a vein: the player sees "this one might be special" and decides
  whether to stay one more second under pressure. (The roll is made at
  spawn; the glint is honest.)
- **Feel, common break:** the usual 3 chips and chop sound. `+3` in white,
  14 px, floats 30 px over 0.6 s.
- **Feel, good break:** pitch of the final strike up a fourth; `+6` in ochre,
  20 px; a short coin-shower sound.
- **Feel, vein:** 120 ms hitstop (the sim keeps running, the renderer
  freezes), a white ring out to 160 px, screen shake 5 px for 0.2 s, a rising
  three-note chime. A card slides up: **pick 1 of 3 run-only rule-breakers**
  right now (the relic effects that already exist: `regrow`, `safeWork`,
  `extraSlot`, kill blast and so on). The wave resumes with it equipped.
- **What to watch:** does the owner start steering towards glinting nodes?
  Do they say "ooh" at a vein? Count detours to nodes per wave, before and
  after.
- **Build:** a roll in `breakNode`, a flag on `ResNode`, a glint in the
  renderer, a pick card reusing bench UI. One day.

### Experience B: "The forge roll" (the craft reveal, Brotato-fast)

**Question:** does the New World craft moment work if the gap from pick-up to
power is one bench and the outcome is shown as a range?

- At each bench, one extra slot: **Forge**. It offers one weapon the player
  already holds, to reforge to a better version.
- It shows a **range**: `Damage 14 - 22`. Every input visibly moves the range,
  and the player watches it move as they tap: each ore raw added `+1 min`; each
  "good" or vein material from Experience A `+3 min, +2 max`. A cap of 5 inputs
  keeps it quick. Text under the range: "from the vein you struck in wave 4".
- Tap **Strike**. A needle sweeps the range for 1.2 s with a tick every 60 ms
  that slows down (like a prize wheel), and lands with a hammer clank. If it
  lands in the top 15%: a gold border, "Masterwork", a second chime.
- The weapon's sprite gets a visible tier mark and its damage number is
  shown on the bench card. **The next wave starts with it**, and its hits
  show in a slightly bigger damage number for the first 10 s, so the change
  is felt.
- **What to watch:** does the owner put materials in one at a time to see the
  range move? Do they remember the vein that made the weapon? Does a high
  roll get a reaction, and a low one a "one more"?
- **Build:** one bench row, a range formula on existing weapon damage, a
  sweep animation. One day. Works without A (with plain raws only), better
  with it.

### Experience C: "The gate in sight" (a visible threshold that opens mid-run)

**Question:** does a bar you can watch, aimed at a thing you can see, pull the
player through a wave?

- From wave 1 a **sealed node** stands in the arena: a large ore seam with a
  chain sprite and `Mining 4` written on it in ochre. It cannot be worked.
- A **Mining bar** sits at the top of the HUD (only one skill, to keep it
  legible). Each ore node worked gives XP with a rising tick per strike;
  `+12` floats over the node; the bar fills in visible steps. Levels come
  every 2-3 nodes at first so that **level 4 arrives around wave 3-4 of a
  first run**.
- At level 4: the ding (the existing `levelUp` sound plus a low gong), the
  chain on the sealed seam shatters on screen, wherever the player is, and an
  edge pip points to it. Working it takes 4 s under fire and it **always
  pays a vein** (Experience A's pick) plus a guaranteed rare forge material.
- Every level also does one thing the player can feel in the fight. Not 6%
  speed: for example, Mining 2 makes ore breaks throw shards (`nodeBurst`,
  which exists), Mining 3 makes them heal 2 HP (`nodeHeal`, which exists).
  Each is announced in one line at the ding.
- Skill XP is kept between runs (as `bankSkills` already does), so in run 2
  the next sealed seam, `Mining 8`, is already in view.
- **What to watch:** does the owner look at the bar? Do they work ore nodes
  in a wave they would otherwise skip? Do they mention the next gate after
  the run ends, unprompted?
- **Build:** a sealed node type, one HUD bar, per-level effects drawn from
  existing specials. One day.

### How to run the test

- Build A first, alone, and give the owner 10 minutes. It is the cheapest
  and tests the most basic part (reveal). If veins do not get a reaction,
  nothing built on materials will.
- Then B on top of A, then C. Each session: three runs or 10 minutes, then
  ask one question: **"Which moment do you remember?"** The answer says which
  part of the core landed. Avoid "was it fun?"; the owner already told us
  twice that the answer to vague questions is "all of it".
- Pass mark for each: the owner names a specific moment from that experience
  without being asked about it, and chooses to start another run.

### What to hold back until these pass

Zones, plants, a house, a town with stations, the trading post, schematics as
a book. They are containers for the core. If A to C work, each of them has
an obvious job: a zone is a new set of gates (C), schematics are new things
to forge (B), a house holds trophies that raise the vein chance (A). If A to
C do not work, building the containers will repeat the last two rounds.

---

## Sources (search results, 2026-11-12)

- Twinfinite, "New World's impressive sound design makes me want to mine rocks forever": https://twinfinite.net/2021/10/new-worlds-impressive-sound-design-makes-me-want-to-mine-rocks-forever/
- PC Gamer, "I'm completely hooked on New World's fishing and crafting": https://pcgamer.com/im-completely-hooked-on-new-worlds-fishing-and-crafting
- PC Gamer review: https://www.pcgamer.com/new-world-review/
- Mein-MMO, 15 years of MMOs without sound: https://mein-mmo.de/en/for-15-years-i-have-been-playing-mmorpgs-without-sound-but-that-changed-with-new-world,734284
- Metacritic user reviews: https://legacy.prod.metacritic.com/game/pc/new-world/user-reviews
- COGConnected review: https://cogconnected.com/review/new-world-review/
- Steam discussion on chest drop streaks: https://steamcommunity.com/app/1063730/discussions/0/3884976499358804702/
- Penny Arcade forum on elite chests: https://forums.penny-arcade.com/discussion/comment/45164355
- Gamerant, tracking resources: https://gamerant.com/new-world-how-track-resources/
- Studioloot crafting guide: https://studioloot.com/new-world/articles/new-world-crafting-guide
- Brotato reviews: https://nichegamer.com/reviews/brotato-review , https://mein-mmo.de/en/a-game-on-steam-made-me-play-as-a-potato-for-100-hours-and-i-regret-nothing-currently-costs-less-than-4-euros,1104525/ , https://phenixxgaming.com/2023/07/04/brotato-pc-review
- Brotato Steam discussions on wave 20: https://steamcommunity.com/app/1942280/discussions/0/5822622429935742029 , https://steamcommunity.com/app/1942280/discussions/0/3389546207224188789
