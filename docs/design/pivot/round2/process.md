# Round 2: how to stop going in circles

For the owner and the AI pair. This is about how we work for the next two
weeks, not about what the game is. Nothing here is a design decision.

## What went wrong

Everything below happened in one morning (12 Nov, 06:29 to 08:05 by
`git log`): three research files, a plan, a crafting spec, an outing sim, a
playable zone, a rejection, a new loop, and guards. About 2,200 lines of
design text and two prototypes in about 95 minutes.

1. **We designed from a feature list, not a feeling.** The owner said
   "Brotato and New World keep me. Something is lacking." The AI heard "make
   it New World" and the plan's "proposed game" is that list: zones, tiers,
   gathering, chests, schematics, trade skills, stations, housing. Nobody
   wrote down which moments in New World the owner actually enjoys. Step 1
   built the parts of New World that are least likely to be them (standing
   at a node, a bag, a threat meter).
2. **We threw away a diagnosis we already had.** `docs/design/synthesis.md`
   found six evidence-backed reasons the run goes stale (you never feel
   broken, the build is done by wave 5-8, builds are numbers not rules,
   wants run out at run ~10, nothing to aim at between runs, no surprises),
   each with a cheap test. None of those tests was run. The pivot plan does
   not mention them.
3. **The slices could not show their purpose.** The owner's verdict on step 1
   included "no reason to collect". That was built in: refining, crafting
   and the house, the whole payoff, did not exist. The lull has the same
   flaw: what you gather goes to a store that nothing uses yet. "Is it more
   fun than a run?" cannot be answered by half a loop with the payoff
   missing.
4. **We tested systems, not feel.** Step 1 shipped with a sim, a test file,
   tiered nodes, a 100/60/30 rule and reshuffled layouts. The question was
   "is this fun for ten minutes". That needed none of it.
5. **The AI built faster than the owner could form taste.** The guards commit
   lands two minutes after the lull commit, with no play in between. The
   owner's remark "New World resources are guarded" became a feature in
   minutes, when it was a clue about a feeling (risk? a prize you can see?
   a fight you choose?). The owner has been reacting to builds, not deciding.
6. **No written fun hypothesis, so no clean kill.** Step 1 had a question and
   a stop rule ("if not, stop and rethink"), which was good. But the rethink
   took 45 minutes, was done by the AI alone, and ended in another build of
   the same plan. The why-it-failed list in `plan.md` is the AI's guess,
   adopted at once ("the pull of the old game was pressure"). There is no
   decision log, so owner decisions ("zones reshuffle") sit inside a plan
   that keeps changing.

## The method: two weeks, taste first

### Rules for both of us

- **Freeze the plan.** `plan.md` and `crafting.md` are parked. No step 2.
  Nothing from the pivot goes into the main game in these two weeks.
- **Every test starts with a fun-hypothesis card** (template below) written
  or approved by the owner before any code. No card, no build.
- **Build cap: 1 hour of AI time, 90 seconds of play.** A test fakes
  everything that is not the moment it tests. Hard-coded numbers, no sim, no
  tests, no saves, its own URL (`?proto=<name>`), deleted or kept by name
  when judged.
