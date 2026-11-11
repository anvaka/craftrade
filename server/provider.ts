import {
  cleanGlyph, cleanName, cleanTags, fnv1a, repairEffects,
  type Effect, type FusionPick, type ItemSpec,
} from '../src/shared/item.ts';
import { GLYPHS, PRIM, PRIMITIVES, type GlyphId } from '../src/shared/vocab.ts';

/** Decides what an untried pair becomes. The answer is untrusted until validatePick has seen it. */
export interface FusionProvider {
  /** True when a real model is behind this provider. */
  readonly llm: boolean;
  readonly model: string;
  propose(a: ItemSpec, b: ItemSpec, budget: number, key: string, signal: AbortSignal): Promise<unknown>;
}

/** A provider answer after validation and repair. Effects are levels, never numbers. */
export interface Proposal {
  effects: Effect[];
  names: string[];
  glyph: GlyphId;
  tags: string[];
  model: string;
  raw: string;
}

/**
 * Check and repair a provider answer. Returns null when it holds no usable
 * effect at all, which the caller treats as a failed call.
 */
export function validatePick(pick: unknown, budget: number, key: string): Omit<Proposal, 'model' | 'raw'> | null {
  if (!pick || typeof pick !== 'object') return null;
  const o = pick as Record<string, unknown>;
  const picks = (Array.isArray(o.effects) ? o.effects : []).filter(
    (e) => e && typeof e === 'object' && typeof e.p === 'string' && Object.hasOwn(PRIM, e.p),
  ) as FusionPick['effects'];
  if (!picks.some((e) => !e.neg)) return null;
  const seed = fnv1a(key);
  const names: string[] = [];
  for (const n of Array.isArray(o.names) ? o.names.slice(0, 6) : []) {
    const clean = cleanName(n);
    if (clean && !names.includes(clean)) names.push(clean);
  }
  const tags = Array.isArray(o.tags) ? o.tags.map((t) => (typeof t === 'string' ? t.toLowerCase().trim() : t)) : [];
  return {
    effects: repairEffects(picks, budget, seed),
    names: names.slice(0, 3),
    glyph: cleanGlyph(o.glyph, seed),
    tags: [...new Set(cleanTags(tags))],
  };
}

// The procedural stand-in. Same pair, same answer, no network.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MODS = [
  'tarred', 'waxed', 'oiled', 'riveted', 'stitched', 'banded', 'smoked', 'salted', 'split', 'hooped',
  'weighted', 'notched', 'lined', 'patched', 'braced', 'pegged', 'tempered', 'plaited', 'cured', 'planed',
  'forged', 'felted', 'knotted', 'scoured', 'dowelled', 'wedged', 'bound', 'quilted', 'ground', 'seasoned',
];

/** Plain things each glyph could be a drawing of. */
const NOUNS: Record<GlyphId, string[]> = {
  blade: ['knife', 'drawknife', 'shears', 'billhook'],
  hammer: ['mallet', 'hammer', 'beetle', 'tamper'],
  ring: ['ring', 'hoop', 'collar', 'ferrule'],
  flask: ['flask', 'bottle', 'jar', 'vial'],
  bone: ['splint', 'needle', 'toggle', 'awl'],
  feather: ['quill', 'fletching', 'plume', 'duster'],
  cog: ['gear', 'ratchet', 'winch', 'pulley'],
  rope: ['rope', 'cord', 'tether', 'sling'],
  lantern: ['lantern', 'lamp', 'torch', 'brazier'],
  boot: ['boots', 'clogs', 'gaiters', 'spats'],
  horn: ['horn', 'powder horn', 'whistle', 'spout'],
  sack: ['sack', 'satchel', 'pouch', 'bundle'],
  stone: ['stone', 'hone', 'cobble', 'ballast'],
  coin: ['token', 'tally', 'chit', 'counter'],
  leaf: ['poultice', 'wreath', 'sprig', 'wad'],
  tooth: ['tine', 'barb', 'rasp', 'spur'],
  bell: ['bell', 'gong', 'clapper', 'rattle'],
  nail: ['nails', 'spike', 'rivet', 'tack'],
  pelt: ['coat', 'apron', 'wrap', 'jerkin'],
  bowl: ['bowl', 'ration', 'stew', 'porridge'],
  candle: ['candle', 'taper', 'wick', 'rushlight'],
  hook: ['hook', 'gaff', 'grapple', 'clasp'],
  wedge: ['wedge', 'shim', 'chock', 'froe'],
  charm: ['charm', 'keepsake', 'trinket', 'fob'],
};

