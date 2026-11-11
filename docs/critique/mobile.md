# Mobile critique

Does the whole game work on a phone, measured, and what was changed so that it does.

**Verdict.** In Chromium phone emulation every screen now passes the layout audit on all eight
device profiles, the full flow runs by touch with no console errors or failed requests, and the
touch stick behaves. Before the fixes 61 of 127 device screens passed, now 127 of 127. Nothing here was run on a real
phone or in Safari. The iOS section lists what was reviewed in code instead and what is still a guess.

Everything below was produced by the scripts in `tools/exp/mobile/` (see the last section).
Screenshots are in the session scratchpad under `mobile/`, named `before-*` and `after-*`.

## What was tested, and how

- Playwright with Chromium 153 only, headless, `hasTouch` and `isMobile` set, real touch events
  (`page.touchscreen.tap` and CDP `Input.dispatchTouchEvent`), never mouse clicks.
- The real server (`CRAFT_PROVIDER=procedural`, own database) serving the production build for
  everything in town and for the real run flow. `play.html` built for production
  (`tools/exp/mobile/harness.sh`) for run states that need a harness parameter.
- A second server and harness built from the commit before this work, for the "before" numbers.
- Safe areas were emulated with CDP `Emulation.setSafeAreaInsetsOverride` (iPhone 14 portrait
  47 top, 34 bottom; landscape 47 left and right, 21 bottom; iPad 20 bottom), so `env()` really
  resolved and the audit could check geometry against the insets.

| Profile | Viewport | DPR |
|---|---|---|
| iPhone SE | 375x667 | 2 |
| iPhone 14 | 390x844 | 3 |
| Pixel 7 | 412x915 | 2.625 |
| Small Android | 360x640 | 2 |
| iPhone SE landscape | 667x375 | 2 |
| iPhone 14 landscape | 844x390 | 3 |
| Pixel 7 landscape | 915x412 | 2.625 |
| iPad | 820x1180 | 2 |

## 1. Full flow by touch

`flow.cjs`: first load, Head out, waves steered with a held touch stick, bench (upgrade pick,
lock, buy, reroll, anvil, mule when available), next wave, death, run end, homecoming, town, then
four stub runs to open every tab and a visit to each tab.

| Run | Device | Reached | Bench actions by touch | Console errors | Failed requests |
|---|---|---|---|---|---|
| before | iPhone SE | died wave 3 | 2 picks, 2 locks, 3 buys, 2 rerolls | 0 | 0 |
| before | Pixel 7 | died wave 2 | 1 lock, 1 buy, 1 reroll | 0 | 0 |
| after | iPhone SE | died wave 4 | 1 pick, 3 locks, 2 buys, 2 rerolls | 0 | 0 |
| after | iPhone 14 | died wave 2 | 1 lock, 1 reroll | 0 | 0 |

All five town tabs opened and drew on every run. The pilot is blind (it holds the stick over and
turns it slowly) and never got past wave 4, so two steps were not reached inside a real run and
were covered separately, still by touch:

- Anvil fusion and reveal in a run, and choosing a carry at run end: on the harness
  (`bench=6`, `wave=9`), with the harness's stand-in fusion. Pass on all eight profiles.
- A real `/api/fuse` call: in the town workshop (`townacts.cjs`): two items put on, Strike, a
  first find came back. Same script: sold 10 timber to the Factor, gave timber to the town
  project, started a daily practice run, paused and quit it. No errors, no failed requests.

Not done: a win, and a real run that reaches wave 4 or later with a carry reported to the server.

## 2. Layout audit

`audit.cjs` drives 16 screens per device and `measure.js` measures each one in the page:
horizontal overflow, elements off screen, text spilling out of its ruled box, text under 12 px,
clipped text, tap targets under 44x44, targets closer than 8 px, anything readable or tappable
inside the safe-area insets (at rest and at the end of the scroll), HUD pieces overlapping, and
how much of the screen the HUD covers.

Screens: town first visit, stash, workshop, workshop with two on the anvil, market, market
listing form, town project, daily, homecoming, run first wave, run boss wave with the stick down,
pause, bench, bench with two on the anvil, bench reveal, run end with a carry chosen.

