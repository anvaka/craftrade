// Inventory: everything the player owns in one place, next to the loadout it equips into.
// Left: the loadout. Middle: tiles by category. Right (or a bottom sheet on narrow screens): the selected thing and its actions.
import { FORM, KITS, MATS, PERKS, RECIPES, SCHEMATICS, PATTERNS, WEAPONS, brewName, type Gear, type GearWeapon, type Mat, type ModKey, type StationId } from '../data';
import * as M from '../meta';
import type { Page, UI } from './app';
import * as I from './icons';
import { esc, ic, tile, tipHtml, ui as uiIcon } from './kit';
import { cap, describe, describeGear, describeMat, gearRarity, gearTier, roman, type Desc } from './things';

const CATS: [string, string][] = [['all', 'All'], ['weapon', 'Weapons'], ['tool', 'Tools'], ['bag', 'Bags'], ['brew', 'Brews'], ['mat', 'Materials'], ['schem', 'Schematics'], ['recipe', 'Recipes']];
const MAT_CATS: [Mat['cat'], string][] = [['ore', 'Ore'], ['wood', 'Wood'], ['herb', 'Herbs'], ['creature', 'From kills'], ['part', 'Elite and boss parts']];
const slotKind = (key: string) => key.split(':')[0];
const slotIndex = (key: string) => Number(key.split(':')[1] ?? 0);
const slotName = (key: string) => (key.includes(':') ? `${slotKind(key)} slot ${slotIndex(key) + 1}` : SLOT_NAME[key]);
const SLOT_NAME: Record<string, string> = { w0: 'weapon slot 1', w1: 'weapon slot 2', tool: 'the tool slot', bag: 'the bag slot', flask: 'a flask slot', charm: 'a charm socket', oil: 'the oil slot', recipe: 'the recipe notebook' };

/** Which loadout slot a piece of gear sits in: "1", "2", "E" or nothing. */
export function slotOf(p: M.Profile, g: Gear): string {
  const l = p.loadout;
  if (g.kind === 'weapon') {
    const i = l.weapons.indexOf(g.uid);
    return i >= 0 ? String(i + 1) : '';
  }
  return (g.kind === 'tool' ? l.tool : l.bag) === g.uid ? 'E' : '';
}
export function gearTile(ui: UI, g: Gear, o: { a?: string; w?: string; size?: 'sm' | 'lg' | 'xl'; sel?: boolean } = {}): string {
  const d = describeGear(g, ui.ctx);
  const glyphs = g.kind === 'weapon' ? g.perks.filter((x) => PERKS[x]).map((x) => I.modIcon(PERKS[x].mods[0][0] as ModKey)) : [];
  return tile(d, {
    a: o.a, v: o.a === 'sel' ? `gear:${g.uid}` : g.uid, w: o.w, size: o.size, sel: o.sel, gs: g.kind === 'weapon', glyphs, isNew: g.isNew, locked: g.locked, slot: slotOf(ui.p, g) || undefined,
    qty: g.kind === 'bag' ? g.comfort : undefined, label: `${g.name}${g.kind === 'weapon' ? `, gear score ${g.gs}, ${g.perks.map((x) => PERKS[x]?.name).join(', ')}` : ''}`,
  });
}
const packedCount = (p: M.Profile, k: string) => p.loadout.charms.filter((x) => x === k).length + p.loadout.flasks.filter((x) => x === k).length + (p.loadout.oil === k ? 1 : 0);

/** Put a weapon into slot 0 or 1. If it is already in the other slot, the two swap. */
export function equipWeapon(p: M.Profile, uid: number, slot: number): void {
  const w = p.loadout.weapons;
  const other = w[1 - slot];
  const cur = w[slot];
  if (other === uid) w[1 - slot] = cur;
  w[slot] = uid;
  p.loadout.weapons = w.filter((u) => u !== undefined && M.gearBy(p, u));
}

/** The loadout weapon a candidate is read against: the slot being filled, else the same family, else slot 1. */
export function versusFor(ui: UI, g: GearWeapon): GearWeapon | undefined {
  const l = ui.p.loadout;
  if (l.weapons.includes(g.uid)) return undefined;
  const at = (i: number) => M.gearBy(ui.p, l.weapons[i]);
  const eq = [at(0), at(1)].filter((x): x is GearWeapon => x?.kind === 'weapon');
  const picked = ui.s.slot === 'w0' ? at(0) : ui.s.slot === 'w1' ? at(1) : undefined;
  return picked?.kind === 'weapon' ? picked : (eq.find((x) => x.fam === g.fam) ?? eq[0]);
}

