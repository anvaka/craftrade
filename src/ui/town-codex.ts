// The Codex tab: every schematic by where it drops, what is learned, fragments, and the codex rank.
import { CODEX_RANKS, PATTERNS, SCHEMATICS, SOURCE_NAME, STATIONS, type Schematic, type SchemSource, type StationId } from '../data';
import * as M from '../meta';
import type { Page, Tab, UI } from './app';
import { bar, note, pips, tile, ui as uiIcon } from './kit';
import { describe, roman, schemSource, type Desc } from './things';

const STATION_TAB: Record<StationId, Tab> = { forge: 'Forge', workshop: 'Workshop', apothecary: 'Apothecary' };
const FRAGS = 4; // fragments that trade for one schematic (see meta.redeem)
const bare = (s: Schematic) => s.name.replace(/^[A-Za-z]+: /, '');

/** The station where a pattern is made or a blueprint is spent. */
function stationOf(s: Schematic): StationId | null {
  if (s.kind === 'pattern') return PATTERNS[s.ref]?.station ?? null;
  if (s.kind === 'blueprint') return s.ref.split('-')[0] as StationId;
  return null;
}
/** What each codex rank gives. Rank 2 is the only one with an effect of its own; every rank is 3 mastery points. */
function rankGives(rank: number): string {
  return `${rank === 2 ? 'Choose a second perk when you forge a weapon. ' : ''}+3 mastery points.`;
}

function rankPanel(p: M.Profile): string {
  const rank = M.codexRank(p);
  const n = p.codex.length;
  const total = Object.keys(SCHEMATICS).length;
  const next = CODEX_RANKS[rank];
  const prev = rank > 0 ? CODEX_RANKS[rank - 1] : 0;
  const ms = CODEX_RANKS.map((need, i) => {
    const r = i + 1;
    const cls = r <= rank ? 'done' : r === rank + 1 ? 'next' : 'locked';
    return `<div class="ms ${cls}"><div class="lv">Rank ${r} ${r <= rank ? uiIcon('check') : ''}</div><div class="small dim">${need} schematics${r === rank + 1 ? ` · ${need - n} to go` : ''}</div><div class="small">${rankGives(r)}</div></div>`;
  }).join('');
  return `<section class="panel"><h2>Codex rank</h2>
    <div class="row"><span class="bignum">${rank}</span><div class="grow"><div class="small"><b>${n}</b> of ${total} schematics in the codex${next ? ` · <b>${n}</b> of ${next} for rank ${rank + 1}` : ' · top rank'}</div>
      <div class="row" style="margin-top:4px">${bar(next ? (n - prev) / (next - prev) : 1, 'tall')}</div></div></div>
    <p class="dim small" style="margin:8px 0">A schematic enters the codex when you learn it (recipes) or use it once (patterns, blueprints). Mastery points add up to your mastery rank, which opens kits.</p>
    <div class="milestones wrap">${ms}</div></section>`;
}

/** A held pattern that was never made, or a blueprint for a tier not built yet: the copy has a job to do. */
function stillNeeded(p: M.Profile, s: Schematic): boolean {
  if (s.kind === 'pattern') return !p.codex.includes(s.id);
  const st = stationOf(s);
  return s.kind === 'blueprint' && !!st && p.stations[st] < Number(s.ref.split('-')[1]);
}

