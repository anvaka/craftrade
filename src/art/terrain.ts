// The ground of the arena and the rock mass around it, drawn once per wave.
// Ground: soft, low-contrast noise, no outlines, no grid, feathered staircase borders between terrains.
// Rock: a flat dark mass with a bevelled south ledge, a wobbly black rim and a fog feather, so the arena is a clearing.
import { CFG, type Ground } from '../data';
import { T, INK, canvas, field, mix, noiseCanvas, rgba, rng, shade, type Ctx, type Rnd } from './util';

/** Rock shown around the arena before the fog is solid. Beyond it the screen is cleared to the fog colour. */
const MARGIN = 3 * T;
const FLOOR_RES = 1.5; // floor pixels per world unit: the ground is soft, so it need not match the screen

interface Pal {
  base: string; // main floor
  rock: string; // south ledge of the rock (bevel x0.70, recessed top x0.51)
  fog: string; // unexplored rock
}
export const GROUND_PAL: Record<Ground, Pal> = {
  quarry: { base: '#5d5754', rock: '#786d6f', fog: '#3e3534' },
  grove: { base: '#604e3b', rock: '#836d60', fog: '#3e3433' },
  marsh: { base: '#424b37', rock: '#747a72', fog: '#343735' },
};
const SOIL = '#63513f';
const GRASS = ['#495531', '#4f5d38', '#596b3f', '#536239'];
const MUD = '#4b3f31';
const POOL = '#34504c';

export interface Terrain {
  ground: Ground;
  floor: HTMLCanvasElement;
  decals: HTMLCanvasElement; // blood, scorch, rubble: stamped during the wave, one pixel per world unit
  dctx: Ctx;
  fog: string;
  ledge: Path2D;
  notch: Path2D;
  bevel: Path2D;
  rim: Path2D;
  pal: Pal;
}

