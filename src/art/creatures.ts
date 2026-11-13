// Things that hurt you: insect-like creatures seen from above, turned to their heading.
// One family: dark chitin and bone, pointed silhouettes, and one accent no material uses (hot magenta) for
// eyes, sacs and everything they shoot. Each kind has its own outline; size says how much it matters.
import { CFG, type EnemyKind } from '../data';
import type { Enemy, Game } from '../game';
import {
  INK, blit, cache, centred, composite, ell, inked, lin, poly, rgba, roundPoly, shade, smooth, soft, spike, sym, tinted,
  type Ctx, type Part, type Pt, type Sprite,
} from './util';
import { flame, glow } from './fx';

export const HOT = '#ff3d86'; // the hostile accent
const HOT_PALE = '#ffb3d0';
const BONE = '#d8ceac';
const BONE_SH = '#a39a7e';
const CHAR = '#4a424c';
const CHAR_D = '#2e2832';
const WINE = '#a44c68';
const WINE_D = '#77344c';
const ROSE = '#cf97a4';
const PLUM = '#75506f';
const SLATE = '#7b7590'; // armour plate
const GOLD = '#ffd34d';

const sprites = cache<Sprite>();
const whites = new WeakMap<Sprite, Sprite>();
const ghosts = new WeakMap<Sprite, Sprite>();

const ow = (r: number) => Math.max(1.05, Math.min(2.4, r * 0.085));

function eyes(c: Ctx, pts: Pt[], s: number): void {
  c.fillStyle = HOT;
  for (const [x, y] of pts) {
    c.beginPath();
    c.arc(x, y, s, 0, 6.28);
    c.fill();
  }
  c.fillStyle = '#fff';
  for (const [x, y] of pts) {
    c.beginPath();
    c.arc(x + s * 0.25, y - s * 0.2, s * 0.35, 0, 6.28);
    c.fill();
  }
}
/** Short plate lines across a body, thinner than the outline. */
function bands(c: Ctx, xs: number[], hw: number, bulge: number, w: number): void {
  c.strokeStyle = rgba(INK, 0.75);
  c.lineWidth = w;
  for (const x of xs) {
    c.beginPath();
    c.moveTo(x, -hw);
    c.quadraticCurveTo(x - bulge, 0, x, hw);
    c.stroke();
  }
}
const mirror = (f: (s: number) => Part[]): Part[] => [...f(1), ...f(-1)];

// ------------------------------------------------------------------- kinds

function swarm(c: Ctx, r: number, ash: boolean): void {
  const L = 2.4 * r;
  const o = ow(r);
  const body = ash ? '#9a979c' : WINE;
  const dark = ash ? '#5f5c63' : WINE_D;
  const parts: Part[] = [
    { p: ell(-0.2 * L, 0, 0.27 * L, 0.25 * L), fill: soft(c, -0.15 * L, 0, 0.05 * L, 0.3 * L, body, 0.74) },
    { p: roundPoly([[0.27 * L, -0.15 * L], [0.27 * L, 0.15 * L], [-0.03 * L, 0.29 * L], [-0.03 * L, -0.29 * L]], 0.05 * L), fill: dark },
    { p: ell(0.33 * L, 0, 0.1 * L, 0.14 * L), fill: CHAR_D },
    ...mirror((s) => [{ p: spike(0.38 * L, s * 0.09 * L, (ash ? 0.66 : 0.54) * L, s * 0.03 * L, (ash ? 0.1 : 0.08) * L, s * 0.04 * L), fill: BONE }]),
  ];
  if (ash) {
    // Ashfang: a spined back
    for (let i = 0; i < 4; i++) parts.unshift(...mirror((s) => [{ p: spike(-0.1 * L - i * 0.09 * L, s * 0.2 * L, -0.2 * L - i * 0.1 * L, s * 0.42 * L, 0.09 * L), fill: CHAR_D }]));
  }
  composite(c, parts, o);
  if (ash) {
    // ember cracks
    c.strokeStyle = '#ff7a3c';
    c.lineWidth = o * 0.9;
    c.beginPath();
    c.moveTo(-0.38 * L, -0.08 * L);
    c.lineTo(-0.26 * L, 0.02 * L);
    c.lineTo(-0.18 * L, -0.1 * L);
    c.lineTo(-0.06 * L, 0.04 * L);
    c.moveTo(-0.3 * L, 0.14 * L);
    c.lineTo(-0.2 * L, 0.08 * L);
    c.stroke();
    eyes(c, [[0.34 * L, -0.07 * L], [0.34 * L, 0.07 * L]], 0.035 * L);
  } else if (r > 7) {
    c.fillStyle = HOT;
    c.fillRect(0.31 * L, -0.085 * L, 0.05 * L, 0.05 * L);
    c.fillRect(0.31 * L, 0.035 * L, 0.05 * L, 0.05 * L);
  }
}

