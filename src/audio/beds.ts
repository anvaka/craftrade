// Ambience: one bed per place. A bed is a few looping noise layers whose levels and colours wander,
// plus things that happen now and then (a bird, a frog, a far-off pick). Nothing is a recording.
// Each place is built from what lives there, so it can be told apart with the screen off,
// and each changes with the time of day the renderer shows (0 day, 1 dusk, 2 night).
// A place whose slot has a recording chosen (audio/samples.ts) plays that instead, looped; the synthesised
// bed is what plays when there is no recording, when it will not load, or when the owner prefers it.
import type { Core, NoiseKind } from './core';
import type { Loaded, Samples } from './samples';

export type Ground = 'quarry' | 'grove' | 'marsh';
export type Place = 'none' | Ground | 'town' | 'forge' | 'workshop' | 'apothecary' | 'camp' | 'gate' | 'cold';
export const PLACES: Place[] = ['quarry', 'grove', 'marsh', 'town', 'forge', 'workshop', 'apothecary', 'camp', 'gate', 'cold'];

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const chance = (p: number): boolean => Math.random() < p;
/** Partials of a struck bar: what makes a pick or an anvil ring instead of sing. */
export const BAR = [1, 2.76, 5.4, 8.93] as const;
const GLASS = [1, 2.32, 3.86] as const;

/** Equal-power fade curves for the loop seam: the two halves always add up to the same loudness. */
const FADE_IN = new Float32Array(33);
const FADE_OUT = new Float32Array(33);
for (let i = 0; i < 33; i++) {
  FADE_IN[i] = Math.sin((i / 32) * Math.PI * 0.5);
  FADE_OUT[i] = Math.cos((i / 32) * Math.PI * 0.5);
}
const SKIP = 0.03; // an MP3 starts and ends with a little encoder padding: never play the first or last 30 ms

/**
 * A recording played round and round. An MP3 does not loop cleanly, so nothing is looped: the file is played
 * again from its start a second or two before it ends, and the two are cross-faded.
 */
class Loop {
  private next: number; // when the following pass starts
  private first = true;
  private live: AudioBufferSourceNode[] = [];
  private level: GainNode;

  constructor(private core: Core, private buf: AudioBuffer, gain: number, dest: AudioNode) {
    this.level = core.ctx.createGain();
    this.level.gain.value = gain;
    this.level.connect(dest);
    this.next = core.now + 0.02;
  }
  tick(now: number): void {
    if (now < this.next - 0.6) return;
    const usable = this.buf.duration - SKIP * 2;
    if (usable < 0.5) return;
    const xf = Math.min(2, usable * 0.2);
    // the first pass starts somewhere inside the recording, so a place does not always open on the same second
    const offset = this.first && usable > 12 ? Math.random() * (usable - xf * 2 - 2) : 0;
    this.first = false;
    const t = Math.max(this.next, now + 0.01);
    const len = usable - offset;
    const ctx = this.core.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buf;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueCurveAtTime(FADE_IN, t, xf);
    g.gain.setValueCurveAtTime(FADE_OUT, t + len - xf, xf);
    src.connect(g).connect(this.level);
    src.start(t, SKIP + offset, len);
    src.stop(t + len + 0.05);
    this.live.push(src);
    src.onended = () => {
      g.disconnect();
      const i = this.live.indexOf(src);
      if (i >= 0) this.live.splice(i, 1);
    };
    this.next = t + len - xf;
  }
  free(): void {
    for (const s of this.live) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* not started */
      }
      s.disconnect();
    }
    this.live.length = 0;
    this.level.disconnect();
  }
}

interface Walk { p: AudioParam; lo: number; hi: number; minT: number; maxT: number; next: number }
interface Job { lo: number; hi: number; fn: (t: number) => void; next: number }

class Bed {
  readonly near: GainNode; // everything in the bed
  readonly far: GainNode; // the part of it that should carry and echo
  freeAt = Infinity;
  private srcs: AudioScheduledSourceNode[] = [];
  private walks: Walk[] = [];
  private jobs: Job[] = [];
  private loops: Loop[] = [];

