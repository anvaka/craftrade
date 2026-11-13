// The three crafting stations. One layout for all: what can be made (left), the selected recipe with its
// ingredient slots (middle), and the outcome, quantity, requirements and the one button (right).
import {
  ATOMS, BAG_TYPES, FAMS, FORM, MATS, PATTERNS, PERKS, SCHEMATICS, SKILL_CAP, STATIONS, TOOLS, WEAPONS, brewKey, modText, skillXpFor,
  type AtomId, type BrewForm, type Fam, type Gear, type GearTool, type Mat, type ModKey, type Skill, type StationId,
} from '../data';
import * as M from '../meta';
import type { Page, UI } from './app';
import * as I from './icons';
import { affordable, costSlots, ic, onePane, pageScroll, rangeBar, req, ring, scrollPageAfter, shortfall, tile, ui as uiIcon } from './kit';
import { GRADE, atomColor, cap, describe, describeMat, perkQuality, roman, schemSource, type Desc, type Rarity } from './things';

const STATION_OF: Record<string, StationId> = { Forge: 'forge', Workshop: 'workshop', Apothecary: 'apothecary' };
const SKILL_OF: Record<StationId, Skill> = { forge: 'smithing', workshop: 'outfitting', apothecary: 'alchemy' };
const TOOL_IDS = Object.keys(TOOLS) as GearTool['node'][];
const BURDENS: Mat['cat'][] = ['ore', 'wood', 'herb'];

interface Rec {
  key: string;
  name: string;
  kind: string; // one line under the name
  icon: string;
  rarity: Rarity;
  tier?: number;
  text: string[];
  cost: Record<string, number>;
  coin: number;
  reqs: [boolean, string][]; // gates other than materials and coin
  choose?: string; // a choice still to be made before crafting, in words for the button
  xp: number;
  batch: boolean; // may be made several at a time
  make: () => string | Gear | null; // an error, the thing made, or null for a station upgrade
}

const stationOf = (ui: UI) => STATION_OF[ui.s.tab] ?? 'forge';
let listScroll = 0; // on a phone: where the recipe list was scrolled when a recipe was opened
function selected(ui: UI): string {
  const st = stationOf(ui);
  return ui.s.recipe[ui.s.tab] ?? { forge: 'w:blade:1', workshop: 'b:sack', apothecary: 'brew' }[st];
}
const heldPatterns = (p: M.Profile, st: StationId) => Object.keys(p.schematics).filter((id) => p.schematics[id] > 0 && SCHEMATICS[id]?.kind === 'pattern' && PATTERNS[SCHEMATICS[id].ref].station === st);

