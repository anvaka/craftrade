// The camp between waves: the build next to the shop, the camp craft, flasks, the bag, and the choice of ground that starts the wave.
import {
  BOSSES, CFG, CURSES, ELITES, FORM, GROUNDS, ITEMS, MATS, MAX_TIER, NODE_MAT, OBJECTIVES, RECIPES, SCHEMATICS, TOOLS, WEAPONS, WILDS,
  brewKey, brewMods, brewName, type Brew, type Fam, type Mods, type NodeKind,
} from '../data';
import * as R from '../run';
import type { Page, UI } from './app';
import * as I from './icons';
import { chip, ic, pips, req, tile, ui as icon } from './kit';
import { describe, roman } from './things';
import {
  CAPS, NO_COOL, STAT, bagPanel, ballastBonus, campKey, cap, capped, changeLines, cur, curseNext, dmgFactor, dpsText, emptySlot, evolveChecklist, expeditionStrip, frailAhead, fx, healWays,
  healthBar, heatBonus, inlineFx, keepShare, maxHpNext, mergePreview, modText, plural, routeChosen, slowOf, span, st, stile, tip, weaponFields, weaponNums, weaponTile,
} from './run-common';

const famName = (f: Fam) => WEAPONS[f].name;
const count = <T extends string>(list: T[]) => list.reduce<Record<string, number>>((a, id) => ((a[id] = (a[id] ?? 0) + 1), a), {});

// ------------------------------------------------------------------ build
/** Pairs of carried weapons that can merge: the index to pass to `merge`, once per pair. */
export function mergePairs(run: R.RunState): number[] {
  const out: number[] = [];
  run.weapons.forEach((w, i) => {
    const j = w.evolved ? -1 : R.mergeTarget(run, w.fam, w.tier, i);
    if (j > i && !out.some((k) => run.weapons[k].fam === w.fam && run.weapons[k].tier === w.tier)) out.push(i);
  });
  return out;
}

function weaponDetail(ui: UI, run: R.RunState, m: Mods, i: number): string {
  const w = run.weapons[i];
  if (!w) return '';
  const d = WEAPONS[w.fam];
  const n = weaponNums(w, run, m);
  const desc = describe(`rw:${i}`, ui.ctx);
  const j = w.evolved ? -1 : R.mergeTarget(run, w.fam, w.tier, i);
  const mp = j >= 0 ? mergePreview(run, m, i, j) : null;
  const last = run.weapons.length <= 1;
  const sealed = curseNext(run) === 'bound' && run.weapons.length > 1 && i === run.weapons.length - 1;
  return `<div class="wdetail r${desc.rarity}">
    <div class="row" style="gap:8px"><div class="grow"><div class="nm r${desc.rarity}">${desc.name} <span class="dim small">· slot ${i + 1}</span></div><div class="sub dim small">${desc.type} · gear score ${R.weaponGs(w)}</div></div>
      <button class="sm ghost" data-a="campsel" data-v="" aria-label="Close">${icon('close')}</button></div>
    ${weaponFields(n)}
    <p class="dim small" style="margin:4px 0">${w.evolved ? `${cap(d.evolvedText)}.` : d.text} ${n.shots > 1 ? 'Alone, one shard does' : 'Alone it does'} ${n.base.toFixed(0)} per second; the rest is your build. This expedition: ${Math.round(w.dmg)} damage, ${plural(w.kills, 'kill')}.${w.tier >= MAX_TIER && !w.evolved ? ' Top tier: it cannot merge further.' : ''}</p>
    ${sealed ? `<p class="bad small">Sealed by the Bound curse: it does not fire until the next boss wave is over.</p>` : ''}
    ${mp ? `<p class="small" style="margin:4px 0">Merge with the other ${R.weaponName(w)}: ${mp.text}${mp.lines ? ' The merge also moves:' : ''}</p>${mp.lines}` : ''}
    <div class="row" style="gap:6px">${j >= 0 ? `<button class="sm" data-a="merge" data-v="${i}">${icon('merge')} Merge into ${famName(w.fam)} ${roman(w.tier + 1)}</button>` : ''}
      <button class="sm danger" data-a="sell" data-v="${i}" ${last ? 'disabled' : ''}>${icon('sell')} Sell for ${R.sellPrice(run, w)} scrap</button>
      ${last ? '<span class="dim small">Your last weapon cannot be sold.</span>' : ''}</div></div>`;
}

