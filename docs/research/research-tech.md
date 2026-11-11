# Tech research: wave-arena roguelite + shared async economy + Claude-on-Bedrock crafting

Research date: **2026-11-11**. Runtime checked in this sandbox: **Node v22.23.4**.

## How to read this report

Each claim is tagged:

- **[V-npm]** verified today against the npm registry (`npm view`).
- **[V-doc]** verified today by fetching the cited official page.
- **[V-pkg]** verified today by inspecting the published package contents.
- **[V-run]** verified today by running it in this sandbox.
- **[2nd]** from a secondary source or search snippet only; treat as a lead, not a fact.
- **[Inf]** my engineering inference or prior knowledge, not re-verified today.

**Hosts I could not reach** (outside this session's network allowlist): `docs.aws.amazon.com`, `pixijs.com`, `developers.cloudflare.com`, `fly.io`. Everything that depends on those pages is flagged as unverified in the section where it appears and collected in section 8.

---

## 0. Recommended stack

| Layer | Choice | Version (verified on npm 2026-11-11) |
|---|---|---|
| Renderer | PixiJS v8, WebGL backend, no game framework on top | `pixi.js` 8.22.0 (published 2026-10-01), MIT |
| Simulation | Own pure-TypeScript deterministic sim package: fixed 60 Hz tick, typed-array SoA storage, uniform-grid spatial hash, seeded PRNG | n/a |
| Audio | WebAudio directly, ZzFX for SFX pre-rendered to buffers | `zzfx` 1.4.0 (2026-10-01), MIT |
| Client build | Vite + TypeScript | `vite` 8.3.8, `typescript` 7.0.2 |
| Server | Node 22 + Hono + SQLite in one process | `hono` 4.13.17, `@hono/node-server` 2.1.6, `better-sqlite3` 13.0.3 |
| Validation | Zod, shared between client, server and LLM output | `zod` 4.6.7 |
| LLM | `AnthropicBedrockMantle` client, model `anthropic.claude-haiku-5-5` | `@anthropic-ai/bedrock-sdk` 1.1.2 (2026-11-10) |
| Tests | Vitest for headless sim and server, Playwright smoke test | `vitest` 5.1.0, `@playwright/test` 1.65.0 |
| Lint/format | Biome | `@biomejs/biome` 2.6.6 |
| Deploy | One small container with a persistent volume; the server also serves the static client | see section 6 |

---

## 1. Rendering

### 1.1 Versions

| Library | Latest stable | Published | Licence | Notes |
|---|---|---|---|---|
| `pixi.js` | 8.22.0 | 2026-10-01 | MIT | [V-npm] v7 line is 7.4.3 |
| `phaser` | 4.2.1 | 2026-07-09 | MIT | [V-npm] 4.0.0 shipped 2026-04-10; release notes confirm 4.2.1 is not a pre-release [V-doc] |
| `kaplay` | 3001.0.19 | 2026-05-12 | MIT | [V-npm] `next` tag is 4000.0.0-alpha.27.1 |
| `excalibur` | 1.0.0 | 2026-11-08 | BSD-2-Clause | [V-npm] 1.0 is three days old; previous release was 0.32.0 (2025-12-23) |
| `littlejsengine` | 1.29.1 | 2026-11-02 | MIT | [V-npm] not on your list, noted as an alternative |

### 1.2 Benchmarks found

The only cross-engine benchmark I could reach is Shirajuki's js-game-rendering-benchmark (https://github.com/Shirajuki/js-game-rendering-benchmark) [V-doc]. At 10,000 moving sprites:

| Library | FPS |
|---|---|
| Kontra | 60 |
| Babylon.js | 56 |
| PixiJS | 47 |
| Phaser | 43 |
| Kaboom / Kaplay | 3 |

Caveats, all from the page itself: the hardware was a Ryzen 5 4500U laptop with 8 GB RAM on Edge 109, which dates the run to roughly early 2023 (my inference from the browser version). Library versions are not listed, so these numbers predate PixiJS v8 and Phaser 4. The page gives no figures for raw Canvas API, Excalibur or LittleJS. Use it for the order of magnitude only.

Phaser's own release notes claim `SpriteGPULayer` can "render a million sprites in a single draw call, up to 100x faster than standard rendering" (https://github.com/phaserjs/phaser/releases) [V-doc]. That is a vendor claim, not an independent measurement.

I found no trustworthy 2026 benchmark for this exact workload. The plan in section 7 therefore puts a stress scene first.

### 1.3 Assessment per option

**PixiJS v8 (recommended).**
- It is a renderer only, which fits because the game owns its own deterministic simulation. [Inf]
- All procedural shapes can be baked into one texture atlas at boot, so 1–2k sprites sharing that atlas draw in one or two batches. [Inf]
- `ParticleContainer` in v8 takes lightweight `Particle` objects through `addParticle`. All particles must share one texture source, bounds are not computed so you must set `boundsArea`, and only properties flagged in `dynamicProperties` are re-uploaded each frame (position only by default). The source marks the API as experimental. (https://raw.githubusercontent.com/pixijs/pixijs/dev/src/scene/particle-container/shared/ParticleContainer.ts) [V-doc]
- Use it for bullets, pickups and hit particles. Use ordinary `Sprite` for enemies and the player, which need tint, per-sprite texture swaps and z-order. [Inf]

**Raw Canvas2D.**
- Viable for 1–2k `drawImage` calls from a pre-rendered atlas on a desktop. [Inf]
- The weak points are the ones this game leans on: per-sprite tint for hit flash, additive blending for glows, rotation (each needs `setTransform`), and fill-rate on phones with DPR 3. [Inf]
- It is the right fallback if you want zero dependencies, but you would be rebuilding batching and text caching by hand. [Inf]

**Phaser 4.**
- Capable renderer, but you would pay for scenes, physics, input and tweens you will not use, because physics and timing must live in your deterministic sim. [Inf]
- Arcade physics is not designed for replay determinism across machines. [Inf]

**Kaplay.**
- The benchmark above shows 3 FPS at 10k sprites. The component-per-object model is the wrong shape for hordes. Rule it out for this game.

**Excalibur.**
- 1.0.0 was published three days ago [V-npm]. It is a full engine with its own ECS and loop, and I have no performance data for it at this entity count. Too new and too opinionated for this project. [Inf]

**LittleJS** is designed for many-sprite arcade games and ships ZzFX from the same author [Inf]. It is a reasonable alternative if you want an engine, but it also wants to own the loop.

### 1.4 Implementation notes for PixiJS v8

I could not open pixijs.com today, so the API details in this subsection are from prior knowledge of v8 [Inf] unless marked. Check them against the v8 docs when you start.

**Baking procedural shapes.**
- At boot, draw each shape once, either with `Graphics` plus `renderer.generateTexture`, or with Canvas2D onto an `OffscreenCanvas` that becomes one atlas texture.
- Bake at the capped device resolution so edges stay crisp.
- Bake a white-silhouette variant of every enemy. Pixi's `tint` multiplies colour, so it cannot turn a sprite white; a hit flash is a texture swap to the silhouette for 2–3 frames.
- Never redraw `Graphics` geometry per frame for entities. Rebuilding geometry each frame is the classic Pixi performance mistake.
- Keep the atlas inside 2048×2048 for old mobile GPUs.

**Batching.**
- One atlas means one texture source, so batches break only on blend-mode changes.
- Put additive glow sprites in their own layer so blend modes do not interleave.
- Avoid filters and masks on anything that exists in the hundreds.

**Text and damage numbers.**
- Canvas-backed `Text` re-rasterises and re-uploads a texture on every change. Do not use it for damage numbers.
- Use `BitmapText` with a bitmap font generated at boot from a small glyph set (digits, `+`, `-`, `k`, `!`). Glyphs then batch like sprites.
- Pool 64–128 number objects. Merge hits on the same enemy inside about 100 ms into one number, and cap the numbers alive on screen.
- HUD text that changes rarely can stay as `Text`, or better, be plain DOM over the canvas.

**Mobile DPR.**
- Create the app with `resolution: Math.min(devicePixelRatio, 2)` and `autoDensity: true`. A DPR 3 phone at full resolution renders 2.25 times the pixels of the capped version.
- Add a quality step: if the smoothed frame time stays above about 18 ms for two seconds, drop resolution to 1.5 and then 1, and halve the particle cap.
- Request `preference: 'webgl'`. WebGPU in Pixi v8 works but adds device variance for no gain at this scale.
- Set `powerPreference: 'high-performance'` and `antialias: false`; bake anti-aliasing into the textures.
- Handle `webglcontextlost` and `webglcontextrestored`. Mobile browsers drop contexts when backgrounded, and baked textures must be regenerated.

---

## 2. Simulation architecture

All of this section is engineering practice [Inf], except where a verification is marked.

### 2.1 Loop

- Run the sim at a fixed 60 Hz tick with an accumulator. Rendering runs on `requestAnimationFrame` and interpolates each entity between its previous and current tick position.
- Clamp the frame delta to 250 ms and allow at most 5 catch-up ticks per frame. If the device cannot keep up, slow the game down instead of spiralling.
- The sim knows only the tick number. It never reads `performance.now()`, `Date.now()` or `Math.random()`.
- Keep the tick rate a named constant. Dropping to 30 Hz halves both client CPU and server replay cost, and is the fallback if phones or verification cost demand it.

### 2.2 Determinism

- **PRNG.** Use a small integer PRNG such as `sfc32` or `mulberry32`, seeded from a hash of the seed string. Give each concern its own stream (spawns, loot, crit rolls, shop) so adding a roll in one system does not shift the others.
- **Cosmetic randomness** (particles, shake, pitch variation) uses a separate non-sim RNG and must never touch sim state.
- **Floating point.** `+ - * /` and `Math.sqrt` are exact IEEE-754 operations and match across engines. `Math.sin`, `cos`, `atan2`, `pow`, `exp` and `log` are implementation-approximated and may differ between V8 (your Node verifier and Chrome), JavaScriptCore (every iOS browser) and SpiderMonkey. Inside the sim, use lookup tables or your own polynomial implementations for these.
- **Ordering.** Iterate dense arrays in index order. Give every sort an explicit tie-break on entity id.
- **Inputs.** Quantise the move vector (for example 32 directions plus stop) and record it per tick, together with discrete choices such as shop purchases. Run-length encode it. A 20-minute run is 72,000 ticks, which should compress to a few tens of kilobytes.
- **State hash.** Compute a cheap hash of key state every N ticks (player position, HP, kill count, RNG state). It is the desync detector for tests and for server verification.
- **Versioning.** Stamp every replay with a sim version. The server keeps the last few sim builds or rejects stale ones.

### 2.3 Entity storage, collisions, pooling

- **Storage.** One structure-of-arrays block per entity kind (enemies, projectiles, pickups), with fixed capacity and typed arrays (`Float32Array` for position and velocity, `Uint16Array` for type, `Int32Array` for HP). Keep it dense with swap-remove. If references must survive removal, use an id plus generation counter.
- **No allocation in the tick.** No object literals, closures or array methods like `map` and `filter` inside per-entity loops. GC pauses are the main cause of visible hitching in this genre.
- **Spatial hash.** Use a uniform grid with a cell size near the common enemy diameter. Rebuild it every tick with a counting sort into two integer arrays (`cellStart`, `cellItems`). Rebuilding 2k entities is cheaper than maintaining incremental updates.
- **Which pairs to test.**
  - Projectiles against enemies: through the grid.
  - Enemy separation: through the grid, capped at a few neighbours per enemy, and optionally staggered so half the enemies resolve on alternate ticks.
  - Enemies and pickups against the single player: a direct distance check, no grid needed.
- **Pools.** The fixed-capacity arrays are the pools. Decide what happens when a pool is full: drop the oldest particle, merge XP gems into bigger ones, and cap enemies through the spawn director.
- **Render side.** Keep a parallel pool of Pixi sprites indexed by entity slot. Toggle `visible` instead of adding and removing children.

### 2.4 Blur, pause, resize

- On `visibilitychange` to hidden: pause the sim, suspend the `AudioContext`, and reset the accumulator on return so there is no catch-up burst. `requestAnimationFrame` stops in background tabs anyway.
- Also pause on window `blur` for desktop, and show a pause overlay so the player resumes deliberately.
- Save meta-progress on `pagehide`. Mobile browsers may kill the tab without firing `unload`.
- Resize with a `ResizeObserver` on the canvas container. Keep a fixed world height in world units and let the width vary with aspect ratio, within limits so wide screens do not see far more of the arena.
- On touch devices set `touch-action: none` on the canvas, use Pointer Events for a floating virtual stick, and respect `env(safe-area-inset-*)` for HUD placement.

---

## 3. Game feel

### 3.1 Hit-stop

- Implement it in the presentation layer: stop feeding the accumulator for 30–70 ms. The sim is unaffected, so replays stay deterministic.
- In a horde game, reserve it for the player taking damage, elite or boss kills, and level-up. Applying it to every kill produces constant stutter.
- Cheaper per-hit feedback that scales to hundreds of hits: the white-silhouette flash, a 1–2 frame scale pop, knockback inside the sim, and a few particles.

### 3.2 Screen shake (trauma model)

This is the model from Squirrel Eiserloh's GDC 2016 talk "Math for Game Programmers: Juicing Your Cameras With Math" [Inf].

- Keep a `trauma` value in 0–1. Events add to it (small hit 0.1, player hit 0.4, boss slam 0.7), clamped at 1.
- Each frame `shake = trauma²`. The camera offset is `maxOffset × shake × noise(t)` on each axis, with an optional small rotation.
- Use smooth noise sampled over time, not a fresh random value per frame, so the motion reads as shake and not jitter.
- Decay trauma linearly, about 1.0–1.5 per second.
- Apply it to the camera container only, with the cosmetic RNG. Provide a shake-intensity setting and honour `prefers-reduced-motion`.

### 3.3 WebAudio

- **One `AudioContext`**, created lazily. Routing: source → per-category gain (sfx, music, ui) → `DynamicsCompressorNode` → destination. The compressor stops fifty simultaneous hits from clipping.
- **Autoplay unlock.** Browsers start the context suspended. On the first `pointerdown`, `keydown` or `touchend`, call `ctx.resume()`. Keep the listener installed, because iOS can move the context to an `interrupted` state after a call or app switch, and it needs resuming again.
- **Pre-render, do not synthesise per play.** Generate each ZzFX sound's samples once at boot into an `AudioBuffer`, then play it with a fresh `AudioBufferSourceNode`. Synthesising per shot at horde fire rates wastes main-thread time.
- **Voice limiting.** Cap concurrent voices per sound id (about 4), and refuse to retrigger the same sound within about 40 ms. Without this, auto-fire weapons produce a wall of noise and phasing.
- **Variation.** Randomise `playbackRate` by ±6% and gain slightly per play. Rising pitch on consecutive XP pickups is a cheap, effective touch.
- **Scheduling music.** Schedule notes against `AudioContext.currentTime` with a short lookahead timer, not `setTimeout` alone.

### 3.4 ZzFX and ZzFXM

| Package | Version | Licence | Source |
|---|---|---|---|
| ZzFX (`zzfx` on npm) | 1.4.0, published 2026-10-01 | MIT | [V-npm]; licence and "under 1 kB compressed" confirmed at https://github.com/KilledByAPixel/ZzFX [V-doc] |
| ZzFXM (Keith Clark) | no tagged releases, **not published on npm as `zzfxm`** (404) | MIT | https://github.com/keithclark/ZzFXM [V-doc], [V-npm] |
| `@zzfx-studio/zzfxm` | 0.1.5, published 2026-05-12 | MIT | [V-npm]; third-party TypeScript renderer, single maintainer, not evaluated |

- ZzFX exposes `zzfx(...params)` and is imported as `import { ZZFX, zzfx } from 'zzfx'` [V-doc]. It creates its own `AudioContext`. Point it at your context, or use only its sample-generation function and play the buffers yourself. I did not verify the exact property names in 1.4.0; read the package's typings before wiring it up.
- For ZzFXM, vendor the single source file from GitHub with its MIT notice. Render the song to a buffer at boot, off the critical path, since rendering a multi-minute song takes noticeable time on phones. [Inf]

---

## 4. Server

### 4.1 Options

| Option | Fit | Main costs |
|---|---|---|
| **Node 22 + Hono + SQLite, one process (recommended)** | The server can import the same sim package for replay verification. SQLite's single writer gives serialisable trades with no extra work. One deploy unit. | Needs a host with a persistent disk. Scales vertically only, which is ample for an indie async economy. |
| Cloudflare Workers + D1 / Durable Objects | Scale to zero, generous free tier [2nd]. | Per-request CPU limits make replay verification awkward. D1 access is async and transactions are batch-shaped, so trade logic is harder to write correctly. Limits not verified today. |
| Supabase | Hosted Postgres with anonymous auth built in. | Game logic lives in SQL functions or Deno edge functions, a second runtime that cannot easily run the sim. More moving parts than this needs. |

**Hono or Fastify.** Both are current (`hono` 4.13.17, `fastify` 5.12.8) [V-npm]. Choose Hono: it is smaller, its `app.request()` makes route tests trivial, and the same routes would run on Workers if you ever move.

**better-sqlite3 or `node:sqlite`.**
- `node:sqlite` on Node 22 is still "Stability 1.1 – Active development". It has needed no flag since v22.13.0, but prints an `ExperimentalWarning` and has no transaction helper (https://nodejs.org/docs/latest-v22.x/api/sqlite.html) [V-doc], [V-run].
- `better-sqlite3` 13.0.3 requires Node ≥ 22 [V-npm]. It installed from a prebuilt binary and ran in this sandbox [V-run].
- Use better-sqlite3 behind a thin `db.ts` wrapper. The APIs are close enough that swapping to `node:sqlite` later is a small change.
- Pragmas: `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000`. [Inf]

### 4.2 Anonymous identity

- On first launch the client calls `POST /v1/players`. The server creates a player id and a 32-byte random secret, stores only the SHA-256 of the secret, and returns both once.
- The client keeps them in `localStorage` and sends `Authorization: Bearer <id>.<secret>` on every call.
- Offer a short recovery code so a player can move to another device. Without it, clearing site data loses the account; say so in the UI.
- Rate-limit player creation per IP, and require a minimum amount of verified play before an account can list on the market. That is the main defence against throwaway-account farming.
- Generate display names server-side from word lists. Free-text names need moderation.

### 4.3 Anti-cheat

The principle is that the client is never trusted for anything that enters the shared economy. Layers, cheapest first:

1. **Server-authoritative state.** Inventory, currency, crafting results and market state exist only on the server. The client sends intents.
2. **Run tickets.** `POST /v1/runs` returns a run id, the seed and the sim version. A result must reference a live ticket, each ticket accepts one submission, and wall-clock time between start and submit must be at least the claimed tick count divided by 60 (minus a small tolerance).
3. **Plausibility bounds.** Validate the summary with Zod, then check it against hard limits: maximum kills per wave, maximum materials per minute, maximum score for the wave reached.
4. **Replay verification.** The client uploads the input log. The server re-runs the shared sim headlessly and compares the final state hash and score.
5. **Rewards from the server's result.** Materials granted to the persistent inventory come from the replayed or bound-capped result, not from client numbers.

Replay cost is the open question. A 72,000-tick run with a thousand entities could take seconds of CPU. Plan for it:
- Verify asynchronously in a `worker_threads` queue, never in the request handler.
- Verify every run that would enter the daily top N, plus a random sample of the rest. Mark leaderboard entries as verified only after replay.
- Measure headless ticks per second in week one (section 7) and set N from that.

**Rate limits.** A token bucket keyed by player id and by IP is enough; `hono-rate-limiter` 0.5.4 exists [V-npm] or write the forty lines yourself. Give the LLM crafting endpoint its own stricter limits (section 5.6).

### 4.4 Market trades and idempotency

- Every mutating request carries an `Idempotency-Key` header (a client-generated UUID). Store `(player_id, key, request_hash, response_json)` under a unique constraint, written in the same transaction as the mutation. A retry returns the stored response; the same key with a different body returns 409.
- A purchase is one `BEGIN IMMEDIATE` transaction:
  1. `UPDATE listings SET status='sold', buyer_id=? WHERE id=? AND status='open'`, and require exactly one changed row.
  2. Debit the buyer, credit the seller, move the item.
  3. Append ledger rows.
  4. Insert the idempotency row.
- Store all quantities as integers. Add `CHECK (balance >= 0)` and `CHECK (qty >= 0)` so a logic bug fails the transaction instead of minting value.
- Keep an append-only ledger of every currency and item movement. It is the audit trail and the tool for rolling back a cheater.
- Shared town project progress is a counter updated inside the same transaction as the contribution's item debit.
- Listing fees, listing caps per player and price bounds per item tier limit wash-trading between alternate accounts.

### 4.5 Recipe cache and first-discovery credit

- The cache key is the canonical form of the request: sorted ingredient ids plus station id plus a ruleset version.
- `recipes.key` is unique. Insert with `ON CONFLICT DO NOTHING`, then read the row back. Whoever's insert won is the discoverer.
- Keep an in-process map of in-flight keys so two simultaneous requests for the same undiscovered recipe share one LLM call. This works because there is one server process.
- A ruleset version in the key lets you rebalance without deleting history.

---

## 5. Calling Claude on Bedrock from Node

Sources for this section: Anthropic's "Claude in Amazon Bedrock" page (https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock) and its legacy counterpart (https://platform.claude.com/docs/en/build-with-claude/claude-on-amazon-bedrock-legacy), both fetched today, plus the published `@anthropic-ai/bedrock-sdk` 1.1.2 package. **AWS's own documentation was unreachable**, so AWS-side claims are limited to what Anthropic's pages state.

### 5.1 SDK and endpoint

- Package: **`@anthropic-ai/bedrock-sdk`**, latest 1.1.2, published 2026-11-10 [V-npm]. It depends on `@anthropic-ai/sdk` `>=1.0.0 <2` [V-pkg] (currently 1.8.0 [V-npm]).
- Client class: **`AnthropicBedrockMantle`** [V-doc], [V-pkg].
- Endpoint: `https://bedrock-mantle.{region}.api.aws/anthropic/v1/messages`. It takes the same Messages API request body as the Claude API and uses standard SSE streaming [V-doc].
- The older `AnthropicBedrock` class in the same package is the legacy `bedrock-runtime` InvokeModel path for ARN-versioned models (Opus 4.6 and earlier) [V-doc].
- Version trap: SDK 1.x sends API version `2026-10-21`, which Bedrock accepts only for Claude 4.7 and later. For an ARN-versioned model the docs say to install `@anthropic-ai/bedrock-sdk@0` instead [V-doc].

```ts
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";

// Reads AWS_BEARER_TOKEN_BEDROCK and AWS_REGION from the environment.
const client = new AnthropicBedrockMantle({ awsRegion: "us-east-1" });
```

### 5.2 Authentication

- **Bearer token.** The client's `apiKey` option is "API key for Bearer token authentication". If no `apiKey` and no explicit AWS credentials are passed, it falls back to the **`AWS_BEARER_TOKEN_BEDROCK`** environment variable, then to `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, then to the default AWS credential chain [V-pkg]. The docs page states the same priority [V-doc]. So with that variable set, no auth code is needed.
- **What Anthropic's page says about bearer tokens on this endpoint:** they are for "short-term access without IAM roles (12-hour maximum, least preferred)", minted with the `aws-bedrock-token-generator` CLI [V-doc].
- **IAM.** The same page ranks a Bedrock service role first and IAM assumed roles second, with the permission `bedrock-mantle:CreateInference` scoped to the allowed model ARNs [V-doc]. The Mantle client signs with SigV4 when given AWS credentials [V-pkg].
- **Alternative client.** The plain `Anthropic` client with `baseURL: "https://bedrock-mantle.{region}.api.aws/anthropic"` and the token as `apiKey` also works, for bearer auth only [V-doc].

**Not verified, and it matters:** AWS also offers long-term Bedrock API keys tied to an IAM user [2nd]. I could not confirm from AWS's documentation whether a long-term key is accepted by the `bedrock-mantle` endpoint, or only short-term tokens. If only short-term tokens work, a server holding a static `AWS_BEARER_TOKEN_BEDROCK` will start failing after at most 12 hours.

Practical plan: write a ten-line smoke script on day one that calls the model with your actual key. For production, either use IAM credentials (SigV4) or add a token-refresh step, unless the smoke test and the key's stated expiry show a long-term key works.

### 5.3 Messages API, Converse or InvokeModel

- Anthropic's documentation presents the Messages API on the Mantle endpoint as the current integration for Opus 4.7 and later, and files InvokeModel and Converse under "legacy" for ARN-versioned models [V-doc].
- Current models, including Haiku 5.5, are also reachable through InvokeModel on `bedrock-runtime`, served by the same infrastructure [V-doc].
- Converse is AWS's model-agnostic API, called through `@aws-sdk/client-bedrock-runtime` (3.1166.0 [V-npm]). It is worth choosing only if you need to swap between model vendors. It tends to lag on Claude-specific features; for example, mid-conversation system messages require InvokeModel, not Converse [V-doc].
- I could not check the current Converse API reference for structured-output or caching parameters.

Recommendation: use the Mantle Messages API through the Anthropic SDK. You get typed requests, `messages.parse`, and code that ports to the first-party API by changing the client constructor.

### 5.4 Model IDs

From the model table on Anthropic's Bedrock page [V-doc]:

| Model | Mantle model ID | Access on Bedrock |
|---|---|---|
| Claude Haiku 5.5 (current small fast model) | `anthropic.claude-haiku-5-5` | "See Access": AWS sets per-model access criteria; check Model access in the Bedrock console |
| Claude Haiku 4.5 | `anthropic.claude-haiku-4-5` | Open to all Bedrock customers |

- These IDs have no date suffix and no version suffix.
- The global endpoint (no price premium) is available for both. Regional endpoints carry a 10% premium [V-doc].
- Legacy ARN-style ID for Haiku 4.5, if you ever use the `bedrock-runtime` path: `anthropic.claude-haiku-4-5-20251001-v1:0`, which must be called through an inference profile by adding a `global.`, `us.` or `eu.` prefix (for example `global.anthropic.claude-haiku-4-5-20251001-v1:0`) [V-doc].
- Per the same page, Haiku 5.5 has no ARN-versioned ID [V-doc]. I could not open AWS's inference-profile list, so I cannot say whether prefixed profile IDs exist for it on `bedrock-runtime`. On the Mantle endpoint you do not need one.

Make the model ID an environment variable (`CRAFT_MODEL_ID`), default `anthropic.claude-haiku-5-5`, with `anthropic.claude-haiku-4-5` as the documented fallback if your account lacks access.

Behaviour differences to code for on Haiku 5.5 (from Anthropic's bundled API reference for Claude Code, dated 2026-11-03, not re-fetched from the live docs):
- Thinking is adaptive and on by default, with default effort `medium`. For a short, latency-sensitive call set `output_config: { effort: "low" }`.
- `temperature`, `top_p` and `top_k` at non-default values return a 400. Do not send them.
- Assistant-message prefill returns a 400. Use structured outputs instead.
- A safety classifier can decline a request with HTTP 200 and `stop_reason: "refusal"`. Bedrock has no server-side fallback, so handle it in code.
- First-party list price is $0.10 / $0.50 per million input/output tokens for prompts up to 100K tokens. **Bedrock pricing is set by AWS and I did not verify it.**

### 5.5 Structured JSON output

Structured outputs are listed as supported on Bedrock [V-doc]. The SDK pattern, from Anthropic's TypeScript reference:

```ts
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const Recipe = z.object({
  name: z.string(),
  description: z.string(),
  category: z.enum(["weapon", "armor", "tool", "consumable", "material"]),
  tier: z.number().int(),
  tags: z.array(z.string()),
});

const res = await client.messages.parse(
  {
    model: process.env.CRAFT_MODEL_ID ?? "anthropic.claude-haiku-5-5",
    max_tokens: 2000,
    system: [{ type: "text", text: RULES_AND_CATALOGUE, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: ingredientPayload }],
    output_config: { effort: "low", format: zodOutputFormat(Recipe) },
  },
  { timeout: 20_000 },
);

if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens" || !res.parsed_output) {
  // fall back to the deterministic recipe generator
}
```

- `parsed_output` is null when parsing fails; always guard it.
- The alternative is a tool with `strict: true` and `additionalProperties: false`. Use `tool_choice: auto` with it; forced tool choice is rejected on several current models.
- I have not run this against Bedrock. Confirm `output_config.format` works through the Mantle endpoint in the day-one smoke script.

### 5.6 Design rules for the crafting endpoint

These are my recommendations [Inf].

- **The model writes flavour, the server writes numbers.** Let Claude choose the name, description, category and tags from enumerations. Compute stats in code from the ingredients' power budget and the chosen tags. This keeps the economy balanced whatever the model returns.
- **Inputs are ids, not prose.** The request carries catalogue ids; the server expands them to descriptions. No player-typed text reaches the prompt, which removes prompt injection as a concern.
- **Validate and filter.** Check the parsed result with Zod, clamp tier, and run the name through a blocklist before it enters a cache every player sees.
- **Always have a fallback.** On refusal, timeout, throttling or invalid output, return a recipe from a seeded deterministic generator and do not grant discovery credit, so the craft can be retried by the model later.
- **Spend limits.** Per-player daily cap on uncached crafts, a global daily token budget that trips to the fallback, and a per-request timeout of about 20 seconds with `maxRetries: 2`.
- **Latency.** Return a pending craft id and let the client poll or play a "forging" animation. Do not hold the game on the call.

### 5.7 Prompt caching

- Supported on Bedrock [V-doc]. On the Mantle endpoint the top-level automatic form (`cache_control` on the request) is accepted; the legacy integration rejects it and needs explicit breakpoints.
- Put the stable content first: rules, enumerations, item catalogue, few-shot examples. Put the per-request ingredient list in the user message after the cached block.
- Minimum cacheable prefix is 512 tokens for Haiku 5.5 and **4096 tokens for Haiku 4.5**. A shorter prefix silently does not cache. The same reference notes that AWS documents its own per-model minimums for Bedrock, which I could not check.
- Cost multipliers on Anthropic's rate card: reads 0.1×, 5-minute writes 1.25×, 1-hour writes 2×.
- Any byte change in the prefix invalidates it. Do not interpolate timestamps or ids into the system prompt, and serialise the catalogue in a fixed order.
- Check `usage.cache_read_input_tokens` in responses to confirm hits.
- Set expectations: novel crafts are rare by design, because your own recipe table absorbs repeats. Requests will often be more than five minutes apart, so the 5-minute cache will often be cold. At Haiku prices the saving is small either way. Add the breakpoint, measure, and do not design around it.

---

## 6. Project layout, tooling, tests, deploy

### 6.1 Layout (npm workspaces)

```
craftrade/
  package.json            workspaces, scripts
  tsconfig.base.json
  packages/
    sim/                  pure TS, no DOM, no Node APIs; deterministic game rules
    shared/               zod schemas, API types, item catalogue, constants
  apps/
    client/               Vite app: Pixi renderer, input, audio, UI, API client
    server/               Hono app: routes, SQLite, replay worker, Bedrock client
  e2e/                    Playwright smoke test
```

The rule that makes the rest work: `packages/sim` imports nothing from the browser or Node. The client renders it, the server replays it, Vitest runs it headless.

### 6.2 Build tooling

- **Vite 8.3.8** [V-npm]. It requires Node `^20.19.0 || >=22.12.0` [V-npm]; your v22.23.4 qualifies. In development, proxy `/api` to the Hono port so the client is same-origin in both dev and production.
- **TypeScript 7.0.2** is `latest` on npm (published 2026-07-08); the last 6.x is 6.0.3 [V-npm]. I verified the version only, not how well each tool in the chain works with 7.x. If a tool misbehaves, pin 6.0.3.
- **Node runs `.ts` directly.** `node file.ts` worked with no flag on v22.23.4 [V-run]. It strips types only, so use `erasableSyntaxOnly` and avoid enums and parameter properties. `tsx` 4.23.15 [V-npm] is the fallback for dev watch mode.
- **tsconfig.** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `erasableSyntaxOnly`, `target: ES2022`. Use `moduleResolution: bundler` for the client and `nodenext` for the server. [Inf]
- `noUncheckedIndexedAccess` adds friction in typed-array hot loops. Accept non-null assertions inside the sim's inner loops, or disable that one flag for `packages/sim`.

### 6.3 Testing

**Sim (Vitest, Node environment).**
- Golden determinism: a seed plus a scripted input log must produce a known state hash at tick N. A changed hash means gameplay changed, so updating it is a deliberate act.
- Replay round trip: record a bot-played run, serialise the inputs, replay, compare hashes.
- Invariants over many seeds: no NaN positions, entity counts within capacity, HP never negative, run always terminates.
- Performance budget: time 10,000 ticks at a 1,500-enemy load and fail if the mean tick exceeds a threshold. This also gives you the replay verification cost.
- Balance smoke: a simple bot should survive to wave X in a sensible band.

**Server (Vitest).**
- Call routes through Hono's `app.request()` against a `:memory:` SQLite database.
- Trades: two buyers for one listing gives exactly one success; a retried idempotency key returns the same response and moves funds once; insufficient balance leaves no partial state.
- Put the Bedrock call behind an interface and inject a fake. Test refusal, timeout and invalid-JSON paths, and that two concurrent requests for one recipe make one model call.

**End to end (Playwright 1.65.0).**
- One smoke test on desktop Chromium and one mobile-emulated profile: page loads, no console errors, start a run through a debug hook such as `?seed=test&bot=1`, let it play ten seconds, assert the tick count advanced and the canvas is not blank.
- Expose a small `window.__game` debug object in non-production builds for this.
- Headless CI machines render with software GL, so do not assert frame rate there. Measure frame rate on real devices.

### 6.4 Deploy targets

I could not open any hosting provider's pricing page today. The figures below are from a third-party comparison "checked September 2026" (https://flaviocopes.com/hosting-free-tiers/) and other search results [2nd]. Confirm on the vendors' sites before choosing.

| Target | What I found [2nd] | Fit |
|---|---|---|
| Fly.io | No free tier for new accounts, only a short trial. Supports persistent volumes. | Good fit for a single small machine with a volume. Expect a few dollars a month. |
| Railway | One-time $5 trial credit, then usage-based. | Workable with a volume. |
| Render | Free web service sleeps after 15 minutes idle with a 30-second-plus cold start. | Free tier has no durable disk for SQLite as far as I know [Inf]; a paid instance with a disk works. |
| Cloudflare Workers + D1 | Permanent free tier (figures quoted: 100k requests/day, 10 ms CPU per request, D1 5 GB). | Free, but it means rewriting the server for Workers and D1 and moving replay verification elsewhere. |
| Small VPS | A few dollars a month. | Cheapest predictable option if you are happy running Caddy and systemd yourself. [Inf] |

Recommendation: ship one container that runs the Hono server and serves the built client from `apps/client/dist`, on a host with a persistent volume. Same origin means no CORS and one deploy. Back the SQLite file up to object storage on a schedule (Litestream or a nightly `VACUUM INTO`). If traffic grows, put a CDN in front of the static files; nothing else changes.

---

## 7. Architecture and risks

### 7.1 Architecture

```
BROWSER (static bundle built by Vite)
+------------------------------------------------------------------+
|  Input (keys, pointer, virtual stick) --> per-tick input record  |
|                         |                                        |
|                         v                                        |
|  packages/sim  (pure TS, deterministic, fixed 60 Hz tick)        |
|    seeded PRNG streams | SoA typed arrays | spatial grid         |
|    waves, weapons, damage, pickups | state hash every N ticks    |
|        |                         |                               |
|        | interpolated snapshot   | sim events (hit, kill, ...)   |
|        v                         v                               |
|  Renderer (PixiJS v8)        Feel layer                          |
|    baked atlas, sprite pools   hit-stop, trauma shake, flashes   |
|    ParticleContainer, Bitmap   WebAudio: ZzFX buffers, limiter   |
|    Text, DPR cap                                                 |
|                                                                  |
|  Meta UI (inventory, craft, market, town)  <-->  API client      |
|    device token in localStorage, idempotency keys, input log     |
+-------------------------------|----------------------------------+
                                | HTTPS, same origin, /api/v1/*
                                v
SERVER (one Node 22 process, one container, one volume)
+------------------------------------------------------------------+
|  Hono app: auth middleware, rate limits, zod validation          |
|   /players  /runs  /leaderboard  /inventory                      |
|   /market   /town  /craft        + static files (client dist)    |
|        |             |                   |                       |
|        v             v                   v                       |
|  SQLite (WAL)    Replay worker      Craft service                |
|   players         worker_threads     recipe key lookup           |
|   inventory       imports            in-flight de-dupe           |
|   ledger          packages/sim       server-side stat rules      |
|   listings        re-runs input      deterministic fallback      |
|   town_progress   log, compares           |                      |
|   recipes         hash and score          v                      |
|   runs, replays                     AnthropicBedrockMantle       |
|   idempotency                        model: Haiku 5.5            |
+------------------------------------------|-----------------------+
                                           | HTTPS
                                           v
              bedrock-mantle.{region}.api.aws/anthropic/v1/messages
```

Data flows worth stating outright:
- **A run:** the client requests a ticket, plays locally with no network, then submits the summary and input log. The server bound-checks it, credits capped rewards at once, and queues the replay; leaderboard entry becomes "verified" afterwards.
- **A craft:** the client sends ingredient ids. The server debits ingredients, looks up the recipe key, calls Claude only on a miss, computes stats in code, stores the recipe with the discoverer, and grants the item.
- **A trade:** one SQLite transaction guarded by an idempotency key.

### 7.2 Technical risks, in priority order

1. **Frame rate on mid-range phones at peak density.** No current benchmark covers this workload. Mitigation: build a stress scene in the first days (2,000 sprites, 500 particles, 60 damage numbers) and test on a real mid-range Android phone and an iPhone before writing gameplay. Keep the DPR cap, quality steps and entity caps as tunable constants.
2. **Cross-engine determinism.** A Safari client and a Node verifier may disagree if the sim uses `Math.sin` and friends, which would mark honest players as cheaters. Mitigation: ban those functions in `packages/sim` with a lint rule, use tables, and run the golden-hash test in Chromium, Firefox and WebKit through Playwright as well as Node.
3. **Bedrock credentials in production.** Anthropic's page describes bearer tokens for this endpoint as short-term, 12 hours maximum. Whether a long-term Bedrock API key works is unverified. Mitigation: day-one smoke script; plan for IAM credentials or token refresh; the crafting fallback keeps the game working when the call fails.
4. **Model access.** Haiku 5.5 access on Bedrock is per-account ("See Access"). Mitigation: check the Bedrock console now; keep the model id in configuration with Haiku 4.5 as the fallback, noting its 4,096-token cache minimum.
5. **Replay verification cost.** Unknown until measured; could be seconds of CPU per run. Mitigation: measure with the perf test, verify asynchronously, restrict to top N plus a sample, keep 30 Hz as an option.
6. **Economy abuse through alternate accounts.** Anonymous identity makes new accounts free. Mitigation: play-time gate before market access, listing fees and caps, price bounds, per-IP creation limits, and the ledger for rollback.
7. **LLM output entering shared state.** Unbalanced or offensive results would be visible to everyone and cached. Mitigation: enumerated fields, server-computed stats, name filter, ruleset version in the cache key, and an admin route to retire a recipe.
8. **GC hitches.** Allocation in the tick or render loop causes periodic stutter that averages hide. Mitigation: SoA storage, pooled sprites, and a 99th-percentile frame time readout in the debug overlay.
9. **Toolchain freshness.** TypeScript 7.0.x, Vite 8, Vitest 5 and Excalibur-style week-old releases are all recent. Mitigation: commit the lockfile, pin exact versions, and fall back to TypeScript 6.0.3 if a tool breaks.
10. **Single SQLite file on one volume.** A lost volume loses the economy. Mitigation: scheduled off-box backups from the first deploy, and a restore drill.
11. **iOS audio and lifecycle quirks.** Context interruption, silent switch behaviour and tab eviction. Mitigation: resume on every gesture, save on `pagehide`, test on a physical iPhone.

### 7.3 Suggested first-week order

1. Workspace scaffold, CI, and the Bedrock smoke script (settles risks 3 and 4).
2. Pixi stress scene on real phones (settles risk 1).
3. Sim skeleton with PRNG, SoA, grid and the golden-hash test in three browsers (settles risk 2 and measures risk 5).
4. Then gameplay.

---

## 8. What I could not verify

| Item | Why | What to do |
|---|---|---|
| Whether long-term Bedrock API keys work on the `bedrock-mantle` endpoint; key expiry rules | `docs.aws.amazon.com` unreachable | Smoke-test with your key; read AWS's API keys page |
| Inference profile IDs for Haiku 5.5 on `bedrock-runtime` | same | Not needed on the Mantle endpoint; check AWS's inference profile list if you use InvokeModel |
| Converse API support for structured output and cache points | same | Only matters if you choose Converse |
| Bedrock pricing for Haiku 5.5 and Bedrock-specific cache minimums | same | Check the Bedrock pricing and prompt-caching pages |
| `output_config.format` and top-level `cache_control` behaving on Bedrock as documented | not run; no credentials used | Include both in the smoke script |
| PixiJS v8 API details in section 1.4 (init options, `generateTexture`, `BitmapText` font generation) | `pixijs.com` unreachable; only the `ParticleContainer` source was read | Check against the v8 guides |
| Cloudflare Workers and D1 limits; Fly.io, Render and Railway prices | vendor sites unreachable; secondary sources only | Read the pricing pages before choosing a host |
| Exact ZzFX 1.4.0 API names for sample generation and its audio context | not inspected | Read the package typings |
| Independent 2026 benchmarks of PixiJS v8, Phaser 4 or Excalibur 1.0 at 1–2k entities | none found | Your own stress scene |

## 9. Sources

- npm registry, queried 2026-11-11, for every version, date, licence and engine constraint marked [V-npm]
- https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock
- https://platform.claude.com/docs/en/build-with-claude/claude-on-amazon-bedrock-legacy
- `@anthropic-ai/bedrock-sdk` 1.1.2 tarball (`mantle-client.d.ts`, `package.json`, `CHANGELOG.md`)
- Anthropic's bundled Claude API reference for Claude Code (model table cached 2026-11-03): Haiku 5.5 behaviour, structured output and caching patterns, platform availability
- https://nodejs.org/docs/latest-v22.x/api/sqlite.html
- https://github.com/Shirajuki/js-game-rendering-benchmark
- https://github.com/phaserjs/phaser/releases
- https://raw.githubusercontent.com/pixijs/pixijs/dev/src/scene/particle-container/shared/ParticleContainer.ts
- https://github.com/KilledByAPixel/ZzFX
- https://github.com/keithclark/ZzFXM
- https://flaviocopes.com/hosting-free-tiers/ (via search summary only)
