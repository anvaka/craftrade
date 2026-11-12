# Mobile critique: information density and scale

Lens: type scale, element sizes, spacing, what fits above the fold, total scroll length.
Evidence: `docs/critique/mobile-ui/shots/` (sizes from `index.txt`, measured on the 2x PNGs and halved to CSS px).
Base viewport for numbers below: iPhone SE, 375 x 667 CSS px, unless stated otherwise.

## 1. Verdict

The kit is sized like a desktop ledger and then stacked to one column on phones. Body text is 17px with 19 to 21px secondary text (row names, prices, h2), h1 is 30px, and nearly every multi-column row (`.offer`, `.factor-row`, `.char`, `.recipe`) collapses at <=620px into 3 to 5 stacked lines with its button on a line of its own. The town chrome (name, counters, sound box, two rows of tabs) takes **297 px = 44% of the SE fold**, so the stash tab shows **zero stash items** on the first screen. The first item starts at y = 1525 px. The page is **5122 px (7.7 screens)**, at **~177 px per item row (3.8 rows per screen)**. Almanac is **6461 px (9.7 screens)**, workshop 3330 px, market 3321 px. On the bench, the head (145 px) and sticky foot (147 px) leave **375 px (56%)** for content, which is room for 1.5 level-up offers at 137 px each. In landscape only **~155 of 390 px** are left. Shrinking the secondary type by 2 to 4 px, putting the action button back in a right-hand column, and collapsing the header to two lines should cut most pages by 40 to 50% without touching the palette, font, rules or stamps.

Reference points (approximate, from typical phone builds): iOS body is 17 pt, but list rows are 44 pt and secondary text is 13 to 15 pt. Material body is 14 to 16 sp, with two-line list items at 72 dp. Card and joker text in Balatro, Marvel Snap and Slay the Spire mobile is roughly 12 to 14 px-equivalent, with names around 15 to 17. Brotato mobile's shop shows 4 full item cards in one landscape screen. A content row of 56 to 88 px (one or two lines of text plus a 44 px button to the right) is the norm. Scrip's rows are 130 to 195 px.

## 2. Proposed mobile type and spacing scale

Add tokens to `:root` in `src/client/ui/theme.css`, use them in the selectors below, and override them once under `@media (max-width: 560px)`. Desktop keeps today's values.

```css
:root {
  --fs-body: 17px; --fs-h1: 30px; --fs-h2: 21px; --fs-row: 19px; --fs-fx: 17px;
  --fs-small: 15px; --fs-label: 12px; --fs-fig: 18px; --fs-btn: 17px;
  --sp-section: 28px; --sp-row: 10px; --icon-col: 64px;
}
@media (max-width: 560px) {
  :root {
    --fs-body: 15px; --fs-h1: 22px; --fs-h2: 18px; --fs-row: 16px; --fs-fx: 14px;
    --fs-small: 13px; --fs-label: 11px; --fs-fig: 15px; --fs-btn: 15px;
    --sp-section: 18px; --sp-row: 7px; --icon-col: 40px;
  }
}
```

