// Drops on the ground. Each material category has its own small shape, so a drop is told apart by form
// and not by colour alone: ore chunk, log, herb sprig, creature bit. Parts of elites and bosses are larger,
// sit on a gold star and glow.
import { MATS } from '../data';
import type { Game } from '../game';
import { INK, blit, cache, inked, mix, poly, rgba, rng, roundPoly, shade, smooth, sprite, type Ctx, type Pt, type Sprite } from './util';
import { glow } from './fx';

const sprites = cache<Sprite>();
const OW = 1;

function oreChunk(c: Ctx, col: string, seed: number): void {
  const rnd = rng(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 6.28 + (rnd() - 0.5) * 0.5;
    const r = 5.2 + rnd() * 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.85]);
  }
  const p = roundPoly(pts, 1.2);
  const rock = mix('#7d7570', col, 0.22);
  inked(c, p, rock, OW);
  c.save();
  c.clip(p);
  c.fillStyle = rgba(shade(rock, 0.66), 0.8);
  c.fill(poly([[8, -2], [8, 8], [-3, 8]]));
  // three bean flecks of the metal
  c.fillStyle = col;
  for (const [x, y] of [[-2.6, -1.6], [1.6, 0.4], [-1, 2.8]]) {
    c.beginPath();
    c.ellipse(x, y, 2.3, 1.25, -0.6, 0, 6.28);
    c.fill();
  }
  c.restore();
}

function log(c: Ctx, col: string): void {
  // a short cylinder lying on a diagonal, the cut end showing the wood's colour
  c.save();
  c.rotate(-0.7);
  const bark = '#6a4a22';
  const p = roundPoly([[-7, -3.4], [6, -3.4], [6, 3.4], [-7, 3.4]], 2.6);
  inked(c, p, bark, OW);
  c.fillStyle = shade(bark, 0.7);
  c.fillRect(-6.5, 1, 12, 2.2);
  const end = new Path2D();
  end.ellipse(-6.4, 0, 2.5, 3.5, 0, 0, 6.28);
  inked(c, end, col, OW * 0.8);
  c.strokeStyle = rgba(shade(col, 0.6), 0.9);
  c.lineWidth = 0.7;
  c.beginPath();
  c.ellipse(-6.4, 0, 1.1, 1.7, 0, 0, 6.28);
  c.stroke();
  c.restore();
}

function sprig(c: Ctx, col: string): void {
  const stem = '#5f6b3a';
  c.strokeStyle = INK;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-4.5, 7);
  c.quadraticCurveTo(-1, 2, 1.5, -3);
  c.stroke();
  c.strokeStyle = stem;
  c.lineWidth = 1.4;
  c.stroke();
  const leaf = (x: number, y: number, a: number): Path2D => {
    const p = new Path2D();
    p.ellipse(x, y, 3.8, 1.7, a, 0, 6.28);
    return p;
  };
  inked(c, leaf(-5, 2.2, -0.5), stem, OW * 0.8);
  inked(c, leaf(1.6, 3, 0.7), shade(stem, 1.15), OW * 0.8);
  const head = new Path2D();
  head.arc(2.6, -4.2, 3.9, 0, 6.28);
  inked(c, head, col, OW);
  c.fillStyle = shade(col, 1.3);
  c.beginPath();
  c.arc(1.7, -5.2, 1.4, 0, 6.28);
  c.fill();
}

