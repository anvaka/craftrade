// Gathering: the pick on ore, the axe on wood, the sickle through reeds, and what each sounds like when it gives.
// Every strike is three things: a hard close transient, the body of the material, and loose bits after it.
// All of it goes to the `strike` bus, where the place answers (see SPACES in core.ts): that late copy is what
// makes a strike feel as if it happened somewhere. No two strikes are the same: pitch and partials are jittered,
// the material's tier moves the tuning, and a tree sounds deeper each time the cut goes further in.
// When a recording is chosen for a slot (audio/samples.ts) it plays instead of the synthesised sound, through
// the same bus and so the same echo; the tier, rich and depth cues become a small change of its pitch.
import type { Core } from './core';
import { BAR } from './beds';
import type { Samples } from './samples';

export type NodeSound = 'ore' | 'wood' | 'herb' | 'nest';
export interface Strike {
  kind: NodeSound;
  tier: number; // 1..3: higher tiers ring higher (ore), sound denser (wood), finer (herb)
  rich: boolean;
  broke: boolean;
  depth: number; // strikes this node has already taken
  pan: number;
}

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

/** The recording slots of each material: the strike, and the node giving way. */
const SLOTS = { ore: ['pick', 'crumble'], wood: ['axe', 'treefall'], herb: ['sickle', 'reedfall'] } as const;

export function strike(c: Core, s: Strike, t = c.now, samples: Samples | null = null): void {
  if (s.kind === 'nest') {
    nest(c, s, t);
    return;
  }
  const [hit, gives] = SLOTS[s.kind];
  // on a recording the cues are kept small: ore a little higher by tier and when rich, wood a little lower by tier and by depth of cut
  const rate = s.kind === 'ore' ? (1 + 0.03 * (s.tier - 1)) * (s.rich ? 1.04 : 1)
    : s.kind === 'wood' ? (1 - 0.025 * Math.min(4, s.depth)) * (1 - 0.03 * (s.tier - 1)) * (s.rich ? 0.96 : 1)
    : 1 + 0.03 * (s.tier - 1);
  if (!samples?.hit(hit, c.strike, t, { rate, pan: s.pan, vol: s.rich ? 1.15 : 1 })) {
    if (s.kind === 'ore') ore(c, s, t);
    else if (s.kind === 'wood') wood(c, s, t);
    else herb(c, s, t);
  }
  if (s.broke && !samples?.hit(gives, c.strike, t + 0.03, { pan: s.pan })) {
    if (s.kind === 'ore') oreBreak(c, s, t + 0.03);
    else if (s.kind === 'wood') treeFall(c, s, t + 0.04);
    else herbFall(c, s, t + 0.05);
  }
}

function ore(c: Core, s: Strike, t: number): void {
  const d = c.strike;
  const pan = s.pan;
  const f0 = (s.rich ? 1480 : 1120) * (1 + 0.1 * (s.tier - 1)) * rnd(0.97, 1.03);
  // the point bites
  c.noise(d, t, 0.012, 0.5, 5200, 'highpass', { pan, pri: 2 });
  c.tone(d, t, 3100 * rnd(0.9, 1.1), 0.018, 'triangle', 0.16, { pan, pri: 2 });
  // the steel rings
  c.ring(d, t, f0, BAR, s.rich ? 0.2 : 0.17, s.rich ? 0.5 : 0.32, { pan, pri: 2 });
  // the stone takes it
  c.tone(d, t, 150, 0.11, 'sine', 0.26, { slideTo: 62, pan, pri: 2 });
  c.noise(d, t, 0.07, 0.3, 720 * rnd(0.85, 1.15), 'bandpass', { q: 1.2, pan, pri: 2 });
  // a rich vein has something in it: two close high partials that beat against each other
  if (s.rich) {
    c.tone(d, t, f0 * 4.1, 0.55, 'sine', 0.022, { pan, pri: 1 });
    c.tone(d, t, f0 * 4.13, 0.55, 'sine', 0.022, { pan, pri: 1 });
  }
  // chips
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) c.noise(d, t + rnd(0.03, 0.22), 0.02, rnd(0.04, 0.09), rnd(2500, 6000), 'bandpass', { q: 4, pan: pan + rnd(-0.35, 0.35), pri: 0 });
}

