// The town: everything that persists between expeditions. Saved in localStorage.
import {
  ATOMS, BAG_TYPES, CARDS, CFG, CODEX_RANKS, FAMS, FAM_CAP, FORM, KITS, MATS, NODE_MAT, PATTERNS, PERKS, SCHEMATICS, SKILLS, SKILL_CAP,
  STARTER_RECIPES, STATION_COST, STATION_T2, POOL_UNLOCK, poolName, TOOLS, WEAPONS, brewKey, skillXpFor, weekMutators, weekNumber,
  type AtomId, type Brew, type BrewForm, type Fam, type Gear, type GearBag, type GearTool, type GearWeapon, type Ground, type Mat,
  type SchemSource, type Skill, type StationId,
} from './data';
import type { Feat } from './game';
import { ALL_FEATS, newRun, type RunState } from './run';

export interface Lvl {
  lvl: number;
  xp: number;
}
export interface Loadout {
  kit: string;
  weapons: number[]; // gear uids
  tool: number;
  bag: number;
  charms: string[]; // brew keys
  oil: string | null;
  flasks: string[];
  recipes: string[];
  ground: Ground;
  keyLevel: number;
}
export interface Profile {
  v: number;
  uid: number;
  coin: number;
  bank: Record<string, number>;
  gear: Gear[];
  brews: Record<string, number>;
  stations: Record<StationId, number>;
  skills: Record<Skill, Lvl>;
  fams: Record<Fam, Lvl>;
  standing: { lvl: number; xp: number; pending: number; cards: Record<string, number>; offer: string[] | null };
  codex: string[]; // schematics learned or used at least once
  schematics: Record<string, number>; // unlearned copies in storage
  fragments: Record<string, number>;
  book: Record<string, AtomId[]>; // reagent effects discovered so far
  tried: string[]; // reagent pairs that shared nothing
  key: number;
  loadout: Loadout;
  week: { n: number; runs: number; gathered: Record<string, number>; claimed: boolean; crafts: number; elites: number; taken?: string | { id: string; got: string } }; // taken: which vault option was claimed and what it gave (a plain label in older saves)
  kitBest: Record<string, number>; // highest danger fully cleared with each kit
  records: { haul: number; kills: number };
  race: { n: number; waves: number; time: number }; // this week's best in the seeded race
  stats: { runs: number; clears: number; deaths: number; bestWave: number };
  bagTypes: string[];
  guided: boolean | null; // null: not asked yet
  sessions: number;
  run: RunState | null;
}

const KEY = 'craftworld.save.v2';
let persist = true;
/** False in demo and screenshot modes: nothing is written, neither the save nor the play log. */
export const persisting = (): boolean => persist;
export function noPersist(): void {
  persist = false;
}
const lvl = (): Lvl => ({ lvl: 1, xp: 0 });

export function newProfile(): Profile {
  const p: Profile = {
    v: 2, uid: 5, coin: 40, bank: {},
    gear: [
      { kind: 'weapon', uid: 1, fam: 'blade', name: 'Rusty sword', gs: 200, perks: [] },
      { kind: 'weapon', uid: 2, fam: 'bow', name: 'Bent bow', gs: 200, perks: [] },
      { kind: 'tool', uid: 3, node: 'ore', name: 'Worn pickaxe', tier: 1 },
      { kind: 'bag', uid: 4, type: 'sack', name: 'Rough sack', comfort: 40 },
    ],
    brews: {}, stations: { forge: 1, workshop: 1, apothecary: 1 },
    skills: Object.fromEntries(SKILLS.map((s) => [s, lvl()])) as Record<Skill, Lvl>,
    fams: Object.fromEntries(FAMS.map((f) => [f, lvl()])) as Record<Fam, Lvl>,
    standing: { lvl: 1, xp: 0, pending: 0, cards: {}, offer: null },
    codex: [], schematics: {}, fragments: {}, book: {}, tried: [], key: 1,
    loadout: { kit: 'wayfarer', weapons: [1, 2], tool: 3, bag: 4, charms: [], oil: null, flasks: [], recipes: [...STARTER_RECIPES], ground: 'quarry', keyLevel: 1 },
    week: { n: weekNumber(), runs: 0, gathered: {}, claimed: false, crafts: 0, elites: 0 },
    kitBest: {}, records: { haul: 0, kills: 0 }, race: { n: weekNumber(), waves: 0, time: 0 },
    stats: { runs: 0, clears: 0, deaths: 0, bestWave: 0 }, bagTypes: ['sack'], guided: null, sessions: 0, run: null,
  };
  return p;
}

