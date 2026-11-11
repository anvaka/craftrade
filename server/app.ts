import { existsSync } from 'node:fs';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic } from '@hono/node-server/serve-static';
import { z } from 'zod';
import { KIT_SLOTS, type ApiError, type HelloRes, type NameRes } from '../src/shared/protocol.ts';
import { RAWS } from '../src/shared/vocab.ts';
import { BedrockProvider, hasBedrockCredentials } from './bedrock.ts';
import { BOUNDS, CHARACTERS, FACTOR, LISTING, MODEL_TIMEOUT_MS } from './config.ts';
import { openDb, tx, type DB } from './db.ts';
import { ApiErr } from './errors.ts';
import { codex, fuse, itemsByIds } from './fusion.ts';
import { buyListing, cancelListing, factorTrade, listItem, marketView, salvage } from './market.ts';
import { createPlayer, findPlayer, profile, rerollName, stations, touch, type Ctx, type Player } from './players.ts';
import { ProceduralProvider, type FusionProvider } from './provider.ts';
import { Buckets, LIMITS } from './ratelimit.ts';
import { dailyBoard, endRun, startRun } from './runs.ts';
import { give, townView } from './town.ts';

export interface AppOptions {
  /** An open database, or a path to open. Default: DB_PATH or ./data/craftrade.db. */
  db?: DB;
  dbPath?: string;
  /** Default: Bedrock when credentials are configured, else the procedural generator. */
  provider?: FusionProvider;
  now?: () => number;
  /** Default: true unless MARKET_OPEN=0. */
  marketOpen?: boolean;
  /** Default: true. Tests that hammer one endpoint turn it off. */
  rateLimit?: boolean;
  modelTimeoutMs?: number;
  /** Directory with the built client. Served if it exists. */
  staticDir?: string;
}

/** CRAFT_PROVIDER=procedural|bedrock forces the choice; otherwise it follows the credentials. */
export function defaultProvider(env: NodeJS.ProcessEnv = process.env): FusionProvider {
  const forced = env.CRAFT_PROVIDER;
  if (forced === 'bedrock' || (forced !== 'procedural' && hasBedrockCredentials(env))) return new BedrockProvider();
  return new ProceduralProvider();
}

// Request bodies. Everything a client sends is checked here before it is used.
const id = z.string().min(1).max(64);
const idem = z.string().min(8).max(64);
const count = (max: number) => z.number().int().min(0).max(max);
const rawBag = z.object({ timber: count(100_000), ore: count(100_000), hide: count(100_000) });
const rawId = z.enum(RAWS);

const Body = {
  empty: z.object({}).optional(),
  fuse: z.object({ a: id, b: id, ctx: z.enum(['run', 'town']), uidA: id.optional(), uidB: id.optional() }),
  runStart: z.object({
    mode: z.enum(['run', 'daily', 'practice']),
    character: z.enum(CHARACTERS as [string, ...string[]]),
    kit: z.array(id).max(KIT_SLOTS).default([]),
  }),
  runEnd: z.object({
    runId: id,
    wavesCleared: count(12),
    won: z.boolean(),
    scripEarned: count(1_000_000),
    scripHeld: count(1_000_000),
    level: count(1000),
    raws: rawBag,
    mule: rawBag,
    carry: z.array(id).max(3),
    kills: count(1_000_000),
    fusions: z.array(z.tuple([id, id, id])).max(BOUNDS.fusions),
  }),
  factor: z.object({ raw: rawId, side: z.enum(['buy', 'sell']), qty: z.number().int().min(1).max(FACTOR.maxQty), idem }),
  list: z.object({ uid: id, price: z.number().int().min(1).max(LISTING.maxPrice), idem }),
  buy: z.object({ listingId: id, idem }),
  cancel: z.object({ listingId: id }),
  salvage: z.object({ uid: id }),
  give: z.object({ raws: rawBag.partial() }),
};

type Env = { Variables: { player: Player } };

