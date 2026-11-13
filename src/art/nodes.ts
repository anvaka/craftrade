// Things you can take: ore blocks, trees, herb clumps. And nests, which are their own thing.
// The body of a node is neutral; the material shows as an inlay in the material's colour (flecks, leaves, blossoms).
import { MATS, NODE_MAT, type NodeKind } from '../data';
import type { Game, OreNode } from '../game';
import {
  T, INK, blit, cache, composite, ell, hash2, inked, mix, poly, rgba, rng, roundPoly, shade, smooth, spike, sprite, tinted,
  type Ctx, type Part, type Pt, type Rnd, type Sprite,
} from './util';

const sprites = cache<Sprite>();
const whites = new WeakMap<Sprite, Sprite>();
export const RICH = '#f2c230';
const OW = 0.055 * T;

function groundShadow(c: Ctx, x: number, y: number, rx: number, ry: number): void {
  const g = c.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, 'rgba(0,0,0,0.34)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  c.translate(-x, -y);
  c.fillStyle = g;
  c.fillRect(x - rx, y - rx, rx * 2, rx * 2);
  c.restore();
}

// --------------------------------------------------------------------- ore

/** One bevelled rock block with bean flecks: ledge to the south, recessed top, mid-tone sides. */
function block(c: Ctx, rnd: Rnd, x: number, y: number, s: number, matrix: string, fleck: string, share: number, cracks: number, rich: boolean): void {
  const h = s / 2;
  const j = () => (rnd() - 0.5) * s * 0.07;
  const pts: Pt[] = [[x - h + j(), y - h * 0.94 + j()], [x + h * 0.96 + j(), y - h + j()], [x + h + j(), y + h * 0.94 + j()], [x - h * 0.97 + j(), y + h + j()]];
  const path = roundPoly(pts, s * 0.25);
  c.strokeStyle = INK;
  c.lineWidth = OW * 2;
  c.stroke(path);
  c.save();
  c.fillStyle = shade(matrix, 0.7);
  c.fill(path);
  c.clip(path);
  const top = roundPoly([[x - 0.3 * s, y - 0.37 * s], [x + 0.3 * s, y - 0.37 * s], [x + 0.27 * s, y + 0.04 * s], [x - 0.27 * s, y + 0.04 * s]], s * 0.09);
  c.fillStyle = shade(matrix, 0.51);
  c.fill(top);
  c.fillStyle = matrix;
  c.fill(poly([[x - 0.27 * s, y + 0.05 * s], [x + 0.27 * s, y + 0.05 * s], [x + 0.52 * s, y + 0.52 * s], [x - 0.52 * s, y + 0.52 * s]]));
  // flecks: one flat colour, all slanted the same way, darker where they sit on the recessed top
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      const keep = rnd() < share;
      const fx = (gx - 1.5 + (gy % 2 ? 0.25 : -0.25)) * s * 0.24 + (rnd() - 0.5) * s * 0.1;
      const fy = (gy - 1.5) * s * 0.24 + (rnd() - 0.5) * s * 0.1;
      const rot = -0.6 + (rnd() - 0.5) * 0.3;
      const L = s * (0.2 + rnd() * 0.08);
      const W = s * (0.1 + rnd() * 0.03);
      if (!keep) continue;
      const onTop = Math.abs(fx) < 0.29 * s && fy > -0.37 * s && fy < 0.04 * s;
      const onLedge = fy > 0.05 * s && Math.abs(fx) < 0.27 * s + (fy - 0.05 * s) * 0.53;
      c.save();
      c.translate(x + fx, y + fy);
      c.rotate(rot);
      c.beginPath();
      c.moveTo(-L / 2, 0);
      c.bezierCurveTo(-L / 2, -W, L / 4, -W * 0.9, L / 2, -W * 0.15);
      c.bezierCurveTo(L / 3, W * 0.5, -L / 4, W * 0.7, -L / 2, 0);
      c.fillStyle = shade(fleck, onTop ? 0.7 : onLedge ? 1.04 : 0.86);
      c.fill();
      if (rich && !onTop) {
        c.strokeStyle = rgba('#ffffff', 0.55);
        c.lineWidth = s * 0.02;
        c.beginPath();
        c.moveTo(-L / 2.4, -W * 0.5);
        c.quadraticCurveTo(0, -W * 0.95, L / 3, -W * 0.5);
        c.stroke();
      }
      c.restore();
    }
  }
  // cracks from mining
  c.strokeStyle = rgba(INK, 0.85);
  c.lineWidth = s * 0.035;
  for (let i = 0; i < cracks; i++) {
    let cx = x + (rnd() - 0.5) * s * 0.5;
    let cy = y - h;
    c.beginPath();
    c.moveTo(cx, cy);
    for (let k = 0; k < 4; k++) {
      cx += (rnd() - 0.5) * s * 0.3;
      cy += s * (0.14 + rnd() * 0.14);
      c.lineTo(cx, cy);
    }
    c.stroke();
  }
  c.restore();
}