  constructor(readonly core: Core) {
    const ctx = core.ctx;
    this.near = ctx.createGain();
    this.far = ctx.createGain();
    this.near.gain.value = 0;
    this.far.gain.value = 0;
    this.near.connect(core.amb);
    this.far.connect(core.far);
    this.near.gain.setTargetAtTime(1, core.now, 0.5);
    this.far.gain.setTargetAtTime(1, core.now, 0.5);
  }

  private gain(v: number): GainNode {
    const g = this.core.ctx.createGain();
    g.gain.value = v;
    return g;
  }
  /** Looping noise through one filter into a level, placed left or right. */
  layer(kind: NoiseKind, type: BiquadFilterType, freq: number, q: number, level: number, pan = 0): { f: BiquadFilterNode; g: GainNode } {
    const ctx = this.core.ctx;
    const s = this.core.loop(kind, rnd(0.9, 1.1));
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.gain(level);
    s.connect(f).connect(g);
    if (pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.near);
    } else g.connect(this.near);
    s.start(this.core.now, Math.random() * 1.5);
    this.srcs.push(s);
    return { f, g };
  }
  osc(type: OscillatorType, freq: number): OscillatorNode {
    const o = this.core.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.start(this.core.now);
    this.srcs.push(o);
    return o;
  }
  /** A recording, looped, at its own level. */
  record(r: Loaded, level = 1): void {
    this.loops.push(new Loop(this.core, r.buf, r.gain * level, this.near));
  }
  /** Let a parameter wander between two values, picking a new one every minT to maxT seconds. */
  walk(p: AudioParam, lo: number, hi: number, minT: number, maxT: number): void {
    this.walks.push({ p, lo, hi, minT, maxT, next: this.core.now + Math.random() * maxT });
  }
  /** Something that happens every lo to hi seconds. */
  every(lo: number, hi: number, fn: (t: number) => void, firstIn = rnd(0.3, hi)): void {
    this.jobs.push({ lo, hi, fn, next: this.core.now + firstIn });
  }
  /** A pulsing insect: a high tone beating at `rate`, swelling in and out at `swell`. */
  insect(freq: number, rate: number, swell: number, level: number, pan: number): void {
    const ctx = this.core.ctx;
    const car = this.osc('sine', freq);
    const am = this.gain(0.5);
    const d1 = this.gain(0.5);
    this.osc('sine', rate).connect(d1).connect(am.gain);
    const gate = this.gain(0.5);
    const d2 = this.gain(0.5);
    this.osc('sine', swell).connect(d2).connect(gate.gain);
    const lv = this.gain(level);
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    car.connect(am).connect(gate).connect(lv).connect(p).connect(this.near);
    this.walk(lv.gain, level * 0.35, level, 3, 9);
  }

  tick(now: number): void {
    for (let i = 0; i < this.loops.length; i++) this.loops[i].tick(now);
    for (let i = 0; i < this.walks.length; i++) {
      const w = this.walks[i];
      if (now < w.next) continue;
      const T = rnd(w.minT, w.maxT);
      w.p.setTargetAtTime(rnd(w.lo, w.hi), now, T / 3);
      w.next = now + T;
    }
    for (let i = 0; i < this.jobs.length; i++) {
      const j = this.jobs[i];
      if (now < j.next) continue;
      j.fn(now + 0.03);
      j.next = now + rnd(j.lo, j.hi);
    }
  }
  stop(now: number): void {
    this.near.gain.setTargetAtTime(0, now, 0.3);
    this.far.gain.setTargetAtTime(0, now, 0.3);
    this.jobs.length = 0;
    this.walks.length = 0;
    this.freeAt = now + 1.8;
  }
  free(): void {
    for (const l of this.loops) l.free();
    this.loops.length = 0;
    for (const s of this.srcs) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
      s.disconnect();
    }
    this.srcs.length = 0;
    this.near.disconnect();
    this.far.disconnect();
  }
}

