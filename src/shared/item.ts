import {
  DRAWBACK_REFUND, FUSION_BONUS, GLYPHS, MAX_POINTS, PRIM, PRIMITIVES, RULESET, TIER_AT,
  type GlyphId,
} from './vocab.ts';

export interface Effect {
  /** Primitive id. */
  p: string;
  /** Level 1-5. */
  l: number;
  /** True for a drawback. Only stat primitives can be drawbacks. */
  neg?: boolean;
}

export interface ItemSpec {
  id: string;
  name: string;
  glyph: GlyphId;
  tags: string[];
  effects: Effect[];
  /** Base price in scrip for authored items. Fused items derive it from points. */
  price?: number;
  /** Raw cost at the bench for authored items. */
  raws?: Partial<Record<'timber' | 'ore' | 'hide', number>>;
  /** Display name of the first finder, for fused items. */
  by?: string;
}

export function effectPoints(e: Effect): number {
  const prim = PRIM[e.p];
  if (!prim) return 0;
  const c = prim.cost[e.l - 1] ?? 0;
  return e.neg ? -Math.round(c * DRAWBACK_REFUND) : c;
}

export function itemPoints(effects: readonly Effect[]): number {
  let n = 0;
  for (const e of effects) n += effectPoints(e);
  return Math.max(1, n);
}

export function tierOf(points: number): 1 | 2 | 3 | 4 {
  if (points >= TIER_AT[3]) return 4;
  if (points >= TIER_AT[2]) return 3;
  if (points >= TIER_AT[1]) return 2;
  return 1;
}

export const itemTier = (item: Pick<ItemSpec, 'effects'>) => tierOf(itemPoints(item.effects));

export function effectValue(e: Effect): number {
  const prim = PRIM[e.p];
  if (!prim) return 0;
  const v = prim.values[e.l - 1] ?? 0;
  return e.neg ? -v : v;
}

export function effectText(e: Effect): string {
  const prim = PRIM[e.p];
  if (!prim) return '';
  const v = prim.values[e.l - 1];
  const t = prim.text.replace('{v}', String(v));
  return e.neg ? t.replace('+', '-') : t;
}

export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function canonicalEffects(effects: readonly Effect[]): Effect[] {
  return effects
    .map((e) => (e.neg ? { p: e.p, l: e.l, neg: true } : { p: e.p, l: e.l }))
    .sort((a, b) => (a.neg ? 1 : 0) - (b.neg ? 1 : 0) || (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));
}

/** Id of a fused item. Depends only on its effects, so pairs can converge. */
export function fusedItemId(effects: readonly Effect[]): string {
  const s = canonicalEffects(effects).map((e) => `${e.p}${e.l}${e.neg ? '-' : ''}`).join(',');
  return 'f' + fnv1a(`${RULESET}|${s}`).toString(36);
}

export function recipeKey(a: string, b: string): string {
  return `${RULESET}:${a < b ? `${a}+${b}` : `${b}+${a}`}`;
}

export function fusionBudget(a: Pick<ItemSpec, 'effects'>, b: Pick<ItemSpec, 'effects'>): number {
  return Math.min(MAX_POINTS, Math.round((itemPoints(a.effects) + itemPoints(b.effects)) * FUSION_BONUS));
}

/** Why a pair cannot be fused, or null if it can. */
export function fusionBlock(a: ItemSpec, b: ItemSpec): string | null {
  if (a.id === b.id) return 'Two of the same item do not fuse.';
  if (itemTier(a) === 4 || itemTier(b) === 4) return 'A tier 4 item is finished and cannot be fused.';
  return null;
}

export interface FusionPick {
  names: string[];
  glyph: string;
  tags: string[];
  effects: { p: string; l: number; neg?: boolean }[];
}

/**
 * Turn whatever the model returned into a legal effect list that fits the
 * budget. Fully deterministic: same picks, budget and seed give the same list.
 */
export function repairEffects(picks: FusionPick['effects'], budget: number, seed: number): Effect[] {
  const seen = new Set<string>();
  const pos: Effect[] = [];
  let neg: Effect | null = null;
  for (const raw of picks ?? []) {
    const prim = PRIM[raw?.p];
    if (!prim || seen.has(prim.id)) continue;
    const l = Math.min(5, Math.max(1, Math.round(Number(raw.l) || 1)));
    if (raw.neg) {
      if (prim.kind === 'stat' && !neg) { neg = { p: prim.id, l: Math.min(l, 3), neg: true }; seen.add(prim.id); }
    } else if (pos.length < 3) {
      pos.push({ p: prim.id, l });
      seen.add(prim.id);
    }
  }
  if (pos.length === 0) {
    const candidates = PRIMITIVES.filter((p) => !seen.has(p.id));
    pos.push({ p: candidates[seed % candidates.length].id, l: 1 });
  }
  const total = () => itemPoints([...pos, ...(neg ? [neg] : [])]);
  const costAt = (e: Effect, l: number) => PRIM[e.p].cost[l - 1];

  // Too rich: lower the highest level (last one on ties), then drop effects.
  for (let guard = 0; guard < 64 && total() > budget; guard++) {
    let pick = -1;
    for (let i = 0; i < pos.length; i++) if (pos[i].l > 1 && (pick < 0 || pos[i].l >= pos[pick].l)) pick = i;
    if (pick >= 0) pos[pick].l--;
    else if (pos.length > 1) pos.pop();
    else break;
  }
  // Too poor: raise the lowest level that still fits (first one on ties).
  for (let guard = 0; guard < 64; guard++) {
    const room = budget - total();
    let pick = -1;
    for (let i = 0; i < pos.length; i++) {
      const e = pos[i];
      if (e.l >= 5) continue;
      if (costAt(e, e.l + 1) - costAt(e, e.l) > room) continue;
      if (pick < 0 || e.l < pos[pick].l) pick = i;
    }
    if (pick < 0) break;
    pos[pick].l++;
  }
  return canonicalEffects([...pos, ...(neg ? [neg] : [])]);
}

const NAME_RE = /^[A-Za-z][A-Za-z' ]{1,20}[A-Za-z]$/;
const BLOCK = [
  'fuck', 'shit', 'cunt', 'nigg', 'fag', 'rape', 'nazi', 'hitler', 'porn', 'sex', 'cock', 'dick', 'pussy', 'whore', 'slut',
  // Words that read as generator output. See docs/DESIGN.md section 7.3.
  'eldor', 'shadow', 'whisper', 'ancient', 'mystic', 'arcane', 'eternal', 'celestial', 'ethereal', 'doom', 'void', 'soul',
];

/** Sentence-case a candidate name, or return null if it is not allowed. */
export function cleanName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const t = name.replace(/\s+/g, ' ').trim();
  if (!NAME_RE.test(t)) return null;
  const low = t.toLowerCase();
  if (BLOCK.some((b) => low.includes(b))) return null;
  if (low.split(' ').length > 3) return null;
  return low[0].toUpperCase() + low.slice(1);
}

export function cleanGlyph(g: unknown, seed: number): GlyphId {
  return (GLYPHS as readonly string[]).includes(g as string) ? (g as GlyphId) : GLYPHS[seed % GLYPHS.length];
}

export function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t): t is string => typeof t === 'string' && /^[a-z]{2,12}$/.test(t))
    .slice(0, 4);
}

/** Scrip price of an item at wave 0. */
export function basePrice(item: ItemSpec): number {
  return item.price ?? Math.round(itemPoints(item.effects) * 2.2 + 6);
}
