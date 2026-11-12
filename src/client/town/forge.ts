// The forge game in town: refine, make what you fight with, fit parts, raise stations,
// fill the house, trade, and head out with what you made. Kept on this device only.
import type { ItemSpec } from '../../shared/item.ts';
import { RELIC } from '../../shared/content/relics.ts';
import { PARTS, WEAPONS, WEAPON_INDEX, type MadeWeapon } from '../../sim/index.ts';
import {
  BUY_RAW, CHARGES, FALL_KEEP, MASTERWORK, MATS, MAT_KIND, MAT_NAME, RACK, RECIPES, REFINES, SCHEMATIC_ORDER, SELL, SELL_PART, SKILL_NAME,
  STATIONS, T2_LEVEL, T2_MATS, TROPHIES, levelOf, qualityRange, runCoin, weaponMul, type Bag, type Mat, type Recipe, type StationId,
} from '../forge/content.ts';
import { loadForge, saveForge, type ForgeSave, type Made } from '../forge/store.ts';
import type { ForgeProto, RunRecap } from '../seam.ts';
import { itemName, weaponName } from '../ui/describe.ts';
import { setTip } from '../ui/tip.ts';
import { el, stamp } from './dom.ts';
import { headOutForge } from './run.ts';
import { redraw } from './state.ts';

const WEAPON_SLOTS = 6;
const ZONE_NAME = ['', 'The home wood', 'The fen'];
const PART_ADJ = ['Tusked', 'Gland-soaked', 'Clawed', 'Heart-bound', 'Antlered', 'Heartwood'];
type Tab = StationId | 'house' | 'trader';
let tab: Tab = (() => { try { return (localStorage.getItem('scrip.forge.tab') as Tab) || 'forge'; } catch { return 'forge'; } })();

const recipe = (id: string): Recipe | undefined => RECIPES.find((r) => r.id === id);
const known = (s: ForgeSave, r: Recipe): boolean => !r.schematic || s.known.includes(r.id);
const has = (s: ForgeSave, needs: Bag, times = 1): boolean => (Object.entries(needs) as [Mat, number][]).every(([m, n]) => s.mats[m] >= n * times);
const pay = (s: ForgeSave, needs: Bag): void => { for (const [m, n] of Object.entries(needs) as [Mat, number][]) s.mats[m] -= n; };
const needText = (needs: Bag): string => (Object.entries(needs) as [Mat, number][]).map(([m, n]) => `${n} ${MAT_NAME[m].toLowerCase()}`).join(' + ');
const floorOf = (s: ForgeSave): number => s.rack.reduce((a, id) => a + (TROPHIES.find((t) => t.id === id)?.floor ?? 0), 0);
const skillLevel = (s: ForgeSave, st: StationId): number => levelOf(s.xp[STATIONS.find((x) => x.id === st)!.skill]).level;
const today = (): string => new Date().toISOString().slice(0, 10);

function change(fn: (s: ForgeSave) => void): void {
  const s = loadForge();
  fn(s);
  saveForge(s);
  redraw();
}

// ---- what goes out, and what comes home -------------------------------------------

/** What the next run takes, built from what is packed. */
export function forgeLaunch(zone: number): { proto: ForgeProto; ok: boolean } {
  const s = loadForge();
  const weapons: MadeWeapon[] = [];
  const kit: ItemSpec[] = [];
  for (const m of s.made) {
    if (!m.packed || m.charges <= 0) continue;
    const r = recipe(m.recipe);
    if (!r) continue;
    if (r.makes.kind === 'weapon') {
      if (weapons.length >= WEAPON_SLOTS) continue;
      weapons.push({ id: r.makes.weapon, tier: m.tier, mul: weaponMul(m.quality), cap: m.tier + 1, sockets: m.sockets });
      if (m.perk >= 0 && PARTS[m.perk]) kit.push({ ...PARTS[m.perk].item, name: `${m.name}'s ${PARTS[m.perk].name.toLowerCase()}` });
    } else if (r.makes.kind === 'armour') kit.push(r.makes.item);
  }
  const food = recipe(s.packedFood);
  if (food && food.makes.kind === 'food' && (s.food[food.id] ?? 0) > 0) kit.push(food.makes.item);
  for (const id of s.rack) { const t = TROPHIES.find((x) => x.id === id); if (t?.item) kit.push(t.item); }
  const relic = s.shelf.find((x) => x.packed);
  if (relic && RELIC[relic.id]) kit.push(RELIC[relic.id]);
  const teach = SCHEMATIC_ORDER.filter((id) => !s.known.includes(id)).map((id) => recipe(id)!.name);
  return {
    ok: weapons.length > 0,
    proto: { run: { zone, pity: s.pity, weapons, kit }, zoneName: ZONE_NAME[zone] ?? '', t2Names: T2_MATS.map((m) => MAT_NAME[m]), teach },
  };
}