// --------------------------------------------------------------- the loadout
function loadout(ui: UI): string {
  const p = ui.p;
  const l = p.loadout;
  const s = ui.s;
  const feat = M.featFor(p);
  const dslot = (key: string, label: string, body: string, name: string, sub = '', wide = false) =>
    `<button class="dslot${wide ? ' wide' : ''}${s.slot === key ? ' on' : ''}" data-a="slot" data-v="${key}" aria-pressed="${s.slot === key}"><span class="lab">${label}</span>${body}<span class="nm">${name}${sub ? `<br><span class="dim small">${sub}</span>` : ''}</span></button>`;
  const gearSlot = (key: string, label: string, uid: number | undefined, empty: string, sub = (g: Gear) => (g.kind === 'weapon' ? WEAPONS[g.fam].ability.name : '')) => {
    const g = uid !== undefined ? M.gearBy(p, uid) : undefined;
    return dslot(key, label, g ? tile(describeGear(g, ui.ctx), { size: 'sm', gs: false }) : `<span class="tile sm empty static">${empty}</span>`, g ? g.name : '<span class="bad">Empty</span>', g ? sub(g) : '');
  };
  const brewSlot = (key: string, label: string, k: string | undefined, form: 'flask' | 'oil' | 'charm') => {
    const need = FORM[form].station;
    if (p.stations.apothecary < need && !k) {
      return `<div class="dslot" style="cursor:default" aria-disabled="true"><span class="lab">${label}</span><span class="tile sm empty static">${I.uiIcon('lock')}</span><span class="nm dim" style="display:block">Needs the apothecary at tier ${roman(need)} (yours is ${roman(p.stations.apothecary)})</span></div>`;
    }
    return dslot(key, label, k ? tile(describe(`brew:${k}`, ui.ctx), { size: 'sm' }) : `<span class="tile sm empty static">${I.brewIcon(form, '#555')}</span>`, k ? cap(brewName(M.parseBrew(k))) : '<span class="dim">Empty</span>');
  };
  const flasks = Array.from({ length: M.flaskSlots(p) }, (_, i) => brewSlot(`flask:${i}`, `Flask ${i + 1}`, l.flasks[i], 'flask')).join('');
  const bag = M.gearBy(p, l.bag);
  const kit = KITS.find((k) => k.id === l.kit)!;
  const known = M.knownRecipes(p);
  const recipes = l.recipes.filter((r) => known.includes(r));
  const problem = M.loadoutProblem(p);
  return `<section class="panel lo" data-scroll="doll"><h2>Loadout</h2>
    <div class="doll">
      ${gearSlot('w0', 'Weapon 1', l.weapons[0], I.weaponIcon('blade'))}
      ${gearSlot('w1', 'Weapon 2', l.weapons[1], I.weaponIcon('bow'))}
      ${gearSlot('tool', 'Tool', l.tool, I.toolIcon('ore', 1), (g) => (g.kind === 'tool' ? `fewer swings on ${{ ore: 'ore', wood: 'trees', herb: 'reeds', knife: 'nothing; more drops' }[g.node]}` : ''))}
      ${gearSlot('bag', 'Bag', l.bag, I.bagIcon('sack'), (g) => (g.kind === 'bag' ? `comfort ${g.comfort}${g.burden ? ` · ${g.burden} −40%` : ''}` : ''))}
    </div>
    ${feat.craft ? `<h4>Brews <span class="dim" style="text-transform:none;letter-spacing:0">used up when you leave</span></h4>
    <div class="doll">${flasks}
      ${brewSlot('oil', 'Weapon oil', l.oil ?? undefined, 'oil')}
      ${brewSlot('charm:0', 'Charm 1', l.charms[0], 'charm')}
      ${brewSlot('charm:1', 'Charm 2', l.charms[1], 'charm')}
    </div>
    <h4>Recipes ${recipes.length}/${M.recipeSlots(p)}</h4>
    <button class="dslot wide${s.slot === 'recipe' ? ' on' : ''}" data-a="slot" data-v="recipe" style="width:100%"><span class="tiles">${recipes.map((r) => tile(describe(`recipe:${r}`, ui.ctx), { size: 'xs' })).join('') || '<span class="dim small">None chosen</span>'}</span></button>
    <p class="dim small" style="margin-top:6px">Only these recipes can be used at camp or at a boss chest. An evolution recipe is not needed for a family you bring: it is only for weapons of other families bought on the way.</p>` : ''}
    ${(() => {
      const ws = l.weapons.map((u) => M.gearBy(p, u)).filter((g): g is GearWeapon => g?.kind === 'weapon');
      return ws.length === 2 && ws[0].fam === ws[1].fam ? `<p class="note" style="margin-top:10px">Both weapons are ${WEAPONS[ws[0].fam].name.toLowerCase()}s, so you bring one ability (${WEAPONS[ws[0].fam].ability.name}) instead of two.</p>` : '';
    })()}
    <h4>Going as</h4>
    <div class="kv"><span class="dim">Kit</span><span>${kit.name}</span></div>
    ${bag?.kind === 'bag' ? `<div class="kv"><span class="dim">Carries before slowing</span><span>${bag.comfort} weight</span></div>` : ''}
    <button class="${problem ? '' : 'pri '}big" data-a="goto" data-v="Expedition" style="margin-top:10px">${problem ? esc(problem) : 'To the expedition'}</button>
    <p class="dim small" style="margin-top:8px">Click a slot to see what fits it. Two weapons set your two abilities; the run supplies the power.</p></section>`;
}

