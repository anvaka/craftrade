// Icons. Cut with the same knife as the world: same outline weight, same
// off-register fills, straight segments only.
//
// Each icon is drawn on a 28 unit grid (-14..14) with the origin at the
// centre. bakeAll scales the grid to fill a 32 css px box (small) and a
// 64 css px box (large) with the line weight unchanged, so the large one is
// the same cut with more room in it.
//
// Colour jobs: weapons, item glyphs, raws and scrip are Ochre (things you
// gather, make or spend in a run). Stats, lock and reroll are plain Ink.
// Marks, the mule and the four stations are Woad (town).

import { GLYPHS, RAWS, STATS, type GlyphId, type RawId, type StatId } from '../../shared/vocab.ts';
import { INK, OCHRE, WOAD, type Drawing, type Print } from './print.ts';

export const WEAPON_IDS = ['hatchet', 'pick', 'knife', 'maul', 'pike', 'sling', 'bow', 'musket', 'axe', 'brand', 'bola', 'buckler'] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];

export const STATION_IDS = ['sawmill', 'smelter', 'tannery', 'assay'] as const;
export type StationId = (typeof STATION_IDS)[number];

export const MISC_ICON_IDS = ['scrip', 'marks', 'mule', 'lock', 'reroll'] as const;
export type MiscIconId = (typeof MISC_ICON_IDS)[number];

export { GLYPHS, RAWS, STATS };
export type { GlyphId, RawId, StatId };

const oct = (r: number, cx = 0, cy = 0): number[] => {
  const a = r * 0.42;
  return [cx - a, cy - r, cx + a, cy - r, cx + r, cy - a, cx + r, cy + a, cx + a, cy + r, cx - a, cy + r, cx - r, cy + a, cx - r, cy - a];
};

const closed = (pts: number[]): number[] => [...pts, pts[0]!, pts[1]!];

// -------------------------------------------------------------------- weapons

export const WEAPON_ICON: Record<WeaponId, Drawing> = {
  hatchet: (p) =>
    p.at(-1, 1, 25, () => {
      p.line([0, 13, 0, -9]);
      p.shape([-3, -12, 2, -12, 10, -14, 12, -1, 2, -4, -3, -4], OCHRE);
      p.line([9, -13, 10, -3], true);
    }),
  pick: (p) => {
    p.line([-8, 12, 3, -6]);
    p.shape([-9, -6, -3, -11, 6, -11, 12, -4, 12, 0, 6, -6, -1, -6, -7, -2], OCHRE);
  },
  knife: (p) => {
    p.flat([-11, 10, -5, 2, 0, 6, -7, 13], INK);
    p.shape([-5, 2, 0, -6, 9, -12, 11, -5, 6, 3, 0, 6], OCHRE);
    p.line([-1, -3, 8, -9], true);
  },
  maul: (p) =>
    p.at(-1, 1, 32, () => {
      p.line([0, 13, 0, -3]);
      p.shape([-10, -13, 10, -13, 10, -3, -10, -3], OCHRE);
      p.line([-5, -13, -5, -3], true);
      p.line([5, -13, 5, -3], true);
    }),
  pike: (p) => {
    p.line([-12, 12, 5, -5]);
    p.shape([2, -6, 12, -13, 7, -1], OCHRE);
    p.line([-1, -5, 6, 2]);
  },
  sling: (p) => {
    p.line([-9, -9, 0, 6], true);
    p.line([-9, -9, 8, -1], true);
    p.shape([-12, -9, -9, -13, -6, -9, -9, -6], null);
    p.shape([-2, 5, 8, -3, 12, 3, 4, 11], OCHRE);
    p.dot(5.5, 4, 2.6);
  },
  bow: (p) => {
    p.shape([-5, -13, 4, -8, 8, 0, 4, 8, -5, 13, 0, 7, 3, 0, 0, -7], OCHRE);
    p.line([-5, -13, -5, 13], true);
    p.line([-10, 0, 3, 0], true);
  },
  musket: (p) => {
    p.line([-3, 2, 12, -11]);
    p.shape([-12, 6, -4, -1, 1, 3, -5, 6, -8, 12], OCHRE);
    p.dot(0, 0, 2);
    p.line([4, -2, 7, 1], true);
  },
  axe: (p) => {
    p.at(1, 2, 35, () => {
      p.line([0, 10, 0, -8]);
      p.shape([-3, -11, 2, -11, 9, -14, 11, -1, 2, -4, -3, -4], OCHRE);
      p.flat([-3, -10, -9, -7.5, -3, -5], INK);
    });
    p.line([-12, -6, -7, -10], true);
    p.line([-13, 1, -9, -3], true);
  },
  brand: (p) => {
    p.line([-9, 12, 1, 0]);
    p.shape([-3, 0, -4, -8, 0, -5, 3, -13, 7, -6, 10, -8, 9, 0, 4, 4], OCHRE);
    p.hatch([0, -5, 3, -13, 7, -6, 9, 0, 4, 4], 100, 3);
  },
  bola: (p) => {
    p.line([-7, 6, 0, 0, 7, 5], true);
    p.line([0, 0, 0, -8], true);
    p.shape(oct(4.2, -8, 8), OCHRE);
    p.shape(oct(4.2, 8, 7), OCHRE);
    p.shape(oct(4.2, 0, -9), OCHRE);
  },
  buckler: (p) => {
    p.shape(oct(11), OCHRE);
    p.hatch([4.6, -11, 11, -4.6, 11, 4.6, 4.6, 11, 2, 8, 8, 0, 2, -8], 62, 3);
    p.flat(oct(3.6), INK);
  },
};

