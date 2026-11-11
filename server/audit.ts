// Sum the ledger and check it against current balances.
//   tsx server/audit.ts [db path]
// Exits 1 on any mismatch.

import { pathToFileURL } from 'node:url';
import { RAWS } from '../src/shared/vocab.ts';
import { openDb, type DB } from './db.ts';

const COLS = ['marks', ...RAWS] as const;

export interface AuditResult {
  ok: boolean;
  players: number;
  rows: number;
  mismatches: string[];
  /** Net movement by ledger kind: positive is a faucet, negative a sink. */
  byKind: Record<string, Record<(typeof COLS)[number], number>>;
}

export function audit(db: DB): AuditResult {
  const sums = COLS.map((c) => `COALESCE(SUM(l.${c}), 0) AS l_${c}`).join(', ');
  const rows = db
    .prepare(`SELECT p.id, p.name, ${COLS.map((c) => `p.${c}`).join(', ')}, ${sums} FROM players p LEFT JOIN ledger l ON l.player_id = p.id GROUP BY p.id`)
    .all() as Record<string, number | string>[];
  const mismatches: string[] = [];
  for (const r of rows) {
    for (const c of COLS) {
      if (r[c] !== r[`l_${c}`]) mismatches.push(`player ${r.id} (${r.name}): ${c} is ${r[c]}, ledger says ${r[`l_${c}`]}`);
      if ((r[c] as number) < 0) mismatches.push(`player ${r.id} (${r.name}): ${c} is negative`);
    }
  }
  const orphans = db.prepare('SELECT COUNT(*) AS n FROM ledger l WHERE l.player_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM players p WHERE p.id = l.player_id)').get() as { n: number };
  if (orphans.n) mismatches.push(`${orphans.n} ledger rows name a player that does not exist`);

  // Marks set aside for buy orders: what went in, less what came back or was paid to sellers, must be what open orders still hold.
  const sum = (sql: string) => (db.prepare(sql).get() as { n: number | null }).n ?? 0;
  const heldMarks = -sum(`SELECT SUM(marks) AS n FROM ledger WHERE kind IN ('order_hold', 'order_refund')`) - sum(`SELECT SUM(marks) AS n FROM ledger WHERE kind = 'order_sale'`);
  const openMarks = sum(`SELECT SUM((qty - filled) * price) AS n FROM orders WHERE status = 'open'`);
  if (heldMarks !== openMarks) mismatches.push(`orders: ${openMarks} marks are owed to open orders, the ledger holds ${heldMarks}`);
  // Raws posted as lots: what left stashes for the board, less what was bought or taken back, must be what open lots hold.
  for (const raw of RAWS) {
    const posted = -sum(`SELECT SUM(${raw}) AS n FROM ledger WHERE kind IN ('lot_post', 'lot_buy', 'lot_back')`);
    const open = sum(`SELECT SUM(qty) AS n FROM listings WHERE status = 'open' AND raw = '${raw}'`);
    if (posted !== open) mismatches.push(`lots: ${open} ${raw} is up in open lots, the ledger holds ${posted}`);
  }

  const byKind: AuditResult['byKind'] = {};
  const kinds = db.prepare(`SELECT kind, ${COLS.map((c) => `SUM(${c}) AS ${c}`).join(', ')} FROM ledger GROUP BY kind ORDER BY kind`).all() as ({ kind: string } & Record<(typeof COLS)[number], number>)[];
  for (const { kind, ...rest } of kinds) byKind[kind] = rest;
  const total = db.prepare('SELECT COUNT(*) AS n FROM ledger').get() as { n: number };
  return { ok: mismatches.length === 0, players: rows.length, rows: total.n, mismatches, byKind };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const db = openDb(process.argv[2] ?? process.env.DB_PATH ?? './data/craftrade.db');
  const res = audit(db);
  console.log(`${res.players} players, ${res.rows} ledger rows`);
  console.table(res.byKind);
  if (res.ok) {
    console.log('Ledger matches balances.');
  } else {
    for (const m of res.mismatches) console.error(m);
    console.error(`${res.mismatches.length} mismatches.`);
    process.exit(1);
  }
}