/** Everything about one recipe at one station. */
function rec(ui: UI, st: StationId, key: string): Rec | null {
  const p = ui.p;
  const s = ui.s;
  const [k, a, b] = key.split(':');
  const tierOk = (need: number): [boolean, string] => [p.stations[st] >= need, `${STATIONS[st].name} tier ${roman(need)}${p.stations[st] >= need ? '' : ` (yours is ${roman(p.stations[st])})`}`];
  if (k === 'up') {
    const n = M.stationNeeds(p, st);
    if (!n) return null;
    const reqs: [boolean, string][] = [];
    if (n.blueprint) reqs.push([(p.schematics[n.blueprint] ?? 0) > 0, `${SCHEMATICS[n.blueprint].name}${(p.schematics[n.blueprint] ?? 0) > 0 ? ' (held)' : ''}`]);
    return {
      key, name: `${STATIONS[st].name} tier ${roman(n.tier)}`, kind: 'Station upgrade', icon: I.stationIcon(st), rarity: Math.min(4, n.tier - 1) as Rarity, tier: n.tier,
      text: [`Unlocks: ${STATIONS[st].tiers[n.tier - 1]}.`], cost: n.cost, coin: n.coin, reqs, xp: 0, batch: false,
      make: () => M.upgradeStation(p, st),
    };
  }
  if (k === 'w') {
    const fam = a as Fam;
    const tier = Number(b);
    const d = WEAPONS[fam];
    const need = M.chosenPerks(p);
    const chosen = s.perks.filter((x) => PERKS[x]).slice(0, need);
    return {
      key, name: `${GRADE[tier]} ${d.name.toLowerCase()}`, kind: `${d.name} · grade ${roman(tier)} weapon`, icon: I.weaponIcon(fam), rarity: Math.min(3, need + 1) as Rarity, tier,
      text: [d.text, `Ability: ${d.ability.name}. ${d.ability.text}.`], cost: M.weaponCost(fam, tier), coin: M.weaponFee(p, tier),
      reqs: [tierOk(M.gradeStation(tier))], choose: chosen.length >= need ? undefined : `Choose ${need - chosen.length} ${chosen.length ? 'more ' : ''}perk${need - chosen.length > 1 ? 's' : ''}`, xp: 20 * tier, batch: true,
      make: () => M.craftWeapon(p, fam, tier, chosen),
    };
  }
  if (k === 't') {
    const node = a as GearTool['node'];
    const tier = Number(b);
    const t = TOOLS[node];
    return {
      key, name: `${GRADE[tier]} ${t.name.toLowerCase()}`, kind: `${t.name} · grade ${roman(tier)} tool`, icon: I.toolIcon(node, tier), rarity: (tier - 1) as Rarity, tier,
      text: [t.text, `At this grade: ${modText(t.mods(tier))}.`], cost: M.toolCost(node, tier), coin: M.toolFee(p, tier), reqs: [tierOk(M.gradeStation(tier))], xp: 14 * tier, batch: false,
      make: () => M.craftTool(p, node, tier),
    };
  }
  if (k === 'b') {
    const def = BAG_TYPES[a];
    if (!def) return null;
    const choose = p.stations.workshop >= 4;
    return {
      key, name: def.name, kind: 'Bag', icon: I.bagIcon(a), rarity: Math.max(0, ['sack', 'pack', 'frame'].indexOf(a)) as Rarity, tier: Math.max(1, ['sack', 'pack', 'frame'].indexOf(a) + 1),
      text: [`Carries ${def.comfort + p.skills.outfitting.lvl} weight before it slows you (${def.comfort}, +${p.skills.outfitting.lvl} from outfitting).`, `One kind of material weighs 40% less in it: ${choose ? `you choose (${s.burden})` : 'rolled at random until the workshop is tier IV'}.`],
      cost: def.cost, coin: M.bagFee(p, a), reqs: [tierOk(def.station)], xp: 25 * def.station, batch: false,
      make: () => M.craftBag(p, a, choose ? s.burden : null),
    };
  }
  if (k === 'p') {
    const sc = SCHEMATICS[a];
    const pat = sc && PATTERNS[sc.ref];
    if (!pat) return null;
    const held = p.schematics[a] ?? 0;
    return {
      key, name: pat.name, kind: `Named ${pat.station === 'forge' ? 'forge' : 'workshop'} pattern · used once`, icon: I.schemIcon('pattern'), rarity: 4, text: [pat.text, 'The pattern is used up.'],
      cost: pat.cost, coin: M.patternFee(p, pat.station), reqs: [tierOk(2), [held > 0, `Pattern held (${held})`]], xp: 60, batch: false,
      make: () => M.usePattern(p, a),
    };
  }
  return null;
}
/** How many can be made now, and if none, the reason in words short enough for a button. */
function can(ui: UI, r: Rec, qty = 1, strict = false): { n: number; why: string } {
  const gate = r.reqs.find(([ok]) => !ok);
  if (gate) return { n: 0, why: `Needs ${gate[1]}` };
  const n = affordable(ui.p, r.cost, r.coin);
  if (n < qty) return { n, why: `Need ${shortfall(ui.p, r.cost, r.coin, qty)}` };
  // a choice still to make (perks) blocks the button, not the "how many can I make" count
  return { n: r.batch ? n : Math.min(1, n), why: strict && r.choose ? r.choose : '' };
}
/** For the result window: can the selected recipe be made again right now? */
export function moreNow(ui: UI): { n: number; why: string } {
  if (ui.s.modal?.kind === 'result' && ui.s.modal.spent) return { n: 0, why: 'The pattern is used up' };
  const st = stationOf(ui);
  const key = selected(ui);
  if (st === 'apothecary') {
    const b = brewCheck(ui);
    return { n: b.block ? 0 : Math.floor(Math.min(ui.p.bank[ui.s.ra] ?? 0, ui.p.bank[ui.s.rb] ?? 0) / 2), why: b.block ?? '' };
  }
  const r = rec(ui, st, key);
  if (!r) return { n: 0, why: 'Nothing more to make' };
  if (key.startsWith('p:') && !(ui.p.schematics[key.slice(2)] > 0)) return { n: 0, why: 'The pattern is used up' };
  return can(ui, r);
}

// ------------------------------------------------------------------- list
function row(ui: UI, st: StationId, key: string, label = ''): string {
  const r = rec(ui, st, key);
  if (!r) return '';
  const c = can(ui, r);
  if (ui.s.craftable && c.n <= 0) return '';
  return `<button class="rl${selected(ui) === key ? ' on' : ''}${c.n > 0 ? '' : ' no'}" data-a="rsel" data-v="${key}" aria-pressed="${selected(ui) === key}">${ic(r.icon)}<span class="nm">${label || cap(r.name)}</span>${
    c.n > 0 ? `<span class="cnt">${r.batch || c.n > 1 ? `×${c.n}` : 'ready'}</span>` : `<span class="why">${c.why}</span>`}</button>`;
}
function gradeRow(ui: UI, st: StationId, prefix: string, id: string, name: string, icon: string): string {
  const cells = [1, 2, 3].map((t) => {
    const key = `${prefix}:${id}:${t}`;
    const r = rec(ui, st, key)!;
    const c = can(ui, r);
    const gate = r.reqs[0][0] ? '' : 'lock';
    return { key, c, html: `<button class="grade${selected(ui) === key ? ' on' : ''}${c.n > 0 ? '' : ' no'}" data-a="rsel" data-v="${key}" data-tip="text:${cap(r.name)}: ${c.n > 0 ? `you can make ${r.batch ? c.n : 'one'} now` : c.why.replace(/^N/, 'n')}" aria-label="${r.name}, ${c.n > 0 ? `can make ${c.n}` : c.why}">${roman(t)}<small>${c.n > 0 ? `×${c.n}` : gate ? uiIcon('lock') : '0'}</small></button>` };
  });
  if (ui.s.craftable && !cells.some((x) => x.c.n > 0)) return '';
  return `<div class="rl" style="cursor:default">${ic(icon)}<span class="nm">${name}</span><span class="grades">${cells.map((x) => x.html).join('')}</span></div>`;
}