function rubble(c: Ctx, rnd: Rnd, x: number, y: number, s: number, col: string): void {
  const n = 5 + Math.floor(rnd() * 2);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + (rnd() - 0.5) * 0.4;
    const r = s * (0.36 + rnd() * 0.14);
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8]);
  }
  const p = roundPoly(pts, s * 0.08);
  inked(c, p, col, OW * 0.75);
  c.save();
  c.clip(p);
  c.fillStyle = rgba(shade(col, 1.2), 0.7);
  c.fillRect(x - s, y - s, s * 1.05, s * 0.95);
  c.restore();
}

function oreArt(c: Ctx, rnd: Rnd, r: number, rich: boolean, stage: number, matCol: string, dull: boolean): void {
  let matrix = mix('#6f6763', matCol, 0.16);
  let fleck = mix(matCol, '#ffffff', 0.08);
  if (dull) {
    fleck = mix(shade(matrix, 0.92), matCol, 0.14);
    matrix = shade(mix(matrix, '#5b5653', 0.6), 0.8);
  }
  const k = r / 22;
  const layout: [number, number, number][] = rich
    ? [[0, -9, 1.25], [-18, 7, 1.0], [18, 8, 0.92], [1, 18, 0.74]]
    : [[-4, -7, 1.2], [14, 8, 0.84], [-15, 11, 0.68]];
  const left = Math.max(1, layout.length - stage);
  groundShadow(c, 3 * k, 12 * k, r * 1.55, r * 0.8);
  c.fillStyle = 'rgba(196,180,172,0.5)';
  for (let i = 0; i < 12; i++) {
    const a = rnd() * 6.28;
    const d = r * (0.9 + rnd() * 0.6);
    c.beginPath();
    c.ellipse(Math.cos(a) * d, Math.sin(a) * d * 0.6 + 8 * k, T * (0.04 + rnd() * 0.04), T * (0.03 + rnd() * 0.03), rnd() * 3, 0, 6.28);
    c.fill();
  }
  const blocks = layout.map(([x, y, s], i) => ({ x: x * k * (rich ? 0.82 : 1), y: y * k * (rich ? 0.82 : 1), s: s * T * (rich ? 1.05 : 1), i }));
  blocks.sort((a, b) => a.y - b.y);
  for (const b of blocks) {
    if (b.i >= left) rubble(c, rnd, b.x, b.y + b.s * 0.2, b.s * 0.55, shade(matrix, 0.72));
    else block(c, rnd, b.x, b.y, b.s * (b.i === 0 && stage >= layout.length ? 0.85 : 1), matrix, fleck, Math.max(0.3, (rich ? 1 : 0.9) - stage * 0.17), b.i === 0 ? stage : Math.max(0, stage - 1), rich && !dull);
  }
}

// -------------------------------------------------------------------- wood

