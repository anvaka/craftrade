import { createHash, randomBytes, randomInt } from 'node:crypto';
import { BASE_ITEM } from '../src/shared/content/items.ts';
import type { ItemSpec } from '../src/shared/item.ts';
import { BASE_NOVEL_PER_DAY, type Profile, type StashItem, type StationId } from '../src/shared/protocol.ts';
import { RAWS, type GlyphId, type RawBag } from '../src/shared/vocab.ts';
import { ACTIVE_WINDOW_MS, NOVEL_PER_ASSAY_TIER, charactersFor, featuresFor } from './config.ts';
import type { DB } from './db.ts';
import { ApiErr, bad } from './errors.ts';
import type { FusionProvider, Proposal } from './provider.ts';

export interface Ctx {
  db: DB;
  provider: FusionProvider;
  now: () => number;
  marketOpen: boolean;
  modelTimeoutMs: number;
  /** One model call per untried pair, shared by everyone waiting on it. */
  inflight: Map<string, Promise<Proposal>>;
  /** Untried pairs a player has out with the model right now. */
  reserved: Map<number, number>;
}

export interface Player {
  id: number;
  name: string;
  marks: number;
  timber: number;
  ore: number;
  hide: number;
  runs: number;
  wins: number;
  standing: number;
}

export const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const newId = () => randomBytes(9).toString('base64url');
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

// Plain trade surnames. Names are never typed by players.
const SURNAMES = [
  'Arkwright', 'Baker', 'Barker', 'Bowyer', 'Brewer', 'Carter', 'Cartwright', 'Chandler', 'Chapman', 'Collier',
  'Cooper', 'Cutler', 'Draper', 'Dyer', 'Farrier', 'Fletcher', 'Forester', 'Fuller', 'Glover', 'Harper',
  'Hooper', 'Joiner', 'Mason', 'Mercer', 'Miller', 'Naylor', 'Ostler', 'Parker', 'Pitman', 'Plummer',
  'Potter', 'Roper', 'Sadler', 'Salter', 'Sawyer', 'Shepherd', 'Skinner', 'Slater', 'Smith', 'Spicer',
  'Tanner', 'Thatcher', 'Thresher', 'Tiller', 'Turner', 'Tyler', 'Waller', 'Weaver', 'Webster', 'Wheeler', 'Wright',
];

function freeName(db: DB): string {
  const taken = db.prepare('SELECT 1 FROM players WHERE name = ?');
  for (let i = 0; i < 12; i++) {
    const name = `${SURNAMES[randomInt(SURNAMES.length)]} ${randomInt(100, 1000)}`;
    if (!taken.get(name)) return name;
  }
  return `${SURNAMES[randomInt(SURNAMES.length)]} ${randomInt(1000, 100000)}`;
}

