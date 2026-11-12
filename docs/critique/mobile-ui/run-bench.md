# Mobile critique: the run (in-wave HUD, bench, pause, run end)

Lens: a phone in portrait (375x667 SE, 390x844 iPhone, 360x780 Android) and landscape (844x390).
Benchmarks: Brotato mobile shop (one screen holds the decision: 4 offers, stats, weapon grid, Reroll / Go)
and Vampire Survivors / Survivor.io HUDs (one thin top band, small icons, the rest is playfield).

All pixel figures are CSS px, measured from the 2x screenshots in `shots/` (halved).

---

## 1. Verdict

The in-wave HUD stacks three full rows of slips (health + level, counters + bank, weapon slots + Pause)
that reach **149 px of 667 (22%)** on an SE in wave 1. When an elite arrives the bar and the three-line
card push it to **264 px (40%)**, and the stag is half under the card (`se-21`, `ip-21`). In landscape the
top band is **118 of 390 px (30%)**. With an elite, the bar and card at the foot take another 82 px, so
**about 51% of the screen height** is furniture. Vampire Survivors uses about 8 to 10%.

The bench is a long document, not a decision screen. After wave 6 it is **2317 px tall in a 667 px view.**
The sticky footer takes 146 px (22%) and the page head another 142 px (21%), so the scroll area is about 380 px
and the bench is **about 4.4 screens of scroll** (5.9 in landscape: 1739 px in a 296 px window).
At the fold you see 2.3 of the 4 upgrade picks. While you choose, the stats are 2.5 screens down, the weapons
3 screens down and the items 3.5 screens down. On touch, the stat-delta preview only runs on hover, so you never see it.
On a phone, the weapon rows overflow the right edge and their **Scrap button cannot be reached at all**.

---

## 2. Proposed mobile bench

Principle (from Brotato): **one screen shows the decision; secondary info sits one tap away, never a scroll away.**
The ledger identity stays: bone sheet, 3px/1px rules, Zilla Slab, cut-corner stamps, Ochre and Madder only as accents.

### 2a. Portrait, 375x667

```
+-----------------------------------------------+
| BENCH 6/12   (o)140 [t]7 <o>0 {h}7       [=]  |  44 px sticky top bar (.g-top)
+===============================================+  heavy rule
| <3 44  [] 2  >3%  /3  >>18%  <>5%  <->35      |  28 px stat ribbon (.g-ribbon), wraps to 2 lines max;
|          ^ "+5" chip appears on the selected card's stat   shows deltas for the selected card
+-----------------------------------------------+
| Level 8: pick one                (1 owed)     |  24 px h2, 17 px
| +--------------------+ +--------------------+ |
| |[32] +5 Luck   I... | |[32] +10% Rate II.. | |  2x2 pick tiles, ~84 px each;
| | 0 -> 5             | | 18% -> 28%         | |  whole tile is the button (>=44 px)
| | rare offers x1.05  | | attack speed x1.28 | |
| +--------------------+ +--------------------+ |
| +--------------------+ +--------------------+ |
| |[32] +10% Dodge ... | |[32] +2 Ranged  I...| |
| +--------------------+ +--------------------+ |
|                                               |
|  (after the pick, the same 2x2 area holds the |
|   offer cards, see 2c)                        |
+-----------------------------------------------+
| [Weapons 5/6] [Items 5] [Anvil] [Mule]        |  44 px index tabs (.tabs from theme.css)
|  [S][S][S][B][W][ ]   6 slots, 48 px squares  |  tab panel, about 120 to 200 px visible,
|  tap a slot -> one action row:                |  scrolls on its own if longer
|  Sling II  12 dmg/0.8s  [Tier up o49][Combine][Scrap o8]
+-----------------------------------------------+
| NO  You need 6 more scrip.                    |  reason: 26 px, one line, only when not empty
| [ Reroll  (o)4 ]          [ Wave 7  > ]       |  52 px: two 48 px stamps
+-----------------------------------------------+
```

Budget at 667: top bar 44 + ribbon 28 to 50 + h2 26 + 2x2 picks or offers 2x84 = 168 (picks) or 2x150 = 300 (offers)
+ tabs 44 + panel 120 or more + footer 52 to 78 = **all fits without page scroll**. On SE, after a pick, the offers grid plus the
footer take ~520 px. The tab panel gets the rest and scrolls inside itself. The page itself does not scroll.