// ------------------------------------------------------------- shared parts
const C0 = { pri: 0 }; // every one-shot in a bed is cosmetic: it is the first thing dropped when the mix is busy

function wind(b: Bed, level: number, whistle: number): void {
  const low = b.layer('pink', 'bandpass', 300, 0.7, level, -0.25);
  b.walk(low.f.frequency, 170, 430, 2.5, 6);
  b.walk(low.g.gain, level * 0.45, level * 1.25, 2, 5);
  if (whistle > 0) {
    // air through a gap in the rock: a narrow band that slides
    const hi = b.layer('white', 'bandpass', 1200, 16, whistle, 0.4);
    b.walk(hi.f.frequency, 800, 1700, 2, 5);
    b.walk(hi.g.gain, 0, whistle * 1.6, 1.5, 4);
  }
}
function fire(b: Bed, level: number): void {
  const roar = b.layer('brown', 'lowpass', 260, 0.7, 0.2 * level);
  b.walk(roar.f.frequency, 190, 360, 0.3, 1.2);
  b.walk(roar.g.gain, 0.13 * level, 0.24 * level, 0.12, 0.5);
  b.every(0.04, 0.34, (t) => {
    const c = b.core;
    c.noise(b.near, t, rnd(0.004, 0.02), rnd(0.02, 0.085) * level, rnd(1400, 5200), 'bandpass', { q: 2, pan: rnd(-0.3, 0.3), pri: 0 });
    if (chance(0.06)) {
      // a knot bursts
      c.tone(b.near, t, 150, 0.07, 'sine', 0.09 * level, { slideTo: 70, pri: 0 });
      c.noise(b.near, t, 0.03, 0.1 * level, 2400, 'bandpass', { q: 1.2, pri: 0 });
    }
  }, 0.1);
}
function murmur(b: Bed, level: number): void {
  // voices too far off to make out: three bands in the range of speech, each rising and falling at the rate of syllables
  for (const [f, q, pan] of [[330, 2, -0.5], [520, 2.5, 0.2], [800, 3, 0.55]] as const) {
    const m = b.layer('pink', 'bandpass', f, q, 0.02 * level, pan);
    b.walk(m.g.gain, 0.004 * level, 0.036 * level, 0.15, 0.45);
    b.walk(m.f.frequency, f * 0.85, f * 1.2, 0.3, 0.9);
  }
}
function crickets(b: Bed, n: number, level = 1): void {
  if (n > 0) b.insect(4480, 27, 2.1, 0.014 * level, -0.5);
  if (n > 1) b.insect(4930, 31, 1.6, 0.01 * level, 0.6);
}
function anvil(b: Bed, t: number, vol: number, dest: AudioNode): void {
  const c = b.core;
  const n = 2 + Math.floor(Math.random() * 3);
  const f = 1050 * rnd(0.98, 1.02);
  for (let i = 0; i < n; i++) {
    const at = t + i * 0.43 + rnd(-0.015, 0.015);
    c.ring(dest, at, f, BAR, vol, 0.45, C0);
    c.tone(dest, at, 190, 0.05, 'sine', vol * 1.2, { slideTo: 120, pri: 0 });
    c.ring(dest, at + 0.11, f, BAR, vol * 0.3, 0.3, C0); // the hammer bounces
  }
}
function birdTwoNote(b: Bed, t: number, vol: number, dest: AudioNode = b.near): void {
  const k = rnd(0.9, 1.15);
  const pan = rnd(-0.7, 0.7);
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    b.core.tone(dest, t + i * 0.19, 3350 * k, 0.07, 'sine', vol, { slideTo: 2950 * k, attack: 0.008, pan, pri: 0 });
    b.core.tone(dest, t + i * 0.19 + 0.085, 2550 * k, 0.08, 'sine', vol * 0.8, { attack: 0.008, pan, pri: 0 });
  }
}
function birdTrill(b: Bed, t: number, vol: number, base = 4100): void {
  const k = rnd(0.9, 1.12);
  const pan = rnd(-0.7, 0.7);
  const n = 6 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) b.core.tone(b.near, t + i * 0.046, base * k, 0.03, 'sine', vol, { slideTo: base * k * 1.12, attack: 0.005, pan, pri: 0 });
}
function birdWhistle(b: Bed, t: number, vol: number, dest: AudioNode = b.near): void {
  const k = rnd(0.85, 1.15);
  const pan = rnd(-0.7, 0.7);
  b.core.tone(dest, t, 2500 * k, 0.22, 'sine', vol, { slideTo: 1900 * k, attack: 0.03, pan, pri: 0 });
  b.core.tone(dest, t + 0.25, 1900 * k, 0.18, 'sine', vol * 0.9, { slideTo: 2300 * k, attack: 0.02, pan, pri: 0 });
}
function owl(b: Bed, t: number, vol: number): void {
  const pan = rnd(-0.6, 0.6);
  for (const at of [0, 0.5, 0.74]) b.core.tone(b.far, t + at, 345, at ? 0.2 : 0.3, 'sine', vol, { slideTo: 322, attack: 0.05, pan, pri: 0 });
}
function croak(b: Bed, t: number, f: number, formant: number, vol: number, pan: number): void {
  b.core.tone(b.near, t, f, 0.11, 'sawtooth', vol, { fmt: formant, q: 3.5, attack: 0.012, pan, pri: 0 });
  b.core.tone(b.near, t + 0.16, f, 0.18, 'sawtooth', vol, { fmt: formant * 1.08, q: 3.5, attack: 0.012, slideTo: f * 0.9, pan, pri: 0 });
}
function bloop(b: Bed, t: number, lo: number, hi: number, vol: number): void {
  const f = rnd(lo, hi);
  b.core.tone(b.near, t, f, 0.05, 'sine', vol, { slideTo: f * 1.5, attack: 0.008, pan: rnd(-0.6, 0.6), pri: 0 });
}

