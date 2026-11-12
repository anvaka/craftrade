# Mobile UI critique: visual polish and finish

Lens: alignment, rhythm, wrapping, rules, hierarchy and clipping at 360-390 px (plus 844x390 landscape).
Evidence: `docs/critique/mobile-ui/shots/` (se/ip/and/land), `src/client/ui/theme.css`, `src/client/town/town.css`, `src/client/game/game.css`, `src/client/town/homecoming.css`, `src/client/game/bench.ts`.
Note: `*-25-run-end.png` show the bench, not the end sheet (the capture missed it), so the end screen is not reviewed here.

## 1. Verdict

The kit is strong. The type, the seven colours, cut-corner stamps and the dot-leader stat lists already look like the work of a print designer. What looks amateur is the gap between the kit and the phone layout. Bordered boxes in the header have three different widths. The tab index wraps and leaves "Almanac" alone on a second line. Action stamps drift: some sit centred, some drop under their text on the left, and on the bench some run off the right edge of the screen. The one "two rule weights" rule is broken in four places by a 6 px side bar and a 2 px divider. None of this needs a new look. It needs the grid to be enforced: one left edge, one right edge for actions, one row height for stamps, and one heavy rule per section. Fix the dozen items at the top of the list and the same screens will read as deliberate.

## 2. Layout rules for phones (≤ 620 px)

1. **Two edges only.** Everything starts at the 16 px gutter and ends 16 px from the right. Nothing bleeds past either edge: no portraits, no tooltips and no HUD slips at 6 px. A boxed element in a column is either full width or sized to its content, never somewhere in between.
2. **Actions sit right, text sits left.** A row's action stamp is right-aligned to the right edge. It sits on the same line as the row's last line of text, or on its own line below that text, still right-aligned. Stamps are never centred and never left-aligned under text. Rows of the same list put their stamp in the same place.
3. **Stamps in a row share one height and one baseline.** Use 44 px on touch and `--small` (32 px) only in dense ledgers, and never mix the two in one row. Paired choice stamps (Go again / To town, Scored / Practice, Reroll / Wave) split the width equally.
4. **Rules: one heavy per section, hairs between rows, nothing else.** The 3 px rule goes under the h2 or the table head only. Row separators, meters and side marks use the 1 px hair. Delete every 6 px and 2 px line.
5. **A fixed icon column.** Every list with an icon uses one icon column width (40 px on phone), and the name always starts at the same x across the list and across screens (16 + 40 + 12 = 68 px).
6. **Figures align on the right edge in tabular figures**, under a right-aligned column head. A figure is never centred in its cell.
7. **No one-word lines.** Use `text-wrap: pretty` on prose and `text-wrap: balance` on headings and labels. Labels that must stay together get `white-space: nowrap`. Two-word names such as "Assay office" do not break inside a table cell.
8. **Vertical rhythm on an 8 px step**: 8 inside a row, 16 between a row's blocks, 32 before an h2. Sections never start with different gaps on different tabs.

### What the print-aesthetic games do that Scrip should borrow
- **Obra Dinn**: the ledger has a hard, ruled column grid. Every entry's name, verdict and fate sit in fixed columns, and the paper only ever uses one heavy rule (the page head). Hairlines carry everything else. Scrip uses heavy rules at three levels (page head, section, table head, meter outline), which makes the hierarchy flat.
- **Balatro mobile**: every button in a cluster is the same height and they share the width. The primary action always sits in the same corner. Nothing in a button bar wraps, because the bar uses fixed slots.
- **Inscryption**: the rulebook and card text use one indent for every entry, so pages read as a column. The icons are drawn to one box size.
- **Cultist Simulator mobile**: card text is set with balanced lines, and panels are full-bleed to the gutter or not boxed at all. It has no half-width bordered boxes.

## 3. Ranked findings

