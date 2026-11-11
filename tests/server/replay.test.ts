import { UNCHECKED_PAY } from '../../server/config.ts';
import { describe, expect, it } from 'vitest';
import { audit } from '../../server/audit.ts';
import type { ApiError, DailyRes, FuseRes, RunEndRes, RunStartRes } from '../../src/shared/protocol.ts';
import { fromBase64, parseReplay, playback, reportKey, toBase64 } from '../../src/shared/replay.ts';
import type { ItemSpec } from '../../src/shared/item.ts';
import { playRecorded, reportOf } from '../../tools/exp/meta/recbot.ts';
import { world } from './helpers.ts';

type W = ReturnType<typeof world>;

/** Take a ticket, play it with the recording bot, and hand back what a client would report. */
async function honest(w: W, token: string, over: Partial<{ mode: string; character: string; kit: string[]; stopAfter: number; fuse: boolean }> = {}) {
  const s = await w.post<RunStartRes>('/api/run/start', token, { mode: over.mode ?? 'run', character: over.character ?? 'greenhorn', kit: over.kit ?? [] });
  if (s.status !== 200) throw new Error(JSON.stringify(s.body));
  const t = s.body;
  const fuseVia = over.fuse
    ? async (a: ItemSpec, b: ItemSpec) => {
        const r = await w.post<FuseRes>('/api/fuse', token, { a: a.id, b: b.id, ctx: 'run', runId: t.runId });
        return r.status === 200 ? r.body.item : null;
      }
    : null;
  // The bench clock: a fusion needs its wave to be over on the server's clock too.
  const played = await playRecorded({ seed: t.seed, character: t.character, waves: t.waves, kit: t.kit, stations: t.stations, hazard: t.hazard }, 11, fuseVia && (async (a, b) => {
    w.advance(14 * 60_000);
    return fuseVia(a, b);
  }), over.stopAfter);
  w.advance(Math.ceil(played.summary.seconds * 1000) + 60_000);
  return { ticket: t, played, report: reportOf(t.runId, played, over.stopAfter !== undefined) };
}

