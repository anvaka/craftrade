// State shapes for the run simulation. Everything here is plain data. All
// entity pools are fixed-length arrays of reused objects with an `alive`
// flag; `x, y` is the position this tick and `px, py` the position last tick,
// so a renderer draws at px + (x - px) * alpha.
import type { ItemSpec } from '../shared/item.ts';
import type { CharacterId, StationId } from '../shared/protocol.ts';
import type { RawBag, StatId } from '../shared/vocab.ts';

export type Phase = 'wave' | 'bench' | 'over';

/** Enemy state machine values (Enemy.state). */
export const ES = {
  /** Arriving. Inert, cannot be hit. Draw a ground mark. `t` counts down. */
  Spawn: 0,
  Move: 1,
  /** Telegraph before a charge. `t` counts down, `dx, dy` is the locked charge direction. */
  Windup: 2,
  Charge: 3,
  Recover: 4,
  /** Underground. Cannot be hit. `tx, ty` is where it will surface. */
  Burrowed: 5,
  /** Magpie running for the treeline with loot. */
  Flee: 6,
  /** Winding up a ground slam. `t` counts down; the ring itself is a Hazard. */
  Slam: 7,
  /** Old Tusk calling a pack. `t` counts down. */
  Summon: 8,
  /** Burrower about to surface at `tx, ty`. `t` counts down. */
  Surfacing: 9,
  /** Standing guard on an outing. Idle until the player comes near or it is hit. */
  Guard: 10,
} as const;

export interface Enemy {
  alive: boolean;
  /** Unique per spawn, so a reused slot is not mistaken for the old enemy. */
  uid: number;
  /** Index into ENEMIES. */
  type: number;
  x: number; y: number; px: number; py: number;
  /** Knockback velocity, decays. */
  kx: number; ky: number;
  hp: number; maxHp: number;
  dmg: number;
  r: number;
  state: number;
  /** State timer in seconds. */
  t: number;
  /** Second timer: attack cooldown, shed timer and so on. */
  t2: number;
  /** Third timer, used by elites. */
  t3: number;
  /** Facing or locked charge direction (unit). */
  dx: number; dy: number;
  /** Target point (surfacing spot, flee point). */
  tx: number; ty: number;
  burnDps: number; burnT: number;
  slowT: number; slowF: number;
  /** Shot damage already in the air for this enemy, and the tick after which it no longer counts (the shots have landed or missed). */
  pend: number; pendTick: number;
  /** Ticks left of hit flash. */
  flash: number;
  /** Boss phase 1-3, charges left for the stag, loot count for a magpie. */
  n: number;
  /** Magpie loot: scrip, timber, ore, hide. */
  loot0: number; loot1: number; loot2: number; loot3: number;
  /** Work done on a live rotwood, 0..AI.rotWork. */
  work: number;
  /** Per-enemy phase offset for wobble. */
  seed: number;
  /** True for an enemy called by the noise of work. It drops no scrip. */
  called: boolean;
}

/** A player shot. */
export interface Shot {
  alive: boolean;
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  dmg: number;
  /** Damage source index (see SOURCE_IDS). */
  src: number;
  r: number;
  life: number;
  pierce: number; bounce: number;
  /** Pierces and bounces left that keep the weapon's own share of damage; the rest keep the item share. */
  np: number; nb: number;
  crit: boolean;
  knock: number;
  burn: number;
  slow: number;
  /** uids already hit, so a piercing shot hits each enemy once. */
  hit: Int32Array;
  hits: number;
}

/** An enemy shot. The only round madder shapes on screen. */
export interface EShot {
  alive: boolean;
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
  dmg: number; r: number; life: number;
  /** Enemy type index, for the recap, and the shooter for thorns. */
  type: number; owner: number; ownerUid: number;
}

