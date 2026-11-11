// Things that are not creatures: nodes, pickups, projectiles, melee arcs,
// chips, and the ground (floor tile, treeline, work ring, danger telegraphs).
//
// Nodes: origin at the base. Pickups, projectiles and chips: origin at the
// centre, pointing right. Colour jobs: raws and anything the player makes or
// throws is Ochre; trees and stone shade are Spruce; anything that hurts the
// player is Madder.

import { HATCH, INK, MADDER, MOSS, OCHRE, OUTLINE, SPRUCE, capDpr, rng, type Colour, type Drawing, type Print, type Sprite } from './print.ts';

export const NODE_IDS = ['tree', 'seam', 'carcass'] as const;
export type NodeId = (typeof NODE_IDS)[number];
/** 0 untouched, 1-3 worked. After 3 comes the remnant. */
export type NodeStage = 0 | 1 | 2 | 3;

const lozenge = (p: Print, rx: number, ry = rx * 0.3, cx = 0): void =>
  p.shadow([cx - rx, 0, cx - rx * 0.55, -ry, cx + rx * 0.6, -ry, cx + rx, 0, cx + rx * 0.5, ry, cx - rx * 0.6, ry]);

const CHIP_SHAPES: readonly (readonly number[])[] = [
  [-4, 2, 1, -4, 4, 3],
  [-3, -2, 3, -3, 4, 2, -2, 3],
  [-5, 1, 4, -2, 5, 0, -3, 3],
  [-2, -4, 3, -1, 0, 4, -3, 1],
];

function litter(p: Print, n: number, colour: Colour, x0: number, x1: number, y0 = -2, y1 = 5): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + p.rnd() * (x1 - x0);
    const y = y0 + p.rnd() * (y1 - y0);
    const sh = CHIP_SHAPES[Math.floor(p.rnd() * 4)]!;
    p.at(x, y, p.rnd() * 360, () => p.flat(sh, colour), 0.8);
  }
}

// ----------------------------------------------------------------------- tree

export const tree = (rich: boolean, d: NodeStage): Drawing => (p) => {
  lozenge(p, rich ? 30 : 24, 7);
  const H = rich ? 42 : 34;
  const W = rich ? 8 : 6;
  const lean = [0, 2, 5, 11][d]!;
  if (d > 0) litter(p, d * 3, OCHRE, 6, 26);
  p.at(0, 0, lean, () => {
    p.shape([-W - 4, 0, -W, -7, -W, -H, W, -H, W, -7, W + 5, 0], OCHRE);
    p.hatch([-W, -4, -W, -H, -1, -H, -1, -3], 88, 3);
    if (rich) p.line([2, -H, 3, -8], true);
    // the cut
    if (d > 0) {
      const dep = [0, 3, 0, -3][d]!;
      const cutPts = [W + 2, -22, dep, -15, W + 2, -9];
      p.cut(cutPts);
      p.line([W + 1, -22, dep, -15, W + 1, -9]);
    }
    const y = -H + 6;
    // three skirts of needles, widest at the bottom
    const t1 = [-26, y, -11, y - 23, 11, y - 23, 27, y - 1, 15, y + 3, 6, y - 2, -4, y + 3, -14, y - 2];
    const t2 = [-21, y - 19, -8, y - 40, 8, y - 40, 22, y - 20, 11, y - 16, 0, y - 21, -11, y - 16];
    const t3 = [-15, y - 37, -3, y - 60, 3, y - 61, 16, y - 38, 6, y - 34, -5, y - 35];
    p.shape(t1, SPRUCE);
    p.hatch([-26, y, -11, y - 23, -2, y - 23, -6, y + 2, -14, y - 2], 62, 4);
    p.shape(t2, SPRUCE);
    p.hatch([-21, y - 19, -8, y - 40, -1, y - 40, -4, y - 18, -11, y - 16], 62, 4);
    if (rich) {
      const t4 = [-11, y - 56, -2, y - 76, 2, y - 77, 12, y - 57, 4, y - 53, -4, y - 54];
      p.shape(t3, SPRUCE);
      p.hatch([-15, y - 37, -3, y - 60, 0, y - 60, -2, y - 35, -5, y - 35], 62, 4);
      p.shape(t4, SPRUCE);
      // cones: a rich tree is hung with Ochre
      p.shape([8, y - 12, 12, y - 8, 9, y - 2, 5, y - 7], OCHRE);
      p.shape([-10, y - 30, -6, y - 26, -9, y - 21, -13, y - 25], OCHRE);
      p.shape([6, y - 48, 10, y - 44, 7, y - 38, 3, y - 43], OCHRE);
      p.shape([15, y - 30, 18, y - 27, 16, y - 22, 12, y - 26], OCHRE);
    } else {
      p.shape(t3, SPRUCE);
      p.hatch([-15, y - 37, -3, y - 60, 0, y - 60, -2, y - 35, -5, y - 35], 62, 4);
    }
  });
};