function list(ui: UI, st: StationId): string {
  const p = ui.p;
  const pats = heldPatterns(p, st);
  const up = M.stationNeeds(p, st);
  let body = st === 'apothecary' ? '' : `<label class="row small" style="margin-bottom:4px;cursor:pointer;min-height:44px;flex-wrap:nowrap"><input type="checkbox" data-a="craftable" ${ui.s.craftable ? 'checked' : ''} style="width:20px;height:20px;margin:0 2px;flex:none"> Only what I can make now</label>`;
  body += `<div class="cat">Station</div>${up ? row(ui, st, 'up', `Raise to tier ${roman(up.tier)}`) : '<p class="dim small">At the top tier.</p>'}`;
  if (st === 'forge') {
    body += `<div class="cat">Weapons <small>grade I · II · III</small></div>${FAMS.map((f) => gradeRow(ui, st, 'w', f, WEAPONS[f].name, I.weaponIcon(f))).join('')}`;
    body += `<div class="cat">Tools</div>${TOOL_IDS.map((t) => gradeRow(ui, st, 't', t, TOOLS[t].name, I.toolIcon(t, 1))).join('')}`;
  } else if (st === 'workshop') {
    body += `<div class="cat">Bags</div>${Object.keys(BAG_TYPES).map((b) => row(ui, st, `b:${b}`)).join('')}`;
  } else {
    body += `<div class="cat">Brewing</div><button class="rl${selected(ui) === 'brew' ? ' on' : ''}" data-a="rsel" data-v="brew">${ic(I.brewIcon('flask', '#9fd0c0'))}<span class="nm">Brew two reagents</span></button>
      <button class="rl${selected(ui) === 'book' ? ' on' : ''}" data-a="rsel" data-v="book">${ic(I.uiIcon('codex'))}<span class="nm">Reagent book</span><span class="cnt">${M.REAGENTS.reduce((a, m) => a + (p.book[m.id]?.length ?? 0), 0)}/${M.REAGENTS.length * 4}</span></button>`;
    const brews = Object.keys(p.brews).filter((k) => p.brews[k] > 0);
    body += `<div class="cat">In storage <small>${brews.length}</small></div>${brews.length ? `<div class="tiles">${brews.map((k) => tile(describe(`brew:${k}`, ui.ctx), { size: 'sm', qty: p.brews[k], a: 'goto', v: `brew:${k}` })).join('')}</div><p class="dim small" style="margin-top:6px">Click one to pack it for the expedition.</p>` : '<p class="dim small">No brews yet.</p>'}`;
  }
  if (st !== 'apothecary') {
    body += `<div class="cat">Named patterns <small>${pats.length} held</small></div>${pats.length ? pats.map((id) => row(ui, st, `p:${id}`, `${PATTERNS[SCHEMATICS[id].ref].name} ×${p.schematics[id]}`)).join('') : `<p class="dim small">${p.stations[st] < 2 ? `Needs ${STATIONS[st].name.toLowerCase()} tier II. ` : ''}None held. Named elites, shrines and boss chests carry them.</p>`}`;
    const kinds = st === 'forge' ? ['weapon', 'tool'] : ['bag'];
    const owned = p.gear.filter((g) => kinds.includes(g.kind));
    body += `<div class="cat">You own</div><p class="small">${kinds.map((k) => { const n = owned.filter((g) => g.kind === k).length; return `${n} ${k}${n === 1 ? '' : 's'}`; }).join(', ')}. <button class="link" data-a="goto" data-v="Inventory">Open the inventory</button></p>`;
  }
  return `<section class="panel list" data-scroll="list"><h2>${st === 'apothecary' ? 'Brew' : 'Make'}</h2>${body}</section>`;
}

// ------------------------------------------------------ recipe and outcome
function milestones(ui: UI, st: StationId): string {
  const t = ui.p.stations[st];
  return `<div class="milestones wrap">${STATIONS[st].tiers.map((x, i) => `<div class="ms ${i < t ? 'done' : i === t ? 'next' : 'locked'}"><div class="lv">${roman(i + 1)}${i < t ? ` ${uiIcon('check')}` : ''}</div>${x}</div>`).join('')}</div>`;
}
function ownedLine(ui: UI, key: string): string {
  const [k, a] = key.split(':');
  const p = ui.p;
  if (k === 'w') {
    const mine = M.weaponsOf(p).filter((g) => g.fam === a);
    return mine.length ? `You own ${mine.length} ${WEAPONS[a as Fam].name.toLowerCase()}${mine.length > 1 ? 's' : ''}, best gear score ${Math.max(...mine.map((g) => g.gs))}. <button class="link" data-a="goto" data-v="gear:${[...mine].sort((x, y) => y.gs - x.gs)[0].uid}">Show</button>` : `You own no ${WEAPONS[a as Fam].name.toLowerCase()} yet.`;
  }
  if (k === 't') {
    const mine = M.toolsOf(p).filter((g) => g.node === a);
    if (!mine.length) return `You own no ${TOOLS[a as GearTool['node']].name.toLowerCase()} yet.`;
    const best = Math.max(...mine.map((g) => g.tier));
    return `You own ${mine.length}, best grade ${roman(best)}.${best >= Number(key.split(':')[2]) ? ` <span class="warn">A tool has no rolls: this one would be the same as, or worse than, the one you have.</span>` : ''}`;
  }
  if (k === 'b') {
    const mine = M.bagsOf(p);
    return `You own ${mine.length} bag${mine.length === 1 ? '' : 's'}, best comfort ${Math.max(0, ...mine.map((g) => g.comfort))}.`;
  }
  return '';
}