function oreBreak(c: Core, s: Strike, t: number): void {
  const d = c.strike;
  // the face lets go
  c.tone(d, t, 110, 0.4, 'sine', 0.3, { slideTo: 42, pan: s.pan, pri: 2 });
  c.noise(d, t, 0.55, 0.26, 520, 'lowpass', { slideTo: 160, pan: s.pan, pri: 2 });
  // and comes down in pieces: many at first, then a few, each lower than the last
  const n = 11;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const at = t + 0.04 + 0.7 * Math.pow(u, 1.7) + rnd(0, 0.03);
    const f = (1500 - 1050 * u) * rnd(0.8, 1.2);
    c.tone(d, at, f, 0.03, 'triangle', 0.14 - 0.09 * u, { pan: s.pan + rnd(-0.5, 0.5), pri: 1 });
    c.noise(d, at, 0.014, 0.1 - 0.06 * u, f * 2.2, 'bandpass', { q: 2, pan: s.pan, pri: 0 });
  }
  // what was inside
  if (s.rich) c.ring(d, t + 0.05, 1480 * (1 + 0.1 * (s.tier - 1)), BAR, 0.09, 0.95, { pan: s.pan, pri: 2 });
}

function wood(c: Core, s: Strike, t: number): void {
  const d = c.strike;
  const pan = s.pan;
  // the cut deepens and the trunk answers lower and hollower; older wood is denser
  const k = rnd(0.95, 1.05) * (1 - 0.06 * Math.min(4, s.depth)) * (1 - 0.07 * (s.tier - 1)) * (s.rich ? 0.88 : 1);
  // the edge goes in
  c.noise(d, t, 0.028, 0.5, 2800, 'highpass', { pan, pri: 2 });
  c.noise(d, t, 0.035, 0.26, 1500 * k, 'bandpass', { q: 1.2, pan, pri: 2 });
  // the thunk: the trunk's two lowest modes and the air in it
  c.tone(d, t, 182 * k, 0.13, 'sine', 0.3, { slideTo: 118 * k, pan, pri: 2 });
  c.tone(d, t, 312 * k, 0.085, 'sine', 0.34, { pan, pri: 2 });
  c.tone(d, t, 528 * k, 0.06, 'sine', 0.2, { pan, pri: 1 });
  c.tone(d, t, 742 * k, 0.05, 'triangle', 0.28, { pan, pri: 1 });
  c.noise(d, t, 0.05, 0.32, 900 * k, 'bandpass', { q: 1.5, pan, pri: 2 });
  // fibres part
  c.noise(d, t + rnd(0.012, 0.022), 0.012, 0.15, 1900, 'bandpass', { q: 3, pan, pri: 0 });
  c.noise(d, t + rnd(0.028, 0.045), 0.012, 0.11, 2300, 'bandpass', { q: 3, pan, pri: 0 });
  // the crown shivers
  c.noise(d, t + 0.05, 0.38, 0.04, 4600, 'highpass', { attack: 0.06, pan, pri: 0 });
}

/** A crack, the hinge creaking, the crown through the air, the ground. There is no fall on screen, so it is quick. */
function treeFall(c: Core, s: Strike, t: number): void {
  const d = c.strike;
  const side = s.pan >= 0 ? 0.45 : -0.45;
  c.noise(d, t, 0.05, 0.35, 1700, 'bandpass', { q: 2, pan: s.pan, pri: 2 });
  c.tone(d, t, 140, 0.09, 'sawtooth', 0.15, { slideTo: 90, pan: s.pan, pri: 1 });
  // a slow sawtooth through a narrow band is a row of clicks that ring: a creak. It tightens, then lets go.
  c.tone(d, t + 0.03, 58, 0.2, 'sawtooth', 0.4, { slideTo: 88, fmt: 640, q: 6, attack: 0.03, pan: s.pan, pri: 2 });
  c.tone(d, t + 0.22, 88, 0.3, 'sawtooth', 0.4, { slideTo: 36, fmt: 560, q: 6, attack: 0.02, pan: s.pan, pri: 2 });
  // the crown comes over
  c.noise(d, t + 0.2, 0.5, 0.3, 900, 'bandpass', { slideTo: 2600, q: 0.8, attack: 0.3, buf: 'pink', pan: s.pan + side * 0.5, pri: 2 });
  for (let i = 0; i < 5; i++) c.noise(d, t + rnd(0.42, 0.66), 0.014, rnd(0.06, 0.12), rnd(1500, 3000), 'bandpass', { q: 3, pan: s.pan + side * rnd(0.3, 1), pri: 0 });
  // and lands
  const land = t + 0.66;
  c.tone(d, land, 82, 0.45, 'sine', 0.46, { slideTo: 34, pan: s.pan + side, pri: 2 });
  c.noise(d, land, 0.3, 0.4, 320, 'lowpass', { pan: s.pan + side, pri: 2 });
  c.noise(d, land, 0.08, 0.24, 1200, 'bandpass', { q: 1, pan: s.pan + side, pri: 1 });
  // leaves settle
  c.noise(d, land + 0.05, 0.7, 0.09, 3500, 'highpass', { attack: 0.05, pan: s.pan + side, pri: 0 });
  for (let i = 0; i < 3; i++) c.noise(d, land + rnd(0.15, 0.6), 0.012, 0.05, rnd(1800, 2800), 'bandpass', { q: 3, pan: s.pan + side, pri: 0 });
}