export const PK_SCRIP = 0, PK_TIMBER = 1, PK_ORE = 2, PK_HIDE = 3;
/** Rare materials of the loot prototype: silver ore, thick hide. Kinds 4-11 are the outing's. */
export const PK_RARE = 12, RARE_COUNT = 2;
export interface Pickup {
  alive: boolean;
  x: number; y: number; px: number; py: number;
  /** Scatter velocity right after it drops. */
  vx: number; vy: number;
  /** PK_SCRIP, PK_TIMBER, PK_ORE or PK_HIDE. */
  kind: number;
  value: number;
  /** True once inside the magnet radius; it then flies to the player. */
  pulled: boolean;
  /** Index of the magpie heading for it, or -1. */
  claimed: number;
}

export const NODE_TREE = 0, NODE_SEAM = 1, NODE_CARCASS = 2, NODE_PLANT = 3, NODE_CHEST = 4;
export interface ResNode {
  alive: boolean;
  x: number; y: number;
  /** NODE_TREE, NODE_SEAM or NODE_CARCASS. */
  type: number;
  rich: boolean;
  /** Resource tier, 1 or 2. Only outings stand tier 2 nodes. */
  tier: number;
  work: number; need: number;
  /** True while the player stood in the ring this tick. */
  working: boolean;
  /** Counts up with work; used for chop timing. */
  tickAcc: number;
  /** True once this node has grown back this wave (Seed corn). */
  regrown: boolean;
  /** Work done since this node last called a pack. */
  noise: number;
}

export const HZ_RING = 0, HZ_SHARD = 1;
export interface Hazard {
  alive: boolean;
  /** HZ_RING: a telegraphed ground slam that lands when t reaches 0 and hits
   *  the band r0..r1. HZ_SHARD: lingers for t seconds and hurts on touch (r1). */
  kind: number;
  x: number; y: number;
  r0: number; r1: number;
  t: number; dur: number;
  dmg: number;
  /** Enemy type index of whoever made it. */
  type: number;
  owner: number; ownerUid: number;
}

export interface WeaponState {
  /** Index into WEAPONS. */
  def: number;
  id: string;
  tier: number;
  /** Seconds until it can attack. */
  cd: number;
  /** Seconds left of the swing or recoil animation, and its full length. */
  swing: number; swingDur: number;
  /** Unit aim vector of the last attack. */
  ax: number; ay: number;
  /** Alternates each swing so sweeps go left then right. */
  flip: boolean;
}

export interface Player {
  x: number; y: number; px: number; py: number;
  /** Last non-zero move direction (unit). */
  fx: number; fy: number;
  moving: boolean;
  hp: number;
  shield: number;
  /** Seconds of invulnerability left. Flicker while > 0. */
  iframes: number;
  level: number;
  xp: number;
  /** XP needed for the next level. */
  xpNext: number;
  scrip: number;
  /** Scrip left on the ground at earlier wave ends. Pickups pay double until this is repaid. */
  bank: number;
  raws: RawBag;
  weapons: WeaponState[];
  items: ItemSpec[];
  /** Parallel to items: true for an item that came from the kit (cannot be carried home). */
  itemKit: boolean[];
  /** Stats from the character and upgrade picks. */
  base: Float64Array;
  /** Final capped stats, indexed like STATS. Refreshed every tick. */
  stat: Float64Array;
  /** Summed special primitives, indexed by SP. */
  sp: Float64Array;
  /** base + items + set bonuses + weapon passives, before conditions and caps. */
  flat: Float64Array;
  /** Damage kept (0..1) by the extra pierces and bounces that items add. */
  piercePct: number; bouncePct: number;
  /** Count of each weapon class held: edge, blunt, shot, tool. */
  classCount: Int32Array;
  /** Copies held of each weapon, indexed like WEAPONS. */
  copies: Int32Array;
  /** True while two or more weapons are held and all share a class. */
  pure: boolean;
  /** Weapon slots not in use. */
  emptySlots: number;
  /** Extra pierces every shot gets from the Shot set. */
  setPierce: number;
  maxHp: number;
  /** Derived each tick from stat[]. */
  mendPerSec: number;
  /** Multiplier on damage taken, from Armor. */
  takenMul: number;
  /** 0..0.6 */
  dodge: number;
  moveSpeed: number;
  dmgMul: number;
  rateMul: number;
  critChance: number;
  workRate: number;
  magnetR: number;
  knockAdd: number;
  secondWindUsed: boolean;
  /** True once the Brandy flask has been drunk. Once a run, not once a wave. */
  secondLifeUsed: boolean;
  /** Index of the node being worked, -1 if none, -2 for the rotwood. */
  workingNode: number;
}

