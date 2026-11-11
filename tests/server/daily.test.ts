import { describe, expect, it } from 'vitest';
import { audit } from '../../server/audit.ts';
import type { ApiError, DailyRes, RunEndRes, RunStartRes } from '../../src/shared/protocol.ts';
import { DAY, report, world } from './helpers.ts';

const MIN = 60_000;

describe('daily clearing', () => {
  async function attempt(w: ReturnType<typeof world>, token: string, mode: 'daily' | 'practice', over: Parameters<typeof report>[1]) {
    const s = await w.post<RunStartRes>('/api/run/start', token, { mode, character: 'clerk', kit: ['ignored'] });
    w.advance(10 * MIN);
    const e = await w.post<RunEndRes>('/api/run/end', token, report(s.body.runId, over));
    if (e.status !== 200) throw new Error(JSON.stringify(e.body));
    return { start: s.body, end: e.body, status: e.status };
  }

  it('is locked until the fourth run is done', async () => {
    const w = world();
    const res = await w.post<ApiError>('/api/run/start', await w.player(3), { mode: 'daily', character: 'greenhorn', kit: [] });
    expect([res.status, res.body.code]).toEqual([403, 'locked']);
  });

  it('gives everyone the same seed and character, ignores kit, and changes with the date', async () => {
    const w = world();
    const [p1, p2] = [await w.player(4), await w.player(4)];
    const a = (await w.post<RunStartRes>('/api/run/start', p1, { mode: 'daily', character: 'greenhorn', kit: ['x'] })).body;
    const b = (await w.post<RunStartRes>('/api/run/start', p2, { mode: 'practice', character: 'smith', kit: [] })).body;
    expect(a).toMatchObject({ waves: 8, kit: [], seed: b.seed, character: b.character });
    const board = (await w.get<DailyRes>('/api/daily', p1)).body;
    expect(board).toMatchObject({ date: '2026-11-11', character: a.character, mine: null, players: 0, top: [] });

    w.advance(DAY);
    const c = (await w.post<RunStartRes>('/api/run/start', p1, { mode: 'daily', character: 'greenhorn', kit: [] })).body;
    expect(c.seed).not.toBe(a.seed);
    expect(c.character).not.toBe(a.character);
  });

  it('scores only the first daily of the day', async () => {
    const w = world();
    const token = await w.player(4);
    const first = await attempt(w, token, 'daily', { wavesCleared: 5, scripEarned: 300, scripHeld: 100, raws: { timber: 10, ore: 0, hide: 0 } });
    expect(first.end.daily).toEqual({ rank: 1, players: 1, scored: true });
    expect(first.end.gained.marks).toBe(10 + 15);
    const after = await w.me(token);
    expect(after).toMatchObject({ runs: 5, daysPlayed: 1 });

    // A better second try the same day changes nothing.
    const second = await attempt(w, token, 'daily', { wavesCleared: 8, won: true, scripEarned: 900, scripHeld: 500, raws: { timber: 30, ore: 0, hide: 0 } });
    expect(second.status).toBe(200);
    expect(second.end.daily).toMatchObject({ scored: false, players: 1 });
    expect(second.end.gained).toEqual({ raws: { timber: 0, ore: 0, hide: 0 }, marks: 0, items: [] });
    const practice = await attempt(w, token, 'practice', { wavesCleared: 8, won: true, scripEarned: 900 });
    expect(practice.end.daily!.scored).toBe(false);

    const board = (await w.get<DailyRes>('/api/daily', token)).body;
    expect(board.mine).toEqual({ waves: 5, scrip: 300, rank: 1 });
    expect(board.players).toBe(1);
    expect(await w.me(token)).toMatchObject({ runs: 5, marks: after.marks, raws: after.raws, daysPlayed: 1 });
    expect(audit(w.db).ok).toBe(true);
  });

  it('counts an abandoned first try as the scored one', async () => {
    const w = world();
    const token = await w.player(4);
    await w.post<RunStartRes>('/api/run/start', token, { mode: 'daily', character: 'greenhorn', kit: [] });
    const retry = await attempt(w, token, 'daily', { wavesCleared: 8, won: true, scripEarned: 900 });
    expect(retry.end.daily!.scored).toBe(false);
    expect((await w.get<DailyRes>('/api/daily', token)).body.mine).toBeNull();
  });

  it('ranks by waves, then scrip, and lists the top 20', async () => {
    const w = world();
    const scores: [number, number][] = [[5, 100], [8, 50], [5, 300], [2, 850]];
    const tokens: string[] = [];
    for (const [waves, scrip] of scores) {
      const t = await w.player(4);
      tokens.push(t);
      await attempt(w, t, 'daily', { wavesCleared: waves, won: waves === 8, scripEarned: scrip, scripHeld: 0 });
    }
    for (let i = 0; i < 20; i++) await attempt(w, await w.player(4), 'daily', { wavesCleared: 1, scripEarned: i, scripHeld: 0 });

    const board = (await w.get<DailyRes>('/api/daily', tokens[0])).body;
    expect(board.players).toBe(24);
    expect(board.top.length).toBe(20);
    expect(board.top.slice(0, 4).map((r) => [r.waves, r.scrip])).toEqual([[8, 50], [5, 300], [5, 100], [2, 850]]);
    expect(board.top[2].name).toBe((await w.me(tokens[0])).name);
    expect(board.mine).toEqual({ waves: 5, scrip: 100, rank: 3 });
    expect((await w.get<DailyRes>('/api/daily', tokens[3])).body.mine!.rank).toBe(4);

    // A new day starts an empty board and a new scored try.
    w.advance(DAY);
    expect((await w.get<DailyRes>('/api/daily', tokens[0])).body).toMatchObject({ mine: null, players: 0, top: [] });
    const next = await attempt(w, tokens[0], 'daily', { wavesCleared: 1 });
    expect(next.end.daily).toEqual({ rank: 1, players: 1, scored: true });
    expect((await w.me(tokens[0])).daysPlayed).toBe(2);
  });
});
