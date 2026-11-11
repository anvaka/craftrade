// Replays: the input log of a run, and playing one back.
//
// The sim is deterministic at 60 Hz from (seed, character, waves, kit,
// stations, hazard) and the player's inputs. So a run can be written down as
// its inputs and played again elsewhere: the client records, the server
// re-simulates and pays out what its own copy of the run produced.
//
// This file depends only on the public API in src/sim/index.ts.
//
// RECORDING (client)
//
//   const run = createRun(opts);
//   record(run);                         // from here on, use rec.* in place of the sim's own functions
//   rec.step(run, input);                // quantises the move vector, logs it, steps the sim with the quantised vector
//   rec.buy(run, i) ...                  // every bench action; only actions the sim accepted are logged
//   rec.nextWave(run); rec.abandon(run); rec.setCarry(run, ids);
//   replayOf(run)                        // the log as a string, for RunEndReq.replay
//   killsOf(run)                         // kills by enemy id, for RunEndReq.killsBy
//
// A run that was never passed to record() is not logged; rec.* then calls
// straight through, so callers need no branch.
//
// FORMAT (version 1)
//
//   { "v": 1, "rs": RULESET, "o": [ op, op, ... ] }
//   ["s", "<base64>"]   a stretch of ticks: bytes are (qx + Q, qy + Q, count) triples, count 1..255,
//                       where the move vector fed to the sim is (qx / Q, qy / Q) and Q = 15
//   ["u", i] pickUpgrade   ["b", i] buy   ["r"] reroll   ["l", i] toggleLock
//   ["w", i] scrapWeapon   ["i", i] scrapItem   ["f", a, b, outId] applyFusion
//   ["t", i] tierUp   ["k", i] combineWeapons
//   ["m", timber, ore, hide] sendMule   ["n"] nextWave   ["q"] abandon   ["c", id, id, ...] setCarry
//
// The move vector is quantised to a 31 x 31 integer grid, so no trigonometry
// is involved and both ends feed the sim exactly the same numbers. The format
// is tied to RULESET: a log made under one ruleset is refused under another.

import type { ItemSpec } from './item.ts';
import type { RawBag } from './vocab.ts';
import { RULESET } from './vocab.ts';
import {
  ENEMIES, clearEvents, abandon as simAbandon, applyFusion as simApplyFusion, buy as simBuy, createRun, nextWave as simNextWave,
  pickUpgrade as simPickUpgrade, reroll as simReroll, scrapItem as simScrapItem, scrapWeapon as simScrapWeapon,
  sendMule as simSendMule, setCarry as simSetCarry, tierUp as simTierUp, combineWeapons as simCombine, step as simStep, summary, toggleLock as simToggleLock,
  type Run, type RunOptions, type RunSummary, type StepInput,
} from '../sim/index.ts';

export const REPLAY_VERSION = 1;
/** Move vector components are whole numbers from -Q to Q, divided by Q. */
const Q = 15;
/** A replay string longer than this is refused unread. A 13 minute run by touch is about 190,000 characters at the very worst. */
export const MAX_REPLAY_CHARS = 400_000;

export type ReplayOp = [string, ...(string | number)[]];
export interface ReplayLog { v: number; rs: number; o: ReplayOp[] }

// ---- base64 over bytes, with no platform helper -----------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = new Int16Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) B64_INDEX[B64.charCodeAt(i)] = i;

export function toBase64(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = i + 1 < bytes.length ? bytes[i + 1] : 0, c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[c & 63] : '=';
  }
  return out;
}