/** Build the ground for a wave. Pass the previous terrain to reuse its canvases instead of allocating new ones. */
export function buildTerrain(ground: Ground, seed: number, old: Terrain | null = null): Terrain {
  const rnd = rng(seed * 7 + 3);
  const pal = GROUND_PAL[ground];
  const { w: aw, h: ah } = CFG.arena;
  const W = aw + MARGIN * 2;
  const H = ah + MARGIN * 2;
  const floor = old?.floor ?? canvas(W * FLOOR_RES, H * FLOOR_RES);
  const c = floor.getContext('2d')!;
  c.setTransform(FLOOR_RES, 0, 0, FLOOR_RES, MARGIN * FLOOR_RES, MARGIN * FLOOR_RES);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';

  // ---- floor
  c.fillStyle = pal.base;
  c.fillRect(-4, -4, aw + 8, ah + 8);
  if (ground === 'quarry') quarry(c, rnd, pal);
  else if (ground === 'grove') grove(c, rnd, pal);
  else marsh(c, rnd, pal);
  grain(c, rnd, aw, ah, ground === 'quarry' ? 0.2 : 0.26);

  // ---- shadow the rock throws on the floor: a soft bleed all round, and a sun shadow from the north and west walls
  const bleed = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(0,0,0,0.34)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(rx, ry, rw, rh);
  };
  const b = 0.45 * T;
  bleed(0, 0, 0, b, 0, 0, aw, b);
  bleed(0, ah, 0, ah - b, 0, ah - b, aw, b);
  bleed(0, 0, b, 0, 0, 0, b, ah);
  bleed(aw, 0, aw - b, 0, aw - b, 0, b, ah);
  c.fillStyle = 'rgba(0,0,0,0.17)';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(aw, 0);
  c.lineTo(aw, 0.2 * T);
  for (let x = aw; x >= 0.5 * T; x -= T / 2) c.lineTo(x, 0.62 * T + (rnd() - 0.5) * 0.08 * T);
  for (let y = 0.62 * T; y <= ah; y += T / 2) c.lineTo(0.4 * T + (rnd() - 0.5) * 0.06 * T, y);
  c.lineTo(0, ah);
  c.closePath();
  c.fill();

  // ---- rock mass: recessed top near the rim, fog further in
  const top = shade(pal.rock, 0.51);
  c.fillStyle = top;
  c.fillRect(-MARGIN, -MARGIN, W, MARGIN);
  c.fillRect(-MARGIN, ah, W, MARGIN);
  c.fillRect(-MARGIN, 0, MARGIN, ah);
  c.fillRect(aw, 0, MARGIN, ah);
  const f0 = 0.75 * T;
  const f1 = 1.5 * T;
  const fogBand = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgba(pal.fog, 0));
    g.addColorStop(1, pal.fog);
    c.fillStyle = g;
    c.fillRect(rx, ry, rw, rh);
  };
  fogBand(0, -f0, 0, -f1, -MARGIN, -MARGIN, W, MARGIN - f0);
  fogBand(0, ah + f0, 0, ah + f1, -MARGIN, ah + f0, W, MARGIN - f0);
  fogBand(-f0, 0, -f1, 0, -MARGIN, -MARGIN, MARGIN - f0, H);
  fogBand(aw + f0, 0, aw + f1, 0, aw + f0, -MARGIN, MARGIN - f0, H);
  // the outermost band is exactly the fog colour so it meets the cleared screen without a seam
  c.fillStyle = pal.fog;
  c.fillRect(-MARGIN, -MARGIN, W, MARGIN - f1);
  c.fillRect(-MARGIN, ah + f1, W, MARGIN - f1);
  c.fillRect(-MARGIN, -MARGIN, MARGIN - f1, H);
  c.fillRect(aw + f1, -MARGIN, MARGIN - f1, H);

  // ---- crisp parts, drawn live each frame: ledge, bevels, rim
  const lh = 0.4 * T;
  const bw = 0.15 * T;
  const ledge = new Path2D();
  ledge.moveTo(-bw, 0);
  ledge.lineTo(-bw, -lh * 0.7);
  for (let x = -bw + 3; x < aw + bw; x += T / 5) ledge.lineTo(x, -lh + (rnd() - 0.5) * 0.08 * T);
  ledge.lineTo(aw + bw, -lh * 0.7);
  ledge.lineTo(aw + bw, 0);
  ledge.closePath();
  const notch = new Path2D();
  for (let x = T * (0.3 + rnd() * 0.4); x < aw; x += T) {
    const nw = 0.07 * T;
    notch.moveTo(x - nw, -lh - 1.5);
    notch.lineTo(x + nw, -lh - 1.5);
    notch.lineTo(x + (rnd() - 0.5) * 2, -lh * 0.45);
    notch.closePath();
  }
  const bevel = new Path2D();
  bevel.rect(-bw, -lh * 0.7, bw, ah + lh * 0.7 + 0.07 * T);
  bevel.rect(aw, -lh * 0.7, bw, ah + lh * 0.7 + 0.07 * T);
  bevel.rect(-bw, ah, aw + bw * 2, 0.07 * T);

  const rim = new Path2D();
  const wob = (s: number) => Math.sin(s * 0.67) * 0.5 + Math.sin(s * 0.23 + 1.3) * 0.5 + (rnd() - 0.5) * 0.5;
  const cr = 0.3 * T;
  const step = 0.15 * T;
  let first = true;
  const put = (x: number, y: number) => {
    if (first) rim.moveTo(x, y);
    else rim.lineTo(x, y);
    first = false;
  };
  for (let x = cr; x <= aw - cr; x += step) put(x, wob(x) * 0.9);
  for (let a = -Math.PI / 2; a <= 0; a += 0.3) put(aw - cr + Math.cos(a) * cr, cr + Math.sin(a) * cr);
  for (let y = cr; y <= ah - cr; y += step) put(aw + wob(y + 900) * 0.9, y);
  for (let a = 0; a <= Math.PI / 2; a += 0.3) put(aw - cr + Math.cos(a) * cr, ah - cr + Math.sin(a) * cr);
  for (let x = aw - cr; x >= cr; x -= step) put(x, ah + wob(x + 300) * 0.9);
  for (let a = Math.PI / 2; a <= Math.PI; a += 0.3) put(cr + Math.cos(a) * cr, ah - cr + Math.sin(a) * cr);
  for (let y = ah - cr; y >= cr; y -= step) put(wob(y + 500) * 0.9, y);
  for (let a = Math.PI; a <= Math.PI * 1.5; a += 0.3) put(cr + Math.cos(a) * cr, cr + Math.sin(a) * cr);
  rim.closePath();

  const decals = old?.decals ?? canvas(aw, ah);
  const dctx = decals.getContext('2d')!;
  dctx.clearRect(0, 0, aw, ah);
  return { ground, floor, decals, dctx, fog: pal.fog, ledge, notch, bevel, rim, pal };
}

