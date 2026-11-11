// One of several processes that write to the same database file at once, for
// the serial-numbering test in relics.test.ts. Each makes a player and reports
// full wins through the real run/start and run/end handlers, with the roll's
// dice loaded so every win finds a relic.
//   tsx tests/server/relic-worker.ts <db path> <wins> <dice value>
// Prints one JSON line: the [relic, serial] pairs this process was given.

import { createApp } from '../../server/app.ts';
import { ProceduralProvider } from '../../server/provider.ts';
import type { HelloRes, RunEndRes, RunStartRes } from '../../src/shared/protocol.ts';
import { report } from './helpers.ts';

const [dbPath, winsArg, diceArg] = process.argv.slice(2);
const wins = Number(winsArg);
const dice = Number(diceArg);

let t = Date.UTC(2026, 10, 11, 9);
const app = createApp({ dbPath, provider: new ProceduralProvider(), now: () => t, rateLimit: false, replay: 'off', runRate: false, rng: () => dice });

async function post<T>(path: string, token: string | undefined, body: unknown): Promise<T> {
  const res = await app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { 'x-device': token } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  if (res.status !== 200) throw new Error(`${path} ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const { token } = await post<HelloRes>('/api/hello', undefined, {});
const got: [string, number][] = [];
for (let i = 0; i < wins; i++) {
  const s = await post<RunStartRes>('/api/run/start', token, { mode: 'run', character: 'greenhorn', kit: [] });
  t += 20 * 60_000;
  const e = await post<RunEndRes>('/api/run/end', token, report(s.runId, { wavesCleared: 12, won: true }));
  if (!e.relic) throw new Error('the loaded dice did not find a relic');
  got.push([e.relic.id, e.relic.serial!]);
  // Hand the file to the other writers between reports.
  await new Promise((r) => setTimeout(r, 1));
}
console.log(JSON.stringify(got));