function craftView(ui: UI, st: StationId, key: string): string {
  const p = ui.p;
  const s = ui.s;
  const r = rec(ui, st, key);
  if (!r) return `<section class="panel"><h2>${STATIONS[st].name}</h2><p class="dim">The ${STATIONS[st].name.toLowerCase()} is at its top tier.</p>${milestones(ui, st)}</section><section class="panel out"></section>`;
  const [k, a, b] = key.split(':');
  const c1 = can(ui, r);
  const qty = r.batch ? Math.max(1, Math.min(s.qty, Math.max(1, c1.n))) : 1;
  const c = can(ui, r, qty, true);
  const d: Desc = { ref: `text:${r.name}`, icon: r.icon, name: cap(r.name), rarity: r.rarity, type: r.kind, tier: r.tier, stats: [], perks: [], notes: [] };
  let middle = `<div class="preview">${tile(d, { size: 'lg' })}<div><div class="nm">${r.name}</div><div class="dim small">${r.kind}</div>${r.text.map((x) => `<p class="small" style="margin:4px 0 0">${x}</p>`).join('')}</div></div>`;
  if (k === 'up') middle += `<h4>What each tier gives</h4>${milestones(ui, st)}`;
  let options = '';
  if (k === 'w') {
    const need = M.chosenPerks(p);
    const chosen = s.perks.filter((x) => PERKS[x]).slice(0, need);
    options = `<h4>Perks: choose ${need}${need < 2 ? ' <span class="dim" style="text-transform:none;letter-spacing:0">(a second at codex rank 2)</span>' : ''}</h4>
      ${Object.entries(PERKS).map(([id, pk]) => `<button class="item pickable${chosen.includes(id) ? ' on' : ''}" style="width:100%;text-align:left;min-height:44px;padding:4px 8px" data-a="perk" data-v="${id}" aria-pressed="${chosen.includes(id)}">${ic(I.modIcon(pk.mods[0][0] as ModKey))}<span class="nm">${pk.name}</span><span class="sub grow">${cap(modText(pk.mods))}</span>${chosen.includes(id) ? uiIcon('check') : ''}</button>`).join('')}
      <div class="slot lockd" style="margin-top:6px"><span class="tile sm static">${I.uiIcon('help')}</span><div class="grow"><div class="lab">Rolled</div><div class="small">One more perk is rolled at random from the ${Object.keys(PERKS).length - need} you did not choose. Make several and keep the roll you like.</div></div></div>`;
  } else if (k === 'b') {
    const choose = p.stations.workshop >= 4;
    options = `<h4>Lightens</h4>${choose ? `<div class="row">${BURDENS.map((cat) => `<button class="seg${s.burden === cat ? ' on' : ''}" data-a="burden" data-v="${cat}" aria-pressed="${s.burden === cat}">${cap(cat)} −40%</button>`).join('')}</div>`
      : `<div class="slot lockd"><span class="tile sm static">${I.uiIcon('lock')}</span><div class="grow"><div class="lab">Workshop tier IV</div><div class="small">Until then the lightened material (ore, wood or herbs) is rolled at random.</div></div></div>`}`;
  } else if (k === 'up') {
    const n = M.stationNeeds(p, st)!;
    if (n.blueprint) {
      const held = (p.schematics[n.blueprint] ?? 0) > 0;
      options = `<h4>Blueprint</h4><div class="slot${held ? '' : ' short'}">${tile(describe(`schem:${n.blueprint}`, ui.ctx), { size: 'sm' })}<div class="grow"><div class="lab">Blueprint</div><div class="cnt"><b>${held ? 1 : 0}</b> / 1 <span class="small dim" style="font-family:var(--sans)">${SCHEMATICS[n.blueprint].name}</span></div>${held ? '' : `<div class="small dim">${schemSource(n.blueprint)}</div>`}</div></div>`;
    }
  }
  middle += `<div class="two" style="margin-top:12px"><div><h4 style="margin-top:0">Materials${qty > 1 ? ` for ${qty}` : ''}</h4>${costSlots(p, r.cost, r.coin, qty)}</div><div>${options ? options.replace('<h4>', '<h4 style="margin-top:0">') : '<h4 style="margin-top:0">Options</h4><p class="dim small">Nothing to choose for this one.</p>'}</div></div>`;

  // outcome
  let out = '';
  if (k === 'w') {
    const g = M.gsRange(p, Number(b));
    out = `<h4 style="margin-top:0">Gear score it can roll</h4><div class="bignum">${g.lo}–${g.hi}</div>${rangeBar(g.min, g.hi, g.lo, g.hi, { notch: g.lo })}
      <p class="dim small">Smithing ${p.skills.smithing.lvl} raises the lowest roll by ${g.lo - g.min}. Gear score does one thing: it strengthens the weapon's perks, from ×1.0 at 200 to ×1.5 at 500.</p>
      <div class="kv"><span class="dim">Perk strength</span><span>×${perkQuality(g.lo).toFixed(2)}–${perkQuality(g.hi).toFixed(2)}</span></div>
      <div class="kv"><span class="dim">Perks</span><span>${M.chosenPerks(p)} chosen + 1 rolled</span></div>
      <div class="kv"><span class="dim">Ability it brings</span><span>${WEAPONS[a as Fam].ability.name}</span></div>`;
  } else if (k === 'b') out = `<h4 style="margin-top:0">Comfort</h4><div class="bignum">${BAG_TYPES[a].comfort + p.skills.outfitting.lvl}</div><p class="dim small">weight carried before slowing. Your best bag now: ${Math.max(0, ...M.bagsOf(p).map((g) => g.comfort))}.</p>`;
  else if (k === 't') out = `<h4 style="margin-top:0">At this grade</h4><p>${cap(modText(TOOLS[a as GearTool['node']].mods(Number(b))))}</p>`;
  else if (k === 'up') out = `<h4 style="margin-top:0">Next tier</h4><p>${STATIONS[st].tiers[p.stations[st]]}</p>`;
  const own = ownedLine(ui, key);
  if (own) out += `<p class="small" style="margin-top:8px">${own}</p>`;
  if (r.batch) {
    out += `<h4>How many</h4><div class="stepper"><button data-a="qty" data-v="-1" aria-label="One fewer" ${qty <= 1 ? 'disabled' : ''}>−</button><b>${qty}</b><button data-a="qty" data-v="1" aria-label="One more" ${qty >= c1.n ? 'disabled' : ''}>+</button><button class="sm max" data-a="qty" data-v="max" ${c1.n <= 1 ? 'disabled' : ''}>Max ${Math.max(c1.n, 0)}</button></div>
      <p class="dim small" style="text-align:center">You can make ${c1.n} now. Each one rolls its own gear score and perk.</p>`;
  }
  const sk = SKILL_OF[st];
  const lv = p.skills[sk];
  out += `<h4>Requirements</h4>${r.reqs.map(([ok, text]) => req(ok, text)).join('')}${k === 'w' ? req(!r.choose, r.choose ?? 'Perks chosen') : ''}${req(!shortfall(p, r.cost, 0, qty), shortfall(p, r.cost, 0, qty) ? `Materials: need ${shortfall(p, r.cost, 0, qty)}` : 'Materials')}${r.coin ? req(p.coin >= r.coin * qty, `Fee: ${r.coin * qty} coin (you have ${p.coin})`) : ''}
    <button class="pri big" style="margin-top:10px" data-a="make" data-key="Enter" ${c.why ? 'disabled' : ''}>${c.why || `${k === 'up' ? 'Raise' : 'Craft'}${qty > 1 ? ` ${qty}` : ''} <span class="kc">Enter</span>`}</button>
    ${r.xp ? `<div class="row small" style="margin-top:10px">${ring(lv.lvl >= SKILL_CAP ? 1 : lv.xp / skillXpFor(lv.lvl), lv.lvl, 40, '')}<span><span style="color:var(--xp)">+${r.xp * qty} ${sk} xp</span><br><span class="dim">${lv.lvl >= SKILL_CAP ? 'at the cap' : `${Math.round(lv.xp)}/${skillXpFor(lv.lvl)} to level ${lv.lvl + 1}`}</span></span></div>` : ''}`;
  return `<section class="panel" data-scroll="mid"><h2>${k === 'up' ? 'Upgrade' : 'Recipe'}</h2>${middle}</section><section class="panel out" data-scroll="out"><h2>Outcome</h2>${out}</section>`;
}