| Role | Selector(s) | Current px | Proposed px (<=560) |
|---|---|---|---|
| Body | `body` (theme.css:97) | 17 / lh 1.3 | 15 / lh 1.35 |
| Page title | `h1` (theme.css:117), `.g-panel h2` (game.css:920) | 30 | 22 (town name), 20 (bench) |
| Section head | `h2`, `.section > h2` | 21 | 18 |
| Sub head | `h3`, `h3.sub` | 17 | 15 |
| Row name | `.offer .name`, `.slot-text .name`, `.project-name`, `.char-name` | 19 / 19 / 21 / 18 | 16 |
| Effect lines | `.offer .effects li` (inherits 17) | 17 | 14 |
| Notes, italics | `.note`, `.char-twist`, `.made`, `.fx`, `.a-open` | 15 | 13 |
| Caps label | `.label`, `.ledger th`, `.offer .kind`, `.factor-head` | 12 | 11 (keep 0.06em tracking) |
| Figures | `.ledger td.num`, `.stats dd`, `.f-fig`, `.p-fig`, `.counter`, `.price` | 18 to 19 | 15 |
| Button label | `.stamp`, `.stamps--main .stamp`, `.next .bar > .stamp` | 17 / 19 / 19 | 15 (min-height stays 44 on coarse pointers) |
| Tabs | `.tab` (town.css:89) | 14.5 | 13.5, padding 6/8 |
| Inputs | `.field`, `.step-n` | 17 to 19 | **16 (do not go lower: iOS zooms on focus below 16px)** |
| Section gap | `.section` margin-top | 28 | 18 |
| Page head pad | `.page-head` padding | 18 / 8, + 14 margin | 8 / 6, + 10 margin |
| Row padding | `.offer`, `.bar`, `.char`, `.factor-row` | 10 / 10 / 6 / 8 to 10 | 7 / 8 / 4 / 6 |
| Row icon column | `.offer` grid col 1 | 64 | 40 (`.offer > canvas.icon { width:40px; height:40px }`) |
| Stat row | `.stats > div` min-height | 34 | 28 |

Expected rows per SE screen after the change: stash items ~7 (from 3.8), bench picks ~4 (from 1.5), market salvage rows ~7 (from 5).

## 3. Ranked findings

### 1. Town header plus tabs eat 44% of the fold
- **Screens:** se-03b-stash-fold.png, se-01b-first-visit-fold.png, se-05/08/09/11 (every town tab), ip-03b, and-03b.
- **Problem:** The header stacks five things: the label (12px), the name `h1` at 30px on an ochre block (~48 px), `.counters` at 18px (~40 px), the `.sound` box with a "Sound" stamp and a 110 px slider (~46 px), and the double rule. Together they run 0 to 178 px. Then the six tabs wrap to a second row that holds only "Almanac" (`town.css:931 .tabs{flex-wrap:wrap}` + `.tab{min-height:44px}`), which takes another ~100 px. That is 297 px of chrome before any content on all six tabs.
- **Fix:** Make the head two lines, about 96 px including tabs.
  - `shell.ts townHead()`: move `soundControls()` out of the head. Put mute in the tab row as a 44 px icon stamp (`.stamp--plain` with a speaker glyph, no slider), and move the volume slider into a settings sheet or the almanac.
  - Put the name and counters on one row:
    ```css
    @media (max-width:560px){
      .page-head{padding:8px 0 6px;margin-bottom:10px;align-items:center}
      .page-head .label{display:none}
      .page-head h1{font-size:20px}
      .page-head .meta{gap:6px}
      .counter{font-size:15px;padding:0 5px 0 2px}
      .counters canvas.icon{width:22px;height:22px}
    }
    ```
    Draw the counter icons at their small size in `holdings()`, not at a scaled-up size.
  - Tabs in one row: `@media (max-width:520px){ .tabs{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none} .tab{font-size:13.5px;padding:6px 9px 5px 7px;flex:none} .tab .count{display:none} }`. At 13.5px bold the six labels measure ~350 px with 3 px gaps, so they fit at 375 and scroll by a few px at 360.
  - Target: chrome <= 120 px (18% of the fold).
- **Impact:** high. **Effort:** M.

