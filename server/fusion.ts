import { BASE_ITEMS } from '../src/shared/content/items.ts';
import { fnv1a, fusedItemId, fusionBlock, fusionBudget, recipeKey, type ItemSpec } from '../src/shared/item.ts';
import { KIT_CHARGES, type CodexRecipe, type CodexRes, type FuseReq, type FuseRes } from '../src/shared/protocol.ts';
import { MODEL_ATTEMPTS } from './config.ts';
import { tx } from './db.ts';
import { ApiErr, bad } from './errors.ts';
import { addStash, getItem, novelAllowance, novelUsed, profile, spendNovel, stashRow, type Ctx, type Player } from './players.ts';
import { fallbackName, validatePick, type Proposal } from './provider.ts';

interface RecipeRow { key: string; a: string; b: string; out: string; finder: number; by: string }

const recipeByKey = (ctx: Ctx, key: string) =>
  ctx.db
    .prepare('SELECT r.key, r.a, r.b, r.out, r.finder, p.name AS by FROM recipes r JOIN players p ON p.id = r.finder WHERE r.key = ?')
    .get(key) as RecipeRow | undefined;

/** Ask the provider, with a timeout and one retry. Anything it returns is validated here. */
async function askProvider(ctx: Ctx, a: ItemSpec, b: ItemSpec, budget: number, key: string): Promise<Proposal> {
  for (let attempt = 0; attempt < MODEL_ATTEMPTS; attempt++) {
    const abort = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    try {
      const pick = await Promise.race([
        ctx.provider.propose(a, b, budget, key, abort.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Model call timed out.')), ctx.modelTimeoutMs);
        }),
      ]);
      const ok = validatePick(pick, budget, key);
      if (ok) return { ...ok, model: ctx.provider.model, raw: JSON.stringify(pick ?? null).slice(0, 4000) };
    } catch (err) {
      console.warn(`[fuse] provider failed for ${key} (attempt ${attempt + 1}): ${(err as Error)?.message ?? err}`);
    } finally {
      clearTimeout(timer);
      abort.abort();
    }
  }
  throw new ApiErr(503, 'model_down', 'The assayer cannot be reached. Known recipes still work. Nothing was used.');
}

/** Everyone waiting on the same untried pair shares one provider call. */
function proposalFor(ctx: Ctx, a: ItemSpec, b: ItemSpec, key: string): Promise<Proposal> {
  let pending = ctx.inflight.get(key);
  if (!pending) {
    // Always ask in id order, so the answer cannot depend on which way round the pair was offered.
    const [x, y] = a.id < b.id ? [a, b] : [b, a];
    pending = askProvider(ctx, x, y, fusionBudget(x, y), key).finally(() => ctx.inflight.delete(key));
    ctx.inflight.set(key, pending);
  }
  return pending;
}

const baseNames = () => new Set(BASE_ITEMS.map((i) => i.name.toLowerCase()));

/** First candidate nobody uses, else a deterministic procedural name. Runs inside the store transaction. */
function freeItemName(ctx: Ctx, p: Proposal, key: string): string {
  const base = baseNames();
  const taken = ctx.db.prepare('SELECT 1 FROM items WHERE name = ?');
  const free = (n: string) => !base.has(n.toLowerCase()) && !taken.get(n);
  for (const n of p.names) if (free(n)) return n;
  const seed = fnv1a(key);
  for (let i = 0; ; i++) {
    const n = fallbackName(seed, p.glyph, i);
    const name = n[0].toUpperCase() + n.slice(1);
    if (free(name)) return name;
  }
}

