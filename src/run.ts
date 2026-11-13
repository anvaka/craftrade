// One expedition: everything between leaving town and coming back. Plain data so it can be saved at camp.
import {
  BOSSES, CFG, ELITES, ELITE_PARTS, FAMS, LEVEL_PICKS, POOL_UNLOCK, GROUNDS, GROUND_IDS, ITEMS, ITEM_PRICE, KITS, MATS, MAX_TIER, EVOLVE_TIER, PERKS, RECIPES, SCHEMATICS, TOOLS,
  WEAPONS, WEAPON_PRICE, WILDS, CURSES, addMods, brewMods, emptyMods,
  type Brew, type Fam, type GearBag, type GearTool, type GearWeapon, type Ground, type Mat, type Mod, type Mods, type NodeKind, type Objective,
} from './data';
import type { Feat, WaveResult, WaveSpec, WeaponInst } from './game';

export interface Offer {
  kind: 'weapon' | 'item';
  fam?: Fam;
  tier: number;
  item?: string;
  price: number;
  locked: boolean;
  sold: boolean;
}
export interface Route {
  ground: Ground;
  objective: Objective;
  elite: string | null;
  shrine: { curse: string; prize: string } | null;
}
export interface Gate {
  boss: number;
  killed: boolean;
  opened: boolean;
  loot: string[];
  wildOffer: string[];
  wildDone: boolean;
  final: boolean;
}
export interface Totals {
  kills: number;
  dmgTaken: number;
  gathered: Record<string, number>;
  heatPeak: number;
  gatherTime: number;
  time: number; // seconds spent in waves
  scrap: number;
  wavesCleared: number;
  famKills: Record<string, number>;
  crafts: number;
  bosses: number;
  elites: number;
}
export interface LastWave {
  index: number;
  res: WaveResult;
  levelUps: number;
  found: string[]; // schematic ids picked up
  rest?: number; // health the rest after the wave restored
  restBarred?: boolean; // true when the rest was forbidden (Haggler, or a no-healing effect in the wave)
}
export interface RunState {
  // what the camp and tally screens remember about this wave; saved so a reload does not forget it
  memo?: { wave: number; routed: boolean; crafted: string[]; played: { wave: number; route: Route } | null };
  brought?: { weapons: number[]; tool: number | null; bag: number | null }; // gear ids this expedition left town with (for display)
  rs: number; // random state
  seed: number;
  keyLevel: number;
  mutators: string[];
  kit: string;
  feat: Feat;
  race: boolean;
  wave: number; // index of the next wave to play
  phase: 'wave' | 'tally' | 'camp' | 'gate' | 'over';
  outcome: 'died' | 'extracted' | 'cleared' | null;
  hp: number;
  heat: number;
  level: number;
  xp: number;
  picks: string[]; // level-up picks taken
  pendingPicks: number;
  pickOffer: string[];
  poolLvl: number; // town standing when the run began: sets what the shop and wild picks can offer
  scrap: number;
  weapons: WeaponInst[];
  slots: number;
  items: string[];
  wilds: string[];
  perkMods: Mod[];
  yieldBonus: Record<NodeKind, number>;
  abilities: Fam[];
  abilityIdx: number;
  toolNode: string;
  comfort: number;
  burden: Mat['cat'] | null;
  bagMats: Record<string, number>;
  bagSchem: string[];
  recipes: string[];
  charms: Brew[];
  oil: Brew | null;
  flasks: Brew[];
  flaskActive: Brew | null;
  campMods: Mod[];
  curse: string | null;
  route: Route;
  routeOptions: Route[];
  routePick: number;
  shop: Offer[];
  rerolls: number;
  craftsLeft: number;
  gate: Gate | null;
  last: LastWave | null;
  totals: Totals;
  cards: Record<string, number>;
}

export interface RunInit {
  seed: number;
  keyLevel: number;
  mutators: string[];
  kit: string;
  feat: Feat;
  race: boolean;
  weapons: GearWeapon[];
  tool: GearTool | null;
  bag: GearBag;
  charms: Brew[];
  oil: Brew | null;
  flasks: Brew[];
  recipes: string[];
  ground: Ground;
  cards: Record<string, number>;
  yieldBonus: Record<NodeKind, number>;
  poolLvl: number;
}