### 2. Stash item rows are ~177 px each; 18 items make 3200 px
- **Screens:** se-03-stash-6-runs.png, se-04-stash-packed.png, se-12-tooltip-open.png, ip-03, and-03.
- **Problem:** `.offer` at <=620px (`theme.css:525`) drops to `64px 1fr`. `.buy` (charge pips plus the "Pack" stamp) then goes to a full-width line of its own. Each row ends up as: name and tier and "bench recipe" (19px), a "packs down to..." italic line, 2 to 4 effect lines at 17px, then a charges and Pack line, plus 10 + 10 px padding. The large icon sits in a 64 px column and leaves ~30% of the row width empty under it.
- **Fix:** Keep three columns on phones and put the button back on the right.
  ```css
  @media (max-width:620px){
    .offer{grid-template-columns:var(--icon-col) minmax(0,1fr) auto;gap:2px 10px;padding:var(--sp-row) 0}
    .offer > canvas.icon{width:40px;height:40px;grid-row:1 / span 3}
    .offer .buy{grid-column:3;grid-row:1 / span 3;flex-direction:column;align-items:flex-end;min-width:0;margin:0;justify-content:center}
    .offer .name{font-size:var(--fs-row);gap:2px 8px}
    .offer .effects{font-size:var(--fs-fx);line-height:1.3;margin-top:1px}
    .offer .effects li{padding-left:11px}
  }
  ```
  In `home.ts:241`, render the charge pips inside `.name` (as `meta`) next to the tier, not in `.buy`, so `.buy` holds only the stamp. Shorten "packs down to 13 of 24 points at hazard 0" to `.made` at 13px (or "13/24 at hz 0" with the full sentence in the tooltip).
  - Estimate: 177 to ~92 px per row, so the stash list shrinks from ~3200 to ~1650 px.
- **Impact:** high. **Effort:** M.

### 3. Bench: head plus sticky foot take 44% of the screen; picks are 137 px
- **Screens:** se-22-bench-1-fold.png, se-23-bench-6-fold.png, se-23-bench-6-scroll1..4, land-23-bench-6-fold.png.
- **Problem:**
  - The head ("After wave 6 of 12", `h1` "Bench" at 30px, and a `.sound` box with Pause, Sound and slider) is 145 px.
  - The `.g-foot` is 147 px: a two-line `.g-reason` notice at 17px, the `.g-held` "YOU HOLD" line, and the Reroll/Wave buttons.
  - Each `.g-pick` offer stacks icon and name, then the effect, then a centred "Take" on its own line: 137 px.
  - Result: 1.5 picks visible on SE. In landscape, ~155 px of content between a 140 px head and a 95 px foot.
  - The bench scroll height is 2317 px (3.5 screens) after wave 6.
- **Fix:**
  - Head: one line.
    ```css
    @media (max-width:620px){
      .g-bench .page-head{padding:6px 0 4px;flex-wrap:nowrap;align-items:center}
      .g-bench .page-head h1{font-size:20px}
      .g-bench .page-head .label{font-size:11px}
    }
    ```
    In `bench.ts` and `mount.ts`, pass only Pause plus a mute icon stamp to `pageHead`; the volume slider already exists in the pause panel (se-24). That gives ~56 px.
  - Foot: one line for the reason (`.g-reason .text{font-size:13px;line-height:1.2}`, `.g-reason .tag{padding:0 6px}`). Put holdings inline with the buttons: `@media (max-width:620px){ .g-foot-acts{flex:1 1 auto} .g-held .label{display:none} .g-held{gap:0 6px;font-size:15px} }`, so "140 7 0 7 [Reroll 4] [Wave 7]" fits in one row at 375. That gives ~95 px.
  - Picks: the finding 2 grid change already puts "Take" in the right column (`.g-pick .buy{justify-content:center}` stays). That gives ~80 px per pick, so three picks and the first shop offer fit on screen.
  - Landscape (`@media (max-height:520px)`): hide `.g-bench .page-head .label`, make the foot a single 52 px row, and hide `.g-reason` unless it is a refusal.
- **Impact:** high. **Effort:** M.

### 4. "Who heads out" spends ~600 px above the stash
- **Screens:** se-03-stash-6-runs.png (y 650 to 1300), se-01-first-visit.png.
- **Problem:** Six `.char` rows (`town.css:342`), each 60 to 110 px. The twist text runs 3 to 4 lines at 15px, and the four locked characters each take a full row just to say "Heads out after N more runs". This sits between "Next run" and the stash, which pushes the first item to y = 1525.
- **Fix:** On phones, render the characters as a horizontal strip of 48 px portrait buttons (44 px target), with the selected character's name and twist as one line under it:
  ```css
  @media (max-width:560px){
    .chars{display:flex;gap:6px;overflow-x:auto}
    .char{grid-template-columns:44px;min-height:56px;width:52px;padding:4px;border-bottom:0}
    .char .char-text{display:none}
    .char.is-on{border-left:0;outline:var(--rule) solid var(--ink)}
  }
  ```
  Add `.chars-detail` in `home.ts` to show the selected character's `char-name` plus `char-twist` at 13px. Locked characters keep their silhouette and get the "N runs" text in the tooltip.
  - Estimate: ~600 to ~120 px. Alternatively, move the whole "Who heads out" block into the "Next run" bar as a "Greenhorn ▸" picker sheet.
