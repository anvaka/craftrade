# Mobile critique: touch interaction and behaviour

Lens: how the game behaves under a finger. Visual size and layout architecture are covered by the other critics.

How this was measured: Playwright Chromium, context `{ viewport 375x667, isMobile, hasTouch, deviceScaleFactor 2 }`
(390x844 and 844x390 for safe areas, with CDP `Emulation.setSafeAreaInsetsOverride` 47/34 portrait, 47/47/21 landscape),
real touch input (`touchscreen.tap` and CDP `Input.dispatchTouchEvent`), bounding boxes read with
`getBoundingClientRect` in the page. Town data came from four to six `?stubrun=1` wins; bench from
`/play.html?bench=6&seed=3`. The harness has no tooltips, so `installTips()` was injected by a module script tag for the
tooltip tests. Scripts and screenshots: `/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/touch/`.

**Evidence warning for all critics.** In this Chromium build, a Playwright `fullPage: true` screenshot switches off
touch emulation for the rest of the page: `matchMedia('(pointer: coarse)')` was `true` before the first full-page shot
and `false` after it, and every stamp dropped from 44 px to 32 px. The shared shots show the same thing: workshop,
town and daily are exactly 3330, 1248 and 850 px tall, which match the mouse layout I measured. Under touch the same
pages are 3566, 1308 and 874 px. So most `*-05` to `*-11` shots show the **desktop** layout. Real phones get taller
pages with 44 px controls, which makes the scrolling complaint worse, not better.

## 1. Verdict

The 44 px work from the earlier pass still holds. Under a real coarse pointer, none of the 158 live controls across the
six town tabs and the bench is under 44 px, and every text field computes to 17 to 19 px, so iOS will not zoom on focus.
The problems are behaviour, and three of them cost players things. A double tap destroys an item: Salvage 110 ms
apart deleted a stash item on the server, and Scrap 120 ms apart scrapped a bench item, because each "press again"
confirm appears at the same spot as the first press. A long press to read a tip, followed by a scroll, leaves the next
tap on any button silently eaten. On the bench, the weapon Scrap buttons are pushed 32 px off the right edge (scroll
width 407 px in a 375 px view). The tooltip system is also hard to use by touch: 109 of the 113 tip-bearing elements on
the stash are under 24 px on their short side (charge pips 36x10, tier marks 39x15), 24 of them have no underline, and
the tips that live on buttons only open with a 450 ms hold that nothing on screen tells you about.

## 2. Ranked findings

### 1. Confirm-twice is defeated by a double tap (Salvage, Scrap, Quit)
- **Screens:** Market, selling list (`Salvage` becomes `Destroy for N`). Bench, weapon and item `Scrap` becomes `Sure?`. Pause, `Quit` becomes `Sure?`.
- **Problem:** The armed button is drawn at the same left and top as the first press. Salvage went from 73x44 to 108x44 at the same (16, 312). Two `touchscreen.tap`s 110 ms apart at the same point: the stash went from 12 to 11 salvage rows (a server-side destroy). On the bench, two taps 120 ms apart: "Salt wedge scrapped for 77 scrip". `touch-action: manipulation` on `html` turns a double tap into two fast clicks, so a nervous double tap or a bounce goes straight through the guard. Nothing disarms on its own: `armed` and `scrapArm` stay set until another action.
- **Fix:** Add a minimum delay before the second press counts. In `src/client/town/market.ts`, salvage `onClick`: record `armedAt = performance.now()` when arming and ignore the confirm if `now - armedAt < 450`. Do the same in `src/client/game/bench.ts` `doScrapWeapon` and `doScrapItem` (store the time next to `scrapArm`) and in `src/client/game/mount.ts` `quit` click (`quitArmed`). Also disarm after 4 s (a `setTimeout` that clears and redraws). For Salvage, which is permanent, consider making the confirm a separate stamp to the left of the original, so the same finger position cannot confirm.
- **Impact:** High. This is permanent loss of stash items and run items.
- **Effort:** S

