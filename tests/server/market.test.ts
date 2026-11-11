import { describe, expect, it } from 'vitest';
import { audit } from '../../server/audit.ts';
import { mulberry32 } from '../../server/provider.ts';
import { BASE_ITEMS } from '../../src/shared/content/items.ts';
import type { ApiError, MarketActionRes, MarketRes } from '../../src/shared/protocol.ts';
import { RAWS } from '../../src/shared/vocab.ts';
import { DAY, world } from './helpers.ts';

const [A, B, C] = BASE_ITEMS.map((i) => i.id);
type W = ReturnType<typeof world>;

/** Total marks and raws held by all players. */
const totals = (w: W) =>
  w.db.prepare('SELECT COALESCE(SUM(marks), 0) AS marks, COALESCE(SUM(timber), 0) AS timber, COALESCE(SUM(ore), 0) AS ore, COALESCE(SUM(hide), 0) AS hide FROM players').get() as Record<string, number>;

/** A player with marks and raws, earned through a run. */
async function trader(w: W, runs = 10) {
  const token = await w.player(runs);
  await w.run(token, { wavesCleared: 12, won: true, scripEarned: 3000, scripHeld: 1000, raws: { timber: 50, ore: 50, hide: 50 } });
  w.fund(token, 200, 100);
  return token;
}

