// Wire types shared by client and server. All requests are JSON over
// /api/*. The device token travels in the `x-device` header.

import type { ItemSpec } from './item.ts';
import type { RawBag, RawId } from './vocab.ts';

export type CharacterId = 'greenhorn' | 'sawyer' | 'smith' | 'trapper' | 'tinker' | 'clerk';
export type StationId = 'sawmill' | 'smelter' | 'tannery' | 'assay';
export type Feature = 'workshop' | 'market' | 'daily' | 'town';

export const RUN_WAVES = 12;
export const DAILY_WAVES = 8;
export const KIT_SLOTS = 2;
export const KIT_CHARGES = 3;
/** Only this many relics may be packed for a run. A relic does not wear, so it has no charges to spend. */
export const KIT_RELICS = 1;
export const DEATH_RAW_KEEP = 0.3;
export const LISTING_FEE = 0.02;
export const SALE_TAX = 0.05;
export const BASE_NOVEL_PER_DAY = 20;

export interface StashItem {
  uid: string;
  item: ItemSpec;
  charges: number;
  /** Times this item has been repaired. At most REPAIR.perItem. */
  repairs?: number;
}

export interface Profile {
  name: string;
  marks: number;
  raws: RawBag;
  items: StashItem[];
  runs: number;
  wins: number;
  characters: CharacterId[];
  features: Feature[];
  standing: number;
  /** Untried pairs left today. */
  novelLeft: number;
  daysPlayed: number;
  /** Finds that count: authored pairs, and the first making of a finished (tier 4) item. */
  finds: number;
  /** The title worn beside the name, or '' for none. An id from src/shared/almanac.ts. */
  title: string;
  /** Titles earned so far, oldest first. */
  titles: string[];
  /** Items the stash holds (relics are not counted) and how many it can. */
  stashUsed: number;
  stashLimit: number;
  /** Shelves bought so far; the next one is priced by stashNextCost(). */
  stashBought: number;
  /** Per character: the highest hazard that may be entered, and the highest won (-1 for none). */
  hazard: Record<CharacterId, { open: number; best: number }>;
  /** When the name may next be changed, in ms. 0 means now. */
  nameChangeAt: number;
}

export interface ApiError { error: string; code: string }

/** One relic somebody brought home. The current holder is never sent. */
export interface RelicFind {
  /** Relic id, see src/shared/content/relics.ts. */
  relic: string;
  name: string;
  /** Its number among relics of its kind, in the order found. */
  serial: number;
  finder: string;
  /** YYYY-MM-DD */
  date: string;
  ts: number;
}

/** The newest find of the last 24 hours, shown to everyone on the home page. */
export type WorldNotice = RelicFind | null;

// GET /api/relics
export interface RelicsRes {
  /** Every find, oldest first. */
  roll: RelicFind[];
  /**
   * One row per relic kind, in a fixed order. A kind nobody has found is sent
   * with no id and no name, so the page can rule a blank line for it.
   */
  kinds: { id: string | null; name: string | null; found: number }[];
  total: number;
}

// POST /api/hello  {}  (token in header, or absent for a new device)
export interface HelloRes { token: string; profile: Profile; stations: Record<StationId, number>; llm: boolean; notice: WorldNotice }

// POST /api/name/reroll {}
export interface NameRes { profile: Profile }

// POST /api/fuse
export interface FuseReq {
  a: string;
  b: string;
  /** 'run': knowledge lookup only, the sim consumes the items.
   *  'town': consume two stash items and add the result to the stash. */
  ctx: 'run' | 'town';
  uidA?: string;
  uidB?: string;
  /** For ctx 'run': the open run this fusion belongs to. The server records it and checks carried items against the record. */
  runId?: string;
}
export interface FuseRes {
  item: ItemSpec;
  /** True if nobody had tried this pair before this call. */
  first: boolean;
  /** True if this player had not made this pair before. */
  newToYou: boolean;
  by: string;
  /** True if this find moves the finds counter (see Profile.finds). */
  counted?: boolean;
  profile?: Profile;
}
// Error codes: 'novel_limit' | 'model_down' | 'blocked' | 'unknown_item' | 'not_owned' | 'no_run' | 'not_held' | 'no_marks' | 'no_raws'
// A town fusion costs raws and marks by the result's tier (townFuseCost in src/shared/rules.ts); the result keeps the lower of the two inputs' charges.
// A relic on either side is always 'blocked'.