// ---------------------------------------------------------------- alchemy
function effectPips(p: M.Profile, id: string): string {
  const known = p.book[id] ?? [];
  return `<span class="row" style="gap:3px;flex-wrap:nowrap">${[0, 1, 2, 3].map((i) => known[i] ? `<span class="chip" style="margin:0;padding:1px 7px;font-size:12px"><i style="width:8px;height:8px;border-radius:50%;background:${atomColor(known[i])}"></i>${ATOMS[known[i]].name}</span>` : '<span class="chip unknown" style="margin:0;padding:1px 7px;font-size:12px">?</span>').join('')}</span>`;
}
/** What the player can know about a pair before brewing it. */
function pairKnowledge(p: M.Profile, a: string, b: string): { inert: boolean; shared: AtomId[] } {
  if (!a || !b || a === b) return { inert: false, shared: [] };
  const ka = p.book[a] ?? [];
  const kb = p.book[b] ?? [];
  return { inert: M.knownInert(p, a, b), shared: ka.filter((x) => kb.includes(x)).slice(0, 3) };
}
function brewCheck(ui: UI): { block: string | null; reqs: [boolean, string][] } {
  const p = ui.p;
  const s = ui.s;
  const two = !!s.ra && !!s.rb && s.ra !== s.rb;
  const enough = two && (p.bank[s.ra] ?? 0) >= 2 && (p.bank[s.rb] ?? 0) >= 2;
  const tier = p.stations.apothecary >= FORM[s.form].station;
  const reqs: [boolean, string][] = [[two, 'Two different reagents chosen'], [enough, `Two of each reagent${two && !enough ? ` (${p.bank[s.ra] ?? 0} and ${p.bank[s.rb] ?? 0})` : ''}`], [tier, `Apothecary tier ${roman(FORM[s.form].station)} for a ${FORM[s.form].name.toLowerCase()}`]];
  return { block: !two ? 'Choose two reagents' : !enough ? 'Need two of each reagent' : !tier ? `Needs apothecary tier ${roman(FORM[s.form].station)}` : null, reqs };
}

