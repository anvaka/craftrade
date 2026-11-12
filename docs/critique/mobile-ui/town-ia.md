# Town pages on a phone: information architecture and navigation

Critic lens: what is reachable without scrolling, how you move between tabs, what order sections come in, and what folds away. Run and bench screens are out of scope.
Evidence: `shots/se-*`, `ip-*`, `and-*`, `land-*` (01-12), `index.txt`; code in `src/client/town/*.ts`, `town.css`, `ui/theme.css`.
All pixel figures are CSS px (screenshots are 2x). "Screens" means page height divided by viewport height.

## 1. Verdict

On a 375x667 phone the page head (account label, name, holdings, a boxed Sound slider) and the tab bar, which wraps to two lines, take **297 of 667 px, or 45% of the first screen**. At 360x780 the six tabs also wrap, with Daily and Almanac on the second line (`and-03b`). The tabs then scroll away with the page, so changing tab from deep in a list means scrolling back up through up to 9 screens.

Page heights at 375x667:

| Tab | Height | Screens |
|---|---|---|
| Stash (18 items) | 5122 px | 7.7 |
| Workshop | 3611 px | 5.4 |
| Market | 3321 px | 5.0 |
| Town | 1248 px | 1.9 |
| Daily | 850 px | 1.3 |
| Almanac | 6461 px | 9.7 |

Where each primary action sits:

| Action | Position | Reachable without scrolling? |
|---|---|---|
| Head out | y = 390 to 435 | Yes, barely |
| Pack | Stash rows start at y ≈ 1525 | No, 2.3 screens down, and only reachable by leaving Head out behind |
| Strike | y ≈ 957 | No, 1.4 screens down (`se-06b`) |
| Give | y ≈ 875 | No, below the "With marks" block (`se-09`) |
| Sell 10 / Buy 10 for timber | Fits | Yes, but ore and hide do not |
| Salvage | First one at y ≈ 1210 | No |

The page is laid out like a desktop ledger narrowed to a phone width, which is why it reads as unprofessional. Every section is fully expanded, cards are 120 to 190 px tall, and nothing is collapsed, docked or sticky.

## 2. Proposed mobile structure (applies at max-width 699px; desktop untouched)

### Header: one compact line, 48 px, sticky

```
┌────────────────────────────────────────────┐
│ Tyler 353  ▌258 ▌384 ▌264 ▌192        [♪]  │  48px, bone, 3px ink foot rule
└────────────────────────────────────────────┘
```
- Drop the "Scrip. Solo account of" label on phones. Keep the ochre `.own` name at 20 px; it is the identity mark.
- Keep the holdings `.counters` at 15 px figures with 20 px icons. Make the whole header `position: sticky; top: 0` so marks and raws stay visible while you spend them on Workshop, Market and Town. Today you must scroll to the top to check whether you can afford a strike.
- Sound becomes a single square mute stamp (44x44, speaker glyph or "♪", struck through when muted). Move the volume slider to the Account section or to a long-press popover. The slider row alone costs 58 px.
- Keep the double rule (3 px plus hair) under the header.

### Navigation: bottom index bar, six slots

```
┌──────┬──────┬──────┬──────┬──────┬──────┐
│Stash │Work- │Market│ Town │Daily │Alma- │  56px + safe-area, ink ground,
│  18  │ shop │      │      │  •   │ nac  │  open tab cut from bone (stamp corner)
└──────┴──────┴──────┴──────┴──────┴──────┘
```
- At 360 px six slots are 60 px each. Use 12 px bold caps labels (the `.label` style) with a 22 px icon above. Sprites already exist: a stash crate, an anvil, the marks ticket, the sawmill station icon, the daily character, a book. With icons, "Workshop" can be shortened to "Shop" or "Anvil", and "Almanac" to "Book".
- This keeps the ledger identity: the open tab is the bone sheet with the 7.5 px cut corner, notched upward, and the others are ink, which is exactly the current `.tab` treatment turned over. A badge dot (ochre square) on Daily when today is not yet run, and on Workshop when untried pairs are left.
- First visit (only Stash open, `se-01b`): hide the bar entirely. A one-tab bar is 60 px of nothing.
- Rejected alternative: a single horizontally scrolling row of top tabs. It still scrolls away with the page, and it hides Almanac off-screen. The bottom bar is the convention in Marvel Snap, Clash Royale and most mobile web apps: thumb reach, always visible, and switching tab never needs scrolling up.
- Landscape (`land-*`, 844x390): the current single-row top tabs fit (`land-03b`, header and tabs take 135/390 px). Keep the top tabs there; apply the bottom bar on `(max-width: 699px)` only, or on `(max-height: 500px)` with the header made non-sticky.