function treeArt(c: Ctx, rnd: Rnd, r: number, rich: boolean, stage: number, stages: number, matCol: string, tier: number, dull: boolean): void {
  const ow = OW * 0.9;
  const baseY = r * 0.62;
  const rootY = -r * 0.3;
  groundShadow(c, r * 0.35, baseY + 1, r * 1.25, r * 0.42);
  // trunk: a tapered quad with a slight bend
  const tw = r * 0.2;
  const trunk = new Path2D();
  trunk.moveTo(-tw * 1.25, baseY);
  trunk.bezierCurveTo(-tw * 0.7, baseY - r * 0.3, -tw * 1.1, rootY + r * 0.2, -tw * 0.6, rootY - r * 0.1);
  trunk.lineTo(tw * 0.6, rootY - r * 0.1);
  trunk.bezierCurveTo(tw * 0.5, rootY + r * 0.25, tw * 0.9, baseY - r * 0.3, tw * 1.3, baseY);
  trunk.closePath();
  const bark = dull ? '#4d4338' : '#6e4d22';
  const g = c.createLinearGradient(-tw, 0, tw, 0);
  g.addColorStop(0, bark);
  g.addColorStop(0.6, bark);
  g.addColorStop(1, shade(bark, 0.68));
  inked(c, trunk, g, ow);
  if (stage >= stages - 1) {
    // the axe notch
    c.fillStyle = '#d9b77a';
    c.strokeStyle = INK;
    c.lineWidth = ow * 0.8;
    const n = poly([[-tw * 1.05, baseY - r * 0.42], [tw * 0.1, baseY - r * 0.3], [-tw * 1.1, baseY - r * 0.18]]);
    c.fill(n);
    c.stroke(n);
  }
  // canopy: pointed lobes fanning up and out like a hand
  const total = rich ? 7 : 6;
  const keep = Math.max(2, Math.round(total * (1 - stage / stages)));
  const greens = dull ? ['#3b3f2c', '#42462f', '#484c33'] : ['#454c22', '#515925', '#5a6430'];
  const lobes: { a: number; L: number; i: number }[] = [];
  for (let i = 0; i < total; i++) {
    const a = -Math.PI + 0.32 + (i / (total - 1)) * (Math.PI - 0.64) + (rnd() - 0.5) * 0.12;
    lobes.push({ a, L: r * (1.0 + rnd() * 0.22) * (i === 0 || i === total - 1 ? 0.86 : 1), i });
  }
  // strikes take lobes off from the right, leaving stubs
  const order = [...lobes].sort((p, q) => Math.abs(Math.cos(q.a)) - Math.abs(Math.cos(p.a)));
  const cut = new Set(lobes.slice(keep).map((l) => l.i));
  const leaf = (a: number, L: number, w: number): Path2D => {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const at = (u: number, v: number): Pt => [ca * u - sa * v, rootY + sa * u + ca * v];
    return smooth([at(-L * 0.08, 0), at(L * 0.22, -w * 0.62), at(L * 0.62, -w * 0.6), at(L * 0.96, -w * 0.12), at(L * 1.06, 0), at(L * 0.96, w * 0.12), at(L * 0.62, w * 0.6), at(L * 0.22, w * 0.62)]);
  };
  const parts: Part[] = [];
  const dabs: { x: number; y: number; a: number; up: boolean }[] = [];
  order.forEach((l, k) => {
    if (cut.has(l.i)) {
      const p = spike(Math.cos(l.a) * 0, rootY, Math.cos(l.a) * r * 0.42, rootY + Math.sin(l.a) * r * 0.42, r * 0.16);
      parts.push({ p, fill: shade(bark, 0.85) });
      return;
    }
    const w = r * 0.56;
    parts.push({ p: leaf(l.a, l.L, w), fill: greens[Math.min(2, Math.floor((k / order.length) * 3))] });
    for (let d = 0; d < 5; d++) {
      const u = l.L * (0.3 + rnd() * 0.6);
      const v = (rnd() - 0.5) * w * 0.7;
      dabs.push({ x: Math.cos(l.a) * u - Math.sin(l.a) * v, y: rootY + Math.sin(l.a) * u + Math.cos(l.a) * v, a: l.a, up: v < 0 });
    }
  });
  composite(c, parts, ow);
  // painterly dabs in the canopy's own greens
  for (const d of dabs) {
    c.fillStyle = rgba(d.up ? shade(greens[2], 1.14) : shade(greens[0], 0.9), 0.75);
    c.beginPath();
    c.ellipse(d.x, d.y, r * 0.11, r * 0.05, d.a, 0, 6.28);
    c.fill();
  }
  // the inlay: this is what says which wood it is
  if (dull) return;
  const n = Math.round((rich ? 20 : 13) * (keep / total));
  const live = lobes.filter((l) => !cut.has(l.i));
  for (let i = 0; i < n; i++) {
    const l = live[i % live.length];
    const u = l.L * (0.25 + rnd() * 0.68);
    const v = (rnd() - 0.5) * r * 0.36;
    const x = Math.cos(l.a) * u - Math.sin(l.a) * v;
    const y = rootY + Math.sin(l.a) * u + Math.cos(l.a) * v;
    c.lineWidth = ow * 0.7;
    c.strokeStyle = rgba(INK, 0.8);
    if (tier === 3) {
      // blossoms
      const pr = r * 0.085;
      c.fillStyle = matCol;
      c.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * 6.28 + i;
        c.moveTo(x + Math.cos(a) * pr + pr * 0.75, y + Math.sin(a) * pr);
        c.arc(x + Math.cos(a) * pr, y + Math.sin(a) * pr, pr * 0.75, 0, 6.28);
      }
      c.stroke();
      c.fill();
      c.fillStyle = shade(matCol, 1.35);
      c.beginPath();
      c.arc(x, y, pr * 0.55, 0, 6.28);
      c.fill();
    } else {
      // leaves (greenwood) or seed pods (oldwood)
      c.fillStyle = matCol;
      c.beginPath();
      if (tier === 2) c.ellipse(x, y, r * 0.1, r * 0.13, 0, 0, 6.28);
      else c.ellipse(x, y, r * 0.17, r * 0.085, l.a + (rnd() - 0.5), 0, 6.28);
      c.stroke();
      c.fill();
      c.fillStyle = rgba(shade(matCol, 1.25), 0.9);
      c.beginPath();
      c.ellipse(x - r * 0.02, y - r * 0.025, r * 0.06, r * 0.035, l.a, 0, 6.28);
      c.fill();
    }
  }
}