export const stump = (rich: boolean): Drawing => (p) => {
  const W = rich ? 8 : 6;
  lozenge(p, 16, 4);
  p.shape([-W - 4, 0, -W, -7, -W - 1, -12, -W + 3, -10, -1, -16, 2, -11, W, -14, W, -7, W + 5, 0], OCHRE);
  p.hatch([-W, -4, -W - 1, -12, -1, -14, -1, -3], 88, 3);
  p.line([0, -9, 4, -6], true);
  litter(p, rich ? 9 : 6, OCHRE, -22, 24, -3, 6);
  p.at(17, 2, 20, () => p.flat([-6, 0, 0, -4, 7, -1, 1, 3], SPRUCE));
  p.at(-16, 4, -30, () => p.flat([-5, 0, 0, -3, 6, 0, 0, 3], SPRUCE));
};

// ----------------------------------------------------------------------- seam

export const seam = (rich: boolean, d: NodeStage): Drawing => (p) => {
  lozenge(p, rich ? 32 : 28, 6);
  const sq = [1, 0.86, 0.7, 0.52][d]!;
  // back boulder, worked down from the top
  p.at(0, 0, 0, () => {
    p.shape([-6, -3, -8, -24, 0, -38, 12, -41, 22, -29, 25, -8, 19, 0], SPRUCE);
    p.hatch([12, -41, 22, -29, 25, -8, 19, 0, 13, -2], 70, 3.5);
    p.flat([1, -33, 8, -29, 13, -33, 21, -25, 22, -19, 13, -26, 8, -22, 0, -27], OCHRE);
    p.flat([4, -15, 10, -11, 17, -14, 23, -9, 23, -5, 17, -9, 10, -6, 4, -10], OCHRE);
    p.line([0, -38, 5, -22, 2, -3], true);
    if (rich) {
      p.shape([5, -39, 9, -53, 14, -40], OCHRE);
      p.shape([13, -40, 21, -49, 21, -31], OCHRE);
      p.shape([-5, -28, -9, -40, 1, -37], OCHRE);
    }
    if (d > 0) p.line([10, -41, 8, -31, 13, -24, 10, -16]);
    if (d > 1) p.line([13, -24, 20, -20]);
  }, 1, sq);
  // front boulder
  p.at(0, 0, 0, () => {
    p.shape([-27, 0, -28, -12, -19, -25, -6, -27, 4, -16, 7, 0], SPRUCE);
    p.hatch([-27, 0, -28, -12, -19, -25, -15, -25, -17, 0], 70, 3.5);
    p.flat([-25, -9, -16, -16, -10, -11, -2, -15, 0, -10, -10, -5, -16, -10, -25, -4], OCHRE);
    p.line([-6, -27, -9, -14, -5, 0], true);
    if (d > 1) p.line([-19, -25, -15, -17, -19, -9]);
  }, 1, d === 3 ? 0.66 : d === 2 ? 0.88 : 1);
  if (rich) {
    p.shape([14, 2, 13, -9, 20, -15, 29, -11, 31, 0, 25, 4], SPRUCE);
    p.flat([15, -5, 21, -10, 28, -6, 28, -2, 21, -6, 15, -1], OCHRE);
  }
  // rubble grows as the seam shrinks
  if (d > 0) {
    p.shape([-34, 2, -32, -5, -26, -4, -25, 3], SPRUCE);
    litter(p, d * 2, OCHRE, -30, 34, 1, 7);
    litter(p, d * 2, INK, -34, 36, 0, 7);
  }
  if (d > 1) p.shape([27, 5, 29, -3, 36, -4, 38, 4], SPRUCE);
  if (d > 2) p.shape([4, 7, 6, 0, 13, -1, 15, 6], SPRUCE);
};