export const ALL_FEATS: Feat = { dodge: true, loss: true, gates: true, ability: true, craft: true, routes: true, heat: true, rich: true, schem: true };
export const WAVES = CFG.waveDur.length;
/** How many waves this expedition has: the first guided one stops at the first boss. */
export const runWaves = (run: RunState) => (run.feat.gates ? WAVES : CFG.wavesPerSegment);

export function rnd(run: RunState): number {
  run.rs = (Math.imul(run.rs, 1664525) + 1013904223) >>> 0;
  return run.rs / 4294967296;
}
const pick = <T>(run: RunState, list: T[]): T => list[Math.floor(rnd(run) * list.length)];
export const kitOf = (run: RunState) => KITS.find((k) => k.id === run.kit) ?? KITS[0];
export const isBossWave = (i: number) => i % CFG.wavesPerSegment === CFG.wavesPerSegment - 1;
export const segmentOf = (i: number) => Math.floor(i / CFG.wavesPerSegment);

export function newRun(init: RunInit): RunState {
  const kit = KITS.find((k) => k.id === init.kit) ?? KITS[0];
  const perkMods: Mod[] = [];
  for (const w of init.weapons) {
    const quality = 1 + 0.5 * Math.max(0, Math.min(1, (w.gs - 200) / 300));
    for (const p of w.perks) for (const [k, v] of PERKS[p].mods) perkMods.push([k, v * quality]);
  }
  if (init.tool) perkMods.push(...TOOLS[init.tool.node].mods(init.tool.tier));
  const run: RunState = {
    rs: init.seed >>> 0, seed: init.seed, keyLevel: init.keyLevel, mutators: init.mutators, kit: kit.id, feat: init.feat, race: init.race,
    wave: 0, phase: 'wave', outcome: null, hp: 100, heat: 0, level: 1, xp: 0, picks: [], pendingPicks: 0, pickOffer: [], poolLvl: init.poolLvl, scrap: 15 * (init.cards.scrap ?? 0),
    weapons: init.weapons.map((w) => ({ fam: w.fam, tier: 1, gs: 0.5, variant: false, evolved: false, dmg: 0, kills: 0 })),
    slots: kit.slots ?? 6, items: [], wilds: [], perkMods, yieldBonus: init.yieldBonus,
    abilities: [...new Set(init.weapons.map((w) => w.fam))], abilityIdx: 0,
    toolNode: init.tool?.node ?? '', comfort: init.bag.comfort, burden: init.bag.burden ?? null,
    bagMats: {}, bagSchem: [], recipes: init.recipes, charms: init.charms, oil: init.oil, flasks: init.flasks, flaskActive: null, campMods: [],
    curse: null, route: { ground: init.ground, objective: 'none', elite: null, shrine: null }, routeOptions: [], routePick: 0,
    shop: [], rerolls: 0, craftsLeft: 0, gate: null, last: null,
    totals: { kills: 0, dmgTaken: 0, gathered: {}, heatPeak: 0, gatherTime: 0, time: 0, scrap: 0, wavesCleared: 0, famKills: {}, crafts: 0, bosses: 0, elites: 0 },
    cards: init.cards,
  };
  run.hp = maxHp(run);
  return run;
}

// ----------------------------------------------------------------- derived