function shieldBug(c: Ctx, r: number, up: boolean, thorn: boolean): void {
  const o = ow(r);
  const parts: Part[] = [];
  // legs: small claws at the edge
  for (const x of [-0.75, -0.3, 0.1]) parts.push(...mirror((s) => [{ p: spike(x * r, s * 0.55 * r, (x - 0.22) * r, s * 0.98 * r, 0.24 * r, -s * 0.08 * r), fill: CHAR_D }]));
  if (thorn) for (const x of [-0.95, -0.6, -0.25]) parts.push(...mirror((s) => [{ p: spike(x * r, s * 0.3 * r, (x - 0.25) * r, s * 0.78 * r, 0.2 * r), fill: BONE }]));
  parts.push({ p: ell(-0.38 * r, 0, 0.7 * r, 0.64 * r), fill: soft(c, -0.25 * r, 0, 0.1 * r, 0.75 * r, PLUM, 0.72) });
  parts.push({ p: ell(0.4 * r, 0, 0.3 * r, 0.36 * r), fill: CHAR });
  if (!up) {
    // broken: the plate is gone, jagged stumps and bare mandibles are left
    parts.push(...mirror((s) => [
      { p: poly([[0.28 * r, s * 0.34 * r], [0.62 * r, s * 0.62 * r], [0.44 * r, s * 0.66 * r], [0.5 * r, s * 0.84 * r], [0.2 * r, s * 0.7 * r], [0.12 * r, s * 0.45 * r]]), fill: BONE_SH },
      { p: spike(0.62 * r, s * 0.14 * r, 0.98 * r, s * 0.05 * r, 0.16 * r, s * 0.06 * r), fill: CHAR_D },
    ]));
  }
  composite(c, parts, o);
  bands(c, [-0.55 * r, -0.2 * r], 0.55 * r, 0.14 * r, o * 0.7);
  eyes(c, [[0.5 * r, -0.17 * r], [0.5 * r, 0.17 * r]], 0.075 * r);
  if (!up) {
    c.strokeStyle = rgba(INK, 0.8);
    c.lineWidth = o * 0.7;
    c.beginPath();
    c.moveTo(0.2 * r, -0.2 * r);
    c.lineTo(0.34 * r, -0.05 * r);
    c.lineTo(0.26 * r, 0.1 * r);
    c.stroke();
    return;
  }
  // the shield: a wide bone crescent across the front, wider than the body
  const plate = new Path2D();
  plate.arc(-0.05 * r, 0, 1.3 * r, -1.12, 1.12);
  plate.arc(0.22 * r, 0, 0.86 * r, 1.05, -1.05, true);
  plate.closePath();
  const pp: Part[] = [{ p: plate, fill: lin(c, 0.6 * r, 0, 1.25 * r, 0, BONE_SH, BONE) }];
  if (thorn) {
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.3;
      pp.unshift({ p: spike(-0.05 * r + Math.cos(a) * 1.22 * r, Math.sin(a) * 1.22 * r, -0.05 * r + Math.cos(a) * 1.62 * r, Math.sin(a) * 1.62 * r, 0.26 * r), fill: BONE });
    }
  }
  composite(c, pp, o);
  // a ridge and studs, so it reads as a made plate
  c.strokeStyle = rgba(BONE_SH, 0.9);
  c.lineWidth = o * 1.1;
  c.beginPath();
  c.arc(-0.05 * r, 0, 1.08 * r, -0.92, 0.92);
  c.stroke();
  c.fillStyle = '#6e654f';
  for (const a of [-0.7, 0, 0.7]) {
    c.beginPath();
    c.arc(-0.05 * r + Math.cos(a) * 1.16 * r, Math.sin(a) * 1.16 * r, 0.06 * r, 0, 6.28);
    c.fill();
  }
}

function burrowerBug(c: Ctx, r: number, maw: boolean): void {
  const o = ow(r);
  const claw = (s: number): Part => ({
    p: smooth([[0.2 * r, s * 0.42 * r], [0.5 * r, s * 1.02 * r], [1.0 * r, s * 1.0 * r], [1.3 * r, s * 0.62 * r], [1.0 * r, s * 0.52 * r], [0.8 * r, s * 0.66 * r], [0.6 * r, s * 0.4 * r]]),
    fill: CHAR_D,
  });
  const parts: Part[] = [
    { p: ell(-0.72 * r, 0, 0.48 * r, 0.5 * r), fill: shade(ROSE, 0.86) },
    { p: ell(-0.2 * r, 0, 0.55 * r, 0.62 * r), fill: soft(c, -0.1 * r, 0, 0.1 * r, 0.65 * r, ROSE, 0.8) },
    claw(1),
    claw(-1),
    { p: ell(0.36 * r, 0, 0.42 * r, 0.5 * r), fill: ROSE },
  ];
  if (maw) {
    // Gravel-Maw: a toothed jaw as wide as the body
    parts.push(...mirror((s) => [{
      p: poly([[0.6 * r, s * 0.08 * r], [0.62 * r, s * 0.5 * r], [1.15 * r, s * 0.42 * r], [1.5 * r, s * 0.1 * r], [1.25 * r, s * 0.16 * r], [1.12 * r, s * 0.04 * r], [0.98 * r, s * 0.17 * r], [0.86 * r, s * 0.04 * r], [0.74 * r, s * 0.16 * r]]),
      fill: BONE,
    }]));
  } else {
    parts.push({ p: ell(0.78 * r, 0, 0.2 * r, 0.24 * r), fill: CHAR });
    parts.push(...mirror((s) => [{ p: spike(0.9 * r, s * 0.1 * r, 1.16 * r, s * 0.03 * r, 0.12 * r, s * 0.04 * r), fill: BONE }]));
  }
  composite(c, parts, o);
  bands(c, [-0.5 * r, 0.02 * r], 0.48 * r, 0.12 * r, o * 0.7);
  if (maw) {
    // gravel studs on the back
    for (const [x, y, s] of [[-0.75, -0.12, 0.17], [-0.42, 0.2, 0.15], [-0.2, -0.24, 0.16], [0.08, 0.12, 0.14], [-0.6, 0.26, 0.12]]) {
      inked(c, roundPoly([[(x - s) * r, (y - s * 0.6) * r], [(x + s * 0.6) * r, (y - s) * r], [(x + s) * r, (y + s * 0.5) * r], [(x - s * 0.5) * r, (y + s) * r]], s * r * 0.4), '#8f8a88', o * 0.6);
    }
    eyes(c, [[0.5 * r, -0.3 * r], [0.5 * r, 0.3 * r]], 0.07 * r);
  } else eyes(c, [[0.8 * r, -0.11 * r], [0.8 * r, 0.11 * r]], 0.07 * r);
}

