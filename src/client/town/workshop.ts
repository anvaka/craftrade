// The workshop tab: the anvil for the stash, and the codex.

import { BASE_ITEM } from '../../shared/content/items.ts';
import { RELIC } from '../../shared/content/relics.ts';
import { effectText, fusionBlock, fusionBudget, isRelic, itemTier, tierOf, type ItemSpec } from '../../shared/item.ts';
import { KIT_CHARGES, type CodexRecipe, type FuseRes, type StashItem } from '../../shared/protocol.ts';
import { canPay, townFuseCost } from '../../shared/rules.ts';
import { audio } from '../audio/index.ts';
import { api } from './api.ts';
import { effectList, el, empty, finder, fmt, itemIcon, pips, plural, stamp, thing, tier, type Kid } from './dom.ts';
import { costText } from './home.ts';
import { app, clearNotice, redraw, sayFail, setProfile } from './state.ts';

// ---- anvil state -----------------------------------------------------------

let slotA: string | null = null;
let slotB: string | null = null;
let striking = false;
let struckAt = 0;
let result: { res: FuseRes; a: string; b: string; charges: number } | null = null;
let filter = '';

const held = (uid: string | null): StashItem | undefined => (uid ? app.profile.items.find((i) => i.uid === uid) : undefined);
const pairKey = (a: string, b: string): string => (a < b ? `${a}+${b}` : `${b}+${a}`);

/** Pairs this player has made, by sorted item ids. */
function tried(): Map<string, CodexRecipe> {
  const m = new Map<string, CodexRecipe>();
  for (const r of app.codex?.recipes ?? []) if (r.mine) m.set(pairKey(r.a, r.b), r);
  return m;
}

function known(id: string): ItemSpec | undefined {
  return app.codex?.items.find((i) => i.id === id) ?? BASE_ITEM[id] ?? app.profile.items.find((i) => i.item.id === id)?.item;
}

export function renderWorkshop(root: HTMLElement): void {
  if (!held(slotA)) slotA = null;
  if (!held(slotB)) slotB = null;
  root.append(anvil(), pairs(), codex(), relicRoll());
}

// ---- the anvil -------------------------------------------------------------

function slot(which: 'a' | 'b', it: StashItem | undefined): HTMLElement {
  const box = el('div', `slot${it ? '' : ' is-empty'}`);
  if (!it) {
    box.append(el('div', 'slot-blank'), el('div', 'slot-text', el('span', 'label', which === 'a' ? 'First item' : 'Second item'), el('span', 'note', 'Choose one from the stash below.')));
    return box;
  }
  box.append(
    itemIcon(it.item, true),
    el(
      'div',
      'slot-text',
      el('div', 'name', el('span', '', it.item.name), tier(itemTier(it.item))),
      effectList(it.item),
      striking
        ? null
        : stamp('Take off', {
            cls: 'stamp--small stamp--plain',
            key: `off:${which}`,
            sound: 'lock',
            onClick: () => {
              if (which === 'a') slotA = null;
              else slotB = null;
              redraw();
            },
          }),
    ),
  );
  return box;
}

function findStamp(by: string, first: boolean): HTMLElement {
  const mine = first || by === app.profile.name;
  return el('div', `find-stamp thud${mine ? ' is-yours' : ''}`, el('span', 'label', first ? 'First find' : 'First made by'), el('span', 'name', mine ? app.profile.name : by));
}