- **Impact:** high. **Effort:** M.

### 5. Almanac is 9.7 screens of mostly empty or "Not earned" rows
- **Screens:** se-11-almanac.png (6461 px), and-11 (6787 px), land-11 (4248 px).
- **Problem:** Every progress row is 2 lines (`.almanac-row` at <=700px puts the meter on row 2: ~58 px each). The Titles ledger lists ~20 "Not earned" rows at ~40 px each. The words glossary has ~60 terms, each 3 to 5 lines in a narrow right column, because `.words-list .w-word` is `nowrap` with 16 px right padding, which leaves the definition ~220 px.
- **Fix:**
  - (a) Wrap each almanac section in `<details>` (closed by default except Progress) in `almanac.ts`, styled as `.section > summary` with the h2 look. Or use a second row of sub-tabs: Progress | Ladder | Titles | Words.
  - (b) On phones, stack the glossary: `@media (max-width:560px){ .words-list tr{display:block;padding:6px 0;border-bottom:var(--hair) solid var(--ink)} .words-list td{display:block;border:0;padding:0} .words-list .w-word{padding:0} .words-list td:last-child{font-size:13px} }`. Full-width definitions cut the line count by about 40%.
  - (c) Titles: list earned titles, then one line, "14 not earned yet", that expands.
  - (d) `.almanac-row`: keep it on one line at 375 with `grid-template-columns:minmax(0,1fr) 72px 64px` and `.meter{height:10px;border-width:2px}`.
  - Estimate: ~6460 to ~2000 px with sections closed.
- **Impact:** high. **Effort:** M.

### 6. Market Factor rows are ~195 px per raw
- **Screens:** se-08-market.png (first two screens), ip-08, and-08.
- **Problem:** `.factor-row` at <=899px (`town.css:664`) makes three caption columns ("YOU HOLD / PAYS / ASKS", each with a 13px note such as "takes 150 more today" wrapping to two lines). Then comes a stepper plus "Sell 10 for 30" on one line and a full-width Woad "Buy 10 for 120" on another. Three raws take ~600 px before the item market starts.
- **Fix:**
  ```css
  @media (max-width:560px){
    .factor-row{grid-template-columns:minmax(0,1fr) auto auto;padding:6px 0 8px;gap:2px 10px}
    .f-raw{grid-column:1}
    .f-cap{display:none}
    .f-fig{font-size:15px}
    .f-left{font-size:12px}
    .f-sell,.f-buy{flex:1 1 0}
    .f-act{flex-wrap:nowrap}
  }
  ```
  Render "pays 3 · asks 12" as one 15px line next to the raw name in `market.ts:81`, and put the daily limits in one 12px line under it. Stepper, Sell and Buy share one row: 140 + 2 x 96 + gaps fits in 343.
  - Estimate: 195 to ~105 px per raw.
- **Impact:** high. **Effort:** M.

### 7. Market "Sell from your stash" rows: the Salvage button sits on a line of its own
- **Screens:** se-08-market.png (screens 2 to 5).
- **Problem:** `.selling tr` at <=560px (`town.css:861`) makes a grid `1fr 56px 64px` and forces `td.act` to `grid-column:1/-1`. Every row ends with a full-width line holding one small stamp: ~130 px per row, 17 rows, ~2200 px.
- **Fix:**
  ```css
  @media (max-width:560px){
    .selling tr{grid-template-columns:minmax(0,1fr) 44px 32px auto}
    .selling td.act{grid-column:auto;padding:0}
    .selling .fx{font-size:13px}
  }
  ```
  Put the tier pips under the name in `.l-item`, not in their own column, if width is short. Estimate: 130 to ~72 px per row (two-line effect text at 13px). The same applies to `.listings`.
