// Shared drawing helpers for the arena art: colour maths, cached sprites, inked shapes, noise.
// Style rules (see the two RimWorld-family briefs): soft noise ground without outlines; everything you can
// interact with in flat two-to-four tone fills with a thick black outline; effects without outline.
import { mulberry32 } from '../game';

/** One virtual tile: the player's body width. Every size in the art is derived from it. */
export const T = 28;
export const INK = '#0b0a0a';

export type Ctx = CanvasRenderingContext2D;
export type Rnd = () => number;
export const rng = (seed: number): Rnd => mulberry32(seed | 0);

// ------------------------------------------------------------------ colour

export function hexRgb(hex: string): [number, number, number] {
  const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : hex;
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const to2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
export const rgbHex = (r: number, g: number, b: number) => `#${to2(r)}${to2(g)}${to2(b)}`;
/** Multiply a colour: k below 1 darkens, above 1 lightens. */
export function shade(hex: string, k: number): string {
  const [r, g, b] = hexRgb(hex);
  return rgbHex(r * k, g * k, b * k);
}
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexRgb(a);
  const [r2, g2, b2] = hexRgb(b);
  return rgbHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ----------------------------------------------------------------- sprites

/** Sprite pixels per world unit. Set by the renderer from the screen scale; changing it empties every cache. */
let RES = 2;
const caches: Map<string, unknown>[] = [];
export const res = () => RES;
export function setRes(pxPerUnit: number): void {
  const q = Math.max(1.5, Math.min(3, Math.ceil(pxPerUnit * 2) / 2));
  if (q === RES) return;
  RES = q;
  for (const c of caches) c.clear();
}
export function cache<V>(): Map<string, V> {
  const m = new Map<string, V>();
  caches.push(m as Map<string, unknown>);
  return m;
}

export interface Sprite {
  c: HTMLCanvasElement;
  ox: number; // where the sprite's origin sits inside it, in world units
  oy: number;
  w: number; // size in world units
  h: number;
}

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Draw once into an offscreen canvas. `draw` works in world units with the origin at (ox, oy). */
export function sprite(w: number, h: number, ox: number, oy: number, draw: (c: Ctx) => void, pxPerUnit = RES): Sprite {
  const cv = canvas(w * pxPerUnit, h * pxPerUnit);
  const c = cv.getContext('2d')!;
  c.scale(pxPerUnit, pxPerUnit);
  c.translate(ox, oy);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  return { c: cv, ox, oy, w, h };
}
/** A sprite centred on its origin. */
export const centred = (half: number, draw: (c: Ctx) => void): Sprite => sprite(half * 2, half * 2, half, half, draw);

/** The same silhouette in one flat colour (hit flash, afterimage, outline glow). */
export function tinted(s: Sprite, color: string): Sprite {
  const cv = canvas(s.c.width, s.c.height);
  const c = cv.getContext('2d')!;
  c.drawImage(s.c, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color;
  c.fillRect(0, 0, cv.width, cv.height);
  return { ...s, c: cv };
}

/** The silhouette grown by `grow` world units in one colour: a halo to draw under the sprite. */
export function halo(s: Sprite, color: string, grow: number): Sprite {
  const flat = tinted(s, color);
  const pad = grow + 1;
  const k = s.c.width / s.w;
  return sprite(s.w + pad * 2, s.h + pad * 2, s.ox + pad, s.oy + pad, (c) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.drawImage(flat.c, -s.ox + Math.cos(a) * grow, -s.oy + Math.sin(a) * grow, s.w, s.h);
    }
  }, k);
}

export function blit(c: Ctx, s: Sprite, x: number, y: number, rot = 0, sx = 1, sy = sx): void {
  if (rot === 0 && sx === 1 && sy === 1) {
    c.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h);
    return;
  }
  c.save();
  c.translate(x, y);
  if (rot) c.rotate(rot);
  if (sx !== 1 || sy !== 1) c.scale(sx, sy);
  c.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
  c.restore();
}

// ------------------------------------------------------------------ shapes

/** The outline goes outside the fill: stroke at double width, then fill over the inner half. */
export function inked(c: Ctx, p: Path2D, fill: string | CanvasGradient, ow: number, ink = INK): void {
  c.strokeStyle = ink;
  c.lineWidth = ow * 2;
  c.stroke(p);
  c.fillStyle = fill;
  c.fill(p);
}

export interface Part {
  p: Path2D;
  fill: string | CanvasGradient;
  line?: number; // interior line weight as a share of the outline; 0 for none
}
/** Several touching parts under one even outer outline, with thinner lines where they overlap. */
export function composite(c: Ctx, parts: Part[], ow: number, ink = INK): void {
  c.strokeStyle = ink;
  c.lineWidth = ow * 2;
  for (const q of parts) c.stroke(q.p);
  for (const q of parts) {
    const lw = q.line ?? 0.5;
    if (lw > 0) {
      c.lineWidth = ow * 2 * lw;
      c.stroke(q.p);
    }
    c.fillStyle = q.fill;
    c.fill(q.p);
  }
}

