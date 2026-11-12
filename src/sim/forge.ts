// The forge game in the run: the loadout comes from the town's bench, and the run
// pays back in kind. Off unless createRun is given `forge` (RunOptions).
//
//   - No free weapon and no weapons for sale: what you fight with was made at home.
//     A made weapon carries a quality multiplier and a cap: the bench can raise it
//     one tier past what was forged, no further.
//   - Zones by tier. Zone 2 is harder and drops tier 2 materials.
//   - Tool doors: a tier 2 node can only be worked with a tool of its kind at tier 2.
//   - Drops show their colour before you know what they are (a 'glint' at the drop),
//     and say what they are when picked up (a 'loot' event):
//       tier 2 materials (blue), named parts and schematics (purple), relics (orange).
//   - A named part fits a free socket at once and changes play for the rest of the run.
//   - A bad-luck floor: after enough runs without a relic, the boss always drops one.
import type { ItemSpec } from '../shared/item.ts';
import { RELICS } from '../shared/content/relics.ts';
import { emit, spawnPickup, ST } from './core.ts';
import { rnd, Stream } from './rng.ts';
import { PK_HIDE, PK_ORE, PK_TIMBER, type Run } from './types.ts';

/** Tier 2 materials: aged wood, silver ore, thick hide (PK_T2 + i). */
export const PK_T2 = 12, T2_COUNT = 3;
export const PK_PART = 15, PK_SCHEMATIC = 16, PK_RELIC = 17;
/** Colour tier of a pickup kind: 1 plain, 2 blue, 3 purple, 4 orange. */
export const pickTier = (kind: number): number =>
  kind === PK_RELIC ? 4 : kind === PK_PART || kind === PK_SCHEMATIC ? 3 : kind >= PK_T2 && kind < PK_T2 + T2_COUNT ? 2 : 1;

export interface PartDef { id: string; name: string; from: string; item: ItemSpec; what: string }
const part = (id: string, name: string, from: string, what: string, effects: ItemSpec['effects']): PartDef =>
  ({ id, name, from, what, item: { id: `part:${id}`, name, glyph: 'bone', tags: ['part', from], effects } });
/** Named parts. Each beast that has one drops it; elites always do. */
export const PARTS: readonly PartDef[] = [
  part('tusk', 'Boar tusk', 'boar', 'Shots pierce one more.', [{ p: 'pierce', l: 3 }]),
  part('gland', 'Toad gland', 'spitter', 'Hits burn.', [{ p: 'burn', l: 3 }]),
  part('claw', 'Badger claw', 'burrower', 'Far more crits.', [{ p: 'crit', l: 4 }]),
  part('heart', "Bear's heart", 'brute', 'More health, and attackers bleed.', [{ p: 'maxHp', l: 3 }, { p: 'thorns', l: 3 }]),
  part('antler', 'Stag antler', 'stag', 'Hits knock back hard, and you run faster.', [{ p: 'knockback', l: 4 }, { p: 'speed', l: 2 }]),
  part('heartwood', 'Rotwood heart', 'rotwood', 'Broken nodes throw shards.', [{ p: 'nodeBurst', l: 3 }]),
];
const PART_OF: Record<string, number> = Object.fromEntries(PARTS.map((p, i) => [p.from, i]));

/** What a kill drops. [chance of a raw, raws, chance of a tier 2 material, part chance, schematic chance, relic chance]. */
const DROPS: Record<string, readonly [number, number, number, number, number, number]> = {
  mite: [0.015, 1, 0, 0, 0, 0], gnat: [0.008, 1, 0, 0, 0, 0],
  boar: [0.12, 1, 0.01, 0.005, 0, 0], spitter: [0.08, 1, 0.01, 0.006, 0, 0], magpie: [0.3, 1, 0.03, 0, 0, 0],
  burrower: [0.12, 1, 0.01, 0.008, 0, 0], brute: [0.6, 2, 0.3, 0.035, 0.03, 0.004],
  stag: [1, 4, 1, 1, 0.4, 0.04], rotwood: [1, 4, 1, 1, 0.4, 0.04], tusk: [1, 6, 1, 0, 0.6, 0.25],
};
/** Runs without a relic after which the boss always drops one. */
export const PITY = 3;
/** Zone multipliers on enemy health and damage. */
export const ZONE_HP: readonly number[] = [1, 1, 1.7];
export const ZONE_DMG: readonly number[] = [1, 1, 1.35];