- **Impact:** high. **Effort:** S.

### 8. Secondary text is 2 to 4 px larger than the body almost everywhere
- **Screens:** all town pages.
- **Problem:** Row names are 19px (`.offer .name`, `.slot-text .name`, `.price`), project names 21px, figures 18px (`.ledger td.num`, `.stats dd`, `.counter`, `.f-fig`, `.p-fig`), and main stamps 19px (`.stamps--main .stamp`, `.next .bar > .stamp`). Large secondary text is the main reason for the "gigantic" feel: every name wraps one word earlier and every figure column is wider.
- **Fix:** Apply the tokens from section 2 to these selectors (one edit each in theme.css and town.css). Keep bold for hierarchy, which the design rules already prefer to size.
- **Impact:** high. **Effort:** S.

### 9. Workshop anvil explainer and empty slots take ~350 px before the picker
- **Screens:** se-05-workshop.png, se-06-workshop-anvil-ready.png, se-07-workshop-result.png.
- **Problem:** A 4-line italic explainer, then `.anvil` at <=760px stacked into first slot (64 px hatched blank plus text), "+", second slot, "=", and the outcome. `.anvil-op` is 22px on its own grid row.
- **Fix:**
  ```css
  @media (max-width:560px){
    .anvil{grid-template-columns:minmax(0,1fr) 14px minmax(0,1fr)}
    .anvil .outcome{grid-column:1 / -1;border-top:var(--hair) solid var(--ink)}
    .slot-blank{width:40px;height:40px}
    .anvil-op{align-self:center;font-size:18px}
    .slot-text .name{font-size:15px}
  }
  ```
  This puts the two inputs side by side with the result below. Move the explainer behind a `.term` tooltip or shorten it to one line. Estimate: ~350 to ~170 px.
- **Impact:** med. **Effort:** M.

### 10. Workshop "Pairs in your stash" uses 3 lines (~116 px) per untried pair
- **Screens:** se-05-workshop.png (screens 3 and 4).
- **Problem:** `.recipe` at <=700px (`town.css:575`) stacks A, "+ B", and "= Not tried by you" with a hatched 32 px unknown icon, plus a "Put both on" stamp spanning all three rows. For untried pairs the third line carries no information.
- **Fix:** When the result is unknown (`.recipe.is-untried`, add the class in workshop.ts), use one line: `grid-template-columns:minmax(0,1fr) auto` with "Lead shot + Rain cape" as a single 15px text cell and hide `.r-out`. Keep the three-line sum only for known recipes. Estimate: 116 to 52 px.
- **Impact:** med. **Effort:** S.

### 11. The stash intro notes are ~200 px of italics
- **Screens:** se-03-stash-6-runs.png (top of Stash section).
- **Problem:** "18 of 24 places filled. What does not fit ... Another shelf of 8 costs ..." (3 lines), plus the "Another shelf" stamp, plus "Pack up to 2 for the run. Each run you start spends one charge ..." (4 lines). These are repeat-visit explanations shown at full size on every visit.
- **Fix:** One `.bar` line: "18/24 places · 0 of 2 packed" plus a right-aligned "Another shelf" `stamp--small`. Move the rules into `.term` tooltips that already exist ("2 for the run", "charges"). Or show them only while `profile.runs < 3`. Saves ~150 px.
- **Impact:** med. **Effort:** S.

### 12. Bench weapon rows overflow the 375 px width (buttons clipped)
- **Screens:** se-23-bench-6-scroll2.png, se-23-bench-6-scroll3.png.
- **Problem:** In the weapons ledger (`bench.ts:599`, `table.ledger`), `td.act` holds "Tier up (cost)", "Combine" and "Scrap". `.ledger .act{white-space:nowrap}` keeps them on one line at ~260 px. "Combine" and "Scrap" are cut off by `.g-bench{overflow-x:hidden}`, so the information is there but out of reach.
- **Fix:** Add class `g-weapons` to the table. Then `@media (max-width:560px){ .g-weapons .act{white-space:normal;width:auto} .g-weapons .act .stamp{min-width:0;padding:3px 8px 3px 7px;font-size:14px} .g-weapons td.act{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px} }`. Better still, show only the primary action ("Tier up" or "Combine") and move "Scrap" into an armed second tap or a long-press menu. Drop the 15px tier-pip column into the name cell.
- **Impact:** med. **Effort:** S.

