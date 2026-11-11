// Titles: earned facts a player may wear beside their name. None can be
// bought. The server decides when one is earned (server/almanac.ts); this
// file only names them, for both halves.

export interface TitleDef {
  id: string;
  /** Shown after the name: "Carter 412, fifth hazard". Lower case, no full stop. */
  name: string;
  /** How it is earned, as one sentence. */
  how: string;
  /** True if only the first player in the world to do it gets it. */
  worldFirst?: true;
}

export const TITLES: readonly TitleDef[] = [
  { id: 'tenruns', name: 'ten runs home', how: 'Bring ten runs home.' },
  { id: 'tenwins', name: 'ten wins', how: 'Win ten runs.' },
  { id: 'allhands', name: 'won with every hand', how: 'Win with all six characters.' },
  { id: 'hazard3', name: 'third hazard', how: 'Win at hazard 3 with any character.' },
  { id: 'hazard5', name: 'fifth hazard', how: 'Win at hazard 5 with any character.' },
  { id: 'ladder', name: 'the whole ladder', how: 'Win at every hazard with every character.' },
  { id: 'pairs100', name: 'a hundred pairs', how: 'Fuse 100 different pairs of authored items.' },
  { id: 'firstpairs100', name: 'first to fuse 100 pairs', how: 'Be the first in the world to fuse 100 different pairs of authored items.', worldFirst: true },
  { id: 'pairsall', name: 'the full book', how: 'Fuse every pair of authored items.' },
  { id: 'finder25', name: 'twenty-five finds', how: 'Make 25 finds that count.' },
  { id: 'catalogue', name: 'every item carried', how: 'Carry every authored item home at least once.' },
  { id: 'bestiary', name: 'met everything', how: 'Kill every kind of enemy.' },
  { id: 'giver', name: 'gave a thousand', how: 'Give 1,000 raws to the town.' },
  { id: 'relic', name: 'brought a relic home', how: 'Find a relic.' },
  { id: 'daily30', name: 'thirty dailies', how: 'Play the daily clearing on 30 days.' },
];

export const TITLE: Record<string, TitleDef> = Object.assign(Object.create(null), Object.fromEntries(TITLES.map((t) => [t.id, t])));

/** "Carter 412, fifth hazard", or just the name. */
export const nameWithTitle = (name: string, title: string | undefined | null): string =>
  title && TITLE[title] ? `${name}, ${TITLE[title].name}` : name;
