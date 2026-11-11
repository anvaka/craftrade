import { itemPoints } from '../src/shared/item.ts';
import {
  KIT_CHARGES, LISTING_FEE, SALE_TAX,
  type BuyReq, type CancelReq, type FactorQuote, type FactorReq, type ListReq, type Listing,
  type MarketActionRes, type MarketRes, type SalvageReq,
} from '../src/shared/protocol.ts';
import { RAWS, type RawId } from '../src/shared/vocab.ts';
import { FACTOR, FACTOR_BASE, LISTING, LISTING_MIN_RUNS, TAX_TO_TOWN } from './config.ts';
import { tx } from './db.ts';
import { ApiErr, bad } from './errors.ts';
import { activePlayers, addStash, dayOf, getItem, move, newId, playerById, profile, stashRow, type Ctx, type Player } from './players.ts';
import { taxToTown } from './town.ts';

interface FactorRow { raw: RawId; ref: number; day: string; bought: number; sold: number }

/**
 * Return a stored response for a repeated idempotency key, or run fn and
 * store its response. Must be called inside the mutation's transaction.
 */
function once<T>(ctx: Ctx, playerId: number, key: string, body: unknown, fn: () => T): T {
  const text = JSON.stringify(body);
  const hit = ctx.db.prepare('SELECT body, response FROM idem WHERE player_id = ? AND key = ?').get(playerId, key) as
    | { body: string; response: string }
    | undefined;
  if (hit) {
    if (hit.body !== text) throw new ApiErr(409, 'idem_reuse', 'That request key was already used for a different request.');
    return JSON.parse(hit.response) as T;
  }
  const res = fn();
  ctx.db.prepare('INSERT INTO idem (player_id, key, body, response, created) VALUES (?, ?, ?, ?, ?)').run(playerId, key, text, JSON.stringify(res), ctx.now());
  return res;
}

function requireOpen(ctx: Ctx) {
  if (!ctx.marketOpen) throw new ApiErr(503, 'market_closed', 'Trading is closed for now. Stashes are safe.');
}

/** Start a new trading day for the Factor: volumes reset and the reference eases back toward its base. */
function factorRows(ctx: Ctx): FactorRow[] {
  const today = dayOf(ctx.now());
  const rows = ctx.db.prepare('SELECT * FROM factor').all() as FactorRow[];
  for (const r of rows) {
    if (r.day === today) continue;
    if (r.day) r.ref += (FACTOR_BASE[r.raw] - r.ref) * FACTOR.revert;
    r.day = today;
    r.bought = r.sold = 0;
    ctx.db.prepare('UPDATE factor SET ref = ?, day = ?, bought = 0, sold = 0 WHERE raw = ?').run(r.ref, today, r.raw);
  }
  return rows;
}

const dailyCap = (ctx: Ctx) => FACTOR.dailyBase * Math.max(1, activePlayers(ctx));

/** `buy` is what a player pays the Factor per unit, `sell` what a player is paid. */
function quote(r: FactorRow, cap: number): FactorQuote {
  return {
    buy: Math.max(2, Math.ceil(r.ref * FACTOR.buyMul)),
    sell: Math.max(1, Math.floor(r.ref * FACTOR.sellMul)),
    buyLeft: Math.max(0, cap - r.bought),
    sellLeft: Math.max(0, cap - r.sold),
  };
}

export function marketView(ctx: Ctx, player: Player): MarketRes {
  return tx(ctx.db, () => {
    const cap = dailyCap(ctx);
    const rows = factorRows(ctx);
    const factor = Object.fromEntries(RAWS.map((raw) => [raw, quote(rows.find((r) => r.raw === raw)!, cap)])) as Record<RawId, FactorQuote>;
    const open = ctx.db
      .prepare(`SELECT l.id, l.item_id, l.charges, l.price, l.seller, p.name FROM listings l JOIN players p ON p.id = l.seller WHERE l.status = 'open' ORDER BY l.created DESC, l.id LIMIT 200`)
      .all() as { id: string; item_id: string; charges: number; price: number; seller: number; name: string }[];
    const listings: Listing[] = [];
    for (const l of open) {
      const item = getItem(ctx, l.item_id);
      if (item) listings.push({ id: l.id, item, charges: l.charges, price: l.price, seller: l.name, mine: l.seller === player.id });
    }
    return { open: ctx.marketOpen, factor, listings };
  });
}

const done = (ctx: Ctx, player: Player): MarketActionRes => ({ profile: profile(ctx, player.id), market: marketView(ctx, player) });