export function runMods(run: RunState): Mods {
  const m = emptyMods();
  addMods(m, kitOf(run).mods);
  addMods(m, run.perkMods);
  for (const id of run.items) addMods(m, ITEMS[id].mods);
  for (const id of run.wilds) addMods(m, WILDS.find((w) => w.id === id)!.mods);
  if (run.oil) addMods(m, brewMods(run.oil));
  for (const c of run.charms) addMods(m, brewMods(c));
  if (run.flaskActive) addMods(m, brewMods(run.flaskActive));
  addMods(m, run.campMods);
  for (const id of run.picks) addMods(m, LEVEL_PICKS.find((x) => x.id === id)!.mods);
  for (const [fam, n] of Object.entries(famCounts(run))) {
    const [c1, b1, c2, b2] = WEAPONS[fam as Fam].set;
    if (n >= c1) addMods(m, b1);
    if (n >= c2) addMods(m, b2);
  }
  if (run.mutators.includes('loud')) addMods(m, [['heatGain', 0.5], ['yield', 0.25]]);
  return m;
}
export function famCounts(run: RunState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of run.weapons) out[w.fam] = (out[w.fam] ?? 0) + w.tier; // tier points: two tier I merge without loss, but from tier II up a merge loses points (II + II = 4, one III = 3) and can drop a set bonus
  return out;
}
export function maxHp(run: RunState, m = runMods(run)): number {
  return Math.max(20, Math.round((CFG.player.hp + m.hp) * (run.curse === 'frail' ? 0.75 : 1)));
}
export function bagWeight(run: RunState, m = runMods(run)): number {
  let w = 0;
  for (const [id, n] of Object.entries(run.bagMats)) w += n * MATS[id].weight * (run.burden === MATS[id].cat ? 0.6 : 1);
  return w * Math.max(0, 1 - m.weight);
}
export const effSlots = (run: RunState) => run.slots;
export const xpNeed = (level: number) => 20 + 14 * level;

export function waveSpec(run: RunState): WaveSpec {
  const i = run.wave;
  const seg = segmentOf(i);
  const m = runMods(run);
  const L = run.keyLevel - 1;
  m.yield += CFG.key.yield * L + (run.yieldBonus[GROUNDS[run.route.ground].node] ?? 0);
  const boss = isBossWave(i) ? BOSSES[seg] : null;
  return {
    seed: (run.seed + i * 1009) >>> 0, index: i, dur: CFG.waveDur[i], ground: run.route.ground, tier: seg + 1,
    objective: boss ? 'none' : run.route.objective,
    elite: !boss && run.route.elite ? ELITES.find((e) => e.id === run.route.elite) ?? null : null,
    boss, mods: m, weapons: run.weapons, sealed: run.curse === 'bound' && run.weapons.length > 1 ? run.weapons.length - 1 : -1,
    slotPenalty: run.wilds.includes('slot') ? Math.max(0.4, 1 - 0.02 * run.weapons.length) : 1, slots: run.slots,
    abilities: run.abilities, abilityIdx: run.abilityIdx, hp: Math.min(run.hp, maxHp(run, m)), maxHp: maxHp(run, m),
    baseWeight: bagWeight(run, m), comfort: run.comfort, burden: run.burden, toolNode: run.toolNode, strike: kitOf(run).strike ?? 0,
    hpMul: (1 + CFG.key.hp * L) * (run.mutators.includes('thick') ? 1.3 : 1), dmgMul: 1 + CFG.key.dmg * L,
    rateMul: (1 + CFG.key.rate * L) * (run.route.shrine && !boss ? 1.33 : 1), // a shrine's ground is busier
    chargeMul: 1 - 0.06 * (run.cards.swing ?? 0), feat: run.feat, mutators: run.mutators,
    richInPeak: run.wilds.includes('veins'), dodgeMul: run.wilds.includes('freedodge') ? 0.5 : 1, noSlow: run.wilds.includes('stoneback'), noDodge: !!kitOf(run).noDodge,
    heatHolds: !!kitOf(run).heatHolds, heat: run.heat,
  };
}

// ------------------------------------------------------------ after a wave

