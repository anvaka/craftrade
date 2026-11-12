// The town page frame: ruled head with the account's name and holdings,
// index tabs, the notice line, and the open tab. Also owns which of the
// three views is showing: town, a run, or the homecoming sheet.

import type { Feature } from '../../shared/protocol.ts';
import { RAWS } from '../../shared/vocab.ts';
import { audio } from '../audio/index.ts';
import { SOLO_ONLY, api, isSolo, onReachable, setWorld } from './api.ts';
import { nameWithTitle } from '../../shared/almanac.ts';
import { renderAlmanac } from './almanac.ts';
import { renderDaily } from './daily.ts';
import { DOCK_Q, PHONE_Q, WIDE_Q, el, fmt, icon, isDocked, isPhone, sprites, type Kid } from './dom.ts';
import { renderHome } from './home.ts';
import { renderMarket } from './market.ts';
import { app, getPrefs, onRedraw, redraw, savePrefs, sayFail, setProfile, type TabId } from './state.ts';
import { renderTownhall } from './townhall.ts';
import { FEATURE_TAB, RAW_NAME } from './words.ts';
import { GLOSS } from '../ui/glossary.ts';
import { setTip } from '../ui/tip.ts';
import { renderWorkshop } from './workshop.ts';

export type View = 'town' | 'run' | 'homecoming';
let view: View = 'town';
export const currentView = (): View => view;

const townRoot = (): HTMLElement => document.getElementById('town')!;
const runRoot = (): HTMLElement => document.getElementById('run')!;

// ---- sound controls (kit: .sound .mute .vol) -------------------------------

const muteBtns = new Set<HTMLButtonElement>();
const volInputs = new Set<HTMLInputElement>();
function syncSound(): void {
  for (const b of muteBtns) {
    if (!b.isConnected) {
      muteBtns.delete(b);
      continue;
    }
    b.setAttribute('aria-pressed', String(audio.muted));
    b.setAttribute('aria-label', audio.muted ? 'Sound is off' : 'Sound is on');
  }
  for (const v of volInputs) {
    if (!v.isConnected) volInputs.delete(v);
    else if (document.activeElement !== v) v.value = String(audio.volume);
  }
}
audio.onChange(syncSound);

/**
 * Mute and volume. `compact` is the mute stamp alone, drawn as a speaker: a
 * phone head has no room for a slider, and a slider at the top of a page that
 * scrolls takes the swipes meant for scrolling. The volume is in the account.
 */
export function soundControls(o: { compact?: boolean } = {}): HTMLElement {
  const mute = el('button', `stamp stamp--plain stamp--small mute${o.compact ? ' mute--icon' : ''}`, o.compact ? el('span', 'spk') : 'Sound');
  mute.type = 'button';
  mute.dataset.fk = 'mute';
  mute.setAttribute('aria-pressed', String(audio.muted));
  mute.setAttribute('aria-label', audio.muted ? 'Sound is off' : 'Sound is on');
  mute.addEventListener('click', () => {
    audio.toggleMute();
    audio.play('stamp');
  });
  const vol = el('input', 'vol');
  vol.type = 'range';
  vol.min = '0';
  vol.max = '1';
  vol.step = '0.05';
  vol.value = String(audio.volume);
  vol.dataset.fk = 'vol';
  vol.setAttribute('aria-label', 'Volume');
  vol.addEventListener('input', () => audio.setVolume(Number(vol.value)));
  vol.addEventListener('change', () => audio.play('pickup'));
  muteBtns.add(mute);
  if (o.compact) return el('div', 'sound sound--compact', mute);
  volInputs.add(vol);
  return el('div', 'sound', mute, vol);
}

// ---- head ------------------------------------------------------------------

function counter(ic: HTMLCanvasElement, n: number, what: string, meaning: string, cls = ''): HTMLElement {
  const c = el('span', `counter ${cls}`.trim(), ic, el('span', 'num', fmt(n)));
  setTip(c, `${what}: ${fmt(n)}. ${meaning}`);
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', `${fmt(n)} ${what.toLowerCase()}`);
  return c;
}

export function holdings(): HTMLElement {
  const S = sprites();
  const p = app.profile;
  return el(
    'div',
    'counters',
    counter(icon(S.icon.marks), p.marks, 'Marks', GLOSS.marks, 'is-scrip'),
    ...RAWS.map((r) => counter(icon(S.icon.raw[r]), p.raws[r], RAW_NAME[r], GLOSS[r])),
  );
}

/** The ruled page head. `title` replaces the account name on sheets that are not the town. */
export function pageHead(label: string, title: Kid, ...meta: Kid[]): HTMLElement {
  return el('header', 'page-head', el('div', 'head-name', el('div', 'label', label), el('h1', '', title)), el('div', 'meta', ...meta));
}