/** A forge run is over: what it carried comes home (half on a fall), keys always do, packed things wear. */
export function bankForge(r: RunRecap): void {
  const f = r.forge;
  if (!f) return;
  const s = loadForge();
  const won = r.report.won, share = won ? 1 : FALL_KEEP;
  const got: Partial<Record<Mat, number>> = {};
  let lost = 0;
  const add = (m: Mat, n: number): void => {
    const k = Math.floor(n * share);
    lost += n - k;
    if (k > 0) { s.mats[m] += k; got[m] = (got[m] ?? 0) + k; }
  };
  add('timber', r.report.raws.timber); add('ore', r.report.raws.ore); add('hide', r.report.raws.hide);
  f.t2.forEach((n, i) => { const m = T2_MATS[i]; if (m) add(m, n); });
  for (const p of f.parts) s.parts[p] = (s.parts[p] ?? 0) + 1;
  const learned: string[] = [];
  let dupes = 0;
  for (let i = 0; i < f.schematics; i++) {
    const next = SCHEMATIC_ORDER.find((id) => !s.known.includes(id));
    if (next) { s.known.push(next); learned.push(next); } else dupes++;
  }
  for (const id of f.relics) s.shelf.push({ id, at: today(), packed: false });
  const coin = runCoin(r.report.scripHeld, r.report.wavesCleared) + dupes * 10;
  s.coin += coin;
  const worn: string[] = [];
  for (const m of s.made) {
    if (!m.packed || m.charges <= 0) continue;
    m.charges--;
    if (m.charges === 0) { worn.push(m.name); m.packed = false; }
  }
  if (s.packedFood && (s.food[s.packedFood] ?? 0) > 0) {
    s.food[s.packedFood]--;
    if (s.food[s.packedFood] <= 0) s.packedFood = '';
  }
  for (const x of s.shelf) x.packed = false;
  s.pity = f.relics.length ? 0 : s.pity + 1;
  s.runs++;
  s.last = { won, zone: f.zone, waves: r.report.wavesCleared, coin, mats: got, lost, parts: f.parts, learned, dupes, relics: f.relics, worn };
  saveForge(s);
}

// ---- crafting -----------------------------------------------------------------------

function canMake(s: ForgeSave, r: Recipe): string | null {
  if (!known(s, r)) return 'Learn it from a schematic.';
  if (s.stations[r.station] < r.tier) return `Needs the ${STATIONS.find((x) => x.id === r.station)!.name.toLowerCase()} at tier ${r.tier}.`;
  if (r.tier > 1 && skillLevel(s, r.station) < T2_LEVEL) return `Needs ${SKILL_NAME[STATIONS.find((x) => x.id === r.station)!.skill]} ${T2_LEVEL}.`;
  if (!has(s, r.needs)) return 'Not enough materials.';
  if (s.coin < r.fee) return `Needs ${r.fee} coin.`;
  return null;
}