function spitterBug(c: Ctx, r: number, charge: boolean, queen: boolean): void {
  const o = ow(r);
  const k = charge ? 1.16 : 1;
  const parts: Part[] = [];
  for (const x of [0.2, -0.05]) parts.push(...mirror((s) => [{ p: spike(x * r, s * 0.3 * r, (x - 0.5) * r, s * 0.95 * r, 0.2 * r, s * 0.12 * r), fill: CHAR_D }]));
  if (queen) for (let i = -2; i <= 2; i++) parts.push({ p: spike(-0.05 * r, i * 0.2 * r, -0.4 * r + Math.abs(i) * 0.1 * r, i * 0.56 * r, 0.2 * r), fill: GOLD });
  // the sac: what it spits is stored here, in the hostile colour
  const sac = sym([[-0.05 * r, 0], [-0.2 * r, 0.5 * r * k], [-0.8 * r, 0.74 * r * k], [-1.32 * r * k, 0.46 * r * k], [-1.5 * r * k, 0]]);
  parts.push({ p: sac, fill: soft(c, -0.75 * r, -0.1 * r, 0.08 * r, 0.85 * r * k, charge ? '#ffd9e6' : HOT_PALE, charge ? 0.62 : 0.5) });
  const noz = (a: number): Part[] => {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const at = (u: number, v: number): Pt => [0.3 * r + ca * u - sa * v, sa * u + ca * v];
    return [
      { p: poly([at(0, -0.2 * r), at(0.95 * r, -0.1 * r), at(0.95 * r, 0.1 * r), at(0, 0.2 * r)]), fill: BONE_SH },
      { p: ell(at(0.98 * r, 0)[0], at(0.98 * r, 0)[1], 0.1 * r, 0.19 * r, a), fill: charge ? HOT : BONE },
    ];
  };
  if (queen) parts.push(...noz(-0.42), ...noz(0.42));
  parts.push(...noz(0));
  parts.push({ p: ell(0.12 * r, 0, 0.44 * r, 0.42 * r), fill: soft(c, 0.12 * r, 0, 0.1 * r, 0.46 * r, '#55506a', 0.72) });
  composite(c, parts, o);
  // veins on the sac
  c.strokeStyle = rgba('#a01f5c', 0.7);
  c.lineWidth = o * 0.6;
  c.beginPath();
  c.moveTo(-0.3 * r, -0.2 * r);
  c.quadraticCurveTo(-0.8 * r, -0.5 * r * k, -1.2 * r * k, -0.2 * r);
  c.moveTo(-0.3 * r, 0.22 * r);
  c.quadraticCurveTo(-0.7 * r, 0.3 * r, -1.1 * r * k, 0.3 * r * k);
  c.stroke();
  if (queen) {
    c.fillStyle = '#ffe9f1';
    for (const [x, y] of [[-0.6, -0.3], [-0.9, 0.1], [-0.55, 0.3], [-1.15, -0.12]]) {
      c.beginPath();
      c.arc(x * r, y * r, 0.09 * r, 0, 6.28);
      c.fill();
    }
  }
  eyes(c, [[0.36 * r, -0.24 * r], [0.36 * r, 0.24 * r]], 0.075 * r);
}

function chargerBug(c: Ctx, r: number, wind: boolean): void {
  const o = ow(r);
  const parts: Part[] = [
    ...mirror((s) => [{ p: spike(0.25 * r, s * 0.5 * r, -1.0 * r, s * 1.08 * r, 0.5 * r, -s * 0.1 * r), fill: CHAR_D }]),
    { p: sym([[0.8 * r, 0], [0.55 * r, 0.4 * r], [0.02 * r, 0.72 * r], [-0.6 * r, 0.56 * r], [-1.05 * r, 0.28 * r], [-1.2 * r, 0]]), fill: soft(c, -0.1 * r, 0, 0.1 * r, 0.9 * r, CHAR, 0.7) },
    { p: spike(0.55 * r, 0, 1.85 * r, 0, 0.5 * r), fill: wind ? lin(c, 0.6 * r, 0, 1.8 * r, 0, BONE, HOT) : lin(c, 0.6 * r, 0, 1.8 * r, 0, BONE_SH, BONE) },
  ];
  composite(c, parts, o);
  // chevrons pointing the way it runs
  c.strokeStyle = HOT;
  c.lineWidth = 0.13 * r;
  c.lineJoin = 'miter';
  c.beginPath();
  for (const x of [-0.15, -0.6]) {
    c.moveTo((x - 0.22) * r, -0.3 * r);
    c.lineTo(x * r, 0);
    c.lineTo((x - 0.22) * r, 0.3 * r);
  }
  c.stroke();
  c.lineJoin = 'round';
  eyes(c, [[0.5 * r, -0.26 * r], [0.5 * r, 0.26 * r]], 0.075 * r);
}

function bomberBug(c: Ctx, r: number): void {
  const o = ow(r);
  const parts: Part[] = [];
  for (const a of [0.75, 1.5, 2.3]) parts.push(...mirror((s) => [{ p: spike(Math.cos(a) * 0.7 * r, s * Math.sin(a) * 0.7 * r, Math.cos(a) * 1.22 * r, s * Math.sin(a) * 1.22 * r, 0.22 * r), fill: CHAR_D }]));
  parts.push({ p: ell(0.86 * r, 0, 0.26 * r, 0.3 * r), fill: CHAR });
  // the swollen sac
  parts.push({ p: ell(-0.1 * r, 0, 0.94 * r, 0.9 * r), fill: soft(c, -0.25 * r, -0.2 * r, 0.1 * r, 1.0 * r, '#ffc2d8', 0.6) });
  composite(c, parts, o);
  c.strokeStyle = rgba('#b3245f', 0.75);
  c.lineWidth = o * 0.7;
  c.beginPath();
  for (const s of [-1, 1]) {
    c.moveTo(0.5 * r, s * 0.3 * r);
    c.quadraticCurveTo(0, s * 0.75 * r, -0.7 * r, s * 0.45 * r);
    c.moveTo(0.3 * r, s * 0.08 * r);
    c.quadraticCurveTo(-0.2 * r, s * 0.3 * r, -0.85 * r, s * 0.1 * r);
  }
  c.stroke();
  // the charge inside: a dark seed with a bright ring
  c.fillStyle = '#7a1740';
  c.beginPath();
  c.arc(-0.15 * r, 0, 0.3 * r, 0, 6.28);
  c.fill();
  c.fillStyle = '#fff1f6';
  c.beginPath();
  c.arc(-0.15 * r, 0, 0.14 * r, 0, 6.28);
  c.fill();
  eyes(c, [[0.94 * r, -0.12 * r], [0.94 * r, 0.12 * r]], 0.06 * r);
}

function bruteBug(c: Ctx, r: number): void {
  const o = ow(r);
  const crest = new Path2D();
  crest.moveTo(0.12 * r, -1.02 * r);
  crest.quadraticCurveTo(0.95 * r, -0.72 * r, 0.98 * r, 0);
  crest.quadraticCurveTo(0.95 * r, 0.72 * r, 0.12 * r, 1.02 * r);
  crest.quadraticCurveTo(0.52 * r, 0.5 * r, 0.5 * r, 0);
  crest.quadraticCurveTo(0.52 * r, -0.5 * r, 0.12 * r, -1.02 * r);
  crest.closePath();
  const parts: Part[] = [
    { p: spike(-0.95 * r, 0, -1.45 * r, 0, 0.34 * r), fill: CHAR_D },
    ...mirror((s) => [{ p: ell(-0.48 * r, s * 0.56 * r, 0.42 * r, 0.25 * r, s * 0.25), fill: CHAR_D }]),
    { p: sym([[0.1 * r, 0], [0.02 * r, 0.52 * r], [-0.5 * r, 0.66 * r], [-0.95 * r, 0.44 * r], [-1.1 * r, 0]]), fill: lin(c, -1.1 * r, 0, 0.1 * r, 0, shade(WINE_D, 0.8), WINE) },
    { p: roundPoly([[0.46 * r, -0.56 * r], [0.46 * r, 0.56 * r], [-0.06 * r, 0.62 * r], [-0.06 * r, -0.62 * r]], 0.16 * r), fill: WINE },
    ...mirror((s) => [{ p: spike(0.45 * r, s * 0.86 * r, 1.05 * r, s * 1.32 * r, 0.42 * r, -s * 0.12 * r), fill: lin(c, 0.45 * r, 0, 1.05 * r, 0, BONE_SH, BONE) }]),
    { p: crest, fill: WINE_D },
    ...mirror((s) => [{ p: spike(0.9 * r, s * 0.2 * r, 1.4 * r, s * 0.07 * r, 0.26 * r, s * 0.08 * r), fill: BONE }]),
  ];
  composite(c, parts, o);
  bands(c, [-0.7 * r, -0.38 * r], 0.5 * r, 0.14 * r, o * 0.7);
  eyes(c, [[0.76 * r, -0.2 * r], [0.76 * r, 0.2 * r], [0.66 * r, -0.44 * r], [0.66 * r, 0.44 * r]], 0.055 * r);
}

