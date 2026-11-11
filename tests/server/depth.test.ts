// The long-term rules: the kit cap, the hazard ladder, the sinks, the almanac, raw lots and buy orders.
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUTHORED_PAIRS } from '../../server/almanac.ts';
import { audit } from '../../server/audit.ts';
import { RELIC_ONE_IN } from '../../server/config.ts';
import { MIGRATIONS, openDb } from '../../server/db.ts';
import { TITLES } from '../../src/shared/almanac.ts';
import { BASE_ITEM, BASE_ITEMS } from '../../src/shared/content/items.ts';
import { itemPoints, itemTier } from '../../src/shared/item.ts';
import { KIT_POINT_CAP, packItem, packedDown } from '../../src/shared/kit.ts';
import type {
  AlmanacRes, ApiError, CodexRes, FuseRes, GiveRes, MarketActionRes, MarketRes, RunEndRes, RunStartRes, TitleRes, TownRes, WorkshopRes,
} from '../../src/shared/protocol.ts';
import { repairCost, stashNextCost } from '../../src/shared/rules.ts';
import { DAY, report, world } from './helpers.ts';

type W = ReturnType<typeof world>;
const MIN = 60_000;
const WIN = { wavesCleared: 12, won: true, scripEarned: 3000, scripHeld: 1000, kills: 2000 };
const start = (w: W, token: string, over: object = {}) => w.post<RunStartRes & ApiError>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [], ...over });
async function win(w: W, token: string, over: object = {}, end: object = {}) {
  const s = await start(w, token, over);
  if (s.status !== 200) throw new Error(JSON.stringify(s.body));
  w.advance(10 * MIN);
  const e = await w.post<RunEndRes>('/api/run/end', token, report(s.body.runId, { ...WIN, ...end }));
  if (e.status !== 200) throw new Error(JSON.stringify(e.body));
  return { start: s.body, end: e.body };
}

describe('kit: a key, not a win button', () => {
  it('packs an item down to the cap of the hazard, deterministically, and leaves weak items and relics alone', () => {
    const anvil = BASE_ITEM.anvil;
    expect(itemPoints(anvil.effects)).toBeGreaterThan(60);
    for (let h = 0; h <= 5; h++) {
      const p = packItem(anvil, h);
      expect(itemPoints(p.effects)).toBeLessThanOrEqual(Math.max(KIT_POINT_CAP[h], 1));
      expect(p.id).toBe('anvil');
      expect(packItem(anvil, h)).toEqual(p);
      // Nothing is added: every effect is one the item had, at the same level or lower.
      for (const e of p.effects) {
        const was = anvil.effects.find((x) => x.p === e.p && !!x.neg === !!e.neg)!;
        expect(was).toBeDefined();
        expect(e.l).toBeLessThanOrEqual(was.l);
      }
    }
    expect(packItem(anvil, 5)).toBe(anvil); // the top hazard takes any item whole
    expect(packedDown(anvil, 0)).toBe(true);
    const whet = BASE_ITEM.whetstone;
    expect(packItem(whet, 0)).toBe(whet);
    expect(packedDown(whet, 0)).toBe(false);
    // The caps climb with hazard.
    for (let h = 1; h <= 5; h++) expect(KIT_POINT_CAP[h]).toBeGreaterThan(KIT_POINT_CAP[h - 1]);
    // Every authored item packs to something legal at every hazard.
    for (const item of BASE_ITEMS) for (let h = 0; h <= 5; h++) {
      const p = packItem(item, h);
      expect(p.effects.some((e) => !e.neg)).toBe(true);
      expect(itemPoints(p.effects)).toBeLessThanOrEqual(Math.max(KIT_POINT_CAP[h], itemPoints(item.effects) <= KIT_POINT_CAP[h] ? 999 : KIT_POINT_CAP[h]));
    }
  });

  it('writes the packed kit on the ticket and leaves the stash item whole', async () => {
    const w = world();
    const token = await w.player();
    const [anvil, whet] = await w.grant(token, ['anvil', 'whetstone']);
    const s = await start(w, token, { kit: [anvil.uid, whet.uid] });
    expect(s.body.hazard).toBe(0);
    expect(s.body.kit.map((i) => i.id)).toEqual(['anvil', 'whetstone']);
    expect(s.body.kit[0]).toEqual(packItem(BASE_ITEM.anvil, 0));
    expect(itemPoints(s.body.kit[0].effects)).toBeLessThanOrEqual(KIT_POINT_CAP[0]);
    expect(s.body.kit[1]).toEqual(BASE_ITEM.whetstone);
    // The stash still holds the real thing, one charge lighter.
    const held = s.body.profile.items.find((i) => i.uid === anvil.uid)!;
    expect(held.item).toEqual(BASE_ITEM.anvil);
    expect(held.charges).toBe(2);
  });
});

