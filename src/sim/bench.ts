// The bench: upgrade picks, offers, reroll, lock, buy, scrap, fusion, mule.
// Every function returns false (or a reason) and changes nothing if the
// action is not allowed, so a UI can call them straight from buttons.
import { BASE_ITEMS } from '../shared/content/items.ts';
import { basePrice, fusionBlock, fusionBudget, itemPoints, itemTier, tierOf, type ItemSpec } from '../shared/item.ts';
import { emptyRaws, FUSE_RAW_COST, GLYPHS, RAWS, STATS, type RawBag, type StatId } from '../shared/vocab.ts';
import { CHARACTER } from './data/characters.ts';
import { BENCH_ITEM_SHARE, RARITY, SAME_CLASS_BIAS, SAME_WEAPON_BIAS, SCRAP_SHARE } from './data/tuning.ts';
import { UPGRADE_RARITY, UPGRADE_VALUE } from './data/upgrades.ts';
import { WEAPONS, WEAPON_INDEX } from './data/weapons.ts';
import { primOf, rebuild, SP, ST, weaponSlots } from './core.ts';
import { rnd, Stream } from './rng.ts';
import type { Offer, Run, UpgradeChoice } from './types.ts';
import { makeWeapon } from './weapons.ts';

/** Offers at a bench. The Order book adds one. */
export const BENCH_OFFERS = 4;

const ITEMS_BY_TIER: ItemSpec[][] = [[], [], [], [], []];
for (const it of BASE_ITEMS) ITEMS_BY_TIER[itemTier(it)].push(it);

type Gate = { from: number; per: number; cap: number } | null;

function rollTier(run: Run, stream: Stream, n: number, table: readonly Gate[]): number {
  const luck = 1 + run.player.stat[ST.luck] / 100;
  const r = rnd(run.rng, stream);
  let acc = 0;
  for (let t = 4; t >= 2; t--) {
    const g = table[t]!;
    if (n < g.from) continue;
    acc += Math.min(0.9, Math.min(g.cap, (n - g.from + 1) * g.per) * luck);
    if (r < acc) return t;
  }
  return 1;
}

/** Chance of each tier (index 1-4) at a bench, for showing odds. */
export function offerOdds(run: Run, bench: number): number[] {
  const luck = 1 + run.player.stat[ST.luck] / 100;
  const out = [0, 1, 0, 0, 0];
  let acc = 0;
  for (let t = 4; t >= 2; t--) {
    const g = RARITY[t]!;
    if (bench < g.from) continue;
    const c = Math.min(Math.max(0, 1 - acc), Math.min(0.9, Math.min(g.cap, (bench - g.from + 1) * g.per) * luck));
    out[t] = c; acc += c;
  }
  out[1] = Math.max(0, 1 - acc);
  return out;
}

/** The price formula from the design: floor((base + wave + 0.1 x base x wave) x modifiers). */
export function priceAt(base: number, wave: number, mul = 1): number {
  return Math.floor((base + wave + 0.1 * base * wave) * mul);
}

export function weaponPrice(run: Run, id: string, tier: number, wave = run.wave): number {
  const mul = CHARACTER[run.character].weaponPrice?.[id] ?? 1;
  return priceAt(WEAPONS[WEAPON_INDEX[id]].price[tier - 1], wave, mul);
}
export function itemPrice(run: Run, item: ItemSpec, wave = run.wave): number {
  return priceAt(basePrice(item), wave);
}

function recipeRaws(run: Run, src: Partial<RawBag> | undefined, mul: number): RawBag {
  const out = emptyRaws();
  if (src) for (const r of RAWS) out[r] = (src[r] ?? 0) * mul;
  const cut = CHARACTER[run.character].oreDiscount ?? 0;
  out.ore = Math.max(0, out.ore - cut);
  return out;
}

