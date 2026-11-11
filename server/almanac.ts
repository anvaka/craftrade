// The almanac: what a player has seen and done, as "x of y", and the titles
// that follow from it. Everything here is counted by the server from things
// it has already checked. Nothing in it can be bought.

import { TITLE, TITLES } from '../src/shared/almanac.ts';
import { BASE_ITEM, BASE_ITEMS } from '../src/shared/content/items.ts';
import { RELIC, RELICS } from '../src/shared/content/relics.ts';
import { fusionBlock } from '../src/shared/item.ts';
import type { AlmanacLine, AlmanacRes, TitleRes } from '../src/shared/protocol.ts';
import { ENEMIES } from '../src/sim/index.ts';
import { CHARACTERS, MAX_HAZARD, STATIONS, WORKS } from './config.ts';
import { tx } from './db.ts';
import { bad } from './errors.ts';
import { playerById, profile, type Ctx, type Player } from './players.ts';

/** Pairs of two different authored items that can be fused at all. */
export const AUTHORED_PAIRS = (() => {
  let n = 0;
  for (let i = 0; i < BASE_ITEMS.length; i++) for (let j = i + 1; j < BASE_ITEMS.length; j++) if (!fusionBlock(BASE_ITEMS[i], BASE_ITEMS[j])) n++;
  return n;
})();

const ENEMY_IDS = ENEMIES.map((e) => e.id);
const authored = (id: string) => Object.hasOwn(BASE_ITEM, id);

/** Add to one almanac counter. */
export function note(ctx: Ctx, playerId: number, kind: string, key: string, n = 1) {
  if (n <= 0) return;
  ctx.db
    .prepare('INSERT INTO almanac (player_id, kind, key, n) VALUES (?, ?, ?, ?) ON CONFLICT (player_id, kind, key) DO UPDATE SET n = n + excluded.n')
    .run(playerId, kind, key, n);
}

const counters = (ctx: Ctx, playerId: number, kind: string): Record<string, number> =>
  Object.fromEntries((ctx.db.prepare('SELECT key, n FROM almanac WHERE player_id = ? AND kind = ?').all(playerId, kind) as { key: string; n: number }[]).map((r) => [r.key, r.n]));

/** Authored pairs this player has fused. */
export function myAuthoredPairs(ctx: Ctx, playerId: number): number {
  const rows = ctx.db.prepare('SELECT r.a, r.b FROM player_recipes k JOIN recipes r ON r.key = k.key WHERE k.player_id = ?').all(playerId) as { a: string; b: string }[];
  return rows.filter((r) => authored(r.a) && authored(r.b)).length;
}

/** Authored pairs anyone has fused. */
export function worldAuthoredPairs(ctx: Ctx): number {
  const rows = ctx.db.prepare('SELECT a, b FROM recipes').all() as { a: string; b: string }[];
  return rows.filter((r) => authored(r.a) && authored(r.b)).length;
}

interface Facts {
  runs: number; wins: number; finds: number; given: number; days: number; pairs: number;
  items: string[]; enemies: Record<string, number>; relics: string[]; wins_by: Record<string, number[]>;
  gave: Record<string, number>; works: Record<string, number>; made: number; foundRelic: boolean;
}

function facts(ctx: Ctx, playerId: number): Facts {
  const p = playerById(ctx, playerId);
  const n = (sql: string) => (ctx.db.prepare(sql).get(playerId) as { n: number }).n;
  const recs = ctx.db.prepare('SELECT character, hazard FROM records WHERE player_id = ? AND wins > 0 ORDER BY hazard').all(playerId) as { character: string; hazard: number }[];
  const wins_by: Record<string, number[]> = {};
  for (const r of recs) (wins_by[r.character] ??= []).push(r.hazard);
  return {
    runs: p.runs, wins: p.wins, given: p.standing,
    finds: n('SELECT COUNT(*) AS n FROM recipes WHERE finder = ? AND counted = 1'),
    days: n('SELECT COUNT(*) AS n FROM daily_results WHERE player_id = ?'),
    pairs: myAuthoredPairs(ctx, playerId),
    items: Object.keys(counters(ctx, playerId, 'item')).filter(authored),
    enemies: counters(ctx, playerId, 'enemy'),
    relics: Object.keys(counters(ctx, playerId, 'relic')).filter((id) => Object.hasOwn(RELIC, id)),
    wins_by,
    gave: counters(ctx, playerId, 'gave'),
    works: counters(ctx, playerId, 'works'),
    made: n('SELECT COUNT(*) AS n FROM player_recipes WHERE player_id = ?'),
    foundRelic: n('SELECT COUNT(*) AS n FROM relics WHERE finder = ?') > 0,
  };
}

