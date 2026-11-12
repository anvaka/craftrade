# Round 2 critique: why both prototypes bored the owner, and why we are circling

Diagnosis only. No new feature is proposed here.

## 0. The short version

1. **Both prototypes share one verb: stand still in a ring.** In an auto-attacker the player's only
   input is movement, so "stand still for 3-10 s" means *no input at all*. Neither prototype changed that
   verb. They only changed the box around it.
2. **We had already diagnosed that verb as the worst part of the game, then built a game out of it.**
   `explore-run.md` H5 says working a node "asks the player to stop being powerful": it is the novice's
   top killer (75 of 200 deaths), and "the moment itself feels like waiting". Two hours later
   prototype 1 made it the whole game.
3. **The diagnosis was dropped for a wish list.** `synthesis.md` (05:49) ranked "let runs get broken"
   and "make power visible" first, and rated them cheap. Neither was built. Forty minutes later the
   owner's message 2 (a list of New World nouns) became the spec for a five-zone, eight-skill pivot
   (`plan.md`, committed by 06:57).
4. **Prototype 2 contradicted the lesson of prototype 1.** `plan.md` "What step 1 taught" says "calm
   with nothing in it is empty" and "the pull of the old game was pressure". The answer it then gave was
   to put 330 s of calm into the run.
5. **The missing link to the town explains some of prototype 1's boredom, but less than it looks.**
   Prototype 2 did link its materials to something (the bench), but the bench was already full, so the
   link paid nothing.

## 1. Why both are boring, moment to moment

### What the player actually does

**Prototype 1, the home wood** (`src/sim/outing.ts`, `src/client/outing/mount.ts`):

| Second-to-second | Numbers from the code |
|---|---|
| Drag toward a node; weapons fire on their own | zone 4200 x 3000 (`OUTING.w/h`); 24 groves plus 26 loose nodes |
| Stand inside a 78-unit ring and take your thumb off | `NODE_RING = 78`; tier 1 needs **6 s**, tier 2 **10 s** (`OUTING_WORK = [0, 6, 10]`, `core.ts:259`) |
| Watch 3-4 pickups fly into the bag | `OUTING.yield = [0, 3, 4]` |
| Hear a tick every 0.5 s | `WORK_TICK = 0.5` |
| Repeat | Tier 2 is locked until level 5: 45+60+75+90 = 270 xp, or 27 tier-1 nodes, about 160 s of standing *per skill* before the first visible gate opens (`xpToNext = 30 + 15L`, `xp[1] = 10`) |

There is no threat at all at first. The meter fills by time in 480 s, and "Stirring" starts at 0.3, so
about 144 s pass with nothing coming (noise adds only 0.0008 per unit of work, about 0.005 per node).
Even then the first packs are 3 mites or 4 gnats, every 24 s (`outingDirect`). The bag holds 12 x 20 =
240 items. At 3-4 items a node, a 10-minute outing of about 50 nodes fills perhaps 8-9 slots, so the
bag, which `crafting.md` says "paces an outing", does not pace anything. At the end the screen says, in
the game's own words: "The store is kept on this device and the town does not use it yet"
(`mount.ts:252`, `store.ts:2`).

**Prototype 2, gather between waves** (`startLull`, `world.ts:220`):

- A 30 s lull after each of 11 waves adds **330 s** to a run with **570 s** of fighting (wave lengths
  in `data/waves.ts`: 20, 25, 30 ... 60, 90). That makes the run 58% longer, and 37% of it is calm.
  The early lulls are as long as the waves before them, or longer (waves 1-3 last 20, 25 and 30 s).
- There are 9 nodes. Plain ones take 3 s and give 3 raws; rich ones take 6 s and give 8, with 2 guards.
  A chest takes 2.5 s and pays 8 + 5 x wave scrip plus one upgrade pick (`LULL`). Edge arrows point to
  every node off screen (`client/game/mount.ts:128`).
- The skill reward is +6% *work speed* per level (`world.ts:133`). At about 10 xp per plain node and
  roughly 60 nodes a run spread over three skills, a run ends near level 4-5: work goes from 3.0 s to
  about 2.4 s. That reward makes the boring verb slightly shorter. It points back at itself.

### Feel problems (real, but secondary)

- Gathering has no input to feel. With no tap and no timing, a strike sound only decorates a progress bar.
  The New World research says the verb is "pleasant with zero reward attached" thanks to animation and
  sound (`research-new-world.md` hook 5), and then lists "3D audio-visual spectacle" under *does not
  transfer* (same file). Both are true, and the prototypes landed in the gap between them.
- The art rules cap feedback: no glow, no blur, no UI animation over 80 ms (`explore-engagement.md`,
  audit row 1). The same rules that make the run's power invisible also make a node break feel flat.
- Edge arrows in the lull remove the one thing calm could offer, which is noticing things yourself.
  Navigation becomes "follow the orange pip".

Better juice would not have saved either prototype. A perfectly sounded stand-still verb is still a
loading bar.

### Structure and motivation problems (the main cause)