export type Pt = [number, number];

/** Closed smooth shape through the midpoints of a control polygon. */
export function smooth(pts: Pt[]): Path2D {
  const p = new Path2D();
  const m = pts.length;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const s = mid(pts[m - 1], pts[0]);
  p.moveTo(s[0], s[1]);
  for (let i = 0; i < m; i++) {
    const e = mid(pts[i], pts[(i + 1) % m]);
    p.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]);
  }
  p.closePath();
  return p;
}
/** Closed polygon with sharp corners. */
export function poly(pts: Pt[]): Path2D {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}
/** Polygon with softened corners. */
export function roundPoly(pts: Pt[], r: number): Path2D {
  const p = new Path2D();
  const m = pts.length;
  const a = pts[m - 1];
  const b = pts[0];
  p.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  for (let i = 0; i < m; i++) {
    const q = pts[i];
    const n = pts[(i + 1) % m];
    p.arcTo(q[0], q[1], (q[0] + n[0]) / 2, (q[1] + n[1]) / 2, r);
  }
  p.closePath();
  return p;
}
export function ell(x: number, y: number, rx: number, ry = rx, rot = 0): Path2D {
  const p = new Path2D();
  p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  return p;
}
/** A shape symmetric about the x axis from its upper outline, listed front (+x) to back. */
export function sym(upper: Pt[], round = true): Path2D {
  const pts: Pt[] = [...upper];
  for (let i = upper.length - 1; i >= 0; i--) if (Math.abs(upper[i][1]) > 1e-6) pts.push([upper[i][0], -upper[i][1]]);
  return round ? smooth(pts) : poly(pts);
}
/** A tapered, slightly curved spike from a base to a sharp tip. `bend` pushes the middle sideways. */
export function spike(bx: number, by: number, tx: number, ty: number, w: number, bend = 0): Path2D {
  const dx = tx - bx;
  const dy = ty - by;
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  const mx = (bx + tx) / 2 + nx * bend;
  const my = (by + ty) / 2 + ny * bend;
  const p = new Path2D();
  p.moveTo(bx + nx * w / 2, by + ny * w / 2);
  p.quadraticCurveTo(mx + nx * w * 0.3, my + ny * w * 0.3, tx, ty);
  p.quadraticCurveTo(mx - nx * w * 0.3, my - ny * w * 0.3, bx - nx * w / 2, by - ny * w / 2);
  p.closePath();
  return p;
}
/** Smooth closed outline from a width profile (full width / height at 0%, 10% .. 100%, top to bottom). */
export function blob(cx: number, top: number, h: number, prof: number[], ow: number, wMul = 1): Path2D {
  const n = prof.length - 1;
  const pts: Pt[] = [];
  const y = (i: number) => top + ow + (i / n) * (h - 2 * ow);
  const hw = (i: number) => Math.max(0.5, (prof[i] * h * wMul) / 2 - ow);
  for (let i = 0; i <= n; i++) pts.push([cx + hw(i), y(i)]);
  for (let i = n; i >= 0; i--) pts.push([cx - hw(i), y(i)]);
  return smooth(pts);
}

/** Soft two-tone fill: base in the middle, shade towards the rim (shading only ever goes darker). */
export function soft(c: Ctx, x: number, y: number, r0: number, r1: number, base: string, k = 0.78): CanvasGradient {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  g.addColorStop(0, base);
  g.addColorStop(1, shade(base, k));
  return g;
}
export function lin(c: Ctx, x0: number, y0: number, x1: number, y1: number, a: string, b: string): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

// ------------------------------------------------------------------- noise

/** A small canvas of random greys; stretched with smoothing it gives cloudy mottling. */
export function noiseCanvas(w: number, h: number, rnd: Rnd, lo = 0, hi = 255): HTMLCanvasElement {
  const cv = canvas(w, h);
  const g = cv.getContext('2d')!;
  const d = g.createImageData(cv.width, cv.height);
  const n = cv.width * cv.height;
  for (let i = 0; i < n; i++) {
    const v = (lo + (hi - lo) * rnd()) | 0;
    d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v;
    d.data[i * 4 + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return cv;
}

/** Smooth value noise in 0..1 over the plane; `cell` is the feature size. */
export function field(rnd: Rnd, cell: number): (x: number, y: number) => number {
  const N = 64;
  const g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const at = (ix: number, iy: number) => g[(((iy % N) + N) % N) * N + (((ix % N) + N) % N)];
  return (x, y) => {
    const fx = x / cell;
    const fy = y / cell;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    let tx = fx - ix;
    let ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx;
    const b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
    return a + (b - a) * ty;
  };
}

export function hash2(x: number, y: number): number {
  let h = (Math.round(x) * 374761393 + Math.round(y) * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}