export type OfferKind = 'weapon' | 'item';
export interface Offer {
  kind: OfferKind;
  /** Weapon id or item id. */
  id: string;
  tier: number;
  price: number;
  raws: RawBag;
  locked: boolean;
  sold: boolean;
  /** Set for item offers. */
  item: ItemSpec | null;
  /** True for the commission: the extra late offer, always tier 3 or 4, that a reroll does not replace. */
  commission?: boolean;
}

export interface UpgradeChoice { stat: StatId; tier: number; value: number }

export interface Bench {
  /** Bench number, equal to the wave just cleared. */
  index: number;
  /** Upgrade picks still owed. */
  picks: number;
  /** Four choices for the current pick; empty when picks is 0. */
  choices: UpgradeChoice[];
  offers: Offer[];
  /** Paid rerolls so far at this bench. */
  rerolls: number;
  freeReroll: boolean;
  /** True if the mule can be sent from this bench. */
  mule: boolean;
  /** Scrip paid as interest on arriving at this bench. */
  interestPaid: number;
  /** Fusions left at this bench that cost no raws (Tinker). */
  freeFuses: number;
  /** Fusions paid for at this bench so far. Each one makes the next dearer. */
  fuses: number;
}

export type EventType =
  | 'attack' | 'hit' | 'crit' | 'kill' | 'hurt' | 'dodge' | 'pickup' | 'work' | 'break' | 'levelup'
  | 'tell' | 'eliteSpawn' | 'eliteDeath' | 'bossSpawn' | 'bossPhase' | 'bossDeath' | 'steal' | 'escape'
  | 'waveStart' | 'waveEnd' | 'shieldBreak' | 'secondWind' | 'burst' | 'slam' | 'death'
  // Outings: a: skill, b: xp, c: new level or 0 | a: threat stage | bag full | a: node type, b: level needed | a: how it ended.
  | 'skill' | 'stage' | 'full' | 'locked' | 'left'
  // The lull after a wave: a: seconds, b: nodes standing, c: 1 if a chest stands | a chest opened: a: scrip in it.
  | 'lull' | 'chest'
  // Loot runs: a rare thing dropped. a: pickup kind, or -1 for a schematic; b: schematic index.
  | 'loot';

/** One presentation event. Objects are reused; copy what you need before the next step. */
export interface SimEvent { type: EventType; x: number; y: number; a: number; b: number; c: number; d: number }

export interface EventQueue { list: SimEvent[]; n: number; dropped: number }

export interface RunOptions {
  seed: number;
  character: CharacterId;
  /** 12 for a run, 8 for the daily clearing. */
  waves?: number;
  /** Items packed for the run. Ignored by the caller for the daily. */
  kit?: ItemSpec[];
  /** Station tiers from the town. Tier 1 is the starting tier and adds nothing. */
  stations?: Partial<Record<StationId, number>>;
  /** Starting weapon id; defaults to the character's. */
  startWeapon?: string;
  /** Hazard level 0-5. 0 is the standard game; each level adds one rule (HAZARD_RULES). */
  hazard?: number;
  /** Seconds of safe gathering after each wave but the last. 0 or absent: none (the standard game). */
  lull?: number;
  /** Loot prototype: kills drop raws, rarer things drop from big ones, and schematics drop from elites. N schematics to roll from. */
  loot?: number;
  /** Weapons carried in besides the starting one (crafted at home). */
  extraWeapons?: readonly { id: string; tier: number }[];
  /** Gathering experience at the start, by node type (tree, seam, carcass). Only read when lull is set. */
  skillXp?: readonly number[];
}

