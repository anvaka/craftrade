// Every icon in the game, drawn here as inline SVG strings. No images, no ids, no external references.
//
// Two registers share one outline colour and one light direction (top-left):
//  - item icons (materials, weapons, tools, bags, brews, shop items, ...): flat fills in 2 to 4 tones, outline SW;
//  - glyphs (modifiers, families, interface): one bold shape, one fill, the heavier outline GW, readable at 20 px.
// Every function returns `<svg viewBox="0 0 48 48">` with no width or height: size it from CSS.

import { CFG, MATS, WEAPONS } from '../data';
import type { BrewForm, EnemyKind, Fam, Ground, ModKey, NodeKind, Schematic, StationId } from '../data';

// ------------------------------------------------------------------ helpers
const OL = '#120e0b'; // outline: near black, slightly warm
const SW = 1.8; // item outline, a little over 3% of the icon
const GW = 2.8; // glyph outline

type RGB = [number, number, number];
const rgb = (h: string): RGB => {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.replace(/./g, '$&$&');
  const v = parseInt(s, 16);
  return Number.isNaN(v) ? [128, 128, 128] : [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const hex = (c: number[]): string => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** Blend two colours: 0 gives a, 1 gives b. */
export const mix = (a: string, b: string, t: number): string => {
  const x = rgb(a), y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
};
/** Multiply a colour: 1 leaves it, 0.7 is the usual shadow plane. */
export const shade = (c: string, k = 0.7): string => mix(c, '#000000', 1 - k);
/** Mix a colour toward white. */
export const lighten = (c: string, t = 0.25): string => mix(c, '#ffffff', t);

const f = (v: number): number => +v.toFixed(1);
const wrap = (body: string): string =>
  `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

/** Filled and outlined path. */
const P = (d: string, fill: string, w = SW, extra = ''): string => `<path d="${d}" fill="${fill}" stroke="${OL}" stroke-width="${f(w)}"${extra}/>`;
/** Flat plane without an outline: shading inside a shape. */
const F = (d: string, fill: string): string => `<path d="${d}" fill="${fill}"/>`;
/** Stroke only. */
const O = (d: string, w = SW, stroke = OL): string => `<path d="${d}" stroke="${stroke}" stroke-width="${f(w)}"/>`;
/** Body: fill, then shading planes, then the outline on top so it trims the planes. */
const B = (d: string, fill: string, planes = '', w = SW): string => F(d, fill) + planes + O(d, w);
/** A coloured line with an outline around it. */
const L = (d: string, color: string, w = 2.6, ow = SW * 0.7): string => O(d, w + ow * 2) + O(d, w, color);
const C = (cx: number, cy: number, r: number, fill: string, w = SW): string =>
  `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"${w ? ` stroke="${OL}" stroke-width="${f(w)}"` : ''}/>`;
const E = (cx: number, cy: number, rx: number, ry: number, fill: string, w = SW): string =>
  `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${w ? ` stroke="${OL}" stroke-width="${f(w)}"` : ''}/>`;
const at = (x: number, y: number, body: string, deg = 0, s = 1): string =>
  `<g transform="translate(${f(x)} ${f(y)})${deg ? ` rotate(${f(deg)})` : ''}${s !== 1 ? ` scale(${s})` : ''}">${body}</g>`;
/** Rotate about the middle of the icon. */
const rot = (deg: number, body: string): string => `<g transform="rotate(${deg} 24 24)">${body}</g>`;

const poly = (pts: number[][]): string => 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const polar = (cx: number, cy: number, r: number, deg: number): number[] => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
const star = (cx: number, cy: number, ro: number, ri: number, n: number, deg = -90): string =>
  poly(Array.from({ length: n * 2 }, (_, i) => polar(cx, cy, i % 2 ? ri : ro, deg + (i * 180) / n)));
const glint = (cx: number, cy: number, r: number, fill = '#fff6c8'): string => P(star(cx, cy, r, r * 0.3, 4), fill, 1.1);
const circ = (cx: number, cy: number, r: number): string => `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const ell = (cx: number, cy: number, rx: number, ry: number): string => `M${f(cx - rx)} ${f(cy)}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
/** A circle with a scalloped (fluffy or stamped) edge. */
const scallop = (cx: number, cy: number, r: number, n: number): string => {
  const rr = f(r * Math.sin(Math.PI / n) * 1.05);
  const pts = Array.from({ length: n }, (_, i) => polar(cx, cy, r, (i * 360) / n));
  return `M${f(pts[0][0])} ${f(pts[0][1])}` + pts.map((_, i) => { const q = pts[(i + 1) % n]; return `A${rr} ${rr} 0 0 1 ${f(q[0])} ${f(q[1])}`; }).join('') + 'Z';
};
const gear = (cx: number, cy: number, ro: number, ri: number, n: number): string => {
  const step = 360 / n, pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = i * step;
    pts.push(polar(cx, cy, ri, a - step * 0.3), polar(cx, cy, ro, a - step * 0.17), polar(cx, cy, ro, a + step * 0.17), polar(cx, cy, ri, a + step * 0.3));
  }
  return poly(pts);
};
const EVENODD = ' fill-rule="evenodd"';

// shared palette
const STEEL = '#aab4bd', IRON = '#5c646d', WOOD = '#8a6238', LEATHER = '#9a6a42', GOLD = '#e8b84a', BONE = '#efe6cf', RED = '#d9534a',
  PARCH = '#e8d7a8', GLASS = '#d7e8ee', CORK = '#b08a5a', UI = '#e4e8ee';

const HEART = 'M24 43C11 34 5 27 5 18 5 11 10 6 16 6c4 0 6 2 8 6 2-4 4-6 8-6 6 0 11 5 11 12 0 9-6 16-19 25Z';
const DROP = 'M0-9c3 4.5 5 7 5 10a5 5 0 0 1-10 0c0-3 2-5.5 5-10Z';
const FLAME = 'M0-16c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3 0-6 1-8Z'; // base at y=1, 12 wide
const FLAME_IN = 'M0-9.5c2 2 3.5 3.5 3.5 5.5a3.5 3.5 0 0 1-7 0c0-2 1.5-3.5 3.5-5.5Z';
const FLAME3 = 'M0-19c1 5 5 7 5 11 2-1 3-3 3-6 3 3 4 6 4 9 0 5-5 9-12 9s-12-4-12-9c0-3 1-6 4-9 0 3 1 5 3 6 0-4 4-6 5-11Z'; // three tongues, 24 wide
const FLAME3_IN = 'M0-8c3 3 5 4 5 7 0 3-2 4-5 4s-5-1-5-4c0-3 2-4 5-7Z';
const flame = (x: number, y: number, s = 1, three = false, w = SW, col = '#f6862e'): string =>
  at(x, y, P(three ? FLAME3 : FLAME, col, w / s) + F(three ? FLAME3_IN : FLAME_IN, '#ffd95a'), 0, s);
const drop = (x: number, y: number, s: number, fill: string, w = 1.2): string => at(x, y, P(DROP, fill, w / s), 0, s);
/** A bone from one point to another. */
const bone = (x1: number, y1: number, x2: number, y2: number, col: string, w = 4, ow = SW): string => {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), px = (-dy / l) * w * 0.55, py = (dx / l) * w * 0.55, r = w * 0.62;
  const d = `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
  const ends = [[x1 + px, y1 + py], [x1 - px, y1 - py], [x2 + px, y2 + py], [x2 - px, y2 - py]];
  return O(d, w + ow * 1.4) + ends.map(([x, y]) => C(x, y, r, col, ow)).join('') + O(d, w, col) + ends.map(([x, y]) => C(x, y, r - ow * 0.5, col, 0)).join('');
};

const UNKNOWN = wrap(
  `<rect x="6" y="6" width="36" height="36" rx="7" fill="#3a4049" stroke="${OL}" stroke-width="${GW}"/>` +
  L('M18 19c0-8 12-8 12-1 0 5-6 5-6 10', '#aeb6c2', 3.6, 1) + C(24, 35, 2.4, '#aeb6c2', 0),
);
const cache = new Map<string, string>();
const memo = (key: string, make: () => string | undefined): string => {
  let s = cache.get(key);
  if (s === undefined) {
    let body: string | undefined;
    try { body = make(); } catch { body = undefined; }
    s = body === undefined ? UNKNOWN : wrap(body);
    cache.set(key, s);
  }
  return s;
};
/** Own-property lookup, so ids like "constructor" fall through to the unknown icon. */
const own = <T>(table: Record<string, T>, key: string): T | undefined => (Object.hasOwn(table, key) ? table[key] : undefined);
/** The neutral icon used for any id this file does not know. */
export const unknownIcon = (): string => UNKNOWN;

// ---------------------------------------------------------------- materials
const BEAN = 'M-3.6 0C-3.6-2.6 1-2.5 3.6-.5 2 1.6-1.2 2-3.6 0Z';
const SLIVER = 'M-4.4 .7L-.6-2 4.4-.7 .6 2Z';

function oreChunk(color: string, tier: number): string {
  const m = mix('#6f6661', color, 0.2), ml = lighten(m, 0.2), md = shade(m, 0.64);
  const fc = [lighten(color, 0.25), color, shade(color, 0.68)];
  const flecks = (shape: string, pts: number[][], deg: number): string =>
    pts.map(([x, y, z, s]) => at(x, y, F(shape, fc[z]), deg + ((x * 7 + y * 3) % 5) * 4 - 8, s ?? 1)).join('');
  if (tier <= 1) {
    // one lump, bean flecks
    return B('M8 31L11 18 21 9 34 11 41 22 38 36 24 41 12 39Z', m,
      F('M11 18L21 9 34 11 26 19 15 23Z', ml) + F('M8 31L19 33 31 30 41 22 38 36 24 41 12 39Z', md) +
      flecks(BEAN, [[19, 15, 0], [28, 14, 0], [16, 27, 1], [26, 25, 1], [35, 22, 1], [15, 36, 2], [26, 36, 2], [34, 31, 2]], -35));
  }
  if (tier === 2) {
    // a sharper, faceted lump and a second small one, sliver flecks
    const line = shade(m, 0.45);
    return B('M6 34L9 22 17 14 26 5 35 14 39 26 34 37 18 40Z', m,
      F('M9 22L17 14 26 5 28 16 18 24Z', ml) + F('M6 34L17 33 30 30 39 26 34 37 18 40Z', md) +
      O('M26 5L28 16 30 30M28 16L18 24 17 33', 1, line) +
      flecks(SLIVER, [[15, 20, 0], [23, 13, 0], [23, 27, 1], [33, 21, 1], [12, 29, 1], [24, 36, 2], [32, 33, 2]], -52)) +
      B('M29 42L31 35 37 31 43 35 43 41 36 44Z', m, F('M31 35L37 31 39 36 33 38Z', ml) + flecks(SLIVER, [[37, 39, 1, 0.9]], -52));
  }
  // a broad dark lump with fat angular nuggets and a glint
  const d3 = mix('#544c47', color, 0.14), NUG = 'M-4.5-1L-1-4 4-2.5 4.5 1.5 .5 4-4 2.5Z';
  const nug = (x: number, y: number, s: number, z: number, deg: number): string =>
    at(x, y, P(NUG, fc[z === 0 ? 1 : z], 1.1 / s) + (z < 2 ? F('M-4.5-1L-1-4 4-2.5 .5-.5Z', fc[0]) : ''), deg, s);
  return B('M4 30L9 18 19 10 31 8 41 14 45 27 38 38 25 43 11 40Z', d3,
    F('M9 18L19 10 31 8 34 17 22 20 13 27Z', lighten(d3, 0.2)) + F('M4 30L16 34 30 32 45 27 38 38 25 43 11 40Z', shade(d3, 0.62)) +
    nug(20, 17, 1.05, 0, 0) + nug(31, 14, 0.7, 0, 40) + nug(27, 27, 1.3, 1, 20) + nug(38, 23, 0.75, 1, -30) + nug(13, 29, 0.7, 1, 60) +
    nug(19, 37, 0.7, 2, 10) + nug(33, 36, 0.85, 2, -20)) + glint(41, 8, 5.5);
}

/** A log lying along +x from its cut end at the origin. */
function logShape(len: number, r: number, bark: string, end: string, core: string): string {
  const rx = f(r * 0.5), d = `M0 ${-r}H${len}a${rx} ${r} 0 0 1 0 ${2 * r}H0Z`;
  return F(d, bark) + F(`M0 ${-r}H${len}v${f(r * 0.5)}H0Z`, lighten(bark, 0.16)) + F(`M0 ${f(r * 0.4)}H${len + rx * 0.7}V${r}H0Z`, shade(bark, 0.7)) +
    O(`M${f(len * 0.35)} ${f(-r * 0.15)}h${f(len * 0.3)}M${f(len * 0.55)} ${f(r * 0.2)}h${f(len * 0.25)}`, 1.1, shade(bark, 0.55)) + O(d) +
    E(0, 0, rx, r, end) + E(0, 0, rx * 0.55, r * 0.55, core, 0) + E(0, 0, rx * 0.2, r * 0.2, shade(core, 0.7), 0);
}
function woodLogs(color: string, tier: number): string {
  const bark = mix(tier >= 3 ? '#5a2c22' : '#5a4426', color, tier >= 3 ? 0.3 : 0.42), end = mix('#dcc898', color, 0.18);
  const core = tier >= 3 ? color : shade(end, 0.82);
  const log = (x: number, y: number, len: number, r: number): string => at(x, y, logShape(len, r, bark, end, core), -22);
  if (tier <= 1) {
    const leaf = lighten(color, 0.1);
    return log(9, 33, 27, 9.5) + P('M22 15c-5-1-9-5-9-11 6 0 10 4 9 11Z', leaf, 1.4) + P('M25 14c0-5 3-9 9-10 1 6-3 10-9 10Z', color, 1.4);
  }
  if (tier === 2) return log(7, 27, 27, 7.5) + log(12, 38, 27, 7.5);
  return log(6, 31, 25, 6.8) + log(14, 40, 25, 6.8) + log(12, 21, 25, 6.8);
}

function herbBundle(color: string, tier: number): string {
  if (tier <= 1) {
    // cattail reeds, tied
    const head = '#7a5230', leaf = shade(color, 0.8);
    return P('M19 41C11 35 6 27 5 17c6 5 10 13 15 20Z', leaf, 1.4) + P('M29 41c8-6 13-14 14-24-6 5-10 13-15 20Z', leaf, 1.4) +
      L('M24 44V3', color, 2.2) + L('M20 44L13 8', color, 2.2) + L('M28 44L35 8', color, 2.2) +
      L('M24 8v11', head, 5) + L('M16 24L14 14', head, 5) + L('M32 24L34 14', head, 5) +
      P('M16 33h16v5H16Z', '#e2cf9d');
  }
  if (tier === 2) {
    // a sprig with three silk puffs
    const stem = '#86a86a', puff = (x: number, y: number, r: number): string => P(scallop(x, y, r, 9), color, 1.5) + C(x - r * 0.2, y - r * 0.2, r * 0.45, lighten(color, 0.6), 0);
    return L('M24 45C24 36 23 28 24 18', stem, 2.4) + L('M24 32C19 30 15 26 13 21', stem, 2) + L('M24 28C29 26 33 22 35 18', stem, 2) +
      P('M23 40C16 41 10 38 7 33c6-1 12 1 16 7Z', '#9fbf7a', 1.4) + P('M25 38c7 1 13-2 16-7-6-1-12 1-16 7Z', shade('#9fbf7a', 0.85), 1.4) +
      puff(12, 17, 7) + puff(36, 15, 6.5) + puff(24, 11, 8);
  }
  // one large bloom
  const stem = '#5f8a6a', leaf = '#3f7a66', petal = 'M0 0C-6-4-6-11 0-15 6-11 6-4 0 0Z';
  return L('M24 45C25 38 22 32 24 24', stem, 2.4) + P('M23 40c-6 2-12 0-15-6 6-2 12 0 15 6Z', leaf, 1.4) + P('M25 36c5 0 10-2 13-8-6-1-11 2-13 8Z', shade(leaf, 0.85), 1.4) +
    [144, 216, 72, 288, 0].map((a, i) => at(24, 17, P(petal, i < 2 ? shade(color, 0.82) : i < 4 ? color : lighten(color, 0.25), 1.5), a)).join('') +
    C(24, 17, 4.2, '#fff3b8', 1.4) + C(7, 9, 1.7, lighten(color, 0.4), 0) + C(41, 26, 1.7, lighten(color, 0.4), 0) + C(40, 6, 1.2, lighten(color, 0.4), 0);
}

const HIDE = 'M21 6h6l1 5 9-3 4 6-6 5 1 9 6 6-4 6-8-4-3 6h-6l-3-6-8 4-4-6 6-6 1-9-6-5 4-6 9 3Z';
const MAT_DRAW: Record<string, (c: string) => string> = {
  hide: (c) => B(HIDE, c, F('M19 14h10l3 6 0 9-3 6H19l-3-6 0-9Z', lighten(c, 0.22)) + F('M36 28l6 6-4 6-8-4-3 6h-3l2-8 6 1Z', shade(c, 0.78))) +
    O('M24 15v20', 1.1, shade(c, 0.7)),
  sinew: (c) => {
    const a = 'M24 24C18 14 5 12 5 22s13 10 19 2Z', b = 'M24 24c6 10 19 12 19 2s-13-10-19-2Z', fib = shade(c, 0.72);
    return rot(-28, L(a, c, 5.4) + L(b, c, 5.4) + O(a, 1, fib) + O(b, 1, fib) + P('M20.5 18.5h7v11h-7Z', '#b5564a') +
      O('M20.5 22h7M20.5 26h7', 1, shade('#b5564a', 0.6)));
  },
  bonedust: (c) => bone(17, 31, 33, 9, BONE, 4.6) +
    B('M4 41c2-8 9-14 20-14s18 6 20 14c-6 3-34 3-40 0Z', c, F('M8 37c3-5 9-8 15-8-5 2-9 5-11 9Z', lighten(c, 0.5)) + F('M44 41c-6 3-34 3-40 0 12 1 28 0 38-5Z', shade(c, 0.78)) +
      [[17, 36], [25, 33], [31, 37], [22, 39], [36, 38], [12, 39]].map(([x, y]) => C(x, y, 0.9, shade(c, 0.6), 0)).join('')),
  ash: (c) => L('M25 23c-5-4 3-7 0-11s2-6 1-9', '#c9c9c9', 2, 1) +
    B('M4 41c1-6 5-10 10-11 2-5 9-7 14-4 8 0 13 7 16 15-6 3-34 3-40 0Z', c, F('M9 36c2-3 4-5 7-5 1-3 5-5 9-4-5 1-8 3-9 6-3 0-5 1-7 3Z', lighten(c, 0.35)) +
      F('M44 41c-6 3-34 3-40 0 12 1 28 0 37-6Z', shade(c, 0.66))) +
    C(19, 35, 2.1, '#ff8a3c', 0) + C(28, 32, 1.7, '#ffc24a', 0) + C(34, 37, 1.7, '#ff8a3c', 0),
  shard: (c) => {
    const lt = lighten(c, 0.6), dk = shade(c, 0.74);
    return B('M12 17l6 7 1 18h-9l-3-15Z', c, F('M12 17l-5 10 3 15h3Z', lt)) + B('M37 14l5 10-3 18h-9l1-17Z', dk, F('M37 14l-6 11-1 17h4Z', c)) +
      B('M24 3l7 13-3 26h-8l-3-26Z', c, F('M24 3l-7 13 3 26h4Z', lt) + F('M28 16l3 0-3 26h-2Z', dk));
  },
  // ---- parts of named elites and bosses
  maw: (c) => {
    const iv = '#f3e8cc';
    return B('M13 12c0 8 3 13 7 18 3 4 5 9 6 15 5-7 8-14 9-20 1-5 1-9 0-13Z', iv, F('M30 13c1 9-1 19-4 32 5-7 8-14 9-20 1-5 1-9 0-12Z', shade(iv, 0.78)) +
      O('M19 20l2 5-2 4', 1.1, shade(iv, 0.6)) + F('M22 30l3 1-1 3-2-1Z', '#8d939a') + F('M26 22l3-1 1 3-3 1Z', '#8d939a')) +
      P('M11 6c4-3 8-2 12 0 4-2 9-3 13 0 1 4 0 7-1 9-8 2-16 2-24 0-1-3-1-6 0-9Z', c) + F('M12 7c3-2 6-2 9-1-3 1-6 3-8 6-1-2-1-3-1-5Z', lighten(c, 0.3)) +
      P('M12 14c8 2 16 2 24 0v4c-8 2-16 2-24 0Z', GOLD, 1.4);
  },
  plate: (c) => {
    const th = lighten(c, 0.35), ln = shade(c, 0.5);
    return P('M9 12L2 6l4 11Z', th, 1.4) + P('M7 23l-6-3 6 8Z', th, 1.4) + P('M39 12l7-6-4 11Z', th, 1.4) + P('M41 23l6-3-6 8Z', th, 1.4) + P('M20 8l4-7 4 7Z', th, 1.4) +
      B('M24 5l15 6 2 14c-1 9-8 15-17 20-9-5-16-11-17-20l2-14Z', c, F('M24 5L9 11 7 25c1 9 8 15 17 20Z', lighten(c, 0.18)) + F('M41 25c-1 9-8 15-17 20 6-6 10-12 11-21Z', shade(c, 0.7)) +
        O('M11 18l13 5 13-5M10 28l14 6 14-6M24 6v38', 1.3, ln)) +
      C(24, 14, 2.3, GOLD, 1.2) + C(24, 28, 2.3, GOLD, 1.2);
  },
  bile: (c) => P('M19 16c0-4-2-6-4-10h18c-2 4-4 6-4 10Z', shade(c, 0.8)) + P('M16.5 12.5h15v4h-15Z', '#7a5a8a', 1.4) +
    B('M24 15c9 0 16 6 16 14s-7 15-16 15S8 37 8 29s7-14 16-14Z', c, F('M11 28c1-6 6-10 12-11-4 3-7 7-8 13Z', lighten(c, 0.4)) +
      F('M40 29c0 8-7 15-16 15-5 0-9-2-12-5 4 2 8 2 12 2 9 0 14-6 16-12Z', shade(c, 0.72))) +
    C(29, 26, 3, lighten(c, 0.35), 1.2) + C(20, 35, 2.4, lighten(c, 0.35), 1.2) + C(31, 36, 1.8, lighten(c, 0.35), 1.2) + drop(41, 40, 0.75, lighten(c, 0.3)),
  pelt: (c) => B('M16 4l4 6h8l4-6 2 9 8 2-5 5 5 5-6 2 4 7-7 1-1 6-4-3-4 8-4-8-4 3-1-6-7-1 4-7-6-2 5-5-5-5 8-2Z', c,
    F('M16 4l4 6h4v36l-4-8-4 3-1-6-7-1 4-7-6-2 5-5-5-5 8-2Z', lighten(c, 0.14)) +
    F('M18 19l6 4 6-4v3.5l-6 4-6-4ZM19 27l5 3.5 5-3.5v3.5l-5 3.5-5-3.5ZM21 35l3 2 3-2v3l-3 2-3-2Z', shade(c, 0.55)) +
    F('M19 13.5l3.5 1-3.5 1.5ZM29 13.5l-3.5 1 3.5 1.5Z', OL)),
  seal: (c) => P('M18 27l-5 18 6-4 4 4 4-16Z', RED) + P('M30 27l5 18-6-4-4 4-4-16Z', shade(RED, 0.78)) +
    P(scallop(24, 18, 15, 12), c) + C(24, 18, 10.5, lighten(c, 0.35), 1.3) + F('M18 12.5h12v5h-4v8.5h-4v-8.5h-4Z', shade(c, 0.55)),
  heart: (c) => P('M17 14l-3-9 5-2 3 9Z', shade(c, 0.72)) + P('M26 12l2-9 5 1-1 9Z', shade(c, 0.72)) +
    B('M24 44C12 37 6 29 6 21c0-6 5-10 10-9 4 0 6 3 8 6 1-4 4-7 9-7 6 0 10 5 9 12-1 8-7 15-18 21Z', c,
      F('M9 22c0-5 3-8 7-8 2 0 4 1 5 3-4 0-8 3-9 9-2-1-3-2-3-4Z', lighten(c, 0.45)) + F('M42 23c-1 8-7 15-18 21 7-6 12-13 13-21Z', shade(c, 0.7)) +
      O('M24 18c-2 7-1 14 2 20M25 26c4 0 7-2 9-6M24 30c-4 0-7-1-9-4', 1.3, shade(c, 0.55))) +
    C(16, 33, 1.6, lighten(c, 0.55), 0) + C(33, 29, 1.6, lighten(c, 0.55), 0),
  core: (c) => {
    const fr = '#4a4038';
    return B('M24 3l18 10.5v21L24 45 6 34.5v-21Z', fr, F('M24 3L6 13.5v21l5-3V16.5l13-7.5Z', lighten(fr, 0.22)) + F('M42 34.5L24 45 6 34.5l5-3 13 7.5 13-7.5Z', shade(fr, 0.6))) +
      C(24, 24, 12.5, c, 1.5) + C(24, 24, 8, '#ffb347', 0) + C(24, 24, 4, '#fff3b0', 0) +
      L('M24 4v8M7 34l7-4M41 34l-7-4', fr, 2.6, 1.1) +
      [[24, 41], [9.5, 15.5], [38.5, 15.5]].map(([x, y]) => C(x, y, 1.6, GOLD, 0)).join('');
  },
};

/** A material tile icon. Ores, woods and herbs draw by tier; creature drops and parts each have their own shape. */
export function matIcon(id: string): string {
  return memo(`mat:${id}`, () => {
    const m = own(MATS, id);
    if (!m) return undefined;
    if (m.cat === 'ore') return oreChunk(m.color, m.tier);
    if (m.cat === 'wood') return woodLogs(m.color, m.tier);
    if (m.cat === 'herb') return herbBundle(m.color, m.tier);
    return own(MAT_DRAW, id)?.(m.color);
  });
}

// ------------------------------------------------------------------ weapons
// Weapons are drawn upright and turned, so the left side of the upright drawing is the lit side.
const STAFF_TIP: [number, number] = [26.5, 19.7]; // where the head of a staff ends up after rot(30)
function weaponBody(fam: Fam, ev: boolean): string {
  const [tx, ty] = STAFF_TIP;
  switch (fam) {
    case 'blade':
      if (!ev) {
        return rot(45, B('M24-3l4.5 7v27h-9V4Z', '#aeb6c2', F('M24-3v34h-4.5V4Z', '#f0f3f6')) + O('M24 7v21', 1, '#7c8591') +
          P('M14 31h20v4.5H14Z', '#b9925a') + P('M21.5 35.5h5v10h-5Z', '#6b4a34') + O('M21.5 39h5M21.5 42.5h5', 1, shade('#6b4a34', 0.55)) + C(24, 48, 3.2, '#b9925a'));
      }
      return rot(45, B('M24-4l6 8v8l-2.5 2.5 2.5 2.5v13H18V17l2.5-2.5L18 12V4Z', '#86c8ea', F('M24-4v34h-6V17l2.5-2.5L18 12V4Z', '#f1fbff')) + O('M24 5v24', 1.2, '#3f9fd0') +
        P('M11 27c4 3 8 4 13 3 5 1 9 0 13-3 0 6-5 9-13 9s-13-3-13-9Z', GOLD) + C(24, 32.5, 2.4, '#4fd0ff', 1.2) +
        P('M21.5 36h5v9h-5Z', '#3f4f7a') + C(24, 48, 3.4, GOLD)) +
        P('M13 3l-8 10h5l-3 8 10-11h-5l4-7Z', '#ffe45c', 1.4) + glint(38, 38, 5.5, '#c9f1ff');
    case 'bow': {
      const wood = '#b98a55', str = '#e9e4d8';
      if (!ev) {
        return rot(-45, O('M16 3L10 24 16 45', 2.4) + O('M16 3L10 24 16 45', 1, str) +
          B('M16 2C32 6 38 15 38 24S32 42 16 46c7-6 11-13 11-22S23 8 16 2Z', wood, F('M16 2C32 6 38 15 38 24H27c0-9-4-16-11-22Z', lighten(wood, 0.22))) +
          P('M26.5 20h11.5v8H26.5Z', '#6b4a34', 1.4) +
          L('M10 24H40', '#e6d2a0', 2.4, 1.1) + P('M39 19.5l8 4.5-8 4.5Z', STEEL, 1.4) + P('M5 20.5h7l3 3.5-3 3.5H5l3-3.5Z', RED, 1.4));
      }
      const w2 = '#c9b27a', arrow = (deg: number): string => at(10, 24, L('M0 0H29', '#f1e2b0', 1.8, 1.1) + P('M28-4.5l9 4.5-9 4.5Z', GOLD, 1.4), deg);
      return rot(-45, O('M15 3L10 24 15 45', 2.4) + O('M15 3L10 24 15 45', 1, str) +
        P('M34 12l6-3-2 7Z', GOLD, 1.4) + P('M34 36l6 3-2-7Z', GOLD, 1.4) +
        B('M15 2C31 6 37 15 37 24S31 42 15 46c9-6 14-13 14-22S24 8 15 2Z', w2, F('M15 2C31 6 37 15 37 24h-8c0-9-5-16-14-22Z', lighten(w2, 0.3))) +
        P('M13 0l7 2 1 5-6-1Z', GOLD, 1.4) + P('M13 48l7-2 1-5-6 1Z', GOLD, 1.4) + P('M28.5 19.5h8.5v9h-8.5Z', '#5a3f7a', 1.4) + C(32.8, 24, 2.3, '#4fd0ff', 1.1) +
        arrow(-13) + arrow(13) + P('M4 20.5h7l3 3.5-3 3.5H4l3-3.5Z', '#5fb7ff', 1.4));
    }
    case 'hammer': {
      const hd = '#b08d6a';
      if (!ev) {
        return rot(45, P('M22 17h4v29h-4Z', WOOD) + P('M21 45h6v5h-6Z', shade(hd, 0.8)) +
          B('M14 5h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', hd, F('M12 6h7v12h-7Z', lighten(hd, 0.3)) + F('M30 6h6v12h-6Z', shade(hd, 0.68))) +
          P('M20.5 4h7v16h-7Z', shade(hd, 0.55)));
      }
      const glow = '#ffb347';
      return P('M5 13l3-6 6 1 1 6-6 3Z', '#8a7f76', 1.4) + P('M15 4l4-1 2 4-4 2Z', '#8a7f76', 1.2) + L('M33 45c5-2 9-6 11-11', glow, 1.6, 1) +
        rot(45, P('M22 19h4v27h-4Z', '#5a3a2a') + O('M22 27h4M22 33h4M22 39h4', 1.4, GOLD) + P('M20.5 44.5h7l-3.5 6Z', GOLD, 1.4) +
          P('M20.5 5l3.5-6 3.5 6Z', GOLD, 1.4) +
          B('M11 8l3-3h20l3 3v10l-3 3H14l-3-3Z', '#8f8378', F('M11 8l3-3h5v16h-5l-3-3Z', lighten('#8f8378', 0.3)) + F('M31 5h3l3 3v10l-3 3h-3Z', shade('#8f8378', 0.62)) +
            O('M14 9l3 4-2 3 3 3M34 8l-3 5 2 2-2 4', 1.5, glow)) +
          P('M20.5 4h7v18h-7Z', GOLD, 1.4));
    }
    case 'fire': {
      if (!ev) {
        return rot(30, P('M21.7 19h4.6v30h-4.6Z', WOOD) + O('M21.7 29h4.6M21.7 33h4.6', 1.2, shade(WOOD, 0.5)) + P('M20.8 46.5h6.4v4h-6.4Z', '#b9925a', 1.4)) +
          flame(tx + 0.5, ty + 3, 1.3) +
          rot(30, P('M15.5 14c0 7 3.5 11 8.5 11s8.5-4 8.5-11l-3.5 1c0 4-2 6.5-5 6.5s-5-2.5-5-6.5Z', '#b9925a', 1.5));
      }
      return rot(30, P('M21.7 20h4.6v29h-4.6Z', '#5a3a2a') + O('M21.7 30h4.6M21.7 35h4.6M21.7 40h4.6', 1.6, GOLD) + P('M20.5 46.5h7l-3.5 5Z', GOLD, 1.4)) +
        flame(tx + 1.5, ty + 1, 1, true) +
        rot(30, P('M13 15h22c0 7-4 11-11 11s-11-4-11-11Z', '#4a4038') + P('M12 12.5h24v4H12Z', GOLD, 1.4)) +
        C(8, 14, 1.6, '#ffb347', 0) + C(12, 7, 1.2, '#ffd95a', 0) + C(43, 33, 1.4, '#ffb347', 0);
    }
    case 'frost': {
      const c = '#8fd8ff', lt = lighten(c, 0.65), dk = shade(c, 0.72);
      const crystal = (x: number, y: number, s: number, deg = 0): string =>
        at(x, y, B('M0-17l6 8-6 11-6-11Z', c, F('M0-17l-6 8 6 11Z', lt) + F('M0-17l6 8-6 11 2.5-11Z', dk), SW / s), deg, s);
      if (!ev) {
        return rot(30, P('M21.7 19h4.6v30h-4.6Z', '#7a6a5a') + O('M21.7 29h4.6M21.7 33h4.6', 1.2, '#4a4038') + P('M20.8 46.5h6.4v4h-6.4Z', STEEL, 1.4)) +
          crystal(tx + 0.5, ty + 4, 1.3) +
          rot(30, P('M15.5 14c0 7 3.5 11 8.5 11s8.5-4 8.5-11l-3.5 1c0 4-2 6.5-5 6.5s-5-2.5-5-6.5Z', STEEL, 1.5));
      }
      const flake = (x: number, y: number, r: number): string =>
        O([0, 60, 120].map((a) => { const p = polar(x, y, r, a), q = polar(x, y, r, a + 180); return `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`; }).join(''), 1.3, '#d5efff');
      return rot(30, P('M21.7 20h4.6v29h-4.6Z', '#c9d6e2') + O('M21.7 30h4.6M21.7 35h4.6M21.7 40h4.6', 1.6, '#5fb7ff') + P('M20.5 46.5h7l-3.5 5Z', '#5fb7ff', 1.4)) +
        crystal(tx - 7, ty + 5, 0.85, -34) + crystal(tx + 10, ty + 6, 0.85, 36) + crystal(tx + 1, ty + 3, 1.3) +
        rot(30, P('M14 16c0 6 4 10 10 10s10-4 10-10l-3.5 1c0 4-3 6-6.5 6s-6.5-2-6.5-6Z', '#e4e8ee', 1.5)) +
        flake(7, 11, 3.4) + flake(42, 37, 3);
    }
  }
}
/** A weapon by family; `evolved` draws the grander form (Stormblade, Splitbow, Worldbreaker, Pyre staff, Blizzard staff). */
export function weaponIcon(fam: Fam, evolved = false): string {
  return memo(`wpn:${fam}:${evolved ? 1 : 0}`, () => weaponBody(fam, evolved));
}

// -------------------------------------------------------------------- tools
const TOOL_METAL = ['#a3adb6', '#a3adb6', '#84c8d6', '#f2a93b'];
const TOOL_WOOD = ['#8a6238', '#8a6238', '#6b4a34', '#5a3326'];
function toolBody(node: string, tier: number): string | undefined {
  const t = Math.max(1, Math.min(3, Math.round(tier) || 1)), m = TOOL_METAL[t], w = TOOL_WOOD[t], lt = lighten(m, 0.38), dk = shade(m, 0.7);
  const cap = t >= 3 ? GOLD : shade(w, 0.7);
  switch (node) {
    case 'ore':
      return rot(45, P('M21.5 8h5v39h-5Z', w) + P('M20.5 45h7v4.5h-7Z', cap, 1.4) +
        B('M5 17C10 8 17 4 24 4s14 4 19 13c-6-4-11-6-16-6.5v4h-6v-4C16 11 11 13 5 17Z', m, F('M5 17C10 8 17 4 24 4v6.5h-3C16 11 11 13 5 17Z', lt)) +
        P('M20.5 4.5h7v10.5h-7Z', dk, 1.5)) + (t >= 3 ? glint(40, 9, 5) : '');
    case 'wood':
      return rot(45, P('M21.5 6h5v41h-5Z', w) + P('M20.5 45h7v4.5h-7Z', cap, 1.4) +
        B('M20 11h8l9-4c3 6 3 14 0 20l-9-4h-8Z', m, F('M34.5 8l2.5-1c3 6 3 14 0 20l-2.5-1c2.5-6 2.5-12 0-18Z', lt)) +
        P('M20 10h8v14h-8Z', dk, 1.5)) + (t >= 3 ? glint(41, 36, 5) : '');
    case 'herb':
      return B('M16 34C28 37 41 30 42 18 42 10 37 4 29 3c5 4 7 9 7 14 0 9-8 14-18 12Z', m, F('M29 3c5 4 7 9 7 14 0 9-8 14-18 12l-.5 2c12 2 21-4 21-14 0-6-3-11-9.5-14Z', lt)) +
        L('M19 31L7 44', w, 4.4) + P('M15 30l5 5 3-3-5-5Z', cap, 1.4) + (t >= 3 ? glint(42, 34, 5) : '');
    case 'knife':
      return B('M17 27L32 12l2.5 3 3-4.5 5.5-5c1 10-5 22-21 27Z', m, F('M43 5.5c1 10-5 22-21 27l-2-2.5c12-3 19-12 23-24.5Z', lt)) +
        L('M7 42L16 32', w, 5) + P('M12 27l9 9 3-3-9-9Z', cap, 1.4) + (t >= 3 ? glint(40, 36, 5) : '');
  }
  return undefined;
}
/** Gathering tool: pickaxe, felling axe, sickle or skinning knife. The head metal follows the tier (1 iron, 2 skysteel, 3 sunmetal). */
export function toolIcon(node: NodeKind | 'knife', tier = 1): string {
  return memo(`tool:${node}:${tier}`, () => toolBody(node, tier));
}

// --------------------------------------------------------------------- bags
const BAG_DRAW: Record<string, () => string> = {
  sack: () => {
    const c = '#b89a68';
    return B('M16 15c-6 6-11 13-11 21 0 6 5 8 19 8s19-2 19-8c0-8-5-15-11-21Z', c, F('M16 15c-6 6-11 13-11 21 0 3 1 5 4 6-1-9 3-18 11-27Z', lighten(c, 0.22)) +
      F('M43 36c0 6-5 8-19 8-6 0-10 0-13-1 10 0 22-1 28-12 2 1 4 3 4 5Z', shade(c, 0.72))) +
      P('M17 15c2-3 1-7-1-10 3 2 5 2 8 0 3 2 5 2 8 0-2 3-3 7-1 10Z', shade(c, 0.86)) + P('M14.5 13h19v4h-19Z', '#e2cf9d', 1.4) +
      P('M27 28h9v9h-9Z', shade(c, 0.8), 1.2) + O('M29 31h5M29 34h5', 1, shade(c, 0.5));
  },
  pack: () => {
    const c = '#8a5a3a';
    return O('M18 9c0-7 12-7 12 0', 4.6) + O('M18 9c0-7 12-7 12 0', 2, '#c9a36b') +
      B('M9 17c0-5 4-9 9-9h12c5 0 9 4 9 9v21c0 3-2 6-6 6H15c-4 0-6-3-6-6Z', c, F('M33 44c4 0 6-3 6-6V24l-5 3v17Z', shade(c, 0.72))) +
      P('M14 31h20v9H14Z', shade(c, 0.82), 1.4) +
      P('M9 17c0-5 4-9 9-9h12c5 0 9 4 9 9v6c-4 3-9 5-15 5S13 26 9 23Z', lighten(c, 0.16)) + F('M10 16c1-4 4-7 8-7h6v18c-5 0-10-2-14-5Z', lighten(c, 0.3)) +
      O('M9 17c0-5 4-9 9-9h12c5 0 9 4 9 9v6c-4 3-9 5-15 5S13 26 9 23Z') + P('M22 20h4v13h-4Z', '#5a3a26', 1.3) + P('M20.5 25h7v5h-7Z', GOLD, 1.3);
  },
  frame: () => {
    const c = '#5f7a4a', rail = '#c9b27a';
    return P('M7 3h4v42H7Z', rail, 1.5) + P('M37 3h4v42h-4Z', shade(rail, 0.8), 1.5) +
      B('M11 15h26v25c0 2-2 4-4 4H15c-2 0-4-2-4-4Z', c, F('M11 15h8v29h-4c-2 0-4-2-4-4Z', lighten(c, 0.2)) + F('M31 15h6v25c0 2-2 4-4 4h-2Z', shade(c, 0.72))) +
      P('M15 28h8v10h-8Z', shade(c, 0.85), 1.3) + P('M25 28h8v10h-8Z', shade(c, 0.7), 1.3) + O('M11 22h26', 1.4, shade(c, 0.5)) +
      B('M9 4h30a3 5 0 0 1 0 10H9a3 5 0 0 1 0-10Z', '#b5564a', F('M9 4h30v3.5H7Z', lighten('#b5564a', 0.25))) + O('M17 4v10M31 4v10', 1.6, '#e2cf9d');
  },
  named: () => {
    const c = '#6d4fa3';
    return O('M12 18C12 0 36 0 36 18', 5) + O('M12 18C12 0 36 0 36 18', 2.4, GOLD) +
      B('M7 19h34v17c0 4-3 8-8 8H15c-5 0-8-4-8-8Z', c, F('M34 44c4 0 7-4 7-8V26c-3 6-6 9-10 10v8Z', shade(c, 0.68))) +
      P('M7 19c0-3 2-5 5-5h24c3 0 5 2 5 5v4c-3 7-9 10-17 10S10 30 7 23Z', lighten(c, 0.2)) + F('M8 19c0-2 2-4 4-4h12v17c-7 0-12-3-16-9Z', lighten(c, 0.36)) +
      O('M7 19c0-3 2-5 5-5h24c3 0 5 2 5 5v4c-3 7-9 10-17 10S10 30 7 23Z') + O('M10.5 22.5c3 5 7 7 13.5 7s10.5-2 13.5-7', 1.3, GOLD) +
      P('M24 26l5 6-5 7-5-7Z', '#4fd0ff', 1.4) + F('M24 26l-5 6 5 2Z', '#c9f1ff') + C(13, 38, 1.5, GOLD, 0) + C(35, 38, 1.5, GOLD, 0);
  },
};
/** A bag: `sack`, `pack`, `frame`, or `named` for pattern bags. */
export function bagIcon(type: string): string {
  return memo(`bag:${type}`, () => own(BAG_DRAW, type)?.());
}

// -------------------------------------------------------------------- brews
function brewBody(form: string, col: string): string | undefined {
  const dk = shade(col, 0.72), lt = lighten(col, 0.4);
  if (form === 'flask') {
    return P('M20.5 2h7v6h-7Z', CORK, 1.5) +
      B('M20 7h8v3h-1v7c7 3 11 8 11 15 0 7-6 12-14 12S10 39 10 32c0-7 4-12 11-15v-7h-1Z', GLASS,
        F('M11.5 26c4-2 8 1 12.5 0s8-2 12.5 0c1 2 1.5 4 1.5 6 0 7-6 12-14 12S10 39 10 32c0-2 .5-4 1.5-6Z', col) +
        F('M38 32c0 7-6 12-14 12-4 0-8-1-10-4 9 2 18-1 21-11 2 1 3 2 3 3Z', dk) + F('M14 30c0-3 2-5 4-6-1 3-1 6 0 9-2 0-4-1-4-3Z', lt)) +
      O('M17.5 22c1-1 2-2 3.5-2.5', 1.6, '#ffffff') + C(26, 33, 1.6, lt, 0) + C(30, 37, 1.1, lt, 0);
  }
  if (form === 'oil') {
    return P('M17 3h8v9h-8Z', '#3a3a40', 1.5) + P('M15.5 10.5h11v4h-11Z', GOLD, 1.4) +
      B('M16 14h10l3 5v21c0 2-2 4-4 4h-8c-2 0-4-2-4-4V19Z', GLASS, F('M13 25h16v15c0 2-2 4-4 4h-8c-2 0-4-2-4-4Z', col) + F('M25 25h4v15c0 2-2 4-4 4h-2c1-6 2-12 2-19Z', dk) +
        F('M15 27h2.5v12H15Z', lt)) +
      drop(38, 31, 1.15, col, 1.6) + F('M35.5 31c0-2 1-3 2-4.5-1 3-1 5 0 7-1 0-2-1-2-2.5Z', lt);
  }
  if (form === 'charm') {
    return O(ell(24, 9, 5, 5.5), 4.4) + O(ell(24, 9, 5, 5.5), 1.8, '#c9a36b') +
      B('M24 12l13 13-13 16-13-16Z', GOLD, F('M24 12L11 25l13 16Z', lighten(GOLD, 0.3)) + F('M37 25L24 41l4-16Z', shade(GOLD, 0.72))) +
      B('M24 18l7 7-7 9-7-9Z', col, F('M24 18l-7 7 7 9Z', lt) + F('M31 25l-7 9 2-9Z', dk), 1.4) +
      C(24, 44, 2.2, col, 1.3);
  }
  return undefined;
}
const BREW_DEFAULT: Record<string, string> = { flask: '#e2504a', oil: '#e9b949', charm: '#6fd0e0' };
/** A brew: flask, weapon oil vial, or charm. `color` is the liquid or the stone. */
export function brewIcon(form: BrewForm, color?: string): string {
  const col = color ?? BREW_DEFAULT[form] ?? '#e2504a';
  return memo(`brew:${form}:${col}`, () => brewBody(form, col));
}

// --------------------------------------------------------------- schematics
const SCHEM_DRAW: Record<string, () => string> = {
  recipe: () => {
    const c = PARCH, rib = RED;
    return P('M21 30l-4 14 5-3 3 4 2-13Z', shade(rib, 0.8), 1.4) +
      rot(-24, B('M7 17h33a3.5 7 0 0 1 0 14H7Z', c, F('M7 17h33v3.5H7Z', lighten(c, 0.4)) + F('M7 27h35v4H7Z', shade(c, 0.76))) +
        E(7, 24, 3.5, 7, shade(c, 0.86)) + O('M7 21.5c-1.5 0-1.5 5 0 5', 1.1, shade(c, 0.5)) +
        P('M20 16h7v16h-7Z', rib, 1.5) + F('M20 16h7v3.5h-7Z', lighten(rib, 0.3)) + O('M20 16h7v16h-7Z', 1.5));
  },
  pattern: () => {
    const c = '#dcc29a', ink = '#7a5230';
    return B('M8 6h20c0 6 4 10 12 10v27H8Z', c, F('M8 6h5v37H8Z', lighten(c, 0.3)) + F('M34 16h6v27h-6Z', shade(c, 0.85))) +
      `<path d="M13 11h11c1 5 4 8 11 9.5v18H13Z" stroke="${ink}" stroke-width="1.5" stroke-dasharray="3 2.4"/>` +
      O('M24 24v11M21 32l3 3.5 3-3.5', 1.4, ink) + F('M8 22l3.5 2.5L8 27ZM40 30l-3.5 2.5L40 35Z', OL) +
      at(34, 6, P('M-2 0a3 3 0 1 1 3 3l5 5-2 2-5-5a3 3 0 0 1-1-5Z', STEEL, 1.2), 0, 0.9);
  },
  blueprint: () => {
    const c = '#3f78c9', ln = '#dbeaff';
    return B('M10 7h31v34H10Z', c, F('M10 7h31v3H10Z', lighten(c, 0.2)) + O('M18 7v34M26 7v34M34 7v34M10 15h31M10 23h31M10 31h31', 0.8, lighten(c, 0.22))) +
      O('M17 34V23l8-7 8 7v11ZM22 34v-6h6v6', 1.7, ln) + O('M15 38h20M15 36.5v3M35 36.5v3', 1.2, ln) +
      B('M5 5h8v38H5Z', lighten(c, 0.3), F('M10 5h3v38h-3Z', shade(c, 0.8))) + E(9, 5, 4, 1.8, lighten(c, 0.55), 1.3) + E(9, 43, 4, 1.8, shade(c, 0.7), 1.3);
  },
};
/** A schematic by kind: rolled recipe scroll, cut pattern sheet, blue construction sheet. */
export function schemIcon(kind: Schematic['kind']): string {
  return memo(`schem:${kind}`, () => own(SCHEM_DRAW, kind)?.());
}

// --------------------------------------------------------------- shop items
const ITEM_DRAW: Record<string, () => string> = {
  whetstone: () => {
    const g = '#c2c8cc', r = '#c07a4c';
    return P('M6 23L26 12l16 8-20 11Z', g) + P('M6 23l16 8v4.5L6 27.5Z', shade(g, 0.78), 1.4) + P('M6 27.5l16 8V40L6 32Z', r, 1.4) +
      P('M22 31l20-11v4.5l-20 11Z', shade(g, 0.58), 1.4) + P('M22 35.5l20-11V29L22 40Z', shade(r, 0.68), 1.4) +
      O('M6 23L26 12l16 8v9L22 40 6 32Z') + glint(12, 11, 6, '#ffe45c');
  },
  boots: () => {
    const c = '#c08a52';
    return P('M14 23C8 22 4 17 3 10c5 1 8 3 11 7Z', '#f4f1e8', 1.5) + O('M6 13c3 1 5 3 7 6', 1, '#b9b4a6') +
      B('M14 5h13v19c6 2 12 4 14 9 1 3 0 5-1 7H13c-1-5 0-9 1-13Z', c, F('M14 5h5v22c-2 4-2 8-2 13h-4c-1-5 0-9 1-13Z', lighten(c, 0.25)) + F('M27 24c6 2 12 4 14 9 1 3 0 5-1 7H27c5-4 6-10 0-16Z', shade(c, 0.8))) +
      P('M12.5 4h16v6h-16Z', lighten(c, 0.4), 1.5) + P('M11 39h30.5v4.5H11Z', '#4a3526', 1.5) + O('M27 15h-5M27 20h-5', 1.3, shade(c, 0.5));
  },
  vest: () => {
    const c = '#b9925a';
    return B('M15 5h5l4 8 4-8h5l7 7-4 7v24H12V19l-4-7Z', c, F('M15 5h5l4 8v30H12V19l-4-7Z', lighten(c, 0.2))) +
      O('M12 27h24M12 35h24M18 20v23M30 20v23', 1.1, shade(c, 0.6)) + O('M24 13v30', 1.3, shade(c, 0.45)) +
      C(24, 23, 1.4, '#4a3526', 0) + C(24, 31, 1.4, '#4a3526', 0) + C(24, 39, 1.4, '#4a3526', 0);
  },
  lungs: () => {
    const c = STEEL, br = '#c9a36b';
    return L('M24 15l-5 5M24 15l5 5', br, 2.4) + P('M22 3h4v13h-4Z', br, 1.5) + O('M22 7h4M22 11h4', 1, shade(br, 0.55)) +
      B('M20 14c-7 1-13 9-13 21 0 6 3 9 6 9 5 0 8-4 8-9Z', c, F('M20 14c-7 1-13 9-13 21 0 3 1 6 2 7 0-11 3-21 11-28Z', lighten(c, 0.4)) + O('M8 29h13', 1.2, shade(c, 0.55))) +
      B('M28 14c7 1 13 9 13 21 0 6-3 9-6 9-5 0-8-4-8-9Z', shade(c, 0.86), F('M41 35c0 6-3 9-6 9-3 0-5-1-7-4 6 0 10-2 13-5Z', shade(c, 0.6)) + O('M27 29h13', 1.2, shade(c, 0.5))) +
      [[12, 34], [16, 23], [36, 34], [32, 23]].map(([x, y]) => C(x, y, 1.2, OL, 0)).join('');
  },
  lodestone: () => {
    const c = '#4b5563';
    return L('M36 15c5 5 5 14 0 19', '#ff6a5a', 2, 1) + L('M41 10c8 8 8 21 0 29', '#6fb7ff', 2, 1) +
      B('M5 30L8 19 17 12 28 14 33 24 30 36 18 40 8 37Z', c, F('M8 19L17 12 28 14 22 20 12 23Z', lighten(c, 0.25)) + F('M5 30l10 2 10-2 8-6-3 12-12 4-10-3Z', shade(c, 0.62))) +
      L('M24 9l3-6', STEEL, 1.6, 0.9) + L('M31 17l6-3', STEEL, 1.6, 0.9) + L('M30 39l5 4', STEEL, 1.6, 0.9);
  },
  bandolier: () => {
    const c = LEATHER;
    return B('M3 13l7-7 35 26-7 8Z', c, F('M3 13l3-3 35 26-3 4Z', shade(c, 0.74))) +
      [[14.2, 16.2], [21.2, 21.4], [28.2, 26.7], [35.2, 31.9]].map(([x, y]) => at(x, y, P('M-2.6-7.5h5.2v15h-5.2Z', GOLD, 1.4) + P('M-2.6-7.5h5.2v4.5h-5.2Z', STEEL, 1.4), 37)).join('');
  },
  coin: () => C(24, 24, 18, GOLD) + C(24, 24, 13.5, lighten(GOLD, 0.3), 1.2) + F('M9 27c2 8 8 14 16 14 6 0 12-4 15-10-4 4-9 6-15 6-7 0-13-4-16-10Z', shade(GOLD, 0.72)) +
    L('M26 27c2 3 3 5 6 6', '#3f7a2f', 1.6, 0.8) +
    [[20.5, 20.5], [27.5, 20.5], [20.5, 27.5], [27.5, 27.5]].map(([x, y]) => C(x, y, 4, '#58a844', 1.2)).join('') + C(24, 24, 1.6, '#3f7a2f', 0),
  rations: () => {
    const c = '#c98b4a';
    return B('M4 31c0-9 8-15 18-15s18 6 18 15v6c0 2-2 3-4 3H8c-2 0-4-1-4-3Z', c, F('M7 27c2-6 8-9 15-9s13 3 15 9c-4-3-9-5-15-5s-11 2-15 5Z', lighten(c, 0.35)) + F('M4 34h36v3c0 2-2 3-4 3H8c-2 0-4-1-4-3Z', shade(c, 0.74))) +
      O('M14 23l3 6M21 21l2 7M29 22l-1 7', 1.5, shade(c, 0.55)) +
      P('M24 45l20-10v10Z', '#f2c14e') + C(38, 42, 1.3, shade('#f2c14e', 0.7), 0) + C(33, 43.5, 0.9, shade('#f2c14e', 0.7), 0);
  },
  plate: () => {
    const c = STEEL;
    return B('M13 6l6 3h10l6-3 8 8-5 6v17c0 4-6 7-14 7s-14-3-14-7V20l-5-6Z', c, F('M13 6l6 3h5v35c-8 0-14-3-14-7V20l-5-6Z', lighten(c, 0.4)) + F('M38 21v16c0 4-6 7-14 7 6-2 9-5 9-9V23Z', shade(c, 0.66))) +
      O('M24 13v31M10 31c9 3 19 3 28 0', 1.2, shade(c, 0.5)) + P('M19 9h10v4c-3 2-7 2-10 0Z', shade(c, 0.7), 1.4) +
      [[14, 24], [34, 24], [14, 37], [34, 37]].map(([x, y]) => C(x, y, 1.2, OL, 0)).join('');
  },
  draught: () => {
    const c = '#a8743f', fo = '#e2504a';
    return O('M33 21h3c4 0 6 3 6 7s-2 7-6 7h-3', 6.4) + O('M33 21h3c4 0 6 3 6 7s-2 7-6 7h-3', 2.8, STEEL) +
      B('M9 15h24v25c0 2-2 4-4 4H13c-2 0-4-2-4-4Z', c, F('M9 15h6v29h-2c-2 0-4-2-4-4Z', lighten(c, 0.25)) + F('M27 15h6v25c0 2-2 4-4 4h-2Z', shade(c, 0.68)) +
        O('M17 16v28M25 16v28', 1.1, shade(c, 0.5))) +
      P('M8.5 22h25v4h-25Z', STEEL, 1.4) + P('M8.5 35h25v4h-25Z', shade(STEEL, 0.8), 1.4) +
      P('M7 16c-1-5 3-8 7-6 1-5 8-6 11-2 3-3 10-1 10 4 2 1 2 3 1 4H7Z', fo) + F('M9 14c0-3 2-4 5-3 1-3 5-5 9-3-3 0-6 2-7 5-2-1-4 0-5 2-1 0-2 0-2-1Z', lighten(fo, 0.4)) +
      P('M12 16h5v7a2.5 2.5 0 0 1-5 0Z', fo, 1.4);
  },
  coolant: () => {
    const c = '#8fa3ad', ice = '#7fd4ff';
    return P('M18 3h12v8H18Z', shade(c, 0.6), 1.5) +
      B('M15 10h18a3 3 0 0 1 3 3v28a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3Z', c, F('M12 13a3 3 0 0 1 3-3h3v34h-3a3 3 0 0 1-3-3Z', lighten(c, 0.35)) + F('M31 10h2a3 3 0 0 1 3 3v28a3 3 0 0 1-3 3h-2Z', shade(c, 0.66))) +
      B('M19 16h10a2 2 0 0 1 2 2v19a2 2 0 0 1-2 2H19a2 2 0 0 1-2-2V18a2 2 0 0 1 2-2Z', '#22323c', F('M17 23h14v14a2 2 0 0 1-2 2H19a2 2 0 0 1-2-2Z', ice) + F('M17 23h14v2.5H17Z', lighten(ice, 0.55)), 1.4) +
      O('M24 27v9M20 29.5l8 4M28 29.5l-8 4', 1.3, '#ffffff');
  },
  bellows: () => {
    const c = '#9a6e40', lea = '#8a4636';
    return rot(-30, P('M2 21.5h11v5H2Z', STEEL, 1.5) +
      B('M13 24L33 14v20Z', lea, F('M13 24L33 14v7Z', lighten(lea, 0.22)) + F('M13 24l20 4v6Z', shade(lea, 0.7)) + O('M20 20.5v7M26.5 17.5v13', 1.3, shade(lea, 0.5))) +
      L('M13 22.5L38 11', c, 4.6) + L('M13 25.5L38 37', shade(c, 0.76), 4.6) + C(12.5, 24, 3, GOLD, 1.4));
  },
  brace: () => {
    const c = LEATHER, skin = '#e0b08a';
    return P('M12 32c-4 1-5 5-3 9l5 1Z', shade(skin, 0.85), 1.5) +
      B('M15 29h18c2 0 4 2 4 4v7c0 3-2 5-5 5H16c-3 0-5-2-5-5v-7c0-2 2-4 4-4Z', skin, F('M31 29h2c2 0 4 2 4 4v7c0 3-2 5-5 5h-3c2-5 3-10 2-16Z', shade(skin, 0.8)) + O('M18 39v6M24 39v6M30 39v6', 1.2, shade(skin, 0.55))) +
      B('M9 5c10-3 20-3 30 0l-4 27c-7 2-15 2-22 0Z', c, F('M9 5c3-1 6-1.5 9-2l2 30c-2 0-5-.5-7-1Z', lighten(c, 0.22)) + F('M39 5l-4 27c-2 .5-4 1-6 1l3-30c3 .5 5 1 7 2Z', shade(c, 0.72))) +
      B('M18 7c4-.8 8-.8 12 0l-2.5 22c-2 .5-5 .5-7 0Z', STEEL, F('M18 7c2-.4 4-.6 6-.6v23c-1.2 0-2.4-.1-3.5-.4Z', lighten(STEEL, 0.4)), 1.4) +
      P('M10 10.5c9 2.5 19 2.5 28 0l-.8 4.5c-8.8 2.5-17.8 2.5-26.4 0Z', '#4a3526', 1.3) + P('M12 22.5c8 2.5 16 2.5 24 0l-.8 4.5c-7.4 2.5-15 2.5-22.4 0Z', '#4a3526', 1.3) +
      P('M21.5 10.5h5v5h-5Z', GOLD, 1.2) + P('M21.5 22.5h5v5h-5Z', GOLD, 1.2);
  },
  spikes: () => {
    const sp = lighten(STEEL, 0.35);
    return [0, 45, 90, 135, 180, 225, 270, 315].map((a) => at(24, 24, P('M-3.5-15L0-23l3.5 8Z', sp, 1.4), a)).join('') +
      C(24, 24, 16, STEEL) + C(24, 24, 12, WOOD, 1.4) + F('M13 22c1-6 6-10 11-10-4 2-7 6-8 12-1 0-2-1-3-2Z', lighten(WOOD, 0.3)) + F('M36 24c0 7-5 12-12 12 5-2 8-6 9-12Z', shade(WOOD, 0.68)) +
      O('M24 12v24M12 24h24', 1, shade(WOOD, 0.5)) + P(star(24, 24, 7.5, 3.2, 4, 0), sp, 1.4) + C(24, 24, 2.2, STEEL, 1.1);
  },
  tar: () => {
    const c = '#3d3d45';
    return O('M9 22c-5 2-5 9 1 11M39 22c5 2 5 9-1 11', 4) + O('M9 22c-5 2-5 9 1 11M39 22c5 2 5 9-1 11', 1.6, '#8d939a') +
      B('M8 21h32c1 10-1 18-6 23H14c-5-5-7-13-6-23Z', c, F('M8 21h6c-1 9 0 17 4 23h-4c-5-5-7-13-6-23Z', lighten(c, 0.28)) + F('M40 21c1 10-1 18-6 23h-5c5-6 7-14 6-23Z', shade(c, 0.6))) +
      E(24, 21, 16.5, 4.6, '#8d939a') + E(24, 21.4, 13, 3, '#17130f', 0) + P('M29 22c0 7 1 11 3 11s3-4 3-11Z', '#17130f', 1.2) +
      flame(22, 19, 0.95);
  },
  frostcore: () => {
    const c = '#9fdcf5';
    return [45, 135, 225, 315].map((a) => at(24, 24, P('M-4-14L0-22.5l4 8.5Z', '#e4f6ff', 1.4), a)).join('') +
      C(24, 24, 15.5, c) + F('M10 24c0-8 6-14 14-14-5 3-8 8-8 14 0 3 1 6 2 8-5-1-8-4-8-8Z', lighten(c, 0.55)) + F('M39 26c-1 8-7 13.5-15 13.5-3 0-6-1-8-2.5 12 1 19-3 23-11Z', shade(c, 0.66)) +
      O(circ(24, 24, 15.5)) + O('M24 14v20M15.3 19l17.4 10M15.3 29l17.4-10', 2.2, '#ffffff') + C(24, 24, 2.6, '#ffffff', 0);
  },
  conductor: () => {
    const cu = '#d98a4a';
    return P('M31 3l-4 6h3l-2 5 6-7h-3l2-4Z', '#ffe45c', 1.2) + P('M15 5l-4 5h3l-1 4 5-6h-3l1-3Z', '#ffe45c', 1.2) +
      P('M22 13h4v26h-4Z', shade(cu, 0.7), 1.4) + C(24, 10, 5.5, STEEL) + C(22.4, 8.4, 1.8, '#f0f3f6', 0) +
      [19, 25, 31].map((y) => P(`M16 ${y}h16a2.5 2.5 0 0 1 0 5H16a2.5 2.5 0 0 1 0-5Z`, cu, 1.4) + F(`M16 ${y + 0.6}h16v1.6H16Z`, lighten(cu, 0.4))).join('') +
      B('M11 37h26v7H11Z', '#4a4038', F('M11 37h26v2.5H11Z', lighten('#4a4038', 0.3)));
  },
  fang: () => {
    const iv = '#f3ecd8';
    return B('M15 9c8-3 17 1 20 9 3 8 0 17-7 27 0-9-3-15-8-20-4-4-7-9-5-16Z', iv, F('M29 12c4 3 6 5 6.5 9 2 8-1 15-7.5 24 2-12 5-22 1-33Z', shade(iv, 0.76)) +
      F('M28 45c0-4-1-8-2-11l6-2c-1 5-2 9-4 13Z', RED)) +
      P('M13 6c7-4 17-2 23 5l-4 6c-5-4-12-6-18-4Z', shade(RED, 0.7)) + drop(13, 37, 1, RED, 1.6) + F('M11 37c0-2 1-3 2-4-1 2-1 4 0 6-1 0-2-1-2-2Z', lighten(RED, 0.45));
  },
  quiver: () => {
    const c = LEATHER, fl = (x: number, col: string): string => P(`M${x} 2l3.2 4v7h-6.4V6Z`, col, 1.3) + O(`M${x} 2v11`, 0.9, shade(col, 0.6));
    return rot(20, O('M19 13v6M24 13v6M29 13v6', 3) + O('M19 13v6M24 13v6M29 13v6', 1.4, '#d9c08a') + fl(19, RED) + fl(24, '#f4f1e8') + fl(29, RED) +
      B('M15 18h18l-2.5 27h-13Z', c, F('M15 18h5l1 27h-3.5Z', lighten(c, 0.25)) + F('M29 18h4l-2.5 27H27Z', shade(c, 0.7))) +
      P('M14 16.5h20v5H14Z', shade(c, 0.6), 1.4) + P('M16 32h16l-.5 4.5H16.5Z', GOLD, 1.3));
  },
  furnace: () => {
    const c = '#5a6068';
    return P('M30 12V4h7v11Z', shade(c, 0.8), 1.5) + C(40, 5, 1.4, '#ffb347', 0) + C(43, 10, 1, '#ffd95a', 0) +
      B(HEART, c, F('M8 19c0-6 4-10 8-10 2 0 4 1 5 2-5 1-9 5-9 12-2-1-4-2-4-4Z', lighten(c, 0.3)) + F('M43 18c0 9-6 16-19 25 9-8 14-15 14-25Z', shade(c, 0.62))) +
      B('M24 36C16 30 13 26 13 21c0-4 3-6 6-6 2 0 4 1 5 4 1-3 3-4 5-4 3 0 6 2 6 6 0 5-3 9-11 15Z', '#f6862e', F('M24 33c-5-4-7-7-7-10 0-2 1-3 3-3 1 0 3 1 4 3 1-2 3-3 4-3 2 0 3 1 3 3 0 3-2 6-7 10Z', '#ffd95a'), 1.4) +
      O('M19.5 15.5v15.5M28.5 15.5v15.5', 1.8);
  },
  ballast: () => {
    const c = IRON, st = LEATHER;
    return P('M5 6l5-3 16 21-4 3Z', st, 1.5) + P('M43 6l-5-3-16 21 4 3Z', shade(st, 0.78), 1.5) + C(24, 24, 5, GOLD) + C(24, 24, 2, OL, 0) + P('M22 28h4v5h-4Z', st, 1.3) +
      B('M17 32h14l5 12H12Z', c, F('M17 32h14l1 3H16Z', lighten(c, 0.4)) + F('M31 32l5 12h-6l-2-12Z', shade(c, 0.66))) + O('M20 39h8', 1.6, lighten(c, 0.5));
  },
  scope: () => {
    const c = '#d9a441';
    return rot(45, B('M21.5 33h5v13h-5Z', c, F('M21.5 33h2v13h-2Z', lighten(c, 0.4))) + P('M20.5 44.5h7v3.5h-7Z', shade(c, 0.6), 1.3) +
      B('M20 19h8v15h-8Z', c, F('M20 19h3v15h-3Z', lighten(c, 0.4)) + F('M26 19h2v15h-2Z', shade(c, 0.7))) +
      B('M18 5h12v15H18Z', c, F('M18 5h4v15h-4Z', lighten(c, 0.4)) + F('M27 5h3v15h-3Z', shade(c, 0.7))) +
      P('M17 18h14v3H17Z', shade(c, 0.55), 1.3) + P('M19 32h10v3H19Z', shade(c, 0.55), 1.3) +
      P('M16.5 1.5h15v5h-15Z', '#4a4038', 1.4) + E(24, 2, 5.6, 1.9, '#8fd8ff', 1.1));
  },
  metronome: () => {
    const c = '#8a5a3a';
    return B('M17 5h14l8 35H9Z', c, F('M17 5h4L14 40H9Z', lighten(c, 0.22)) + F('M31 5l8 35h-6L28 5Z', shade(c, 0.72))) +
      P('M19.5 10h9l5 26H14.5Z', PARCH, 1.3) + O('M18 18h4M17 23h4M16 28h4M15 33h4', 1, '#7a5230') +
      L('M24 36L31 8', '#4a4038', 1.6, 0.9) + P('M26 16l5 1.2-1.2 5-5-1.2Z', STEEL, 1.2) +
      B('M6 39h36v5.5H6Z', shade(c, 0.74), F('M6 39h36v2H6Z', c));
  },
  troll: () => {
    const g = '#7fc94a';
    return P('M19.5 3h9v6h-9Z', CORK, 1.5) + P('M18 8h12v6H18Z', GLASS, 1.5) +
      B('M15 13h18a3 3 0 0 1 3 3v24a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V16a3 3 0 0 1 3-3Z', GLASS, F('M12 21c4-2 8 1 12 0s8-2 12 0v19a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4Z', g) +
        F('M32 21c1 0 3 0 4 .5V40a4 4 0 0 1-4 4h-3c2-7 3-15 3-23Z', shade(g, 0.68)) + F('M14 24h3v15h-3Z', lighten(g, 0.45))) +
      at(24, 35, P(DROP, '#f4f1e8', 1.2) + F('M-1-2.5h2v2.5h2.5v2H1v2.5h-2V2h-2.5V0H-1Z', '#3f8a2f'), 0, 1.05) + C(29, 18, 1.2, lighten(g, 0.5), 0);
  },
};
/** One of the 24 shop items, by its id in `ITEMS`. */
export function itemIcon(id: string): string {
  return memo(`item:${id}`, () => own(ITEM_DRAW, id)?.());
}

// ------------------------------------------------------------------- glyphs
const G = (d: string, fill: string, extra = ''): string => P(d, fill, GW, extra);
const GL = (d: string, color: string, w = 4): string => L(d, color, w, GW * 0.5);
const swordGlyph = (fill: string): string => rot(45, G('M24 1l5.5 8v20h7v5.5h-9.5v10h-6v-10h-9.5V29h7V9Z', fill));
const malletGlyph = (head: string, handle: string): string =>
  rot(45, G('M21 19h6v26h-6Z', handle) + G('M14 6h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z', head));
const BOLT = 'M29 2L9 27h11l-4 19 23-27H27Z';
const thermo = (col: string, top: number, arrow: string): string =>
  G('M13 8a5 5 0 0 1 10 0v19a9.5 9.5 0 1 1-10 0Z', '#eef2f5') + C(18, 35, 5.6, col, 0) + F(`M16 ${top}h4v24h-4Z`, col) + G(arrow, col);
const snowflake = (cx: number, cy: number, r: number): string => {
  let d = '';
  for (let k = 0; k < 6; k++) {
    const a = k * 60 - 90, e = polar(cx, cy, r, a), b = polar(cx, cy, r * 0.58, a), l = polar(cx, cy, r * 0.86, a - 22), q = polar(cx, cy, r * 0.86, a + 22);
    d += `M${cx} ${cy}L${f(e[0])} ${f(e[1])}M${f(l[0])} ${f(l[1])}L${f(b[0])} ${f(b[1])}L${f(q[0])} ${f(q[1])}`;
  }
  return d;
};
const spiral = (cx: number, cy: number, r: number, turns: number): string => {
  const pts: string[] = [], max = turns * Math.PI * 2;
  for (let t = 0; t <= max; t += 0.3) pts.push(polar(cx, cy, 2 + ((r - 2) * t) / max, (t * 180) / Math.PI).map(f).join(' '));
  return 'M' + pts.join('L');
};
const BONE_GLYPH = (col: string): string => bone(13, 13, 35, 35, col, 6.5, GW);

const MOD_DRAW: Record<ModKey, () => string> = {
  dmg: () => swordGlyph('#dfe8f2'),
  dmgMul: () => G('M9 16l7-7 8 8 8-8 7 7-8 8 8 8-7 7-8-8-8 8-7-7 8-8Z', '#ff9a1f'),
  atk: () => G('M5 9h10l11 15-11 15H5l11-15ZM22 9h10l11 15-11 15H22l11-15Z', '#ffd34d'),
  speed: () => G('M20 11C12 8 6 9 2 14c5 0 8 1 10 3-4 0-6 1-8 4 4 2 8 2 10 1-2 1-3 2-4 4 4 1 8 0 11-3Z', '#f4f1e8') +
    G('M18 4h13v17c7 2 13 5 14 11v10H32l-2-4h-3l-1 4h-8Z', '#6fd6a8'),
  hp: () => G(HEART, '#e2504a'),
  regen: () => G('M18 5h12v13h13v12H30v13H18V30H5V18h13Z', '#6fd66a'),
  stam: () => G(BOLT, '#d6e04a'),
  armor: () => G('M24 3l18 6v13c0 11-7 19-18 23C13 41 6 33 6 22V9Z', '#8fb4d9'),
  magnet: () => G('M7 5h12v19a5 5 0 0 0 10 0V5h12v19a17 17 0 0 1-34 0Z', '#e2504a') + G('M7 5h12v9H7Z', '#f4f1e8') + G('M29 5h12v9H29Z', '#f4f1e8'),
  crit: () => GL(circ(24, 24, 12.5), '#ff9f43', 4.4) + GL('M24 2v9M24 37v9M2 24h9M37 24h9', '#ff9f43', 4.4) + C(24, 24, 3.6, '#ff9f43', 0),
  range: () => G('M2 24l13-12v7h18v-7l13 12-13 12v-7H15v7Z', '#9fd0ff'),
  cd: () => G('M9 3h30v7c0 6-5 10-9 14 4 4 9 8 9 14v7H9v-7c0-6 5-10 9-14-4-4-9-8-9-14Z', '#b18cff') + F('M15 39c0-4 5-6 9-10 4 4 9 6 9 10v2H15Z', '#f1e9ff'),
  burn: () => flame(24, 43, 2.5, false, GW),
  chill: () => GL(snowflake(24, 24, 20), '#a6e3ff', 3.2),
  chain: () => rot(-45, GL(ell(14.5, 24, 10.5, 6.5), '#6fd0e0', 4.4) + GL(ell(33.5, 24, 10.5, 6.5), '#6fd0e0', 4.4)),
  pierce: () => G('M19 4h9v40h-9Z', '#7c8791') + G('M2 20h28v-8l16 12-16 12v-8H2Z', '#f0e2b0'),
  leech: () => at(24, 25, P(DROP, '#c0392b', GW / 2.9) + F('M-2.6 0c0-1.5 1-2.5 1.6-3.5-.5 2-.5 3.5 0 5-1 0-1.6-.5-1.6-1.5Z', '#ff8a7a'), 0, 2.9),
  thorns: () => G(star(24, 24, 22, 10.5, 8, -90), '#8fbf5a'),
  heatCool: () => thermo('#5fb0ff', 27, 'M32 9h8v15h5.5L36 38 26.5 24H32Z'),
  heatGain: () => thermo('#ff6a3c', 10, 'M32 39h8V24h5.5L36 10 26.5 24H32Z'),
  yield: () => G(poly([[15, 4], [29, 3], [34, 13], [26, 21], [13, 19], [10, 10]]), '#f2c14e') + G(poly([[6, 27], [17, 24], [25, 31], [23, 42], [10, 44], [3, 36]]), '#f2c14e') +
    G(poly([[30, 26], [41, 25], [46, 34], [41, 43], [29, 43], [26, 34]]), '#f2c14e'),
  weight: () => G('M41 3C24 4 11 13 9 29l-6 12 5 3 6-10c15-1 26-13 27-31Z', '#f4f1e8') + O('M13 33C19 24 26 16 35 9', 1.8, '#8d939a'),
  heavyCost: () => malletGlyph('#8fd66a', '#c9a36b') + P('M42 24l-11 12h6l-3 10 12-13h-6Z', '#ffe45c', 2),
  heavyDmg: () => malletGlyph('#ff9f43', '#c9a36b') + P(star(38, 38, 9, 3.6, 6, -90), '#ffe45c', 2),
  scrap: () => G(poly([0, 60, 120, 180, 240, 300].map((a) => polar(24, 24, 21, a))) + circ(24, 24, 8), '#c2b59b', EVENODD),
  drops: () => BONE_GLYPH('#f1dfb0'),
  noHeal: () => G(HEART, '#857c90') + GL('M7 41L41 7', '#ff5a4a', 5),
  detonate: () => GL('M30 15c2-5 5-8 9-9', '#c9a36b', 2.6) + P(star(40, 6, 6.5, 2.6, 6, -90), '#ffe45c', 1.6) + G('M27 11l5-5 8 8-5 5Z', '#6d6d78') + C(21, 28, 15.5, '#4a4a55', GW) +
    F('M10 25c1-5 5-9 10-10-3 3-5 6-6 11-2 1-3 0-4-1Z', '#8a8a96'),
  splinter: () => [-38, 38, 0].map((a) => `<g transform="rotate(${a} 24 46)">${G('M24 45L19 15l5-12 5 12Z', '#d9b27a')}</g>`).join(''),
  stagger: () => GL(spiral(24, 24, 19, 2.4), '#ffe45c', 4),
  slip: () => G('M2 37c5-17 18-25 32-21l1-9 11 15-17 8 1-7c-10-2-19 3-23 16Z', '#7fe6e0') + GL('M6 14h10M3 22h8', '#7fe6e0', 2.4),
  quick: () => G('M5 11h24V4l14 12-14 12v-7H5Z', '#c59bff') + G('M43 37H19v7L5 32l14-12v7h24Z', '#c59bff'),
  wind: () => GL('M4 16h23a6 6 0 1 0-6-6M4 26h33a6 6 0 1 1-6 6M4 36h15', '#cdeee0', 3.4),
  furnace: () => G('M6 45V21c0-10 8-17 18-17s18 7 18 17v24Z', '#c0563a') + P('M14 45V26c0-6 4-10 10-10s10 4 10 10v19Z', '#24170f', 1.6) + flame(24, 43, 1.25, false, 0, '#ff9f43'),
  ballast: () => GL(circ(24, 8.5, 4.5), '#8fa3b8', 3.2) +
    G('M21 13h6v6h7v5.5h-7V39c5-1 8-4 9.5-8l-4.5.5 8-9 5 11-4-1c-2.5 8-9 13-17 13S9.5 40.5 7 32.5l-4 1 5-11 8 9-4.5-.5c1.5 4 4.5 7 9.5 8V24.5h-7V19h7Z', '#8fa3b8'),
  ward: () => G('M2 24C10 12 17 8 24 8s14 4 22 16c-8 12-15 16-22 16S10 36 2 24Z', '#5fd6c0') + C(24, 24, 7.5, '#10323a', 0) + C(21.5, 21.5, 2.4, '#ffffff', 0),
  still: () => G('M16 7h16l1 19 11 11-5 5-9-8v10H18V34l-9 8-5-5 11-11Z', '#b58a5a') + E(24, 8, 8, 3.6, '#e2c08a', 2),
};
/** The key list in drawing order, for sheets and legends. */
export const MOD_ICON_KEYS = Object.keys(MOD_DRAW) as ModKey[];
/** A bold single-shape glyph for a modifier key. Made to read at 20 px. */
export function modIcon(key: ModKey): string {
  return memo(`mod:${key}`, () => own(MOD_DRAW, key)?.());
}

const FAM_DRAW: Record<Fam, (c: string) => string> = {
  blade: (c) => swordGlyph(c),
  bow: (c) => rot(-45, GL('M15 5L15 43', '#e9e4d8', 1.6) + G('M15 3C31 8 37 16 37 24S31 40 15 45c8-6 12-13 12-21S23 9 15 3Z', c) + G('M3 21.5h29v-6l13 8.5-13 8.5v-6H3Z', '#f0e2b0')),
  hammer: (c) => malletGlyph(c, '#c9a36b'),
  fire: (c) => GL('M8 44L24 26', '#c9a36b', 4.6) + flame(29, 29, 1.75, false, GW, c),
  frost: (c) => GL('M8 44L24 26', '#c9d6e2', 4.6) + G('M30 2l11 13-11 17-11-17Z', c) + F('M30 2L19 15l11 17Z', lighten(c, 0.5)) + O('M30 2l11 13-11 17-11-17Z', GW),
};
/** A small glyph for a weapon family (mastery rows, set bonuses). */
export function famIcon(fam: Fam): string {
  return memo(`fam:${fam}`, () => own(FAM_DRAW, fam)?.(WEAPONS[fam]?.color ?? UI));
}

// ------------------------------------------------------------------- skills
const ANVIL = 'M4 16c6 0 10-1 12-3h26v7c-6 0-10 3-10 8v3h6v7H12v-7h6v-3c0-5-6-9-14-9Z';
const anvil = (x: number, y: number, s = 1): string =>
  at(x, y, B(ANVIL, '#6f7a86', F('M16 13h26v3H13c1-1 2-2 3-3Z', '#a9b4c0') + F('M12 34h26v4H12Z', '#4a525c') + F('M28 20c-3 2-4 4-4 8v3h8v-3c0-5 4-8 10-8Z', '#59626d'), SW / s), 0, s);
const sub = (x: number, y: number, s: number, body: string): string => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;
const SKILL_DRAW: Record<string, () => string> = {
  mining: () => {
    const m = mix('#6f6661', '#7f9db6', 0.2);
    return sub(-1, -1, 0.92, toolBody('ore', 1) ?? '') +
      B('M24 45l2-9 8-4 10 3 1 8-4 3Z', m, F('M26 36l8-4 10 3-9 3Z', lighten(m, 0.22)) + at(34, 40, F(BEAN, '#9fbdd6'), -35) + at(40, 38, F(BEAN, '#9fbdd6'), -30, 0.8)) ;
  },
  logging: () => {
    const bark = '#6b4f2c', end = '#dcc898';
    return B('M8 45V31h32v14Z', bark, F('M8 31h7v14H8Z', lighten(bark, 0.2)) + F('M33 31h7v14h-7Z', shade(bark, 0.68)) + O('M18 36v6M27 37v5', 1.1, shade(bark, 0.5))) +
      E(24, 31, 16, 5.4, end) + E(24, 31, 9.5, 3, shade(end, 0.86), 0) + E(24, 31, 4, 1.3, shade(end, 0.7), 0) +
      `<g transform="translate(6 -3) scale(.84)">${rot(135, toolBody('wood', 1) ?? '')}</g>`;
  },
  harvesting: () => {
    const g = '#8fbf5a';
    return L('M36 45c0-6-1-10-2-14', '#6f9a48', 2) + P('M35 38c5 0 8-3 9-8-5 0-8 3-9 8Z', g, 1.3) + P('M35 34c-5-1-7-4-7-9 5 1 7 4 7 9Z', lighten(g, 0.2), 1.3) +
      sub(-1, -1, 0.9, toolBody('herb', 1) ?? '');
  },
  skinning: () => sub(19, 19, 0.58, B(HIDE, '#c29a6b', F('M19 14h10l3 6 0 9-3 6H19l-3-6 0-9Z', lighten('#c29a6b', 0.22)), SW / 0.58)) + sub(-2, -3, 0.84, toolBody('knife', 1) ?? ''),
  smithing: () => anvil(1, 6) + P('M17 12h15l2 7H15Z', '#ffb347', 1.5) + F('M18 13h13l.5 2H17.5Z', '#ffe08a') + glint(9, 9, 5.5, '#ffe45c') + glint(41, 8, 4, '#ffe45c'),
  outfitting: () => {
    const th = '#d9534a', wd = '#c9a36b';
    return B('M9 28h16v14H9Z', th, F('M9 28h4v14H9Z', lighten(th, 0.3)) + O('M9 32.5h16M9 37.5h16', 1.1, shade(th, 0.6))) +
      P('M6 24h22v5H6Z', wd, 1.5) + P('M6 41h22v5H6Z', shade(wd, 0.8), 1.5) +
      O('M25 33c8 2 12-4 9-10', 3) + O('M25 33c8 2 12-4 9-10', 1.3, th) +
      L('M27 27L43 4', lighten(STEEL, 0.3), 2.4) + C(41.6, 6, 0.9, OL, 0);
  },
  alchemy: () => {
    const c = '#9aa5ae';
    return L('M27 21L39 6', '#c9a36b', 4.6) + C(40, 5, 3.2, lighten('#c9a36b', 0.2)) +
      E(24, 22, 17, 4.2, shade(c, 0.6)) + E(22, 22.5, 9, 2.2, '#7fc94a', 0) +
      B('M6 22c6 3 30 3 36 0 0 10-6 17-13 19v3H19v-3C12 39 6 32 6 22Z', c, F('M6 22c2 1 4 1.5 7 2 0 7 3 13 8 17h-2C12 39 6 32 6 22Z', lighten(c, 0.35)) + F('M42 22c0 10-6 17-13 19v3h-4c8-4 12-11 13-21 2 0 3-.5 4-1Z', shade(c, 0.66)));
  },
};
/** A trade skill, by its name in `SKILLS`. */
export function skillIcon(skill: string): string {
  return memo(`skill:${skill}`, () => own(SKILL_DRAW, skill)?.());
}

// ----------------------------------------------------------------- stations
const bottle = (d: string, col: string, hi: string, cork: string): string => P(cork, CORK, 1.3) + B(d, col, F(hi, lighten(col, 0.5)));
const STATION_DRAW: Record<string, () => string> = {
  forge: () => flame(24, 24, 1, true) + anvil(1, 8),
  workshop: () => {
    const saw = rot(45, B('M20 3l8 2 2.5 2-2.5 2 2.5 2-2.5 2 2.5 2-2.5 2 2.5 2-2.5 2 2.5 2-2.5 2 2.5 2-2.5 2 2.5 2-2.5 2v2h-8Z', '#c9d1d8', F('M20 3l3 .8V33h-3Z', '#f0f3f6')) +
      P('M16 32h16v6c0 5-3 9-8 9s-8-4-8-9Z', WOOD) + P('M21 36h6v4a3 3 0 0 1-6 0Z', '#3a2a1c', 1.2));
    const mallet = rot(-45, P('M22 18h4v29h-4Z', '#c9a36b') +
      B('M14 5h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', '#b0844f', F('M12 6h24v4H12Z', lighten('#b0844f', 0.3)) + F('M12 15h24v4H12Z', shade('#b0844f', 0.7))) +
      O('M17 5v14M31 5v14', 1.3, shade('#b0844f', 0.5)));
    return saw + mallet;
  },
  apothecary: () => P('M2 39h44v5.5H2Z', WOOD) + F('M2.9 39.9h42.2v1.6H2.9Z', lighten(WOOD, 0.3)) +
    bottle('M10 13h6v7c4 2 6 5 6 9 0 6-4 10-9 10S4 35 4 29c0-4 2-7 6-9Z', '#e2504a', 'M7 28c0-2 1-4 3-5-.5 3-.5 6 .5 9-2 0-3.5-2-3.5-4Z', 'M10 9h6v4h-6Z') +
    bottle('M22 8h6v7l3 4v20H19V19l3-4Z', '#7fc94a', 'M21 21h2.5v15H21Z', 'M22 4h6v4h-6Z') +
    bottle('M35 20h6v4h3v15H32V24h3Z', '#6fb7ff', 'M34 26h2.5v10H34Z', 'M35 16h6v4h-6Z'),
};
/** A town station: forge, workshop or apothecary. */
export function stationIcon(id: StationId): string {
  return memo(`station:${id}`, () => own(STATION_DRAW, id)?.());
}

// ------------------------------------------------------------------ grounds
const GROUND_DRAW: Record<string, () => string> = {
  quarry: () => {
    const m = mix('#6f6661', '#7f9db6', 0.18), fl = '#9fbdd6';
    return B('M3 44V31l9-3v-9l11-4V8l13 2 9 9v25Z', m, F('M3 31l9-3v-9l11-4V8l5 .8V18l-10 3v10l-9 3v10H3Z', lighten(m, 0.24)) + F('M36 10l9 9v25H34V21Z', shade(m, 0.62)) +
      O('M12 28l7 3M23 15l5 3', 1.1, shade(m, 0.45)) +
      [[16, 36, 0], [26, 28, 1], [29, 39, 1], [40, 31, 2], [31, 15, 1], [9, 40, 0], [39, 21, 2]].map(([x, y, z]) => at(x, y, F(BEAN, z === 2 ? shade(fl, 0.7) : z ? fl : lighten(fl, 0.3)), -35)).join(''));
  },
  grove: () => {
    const g = '#5f9a45';
    return P('M20.5 28h7l1.5 16h-10Z', '#6b4a2a') + F('M25 29h2.5l1 14h-3Z', '#4a3219') +
      B('M24 3c6 0 10 3 11 8 5 1 8 5 8 10 0 6-5 10-11 10-2 2-5 3-8 3s-6-1-8-3C10 31 5 27 5 21c0-5 3-9 8-10 1-5 5-8 11-8Z', g,
        F('M24 3c-6 0-10 3-11 8-5 1-8 5-8 10 0 3 1 5 3 7 0-5 3-9 8-10 1-5 5-8 10-8 3 0 6 1 8 3-1-6-5-10-10-10Z', lighten(g, 0.28)) +
        F('M43 21c0 6-5 10-11 10-2 2-5 3-8 3s-6-1-8-3c9 2 20-2 26-14 1 1 1 3 1 4Z', shade(g, 0.68))) +
      P('M9 45c-4 0-6-4-3-7-1-4 3-6 6-4 3-1 6 2 4 5 2 3 0 6-3 6Z', lighten(g, 0.1), 1.4) + P('M38 45c-3 0-5-3-3-5 0-3 3-4 5-3 3 0 4 3 3 5 1 2-1 3-5 3Z', shade(g, 0.82), 1.4);
  },
  marsh: () => {
    const w = '#3f7f8a', r = '#b8c95a', hd = '#7a5230';
    return P('M26 40c5-6 9-14 9-24-5 6-8 13-11 22Z', shade(r, 0.8), 1.4) + L('M16 40V6', r, 2.2) + L('M29 40L32 12', r, 2.2) + L('M16 11v12', hd, 5) + L('M31.3 17l-1 10', hd, 5) +
      B('M2 37c5-3 9-3 14 0s9 3 14 0 10-3 16 0v8H2Z', w, F('M2 37c5-3 9-3 14 0s9 3 14 0 10-3 16 0v2.5c-6-3-11-3-16 0s-9 3-14 0-9-3-14 0Z', lighten(w, 0.35))) +
      E(39, 41.5, 4.6, 1.9, '#7bb661', 1.2);
  },
};
/** A ground: quarry, grove or marsh. */
export function groundIcon(ground: Ground): string {
  return memo(`ground:${ground}`, () => own(GROUND_DRAW, ground)?.());
}

// ------------------------------------------------------------------ enemies
// Seen from above with the head up. Plates and points; eyes are dots.
const EYE = '#ffe9a8';
const ENEMY_DRAW: Record<EnemyKind, (c: string) => string> = {
  swarm: (c) => {
    const leg = shade(c, 0.6);
    return L('M17 23L7 17M16 29H5M17 35l-9 7M31 23l10-6M32 29h11M31 35l9 7', leg, 2.2, 1.1) + L('M21 9C19 5 16 3 12 3M27 9c2-4 5-6 9-6', leg, 1.8, 1) +
      B('M24 16c7 0 11 6 11 14s-5 14-11 14-11-6-11-14 4-14 11-14Z', c, F('M35 30c0 8-5 14-11 14-3 0-6-2-8-4 8 1 14-4 15-14 2 1 4 2 4 4Z', shade(c, 0.74)) + O('M24 18v26', 1.2, shade(c, 0.5))) +
      P('M16 13c0-4 4-6 8-6s8 2 8 6c0 5-4 7-8 7s-8-2-8-7Z', shade(c, 0.78)) + P('M20 8l-3-5 5 3Z', BONE, 1.2) + P('M28 8l3-5-5 3Z', BONE, 1.2) +
      C(20, 13, 1.9, EYE, 0) + C(28, 13, 1.9, EYE, 0);
  },
  shield: (c) => {
    const leg = shade(c, 0.55);
    return L('M9 22l-6-4M7 31H2M10 39l-5 4M39 22l6-4M41 31h5M38 39l5 4', leg, 2.6, 1.1) +
      B('M24 10c11 0 18 8 18 18 0 9-8 17-18 17S6 37 6 28c0-10 7-18 18-18Z', c, F('M42 28c0 9-8 17-18 17-5 0-9-2-12-5 12 2 22-3 26-16 2 1 4 2 4 4Z', shade(c, 0.72)) +
        O('M7 26c10 5 24 5 34 0M8 34c10 5 22 5 32 0M24 20v25', 1.4, shade(c, 0.48))) +
      P('M8 17C11 5 37 5 40 17c-4 4-10 6-16 6S12 21 8 17Z', lighten(c, 0.32)) + F('M12 17c4 3 8 4 12 4s8-1 12-4c1 0 2 0 3 .5-4 3.5-9 5-15 5s-11-1.5-15-5c1-.5 2-.5 3-.5Z', c) +
      P('M21 9l3-7 3 7Z', BONE, 1.3) + C(17, 14, 1.8, OL, 0) + C(31, 14, 1.8, OL, 0) + C(24, 15, 1.4, OL, 0);
  },
  burrower: (c) => {
    const dirt = '#6b5038';
    return P('M14 25L3 20l2 11 9 2Z', BONE, 1.5) + P('M34 25l11-5-2 11-9 2Z', shade(BONE, 0.85), 1.5) +
      B('M14 40V20c0-9 4-15 10-15s10 6 10 15v20Z', c, F('M34 20v20h-6c2-10 2-22-1-34 4 2 7 7 7 14Z', shade(c, 0.74)) + O('M14 22c6 3 14 3 20 0M14 30c6 3 14 3 20 0', 1.4, shade(c, 0.5))) +
      P('M20 10c-4-1-6-4-6-8 4 1 7 3 8 7Z', BONE, 1.3) + P('M28 10c4-1 6-4 6-8-4 1-7 3-8 7Z', BONE, 1.3) + C(20, 15, 1.7, OL, 0) + C(28, 15, 1.7, OL, 0) +
      B('M2 45c2-7 8-10 22-10s20 3 22 10Z', dirt, F('M5 43c3-4 9-6 19-6-7 1-12 3-15 6Z', lighten(dirt, 0.25))) + C(12, 41, 1.3, lighten(dirt, 0.4), 0) + C(33, 40, 1.6, lighten(dirt, 0.4), 0) + C(39, 43, 1, lighten(dirt, 0.4), 0);
  },
  spitter: (c) => {
    const leg = shade(c, 0.55), pus = lighten(c, 0.4);
    return L('M13 26l-8-4M11 33H3M14 40l-7 5M35 26l8-4M37 33h8M34 40l7 5', leg, 2.4, 1.1) +
      drop(24, 6.5, 0.62, pus, 1.2) + C(17.5, 4, 1.4, pus, 1) + C(30.5, 4, 1.4, pus, 1) +
      B('M24 19c9 0 14 6 14 13s-6 13-14 13-14-6-14-13 5-13 14-13Z', c, F('M38 32c0 7-6 13-14 13-4 0-8-2-10-4 10 1 18-3 20-13 2 1 4 2 4 4Z', shade(c, 0.72))) +
      C(18, 34, 3, pus, 1.2) + C(28, 38, 2.2, pus, 1.1) + C(30, 28, 2.6, pus, 1.2) + C(19, 26, 1.5, pus, 1) +
      P('M15 17c0-5 4-8 9-8s9 3 9 8c0 4-4 7-9 7s-9-3-9-7Z', shade(c, 0.8)) + E(24, 13.5, 3.6, 2.8, '#1c2a10', 1.2) +
      C(18, 18.5, 1.7, OL, 0) + C(30, 18.5, 1.7, OL, 0);
  },
  charger: (c) => {
    const leg = shade(c, 0.55);
    return L('M14 30L5 37M14 37l-7 8M34 30l9 7M34 37l7 8', leg, 2.6, 1.1) +
      B('M24 15c8 0 13 7 13 15s-5 15-13 15-13-7-13-15 5-15 13-15Z', c, F('M37 30c0 8-5 15-13 15-4 0-7-2-9-4 9 0 16-5 18-15 2 1 4 2 4 4Z', shade(c, 0.72)) +
        O('M15 32l9 5 9-5M17 39l7 4 7-4', 1.4, shade(c, 0.5))) +
      P('M15 21c0-6 4-10 9-10s9 4 9 10c0 4-4 6-9 6s-9-2-9-6Z', shade(c, 0.8)) +
      P('M16 18C11 17 8 13 7 8c5 0 9 2 11 6Z', BONE, 1.4) + P('M32 18c5-1 8-5 9-10-5 0-9 2-11 6Z', shade(BONE, 0.85), 1.4) + P('M20 15c-1-5 0-10 4-14 4 4 5 9 4 14Z', BONE) +
      C(19.5, 21.5, 1.8, OL, 0) + C(28.5, 21.5, 1.8, OL, 0);
  },
  bomber: (c) => {
    const leg = shade(c, 0.5);
    return L('M11 25l-7-3M10 33H3M37 25l7-3M38 33h7', leg, 2.2, 1.1) + L('M21 6l-3-4M27 6l3-4', leg, 1.8, 1) +
      C(24, 29, 15.5, c) + C(24, 30, 10.5, '#ffd34d', 0) + C(24, 30, 6, '#ff8a3c', 0) + C(24, 30, 2.6, '#fff3b0', 0) +
      O('M24 14v6M11 23l5 3M37 23l-5 3M14 40l4-4M34 40l-4-4', 1.3, '#d9a030') + O(circ(24, 29, 15.5)) +
      P('M17 10c0-4 3-6 7-6s7 2 7 6c0 4-3 6-7 6s-7-2-7-6Z', shade(c, 0.66)) + C(21, 10, 1.6, OL, 0) + C(27, 10, 1.6, OL, 0);
  },
  brute: (c) => P('M14 34h8v11h-8Z', shade(c, 0.62)) + P('M26 34h8v11h-8Z', shade(c, 0.52)) +
    P('M10 17L6 8l9 4Z', BONE, 1.4) + P('M38 17l4-9-9 4Z', shade(BONE, 0.85), 1.4) +
    B('M5 29c0-10 8-17 19-17s19 7 19 17v8H5Z', c, F('M5 29c0-10 8-17 19-17-9 3-13 10-13 20v5H5Z', lighten(c, 0.16)) + F('M43 29v8H31c5-5 7-12 5-21 4 3 7 8 7 13Z', shade(c, 0.7)) +
      O('M17 30h14M19 34h10', 1.3, shade(c, 0.5))) +
    C(9, 36, 7.5, lighten(c, 0.14)) + C(39, 36, 7.5, shade(c, 0.8)) +
    P('M18 6h12v11c0 3-3 5-6 5s-6-2-6-5Z', shade(c, 0.66)) + F('M20 11h3.5v2.5H20ZM24.5 11H28v2.5h-3.5Z', '#ffe45c') + P('M21 22l1-4 2 3 2-3 1 4Z', BONE, 1),
  boss: () => {
    const c = '#e4dccb';
    return P('M14 37c-4 4-4 8-1 11 2-4 6-6 9-7Z', BONE, 1.5) + P('M34 37c4 4 4 8 1 11-2-4-6-6-9-7Z', shade(BONE, 0.82), 1.5) +
      P('M8 22L2 14l9 2Z', shade(c, 0.7), 1.4) + P('M40 22l6-8-9 2Z', shade(c, 0.6), 1.4) +
      B('M7 27c0-8 7-13 17-13s17 5 17 13v6c0 7-7 11-17 11S7 40 7 33Z', c, F('M41 27v6c0 7-7 11-17 11-5 0-9-1-12-3 12 0 21-5 23-19 3 1 6 3 6 5Z', shade(c, 0.72)) +
        O('M24 34v9M17 37v5M31 37v5', 1.2, shade(c, 0.5))) +
      F('M11 25l10 3-2 6-8-3ZM37 25l-10 3 2 6 8-3Z', '#2a1418') + C(16.5, 29, 1.8, '#ff4a3a', 0) + C(31.5, 29, 1.8, '#ff4a3a', 0) +
      B('M10 17L8 3l8 6 8-7 8 7 8-6-2 14Z', GOLD, F('M10 17L8 3l8 6 8-7v15Z', lighten(GOLD, 0.35))) + P('M9.5 15h29v4h-29Z', shade(GOLD, 0.8), 1.3) +
      C(24, 11, 2.2, '#e2504a', 1) + C(15.5, 12.5, 1.5, '#4fd0ff', 0.9) + C(32.5, 12.5, 1.5, '#4fd0ff', 0.9);
  },
};
/** An enemy head-and-back portrait in its arena colour. */
export function enemyIcon(kind: EnemyKind): string {
  return memo(`enemy:${kind}`, () => own(ENEMY_DRAW, kind)?.(CFG.enemies[kind]?.color ?? '#c0392b'));
}

// ---------------------------------------------------------------- interface
const qmark = (col: string): string => L('M17 19c0-9 14-9 14-1 0 5-7 5-7 11', col, 4.4, 0) + C(24, 37, 2.8, col, 0);
const UI_DRAW = {
  coin: () => C(24, 24, 19, GOLD, GW) + F('M7 28c2 8 9 14 17 14 7 0 14-5 16-12-4 5-10 8-16 8-7 0-13-4-17-10Z', shade(GOLD, 0.72)) + O(circ(24, 24, 13.5), 1.6, shade(GOLD, 0.6)) +
    F('M24 15l6.5 9-6.5 9-6.5-9Z', shade(GOLD, 0.6)),
  scrap: () => MOD_DRAW.scrap(),
  weight: () => GL(circ(24, 10, 5), '#aab4bd', 3.4) + G('M14 16h20l8 28H6Z', '#aab4bd') + F('M14 16h6l-6 28H6Z', '#d5dbe0') + O('M14 16h20l8 28H6Z', GW),
  heat: () => flame(24, 34.5, 1.52, true, GW, '#ff6a3c'),
  health: () => G(HEART, '#e2504a'),
  stamina: () => G(BOLT, '#7fe07a'),
  lock: () => O('M15 22v-7a9 9 0 0 1 18 0v7', 7.6) + O('M15 22v-7a9 9 0 0 1 18 0v7', 3.6, '#c9d1d8') + G('M11 21h26a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V24a3 3 0 0 1 3-3Z', GOLD) +
    F('M24 28a3 3 0 0 1 1.5 5.5V38h-3v-4.5A3 3 0 0 1 24 28Z', OL),
  unlock: () => O('M15 22v-9a9 9 0 0 1 17-4', 7.6) + O('M15 22v-9a9 9 0 0 1 17-4', 3.6, '#c9d1d8') + G('M11 21h26a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V24a3 3 0 0 1 3-3Z', '#8fd66a') +
    F('M24 28a3 3 0 0 1 1.5 5.5V38h-3v-4.5A3 3 0 0 1 24 28Z', OL),
  star: () => G(star(24, 25.5, 22, 9, 5), '#ffd34d'),
  key: () => rot(-45, G('M22 20h24v8h-4v8h-6v-8h-3v6h-6v-6h-5Z', GOLD) + G(circ(13, 24, 11.5) + circ(13, 24, 4.2), GOLD, EVENODD)),
  standing: () => G('M8 3h5v42H8Z', '#c9a36b') + G('M13 6h30l-8 10 8 10H13Z', '#5f9be0') + F('M14.4 7.4h13v17.2h-13Z', '#8fbcf0'),
  codex: () => G('M8 6h27c3 0 5 2 5 5v33H12c-2 0-4-2-4-4Z', '#a3523f') + F('M11 38h27.6v4.6H12c-1 0-2-1-2-2 0-1.5 0-2.6 1-2.6Z', PARCH) +
    O('M9 38h30', 1.6) + F('M24 13l7 8.5-7 8.5-7-8.5Z', GOLD) + F('M13.5 7.4h3v29.2h-3Z', shade('#a3523f', 0.7)),
  vault: () => G('M9 5h30a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z', '#8f9aa6') + F('M6.4 9a2.6 2.6 0 0 1 2.6-2.6h6v35.2H9a2.6 2.6 0 0 1-2.6-2.6Z', '#b9c2cc') +
    C(25, 24, 10.5, '#5c646d', 2) + O('M25 13.5v21M14.5 24h21M17.6 16.6l14.8 14.8M32.4 16.6L17.6 31.4', 2.2, '#c9d1d8') + C(25, 24, 3.4, GOLD, 1.6),
  check: () => GL('M8 25l10 10L40 12', '#6fd66a', 6.4),
  cross: () => GL('M11 11l26 26M37 11L11 37', '#e2504a', 6.4),
  plus: () => G('M19 6h10v13h13v10H29v13H19V29H6V19h13Z', UI),
  minus: () => G('M6 19h36v10H6Z', UI),
  'arrow-right': () => G('M4 17h21V7l19 17-19 17V31H4Z', UI),
  search: () => GL('M30 30l13 13', '#c9a36b', 5.6) + C(20, 20, 13.5, '#bfe6f5', GW) + C(20, 20, 13.5, 'none', 0) + O(circ(20, 20, 13.5), 7.4) + O(circ(20, 20, 13.5), 3.4, UI) + O('M13 19c1-4 3-6 7-7', 2, '#ffffff'),
  sort: () => G('M4 7h22v7H4Z', UI) + G('M4 20.5h16v7H4Z', UI) + G('M4 34h10v7H4Z', UI) + G('M32 6h8v20h6L36 42 26 26h6Z', '#9fd0ff'),
  filter: () => G('M3 6h42L29 25v18l-10-6V25Z', UI),
  equip: () => G('M5 23h8v13h22V23h8v21H5Z', UI) + G('M19 3h10v12h8L24 31 11 15h8Z', '#8fd66a'),
  dismantle: () => G('M5 9h18l-5 11 7 6-6 14H5Z', '#c9a36b') + G('M30 6h13v32H26l7-14-7-6Z', shade('#c9a36b', 0.8)) + P(star(9, 43, 3.5, 3.5, 3), '#c9a36b', 1.6),
  compare: () => O('M10 11L5 27M10 11l5 16M38 11l-5 16M38 11l5 16', 3.2) + O('M10 11L5 27M10 11l5 16M38 11l-5 16M38 11l5 16', 1.2, UI) +
    G('M21.5 6h5v33h-5Z', UI) + G('M5 8h38v5H5Z', UI) + G('M13 39h22v5H13Z', UI) + G('M2 27h16c0 5-3 8-8 8s-8-3-8-8Z', '#9fd0ff') + G('M30 27h16c0 5-3 8-8 8s-8-3-8-8Z', '#9fd0ff'),
  'gear-score': () => G('M24 2l22 22-22 22L2 24Z', '#4f86d9') + F('M24 4.8L4.8 24 24 43.2Z', '#7fb0f0') + GL('M14 29l10-10 10 10', '#ffffff', 4) ,
  timer: () => G('M20 2h8v6h-8Z', UI) + G('M37 9l4 4-3.5 3.5-4-4Z', UI) + C(24, 27, 17, '#f4f1e8', GW) + O('M24 27V16M24 27h8', 3, OL) + C(24, 27, 2, OL, 0),
  skull: () => G('M24 3c11 0 19 7 19 17 0 6-3 10-7 13v10H12V33c-4-3-7-7-7-13C5 10 13 3 24 3Z', BONE) + E(16, 21, 5, 5.5, OL, 0) + E(32, 21, 5, 5.5, OL, 0) +
    F('M24 26l3 6h-6Z', OL) + O('M19 37v6M24 37v6M29 37v6', 2),
  chest: () => G('M5 21c0-8 5-13 12-13h14c7 0 12 5 12 13v2H5Z', '#a9713f') + G('M5 22h38v21H5Z', '#8a5a34') + F('M12 9.5h4.5V42H12ZM31.5 9.5H36V42h-4.5Z', GOLD) +
    O('M5 22h38', GW) + P('M20 18h8v10h-8Z', GOLD, 1.8) + C(24, 23, 1.7, OL, 0),
  shrine: () => G('M9 44V21L24 5l15 16v23h-8V29a7 7 0 0 0-14 0v15Z', '#9aa5ae') + F('M10.4 43V21.5L24 7v6L15 22v21Z', '#c4ccd3') + G('M4 42h40v4H4Z', '#7c8791') +
    P('M24 27l5 7-5 8-5-8Z', '#6fe0f0', 1.8) + F('M24 27l-5 7 5 8Z', '#d3f7ff'),
  route: () => G('M21.5 4h5v41h-5Z', '#c9a36b') + G('M11 7h24l9 7-9 7H11Z', '#d9b27a') + G('M37 24H13l-9 7 9 7h24Z', shade('#d9b27a', 0.8)),
  pause: () => G('M9 6h11v36H9Z', UI) + G('M28 6h11v36H28Z', UI),
  'sound-on': () => G('M3 17h9L24 6v36L12 31H3Z', UI) + GL('M31 17c4 4 4 10 0 14M36 10c8 8 8 20 0 28', UI, 3.4),
  'sound-off': () => G('M3 17h9L24 6v36L12 31H3Z', UI) + GL('M31 17l13 14M44 17L31 31', '#e2504a', 4.4),
  settings: () => G(gear(24, 24, 22, 16, 8) + circ(24, 24, 7), '#c9d1d8', EVENODD),
  help: () => C(24, 24, 20.5, '#4f86d9', GW) + qmark('#ffffff'),
  back: () => G('M20 5L3 20l17 15v-9h8c4 0 7 2 7 6s-3 6-7 6h-7v8h7c9 0 15-6 15-14s-6-14-15-14h-8Z', UI),
  close: () => C(24, 24, 20.5, '#3a414b', GW) + L('M16 16l16 16M32 16L16 32', UI, 4.6, 0),
  // asked for by the run screens
  craft: () => at(1, 8, P(ANVIL, '#aab4bd', GW) + F('M16 13h26v3H13c1-1 2-2 3-3Z', '#d5dbe0') + O(ANVIL, GW)) + P(star(24, 10, 9, 3, 4), '#ffe45c', 2) + P(star(9, 9, 5, 1.7, 4), '#ffe45c', 1.6) + P(star(40, 8, 5, 1.7, 4), '#ffe45c', 1.6),
  level: () => G('M24 3l19 19H31l-7-7-7 7H5ZM24 23l19 19H31l-7-7-7 7H5Z', '#ffd34d'),
  bag: () => G('M16 14c2-3 1-7-1-10 3 2 6 2 9 0 3 2 6 2 9 0-2 3-3 7-1 10Z', '#a8854f') + G('M16 14c-7 6-12 13-12 21 0 7 6 10 20 10s20-3 20-10c0-8-5-15-12-21Z', '#c9a36b') +
    G('M14 12h20v4.5H14Z', '#efe0b8'),
  wave: () => G('M3 43C3 25 12 9 27 9c9 0 16 6 16 14 0 6-4 10-9 10-4 0-7-3-7-6 0-2 1-4 3-5-6 0-10 4-10 9 0 7 6 12 22 12Z', '#6fb7ff') +
    F('M6 41c1-14 8-26 19-29-8 5-13 15-14 29Z', '#b9dcff'),
  reroll: () => GL('M9 22A15 15 0 0 1 35 14', UI, 4.6) + G('M42 4v16H26Z', UI) + GL('M39 26A15 15 0 0 1 13 34', UI, 4.6) + G('M6 44V28h16Z', UI),
  merge: () => G('M24 3l12 13h-8v8c0 3 2 5 5 6l10 3-2.5 7-10-3c-3-1-5-3-6.5-5-1.5 2-3.5 4-6.5 5l-10 3L5 33l10-3c3-1 5-3 5-6v-8h-8Z', '#ffb347'),
  sell: () => GL('M36 12c4-6 7-7 9-6', '#c9a36b', 2.2) + G('M4 26L25 5h18v18L22 44Z', '#8fd66a') + F('M6 26L25 7h8L12 32Z', '#b9ec9f') + C(35, 13, 3.6, OL, 0) +
    C(21, 28, 6.5, GOLD, 1.8),
  warn: () => G('M24 3L46 43H2Z', '#ffd34d') + F('M21.5 16h5l-1 14h-3Z', OL) + C(24, 35.5, 2.7, OL, 0),
  storage: () => G('M6 13h36v31H6Z', '#b0844f') + F('M7.4 14.4h7v28.2h-7Z', '#cfa26a') + O('M12 20l24 18M36 20L12 38', 2.4, shade('#b0844f', 0.6)) + O('M6 13h36v31H6Z', GW) +
    G('M3 5h42v9H3Z', '#cfa26a'),
  speed: () => MOD_DRAW.speed(),
  shield: () => MOD_DRAW.armor(),
} satisfies Record<string, () => string>;
/** Other names people reach for, mapped to the icon that carries the meaning. */
const UI_ALIAS: Record<string, string> = {
  heart: 'health', hp: 'health', arrow: 'arrow-right', next: 'arrow-right', sound: 'sound-on', mute: 'sound-off', clock: 'timer', time: 'timer',
  xp: 'level', armor: 'shield', armour: 'shield', warning: 'warn', alert: 'warn', new: 'star', ok: 'check', deny: 'cross', x: 'close',
  locked: 'lock', gear: 'settings', gs: 'gear-score', crate: 'storage', salvage: 'dismantle',
};
export type UiIconName = keyof typeof UI_DRAW;
export const UI_ICON_NAMES = Object.keys(UI_DRAW) as UiIconName[];
/** Interface glyphs, by name (see `UI_ICON_NAMES`). A few aliases are accepted (heart, arrow, mute, clock, xp...); anything else gives the unknown icon. */
export function uiIcon(name: UiIconName | (string & {})): string {
  const draw = UI_DRAW as Record<string, (() => string) | undefined>;
  return memo(`ui:${name}`, () => (own(draw, name) ?? own(draw, own(UI_ALIAS, name) ?? ''))?.());
}
