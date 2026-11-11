# Arena survivor-like research: principles and numbers for a wave-arena + gather/refine/craft fusion

Date: 2026-11-11

## 0. How to read this (method and confidence)

- **Direct page fetches were blocked in this session** (brotato.wiki.spellsandguns.com, en.wikipedia.org and others are outside the session's network allowlist). Everything marked **[V]** was verified only through web-search result extracts of the cited page, not by reading the full page. Treat exact numbers as "good starting points, re-check against the wiki before hard-coding". To let a later pass read the wiki tables directly, `brotato.wiki.spellsandguns.com` (and ideally `vampire.survivors.wiki`, `deeprockgalactic.wiki.gg`) must be allowed in the session's network settings.
- **[V]** = stated by a cited source. **[V-conflict]** = sources disagree; both given. **[I]** = my own inference / design judgement. **[M]** = from my memory of the game, not confirmed by a source this session.
- I could not find: a Brotato developer postmortem on wave length, the Brotato i-frame duration, the per-tier shop rarity table values, DRG:Survivor shop prices, or the Vlambeer "Art of Screenshake" primary source. These are flagged where they matter.

---

## 1. Why these games are compulsive

### 1.1 Loop timings

**Brotato-style wave arena [V]**
- 20 waves. Durations: 20, 25, 30, 35, 40, 45, 50, 55, 60 s for waves 1-9, then 60 s for waves 10-19, 90 s for the wave-20 boss. (https://brotato.wiki.spellsandguns.com/Waves, corroborated by https://wiki.biligame.com/brotato/Enemies)
- Derived [I]: total combat time = 360 + 600 + 90 = **1,050 s = 17.5 min**; with shops a run is ~25-30 min (a comparison page also cites ~25-30 min: https://neptunepirateradio.com/games/brotato/review-comparisons).
- Time to first upgrade: **20 seconds** (end of wave 1 -> level-up picks + shop). First level-up needs 16 XP and wave 1 spawns ~24-30 one-material enemies, so the player levels once inside the first 20 s. (XP: https://brotato.wiki.spellsandguns.com/Experience ; spawn counts: https://gameplay.tips/guides/brotato-ultimate-guide-to-enemies-and-waves.html, older data)
- Decision density [I]: each shop visit = 4 offers + reroll/lock + combine/recycle + 1-3 level-up picks (4 options each [V], https://brotato.fandom.com/wiki/Upgrades). That is roughly 6-12 meaningful choices every 20-60 s of combat, i.e. **the game alternates ~45 s of execution with ~20-40 s of pure decision**. In-wave decisions are positional only (kite, collect, hug a tree).

**Vampire-Survivors-style continuous run [V]**
- Soft time limit 15/20/30 min by stage (Wikipedia: https://en.wikipedia.org/wiki/Vampire_Survivors). Waves change every minute; each wave has a minimum enemy quota and spawn interval, refilled if under quota. (https://vampire.survivors.wiki/w/Enemies)
- First level needs 5 XP, then +10 XP per level (see 2.6), so the first pick arrives in a few seconds and picks come every ~10-20 s early on.
- Halls of Torment: 30-min runs ending in a Lord boss (https://en.wikipedia.org/wiki/Halls_of_Torment). DRG: Survivor: runs split into short stages, each ending when an elite is killed, then a 30 s drop-pod timer, then a shop (https://techraptor.net/gaming/guides/deep-rock-galactic-survivor-guide).

**Takeaway [I]:** the two successful shapes are (a) continuous 15-30 min with a pick every 10-30 s, or (b) chunked 20-90 s bursts with a dense decision phase between. Brotato's shape is friendlier to a crafting layer because it already has a legal "stop and think" beat.

### 1.2 Power-curve shape

- Brotato enemy HP is **linear per wave** (base + perWave x (wave-1)) [V] (https://brotato.wiki.spellsandguns.com/Enemies), while player power is **multiplicative** (6 weapon slots x tier doubling x % damage x attack speed x crit). The player goes from "barely killing 3-HP fodder" to deleting screens; the wave-20 boss and elites re-impose a check. [I]
- Price inflation is also linear (~+10% of base per wave, section 2.2), while income is superlinear (more enemies + Harvesting compounding 5%/wave). So purchasing power grows through the run even as prices triple. [I from V numbers]
- VS: XP per level grows linearly with step changes at level 20 and 40 (deliberate walls) [V]; enemy quota/tier rises each minute; the fantasy peaks around minutes 10-25, then Death ends the run.
- The designer of VS said slot-machine work taught him how much sound/animation detail goes into each "press", and the chest-opening sequence borrows that. He also pushed back on the claim that gambling mechanics were the main lesson. (https://www.androidpolice.com/vampire-survivors-developer-interview/ ; secondary: https://uk.news.yahoo.com/vampire-survivors-developers-used-gambling-113208733.html)
- An academic commentary frames the hook as competence (mastery/power) + autonomy (build freedom) with a "just-one-more-go" structure. (same Yahoo/Univ. of Portsmouth article)

### 1.3 How build identity emerges

- Brotato's designer stated the goal: combine survivor-like hordes with **auto-chess shop mechanics** so players create builds from weapon synergies and combinations [V] (quoted in launch press, e.g. https://www.bluesnews.com/s/261135/brotato-official-launch).
- Concrete identity machinery [V]:
  - **Character = a rule-bending constraint** (e.g. one weapon only, 12 weapons, no weapons; XP need -66% or +200%). (https://brotato.wiki.spellsandguns.com/Weapons, https://brotato.wiki.spellsandguns.com/Experience)
  - **Weapon class set bonuses** scaling with count 2..6 (e.g. Blade: +1 melee dmg/+1% lifesteal at 2, +5/+5% at 6). (https://brotato.fandom.com/wiki/Weapons)
  - **Shop bias toward what you own**: 65% item / 35% weapon per slot; weapon rolls have a chance to match an owned weapon or its class, with a bonus in waves 1-5; items have a 5% chance to come from your character's tagged pool. (https://brotato.wiki.spellsandguns.com/Shop ; the Weapon Classes page gives 15% for class match - [V-conflict] on exact figure)
  - **Combine**: two identical same-tier weapons -> one of next tier. This makes duplicates exciting instead of dead. (https://brotato.wiki.spellsandguns.com/Weapons)
- [I] The identity is "committed by the shop bias": your first two purchases tilt the odds, so the run narrows into a recognisable archetype by wave 4-6 without a skill tree.

### 1.4 What creates "one more run"

- [I, supported by the above] (1) Run is short enough that failure costs < 30 min; (2) the first 60 seconds already contain a reward and a choice; (3) a new character/constraint is unlocked or teased on the death/win screen; (4) the previous run ended with a visible "if only I had X" (near miss); (5) difficulty ladder (Danger 0-5) gives a clean next goal per character.
- VS-style: a steady drip of unlocks/achievements; analysis pieces cite near-miss and intense audiovisual reward. (https://medium.com/@mattcanik/vampire-survivors-e388708d6545 - opinion piece)

---

## 2. Tuning numbers worth borrowing

### 2.1 Wave structure and enemies (Brotato) [V unless noted]

| Item | Value | Source |
|---|---|---|
| Waves | 20; 20 s -> 60 s in +5 s steps, 60 s plateau, 90 s boss | wiki Waves |
| Wave-1 population | ~24-30 basic enemies in 20 s (older guide) | gameplay.tips |
| Basic fodder | 3 HP, +2 HP/wave, speed 200-300, dmg 1, drops 1 material, from wave 1 | wiki Enemies / brotator.com/enemies |
| Fast swarm | 1 HP, +1/wave, speed 380, spawns in groups, from wave 2 | same |
| Charger | 4 HP, +2.5/wave, speed 400, dmg +0.85/wave, charge cd 2.5-3.5 s, from wave 3 | same |
| Bruiser | 20 HP, +11/wave, speed 300, dmg 2 (+0.85/wave), drops 3, from wave 8 | same |
| HP formula | HP(w) = base + perWave x (w-1) | wiki Enemies |
| Elites | appear from higher difficulty on waves 11-18; elite on wave 11/12 has 75% HP | wiki Enemies / Dangers |
| Difficulty ladder | D1 new enemies; D2 elites/hordes begin; D3 +12% enemy HP/dmg; D4 +26%; D5 +40% and two bosses at 75% HP each (totals, not cumulative) | wiki Modding Effects, biligame wiki. [V-conflict]: one wiki entry lists a different D3 figure |
| Post-20 endless | every wave 60 s; Endless HP = round(HP x (1 + EndlessFactor x 2.25)); item price x (1 + EndlessFactor/5) | wiki Endless Mode |

Worked examples [I]: fodder at wave 10 = 21 HP, wave 20 = 41 HP; bruiser wave 20 = 229 HP. Enemy HP grows ~14x for fodder over a run, enemy contact damage grows much slower (0.85/wave).

VS reference [V]: stops periodic spawning at **300** live enemies; hard cap **500** (https://vampire.survivors.wiki/w/Enemies). Some enemies/bosses multiply HP by player level at spawn time. A Brotato forum post (old) reports a ~70 on-ground material cap.

### 2.2 Shop prices, inflation, rerolls [V]

- **Price(wave) = floor(base + wave + base x wave x 0.1)**, then x price modifiers. Example: base 70 -> 78 at wave 1, 230 at wave 20. (https://www.brotatobuilds.com/items/ for v1.1.15.4; same structure in wiki Endless page). So prices roughly **triple** over a run.
- Weapon base prices by tier, e.g. SMG 20 / 39 / 74 / 149; Pistol 10 (T1) ... 91 (T4). Roughly **~2x per tier**. (https://brotator.com/weapons/smg, https://www.metabrotato.com/weapons/pistol)
- **Reroll [V-conflict]:** wiki Shop page: first reroll = floor(wave x 0.75) + increase, rising with each reroll and resetting each shop; patch notes on that page mention base changed to wave/2 and per-reroll increase to 0.33 x wave. Use: `reroll_n = floor(0.5..0.75 x wave) + n x max(1, floor(0.33..0.5 x wave))`. An item can reduce reroll cost up to a 90% cap.
- Shop composition: 4 slots [M], 65% item / 35% weapon per slot; lock persists an offer to the next shop [M].
- Recycle/sell value: [M] 25% of current price - not confirmed this session.

### 2.3 Rarity curves [V partial]

- Shop tier chance = min(MaxChance, (BaseChance + ChancePerWave x (wave - MinWave)) x (1 + Luck%)), rolled from Tier 4 downward. Tier 2 from shop 2, Tier 3 from shop 4, Tier 4 from shop 8. (https://brotato.wiki.spellsandguns.com/Shop)
- Forum-reported caps: Tier 2 max 60%, Tier 3 max 25%; Tier 4 at wave 15 = 1.8% at 0 Luck, 7.4% at 300 Luck (anecdotal: Steam discussion 3807278624248688907).
- Level-up upgrade rarity: Legendary can roll from level 8, +0.23%/level, max 8%; level 5 always Uncommon; levels 10/15/20 always Rare. Stat-upgrade values scale 1x/2x/3x/4x by tier (armor 1/2/3/4, dodge 3/6/9/12). (https://brotato.fandom.com/wiki/Upgrades, https://brotato.wiki.spellsandguns.com/Upgrades)
- [M] my recollection of the tier table is roughly T2 ~6%/wave, T3 ~2%/wave, T4 ~0.23%/wave with max 8% - consistent with the legendary figure above but not confirmed for the shop.

### 2.4 Economy [V]

- Materials are both currency and XP (1 pickup = 1 gold + 1 XP).
- Drop chance 100% until wave 5, then reduced by 1.5% x wave (wave 20 = 70%). (https://brotato.wiki.spellsandguns.com/Materials)
- **Uncollected materials go to a "bag"; next wave each drop withdraws one from the bag, doubling its value until the bag is empty.** Missing pickups is delayed, not lost. (same)
- Harvesting: pays X materials + X XP at wave end, then the stat grows 5% (rounded up); after wave 20 it decays 20%/wave. (https://brotato.wiki.spellsandguns.com/Harvesting)
- Loot crates drop rarely (scales with Luck), contain a free item that can be taken or recycled, auto-collected at wave end. (https://brotato.fandom.com/wiki/FAQ)

### 2.5 Player stats [V]

- Armor: damage taken = 1 / (1 + Armor/15) -> 15 armor = 50% DR, 30 = 67%. No cap, diminishing returns built into the formula. (https://brotato-builds.com/stats/armor)
- Dodge: hard cap 60% (special characters 70% / 90%). (wiki Stats)
- I-frames exist after each hit (https://brotato.wiki.spellsandguns.com/Iframes) - duration not retrieved. [M] ~0.4 s. [I] Recommended start: 0.4-0.5 s with a visible flash.
- VS: pickup ("Magnet") base 30 units, multiplicative modifiers, no cap. (https://vampire.survivors.wiki/w/Magnet). [I] start pickup radius at ~1.5-2 player widths; make it a buyable stat.

### 2.6 XP curves [V]

- Brotato: XP to next level = **(Level + 3)^2** (16, 25, 36, ...). A normal 20-wave run ends around level 23-24. (https://brotato.wiki.spellsandguns.com/Experience)
- VS: level 1->2 = 5 XP; +10 per level to 20; +13 per level 21-40; +16 after; extra walls of +600 at level 20 and +2,400 at level 40, offset by a temporary +100% Growth at those levels. (https://vampire.survivors.wiki/w/Level_up)

### 2.7 Weapon DPS ranges [V]

- SMG: 3/4/5/8 damage, 0.17 s cooldown (0.15 at T4): ~18 DPS at T1 -> ~53 DPS at T4. Pistol: ~10 DPS T1 -> ~57-72 DPS T4 [V-conflict between calculators]. Fist: 8/16/32/64 damage, cooldown 0.78 -> 0.59 s. (https://brotator.com/weapons/smg, https://www.metabrotato.com/weapons/pistol, https://www.brotatobuilds.com/weapons/, https://gemelog.jp/en/games/brotato/weapons/)
- [I] Rule of thumb: T1 weapon ~10-20 base DPS, each tier ~1.5-2x, T4 ~50-75 base DPS before stats; six slots; damage stat adds flat per-hit damage so fast weapons scale with flat, slow weapons with %.

---

## 3. Game feel / juice essentials (2D)

Evidence quality here is lower: the primary talks (Jonasson & Purho "Juice it or lose it", 2012; Vlambeer's screenshake talk) were not retrievable; numbers come from secondary blog guides and are starting points only.

**Essentials, in priority order [I, with V where cited]**
1. **Responsive movement first.** Several guides stress juice cannot fix sluggish controls (https://gamemaker8.com/design/game-feel-juice-what-makes-controls-feel-good-why-matters-more-than-graphics/). Instant acceleration, no input lag.
2. **Hit confirmation on every enemy hit:** 1-2 frame white flash + small knockback + a short, pitched-varied hit sound. Cheap, readable, scales to hordes.
3. **Death pop:** enemy scales/squashes and bursts into a few particles and a material drop that arcs out. The drop is the reward; make its spawn visible.
4. **Pickup magnetism:** accelerate pickups toward the player inside the radius, with a rising-pitch chime sequence on consecutive pickups; vacuum everything at wave end (Brotato auto-banks leftovers [V]).
5. **Hit-stop:** "a few frames" on significant hits, scaled to strength (https://freegamesprites.com/en/news/game-feel-2d-combat-juice-tricks). [I] In horde games reserve it for player-taken damage, elite/boss kills and crits on big weapons: ~30-60 ms. Never on every fodder kill; with 6 auto-weapons it would freeze the game continuously.
6. **Screen shake:** light 1-2 px for ~100 ms, heavy 4-8 px for ~250 ms; directional beats random; duration matters more than amplitude (https://falcon.so/resources/game-design/juice and similar). [I] Use a trauma accumulator with a hard cap and a settings slider.
7. **Damage numbers:** [I] aggregate per enemy per ~0.2 s, cap simultaneous numbers (~30-40), emphasise crits by size/colour, provide an off toggle.
8. **Audio layering:** [I] limit simultaneous voices per sound category (e.g. max 3-4 hit sounds per frame-window), randomise pitch +/-5-10%, duck music slightly on level-up/chest. VS's designer singled out the chest jingle and reward sequence as worth disproportionate polish [V] (Android Police interview).
9. **Player-hurt feedback must outrank everything:** distinct sound, red vignette, brief hit-stop, i-frame flicker.

**Commonly overdone [V + I]**
- Shake on every hit: guides call screen shake "the most-abused" technique (falcon.so). 
- Effect saturation: "over-juicing floods the screen until players cannot tell important events from noise" (same family of guides).
- Readability loss: Rock Paper Shotgun (as cited on Wikipedia's Vampire Survivors-like page) said most clones separated the player from visual clutter worse than the original (https://en.wikipedia.org/wiki/Vampire_Survivors%E2%80%93like). A Warhammer Survivors review praised distinct silhouettes and restrained VFX, and flagged one glow effect that made the area unreadable (https://bloody-disgusting.com/video-games/3975275/).
- Accessibility: provide shake/flash toggles; motion sickness is a cited issue.
- [I] Rule: **enemy projectiles and the player sprite are always drawn above player VFX, in a reserved colour**; player effects get lower alpha as their count rises.

---

## 4. Common design mistakes and player complaints (with evidence)

1. **Dead / low-value stats and filler upgrades.** Brotato players call Range "useless at this point", Harvesting "rarely worth investing in", and complain that "a majority of tier 1 stat upgrades throughout the run feels terrible"; one character had level-up choices that "felt useless", later patched to block nonsensical offers. (Steam discussions: https://steamcommunity.com/app/1942280/discussions/0/3408678077964453746/, https://steamcommunity.com/app/1942280/discussions/0/839502760396207294/)
2. **Solved meta: damage beats everything.** "The only way to win in nightmare is to go pure damage"; "clear speed feels like the only valid meta"; "defense focused builds are pretty bad, even though there are tons of items designed for exactly that." (https://steamcommunity.com/app/1942280/discussions/0/653730014598062812/, negative reviews https://steamcommunity.com/app/1942280/negativereviews/)
3. **Difficulty by HP inflation.** New hard mode criticised as "just tripling the health of everything and adding bullet spam". (same thread)
4. **Economy stats are front-loaded traps.** Guides say economy must be bought early or not at all; a saving-focused character "always seems vastly under-powered around waves 9 to 15". This is a must-pick-early / never-pick-late stat, i.e. low real choice. (https://steamcommunity.com/app/1942280/discussions/0/601895119916907149 and guide pages)
5. **RNG deciding runs at high difficulty** ("RNG fiesta"; Luck "absolutely god"). (Brotato Steam threads)
6. **Boring/weak early game.** Warhammer Survivors review: lack of reliable weapons until later means newcomers "bounce off before runs get as interesting" - called a root-level design problem (https://www.gamewatcher.com/warhammer-survivors/review). VS is described by some as "too slow" versus Brotato (https://rogueranker.com/games-like-brotato/).
7. **Meta-progression that is just grind.** DRG: Survivor: threads titled "mid and late game grind is too boring", "This game's progression feels terrible", "Annoyingly grindy update"; TechRaptor called meta-progression "the overall weakest part"; after unlocks "the only remaining progression is small stat increases" (https://steamcommunity.com/app/2321470/discussions/0/6678353284412007334/, https://techraptor.net/gaming/reviews/deep-rock-galactic-survivor-review-underground-excess). Soulstone Survivors: meta tree "nearly useless", "one hell of a grind", levelling all characters to 70-80 "so tedious" (https://steamcommunity.com/app/2066020/discussions/, https://leveluptalk.com/news/soulstone-survivors-update-82-grind-and-success/).
8. **Too many overlapping systems.** Soulstone: "a lot going on with various upgrade options"; DRG:S thread "Progression system is overwhelming". DRG:S devs simplified controls because players were overwhelmed (https://howtomarketagame.com/2024/04/08/how-creating-a-spinoff-for-a-hot-genre-lead-to-success-for-deep-rock-galactic-survivor/).
9. **Timers that punish the fun part.** DRG:S 30 s drop-pod timer has long hostile threads and a mod to extend it (https://steamcommunity.com/app/2321470/discussions/0/7607215340159995548/).
10. **Visual clutter** (section 3).
11. **Sameness of weapons** ("90% of the weapons feel the same", Brotato negative review).

---

## 5. Gather / refine / craft precedents and what players said

**DRG: Survivor - mining inside the arena** [V]
- Rock walls are destructible terrain; ore veins (gold, nitra, and meta "upgrade resources") sit inside them. Gold = in-run shop currency and level-up rerolls; nitra = weapon upgrades between stages; meta minerals = permanent upgrades. Each stage spawns two meta-resource deposits. (https://techraptor.net/gaming/guides/deep-rock-galactic-survivor-resources-guide)
- Praise: mining "makes each run feel more dynamic"; reviewers single out tunnelling as the differentiator; TechRaptor praised the mining + small-stage format (https://rogueliker.com/deep-rock-galactic-survivor-review/, https://lootlevelchill.com/reviews/deep-rock-galactic-survivor-review/). Sold 1M within about a month of early access (howtomarketagame).
- Complaints: default mining "feels too slow"; permanent upgrades "require mining resources that are useless during a run" (i.e. the player is taxed mid-run for something with no in-run payoff); the end-of-stage timer cuts gathering short. (Steam threads above)
- Lesson [I]: gathering works when it is **spatial and simultaneous with combat** (a positioning decision), and fails when it is a slow channel or pays only into out-of-run grind.

**Halls of Torment - item retrieval** [V]
- Items found in-run are lost unless sent up via the Well: normally **one item per run**, which leaves the current run when sent, then must be bought with gold from the Wellkeeper to own permanently. (https://thenerdstash.com/how-to-get-items-in-halls-of-torment/)
- Reception: "encourages boring grinding ... running over and over for one item each time"; "the well system is rather unintuitive"; requests to keep an item on a win. A developer-side reply says the limit exists to extend playability. Extra buckets later allow more. (https://steamcommunity.com/app/2218750/discussions/2/6643422965385569283/, https://steamcommunity.com/app/2218750/discussions/2/3803902423383192704/, https://steamcommunity.com/app/2218750/discussions/0/3833171785697991533/)
- Lesson [I]: "extract one thing" creates a strong give-up-now-for-later decision, but a hard cap of one reads as artificial padding. Scale the extraction capacity with performance.

**Soulstone Survivors - material crafting/runes/trees** [V]
- Multiple currencies feed weapon crafting, runes, skill trees. Depth is praised by some; the dominant complaint is small-percentage upgrades and long grinds, and "too much going on". (Metacritic user reviews https://www.metacritic.com/game/soulstone-survivors/user-reviews/?platform=pc ; Steam threads)

**Death Must Die - persistent randomised gear** [V, thin]
- Gear drops persist between runs, is shareable across characters, and a pre-run shop sells gear. Reviews are mostly positive about "meaningful, unique items"; the early game is described as grindy. (https://game8.co/reviews/death-must-die/death-must-die-review, https://yaninagames.com/blog/death-must-die-review/). I found no solid evidence on power-creep complaints.

**Brotato itself** [V]: trees are in-arena nodes that drop fruit/crates; crates are a "free item or recycle for materials" choice auto-collected at wave end. This is already a micro gather loop with zero time cost.

**Shared-economy cautions (MMO sources, not roguelite-specific)** [V]: bots flood markets and collapse prices; auction taxes/fees are the standard sink; high listing fees kill the mid-tier market; design sinks that consume items, not just currency. (https://onemanmmo.com/bots-break-the-economy-before-they-break-the-fun/, https://gdkeys.com/keys-to-economic-systems/, https://en.wikipedia.org/wiki/Gold_sink). No roguelite precedent with a real player market was found - this is the genuinely novel and riskiest part of the design.

---

## 6. Recommendations for the fused design

1. **Keep the 20-60 s wave / decision-phase rhythm exactly; make crafting the decision phase, not a third phase.**
   Rationale: the loop's strength is ~45 s action then ~30 s of dense choices, with the first reward at 20 s. Replace "4 random shop offers" with "4 random recipes/blueprints offered; you pay with what you gathered this wave". Crafting must be one click with instant result - no timers, no minigame. Target: decision phase stays under ~40 s median. (Sections 1.1, 4.8)

2. **Gathering must be spatial and concurrent with combat, never a channel.**
   Rationale: DRG:S mining is praised as the differentiator when it changes pathing, and criticised when it is slow. Use nodes that weapons/auto-attacks or proximity break (like Brotato trees), placed so that going for them pulls the player into danger. Node HP should be ~1-2 s of the build's DPS at that wave. Dropped resources use the same magnet/auto-bank rules as materials, including the "missed pickups pay double next wave" rule. (Sections 2.4, 5)

3. **Two resource tiers only in-run: one universal currency (gold+XP) plus 3-4 typed raw materials; "refine" is an automatic end-of-wave conversion affected by stats.**
   Rationale: complaints about Soulstone/DRG:S are about too many currencies and about resources that do nothing in the current run. Every raw material must have an in-run use this wave; surplus is what flows out to the persistent economy. A "Refining" stat (analogous to Harvesting, +5%/wave compounding) gives an economy build without a separate UI. Cap or late-buff it to avoid the "buy early or never" trap. (Sections 2.4, 4.4, 4.7)

4. **Borrow the price and rarity curves but express them as recipe cost and quality.**
   Start: cost(wave) = floor(base + wave + 0.1 x base x wave); quality tiers gated at shops 2/4/8 with caps near 60% / 25% / 8%; reroll = floor(0.5 x wave) + n x floor(0.33 x wave), resetting each shop; combine two identical same-tier weapons into the next tier (~2x price, ~1.5-2x DPS per tier); 65/35 item/weapon split with a bias toward owned weapon classes. These are proven to produce build commitment by wave 4-6. (Sections 2.2, 2.3, 1.3)

5. **Extraction, not accumulation, feeds the shared economy; scale it with performance.**
   Rationale: Halls of Torment's "one item per run" produced a real decision and real resentment. Let the player bank a limited cargo that grows with waves cleared (e.g. 1 slot per 4 waves, bonus on a win), with a choice each time between "use it now for run power" and "ship it out". This gives the economy a supply throttle (anti-inflation, anti-bot) tied to skill, and makes dying at wave 15 still worth something. (Sections 5, 4.7)

6. **Persistent/market items must add options, not percentages - and never be required to clear base difficulty.**
   Rationale: the strongest and most consistent complaint across DRG:S and Soulstone is meta-progression that is small stat increments ground out over hours. Market goods should be sidegrades: starting weapons, character-like constraints, recipe pool unlocks, cosmetics, and consumable run modifiers (which are also item sinks). Add a transaction tax and make crafted starting gear wear out or be consumed on use so value leaves the system. Keep any stat power from persistent gear to a small bounded band (e.g. <= ~10-15% of a wave-20 build). (Sections 4.7, 5)

7. **Design against the "pure damage" meta and dead stats from day one.**
   Rationale: Brotato's top complaints. Concretely: (a) scale difficulty with enemy behaviours and mixes, not HP multipliers (keep difficulty HP bonus <= +40% as Brotato does); (b) give defensive/utility stats an offensive conversion path (items that convert armor, speed, pickup radius, gathering into damage) so no stat is dead for every build; (c) filter offers so a build never sees stats it cannot use; (d) use formulas with built-in diminishing returns (damage taken = 1/(1 + armor/15)) and hard caps on avoidance (60%). (Sections 2.5, 4.1-4.3)

8. **Budget juice and readability as a system, with caps.**
   Rationale: clutter is a genre-wide complaint and a browser game also has a performance ceiling. Set caps up front: ~300 live enemies (VS stops spawning at 300), aggregated damage numbers, max concurrent hit sounds, shake trauma cap, hit-stop only for hurt/elite/boss events, enemy projectiles in a reserved colour always on top, and shake/flash/number toggles. Spend the saved budget on the three moments that matter: pickup vacuum, craft/combine result, and wave-clear. (Section 3)

---

## 7. Source list

- Brotato wiki: /Shop, /Waves, /Enemies, /Experience, /Materials, /Harvesting, /Weapons, /Weapon_Classes, /Endless_Mode, /Dangers, /Iframes, /Upgrades - https://brotato.wiki.spellsandguns.com/
- https://www.brotatobuilds.com/items/ , https://www.brotatobuilds.com/weapons/ , https://brotator.com/enemies , https://brotator.com/weapons/smg , https://www.metabrotato.com/weapons/pistol , https://brotato-builds.com/stats/armor , https://gemelog.jp/en/games/brotato/weapons/
- https://brotato.fandom.com/wiki/Upgrades , https://brotato.fandom.com/wiki/Weapons , https://brotato.fandom.com/wiki/FAQ , https://wiki.biligame.com/brotato/Enemies
- https://gameplay.tips/guides/brotato-ultimate-guide-to-enemies-and-waves.html
- Brotato Steam discussions: https://steamcommunity.com/app/1942280/discussions/0/653730014598062812/ , .../3408678077964453746/ , .../839502760396207294/ , .../601895119916907149 , https://steamcommunity.com/app/1942280/negativereviews/
- https://www.bluesnews.com/s/261135/brotato-official-launch (designer statement), https://news.xbox.com/fr-fr/2024/02/09/entretien-exclusif-avec-thomas-gervraud-brotato-le-jeu-qui-a-de-la-patate/
- Vampire Survivors: https://vampire.survivors.wiki/w/Level_up , /Enemies , /Magnet , /Curse ; https://www.androidpolice.com/vampire-survivors-developer-interview/ ; https://uk.news.yahoo.com/vampire-survivors-developers-used-gambling-113208733.html ; https://en.wikipedia.org/wiki/Vampire_Survivors ; https://en.wikipedia.org/wiki/Vampire_Survivors%E2%80%93like
- DRG: Survivor: https://techraptor.net/gaming/guides/deep-rock-galactic-survivor-guide , https://techraptor.net/gaming/guides/deep-rock-galactic-survivor-resources-guide , https://techraptor.net/gaming/reviews/deep-rock-galactic-survivor-review-underground-excess , https://rogueliker.com/deep-rock-galactic-survivor-review/ , https://howtomarketagame.com/2024/04/08/how-creating-a-spinoff-for-a-hot-genre-lead-to-success-for-deep-rock-galactic-survivor/ , Steam threads under https://steamcommunity.com/app/2321470/discussions/
- Halls of Torment: https://fullcleared.com/features/inside-halls-of-torment-an-interview-with-chasing-carrots/ , https://thenerdstash.com/how-to-get-items-in-halls-of-torment/ , Steam threads under https://steamcommunity.com/app/2218750/discussions/
- Soulstone Survivors: https://www.metacritic.com/game/soulstone-survivors/user-reviews/?platform=pc , https://leveluptalk.com/news/soulstone-survivors-update-82-grind-and-success/ , Steam threads under https://steamcommunity.com/app/2066020/discussions/
- Death Must Die: https://game8.co/reviews/death-must-die/death-must-die-review , https://yaninagames.com/blog/death-must-die-review/
- Game feel: https://falcon.so/resources/game-design/juice , https://freegamesprites.com/en/news/game-feel-2d-combat-juice-tricks , https://gamemaker8.com/design/game-feel-juice-what-makes-controls-feel-good-why-matters-more-than-graphics/ , https://www.gamewatcher.com/warhammer-survivors/review , https://bloody-disgusting.com/video-games/3975275/
- Economy: https://onemanmmo.com/bots-break-the-economy-before-they-break-the-fun/ , https://gdkeys.com/keys-to-economic-systems/ , https://en.wikipedia.org/wiki/Gold_sink