export function applyWave(run: RunState, res: WaveResult): void {
  const i = run.wave;
  const t = run.totals;
  run.hp = res.hp;
  run.abilityIdx = res.abilityIdx;
  run.scrap += Math.round(res.scrap);
  t.scrap += Math.round(res.scrap);
  t.kills += res.kills;
  t.dmgTaken += res.dmgTaken;
  t.heatPeak = Math.max(t.heatPeak, res.heatPeak);
  t.gatherTime += res.gatherTime;
  t.time += res.time;
  t.elites += res.elitesKilled.length;
  if (res.bossKilled) t.bosses++;
  for (const [k, n] of Object.entries(res.famKills)) t.famKills[k] = (t.famKills[k] ?? 0) + n;
  for (const [id, n] of Object.entries(res.gathered)) {
    run.bagMats[id] = (run.bagMats[id] ?? 0) + n;
    t.gathered[id] = (t.gathered[id] ?? 0) + n;
  }
  run.weapons.forEach((w, k) => {
    w.dmg += res.dmgBy[k] ?? 0;
    w.kills += res.killsBy[k] ?? 0;
  });
  let levelUps = 0;
  run.xp += res.xp;
  while (run.xp >= xpNeed(run.level)) {
    run.xp -= xpNeed(run.level);
    run.level++;
    levelUps++;
  }
  const found: string[] = [];
  run.last = { index: i, res, levelUps, found };

  if (res.died) {
    run.phase = 'over';
    run.outcome = 'died';
    return;
  }
  if (run.feat.schem) {
    const list = Object.values(SCHEMATICS).filter((s) => s.source === 'elite');
    for (let k = 0; k < res.elitesKilled.length; k++) if (rnd(run) < 0.5) found.push(pick(run, list).id);
    if (run.route.shrine) found.push(run.route.shrine.prize);
    run.bagSchem.push(...found);
  }
  t.wavesCleared = i + 1;
  run.wave = i + 1;
  run.heat = res.heat * 0.5;
  const noHeal = run.wilds.includes('haggler') || runMods(run).noHeal > 0;
  run.flaskActive = null;
  run.campMods = [];
  const tired = run.hp;
  run.hp = Math.min(maxHp(run), run.hp + (noHeal ? 0 : CFG.healBetweenWaves));
  run.last.rest = Math.max(0, run.hp - tired);
  run.last.restBarred = noHeal;
  run.pendingPicks += levelUps;
  rollPicks(run);
  run.phase = 'tally';

  if (isBossWave(i)) {
    run.curse = null;
    const seg = segmentOf(i);
    const taken = run.wilds;
    const offer: string[] = [];
    const final = run.wave >= WAVES || !run.feat.gates;
    const pool = WILDS.filter((w) => !taken.includes(w.id) && (POOL_UNLOCK[`wild:${w.id}`] ?? 0) <= run.poolLvl);
    while (!final && offer.length < 3 && pool.length) offer.push(pool.splice(Math.floor(rnd(run) * pool.length), 1)[0].id);
    run.gate = { boss: seg, killed: res.bossKilled, opened: false, loot: [], wildOffer: offer, wildDone: final, final };
  } else {
    run.gate = null;
    setupCamp(run);
  }
}

/** Three level-up picks to choose from, while any are owed. */
function rollPicks(run: RunState): void {
  if (run.pendingPicks <= 0) {
    run.pickOffer = [];
    return;
  }
  const pool = LEVEL_PICKS.map((p) => p.id);
  run.pickOffer = [];
  while (run.pickOffer.length < 3) run.pickOffer.push(pool.splice(Math.floor(rnd(run) * pool.length), 1)[0]);
}
export function pickLevel(run: RunState, id: string): boolean {
  if (run.pendingPicks <= 0 || !run.pickOffer.includes(id)) return false;
  run.picks.push(id);
  run.pendingPicks--;
  run.hp = Math.min(maxHp(run), run.hp + 2);
  rollPicks(run);
  return true;
}

/** Called by the UI when the tally is dismissed. */
export function afterTally(run: RunState): void {
  if (run.phase !== 'tally' || run.pendingPicks > 0) return;
  run.phase = run.gate ? 'gate' : 'camp';
}

export function setupCamp(run: RunState): void {
  run.rerolls = 0;
  run.craftsLeft = !run.feat.craft || run.curse === 'barren' ? 0 : kitOf(run).crafts ?? 1;
  genShop(run);
  run.routeOptions = genRoutes(run);
  run.routePick = 0;
  run.route = run.routeOptions[0];
}

// -------------------------------------------------------------------- shop