1. **There is no decision inside the act.** The only decision is which node to go to, and it is
   trivial: the nearest one, or the rich one if you will fight. Dome Keeper, the cleanest case of
   alternation in `research-comparables.md`, makes digging an active verb, and its tension is travel
   time: "greed is measured in seconds". Ours has neither active input nor a cost in travel.
2. **There is no risk where it would matter.** In prototype 1 the first 2-3 minutes are free. In
   prototype 2, plain nodes are free by design (the comment at `world.ts:275`), and the guards stand
   still until you come within 230 units. Risk only exists if you choose it, and the payoff for choosing
   it is small (see 4).
3. **Calm removes the run's whole engine.** In an auto-attacker, movement only means something because
   of the threat. Take the threat away and the game has no verbs left. This explains why "nothing
   happening" and "the gathering itself" were the same complaint.
4. **The rewards pay into nothing, or into a sink that is already full.**
   - Prototype 1: into localStorage that nothing reads.
   - Prototype 2: raws and scrip go to a bench where, by the earlier diagnosis, "650-950 unspent scrip
     at benches 9-11" already sits and "real bench choices fall to ~1% by bench 10"
     (`synthesis.md` 2). More income into a saturated sink is worth zero at the margin. The only reward
     with real value is the chest's upgrade pick, and it appears on about half the lulls from wave 2 on.
5. **Nothing grows that the player can feel.** `plan.md` named this ("no level-ups, no new weapons")
   for prototype 1. Prototype 2's skill levels are invisible in play: 0.6 s saved per node.
6. **Prototype 2 kept every old problem.** It sits on the unchanged run, so the run is still tuned so
   you never feel broken, the build is still done by wave 5-8, and nothing still surprises you
   (`synthesis.md` 1, 2, 6). The owner was bored of that run before the lull existed.

### How much does the missing link to materials explain?

For prototype 1, perhaps a third. "No reason to collect" was one of the three complaints, and a real
town use would have answered it. It would not have answered "the gathering itself" or "nothing
happening", and the owner said "It's all of it".

Prototype 2 is a partial control. Its materials did connect (to bench prices and picks), and it was still
boring. That control is weak, because the sink was already full. The honest conclusion is that a link
to something is **necessary and not sufficient**. A link to something the player is short of, and can
feel within a session, has never been tested.

## 2. Which of our assumptions are wrong