// -------------------------------------------------------------------- herb

function herbArt(c: Ctx, rnd: Rnd, r: number, rich: boolean, stage: number, stages: number, matCol: string, tier: number, dull: boolean): void {
  const ow = OW * 0.85;
  const baseY = r * 0.6;
  groundShadow(c, r * 0.2, baseY, r * 1.2, r * 0.42);
  const total = rich ? 15 : 11;
  const keep = Math.max(3, Math.round(total * (1 - stage / stages)));
  const stalks = dull ? ['#4a4c38', '#53553d', '#434533'] : ['#5b6638', '#66723e', '#4f5a32'];
  const blades: Part[] = [];
  const stubs: Part[] = [];
  const heads: { x: number; y: number; a: number }[] = [];
  const idx = [...Array(total).keys()].sort(() => rnd() - 0.5);
  const cutSet = new Set(idx.slice(keep));
  for (let i = 0; i < total; i++) {
    const f = i / (total - 1);
    const bx = (f - 0.5) * r * 1.1 + (rnd() - 0.5) * r * 0.1;
    const lean = (f - 0.5) * 1.25 + (rnd() - 0.5) * 0.25;
    const hgt = r * (1.45 + rnd() * 0.75) * (1 - Math.abs(f - 0.5) * 0.5);
    const tx = bx + Math.sin(lean) * hgt;
    const ty = baseY - Math.cos(lean) * hgt;
    if (cutSet.has(i)) {
      stubs.push({ p: poly([[bx - r * 0.07, baseY], [bx + Math.sin(lean) * r * 0.36 - r * 0.06, baseY - r * 0.36], [bx + Math.sin(lean) * r * 0.36 + r * 0.07, baseY - r * 0.3], [bx + r * 0.07, baseY]]), fill: '#8c8a5a' });
      continue;
    }
    blades.push({ p: spike(bx, baseY, tx, ty, r * 0.2, (rnd() - 0.5) * r * 0.3), fill: stalks[i % 3], line: 0.45 });
    if (i % 3 !== 1 || rich) heads.push({ x: tx, y: ty, a: lean });
  }
  // broad low leaves give the clump a body
  const low: Part[] = [];
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i - 1.5) * 0.62;
    low.push({ p: spike(0, baseY, Math.cos(a) * r * 0.95, baseY + Math.sin(a) * r * 0.62, r * 0.42, (i - 1.5) * r * 0.12), fill: shade(stalks[0], 0.86), line: 0.45 });
  }
  composite(c, [...low, ...stubs, ...blades], ow);
  if (dull) {
    // closed buds
    for (const h of heads) inked(c, ell(h.x, h.y, r * 0.09, r * 0.13, h.a), '#5a5c48', ow * 0.7);
    return;
  }
  for (const h of heads) {
    if (tier === 1) {
      // reed: a cattail head
      inked(c, ell(h.x - Math.sin(h.a) * r * 0.1, h.y + Math.cos(h.a) * r * 0.1, r * 0.11, r * 0.27, h.a), matCol, ow * 0.75);
      c.fillStyle = rgba(shade(matCol, 0.72), 0.8);
      c.beginPath();
      c.ellipse(h.x - Math.sin(h.a) * r * 0.1 + r * 0.04, h.y + Math.cos(h.a) * r * 0.1, r * 0.045, r * 0.2, h.a, 0, 6.28);
      c.fill();
    } else if (tier === 2) {
      // silkweed: a pale tuft of three puffs
      const p = new Path2D();
      p.arc(h.x - r * 0.1, h.y + r * 0.03, r * 0.13, 0, 6.28);
      p.moveTo(h.x + r * 0.23, h.y + r * 0.03);
      p.arc(h.x + r * 0.1, h.y + r * 0.03, r * 0.13, 0, 6.28);
      p.moveTo(h.x + r * 0.15, h.y - r * 0.1);
      p.arc(h.x, h.y - r * 0.1, r * 0.15, 0, 6.28);
      inked(c, p, matCol, ow * 0.75);
      c.fillStyle = rgba(shade(matCol, 0.8), 0.7);
      c.beginPath();
      c.arc(h.x + r * 0.05, h.y + r * 0.06, r * 0.07, 0, 6.28);
      c.fill();
    } else {
      // ghostbloom: four petals round a pale heart
      const p = new Path2D();
      for (let k = 0; k < 4; k++) {
        const a = h.a + k * (Math.PI / 2) + 0.4;
        p.moveTo(h.x + Math.cos(a) * r * 0.13 + r * 0.12, h.y + Math.sin(a) * r * 0.13);
        p.ellipse(h.x + Math.cos(a) * r * 0.13, h.y + Math.sin(a) * r * 0.13, r * 0.12, r * 0.09, a, 0, 6.28);
      }
      inked(c, p, matCol, ow * 0.75);
      c.fillStyle = shade(matCol, 1.5);
      c.beginPath();
      c.arc(h.x, h.y, r * 0.07, 0, 6.28);
      c.fill();
    }
  }
}