function buildPanel(ui: UI, run: R.RunState, m: Mods, boss: boolean): string {
  const slots = R.effSlots(run);
  const sel = ui.s.campSel?.startsWith('rw:') ? Number(ui.s.campSel.slice(3)) : -1;
  const curse = curseNext(run);
  const sealedAt = curse === 'bound' && run.weapons.length > 1 ? run.weapons.length - 1 : -1;
  const free = run.weapons.length < slots;
  let total = 0;
  let totalHi = 0; // with every frost shard landing
  const cells = Array.from({ length: Math.max(slots, run.weapons.length) }, (_, i) => {
    const w = run.weapons[i];
    if (!w) return `<div class="wslot">${emptySlot()}<span>empty</span></div>`;
    const n = weaponNums(w, run, m);
    if (i !== sealedAt) {
      total += n.dps;
      totalHi += n.dpsHi;
    }
    return `<div class="wslot">${weaponTile(ui, run, i, { a: 'campsel', sel: sel === i, dim: i === sealedAt })}<span class="${i === sealedAt ? 'bad' : ''}">${i === sealedAt ? 'sealed' : `${dpsText(n)}/s`}</span></div>`;
  }).join('');
  const merges = mergePairs(run).map((i) => {
    const w = run.weapons[i];
    const j = R.mergeTarget(run, w.fam, w.tier, i);
    const mp = mergePreview(run, m, i, j);
    return `<div class="callout${free ? ' quiet' : ''}"><span><b>Two ${R.weaponName(w)} can merge.</b> ${mp.text}${free ? ' With slots free, two weapons hit more often than one.' : ''}${mp.lines ? ` The merge also moves:<span style="display:block;margin-top:3px">${inlineFx(mp.lines)}</span>` : ''}</span>
      <button class="sm" data-a="merge" data-v="${i}">${icon('merge')} Merge into ${famName(w.fam)} ${roman(w.tier + 1)}</button></div>`;
  }).join('');
  const sale = st.sale && st.sale.key === campKey(run) ? st.sale : null;
  const undo = sale ? `<div class="callout quiet"><span>Sold ${R.weaponName(sale.w)} for ${sale.price} scrap.</span><button class="sm" data-a="unsell">Undo</button></div>` : '';

  const sets = Object.entries(R.famCounts(run)).map(([f, n]) => {
    const [c1, b1, c2, b2] = WEAPONS[f as Fam].set;
    const goal = n >= c1 ? c2 : c1;
    const held = n >= c2 ? modText([...b1, ...b2]) : n >= c1 ? modText(b1) : '';
    const next = n >= c2 ? '' : `at ${goal}: ${modText(n >= c1 ? b2 : b1)}`;
    return `<div class="setrow" ${tip(`${famName(f as Fam)} set. At ${c1} tier points: ${modText(b1)}. At ${c2}: ${modText(b2)}. A weapon counts its tier, so a tier III counts three.`)}>${ic(I.famIcon(f as Fam))}<div class="grow"><b>${famName(f as Fam)} set</b> <span class="num gold">${n}</span><span class="dim">/${goal}</span>
      <span class="small">${held ? `<span class="ok">${icon('check')} ${held}</span>` : ''}${held && next ? ' · ' : ''}${next ? `<span class="dim">${next}</span>` : ''}</span></div></div>`;
  }).join('');

  const slow = slowOf(run, m);
  const speed = Math.max(0.3, 1 + m.speed) * (1 - slow) - 1;
  const block = 1 - 10 / (10 + Math.max(0, m.armor));
  const ballast = ballastBonus(run, m);
  const hot = heatBonus(run, m);
  const holds = !!R.kitOf(run).heatHolds;
  const dmgSub = [hot > 0 ? `+${Math.round(hot * 100)}% from heat carried in` : '', ballast > 0 ? `+${Math.round(ballast * 100)}% from bag weight` : ''].filter(Boolean).join(', ') || 'all weapons';
  const cell = (label: string, value: string, sub: string, text: string, cls = '') => `<div class="kstat" ${tip(text)}><small>${label}</small><b class="num ${cls}">${value}</b><span>${sub}</span></div>`;
  const stats = [
    cell('Damage', STAT.dmg[1](dmgFactor(run, m) - 1), dmgSub,
      `Damage of every weapon, the heavy swing and abilities, against the plain weapon, as the next wave starts.${hot > 0 ? ` Includes +${Math.round(hot * 100)}% from the ${Math.round(run.heat)} heat carried in; it changes as heat does${holds ? ', and with the Firebrand kit heat does not cool during a wave, so it holds or rises' : ': it falls as heat cools and rises as you strike nodes'}.` : m.furnace > 0 ? ' No heat is carried in; heat adds more during a wave.' : ''}${ballast > 0 ? ` Includes +${Math.round(ballast * 100)}% from the ${R.bagWeight(run, m).toFixed(0)} weight in the bag; it grows as you gather and is gone when the bag is emptied.` : ''}`),
    cell('Attack speed', STAT.atk[1](Math.max(0.2, 1 + m.atk) - 1), 'weapons fire', 'How much faster your weapons fire.'),
    cell('Double hits', STAT.crit[1](capped('crit', m.crit)), 'chance', 'The chance that a hit lands twice.'),
    cell('Range', STAT.range[1](m.range), 'weapons reach', 'How much further your weapons reach.'),
    cell('Move speed', STAT.speed[1](speed), slow > 0 ? `bag −${Math.round(slow * 100)}%` : 'on foot', slow > 0 ? `Your build gives ${STAT.speed[1](m.speed)}; the bag takes ${Math.round(slow * 100)}%.` : 'How fast you move. A bag over its comfort slows you.', slow > 0 ? 'warn' : ''),
    cell('Armour', STAT.armor[1](m.armor), `hits −${Math.round(block * 100)}%`, 'Armour blunts every hit: 3 by about a quarter, 10 by half.'),
  ].join('');
  const shown = ['dmg', 'dmgMul', 'atk', 'speed', 'hp', 'armor', 'crit', 'range', 'yield'];
  const other = (Object.keys(STAT) as (keyof Mods)[]).filter((k) => !shown.includes(k) && Math.abs(m[k]) > 1e-6)
    .map((k) => chip(((text) => text + (CAPS[k] !== undefined && m[k] > CAPS[k]! + 1e-9 ? (text.includes('at most') ? ': more does nothing' : ' (capped: more does nothing)') : ''))(k === 'drops' && m[k] <= -1 ? 'Kills leave no creature materials (named parts still drop)' : cap(modText([[k, capped(k, m[k])]])))
      + (k === 'ballast' ? `: +${Math.round(ballast * 100)}% now` : k === 'furnace' ? `: +${Math.round(hot * 100)}% as the wave starts` : k === 'heatCool' && holds ? ` (${NO_COOL})` : ''), I.modIcon(k))).join('');
  // what a strike will really be multiplied by: the build, the danger of the key and the trade skill for the ground (run.ts waveSpec)
  const node = GROUNDS[run.route.ground].node;
  const yKey = CFG.key.yield * (run.keyLevel - 1);
  const ySkill = routeChosen(run) ? run.yieldBonus[node] ?? 0 : 0;
  const SKILL: Record<NodeKind, string> = { ore: 'mining', wood: 'logging', herb: 'harvesting' };
  const yParts = [Math.abs(m.yield) > 1e-6 ? `build ${STAT.yield[1](m.yield)}` : '', yKey > 0 ? `danger ${run.keyLevel} ${STAT.yield[1](yKey)}` : '', ySkill > 0 ? `${SKILL[node]} skill ${STAT.yield[1](ySkill)}` : ''].filter(Boolean);
  const anySkill = Object.values(run.yieldBonus).some((v) => v > 0);
  const yieldChip = yParts.length || anySkill
    ? `<span ${tip(`What every strike on a node is multiplied by in the next wave${yParts.length ? `: ${yParts.join(', ')}` : ''}.${routeChosen(run) ? '' : anySkill ? ' Your trade skill adds more, by the ground you choose.' : ''} Heat adds up to +${Math.round(CFG.heat.yieldBonus * 100)}% on top of a strike.`)}>${chip(`Node yield${routeChosen(run) ? ` on the ${GROUNDS[run.route.ground].name.toLowerCase()}` : ''}: ${STAT.yield[1](m.yield + yKey + ySkill)}${routeChosen(run) || !anySkill ? '' : ', more with your trade skill'}`, I.modIcon('yield'))}</span>` : '';

  const items = Object.entries(count(run.items)).map(([id, n]) => tile(describe(`item:${id}`, ui.ctx), { size: 'sm', qty: n > 1 ? `×${n}` : undefined, noTier: true })).join('');
  const picks = Object.entries(count(run.picks)).map(([id, n]) => tile(describe(`pick:${id}`, ui.ctx), { size: 'sm', qty: n > 1 ? `×${n}` : undefined })).join('');
  const wilds = run.wilds.map((id) => {
    const x = WILDS.find((q) => q.id === id)!;
    return `<div class="small" style="padding:2px 0"><b>${x.name}.</b> <span class="dim">${x.text}</span></div>`;
  }).join('');
  const brewChip = (label: string, b: Brew) => `<span ${tip(`${cap(brewName(b))}: ${modText(brewMods(b))}. Lasts ${FORM[b.form].lasts}.`)}>${chip(`${label}: ${modText(brewMods(b))}`, I.brewIcon(b.form))}</span>`;
  const effects = [
    ...(run.flaskActive ? [brewChip('Flask, next wave', run.flaskActive)] : []),
    ...(run.campMods.length ? [chip(`Camp craft, next wave: ${modText(run.campMods)}`, I.uiIcon('craft'), 'gold')] : []),
    ...(run.oil ? [brewChip('Oil', run.oil)] : []),
    ...run.charms.map((c) => brewChip('Charm', c)),
    ...(curse ? [`<span class="chip bad">${icon('skull')}${run.curse ? 'Cursed' : 'Shrine curse'} (${CURSES[curse].name}): ${CURSES[curse].text}, until the next boss wave is over</span>`] : []),
    ...(run.feat.heat && run.heat >= 1 ? [`<span ${tip(`Half of the heat you ended the last wave with comes with you. Heat brings more enemies and raises what a strike yields; ${holds ? 'with the Firebrand kit it does not cool during a wave' : 'it cools while you leave nodes alone'}.`)}>${chip(`Heat carried in: ${Math.round(run.heat)} of 100`, I.uiIcon('heat'), 'warn')}</span>`] : []),
  ].join('');
  const evo = boss && run.feat.gates && run.wave < R.runWaves(run) - 1
    ? `<h4>Evolve at the next gate</h4><div class="evoreq">${evolveChecklist(run).html}<p class="dim small" style="margin:2px 0 0">Kill the boss for its chest: there a ready weapon and one part become a weapon that deals twice the damage.</p></div>` : '';

  return `<div class="panel build"><h2>Your build</h2>
    <h4 style="margin-top:0">Weapons ${run.weapons.length}/${slots} <span class="hint">· ${span(total, totalHi)} damage per second in all · select one for its numbers</span></h4>
    <div class="wslots" style="--n:${Math.max(4, slots, run.weapons.length)}">${cells}</div>
    ${merges}${undo}${sel >= 0 ? weaponDetail(ui, run, m, sel) : ''}
    <div class="sets">${sets}</div>
    ${healthBar(run, m)}<ul class="heals">${healWays(run, m).map((x) => `<li>${x}</li>`).join('')}</ul>
    <h4>Stats</h4><div class="kstats">${stats}</div>
    ${other || yieldChip ? `<div class="chips">${other}${yieldChip}</div>` : ''}
    ${effects ? `<h4>In effect</h4><div class="chips">${effects}</div>` : ''}
    <h4>Items <span class="hint">· ${run.items.length ? `${run.items.length} held, no limit` : 'none yet; they last the whole expedition'}</span></h4>${items ? `<div class="tiles">${items}</div>` : ''}
    ${picks ? `<h4>Level picks</h4><div class="tiles">${picks}</div>` : ''}
    ${wilds ? `<h4>Wild picks</h4>${wilds}` : ''}${evo}</div>`;
}