const EARNED: Record<string, (f: Facts) => boolean> = {
  tenruns: (f) => f.runs >= 10,
  tenwins: (f) => f.wins >= 10,
  allhands: (f) => CHARACTERS.every((c) => (f.wins_by[c]?.length ?? 0) > 0),
  hazard3: (f) => Object.values(f.wins_by).some((h) => h.includes(3)),
  hazard5: (f) => Object.values(f.wins_by).some((h) => h.includes(5)),
  ladder: (f) => CHARACTERS.every((c) => (f.wins_by[c]?.length ?? 0) === MAX_HAZARD + 1),
  pairs100: (f) => f.pairs >= 100,
  firstpairs100: (f) => f.pairs >= 100,
  pairsall: (f) => f.pairs >= AUTHORED_PAIRS,
  finder25: (f) => f.finds >= 25,
  catalogue: (f) => f.items.length >= BASE_ITEMS.length,
  bestiary: (f) => ENEMY_IDS.every((id) => (f.enemies[id] ?? 0) > 0),
  giver: (f) => f.given >= 1000,
  relic: (f) => f.foundRelic,
  daily30: (f) => f.days >= 30,
};

/**
 * Give out any title the player has now earned. Returns the new ones. Must
 * run inside the transaction that changed the facts. A world-first title goes
 * to whoever gets here first and to nobody after.
 */
export function awardTitles(ctx: Ctx, playerId: number): string[] {
  const f = facts(ctx, playerId);
  const have = new Set((ctx.db.prepare('SELECT title FROM titles WHERE player_id = ?').all(playerId) as { title: string }[]).map((t) => t.title));
  const out: string[] = [];
  for (const t of TITLES) {
    if (have.has(t.id) || !EARNED[t.id]?.(f)) continue;
    if (t.worldFirst) {
      const taken = ctx.db.prepare('INSERT OR IGNORE INTO world_firsts (title, player_id, ts) VALUES (?, ?, ?)').run(t.id, playerId, ctx.now());
      if (taken.changes !== 1) continue;
    }
    ctx.db.prepare('INSERT INTO titles (player_id, title, ts) VALUES (?, ?, ?)').run(playerId, t.id, ctx.now());
    out.push(t.id);
  }
  // The first title earned is worn until the player chooses another.
  if (out.length && !playerById(ctx, playerId).title) ctx.db.prepare('UPDATE players SET title = ? WHERE id = ?').run(out[0], playerId);
  return out;
}

export function almanac(ctx: Ctx, player: Player): AlmanacRes {
  const f = facts(ctx, player.id);
  const cells = Object.values(f.wins_by).reduce((n, h) => n + h.length, 0);
  const lines: AlmanacLine[] = [
    { id: 'pairs', label: 'Authored pairs fused', have: f.pairs, of: AUTHORED_PAIRS },
    { id: 'items', label: 'Authored items carried home', have: f.items.length, of: BASE_ITEMS.length },
    { id: 'enemies', label: 'Kinds of enemy killed', have: ENEMY_IDS.filter((id) => (f.enemies[id] ?? 0) > 0).length, of: ENEMY_IDS.length },
    { id: 'hands', label: 'Characters won with', have: CHARACTERS.filter((c) => (f.wins_by[c]?.length ?? 0) > 0).length, of: CHARACTERS.length },
    { id: 'hazard', label: 'Hazard levels cleared, all characters', have: cells, of: CHARACTERS.length * (MAX_HAZARD + 1) },
    { id: 'relics', label: 'Relics held', have: f.relics.length, of: RELICS.length },
    { id: 'stations', label: 'Stations given to', have: STATIONS.filter((s) => (f.gave[s] ?? 0) > 0).length, of: STATIONS.length },
    { id: 'works', label: 'Town works given to', have: WORKS.filter((w) => (f.works[w.id] ?? 0) > 0).length, of: WORKS.length },
    { id: 'made', label: 'Recipes made, any pair', have: f.made, of: 0 },
    { id: 'finds', label: 'Finds that count', have: f.finds, of: 0 },
  ];
  const ends = lines.filter((l) => l.of > 0);
  const p = playerById(ctx, player.id);
  const earned = new Map((ctx.db.prepare('SELECT title, ts FROM titles WHERE player_id = ?').all(player.id) as { title: string; ts: number }[]).map((t) => [t.title, t.ts]));
  return {
    lines,
    have: ends.reduce((n, l) => n + l.have, 0),
    of: ends.reduce((n, l) => n + l.of, 0),
    items: f.items,
    enemies: f.enemies,
    wins: f.wins_by,
    relics: f.relics,
    titles: TITLES.map((t) => ({ id: t.id, name: t.name, how: t.how, earned: earned.get(t.id) ?? null, worn: p.title === t.id })),
    world: { authoredPairs: AUTHORED_PAIRS, found: worldAuthoredPairs(ctx) },
  };
}

/** Wear an earned title, or none. */
export function wearTitle(ctx: Ctx, player: Player, title: string): TitleRes {
  return tx(ctx.db, () => {
    if (title !== '') {
      if (!Object.hasOwn(TITLE, title)) throw bad('unknown_title', 'No such title.');
      if (!ctx.db.prepare('SELECT 1 FROM titles WHERE player_id = ? AND title = ?').get(player.id, title)) {
        throw bad('not_earned', 'That title has not been earned.');
      }
    }
    ctx.db.prepare('UPDATE players SET title = ? WHERE id = ?').run(title, player.id);
    return { profile: profile(ctx, player.id) };
  });
}