describe('hazard ladder', () => {
  it('opens level n + 1 for a character with a win at n as that character, and pays a little more', async () => {
    const w = world();
    const token = await w.player(12);
    expect((await w.me(token)).hazard.greenhorn).toEqual({ open: 0, best: -1 });

    const locked = await start(w, token, { hazard: 1 });
    expect([locked.status, locked.body.code]).toEqual([403, 'hazard_locked']);
    expect((await start(w, token, { hazard: 6 })).body.code).toBe('bad_request');
    expect((await start(w, token, { hazard: -1 })).body.code).toBe('bad_request');

    // A loss opens nothing.
    await w.run(token, { wavesCleared: 9 });
    expect((await w.me(token)).hazard.greenhorn.open).toBe(0);

    const base = await win(w, token);
    expect(base.start.hazard).toBe(0);
    expect(base.end.hazardOpened).toBe(1);
    expect(base.end.profile.hazard.greenhorn).toEqual({ open: 1, best: 0 });
    // Only for that character.
    expect(base.end.profile.hazard.sawyer).toEqual({ open: 0, best: -1 });
    expect((await start(w, token, { character: 'sawyer', hazard: 1 })).body.code).toBe('hazard_locked');

    // Hazard 1 pays 10% more marks: (100 + 36) x 1.1.
    const one = await win(w, token, { hazard: 1 });
    expect(one.start.hazard).toBe(1);
    expect(base.end.gained.marks).toBe(136);
    expect(one.end.gained.marks).toBe(Math.floor(136 * 1.1));
    expect(one.end.hazardOpened).toBe(2);
    // Winning hazard 0 again opens nothing new.
    expect((await win(w, token)).end.hazardOpened).toBeUndefined();

    // Up the ladder to the top; there is no level 6.
    for (let h = 2; h <= 5; h++) expect((await win(w, token, { hazard: h })).end.profile.hazard.greenhorn.best).toBe(h);
    const top = await w.me(token);
    expect(top.hazard.greenhorn).toEqual({ open: 5, best: 5 });
    expect(top.titles).toEqual(expect.arrayContaining(['hazard3', 'hazard5']));
    expect(w.db.prepare(`SELECT hazard, wins FROM records WHERE character = 'greenhorn' ORDER BY hazard`).all()).toEqual(
      [0, 1, 2, 3, 4, 5].map((hazard) => ({ hazard, wins: hazard === 0 ? 2 : 1 })),
    );
    // The daily ignores hazard.
    const d = await w.post<RunStartRes>('/api/run/start', token, { mode: 'daily', character: 'greenhorn', kit: [], hazard: 3 });
    expect(d.body.hazard).toBe(0);
    expect(audit(w.db).ok).toBe(true);
  });

  it('rolls for a relic at the same odds whatever the hazard', async () => {
    const thrown: number[] = [];
    // A throw just inside the win odds finds one; just outside does not. Hazard must not move the line.
    let u = 1 / RELIC_ONE_IN.win + 1e-9;
    const w = world({ rng: () => { thrown.push(u); return u; } });
    const token = await w.player(12);
    await win(w, token);
    for (let h = 1; h <= 5; h++) expect((await win(w, token, { hazard: h })).end.relic).toBeUndefined();
    expect(thrown.length).toBe(6);
    u = 1 / RELIC_ONE_IN.win - 1e-9;
    expect((await win(w, token, { hazard: 5 })).end.relic).toBeDefined();
  });
});