### 2b. Landscape, 844x390

```
+------------------------------------------------------------------------------------------+
| BENCH 6/12 | (o)140 [t]7 <o>0 {h}7 |  Level 8: pick one                            [=]  |  36 px
+----------------------+-------------------------------------------------------------------+
| <3 Max HP ....... 44 | +-----------+ +-----------+ +-----------+ +-----------+           |
| [] Armor ......... 2 | |[32] +5    | |[32] +10%  | |[32] +10%  | |[32] +2    |  4 cards  |
| >  Speed ........ 3% | | Luck  I...| | Rate II.. | | Dodge III.| | Ranged I..|  in a row |
| /  Ranged ........ 3 | | 0 -> 5    | | 18->28%   | | ...       | | 3 -> 5    |  ~190 px  |
| >> Rate ........ 18% | |           | |           | |           | |           |           |
| <> Crit ......... 5% | |  [Take]   | |  [Take]   | |  [Take]   | |  [Take]   |           |
| <-> Reach ....... 35 | +-----------+ +-----------+ +-----------+ +-----------+           |
|----------------------|  [Weapons 5/6] [Items 5] [Anvil] [Mule]   <- tabs open a sheet   |
| [S][S][S][B][W][ ]   |                                                                   |
+----------------------+-------------------------------------------------------------------+
| NO You need 6 more scrip.                         [ Reroll (o)4 ]   [ Wave 7 > ]          |  52 px, one row
+------------------------------------------------------------------------------------------+
```

Left rail 220 px: compact stats (22 px rows) and the weapon slot grid. These were the off-screen pieces in portrait.
Right: four cards in one row (as in Brotato). Items, Anvil and Mule open as a sheet over the right area (a `.g-sheet` with its own
scroll and a Close stamp). Footer: one row, reason on the left, buttons on the right.

### 2c. Compact offer card (portrait half-width, about 165 px wide, about 150 px tall)

```
+---------------------------+
|[32] Sling        I I . .  |  name 16px bold, tier pips; lock mark if locked
|WEAPON, SHOT       [lock]  |  .kind 11px caps; lock = 44x44 icon toggle in the corner
|- 12 dmg / 0.80 s, r 160   |  effects 14px, clamped to 2 lines (line-clamp)
|- You hold 2: +10% each    |  the "twin" line keeps its Ochre mark
|(o)24 [t]3        [ Buy ]  |  price 16px; Buy 44 px stamp
+---------------------------+
```

- Tapping the card body (not Buy) selects it: heavy 3px Ink frame, the stat ribbon shows its deltas (`preview()`),
  and the 2-line clamp opens to the full text. This is the touch replacement for hover. Tapping again or another card deselects it.
- A sold card keeps its strike-through and drops to 50% height ("Sling, bought").
- The numbered `.g-key` chips already hide on `pointer: coarse`; desktop keeps the current ruled row layout.

### 2d. Where stats / weapons / items live

| Info | Portrait | Landscape | Desktop (>=900) |
|---|---|---|---|
| Stats | always-visible ribbon (non-zero stats, shows deltas) | left rail, 22 px rows | unchanged side column |
| Weapons | tab: 6-slot grid, tap slot for action row | left rail grid + action row | unchanged ledger |
| Items | tab: 48 px icon grid with count badges, tap for effects + Scrap | sheet | unchanged |
| Anvil, Mule | tabs | sheets | unchanged sections in main |

Footer: **52 px** of buttons, plus a **26 px** reason line only when it says something. Held resources move to the top bar.
That is 8 to 12% of an SE, down from 22%.

---

## 3. Ranked findings

### 1. The bench is 4.4 screens of scroll, and the decision is spread over it
- **Screens:** `se-23-bench-6-fold`, `-scroll1..4`; `ip-23-*`; `and-23-*`; `land-23-*`; index.txt (2317 / 2265 / 2330 / 1739 px).
- **Problem:** `render()` in `bench.ts` builds one long column: head, then picks or offers, then anvil, then mule, then `sideColumn()` (stats, weapons, items).
  `.g-cols` is a single column below 900 px (`game.css`, `@media (min-width: 900px)`), so everything stacks.