// ------------------------------------------------------------------- shop
/** The run as it would be after buying an offer (gear score aside: that is rolled on purchase). */
function afterBuy(run: R.RunState, o: R.Offer): R.RunState {
  if (o.kind === 'item') return ITEMS[o.item!].heal ? run : { ...run, items: [...run.items, o.item!] };
  const fresh = { fam: o.fam!, tier: o.tier, gs: 0.5, variant: false, evolved: false, dmg: 0, kills: 0 };
  if (run.weapons.length < R.effSlots(run)) return { ...run, weapons: [...run.weapons, fresh] };
  const j = R.mergeTarget(run, o.fam!, o.tier);
  return j < 0 ? run : { ...run, weapons: run.weapons.map((w, i) => (i === j ? { ...w, tier: w.tier + 1 } : w)) };
}

function offerCard(ui: UI, run: R.RunState, m: Mods, o: R.Offer, i: number): string {
  const d = describe(o.kind === 'weapon' ? `wpn:${o.fam}:${o.tier}` : `item:${o.item}`, ui.ctx);
  const why = R.canBuy(run, o);
  const after = afterBuy(run, o);
  const lines: string[] = [];
  let warn = '';
  if (o.kind === 'weapon') {
    const fam = o.fam!;
    const slots = R.effSlots(run);
    const free = run.weapons.length < slots;
    const j = R.mergeTarget(run, fam, o.tier);
    const offered = { fam, tier: o.tier, gs: 0.5, evolved: false };
    // the numbers are those of the run after the purchase: a set bonus it completes and the Seventh hand's toll are in them
    const am = R.runMods(after);
    lines.push(weaponFields(weaponNums(offered, after, am), true));
    const mine = run.weapons.map((w, k) => ({ w, k, n: weaponNums(w, run, m) })).filter((x) => x.w.fam === fam).sort((a, b) => b.n.dps - a.n.dps)[0];
    if (mine) lines.push(fx(`<span class="dim">Your ${R.weaponName(mine.w)} (slot ${mine.k + 1}): ${mine.n.shots > 1 ? `${mine.n.shots} × ` : ''}${mine.n.hit.toFixed(0)} damage, ${dpsText(mine.n)} per second</span>`));
    if (free) {
      lines.push(fx(`Fills slot <b>${run.weapons.length + 1}/${slots}</b>`, 'ok'));
      if (j >= 0) lines.push(fx(`Pairs with your ${R.weaponName(run.weapons[j])}: you can then merge to <b>${famName(fam)} ${roman(o.tier + 1)}</b>`, 'ok'));
    } else if (j >= 0) {
      // not a merge of two carried weapons: nothing is given up, no slot comes free, and the set gains a point
      const now = weaponNums(run.weapons[j], run, m);
      const lo = weaponNums({ ...after.weapons[j], gs: 0 }, after, am);
      const hi = weaponNums({ ...after.weapons[j], gs: 1 }, after, am);
      lines.push(fx(`All slots are full: it merges at once into your ${R.weaponName(run.weapons[j])} (slot ${j + 1}, ${dpsText(now)} per second), which becomes <b>${famName(fam)} ${roman(o.tier + 1)}</b> (${span(lo.dps, hi.dpsHi)} per second). Slots stay full.`, 'ok'));
    }
    const n0 = R.famCounts(run)[fam] ?? 0;
    const n1 = R.famCounts(after)[fam] ?? 0;
    const [c1, b1, c2, b2] = WEAPONS[fam].set;
    if (n1 !== n0) {
      const goal = (n: number) => (n >= c1 ? c2 : c1);
      const hit = [n0 < c1 && n1 >= c1 ? modText(b1) : '', n0 < c2 && n1 >= c2 ? modText(b2) : ''].filter(Boolean).join('; ');
      const g0 = goal(n0);
      lines.push(fx(`${famName(fam)} set ${n0}/${g0} → <b>${n1}/${n1 > g0 ? goal(n1) : g0}</b>${hit ? `: ${hit}` : ''}`, hit ? 'ok' : ''));
    }
    lines.push(changeLines(run, after));
  } else {
    const it = ITEMS[o.item!];
    if (it.heal) {
      const max = maxHpNext(run, m); // a Frail shrine chosen at this camp cuts it when you leave
      const hp = Math.min(Math.round(run.hp), max);
      const frail = frailAhead(run);
      lines.push(fx(`<span class="dim">Health</span> ${hp} → <b class="ok">${Math.min(max, hp + it.heal)}</b> of ${max}, ${frail ? 'as the wave starts' : 'at once'}`));
      if (hp >= max && !o.sold) warn = frail ? `With the Frail shrine chosen the wave starts with ${max} health at most: it would be wasted.` : 'You are at full health: it would be wasted.';
      else if (frail && hp + it.heal > max && !o.sold) warn = `Frail shrine chosen: only ${max - hp} of its ${it.heal} lasts into the wave.`;
    } else lines.push(changeLines(run, after) || fx(cap(modText(it.mods))));
  }
  const reason = o.sold ? '' : why === 'not enough scrap' ? `${o.price - run.scrap} scrap short`
    : why === 'no free slot' ? 'No free slot: sell or merge a weapon first, or buy one that matches a carried weapon of the same tier'
    : why === 'no healing right now' ? 'No healing right now: a pick or an active effect forbids it' : why ? cap(why) : '';
  const cls = `offer shopcard${o.sold ? ' sold' : ''}${why && !o.sold ? ' cant' : ''}${o.locked ? ' locked' : ''}`;
  return `<div class="${cls}">
    <div class="oh">${tile(d, { size: 'sm' })}<div class="grow"><div class="nm r${d.rarity}">${d.name}</div><div class="sub dim">${o.kind === 'weapon' ? 'Weapon' : 'Item'} · tier ${roman(o.tier)}${o.locked ? ` · <span class="gold">${icon('lock')} locked</span>` : ''}</div></div>${o.sold ? '' : `<span class="kc">${i + 1}</span>`}</div>
    <div class="fxs">${o.sold ? '' : lines.join('')}</div>
    ${o.sold ? '<div class="stamp">Sold</div>' : `${reason ? `<div class="owhy bad small">${reason}</div>` : warn ? `<div class="owhy warn small">${warn}</div>` : ''}
    <div class="obtn"><button class="buy" data-a="buy" data-v="${i}" data-key="${i + 1}" aria-label="Buy ${d.name} for ${o.price} scrap" ${why ? 'disabled' : ''}>Buy <span class="price">${icon('scrap')}<b class="num">${o.price}</b><span class="unit"> scrap</span></span></button>
      <button class="sm ghost lockb${o.locked ? ' on' : ''}" data-a="lock" data-v="${i}" aria-pressed="${o.locked}" aria-label="${o.locked ? 'Unlock this offer' : 'Lock this offer'}" ${tip('A locked offer stays through rerolls and to the next camp, at that camp\'s price.')}>${icon(o.locked ? 'lock' : 'unlock')}<span>${o.locked ? 'Locked' : 'Lock'}</span></button></div>`}</div>`;
}