// --------------------------------------------------------------------- glyphs

function cogPts(): number[] {
  const out: number[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = (Math.PI / n) * 0.42;
    for (const [da, r] of [[-w, 11.5], [w, 11.5], [Math.PI / n - w * 0.3, 8], [Math.PI / n + w * 0.9, 8]] as const) {
      out.push(Math.cos(a + da) * r, Math.sin(a + da) * r);
    }
  }
  return out;
}

export const GLYPH_ICON: Record<GlyphId, Drawing> = {
  blade: (p) => {
    p.shape([0, -13, 4, -5, 3, 4, -3, 4, -4, -5], OCHRE);
    p.line([0, -11, 0, 3], true);
    p.flat([-7, 4, 7, 4, 7, 7, -7, 7], INK);
    p.line([0, 7, 0, 13]);
  },
  hammer: (p) => {
    p.line([0, 13, 0, -3]);
    p.shape([-10, -11, 7, -11, 11, -7, 10, -3, -10, -3], OCHRE);
    p.line([5, -11, 5, -3], true);
  },
  ring: (p) => {
    p.shape(oct(10, 0, 2), OCHRE);
    p.cut(oct(5, 0, 2));
    p.line(closed(oct(5, 0, 2)), true);
    p.flat([-3, -8, 0, -13, 3, -8, 0, -6], INK);
  },
  flask: (p) => {
    p.shape([-3, -10, 3, -10, 3, -4, 9, 5, 6, 12, -6, 12, -9, 5, -3, -4], OCHRE);
    p.hatch([-8, 4, 8, 4, 6, 12, -6, 12], 0, 2.6);
    p.flat([-5, -13, 5, -13, 4, -9, -4, -9], INK);
  },
  bone: (p) => {
    p.shape([-12, -8, -8, -12, -5, -9, -4, -6, 6, 4, 9, 5, 12, 8, 8, 12, 5, 9, 4, 6, -6, -4, -9, -5], OCHRE);
    p.line([-4, -2, 2, 4], true);
  },
  feather: (p) => {
    p.shape([-8, 9, -6, 1, 0, -8, 9, -13, 9, -4, 3, 4, -4, 8], OCHRE);
    p.hatch([-6, 1, 0, -8, 9, -13, 9, -4, 3, 4], 20, 3.2);
    p.line([-11, 13, 8, -11]);
  },
  cog: (p) => {
    p.shape(cogPts(), OCHRE);
    p.cut(oct(3.4));
    p.line(closed(oct(3.4)), true);
  },
  rope: (p) => {
    // a hank: three turns and a loose end
    for (const y of [-9, -2, 5]) {
      const band = [-10, y + 1, 9, y - 2, 10, y + 4, -9, y + 7];
      p.shape(band, OCHRE);
      p.hatch(band, 62, 3.6);
    }
    p.line([9, 8, 13, 12, 10, 14]);
  },
  lantern: (p) => {
    p.line([-3, -9, 0, -13, 3, -9], true);
    p.shape([-6, -5, 6, -5, 7, 8, -7, 8], OCHRE);
    p.flat([-8, -5, -4, -10, 4, -10, 8, -5], INK);
    p.cut([-3, -2, 3, -2, 3, 5, -3, 5]);
    p.line(closed([-3, -2, 3, -2, 3, 5, -3, 5]), true);
    p.dot(0, 2, 1.6);
    p.flat([-9, 8, 9, 8, 9, 12, -9, 12], INK);
  },
  boot: (p) => {
    p.shape([-7, -12, 2, -12, 2, 0, 10, 3, 11, 9, -7, 9], OCHRE);
    p.flat([-9, 9, 13, 9, 13, 13, -9, 13], INK);
    p.line([-7, -7, 2, -7], true);
    p.hatch([-7, -12, -2, -12, -2, 9, -7, 9], 62, 3);
  },
  horn: (p) => {
    p.shape([-12, -9, -5, -12, -4, -3, -1, 3, 5, 3, 9, -3, 12, -11, 13, -2, 9, 7, 2, 11, -6, 9, -11, 1], OCHRE);
    p.flat([-14, -9, -4, -14, -3, -10, -13, -5], INK);
    p.line([-9, 3, -3, 0], true);
    p.hatch([5, 3, 9, -3, 12, -11, 13, -2, 9, 7, 4, 10], 62, 3);
  },
  sack: (p) => {
    p.shape([-8, 12, -11, 1, -5, -6, -2, -7, -5, -13, 5, -13, 2, -7, 6, -5, 11, 2, 8, 12], OCHRE);
    p.line([-4, -7, 4, -7]);
    p.hatch([2, -7, 6, -5, 11, 2, 8, 12, 3, 12], 62, 3);
  },
  stone: (p) => {
    p.shape([-11, 4, -8, -5, 0, -11, 8, -8, 12, 2, 6, 10, -5, 11], OCHRE);
    p.hatch([8, -8, 12, 2, 6, 10, 1, 10, 3, 0], 70, 3);
    p.line([-8, -5, -1, -1, 0, -11], true);
    p.line([-1, -1, -3, 11], true);
  },
  coin: (p) => {
    p.shape(oct(11), OCHRE);
    p.line(closed(oct(7)), true);
    p.line([-3, -3, 3, 3]);
    p.line([-3, 3, 3, -3]);
  },
  leaf: (p) => {
    p.shape([-9, 9, -8, -2, -1, -10, 10, -12, 10, 0, 1, 8], OCHRE);
    p.line([-12, 12, 8, -10]);
    p.line([-3, 3, -4, -4], true);
    p.line([1, -1, 1, -8], true);
    p.line([-2, 2, 5, 3], true);
    p.line([2, -2, 9, -2], true);
  },
  tooth: (p) => {
    p.shape([-8, -12, -2, -10, 3, -12, 8, -11, 10, -3, 7, 2, 8, 13, 2, 5, 0, 2, -2, 5, -7, 13, -7, 2, -10, -3], OCHRE);
    p.hatch([3, -12, 8, -11, 10, -3, 7, 2, 8, 13, 3, 6], 62, 3);
  },
  bell: (p) => {
    p.shape([-2, -13, 2, -13, 3, -8, 8, -2, 9, 6, -9, 6, -8, -2, -3, -8], OCHRE);
    p.flat([-12, 5, 12, 5, 12, 9, -12, 9], INK);
    p.dot(0, 11.5, 2.2);
    p.hatch([3, -8, 8, -2, 9, 6, 4, 6], 62, 3);
  },
  nail: (p) =>
    p.at(0, 0, 24, () => {
      p.shape([-3, -8, 3, -8, 1.5, 9, 0, 14, -1.5, 9], OCHRE);
      p.flat([-8, -13, 8, -13, 6, -8, -6, -8], INK);
    }),
  pelt: (p) => {
    p.shape([-11, -9, -5, -6, -3, -12, 3, -12, 5, -6, 11, -9, 8, 0, 12, 8, 5, 6, 2, 13, -2, 13, -5, 6, -12, 8, -8, 0], OCHRE);
    p.line([-4, -3, 4, -3], true);
    p.line([-5, 1, 5, 1], true);
    p.line([-4, 5, 4, 5], true);
    p.dot(-1.5, -9, 1);
    p.dot(1.5, -9, 1);
  },
  bowl: (p) => {
    p.shape([-11, -1, 11, -1, 8, 7, 4, 11, -4, 11, -8, 7], OCHRE);
    p.flat([-13, -4, 13, -4, 13, 0, -13, 0], INK);
    p.line([-4, -7, -2, -10, -4, -13], true);
    p.line([3, -7, 5, -10, 3, -13], true);
  },
  candle: (p) => {
    p.shape([-4, -3, 4, -3, 4, 9, -4, 9], OCHRE);
    p.shape([0, -14, 3.5, -8, 0, -4, -3.5, -8], OCHRE);
    p.line([-4, 1, -1, 3, -1, 6], true);
    p.flat([-9, 9, 9, 9, 7, 13, -7, 13], INK);
  },
  hook: (p) => {
    p.shape([1, -9, 5, -9, 5, 4, 1, 11, -6, 11, -11, 5, -10, -2, -6, 1, -6, 4, -4, 6, 0, 6, 1, 3], OCHRE);
    p.flat([-1, -13, 7, -13, 7, -9, -1, -9], INK);
    p.flat([-10, -2, -13, -6, -6, -3], INK);
  },
  wedge: (p) => {
    p.shape([-8, -9, 8, -9, 2, 13, -2, 13], OCHRE);
    p.flat([-10, -13, 10, -13, 10, -9, -10, -9], INK);
    p.hatch([1, -9, 8, -9, 2, 13, 0, 13], 62, 3);
  },
  charm: (p) => {
    p.line([-7, -13, 0, -7, 7, -13], true);
    p.shape([0, -8, 8, 2, 0, 13, -8, 2], OCHRE);
    p.cut([0, -2, 3, 2, 0, 6, -3, 2]);
    p.line(closed([0, -2, 3, 2, 0, 6, -3, 2]), true);
  },
};

