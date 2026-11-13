// Pieces shared by the expedition screens: the status in the top bar, stat names and "now -> after" lines,
// the bag as a weight-limited panel, the controls list.
import { CFG, CURSES, EVOLVE_MUL, EVOLVE_TIER, ITEMS, KITS, MATS, MUTATORS, PERKS, RECIPES, TIER_MUL, WEAPONS, WILDS, modText, type Mat, type ModKey, type Mods } from '../data';
import type { WeaponInst } from '../game';
import { BINDINGS } from '../input';
import * as M from '../meta';
import * as R from '../run';
import type { UI } from './app';
import * as I from './icons';
import { bar, chip, esc, ic, tile, ui as icon, type TileOpts } from './kit';
import { cap, describe, roman, type Desc } from './things';

/** A tile that is not a button, for use inside a button (a card that is itself the control). */
export const stile = (d: Desc, o: TileOpts = {}) => tile(d, o).replace('<button type="button"', '<span role="img"').replace(/<\/button>$/, '</span>');
export const tip = (text: string) => `data-tip="text:${esc(text)}"`;
export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const keepShare = (ui: UI) => Math.min(1, CFG.keptOnDeath + 0.08 * (ui.p.standing.cards.keep ?? 0));

// ------------------------------------------------------------------ stats
const sp = (v: number) => `${Math.round(v * 100) < 0 ? '−' : '+'}${Math.abs(Math.round(v * 100))}%`; // never "−0%"
const pc = (v: number) => `${Math.round(v * 100) < 0 ? '−' : ''}${Math.abs(Math.round(v * 100))}%`;
const fl = (v: number) => `${v < -0.0001 ? '−' : ''}${Math.abs(Math.round(v * 10) / 10)}`;
const yes = (v: number) => (v > 0 ? 'yes' : 'no');
/** A short name for every modifier, and how its running total reads. */
export const STAT: Record<ModKey, [string, (v: number) => string]> = {
  dmg: ['Damage', sp], dmgMul: ['Damage multiplier', (v) => `×${v.toFixed(2)}`], atk: ['Attack speed', sp], speed: ['Move speed', sp],
  hp: ['Max health', (v) => fl(CFG.player.hp + v)], regen: ['Health per second', fl], stam: ['Stamina regeneration', sp], armor: ['Armour', fl],
  magnet: ['Pickup reach', (v) => fl(CFG.player.magnet + v)], crit: ['Double-hit chance', pc], range: ['Weapon range', sp], cd: ['Ability cooldown cut', pc],
  burn: ['Burn per second', fl], chill: ['Slow on hit', pc], chain: ['Chain damage', pc], pierce: ['Extra pierce', fl], leech: ['Heal per kill', fl], thorns: ['Thorns', fl],
  heatCool: ['Heat cooling', sp], heatGain: ['Heat from strikes', sp], yield: ['Node yield', sp], weight: ['Weight lightened', pc], heavyCost: ['Heavy swing stamina saved', pc],
  heavyDmg: ['Heavy swing damage', sp], scrap: ['Scrap gain', sp], drops: ['Drops from kills', (v) => (v <= -1 ? 'none' : sp(v))], noHeal: ['No healing', yes],
  detonate: ['Node-strike blast', fl], splinter: ['Node-strike splinters', fl], stagger: ['Node-strike stun', (v) => `${v.toFixed(1)}s`], slip: ['Dodge-through damage', fl],
  quick: ['Swap bonus', sp], wind: ['Stamina per kill', fl], furnace: ['Damage at full heat', sp], ballast: ['Damage per 100 weight', sp], ward: ['Node ward', yes],
  still: ['Damage standing still', sp],
};
/** Limits the arena applies (game.ts): more of the stat than this changes nothing. */
export const CAPS: Partial<Record<ModKey, number>> = { cd: 0.6, heavyCost: 0.7, weight: 1, chill: 0.6, crit: 1 };
export const capped = (k: ModKey, v: number) => Math.min(CAPS[k] ?? Infinity, v);
export function statNow(k: ModKey, m: Mods, run: R.RunState): string {
  return k === 'hp' ? String(R.maxHp(run, m)) : STAT[k][1](capped(k, m[k]));
}
/** Said wherever heat cooling is offered or described to a kit whose heat does not cool. */
export const NO_COOL = 'no effect: with the Firebrand kit heat does not cool during a wave';
/** More of these is not simply good. */
const MIXED: ModKey[] = ['heatGain', 'noHeal'];
export interface Change {
  key: ModKey;
  html: string;
}
/** What moves between two versions of the run, as "Damage +10% → +18%". */
export function changes(run: R.RunState, after: R.RunState): Change[] {
  const a = R.runMods(run);
  const b = R.runMods(after);
  const out: Change[] = [];
  const line = (k: ModKey, body: string) => out.push({ key: k, html: `<div class="fx">${ic(I.modIcon(k))}<span><span class="dim">${STAT[k][0]}</span> ${body}</span></div>` });
  // Damage is one number on every screen: the total the Damage cell shows (set bonuses, Seventh hand, bag weight and carried heat included).
  const fa = dmgFactor(run, a);
  const fb = dmgFactor(after, b);
  if (sp(fa - 1) !== sp(fb - 1)) line('dmg', `${sp(fa - 1)} → <b class="${fb > fa ? 'ok' : 'bad'}">${sp(fb - 1)}</b>`);
  for (const k of Object.keys(STAT) as ModKey[]) {
    if (k === 'dmg' || k === 'dmgMul' || Math.abs(a[k] - b[k]) < 1e-6) continue;
    const from = statNow(k, a, run);
    const to = statNow(k, b, after);
    const up = b[k] > a[k];
    const cap = CAPS[k];
    if (from === to) {
      if (cap !== undefined && up && a[k] >= cap - 1e-9) line(k, `${from} <b class="warn">(capped: no change)</b>`);
      continue;
    }
    const cls = MIXED.includes(k) ? (up ? 'warn' : 'ok') : up ? 'ok' : 'bad';
    const notes = [cap !== undefined && b[k] > cap + 1e-9 ? '(capped)' : '', k === 'heatCool' && R.kitOf(after).heatHolds ? `· ${NO_COOL}` : ''].filter(Boolean).join(' ');
    line(k, `${from} → <b class="${cls}">${to}</b>${notes ? ` <span class="warn">${notes}</span>` : ''}`);
  }
  return out;
}
export const changeLines = (run: R.RunState, after: R.RunState) => changes(run, after).map((c) => c.html).join('');
export const fx = (html: string, cls = '') => `<div class="fx ${cls}"><span>${html}</span></div>`;