- **Fix:** add a mobile "dock". In `render()`, wrap the anvil, mule, weapons and items sections in
  `<div class="g-dock" data-tab="weapons">` with a `.tabs` row (the theme already has `.tab`). Keep `openTab` in the closure so it survives `render()`.
  CSS under `@media (max-width: 899px)`:
  `.g-bench{overflow:hidden}`, `.g-page{display:flex;flex-direction:column;height:100%;min-height:0}`,
  `.g-dock{flex:1 1 auto;min-height:0;overflow-y:auto}`, and `.g-dock[data-tab=items] > :not([data-panel=items],.tabs){display:none}` (and the same for each tab).
  At 900 px and up the tabs are `display:none` and every panel shows, so desktop does not change.
- **Impact:** very high. The bench decision fits on one screen.
- **Effort:** L

### 2. Weapon actions overflow the screen, so Scrap (and sometimes Combine) cannot be reached on phones
- **Screens:** `se-23-bench-6-scroll2`, `and-23-bench-6-scroll2`: the Tier up / Combine / Scrap stamps are cut off at the right edge.
- **Problem:** `sideColumn()` puts up to three stamps in `td.act`. `.ledger .act{white-space:nowrap;width:1%}` (`theme.css`) forces them onto one line, the table grows wider than 375 px, and `.g-bench{overflow-x:hidden}` clips them. This is a real functional bug, not only a looks issue.
- **Fix (quick):** `@media (max-width:620px){ .g-side .ledger tr{display:grid;grid-template-columns:minmax(0,1fr) auto} .g-side .ledger td.act{grid-column:1/-1;white-space:normal;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;width:auto;padding-bottom:8px} }`.
  **Fix (target):** the weapon slot grid with one action row under it (finding 6).
- **Impact:** very high, because the feature is broken on mobile.
- **Effort:** S (quick fix) / M (grid)

### 3. Upgrade picks: four 140 px rows with a centred Take button on its own line
- **Screens:** `se-22-bench-1-fold`, `se-23-bench-6-fold`, `se-25` (2.3 of 4 picks above the fold); `land-23-bench-6-fold` (2 of 4).
- **Problem:** `upgradesSection()` reuses `.offer`. Below 620 px, `theme.css` moves `.offer .buy` to its own full-width row, and `.g-pick .buy{justify-content:center}` centres a lone "Take". The 64 px stat icon and 19 px name add more height.
- **Fix:** add a `@media (max-width:899px)` block in `game.css`:
  `.g-picks{display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:0}`,
  `.g-pick{grid-template-columns:32px minmax(0,1fr);border:var(--rule) solid var(--ink);padding:8px;gap:2px 8px}`,
  `.g-pick > canvas.icon{width:32px;height:32px}`, `.g-pick .name{font-size:16px}`, `.g-pick .effects{font-size:14px}`.
  Make the whole `li` the hit target: in `upgradesSection()`, wrap the contents in the `Take` button, or add `li.addEventListener('click', ...)` and hide `.buy` on coarse pointers.
  In landscape (`(min-width:621px) and (max-height:520px)`): `grid-template-columns:repeat(4,1fr)`.
  Rewrite the effect line as `0 -> 5` plus a short meaning.
- **Impact:** high. All four picks show at once (about 180 px instead of 560 px).
- **Effort:** M

### 4. The sticky footer takes 22% of the screen and repeats itself
- **Screens:** every bench shot; `se-23-bench-6-fold` footer = 146 px; `land-23-*` = 94 of 390 px (24%).
- **Problem:** `.g-foot` stacks three rows: a reason notice that wraps to 2 lines (`.g-reason`, `.notice .tag` block), a "You hold" row, and two 44 px stamps. While picks are owed, the line "Take your upgrade first. The offers and the next wave wait for it." repeats the section heading, and both stamps are already struck through.
- **Fix:**
  - (a) Move `.g-held` out of the footer into the new top bar (finding 5) on `max-width:899px`.
  - (b) `.g-reason .text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px}` and `.g-reason{min-height:26px}` on mobile.
  - (c) In `render()`, use a shorter waiting text, "Pick an upgrade first.", or none, because the struck stamps carry the meaning.
  - (d) In landscape, put the reason and the buttons in one row: `@media (max-height:520px){.g-foot{display:flex;align-items:center;gap:12px}.g-reason{flex:1 1 auto;border:0}.g-foot-row{padding-top:6px}}`.
  - Buttons: `.g-foot-acts .stamp{min-height:48px}`.