export const rubble = (rich: boolean): Drawing => (p) => {
  lozenge(p, 22, 4);
  p.shape([-20, 2, -19, -6, -12, -9, -6, -5, -6, 2], SPRUCE);
  p.shape([-3, 3, -2, -5, 5, -8, 11, -3, 10, 3], SPRUCE);
  p.hatch([5, -8, 11, -3, 10, 3, 5, 3], 70, 3);
  p.shape([13, 4, 15, -3, 21, -2, 22, 4], SPRUCE);
  if (rich) p.shape([-13, 8, -11, 2, -5, 3, -5, 8], SPRUCE);
  litter(p, rich ? 5 : 3, OCHRE, -22, 24, 2, 8);
  litter(p, 5, INK, -26, 28, -2, 8);
};

// -------------------------------------------------------------------- carcass

function ribs(p: Print, x0: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + i * 5;
    p.line([x - 1, -5, x - 3, -13, x + 1, -20, x + 5, -21]);
  }
}

export const carcass = (rich: boolean, d: NodeStage): Drawing => (p) => {
  const k = rich ? 1.25 : 1;
  lozenge(p, 30 * k, 5 * k);
  p.at(0, 0, 0, () => {
    // stiff legs in the air
    if (d < 2) p.flat([-15, -20, -18, -34, -13, -35, -9, -21], INK);
    if (d < 3) p.flat([-6, -22, -5, -33, -1, -33, -1, -22], INK);
    if (d < 1 || rich) p.flat([5, -22, 8, -35, 12, -34, 10, -20], INK);
    p.flat([13, -19, 19, -30, 22, -28, 17, -17], INK);
    if (d < 3) {
      p.line([-27, -12, -33, -15]);
      p.shape([-26, -3, -27, -14, -18, -22, -2, -24, 12, -21, 20, -15, 28, -13, 32, -7, 27, -2, 14, -3, -20, -1], OCHRE);
      p.hatch([-26, -3, -27, -14, -18, -22, -12, -23, -14, -1], 62, 3.5);
    } else {
      // only rump and head are left
      p.shape([-26, -3, -27, -14, -20, -20, -15, -12, -17, -2], OCHRE);
      p.shape([16, -13, 20, -15, 28, -13, 32, -7, 27, -2, 17, -3], OCHRE);
      p.line([-15, -5, 16, -6]);
    }
    // the opened flank
    if (d === 1) {
      const flap = [-9, -20, 2, -22, 6, -9, -3, -6];
      p.cut(flap);
      p.line([...flap, -9, -20]);
      p.line([-3, -8, -5, -15, -1, -20]);
      p.line([2, -8, 0, -15, 3, -20]);
    } else if (d === 2) {
      p.cut([-19, -18, 6, -20, 10, -7, -17, -5]);
      p.line([-19, -18, 6, -20, 10, -7, -17, -5, -19, -18]);
      ribs(p, -14, 4);
    } else if (d === 3) {
      ribs(p, -12, 5);
    }
    // head: horn stub, a crossed-out eye
    p.flat([22, -13, 24, -20, 27, -13], INK);
    if (rich) {
      p.line([23, -14, 21, -24, 27, -30]);
      p.line([22, -22, 16, -26]);
    }
    p.line([23, -10, 27, -6], true);
    p.line([27, -10, 23, -6], true);
    p.flat([29, -9, 33, -7, 31, -3, 28, -4], INK);
  }, k);
  if (d > 0) litter(p, d * 2, OCHRE, -30 * k, 30 * k, 1, 7);
};

