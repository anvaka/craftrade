// Server-side tuning values. Starting numbers, to be tuned against the sim bot.

import type { CharacterId, Feature, StationId } from '../src/shared/protocol.ts';
import type { RawBag, RawId } from '../src/shared/vocab.ts';

/** Wave durations in seconds, DESIGN.md 3.1. */
export const WAVE_SECONDS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 60, 60, 90];
/** Killing the boss ends wave 12 early, so it only counts this much. */
export const BOSS_WAVE_MIN_SECONDS = 15;
/** A run report may arrive this much sooner than its waves add up to. */
export const DURATION_SLACK = { fraction: 0.1, seconds: 3 };
export const TICKET_TTL_MS = 6 * 3600 * 1000;

/** Plausibility bounds for a run report, per wave attempted. */
export const BOUNDS = {
  rawPerWave: 40,
  rawTotalPerWave: 90,
  scripPerWave: 500,
  killsPerWave: 600,
  fusions: 60,
};

export const MARKS_PER_WAVE = 3;
export const SCRIP_PER_MARK = 10;

export const CHARACTERS: CharacterId[] = ['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk'];
/** Feature unlocked by finishing run N (DESIGN.md 5.5). Run 2 unlocks a character. */
export const FEATURE_AT: Record<Feature, number> = { workshop: 1, market: 3, daily: 4, town: 5 };
export const LISTING_MIN_RUNS = 3;

export function featuresFor(runs: number): Feature[] {
  return (Object.keys(FEATURE_AT) as Feature[]).filter((f) => runs >= FEATURE_AT[f]);
}
export function charactersFor(runs: number): CharacterId[] {
  const n = 1 + (runs >= 2 ? 1 : 0) + Math.min(4, Math.max(0, runs - 5));
  return CHARACTERS.slice(0, n);
}

// Market.
export const FACTOR_BASE: Record<RawId, number> = { timber: 6, ore: 8, hide: 7 };
export const FACTOR = {
  buyMul: 2, // the player pays this multiple of the reference
  sellMul: 0.5, // the player receives this multiple of the reference
  drift: 0.0015, // reference moves by this fraction per unit of net trade
  clamp: 3, // reference stays within base / clamp .. base * clamp
  revert: 0.1, // pull toward base at each day change
  dailyBase: 150, // units per side per raw per day, times active players
  maxQty: 100, // per request
};
export const LISTING = {
  maxPrice: 100_000,
  maxOpen: 20,
  /** A relic has no price cap. This is only the largest whole number of marks the books will write down. */
  relicBookLimit: 1_000_000_000_000,
};
/** Share of sale tax, in marks, that turns into town project progress (1 mark = 1 raw). */
export const TAX_TO_TOWN = 0.5;

// Town.
export const STATIONS: StationId[] = ['sawmill', 'smelter', 'tannery', 'assay'];
export const MAX_STATION_TIER = 5;
export const NOVEL_PER_ASSAY_TIER = 5;
/** Raws one player is asked for, per tier step. Multiplied by (toTier - 1) and the player scale. */
export const PROJECT_UNIT: Record<StationId, RawBag> = {
  sawmill: { timber: 60, ore: 20, hide: 20 },
  smelter: { timber: 20, ore: 60, hide: 20 },
  tannery: { timber: 20, ore: 20, hide: 60 },
  assay: { timber: 35, ore: 35, hide: 35 },
};
/** Half the active players are assumed to give. Never below one player's worth. */
export const projectScale = (activePlayers: number) => Math.max(1, Math.ceil(activePlayers * 0.5));
export const ACTIVE_WINDOW_MS = 7 * 24 * 3600 * 1000;

// Fusion.
export const MODEL_TIMEOUT_MS = 8000;
export const MODEL_ATTEMPTS = 2;

// Relics. Truly rare: the numbers below are the whole of the drop system.
// There is no pity timer, no luck stat and no purchase path. The roll happens
// on the server, in run/end, after the report has passed its checks.
/** One paying report of each kind in this many finds a relic. */
export const RELIC_ONE_IN = {
  /** A full 12-wave win. The main source. */
  win: 1500,
  /** A death on wave 9 or later of a full run. */
  lateDeath: 30_000,
  /** The day's scored daily, all 8 waves cleared. */
  daily: 15_000,
} as const;
/** First wave on which a death can roll. */
export const RELIC_LATE_DEATH_WAVE = 9;
/**
 * Which relic a find is, as shares of 1000. With RELIC_ONE_IN.win at 1500 the
 * rarest (75) is 1 in 20,000 wins and the most common (200) 1 in 7,500.
 * Every id in src/shared/content/relics.ts must be here; a test checks it.
 */
export const RELIC_WEIGHT: Record<string, number> = {
  orderbook: 200,
  oilskinwrap: 170,
  hideblind: 150,
  packsaddle: 130,
  seedcorn: 105,
  companydraft: 90,
  brandyflask: 80,
  saddlescabbard: 75,
};
/**
 * Reports one account can put to the roll in any 24 hours. Far above what a
 * person plays (a win takes about 13 minutes), so it never touches normal
 * play; it stops one account that reports round the clock from rolling more
 * often than a keen player would. Reports past it pay out as usual and do not roll.
 */
export const RELIC_ROLLS_PER_DAY = 40;
/** How long a find is told to everyone on the home page. */
export const RELIC_NOTICE_MS = 24 * 3600 * 1000;