### 1. Bench weapon rows overflow off the right edge
- **Screen(s):** `ip-23-bench-6-scroll1/2.png` and `se-/and-23-*` (Weapons, 5 of 6). The `td.act` cell holds "Tier up 49", "Combine" and "Scrap". The third stamp is cut to "Scr" at the screen edge. The first stamp starts at a different x on every row (Sling at 470, the next Sling at 322, Buckler at 487), so the stamp column is ragged.
- **Problem:** `.ledger .act { white-space: nowrap; width: 1% }` (theme.css) forces three stamps onto one line, and `.g-bench { overflow-x: hidden }` hides the overflow. This is the single most broken-looking thing on a phone.
- **Fix:** In game.css `@media (max-width: 620px)`, give the weapons table the same two-line row that `.selling` gets in town.css 861-900. Make each `tr` a grid with `grid-template-columns: minmax(0,1fr) auto` and set `td.act { grid-column: 1/-1; display:flex; justify-content:flex-end; gap:6px; white-space:normal; padding:0 0 8px }`. Give the table a class in bench.ts (`el('table','ledger g-weapons')`). Every action row then right-aligns under its name.
- **Impact:** High. **Effort:** S

### 2. Landscape (and 360 px) workshop overflows the page width
- **Screen(s):** `land-06-workshop-anvil-ready.png` (the page is 927 px wide in an 844 px viewport, and the right column text "…15 timber, 12" is cut off) and `and-06b-workshop-anvil-ready-full.png` (366 px in a 360 px viewport).
- **Problem:** `.anvil` keeps its 5-column grid above 760 px, but two filled slots with 4-line effects and a "Take off" stamp do not fit in 844 px. At 360 px something in the filled slot (the `.slot-text .name` with tier, or the `Take off` stamp) is 6 px too wide. The page then side-scrolls, which breaks the kit's own "no horizontal scroll from 360 px up" rule.
- **Fix:** In town.css, raise the anvil breakpoint to `@media (max-width: 960px)`, or use `grid-template-columns: 1fr` until `min-width: 961px`. Add `.slot-text { flex: 1 1 auto; min-width: 0 }` and `.slot { flex-wrap: wrap }`. Add `html, body { overflow-x: clip }` only as a guard after the cause is fixed.
- **Impact:** High. **Effort:** S

### 3. The tab index wraps and orphans "Almanac"
- **Screen(s):** every town tab at 360-390 px (`ip-03`, `ip-05`, `ip-08`, `ip-09`, `ip-10`, `ip-11`). Five tabs sit on row 1 and "Almanac" sits alone on row 2. At 360 px the split is 4 + 2. The open tab is taller (11 px top padding) than its neighbours, so row 1 also has a stepped top edge, and on "Daily" the open tab's corner pokes past the next tab.
- **Problem:** A wrapped tab strip with a widow is the most visible "unprofessional" signal, and it sits above the fold on every screen.
- **Fix:** In town.css `@media (max-width: 520px)`, replace the wrap with a fixed 3×2 or 6-across grid: `.tabs { display:grid; grid-template-columns: repeat(3, 1fr); gap:3px }` and `.tab { text-align:center; padding-inline:4px }`. Six equal cells read as a deliberate index card. Alternatively, keep one row with `overflow-x:auto; scroll-snap-type:x` and a hairline fade-free edge. Remove the extra `padding-top` on `[aria-selected]` on phones so all tabs share one top line, and show "open" by face colour only.
- **Impact:** High. **Effort:** S

### 4. The page header has three boxes of three widths
- **Screen(s):** all town pages (`ip-01`, `ip-03` top) and homecoming (`ip-02`, `and-02`). The name slab (orange, content width), the counters box (≈ 316 px) and the Sound box (≈ 204 px) stack with ragged right edges. Then a double rule follows. On `ip-02` the Sound box floats beside "0:00 in the clearing", and on `and-02` it wraps under it.
- **Problem:** The header has no shared right edge or column. It reads like three widgets dropped in.
- **Fix:** In theme.css `@media (max-width: 620px)`, set `.page-head .meta { width:100%; display:grid; grid-template-columns: 1fr auto; align-items:stretch }`, `.page-head .counters { width:100% }` with each `.counter { flex:1; justify-content:center }`, and `.page-head .sound { border:0; padding:0 }`. That leaves one full-width counters strip with the mute and slider unboxed on the same line, or the volume moves into a settings row. On homecoming, drop the Sound slip from the head entirely: it is not a recap item.
- **Impact:** High. **Effort:** S–M