Screens with no hard offender (everything except tap-target size and spacing), before and after:

| Device | Before | After | What failed before |
|---|---|---|---|
| iPhone SE | 7/16 | 16/16 | 11 px text |
| iPhone 14 | 1/15 | 16/16 | 11 px text, page head under the top inset |
| Pixel 7 | 7/16 | 15/15 | 11 px text |
| Small Android | 7/16 | 16/16 | 11 px text |
| iPhone SE landscape | 13/16 | 16/16 | health figure outside its box, elite bar over the weapon slots, 11 px text |
| iPhone 14 landscape | 0/16 | 16/16 | the same, and every page 31 px into the notch on both sides |
| Pixel 7 landscape | 13/16 | 16/16 | 11 px text |
| iPad | 13/16 | 16/16 | health figure 35 px outside its box, 11 px text |

(Pixel 7 after is 15 screens: the bench reveal was skipped because that bench could not pay
for the strike. iPhone 14 before is 15 for the same reason.)

Offender counts summed over all screens of a device, before then after:

| Check | Before (range per device) | After |
|---|---|---|
| Horizontal overflow, off screen, clipped text | 0 | 0 |
| Text spilling out of its box | 0 to 2 | 0 |
| Text under 12 px | 7 to 28 | 0 |
| Inside a safe-area inset | 0, except iPhone 14: 25 portrait, 902 landscape | 0 |
| HUD pieces overlapping | 0 to 2 | 0 |
| Tap targets under 44x44 | 227 to 247 | 0 |
| Targets closer than 8 px | 52 to 55 | 51 to 52 |
| Console errors | 0 | 0 |

The HUD against the play field, boss wave (the fullest HUD):

| Device | Covered before | Covered after | Clear height before | after |
|---|---|---|---|---|
| iPhone SE | 23.5% | 20.2% | 427 px | 477 px |
| iPhone 14 | 18.2% | 15.7% | 535 px | 613 px |
| iPhone SE landscape | 26.4% | 24.7% | 201 px | 205 px |
| iPad | 7.3% | 6.9% | 996 px | 1020 px |

Nothing covers the player at the centre of the screen on any profile, apart from the first-run
teaching line, which is placed under the player on purpose and goes away after 0.7 s of movement.

### Still not at the 8 px spacing

51 pairs per device remain. All are deliberate joins, each target is 44 px or more on its short
side:

- index tabs, 3 to 4 px apart. At 360 px wide the five tabs use the full row; an 8 px gap would
  clip the last one.
- the quantity stepper (minus, figure, plus), drawn as one joined control.
- the rows of "Who heads out", full-width list rows 60 px tall that share a rule.

## 3. Controls

`controls.cjs`, iPhone SE and iPhone 14 profiles, same results on both.

| Question | Measured | Verdict |
|---|---|---|
| Where is the stick anchored | Under the finger wherever it lands (centre within 2 px). 112 px ring, 44 px travel. The base follows a thumb that runs past the rim. | good |
| Dead zone | No movement at 0, 4 and 6 px of drag. 100 px/s at 8 px, 160 at 22, 208 at 33, 213 (full) at 44 and beyond. | good |
| Reversing after a long drag | Thumb must come back 52 px (the travel plus the dead zone). | acceptable, feels a little long |
| Lifting stops the player | Speed 0 within 50 ms, stick hidden. | good |
| Second finger down, moved, lifted | Direction unchanged throughout. | good |
| First finger lifts while a second is still down | Before: player stops and the remaining finger steers nothing until it is lifted and put down again. After: the remaining finger takes the stick over. | fixed |
| Thumb landing on the bottom-right panel | Before: Pause, Sound and a volume slider took 67% of the bottom row; a drag that began on the slider changed the volume instead of moving. After: no slider in the HUD, Pause sits top right beside the weapon slots. | fixed |
| Drag that begins on the health box | Moves the player (HUD furniture passes touches through). | good |
| Edge swipes from all four edges, pinch, double tap | No scroll, zoom stays 1, no pointercancel, no selection. `touch-action: none` on the clearing. | good in Chromium, see iOS notes |
| Rotating mid-run with the stick held | Canvas and HUD refit (667x375, three-column HUD), run continues, steering works, no errors; rotating back restores it. | good |
| Backgrounding | Run pauses, sim time stops, audio context suspended. On return audio resumes and the pause panel waits for Resume; no drift. | good (visibility change was simulated, headless Chromium does not hide a tab) |
| Audio unlock | Context running after the first touch down. | good in Chromium, see iOS notes |

