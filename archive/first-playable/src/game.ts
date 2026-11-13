// The simulation. No DOM, no audio: it only reads Input and emits GameEvents,
// so it can also be run headless (see scripts/bot.ts).
import { CFG, type Beat } from './config';

export type EnemyKind = 'swarm' | 'shield' | 'burrower';

export interface Input {
  mx: number; // movement, each axis -1..1
  my: number;
  ax: number; // aim direction (unit) when hasAim
  ay: number;
  hasAim: boolean; // false: the game picks a sensible aim itself
  heavy: boolean; // held
  dodge: boolean; // pressed this frame
}

export type GameEvent =
  | { t: 'shot'; x1: number; y1: number; x2: number; y2: number; blocked: boolean }
  | { t: 'kill'; kind: EnemyKind; x: number; y: number; sweep: boolean }
  | { t: 'swing'; hits: number; struck: boolean }
  | { t: 'heavyHit'; x: number; y: number }
  | { t: 'shieldBreak'; x: number; y: number }
  | { t: 'nodeStrike'; x: number; y: number; rich: boolean; broke: boolean; dx: number; dy: number }
  | { t: 'pickup'; x: number; y: number }
  | { t: 'hurt'; dmg: number }
  | { t: 'dodge' }
  | { t: 'noStamina' }
  | { t: 'beat'; beat: Beat }
  | { t: 'waveStart'; wave: number }
  | { t: 'waveEnd'; wave: number }
  | { t: 'richOpen' }
  | { t: 'richClose' }
  | { t: 'burrowUp'; x: number; y: number }
  | { t: 'nodeBite'; x: number; y: number; ate: boolean }
  | { t: 'over'; died: boolean };

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  r: number;
  hp: number;
  shield: boolean;
  hitCd: number;
  flash: number;
  kx: number; // knockback velocity
  ky: number;
  wob: number;
  dead: boolean;
  // burrower only
  state: 'walk' | 'under' | 'emerging' | 'up';
  stateT: number;
  target: OreNode | null;
  biteT: number;
}

export interface OreNode {
  x: number;
  y: number;
  r: number;
  rich: boolean;
  open: boolean;
  alive: boolean;
  stage: number; // strikes already taken
  flash: number;
}

export interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  homing: boolean;
}

export interface Player {
  x: number;
  y: number;
  hp: number;
  stamina: number;
  staminaDelay: number;
  iframes: number;
  hurtCd: number;
  dodgeT: number;
  dodgeX: number;
  dodgeY: number;
  charging: boolean;
  charge: number; // 0..1
  chargeHeld: number;
  heavyWasDown: boolean;
  ax: number;
  ay: number;
  attackCd: number;
  swingT: number; // visual only
  carried: number;
}

export interface Stats {
  gathering: boolean;
  material: number;
  damageTaken: number;
  heatPeak: number;
  gatherTime: number;
  kills: number;
  wavesCleared: number;
  died: boolean;
}