// ----------------------------------------------------------------- the grid
interface Entry {
  ref: string;
  html: string;
  text: string; // what the search matches
  order: number[];
}
function entries(ui: UI): Record<string, Entry[]> {
  const p = ui.p;
  const s = ui.s;
  const out: Record<string, Entry[]> = { weapon: [], tool: [], bag: [], brew: [], schem: [], recipe: [] };
  for (const [c] of MAT_CATS) out[`mat-${c}`] = [];
  const picking = s.slot;
  for (const g of p.gear) {
    const ref = `gear:${g.uid}`;
    const a = picking && ((picking === 'w0' || picking === 'w1') === (g.kind === 'weapon')) && (g.kind === 'weapon' || picking === g.kind) ? 'equip' : 'sel';
    const w = picking === 'w0' ? '0' : picking === 'w1' ? '1' : '';
    const score = g.kind === 'weapon' ? g.gs : g.kind === 'tool' ? g.tier * 100 : g.comfort;
    out[g.kind].push({
      ref, html: gearTile(ui, g, { a, w, sel: s.sel === ref }),
      text: `${g.name} ${g.kind} ${g.kind === 'weapon' ? `${WEAPONS[g.fam].name} ${g.gs} ${g.perks.map((x) => PERKS[x]?.name).join(' ')}` : ''} ${['common', 'uncommon', 'rare', 'epic', 'named'][gearRarity(g)]}`.toLowerCase(),
      order: [g.uid, score],
    });
  }
  for (const k of Object.keys(p.brews)) {
    if (!(p.brews[k] > 0)) continue;
    const b = M.parseBrew(k);
    const ref = `brew:${k}`;
    const fits = picking && slotKind(picking) === b.form;
    const n = packedCount(p, k);
    out.brew.push({ ref, html: tile(describe(ref, ui.ctx), { a: fits ? 'pack' : 'sel', v: fits ? k : ref, w: fits ? picking! : undefined, qty: p.brews[k], sel: s.sel === ref, slot: n ? String(n) : undefined }), text: `${brewName(b)} ${b.form} brew`.toLowerCase(), order: [b.atoms.length, p.brews[k]] });
  }
  for (const [id, n] of Object.entries(p.bank)) {
    if (!(n > 0) || !MATS[id]) continue;
    const ref = `mat:${id}`;
    out[`mat-${MATS[id].cat}`].push({ ref, html: tile(describeMat(id, ui.ctx), { a: 'sel', v: ref, qty: n, sel: s.sel === ref, round: MATS[id].cat !== 'part' }), text: `${MATS[id].name} ${MATS[id].cat} material`.toLowerCase(), order: [-MATS[id].tier, n] });
  }
  for (const [id, n] of Object.entries(p.schematics)) {
    if (!(n > 0) || !SCHEMATICS[id]) continue;
    const ref = `schem:${id}`;
    out.schem.push({ ref, html: tile(describe(ref, ui.ctx), { a: 'sel', v: ref, qty: n, sel: s.sel === ref, isNew: SCHEMATICS[id].kind === 'recipe' && !p.codex.includes(id) }), text: `${SCHEMATICS[id].name} schematic ${SCHEMATICS[id].kind}`.toLowerCase(), order: [n, 0] });
  }
  for (const r of M.knownRecipes(p)) {
    const ref = `recipe:${r}`;
    const on = p.loadout.recipes.includes(r);
    out.recipe.push({ ref, html: tile(describe(ref, ui.ctx), { a: picking === 'recipe' ? 'lrec' : 'sel', v: picking === 'recipe' ? r : ref, sel: s.sel === ref, slot: on ? '✓' : undefined, dim: picking === 'recipe' && !on }), text: `${RECIPES[r].name} recipe ${RECIPES[r].kind}`.toLowerCase(), order: [on ? 1 : 0, 0] });
  }
  return out;
}

