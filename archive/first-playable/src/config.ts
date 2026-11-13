// Every tuning number lives here. Units: world pixels, seconds.
export const CFG = {
  seed: 20261112, // fixed, so both modes run the same five waves
  arena: { w: 1400, h: 900 },

  waves: [40, 45, 50, 55, 60], // duration of each wave
  beats: { lull: 0.35, swell: 0.45 }, // share of a wave; the peak is the rest
  intermission: 4,
  healBetweenWaves: 15,

  player: {
    r: 14,
    speed: 235,
    hp: 100,
    hurtInvuln: 0.25, // grace after any hit
    hitCancelsCharge: true, // being hit interrupts a heavy swing wind-up

    stamina: 100,
    staminaRegen: 24,
    staminaDelay: 0.7, // pause before regeneration after spending

    dodgeCost: 28,
    dodgeTime: 0.2,
    dodgeSpeed: 640,
    dodgeIframes: 0.32,

    heavyCost: 34,
    chargeTime: 0.5,
    chargeMoveMul: 0.55, // movement while winding up
    heavyRange: 100,
    heavyArc: 1.15, // half-angle in radians
    heavyDmg: 40,
    heavyKnock: 320,

    lightEvery: 0.42,
    lightRange: 300,
    lightDmg: 10,

    weightSlowPerUnit: 0.0025, // speed lost per unit of material carried
    weightSlowMax: 0.45,
    magnet: 95,
  },

  heat: {
    common: 9, // per strike
    rich: 22,
    max: 100,
    coolDelay: 3, // seconds after the last strike before cooling starts
    coolRate: 4, // per second
    spawnBonus: 2.5, // at full heat, arrivals are (1 + this) times the base
  },

  nodes: {
    // drops[i] is the material released by strike i; the length is the number of swings
    common: { count: 6, drops: [1, 2], r: 22 },
    rich: { count: 3, drops: [3, 4, 8], r: 28 },
  },

  spawn: {
    rate: { lull: 0.5, swell: 1.3, peak: 2.4 }, // threat points per second
    waveMul: [1, 1.15, 1.3, 1.45, 1.6],
    cap: 80,
    // weights per wave: [swarm, shield, burrower]. The lull is always swarm only.
    mix: [
      [1, 0, 0],
      [6, 2, 1],
      [6, 2, 2],
      [5, 3, 2],
      [5, 3, 3],
    ],
    cost: { swarm: 4, shield: 4, burrower: 3 }, // swarm cost buys a pack
  },

  enemies: {
    swarm: { r: 9, hp: 18, speed: 150, dmg: 5, hitEvery: 0.6, pack: 4 },
    shield: { r: 20, hp: 70, speed: 78, dmg: 12, hitEvery: 0.9 },
    burrower: {
      r: 15,
      hp: 30,
      speedUnder: 170,
      speedUp: 115,
      dmg: 10,
      hitEvery: 0.8,
      emergeTime: 0.7,
      biteEvery: 1.3, // each bite removes one strike's worth of ore from a node
      huntTime: 5, // seconds above ground when hunting the player
    },
  },

  // Haul targets shown on the menu and results screen
  targets: { bronze: 70, silver: 120, gold: 170 },
};

export type Beat = 'lull' | 'swell' | 'peak';