### 13. Section rhythm adds ~50 px per section
- **Screens:** all town pages, end screen (se-25).
- **Problem:** `.section{margin-top:28px}`, `.section > h2` at 21px plus 5 px padding plus a 3 px rule, and `.section--first{margin-top:18px}`. Stash and almanac have 4 to 7 sections, which adds 200 to 350 px of headings and air.
- **Fix:** `@media (max-width:560px){ .section{margin-top:var(--sp-section)} .section > h2{font-size:var(--fs-h2);padding-bottom:3px} .section > .note{margin-top:4px;font-size:13px} }`.
- **Impact:** med. **Effort:** S.

### 14. "Next run" bar: the hazard picker and daily line take ~330 px
- **Screens:** se-03b-stash-fold.png, se-01b-first-visit-fold.png.
- **Problem:**
  - "Head out" is a 132 x 46 px stamp at 19px on its own line under a 19px sentence.
  - The hazard explainer runs 3 lines.
  - The six 44 px `.hazard` squares sit on their own line.
  - Today's clearing runs 2 lines, then 2 more stamps.
- **Fix:**
  - `@media (max-width:560px){ .next .bar-text{font-size:15px} .next .bar > .stamp{font-size:16px;min-width:112px} .bar--hazard .bar-text,.bar--daily .bar-text{font-size:13px} }`.
  - Put "Head out" on the same line as "Greenhorn, no kit." The text is short enough at 15px, because `.bar-text{flex:1 1 240px}` forces the wrap. Change the basis to `flex:1 1 150px` on phones.
  - Shorten the hazard sentence to "Hazard 0 · items bring ≤13 pts", with the long form in the tooltip.
  - Keep the squares at 44 px; they fit on one line beside the label at 375 if the label is dropped to a `.label`.
  - Estimate: ~330 to ~200 px.
- **Impact:** med. **Effort:** S.

### 15. Landscape wastes the width and starves the height
- **Screens:** land-03b-stash-fold.png, land-23-bench-6-fold.png, land-05-workshop.png.
- **Problem:** At 844 x 390, the 30px `h1`, the 46 px sound box and the tab row still stack: 135 px of chrome, 35% of the height. `.home` stays one column below 900 px, so a 70 px-tall "Head out" row spans 844 px wide. The bench has 155 px of usable height.
- **Fix:**
  - Add `@media (max-height:520px) and (orientation:landscape)` to theme.css.
  - Header: `.page-head{padding:4px 0}`, `h1{font-size:20px}`, `.page-head .label{display:none}`, `.tabs{margin-top:4px}`, and the tabs move into the same row as the head (they fit in 844).
  - Lower the `.home` two-column breakpoint from `min-width:900px` to `min-width:760px` so stash and "who heads out" sit side by side.
  - Bench: see finding 3.
- **Impact:** med. **Effort:** M.

### 16. List icons are drawn large in rows that only need a glyph
- **Screens:** se-03, se-08, se-02-homecoming-win.png, se-22.
- **Problem:** `itemRow()` (`dom.ts:138`) and bench picks (`bench.ts:352, 379, 392, 440`) call the icon with `large = true`, so each icon is ~48 px in a 64 px column. The icon sets the minimum row height (~68 px even for a one-effect item), and the column takes 21% of a 343 px content width.
- **Fix:** Use the small sprite at <=560px (pass `large: !matchMedia('(max-width:560px)').matches`), or scale with CSS `.offer > canvas.icon{width:40px;height:40px;image-rendering:pixelated}` and set the grid column to `var(--icon-col)`. Keep large icons for the anvil result and the fusion reveal (`.g-reveal`), where the item is the hero.
- **Impact:** med. **Effort:** S.