describe('replay: the log and its playback', () => {
  it('writes ticks as bytes that survive the trip', () => {
    for (const bytes of [[], [1], [1, 2], [1, 2, 3], [255, 0, 128, 7], Array.from({ length: 300 }, (_, i) => (i * 37) % 256)]) {
      expect(Array.from(fromBase64(toBase64(bytes))!)).toEqual(bytes);
    }
    expect(fromBase64('not base64!')).toBeNull();
    expect(parseReplay('{"v":2,"rs":1,"o":[]}')).toBeNull();
    expect(parseReplay('{"v":1,"rs":999,"o":[]}')).toBeNull(); // a log from another ruleset is refused
    expect(parseReplay('[]')).toBeNull();
  });

  it('plays an honest run back to the same result, and the same kills', async () => {
    const opts = { seed: 20261111, character: 'greenhorn' as const };
    const played = await playRecorded(opts);
    expect(played.summary.wavesCleared).toBeGreaterThanOrEqual(1);
    const t0 = performance.now();
    const back = playback({ opts, replay: played.replay, items: {}, fusions: [] });
    const ms = performance.now() - t0;
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(reportKey(back.summary)).toBe(reportKey(played.summary));
    expect(back.summary).toEqual(played.summary);
    expect(back.kills).toEqual(played.killsBy);
    expect(Object.values(back.kills).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(played.summary.kills);
    expect(back.ticks).toBe(played.run.tick);
    // Far faster than real time: the run took `seconds` to play and a fraction of that to check.
    expect(ms / 1000).toBeLessThan(played.summary.seconds / 5);
    // The log is small: a keyboard-like bot run is a few kilobytes.
    expect(played.replay.length).toBeLessThan(120_000);
  }, 60_000);

  it('does not play back under other conditions or with other inputs', async () => {
    const opts = { seed: 4242, character: 'smith' as const };
    const played = await playRecorded(opts);
    const key = reportKey(played.summary);
    const differs = (r: ReturnType<typeof playback>) => !r.ok || reportKey(r.summary) !== key;
    // Another seed, another character, another hazard-free kit: the same inputs come to something else, or to nothing.
    expect(differs(playback({ opts: { ...opts, seed: 4243 }, replay: played.replay, items: {}, fusions: [] }))).toBe(true);
    expect(differs(playback({ opts: { ...opts, character: 'trapper' }, replay: played.replay, items: {}, fusions: [] }))).toBe(true);
    // A log cut short does not end the run.
    const log = JSON.parse(played.replay);
    const cut = JSON.stringify({ ...log, o: log.o.slice(0, Math.max(1, log.o.length - 3)) });
    expect(playback({ opts, replay: cut, items: {}, fusions: [] })).toMatchObject({ ok: false });
    // Made-up bench actions are refused by the sim itself.
    const padded = JSON.stringify({ ...log, o: [['b', 0], ...log.o] });
    expect(playback({ opts, replay: padded, items: {}, fusions: [] })).toMatchObject({ ok: false });
    for (const junk of ['', 'x', '{"v":1,"rs":1,"o":[["s","@@@@"]]}', '{"v":1,"rs":1,"o":[["zz"]]}', '{"v":1,"rs":1,"o":[["m",-1,0,0]]}']) {
      expect(playback({ opts, replay: junk, items: {}, fusions: [] }).ok).toBe(false);
    }
  }, 60_000);
});

describe('replay: enforced by the server', () => {
  it('pays an honest recorded run, with what the server itself played', async () => {
    const w = world({ replay: 'enforce' });
    const token = await w.player();
    const { report, played } = await honest(w, token);
    const end = await w.post<RunEndRes>('/api/run/end', token, report);
    expect(end.status).toBe(200);
    expect(end.body.replay).toBe('ok');
    expect(end.body.paid).toBe(true);
    expect(end.body.profile.runs).toBe(1);
    expect(end.body.gained.marks).toBeGreaterThanOrEqual(3 * played.summary.wavesCleared);
    expect(w.db.prepare('SELECT verified, paid FROM runs').get()).toEqual({ verified: 1, paid: 1 });
    // The almanac's kills are the server's own count.
    const kills = w.db.prepare(`SELECT COALESCE(SUM(n), 0) AS n FROM almanac WHERE kind = 'enemy'`).get() as { n: number };
    expect(kills.n).toBe(Object.values(played.killsBy).reduce((a, b) => a + b, 0));
    expect(audit(w.db).ok).toBe(true);
  }, 60_000);

  it('accepts honest runs with every character, with in-run fusions, and a run the player left', async () => {
    const w = world({ replay: 'enforce' });
    const token = await w.player(12); // every character is open
    for (const character of ['sawyer', 'smith', 'trapper', 'tinker', 'clerk']) {
      const { report } = await honest(w, token, { character, fuse: character === 'tinker' });
      const end = await w.post<RunEndRes & ApiError>('/api/run/end', token, report);
      expect([character, end.status, end.body.replay, end.body.code]).toEqual([character, 200, 'ok', undefined]);
    }
    const left = await honest(w, token, { stopAfter: 2 });
    expect(left.report.quit).toBe(true);
    expect(left.played.summary.wavesCleared).toBe(2);
    const end = await w.post<RunEndRes>('/api/run/end', token, left.report);
    expect([end.status, end.body.replay]).toEqual([200, 'ok']);
    expect(audit(w.db).ok).toBe(true);
  }, 120_000);

  it('refuses a report with no replay, a forged result on a real replay, and a replay from another run', async () => {
    const w = world({ replay: 'enforce' });
    const token = await w.player();
    const before = await w.me(token);
    const refused = async (body: unknown) => {
      const e = await w.post<ApiError>('/api/run/end', token, body);
      return [e.status, e.body.code];
    };

    // E1/E2: the forged report of the critique, sent without a replay.
    let run = await honest(w, token);
    expect(await refused({ ...run.report, replay: undefined, wavesCleared: 4, won: false, scripEarned: 200, scripHeld: 200, raws: { timber: 20, ore: 20, hide: 20 }, carry: [] })).toEqual([400, 'no_replay']);
    // A real replay with a better result written over it.
    expect(await refused({ ...run.report, scripHeld: run.report.scripHeld + 10 })).toEqual([400, 'replay_mismatch']);
    expect(await refused({ ...run.report, raws: { ...run.report.raws, timber: run.report.raws.timber + 1 } })).toEqual([400, 'replay_mismatch']);
    // The untouched report still goes through afterwards: a refusal consumed nothing.
    expect((await w.post<RunEndRes>('/api/run/end', token, run.report)).status).toBe(200);

    // A replay recorded on one ticket does not fit the seed of the next.
    const old = run.report;
    run = await honest(w, token);
    w.advance(20 * 60_000); // long enough that only the replay stands in the way
    expect(await refused({ ...old, runId: run.ticket.runId })).toEqual([400, 'replay_mismatch']);
    // A replay cannot be reported faster than it was played.
    const s = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
    const quick = await playRecorded({ seed: s.body.seed, character: 'greenhorn', kit: [], stations: s.body.stations }, 11);
    w.advance(Math.max(7000, quick.summary.seconds * 500));
    const tooSoon = await refused(reportOf(s.body.runId, quick));
    expect(['too_fast', 'replay_mismatch']).toContain(tooSoon[1]);

    const after = await w.me(token);
    expect(after.runs).toBe(before.runs + 1);
    expect(audit(w.db).ok).toBe(true);
  }, 120_000);
});

describe('replay: flag mode (the default)', () => {
  it('pays an unchecked report no better than an ordinary run, and keeps it off the roll and the board', async () => {
    const dice = { thrown: 0 };
    const w = world({ replay: 'flag', rng: () => { dice.thrown++; return 0; } });
    const token = await w.player(4);
    // A forged full win at the caps, with no replay, after a plausible wait (E2c).
    const s = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
    w.advance(9 * 60_000);
    const forged = await w.post<RunEndRes>('/api/run/end', token, {
      runId: s.body.runId, wavesCleared: 12, won: true, scripEarned: 6000, scripHeld: 3200, level: 30,
      raws: { timber: 70, ore: 70, hide: 70 }, mule: { timber: 0, ore: 0, hide: 0 }, carry: ['forgebellows', 'factorseal', 'anvil'], kills: 4000, fusions: [],
    });
    expect(forged.status).toBe(200);
    expect(forged.body.replay).toBe('none');
    // Three tier 4 items were claimed. An unchecked run brings home no finished item at all.
    expect(forged.body.gained.items).toEqual([]);
    expect(forged.body.profile.items).toEqual([]);
    // 1,244 scrip and 56 raws are what an ordinary run holds at the end; that is all an unchecked report can claim.
    expect(forged.body.gained.marks).toBe(Math.floor(UNCHECKED_PAY.scripHeld[12] / 20) + 36);
    expect(forged.body.gained.raws.timber + forged.body.gained.raws.ore + forged.body.gained.raws.hide).toBeLessThanOrEqual(56);
    // No relic roll for a run the server has not played.
    expect(dice.thrown).toBe(0);
    expect(forged.body.relic).toBeUndefined();

    // E8b: a forged daily is paid like any unchecked run and is not on the board.
    const d = await w.post<RunStartRes>('/api/run/start', token, { mode: 'daily', character: 'greenhorn', kit: [] });
    w.advance(6 * 60_000);
    const fd = await w.post<RunEndRes>('/api/run/end', token, {
      runId: d.body.runId, wavesCleared: 8, won: true, scripEarned: 4000, scripHeld: 2000, level: 20,
      raws: { timber: 0, ore: 0, hide: 0 }, mule: { timber: 0, ore: 0, hide: 0 }, carry: [], kills: 2000, fusions: [],
    });
    expect(fd.status).toBe(200);
    const board = (await w.get<DailyRes>('/api/daily', token)).body;
    expect(board.players).toBe(0);
    expect(board.top).toEqual([]);
    expect(dice.thrown).toBe(0);

    // An honest recorded daily by someone else is checked and stands on the board at rank 1.
    const fair = await w.player(4);
    const real = await honest(w, fair, { mode: 'daily' });
    const end = await w.post<RunEndRes>('/api/run/end', fair, real.report);
    expect([end.status, end.body.replay]).toEqual([200, 'ok']);
    expect(end.body.daily).toMatchObject({ rank: 1, players: 1, scored: true });
    const after = (await w.get<DailyRes>('/api/daily', fair)).body;
    expect(after.top.map((r) => r.name)).toEqual([(await w.me(fair)).name]);
    expect(audit(w.db).ok).toBe(true);
  }, 120_000);

  it('flags a replay that does not match, pays it as unchecked, and keeps the log for review', async () => {
    const w = world({ replay: 'flag' });
    const token = await w.player();
    const run = await honest(w, token);
    const end = await w.post<RunEndRes>('/api/run/end', token, { ...run.report, kills: run.report.kills + 1 });
    expect(end.status).toBe(200);
    expect(end.body.replay).toBe('mismatch');
    expect(w.db.prepare('SELECT verified FROM runs').get()).toEqual({ verified: -1 });
    expect((w.db.prepare('SELECT COUNT(*) AS n FROM replays').get() as { n: number }).n).toBe(1);
  }, 60_000);
});