/** State of an outing: one visit to a zone to gather, ending at a camp, by recall or by death. */
export interface Outing {
  /** Seconds since arrival. */
  time: number;
  /** 0..1 fills the meter; past 1 the woods are awake and it keeps climbing. */
  threat: number;
  /** 0 calm, 1 stirring, 2 hunting, 3 awake. */
  stage: number;
  /** Seconds until the next pack. */
  nextPack: number;
  /** Camp positions (x, y pairs) and how many. The player arrives at the first. */
  camps: Float64Array;
  campCount: number;
  /** Index of the camp the player stands in, or -1. */
  inCamp: number;
  /** '' while out; then how it ended. */
  result: '' | 'camp' | 'recall' | 'dead';
  /** Count carried of each material, indexed like MATERIALS. */
  bag: Int32Array;
  bagSlots: number;
  /** Skill experience at arrival plus what this outing has added, indexed like SKILLS. */
  xp: Float64Array;
  gained: Float64Array;
  /** Nodes broken, by node type. */
  broken: Int32Array;
  /** Ticks until 'full' or 'locked' may be said again. */
  quiet: number;
}

export interface Grid {
  cols: number; rows: number;
  /** start[c]..start[c+1] indexes `items` for cell c. */
  start: Int32Array;
  items: Int16Array;
  fill: Int32Array;
}

export interface Run {
  seed: number;
  /** Size of the ground. The clearing for a run, a whole zone for an outing. */
  w: number; h: number;
  /** Set for an outing (see outing.ts); null for a run of waves. */
  outing: Outing | null;
  /** Length of the lull after each wave in seconds (0: none), and what is left of the one under way (0: fighting). */
  lull: number; lullT: number;
  /** Loot prototype: number of schematics to roll from (0: off), rare materials held by kind (PK_RARE + i), schematic indexes found. */
  loot: number; rare: Int32Array; found: number[];
  /** Gathering experience by node type, and what this run has added. */
  skillXp: Float64Array; skillGained: Float64Array;
  character: CharacterId;
  /** Hazard level 0-5. */
  hazard: number;
  /** True once Old Tusk has risen again (hazard 5). */
  bossRose: boolean;
  totalWaves: number;
  /** Standard wave number used for each wave's composition. */
  plan: readonly number[];
  stations: Record<StationId, number>;
  rng: Uint32Array;
  tick: number;
  phase: Phase;
  /** 1-based. 0 before the first wave is started by createRun. */
  wave: number;
  /** Seconds into the wave and its length. */
  waveTime: number;
  waveSeconds: number;
  wavesCleared: number;
  won: boolean;

  player: Player;
  enemies: Enemy[];
  /** Number of live enemies. */
  enemyCount: number;
  shots: Shot[];
  eshots: EShot[];
  pickups: Pickup[];
  nodes: ResNode[];
  hazards: Hazard[];
  events: EventQueue;
  grid: Grid;
  bench: Bench;

  /** Index of the live elite or boss in `enemies`, or -1. */
  eliteIdx: number;
  /** Lane mouths open this wave (x, y pairs) and how many. */
  lanes: Float64Array;
  laneCount: number;
  /** Next spawn time per group of the current wave. */
  groupNext: Float64Array;
  eliteSpawned: boolean;
  /** Pending bursts (x, y, damage triples). */
  burstQ: Float64Array;
  burstN: number;
  nextUid: number;
  bossDead: boolean;
  /** Spawn interval multiplier for the current wave (see PLAN_PACE). */
  pace: number;
  /** Rotation counter for Old Tusk's summons. */
  summonN: number;

  // Totals for the summary.
  scripEarned: number;
  kills: number;
  mule: RawBag;
  gathered: RawBag;
  /** Damage dealt per source, indexed like SOURCE_IDS. */
  dmgBy: Float64Array;
  damageTaken: number;
  fusions: [string, string, string][];
  carry: string[];
  /** Enemy id (or 'burn') that landed the killing blow, '' while alive. */
  killedBy: string;
  deathWave: number;
  /** Scrip and raws gained in each wave, for the balance report. */
  scripByWave: number[];
  rawsByWave: number[];
  /** Stat of every upgrade pick taken and id of every offer bought, in order. */
  upgradeLog: string[];
  buyLog: string[];
}