/** Floor, decals and the rock rim. `peak` in 0..1 tints the wall red: the wave's peak cue. */
export function drawTerrain(c: Ctx, t: Terrain, peak: number, time: number): void {
  const { w: aw, h: ah } = CFG.arena;
  c.drawImage(t.floor, -MARGIN, -MARGIN, aw + MARGIN * 2, ah + MARGIN * 2);
  c.drawImage(t.decals, 0, 0, aw, ah);
  const ledgeCol = peak > 0 ? mix(t.pal.rock, '#d6453d', 0.45 * peak) : t.pal.rock;
  c.fillStyle = shade(ledgeCol, 0.7);
  c.fill(t.bevel);
  c.fillStyle = ledgeCol;
  c.fill(t.ledge);
  c.fillStyle = shade(t.pal.rock, 0.51);
  c.fill(t.notch);
  c.lineJoin = 'round';
  if (peak > 0) {
    c.strokeStyle = rgba('#d6453d', (0.3 + 0.12 * Math.sin(time * 5)) * peak);
    c.lineWidth = 14;
    c.stroke(t.rim);
  }
  c.strokeStyle = INK;
  c.lineWidth = 0.075 * T;
  c.stroke(t.rim);
}

// ------------------------------------------------------------- floor kinds

const TW = Math.ceil(CFG.arena.w / T);
const TH = Math.ceil(CFG.arena.h / T);

/** Cloudy multi-scale mottling: the main character of natural ground. */
function cloudy(c: Ctx, rnd: Rnd, w: number, h: number, alpha: number, sizes: number[]): void {
  c.save();
  c.globalCompositeOperation = 'overlay';
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  sizes.forEach((tiles, i) => {
    c.globalAlpha = alpha * [1, 0.7, 0.5][i];
    const n = noiseCanvas(Math.max(3, w / (tiles * T)), Math.max(3, h / (tiles * T)), rnd, 78, 178);
    c.drawImage(n, -T, -T, w + 2 * T, h + 2 * T);
  });
  c.restore();
}

/** Fine crumbly grain, one random grey per floor pixel, laid as a repeating pattern. */
function grain(c: Ctx, rnd: Rnd, w: number, h: number, alpha: number): void {
  const n = noiseCanvas(256, 256, rnd, 60, 195);
  c.save();
  c.globalCompositeOperation = 'overlay';
  c.globalAlpha = alpha;
  c.scale(1 / FLOOR_RES, 1 / FLOOR_RES);
  c.fillStyle = c.createPattern(n, 'repeat')!;
  c.fillRect(0, 0, w * FLOOR_RES, h * FLOOR_RES);
  c.restore();
}

/**
 * Paint a second terrain over the tiles `pick` selects. The border follows the tile grid as a staircase and is
 * feathered by half a tile: the mask is drawn at 4 px per tile and stretched with smoothing.
 */