function brewView(ui: UI): string {
  const p = ui.p;
  const s = ui.s;
  const active = !s.ra ? 'ra' : !s.rb ? 'rb' : '';
  const slot = (which: 'ra' | 'rb', id: string) => `<div class="slot pick${active === which ? ' on' : ''}" style="flex:1 1 200px" ${id ? `data-a="${which}" data-v=""` : ''} role="button" tabindex="0">${id ? tile(describeMat(id, ui.ctx), { qty: p.bank[id] ?? 0, round: true }) : `<span class="tile empty static">${I.uiIcon('plus')}</span>`}
    <div class="grow"><div class="lab">${which === 'ra' ? 'First' : 'Second'} reagent · uses 2</div>${id ? `<b>${MATS[id].name}</b><div style="margin-top:3px">${effectPips(p, id)}</div><div class="dim small">click to clear</div>` : `<span class="dim">${active === which ? 'Pick one below' : 'Empty'}</span>`}</div></div>`;
  // a reagent that ran out cannot stay selected
  if (s.ra && (p.bank[s.ra] ?? 0) < 2) s.ra = '';
  if (s.rb && (p.bank[s.rb] ?? 0) < 2) s.rb = '';
  const have = M.REAGENTS.filter((m) => (p.bank[m.id] ?? 0) >= 1);
  const other = s.ra && !s.rb ? s.ra : s.rb && !s.ra ? s.rb : '';
  const grid = have.length ? have.map((m) => {
    const k = other ? pairKnowledge(p, other, m.id) : null;
    const mark = !other || m.id === other ? '' : k!.inert ? `<span class="bad small">${uiIcon('cross')} shares nothing</span>` : k!.shared.length ? `<span class="ok small">${uiIcon('check')} shares ${k!.shared.map((x) => ATOMS[x].name).join(', ')}</span>` : '<span class="dim small">untried</span>';
    const chosen = m.id === s.ra || m.id === s.rb;
    const few = (p.bank[m.id] ?? 0) < 2;
    if (few) return `<div class="item" style="opacity:.55">${tile(describeMat(m.id, ui.ctx), { size: 'sm', qty: p.bank[m.id], round: true })}<div class="grow"><div class="nm">${m.name}</div>${effectPips(p, m.id)}</div><div class="act"><span class="bad small">have 1, a brew uses 2</span></div></div>`;
    return `<button class="item pickable${chosen ? ' on' : ''}" style="width:100%;text-align:left" data-a="reagent" data-v="${m.id}" ${chosen ? 'disabled' : ''}>${tile(describeMat(m.id, ui.ctx), { size: 'sm', qty: p.bank[m.id], round: true })}<div class="grow"><div class="nm">${m.name}</div>${effectPips(p, m.id)}</div><div class="act">${mark}</div></button>`;
  }).join('') : '<p class="dim">You need at least two of a reagent. Ore, wood, herbs and what kills leave behind are all reagents.</p>';
  const forms = (Object.keys(FORM) as BrewForm[]).map((f) => `<button class="seg${s.form === f ? ' on' : ''}" data-a="form" data-v="${f}" aria-pressed="${s.form === f}">${ic(I.brewIcon(f, '#9fd0c0'))}${FORM[f].name}${p.stations.apothecary < FORM[f].station ? ` <span class="bad small">tier ${roman(FORM[f].station)}</span>` : ''}</button>`).join('');
  const middle = `<p class="small">Every reagent hides four effects. Brew two reagents that share an effect and the brew carries what they share (up to three). Share nothing and you get sludge: the reagents are gone, but you learn the pair is inert.</p>
    <div class="row" style="align-items:stretch">${slot('ra', s.ra)}${slot('rb', s.rb)}</div>
    <h4>Form</h4><div class="row">${forms}</div><p class="dim small" style="margin-top:4px">${FORM[s.form].name}: lasts ${FORM[s.form].lasts}. Strength ×${FORM[s.form].m}.</p>
    <h4>Your reagents <span class="dim" style="text-transform:none;letter-spacing:0">(a brew uses two of each)</span></h4>${grid}`;

  const chk = brewCheck(ui);
  const k = pairKnowledge(p, s.ra, s.rb);
  const batch = p.stations.apothecary >= 5 ? 3 : p.stations.apothecary >= 4 ? 2 : 1;
  const lv = p.skills.alchemy;
  let predict: string;
  if (!s.ra || !s.rb) predict = '<p class="dim">Choose two reagents to see what you know about the pair.</p>';
  else if (k.inert) predict = `<p class="bad">${uiIcon('cross')} You have tried this pair: they share nothing. Brewing it again makes sludge.</p>`;
  else if (k.shared.length) predict = `<p class="ok">${uiIcon('check')} They share ${k.shared.map((x) => `<b>${ATOMS[x].name}</b>`).join(' and ')}.</p><p class="small">${cap(modText(k.shared.flatMap((x) => ATOMS[x].mods(FORM[s.form].m))))}.</p>${k.shared.some((x) => ATOMS[x].volatile) ? `<p class="warn small">Volatile: ${k.shared.map((x) => ATOMS[x].volatile).filter(Boolean).join('; ')}.</p>` : ''}<p class="dim small">They may share more that you have not found yet.</p>`;
  else predict = `<p class="warn">${uiIcon('help')} Untried pair. If they share an effect you get a brew and learn it; if not, sludge and the four reagents are lost.</p>`;
  const out = `<h4 style="margin-top:0">What you know</h4>${predict}
    <div class="kv"><span class="dim">Each brew makes</span><span>${batch}${batch < 3 ? ` <span class="dim small">(more at tier ${batch === 1 ? 'IV' : 'V'})</span>` : ''}</span></div>
    <div class="kv"><span class="dim">Chance of one more</span><span>${(lv.lvl - 1) * 4}% <span class="dim small">(alchemy ${lv.lvl})</span></span></div>
    <h4>Requirements</h4>${chk.reqs.map(([ok, t]) => req(ok, t)).join('')}
    <button class="pri big" style="margin-top:10px" data-a="brew" data-key="Enter" ${chk.block ? 'disabled' : ''}>${chk.block ?? 'Brew <span class="kc">Enter</span>'}</button>
    <div class="row small" style="margin-top:10px">${ring(lv.lvl >= SKILL_CAP ? 1 : lv.xp / skillXpFor(lv.lvl), lv.lvl, 40, '')}<span><span style="color:var(--xp)">+12 alchemy xp</span> <span class="dim">(+3 for sludge)</span><br><span class="dim">${lv.lvl >= SKILL_CAP ? 'at the cap' : `${Math.round(lv.xp)}/${skillXpFor(lv.lvl)} to level ${lv.lvl + 1}`}</span></span></div>`;
  return `<section class="panel" data-scroll="mid"><h2>Brew</h2>${middle}</section><section class="panel out" data-scroll="out"><h2>Outcome</h2>${out}</section>`;
}
function bookView(ui: UI): string {
  const p = ui.p;
  const rows = M.REAGENTS.map((m) => `<div class="item">${tile(describeMat(m.id, ui.ctx), { size: 'sm', qty: p.bank[m.id] ?? 0, round: true })}<div class="grow"><div class="nm">${m.name}</div><div class="sub">${cap(m.cat)}${m.cat === 'creature' ? '' : ` · tier ${roman(m.tier)}`}</div></div><div class="act">${effectPips(p, m.id)}</div></div>`).join('');
  return `<section class="panel" data-scroll="mid" style="grid-column:2 / -1"><h2>Reagent book</h2><p class="small dim">What you have discovered so far. Each reagent has four effects; an effect is found when a brew carries it.</p>${rows}</section>`;
}