function grid(ui: UI): string {
  const p = ui.p;
  const s = ui.s;
  const all = entries(ui);
  const words = s.search.toLowerCase().split(/\s+/).filter(Boolean);
  const sorter = (a: Entry, b: Entry) => (s.sort === 'name' ? a.text.localeCompare(b.text) : s.sort === 'score' ? b.order[1] - a.order[1] : b.order[0] - a.order[0]);
  const slotCat = s.slot ? ({ w0: 'weapon', w1: 'weapon', tool: 'tool', bag: 'bag', flask: 'brew', charm: 'brew', oil: 'brew', recipe: 'recipe' } as Record<string, string>)[slotKind(s.slot)] : null;
  const want = (cat: string) => (slotCat ? cat === slotCat : s.cat === 'all' || s.cat === cat || (s.cat === 'mat' && cat.startsWith('mat-')));
  const feat = M.featFor(p);
  const section = (cat: string, title: string, empty: string) => {
    if (!want(cat)) return '';
    let list = all[cat];
    if (s.slot && cat === 'brew') list = list.filter((e) => M.parseBrew(e.ref.slice(5)).form === slotKind(s.slot!));
    const shown = list.filter((e) => words.every((w) => e.text.includes(w))).sort(sorter);
    const hidden = list.length - shown.length;
    const fresh = cat === 'weapon' || cat === 'tool' || cat === 'bag' ? p.gear.filter((g) => g.kind === cat && g.isNew).length : 0;
    if (!list.length && (s.cat === 'all' && !s.slot) && !empty) return '';
    return `<div class="cat">${title} <small>${list.length}${fresh ? ` · <span class="gold">${fresh} new</span>` : ''}</small></div>
      ${shown.length ? `<div class="grid">${shown.map((e) => e.html).join('')}</div>` : `<p class="dim small">${list.length ? '' : empty}</p>`}
      ${hidden ? `<p class="dim small">${hidden} hidden by the search.</p>` : ''}`;
  };
  const slotHead = s.slot ? `<div class="note" role="status">Choose what goes into <b>${slotName(s.slot)}</b>: click one below. <button class="sm ghost" data-a="slot" data-v="${s.slot}" data-key="Escape">Done</button>${
    ['flask', 'charm', 'oil'].includes(slotKind(s.slot)) ? ` <button class="sm ghost" data-a="clearslot" data-v="${s.slot}">Empty this slot</button>` : ''}</div>` : '';
  const filters = `<div class="filters">
      <input type="search" data-in="search" value="${esc(s.search)}" placeholder="Search name, perk or gear score" aria-label="Search the inventory">
      <span class="dim small">Sort</span>${(['new', 'score', 'name'] as const).map((k) => `<button class="seg${s.sort === k ? ' on' : ''}" data-a="sort" data-v="${k}" aria-pressed="${s.sort === k}">${{ new: 'Newest', score: 'Best', name: 'Name' }[k]}</button>`).join('')}
    </div>
    ${s.slot ? '' : `<div class="filters" role="tablist">${CATS.filter(([c]) => feat.schem || (c !== 'schem')).filter(([c]) => feat.craft || (c !== 'brew' && c !== 'recipe')).map(([c, name]) => `<button class="seg${s.cat === c ? ' on' : ''}" data-a="cat" data-v="${c}" role="tab" aria-selected="${s.cat === c}">${name}</button>`).join('')}</div>`}`;
  return `<section class="panel gr" data-scroll="grid"><h2>Inventory</h2>${filters}${slotHead}
    ${section('weapon', 'Weapons', 'None. Forge one at the Forge.')}
    ${section('tool', 'Tools', 'None. Make one at the Forge.')}
    ${section('bag', 'Bags', 'None. Make one at the Workshop.')}
    ${feat.craft ? section('brew', 'Brews', s.slot ? `No ${slotKind(s.slot)}s in storage. Brew some at the Apothecary.` : 'None yet. Two reagents make a brew at the Apothecary.') : ''}
    ${MAT_CATS.map(([c, name]) => section(`mat-${c}`, name, c === 'part' ? '' : `None. ${{ ore: 'Mine veins in the Quarry', wood: 'Fell trees in the Grove', herb: 'Cut reeds in the Marsh', creature: 'Kills leave these behind', part: '' }[c]}.`)).join('')}
    ${feat.schem ? section('schem', 'Schematics', 'None held. Named elites, shrines and boss chests carry them.') : ''}
    ${feat.craft ? section('recipe', 'Recipes you know', '') : ''}</section>`;
}