### 2. A long press followed by a scroll eats the next tap anywhere
- **Screens:** Every screen with tipped buttons: bench (Lock, Reroll, Scrap, anvil picks, Strike), market and workshop stamps.
- **Problem:** In `src/client/ui/tip.ts`, the long-press timer sets `swallowClick = true`, and the flag is only cleared by the next `click`. If the finger then moves (the natural "read it, then scroll on" gesture), the browser sends `pointercancel` and no click, so the flag stays set. Measured: a 800 ms hold on "Riveted apron", then a 120 px drag (events: `pointerdown`, `pointercancel`), then one tap on Sound did nothing (`aria-pressed` stayed `false`). The second tap worked. The same thing happens on any browser that sends no click after a long press.
- **Fix:** In `installTips()`, clear the flag at the start of every `pointerdown` (`swallowClick = false;` as the first line) and in the `pointercancel` handler. Better still, store the long-press time and swallow only a click that arrives within about 800 ms of it.
- **Impact:** High. A press that does nothing reads as a broken game, and on the bench the next press is often a buy.
- **Effort:** S

### 3. Bench weapon rows: Scrap is pushed off screen and touches Tier up
- **Screens:** Bench, "Weapons, n of 6" (`ip-23`/`se-23` scroll 2 and 3, and `bench-weapons.png` in the scratchpad).
- **Problem:** The `.act` cell is 246 px wide, starts at x 161 and ends at x 407. `.g-bench` `scrollWidth` is 407 against a `clientWidth` of 375, and `overflow-x: hidden` plus `touch-action: pan-y` mean the clipped part cannot be reached. Each Scrap button is 109 to 118 px wide with 32 px hidden, cost included. Tier up (x 161 to 289) and Scrap (x 289 onward) have 0 px between their hit boxes. One spends scrip and the other is destructive.
- **Fix:** In `src/client/game/game.css`, under `(max-width: 620px)`, let the weapon row's `.act` wrap under the name: `flex-wrap: wrap; justify-content: flex-end; gap: 8px`, or set `grid-column: 1 / -1` so it gets its own line. Keep at least 8 px between Tier up and Scrap. Drop the cost icon from Scrap on narrow screens (the tip and `aria-label` carry it).
- **Impact:** High. A destructive control is half off screen and its price cannot be seen.
- **Effort:** S

### 4. The volume slider takes vertical swipes
- **Screens:** Every town page head (`.vol`, 110x44 at y 118, with `Sound`), homecoming, and the bench head.
- **Problem:** A vertical swipe that started on the slider (thumb moved 0.5 px sideways for every 20 px up) moved the value from 0.70 to 0.25 and also scrolled the page 290 px. The slider is in the first screen of every page, right where a thumb starts a scroll, so volume changes without the player noticing. The HUD already removed the slider for this reason (earlier critique, "Controls").
- **Fix:** In `src/client/ui/theme.css` `@media (pointer: coarse)`, hide `.sound .vol` in the town page head and the bench head and keep only the Sound toggle (as `game.css` already does for `.g-snd`). Keep the slider only in the pause panel (`.g-panel-rows .sound .vol`), where nothing scrolls. If a slider has to stay, make it a tap-to-step control (Quiet, Mid, Loud) instead of a range.
- **Impact:** Medium to high. Audio changes by accident, and the slider takes about 58 px at the top of every page.
- **Effort:** S

### 5. Tips open on finger-down, so they flash during scrolls
- **Screens:** Stash (113 tip elements), workshop (57), market (43), bench (36).
- **Problem:** `pointerdown` on non-live tip text calls `show(t)` straight away. Measured: a drag that started on a tier mark showed the tip on the first frame (`tip at start: true`) and hid it on scroll. On the stash, tip elements are packed into every item row, so many scrolls start on one and flash a 54 to 112 px black box. It also means tapping an item name in a list is "show tip", while a second tap on the same element closes it.
- **Fix:** In `tip.ts`, for non-live targets, remember the target and position on `pointerdown`, and call `show()` on `pointerup` only if the finger moved less than 10 px and was down for less than 450 ms. Keep `hideTip()` on `pointerdown` for anything else.
- **Impact:** Medium. A constant flicker while scrolling makes the UI feel unpolished, which is one of the owner's complaints.
- **Effort:** S

