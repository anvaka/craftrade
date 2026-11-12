// The contract between the two halves of the client.
//
//   src/client/game/**   the run: loop, renderer, HUD, input, bench, run-end choice of carry
//   src/client/town/**   everything outside a run: boot, api, home, stash, workshop, market, town, daily, recap
//
// The town half owns index.html and main.ts, talks to the server, and calls
// mountRun() to play. The game half never calls fetch.

import type { ItemSpec } from '../shared/item.ts';
import type { FuseRes, RunEndReq, RunStartRes } from '../shared/protocol.ts';
import type { Sprites } from './art/index.ts';

/** What the run recap needs beyond the server report. Mirrors sim summary(). */
export interface RunRecap {
  report: Omit<RunEndReq, 'runId'>;
  killedBy: string | null;
  endWave: number;
  seconds: number;
  /** `tier`: for a weapon, the highest tier of it held at the end. */
  damageBy: { id: string; name: string; damage: number; tier?: number }[];
  damageTaken: number;
  rawsGathered: { timber: number; ore: number; hide: number };
  /** Loot runs: rare materials held by kind, and schematic indexes found. */
  loot?: { rare: number[]; found: number[] };
  /** Gathering experience at the end, when the run had lulls. */
  skillXp?: number[];
  /** Items held at the end, for the recap. */
  items: ItemSpec[];
  /** Ids the player chose to carry home (already inside report.carry). */
  carried: ItemSpec[];
  /** One true line about how close it was ("Old Tusk had 12% of its health left."), or null. */
  nearMiss?: string | null;
  /** How this run stands against the best on this device. Full runs only; absent for the daily and for a quit. */
  best?: { before: number; now: number; wonBefore: boolean; beaten: boolean; runs: number };
}

export type FuseOutcome =
  | { ok: true; res: FuseRes }
  | { ok: false; code: string; message: string };

/** A run written down at a bench: enough to stand at that bench again after the page is closed. */
export interface RunSave {
  /** The input log up to the bench (src/shared/replay.ts). */
  replay: string;
  /** What the run's fusions made, by id. */
  items: Record<string, ItemSpec>;
  /** The wave just cleared. */
  wave: number;
}

/** The loot prototype, as the run needs it. */
export interface LootProto {
  /** Schematic names, by the index the sim rolls; and which are already known. */
  schematics: string[];
  known: boolean[];
  /** Rare material names by kind (PK_RARE + i). */
  rares: string[];
  weapons: { id: string; tier: number }[];
  /** The craft the strip counts toward: raws still wanted, with what is already at home. */
  goal: { name: string; needs: { label: string; kind: number; need: number; home: number }[] } | null;
}

export interface RunHost {
  /** Element to fill. The game half owns everything inside it until destroy(). */
  root: HTMLElement;
  /** Baked once at boot by the town half and shared. */
  sprites: Sprites;
  ticket: RunStartRes;
  mode: 'run' | 'daily' | 'practice';
  /** True on the player's very first run: teach by play, no modal. */
  firstRun: boolean;
  /** The lull prototype: seconds of safe gathering after each wave, and gathering experience so far (tree, seam, carcass). */
  proto?: { lull?: number; skillXp?: number[]; loot?: LootProto };
  /** Pick the run up at the bench this save was made at. mountRun throws if the save cannot be played. */
  resume?: RunSave;
  /** Called at every bench, and again as the player leaves it, with the run so far. */
  onSave?(save: RunSave): void;
  /** Ask the server what a pair becomes. Never throws. */
  fuse(a: string, b: string): Promise<FuseOutcome>;
  /** The run is over and the carry is chosen. Called exactly once. */
  onEnd(recap: RunRecap): void;
  /** The player quit from the pause menu. The run is abandoned and reported as a loss via onEnd first. */
  onQuit(): void;
}

export interface RunHandle {
  destroy(): void;
}

export type MountRun = (host: RunHost) => RunHandle;
