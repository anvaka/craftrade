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
  damageBy: { id: string; name: string; damage: number }[];
  damageTaken: number;
  rawsGathered: { timber: number; ore: number; hide: number };
  /** Items held at the end, for the recap. */
  items: ItemSpec[];
  /** Ids the player chose to carry home (already inside report.carry). */
  carried: ItemSpec[];
}

export type FuseOutcome =
  | { ok: true; res: FuseRes }
  | { ok: false; code: string; message: string };

export interface RunHost {
  /** Element to fill. The game half owns everything inside it until destroy(). */
  root: HTMLElement;
  /** Baked once at boot by the town half and shared. */
  sprites: Sprites;
  ticket: RunStartRes;
  mode: 'run' | 'daily' | 'practice';
  /** True on the player's very first run: teach by play, no modal. */
  firstRun: boolean;
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