/** What the weight in the bag adds to damage right now (the Ballast harness): the next wave starts with exactly this. */
export function ballastBonus(run: R.RunState, m: Mods): number {
  return m.ballast > 0 ? m.ballast * (R.bagWeight(run, m) / 100) : 0;
}
/** What the heat carried into the next wave adds to damage as it starts (Furnace heart, Firebrand): it moves with heat during the wave. */
export function heatBonus(run: R.RunState, m: Mods): number {
  return m.furnace > 0 ? m.furnace * Math.min(1, run.heat / CFG.heat.max) : 0;
}
/** All weapons' damage multiplier as the next wave starts, as game.ts computes it: the arena adds standing still on top,
 *  the heat bonus moves with heat and the weight bonus grows as the bag fills during the wave. */
export function dmgFactor(run: R.RunState, m: Mods): number {
  const slot = run.wilds.includes('slot') ? Math.max(0.4, 1 - 0.02 * run.weapons.length) : 1;
  return Math.max(0.1, (1 + m.dmg) * m.dmgMul * slot * (1 + heatBonus(run, m)) * (1 + ballastBonus(run, m)));
}
type WeaponLike = Pick<WeaponInst, 'fam' | 'tier' | 'gs' | 'evolved'> & { variant?: boolean };
export interface WeaponNums {
  hit: number; // one hit (one shard, for a frost staff)
  shots: number; // hits per attack: three shards for a frost staff
  every: number;
  dps: number; // on one target; for a frost staff, with one shard landing
  dpsHi: number; // the same with every shard landing; equal to dps for the other families
  range: number;
  base: number; // damage per second of the weapon alone
  note: string; // what the per-second figure includes or leaves out, when it is not simply hit / interval
}
/** A weapon's numbers with the build applied (damage, attack speed, double hits, range): the same for a carried weapon and an offer.
 *  Each special case repeats a rule in game.ts (updateWeapons, hit, explode). */