Chrome budget: 48 px header + 56 px bar = **104 / 667 = 16%**, against 45% today.

### Sticky primary action: a "dock" over the bottom bar

One ruled line, 56 px, that sits above the nav and holds the tab's main action plus a summary of it:
- **Stash:** `Greenhorn · Lead shot + Rain cape · hz 0   [Head out]`
- **Workshop** (both slots filled): `52 pts ▌▌▌ · 90 marks 15/12/9   [Strike]`. With 0 or 1 items on: `Put 2 items on the anvil`, no button.
- **Town** (any raw stepped above 0): `Give 40 timber, 10 ore   [Give]`
- **Market** and **Almanac:** no dock. Their actions sit on each row.
- **Daily:** `[Scored attempt] [Practice]`

### Per-tab mobile order

**Stash**
1. Next run bar (name, kit, Head out; in the dock once scrolled).
2. Who heads out as a single row of six 52 px portrait chips. The selected one is inked, locked ones are silhouettes with a small "2" runs-left badge. The selected character's name and twist go on one line under the row. This is about 130 px instead of 600.
3. Hazard squares, inline, as today.
4. Daily: one line, `Today's clearing: Trapper, not yet run →`, which opens the Daily tab. The two stamps live there.
5. Stash, as compact rows (see F5). Group duplicates ("Rain cape ×3"). Packed items sort to the top. The shelf line and the "Pack up to 2" note collapse into one `17/24 shelves · 0/2 packed · [?]` line.
6. Account moves out: name, world and switches go to an Account section at the bottom of Almanac (or a sheet behind the header name). Totals go to Almanac's records.

**Workshop**
1. The anvil as two 56 px slot lines plus an outcome line. The 4-line explainer becomes a `[?]` tip.
2. Strike in the dock.
3. The chooser table (In the stash / Tier / Pair / Put on) stays open.
4. "Pairs in your stash", collapsed by default: `Pairs: 0 of 66 tried ▸`.
5. Codex, collapsed: `Codex: 0 recipes ▸`, with Find inside.
6. Relics, collapsed to `Relics: 0 of 8 found ▸`. Never draw 8 empty underlined rows.

**Market**
1. A Raw segmented control `[Timber][Ore][Hide]`, with one Factor card under it (hold, pays, asks, stepper, Sell, Buy). This is about 200 px instead of 590.
2. Sell from your stash: compact rows of icon, name, tier, salvage value and a Salvage button on one line, with effects in the tooltip. Group duplicates.
3. Shared town only: Raws between players and Listings, each collapsed with counts.

**Town**
1. Project title.
2. Three raw rows.
3. Give bar, moved directly under the rows.
4. "With marks" fund row, collapsed: `Pay the Factor instead ▸`.
5. Stations.
6. Who gave (shared town only).

**Daily:** no change in order. It is already 1.3 screens.

**Almanac**
1. Records as a 2-column grid of compact meters (label, then figure over a 10 px meter). This is about 300 px instead of 600.
2. Hazard ladder.
3. Titles: earned first, unearned collapsed (`12 more titles ▸`).
4. Words, collapsed behind a Find field. Typing filters the rows, and the first open shows A to Z without the full 60-row table.

### Wireframe: Stash tab, 375x667, welcome (after 6 runs)