describe('market', () => {
  it('always quotes every raw, even in an empty world', async () => {
    const w = world();
    const { status, body } = await w.get<MarketRes>('/api/market', await w.player());
    expect(status).toBe(200);
    expect(body.open).toBe(true);
    expect(body.listings).toEqual([]);
    for (const raw of RAWS) {
      const q = body.factor[raw];
      expect(q.sell).toBeGreaterThanOrEqual(1);
      expect(q.buy).toBeGreaterThanOrEqual(q.sell * 3); // sells near double, buys near half
      expect(q.buyLeft).toBeGreaterThan(0);
      expect(q.sellLeft).toBeGreaterThan(0);
    }
  });

  it('lets a new account sell to the Factor at once, at the quoted price', async () => {
    const w = world();
    const token = await w.player();
    await w.run(token, { wavesCleared: 3, raws: { timber: 40, ore: 0, hide: 0 }, scripHeld: 0 }); // keeps 12
    const before = await w.me(token);
    const quote = (await w.get<MarketRes>('/api/market', token)).body.factor.timber;
    const res = await w.post<MarketActionRes>('/api/market/factor', token, { raw: 'timber', side: 'sell', qty: 10, idem: 'sell-0001' });
    expect(res.status).toBe(200);
    expect(res.body.profile.raws.timber).toBe(before.raws.timber - 10);
    expect(res.body.profile.marks).toBe(before.marks + 10 * quote.sell);
    expect(res.body.market.factor.timber.sellLeft).toBe(quote.sellLeft - 10);

    const short = await w.post<ApiError>('/api/market/factor', token, { raw: 'timber', side: 'sell', qty: 50, idem: 'sell-0002' });
    expect([short.status, short.body.code]).toEqual([400, 'no_raws']);
    const poor = await w.post<ApiError>('/api/market/factor', token, { raw: 'ore', side: 'buy', qty: 100, idem: 'buy-00001' });
    expect([poor.status, poor.body.code]).toEqual([400, 'no_marks']);
    expect(audit(w.db).ok).toBe(true);
  });

  it('applies a trade once per idempotency key', async () => {
    const w = world();
    const token = await trader(w);
    const before = await w.me(token);
    const body = { raw: 'ore', side: 'sell', qty: 5, idem: 'retry-me-1' };
    const first = await w.post<MarketActionRes>('/api/market/factor', token, body);
    const second = await w.post<MarketActionRes>('/api/market/factor', token, body);
    const third = await w.post<MarketActionRes>('/api/market/factor', token, body);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(third.body).toEqual(first.body);
    expect((await w.me(token)).raws.ore).toBe(before.raws.ore - 5);
    expect((w.db.prepare(`SELECT COUNT(*) AS n FROM ledger WHERE kind = 'factor_sell'`).get() as { n: number }).n).toBe(1);

    // The same key with a different body is refused, not applied.
    const reused = await w.post<ApiError>('/api/market/factor', token, { ...body, qty: 50 });
    expect([reused.status, reused.body.code]).toEqual([409, 'idem_reuse']);
    // Another player may use the same key.
    const other = await trader(w);
    expect((await w.post('/api/market/factor', other, body)).status).toBe(200);
    expect((await w.me(token)).raws.ore).toBe(before.raws.ore - 5);

    // Listings and purchases are idempotent too.
    const [item] = await w.grant(token, [A]);
    const list = { uid: item.uid, price: 40, idem: 'list-key-1' };
    const l1 = await w.post<MarketActionRes>('/api/market/list', token, list);
    const l2 = await w.post<MarketActionRes>('/api/market/list', token, list);
    expect(l2.body).toEqual(l1.body);
    expect(l1.body.market.listings.length).toBe(1);
    const marks = (await w.me(other)).marks;
    const buy = { listingId: l1.body.market.listings[0].id, idem: 'buy-key-01' };
    const b1 = await w.post<MarketActionRes>('/api/market/buy', other, buy);
    const b2 = await w.post<MarketActionRes>('/api/market/buy', other, buy);
    expect(b1.status).toBe(200);
    expect(b2.body).toEqual(b1.body);
    expect((await w.me(other)).marks).toBe(marks - 40);
    expect((await w.me(other)).items.length).toBe(1);
    expect(audit(w.db).ok).toBe(true);
  });

  it('moves the reference with net volume, limits daily volume, and never pays for a round trip', async () => {
    const w = world();
    const token = await trader(w);
    const q0 = (await w.get<MarketRes>('/api/market', token)).body.factor.hide;
    const start = await w.me(token);

    let n = 0;
    const trade = (side: string, qty: number) => w.post<any>('/api/market/factor', token, { raw: 'hide', side, qty, idem: `round-${n++}-x` });
    for (let i = 0; i < 2; i++) expect((await trade('buy', 10)).status).toBe(200);
    const up = (await w.get<MarketRes>('/api/market', token)).body.factor.hide;
    expect(up.buy).toBeGreaterThan(q0.buy);
    expect(up.buyLeft).toBe(q0.buyLeft - 20);
    for (let i = 0; i < 2; i++) expect((await trade('sell', 10)).status).toBe(200);
    const end = await w.me(token);
    expect(end.raws.hide).toBe(start.raws.hide);
    expect(end.marks).toBeLessThan(start.marks);

    // The Factor's book is finite per side per day, and refills the next day.
    const left = (await w.get<MarketRes>('/api/market', token)).body.factor.hide.sellLeft;
    w.db.prepare(`UPDATE factor_day SET sold = sold + ? WHERE raw = 'hide'`).run(left - 3);
    const full = await trade('sell', 4);
    expect([full.status, full.body.code]).toEqual([400, 'factor_limit']);
    expect((await trade('sell', 3)).status).toBe(200);
    w.advance(DAY);
    const next = (await w.get<MarketRes>('/api/market', token)).body.factor.hide;
    expect(next.sellLeft).toBeGreaterThan(100);
    expect(next.buyLeft).toBe(next.sellLeft);
    expect(audit(w.db).ok).toBe(true);
  });

  it('gates listings behind ten runs', async () => {
    const w = world();
    const token = await w.player(7);
    const [item] = await w.grant(token, [A]); // eight runs
    await w.run(token, { wavesCleared: 12, won: true, scripHeld: 500, scripEarned: 500 }); // nine runs
    const early = await w.post<ApiError>('/api/market/list', token, { uid: item.uid, price: 30, idem: 'gate-key-1' });
    expect([early.status, early.body.code]).toEqual([403, 'listing_locked']);
    expect((await w.me(token)).items.length).toBe(1);

    await w.run(token); // ten runs
    const ok = await w.post<MarketActionRes>('/api/market/list', token, { uid: item.uid, price: 30, idem: 'gate-key-2' });
    expect(ok.status).toBe(200);
    expect(ok.body.profile.items).toEqual([]);
    expect(ok.body.market.listings[0]).toMatchObject({ price: 30, charges: 3, mine: true, seller: ok.body.profile.name });
  });

  it('charges a 2% listing fee and a 5% sale tax, and destroys both', async () => {
    const w = world();
    const seller = await trader(w);
    const buyer = await trader(w);
    const [item] = await w.grant(seller, [A]);
    const s0 = await w.me(seller);
    const b0 = await w.me(buyer);
    const t0 = totals(w);

    const listed = await w.post<MarketActionRes>('/api/market/list', seller, { uid: item.uid, price: 200, idem: 'fee-key-01' });
    expect(listed.body.profile.marks).toBe(s0.marks - 4);
    const id = listed.body.market.listings[0].id;

    const own = await w.post<ApiError>('/api/market/buy', seller, { listingId: id, idem: 'own-key-01' });
    expect(own.body.code).toBe('own_listing');

    const bought = await w.post<MarketActionRes>('/api/market/buy', buyer, { listingId: id, idem: 'tax-key-01' });
    expect(bought.status).toBe(200);
    expect(bought.body.profile.marks).toBe(b0.marks - 200);
    expect(bought.body.profile.items.map((s) => [s.item.id, s.charges])).toEqual([[A, 3]]);
    expect(bought.body.market.listings).toEqual([]);
    expect((await w.me(seller)).marks).toBe(s0.marks - 4 + 200 - 10);
    expect(totals(w).marks).toBe(t0.marks - 4 - 10);

    const gone = await w.post<ApiError>('/api/market/buy', buyer, { listingId: id, idem: 'tax-key-02' });
    expect([gone.status, gone.body.code]).toEqual([409, 'listing_gone']);
    expect(audit(w.db).ok).toBe(true);
  });

  it('cancels a listing back to the stash and salvages an item for a few marks', async () => {
    const w = world();
    const token = await trader(w);
    const other = await trader(w);
    const [item, spare] = await w.grant(token, [A, B]);
    const listed = await w.post<MarketActionRes>('/api/market/list', token, { uid: item.uid, price: 50, idem: 'cancel-k-1' });
    const id = listed.body.market.listings[0].id;

    expect((await w.post<ApiError>('/api/market/cancel', other, { listingId: id })).body.code).toBe('listing_gone');
    const back = await w.post<MarketActionRes>('/api/market/cancel', token, { listingId: id });
    expect(back.status).toBe(200);
    expect(back.body.market.listings).toEqual([]);
    expect(back.body.profile.items.map((s) => s.item.id).sort()).toEqual([A, B].sort());
    expect((await w.post<ApiError>('/api/market/cancel', token, { listingId: id })).body.code).toBe('listing_gone');

    const marks = back.body.profile.marks;
    expect((await w.post<ApiError>('/api/market/salvage', other, { uid: spare.uid })).body.code).toBe('not_owned');
    const scrapped = await w.post<MarketActionRes>('/api/market/salvage', token, { uid: spare.uid });
    expect(scrapped.body.profile.items.length).toBe(1);
    expect(scrapped.body.profile.marks).toBeGreaterThan(marks);
    expect(scrapped.body.profile.marks).toBeLessThanOrEqual(marks + 10);
    expect((await w.post<ApiError>('/api/market/salvage', token, { uid: spare.uid })).body.code).toBe('not_owned');
    expect(audit(w.db).ok).toBe(true);
  });

  it('closes trading with MARKET_OPEN=0 but still lets players take listings down', async () => {
    const db = world().db;
    const open = world({ db });
    const token = await trader(open);
    const [item, second] = await open.grant(token, [A, B]);
    const listed = await open.post<MarketActionRes>('/api/market/list', token, { uid: item.uid, price: 50, idem: 'closed-k-1' });

    const closed = world({ db, marketOpen: false });
    const view = (await closed.get<MarketRes>('/api/market', token)).body;
    expect(view.open).toBe(false);
    expect(view.factor.timber.buy).toBeGreaterThan(0);
    for (const [path, body] of [
      ['/api/market/factor', { raw: 'timber', side: 'sell', qty: 1, idem: 'closed-k-2' }],
      ['/api/market/list', { uid: second.uid, price: 9, idem: 'closed-k-3' }],
      ['/api/market/buy', { listingId: listed.body.market.listings[0].id, idem: 'closed-k-4' }],
    ] as const) {
      const res = await closed.post<ApiError>(path, token, body);
      expect([res.status, res.body.code]).toEqual([503, 'market_closed']);
      expect(res.body.error).toMatch(/^Trading is closed/);
    }
    expect((await closed.post('/api/market/cancel', token, { listingId: listed.body.market.listings[0].id })).status).toBe(200);
    expect((await closed.me(token)).items.length).toBe(2);
  });

  it('conserves marks and raws across a random sequence of trades, per the ledger', async () => {
    const w = world();
    const rnd = mulberry32(20261111);
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
    const tokens: string[] = [];
    for (let i = 0; i < 4; i++) {
      const t = await trader(w, 10);
      await w.grant(t, [A, B, C, A, B, C]);
      tokens.push(t);
    }

    let applied = 0;
    const keys: { path: string; token: string; body: object }[] = [];
    for (let step = 0; step < 400; step++) {
      const token = pick(tokens);
      const roll = rnd();
      let path = '/api/market/factor';
      let body: Record<string, unknown>;
      if (roll < 0.45) {
        body = { raw: pick(RAWS), side: pick(['buy', 'sell']), qty: 1 + Math.floor(rnd() * 40), idem: `rand-${step}-key` };
      } else if (roll < 0.6) {
        const items = (await w.me(token)).items;
        path = '/api/market/list';
        body = { uid: items.length ? pick(items).uid : 'none', price: 1 + Math.floor(rnd() * 150), idem: `rand-${step}-key` };
      } else if (roll < 0.75) {
        const listings = (await w.get<MarketRes>('/api/market', token)).body.listings;
        path = '/api/market/buy';
        body = { listingId: listings.length ? pick(listings).id : 'none', idem: `rand-${step}-key` };
      } else if (roll < 0.8) {
        const mine = (await w.get<MarketRes>('/api/market', token)).body.listings.filter((l) => l.mine);
        path = '/api/market/cancel';
        body = { listingId: mine.length ? pick(mine).id : 'none' };
      } else if (roll < 0.85) {
        const items = (await w.me(token)).items;
        path = '/api/market/salvage';
        body = { uid: items.length ? pick(items).uid : 'none' };
      } else if (roll < 0.93) {
        path = '/api/town/give';
        body = { raws: { [pick(RAWS)]: 1 + Math.floor(rnd() * 20) } };
      } else if (keys.length) {
        // Replay an earlier request that carried an idempotency key.
        const old = pick(keys);
        const before = totals(w);
        const res = await w.post(old.path, old.token, old.body);
        expect(res.status).toBe(200);
        expect(totals(w)).toEqual(before); // a replay moves nothing
        continue;
      } else continue;

      const before = totals(w);
      const res = await w.post(path, token, body);
      if (res.status === 200) {
        applied++;
        if ('idem' in body) keys.push({ path, token, body });
      } else {
        expect(res.body.code).toMatch(/^(no_marks|no_raws|not_owned|listing_gone|own_listing|factor_limit|not_needed|price_cap|transfer_cap)$/);
        expect(totals(w)).toEqual(before); // a refused request moves nothing
      }
      if (step % 50 === 0) expect(audit(w.db).mismatches).toEqual([]);
    }
    expect(applied).toBeGreaterThan(150);

    const result = audit(w.db);
    expect(result.mismatches).toEqual([]);
    // Every mark and raw in the world is accounted for by a faucet or sink row.
    const ledger = w.db.prepare('SELECT SUM(marks) AS marks, SUM(timber) AS timber, SUM(ore) AS ore, SUM(hide) AS hide FROM ledger WHERE player_id IS NOT NULL').get();
    expect(ledger).toEqual(totals(w));
    // No item was duplicated or lost: stash + open listings + salvaged = granted.
    const count = (sql: string) => (w.db.prepare(sql).get() as { n: number }).n;
    expect(count('SELECT COUNT(*) AS n FROM stash') + count(`SELECT COUNT(*) AS n FROM listings WHERE status = 'open'`) + count(`SELECT COUNT(*) AS n FROM ledger WHERE kind = 'salvage'`)).toBe(24);
    // Fees and tax only ever leave.
    expect(result.byKind.listing_fee.marks).toBeLessThan(0);
    expect(result.byKind.sale_tax.marks).toBeLessThan(0);
  });

  it('audit reports a balance that the ledger cannot explain', async () => {
    const w = world();
    const token = await trader(w);
    expect(audit(w.db).ok).toBe(true);
    w.db.prepare('UPDATE players SET marks = marks + 500 WHERE name = ?').run((await w.me(token)).name);
    const res = audit(w.db);
    expect(res.ok).toBe(false);
    expect(res.mismatches[0]).toMatch(/marks is \d+, ledger says \d+/);
  });
});
