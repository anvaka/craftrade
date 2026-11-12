// The loot prototype's store, on this device only.
import { CHARGES, MATS, SCHEMATICS, type Mat } from './content.ts';

export interface Gear { schematic: string; charges: number; packed: boolean }
export interface LootSave {
  v: 1;
  mats: Record<Mat, number>;
  /** Schematic ids known. */
  known: string[];
  /** The schematic the run's strip counts toward. */
  track: string;
  gear: Gear[];
  runs: number;
  /** What the last run brought home, for the stash page. */
  last: { won: boolean; mats: Partial<Record<Mat, number>>; learned: string[]; dupes: number } | null;
}

const KEY = 'scrip.loot';
const blank = (): LootSave => ({
  v: 1, mats: Object.fromEntries(MATS.map((m) => [m, 0])) as Record<Mat, number>,
  known: [SCHEMATICS[0].id], track: SCHEMATICS[0].id, gear: [], runs: 0, last: null,
});

export function loadLoot(): LootSave {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as LootSave | null;
    if (!raw || raw.v !== 1) return blank();
    const s = blank();
    for (const m of MATS) s.mats[m] = Math.max(0, Math.floor(Number(raw.mats?.[m]) || 0));
    s.known = Array.isArray(raw.known) ? raw.known.filter((k) => SCHEMATICS.some((x) => x.id === k)) : s.known;
    if (!s.known.length) s.known = [SCHEMATICS[0].id];
    s.track = s.known.includes(raw.track) ? raw.track : s.known[0];
    s.gear = Array.isArray(raw.gear) ? raw.gear.filter((g) => SCHEMATICS.some((x) => x.id === g.schematic) && g.charges > 0).map((g) => ({ schematic: g.schematic, charges: Math.min(CHARGES, Math.floor(g.charges)), packed: !!g.packed })) : [];
    s.runs = Math.max(0, Math.floor(Number(raw.runs) || 0));
    s.last = raw.last ?? null;
    return s;
  } catch {
    return blank();
  }
}

export function saveLoot(s: LootSave): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: the change lasts this page only */ }
}

/** Is the loot prototype on? Turned on by ?proto=loot, and kept on this device. */
export function lootOn(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('proto');
    if (q === 'loot') localStorage.setItem('scrip.proto', 'loot');
    else if (q === 'off') localStorage.removeItem('scrip.proto');
    return localStorage.getItem('scrip.proto') === 'loot';
  } catch {
    return false;
  }
}