### 5. Bench offer "Take" stamps float in the middle
- **Screen(s):** `ip-22-bench-1-fold.png`, `ip-23-bench-6-fold.png`, `se-25`. Each Take stamp is centred under the text column, aligned to neither the text nor the right edge. In landscape (`land-23`) it sits right, so the two orientations disagree.
- **Problem:** `.g-pick .buy { justify-content: center }` (game.css 582) overrides the kit's `space-between`.
- **Fix:** In game.css, inside `@media (max-width: 620px)`, set `.g-pick .buy { grid-column: 2; justify-content: flex-end }`. The stamp then right-aligns under the effect lines. Alternatively, for one-tap picks, make the whole offer row the button and drop the stamp.
- **Impact:** High. **Effort:** S

### 6. Stash item rows: stamp and charges on their own line, with a wasted icon column
- **Screen(s):** `ip-03-stash-6-runs.png`, `ip-12-tooltip-open.png`. The 64 px icon column leaves the name block starting at x = 94 px. The "bench recipe" note wraps onto a second line. Then "■■■ CHARGES" sits on the left and the "Pack" stamp on the right of a third line. Each item becomes a 4-6 line card with a lonely stamp row.
- **Problem:** The icon column steals 25% of the width. The charges row is a third alignment line that ties to nothing.
- **Fix:** In theme.css `@media (max-width: 620px)`, set `.offer { grid-template-columns: 40px minmax(0,1fr) }` and scale the icon canvas to 40. Put the charges pips inline after the tier in `.name` (town `items` markup), and put `.buy` in `grid-column: 2` with `justify-content: space-between`, so the charges sit left under the text and Pack sits right. Move "bench recipe / packs down to…" onto one `.note` line with `text-wrap: pretty`.
- **Impact:** High. **Effort:** M

### 7. Portraits bleed past the gutter and names start at different x
- **Screen(s):** "Who heads out" on `ip-01`, `ip-03` and `land-01`. Locked silhouettes (Sawyer, Tinker) poke out to x ≈ 12 px, left of the 16 px edge. The chosen Greenhorn row has a 6 px bar plus 8 px padding, so its name starts at 172 px against 144 px for the others. "Hazard ladder" in `ip-11` has the same problem: Greenhorn's name is at 140 px and Sawyer's at 158 px.
- **Problem:** `.char { grid-template-columns: 44px … }` holds a sprite wider than 44 px with `justify-self: center`, so it overflows both sides. The is-on side rule shifts the whole row.
- **Fix:** In town.css, use `.char { grid-template-columns: 48px minmax(0,1fr) }` and `.char canvas { justify-self:start; max-width:48px }`, and draw the sprite at a size that fits. For `.char.is-on`, replace the border and padding with `box-shadow: inset 3px 0 var(--ink)`. A box-shadow is banned, though, so use an absolutely positioned `::before` 3 px bar in the gutter at `left:-8px` instead. That way the content never moves. Use the same treatment for `.ledger tr.is-on .thing` (town.css 241) and `.offer.is-locked` (theme.css 517). Give ladder-row portraits a fixed-width cell.
- **Impact:** High. **Effort:** S

### 8. 6 px and 2 px lines break the two-weight rule
- **Screen(s):** chosen character (`ip-01`), Sawmill row in Stations (`ip-09`, the black bar before the icon), locked bench offers, the post form, and the counters strip (`.counter.is-scrip { border-right: 2px }`).
- **Problem:** The kit says "3px and 1px, nothing else draws a line", and the eye notices these off-weight marks as mistakes.
- **Fix:** Replace `6px solid` at town.css 242, 365, 730 and theme.css 517 with the 3 px gutter-bar pattern from finding 7. Change theme.css 883 to `var(--hair)` or drop it.
- **Impact:** Med–High. **Effort:** S

### 9. Account rows: stamps butt against the row rules
- **Screen(s):** `ip-01` and `and-01a` (Account). "Another name" and "Go to the shared town" are 40+ px stamps in a 34 px `.stats` row, so their outlines touch or overlap the hair rules above and below. "Hooper 716" (ochre slab) and the stamp sit 4 px apart and the dot leader is very short, so the line looks crammed.
- **Fix:** Use `.account .stats > div { min-height: 52px; padding-block: 6px }`. Better, on phones move the rename and world stamps out of the leader rows into a `.bar` under the table: label and value on the leader, actions right-aligned on their own ruled line. This is town.css `.account` plus the home.ts markup.
- **Impact:** Med–High. **Effort:** S

