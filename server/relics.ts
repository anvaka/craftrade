// Relics: the roll, the world's book of every one found, and the notice.
//
// A relic is decided here and nowhere else. The client never asks for one and
// nothing in a run report can ask for one: endRun calls relicSource() on a
// report that has already passed its checks, and rollRelic() on the server's
// own random number. The run seed plays no part, so a seed cannot be scummed.

import { randomInt } from 'node:crypto';
import { RELIC, RELICS, isRelicId } from '../src/shared/content/relics.ts';
import type { ItemSpec } from '../src/shared/item.ts';
import type { RelicFind, RelicsRes, RunEndReq, WorldNotice } from '../src/shared/protocol.ts';
import { RELIC_LATE_DEATH_WAVE, RELIC_NOTICE_MS, RELIC_ONE_IN, RELIC_ROLLS_PER_DAY, RELIC_WEIGHT } from './config.ts';
import { addStash, dayOf, relicInstance, type Ctx } from './players.ts';

export type RelicSource = keyof typeof RELIC_ONE_IN;

/** The most values crypto.randomInt will draw from in one call. */
const DICE_SIDES = 2 ** 48 - 1;
/** The server's own dice: uniform in [0, 1) from the system's secure source, 48 bits deep. */
export const secureRandom = (): number => randomInt(DICE_SIDES) / DICE_SIDES;

const WEIGHTS = RELICS.map((r) => [r.id, RELIC_WEIGHT[r.id] ?? 0] as const);
const TOTAL_WEIGHT = WEIGHTS.reduce((n, [, w]) => n + w, 0);

/** Chance that one report from this source finds any relic. */
export const relicChance = (source: RelicSource): number => 1 / RELIC_ONE_IN[source];
/** Chance that one report from this source finds this relic. */
export const relicChanceOf = (source: RelicSource, id: string): number => (relicChance(source) * (RELIC_WEIGHT[id] ?? 0)) / TOTAL_WEIGHT;

/**
 * Roll once. Returns the id of the relic found, or null (nearly always).
 * One number decides both whether and which: the hit range [0, 1/N) is split
 * between the relics by weight. `rnd` must return a uniform number in [0, 1).
 */
export function rollRelic(source: RelicSource, rnd: () => number): string | null {
  const u = rnd();
  const p = relicChance(source);
  if (!(u >= 0 && u < p)) return null;
  let x = (u / p) * TOTAL_WEIGHT;
  for (const [id, w] of WEIGHTS) {
    if (x < w) return id;
    x -= w;
  }
  return WEIGHTS[WEIGHTS.length - 1][0];
}

/** The fields of a run ticket the roll looks at. */
export interface RollTicket { mode: 'run' | 'daily' | 'practice'; scored: number; waves: number }

/**
 * Which roll, if any, a checked report has earned. Practice and unscored
 * dailies never roll. A run the player left never rolls. A ticket that was
 * never reported (abandoned, replaced, expired) never reaches this at all.
 */
export function relicSource(t: RollTicket, r: Pick<RunEndReq, 'won' | 'wavesCleared' | 'quit'>): RelicSource | null {
  if (r.quit) return null;
  if (t.mode === 'run') {
    if (r.won) return 'win';
    // wavesCleared counts finished waves, so the death came on the next one.
    return r.wavesCleared + 1 >= RELIC_LATE_DEATH_WAVE ? 'lateDeath' : null;
  }
  if (t.mode === 'daily' && t.scored && r.won) return 'daily';
  return null;
}

/** RELIC_FORCE, for looking at the reveal in development. Never honoured in production. */
export function devRelicForce(env: NodeJS.ProcessEnv = process.env, asked: string | undefined = env.RELIC_FORCE): string | null {
  if (env.NODE_ENV === 'production') return null;
  return isRelicId(asked) ? asked : null;
}

/**
 * Enter a new relic in the world's book and put it in the finder's stash.
 * Must run inside the run/end transaction: the number is the next one for its
 * kind, and UNIQUE (relic, serial) is the last word if two writers ever raced.
 */