export function createApp(opts: AppOptions = {}) {
  const now = opts.now ?? Date.now;
  const ctx: Ctx = {
    db: opts.db ?? openDb(opts.dbPath ?? process.env.DB_PATH ?? './data/craftrade.db'),
    provider: opts.provider ?? defaultProvider(),
    now,
    marketOpen: opts.marketOpen ?? process.env.MARKET_OPEN !== '0',
    modelTimeoutMs: opts.modelTimeoutMs ?? MODEL_TIMEOUT_MS,
    inflight: new Map(),
    reserved: new Map(),
  };
  // Idempotency records only need to outlive client retries.
  ctx.db.prepare('DELETE FROM idem WHERE created < ?').run(now() - 7 * 24 * 3600 * 1000);
  const buckets = new Buckets(now);
  const limited = opts.rateLimit ?? true;
  const app = new Hono<Env>();

  const fail = (c: Context, status: ApiErr['status'], code: string, error: string) => c.json<ApiError>({ error, code }, status);

  app.onError((err, c) => {
    if (err instanceof ApiErr) return fail(c, err.status, err.code, err.message);
    console.error(err);
    return fail(c, 500, 'server_error', 'Something went wrong on the server.');
  });
  app.notFound((c) => fail(c, 404, 'not_found', 'No such endpoint.'));

  /** Behind a proxy (TRUST_PROXY=1) the last forwarded hop is the client; otherwise use the socket. */
  const ipOf = (c: Context): string => {
    if (process.env.TRUST_PROXY === '1') {
      const hop = c.req.header('x-forwarded-for')?.split(',').pop()?.trim();
      if (hop) return hop;
    }
    return (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress ?? 'local';
  };
  const allow = (key: string, limit: { burst: number; perSecond: number }, scale = 1) => {
    if (limited && !buckets.take(key, limit.burst * scale, limit.perSecond * scale)) {
      throw new ApiErr(429, 'rate_limited', 'Too many requests. Wait a moment and try again.');
    }
  };

  const read = async <T>(c: Context, schema: z.ZodType<T>): Promise<T> => {
    const parsed = schema.safeParse(await c.req.json().catch(() => undefined));
    if (parsed.success) return parsed.data;
    const where = parsed.error.issues[0]?.path.join('.');
    throw new ApiErr(400, 'bad_request', where ? `The request is not valid at ${where}.` : 'The request is not valid.');
  };

  app.use('/api/*', bodyLimit({ maxSize: 64 * 1024, onError: (c) => fail(c, 400, 'bad_request', 'The request is too large.') }));
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    const mutating = c.req.method !== 'GET';
    if (mutating) allow(`ip:${ipOf(c)}`, LIMITS.post, 2);
    if (c.req.path !== '/api/hello') {
      const player = findPlayer(ctx, c.req.header('x-device'));
      if (!player) throw new ApiErr(401, 'no_device', 'Unknown device. Call hello first.');
      if (mutating) allow(`t:${player.id}`, LIMITS.post);
      c.set('player', player);
    }
    await next();
  });

  app.post('/api/hello', async (c) => {
    await read(c, Body.empty);
    const sent = c.req.header('x-device');
    const known = findPlayer(ctx, sent);
    if (!known) allow(`new:${ipOf(c)}`, LIMITS.newDevice);
    return c.json<HelloRes>(
      tx(ctx.db, () => {
        const made = known ? undefined : createPlayer(ctx);
        const player = known ?? made!.player;
        touch(ctx, player.id);
        return { token: made?.token ?? sent!, profile: profile(ctx, player.id), stations: stations(ctx), llm: ctx.provider.llm };
      }),
    );
  });

  app.post('/api/name/reroll', (c) =>
    c.json<NameRes>(
      tx(ctx.db, () => {
        rerollName(ctx, c.var.player.id);
        return { profile: profile(ctx, c.var.player.id) };
      }),
    ),
  );

  app.post('/api/fuse', async (c) => {
    allow(`fuse:ip:${ipOf(c)}`, LIMITS.fuse, 2);
    allow(`fuse:t:${c.var.player.id}`, LIMITS.fuse);
    return c.json(await fuse(ctx, c.var.player, await read(c, Body.fuse)));
  });
  app.get('/api/items', (c) => {
    const ids = (c.req.query('ids') ?? '').split(',').filter(Boolean).slice(0, 100);
    return c.json({ items: itemsByIds(ctx, ids) });
  });
  app.get('/api/codex', (c) => c.json(codex(ctx, c.var.player)));

  app.post('/api/run/start', async (c) => {
    const body = await read(c, Body.runStart);
    return c.json(startRun(ctx, c.var.player, body as Parameters<typeof startRun>[2]));
  });
  app.post('/api/run/end', async (c) => {
    const body = await read(c, Body.runEnd);
    return c.json(endRun(ctx, c.var.player, body as Parameters<typeof endRun>[2]));
  });

  app.get('/api/market', (c) => c.json(marketView(ctx, c.var.player)));
  app.post('/api/market/factor', async (c) => c.json(factorTrade(ctx, c.var.player, await read(c, Body.factor))));
  app.post('/api/market/list', async (c) => c.json(listItem(ctx, c.var.player, await read(c, Body.list))));
  app.post('/api/market/buy', async (c) => c.json(buyListing(ctx, c.var.player, await read(c, Body.buy))));
  app.post('/api/market/cancel', async (c) => c.json(cancelListing(ctx, c.var.player, await read(c, Body.cancel))));
  app.post('/api/market/salvage', async (c) => c.json(salvage(ctx, c.var.player, await read(c, Body.salvage))));

  app.get('/api/town', (c) => c.json(townView(ctx)));
  app.post('/api/town/give', async (c) => c.json(give(ctx, c.var.player, await read(c, Body.give))));

  app.get('/api/daily', (c) => c.json(dailyBoard(ctx, c.var.player)));

  app.all('/api/*', (c) => fail(c, 404, 'not_found', 'No such endpoint.'));

  // The built client, in production. Unknown paths fall back to the page itself.
  const dir = opts.staticDir;
  if (dir && existsSync(dir)) {
    app.use('*', serveStatic({ root: dir }));
    app.get('*', serveStatic({ root: dir, path: 'index.html' }));
  }
  return app;
}
