// The solo world: the game server itself, running in this tab against a
// SQLite database kept on the device (IndexedDB). Every town rule is the
// server's own code, so solo and the shared town cannot drift apart.
//
// What differs from a real server:
//   - one player, so the market between players and the boards are empty;
//   - untried pairs are decided by the built-in generator, never a model;
//   - runs are held to the caps but not played again (there is nobody to cheat);
//   - no rate limits.
// This module is loaded only when the solo world is in use.

import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { createApp } from '../../../server/app.ts';
import { setupDb } from '../../../server/db.ts';
import { ProceduralProvider } from '../../../server/provider.ts';
import { inlineVerify } from '../../../server/verify.ts';
import { wrapSqlJs } from './sqlite.ts';

const IDB_NAME = 'scrip-solo';
const STORE = 'world';
const KEY = 'db';
const SAVE_AFTER_MS = 250;

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(IDB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}
const done = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export class SoloBusy extends Error {
  override name = 'SoloBusy';
}

export interface SoloWorld {
  request(path: string, init: RequestInit): Promise<Response>;
  /** Write the world to the device now. */
  flush(): Promise<void>;
  /** The whole save as bytes, for a backup file. */
  backup(): Uint8Array;
}

async function open(): Promise<SoloWorld> {
  // One tab at a time: two tabs would each save their own copy over the other's.
  if (navigator.locks) {
    const got = await new Promise<boolean>((resolve) => {
      void navigator.locks.request('scrip-solo', { ifAvailable: true }, (lock) => {
        resolve(!!lock);
        // Held for the life of the tab.
        return lock ? new Promise<void>(() => {}) : undefined;
      });
    });
    if (!got) throw new SoloBusy('Scrip is already open in another tab on this device.');
  }
  const [SQL, store] = await Promise.all([initSqlJs({ locateFile: () => wasmUrl }), idb()]);
  const saved = (await done(store.transaction(STORE).objectStore(STORE).get(KEY))) as Uint8Array | undefined;
  const local = wrapSqlJs(saved ? new SQL.Database(saved) : new SQL.Database());
  setupDb(local.db);

  let dirty = !saved;
  let timer = 0;
  let writing: Promise<void> = Promise.resolve();
  const flush = (): Promise<void> => {
    clearTimeout(timer);
    if (!dirty) return writing;
    dirty = false;
    const bytes = local.bytes();
    writing = writing
      .then(() => done(store.transaction(STORE, 'readwrite').objectStore(STORE).put(bytes, KEY)))
      .then(() => undefined, (err) => {
        dirty = true;
        console.warn('[solo] save failed', err);
      });
    return writing;
  };
  local.onWrite(() => {
    dirty = true;
    clearTimeout(timer);
    timer = window.setTimeout(() => void flush(), SAVE_AFTER_MS);
  });
  // A phone may kill the tab without warning once it is in the background.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  window.addEventListener('pagehide', () => void flush());
  // Ask the browser not to clear the save when the device runs short of space.
  void navigator.storage?.persist?.().catch(() => {});

  // The stand-in run (?stubrun=1, a development page) ends at once, and a run that short is refused.
  // For that page only, the world's clock jumps ten minutes before each report.
  const stub = new URLSearchParams(location.search).has('stubrun');
  let skew = 0;
  const app = createApp({ db: local.db, provider: new ProceduralProvider(), rateLimit: false, runRate: false, replay: 'off', verify: inlineVerify, now: () => Date.now() + skew });
  void flush();
  return {
    request: async (path, init) => {
      if (stub && path === '/api/run/end') skew += 10 * 60 * 1000;
      return app.request(path, init);
    },
    flush,
    backup: () => local.bytes(),
  };
}

let world: Promise<SoloWorld> | null = null;
export function soloWorld(): Promise<SoloWorld> {
  world ??= open().catch((err) => {
    world = null;
    throw err;
  });
  return world;
}
