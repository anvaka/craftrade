import { describe, expect, it } from 'vitest';
import { audit } from '../../server/audit.ts';
import { BASE_ITEMS } from '../../src/shared/content/items.ts';
import type { ApiError, GiveRes, HelloRes, MarketActionRes, TownRes } from '../../src/shared/protocol.ts';
import { DAY, world } from './helpers.ts';

type W = ReturnType<typeof world>;
const rich = async (w: W, runs = 5) => {
  const token = await w.player(runs);
  for (let i = 0; i < 3; i++) await w.run(token, { wavesCleared: 12, won: true, raws: { timber: 150, ore: 150, hide: 150 }, scripHeld: 3000, scripEarned: 3000 });
  return token;
};

describe('town', () => {
  it('starts with one project sized so a lone player can finish it in a few runs', async () => {
    const w = world();
    const token = await w.player();
    const town = (await w.get<TownRes>('/api/town', token)).body;
    expect(town.stations).toEqual({ sawmill: 1, smelter: 1, tannery: 1, assay: 1 });
    expect(town.project).toEqual({ station: 'sawmill', toTier: 2, need: { timber: 60, ore: 20, hide: 20 }, have: { timber: 0, ore: 0, hide: 0 } });
    expect(town.activePlayers).toBe(1);
    expect(town.givers).toEqual([]);
  });

  it('is locked until the fifth run is done', async () => {
    const w = world();
    const token = await w.player(4);
    const res = await w.post<ApiError>('/api/town/give', token, { raws: { timber: 1 } });
    expect([res.status, res.body.code]).toEqual([403, 'locked']);
  });

  it('takes donations up to the need, adds standing, completes the project and starts the next', async () => {
    const w = world();
    const token = await rich(w);
    const before = await w.me(token);

    const part = await w.post<GiveRes>('/api/town/give', token, { raws: { timber: 500, ore: 5 } });
    expect(part.status).toBe(200);
    expect(part.body.town.project!.have).toEqual({ timber: 60, ore: 5, hide: 0 }); // only what was needed is taken
    expect(part.body.profile.raws).toEqual({ timber: before.raws.timber - 60, ore: before.raws.ore - 5, hide: before.raws.hide });
    expect(part.body.profile.standing).toBe(65);
    expect(part.body.town.givers).toEqual([{ name: before.name, given: 65 }]);

    const full = await w.post<ApiError>('/api/town/give', token, { raws: { timber: 10 } });
    expect([full.status, full.body.code]).toEqual([400, 'not_needed']);
    const broke = await w.post<ApiError>('/api/town/give', await w.player(5), { raws: { hide: 5 } });
    expect([broke.status, broke.body.code]).toEqual([400, 'no_raws']);
    expect((await w.get<TownRes>('/api/town', token)).body.project!.have.hide).toBe(0);

    const done = await w.post<GiveRes>('/api/town/give', token, { raws: { ore: 15, hide: 20 } });
    expect(done.body.town.stations).toEqual({ sawmill: 2, smelter: 1, tannery: 1, assay: 1 });
    expect(done.body.town.project).toMatchObject({ station: 'smelter', toTier: 2, have: { timber: 0, ore: 0, hide: 0 } });
    expect(done.body.profile.standing).toBe(100);
    expect((await w.post<HelloRes>('/api/hello', token)).body.stations.sawmill).toBe(2);
    expect(audit(w.db).ok).toBe(true);
  });

  it('cycles through the four stations, and the Assay Office raises the untried-pair allowance', async () => {
    const w = world();
    const token = await rich(w);
    const order: string[] = [];
    for (let i = 0; i < 5; i++) {
      const p = (await w.get<TownRes>('/api/town', token)).body.project!;
      order.push(`${p.station}:${p.toTier}`);
      const res = await w.post<GiveRes>('/api/town/give', token, { raws: p.need });
      expect(res.status).toBe(200);
    }
    expect(order).toEqual(['sawmill:2', 'smelter:2', 'tannery:2', 'assay:2', 'sawmill:3']);
    const p = await w.me(token);
    expect(p.novelLeft).toBe(25);
    const town = (await w.get<TownRes>('/api/town', token)).body;
    expect(town.stations).toEqual({ sawmill: 3, smelter: 2, tannery: 2, assay: 2 });
    // Later tiers ask for more.
    expect(town.project).toMatchObject({ station: 'smelter', toTier: 3, need: { timber: 40, ore: 120, hide: 40 } });
  });

  it('stops at tier 5 and has no project when every station is done', async () => {
    const w = world();
    const token = await rich(w);
    w.db.prepare(`UPDATE stations SET tier = 5 WHERE id != 'tannery'`).run();
    w.db.prepare(`UPDATE stations SET tier = 4 WHERE id = 'tannery'`).run();
    const p = (await w.get<TownRes>('/api/town', token)).body.project!;
    expect(p).toMatchObject({ station: 'tannery', toTier: 5 });
    const res = await w.post<GiveRes>('/api/town/give', token, { raws: p.need });
    expect(res.body.town.stations.tannery).toBe(5);
    expect(res.body.town.project).toBeNull();
    const none = await w.post<ApiError>('/api/town/give', token, { raws: { timber: 1 } });
    expect(none.body.code).toBe('no_project');
  });

  it('scales a new project with the players active in the last 7 days', async () => {
    const quiet = world();
    for (let i = 0; i < 9; i++) await quiet.player();
    quiet.advance(8 * DAY); // they all drift away
    const loner = await quiet.player();
    expect((await quiet.get<TownRes>('/api/town', loner)).body).toMatchObject({ activePlayers: 1, project: { need: { timber: 60 } } });

    const busy = world();
    let last = '';
    for (let i = 0; i < 10; i++) last = await busy.player();
    const town = (await busy.get<TownRes>('/api/town', last)).body;
    expect(town.activePlayers).toBe(10);
    expect(town.project!.need).toEqual({ timber: 300, ore: 100, hide: 100 });
  });

  it('counts a share of sale tax toward the project', async () => {
    const w = world();
    const seller = await rich(w);
    const buyer = await rich(w);
    const [item] = await w.grant(seller, [BASE_ITEMS[0].id]);
    const before = (await w.get<TownRes>('/api/town', seller)).body.project!;
    const listed = await w.post<MarketActionRes>('/api/market/list', seller, { uid: item.uid, price: 400, idem: 'tax-town-1' });
    await w.post('/api/market/buy', buyer, { listingId: listed.body.market.listings[0].id, idem: 'tax-town-2' });
    const after = (await w.get<TownRes>('/api/town', seller)).body.project!;
    const sum = (b: typeof after.have) => b.timber + b.ore + b.hide;
    expect(sum(after.have) - sum(before.have)).toBe(10); // tax is 20, half goes to the town
    expect((await w.me(seller)).standing).toBe(0);
    expect(audit(w.db).ok).toBe(true);
  });
});