export function load(): Profile {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) {
      const fresh = newProfile();
      const p = { ...fresh, ...(JSON.parse(raw) as Profile) }; // fields added since the save was written get their defaults
      p.week = { ...fresh.week, ...p.week };
      if (p.v === 2) {
        rollWeek(p);
        return p;
      }
    }
  } catch {
    /* a broken save starts fresh */
  }
  return newProfile();
}
export function save(p: Profile): void {
  try {
    if (persist && typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage may be unavailable; the game still runs */
  }
}
export function wipe(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
}
export function rollWeek(p: Profile): void {
  if (p.week.n !== weekNumber()) p.week = { n: weekNumber(), runs: 0, gathered: {}, claimed: false, crafts: 0, elites: 0 };
  if (p.race.n !== weekNumber()) p.race = { n: weekNumber(), waves: 0, time: 0 };
}

// ----------------------------------------------------------------- lookups

export const gearBy = (p: Profile, uid: number) => p.gear.find((g) => g.uid === uid);
export const weaponsOf = (p: Profile) => p.gear.filter((g): g is GearWeapon => g.kind === 'weapon');
export const toolsOf = (p: Profile) => p.gear.filter((g): g is GearTool => g.kind === 'tool');
export const bagsOf = (p: Profile) => p.gear.filter((g): g is GearBag => g.kind === 'bag');
export const codexRank = (p: Profile) => CODEX_RANKS.filter((n) => p.codex.length >= n).length;
export function knownRecipes(p: Profile): string[] {
  return [...STARTER_RECIPES, ...p.codex.filter((id) => SCHEMATICS[id]?.kind === 'recipe').map((id) => SCHEMATICS[id].ref)];
}
export function masteryPoints(p: Profile): number {
  let n = 0;
  for (const f of FAMS) n += p.fams[f].lvl - 1;
  for (const s of SKILLS) n += p.skills[s].lvl - 1;
  return n + p.bagTypes.length * 2 + codexRank(p) * 3;
}
export const masteryRank = (p: Profile) => Math.floor(masteryPoints(p) / 8);
export const recipeSlots = (p: Profile) => 8 + (p.standing.cards.recipes ?? 0);
export const flaskSlots = (p: Profile) => 2 + (p.standing.cards.belt ?? 0);
export const chosenPerks = (p: Profile) => (codexRank(p) >= 2 ? 2 : 1);
export function feeMul(p: Profile, station: StationId): number {
  const t = p.stations[station];
  return Math.max(0.2, 1 - 0.15 * (p.standing.cards.fees ?? 0) - (station === 'forge' ? (t >= 2 ? 0.1 : 0) + (t >= 4 ? 0.1 : 0) : 0));
}
export function featFor(p: Profile): Feat {
  if (!p.guided) return ALL_FEATS;
  const s = p.sessions; // sessions already played
  // Heat and rich veins are the hook, so they are on from the first expedition.
  return { dodge: true, loss: s >= 1, gates: s >= 1, ability: s >= 1, craft: s >= 2, routes: s >= 2, heat: true, rich: true, schem: s >= 2 };
}
export const GUIDE_STEPS = 3;
export const GUIDE_TEXT = [
  'First expedition: three waves, then a boss wave, and nothing is lost if you fall. Weapons fire on their own. Hold the heavy swing on a node to mine it; every strike raises heat, heat brings more enemies and makes veins yield more, and it cools while you leave the ore alone. Gold veins at the edges open only in the swell.',
  'Second expedition: the full twelve waves, and your aimed ability. After each boss you choose to extract with the bag or push on. Fall, and most of the bag is lost.',
  'Third expedition: one camp craft at every camp, a choice of ground before each wave, shrines, schematics and the key that raises the danger. Everything is now open.',
];

// ---------------------------------------------------------------- spending

export function has(p: Profile, cost: Record<string, number>, coin = 0): boolean {
  return p.coin >= coin && Object.entries(cost).every(([id, n]) => (p.bank[id] ?? 0) >= n);
}
function pay(p: Profile, cost: Record<string, number>, coin = 0): void {
  p.coin -= coin;
  for (const [id, n] of Object.entries(cost)) p.bank[id] -= n;
}
export function costText(p: Profile, cost: Record<string, number>, coin = 0): string {
  const parts = Object.entries(cost).map(([id, n]) => `<span class="${(p.bank[id] ?? 0) >= n ? '' : 'short'}">${n} ${MATS[id].name.toLowerCase()}</span>`);
  if (coin > 0) parts.push(`<span class="${p.coin >= coin ? '' : 'short'}">${coin} coin</span>`);
  return parts.join(', ');
}
function gain(l: Lvl, xp: number, cap: number, need: (lvl: number) => number): number {
  let ups = 0;
  l.xp += xp;
  while (l.lvl < cap && l.xp >= need(l.lvl)) {
    l.xp -= need(l.lvl);
    l.lvl++;
    ups++;
  }
  if (l.lvl >= cap) l.xp = 0;
  return ups;
}
export const famXpFor = (l: number) => 30 + l * 25;
export const standingFor = (l: number) => 60 + l * 40;

// ---------------------------------------------------------------- crafting

/** Station tier needed to work a material grade. */
export const gradeStation = (tier: number) => tier * 2 - 1;
const GRADE = ['', 'Iron', 'Skysteel', 'Sunmetal'];

/** The gear score a forged weapon of this grade can roll. Smithing raises the floor. */
export function gsRange(p: Profile, tier: number): { min: number; lo: number; hi: number } {
  const min = 200 + (tier - 1) * 100;
  return { min, lo: Math.min(min + 100, min + p.skills.smithing.lvl * 2), hi: min + 100 };
}
export const weaponFee = (p: Profile, tier: number) => Math.round(10 * tier * feeMul(p, 'forge'));
export const toolFee = (p: Profile, tier: number) => Math.round(8 * tier * feeMul(p, 'forge'));
export const bagFee = (p: Profile, type: string) => Math.round(12 * BAG_TYPES[type].station * feeMul(p, 'workshop'));
export const patternFee = (p: Profile, station: StationId) => Math.round(30 * feeMul(p, station));
export function weaponCost(fam: Fam, tier: number): Record<string, number> {
  // the first grade needs no wood, so one trip to the quarry can pay for a weapon
  const c: Record<string, number> = { [NODE_MAT.ore[tier - 1]]: 12, [WEAPONS[fam].harvest]: 4 };
  if (tier > 1) c[NODE_MAT.wood[tier - 1]] = 6;
  return c;
}
export function craftWeapon(p: Profile, fam: Fam, tier: number, perks: string[]): string | GearWeapon {
  if (p.stations.forge < gradeStation(tier)) return `The forge must be tier ${gradeStation(tier)}.`;
  const cost = weaponCost(fam, tier);
  const coin = weaponFee(p, tier);
  if (!has(p, cost, coin)) return 'Not enough materials or coin.';
  const chosen = [...new Set(perks)].slice(0, chosenPerks(p)).filter((x) => PERKS[x]);
  if (chosen.length < chosenPerks(p)) return `Choose ${chosenPerks(p)} perk${chosenPerks(p) > 1 ? 's' : ''}.`;
  pay(p, cost, coin);
  const rest = Object.keys(PERKS).filter((x) => !chosen.includes(x));
  const { lo, hi } = gsRange(p, tier);
  const rolled = rest[Math.floor(Math.random() * rest.length)];
  const g: GearWeapon = {
    kind: 'weapon', uid: p.uid++, fam, name: `${GRADE[tier]} ${WEAPONS[fam].name.toLowerCase()}`,
    gs: Math.round(lo + Math.random() * (hi - lo)), perks: [...chosen, rolled], rolled, isNew: true, grade: tier, roll: [lo, hi],
  };
  p.gear.push(g);
  p.week.crafts++;
  gain(p.skills.smithing, 20 * tier, SKILL_CAP, skillXpFor);
  return g;
}
export function toolCost(node: GearTool['node'], tier: number): Record<string, number> {
  const c: Record<string, number> = { [NODE_MAT.ore[tier - 1]]: 8 };
  if (tier > 1) c[NODE_MAT.wood[tier - 1]] = 6;
  if (node === 'knife') c.hide = 6;
  return c;
}
export function craftTool(p: Profile, node: GearTool['node'], tier: number): string | GearTool {
  if (p.stations.forge < gradeStation(tier)) return `The forge must be tier ${gradeStation(tier)}.`;
  const cost = toolCost(node, tier);
  const coin = Math.round(8 * tier * feeMul(p, 'forge'));
  if (!has(p, cost, coin)) return 'Not enough materials or coin.';
  pay(p, cost, coin);
  const g: GearTool = { kind: 'tool', uid: p.uid++, node, name: `${GRADE[tier]} ${TOOLS[node].name.toLowerCase()}`, tier, isNew: true };
  p.gear.push(g);
  p.week.crafts++;
  gain(p.skills.smithing, 14 * tier, SKILL_CAP, skillXpFor);
  return g;
}
export function craftBag(p: Profile, type: string, burden: Mat['cat'] | null): string | GearBag {
  const def = BAG_TYPES[type];
  if (!def) return 'Unknown bag.';
  if (p.stations.workshop < def.station) return `The workshop must be tier ${def.station}.`;
  const coin = Math.round(12 * def.station * feeMul(p, 'workshop'));
  if (!has(p, def.cost, coin)) return 'Not enough materials or coin.';
  pay(p, def.cost, coin);
  const cats: Mat['cat'][] = ['ore', 'wood', 'herb'];
  const b = p.stations.workshop >= 4 && burden ? burden : cats[Math.floor(Math.random() * 3)];
  const g: GearBag = { kind: 'bag', uid: p.uid++, type, name: def.name, comfort: def.comfort + p.skills.outfitting.lvl, burden: b, isNew: true };
  p.gear.push(g);
  p.week.crafts++;
  if (!p.bagTypes.includes(type)) p.bagTypes.push(type);
  gain(p.skills.outfitting, 25 * def.station, SKILL_CAP, skillXpFor);
  return g;
}
export function usePattern(p: Profile, schemId: string): string | Gear {
  const s = SCHEMATICS[schemId];
  const pat = s && PATTERNS[s.ref];
  if (!pat || !(p.schematics[schemId] > 0)) return 'You do not hold that pattern.';
  if (p.stations[pat.station] < 2) return `The ${pat.station} must be tier 2.`;
  const coin = Math.round(30 * feeMul(p, pat.station));
  if (!has(p, pat.cost, coin)) return 'Not enough materials or coin.';
  pay(p, pat.cost, coin);
  p.schematics[schemId]--;
  if (!p.codex.includes(schemId)) p.codex.push(schemId);
  const skill = pat.station === 'forge' ? p.skills.smithing : p.skills.outfitting;
  const lo = 380 + skill.lvl * 4;
  const g = pat.make(p.uid++, Math.round(lo + Math.random() * 40));
  g.isNew = true;
  if (g.kind === 'weapon') g.roll = [lo, lo + 40];
  p.gear.push(g);
  p.week.crafts++; // a named item is a thing made this week, like any other
  gain(skill, 60, SKILL_CAP, skillXpFor);
  return g;
}
export function scrapGear(p: Profile, uid: number): boolean {
  const l = p.loadout;
  if (l.weapons.includes(uid) || l.tool === uid || l.bag === uid || gearBy(p, uid)?.locked) return false;
  p.gear = p.gear.filter((g) => g.uid !== uid);
  p.coin += 2;
  return true;
}
export function stationNeeds(p: Profile, id: StationId): { tier: number; cost: Record<string, number>; coin: number; blueprint: string | null } | null {
  const tier = p.stations[id] + 1;
  if (tier > 5) return null;
  return { tier, cost: tier === 2 ? STATION_T2[id] : STATION_COST[tier], coin: Math.round(15 * tier * feeMul(p, id)), blueprint: tier >= 3 ? `b-${id}-${tier}` : null };
}
export function upgradeStation(p: Profile, id: StationId): string | null {
  const n = stationNeeds(p, id);
  if (!n) return 'Already at the top tier.';
  if (n.blueprint && !(p.schematics[n.blueprint] > 0)) return `Needs ${SCHEMATICS[n.blueprint].name}.`;
  if (!has(p, n.cost, n.coin)) return 'Not enough materials or coin.';
  pay(p, n.cost, n.coin);
  if (n.blueprint) {
    p.schematics[n.blueprint]--;
    if (!p.codex.includes(n.blueprint)) p.codex.push(n.blueprint);
  }
  p.stations[id] = n.tier;
  return null;
}

// ----------------------------------------------------------------- alchemy

export const REAGENTS = Object.values(MATS).filter((m) => m.fx);
export interface BrewResult {
  ok: boolean;
  text: string;
}
export function brew(p: Profile, a: string, b: string, form: BrewForm): BrewResult {
  const ma = MATS[a];
  const mb = MATS[b];
  if (!ma?.fx || !mb?.fx || a === b) return { ok: false, text: 'Pick two different reagents.' };
  if (p.stations.apothecary < FORM[form].station) return { ok: false, text: `The apothecary must be tier ${FORM[form].station}.` };
  if (!has(p, { [a]: 2, [b]: 2 })) return { ok: false, text: 'You need two of each reagent.' };
  pay(p, { [a]: 2, [b]: 2 });
  const shared = ma.fx.filter((x) => mb.fx!.includes(x)).slice(0, 3);
  if (shared.length === 0) {
    const key = [a, b].sort().join('+');
    if (!p.tried.includes(key)) p.tried.push(key);
    gain(p.skills.alchemy, 3, SKILL_CAP, skillXpFor);
    return { ok: false, text: `${ma.name} and ${mb.name} share nothing. The brew is inert sludge.` };
  }
  for (const id of [a, b]) {
    const known = (p.book[id] ??= []);
    for (const x of shared) if (!known.includes(x)) known.push(x);
  }
  const out: Brew = { form, atoms: shared };
  gain(p.skills.alchemy, 12, SKILL_CAP, skillXpFor);
  p.week.crafts++;
  // alchemy skill: a chance of one more from the same batch
  const n = (p.stations.apothecary >= 5 ? 3 : p.stations.apothecary >= 4 ? 2 : 1) + (Math.random() < (p.skills.alchemy.lvl - 1) * 0.04 ? 1 : 0);
  p.brews[brewKey(out)] = (p.brews[brewKey(out)] ?? 0) + n;
  return { ok: true, text: `Brewed ${n} × ${[...shared].sort().map((x) => ATOMS[x].name).join(' + ')} ${FORM[form].name.toLowerCase()}.` }; // atoms in the order of the brew's key, as its tile names them
}
/** True if the player has already seen these two share nothing. */
export const knownInert = (p: Profile, a: string, b: string) => p.tried.includes([a, b].sort().join('+'));
export function parseBrew(key: string): Brew {
  const [form, atoms] = key.split(':');
  return { form: form as BrewForm, atoms: atoms.split('+') as AtomId[] };
}
/** Brews in storage that are not already packed in the loadout. */
export function brewsFree(p: Profile, key: string): number {
  const l = p.loadout;
  const used = l.charms.filter((k) => k === key).length + l.flasks.filter((k) => k === key).length + (l.oil === key ? 1 : 0);
  return (p.brews[key] ?? 0) - used;
}

// -------------------------------------------------------------- schematics

export function learn(p: Profile, id: string): string | null {
  const s = SCHEMATICS[id];
  if (!s || !(p.schematics[id] > 0)) return 'You do not hold that schematic.';
  if (s.kind !== 'recipe') return 'Patterns and blueprints are used at their station.';
  if (p.codex.includes(id)) return 'Already learned. Break it into a fragment.';
  p.schematics[id]--;
  p.codex.push(id);
  // a learned recipe goes straight into the notebook while there is room
  if (p.loadout.recipes.length < recipeSlots(p) && !p.loadout.recipes.includes(s.ref)) p.loadout.recipes.push(s.ref);
  return null;
}
export function breakDown(p: Profile, id: string): boolean {
  if (!(p.schematics[id] > 0)) return false;
  p.schematics[id]--;
  const src = SCHEMATICS[id].source;
  p.fragments[src] = (p.fragments[src] ?? 0) + 1;
  return true;
}
export function redeem(p: Profile, src: SchemSource): string | null {
  if ((p.fragments[src] ?? 0) < 4) return null;
  const all = Object.values(SCHEMATICS).filter((s) => s.source === src);
  const missing = all.filter((s) => !p.codex.includes(s.id) && !(p.schematics[s.id] > 0));
  const pool = missing.length ? missing : all;
  const s = pool[Math.floor(Math.random() * pool.length)];
  p.fragments[src] -= 4;
  p.schematics[s.id] = (p.schematics[s.id] ?? 0) + 1;
  return s.id;
}

// ---------------------------------------------------------------- standing

export function cardOffer(p: Profile): string[] | null {
  const st = p.standing;
  if (st.pending <= 0) return null;
  if (!st.offer) {
    const pool = CARDS.filter((c) => (st.cards[c.id] ?? 0) < c.max).map((c) => c.id);
    if (!pool.length) {
      st.pending = 0;
      return null;
    }
    st.offer = [];
    while (st.offer.length < 3 && pool.length) st.offer.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return st.offer;
}
export function pickCard(p: Profile, id: string): void {
  const st = p.standing;
  if (!st.offer?.includes(id)) return;
  st.cards[id] = (st.cards[id] ?? 0) + 1;
  st.pending--;
  st.offer = null;
}

// ------------------------------------------------------------------- vault

export interface VaultOption {
  id: string; // stable for the week, unlike the label, which follows the counts
  row: string;
  label: string;
  got: string; // what it gives right now, in a few words
  need: number;
  grant: (p: Profile) => void;
}
export function vaultOptions(p: Profile): VaultOption[] {
  const top = Object.entries(p.week.gathered).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'iron';
  const extra = (p.standing.cards.vault ?? 0) > 0;
  const craftCoin = Math.min(140, 40 + 10 * p.week.crafts);
  const frags = Math.min(4, 2 + Math.floor(p.week.elites / 2));
  const add = (id: string, n: number) => (q: Profile) => void (q.bank[id] = (q.bank[id] ?? 0) + n);
  const opts: VaultOption[] = [
    { id: 'gathered', row: 'Gathered', need: 1, got: `25 ${MATS[top].name.toLowerCase()}`, label: `25 ${MATS[top].name.toLowerCase()} (what you gathered most this week)`, grant: add(top, 25) },
    { id: 'crafted', row: 'Crafted', need: 4, got: `${craftCoin} coin`, label: `${craftCoin} coin (40, and 10 for each of the ${p.week.crafts} things you made this week, up to 140)`, grant: (q) => void (q.coin += craftCoin) },
    { id: 'fought', row: 'Fought', need: 8, got: `${frags} fragments from named elites`, label: `${frags} fragments from named elites (2, and 1 for every two of the ${p.week.elites} you brought down this week, up to 4)`, grant: (q) => void (q.fragments.elite = (q.fragments.elite ?? 0) + frags) },
  ];
  if (extra) {
    opts.push({ id: 'gathered2', row: 'Gathered', need: 1, got: '15 skysteel ore', label: '15 skysteel ore', grant: add('skysteel', 15) });
    opts.push({ id: 'crafted2', row: 'Crafted', need: 4, got: '8 each of ash, frost shard and sinew', label: '8 each of ash, frost shard and sinew', grant: (q) => ['ash', 'shard', 'sinew'].forEach((id) => add(id, 8)(q)) });
    opts.push({ id: 'fought2', row: 'Fought', need: 8, got: 'two fragments from shrines', label: 'Two fragments from shrines', grant: (q) => void (q.fragments.shrine = (q.fragments.shrine ?? 0) + 2) });
  }
  return opts;
}
export function claimVault(p: Profile, i: number): boolean {
  const o = vaultOptions(p)[i];
  if (!o || p.week.claimed || p.week.runs < o.need) return false;
  o.grant(p);
  p.week.claimed = true;
  p.week.taken = { id: o.id, got: o.got };
  return true;
}

// ----------------------------------------------------------- expeditions

export function loadoutProblem(p: Profile): string | null {
  const l = p.loadout;
  if (l.weapons.length !== 2 || l.weapons.some((u) => gearBy(p, u)?.kind !== 'weapon')) return 'Pick two weapons.';
  if (gearBy(p, l.bag)?.kind !== 'bag') return 'Pick a bag.';
  const kit = KITS.find((k) => k.id === l.kit);
  if (!kit || kit.rank > masteryRank(p)) return 'That kit is not unlocked.';
  if (l.keyLevel < 1 || l.keyLevel > p.key) return 'Key level out of range.';
  return null;
}
export function startRun(p: Profile, race = false): RunState {
  if (race) return startRace(p);
  const l = p.loadout;
  const known = knownRecipes(p);
  const take = (key: string): Brew | null => {
    if (!(p.brews[key] > 0)) return null;
    p.brews[key]--;
    return parseBrew(key);
  };
  const feat = featFor(p);
  const charms = l.charms.map(take).filter((b): b is Brew => !!b).slice(0, 2);
  const flasks = l.flasks.map(take).filter((b): b is Brew => !!b).slice(0, flaskSlots(p));
  const oil = l.oil ? take(l.oil) : null;
  // keep no more copies packed than are left in storage
  const stillOwned = (keys: string[]) => {
    const left: Record<string, number> = {};
    return keys.filter((k) => (left[k] = (left[k] ?? p.brews[k] ?? 0) - 1) >= 0);
  };
  l.charms = stillOwned(l.charms);
  l.flasks = stillOwned(l.flasks);
  if (l.oil && !(p.brews[l.oil] > 0)) l.oil = null;
  const tool = gearBy(p, l.tool);
  const sk = p.skills;
  const run = newRun({
    seed: (Math.random() * 2 ** 31) | 0, keyLevel: feat.heat ? l.keyLevel : 1, mutators: feat.schem ? weekMutators(weekNumber()) : [],
    kit: l.kit, feat, race: false,
    weapons: l.weapons.map((u) => gearBy(p, u) as GearWeapon), tool: tool?.kind === 'tool' ? tool : null, bag: gearBy(p, l.bag) as GearBag,
    charms, oil, flasks, recipes: l.recipes.filter((r) => known.includes(r)).slice(0, recipeSlots(p)), ground: l.ground,
    cards: p.standing.cards, poolLvl: p.standing.lvl,
    yieldBonus: { ore: (sk.mining.lvl - 1) * 0.015, wood: (sk.logging.lvl - 1) * 0.015, herb: (sk.harvesting.lvl - 1) * 0.015 },
  });
  run.perkMods.push(['drops', (sk.skinning.lvl - 1) * 0.02]);
  run.brought = { weapons: [...l.weapons], tool: tool?.kind === 'tool' ? tool.uid : null, bag: l.bag };
  p.stats.runs++;
  p.run = run;
  return run;
}

/** Node materials that must be banked for the key to rise from this level. Mining is part of the climb. */
export const keyQuota = (level: number) => 60 + 15 * (level - 1);
export const nodeUnits = (rec: Record<string, number>) =>
  Object.entries(rec).reduce((a, [id, n]) => a + (['ore', 'wood', 'herb'].includes(MATS[id].cat) ? n : 0), 0);

/** The seeded weekly race: the same waves, shops and starter kit for everyone, no town bonuses, nothing banked. */
function startRace(p: Profile): RunState {
  const base = newProfile();
  const run = newRun({
    seed: weekNumber() * 7919 + 13, keyLevel: 3, mutators: weekMutators(weekNumber()), kit: 'wayfarer', feat: ALL_FEATS, race: true,
    weapons: weaponsOf(base), tool: toolsOf(base)[0], bag: bagsOf(base)[0], charms: [], oil: null, flasks: [],
    recipes: [...STARTER_RECIPES, 'evo-blade', 'evo-bow'], ground: 'quarry', cards: {}, poolLvl: 99, yieldBonus: { ore: 0, wood: 0, herb: 0 },
  });
  p.run = run;
  return run;
}

/** Surplus has two uses: the quartermaster pays a little coin, or it goes to town projects for standing. */
export const sellValue = (id: string) => (MATS[id].cat === 'part' ? 0 : MATS[id].tier);
export function sellMat(p: Profile, id: string, n: number): boolean {
  if ((p.bank[id] ?? 0) < n || sellValue(id) <= 0) return false;
  p.bank[id] -= n;
  p.coin += Math.floor((n * sellValue(id)) / 2); // rounded down, so selling one at a time pays no more
  return true;
}
export function donate(p: Profile, id: string, n: number): boolean {
  if ((p.bank[id] ?? 0) < n || sellValue(id) <= 0) return false;
  p.bank[id] -= n;
  addStanding(p, Math.floor((n * sellValue(id)) / 2));
  return true;
}
function addStanding(p: Profile, xp: number): { ups: number; unlocked: string[] } {
  const st = p.standing;
  const unlocked: string[] = [];
  let ups = 0;
  st.xp += xp;
  while (st.xp >= standingFor(st.lvl)) {
    st.xp -= standingFor(st.lvl);
    st.lvl++;
    st.pending++;
    ups++;
    for (const [key, lvl] of Object.entries(POOL_UNLOCK)) if (lvl === st.lvl) unlocked.push(poolName(key));
  }
  return { ups, unlocked };
}

export interface Summary {
  outcome: 'died' | 'extracted' | 'cleared';
  waves: number;
  kept: Record<string, number>;
  lost: Record<string, number>;
  schemKept: string[];
  schemLost: number;
  schemGone: string[];
  coin: number;
  lines: string[]; // what the session paid and why
  keyUp: boolean;
  keyWhy: string; // why the key did or did not rise
  race: boolean;
}
export function finishRun(p: Profile, run: RunState): Summary {
  const outcome = run.outcome ?? 'died';
  const waves = run.totals.wavesCleared;
  if (run.race) {
    // the race pays nothing and banks nothing: it is a record to beat
    rollWeek(p);
    const time = Math.round(run.totals.time);
    const better = waves > p.race.waves || (waves === p.race.waves && waves > 0 && (p.race.time === 0 || time < p.race.time));
    if (better) p.race = { n: weekNumber(), waves, time };
    p.run = null;
    return {
      outcome, waves, kept: {}, lost: {}, schemKept: [], schemLost: 0, schemGone: [], coin: 0, keyUp: false, keyWhy: '', race: true,
      lines: [better ? `New best this week: ${waves} waves in ${time}s.` : `This week's best stands: ${p.race.waves} waves in ${p.race.time}s.`],
    };
  }
  const frac = waves / CFG.waveDur.length;
  const loses = outcome === 'died' && run.feat.loss;
  const keep = loses ? Math.min(1, CFG.keptOnDeath + 0.08 * (p.standing.cards.keep ?? 0)) : 1;
  const kept: Record<string, number> = {};
  const lost: Record<string, number> = {};
  for (const [id, n] of Object.entries(run.bagMats)) {
    if (n <= 0) continue;
    const k = keep >= 1 ? n : Math.floor(n * keep + Math.random()); // the same share of every stack, small or large
    if (k > 0) kept[id] = k;
    if (n - k > 0) lost[id] = n - k;
    p.bank[id] = (p.bank[id] ?? 0) + k;
  }
  const schemKept: string[] = [];
  const schemGone: string[] = [];
  for (const id of run.bagSchem) (Math.random() < keep ? schemKept : schemGone).push(id);
  // The guided start moves on only when the expedition reached the first boss gate: a fall in wave 2 repeats the step.
  if (!p.guided || p.sessions >= GUIDE_STEPS || waves >= CFG.wavesPerSegment) p.sessions++;
  for (const id of schemKept) p.schematics[id] = (p.schematics[id] ?? 0) + 1;

  const lines: string[] = [];
  const coin = Math.round((waves * 4 + (outcome === 'cleared' ? 40 : 0)) * (1 + 0.25 * (run.keyLevel - 1))); // danger pays
  p.coin += coin;

  // every session pays, in proportion to waves cleared, whether or not it ended in death
  const pay = Math.max(0.1, frac);
  const g = run.totals.gathered;
  const sum = (cat: Mat['cat']) => Object.entries(g).reduce((a, [id, n]) => a + (MATS[id].cat === cat ? n : 0), 0);
  const skillGain: [Skill, number][] = [['mining', sum('ore')], ['logging', sum('wood')], ['harvesting', sum('herb')], ['skinning', sum('creature') * 1.5]];
  for (const [s, units] of skillGain) {
    if (units <= 0) continue;
    const ups = gain(p.skills[s], units * pay, SKILL_CAP, skillXpFor);
    lines.push(`${s[0].toUpperCase()}${s.slice(1)}: +${Math.round(units * pay)} xp${ups ? `, now level ${p.skills[s].lvl}` : ''}`);
  }
  for (const [f, kills] of Object.entries(run.totals.famKills)) {
    const ups = gain(p.fams[f as Fam], kills * 0.25 * pay, FAM_CAP, famXpFor);
    if (ups) lines.push(`${WEAPONS[f as Fam].name} mastery: now level ${p.fams[f as Fam].lvl}`);
  }
  const stand = Math.round(waves * 9 + (outcome === 'cleared' ? 40 : 0));
  const { ups, unlocked } = addStanding(p, stand);
  lines.push(`Town standing: +${stand} for ${waves} wave${waves === 1 ? '' : 's'} cleared${ups ? `, now level ${p.standing.lvl} (pick a card in town)` : ''}`);
  if (unlocked.length) lines.push(`New in the pool from now on: ${unlocked.join(', ')}.`);

  const haul = nodeUnits(kept);
  const allBosses = run.totals.bosses >= 3;
  if (outcome === 'cleared' && allBosses && run.keyLevel > (p.kitBest[run.kit] ?? 0)) {
    p.kitBest[run.kit] = run.keyLevel;
    p.standing.pending++;
    lines.push(`First clear of danger ${run.keyLevel} as ${KITS.find((k) => k.id === run.kit)!.name}: one more standing card.`);
  }
  if (haul > p.records.haul) {
    if (p.records.haul > 0) lines.push(`New best haul: ${haul} node materials banked (was ${p.records.haul}).`);
    p.records.haul = haul;
  }
  if (run.totals.kills > p.records.kills) {
    if (p.records.kills > 0) lines.push(`Most kills in one expedition: ${run.totals.kills} (was ${p.records.kills}).`);
    p.records.kills = run.totals.kills;
  }
  const quota = keyQuota(run.keyLevel);
  const atBest = run.keyLevel >= p.key && run.feat.schem;
  const keyUp = outcome === 'cleared' && atBest && allBosses && haul >= quota;
  let keyWhy = '';
  if (atBest && !keyUp) {
    const missing = [
      ...(outcome === 'cleared' ? [] : ['clear all twelve waves']),
      ...(allBosses ? [] : [`kill all three bosses (${run.totals.bosses} of 3)`]),
      ...(haul >= quota ? [] : [`bank ${quota} ore, wood or herbs (${haul} banked)`]),
    ];
    keyWhy = `The key stays at danger ${p.key}. To raise it: ${missing.join(', ')}.`;
  }
  if (keyUp) {
    p.key++;
    p.loadout.keyLevel = p.key;
  }
  rollWeek(p);
  p.week.elites += run.totals.elites; // after the week has rolled, so a run that straddles Monday counts for the new week
  if (waves >= CFG.wavesPerSegment) p.week.runs++;
  for (const [id, n] of Object.entries(kept)) if (MATS[id].cat !== 'part') p.week.gathered[id] = (p.week.gathered[id] ?? 0) + n;
  if (outcome === 'cleared') p.stats.clears++;
  if (outcome === 'died') p.stats.deaths++;
  p.stats.bestWave = Math.max(p.stats.bestWave, waves);
  p.run = null;
  return { outcome, waves, kept, lost, schemKept, schemLost: schemGone.length, schemGone, coin, lines, keyUp, keyWhy, race: false };
}