describe('sinks', () => {
  it('repairs a worn item for marks and raws by its points, twice at most', async () => {
    const w = world();
    const token = await w.player();
    const [brace] = await w.grant(token, ['drillbrace']);
    const cost = repairCost(BASE_ITEM.drillbrace);
    expect(cost.marks).toBe(itemPoints(BASE_ITEM.drillbrace.effects));
    const repair = (idem: string) => w.post<WorkshopRes & ApiError>('/api/workshop/repair', token, { uid: brace.uid, idem });

    expect((await repair('repair-key-0')).body.code).toBe('not_worn');
    for (let i = 0; i < 2; i++) await start(w, token, { kit: [brace.uid] });
    expect((await repair('repair-key-1')).body.code).toMatch(/^no_(marks|raws)$/);
    w.fund(token, 1000, 100);
    const before = await w.me(token);
    const r1 = await repair('repair-key-2');
    expect(r1.status).toBe(200);
    expect(r1.body.profile.items[0]).toMatchObject({ charges: 2, repairs: 1 });
    expect(r1.body.profile.marks).toBe(before.marks - cost.marks);
    expect(r1.body.profile.raws.ore).toBe(before.raws.ore - cost.raws.ore);
    // A retry with the same key repairs once.
    expect((await repair('repair-key-2')).body.profile.items[0]).toMatchObject({ charges: 2, repairs: 1 });
    const r2 = await repair('repair-key-3');
    expect(r2.body.profile.items[0]).toMatchObject({ charges: 3, repairs: 2 });
    await start(w, token, { kit: [brace.uid] });
    const r3 = await repair('repair-key-4');
    expect([r3.status, r3.body.code]).toEqual([400, 'repair_limit']);
    expect(audit(w.db).byKind.repair.marks).toBe(-2 * cost.marks);
    expect(audit(w.db).ok).toBe(true);
  });

  it('holds 24 items, salvages what does not fit at the door, and sells more room a shelf at a time', async () => {
    const w = world();
    const token = await w.player(10);
    const ids = BASE_ITEMS.filter((i) => itemTier(i) === 1).map((i) => i.id);
    await w.grant(token, [...ids, ...ids].slice(0, 23));
    let me = await w.me(token);
    expect([me.stashUsed, me.stashLimit]).toEqual([23, 24]);

    // Three carried, room for one: two are salvaged for marks and said so.
    const full = await win(w, token, {}, { carry: ids.slice(0, 3) });
    expect(full.end.gained.items.length).toBe(1);
    expect(full.end.salvaged).toEqual({ items: 2, marks: expect.any(Number) });
    expect(full.end.salvaged!.marks).toBeGreaterThan(0);
    expect(full.end.profile.stashUsed).toBe(24);
    expect(full.end.gained.marks).toBe(136 + full.end.salvaged!.marks);

    // A full stash cannot take a purchase or a cancelled listing.
    const seller = await w.player(10);
    const [thing] = await w.grant(seller, ['saltpork']);
    const l = await w.post<MarketActionRes>('/api/market/list', seller, { uid: thing.uid, price: 5, idem: 'full-list-01' });
    const buy = await w.post<ApiError>('/api/market/buy', token, { listingId: l.body.market.listings[0].id, idem: 'full-buy-001' });
    expect([buy.status, buy.body.code]).toEqual([400, 'stash_full']);

    // A shelf: 150 marks and 20 of each raw for the first, more for each after.
    expect(stashNextCost(0)).toEqual({ marks: 150, raws: { timber: 20, ore: 20, hide: 20 } });
    expect((await w.post<ApiError>('/api/stash/expand', token, { idem: 'shelf-key-00' })).body.code).toMatch(/^no_/);
    w.fund(token, 500, 100);
    me = await w.me(token);
    const shelf = await w.post<WorkshopRes>('/api/stash/expand', token, { idem: 'shelf-key-01' });
    expect(shelf.status).toBe(200);
    expect(shelf.body.profile).toMatchObject({ stashLimit: 32, stashBought: 1, marks: me.marks - 150 });
    expect((await w.post<WorkshopRes>('/api/stash/expand', token, { idem: 'shelf-key-01' })).body.profile.stashBought).toBe(1);
    expect((await w.post('/api/market/buy', token, { listingId: l.body.market.listings[0].id, idem: 'full-buy-002' })).status).toBe(200);
    expect(stashNextCost(1)!.marks).toBeGreaterThan(150);
    expect(stashNextCost(9)).toBeNull();
    expect(audit(w.db).ok).toBe(true);
  });
});

