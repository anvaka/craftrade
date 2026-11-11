// Enemy table. Health and damage are linear in the wave number:
// value = base + perWave x (wave - 1). Threat comes from the behaviour.

export type EnemyAi = 'walk' | 'swarm' | 'charge' | 'spit' | 'thief' | 'burrow' | 'slam' | 'stag' | 'rotwood' | 'tusk';

export interface EnemyDef {
  id: string;
  name: string;
  ai: EnemyAi;
  hp: number;
  hpW: number;
  dmg: number;
  dmgW: number;
  speed: number;
  /** Speed gained per wave. Small: late fodder closes a little faster. */
  speedW: number;
  r: number;
  /** Knockback divisor. */
  mass: number;
  scrip: number;
  /** 0 normal, 1 elite, 2 boss. */
  rank: 0 | 1 | 2;
}

export const ENEMIES: readonly EnemyDef[] = [
  { id: 'mite', name: 'Mite', ai: 'walk', hp: 3.5, hpW: 1.9, dmg: 1, dmgW: 0.45, speed: 118, speedW: 2.5, r: 11, mass: 1, scrip: 1, rank: 0 },
  { id: 'gnat', name: 'Gnat cloud', ai: 'swarm', hp: 1.5, hpW: 0.9, dmg: 0.6, dmgW: 0.4, speed: 186, speedW: 5, r: 7, mass: 0.6, scrip: 1, rank: 0 },
  { id: 'boar', name: 'Boar', ai: 'charge', hp: 9, hpW: 3.2, dmg: 1.5, dmgW: 0.7, speed: 95, speedW: 1, r: 15, mass: 1.6, scrip: 2, rank: 0 },
  { id: 'spitter', name: 'Spitting toad', ai: 'spit', hp: 7, hpW: 2.5, dmg: 1.5, dmgW: 0.65, speed: 90, speedW: 0, r: 13, mass: 1, scrip: 2, rank: 0 },
  { id: 'magpie', name: 'Magpie', ai: 'thief', hp: 6, hpW: 2.4, dmg: 0, dmgW: 0, speed: 196, speedW: 0, r: 11, mass: 0.8, scrip: 2, rank: 0 },
  { id: 'burrower', name: 'Badger', ai: 'burrow', hp: 10, hpW: 3.4, dmg: 1.5, dmgW: 0.7, speed: 135, speedW: 1, r: 14, mass: 1.4, scrip: 2, rank: 0 },
  { id: 'brute', name: 'Bear', ai: 'slam', hp: 40, hpW: 11, dmg: 3, dmgW: 1.05, speed: 72, speedW: 1, r: 24, mass: 4, scrip: 6, rank: 0 },
  { id: 'stag', name: 'Stag', ai: 'stag', hp: 190, hpW: 26, dmg: 2.5, dmgW: 0.4, speed: 112, speedW: 0, r: 26, mass: 6, scrip: 40, rank: 1 },
  { id: 'rotwood', name: 'Rotwood', ai: 'rotwood', hp: 260, hpW: 40, dmg: 4, dmgW: 0.5, speed: 44, speedW: 0, r: 40, mass: 12, scrip: 60, rank: 1 },
  { id: 'tusk', name: 'Old Tusk', ai: 'tusk', hp: 6600, hpW: 820, dmg: 4, dmgW: 0.5, speed: 128, speedW: 0, r: 38, mass: 14, scrip: 0, rank: 2 },
];

/** Walking speed of an enemy type in a given wave. */
export const enemySpeed = (def: EnemyDef, wave: number): number => def.speed + def.speedW * (wave - 1);

export const ENEMY_INDEX: Record<string, number> = Object.fromEntries(ENEMIES.map((e, i) => [e.id, i]));

/** Behaviour numbers, shared by the AI code and by anyone drawing telegraphs. */
export const AI = {
  gnatWobble: 0.55,
  boarTrigger: 270, boarTell: 0.7, boarChargeSpeed: 520, boarChargeTime: 0.85, boarRecover: 0.9, boarChargeDmg: 1.5,
  spitNear: 250, spitFar: 400, spitEvery: 3.0, spitTell: 0.45, spitSpeed: 170, spitFan: 0.3, spitLife: 4, spitR: 7,
  thiefGrab: 5, thiefPatience: 7, thiefFleeSpeed: 1.15,
  burrowSpeed: 250, burrowTell: 0.8, burrowBlastR: 62, burrowUp: 4.5, burrowDown: 1.2,
  slamTrigger: 135, slamTell: 1.0, slamR: 165, slamRest: 2.4, slamDmg: 1.9,
  stagTrigger: 420, stagTell: 0.7, stagChargeSpeed: 610, stagChargeTime: 0.8, stagRecover: 1.1, stagCharges: 3,
  stagShardEvery: 0.09, stagShardR: 20, stagShardLife: 6, stagShardDmg: 0.6,
  rotShedEvery: 2.8, rotShed: 3, rotSlamEvery: 5.5, rotSlamTell: 1.2, rotSlamR: 170, rotWorkRing: 125,
  rotWork: 3.0, rotWorkDamage: 0.16, rotTimber: 3,
  tuskPhase2: 0.66, tuskPhase3: 0.33, tuskPhase2At: 22, tuskPhase3At: 48, tuskTell: 0.8, tuskChargeSpeed: 640, tuskChargeTime: 0.95, tuskRecover: 1.3,
  tuskSummonEvery: 3.3, tuskRingStep: 0.5, tuskRingTell: 0.95, tuskRingW: 130, tuskRings: 4, tuskRingEvery: 3.0,
} as const;