export const bones = (rich: boolean): Drawing => (p) => {
  const k = rich ? 1.25 : 1;
  lozenge(p, 26 * k, 4 * k);
  p.at(0, 0, 0, () => {
    p.line([-22, -4, 16, -5]);
    ribs(p, -16, 6);
    p.shape([17, -11, 24, -13, 31, -8, 28, -2, 18, -3], null);
    p.dot(24, -8, 1.6);
    p.line([-25, -1, -20, 3], true);
    p.line([-8, 3, -2, 5], true);
    if (rich) p.line([20, -12, 18, -21, 23, -26]);
  }, k);
  litter(p, 3, OCHRE, -24 * k, 26 * k, 1, 6);
};

// -------------------------------------------------------------------- pickups

const OCT7 = [-3, -7, 3, -7, 7, -3, 7, 3, 3, 7, -3, 7, -7, 3, -7, -3];

export const scripToken: Drawing = (p) => {
  p.shape(OCT7, OCHRE);
  const hole = [-2.2, -2, 2, -2.6, 2.6, 2, -2, 2.6];
  p.cut(hole);
  p.line([...hole, hole[0]!, hole[1]!], true);
};

export const timberPickup: Drawing = (p) => {
  p.at(1, -4, -8, () => {
    p.shape([-9, -4, 6, -4, 10, 0, 6, 4, -9, 4], OCHRE);
  });
  p.at(-1, 3, 6, () => {
    p.shape([-10, -4, 6, -4, 10, 0, 6, 4, -10, 4], OCHRE);
    p.line([6, -4, 3, 0, 6, 4], true);
    p.hatch([-10, -4, 0, -4, 0, 4, -10, 4], 8, 3);
  });
};

export const orePickup: Drawing = (p) => {
  p.shape([-8, 3, -7, -4, -2, -8, 5, -7, 9, -1, 6, 6, -3, 7], OCHRE);
  p.hatch([5, -7, 9, -1, 6, 6, 1, 6, 2, -1], 70, 3);
  p.line([-7, -4, -1, -1, 2, -7], true);
  p.line([-1, -1, -3, 7], true);
};

export const hidePickup: Drawing = (p) => {
  p.shape([-9, -8, -4, -5, 4, -5, 9, -8, 7, -1, 10, 6, 4, 4, 0, 8, -4, 4, -10, 6, -7, -1], OCHRE);
  p.hatch([-5, -3, 5, -3, 4, 3, -4, 3], 80, 3.5);
};

// ---------------------------------------------------------------- projectiles

export const stoneShot: Drawing = (p) => {
  p.shape([-4, -1, -1, -4.5, 4, -2, 3.5, 3, -2, 4], OCHRE);
};

export const arrowShot: Drawing = (p) => {
  p.line([-11, 0, 8, 0]);
  p.flat([6, -4.5, 15, 0, 6, 4.5], INK);
  p.shape([-14, -4, -8, -4, -5, 0, -8, 4, -14, 4, -11, 0], OCHRE);
};

export const ballShot: Drawing = (p) => {
  p.flat([-2, -4, 2.5, -3.5, 4.5, 0, 2.5, 3.5, -2, 4, -4, 0], INK);
  p.line([-13, -2.5, -6, -2.5], true);
  p.line([-15, 2, -7, 2], true);
};

/** Thrown axe. Drawn upright; the renderer spins it with drawSprite's rot. */
export const axeShot: Drawing = (p) => {
  p.at(0, 0, 25, () => {
    p.line([0, 11, 0, -9]);
    p.shape([-3, -11, 2, -11, 10, -13, 12, -1, 2, -4, -3, -4], OCHRE);
    p.line([9, -12, 10, -3], true);
  });
};

export const bolaShot: Drawing = (p) => {
  p.line([-8, 4, -2, -1, 2, 2, 8, -4], true);
  p.line([0, 0, 1, 9], true);
  p.shape([-12, 2, -9, 0, -6, 3, -7, 7, -11, 7], OCHRE);
  p.shape([6, -7, 10, -8, 12, -4, 9, -1, 5, -3], OCHRE);
  p.shape([-2, 8, 2, 7, 4, 11, 1, 13, -2, 12], OCHRE);
};