function rollWeaponOffer(run: Run, o: Offer): void {
  const p = run.player, b = run.bench.index;
  let def = -1, tier = rollTier(run, Stream.Bench, b, RARITY);
  const r = rnd(run.rng, Stream.Bench);
  if (p.weapons.length > 0 && r < SAME_WEAPON_BIAS) {
    const held = p.weapons[Math.floor(rnd(run.rng, Stream.Bench) * p.weapons.length)];
    def = held.def;
    // Offer it at the held tier when that is at most one step past what this bench can roll, so pairs can be made.
    let maxTier = 1;
    for (let t = 2; t <= 4; t++) if (b >= RARITY[t]!.from) maxTier = t;
    if (held.tier < 4 && held.tier <= maxTier + 1) tier = held.tier;
  } else if (p.weapons.length > 0 && r < SAME_WEAPON_BIAS + SAME_CLASS_BIAS) {
    const held = WEAPONS[p.weapons[Math.floor(rnd(run.rng, Stream.Bench) * p.weapons.length)].def];
    const cls = held.classes[Math.floor(rnd(run.rng, Stream.Bench) * held.classes.length)];
    const pool: number[] = [];
    for (let i = 0; i < WEAPONS.length; i++) if (WEAPONS[i].classes.includes(cls)) pool.push(i);
    def = pool[Math.floor(rnd(run.rng, Stream.Bench) * pool.length)];
  } else def = Math.floor(rnd(run.rng, Stream.Bench) * WEAPONS.length);
  const w = WEAPONS[def];
  o.kind = 'weapon'; o.id = w.id; o.tier = tier; o.item = null;
  o.price = weaponPrice(run, w.id, tier, b);
  // Company draft: weapons are had on account. Items still cost their raws.
  o.raws = run.player.sp[SP.noRawCost] > 0 ? emptyRaws() : recipeRaws(run, w.raws, w.plainAtOne ? tier - 1 : tier);
}

function rollItemOffer(run: Run, o: Offer, slot: number): void {
  const b = run.bench.index, offers = run.bench.offers;
  let item: ItemSpec | null = null;
  for (let tries = 0; tries < 6; tries++) {
    let tier = rollTier(run, Stream.Bench, b, RARITY);
    while (tier > 1 && ITEMS_BY_TIER[tier].length === 0) tier--;
    const pool = ITEMS_BY_TIER[tier];
    item = pool[Math.floor(rnd(run.rng, Stream.Bench) * pool.length)];
    let dup = false;
    for (let i = 0; i < offers.length; i++) if (i !== slot && offers[i].kind === 'item' && !offers[i].sold && offers[i].id === item.id) dup = true;
    if (!dup) break;
  }
  o.kind = 'item'; o.id = item!.id; o.tier = itemTier(item!); o.item = item;
  o.price = itemPrice(run, item!, b);
  o.raws = recipeRaws(run, item!.raws, 1);
}

function rollOffers(run: Run): void {
  const b = run.bench;
  // Four offers. The Order book adds a fifth, which is always an item or a weapon by the usual odds.
  const want = BENCH_OFFERS + (run.player.sp[SP.extraOffer] > 0 ? 1 : 0);
  while (b.offers.length < want) b.offers.push(newOffer());
  for (let i = 0; i < b.offers.length; i++) {
    const o = b.offers[i];
    if (o.locked && !o.sold) continue;
    o.locked = false; o.sold = false;
    const weapon = b.index <= 2 ? i < 2 : rnd(run.rng, Stream.Bench) >= BENCH_ITEM_SHARE;
    if (weapon) rollWeaponOffer(run, o); else rollItemOffer(run, o, i);
  }
}

function rollChoices(run: Run): void {
  const b = run.bench, p = run.player;
  b.choices.length = 0;
  if (b.picks <= 0) return;
  // The level this pick belongs to: picks are owed oldest first.
  const level = p.level - b.picks + 1;
  const pool = STATS.slice() as StatId[];
  for (let i = 0; i < 4; i++) {
    const k = Math.floor(rnd(run.rng, Stream.Upgrade) * pool.length);
    const stat = pool.splice(k, 1)[0];
    const tier = rollTier(run, Stream.Upgrade, level, UPGRADE_RARITY);
    b.choices.push({ stat, tier, value: UPGRADE_VALUE[stat][tier - 1] });
  }
}

export function openBench(run: Run, interest: number, mule: boolean): void {
  const b = run.bench;
  b.index = run.wave;
  b.rerolls = 0; b.freeReroll = false; b.mule = mule; b.interestPaid = interest;
  rebuild(run);
  rollOffers(run);
  rollChoices(run);
}

/** Take upgrade choice i. */
export function pickUpgrade(run: Run, i: number): boolean {
  const b = run.bench, p = run.player;
  if (run.phase !== 'bench' || b.picks <= 0) return false;
  const c: UpgradeChoice | undefined = b.choices[i];
  if (!c) return false;
  p.base[ST[c.stat]] += c.value;
  run.upgradeLog.push(c.stat);
  b.picks--;
  rebuild(run);
  rollChoices(run);
  return true;
}

