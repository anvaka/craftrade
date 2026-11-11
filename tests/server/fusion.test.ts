import { describe, expect, it, vi } from 'vitest';
import { ProceduralProvider, type FusionProvider } from '../../server/provider.ts';
import { BASE_ITEM, BASE_ITEMS } from '../../src/shared/content/items.ts';
import { cleanName, fusionBudget, itemPoints, type ItemSpec } from '../../src/shared/item.ts';
import type { ApiError, CodexRes, FuseRes, ItemsRes } from '../../src/shared/protocol.ts';
import { GLYPHS, PRIM } from '../../src/shared/vocab.ts';
import { DAY, basePairs, world } from './helpers.ts';

const [A, B, C] = BASE_ITEMS.map((i) => i.id);
const fake = (propose: FusionProvider['propose'], llm = true): FusionProvider => ({ llm, model: 'fake', propose });
const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

function expectLegal(item: ItemSpec, budget: number) {
  expect(cleanName(item.name)).toBe(item.name);
  expect(GLYPHS).toContain(item.glyph);
  for (const t of item.tags) expect(t).toMatch(/^[a-z]{2,12}$/);
  const pos = item.effects.filter((e) => !e.neg);
  const neg = item.effects.filter((e) => e.neg);
  expect(pos.length).toBeGreaterThanOrEqual(1);
  expect(pos.length).toBeLessThanOrEqual(3);
  expect(neg.length).toBeLessThanOrEqual(1);
  for (const e of item.effects) {
    expect(Object.hasOwn(PRIM, e.p)).toBe(true);
    expect([1, 2, 3, 4, 5]).toContain(e.l);
    if (e.neg) expect(PRIM[e.p].kind).toBe('stat');
  }
  expect(new Set(item.effects.map((e) => e.p)).size).toBe(item.effects.length);
  expect(itemPoints(item.effects)).toBeLessThanOrEqual(budget);
}