/** Enemy spit: the only round Madder shape in the game. */
export const spitShot: Drawing = (p) => {
  p.disc(0, 0, 5, MADDER);
  p.dot(-1.5, -1.5, 1.2);
};

/** Antler shard. Lies where it lands and hurts to walk on. */
export const shardShot: Drawing = (p) => {
  p.shape([-2, 7, -6, -3, 0, -13, 6, -2, 4, 7], MADDER);
  p.line([0, -13, 0, 6], true);
};

// ----------------------------------------------------------------- melee arcs

function crescent(r0: number, r1: number, span: number, n: number): number[] {
  const at = (i: number, inner: boolean): [number, number] => {
    const t = i / n;
    const a = ((-span + t * 2 * span) * Math.PI) / 180;
    const r = inner ? r1 - (r1 - r0) * Math.sin(t * Math.PI) : r1;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(...at(i, false));
  for (let i = n - 1; i >= 1; i--) out.push(...at(i, true));
  return out;
}

/**
 * Sweep arc for edge and blunt swings. Unit size: outer radius 48 px, facing
 * right, origin at the wielder. Scale with drawSprite to the weapon's reach.
 * Frame 0 is the cut, frame 1 the thin after-mark.
 */
export const sweepArc = (f: 0 | 1): Drawing => (p) => {
  if (f === 0) {
    const c = crescent(30, 48, 52, 6);
    p.flat(c, OCHRE);
    p.hatch(c, 14, 5, INK, HATCH);
    p.line(c.slice(0, 14), true);
  } else {
    const c = crescent(40, 50, 58, 6);
    p.hatch(c, 14, 4, INK, HATCH);
  }
};

/** Thrust mark for pikes and picks. Unit size: 58 px long, origin at the wielder. */
export const thrustArc = (f: 0 | 1): Drawing => (p) => {
  if (f === 0) {
    const w = [6, -4, 40, -7, 58, 0, 40, 7, 6, 4];
    p.flat(w, OCHRE);
    p.hatch(w, 0, 3.5, INK, HATCH);
    p.line([40, -7, 58, 0, 40, 7], true);
  } else {
    p.hatch([14, -3, 46, -5, 62, 0, 46, 5, 14, 3], 0, 3, INK, HATCH);
  }
};

// ---------------------------------------------------------------------- chips

export const chip = (i: number, colour: Colour): Drawing => (p) => p.flat(CHIP_SHAPES[i % 4]!, colour);

// --------------------------------------------------------------------- ground

/** Side of the square floor tile, css px. */
export const FLOOR_TILE = 256;
/** Treeline strip: length along the edge and depth, css px. */
export const TREELINE_W = 192;
export const TREELINE_H = 72;

function plain(c: HTMLCanvasElement, w: number, h: number): Sprite {
  const s = { canvas: c, w, h, ax: 0, ay: 0 } as Sprite;
  s.ink = s;
  return s;
}

/** Moss floor with sparse Spruce hatch tufts. Tiles seamlessly in both directions. */
export function bakeFloor(dpr: number): Sprite {
  dpr = capDpr(dpr);
  const T = FLOOR_TILE;
  const c = document.createElement('canvas');
  c.width = c.height = T * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = MOSS;
  ctx.fillRect(0, 0, T, T);
  const r = rng(0x5c21b);
  ctx.strokeStyle = SPRUCE;
  ctx.fillStyle = SPRUCE;
  ctx.lineWidth = HATCH;
  ctx.lineCap = 'butt';
  const wrap = (fn: () => void): void => {
    for (let ox = -T; ox <= T; ox += T)
      for (let oy = -T; oy <= T; oy += T) {
        ctx.save();
        ctx.translate(ox, oy);
        fn();
        ctx.restore();
      }
  };
  // Tufts: three or four short cuts leaning the same way, on a loose grid so
  // no two touch and no patch is bare.
  const G = 4;
  for (let gy = 0; gy < G; gy++)
    for (let gx = 0; gx < G; gx++) {
      if (r() < 0.2) continue;
      const x = Math.round((gx + 0.15 + r() * 0.7) * (T / G));
      const y = Math.round((gy + 0.15 + r() * 0.7) * (T / G));
      const n = 3 + (r() < 0.4 ? 1 : 0);
      const lean = -0.35 + r() * 0.7;
      const strokes: number[][] = [];
      for (let i = 0; i < n; i++) {
        const len = 5 + r() * 4;
        const sx = x + i * 4;
        strokes.push([sx, y, sx + lean * len, y - len]);
      }
      wrap(() => {
        ctx.beginPath();
        for (const s of strokes) {
          ctx.moveTo(s[0]!, s[1]!);
          ctx.lineTo(s[2]!, s[3]!);
        }
        ctx.stroke();
      });
    }
  // A few cut flecks between the tufts.
  for (let i = 0; i < 7; i++) {
    const x = Math.round(r() * T);
    const y = Math.round(r() * T);
    const a = r() * 6.28;
    wrap(() => {
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3);
      ctx.lineTo(x + Math.cos(a + 2.2) * 2.5, y + Math.sin(a + 2.2) * 2.5);
      ctx.lineTo(x + Math.cos(a + 4.1) * 3, y + Math.sin(a + 4.1) * 3);
      ctx.closePath();
      ctx.fill();
    });
  }
  return plain(c, T, T);
}