// ------------------------------------------------------- the selected thing
function actionsFor(ui: UI, ref: string): string {
  const p = ui.p;
  const l = p.loadout;
  const [kind, id] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
  const btn = (label: string, a: string, v: string | number, o: { w?: string; why?: string | null; cls?: string; key?: string } = {}) =>
    `<button class="${o.cls ?? ''} big" data-a="${a}" data-v="${esc(String(v))}"${o.w ? ` data-w="${o.w}"` : ''}${o.key ? ` data-key="${o.key}"` : ''} ${o.why ? 'disabled' : ''}>${label}${o.key && !o.why ? ` <span class="kc">${o.key.toUpperCase()}</span>` : ''}</button>${o.why ? `<p class="dim small" style="margin:2px 0 6px">${o.why}</p>` : ''}`;
  const rows: string[] = [];
  if (kind === 'gear') {
    const g = M.gearBy(p, Number(id));
    if (!g) return '';
    const inUse = slotOf(p, g);
    if (g.kind === 'weapon') {
      for (const i of [0, 1]) {
        const cur = M.gearBy(p, l.weapons[i]) as GearWeapon | undefined;
        const swap = l.weapons[1 - i] === g.uid;
        rows.push(btn(`${swap ? 'Move to' : 'Equip in'} slot ${i + 1}${cur && cur.uid !== g.uid ? ` <span class="dim small">${swap ? 'swaps places with' : 'replaces'} ${cur.name} ${cur.gs}</span>` : ''}`, 'equip', g.uid, { w: String(i), why: l.weapons[i] === g.uid ? `Already in slot ${i + 1}.` : null, cls: inUse ? '' : i === 0 ? 'pri' : '' }));
      }
      rows.push(btn(`Forge another ${WEAPONS[g.fam].name.toLowerCase()}`, 'forgelike', g.uid, { cls: 'ghost' }));
    } else rows.push(btn('Equip', 'equip', g.uid, { why: inUse ? 'Already in your loadout.' : null, cls: inUse ? '' : 'pri' }));
    rows.push(btn(g.locked ? `${uiIcon('unlock')} Unlock` : `${uiIcon('lock')} Lock (cannot be dismantled)`, 'lock', g.uid, { cls: 'ghost', key: 'l' }));
    rows.push(btn(`${uiIcon('dismantle')} Dismantle for 2 coin`, 'scrapgear', g.uid, { cls: 'danger', why: inUse ? 'In your loadout: equip something else first.' : g.locked ? 'Locked: unlock it first.' : null }));
  } else if (kind === 'mat') {
    const n = p.bank[id] ?? 0;
    const v = M.sellValue(id);
    if (v <= 0) rows.push('<p class="dim small">Elite and boss parts cannot be sold: named patterns need them. An evolution uses an elite part carried in the bag on that expedition, not one stored here.</p>');
    else {
      const amt = Math.max(1, Math.min(n, ui.s.amt));
      const worth = Math.floor((amt * v) / 2);
      const step = (label: string, d: string, off: boolean) => `<button class="sm" data-a="amt" data-v="${d}" ${off ? 'disabled' : ''} aria-label="${d === 'all' ? 'All' : `${Number(d) > 0 ? 'Add' : 'Remove'} ${Math.abs(Number(d))}`}">${label}</button>`;
      rows.push(`<div class="stepper" style="flex-wrap:wrap;gap:6px">${step('−10', '-10', amt <= 1)}${step('−1', '-1', amt <= 1)}<b aria-live="polite">${amt}</b>${step('+1', '1', amt >= n)}${step('+10', '10', amt >= n)}${step(`All ${n}`, 'all', amt >= n)}</div>`);
      rows.push(`<div class="two">${btn(`Sell ${amt} <span class="dim small">+${worth} coin</span>`, 'sellmat', id, { w: String(amt), why: worth < 1 ? 'Too few to be worth a coin.' : null })}${btn(`Give ${amt} <span class="dim small">+${worth} standing</span>`, 'donate', id, { w: String(amt), why: worth < 1 ? 'Too few to count.' : null })}</div>`);
      rows.push(`<p class="dim small">Surplus has two uses: the quartermaster pays coin, or it goes to town projects and raises your standing (${p.standing.xp}/${M.standingFor(p.standing.lvl)} to level ${p.standing.lvl + 1}).</p>`);
    }
  } else if (kind === 'brew') {
    const b = M.parseBrew(id);
    const n = packedCount(p, id);
    const free = M.brewsFree(p, id);
    const full = b.form === 'flask' ? l.flasks.length >= M.flaskSlots(p) : b.form === 'charm' ? l.charms.length >= 2 : false;
    rows.push(`<p class="small">${n} packed of ${p.brews[id] ?? 0}. ${FORM[b.form].name}s go in ${b.form === 'flask' ? `${M.flaskSlots(p)} flask slots` : b.form === 'charm' ? 'two charm sockets' : 'one oil slot'}.</p>`);
    rows.push(btn('Pack for the expedition', 'pack', id, { cls: 'pri', why: free <= 0 ? 'All of them are packed.' : full ? `No free ${b.form} slot: take one out first.` : null }));
    rows.push(btn('Take one out', 'unpack', id, { why: n ? null : 'None packed.' }));
  } else if (kind === 'schem') {
    const s = SCHEMATICS[id];
    const held = p.schematics[id] ?? 0;
    const learned = p.codex.includes(id);
    if (s.kind === 'recipe') rows.push(btn('Learn', 'learn', id, { cls: 'pri', why: learned ? 'Already learned.' : held ? null : 'None held.' }));
    else if (s.kind === 'pattern') rows.push(btn(`Use at the ${cap(PATTERNS[s.ref].station)}`, 'goto', cap(PATTERNS[s.ref].station), { cls: 'pri', w: `p:${id}` }));
    else {
      // a station rises one tier at a time, so only the blueprint for the next tier can be used now
      const [stId, t] = [s.ref.split('-')[0] as StationId, Number(s.ref.split('-')[1])];
      const now = p.stations[stId];
      rows.push(btn(`Use at the ${cap(stId)}`, 'goto', cap(stId), { cls: 'pri', w: 'up', why: now >= t ? `Spare: the ${stId} is already tier ${roman(now)}.` : now + 1 < t ? `Kept for tier ${roman(t)}: the ${stId} is tier ${roman(now)} now and must reach tier ${roman(t - 1)} first.` : null }));
    }
    rows.push(btn('Break into a fragment', 'break', id, { cls: 'danger', why: !held ? 'None held.' : s.kind === 'recipe' && !learned ? 'Learn it first; break spare copies.' : null }));
    rows.push(`<p class="dim small">Four fragments from one source trade for a schematic you are missing, in the Codex.</p>`);
  } else if (kind === 'recipe') {
    const on = l.recipes.includes(id);
    rows.push(btn(on ? 'Take out of the notebook' : 'Add to the notebook', 'lrec', id, { cls: on ? '' : 'pri', why: !on && l.recipes.length >= M.recipeSlots(p) ? `The notebook holds ${M.recipeSlots(p)}: take one out first.` : null }));
  }
  return rows.join('');
}