describe('market: raw lots and buy orders', () => {
  it('trades a lot of raws between players inside the Factor\'s band', async () => {
    const w = world();
    const [seller, buyer] = [await w.player(10), await w.player(10)];
    w.fund(seller, 100, 200);
    w.fund(buyer, 1000);
    const q = (await w.get<MarketRes>('/api/market', seller)).body.factor.timber;
    // Asking more than the Factor charges is pointless, and refused.
    const dear = await w.post<ApiError>('/api/market/list', seller, { raw: 'timber', qty: 50, price: 50 * q.buy + 1, idem: 'lot-post-001' });
    expect([dear.status, dear.body.code]).toEqual([400, 'price_cap']);
    expect((await w.post<ApiError>('/api/market/list', seller, { raw: 'timber', qty: 500, price: 10, idem: 'lot-post-002' })).body.code).toBe('no_raws');
    // Between what the Factor pays (3) and charges (12): good for both.
    const price = 50 * 6;
    const posted = await w.post<MarketActionRes>('/api/market/list', seller, { raw: 'timber', qty: 50, price, idem: 'lot-post-003' });
    expect(posted.status).toBe(200);
    expect(posted.body.profile.raws.timber).toBe(150);
    expect(posted.body.market.lots).toEqual([{ id: expect.any(String), raw: 'timber', qty: 50, price, seller: posted.body.profile.name, mine: true }]);
    expect(posted.body.market.listings).toEqual([]);
    const bought = await w.post<MarketActionRes>('/api/market/buy', buyer, { listingId: posted.body.market.lots[0].id, idem: 'lot-buy-0001' });
    expect(bought.status).toBe(200);
    expect(bought.body.profile.raws.timber).toBe(50);
    expect(bought.body.profile.marks).toBe(1000 - price);
    expect((await w.me(seller)).marks).toBe(posted.body.profile.marks + price - 15);
    // A lot taken down comes back whole.
    const again = await w.post<MarketActionRes>('/api/market/list', seller, { raw: 'ore', qty: 30, price: 60, idem: 'lot-post-004' });
    const back = await w.post<MarketActionRes>('/api/market/cancel', seller, { listingId: again.body.market.lots[0].id });
    expect(back.body.profile.raws.ore).toBe(200);
    expect(back.body.market.lots).toEqual([]);
    expect(audit(w.db).ok).toBe(true);
  });

  it('holds the marks of a buy order, fills it in parts, and gives back what is left', async () => {
    const w = world();
    const [buyer, seller, other] = [await w.player(10), await w.player(10), await w.player(9)];
    w.fund(buyer, 2000);
    w.fund(seller, 0, 100);
    w.fund(other, 0, 100);
    const q = (await w.get<MarketRes>('/api/market', buyer)).body.factor.hide;
    expect((await w.post<ApiError>('/api/market/order', buyer, { raw: 'hide', qty: 40, price: q.buy + 1, idem: 'order-key-00' })).body.code).toBe('price_cap');
    expect((await w.post<ApiError>('/api/market/order', other, { raw: 'hide', qty: 40, price: 5, idem: 'order-key-0x' })).body.code).toBe('listing_locked');
    const placed = await w.post<MarketActionRes>('/api/market/order', buyer, { raw: 'hide', qty: 40, price: 8, idem: 'order-key-01' });
    expect(placed.status).toBe(200);
    expect(placed.body.profile.marks).toBe(2000 - 320); // set aside at once
    const order = placed.body.market.orders[0];
    expect(order).toMatchObject({ raw: 'hide', qty: 40, filled: 0, price: 8, mine: true });

    expect((await w.post<ApiError>('/api/market/fill', buyer, { orderId: order.id, qty: 5, idem: 'fill-key-000' })).body.code).toBe('own_order');
    expect((await w.post<ApiError>('/api/market/fill', other, { orderId: order.id, qty: 5, idem: 'fill-key-00x' })).body.code).toBe('listing_locked');
    expect((await w.post<ApiError>('/api/market/fill', seller, { orderId: order.id, qty: 41, idem: 'fill-key-001' })).body.code).toBe('order_qty');
    const part = await w.post<MarketActionRes>('/api/market/fill', seller, { orderId: order.id, qty: 25, idem: 'fill-key-002' });
    expect(part.status).toBe(200);
    expect(part.body.profile.raws.hide).toBe(75);
    expect(part.body.profile.marks).toBe(200 - 10); // 25 x 8, less 5% tax
    expect(part.body.market.orders[0]).toMatchObject({ filled: 25, mine: false });
    expect((await w.me(buyer)).raws.hide).toBe(25);
    // The same fill sent again fills once.
    await w.post('/api/market/fill', seller, { orderId: order.id, qty: 25, idem: 'fill-key-002' });
    expect((await w.me(buyer)).raws.hide).toBe(25);
    expect(audit(w.db).ok).toBe(true);

    const cancelled = await w.post<MarketActionRes>('/api/market/order/cancel', buyer, { orderId: order.id });
    expect(cancelled.body.profile.marks).toBe(2000 - 200);
    expect(cancelled.body.market.orders).toEqual([]);
    expect((await w.post<ApiError>('/api/market/fill', seller, { orderId: order.id, qty: 1, idem: 'fill-key-003' })).body.code).toBe('order_gone');
    expect(audit(w.db).ok).toBe(true);
  });

  it('takes an order for a named item, at no more than the item is worth', async () => {
    const w = world();
    const [buyer, seller] = [await w.player(10), await w.player(10)];
    w.fund(buyer, 5000);
    const [bellows, worn] = await w.grant(seller, ['forgebellows', 'forgebellows']);
    await start(w, seller, { kit: [worn.uid] });
    expect((await w.post<ApiError>('/api/market/order', buyer, { itemId: 'forgebellows', price: 99_999, idem: 'iorder-key-0' })).body.code).toBe('price_cap');
    expect((await w.post<ApiError>('/api/market/order', buyer, { itemId: 'orderbook', price: 50, idem: 'iorder-key-r' })).body.code).toBe('blocked');
    const placed = await w.post<MarketActionRes>('/api/market/order', buyer, { itemId: 'forgebellows', price: 500, idem: 'iorder-key-1' });
    expect(placed.status).toBe(200);
    const order = placed.body.market.orders[0];
    expect(order.item!.id).toBe('forgebellows');
    // A worn one will not do, nor a different item.
    expect((await w.post<ApiError>('/api/market/fill', seller, { orderId: order.id, uid: worn.uid, idem: 'ifill-key-00' })).body.code).toBe('order_worn');
    const filled = await w.post<MarketActionRes>('/api/market/fill', seller, { orderId: order.id, uid: bellows.uid, idem: 'ifill-key-01' });
    expect(filled.status).toBe(200);
    expect(filled.body.market.orders).toEqual([]);
    const got = (await w.me(buyer)).items;
    expect(got.map((i) => [i.item.id, i.charges])).toEqual([['forgebellows', 3]]);
    expect((await w.me(buyer)).marks).toBe(4500);
    expect(audit(w.db).ok).toBe(true);
  });
});

