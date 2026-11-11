import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { RAWS } from '../src/shared/vocab.ts';
import { FACTOR_BASE, STATIONS } from './config.ts';

export type DB = Database.Database;

// Append only. The index of a migration is its version; never edit one that has shipped.
const MIGRATIONS: string[] = [
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
];

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  seed(db);
  return db;
}

function migrate(db: DB) {
  const have = db.pragma('user_version', { simple: true }) as number;
  for (let v = have; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
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