// -------------------------------------------------------------------- nest

function nestArt(c: Ctx, rnd: Rnd, r: number, stage: number): void {
  const ow = OW * 0.9;
  groundShadow(c, 0, r * 0.35, r * 1.5, r * 0.75);
  const base = smooth([[-r * 1.15, r * 0.25], [-r * 0.7, -r * 0.5], [r * 0.1, -r * 0.62], [r * 0.95, -r * 0.4], [r * 1.2, r * 0.3], [r * 0.5, r * 0.78], [-r * 0.5, r * 0.8]]);
  inked(c, base, '#3a2636', ow);
  c.fillStyle = '#4d3148';
  c.fill(smooth([[-r * 0.8, r * 0.1], [-r * 0.4, -r * 0.35], [r * 0.5, -r * 0.3], [r * 0.8, r * 0.2], [r * 0.2, r * 0.5], [-r * 0.4, r * 0.5]]));
  const eggs: [number, number, number][] = [[-0.55, 0.12, 0.36], [0.5, 0.18, 0.34], [0, -0.3, 0.4], [-0.2, 0.38, 0.33], [0.3, -0.05, 0.3], [-0.5, -0.28, 0.27], [0.62, -0.25, 0.25]];
  eggs.sort((a, b) => a[1] - b[1]);
  eggs.forEach(([ex, ey, er], i) => {
    const x = ex * r;
    const y = ey * r;
    const s = er * r;
    const broken = stage > 0 && i % 2 === 0;
    if (broken) {
      // a burst shell and goo
      const shell = poly([[x - s, y + s * 0.2], [x - s * 0.7, y - s * 0.5], [x - s * 0.3, y - s * 0.05], [x, y - s * 0.6], [x + s * 0.35, y - s * 0.05], [x + s * 0.75, y - s * 0.45], [x + s, y + s * 0.2], [x + s * 0.5, y + s * 0.8], [x - s * 0.5, y + s * 0.8]]);
      inked(c, shell, '#8f6c80', ow * 0.8);
      c.fillStyle = '#5c2d4e';
      c.beginPath();
      c.ellipse(x, y + s * 0.3, s * 0.55, s * 0.3, 0, 0, 6.28);
      c.fill();
      return;
    }
    const egg = ell(x, y, s * 0.82, s, (rnd() - 0.5) * 0.5);
    const g = c.createRadialGradient(x - s * 0.2, y - s * 0.3, s * 0.1, x, y, s * 1.05);
    g.addColorStop(0, '#f6cbd8');
    g.addColorStop(1, '#c9829f');
    inked(c, egg, g, ow * 0.85);
    c.fillStyle = '#6b2a52';
    c.beginPath();
    c.ellipse(x + s * 0.08, y + s * 0.15, s * 0.3, s * 0.4, 0.4, 0, 6.28);
    c.fill();
    c.fillStyle = INK;
    c.beginPath();
    c.arc(x + s * 0.02, y + s * 0.02, s * 0.1, 0, 6.28);
    c.fill();
  });
}