let patchLayer: HTMLCanvasElement | null = null; // one scratch layer, reused by every patch
function patch(c: Ctx, pick: (tx: number, ty: number) => boolean, paint: (p: Ctx) => void): void {
  const { w: aw, h: ah } = CFG.arena;
  const mask = canvas(TW * 4, TH * 4);
  const m = mask.getContext('2d')!;
  m.fillStyle = '#fff';
  let any = false;
  for (let ty = 0; ty < TH; ty++) {
    for (let tx = 0; tx < TW; tx++) {
      if (!pick(tx, ty)) continue;
      m.fillRect(tx * 4, ty * 4, 4, 4);
      any = true;
    }
  }
  if (!any) return;
  const layer = (patchLayer ??= canvas(aw * FLOOR_RES, ah * FLOOR_RES));
  const p = layer.getContext('2d')!;
  p.setTransform(FLOOR_RES, 0, 0, FLOOR_RES, 0, 0);
  p.globalCompositeOperation = 'source-over';
  p.globalAlpha = 1;
  p.clearRect(0, 0, aw, ah);
  paint(p);
  p.globalCompositeOperation = 'destination-in';
  p.imageSmoothingEnabled = true;
  p.imageSmoothingQuality = 'high';
  p.drawImage(mask, 0, 0, TW * T, TH * T);
  c.drawImage(layer, 0, 0, aw, ah);
}

function pebbles(c: Ctx, rnd: Rnd, x: number, y: number, n: number, spread: number, col: string): void {
  c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28;
    const d = Math.sqrt(rnd()) * spread;
    c.beginPath();
    c.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, T * (0.035 + rnd() * 0.04), T * (0.03 + rnd() * 0.03), rnd() * 3, 0, 6.28);
    c.fill();
  }
}

/** A loose stone: decoration, so its outline is a dark tone of the stone and not black. */
function chunk(c: Ctx, rnd: Rnd, x: number, y: number, s: number, base: string): void {
  const n = 5 + Math.floor(rnd() * 3);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + (rnd() - 0.5) * 0.5;
    const r = s * (0.36 + rnd() * 0.14);
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.82]);
  }
  const path = new Path2D();
  path.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const q = pts[i];
    const nx = pts[(i + 1) % n];
    path.arcTo(q[0], q[1], (q[0] + nx[0]) / 2, (q[1] + nx[1]) / 2, s * 0.08);
  }
  path.closePath();
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.beginPath();
  c.ellipse(x + s * 0.1, y + s * 0.22, s * 0.48, s * 0.22, 0, 0, 6.28);
  c.fill();
  c.save();
  c.fillStyle = base;
  c.fill(path);
  c.clip(path);
  c.fillStyle = rgba(shade(base, 1.22), 0.7);
  c.fillRect(x - s, y - s, s * 1.1, s * 0.95);
  c.fillStyle = rgba(shade(base, 0.72), 0.7);
  c.beginPath();
  c.moveTo(x + s, y - s * 0.1);
  c.lineTo(x + s, y + s);
  c.lineTo(x - s * 0.3, y + s);
  c.closePath();
  c.fill();
  c.restore();
  c.strokeStyle = shade(base, 0.42);
  c.lineWidth = 0.035 * T;
  c.lineJoin = 'round';
  c.stroke(path);
}