// GET /api/items?ids=a,b,c
export interface ItemsRes { items: ItemSpec[] }

// GET /api/codex
export interface CodexRecipe { a: string; b: string; out: string; by: string; mine: boolean }
export interface CodexRes {
  /** Recipes this player has made, plus the 50 most recent world finds. */
  recipes: CodexRecipe[];
  items: ItemSpec[];
  worldRecipes: number;
  worldItems: number;
  /** Pairs of two authored items: how many there are, how many the world has tried, how many this player has made. */
  authoredPairs: number;
  worldAuthored: number;
  myAuthored: number;
}

// POST /api/run/start
export interface RunStartReq {
  mode: 'run' | 'daily' | 'practice';
  character: CharacterId;
  kit: string[];
  /** 0-5, full runs only. A level must be open for the character (Profile.hazard). Default 0. */
  hazard?: number;
}
export interface RunStartRes {
  runId: string;
  seed: number;
  waves: number;
  character: CharacterId;
  /** The kit as it enters the run: items over the hazard's point cap are packed down (src/shared/kit.ts). */
  kit: ItemSpec[];
  stations: Record<StationId, number>;
  /** Hazard level of this run. Pass it to createRun. Absent on old servers: read as 0. */
  hazard?: number;
  profile: Profile;
  notice: WorldNotice;
}

// POST /api/run/end
export interface RunEndReq {
  runId: string;
  wavesCleared: number;
  won: boolean;
  scripEarned: number;
  scripHeld: number;
  level: number;
  /** Raws held at the end, before the death cut. The server applies the cut. */
  raws: RawBag;
  /** Raws sent home on the mule. */
  mule: RawBag;
  /** Item ids chosen to carry home. */
  carry: string[];
  kills: number;
  /** Fusions made during the run: [a, b, out]. Used to check carried items. */
  fusions: [string, string, string][];
  /** True if the player left from the pause menu. A run that was left never rolls for a relic. */
  quit?: boolean;
  /** Kills by enemy id, for the almanac. Must not add up to more than `kills`. */
  killsBy?: Record<string, number>;
  /** The input log of the run (src/shared/replay.ts), so the server can play it again and check the report. */
  replay?: string;
}
export interface RunEndRes {
  profile: Profile;
  gained: { raws: RawBag; marks: number; items: ItemSpec[] };
  /** A relic found on this run, already in the stash. Not listed in gained.items. Decided by the server alone. */
  relic?: ItemSpec;
  notice: WorldNotice;
  unlockedFeature?: Feature;
  unlockedCharacter?: CharacterId;
  daily?: { rank: number; players: number; scored: boolean };
  /** False when the run was over the hourly or daily limit of paying runs: nothing was paid and it did not count. */
  paid?: boolean;
  /** Carried items that did not fit in the stash and were salvaged at the door, and the marks they fetched (inside gained.marks). */
  salvaged?: { items: number; marks: number };
  /** A hazard level this win opened for the character. */
  hazardOpened?: number;
  /** Titles earned by this run. */
  titles?: string[];
  /** 'ok' the replay matched, 'mismatch' it did not, 'none' no replay was checked. */
  replay?: 'ok' | 'mismatch' | 'none';
}

// GET /api/market
/** buyLeft and sellLeft are this player's own room with the Factor today. */
export interface FactorQuote { buy: number; sell: number; buyLeft: number; sellLeft: number }
export interface Listing { id: string; item: ItemSpec; charges: number; price: number; seller: string; mine: boolean }
/** A lot of one raw, posted by a player at one price for the whole lot. */
export interface RawLot { id: string; raw: RawId; qty: number; price: number; seller: string; mine: boolean }
/**
 * A buy order: what a player wants and the marks already set aside for it.
 * A raw order may be filled a part at a time; an item order is for one item
 * with full charges. `price` is per unit.
 */
export interface Order { id: string; raw?: RawId; item?: ItemSpec; qty: number; filled: number; price: number; buyer: string; mine: boolean }
export interface MarketRes { open: boolean; factor: Record<RawId, FactorQuote>; listings: Listing[]; lots: RawLot[]; orders: Order[] }

