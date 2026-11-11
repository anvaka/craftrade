// Blockprint Almanac: the print press.
//
// Everything on screen is cut from the same block with the same knife. This
// file owns the rules so that no drawing can break them by accident:
//
//   - seven colours, each with one job (see PALETTE and docs/DESIGN.md 7.1)
//   - one outline weight (OUTLINE = 3 css px) and one hatch weight (HATCH)
//   - straight segments only; corners are cut, never rounded
//     (the single exception is Print.disc, reserved for enemy spit)
//   - every flat fill sits 1-2 px off its outline. The offset is per colour
//     plate and seeded per sprite, like a print out of register
//   - shade is a hatch or a second flat shape, never a gradient
//   - there is no white. A highlight is a knockout (Print.cut) that lets the
//     ground show through, as cut-away areas do in a relief print
//
// Drawings are functions (p: Print) => void in css px with the origin at the
// sprite's anchor (feet for creatures, centre for small things), facing
// right. bake() runs a drawing three times: once dry to measure it, once for
// the colour sprite and once for the solid-Ink silhouette used as hit flash.

export const INK = '#1B2226';
export const BONE = '#D9D3BD';
export const MOSS = '#7C8C5A';
export const SPRUCE = '#2F4A3C';
export const OCHRE = '#D99A2B';
export const MADDER = '#B8402E';
export const WOAD = '#3E6C8A';

export const PALETTE = { ink: INK, bone: BONE, moss: MOSS, spruce: SPRUCE, ochre: OCHRE, madder: MADDER, woad: WOAD } as const;
export type Colour = (typeof PALETTE)[keyof typeof PALETTE];

/** The one outline weight, css px. */
export const OUTLINE = 3;
/** The one hatch weight, css px. */
export const HATCH = 1.5;

/** A baked sprite. Sizes and anchor are css px; the canvas is w*dpr by h*dpr. */
export interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  /** Anchor, css px from the top-left corner. drawSprite puts this point at (x, y). */
  ax: number;
  ay: number;
  /** Solid-Ink silhouette of the same drawing, same size and anchor. Used for the 2-frame hit flash. */
  ink: Sprite;
}

export type Pts = readonly number[];
export type Drawing = (p: Print) => void;