```
┌───────────────────────────────────────────────┐ 0
│ Tyler 353 ▌258 ▌384 ▌264 ▌192            [♪] │
╞═══════════════════════════════════════════════╡ 48
│ Next run                                      │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Greenhorn, no kit.  12 waves · ~13 min        │
│ HAZARD 0  [■0][ 1][▨2][▨3][▨4][▨5]  13 pts ?  │ 150
│ Today's clearing · Trapper · not yet run   →  │ 186
│                                               │
│ Who heads out                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ [▣Grn][Saw][Smi][▒Trp¹][▒Tnk²][▒Clk³]         │ 52px chips
│ Greenhorn · Plain kit and no favours.         │ 330
│                                               │
│ Stash   17/24 · 0/2 packed      [+Shelf] [?]  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ◎ Lead shot ▌▯▯▯  +3 Ranged…      ■■■ [Pack]  │ 64px row
│ ◡ Prospector pan ▌▌▯▯ 18% double… ■■■ [Pack]  │
│ ✶ Rain cape ×3 ▌▌▯▯  +9% Dodge…   ■■■ [Pack]  │
│ ⟋ Promissory note ×3 ▌▌▯▯ +6%…    ■■■ [Pack]  │ 555
├───────────────────────────────────────────────┤
│ Greenhorn · no kit · hz 0        [ Head out ] │ dock 56
├──────┬──────┬──────┬──────┬──────┬──────┤
│▣Stash│Anvil │Market│ Town │Daily•│ Book │ nav 56
└──────┴──────┴──────┴──────┴──────┴──────┘ 667
```
First screen now shows the run setup, the character choice, four stash rows and Head out. Today it shows the head, the tabs, Head out, the hazard row and half a daily line.

## 3. Ranked findings

**F1. The tab bar wraps to two lines and scrolls away**
- **Screens:** `se-03b`, `se-05`, `se-08`, `and-03b` (Daily and Almanac on line 2), `ip-03b`.
- **Problem:** six ink tabs at 14.5 px with 44 px min-height wrap (`town.css` `@media (max-width:520px) .tabs {flex-wrap:wrap}`), which costs 107 px. Because they are not sticky, switching tab from the 18th stash row means scrolling 7 screens up.
- **Fix:**
  - In `shell.ts drawTown()`, append `tabs()` after `body`, with class `tabs tabs--dock`.
  - Under `@media (max-width:699px)`, make `.tabs--dock` `position:fixed; inset:auto 0 0 0; display:grid; grid-template-columns:repeat(var(--n),1fr); padding-bottom:env(safe-area-inset-bottom); background:var(--ink); border-top:var(--rule) solid var(--ink)`. Set `--n` from `openTabs().length`.
  - `.tab` becomes a stacked icon over a `.label`, and the selected tab is bone with the cut corner at the top right.
  - At `min-width:700px`, keep it static in DOM order: use CSS `order` or render it before the body for desktop with the `.page` grid. Simplest is to keep two calls, `tabs()` in the head for `min-width:700px` and the dock for narrower screens, with one hidden by media query. Keyboard order is preserved by `aria-controls`.
  - Add `padding-bottom: calc(56px + 56px + env(...))` to `.page` on phones.
- **Impact:** high. Saves 107 px of fold, and switching tab no longer needs scrolling.
- **Effort:** M.

**F2. The page head is 175 px: a label, a 30 px name, a counters box and a boxed sound slider on three lines**
- **Screens:** all town shots, `se-01b`.
- **Problem:** 26% of the fold before any content. The volume slider is rarely touched but sits on prime space, and the "Scrip. Solo account of" label adds 20 px.
- **Fix:**
  - In `shell.ts townHead()`, pass a compact `soundControls({compact:true})` that renders only the `.mute` stamp with a glyph. Volume moves to `home.ts account()`, or a popover on long-press.
  - In `town.css`, under `@media (max-width:699px)`:
    - `.page-head{flex-wrap:nowrap;padding:8px 0 6px;position:sticky;top:0;z-index:5;background:var(--bone)}`
    - `.page-head .label{display:none}`
    - `.head-name h1{font-size:20px}`
    - `.counter{font-size:15px;padding:0 5px 0 2px}`
    - `.page-head .vol{display:none}`
  - Icons: request 20 px canvases in `holdings()` when narrow.
- **Impact:** high. The head drops from 175 to 48 px and holdings stay visible while spending.
- **Effort:** S/M.

