# LLM-native mechanics for a wave-arena + crafting + shared-economy game

Research date: 2026-11-11.

## How to read this report

- **[S]** = stated by a source I found this session, cited by URL.
- **[R]** = my recollection from before this session, not re-checked.
- **[I]** = my own inference or design recommendation.

**Verification limit.** Page fetches were blocked in this session (aws.amazon.com, docs.aws.amazon.com, en.wikipedia.org, pcgamer.com, arxiv.org, news.ycombinator.com, debarghyadas.com all failed to resolve). Every [S] item is therefore from search-result summaries of the cited pages, not from reading the pages in full. The Bedrock prices in particular come from third-party pages and must be checked against https://aws.amazon.com/bedrock/pricing/ before budgeting.

## Recommendation in brief

1. Build semantic crafting, but the LLM only *selects* from a fixed vocabulary of effect primitives and five-step levels. Code owns every number, the point budget and the repair step.
2. Store levels in the recipe cache, never raw numbers, so a balance patch is a price-table change and no recipe is ever regenerated.
3. Determinism must come from the database, not the model: current small Claude models reject non-default sampling parameters, so "temperature 0" is not available.
4. Crafting must consume real inputs and have a tier cap. That single rule removes Infinite Craft's bot-farming and long-name-chaining problems.
5. Add at most one second mechanic: LLM-judged "contracts" (does this item fit this request?). Cut haggling, the appraiser, standalone AI flavour text and LLM-generated enemies.

---

## 1. Infinite Craft and other LLM games

### Infinite Craft

| Topic | Finding | Status |
|---|---|---|
| Model | Agarwal: "using the latest Llama 2 LLM from Facebook on the backend"; hosted by Together AI | [S] https://en.wikipedia.org/wiki/Infinite_Craft |
| Prompting | "Every time someone tries to craft something novel, I ask Llama 2 (the AI) with a prompt what the result should be." | [S] PC Gamer, https://www.pcgamer.com/this-browser-based-endless-crafting-game-starts-you-off-with-fire-and-water-but-it-quickly-escalates-to-god-the-big-bang-and-yin-yoda |
| Global cache | The same pair always gives the same result for every player | [S] Wikipedia; https://quuxplusone.github.io/blog/2024/02/08/infinite-craft/ |
| First discovery | A label under the element when nobody has made it before; no reward, title or unlock attached | [S] https://gamertweak.com/infinite-craft-first-discovery-meaning |
| Scale | 200,000 unique combinations tried by 2024-01-31; about 1,000 crafts per second by 2024-02-02; he asked Together AI for a higher rate limit; "It's been a struggle keeping the servers up" | [S] Wikipedia, citing Agarwal's posts |
| Cost handling | No cost figure found. The only confirmed levers are the global cache and a rate limit (HTTP 429 on rapid calls; scripts recommend about 300 ms spacing) | [S] https://github.com/reandov/automated-infinite-craft |
| Latency | The pair endpoint answers in about half a second | [S] https://blog.jverkamp.com/2024/03/14/infinite-craft-bot/ |
| Content filter | Offensive results are filtered; censored elements break recipes that used to work; incoherent results still occur | [S] Wikipedia; https://infinibrowser.wiki/info |
| Length cap | An element longer than 30 characters is "dead" and combines with nothing; names are normalised to one casing ("Neal Case") | [S] https://technicalinfinitecraft.miraheze.org/wiki/Dead_element |
| Bots | Public scripts brute-force the API and log firsts; one blogger made about 10,000 elements and about 1,000 first discoveries | [S] https://blog.jverkamp.com/2024/03/14/infinite-craft-bot/ , https://github.com/jakedog228/infinite-crafter |
| Client trust | Items can be injected by spoofing the API response on the client | [S] https://mathewsachin.github.io/blog/2026/04/08/hacking-infinite-craft.html |
| Community size | Fan sites report over 21 million recipes and 3 million items (unofficial) | [S] search summary of fan sites |