export function grantRelic(ctx: Ctx, playerId: number, relicId: string, runId: string, source: string): ItemSpec {
  const next = ctx.db.prepare('SELECT COALESCE(MAX(serial), 0) + 1 AS n FROM relics WHERE relic = ?').get(relicId) as { n: number };
  const info = ctx.db
    .prepare('INSERT INTO relics (relic, serial, finder, run_id, source, found) VALUES (?, ?, ?, ?, ?, ?)')
    .run(relicId, next.n, playerId, runId, source, ctx.now());
  const ref = Number(info.lastInsertRowid);
  addStash(ctx, playerId, relicId, 1, ref);
  return relicInstance(ctx, ref)!;
}

/**
 * Put a checked, paying report to the roll. Returns the relic found, already
 * in the stash, or undefined. Marks the run as rolled so the daily count holds.
 */
export function rollForRun(ctx: Ctx, playerId: number, t: RollTicket & { id: string }, r: RunEndReq): ItemSpec | undefined {
  if (t.mode === 'practice' || (t.mode === 'daily' && !t.scored) || r.quit) return undefined;
  // Development only: every paying report that was not left brings the named relic home.
  if (ctx.relicForce) return grantRelic(ctx, playerId, ctx.relicForce, t.id, 'forced');
  const source = relicSource(t, r);
  if (!source) return undefined;
  const since = ctx.now() - 24 * 3600 * 1000;
  const rolled = ctx.db.prepare('SELECT COUNT(*) AS n FROM runs WHERE player_id = ? AND relic_roll = 1 AND ended >= ?').get(playerId, since) as { n: number };
  if (rolled.n >= RELIC_ROLLS_PER_DAY) return undefined;
  ctx.db.prepare('UPDATE runs SET relic_roll = 1 WHERE id = ?').run(t.id);
  const found = rollRelic(source, ctx.rng);
  return found ? grantRelic(ctx, playerId, found, t.id, source) : undefined;
}

const ROLL_SHOWN = 500;
const FIND_COLS = 'r.relic, r.serial, r.found, p.name AS by';
interface FindRow { relic: string; serial: number; found: number; by: string }
const toFind = (row: FindRow): RelicFind => ({
  relic: row.relic, name: RELIC[row.relic]?.name ?? row.relic, serial: row.serial, finder: row.by, date: dayOf(row.found), ts: row.found,
});

/** The newest find of the last 24 hours, or null. */
export function worldNotice(ctx: Ctx): WorldNotice {
  const row = ctx.db
    .prepare(`SELECT ${FIND_COLS} FROM relics r JOIN players p ON p.id = r.finder WHERE r.found > ? ORDER BY r.id DESC LIMIT 1`)
    .get(ctx.now() - RELIC_NOTICE_MS) as FindRow | undefined;
  return row ? toFind(row) : null;
}

/** The roll of every relic found, and how many of each kind exist. Holders are not part of it. */
export function relicsRoll(ctx: Ctx): RelicsRes {
  // The page shows the newest ROLL_SHOWN finds, oldest first. Counts are over every find.
  const rows = ctx.db.prepare(`SELECT ${FIND_COLS} FROM relics r JOIN players p ON p.id = r.finder ORDER BY r.id DESC LIMIT ?`).all(ROLL_SHOWN) as FindRow[];
  const roll = rows.filter((r) => isRelicId(r.relic)).map(toFind).reverse();
  const counts = ctx.db.prepare('SELECT relic, COUNT(*) AS n FROM relics GROUP BY relic ORDER BY MIN(id)').all() as { relic: string; n: number }[];
  // Found kinds first, in the order each was first found; then one blank row for each kind still unfound.
  const kinds: RelicsRes['kinds'] = counts.filter((c) => isRelicId(c.relic)).map((c) => ({ id: c.relic, name: RELIC[c.relic].name, found: c.n }));
  const total = kinds.reduce((n, k) => n + k.found, 0);
  while (kinds.length < RELICS.length) kinds.push({ id: null, name: null, found: 0 });
  return { roll, kinds, total };
}
