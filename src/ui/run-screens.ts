// The screens of an expedition: the first launch, the tally after a wave, the camp, the boss gate, the pause and the summary.
// The views live in run-camp.ts, run-gate.ts and run-end.ts; this file routes to them and holds every action.
import { BOSSES, ITEMS, LEVEL_PICKS, MATS, RECIPES, WEAPONS, WILDS, brewMods, brewName } from '../data';
import * as M from '../meta';
import * as R from '../run';
import type { Page, UI } from './app';
import { roman } from './things';
import { campView } from './run-camp';
import { gateView, tallyView } from './run-gate';
import * as End from './run-end';
import { bagWords, campKey, campMemo, cap, keepShare, matCount, menuHtml, modText, routeChosen, st } from './run-common';

/** When the screen in front of the player last changed, so a second click meant for the old screen cannot land on the new one. */
let shownKey = '';
let shownAt = 0;
function seen(key: string): void {
  if (key === shownKey) return;
  shownKey = key;
  shownAt = performance.now();
}
const tooSoon = () => performance.now() - shownAt < 350;
/** The toast lays its children out in a row, so a message with markup goes in as one piece. */
const say = (ui: UI, html: string) => ui.say(`<span>${html}</span>`);

/** Every expedition page sits in one wrapper, so touch sizing and the like can be scoped to these screens. */
const wrap = (page: Page): Page => ({ ...page, body: `<div class="runp">${page.body}</div>` });

export function welcome(ui: UI): Page {
  return wrap(End.welcome(ui));
}
export function view(ui: UI): Page {
  const run = ui.run;
  if (!run) return { title: 'Expedition', body: '<p class="dim">No expedition is under way.</p>', foot: '<button class="pri" data-a="town" data-key="Enter">Back to town</button>' };
  seen(`${run.seed}:${run.wave}:${run.phase}`);
  if (run.phase === 'tally' && run.last) return wrap(tallyView(ui));
  if (run.phase === 'gate' && run.gate) return wrap(gateView(ui));
  return wrap(campView(ui));
}
export function summaryView(ui: UI): Page {
  seen(`summary:${ui.doneRun?.seed}`);
  return wrap(End.summaryView(ui));
}
export function pauseView(ui: UI): Page {
  return wrap(End.pauseView(ui));
}

