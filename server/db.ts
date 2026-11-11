import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { BASE_ITEM } from '../src/shared/content/items.ts';
import { itemPoints, tierOf } from '../src/shared/item.ts';
import { RAWS } from '../src/shared/vocab.ts';
import { FACTOR_BASE, STATIONS } from './config.ts';

export type DB = Database.Database;

// Append only. The index of a migration is its version; never edit one that has shipped.
export const MIGRATIONS: (string | ((db: DB) => void))[] = [
  `
  CREATE TABLE players (
    id INTEGER PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    marks INTEGER NOT NULL DEFAULT 0 CHECK (marks >= 0),
    timber INTEGER NOT NULL DEFAULT 0 CHECK (timber >= 0),
    ore INTEGER NOT NULL DEFAULT 0 CHECK (ore >= 0),
    hide INTEGER NOT NULL DEFAULT 0 CHECK (hide >= 0),
    runs INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    standing INTEGER NOT NULL DEFAULT 0,
    created INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  );
  CREATE INDEX players_seen ON players (last_seen);

  CREATE TABLE stash (
    uid TEXT PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players (id),
    item_id TEXT NOT NULL,
    charges INTEGER NOT NULL CHECK (charges > 0),
    created INTEGER NOT NULL
  );
  CREATE INDEX stash_player ON stash (player_id);

  -- Fused items. Effects are stored as levels; numbers come from the price table.
  CREATE TABLE items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    glyph TEXT NOT NULL,
    tags TEXT NOT NULL,
    effects TEXT NOT NULL,
    finder INTEGER NOT NULL REFERENCES players (id),
    created INTEGER NOT NULL
  );

  CREATE TABLE recipes (
    key TEXT PRIMARY KEY,
    a TEXT NOT NULL,
    b TEXT NOT NULL,
    out TEXT NOT NULL REFERENCES items (id),
    finder INTEGER NOT NULL REFERENCES players (id),
    model TEXT NOT NULL,
    raw TEXT NOT NULL,
    created INTEGER NOT NULL
  );
  CREATE INDEX recipes_created ON recipes (created);

  CREATE TABLE player_recipes (
    player_id INTEGER NOT NULL REFERENCES players (id),
    key TEXT NOT NULL,
    PRIMARY KEY (player_id, key)
  ) WITHOUT ROWID;

  CREATE TABLE novel (
    player_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    used INTEGER NOT NULL,
    PRIMARY KEY (player_id, day)
  ) WITHOUT ROWID;

  CREATE TABLE runs (
    id TEXT PRIMARY KEY,
    player_id INTEGER NOT NULL REFERENCES players (id),
    mode TEXT NOT NULL,
    character TEXT NOT NULL,
    seed INTEGER NOT NULL,
    waves INTEGER NOT NULL,
    kit TEXT NOT NULL,
    day TEXT NOT NULL,
    scored INTEGER NOT NULL,
    status TEXT NOT NULL,
    started INTEGER NOT NULL,
    ended INTEGER
  );
  CREATE INDEX runs_player ON runs (player_id, mode, day);

  CREATE TABLE daily_results (
    day TEXT NOT NULL,
    player_id INTEGER NOT NULL REFERENCES players (id),
    waves INTEGER NOT NULL,
    scrip INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    PRIMARY KEY (day, player_id)
  ) WITHOUT ROWID;

  CREATE TABLE factor (
    raw TEXT PRIMARY KEY,
    ref REAL NOT NULL,
    day TEXT NOT NULL,
    bought INTEGER NOT NULL DEFAULT 0,
    sold INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE listings (
    id TEXT PRIMARY KEY,
    seller INTEGER NOT NULL REFERENCES players (id),
    item_id TEXT NOT NULL,
    charges INTEGER NOT NULL,
    price INTEGER NOT NULL CHECK (price > 0),
    status TEXT NOT NULL,
    buyer INTEGER,
    created INTEGER NOT NULL
  );
  CREATE INDEX listings_open ON listings (status, created);

  CREATE TABLE idem (
    player_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    body TEXT NOT NULL,
    response TEXT NOT NULL,
    created INTEGER NOT NULL,
    PRIMARY KEY (player_id, key)
  ) WITHOUT ROWID;

  CREATE TABLE stations (id TEXT PRIMARY KEY, tier INTEGER NOT NULL);

  CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station TEXT NOT NULL,
    to_tier INTEGER NOT NULL,
    need_timber INTEGER NOT NULL, need_ore INTEGER NOT NULL, need_hide INTEGER NOT NULL,
    have_timber INTEGER NOT NULL DEFAULT 0, have_ore INTEGER NOT NULL DEFAULT 0, have_hide INTEGER NOT NULL DEFAULT 0,
    done INTEGER NOT NULL DEFAULT 0,
    created INTEGER NOT NULL
  );

  -- Every faucet and sink of marks and raws. player_id is NULL for rows that
  -- touch no balance (for example tax passed on to the town).
  CREATE TABLE ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    player_id INTEGER,
    kind TEXT NOT NULL,
    marks INTEGER NOT NULL DEFAULT 0,
    timber INTEGER NOT NULL DEFAULT 0,
    ore INTEGER NOT NULL DEFAULT 0,
    hide INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX ledger_player ON ledger (player_id);
  `,
  // 1: relics. Every relic that exists is a row here, numbered within its kind
  // in the order found. A stash row or a listing that holds one points at it.
  `
  CREATE TABLE relics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    relic TEXT NOT NULL,
    serial INTEGER NOT NULL CHECK (serial > 0),
    finder INTEGER NOT NULL REFERENCES players (id),
    run_id TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    found INTEGER NOT NULL,
    UNIQUE (relic, serial)
  );
  CREATE INDEX relics_found ON relics (found);

  ALTER TABLE stash ADD COLUMN relic_ref INTEGER REFERENCES relics (id);
  CREATE UNIQUE INDEX stash_relic ON stash (relic_ref) WHERE relic_ref IS NOT NULL;
  ALTER TABLE listings ADD COLUMN relic_ref INTEGER REFERENCES relics (id);

  -- 1 if the report of this run was put to the relic roll.
  ALTER TABLE runs ADD COLUMN relic_roll INTEGER NOT NULL DEFAULT 0;
  -- What was packed, by stash uid: [{ uid, id, spent }]. spent: its last charge went on this run.
  ALTER TABLE runs ADD COLUMN kit_uids TEXT NOT NULL DEFAULT '[]';
  CREATE INDEX runs_roll ON runs (player_id, relic_roll, ended);
  `,
  // 2: the trust and depth pass. Paid runs, hazard records, the almanac, per-player
  // Factor limits, raw lots, buy orders, works, sinks. Works on a database that has been played on.
  `
  ALTER TABLE players ADD COLUMN name_changed INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE players ADD COLUMN stash_bought INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE players ADD COLUMN title TEXT NOT NULL DEFAULT '';

  -- paid: the report was paid out. verified: 0 not checked, 1 the replay matched, -1 it did not.
  ALTER TABLE runs ADD COLUMN hazard INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE runs ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE runs ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE runs ADD COLUMN ip TEXT NOT NULL DEFAULT '';
  ALTER TABLE runs ADD COLUMN waves_cleared INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE runs ADD COLUMN won INTEGER NOT NULL DEFAULT 0;
  -- Station tiers the ticket was written with, so the run can be played again exactly.
  ALTER TABLE runs ADD COLUMN stations TEXT NOT NULL DEFAULT '{}';
  UPDATE runs SET paid = 1 WHERE status = 'ended' AND (mode = 'run' OR scored = 1);
  CREATE INDEX runs_paid ON runs (paid, ended);
  CREATE INDEX runs_ip ON runs (ip, paid, ended);

  ALTER TABLE daily_results ADD COLUMN verified INTEGER NOT NULL DEFAULT 1;

  ALTER TABLE stash ADD COLUMN repairs INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE recipes ADD COLUMN counted INTEGER NOT NULL DEFAULT 0;

  -- A raw lot has raw and qty set and no item.
  ALTER TABLE listings ADD COLUMN raw TEXT;
  ALTER TABLE listings ADD COLUMN qty INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE listings ADD COLUMN repairs INTEGER NOT NULL DEFAULT 0;

  -- kind 'station' raises a station; kind 'works' is a repeating town works named in station.
  ALTER TABLE projects ADD COLUMN kind TEXT NOT NULL DEFAULT 'station';

  -- Fusions the server answered for a run, in order. Carried items are checked against these.
  CREATE TABLE run_fusions (
    run_id TEXT NOT NULL REFERENCES runs (id),
    seq INTEGER NOT NULL,
    a TEXT NOT NULL,
    b TEXT NOT NULL,
    out TEXT NOT NULL,
    PRIMARY KEY (run_id, seq)
  ) WITHOUT ROWID;

  -- The input log of a run, kept until it has been checked. Flagged ones stay.
  CREATE TABLE replays (
    run_id TEXT PRIMARY KEY REFERENCES runs (id),
    data TEXT NOT NULL,
    created INTEGER NOT NULL
  );

  CREATE TABLE records (
    player_id INTEGER NOT NULL REFERENCES players (id),
    character TEXT NOT NULL,
    hazard INTEGER NOT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    best_seconds INTEGER NOT NULL DEFAULT 0,
    first INTEGER NOT NULL,
    PRIMARY KEY (player_id, character, hazard)
  ) WITHOUT ROWID;

  -- The almanac: one counter per (kind, key). Kinds: item, enemy, relic, gave, works.
  CREATE TABLE almanac (
    player_id INTEGER NOT NULL REFERENCES players (id),
    kind TEXT NOT NULL,
    key TEXT NOT NULL,
    n INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, kind, key)
  ) WITHOUT ROWID;

  CREATE TABLE titles (
    player_id INTEGER NOT NULL REFERENCES players (id),
    title TEXT NOT NULL,
    ts INTEGER NOT NULL,
    PRIMARY KEY (player_id, title)
  ) WITHOUT ROWID;
  -- Titles only one player in the world can hold.
  CREATE TABLE world_firsts (title TEXT PRIMARY KEY, player_id INTEGER NOT NULL REFERENCES players (id), ts INTEGER NOT NULL);

  CREATE TABLE factor_day (
    player_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    raw TEXT NOT NULL,
    bought INTEGER NOT NULL DEFAULT 0,
    sold INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, day, raw)
  ) WITHOUT ROWID;

  -- Marks a new account has paid to and taken from other players, per day.
  CREATE TABLE transfers (
    player_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    paid INTEGER NOT NULL DEFAULT 0,
    taken INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, day)
  ) WITHOUT ROWID;

  -- Buy orders. The buyer's marks for the unfilled part are held: they left the
  -- balance when the order was placed (ledger kind order_hold).
  CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    buyer INTEGER NOT NULL REFERENCES players (id),
    raw TEXT,
    item_id TEXT,
    qty INTEGER NOT NULL CHECK (qty > 0),
    filled INTEGER NOT NULL DEFAULT 0,
    price INTEGER NOT NULL CHECK (price > 0),
    status TEXT NOT NULL,
    created INTEGER NOT NULL
  );
  CREATE INDEX orders_open ON orders (status, created);

  CREATE TABLE perks (id TEXT PRIMARY KEY, until INTEGER NOT NULL);
  -- Units of raws a player has paid the Factor to deliver to the project, per day.
  CREATE TABLE town_fund (player_id INTEGER NOT NULL, day TEXT NOT NULL, units INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (player_id, day)) WITHOUT ROWID;
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  -- Idempotency rows now hold a hash of the request and no response.
  DELETE FROM idem;
  `,
  // 3: which finds count. An authored pair counts; any other pair counts only
  // if it was the first to make a finished (tier 4) item.
  (db) => {
    const rows = db.prepare('SELECT r.key, r.a, r.b, r.out, r.finder, i.finder AS item_finder, i.effects, r.created, i.created AS item_created FROM recipes r JOIN items i ON i.id = r.out').all() as
      { key: string; a: string; b: string; out: string; finder: number; item_finder: number; effects: string; created: number; item_created: number }[];
    const set = db.prepare('UPDATE recipes SET counted = 1 WHERE key = ?');
    for (const r of rows) {
      const authored = Object.hasOwn(BASE_ITEM, r.a) && Object.hasOwn(BASE_ITEM, r.b);
      const firstFinished = r.finder === r.item_finder && r.created === r.item_created && tierOf(itemPoints(JSON.parse(r.effects))) === 4;
      if (authored || firstFinished) set.run(r.key);
    }
  },
];

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return setupDb(db);
}

/** Bring an open database up to date and seed it. For engines other than the one openDb uses (the solo world in a browser). */
export function setupDb(db: DB): DB {
  db.pragma('foreign_keys = ON');
  migrate(db);
  seed(db);
  return db;
}

function migrate(db: DB) {
  const have = db.pragma('user_version', { simple: true }) as number;
  for (let v = have; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      const m = MIGRATIONS[v];
      if (typeof m === 'string') db.exec(m);
      else m(db);
      db.pragma(`user_version = ${v + 1}`);
    }).immediate();
  }
}

/** Rows the world needs before anyone has played: the Factor's book and the stations. */
function seed(db: DB) {
  db.transaction(() => {
    const factor = db.prepare(`INSERT OR IGNORE INTO factor (raw, ref, day) VALUES (?, ?, '')`);
    for (const raw of RAWS) factor.run(raw, FACTOR_BASE[raw]);
    const station = db.prepare(`INSERT OR IGNORE INTO stations (id, tier) VALUES (?, 1)`);
    for (const s of STATIONS) station.run(s);
  }).immediate();
}

/** Run fn as one BEGIN IMMEDIATE transaction. A throw rolls everything back. */
export function tx<T>(db: DB, fn: () => T): T {
  return db.transaction(fn).immediate();
}
