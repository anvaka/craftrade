// Effects: particles, sweeps, rings, ground zones, projectiles. None of them has an outline, so they are
// never mistaken for a creature, a node or a pickup. Hostile things are red or magenta with a hard edge;
// the player's own are in the weapon's colour with a soft edge.
import type { Game, Shot, Zone } from '../game';
import { INK, blit, cache, rgba, sprite, type Ctx, type Sprite } from './util';

const HOSTILE = '#ff3b4e';

// ----------------------------------------------------------- shared sprites

const glows = cache<Sprite>();
/** A soft round glow, 64 units in radius, to scale and add. */
export function glow(color: string): Sprite {
  let s = glows.get(color);
  if (s) return s;
  s = sprite(128, 128, 64, 64, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 64);
    g.addColorStop(0, rgba(color, 0.85));
    g.addColorStop(0.45, rgba(color, 0.35));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(-64, -64, 128, 128);
  }, 1);
  glows.set(color, s);
  return s;
}

const flames = cache<Sprite>();
/** A flame about 34 units tall, origin at its base. Three variants to swap between. */
export function flame(i: number): Sprite {
  const v = ((i % 3) + 3) % 3;
  let s = flames.get(String(v));
  if (s) return s;
  const j = [[0, 0, 0], [2.5, -2, -1.5], [-2, 2, 2.5]][v];
  const path = (w: number, h: number): Path2D => {
    const p = new Path2D();
    p.moveTo(0, 0);
    p.bezierCurveTo(-w * 0.8, 0, -w * 0.75, -h * 0.36, -w * 0.5 + j[0] * 0.4, -h * 0.64 + j[0]);
    p.quadraticCurveTo(-w * 0.3, -h * 0.42, -w * 0.18, -h * 0.5);
    p.quadraticCurveTo(-w * 0.14, -h * 0.8, j[1] * 0.6, -h + j[1]);
    p.quadraticCurveTo(w * 0.16, -h * 0.75, w * 0.2, -h * 0.48);
    p.quadraticCurveTo(w * 0.34, -h * 0.5, w * 0.52 + j[2] * 0.4, -h * 0.7 + j[2]);
    p.bezierCurveTo(w * 0.75, -h * 0.3, w * 0.8, 0, 0, 0);
    p.closePath();
    return p;
  };
  s = sprite(44, 48, 22, 42, (c) => {
    c.shadowColor = '#fcc547';
    c.shadowBlur = 8;
    c.fillStyle = '#ff9232';
    c.fill(path(15, 34));
    c.shadowBlur = 0;
    c.fillStyle = '#fcc547';
    c.fill(path(10, 23));
    c.fillStyle = '#fffc5d';
    c.fill(path(6.5, 15));
  });
  flames.set(String(v), s);
  return s;
}

let hazardSprite: Sprite | null = null;
/** Hostile ground: red stripes inside a hard red ring with spikes. 64 units in radius. */
function hazard(): Sprite {
  if (hazardSprite) return hazardSprite;
  hazardSprite = sprite(160, 160, 80, 80, (c) => {
    c.save();
    c.beginPath();
    c.arc(0, 0, 64, 0, 6.28);
    c.clip();
    c.fillStyle = 'rgba(200,30,48,0.2)';
    c.fillRect(-64, -64, 128, 128);
    c.strokeStyle = 'rgba(255,70,90,0.42)';
    c.lineWidth = 7;
    c.beginPath();
    for (let i = -8; i <= 8; i++) {
      c.moveTo(i * 20 - 70, 70);
      c.lineTo(i * 20 + 70, -70);
    }
    c.stroke();
    c.restore();
    c.strokeStyle = rgba(INK, 0.6);
    c.lineWidth = 6;
    c.beginPath();
    c.arc(0, 0, 64, 0, 6.28);
    c.stroke();
    c.strokeStyle = HOSTILE;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, 64, 0, 6.28);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.283;
      c.moveTo(Math.cos(a) * 66, Math.sin(a) * 66);
      c.lineTo(Math.cos(a) * 74, Math.sin(a) * 74);
    }
    c.stroke();
  }, 2);
  return hazardSprite;
}