What I could not find: any statement by Agarwal on prompt text, cost per call, or how bots were handled. I found no press coverage of bot farming as a complaint; the evidence is the scripts themselves.

**Why it spread** [I, supported by coverage]: zero onboarding, a result within half a second, results that are funny and shareable, and "first discovery" turning a shared database into personal ownership. Guides tell players to chase long multi-word names because short ones are taken [S, gamertweak], which is the chaining complaint in practice: firsts become a function of name length, not ingenuity. The 30-character dead-element rule is the game's own counter.

**The gap you are targeting** [I]: Infinite Craft's elements have no mechanical meaning, so an incoherent result costs nothing. Destructoid: "experimentation really is all there is" [S].

### Clones

- OpenCraft (bufferhead-code, Vue), Infinite Sides (Ollama), Finite Craft (llama.cpp + Mistral-7B), Local Infinite Craft (WebLLM + Qwen 0.5B in browser) all exist as open-source clones [S] https://awesome.ecosyste.ms/projects/github.com%2Fbufferhead-code%2Fopencraft , https://www.github.com/Fus3n/infinite-sides , https://01postmortem.itch.io/local-infitcraft
- Finite Craft notes that none of the original's recipes carry over [S]. Lesson [I]: the recipe database, not the model, is the game. A clone with an empty cache has nothing.
- I found nothing on "LLM Alchemy" or "Infinite Kitchen".

### Other LLM games

| Game | What happened | Lesson | Status |
|---|---|---|---|
| What Beats Rock | LLM judges whether your free-text answer beats the previous one; viral July 2024; checks whether someone already gave a similar answer | A one-bit LLM verdict on open input is a complete mechanic | [S] https://knowyourmeme.com/memes/sites/what-beats-rock |
| Death by AI | Discord party game, AI judges survival plans; about 7 million users in weeks (Discord); 10-20 million (vendor claim); 1.2 billion tokens/day at peak | Judge mechanics scale socially; a player cheated by editing network requests | [S] https://discord.com/build-case-studies/playroom , https://inworld.ai/customers/death-by-ai |
| Suck Up! | Talk your way into NPC homes; a code-side "trust system" bounds the LLM; sells token packs to cover API cost; Steam score around 57-59% | Silly tone absorbs odd output; per-call cost passed to players hurts reception | [S] https://community.openai.com/t/vampire-game-where-you-convince-llm-to-let-you-in/604295 , https://raijin.gg/app/2726370/Suck_Up |
| Freysa | Pay-per-message contest to make an agent release funds; won on attempt 482 by redefining what its `approveTransfer` tool meant; about $47,000 | If an LLM's output moves value, players will break it | [S] https://simonwillison.net/2024/Nov/29/0xfreysaagent/ , https://the-decoder.com/hacker-wins-47000-by-tricking-ai-chatbot-with-smart-prompting/ |
| AI Dungeon | 2021 filter forced by OpenAI: false positives (banned over "four watermelons"), human moderators reading private stories, user revolt | Free-text input makes you a content moderator | [S] https://help.aidungeon.io/faq/openai-and-filters , https://www.theregister.com/2021/04/30/ai_dungeon_filter_vulnerabilities/ |
| AI Roguelite | LLM decides crafting output from ingredient names; all mechanics "AI-directed"; Very Positive on about 584 reviews, small audience | Closest prior art; niche because nothing is bounded or shared | [S] https://store.steampowered.com/app/1889620/AI_Roguelite |
| 1001 Nights | Coax an AI king into saying weapon words, which materialise; real-time scene generation was removed after weak demo feedback | LLM output mapped to a small fixed set of game objects works | [S] https://arxiv.org/pdf/2308.12915.pdf , https://kr-asia.com/how-book-of-infinity-1001-nights-uses-ai-to-let-players-tell-their-own-stories |
| Hidden Door | Early access August 2025; restricts actions to keep stories coherent; slow responses and glitches reported | Constraint is the product; latency is the complaint | [S] https://ianbicking.org/blog/2025/08/hidden-door-design-review-llm-driven-game |
| inZOI Smart Zoi | On-device small model for NPC thoughts; Nvidia-only; praised as novel, buggy; community split on any AI use | Ambient AI is a curiosity, not a reason to play | [S] thegameswiki.com (fan wiki) |
| Mantella | Skyrim NPC chat mod; "fine for a gimmick"; latency is the recurring complaint | Same | [S] https://www.pcgamer.com/games/the-elder-scrolls/this-skyrim-mod-that-makes-npcs-ai-chatterboxes-just-got-a-massive-overhaul/ |
| Oasis | AI-generated Minecraft; mocked as "dementia Minecraft" for lacking object permanence | No persistent state means no game | [S] https://aiweirdness.com/minecraft-with-object-impermanence |