function outcome(a: StashItem | undefined, b: StashItem | undefined): HTMLElement {
  const box = el('div', 'outcome');
  if (result) {
    const it = result.res.item;
    box.classList.add('is-revealed');
    box.append(
      itemIcon(it, true),
      el(
        'div',
        'slot-text',
        el('div', 'name', el('span', '', it.name), tier(itemTier(it))),
        effectList(it),
        el('div', 'charges', pips(result.charges, KIT_CHARGES, 'charges'), el('span', 'label', 'Charges, in your stash')),
      ),
      el('div', 'outcome-stamp', findStamp(result.res.by, result.res.first)),
    );
    return box;
  }
  if (striking) {
    const m = el('div', 'meter strike-meter');
    m.id = 'strike-meter';
    m.style.setProperty('--v', String(strikeProgress()));
    box.append(el('div', 'slot-text', el('span', 'label', 'On the anvil'), m, el('span', 'note', 'An untried pair takes a second or two.')));
    return box;
  }
  if (!a || !b) {
    box.append(el('div', 'slot-text', el('span', 'label', 'Comes off'), el('span', 'note', 'Put two different items on to see the budget.')));
    return box;
  }
  const block = fusionBlock(a.item, b.item);
  if (block) {
    box.append(el('div', 'slot-text', el('span', 'label', 'Will not fuse'), el('span', '', block)));
    return box;
  }
  const budget = fusionBudget(a.item, b.item);
  const before = tried().get(pairKey(a.item.id, b.item.id));
  const made = before ? known(before.out) : undefined;
  // The price is set by the tier of what comes off; before the strike only the most it can be is known.
  const cost = townFuseCost(made ? itemTier(made) : tierOf(budget));
  const short = !canPay(app.profile, cost);
  const left = Math.min(a.charges, b.charges);
  box.append(
    el(
      'div',
      'slot-text',
      el('span', 'label', 'Comes off'),
      el('div', 'budget', el('span', 'num', `${budget} points`), tier(tierOf(budget))),
      made ? el('span', '', 'You have made this pair: ', el('strong', '', made.name), '.') : el('span', 'note', app.codex ? 'You have not tried this pair.' : ''),
      el('span', 'num', `${made ? 'Costs' : 'Costs up to'} ${costText(cost)}.`),
      el('span', '', `Both items are used up. The result has ${left} of ${KIT_CHARGES} charges: the fewer of the two.`),
      stamp('Strike', { key: 'strike', sound: null, disabled: short, title: short ? `You have ${plural(app.profile.marks, 'mark')}, ${app.profile.raws.timber} timber, ${app.profile.raws.ore} ore, ${app.profile.raws.hide} hide` : undefined, onClick: () => void strike(a, b) }),
    ),
  );
  return box;
}

const strikeProgress = (): number => Math.min(0.92, 0.12 + Math.floor((performance.now() - struckAt) / 300) * 0.1);

async function strike(a: StashItem, b: StashItem): Promise<void> {
  if (striking) return;
  striking = true;
  struckAt = performance.now();
  clearNotice();
  redraw();
  const stop = audio.loop('anvil', 0.75);
  const tick = window.setInterval(() => document.getElementById('strike-meter')?.style.setProperty('--v', String(strikeProgress())), 150);
  const settle = (): void => {
    stop();
    clearInterval(tick);
    striking = false;
  };
  try {
    const [res] = await Promise.all([api.fuse({ a: a.item.id, b: b.item.id, ctx: 'town', uidA: a.uid, uidB: b.uid }), new Promise((r) => setTimeout(r, 900))]);
    settle();
    if (res.profile) setProfile(res.profile);
    result = { res, a: a.item.name, b: b.item.name, charges: Math.min(a.charges, b.charges) };
    slotA = slotB = null;
    audio.play(res.first ? 'revealFirst' : 'reveal');
    redraw();
    (document.querySelector('[data-fk="anvil:clear"]') as HTMLElement | null)?.focus({ preventScroll: true });
    try {
      app.codex = await api.codex();
      redraw();
    } catch {
      // the codex catches up when the tab is next opened
    }
  } catch (e) {
    settle();
    sayFail('Anvil', e);
    redraw();
  }
}