describe('almanac, titles and finds', () => {
  it('counts what was done as x of y and gives titles for it', async () => {
    const w = world();
    const token = await w.player();
    let a = (await w.get<AlmanacRes>('/api/almanac', token)).body;
    expect(a.have).toBe(0);
    expect(a.lines.find((l) => l.id === 'pairs')).toMatchObject({ have: 0, of: AUTHORED_PAIRS });
    expect(a.lines.find((l) => l.id === 'hazard')!.of).toBe(36);
    expect(a.lines.find((l) => l.id === 'items')!.of).toBe(BASE_ITEMS.length);
    expect(a.titles.map((t) => t.id)).toEqual(TITLES.map((t) => t.id));
    expect(a.titles.every((t) => t.earned === null)).toBe(true);
    expect(a.world).toEqual({ authoredPairs: AUTHORED_PAIRS, found: 0 });

    // A win, three items carried, kills by kind, a gift to the town.
    const r = await win(w, token, {}, { carry: ['whetstone', 'tallow', 'whetstone'], killsBy: { mite: 900, boar: 40, tusk: 1 } });
    expect(r.end.titles).toBeUndefined();
    a = (await w.get<AlmanacRes>('/api/almanac', token)).body;
    expect(a.items.sort()).toEqual(['tallow', 'whetstone']);
    expect(a.enemies).toEqual({ mite: 900, boar: 40, tusk: 1 });
    expect(a.wins).toEqual({ greenhorn: [0] });
    expect(a.lines.find((l) => l.id === 'enemies')!.have).toBe(3);
    expect(a.lines.find((l) => l.id === 'hands')!.have).toBe(1);
    expect(a.have).toBe(2 + 3 + 1 + 1);
    // Kills by kind cannot exceed kills, or name something that is not in the clearing.
    const s = await start(w, token);
    w.advance(10 * MIN);
    expect((await w.post<ApiError>('/api/run/end', token, report(s.body.runId, { ...WIN, killsBy: { mite: 2001 } }))).body.code).toBe('bad_report');
    expect((await w.post<ApiError>('/api/run/end', token, report(s.body.runId, { ...WIN, killsBy: { dragon: 1 } }))).body.code).toBe('bad_report');
    await w.post('/api/run/end', token, report(s.body.runId, WIN));

    // Ten runs and ten wins: two titles, the first one worn without asking.
    let earned: string[] = [];
    for (let i = 0; i < 8; i++) earned = earned.concat((await win(w, token)).end.titles ?? []);
    expect(earned.sort()).toEqual(['tenruns', 'tenwins']);
    const me = await w.me(token);
    expect(me.titles.sort()).toEqual(['tenruns', 'tenwins']);
    expect(['tenruns', 'tenwins']).toContain(me.title);
    // The title rides with the name where others see it.
    w.fund(token, 0, 50);
    const gave = await w.post<GiveRes>('/api/town/give', token, { raws: { timber: 10 } });
    expect(gave.body.town.givers[0]).toEqual({ name: me.name, title: me.title, given: 10 });
    a = (await w.get<AlmanacRes>('/api/almanac', token)).body;
    expect(a.lines.find((l) => l.id === 'stations')!.have).toBe(1);

    // A title can be changed for another earned one, or taken off; an unearned one is refused.
    const other = me.title === 'tenruns' ? 'tenwins' : 'tenruns';
    expect((await w.post<TitleRes>('/api/almanac/title', token, { title: other })).body.profile.title).toBe(other);
    expect((await w.post<ApiError>('/api/almanac/title', token, { title: 'hazard5' })).body.code).toBe('not_earned');
    expect((await w.post<ApiError>('/api/almanac/title', token, { title: '__proto__' })).body.code).toBe('unknown_title');
    expect((await w.post<TitleRes>('/api/almanac/title', token, { title: '' })).body.profile.title).toBe('');
  });

  it('counts a find only for an authored pair or the first making of a finished item, and shows the world\'s book', async () => {
    const w = world();
    const token = await w.player(5);
    const other = await w.player(5);
    const fuse = (who: string, a: string, b: string) => w.post<FuseRes>('/api/fuse', who, { a, b, ctx: 'run' });

    // Authored x authored: counts.
    const f1 = await fuse(token, 'whetstone', 'tallow');
    expect(f1.body).toMatchObject({ first: true, counted: true });
    // A fused item with an authored one, result below tier 4: stamped, not counted.
    const f2 = await fuse(token, f1.body.item.id, 'saltpork');
    expect(itemTier(f2.body.item)).toBeLessThan(4);
    expect(f2.body).toMatchObject({ first: true, counted: false });
    expect(f2.body.item.by).toBe((await w.me(token)).name);
    expect((await w.me(token)).finds).toBe(1);
    // The same authored pair by someone else is no find at all.
    expect((await fuse(other, 'tallow', 'whetstone')).body).toMatchObject({ first: false, counted: false });
    expect((await w.me(other)).finds).toBe(0);

    // The first making of a finished item counts, once; a second recipe for the same item does not.
    w.db.prepare(`INSERT INTO items (id, name, glyph, tags, effects, finder, created) VALUES ('fmida', 'Mid thing', 'stone', '[]', ?, 1, 0), ('fmidb', 'Other mid thing', 'stone', '[]', ?, 1, 0)`)
      .run(JSON.stringify([{ p: 'damage', l: 5 }, { p: 'crit', l: 3 }]), JSON.stringify([{ p: 'armor', l: 5 }, { p: 'maxHp', l: 3 }]));
    const s = await start(w, token);
    w.advance(10 * MIN);
    w.db.prepare(`INSERT INTO run_fusions (run_id, seq, a, b, out) VALUES (?, 1, 'x', 'y', 'fmida'), (?, 2, 'x', 'y', 'fmidb')`).run(s.body.runId, s.body.runId);
    const big = await w.call<FuseRes>('POST', '/api/fuse', token, { a: 'fmida', b: 'fmidb', ctx: 'run', runId: s.body.runId });
    expect(big.status).toBe(200);
    expect(itemTier(big.body.item)).toBe(4);
    expect(big.body).toMatchObject({ first: true, counted: true });
    expect((await w.me(token)).finds).toBe(2);

    const codex = (await w.get<CodexRes>('/api/codex', other)).body;
    expect(codex).toMatchObject({ authoredPairs: AUTHORED_PAIRS, worldAuthored: 1, myAuthored: 1, worldRecipes: 3 });
    expect((await w.get<AlmanacRes>('/api/almanac', token)).body.world.found).toBe(1);
    expect(AUTHORED_PAIRS).toBe(741);
  });

  it('gives a world-first title to one player only', async () => {
    const w = world();
    const [first, second] = [await w.player(5), await w.player(5)];
    // Both have fused 99 authored pairs; the hundredth decides it.
    const ids = BASE_ITEMS.filter((i) => itemTier(i) < 4).map((i) => i.id);
    const pairs: [string, string][] = [];
    for (let i = 0; i < ids.length && pairs.length < 100; i++) for (let j = i + 1; j < ids.length && pairs.length < 100; j++) pairs.push([ids[i], ids[j]]);
    w.db.prepare(`INSERT INTO items (id, name, glyph, tags, effects, finder, created) VALUES ('fany', 'Any thing', 'stone', '[]', '[{"p":"crit","l":1}]', 1, 0)`).run();
    const rec = w.db.prepare(`INSERT INTO recipes (key, a, b, out, finder, model, raw, created, counted) VALUES (?, ?, ?, 'fany', 1, 'test', '', 0, 0)`);
    const know = w.db.prepare('INSERT INTO player_recipes (player_id, key) VALUES (?, ?)');
    for (const [a, b] of pairs.slice(0, 99)) {
      const key = `1:${a < b ? `${a}+${b}` : `${b}+${a}`}`;
      rec.run(key, a, b);
      know.run(1, key);
      know.run(2, key);
    }
    const [a, b] = pairs[99];
    w.db.prepare(`UPDATE stations SET tier = 5 WHERE id = 'assay'`).run();
    await w.post<FuseRes>('/api/fuse', first, { a, b, ctx: 'run' });
    await w.post<FuseRes>('/api/fuse', second, { a, b, ctx: 'run' });
    expect((await w.me(first)).titles.sort()).toEqual(['firstpairs100', 'pairs100']);
    expect((await w.me(second)).titles).toEqual(['pairs100']);
    expect(w.db.prepare('SELECT title, player_id FROM world_firsts').all()).toEqual([{ title: 'firstpairs100', player_id: 1 }]);
  });
});