// POST /api/market/factor
export interface FactorReq { raw: RawId; side: 'buy' | 'sell'; qty: number; idem: string }
// POST /api/market/list  (the price cap does not apply to a relic)
// Either an item from the stash (uid) or a lot of raws (raw and qty). An item
// may cost at most priceCeiling(); a lot at most what the Factor would charge.
export interface ListReq { uid?: string; raw?: RawId; qty?: number; price: number; idem: string }
// POST /api/market/buy  (an item listing or a raw lot)
export interface BuyReq { listingId: string; idem: string }
// POST /api/market/cancel
export interface CancelReq { listingId: string }
// POST /api/market/salvage  (destroy a stash item for a few marks; a relic is refused with 'relic_kept')
export interface SalvageReq { uid: string }
// POST /api/market/order  (place a buy order; qty x price marks are set aside at once)
export interface OrderReq { raw?: RawId; itemId?: string; qty?: number; price: number; idem: string }
// POST /api/market/fill  (sell into someone's order: qty raws, or the stash item uid)
export interface FillReq { orderId: string; qty?: number; uid?: string; idem: string }
// POST /api/market/order/cancel  (the marks for the unfilled part come back)
export interface OrderCancelReq { orderId: string }
export interface MarketActionRes { profile: Profile; market: MarketRes }
// Error codes: 'listing_locked' | 'price_cap' | 'transfer_cap' | 'relic_history' | 'stash_full' | 'order_gone' | 'factor_limit'

// POST /api/workshop/repair  (one charge back; price from repairCost())
export interface RepairReq { uid: string; idem: string }
// POST /api/stash/expand  (one more shelf; price from stashNextCost())
export interface ExpandReq { idem: string }
export interface WorkshopRes { profile: Profile }

// GET /api/town
export interface TownProject {
  /** 'station': raise `station` to `toTier`. 'works': a repeating town works; `works` names it and says what it gives for a week. */
  kind: 'station' | 'works';
  /** Set for kind 'station'. */
  station?: StationId;
  toTier: number;
  works?: { id: string; name: string; perk: string };
  need: RawBag;
  have: RawBag;
}
/** A finished works whose perk is still running. */
export interface TownPerk { id: string; name: string; perk: string; until: number }
export interface TownRes {
  stations: Record<StationId, number>;
  project: TownProject | null;
  perks: TownPerk[];
  givers: { name: string; title: string; given: number }[];
  /** Players with a paid run in the last seven days. */
  activePlayers: number;
}
// POST /api/town/give  (idem makes a retry safe)
// `marks` pays the Factor to deliver what the project needs most, at his selling price: at most that many
// marks are spent, on whole units, up to TOWN_FUND_PER_DAY units a day. Raws and marks may be given together.
export interface GiveReq { raws: Partial<RawBag>; marks?: number; idem?: string }
export interface GiveRes { profile: Profile; town: TownRes }

// GET /api/daily
export interface DailyRes {
  date: string;
  character: CharacterId;
  mine: { waves: number; scrip: number; rank: number } | null;
  /** True once today's scored attempt has been started, finished or not. */
  taken: boolean;
  players: number;
  top: { name: string; title: string; waves: number; scrip: number }[];
}

// GET /api/almanac
export interface AlmanacLine {
  id: string;
  label: string;
  have: number;
  /** 0 when the list has no end (for example fused items made). */
  of: number;
}
export interface AlmanacRes {
  lines: AlmanacLine[];
  /** Sum over the lines that have an end. */
  have: number;
  of: number;
  /** Authored item ids brought home at least once. */
  items: string[];
  /** Kills by enemy id. */
  enemies: Record<string, number>;
  /** Per character, the hazard levels won. */
  wins: Record<string, number[]>;
  /** Relic ids this player has held. */
  relics: string[];
  /** Every title: earned or not, and when. */
  titles: { id: string; name: string; how: string; earned: number | null; worn: boolean }[];
  /** The world's book of authored pairs. */
  world: { authoredPairs: number; found: number };
}
// POST /api/almanac/title  { title }  ('' wears none)
export interface TitleReq { title: string }
export interface TitleRes { profile: Profile }