### 10. Market: the Factor's figure columns have three different baselines
- **Screen(s):** `ip-08-market.png` and `and-08.png` (Timber, Ore, Hide). The labels sit at three heights: YOU HOLD at y 331, PAYS at y 301 and ASKS at y 315. This happens because "takes 150 more today" wraps to two lines and the grid row is `align-items:center`. The intro also ends on the widow "day." at 360 px.
- **Fix:** In town.css `@media (max-width: 899px)`, set `.factor-row { align-items:start }`, `.f-left { white-space:nowrap; font-size:13px }`, and shorten the copy to "150 left today" in both. Give the three columns a shared first line (`.f-cap` label) and a second line (figure), so the labels all sit on one line. Add `p { text-wrap: pretty }` globally.
- **Impact:** Med. **Effort:** S

### 11. Market stepper and Sell/Buy: a mismatched cluster
- **Screen(s):** `ip-08` and `ip-09` (town project, `−  0  +  All`). The − and + are each cut-corner stamps with a hair-ruled number between them, so three cut corners sit in 120 px. The Sell stamp is outlined, while Buy is a full-width woad slab on its own line below. The pair reads as two unrelated buttons. On the town project rows the stepper is right-aligned, but in "With marks" it is left-aligned with a disabled "Pay" beside it.
- **Fix:** In town.css `.step`, draw the stepper as one box: a single 3 px outline, hair dividers, no cut corner on − (cut only the outer right corner). Lay out the Factor action line as stepper | Sell | Buy in a 3-column grid, `grid-template-columns: auto 1fr 1fr`, with both trade stamps the same height and both `--plain` or both filled. Right-align every stepper, including "With marks".
- **Impact:** Med. **Effort:** M

### 12. Salvage and almanac figures are centred and drift from their column heads
- **Screen(s):** `ip-08` Sell from your stash. The salvage "5" sits at x ≈ 725, centred under "SALVAGE" (which ends at 735), and the tier mark floats mid-cell. `ip-11` Almanac: a two-line name ("Hazard levels cleared, all characters") pulls its figure "1 of 36" to the vertical middle, while the one-line rows are top-set.
- **Fix:** `.selling td.num { text-align:right; align-self:start; padding-top:… }` (town.css 861 block). Set `.almanac-row { align-items:start }` and `.a-fig { align-self:start }`. Use `.ledger td { vertical-align: top }` on phones for multi-line rows, so figures align with the name's first line, ledger-style.
- **Impact:** Med. **Effort:** S

### 13. Almanac meters stack a heavy outlined bar in every row
- **Screen(s):** `ip-11` top. Ten rows each carry a 3 px-outlined meter, so 20 heavy horizontals sit in one screen. The page loses its section hierarchy.
- **Fix:** In theme.css `.meter` (and town `.almanac-row .meter`), use a 1 px hair outline at 8 px tall, with the fill still hatched woad. Keep 3 px only for the town project meter, if anywhere. In the spirit of Obra Dinn, the progress bar reads as a pencil tick, not a box.
- **Impact:** Med. **Effort:** S

### 14. Homecoming: primary pair, badges and widows
- **Screen(s):** `ip-02` and `and-02`. "Go again" is ink with a bone underline (the focus mark from town.css 50 showing because of autofocus) and "To town" is woad, so the two look like different components. The "HAZARD" and "OPENED" badges are centred vertically against 3-4 line paragraphs and look adrift. The "Soft moccasins" effect wraps "50" onto its own line.
- **Fix:** (a) Do not autofocus on touch, or show `:focus-visible` only after a key press. If the harness caused the underline, set `.stamp:focus:not(:focus-visible)::after{display:none}`. Make both stamps the same face (`--plain` for To town) so only the label differs. (b) In town.css, set `.opened li { align-items:flex-start }` and `.opened .label { margin-top:3px; min-width:76px; text-align:center }`. (c) Add `.offer .effects li { text-wrap: pretty }`.
- **Impact:** Med. **Effort:** S