/** Create a player. The token is returned once; only its hash is kept. */
export function createPlayer(ctx: Ctx): { token: string; player: Player } {
  const token = randomBytes(32).toString('base64url');
  const now = ctx.now();
  const info = ctx.db
    .prepare('INSERT INTO players (token_hash, name, created, last_seen) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), freeName(ctx.db), now, now);
  return { token, player: playerById(ctx, Number(info.lastInsertRowid)) };
}

export function findPlayer(ctx: Ctx, token: string | undefined): Player | undefined {
  if (!token || token.length > 128) return undefined;
  return ctx.db.prepare('SELECT * FROM players WHERE token_hash = ?').get(hashToken(token)) as Player | undefined;
}

export function playerById(ctx: Ctx, id: number): Player {
  return ctx.db.prepare('SELECT * FROM players WHERE id = ?').get(id) as Player;
}

export function touch(ctx: Ctx, id: number) {
  ctx.db.prepare('UPDATE players SET last_seen = ? WHERE id = ?').run(ctx.now(), id);
}

export function rerollName(ctx: Ctx, id: number) {
  ctx.db.prepare('UPDATE players SET name = ? WHERE id = ?').run(freeName(ctx.db), id);
}

export function activePlayers(ctx: Ctx): number {
  const row = ctx.db.prepare('SELECT COUNT(*) AS n FROM players WHERE last_seen >= ?').get(ctx.now() - ACTIVE_WINDOW_MS) as { n: number };
  return row.n;
}

// Items.

interface ItemRow { id: string; name: string; glyph: string; tags: string; effects: string; by: string }

/** An authored item, or a fused one from the database with its finder's name. */
export function getItem(ctx: Ctx, id: string): ItemSpec | undefined {
  const base = BASE_ITEM[id];
  if (base) return base;
  const row = ctx.db
    .prepare('SELECT i.id, i.name, i.glyph, i.tags, i.effects, p.name AS by FROM items i JOIN players p ON p.id = i.finder WHERE i.id = ?')
    .get(id) as ItemRow | undefined;
  if (!row) return undefined;
  return { id: row.id, name: row.name, glyph: row.glyph as GlyphId, tags: JSON.parse(row.tags), effects: JSON.parse(row.effects), by: row.by };
}

export function addStash(ctx: Ctx, playerId: number, itemId: string, charges: number): string {
  const uid = newId();
  ctx.db.prepare('INSERT INTO stash (uid, player_id, item_id, charges, created) VALUES (?, ?, ?, ?, ?)').run(uid, playerId, itemId, charges, ctx.now());
  return uid;
}

export function stashRow(ctx: Ctx, playerId: number, uid: string) {
  return ctx.db.prepare('SELECT uid, item_id, charges FROM stash WHERE uid = ? AND player_id = ?').get(uid, playerId) as
    | { uid: string; item_id: string; charges: number }
    | undefined;
}

// Balances. Every change to marks or raws goes through move(), which writes the ledger row.

export type Delta = Partial<RawBag> & { marks?: number };

export function move(ctx: Ctx, playerId: number, kind: string, delta: Delta, reason = '') {
  const marks = delta.marks ?? 0;
  const [timber, ore, hide] = RAWS.map((r) => delta[r] ?? 0);
  if (!marks && !timber && !ore && !hide) return;
  const p = playerById(ctx, playerId);
  if (p.marks + marks < 0) throw bad('no_marks', 'Not enough marks.');
  if (p.timber + timber < 0 || p.ore + ore < 0 || p.hide + hide < 0) throw bad('no_raws', 'Not enough raws.');
  ctx.db
    .prepare('UPDATE players SET marks = marks + ?, timber = timber + ?, ore = ore + ?, hide = hide + ? WHERE id = ?')
    .run(marks, timber, ore, hide, playerId);
  logLedger(ctx, playerId, kind, { marks, timber, ore, hide }, reason);
}

export function logLedger(ctx: Ctx, playerId: number | null, kind: string, d: Delta, reason = '') {
  ctx.db
    .prepare('INSERT INTO ledger (ts, player_id, kind, marks, timber, ore, hide, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(ctx.now(), playerId, kind, d.marks ?? 0, d.timber ?? 0, d.ore ?? 0, d.hide ?? 0, reason);
}

// Town state that other modules need.

export function stations(ctx: Ctx): Record<StationId, number> {
  const rows = ctx.db.prepare('SELECT id, tier FROM stations').all() as { id: StationId; tier: number }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.tier])) as Record<StationId, number>;
}

// Untried pairs.

export const novelAllowance = (ctx: Ctx) => BASE_NOVEL_PER_DAY + NOVEL_PER_ASSAY_TIER * (stations(ctx).assay - 1);

export function novelUsed(ctx: Ctx, playerId: number): number {
  const row = ctx.db.prepare('SELECT used FROM novel WHERE player_id = ? AND day = ?').get(playerId, dayOf(ctx.now())) as { used: number } | undefined;
  return row?.used ?? 0;
}

export function spendNovel(ctx: Ctx, playerId: number) {
  ctx.db
    .prepare('INSERT INTO novel (player_id, day, used) VALUES (?, ?, 1) ON CONFLICT (player_id, day) DO UPDATE SET used = used + 1')
    .run(playerId, dayOf(ctx.now()));
}

export function profile(ctx: Ctx, playerId: number): Profile {
  const p = playerById(ctx, playerId);
  if (!p) throw new ApiErr(401, 'no_device', 'Unknown device.');
  const rows = ctx.db.prepare('SELECT uid, item_id, charges FROM stash WHERE player_id = ? ORDER BY rowid').all(playerId) as {
    uid: string; item_id: string; charges: number;
  }[];
  const items: StashItem[] = [];
  for (const r of rows) {
    const item = getItem(ctx, r.item_id);
    if (item) items.push({ uid: r.uid, item, charges: r.charges });
  }
  const count = (sql: string) => (ctx.db.prepare(sql).get(playerId) as { n: number }).n;
  return {
    name: p.name,
    marks: p.marks,
    raws: { timber: p.timber, ore: p.ore, hide: p.hide },
    items,
    runs: p.runs,
    wins: p.wins,
    characters: charactersFor(p.runs),
    features: featuresFor(p.runs),
    standing: p.standing,
    novelLeft: Math.max(0, novelAllowance(ctx) - novelUsed(ctx, playerId)),
    daysPlayed: count('SELECT COUNT(*) AS n FROM daily_results WHERE player_id = ?'),
    finds: count('SELECT COUNT(*) AS n FROM recipes WHERE finder = ?'),
  };
}
