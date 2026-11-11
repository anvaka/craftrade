# Game feel and audio: what changed after the fun critique

Scope was client presentation only: `src/client/game/**`, `src/client/audio/**`, `src/client/art/**` and the
recap in `src/client/town/homecoming.ts` (plus its own `homecoming.css` and one optional field pair in
`src/client/seam.ts`). Nothing in `src/sim`, `src/shared` or `server` was touched. All checks were run in
headless Chromium through `play.html` on Vite dev, or the built app on the game server, with the scripts in
`tools/exp/feel/` (last section). Screenshots are in the session scratchpad,
`/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/feel/` (written `feel/` below);
`feel/x2/` holds the device-ratio-2 copies.

**Nobody has listened to any of the audio.** Every audio claim below is a measurement of a render through an
OfflineAudioContext, not a judgement of how it sounds.

## 1. Readability

| Change | Where | Evidence |
|---|---|---|
| Enemy shots: a heavy Ink rim (radius 9 against 5 before) round a Madder core, an Ink tail turned to the heading, drawn over everything | `art/world.ts spitShot`, `render.ts` | `feel/x2/before-spit-wave7.png` against `feel/x2/after-spit-wave7.png` |
| The player: a baked Ink ground band with an Ochre line (nothing else on the floor is that heavy), and an Ink-and-Ochre pennant over the head, drawn above crowd, treeline and shots | `art/world.ts playerGround, playerHead`, `render.ts` | `feel/before-tusk-wave12.png` against `feel/after-tusk-wave12.png`; `feel/after-crowd-wave8.png` |
| The camera centres the player in the part of the screen the HUD leaves open, and may run past the clearing edge by what the HUD covers, so a player in a corner is never under a panel. The HUD reports its covered bands four times a second (DOM rect reads, no layout writes) | `hud.ts insets()`, `render.ts clampCam`, `mount.ts syncInsets` | `feel/x2/before-phone-corner.png` (player hidden under the HUD) against `feel/x2/after-phone-corner.png`. `verify.cjs hudclear`: player body overlaps a HUD box by 0 px² at five positions (four corners, top edge) on 360x640, 640x360 and 1280x720 with the elite bar up |
| Telegraphs thinned: a charge lane is filled and hatched only if it passes within a step of the player, and drawn last; others are the dashed outline from the same baked sprite. Slam rings away from the player are an outline. Spawn diamonds away from the player are a 1.5 px line | `render.ts` | `feel/after-tells-wave11.png`, `feel/after-crowd-wave8.png` (the far boar lanes are dashed outlines, the near one is filled) |
| What hurt you: a Madder wedge 52 px from the player pointing at the source (the shot that just vanished, else the nearest enemy of that type), 0.75 s; on death it stays through the beat. The hurt figure now reads "-2 Mite", and the run ends under a card "Down in wave 2 / A mite got you." | `render.ts hurtFrom`, `art/world.ts hurtTick`, `mount.ts` | `feel/after-loop-desk-run1-death-beat.png`, `feel/x2/after-loop-phone-run1-death-beat.png`, `feel/verify-death-beat-boss-desk.png` |

## 2. Beats