- **Impact:** high. The footer drops from 146 px to 52 to 78 px.
- **Effort:** S

### 5. The bench page head uses 142 px (21%) on a title and a volume slider
- **Screens:** `se-23-bench-6-fold`, `se-22-bench-1-fold` (Pause, Sound and volume in a boxed second row); `land-23-*` (102 px of 390).
- **Problem:** `render()` builds `.page-head` with a label, the 30 px `h1` "Bench", and `soundControls(true)` plus a Pause stamp. `theme.css .page-head` adds `padding:18px 0 8px` and `margin-bottom:14px`. The sound controls duplicate the pause panel, which the HUD already relies on (`@media (pointer: coarse)` hides `.g-snd .mute/.vol`).
- **Fix:** add `@media (max-width:899px)`: `.g-bench .page-head{position:sticky;top:0;z-index:2;background:var(--bone);padding:6px 0;margin:0;flex-wrap:nowrap}` and `.g-bench .page-head h1{font-size:19px}`. Render the label and h1 inline as "Bench 6/12".
  Add `.g-bench .page-head .meta .sound .mute, .g-bench .page-head .meta .vol{display:none}` on `pointer:coarse`. Keep a single 44x44 Pause / menu stamp.
  Put `.g-held` (scrip and raws, 15 px, 20 px icons) in the head (finding 4a).
- **Impact:** high. The head drops to 44 px and resources stay in view during the whole decision.
- **Effort:** S

### 6. Stats, weapons and items are not visible while you choose, and the stat preview does nothing on touch
- **Screens:** `se-23-bench-6-scroll2..4` (stats about 1050 px down, weapons about 1350 px, items about 1750 px).
- **Problem:** the preview (`watch()` -> `preview()`) uses `pointerenter` and `focusin`. On touch, these fire only when you tap, and the effect lands in `.stats` rows 2 screens away. Brotato keeps stats and weapons on screen beside the shop.
- **Fix:**
  - (a) Add a stat ribbon: in `sideColumn()`, also emit a `.g-ribbon` (same `statDelta` spans, icon 16 px + figure, `display:flex;flex-wrap:wrap;gap:2px 10px;font-size:15px`) placed in `render()` directly under the head. Show it only `@media (max-width:899px)` and hide `.stats` there.
  - (b) On touch, a tap on a card body sets `selected = key` and calls `preview()`, so the ribbon shows "+5" chips. Clear the selection in `act()`.
  - (c) Weapons tab: a `.g-wgrid` of `weaponSlots(run)` 48 px squares (icon, tier pips, empty slots dashed). Tapping a square sets `wSel` and renders one action row (Tier up / Combine / Scrap) under the grid. Items tab: the same idea, a 48 px grid with an `xN` badge.
- **Impact:** very high. This is the core of the "hard to see details" complaint.
- **Effort:** M to L

### 7. Offer cards are full-width ruled rows of about 170 px each, about 800 px for 4 to 5 offers
- **Screens:** not captured (all bench shots have picks owed, so `offersSection()` is replaced). Estimated from `theme.css .offer` at 620 px and below: 64 px icon column, 19 px name plus a `.kind` line, 2 to 3 effect lines, and a full-width buy row with Lock and Buy.
- **Problem:** the decision cannot be compared side by side, and only about 2 offers fit in the scroll window.
- **Fix:** add `@media (max-width:899px)`: `.offers:not(.g-picks){display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:0}` and `.offer{grid-template-columns:32px minmax(0,1fr);border:var(--rule) solid var(--ink);padding:8px}`.
  Also: `.offer > canvas.icon{width:32px;height:32px;grid-row:auto}`, `.offer .name{font-size:16px}`, and `.offer .effects{font-size:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}` (removed on `.is-selected`).
  Then `.offer .buy{grid-column:1/-1}` and `.offer .buy .note{display:none}`; the "Short of raws" note moves to the Buy refusal line.
  In `offersSection()`, render Lock as an icon-only 44x44 `stamp--plain` (`aria-label` "Lock") in the card's top-right corner.
  Landscape: `repeat(4,1fr)` (or `repeat(5,1fr)` when there is a commission card).
  A locked offer currently uses `border-left:6px` (`.offer.is-locked`). In a card, use a thicker full frame or an Ochre corner tab instead.
