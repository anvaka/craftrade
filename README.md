# Scrip (working title)

A wave-arena roguelite where the arena is also the mine. Fight 12 short
waves, work trees, ore seams and carcasses under fire, build at a bench
between waves, fuse items into new ones, and carry a little home to a town
every player shares. Design: [docs/DESIGN.md](docs/DESIGN.md).

## Run it

```bash
npm install
```

```bash
CRAFT_PROVIDER=procedural npm run dev
```

Open http://localhost:5173. The server listens on 8787 and keeps its
database in `./data`.

Production: `npm run build`, then `npm start` serves the client and the API
from one process on `PORT` (default 8787).

## Solo, offline and on a phone

The built game (`npm run build`, the `dist` folder) is a plain static site.
Put it on any static host and it plays with no game server: the first visit
finds no server and starts a **solo world** kept on the device. Solo is the
server's own code running in the page against SQLite in WebAssembly
(`src/client/local`), so every town rule is the same; it has one player, a
town project of its own, the built-in generator for untried pairs, and no
market between players.

After the first visit the whole game is cached (`src/client/sw.js`), so it
opens and plays with no connection, and it can be added to a phone's home
screen. The solo save lives in the browser's storage on that device.

A run is written to the device at every bench (`resumeInto` in
`src/shared/replay.ts`), in solo and in the shared town. Closing the page
mid-run offers "Back to the bench" next time; at most the wave in progress
is lost.

A device that meets a game server plays in the shared town instead. The
Account section switches between the two; they are separate saves.
`VITE_SOLO=1 npm run build` makes a build that is always solo.

`SCRIP_DB=sqljs npm test` runs the server tests on the browser's database
engine.

## Play any branch from a phone

`.github/workflows/pages.yml` builds every push and publishes it to GitHub
Pages: the default branch at `https://<owner>.github.io/<repo>/`, any other
branch at `.../b/<branch with slashes as dashes>/`. One-time setup: Settings,
Pages, "Deploy from a branch", `gh-pages`, `/ (root)`. All of these share one
solo save, because they are one site to the browser.

## Gathering prototypes

The game is being reworked toward gathering and crafting; the plan and what
has been learned are in `docs/design/pivot/`.

**Gather between waves** (the current test): **Try it** on the stash page
starts a normal run with a 30 second lull after every wave but the last.
Nothing comes for the player during a lull and more nodes stand than can be
reached. Plain nodes are free; rich ones and the chest are guarded by beasts
that wait until the player comes near. Marks at the screen edge point to every
node (Ochre for rich ones, the largest for a chest), and a chest pays scrip,
raws and an upgrade pick. Logging, Mining and Skinning
gain experience from every node and each level works its node 6% faster. The
run stays on the device and brings nothing home. Sim: `startLull` in
`src/sim/world.ts`; test: `tests/lull.test.ts`.

**The home wood** (tried and dropped as the core loop: it played as boring):
`?outing` in the address opens a calm zone with camps, tiered nodes, a bag and
a threat meter. Sim: `src/sim/outing.ts`; screen: `src/client/outing/`.

## Fusion and the model

Untried item pairs are decided by Claude on Amazon Bedrock. Set
`AWS_BEARER_TOKEN_BEDROCK` (or standard AWS credentials) and `AWS_REGION`;
`CRAFT_MODEL_ID` picks the model. `CRAFT_PROVIDER=procedural` uses a
deterministic stand-in so the game is playable with no key.
`npx tsx server/smoke-llm.ts` fuses three sample pairs through the real
provider and prints the results.

## Other commands

| Command | What it does |
|---|---|
| `npm test` | Simulation and server tests |
| `npm run typecheck` | TypeScript check |
| `npx tsx src/sim/balance.ts 300 greenhorn` | Bot plays 300 runs and prints balance figures |
| `npx tsx server/audit.ts` | Checks the ledger against balances |
| `npx tsx tools/exp/relics/droprate.ts` | A million wins through the real relic roll: observed and configured odds, world supply |
| `npx tsx tools/exp/relics/winrate.ts 300` | Bot win rate with each relic against none, on paired seeds |
| `RELIC_FORCE=saddlescabbard npm start` | Development only: every paying run brings that relic home (see docs/DESIGN.md 5.6) |

Dev pages under `npm run dev`: `/gallery.html` (every sprite, icon, UI piece
and sound) and `/play.html?bot=1&wave=8` (a run without the server; see
`src/client/game/dev.ts` for options).

## Layout

- `src/shared`: effect vocabulary, item rules, wire types
- `src/sim`: deterministic run simulation, bench, balance bot
- `src/client/game`: the run (renderer, HUD, input, bench, anvil)
- `src/client/town`: boot, API client, stash, workshop, market, town, daily
- `src/client/art`, `src/client/audio`: sprites drawn in code, synthesised sound
- `server`: Hono + SQLite API, fusion provider, market, town, ledger
- `docs/research`: the six research briefs behind the design