**Landed vs. hollow** [I, drawing on the above and on two essays]:

- It lands when the LLM's answer becomes a small, legible, permanent game fact (a new element, a win/lose verdict, a weapon appearing) and the player's ingenuity is what is being tested.
- It feels hollow when the LLM produces unbounded prose or ambience with no stakes. "The fun of watching a black box produce unexpected outputs is short-lived if you don't have a meaningful way to interact with it" [S] https://spectrecollie.com/2026/03/09/the-only-way-to-win/
- Yonder's post-mortem: free-text input makes it harder to signal what is possible, and "the AI shouldn't have the power to change game variables directly" [S] https://blog.yonder.gg/p/what-happened-to-the-ai-game (seen via mirror).

---

## 2. Making generated content balanced and safe

**Published approaches**

- **LLM picks qualitative levels; designers own the numbers.** A 2026 Pokémon card-generation study predefines numeric values for "low/medium/high" and the LLM chooses only the level [S] https://arxiv.org/html/2604.27972 . This is the core of the spec below.
- **Constrained DSL over a fixed component system.** "Real-Time World Crafting" has the LLM emit a restricted DSL that configures an entity-component system for spell crafting; the DSL limits output to pre-validated operations. Model choice was the largest predictor of quality. Balance was not addressed [S] https://arxiv.org/abs/2510.16952
- **Constrained decoding for roguelike mechanics** guarantees semantic correctness of generated scripts, not balance [S] https://arxiv.org/html/2508.15866v1
- **Schema + balance rules + repair loop.** quest-forge validates items against schemas and custom balance rules, re-prompting on failure (a tool README, not a paper) [S] https://github.com/Koval09/quest-forge
- **Balance by simulation.** RuleSmith tunes rule parameters from LLM self-play win rates with Bayesian optimisation and warns that this may not transfer to human players [S] https://arxiv.org/html/2602.06232v1 . Cardiverse validates generated card games by running them in an engine and still needed manual checks [S] https://aclanthology.org/2025.emnlp-main.1511.pdf
- **Surveys** agree that runtime-generated items "can be inconsistent, unbalanced, unsafe" and that most LLM-as-designer work is mapping free text into game formats [S] https://arxiv.org/pdf/2402.18659 , https://arxiv.org/pdf/2410.15644 , https://www.alphaxiv.org/abs/2607.00527v2
- I found nothing specific on "Cardistry" or Word2World in this session.

**Prompt-injection guidance** (practitioner sources, not peer-reviewed) [S] https://dzone.com/articles/prevent-prompt-injection-allowlists-tools , https://arxiv.org/pdf/2608.10281

- Strict schema, enums for categories, length caps, numeric bounds validated in code.
- "LLM proposes, security layer decides."
- Prompt-level defences are a guardrail, not a boundary; string filtering does not defeat injection.

**What this means for you** [I]