**F3. Strike is 1.4 screens down on Workshop, behind a 4-line explainer and two 150 px slot cards**
- **Screens:** `se-06b`, `ip-06`, `and-06`.
- **Problem:** the payoff action is below the fold even when both items are on. Once you scroll to the chooser to pick items, Strike is out of view again.
- **Fix:**
  - `workshop.ts anvil()`: on phones, collapse the `p.note` explainer into a `[?]` tip (`setTip`). In `.slot`, render name, tier and the Take off button on one line, with effects behind a tap.
  - Move the outcome's Strike stamp plus the cost line into a shared `.dock` element. Have `renderWorkshop` return it, and have `shell.ts` place it before the nav.
  - CSS: `.dock{position:sticky;bottom:calc(56px + env(safe-area-inset-bottom));background:var(--bone);border-top:var(--rule) solid var(--ink)}`, and at `min-width:700px` `.dock{position:static}`.
- **Impact:** high.
- **Effort:** M.

**F4. Stash: Head out and Pack can never be on screen together**
- **Screens:** `se-03`, `se-04`, `se-12`.
- **Problem:** packing happens 2.3+ screens below Head out. The flow (pack 2 items, then go) forces a scroll down and back up. Marvel Snap and Clash Royale keep the Play / Battle button docked at all times.
- **Fix:** in `home.ts nextRun()`, also emit a `.dock` with a kit summary (`kitNames()`) and the Head out stamp, using key `headout` so `showTown` focus still works. Inside `.next`, hide the in-flow `.bar > .stamp` on phones only. The dock can be `position:sticky` inside `.home`, so desktop is unaffected (`@media(min-width:700px){.dock{display:none}}`, with the in-flow stamp shown).
- **Impact:** high.
- **Effort:** M.

**F5. Stash rows are about 180 px each: 18 items take 3300 px, and duplicates are listed separately**
- **Screens:** `se-03` (Rain cape ×3, Promissory note ×3, Spring steel ×2, Prospector pan ×2), `se-12`.
- **Problem:** every `.offer` stacks a 64 px icon, name, two lines of "bench recipe / packs down to…", the full effect list, and a separate charges-and-Pack line.
- **Fix:**
  - **Compact layout.** Add a `.items--compact` grid under `@media (max-width:699px)`: `.offer{grid-template-columns:32px minmax(0,1fr) auto;min-height:56px}`, with the large icon replaced by `itemIcon(it.item,false)`. The name line gets the tier and a one-line effect summary with `text-overflow:ellipsis` (`.offer .effects{display:none}` plus a `.fx-line` span holding `fxLine()` from market.ts, moved to dom.ts). Pips and Pack go on the right.
  - **Tap to expand.** A tap on the row toggles `.is-open`, which reveals the effects and the "packs down to" line.
  - **Group duplicates.** In `home.ts stash()`, group by `item.id + charges`, render "×3", and have Pack act on the first unpacked uid.
  - **Sort.** Packed items go first.
- **Impact:** high. The Stash tab goes from 7.7 to about 3 screens.
- **Effort:** M.

**F6. "Who heads out" is a 600 px vertical list of six, half of them locked**
- **Screens:** `se-01b`, `se-03`.
- **Problem:** each `.char` row is 60 to 110 px. Locked characters spend 80 px each to say "after N more runs".
- **Fix:**
  - `home.ts who()`: keep the markup and add a class `chars--strip`. `town.css` under `@media(max-width:699px)`: `.chars--strip{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}` and `.chars--strip .char{grid-template-columns:1fr;justify-items:center;min-height:56px;border:var(--hair) solid var(--ink)}`. Hide `.char-text` except on `.is-on`, which is shown in a caption line below the strip (render a `p.char-caption` after the list). Locked chips show the runs-left number as a `.label` badge.
  - Radio semantics are unchanged.
  - Desktop (`.home > .who-out` in the right column) keeps the list.
- **Impact:** high (saves about 450 px).
- **Effort:** S/M.

**F7. Give on Town is below the fold and below an unrelated block**
- **Screens:** `se-09`, `ip-09`, `and-09`.
- **Problem:** in `townhall.ts project()`, the order is rows, then `fundRow()` (a 4-line italic note plus a stepper and Pay), then the Give bar. The primary action comes after the secondary one.
- **Fix:**
  - `project()`: append the Give bar before `fundRow(...)`. Wrap fundRow in a collapsible, `Pay the Factor with marks instead ▸`.
  - On phones, also mirror Give into the dock while any `giving[raw] > 0`.
  - Shorten the `.p-give` note "you hold 369" into the stepper row (already shared).
- **Impact:** medium/high.
- **Effort:** S.