// ----------------------------------------------------------------- places
function quarry(b: Bed, tod: number): void {
  wind(b, tod === 2 ? 0.24 : 0.3, tod === 2 ? 0.05 : 0.035);
  // loose stone
  b.every(6, 16, (t) => {
    const n = 3 + Math.floor(Math.random() * 5);
    const pan = rnd(-0.7, 0.7);
    for (let i = 0; i < n; i++) b.core.tone(b.near, t + i * rnd(0.05, 0.11), rnd(900, 2600), 0.014, 'triangle', rnd(0.01, 0.03), { pan, pri: 0 });
  });
  // someone else is working a face a long way off: the noise of industry that New World gets from other players
  b.every(tod === 2 ? 30 : 10, tod === 2 ? 60 : 24, (t) => {
    const n = 2 + Math.floor(Math.random() * 3);
    const pan = rnd(-0.8, 0.8);
    const f = rnd(1150, 1400);
    for (let i = 0; i < n; i++) {
      const at = t + i * rnd(1, 1.15);
      b.core.ring(b.far, at, f, BAR.slice(0, 2), 0.02, 0.2, { pan, pri: 0 });
      b.core.tone(b.far, at, 130, 0.08, 'sine', 0.03, { slideTo: 70, pan, pri: 0 });
    }
  }, rnd(3, 8));
  if (tod === 0) {
    // a hawk
    b.every(25, 60, (t) => b.core.tone(b.far, t, 2950, 0.55, 'sine', 0.018, { slideTo: 2250, attack: 0.06, pan: rnd(-0.6, 0.6), pri: 0 }), rnd(8, 20));
  } else if (tod === 1) {
    // crows going home
    b.every(18, 40, (t) => {
      const pan = rnd(-0.7, 0.7);
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) b.core.tone(b.far, t + i * 0.32, 480, 0.2, 'sawtooth', 0.035, { slideTo: 410, fmt: 1500, q: 2.5, attack: 0.02, pan, pri: 0 });
    }, rnd(4, 12));
    crickets(b, 1, 0.6);
  } else crickets(b, 1);
}