let spitSprite: Sprite | null = null;
/** The one look of everything hostile that flies: a dark heart in a hot magenta orb with a pale ring. */
function spitOrb(): Sprite {
  if (spitSprite) return spitSprite;
  spitSprite = sprite(40, 40, 20, 20, (c) => {
    const g = c.createRadialGradient(0, 0, 6, 0, 0, 19);
    g.addColorStop(0, 'rgba(255,61,134,0.75)');
    g.addColorStop(1, 'rgba(255,61,134,0)');
    c.fillStyle = g;
    c.fillRect(-20, -20, 40, 40);
    c.fillStyle = '#fff1f6';
    c.beginPath();
    c.arc(0, 0, 9, 0, 6.28);
    c.fill();
    c.fillStyle = '#ff2d78';
    c.beginPath();
    c.arc(0, 0, 7.4, 0, 6.28);
    c.fill();
    c.fillStyle = '#3a0a22';
    c.beginPath();
    c.arc(0, 0, 3.6, 0, 6.28);
    c.fill();
  }, 3);
  return spitSprite;
}

let fireballSprite: Sprite | null = null;
function fireball(): Sprite {
  if (fireballSprite) return fireballSprite;
  fireballSprite = sprite(64, 36, 46, 18, (c) => {
    const g = c.createRadialGradient(0, 0, 4, 0, 0, 17);
    g.addColorStop(0, 'rgba(255,170,60,0.6)');
    g.addColorStop(1, 'rgba(255,170,60,0)');
    c.fillStyle = g;
    c.fillRect(-18, -18, 36, 36);
    const tear = (len: number, w: number): Path2D => {
      const p = new Path2D();
      p.moveTo(w, 0);
      p.bezierCurveTo(w, w * 1.1, -len * 0.3, w * 0.9, -len, 0);
      p.bezierCurveTo(-len * 0.3, -w * 0.9, w, -w * 1.1, w, 0);
      p.closePath();
      return p;
    };
    c.fillStyle = '#ff8a2e';
    c.fill(tear(40, 9));
    c.fillStyle = '#ffd24a';
    c.fill(tear(22, 6));
    c.fillStyle = '#fffbe0';
    c.fill(tear(9, 3.4));
  }, 3);
  return fireballSprite;
}

// ------------------------------------------------------------------ zones

