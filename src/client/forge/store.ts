// The forge game's state, on this device only.
import { MATS, SKILLS, START, START_COIN, type Mat, type SkillId, type StationId } from './content.ts';

export interface Made {
  uid: number;
  recipe: string;
  /** Weapon id, or the item id for armour and food. */
  tier: number;
  quality: number;
  sockets: number;
  charges: number;
  /** Part fitted at the craft (index into PARTS), or -1. */
  perk: number;
  name: string;
  packed: boolean;
}
export interface Discovery { key: string; name: string; at: string }
export interface Report {
  won: boolean; zone: number; waves: number; coin: number; mats: Partial<Record<Mat, number>>; lost: number;
  parts: number[]; learned: string[]; dupes: number; relics: string[]; worn: string[];
}
export interface ForgeSave {
  v: 1;
  mats: Record<Mat, number>;
  coin: number;
  /** Part counts by index into PARTS. */
  parts: number[];
  xp: Record<SkillId, number>;
  stations: Record<StationId, number>;
  known: string[];
  made: Made[];
  food: Record<string, number>;
  packedFood: string;
  rack: string[];
  shelf: { id: string; at: string; packed: boolean }[];
  codex: Discovery[];
  pity: number;
  runs: number;
  nextUid: number;
  last: Report | null;
}

const KEY = 'scrip.forge';
export function blank(): ForgeSave {
  return {
    v: 1, mats: Object.fromEntries(MATS.map((m) => [m, START[m] ?? 0])) as Record<Mat, number>, coin: START_COIN,
    parts: [0, 0, 0, 0, 0, 0], xp: Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<SkillId, number>,
    stations: { forge: 1, outfitter: 1, kitchen: 1 }, known: [], made: [], food: {}, packedFood: '', rack: [], shelf: [], codex: [],
    pity: 0, runs: 0, nextUid: 1, last: null,
  };
}

export function loadForge(): ForgeSave {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as ForgeSave | null;
    if (!raw || raw.v !== 1) return blank();
    const s = blank();
    for (const m of MATS) s.mats[m] = Math.max(0, Math.floor(Number(raw.mats?.[m]) || 0));
    for (const k of SKILLS) s.xp[k] = Math.max(0, Number(raw.xp?.[k]) || 0);
    for (const k of ['forge', 'outfitter', 'kitchen'] as StationId[]) s.stations[k] = Math.max(1, Math.min(2, Math.floor(Number(raw.stations?.[k]) || 1)));
    s.coin = Math.max(0, Math.floor(Number(raw.coin) || 0));
    s.parts = s.parts.map((_, i) => Math.max(0, Math.floor(Number(raw.parts?.[i]) || 0)));
    s.known = Array.isArray(raw.known) ? raw.known.filter((k) => typeof k === 'string') : [];
    s.made = Array.isArray(raw.made) ? raw.made : [];
    s.food = raw.food && typeof raw.food === 'object' ? raw.food : {};
    s.packedFood = typeof raw.packedFood === 'string' ? raw.packedFood : '';
    s.rack = Array.isArray(raw.rack) ? raw.rack : [];
    s.shelf = Array.isArray(raw.shelf) ? raw.shelf : [];
    s.codex = Array.isArray(raw.codex) ? raw.codex : [];
    s.pity = Math.max(0, Math.floor(Number(raw.pity) || 0));
    s.runs = Math.max(0, Math.floor(Number(raw.runs) || 0));
    s.nextUid = Math.max(1, Math.floor(Number(raw.nextUid) || 1));
    s.last = raw.last ?? null;
    return s;
  } catch {
    return blank();
  }
}

export function saveForge(s: ForgeSave): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: the change lasts this page only */ }
}

/** Is a prototype on? Turned on by ?proto=<name> and kept on this device; ?proto=off turns it off. */
export function protoOn(name: string): boolean {
  try {
    const q = new URLSearchParams(location.search).get('proto');
    if (q === 'off') localStorage.removeItem('scrip.proto');
    else if (q) localStorage.setItem('scrip.proto', q);
    return localStorage.getItem('scrip.proto') === name;
  } catch {
    return false;
  }
}
