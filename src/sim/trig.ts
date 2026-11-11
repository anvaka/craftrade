// Sine and cosine from + - * / and Math.floor only. Those are exact under IEEE 754 in every engine, while
// Math.sin and Math.cos may differ in the last bit between browsers. The server replays runs, so the sim
// step must give the same numbers everywhere. Error is under 1e-7, far below anything the sim can see.
const PI = 3.141592653589793, HALF_PI = PI / 2, TAU = 2 * PI;
const S3 = -1 / 6, S5 = 1 / 120, S7 = -1 / 5040, S9 = 1 / 362880, S11 = -1 / 39916800, S13 = 1 / 6227020800;

export function tsin(x: number): number {
  x -= Math.floor(x / TAU + 0.5) * TAU;
  if (x > HALF_PI) x = PI - x; else if (x < -HALF_PI) x = -PI - x;
  const x2 = x * x;
  return x * (1 + x2 * (S3 + x2 * (S5 + x2 * (S7 + x2 * (S9 + x2 * (S11 + x2 * S13))))));
}

export function tcos(x: number): number { return tsin(x + HALF_PI); }

/** b to the power n for a whole n >= 0, by repeated multiplication (Math.pow is not exact everywhere). */
export function ipow(b: number, n: number): number {
  let r = 1;
  for (let i = 0; i < n; i++) r *= b;
  return r;
}
