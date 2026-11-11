import { createHash, randomBytes, randomInt } from 'node:crypto';
import { BASE_ITEM } from '../src/shared/content/items.ts';
import { RELIC } from '../src/shared/content/relics.ts';
import type { ItemSpec } from '../src/shared/item.ts';
import { BASE_NOVEL_PER_DAY, type CharacterId, type Profile, type StashItem, type StationId } from '../src/shared/protocol.ts';
import { RAWS, type GlyphId, type RawBag } from '../src/shared/vocab.ts';
import {
  ACTIVE_WINDOW_MS, CHARACTERS, MAX_HAZARD, NAME_REROLL_MS, NOVEL_PER_ASSAY_TIER, NOVICE_NOVEL, PERK, charactersFor, featuresFor, stashLimit,
} from './config.ts';
import type { DB } from './db.ts';
import { ApiErr, bad } from './errors.ts';
import type { PlaybackInput, PlaybackResult } from '../src/shared/replay.ts';
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
  /** Uniform in [0, 1). The relic roll's dice; tests pass their own. */
  rng: () => number;
  /** Development only: a relic id that every paying report brings home. Null in production. */
  relicForce: string | null;
  /** 'off': reports are checked against the caps only. 'flag': a replay, when sent, is played again and the run marked. 'enforce': no replay, no pay. */
  replay: 'off' | 'flag' | 'enforce';
  /** False in tests that report many runs in a row: the hourly and daily limits on paying runs are not applied. */
  runRate: boolean;
  /** Keys the daily seed. From DAILY_SECRET, or made once and kept in the database. */
  secret: string;
  /** Plays a run again from its input log. Off the main thread in the real server. */
  verify: (input: PlaybackInput) => Promise<PlaybackResult>;
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
  created: number;
  name_changed: number;
  stash_bought: number;
  title: string;
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

/** A new name, at most once a week. Finder stamps and boards follow the name, so it should not change at will. */
export function rerollName(ctx: Ctx, id: number) {
  const p = playerById(ctx, id);
  if (p.name_changed && ctx.now() - p.name_changed < NAME_REROLL_MS) {
    throw new ApiErr(429, 'name_wait', 'A name can be changed once a week.');
  }
  ctx.db.prepare('UPDATE players SET name = ?, name_changed = ? WHERE id = ?').run(freeName(ctx.db), ctx.now(), id);
}

/** Players with at least one paid run in the last week. Saying hello does not make a player active. */
export function activePlayers(ctx: Ctx): number {
  const row = ctx.db
    .prepare(`SELECT COUNT(DISTINCT player_id) AS n FROM runs WHERE paid = 1 AND ended >= ?`)
    .get(ctx.now() - ACTIVE_WINDOW_MS) as { n: number };
  return row.n;
}

// Items.

interface ItemRow { id: string; name: string; glyph: string; tags: string; effects: string; by: string }

/** An authored item or relic, or a fused one from the database with its finder's name. */
export function getItem(ctx: Ctx, id: string): ItemSpec | undefined {
  // Own keys only: an id like "__proto__" must not find Object.prototype.
  if (Object.hasOwn(BASE_ITEM, id)) return BASE_ITEM[id];
  if (Object.hasOwn(RELIC, id)) return RELIC[id];
  const row = ctx.db
    .prepare('SELECT i.id, i.name, i.glyph, i.tags, i.effects, p.name AS by FROM items i JOIN players p ON p.id = i.finder WHERE i.id = ?')
    .get(id) as ItemRow | undefined;
  if (!row) return undefined;
  return { id: row.id, name: row.name, glyph: row.glyph as GlyphId, tags: JSON.parse(row.tags), effects: JSON.parse(row.effects), by: row.by };
}

/** One relic in someone's hands: the authored spec with its number, finder and date. */
export function relicInstance(ctx: Ctx, ref: number): ItemSpec | undefined {
  const row = ctx.db
    .prepare('SELECT r.relic, r.serial, r.found, p.name AS by FROM relics r JOIN players p ON p.id = r.finder WHERE r.id = ?')
    .get(ref) as { relic: string; serial: number; found: number; by: string } | undefined;
  if (!row || !Object.hasOwn(RELIC, row.relic)) return undefined;
  return { ...RELIC[row.relic], serial: row.serial, by: row.by, found: dayOf(row.found) };
}