function rollTier(run: RunState, table: number[][]): number {
  const w = run.wave;
  const row = table[w < 2 ? 0 : w < 5 ? 1 : w < 8 ? 2 : 3];
  let x = rnd(run) * row.reduce((a, b) => a + b, 0);
  for (let t = 0; t < row.length; t++) {
    if (x < row[t]) return t + 1;
    x -= row[t];
  }
  return 1;
}
function priceOf(run: RunState, base: number): number {
  return Math.max(1, Math.round(base * (1 + 0.06 * run.wave) * (run.wilds.includes('haggler') ? 0.7 : 1)));
}
function makeOffer(run: RunState): Offer {
  const noHeal = run.mutators.includes('dryshop') || run.wilds.includes('haggler');
  if (rnd(run) < 0.42) {
    const owned = [...new Set(run.weapons.map((w) => w.fam))];
    const fam = owned.length && rnd(run) < 0.55 ? pick(run, owned) : pick(run, FAMS);
    const tier = rollTier(run, [[1], [70, 30], [30, 50, 20], [10, 45, 40, 5]]);
    return { kind: 'weapon', fam, tier, price: priceOf(run, WEAPON_PRICE[tier]), locked: false, sold: false };
  }
  const tier = rollTier(run, [[80, 20], [55, 38, 7], [35, 45, 20], [22, 43, 35]]);
  const pool = Object.values(ITEMS).filter((it) => it.tier === tier && !(noHeal && it.heal) && (POOL_UNLOCK[it.id] ?? 0) <= run.poolLvl);
  const it = pool.length ? pick(run, pool) : ITEMS.whetstone;
  return { kind: 'item', item: it.id, tier, price: priceOf(run, ITEM_PRICE[tier] * (it.heal ? 0.6 : 1)), locked: false, sold: false };
}
export function genShop(run: RunState): void {
  const keep = run.shop.filter((o) => o.locked && !o.sold);
  // a locked offer is kept, but at this camp's price
  for (const o of keep) o.price = priceOf(run, o.kind === 'weapon' ? WEAPON_PRICE[o.tier] : ITEM_PRICE[o.tier] * (ITEMS[o.item!].heal ? 0.6 : 1));
  run.shop = keep;
  while (run.shop.length < 4) run.shop.push(makeOffer(run));
}
export function rerollCost(run: RunState): number {
  const free = run.cards.reroll ?? 0;
  return run.rerolls < free ? 0 : 2 + run.wave + (run.rerolls - free) * 2;
}
export function reroll(run: RunState): boolean {
  const cost = rerollCost(run);
  if (run.scrap < cost) return false;
  run.scrap -= cost;
  run.rerolls++;
  genShop(run);
  return true;
}
/** Index of a weapon the offered one would merge into, or -1. */
export function mergeTarget(run: RunState, fam: Fam, tier: number, skip = -1): number {
  return run.weapons.findIndex((w, i) => i !== skip && w.fam === fam && w.tier === tier && tier < MAX_TIER && !w.evolved);
}
export function canBuy(run: RunState, o: Offer): string | null {
  if (o.sold) return 'sold';
  if (run.scrap < o.price) return 'not enough scrap';
  if (o.kind === 'weapon' && run.weapons.length >= effSlots(run) && mergeTarget(run, o.fam!, o.tier) < 0) return 'no free slot';
  if (o.kind === 'item' && ITEMS[o.item!].heal && (runMods(run).noHeal > 0 || run.wilds.includes('haggler'))) return 'no healing right now';
  return null;
}
export function buy(run: RunState, i: number): boolean {
  const o = run.shop[i];
  if (!o || canBuy(run, o)) return false;
  run.scrap -= o.price;
  o.sold = true;
  o.locked = false;
  if (o.kind === 'weapon') {
    const fresh: WeaponInst = { fam: o.fam!, tier: o.tier, gs: rnd(run), variant: false, evolved: false, dmg: 0, kills: 0 };
    if (run.weapons.length < effSlots(run)) run.weapons.push(fresh);
    else mergeInto(run, mergeTarget(run, o.fam!, o.tier), fresh);
  } else {
    const it = ITEMS[o.item!];
    if (it.heal) run.hp = Math.min(maxHp(run), run.hp + it.heal);
    else run.items.push(it.id);
    run.hp = Math.min(run.hp, maxHp(run)); // an item that lowers maximum health takes the excess with it
  }
  return true;
}
function mergeInto(run: RunState, i: number, other: WeaponInst): void {
  const w = run.weapons[i];
  w.tier++;
  w.gs = rnd(run); // merging rerolls the gear score inside the new tier's range
  w.variant = w.variant || other.variant;
  w.dmg += other.dmg;
  w.kills += other.kills;
}
export function merge(run: RunState, i: number): boolean {
  const w = run.weapons[i];
  if (!w) return false;
  const j = mergeTarget(run, w.fam, w.tier, i);
  if (j < 0 || w.evolved) return false;
  const [keep, drop] = i < j ? [i, j] : [j, i];
  mergeInto(run, keep, run.weapons[drop]);
  run.weapons.splice(drop, 1);
  return true;
}
export function sellPrice(run: RunState, w: WeaponInst): number {
  return Math.round(priceOf(run, WEAPON_PRICE[w.tier]) * 0.4);
}
export function sell(run: RunState, i: number): boolean {
  if (run.weapons.length <= 1 || !run.weapons[i]) return false;
  run.scrap += sellPrice(run, run.weapons[i]);
  run.weapons.splice(i, 1);
  return true;
}
export function weaponName(w: WeaponInst): string {
  const d = WEAPONS[w.fam];
  if (w.evolved) return d.evolved;
  const base = w.variant ? RECIPES[`var-${w.fam}`].name : d.name;
  return `${base} ${'I'.repeat(w.tier).replace('IIII', 'IV')}`;
}
export function weaponGs(w: WeaponInst): number {
  return Math.round(200 + (w.tier - 1) * 100 + w.gs * 100);
}

