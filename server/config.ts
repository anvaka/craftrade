// Server-side tuning values. Starting numbers, to be tuned against the sim bot.

import type { CharacterId, Feature, StationId } from '../src/shared/protocol.ts';
import type { RawBag, RawId } from '../src/shared/vocab.ts';

/** Wave durations in seconds, DESIGN.md 3.1. */
export const WAVE_SECONDS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 60, 60, 90];

/**
 * Plausibility caps for a run report, by waves cleared (index 0..12).
 * Each entry is 1.5 times the largest value any bot run produced by the end
 * of the wave the run died in (the wave after the last one cleared), over all
 * six characters: 1,800 expert runs, 720 average runs, and 720 runs each with
 * tier 5 stations and with two cap-point kit items at full strength
 * (`npx tsx tools/exp/meta/maxima.ts`, tables from maxima-report.ts).
 * A report over a cap is refused. Re-measure whenever src/sim balance changes.
 */
// Re-measured after the depth rework (tools/exp/depth/maxima.sh, 100 seeds x 6 characters x 5 configurations):
// each entry is the larger of that measurement at 1.5x and the one before it, so no honest run under either is refused.
export const REPORT_CAPS = {
  /** Scrip earned over the whole run. */
  scripEarned: [50, 135, 225, 390, 610, 945, 1545, 2575, 4140, 6060, 8400, 9765, 9765],
  /** Enemies killed. */
  kills: [45, 125, 285, 515, 815, 1230, 1610, 2350, 3205, 4335, 5485, 7095, 7095],
  /** All raws, held plus mule, with every station at tier 1. */
  rawsTotal: [18, 44, 77, 114, 137, 185, 210, 228, 279, 290, 290, 327, 327],
  /** One raw, held plus mule, with its station at tier 1. */
  rawsEach: [9, 24, 48, 63, 66, 89, 95, 107, 155, 176, 222, 261, 261],
  /** Each station tier above 1 adds this share to the raw caps (measured at tier 5, then spread evenly). */
  rawsPerStationTier: 0.69,
  /** Fusions made in one run. */
  fusions: 24,
};
/**
 * Scrip held pays marks, and a forger can claim any amount up to what was
 * earned. So the part that pays is clamped, not refused: 1.25 times the most
 * any bot held at that point. An honest hoarder over it loses the excess.
 */
export const SCRIP_PAID_CAP = [40, 100, 115, 165, 225, 315, 530, 965, 1440, 1785, 2110, 3240, 3240];
/**
 * What a run that the server has not played again is paid for, at most: the
 * 75th percentile of ordinary bot runs (no kit, tier 1 stations) at that
 * point. With replay checking on, a report without a matching replay is still
 * taken, but it cannot pay better than an ordinary run. Raws scale with
 * station tier like the caps above.
 */
export const UNCHECKED_PAY = { scripHeld: [26, 56, 63, 90, 131, 156, 235, 421, 607, 747, 1019, 1328, 1328], rawsTotal: [9, 16, 22, 32, 39, 52, 55, 56, 56, 56, 56, 56, 56],
  /** An unchecked run carries home one item for this many waves cleared (a checked one: every four), and none of tier 4. */
  wavesPerItem: 6,
};
/** Shortest boss wave any bot managed (5.2 s, with two cap-point kit items), with slack taken off. Killing the boss ends wave 12 early. */
export const BOSS_WAVE_MIN_SECONDS = 3;
/** A report sooner than this pays nothing. The fastest death of a player who never moves, and of any bot, is 10.3 s. */
export const MIN_REPORT_SECONDS = 6;
/** The server times a run on its own clock from start to report, so only a little slack is needed. */
export const DURATION_SLACK_SECONDS = 2;
export const TICKET_TTL_MS = 6 * 3600 * 1000;

/**
 * Paying runs per account, and per address, in a rolling window. A run over
 * the limit can still be played and reported; it pays nothing and does not
 * count. Twelve an hour is more than twice what a person can play.
 */
export const RUN_RATE = { perHour: 12, perDay: 80, ipMul: 3 };

export const MARKS_PER_WAVE = 3;
/** Scrip held at the end pays one mark for this much. It was 10: hoarding scrip on the last wave paid better than spending it. */
export const SCRIP_PER_MARK = 20;
/** Report caps grow by this share per hazard level. Measured: hazard adds no scrip or raws and at most 6.5% kills (docs/critique/depth-after.md). */
export const HAZARD_REPORT_SLACK = 0.1;

// Hazard, the kit cap, the sinks and the market gates are shared with the town pages: src/shared/rules.ts.
export {
  HAZARD_MARKS, KIT_POINT_CAP, LISTING_MARKS_PER_POINT, LISTING_MIN_RUNS, MAX_HAZARD, MAX_LOT, NAME_REROLL_MS, RELIC_TRADE, REPAIR, STASH,
  TOWN_FUND_PER_DAY, TOWN_FUSE_MARKS, TOWN_FUSE_RAW_MUL, kitPointCap, priceCeiling, repairCost, stashLimit, stashNextCost, townFuseCost,
} from '../src/shared/rules.ts';

export const CHARACTERS: CharacterId[] = ['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk'];
/** Feature unlocked by finishing run N (DESIGN.md 5.5). Run 2 unlocks a character. */
export const FEATURE_AT: Record<Feature, number> = { workshop: 1, market: 3, daily: 4, town: 5 };
/**
 * An account with fewer paid runs than this is new: what it may pay out and
 * take in through other players in one day is capped, so marks cannot be
 * funnelled through throwaway accounts.
 */
export const NEW_ACCOUNT = { runs: 30, marksPerDay: 600 };
/** Untried pairs a day for an account with fewer than `runs` paid runs. */
export const NOVICE_NOVEL = { runs: 5, perDay: 3 };

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
  revert: 0.25, // ease toward base at each day change
  dailyBase: 150, // units per side per raw per day, for each player on their own
  maxQty: 100, // per request
};
export const LISTING = {
  maxPrice: 100_000,
  maxOpen: 20,
  /** Open buy orders per player. */
  maxOrders: 10,
  /** A relic has no price cap. This is only the largest whole number of marks the books will write down. */
  relicBookLimit: 1_000_000_000_000,
};
/**
 * Share of sale tax that goes to the town project. The town spends it at the
 * Factor's selling price, so a mark of tax buys far less than a raw: trading
 * an item back and forth is a worse way to build than buying raws and giving them.
 */
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

/**
 * Works: what the town builds once every station is at its top tier, one
 * after another, for ever. Each finished works gives everyone a small perk
 * for a week. Targets are per assumed giver, like station projects.
 */
export type WorksId = 'fair' | 'beacon' | 'bridge' | 'granary';
export const WORKS: { id: WorksId; name: string; perk: string; need: RawBag }[] = [
  { id: 'fair', name: 'Hold a fair', perk: 'No listing fee', need: { timber: 140, ore: 60, hide: 100 } },
  { id: 'beacon', name: 'Light the beacon', perk: 'Five more untried pairs a day', need: { timber: 160, ore: 80, hide: 60 } },
  { id: 'bridge', name: 'Mend the bridge', perk: 'The Factor pays a fifth more for raws', need: { timber: 120, ore: 140, hide: 40 } },
  { id: 'granary', name: 'Fill the granary', perk: 'Repairs cost a quarter less', need: { timber: 80, ore: 60, hide: 160 } },
];
export const WORKS_PERK_MS = 7 * 24 * 3600 * 1000;
export const PERK = { beaconNovel: 5, bridgeSellMul: 1.2, granaryRepair: 0.75 };

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