| Change | Where | Evidence |
|---|---|---|
| Level-up: two doubled Ochre rings (Ink between them) out to 92 and 150 px over 0.34 to 0.5 s, 18 chips, "Level N" in 30 px type over the player for 1.25 s, the level box inks over, the sound 15% louder, a "1 pick owed" slip by the level that counts until the bench | `render.ts`, `hud.ts`, `game.css .g-owed` | `feel/seq-before-levelup.png` against `feel/seq-after-levelup.png` (8 frames at 1/5 speed); picks owed in `feel/after-crowd-wave8.png` |
| Wave clear: the scene holds 1.05 s; what the sim swept off the floor flies into the player (up to 140 pickups, eased), the killed leftovers pop; a rising run of scrip ticks, then a new "paid" sound; a card "Wave 1 cleared / Paid 21 scrip, 3 timber, 3 ore. 1 scrip left behind. 1 upgrade pick at the bench." | `mount.ts waveCleared`, `render.ts waveEnd` | `feel/seq-before-waveclear.png` (hard cut to the bench) against `feel/seq-after-waveclear.png` |
| Elite and boss arrival: a Madder doubled ring, 3-4 frames of stop, a card with what it does ("The stag. It charges three times and leaves shards where it stops."); a card when an elite goes down | `mount.ts ARRIVAL`, `render.ts` | `feel/x2/after-elite-arrival.png`, `feel/after-boss-arrival.png` |
| Low health (30% and under): a flat Madder hatch strip at the four screen edges (baked once per size, four blits a frame), deeper on each heartbeat; a new "heart" sound every 0.95 s, 0.62 s under 15% | `render.ts drawLowHealth`, `mount.ts heart`, `sounds.ts heart` | `feel/after-lowhp.png` |
| Hit-stop: 2 frames on a blow of a third or more of a tough enemy's health, and on killing a brute-sized enemy, at most one every 0.3 s; 4 frames on an elite death (was 7). None of the optional ones under reduced motion | `render.ts stop()` | read from code; frame counts not measured |
| Shake: unchanged trauma model and pause toggle; it starts off when the device asks for reduced motion (checked) | `dom.ts`, `mount.ts` | `verify.cjs settings` |
| Damage numbers: when nine or more figures are up, ordinary hits are added into one figure per 70x54 px patch; the player's own figure is never doubled | `render.ts number()` | `feel/after-tusk-wave12.png` against `feel/before-tusk-wave12.png` |
| Pitch ladders on scrip (8 steps, 0.5 s window) and on kills (a fifth, 0.7 s), as well as raws | `audio/index.ts LADDER` | read from code |

## 3. Audio

New: `audio/music.ts`, a work song at 92 bpm written a bar at a time from the existing struck voices (foot
stamp, wooden knock, a hummed triangle call and answer in A minor pentatonic from 220 Hz, a shaker, a dull
bell). It thickens with the wave (call from wave 3, shaker 7, double stamp 9, bell on the last) and a step
while an elite stands; it is silent at the bench (where the anvil loop lives), in pause, in the beats and at
the end. Mixer: sounds go to combat, alert or fx buses; telegraph, hurt, elite, boss and death duck the
combat bus to 0.4 and the bed to 0.3 while they sound. A telegraph that cannot reach the player plays at
0.22 at most every 0.7 s and ducks nothing. Pause panel: a "Work song" switch; volume, mute, the song
switch and shake persist (checked by reload).