- **Impact:** high
- **Effort:** M

### 8. The portrait HUD stacks 3 rows of slips (22% of the screen), and the weapon slots get a row of their own
- **Screens:** `se-20-run-wave1-first` (149 px), `ip-21`, `and-21`.
- **Problem:** at 620 px and below, `game.css` lays out `'tl tc' / 'tr tr' / 'sl bk' / 'mid mid'`. The HP slip has a separate `.g-lv` row (level label + 10 px XP meter). The counters plus the italic `.g-bank` "3 left behind, x2" take a 36 px row. The slots and Pause take a 42 px row.
- **Fix:** add `@media (max-width:620px)`:
  - Fold the level into the HP slip: `.g-lv{border:0;padding:0;height:5px}` with the label hidden, and the XP as a 5 px Ochre strip under the HP bar. Put "L7" inside `.hp .num`, or show the level as a small `.g-owed`-style chip.
  - `.hud.g-hud .wave .label{font-size:10px}`, `.wave .time{font-size:18px}`.
  - Row 2: counters (`icSized(..., 20)` in `buildCounters()` on narrow screens, `.counter{font-size:14px}`), then the weapon slots on the same row, right-aligned: `grid-template-areas:'tl tc bk' / 'tr tr sl' / 'mid mid mid'`.
  - Pause becomes a 44x44 icon stamp in the top-right corner (`bk`).
  - `.g-bank` becomes a tooltip on the scrip counter, or a 12 px suffix.
  - Target: **about 84 px (12.6%)**.
- **Impact:** high. More playfield, and enemies coming from the top stay visible.
- **Effort:** M

### 9. The elite card plus bar push the portrait HUD to 40% and cover the elite
- **Screens:** `se-21-run-wave6`, `ip-21-run-wave6`. The card runs from 190 to 264 px, and the stag's head is under it.
- **Problem:** `.g-card` is full width, with a 21 px title and a 15 px sub that wraps to 2 lines (`@media (max-width:620px)` in `game.css`). The separate `.g-elite` bar sits above it. `hud.insets()` does not count `cardEl`, so the camera does not make room for it.
- **Fix:** add `@media (max-width:620px)`:
  - `.g-card-title{font-size:16px}`, `.g-card-sub{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`, `.g-card-body{padding:2px 8px}`.
  - Merge the bar into the card while an elite lives: in `hud.ts`, append `elite` inside `.g-card-body`, or hide `.g-elite .label` when the card is up, since the card already names it.
  - Shorten the card's time on screen for elites (call `card(..., seconds)` with 2.5 s).
  - Add `cardEl` to the `insets()` list.
  - Target: the elite band is **at most 52 px**.
- **Impact:** high. Elites are the moment when you most need to see.
- **Effort:** S to M

### 10. The landscape HUD top band is 30% of the height
- **Screens:** `land-20-run-wave1-first`, `land-21-run-wave6` (118 of 390 px). The elite card and bar at the foot add 82 px more.
- **Problem:** the `(min-width:621px) and (max-width:960px)` grid gives slots their own row (`'sl sl bk'`). HP and level take 2 rows. The wave box is 2 lines with a 28 px time. The counters and bank stack in `.g-tr`.
- **Fix:** add `@media (min-width:621px) and (max-height:520px)`:
  - One top row: `grid-template-areas:'tl sl tc tr bk'`, with slots beside the HP.
  - `.wave` on one line: `.wave{display:flex;gap:8px;align-items:baseline}` and `.wave .label{border:0}`, so it reads "WAVE 6/12 0:40" at 20 px.
  - The XP strip goes inside the HP slip, as in finding 8.
  - At the foot: `.g-mid{flex-direction:row}` so the card and the elite bar sit side by side, one line of 34 px.
  - Target: a top band of **about 48 px (12%)** and a foot band of **34 px**.