// ------------------------------------------------------------------ bosses
// Armoured: slate plates with a bone rim cover the body. Open: the plates are gone and the glowing core shows.

function rimPlate(c: Ctx, p: Path2D, o: number): void {
  c.strokeStyle = INK;
  c.lineWidth = o * 2 + o * 2.2;
  c.stroke(p);
  c.strokeStyle = BONE;
  c.lineWidth = o * 2.2;
  c.stroke(p);
  c.fillStyle = SLATE;
  c.fill(p);
  c.strokeStyle = INK;
  c.lineWidth = o * 0.6;
  c.stroke(p);
}
function studs(c: Ctx, pts: Pt[], s: number): void {
  for (const [x, y] of pts) {
    c.fillStyle = INK;
    c.beginPath();
    c.arc(x, y, s * 1.5, 0, 6.28);
    c.fill();
    c.fillStyle = BONE;
    c.beginPath();
    c.arc(x, y, s, 0, 6.28);
    c.fill();
  }
}
function core(c: Ctx, x: number, y: number, s: number): void {
  const g = c.createRadialGradient(x, y, 0, x, y, s);
  g.addColorStop(0, '#fff1f6');
  g.addColorStop(0.45, HOT_PALE);
  g.addColorStop(1, HOT);
  inked(c, ell(x, y, s, s), g, s * 0.1);
  c.strokeStyle = rgba('#8a1648', 0.8);
  c.lineWidth = s * 0.08;
  c.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + 0.4;
    c.moveTo(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45);
    c.lineTo(x + Math.cos(a + 0.2) * s * 0.95, y + Math.sin(a + 0.2) * s * 0.95);
  }
  c.stroke();
}

function foreman(c: Ctx, r: number, arm: boolean): void {
  const o = ow(r);
  const Y = '#d9a826';
  const parts: Part[] = [];
  for (const x of [-0.8, -0.4, 0.0, 0.38]) parts.push(...mirror((s) => [{ p: spike(x * r, s * 0.6 * r, (x - 0.12) * r, s * 0.98 * r, 0.3 * r), fill: CHAR_D }]));
  parts.push(...mirror((s) => [{ p: spike(-0.9 * r, s * 0.3 * r, -1.3 * r, s * 0.5 * r, 0.26 * r), fill: CHAR }]));
  parts.push({ p: roundPoly([[0.55 * r, -0.7 * r], [0.55 * r, 0.7 * r], [-1.02 * r, 0.6 * r], [-1.02 * r, -0.6 * r]], 0.16 * r), fill: soft(c, -0.2 * r, 0, 0.2 * r, 1.0 * r, Y, 0.72) });
  // the blade: a flat wall of iron pushed ahead of it
  const blade = roundPoly([[1.2 * r, -0.92 * r], [1.2 * r, 0.92 * r], [0.74 * r, 1.08 * r], [0.56 * r, 0.6 * r], [0.56 * r, -0.6 * r], [0.74 * r, -1.08 * r]], 0.08 * r);
  parts.push({ p: blade, fill: CHAR });
  composite(c, parts, o);
  // hazard stripes on the blade
  c.save();
  c.clip(blade);
  c.fillStyle = Y;
  for (let i = -8; i < 9; i++) {
    c.beginPath();
    c.moveTo(0.95 * r, i * 0.26 * r);
    c.lineTo(1.25 * r, i * 0.26 * r - 0.22 * r);
    c.lineTo(1.25 * r, i * 0.26 * r - 0.09 * r);
    c.lineTo(0.95 * r, i * 0.26 * r + 0.13 * r);
    c.closePath();
    c.fill();
  }
  c.restore();
  c.strokeStyle = INK;
  c.lineWidth = o * 0.7;
  c.beginPath();
  c.moveTo(0.95 * r, -0.98 * r);
  c.lineTo(0.95 * r, 0.98 * r);
  c.stroke();
  bands(c, [-0.72 * r, 0.22 * r], 0.6 * r, 0, o * 0.7);
  eyes(c, [[0.42 * r, -0.36 * r], [0.42 * r, 0.36 * r]], 0.07 * r);
  if (arm) {
    rimPlate(c, roundPoly([[0.12 * r, -0.82 * r], [0.12 * r, 0.82 * r], [-0.98 * r, 0.74 * r], [-1.12 * r, 0], [-0.98 * r, -0.74 * r]], 0.2 * r), o);
    c.strokeStyle = rgba(INK, 0.7);
    c.lineWidth = o * 0.7;
    c.beginPath();
    c.moveTo(0.12 * r, 0);
    c.lineTo(-1.1 * r, 0);
    c.moveTo(-0.42 * r, -0.78 * r);
    c.lineTo(-0.42 * r, 0.78 * r);
    c.stroke();
    studs(c, [[-0.1 * r, -0.55 * r], [-0.1 * r, 0.55 * r], [-0.75 * r, -0.5 * r], [-0.75 * r, 0.5 * r], [-0.42 * r, 0]], 0.045 * r);
  } else core(c, -0.38 * r, 0, 0.36 * r);
}

