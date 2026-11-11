// The server's database interface over SQLite compiled to WebAssembly
// (sql.js), so the same server code runs in a browser tab.
// Only the part of better-sqlite3 the server uses is here: prepare with
// get / all / run / pluck, exec, pragma, transaction, close.

import type { Database as SqlJsDb, SqlValue, Statement } from 'sql.js';
import type { DB } from '../../../server/db.ts';

type Params = unknown[];

const bindable = (p: Params): SqlValue[] =>
  p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'bigint' ? Number(v) : (v as SqlValue)));

export interface LocalDb {
  db: DB;
  /** The whole database as bytes, for saving. */
  bytes(): Uint8Array;
  /** Calls fn after any statement that wrote. */
  onWrite(fn: () => void): void;
}

export function wrapSqlJs(raw: SqlJsDb): LocalDb {
  // sql.js statements are compiled once per SQL text and reused: the server prepares the same few hundred strings over and over.
  const cache = new Map<string, Statement>();
  const stmt = (sql: string): Statement => {
    let s = cache.get(sql);
    if (!s) {
      s = raw.prepare(sql);
      cache.set(sql, s);
    }
    return s;
  };
  const dropCache = (): void => {
    for (const s of cache.values()) s.free();
    cache.clear();
  };
  let wrote: (() => void) | null = null;
  let depth = 0;
  const touched = (): void => {
    if (depth === 0) wrote?.();
  };

  const prepare = (sql: string, pluck = false) => ({
    get(...p: Params): unknown {
      const s = stmt(sql);
      try {
        s.bind(bindable(p));
        if (!s.step()) return undefined;
        return pluck ? s.get()[0] : s.getAsObject();
      } finally {
        s.reset();
      }
    },
    all(...p: Params): unknown[] {
      const s = stmt(sql);
      const out: unknown[] = [];
      try {
        s.bind(bindable(p));
        while (s.step()) out.push(pluck ? s.get()[0] : s.getAsObject());
      } finally {
        s.reset();
      }
      return out;
    },
    run(...p: Params): { changes: number; lastInsertRowid: number } {
      const s = stmt(sql);
      try {
        s.bind(bindable(p));
        while (s.step()) {
          // drain: a write with RETURNING yields rows
        }
      } finally {
        s.reset();
      }
      const changes = raw.getRowsModified();
      const id = raw.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0];
      touched();
      return { changes, lastInsertRowid: Number(id ?? 0) };
    },
    pluck() {
      return prepare(sql, true);
    },
  });

  const begin = (mode: string): string => {
    if (depth === 0) {
      raw.run(`BEGIN ${mode}`);
      depth = 1;
      return '';
    }
    const name = `sp${depth++}`;
    raw.run(`SAVEPOINT ${name}`);
    return name;
  };
  const end = (name: string, ok: boolean): void => {
    depth--;
    if (name) raw.run(ok ? `RELEASE ${name}` : `ROLLBACK TO ${name}; RELEASE ${name}`);
    else raw.run(ok ? 'COMMIT' : 'ROLLBACK');
    if (ok) touched();
  };
  const transaction = <A extends unknown[], T>(fn: (...a: A) => T) => {
    const runner = (mode: string) => (...a: A): T => {
      const name = begin(mode);
      let out: T;
      try {
        out = fn(...a);
      } catch (e) {
        end(name, false);
        throw e;
      }
      end(name, true);
      return out;
    };
    return Object.assign(runner('DEFERRED'), { immediate: runner('IMMEDIATE'), deferred: runner('DEFERRED'), exclusive: runner('EXCLUSIVE') });
  };

  const db = {
    prepare: (sql: string) => prepare(sql),
    exec(sql: string) {
      // Schema changes make compiled statements stale.
      dropCache();
      raw.exec(sql);
      touched();
      return db;
    },
    pragma(text: string, opts?: { simple?: boolean }): unknown {
      const res = raw.exec(`PRAGMA ${text}`);
      if (opts?.simple) return res[0]?.values[0]?.[0];
      return res[0]?.values.map((row) => Object.fromEntries(row.map((v, i) => [res[0]!.columns[i], v]))) ?? [];
    },
    transaction,
    close() {
      dropCache();
      raw.close();
    },
  };

  return {
    db: db as unknown as DB,
    bytes() {
      // Exporting closes and reopens the file inside sql.js: compiled statements and per-connection settings go with it.
      dropCache();
      const out = raw.export();
      raw.run('PRAGMA foreign_keys = ON');
      return out;
    },
    onWrite(fn) {
      wrote = fn;
    },
  };
}