describe('migration', () => {
  it('brings a database from before this pass up to date, keeping what was in it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scrip-migrate2-'));
    const path = join(dir, 'old.db');
    try {
      // A version 2 file as the last release left it: players, a stash, a listing, runs, recipes, idempotency rows.
      const old = new Database(path);
      old.exec(MIGRATIONS[0] as string);
      old.exec(MIGRATIONS[1] as string);
      old.pragma('user_version = 2');
      old.prepare(`INSERT INTO players (id, token_hash, name, marks, timber, runs, wins, standing, created, last_seen) VALUES (1, 'h1', 'Carter 412', 500, 40, 12, 3, 77, 0, 0), (2, 'h2', 'Mason 101', 0, 0, 0, 0, 0, 0, 0)`).run();
      old.prepare(`INSERT INTO stash (uid, player_id, item_id, charges, created) VALUES ('u1', 1, 'whetstone', 2, 0)`).run();
      old.prepare(`INSERT INTO listings (id, seller, item_id, charges, price, status, created) VALUES ('l1', 1, 'tallow', 3, 9000, 'open', 0)`).run();
      const run = old.prepare(`INSERT INTO runs (id, player_id, mode, character, seed, waves, kit, day, scored, status, started, ended) VALUES (?, 1, ?, 'greenhorn', 1, 12, '[]', '2026-11-01', ?, ?, 0, ?)`);
      run.run('r1', 'run', 0, 'ended', Date.UTC(2026, 10, 10));
      run.run('r2', 'practice', 0, 'ended', 5);
      run.run('r3', 'run', 0, 'void', null);
      old.prepare(`INSERT INTO items (id, name, glyph, tags, effects, finder, created) VALUES ('fa', 'Greased hone', 'stone', '[]', '[{"p":"crit","l":2}]', 1, 5), ('fb', 'Great thing', 'stone', '[]', '[{"p":"damage","l":5},{"p":"crit","l":5}]', 1, 6)`).run();
      const rec = old.prepare(`INSERT INTO recipes (key, a, b, out, finder, model, raw, created) VALUES (?, ?, ?, ?, 1, 'm', '', ?)`);
      rec.run('1:tallow+whetstone', 'tallow', 'whetstone', 'fa', 5); // authored pair
      rec.run('1:fa+saltpork', 'fa', 'saltpork', 'fa', 6); // not authored, not finished
      rec.run('1:fa+pitch', 'fa', 'pitch', 'fb', 6); // first making of a finished item
      rec.run('1:fa+splint', 'fa', 'splint', 'fb', 7); // a later recipe for the same item
      old.prepare(`INSERT INTO idem (player_id, key, body, response, created) VALUES (1, 'k', '{}', ?, 0)`).run('x'.repeat(40_000));
      old.prepare(`INSERT INTO ledger (ts, player_id, kind, marks, timber) VALUES (0, 1, 'run_marks', 500, 40)`).run();
      old.close();

      const db = openDb(path);
      expect(db.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length);
      // Runs that paid are marked paid; the others are not.
      expect(db.prepare('SELECT id, paid, hazard, verified FROM runs ORDER BY id').all()).toEqual([
        { id: 'r1', paid: 1, hazard: 0, verified: 0 }, { id: 'r2', paid: 0, hazard: 0, verified: 0 }, { id: 'r3', paid: 0, hazard: 0, verified: 0 },
      ]);
      expect(db.prepare('SELECT key, counted FROM recipes ORDER BY created, key').all()).toEqual([
        { key: '1:tallow+whetstone', counted: 1 }, { key: '1:fa+pitch', counted: 1 }, { key: '1:fa+saltpork', counted: 0 }, { key: '1:fa+splint', counted: 0 },
      ]);
      expect((db.prepare('SELECT COUNT(*) AS n FROM idem').get() as { n: number }).n).toBe(0);
      expect(db.prepare('SELECT repairs FROM stash').all()).toEqual([{ repairs: 0 }]);
      expect(audit(db).ok).toBe(true);

      // The migrated world plays on, under the new rules. Opening it twice changes nothing.
      const w = world({ db: openDb(path) });
      w.db.prepare('UPDATE players SET token_hash = (SELECT token_hash FROM players WHERE id = 2) || ? WHERE id = 2').run('');
      const town = (await w.get<TownRes>('/api/town', await w.player())).body;
      expect(town.activePlayers).toBe(1); // the one paid run of the last week
      expect(town.project).toMatchObject({ kind: 'station', station: 'sawmill', toTier: 2 });
      const fresh = await w.player();
      const market = (await w.get<MarketRes>('/api/market', fresh)).body;
      // The old listing, priced under the old rules, still stands and can be taken down.
      expect(market.listings.map((l) => [l.id, l.price, l.seller])).toEqual([['l1', 9000, 'Carter 412']]);
      expect(market.lots).toEqual([]);
      expect(market.orders).toEqual([]);
      const profile = w.db.prepare('SELECT name, title, stash_bought FROM players WHERE id = 1').get();
      expect(profile).toEqual({ name: 'Carter 412', title: '', stash_bought: 0 });
      expect((await w.run(fresh)).status).toBe(200);
      expect(audit(w.db).ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