function broodmother(c: Ctx, r: number, arm: boolean): void {
  const o = ow(r);
  const F = '#e79ab8';
  const parts: Part[] = [];
  for (const x of [0.75, 0.55, 0.35]) parts.push(...mirror((s) => [{ p: spike(x * r, s * 0.28 * r, (x + 0.35) * r, s * (1.25 - x * 0.4) * r, 0.2 * r, -s * 0.22 * r), fill: CHAR_D }]));
  parts.push({ p: ell(-0.3 * r, 0, 0.95 * r, 0.84 * r), fill: soft(c, -0.2 * r, -0.1 * r, 0.2 * r, 1.0 * r, F, 0.72) });
  parts.push({ p: ell(0.62 * r, 0, 0.36 * r, 0.4 * r), fill: PLUM });
  parts.push({ p: ell(1.0 * r, 0, 0.22 * r, 0.26 * r), fill: CHAR });
  parts.push(...mirror((s) => [{ p: spike(1.14 * r, s * 0.12 * r, 1.48 * r, s * 0.03 * r, 0.14 * r, s * 0.06 * r), fill: BONE }]));
  composite(c, parts, o);
  bands(c, [-0.75 * r, -0.35 * r, 0.05 * r], 0.7 * r, 0.2 * r, o * 0.7);
  eyes(c, [[1.04 * r, -0.12 * r], [1.04 * r, 0.12 * r], [0.94 * r, -0.2 * r], [0.94 * r, 0.2 * r]], 0.045 * r);
  if (arm) {
    for (const [x, w, hw] of [[-0.82, 0.34, 0.6], [-0.36, 0.38, 0.86], [0.1, 0.32, 0.74]]) {
      const p = new Path2D();
      p.moveTo((x + w / 2) * r, -hw * r);
      p.quadraticCurveTo((x + w / 2 - 0.16) * r, 0, (x + w / 2) * r, hw * r);
      p.lineTo((x - w / 2) * r, hw * 0.94 * r);
      p.quadraticCurveTo((x - w / 2 - 0.16) * r, 0, (x - w / 2) * r, -hw * 0.94 * r);
      p.closePath();
      rimPlate(c, p, o);
      studs(c, [[(x - 0.02) * r, -hw * 0.6 * r], [(x - 0.06) * r, 0], [(x - 0.02) * r, hw * 0.6 * r]], 0.04 * r);
    }
    return;
  }
  // open: the eggs she carries and her heart
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i - 3) * 0.36;
    const x = -0.3 * r + Math.cos(a) * 0.86 * r;
    const y = Math.sin(a) * 0.76 * r;
    const g = c.createRadialGradient(x, y, 0, x, y, 0.2 * r);
    g.addColorStop(0, '#fbe2ea');
    g.addColorStop(1, '#d99ab2');
    inked(c, ell(x, y, 0.17 * r, 0.2 * r, a), g, o * 0.7);
    c.fillStyle = '#6b2a52';
    c.beginPath();
    c.arc(x, y, 0.07 * r, 0, 6.28);
    c.fill();
  }
  core(c, -0.25 * r, 0, 0.3 * r);
}

function kiln(c: Ctx, r: number, arm: boolean): void {
  const o = ow(r);
  const IRON = '#54433f';
  const hex: Pt[] = [];
  for (let i = 0; i < 6; i++) hex.push([Math.cos(i * 1.047) * 1.04 * r - 0.05 * r, Math.sin(i * 1.047) * 0.96 * r]);
  const parts: Part[] = [];
  for (const a of [0.9, 1.6, 2.3]) parts.push(...mirror((s) => [{ p: spike(Math.cos(a) * 0.8 * r, s * Math.sin(a) * 0.8 * r, Math.cos(a) * 1.3 * r, s * Math.sin(a) * 1.3 * r, 0.36 * r), fill: CHAR_D }]));
  parts.push({ p: roundPoly(hex, 0.16 * r), fill: soft(c, 0, 0, 0.2 * r, 1.1 * r, IRON, 0.66) });
  composite(c, parts, o);
  // molten seams
  c.strokeStyle = arm ? '#7d2a1c' : '#ff9a2e';
  c.lineWidth = (arm ? 0.045 : 0.075) * r;
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * 1.047 + 0.52;
    c.moveTo(Math.cos(a) * 0.5 * r, Math.sin(a) * 0.5 * r);
    c.lineTo(Math.cos(a + 0.12) * 0.72 * r, Math.sin(a + 0.12) * 0.72 * r);
    c.lineTo(Math.cos(a - 0.08) * 0.9 * r, Math.sin(a - 0.08) * 0.86 * r);
  }
  c.stroke();
  if (!arm) {
    c.strokeStyle = '#ffe07a';
    c.lineWidth = 0.025 * r;
    c.stroke();
  }
  // chimneys on the back
  for (const [x, y] of [[-0.62, 0], [-0.46, -0.48], [-0.46, 0.48]]) {
    inked(c, ell(x * r, y * r, 0.17 * r, 0.17 * r), '#3a302f', o * 0.8);
    c.fillStyle = arm ? '#241c1c' : '#ff8a2e';
    c.beginPath();
    c.arc(x * r, y * r, 0.1 * r, 0, 6.28);
    c.fill();
  }
  if (arm) {
    // shutters over the fire
    rimPlate(c, ell(0.12 * r, 0, 0.46 * r, 0.46 * r), o);
    c.strokeStyle = rgba(INK, 0.75);
    c.lineWidth = o * 0.7;
    c.beginPath();
    c.moveTo(-0.34 * r, 0);
    c.lineTo(0.58 * r, 0);
    c.moveTo(0.12 * r, -0.46 * r);
    c.lineTo(0.12 * r, 0.46 * r);
    c.stroke();
    studs(c, [[-0.1 * r, -0.22 * r], [0.34 * r, -0.22 * r], [-0.1 * r, 0.22 * r], [0.34 * r, 0.22 * r]], 0.04 * r);
    rimPlate(c, roundPoly([[1.02 * r, -0.42 * r], [1.02 * r, 0.42 * r], [0.76 * r, 0.5 * r], [0.76 * r, -0.5 * r]], 0.08 * r), o);
  } else {
    // the open fire: a grate over a white-hot heart, and a glowing mouth
    const g = c.createRadialGradient(0.12 * r, 0, 0, 0.12 * r, 0, 0.46 * r);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(0.4, '#ffd24a');
    g.addColorStop(1, '#ff6a1e');
    inked(c, ell(0.12 * r, 0, 0.44 * r, 0.44 * r), g, o);
    c.strokeStyle = '#2b2222';
    c.lineWidth = 0.06 * r;
    c.beginPath();
    for (const x of [-0.1, 0.12, 0.34]) {
      c.moveTo(x * r, -0.4 * r);
      c.lineTo(x * r, 0.4 * r);
    }
    c.stroke();
    inked(c, ell(0.88 * r, 0, 0.12 * r, 0.4 * r), '#ffb23a', o * 0.8);
  }
  eyes(c, [[0.7 * r, -0.62 * r], [0.7 * r, 0.62 * r]], 0.06 * r);
}

