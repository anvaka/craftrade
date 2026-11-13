// Canvas drawing and visual feedback (particles, camera kick, banners). Placeholder shapes only.
import { CFG } from './config';
import type { Enemy, Game, GameEvent, OreNode } from './game';
import type { InputMgr } from './input';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}
interface Tracer {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
}
interface Decal {
  x: number;
  y: number;
  size: number;
  color: string;
}

const COL = {
  swarm: '#e2504a',
  shield: '#8f6fd6',
  burrower: '#e08a3c',
  common: '#7f9db6',
  rich: '#f2c230',
  lull: '#3f8f78',
  swell: '#d9a92a',
  peak: '#d6453d',
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private scale = 1;
  private camX = 0;
  private camY = 0;
  private kickX = 0;
  private kickY = 0;
  private shake = 0;
  private particles: Particle[] = [];
  private tracers: Tracer[] = [];
  private decals: Decal[] = [];
  private banner = '';
  private bannerT = 0;
  private bannerCol = '#fff';
  private hurtFlash = 0;
  private staminaBlink = 0;
  private gain = 0; // "+N ore" count-up above the player
  private gainT = 0;
  private t = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // show roughly the same area of the arena whatever the screen shape
    this.scale = Math.sqrt((this.w * this.h) / 560000);
  }

  reset(g: Game): void {
    this.particles = [];
    this.tracers = [];
    this.decals = [];
    this.bannerT = 0;
    this.hurtFlash = 0;
    this.gainT = 0;
    this.shake = 0;
    this.kickX = this.kickY = 0;
    this.camX = g.p.x;
    this.camY = g.p.y;
  }

  worldToScreen(x: number, y: number): [number, number] {
    return [(x - this.camX) * this.scale + this.w / 2, (y - this.camY) * this.scale + this.h / 2];
  }

  private say(text: string, color: string, time = 1.6): void {
    this.banner = text;
    this.bannerCol = color;
    this.bannerT = time;
  }

  private burst(x: number, y: number, n: number, color: string, speed: number, size = 3, life = 0.4): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const l = life * (0.6 + Math.random() * 0.6);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, max: l, size, color });
    }
  }

  private chips(x: number, y: number, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 14 + Math.random() * 46;
      this.decals.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, size: 1.5 + Math.random() * 2.5, color });
    }
    if (this.decals.length > 400) this.decals.splice(0, this.decals.length - 400);
  }

  /** Returns how long the simulation should pause for this event (impact pause). */
  onEvent(e: GameEvent, g: Game): number {
    switch (e.t) {
      case 'shot':
        this.tracers.push({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, life: 0.07 });
        this.burst(e.x2, e.y2, e.blocked ? 4 : 2, e.blocked ? '#cfe8ff' : '#fff', 120, 2, 0.2);
        return 0;
      case 'kill':
        this.burst(e.x, e.y, e.sweep ? 4 : e.kind === 'swarm' ? 7 : 16, COL[e.kind], e.kind === 'swarm' ? 160 : 240);
        return 0;
      case 'heavyHit':
        this.burst(e.x, e.y, 6, '#fff', 260, 3, 0.25);
        this.shake = Math.max(this.shake, 5);
        return 0.045;
      case 'shieldBreak':
        this.burst(e.x, e.y, 16, '#cfe8ff', 320, 4, 0.5);
        this.shake = Math.max(this.shake, 8);
        return 0.08;
      case 'nodeStrike': {
        const col = e.rich ? COL.rich : COL.common;
        this.burst(e.x, e.y, e.broke ? 22 : 10, col, e.broke ? 340 : 240, 3.5, 0.5);
        this.chips(e.x, e.y, e.broke ? 9 : 4, col);
        this.kickX += e.dx * (e.broke ? 16 : 9);
        this.kickY += e.dy * (e.broke ? 16 : 9);
        this.shake = Math.max(this.shake, e.broke ? 9 : 5);
        return e.broke ? 0.1 : 0.06;
      }
      case 'pickup':
        this.gain = this.gainT > 0 ? this.gain + 1 : 1;
        this.gainT = 0.9;
        return 0;
      case 'hurt':
        this.hurtFlash = 0.3;
        this.shake = Math.max(this.shake, 7);
        this.burst(g.p.x, g.p.y, 6, '#ff6b5e', 200);
        return 0.04;
      case 'dodge':
        this.burst(g.p.x, g.p.y, 5, '#9fb4c8', 90, 3, 0.3);
        return 0;
      case 'noStamina':
        this.staminaBlink = 0.35;
        return 0;
      case 'burrowUp':
        this.burst(e.x, e.y, 12, '#8a6a48', 200, 4, 0.5);
        this.chips(e.x, e.y, 5, '#5b4630');
        return 0;
      case 'nodeBite':
        this.burst(e.x, e.y, e.ate ? 16 : 7, '#8a6a48', 200);
        return 0;
      case 'waveStart':
        this.say(`WAVE ${e.wave + 1}`, '#e8ecf1');
        return 0;
      case 'beat':
        if (e.beat === 'peak') this.say('PEAK', COL.peak);
        else if (e.beat === 'swell' && !g.gathering) this.say('SWELL', COL.swell);
        return 0;
      case 'richOpen':
        this.say('SWELL: RICH VEINS OPEN', COL.rich);
        return 0;
      default:
        return 0;
    }
  }

  update(dt: number): void {
    this.t += dt;
    this.bannerT -= dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.staminaBlink = Math.max(0, this.staminaBlink - dt);
    this.gainT -= dt;
    this.shake *= Math.exp(-14 * dt);
    const k = Math.exp(-12 * dt);
    this.kickX *= k;
    this.kickY *= k;
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => t.life > 0);
  }

  draw(g: Game, input: InputMgr, dt: number): void {
    const c = this.ctx;
    const { w: aw, h: ah } = CFG.arena;
    const p = g.p;

    // camera: follow the player, stay inside the arena where the view allows
    const vw = this.w / this.scale;
    const vh = this.h / this.scale;
    const m = 50;
    const tx = vw >= aw + m * 2 ? aw / 2 : Math.max(vw / 2 - m, Math.min(aw + m - vw / 2, p.x));
    const ty = vh >= ah + m * 2 ? ah / 2 : Math.max(vh / 2 - m, Math.min(ah + m - vh / 2, p.y));
    const f = 1 - Math.exp(-10 * dt);
    this.camX += (tx - this.camX) * f;
    this.camY += (ty - this.camY) * f;

    c.fillStyle = '#0d0f12';
    c.fillRect(0, 0, this.w, this.h);

    c.save();
    const sx = (Math.random() - 0.5) * this.shake + this.kickX;
    const sy = (Math.random() - 0.5) * this.shake + this.kickY;
    c.translate(this.w / 2 + sx, this.h / 2 + sy);
    c.scale(this.scale, this.scale);
    c.translate(-this.camX, -this.camY);

    // floor
    c.fillStyle = '#1b1f25';
    c.fillRect(0, 0, aw, ah);
    c.strokeStyle = '#222730';
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 100; x < aw; x += 100) {
      c.moveTo(x, 0);
      c.lineTo(x, ah);
    }
    for (let y = 100; y < ah; y += 100) {
      c.moveTo(0, y);
      c.lineTo(aw, y);
    }
    c.stroke();
    c.strokeStyle = g.beat === 'peak' && g.phase === 'wave' ? COL.peak : '#3a424e';
    c.lineWidth = 4;
    c.strokeRect(0, 0, aw, ah);

    for (const d of this.decals) {
      c.fillStyle = d.color;
      c.globalAlpha = 0.45;
      c.fillRect(d.x, d.y, d.size, d.size);
    }
    c.globalAlpha = 1;

    for (const n of g.nodes) if (n.alive) this.drawNode(n);

    c.fillStyle = COL.rich;
    for (const k of g.pickups) {
      c.beginPath();
      c.moveTo(k.x, k.y - 5);
      c.lineTo(k.x + 4, k.y);
      c.lineTo(k.x, k.y + 5);
      c.lineTo(k.x - 4, k.y);
      c.fill();
    }

    for (const e of g.enemies) this.drawEnemy(e, g);
    this.drawPlayer(g);

    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    for (const t of this.tracers) {
      c.globalAlpha = t.life / 0.07;
      c.beginPath();
      c.moveTo(t.x1, t.y1);
      c.lineTo(t.x2, t.y2);
      c.stroke();
    }
    for (const q of this.particles) {
      c.globalAlpha = Math.max(0, q.life / q.max);
      c.fillStyle = q.color;
      c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    c.globalAlpha = 1;
    c.restore();

    this.drawOverlay(g);
    this.drawRichPips(g);
    this.drawHud(g);
    if (input.touchMode) this.drawTouch(input);
  }

  private poly(x: number, y: number, r: number, sides: number, rot: number): void {
    const c = this.ctx;
    c.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const rr = r * (i % 2 ? 0.86 : 1);
      if (i === 0) c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }

  private drawNode(n: OreNode): void {
    const c = this.ctx;
    if (!n.open) {
      // a marked but buried rich vein
      c.setLineDash([6, 6]);
      c.strokeStyle = '#7d6a26';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#7d6a26';
      this.poly(n.x, n.y, 6, 4, 0);
      c.fill();
      return;
    }
    const total = (n.rich ? CFG.nodes.rich : CFG.nodes.common).drops.length;
    const r = n.r * (1 - 0.14 * n.stage);
    if (n.rich) {
      c.globalAlpha = 0.18 + 0.1 * Math.sin(this.t * 6);
      c.fillStyle = COL.rich;
      c.beginPath();
      c.arc(n.x, n.y, n.r + 14, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
    c.fillStyle = n.flash > 0 ? '#fff' : n.rich ? COL.rich : COL.common;
    this.poly(n.x, n.y, r, n.rich ? 8 : 6, n.x);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.35)';
    c.lineWidth = 2;
    c.stroke();
    // pips: swings left
    c.fillStyle = '#fff';
    for (let i = n.stage; i < total; i++) {
      c.fillRect(n.x - (total * 7) / 2 + i * 7 + 1, n.y + n.r + 6, 5, 3);
    }
  }

  private drawEnemy(e: Enemy, g: Game): void {
    const c = this.ctx;
    const p = g.p;
    const face = Math.atan2(p.y - e.y, p.x - e.x);
    c.fillStyle = e.flash > 0 ? '#fff' : COL[e.kind];

    if (e.kind === 'swarm') {
      c.beginPath();
      c.moveTo(e.x + Math.cos(face) * e.r * 1.3, e.y + Math.sin(face) * e.r * 1.3);
      c.lineTo(e.x + Math.cos(face + 2.4) * e.r, e.y + Math.sin(face + 2.4) * e.r);
      c.lineTo(e.x + Math.cos(face - 2.4) * e.r, e.y + Math.sin(face - 2.4) * e.r);
      c.fill();
      return;
    }

    if (e.kind === 'shield') {
      c.save();
      c.translate(e.x, e.y);
      c.rotate(face);
      if (!e.shield && e.flash <= 0) c.fillStyle = '#5d4a8c';
      c.fillRect(-e.r * 0.85, -e.r * 0.85, e.r * 1.7, e.r * 1.7);
      if (e.shield) {
        c.strokeStyle = '#cfe8ff';
        c.lineWidth = 5;
        c.beginPath();
        c.arc(0, 0, e.r + 5, -1.1, 1.1);
        c.stroke();
      }
      c.restore();
      return;
    }

    // burrower
    if (e.state === 'under') {
      c.fillStyle = '#6b523a';
      c.globalAlpha = 0.85;
      for (let i = 0; i < 3; i++) {
        const a = this.t * 5 + i * 2.1 + e.wob;
        c.beginPath();
        c.arc(e.x + Math.cos(a) * 6, e.y + Math.sin(a) * 6, 6, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      return;
    }
    if (e.state === 'emerging') {
      const k = 1 - e.stateT / CFG.enemies.burrower.emergeTime;
      c.strokeStyle = COL.burrower;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(e.x, e.y, e.r + 14 * (1 - k), 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 0.4 + 0.6 * k;
    }
    this.poly(e.x, e.y, e.r * 1.15, 4, this.t * (e.target ? 9 : 0));
    c.fill();
    c.globalAlpha = 1;
  }

  private drawPlayer(g: Game): void {
    const c = this.ctx;
    const p = g.p;
    const pc = CFG.player;
    const ang = Math.atan2(p.ay, p.ax);

    // heavy swing: wind-up cone, then the arc flash
    if (p.charging || p.swingT > 0) {
      c.fillStyle = p.swingT > 0 ? '#fff' : p.charge >= 1 ? '#ffd34d' : '#aab4c0';
      c.globalAlpha = p.swingT > 0 ? (p.swingT / 0.18) * 0.7 : 0.08 + 0.12 * p.charge;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.arc(p.x, p.y, pc.heavyRange, ang - pc.heavyArc, ang + pc.heavyArc);
      c.closePath();
      c.fill();
      c.globalAlpha = 1;
    }

    c.globalAlpha = p.iframes > 0 ? 0.45 : 1;
    c.fillStyle = '#e8ecf1';
    c.beginPath();
    c.arc(p.x, p.y, pc.r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1b1f25';
    c.beginPath();
    c.arc(p.x + Math.cos(ang) * 7, p.y + Math.sin(ang) * 7, 4, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;

    // the one cooldown: heavy swing charge
    if (p.charging) {
      c.strokeStyle = p.charge >= 1 ? '#ffd34d' : '#aab4c0';
      c.lineWidth = p.charge >= 1 ? 4 : 3;
      c.beginPath();
      c.arc(p.x, p.y, pc.r + 7, -Math.PI / 2, -Math.PI / 2 + p.charge * Math.PI * 2);
      c.stroke();
    }

    // health and stamina sit under the character, where the eyes already are
    const bw = 46;
    const bx = p.x - bw / 2;
    let by = p.y + pc.r + 12;
    c.fillStyle = 'rgba(0,0,0,.55)';
    c.fillRect(bx - 1, by - 1, bw + 2, 13);
    const hp = p.hp / pc.hp;
    c.fillStyle = hp > 0.35 ? '#5fd07a' : '#ff5a4d';
    c.fillRect(bx, by, bw * hp, 6);
    by += 7;
    const st = p.stamina / pc.stamina;
    c.fillStyle = this.staminaBlink > 0 ? '#ff5a4d' : st * pc.stamina >= pc.heavyCost ? '#f4d35e' : '#a8914a';
    c.fillRect(bx, by, bw * st, 4);

    if (this.gainT > 0) {
      c.globalAlpha = Math.min(1, this.gainT * 3);
      c.fillStyle = COL.rich;
      c.font = '700 15px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText(`+${this.gain}`, p.x, p.y - pc.r - 12);
      c.globalAlpha = 1;
    }
  }

  private drawOverlay(g: Game): void {
    const c = this.ctx;
    const low = g.p.hp / CFG.player.hp < 0.3 ? 0.25 + 0.1 * Math.sin(this.t * 8) : 0;
    const a = Math.max(this.hurtFlash * 1.6, low);
    if (a > 0) {
      const gr = c.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.7);
      gr.addColorStop(0, 'rgba(255,60,40,0)');
      gr.addColorStop(1, `rgba(255,60,40,${Math.min(0.6, a)})`);
      c.fillStyle = gr;
      c.fillRect(0, 0, this.w, this.h);
    }
  }

  /** Screen-edge markers for rich veins that are off screen, so the trip can be planned. */
  private drawRichPips(g: Game): void {
    const c = this.ctx;
    const pad = 22;
    for (const n of g.nodes) {
      if (!n.rich || !n.alive) continue;
      const [sx, sy] = this.worldToScreen(n.x, n.y);
      if (sx > 0 && sx < this.w && sy > 0 && sy < this.h) continue;
      const x = Math.max(pad, Math.min(this.w - pad, sx));
      const y = Math.max(pad + 60, Math.min(this.h - pad, sy));
      c.fillStyle = n.open ? COL.rich : '#7d6a26';
      c.globalAlpha = n.open ? 0.7 + 0.3 * Math.sin(this.t * 8) : 0.8;
      this.poly(x, y, n.open ? 10 : 7, 4, 0);
      c.fill();
      c.globalAlpha = 1;
    }
  }

  private drawHud(g: Game): void {
    const c = this.ctx;
    const bw = Math.min(440, this.w - 32);
    const x = (this.w - bw) / 2;
    let y = 26;
    const { lull, swell } = CFG.beats;
    const segs: [string, number, string][] = [
      ['lull', lull, COL.lull],
      ['swell', swell, COL.swell],
      ['peak', 1 - lull - swell, COL.peak],
    ];
    const prog = g.phase === 'wave' ? g.waveT / g.waveDur : g.phase === 'intermission' ? 0 : 1;

    c.font = '600 12px system-ui, sans-serif';
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.fillStyle = '#c9d1db';
    c.fillText(`WAVE ${g.wave + 1}/${CFG.waves.length}`, x, y - 8);
    c.textAlign = 'right';
    if (g.phase === 'wave') {
      c.fillStyle = COL[g.beat];
      c.fillText(`${g.beat.toUpperCase()}  ${Math.ceil(g.waveDur - g.waveT)}s`, x + bw, y - 8);
    }

    // wave beat: three segments, filled as the clock runs
    let sx = x;
    for (const [, share, col] of segs) {
      const sw = bw * share;
      c.fillStyle = col;
      c.globalAlpha = 0.28;
      c.fillRect(sx, y, sw - 2, 9);
      const fill = Math.max(0, Math.min(sw - 2, x + bw * prog - sx));
      c.globalAlpha = 1;
      c.fillRect(sx, y, fill, 9);
      sx += sw;
    }
    c.fillStyle = '#fff';
    c.fillRect(x + bw * prog - 1, y - 3, 2, 15);

    if (g.gathering) {
      y += 20;
      const k = g.heat / CFG.heat.max;
      c.fillStyle = 'rgba(255,255,255,.1)';
      c.fillRect(x, y, bw, 9);
      const pulse = k > 0.7 ? 0.75 + 0.25 * Math.sin(this.t * 14) : 1;
      c.globalAlpha = pulse;
      c.fillStyle = `rgb(255,${Math.round(190 - 150 * k)},${Math.round(60 - 40 * k)})`;
      c.fillRect(x, y, bw * k, 9);
      c.globalAlpha = 1;
      c.textAlign = 'left';
      c.fillStyle = k > 0.05 ? '#ffb347' : '#77808c';
      c.font = '600 11px system-ui, sans-serif';
      c.fillText('HEAT', x, y + 22);
    }

    // banners
    let text = '';
    let col = '#fff';
    if (g.phase === 'intermission') {
      text = g.gathering ? `WAVE ${g.wave + 1} CLEARED · HAUL ${g.stats.material}` : `WAVE ${g.wave + 1} CLEARED`;
    } else if (this.bannerT > 0) {
      text = this.banner;
      col = this.bannerCol;
      c.globalAlpha = Math.min(1, this.bannerT * 2.5);
    }
    if (text) {
      c.font = `800 ${Math.max(18, Math.min(34, this.w / 16))}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.fillStyle = 'rgba(0,0,0,.6)';
      c.fillText(text, this.w / 2 + 2, this.h * 0.27 + 2);
      c.fillStyle = col;
      c.fillText(text, this.w / 2, this.h * 0.27);
      c.globalAlpha = 1;
    }
  }

  private drawTouch(input: InputMgr): void {
    const c = this.ctx;
    c.lineWidth = 2;
    c.strokeStyle = 'rgba(255,255,255,.28)';
    c.fillStyle = 'rgba(255,255,255,.2)';
    const stick = (s: { ox: number; oy: number; x: number; y: number }) => {
      c.beginPath();
      c.arc(s.ox, s.oy, 48, 0, Math.PI * 2);
      c.stroke();
      const dx = s.x - s.ox;
      const dy = s.y - s.oy;
      const l = Math.max(1, Math.hypot(dx, dy) / 48);
      c.beginPath();
      c.arc(s.ox + dx / l, s.oy + dy / l, 20, 0, Math.PI * 2);
      c.fill();
    };
    if (input.joy) stick(input.joy);
    if (input.aim) stick(input.aim);
    const b = input.dodgeButton();
    c.beginPath();
    c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    c.stroke();
    c.font = '700 11px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillStyle = 'rgba(255,255,255,.5)';
    c.fillText('DODGE', b.x, b.y + 4);
  }
}