function grove(b: Bed, tod: number): void {
  // leaves: two bright layers that move separately, so the canopy has width
  const lv = tod === 2 ? 0.6 : 1;
  for (const pan of [-0.6, 0.6]) {
    const r = b.layer('white', 'bandpass', 4800, 0.6, 0.03 * lv, pan);
    b.walk(r.g.gain, 0.012 * lv, 0.06 * lv, 1.2, 4);
    b.walk(r.f.frequency, 3600, 6200, 2, 5);
  }
  const low = b.layer('pink', 'lowpass', 320, 0.7, 0.09);
  b.walk(low.g.gain, 0.05, 0.13, 2.5, 6);
  if (tod === 0) {
    b.every(3, 8, (t) => birdTwoNote(b, t, 0.028), rnd(0.5, 2));
    b.every(5, 12, (t) => birdTrill(b, t, 0.022), rnd(1, 4));
    b.every(6, 14, (t) => birdWhistle(b, t, 0.026), rnd(2, 6));
    // a woodpecker, far
    b.every(30, 70, (t) => {
      const n = 9 + Math.floor(Math.random() * 5);
      const pan = rnd(-0.7, 0.7);
      for (let i = 0; i < n; i++) b.core.tone(b.far, t + i * 0.055, 820, 0.018, 'triangle', 0.03, { pan, pri: 0 });
    }, rnd(6, 20));
  } else if (tod === 1) {
    // evening song: slower, lower, fewer
    b.every(5, 11, (t) => birdWhistle(b, t, 0.026), rnd(0.5, 3));
    b.every(12, 26, (t) => birdTwoNote(b, t, 0.02), rnd(3, 8));
    crickets(b, 1, 0.7);
  } else {
    crickets(b, 2);
    b.every(14, 30, (t) => owl(b, t, 0.05), rnd(3, 9));
  }
  // a twig gives somewhere
  b.every(14, 34, (t) => b.core.noise(b.near, t, 0.02, 0.05, 2100, 'bandpass', { q: 3, pan: rnd(-0.7, 0.7), pri: 0 }));
}

function marsh(b: Bed, tod: number): void {
  const water = b.layer('brown', 'lowpass', 480, 0.7, 0.15);
  b.walk(water.g.gain, 0.09, 0.2, 1.5, 3.5);
  b.walk(water.f.frequency, 320, 620, 2, 5);
  b.every(0.25, 1.3, (t) => bloop(b, t, 340, 900, rnd(0.012, 0.03)));
  // flies over the water: a narrow hiss beating fast
  const buzz = b.layer('white', 'bandpass', 5600, 9, tod === 2 ? 0.006 : 0.012, 0.3);
  const d = b.core.ctx.createGain();
  d.gain.value = 0.006;
  b.osc('sine', 83).connect(d).connect(buzz.g.gain);
  b.walk(buzz.f.frequency, 5000, 6300, 3, 7);
  // four frogs, each with its own voice and place, who answer one another
  const frogs = [[104, 900, -0.6], [126, 1100, 0.5], [92, 820, 0.15], [141, 1250, -0.25]] as const;
  const gap = tod === 0 ? [6, 14] : tod === 1 ? [2.5, 6] : [1.5, 4.5];
  b.every(gap[0], gap[1], (t) => {
    const i = Math.floor(Math.random() * frogs.length);
    croak(b, t, frogs[i][0], frogs[i][1], 0.05, frogs[i][2]);
    if (chance(0.45)) {
      const j = (i + 1 + Math.floor(Math.random() * 3)) % frogs.length;
      croak(b, t + rnd(0.45, 0.9), frogs[j][0], frogs[j][1], 0.04, frogs[j][2]);
    }
  }, rnd(1, 3));
  if (tod >= 1) {
    // peepers: many small high voices
    b.every(tod === 2 ? 0.25 : 0.6, tod === 2 ? 0.8 : 1.8, (t) => {
      const f = rnd(2650, 3100);
      b.core.tone(b.near, t, f, 0.065, 'sine', rnd(0.008, 0.016), { slideTo: f * 1.08, attack: 0.012, pan: rnd(-0.8, 0.8), pri: 0 });
    });
    crickets(b, tod, 0.7);
  } else {
    // a warbler in the reeds
    b.every(9, 20, (t) => birdTrill(b, t, 0.018, 3300), rnd(2, 6));
  }
  if (tod === 1) {
    // a bittern booms
    b.every(20, 45, (t) => {
      for (const at of [0, 0.8]) b.core.tone(b.far, t + at, 152, 0.42, 'sine', 0.07, { slideTo: 122, attack: 0.08, pri: 0 });
    }, rnd(5, 14));
  }
}

