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
export const PLAYER_BASE_HP = 16;
export const IFRAMES = 0.75;
/** A dodge buys the same grace as a hit, so a point of Dodge is worth a hit not taken. */
export const DODGE_IFRAMES = 0.75;
export const BASE_MAGNET = 100;
/** Share of scrip left on the ground at wave end that is swept to the player at once. The rest is banked. */
export const SWEEP_SHARE = 0.6;
export const PICKUP_FLY_SPEED = 520;
export const WEAPON_SLOTS = 6;

/** Seconds a spawning enemy is inert (drawn as a mark on the ground). */
export const SPAWN_TELL = 0.6;
/** Spawns use the lane mouth if the player is this close to it, else a ring around the player. */
export const LANE_NEAR = 760;
export const SPAWN_RING = 520;

export const NODE_WORK = 3.0;
export const NODE_WORK_RICH = 6;
export const NODE_RING = 78;
export const NODE_YIELD = 3;
export const NODE_YIELD_RICH = 8;
export const RICH_FROM_WAVE = 3;
/** Working a node is loud. From this wave, every NOISE_EVERY units of work call a pack from the nearest lane mouth. */
export const NOISE_FROM_WAVE = 3;
export const NOISE_EVERY = 1.0;
/** Damage taken is multiplied by this while working a node (from NOISE_FROM_WAVE). */
export const WORK_EXPOSED = 2;
/** A node left alone loses its work at this many units a second, so a job started is a job to finish. */
export const NODE_DECAY = 0.5;
/** How far inside a lane mouth a node stands: [min, span]. Rich nodes stand in the mouth itself. */
export const NODE_INWARD: readonly [number, number] = [130, 170];
export const NODE_INWARD_RICH: readonly [number, number] = [70, 90];
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
export const SAME_WEAPON_BIAS = 0.3;
export const SAME_CLASS_BIAS = 0.3;
/** The first offer of every bench is a weapon, and leans harder toward what is held. */
export const RACK_WEAPON_BIAS = 0.55;
export const RACK_CLASS_BIAS = 0.35;
export const SCRAP_SHARE = 0.25;
/** Interest is capped at this much scrip per wave number. */
export const INTEREST_CAP_PER_WAVE = 6;
/** Each other copy of the same weapon held adds this share of damage to every copy. */
export const STACK_BONUS = 0.04;
/** A slowed enemy takes this much more damage from everything. */
export const SLOW_VULN = 0.25;
/** Scrip a missing raw costs at the bench: RAW_PRICE + RAW_PRICE_PER_BENCH x bench. */
export const RAW_PRICE = 2;
export const RAW_PRICE_PER_BENCH = 1;
/** Raising a held weapon one tier costs this share of the next tier's price, plus one set of its raws. */
export const TIER_UP_SHARE = 0.8;
/** The commission: a fifth offer from this bench on, always tier 3 or 4, at this price multiplier. */
export const COMMISSION_FROM = 5;
export const COMMISSION_MUL = 1.35;
export const COMMISSION_T4 = 0.35;
/** Each paid reroll at a bench costs this much more than the last. */
export const REROLL_GROWTH = 1.35;
/** Prices rise by this share per bench past LATE_PRICE_FROM, on top of the linear formula. */
export const LATE_PRICE = 0.1;
export const LATE_PRICE_FROM = 6;

/** The hazard ladder. Level n has every rule up to n. */
export const HAZARD_RULES: readonly { name: string; text: string }[] = [
  { name: '', text: '' },
  { name: 'Early elites', text: 'The stag also comes in wave 5 and the rotwood in wave 8, and neither early one carries scrip.' },
  { name: 'Lean nodes', text: 'Every node holds 1 less.' },
  { name: 'No rest', text: 'A new wave mends only half of what is missing.' },
  { name: 'Volleys', text: 'Spitters spit three at a time, each a little lighter.' },
  { name: 'Old Tusk gets up', text: 'The boss rises once more at half health.' },
];
export const MAX_HAZARD = 5;
/**
 * Health multiplier for ordinary enemies by wave number. Flat early, so a new player's first waves stay soft;
 * it climbs from wave 6 because a build's damage grows far faster than linear enemy health.
 */
export const WAVE_HP: readonly number[] = [1, 1, 1, 1, 1, 1.1, 1.2, 1.35, 1.5, 1.7, 1.9, 2.1];
/** Damage multiplier for every enemy by wave number. Late waves have to be able to hurt a build with Armor. */
export const WAVE_DMG: readonly number[] = [1, 1, 1, 1, 1, 1, 1.1, 1.15, 1.25, 1.35, 1.5, 1.6];
/** Enemy health and spawn interval multipliers per hazard level. The rules do most of the work; these trim. */
export const HAZARD_HP: readonly number[] = [1, 1.28, 1.4, 1.45, 1.45, 1.62];
export const HAZARD_PACE: readonly number[] = [1, 0.97, 0.95, 0.93, 0.93, 0.92];
/** Each shot of a hazard 4 volley does this share of a single spit. */
export const VOLLEY_DMG = 0.7;

/** Tier gates for offers: [first bench, chance per bench past the gate, cap]. */
export const RARITY = [
  null,
  null,
  { from: 2, per: 0.08, cap: 0.6 },
  { from: 4, per: 0.05, cap: 0.3 },
  { from: 8, per: 0.04, cap: 0.15 },
] as const;

/** Per-stat caps on the final value, [min, max]. Multiplicative stacking is held here. */
export const STAT_CAP: Record<string, readonly [number, number]> = {
  maxHp: [1, 250], mend: [0, 40], armor: [-12, 60], dodge: [0, 60], speed: [-50, 60],
  damage: [-80, 300], melee: [-20, 80], ranged: [-20, 80], rate: [-60, 200], crit: [0, 80],
  reach: [-60, 300], harvest: [-20, 100], luck: [-50, 200],
};
/** Caps on summed special primitives. */
export const SPECIAL_CAP: Record<string, number> = {
  thorns: 120, nodeBurst: 30, nodeHeal: 30, richNodes: 80, killScrip: 80, interest: 20,
  hoardTimber: 60, hoardOre: 12, hoardHide: 40, lowHpRate: 100, stillDamage: 100,
  movingDodge: 40, waveShield: 80, killBlast: 60, hurtBlast: 120, pierce: 3, bounce: 3,
  burn: 20, knockback: 40, rerollCut: 75, eliteDamage: 150, magnet: 300, xpGain: 100,
  secondWind: 60,
  killHeal: 60, armorDamage: 6, hpDamage: 9, dodgeStrike: 300, speedDamage: 18, scripDamage: 20,
  harvestDamage: 10, luckCrit: 8, workHaste: 80, pureSet: 60, fewWeapons: 30,
};
/** Scrip counted by scripDamage stops here. */
export const SCRIP_DAMAGE_AT = 300;
/** Shortest weapon cooldown whatever the Rate. */
export const MIN_COOLDOWN = 0.08;