interface Stream {
  rng: () => number;
  budget: number;
  next: EnemyKind;
}

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export class Game {
  readonly gathering: boolean;
  readonly seed: number;
  phase: 'wave' | 'intermission' | 'over' = 'wave';
  wave = 0;
  waveT = 0;
  interT = 0;
  beat: Beat = 'lull';
  time = 0;
  heat = 0;
  heatCoolT = 0;
  p: Player;
  enemies: Enemy[] = [];
  nodes: OreNode[] = [];
  pickups: Pickup[] = [];
  stats: Stats;
  events: GameEvent[] = [];

  private base!: Stream; // identical in both modes
  private extra!: Stream; // arrivals bought by heat
  private nextId = 1;

  constructor(gathering: boolean, seed = CFG.seed) {
    this.gathering = gathering;
    this.seed = seed;
    const c = CFG.player;
    this.p = {
      x: CFG.arena.w / 2,
      y: CFG.arena.h / 2,
      hp: c.hp,
      stamina: c.stamina,
      staminaDelay: 0,
      iframes: 0,
      hurtCd: 0,
      dodgeT: 0,
      dodgeX: 1,
      dodgeY: 0,
      charging: false,
      charge: 0,
      chargeHeld: 0,
      heavyWasDown: false,
      ax: 1,
      ay: 0,
      attackCd: 0.5,
      swingT: 0,
      carried: 0,
    };
    this.stats = {
      gathering,
      material: 0,
      damageTaken: 0,
      heatPeak: 0,
      gatherTime: 0,
      kills: 0,
      wavesCleared: 0,
      died: false,
    };
    this.startWave(0);
  }

  get waveDur(): number {
    return CFG.waves[this.wave];
  }

  get speedMul(): number {
    const c = CFG.player;
    return 1 - Math.min(c.weightSlowMax, this.p.carried * c.weightSlowPerUnit);
  }

  targetable(e: Enemy): boolean {
    return !e.dead && e.state !== 'under';
  }

  update(dt: number, inp: Input): void {
    this.events = [];
    if (this.phase === 'over') return;
    this.time += dt;

    if (this.phase === 'intermission') {
      this.interT -= dt;
      this.updatePlayer(dt, inp);
      this.updatePickups(dt);
      this.updateHeat(dt);
      if (this.interT <= 0) this.startWave(this.wave + 1);
      return;
    }

    this.waveT += dt;
    const beat = this.beatAt(this.waveT);
    if (beat !== this.beat) {
      this.beat = beat;
      this.events.push({ t: 'beat', beat });
      if (this.gathering) this.setRichOpen(beat === 'swell');
    }

    this.spawn(dt);
    this.updatePlayer(dt, inp);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateHeat(dt);
    for (const n of this.nodes) n.flash = Math.max(0, n.flash - dt);

    if (this.phase === 'wave' && this.waveT >= this.waveDur) this.endWave();
  }

  // ---------------------------------------------------------------- waves

  private beatAt(t: number): Beat {
    const f = t / this.waveDur;
    if (f < CFG.beats.lull) return 'lull';
    if (f < CFG.beats.lull + CFG.beats.swell) return 'swell';
    return 'peak';
  }

  private startWave(n: number): void {
    this.wave = n;
    this.waveT = 0;
    this.beat = 'lull';
    this.phase = 'wave';
    this.base = { rng: mulberry32(this.seed + n * 1009), budget: 0, next: 'swarm' };
    this.extra = { rng: mulberry32(this.seed + n * 1009 + 500), budget: 0, next: 'swarm' };
    this.base.next = this.rollKind(this.base.rng);
    this.extra.next = this.rollKind(this.extra.rng);
    this.nodes = this.gathering ? this.makeNodes(n) : [];
    this.events.push({ t: 'waveStart', wave: n });
  }

  private endWave(): void {
    for (const e of this.enemies) this.events.push({ t: 'kill', kind: e.kind, x: e.x, y: e.y, sweep: true });
    this.enemies = [];
    this.nodes = [];
    this.stats.wavesCleared = this.wave + 1;
    this.events.push({ t: 'waveEnd', wave: this.wave });
    if (this.wave >= CFG.waves.length - 1) {
      // nothing left on the ground is lost at the very end
      this.stats.material += this.pickups.length;
      this.pickups = [];
      this.phase = 'over';
      this.events.push({ t: 'over', died: false });
      return;
    }
    for (const k of this.pickups) k.homing = true;
    this.p.hp = Math.min(CFG.player.hp, this.p.hp + CFG.healBetweenWaves);
    this.phase = 'intermission';
    this.interT = CFG.intermission;
  }

  private makeNodes(wave: number): OreNode[] {
    const rng = mulberry32(this.seed * 3 + wave * 7919 + 11);
    const { w, h } = CFG.arena;
    const out: OreNode[] = [];
    const far = (x: number, y: number, min: number) => out.every((n) => Math.hypot(n.x - x, n.y - y) >= min);
    const cc = CFG.nodes.common;
    for (let i = 0; i < cc.count; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const x = w * (0.24 + rng() * 0.52);
        const y = h * (0.24 + rng() * 0.52);
        // keep the centre clear: the player starts there
        const clear = Math.hypot(x - w / 2, y - h / 2) > 120;
        if ((far(x, y, 150) && clear) || tries === 39) {
          out.push({ x, y, r: cc.r, rich: false, open: true, alive: true, stage: 0, flash: 0 });
          break;
        }
      }
    }
    const rc = CFG.nodes.rich;
    const inset = 75;
    for (let i = 0; i < rc.count; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const side = Math.floor(rng() * 4);
        const t = 0.12 + rng() * 0.76;
        const x = side === 0 ? inset : side === 1 ? w - inset : w * t;
        const y = side === 2 ? inset : side === 3 ? h - inset : h * t;
        if (far(x, y, 380) || tries === 39) {
          out.push({ x, y, r: rc.r, rich: true, open: false, alive: true, stage: 0, flash: 0 });
          break;
        }
      }
    }
    return out;
  }

  private setRichOpen(open: boolean): void {
    let any = false;
    for (const n of this.nodes) {
      if (n.rich && n.alive && n.open !== open) {
        n.open = open;
        any = true;
      }
    }
    if (any) this.events.push({ t: open ? 'richOpen' : 'richClose' });
  }

  // -------------------------------------------------------------- spawning

  private rollKind(rng: () => number): EnemyKind {
    const r = rng();
    if (this.beat === 'lull') return 'swarm';
    const [a, b, c] = CFG.spawn.mix[this.wave];
    const x = r * (a + b + c);
    return x < a ? 'swarm' : x < a + b ? 'shield' : 'burrower';
  }

  private spawn(dt: number): void {
    const rate = CFG.spawn.rate[this.beat] * CFG.spawn.waveMul[this.wave];
    this.base.budget += rate * dt;
    this.extra.budget += rate * CFG.heat.spawnBonus * (this.heat / CFG.heat.max) * dt;
    this.drain(this.base);
    this.drain(this.extra);
  }

  private drain(s: Stream): void {
    for (;;) {
      const cost = CFG.spawn.cost[s.next];
      if (s.budget < cost) return;
      if (this.enemies.length >= CFG.spawn.cap) {
        s.budget = cost; // do not bank arrivals while the arena is full
        return;
      }
      s.budget -= cost;
      this.spawnGroup(s.next, s.rng);
      s.next = this.rollKind(s.rng);
    }
  }

  private spawnGroup(kind: EnemyKind, rng: () => number): void {
    const { w, h } = CFG.arena;
    const side = Math.floor(rng() * 4);
    const t = rng();
    let x = side === 0 ? 20 : side === 1 ? w - 20 : w * t;
    let y = side === 2 ? 20 : side === 3 ? h - 20 : h * t;
    if (Math.hypot(x - this.p.x, y - this.p.y) < 260) {
      x = w - x;
      y = h - y;
    }
    const n = kind === 'swarm' ? CFG.enemies.swarm.pack : 1;
    for (let i = 0; i < n; i++) {
      const c = CFG.enemies[kind];
      this.enemies.push({
        id: this.nextId++,
        kind,
        x: x + (rng() - 0.5) * 50 * (n > 1 ? 1 : 0),
        y: y + (rng() - 0.5) * 50 * (n > 1 ? 1 : 0),
        r: c.r,
        hp: c.hp,
        shield: kind === 'shield',
        hitCd: 0,
        flash: 0,
        kx: 0,
        ky: 0,
        wob: rng() * 6.28,
        dead: false,
        state: kind === 'burrower' ? 'under' : 'walk',
        stateT: 0,
        target: null,
        biteT: 0,
      });
    }
  }

  // ---------------------------------------------------------------- player

  private updatePlayer(dt: number, inp: Input): void {
    const p = this.p;
    const c = CFG.player;
    p.iframes -= dt;
    p.hurtCd -= dt;
    p.swingT = Math.max(0, p.swingT - dt);

    const mlen = Math.hypot(inp.mx, inp.my);
    const mx = mlen > 1 ? inp.mx / mlen : inp.mx;
    const my = mlen > 1 ? inp.my / mlen : inp.my;

    if (inp.dodge && p.dodgeT <= 0) {
      if (p.stamina >= c.dodgeCost) {
        if (mlen > 0.2) {
          p.dodgeX = inp.mx / mlen;
          p.dodgeY = inp.my / mlen;
        } else {
          p.dodgeX = p.ax;
          p.dodgeY = p.ay;
        }
        p.dodgeT = c.dodgeTime;
        p.iframes = Math.max(p.iframes, c.dodgeIframes);
        p.stamina -= c.dodgeCost;
        p.staminaDelay = c.staminaDelay;
        p.charging = false;
        p.charge = 0;
        this.events.push({ t: 'dodge' });
      } else {
        this.events.push({ t: 'noStamina' });
      }
    }

    if (p.dodgeT > 0) {
      p.dodgeT -= dt;
      p.x += p.dodgeX * c.dodgeSpeed * dt;
      p.y += p.dodgeY * c.dodgeSpeed * dt;
    } else {
      if (inp.hasAim) {
        p.ax = inp.ax;
        p.ay = inp.ay;
      } else if (inp.heavy) {
        this.autoAim();
      } else if (mlen > 0.2) {
        p.ax = inp.mx / mlen;
        p.ay = inp.my / mlen;
      }

      if (inp.heavy) {
        if (!p.charging && !p.heavyWasDown) {
          if (p.stamina >= c.heavyCost) {
            p.charging = true;
            p.charge = 0;
            p.chargeHeld = 0;
          } else {
            this.events.push({ t: 'noStamina' });
          }
        }
        if (p.charging) {
          p.charge = Math.min(1, p.charge + dt / c.chargeTime);
          p.chargeHeld += dt;
        }
      } else if (p.charging) {
        if (p.charge >= 1) this.swing();
        p.charging = false;
        p.charge = 0;
      }

      const sp = c.speed * this.speedMul * (p.charging ? c.chargeMoveMul : 1);
      p.x += mx * sp * dt;
      p.y += my * sp * dt;
    }
    p.heavyWasDown = inp.heavy;

    // nodes are solid
    for (const n of this.nodes) {
      if (!n.alive || !n.open) continue;
      const dx = p.x - n.x;
      const dy = p.y - n.y;
      const d = Math.hypot(dx, dy) || 1;
      const min = n.r + c.r;
      if (d < min) {
        p.x = n.x + (dx / d) * min;
        p.y = n.y + (dy / d) * min;
      }
    }
    p.x = Math.max(c.r, Math.min(CFG.arena.w - c.r, p.x));
    p.y = Math.max(c.r, Math.min(CFG.arena.h - c.r, p.y));

    p.staminaDelay -= dt;
    if (p.staminaDelay <= 0 && !p.charging) p.stamina = Math.min(c.stamina, p.stamina + c.staminaRegen * dt);

    // automatic light attack
    p.attackCd -= dt;
    if (p.attackCd <= 0 && !p.charging && p.dodgeT <= 0) {
      let best: Enemy | null = null;
      let bestD = Infinity;
      for (const e of this.enemies) {
        if (!this.targetable(e)) continue;
        // unshielded targets first; a shielded one is shot only if nothing else is in range
        const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r + (e.shield ? 10000 : 0);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best && bestD - (best.shield ? 10000 : 0) <= c.lightRange) {
        p.attackCd = c.lightEvery;
        this.events.push({ t: 'shot', x1: p.x, y1: p.y, x2: best.x, y2: best.y, blocked: best.shield });
        if (!best.shield) {
          const d = Math.hypot(best.x - p.x, best.y - p.y) || 1;
          this.hurtEnemy(best, c.lightDmg, ((best.x - p.x) / d) * 60, ((best.y - p.y) / d) * 60);
        }
      }
    }
  }

  private autoAim(): void {
    const p = this.p;
    let tx = 0;
    let ty = 0;
    let bestD = Infinity;
    const reach = CFG.player.heavyRange;
    for (const n of this.nodes) {
      if (!n.alive || !n.open) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y) - n.r;
      if (d < reach + 20 && d < bestD) {
        bestD = d;
        tx = n.x;
        ty = n.y;
      }
    }
    if (bestD === Infinity) {
      for (const e of this.enemies) {
        if (!this.targetable(e)) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r - (e.shield ? 60 : 0);
        if (d < 200 && d < bestD) {
          bestD = d;
          tx = e.x;
          ty = e.y;
        }
      }
    }
    if (bestD === Infinity) return;
    const d = Math.hypot(tx - p.x, ty - p.y) || 1;
    p.ax = (tx - p.x) / d;
    p.ay = (ty - p.y) / d;
  }

  private swing(): void {
    const p = this.p;
    const c = CFG.player;
    p.stamina -= c.heavyCost;
    p.staminaDelay = c.staminaDelay;
    p.swingT = 0.18;
    const ang = Math.atan2(p.ay, p.ax);
    let hits = 0;
    for (const e of this.enemies) {
      if (!this.targetable(e)) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > c.heavyRange + e.r) continue;
      if (angDiff(Math.atan2(dy, dx), ang) > c.heavyArc + Math.asin(Math.min(1, e.r / d))) continue;
      if (e.shield) {
        e.shield = false;
        this.events.push({ t: 'shieldBreak', x: e.x, y: e.y });
      }
      this.events.push({ t: 'heavyHit', x: e.x, y: e.y });
      this.hurtEnemy(e, c.heavyDmg, (dx / d) * c.heavyKnock, (dy / d) * c.heavyKnock);
      hits++;
    }
    let node: OreNode | null = null;
    let nodeD = Infinity;
    for (const n of this.nodes) {
      if (!n.alive || !n.open) continue;
      const dx = n.x - p.x;
      const dy = n.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > c.heavyRange + n.r) continue;
      if (angDiff(Math.atan2(dy, dx), ang) > c.heavyArc + Math.asin(Math.min(1, n.r / d))) continue;
      if (d < nodeD) {
        nodeD = d;
        node = n;
      }
    }
    if (node) this.strike(node);
    this.events.push({ t: 'swing', hits, struck: node !== null });
  }

  private strike(n: OreNode): void {
    const p = this.p;
    const cfg = n.rich ? CFG.nodes.rich : CFG.nodes.common;
    const drops = cfg.drops[n.stage];
    n.stage++;
    n.flash = 0.15;
    const broke = n.stage >= cfg.drops.length;
    if (broke) n.alive = false;
    const back = Math.atan2(p.y - n.y, p.x - n.x);
    for (let i = 0; i < drops; i++) {
      const a = back + (Math.random() - 0.5) * 2.4;
      const s = 120 + Math.random() * 160;
      this.pickups.push({ x: n.x, y: n.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, homing: false });
    }
    this.heat = Math.min(CFG.heat.max, this.heat + (n.rich ? CFG.heat.rich : CFG.heat.common));
    this.heatCoolT = CFG.heat.coolDelay;
    this.stats.gatherTime += p.chargeHeld + 0.15;
    this.events.push({ t: 'nodeStrike', x: n.x, y: n.y, rich: n.rich, broke, dx: p.ax, dy: p.ay });
  }

  private hurtEnemy(e: Enemy, dmg: number, kx: number, ky: number): void {
    e.hp -= dmg;
    e.flash = 0.1;
    e.kx += kx;
    e.ky += ky;
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      this.stats.kills++;
      this.events.push({ t: 'kill', kind: e.kind, x: e.x, y: e.y, sweep: false });
    }
  }

  private hurtPlayer(dmg: number): void {
    const p = this.p;
    if (p.iframes > 0 || p.hurtCd > 0 || this.phase !== 'wave') return;
    p.hp -= dmg;
    p.hurtCd = CFG.player.hurtInvuln;
    this.stats.damageTaken += dmg;
    if (CFG.player.hitCancelsCharge) {
      p.charging = false;
      p.charge = 0;
    }
    this.events.push({ t: 'hurt', dmg });
    if (p.hp <= 0) {
      p.hp = 0;
      this.stats.died = true;
      this.phase = 'over';
      this.events.push({ t: 'over', died: true });
    }
  }

  // --------------------------------------------------------------- enemies

  private updateEnemies(dt: number): void {
    const p = this.p;
    const { w, h } = CFG.arena;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hitCd -= dt;
      e.flash = Math.max(0, e.flash - dt);
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let vx = 0;
      let vy = 0;

      if (e.kind === 'swarm') {
        const a = Math.atan2(dy, dx) + Math.sin(this.time * 3 + e.wob) * 0.35;
        vx = Math.cos(a) * CFG.enemies.swarm.speed;
        vy = Math.sin(a) * CFG.enemies.swarm.speed;
      } else if (e.kind === 'shield') {
        vx = (dx / d) * CFG.enemies.shield.speed;
        vy = (dy / d) * CFG.enemies.shield.speed;
      } else {
        [vx, vy] = this.burrower(e, dt, dx, dy, d);
      }

      const decay = Math.exp(-8 * dt);
      e.kx *= decay;
      e.ky *= decay;
      e.x = Math.max(e.r, Math.min(w - e.r, e.x + (vx + e.kx) * dt));
      e.y = Math.max(e.r, Math.min(h - e.r, e.y + (vy + e.ky) * dt));

      if (e.state !== 'under' && e.state !== 'emerging' && e.hitCd <= 0 && d < e.r + CFG.player.r + 2) {
        e.hitCd = CFG.enemies[e.kind].hitEvery;
        this.hurtPlayer(CFG.enemies[e.kind].dmg);
        if (this.phase === 'over') return;
      }
    }

    // keep surfaced enemies from stacking
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.state === 'under') continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.state === 'under') continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < min) {
          const push = (min - d) / 2;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
        }
      }
    }
    if (es.some((e) => e.dead)) this.enemies = es.filter((e) => !e.dead);
  }

  /** Burrower state machine. Returns its walking velocity. */
  private burrower(e: Enemy, dt: number, dx: number, dy: number, d: number): [number, number] {
    const c = CFG.enemies.burrower;
    const nodeOk = (n: OreNode | null): n is OreNode => n !== null && n.alive && n.open;

    if (e.state === 'under') {
      if (!nodeOk(e.target)) {
        e.target = null;
        let bestD = Infinity;
        for (const n of this.nodes) {
          if (!nodeOk(n)) continue;
          const nd = Math.hypot(n.x - e.x, n.y - e.y) - (n.rich ? 5000 : 0); // rich veins first
          if (nd < bestD) {
            bestD = nd;
            e.target = n;
          }
        }
      }
      let tx = this.p.x;
      let ty = this.p.y;
      let stop = 55;
      if (e.target) {
        const a = Math.atan2(e.y - e.target.y, e.x - e.target.x);
        tx = e.target.x + Math.cos(a) * (e.target.r + e.r);
        ty = e.target.y + Math.sin(a) * (e.target.r + e.r);
        stop = 6;
      }
      const td = Math.hypot(tx - e.x, ty - e.y) || 1;
      if (td <= stop) {
        e.state = 'emerging';
        e.stateT = c.emergeTime;
        this.events.push({ t: 'burrowUp', x: e.x, y: e.y });
        return [0, 0];
      }
      return [((tx - e.x) / td) * c.speedUnder, ((ty - e.y) / td) * c.speedUnder];
    }

    if (e.state === 'emerging') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        e.state = 'up';
        e.stateT = c.huntTime;
        e.biteT = c.biteEvery;
      }
      return [0, 0];
    }

    // up
    if (e.target) {
      if (!nodeOk(e.target)) {
        e.target = null;
        e.state = 'under';
        return [0, 0];
      }
      e.biteT -= dt;
      if (e.biteT <= 0) {
        e.biteT = c.biteEvery;
        const n = e.target;
        const len = (n.rich ? CFG.nodes.rich : CFG.nodes.common).drops.length;
        n.stage++;
        n.flash = 0.15;
        const ate = n.stage >= len;
        if (ate) n.alive = false;
        this.events.push({ t: 'nodeBite', x: n.x, y: n.y, ate });
      }
      return [0, 0];
    }
    e.stateT -= dt;
    if (e.stateT <= 0) {
      e.state = 'under';
      return [0, 0];
    }
    return [(dx / d) * c.speedUp, (dy / d) * c.speedUp];
  }

  // ------------------------------------------------------- pickups and heat

  private updatePickups(dt: number): void {
    const p = this.p;
    let collected = false;
    for (const k of this.pickups) {
      k.age += dt;
      const dx = p.x - k.x;
      const dy = p.y - k.y;
      const d = Math.hypot(dx, dy) || 1;
      if (k.age > 0.3 && (k.homing || d < CFG.player.magnet)) {
        k.homing = true;
        const s = 420 + k.age * 300;
        k.vx = (dx / d) * s;
        k.vy = (dy / d) * s;
        if (d < CFG.player.r + 8) {
          k.age = -1;
          collected = true;
          p.carried++;
          this.stats.material++;
          this.events.push({ t: 'pickup', x: k.x, y: k.y });
          continue;
        }
      } else {
        const f = Math.exp(-5 * dt);
        k.vx *= f;
        k.vy *= f;
      }
      k.x += k.vx * dt;
      k.y += k.vy * dt;
    }
    if (collected) this.pickups = this.pickups.filter((k) => k.age >= 0);
  }

  private updateHeat(dt: number): void {
    this.heatCoolT -= dt;
    if (this.heatCoolT <= 0) this.heat = Math.max(0, this.heat - CFG.heat.coolRate * dt);
    if (this.heat > this.stats.heatPeak) this.stats.heatPeak = this.heat;
  }
}
