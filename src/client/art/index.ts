// The art kit. Import from here.
//
//   import { bakeAll, drawSprite } from './art/index.ts';
//   const sprites = bakeAll(window.devicePixelRatio);   // once at boot; again if dpr changes
//   drawSprite(ctx, sprites.enemy.boar.windup, x, y, facingLeft);
//   drawSprite(ctx, sprites.enemy.boar.windup.ink, x, y, facingLeft);   // hit flash, 2 frames
//
// Every entry is a Sprite { canvas, w, h, ax, ay, ink }: sizes and anchor in
// css px, canvas baked at dpr (capped at 2), .ink the solid-Ink silhouette.
// Sprites face right; pass flipX to face left. Anchors: feet for creatures
// and nodes, centre for pickups, projectiles, chips and icons, the wielder
// for melee arcs.
//
// Registry
//   player[id].walk[0|1]                       id: greenhorn sawyer smith trapper tinker clerk
//   enemy.mite.walk[0|1]        enemy.gnat.walk[0|1] (anchor on the ground; it hovers)
//   enemy.boar.walk[] .windup   enemy.spitter.walk[] .spit
//   enemy.magpie.walk[] .carry[0|1]            carry = fleeing with loot
//   enemy.burrower.mound .walk[] (emerged)     enemy.brute.walk[] .slam
//   enemy.stag.walk[] .windup   enemy.rotwood.walk[]
//   enemy.tusk.walk[] (= phase 1) .phase[0|1|2]   charge, summon, slam
//   node[tree|seam|carcass].normal[0..3] .rich[0..3] .remnant .richRemnant
//                                              stage 0 untouched, 3 nearly done
//   pickup.scrip .timber .ore .hide
//   shot.stone .arrow .ball .axe (spin it) .bola .spit (turn it to its heading) .shard
//   mark.ground .head (the player, under the feet and over the head) .tick (where a hit came from,
//                                              turn it) .point (teaching pointer)
//   arc.sweep[0|1] .thrust[0|1]                frame 0 the cut, 1 the after-mark;
//                                              unit reach 48 / 58 px, scale to the weapon
//   chip.ink[0..3] .ochre[] .madder[] .spruce[]
//   icon.weapon[id] .glyph[id] .stat[id] .raw[id] .station[id]
//   icon.scrip .marks .mule .lock .reroll      each { s, l }: 32 and 64 css px
//   floor, treeline                            use drawFloor and drawTreeline
//
// Drawing helpers that are not sprites: drawFloor, drawTreeline,
// drawWorkRing, drawChargeLane, drawSlamRing (see world.ts).
// For DOM UI: spriteElement(sprite) returns a sized <canvas class="icon">.

import { GLYPHS, RAWS, STATS, type GlyphId, type RawId, type StatId } from '../../shared/vocab.ts';
import { CHARACTER_IDS, boar, brute, burrower, gnat, magpie, mite, player, rotwood, spitter, stag, tusk, type CharacterId } from './creatures.ts';
import { GLYPH_ICON, ICON_UNIT, MISC_ICON, RAW_ICON, STATION_ICON, STATION_IDS, STAT_ICON, WEAPON_ICON, WEAPON_IDS, type StationId, type WeaponId } from './icons.ts';
import { INK, MADDER, OCHRE, SPRUCE, bake, capDpr, type Drawing, type Sprite } from './print.ts';
import {
  NODE_IDS, arrowShot, axeShot, bakeFloor, bakeTreeline, ballShot, bolaShot, bones, carcass, chip, hidePickup, hurtTick, orePickup,
  playerGround, playerHead, pointer, rubble, scripToken, seam, shardShot, spitShot, stoneShot, stump, sweepArc, thrustArc, timberPickup, tree,
  type NodeId, type NodeStage,
} from './world.ts';

export * from './print.ts';
export { CHARACTER_IDS, ENEMY_IDS, type CharacterId, type EnemyId } from './creatures.ts';
export { WEAPON_IDS, STATION_IDS, MISC_ICON_IDS, type WeaponId, type StationId, type MiscIconId } from './icons.ts';
export {
  NODE_IDS, FLOOR_TILE, TREELINE_W, TREELINE_H, drawFloor, drawTreeline, drawWorkRing, drawChargeLane, drawSlamRing,
  type NodeId, type NodeStage,
} from './world.ts';

