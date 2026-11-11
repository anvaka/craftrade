// Creatures: the six player characters and the ten enemies.
//
// Every drawing faces right with the origin at the feet. Player figures are
// Ochre, enemies Madder, both cut with Ink. Rotwood is Spruce with Madder
// rot. Each function takes a pose and a walk frame (0 or 1).
// Silhouette comes first: every creature is built around one feature that
// survives being filled solid (bindle, antlers, funnel mouth, long tail).

import { INK, MADDER, OCHRE, SPRUCE, type Drawing, type Print } from './print.ts';

export const CHARACTER_IDS = ['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export const ENEMY_IDS = ['mite', 'gnat', 'boar', 'spitter', 'magpie', 'burrower', 'brute', 'stag', 'rotwood', 'tusk'] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

const lozenge = (p: Print, rx: number, ry = rx * 0.3, cx = 0): void =>
  p.shadow([cx - rx, 0, cx - rx * 0.55, -ry, cx + rx * 0.6, -ry, cx + rx, 0, cx + rx * 0.5, ry, cx - rx * 0.6, ry]);

// --------------------------------------------------------------------- player

const BOOT = [-4, -10, 3, -10, 3, -5, 8, -4, 9, 0, -4, 0];

export function player(id: CharacterId, f: 0 | 1): Drawing {
  return (p) => {
    const b = f ? -2 : 0;
    lozenge(p, 15, 4);
    // boots: stride, then feet together with the back one lifted
    p.at(f ? -3 : -8, f ? -2 : 0, f ? -12 : 0, () => p.flat(BOOT, INK));
    p.at(f ? 1 : 4, 0, 0, () => p.flat(BOOT, INK));

    p.at(0, b, 0, () => {
      // things worn on the back go under the coat
      if (id === 'greenhorn') {
        p.line([12, -15, -15, -37]);
        p.shape([-24, -37, -19, -45, -11, -43, -9, -35, -15, -29, -22, -31], OCHRE);
        p.hatch([-24, -37, -19, -45, -15, -44, -17, -30, -22, -31], 70, 3.5);
      }
      if (id === 'tinker') {
        p.shape([-21, -35, -10, -37, -9, -9, -19, -8], OCHRE);
        p.hatch([-21, -35, -15, -36, -14, -9, -19, -8], 0, 4);
        p.line([-17, -36, -19, -47]);
        p.flat([-23, -52, -15, -51, -16, -46, -22, -46], INK);
        p.line([-20, -9, -24, -6]);
        p.flat([-28, -6, -20, -6, -21, 1, -27, 1], INK);
      }
      if (id === 'trapper') {
        // bow slung on the back
        p.line([-9, -2, -17, -12, -18, -26, -12, -38]);
        p.line([-9, -2, -12, -38], true);
      }
      if (id === 'clerk') p.shape([-17, -1, -12, -20, -5, -20, -4, -7], OCHRE);

      // coat
      const coat =
        id === 'smith'
          ? [-12, -8, -15, -23, -10, -31, 5, -32, 12, -26, 13, -8]
          : id === 'trapper'
            ? [-11, -9, -8, -5, -5, -9, -2, -5, 1, -9, 4, -5, 7, -9, 11, -8, 10, -24, 4, -30, -8, -29, -12, -22]
            : [-10, -8, -12, -22, -8, -29, 4, -30, 10, -24, 11, -8];
      p.shape(coat, OCHRE);
      if (id === 'sawyer') {
        p.hatch([-10, -8, -12, -22, -8, -29, 4, -30, 10, -24, 11, -8], 45, 5);
        p.hatch([-10, -8, -12, -22, -8, -29, 4, -30, 10, -24, 11, -8], -45, 5);
      } else {
        p.hatch([-10, -8, -12, -22, -8, -29, -3, -29, -4, -8], 62, 3.5);
      }
      if (id === 'smith') {
        p.flat([-3, -29, 8, -28, 14, -1, -4, -2], INK);
        p.cut([2, -16, 9, -15, 9, -11, 3, -11]);
      } else {
        p.line([-11, -15, 11, -14]);
      }
      if (id === 'clerk') {
        p.dot(4, -25, 1.4);
        p.dot(5, -20, 1.4);
      }

      // head
      const bald = id === 'smith';
      p.shape([-6, -29, -8, -37, -4, -42, 4, -42, 8, -38, 11, -34, 7, -32, 6, -29], OCHRE);
      p.dot(4.5, -37, 1.5);
      if (bald) {
        p.flat([-1, -35, 3, -33, 9, -32, 10, -25, 4, -22, -1, -27], INK);
        p.line([-8, -39, 8, -40], true);
      }
      if (id === 'sawyer') p.flat([0, -33, 8, -32, 8, -27, 3, -25], INK);

      // hats
      switch (id) {
        case 'greenhorn':
          p.shape([-14, -40, -10, -44, -5, -44, -4, -50, 5, -51, 7, -44, 13, -43, 15, -40], OCHRE);
          p.flat([-5, -47, 6, -47, 7, -44, -5, -44], INK);
          break;
        case 'sawyer':
          p.shape([-8, -40, -8, -47, -2, -51, 5, -48, 8, -40], OCHRE);
          p.flat([-10, -44, 9, -44, 10, -39, -10, -39], INK);
          p.flat([-5, -52, -1, -56, 3, -53, 1, -49, -4, -49], INK);
          break;
        case 'trapper':
          p.shape([-10, -39, -10, -46, -6, -49, 6, -49, 10, -45, 10, -40], OCHRE);
          p.hatch([-10, -39, -10, -46, -6, -49, 6, -49, 10, -45, 10, -40], 80, 3);
          p.flat([-10, -42, 11, -42, 11, -39, -10, -39], INK);
          p.shape([-9, -44, -16, -41, -20, -29, -16, -23, -12, -30, -10, -37], OCHRE);
          p.hatch([-9, -44, -16, -41, -20, -29, -16, -23, -12, -30, -10, -37], 20, 4, INK, 2.5);
          break;
        case 'tinker':
          p.at(0, -41, -9, () => {
            p.shape([-10, 0, 10, 0, 10, -3, 6, -4, 7, -16, -5, -16, -5, -4, -10, -3], OCHRE);
            p.flat([-5, -8, 6, -8, 6, -4, -5, -4], INK);
          });
          p.flat([0, -40, 9, -39, 9, -35, 0, -36], INK);
          p.cut([4, -38.5, 7.5, -38, 7.5, -36, 4, -36.5]);
          break;
        case 'clerk':
          p.flat([-8, -42, 5, -42, 15, -39, 15, -37, 4, -39, -8, -39], INK);
          p.line([-5, -41, -11, -52]);
          p.shape([-10, -50, -15, -58, -9, -56, -7, -51], OCHRE);
          break;
        default:
          break;
      }

      // front arm
      const hand: [number, number] = id === 'greenhorn' ? [12, -16] : [13, -15];
      p.shape([-1, -27, 5, -27, hand[0] + 2, hand[1] - 2, hand[0] - 2, hand[1] + 2], OCHRE);

      // tools
      switch (id) {
        case 'greenhorn':
          p.line([10, -13, 14, -17]);
          break;
        case 'sawyer':
          p.at(12, -13, 20, () => {
            p.line([0, 3, 0, -27]);
            p.shape([-3, -30, 2, -30, 11, -33, 13, -18, 2, -22, -3, -22], OCHRE);
            p.line([10, -31, 11, -20], true);
          });
          break;
        case 'smith':
          p.line([14, -12, 17, -40]);
          p.flat([8, -50, 27, -47, 26, -37, 8, -40], INK);
          p.cut([11, -47, 13, -46.5, 13, -41, 11, -41.5]);
          break;
        case 'trapper':
          // skinning knife, low and forward
          p.flat([13, -17, 25, -19, 21, -13, 13, -13], INK);
          break;
        case 'tinker':
          p.line([11, -12, 21, -25]);
          p.line([18, -28, 21, -25, 25, -25]);
          break;
        case 'clerk':
          p.shape([8, -25, 18, -24, 17, -10, 7, -11], OCHRE);
          p.flat([7, -25, 10, -25, 9, -10, 6, -11], INK);
          p.line([12, -20, 16, -19], true);
          p.line([12, -16, 16, -15], true);
          break;
        default:
          break;
      }
      p.dot(hand[0], hand[1], 2.2);
    });
  };
}

// -------------------------------------------------------------------- enemies

export const mite = (f: 0 | 1): Drawing => (p) => {
  lozenge(p, 13, 3.5);
  const s = f ? 3 : -3;
  p.line([-7, -5, -9 - s, 0]);
  p.line([-1, -5, -1 + s, 0]);
  p.line([5, -5, 7 - s, 0]);
  p.shape([-11, -4, -10, -11, -4, -17, 4, -17, 10, -12, 13, -6, 9, -3, -7, -2], MADDER);
  p.hatch([-11, -4, -10, -11, -4, -17, -2, -17, -3, -3], 60, 3);
  p.line([-2, -17, -3, -3], true);
  p.flat([11, -10, 18, -11, 14, -7], INK);
  p.flat([11, -5, 17, -3, 13, -2], INK);
  p.line([7, -14, 12, -21], true);
  p.eye(7, -10, 1.8);
};

export const gnat = (f: 0 | 1): Drawing => (p) => {
  lozenge(p, 6, 2);
  if (f === 0) {
    p.shape([-1, -22, -8, -34, 2, -27], null);
    p.shape([2, -23, 9, -35, 7, -23], null);
  } else {
    p.shape([-1, -21, -13, -25, -3, -17], null);
    p.shape([3, -21, 13, -28, 8, -19], null);
  }
  p.shape([-6, -18, -2, -23, 5, -22, 9, -18, 4, -14, -3, -14], MADDER);
  p.flat([9, -19, 16, -16, 9, -15], INK);
  p.dot(4, -19, 1.4);
  p.line([-1, -14, -2, -10], true);
  p.line([3, -14, 4, -10], true);
};

function boarBody(p: Print): void {
  p.line([-21, -17, -26, -21, -24, -26]);
  p.shape([-21, -9, -20, -20, -12, -27, 0, -31, 10, -27, 18, -19, 25, -13, 26, -8, 20, -5, -15, -4], MADDER);
  p.flat([-12, -27, -9, -33, -6, -29, -3, -36, 0, -31, 4, -36, 7, -28, 10, -27, 0, -30.5], INK);
  p.hatch([0, -31, 10, -27, 18, -19, 12, -7, 2, -6], 70, 3.5);
  p.flat([22, -13, 28, -12, 28, -8, 22, -6], INK);
  p.flat([17, -7, 25, -19, 23, -6], INK);
  p.flat([8, -27, 11, -34, 14, -25], INK);
  p.eye(15, -17, 1.8);
}

export const boar = (pose: 'walk' | 'windup', f: 0 | 1): Drawing => (p) => {
  lozenge(p, 24, 5);
  if (pose === 'walk') {
    const s = f ? 2 : -2;
    p.flat([-17, -8, -11, -8, -12 - s, 0, -18 - s, 0], INK);
    p.flat([-9, -6, -5, -6, -4 + s, 0, -9 + s, 0], INK);
    p.flat([8, -6, 13, -6, 12 - s, 0, 7 - s, 0], INK);
    p.flat([14, -7, 19, -7, 19 + s, 0, 14 + s, 0], INK);
    boarBody(p);
  } else {
    // head down, haunch up, one hoof scraping
    p.flat([-19, -13, -13, -13, -13, 0, -19, 0], INK);
    p.flat([-10, -11, -5, -11, -5, 0, -10, 0], INK);
    p.flat([15, -6, 20, -6, 20, 0, 15, 0], INK);
    p.flat([6, -7, 11, -5, 3, 1, -1, -2], INK);
    p.at(16, -2, 13, () => p.at(-16, 0, 0, () => boarBody(p)));
    p.flat([-6, -1, -2, -4, -1, 0], INK);
    p.flat([-12, 2, -8, -1, -6, 3], INK);
    p.line([-2, 3, 3, 4], true);
  }
};

export const spitter = (pose: 'walk' | 'spit', f: 0 | 1): Drawing => (p) => {
  lozenge(p, 17, 4);
  const s = f ? 1.5 : 0;
  p.flat([-16, -3, -7, -6, -5, 0, -17 - s, 0], INK);
  p.flat([4, -6, 13, -3, 17 + s, 0, 3, 0], INK);
  if (pose === 'walk') {
    // squat sack, crooked neck, flared mouth held high and forward
    p.flat([-16, -13, -22, -18, -14, -19], INK);
    p.flat([-11, -22, -16, -29, -6, -24], INK);
    p.shape([-14, -3, -17, -13, -12, -22, -3, -25, 3, -31, 4, -39, 0, -46, 19, -43, 13, -37, 11, -30, 14, -22, 16, -12, 13, -3], MADDER);
    p.flat([0, -46, 19, -43, 14, -39, 5, -41], INK);
    p.hatch([3, -25, 14, -22, 16, -12, 13, -3, 2, -3], -30, 3.5);
    p.line([3, -31, 11, -30], true);
    p.line([4, -36, 12, -35], true);
  } else {
    // sack squeezed flat, neck thrown forward
    p.flat([-16, -11, -22, -15, -13, -17], INK);
    p.flat([-10, -18, -14, -25, -4, -20], INK);
    p.shape([-14, -3, -17, -11, -11, -18, 0, -20, 9, -25, 19, -33, 19, -42, 31, -27, 23, -26, 15, -17, 15, -10, 13, -3], MADDER);
    p.flat([19, -42, 31, -27, 26, -27, 18, -37], INK);
    p.hatch([3, -19, 12, -22, 15, -10, 13, -3, 2, -3], -30, 5);
    p.line([10, -25, 15, -19], true);
    p.line([14, -29, 19, -23], true);
  }
  p.eye(-8, pose === 'walk' ? -17 : -13, 2.4);
  p.dot(-11, -8);
  p.dot(-4, -7, 1.3);
};

function magpieBody(p: Print, wingUp: boolean): void {
  p.flat([-8, -15, -27, -9, -28, -4, -9, -9], INK);
  p.shape([-9, -9, -8, -17, -2, -22, 6, -22, 10, -17, 8, -10, 2, -7], MADDER);
  if (wingUp) p.flat([-7, -17, -14, -35, -3, -29, 5, -19, -1, -14], INK);
  else p.flat([-9, -18, -2, -22, 5, -16, -1, -10, -12, -10], INK);
  p.flat([3, -21, 6, -28, 12, -29, 15, -24, 11, -20, 6, -18], INK);
  p.flat([14, -27, 23, -23, 14, -22], INK);
  p.eye(10, -25, 1.5);
}

export const magpie = (pose: 'walk' | 'carry', f: 0 | 1): Drawing => (p) => {
  lozenge(p, 13, 3);
  const s = f ? 3 : 0;
  p.line([-2, -8, -3 - s, 0, 1 - s, 0]);
  p.line([3, -8, 4 + s, 0, 8 + s, 0]);
  if (pose === 'walk') {
    magpieBody(p, false);
  } else {
    p.at(0, -2, -12, () => {
      magpieBody(p, f === 0);
      // a stolen token in the beak. Ochre because it is scrip.
      p.shape([21, -27, 25, -29, 29, -27, 30, -22, 26, -19, 22, -21], OCHRE);
      p.cut([24.5, -25.5, 27, -25, 26.5, -22.5, 24, -23]);
    });
  }
};

function mound(p: Print, front: boolean): void {
  if (front) p.shape([-19, 0, -14, -6, -6, -8, 3, -6, 12, -7, 19, 0, 10, 3, -9, 3], SPRUCE);
  else p.shape([-19, 0, -15, -7, -7, -12, 2, -13, 10, -10, 16, -5, 20, 0, 10, 3, -9, 3], SPRUCE);
  p.line([-12, -3, -8, -6], true);
  p.line([-2, -2, 3, -4], true);
  p.line([9, -2, 13, -4], true);
  p.flat([-25, -1, -21, -4, -19, 0], INK);
  p.flat([21, -3, 25, -1, 22, 1], INK);
}

export const burrower = (pose: 'mound' | 'emerged', f: 0 | 1): Drawing => (p) => {
  if (pose === 'mound') {
    mound(p, false);
    // only the claws show
    p.shape([-8, -11, -6, -21, -2, -12], MADDER);
    p.shape([-2, -12, 1, -24, 5, -12], MADDER);
    p.shape([5, -12, 9, -20, 11, -10], MADDER);
    return;
  }
  const s = f ? 3 : 0;
  // far claw, raised
  p.shape([-9, -22, -17, -30 - s, -25, -27 - s, -24, -19 - s, -12, -14], MADDER);
  p.flat([-17, -30 - s, -22, -41 - s, -21, -29 - s], INK);
  p.flat([-22, -28 - s, -31, -35 - s, -25, -24 - s], INK);
  p.flat([-25, -23 - s, -33, -22 - s, -24, -19 - s], INK);
  // body: a fat grub of a mole, blunt head, snout forward
  p.shape([-11, -4, -13, -22, -9, -33, 0, -38, 9, -36, 15, -31, 24, -29, 24, -25, 14, -23, 12, -14, 12, -4], MADDER);
  p.hatch([-11, -4, -13, -20, 12, -18, 12, -4], 3, 4.5);
  p.flat([19, -31, 26, -30, 26, -24, 19, -25], INK);
  p.line([4, -32, 9, -30]);
  p.line([-8, -27, -2, -24], true);
  // near claw, three talons
  p.shape([9, -17, 19, -20 + s, 25, -14 + s, 21, -7 + s, 11, -8], MADDER);
  p.flat([20, -20 + s, 29, -25 + s, 25, -15 + s], INK);
  p.flat([25, -15 + s, 34, -14 + s, 25, -10 + s], INK);
  p.flat([23, -9 + s, 31, -3 + s, 20, -6 + s], INK);
  mound(p, true);
};

export const brute = (pose: 'walk' | 'slam', f: 0 | 1): Drawing => (p) => {
  lozenge(p, 30, 6);
  const s = f ? 3 : 0;
  p.flat([-13, -14, -3, -14, -2 - s, 0, -15 - s, 0], INK);
  p.flat([4, -14, 13, -14, 16 + s, 0, 4 + s, 0], INK);
  const up = pose === 'slam';
  // far arm
  if (up) p.shape([-25, -42, -19, -78, -5, -78, -9, -48], MADDER);
  else p.shape([-24, -40, -32, -22, -31 + s, -6, -23 + s, -1, -17 + s, -8, -21, -24, -16, -36], MADDER);
  // torso
  p.shape([-22, -12, -26, -34, -20, -48, -8, -55, 8, -55, 20, -49, 26, -36, 22, -12], MADDER);
  p.hatch([-22, -12, -26, -34, -20, -48, -10, -54, -8, -12], 62, 4);
  p.line([-6, -16, 2, -18, 10, -15], true);
  p.line([-4, -24, 3, -26, 11, -23], true);
  // head, small and sunk
  p.shape([-2, -52, 0, -61, 8, -62, 13, -56, 12, -49, 3, -47], MADDER);
  p.flat([2, -59, 13, -58, 13, -55, 3, -55], INK);
  p.eye(8, -53.5, 1.5);
  if (up) p.flat([5, -51, 12, -51, 11, -47, 6, -47], INK);
  else p.cut([9, -50, 11, -53, 12, -50]);
  // near arm
  if (up) {
    p.shape([24, -44, 19, -79, 5, -78, 9, -48], MADDER);
    // both fists locked into one block over the head
    p.shape([-22, -76, -17, -91, 16, -93, 23, -78, 17, -70, -16, -69], MADDER);
    p.hatch([-22, -76, -17, -91, -6, -92, -8, -69, -16, -69], 62, 4);
    p.line([0, -92, 1, -70]);
    p.line([7, -84, 15, -83], true);
  } else {
    p.shape([18, -47, 29, -38, 33, -16, 31 - s, -4, 22 - s, -2, 19 - s, -10, 22, -20, 14, -36], MADDER);
    p.line([23 - s, -8, 29 - s, -9], true);
    p.hatch([22, -20, 33, -16, 31 - s, -4, 22 - s, -2, 19 - s, -10], 62, 4);
  }
};

function stagAntlers(p: Print): void {
  p.line([0, 0, -2, -12, -10, -20, -18, -22]);
  p.line([-2, -10, 4, -18]);
  p.line([-7, -17, -4, -27]);
  p.line([-13, -21, -14, -30]);
  p.line([4, 0, 6, -10, 14, -16, 20, -14]);
  p.line([7, -11, 12, -22]);
  p.line([14, -16, 18, -24]);
}

export const stag = (pose: 'walk' | 'windup', f: 0 | 1): Drawing => (p) => {
  lozenge(p, 28, 5);
  const s = f ? 3 : 0;
  const low = pose === 'windup';
  // legs
  if (low) {
    p.flat([-21, -30, -15, -30, -13, -14, -15, 0, -20, 0, -18, -14], INK);
    p.flat([-12, -28, -7, -28, -7, 0, -12, 0], INK);
    p.flat([15, -24, 20, -24, 20, 0, 15, 0], INK);
    p.flat([8, -22, 13, -20, 6, -8, 1, -1, -3, -3, 3, -10], INK);
  } else {
    p.flat([-21, -27, -15, -27, -13, -13, -15 - s, 0, -20 - s, 0, -18, -13], INK);
    p.flat([-12, -25, -7, -25, -7 + s, 0, -12 + s, 0], INK);
    p.flat([8, -25, 13, -25, 13 - s, 0, 8 - s, 0], INK);
    p.flat([15, -27, 20, -27, 21, -13, 19 + s, 0, 14 + s, 0, 16, -13], INK);
  }
  const body = (): void => {
    p.flat([-24, -41, -30, -46, -27, -36], INK);
    p.shape([-24, -28, -23, -40, -12, -46, 6, -44, 16, -49, 23, -40, 21, -28, 8, -22, -14, -24], MADDER);
    p.hatch([6, -44, 16, -49, 23, -40, 21, -28, 8, -22], 70, 3.5);
    p.line([-18, -30, -10, -28], true);
  };
  if (low) {
    p.at(18, -24, 8, () => p.at(-18, 24, 0, body));
    p.shape([13, -42, 24, -44, 35, -36, 42, -29, 40, -23, 31, -27, 22, -31, 16, -34], MADDER);
    p.flat([38, -30, 43, -29, 41, -23, 37, -25], INK);
    p.eye(31, -33, 1.8);
    p.at(30, -37, 68, () => stagAntlers(p));
    p.flat([-4, -1, 0, -5, 1, 0], INK);
    p.line([-9, 2, -5, 0], true);
  } else {
    body();
    p.shape([12, -44, 18, -60, 22, -67, 30, -67, 38, -59, 36, -54, 28, -56, 25, -45, 20, -38], MADDER);
    p.flat([34, -61, 39, -59, 37, -54, 33, -56], INK);
    p.eye(28, -62, 1.8);
    p.flat([19, -66, 16, -73, 23, -68], INK);
    p.at(23, -67, -4, () => stagAntlers(p));
  }
};

export const rotwood = (f: 0 | 1): Drawing => (p) => {
  lozenge(p, 30, 6);
  const s = f ? 4 : 0;
  // root legs
  p.shape([-14, -16, -5, -16, -3 - s, -3, -9 - s, 0, -22 - s, 0, -15, -6], SPRUCE);
  p.shape([4, -16, 13, -16, 16, -6, 23 + s, 0, 10 + s, 0, 5 + s, -4], SPRUCE);
  // branch arms
  p.shape([-12, -44, -27, -52, -36, -46 + s, -38, -40 + s, -28, -44, -13, -36], SPRUCE);
  p.line([-36, -46 + s, -43, -50 + s]);
  p.line([-37, -41 + s, -44, -38 + s]);
  p.shape([12, -42, 28, -48, 35, -60 - s, 40, -58 - s, 33, -42, 13, -34], SPRUCE);
  p.line([36, -60 - s, 37, -69 - s]);
  p.line([39, -58 - s, 46, -62 - s]);
  // trunk
  p.shape([-12, -12, -14, -40, -10, -60, 8, -60, 13, -40, 12, -12], SPRUCE);
  p.hatch([-12, -12, -14, -40, -10, -60, -3, -60, -5, -12], 86, 3.5);
  // rot: eyes and a split mouth
  p.shape([-7, -31, -3, -35, 1, -31, 5, -36, 9, -30, 5, -24, 0, -27, -4, -22], MADDER);
  p.shape([-9, -46, -3, -44, -6, -40], MADDER);
  p.shape([3, -44, 10, -47, 8, -40], MADDER);
  // canopy
  p.shape([-26, -58, -33, -72, -23, -85, -11, -83, -5, -97, 10, -99, 16, -87, 28, -85, 33, -70, 24, -58], SPRUCE);
  p.hatch([-26, -58, -33, -72, -23, -85, -11, -83, -8, -58], 60, 4);
  p.flat([8, -80, 17, -84, 22, -75, 14, -70], MADDER);
  p.flat([-14, -70, -7, -74, -3, -66, -11, -63], MADDER);
  p.flat([18, -66, 24, -67, 23, -61], MADDER);
  p.line([-5, -97, -9, -106]);
  p.line([-8, -102, -3, -105], true);
};

// Old Tusk. One body cut, three stances.
function tuskBody(p: Print, phase: 1 | 2 | 3): void {
  const wild = phase === 3;
  p.line([-56, -44, -66, -52, -63, -61]);
  p.flat([-66, -60, -60, -68, -59, -58], INK);
  p.shape([-55, -22, -56, -50, -44, -68, -20, -80, 6, -84, 28, -74, 46, -56, 58, -40, 62, -26, 52, -14, 30, -10, -40, -10], MADDER);
  // mane
  if (wild) {
    p.flat([-46, -66, -44, -88, -34, -74, -28, -100, -18, -80, -8, -106, 0, -84, 10, -104, 16, -80, 26, -92, 28, -74, 6, -83, -20, -79], INK);
  } else {
    p.flat([-44, -68, -39, -80, -32, -73, -25, -89, -16, -79, -6, -94, 2, -83, 12, -94, 18, -80, 28, -74, 6, -83, -20, -79], INK);
  }
  p.hatch([6, -84, 28, -74, 46, -56, 58, -40, 44, -22, 24, -20, 14, -50], 68, 4.5);
  p.hatch([-55, -22, -56, -50, -44, -68, -36, -72, -38, -12], 68, 4.5);
  // belly line and old scars
  p.line([-30, -26, -10, -22, 12, -24], true);
  p.line([-24, -56, -12, -44], true);
  p.line([-18, -58, -6, -46], true);
  if (wild) {
    p.line([-40, -50, -28, -34]);
    p.line([-2, -66, 8, -48]);
    p.line([-8, -92, -12, -112]);
    p.line([4, -90, 12, -110]);
    p.flat([-15, -114, -10, -116, -9, -110], INK);
  }
  p.flat([22, -74, 29, -92, 36, -70], INK);
  // snout and jaw
  p.flat([52, -36, 67, -31, 67, -21, 56, -15], INK);
  if (phase === 2) {
    p.flat([40, -14, 58, -13, 62, -2, 46, -4], INK);
    p.cut([50, -13, 53, -19, 56, -13]);
  }
  // tusks: solid Ink, swept up past the snout
  p.flat([34, -17, 42, -36, 52, -47, 50, -33, 45, -18], INK);
  if (wild) {
    // the near one snapped short
    p.flat([46, -19, 56, -36, 60, -40, 63, -33, 59, -32, 58, -19], INK);
  } else {
    p.flat([46, -19, 58, -42, 68, -56, 76, -62, 72, -46, 64, -32, 58, -19], INK);
  }
  // a cut along each tusk so it stands off the snout
  p.cut([36, -19, 43, -35, 50, -44, 44, -33, 39, -19]);
  if (!wild) p.cut([49, -20, 59, -41, 68, -54, 61, -40, 52, -20]);
  p.eye(40, -50, 3.6);
  p.dot(41, -50, 1.6);
  p.line([33, -58, 46, -55]);
}

export const tusk = (phase: 1 | 2 | 3, f: 0 | 1 = 0): Drawing => (p) => {
  const s = f ? 4 : 0;
  if (phase === 1) {
    lozenge(p, 60, 9);
    p.flat([-49, -24, -35, -24, -36 - s, 0, -51 - s, 0], INK);
    p.flat([-31, -14, -20, -14, -19 + s, 0, -30 + s, 0], INK);
    p.flat([22, -14, 34, -14, 33 - s, 0, 21 - s, 0], INK);
    p.flat([38, -16, 50, -16, 51 + s, 0, 39 + s, 0], INK);
    tuskBody(p, 1);
  } else if (phase === 2) {
    // reared up, bellowing
    lozenge(p, 46, 9, -10);
    p.flat([-44, -30, -28, -30, -24, 0, -44, 0], INK);
    p.flat([-22, -26, -8, -26, -4, 0, -20, 0], INK);
    // forelegs hang from the chest, knees bent
    p.flat([6, -62, 18, -58, 27, -44, 23, -31, 14, -33, 15, -44], INK);
    p.flat([16, -76, 28, -72, 39, -58, 37, -45, 28, -47, 27, -58], INK);
    p.at(-30, -18, -48, () => p.at(30, 18, 0, () => tuskBody(p, 2)));
  } else {
    // half reared, bristling, one tusk broken: about to come down
    lozenge(p, 56, 9);
    p.flat([-49, -24, -35, -24, -34, 0, -52, 0], INK);
    p.flat([-31, -16, -20, -16, -16, 0, -30, 0], INK);
    p.at(-34, -12, -20, () =>
      p.at(34, 12, 0, () => {
        p.flat([20, -14, 32, -14, 38, 12, 24, 12], INK);
        p.flat([38, -16, 50, -16, 60, 8, 46, 10], INK);
        tuskBody(p, 3);
      }),
    );
  }
};
