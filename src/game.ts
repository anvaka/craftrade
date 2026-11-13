// One wave in the arena. No DOM, no audio: it reads Input, emits GameEvents and
// returns a WaveResult, so it can also run headless (scripts/bot.ts).
import {
  CFG, EVOLVE_MUL, GROUNDS, MATS, NODE_MAT, WEAPONS, TIER_MUL,
  type Beat, type BossDef, type EliteDef, type EnemyKind, type Fam, type Ground, type Mat, type Mods, type NodeKind, type Objective,
} from './data';

export interface Input {
  mx: number;
  my: number;
  ax: number;
  ay: number;
  hasAim: boolean;
  aimDist: number; // how far the cursor is from the player, in world units (0: unknown)
  heavy: boolean;
  dodge: boolean;
  ability: boolean;
  swap: boolean;
}
export const idleInput = (): Input => ({ mx: 0, my: 0, ax: 1, ay: 0, hasAim: false, aimDist: 0, heavy: false, dodge: false, ability: false, swap: false });

export interface WeaponInst {
  fam: Fam;
  tier: number;
  gs: number; // 0..1 roll inside the tier's range
  variant: boolean;
  evolved: boolean;
  dmg: number; // run totals, for the tally
  kills: number;
}

export interface Feat {
  dodge: boolean;
  loss: boolean;
  gates: boolean;
  ability: boolean;
  craft: boolean;
  routes: boolean;
  heat: boolean;
  rich: boolean;
  schem: boolean;
}

export interface WaveSpec {
  seed: number;
  index: number;
  dur: number;
  ground: Ground;
  tier: number;
  objective: Objective;
  elite: EliteDef | null;
  boss: BossDef | null;
  mods: Mods;
  weapons: WeaponInst[];
  sealed: number; // index of a weapon that may not fire, or -1
  slotPenalty: number; // damage multiplier from the Seventh hand pick
  slots: number; // weapon slots this expedition has, for the HUD
  abilities: Fam[];
  abilityIdx: number;
  hp: number;
  maxHp: number;
  baseWeight: number;
  comfort: number;
  burden: Mat['cat'] | null;
  toolNode: string;
  strike: number;
  hpMul: number;
  dmgMul: number;
  rateMul: number;
  chargeMul: number;
  feat: Feat;
  mutators: string[];
  richInPeak: boolean;
  dodgeMul: number; // stamina cost of a dodge, as a share of the normal cost
  noSlow: boolean; // weight never slows (Stone back)
  noDodge: boolean;
  heatHolds: boolean;
  heat: number;
}

export interface WaveResult {
  died: boolean;
  hp: number;
  heat: number;
  gathered: Record<string, number>;
  scrap: number;
  xp: number;
  kills: number;
  famKills: Record<string, number>;
  dmgBy: number[]; // per weapon, then heavy swing, then ability and triggers
  killsBy: number[];
  dmgTaken: number;
  heatPeak: number;
  gatherTime: number;
  time: number;
  objective: boolean;
  bossKilled: boolean;
  armorBreaks: number;
  elitesKilled: string[];
  abilityIdx: number;
  hpStart?: number; // health when the wave began
  killer?: string; // what dealt the last blow, as it reads after "Felled by": "a spitter", "Old Thornback"
  lastHits?: { by: string; dmg: number; t: number }[]; // the last few hits taken, oldest first
  hotSpawned?: number; // enemies that arrived because of heat
  heatBonus?: number; // units of node material that heat added to the strikes
  objScrap?: number; // scrap the finished objective paid, as it was paid
  objHeal?: number; // health the finished objective really restored (0 when healing was forbidden or health was full)
}

export type GameEvent =
  | { t: 'shot'; x1: number; y1: number; x2: number; y2: number; color: string }
  | { t: 'sweep'; x: number; y: number; ang: number; r: number; full: boolean; color: string }
  | { t: 'burst'; x: number; y: number; r: number; color: string; hostile?: boolean }
  | { t: 'tink'; x: number; y: number }
  | { t: 'kill'; kind: EnemyKind; x: number; y: number; sweep: boolean; big: boolean }
  | { t: 'swing'; hits: number; struck: boolean }
  | { t: 'heavyHit'; x: number; y: number }
  | { t: 'shieldBreak'; x: number; y: number }
  | { t: 'nodeStrike'; x: number; y: number; rich: boolean; broke: boolean; dx: number; dy: number; color: string; mat: string; hot: number } // hot: units added by heat
  | { t: 'closedVein'; x: number; y: number } // a swing landed on a rich vein that is not open
  | { t: 'pickup'; x: number; y: number; part: boolean; mat: string }
  | { t: 'swept'; mats: Record<string, number> } // drops still on the ground when the clock ran out: all collected
  | { t: 'hurt'; dmg: number; x: number; y: number; by: string } // x, y: where the blow came from
  | { t: 'dodge' }
  | { t: 'noStamina' }
  | { t: 'early' } // the heavy button was let go before the wind-up was full
  | { t: 'notReady'; left: number } // the ability was pressed during its cooldown
  | { t: 'ability'; fam: Fam }
  | { t: 'swap' }
  | { t: 'beat'; beat: Beat }
  | { t: 'richOpen' }
  | { t: 'richClose' }
  | { t: 'burrowUp'; x: number; y: number }
  | { t: 'nodeBite'; x: number; y: number; ate: boolean }
  | { t: 'spit' }
  | { t: 'telegraph'; x: number; y: number }
  | { t: 'say'; text: string; color: string }
  | { t: 'objective'; done: boolean; scrap: number; heal: number }
  | { t: 'over'; died: boolean };

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  shield: boolean;
  hitCd: number;
  flash: number;
  kx: number;
  ky: number;
  wob: number;
  dead: boolean;
  elite: EliteDef | null;
  boss: BossDef | null;
  burnT: number;
  burnDps: number;
  chillT: number;
  chill: number;
  stunT: number;
  t1: number; // behaviour timers
  t2: number;
  t3: number;
  t4: number;
  tele: number; // boss charge wind-up
  dash: number;
  dx: number;
  dy: number;
  armorIdx: number;
  hot: boolean; // arrived because of heat: pays little scrap and xp
  state: 'walk' | 'under' | 'emerging' | 'up';
  stateT: number;
  target: OreNode | null;
  biteT: number;
}

export interface OreNode {
  x: number;
  y: number;
  r: number;
  kind: NodeKind | 'nest';
  rich: boolean;
  open: boolean;
  alive: boolean;
  stage: number;
  stages: number;
  flash: number;
}

export interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  homing: boolean;
  mat: string;
}

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  pierce: number;
  hostile: boolean;
  wi: number;
  kind: 'arrow' | 'fire' | 'shard' | 'spit' | 'splinter';
  hit: number[];
  split: boolean;
  color: string;
  src?: Enemy; // who fired a hostile shot
}

export interface Zone {
  x: number;
  y: number;
  r: number;
  t: number;
  kind: 'fire' | 'meteor' | 'blast' | 'supply';
  dps: number;
  wi: number;
  tick: number;
  by?: string; // what a hostile blast is called when it fells you
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
  dodgeCd: number;
  dodgeX: number;
  dodgeY: number;
  charging: boolean;
  charge: number;
  chargeHeld: number;
  heavyWasDown: boolean;
  ax: number;
  ay: number;
  swingT: number;
  moving: boolean;
  abilityCd: number;
  abilityMax: number;
  quickNext: boolean;
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

interface Stream {
  rng: () => number;
  budget: number;
  next: EnemyKind;
  hot: boolean;
}
interface HitOpts {
  heavy?: boolean;
  noChain?: boolean;
  burn?: number;
  chill?: number;
  stun?: number;
  kx?: number;
  ky?: number;
}

const HEAVY = -1;
const OTHER = -2;
const KIND_NAME: Record<EnemyKind, string> = {
  swarm: 'the swarm', shield: 'a shield-bearer', burrower: 'a burrower', spitter: 'a spitter', charger: 'a charger', bomber: 'a bomber', brute: 'a brute', boss: 'the boss',
};
/** How an enemy reads after "Felled by". */
export const enemyName = (e: Enemy): string => (e.boss ? e.boss.name : e.elite ? e.elite.name : KIND_NAME[e.kind]);

export class Game {
  readonly spec: WaveSpec;
  readonly m: Mods;
  phase: 'wave' | 'over' = 'wave';
  waveT = 0;
  beat: Beat = 'lull';
  time = 0;
  heat: number;
  heatCoolT = 0;
  p: Player;
  enemies: Enemy[] = [];
  nodes: OreNode[] = [];
  pickups: Pickup[] = [];
  shots: Shot[] = [];
  zones: Zone[] = [];
  events: GameEvent[] = [];
  res: WaveResult;
  abilityIdx: number;
  weight: number;
  supplyT = 0;
  objectiveText = '';
  bossRef: Enemy | null = null;
  firedAt: number[]; // per weapon slot: this.time when it last fired (for the HUD)
  killer: { name: string; x: number; y: number; enemy: Enemy | null } | null = null; // set when the player falls