function herb(c: Core, s: Strike, t: number): void {
  const d = c.strike;
  const pan = s.pan;
  const k = rnd(0.94, 1.06) * (1 + 0.08 * (s.tier - 1));
  // the blade through the air and into the stems: a swish, not a click
  c.noise(d, t, 0.11, 0.44, 3800 * k, 'bandpass', { slideTo: 7500 * k, q: 2.5, attack: 0.015, pan, pri: 2 });
  // thin steel
  c.tone(d, t + 0.01, 5300 * k, 0.14, 'sine', 0.06, { pan, pri: 1 });
  c.tone(d, t + 0.01, 7900 * k, 0.09, 'sine', 0.035, { pan, pri: 0 });
  // stalks part one after another
  const n = 4 + Math.floor(Math.random() * 3) + (s.rich ? 2 : 0);
  for (let i = 0; i < n; i++) c.noise(d, t + 0.015 + i * rnd(0.009, 0.015), 0.014, rnd(0.22, 0.34), rnd(1400, 2600), 'bandpass', { q: 5, pan: pan + rnd(-0.2, 0.2), pri: i < 3 ? 2 : 0 });
  // wet ground under them
  c.tone(d, t + 0.02, 240, 0.07, 'sine', 0.3, { slideTo: 150, pan, pri: 1 });
  c.noise(d, t + 0.02, 0.08, 0.24, 500, 'lowpass', { pan, pri: 1 });
}

function herbFall(c: Core, s: Strike, t: number): void {
  const d = c.strike;
  // the whole stand goes over
  c.noise(d, t, 0.32, 0.36, 2200, 'bandpass', { slideTo: 900, q: 1, attack: 0.05, pan: s.pan, pri: 2 });
  // into the water
  c.tone(d, t + 0.18, 420, 0.09, 'sine', 0.38, { slideTo: 170, pan: s.pan, pri: 2 });
  c.noise(d, t + 0.18, 0.13, 0.14, 3000, 'highpass', { attack: 0.01, pan: s.pan, pri: 1 });
  for (let i = 0; i < 3; i++) {
    const f = rnd(900, 1400);
    c.tone(d, t + 0.26 + i * rnd(0.05, 0.09), f, 0.04, 'sine', 0.12, { slideTo: f * 1.4, attack: 0.006, pan: s.pan + rnd(-0.3, 0.3), pri: 0 });
  }
}

/** A nest is not a material: shell cracking over something wet. */
function nest(c: Core, s: Strike, t: number): void {
  const d = c.strike;
  c.noise(d, t, 0.07, 0.25, 1100 * rnd(0.9, 1.1), 'bandpass', { q: 2, pan: s.pan, pri: 2 });
  c.tone(d, t, 210, 0.1, 'square', 0.08, { slideTo: 120, pan: s.pan, pri: 1 });
  c.tone(d, t, 95, 0.12, 'sine', 0.25, { slideTo: 50, pan: s.pan, pri: 2 });
  c.noise(d, t + 0.02, 0.12, 0.14, 900, 'lowpass', { slideTo: 300, pan: s.pan, pri: 1 });
  if (s.broke) {
    c.noise(d, t + 0.03, 0.4, 0.26, 700, 'lowpass', { slideTo: 180, pan: s.pan, pri: 2 });
    for (let i = 0; i < 5; i++) c.noise(d, t + rnd(0.05, 0.3), 0.02, 0.1, rnd(900, 2000), 'bandpass', { q: 3, pan: s.pan + rnd(-0.4, 0.4), pri: 0 });
  }
}