- **Impact:** high for landscape players
- **Effort:** M

### 11. Landscape bench stays a single column at 844 px
- **Screens:** `land-23-bench-6-fold` to `scroll4` (5.9 screens of scroll); `land-22` (1002 px).
- **Problem:** `.g-cols` only becomes two columns at `min-width:900px`. An 844 px landscape phone has the width for it, but not the height.
- **Fix:** add `@media (min-width:621px) and (max-height:520px){ .g-cols{grid-template-columns:220px minmax(0,1fr);height:calc(100dvh - 36px - 52px)} .g-main,.g-side{overflow-y:auto;min-height:0} }`.
  Use `order:-1` on `.g-side` to put the stats and weapon grid in a left rail. `.stats > div{min-height:22px;font-size:14px}`. `.g-side` sections other than stats and weapons go to the dock (finding 1).
- **Impact:** high in landscape
- **Effort:** M

### 12. The landscape pause panel is clipped at the top and bottom
- **Screens:** `land-24-pause`: the panel starts at y=0 with no top rule, and "Quit" sits at the screen edge.
- **Problem:** `.g-pause{display:flex;align-items:center;overflow-y:auto}`. The panel (about 420 px) is taller than 390 px, so flex centring pushes it past the top, where it cannot be scrolled to (the classic centring overflow).
- **Fix:** `.g-pause{align-items:safe center}`, or `.g-panel{margin:auto}` with `align-items:flex-start`.
  Add `@media (max-height:520px){ .g-panel{width:min(560px,100%);display:grid;grid-template-columns:1fr 1fr;gap:0 16px} .g-panel h2{grid-column:1/-1;font-size:22px} .g-panel-rows{display:contents} }`, so Resume and Sound sit in column 1 and the toggles in column 2.
- **Impact:** medium. The panel is broken in landscape.
- **Effort:** S

### 13. The anvil takes about 330 px in the main flow, even when it cannot be used
- **Screens:** `se-23-bench-6-scroll1`: the intro note, two item stamps on separate lines, First/Second empty slots of 44 px each, the "cost shows" note, and Strike.
- **Problem:** `anvilSection()` always renders in `.g-main`, between the decision and the player's build. It is a secondary action that pushes stats and weapons down.
- **Fix:** move it into the dock as the "Anvil" tab (finding 1). The tab label shows a dot when 2 or more items are eligible.
  Inside it, on mobile: `.g-anvil-slot{min-height:36px}`, and put the two slots on one row with `display:grid;grid-template-columns:1fr 1fr`. `.g-anvil-picks .stamp{min-height:44px}` stays.
- **Impact:** medium
- **Effort:** S (once the dock exists)

### 14. Item rows: long effect text wraps to 4 lines, and the KIT tag wraps under the name
- **Screens:** `se-23-bench-6-scroll3` (Bone bucket: 4 lines); `and-23-bench-6-scroll2` (the KIT tag drops to its own line at 360 px).
- **Problem:** `sideColumn()` items table: `.g-sub` shows every effect joined, with no clamp. The `.g-item-name` flex row wraps.
- **Fix:** in the Items tab, use the 48 px icon grid (finding 6c). Or, as a quick fix: `@media (max-width:620px){ .g-items .g-sub{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden} .g-tag{font-size:10px;padding:0 3px} }`, and tap the row to expand it.
- **Impact:** medium
- **Effort:** S

### 15. The stat list is one column of 34 px rows below 420 px
- **Screens:** `se-23-bench-6-scroll2` (7 rows, about 240 px). `land-23-bench-6-scroll2` uses 2 columns but with 34 px rows.
- **Problem:** `theme.css` only sets `column-count:2` for `(min-width:420px) and (max-width:899px)`. The 375 and 360 px phones get one tall column.
- **Fix:** on mobile the ribbon (finding 6a) replaces the list. If the list is kept anywhere, use `@media (max-width:419px){ .g-bench .stats{column-count:2;column-gap:12px} .g-bench .stats > div{min-height:26px;font-size:15px} .g-bench .stats dd{font-size:15px} }`, scoped to `.g-bench` so town pages do not change.
- **Impact:** medium
- **Effort:** S

