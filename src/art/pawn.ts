// The player: a pawn made of two rounded blobs (head and body), standing upright in one of four facings,
// with a pick that turns freely to the aim. No enemy stands upright or is this bright, so it is the first
// thing the eye finds. While dodging it is never faded: it gets a pale outline and leaves afterimages.
import { CFG } from '../data';
import type { Game } from '../game';
import { INK, blit, blob, cache, halo, inked, lin, shade, smooth, soft, sprite, tinted, type Ctx, type Sprite } from './util';
import { glow } from './fx';

const U = CFG.player.r * 1.1; // head width: the ruler for the whole figure
const OW = 0.087 * U;
const CLOTH = '#f4f0e3';
const SKIN = '#ffe6c4';
const HELM = '#fbfbf6';
const TRIM = '#2f6fd0'; // the one saturated colour that is the player's alone
const LAMP = '#ffe58a';
const BODY = [0.2, 0.69, 0.78, 0.8, 0.78, 0.74, 0.68, 0.62, 0.58, 0.55, 0.28];
const HEAD = [0.28, 0.68, 0.84, 0.92, 0.92, 0.92, 0.88, 0.8, 0.72, 0.56, 0.28];

type Face = 'S' | 'N' | 'E' | 'W';
const sprites = cache<Sprite>();

function art(c: Ctx, f: Face): void {
  const u = U;
  if (f === 'W') c.scale(-1, 1);
  const side = f === 'E' || f === 'W';
  const bx = side ? 0.04 * u : 0;
  const body = blob(bx, -0.46 * u, 1.41 * u, BODY, OW, side ? 0.85 : 1);
  const head = blob(side ? 0.03 * u : 0, -1.18 * u, 1.09 * u, HEAD, OW, side ? 1.06 : 1);
  let bodyFill: CanvasGradient;
  let headFill: CanvasGradient;
  if (side) {
    bodyFill = lin(c, -0.5 * u, 0, 0.2 * u, 0, shade(CLOTH, 0.76), CLOTH);
    headFill = lin(c, -0.5 * u, 0, 0.15 * u, 0, shade(SKIN, 0.78), SKIN);
  } else if (f === 'N') {
    bodyFill = c.createRadialGradient(0, 0.3 * u, 0.2 * u, 0, 0.3 * u, 0.75 * u);
    bodyFill.addColorStop(0, shade(CLOTH, 0.74));
    bodyFill.addColorStop(1, CLOTH);
    headFill = c.createRadialGradient(0, -0.6 * u, 0.15 * u, 0, -0.6 * u, 0.6 * u);
    headFill.addColorStop(0, shade(SKIN, 0.74));
    headFill.addColorStop(1, SKIN);
  } else {
    bodyFill = soft(c, 0, 0.35 * u, 0.25 * u, 0.85 * u, CLOTH, 0.8);
    headFill = soft(c, 0, -0.5 * u, 0.2 * u, 0.62 * u, SKIN, 0.8);
  }
  inked(c, body, bodyFill, OW);
  // a strap across the chest and a belt, in the player's own blue
  c.save();
  c.clip(body);
  c.strokeStyle = TRIM;
  c.lineWidth = 0.17 * u;
  c.beginPath();
  if (side) {
    c.moveTo(-0.3 * u, -0.3 * u);
    c.lineTo(0.5 * u, 0.5 * u);
  } else {
    c.moveTo(-0.62 * u, -0.38 * u);
    c.lineTo(0.5 * u, 0.62 * u);
  }
  c.moveTo(-0.7 * u, 0.56 * u);
  c.lineTo(0.7 * u, 0.56 * u);
  c.stroke();
  c.restore();
  inked(c, head, headFill, OW);
  if (f === 'S') {
    c.fillStyle = INK;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(s * 0.185 * u, -0.5 * u, 0.065 * u, 0.075 * u, 0, 0, 6.28);
      c.fill();
    }
  } else if (side) {
    c.fillStyle = INK;
    c.beginPath();
    c.ellipse(0.33 * u, -0.5 * u, 0.065 * u, 0.075 * u, 0, 0, 6.28);
    c.fill();
  }
  // the helmet: a half dome with a short brim and a lamp
  const hx = side ? 0.05 * u : 0;
  const dome = new Path2D();
  dome.moveTo(hx - 0.6 * u, -0.72 * u);
  dome.bezierCurveTo(hx - 0.64 * u, -1.45 * u, hx + 0.64 * u, -1.45 * u, hx + 0.6 * u, -0.72 * u);
  if (side) dome.lineTo(hx + 0.82 * u, -0.7 * u);
  dome.closePath();
  const helmFill = f === 'N' ? HELM : lin(c, -0.6 * u, -1.3 * u, 0.5 * u, -0.7 * u, HELM, shade(HELM, 0.84));
  inked(c, dome, helmFill, OW);
  c.save();
  c.clip(dome);
  c.fillStyle = TRIM;
  c.fillRect(-u, -0.86 * u, 2 * u, 0.15 * u);
  c.restore();
  if (f !== 'N') {
    const lx = side ? 0.5 * u : 0;
    inked(c, smooth([[lx - 0.13 * u, -0.98 * u], [lx + 0.13 * u, -0.98 * u], [lx + 0.13 * u, -0.74 * u], [lx - 0.13 * u, -0.74 * u]]), LAMP, OW * 0.6);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(lx, -0.86 * u, 0.05 * u, 0, 6.28);
    c.fill();
  }
}

