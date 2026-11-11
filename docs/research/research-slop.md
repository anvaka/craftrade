# What reads as "AI slop" in web games, and how to avoid it

Research date: 2026-11-11. Audience: the agent that will design and build the game.

## Method and limits (read first)

- Evidence came from web search only. Direct page fetches were blocked in this session (every host failed DNS: en.wikipedia.org, news.ycombinator.com, dev.to, paperpilot.dev, thefountaininstitute.com, 925studios.co, gigazine.net, reddit mirrors). So every quote below is a **search-result snippet**, not text I read in the opened page. Wording may be slightly truncated. Open the URL before quoting any of it publicly.
- Labels used: **[S]** = stated by a source found in search (snippet-level). **[S-weak]** = single informal source, vendor blog, or forum anecdote. **[I]** = my own inference or craft judgement, not sourced.
- Not found, despite searching: direct r/gamedev or r/IndieDev threads (only third-party snippets), a js13k-specific critique, a developer statement from Brotato's or Loop Hero's authors on art intent, anyone citing "Whispering Woods" or "Shadowfang" by name, and a quantified Show HN teardown (one search summary mentioned "more than half" of Show HN launches sharing the fingerprint, attributed to a gigazine/925studios piece I could not open).
- Important caveat repeated by sources: these are signs, not proof. Wikipedia's page says the signs are "only potential signs of a problem, not the problem itself". The goal here is not to dodge a detector, it is to make decisions instead of accepting defaults.

---

## 1. Visual / UI tells

The common explanation across sources: slop is what you get when nobody made the taste decisions, so the model's defaults fill in. "AI slop design is the look you get when a model fills in taste decisions you did not make" [S] (https://www.925studios.co/blog/ai-slop-design-tells). Vibe-coded UIs "look alike because they average out everything the model has seen" [S] (https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui).

| Tell | Status | Evidence |
|---|---|---|
| Purple/indigo/violet gradients (purple-to-blue more than purple-to-pink) | Confirmed, the most cited | Called "the single loudest AI tell in 2026"; blamed on Tailwind's indigo-500 default. https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p , https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website , https://dev.to/james_anderson_h/the-purple-gradient-problem-why-ai-ui-all-looks-alike-and-how-to-fix-it-3j65 |
| Inter (or Roboto/Arial/system) everywhere | Confirmed | "Inter or Roboto, every time"; HN: "Often there is the Inter font. Corners are usually quite rounded, there are lots of gradients." https://news.ycombinator.com/item?id=49290499 |
| Emoji as icons / in headings / in buttons | Confirmed | HN: "emojis in headers as large style iconography"; Fountain Institute lists "emojis as UI elements"; the game-specific checklist lists emoji in the UI. https://news.ycombinator.com/item?id=49290499 , https://pages.thefountaininstitute.com/posts/7-tells-that-a-ui-is-ai-generated , https://paperpilot.dev/garden/recognizing-vibe-coded-games |
| Neon accents + glow on dark background | Confirmed | Fountain Institute: neon accent colours, dark-mode glow effects. HN: "dark background offset glow, thick boarders, flat display style, over use of techy color schemes like navy blue (especially with gradients)". Game checklist: "neon glows on elements". |
| Glassmorphism cards | Confirmed (web); weaker for games | Listed alongside neon glow in several slop lists and flagged by scanner tools. https://github.com/iRehmanAhmad/deslop , https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c |
| Cards for everything; rows of 3 (or 6) identical rounded cards, icon + heading + two lines | Confirmed | "a row of three (or six) identical rounded cards, each with an icon, a heading, two lines of text"; "cards on every block"; same corner radius everywhere; "a gray 1px border on every card". Game checklist: layouts built from **nested rounded rectangles**. |
| Centred hero, one CTA "floating in space" | Confirmed (web) | https://dev.to/james_anderson_h/the-purple-gradient-problem-why-ai-ui-all-looks-alike-and-how-to-fix-it-3j65 |
| Gradient text (background-clip: text) on headlines | Confirmed, I had not listed it | Flagged by deslop scanner and DEV guide. |
| 1px border + large soft shadow blur | Confirmed, new | Named as a scanned anti-pattern in the HN thread's top reply. |
| Glowing orbs / abstract gradient blobs as background | Confirmed, new | https://vibecodekit.dev/ai-slop-design |
| "Dark mode you never asked for" | Confirmed, new | Same source. |
| Status dots, multicoloured side tabs / coloured left-border accents | Partly confirmed | Fountain Institute names status dots and multicoloured side tabs. Coloured left-border cards were not confirmed by name. |
| HN-specific: "black backgrounds with green and orange gradients and the same font everywhere" | Confirmed [S-weak] | https://news.ycombinator.com/item?id=49290499 |
| Over-rounded (pill) buttons | Confirmed as "corners are usually quite rounded" | HN thread. |
| Gratuitous particles | **Not directly confirmed** | No source named particles. Keep as [I]: particles that are not tied to an event read as decoration. |
| Inconsistent art styles | Confirmed indirectly | "AI-generated images or descriptions often correlate with vibe coding" (paperpilot). Mixed-source art is a long-standing asset-flip tell [I]. |
| Dead UI: buttons with no handler, links to `#`, duplicated components | Confirmed, new | https://www.hustletoai.com/blog/programming-7/how-to-tell-if-a-website-is-vibe-coded-120 |