### 16. Too many type sizes: 19 to 30 px headings and 17 px body make the bench read like a document
- **Screens:** all bench shots: h1 "Bench" 30 px, h2 21 px, `.offer .name` 19 px, `.price` 19 px, body 17 px, `.stats dd` 18 px.
- **Problem:** these are desktop reading sizes, and each block also carries a 3px rule and 22 px top margin (`.g-bench .section{margin-top:22px}`). On phones, Brotato-style game UIs use 13 to 16 px for detail text and 16 to 18 px for names.
- **Fix:** add one `@media (max-width:899px)` "dense" block scoped to `.g-bench` and `.g-end`: `font-size:15px`; `h2:16px`; `.offer .name:16px`; `.price:16px`; `.section{margin-top:12px}`; `.section > h2{padding-bottom:3px}`; `canvas.icon` in rows at 24 to 32 px through `icSized` (in `upgradesSection()`, `offersSection()` and `sideColumn()`, choose `icSized(..., 32)` when `matchMedia('(max-width:899px)')` matches). Touch targets stay at 44 px through the existing `pointer:coarse` rule in `theme.css`.
- **Impact:** medium. This drives most of the "gigantic elements" impression.
- **Effort:** S

### 17. The mule section is another full table in the main flow
- **Screens:** not in the wave-6 shots (no mule at that bench). From `muleSection()`: an intro note, a 4-column ledger with -/+/All steppers, and a footer note.
- **Problem:** this is the same scroll cost as the anvil, and the stepper stamps (`.g-steps`, 3 per row, `nowrap`) risk the same overflow as finding 2 at 360 px.
- **Fix:** make it a dock tab. On 620 px and below, `.g-mule .ledger td.act .g-steps{gap:2px}`, steppers as 44x44 icon stamps (`-`, `+`), and drop "All", or move it to a long press.
- **Impact:** medium
- **Effort:** S

### 18. The run-end screenshot was not captured, and the code needs a check
- **Screens:** `se-25-run-end` actually shows a bench after wave 4 (the capture failed). There is no `land-25`.
- **Problem:** I cannot judge it visually. From `end.ts` `render()`: the same `.page-head` (30 px h1) and a `.ledger g-items` "Carry" list (the same 4-line effect text as finding 14), with a `.g-foot` holding "Carrying N of M" and "Head home". This structure is fine (one `.act` stamp per row, so no overflow), but it inherits findings 5, 14 and 16.
- **Fix:** apply the dense block and the line clamp to `.g-end` as well. Re-shoot `25` at all sizes.
- **Impact:** low to medium
- **Effort:** S

### 19. The HUD Pause stamp is a text stamp on its own grid row
- **Screens:** `se-20`, `se-21` (Pause, 64x44, sits at the right of the slot row and keeps that row tall).
- **Problem:** `@media (pointer: coarse)` moves `.g-snd` into `bk` and keeps `min-width:64px`.
- **Fix:** use a 44x44 square stamp with a two-bar pause glyph (drawn in Ink, so the identity stays) and `aria-label="Pause"`, placed in the top-right grid cell (finding 8). The 44 px target is kept.
- **Impact:** low to medium (part of the HUD height)
- **Effort:** S

---

## Top fixes in priority order

1. Fix the weapon-row overflow so Scrap and Combine can be reached on phones (S): a grid row with wrapping `.act`.
2. Change the bench into one screen: a 44 px top bar with the resources, a 2x2 grid of picks and offers (4 across in landscape), a tabbed dock for Weapons, Items, Anvil and Mule, and a 52 px footer (the footer and head go from 288 px to about 96 px).
3. Add a stat ribbon that is always visible, and a tap-to-select preview that shows stat deltas on touch.
4. Compress the HUD to about 84 px in portrait and 48 px in landscape: fold the XP into the HP slip, put the slots beside the counters, use a square Pause stamp, and make the elite card one line that `insets()` counts.
5. Landscape: two-column bench at `max-height:520px`, and fix the pause panel clipping with `align-items: safe center`.