1. No published work combines a point budget with a global recipe cache. The budget idea is sound but untested in the literature; plan to tune it yourself with simulation and telemetry.
2. A budget controls additive power. It does not control multiplicative synergy between items, which is where Brotato-style builds break. That needs character-level stat caps in the combat code, outside the LLM.
3. The safest injection defence is to give players no text field at all. The only LLM-authored text that re-enters prompts is item names, which you validate on the way in.

---

## 3. Cost and latency

### Prices (as of 2026-11-11, unverified against AWS)

| Model on Bedrock | Input $/MTok | Output $/MTok | Cache write 5 min | Cache read | Source |
|---|---|---|---|---|---|
| Claude Haiku 5.5, global endpoint | 0.10 | 0.50 | 0.125 | 0.01 | [S] third-party calculators and a launch post: https://custom.typingmind.com/tools/estimate-llm-usage-costs/amazon-bedrock/global-anthropic-claude-haiku-5-5 , https://dev.classmethod.jp/en/articles/bedrock-claude-haiku-5-5/ |
| Claude Haiku 5.5, US regional | about 0.11 | about 0.55 | 0.1375 | 0.011 | [S] same; roughly 10% above global |
| Claude Haiku 4.5 | 1.00 | 5.00 | — | — | Anthropic first-party list price (reference bundled with my tooling, cached 2026-11-03); Bedrock price not checked |

- Haiku 5.5 launched on Bedrock 2026-10-07 with model ID `anthropic.claude-haiku-5-5` [S, classmethod].
- Above 100K prompt tokens every rate is five times higher [S] https://www.buildmvpfast.com/blog/claude-haiku-5-5-api-pricing-high-volume-agents-2026 . Irrelevant at your prompt size.
- Uncertainty: none of these were read from AWS's own page. The first-party list price for Haiku 5.5 matches ($0.10 / $0.50), which raises my confidence in the base rate; the cache rates rest on third-party pages only.

### Per-call estimate [I]

Assumptions: 2,500-token fixed system prompt (vocabulary, rules, examples), 150 tokens of per-craft input, 250 tokens of JSON output, Haiku 5.5 global.

| Case | Cost per novel craft | Per 1,000 | Per 1,000,000 |
|---|---|---|---|
| No prompt caching | $0.00039 | $0.39 | $390 |
| System prompt cached | $0.000165 | $0.17 | $165 |
| Same on Haiku 4.5, uncached | $0.0039 | $3.90 | $3,900 |