**The second-generation trap [S, important].** "Steering a model away from purple lands it on a different default look (cream, serif, terracotta in 2026)" (https://codemyspec.com/blog/vibe-coded-websites-look-the-same). A frontier/crafting theme pulls hard toward exactly cream paper + terracotta + elegant serif. So "not purple" is not enough. The art direction must be a set of positive rules (section 5), not a list of avoided colours.

---

## 2. Writing tells

Primary reference: Wikipedia's "Signs of AI writing" (https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), read through secondary write-ups (https://the-decoder.com/heres-how-to-spot-ai-writing-according-to-wikipedia-editors/ , https://www.beutlerink.com/blog/how-to-spot-ai-writing , https://www.blakestockton.com/takeaways-from-wikipedias-signs-of-ai-writing-2/ , https://www.pangram.com/signs-of-ai-writing).

| Tell | Status | Evidence |
|---|---|---|
| Vocabulary: delve, tapestry, testament, intricate, pivotal, underscore, landscape | Confirmed | Listed on the Wikipedia page per secondary sources; phrases such as "stands as a testament", "plays a vital role", "underscores its importance". |
| Em-dash overuse | Confirmed, with nuance | Page says chatbots use it more often than most editors; it does not say only AI uses it. |
| Rule of three | Confirmed | "LLMs overuse the 'rule of three'". A Steam thread on Underkeep describes suspected AI prose as "the short sentences, rules of three, verbose sentences that dont actually say much" (https://steamcommunity.com/app/2411200/discussions/0/564798922323821062/). |
| "It's not X, it's Y" (negative parallelism) | Confirmed, I had not been asked about it but it is a top tell | Secondary write-ups of the Wikipedia page. |
| Title Case Everything, heavy bold, bulleted everything | Confirmed | "excessive use of boldface, lists, or title case in headings". |
| Generic fantasy names | Confirmed for **Elara** and **Eldoria** | Martin Wattenberg: "The AIs love to create characters named Elara". itch.io user: "when you look up Eldoria, ALL you get is AI generated with few exceptions" (https://itch.io/post/11060499). An unverified study claim lists Elias, Mara, Elara and occupations lighthouse keeper, clockmaker, librarian as recurring. "Whispering Woods" and "Shadowfang" were **not** found cited; treat the adjective+noun place-name pattern as [I]. |
| Tooltips/descriptions that restate the obvious | Confirmed | HN: "I sometimes see weird descriptions of what a particular UI element does, even though it's obvious." |
| Verbose, hedged dialogue | Confirmed [S-weak] | "AI-generated dialogue is perhaps the most detectable form of AI content in games"; "Excessive hedging" (https://www.strayspark.studio/blog/ai-slop-game-development-using-ai-responsibly, commercial source). |
| Players actively hunt for AI text | Confirmed | Tainted Grail thread "A significant amount of the games flavour text is written by AI" (https://steamcommunity.com/app/1466060/discussions/0/688619018316320021/); The Alters disclosure thread (https://steamcommunity.com/app/1601570/discussions/0/604160267118483770/). Secondhand stats: AI-flagged games saw a higher negative-review ratio (https://www.totallyhuman.io/blog/the-surprising-new-number-of-genai-games-on-steam, methodology unverified). |
| Faux-epic flavour text, exclamation-mark cheer, over-explaining tutorial | **Not directly cited**; [I] | Consistent with "promotional language" and "verbose sentences that don't say much", but I found no one naming these in game text specifically. |

Game-specific items from the paperpilot checklist [S]: **early achievements like "first click"** and **a modal on first launch** are named as vibe-coded tells. Both are text/onboarding choices.

---

## 3. Game design tells

Best single source: "Recognizing Vibe Coded Games" (https://paperpilot.dev/garden/recognizing-vibe-coded-games), a gamedev's checklist. Snippet-level content: emoji in UI, neon glows, nested rounded rectangles, "first click" achievements, first-launch modal, and "poor balancing and odd design choices", with the caution that this "could also be an inexperienced dev who is still learning" and a warning against witch-hunting on one or two signs.

| Claim | Status | Evidence |
|---|---|---|
| Recognisable in seconds from the page/screenshot | Confirmed [S-weak] | Reddit snapshot summary: people spot vibe-coded games within seconds by a shared look; games abandoned soon after release. |
| Feels like a prompt response, not a world | Confirmed [S-weak] | Indie Hackers comment on Vibe Jam 2025: games feel like clever responses to a brief rather than worlds, "playable slideshows". https://www.indiehackers.com/post/tech/pieter-levels-just-announced-the-winners-of-the-2025-vibe-code-game-jam-Uz0wHG4pI3KBOiFhP5YR |
| Jank, low frame rate, weird bugs | Confirmed | Jonathan Blow (quoted): after 3 weeks you get something like a weekend jam game "except it will also have a nasty low frame rate and lots of weird bugs". Vibe Jam jury called the 2nd-place game fun and original but janky; 3rd place clean but with awkward controls. https://levels.io/winners-of-the-2025-vibe-code-game-jam |
| No maintenance / abandonment | Confirmed | "42% of the games from last year's Vibe Jam are already offline". https://www.michaelscheiwiller.com/blog/vibe-jam-link-rot |
| Sameness from shared stack | Confirmed [S-weak] | Three.js was ~60% of 2025 Vibe Jam entries (single analysis). |
| Poor balance / untuned numbers | Confirmed | paperpilot checklist. |
| Meaningless numeric upgrades | Confirmed as general player complaint, **not AI-specific** | "boring numerical upgrades like +10% damage, +10 HP, +10% movement speed" (https://steamcommunity.com/app/2605790/discussions/0/4358997997658938531); "getting stat upgrades is definitely the most boring upgrade you can get" (r/roguelites); "over-reliance on simple stat increases ... becomes monotonous" (https://www.wayline.io/blog/blessing-roulette-boosts-roguelite-engagement). |
| Jam flooding with prompt-straight-to-game entries | Confirmed | itch.io: "The submission of completely AI generated games are a rampant problem I've seen in many Jams" (itch.io community posts). |
| No game feel (hit feedback, audio) | **Not found as an AI-specific quote** | The general craft case is well established: Jonasson & Purho "Juice it or lose it" (2012), Nijman "The Art of Screenshake" (2013), where the un-juiced version "looked like a student project". https://brkeogh.com/2017/03/31/an-incomplete-game-feel-reader/ |
| Wide-and-shallow feature lists, systems that do not interact, menus heavier than the game, resize/pause/blur bugs, no onboarding by play | **[I]**, not sourced | These match the "response to a brief" and "weird bugs" complaints, but nobody I found states them in these words. They are still correct craft targets, especially for this project, which has three pillars (arena, crafting, market) and so is at maximum risk of shallow breadth. |

---

## 4. What makes small games feel authored

Sourced praise:

- **Loop Hero**: "The limited color palette and crunchy sound design sets it apart from many other pixel indie games"; "Everything from the colour palette through to the UI design" carries the retro feel; a "dusty blue & orange" scheme. Other devs copy the palette, one "so the automatic hero movement would be easier to follow" (itch.io). Reviews: https://www.shacknews.com/article/123099/loop-hero-review-happy-death-day , https://thesixthaxis.com/2021/03/04/loop-hero-review . Lesson: palette + sound + UI are one decision, and the palette serves readability.
- **Dome Keeper**: "a minimalist pixel aesthetic and it looks fantastic"; "charming yet functional, with clear visual cues that make it easy to track enemies, resources, and upgrades even during the hectic defense waves"; atmosphere is the most praised element (https://shacknews.com/article/132448/dome-keeper-review , https://pcgamer.com/dome-keeper-review). Directly relevant: it is also a gather-then-defend loop.
- **Brotato**: "a very cartoony art style that's somehow reminiscent of the flash games I played as a kid", "Newgrounds-era flash game", "adorably violent" (https://superjumpmagazine.com/brotato-is-a-tasty-roguelike-snack , OpenCritic). Lesson: one silly, specific premise (a potato with six weapons) and thick clean lines beat detail. I found no developer statement on intent.
- **Vampire Survivors**: built on a bought asset pack (Oryx), about £1,100 total on assets/art/music, priced at $3 to reflect its "very bare bones construction and use of asset store sprites" (https://en.wikipedia.org/wiki/Vampire_Survivors , https://www.pcgamer.com/uk/vampire-survivors-didnt-rip-off-castlevania-sprites-after-all/). I could **not** confirm "deliberate crudeness" as a stated intent; what is confirmed is that crude art did not matter because the loop, feedback and audio were tuned. Lesson: it is honest about what it is and pours effort into feel.
- **PICO-8**: fixed 16-colour palette is "very quickly recognized"; "The colors you see in the screenshots are the only colors you can use, period" (https://eev.ee/blog/2016/05/25/under-construction-our-pico-8-game/); "The constraint is what creates cohesion" (https://www.sprite-ai.art/guides/pixel-art-color-palettes).
- **Game feel**: "Juice it or lose it" and "The Art of Screenshake" (links above). A Reddit note adds: always offer a toggle for screenshake.
- **js13k**: nothing sourced. [I] The winners that get remembered tend to commit to one mechanic and one look because the byte limit forces it.

Synthesis [I]: authored = every visible thing can be traced to a rule someone chose. A fixed palette with assigned meanings, one line weight, one typeface, one voice, one sharp mechanic that the other systems feed. Slop = every element is individually reasonable and nothing is related.

---

## 5. Three art directions executable entirely in code

All three are my own proposals [I]. Common rules: no gradients, no blur/glow, no drop shadows, no emoji, no rounded-rect cards, icons drawn from the same primitives as the world. Font licences: Alfa Slab One and Space Mono were confirmed OFL in search; Zilla Slab, Averia Serif Libre and Silkscreen are OFL to my knowledge but were not verified this session, so check each licence file before shipping.

### Option A: "Blockprint Almanac" (recommended)

Looks like a two- or three-colour relief print from a settlers' almanac. Daylit, heavy, slightly crooked.

- **Palette (7, fixed, with jobs)**
  - Ink `#1B2226` all outlines and text
  - Bone `#D9D3BD` UI ground only (greyed, deliberately not warm cream)
  - Moss `#7C8C5A` clearing floor
  - Spruce `#2F4A3C` treeline, shade shapes
  - Ochre `#D99A2B` the player, resources, anything you gather or craft
  - Madder `#B8402E` enemies, damage, danger only
  - Woad `#3E6C8A` town, market, prices, other players
- **Typeface**: Zilla Slab (Bold for labels, Regular for body, tabular figures for prices). Sturdy, a little odd, not Western-poster cliche. Avoid Rye and similar saloon faces.
- **Shape language**: chunky silhouettes built from 5 to 9 straight or single-arc segments, cut corners rather than rounded ones. One outline weight (3 px at 1x) everywhere. Shade is a second flat shape or parallel hatch lines, never a gradient. Each fill is offset 1 to 2 px from its outline (print misregistration), seeded per entity so it is stable. Outlines get a small per-vertex jitter fixed at spawn.
- **UI**: no cards. Ledger rows separated by ink rules; panels are bone sheets with a single cut corner and an ink border. Buttons are stamped labels: ink-filled rectangle, bone text, pressed state shifts 2 px and inverts. Market is a price ledger with hand-ruled columns and a tiny hatch sparkline. Damage numbers are small ink stamps.
- **Feedback without glow**: hit = 2-frame full-ink silhouette flash + 60 ms hitstop + chip shapes (angular wood/stone chips that land and stay briefly). Pickups hop on a squash curve.
- **Mood**: stubborn, practical, dry-humoured. Daylight work, then a fight.
- **Risks**: bone + madder drifts toward the "cream + terracotta" default if softened. Keep ink dominant and the spot colours saturated and scarce.

### Option B: "Dusk Lantern" (low-res procedural pixel)

Render to a 320x180 buffer, integer-scale, nearest-neighbour. Light is ordered dithering, never blur.

- **Palette (8)**: Night `#12131C`, Slate `#2B2F45`, Dusk blue `#56607A`, Fog `#A9B2B0`, Lantern `#E8D9A8`, Ember `#E0843A`, Herb `#7FB069`, Blood `#C2455A`.
- **Typeface**: a custom 5x7 bitmap font defined as data in code (most authored), or Silkscreen as fallback.
- **Shape language**: 12 to 16 px sprites generated from small hand-authored masks with mirrored symmetry and a 1 px dark outline; 2-frame idle bob. Lantern radius drawn with a 4x4 Bayer dither into Slate.
- **UI**: 1 px Fog borders on Night, square corners, inventory as a tight grid, numbers right-aligned in the bitmap font.
- **Mood**: watchful, cosy under threat (Dome Keeper / Loop Hero lineage).
- **Risks**: dark background plus a warm light is adjacent to "neon on dark" if any blur creeps in; small sprites make crafting items hard to distinguish; pixel art invites comparison with strong incumbents.

### Option C: "Surveyor's Cyanotype"

The whole game is a field survey drawing: white line on Prussian blue, two spot colours.

- **Palette (5)**: Prussian `#1F3A5F`, Deep `#152842`, Chalk `#EEF3F2`, Stake yellow `#F2C14E`, Flag red `#E4572E`.
- **Typeface**: Averia Serif Libre (soft, slightly blurred-by-averaging letterforms, reads like worn print).
- **Shape language**: line-only, one weight (2 px), no fills except spot-colour flags; terrain as hachure and contour strokes; enemies as bristling line clusters; resources as survey symbols.
- **UI**: annotations and leader lines pointing at things in the world instead of panels; market as a tabulated survey sheet.
- **Mood**: cool, exacting, a bit eerie.
- **Risks**: reads abstract and cold, weakest fit for "scrappy"; line-only combat is harder to read in a crowd; blue ground is close to the "navy techy" tell HN commenters named.

### Recommendation: Option A

Reasons: (1) a daylit flat-print look is the furthest of the three from the confirmed tells (neon-on-dark, glow, gradients, glass); (2) thick outline + flat fill is the most forgiving thing to generate procedurally and matches what is praised in Brotato (clean thick lines) and Dome Keeper (readability under load); (3) the three spot colours map one-to-one onto the game's three pillars, so colour carries meaning in the arena, the workshop and the market; (4) misregistration and fixed jitter give a hand-made signature that costs a few lines of code. B is the fallback if the owner wants night and atmosphere.

---

## 6. Do not ship if

Visual
1. Any gradient exists (fills, text, buttons, backgrounds), or any purple/indigo/violet anywhere.
2. Anything glows, blurs, or casts a soft drop shadow; any glass/translucent panel.
3. An emoji appears anywhere: UI, item icons, toasts, page title, README screenshots.
4. Any colour on screen is outside the fixed palette, or a palette colour is used outside its assigned job.
5. The UI is rounded-rectangle cards, nested boxes, or a row of three identical icon+heading+text tiles.
6. Text is in Inter, Roboto, Arial or the system stack, or more than one type family is in use.
7. Icons and world art come from different shape rules or line weights.
8. The title screen is a centred logo, tagline and one big button over an animated background.
9. Particles or motion run that are not caused by a game event.
10. A screenshot with the HUD cropped out could be from any other game.

Text
11. Any em dash, or any of: delve, tapestry, testament, realm, embark, forge your destiny, unleash, ancient evil.
12. Any "It's not X, it's Y" sentence, or a list of exactly three adjectives or benefits.
13. A proper noun that a name generator would produce (Eldoria, Elara, adjective+noun places). Names should come from the setting's work: people, tools, landmarks.
14. A tooltip that restates its label, or that explains what a button obviously does.
15. Title Case On Labels And Sentences, bold scattered for emphasis, or exclamation marks in system text.
16. Flavour text longer than two short lines, or any that could be moved to a different item unchanged.
17. A modal, wall of text, or "Welcome to..." on first launch; an achievement for a trivial first action.

Design
18. An upgrade exists whose whole effect is a small percentage on one stat. Each upgrade must change a decision.
19. Any system can be removed without the others noticing. Arena drops must be the crafting inputs; crafted goods must change the next fight; the market must price what players actually lack.
20. Wave 10 plays like wave 2 with bigger numbers; no new enemy behaviour, no pressure on the build.
21. Numbers are round placeholders (10, 50, 100, +5%) that nobody tuned by playing.
22. More time in a first session is spent in menus than in the clearing.
23. The first 30 seconds do not teach move, hit, gather by doing them.
24. A feature is listed that is one screen deep (a "skill tree" with five linear nodes, a "market" with fixed prices).

Polish
25. A hit has no response: no flash, no hitstop, no knockback, no sound.
26. There is no audio, or audio cannot be muted, or it starts before a user gesture.
27. Resize, fullscreen, tab-blur, pause, or device-pixel-ratio change breaks layout, timing or input (stuck keys, time jump on refocus).
28. Frame rate drops with a full wave on a mid laptop; no entity or particle caps.
29. Any button, link or menu entry does nothing, or two screens solve the same problem with different components.
30. No screenshake/flash toggle; progress is lost on refresh; an error state shows a raw exception or a blank screen.

---

## Source list (all snippet-level, see limits)

- https://news.ycombinator.com/item?id=49290499 (Ask HN: How can you tell a site/app is vibe coded?)
- https://news.ycombinator.com/item?id=45871787 , https://news.ycombinator.com/item?id=45622944
- https://paperpilot.dev/garden/recognizing-vibe-coded-games
- https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui , https://pages.thefountaininstitute.com/posts/7-tells-that-a-ui-is-ai-generated
- https://www.925studios.co/blog/ai-slop-design-tells
- https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p
- https://dev.to/james_anderson_h/the-purple-gradient-problem-why-ai-ui-all-looks-alike-and-how-to-fix-it-3j65
- https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website
- https://codemyspec.com/blog/vibe-coded-websites-look-the-same
- https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c
- https://vibecodekit.dev/ai-slop-design , https://github.com/iRehmanAhmad/deslop
- https://www.hustletoai.com/blog/programming-7/how-to-tell-if-a-website-is-vibe-coded-120
- https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing , https://the-decoder.com/heres-how-to-spot-ai-writing-according-to-wikipedia-editors/ , https://www.pangram.com/signs-of-ai-writing
- https://itch.io/post/11060499 (Eldoria)
- https://steamcommunity.com/app/2411200/discussions/0/564798922323821062/ , https://steamcommunity.com/app/1466060/discussions/0/688619018316320021/ , https://steamcommunity.com/app/1601570/discussions/0/604160267118483770/
- https://levels.io/winners-of-the-2025-vibe-code-game-jam , https://www.michaelscheiwiller.com/blog/vibe-jam-link-rot , https://www.indiehackers.com/post/tech/pieter-levels-just-announced-the-winners-of-the-2025-vibe-code-game-jam-Uz0wHG4pI3KBOiFhP5YR
- https://steamcommunity.com/app/2605790/discussions/0/4358997997658938531 , https://www.wayline.io/blog/blessing-roulette-boosts-roguelite-engagement
- https://brkeogh.com/2017/03/31/an-incomplete-game-feel-reader/
- https://www.shacknews.com/article/123099/loop-hero-review-happy-death-day , https://thesixthaxis.com/2021/03/04/loop-hero-review
- https://shacknews.com/article/132448/dome-keeper-review , https://pcgamer.com/dome-keeper-review
- https://superjumpmagazine.com/brotato-is-a-tasty-roguelike-snack
- https://en.wikipedia.org/wiki/Vampire_Survivors , https://www.pcgamer.com/uk/vampire-survivors-didnt-rip-off-castlevania-sprites-after-all/
- https://eev.ee/blog/2016/05/25/under-construction-our-pico-8-game/ , https://www.sprite-ai.art/guides/pixel-art-color-palettes
