// The town page frame: ruled head with the account's name and holdings,
// index tabs, the notice line, and the open tab. Also owns which of the
// three views is showing: town, a run, or the homecoming sheet.

import type { Feature } from '../../shared/protocol.ts';
import { RAWS } from '../../shared/vocab.ts';
import { audio } from '../audio/index.ts';
import { api, onReachable } from './api.ts';
import { renderDaily } from './daily.ts';
import { el, fmt, icon, sprites, type Kid } from './dom.ts';
import { renderHome } from './home.ts';
import { renderMarket } from './market.ts';
import { app, onRedraw, redraw, savePrefs, sayFail, setProfile, type TabId } from './state.ts';
import { renderTownhall } from './townhall.ts';
import { FEATURE_TAB, RAW_NAME } from './words.ts';
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

export function soundControls(): HTMLElement {
  const mute = el('button', 'stamp stamp--plain stamp--small mute', 'Sound');
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
  volInputs.add(vol);
  return el('div', 'sound', mute, vol);
}

// ---- head ------------------------------------------------------------------

function counter(ic: HTMLCanvasElement, n: number, what: string, cls = ''): HTMLElement {
  const c = el('span', `counter ${cls}`.trim(), ic, el('span', 'num', fmt(n)));
  c.title = what;
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
    counter(icon(S.icon.marks), p.marks, 'Marks', 'is-scrip'),
    ...RAWS.map((r) => counter(icon(S.icon.raw[r]), p.raws[r], RAW_NAME[r])),
  );
}

/** The ruled page head. `title` replaces the account name on sheets that are not the town. */
export function pageHead(label: string, title: Kid, ...meta: Kid[]): HTMLElement {
  return el('header', 'page-head', el('div', 'head-name', el('div', 'label', label), el('h1', '', title)), el('div', 'meta', ...meta));
}

function townHead(): HTMLElement {
  const named = app.met && app.profile.name;
  return pageHead(named ? 'Scrip. Account of' : 'Scrip', named ? el('span', 'own', app.profile.name) : 'No account yet', app.met ? holdings() : null, soundControls());
}

// ---- tabs ------------------------------------------------------------------

const TAB_ORDER: TabId[] = ['stash', 'workshop', 'market', 'town', 'daily'];
const tabName = (t: TabId): string => (t === 'stash' ? 'Stash' : FEATURE_TAB[t as Feature]);
const openTabs = (): TabId[] => TAB_ORDER.filter((t) => t === 'stash' || app.profile.features.includes(t as Feature));

export function openTab(t: TabId): void {
  if (!openTabs().includes(t)) t = 'stash';
  app.tab = t;
  app.notice = null;
  savePrefs({ tab: t });
  redraw();
  void loadTab(t);
}

function tabs(): HTMLElement {
  const list = openTabs();
  const nav = el('div', 'tabs');
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Town');
  for (const t of list) {
    const on = t === app.tab;
    const b = el('button', 'tab', tabName(t), t === 'stash' && app.profile.items.length ? el('span', 'count num', String(app.profile.items.length)) : null);
    b.type = 'button';
    b.dataset.fk = `tab:${t}`;
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

// ---- notices ---------------------------------------------------------------

function notices(): HTMLElement {
  const box = el('div', 'notices');
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  if (!app.online) {
    box.append(
      el(
        'div',
        'notice',
        el('span', 'tag', 'Town'),
        el('span', 'text', app.met ? 'The town is out of reach. You can still head out. Nothing from a run will be saved until it answers.' : 'The town is out of reach. You can still head out as a Greenhorn. Nothing from the run will be saved.'),
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

  const body = el('main', 'tab-body');
  body.setAttribute('role', 'tabpanel');
  body.setAttribute('aria-label', tabName(app.tab));
  if (app.tab === 'workshop') renderWorkshop(body);
  else if (app.tab === 'market') renderMarket(body);
  else if (app.tab === 'town') renderTownhall(body);
  else if (app.tab === 'daily') renderDaily(body);
  else renderHome(body);

  root.replaceChildren(townHead(), tabs(), notices(), body);

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

/** Show the town. `focus` names the control that should take the keyboard. */
export function showTown(focusKey = 'headout'): void {
  view = 'town';
  document.body.classList.remove('in-run');
  runRoot().hidden = true;
  townRoot().hidden = false;
  if (app.tab !== 'stash' && !app.profile.features.includes(app.tab as Feature)) app.tab = 'stash';
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