function bit(c: Ctx, id: string, col: string): void {
  if (id === 'hide') {
    inked(c, smooth([[-6.5, -4], [-2, -6], [0, -3.6], [3, -6], [6.5, -3], [5, 0], [6.5, 4], [2, 5.6], [0, 3.6], [-3, 6], [-6.5, 3.4], [-5, 0]]), col, OW);
    c.fillStyle = rgba(shade(col, 0.72), 0.8);
    c.beginPath();
    c.ellipse(0.5, 0.5, 2.6, 1.8, 0.3, 0, 6.28);
    c.fill();
  } else if (id === 'sinew') {
    const p = new Path2D();
    p.moveTo(-5.5, 3.5);
    p.bezierCurveTo(-5, -5.5, 0, 5.5, 5.5, -3.5);
    c.lineCap = 'round';
    c.strokeStyle = INK;
    c.lineWidth = 5.2;
    c.stroke(p);
    c.strokeStyle = col;
    c.lineWidth = 3.2;
    c.stroke(p);
  } else if (id === 'bonedust') {
    const p = new Path2D();
    for (const [x, y, r] of [[-4.4, 3, 2.3], [-3, 4.6, 2.3], [4.4, -3, 2.3], [3, -4.6, 2.3]]) {
      p.moveTo(x + r, y);
      p.arc(x, y, r, 0, 6.28);
    }
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.stroke(p);
    c.lineCap = 'round';
    c.lineWidth = 4.6;
    c.beginPath();
    c.moveTo(-3.4, 3.4);
    c.lineTo(3.4, -3.4);
    c.stroke();
    c.fillStyle = col;
    c.fill(p);
    c.strokeStyle = col;
    c.lineWidth = 2.6;
    c.stroke();
  } else if (id === 'ash') {
    inked(c, smooth([[-7, 4.5], [-4, 0], [-1, -4.5], [2, -2], [4, -3], [7, 4.5]]), col, OW);
    c.fillStyle = rgba('#3f3f3f', 0.8);
    for (const [x, y] of [[-2, 1.5], [1.5, 0], [3.5, 2.6], [-4, 3.2]]) c.fillRect(x, y, 1.3, 1.3);
  } else if (id === 'shard') {
    inked(c, poly([[0, -7.5], [4, -1], [1.6, 7.5], [-3.6, 1.6]]), col, OW);
    c.fillStyle = '#f2fbff';
    c.fill(poly([[0, -7.5], [0.4, 0], [-3.6, 1.6]]));
  } else {
    const p = new Path2D();
    p.arc(0, 0, 5, 0, 6.28);
    inked(c, p, col, OW);
  }
}

function part(c: Ctx, col: string): void {
  // a gold eight-pointed star with the part's own colour set in it
  const pts: Pt[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 6.283 - Math.PI / 2;
    const r = i % 2 ? 6.8 : 12.5;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  inked(c, poly(pts), '#ffd34d', 1.4);
  const gem = new Path2D();
  gem.arc(0, 0, 6.2, 0, 6.28);
  const g = c.createRadialGradient(-1.6, -1.8, 0.5, 0, 0, 6.5);
  g.addColorStop(0, shade(col, 1.35));
  g.addColorStop(1, col);
  inked(c, gem, g, 1.1);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(-2, -2.2, 1.5, 0, 6.28);
  c.fill();
}

function item(id: string): Sprite {
  let s = sprites.get(id);
  if (s) return s;
  const m = MATS[id];
  const seed = id.charCodeAt(0) * 31 + id.length;
  if (m.cat === 'part') s = sprite(32, 32, 16, 16, (c) => part(c, m.color));
  else {
    s = sprite(22, 22, 11, 11, (c) => {
      if (m.cat === 'ore') oreChunk(c, m.color, seed);
      else if (m.cat === 'wood') log(c, m.color);
      else if (m.cat === 'herb') sprig(c, m.color);
      else bit(c, id, m.color);
    });
  }
  sprites.set(id, s);
  return s;
}

export function drawPickups(c: Ctx, g: Game, time: number): void {
  for (const k of g.pickups) {
    const m = MATS[k.mat];
    if (!m) continue;
    if (m.cat === 'part') {
      const bob = Math.sin(time * 4 + k.x * 0.1) * 2.5;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.6 + 0.25 * Math.sin(time * 7);
      blit(c, glow('#ffd34d'), k.x, k.y, 0, 34 / 64);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      // slow rays
      c.strokeStyle = 'rgba(255,236,170,0.7)';
      c.lineWidth = 1.6;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = time * 1.2 + (i / 6) * 6.283;
        c.moveTo(k.x + Math.cos(a) * 15, k.y + bob + Math.sin(a) * 15);
        c.lineTo(k.x + Math.cos(a) * 22, k.y + bob + Math.sin(a) * 22);
      }
      c.stroke();
      blit(c, item(k.mat), k.x, k.y + bob, 0, 1.1 + 0.06 * Math.sin(time * 7));
    } else blit(c, item(k.mat), k.x, k.y, 0, 1.2);
  }
}