// ---------------------------------------------------------------------- stats

const star = (n: number, r0: number, r1: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2 + 0.2;
    const r = i % 2 ? r0 : r1 - (i % 4 === 0 ? 0 : 2.5);
    out.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return out;
};

export const STAT_ICON: Record<StatId, Drawing> = {
  maxHp: (p) => {
    p.flat([0, 12, -11, -1, -11, -7, -7, -11, -2, -10, 0, -6, 2, -10, 7, -11, 11, -7, 11, -1], INK);
    p.cut([-8, -6, -6, -8, -4, -7, -6, -3]);
  },
  mend: (p) => {
    // a stitched tear
    p.line([-11, 9, -4, 2, -1, -3, 5, -6, 11, -11]);
    p.line([-9, 2, -3, 8]);
    p.line([-5, -3, 2, 3]);
    p.line([0, -9, 7, -1]);
    p.line([7, -12, 12, -6]);
  },
  armor: (p) => {
    p.flat([-10, -11, 0, -8, 10, -11, 11, 2, 0, 13, -11, 2], INK);
    p.cut([-6, -5, 0, -3, 6, -5, 6, -2, 0, 0, -6, -2]);
    p.cut([-5, 2, 0, 4, 5, 2, 3, 5, 0, 8, -3, 5]);
  },
  dodge: (p) => {
    // a body leaning out of the way of a stroke
    p.line([-12, 12, 11, -12], true);
    p.flat([-3, -13, 2, -11, 1, -6, -4, -7], INK);
    p.flat([-5, -5, 1, -4, -3, 5, -1, 13, -5, 13, -9, 4], INK);
  },
  speed: (p) => {
    p.flat([-2, -10, 12, 0, -2, 10, 2, 0], INK);
    p.line([-12, -6, -4, -6]);
    p.line([-12, 0, -2, 0]);
    p.line([-12, 6, -4, 6]);
  },
  damage: (p) => {
    p.flat(star(7, 5, 13), INK);
    p.cut(oct(2.6));
  },
  melee: (p) => {
    p.flat([-9, -5, -5, -11, 7, -11, 11, -6, 11, 3, 6, 7, 6, 13, -5, 13, -5, 7, -9, 3], INK);
    p.cut([-5, -7, -3.5, -7, -3.5, -1, -5, -1]);
    p.cut([-1, -8, 0.5, -8, 0.5, -1, -1, -1]);
    p.cut([3, -8, 4.5, -8, 4.5, -1, 3, -1]);
    p.cut([-6, 2, 8, 2, 8, 3.5, -6, 3.5]);
  },
  ranged: (p) => {
    p.line([-11, 11, 5, -5]);
    p.flat([1, -10, 13, -13, 10, -1], INK);
    p.line([-11, 5, -7, 7], true);
    p.line([-7, 11, -5, 7], true);
    p.line([-12, 8, -8, 12], true);
  },
  rate: (p) => {
    p.flat([-12, -9, -7, -9, 0, 0, -7, 9, -12, 9, -5, 0], INK);
    p.flat([-1, -9, 4, -9, 12, 0, 4, 9, -1, 9, 6, 0], INK);
  },
  crit: (p) => {
    p.shape([0, -9, 9, 0, 0, 9, -9, 0], null);
    p.dot(0, 0, 2.6);
    p.line([0, -13, 0, -9]);
    p.line([0, 9, 0, 13]);
    p.line([-13, 0, -9, 0]);
    p.line([9, 0, 13, 0]);
  },
  reach: (p) => {
    p.line([-8, 0, 8, 0]);
    p.flat([-13, 0, -6, -5, -6, 5], INK);
    p.flat([13, 0, 6, -5, 6, 5], INK);
    p.line([-13, -9, -13, 9], true);
    p.line([13, -9, 13, 9], true);
  },
  harvest: (p) => {
    p.line([-10, 13, -4, 6]);
    p.flat([-5, 6, -10, -3, -5, -11, 5, -13, 12, -7, 5, -8, -1, -6, -4, -2, -1, 4], INK);
  },
  luck: (p) => {
    p.flat([-11, -11, -5, -11, -5, 2, -2, 6, 2, 6, 5, 2, 5, -11, 11, -11, 11, 5, 5, 12, -5, 12, -11, 5], INK);
    p.cut([-9, -7, -7, -7, -7, -4, -9, -4]);
    p.cut([7, -7, 9, -7, 9, -4, 7, -4]);
    p.cut([-9, 1, -7, 1, -7, 4, -9, 4]);
    p.cut([7, 1, 9, 1, 9, 4, 7, 4]);
  },
};