function anvil(): HTMLElement {
  const a = held(slotA);
  const b = held(slotB);
  const sec = el('section', 'section section--first', el('h2', '', 'Anvil'));
  sec.append(
    el(
      'p',
      'note',
      'Two different items go on and one new item comes off, for a price in marks and raws set by its tier. A pair nobody has tried is decided once, for everyone, and carries its finder\'s name. ',
      el('span', 'num', `${plural(app.profile.novelLeft, 'untried pair')} left today.`),
    ),
  );
  if (result) {
    sec.append(
      el('div', 'anvil is-done', el('div', 'anvil-made', el('span', 'label', `${result.a} + ${result.b}`)), outcome(undefined, undefined)),
      el(
        'div',
        'stamps',
        stamp('Clear the anvil', {
          cls: 'stamp--plain',
          key: 'anvil:clear',
          onClick: () => {
            result = null;
            redraw();
          },
        }),
      ),
    );
  } else {
    sec.append(el('div', 'anvil', slot('a', a), el('span', 'anvil-op', '+'), slot('b', b), el('span', 'anvil-op', '='), outcome(a, b)));
  }
  sec.append(chooser(a, b));
  return sec;
}

/** The stash as a short table to put items on the anvil from. */
function chooser(a: StashItem | undefined, b: StashItem | undefined): HTMLElement {
  // A relic never goes on the anvil, so it is not offered.
  const items = app.profile.items.filter((i) => !isRelic(i.item));
  if (items.length === 0) return empty('The stash is empty. Items you carry home from a run can go on the anvil.');
  if (items.length === 1) {
    return empty(`Only ${items[0]!.item.name} is in the stash. The anvil needs two different items; carry another home or buy one at the market.`);
  }
  const t = el('table', 'ledger chooser');
  t.append(el('tr', '', el('th', '', 'In the stash'), el('th', '', 'Tier'), el('th', 'wide', 'Charges'), el('th', '', a && !b ? `With ${a.item.name}` : 'Pair'), el('th', '', '')));
  const memory = tried();
  const other = a && !b ? a : b && !a ? b : undefined;
  for (const it of items) {
    const on = it.uid === slotA || it.uid === slotB;
    let mark: Kid = '';
    if (on) mark = el('span', 'label', 'On the anvil');
    else if (other) {
      const block = fusionBlock(other.item, it.item);
      const rec = memory.get(pairKey(other.item.id, it.item.id));
      if (block) mark = el('span', 'note', other.item.id === it.item.id ? 'Same item' : 'Finished');
      else if (rec) mark = el('span', 'tried', 'Tried: ', el('strong', '', known(rec.out)?.name ?? 'made'));
      else mark = el('span', 'note', 'Untried by you');
    } else if (itemTier(it.item) === 4) mark = el('span', 'note', 'Finished');
    const fullAnvil = !!a && !!b;
    t.append(
      el(
        'tr',
        on ? 'is-on' : '',
        el('td', '', thing(itemIcon(it.item), it.item.name)),
        el('td', '', tier(itemTier(it.item))),
        el('td', 'wide', pips(it.charges, KIT_CHARGES, 'charges')),
        el('td', 'mark', mark),
        el(
          'td',
          'act',
          on || striking || result || fullAnvil
            ? null
            : stamp('Put on', {
                cls: 'stamp--small stamp--plain',
                key: `put:${it.uid}`,
                sound: 'lock',
                onClick: () => {
                  if (!slotA) slotA = it.uid;
                  else if (!slotB) slotB = it.uid;
                  redraw();
                },
              }),
        ),
      ),
    );
  }
  return t;
}

// ---- pairs in the stash: a memory for recipe hunting ----------------------