function town(b: Bed): void {
  wind(b, 0.12, 0);
  murmur(b, 2.4);
  b.every(6, 14, (t) => anvil(b, t, 0.04, b.far), rnd(2, 5));
  b.every(7, 16, (t) => birdTwoNote(b, t, 0.026), rnd(1, 5));
  // a cart axle
  b.every(22, 45, (t) => b.core.tone(b.near, t, 92, 0.55, 'sawtooth', 0.04, { slideTo: 71, fmt: 720, q: 5, attack: 0.15, pan: rnd(-0.6, 0.6), pri: 0 }));
}

function forge(b: Bed): void {
  fire(b, 1);
  murmur(b, 0.8);
  // the bellows breathe in and out
  b.every(3.3, 3.6, (t) => {
    b.core.noise(b.near, t, 1.3, 0.075, 350, 'bandpass', { slideTo: 900, q: 0.8, attack: 0.5, buf: 'pink', pri: 0 });
    b.core.noise(b.near, t + 1.6, 1.2, 0.04, 700, 'bandpass', { slideTo: 300, q: 0.8, attack: 0.4, buf: 'pink', pri: 0 });
  }, 0.4);
  b.every(4, 9, (t) => anvil(b, t, 0.05, b.near), rnd(1, 2.5));
  // iron into the trough
  b.every(28, 55, (t) => {
    b.core.noise(b.near, t, 1.1, 0.07, 3600, 'highpass', { attack: 0.02, pri: 0 });
    for (let i = 0; i < 6; i++) bloop(b, t + 0.1 + i * 0.09, 300, 700, 0.03);
  }, rnd(10, 20));
}

function workshop(b: Bed): void {
  murmur(b, 0.9);
  fire(b, 0.4);
  // a saw: push and pull
  b.every(7, 14, (t) => {
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      b.core.noise(b.near, t + i * 0.5, 0.26, 0.15, 1700, 'bandpass', { q: 1.4, attack: 0.05, slideTo: 2000, pan: -0.3, pri: 0 });
      b.core.noise(b.near, t + i * 0.5 + 0.27, 0.2, 0.09, 1250, 'bandpass', { q: 1.4, attack: 0.04, pan: -0.3, pri: 0 });
    }
  }, rnd(1, 3));
  // a mallet on a chisel
  b.every(5, 12, (t) => {
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const at = t + i * rnd(0.3, 0.36);
      b.core.tone(b.near, at, 430 * rnd(0.97, 1.03), 0.06, 'sine', 0.12, { pan: 0.35, pri: 0 });
      b.core.tone(b.near, at, 905, 0.03, 'triangle', 0.06, { pan: 0.35, pri: 0 });
      b.core.noise(b.near, at, 0.008, 0.09, 3000, 'highpass', { pan: 0.35, pri: 0 });
    }
  }, rnd(3, 6));
  // a plane takes a shaving
  b.every(16, 30, (t) => b.core.noise(b.near, t, 0.55, 0.08, 3200, 'bandpass', { slideTo: 2300, q: 1, attack: 0.08, pan: 0.1, pri: 0 }), rnd(6, 12));
}