// ----------------------------------------------------------------------- raws

export const RAW_ICON: Record<RawId, Drawing> = {
  timber: (p) => {
    p.at(1, -5, -6, () => p.shape([-10, -5, 7, -5, 11, 0, 7, 5, -10, 5], OCHRE));
    p.at(-1, 5, 5, () => {
      p.shape([-11, -5, 7, -5, 11, 0, 7, 5, -11, 5], OCHRE);
      p.line([7, -5, 3, 0, 7, 5], true);
      p.hatch([-11, -5, 0, -5, 0, 5, -11, 5], 6, 3.2);
    });
  },
  ore: (p) => {
    p.shape([-11, 5, -9, -5, -2, -11, 7, -9, 12, -1, 8, 9, -4, 11], OCHRE);
    p.hatch([7, -9, 12, -1, 8, 9, 2, 10, 3, -1], 70, 3);
    p.line([-9, -5, -1, -1, 3, -10], true);
    p.line([-1, -1, -4, 11], true);
  },
  hide: (p) => {
    p.shape([-11, -11, -5, -7, 5, -7, 11, -11, 8, -1, 12, 9, 5, 6, 0, 12, -5, 6, -12, 9, -8, -1], OCHRE);
    p.hatch([-6, -4, 6, -4, 5, 4, -5, 4], 80, 3.4);
  },
};

