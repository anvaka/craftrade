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