function apothecary(b: Bed): void {
  fire(b, 0.4);
  // a pot on the boil
  b.every(0.06, 0.28, (t) => bloop(b, t, 260, 720, rnd(0.03, 0.08)), 0.1);
  const hiss = b.layer('white', 'highpass', 5200, 0.7, 0.012, -0.2);
  b.walk(hiss.g.gain, 0.006, 0.018, 1, 3);
  // glass on glass
  b.every(5, 11, (t) => {
    const n = 1 + Math.floor(Math.random() * 3);
    const pan = rnd(-0.5, 0.5);
    for (let i = 0; i < n; i++) b.core.ring(b.near, t + i * rnd(0.12, 0.2), rnd(2700, 3600), GLASS, 0.06, 0.3, { pan, pri: 0 });
  }, rnd(1.5, 4));
  // pestle round the mortar
  b.every(10, 20, (t) => {
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      b.core.noise(b.near, t + i * 0.62, 0.6, 0.11, 420, 'bandpass', { q: 0.9, attack: 0.25, slideTo: 620, buf: 'brown', pan: 0.3, pri: 0 });
      b.core.noise(b.near, t + i * 0.62, 0.6, 0.025, 3000, 'bandpass', { attack: 0.25, pan: 0.3, pri: 0 });
    }
  }, rnd(4, 9));
  // a slow drip, the one thing in the room that echoes
  b.every(3, 7, (t) => b.core.tone(b.far, t, 1500, 0.035, 'sine', 0.06, { slideTo: 950, pan: -0.4, pri: 0 }));
}

function camp(b: Bed, tod: number, ground: Ground): void {
  fire(b, 1);
  wind(b, 0.07, ground === 'quarry' ? 0.012 : 0);
  crickets(b, tod, 0.9);
  if (ground === 'marsh') {
    b.every(tod === 0 ? 9 : 4, tod === 0 ? 18 : 10, (t) => croak(b, t, rnd(95, 135), rnd(850, 1150), 0.025, rnd(-0.7, 0.7)), rnd(2, 5));
  } else if (ground === 'grove') {
    if (tod === 2) b.every(16, 34, (t) => owl(b, t, 0.04), rnd(4, 10));
    else b.every(8, 18, (t) => birdWhistle(b, t, 0.016, b.far), rnd(2, 6));
  } else if (tod < 2) {
    b.every(14, 30, (t) => {
      const pan = rnd(-0.7, 0.7);
      for (let i = 0; i < 4; i++) b.core.tone(b.near, t + i * rnd(0.06, 0.12), rnd(900, 2400), 0.014, 'triangle', 0.015, { pan, pri: 0 });
    });
  }
}

function gate(b: Bed, groan: boolean): void {
  wind(b, 0.24, 0.035);
  if (groan) fire(b, 0.35);
  // the ground itself
  const rumble = b.layer('brown', 'lowpass', 85, 0.7, 0.16);
  b.walk(rumble.g.gain, 0.06, 0.3, 2, 5);
  if (!groan) return;
  // whatever is past the gate, shifting its weight
  b.every(12, 25, (t) => b.core.tone(b.far, t, 62, 1.8, 'sawtooth', 0.09, { slideTo: 50, fmt: 240, q: 1.2, attack: 0.7, pri: 0 }), rnd(3, 7));
}

// ---------------------------------------------------------------- manager
/** Places that have a slot for a recording. The gate and the cold summary are always synthesised. */
const BED_SLOT: Partial<Record<Place, string>> = { quarry: 'quarry', grove: 'grove', marsh: 'marsh', town: 'town', forge: 'forge', workshop: 'workshop', apothecary: 'apothecary', camp: 'camp' };
const NIGHT_LEVEL = [0, 0.5, 1]; // how much of the night layer by day, dusk and night
const WAIT = 4; // seconds to wait for a manifest or a file before giving the place its synthesised bed

interface Want { place: Place; tod: number; ground: Ground; since: number }

export class Beds {
  private cur: Bed | null = null;
  private dying: Bed[] = [];
  private key = '';
  private want: Want | null = null; // a place whose bed is not built yet: its recording is still loading
  private solo: string | null = null; // a file the soundboard asked to hear by itself, not yet started
  /** What the bed now playing is made of, for the soundboard: 'synth', a candidate id, 'off', or '' while waiting. */
  playing = '';