describe('fusion', () => {
  it('gives the same result for the same pair in any order, in any world', async () => {
    const one = world();
    const two = world();
    const p1 = await one.player(5);
    const p2 = await two.player(5);
    const r1 = (await one.post<FuseRes>('/api/fuse', p1, { a: A, b: B, ctx: 'run' })).body;
    const r2 = (await two.post<FuseRes>('/api/fuse', p2, { a: B, b: A, ctx: 'run' })).body;
    expect(r1.first).toBe(true);
    expect({ ...r1.item, by: '' }).toEqual({ ...r2.item, by: '' });
    expectLegal(r1.item, fusionBudget(BASE_ITEM[A], BASE_ITEM[B]));
    expect(r1.item.id).toMatch(/^f[0-9a-z]+$/);
  });

  it('makes a pair a permanent fact with the finder stamped on it', async () => {
    const w = world();
    const finder = await w.player(5);
    const later = await w.player(5);
    const first = (await w.post<FuseRes>('/api/fuse', finder, { a: A, b: B, ctx: 'run' })).body;
    const again = (await w.post<FuseRes>('/api/fuse', finder, { a: A, b: B, ctx: 'run' })).body;
    const other = (await w.post<FuseRes>('/api/fuse', later, { a: B, b: A, ctx: 'run' })).body;
    const finderName = (await w.me(finder)).name;

    expect(first).toMatchObject({ first: true, newToYou: true, by: finderName });
    expect(again).toMatchObject({ first: false, newToYou: false });
    expect(other).toMatchObject({ first: false, newToYou: true, by: finderName });
    expect(other.item).toEqual(first.item);
    expect(other.item.by).toBe(finderName);
    expect((await w.me(finder)).finds).toBe(1);
    expect((await w.me(finder)).novelLeft).toBe(19);
    expect((await w.me(later)).novelLeft).toBe(20);

    const looked = (await w.get<ItemsRes>(`/api/items?ids=${first.item.id},${A},nope`, later)).body.items;
    expect(looked.map((i) => i.id)).toEqual([first.item.id, A]);
  });

  it('stores levels, not numbers', async () => {
    const w = world();
    const token = await w.player(5);
    await w.post('/api/fuse', token, { a: A, b: B, ctx: 'run' });
    const row = w.db.prepare('SELECT effects FROM items').get() as { effects: string };
    for (const e of JSON.parse(row.effects)) {
      expect(Object.keys(e).every((k) => ['p', 'l', 'neg'].includes(k))).toBe(true);
    }
    const recipe = w.db.prepare('SELECT * FROM recipes').get() as Record<string, unknown>;
    expect(recipe.key).toBe(`1:${A < B ? `${A}+${B}` : `${B}+${A}`}`);
    expect(recipe.model).toBe('procedural-1');
  });

  it('resolves a race on an untried pair to one result and one finder', async () => {
    let calls = 0;
    const inner = new ProceduralProvider();
    const slow = fake(async (a, b, budget, key) => {
      calls++;
      await new Promise((r) => setTimeout(r, 30));
      return inner.propose(a, b, budget, key);
    });
    const w = world({ provider: slow });
    const tokens = await Promise.all([w.player(5), w.player(5), w.player(5)]);
    const results = await Promise.all(tokens.map((t) => w.post<FuseRes>('/api/fuse', t, { a: A, b: B, ctx: 'run' })));

    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(new Set(results.map((r) => r.body.item.id)).size).toBe(1);
    expect(results.filter((r) => r.body.first).length).toBe(1);
    expect(new Set(results.map((r) => r.body.by)).size).toBe(1);
    expect(calls).toBe(1);
    expect((w.db.prepare('SELECT COUNT(*) AS n FROM recipes').get() as { n: number }).n).toBe(1);
    expect((w.db.prepare('SELECT COUNT(*) AS n FROM items').get() as { n: number }).n).toBe(1);
    // Only the finder pays for the untried pair.
    const left = await Promise.all(tokens.map(async (t) => (await w.me(t)).novelLeft));
    expect(left.sort()).toEqual([19, 20, 20]);
  });

  it('rejects junk from the model with nothing stored or spent', async () => {
    const warn = quiet();
    const junk: unknown[] = [
      null, 'DROP TABLE items', 42, [], {}, { effects: 'all of them' },
      { names: ['<script>'], glyph: 'skull', tags: [1], effects: [{ p: 'godmode', l: 99 }, { p: '__proto__', l: 1 }, null] },
      { names: ['Fine name'], effects: [{ p: 'speed', l: 2, neg: true }] }, // a drawback and nothing else
    ];
    for (const answer of junk) {
      let calls = 0;
      const w = world({ provider: fake(async () => { calls++; return answer; }) });
      const token = await w.player(5);
      const res = await w.post<ApiError>('/api/fuse', token, { a: A, b: B, ctx: 'run' });
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('model_down');
      expect(calls).toBe(2); // one retry
      expect((w.db.prepare('SELECT COUNT(*) AS n FROM recipes').get() as { n: number }).n).toBe(0);
      expect((await w.me(token)).novelLeft).toBe(20);
    }
    warn.mockRestore();
  });

  it('repairs half-valid model output into a legal item', async () => {
    const answer = {
      names: ['Eldritch Soulblade of Doom!!', 42, 'x', 'A'.repeat(50), 'whetstone', 'GREASED   hone'],
      glyph: 'skull',
      tags: ['Stone', 'has space', 5, 'waytoolongtagname', 'grit'],
      effects: [
        { p: 'damage', l: 999 }, { p: 'damage', l: 2 }, { p: 'godmode', l: 1 }, null, 'burn',
        { p: 'burn', l: -4 }, { p: 'crit', l: '3' }, { p: 'luck', l: 5 },
        { p: 'thorns', l: 1, neg: true }, { p: 'speed', l: 5, neg: true }, { p: 'armor', l: 1, neg: true },
      ],
      extra: { nested: true },
    };
    const w = world({ provider: fake(async () => answer) });
    const token = await w.player(5);
    const res = await w.post<FuseRes>('/api/fuse', token, { a: A, b: B, ctx: 'run' });
    expect(res.status).toBe(200);
    const item = res.body.item;
    expectLegal(item, fusionBudget(BASE_ITEM[A], BASE_ITEM[B]));
    expect(item.name).toBe('Greased hone'); // the blocked, malformed and taken candidates were skipped
    expect(item.tags).toEqual(['stone', 'grit']);
    expect(item.effects.filter((e) => !e.neg).map((e) => e.p).sort()).toEqual(['burn', 'crit', 'damage']);
    expect(item.effects.find((e) => e.neg)).toMatchObject({ p: 'speed', neg: true });
  });

  it('falls back to a procedural name when every candidate is taken or invalid', async () => {
    const effects = [[{ p: 'crit', l: 1 }], [{ p: 'burn', l: 1 }], [{ p: 'luck', l: 1 }]];
    let n = 0;
    const w = world({ provider: fake(async () => ({ names: ['Greased hone', BASE_ITEMS[0].name, 'Shadow thing'], glyph: 'stone', tags: [], effects: effects[n++] })) });
    const token = await w.player(5);
    const names: string[] = [];
    for (const [a, b] of [[A, B], [A, C], [B, C]]) {
      const res = await w.post<FuseRes>('/api/fuse', token, { a, b, ctx: 'run' });
      expect(res.status).toBe(200);
      names.push(res.body.item.name);
    }
    expect(names[0]).toBe('Greased hone');
    expect(new Set(names.map((s) => s.toLowerCase())).size).toBe(3);
    for (const name of names) {
      expect(cleanName(name)).toBe(name);
      expect(BASE_ITEMS.some((i) => i.name.toLowerCase() === name.toLowerCase())).toBe(false);
    }
  });

  it('returns model_down and consumes nothing when the model fails or hangs', async () => {
    const warn = quiet();
    const down = fake(async () => { throw new Error('connect ETIMEDOUT'); });
    const hang = fake(() => new Promise(() => {}));
    for (const provider of [down, hang]) {
      const w = world({ provider: new ProceduralProvider() });
      const token = await w.player(5);
      const stash = await w.grant(token, [A, B, C]);
      w.fund(token, 500, 100);
      const known = (await w.post<FuseRes>('/api/fuse', token, { a: A, b: B, ctx: 'run' })).body;

      // Same database, model now unreachable.
      const broken = world({ db: w.db, provider, modelTimeoutMs: 40 });
      const uid = (id: string) => stash.find((s) => s.item.id === id)!.uid;
      const res = await broken.post<ApiError>('/api/fuse', token, { a: A, b: C, ctx: 'town', uidA: uid(A), uidB: uid(C) });
      expect(res.status).toBe(503);
      expect(res.body.code).toBe('model_down');
      const after = await broken.me(token);
      expect(after.items.map((s) => s.uid).sort()).toEqual(stash.map((s) => s.uid).sort());
      expect(after.novelLeft).toBe(19);

      // Known recipes still work.
      const again = await broken.post<FuseRes>('/api/fuse', token, { a: A, b: B, ctx: 'town', uidA: uid(A), uidB: uid(B) });
      expect(again.status).toBe(200);
      expect(again.body.item).toEqual(known.item);
    }
    warn.mockRestore();
  });

  it('in town, consumes the two stash items and adds the result', async () => {
    const w = world();
    const token = await w.player(5);
    const thief = await w.player(5);
    const stash = await w.grant(token, [A, B]);
    w.fund(token, 500, 100);
    const [ua, ub] = [stash.find((s) => s.item.id === A)!.uid, stash.find((s) => s.item.id === B)!.uid];

    for (const body of [
      { a: A, b: B, ctx: 'town' }, // no uids
      { a: A, b: B, ctx: 'town', uidA: ua, uidB: ua }, // the same one twice
      { a: A, b: B, ctx: 'town', uidA: ub, uidB: ua }, // uids do not match the items
    ]) {
      const res = await w.post<ApiError>('/api/fuse', token, body);
      expect([res.status, res.body.code]).toEqual([400, 'not_owned']);
    }
    const stolen = await w.post<ApiError>('/api/fuse', thief, { a: A, b: B, ctx: 'town', uidA: ua, uidB: ub });
    expect(stolen.body.code).toBe('not_owned');
    expect((await w.me(token)).items.length).toBe(2);

    const res = await w.post<FuseRes>('/api/fuse', token, { a: A, b: B, ctx: 'town', uidA: ua, uidB: ub });
    expect(res.status).toBe(200);
    expect(res.body.profile!.items).toEqual([{ uid: expect.any(String), item: res.body.item, charges: 3, repairs: 0 }]);

    // The result can be fused onward from the stash.
    const more = await w.grant(token, [C]);
    const next = await w.post<FuseRes>('/api/fuse', token, {
      a: res.body.item.id, b: C, ctx: 'town',
      uidA: more.find((s) => s.item.id === res.body.item.id)!.uid, uidB: more.find((s) => s.item.id === C)!.uid,
    });
    expect(next.status).toBe(200);
    expect(next.body.profile!.items.length).toBe(1);
  });

  it('refuses unknown items, identical items and tier 4 inputs', async () => {
    const w = world();
    const token = await w.player(5);
    const unknown = await w.post<ApiError>('/api/fuse', token, { a: A, b: 'fzzzzzz', ctx: 'run' });
    expect([unknown.status, unknown.body.code]).toEqual([404, 'unknown_item']);
    const same = await w.post<ApiError>('/api/fuse', token, { a: A, b: A, ctx: 'run' });
    expect([same.status, same.body.code]).toEqual([400, 'blocked']);

    w.db.prepare(`INSERT INTO items (id, name, glyph, tags, effects, finder, created) VALUES ('fbig', 'Big thing', 'stone', '[]', ?, 1, 0)`)
      .run(JSON.stringify([{ p: 'damage', l: 5 }, { p: 'crit', l: 5 }]));
    const done = await w.post<ApiError>('/api/fuse', token, { a: A, b: 'fbig', ctx: 'run' });
    expect([done.status, done.body.code]).toEqual([400, 'blocked']);
  });

  it('allows 20 untried pairs a day, more with the Assay Office, and unlimited known ones', async () => {
    const pairs = basePairs();
    expect(pairs.length).toBeGreaterThan(26);
    const w = world();
    const token = await w.player(5);
    for (const [a, b] of pairs.slice(0, 20)) {
      expect((await w.post('/api/fuse', token, { a, b, ctx: 'run' })).status).toBe(200);
    }
    expect((await w.me(token)).novelLeft).toBe(0);
    const [a, b] = pairs[20];
    const over = await w.post<ApiError>('/api/fuse', token, { a, b, ctx: 'run' });
    expect([over.status, over.body.code]).toEqual([429, 'novel_limit']);
    expect((w.db.prepare('SELECT COUNT(*) AS n FROM recipes').get() as { n: number }).n).toBe(20);

    // Known pairs are free, for this player and for others.
    expect((await w.post('/api/fuse', token, { a: pairs[3][0], b: pairs[3][1], ctx: 'run' })).status).toBe(200);
    const other = await w.player(5);
    expect((await w.post<FuseRes>('/api/fuse', other, { a, b, ctx: 'run' })).body.first).toBe(true);
    expect((await w.post<FuseRes>('/api/fuse', token, { a, b, ctx: 'run' })).body.first).toBe(false);

    // Each Assay Office tier adds five.
    w.db.prepare(`UPDATE stations SET tier = 2 WHERE id = 'assay'`).run();
    expect((await w.me(token)).novelLeft).toBe(5);
    for (const [x, y] of pairs.slice(21, 26)) expect((await w.post('/api/fuse', token, { a: x, b: y, ctx: 'run' })).status).toBe(200);
    expect((await w.post<ApiError>('/api/fuse', token, { a: pairs[26][0], b: pairs[26][1], ctx: 'run' })).body.code).toBe('novel_limit');

    // A new day resets the count.
    w.advance(DAY);
    expect((await w.me(token)).novelLeft).toBe(25);
  });

  it('cannot overdraw the allowance with simultaneous requests', async () => {
    const inner = new ProceduralProvider();
    const slow = fake(async (a, b, budget, key) => {
      await new Promise((r) => setTimeout(r, 10));
      return inner.propose(a, b, budget, key);
    });
    const w = world({ provider: slow });
    const token = await w.player(5);
    const results = await Promise.all(basePairs().slice(0, 27).map(([a, b]) => w.post('/api/fuse', token, { a, b, ctx: 'run' })));
    expect(results.filter((r) => r.status === 200).length).toBe(20);
    expect(results.filter((r) => r.body.code === 'novel_limit').length).toBe(7);
    expect((await w.me(token)).novelLeft).toBe(0);
  });

  it('lists what a player knows in the codex, plus recent world finds', async () => {
    const w = world();
    const mine = await w.player(5);
    const theirs = await w.player(5);
    const r1 = (await w.post<FuseRes>('/api/fuse', mine, { a: A, b: B, ctx: 'run' })).body;
    const r2 = (await w.post<FuseRes>('/api/fuse', theirs, { a: A, b: C, ctx: 'run' })).body;
    const codex = (await w.get<CodexRes>('/api/codex', mine)).body;
    expect(codex.worldRecipes).toBe(2);
    expect(codex.recipes.find((r) => r.out === r1.item.id)).toMatchObject({ mine: true, by: (await w.me(mine)).name });
    expect(codex.recipes.find((r) => r.out === r2.item.id)).toMatchObject({ mine: false, by: (await w.me(theirs)).name });
    expect(codex.items.map((i) => i.id)).toEqual(expect.arrayContaining([r1.item.id, r2.item.id, A, B, C]));
  });

  it('procedural results are legal across every authored pair', async () => {
    const provider = new ProceduralProvider();
    const { validatePick } = await import('../../server/provider.ts');
    const { recipeKey } = await import('../../src/shared/item.ts');
    for (const [a, b] of basePairs()) {
      const budget = fusionBudget(BASE_ITEM[a], BASE_ITEM[b]);
      const key = recipeKey(a, b);
      const fixed = validatePick(await provider.propose(BASE_ITEM[a], BASE_ITEM[b], budget, key), budget, key)!;
      expect(fixed.names.length).toBeGreaterThan(0);
      expectLegal({ id: 'x', name: fixed.names[0], glyph: fixed.glyph, tags: fixed.tags, effects: fixed.effects }, budget);
    }
    // 80 authored items make 3,160 pairs; the default 5 s is not enough on a loaded machine.
  }, 60000);
});