// ---------------------------------------------------------------- seeded noise

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Small seeded generator (mulberry32). Art only; the sim has its own. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(Math.round(x * 8) | 0, 374761393) ^ Math.imul(Math.round(y * 8) | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Mirror a point list in x. */
export function mirror(pts: Pts): number[] {
  const out: number[] = [];
  for (let i = pts.length - 2; i >= 0; i -= 2) out.push(-pts[i]!, pts[i + 1]!);
  return out;
}

// ---------------------------------------------------------------------- Print

type Mat = [number, number, number, number, number, number];

export class Print {
  /** True while baking the solid-Ink silhouette. Drawings rarely need it. */
  readonly sil: boolean;
  /** Geometry scale. Coordinates are multiplied by k; line weights are not. Icons use k = 2 for the large size. */
  readonly k: number;
  /** Seeded generator for scatter inside a drawing (tufts, chips). Reset for every pass. */
  rnd: () => number;

  minX = Infinity;
  minY = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;

  private ctx: CanvasRenderingContext2D | null;
  private m: Mat = [1, 0, 0, 1, 0, 0];
  private stack: Mat[] = [];
  private seed: number;
  private plates = new Map<string, [number, number]>();
  private jitter: number;

  constructor(ctx: CanvasRenderingContext2D | null, seed: number, sil: boolean, k = 1, jitter = 0.7) {
    this.ctx = ctx;
    this.seed = seed;
    this.sil = sil;
    this.k = k;
    this.jitter = jitter;
    this.rnd = rng(seed ^ 0x9e3779b9);
    if (ctx) {
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 2.5;
      ctx.lineCap = 'butt';
    }
  }

  // ---- transforms (applied to points, so strokes never scale)

  /** Run fn with a local transform: move to (x, y), rotate by deg, scale by (sx, sy). */
  at(x: number, y: number, deg: number, fn: () => void, sx = 1, sy = sx): void {
    const r = (deg * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    const [a, b, cc, d, e, f] = this.m;
    this.stack.push(this.m);
    // m * T(x,y) * R * S
    const la = c * sx;
    const lb = s * sx;
    const lc = -s * sy;
    const ld = c * sy;
    this.m = [a * la + cc * lb, b * la + d * lb, a * lc + cc * ld, b * lc + d * ld, a * x + cc * y + e, b * x + d * y + f];
    fn();
    this.m = this.stack.pop()!;
  }

  private tf(pts: Pts, jit = true): number[] {
    const [a, b, c, d, e, f] = this.m;
    const k = this.k;
    const out = new Array<number>(pts.length);
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i]!;
      const py = pts[i + 1]!;
      let x = (a * px + c * py + e) * k;
      let y = (b * px + d * py + f) * k;
      if (jit && this.jitter > 0) {
        x += (hash2(this.seed, px, py) - 0.5) * 2 * this.jitter;
        y += (hash2(this.seed ^ 0x51ed27, px, py) - 0.5) * 2 * this.jitter;
      }
      out[i] = x;
      out[i + 1] = y;
      if (x < this.minX) this.minX = x;
      if (x > this.maxX) this.maxX = x;
      if (y < this.minY) this.minY = y;
      if (y > this.maxY) this.maxY = y;
    }
    return out;
  }

  private trace(t: number[], close: boolean, dx = 0, dy = 0): void {
    const ctx = this.ctx!;
    ctx.beginPath();
    ctx.moveTo(t[0]! + dx, t[1]! + dy);
    for (let i = 2; i < t.length; i += 2) ctx.lineTo(t[i]! + dx, t[i + 1]! + dy);
    if (close) ctx.closePath();
  }

  /** Seeded misregistration for a colour plate: 1 to 2 px in a fixed direction. */
  private plate(colour: string): [number, number] {
    if (this.sil) return [0, 0];
    let o = this.plates.get(colour);
    if (!o) {
      const h = hashStr(colour) ^ this.seed;
      const ang = hash2(h, 1, 2) * Math.PI * 2;
      const mag = 1 + hash2(h, 3, 4);
      o = [Math.cos(ang) * mag, Math.sin(ang) * mag];
      this.plates.set(colour, o);
    }
    return o;
  }

  // ---- marks

  /** A closed cut shape: flat fill (off register) under an Ink outline. fill null = outline only. */
  shape(pts: Pts, fill: Colour | null): void {
    const t = this.tf(pts);
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.sil) {
      this.trace(t, true);
      ctx.fillStyle = INK;
      ctx.fill();
    } else if (fill) {
      const [dx, dy] = this.plate(fill);
      this.trace(t, true, dx, dy);
      ctx.fillStyle = fill;
      ctx.fill();
    }
    this.trace(t, true);
    ctx.strokeStyle = INK;
    ctx.lineWidth = OUTLINE;
    ctx.stroke();
  }

  /** A flat shape with no outline: a second colour laid over a fill, or a solid Ink mass. */
  flat(pts: Pts, colour: Colour): void {
    const t = this.tf(pts);
    const ctx = this.ctx;
    if (!ctx) return;
    const [dx, dy] = colour === INK ? [0, 0] : this.plate(colour);
    this.trace(t, true, dx, dy);
    ctx.fillStyle = this.sil ? INK : colour;
    ctx.fill();
  }

  /** Ground shade under a creature. Spruce in both the colour and the silhouette pass. */
  shadow(pts: Pts): void {
    const t = this.tf(pts, false);
    const ctx = this.ctx;
    if (!ctx) return;
    this.trace(t, true);
    ctx.fillStyle = SPRUCE;
    ctx.fill();
  }

  /** An open Ink line at the outline weight (or the hatch weight if thin). */
  line(pts: Pts, thin = false, colour: Colour = INK): void {
    const t = this.tf(pts);
    const ctx = this.ctx;
    if (!ctx) return;
    this.trace(t, false);
    ctx.strokeStyle = this.sil ? INK : colour;
    ctx.lineWidth = thin ? HATCH : OUTLINE;
    ctx.stroke();
  }

  /** Parallel hatch lines clipped to a polygon. deg is the line direction, gap the spacing in px. */
  hatch(pts: Pts, deg: number, gap = 4, colour: Colour = INK, weight = HATCH): void {
    const t = this.tf(pts);
    const ctx = this.ctx;
    if (!ctx || this.sil) return;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < t.length; i += 2) {
      x0 = Math.min(x0, t[i]!);
      x1 = Math.max(x1, t[i]!);
      y0 = Math.min(y0, t[i + 1]!);
      y1 = Math.max(y1, t[i + 1]!);
    }
    const r = (deg * Math.PI) / 180;
    const dx = Math.cos(r);
    const dy = Math.sin(r);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const L = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
    ctx.save();
    this.trace(t, true);
    ctx.clip();
    ctx.beginPath();
    // Phase is seeded so two hatched patches never line up by accident.
    const phase = hash2(this.seed, t[0]!, t[1]!) * gap;
    for (let s = -L + phase; s <= L; s += gap) {
      const px = cx - dy * s;
      const py = cy + dx * s;
      ctx.moveTo(px - dx * L, py - dy * L);
      ctx.lineTo(px + dx * L, py + dy * L);
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = weight;
    ctx.stroke();
    ctx.restore();
  }

  /** Knock a polygon out to bare ground. The only highlight there is. Skipped in the silhouette. */
  cut(pts: Pts): void {
    const t = this.tf(pts);
    const ctx = this.ctx;
    if (!ctx || this.sil) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    this.trace(t, true);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
  }

  /** A small solid Ink facet: eyes, nail heads, punched dots. Four cut sides, never a circle. */
  dot(x: number, y: number, r = 1.6): void {
    this.flat([x - r, y - r * 0.3, x - r * 0.2, y - r, x + r, y - r * 0.4, x + r * 0.3, y + r, x - r * 0.8, y + r * 0.8], INK);
  }

  /** A knocked-out eye with an Ink rim, for dark heads. */
  eye(x: number, y: number, r = 2): void {
    this.cut([x - r, y, x - r * 0.3, y - r, x + r, y - r * 0.5, x + r * 0.6, y + r * 0.8, x - r * 0.5, y + r]);
  }

  /** The one round mark. Enemy spit only (DESIGN 3.7). */
  disc(x: number, y: number, r: number, fill: Colour): void {
    const t = this.tf([x - r - 1, y - r - 1, x + r + 1, y + r + 1], false);
    const ctx = this.ctx;
    if (!ctx) return;
    const cx = (t[0]! + t[2]!) / 2;
    const cy = (t[1]! + t[3]!) / 2;
    const rr = r * this.k;
    const [dx, dy] = this.plate(fill);
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, rr, 0, Math.PI * 2);
    ctx.fillStyle = this.sil ? INK : fill;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = OUTLINE;
    ctx.stroke();
  }
}

