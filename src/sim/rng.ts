// Seeded RNG. Each stream is a single uint32 of state (mulberry32) kept in a
// shared Uint32Array so the whole RNG state can be hashed and never allocates.
// Streams are separate so that, for example, a change to how drops roll does
// not shift which enemies spawn or what the bench offers.

export const enum Stream { Spawn = 0, Drop = 1, Bench = 2, Combat = 3, Ai = 4, Upgrade = 5 }
export const STREAMS = 6;

function mix(n: number): number {
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return (n ^ (n >>> 16)) >>> 0;
}

export function seedStreams(seed: number): Uint32Array {
  const s = new Uint32Array(STREAMS);
  for (let i = 0; i < STREAMS; i++) s[i] = mix((seed >>> 0) + Math.imul(i + 1, 0x9e3779b9));
  return s;
}

/** Uniform float in [0, 1). */
export function rnd(s: Uint32Array, stream: Stream): number {
  let t = (s[stream] = (s[stream] + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform integer in [0, n). */
export function rndInt(s: Uint32Array, stream: Stream, n: number): number {
  return Math.floor(rnd(s, stream) * n);
}

/** Uniform float in [a, b). */
export function rndRange(s: Uint32Array, stream: Stream, a: number, b: number): number {
  return a + rnd(s, stream) * (b - a);
}
