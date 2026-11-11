// The bench: upgrade picks, offers, reroll, lock, buy, scrap, fusion, mule.
// Every function returns false (or a reason) and changes nothing if the
// action is not allowed, so a UI can call them straight from buttons.
import { ipow } from './trig.ts';
import { BASE_ITEMS } from '../shared/content/items.ts';
import { basePrice, fusionBlock, fusionBudget, itemPoints, itemTier, tierOf, type ItemSpec } from '../shared/item.ts';
import { emptyRaws, RUN_FUSE_RAW_COST, GLYPHS, RAWS, STATS, type RawBag, type StatId } from '../shared/vocab.ts';
import { CHARACTER } from './data/characters.ts';
import {
  BENCH_ITEM_SHARE, LATE_PRICE, LATE_PRICE_FROM, COMMISSION_FROM, COMMISSION_MUL, COMMISSION_T4, RACK_CLASS_BIAS, RACK_WEAPON_BIAS, RARITY, RAW_PRICE,
  RAW_PRICE_PER_BENCH, REROLL_GROWTH, SAME_CLASS_BIAS, SAME_WEAPON_BIAS, SCRAP_SHARE, TIER_UP_SHARE,
} from './data/tuning.ts';
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
  // Past bench 6 everything is dearer by a tenth per bench: income outruns a linear price.
  const late = 1 + LATE_PRICE * Math.max(0, wave - LATE_PRICE_FROM);
  return Math.floor((base + wave + 0.1 * base * wave) * late * mul);
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

/** Scrip the bench charges for each raw a recipe needs and the player does not hold. Steep, and steeper every bench. */
export function rawPrice(run: Run): number {
  return RAW_PRICE + RAW_PRICE_PER_BENCH * run.bench.index;
}
function shortOf(run: Run, raws: RawBag): number {
  let n = 0;
  for (const r of RAWS) if (run.player.raws[r] < raws[r]) n += raws[r] - run.player.raws[r];
  return n;
}
/** Pay a raw bill: what is held goes first, scrip covers the rest. The caller has checked the scrip is there. */
function payRaws(run: Run, raws: RawBag): void {
  const p = run.player;
  p.scrip -= shortOf(run, raws) * rawPrice(run);
  for (const r of RAWS) p.raws[r] = Math.max(0, p.raws[r] - raws[r]);
}
/** What offer i costs in scrip right now: its price, plus scrip for any raws the player is short of. */
export function offerCost(run: Run, i: number): number {
  const o = run.bench.offers[i];
  return o ? o.price + shortOf(run, o.raws) * rawPrice(run) : 0;
}

function setWeaponOffer(run: Run, o: Offer, def: number, tier: number): void {
  const w = WEAPONS[def];
  o.kind = 'weapon'; o.id = w.id; o.tier = tier; o.item = null; o.commission = false;
  o.price = weaponPrice(run, w.id, tier, run.bench.index);
  // Company draft: weapons are had on account. Items still cost their raws.
  o.raws = run.player.sp[SP.noRawCost] > 0 ? emptyRaws() : recipeRaws(run, w.raws, w.plainAtOne ? tier - 1 : tier);
}

/** Highest tier this bench can roll. */
function maxTierAt(b: number): number {
  let t = 1;
  for (let k = 2; k <= 4; k++) if (b >= RARITY[k]!.from) t = k;
  return t;
}

/** A weapon offer. It leans toward the weapons and classes already held; the rack (the first offer) leans harder. */
function rollWeaponOffer(run: Run, o: Offer, rack: boolean): void {
  const p = run.player, b = run.bench.index;
  let def = -1, tier = rollTier(run, Stream.Bench, b, RARITY);
  const r = rnd(run.rng, Stream.Bench);
  const same = rack ? RACK_WEAPON_BIAS : SAME_WEAPON_BIAS, cls0 = rack ? RACK_CLASS_BIAS : SAME_CLASS_BIAS;
  if (p.weapons.length > 0 && r < same) {
    const held = p.weapons[Math.floor(rnd(run.rng, Stream.Bench) * p.weapons.length)];
    def = held.def;
    // Offer it at the held tier when that is at most one step past what this bench can roll, so pairs can be made.
    if (held.tier < 4 && held.tier <= maxTierAt(b) + 1) tier = held.tier;
  } else if (p.weapons.length > 0 && r < same + cls0) {
    const held = WEAPONS[p.weapons[Math.floor(rnd(run.rng, Stream.Bench) * p.weapons.length)].def];
    const cls = held.classes[Math.floor(rnd(run.rng, Stream.Bench) * held.classes.length)];
    const pool: number[] = [];
    for (let i = 0; i < WEAPONS.length; i++) if (WEAPONS[i].classes.includes(cls)) pool.push(i);
    def = pool[Math.floor(rnd(run.rng, Stream.Bench) * pool.length)];
  } else def = Math.floor(rnd(run.rng, Stream.Bench) * WEAPONS.length);
  setWeaponOffer(run, o, def, tier);
  // The first bench always racks one weapon the player can pay for.
  if (rack && b === 1 && o.price + shortOf(run, o.raws) * rawPrice(run) > p.scrip) {
    const pool: number[] = [];
    let cheapest = 0;
    for (let i = 0; i < WEAPONS.length; i++) {
      setWeaponOffer(run, o, i, 1);
      if (o.price + shortOf(run, o.raws) * rawPrice(run) <= p.scrip) pool.push(i);
      if (WEAPONS[i].price[0] < WEAPONS[cheapest].price[0]) cheapest = i;
    }
    const k = Math.floor(rnd(run.rng, Stream.Bench) * Math.max(1, pool.length));
    setWeaponOffer(run, o, pool.length ? pool[k] : cheapest, 1);
    if (o.price > p.scrip) o.price = Math.max(1, p.scrip);
  }
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
  o.kind = 'item'; o.id = item!.id; o.tier = itemTier(item!); o.item = item; o.commission = false;
  o.price = itemPrice(run, item!, b);
  o.raws = recipeRaws(run, item!.raws, 1);
}

