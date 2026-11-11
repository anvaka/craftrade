// Every sound in the game, built from the four voices in kit.ts.
//
// The three work sounds lead: chop (hatchet into a trunk), clink (pick on a
// seam) and scrape (knife on a carcass). Each has a heavier break that
// plays when the node gives way. Everything else stays shorter and quieter
// than those so a busy wave still sounds like work being done.
//
// A sound is { make, max, gap, vary, gain }:
//   max   voices of this sound that may overlap
//   gap   least time between two starts, seconds (50 kills in a frame = 1 kill sound)
//   vary  random pitch drift per play, as a fraction
//   gain  level of the whole sound

import type { Kit } from './kit.ts';

export interface SoundDef {
  make: (k: Kit, t: number) => void;
  max: number;
  gap: number;
  vary: number;
  gain: number;
}

// Partial ratios of struck iron shapes.
const BAR = [1, 2.76, 5.4, 8.93]; // a free bar: pick head, triangle
const PLATE = [1, 1.48, 2.93, 4.21, 5.6]; // anvil face
const BELL = [1, 1.51, 2.0, 2.66, 3.4]; // a folded sheet bell, dull
const TOKEN = [1, 1.59, 2.71]; // a small punched disc

const def = (make: SoundDef['make'], max = 3, gap = 0.03, vary = 0.06, gain = 1): SoundDef => ({ make, max, gap, vary, gain });

function anvilStrike(k: Kit, t: number, g: number, f = 1040, dur = 0.26): void {
  k.noise(t, 0.008, { f: 5200, q: 0.8, g: g * 0.8 });
  k.ring(t, f, PLATE, dur, g * 0.5);
  k.tone(t, 0.07, { f: 170, f1: 110, g: g * 0.5 });
}

function logDrum(k: Kit, t: number, f: number, g: number, dur = 0.3): void {
  k.tone(t, dur, { f: f * 1.5, f1: f, g });
  k.tone(t, dur * 0.5, { f: f * 2.52, g: g * 0.3 });
  k.noise(t, 0.03, { f: 700, q: 0.8, g: g * 0.5 });
}

