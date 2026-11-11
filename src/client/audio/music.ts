// The work song: a generated bed under the run, built from the same four
// struck voices as every other sound (kit.ts). No samples, no pads, no
// sustained notes. It is written a bar at a time, so the same function feeds
// the live scheduler and an offline render (tools/exp/feel/audio.cjs).
//
// One bar is four beats at 92 to the minute. What a bar holds depends on the
// level, 0 to 1, which the run sets from the wave number:
//
//   always    a foot stamp on beats 1 and 3, a wooden answer on 2 and 4
//   0.15      a four-note call every other bar, a two-note answer between   (wave 3 of 12)
//   0.45      a dry shaker on the half beats                                (wave 7)
//   0.66      the stamp doubles                                             (wave 9)
//   0.90      a dull bell on every other bar                                (the last wave)
//
// Levels sit well under the effects: the bed is there to carry the quiet
// stretches, not to be listened to.

import type { Kit } from './kit.ts';

export const BED_BPM = 92;
export const BED_BEAT = 60 / BED_BPM;
export const BED_BAR = BED_BEAT * 4;

// A minor pentatonic from A3: the notes a tired crew can hum, and high
// enough that a phone speaker carries them.
const A3 = 220;
const NOTE = [A3, A3 * 1.2, A3 * 1.3333, A3 * 1.5, A3 * 1.8, A3 * 2];
// Calls and answers, as indexes into NOTE. Picked by bar number, so the song
// is the same every time and does not wander.
const CALLS: readonly (readonly number[])[] = [[0, 2, 3, 2], [3, 2, 1, 0], [0, 3, 4, 3], [4, 3, 2, 0]];
const ANSWERS: readonly (readonly number[])[] = [[1, 0], [2, 0], [3, 2], [1, 0]];
const BELL = [1, 1.51, 2.0, 2.66];

// A boot on packed earth. The low thump is most of it, but a phone speaker
// gives back little under 300 Hz, so the heel's knock and scuff sit above that.
function stamp(k: Kit, t: number, g: number): void {
  k.tone(t, 0.26, { f: 112, f1: 70, g });
  k.tone(t, 0.1, { f: 196, f1: 150, g: g * 0.3 });
  k.tone(t, 0.06, { f: 340, f1: 262, g: g * 0.34 });
  k.noise(t, 0.03, { f: 420, type: 'lowpass', g: g * 0.5 });
  k.noise(t, 0.022, { f: 1500, q: 1.2, g: g * 0.22 });
}

function hum(k: Kit, t: number, f: number, g: number, dur = 0.3): void {
  k.tone(t, dur, { f, type: 'triangle', lp: 900, g, a: 0.012 });
  k.tone(t, dur * 0.6, { f: f * 2, g: g * 0.22, a: 0.012 });
}

/**
 * Write one bar starting at t0. `kit` must be a Kit whose output is the bed
 * bus; `bar` counts from 0; `level` is 0..1.
 */
export function scheduleBar(k: Kit, t0: number, bar: number, level: number): void {
  const b = BED_BEAT;
  stamp(k, t0, 0.5);
  stamp(k, t0 + 2 * b, 0.4);
  k.knock(t0 + b, 392, 0.26, 0.05);
  k.knock(t0 + 3 * b, 349, 0.22, 0.05);
  if (level >= 0.15) {
    const phrase = (bar >> 1) % CALLS.length;
    if ((bar & 1) === 0) {
      const call = CALLS[phrase]!;
      const at = [0.5, 1.5, 2.5, 3];
      for (let i = 0; i < 4; i++) hum(k, t0 + at[i]! * b, NOTE[call[i]!]!, 0.2);
    } else {
      const ans = ANSWERS[phrase]!;
      hum(k, t0 + 0.5 * b, NOTE[ans[0]!]!, 0.17);
      hum(k, t0 + 1.5 * b, NOTE[ans[1]!]!, 0.18, 0.42);
    }
  }
  if (level >= 0.45) {
    for (let i = 0; i < 8; i++) {
      const off = (i & 1) === 1;
      k.noise(t0 + i * b * 0.5, off ? 0.035 : 0.02, { f: 5200, type: 'highpass', g: off ? 0.07 : 0.04 });
    }
  }
  if (level >= 0.66) {
    stamp(k, t0 + 1.5 * b, 0.28);
    stamp(k, t0 + 3.5 * b, 0.28);
  }
  if (level >= 0.9 && (bar & 1) === 0) k.ring(t0, 196, BELL, 1.1, 0.13);
}

/** The level for a wave: thicker each wave, full on the last, a step up while an elite stands. */
export function bedLevel(wave: number, totalWaves: number, elite: boolean): number {
  const base = totalWaves > 1 ? (wave - 1) / (totalWaves - 1) : 1;
  return Math.max(0, Math.min(1, base * 0.92 + (elite ? 0.12 : 0)));
}
