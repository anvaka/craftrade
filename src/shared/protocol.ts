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
export const DEATH_RAW_KEEP = 0.3;
export const LISTING_FEE = 0.02;
export const SALE_TAX = 0.05;
export const BASE_NOVEL_PER_DAY = 20;

export interface StashItem {
  uid: string;
  item: ItemSpec;
  charges: number;
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
  finds: number;
}

export interface ApiError { error: string; code: string }

// POST /api/hello  {}  (token in header, or absent for a new device)
export interface HelloRes { token: string; profile: Profile; stations: Record<StationId, number>; llm: boolean }

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
}
export interface FuseRes {
  item: ItemSpec;
  /** True if nobody had tried this pair before this call. */
  first: boolean;
  /** True if this player had not made this pair before. */
  newToYou: boolean;
  by: string;
  profile?: Profile;
}
// Error codes: 'novel_limit' | 'model_down' | 'blocked' | 'unknown_item' | 'not_owned'

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
}

// POST /api/run/start
export interface RunStartReq { mode: 'run' | 'daily' | 'practice'; character: CharacterId; kit: string[] }
export interface RunStartRes {
  runId: string;
  seed: number;
  waves: number;
  character: CharacterId;
  kit: ItemSpec[];
  stations: Record<StationId, number>;
  profile: Profile;
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
}
export interface RunEndRes {
  profile: Profile;
  gained: { raws: RawBag; marks: number; items: ItemSpec[] };
  unlockedFeature?: Feature;
  unlockedCharacter?: CharacterId;
  daily?: { rank: number; players: number; scored: boolean };
}

// GET /api/market
export interface FactorQuote { buy: number; sell: number; buyLeft: number; sellLeft: number }
export interface Listing { id: string; item: ItemSpec; charges: number; price: number; seller: string; mine: boolean }
export interface MarketRes { open: boolean; factor: Record<RawId, FactorQuote>; listings: Listing[] }

// POST /api/market/factor
export interface FactorReq { raw: RawId; side: 'buy' | 'sell'; qty: number; idem: string }
// POST /api/market/list
export interface ListReq { uid: string; price: number; idem: string }
// POST /api/market/buy
export interface BuyReq { listingId: string; idem: string }
// POST /api/market/cancel
export interface CancelReq { listingId: string }
// POST /api/market/salvage  (destroy a stash item for a few marks)
export interface SalvageReq { uid: string }
export interface MarketActionRes { profile: Profile; market: MarketRes }

// GET /api/town
export interface TownRes {
  stations: Record<StationId, number>;
  project: { station: StationId; toTier: number; need: RawBag; have: RawBag } | null;
  givers: { name: string; given: number }[];
  activePlayers: number;
}
// POST /api/town/give
export interface GiveReq { raws: Partial<RawBag> }
export interface GiveRes { profile: Profile; town: TownRes }

// GET /api/daily
export interface DailyRes {
  date: string;
  character: CharacterId;
  mine: { waves: number; scrip: number; rank: number } | null;
  /** True once today's scored attempt has been started, finished or not. */
  taken: boolean;
  players: number;
  top: { name: string; waves: number; scrip: number }[];
}