// ----------------------------------------------------------------------- misc

export const MISC_ICON: Record<MiscIconId, Drawing> = {
  scrip: (p) => {
    p.shape(oct(11), OCHRE);
    const hole = [-3.4, -3, 3, -3.8, 3.8, 3, -3, 3.8];
    p.cut(hole);
    p.line(closed(hole), true);
    p.line([-8, -6, -6, -8], true);
  },
  marks: (p) => {
    // a town ticket, notched at both ends, tallied
    p.shape([-12, -8, 12, -8, 12, -3, 9, 0, 12, 3, 12, 8, -12, 8, -12, 3, -9, 0, -12, -3], WOAD);
    p.line([-5, -4, -5, 4]);
    p.line([0, -4, 0, 4]);
    p.line([5, -4, 5, 4]);
    p.line([-8, 3, 8, -3], true);
  },
  mule: (p) => {
    p.flat([-10, 3, -7, 3, -8, 13, -10.5, 13], INK);
    p.flat([-5, 3, -2.5, 3, -3, 13, -5.5, 13], INK);
    p.flat([3, 3, 5.5, 3, 5.5, 13, 3, 13], INK);
    p.flat([7, 3, 9.5, 2, 9.5, 13, 7, 13], INK);
    p.line([-11, -3, -13, 5], true);
    p.shape([-11, -4, 5, -4, 9, 0, 9, 4, -11, 4], WOAD);
    p.shape([3, -3, 7, -10, 13, -5, 12, -1, 9, -2, 8, 2], WOAD);
    p.flat([6, -9, 4, -15, 8, -11], INK);
    p.flat([8, -10, 9, -15, 11, -9], INK);
    p.shape([-9, -10, 1, -10, 2, -4, -10, -4], OCHRE);
    p.line([-4, -10, -4, 4], true);
  },
  lock: (p) => {
    p.line([-5, -2, -5, -8, -2, -12, 2, -12, 5, -8, 5, -2]);
    p.flat([-9, -3, 9, -3, 9, 9, 6, 12, -6, 12, -9, 9], INK);
    p.cut([-1.5, 1, 1.5, 1, 1.5, 4, 1, 8, -1, 8, -1.5, 4]);
  },
  reroll: (p) => {
    // out with these, in with those
    p.line([-11, -1, -11, -7, 5, -7]);
    p.flat([4, -13, 13, -7, 4, -1], INK);
    p.line([11, 1, 11, 7, -5, 7]);
    p.flat([-4, 1, -13, 7, -4, 13], INK);
  },
};