export type Frames = readonly [Sprite, Sprite];
/** An icon at both sizes: s = 32 css px, l = 64 css px. */
export interface Icon {
  s: Sprite;
  l: Sprite;
}
export interface NodeSprites {
  /** Stages 0-3 of an ordinary node. */
  normal: readonly [Sprite, Sprite, Sprite, Sprite];
  /** Stages 0-3 of a rich node. */
  rich: readonly [Sprite, Sprite, Sprite, Sprite];
  /** What is left when it is worked out: stump, rubble, bones. */
  remnant: Sprite;
  richRemnant: Sprite;
}
export type ChipSet = readonly [Sprite, Sprite, Sprite, Sprite];

export interface Sprites {
  /** The (capped) device pixel ratio these were baked at. */
  dpr: number;
  player: Record<CharacterId, { walk: Frames }>;
  enemy: {
    mite: { walk: Frames };
    gnat: { walk: Frames };
    boar: { walk: Frames; windup: Sprite };
    spitter: { walk: Frames; spit: Sprite };
    magpie: { walk: Frames; carry: Frames };
    burrower: { walk: Frames; mound: Sprite };
    brute: { walk: Frames; slam: Sprite };
    stag: { walk: Frames; windup: Sprite };
    rotwood: { walk: Frames };
    tusk: { walk: Frames; phase: readonly [Sprite, Sprite, Sprite] };
  };
  node: Record<NodeId, NodeSprites>;
  pickup: { scrip: Sprite; timber: Sprite; ore: Sprite; hide: Sprite };
  shot: { stone: Sprite; arrow: Sprite; ball: Sprite; axe: Sprite; bola: Sprite; spit: Sprite; shard: Sprite };
  mark: { ground: Sprite; head: Sprite; tick: Sprite; point: Sprite };
  arc: { sweep: Frames; thrust: Frames };
  chip: { ink: ChipSet; ochre: ChipSet; madder: ChipSet; spruce: ChipSet };
  icon: {
    weapon: Record<WeaponId, Icon>;
    glyph: Record<GlyphId, Icon>;
    stat: Record<StatId, Icon>;
    raw: Record<RawId, Icon>;
    station: Record<StationId, Icon>;
    scrip: Icon;
    marks: Icon;
    mule: Icon;
    lock: Icon;
    reroll: Icon;
  };
  floor: Sprite;
  treeline: Sprite;
}

/** Icon sizes in css px. */
export const ICON_S = 32;
export const ICON_L = 64;