export const SOUNDS = {
  // ------------------------------------------------------------------ work

  // Hatchet into green wood: the bite, the trunk answering, a splinter.
  chop: def((k, t) => {
    k.noise(t, 0.006, { f: 6000, type: 'highpass', g: 0.5 });
    k.noise(t, 0.055, { f: 1150 * k.p, f1: 700 * k.p, q: 3.5, g: 0.9 });
    k.tone(t, 0.11, { f: 190, f1: 105, g: 0.9 });
    k.tone(t + 0.004, 0.07, { f: 430 * k.r(0.95, 1.05), f1: 380, g: 0.35 });
    k.noise(t + 0.028 + k.r(0, 0.012), 0.022, { f: 3800, q: 2, g: 0.28 });
  }, 3, 0.07, 0.07, 0.9),

  // The tree goes: fibres crack in a run, the crown swishes, the trunk lands.
  chopBreak: def((k, t) => {
    k.noise(t, 0.07, { f: 1000, f1: 500, q: 3, g: 1 });
    k.tone(t, 0.12, { f: 170, f1: 95, g: 0.9 });
    let at = t + 0.03;
    for (let i = 0; i < 7; i++) {
      at += k.r(0.012, 0.04);
      k.noise(at, 0.02, { f: k.r(1400, 3400) * (1 - i * 0.07), q: 4, g: 0.55 - i * 0.04 });
    }
    k.noise(t + 0.1, 0.34, { f: 2600, f1: 5200, q: 0.7, g: 0.22, a: 0.12 });
    k.tone(t + 0.36, 0.3, { f: 95, f1: 46, g: 1.1 });
    k.noise(t + 0.36, 0.12, { f: 320, type: 'lowpass', g: 0.6 });
    k.noise(t + 0.38, 0.05, { f: 2100, q: 2, g: 0.22 });
  }, 2, 0.15, 0.05, 1),

  // Pick on a seam: stone knock under an iron ring that rides the ore.
  clink: def((k, t) => {
    k.noise(t, 0.012, { f: 3400, q: 1.5, g: 0.7 });
    k.ring(t, 1850, BAR, 0.19, 0.42);
    k.tone(t, 0.045, { f: 260, f1: 190, g: 0.55 });
    k.noise(t + 0.03 + k.r(0, 0.02), 0.014, { f: k.r(1800, 2600), q: 5, g: 0.2 });
  }, 3, 0.07, 0.08, 0.85),

  // The seam gives: a slump of rock, pebbles skittering, ore ringing free.
  clinkBreak: def((k, t) => {
    k.noise(t, 0.016, { f: 3000, q: 1.2, g: 0.8 });
    k.ring(t, 1380, BAR, 0.42, 0.42);
    k.noise(t, 0.34, { f: 520, f1: 140, type: 'lowpass', g: 0.95 });
    k.tone(t + 0.02, 0.2, { f: 120, f1: 60, g: 0.8 });
    let at = t + 0.05;
    for (let i = 0; i < 10; i++) {
      at += k.r(0.015, 0.045);
      k.noise(at, 0.012, { f: k.r(900, 2800), q: 6, g: 0.4 - i * 0.025 });
    }
    k.ring(t + 0.2, 2480, TOKEN, 0.16, 0.16);
    k.ring(t + 0.31, 2950, TOKEN, 0.14, 0.12);
  }, 2, 0.15, 0.05, 1),

  // Knife on hide: a short dragging rasp that rises as the cut runs, then lets go.
  scrape: def((k, t) => {
    k.rasp(t, 0.13, { f: 1300 * k.p, f1: 2700 * k.p, q: 1.8, g: 0.85, rate: 95, rate1: 150, a: 0.012 });
    k.noise(t, 0.1, { f: 520, q: 1, g: 0.3, a: 0.01 });
    k.noise(t + 0.125, 0.014, { f: 4200, q: 2, g: 0.32 });
    k.tone(t + 0.125, 0.03, { f: 300, f1: 220, g: 0.25 });
  }, 3, 0.08, 0.08, 3),

  // The hide comes away: one long rip falling in pitch, then it slaps down.
  scrapeBreak: def((k, t) => {
    k.rasp(t, 0.3, { f: 2600, f1: 650, q: 1.4, g: 1, rate: 70, rate1: 210, a: 0.01 });
    k.noise(t, 0.26, { f: 420, f1: 260, q: 0.8, g: 0.4, a: 0.02 });
    k.noise(t + 0.3, 0.06, { f: 380, type: 'lowpass', g: 0.9 });
    k.tone(t + 0.3, 0.09, { f: 150, f1: 78, g: 0.9 });
    k.noise(t + 0.305, 0.02, { f: 1900, q: 1.5, g: 0.3 });
  }, 2, 0.15, 0.05, 1.6),

  // ---------------------------------------------------------------- pickups

  // A tap on a tuned block. The engine raises the pitch along a streak.
  pickup: def((k, t) => {
    k.tone(t, 0.05, { f: 620, f1: 600, g: 0.5 });
    k.tone(t, 0.03, { f: 1240, g: 0.16 });
    k.noise(t, 0.008, { f: 2600 * k.p, q: 1.5, g: 0.3 });
  }, 4, 0.025, 0.01, 0.75),

  // A punched token landing on others.
  scrip: def((k, t) => {
    k.ring(t, 3100, TOKEN, 0.07, 0.3);
    k.ring(t + 0.035, 3900, TOKEN, 0.06, 0.2);
    k.noise(t, 0.006, { f: 6000, type: 'highpass', g: 0.2 });
  }, 3, 0.03, 0.05, 0.5),

  // ---------------------------------------------------------------- weapons

  edge: def((k, t) => {
    k.noise(t, 0.09, { f: 1900 * k.p, f1: 5200 * k.p, q: 2.2, g: 0.5, a: 0.012 });
  }, 3, 0.05, 0.1, 1.4),

  blunt: def((k, t) => {
    k.noise(t, 0.07, { f: 420, type: 'lowpass', g: 0.5, a: 0.01 });
    k.tone(t + 0.01, 0.09, { f: 150, f1: 72, g: 0.7 });
  }, 3, 0.05, 0.08, 0.8),

  // Sling and bow: a cord letting go.
  shot: def((k, t) => {
    k.tone(t, 0.07, { f: 330, f1: 235, type: 'sawtooth', lp: 1300, g: 0.4 });
    k.tone(t, 0.05, { f: 660, f1: 470, type: 'triangle', g: 0.14 });
    k.noise(t, 0.05, { f: 2400, f1: 4200, q: 1.5, g: 0.18, a: 0.008 });
  }, 3, 0.04, 0.09, 0.9),

  musket: def((k, t) => {
    k.noise(t, 0.004, { f: 7000, type: 'highpass', g: 0.8 });
    k.noise(t, 0.26, { f: 6000, f1: 260, type: 'lowpass', g: 1.1 });
    k.tone(t, 0.17, { f: 130, f1: 42, g: 1 });
    k.noise(t + 0.05, 0.2, { f: 900, f1: 300, q: 0.7, g: 0.3 });
  }, 2, 0.08, 0.06, 0.65),

  // ----------------------------------------------------------------- combat

  hit: def((k, t) => {
    k.noise(t, 0.035, { f: 760 * k.p, q: 1.6, g: 0.6 });
    k.tone(t, 0.035, { f: 250, f1: 160, g: 0.4 });
  }, 3, 0.035, 0.12, 1.0),

  crit: def((k, t) => {
    k.noise(t, 0.04, { f: 900, q: 1.4, g: 0.7 });
    k.tone(t, 0.05, { f: 230, f1: 130, g: 0.5 });
    k.ring(t, 2650, BAR.slice(0, 3), 0.1, 0.3);
  }, 2, 0.05, 0.06, 0.6),

  kill: def((k, t) => {
    k.noise(t, 0.07, { f: 1900, f1: 420, type: 'lowpass', g: 0.6 });
    k.noise(t + 0.02, 0.03, { f: 2600, q: 3, g: 0.25 });
    k.tone(t, 0.07, { f: 135, f1: 70, g: 0.55 });
  }, 2, 0.06, 0.12, 0.7),

  hurt: def((k, t) => {
    k.noise(t, 0.05, { f: 500, type: 'lowpass', g: 1 });
    k.tone(t, 0.18, { f: 150, f1: 82, type: 'sawtooth', lp: 520, g: 0.8 });
    k.tone(t, 0.12, { f: 92, f1: 50, g: 0.9 });
  }, 1, 0.12, 0.05, 0.75),

  dodge: def((k, t) => {
    k.noise(t, 0.07, { f: 3200, f1: 6400, q: 1.2, g: 0.3, a: 0.02 });
  }, 2, 0.06, 0.1, 1.2),

  // A dry rattle that quickens: something is about to come at you.
  telegraph: def((k, t) => {
    const gaps = [0, 0.085, 0.15, 0.2, 0.24];
    for (let i = 0; i < gaps.length; i++) {
      k.noise(t + gaps[i]!, 0.022, { f: 980 * k.p, q: 9, g: 0.75 + i * 0.05 });
      k.tone(t + gaps[i]!, 0.025, { f: 490, g: 0.2 });
    }
  }, 2, 0.2, 0.05, 3),

  elite: def((k, t) => {
    logDrum(k, t, 82, 1);
    logDrum(k, t + 0.2, 82, 0.8);
    k.rasp(t + 0.34, 0.22, { f: 700, f1: 1500, q: 2, g: 0.3, rate: 38, rate1: 80 });
  }, 1, 0.5, 0.03, 0.9),

  boss: def((k, t) => {
    logDrum(k, t, 73, 1, 0.45);
    logDrum(k, t + 0.36, 65, 1, 0.45);
    logDrum(k, t + 0.72, 49, 1.15, 0.7);
    k.noise(t + 0.72, 0.35, { f: 300, type: 'lowpass', g: 0.6 });
    k.ring(t + 0.72, 233, BELL, 0.95, 0.24);
  }, 1, 1, 0.02, 0.75),

  bossDeath: def((k, t) => {
    k.noise(t, 0.6, { f: 4200, f1: 180, type: 'lowpass', g: 1.1 });
    k.tone(t, 0.75, { f: 118, f1: 34, g: 1.1 });
    let at = t + 0.12;
    for (let i = 0; i < 9; i++) {
      at += k.r(0.04, 0.09);
      k.noise(at, 0.02, { f: k.r(900, 3000), q: 5, g: 0.4 - i * 0.03 });
    }
    logDrum(k, t + 0.85, 55, 0.9, 0.5);
    k.ring(t + 0.85, 196, BELL, 0.8, 0.18);
  }, 1, 1, 0.02, 0.65),

  // Two quick chirps and your token going with them.
  steal: def((k, t) => {
    k.tone(t, 0.035, { f: 2500, f1: 3300, g: 0.3 });
    k.tone(t + 0.06, 0.04, { f: 2900, f1: 3700, g: 0.3 });
    k.ring(t + 0.1, 3300, TOKEN, 0.06, 0.2);
  }, 2, 0.15, 0.06, 1.1),

  // ---------------------------------------------------------------- the run

  // Tap, tap, strike: the same block hit harder.
  levelUp: def((k, t) => {
    anvilStrike(k, t, 0.5, 1560, 0.12);
    anvilStrike(k, t + 0.11, 0.6, 1560, 0.12);
    anvilStrike(k, t + 0.24, 1, 1760, 0.4);
  }, 1, 0.3, 0.02, 0.6),

  waveStart: def((k, t) => {
    logDrum(k, t, 98, 0.9, 0.22);
    logDrum(k, t + 0.14, 98, 0.7, 0.2);
    logDrum(k, t + 0.28, 130, 1, 0.26);
  }, 1, 0.4, 0.02, 0.7),

  // The dinner triangle.
  waveEnd: def((k, t) => {
    k.noise(t, 0.008, { f: 5000, q: 1, g: 0.4 });
    k.ring(t, 1320, BAR, 0.7, 0.4);
    k.ring(t + 0.16, 1320, BAR, 0.8, 0.32);
    k.knock(t, 300, 0.4);
  }, 1, 0.4, 0.02, 0.6),

  // ---------------------------------------------------------------- the bench

  // Tokens down on the bench top.
  buy: def((k, t) => {
    k.knock(t, 280, 0.7, 0.06);
    k.ring(t + 0.005, 2800, TOKEN, 0.08, 0.3);
    k.ring(t + 0.07, 2350, TOKEN, 0.09, 0.22);
    k.ring(t + 0.12, 3150, TOKEN, 0.06, 0.14);
  }, 2, 0.08, 0.05, 0.6),

  // Tokens shaken in a cupped hand.
  reroll: def((k, t) => {
    let at = t;
    for (let i = 0; i < 7; i++) {
      k.knock(at, k.r(500, 1100), 0.4, 0.025);
      at += k.r(0.012, 0.03);
    }
  }, 2, 0.1, 0.05, 0.8),

  // A latch: the click, then the bolt seating.
  lock: def((k, t) => {
    k.noise(t, 0.006, { f: 5200, type: 'highpass', g: 0.5 });
    k.ring(t + 0.045, 720, [1, 1.6, 2.35], 0.07, 0.45);
    k.tone(t + 0.045, 0.04, { f: 210, f1: 150, g: 0.5 });
  }, 2, 0.08, 0.04, 0.55),

  // Two alike knocked together into one.
  combine: def((k, t) => {
    k.knock(t, 410, 0.6);
    k.knock(t + 0.07, 520, 0.7);
    anvilStrike(k, t + 0.16, 0.9, 1900, 0.2);
  }, 1, 0.2, 0.03, 0.6),

  // Fusion wait: 1.5 s of smith's rhythm, strike and two bounces, three
  // times. Made to repeat end to end (see audio.loop).
  anvil: def((k, t) => {
    for (let bar = 0; bar < 3; bar++) {
      const b = t + bar * 0.5;
      anvilStrike(k, b + k.r(0, 0.008), 1, 1040);
      anvilStrike(k, b + 0.2 + k.r(0, 0.01), 0.4, 1090, 0.12);
      anvilStrike(k, b + 0.3 + k.r(0, 0.01), 0.28, 1100, 0.1);
    }
  }, 1, 1.4, 0.015, 0.55),

  // The piece is done: one square blow, and the quench.
  reveal: def((k, t) => {
    anvilStrike(k, t, 1.2, 980, 0.85);
    k.tone(t, 0.16, { f: 120, f1: 60, g: 0.8 });
    k.noise(t + 0.09, 0.5, { f: 5200, f1: 2600, type: 'highpass', g: 0.22, a: 0.03 });
  }, 1, 0.3, 0.02, 0.55),

  // Nobody has made this before: two rising blows, then the name stamped on.
  revealFirst: def((k, t) => {
    anvilStrike(k, t, 1, 980, 0.5);
    anvilStrike(k, t + 0.17, 1.1, 1470, 0.6);
    k.ring(t + 0.17, 2940, BAR.slice(0, 2), 0.7, 0.12);
    k.noise(t + 0.2, 0.4, { f: 5200, f1: 2600, type: 'highpass', g: 0.16, a: 0.03 });
    // the stamp
    k.tone(t + 0.52, 0.14, { f: 150, f1: 62, g: 1.2 });
    k.noise(t + 0.52, 0.05, { f: 600, type: 'lowpass', g: 0.9 });
    k.noise(t + 0.52, 0.02, { f: 2400, q: 1.2, g: 0.35 });
  }, 1, 0.5, 0.02, 0.85),

  // A relic on the table: a strongbox hasp thrown back, the dull bell of the
  // lid struck once and left to ring, then the serial stamped in the book.
  // Slower and lower than any other sound, and played once in a great while.
  relic: def((k, t) => {
    k.knock(t, 300, 0.7);
    k.noise(t, 0.03, { f: 1800, q: 1.4, g: 0.4 });
    k.ring(t + 0.28, 392, BELL, 1.5, 0.75);
    k.ring(t + 0.28, 196, BAR.slice(0, 2), 1.1, 0.35);
    logDrum(k, t + 0.28, 62, 0.9, 0.5);
    // the stamp
    k.tone(t + 1.25, 0.16, { f: 140, f1: 58, g: 1.2 });
    k.noise(t + 1.25, 0.05, { f: 600, type: 'lowpass', g: 0.9 });
    k.noise(t + 1.25, 0.02, { f: 2400, q: 1.2, g: 0.35 });
  }, 1, 2, 0, 0.8),

  // A UI stamp coming down on paper.
  stamp: def((k, t) => {
    k.tone(t, 0.045, { f: 185, f1: 110, g: 0.7 });
    k.noise(t, 0.022, { f: 900, type: 'lowpass', g: 0.5 });
  }, 2, 0.04, 0.08, 0.4),

  // A dull sheet-iron bell on a walking animal.
  mule: def((k, t) => {
    k.ring(t, 560, BELL, 0.3, 0.42);
    k.noise(t, 0.008, { f: 2400, q: 1, g: 0.3 });
    k.ring(t + 0.19, 548, BELL, 0.26, 0.26);
    k.ring(t + 0.44, 556, BELL, 0.34, 0.34);
    k.noise(t + 0.44, 0.008, { f: 2400, q: 1, g: 0.22 });
  }, 1, 0.5, 0.02, 0.6),

  // ------------------------------------------------------------------- ends

  // Down: the body, then the tools.
  death: def((k, t) => {
    k.tone(t, 0.7, { f: 82, f1: 36, g: 1.1 });
    k.noise(t, 0.2, { f: 400, type: 'lowpass', g: 0.9 });
    k.knock(t + 0.3, 330, 0.5, 0.05);
    k.ring(t + 0.42, 1500, BAR.slice(0, 3), 0.16, 0.24);
    k.knock(t + 0.5, 250, 0.35, 0.05);
    k.ring(t + 0.63, 1350, BAR.slice(0, 2), 0.1, 0.12);
  }, 1, 1, 0.02, 0.9),

  // Twelve waves done: the triangle rung hard and a drum under it.
  win: def((k, t) => {
    const at = [0, 0.13, 0.26, 0.39, 0.6];
    for (let i = 0; i < at.length; i++) {
      k.noise(t + at[i]!, 0.008, { f: 5000, q: 1, g: 0.3 });
      k.ring(t + at[i]!, 1320, BAR, i === 4 ? 1.1 : 0.3, i === 4 ? 0.45 : 0.3);
    }
    logDrum(k, t, 98, 0.8, 0.25);
    logDrum(k, t + 0.6, 73, 1, 0.5);
  }, 1, 1, 0.02, 0.65),
} satisfies Record<string, SoundDef>;

export type SoundId = keyof typeof SOUNDS;
export const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];