### 6. Tip targets are tiny, and a quarter of them have no sign they can be tapped
- **Screens:** Stash, workshop, market, bench, homecoming.
- **Problem:** Tip-only elements on the stash, by short side: pips 36x10 (18 of them), tier marks 39x15 (18), `.term` 14 to 22 px tall. In all, 109 of 113 are under 24 px. A tap 8 px above the pips missed (no tip). Only `.term` and `.made` carry the dotted underline. `.tier` (12 on the stash), `.pips` (12) and `.counter` (4) have no underline and no other mark. On the bench, the "FIRST" reason tag and the held counters behave the same way. The dotted underline itself is 1 px and 3 px below the text: at 2x it reads as a faint rule, not as something to tap.
- **Fix:** In `src/client/ui/theme.css`, extend the hit area without changing the layout: `[data-tip]:not(button){position:relative}` and `[data-tip]:not(button)::after{content:'';position:absolute;inset:-12px -4px}` (keep `.term` inline; for `.pips` and `.tier` use `inset:-17px -4px` to reach 44 px). Give `.tier`, `.pips` and `.counter` the same 1 px dotted underline as `.term` (a `border-bottom: 1px dotted` under the mark), or stop putting tips on decoration and use one tip per item row on the item name.
- **Impact:** Medium. The game's explanations are its glossary, and on a phone most of them cannot be found or hit.
- **Effort:** M

### 7. Tips on buttons need an undiscoverable long press, and their text talks about keys
- **Screens:** Bench (Lock, Reroll, Wave n, Scrap, Strike, anvil picks), market (Post, Salvage), workshop.
- **Problem:** The tips that matter most ("Scrap ... for 15 scrip. Asks once more first.", the reroll cost, "Posting opens after 5 runs") are on live buttons and open only after a 450 ms hold. Nothing teaches the hold. The text says "Key: L and the offer number", "Key: R" and "Key: Enter" (`bench.ts` lines 409, 703, 709), although the key badges (`.g-key`) are already hidden under `pointer: coarse`.
- **Fix:** In `bench.ts`, build those strings with `coarse ? '' : ' Key: R.'` (the run already computes `coarse` in `mount.ts` line 147; pass it in `deps`). Add a one-time teach line, using the existing `learned()` mechanism, the first time a bench opens on touch: "Hold a button to read what it does." For a blocked button (`aria-disabled`), show the tip on a plain tap, since the tap does nothing else.
- **Impact:** Medium.
- **Effort:** S

### 8. The bench's stat preview is hover-only
- **Screens:** Bench, offers and anvil against the stats list.
- **Problem:** `watch()` in `bench.ts` previews stat changes on `pointerenter`/`pointerleave`. On touch, those fire at finger-down and finger-up, so the preview lives only while the finger is on the button, and the buy fires at the same moment. In portrait, the stats list (`Damage`, `Rate`, ...) is in `.g-side`, about 1000 px below the offers (the bench is 2323 px tall at 375x667), so the change is never seen. Desktop players get "what will this do to me"; phone players do not.
- **Fix:** Under `pointer: coarse`, render the delta inline in each offer (a short "+4% Rate, -2 Armor" line under the effects), using the same `offerDelta(i)`. Or move the stats block above the offers in the narrow layout, and keep the preview pinned after a tap on the offer's body (not its Buy) until the next tap.
- **Impact:** Medium. This is a real decision aid that is missing on touch.
- **Effort:** M

### 9. Focus marks show up after taps
- **Screens:** First load (Head out has its focus rule), homecoming (Go again), stub run, town after redraws.
- **Problem:** The page restores or sets focus in code after each redraw (`shell.ts` `fk` restore, around line 218 to 261; `stubrun.ts` line 129). After a touch tap, `document.activeElement.matches(':focus-visible')` was `true` on `again` and `stub:win`, so the heavy 3 px focus rule under the label (`town.css` `.stamp:focus-visible::after`) shows on a phone, as in `home6.png` and on Head out in `town0.png`. To a touch user, that rule looks like a stray underline. If the focused button has a tip, `focusin` also opens the tip unasked.
- **Fix:** Keep a module flag `lastInput: 'key' | 'pointer'` (set on `keydown` and `pointerdown` in `main.ts`). In `shell.ts` and `stubrun.ts`, restore focus only when `lastInput === 'key'`, or call `focus({ focusVisible: false })` where it is supported. In `tip.ts` `focusin`, also require `lastInput === 'key'`.
- **Impact:** Medium. The game looks unfinished.
- **Effort:** S