export function act(ui: UI, a: string, v: string, _w: string): boolean | 'leave' | void {
  const p = ui.p;
  const run = ui.run;
  const snd = ui.hooks.sound;
  const w = _w;
  switch (a) {
    // ------------------------------------------------------------ anywhere
    case 'town':
      ui.summary = null;
      ui.doneRun = null;
      ui.go('Expedition');
      return true;
    case 'runmenu':
      if (run) ui.open({ kind: 'info', title: 'Expedition menu', html: menuHtml(ui, run) });
      return true;
    case 'leave': // back to town with the expedition waiting at this camp or gate; `abandon` belongs to the Expedition tab
      if (!run || run.phase === 'wave') return true;
      ui.close();
      ui.go('Expedition');
      return true;
  }
  if (!run || ui.view !== 'run') return false;
  const i = Number(v);
  switch (a) {
    // --------------------------------------------------------------- tally
    case 'tallyok':
      if (run.phase !== 'tally') return true;
      if (run.pendingPicks > 0) {
        ui.fail('Pick a level-up first.');
        return true;
      }
      R.afterTally(run);
      ui.s.campSel = null;
      snd.ui('click');
      return true;
    case 'levelpick': {
      const x = LEVEL_PICKS.find((q) => q.id === v);
      if (x && R.pickLevel(run, v)) {
        snd.ui('level');
        say(ui, `<b>${x.name}</b>: ${modText(x.mods)}.${run.pendingPicks > 0 ? ` ${run.pendingPicks} more to pick.` : ''}`);
      }
      return true;
    }

    // ---------------------------------------------------------------- camp
    case 'campsel':
      ui.s.campSel = v && v !== ui.s.campSel ? v : null;
      return true;
    case 'buy': {
      const o = run.shop[i];
      if (!o || run.phase !== 'camp') return true;
      const why = R.canBuy(run, o);
      if (why) {
        ui.fail(why === 'not enough scrap' ? `Not enough scrap: ${o.price - run.scrap} short.` : why === 'no free slot' ? 'No free weapon slot. Sell or merge a weapon first.' : `${cap(why)}.`);
        return true;
      }
      const before = run.weapons.length;
      const j = o.kind === 'weapon' ? R.mergeTarget(run, o.fam!, o.tier) : -1;
      const hp = run.hp;
      if (!R.buy(run, i)) return true;
      if (o.kind === 'weapon') {
        const merged = run.weapons.length === before;
        snd.ui(merged ? 'merge' : 'buy');
        say(ui, merged ? `Merged into <b>${R.weaponName(run.weapons[j])}</b>, gear score ${R.weaponGs(run.weapons[j])}.` : `Bought <b>${WEAPONS[o.fam!].name} ${roman(o.tier)}</b>, gear score ${R.weaponGs(run.weapons[run.weapons.length - 1])}. It fills slot ${run.weapons.length} of ${R.effSlots(run)}.`);
      } else {
        const it = ITEMS[o.item!];
        snd.ui('buy');
        say(ui, it.heal ? `<b>${it.name}</b>: healed ${Math.round(run.hp - hp)}.` : `Bought <b>${it.name}</b>: ${modText(it.mods)}.`);
      }
      ui.s.campSel = null;
      return true;
    }
    case 'lock': {
      const o = run.shop[i];
      if (!o || o.sold || run.phase !== 'camp') return true;
      o.locked = !o.locked;
      snd.ui('click');
      say(ui, o.locked ? 'Locked: this offer stays for the next camp, at that camp\'s price.' : 'Unlocked: a reroll or the next camp replaces it.');
      return true;
    }
    case 'reroll': {
      if (run.phase !== 'camp') return true;
      const cost = R.rerollCost(run);
      if (!R.reroll(run)) {
        ui.fail(`Not enough scrap: the reroll costs ${cost}, you have ${run.scrap}.`);
        return true;
      }
      snd.ui('click');
      const kept = run.shop.filter((o) => o.locked).length;
      say(ui, `Shop rerolled${cost ? ` for ${cost} scrap` : ', free'}.${kept ? ` ${kept} locked offer${kept > 1 ? 's' : ''} kept.` : ''}`);
      return true;
    }
    case 'merge': {
      const wpn = run.weapons[i];
      if (!wpn || run.phase !== 'camp') return true;
      const j = R.mergeTarget(run, wpn.fam, wpn.tier, i);
      if (!R.merge(run, i)) {
        ui.fail('Nothing to merge it with: it takes two weapons of the same kind and tier.');
        return true;
      }
      const keep = run.weapons[Math.min(i, j)];
      snd.ui('merge');
      say(ui, `Merged into <b>${R.weaponName(keep)}</b>, gear score ${R.weaponGs(keep)}. A slot is free.`);
      ui.s.campSel = null;
      return true;
    }
    case 'sell': {
      const wpn = run.weapons[i];
      if (!wpn || run.phase !== 'camp') return true;
      if (run.weapons.length <= 1) {
        ui.fail('Your last weapon cannot be sold.');
        return true;
      }
      const price = R.sellPrice(run, wpn);
      const name = R.weaponName(wpn);
      if (!R.sell(run, i)) return true;
      st.sale = { key: campKey(run), at: i, w: wpn, price };
      snd.ui('buy');
      say(ui, `Sold ${name} for ${price} scrap. <button class="sm" data-a="unsell">Undo</button>`);
      ui.s.campSel = null;
      return true;
    }
    case 'unsell': {
      const sale = st.sale;
      if (!sale || sale.key !== campKey(run) || run.phase !== 'camp') return true;
      if (run.scrap < sale.price) {
        ui.fail(`Cannot undo: it takes the ${sale.price} scrap back, and you have ${run.scrap}.`);
        return true;
      }
      if (run.weapons.length >= R.effSlots(run)) {
        ui.fail('Cannot undo: the slot has been filled.');
        return true;
      }
      run.scrap -= sale.price;
      const at = Math.min(sale.at, run.weapons.length);
      run.weapons.splice(at, 0, sale.w);
      // the weapons after it move one slot down: keep the selection on the same weapon
      if (ui.s.campSel?.startsWith('rw:') && Number(ui.s.campSel.slice(3)) >= at) ui.s.campSel = `rw:${Number(ui.s.campSel.slice(3)) + 1}`;
      st.sale = null;
      snd.ui('click');
      say(ui, `${R.weaponName(sale.w)} is back, for ${sale.price} scrap.`);
      return true;
    }
    case 'craft': {
      if (run.phase !== 'camp') return true;
      const r = RECIPES[v];
      const why = R.canCraft(run, v);
      if (!r || why) {
        ui.fail(`${cap(why ?? 'unknown recipe')}.`);
        return true;
      }
      const hp = run.hp;
      if (!R.craft(run, v)) return true;
      campMemo(run).crafted.push(r.name);
      snd.ui('craft');
      say(ui, `<b>${r.name}</b>: ${r.heal ? `healed ${Math.round(run.hp - hp)}` : r.mods ? `${modText(r.mods)}, next wave` : `one ${WEAPONS[r.fam!].name.toLowerCase()} is now the ${r.name}`}. ${run.craftsLeft > 0 ? `${run.craftsLeft} craft${run.craftsLeft > 1 ? 's' : ''} left at this camp.` : 'That was this camp\'s craft.'}`);
      return true;
    }
    case 'drink': {
      const b = run.flasks[i];
      if (!b || run.phase !== 'camp') return true;
      if (!R.drink(run, i)) {
        ui.fail('A flask is already drunk for the next wave.');
        return true;
      }
      snd.ui('craft');
      say(ui, `Drank the <b>${brewName(b)}</b>: ${modText(brewMods(b))}, next wave.`);
      return true;
    }
    case 'route':
      if (run.phase !== 'camp' || !run.routeOptions[i]) return true;
      R.chooseRoute(run, i);
      campMemo(run).routed = true; // from here the Start button is live
      snd.ui('click');
      return true;
    case 'go':
      if (run.phase !== 'camp' || tooSoon()) return true;
      if (!routeChosen(run)) {
        ui.fail('Choose the next ground first.');
        return true;
      }
      campMemo(run).played = { wave: run.wave, route: { ...run.route } };
      st.sale = null;
      R.leaveCamp(run);
      M.save(p);
      ui.hooks.beginWave();
      return 'leave';

    // ---------------------------------------------------------------- gate
    case 'chest': {
      const g = run.gate;
      if (!g || g.opened || !g.killed) return true;
      R.openChest(run);
      snd.ui('merge');
      say(ui, `In the chest: ${g.loot.join(', ')}.`);
      return true;
    }
    case 'evolve': {
      const wpn = run.weapons[i];
      const was = wpn ? R.weaponName(wpn) : '';
      if (wpn && R.evolvable(run).includes(i) && MATS[w] && run.bagMats[w] > 0
        && !ui.ask(`Evolve ${was} into the ${WEAPONS[wpn.fam].evolved}? One ${MATS[w].name} is used up and does not come home.`, 'Evolve', 'evolve', v, w)) return true;
      if (wpn && R.evolve(run, i, w)) {
        snd.ui('evolve');
        say(ui, `${was} became the <b>${R.weaponName(wpn)}</b>. The ${MATS[w].name} is used up.`);
      } else ui.fail('That weapon cannot evolve here.');
      return true;
    }
    case 'wild': {
      const g = run.gate;
      if (!g || g.wildDone) return true;
      const x = WILDS.find((q) => q.id === v);
      R.pickWild(run, x && g.wildOffer.includes(x.id) ? x.id : null);
      snd.ui(x ? 'buy' : 'click');
      say(ui, x ? `<b>${x.name}</b>. ${x.text}` : 'No wild pick taken.');
      return true;
    }
    case 'push': {
      const g = run.gate;
      if (!g || g.final || run.phase !== 'gate' || tooSoon()) return true;
      if (g.killed && !g.opened) {
        ui.fail('Open the chest first.');
        return true;
      }
      if (!g.wildDone) {
        ui.fail('Take or decline the wild pick first.');
        return true;
      }
      const atRisk = run.feat.loss && !run.race && (matCount(run.bagMats) > 0 || run.bagSchem.length > 0);
      if (atRisk && !ui.ask(`Push on with ${bagWords(run)} in the bag? There is no extraction until the next boss gate, after wave ${run.wave + 4}. If you fall before it, ${Math.round(keepShare(ui) * 100)}% of the bag comes home.`, 'Push on', 'push')) return true;
      R.push(run);
      ui.s.campSel = null;
      snd.ui('click');
      say(ui, `On to wave ${run.wave + 1}. ${BOSSES[R.segmentOf(run.wave)].name} waits at wave ${R.segmentOf(run.wave) * 4 + 4}.`);
      return true;
    }
    case 'extract': {
      // extraction needs only the chest: the wild pick and evolution belong to pushing on
      const g = run.gate;
      if (!g || run.phase !== 'gate' || tooSoon()) return true;
      if (g.killed && !g.opened) {
        ui.fail('Open the chest first: what is in it comes home too.');
        return true;
      }
      R.extract(run);
      ui.showSummary(M.finishRun(p, run), run);
      return 'leave';
    }
  }
  return false;
}