function townHead(): HTMLElement {
  const named = app.met && app.profile.name;
  const head = pageHead(named ? (isSolo() ? 'Scrip. Solo account of' : 'Scrip. Account of') : 'Scrip', named ? el('span', 'own', nameWithTitle(app.profile.name, app.profile.title)) : 'No account yet', app.met ? holdings() : null, soundControls({ compact: isDocked() }));
  head.classList.add('page-head--town');
  return head;
}

// ---- tabs ------------------------------------------------------------------

const TAB_ORDER: TabId[] = ['stash', 'workshop', 'market', 'town', 'daily', 'almanac'];
const tabName = (t: TabId): string => (t === 'stash' ? 'Stash' : t === 'almanac' ? 'Almanac' : FEATURE_TAB[t as Feature]);
const TAB_TIP: Record<TabId, string> = {
  stash: 'Your items, your kit for the next run, and who heads out.',
  workshop: 'Fuse two stash items into one new item, and read the codex of known recipes.',
  market: 'Trade raws with the Factor, and buy or sell items with other players.',
  town: 'Give raws to raise a station. In the shared town it helps every player.',
  daily: 'Today\u2019s clearing: the same eight waves for everyone, one scored try.',
  almanac: 'Your record: what you have done, found and earned, and what the game\u2019s words mean.',
};
// The almanac opens with the first run home: before that there is nothing to write in it.
const openTabs = (): TabId[] => TAB_ORDER.filter((t) => t === 'stash' || (t === 'almanac' ? app.profile.runs > 0 : app.profile.features.includes(t as Feature)));

export function openTab(t: TabId): void {
  if (!openTabs().includes(t)) t = 'stash';
  app.tab = t;
  app.notice = null;
  savePrefs({ tab: t });
  redraw();
  void loadTab(t);
}

/** The daily clearing has not been run today: its tab carries a mark. */
const dailyDue = (): boolean => {
  const d = app.daily;
  return !!d && !d.mine && !d.taken && getPrefs().dailyTaken !== d.date;
};

function tabs(): HTMLElement | null {
  const list = openTabs();
  // On a phone a lone Stash tab is a bar of nothing: it appears with the second tab.
  if (list.length < 2 && isPhone()) return null;
  const nav = el('div', 'tabs');
  nav.style.setProperty('--n', String(list.length));
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Town');
  for (const t of list) {
    const on = t === app.tab;
    const due = t === 'daily' && dailyDue();
    const b = el('button', 'tab', el('span', 'tab-name', tabName(t)), t === 'stash' && app.profile.items.length ? el('span', 'count num', String(app.profile.items.length)) : null, due ? el('span', 'tab-due') : null);
    if (due) b.setAttribute('aria-description', 'not yet run today');
    b.type = 'button';
    b.dataset.fk = `tab:${t}`;
    setTip(b, TAB_TIP[t]);
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    b.addEventListener('click', () => {
      audio.play('stamp');
      openTab(t);
    });
    b.addEventListener('keydown', (ev) => {
      const d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      ev.preventDefault();
      const next = list[(list.indexOf(t) + d + list.length) % list.length]!;
      openTab(next);
      (townRoot().querySelector(`[data-fk="tab:${next}"]`) as HTMLElement | null)?.focus();
    });
    nav.append(b);
  }
  return nav;
}

/** Change worlds. Everything on the page belongs to the old one, so the page is loaded again. */
export function switchWorld(w: 'town' | 'solo'): void {
  setWorld(w);
  location.reload();
}

// ---- notices ---------------------------------------------------------------

function notices(): HTMLElement {
  const box = el('div', 'notices');
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  if (!app.online && isSolo()) {
    box.append(el('div', 'notice', el('span', 'tag', 'Save'), el('span', 'text', 'Opening the save on this device.')));
  } else if (!app.online) {
    const goSolo = el('button', 'stamp stamp--plain stamp--small', 'Play solo on this device');
    goSolo.type = 'button';
    goSolo.dataset.fk = 'world:solo';
    setTip(goSolo, 'Solo is the whole game kept on this device, with a town of your own. It needs no connection. Its save is separate from the shared town\u2019s.');
    goSolo.addEventListener('click', () => switchWorld('solo'));
    box.append(
      el(
        'div',
        'notice',
        el('span', 'tag', 'Town'),
        el('span', 'text', app.met ? 'The town is out of reach. You can still head out. Nothing from a run will be saved until it answers. ' : 'The town is out of reach. You can still head out as a Greenhorn. Nothing from the run will be saved. '),
        SOLO_ONLY ? null : goSolo,
      ),
    );
  }
  const n = app.notice;
  if (n) box.append(el('div', `notice${n.kind === 'plain' ? '' : ` notice--${n.kind}`}`, el('span', 'tag', n.tag), el('span', 'text', n.text)));
  return box;
}