export function rerollCost(run: Run): number {
  const b = run.bench;
  if (b.freeReroll) return 0;
  const w = b.index;
  const raw = Math.floor(0.5 * w) + 1 + b.rerolls * Math.max(1, Math.floor(0.4 * w));
  return Math.floor(raw * (1 - run.player.sp[SP.rerollCut] / 100));
}

export function reroll(run: Run): boolean {
  const b = run.bench, p = run.player;
  if (run.phase !== 'bench') return false;
  const cost = rerollCost(run);
  if (p.scrip < cost) return false;
  p.scrip -= cost;
  if (b.freeReroll) b.freeReroll = false; else b.rerolls++;
  rollOffers(run);
  return true;
}

export function toggleLock(run: Run, i: number): boolean {
  const o = run.bench.offers[i];
  if (run.phase !== 'bench' || !o || o.sold) return false;
  o.locked = !o.locked;
  return true;
}

function canHoldWeapon(run: Run, def: number, tier: number): boolean {
  const p = run.player;
  if (p.weapons.length < weaponSlots(run)) return true;
  if (tier >= 4) return false;
  for (const w of p.weapons) if (w.def === def && w.tier === tier) return true;
  return false;
}

/** Add a weapon, combining with a held twin of the same tier, repeatedly. */
export function addWeapon(run: Run, def: number, tier: number): boolean {
  const p = run.player;
  if (!canHoldWeapon(run, def, tier)) return false;
  for (;;) {
    let twin = -1;
    if (tier < 4) for (let i = 0; i < p.weapons.length; i++) if (p.weapons[i].def === def && p.weapons[i].tier === tier) { twin = i; break; }
    if (twin < 0) break;
    p.weapons.splice(twin, 1);
    tier++;
  }
  p.weapons.push(makeWeapon(def, tier));
  rebuild(run);
  return true;
}

/** Why offer i cannot be bought right now, or null if it can. */
export function buyBlock(run: Run, i: number): string | null {
  const o = run.bench.offers[i], p = run.player;
  if (run.phase !== 'bench' || !o) return 'Not at the bench.';
  if (o.sold) return 'Sold.';
  if (p.scrip < o.price) return 'Not enough scrip.';
  for (const r of RAWS) if (p.raws[r] < o.raws[r]) return `Not enough ${r}.`;
  if (o.kind === 'weapon' && !canHoldWeapon(run, WEAPON_INDEX[o.id], o.tier)) return 'No free weapon slot.';
  return null;
}

export function buy(run: Run, i: number): boolean {
  if (buyBlock(run, i) !== null) return false;
  const b = run.bench, o = b.offers[i], p = run.player;
  p.scrip -= o.price;
  for (const r of RAWS) p.raws[r] -= o.raws[r];
  o.sold = true; o.locked = false;
  if (o.kind === 'weapon') {
    addWeapon(run, WEAPON_INDEX[o.id], o.tier);
    run.buyLog.push(o.id);
  } else {
    p.items.push(o.item!);
    p.itemKit.push(false);
    run.buyLog.push(o.id);
    rebuild(run);
  }
  let all = true;
  for (const x of b.offers) if (!x.sold) all = false;
  if (all) b.freeReroll = true;
  return true;
}

export function scrapValueWeapon(run: Run, i: number): number {
  const w = run.player.weapons[i];
  return w ? Math.floor(weaponPrice(run, w.id, w.tier, run.bench.index) * SCRAP_SHARE) : 0;
}
export function scrapValueItem(run: Run, i: number): number {
  const it = run.player.items[i];
  return it ? Math.floor(itemPrice(run, it, run.bench.index) * SCRAP_SHARE) : 0;
}

/** Sell weapon i for 25% of its current price. The last weapon cannot be scrapped. */
export function scrapWeapon(run: Run, i: number): boolean {
  const p = run.player;
  if (run.phase !== 'bench' || !p.weapons[i] || p.weapons.length <= 1) return false;
  const v = scrapValueWeapon(run, i);
  p.weapons.splice(i, 1);
  p.scrip += v; run.scripEarned += v;
  rebuild(run);
  return true;
}

export function scrapItem(run: Run, i: number): boolean {
  const p = run.player;
  if (run.phase !== 'bench' || !p.items[i] || p.items[i].relic === true) return false;
  const v = scrapValueItem(run, i);
  p.items.splice(i, 1); p.itemKit.splice(i, 1);
  p.scrip += v; run.scripEarned += v;
  rebuild(run);
  return true;
}