**F8. There is no collapse primitive, so every secondary section is always fully drawn**
- **Screens:** `se-06b` (Pairs 790 px, Codex 270 px, Relics 560 px of empty rows), `se-11` (Words about 3500 px), `se-03` (Account 350 px).
- **Problem:** secondary reference material has the same weight as actions. Mobile convention is an accordion with a count in the header.
- **Fix:**
  - Add `fold(title, summary, body, prefKey)` to `dom.ts`. It builds `section.section.fold` with an `h2 > button[aria-expanded]` and remembers its state in `savePrefs({folds})`.
  - CSS: `.fold.is-shut > :not(h2){display:none}`, plus `@media(min-width:900px){.fold.is-shut > :not(h2){display:revert}}` so desktop always shows everything. The h2 keeps its 3 px rule; add a `▸`/`▾` glyph in ink.
  - Use it in:
    - `workshop.ts pairs()`, `codex()` and `relicRoll()`
    - `almanac.ts titles()` (unearned part) and `words()`
    - `market.ts rawTrade()` and `listings()`
    - `townhall.ts` fundRow and `givers()`
- **Impact:** high (Workshop 5.4 to about 2 screens, Almanac 9.7 to about 2.5).
- **Effort:** M.

**F9. The Almanac's word list is a 60-row, 3500 px table on a page whose job is records**
- **Screens:** `se-11` (tiles 2 to 5).
- **Problem:** 54% of the Almanac is the glossary. The tooltips already carry each definition in place.
- **Fix:**
  - `almanac.ts words()`: put it inside the `fold`, with a Find `.field` at the top that filters rows by `w-word` or meaning. The same pattern as the Codex Find in `workshop.ts fillCodex()` can be reused.
  - Split STAT words into their own fold.
  - Optional: move Words to the bottom of Daily or make it a header "?" sheet. It is reference, like Slay the Spire's Compendium, not a stats page.
- **Impact:** medium (it is not a primary page, but it is the longest).
- **Effort:** S.

**F10. Relic roll draws 8 empty rows of blank rules when nothing is found**
- **Screens:** `se-06b` (tile 3).
- **Problem:** 330 px of placeholder lines that look broken on a phone.
- **Fix:** in `workshop.ts relicRoll()`, when `found === 0`, render only the summary line ("0 of 8 relics found in the world") inside the fold. Otherwise list only the found ones, with "+N unknown".
- **Impact:** medium.
- **Effort:** S.

**F11. Market Factor: three 195 px raw cards when you trade one raw at a time**
- **Screens:** `se-08`, `ip-08`, `and-08`.
- **Problem:** ore and hide trades fall below the fold, and each card repeats YOU HOLD / PAYS / ASKS headers.
- **Fix:**
  - In `market.ts factor()`, under phones, render a `.seg` segmented control (three `.stamp--small` buttons with raw icons, using `aria-pressed`, the same pattern as the mute stamp). Show only the selected `.factor-row`.
  - Selection is a module-level `let factorRaw: RawId`.
  - The desktop table is unchanged (`@media(min-width:900px){.seg{display:none}.factor-row{display:grid!important}}`).
  - Put Sell and Buy side by side: `.f-act{grid-template-columns:auto 1fr 1fr}`.
- **Impact:** medium.
- **Effort:** S/M.

**F12. Market "Sell from your stash": each row is about 130 px because effects wrap and Salvage drops to its own line**
- **Screens:** `se-08` (tiles 1 to 4, 18 rows ≈ 2300 px).
- **Problem:** the table is meant to be scanned for what to sell, but the 3-column grid (`town.css @media(max-width:560px) .selling tr{grid-template-columns:minmax(0,1fr) 56px 64px}`) pushes the act cell to a new row, and the effects line is 2 to 4 lines long.
- **Fix:**
  - On phones, hide the effects text in `sell()` rows (keep it as the name tooltip via `setTip`) or clamp it to 1 line (`-webkit-line-clamp:1`).
  - Use `grid-template-columns:minmax(0,1fr) 44px 40px auto` with the Salvage stamp in the last column.
  - Group duplicates as in F5.
  - Optional: a sort control (value or tier).
- **Impact:** medium/high (about 2300 to 900 px).
- **Effort:** S.