## 4. Performance

`perf.cjs`: 390x844 viewport, DPR 2 and 3, CDP CPU throttling 4x and 6x, 10 s per cell after 3 s
warm-up. Two scenes: a late-wave fight (wave 11, bot steering, about 30 enemies) and the stress
scene (300 enemies kept alive).

**Read these with care.** This is headless Chromium with software rendering, no GPU, on a
4-core machine that sat at a load average of 20 to 48 from other jobs for the whole session.
The same cell varied by 5x between runs. The numbers show where the time goes; they are not
phone frame rates. The renderer caps the device ratio at 2, so DPR 2 and DPR 3 draw the same
780x1688 canvas, which is why those rows do not differ.

"Frame" is the time between animation frames. "Work" is sim plus draw plus a forced
rasterisation of the frame on the main thread. "Script" is sim plus draw calls only.

| Scene | DPR | CPU | Before: frame p50 / p95 | Before: work p50 / p95 | After: frame p50 / p95 | After: work p50 / p95 | Script p50 (after) |
|---|---|---|---|---|---|---|---|
| Late wave | 2 | 4x | 16.7 / 117 ms | 8.0 / 104 ms | 16.7 / 83 ms | 13.3 / 60 ms | 3.2 ms |
| Late wave | 2 | 6x | 16.7 / 67 | 5.6 / 33 | 16.7 / 67 | 12.6 / 45 | 3.0 |
| Late wave | 3 | 4x | 33.3 / 167 | 11.2 / 80 | 16.7 / 67 | 9.6 / 47 | 0.6 |
| Late wave | 3 | 6x | 16.7 / 183 | 7.1 / 56 | 16.7 / 100 | 14.5 / 88 | 3.9 |
| 300 enemies | 2 | 4x | 50.0 / 200 | 27.2 / 151 | 33.4 / 267 | 24.8 / 186 | 1.4 |
| 300 enemies | 2 | 6x | 16.7 / 133 | 13.7 / 64 | 33.3 / 250 | 45.2 / 240 | 5.9 |
| 300 enemies | 3 | 4x | 33.4 / 167 | 37.0 / 164 | 33.2 / 150 | 12.7 / 80 | 3.6 |
| 300 enemies | 3 | 6x | 33.3 / 117 | 17.6 / 93 | 16.8 / 217 | 19.0 / 57 | 3.9 |

Before and after are within the noise of this machine. No claim of a speed-up is made from
this table.

**Where the time goes** (CPU profile, self time, DPR 3, 4x):

| | Late wave | 300 enemies |
|---|---|---|
| Rasterising the canvas (the forced read-back) | 37 to 43% | 69% |
| Browser internals | 38 to 45% | 17% |
| `drawImage` | 3 to 8% | 5% |
| All game script together | under 6% | under 7% |

The script is not the problem: 1 to 6 ms of a throttled frame even with 300 enemies. The cost is
filling 1.3 million canvas pixels, which a phone GPU does and this machine does in software. The
renderer already bakes sprites, culls, snaps to pixels and uses an opaque canvas, so there was
no cheap script win to take.

**The fix made** is a fallback for devices that cannot fill the canvas: if most of three
seconds of play goes on frames slower than 25 a second, the canvas is drawn at 0.75 of the device
ratio, then at 0.5, never below 1x. It only steps down. A phone held at 30 frames a second by
low power mode does not trigger it. `quality.cjs` at 20x throttling, 300 enemies:

| Time | Canvas | Frame p50 | p95 |
|---|---|---|---|
| 4 s | 780x1688 | 200 ms | 1150 ms |
| 8 s | 585x1266 | 50 ms | 383 ms |
| 12 s and on | 390x844 | 16.7 to 33 ms | 50 to 133 ms |

At half resolution the clearing is visibly softer; the HUD and all DOM text stay sharp.