export interface FuseQuote {
  /** Null if the pair may be fused and paid for. */
  block: string | null;
  /** Point budget the result will be built to. */
  budget: number;
  /** Highest tier the result can be. */
  tier: number;
  /** Raws charged for a result of that tier. A lower-tier result is charged less. */
  raws: RawBag;
}

function fuseRaws(run: Run, tier: number): RawBag {
  return CHARACTER[run.character].freeFusion ? emptyRaws() : { ...FUSE_RAW_COST[tier] };
}

/** Quote a fusion of held items a and b (indices into player.items). */
export function fuseCost(run: Run, a: number, b: number): FuseQuote {
  const p = run.player, A = p.items[a], B = p.items[b];
  const q: FuseQuote = { block: null, budget: 0, tier: 1, raws: emptyRaws() };
  if (run.phase !== 'bench') { q.block = 'Fusing is done at the bench.'; return q; }
  if (!A || !B || a === b) { q.block = 'Pick two different items.'; return q; }
  q.block = fusionBlock(A, B);
  q.budget = fusionBudget(A, B);
  q.tier = tierOf(q.budget);
  q.raws = fuseRaws(run, q.tier);
  if (!q.block) for (const r of RAWS) if (p.raws[r] < q.raws[r]) { q.block = `Not enough ${r}.`; break; }
  return q;
}

/** Why a fusion result cannot be accepted, or null. */
export function fusionResultBlock(result: ItemSpec, budget: number): string | null {
  if (result?.relic) return 'Bad item.';
  if (!result || typeof result.id !== 'string' || !result.id || typeof result.name !== 'string' || !result.name) return 'Bad item.';
  if (!(GLYPHS as readonly string[]).includes(result.glyph) || !Array.isArray(result.tags)) return 'Bad item.';
  if (!Array.isArray(result.effects) || result.effects.length < 1) return 'Bad item.';
  let pos = 0, neg = 0;
  const seen = new Set<string>();
  for (const e of result.effects) {
    const prim = e ? primOf(e.p) : undefined;
    if (!prim || seen.has(e.p) || !Number.isInteger(e.l) || e.l < 1 || e.l > 5) return 'Bad effect.';
    seen.add(e.p);
    if (e.neg) { neg++; if (prim.kind !== 'stat') return 'Bad drawback.'; } else pos++;
  }
  if (pos < 1 || pos > 3 || neg > 1) return 'Too many effects.';
  if (itemPoints(result.effects) > budget) return 'Over budget.';
  return null;
}

/**
 * Fuse held items a and b into `result` (looked up or made by the server).
 * Checks the block rules and the budget, charges raws by the result's tier
 * (Tinker pays none), swaps the items and records [a, b, out].
 * Returns null on success or the reason it was refused; nothing changes on refusal.
 */
export function applyFusion(run: Run, a: number, b: number, result: ItemSpec): string | null {
  const p = run.player;
  const q = fuseCost(run, a, b);
  const A = p.items[a], B = p.items[b];
  if (!A || !B || a === b || run.phase !== 'bench') return q.block ?? 'Pick two different items.';
  const hard = fusionBlock(A, B) ?? fusionResultBlock(result, q.budget);
  if (hard) return hard;
  const cost = fuseRaws(run, itemTier(result));
  for (const r of RAWS) if (p.raws[r] < cost[r]) return `Not enough ${r}.`;
  for (const r of RAWS) p.raws[r] -= cost[r];
  const hi = Math.max(a, b), lo = Math.min(a, b);
  p.items.splice(hi, 1); p.itemKit.splice(hi, 1);
  p.items.splice(lo, 1); p.itemKit.splice(lo, 1);
  p.items.push(result); p.itemKit.push(false);
  run.fusions.push([A.id, B.id, result.id]);
  rebuild(run);
  return null;
}

/** Load raws on the mule. Only at the benches after waves 4 and 8. Amounts are clamped to what is held. */
export function sendMule(run: Run, load: Partial<RawBag>): boolean {
  const p = run.player;
  if (run.phase !== 'bench' || !run.bench.mule) return false;
  for (const r of RAWS) {
    const n = Math.max(0, Math.min(p.raws[r], Math.floor(load[r] ?? 0)));
    p.raws[r] -= n; run.mule[r] += n;
  }
  rebuild(run);
  return true;
}

export function newOffer(): Offer {
  return { kind: 'item', id: '', tier: 1, price: 0, raws: emptyRaws(), locked: false, sold: true, item: null };
}
