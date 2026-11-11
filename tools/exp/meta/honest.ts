// Honest runs against a server that enforces replays: how many are refused (must be none), how big a
// replay is, and how long the server takes to play one again, in line and on its worker thread.
//   npx tsx tools/exp/meta/honest.ts <runs> [out.json]
import { writeFileSync } from 'node:fs';
import { workerVerify } from '../../../server/verify.ts';
import type { ItemSpec } from '../../../src/shared/item.ts';
import type { RunEndRes, RunStartRes } from '../../../src/shared/protocol.ts';
import { playback, type PlaybackInput } from '../../../src/shared/replay.ts';
import { world } from './lib.ts';
import { playRecorded, reportOf } from './recbot.ts';
import { mean, median } from './simlib.ts';

const N = Number(process.argv[2] ?? 36);
const out = process.argv[3] ?? '/tmp/honest.json';
const CHARS = ['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk'];

const w = world(undefined, { replay: 'enforce' });
const token = (await w.hello()).token;
w.db.prepare('UPDATE players SET runs = 12').run(); // every character open
const rows: any[] = [];
const inputs: PlaybackInput[] = [];
for (let n = 0; n < N; n++) {
  const character = CHARS[n % CHARS.length];
  const s = await w.post<RunStartRes>('/api/run/start', token, { mode: 'run', character, kit: [] });
  const t = s.body;
  const fusions: [string, string, string][] = [];
  const items: Record<string, ItemSpec> = {};
  w.advance(9 * 60_000);
  const played = await playRecorded({ seed: t.seed, character: t.character, waves: t.waves, kit: t.kit, stations: t.stations, hazard: t.hazard }, 1000 + n, async (a, b) => {
    const r = await w.post('/api/fuse', token, { a: a.id, b: b.id, ctx: 'run', runId: t.runId });
    if (r.status !== 200) return null;
    fusions.push([a.id, b.id, r.body.item.id]); items[r.body.item.id] = r.body.item;
    return r.body.item as ItemSpec;
  }, n % 9 === 8 ? 3 : 99);
  w.advance(Math.max(0, Math.ceil(played.summary.seconds * 1000) - 8 * 60_000));
  const t0 = performance.now();
  const e = await w.post<RunEndRes & { code?: string }>('/api/run/end', token, reportOf(t.runId, played, n % 9 === 8));
  const ms = performance.now() - t0;
  rows.push({ character, status: e.status, replay: e.body.replay ?? e.body.code, waves: played.summary.wavesCleared, won: played.summary.won, seconds: played.summary.seconds, chars: played.replay.length, fusions: fusions.length, ms });
  inputs.push({ opts: { seed: t.seed, character: t.character, waves: t.waves, kit: t.kit, stations: t.stations, hazard: t.hazard }, replay: played.replay, items, fusions });
  if (e.status !== 200) console.log('REFUSED', JSON.stringify(rows[rows.length - 1]), JSON.stringify(e.body));
}
const refused = rows.filter((r) => r.status !== 200 || r.replay !== 'ok').length;

// The playback alone, in line and through the worker thread the real server uses.
const inline: number[] = [], speed: number[] = [];
for (const [i, input] of inputs.entries()) {
  const t0 = performance.now();
  const r = playback(input);
  const ms = performance.now() - t0;
  if (!r.ok) throw new Error(`playback ${i}: ${r.why}`);
  inline.push(ms); speed.push(rows[i].seconds / (ms / 1000));
}
const verify = workerVerify();
await verify(inputs[0]); // start the worker
const viaWorker: number[] = [];
let workerOk = 0;
for (const input of inputs.slice(0, 12)) {
  const t0 = performance.now();
  const r = await verify(input);
  viaWorker.push(performance.now() - t0);
  if (r.ok) workerOk++;
}
const t0 = performance.now();
const all = await Promise.all(inputs.slice(0, 12).map((i) => verify(i)));
const queued = performance.now() - t0;

const res = {
  runs: N, refused, falseRefusalRate: refused / N, wins: rows.filter((r) => r.won).length, withFusions: rows.filter((r) => r.fusions > 0).length, left: rows.filter((_, i) => i % 9 === 8).length,
  replayChars: { median: median(rows.map((r) => r.chars)), max: Math.max(...rows.map((r) => r.chars)) },
  runSeconds: mean(rows.map((r) => r.seconds)),
  playbackMs: { mean: mean(inline), median: median(inline), max: Math.max(...inline) },
  timesRealTime: { mean: mean(speed), min: Math.min(...speed) },
  workerMs: { mean: mean(viaWorker), ok: workerOk, of: viaWorker.length, twelveAtOnceMs: queued, allOk: all.every((r) => r.ok) },
  auditOk: w.audit().ok,
};
writeFileSync(out, JSON.stringify({ res, rows }, null, 1));
console.log(JSON.stringify(res, null, 1));
process.exit(0);
