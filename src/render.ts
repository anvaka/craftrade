// The arena renderer: a short orchestrator. The art lives in src/art/, the HUD in hud.ts.
// Order of a frame: ground, ground marks, nodes, drops, creatures, the player, the time-of-day light,
// then effects and projectiles (which have no outline and are never dimmed), then the HUD.
import { CFG, MATS } from './data';
import { Hud } from './hud';
import type { Enemy, Game, GameEvent, OreNode } from './game';
import type { InputMgr } from './input';
import { buildTerrain, drawTerrain, stampBlood, stampDirt, stampRubble, stampScorch, type Terrain } from './art/terrain';
import { drawNode } from './art/nodes';
import { drawEnemy, drawEnemyGround, drawMound } from './art/creatures';
import { drawCharge, drawPlayer, drawSwing, type PawnState } from './art/pawn';
import { drawPickups } from './art/items';
import { Fx, drawShots, drawZones, drawZoneTops } from './art/fx';
import { Lighting, ambientFor } from './art/light';
import { T, setRes, shade } from './art/util';

const BONE = '#d8ceac';
const EDGE = 2 * T; // how much rock the camera may show past the arena's edge

function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export class Renderer {
  scale = 1;
  readonly hud = new Hud(this);
  ctx: CanvasRenderingContext2D;
  w = 0;
  h = 0;
  t = 0;
  private camX = 0;
  private camY = 0;
  private kickX = 0;
  private kickY = 0;
  private shake = 0;
  private fx = new Fx();
  private light = new Lighting();
  private terrain: Terrain | null = null;
  private pawn: PawnState = { hurt: 0, trail: [] };
  private trails = new Map<number, number[]>(); // where each burrower has dug
  private peak = 0;
  private scaleW = 0; // the window size the scale was computed for
  private scaleH = 0;

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
    // A phone's browser bars show and hide, changing the height a little: keep the zoom through that.
    // Recompute on a width change (an orientation flip changes it too) or a real change of height.
    if (this.w !== this.scaleW || Math.abs(this.h - this.scaleH) >= 120) {
      this.scaleW = this.w;
      this.scaleH = this.h;
      this.scale = Math.sqrt((this.w * this.h) / 600000);
    }
    setRes(this.scale * dpr);
  }

  reset(g: Game): void {
    this.fx.reset();
    this.hud.reset(g);
    this.shake = 0;
    this.kickX = this.kickY = 0;
    this.camX = g.p.x;
    this.camY = g.p.y;
    this.pawn = { hurt: 0, trail: [] };
    this.trails.clear();
    this.peak = 0;
    this.terrain = buildTerrain(g.spec.ground, g.spec.seed, this.terrain);
  }

  worldToScreen(x: number, y: number): [number, number] {
    return [(x - this.camX) * this.scale + this.w / 2, (y - this.camY) * this.scale + this.h / 2];
  }

  say(text: string, color: string, time = 1.8): void {
    this.hud.say(text, color, time);
  }

  /** Returns how long the simulation should pause for this event (impact pause). */
  onEvent(e: GameEvent, g: Game): number {
    this.hud.onEvent(e, g);
    const fx = this.fx;
    const ter = this.terrain;
    switch (e.t) {
      case 'shot':
        fx.tracer(e.x1, e.y1, e.x2, e.y2, e.color);
        return 0;
      case 'sweep':
        fx.sweep(e.x, e.y, e.ang, e.r, e.full, e.color);
        return 0;
      case 'burst':
        if (e.hostile) {
          // a hostile blast going off
          fx.ring(e.x, e.y, e.r, '#ff3b4e', true);
          fx.puffs(e.x, e.y, 6, '#f2f2f2', 60, e.r * 0.22, 0.7);
          fx.sparks(e.x, e.y, 10, '#ffbe2f', 300, 2.4, 0.35);
          if (ter) stampScorch(ter, e.x, e.y, e.r * 0.9);
          this.shake = Math.max(this.shake, 7);
        } else {
          const fire = e.color === '#ff8a3c' || e.color === '#ffb347';
          fx.ring(e.x, e.y, e.r, e.color, fire);
          if (fire) {
            fx.sparks(e.x, e.y, 6, '#ffd24a', 220, 2, 0.3);
            if (ter && e.r > 60) stampScorch(ter, e.x, e.y, e.r * 0.7);
          }
        }
        return 0;
      case 'tink': {
        const who = g.enemies.find((o) => o.x === e.x && o.y === e.y);
        const a = Math.atan2(g.p.y - e.y, g.p.x - e.x);
        const r = (who?.r ?? 20) * 1.25;
        fx.blocked(e.x, e.y, a, r);
        fx.sparks(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 4, '#fff6d8', 200, 2, 0.22, a, 0.8);
        return 0;
      }
      case 'kill': {
        const col = CFG.enemies[e.kind].color;
        const n = e.sweep ? 3 : e.big ? 22 : e.kind === 'swarm' ? 5 : 10;
        fx.chips(e.x, e.y, n, col, e.big ? 300 : 170, e.big ? 5 : 3.2);
        fx.chips(e.x, e.y, Math.ceil(n / 2), shade(col, 0.5), e.big ? 240 : 130, 2.6);
        if (ter && !e.sweep) stampBlood(ter, e.x, e.y, e.big ? 34 : e.kind === 'swarm' ? 9 : 17);
        if (e.big && !e.sweep) {
          this.shake = Math.max(this.shake, 12);
          return 0.12;
        }
        return 0;
      }
      case 'heavyHit':
        fx.sparks(e.x, e.y, 7, '#ffffff', 280, 2.6, 0.25);
        this.shake = Math.max(this.shake, 5);
        return 0.045;
      case 'shieldBreak':
        // the plate comes off in bone shards
        fx.chips(e.x, e.y, 14, BONE, 340, 5, 0.6);
        fx.sparks(e.x, e.y, 8, '#ffffff', 320, 2.6, 0.3);
        fx.ring(e.x, e.y, 46, '#ffffff');
        this.shake = Math.max(this.shake, 8);
        return 0.08;
      case 'nodeStrike': {
        const back = Math.atan2(-e.dy, -e.dx);
        fx.chips(e.x, e.y, e.broke ? 16 : 8, e.color, e.broke ? 320 : 230, 3.6, 0.5, back, 1.5);
        fx.sparks(e.x, e.y, e.broke ? 8 : 4, '#ffffff', 260, 2, 0.22, back, 1.3);
        if (ter) stampRubble(ter, e.x, e.y, e.broke ? 12 : 4, e.broke ? 30 : 44, e.color);
        this.kickX += e.dx * (e.broke ? 16 : 9);
        this.kickY += e.dy * (e.broke ? 16 : 9);
        this.shake = Math.max(this.shake, e.broke ? 9 : 5);
        return e.broke ? 0.1 : 0.06;
      }
      case 'closedVein':
        fx.sparks(e.x, e.y, 5, '#9a9488', 160, 2, 0.2);
        return 0;
      case 'hurt':
        this.shake = Math.max(this.shake, 7);
        this.pawn.hurt = 0.16;
        fx.sparks(g.p.x, g.p.y, 6, '#ff6b5e', 200, 2.4);
        return 0; // no pause on being hit: a crowd in contact must not slow the wave clock
      case 'dodge':
        fx.puffs(g.p.x, g.p.y + 8, 4, '#d8d2c4', 50, 6, 0.4);
        return 0;
      case 'ability':
        this.shake = Math.max(this.shake, 6);
        return 0.03;
      case 'burrowUp':
        if (ter) {
          fx.chips(e.x, e.y, 12, shade(ter.pal.base, 1.4), 210, 3.4, 0.5);
          fx.chips(e.x, e.y, 6, shade(ter.pal.base, 0.55), 160, 3, 0.5);
          stampDirt(ter, e.x, e.y, 26);
        }
        return 0;
      case 'nodeBite':
        fx.chips(e.x, e.y, e.ate ? 14 : 7, '#b9ae9a', 190, 3, 0.45);
        fx.sparks(e.x, e.y, e.ate ? 8 : 4, '#ff3b4e', 220, 2.2, 0.3);
        return 0;
      default:
        return 0;
    }
  }

  update(dt: number): void {
    if (dt < 0) dt = 0; // the first frame's timestamp can lie before the clock was read
    this.t += dt;
    this.hud.update(dt);
    this.fx.update(dt);
    this.shake *= Math.exp(-14 * dt);
    const k = Math.exp(-12 * dt);
    this.kickX *= k;
    this.kickY *= k;
    this.pawn.hurt = Math.max(0, this.pawn.hurt - dt);
    const tr = this.pawn.trail;
    for (let i = 2; i < tr.length; i += 3) tr[i] += dt;
    while (tr.length && tr[2] > 0.28) tr.splice(0, 3);
  }

  /** The node the heavy swing would strike right now: the same rule as Game.swing. */
  private aimedNode(g: Game): OreNode | null {
    const p = g.p;
    const c = CFG.player;
    const ang = Math.atan2(p.ay, p.ax);
    let best: OreNode | null = null;
    let bestD = Infinity;
    for (const n of g.nodes) {
      if (!n.alive || !n.open) continue;
      const dx = n.x - p.x;
      const dy = n.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > c.heavyRange + n.r) continue;
      if (angDiff(Math.atan2(dy, dx), ang) > c.heavyArc + Math.asin(Math.min(1, n.r / d))) continue;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  private track(g: Game): void {
    // the dodge leaves afterimages
    const p = g.p;
    const tr = this.pawn.trail;
    if (p.dodgeT > 0) {
      const n = tr.length;
      if (n === 0 || Math.hypot(tr[n - 3] - p.x, tr[n - 2] - p.y) > 16) tr.push(p.x, p.y, 0);
    }
    // burrowers underground leave a trail of turned earth
    const seen = new Set<number>();
    for (const e of g.enemies) {
      if (e.kind !== 'burrower' || e.state !== 'under') continue;
      seen.add(e.id);
      let pts = this.trails.get(e.id);
      if (!pts) this.trails.set(e.id, (pts = []));
      const n = pts.length;
      if (n === 0 || Math.hypot(pts[n - 2] - e.x, pts[n - 1] - e.y) > 13) {
        pts.push(e.x, e.y);
        if (pts.length > 28) pts.splice(0, 2);
      }
    }
    for (const id of this.trails.keys()) if (!seen.has(id)) this.trails.delete(id);
  }

  draw(g: Game, input: InputMgr, dt: number): void {
    const c = this.ctx;
    const { w: aw, h: ah } = CFG.arena;
    const p = g.p;
    const t = this.t;
    if (!this.terrain || this.terrain.ground !== g.spec.ground) this.terrain = buildTerrain(g.spec.ground, g.spec.seed, this.terrain);
    const ter = this.terrain;
    const vw = this.w / this.scale;
    const vh = this.h / this.scale;
    // The camera may scroll past each edge far enough that the HUD and the touch controls never cover
    // the character or a vein at the edge. A view larger than the arena is centred between those bands.
    const pad = input.viewPad();
    const mL = Math.max(EDGE, pad.left / this.scale);
    const mR = Math.max(EDGE, pad.right / this.scale);
    const mT = Math.max(EDGE, pad.top / this.scale);
    const mB = Math.max(EDGE, pad.bottom / this.scale);
    const tx = vw >= aw + mL + mR ? (aw + mR - mL) / 2 : Math.max(vw / 2 - mL, Math.min(aw + mR - vw / 2, p.x));
    const ty = vh >= ah + mT + mB ? (ah + mB - mT) / 2 : Math.max(vh / 2 - mT, Math.min(ah + mB - vh / 2, p.y));
    const f = 1 - Math.exp(-10 * dt);
    this.camX += (tx - this.camX) * f;
    this.camY += (ty - this.camY) * f;
    this.peak += ((g.beat === 'peak' && g.phase === 'wave' ? 1 : 0) - this.peak) * (1 - Math.exp(-4 * dt));
    this.track(g);

    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = ter.fog;
    c.fillRect(0, 0, this.w, this.h);
    c.save();
    c.translate(this.w / 2 + (Math.random() - 0.5) * this.shake + this.kickX, this.h / 2 + (Math.random() - 0.5) * this.shake + this.kickY);
    c.scale(this.scale, this.scale);
    c.translate(-this.camX, -this.camY);
    c.lineJoin = 'round';
    c.lineCap = 'round';

    // ---- the ground and what lies on it
    drawTerrain(c, ter, this.peak, t);
    drawZones(c, g, t);
    drawCharge(c, g);
    for (const e of g.enemies) drawEnemyGround(c, e, t);
    for (const e of g.enemies) {
      if (e.state === 'under') drawMound(c, e, this.trails.get(e.id) ?? [], t);
    }

    // ---- things you can take
    const aimed = this.aimedNode(g);
    const eaten = new Set<OreNode>();
    for (const e of g.enemies) if (e.kind === 'burrower' && e.state === 'up' && e.target) eaten.add(e.target);
    const nodes = g.nodes.filter((n) => n.alive).sort((a, b) => a.y - b.y);
    for (const n of nodes) drawNode(c, n, g, t, { eaten: eaten.has(n), aimed: n === aimed, charge: p.charging ? Math.max(0.01, p.charge) : 0 });
    drawPickups(c, g, t);

    // ---- things that hurt you, then you
    const es: Enemy[] = g.enemies.slice().sort((a, b) => a.y - b.y);
    for (const e of es) drawEnemy(c, e, g, t);
    drawZoneTops(c, g, t);
    drawPlayer(c, g, t, this.pawn);

    // ---- time of day
    const light = this.light;
    light.begin(this.camX, this.camY, vw, vh, this.w, this.h, ambientFor(g.spec.index));
    if (light.on) {
      light.add(p.x, p.y, 9.5 * T);
      for (const z of g.zones) {
        if (z.kind === 'fire') light.add(z.x, z.y, z.r * 2.6, Math.min(1, z.t));
        else if (z.kind === 'meteor') light.add(z.x, z.y, z.r * 2.2, 0.8);
      }
      for (const s of g.shots) if (s.kind === 'fire') light.add(s.x, s.y, 80, 0.8);
      for (const n of g.nodes) if (n.alive && n.rich && n.open) light.add(n.x, n.y, 4.5 * T, 0.75);
      let burning = 0;
      for (const e of g.enemies) {
        if (e.boss && !e.shield) light.add(e.x, e.y, e.r * 4.5, 0.9);
        else if (e.kind === 'bomber') light.add(e.x, e.y, 60, 0.6);
        else if (e.burnT > 0 && burning++ < 12) light.add(e.x, e.y, 64, 0.7);
      }
      for (const k of g.pickups) if (MATS[k.mat]?.cat === 'part') light.add(k.x, k.y, 70, 0.7);
      light.apply(c);
    }

    // ---- effects: never outlined, never dimmed
    drawSwing(c, g);
    drawShots(c, g, t);
    this.fx.draw(c);
    this.hud.drawWorld(g);
    c.restore();

    this.hud.drawScreen(g, input);
  }

  poly(x: number, y: number, r: number, sides: number, rot: number, jag = 0.86): void {
    const c = this.ctx;
    c.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const rr = r * (i % 2 ? jag : 1);
      if (i === 0) c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }
}