/** On a phone the outcome column scrolls away, so the one button is repeated in a bar that stays put. */
function footFor(ui: UI, st: StationId, key: string): string {
  if (st === 'apothecary') {
    if (key !== 'brew') return '';
    const chk = brewCheck(ui);
    return `<button class="pri" data-a="brew" ${chk.block ? 'disabled' : ''}>${chk.block ?? 'Brew'}</button>`;
  }
  const r = rec(ui, st, key);
  if (!r) return '';
  const qty = r.batch ? Math.max(1, Math.min(ui.s.qty, Math.max(1, can(ui, r).n))) : 1;
  const c = can(ui, r, qty, true);
  return `<button class="pri" data-a="make" ${c.why ? 'disabled' : ''}>${c.why || `${key === 'up' ? 'Raise' : 'Craft'}${qty > 1 ? ` ${qty}` : ''} · ${r.name}`}</button>`;
}

export function view(ui: UI): Page {
  const st = stationOf(ui);
  const key = selected(ui);
  const p = ui.p;
  const lv = p.skills[SKILL_OF[st]];
  const body = st === 'apothecary' && key === 'brew' ? brewView(ui) : st === 'apothecary' && key === 'book' ? bookView(ui) : craftView(ui, st, key);
  return {
    title: `${STATIONS[st].name} <span style="color:var(--gold)">tier ${roman(p.stations[st])}</span>`,
    cur: `<span data-tip="text:Coin pays crafting fees. Every wave cleared pays coin; surplus materials sell in the inventory.">${uiIcon('coin')}<b class="num">${p.coin}</b></span>
      <span data-tip="text:${cap(SKILL_OF[st])} level ${lv.lvl}. ${{ forge: 'Raises the lowest gear score a forged weapon can roll.', workshop: 'Each level adds 1 comfort to bags you make from the bag list. Bags from named patterns have a fixed comfort.', apothecary: 'Each level adds 4% chance of one more brew from a batch.' }[st]}">${ic(I.skillIcon(SKILL_OF[st]))}<span class="hide-phone">${cap(SKILL_OF[st])}</span> <b class="num">${lv.lvl}</b></span>`,
    fit: true,
    body: `<button class="ghost only-narrow" data-a="stlist" style="margin-bottom:8px${ui.s.stPane === 'recipe' ? '' : ';display:none'}">${uiIcon('back')} All recipes</button>
      <div class="station" data-pane="${ui.s.stPane}">${list(ui, st)}${body}</div>`,
    foot: ui.s.stPane === 'recipe' ? footFor(ui, st, key) : '',
    footNarrow: true,
  };
}