### 15. Bench bottom dock slices offers mid-line
- **Screen(s):** `ip-23-bench-6-fold`, `se-25`, `ip-25`. The sticky `.g-foot` heavy rule cuts through "damage, scaled per weapon" and "cap 60%". Half-letters show above the rule, and on `se-25` a heart icon sits behind the FIRST tag.
- **Fix:** In game.css, give `.g-page` `padding-bottom` equal to the foot height (or use `scroll-padding-bottom`). Add a 1 px hair plus 8 px of bone above the heavy rule (`.g-foot { box-shadow: 0 -8px 0 var(--bone) }`). Since shadows are banned, use a `::before` bone strip 8 px tall instead, so text fades out onto paper before the rule rather than being sliced.
- **Impact:** Med. **Effort:** S

### 16. Workshop "Pairs in your stash": partial rules and a floating stamp
- **Screen(s):** `ip-05` (`i05b` crop). Each pair has a hair rule under the second item that stops at x ≈ 530, and "Put both on" sits right, vertically centred on the 3-line sum. Combined with the full-width row rule, every pair shows two rules of different lengths.
- **Fix:** In town.css `.recipe` (`max-width: 700px` block), drop the partial sum rule, or extend it to full width with `grid-column:1/-1`. Put the stamp on the "=" line (`align-self:end`) so it closes the sum, like the total on a receipt.
- **Impact:** Med. **Effort:** S

### 17. Empty relic table looks like a blank form
- **Screen(s):** `ip-05` bottom (`i05c` crop), Relics. Eight rows each have two blank underscore rules plus the row hair rule and a lone "0", so 24 lines for an empty state. It reads as broken rather than as "unknown".
- **Fix:** Render unknown relics as one `.empty` line ("8 relics, none found yet.") or as rows with a hatched 40×16 chip and "Unknown" in italic. Remove the blank-line spans.
- **Impact:** Med. **Effort:** S

### 18. Town Stations table: names and descriptions wrap into ragged lines
- **Screen(s):** `ip-09` Stations. "Assay / office" breaks across two lines, "20 untried pairs a / day" leaves the widow "day", and the five-square tier pips crowd the "DOES NOW" column, so the column head "TIER" does not line up with the pips.
- **Fix:** On phones drop the "DOES NOW" column into a second line under the name (`.l-sub` style italic). Set `.thing span { white-space:nowrap }` for station names, and use `text-wrap:pretty` on the description.
- **Impact:** Med. **Effort:** S

### 19. HUD slips have ragged edges and a 6 px gutter
- **Screen(s):** `ip-20` and `ip-21`. HP slip ends at x 530, Wave slip at 545-768, counters strip ends at 413 (wave 1) or 635 (wave 6, with "3 left behind"), weapon strip ends at 322, and Pause is at 640-768. The edge gutter is 6 px against 16 px everywhere else. The stag bar is centred on its own, and the elite card is full width. Weapon-tier superscripts ("3", "2") touch the top border of each slot.
- **Fix:** In game.css `@media (max-width: 620px)`, use `padding: max(10px, env(...))` for the HUD gutter. Lock rows to two columns: HP + Wave on row 1 with a shared height, counters + Pause on row 2 sharing that height, and weapons on row 3. Pin `.g-slot-tier` at `top:2px; right:2px` with `line-height:1`. Make the elite bar the same width as the elite card, directly under it.
- **Impact:** Med. **Effort:** M

### 20. Bench: offer name and effect separated by a variable gap
- **Screen(s):** `ip-22` ("+3 Max HP" has a 40 px gap before its single effect line, while "+2 Ranged" has 20 px), `ip-25` and `land-23`.
- **Problem:** The 64 px icon spans two auto rows, so the second row grows to fill the icon's height.
- **Fix:** In theme.css, set `.offer { grid-template-rows: auto 1fr; align-content:start }` and `.offer .effects { align-self:start }`.
- **Impact:** Low–Med. **Effort:** S