/** The item a stash row or a listing holds. A relic comes back with its number and finder. */
export function heldItem(ctx: Ctx, row: { item_id: string; relic_ref: number | null }): ItemSpec | undefined {
  return row.relic_ref != null ? relicInstance(ctx, row.relic_ref) : getItem(ctx, row.item_id);
}

/** Put an item in a stash. `relicRef` names the row in relics when the item is one; it moves with the item for good. */
export function addStash(ctx: Ctx, playerId: number, itemId: string, charges: number, relicRef: number | null = null, uid = newId()): string {
  ctx.db
    .prepare('INSERT INTO stash (uid, player_id, item_id, charges, created, relic_ref) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uid, playerId, itemId, charges, ctx.now(), relicRef);
  return uid;
}

export interface StashRow { uid: string; item_id: string; charges: number; relic_ref: number | null; repairs: number }

export function stashRow(ctx: Ctx, playerId: number, uid: string) {
  return ctx.db.prepare('SELECT uid, item_id, charges, relic_ref, repairs FROM stash WHERE uid = ? AND player_id = ?').get(uid, playerId) as StashRow | undefined;
}

/** Items in the stash that count toward its limit. A relic takes no room. */
export function stashUsed(ctx: Ctx, playerId: number): number {
  return (ctx.db.prepare('SELECT COUNT(*) AS n FROM stash WHERE player_id = ? AND relic_ref IS NULL').get(playerId) as { n: number }).n;
}
/** Free places in the stash. */
export const stashRoom = (ctx: Ctx, playerId: number): number => stashLimit(playerById(ctx, playerId).stash_bought) - stashUsed(ctx, playerId);

/** True while the perk of a finished works is running. */
export function perkOn(ctx: Ctx, id: string): boolean {
  const row = ctx.db.prepare('SELECT until FROM perks WHERE id = ?').get(id) as { until: number } | undefined;
  return !!row && row.until > ctx.now();
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

/** Untried pairs a day. A new account gets a few until it has played; the Assay Office and the beacon add more. */
export function novelAllowance(ctx: Ctx, playerId?: number): number {
  if (playerId != null && playerById(ctx, playerId).runs < NOVICE_NOVEL.runs) return NOVICE_NOVEL.perDay;
  return BASE_NOVEL_PER_DAY + NOVEL_PER_ASSAY_TIER * (stations(ctx).assay - 1) + (perkOn(ctx, 'beacon') ? PERK.beaconNovel : 0);
}

/** Per character: the highest hazard open and the highest won. Level n + 1 opens with a win at n. */
export function hazardBook(ctx: Ctx, playerId: number): Record<CharacterId, { open: number; best: number }> {
  const rows = ctx.db.prepare('SELECT character, MAX(hazard) AS best FROM records WHERE player_id = ? AND wins > 0 GROUP BY character').all(playerId) as { character: CharacterId; best: number }[];
  const out = Object.fromEntries(CHARACTERS.map((c) => [c, { open: 0, best: -1 }])) as Record<CharacterId, { open: number; best: number }>;
  for (const r of rows) if (out[r.character]) out[r.character] = { open: Math.min(MAX_HAZARD, r.best + 1), best: r.best };
  return out;
}

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
  const rows = ctx.db.prepare('SELECT uid, item_id, charges, relic_ref, repairs FROM stash WHERE player_id = ? ORDER BY rowid').all(playerId) as StashRow[];
  const items: StashItem[] = [];
  for (const r of rows) {
    const item = heldItem(ctx, r);
    if (item) items.push({ uid: r.uid, item, charges: r.charges, repairs: r.repairs });
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
    novelLeft: Math.max(0, novelAllowance(ctx, playerId) - novelUsed(ctx, playerId)),
    daysPlayed: count('SELECT COUNT(*) AS n FROM daily_results WHERE player_id = ?'),
    finds: count('SELECT COUNT(*) AS n FROM recipes WHERE finder = ? AND counted = 1'),
    title: p.title,
    titles: (ctx.db.prepare('SELECT title FROM titles WHERE player_id = ? ORDER BY ts, title').all(playerId) as { title: string }[]).map((t) => t.title),
    stashUsed: rows.filter((r) => r.relic_ref == null).length,
    stashLimit: stashLimit(p.stash_bought),
    stashBought: p.stash_bought,
    hazard: hazardBook(ctx, playerId),
    nameChangeAt: p.name_changed ? p.name_changed + NAME_REROLL_MS : 0,
  };
}