### 10. Android back, or the back swipe, during a run leaves the game
- **Screens:** Run (wave, bench, run end).
- **Problem:** No `history.pushState`, `popstate` or `beforeunload` anywhere in `src/client` (grep). The run is not a history entry, so Android's system back gesture (which a page cannot cancel), the back button, or an iOS edge swipe that gets past the `touchstart` `preventDefault` goes back past the town. In the installed standalone PWA, it closes the app. The earlier critique listed this as "remaining 2" and it is still open.
- **Fix:** In `src/client/town/run.ts`, on run start call `history.pushState({ run: 1 }, '')`. A `popstate` during a run opens the pause panel (`setPaused(true)` through the mount API) and pushes the state again. Remove the handler and `history.back()` on run end. While a wave is running, add a `beforeunload` that asks first.
- **Impact:** High when it happens (a whole run lost), and it happens easily with the left thumb steering near the edge.
- **Effort:** S to M

### 11. Tip placement ignores the safe areas and the bottom edge
- **Screens:** Every tip, worst in landscape on notched phones and in a standalone PWA.
- **Problem:** `place()` clamps to `GAP = 8` px from the layout viewport. In landscape with a 47 px notch inset, a tip for a term near the left edge is placed at x 8 (measured: a tip for the stash pips landed at left 8, 320 px wide), so the start of the text sits under the notch. When it flips below (`top < GAP`), it never checks the bottom, so a tall tip (up to 112 px measured) for something near the top of a short landscape screen can run off the bottom or under the bench's sticky foot.
- **Fix:** In `theme.css`, define `:root{--sa-l:env(safe-area-inset-left,0px); --sa-r:...; --sa-t:...; --sa-b:...}`. Read these once in `tip.ts` with `getComputedStyle(document.documentElement)` and clamp with `GAP + inset`. After the flip, if `top + h > vh - GAP - insetBottom`, place it on whichever side has more room and cap `max-height` with `overflow:auto`.
- **Impact:** Low to medium.
- **Effort:** S

### 12. Bench foot: an irreversible "Wave n" at the bottom edge, with no guard for unspent scrip
- **Screens:** Bench, sticky `.g-foot`.
- **Problem:** The foot is 146 px of 667 (22%) on an SE, 172 of 844 on an iPhone 14 and 106 of 390 (27%) in landscape. Reroll and Wave n are 44 px tall, 10 px apart, with their bottom edge 8 px above the screen bottom when there is no inset. In Safari with the toolbar collapsed, a tap in the lowest band can raise the toolbar instead (earlier critique risk 4). "Wave n" starts the wave at once, even with 135 scrip unspent. Note: the foot's reason line and "You hold" row do leave about 90 px between the scrolling offers and the two buttons, so accidental taps from the list are not the problem.
- **Fix:** In `game.css` `.g-foot`, use `padding-bottom: max(12px, env(safe-area-inset-bottom))`. Move "Wave n" to the left end and Reroll to the right (a right-handed thumb rests bottom-right, and a reroll can be undone in practice while a new wave cannot), or swap only under `pointer: coarse`. In `bench.ts` `doNext`, when `p.scrip >= cheapest offer` and nothing was bought this bench, arm once ("Leave with 135 scrip? Press again"), with the 450 ms guard from finding 1.
- **Impact:** Medium.
- **Effort:** S

### 13. The HUD can never explain itself on touch
- **Screens:** Run HUD (weapon slot numbers, "3 left behind, x2", the elite bar), pause.
- **Problem:** `tip.ts` deliberately hides tips on `.g-hud` for touch, which is right during play. But the pause panel covers the HUD with a hatch and offers no way to read what the slot numbers or "left behind, x2" mean. A desktop player can hover over them.
- **Fix:** In `tip.ts`, skip the `.g-hud` rule while `.g-pause` is open (`document.querySelector('.g-pause:not([hidden])')`), and let taps on the hatch reach the HUD (`.g-pause { pointer-events: none }` and `.g-panel { pointer-events: auto }`). Or add a short legend row to the pause panel.
- **Impact:** Low to medium.
- **Effort:** S