/** Null if the text is not base64. */
export function fromBase64(text: string): Uint8Array | null {
  if (text.length % 4 !== 0) return null;
  let pad = 0;
  if (text.endsWith('==')) pad = 2; else if (text.endsWith('=')) pad = 1;
  const out = new Uint8Array((text.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < text.length; i += 4) {
    let v = 0;
    for (let k = 0; k < 4; k++) {
      const ch = text.charCodeAt(i + k);
      const last = i + k >= text.length - pad;
      const d = last ? (text[i + k] === '=' ? 0 : -1) : ch < 128 ? B64_INDEX[ch] : -1;
      if (d < 0) return null;
      v = (v << 6) | d;
    }
    if (o < out.length) out[o++] = (v >> 16) & 255;
    if (o < out.length) out[o++] = (v >> 8) & 255;
    if (o < out.length) out[o++] = v & 255;
  }
  return out;
}

// ---- recording --------------------------------------------------------------

interface Recorder {
  ops: ReplayOp[];
  /** The stretch of ticks being written: (qx + Q, qy + Q, count) triples. */
  bytes: number[];
  kills: Record<string, number>;
  /** What each fusion in this run made, by id: needed to play the log again. */
  items: Record<string, ItemSpec>;
}

const RECORDERS = new WeakMap<Run, Recorder>();
const QUANT: StepInput = { mx: 0, my: 0 };

/** Start logging this run. Call straight after createRun, before the first step. */
export function record(run: Run): void {
  RECORDERS.set(run, { ops: [], bytes: [], kills: {}, items: {} });
}

const quant = (v: number): number => {
  const q = Math.round(v * Q);
  return q !== q ? 0 : q > Q ? Q : q < -Q ? -Q : q;
};

function flush(r: Recorder): void {
  if (!r.bytes.length) return;
  r.ops.push(['s', toBase64(r.bytes)]);
  r.bytes = [];
}

/** Count kills by enemy id among the events from index `from` on: those the step just taken added. */
function countKills(run: Run, kills: Record<string, number>, from: number): void {
  const ev = run.events;
  for (let i = from; i < ev.n; i++) {
    const e = ev.list[i];
    if (e.type !== 'kill') continue;
    const id = ENEMIES[e.a]?.id;
    if (id) kills[id] = (kills[id] ?? 0) + 1;
  }
}

function logOp(run: Run, op: ReplayOp): void {
  const r = RECORDERS.get(run);
  if (!r) return;
  flush(r);
  r.ops.push(op);
}

/** The sim's functions, logged. Same arguments and results as the originals. */
export const rec = {
  step(run: Run, input: StepInput): void {
    const r = RECORDERS.get(run);
    if (!r) { simStep(run, input); return; }
    if (run.phase !== 'wave') return;
    const qx = quant(input.mx), qy = quant(input.my);
    const b = r.bytes, n = b.length;
    if (n >= 3 && b[n - 3] === qx + Q && b[n - 2] === qy + Q && b[n - 1] < 255) b[n - 1]++;
    else b.push(qx + Q, qy + Q, 1);
    QUANT.mx = qx / Q; QUANT.my = qy / Q;
    // The caller may or may not have emptied the event queue since the last step; what this step adds starts here.
    const from = run.events.n;
    simStep(run, QUANT);
    countKills(run, r.kills, from);
  },
  pickUpgrade(run: Run, i: number): boolean { const ok = simPickUpgrade(run, i); if (ok) logOp(run, ['u', i]); return ok; },
  buy(run: Run, i: number): boolean { const ok = simBuy(run, i); if (ok) logOp(run, ['b', i]); return ok; },
  reroll(run: Run): boolean { const ok = simReroll(run); if (ok) logOp(run, ['r']); return ok; },
  toggleLock(run: Run, i: number): boolean { const ok = simToggleLock(run, i); if (ok) logOp(run, ['l', i]); return ok; },
  scrapWeapon(run: Run, i: number): boolean { const ok = simScrapWeapon(run, i); if (ok) logOp(run, ['w', i]); return ok; },
  scrapItem(run: Run, i: number): boolean { const ok = simScrapItem(run, i); if (ok) logOp(run, ['i', i]); return ok; },
  tierUp(run: Run, i: number): boolean { const ok = simTierUp(run, i); if (ok) logOp(run, ['t', i]); return ok; },
  combineWeapons(run: Run, i: number): boolean { const ok = simCombine(run, i); if (ok) logOp(run, ['k', i]); return ok; },
  applyFusion(run: Run, a: number, b: number, result: ItemSpec): string | null {
    const why = simApplyFusion(run, a, b, result);
    if (why === null) {
      logOp(run, ['f', a, b, result.id]);
      const r = RECORDERS.get(run);
      if (r) r.items[result.id] = result;
    }
    return why;
  },
  sendMule(run: Run, load: Partial<RawBag>): boolean {
    const ok = simSendMule(run, load);
    if (ok) logOp(run, ['m', load.timber ?? 0, load.ore ?? 0, load.hide ?? 0]);
    return ok;
  },
  nextWave(run: Run): boolean { const ok = simNextWave(run); if (ok) logOp(run, ['n']); return ok; },
  abandon(run: Run): void {
    const over = run.phase === 'over';
    simAbandon(run);
    if (!over) logOp(run, ['q']);
  },
  setCarry(run: Run, ids: string[]): boolean { const ok = simSetCarry(run, ids); if (ok) logOp(run, ['c', ...ids]); return ok; },
};

/** The log so far as a string, or undefined if the run was not recorded. */
export function replayOf(run: Run): string | undefined {
  const r = RECORDERS.get(run);
  if (!r) return undefined;
  flush(r);
  return JSON.stringify({ v: REPLAY_VERSION, rs: RULESET, o: r.ops } satisfies ReplayLog);
}

/** Kills by enemy id so far, or undefined if the run was not recorded. */
export function killsOf(run: Run): Record<string, number> | undefined {
  const r = RECORDERS.get(run);
  return r ? { ...r.kills } : undefined;
}

/** What the fusions in a recorded run made, by id. Kept with a saved run so resumeInto can make them again. */
export function fusedOf(run: Run): Record<string, ItemSpec> {
  return { ...(RECORDERS.get(run)?.items ?? {}) };
}

/**
 * Bring a fresh, recorded run (createRun then record, nothing else) to where a log stops, so play can go on
 * from there. The log is rebuilt as it is played, so the report at the end covers the whole run.
 * True if every op was accepted and the run now stands at a bench. On false the run is not usable.
 */
export function resumeInto(run: Run, replay: string, items: Record<string, ItemSpec>): boolean {
  const log = parseReplay(replay);
  if (!log || !RECORDERS.has(run) || run.tick !== 0) return false;
  const move: StepInput = { mx: 0, my: 0 };
  for (const op of log.o) {
    const [k, a, b, c] = op;
    const i = typeof a === 'number' ? a : -1;
    let ok = true;
    switch (k) {
      case 's': {
        const bytes = typeof a === 'string' ? fromBase64(a) : null;
        if (!bytes || bytes.length % 3 !== 0) return false;
        for (let n = 0; n < bytes.length; n += 3) {
          move.mx = (bytes[n] - Q) / Q; move.my = (bytes[n + 1] - Q) / Q;
          for (let t = bytes[n + 2]; t > 0; t--) {
            if (run.phase !== 'wave') return false;
            rec.step(run, move);
            clearEvents(run);
          }
        }
        break;
      }
      case 'u': ok = rec.pickUpgrade(run, i); break;
      case 'b': ok = rec.buy(run, i); break;
      case 'r': ok = rec.reroll(run); break;
      case 'l': ok = rec.toggleLock(run, i); break;
      case 'w': ok = rec.scrapWeapon(run, i); break;
      case 'i': ok = rec.scrapItem(run, i); break;
      case 't': ok = rec.tierUp(run, i); break;
      case 'k': ok = rec.combineWeapons(run, i); break;
      case 'f': {
        const out = typeof c === 'string' && Object.hasOwn(items, c) ? items[c] : undefined;
        ok = !!out && typeof b === 'number' && rec.applyFusion(run, i, b, out) === null;
        break;
      }
      case 'm': ok = rec.sendMule(run, { timber: Number(a), ore: Number(b), hide: Number(c) }); break;
      case 'n': ok = rec.nextWave(run); break;
      default: return false; // a log that ends the run ('q', 'c') is not one to resume
    }
    if (!ok) return false;
  }
  return run.phase === 'bench';
}

// ---- playing back -------------------------------------------------------------

export interface PlaybackInput {
  /** Exactly what the ticket gave the client. `hazard` is passed through to createRun. */
  opts: RunOptions & { hazard?: number };
  replay: string;
  /** Items a fusion in this run may produce, by id. An output that is not here ends the playback. */
  items: Record<string, ItemSpec>;
  /** Fusions the server answered for this run: [a id, b id, out id]. Each may be used once. */
  fusions: [string, string, string][];
}

export type PlaybackResult =
  | { ok: true; summary: RunSummary; kills: Record<string, number>; ticks: number }
  | { ok: false; why: string };

const isIndex = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 4096;
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1_000_000;

/** Parse a replay string. Null if it is not a version 1 log for this ruleset. */
export function parseReplay(text: string): ReplayLog | null {
  if (typeof text !== 'string' || text.length > MAX_REPLAY_CHARS) return null;
  let log: unknown;
  try { log = JSON.parse(text); } catch { return null; }
  const l = log as Partial<ReplayLog> | null;
  if (!l || l.v !== REPLAY_VERSION || l.rs !== RULESET || !Array.isArray(l.o)) return null;
  for (const op of l.o) if (!Array.isArray(op) || typeof op[0] !== 'string') return null;
  return l as ReplayLog;
}

/**
 * Play a log from the start and return what the run came to. Pure: no clock,
 * no network. Any op the sim refuses, and any fusion the server did not
 * answer for this run, ends the playback with a reason.
 */
export function playback(input: PlaybackInput): PlaybackResult {
  const log = parseReplay(input.replay);
  if (!log) return { ok: false, why: 'The replay cannot be read.' };
  let run: Run;
  try { run = createRun(input.opts); } catch { return { ok: false, why: 'The run could not be set up.' }; }
  const kills: Record<string, number> = {};
  const fusions = input.fusions.map((f) => f.slice() as [string, string, string]);
  const move: StepInput = { mx: 0, my: 0 };
  const bad = (n: number, why: string): PlaybackResult => ({ ok: false, why: `Op ${n}: ${why}` });

  for (let n = 0; n < log.o.length; n++) {
    const op = log.o[n];
    const [k, a, b, c] = op;
    switch (k) {
      case 's': {
        const bytes = typeof a === 'string' ? fromBase64(a) : null;
        if (!bytes || bytes.length % 3 !== 0) return bad(n, 'unreadable ticks.');
        for (let i = 0; i < bytes.length; i += 3) {
          const qx = bytes[i] - Q, qy = bytes[i + 1] - Q;
          if (qx < -Q || qx > Q || qy < -Q || qy > Q || bytes[i + 2] === 0) return bad(n, 'a move outside the grid.');
          move.mx = qx / Q; move.my = qy / Q;
          for (let t = bytes[i + 2]; t > 0; t--) {
            if (run.phase !== 'wave') return bad(n, 'a tick outside a wave.');
            simStep(run, move);
            countKills(run, kills, 0);
            clearEvents(run);
          }
        }
        break;
      }
      case 'u': if (!isIndex(a) || !simPickUpgrade(run, a)) return bad(n, 'upgrade refused.'); break;
      case 'b': if (!isIndex(a) || !simBuy(run, a)) return bad(n, 'purchase refused.'); break;
      case 'r': if (!simReroll(run)) return bad(n, 'reroll refused.'); break;
      case 'l': if (!isIndex(a) || !simToggleLock(run, a)) return bad(n, 'lock refused.'); break;
      case 'w': if (!isIndex(a) || !simScrapWeapon(run, a)) return bad(n, 'scrap refused.'); break;
      case 'i': if (!isIndex(a) || !simScrapItem(run, a)) return bad(n, 'scrap refused.'); break;
      case 't': if (!isIndex(a) || !simTierUp(run, a)) return bad(n, 'tier up refused.'); break;
      case 'k': if (!isIndex(a) || !simCombine(run, a)) return bad(n, 'combine refused.'); break;
      case 'f': {
        if (!isIndex(a) || !isIndex(b) || typeof c !== 'string') return bad(n, 'fusion unreadable.');
        const ia = run.player.items[a], ib = run.player.items[b];
        const out = Object.hasOwn(input.items, c) ? input.items[c] : undefined;
        if (!ia || !ib || !out) return bad(n, 'fusion of items not held.');
        const at = fusions.findIndex((f) => f[2] === c && ((f[0] === ia.id && f[1] === ib.id) || (f[0] === ib.id && f[1] === ia.id)));
        if (at < 0) return bad(n, 'a fusion the town never answered.');
        fusions.splice(at, 1);
        if (simApplyFusion(run, a, b, out) !== null) return bad(n, 'fusion refused.');
        break;
      }
      case 'm':
        if (!isCount(a) || !isCount(b) || !isCount(c) || !simSendMule(run, { timber: a, ore: b, hide: c })) return bad(n, 'mule refused.');
        break;
      case 'n': if (!simNextWave(run)) return bad(n, 'next wave refused.'); break;
      case 'q': if (run.phase === 'over') return bad(n, 'left a run that was over.'); simAbandon(run); break;
      case 'c': {
        const ids = op.slice(1);
        if (!ids.every((id) => typeof id === 'string') || !simSetCarry(run, ids as string[])) return bad(n, 'carry refused.');
        break;
      }
      default: return bad(n, 'unknown op.');
    }
  }
  if (run.phase !== 'over') return { ok: false, why: 'The replay stops before the run is over.' };
  return { ok: true, summary: summary(run), kills, ticks: run.tick };
}

/** The fields of a report a playback must agree with, as one comparable string. */
export function reportKey(r: Pick<RunSummary, 'wavesCleared' | 'won' | 'scripEarned' | 'scripHeld' | 'level' | 'raws' | 'mule' | 'carry' | 'kills'>): string {
  return JSON.stringify([
    r.wavesCleared, r.won, r.scripEarned, r.scripHeld, r.level,
    r.raws.timber, r.raws.ore, r.raws.hide, r.mule.timber, r.mule.ore, r.mule.hide, r.carry.slice().sort(), r.kills,
  ]);
}