function shopPanel(ui: UI, run: R.RunState, m: Mods): string {
  const cost = R.rerollCost(run);
  const next = R.rerollCost({ ...run, rerolls: run.rerolls + 1 });
  const short = run.scrap < cost;
  return `<div class="panel shop"><h2>Shop <span class="have">${icon('scrap')}<b class="num">${run.scrap}</b> scrap to spend</span></h2>
    <div class="shopgrid">${run.shop.map((o, i) => offerCard(ui, run, m, o, i)).join('')}</div>
    <div class="row shopfoot"><button data-a="reroll" data-key="r" ${short ? 'disabled' : ''}>${icon('reroll')} Reroll · ${cost ? `${cost} scrap` : 'free'} <span class="dim small">(next ${next})</span> <span class="kc">R</span></button>
      <span class="dim small grow">${short ? `<span class="bad">The reroll costs ${cost} scrap; you have ${run.scrap}.</span> ` : ''}Reroll replaces the offers that are not locked. <b>Lock</b> keeps an offer through rerolls and to the next camp. Buy as many as you can pay for.</span></div></div>`;
}

// ------------------------------------------------------------- camp craft
const CAT_WORD: Record<string, string> = { ore: 'ore', wood: 'wood', herb: 'herbs', creature: 'creature parts' };
/** What a craft would take from the bag: the lowest tier first, as the rules do. */
function craftTakes(run: R.RunState, id: string): { have: number; text: string } {
  const cat = RECIPES[id].cost!.cat;
  const ids = Object.keys(run.bagMats).filter((x) => run.bagMats[x] > 0 && MATS[x].cat !== 'part' && (x === cat || MATS[x].cat === cat)).sort((a, b) => MATS[a].tier - MATS[b].tier);
  let need = R.craftCost(run, id);
  const parts: string[] = [];
  for (const x of ids) {
    const take = Math.min(need, run.bagMats[x]);
    if (take > 0) parts.push(`${take} ${MATS[x].name.toLowerCase()}`);
    need -= take;
    if (need <= 0) break;
  }
  return { have: ids.reduce((a, x) => a + run.bagMats[x], 0), text: parts.join(' and ') };
}
function craftPanel(ui: UI, run: R.RunState, m: Mods): string {
  const perCamp = R.kitOf(run).crafts ?? 1;
  const barren = run.curse === 'barren';
  const left = run.craftsLeft;
  const ids = run.recipes.filter((id) => RECIPES[id] && RECIPES[id].kind !== 'evolution');
  const made = run.memo?.wave === run.wave ? run.memo.crafted : [];
  const active = run.campMods.length ? `<p class="note" style="margin-bottom:8px">${icon('craft')} In effect next wave: <b>${modText(run.campMods)}</b>.</p>` : '';
  let body: string;
  if (barren) body = `<p class="bad small">Cursed (Barren): no camp craft until the next boss wave is over.</p>`;
  else if (left <= 0) {
    body = `<p class="small"><b>${made.length ? `Crafted at this camp: ${made.join(', ')}.` : 'This camp\'s craft is used.'}</b> <span class="dim">${ids.length ? `${ids.map((id) => RECIPES[id].name).join(', ')}: again at the next camp.` : ''}</span></p>`;
  } else {
    const rows = ids.map((id) => {
      const r = RECIPES[id];
      const why = R.canCraft(run, id);
      const need = R.craftCost(run, id);
      const cat = r.cost!.cat;
      const takes = craftTakes(run, id);
      const what = cat in MATS ? MATS[cat].name.toLowerCase() : CAT_WORD[cat] ?? cat;
      let effect = '';
      if (r.heal) {
        const max = maxHpNext(run, m);
        const hp = Math.min(Math.round(run.hp), max);
        const frail = frailAhead(run);
        effect = fx(`<span class="dim">Health</span> ${hp} → <b class="ok">${Math.min(max, hp + r.heal)}</b> of ${max}, ${frail ? 'as the wave starts' : 'at once'}`)
          + (frail && hp + r.heal > max ? `<div class="warn small">Frail shrine chosen: ${hp >= max ? 'it would be wasted' : `only ${max - hp} of its ${r.heal} lasts into the wave`}.</div>` : '');
      } else if (r.mods) effect = changeLines(run, { ...run, campMods: [...run.campMods, ...r.mods] }) + fx('<span class="dim">for the next wave only</span>');
      else if (r.kind === 'variant') effect = fx(`Turns one plain ${famName(r.fam!).toLowerCase()} into the ${r.name}, for the rest of the expedition`);
      const other = why && !why.startsWith('needs ') ? cap(why) : '';
      return `<div class="item craftrow${why ? ' no' : ''}">${tile(describe(`recipe:${id}`, ui.ctx), { size: 'sm' })}
        <div class="grow"><div class="nm">${r.name}</div><div class="sub">${r.text}${need !== r.cost!.n ? ` Your kit pays ${need}.` : ''}</div>${effect}
          ${req(takes.have >= need, takes.have >= need ? `Takes ${takes.text}` : `Needs ${need} ${what}; the bag holds ${takes.have}`)}${other ? `<div class="bad small">${other}${r.kind === 'variant' && why!.startsWith('needs a plain') ? ': buy one in the shop first' : ''}</div>` : ''}</div>
        <div class="act"><button class="sm" data-a="craft" data-v="${id}" ${why ? 'disabled' : ''}>Craft</button></div></div>`;
    }).join('');
    body = `<p class="small" style="margin-bottom:6px"><b>Choose ${perCamp === 1 ? 'one craft' : `${perCamp} crafts`} for this camp${perCamp > 1 ? `: ${left} left` : ''}.</b> <span class="dim">It uses materials from the bag, lowest tier first; what you use does not come home.</span></p>
      ${rows || '<p class="dim small">No camp recipes in the loadout. Recipes are packed in town, before the expedition.</p>'}`;
  }
  const evo = run.recipes.filter((id) => RECIPES[id]?.kind === 'evolution').map((id) => RECIPES[id].name);
  return `<div class="panel craft"><h2>Camp craft <span class="have">${barren ? 'cursed' : `${pips(left, perCamp)} ${perCamp === 1 ? 'one per camp' : `${perCamp} per camp`}`}</span></h2>
    ${active}${body}
    ${evo.length ? `<p class="dim small" style="margin-top:8px">Evolution recipes carried: ${evo.join(', ')}. They are used at a boss chest.</p>` : ''}</div>`;
}
/** Flasks are their own panel: a flask can be packed before the camp craft is open. */
function flaskPanel(ui: UI, run: R.RunState): string {
  if (!run.flasks.length && !run.flaskActive) return '';
  const rows = run.flasks.map((b, i) => `<div class="item craftrow">${tile({ ...describe(`brew:${brewKey(b)}`, ui.ctx), qty: undefined }, { size: 'sm' })}
      <div class="grow"><div class="nm">${cap(brewName(b))}</div>${run.flaskActive ? fx(cap(modText(brewMods(b)))) : changeLines(run, { ...run, flaskActive: b })}<div class="sub">${run.flaskActive ? 'one flask a wave: this one waits for the next camp' : 'for the next wave only'}</div></div>
      <div class="act"><button class="sm" data-a="drink" data-v="${i}" ${run.flaskActive ? 'disabled' : ''}>Drink</button></div></div>`).join('');
  return `<div class="panel flasks"><h2>Flasks <span class="have">one per wave</span></h2>
    ${run.flaskActive ? `<p class="note" style="margin-bottom:8px">${icon('check')} Drunk for the next wave: <b>${cap(brewName(run.flaskActive))}</b> (${modText(brewMods(run.flaskActive))}).${run.flasks.length ? ' The others wait for the next camp.' : ''}</p>` : '<p class="dim small">Drink one now and it lasts the next wave. A drunk flask is used up.</p>'}${rows}</div>`;
}