function detail(ui: UI): string {
  const ref = ui.s.sel;
  if (!ref) {
    return `<h2>Selected</h2><p class="dim">Click anything to see what it does and what you can do with it.</p>
      <p class="dim small">${ic(I.uiIcon('star'))} A gold <b>!</b> marks things made since you last opened the inventory. A number in the green dot is its loadout slot. Small icons on a weapon are its perks; the number is its gear score.</p>`;
  }
  const d: Desc = describe(ref, ui.ctx);
  if (d.name === 'Unknown') return '<h2>Selected</h2><p class="dim">That is gone.</p>';
  // a weapon is always read against what it would replace
  let versus: Desc | undefined;
  const g = ref.startsWith('gear:') ? M.gearBy(ui.p, Number(ref.slice(5))) : null;
  if (g?.kind === 'weapon' && !ui.p.loadout.weapons.includes(g.uid)) {
    const other = versusFor(ui, g);
    if (other) versus = describeGear(other, ui.ctx);
    if (other) {
      const gain = g.perks.filter((x) => !other.perks.includes(x)).map((x) => PERKS[x].name);
      const lose = other.perks.filter((x) => !g.perks.includes(x)).map((x) => PERKS[x].name);
      d.notes.unshift(`Against ${other.name} (slot ${ui.p.loadout.weapons.indexOf(other.uid) + 1}): ${gain.length ? `<span class="ok">gains ${gain.join(', ')}</span>` : 'gains no perk'}${lose.length ? `, <span class="bad">loses ${lose.join(', ')}</span>` : ''}.`);
    }
  }
  // what you can do comes before the long text, so the buttons are on screen without scrolling
  const notes = d.notes.filter(Boolean);
  d.notes = [];
  return `<h2>Selected <button class="sm ghost" data-a="sel" data-v="" aria-label="Close" style="margin-left:auto">${uiIcon('close')}</button></h2>${tipHtml(d, { versus })}<div class="stack" style="margin-top:10px">${actionsFor(ui, ref)}</div>${notes.map((n) => `<p class="dim small" style="margin-top:8px">${n}</p>`).join('')}`;
}