/** Bake every sprite. About 500 small canvases; call once at boot and again only if the pixel ratio changes. */
export function bakeAll(devicePixelRatio = 1): Sprites {
  const dpr = capDpr(devicePixelRatio);
  const b = (seed: string, d: Drawing): Sprite => bake(dpr, seed, d);
  const two = (seed: string, d: (f: 0 | 1) => Drawing): Frames => [b(seed, d(0)), b(seed, d(1))];
  const icon = (seed: string, d: Drawing): Icon => ({
    s: bake(dpr, seed, d, { k: ICON_S / ICON_UNIT, box: [ICON_S, ICON_S], jitter: 0.4 }),
    l: bake(dpr, seed, d, { k: ICON_L / ICON_UNIT, box: [ICON_L, ICON_L], jitter: 0.6 }),
  });
  const icons = <K extends string>(ids: readonly K[], table: Record<K, Drawing>, prefix: string): Record<K, Icon> => {
    const out = {} as Record<K, Icon>;
    for (const id of ids) out[id] = icon(prefix + id, table[id]);
    return out;
  };

  const playerSprites = {} as Record<CharacterId, { walk: Frames }>;
  for (const id of CHARACTER_IDS) playerSprites[id] = { walk: two('pc-' + id, (f) => player(id, f)) };

  const nodeDefs: Record<NodeId, [(rich: boolean, d: NodeStage) => Drawing, (rich: boolean) => Drawing]> = {
    tree: [tree, stump],
    seam: [seam, rubble],
    carcass: [carcass, bones],
  };
  const node = {} as Record<NodeId, NodeSprites>;
  for (const id of NODE_IDS) {
    const [stage, rem] = nodeDefs[id];
    const four = (rich: boolean): readonly [Sprite, Sprite, Sprite, Sprite] => {
      const seed = `node-${id}-${rich ? 'r' : 'n'}`;
      return [b(seed, stage(rich, 0)), b(seed, stage(rich, 1)), b(seed, stage(rich, 2)), b(seed, stage(rich, 3))];
    };
    node[id] = { normal: four(false), rich: four(true), remnant: b(`node-${id}-n`, rem(false)), richRemnant: b(`node-${id}-r`, rem(true)) };
  }

  const chips = (c: typeof INK | typeof OCHRE | typeof MADDER | typeof SPRUCE): ChipSet => {
    const one = (i: number): Sprite => bake(dpr, 'chip' + i, chip(i, c), { jitter: 0.3 });
    return [one(0), one(1), one(2), one(3)];
  };

  const tuskWalk = two('tusk', (f) => tusk(1, f));

  return {
    dpr,
    player: playerSprites,
    enemy: {
      mite: { walk: two('mite', mite) },
      gnat: { walk: two('gnat', gnat) },
      boar: { walk: two('boar', (f) => boar('walk', f)), windup: b('boar', boar('windup', 0)) },
      spitter: { walk: two('spitter', (f) => spitter('walk', f)), spit: b('spitter', spitter('spit', 0)) },
      magpie: { walk: two('magpie', (f) => magpie('walk', f)), carry: two('magpie', (f) => magpie('carry', f)) },
      burrower: { walk: two('burrower', (f) => burrower('emerged', f)), mound: b('burrower', burrower('mound', 0)) },
      brute: { walk: two('brute', (f) => brute('walk', f)), slam: b('brute', brute('slam', 0)) },
      stag: { walk: two('stag', (f) => stag('walk', f)), windup: b('stag', stag('windup', 0)) },
      rotwood: { walk: two('rotwood', rotwood) },
      tusk: { walk: tuskWalk, phase: [tuskWalk[0], b('tusk', tusk(2)), b('tusk', tusk(3))] },
    },
    node,
    pickup: { scrip: b('p-scrip', scripToken), timber: b('p-timber', timberPickup), ore: b('p-ore', orePickup), hide: b('p-hide', hidePickup) },
    shot: {
      stone: b('s-stone', stoneShot), arrow: b('s-arrow', arrowShot), ball: b('s-ball', ballShot), axe: b('s-axe', axeShot),
      bola: b('s-bola', bolaShot), spit: b('s-spit', spitShot), shard: b('s-shard', shardShot),
    },
    mark: {
      ground: bake(dpr, 'm-ground', playerGround, { jitter: 0.3 }), head: bake(dpr, 'm-head', playerHead, { jitter: 0.3 }),
      tick: b('m-tick', hurtTick), point: b('m-point', pointer),
    },
    arc: { sweep: two('a-sweep', sweepArc), thrust: two('a-thrust', thrustArc) },
    chip: { ink: chips(INK), ochre: chips(OCHRE), madder: chips(MADDER), spruce: chips(SPRUCE) },
    icon: {
      weapon: icons(WEAPON_IDS, WEAPON_ICON, 'w-'),
      glyph: icons(GLYPHS, GLYPH_ICON, 'g-'),
      stat: icons(STATS, STAT_ICON, 'st-'),
      raw: icons(RAWS, RAW_ICON, 'r-'),
      station: icons(STATION_IDS, STATION_ICON, 'stn-'),
      scrip: icon('i-scrip', MISC_ICON.scrip),
      marks: icon('i-marks', MISC_ICON.marks),
      mule: icon('i-mule', MISC_ICON.mule),
      lock: icon('i-lock', MISC_ICON.lock),
      reroll: icon('i-reroll', MISC_ICON.reroll),
    },
    floor: bakeFloor(dpr),
    treeline: bakeTreeline(dpr),
  };
}
