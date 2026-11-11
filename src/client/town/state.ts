// What the town half knows, in one place. Pages read from here and call
// redraw() after changing it. The server owns the truth; this is a copy.

import type {
  AlmanacRes, CharacterId, CodexRes, DailyRes, Feature, MarketRes, Profile, RelicsRes, StationId, TownRes, WorldNotice,
} from '../../shared/protocol.ts';
import { ApiFail, asFail } from './api.ts';

export type TabId = 'stash' | Feature | 'almanac';
export type NoticeKind = 'plain' | 'town' | 'danger';
export interface Notice {
  tag: string;
  text: string;
  kind: NoticeKind;
}

export interface AppState {
  /** False until the server has answered once this session. */
  met: boolean;
  /** False while the server is not answering. Runs are local and unsaved. */
  online: boolean;
  profile: Profile;
  stations: Record<StationId, number>;
  tab: TabId;
  notice: Notice | null;
  /** Choices for the next run. Kit entries are stash uids. */
  character: CharacterId;
  kit: string[];
  /** Hazard level asked for. Clamped to what is open for the character when it is used. */
  hazard: number;
  almanac: AlmanacRes | null;
  market: MarketRes | null;
  town: TownRes | null;
  daily: DailyRes | null;
  codex: CodexRes | null;
  /** The world's roll of relics, for the workshop page. */
  relics: RelicsRes | null;
  /** The newest relic find of the last 24 hours, told to everyone on the home page. */
  worldNotice: WorldNotice;
  /** Names of requests in flight, so their stamps can wait. */
  busy: Set<string>;
}

export const strangerProfile = (): Profile => ({
  name: '',
  marks: 0,
  raws: { timber: 0, ore: 0, hide: 0 },
  items: [],
  runs: 0,
  wins: 0,
  characters: ['greenhorn'],
  features: [],
  standing: 0,
  novelLeft: 0,
  daysPlayed: 0,
  finds: 0,
  title: '',
  titles: [],
  stashUsed: 0,
  stashLimit: 24,
  stashBought: 0,
  hazard: { greenhorn: { open: 0, best: -1 }, sawyer: { open: 0, best: -1 }, smith: { open: 0, best: -1 }, trapper: { open: 0, best: -1 }, tinker: { open: 0, best: -1 }, clerk: { open: 0, best: -1 } },
  nameChangeAt: 0,
});

/** The hazard the next run will be at: what was asked for, no higher than what is open for the character. */
export const hazardNow = (): number => Math.max(0, Math.min(app.hazard, app.profile.hazard?.[app.character]?.open ?? 0));

export const app: AppState = {
  met: false,
  online: false,
  profile: strangerProfile(),
  stations: { sawmill: 1, smelter: 1, tannery: 1, assay: 1 },
  tab: 'stash',
  notice: null,
  character: 'greenhorn',
  kit: [],
  hazard: 0,
  almanac: null,
  market: null,
  town: null,
  daily: null,
  codex: null,
  relics: null,
  worldNotice: null,
  busy: new Set(),
};

// ---- small persisted choices (never required; storage may be blocked) ------

const PREF_KEY = 'scrip.town';
interface Prefs {
  tab?: TabId;
  character?: CharacterId;
  kit?: string[];
  hazard?: number;
  /** Date of the last scored daily ticket taken on this device. */
  dailyTaken?: string;
}
let prefs: Prefs = {};
try {
  const rawPrefs = localStorage.getItem(PREF_KEY);
  if (rawPrefs) prefs = JSON.parse(rawPrefs) as Prefs;
} catch {
  // defaults
}
export const getPrefs = (): Prefs => prefs;
export function savePrefs(p: Partial<Prefs>): void {
  prefs = { ...prefs, ...p };
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    // session only
  }
}

// ---- redraw ----------------------------------------------------------------

let draw: () => void = () => {};
export function onRedraw(fn: () => void): void {
  draw = fn;
}
export function redraw(): void {
  draw();
}

// ---- profile ---------------------------------------------------------------

/** Take a fresh profile and drop choices it no longer allows. */
export function setProfile(p: Profile): void {
  app.profile = p;
  app.met = true;
  if (!p.characters.includes(app.character)) app.character = p.characters[0] ?? 'greenhorn';
  const have = new Set(p.items.map((i) => i.uid));
  app.kit = app.kit.filter((uid) => have.has(uid));
  if (app.tab !== 'stash' && app.tab !== 'almanac' && !p.features.includes(app.tab)) app.tab = 'stash';
}

// ---- notices ---------------------------------------------------------------

export function say(tag: string, text: string, kind: NoticeKind = 'plain'): void {
  app.notice = { tag, text, kind };
}
export function clearNotice(): void {
  app.notice = null;
}

/** Put a failure on the notice line in the server's own words. */
export function sayFail(tag: string, e: unknown): ApiFail {
  const f = asFail(e);
  if (!(e instanceof ApiFail)) console.error(e);
  // When the town is out of reach the standing line under the tabs already says so.
  if (f.unreachable) app.notice = null;
  else say(tag, f.message, 'town');
  return f;
}

/**
 * Run one request behind a stamp: mark it busy, redraw, and put any failure
 * on the notice line. Returns undefined on failure.
 */
export async function act<T>(name: string, tag: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (app.busy.has(name)) return undefined;
  app.busy.add(name);
  clearNotice();
  redraw();
  try {
    return await fn();
  } catch (e) {
    sayFail(tag, e);
    return undefined;
  } finally {
    app.busy.delete(name);
    redraw();
  }
}