export function view(ui: UI): Page {
  // something selected and then used up elsewhere (a part spent on a pattern, a brew drunk) is no longer selected
  const own = (ref: string) => {
    const id = ref.slice(ref.indexOf(':') + 1);
    if (ref.startsWith('mat:')) return (ui.p.bank[id] ?? 0) > 0;
    if (ref.startsWith('brew:')) return (ui.p.brews[id] ?? 0) > 0;
    if (ref.startsWith('schem:')) return (ui.p.schematics[id] ?? 0) > 0;
    if (ref.startsWith('gear:')) return !!M.gearBy(ui.p, Number(id));
    return true;
  };
  if (ui.s.sel && !own(ui.s.sel)) ui.s.sel = null;
  const sel = ui.s.sel;
  return {
    fit: true,
    body: `<div class="subnav only-phone" role="tablist">${(['grid', 'doll'] as const).map((k) => `<button class="seg${ui.s.pane === k ? ' on' : ''}" data-a="pane" data-v="${k}" role="tab" aria-selected="${ui.s.pane === k}" style="flex:1">${k === 'grid' ? 'Everything you own' : 'Loadout'}</button>`).join('')}</div>
      <div class="inv" data-pane="${ui.s.pane}">${loadout(ui)}${grid(ui)}<aside class="panel detail" data-scroll="detail">${detail(ui)}</aside></div>
      ${sel ? `<div class="sheet only-narrow" role="dialog" aria-label="Selected item">${detail(ui)}</div>` : ''}`,
  };
}