// ----------------------------------------------------------------- sprites

function nodeSprite(n: OreNode, tier: number, dull: boolean): Sprite {
  const variant = hash2(n.x, n.y) % 4;
  const key = `${n.kind}|${tier}|${n.rich ? 1 : 0}|${n.stage}|${dull ? 1 : 0}|${variant}|${Math.round(n.r)}`;
  let s = sprites.get(key);
  if (s) return s;
  const r = n.r;
  const rnd = rng(variant * 977 + (n.rich ? 31 : 0) + 5);
  if (n.kind === 'nest') {
    s = sprite(r * 3.4, r * 3, r * 1.7, r * 1.5, (c) => nestArt(c, rnd, r, n.stage));
  } else {
    const kind = n.kind as NodeKind;
    const col = MATS[NODE_MAT[kind][tier - 1]].color;
    const stage = Math.min(n.stage, n.stages - 1);
    if (kind === 'ore') s = sprite(r * 4, r * 3.6, r * 2, r * 1.8, (c) => oreArt(c, rnd, r, n.rich, stage, col, dull));
    else if (kind === 'wood') s = sprite(r * 4, r * 3.8, r * 2, r * 2.5, (c) => treeArt(c, rnd, r, n.rich, stage, n.stages, col, tier, dull));
    else s = sprite(r * 4, r * 4.4, r * 2, r * 3.1, (c) => herbArt(c, rnd, r, n.rich, stage, n.stages, col, tier, dull));
  }
  sprites.set(key, s);
  return s;
}

