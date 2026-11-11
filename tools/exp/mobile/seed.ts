// Fill every account in the scratch test database with goods, so the town screens have full rows to measure.
// Writes straight to SQLite and skips the ledger: only ever point it at a throwaway DB.
//   DB_PATH=/path/to/mobile.db npx tsx tools/exp/mobile/seed.ts
import Database from 'better-sqlite3';
import { BASE_ITEMS } from '../../../src/shared/content/items.ts';

const db = new Database(process.env.DB_PATH!);
const now = Date.now();
db.prepare('UPDATE players SET marks = 1240, timber = 163, ore = 87, hide = 45, runs = MAX(runs, 9), wins = 2').run();
const players = db.prepare('SELECT id FROM players').all() as { id: number }[];
const ins = db.prepare('INSERT OR IGNORE INTO stash (uid, player_id, item_id, charges, created) VALUES (?, ?, ?, ?, ?)');
for (const p of players) BASE_ITEMS.slice(0, 7).forEach((it, i) => ins.run(`seed-${p.id}-${i}`, p.id, it.id, 1 + (i % 3), now));
// A second trader with open listings, so the market has other people's rows.
if (!db.prepare("SELECT 1 FROM players WHERE token_hash = 'seed-trader'").get()) {
  const r = db.prepare("INSERT INTO players (token_hash, name, marks, created, last_seen) VALUES ('seed-trader', 'Millpond Marrowby 417', 50, ?, ?)").run(now, now);
  const li = db.prepare("INSERT INTO listings (id, seller, item_id, charges, price, status, created) VALUES (?, ?, ?, ?, ?, 'open', ?)");
  BASE_ITEMS.slice(7, 12).forEach((it, i) => li.run(`seed-l${i}`, r.lastInsertRowid, it.id, 2, 40 + i * 135, now));
}
console.log(`seeded ${players.length} accounts`);