function pairs(): HTMLElement {
  const sec = el('section', 'section', el('h2', '', 'Pairs in your stash'));
  const seen = new Map<string, StashItem>();
  for (const it of app.profile.items) if (itemTier(it.item) < 4 && !seen.has(it.item.id)) seen.set(it.item.id, it);
  const list = [...seen.values()];
  if (list.length < 2) {
    sec.append(empty('With two different items in the stash, every pair is listed here and marked once you have tried it.'));
    return sec;
  }
  const memory = tried();
  const rows = el('ul', 'recipes');
  const all: { x: StashItem; y: StashItem; rec: CodexRecipe | undefined }[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const x = list[i]!;
      const y = list[j]!;
      all.push({ x, y, rec: memory.get(pairKey(x.item.id, y.item.id)) });
    }
  }
  const total = all.length;
  const done = all.filter((p) => p.rec).length;
  // Tried pairs first: they are the memory. Then a few to try next.
  const pick = [...all.filter((p) => p.rec), ...all.filter((p) => !p.rec).slice(0, 6)].slice(0, 14);
  const shown = pick.length;
  for (const { x, y, rec } of pick) {
    const out = rec ? known(rec.out) : undefined;
    rows.append(
      el(
        'li',
        `recipe${rec ? '' : ' is-untried'}`,
        el('span', 'r-in', thing(itemIcon(x.item), x.item.name)),
        el('span', 'r-op', '+'),
        el('span', 'r-in', thing(itemIcon(y.item), y.item.name)),
        el('span', 'r-op', '='),
        out ? el('span', 'r-out', thing(itemIcon(out), out.name), tier(itemTier(out))) : el('span', 'r-out', thing(el('span', 'unknown'), el('span', 'note', rec ? 'Made' : 'Not tried'))),
        el(
          'span',
          'r-by',
          result || striking
            ? null
            : stamp('Put both on', {
                cls: 'stamp--small stamp--plain',
                key: `both:${x.uid}:${y.uid}`,
                sound: 'lock',
                onClick: () => {
                  slotA = x.uid;
                  slotB = y.uid;
                  redraw();
                  window.scrollTo(0, 0);
                  (document.querySelector('[data-fk="strike"]') as HTMLElement | null)?.focus({ preventScroll: true });
                },
              }),
        ),
      ),
    );
  }
  sec.append(el('p', 'note num', `${done} of ${plural(total, 'pair')} tried.`), rows);
  if (total > shown) sec.append(el('p', 'note', `${fmt(total - shown)} more untried pairs are not listed. Put one item on the anvil and the table above marks each partner.`));
  return sec;
}

// ---- codex -----------------------------------------------------------------

function recipeRow(r: CodexRecipe): HTMLElement | null {
  const a = known(r.a);
  const b = known(r.b);
  const out = known(r.out);
  if (!a || !b || !out) return null;
  return el(
    'li',
    'recipe',
    el('span', 'r-in', thing(itemIcon(a), a.name)),
    el('span', 'r-op', '+'),
    el('span', 'r-in', thing(itemIcon(b), b.name)),
    el('span', 'r-op', '='),
    el('span', 'r-out', thing(itemIcon(out), out.name), tier(itemTier(out))),
    el('span', 'r-by', finder(r.by, app.profile.name)),
  );
}

function matches(r: CodexRecipe, q: string): boolean {
  if (!q) return true;
  return [r.a, r.b, r.out].some((id) => known(id)?.name.toLowerCase().includes(q));
}

function fillCodex(box: HTMLElement): void {
  const c = app.codex;
  box.replaceChildren();
  if (!c) {
    box.append(empty(app.online ? 'Fetching the codex.' : 'The codex is kept in town, which is out of reach.'));
    return;
  }
  const q = filter.trim().toLowerCase();
  const mine = c.recipes.filter((r) => r.mine);
  const world = c.recipes.filter((r) => !r.mine);

  const section = (title: string, all: CodexRecipe[], none: string): void => {
    box.append(el('h3', 'sub', title, el('span', 'count num', ` ${all.length}`)));
    if (!all.length) {
      box.append(empty(none));
      return;
    }
    const rows = all.filter((r) => matches(r, q)).map(recipeRow).filter((n): n is HTMLElement => !!n);
    if (!rows.length) {
      box.append(empty(`No recipe here has an item named "${filter.trim()}".`));
      return;
    }
    const cap = q ? rows.length : 15;
    box.append(el('ul', 'recipes', ...rows.slice(0, cap)));
    if (rows.length > cap) box.append(el('p', 'note', `${fmt(rows.length - cap)} more. Type an item name above to find a recipe.`));
  };
  section('Your recipes', mine, 'No recipes yet. Every pair you fuse, here or at the bench in a run, is written down in this list.');
  section('Recent finds in the world', world, mine.length ? 'Nobody else has found a recipe lately. Finds by other players are listed here as they are made.' : 'No finds yet. The first pair anyone fuses is listed here with the finder.');
}

