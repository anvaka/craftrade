// The worker thread behind server/verify.ts: plays run logs and posts back what each came to.

import { parentPort } from 'node:worker_threads';
import { playback, type PlaybackInput, type PlaybackResult } from '../src/shared/replay.ts';

parentPort?.on('message', (m: { id: number; input: PlaybackInput }) => {
  let result: PlaybackResult;
  try {
    result = playback(m.input);
  } catch (err) {
    result = { ok: false, why: `The playback threw: ${(err as Error)?.message ?? err}` };
  }
  parentPort!.postMessage({ id: m.id, result });
});