  constructor(private core: Core, private samples: Samples | null = null) {}

  /** Cross-fade to the bed of a place. Camp borrows a little from the ground it is pitched on. */
  set(place: Place, tod = 0, ground: Ground = 'quarry'): void {
    const key = place === 'none' ? '' : `${place}:${place === 'camp' ? ground : ''}:${['quarry', 'grove', 'marsh', 'camp'].includes(place) ? tod : 0}:${this.samples?.version ?? 0}`;
    if (key === this.key) return;
    this.key = key;
    if (this.cur) {
      this.cur.stop(this.core.now);
      this.dying.push(this.cur);
      this.cur = null;
    }
    this.playing = '';
    this.solo = null;
    this.want = place === 'none' ? null : { place, tod, ground, since: this.core.now };
    this.build();
  }

  /** The soundboard: play one recording by itself, looped, in place of whatever bed is up. Null stops it. */
  audition(file: string | null): void {
    this.set('none');
    this.key = `audition:${file}`;
    this.solo = file;
  }

  /** Build the wanted bed if everything it needs has arrived; otherwise leave it wanted and try again next tick. */
  private build(): void {
    if (this.solo && this.samples) {
      const e = this.samples.entry(this.solo, true);
      if (e.state === 'loading') return;
      if (e.state === 'ready') {
        this.cur = new Bed(this.core);
        this.cur.record(e);
        this.playing = this.solo;
      }
      this.solo = null;
      return;
    }
    const w = this.want;
    if (!w) return;
    const s = this.samples;
    const late = this.core.now - w.since > WAIT;
    const slot = BED_SLOT[w.place];
    let rec: Loaded | null = null;
    let night: Loaded | null = null;
    let synthNight = false;
    if (s && slot && !late) {
      if (!s.settled) return; // the manifests are still on their way
      const c = s.pick(slot);
      if (c === 'off') {
        this.want = null;
        this.playing = 'off';
        return;
      }
      if (c !== 'synth') {
        const e = s.entry(c.files[0], true);
        if (e.state === 'loading') return;
        if (e.state === 'ready') {
          rec = e;
          this.playing = c.id;
        }
      }
      // a ground or a camp at dusk or night gets the night layer over its recording
      if (rec && w.tod > 0 && w.place !== 'town' && slot === w.place) {
        const n = s.pick('night');
        if (n === 'synth') synthNight = true;
        else if (n !== 'off') {
          const e = s.entry(n.files[0], true);
          if (e.state === 'loading') return;
          if (e.state === 'ready') night = e;
          else synthNight = true;
        }
      }
    }
    this.want = null;
    const b = (this.cur = new Bed(this.core));
    if (rec) {
      b.record(rec);
      if (night) b.record(night, NIGHT_LEVEL[w.tod] ?? 1);
      else if (synthNight) crickets(b, w.tod, 0.9);
      return;
    }
    this.playing = 'synth';
    switch (w.place) {
      case 'quarry': quarry(b, w.tod); break;
      case 'grove': grove(b, w.tod); break;
      case 'marsh': marsh(b, w.tod); break;
      case 'town': town(b); break;
      case 'forge': forge(b); break;
      case 'workshop': workshop(b); break;
      case 'apothecary': apothecary(b); break;
      case 'camp': camp(b, w.tod, w.ground); break;
      case 'gate': gate(b, true); break;
      case 'cold': gate(b, false); break;
    }
  }
  tick(): void {
    const now = this.core.now;
    if (this.want || this.solo) this.build();
    this.cur?.tick(now);
    for (let i = this.dying.length - 1; i >= 0; i--) {
      if (now < this.dying[i].freeAt) continue;
      this.dying[i].free();
      this.dying.splice(i, 1);
    }
  }
  /** Release every node at once (the context is going away or the sound was switched off). */
  dispose(): void {
    this.cur?.free();
    for (const b of this.dying) b.free();
    this.cur = null;
    this.dying.length = 0;
    this.want = null;
    this.key = '';
  }
}