export function weaponNums(w: WeaponLike, run: R.RunState, m: Mods): WeaponNums {
  const d = WEAPONS[w.fam];
  const raw = d.dmg * TIER_MUL[w.tier] * (0.9 + 0.2 * w.gs) * (w.evolved ? EVOLVE_MUL : 1);
  const hit = raw * dmgFactor(run, m);
  const every = d.every / Math.max(0.2, 1 + m.atk);
  const crit = 1 + Math.min(1, Math.max(0, m.crit));
  let dps = (hit / every) * crit;
  let dpsHi = dps;
  let shots = 1;
  const notes: string[] = [];
  if (w.fam === 'frost') {
    shots = 3;
    // a frost hit slows, so every Shatter staff hit after the first lands on a slowed enemy
    const shatter = w.variant ? 1.3 : 1;
    const aura = w.evolved ? hit * crit * shatter : 0; // the Blizzard staff: half a hit every half second, to everything within 260
    dps = dps * shatter + aura;
    dpsHi = (dpsHi * shatter) * shots + aura;
    notes.push(`Three shards a shot: ${dps.toFixed(0)} a second with one shard landing (far targets), ${dpsHi.toFixed(0)} with all three (close or large ones).`);
    if (w.variant) notes.push('Both count +30% on slowed enemies, which its own hits slow.');
    if (aura > 0) notes.push(`Both count its aura: ${aura.toFixed(0)} a second to everything within 260.`);
  } else if (w.evolved && w.fam === 'hammer') {
    dps *= 1.5;
    dpsHi = dps;
    notes.push('Per second counts the second shockwave: half the damage again, over a wider circle.');
  } else if (w.evolved && w.fam === 'fire') notes.push('Direct hits only: the burning ground each fireball leaves does up to 180% more to enemies that stay in it.');
  else if (w.evolved && w.fam === 'bow') notes.push('Direct hits only: its split arrows and piercing hit other enemies on top.');
  return { hit, shots, every, dps, dpsHi, range: d.range * (1 + m.range) * (w.fam === 'blade' && w.evolved ? 1.8 : 1), base: raw / d.every, note: notes.join(' ') };
}
/** "24" or, when it depends on how many shards land, "10–30". */
export const span = (lo: number, hi: number) => (Math.round(hi) > Math.round(lo) ? `${lo.toFixed(0)}–${hi.toFixed(0)}` : lo.toFixed(0));
export const dpsText = (n: WeaponNums) => span(n.dps, n.dpsHi);
const hitText = (n: WeaponNums) => `${n.shots > 1 ? `${n.shots} × ` : ''}${n.hit.toFixed(0)}`;
/** The four fields every weapon is shown with, and under them what the per-second figure counts when that is not plain. */
export function weaponFields(n: WeaponNums, about = false): string {
  const f = (label: string, value: string) => `<span><small>${label}</small><b class="num">${value}</b></span>`;
  return `<div class="wf" ${tip(`Damage per hit, seconds between attacks, damage per second on one target and range, with your build's bonuses applied.${about ? ' The gear score is rolled when you buy: these can land 10% either way.' : ''}`)}>${f('Damage', `${about ? '≈' : ''}${hitText(n)}`)}${f('Every', `${n.every.toFixed(2)} s`)}${f('Per second', `${about ? '≈' : ''}${dpsText(n)}`)}${f('Range', n.range.toFixed(0))}</div>${n.note ? `<div class="dim small">${n.note}</div>` : ''}`;
}
/** The run as it would be after merging weapons i and j (the roll aside: merging rerolls it). The lower slot keeps the weapon, as in run.ts. */
export function mergeAfter(run: R.RunState, i: number, j: number): R.RunState {
  const [keep, drop] = i < j ? [i, j] : [j, i];
  return { ...run, weapons: run.weapons.filter((_, k) => k !== drop).map((w, k) => (k === keep ? { ...w, tier: w.tier + 1, variant: w.variant || run.weapons[drop].variant } : w)) };
}
/** Stat lines for use inside a span (a callout): the same lines, as inline elements. */
export const inlineFx = (lines: string) => lines.replace(/<div class="fx/g, '<span class="fx').replace(/<\/div>/g, '</span>');
/** Honest numbers for merging two carried weapons of one kind and tier, taken from the run as it would be after the merge:
 *  one stronger hit replaces two, a slot comes free, and from tier II up the set loses points, which can cost a set bonus.
 *  `lines` are the stats the merge moves for the whole build. */
export function mergePreview(run: R.RunState, m: Mods, i: number, j: number): { text: string; lines: string } {
  const a = run.weapons[i];
  const b = run.weapons[j];
  const k = Math.min(i, j);
  const after = mergeAfter(run, i, j);
  const am = R.runMods(after);
  const na = weaponNums(a, run, m);
  const nb = weaponNums(b, run, m);
  const lo = weaponNums({ ...after.weapons[k], gs: 0 }, after, am);
  const hi = weaponNums({ ...after.weapons[k], gs: 1 }, after, am);
  const one = (n: WeaponNums) => (n.shots > 1 ? `(${hitText(n)})` : hitText(n));
  const hits = Math.round(na.hit) === Math.round(nb.hit) ? `2 × ${one(na)}` : `${one(na)} + ${one(nb)}`;
  const becomes = `${lo.shots > 1 ? `${lo.shots} × ` : '1 × '}${span(lo.hit, hi.hit)}`;
  const restNow = run.weapons.reduce((sum, w, x) => (x === i || x === j ? sum : sum + weaponNums(w, run, m).dps), 0);
  const restThen = after.weapons.reduce((sum, w, x) => (x === k ? sum : sum + weaponNums(w, after, am).dps), 0);
  const rest = Math.round(restNow) !== Math.round(restThen) ? ` Your other weapons go from ${restNow.toFixed(0)} to <b class="${restThen > restNow ? 'ok' : 'bad'}">${restThen.toFixed(0)}</b> a second.` : '';
  const p0 = R.famCounts(run)[a.fam] ?? 0;
  const p1 = R.famCounts(after)[a.fam] ?? 0;
  const text = `${hits} damage per volley becomes ${becomes}: <b>${span(na.dps + nb.dps, na.dpsHi + nb.dpsHi)} → ${span(lo.dps, hi.dpsHi)}</b> damage per second. It frees a slot; ${WEAPONS[a.fam].name} set points ${p0} → ${p1}.${rest}${a.tier + 1 === EVOLVE_TIER ? ` Tier ${roman(EVOLVE_TIER)} can evolve at a boss chest.` : ''}`;
  return { text, lines: changeLines(run, after) };
}
/** The share of speed and stamina regeneration the bag costs right now. */
export function slowOf(run: R.RunState, m = R.runMods(run), w = R.bagWeight(run, m)): number {
  if (run.wilds.includes('stoneback')) return 0;
  return Math.min(CFG.player.slowMax, Math.max(0, w - run.comfort) * CFG.player.slowPerWeight);
}
// ----------------------------------------------- what the player did at this camp (never saved)
export interface Sale {
  key: string;
  at: number;
  w: WeaponInst;
  price: number;
}
/** Choices that belong to the screen, not to the rules: which ground was picked at this camp, the last sale (for undo), the route just played. */
export const st = { sale: null as Sale | null, tallyShown: '' };
/** What the screens remember about the camp before this wave. It lives on the run, so it is saved with it. */
export function campMemo(run: R.RunState): NonNullable<R.RunState['memo']> {
  if (!run.memo) run.memo = { wave: run.wave, routed: false, crafted: [], played: null };
  if (run.memo.wave !== run.wave) Object.assign(run.memo, { wave: run.wave, routed: false, crafted: [] });
  return run.memo;
}
// Keyed by the run object, not its seed: the weekly race starts from the same seed every time.
const runIds = new WeakMap<object, number>();
let runN = 0;
export const campKey = (run: R.RunState) => {
  let id = runIds.get(run);
  if (!id) runIds.set(run, (id = ++runN));
  return `${id}:${run.wave}`;
};
/** True once the player has picked the next ground at this camp (or there is nothing to pick). */
export const routeChosen = (run: R.RunState) => !run.feat.routes || run.routeOptions.length < 2 || (run.memo?.wave === run.wave && run.memo.routed);
/** The curse that will be in force in the next wave: the one carried, or the chosen shrine's. */
export const curseNext = (run: R.RunState) => run.curse ?? (run.phase === 'camp' && routeChosen(run) ? run.route.shrine?.curse ?? null : null);
/** A Frail shrine is chosen but not yet in force: leaving camp cuts maximum health and takes the excess with it (run.ts leaveCamp). */
export const frailAhead = (run: R.RunState) => run.curse !== 'frail' && curseNext(run) === 'frail';
/** Maximum health as the next wave will start with it. */
export const maxHpNext = (run: R.RunState, m = R.runMods(run)) => R.maxHp(frailAhead(run) ? { ...run, curse: 'frail' } : run, m);

// --------------------------------------------------------------- top bar
/** Wave, health, scrap, level and bag weight: the right side of the top bar on every expedition screen. */
export function cur(ui: UI, run: R.RunState): string {
  const m = R.runMods(run);
  const max = maxHpNext(run, m);
  const hp = Math.min(Math.round(run.hp), max);
  const rest = noHealNow(run, m) ? `No rest between waves: ${run.wilds.includes('haggler') ? 'Haggler forbids it' : 'an active effect forbids healing'}.` : `Resting between waves heals ${CFG.healBetweenWaves}.`;
  const w = R.bagWeight(run, m);
  const slow = slowOf(run, m, w);
  const total = R.runWaves(run);
  const next = run.phase === 'camp' || run.phase === 'wave';
  const SHORT: Record<string, string> = { Wave: 'Wave', Cleared: 'Done', Health: 'HP', Scrap: 'Scrap', Level: 'Lv', Bag: 'Bag' };
  const stat = (name: string, label: string, value: string, text: string, cls = '') =>
    `<span class="rstat ${cls}" ${tip(text)}>${icon(name)}<span class="rl" data-s="${SHORT[label] ?? label}" aria-label="${label}"><span>${label}</span></span><b class="num">${value}</b></span>`;
  return [
    stat('wave', next ? 'Wave' : 'Cleared', `${next ? Math.min(run.wave + 1, total) : run.totals.wavesCleared}<i>/${total}</i>`,
      next ? `The next wave is wave ${Math.min(run.wave + 1, total)} of ${total}. Waves ${[4, 8, 12].filter((x) => x <= total).join(', ')} are boss waves.` : `${plural(run.totals.wavesCleared, 'wave')} cleared of ${total}.`),
    stat('heart', 'Health', `${hp}<i>/${max}</i>`, `Health. ${rest}${frailAhead(run) ? ` With the Frail shrine chosen, the wave starts with a maximum of ${max}.` : ''}`, hp / max < 0.35 ? 'low' : ''),
    stat('scrap', 'Scrap', String(run.scrap), 'Scrap buys from the camp shop. It is left behind when the expedition ends.'),
    stat('level', 'Level', String(run.level), `Level ${run.level}: ${Math.floor(run.xp)} of ${R.xpNeed(run.level)} xp to the next. Each level is a pick of three.`),
    stat('bag', 'Bag', `${w.toFixed(0)}<i>/${run.comfort}</i>`,
      slow > 0 ? `The bag weighs ${w.toFixed(1)}; it carries ${run.comfort} in comfort. You are ${Math.round(slow * 100)}% slower and stamina returns ${Math.round(slow * 100)}% slower.` : `The bag weighs ${w.toFixed(1)}; it carries ${run.comfort} before it slows you.`,
      slow >= 0.2 ? 'low' : slow > 0 ? 'over' : ''),
  ].join('');
}

// ------------------------------------------------------------------- bag
const CAT_ORDER: Mat['cat'][] = ['ore', 'wood', 'herb', 'creature', 'part'];
const CAT_NAME: Record<Mat['cat'], string> = { ore: 'Ore', wood: 'Wood', herb: 'Herbs', creature: 'Creature parts', part: 'Elite and boss parts' };
export const matSort = (a: string, b: string) => CAT_ORDER.indexOf(MATS[a].cat) - CAT_ORDER.indexOf(MATS[b].cat) || MATS[a].tier - MATS[b].tier || a.localeCompare(b);
export const matIds = (rec: Record<string, number>) => Object.keys(rec).filter((id) => rec[id] > 0 && MATS[id]).sort(matSort);
export const matCount = (rec: Record<string, number>) => matIds(rec).reduce((a, id) => a + rec[id], 0);

/** Material tiles: round for stackables, square for parts. `ref` is "bag" inside an expedition, "mat" for storage. */
export function matTiles(ui: UI, rec: Record<string, number>, o: { ref?: 'bag' | 'mat'; size?: 'xs' | 'sm'; plus?: boolean; dim?: boolean } = {}): string {
  return matIds(rec).map((id) => tile(describe(`${o.ref ?? 'bag'}:${id}`, ui.ctx), {
    size: o.size, qty: `${o.plus ? '+' : ''}${rec[id]}`, round: MATS[id].cat !== 'part', dim: o.dim, label: `${rec[id]} ${MATS[id].name}`,
  })).join('');
}
export function schemTiles(ui: UI, ids: string[], o: { size?: 'xs' | 'sm'; dim?: boolean } = {}): string {
  return ids.map((id) => tile(describe(`schem:${id}`, ui.ctx), { size: o.size, dim: o.dim })).join('');
}
/** What the bag holds, in words: "38 materials and 2 schematics". */
export function bagWords(run: R.RunState): string {
  const n = matCount(run.bagMats);
  const s = run.bagSchem.length;
  if (!n && !s) return 'nothing';
  return [n ? plural(n, 'material') : '', s ? plural(s, 'schematic') : ''].filter(Boolean).join(' and ');
}

/** The weight bar: fill against the comfort tick, amber then red as the slowing grows. */
export function weightBar(run: R.RunState): string {
  const m = R.runMods(run);
  const w = R.bagWeight(run, m);
  const slow = slowOf(run, m, w);
  const scale = Math.max(run.comfort * 2, w * 1.15, 1);
  const at = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  const state = slow >= 0.2 ? 'bad' : slow > 0 ? 'warn' : '';
  const free = Math.max(0, run.comfort - w);
  const maxAt = run.comfort + CFG.player.slowMax / CFG.player.slowPerWeight;
  return `<div class="wnum ${state}"><b class="num">${w.toFixed(1)}</b><span class="dim">weight of</span><b class="num">${run.comfort}</b><span class="dim">carried in comfort</span></div>
    <div class="wbar ${state}" role="img" aria-label="Bag weight ${w.toFixed(1)}, comfort ${run.comfort}"><i style="width:${at(w)}"></i><s style="left:${at(run.comfort)}"></s></div>
    <div class="wends"><span style="left:${at(run.comfort)}">comfort ${run.comfort}</span></div>
    <p class="${state || 'dim'} small" style="margin:2px 0 8px">${
      run.wilds.includes('stoneback') ? 'Stone back: weight never slows you.'
      : slow > 0 ? `<b class="${state}">${Math.round(slow * 100)}% slower</b> on your feet, and stamina returns ${Math.round(slow * 100)}% slower. Every weight over the comfort costs ${(CFG.player.slowPerWeight * 100).toFixed(2)}%, up to ${Math.round(CFG.player.slowMax * 100)}% at ${Math.round(maxAt)}.`
      : `No slowdown: room for ${free.toFixed(0)} more weight. Over the comfort, every weight costs ${(CFG.player.slowPerWeight * 100).toFixed(2)}% speed and stamina regeneration, up to ${Math.round(CFG.player.slowMax * 100)}%.`}</p>`;
}

/** The bag as a small inventory panel: weight against comfort, tiles per material, what is at risk. */
export function bagPanel(ui: UI, run: R.RunState, risk: string): string {
  const m = R.runMods(run);
  const ids = matIds(run.bagMats);
  const wOf = (id: string) => run.bagMats[id] * MATS[id].weight * (run.burden === MATS[id].cat ? 0.6 : 1) * Math.max(0, 1 - m.weight);
  const groups = CAT_ORDER.map((c) => {
    const list = ids.filter((id) => MATS[id].cat === c);
    if (!list.length) return '';
    const sub: Record<string, number> = {};
    for (const id of list) sub[id] = run.bagMats[id];
    const w = list.reduce((a, id) => a + wOf(id), 0);
    return `<div class="bcat"><div class="cat">${CAT_NAME[c]} <small>${w.toFixed(1)} weight${run.burden === c ? ' · lightened 40% by this bag' : ''}</small></div><div class="tiles">${matTiles(ui, sub)}</div></div>`;
  }).join('');
  const schem = run.bagSchem.length ? `<div class="bcat"><div class="cat">Schematics <small>no weight</small></div><div class="tiles">${schemTiles(ui, run.bagSchem)}</div></div>` : '';
  const lighten = [
    run.burden && !ids.some((id) => MATS[id].cat === run.burden) ? `This bag makes ${run.burden === 'herb' ? 'herbs' : run.burden} 40% lighter.` : '',
    m.weight > 0 ? `Your build makes all weight count ${Math.round(Math.min(1, m.weight) * 100)}% less.` : '',
  ].filter(Boolean).join(' ');
  return `<div class="panel bag"><h2>Bag</h2>${weightBar(run)}
    ${groups || schem ? `<div class="bcats">${groups}${schem}</div>` : '<p class="dim">Empty. Mine nodes with the heavy swing; kills leave creature parts.</p>'}
    ${lighten ? `<p class="dim small" style="margin-top:8px">${lighten}</p>` : ''}
    <p class="risk small">${risk}</p></div>`;
}

// ---------------------------------------------------------------- weapons
export function weaponTile(ui: UI, run: R.RunState, i: number, o: { a?: string; sel?: boolean; dim?: boolean; size?: 'xs' | 'sm' } = {}): string {
  return tile(describe(`rw:${i}`, ui.ctx), { a: o.a, v: `rw:${i}`, sel: o.sel, dim: o.dim, size: o.size });
}
export const emptySlot = (label = 'Empty weapon slot') => `<span class="tile empty static" role="img" aria-label="${label}" ${tip(`${label}. Buy a weapon in the shop to fill it.`)}>${I.weaponIcon('blade')}</span>`;

// -------------------------------------------------------------- evolution
/** The three conditions for evolving a weapon at a boss chest, ticked or crossed, so the one that fails is plain. */
export function evolveChecklist(run: R.RunState): { html: string; ok: boolean } {
  const live = run.weapons.filter((w) => !w.evolved);
  const tiered = live.filter((w) => w.tier >= EVOLVE_TIER);
  const ready = tiered.filter((w) => run.recipes.includes(`evo-${w.fam}`) || run.abilities.includes(w.fam));
  const parts = R.eliteParts(run);
  const names = (list: WeaponInst[]) => [...new Set(list.map((w) => R.weaponName(w)))].join(', ');
  const brought = run.abilities.map((f) => WEAPONS[f].name.toLowerCase()).join(', ');
  const recipes = run.recipes.filter((id) => RECIPES[id]?.kind === 'evolution').map((id) => RECIPES[id].name);
  const best = [...live].sort((a, b) => b.tier - a.tier)[0];
  const line = (ok: boolean, text: string) => `<div class="req ${ok ? 'ok' : 'bad'}">${icon(ok ? 'check' : 'cross')}<span>${text}</span></div>`;
  const html = line(tiered.length > 0, tiered.length ? `A weapon of tier ${roman(EVOLVE_TIER)} or higher: ${names(tiered)}.` : `A weapon of tier ${roman(EVOLVE_TIER)} or higher. Highest now: ${best ? R.weaponName(best) : 'none'}; merge pairs to raise it.`)
    + line(ready.length > 0, ready.length ? `Of a kind you brought or hold the recipe for: ${names(ready)}.` : `Of a kind you brought (${brought})${recipes.length ? ` or hold the recipe for (${recipes.join(', ')})` : ' or packed an evolution recipe for (none packed)'}.${tiered.length ? ` ${names(tiered)} ${tiered.length > 1 ? 'do' : 'does'} not qualify.` : ''}`)
    + line(parts.length > 0, parts.length ? `A named elite's part in the bag: ${parts.map((id) => MATS[id].name).join(', ')}.` : 'A named elite\'s part in the bag. Take a ground marked "Named elite" and kill it; a boss part does not count.');
  return { html, ok: ready.length > 0 && parts.length > 0 };
}

// ----------------------------------------------------------------- health
export const noHealNow = (run: R.RunState, m: Mods) => m.noHeal > 0 || run.wilds.includes('haggler');
/** Health as a bar that turns red under 40%. */
export function healthBar(run: R.RunState, m = R.runMods(run)): string {
  const max = maxHpNext(run, m);
  const now = Math.min(Math.round(run.hp), R.maxHp(run, m));
  const hp = Math.min(now, max);
  const low = hp / max < 0.4;
  const frail = frailAhead(run) ? `<p class="warn small" style="margin:2px 0 0">Frail shrine chosen: the wave starts with a maximum of ${max} health, not ${R.maxHp(run, m)}.${now > hp ? ` ${now - hp} of your ${now} health is lost when you leave camp.` : ''} Healing above ${max} is wasted.</p>` : '';
  return `<div class="hpline"><small>Health</small>${bar(hp / max, `tall ${low ? 'red' : 'green'}`)}<b class="num ${low ? 'bad' : ''}">${hp}<i>/${max}</i></b></div>${frail}`;
}
/** The ways to heal that are open right now, in words. `next`: speaking of the camps ahead (at a gate) rather than this one. */
export function healWays(run: R.RunState, m = R.runMods(run), next = false): string[] {
  const out: string[] = [];
  const dry = run.mutators.includes('dryshop');
  out.push(noHealNow(run, m) ? `<span class="warn">No rest between waves: ${run.wilds.includes('haggler') ? 'Haggler forbids it' : 'an active effect forbids healing'}.</span>` : `Rest after every wave: <b>+${CFG.healBetweenWaves}</b>.`);
  // each way is listed only while the rules would allow it: canBuy, canCraft and heal() in game.ts
  const barred = m.noHeal > 0; // an effect that forbids healing of every kind (Haggler forbids only the rest and the shop)
  if (dry || run.wilds.includes('haggler')) out.push(`<span class="warn">The shop sells no healing (${dry ? 'Dry shop, this week' : 'Haggler'}).</span>`);
  else if (barred) out.push('<span class="warn">The shop will not sell you healing while that effect lasts.</span>');
  else if (next) out.push('The shop may sell Field rations: +35.');
  else {
    const i = run.shop.findIndex((o) => !o.sold && o.kind === 'item' && ITEMS[o.item!].heal);
    out.push(i >= 0 ? `Shop: <b>${ITEMS[run.shop[i].item!].name} +${ITEMS[run.shop[i].item!].heal}</b> for ${run.shop[i].price} scrap.` : 'No healing in the shop at this camp; a reroll may bring some.');
  }
  if (run.feat.craft) {
    for (const id of run.recipes) {
      const r = RECIPES[id];
      if (!r?.heal) continue;
      const need = R.craftCost(run, id);
      const have = Object.keys(run.bagMats).filter((x) => run.bagMats[x] > 0 && MATS[x].cat === r.cost!.cat).reduce((n, x) => n + run.bagMats[x], 0);
      // at a gate the camps ahead are meant, so this camp's used craft and the curse (lifted by the boss wave) do not count
      const shut = barred ? 'healing is forbidden' : next ? '' : run.curse === 'barren' ? 'the Barren curse forbids camp craft' : run.craftsLeft <= 0 ? 'this camp\'s craft is used' : '';
      out.push(shut ? `<span class="warn">Camp craft: no ${r.name} ${next ? 'while' : 'here:'} ${shut}.</span>` : `Camp craft: <b>${r.name} +${r.heal}</b> for ${need} herbs (the bag holds ${have}).`);
    }
  }
  if (!next && !barred && run.feat.routes && run.routeOptions.some((r) => !r.shrine && (r.objective === 'supply' || r.objective === 'nests'))) out.push('A Supply drop or Nests objective heals <b>15</b> when done.');
  return out;
}

// ------------------------------------------------------- this expedition
/** Kit, danger, weekly mutators, curse, wild picks and the gear brought from town: the rules of this run, on one line. */
export function expeditionStrip(ui: UI, run: R.RunState): string {
  const kit = KITS.find((k) => k.id === run.kit) ?? KITS[0];
  const k = CFG.key;
  const L = run.keyLevel - 1;
  const chips: string[] = [
    `<span data-tip="kit:${kit.id}">${chip(`Kit: ${kit.name}`, I.uiIcon('equip'))}</span>`,
    `<span ${tip(L > 0 ? `Danger ${run.keyLevel}: enemies have +${Math.round(k.hp * L * 100)}% health, deal +${Math.round(k.dmg * L * 100)}% damage and come +${Math.round(k.rate * L * 100)}% faster; nodes yield +${Math.round(k.yield * L * 100)}%; coin +${25 * L}%.` : 'Danger 1: the base difficulty. A higher key raises enemy health, damage and numbers, node yield and coin.')}>${chip(`Danger ${run.keyLevel}`, I.uiIcon('key'))}</span>`,
    ...(run.race ? [chip('Weekly race: nothing banked, nothing lost', I.uiIcon('timer'), 'gold')] : []),
    ...run.mutators.map((id) => `<span data-tip="mut:${id}">${chip(`This week: ${MUTATORS[id].name}`, I.uiIcon('skull'), 'warn')}</span>`),
    ...(run.curse ? [`<span ${tip(`${CURSES[run.curse].name}: ${CURSES[run.curse].text}. A shrine's curse lasts until the next boss wave is over.`)}>${chip(`Cursed: ${CURSES[run.curse].name}`, I.uiIcon('shrine'), 'bad')}</span>`] : []),
    ...run.wilds.map((id) => `<span data-tip="wild:${id}">${chip(WILDS.find((w) => w.id === id)!.name, I.uiIcon('star'), 'gold')}</span>`),
  ];
  if (!run.race) {
    // what this expedition left town with, not what is equipped now: the loadout can be changed while a run waits
    const l = ui.p.loadout;
    const b = run.brought;
    const weapons = (b ? b.weapons : l.weapons).map((u) => M.gearBy(ui.p, u)).filter((g) => g?.kind === 'weapon');
    // a save from before the record was kept: show the loadout only if it still matches the expedition
    if (b || (weapons.length && weapons.every((g) => g!.kind === 'weapon' && run.abilities.includes(g!.fam)))) {
      for (const g of weapons) if (g?.kind === 'weapon') chips.push(`<span data-tip="gear:${g.uid}">${chip(`${g.name}${g.perks.length ? `: ${g.perks.map((x) => PERKS[x]?.name).join(', ')}` : ''}`, I.weaponIcon(g.fam))}</span>`);
      const tool = M.gearBy(ui.p, (b ? b.tool : l.tool) ?? -1);
      if (tool?.kind === 'tool' && tool.node === run.toolNode) chips.push(`<span data-tip="gear:${tool.uid}">${chip(tool.name, I.toolIcon(tool.node, tool.tier))}</span>`);
      const bag = M.gearBy(ui.p, (b ? b.bag : l.bag) ?? -1);
      if (bag?.kind === 'bag' && bag.comfort === run.comfort) chips.push(`<span data-tip="gear:${bag.uid}">${chip(`${bag.name}: comfort ${bag.comfort}`, I.bagIcon(bag.type))}</span>`);
    }
  }
  return `<div class="xstrip" aria-label="This expedition"><small>This expedition</small>${chips.join('')}</div>`;
}

// --------------------------------------------------------------- controls
const caps = (keys: string[]) => keys.map((k) => `<kbd>${k}</kbd>`).join(' ');
/** Every control, for desktop and touch, from the same list the input code reads. A touch device sees its own column first. */
export function controls(): string {
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const rows = BINDINGS.map((b) => {
    const desk = [b.keys.length ? caps(b.keys) : '', b.mouse].filter(Boolean).join(b.keys.length && b.mouse ? ' or ' : '');
    const d = `<span data-l="Keys and mouse">${desk || '<span class="dim">no key</span>'}</span>`;
    const t = `<span data-l="Touch">${b.touch || '<span class="dim">in the pause menu</span>'}</span>`;
    return `<div class="ctl"><b>${b.name}</b>${touch ? t + d : d + t}</div>`;
  }).join('');
  return `<div class="ctls"><div class="ctl head"><span>Action</span>${touch ? '<span>Touch</span><span>Keyboard and mouse</span>' : '<span>Keyboard and mouse</span><span>Touch</span>'}</div>${rows}</div>`;
}
export const SAVE_FACT = 'The expedition is saved at camp and at boss gates. Leaving in the middle of a wave counts as a fall, and what you gathered in that wave is forfeited.';
/** The small menu on camp and gate: controls, and the two ways out. */
export function menuHtml(ui: UI, run: R.RunState): string {
  const fall = run.race ? 'The race ends; nothing is banked or lost.' : run.feat.loss ? `It counts as a fall: ${Math.round(keepShare(ui) * 100)}% of the bag comes home.` : 'It counts as a fall, but nothing is lost on this expedition.';
  return `<div class="two"><div><button class="big" data-a="leave">${icon('back')} Leave to town (saved here)</button><p class="dim small" style="margin:6px 0 0">The expedition waits at this ${run.phase === 'gate' ? 'gate' : 'camp'}. Continue it from the Expedition tab.</p></div>
    <div><button class="big danger" data-a="abandon">Abandon expedition</button><p class="dim small" style="margin:6px 0 0">${fall}</p></div></div>
    <h4>Controls in the arena</h4>${controls()}<p class="note" style="margin:12px 0 0">${SAVE_FACT}</p>`;
}
export { cap, modText };