function make(r: Recipe, perk: number): void {
  change((s) => {
    if (canMake(s, r) || (perk >= 0 && !(s.parts[perk] > 0))) return;
    pay(s, r.needs);
    s.coin -= r.fee;
    const st = STATIONS.find((x) => x.id === r.station)!;
    s.xp[st.skill] += 10 * r.tier;
    if (r.makes.kind === 'food') { s.food[r.id] = (s.food[r.id] ?? 0) + 1; if (!s.packedFood) s.packedFood = r.id; return; }
    const [lo, hi] = qualityRange(levelOf(s.xp[st.skill] - 10 * r.tier).level, s.stations[r.station], floorOf(s));
    const q = Math.round(lo + Math.random() * (hi - lo));
    const master = q >= MASTERWORK;
    let name = r.name;
    if (perk >= 0) {
      s.parts[perk]--;
      const key = `${r.id}+${perk}`;
      const found = s.codex.find((d) => d.key === key);
      name = found ? found.name : `${PART_ADJ[perk] ?? 'Fitted'} ${r.name.toLowerCase()}`;
      if (!found) s.codex.push({ key, name, at: today() });
    }
    if (master) name = `Masterwork ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
    const weapons = s.made.filter((m) => m.packed && recipe(m.recipe)?.makes.kind === 'weapon').length;
    const isArmour = r.makes.kind === 'armour';
    const m: Made = {
      uid: s.nextUid++, recipe: r.id, tier: r.tier, quality: q, sockets: (r.makes.kind === 'weapon' ? r.tier : 0) + (master ? 1 : 0),
      charges: CHARGES, perk, name, packed: isArmour ? !s.made.some((x) => x.packed && recipe(x.recipe)?.makes.kind === 'armour') : weapons < WEAPON_SLOTS,
    };
    s.made.push(m);
  });
}

function repairCost(m: Made): { needs: Bag; coin: number } {
  return { needs: m.tier > 1 ? { silveringot: 1 } : { iron: 1 }, coin: 3 * m.tier };
}

// ---- view ---------------------------------------------------------------------------

function matChips(s: ForgeSave): HTMLElement {
  const box = el('div', 'fg-store');
  for (const kind of [1, 3, 2, 4] as const) {
    const row = el('div', 'fg-mats');
    for (const m of MATS) if (MAT_KIND[m] === kind) row.append(el('span', s.mats[m] ? `mat t${kind}` : `mat t${kind} is-none`, el('b', '', String(s.mats[m])), ' ', MAT_NAME[m]));
    box.append(row);
  }
  const parts = PARTS.map((p, i) => (s.parts[i] ? el('span', 'mat t5', el('b', '', String(s.parts[i])), ' ', p.name) : null)).filter((x): x is HTMLElement => !!x);
  if (parts.length) box.append(el('div', 'fg-mats', ...parts));
  return box;
}

function madeLabel(m: Made): HTMLElement {
  const r = recipe(m.recipe);
  if (r?.makes.kind === 'weapon') {
    const w = weaponName(WEAPONS[WEAPON_INDEX[r.makes.weapon]], m.tier);
    w.textContent = m.name;
    return w;
  }
  if (r) { const i = itemName(r.makes.item); i.textContent = m.name; return i; }
  return el('span', '', m.name);
}

function madeRows(s: ForgeSave, station: StationId): HTMLElement | null {
  const list = s.made.filter((m) => recipe(m.recipe)?.station === station);
  if (!list.length) return null;
  const box = el('div', 'fg-rows');
  for (const m of list) {
    const r = recipe(m.recipe)!;
    const weapon = r.makes.kind === 'weapon';
    const rc = repairCost(m);
    const bits = [`tier ${m.tier}`, `quality ${m.quality}`, weapon ? `${m.sockets} socket${m.sockets === 1 ? '' : 's'}` : '', m.charges > 0 ? `${m.charges} run${m.charges === 1 ? '' : 's'} left` : 'worn out'].filter(Boolean).join(' · ');
    const perk = m.perk >= 0 && PARTS[m.perk] ? ` ${PARTS[m.perk].what}` : '';
    box.append(el('div', `fg-row${m.packed ? ' is-packed' : ''}`,
      el('span', 'what', madeLabel(m), el('span', 'note', ` ${bits}.${perk}`)),
      m.charges < CHARGES ? stamp('Repair', { cls: 'stamp--small stamp--plain', title: `${needText(rc.needs)} and ${rc.coin} coin: back to ${CHARGES} runs.`,
        disabled: !has(s, rc.needs) || s.coin < rc.coin,
        onClick: () => change((t) => { const x = t.made.find((y) => y.uid === m.uid); if (!x || !has(t, rc.needs) || t.coin < rc.coin) return; pay(t, rc.needs); t.coin -= rc.coin; x.charges = CHARGES; }) }) : null,
      stamp(m.packed ? 'Packed' : 'Pack', { cls: m.packed ? 'stamp--small' : 'stamp--small stamp--plain', disabled: m.charges <= 0,
        onClick: () => change((t) => {
          const x = t.made.find((y) => y.uid === m.uid);
          if (!x) return;
          if (x.packed) { x.packed = false; return; }
          if (!weapon) for (const y of t.made) if (y.packed && recipe(y.recipe)?.makes.kind === r.makes.kind) y.packed = false;
          else if (t.made.filter((y) => y.packed && recipe(y.recipe)?.makes.kind === 'weapon').length >= WEAPON_SLOTS) return;
          x.packed = true;
        }) })));
  }
  return box;
}

function stationView(s: ForgeSave, id: StationId): HTMLElement[] {
  const st = STATIONS.find((x) => x.id === id)!;
  const out: HTMLElement[] = [];
  const lv = levelOf(s.xp[st.skill]);
  const fill = el('i');
  fill.style.width = `${Math.round((lv.into / lv.need) * 100)}%`;
  const tier = s.stations[id];
  out.push(el('div', 'fg-head',
    el('span', 'what', el('strong', '', `${st.name}, tier ${tier}`), el('span', 'note', ` ${st.what}`)),
    tier < 2 ? stamp('Raise to tier 2', { cls: 'stamp--small stamp--plain', title: `${needText(st.up)} and ${st.upCoin} coin. Tier 2 recipes need it.`,
      disabled: !has(s, st.up) || s.coin < st.upCoin,
      onClick: () => change((t) => { if (t.stations[id] >= 2 || !has(t, st.up) || t.coin < st.upCoin) return; pay(t, st.up); t.coin -= st.upCoin; t.stations[id] = 2; }) }) : null));
  out.push(el('div', 'fg-skill', el('span', '', `${SKILL_NAME[st.skill]} ${lv.level}`), el('div', 'fg-bar', fill),
    el('span', 'note', lv.level < T2_LEVEL ? `tier 2 at ${T2_LEVEL}` : `+${4 * (lv.level - 1)} quality`)));

  const refs = REFINES.filter((r) => r.station === id);
  if (refs.length) {
    const box = el('div', 'fg-rows');
    for (const r of refs) {
      const all = Math.min(...(Object.entries(r.needs) as [Mat, number][]).map(([m, n]) => Math.floor(s.mats[m] / n)));
      const block = r.tier > 1 && lv.level < 2 ? `Needs ${SKILL_NAME[st.skill]} 2.` : '';
      const go = (times: number): void => change((t) => {
        for (let k = 0; k < times && has(t, r.needs); k++) { pay(t, r.needs); t.mats[r.out]++; t.xp[st.skill] += 3 * r.tier; }
      });
      box.append(el('div', 'fg-row',
        el('span', 'what', el('strong', '', MAT_NAME[r.out]), el('span', 'note', ` from ${needText(r.needs)}${block ? `. ${block}` : ''}`)),
        stamp('1', { cls: 'stamp--small', disabled: all < 1 || !!block, onClick: () => go(1) }),
        stamp(all > 1 ? `All ${all}` : 'All', { cls: 'stamp--small stamp--plain', disabled: all < 2 || !!block, onClick: () => go(all) })));
    }
    out.push(el('h3', '', 'Refine'), box);
  }

  const box = el('div', 'fg-rows');
  let unknown = 0;
  const [lo, hi] = qualityRange(lv.level, tier, floorOf(s));
  for (const r of RECIPES.filter((x) => x.station === id)) {
    if (!known(s, r)) { unknown++; continue; }
    const why = canMake(s, r);
    const weapon = r.makes.kind === 'weapon';
    let perk = -1;
    // The part picker shows only where it can be used: a weapon that can be made now.
    const sel = weapon && !why && s.parts.some((n) => n > 0) ? el('select', 'fg-perk') : null;
    if (sel) {
      sel.append(el('option', '', 'No part'));
      (sel.lastChild as HTMLOptionElement).value = '-1';
      s.parts.forEach((n, i) => { if (n > 0) { const o = el('option', '', `+ ${PARTS[i].name} (${n})`); o.value = String(i); sel.append(o); } });
      sel.addEventListener('change', () => { perk = Number(sel.value); });
      setTip(sel, 'Fit a part at the forge and its effect stays with the weapon in every run.');
    }
    const mk = r.makes;
    const label = mk.kind === 'weapon' ? weaponName(WEAPONS[WEAPON_INDEX[mk.weapon]], r.tier) : itemName(mk.item);
    label.textContent = r.name;
    box.append(el('div', 'fg-row',
      el('span', 'what', label, el('span', 'note', ` tier ${r.tier}: ${needText(r.needs)}, ${r.fee} coin.${r.makes.kind === 'food' ? ' Eaten in one run.' : ` Rolls ${lo}-${hi}${hi >= MASTERWORK ? ', masterwork from ' + MASTERWORK : ''}.`}${why ? ' ' + why : ''}`)),
      sel,
      stamp('Make', { cls: 'stamp--small', disabled: !!why, sound: 'anvil', onClick: () => make(r, perk) })));
  }
  if (unknown) box.append(el('div', 'fg-row is-unknown', el('span', 'what', el('strong', '', `${unknown} unknown schematic${unknown > 1 ? 's' : ''}`), el('span', 'note', ' Elites and the boss drop them.'))));
  out.push(el('h3', '', 'Make'), box);
  if (id === 'kitchen') {
    const foods = Object.entries(s.food).filter(([, n]) => n > 0);
    if (foods.length) {
      const fb = el('div', 'fg-rows');
      for (const [fid, n] of foods) {
        const r = recipe(fid)!;
        fb.append(el('div', `fg-row${s.packedFood === fid ? ' is-packed' : ''}`, el('span', 'what', r.makes.kind === 'food' ? itemName(r.makes.item) : r.name, el('span', 'note', ` ${n} made`)),
          stamp(s.packedFood === fid ? 'Packed' : 'Pack', { cls: s.packedFood === fid ? 'stamp--small' : 'stamp--small stamp--plain', onClick: () => change((t) => { t.packedFood = t.packedFood === fid ? '' : fid; }) })));
      }
      out.push(el('h3', '', 'Food'), fb);
    }
  } else {
    const made = madeRows(s, id);
    if (made) out.push(el('h3', '', 'Made'), made);
  }
  return out;
}

function houseView(s: ForgeSave): HTMLElement[] {
  const out: HTMLElement[] = [];
  const rack = el('div', 'fg-rows');
  for (let i = 0; i < RACK; i++) {
    const t = TROPHIES.find((x) => x.id === s.rack[i]);
    rack.append(el('div', 'fg-row', el('span', 'what', t ? el('strong', '', t.name) : el('span', 'note', 'Empty hook'), t ? el('span', 'note', ` ${t.what}`) : null),
      t ? stamp('Take down', { cls: 'stamp--small stamp--plain', onClick: () => change((x) => { x.rack.splice(i, 1); }) }) : null));
  }
  out.push(el('h3', '', `Trophy rack, ${s.rack.length} of ${RACK}`), rack);
  const box = el('div', 'fg-rows');
  for (const t of TROPHIES) {
    const parts = Object.entries(t.parts).map(([i, n]) => `${n} ${PARTS[Number(i)].name.toLowerCase()}`).join(' + ');
    const ok = Object.entries(t.parts).every(([i, n]) => (s.parts[Number(i)] ?? 0) >= n) && has(s, t.needs) && s.rack.length < RACK && !s.rack.includes(t.id);
    box.append(el('div', 'fg-row', el('span', 'what', el('strong', '', t.name), el('span', 'note', ` ${parts} + ${needText(t.needs)}. ${t.what}`)),
      stamp('Make', { cls: 'stamp--small', disabled: !ok, sound: 'anvil', onClick: () => change((x) => {
        if (x.rack.length >= RACK || x.rack.includes(t.id) || !has(x, t.needs) || !Object.entries(t.parts).every(([i, n]) => (x.parts[Number(i)] ?? 0) >= n)) return;
        for (const [i, n] of Object.entries(t.parts)) x.parts[Number(i)] -= n;
        pay(x, t.needs);
        x.rack.push(t.id);
      }) })));
  }
  out.push(el('h3', '', 'Trophies'), box);
  const shelf = el('div', 'fg-rows');
  s.shelf.forEach((r, i) => {
    const spec = RELIC[r.id];
    if (!spec) return;
    shelf.append(el('div', `fg-row${r.packed ? ' is-packed' : ''}`, el('span', 'what', itemName(spec), el('span', 'note', ` found ${r.at}`)),
      stamp(r.packed ? 'Packed' : 'Pack', { cls: r.packed ? 'stamp--small' : 'stamp--small stamp--plain', title: 'One relic can go along.',
        onClick: () => change((x) => { const was = x.shelf[i]?.packed; for (const y of x.shelf) y.packed = false; if (x.shelf[i]) x.shelf[i].packed = !was; }) })));
  });
  out.push(el('h3', '', 'Shelf'), s.shelf.length ? shelf : el('p', 'note', 'Relics come home here. The boss always drops one after a few runs without.'));
  if (s.codex.length) out.push(el('h3', '', 'Made first by you'), el('div', 'fg-rows', ...s.codex.map((d) => el('div', 'fg-row', el('span', 'what', el('strong', '', d.name), el('span', 'note', ` ${d.at}`))))));
  return out;
}

function traderView(s: ForgeSave): HTMLElement[] {
  const box = el('div', 'fg-rows');
  for (const m of MATS) {
    const n = s.mats[m];
    if (!n) continue;
    const price = SELL[MAT_KIND[m]];
    box.append(el('div', 'fg-row', el('span', 'what', el('strong', '', MAT_NAME[m]), el('span', 'note', ` ${n}, ${price} coin each`)),
      stamp('Sell 1', { cls: 'stamp--small stamp--plain', sound: 'buy', onClick: () => change((t) => { if (t.mats[m] > 0) { t.mats[m]--; t.coin += price; } }) }),
      n > 1 ? stamp(`All ${n}`, { cls: 'stamp--small stamp--plain', sound: 'buy', onClick: () => change((t) => { t.coin += t.mats[m] * price; t.mats[m] = 0; }) }) : null));
  }
  s.parts.forEach((n, i) => {
    if (!n) return;
    box.append(el('div', 'fg-row', el('span', 'what', el('strong', '', PARTS[i].name), el('span', 'note', ` ${n}, ${SELL_PART} coin each`)),
      stamp('Sell 1', { cls: 'stamp--small stamp--plain', sound: 'buy', onClick: () => change((t) => { if (t.parts[i] > 0) { t.parts[i]--; t.coin += SELL_PART; } }) })));
  });
  const buy = el('div', 'fg-rows');
  for (const m of ['timber', 'ore', 'hide'] as Mat[]) {
    buy.append(el('div', 'fg-row', el('span', 'what', el('strong', '', `5 ${MAT_NAME[m].toLowerCase()}`), el('span', 'note', ` ${5 * BUY_RAW} coin`)),
      stamp('Buy', { cls: 'stamp--small', sound: 'buy', disabled: s.coin < 5 * BUY_RAW, onClick: () => change((t) => { if (t.coin >= 5 * BUY_RAW) { t.coin -= 5 * BUY_RAW; t.mats[m] += 5; } }) })));
  }
  return [el('h3', '', 'Sell'), box.childElementCount ? box : el('p', 'note', 'Nothing to sell.'), el('h3', '', 'Buy (tier 1 only)'), buy];
}

function lastLine(s: ForgeSave): HTMLElement | null {
  const l = s.last;
  if (!l) return null;
  const bits = (Object.entries(l.mats) as [Mat, number][]).map(([m, n]) => `${n} ${MAT_NAME[m].toLowerCase()}`);
  const parts = l.parts.map((p) => PARTS[p]?.name).filter(Boolean);
  const learned = l.learned.map((id) => recipe(id)?.name).filter(Boolean);
  const relics = l.relics.map((id) => RELIC[id]?.name).filter(Boolean);
  return el('p', 'fg-last',
    el('strong', '', `${ZONE_NAME[l.zone] ?? ''}, ${l.won ? 'cleared' : `down after ${l.waves} waves`}: `),
    [bits.length ? bits.join(', ') : 'no materials', l.lost ? `(${l.lost} lost in the fall)` : '', `${l.coin} coin`].filter(Boolean).join(' '),
    parts.length ? `. Parts: ${parts.join(', ')}` : '',
    learned.length ? `. New schematic: ${learned.join(', ')}` : '',
    relics.length ? `. Relic: ${relics.join(', ')}` : '',
    l.worn.length ? `. Worn out: ${l.worn.join(', ')}` : '', '.');
}

/** The forge game on the stash page. */
export function forgeSection(): HTMLElement {
  const s = loadForge();
  const sec = el('section', 'section fg');
  const packedWeapons = s.made.filter((m) => m.packed && recipe(m.recipe)?.makes.kind === 'weapon');
  const fenOpen = packedWeapons.some((m) => m.tier >= 2);
  const none = packedWeapons.length === 0;
  const home = stamp('Home wood', { key: 'forge:go', sound: 'waveStart', disabled: none, title: none ? 'Make and pack a weapon first.' : 'Tier 1. Iron, timber, hide; one tool door a wave.', onClick: () => void headOutForge(1) });
  const fen = stamp('The fen', { cls: 'stamp--plain', sound: 'waveStart', disabled: none || !fenOpen,
    title: fenOpen ? 'Tier 2. Harder, and half of what falls is of the fen.' : 'Opens once you pack a tier 2 weapon.', onClick: () => void headOutForge(2) });
  sec.append(el('h2', '', 'Forge'),
    el('div', 'bar', el('div', 'bar-text', el('strong', '', `${s.coin} coin. `), 'What you fight with is made here. ', el('span', 'note', 'A test on this device only.')), home, fen));
  const last = lastLine(s);
  if (last) sec.append(last);
  const relic = s.shelf.find((x) => x.packed);
  const food = recipe(s.packedFood);
  const armour = s.made.find((m) => m.packed && recipe(m.recipe)?.makes.kind === 'armour');
  sec.append(el('p', 'fg-load', el('strong', '', 'Packed: '),
    [...packedWeapons.map((m) => m.name), armour?.name, food?.name, relic ? RELIC[relic.id]?.name : '', ...s.rack.map((id) => TROPHIES.find((t) => t.id === id)?.name)].filter(Boolean).join(', ') || 'nothing yet',
    s.pity > 0 ? `. ${s.pity} run${s.pity > 1 ? 's' : ''} without a relic.` : '.'));
  sec.append(matChips(s));
  const tabs: [Tab, string][] = [['forge', 'Forge'], ['outfitter', 'Outfitter'], ['kitchen', 'Kitchen'], ['house', 'House'], ['trader', 'Trader']];
  const bar = el('div', 'fg-tabs');
  for (const [id, name] of tabs) {
    const b = stamp(name, { cls: tab === id ? 'stamp--small' : 'stamp--small stamp--plain', onClick: () => { tab = id; try { localStorage.setItem('scrip.forge.tab', id); } catch { /* */ } redraw(); } });
    b.setAttribute('aria-pressed', String(tab === id));
    bar.append(b);
  }
  sec.append(bar);
  const view = tab === 'house' ? houseView(s) : tab === 'trader' ? traderView(s) : stationView(s, tab);
  sec.append(el('div', 'fg-view', ...view));
  return sec;
}