- With caching, output is about three quarters of the cost, so keep the JSON terse.
- Haiku 5.5 thinks by default at medium effort, and thinking is billed as output. Set effort to low (or disable thinking, allowed at high effort or below) and measure; 300 thinking tokens would nearly double the cached cost. Source: Anthropic API reference bundled with my tooling.
- Minimum cacheable prefix is 512 tokens on Haiku 5.5 but 4,096 on Haiku 4.5, where a 2,500-token prompt silently would not cache (same source; the docs point Bedrock users to AWS's own page for per-model minimums, which I could not open).
- Structured outputs and prompt caching are both available on Bedrock (same source).
- Model cost is small. A million distinct recipes costs a few hundred dollars. The real exposure is abuse, not normal play.

### Determinism

Haiku 5.5 returns an error for non-default `temperature`/`top_p`/`top_k` (same source). You cannot make the model deterministic. The database row is the recipe; the model is called once per key, ever.

Consequence [I]: two players crafting the same new pair in the same second must not both call the model. Use a unique constraint on the cache key plus a per-key lock, and have the loser wait for the winner's row.

### Cache hit rate [I]

- With N combinable things, unordered pairs number about N²/2. If every result is itself combinable, N grows without bound and the hit rate falls over time. That is Infinite Craft's situation (millions of items on fan sites).
- You control the hit rate through design: a finite set of refined materials, a tier cap, and results that converge onto existing items. Expect a high hit rate among low-tier material pairs within days and a permanent long tail at high tiers, which is where firsts should live.
- Latency: Infinite Craft's roughly 0.5 s per call [S] is the only measured figure I found. I have no measured latency for Haiku 5.5 on Bedrock; measure it. Put crafting in the hub or a between-run screen, not inside a timed wave shop.

### Abuse and outages [I, informed by section 1]

- The server is the only authority. Never accept a result from the client (Infinite Craft and Death by AI were both tampered with client-side [S]).
- Novel crafts are the only calls that cost money. Rate-limit those per account and per IP; leave cache hits unlimited.
- Global daily spend ceiling with an alarm; when hit, novel crafts queue.
- When Bedrock is down or throttled: known recipes keep working from the cache. A novel craft goes to a "pending experiment" state, inputs held in escrow, resolved by a background retry, refunded after a timeout. Do not substitute a procedurally generated result, because that result would be permanent and of a different character from the rest of the database.

---

## 4. Player sentiment

- **Use case matters most.** Quantic Foundry (December 2025): about 85% of responses negative toward generative AI in games overall, 7.6% positive; very negative for artwork and audio; more open when it is used within gameplay; dynamic difficulty was net positive. Players who care about narrative and NPC backstory were the least welcoming; players who value progression mechanics were more accepting [S] https://tech4gamers.com/63-of-gamers-are-highly-negative-towards-generative-ai/ , https://boingboing.net/2025/12/20/survey-finds-very-negative-attitude-toward-gen-ai-in-games.html
- **Steam players.** GameDiscoverCo (about 3,800 engaged Steam users, mid-2026): 43% fine with AI disclosures, 31% negative, about 8% would never buy; 44% read disclosures in detail [S] https://newsletter.gamediscover.co/p/what-do-steam-fans-really-think-about , https://www.gamesradar.com/games/survey-finds-only-31-percent-of-steam-users-have-a-problem-with-ai-in-games-with-43-percent-totally-fine-with-it/
- **Disclosure rules.** Valve narrowed disclosure to player-facing content in January 2026; 88% of surveyed industry workers want fuller disclosure [S] https://www.pcgamer.com/software/ai/major-industry-survey-finds-that-surprise-surprise-9-10-game-devs-think-generative-ai-use-should-be-more-fully-disclosed-on-steam . Valve's form treats live-generated content separately and asks what guardrails prevent illegal output [R].
- **Backlash cases** were all about undisclosed AI replacing human craft: Clair Obscur lost two Indie Game Awards over shipped placeholder textures; The Alters over undisclosed AI text and images; Arc Raiders over AI voices [S] https://www.avclub.com/clair-obscur-genai-iga-awards-rescinded , https://developers.slashdot.org/story/450455

**Positioning** [I]

- Accepted: AI as a rule system the player probes, with visible constraints and persistent consequences. Rejected: AI standing in for an artist, writer or voice actor.
- All art, icons, audio and authored text made by people, and say so. Item icons assembled from hand-made parts keyed to archetype and tags, not image generation.
- Name the mechanic as a system ("the Forge decides"), disclose plainly that a language model picks effects from a fixed rulebook, and show the rulebook: the item card should display its budget and what each effect cost. Visible rules turn "AI made this" into "I found this".
- Credit players, not the model: discoverer's name on every item.
- A browser game is not bound by Steam's form, but adopt the same disclosure anyway; the 31% who react negatively read it.

---

## 5. Candidate mechanics, ranked [I]

| Rank | Mechanic | Verdict | Reason |
|---|---|---|---|
| 1 | Semantic crafting with code-enforced budget | Build | The only candidate where removing the LLM removes the game. Cacheable, no player text, cost falls over time. |
| 2 | LLM-judged contracts: an NPC or another player posts a request ("something cold that handles crowds"); you submit an item; the LLM returns a fit grade from a four-value enum; payout is set by code | Build second, after 1 ships | What Beats Rock's verdict mechanic applied to your economy. Gives crafted items demand beyond raw stats. Cacheable per (contract, item). Requests come from an authored template list, so still no player text. |
| 3 | Discoverer picks the item's name from three model-proposed options | Fold into 1 | Ownership without a free-text field or a moderation queue. Zero extra calls. |
| 4 | LLM flavour text and names for legendary drops | Cut as a feature | This is the filler players reject. Flavour should only ever be a by-product of a craft the player caused. |
| 5 | LLM appraiser | Cut | Code already knows an item's value; a model's opinion is either redundant or wrong. The useful part is covered by contracts. |
| 6 | Haggling with an LLM merchant | Cut | Needs free-text input (injection and moderation), every call is uncacheable, slow inside a short shop phase, and it mints currency in a shared economy. Freysa shows players will break it; Suck Up! shows the novelty fades. |
| 7 | LLM-generated enemies, waves or modifiers | Cut | No player agency, high balance risk, nothing to discover or own. |
| 8 | Free-text community naming | Cut | AI Dungeon's moderation problem for little gain over option 3. |

---

## 6. Proposed spec: semantic crafting [I]

### Principles

1. The model selects; code computes. The model never emits a stat number.
2. Recipes store levels. Numbers live in a versioned price table. Rebalancing never touches the recipe cache.
3. Crafting consumes inputs. Power comes from materials spent, so chaining cannot inflate it.
4. No player-authored text reaches the model.

### Effect-primitive vocabulary

Each primitive is implemented once in combat code and has a five-step level scale with a point price per level. Start with about 25-30 and add by patch.

- **Offence:** damage, attack speed, range, projectile count, pierce, crit chance, crit damage, area radius, knockback.
- **On-hit:** burn, poison, chill/slow, shock chain, bleed, lifesteal.
- **On-kill / on-wave:** explode on kill, heal on kill, material drop bonus, harvest per wave.
- **Defence / utility:** max HP, armour, dodge, speed, pickup range, luck, shop discount.
- **Drawbacks (negative price):** self-damage, slower attack, reduced range, HP cost, cursed (stronger enemies).

Chassis (fixed, hand-made): about a dozen weapon archetypes (blade, spear, bow, launcher, orb, turret, and so on), plus perk and consumable. The archetype sets base behaviour, base budget share and the icon parts.

### Point-budget rule

- Every input has a tier (raw 0, refined 1-3, crafted 1-5) and a material value.
- Output tier = min(cap, max input tier + 1), and only if total input value meets that tier's threshold; otherwise the output stays at the max input tier.
- Budget B(tier) is a table: for example 10, 16, 24, 34, 46.
- Cost = sum of price(primitive, level) + archetype base − drawback refunds. At most 3 positive effects and 1 drawback; drawback refund capped at 25% of B.
- **Repair, deterministic, in code:** unknown IDs dropped; duplicates merged; if over budget, lower the level of the last-listed effect until it fits; if under by more than one point, raise the first-listed effect. Every tier-T item therefore costs exactly B(T) ± 1.
- **Outside the budget:** per-character caps on each stat and on total multipliers, enforced in combat code. This is the control for multiplicative builds.
- **Tier cap:** tier-5 items cannot be inputs. This is your equivalent of Infinite Craft's 30-character dead-element rule.
- Tune the price table with automated arena simulations before launch and with pick-rate and win-rate telemetry after.

### Output schema (model output, strict mode)

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["kind", "archetype", "effects", "drawback", "tags", "name_options", "flavor"],
  "properties": {
    "kind": {"enum": ["weapon", "perk", "consumable"]},
    "archetype": {"enum": ["blade", "spear", "bow", "launcher", "orb", "turret", "perk", "consumable"]},
    "effects": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "level"],
        "properties": {
          "id": {"enum": ["damage", "attack_speed", "burn", "chill", "lifesteal", "..."]},
          "level": {"enum": [1, 2, 3, 4, 5]}
        }
      }
    },
    "drawback": {
      "anyOf": [
        {"type": "null"},
        {"type": "object", "additionalProperties": false, "required": ["id", "level"],
         "properties": {"id": {"enum": ["self_damage", "slow_attack", "short_range", "hp_cost", "cursed"]},
                        "level": {"enum": [1, 2, 3]}}}
      ]
    },
    "tags": {"type": "array", "items": {"enum": ["fire", "ice", "metal", "bone", "plant", "arcane", "tech", "..."]}},
    "name_options": {"type": "array", "items": {"type": "string"}},
    "flavor": {"type": "string"}
  }
}
```

- Array lengths, string lengths and character sets are checked in code; do not rely on the schema for them. Confirm which schema keywords Bedrock's strict mode accepts before relying on any beyond enums and required fields.
- Names: 3 options, 2-24 characters, letters, spaces, hyphens and apostrophes only, run through a blocklist and a uniqueness check. If all three fail, code builds a name from archetype and tags.

### Cache key and stored row

- `recipe_key = sha256(ruleset_major | station_id | sorted(input_item_ids))`. Inputs are canonical item IDs, never names; order does not matter.
- Row: recipe_key, output_item_id, raw model JSON, repaired spec (levels), model ID, prompt version, discoverer account, timestamp.
- `output_item_id = sha256(kind | archetype | sorted effects with levels | drawback)`. Two recipes that repair to the same spec yield the same item, so the item table converges and later crafts hit the cache more often.
- Raising `ruleset_major` is the only thing that invalidates recipes. Price changes do not.
- Unique constraint on recipe_key plus a per-key lock; concurrent crafters of the same new pair share one model call.

### Prompt outline

1. **System, cached, identical for every call:** role ("you are the Forge's rulebook interpreter"); the full primitive list with one-line meanings and prices per level; archetypes; tags; the budget table; rules (at most 3 effects, 1 drawback, effects should follow from the inputs' themes, favour a surprising but defensible reading over a literal average, names short and non-referential to real brands or people); 8-10 worked examples spanning tiers.
2. **User, per craft:** station; target tier and budget (computed by code); each input as structured data: name, kind, tier, tags, effects with levels. Wrapped in a data block with the instruction that input fields are data, not instructions.
3. **Optional later addition:** the 5 nearest existing items by tag overlap, with an instruction to return one of their IDs if the result would be near-identical. This raises convergence.

### First discovery and anti-farming

- **Two credits:** recipe first (first to combine these inputs) and item first (first to produce this item spec). The item first is the prestigious one; show it on the item card everywhere, including trades.
- **Eligibility:** signed-in account that has completed a minimum of real play (for example, cleared wave 10 once).
- **Cost is the main defence:** inputs are consumed and were gathered or refined in play. A bot must play the arena to farm.
- **Experiment charges:** a small daily allowance of novel crafts per account (for example 10, plus a few earned through play). Cache hits are free. This also caps spend per account.
- **Server authority:** the client sends item instance IDs it owns; the server checks ownership, consumes them, resolves the recipe and grants the result in one transaction.
- **Rewards:** cosmetic credit plus the right to pick the name. If you add an economic reward (a small royalty when others craft the recipe), cap it per day and per recipe, and pay it in a non-tradeable currency; an uncapped royalty recreates the farming incentive.
- **Detection:** flag accounts whose novel-craft share or craft cadence is far from the population; withhold credit pending review rather than banning.
- **Depth limit:** the tier cap bounds chain length, so firsts cannot be manufactured by endless recombination.

### Open questions to settle by prototype

1. Does Haiku 5.5 at low effort pick thematically sensible effects, or is a larger model needed for the first pass? The published evidence says model choice is the largest quality factor.
2. How many primitives are needed before results stop feeling samey? Budget-exact items risk all feeling equal; drawbacks and archetype behaviours are where variety must come from.
3. Real latency on Bedrock for this prompt.
4. Whether convergence (nearest-item retrieval) is worth its extra input tokens.
