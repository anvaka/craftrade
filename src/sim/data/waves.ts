// Wave director data. Each wave is a list of spawn groups; what changes
// from wave to wave is which behaviours are mixed, not just the head count.

export interface SpawnGroup {
  /** Enemy id. */
  e: string;
  /** Active window as fractions of the wave. */
  from: number;
  to: number;
  /** Seconds between spawns. */
  every: number;
  /** Enemies per spawn. They arrive together in one lane. */
  pack: number;
}

export interface WaveDef {
  seconds: number;
  /** One line for the wave banner and for the recap. */
  brief: string;
  /** Number of spawn lanes open. */
  lanes: number;
  groups: readonly SpawnGroup[];
  /** Elite or boss id, spawned a few seconds in. */
  elite?: string;
  /** Nodes topped up to at wave start: trees, seams, carcasses. */
  nodes: readonly [number, number, number];
}

const g = (e: string, every: number, pack: number, from = 0, to = 1): SpawnGroup => ({ e, from, to, every, pack });

export const WAVES: readonly WaveDef[] = [
  { seconds: 20, brief: 'Mites', lanes: 2, nodes: [2, 1, 0],
    groups: [g('mite', 1.5, 2)] },
  { seconds: 25, brief: 'Mites and gnat clouds', lanes: 2, nodes: [2, 1, 1],
    groups: [g('mite', 1.5, 2), g('gnat', 8.5, 8, 0.12)] },
  { seconds: 30, brief: 'Boars', lanes: 3, nodes: [2, 2, 1],
    groups: [g('mite', 1.4, 2), g('boar', 4.5, 1, 0.1, 0.55), g('boar', 4.5, 2, 0.55)] },
  { seconds: 35, brief: 'Spitters, and magpies after your scrip', lanes: 3, nodes: [2, 2, 1],
    groups: [g('mite', 1.3, 2), g('spitter', 5, 1, 0.08), g('magpie', 8, 1, 0.2), g('gnat', 13, 8, 0.4)] },
  { seconds: 40, brief: 'Burrowers at the nodes', lanes: 3, nodes: [2, 2, 2],
    groups: [g('mite', 1.6, 2), g('gnat', 9, 8, 0.1), g('boar', 5, 2, 0.15), g('burrower', 6, 1, 0.08)] },
  { seconds: 45, brief: 'The stag', lanes: 2, nodes: [2, 2, 1], elite: 'stag',
    groups: [g('mite', 1.4, 2), g('gnat', 12, 8, 0.3), g('spitter', 8, 1, 0.4)] },
  { seconds: 50, brief: 'Brutes behind a spitter line', lanes: 3, nodes: [3, 2, 1],
    groups: [g('mite', 0.8, 2), g('brute', 5.5, 1, 0.06), g('spitter', 3.5, 2, 0.1), g('burrower', 7, 1, 0.3)] },
  { seconds: 55, brief: 'A raid: boars, gnats and thieving magpies', lanes: 4, nodes: [2, 2, 2],
    groups: [g('boar', 1.8, 2), g('gnat', 2.0, 8, 0.05), g('magpie', 5, 2, 0.1), g('mite', 0.9, 3, 0.3)] },
  { seconds: 60, brief: 'The rotwood', lanes: 3, nodes: [1, 3, 2], elite: 'rotwood',
    groups: [g('burrower', 2.8, 2, 0.08), g('spitter', 2.5, 2, 0.1), g('mite', 0.7, 2), g('boar', 4, 2, 0.4), g('gnat', 4, 8, 0.3),
      g('brute', 9, 1, 0.3)] },
  { seconds: 60, brief: 'Brutes with boars on the flanks', lanes: 4, nodes: [3, 2, 2],
    groups: [g('brute', 3.8, 1, 0.04), g('boar', 2.2, 2, 0.08), g('gnat', 2.5, 8, 0.1), g('mite', 0.6, 3)] },
  { seconds: 60, brief: 'Everything', lanes: 4, nodes: [3, 3, 2],
    groups: [g('spitter', 2.4, 2, 0.05), g('burrower', 3.2, 2, 0.1), g('brute', 4.5, 1, 0.1), g('mite', 0.5, 3),
      g('magpie', 10, 1, 0.2), g('boar', 4, 2, 0.4), g('gnat', 5, 8, 0.5)] },
  { seconds: 90, brief: 'Old Tusk', lanes: 3, nodes: [2, 2, 2], elite: 'tusk',
    groups: [g('mite', 0.4, 3), g('gnat', 2.4, 8, 0.1), g('spitter', 2.4, 2, 0.15), g('brute', 5, 1, 0.2), g('boar', 3.5, 2, 0.3),
      g('burrower', 5, 2, 0.5)] },
];

/** Which standard wave each wave of a run uses. Health, damage and prices follow the run's own wave number. */
export const WAVE_PLAN: Record<number, readonly number[]> = {
  12: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  8: [1, 2, 3, 4, 6, 7, 9, 12],
};
/**
 * Spawn interval multiplier per wave of each plan. The short plan borrows late
 * waves that were tuned for an 11-bench build, so they are thinned out.
 */
export const PLAN_PACE: Record<number, readonly number[]> = {
  12: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  8: [1, 1, 1, 1, 1.1, 1.2, 1.4, 1.65],
};
/** The mule leaves after these waves (never after the last). */
export const MULE_AFTER: readonly number[] = [4, 8];
/** Summons used by Old Tusk in his second phase, in rotation. */
export const TUSK_SUMMONS: readonly { e: string; n: number }[] = [
  { e: 'boar', n: 4 }, { e: 'gnat', n: 12 }, { e: 'spitter', n: 4 }, { e: 'burrower', n: 3 },
];