// The cut edge of the treeline, as (x, y) pairs over one strip. Ends at the
// same height it starts so strips join.
const TREE_EDGE = [0, 46, 14, 61, 22, 50, 36, 68, 48, 52, 60, 62, 70, 44, 86, 66, 98, 54, 112, 70, 126, 50, 138, 60, 150, 45, 166, 64, 178, 52, 192, 46];

function edgeY(x: number): number {
  x = ((x % TREELINE_W) + TREELINE_W) % TREELINE_W;
  for (let i = 2; i < TREE_EDGE.length; i += 2) {
    if (x <= TREE_EDGE[i]!) {
      const x0 = TREE_EDGE[i - 2]!;
      const t = (x - x0) / (TREE_EDGE[i]! - x0);
      return TREE_EDGE[i - 1]! + t * (TREE_EDGE[i + 1]! - TREE_EDGE[i - 1]!);
    }
  }
  return TREE_EDGE[1]!;
}

/**
 * One strip of treeline for the top edge of the clearing: solid Spruce above,
 * a cut Ink edge of spruce tips below. Tiles along x. Transparent under the
 * edge so the floor shows.
 */
export function bakeTreeline(dpr: number): Sprite {
  dpr = capDpr(dpr);
  const W = TREELINE_W;
  const H = TREELINE_H;
  const c = document.createElement('canvas');
  c.width = W * dpr;
  c.height = H * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2.5;
  for (let ox = -W; ox <= W; ox += W) {
    ctx.save();
    ctx.translate(ox, 0);
    // fill, a little out of register
    ctx.beginPath();
    ctx.moveTo(0, -4);
    for (let i = 0; i < TREE_EDGE.length; i += 2) ctx.lineTo(TREE_EDGE[i]! + 1.2, TREE_EDGE[i + 1]! - 1.4);
    ctx.lineTo(W, -4);
    ctx.closePath();
    ctx.fillStyle = SPRUCE;
    ctx.fill();
    // a second row of tips behind, hatch weight
    ctx.beginPath();
    for (let i = 0; i < TREE_EDGE.length; i += 2) {
      const x = TREE_EDGE[i]! + 9;
      const y = TREE_EDGE[i + 1]! * 0.7 - 12;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = HATCH;
    ctx.stroke();
    // hatch under every other tip
    ctx.save();
    ctx.beginPath();
    for (let i = 2; i < TREE_EDGE.length - 2; i += 4) {
      const x = TREE_EDGE[i]!;
      const y = TREE_EDGE[i + 1]!;
      ctx.moveTo(x, y - 2);
      ctx.lineTo(x - 13, y - 22);
      ctx.lineTo(x - 2, y - 22);
      ctx.closePath();
    }
    ctx.clip();
    ctx.beginPath();
    for (let s = -H; s < W + H; s += 4) {
      ctx.moveTo(s, H);
      ctx.lineTo(s + H * 0.55, 0);
    }
    ctx.stroke();
    ctx.restore();
    // the cut edge
    ctx.beginPath();
    ctx.moveTo(TREE_EDGE[0]!, TREE_EDGE[1]!);
    for (let i = 2; i < TREE_EDGE.length; i += 2) ctx.lineTo(TREE_EDGE[i]!, TREE_EDGE[i + 1]!);
    ctx.lineWidth = OUTLINE;
    ctx.stroke();
    ctx.restore();
  }
  return plain(c, W, H);
}

/**
 * Fill the view with floor. Call with the canvas transform set to css px
 * (ctx.setTransform(dpr, 0, 0, dpr, 0, 0)) and no camera translation.
 * camX, camY is the world point at the view's top-left corner. Tile
 * positions are snapped to device pixels, so the tufts never shimmer.
 */
export function drawFloor(ctx: CanvasRenderingContext2D, floor: Sprite, camX: number, camY: number, viewW: number, viewH: number): void {
  const T = floor.w;
  const dpr = floor.canvas.width / T;
  const snap = (v: number): number => Math.round(v * dpr) / dpr;
  const ox = -snap(((camX % T) + T) % T);
  const oy = -snap(((camY % T) + T) % T);
  for (let y = oy; y < viewH; y += T) for (let x = ox; x < viewW; x += T) ctx.drawImage(floor.canvas, x, y, T, T);
}

/**
 * Draw the treeline around a rectangular clearing. Call inside the camera
 * transform (world coordinates). bounds is the clearing; trees stand outside
 * it and everything further out, up to `far` px, is solid Spruce.
 */
export function drawTreeline(
  ctx: CanvasRenderingContext2D,
  strip: Sprite,
  bounds: { x: number; y: number; w: number; h: number },
  far = 1200,
): void {
  const W = strip.w;
  const H = strip.h;
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  for (let side = 0; side < 4; side++) {
    const L = side % 2 ? bounds.h : bounds.w;
    const other = side % 2 ? bounds.w : bounds.h;
    const prevL = other;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((side * Math.PI) / 2);
    ctx.translate(-L / 2, -other / 2);
    // deep forest
    ctx.fillStyle = SPRUCE;
    ctx.fillRect(-far, -far, L + far * 2, far - H + 1);
    // strips along the edge
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, -H, L, H);
    ctx.clip();
    for (let x = 0; x < L; x += W) ctx.drawImage(strip.canvas, x, -H, W, H);
    ctx.restore();
    // cut corner joining this edge to the previous one
    const y0 = edgeY(0) - H;
    const e = H - edgeY(prevL);
    ctx.beginPath();
    ctx.moveTo(-H - 1, -H - 1);
    ctx.lineTo(1, -H - 1);
    ctx.lineTo(1, y0);
    ctx.lineTo(-e, 1);
    ctx.lineTo(-H - 1, 1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(-e, 0);
    ctx.strokeStyle = INK;
    ctx.lineWidth = OUTLINE;
    ctx.lineCap = 'square';
    ctx.stroke();
    ctx.restore();
  }
}

// ------------------------------------------------- work ring and telegraphs

function ngon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, from = 0, to = n): void {
  for (let i = from; i <= to; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === from) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
}