| Assumption | Verdict | Why |
|---|---|---|
| **New World's appeal transfers to a 2D phone game** | Mostly wrong as built | What carries New World *minute to minute* is presence in a large 3D world: the walk, the vistas, other people, heavy animation and sound, and gathering as a low-attention activity done while talking or listening to something. A phone viewport, a 13-minute session and a solo device remove all of it. What does transfer (tiers, gates, stations, the chain) only pays off over tens of hours, and no 10-minute prototype can show it. We transferred the parts that cannot be felt in a test and tested them in isolation. |
| **Gathering is a verb that can carry fun** | Wrong for *our* verb | Gathering carries fun when it is (a) active with skill (Dome Keeper's drilling), (b) a by-product of moving and fighting (Forager hits everything; in DRG: Survivor, tunnelling is also the escape route, "widely praised as what makes it more than a clone", `research-comparables.md`), or (c) ambient in a world with a social or aesthetic pull. "Stand in a ring" is none of these. It is the absence of a verb. |
| **Adding systems fixes boredom** | Wrong | The diagnosis of the original game was about *curve and surprise* inside the run: never feeling broken, the build done by wave 5, no drops. The added systems (bars, meters, gates, a bag, a threat meter) are reward-schedule scaffolding wrapped around a verb with no payoff. Each new bar was a promise, with no reward behind it. |
| **The owner wants New World's systems, not its feelings** | Unproven, and the evidence leans to feelings | Message 2 is a list of nouns from someone who said "I can't place my finger on what" one message earlier. That is a player guessing at a fix, not a spec. The concrete signals are about feelings: the run is "too much, but engaging"; "most of the resources are guarded", which is tension around reward, not calm. `research-new-world.md` also asserts "The owner's love is for the economy side", and nothing the owner said supports it. |
| **Prototypes can be judged without the long-term loop** | Half wrong both ways | A core loop has to be fun on its own: Brotato's run 1 is fun with no meta at all. So "it is boring because the town isn't built" is not a defence. But prototype 1 removed the run's payoff (level-ups, power growth) *and* left the long loop unbuilt, so its question ("is 10 minutes of this more fun than a run?") could only come back yes if standing still were fun in itself. Our own earlier diagnosis already said it is not. The test was close to rigged to fail. |

One more wrong assumption, implicit in both prototypes: **that calm is a thing to add.** Every comparable
that alternates well (`research-comparables.md` synthesis 1) has calm that is *full*. Dome Keeper's calm
is the main game, and its fights are the interruption. Our calm is the absence of the main game.

## 3. Why we are going in circles

### The timeline (all on 2026-11-12, from `git log`)

| Time | What happened |
|---|---|
| 05:19-05:49 | Four explorations and a synthesis. Recommendation: **1 + 7 first** (let runs get broken; make power visible), cost S-M |
| 06:29-06:57 | Pivot research, a full plan (5 zones, 8 skills, 8 stations, house, three AI jobs), crafting detail |
| 07:11-07:17 | Prototype 1 built and shipped |
| (played) | "extremely boring", "It's all of it" |
| 08:03 | Prototype 2 built: lull, chests, in-run skills |
| 08:05 | Guards added, **two minutes later**, from one remark |
| (played) | "still boring... going in circles" |

### What each test could and could not show

- **Prototype 1** could show whether calm stand-still gathering in 2D is fun on its own. It answered
  clearly: no. It could not show anything about the chain, stations, finds or the house, because none
  of it existed. Many changes at once, and one binary verdict.
- **Prototype 2** could show whether calm gathering *inside* the run is fun. It answered: no. It could
  not separate the boring verb from the full sink from the old run's flat curve, because all three were
  present.
- **The guard change** was not a test. It turned an offhand remark into a feature in two minutes and
  shipped it as part of the verdict.

### The pattern

1. The owner reports a feeling ("something is lacking").
2. Analysis produces a diagnosis (curve, surprise, goals).
3. The owner names a game they like, and its nouns.
4. **The nouns override the diagnosis.** We build the nouns.
5. A 10-minute play, one tester, a yes/no verdict.
6. "Boring." We change the container and keep the verb and the empty payoff.
7. Back to step 3.

What never changes between loops: the stand-still verb, rewards with no destination, and the unfixed
run underneath. The thing tested twice is the one thing never varied.

Other process faults:

- **Questions to the owner have been about scope, not taste.** `plan.md` "Decisions for the owner" asks
  about the AI's role, how much horde to keep, and whether step 1 is the right test. Nobody asked what
  they do in New World, or when they stopped wanting to play Scrip.
- **The post-mortem was written and then not followed.** "The pull of the old game was pressure" is in
  `plan.md`, and the next build added calm.
- **The speed is too high to learn anything.** Two prototypes and a plan for a different genre in three
  hours, with research taken from search summaries that the plan itself calls "good enough to design
  from, not to quote". Speed is fine for prototypes. It is not fine for a pivot decision.
- **There is no hypothesis written before each build,** so a "boring" verdict cannot falsify anything
  in particular. It just triggers the next build.

## 4. What the owner's evidence actually says

### Known

- **They enjoyed a few hours of Scrip.** The run works in the short term: the combat, its pace and the
  bench are not the problem in hour one.
- **The motivation fade came after "a few hours"**, which matches the predicted cliff at run ~10,
  hour 1.5-2.5, when every scheduled unlock is done (`synthesis.md` 4).
- **Brotato and New World hold them long term.** Both have long progression tails. Brotato's comes
  from character x danger unlocks and builds that break the game; New World's from many parallel bars,
  gear you made yourself, and a world that opens up.
- **Pressure is part of the pull.** "Too much, but engaging." They want a little less of it, not none.
- **Empty calm is rejected outright,** whether alone (prototype 1) or between waves (prototype 2).
- **In their memory of New World, reward sits next to danger** ("most of the resources are guarded").
- **Constraints:** keep AI benefits; do not break the economy.

### Unknown

- What they actually spend New World hours on: crafting to gear, expeditions and chests, trading, PvP,
  a company, or just being in the world.
- Whether they play New World with other people.
- What exactly in Scrip stopped pulling: the run going flat, or nothing to want between runs.
- What "too much" means: enemy count, wave length, readability on a phone screen, or no moment to think.
- Whether the AI fusion ("first made by X") ever made them feel anything.
- Whether they want a character that persists, or runs that get wilder.
- How long a session they want on the phone.

### The five questions I would most want answered

1. **"Think of your last few evenings in New World. What were you actually doing, and what made you log
   in?"** This separates systems from feelings. "Running the iron loop with a podcast on" means ambient
   gathering in a world, which a 2D phone game cannot copy. "Chasing a gear piece" means
   self-sufficiency and a goal. "My company" means social. Each points to a different game, and we have
   been guessing.
2. **"Describe the moment you stopped wanting another Scrip run: which run, what had just happened, what
   you were hoping for next."** This locates the original boredom. If it was "my build stopped changing
   halfway through" or "I'd unlocked everything", the fix is in the run or the meta that the synthesis
   already scoped, and the pivot was never needed.
3. **"What is the best moment you remember in Brotato, and the best in Scrip?"** Peak moments show the
   motivation: a broken build, a lucky item, a near-death win, a first-ever discovery. They tell us what
   to make more of, rather than what to bolt on.
4. **"When a Scrip wave is 'too much', what exactly is too much: how many enemies, how long it lasts, not
   being able to see on the phone, or never getting to think?"** Each answer has a different fix, and
   only one of them (no time to think) is answered by calm. We have built calm twice on an unverified
   reading.
5. **"Would you rather your character get stronger across weeks, or your build get crazier within a
   run? And would you keep playing a game that only did one of those?"** This is the fork between
   persistent progression (the New World half) and the in-run power curve (the Brotato half). It decides
   which loop the next build should test, and whether gathering belongs in the core loop at all or only
   in the long-term loop.