// ------------------------------------------------------------------- stations

// One family: the same gabled shed in Woad, told apart by what stands on or
// beside it and by the Ink sign cut into its front.
function shed(p: Print): void {
  p.shape([-11, 12, -11, -2, 0, -10, 11, -2, 11, 12], WOAD);
  p.line([-13, -1, 0, -11, 13, -1]);
}

export const STATION_ICON: Record<StationId, Drawing> = {
  sawmill: (p) => {
    shed(p);
    // a saw blade
    p.flat([-8, 2, -5, 6, -2, 2, 1, 6, 4, 2, 7, 6, 9, 2, 9, 9, -8, 9], INK);
    p.cut([-6, 7, 7, 7, 7, 8, -6, 8]);
  },
  smelter: (p) => {
    p.flat([4, -13, 9, -13, 9, -3, 4, -6], INK);
    p.line([6, -14, 8, -16], true);
    shed(p);
    // furnace mouth
    p.flat([-6, 12, -6, 3, -2, -1, 2, -1, 6, 3, 6, 12], INK);
    p.cut([-2, 10, 0, 4, 2, 10]);
  },
  tannery: (p) => {
    shed(p);
    // a hide on the wall
    p.flat([-7, 0, -3, 2, 3, 2, 7, 0, 5, 5, 7, 10, 0, 8, -7, 10, -5, 5], INK);
  },
  assay: (p) => {
    p.line([0, -10, 0, -15]);
    p.flat([0, -15, 6, -13, 0, -11], INK);
    shed(p);
    // scales
    p.line([-7, 1, 7, 1]);
    p.line([0, -2, 0, 9], true);
    p.flat([-10, 6, -4, 6, -5, 8, -9, 8], INK);
    p.flat([4, 5, 10, 5, 9, 7, 5, 7], INK);
    p.line([-7, 1, -7, 6], true);
    p.line([7, 1, 7, 5], true);
  },
};

/** Grid size of an icon drawing, css px at k = 1. */
export const ICON_UNIT = 28;
