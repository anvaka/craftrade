// What this device has learned and how far it has got. Kept in localStorage
// under "scrip.feel"; every read and write is wrapped, so blocked storage
// only means the lines are taught again and the best is forgotten.
//
// A teaching line stays until the player has done the thing, on whichever
// run that happens. It is not tied to the number of runs played.
//
// No imports: the town's recap reads the best wave from here too.

export type Lesson =
  | 'move' // moved for a moment
  | 'keepMoving' // was hit or crowded, then kept moving
  | 'work' // broke a node
  | 'raws' // picked up a raw and was told what raws are
  | 'level' // levelled up and was told scrip is also experience
  | 'bench' // bought something at a bench
  | 'anvil' // struck the anvil once
  | 'carry'; // has seen what goes home

interface Stored {
  done: Partial<Record<Lesson, true>>;
  /** Furthest wave reached in a full run (the wave died in, or the last wave on a win). */
  best: number;
  /** True once a full run has been won on this device. */
  won: boolean;
  /** Runs finished on this device. */
  runs: number;
}

const KEY = 'scrip.feel';
let state: Stored = { done: {}, best: 0, won: false, runs: 0 };
let loaded = false;

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as Partial<Stored>;
    if (s && typeof s === 'object') {
      if (s.done && typeof s.done === 'object') state.done = s.done;
      if (typeof s.best === 'number' && s.best >= 0) state.best = s.best;
      if (typeof s.won === 'boolean') state.won = s.won;
      if (typeof s.runs === 'number' && s.runs >= 0) state.runs = s.runs;
    }
  } catch {
    // blocked or broken: start from nothing
  }
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // not persisted; still true for this page
  }
}

export function learned(l: Lesson): boolean {
  load();
  return state.done[l] === true;
}

export function learn(l: Lesson): void {
  load();
  if (state.done[l]) return;
  state.done[l] = true;
  save();
}

/** Forget everything (the dev harness, ?first=1). */
export function forget(): void {
  loaded = true;
  state = { done: {}, best: 0, won: false, runs: 0 };
  save();
}

export interface Best {
  /** The best before this run; 0 if there was none. */
  before: number;
  /** The best now. */
  now: number;
  wonBefore: boolean;
  /** True when this run went further than any before it (and there was a before). */
  beaten: boolean;
  /** Runs finished on this device, this one included. */
  runs: number;
}

/** Record a finished full run and say how it stands against the best. Call once per run. */
export function recordRun(wave: number, won: boolean): Best {
  load();
  const before = state.best, wonBefore = state.won;
  state.runs += 1;
  if (wave > state.best) state.best = wave;
  if (won) state.won = true;
  save();
  return { before, now: state.best, wonBefore, beaten: before > 0 && (wave > before || (won && !wonBefore)), runs: state.runs };
}

export function bestWave(): number {
  load();
  return state.best;
}