/** Offers a reroll replaces: four, or five with the Order book. The commission sits after them. */
function plainOffers(run: Run): number {
  return BENCH_OFFERS + (run.player.sp[SP.extraOffer] > 0 ? 1 : 0);
}

function rollOffers(run: Run): void {
  const b = run.bench;
  // Four offers. The Order book adds a fifth, which is always an item or a weapon by the usual odds.
  const want = plainOffers(run);
  while (b.offers.length < want) b.offers.push(newOffer());
  for (let i = 0; i < want; i++) {
    const o = b.offers[i];
    if (o.locked && !o.sold) continue;
    o.locked = false; o.sold = false;
    // The first offer is the rack: always a weapon. The first two benches rack two.
    const weapon = i === 0 || (b.index <= 2 ? i < 2 : rnd(run.rng, Stream.Bench) >= BENCH_ITEM_SHARE);
    if (weapon) rollWeaponOffer(run, o, i === 0); else rollItemOffer(run, o, i);
  }
}

/** The commission: from bench 5, one more offer, always a tier 3 or tier 4 item, dear, and not replaced by a reroll. */
function rollCommission(run: Run): void {
  const b = run.bench, want = plainOffers(run);
  while (b.offers.length < want) b.offers.push(newOffer());
  b.offers.length = want;
  if (b.index < COMMISSION_FROM) return;
  const o = newOffer();
  b.offers.push(o);
  const tier = b.index >= RARITY[4]!.from && rnd(run.rng, Stream.Bench) < COMMISSION_T4 && ITEMS_BY_TIER[4].length > 0 ? 4 : 3;
  const pool = ITEMS_BY_TIER[tier];
  const item = pool[Math.floor(rnd(run.rng, Stream.Bench) * pool.length)];
  o.kind = 'item'; o.id = item.id; o.tier = tier; o.item = item; o.sold = false; o.commission = true;
  o.price = Math.floor(itemPrice(run, item, b.index) * COMMISSION_MUL);
  o.raws = recipeRaws(run, item.raws, 1);
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
  b.freeFuses = CHARACTER[run.character].freeFusions ?? 0;
  b.fuses = 0;
  rebuild(run);
  rollCommission(run);
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
  // Each paid reroll costs a step more and a third more than the last, so the fifth is a real purchase.
  const raw = (Math.floor(0.5 * w) + 1 + b.rerolls * Math.max(1, Math.floor(0.4 * w))) * ipow(REROLL_GROWTH, b.rerolls);
  return Math.floor(raw * (CHARACTER[run.character].rerollMul ?? 1) * (1 - run.player.sp[SP.rerollCut] / 100));
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
  if (run.phase !== 'bench' || !o || o.sold || o.commission) return false;
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

/**
 * Add a weapon. With a free slot it is simply held, so copies of one weapon can be stacked.
 * With full hands it combines with a held twin of the same tier into the next tier.
 */
export function addWeapon(run: Run, def: number, tier: number): boolean {
  const p = run.player;
  if (!canHoldWeapon(run, def, tier)) return false;
  if (p.weapons.length >= weaponSlots(run)) {
    for (let i = 0; i < p.weapons.length; i++) if (p.weapons[i].def === def && p.weapons[i].tier === tier) { p.weapons.splice(i, 1); tier++; break; }
  }
  p.weapons.push(makeWeapon(def, tier));
  rebuild(run);
  return true;
}

/** Index of a held twin of weapon i (same weapon, same tier, below tier 4), or -1. */
export function twinOf(run: Run, i: number): number {
  const ws = run.player.weapons, w = ws[i];
  if (!w || w.tier >= 4) return -1;
  for (let k = 0; k < ws.length; k++) if (k !== i && ws[k].def === w.def && ws[k].tier === w.tier) return k;
  return -1;
}

/** Combine weapon i with a held twin into one weapon of the next tier. Frees a slot. */
export function combineWeapons(run: Run, i: number): boolean {
  const p = run.player;
  if (run.phase !== 'bench') return false;
  const k = twinOf(run, i);
  if (k < 0) return false;
  p.weapons[i].tier++;
  p.weapons.splice(k, 1);
  rebuild(run);
  return true;
}

function tierUpRaws(run: Run, i: number): RawBag {
  const ch = CHARACTER[run.character], w = run.player.weapons[i];
  // The Company draft covers weapons bought at the bench, not work on weapons already held.
  return ch.noUpgradeRaws ? emptyRaws() : recipeRaws(run, WEAPONS[w.def].raws, 1);
}

/** Why held weapon i cannot be raised a tier right now, or null. A tier opens at the bench where offers can first roll it. */
export function tierUpBlock(run: Run, i: number): string | null {
  const w = run.player.weapons[i];
  if (run.phase !== 'bench' || !w) return 'Not at the bench.';
  if (w.tier >= 4) return 'Already tier 4.';
  if (w.tier + 1 > maxTierAt(run.bench.index)) return 'The bench cannot work that tier yet.';
  if (run.player.scrip < tierUpCost(run, i)) return 'Not enough scrip.';
  return null;
}

/** Scrip to raise held weapon i one tier: a share of the next tier's price, plus scrip for any raws short. */
export function tierUpCost(run: Run, i: number): number {
  const w = run.player.weapons[i];
  if (!w || w.tier >= 4) return 0;
  const mul = TIER_UP_SHARE * (CHARACTER[run.character].upgradeMul ?? 1);
  return Math.floor(weaponPrice(run, w.id, w.tier + 1, run.bench.index) * mul) + shortOf(run, tierUpRaws(run, i)) * rawPrice(run);
}

/** Raise held weapon i one tier for scrip and one set of its raws. The late sink for scrip. */
export function tierUp(run: Run, i: number): boolean {
  if (tierUpBlock(run, i) !== null) return false;
  const p = run.player, w = p.weapons[i];
  const raws = tierUpRaws(run, i);
  p.scrip -= tierUpCost(run, i) - shortOf(run, raws) * rawPrice(run);
  payRaws(run, raws);
  w.tier++;
  run.buyLog.push('up:' + w.id);
  rebuild(run);
  return true;
}

/** Why offer i cannot be bought right now, or null if it can. */
export function buyBlock(run: Run, i: number): string | null {
  const o = run.bench.offers[i], p = run.player;
  if (run.phase !== 'bench' || !o) return 'Not at the bench.';
  if (o.sold) return 'Sold.';
  // Raws the player is short of are charged in scrip at rawPrice.
  if (p.scrip < offerCost(run, i)) return 'Not enough scrip.';
  if (o.kind === 'weapon' && !canHoldWeapon(run, WEAPON_INDEX[o.id], o.tier)) return 'No free weapon slot.';
  return null;
}

export function buy(run: Run, i: number): boolean {
  if (buyBlock(run, i) !== null) return false;
  const b = run.bench, o = b.offers[i], p = run.player;
  p.scrip -= o.price;
  payRaws(run, o.raws);
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
  for (const x of b.offers) if (!x.sold && !x.commission) all = false;
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
  /** Scrip charged for raws the player is short of. */
  scrip: number;
}

function fuseRaws(run: Run, tier: number): RawBag {
  if (run.bench.freeFuses > 0) return emptyRaws();
  // The anvil runs hot: each fusion already paid for at this bench adds one more set of raws to the next.
  const c = RUN_FUSE_RAW_COST[tier], n = 1 + run.bench.fuses;
  return { timber: c.timber * n, ore: c.ore * n, hide: c.hide * n };
}

/** Quote a fusion of held items a and b (indices into player.items). */
export function fuseCost(run: Run, a: number, b: number): FuseQuote {
  const p = run.player, A = p.items[a], B = p.items[b];
  const q: FuseQuote = { block: null, budget: 0, tier: 1, raws: emptyRaws(), scrip: 0 };
  if (run.phase !== 'bench') { q.block = 'Fusing is done at the bench.'; return q; }
  if (!A || !B || a === b) { q.block = 'Pick two different items.'; return q; }
  q.block = fusionBlock(A, B);
  q.budget = fusionBudget(A, B);
  q.tier = tierOf(q.budget);
  q.raws = fuseRaws(run, q.tier);
  q.scrip = shortOf(run, q.raws) * rawPrice(run);
  if (!q.block && p.scrip < q.scrip) q.block = 'Not enough raws, and not enough scrip to cover them.';
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
  if (p.scrip < shortOf(run, cost) * rawPrice(run)) return 'Not enough raws, and not enough scrip to cover them.';
  payRaws(run, cost);
  if (run.bench.freeFuses > 0) run.bench.freeFuses--; else run.bench.fuses++;
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