// ----------------------------------------------------------------- routes
/** A route in a few words, for the footer and the Start button. */
function routeWords(run: R.RunState, r: R.Route, boss: boolean): string {
  if (boss) return `boss: ${BOSSES[R.segmentOf(run.wave)].name}`;
  if (r.shrine) return `shrine, ${CURSES[r.shrine.curse].name.toLowerCase()} curse`;
  if (r.objective === 'elite') return `named elite: ${ELITES.find((e) => e.id === r.elite)?.name ?? ''}`;
  return r.objective === 'none' ? 'survive' : OBJECTIVES[r.objective].name.toLowerCase();
}
function routeCard(ui: UI, run: R.RunState, m: Mods, r: R.Route, i: number, boss: boolean, chosen: boolean): string {
  const g = GROUNDS[r.ground];
  const seg = R.segmentOf(run.wave);
  const matId = NODE_MAT[g.node][seg];
  const on = chosen && run.routePick === i;
  const tool = run.toolNode === g.node ? TOOLS[g.node] : null;
  const elite = r.elite ? ELITES.find((e) => e.id === r.elite) : null;
  const pay = `${Math.round(25 * Math.max(0, 1 + m.scrap))} scrap${m.noHeal > 0 ? '' : ' and 15 health'}`;
  const row = (label: string, html: string, cls = '') => `<div class="rrow ${cls}"><small>${label}</small><div>${html}</div></div>`;
  const prize = (t: string, text: string) => `<div class="prize">${t}<span class="small">${text}</span></div>`;
  let objective: string;
  let reward: string;
  let risk: string;
  if (boss) {
    objective = `<b>Boss: ${BOSSES[seg].name}</b><div class="dim small">Its armour breaks only to the heavy swing.</div>`;
    reward = `<span class="small">A chest if it dies: 40 scrap${run.feat.schem ? ', one of its schematics' : ''}, and a boss part.</span>`;
    risk = '<span class="small warn">It summons, and the wave is the longest of the four.</span>';
  } else if (r.shrine) {
    objective = `<b>Shrine</b><div class="dim small">Clear the wave on cursed ground.</div>`;
    reward = prize(stile(describe(`schem:${r.shrine.prize}`, ui.ctx), { size: 'sm' }), `<b>${SCHEMATICS[r.shrine.prize].name}</b>`);
    risk = `<span class="small bad">A third more enemies this wave. Until the next boss wave is over: ${CURSES[r.shrine.curse].text}.</span>`;
  } else if (r.objective === 'none') {
    objective = '<b>Survive</b><div class="dim small">Nothing else is asked.</div>';
    reward = '<span class="small dim">None beyond the wave.</span>';
    risk = '<span class="small dim">None added.</span>';
  } else if (elite) {
    objective = `<b>Named elite: ${elite.name}</b><div class="dim small">It arrives in the swell.</div>`;
    reward = prize(stile(describe(`mat:${elite.part}`, ui.ctx), { size: 'sm' }), `<b>${MATS[elite.part].name}</b><br><span class="dim">a part needed to evolve a weapon${run.feat.schem ? '; it may carry a schematic' : ''}</span>`);
    risk = '<span class="small warn">One strong enemy joins the wave.</span>';
  } else {
    objective = `<b>${OBJECTIVES[r.objective].name}</b><div class="dim small">${r.objective === 'supply' ? 'Stand in the marked circle for 10 seconds.' : 'Break three nests with the heavy swing before the peak.'}</div>`;
    reward = `<span class="small"><b>${pay}</b> when done.</span>`;
    risk = r.objective === 'nests' ? '<span class="small warn">Each nest left at the peak hatches a brute.</span>' : '<span class="small dim">You must hold still in the open.</span>';
  }
  return `<button type="button" class="rcard${on ? ' on' : ''}" data-a="route" data-v="${i}" aria-pressed="${on}">
    <div class="rhead">${ic(I.groundIcon(r.ground))}<b>${g.name}</b><span class="grow"></span>${on ? `<span class="chosen">${icon('check')} Chosen</span>` : `<span class="kc">${i + 5}</span>`}</div>
    ${row('Gives', prize(stile(describe(`mat:${matId}`, ui.ctx), { size: 'sm', round: true }), `<b>${MATS[matId].name}</b><br><span class="dim">${MATS[matId].weight} weight each</span>`))}
    ${row('Enemies', `<span class="dim small">${g.text.split('. ').slice(1).join('. ')}</span>`)}
    ${row('Objective', objective)}${row('Reward', reward)}${row('Risk', risk)}
    ${tool || run.burden === g.node ? row('Your gear', `<span class="small ok">${[tool ? `${tool.name}: fewer swings here` : '', run.burden === g.node ? `bag lightens ${CAT_WORD[g.node]} 40%` : ''].filter(Boolean).join(' · ')}</span>`, 'gear') : ''}
  </button>`;
}
function routesPanel(ui: UI, run: R.RunState, m: Mods, boss: boolean, chosen: boolean): string {
  if (!run.feat.routes) {
    const g = GROUNDS[run.route.ground];
    const matId = NODE_MAT[g.node][R.segmentOf(run.wave)];
    return `<div class="panel routesp"><h2>Next ground</h2><div class="row">${tile(describe(`mat:${matId}`, ui.ctx), { size: 'sm', round: true })}<div class="grow"><b>${g.name}</b> <span class="dim">gives ${MATS[matId].name.toLowerCase()}</span><div class="dim small">${g.text.split('. ').slice(1).join('. ')}</div></div></div>
      ${boss ? `<p class="small" style="margin:8px 0 0"><b>${BOSSES[R.segmentOf(run.wave)].name}</b> <span class="dim">waits there. Its armour breaks only to the heavy swing.</span></p>` : ''}</div>`;
  }
  return `<div class="panel routesp${chosen ? '' : ' need'}"><h2>${boss ? 'Where to meet the boss' : 'Next ground'} <span class="have">${chosen ? 'chosen' : 'choose one'}</span></h2>
    <div class="routes">${run.routeOptions.map((r, i) => routeCard(ui, run, m, r, i, boss, chosen)).join('')}</div></div>`;
}
/** The three grounds as buttons in the footer, beside the Start button they feed. */
function routeStrip(run: R.RunState, boss: boolean, chosen: boolean): string {
  if (!run.feat.routes || run.routeOptions.length < 2) return '';
  return `<div class="rstrip${chosen ? '' : ' need'}" role="group" aria-label="Next ground">${run.routeOptions.map((r, i) => {
    const on = chosen && run.routePick === i;
    const words = boss ? MATS[NODE_MAT[GROUNDS[r.ground].node][R.segmentOf(run.wave)]].name : cap(routeWords(run, r, boss));
    return `<button type="button" class="rpick${on ? ' on' : ''}${r.shrine ? ' shrine' : ''}" data-a="route" data-v="${i}" data-key="${i + 5}" aria-pressed="${on}">${ic(I.groundIcon(r.ground))}<span><b>${GROUNDS[r.ground].name}</b><small>${words}</small></span><span class="kc">${i + 5}</span></button>`;
  }).join('')}</div>`;
}

