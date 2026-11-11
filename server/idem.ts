// Idempotency for mutations a client may retry: one key, one effect.
//
// A row is the key and a hash of the request, nothing more. A repeat of the
// same request answers with the current state instead of a stored copy of the
// first answer, so a row is about 120 bytes whatever the response was.

import { createHash } from 'node:crypto';
import { ApiErr } from './errors.ts';
import type { Ctx } from './players.ts';

/** Rows only need to outlive client retries. */
export const IDEM_TTL_MS = 24 * 3600 * 1000;
export const IDEM_PURGE_EVERY_MS = 3600 * 1000;

/**
 * Run fn once for this key. A repeat with the same request runs `again`
 * (which must only read) and changes nothing; a repeat with a different
 * request is refused. Must be called inside the mutation's transaction.
 */
export function once<T>(ctx: Ctx, playerId: number, key: string, body: unknown, fn: () => T, again: () => T): T {
  const hash = createHash('sha256').update(JSON.stringify(body)).digest('base64url');
  const hit = ctx.db.prepare('SELECT body FROM idem WHERE player_id = ? AND key = ?').get(playerId, key) as { body: string } | undefined;
  if (hit) {
    if (hit.body !== hash) throw new ApiErr(409, 'idem_reuse', 'That request key was already used for a different request.');
    return again();
  }
  const res = fn();
  ctx.db.prepare(`INSERT INTO idem (player_id, key, body, response, created) VALUES (?, ?, ?, '', ?)`).run(playerId, key, hash, ctx.now());
  return res;
}

/** Drop rows past their time. Returns how many went. */
export function purgeIdem(ctx: Ctx): number {
  return ctx.db.prepare('DELETE FROM idem WHERE created < ?').run(ctx.now() - IDEM_TTL_MS).changes;
}