const T2_OF_NODE = [PK_T2, PK_T2 + 1, PK_T2 + 2];
const TOOL_OF_NODE = ['hatchet', 'pick', 'knife'];

/** Best tier of the tool that works this node type, 0 if none is held. */
export function toolTier(run: Run, nodeType: number): number {
  let t = 0;
  for (const w of run.player.weapons) if (w.id === TOOL_OF_NODE[nodeType] && w.tier > t) t = w.tier;
  return t;
}
/** True if a node of this tier and type cannot be worked with what is held. */
export function doorShut(run: Run, nodeType: number, tier: number): boolean {
  return !!run.forge && tier > 1 && nodeType < 3 && toolTier(run, nodeType) < tier;
}
/** Pickup kind a broken node pays in. */
export function nodeKind(nodeType: number, tier: number): number {
  return tier > 1 ? T2_OF_NODE[nodeType] ?? PK_TIMBER : PK_TIMBER + nodeType;
}

function drop(run: Run, x: number, y: number, kind: number, value: number, scatter: number): void {
  spawnPickup(run, x, y, kind, value, scatter);
  const t = pickTier(kind);
  if (t >= 2) emit(run, 'glint', x, y, t, kind);
}

/** A kill in a forge run. */
export function forgeDrops(run: Run, x: number, y: number, id: string, rank: number): void {
  const f = run.forge!, t = DROPS[id];
  if (!t) return;
  const luck = 1 + Math.max(0, run.player.stat[ST.luck]) / 100;
  const r = (): number => rnd(run.rng, Stream.Drop);
  if (r() < t[0] * luck) {
    for (let k = 0; k < t[1]; k++) {
      // In the fen, half of what falls is of the fen.
      const kind = f.zone >= 2 && r() < 0.5 ? PK_T2 + Math.floor(r() * T2_COUNT) : PK_TIMBER + Math.floor(r() * 3);
      drop(run, x, y, kind, 1, 140);
    }
  }
  const t2 = rank > 0 ? 2 : 1;
  for (let k = 0; k < t2; k++) if (r() < t[2] * luck) drop(run, x, y, PK_T2 + Math.floor(r() * T2_COUNT), 1, 130);
  const pi = PART_OF[id];
  if (pi !== undefined && r() < t[3] * luck) drop(run, x, y, PK_PART, pi, 110);
  if (r() < t[4] * luck) drop(run, x, y, PK_SCHEMATIC, 1, 110);
  // The boss always pays a relic once the drought has gone on long enough.
  const relic = rank === 2 && f.pity >= PITY ? 1 : t[5] * luck;
  if (f.relics.length === 0 && r() < relic) drop(run, x, y, PK_RELIC, Math.floor(r() * RELICS.length), 100);
}

/**
 * Pick up a forge drop. A part goes into a free socket at once; a relic goes into play at once.
 * Returns false for kinds this file does not own.
 */
export function takeForge(run: Run, kind: number, value: number): boolean {
  const f = run.forge;
  if (!f || kind < PK_T2) return false;
  const p = run.player;
  if (kind < PK_T2 + T2_COUNT) { f.t2[kind - PK_T2] += value; emit(run, 'loot', p.x, p.y, kind, value); return true; }
  if (kind === PK_PART) {
    const fit = f.fitted.length < f.sockets;
    f.parts.push(value);
    if (fit) { f.fitted.push(value); p.items.push(PARTS[value].item); p.itemKit.push(true); f.dirty = true; }
    emit(run, 'loot', p.x, p.y, kind, value, fit ? 1 : 0);
    return true;
  }
  if (kind === PK_SCHEMATIC) { f.schematics++; emit(run, 'loot', p.x, p.y, kind, 0); return true; }
  if (kind === PK_RELIC) {
    const relic = RELICS[value] ?? RELICS[0];
    f.relics.push(relic.id);
    p.items.push(relic); p.itemKit.push(true); f.dirty = true;
    emit(run, 'loot', p.x, p.y, kind, value);
    return true;
  }
  return false;
}

/** A won run that never saw the boss fall still keeps the promise of the bad-luck floor. */
export function forgeWin(run: Run): void {
  const f = run.forge;
  if (!f || f.pity < PITY || f.relics.length) return;
  takeForge(run, PK_RELIC, Math.floor(rnd(run.rng, Stream.Drop) * RELICS.length));
}

/** Kinds of drop a node or kill can raise in a pickup of the forge game. */
export const isForgeKind = (kind: number): boolean => kind >= PK_T2 && kind <= PK_RELIC;
export { PK_HIDE, PK_ORE, PK_TIMBER };