function card(ui: UI, s: Schematic): string {
  const p = ui.p;
  const held = p.schematics[s.id] ?? 0;
  const done = p.codex.includes(s.id);
  if (!done && held <= 0) {
    // not yet found: a dim tile and its kind, no name and no row of text
    const d: Desc = { ...describe(`schem:${s.id}`, ui.ctx), ref: `text:A ${s.kind} you have not found. ${schemSource(s.id)}.`, name: `A ${s.kind} not yet found`, rarity: 0, qty: undefined };
    return `<div class="sch unknown">${tile(d, { qty: '?' })}<div class="sk">${s.kind}</div></div>`;
  }
  const d = describe(`schem:${s.id}`, ui.ctx);
  const st = stationOf(s);
  const stName = st ? STATIONS[st].name.toLowerCase() : '';
  const needed = held > 0 && stillNeeded(p, s);
  const tier = Number(s.ref.split('-')[1]);
  const go = st ? `<button class="sm${needed ? ' learn' : ''}" data-a="goto" data-v="${STATION_TAB[st]}" data-w="${s.kind === 'pattern' ? `p:${s.id}` : 'up'}">Use at the ${stName}<small>${s.kind === 'pattern' ? 'to make it' : `to raise it to tier ${roman(tier)}`}</small></button>` : '';
  const brk = `<button class="sm ghost" data-a="break" data-v="${s.id}">Break<small>for 1 fragment</small></button>`;
  let state: string;
  let actions = '';
  if (s.kind === 'recipe') {
    if (!done) {
      state = `<span class="gold">Held${held > 1 ? ` ×${held}` : ''}: learning is free and for good</span>`;
      actions = `<button class="sm learn" data-a="learn" data-v="${s.id}">Learn</button>`;
    } else if (held > 0) {
      state = `<span class="ok">${uiIcon('check')} Learned</span> · ${held} spare`;
      actions = brk;
    } else state = `<span class="ok">${uiIcon('check')} Learned</span>`;
  } else if (held > 0 && s.kind === 'pattern') {
    state = `<span class="gold">Held ×${held}</span>: makes one, then it is gone${done ? '' : '. Not made yet'}${st && p.stations[st] < 2 ? `<br><span class="warn">Needs ${stName} tier II (yours is ${roman(p.stations[st])})</span>` : ''}`;
    actions = go + brk;
  } else if (held > 0) {
    // a station rises one tier at a time: a blueprint for a later tier waits, and its button would open the wrong upgrade
    const now = st ? p.stations[st] : tier;
    const next = needed && now + 1 === tier;
    state = next ? `<span class="gold">Held ×${held}</span>: needed to raise the ${stName} to tier ${roman(tier)}`
      : needed ? `<span class="gold">Held ×${held}</span>: kept for tier ${roman(tier)}. The ${stName} is tier ${roman(now)} now and must reach tier ${roman(tier - 1)} first`
      : `<span class="gold">Held ×${held}</span>: spare, the ${stName} is already tier ${roman(now)}`;
    actions = (next ? go : '') + brk;
  } else state = `<span class="ok">${uiIcon('check')} Used</span>${s.kind === 'pattern' ? ' · find another to make it again' : ''}`;
  return `<div class="sch${held > 0 && (!done || s.kind !== 'recipe') ? ' ready' : ''}">${tile(d, { qty: held > 1 ? `×${held}` : undefined, isNew: s.kind === 'recipe' && !done })}
    <div class="sk">${s.kind}</div><div class="sn">${bare(s)}</div><div class="ss small">${state}</div>${actions ? `<div class="sa">${actions}</div>` : ''}</div>`;
}

function sourcePanel(ui: UI, src: SchemSource): string {
  const p = ui.p;
  const list = Object.values(SCHEMATICS).filter((s) => s.source === src);
  const got = list.filter((s) => p.codex.includes(s.id)).length;
  const frags = p.fragments[src] ?? 0;
  const missing = list.some((s) => !p.codex.includes(s.id) && !(p.schematics[s.id] > 0));
  const trade = frags >= FRAGS
    ? `<button class="sm" data-a="redeem" data-v="${src}">${missing ? `Trade ${FRAGS} for a random missing schematic` : `Trade ${FRAGS} for a random schematic (none missing)`}</button>`
    : `<button class="sm" disabled>${FRAGS - frags} more to trade</button>`;
  return `<section class="panel"><h2>${SOURCE_NAME[src]} <span class="num cnt">${got} / ${list.length}</span></h2>
    <div class="srchead"><span class="small dim">${uiIcon('route')} ${schemSource(list[0].id)}</span>
      <span class="frag"><span class="small">Fragments</span> ${pips(Math.min(FRAGS, frags), FRAGS)} <b class="num">${frags}</b><span class="small dim">of ${FRAGS}</span> ${trade}</span></div>
    <div class="schems">${list.map((s) => card(ui, s)).join('')}</div></section>`;
}