Canvas memory (`canvasmem.cjs`, iPhone 14 profile): 459 sprite canvases, 23 MB at boot; 45 MB
six seconds into a run including the second sprite set and the 5 MB main canvas. iOS limits are
several times that.

## 5. Network and robustness

`network.cjs`, Pixel 7 profile.

| Line | Shell visible | Head out ready | Tap to in the run | Transfer |
|---|---|---|---|---|
| Unthrottled | 0.3 s | 0.3 s | 0.3 s | 346 KB, 10 requests |
| Fast 3G | 0.6 s | 2.9 s | 1.0 s | 346 KB |
| Slow 3G (400 kbit/s, 2 s latency) | 2.1 s | 8.9 s | 3.0 s | 346 KB |

- **Nothing is compressed.** Every response came back with no `content-encoding`. The two
  scripts and two stylesheets are 265 KB of the 346 KB and gzip to about 90 KB. On slow 3G that
  is roughly four of the nine seconds. This is a server change (Hono's `compress()`), outside
  the scope of this pass. It is the largest remaining win for a phone on a poor line.
- **Slow line, first run (fixed).** The boot waits 1.5 s for the town and then shows "out of
  reach". On slow 3G the answer was still on its way, and tapping Head out in that window
  started a local run that was never reported (9 requests, no `/api/run/start`). Head out now
  waits up to 6 s for that hello first; the same test makes 10 requests and gets a real ticket.
- **Server unreachable mid-run.** The wave and the bench play on with no errors. Before: the
  report was tried once at run end, failed, and the homecoming said nothing was saved, even
  though the line came back 8 s later. After: it is tried three times over 7.5 s
  ("Counting at the gate" meanwhile); with the line back after 4 s the run was saved and the
  marks arrived. A longer outage still loses the run. In-run fusion with the town unreachable
  was not exercised (the pilot had fewer than two items).
- **Refresh mid-run.** Lands in town with no notice, holdings unchanged, and Head out works
  again. The run in progress is gone without a word and nothing from it is kept. Not changed.
- **Offline first load.** No service worker, so the page does not load at all. Not changed.

## What was fixed

All in `src/client/**`.

| Fix | Where |
|---|---|
| Every stamp, tab, field, stepper and the volume slider is at least 44 px under a coarse pointer; mouse layout unchanged | `ui/theme.css`, `town/town.css` |
| Page frame, pause panel honour the safe-area insets on all four sides | `ui/theme.css`, `game/game.css` |
| Ledger heads and weapon tier marks 11 px to 12 px | `ui/theme.css`, `game/game.css` |
| Touch HUD: Pause only, moved up beside the weapon slots; sound and volume are in the pause panel and the bench head | `game/game.css` |
| Health box no longer narrower than its bar and figure (landscape phones, iPad) | `game/game.css` |
| Landscape phones: elite bar and notices no longer collide with the weapon slots; on short screens they sit at the foot between the thumbs, off the player | `game/game.css` |
| Landscape bench: the empty reason line no longer takes 30 px of a 375 px screen | `game/game.css` |
| Anvil picks and bench foot buttons 8 px or more apart | `game/game.css` |
| Stick hands over to a second finger when the first lifts | `game/input.ts` |
| Touches that start on the clearing are also cancelled at `touchstart` and `touchmove`; sheets over the run allow vertical pan only; Safari's `gesturestart` is cancelled inside the run | `game/input.ts`, `game/game.css`, `game/mount.ts` |
| `touch-action: manipulation` on the document: no double-tap zoom, no tap delay | `ui/theme.css` |
| Touch detection no longer rests on `(pointer: coarse)` alone, and the first touch switches the teaching line | `game/mount.ts` |
| Audio unlock listeners stay for the life of the page and include `click`, so a context that iOS interrupts can wake on the next touch | `audio/index.ts` |
| Empty document `touchstart` listener so pressed stamps show `:active` on iOS | `main.ts` |
| Resolution fallback for slow devices | `game/mount.ts` |
| Head out waits for a late hello instead of starting an unsaved run | `town/run.ts` |
| Run report retried twice when the town is unreachable | `town/run.ts` |

`npx tsc --noEmit` passes, `npm test` passes (15 files, 195 tests), `npm run build` works.

## Safari and iOS: untested

No WebKit build was available. Nothing below was observed on a device.

Reviewed in code and believed fine:

- **Viewport height.** No `100vh`. The run is `position: fixed; inset: 0` with `100dvh` as a
  second statement, so the collapsing toolbar cannot leave a gap or hide the bench foot.
- **Safe areas.** `viewport-fit=cover` is set and every edge now pads with `env()`. In ordinary
  Safari the portrait top inset is 0; the landscape side insets were the real fault.
- **Input zoom.** Every text and number field computes to 17 to 19 px (checked in the page), so
  focusing one does not zoom. Chromium showed zoom 1 after focus.
- **Pointer events, cancel.** The stick uses pointer events and ends on `pointercancel`.
- **Selection and callout.** `user-select: none` and `-webkit-touch-callout: none` on the run.
- **Visibility.** The run pauses and the audio context suspends on `visibilitychange`; a frame
  gap is clamped to 250 ms.
- **Canvas memory.** 45 MB at most.
- **Language level.** The bundle uses `Object.hasOwn` and `.at()`, so it needs iOS 15.4 or
  later. Older iPhones get a blank page with no message.

Risks that only a device can settle:

1. **Audio.** iOS counts `touchend` and `click` as a gesture, not `pointerdown`. The first tap
   on Head out should unlock it, but this is the item most likely to be wrong. The ringer
   switch on silent mutes WebAudio entirely; there is no notice for that.
2. **Edge swipe back.** A drag that starts at the left edge may still start Safari's back
   gesture. `preventDefault` on `touchstart` is the known mitigation and is in; it is not
   guaranteed.
3. **Pinch.** Blocked on the clearing and on the sheets by `touch-action`. If a pinch gets
   through on a town page and the player then heads out, the run would start zoomed with no way
   to pinch back on the clearing.
4. **Bottom toolbar.** With Safari's toolbar minimised, a tap in the lowest 44 px can raise the
   toolbar instead of pressing the bench's Reroll or Next wave. The page does not scroll in a
   run, which normally keeps the toolbar up.
5. **Frame rate.** Unknown. The fallback above is the safety net; nothing here says whether it
   will be needed on an iPhone.
6. **`overscroll-behavior`** on the bench needs iOS 16; on 15.4 the sheet may rubber-band.

## Remaining, in order of how much a phone player will notice

1. No compression on the server (about 250 KB wasted per first load).
2. A refresh or an accidental back swipe mid-run loses the run silently.
3. A real phone has not run it. Audio on iOS first.
4. Reversing the stick after a long drag takes 52 px of thumb travel.
5. Tabs, steppers and character rows sit closer than 8 px.
6. Portrait HUD takes the top 190 px on a 667 px screen during an elite wave.
7. No offline shell.

## Running the experiments again

```bash
npm run build
CRAFT_PROVIDER=procedural PORT=8801 DB_PATH=/tmp/mobile.db npx tsx server/index.ts &
tools/exp/mobile/harness.sh                      # production play.html on :8802
node tools/exp/mobile/flow.cjs se                # experiment 1; also writes state-se.json
DB_PATH=/tmp/mobile.db npx tsx tools/exp/mobile/seed.ts   # goods for every account (throwaway DB only)
STATE=<out>/state-se.json node tools/exp/mobile/audit.cjs # experiment 2, all devices
node tools/exp/mobile/summary.cjs after ; node tools/exp/mobile/compare.cjs
node tools/exp/mobile/controls.cjs se            # experiment 3
PROFILE=1 nice -n -15 node tools/exp/mobile/perf.cjs      # experiment 4
node tools/exp/mobile/quality.cjs 20             # the resolution fallback
node tools/exp/mobile/network.cjs                # experiment 5
node tools/exp/mobile/townacts.cjs se ; node tools/exp/mobile/canvasmem.cjs
```

Environment: `BASE` (default `http://localhost:8801`), `HARNESS` (`http://localhost:8802`),
`OUT` (where screenshots and JSON go), `TAG` (`before` or `after`, the file prefix), `STATE`
(a Playwright storage state for a seeded account). Check that the ports are free first: other
servers were found on 8803 and 8804 during this session.
