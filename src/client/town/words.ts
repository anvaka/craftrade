// Fixed words and small tables the town pages share. Sentence case, dry,
// practical (docs/DESIGN.md 7.3).

import { BASE_NOVEL_PER_DAY, type CharacterId, type Feature, type StationId } from '../../shared/protocol.ts';
import type { RawId } from '../../shared/vocab.ts';
import { CHARACTER } from '../../sim/data/characters.ts';

export const CHARACTER_ORDER: CharacterId[] = ['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk'];

/** Runs that must be finished before each character will head out. Mirrors charactersFor in server/config.ts. */
export const CHARACTER_AT: Record<CharacterId, number> = { greenhorn: 0, sawyer: 2, smith: 6, trapper: 7, tinker: 8, clerk: 9 };

export const characterName = (id: CharacterId): string => CHARACTER[id]?.name ?? id;
export const characterTwist = (id: CharacterId): string => CHARACTER[id]?.twist ?? '';

export const RAW_NAME: Record<RawId, string> = { timber: 'Timber', ore: 'Ore', hide: 'Hide' };

export const STATION_ORDER: StationId[] = ['sawmill', 'smelter', 'tannery', 'assay'];
export const STATION_NAME: Record<StationId, string> = { sawmill: 'Sawmill', smelter: 'Smelter', tannery: 'Tannery', assay: 'Assay office' };
export const STATION_TOP_TIER = 5;
const NOVEL_PER_ASSAY_TIER = 5;

/** What a station does at a tier. Tier 1 is the bare station. */
export function stationDoes(id: StationId, t: number): string {
  if (id === 'assay') return `${BASE_NOVEL_PER_DAY + NOVEL_PER_ASSAY_TIER * (t - 1)} untried pairs a day`;
  const [node, raw] = id === 'sawmill' ? ['tree', 'timber'] : id === 'smelter' ? ['seam', 'ore'] : ['carcass', 'hide'];
  return t <= 1 ? `No extra ${raw}` : `+${t - 1} ${raw} from every ${node}`;
}

export const FEATURE_TAB: Record<Feature, string> = { workshop: 'Workshop', market: 'Market', daily: 'Daily', town: 'Town' };

/** Said once, in one line, on the homecoming page. */
export const FEATURE_OPENED: Record<Feature, string> = {
  workshop: 'The workshop is open. Two stash items go on the anvil and one new item comes off.',
  market: 'The market is open. The Factor trades raws for marks, and players post items at a price.',
  daily: 'The daily clearing is open. Eight waves, the same for everyone, one scored attempt a day.',
  town: 'The town project is open. Raws you give raise a station, which pays more raws on every run.',
};

export const CONTROLS = 'You only move: WASD or the arrow keys, or drag anywhere on a touch screen. Weapons fire on their own.';