// -------------------------------------------------------------- camp craft

function matsFor(run: RunState, cat: string): string[] {
  return Object.keys(run.bagMats)
    .filter((id) => run.bagMats[id] > 0 && MATS[id].cat !== 'part' && (id === cat || MATS[id].cat === cat))
    .sort((a, b) => MATS[a].tier - MATS[b].tier);
}
export function craftCost(run: RunState, id: string): number {
  const n = RECIPES[id].cost?.n ?? 0;
  return kitOf(run).crafts ? Math.ceil(n / 2) : n;
}
export function canCraft(run: RunState, id: string): string | null {
  const r = RECIPES[id];
  if (!r || r.kind === 'evolution') return 'not a camp craft';
  if (run.craftsLeft <= 0) return run.curse === 'barren' ? 'cursed: no camp craft' : 'already crafted at this camp';
  if (r.kind === 'variant' && !run.weapons.some((w) => w.fam === r.fam && !w.variant && !w.evolved)) return `needs a plain ${WEAPONS[r.fam!].name.toLowerCase()}`;
  const have = matsFor(run, r.cost!.cat).reduce((a, m) => a + run.bagMats[m], 0);
  const what = r.cost!.cat in MATS ? MATS[r.cost!.cat].name.toLowerCase() : { ore: 'ore', wood: 'wood', herb: 'herbs', creature: 'creature parts' }[r.cost!.cat] ?? r.cost!.cat;
  if (have < craftCost(run, id)) return `needs ${craftCost(run, id)} ${what}`;
  if (r.heal && runMods(run).noHeal > 0) return 'no healing right now';
  if (r.heal && run.hp >= maxHp(run)) return 'already at full health';
  return null;
}
export function craft(run: RunState, id: string): boolean {
  if (canCraft(run, id)) return false;
  const r = RECIPES[id];
  let need = craftCost(run, id);
  for (const m of matsFor(run, r.cost!.cat)) {
    const take = Math.min(need, run.bagMats[m]);
    run.bagMats[m] -= take;
    need -= take;
    if (need <= 0) break;
  }
  if (r.kind === 'variant') run.weapons.find((w) => w.fam === r.fam && !w.variant && !w.evolved)!.variant = true;
  if (r.heal) run.hp = Math.min(maxHp(run), run.hp + r.heal);
  if (r.mods) run.campMods.push(...r.mods);
  run.craftsLeft--;
  run.totals.crafts++;
  return true;
}
export function drink(run: RunState, i: number): boolean {
  if (run.flaskActive || !run.flasks[i]) return false;
  run.flaskActive = run.flasks.splice(i, 1)[0];
  return true;
}