let glowSprite: Sprite | null = null;
function richGlow(): Sprite {
  if (glowSprite) return glowSprite;
  glowSprite = sprite(128, 128, 64, 64, (c) => {
    const g = c.createRadialGradient(0, 0, 4, 0, 0, 64);
    g.addColorStop(0, rgba(RICH, 0.7));
    g.addColorStop(0.5, rgba(RICH, 0.28));
    g.addColorStop(1, rgba(RICH, 0));
    c.fillStyle = g;
    c.fillRect(-64, -64, 128, 128);
  }, 1);
  return glowSprite;
}

function star(c: Ctx, x: number, y: number, s: number): void {
  c.beginPath();
  c.moveTo(x, y - s);
  c.quadraticCurveTo(x, y, x + s, y);
  c.quadraticCurveTo(x, y, x, y + s);
  c.quadraticCurveTo(x, y, x - s, y);
  c.quadraticCurveTo(x, y, x, y - s);
  c.fill();
}

/** Four white corner brackets: "the heavy swing would land here". */
export function brackets(c: Ctx, x: number, y: number, half: number, color: string, w: number): void {
  const a = half * 0.42;
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = 'square';
  c.lineJoin = 'miter';
  c.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    c.moveTo(x + sx * half, y + sy * (half - a));
    c.lineTo(x + sx * half, y + sy * half);
    c.lineTo(x + sx * (half - a), y + sy * half);
  }
  c.stroke();
  c.lineCap = 'round';
  c.lineJoin = 'round';
}

export interface NodeMarks {
  eaten: boolean; // a burrower is chewing it
  aimed: boolean; // the heavy swing would hit it
  charge: number; // 0..1 wind-up, for the aim marker
}