// ---- data for tabs ---------------------------------------------------------

export async function loadTab(t: TabId): Promise<void> {
  if (!app.online) return;
  try {
    if (t === 'workshop') [app.codex, app.relics] = await Promise.all([api.codex(), api.relics()]);
    else if (t === 'market') app.market = await api.market();
    else if (t === 'town') app.town = await api.town();
    else if (t === 'daily') app.daily = await api.daily();
    else if (t === 'almanac') app.almanac = await api.almanac();
    else if (app.profile.features.includes('daily')) app.daily = await api.daily();
    else return;
  } catch (e) {
    sayFail(tabName(t), e);
  }
  redraw();
}

// ---- drawing ---------------------------------------------------------------

function drawTown(): void {
  const root = townRoot();
  const active = document.activeElement as HTMLElement | null;
  const fk = active && root.contains(active) ? active.dataset.fk : undefined;
  const caret = active instanceof HTMLInputElement && active.type === 'text' ? active.selectionStart : null;

  const body = el('main', `tab-body tab-body--${app.tab}`);
  body.setAttribute('role', 'tabpanel');
  body.setAttribute('aria-label', tabName(app.tab));
  if (app.tab === 'workshop') renderWorkshop(body);
  else if (app.tab === 'market') renderMarket(body);
  else if (app.tab === 'town') renderTownhall(body);
  else if (app.tab === 'daily') renderDaily(body);
  else if (app.tab === 'almanac') renderAlmanac(body);
  else renderHome(body);

  const nav = tabs();
  root.classList.toggle('has-nav', !!nav);
  root.replaceChildren(...[townHead(), nav, notices(), body].filter((n): n is HTMLElement => !!n));

  if (fk) {
    const again = root.querySelector(`[data-fk="${CSS.escape(fk)}"]`) as HTMLElement | null;
    if (again && !(again as HTMLButtonElement).disabled) {
      again.focus({ preventScroll: true });
      if (caret !== null && again instanceof HTMLInputElement) {
        try {
          again.setSelectionRange(caret, caret);
        } catch {
          // not a text field any more
        }
      }
    }
  }
}

onRedraw(() => {
  if (view === 'town') drawTown();
});

// The layout is chosen in code as well as in CSS (a dock or not, folds or not): crossing a width redraws.
if (typeof matchMedia === 'function') {
  for (const q of [PHONE_Q, DOCK_Q, WIDE_Q]) {
    matchMedia(q).addEventListener('change', () => {
      if (view === 'town') drawTown();
    });
  }
}

/** Show the town. `focus` names the control that should take the keyboard. */
export function showTown(focusKey = 'headout'): void {
  view = 'town';
  document.body.classList.remove('in-run');
  runRoot().hidden = true;
  townRoot().hidden = false;
  if (!openTabs().includes(app.tab)) app.tab = 'stash';
  drawTown();
  window.scrollTo(0, 0);
  (townRoot().querySelector(`[data-fk="${focusKey}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
  void loadTab(app.tab);
}

/** Hand the screen to a run. Returns the element the run fills. */
export function showRun(): HTMLElement {
  view = 'run';
  const r = runRoot();
  r.replaceChildren();
  r.hidden = false;
  townRoot().hidden = true;
  document.body.classList.add('in-run');
  window.scrollTo(0, 0);
  return r;
}

/** Replace the town with a one-off sheet (the homecoming). */
export function showSheet(...kids: Kid[]): HTMLElement {
  view = 'homecoming';
  document.body.classList.remove('in-run');
  const r = runRoot();
  r.hidden = true;
  r.replaceChildren();
  const root = townRoot();
  root.classList.remove('has-nav');
  root.hidden = false;
  root.replaceChildren(...kids.filter((k): k is Node | string => k !== null && k !== undefined && k !== false).map((k) => (typeof k === 'number' ? String(k) : k)));
  window.scrollTo(0, 0);
  return root;
}

// ---- reaching the town again -----------------------------------------------

let retryTimer: number | undefined;
/** While the town is out of reach, knock every few seconds. */
export function watchReach(): void {
  if (retryTimer !== undefined) return;
  retryTimer = window.setInterval(() => {
    if (app.online || view === 'run' || document.hidden) return;
    api
      .hello(4000)
      .then((res) => {
        setProfile(res.profile);
        app.stations = res.stations;
        app.worldNotice = res.notice ?? null;
        app.online = true;
        redraw();
        if (view === 'town') void loadTab(app.tab);
      })
      .catch(() => {
        // still out of reach
      });
  }, 6000);
}

// Any request that finds the town gone puts up the standing line and starts knocking.
onReachable((online) => {
  if (online || !app.online) return;
  app.online = false;
  watchReach();
  redraw();
});