export function view(ui: UI): Page {
  const p = ui.p;
  const feat = M.featFor(p);
  const body = `<div class="prog">${feat.schem ? '' : note('Schematics start to drop on the third expedition of the guided start. Until then this page is a list of what there is to find.')}
    <div class="stack">${rankPanel(p)}
    <section class="panel"><h2>How schematics work</h2>
      <p class="small" style="margin:0"><b>Recipes</b> are learned for good and then packed into the loadout. <b>Patterns</b> make one named item at the forge or workshop and are used up. <b>Blueprints</b> raise a station past tier II.
      A copy you do not need breaks into a <b>fragment</b>; ${FRAGS} fragments from one source trade for one schematic from that source, chosen at random among those you are missing.</p></section>
    ${(Object.keys(SOURCE_NAME) as SchemSource[]).map((src) => sourcePanel(ui, src)).join('')}</div></div>`;
  return { body };
}

export function act(ui: UI, a: string, v: string, _w: string): boolean | 'leave' | void {
  const p = ui.p;
  const snd = ui.hooks.sound;
  switch (a) {
    case 'learn': {
      const s = SCHEMATICS[v];
      if (!s) return true;
      const before = M.codexRank(p);
      if (ui.fail(M.learn(p, v))) return true;
      const rank = M.codexRank(p);
      const packed = p.loadout.recipes.includes(s.ref);
      const slots = `${p.loadout.recipes.length} of ${M.recipeSlots(p)}`;
      const where = packed ? `added to your notebook (${slots} recipes packed).` : `your notebook is full (${slots}): swap it in from the Inventory.`;
      if (rank > before) {
        ui.say(`Learned ${bare(s)}; ${where} <b>Codex rank ${rank}</b>: ${rankGives(rank)}`);
        snd.ui('level');
      } else {
        ui.say(`Learned ${bare(s)}; ${where}`);
        snd.ui('merge');
      }
      return true;
    }
    case 'break': {
      const s = SCHEMATICS[v];
      if (!s || !(p.schematics[v] > 0)) return ui.fail('You do not hold that schematic.') || true;
      if (s.kind === 'recipe' && !p.codex.includes(v)) return ui.fail('Learn it first: only a spare copy can be broken.') || true;
      const st = stationOf(s);
      const stName = st ? STATIONS[st].name.toLowerCase() : 'station';
      const only = p.schematics[v] === 1 && stillNeeded(p, s);
      const text = s.kind === 'recipe'
        ? `Break the spare copy of ${bare(s)} into one fragment (${SOURCE_NAME[s.source]})? The recipe stays learned.`
        : only
          ? `<b>This is your only copy of ${s.name}, and you have not used it.</b> ${s.kind === 'pattern' ? `It makes ${bare(s)} at the ${stName}.` : `The ${stName} cannot be raised to tier ${roman(Number(s.ref.split('-')[1]))} without it.`} Break it into one fragment (${SOURCE_NAME[s.source]}) anyway? Where another comes from: ${schemSource(s.id)}.`
          : `Break one copy of ${s.name} into one fragment (${SOURCE_NAME[s.source]})? You hold ${p.schematics[v]}.`;
      if (!ui.ask(text, only ? 'Break my only copy' : 'Break it', 'break', v)) return true;
      M.breakDown(p, v);
      const n = p.fragments[s.source] ?? 0;
      ui.say(`${bare(s)} broken. ${n >= FRAGS ? `You hold <b>${n}</b> fragments from ${SOURCE_NAME[s.source]}: enough to trade.` : `<b>${n}</b> of ${FRAGS} fragments from ${SOURCE_NAME[s.source]}.`}`);
      snd.ui('click');
      return true;
    }
    case 'redeem': {
      const id = M.redeem(p, v as SchemSource);
      if (!id) return ui.fail(`${FRAGS} fragments from this source are needed.`) || true;
      ui.say(`${FRAGS} fragments became <b>${SCHEMATICS[id].name}</b>.`);
      snd.ui('merge');
      return true;
    }
  }
  return false;
}