const word = (s: string) => /^[a-z]{3,10}$/.test(s);

/**
 * Deterministic names for a seed, in order of preference without end in
 * practice. Used by the procedural provider and as the last resort when
 * every candidate from the model is taken or invalid.
 */
export function fallbackName(seed: number, glyph: GlyphId, i: number): string {
  const nouns = NOUNS[glyph];
  if (i < MODS.length * nouns.length) {
    return `${MODS[(seed + i) % MODS.length]} ${nouns[(seed + Math.floor(i / MODS.length)) % nouns.length]}`;
  }
  // Far past anything expected: letters only, still legal, still deterministic.
  let n = (seed + i) >>> 0;
  let tail = '';
  for (let k = 0; k < 7; k++) { tail += String.fromCharCode(97 + (n % 26)); n = Math.floor(n / 26); }
  return `lot ${tail}`;
}

export class ProceduralProvider implements FusionProvider {
  readonly llm = false;
  readonly model = 'procedural-1';

  async propose(a: ItemSpec, b: ItemSpec, budget: number, key: string): Promise<FusionPick> {
    const seed = fnv1a(key);
    const rnd = mulberry32(seed);
    const tags = [...new Set([...a.tags, ...b.tags])].filter(word);
    const words = new Set([...tags, ...`${a.name} ${b.name}`.toLowerCase().split(/[^a-z]+/)]);
    const held = new Map<string, number>();
    for (const e of [...a.effects, ...b.effects]) if (!e.neg) held.set(e.p, Math.max(held.get(e.p) ?? 0, e.l));

    // Score every primitive by how well it fits the pair.
    const scored = PRIMITIVES.map((p) => {
      let s = rnd() * 1.5;
      if (held.has(p.id)) s += 4;
      for (const h of p.hint.split(/[^a-z]+/)) if (words.has(h) || words.has(h.replace(/s$/, ''))) s += 3;
      if (words.has(p.id.toLowerCase())) s += 2;
      return { p, s };
    }).sort((x, y) => y.s - x.s || (x.p.id < y.p.id ? -1 : 1));

    const count = budget < 14 ? 1 : budget < 34 ? 2 : 3;
    const share = budget / count;
    const effects: FusionPick['effects'] = scored.slice(0, count).map(({ p }) => {
      let l = 1;
      while (l < 5 && p.cost[l] <= share) l++;
      return { p: p.id, l };
    });

    // A drawback, more often when a parent already has one.
    const parentNeg = [...a.effects, ...b.effects].filter((e) => e.neg && !effects.some((x) => x.p === e.p));
    if (parentNeg.length && rnd() < 0.6) {
      const e = parentNeg[Math.floor(rnd() * parentNeg.length)];
      effects.push({ p: e.p, l: e.l, neg: true });
    } else if (rnd() < 0.2) {
      const stats = PRIMITIVES.filter((p) => p.kind === 'stat' && !effects.some((x) => x.p === p.id));
      effects.push({ p: stats[Math.floor(rnd() * stats.length)].id, l: 1 + Math.floor(rnd() * 2), neg: true });
    }

    const glyph = rnd() < 0.75 ? (rnd() < 0.5 ? a.glyph : b.glyph) : GLYPHS[Math.floor(rnd() * GLYPHS.length)];
    const nouns = NOUNS[glyph];
    const pickTag = () => (tags.length ? tags[Math.floor(rnd() * tags.length)] : MODS[Math.floor(rnd() * MODS.length)]);
    // A name never repeats a word ("charm charm").
    const pair = (first: string): string => {
      const rest = nouns.filter((n) => n !== first);
      return `${first} ${(rest.length ? rest : nouns)[Math.floor(rnd() * (rest.length || nouns.length))]}`;
    };
    const names = [pair(pickTag()), pair(pickTag()), pair(MODS[Math.floor(rnd() * MODS.length)])];
    const outTags: string[] = [];
    for (const pool = [...tags]; pool.length && outTags.length < 3; ) outTags.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return { names, glyph, tags: outTags, effects };
  }
}