  private cds: number[];
  private base: Stream;
  private extra: Stream;
  private rnd: () => number;
  private nextId = 1;
  private endIn = -1;
  private eliteSpawned = false;
  private bossSpawned = false;
  private auraT = 0;
  private lull: number;
  private swell: number;

  constructor(spec: WaveSpec) {
    this.spec = spec;
    this.m = spec.mods;
    this.heat = spec.heat;
    this.abilityIdx = spec.abilityIdx;
    this.weight = spec.baseWeight;
    const c = CFG.player;
    this.p = {
      x: CFG.arena.w / 2, y: CFG.arena.h / 2, hp: spec.hp, stamina: c.stamina, staminaDelay: 0, iframes: 0, hurtCd: 0,
      dodgeT: 0, dodgeCd: 0, dodgeX: 1, dodgeY: 0, charging: false, charge: 0, chargeHeld: 0, heavyWasDown: false, ax: 1, ay: 0,
      swingT: 0, moving: false, abilityCd: 0, abilityMax: 1, quickNext: false,
    };
    const n = spec.weapons.length;
    this.res = {
      died: false, hp: spec.hp, heat: 0, gathered: {}, scrap: 0, xp: 0, kills: 0, famKills: {},
      dmgBy: new Array(n + 2).fill(0), killsBy: new Array(n + 2).fill(0), dmgTaken: 0, heatPeak: this.heat, gatherTime: 0, time: 0,
      objective: false, bossKilled: false, armorBreaks: 0, elitesKilled: [], abilityIdx: this.abilityIdx,
    };
    this.res.hpStart = spec.hp;
    this.res.lastHits = [];
    this.res.hotSpawned = 0;
    this.res.heatBonus = 0;
    this.firedAt = spec.weapons.map(() => -9);
    this.cds = spec.weapons.map((_, i) => 0.3 + i * 0.12);
    this.rnd = mulberry32(spec.seed + 77);
    this.lull = spec.mutators.includes('longswell') ? 0.2 : CFG.beats.lull;
    this.swell = spec.mutators.includes('longswell') ? 0.6 : CFG.beats.swell;
    this.base = { rng: mulberry32(spec.seed), budget: 0, next: 'swarm', hot: false };
    this.extra = { rng: mulberry32(spec.seed + 500), budget: 0, next: 'swarm', hot: true };
    this.base.next = this.rollKind(this.base);
    this.extra.next = this.rollKind(this.extra);
    this.makeNodes();
    if (spec.objective === 'supply') {
      const a = this.rnd() * 6.28;
      this.zones.push({ x: CFG.arena.w / 2 + Math.cos(a) * 330, y: CFG.arena.h / 2 + Math.sin(a) * 240, r: 95, t: 1e9, kind: 'supply', dps: 0, wi: OTHER, tick: 0 });
      this.objectiveText = 'Hold the supply circle';
    } else if (spec.objective === 'nests') this.objectiveText = 'Break the nests before the peak';
    else if (spec.objective === 'elite' && spec.elite) this.objectiveText = `${spec.elite.name} is coming`;
    if (spec.boss) this.objectiveText = spec.boss.name;
  }

  get dur(): number {
    return this.spec.dur;
  }
  get lullShare(): number {
    return this.lull;
  }
  get swellShare(): number {
    return this.swell;
  }

  /** How much the bag slows the player right now, 0..slowMax. */
  get slow(): number {
    if (this.spec.noSlow) return 0;
    const over = Math.max(0, this.weight - this.spec.comfort);
    return Math.min(CFG.player.slowMax, over * CFG.player.slowPerWeight);
  }

  // Read-only views for the HUD. They repeat the formulas used below and change no rule.
  /** Stamina a heavy swing costs right now. */
  get heavyCost(): number {
    return CFG.player.heavyCost * Math.max(0.3, 1 - this.m.heavyCost);
  }
  /** Stamina a dodge costs right now. */
  get dodgeCost(): number {
    return CFG.player.dodgeCost * this.spec.dodgeMul;
  }
  /** Enemies arriving because of heat, as a share of the normal rate (0.6 means +60%). */
  get heatSpawn(): number {
    return CFG.heat.spawnBonus * Math.pow(this.heat / CFG.heat.max, CFG.heat.curve);
  }
  /** How much more a strike gives at the current heat than the same strike cold, for this build (0.24 means +24%). */
  get heatYield(): number {
    return (CFG.heat.yieldBonus * (this.heat / CFG.heat.max)) / Math.max(0.01, 1 + this.m.yield);
  }
  /** Scrap a finished supply drop or nests objective pays this build. */
  get objectiveScrap(): number {
    return 25 * Math.max(0, 1 + this.m.scrap);
  }
  /** Heavy swings a node still takes with this tool and kit. */
  swingsLeft(n: OreNode, stages = n.stages - n.stage): number {
    const power = n.kind === 'nest' ? 1 : 1 + (this.spec.toolNode === n.kind ? 1 : 0) + this.spec.strike;
    return Math.ceil(Math.max(0, stages) / power);
  }
  /** Seconds until the open rich veins close; Infinity when none is open. */
  get richCloseIn(): number {
    if (this.phase !== 'wave' || !this.nodes.some((n) => n.rich && n.alive && n.open)) return Infinity;
    return (this.spec.richInPeak ? this.dur : (this.lull + this.swell) * this.dur) - this.waveT;
  }

  targetable(e: Enemy): boolean {
    return !e.dead && e.state !== 'under';
  }

  update(dt: number, inp: Input): void {
    this.events = [];
    if (this.phase === 'over') return;
    this.time += dt;
    this.waveT += dt;

    const f = this.waveT / this.dur;
    const beat: Beat = f < this.lull ? 'lull' : f < this.lull + this.swell ? 'swell' : 'peak';
    if (beat !== this.beat) {
      this.beat = beat;
      this.events.push({ t: 'beat', beat });
      if (beat === 'swell') this.onSwell();
      if (beat === 'peak') this.onPeak();
    }
    if (this.spec.boss && !this.bossSpawned && this.waveT > 2.5) this.spawnBoss();

    this.spawn(dt);
    this.updatePlayer(dt, inp);
    if (this.isOver()) return;
    this.updateWeapons(dt);
    this.updateEnemies(dt);
    if (this.isOver()) return;
    this.updateShots(dt);
    this.updateZones(dt);
    this.updatePickups(dt);
    this.updateHeat(dt);
    for (const n of this.nodes) n.flash = Math.max(0, n.flash - dt);
    if (this.m.regen > 0) this.heal(this.m.regen * dt);

    if (this.endIn > 0) {
      this.endIn -= dt;
      if (this.endIn <= 0) this.finish(false);
    } else if (this.waveT >= this.dur) this.finish(false);
  }

  private isOver(): boolean {
    return this.phase === 'over';
  }