// ------------------------------------------------------------------ routes

function genRoutes(run: RunState): Route[] {
  const next = run.wave;
  if (!run.feat.routes) return [{ ground: run.route.ground, objective: 'none', elite: null, shrine: null }];
  const grounds = [...GROUND_IDS].sort(() => rnd(run) - 0.5);
  const boss = isBossWave(next);
  const out: Route[] = grounds.map((ground) => {
    if (boss) return { ground, objective: 'none' as Objective, elite: null, shrine: null };
    const objective = pick(run, ['none', 'supply', 'nests', 'elite', 'elite'] as Objective[]);
    const elites = ELITES.filter((e) => e.ground === ground);
    return { ground, objective, elite: objective === 'elite' ? pick(run, elites).id : null, shrine: null };
  });
  if (!boss && run.feat.schem && !run.curse && rnd(run) < 0.45) {
    const prizes = Object.values(SCHEMATICS).filter((s) => s.source === 'shrine');
    out[out.length - 1].shrine = { curse: pick(run, Object.keys(CURSES)), prize: pick(run, prizes).id };
    out[out.length - 1].objective = 'none';
    out[out.length - 1].elite = null;
  }
  return out;
}
export function chooseRoute(run: RunState, i: number): void {
  if (!run.routeOptions[i]) return;
  run.routePick = i;
  run.route = run.routeOptions[i];
}
/** Leave camp for the next wave. A shrine's price starts now and lasts to the end of the segment. */
export function leaveCamp(run: RunState): void {
  if (run.phase !== 'camp' || run.wave >= WAVES) return;
  if (run.route.shrine) run.curse = run.route.shrine.curse;
  run.hp = Math.min(run.hp, maxHp(run));
  run.phase = 'wave';
}

// ------------------------------------------------------------------- gates

export function openChest(run: RunState): void {
  const g = run.gate;
  if (!g || g.opened || !g.killed) return;
  g.opened = true;
  const boss = BOSSES[g.boss];
  run.scrap += 40;
  g.loot.push('40 scrap');
  if (run.last && run.last.res.armorBreaks >= boss.armorAt.length) {
    run.bagMats[boss.part] = (run.bagMats[boss.part] ?? 0) + 1;
    g.loot.push(`a second ${MATS[boss.part].name} for breaking every plate of armour`);
  }
  if (run.feat.schem) {
    const s = pick(run, Object.values(SCHEMATICS).filter((x) => x.source === boss.source));
    run.bagSchem.push(s.id);
    g.loot.push(s.name);
  }
}
export function eliteParts(run: RunState): string[] {
  return ELITE_PARTS.filter((id) => run.bagMats[id] > 0);
}
export function evolvable(run: RunState): number[] {
  const g = run.gate;
  if (!g || !g.opened || g.final || eliteParts(run).length === 0) return [];
  return run.weapons
    .map((w, i) => (w.tier >= EVOLVE_TIER && !w.evolved && (run.recipes.includes(`evo-${w.fam}`) || run.abilities.includes(w.fam)) ? i : -1))
    .filter((i) => i >= 0);
}
export function evolve(run: RunState, i: number, part: string): boolean {
  if (!evolvable(run).includes(i) || !ELITE_PARTS.includes(part) || !(run.bagMats[part] > 0)) return false;
  run.bagMats[part]--;
  run.weapons[i].evolved = true;
  return true;
}
export function pickWild(run: RunState, id: string | null): void {
  const g = run.gate;
  if (!g || g.wildDone) return;
  g.wildDone = true;
  if (!id || !g.wildOffer.includes(id)) return;
  run.wilds.push(id);
  if (id === 'slot') run.slots++;
  run.hp = Math.min(run.hp, maxHp(run));
}
export function extract(run: RunState): void {
  if (run.phase !== 'gate') return;
  run.phase = 'over';
  run.outcome = run.wave >= WAVES ? 'cleared' : 'extracted';
}
export function push(run: RunState): void {
  if (!run.gate || run.gate.final) return;
  run.gate = null;
  setupCamp(run);
  run.phase = 'camp';
}
