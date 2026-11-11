import { isRelic, itemPoints } from '../src/shared/item.ts';
import {
  KIT_CHARGES, LISTING_FEE, SALE_TAX,
  type BuyReq, type CancelReq, type FactorQuote, type FactorReq, type FillReq, type ListReq, type Listing,
  type MarketActionRes, type MarketRes, type Order, type OrderCancelReq, type OrderReq, type RawLot, type SalvageReq,
} from '../src/shared/protocol.ts';
import { RAWS, type RawId } from '../src/shared/vocab.ts';
import { note } from './almanac.ts';
import { FACTOR, FACTOR_BASE, LISTING, LISTING_MIN_RUNS, MAX_LOT, NEW_ACCOUNT, PERK, RELIC_TRADE, TAX_TO_TOWN, priceCeiling } from './config.ts';
import { tx } from './db.ts';
import { ApiErr, bad } from './errors.ts';
import { once } from './idem.ts';
import { addStash, dayOf, getItem, heldItem, move, newId, perkOn, playerById, profile, stashRoom, stashRow, type Ctx, type Player } from './players.ts';
import { taxToTown } from './town.ts';

interface FactorRow { raw: RawId; ref: number; day: string; bought: number; sold: number }

function requireOpen(ctx: Ctx) {
  if (!ctx.marketOpen) throw new ApiErr(503, 'market_closed', 'Trading is closed for now. Stashes are safe.');
}

/** Trading with other players opens after a number of paid runs. The Factor trades with anyone. */
function requireSeasoned(ctx: Ctx, playerId: number) {
  if (playerById(ctx, playerId).runs < LISTING_MIN_RUNS) {
    throw new ApiErr(403, 'listing_locked', `Trading with other players opens after ${LISTING_MIN_RUNS} runs. The Factor trades with anyone.`);
  }
}

/** A relic has no price cap, so both sides must have played for real before one changes hands. */
function requireRelicHistory(ctx: Ctx, playerId: number, who: string) {
  const p = playerById(ctx, playerId);
  if (p.runs < RELIC_TRADE.runs || ctx.now() - p.created < RELIC_TRADE.ageMs) {
    throw new ApiErr(403, 'relic_history', `${who} can trade a relic after ${RELIC_TRADE.runs} runs and three days in town.`);
  }
}

/**
 * Marks moving between two players. A new account can pay out and take in
 * only so much a day, so marks cannot be passed along a chain of fresh accounts.
 */