function pawn(f: Face, v: '' | 'white' | 'ghost' | 'halo'): Sprite {
  const key = f + v;
  let s = sprites.get(key);
  if (s) return s;
  if (v === '') s = sprite(U * 2.6, U * 3, U * 1.3, U * 1.7, (c) => art(c, f));
  else if (v === 'white') s = tinted(pawn(f, ''), '#ffffff');
  else if (v === 'ghost') s = tinted(pawn(f, ''), '#bfeeff');
  else s = halo(pawn(f, ''), '#c9f4ff', 2.2);
  sprites.set(key, s);
  return s;
}

function faceOf(ax: number, ay: number): Face {
  if (Math.abs(ax) > Math.abs(ay) * 1.15) return ax > 0 ? 'E' : 'W';
  return ay > 0 ? 'S' : 'N';
}

/** The pick: wooden haft, bright steel head. Drawn pointing along +x from the grip. */
function pick(c: Ctx, x: number, y: number, ang: number, flip: boolean): void {
  const L = U * 1.45;
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  if (flip) c.scale(1, -1);
  c.lineCap = 'round';
  c.strokeStyle = INK;
  c.lineWidth = 4.6;
  c.beginPath();
  c.moveTo(U * 0.15, 0);
  c.lineTo(L, 0);
  c.stroke();
  c.strokeStyle = '#a8713f';
  c.lineWidth = 2.4;
  c.stroke();
  const head = smooth([[L - 5, -12.5], [L + 2, -6], [L + 3.6, 0], [L + 2, 6], [L - 5, 12.5], [L - 1.6, 5.5], [L - 1, 0], [L - 1.6, -5.5]]);
  inked(c, head, '#dfe3e6', 1.15);
  c.strokeStyle = '#ffffff';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(L - 1.5, -8.5);
  c.quadraticCurveTo(L + 2.2, -3, L + 2.2, 1);
  c.stroke();
  c.restore();
}

export interface PawnState {
  hurt: number; // seconds left of the hurt flash
  trail: number[]; // x, y, age triples: where the dodge passed
}

/** Under the actors: the reach of the heavy swing while it winds up. */
export function drawCharge(c: Ctx, g: Game): void {
  const p = g.p;
  if (!p.charging) return;
  const pc = CFG.player;
  const ang = Math.atan2(p.ay, p.ax);
  const full = p.charge >= 1;
  c.fillStyle = full ? 'rgba(255,211,77,0.2)' : `rgba(200,210,222,${0.07 + 0.1 * p.charge})`;
  c.beginPath();
  c.moveTo(p.x, p.y);
  c.arc(p.x, p.y, pc.heavyRange, ang - pc.heavyArc, ang + pc.heavyArc);
  c.closePath();
  c.fill();
  c.strokeStyle = full ? 'rgba(255,211,77,0.9)' : 'rgba(220,228,238,0.45)';
  c.lineWidth = full ? 2.4 : 1.4;
  c.beginPath();
  c.arc(p.x, p.y, pc.heavyRange, ang - pc.heavyArc, ang + pc.heavyArc);
  c.stroke();
}

