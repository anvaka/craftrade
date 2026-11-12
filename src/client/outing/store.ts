// What outings have brought home, kept on this device. A prototype store:
// nothing in the town reads it yet.
import { MATERIALS, SKILLS, type Haul } from '../../sim/index.ts';

export interface OutingSave {
  v: 1;
  /** Skill experience, indexed like SKILLS. */
  xp: number[];
  /** Materials in store, indexed like MATERIALS. */
  store: number[];
  outings: number;
}

const KEY = 'scrip.outing';
const blank = (): OutingSave => ({ v: 1, xp: SKILLS.map(() => 0), store: MATERIALS.map(() => 0), outings: 0 });

export function loadOuting(): OutingSave {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<OutingSave> | null;
    if (!raw || raw.v !== 1) return blank();
    const s = blank();
    s.xp = s.xp.map((_, i) => Math.max(0, Number(raw.xp?.[i]) || 0));
    s.store = s.store.map((_, i) => Math.max(0, Math.floor(Number(raw.store?.[i]) || 0)));
    s.outings = Math.max(0, Math.floor(Number(raw.outings) || 0));
    return s;
  } catch {
    return blank();
  }
}

/** Add an outing's haul to the store and write it down. */
export function bankHaul(h: Haul): OutingSave {
  const s = loadOuting();
  s.xp = h.xp.slice(0, s.xp.length);
  h.kept.forEach((n, i) => { if (i < s.store.length) s.store[i] += n; });
  s.outings++;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: the outing still happened */ }
  return s;
}