// ----------------------------------------------------------------- sprites

type State = 'a' | 'b';

function look(e: Enemy, g: Game): State {
  if (e.boss) return e.shield ? 'a' : 'b';
  switch (e.kind) {
    case 'shield': return e.shield ? 'a' : 'b';
    case 'spitter': return e.stunT <= 0 && e.t1 < 0.55 && Math.hypot(g.p.x - e.x, g.p.y - e.y) < 520 ? 'b' : 'a';
    case 'charger': return e.tele > 0 || e.dash > 0 ? 'b' : 'a';
    default: return 'a';
  }
}

export function creatureSprite(kind: EnemyKind, r: number, state: State, elite: string, boss: string): Sprite {
  const key = `${kind}|${Math.round(r * 4)}|${state}|${elite}|${boss}`;
  let s = sprites.get(key);
  if (s) return s;
  const half = Math.ceil(r * (kind === 'boss' ? 1.75 : 2.15)) + 3;
  s = centred(half, (c) => {
    if (boss === 'The Foreman') foreman(c, r, state === 'a');
    else if (boss === 'The Broodmother') broodmother(c, r, state === 'a');
    else if (kind === 'boss') kiln(c, r, state === 'a');
    else if (kind === 'swarm') swarm(c, r, elite === 'ashfang');
    else if (kind === 'shield') shieldBug(c, r, state === 'a', elite === 'thornback');
    else if (kind === 'burrower') burrowerBug(c, r, elite === 'maw');
    else if (kind === 'spitter') spitterBug(c, r, state === 'b', elite === 'queen');
    else if (kind === 'charger') chargerBug(c, r, state === 'b');
    else if (kind === 'bomber') bomberBug(c, r);
    else bruteBug(c, r);
  });
  sprites.set(key, s);
  return s;
}

const mounds = cache<Sprite>();
const EARTH = '#7d5f42';
/**
 * The burrower underground: a hump of fresh earth with the hostile colour glowing in its cracks.
 * It cannot be hit, so its outline is dark earth and not black; the glow says what is under it.
 */
function mound(r: number): Sprite {
  const key = String(Math.round(r));
  let s = mounds.get(key);
  if (s) return s;
  s = centred(Math.ceil(r * 2.1), (c) => {
    // loose earth thrown out round it: crumbs, not lines (thin lines read as legs)
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath();
    c.ellipse(0.1 * r, 0.45 * r, 1.5 * r, 0.8 * r, 0, 0, 6.28);
    c.fill();
    for (let i = 0; i < 14; i++) {
      const a = i * 0.449 + (i % 3) * 0.2;
      const d = r * (1.25 + ((i * 37) % 10) * 0.05);
      c.fillStyle = i % 2 ? shade(EARTH, 0.55) : shade(EARTH, 1.1);
      c.beginPath();
      c.ellipse(Math.cos(a) * d, Math.sin(a) * d * 0.72 + 0.1 * r, r * (0.1 + (i % 4) * 0.03), r * 0.08, a, 0, 6.28);
      c.fill();
    }
    const dome = smooth([[-1.25 * r, 0.3 * r], [-0.95 * r, -0.5 * r], [-0.2 * r, -0.85 * r], [0.7 * r, -0.62 * r], [1.25 * r, 0.15 * r], [0.9 * r, 0.72 * r], [-0.6 * r, 0.78 * r]]);
    const g = c.createLinearGradient(0, -0.85 * r, 0, 0.8 * r);
    g.addColorStop(0, shade(EARTH, 1.3));
    g.addColorStop(0.55, EARTH);
    g.addColorStop(1, shade(EARTH, 0.6));
    inked(c, dome, g, r * 0.08, shade(EARTH, 0.3));
    const crack = new Path2D();
    crack.moveTo(-0.6 * r, -0.4 * r);
    crack.lineTo(-0.15 * r, -0.12 * r);
    crack.lineTo(-0.35 * r, 0.36 * r);
    crack.moveTo(-0.15 * r, -0.12 * r);
    crack.lineTo(0.38 * r, -0.2 * r);
    crack.lineTo(0.66 * r, 0.26 * r);
    crack.moveTo(0.38 * r, -0.2 * r);
    crack.lineTo(0.48 * r, -0.52 * r);
    c.strokeStyle = shade(EARTH, 0.28);
    c.lineWidth = r * 0.2;
    c.stroke(crack);
    c.strokeStyle = HOT;
    c.lineWidth = r * 0.09;
    c.stroke(crack);
    c.fillStyle = shade(EARTH, 1.55);
    for (const [x, y] of [[-0.8, 0.12], [0.1, -0.58], [0.9, 0.34], [-0.15, 0.52], [0.55, 0.5]]) {
      c.beginPath();
      c.ellipse(x * r, y * r, 0.12 * r, 0.085 * r, 0.5, 0, 6.28);
      c.fill();
    }
  });
  mounds.set(key, s);
  return s;
}

function white(s: Sprite): Sprite {
  let w = whites.get(s);
  if (!w) whites.set(s, (w = tinted(s, '#ffffff')));
  return w;
}
function ghost(s: Sprite): Sprite {
  let w = ghosts.get(s);
  if (!w) ghosts.set(s, (w = tinted(s, HOT)));
  return w;
}

// ------------------------------------------------------------------ facing

export function facing(e: Enemy, g: Game): number {
  if ((e.kind === 'charger' || e.boss) && (e.tele > 0 || e.dash > 0)) return Math.atan2(e.dy, e.dx);
  if (e.kind === 'burrower' && e.target) return Math.atan2(e.target.y - e.y, e.target.x - e.x);
  return Math.atan2(g.p.y - e.y, g.p.x - e.x);
}

// ---------------------------------------------------------- the ground pass