export function drawNode(c: Ctx, n: OreNode, g: Game, time: number, m: NodeMarks): void {
  const tier = g.spec.tier;
  if (n.kind === 'nest') {
    // a hostile thing: pulsing eggs on a pink glow
    const pulse = 1 + 0.05 * Math.sin(time * 7 + n.x);
    c.globalAlpha = 0.5 + 0.2 * Math.sin(time * 7 + n.x);
    c.fillStyle = rgba('#ff5c9a', 0.35);
    c.beginPath();
    c.ellipse(n.x, n.y + 4, n.r * 1.7, n.r * 1.2, 0, 0, 6.28);
    c.fill();
    c.globalAlpha = 1;
    const s = nodeSprite(n, tier, false);
    blit(c, s, n.x, n.y, 0, pulse, 2 - pulse);
    if (n.flash > 0) flashOver(c, s, n, pulse);
    pips(c, n, g, false, time);
    if (m.aimed) brackets(c, n.x, n.y, n.r + 9, m.charge >= 1 ? '#ffd34d' : '#ffffff', 2.4);
    return;
  }
  if (!n.open) {
    // sealed: dull, squat, a dashed ring where it will open
    c.setLineDash([5, 6]);
    c.strokeStyle = rgba('#a08a3c', 0.75);
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(n.x, n.y + 2, n.r + 9, 0, 6.28);
    c.stroke();
    c.setLineDash([]);
    const s = nodeSprite(n, tier, true);
    c.globalAlpha = 0.82;
    blit(c, s, n.x, n.y + n.r * 0.12, 0, 0.88, 0.8);
    c.globalAlpha = 1;
    if (n.flash > 0) flashOver(c, s, n, 0.88);
    return;
  }
  if (n.rich) {
    const left = g.richCloseIn;
    const closing = left < 8;
    const blink = closing ? 0.5 + 0.5 * Math.sin(time * (left < 3 ? 22 : 11)) : 0.5 + 0.5 * Math.sin(time * 3.2 + n.x);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = closing ? 0.25 + 0.5 * blink : 0.5 + 0.22 * blink;
    blit(c, richGlow(), n.x, n.y + 4, 0, (n.r * 3.4) / 64, (n.r * 2.6) / 64);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    if (closing) {
      // the time left, as an arc that runs down
      const col = left < 3 ? '#ff5a3c' : RICH;
      c.strokeStyle = rgba(INK, 0.55);
      c.lineWidth = 6;
      c.beginPath();
      c.arc(n.x, n.y, n.r + 15, 0, 6.28);
      c.stroke();
      c.strokeStyle = col;
      c.lineWidth = 3.4;
      c.beginPath();
      c.arc(n.x, n.y, n.r + 15, -Math.PI / 2, -Math.PI / 2 + (Math.max(0, left) / 8) * 6.283);
      c.stroke();
    }
  }
  const s = nodeSprite(n, tier, false);
  blit(c, s, n.x, n.y);
  if (n.flash > 0) flashOver(c, s, n, 1);
  if (n.rich) {
    // glints: the "special" cue that reads from across the screen
    c.fillStyle = '#fff6c8';
    for (let i = 0; i < 3; i++) {
      const ph = time * 1.7 + i * 2.1 + n.x * 0.01;
      const k = Math.max(0, Math.sin(ph));
      if (k < 0.05) continue;
      const cyc = Math.floor(ph / Math.PI);
      const hx = n.x + (((hash2(cyc, i + n.y) % 100) / 100) - 0.5) * n.r * 2.2;
      const hy = n.y - n.r * 0.2 + (((hash2(i + n.x, cyc) % 100) / 100) - 0.5) * n.r * 1.6;
      star(c, hx, hy, 2 + 5.5 * k);
    }
  }
  if (m.eaten) {
    // being eaten: a hard red ring that blinks
    c.strokeStyle = rgba('#ff3b4e', 0.55 + 0.45 * Math.sin(time * 16));
    c.lineWidth = 2.4;
    c.setLineDash([7, 5]);
    c.beginPath();
    c.arc(n.x, n.y, n.r + 7, time * 2, time * 2 + 6.283);
    c.stroke();
    c.setLineDash([]);
  }
  pips(c, n, g, m.eaten, time);
  if (m.aimed) brackets(c, n.x, n.y, n.r + 9, m.charge >= 1 ? '#ffd34d' : '#ffffff', m.charge > 0 ? 2.8 : 2);
}

function flashOver(c: Ctx, s: Sprite, n: OreNode, k: number): void {
  // the struck flash: the silhouette in white
  let w = whites.get(s);
  if (!w) whites.set(s, (w = tinted(s, '#ffffff')));
  c.globalAlpha = Math.min(1, n.flash / 0.15) * 0.8;
  blit(c, w, n.x, n.y + (n.open ? 0 : n.r * 0.12), 0, k, n.open ? k : 0.8);
  c.globalAlpha = 1;
}

/** Heavy swings left with this tool and kit, as pips under the node. They blink red while something is eating it. */
function pips(c: Ctx, n: OreNode, g: Game, eaten: boolean, time: number): void {
  const all = g.swingsLeft(n, n.stages); // swings a whole node takes
  const left = g.swingsLeft(n);
  const w = 6;
  const gap = 3;
  const total = all * w + (all - 1) * gap;
  const x0 = n.x - total / 2;
  const y = n.y + n.r + 11;
  c.fillStyle = 'rgba(0,0,0,0.6)';
  c.fillRect(x0 - 2, y - 2, total + 4, 8);
  for (let i = 0; i < all; i++) {
    const on = i < left;
    c.fillStyle = !on ? 'rgba(255,255,255,0.16)' : eaten ? (Math.sin(time * 16) > 0 ? '#ff3b4e' : '#ffd0d4') : '#ffffff';
    c.fillRect(x0 + i * (w + gap), y, w, 4);
  }
}