/** Store a new recipe, and its item unless another pair already produced the same spec. */
function storeRecipe(ctx: Ctx, playerId: number, key: string, a: string, b: string, p: Proposal) {
  const out = fusedItemId(p.effects);
  if (!ctx.db.prepare('SELECT 1 FROM items WHERE id = ?').get(out)) {
    ctx.db
      .prepare('INSERT INTO items (id, name, glyph, tags, effects, finder, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(out, freeItemName(ctx, p, key), p.glyph, JSON.stringify(p.tags), JSON.stringify(p.effects), playerId, ctx.now());
  }
  const [lo, hi] = a < b ? [a, b] : [b, a];
  ctx.db
    .prepare('INSERT INTO recipes (key, a, b, out, finder, model, raw, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(key, lo, hi, out, playerId, p.model, p.raw, ctx.now());
}

export async function fuse(ctx: Ctx, player: Player, req: FuseReq): Promise<FuseRes> {
  const a = getItem(ctx, req.a);
  const b = getItem(ctx, req.b);
  if (!a || !b) throw new ApiErr(404, 'unknown_item', 'No such item.');
  const block = fusionBlock(a, b);
  if (block) throw bad('blocked', block);

  const town = req.ctx === 'town';
  const owns = () => {
    if (!req.uidA || !req.uidB || req.uidA === req.uidB) return false;
    return stashRow(ctx, player.id, req.uidA)?.item_id === a.id && stashRow(ctx, player.id, req.uidB)?.item_id === b.id;
  };
  if (town && !owns()) throw bad('not_owned', 'Those items are not in your stash.');

  const key = recipeKey(a.id, b.id);
  let proposal: Proposal | undefined;
  if (!recipeByKey(ctx, key)) {
    const out = ctx.reserved.get(player.id) ?? 0;
    if (novelUsed(ctx, player.id) + out >= novelAllowance(ctx)) {
      throw new ApiErr(429, 'novel_limit', 'No untried pairs left today. Known recipes still work.');
    }
    ctx.reserved.set(player.id, out + 1);
    try {
      proposal = await proposalFor(ctx, a, b, key);
    } finally {
      const left = (ctx.reserved.get(player.id) ?? 1) - 1;
      if (left > 0) ctx.reserved.set(player.id, left);
      else ctx.reserved.delete(player.id);
    }
  }

  return tx(ctx.db, () => {
    // The primary key on recipes settles a race: whoever stores first is the finder.
    let first = false;
    if (!recipeByKey(ctx, key)) {
      if (!proposal) throw new Error('Recipe vanished between lookup and store.');
      storeRecipe(ctx, player.id, key, a.id, b.id, proposal);
      spendNovel(ctx, player.id);
      first = true;
    }
    const recipe = recipeByKey(ctx, key)!;
    const item = getItem(ctx, recipe.out)!;
    if (town) {
      if (!owns()) throw bad('not_owned', 'Those items are not in your stash.');
      ctx.db.prepare('DELETE FROM stash WHERE player_id = ? AND uid IN (?, ?)').run(player.id, req.uidA, req.uidB);
      addStash(ctx, player.id, item.id, KIT_CHARGES);
    }
    const known = ctx.db.prepare('INSERT OR IGNORE INTO player_recipes (player_id, key) VALUES (?, ?)').run(player.id, key);
    return { item, first, newToYou: known.changes === 1, by: recipe.by, profile: profile(ctx, player.id) };
  });
}

export function itemsByIds(ctx: Ctx, ids: string[]): ItemSpec[] {
  const out: ItemSpec[] = [];
  for (const id of new Set(ids)) {
    const item = getItem(ctx, id);
    if (item) out.push(item);
  }
  return out;
}

export function codex(ctx: Ctx, player: Player): CodexRes {
  const cols = 'r.key, r.a, r.b, r.out, p.name AS by';
  const mine = ctx.db
    .prepare(`SELECT ${cols} FROM player_recipes k JOIN recipes r ON r.key = k.key JOIN players p ON p.id = r.finder WHERE k.player_id = ? ORDER BY r.created`)
    .all(player.id) as RecipeRow[];
  const recent = ctx.db
    .prepare(`SELECT ${cols} FROM recipes r JOIN players p ON p.id = r.finder ORDER BY r.created DESC, r.key LIMIT 50`)
    .all() as RecipeRow[];
  const seen = new Set(mine.map((r) => r.key));
  const recipes: CodexRecipe[] = [
    ...mine.map((r) => ({ a: r.a, b: r.b, out: r.out, by: r.by, mine: true })),
    ...recent.filter((r) => !seen.has(r.key)).map((r) => ({ a: r.a, b: r.b, out: r.out, by: r.by, mine: false })),
  ];
  const n = (sql: string) => (ctx.db.prepare(sql).get() as { n: number }).n;
  return {
    recipes,
    items: itemsByIds(ctx, recipes.flatMap((r) => [r.a, r.b, r.out])),
    worldRecipes: n('SELECT COUNT(*) AS n FROM recipes'),
    worldItems: n('SELECT COUNT(*) AS n FROM items'),
  };
}