**F13. The daily clearing is duplicated on Stash, taking prime fold space**
- **Screens:** `se-03b` (bottom), `se-10`.
- **Problem:** "Today's clearing … [Scored attempt] [Practice]" on Stash competes with Head out. Two primary-styled buttons appear on one screen, and a dedicated Daily tab exists.
- **Fix:** `home.ts dailyRow()`: on phones, render one tappable line that calls `openTab('daily')`. Keep both stamps on desktop with `@media(min-width:700px)` show/hide classes. Put an ochre dot on the Daily nav slot when the day is unplayed (F1).
- **Impact:** medium.
- **Effort:** S.

**F14. Stash ends with an Account block that belongs elsewhere**
- **Screens:** `se-03` (bottom, about 350 px, rows of 0s).
- **Problem:** name change, world switch and lifetime totals have nothing to do with the next run, and they sit 7 screens deep.
- **Fix:** move `home.ts account()` to the end of `almanac.ts renderAlmanac()` (the records page) on phones. Alternatively, open it as a sheet from a tap on the header name. Keep the desktop grid area `account` as is. Either branch on `matchMedia('(max-width:699px)')` in renderHome, or render both and hide one in CSS.
- **Impact:** low/medium.
- **Effort:** S.

**F15. Workshop chooser table: 18 rows of 45 px plus a "Pair" column that is mostly empty until one item is on**
- **Screens:** `se-06b` (tiles 0 to 1).
- **Problem:** at 375 px the table works (the Charges column hides via `.wide`), but it repeats the stash list and duplicates. Six "Put both on" pair cards below it repeat the same items again.
- **Fix:**
  - `workshop.ts chooser()`: group duplicates (one row, "×3"). Filter out tier-4 items into a collapsed "Finished (n)" line.
  - Keep pairs collapsed (F8). When `a && !b`, scroll the chooser into view (`scrollIntoView({block:'nearest'})`) rather than the top.
- **Impact:** medium.
- **Effort:** S.

**F16. Almanac records: ten full-width rows with full-width meters (about 600 px)**
- **Screens:** `se-11` (tile 0).
- **Problem:** every count gets a 60 px row. "Almanac" also appears twice (as the tab name and the h2).
- **Fix:** `town.css @media(max-width:699px){.almanac-rows{display:grid;grid-template-columns:1fr 1fr;column-gap:16px}.almanac-row{grid-template-columns:1fr auto}.almanac-row .meter{height:10px}}`. In `almanac.ts counts()`, drop the h2 on phones (the nav already says where you are) and keep the summary line as the lead.
- **Impact:** medium.
- **Effort:** S.

**F17. Notices render between the tabs and the content, pushing everything down**
- **Screens:** none captured, but `shell.ts notices()` mounts after `tabs()`.
- **Problem:** a notice ("Sold 10 for 30") adds 34 to 60 px at the top of the page, far from the stepper you just pressed when you are scrolled down.
- **Fix:** on phones, show `.notices` as `position:fixed; bottom: calc(112px + env(safe-area-inset-bottom))` above the dock, with `aria-live` kept and the same ruled `.notice` look, auto-cleared on the next action. On desktop it stays in flow.
- **Impact:** medium. Feedback becomes visible where the thumb is.
- **Effort:** S.

**F18. Landscape and first-visit edge cases**
- **Screens:** `land-03b`, `se-01b`.
- **Problem:**
  - On first visit a lone "Stash" tab costs 90 px.
  - In landscape a fixed bottom nav plus a sticky head would leave 230 px of content.
- **Fix:**
  - In `shell.ts tabs()`, return `null` when `openTabs().length === 1`.
  - Scope the fixed nav, sticky head and dock to `@media (max-width:699px) and (min-height:501px)`. Landscape phones keep today's single-row top tabs, which already fit (`land-03b`), with a non-sticky head.
- **Impact:** low/medium.
- **Effort:** S.

## Desktop safety

All rules go in `@media (max-width:699px)`, except the fold primitive, which is shown regardless at `min-width:900px`. The `.home` two-column grid at `min-width:900px` (`town.css` line 297) is untouched. The dock and the nav dock are hidden at `min-width:700px`, where the in-flow stamps and top tabs remain. The 700 to 899 px band keeps today's single-column layout with top tabs.