function transfer(ctx: Ctx, payer: number, payee: number, marks: number) {
  const day = dayOf(ctx.now());
  const used = (id: number) => (ctx.db.prepare('SELECT paid, taken FROM transfers WHERE player_id = ? AND day = ?').get(id, day) as { paid: number; taken: number } | undefined) ?? { paid: 0, taken: 0 };
  const isNew = (id: number) => playerById(ctx, id).runs < NEW_ACCOUNT.runs;
  if (isNew(payer) && used(payer).paid + marks > NEW_ACCOUNT.marksPerDay) {
    throw bad('transfer_cap', `An account with fewer than ${NEW_ACCOUNT.runs} runs can pay other players ${NEW_ACCOUNT.marksPerDay} marks a day.`);
  }
  if (isNew(payee) && used(payee).taken + marks > NEW_ACCOUNT.marksPerDay) {
    throw bad('transfer_cap', `An account with fewer than ${NEW_ACCOUNT.runs} runs can take ${NEW_ACCOUNT.marksPerDay} marks a day from other players.`);
  }
  const add = ctx.db.prepare('INSERT INTO transfers (player_id, day, paid, taken) VALUES (?, ?, ?, ?) ON CONFLICT (player_id, day) DO UPDATE SET paid = paid + excluded.paid, taken = taken + excluded.taken');
  add.run(payer, day, marks, 0);
  add.run(payee, day, 0, marks);
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

/** What this player has traded with the Factor today. The limit is each player's own: nobody can use up another's. */
function factorUsed(ctx: Ctx, playerId: number, raw: RawId) {
  return (ctx.db.prepare('SELECT bought, sold FROM factor_day WHERE player_id = ? AND day = ? AND raw = ?').get(playerId, dayOf(ctx.now()), raw) as
    | { bought: number; sold: number }
    | undefined) ?? { bought: 0, sold: 0 };
}

/** `buy` is what a player pays the Factor per unit, `sell` what a player is paid. */
function quote(ctx: Ctx, r: FactorRow, playerId: number): FactorQuote {
  const used = factorUsed(ctx, playerId, r.raw);
  const buy = Math.max(2, Math.ceil(r.ref * FACTOR.buyMul));
  const sellMul = FACTOR.sellMul * (perkOn(ctx, 'bridge') ? PERK.bridgeSellMul : 1);
  return {
    buy,
    sell: Math.min(buy - 1, Math.max(1, Math.floor(r.ref * sellMul))),
    buyLeft: Math.max(0, FACTOR.dailyBase - used.bought),
    sellLeft: Math.max(0, FACTOR.dailyBase - used.sold),
  };
}

export function marketView(ctx: Ctx, player: Player): MarketRes {
  return tx(ctx.db, () => {
    const rows = factorRows(ctx);
    const factor = Object.fromEntries(RAWS.map((raw) => [raw, quote(ctx, rows.find((r) => r.raw === raw)!, player.id)])) as Record<RawId, FactorQuote>;
    const open = ctx.db
      .prepare(`SELECT l.id, l.item_id, l.charges, l.price, l.seller, l.relic_ref, l.raw, l.qty, p.name FROM listings l JOIN players p ON p.id = l.seller WHERE l.status = 'open' ORDER BY l.created DESC, l.id LIMIT 300`)
      .all() as { id: string; item_id: string; charges: number; price: number; seller: number; relic_ref: number | null; raw: RawId | null; qty: number; name: string }[];
    const listings: Listing[] = [];
    const lots: RawLot[] = [];
    for (const l of open) {
      if (l.raw) { lots.push({ id: l.id, raw: l.raw, qty: l.qty, price: l.price, seller: l.name, mine: l.seller === player.id }); continue; }
      const item = heldItem(ctx, l);
      if (item) listings.push({ id: l.id, item, charges: l.charges, price: l.price, seller: l.name, mine: l.seller === player.id });
    }
    const rowsO = ctx.db
      .prepare(`SELECT o.id, o.buyer, o.raw, o.item_id, o.qty, o.filled, o.price, p.name FROM orders o JOIN players p ON p.id = o.buyer WHERE o.status = 'open' ORDER BY o.created DESC, o.id LIMIT 200`)
      .all() as { id: string; buyer: number; raw: RawId | null; item_id: string | null; qty: number; filled: number; price: number; name: string }[];
    const orders: Order[] = [];
    for (const o of rowsO) {
      const item = o.item_id ? getItem(ctx, o.item_id) : undefined;
      if (o.raw || item) orders.push({ id: o.id, ...(o.raw ? { raw: o.raw } : { item }), qty: o.qty, filled: o.filled, price: o.price, buyer: o.name, mine: o.buyer === player.id });
    }
    return { open: ctx.marketOpen, factor, listings, lots, orders };
  });
}

const done = (ctx: Ctx, player: Player): MarketActionRes => ({ profile: profile(ctx, player.id), market: marketView(ctx, player) });
/** Run a keyed market action once; a repeat of the same request answers with the books as they stand. */
const keyed = (ctx: Ctx, player: Player, req: { idem: string }, fn: () => void): MarketActionRes =>
  tx(ctx.db, () => once(ctx, player.id, req.idem, req, () => { fn(); return done(ctx, player); }, () => done(ctx, player)));

export function factorTrade(ctx: Ctx, player: Player, req: FactorReq): MarketActionRes {
  requireOpen(ctx);
  return keyed(ctx, player, req, () => {
    const row = factorRows(ctx).find((r) => r.raw === req.raw)!;
    const q = quote(ctx, row, player.id);
    const buying = req.side === 'buy';
    if (req.qty > (buying ? q.buyLeft : q.sellLeft)) {
      throw bad('factor_limit', `The Factor will not ${buying ? 'sell you' : 'buy'} that much ${req.raw} today.`);
    }
    if (buying) move(ctx, player.id, 'factor_buy', { marks: -q.buy * req.qty, [req.raw]: req.qty }, req.raw);
    else move(ctx, player.id, 'factor_sell', { marks: q.sell * req.qty, [req.raw]: -req.qty }, req.raw);
    // The reference follows net volume, slowly, within fixed bounds.
    const base = FACTOR_BASE[req.raw];
    const ref = Math.min(base * FACTOR.clamp, Math.max(base / FACTOR.clamp, row.ref * Math.exp(FACTOR.drift * (buying ? req.qty : -req.qty))));
    ctx.db
      .prepare('UPDATE factor SET ref = ?, bought = bought + ?, sold = sold + ? WHERE raw = ?')
      .run(ref, buying ? req.qty : 0, buying ? 0 : req.qty, req.raw);
    ctx.db
      .prepare('INSERT INTO factor_day (player_id, day, raw, bought, sold) VALUES (?, ?, ?, ?, ?) ON CONFLICT (player_id, day, raw) DO UPDATE SET bought = bought + excluded.bought, sold = sold + excluded.sold')
      .run(player.id, dayOf(ctx.now()), req.raw, buying ? req.qty : 0, buying ? 0 : req.qty);
  });
}

const openCount = (ctx: Ctx, playerId: number) =>
  (ctx.db.prepare(`SELECT COUNT(*) AS n FROM listings WHERE seller = ? AND status = 'open'`).get(playerId) as { n: number }).n;
/** The listing fee, destroyed. Waived while the fair's perk runs. */
const listingFee = (ctx: Ctx, price: number) => (perkOn(ctx, 'fair') ? 0 : Math.max(1, Math.ceil(price * LISTING_FEE)));

export function listItem(ctx: Ctx, player: Player, req: ListReq): MarketActionRes {
  requireOpen(ctx);
  return keyed(ctx, player, req, () => {
    requireSeasoned(ctx, player.id);
    if (openCount(ctx, player.id) >= LISTING.maxOpen) throw bad('listing_limit', `You can have ${LISTING.maxOpen} listings up at once.`);
    if (req.raw) {
      // A lot of raws at one price for the whole lot. The Factor's selling price is the ceiling: above it nobody would buy.
      const qty = req.qty ?? 0;
      if (qty < 1 || qty > MAX_LOT) throw new ApiErr(400, 'bad_request', 'The request is not valid at qty.');
      const q = quote(ctx, factorRows(ctx).find((r) => r.raw === req.raw)!, player.id);
      if (req.price > qty * q.buy) throw bad('price_cap', `The Factor sells ${req.raw} at ${q.buy} marks. A lot cannot ask more than that for each unit.`);
      move(ctx, player.id, 'listing_fee', { marks: -listingFee(ctx, req.price) }, `lot ${req.raw}`);
      move(ctx, player.id, 'lot_post', { [req.raw]: -qty }, req.raw);
      ctx.db
        .prepare(`INSERT INTO listings (id, seller, item_id, charges, price, status, created, raw, qty) VALUES (?, ?, '', 0, ?, 'open', ?, ?, ?)`)
        .run(newId(), player.id, req.price, ctx.now(), req.raw, qty);
      return;
    }
    const row = req.uid ? stashRow(ctx, player.id, req.uid) : undefined;
    const item = row && heldItem(ctx, row);
    if (!row || !item) throw bad('not_owned', 'That item is not in your stash.');
    if (row.relic_ref != null) {
      // A relic may be posted at any price, by a player with a real history.
      requireRelicHistory(ctx, player.id, 'You');
    } else {
      const cap = Math.min(LISTING.maxPrice, priceCeiling(item, row.charges));
      if (req.price > cap) throw bad('price_cap', `That item can be posted for at most ${cap} marks.`);
    }
    move(ctx, player.id, 'listing_fee', { marks: -listingFee(ctx, req.price) }, row.item_id);
    ctx.db.prepare('DELETE FROM stash WHERE uid = ?').run(row.uid);
    ctx.db
      .prepare(`INSERT INTO listings (id, seller, item_id, charges, price, status, created, relic_ref, repairs) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?)`)
      .run(newId(), player.id, row.item_id, row.charges, req.price, ctx.now(), row.relic_ref, row.repairs);
  });
}

interface ListingRow { id: string; seller: number; item_id: string; charges: number; price: number; relic_ref: number | null; raw: RawId | null; qty: number; repairs: number }
const openListing = (ctx: Ctx, id: string) =>
  ctx.db.prepare(`SELECT id, seller, item_id, charges, price, relic_ref, raw, qty, repairs FROM listings WHERE id = ? AND status = 'open'`).get(id) as ListingRow | undefined;

/** Put an item from a listing or an order into a stash, keeping its wear. */
function stashFrom(ctx: Ctx, playerId: number, l: Pick<ListingRow, 'item_id' | 'charges' | 'relic_ref' | 'repairs'>) {
  const uid = addStash(ctx, playerId, l.item_id, l.charges, l.relic_ref);
  if (l.repairs) ctx.db.prepare('UPDATE stash SET repairs = ? WHERE uid = ?').run(l.repairs, uid);
}

/** Pay a seller for a sale: the price in, the tax out, and the town's share of the tax on to the project. */
function paySeller(ctx: Ctx, seller: number, gross: number, kind: string, reason: string) {
  const tax = Math.min(gross, Math.max(1, Math.ceil(gross * SALE_TAX)));
  move(ctx, seller, kind, { marks: gross }, reason);
  move(ctx, seller, 'sale_tax', { marks: -tax }, reason);
  taxToTown(ctx, Math.round(tax * TAX_TO_TOWN));
}

export function buyListing(ctx: Ctx, player: Player, req: BuyReq): MarketActionRes {
  requireOpen(ctx);
  return keyed(ctx, player, req, () => {
    const l = openListing(ctx, req.listingId);
    if (!l) throw new ApiErr(409, 'listing_gone', 'That listing is no longer up.');
    if (l.seller === player.id) throw bad('own_listing', 'That is your own listing. Cancel it to take the item back.');
    requireSeasoned(ctx, player.id);
    if (l.relic_ref != null) {
      requireRelicHistory(ctx, player.id, 'You');
      requireRelicHistory(ctx, l.seller, 'The seller');
    } else {
      transfer(ctx, player.id, l.seller, l.price);
      if (!l.raw && stashRoom(ctx, player.id) < 1) throw bad('stash_full', 'Your stash is full. Make room first.');
    }
    move(ctx, player.id, 'market_buy', { marks: -l.price }, l.id);
    paySeller(ctx, l.seller, l.price, 'market_sale', l.id);
    ctx.db.prepare(`UPDATE listings SET status = 'sold', buyer = ? WHERE id = ?`).run(player.id, l.id);
    if (l.raw) move(ctx, player.id, 'lot_buy', { [l.raw]: l.qty }, l.id);
    else {
      stashFrom(ctx, player.id, l);
      if (l.relic_ref != null) note(ctx, player.id, 'relic', l.item_id);
    }
  });
}

/** Taking a listing down is allowed even while trading is closed. The fee is not returned. */
export function cancelListing(ctx: Ctx, player: Player, req: CancelReq): MarketActionRes {
  return tx(ctx.db, () => {
    const l = openListing(ctx, req.listingId);
    if (!l || l.seller !== player.id) throw new ApiErr(409, 'listing_gone', 'That listing is no longer up.');
    if (l.raw) move(ctx, player.id, 'lot_back', { [l.raw]: l.qty }, l.id);
    else {
      if (l.relic_ref == null && stashRoom(ctx, player.id) < 1) throw bad('stash_full', 'Your stash is full. Make room before taking the listing down.');
      stashFrom(ctx, player.id, l);
    }
    ctx.db.prepare(`UPDATE listings SET status = 'cancelled' WHERE id = ?`).run(l.id);
    return done(ctx, player);
  });
}

export function salvage(ctx: Ctx, player: Player, req: SalvageReq): MarketActionRes {
  return tx(ctx.db, () => {
    const row = stashRow(ctx, player.id, req.uid);
    const item = row && heldItem(ctx, row);
    if (!row || !item) throw bad('not_owned', 'That item is not in your stash.');
    // A relic cannot be destroyed, by accident or on purpose. It can only change hands.
    if (isRelic(item)) throw bad('relic_kept', 'A relic cannot be salvaged. It can be posted on the market.');
    ctx.db.prepare('DELETE FROM stash WHERE uid = ?').run(row.uid);
    const marks = Math.max(1, Math.round((itemPoints(item.effects) * row.charges) / (KIT_CHARGES * 5)));
    move(ctx, player.id, 'salvage', { marks }, item.id);
    return done(ctx, player);
  });
}

// ---- buy orders ---------------------------------------------------------------
// A player posts what they want and the marks for it are set aside at once
// (ledger kind order_hold). A seller fills the order and is paid from that.

interface OrderRow { id: string; buyer: number; raw: RawId | null; item_id: string | null; qty: number; filled: number; price: number }
const openOrder = (ctx: Ctx, id: string) =>
  ctx.db.prepare(`SELECT id, buyer, raw, item_id, qty, filled, price FROM orders WHERE id = ? AND status = 'open'`).get(id) as OrderRow | undefined;

export function placeOrder(ctx: Ctx, player: Player, req: OrderReq): MarketActionRes {
  requireOpen(ctx);
  return keyed(ctx, player, req, () => {
    requireSeasoned(ctx, player.id);
    const mine = ctx.db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE buyer = ? AND status = 'open'`).get(player.id) as { n: number };
    if (mine.n >= LISTING.maxOrders) throw bad('order_limit', `You can have ${LISTING.maxOrders} orders up at once.`);
    let qty = 1;
    if (req.raw) {
      qty = req.qty ?? 0;
      if (qty < 1 || qty > MAX_LOT) throw new ApiErr(400, 'bad_request', 'The request is not valid at qty.');
      const q = quote(ctx, factorRows(ctx).find((r) => r.raw === req.raw)!, player.id);
      if (req.price > q.buy) throw bad('price_cap', `The Factor sells ${req.raw} at ${q.buy} marks. An order cannot offer more.`);
    } else {
      const item = req.itemId ? getItem(ctx, req.itemId) : undefined;
      if (!item) throw new ApiErr(404, 'unknown_item', 'No such item.');
      if (isRelic(item)) throw bad('blocked', 'A relic cannot be ordered. It can only be bought from a listing.');
      const cap = Math.min(LISTING.maxPrice, priceCeiling(item, KIT_CHARGES));
      if (req.price > cap) throw bad('price_cap', `An order for that item can offer at most ${cap} marks.`);
    }
    move(ctx, player.id, 'order_hold', { marks: -qty * req.price }, req.raw ?? req.itemId ?? '');
    ctx.db
      .prepare(`INSERT INTO orders (id, buyer, raw, item_id, qty, filled, price, status, created) VALUES (?, ?, ?, ?, ?, 0, ?, 'open', ?)`)
      .run(newId(), player.id, req.raw ?? null, req.raw ? null : req.itemId, qty, req.price, ctx.now());
  });
}

export function fillOrder(ctx: Ctx, player: Player, req: FillReq): MarketActionRes {
  requireOpen(ctx);
  return keyed(ctx, player, req, () => {
    const o = openOrder(ctx, req.orderId);
    if (!o) throw new ApiErr(409, 'order_gone', 'That order is no longer up.');
    if (o.buyer === player.id) throw bad('own_order', 'That is your own order.');
    requireSeasoned(ctx, player.id);
    let qty = 1;
    if (o.raw) {
      qty = req.qty ?? 0;
      if (qty < 1 || qty > o.qty - o.filled) throw bad('order_qty', `That order wants ${o.qty - o.filled} more.`);
      transfer(ctx, o.buyer, player.id, qty * o.price);
      move(ctx, player.id, 'order_fill', { [o.raw]: -qty }, o.id);
      move(ctx, o.buyer, 'order_goods', { [o.raw]: qty }, o.id);
    } else {
      const row = req.uid ? stashRow(ctx, player.id, req.uid) : undefined;
      if (!row || row.relic_ref != null || row.item_id !== o.item_id) throw bad('not_owned', 'That is not the item the order asks for.');
      if (row.charges < KIT_CHARGES) throw bad('order_worn', 'An order is for an item with every charge left.');
      if (stashRoom(ctx, o.buyer) < 1) throw bad('stash_full', 'The buyer has no room for it.');
      transfer(ctx, o.buyer, player.id, o.price);
      ctx.db.prepare('DELETE FROM stash WHERE uid = ?').run(row.uid);
      stashFrom(ctx, o.buyer, { item_id: row.item_id, charges: row.charges, relic_ref: null, repairs: row.repairs });
    }
    paySeller(ctx, player.id, qty * o.price, 'order_sale', o.id);
    const filled = o.filled + qty;
    ctx.db.prepare('UPDATE orders SET filled = ?, status = ? WHERE id = ?').run(filled, filled >= o.qty ? 'filled' : 'open', o.id);
  });
}

/** Taking an order down is allowed even while trading is closed. The marks for the unfilled part come back. */
export function cancelOrder(ctx: Ctx, player: Player, req: OrderCancelReq): MarketActionRes {
  return tx(ctx.db, () => {
    const o = openOrder(ctx, req.orderId);
    if (!o || o.buyer !== player.id) throw new ApiErr(409, 'order_gone', 'That order is no longer up.');
    ctx.db.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).run(o.id);
    move(ctx, player.id, 'order_refund', { marks: (o.qty - o.filled) * o.price }, o.id);
    return done(ctx, player);
  });
}