  private finish(died: boolean): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    if (!died) {
      for (const e of this.enemies) this.events.push({ t: 'kill', kind: e.kind, x: e.x, y: e.y, sweep: true, big: false });
      if (this.pickups.length) {
        const mats: Record<string, number> = {};
        for (const k of this.pickups) mats[k.mat] = (mats[k.mat] ?? 0) + 1;
        this.events.push({ t: 'swept', mats });
      }
      for (const k of this.pickups) this.collect(k); // nothing on the ground is lost when the clock runs out
      this.pickups = [];
      this.enemies = [];
    }
    this.res.died = died;
    this.res.hp = Math.max(0, this.p.hp);
    this.res.heat = this.heat;
    this.res.time = this.waveT;
    this.res.abilityIdx = this.abilityIdx;
    this.events.push({ t: 'over', died });
  }

  // ------------------------------------------------------------- wave beats

  private makeNodes(): void {
    const rng = mulberry32(this.spec.seed * 3 + 11);
    const { w, h } = CFG.arena;
    const kind = GROUNDS[this.spec.ground].node;
    const far = (x: number, y: number, min: number) => this.nodes.every((n) => Math.hypot(n.x - x, n.y - y) >= min);
    const cc = CFG.nodes.common;
    for (let i = 0; i < cc.count; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const x = w * (0.22 + rng() * 0.56);
        const y = h * (0.22 + rng() * 0.56);
        const clear = Math.hypot(x - w / 2, y - h / 2) > 120;
        if ((far(x, y, 150) && clear) || tries === 39) {
          this.nodes.push({ x, y, r: cc.r, kind, rich: false, open: true, alive: true, stage: 0, stages: cc.drops.length, flash: 0 });
          break;
        }
      }
    }
    if (!this.spec.feat.rich) return;
    const rc = CFG.nodes.rich;
    const inset = 75;
    for (let i = 0; i < rc.count; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const side = Math.floor(rng() * 4);
        const t = 0.12 + rng() * 0.76;
        const x = side === 0 ? inset : side === 1 ? w - inset : w * t;
        const y = side === 2 ? inset : side === 3 ? h - inset : h * t;
        if (far(x, y, 380) || tries === 39) {
          this.nodes.push({ x, y, r: rc.r, kind, rich: true, open: false, alive: true, stage: 0, stages: rc.drops.length, flash: 0 });
          break;
        }
      }
    }
  }

  private onSwell(): void {
    let any = false;
    for (const n of this.nodes) {
      if (n.rich && n.alive) {
        n.open = true;
        any = true;
      }
    }
    if (any) this.events.push({ t: 'richOpen' });
    if (this.spec.objective === 'nests') {
      for (let i = 0; i < 3; i++) {
        const a = this.rnd() * 6.28;
        const x = CFG.arena.w / 2 + Math.cos(a) * (220 + this.rnd() * 260);
        const y = CFG.arena.h / 2 + Math.sin(a) * (160 + this.rnd() * 180);
        this.nodes.push({ x, y, r: 20, kind: 'nest', rich: false, open: true, alive: true, stage: 0, stages: 2, flash: 0 });
      }
      this.events.push({ t: 'say', text: 'NESTS: BREAK THEM', color: '#ff7ab8' });
    }
    if (this.spec.elite && !this.eliteSpawned) {
      this.eliteSpawned = true;
      this.spawnElite(this.spec.elite);
    }
  }

  private onPeak(): void {
    if (!this.spec.richInPeak) {
      let any = false;
      for (const n of this.nodes) {
        if (n.rich && n.alive && n.open) {
          n.open = false;
          any = true;
        }
      }
      if (any) this.events.push({ t: 'richClose' });
    }
    if (this.spec.objective === 'nests') {
      let hatched = 0;
      for (const n of this.nodes) {
        if (n.kind === 'nest' && n.alive) {
          n.alive = false;
          hatched++;
          this.addEnemy('brute', n.x, n.y);
        }
      }
      if (hatched === 0) this.objectiveDone();
      else this.events.push({ t: 'say', text: `${hatched} NEST${hatched > 1 ? 'S' : ''} HATCHED`, color: '#ff7ab8' });
    }
  }

  private objectiveDone(): void {
    if (this.res.objective) return;
    this.res.objective = true;
    this.objectiveText = '';
    let scrap = 0;
    let heal = 0;
    if (this.spec.objective === 'supply' || this.spec.objective === 'nests') {
      scrap = this.objectiveScrap;
      this.res.scrap += scrap;
      const before = this.p.hp;
      this.heal(15);
      this.res.objScrap = scrap;
      this.res.objHeal = this.p.hp - before;
      heal = this.p.hp - before; // the banner claims what was really healed: nothing under a no-healing effect or at full health
    }
    this.events.push({ t: 'objective', done: true, scrap, heal });
  }

  // -------------------------------------------------------------- spawning

  private rollKind(s: Stream): EnemyKind {
    const r = s.rng();
    const i = this.spec.index;
    if (i === 0 || (this.beat === 'lull' && !s.hot)) return 'swarm';
    const lean = GROUNDS[this.spec.ground].lean;
    const w: [EnemyKind, number][] = [
      ['swarm', s.hot ? 3 : 6],
      ['shield', 2],
      ['burrower', 2],
      ['spitter', i >= 2 ? 2 : 0],
      ['charger', i >= 4 ? 1.5 : 0],
      ['bomber', i >= 8 ? 1.5 : 0],
      ['brute', i >= 8 ? 1 : i >= 4 ? 0.5 : 0],
    ];
    let total = 0;
    for (const e of w) {
      if (e[0] === lean) e[1] *= 2.5;
      total += e[1];
    }
    let x = r * total;
    for (const [k, v] of w) {
      if (x < v) return k;
      x -= v;
    }
    return 'swarm';
  }

  private spawn(dt: number): void {
    const rate = CFG.spawn.rate[this.beat] * CFG.spawn.waveMul[this.spec.index] * this.spec.rateMul;
    this.base.budget += rate * dt;
    this.extra.budget += rate * CFG.heat.spawnBonus * Math.pow(this.heat / CFG.heat.max, CFG.heat.curve) * dt;
    this.drain(this.base);
    this.drain(this.extra);
  }

  private drain(s: Stream): void {
    for (;;) {
      const cost = CFG.spawn.cost[s.next];
      if (s.budget < cost) return;
      if (this.enemies.length >= CFG.spawn.cap) {
        s.budget = cost;
        return;
      }
      s.budget -= cost;
      const [x, y] = this.edgePoint(s.rng);
      const n = s.next === 'swarm' ? 4 : 1;
      for (let i = 0; i < n; i++) this.addEnemy(s.next, x + (n > 1 ? (s.rng() - 0.5) * 50 : 0), y + (n > 1 ? (s.rng() - 0.5) * 50 : 0)).hot = s.hot;
      if (s.hot) this.res.hotSpawned = (this.res.hotSpawned ?? 0) + n;
      s.next = this.rollKind(s);
    }
  }

  private edgePoint(rng: () => number): [number, number] {
    const { w, h } = CFG.arena;
    const side = Math.floor(rng() * 4);
    const t = rng();
    let x = side === 0 ? 20 : side === 1 ? w - 20 : w * t;
    let y = side === 2 ? 20 : side === 3 ? h - 20 : h * t;
    if (Math.hypot(x - this.p.x, y - this.p.y) < 260) {
      x = w - x;
      y = h - y;
    }
    return [x, y];
  }

  private addEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    const c = CFG.enemies[kind];
    const hp = c.hp * CFG.spawn.hpMul[this.spec.index] * this.spec.hpMul;
    const e: Enemy = {
      id: this.nextId++, kind, x, y, r: c.r, hp, maxHp: hp, speed: c.speed, dmg: c.dmg, shield: kind === 'shield', hitCd: 0.3, flash: 0,
      kx: 0, ky: 0, wob: this.rnd() * 6.28, dead: false, elite: null, boss: null, burnT: 0, burnDps: 0, chillT: 0, chill: 0, stunT: 0,
      t1: 1 + this.rnd() * 2, t2: 3, t3: 4, t4: 5, tele: 0, dash: 0, dx: 0, dy: 0, armorIdx: 0, hot: false,
      state: kind === 'burrower' ? 'under' : 'walk', stateT: 0, target: null, biteT: 0,
    };
    this.enemies.push(e);
    return e;
  }

  private spawnElite(def: EliteDef): void {
    const [x, y] = this.edgePoint(this.rnd);
    const e = this.addEnemy(def.base, x, y);
    e.elite = def;
    e.r *= 1.7;
    e.hp = e.maxHp = CFG.enemies[def.base].hp * 9 * CFG.spawn.hpMul[this.spec.index] * this.spec.hpMul;
    e.dmg *= 1.5;
    if (def.id === 'ashfang') e.speed = 172;
    this.events.push({ t: 'say', text: `${def.name.toUpperCase()} HAS ARRIVED`, color: '#ff8a80' }); // a threat, not a reward: gold is kept for veins and rewards
    this.objectiveText = `Bring down ${def.name}`;
  }

  private spawnBoss(): void {
    const def = this.spec.boss!;
    this.bossSpawned = true;
    const e = this.addEnemy('boss', CFG.arena.w / 2, 70);
    e.boss = def;
    e.hp = e.maxHp = def.hp * this.spec.hpMul;
    e.speed = def.speed;
    e.t1 = def.chargeEvery;
    e.t2 = def.radialEvery;
    e.t3 = def.spreadEvery;
    e.t4 = def.summonEvery;
    this.bossRef = e;
    this.events.push({ t: 'say', text: def.name.toUpperCase(), color: def.color });
  }

  // ---------------------------------------------------------------- player

  private dmgFactor(): number {
    const m = this.m;
    let f = (1 + m.dmg) * m.dmgMul * this.spec.slotPenalty;
    if (m.furnace > 0) f *= 1 + m.furnace * (this.heat / CFG.heat.max);
    if (m.ballast > 0) f *= 1 + m.ballast * (this.weight / 100);
    if (m.still > 0 && !this.p.moving) f *= 1 + m.still;
    return Math.max(0.1, f);
  }

  heal(n: number): void {
    if (this.m.noHeal > 0) return;
    this.p.hp = Math.min(this.spec.maxHp, this.p.hp + n);
  }

  private updatePlayer(dt: number, inp: Input): void {
    const p = this.p;
    const c = CFG.player;
    const m = this.m;
    p.iframes -= dt;
    p.hurtCd -= dt;
    p.swingT = Math.max(0, p.swingT - dt);
    p.abilityCd = Math.max(0, p.abilityCd - dt);
    const heavyCost = c.heavyCost * Math.max(0.3, 1 - m.heavyCost);
    const dodgeCost = c.dodgeCost * this.spec.dodgeMul;
    p.dodgeCd -= dt;

    const mlen = Math.hypot(inp.mx, inp.my);
    const mx = mlen > 1 ? inp.mx / mlen : inp.mx;
    const my = mlen > 1 ? inp.my / mlen : inp.my;
    p.moving = mlen > 0.2;

    if (inp.dodge && p.dodgeT <= 0 && p.dodgeCd <= 0 && this.spec.feat.dodge && !this.spec.noDodge) {
      if (p.stamina >= dodgeCost) {
        if (mlen > 0.2) {
          p.dodgeX = inp.mx / mlen;
          p.dodgeY = inp.my / mlen;
        } else {
          p.dodgeX = p.ax;
          p.dodgeY = p.ay;
        }
        p.dodgeT = c.dodgeTime;
        p.iframes = Math.max(p.iframes, c.dodgeIframes);
        p.stamina -= dodgeCost;
        p.dodgeCd = c.dodgeEvery;
        p.staminaDelay = c.staminaDelay;
        p.charging = false;
        p.charge = 0;
        this.events.push({ t: 'dodge' });
      } else this.events.push({ t: 'noStamina' });
    }

    if (inp.swap && this.spec.abilities.length > 1 && this.spec.feat.ability) {
      this.abilityIdx = (this.abilityIdx + 1) % this.spec.abilities.length;
      if (m.quick > 0) p.quickNext = true;
      this.events.push({ t: 'swap' });
    }

    if (p.dodgeT > 0) {
      p.dodgeT -= dt;
      p.x += p.dodgeX * c.dodgeSpeed * dt;
      p.y += p.dodgeY * c.dodgeSpeed * dt;
      if (m.slip > 0) {
        for (const e of this.enemies) {
          if (!this.targetable(e) || e.hitCd > 50) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + c.r + 6) {
            e.hitCd = 99; // marks "already slipped through"; reset below
            this.hit(e, m.slip, OTHER, {});
            p.stamina = Math.min(c.stamina, p.stamina + 10);
          }
        }
      }
    } else {
      for (const e of this.enemies) if (e.hitCd > 50) e.hitCd = 0.4;
      if (inp.hasAim) {
        p.ax = inp.ax;
        p.ay = inp.ay;
      } else if (inp.heavy || inp.ability) this.autoAim();
      else if (mlen > 0.2) {
        p.ax = inp.mx / mlen;
        p.ay = inp.my / mlen;
      }

      if (inp.ability && this.spec.feat.ability && p.abilityCd <= 0 && this.spec.abilities.length > 0) this.ability(inp);
      else if (inp.ability && this.spec.feat.ability && this.spec.abilities.length > 0) this.events.push({ t: 'notReady', left: p.abilityCd });

      if (inp.heavy) {
        // Holding the button starts the wind-up as soon as it is allowed: after a dodge, after a hit, or once stamina returns.
        if (!p.charging) {
          if (p.stamina >= heavyCost) {
            p.charging = true;
            p.charge = 0;
            p.chargeHeld = 0;
          } else if (!p.heavyWasDown) this.events.push({ t: 'noStamina' });
        }
        if (p.charging) {
          p.charge = Math.min(1, p.charge + dt / (c.chargeTime * this.spec.chargeMul));
          p.chargeHeld += dt;
        }
      } else if (p.charging) {
        if (p.charge >= 1) this.swing(heavyCost);
        else this.events.push({ t: 'early' });
        p.charging = false;
        p.charge = 0;
      }

      const slow = this.slow;
      const sp = c.speed * Math.max(0.3, 1 + m.speed) * (1 - slow) * (p.charging ? c.chargeMoveMul : 1);
      p.x += mx * sp * dt;
      p.y += my * sp * dt;
    }
    p.heavyWasDown = inp.heavy;

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
    if (p.staminaDelay <= 0 && !p.charging) {
      const slow = this.slow;
      p.stamina = Math.min(c.stamina, p.stamina + c.staminaRegen * Math.max(0.2, 1 + m.stam) * (1 - slow) * dt);
    }
  }

  private autoAim(): void {
    const p = this.p;
    let tx = 0;
    let ty = 0;
    let bestD = Infinity;
    for (const n of this.nodes) {
      if (!n.alive || !n.open) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y) - n.r;
      if (d < CFG.player.heavyRange + 20 && d < bestD) {
        bestD = d;
        tx = n.x;
        ty = n.y;
      }
    }
    if (bestD === Infinity) {
      for (const e of this.enemies) {
        if (!this.targetable(e)) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r - (e.shield ? 60 : 0);
        if (d < 260 && d < bestD) {
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

  private swing(cost: number): void {
    const p = this.p;
    const c = CFG.player;
    p.stamina -= cost;
    p.staminaDelay = c.staminaDelay;
    p.swingT = 0.18;
    const ang = Math.atan2(p.ay, p.ax);
    const dmg = c.heavyDmg * (1 + this.m.heavyDmg);
    let hits = 0;
    for (const e of this.enemies) {
      if (!this.targetable(e)) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > c.heavyRange + e.r) continue;
      if (angDiff(Math.atan2(dy, dx), ang) > c.heavyArc + Math.asin(Math.min(1, e.r / d))) continue;
      this.events.push({ t: 'heavyHit', x: e.x, y: e.y });
      this.hit(e, dmg, HEAVY, { heavy: true, kx: (dx / d) * c.heavyKnock, ky: (dy / d) * c.heavyKnock });
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
    else {
      for (const n of this.nodes) {
        if (!n.alive || n.open || !n.rich) continue;
        const dx = n.x - p.x;
        const dy = n.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > c.heavyRange + n.r || angDiff(Math.atan2(dy, dx), ang) > c.heavyArc + Math.asin(Math.min(1, n.r / d))) continue;
        this.events.push({ t: 'closedVein', x: n.x, y: n.y });
        break;
      }
    }
    this.events.push({ t: 'swing', hits, struck: node !== null });
  }

  private strike(n: OreNode): void {
    const p = this.p;
    const m = this.m;
    n.flash = 0.15;
    if (n.kind === 'nest') {
      n.stage++;
      const broke = n.stage >= n.stages;
      if (broke) {
        n.alive = false;
        if (!this.nodes.some((o) => o.kind === 'nest' && o.alive)) this.objectiveDone();
      }
      this.events.push({ t: 'nodeStrike', x: n.x, y: n.y, rich: false, broke, dx: p.ax, dy: p.ay, color: '#ff7ab8', mat: '', hot: 0 });
      return;
    }
    const cfg = n.rich ? CFG.nodes.rich : CFG.nodes.common;
    const power = 1 + (this.spec.toolNode === n.kind ? 1 : 0) + this.spec.strike;
    let units = 0;
    for (let i = 0; i < power && n.stage < n.stages; i++) units += cfg.drops[n.stage++];
    const broke = n.stage >= n.stages;
    if (broke) n.alive = false;
    // a hot vein gives more: holding heat is a bet, not only a cost
    const want = units * (1 + m.yield + CFG.heat.yieldBonus * (this.heat / CFG.heat.max));
    const cold = units * (1 + m.yield); // what the same strike gives at no heat, for the HUD
    const roll = this.rnd();
    units = Math.floor(want) + (roll < want % 1 ? 1 : 0);
    // the cold amount is rounded with the same roll, so the split is fair when the yield is not a whole number
    const hot = Math.max(0, units - (Math.floor(cold) + (roll < cold % 1 ? 1 : 0)));
    this.res.heatBonus = (this.res.heatBonus ?? 0) + hot;
    const id = NODE_MAT[n.kind][this.spec.tier - 1];
    const back = Math.atan2(p.y - n.y, p.x - n.x);
    for (let i = 0; i < units; i++) {
      const a = back + (this.rnd() - 0.5) * 2.4;
      const s = 120 + this.rnd() * 160;
      this.pickups.push({ x: n.x, y: n.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, homing: false, mat: id });
    }
    if (this.spec.feat.heat) {
      this.heat = Math.min(CFG.heat.max, this.heat + (n.rich ? CFG.heat.rich : CFG.heat.common) * (1 + m.heatGain));
      this.heatCoolT = CFG.heat.coolDelay;
    }
    this.res.gatherTime += p.chargeHeld + 0.15;
    this.events.push({ t: 'nodeStrike', x: n.x, y: n.y, rich: n.rich, broke, dx: p.ax, dy: p.ay, color: MATS[id].color, mat: id, hot });

    // triggers on the gathering verb
    if (m.detonate > 0) {
      this.events.push({ t: 'burst', x: n.x, y: n.y, r: 115, color: '#ffb347' });
      for (const e of this.enemies) if (this.targetable(e) && Math.hypot(e.x - n.x, e.y - n.y) < 115 + e.r) this.hit(e, m.detonate, OTHER, {});
    }
    if (m.stagger > 0) for (const e of this.enemies) if (this.targetable(e) && !e.boss && Math.hypot(e.x - n.x, e.y - n.y) < 140) e.stunT = Math.max(e.stunT, m.stagger);
    if (m.splinter > 0) {
      const count = Math.round(m.splinter);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + this.rnd();
        this.shots.push({ x: n.x, y: n.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, r: 4, dmg: 12, life: 0.5, pierce: 1, hostile: false, wi: OTHER, kind: 'splinter', hit: [], split: false, color: '#c9b27a' });
      }
    }
    if (broke && n.rich && this.spec.mutators.includes('eliteveins')) this.addEnemy('brute', n.x, n.y);
  }

  private ability(inp: Input): void {
    const p = this.p;
    const fam = this.spec.abilities[this.abilityIdx];
    const def = WEAPONS[fam];
    p.abilityMax = p.abilityCd = def.ability.cd * (1 - Math.min(0.6, this.m.cd));
    const pow = p.quickNext ? 1 + this.m.quick : 1;
    p.quickNext = false;
    this.events.push({ t: 'ability', fam });
    const near = (r: number, fn: (e: Enemy, dx: number, dy: number, d: number) => void) => {
      for (const e of this.enemies) {
        if (!this.targetable(e)) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < r + e.r) fn(e, dx, dy, d);
      }
    };
    if (fam === 'blade') {
      this.events.push({ t: 'sweep', x: p.x, y: p.y, ang: 0, r: 140, full: true, color: '#fff' });
      near(140, (e, dx, dy, d) => this.hit(e, 45 * pow, OTHER, { kx: (dx / d) * 260, ky: (dy / d) * 260 }));
    } else if (fam === 'hammer') {
      this.events.push({ t: 'burst', x: p.x, y: p.y, r: 180, color: def.color });
      near(180, (e) => this.hit(e, 25 * pow, OTHER, { stun: 1.5 }));
    } else if (fam === 'frost') {
      this.events.push({ t: 'burst', x: p.x, y: p.y, r: 200, color: def.color });
      near(200, (e) => this.hit(e, 15 * pow, OTHER, { stun: 2, chill: 0.4 }));
    } else if (fam === 'bow') {
      const a0 = Math.atan2(p.ay, p.ax);
      for (let i = -3; i <= 3; i++) {
        const a = a0 + i * 0.11;
        this.shots.push({ x: p.x, y: p.y, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, r: 5, dmg: 20 * pow, life: 0.7, pierce: 3, hostile: false, wi: OTHER, kind: 'arrow', hit: [], split: false, color: def.color });
      }
    } else {
      const dist = Math.max(60, Math.min(330, inp.aimDist > 0 ? inp.aimDist : 210));
      this.zones.push({ x: p.x + p.ax * dist, y: p.y + p.ay * dist, r: 115, t: 0.6, kind: 'meteor', dps: 60 * pow, wi: OTHER, tick: 0 });
      this.events.push({ t: 'telegraph', x: p.x + p.ax * dist, y: p.y + p.ay * dist });
    }
  }

  // --------------------------------------------------------------- weapons

  private weaponDmg(w: WeaponInst): number {
    return WEAPONS[w.fam].dmg * TIER_MUL[w.tier] * (0.9 + 0.2 * w.gs) * (w.evolved ? EVOLVE_MUL : 1);
  }

  private updateWeapons(dt: number): void {
    const p = this.p;
    const m = this.m;
    if (p.charging || p.dodgeT > 0) return; // winding up costs you your light attacks
    const ws = this.spec.weapons;
    for (let i = 0; i < ws.length; i++) {
      if (i === this.spec.sealed) continue;
      this.cds[i] -= dt * Math.max(0.2, 1 + m.atk);
      if (this.cds[i] > 0) continue;
      const w = ws[i];
      const def = WEAPONS[w.fam];
      const range = def.range * (1 + m.range) * (w.fam === 'blade' && w.evolved ? 1.8 : 1);
      let best: Enemy | null = null;
      let bestD = Infinity;
      for (const e of this.enemies) {
        if (!this.targetable(e)) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r + (e.shield && !e.boss ? 10000 : 0);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (!best || bestD - (best.shield && !best.boss ? 10000 : 0) > range) {
        this.cds[i] = 0.05;
        continue;
      }
      this.cds[i] = def.every;
      this.firedAt[i] = this.time;
      const dmg = this.weaponDmg(w);
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const ang = Math.atan2(dy, dx);

      if (w.fam === 'blade') {
        this.events.push({ t: 'sweep', x: p.x, y: p.y, ang, r: range, full: w.evolved, color: def.color });
        for (const e of this.enemies) {
          if (!this.targetable(e)) continue;
          const ex = e.x - p.x;
          const ey = e.y - p.y;
          const ed = Math.hypot(ex, ey) || 1;
          if (ed > range + e.r) continue;
          if (!w.evolved && angDiff(Math.atan2(ey, ex), ang) > 0.95) continue;
          this.hit(e, dmg, i, { burn: w.variant ? 5 : 0, kx: (ex / ed) * 50, ky: (ey / ed) * 50 });
        }
      } else if (w.fam === 'hammer') {
        this.slam(best.x, best.y, 72, dmg, i, w.variant ? 0.6 : 0);
        if (w.evolved) this.slam(best.x, best.y, 150, dmg * 0.5, i, 0);
      } else if (w.fam === 'bow') {
        this.shots.push({ x: p.x, y: p.y, vx: (dx / d) * 720, vy: (dy / d) * 720, r: 5, dmg, life: (range + 60) / 720, pierce: (w.variant ? 2 : 0) + (w.evolved ? 2 : 0) + Math.round(m.pierce), hostile: false, wi: i, kind: 'arrow', hit: [], split: w.evolved, color: def.color });
      } else if (w.fam === 'fire') {
        this.shots.push({ x: p.x, y: p.y, vx: (dx / d) * 430, vy: (dy / d) * 430, r: 7, dmg, life: d / 430, pierce: 0, hostile: false, wi: i, kind: 'fire', hit: [], split: false, color: def.color });
      } else {
        for (let k = -1; k <= 1; k++) {
          const a = ang + k * 0.13;
          this.shots.push({ x: p.x, y: p.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 4, dmg, life: (range + 40) / 560, pierce: Math.round(m.pierce), hostile: false, wi: i, kind: 'shard', hit: [], split: false, color: def.color });
        }
      }
    }

    // Blizzard staff aura
    this.auraT -= dt;
    if (this.auraT <= 0) {
      this.auraT = 0.5;
      for (let i = 0; i < ws.length; i++) {
        if (ws[i].fam !== 'frost' || !ws[i].evolved || i === this.spec.sealed) continue;
        for (const e of this.enemies) {
          if (this.targetable(e) && Math.hypot(e.x - p.x, e.y - p.y) < 260 + e.r) this.hit(e, this.weaponDmg(ws[i]) * 0.5, i, { chill: 0.3, noChain: true });
        }
      }
    }
  }

  private slam(x: number, y: number, r: number, dmg: number, wi: number, stun: number): void {
    this.events.push({ t: 'burst', x, y, r, color: WEAPONS.hammer.color });
    for (const e of this.enemies) {
      if (!this.targetable(e)) continue;
      const ex = e.x - x;
      const ey = e.y - y;
      const ed = Math.hypot(ex, ey) || 1;
      if (ed < r + e.r) this.hit(e, dmg, wi, { stun, kx: (ex / ed) * 140, ky: (ey / ed) * 140 });
    }
  }

  private explode(x: number, y: number, s: Shot): void {
    const w = this.spec.weapons[s.wi];
    const r = 52 * (w?.variant ? 1.5 : 1);
    this.events.push({ t: 'burst', x, y, r, color: s.color });
    for (const e of this.enemies) {
      if (this.targetable(e) && Math.hypot(e.x - x, e.y - y) < r + e.r) this.hit(e, s.dmg, s.wi, { burn: 4 });
    }
    if (w?.evolved) this.zones.push({ x, y, r, t: 3, kind: 'fire', dps: s.dmg * 0.6, wi: s.wi, tick: 0 });
  }

  /** All damage to enemies goes through here. Returns false if it was blocked. */
  private hit(e: Enemy, raw: number, src: number, o: HitOpts): boolean {
    if (e.dead || e.state === 'under') return false;
    const m = this.m;
    let mul = 1;
    if (e.shield) {
      if (o.heavy) {
        e.shield = false;
        this.events.push({ t: 'shieldBreak', x: e.x, y: e.y });
        if (e.boss) {
          this.res.armorBreaks++;
          e.stunT = Math.max(e.stunT, 1.2);
        }
      } else if (e.boss) mul = 0.25;
      else {
        this.events.push({ t: 'tink', x: e.x, y: e.y });
        return false;
      }
    }
    let dmg = raw * mul * this.dmgFactor();
    if (m.crit > 0 && this.rnd() < m.crit) dmg *= 2;
    const w = src >= 0 ? this.spec.weapons[src] : null;
    if (w && w.fam === 'frost' && w.variant && e.chillT > 0) dmg *= 1.3;
    e.hp -= dmg;
    e.flash = 0.1;
    const idx = src >= 0 ? src : this.spec.weapons.length + (src === HEAVY ? 0 : 1);
    this.res.dmgBy[idx] += dmg;
    if (!e.boss) {
      e.kx += o.kx ?? 0;
      e.ky += o.ky ?? 0;
    }
    const burn = m.burn + (o.burn ?? 0);
    if (burn > 0) {
      e.burnDps = Math.max(e.burnDps, burn * this.dmgFactor());
      e.burnT = 3;
    }
    const chill = m.chill + (o.chill ?? 0) + (w?.fam === 'frost' ? 0.3 : 0);
    if (chill > 0) {
      e.chill = Math.min(e.boss ? 0.3 : 0.6, Math.max(e.chill, chill));
      e.chillT = 2;
    }
    if (o.stun && !e.boss) e.stunT = Math.max(e.stunT, o.stun);

    if (m.chain > 0 && !o.noChain) {
      let other: Enemy | null = null;
      let od = 135;
      for (const x of this.enemies) {
        if (x === e || !this.targetable(x)) continue;
        const d = Math.hypot(x.x - e.x, x.y - e.y);
        if (d < od) {
          od = d;
          other = x;
        }
      }
      if (other) {
        this.events.push({ t: 'shot', x1: e.x, y1: e.y, x2: other.x, y2: other.y, color: '#b9a6ff' });
        this.hit(other, raw * m.chain, src, { noChain: true });
      }
    }
    if (e.hp <= 0) this.kill(e, src, idx);
    return true;
  }

  private kill(e: Enemy, src: number, idx: number): void {
    if (e.dead) return;
    e.dead = true;
    const c = CFG.enemies[e.kind];
    const m = this.m;
    const big = e.elite !== null || e.boss !== null || e.kind === 'brute';
    this.res.kills++;
    this.res.killsBy[idx]++;
    const hot = e.hot ? CFG.heat.hotPay : 1; // greed buys danger, not income
    const pays = (e.elite ? 8 : 1) * hot;
    this.res.scrap += c.scrap * pays * Math.max(0, 1 + m.scrap);
    this.res.xp += c.xp * pays;
    const fam = src >= 0 ? this.spec.weapons[src].fam : this.spec.abilities[this.abilityIdx];
    if (fam) this.res.famKills[fam] = (this.res.famKills[fam] ?? 0) + 1;
    if (m.leech > 0) this.heal(m.leech);
    if (m.wind > 0) this.p.stamina = Math.min(CFG.player.stamina, this.p.stamina + m.wind);
    this.events.push({ t: 'kill', kind: e.kind, x: e.x, y: e.y, sweep: false, big });

    const drop = (id: string, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = this.rnd() * 6.28;
        this.pickups.push({ x: e.x, y: e.y, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, age: 0, homing: false, mat: id });
      }
    };
    if (fam) {
      const chance = c.drop * hot * Math.max(0, 1 + m.drops) * (this.spec.mutators.includes('thick') ? 1.3 : 1);
      const n = Math.floor(chance) + (this.rnd() < chance % 1 ? 1 : 0);
      if (n > 0) drop(WEAPONS[fam].harvest, e.elite ? n + 2 : n);
    }
    if (e.elite) {
      drop(e.elite.part, 1);
      this.res.elitesKilled.push(e.elite.id);
      if (this.spec.objective === 'elite') this.objectiveDone();
    }
    if (e.boss) {
      drop(e.boss.part, 1);
      this.res.bossKilled = true;
      this.bossRef = null;
      this.objectiveText = '';
      this.endIn = 2;
      this.events.push({ t: 'say', text: `${e.boss.name.toUpperCase()} FALLS`, color: '#ffd34d' });
    }
    if (e.kind === 'bomber') this.zones.push({ x: e.x, y: e.y, r: 78, t: 0.6, kind: 'blast', dps: e.dmg, wi: OTHER, tick: 0, by: "a bomber's blast" });
    else if (this.spec.mutators.includes('volatile') && !e.boss) {
      this.zones.push({ x: e.x, y: e.y, r: 34 + e.r, t: 0.7, kind: 'blast', dps: 7, wi: OTHER, tick: 0, by: 'a volatile burst' });
    }
  }

  /** from: the enemy that touched or shot you; by, sx, sy: name and place of a blow that has no living source. */
  private hurtPlayer(raw: number, from: Enemy | null, by = '', sx = this.p.x, sy = this.p.y, contact = true): void {
    const p = this.p;
    if (p.iframes > 0 || p.hurtCd > 0 || this.phase !== 'wave') return;
    const src = { name: from ? enemyName(from) : by || 'the wave', x: from && contact ? from.x : sx, y: from && contact ? from.y : sy, enemy: from && !from.dead ? from : null };
    const dmg = Math.max(1, raw * this.spec.dmgMul * (10 / (10 + Math.max(0, this.m.armor)))); // armour has diminishing returns and never makes you immune
    p.hp -= dmg;
    p.hurtCd = CFG.player.hurtInvuln;
    this.res.dmgTaken += dmg;
    p.charging = false; // a hit interrupts the wind-up
    p.charge = 0;
    this.events.push({ t: 'hurt', dmg, x: src.x, y: src.y, by: src.name });
    const hits = this.res.lastHits!;
    hits.push({ by: src.name, dmg, t: this.waveT });
    if (hits.length > 5) hits.shift();
    if (p.hp <= 0) {
      this.killer = src;
      this.res.killer = src.name;
    }
    if (from && contact && this.m.thorns > 0 && !from.dead) {
      // thorns bite whatever touched you, shield or not, for exactly the stated amount
      from.hp -= this.m.thorns;
      from.flash = 0.1;
      this.res.dmgBy[this.spec.weapons.length + 1] += this.m.thorns;
      if (from.hp <= 0) this.kill(from, OTHER, this.spec.weapons.length + 1);
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.finish(true);
    }
  }

  // --------------------------------------------------------------- enemies

  private updateEnemies(dt: number): void {
    const p = this.p;
    const { w, h } = CFG.arena;
    const ward = this.m.ward > 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hitCd -= dt;
      e.flash = Math.max(0, e.flash - dt);
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.hp -= e.burnDps * dt;
        this.res.dmgBy[this.spec.weapons.length + 1] += e.burnDps * dt;
        if (e.hp <= 0) {
          this.kill(e, OTHER, this.spec.weapons.length + 1);
          continue;
        }
      }
      if (e.chillT > 0) e.chillT -= dt;
      else e.chill = 0;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let vx = 0;
      let vy = 0;

      if (e.stunT > 0) e.stunT -= dt;
      else if (e.boss) [vx, vy] = this.bossAI(e, dt, dx, dy, d);
      else if (e.kind === 'burrower') [vx, vy] = this.burrower(e, dt, dx, dy, d);
      else if (e.kind === 'spitter') {
        const keep = CFG.spitter.keep;
        const dir = d > keep + 40 ? 1 : d < keep - 60 ? -0.8 : 0;
        vx = (dx / d) * e.speed * dir;
        vy = (dy / d) * e.speed * dir;
        e.t1 -= dt;
        if (e.t1 <= 0 && d < 520) {
          e.t1 = e.elite ? 1.6 : CFG.spitter.every;
          const spread = e.elite ? [-0.25, 0, 0.25] : [0];
          const a0 = Math.atan2(dy, dx);
          for (const s of spread) this.spit(e.x, e.y, a0 + s, CFG.spitter.shotSpeed, e.dmg, e);
          this.events.push({ t: 'spit' });
        }
      } else if (e.kind === 'charger') {
        // winds up along a marked line, then rushes: answer with a dodge
        if (e.dash > 0) {
          e.dash -= dt;
          vx = e.dx * 520;
          vy = e.dy * 520;
        } else if (e.tele > 0) {
          e.tele -= dt;
          if (e.tele <= 0) e.dash = 0.45;
        } else {
          vx = (dx / d) * e.speed;
          vy = (dy / d) * e.speed;
          e.t1 -= dt;
          if (e.t1 <= 0 && d < 340) {
            e.t1 = 3.2;
            e.tele = 0.7;
            e.dx = dx / d;
            e.dy = dy / d;
          }
        }
      } else if (e.kind === 'bomber') {
        // runs at you and bursts, on contact or when killed: kill it at a distance
        vx = (dx / d) * e.speed;
        vy = (dy / d) * e.speed;
        if (d < e.r + CFG.player.r + 10) {
          this.kill(e, OTHER, this.spec.weapons.length + 1);
          continue;
        }
      } else {
        const a = Math.atan2(dy, dx) + (e.kind === 'swarm' ? Math.sin(this.time * 3 + e.wob) * 0.35 : 0);
        vx = Math.cos(a) * e.speed;
        vy = Math.sin(a) * e.speed;
        if (e.elite?.id === 'thornback' && !e.shield) {
          e.t1 -= dt;
          if (e.t1 <= 0) {
            e.shield = true;
            e.t1 = 7;
          }
        }
        if (e.elite?.id === 'ashfang') {
          e.t2 -= dt;
          if (e.t2 <= 0) {
            e.t2 = 5;
            for (let i = 0; i < 4; i++) this.addEnemy('swarm', e.x + (this.rnd() - 0.5) * 60, e.y + (this.rnd() - 0.5) * 60);
          }
        }
      }

      let slow = 1 - e.chill;
      if (ward && e.state !== 'under') {
        for (const n of this.nodes) {
          if (n.alive && n.open && n.kind !== 'nest' && Math.hypot(n.x - e.x, n.y - e.y) < 130) {
            slow *= 0.5;
            if (e.kind === 'burrower') {
              e.hp -= 14 * dt;
              if (e.hp <= 0) this.kill(e, OTHER, this.spec.weapons.length + 1);
            }
            break;
          }
        }
        if (e.dead) continue;
      }
      const decay = Math.exp(-8 * dt);
      e.kx *= decay;
      e.ky *= decay;
      e.x = Math.max(e.r, Math.min(w - e.r, e.x + (vx * slow + e.kx) * dt));
      e.y = Math.max(e.r, Math.min(h - e.r, e.y + (vy * slow + e.ky) * dt));

      if (e.kind !== 'bomber' && e.state !== 'under' && e.state !== 'emerging' && e.hitCd <= 0 && d < e.r + CFG.player.r + 2) {
        e.hitCd = CFG.enemies[e.kind].hitEvery;
        this.hurtPlayer(e.dmg, e);
        if (this.phase === 'over') return;
      }
    }

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
          const wa = a.boss ? 0 : b.boss ? 2 : 1;
          const wb = b.boss ? 0 : a.boss ? 2 : 1;
          a.x -= (dx / d) * push * wa;
          a.y -= (dy / d) * push * wa;
          b.x += (dx / d) * push * wb;
          b.y += (dy / d) * push * wb;
        }
      }
    }
    if (es.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private spit(x: number, y: number, a: number, speed: number, dmg: number, src?: Enemy): void {
    this.shots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 7, dmg, life: 3.2, pierce: 0, hostile: true, wi: OTHER, kind: 'spit', hit: [], split: false, color: '#b6f25a', src });
  }

  private bossAI(e: Enemy, dt: number, dx: number, dy: number, d: number): [number, number] {
    const b = e.boss!;
    // armour up at set health fractions; only a heavy swing breaks it
    if (!e.shield && e.armorIdx < b.armorAt.length && e.hp / e.maxHp <= b.armorAt[e.armorIdx]) {
      e.armorIdx++;
      e.shield = true;
      this.events.push({ t: 'say', text: 'ARMOURED: HEAVY SWING BREAKS IT', color: '#cfe8ff' });
    }
    if (e.dash > 0) {
      e.dash -= dt;
      return [e.dx * 560, e.dy * 560];
    }
    if (e.tele > 0) {
      e.tele -= dt;
      if (e.tele <= 0) e.dash = 0.55;
      return [0, 0];
    }
    if (b.chargeEvery > 0 && (e.t1 -= dt) <= 0) {
      e.t1 = b.chargeEvery;
      e.tele = 0.8;
      e.dx = dx / d;
      e.dy = dy / d;
      this.events.push({ t: 'telegraph', x: e.x, y: e.y });
    }
    if (b.radialEvery > 0 && (e.t2 -= dt) <= 0) {
      e.t2 = b.radialEvery;
      const off = this.rnd() * 6.28;
      for (let i = 0; i < b.radialN; i++) this.spit(e.x, e.y, off + (i / b.radialN) * Math.PI * 2, 210, 10, e);
      this.events.push({ t: 'spit' });
    }
    if (b.spreadEvery > 0 && (e.t3 -= dt) <= 0) {
      e.t3 = b.spreadEvery;
      const a0 = Math.atan2(dy, dx);
      for (let i = -2; i <= 2; i++) this.spit(e.x, e.y, a0 + i * 0.2, 280, 10, e);
      this.events.push({ t: 'spit' });
    }
    if (b.summonEvery > 0 && (e.t4 -= dt) <= 0) {
      e.t4 = b.summonEvery;
      const n = b.summon === 'swarm' ? 6 : 2;
      for (let i = 0; i < n && this.enemies.length < CFG.spawn.cap; i++) {
        this.addEnemy(b.summon, e.x + (this.rnd() - 0.5) * 120, e.y + (this.rnd() - 0.5) * 120);
      }
    }
    return [(dx / d) * e.speed, (dy / d) * e.speed];
  }

  private burrower(e: Enemy, dt: number, dx: number, dy: number, d: number): [number, number] {
    const c = CFG.burrower;
    const nodeOk = (n: OreNode | null): n is OreNode => n !== null && n.alive && n.open && n.kind !== 'nest';
    if (e.state === 'under') {
      if (!nodeOk(e.target) && !e.elite) {
        e.target = null;
        let bestD = Infinity;
        for (const n of this.nodes) {
          if (!nodeOk(n)) continue;
          const nd = Math.hypot(n.x - e.x, n.y - e.y) - (n.rich ? 5000 : 0);
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
        n.stage++;
        n.flash = 0.15;
        const ate = n.stage >= n.stages;
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
    return [(dx / d) * e.speed, (dy / d) * e.speed];
  }

  // ------------------------------------------------- shots, zones, pickups

  private updateShots(dt: number): void {
    const p = this.p;
    for (const s of this.shots) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.hostile) {
        if (Math.hypot(s.x - p.x, s.y - p.y) < s.r + CFG.player.r) {
          this.hurtPlayer(s.dmg, s.src ?? null, 'a spit', s.x - s.vx * 0.05, s.y - s.vy * 0.05, false);
          if (p.iframes <= 0) s.life = -1;
          if (this.phase === 'over') return;
        }
        continue;
      }
      for (const e of this.enemies) {
        if (!this.targetable(e) || s.hit.includes(e.id)) continue;
        if (Math.hypot(s.x - e.x, s.y - e.y) > s.r + e.r) continue;
        if (s.kind === 'fire') {
          this.explode(s.x, s.y, s);
          s.life = -2;
          break;
        }
        s.hit.push(e.id);
        const landed = this.hit(e, s.dmg, s.wi, { kx: s.vx * 0.06, ky: s.vy * 0.06 });
        if (landed && s.split) {
          const a = Math.atan2(s.vy, s.vx);
          for (const off of [-0.5, 0.5]) {
            this.shots.push({ ...s, x: e.x, y: e.y, vx: Math.cos(a + off) * 720, vy: Math.sin(a + off) * 720, life: 0.35, hit: [e.id], split: false });
          }
        }
        if (!landed || s.pierce-- <= 0) {
          s.life = -1;
          break;
        }
      }
      if (s.kind === 'fire' && s.life <= 0 && s.life > -1.5) this.explode(s.x, s.y, s);
    }
    this.shots = this.shots.filter((s) => s.life > 0 && s.x > -50 && s.y > -50 && s.x < CFG.arena.w + 50 && s.y < CFG.arena.h + 50);
  }

  private updateZones(dt: number): void {
    const p = this.p;
    for (const z of this.zones) {
      z.t -= dt;
      if (z.kind === 'supply') {
        if (!this.res.objective && Math.hypot(p.x - z.x, p.y - z.y) < z.r) {
          this.supplyT += dt;
          if (this.supplyT >= 10) {
            this.objectiveDone();
            z.t = 0;
          }
        }
      } else if (z.kind === 'meteor') {
        if (z.t <= 0) {
          this.events.push({ t: 'burst', x: z.x, y: z.y, r: z.r, color: '#ff8a3c' });
          for (const e of this.enemies) if (this.targetable(e) && Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) this.hit(e, z.dps, OTHER, { burn: 6 });
          this.zones.push({ x: z.x, y: z.y, r: z.r * 0.8, t: 3, kind: 'fire', dps: 10, wi: OTHER, tick: 0 });
        }
      } else if (z.kind === 'blast') {
        if (z.t <= 0) {
          this.events.push({ t: 'burst', x: z.x, y: z.y, r: z.r, color: '#e2504a', hostile: true });
          if (Math.hypot(p.x - z.x, p.y - z.y) < z.r + CFG.player.r) this.hurtPlayer(z.dps, null, z.by ?? 'a blast', z.x, z.y);
          if (this.phase === 'over') return;
        }
      } else {
        z.tick -= dt;
        if (z.tick <= 0) {
          z.tick = 0.4;
          for (const e of this.enemies) if (this.targetable(e) && Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) this.hit(e, z.dps * 0.4, z.wi, { noChain: true });
        }
      }
    }
    this.zones = this.zones.filter((z) => z.t > 0);
  }

  private collect(k: Pickup): void {
    const mat = MATS[k.mat];
    this.res.gathered[k.mat] = (this.res.gathered[k.mat] ?? 0) + 1;
    this.weight += mat.weight * (this.spec.burden === mat.cat ? 0.6 : 1) * Math.max(0, 1 - this.m.weight);
  }

  private updatePickups(dt: number): void {
    const p = this.p;
    const reach = CFG.player.magnet + this.m.magnet;
    let got = false;
    for (const k of this.pickups) {
      k.age += dt;
      const dx = p.x - k.x;
      const dy = p.y - k.y;
      const d = Math.hypot(dx, dy) || 1;
      if (k.age > 0.3 && (k.homing || d < reach)) {
        k.homing = true;
        const s = 420 + k.age * 300;
        k.vx = (dx / d) * s;
        k.vy = (dy / d) * s;
        if (d < CFG.player.r + 8) {
          this.collect(k);
          this.events.push({ t: 'pickup', x: k.x, y: k.y, part: MATS[k.mat].cat === 'part', mat: k.mat });
          k.age = -1;
          got = true;
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
    if (got) this.pickups = this.pickups.filter((k) => k.age >= 0);
  }

  private updateHeat(dt: number): void {
    this.heatCoolT -= dt;
    if (this.heatCoolT <= 0 && !this.spec.heatHolds) this.heat = Math.max(0, this.heat - CFG.heat.coolRate * (1 + this.m.heatCool) * dt);
    if (this.heat > this.res.heatPeak) this.res.heatPeak = this.heat;
  }
}