// ------------------------------------------------------------------- page
export function campView(ui: UI): Page {
  const run = ui.run!;
  const m = R.runMods(run);
  const next = run.wave;
  const boss = R.isBossWave(next);
  const total = R.runWaves(run);
  const seg = R.segmentOf(next);
  const gateWave = (seg + 1) * 4;
  const chosen = routeChosen(run);
  const risk = run.race ? 'Weekly race: nothing is banked and nothing is lost.'
    : !run.feat.loss ? `${icon('check')} Nothing is lost on this expedition: all of it comes home, even if you fall.`
    : `${icon('warn')} <b>If you fall, ${Math.round(keepShare(ui) * 100)}% of each stack comes home</b> and the rest is lost. Extraction is at the boss gates: the next is after wave ${gateWave}.`;
  const r = run.route;
  const buyable = run.shop.some((o) => !R.canBuy(run, o));
  const craft = run.feat.craft ? craftPanel(ui, run, m) : '';
  const body = `${expeditionStrip(ui, run)}<div class="camp">
      <div class="side">${buildPanel(ui, run, m, boss)}</div>
      <div class="rest${craft ? '' : ' nocraft'}">
        <div class="main">${shopPanel(ui, run, m)}${craft}${flaskPanel(ui, run)}</div>
        <div class="aside">${routesPanel(ui, run, m, boss, chosen)}${bagPanel(ui, run, risk)}</div>
      </div>
    </div>`;
  const where = chosen ? `${GROUNDS[r.ground].name}${run.feat.routes || boss ? ` · ${routeWords(run, r, boss)}` : ''}` : 'Choose the next ground first';
  const foot = `<button class="sm ghost helpb" data-a="runmenu" aria-label="Menu: controls, leave, abandon">${icon('settings')}<span>Menu</span></button>
    ${routeStrip(run, boss, chosen)}
    <span class="footnote opt">${buyable ? `<span class="gold">${run.scrap} scrap unspent</span>` : ''}</span>
    <button class="choice pri gob" data-a="go" data-key="Enter" ${chosen ? '' : 'disabled'}><b>Start wave ${next + 1}<span class="dim"> of ${total}</span> <span class="kc">Enter</span></b><small>${where}</small></button>`;
  return { title: 'Camp', cur: cur(ui, run), body, foot };
}
