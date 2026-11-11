// Playing a run again, off the main thread.
//
// The sim runs far faster than real time (a 13 minute run takes well under a
// second of CPU; see docs/critique/meta-after.md for the measured figure),
// but that is still too long to hold the one thread that serves everyone. So
// the real server hands the log to a worker thread and waits for the answer.
// Tests and tools use the same playback in line.

import { Worker } from 'node:worker_threads';
import { playback, type PlaybackInput, type PlaybackResult } from '../src/shared/replay.ts';

export type Verify = (input: PlaybackInput) => Promise<PlaybackResult>;

/** Play the log on the calling thread. For tests and tools. */
export const inlineVerify: Verify = async (input) => playback(input);

/** How long one playback may take before the run is treated as not checked. */
const VERIFY_TIMEOUT_MS = 20_000;

/**
 * A verifier backed by one worker thread, started on first use. If the worker
 * cannot be started or dies, the playback is done in line instead, so a run
 * is never left unchecked because of the plumbing.
 */
export function workerVerify(): Verify {
  let worker: Worker | null = null;
  let broken = false;
  let next = 1;
  const waiting = new Map<number, (r: PlaybackResult) => void>();

  const fail = (why: string) => {
    for (const done of waiting.values()) done({ ok: false, why });
    waiting.clear();
    worker = null;
  };
  const start = (): Worker | null => {
    if (worker || broken) return worker;
    try {
      const w = new Worker(new URL('./verify-worker.ts', import.meta.url));
      w.unref();
      w.on('message', (m: { id: number; result: PlaybackResult }) => {
        waiting.get(m.id)?.(m.result);
        waiting.delete(m.id);
      });
      w.on('error', (err) => {
        console.warn(`[replay] the worker failed, playing in line from now on: ${(err as Error)?.message ?? err}`);
        broken = true;
        fail('The replay worker failed.');
      });
      w.on('exit', () => { if (worker === w) fail('The replay worker stopped.'); });
      worker = w;
    } catch (err) {
      console.warn(`[replay] no worker thread, playing in line: ${(err as Error)?.message ?? err}`);
      broken = true;
    }
    return worker;
  };

  return (input) => {
    const w = start();
    if (!w) return inlineVerify(input);
    return new Promise<PlaybackResult>((resolve) => {
      const id = next++;
      const timer = setTimeout(() => {
        waiting.delete(id);
        resolve({ ok: false, why: 'The replay took too long to play.' });
      }, VERIFY_TIMEOUT_MS);
      waiting.set(id, (r) => {
        clearTimeout(timer);
        // A worker that broke mid-run: fall back to this thread rather than fail an honest run.
        if (!r.ok && broken) void inlineVerify(input).then(resolve);
        else resolve(r);
      });
      w.postMessage({ id, input });
    });
  };
}