- **Fake the payoff.** If a test needs a reason to collect, show the reward
  as a card or screen ("you can now make the Glass Tooth: every 5th hit
  counts triple", then put it in your hands for the next 60 seconds). Never
  test a front half with the back half missing.
- **One test in flight.** The AI does not start the next build until the
  owner has filed a playtest note on the current one. The owner should never
  have more than one thing waiting to be played.
- **Remarks are questions, not tickets.** When the owner says "X has Y", the
  AI asks "what does Y make you feel?" and adds it to the feelings list. It
  does not build Y.
- **Decisions go in `round2/decisions.md`** (one line each: date, decision,
  why, who). The AI reads it before proposing anything.

### Week 1: find the feeling

**Day 1-2, owner: teardown sessions (about 20 min each, phone or PC).**
Play one Brotato run, one 20-minute New World session (or a video of your
own old play if you cannot play it), and one Scrip run. Keep the playtest
note open. Each time you smile, lean in, or think "one more", write the
minute and five words. Each time you drift or check your phone, the same.
The aim is 5-10 moments per game, in your words.

**Day 2, AI:** turn the notes into a short list of feelings in the owner's
words ("seeing the build go silly", "a shiny thing over there that is
risky"), and map each to the synthesis findings where they match. No
mechanics yet. The owner corrects the list in two minutes.

**Day 3, AI: six concept sketches, no code.** Each is a fake screenshot
(static HTML or a drawn mock) plus three sentences: what you do, what you
feel, what the town or LLM part adds. Rules: each names one feeling from the
list; at least two come from the synthesis shortlist (e.g. runs that get
broken, evolved weapons with named first finders); at least one keeps the
LLM-invented item as the moment; no sketch needs more than one new system.

**Day 3-4, owner:** a concept-reaction card per sketch, under two minutes
each. Pick the two that got a "yes, I want to touch this", or none. If none,
the AI does a second round of six from the reactions. Do not lower the bar.

**Day 4-7: feel tests.** For each of the two picks: one hypothesis card, one
hour of build, the owner plays it three times on the phone when they have a
moment and files one note. Kill or keep by the card's criteria. One new
test per day at most.

### Week 2: test the loop, still fake

- Take the survivors and build the **whole loop, faked, in under 3
  minutes**: a short fight, a find, a town screen where the find becomes
  something, and 60 seconds of the next fight with it. The town screen can be
  one button. The question now is "do I want to go out again for the next
  one?", which none of the earlier slices could ask.
- Test the LLM item here with hand-written "model" results first. If the
  discovery moment lands when the text is written by hand, the model will
  make it cheaper and endless. If it does not land, the model will not save
  it.
- Owner plays it on three different days. A loop that is fun once and not
  on the third day is not the loop.
- **End of week 2:** a one-page direction: the feeling, the surviving
  hypothesis, the evidence from the notes, what was killed and why. Only then
  does anyone write a system plan, and it is cut from that page, not from
  New World's feature list.

### Kill criteria (defaults, a card can be stricter)

Kill a test if any is true after three plays:

- you did not want a fourth play;
- you cannot name one moment you liked;
- the best word you have for it is "fine" or "interesting";
- what you liked is something the current run already does.

Keep it if you replayed without meaning to, said "one more", or described
something you want to happen next. Two kills on the same feeling means the
feeling is wrong or not reachable cheaply: go back to the list, not to a
variant.

## Templates

### Fun-hypothesis card (owner approves, 2 min)

```
Test name:            ?proto=________
Feeling we want:      (owner's words, from the list)
The moment:           In the first 90 s, the player will ______ and feel ______.
Comes from:           (teardown note / synthesis finding / owner remark)
Faked:                (everything that is not the moment)
Payoff shown as:      (card / screen / item in hand)
Keep if:              ______
Kill if:              (defaults + ______)
Build cap:            1 hour. Over the cap = cut scope, not extend time.
```

### Playtest note (fill on the phone right after, 3 min)

```
Test / date / plays:  ________ / ____ / 1 2 3
Wanted to play again? yes / maybe / no
Best moment (5 words, and when):
Worst or flattest moment (5 words, and when):
I was thinking about: the game / what to do next / something else
It felt like:         (a game, or a part of one)
One thing I'd change (optional, a feeling not a feature):
Verdict:              keep / kill / unsure (unsure counts as kill after 3 plays)
```

### Concept reaction (per sketch, under 2 min)

```
Sketch:               ________
First gut reaction:   want to touch it / meh / no
What caught my eye:
What I'd do first:
Which game does it remind me of, and is that good?
Worry (optional):
Rank among today's sketches: __ of 6
```

## This week

### Owner

1. Stop playing the lull build. It cannot answer its question; no note
   needed.
2. Do the three teardown sessions (Brotato, New World, Scrip) and send the
   moments, raw.
3. Correct the AI's feelings list (2 min).
4. React to the six sketches; pick two or none.
5. Play each feel test three times; file a note; approve each card before
   its build.
6. Log every decision you make in `decisions.md`, or tell the AI to.

### AI

1. Do not change game code until a card is approved. Leave the lull and the
   outing where they are; do not extend them.
2. Start `round2/decisions.md` with what is already decided: zones
   reshuffle (from `plan.md`), the calm outing is killed, the plan is
   frozen.
3. From the owner's teardown notes, write the feelings list and its links to
   `synthesis.md`. Keep it under a page.
4. Make six concept sketches as fake screens with three sentences each. No
   research agents, no new design docs over a page.
5. For each approved card: build within an hour, on its own URL, payoff
   faked. Report what was faked in one line.
6. After each note: say keep or kill against the card, in one line. Propose
   the next card only from the notes.