function codex(): HTMLElement {
  const c = app.codex;
  const sec = el('section', 'section', el('h2', '', 'Codex'));
  const box = el('div', 'codex-lists');
  const search = el('input', 'field');
  search.type = 'search';
  search.placeholder = 'Item name';
  search.value = filter;
  search.dataset.fk = 'codex:q';
  search.setAttribute('aria-label', 'Filter recipes by item name');
  search.addEventListener('input', () => {
    filter = search.value;
    fillCodex(box);
  });
  sec.append(
    el(
      'div',
      'bar',
      el('div', 'bar-text num', c ? `You have made ${fmt(c.myAuthored)} of ${fmt(c.authoredPairs)} authored pairs. The world has tried ${fmt(c.worldAuthored)} of them, and knows ${plural(c.worldRecipes, 'recipe')} and ${plural(c.worldItems, 'fused item')} in all.` : ''),
      el('label', 'field-wrap', el('span', 'label', 'Find'), search),
    ),
    box,
  );
  fillCodex(box);
  return sec;
}

// ---- relics: the world's roll -----------------------------------------------

/**
 * Every relic kind as one ruled line, found or not, and every find by name.
 * A kind nobody has found is a blank line: it is there, and nobody has it.
 */
function relicRoll(): HTMLElement {
  const sec = el('section', 'section relic-roll', el('h2', '', 'Relics'));
  const r = app.relics;
  if (!r) {
    sec.append(empty(app.online ? 'Asking after the roll.' : 'The roll of relics is kept in town, which is out of reach.'));
    return sec;
  }
  const unfound = r.kinds.filter((k) => !k.id).length;
  sec.append(
    el(
      'p',
      'note',
      `${plural(r.kinds.length, 'relic')}, each of which breaks one rule. They are not made at the anvil and the town does not sell them. Once in a great while one comes home from the clearing, most often after a full win. `,
      el('span', 'num', `${fmt(r.total)} found in the world so far. ${unfound === 0 ? 'Every kind has been found at least once.' : `${plural(unfound, 'kind')} nobody has found.`}`),
    ),
  );
  const kinds = el('table', 'ledger relic-kinds');
  kinds.append(el('tr', '', el('th', '', 'Relic'), el('th', '', 'What it does'), el('th', 'num', 'In the world')));
  for (const k of r.kinds) {
    const spec = k.id ? RELIC[k.id] : undefined;
    kinds.append(
      spec
        ? el('tr', '', el('td', '', thing(itemIcon(spec), spec.name)), el('td', 'fx', spec.effects.map((e) => effectText(e)).join(', ')), el('td', 'num', fmt(k.found)))
        : el('tr', 'is-unfound', el('td', '', el('span', 'blank')), el('td', '', el('span', 'blank')), el('td', 'num', '0')),
    );
  }
  sec.append(kinds, el('h3', '', 'The roll'));
  if (!r.roll.length) {
    sec.append(empty('Nobody has brought one home yet. The first will be entered here by name.'));
    return sec;
  }
  const roll = el('table', 'ledger relic-finds');
  roll.append(el('tr', '', el('th', '', 'Relic'), el('th', 'num', 'No.'), el('th', '', 'Found by'), el('th', 'num', 'Date')));
  for (const f of r.roll) {
    roll.append(
      el(
        'tr',
        '',
        el('td', '', f.name),
        el('td', 'num', String(f.serial)),
        el('td', '', f.finder === app.profile.name ? el('span', 'own', f.finder) : el('span', 'who', f.finder)),
        el('td', 'num', f.date),
      ),
    );
  }
  sec.append(roll);
  if (r.total > r.roll.length) sec.append(el('p', 'note num', `The newest ${fmt(r.roll.length)} of ${fmt(r.total)} are listed.`));
  return sec;
}
