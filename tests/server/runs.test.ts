import { describe, expect, it } from 'vitest';
import { audit } from '../../server/audit.ts';
import { minDurationMs } from '../../server/runs.ts';
import { BASE_ITEMS } from '../../src/shared/content/items.ts';
import type { ApiError, FuseRes, RunEndRes, RunStartRes } from '../../src/shared/protocol.ts';
import { report, world } from './helpers.ts';

const [A, B, C] = BASE_ITEMS.map((i) => i.id);
const MIN = 60_000;

describe('runs', () => {
  it('issues a ticket and pays out a finished run', async () => {
    const w = world();
    const token = await w.player();
    const start = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
    expect(start.status).toBe(200);
    expect(start.body).toMatchObject({ waves: 12, character: 'greenhorn', kit: [], stations: { sawmill: 1 } });
    expect(Number.isInteger(start.body.seed)).toBe(true);

    w.advance(15 * MIN);
    const end = await w.post<RunEndRes>('/api/run/end', token, report(start.body.runId, {
      wavesCleared: 12, won: true, scripEarned: 900, scripHeld: 137,
      raws: { timber: 10, ore: 7, hide: 3 }, mule: { timber: 5, ore: 0, hide: 2 }, carry: [A, B, C],
    }));
    expect(end.status).toBe(200);
    expect(end.body.gained.raws).toEqual({ timber: 15, ore: 7, hide: 5 });
    expect(end.body.gained.marks).toBe(13 + 3 * 12); // 1 per 10 scrip held, plus the per-wave payout
    expect(end.body.gained.items.map((i) => i.id)).toEqual([A, B, C]);
    expect(end.body.profile).toMatchObject({ runs: 1, wins: 1, marks: 49, raws: { timber: 15, ore: 7, hide: 5 } });
    expect(end.body.profile.items.every((s) => s.charges === 3)).toBe(true);
    expect(end.body.unlockedFeature).toBe('workshop');
    expect(end.body.daily).toBeUndefined();
    expect(audit(w.db).ok).toBe(true);
  });

  it('applies the 30% death cut to held raws and keeps mule loads whole', async () => {
    const w = world();
    const token = await w.player();
    const r = await w.run(token, { wavesCleared: 5, won: false, raws: { timber: 10, ore: 9, hide: 1 }, mule: { timber: 4, ore: 0, hide: 0 }, scripHeld: 9 });
    expect(r.end.gained.raws).toEqual({ timber: 3 + 4, ore: 2, hide: 0 });
    expect(r.end.gained.marks).toBe(15);
    expect(r.end.profile).toMatchObject({ runs: 1, wins: 0 });
  });

  it('rejects forged reports and pays nothing for them', async () => {
    const w = world();
    const token = await w.player();
    const other = await w.player();
    const fused = (await w.post<FuseRes>('/api/fuse', token, { a: A, b: B, ctx: 'run' })).body.item.id;

    const forge = async (over: Parameters<typeof report>[1], wait = 15 * MIN) => {
      const s = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
      w.advance(wait);
      const e = await w.post<ApiError>('/api/run/end', token, report(s.body.runId, over));
      return [e.status, e.body.code];
    };

    // Too fast: twelve waves cannot be over in a minute, nor eight in two.
    expect(await forge({ wavesCleared: 12, won: true }, MIN)).toEqual([400, 'too_fast']);
    expect(await forge({ wavesCleared: 8 }, 2 * MIN)).toEqual([400, 'too_fast']);
    // Too many raws for the waves played, held or on the mule.
    expect(await forge({ wavesCleared: 3, raws: { timber: 400, ore: 0, hide: 0 } })).toEqual([400, 'too_many_raws']);
    expect(await forge({ wavesCleared: 3, raws: { timber: 130, ore: 130, hide: 130 } })).toEqual([400, 'too_many_raws']);
    expect(await forge({ wavesCleared: 3, mule: { timber: 5, ore: 0, hide: 0 } })).toEqual([400, 'too_many_raws']);
    // Carry: over the limit, unknown, known but not made in this run, made by a recipe that does not exist.
    expect(await forge({ wavesCleared: 7, carry: [A, B] })).toEqual([400, 'bad_carry']);
    expect(await forge({ wavesCleared: 3, carry: [A] })).toEqual([400, 'bad_carry']);
    expect(await forge({ wavesCleared: 8, carry: ['fnotreal'] })).toEqual([400, 'bad_carry']);
    expect(await forge({ wavesCleared: 8, carry: [fused] })).toEqual([400, 'bad_carry']);
    expect(await forge({ wavesCleared: 8, carry: [fused], fusions: [[A, C, fused]] })).toEqual([400, 'bad_carry']);
    expect(await forge({ wavesCleared: 8, carry: [fused, fused], fusions: [[A, B, fused]] })).toEqual([400, 'bad_carry']);
    // Result and scrip that do not fit the waves.
    expect(await forge({ wavesCleared: 5, won: true })).toEqual([400, 'bad_report']);
    expect(await forge({ wavesCleared: 12, won: false })).toEqual([400, 'bad_report']);
    expect(await forge({ wavesCleared: 2, scripHeld: 50_000 })).toEqual([400, 'bad_report']);
    expect(await forge({ wavesCleared: 13 })).toEqual([400, 'bad_request']);
    expect(await forge({ wavesCleared: 2, raws: { timber: -5, ore: 0, hide: 0 } })).toEqual([400, 'bad_request']);

    // Someone else's ticket, and a ticket that does not exist.
    const s = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
    w.advance(15 * MIN);
    const stolen = await w.post<ApiError>('/api/run/end', other, report(s.body.runId));
    expect([stolen.status, stolen.body.code]).toEqual([404, 'unknown_run']);
    expect((await w.post<ApiError>('/api/run/end', token, report('nope'))).body.code).toBe('unknown_run');

    // Nothing above paid out or counted as a run.
    expect(await w.me(token)).toMatchObject({ runs: 0, marks: 0, raws: { timber: 0, ore: 0, hide: 0 }, items: [] });

    // The honest version of the carried fusion is accepted: the server answered it for this run.
    expect((await w.post<FuseRes>('/api/fuse', token, { a: B, b: A, ctx: 'run', runId: s.body.runId })).body.item.id).toBe(fused);
    const ok = await w.post<RunEndRes>('/api/run/end', token, report(s.body.runId, { wavesCleared: 8, carry: [fused, A], fusions: [[B, A, fused]] }));
    expect(ok.status).toBe(200);
    expect(ok.body.gained.items.map((i) => i.id)).toEqual([fused, A]);
  });

  it('accepts one report per ticket', async () => {
    const w = world();
    const token = await w.player();
    const s = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
    w.advance(10 * MIN);
    const body = report(s.body.runId, { raws: { timber: 10, ore: 0, hide: 0 }, won: false });
    const first = await w.post<RunEndRes>('/api/run/end', token, body);
    const second = await w.post<ApiError>('/api/run/end', token, body);
    expect(first.status).toBe(200);
    expect([second.status, second.body.code]).toEqual([409, 'run_ended']);
    expect(await w.me(token)).toMatchObject({ runs: 1, marks: first.body.gained.marks, raws: { timber: 3 } });
  });

  it('voids an older open ticket and expires a stale one', async () => {
    const w = world();
    const token = await w.player();
    const old = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
    const fresh = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
    w.advance(10 * MIN);
    expect((await w.post<ApiError>('/api/run/end', token, report(old.body.runId))).body.code).toBe('run_void');
    w.advance(7 * 60 * MIN);
    const late = await w.post<ApiError>('/api/run/end', token, report(fresh.body.runId));
    expect([late.status, late.body.code]).toEqual([410, 'run_expired']);
  });

  it('allows a real pace and knows the boss can fall early', () => {
    // Waves 1-3 take 75 s. The server times the run on its own clock, so the slack is two seconds, not a tenth.
    expect(minDurationMs(3)).toBeGreaterThan(70_000);
    expect(minDurationMs(3)).toBeLessThanOrEqual(75_000);
    expect(minDurationMs(0)).toBe(0);
    // Wave 12 lasts 90 s on the clock but counts for much less.
    expect(minDurationMs(12) - minDurationMs(11)).toBeLessThan(20_000);
  });

  it('spends one kit charge per run started and removes the item at zero', async () => {
    const w = world();
    const token = await w.player();
    const other = await w.player();
    const [a, b] = await w.grant(token, [A, B]);

    const start = (kit: string[], who = token) => w.post<any>('/api/run/start', who, { mode: 'run', character: 'greenhorn', kit });
    expect((await start([a.uid, a.uid])).body.code).toBe('not_owned');
    expect((await start(['nope'])).body.code).toBe('not_owned');
    expect((await start([a.uid], other)).body.code).toBe('not_owned');
    expect((await start([a.uid, b.uid, 'third'])).body.code).toBe('bad_request');
    expect((await w.me(token)).items.map((s) => s.charges)).toEqual([3, 3]);

    const first = await start([a.uid, b.uid]);
    expect(first.body.kit.map((i: { id: string }) => i.id)).toEqual([A, B]);
    expect(first.body.profile.items.map((s: { charges: number }) => s.charges)).toEqual([2, 2]);
    await start([a.uid]);
    const third = await start([a.uid]);
    expect(third.body.kit.map((i: { id: string }) => i.id)).toEqual([A]);
    expect(third.body.profile.items).toEqual([{ uid: b.uid, item: b.item, charges: 2, repairs: 0 }]);
    expect((await start([a.uid])).body.code).toBe('not_owned');
  });

  it('unlocks one thing per run: workshop, a character, market, daily, town, then the other characters', async () => {
    const w = world();
    const token = await w.player();
    const locked = await w.post<ApiError>('/api/run/start', token, { mode: 'run', character: 'sawyer', kit: [] });
    expect([locked.status, locked.body.code]).toEqual([403, 'locked']);

    const seen: (string | undefined)[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await w.run(token, { wavesCleared: i % 2, won: false, scripEarned: 20, scripHeld: 10, kills: 10 });
      seen.push(r.end.unlockedFeature ?? r.end.unlockedCharacter);
      expect(!!r.end.unlockedFeature && !!r.end.unlockedCharacter).toBe(false);
    }
    expect(seen).toEqual(['workshop', 'sawyer', 'market', 'daily', 'town', 'smith', 'trapper', 'tinker', 'clerk', undefined]);
    const p = await w.me(token);
    expect(p.features).toEqual(['workshop', 'market', 'daily', 'town']);
    expect(p.characters).toEqual(['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk']);
    expect((await w.post('/api/run/start', token, { mode: 'run', character: 'clerk', kit: [] })).status).toBe(200);
  });
});