/**
 * A node's work ring: a dashed, faceted Ink ring that inks in solid clockwise
 * as the node is worked. progress 0..1. World coordinates.
 */
export function drawWorkRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, progress = 0): void {
  const N = 24;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = OUTLINE;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';
  ctx.setLineDash([9, 7]);
  ctx.beginPath();
  ngon(ctx, x, y, r, N);
  ctx.stroke();
  const k = Math.max(0, Math.min(1, progress));
  if (k > 0) {
    ctx.setLineDash([]);
    ctx.beginPath();
    ngon(ctx, x, y, r, N, 0, Math.ceil(k * N));
    ctx.stroke();
  }
  ctx.restore();
}

// Hatch lines are laid on a world grid (x + y = n * gap) so a telegraph does
// not crawl when the camera or the shape moves.
function worldHatch(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, gap: number): void {
  const s0 = Math.floor((x0 + y0) / gap) * gap;
  const s1 = x1 + y1;
  ctx.beginPath();
  for (let s = s0; s <= s1; s += gap) {
    ctx.moveTo(s - y0, y0);
    ctx.lineTo(s - y1, y1);
  }
  ctx.stroke();
}

/**
 * Line-charge telegraph (boar, stag, Old Tusk): a Madder lane from (x0, y0)
 * to (x1, y1) with a cut point at the far end. The hatch fills the lane from
 * the near end as fill goes 0..1; at 1 the charge is released.
 */