export function factorTrade(ctx: Ctx, player: Player, req: FactorReq): MarketActionRes {
  requireOpen(ctx);
  return tx(ctx.db, () =>
    once(ctx, player.id, req.idem, req, () => {
      const row = factorRows(ctx).find((r) => r.raw === req.raw)!;
      const q = quote(row, dailyCap(ctx));
      const buying = req.side === 'buy';
      if (req.qty > (buying ? q.buyLeft : q.sellLeft)) {
        throw bad('factor_limit', `The Factor will not ${buying ? 'sell' : 'buy'} that much ${req.raw} today.`);
      }
      if (buying) move(ctx, player.id, 'factor_buy', { marks: -q.buy * req.qty, [req.raw]: req.qty }, req.raw);
      else move(ctx, player.id, 'factor_sell', { marks: q.sell * req.qty, [req.raw]: -req.qty }, req.raw);
      // The reference follows net volume, slowly, within fixed bounds.
      const base = FACTOR_BASE[req.raw];
      const ref = Math.min(base * FACTOR.clamp, Math.max(base / FACTOR.clamp, row.ref * Math.exp(FACTOR.drift * (buying ? req.qty : -req.qty))));
      ctx.db
        .prepare('UPDATE factor SET ref = ?, bought = bought + ?, sold = sold + ? WHERE raw = ?')
        .run(ref, buying ? req.qty : 0, buying ? 0 : req.qty, req.raw);
      return done(ctx, player);
    }),
  );
}

export function listItem(ctx: Ctx, player: Player, req: ListReq): MarketActionRes {
  requireOpen(ctx);
  return tx(ctx.db, () =>
    once(ctx, player.id, req.idem, req, () => {
      if (playerById(ctx, player.id).runs < LISTING_MIN_RUNS) {
        throw new ApiErr(403, 'listing_locked', `Listings open after ${LISTING_MIN_RUNS} runs. The Factor trades with anyone.`);
      }
      const row = stashRow(ctx, player.id, req.uid);
      if (!row) throw bad('not_owned', 'That item is not in your stash.');
      const open = ctx.db.prepare(`SELECT COUNT(*) AS n FROM listings WHERE seller = ? AND status = 'open'`).get(player.id) as { n: number };
      if (open.n >= LISTING.maxOpen) throw bad('listing_limit', `You can have ${LISTING.maxOpen} listings up at once.`);
      move(ctx, player.id, 'listing_fee', { marks: -Math.max(1, Math.ceil(req.price * LISTING_FEE)) }, row.item_id);
      ctx.db.prepare('DELETE FROM stash WHERE uid = ?').run(row.uid);
      ctx.db
        .prepare(`INSERT INTO listings (id, seller, item_id, charges, price, status, created) VALUES (?, ?, ?, ?, ?, 'open', ?)`)
        .run(newId(), player.id, row.item_id, row.charges, req.price, ctx.now());
      return done(ctx, player);
    }),
  );
}

interface ListingRow { id: string; seller: number; item_id: string; charges: number; price: number }
const openListing = (ctx: Ctx, id: string) =>
  ctx.db.prepare(`SELECT id, seller, item_id, charges, price FROM listings WHERE id = ? AND status = 'open'`).get(id) as ListingRow | undefined;

export function buyListing(ctx: Ctx, player: Player, req: BuyReq): MarketActionRes {
  requireOpen(ctx);
  return tx(ctx.db, () =>
    once(ctx, player.id, req.idem, req, () => {
      const l = openListing(ctx, req.listingId);
      if (!l) throw new ApiErr(409, 'listing_gone', 'That listing is no longer up.');
      if (l.seller === player.id) throw bad('own_listing', 'That is your own listing. Cancel it to take the item back.');
      const tax = Math.min(l.price, Math.max(1, Math.ceil(l.price * SALE_TAX)));
      move(ctx, player.id, 'market_buy', { marks: -l.price }, l.id);
      move(ctx, l.seller, 'market_sale', { marks: l.price }, l.id);
      move(ctx, l.seller, 'sale_tax', { marks: -tax }, l.id);
      ctx.db.prepare(`UPDATE listings SET status = 'sold', buyer = ? WHERE id = ?`).run(player.id, l.id);
      addStash(ctx, player.id, l.item_id, l.charges);
      taxToTown(ctx, Math.round(tax * TAX_TO_TOWN));
      return done(ctx, player);
    }),
  );
}

/** Taking a listing down is allowed even while trading is closed. The fee is not returned. */
export function cancelListing(ctx: Ctx, player: Player, req: CancelReq): MarketActionRes {
  return tx(ctx.db, () => {
    const l = openListing(ctx, req.listingId);
    if (!l || l.seller !== player.id) throw new ApiErr(409, 'listing_gone', 'That listing is no longer up.');
    ctx.db.prepare(`UPDATE listings SET status = 'cancelled' WHERE id = ?`).run(l.id);
    addStash(ctx, player.id, l.item_id, l.charges);
    return done(ctx, player);
  });
}

export function salvage(ctx: Ctx, player: Player, req: SalvageReq): MarketActionRes {
  return tx(ctx.db, () => {
    const row = stashRow(ctx, player.id, req.uid);
    const item = row && getItem(ctx, row.item_id);
    if (!row || !item) throw bad('not_owned', 'That item is not in your stash.');
    ctx.db.prepare('DELETE FROM stash WHERE uid = ?').run(row.uid);
    const marks = Math.max(1, Math.round((itemPoints(item.effects) * row.charges) / (KIT_CHARGES * 5)));
    move(ctx, player.id, 'salvage', { marks }, item.id);
    return done(ctx, player);
  });
}