/** A hostile lane: hard red edges, chevrons, and a fill that grows as the time to react runs out. */
function lane(c: Ctx, e: Enemy, len: number, width: number, k: number, time: number): void {
  c.save();
  c.translate(e.x, e.y);
  c.rotate(Math.atan2(e.dy, e.dx));
  c.fillStyle = 'rgba(214,40,58,0.2)';
  c.fillRect(0, -width / 2, len, width);
  c.fillStyle = 'rgba(255,60,80,0.42)';
  c.fillRect(0, -width / 2, len * k, width);
  c.strokeStyle = '#ff3b4e';
  c.lineWidth = 2;
  c.strokeRect(0, -width / 2, len, width);
  c.strokeStyle = 'rgba(255,220,225,0.85)';
  c.lineWidth = 2.5;
  c.lineJoin = 'miter';
  c.beginPath();
  const off = (time * 160) % 34;
  for (let x = 20 + off; x < len - 6; x += 34) {
    c.moveTo(x - 7, -width * 0.28);
    c.lineTo(x, 0);
    c.lineTo(x - 7, width * 0.28);
  }
  c.stroke();
  c.restore();
}

/** Under the creatures: lanes, the elite ring, the frost patch, the surfacing warning. */
export function drawEnemyGround(c: Ctx, e: Enemy, time: number): void {
  if (e.state === 'under') return;
  if (e.tele > 0) {
    if (e.kind === 'charger') lane(c, e, 240, e.r * 1.5, 1 - e.tele / 0.7, time);
    else if (e.boss) lane(c, e, 330, e.r * 1.7, 1 - e.tele / 0.8, time);
  }
  if (e.elite) {
    // a gold sunburst on the ground: under the creature, so it hides nothing of it
    const rr = e.r + 12;
    c.strokeStyle = rgba(INK, 0.5);
    c.lineWidth = 5;
    c.beginPath();
    c.arc(e.x, e.y, rr, 0, 6.28);
    c.stroke();
    c.strokeStyle = GOLD;
    c.lineWidth = 2.6;
    c.beginPath();
    c.arc(e.x, e.y, rr, 0, 6.28);
    for (let i = 0; i < 12; i++) {
      const a = time * 0.6 + (i / 12) * 6.283;
      c.moveTo(e.x + Math.cos(a) * (rr + 2), e.y + Math.sin(a) * (rr + 2));
      c.lineTo(e.x + Math.cos(a) * (rr + 8), e.y + Math.sin(a) * (rr + 8));
    }
    c.stroke();
  }
  if (e.chillT > 0 && e.chill > 0) {
    c.fillStyle = 'rgba(166,227,255,0.3)';
    c.strokeStyle = 'rgba(214,244,255,0.9)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.ellipse(e.x, e.y + e.r * 0.2, e.r * 1.35, e.r * 1.0, 0, 0, 6.28);
    c.fill();
    c.stroke();
  }
  if (e.state === 'emerging') {
    const k = 1 - e.stateT / CFG.burrower.emergeTime;
    c.fillStyle = '#17110f';
    c.beginPath();
    c.ellipse(e.x, e.y, e.r * 1.15, e.r * 0.85, 0, 0, 6.28);
    c.fill();
    // the warning: a hard red ring closing on the hole, with ticks
    const rr = e.r + 4 + 26 * (1 - k);
    c.strokeStyle = rgba(INK, 0.5);
    c.lineWidth = 6;
    c.beginPath();
    c.arc(e.x, e.y, rr, 0, 6.28);
    c.stroke();
    c.strokeStyle = '#ff3b4e';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(e.x, e.y, rr, 0, 6.28);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283 + 0.39;
      c.moveTo(e.x + Math.cos(a) * (rr + 3), e.y + Math.sin(a) * (rr + 3));
      c.lineTo(e.x + Math.cos(a) * (rr + 9), e.y + Math.sin(a) * (rr + 9));
    }
    c.stroke();
  }
}

/** A burrower underground: its trail of turned earth, then the moving mound. */
export function drawMound(c: Ctx, e: Enemy, trail: number[], time: number): void {
  const n = trail.length / 2;
  // a furrow: dark turned earth with a lighter crumb line, fading with age
  for (let i = 0; i < n; i++) {
    const k = (i + 1) / (n + 1);
    const x = trail[i * 2];
    const y = trail[i * 2 + 1];
    c.fillStyle = rgba(shade(EARTH, 0.45), 0.2 + 0.55 * k);
    c.beginPath();
    c.ellipse(x, y, e.r * (0.35 + 0.4 * k), e.r * (0.26 + 0.3 * k), 0, 0, 6.28);
    c.fill();
  }
  for (let i = 0; i < n; i++) {
    const k = (i + 1) / (n + 1);
    c.fillStyle = rgba(shade(EARTH, 1.25), 0.2 + 0.6 * k);
    c.beginPath();
    c.ellipse(trail[i * 2] + ((i * 7) % 5) - 2, trail[i * 2 + 1] - e.r * 0.1, e.r * (0.14 + 0.2 * k), e.r * (0.09 + 0.12 * k), i, 0, 6.28);
    c.fill();
  }
  const wob = 1 + 0.08 * Math.sin(time * 17 + e.wob);
  blit(c, mound(e.r), e.x + Math.sin(time * 31 + e.wob) * 0.8, e.y, 0, wob, 2 - wob);
}

// ------------------------------------------------------------ the creature

function star4(c: Ctx, x: number, y: number, s: number): void {
  c.moveTo(x, y - s);
  c.quadraticCurveTo(x, y, x + s, y);
  c.quadraticCurveTo(x, y, x, y + s);
  c.quadraticCurveTo(x, y, x - s, y);
  c.quadraticCurveTo(x, y, x, y - s);
}