function quarry(c: Ctx, rnd: Rnd, pal: Pal): void {
  const { w: aw, h: ah } = CFG.arena;
  cloudy(c, rnd, aw, ah, 0.5, [5, 2, 0.7]);
  // soil patches
  const f = field(rnd, 5.5);
  patch(c, (tx, ty) => f(tx, ty) > 0.66, (p) => {
    p.fillStyle = SOIL;
    p.fillRect(0, 0, aw, ah);
    cloudy(p, rnd, aw, ah, 0.28, [4, 1.5]);
    p.fillStyle = rgba(shade(SOIL, 0.75), 0.3);
    for (let i = 0; i < 2600; i++) p.fillRect(rnd() * aw, rnd() * ah, 1 + rnd() * 1.4, 1 + rnd() * 1.4);
  });
  // cracks: a wandering dark line with a faint light one under it
  for (let i = 0; i < 46; i++) {
    let x = rnd() * aw;
    let y = rnd() * ah;
    let a = rnd() * 6.28;
    const pts: [number, number][] = [[x, y]];
    const n = 5 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) {
      a += (rnd() - 0.5) * 1.3;
      x += Math.cos(a) * 0.32 * T;
      y += Math.sin(a) * 0.32 * T;
      pts.push([x, y]);
    }
    const line = (dy: number, col: string, w: number) => {
      c.strokeStyle = col;
      c.lineWidth = w;
      c.beginPath();
      pts.forEach(([px, py], k) => (k ? c.lineTo(px, py + dy) : c.moveTo(px, py + dy)));
      c.stroke();
    };
    line(0.9, rgba(shade(pal.base, 1.35), 0.16), 0.03 * T);
    line(0, rgba(shade(pal.base, 0.55), 0.4), 0.035 * T);
  }
  // pitting
  c.fillStyle = rgba(shade(pal.base, 0.68), 0.3);
  for (let i = 0; i < 9000; i++) {
    const s = T * (0.02 + rnd() * 0.03);
    c.fillRect(rnd() * aw, rnd() * ah, s, s);
  }
  // loose chunks with their pebble scatter, in small groups
  for (let i = 0; i < 16; i++) {
    const gx = 40 + rnd() * (aw - 80);
    const gy = 40 + rnd() * (ah - 80);
    pebbles(c, rnd, gx, gy, 8 + Math.floor(rnd() * 7), T * 0.9, 'rgba(190,172,164,0.42)');
    const n = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      chunk(c, rnd, gx + (rnd() - 0.5) * T * 1.3, gy + (rnd() - 0.5) * T * 0.9, T * (0.34 + rnd() * 0.2), shade(pal.rock, 0.74 + rnd() * 0.1));
    }
  }
  for (let i = 0; i < 26; i++) pebbles(c, rnd, rnd() * aw, rnd() * ah, 3 + Math.floor(rnd() * 5), T * 0.5, 'rgba(190,172,164,0.34)');
}

function tufts(c: Ctx, rnd: Rnd, pick: (tx: number, ty: number) => boolean, perTile: number, cols: string[], hMin: number, hMax: number, alpha: number): void {
  c.globalAlpha = alpha;
  // one path per colour per row of tiles: a single path with every blade in it is slow to fill
  for (let ty = 0; ty < TH; ty++) {
    const paths = cols.map(() => new Path2D());
    for (let tx = 0; tx < TW; tx++) {
      if (!pick(tx, ty)) continue;
      const n = Math.floor(perTile + rnd());
      for (let i = 0; i < n; i++) {
        const bx = (tx + rnd()) * T;
        const by = (ty + rnd()) * T;
        const blades = 5 + Math.floor(rnd() * 4);
        for (let k = 0; k < blades; k++) {
          const x = bx + (rnd() - 0.5) * 0.3 * T;
          const hgt = T * (hMin + rnd() * (hMax - hMin));
          const lean = (rnd() - 0.5) * 0.3 * T;
          const w = 0.05 * T;
          const p = paths[Math.floor(rnd() * cols.length)];
          p.moveTo(x - w, by);
          p.lineTo(x + lean, by - hgt);
          p.lineTo(x + w, by);
          p.closePath();
        }
      }
    }
    paths.forEach((p, i) => {
      c.fillStyle = cols[i];
      c.fill(p);
    });
  }
  c.globalAlpha = 1;
}

function scratches(c: Ctx, rnd: Rnd, n: number, col: string): void {
  c.strokeStyle = col;
  c.lineWidth = 0.025 * T;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const x = rnd() * CFG.arena.w;
    const y = rnd() * CFG.arena.h;
    const l = T * (0.3 + rnd() * 0.35);
    const a = -0.5 + (rnd() - 0.5) * 0.4;
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
  }
  c.stroke();
}