Measured with `node tools/exp/feel/audio.cjs` (48 kHz, through the game's own bus, compressor and limiter at volume 1):

| | Peak dBFS | RMS dBFS | Centroid | Clipped samples |
|---|---|---|---|---|
| Existing effects, 37 sounds (range) | -16.8 to -0.7 | -31.5 to -16.1, median -22.8 | 104 to 5329 Hz | 0 |
| heart (new) | -3.5 | -20.7 | 117 Hz | 0 |
| paid (new) | -3.7 | -25.1 | 4278 Hz | 0 |
| level-up as played (x1.15) | -2.2 | -24.2 | 2271 Hz | 0 |
| wave end + sweep ticks + paid | -3.6 | -21.3 | 4109 Hz | 0 |
| Work song, level 0 / 0.2 / 0.5 / 0.7 / 1, 8 bars | -9.6 to -7.3 | -35.2 / -34.0 / -34.0 / -32.9 / -32.5 | 138 to 217 Hz | 0 |
| Every sound started at once | -0.3 | -15.6 | | 0 |

- The bed sits 10 to 12 dB under the median effect, inside the band of the quietest existing sounds
  (stamp -31.5, edge -31.2). Most of its energy is under 300 Hz; above 300 Hz it is -46 to -41 dB, so on
  a phone speaker it may be close to inaudible. That is a guess about speakers, not a measurement.
- Telegraph against a wave-10 mix (15 hits, 7 kills, 6 shots, 5 scrip pickups a second, plus the bed at
  0.8), energy in its own bands (430-550 Hz knock, 880-1080 Hz rattle): 12.6 dB over the mix with the
  old chain, 10.8 dB with the new buses and the bed but no ducking, 15.0 dB with ducking. The bands were
  measured first: hits and kills sit at 83-95% under 300 Hz and already kept out of the telegraph's way,
  so their filters were left as they were.
- No clipping anywhere after the limiter; the existing sounds clip before it (raw peaks up to +5.6 dB),
  as they did before.

## 4. Teaching

Progress per device in `localStorage["scrip.feel"]` (`game/progress.ts`, every access in try/catch). Each
line stays until the action has been done, on whichever run, not until a run has ended. No modal.

| Lesson | Shown | Gone when | Checked |
|---|---|---|---|
| Move | "Move with WASD or the arrow keys" / "Drag anywhere to move" | 0.7 s of movement | `verify.cjs teach` |
| Keep moving | "Keep moving. Touch hurts." (Madder rule) after the first hit, or 1.2 s standing still with an enemy within 150 px | 2.5 s of movement | `feel/verify-teach-keep-moving.png` |
| First node | Ochre double chevron over the nearest node, and the ring line; "Stay in the ring until it breaks" while working | a node breaks | `feel/after-first-1-moved.png`; a second run on the same device skips "move" and still teaches the ring |
| Raws | "Timber, ore and hide are raws. They pay for bench recipes, and what you keep goes home." | first raw picked up | `verify.cjs words` |
| Scrip is experience | "Scrip is also experience. A level is one upgrade pick at the bench." | first level | `verify.cjs words` |
| Bench | the offers line names raws; the foot says "Take your upgrade first. The offers and the next wave wait for it." before anything is pressed; stat rows at 0 are hidden (13 rows to 1 on the first bench) | first purchase | `feel/verify-bench-first-pick.png`, `feel/verify-bench-first-offers.png` |
| Anvil | with two different items held: "If nobody in the world has tried the pair, your name goes on what it makes." | first strike | `feel/verify-bench-anvil-taught.png` |
| Carry home | the recap's "Next" line: "Clear wave 4 and one item from your build comes home with you." | (every death below the next step) | recap shots below |

## 5. Death to the next run

One recap. The game hands over at once unless there are more carryable items than may go home; then it asks
only that ("What comes home with you", "Head home" focused). The town sheet now reads: the title in one verb
("Down in wave 2"), "A mite got you. 0:29 in the clearing.", then Close / Best / Next lines, then "Go again"
(focused) and "To town", then what is new, what came home (one table, one set of heads), the figures.
Best wave per device and "New best" are kept in `progress.ts`. The near-miss line is shown only when true:
the elite or boss at 35% or less ("Old Tusk had 12% of its health left.", checked), 8 or fewer seconds left
in the wave, or a death on a wave that would have carried an item.

| `loop.cjs`, built app, idle player | Before | After |
|---|---|---|
| Killing blow to a focused "Go again", desk | 2065 ms and 1 press (two screens) | 1541 ms and 0 presses |
| Same, phone 360x640, by touch | | 1518 ms, 0 presses |
| "Go again" to the next run | 111 ms | 96 ms (desk), 75 ms (phone) |
| "Go again" on a phone | below the fold at 510 px | at 271 px, 98x54 |
| Second run teaches | nothing | "Move with WASD..." again (the idle player never moved) |
| Console errors | 0 | 0 |

A 350 ms guard ignores a "Go again" press that lands as the sheet appears, so a key held from the run does
not start the next one by accident. Shots: `feel/x2/after-loop-phone-run2-recap.png`,
`feel/after-loop-desk-run2-recap.png`, before: `feel/before-loop-desk-run1-end-screen.png`,
`feel/before-loop-desk-run1-recap.png`.

## 6. Writing

Fixed in scope: "Died on wave" / "Down in wave" are one verb ("Down in wave N", "Left in wave N"); the two
raws tables are one; "216 banked, pays double" is "216 left behind: pickups pay double" ("x2" on phones);
"There is nothing to sign" is "There is no sign-up and no password"; "Untried by you this run" is "Not
struck yet this run"; the anvil text says what is at stake; upgrade rows say what the number does ("Now 0,
then 1: damage taken x0.94"); "Take your upgrade first" is shown before the press; "Killed by a mite" is
"A mite got you."; "Head back to town" on the carry screen is "Head home".

Not fixed, because the strings live in `src/sim` or `server`: the names Spitter, Brute and Burrower
(`sim/data/enemies.ts`), wave 11's brief "Everything" (`sim/data/waves.ts`), the Greenhorn's "No twist."
(`sim/data/characters.ts`), weapon notes that restate stats (`sim/data/weapons.ts`) and the fallback fusion
names (`server/provider.ts`).

## Performance

`node tools/exp/feel/perf.cjs` (300-enemy stress, 390x844, DPR 2, CPU 4x, 10 s per run, 4 rounds turn about,
forced rasterisation in the work figure). Load average 7 on 4 cores during the run.

| Median of 4 rounds | Frame p50 | Frame p95 | Work p50 | Work p95 |
|---|---|---|---|---|
| Before | 50.0 ms | 150.0 ms | 40.4 ms | 74.3 ms |
| After, full health | 50.0 ms | 133.4 ms | 36.8 ms | 68.5 ms |
| After, at 20% health (hatch and heartbeat on) | 33.4 ms | 100.1 ms | 35.7 ms | 86.9 ms |

Within noise: single rounds of the same build ranged 30 to 48 ms work p50. The low-health work p95 is the
only figure above before (+12 ms, 87 against 74) and its rounds ranged 76 to 93 against 56 to 79 for before;
it may be the four edge blits, it may be load. New per-frame cost by construction: two sprite blits for the
player marks, at most one for the tick and one for the pointer, four for the hatch, a DOM rect read four
times a second; no full-screen fills, no new per-enemy paths (far lanes reuse the baked lane sprite).

## Checks

`npx tsc --noEmit` clean, `npm test` 15 files and 195 tests pass, `npm run build` builds.
`node tools/exp/feel/verify.cjs`: 40 of 40 checks pass in one full run (teach, words, bench, settings, bed,
carry and near miss, win, HUD clear, mobile). The mobile set re-measures the mobile
pass on the new pieces: no text under 12 px, no button under 44 px, no HUD boxes overlapping or off screen,
no horizontal scroll, on 360x640, 640x360 and 375x667 with the elite card up and with picks owed. Landscape
first failed (four-figure scrip pushed the counters into the wave box) and was fixed.

## What I could not verify

- Any sound by ear, on any device. iOS audio unlock with the new bed is untested.
- The hit-stop frame counts and how the new beats feel at speed; frame strips were taken at 1/5 speed.
- Real phones and Safari. All of this is headless Chromium with touch emulation.
- That the near-miss "seconds left" and "one wave short" lines read right in play; only the boss line was
  forced and checked.
- The `coarse` pointer test in headless phone emulation: the teach line said "Move with WASD..." on an
  emulated phone until the first touch on the clearing (as before this pass).

## Sim events that would help

- `hurt` with the source's position (or enemy index) and whether it was a shot, a touch, a slam or a
  charge. The direction tick now guesses from the vanished shot or the nearest enemy of that type.
- `waveEnd` with what it swept: scrip banked and raws granted by the sweep (the card works it out from
  totals before and after).
- `pickup` already carries value; a `streak` or `combo` count is not needed.
- A `tell` event with the target point or line, so the client does not have to rebuild each tell's reach.

## Running it again

```bash
npx vite --config tools/exp/feel/vite.dev.config.mjs --port 8841 --strictPort        # this tree
FEEL_ROOT=<a checkout of the commit before> npx vite --config tools/exp/feel/vite.dev.config.mjs --port 8842 --strictPort
node tools/exp/feel/shots.cjs http://localhost:8841 after [scene ...]   # DSF=2 OUT=... for retina copies
node tools/exp/feel/verify.cjs http://localhost:8841 [check ...]
node tools/exp/feel/audio.cjs http://localhost:8841 after                 # and the before tree, for the comparison
node tools/exp/feel/perf.cjs http://localhost:8842 http://localhost:8841 4 10
npm run build && CRAFT_PROVIDER=procedural PORT=8851 DB_PATH=/tmp/feel.db npx tsx server/index.ts &
node tools/exp/feel/loop.cjs http://localhost:8851 after desk|phone|land
```

The Vite config allows the symlinked `node_modules` of another checkout, which the default config refuses
(the typeface then fails to load with a 403).