export function act(ui: UI, a: string, v: string, _w: string): boolean | 'leave' | void {
  const p = ui.p;
  const s = ui.s;
  const snd = ui.hooks.sound;
  const st = stationOf(ui);
  switch (a) {
    case 'rsel':
      // on a phone the recipe replaces the list: it opens at its top, and the list remembers where it was
      if (onePane() && s.stPane === 'list') {
        listScroll = pageScroll();
        scrollPageAfter(0);
      }
      s.recipe[s.tab] = v; s.qty = 1; s.stPane = 'recipe';
      return true;
    case 'stlist':
      if (onePane() && s.stPane === 'recipe') scrollPageAfter(listScroll);
      s.stPane = 'list';
      return true;
    case 'craftable': s.craftable = !s.craftable; return true;
    case 'perk': {
      const n = M.chosenPerks(p);
      s.perks = s.perks.includes(v) ? s.perks.filter((x) => x !== v) : [...s.perks, v].slice(-n);
      return true;
    }
    case 'burden': s.burden = v as Mat['cat']; return true;
    case 'qty': {
      const r = rec(ui, st, selected(ui));
      const max = r ? Math.max(1, can(ui, r).n) : 1;
      s.qty = v === 'max' ? max : Math.max(1, Math.min(max, s.qty + Number(v)));
      return true;
    }
    case 'make': {
      const key = selected(ui);
      const r = rec(ui, st, key);
      if (!r) return true;
      const qty = r.batch ? Math.max(1, s.qty) : 1;
      const c = can(ui, r, qty, true);
      if (c.why) return ui.fail(`${c.why}.`), true;
      const sk = SKILL_OF[st];
      const before = { ...p.skills[sk] };
      const chosen = s.perks.slice(0, M.chosenPerks(p));
      const made: Gear[] = [];
      for (let i = 0; i < qty; i++) {
        const res = r.make();
        if (typeof res === 'string') {
          ui.fail(res);
          break;
        }
        if (res === null) {
          // a station upgrade
          snd.ui('merge');
          ui.close();
          ui.say(`${STATIONS[st].name} raised to tier ${roman(p.stations[st])}: ${STATIONS[st].tiers[p.stations[st] - 1]}.`);
          s.recipe[s.tab] = M.stationNeeds(p, st) ? 'up' : { forge: 'w:blade:1', workshop: 'b:sack', apothecary: 'brew' }[st];
          return true;
        }
        made.push(res);
      }
      if (made.length) {
        snd.ui(key.startsWith('p:') ? 'merge' : 'craft');
        s.qty = 1;
        const spent = key.startsWith('p:') && !(p.schematics[key.slice(2)] > 0);
        ui.open({ kind: 'result', uids: made.map((g) => g.uid), chosen, before, skill: sk, again: 'make', spent });
        if (spent) s.recipe[s.tab] = st === 'forge' ? 'w:blade:1' : 'b:sack'; // the list moves on; the window still speaks for the pattern
      }
      return true;
    }
    case 'ra': s.ra = v; return true;
    case 'rb': s.rb = v; return true;
    case 'reagent':
      if (!s.ra) s.ra = v;
      else if (!s.rb) s.rb = v;
      else s.rb = v;
      return true;
    case 'form': s.form = v as BrewForm; return true;
    case 'brew': {
      const chk = brewCheck(ui);
      if (chk.block) return ui.fail(`${chk.block}.`), true;
      const before = { ...p.skills.alchemy };
      const known = (id: string) => [...(p.book[id] ?? [])];
      const [ka, kb] = [known(s.ra), known(s.rb)];
      const fxA = MATS[s.ra].fx ?? [];
      const shared = fxA.filter((x) => (MATS[s.rb].fx ?? []).includes(x)).slice(0, 3);
      const key = shared.length ? brewKey({ form: s.form, atoms: shared }) : null;
      const had = key ? p.brews[key] ?? 0 : 0;
      const res = M.brew(p, s.ra, s.rb, s.form);
      const found = shared.filter((x) => !ka.includes(x) || !kb.includes(x));
      snd.ui(res.ok ? 'craft' : 'deny');
      ui.open({ kind: 'brewed', ok: res.ok, title: res.text, lines: res.ok ? [] : ['The four reagents are gone. The pair is now marked as inert in the picker.'], found: res.ok ? found : [], key: res.ok ? key : null, count: key ? (p.brews[key] ?? 0) - had : 0, ...({ before } as object) });
      return true;
    }
  }
  return false;
}