### 17. Effect lists use 17px with full line-height
- **Screens:** se-03, se-04, se-02, se-22, se-23.
- **Problem:** `.offer .effects li` inherits 17px / 1.3, which is 22 px per line. A three-effect item is 66 px of effects alone. The rule-mark bullets carry 14 px left padding.
- **Fix:** `.offer .effects,.slot-text .effects,.g-reveal .effects{font-size:var(--fs-fx);line-height:1.3}` and `.offer .effects li{padding-left:11px}` with `::before{width:6px}`. That is 18 px per line, about 20% shorter, and wraps less ("A dodge blasts nearby enemies for 80" fits one line at 14px in 220 px).
- **Impact:** med. **Effort:** S.

### 18. Stats lists: 34 px rows at 18px figures
- **Screens:** se-23-bench-6-scroll2.png (stats block ~400 px), se-02-homecoming-win.png ("The run in figures"), se-03 (Account).
- **Problem:** `.stats > div{min-height:34px}` and `dd` at 18px. The two-column layout only applies at `min-width:420px` (`theme.css:639`), so at 375 and 390 each stat takes a full-width row for a ~10-character label and a 3-digit figure.
- **Fix:** Use two columns from 340 px: `@media (min-width:340px) and (max-width:899px){ .stats{column-count:2;column-gap:16px} }`, with `.stats > div{min-height:28px}` and `.stats dd{font-size:15px}` on phones. Keep `.stats--one` for account rows that carry stamps. That halves the bench stats block (~400 to ~200 px) and "run in figures".
- **Impact:** med. **Effort:** S.

### 19. Town project rows are two lines with a wide meter
- **Screens:** se-09-town.png (1248 px).
- **Problem:** `.project-row` at <=760px puts the raw, meter and "0 of 60" on row 1, and "you hold 369" plus the stepper and All on row 2: ~88 px per raw.
- **Fix:** This is acceptable, but tighten it: `.project-name{font-size:var(--fs-row)}`, `.p-fig{font-size:15px}`, and `.meter{height:12px;border-width:2px}` (a new `.meter--slim` for in-row meters, also used by the almanac). Saves ~15 px per row.
- **Impact:** low. **Effort:** S.

### 20. Homecoming item list repeats the full stash row
- **Screens:** se-02-homecoming-win.png (1690 px), se-02b.
- **Problem:** "Came home" items use `itemRow`, about 140 px each, with charge pips on their own line. The run figures are a single-column `.stats`.
- **Fix:** This page inherits the fixes in findings 2, 17 and 18. Also show items as one-liners (icon, name, tier, "new" mark), with effects in the tooltip, because the stash shows the full row one tap later. Estimate: 1690 to ~1000 px.
- **Impact:** low. **Effort:** S.

### 21. Tabs and pages carry repeated small counts and labels
- **Screens:** se-03b ("Stash 18"), se-05 ("IN THE STASH / TIER / PAIR" heads), se-08.
- **Problem:** Ledger heads at 12px caps with 8 px top padding are repeated per table. The stash count in the tab is the main cause of the tab row's ~30 px overflow at 375.
- **Fix:** Drop `.tab .count` below 400 px (covered in finding 1). Use `.ledger th{padding:4px 6px 3px 0}` on phones. Hide `thead` when the table has <= 3 columns and the first cell is self-explanatory (workshop picker).
- **Impact:** low. **Effort:** S.

## Expected result (SE, 375 x 667)

| Page | Now | After fixes 1 to 18 (est.) |
|---|---|---|
| Stash, 18 items | 5122 px (7.7 screens), 0 items in fold | ~2600 px (3.9), 2 to 3 items in fold |
| Workshop | 3330 | ~2000 |
| Market | 3321 | ~1800 |
| Almanac | 6461 | ~2000 (sections closed) |
| Bench, wave 6 | 2317, 1.5 picks visible | ~1500, 3 picks + 1 offer visible |
| Chrome share of fold | 44% town / 44% bench | ~18% / ~23% |