/** A low bush: decoration only, so it is small, dull and outlined in dark green, never in black. */
function bush(c: Ctx, rnd: Rnd, x: number, y: number, s: number): void {
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath();
  c.ellipse(x + s * 0.15, y + s * 0.3, s * 0.55, s * 0.22, 0, 0, 6.28);
  c.fill();
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.28 + rnd() * 0.5;
    const d = i === 0 ? 0 : s * (0.18 + rnd() * 0.16);
    blobs.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.75, s * (0.2 + rnd() * 0.07)]);
  }
  c.strokeStyle = '#2f3320';
  c.lineWidth = 0.07 * T;
  for (const [bx, by, r] of blobs) {
    c.beginPath();
    c.arc(bx, by, r, 0, 6.28);
    c.stroke();
  }
  const greens = ['#404627', '#484e2b', '#4f583a'];
  blobs.sort((a, b2) => a[1] - b2[1]);
  blobs.forEach(([bx, by, r], i) => {
    c.fillStyle = greens[i % 3];
    c.beginPath();
    c.arc(bx, by, r, 0, 6.28);
    c.fill();
  });
  c.fillStyle = 'rgba(96,108,58,0.8)';
  for (let i = 0; i < 12; i++) {
    const a = rnd() * 6.28;
    const d = rnd() * s * 0.36;
    c.beginPath();
    c.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7 - s * 0.05, s * 0.07, s * 0.035, rnd() * 3, 0, 6.28);
    c.fill();
  }
}

function grove(c: Ctx, rnd: Rnd, pal: Pal): void {
  const { w: aw, h: ah } = CFG.arena;
  cloudy(c, rnd, aw, ah, 0.3, [4, 1.5]);
  scratches(c, rnd, 500, rgba(shade(pal.base, 0.72), 0.3));
  c.fillStyle = rgba(shade(pal.base, 0.78), 0.3);
  for (let i = 0; i < 9000; i++) c.fillRect(rnd() * aw, rnd() * ah, 1 + rnd() * 1.2, 1 + rnd() * 1.2);
  for (let i = 0; i < 30; i++) pebbles(c, rnd, rnd() * aw, rnd() * ah, 3 + Math.floor(rnd() * 4), T * 0.5, 'rgba(180,160,140,0.32)');
  // grass: a green wash under the tufts, then the tufts
  const f = field(rnd, 5);
  const f2 = field(rnd, 2.2);
  const grassy = (tx: number, ty: number) => f(tx, ty) * 0.75 + f2(tx, ty) * 0.25 > 0.47;
  patch(c, grassy, (p) => {
    p.fillStyle = rgba('#4a5230', 0.62);
    p.fillRect(0, 0, aw, ah);
    cloudy(p, rnd, aw, ah, 0.3, [2, 0.8]);
  });
  tufts(c, rnd, grassy, 3.4, GRASS, 0.3, 0.62, 0.85);
  tufts(c, rnd, (tx, ty) => !grassy(tx, ty) && f2(tx + 9, ty + 4) > 0.62, 0.7, GRASS, 0.25, 0.45, 0.7);
  // wildflowers
  for (let i = 0; i < 9; i++) {
    const x = 30 + rnd() * (aw - 60);
    const y = 30 + rnd() * (ah - 60);
    c.fillStyle = 'rgba(226,190,48,0.8)';
    for (let k = 0; k < 14; k++) {
      c.beginPath();
      c.arc(x + (rnd() - 0.5) * T * 0.9, y + (rnd() - 0.5) * T * 0.7, T * 0.035, 0, 6.28);
      c.fill();
    }
  }
  for (let i = 0; i < 15; i++) bush(c, rnd, 30 + rnd() * (aw - 60), 30 + rnd() * (ah - 60), T * (0.6 + rnd() * 0.3));
}

