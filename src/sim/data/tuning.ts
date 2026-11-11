// Global tuning constants. World units are pixels at 1x; time is seconds
// unless a name ends in Ticks.

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

export const ARENA_W = 2200;
export const ARENA_H = 1500;
/** Enemies and the player are kept this far inside the treeline. */
export const ARENA_PAD = 24;

export const MAX_ENEMIES = 300;
export const MAX_SHOTS = 256;
export const MAX_ESHOTS = 128;
export const MAX_PICKUPS = 400;
export const MAX_NODES = 12;
export const MAX_HAZARDS = 96;
export const MAX_EVENTS = 512;
export const GRID_CELL = 80;

export const PLAYER_R = 14;
export const PLAYER_SPEED = 215;
export const PLAYER_BASE_HP = 10;
export const IFRAMES = 0.45;
export const DODGE_IFRAMES = 0.2;
export const BASE_MAGNET = 85;
export const PICKUP_FLY_SPEED = 520;
export const WEAPON_SLOTS = 6;

/** Seconds a spawning enemy is inert (drawn as a mark on the ground). */
export const SPAWN_TELL = 0.6;
/** Spawns use the lane mouth if the player is this close to it, else a ring around the player. */
export const LANE_NEAR = 760;
export const SPAWN_RING = 520;

export const NODE_WORK = 3.0;
export const NODE_WORK_RICH = 5.5;
export const NODE_RING = 78;
export const NODE_YIELD = 3;
export const NODE_YIELD_RICH = 6;
export const RICH_FROM_WAVE = 5;
export const RICH_CHANCE = 0.34;
export const MAX_LIVE_NODES = 8;
/** Work units between 'work' events (one chop, clink or scrape). */
export const WORK_TICK = 0.5;
export const SHARD_DAMAGE = 14;
export const SHARD_DAMAGE_PER_WAVE = 4;

export const BURN_SECONDS = 3;
export const BURN_PERIOD_TICKS = 30;
export const BLAST_RADIUS = 85;
export const KILL_BLAST_BASE = 3;
export const KILL_BLAST_HP_FRACTION = 0.14;
export const HURT_BLAST_RADIUS = 140;
/** Elites and the boss count as this much nearer when weapons pick a target. */
export const ELITE_FOCUS = 0.6;
/** How much of a target's movement shots lead by (1 = full intercept). */
export const SHOT_LEAD = 0.85;
export const BOUNCE_SEEK = 240;
/** Damage kept by each pierce or bounce that comes from the weapon itself. */
export const NATIVE_CHAIN = 0.7;

export const BENCH_ITEM_SHARE = 0.65;
export const SAME_WEAPON_BIAS = 0.2;
export const SAME_CLASS_BIAS = 0.15;
export const SCRAP_SHARE = 0.25;
export const INTEREST_CAP = 20;

/** Tier gates for offers: [first bench, chance per bench past the gate, cap]. */
export const RARITY = [
  null,
  null,
  { from: 2, per: 0.08, cap: 0.6 },
  { from: 4, per: 0.04, cap: 0.25 },
  { from: 8, per: 0.015, cap: 0.08 },
] as const;

/** Per-stat caps on the final value, [min, max]. Multiplicative stacking is held here. */
export const STAT_CAP: Record<string, readonly [number, number]> = {
  maxHp: [1, 250], mend: [0, 40], armor: [-12, 60], dodge: [0, 60], speed: [-50, 60],
  damage: [-80, 300], melee: [-20, 80], ranged: [-20, 80], rate: [-60, 200], crit: [0, 80],
  reach: [-60, 300], harvest: [-20, 100], luck: [-50, 200],
};
/** Caps on summed special primitives. */
export const SPECIAL_CAP: Record<string, number> = {
  thorns: 60, nodeBurst: 30, nodeHeal: 30, richNodes: 80, killScrip: 80, interest: 30,
  hoardTimber: 60, hoardOre: 12, hoardHide: 40, lowHpRate: 100, stillDamage: 100,
  movingDodge: 40, waveShield: 80, killBlast: 60, hurtBlast: 120, pierce: 3, bounce: 3,
  burn: 20, knockback: 40, rerollCut: 75, eliteDamage: 150, magnet: 300, xpGain: 100,
  secondWind: 60,
};
/** Shortest weapon cooldown whatever the Rate. */
export const MIN_COOLDOWN = 0.08;
