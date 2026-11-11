import { describe, expect, it } from 'vitest';
import type { ApiError, HelloRes, NameRes } from '../../src/shared/protocol.ts';
import { world } from './helpers.ts';

describe('identity', () => {
  it('issues a token and a generated name, and keeps only a hash', async () => {
    const w = world();
    const { status, body } = await w.post<HelloRes>('/api/hello');
    expect(status).toBe(200);
    expect(body.token.length).toBeGreaterThanOrEqual(40);
    expect(body.profile.name).toMatch(/^[A-Z][a-z]+ \d{3,5}$/);
    expect(body.profile).toMatchObject({ marks: 0, runs: 0, characters: ['greenhorn'], features: [], novelLeft: 3, title: '', titles: [], stashUsed: 0, stashLimit: 24 });
    expect(body.stations).toEqual({ sawmill: 1, smelter: 1, tannery: 1, assay: 1 });
    expect(body.llm).toBe(false);

    const row = w.db.prepare('SELECT * FROM players').get() as Record<string, unknown>;
    expect(Object.values(row)).not.toContain(body.token);
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('recognises a returning device and makes a new one for an unknown token', async () => {
    const w = world();
    const first = (await w.post<HelloRes>('/api/hello')).body;
    const again = (await w.post<HelloRes>('/api/hello', first.token)).body;
    expect(again.token).toBe(first.token);
    expect(again.profile.name).toBe(first.profile.name);

    const stranger = (await w.post<HelloRes>('/api/hello', 'not-a-real-token')).body;
    expect(stranger.token).not.toBe('not-a-real-token');
    expect((w.db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number }).n).toBe(2);
  });

  it('refuses other endpoints without a known device, in the standard error shape', async () => {
    const w = world();
    for (const token of [undefined, 'bogus']) {
      const res = await w.get<ApiError>('/api/codex', token);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: expect.any(String), code: 'no_device' });
    }
    const missing = await w.get<ApiError>('/api/nope', await w.player());
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('not_found');
  });

  it('rerolls the name from the word list and never takes one from the client', async () => {
    const w = world();
    const token = await w.player();
    const before = (await w.me(token)).name;
    const res = await w.post<NameRes>('/api/name/reroll', token, { name: 'Typed By Player' });
    expect(res.body.profile.name).toMatch(/^[A-Z][a-z]+ \d{3,5}$/);
    expect(res.body.profile.name).not.toBe('Typed By Player');
    expect(res.body.profile.nameChangeAt).toBe(w.now() + 7 * 24 * 3600_000);

    // Once a week: finder stamps and boards follow the name, so it is not changed at will.
    const again = await w.post<ApiError>('/api/name/reroll', token);
    expect([again.status, again.body.code]).toEqual([429, 'name_wait']);
    expect((await w.me(token)).name).toBe(res.body.profile.name);
    w.advance(7 * 24 * 3600_000);
    expect((await w.post<NameRes>('/api/name/reroll', token)).status).toBe(200);
    expect(before).toMatch(/^[A-Z][a-z]+ \d{3,5}$/);
  });

  it('rejects malformed bodies with 400', async () => {
    const w = world();
    const token = await w.player();
    const res = await w.post<ApiError>('/api/fuse', token, { a: 'whetstone', b: 7, ctx: 'moon' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('bad_request');
    expect(res.body.error).not.toMatch(/!/);
  });

  it('rate limits mutating calls per device, and device creation per address', async () => {
    const w = world({ rateLimit: true });
    const token = await w.player();
    const codes: number[] = [];
    for (let i = 0; i < 60; i++) codes.push((await w.post('/api/almanac/title', token, { title: '' })).status);
    expect(codes.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(codes).toContain(429);
    // Reads are not limited.
    expect((await w.get('/api/daily', token)).status).toBe(200);
    // Time refills the bucket.
    w.advance(60_000);
    expect((await w.post('/api/almanac/title', token, { title: '' })).status).toBe(200);

    const made: number[] = [];
    for (let i = 0; i < 14; i++) made.push((await w.post('/api/hello')).status);
    expect(made.filter((s) => s === 200).length).toBeLessThanOrEqual(10);
    expect(made).toContain(429);
  });
});