export function act(ui: UI, a: string, v: string, w: string): boolean | 'leave' | void {
  const p = ui.p;
  const l = p.loadout;
  const s = ui.s;
  const snd = ui.hooks.sound;
  switch (a) {
    case 'sel': {
      s.sel = v && v !== s.sel ? v : null;
      s.amt = 10;
      const g = v.startsWith('gear:') ? M.gearBy(p, Number(v.slice(5))) : null;
      if (g) g.isNew = false;
      return true;
    }
    case 'slot': s.slot = s.slot === v ? null : v; s.sel = null; s.pane = s.slot ? 'grid' : 'doll'; return true;
    case 'pane': s.pane = v as typeof s.pane; return true;
    case 'cat': s.cat = v; return true;
    case 'sort': s.sort = v as typeof s.sort; return true;
    case 'equip': {
      const g = M.gearBy(p, Number(v));
      if (!g) return true;
      if (g.kind === 'weapon') {
        if (w === '') {
          ui.open({ kind: 'equip', uid: g.uid });
          return true;
        }
        equipWeapon(p, g.uid, Number(w));
      } else if (g.kind === 'tool') l.tool = g.uid;
      else l.bag = g.uid;
      g.isNew = false;
      s.slot = null;
      if (s.modal?.kind === 'equip') ui.close();
      snd.ui('buy');
      ui.say(`${g.name} is in ${g.kind === 'weapon' ? `weapon slot ${Number(w) + 1}` : `the ${g.kind} slot`}.`);
      return true;
    }
    case 'lock': {
      const g = M.gearBy(p, Number(v));
      if (g) g.locked = !g.locked;
      return true;
    }
    case 'scrapgear': {
      const g = M.gearBy(p, Number(v));
      if (!g) return true;
      if (!ui.ask(`Dismantle ${g.name}${g.kind === 'weapon' ? ` (gear score ${g.gs})` : ''}? It returns 2 coin and cannot be undone.`, 'Dismantle', 'scrapgear', v)) return true;
      if (!M.scrapGear(p, g.uid)) ui.fail(g.locked ? 'It is locked.' : 'That is in your loadout.');
      else {
        if (s.sel === `gear:${v}`) s.sel = null;
        // a batch window stays for the pieces that are left
        if (s.modal?.kind === 'result' && !s.modal.uids.some((u) => M.gearBy(p, u))) ui.close();
        ui.say(`${g.name} dismantled: +2 coin.`);
      }
      return true;
    }
    case 'forgelike': {
      const g = M.gearBy(p, Number(v));
      if (g?.kind === 'weapon') {
        s.fam = g.fam;
        // a named weapon has no grade of its own: open the best grade this forge can make
        const best = [3, 2, 1].find((t) => p.stations.forge >= M.gradeStation(t)) ?? 1;
        s.recipe.Forge = `w:${g.fam}:${g.named ? best : gearTier(g)}`;
        ui.go('Forge');
      }
      return true;
    }
    case 'amt': {
      const id = s.sel?.startsWith('mat:') ? s.sel.slice(4) : '';
      const have = p.bank[id] ?? 0;
      s.amt = v === 'all' ? have : Math.max(1, Math.min(have, Math.min(have, s.amt) + Number(v)));
      return true;
    }
    case 'sellmat':
    case 'donate': {
      const n = w === 'all' ? p.bank[v] ?? 0 : Number(w) || 10;
      const before = p.standing.lvl;
      const value = Math.floor((n * M.sellValue(v)) / 2);
      const name = MATS[v].name.toLowerCase();
      // a gift cannot be taken back, so giving away a whole stack asks first; a sale can be undone
      if (a === 'donate' && n >= (p.bank[v] ?? 0) && n > 10 && !ui.ask(`Give all ${n} ${name} to town projects for ${value} standing? A gift cannot be taken back.`, `Give all ${n}`, 'donate', v, w)) return true;
      if (!(a === 'sellmat' ? M.sellMat(p, v, n) : M.donate(p, v, n))) return ui.fail('Not enough of that.'), true;
      snd.ui('buy');
      if ((p.bank[v] ?? 0) <= 0 && s.sel === `mat:${v}`) s.sel = null;
      ui.say(a === 'sellmat' ? `Sold ${n} ${name}: +${value} coin. <button class="sm" data-a="undosell" data-v="${v}" data-w="${n}">Undo</button>` : `Gave ${n} ${name}: +${value} standing${p.standing.lvl > before ? `. Standing ${p.standing.lvl}: a card to pick in Character` : ` (${p.standing.xp}/${M.standingFor(p.standing.lvl)})`}.`);
      return true;
    }
    case 'undosell': {
      const n = Number(w);
      const value = Math.floor((n * M.sellValue(v)) / 2);
      if (p.coin < value) return ui.fail('The coin from that sale is already spent.'), true;
      p.coin -= value;
      p.bank[v] = (p.bank[v] ?? 0) + n;
      ui.say(`Sale undone: ${n} ${MATS[v].name.toLowerCase()} back in storage.`);
      return true;
    }
    case 'pack': {
      const b = M.parseBrew(v);
      if (w && slotKind(w) === b.form) {
        // into the chosen slot, replacing what is there
        const i = slotIndex(w);
        const list = b.form === 'flask' ? l.flasks : b.form === 'charm' ? l.charms : null;
        const cur = list ? list[i] : l.oil;
        if (cur !== v && M.brewsFree(p, v) <= 0) return ui.fail('No more of that brew in storage.'), true;
        if (list) list[Math.min(i, list.length)] = v;
        else l.oil = v;
        s.slot = null;
        s.pane = 'doll';
        snd.ui('click');
        return true;
      }
      if (M.brewsFree(p, v) <= 0) return ui.fail('No more of that brew in storage.'), true;
      if (b.form === 'charm' && l.charms.length < 2) l.charms.push(v);
      else if (b.form === 'oil') l.oil = v;
      else if (b.form === 'flask' && l.flasks.length < M.flaskSlots(p)) l.flasks.push(v);
      else return ui.fail(`No free ${b.form} slot: take one out first.`), true;
      snd.ui('click');
      return true;
    }
    case 'unpack': {
      const drop = (list: string[]) => {
        const i = list.indexOf(v);
        if (i >= 0) list.splice(i, 1);
      };
      if (l.oil === v) l.oil = null;
      else if (l.charms.includes(v)) drop(l.charms);
      else drop(l.flasks);
      return true;
    }
    case 'clearslot':
      if (slotKind(v) === 'oil') l.oil = null;
      else (slotKind(v) === 'charm' ? l.charms : l.flasks).splice(slotIndex(v), 1);
      s.slot = null;
      s.pane = 'doll';
      return true;
    case 'lrec':
      if (l.recipes.includes(v)) l.recipes = l.recipes.filter((r) => r !== v);
      else if (l.recipes.length < M.recipeSlots(p)) l.recipes.push(v);
      else ui.fail(`The notebook holds ${M.recipeSlots(p)} recipes: take one out first.`);
      return true;
  }
  return false;
}