function marsh(c: Ctx, rnd: Rnd, pal: Pal): void {
  const { w: aw, h: ah } = CFG.arena;
  cloudy(c, rnd, aw, ah, 0.26, [4, 1.5]);
  c.fillStyle = rgba(shade(pal.base, 0.74), 0.3);
  for (let i = 0; i < 8000; i++) c.fillRect(rnd() * aw, rnd() * ah, 1 + rnd() * 1.2, 1 + rnd() * 1.2);
  const f = field(rnd, 5);
  const f2 = field(rnd, 4);
  const pool = (tx: number, ty: number) => f(tx, ty) > 0.74;
  const near = (tx: number, ty: number) => pool(tx - 1, ty) || pool(tx + 1, ty) || pool(tx, ty - 1) || pool(tx, ty + 1) || pool(tx - 1, ty - 1) || pool(tx + 1, ty + 1) || pool(tx + 1, ty - 1) || pool(tx - 1, ty + 1);
  const mud = (tx: number, ty: number) => pool(tx, ty) || near(tx, ty) || f2(tx, ty) > 0.76;
  patch(c, mud, (p) => {
    p.fillStyle = MUD;
    p.fillRect(0, 0, aw, ah);
    cloudy(p, rnd, aw, ah, 0.25, [3, 1]);
    p.fillStyle = rgba(shade(MUD, 0.7), 0.35);
    for (let i = 0; i < 5000; i++) p.fillRect(rnd() * aw, rnd() * ah, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  });
  patch(c, pool, (p) => {
    p.fillStyle = POOL;
    p.fillRect(0, 0, aw, ah);
    cloudy(p, rnd, aw, ah, 0.12, [3]);
    // faint diagonal ripple streaks
    p.strokeStyle = rgba(shade(POOL, 1.5), 0.2);
    p.lineWidth = 0.04 * T;
    p.beginPath();
    for (let i = 0; i < 1500; i++) {
      const x = rnd() * aw;
      const y = rnd() * ah;
      const l = T * (0.3 + rnd() * 0.5);
      p.moveTo(x, y);
      p.lineTo(x + l, y - l * 0.35);
    }
    p.stroke();
  });
  // reed tufts and wet grass: decoration, thin and dull, no outline
  const reedy = (tx: number, ty: number) => !pool(tx, ty) && (near(tx, ty) || f2(tx + 20, ty + 7) > 0.6);
  tufts(c, rnd, reedy, 1.0, ['#565c36', '#5f6238', '#4f5532'], 0.4, 0.75, 0.75);
  tufts(c, rnd, (tx, ty) => !pool(tx, ty) && !reedy(tx, ty) && f(tx + 5, ty + 30) > 0.5, 1.1, ['#48522f', '#505b36'], 0.22, 0.42, 0.7);
  for (let i = 0; i < 24; i++) pebbles(c, rnd, rnd() * aw, rnd() * ah, 3 + Math.floor(rnd() * 4), T * 0.5, 'rgba(150,150,125,0.28)');
}

// ------------------------------------------------------------------ decals

/** Insect blood: one merged blob and satellites, flat and partly transparent. */
export function stampBlood(t: Terrain, x: number, y: number, size: number, rnd: Rnd = Math.random): void {
  const c = t.dctx;
  c.fillStyle = 'rgba(70,34,58,0.5)';
  c.beginPath();
  c.arc(x, y, size * 0.32, 0, 6.28);
  c.fill();
  const n = 6 + Math.floor(rnd() * 6);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28;
    const d = size * (0.25 + rnd() * 0.8);
    c.beginPath();
    c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, size * (0.05 + rnd() * 0.14), 0, 6.28);
    c.fill();
  }
}
export function stampScorch(t: Terrain, x: number, y: number, r: number): void {
  const c = t.dctx;
  const g = c.createRadialGradient(x, y, r * 0.15, x, y, r);
  g.addColorStop(0, 'rgba(18,12,10,0.42)');
  g.addColorStop(0.7, 'rgba(24,16,12,0.2)');
  g.addColorStop(1, 'rgba(24,16,12,0)');
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.fillStyle = 'rgba(20,16,14,0.35)';
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * 6.28;
    const d = r * (0.5 + Math.random() * 0.7);
    c.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.5, 1.5);
  }
}
export function stampRubble(t: Terrain, x: number, y: number, n: number, spread: number, col: string): void {
  pebbles(t.dctx, Math.random, x, y, n, spread, rgba(col, 0.5));
}
/** Disturbed earth where something dug: a darker soft spot with crumbs. */
export function stampDirt(t: Terrain, x: number, y: number, r: number): void {
  const c = t.dctx;
  const dark = shade(t.pal.base, 0.6);
  const g = c.createRadialGradient(x, y, r * 0.2, x, y, r);
  g.addColorStop(0, rgba(dark, 0.4));
  g.addColorStop(1, rgba(dark, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  pebbles(c, Math.random, x, y, 7, r * 1.1, rgba(shade(t.pal.base, 1.25), 0.4));
}