function hash(z: Zone, i: number): number {
  const v = Math.sin(z.x * 12.9898 + z.y * 78.233 + i * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

/** Ground effects, drawn under everything that stands. */
export function drawZones(c: Ctx, g: Game, time: number): void {
  for (const z of g.zones) {
    if (z.kind === 'supply') {
      c.fillStyle = 'rgba(95,208,122,0.07)';
      c.beginPath();
      c.arc(z.x, z.y, z.r, 0, 6.28);
      c.fill();
      c.setLineDash([10, 8]);
      c.strokeStyle = '#5fd07a';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(z.x, z.y, z.r, 0, 6.28);
      c.stroke();
      c.setLineDash([]);
      c.lineWidth = 6;
      c.beginPath();
      c.arc(z.x, z.y, z.r - 8, -Math.PI / 2, -Math.PI / 2 + (g.supplyT / 10) * Math.PI * 2);
      c.stroke();
    } else if (z.kind === 'blast') {
      // hostile: stripes, a hard ring, and a core that grows as the time to leave runs out
      const k = Math.max(0, Math.min(1, 1 - z.t / 0.7));
      blit(c, hazard(), z.x, z.y, 0, z.r / 64);
      c.fillStyle = rgba(HOSTILE, 0.3 + 0.25 * k);
      c.beginPath();
      c.arc(z.x, z.y, z.r * k, 0, 6.28);
      c.fill();
    } else if (z.kind === 'fire') {
      // the player's burning ground: soft, in the fire's colour
      c.globalAlpha = Math.min(1, z.t / 0.5) * (0.72 + 0.1 * Math.sin(time * 11 + z.x));
      blit(c, glow('#ff8a3c'), z.x, z.y, 0, (z.r * 1.3) / 64);
      c.globalAlpha = 1;
    } else {
      // the player's meteor on its way: a soft pool that brightens
      const k = Math.max(0, Math.min(1, 1 - z.t / 0.6));
      c.globalAlpha = 0.25 + 0.5 * k;
      blit(c, glow('#ffb04a'), z.x, z.y, 0, (z.r * (0.6 + 0.6 * k)) / 64);
      c.globalAlpha = 1;
    }
  }
}

/** The standing parts of zones: flames on burning ground, the falling meteor. Drawn over the actors. */
export function drawZoneTops(c: Ctx, g: Game, time: number): void {
  for (const z of g.zones) {
    if (z.kind === 'fire') {
      const fade = Math.min(1, z.t / 0.5);
      const n = Math.max(4, Math.round(z.r / 11));
      for (let i = 0; i < n; i++) {
        const a = hash(z, i) * 6.283;
        const d = Math.sqrt(hash(z, i + 50)) * z.r * 0.8;
        blit(c, flame(Math.floor(time * 9 + i * 1.7)), z.x + Math.cos(a) * d, z.y + Math.sin(a) * d * 0.9 + 6, 0, (0.45 + hash(z, i + 9) * 0.45) * fade);
      }
    } else if (z.kind === 'meteor') {
      const k = Math.max(0, Math.min(1, 1 - z.t / 0.6));
      const h = (1 - k) * 420;
      blit(c, fireball(), z.x + h * 0.35, z.y - h, Math.PI * 0.61, 2.2);
    }
  }
}

// ------------------------------------------------------------------- shots

function streak(c: Ctx, s: Shot, len: number, w: number, head: string, tail: string): void {
  const l = Math.hypot(s.vx, s.vy) || 1;
  const ux = s.vx / l;
  const uy = s.vy / l;
  c.lineCap = 'round';
  c.strokeStyle = tail;
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(s.x - ux * len, s.y - uy * len);
  c.lineTo(s.x, s.y);
  c.stroke();
  c.strokeStyle = head;
  c.lineWidth = w * 1.25;
  c.beginPath();
  c.moveTo(s.x - ux * len * 0.22, s.y - uy * len * 0.22);
  c.lineTo(s.x, s.y);
  c.stroke();
}

/** Projectiles. The player's differ by weapon family; hostile ones share one look that nothing else has. */
export function drawShots(c: Ctx, g: Game, time: number): void {
  for (const s of g.shots) {
    if (s.hostile) continue;
    if (s.kind === 'arrow') {
      streak(c, s, 24, 2.4, '#ffffff', rgba(s.color, 0.7));
      // the arrowhead
      const l = Math.hypot(s.vx, s.vy) || 1;
      const ux = s.vx / l;
      const uy = s.vy / l;
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(s.x + ux * 5, s.y + uy * 5);
      c.lineTo(s.x - ux * 3 - uy * 3.4, s.y - uy * 3 + ux * 3.4);
      c.lineTo(s.x - ux * 3 + uy * 3.4, s.y - uy * 3 - ux * 3.4);
      c.closePath();
      c.fill();
    } else if (s.kind === 'splinter') {
      streak(c, s, 12, 1.6, '#f3e6c4', rgba(s.color, 0.5));
    } else if (s.kind === 'shard') {
      // frost: a pale needle-diamond
      const a = Math.atan2(s.vy, s.vx);
      c.save();
      c.translate(s.x, s.y);
      c.rotate(a);
      c.fillStyle = rgba('#8fd8ff', 0.4);
      c.beginPath();
      c.moveTo(7, 0);
      c.lineTo(-1, 5);
      c.lineTo(-17, 0);
      c.lineTo(-1, -5);
      c.closePath();
      c.fill();
      c.fillStyle = '#eafaff';
      c.beginPath();
      c.moveTo(7, 0);
      c.lineTo(0, 2.6);
      c.lineTo(-10, 0);
      c.lineTo(0, -2.6);
      c.closePath();
      c.fill();
      c.restore();
    } else {
      blit(c, fireball(), s.x, s.y, Math.atan2(s.vy, s.vx), 0.5 + s.r / 14);
    }
  }
  // hostile last, so they stay visible over everything
  const orb = spitOrb();
  const pulse = 0.5 + 0.5 * Math.sin(time * 18);
  c.strokeStyle = rgba('#ffffff', 0.35 + 0.5 * pulse);
  c.lineWidth = 1.6;
  for (const s of g.shots) {
    if (!s.hostile) continue;
    const l = Math.hypot(s.vx, s.vy) || 1;
    c.fillStyle = 'rgba(255,61,134,0.4)';
    for (let i = 1; i <= 3; i++) {
      c.beginPath();
      c.arc(s.x - (s.vx / l) * i * 7, s.y - (s.vy / l) * i * 7, 5 - i * 1.1, 0, 6.28);
      c.fill();
    }
    blit(c, orb, s.x, s.y, 0, s.r / 7);
    c.beginPath();
    c.arc(s.x, s.y, s.r + 4 + 2.5 * pulse, 0, 6.28);
    c.stroke();
  }
}

// --------------------------------------------------------------- transient

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 0 | 1 | 2 }
interface Tracer { pts: number[]; life: number; color: string }
interface Arc { x: number; y: number; ang: number; r: number; full: boolean; life: number; color: string }
interface Ring { x: number; y: number; r: number; life: number; color: string; flash: boolean }
interface Block { x: number; y: number; ang: number; r: number; life: number }

const SPARK = 0;
const CHIP = 1;
const PUFF = 2;

export class Fx {
  private particles: Particle[] = [];
  private tracers: Tracer[] = [];
  private arcs: Arc[] = [];
  private rings: Ring[] = [];
  private blocks: Block[] = [];

  reset(): void {
    this.particles = [];
    this.tracers = [];
    this.arcs = [];
    this.rings = [];
    this.blocks = [];
  }

  private emit(kind: 0 | 1 | 2, x: number, y: number, n: number, color: string, speed: number, size: number, life: number, dir = 0, spread = Math.PI): void {
    if (this.particles.length > 700) return;
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() * 2 - 1) * spread;
      const s = speed * (0.3 + Math.random() * 0.7);
      const l = life * (0.6 + Math.random() * 0.6);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, size, color, kind });
    }
  }
  /** Bright streaks that fly out and fade. */
  sparks(x: number, y: number, n: number, color: string, speed: number, size = 2, life = 0.3, dir = 0, spread = Math.PI): void {
    this.emit(SPARK, x, y, n, color, speed, size, life, dir, spread);
  }
  /** Small flat bits of whatever was struck. */
  chips(x: number, y: number, n: number, color: string, speed: number, size = 3, life = 0.45, dir = 0, spread = Math.PI): void {
    this.emit(CHIP, x, y, n, color, speed, size, life, dir, spread);
  }
  puffs(x: number, y: number, n: number, color: string, speed: number, size = 9, life = 0.6): void {
    this.emit(PUFF, x, y, n, color, speed, size, life);
  }
  tracer(x1: number, y1: number, x2: number, y2: number, color: string): void {
    const pts = [x1, y1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l = Math.hypot(dx, dy) || 1;
    for (let i = 1; i < 4; i++) {
      const o = (Math.random() - 0.5) * 18;
      pts.push(x1 + (dx * i) / 4 - (dy / l) * o, y1 + (dy * i) / 4 + (dx / l) * o);
    }
    pts.push(x2, y2);
    this.tracers.push({ pts, life: 0.12, color });
  }
  sweep(x: number, y: number, ang: number, r: number, full: boolean, color: string): void {
    this.arcs.push({ x, y, ang, r, full, life: 0.16, color });
  }
  ring(x: number, y: number, r: number, color: string, flash = false): void {
    this.rings.push({ x, y, r, life: 0.28, color, flash });
  }
  /** A light attack bounced off a shield. */
  blocked(x: number, y: number, ang: number, r: number): void {
    for (const b of this.blocks) {
      if (Math.abs(b.x - x) < 12 && Math.abs(b.y - y) < 12) {
        b.life = 0.3;
        b.ang = ang;
        return;
      }
    }
    this.blocks.push({ x, y, ang, r, life: 0.3 });
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.kind === PUFF ? 0.95 : 0.9;
      p.vx *= k;
      p.vy *= k;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => t.life > 0);
    for (const a of this.arcs) a.life -= dt;
    this.arcs = this.arcs.filter((a) => a.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const b of this.blocks) b.life -= dt;
    this.blocks = this.blocks.filter((b) => b.life > 0);
  }

  draw(c: Ctx): void {
    c.lineCap = 'round';
    // automatic melee: a thin crescent at the reach of the blade. It never covers what it hits.
    for (const a of this.arcs) {
      const k = Math.min(1, a.life / 0.16);
      c.globalAlpha = k * 0.85;
      if (a.full) {
        c.strokeStyle = a.color;
        c.lineWidth = 3.5;
        c.beginPath();
        c.arc(a.x, a.y, a.r * (1 - 0.12 * k), 0, 6.28);
        c.stroke();
        c.strokeStyle = '#ffffff';
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(a.x, a.y, a.r * (1 - 0.12 * k) - 4, 0, 6.28);
        c.stroke();
      } else {
        const R = a.r * (1 - 0.1 * k);
        const d = R * 0.25;
        c.fillStyle = a.color;
        c.beginPath();
        c.arc(a.x, a.y, R, a.ang - 0.969, a.ang + 0.969);
        c.arc(a.x - Math.cos(a.ang) * d, a.y - Math.sin(a.ang) * d, R * 1.16, a.ang + 0.79, a.ang - 0.79, true);
        c.closePath();
        c.fill();
      }
    }
    // bursts: a thin ring running outwards; explosions add a soft flash
    for (const r of this.rings) {
      const k = Math.max(0, 1 - r.life / 0.28);
      if (r.flash) {
        c.globalAlpha = (1 - k) * 0.5;
        blit(c, glow(r.color), r.x, r.y, 0, (r.r * (0.7 + 0.4 * k)) / 64);
      }
      c.globalAlpha = (1 - k) * 0.9;
      c.strokeStyle = r.color;
      c.lineWidth = 3 - 1.6 * k;
      c.beginPath();
      c.arc(r.x, r.y, r.r * (0.35 + 0.65 * k), 0, 6.28);
      c.stroke();
    }
    for (const t of this.tracers) {
      c.globalAlpha = Math.min(1, t.life / 0.12);
      for (const [col, w] of [[t.color, 3], ['#ffffff', 1.1]] as const) {
        c.strokeStyle = col;
        c.lineWidth = w;
        c.beginPath();
        c.moveTo(t.pts[0], t.pts[1]);
        for (let i = 2; i < t.pts.length; i += 2) c.lineTo(t.pts[i], t.pts[i + 1]);
        c.stroke();
      }
    }
    for (const q of this.particles) {
      const k = Math.max(0, q.life / q.max);
      if (q.kind === SPARK) {
        c.globalAlpha = k;
        c.strokeStyle = q.color;
        c.lineWidth = q.size * 0.7;
        c.beginPath();
        c.moveTo(q.x, q.y);
        c.lineTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035);
        c.stroke();
      } else if (q.kind === CHIP) {
        c.globalAlpha = Math.min(1, k * 1.6);
        c.fillStyle = q.color;
        const s = q.size * (0.6 + 0.4 * k);
        c.fillRect(q.x - s / 2, q.y - s / 2, s, s * 0.7);
      } else {
        c.globalAlpha = k * 0.22;
        c.fillStyle = q.color;
        c.beginPath();
        c.arc(q.x, q.y, q.size * (1.6 - 0.6 * k), 0, 6.28);
        c.fill();
      }
    }
    // blocked: a bright arc on the plate and ticks thrown back at the attacker
    for (const b of this.blocks) {
      const k = Math.min(1, b.life / 0.3);
      c.globalAlpha = Math.min(1, k * 1.5);
      const R = b.r + 6 + (1 - k) * 5;
      c.strokeStyle = INK;
      c.lineWidth = 7;
      c.beginPath();
      c.arc(b.x, b.y, R, b.ang - 0.85, b.ang + 0.85);
      c.stroke();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(b.x, b.y, R, b.ang - 0.85, b.ang + 0.85);
      c.stroke();
      c.lineWidth = 2.4;
      c.beginPath();
      for (const o of [-0.5, 0, 0.5]) {
        const a = b.ang + o;
        c.moveTo(b.x + Math.cos(a) * (R + 5), b.y + Math.sin(a) * (R + 5));
        c.lineTo(b.x + Math.cos(a) * (R + 12 + (1 - k) * 6), b.y + Math.sin(a) * (R + 12 + (1 - k) * 6));
      }
      c.stroke();
    }
    c.globalAlpha = 1;
  }
}