export function drawEnemy(c: Ctx, e: Enemy, g: Game, time: number): void {
  if (e.state === 'under') return;
  const face = facing(e, g);
  const state = look(e, g);
  const s = creatureSprite(e.kind, e.r, state, e.elite?.id ?? '', e.boss?.name ?? '');
  let x = e.x;
  let y = e.y;
  let rot = face;
  let sx = 1;
  let sy = 1;
  const still = e.stunT > 0 || e.state === 'emerging';
  if (!still) rot += Math.sin(time * (e.kind === 'swarm' ? 19 : 9) + e.wob * 7) * (e.kind === 'swarm' ? 0.16 : e.kind === 'boss' ? 0.02 : 0.06);

  if (e.state === 'emerging') {
    // rising out of the hole
    const k = 1 - e.stateT / CFG.burrower.emergeTime;
    sx = sy = 0.35 + 0.65 * k;
    x += Math.sin(time * 50) * 1.2;
  } else if (e.kind === 'burrower' && e.target) {
    // eating: lunging at the node
    const bite = Math.max(0, Math.sin(time * 15 + e.wob));
    x += Math.cos(face) * bite * 5;
    y += Math.sin(face) * bite * 5;
  } else if (e.tele > 0) {
    // winding up: pulled back and shaking
    const pull = (e.boss ? 7 : 5) * (1 - e.tele / (e.boss ? 0.8 : 0.7));
    x += -e.dx * pull + Math.sin(time * 70 + e.id) * 1.3;
    y += -e.dy * pull + Math.cos(time * 64 + e.id) * 1.3;
  } else if (e.dash > 0) {
    // rushing: stretched, with afterimages
    sx = 1.22;
    sy = 0.84;
    const gh = ghost(s);
    for (let i = 2; i >= 1; i--) {
      c.globalAlpha = 0.34 / i;
      blit(c, gh, x - e.dx * i * e.r * 1.1, y - e.dy * i * e.r * 1.1, rot, sx, sy);
    }
    c.globalAlpha = 1;
  } else if (e.kind === 'bomber') {
    const near = Math.max(0, Math.min(1, 1 - (Math.hypot(g.p.x - e.x, g.p.y - e.y) - 40) / 300));
    const pulse = 0.5 + 0.5 * Math.sin(time * (9 + 14 * near) + e.id);
    sx = sy = 1 + (0.05 + 0.1 * near) * pulse;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = (0.25 + 0.5 * near) * pulse;
    blit(c, glow('#ff5c9a'), x, y, 0, (e.r * 2.6) / 64);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  } else if (e.boss && !e.shield) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.3 + 0.2 * Math.sin(time * 6);
    blit(c, glow(e.boss.name === 'The Kiln' ? '#ff9a3c' : '#ff5c9a'), x, y, 0, (e.r * 2.7) / 64);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }

  blit(c, s, x, y, rot, sx, sy);
  if (e.flash > 0) {
    // the hit flash: brief, and weaker on the big ones, which are hit many times a second and must keep their look
    c.globalAlpha = Math.min(1, e.flash / 0.1) * (e.boss ? 0.32 : e.r > 18 ? 0.5 : 0.7);
    blit(c, white(s), x, y, rot, sx, sy);
    c.globalAlpha = 1;
  }

  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  if (e.kind === 'spitter' && state === 'b') {
    // about to fire: a ring closing on the nozzle
    const k = Math.max(0, e.t1 / 0.55);
    const nx = x + ca * e.r * 1.3;
    const ny = y + sa * e.r * 1.3;
    c.strokeStyle = HOT;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(nx, ny, 3 + 11 * k, 0, 6.28);
    c.stroke();
    c.fillStyle = '#fff1f6';
    c.beginPath();
    c.arc(nx, ny, 2.2, 0, 6.28);
    c.fill();
  }
  if (e.boss && e.shield) {
    // armoured: a glint that runs round the plates
    const a = time * 2.4;
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(x, y, e.r * 1.02, a, a + 0.7);
    c.stroke();
    c.beginPath();
    c.arc(x, y, e.r * 1.02, a + Math.PI, a + Math.PI + 0.7);
    c.stroke();
  }
  if (e.boss && !e.shield && e.boss.name === 'The Kiln') {
    for (const [lx, ly] of [[-0.62, 0], [-0.46, -0.48], [-0.46, 0.48]]) {
      blit(c, flame(Math.floor(time * 9 + lx * 7 + ly * 3)), x + ca * lx * e.r - sa * ly * e.r, y + sa * lx * e.r + ca * ly * e.r - 4, 0, e.r / 34);
    }
  }

  // ---- marks that sit on top and leave the creature's own colours alone
  if (e.hot && !e.boss) {
    // arrived because of heat: an ember on its back
    const ex = x - ca * e.r * 0.55;
    const ey = y - sa * e.r * 0.55;
    const er = Math.max(2.2, e.r * 0.2);
    c.fillStyle = INK;
    c.beginPath();
    c.arc(ex, ey, er + 1, 0, 6.28);
    c.fill();
    c.fillStyle = '#ff8a1e';
    c.beginPath();
    c.arc(ex, ey, er, 0, 6.28);
    c.fill();
    c.fillStyle = '#fff3a0';
    c.beginPath();
    c.arc(ex, ey, er * (0.4 + 0.15 * Math.sin(time * 14 + e.id)), 0, 6.28);
    c.fill();
  }
  if (e.chillT > 0 && e.chill > 0) {
    // chilled: ice shards at its feet
    c.fillStyle = '#e4f6ff';
    c.strokeStyle = '#6fb6d8';
    c.lineWidth = 0.8;
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = 0.6 + i * 2.1;
      const ix = e.x + Math.cos(a) * e.r * 0.95;
      const iy = e.y + Math.sin(a) * e.r * 0.75 + e.r * 0.2;
      const h = Math.max(5, e.r * 0.5);
      c.moveTo(ix, iy - h);
      c.lineTo(ix + h * 0.36, iy);
      c.lineTo(ix, iy + h * 0.3);
      c.lineTo(ix - h * 0.36, iy);
      c.closePath();
    }
    c.fill();
    c.stroke();
  }
  if (e.burnT > 0) {
    blit(c, flame(Math.floor(time * 9 + e.id)), e.x, e.y - e.r * 0.3, 0, Math.max(0.42, e.r / 30));
  }
  if (e.stunT > 0) {
    // stunned: stars circling its head
    const cy = e.y - e.r - 7;
    c.fillStyle = '#fff3a0';
    c.strokeStyle = rgba(INK, 0.7);
    c.lineWidth = 1.2;
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = time * 6 + i * 2.094;
      star4(c, e.x + Math.cos(a) * Math.max(8, e.r * 0.7), cy + Math.sin(a) * 3, 4.2);
    }
    c.stroke();
    c.fill();
  }
  if (e.elite) {
    // a small crown above: the name mark
    const cy = e.y - e.r - (e.stunT > 0 ? 22 : 12);
    const p = poly([[e.x - 8, cy + 4], [e.x - 9, cy - 4], [e.x - 4, cy], [e.x, cy - 6], [e.x + 4, cy], [e.x + 9, cy - 4], [e.x + 8, cy + 4]]);
    inked(c, p, GOLD, 1.2);
  }
  if ((e.elite || e.kind === 'brute') && e.hp < e.maxHp) {
    const w = e.r * 2;
    const by = e.y + e.r + (e.elite ? 24 : 8);
    c.fillStyle = 'rgba(0,0,0,0.65)';
    c.fillRect(e.x - w / 2 - 1, by - 1, w + 2, 6);
    c.fillStyle = e.elite ? GOLD : '#ff5a4d';
    c.fillRect(e.x - w / 2, by, w * Math.max(0, e.hp / e.maxHp), 4);
  }
}