export function drawPlayer(c: Ctx, g: Game, time: number, st: PawnState): void {
  const p = g.p;
  const pc = CFG.player;
  const ang = Math.atan2(p.ay, p.ax);
  const f = faceOf(p.ax, p.ay);
  const bob = p.moving && p.dodgeT <= 0 ? -Math.abs(Math.sin(time * 13)) * 1.6 : 0;
  const x = p.x;
  const y = p.y + bob;

  // a pale pool of light at the feet: wherever the eye lands, this is the brightest spot on the field
  c.globalAlpha = 0.3;
  blit(c, glow('#fff3d6'), p.x, p.y + 6, 0, 46 / 64, 34 / 64);
  c.globalAlpha = 1;

  // afterimages of the dodge
  const gh = pawn(f, 'ghost');
  for (let i = 0; i < st.trail.length; i += 3) {
    const age = st.trail[i + 2];
    c.globalAlpha = Math.max(0, 0.55 * (1 - age / 0.28));
    blit(c, gh, st.trail[i], st.trail[i + 1]);
  }
  c.globalAlpha = 1;

  // the pick's angle: at rest it points where you aim; winding up it goes back; released it sweeps the arc
  let ta = ang;
  if (p.swingT > 0) {
    const k = Math.min(1, (1 - p.swingT / 0.18) * 1.7);
    ta = ang - pc.heavyArc + 2 * pc.heavyArc * k;
  } else if (p.charging) {
    ta = ang - 0.7 - 1.5 * p.charge + (p.charge >= 1 ? Math.sin(time * 60) * 0.05 : 0);
  }
  const gx = x;
  const gy = y + 0.2 * U;
  const behind = Math.sin(ta) < -0.35;
  const flip = Math.cos(ta) < 0;
  if (behind) pick(c, gx, gy, ta, flip);

  if (p.iframes > 0) blit(c, pawn(f, 'halo'), x, y);
  const s = pawn(f, '');
  blit(c, s, x, y);
  if (st.hurt > 0) {
    c.globalAlpha = Math.min(1, st.hurt / 0.12) * 0.85;
    blit(c, pawn(f, 'white'), x, y);
    c.globalAlpha = 1;
  }
  // wounds: one per third of health lost
  const lost = 1 - p.hp / g.spec.maxHp;
  if (lost > 0.34) wound(c, x + 0.22 * U, y + 0.3 * U);
  if (lost > 0.67) wound(c, x - 0.25 * U, y + 0.05 * U);
  if (!behind) pick(c, gx, gy, ta, flip);

  if (p.charging) {
    // the wind-up, as a ring that closes round the pawn
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineWidth = 4.6;
    c.beginPath();
    c.arc(p.x, p.y, pc.r + 7, 0, 6.28);
    c.stroke();
    c.strokeStyle = p.charge >= 1 ? '#ffd34d' : '#d5dde6';
    c.lineWidth = 2.8;
    c.beginPath();
    c.arc(p.x, p.y, pc.r + 7, -Math.PI / 2, -Math.PI / 2 + p.charge * Math.PI * 2);
    c.stroke();
  }
}

function wound(c: Ctx, x: number, y: number): void {
  c.fillStyle = '#fc0204';
  c.beginPath();
  c.arc(x, y, 0.1 * U, 0, 6.28);
  c.fill();
  c.fillStyle = '#a6190e';
  c.beginPath();
  c.arc(x, y, 0.045 * U, 0, 6.28);
  c.fill();
}

/** Over the actors: the heavy swing itself, a filled wedge that only this attack has. */
export function drawSwing(c: Ctx, g: Game): void {
  const p = g.p;
  if (p.swingT <= 0) return;
  const pc = CFG.player;
  const ang = Math.atan2(p.ay, p.ax);
  const k = p.swingT / 0.18;
  const done = Math.min(1, (1 - k) * 1.7);
  c.fillStyle = `rgba(255,255,255,${0.42 * k})`;
  c.beginPath();
  c.moveTo(p.x, p.y);
  c.arc(p.x, p.y, pc.heavyRange, ang - pc.heavyArc, ang - pc.heavyArc + 2 * pc.heavyArc * done);
  c.closePath();
  c.fill();
  c.strokeStyle = `rgba(255,255,255,${0.9 * k})`;
  c.lineWidth = 10 * k + 2;
  c.lineCap = 'butt';
  c.beginPath();
  c.arc(p.x, p.y, pc.heavyRange - 6, ang - pc.heavyArc, ang - pc.heavyArc + 2 * pc.heavyArc * done);
  c.stroke();
  c.lineCap = 'round';
}