### 14. Steppers: no hold-to-repeat, and x10 only with Shift
- **Screens:** Market (buy and sell quantities), town project (give 0 to n).
- **Problem:** The stepper buttons are 44x44 and the field 52x44, joined with 0 px gaps (deliberate, and acceptable for a single joined control). `bump()` adds 10 only with `ev.shiftKey`, which is keyboard and mouse only. Going from 0 to 64 timber takes 64 taps or typing in the field. The field correctly uses `inputmode="numeric"` at 18 px, but it has no `enterkeyhint="done"`, and focusing it selects the text, so the keyboard covers the stepper on a 667 px screen.
- **Fix:** In `src/client/town/dom.ts` `stepper()`, add press-and-hold repeat on `pointerdown` (400 ms delay, then every 80 ms, faster after 10 steps, stopped by `pointerup`/`pointercancel`/`pointerleave`). These buttons have no tip, so there is no conflict with `tip.ts`. Set `input.enterKeyHint = 'done'` and blur on Enter. The town project already has an `All` stamp; add `All` (max) next to the market sell stepper too.
- **Impact:** Low to medium.
- **Effort:** S

### 15. iOS text selection on tip words inside the run's sheets
- **Screens:** Bench, run end (both `.g-overlay`, which sets `user-select: text`), and town pages.
- **Problem:** `[data-tip]` sets `-webkit-touch-callout: none` but not `user-select: none`. On iOS, a long hold on a tip word (which already opened its tip at finger-down) starts text selection with the loupe over the tip. Android is protected by the `contextmenu` `preventDefault` in `tip.ts`; iOS does not send `contextmenu`.
- **Fix:** In `theme.css`, `.term, [data-tip]:not(input) { -webkit-user-select: none; user-select: none; }`.
- **Impact:** Low (iOS only). Not seen here, because there was no WebKit.
- **Effort:** S

### 16. Standalone PWA: the status bar keeps the town colour over a green run
- **Screens:** Run, installed app.
- **Problem:** `index.html` has a single `theme-color` `#d9d3bd` (Bone), the same in the manifest. During a run the screen is Spruce to the very top, so on Android, Chrome's toolbar and the standalone status bar stay as a pale Bone strip above a green clearing. There is no `apple-mobile-web-app-status-bar-style`, so iOS standalone uses its default bar. The manifest sets no `orientation`, which is right, since both orientations work. Measured: rotating mid-bench kept the reader on "Weapons, 6 of 6" (scrollTop 1400 to 915, scaled), and tips hide on `resize`.
- **Fix:** In `src/client/game/mount.ts` (or `town/run.ts`), on run mount set `document.querySelector('meta[name=theme-color]').content` to the Spruce value, and restore it on destroy. Optionally add `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`; the page and HUD already pad with `env(safe-area-inset-top)`.
- **Impact:** Low, but it is one of the "looks unprofessional" signals in the installed app.
- **Effort:** S

### 17. First-run copy addresses keyboards first on a phone
- **Screens:** Town first visit (`town0.png`: "You only move: WASD or the arrow keys, or drag anywhere on a touch screen.").
- **Problem:** `CONTROLS` in `src/client/town/words.ts` is the same for every device. The in-run teach line already switches on `coarse` (`mount.ts` line 410).
- **Fix:** Pick the text by device: "Drag anywhere to move. Weapons fire on their own." under `pointer: coarse`.
- **Impact:** Low.
- **Effort:** S

## What held from the earlier critique

- No live control under 44 px under a coarse pointer: 0 of 41 on the stash, 33 on the workshop, 41 on the market, 25 on the town page, 10 on daily, 8 on the almanac, and 27 on the bench.
- Text fields are 17 to 19 px (`.step-n` 18, `.field--num` 19, search 17). Steppers use `inputmode="numeric"`.
- Safe areas: with the insets emulated, the HUD starts at y 47 in portrait and x 47 in landscape, Pause is at the right inset, and the bench foot pads the bottom inset.
- Pause stays reachable throughout a wave: 64x44 at the top right, beside the weapon slots, with Sound and volume in the pause panel. That top-right spot is the hardest one to reach with one thumb, but it keeps the bottom of the screen clear for steering, and backgrounding pauses the game on its own, so it is the right trade.
- Still under 8 px, as before: tabs 3 to 4 px apart and the joined stepper. Neither is a real touch problem. The 0 px Tier up / Scrap pair (finding 3) is new.