// ----------------------------------------------------------------------- bake

export interface BakeOpts {
  /** Geometry scale (line weights stay fixed). */
  k?: number;
  /** Fixed box [w, h] in css px with the anchor at its centre. Without it the sprite is trimmed to its drawing. */
  box?: readonly [number, number];
  /** Per-vertex jitter in px. Default 0.7. */
  jitter?: number;
}

/** Clamp a device pixel ratio to what the kit bakes for: 1 to 2. */
export function capDpr(dpr: number): number {
  return Math.max(1, Math.min(2, dpr || 1));
}

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Bake one drawing to an offscreen canvas plus its Ink silhouette.
 * seedName fixes the misregistration and jitter: frames of one creature
 * should share it so the plates do not jump between frames.
 */
export function bake(dpr: number, seedName: string, draw: Drawing, opts: BakeOpts = {}): Sprite {
  dpr = capDpr(dpr);
  const seed = hashStr(seedName);
  const k = opts.k ?? 1;
  const jitter = opts.jitter ?? 0.7;
  let w: number;
  let h: number;
  let ax: number;
  let ay: number;
  if (opts.box) {
    w = opts.box[0];
    h = opts.box[1];
    ax = w / 2;
    ay = h / 2;
  } else {
    const dry = new Print(null, seed, false, k, jitter);
    draw(dry);
    const pad = 4; // half outline + worst plate offset
    ax = Math.ceil(-dry.minX + pad);
    ay = Math.ceil(-dry.minY + pad);
    w = ax + Math.ceil(dry.maxX + pad);
    h = ay + Math.ceil(dry.maxY + pad);
    if (!isFinite(w) || !isFinite(h)) {
      w = h = 2;
      ax = ay = 1;
    }
  }
  const pass = (sil: boolean): HTMLCanvasElement => {
    const c = newCanvas(Math.ceil(w * dpr), Math.ceil(h * dpr));
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, ax * dpr, ay * dpr);
    draw(new Print(ctx, seed, sil, k, jitter));
    return c;
  };
  const inkCanvas = pass(true);
  const ink = { canvas: inkCanvas, w, h, ax, ay } as Sprite;
  ink.ink = ink;
  return { canvas: pass(false), w, h, ax, ay, ink };
}

/**
 * Draw a baked sprite with its anchor at (x, y), in css px of the current
 * transform. flipX mirrors about the anchor (sprites face right). Pass
 * sprite.ink for the hit flash. rot is radians, for spinning projectiles.
 * For crisp prints, round x and y to device pixels before calling.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
  flipX = false,
  scale = 1,
  rot = 0,
): void {
  if (!flipX && scale === 1 && rot === 0) {
    ctx.drawImage(s.canvas, x - s.ax, y - s.ay, s.w, s.h);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(flipX ? -scale : scale, scale);
  ctx.drawImage(s.canvas, -s.ax, -s.ay, s.w, s.h);
  ctx.restore();
}

/**
 * A fresh <canvas> element showing a sprite, for DOM UI (icons in ledger
 * rows). It is sized in css px and carries class "icon".
 */
export function spriteElement(s: Sprite, className = 'icon'): HTMLCanvasElement {
  const c = newCanvas(s.canvas.width, s.canvas.height);
  c.getContext('2d')!.drawImage(s.canvas, 0, 0);
  c.style.width = `${s.w}px`;
  c.style.height = `${s.h}px`;
  c.className = className;
  return c;
}