export function drawChargeLane(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, halfWidth: number, fill = 1): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * halfWidth;
  const ny = ux * halfWidth;
  const tip = Math.min(halfWidth, len * 0.5);
  const bx = x1 - ux * tip;
  const by = y1 - uy * tip;
  const outline = (): void => {
    ctx.beginPath();
    ctx.moveTo(x0 + nx, y0 + ny);
    ctx.lineTo(bx + nx, by + ny);
    ctx.lineTo(x1, y1);
    ctx.lineTo(bx - nx, by - ny);
    ctx.lineTo(x0 - nx, y0 - ny);
    ctx.closePath();
  };
  ctx.save();
  ctx.strokeStyle = MADDER;
  ctx.lineJoin = 'miter';
  ctx.lineWidth = OUTLINE;
  ctx.setLineDash([10, 6]);
  outline();
  ctx.stroke();
  ctx.setLineDash([]);
  const k = Math.max(0, Math.min(1, fill));
  if (k > 0) {
    outline();
    ctx.clip();
    // second clip: only the filled part of the lane
    const fx = x0 + ux * len * k;
    const fy = y0 + uy * len * k;
    ctx.beginPath();
    ctx.moveTo(x0 + nx * 2, y0 + ny * 2);
    ctx.lineTo(fx + nx * 2, fy + ny * 2);
    ctx.lineTo(fx - nx * 2, fy - ny * 2);
    ctx.lineTo(x0 - nx * 2, y0 - ny * 2);
    ctx.closePath();
    ctx.clip();
    ctx.lineWidth = 2;
    worldHatch(ctx, Math.min(x0, x1) - halfWidth, Math.min(y0, y1) - halfWidth, Math.max(x0, x1) + halfWidth, Math.max(y0, y1) + halfWidth, 7);
  }
  ctx.restore();
}

/**
 * Slam telegraph (brute, Old Tusk): a faceted Madder ring of radius r whose
 * hatch closes in from the rim as fill goes 0..1. At 1 the whole disc is
 * hatched and the slam lands.
 */
export function drawSlamRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill = 1): void {
  const N = 20;
  ctx.save();
  ctx.strokeStyle = MADDER;
  ctx.lineJoin = 'miter';
  ctx.lineWidth = OUTLINE;
  ctx.beginPath();
  ngon(ctx, x, y, r, N);
  ctx.closePath();
  ctx.stroke();
  const k = Math.max(0, Math.min(1, fill));
  if (k > 0) {
    ctx.beginPath();
    ngon(ctx, x, y, r, N);
    ctx.closePath();
    const ri = r * (1 - k);
    if (ri > 1) {
      ngon(ctx, x, y, ri, N);
      ctx.closePath();
    }
    ctx.clip('evenodd');
    ctx.lineWidth = 2;
    worldHatch(ctx, x - r, y - r, x + r, y + r, 7);
    if (ri > 1) {
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ngon(ctx, x, y, ri, N);
      ctx.closePath();
      ctx.lineWidth = OUTLINE;
      ctx.stroke();
    }
  }
  ctx.restore();
}