### 21. Hazard picker squares use three different treatments
- **Screen(s):** `ip-03`. Square 0 is inked with an ochre notch, 1 has a 3 px outline, and 2-5 have a 1 px outline plus hatch. The border weight jumps between neighbours, so the row looks uneven.
- **Fix:** In town.css `.hazard:disabled`, keep `border-width: var(--rule)` and show "shut" with hatch only. Every square then has the same outer box.
- **Impact:** Low–Med. **Effort:** S

### 22. Tooltip breaks the gutter and leaves a rule stub
- **Screen(s):** `ip-12-tooltip-open.png`. The tooltip box starts at x ≈ 9 px, outside the gutter, and ends at 327 px. A stray 46 px piece of the hair rule shows to its right. It also lacks the kit's heavy top rule, which reads as inconsistent with `.tip`.
- **Fix:** On coarse pointers, position tips as `left: var(--gutter); right: var(--gutter); max-width:none` (a full-width ruled slip under the trigger), and use the `.tip` class with its 3 px top rule.
- **Impact:** Low–Med. **Effort:** S

### 23. Paired choice stamps differ in width and weight
- **Screen(s):** `ip-03` and `ip-10` ("Scored attempt" is filled, "Practice" is outlined and narrower), and the bench anvil picks (`ip-23-scroll1`: "Salt pork" and "Bone bucket" chips of unequal widths, ending at 725 px rather than at the right edge).
- **Fix:** For two-choice rows, use `.stamps.pair { display:grid; grid-template-columns:1fr 1fr }`. For the anvil picks use `.g-anvil-picks { display:grid; grid-template-columns:repeat(2,1fr) }`, which fills to both edges.
- **Impact:** Low. **Effort:** S

### 24. Disabled stamps: strikethrough on outlined woad looks broken
- **Screen(s):** `ip-09` ("Pay" and "Give" in woad outline with strikethrough) and bench foot ("Reroll", "Wave 7" struck through). At 15-17 px the strike runs through the glyphs and the label is hard to read.
- **Fix:** Keep the idea and refine it: in theme.css `.stamp:disabled`, set `text-decoration-thickness: 1px` (a hair) and give `.stamp:disabled::before` the hatch fill, so the face changes, not only the word. Use `color: var(--ink)` on woad stamps for consistency.
- **Impact:** Low. **Effort:** S

### 25. Stat list dot leaders stop at different x
- **Screen(s):** `ip-23-scroll1` (Greenhorn stats) and `ip-02` (run in figures). Leaders end at 668-676 px depending on value width, and the stat icons are drawn at mixed visual sizes (the Reach arrow is wider than the heart).
- **Fix:** In theme.css, set `.stats dd { min-width: 4ch }` so leaders stop on one column. Fix the icon box at 28×28 in `.stats dt canvas`.
- **Impact:** Low. **Effort:** S

### 26. Section spacing is inconsistent across tabs
- **Screen(s):** the gap from the tab rule to the first h2 is 54 px on Stash ("Next run"), 46 px on Market and 58 px on Almanac. The section top margin is 28 px in town and 22 px on the bench. Some sections close with a hair rule and others do not (Daily "Board" ends on a hair; Codex ends with none).
- **Fix:** Use one token, `--section: 32px` in theme.css, for `.section` and `.g-bench .section`, and set `.section--first { margin-top: 16px }` everywhere. Every section's last row carries the hair, and `.empty` does too (it already does, so apply it uniformly).
- **Impact:** Low. **Effort:** S

---

**Top fixes in one line each**
1. Bench weapons table: drop the `nowrap` stamp cell to a right-aligned second line, so stamps stop running off-screen (game.css + `g-weapons` class).
2. Tabs: a fixed 3×2 (or one scrolling row) grid with equal cells, so "Almanac" no longer wraps alone; the anvil grid collapses below 961 px, which removes horizontal scroll.
3. Header: one full-width counters strip, Sound unboxed, no three mismatched boxes. Remove all 6 px and 2 px rules, so selection becomes a 3 px gutter bar that does not shift content.
4. Action stamps always right-aligned and in the same place per list (bench Take, stash Pack, account rows), with paired choices splitting the width equally.
5. A fixed 40-48 px icon column with no portrait bleed, top-aligned multi-line rows, right-aligned tabular figures, and `text-wrap: pretty` to remove the widows.
