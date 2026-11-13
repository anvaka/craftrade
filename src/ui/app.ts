// The menu shell: which screen is up, the click and key dispatch, modals, toasts, tooltips.
// Screens live in their own files and are plain functions of this object.
import type { BrewForm, Fam, GearTool, Mat } from '../data';
import * as Log from '../log';
import * as M from '../meta';
import type * as R from '../run';
import type { Sound } from '../audio';
import * as I from './icons';
import { Tips, esc, tipHtml, ui as uiIcon } from './kit';
import { describe, type Ctx } from './things';
import * as Expedition from './town-expedition';
import * as Inventory from './town-inventory';
import * as Station from './town-station';
import * as Codex from './town-codex';
import * as Character from './town-character';
import * as Run from './run-screens';
import * as Modals from './modals';

export interface Hooks {
  beginWave(): void;
  stop(): void; // the wave in progress is over, whatever the arena thinks
  sound: Sound;
}
export type View = 'welcome' | 'town' | 'run' | 'summary' | 'pause' | 'none';
export const TABS = ['Expedition', 'Inventory', 'Forge', 'Workshop', 'Apothecary', 'Codex', 'Character'] as const;
export type Tab = (typeof TABS)[number];

export type Modal =
  | { kind: 'result'; uids: number[]; chosen: string[]; before: { lvl: number; xp: number }; skill: string; again: string; spent?: boolean } // spent: made from a pattern that is now used up
  | { kind: 'brewed'; ok: boolean; title: string; lines: string[]; found: string[]; key: string | null; count: number }
  | { kind: 'equip'; uid: number; back?: Modal } // back: the batch window the choice was opened from
  | { kind: 'confirm'; text: string; yes: string; a: string; v: string; w: string; back?: Modal } // back: the craft window the question was asked from
  | { kind: 'cards' }
  | { kind: 'help' }
  | { kind: 'info'; title: string; html: string };

/** What the player has selected and typed. Never saved. */
export interface State {
  tab: Tab;
  sub: string; // sub-tab of the Character screen
  sel: string | null; // the thing selected in the inventory, as a reference
  slot: string | null; // the loadout slot being filled: w0, w1, tool, bag, oil, charm0, charm1, flask0...
  cat: string; // inventory filter
  search: string;
  sort: 'new' | 'score' | 'name';
  recipe: Record<string, string>; // selected recipe per station
  craftable: boolean; // list only what can be made now
  fam: Fam;
  tier: number;
  perks: string[];
  tool: GearTool['node'];
  burden: Mat['cat'];
  qty: number;
  ra: string;
  rb: string;
  form: BrewForm;
  modal: Modal | null;
  campSel: string | null; // selected thing at camp
  pane: 'doll' | 'grid'; // on a phone the inventory shows one of its two panes
  stPane: 'list' | 'recipe'; // on a phone a station shows its list, then the chosen recipe
  amt: number; // how many of the selected material to sell or give
}
/** A screen: its body, and optionally a fixed bar under it. */
export interface Page {
  title?: string;
  cur?: string; // right side of the top bar
  body: string;
  foot?: string;
  footNarrow?: boolean; // show the bar only on narrow screens, where the page's own button scrolls away
  fit?: boolean; // the body manages its own scrolling (multi-pane layouts)
}

const TAB_ICON: Record<Tab, string> = {
  Expedition: I.uiIcon('route'), Inventory: I.uiIcon('bag'), Forge: I.stationIcon('forge'), Workshop: I.stationIcon('workshop'),
  Apothecary: I.stationIcon('apothecary'), Codex: I.uiIcon('codex'), Character: I.uiIcon('standing'),
};

/** During the guided start the town opens a few tabs at a time, so the first visit is not the whole game. */
export function tabOpen(p: M.Profile, t: Tab): boolean {
  if (!p.guided || p.sessions >= M.GUIDE_STEPS) return true;
  const feat = M.featFor(p);
  if (t === 'Expedition') return true;
  if (t === 'Inventory' || t === 'Forge') return p.stats.runs >= 1;
  if (t === 'Workshop' || t === 'Character') return p.sessions >= 1;
  return t === 'Apothecary' ? feat.craft : feat.schem; // Codex
}

export class UI {
  view: View = 'none';
  summary: M.Summary | null = null;
  doneRun: R.RunState | null = null;
  confirmed = false;
  s: State = {
    tab: 'Expedition', sub: 'Skills', sel: null, slot: null, cat: 'all', search: '', sort: 'new', recipe: {}, craftable: false,
    fam: 'blade', tier: 1, perks: [], tool: 'ore', burden: 'ore', qty: 1, ra: '', rb: '', form: 'flask', modal: null, campSel: null, pane: 'grid', stPane: 'list', amt: 10,
  };
  private lastKey = '';
  private lastClick = 0;
  private lastAction = '';
  private toastT = 0;
  private byKeys = false; // focus was last moved with Tab, not by a click or tap
  private toastAt = 0;
  private shownView: View = 'none';
  private graceUntil = 0; // input is ignored until then: a click meant for the arena must not land on a menu
  private layerGrace = 0; // the same, for a window or sheet that has just opened under the pointer
  private lastLayer = '';
  private tips: Tips;

  constructor(private root: HTMLElement, public p: M.Profile, public hooks: Hooks) {
    this.tips = new Tips(root, (ref, el) => this.tipFor(ref, el));
    root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
      if (!el || (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
      if (performance.now() < this.graceUntil) return;
      // a second tap must not land on a button that appeared under the finger a moment ago
      if (performance.now() < this.layerGrace && el.closest('.modal, .sheet')) return;
      hooks.sound.init(); // any click is a user gesture, so interface sounds work from the first one
      // a second quick click on something destructive would land on the row that slid under the cursor
      const now = performance.now();
      const a = el.dataset.a!;
      const repeat = a === this.lastAction && now - this.lastClick < 400;
      this.lastClick = now;
      this.lastAction = a;
      if (repeat && ['sell', 'scrapgear', 'break', 'donate', 'levelpick', 'wild', 'evolve', 'merge', 'card', 'vault', 'tallyok', 'go', 'extract', 'push', 'yes'].includes(a)) return;
      this.dispatch(a, el.dataset.v ?? '', el.dataset.w ?? '');
    });
    root.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.in !== 'search') return;
      this.s.search = el.value;
      // a phone keyboard that is still composing a word (predictions, autocorrect) loses it if the field changes under it
      if (!(e as InputEvent).isComposing) this.refreshAround(el);
    });
    root.addEventListener('compositionend', (e) => {
      const el = e.target as HTMLInputElement;
      if (el.dataset.in !== 'search') return;
      this.s.search = el.value;
      this.refreshAround(el);
    });
    addEventListener('keydown', (e) => this.onKey(e));
    // how focus last moved: Tab means the player is steering by keyboard, a pointer press means they are not
    addEventListener('keydown', (e) => { if (e.key === 'Tab') this.byKeys = true; }, true);
    addEventListener('pointerdown', () => { this.byKeys = false; }, true);
  }

  get run(): R.RunState | null {
    return this.p.run;
  }
  get ctx(): Ctx {
    // on the summary the expedition is over and no longer on the profile: tooltips still describe its weapons
    return { p: this.p, run: this.p.run ?? (this.view === 'summary' ? this.doneRun : null) };
  }

  // ------------------------------------------------------------ navigation
  setTab(t: string): void {
    const hit = TABS.find((x) => x.toLowerCase() === t.toLowerCase()) ?? (t === 'Storage' ? 'Inventory' : ['Standing', 'Vault'].includes(t) ? 'Character' : null);
    if (hit) this.s.tab = hit;
    if (t === 'Standing' || t === 'Vault') this.s.sub = t;
  }
  go(tab: Tab, sub?: string): void {
    // leaving the inventory by a link counts as having seen it, the same as leaving by the tab bar
    if (this.s.tab === 'Inventory' && tab !== 'Inventory') for (const g of this.p.gear) g.isNew = false;
    if (this.s.tab !== tab) {
      this.s.qty = 1; // a quantity belongs to the recipe it was set on
      this.s.slot = null; // and "choose what goes in this slot" to the visit it was opened on
    }
    this.s.tab = tab;
    if (sub) this.s.sub = sub;
    this.s.modal = null;
    this.view = 'town';
  }
  showTown(): void {
    this.view = this.p.guided === null ? 'welcome' : 'town';
    this.render();
  }
  showRun(): void {
    if (this.view === 'none') this.graceUntil = performance.now() + 500;
    this.view = 'run';
    this.s.modal = null;
    this.s.campSel = null;
    M.save(this.p);
    this.render();
  }
  showSummary(sum: M.Summary, run: R.RunState): void {
    this.summary = sum;
    this.doneRun = run;
    Log.finish(this.p, run, sum);
    if (this.view === 'none') this.graceUntil = performance.now() + 500;
    this.view = 'summary';
    this.s.modal = null;
    M.save(this.p);
    this.render();
  }
  showPause(on: boolean): void {
    this.view = on ? 'pause' : 'none';
    this.render();
  }
  hide(): void {
    this.view = 'none';
    this.render();
  }

  // -------------------------------------------------------------- feedback
  /** A short message at the bottom of the screen. */
  say(text: string, bad = false): void {
    document.getElementById('toast')?.remove();
    if (!text) return;
    const el = document.createElement('div');
    el.id = 'toast';
    this.toastAt = performance.now();
    el.className = `toast${bad ? ' bad' : ''}`;
    el.setAttribute('role', 'status');
    el.innerHTML = text;
    // a toast may carry a button ("Undo"); it lives outside the menu root, so it forwards its own clicks
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
      if (!b) return;
      el.remove();
      this.dispatch(b.dataset.a!, b.dataset.v ?? '', b.dataset.w ?? '');
    });
    document.body.appendChild(el);
    // sit just above the bottom bar, whatever its height on this screen (measured after the screen has re-rendered),
    // and above a bottom sheet, so the stepper and the buttons just used stay in sight
    requestAnimationFrame(() => {
      const shown = (sel: string) => {
        const e = this.root.hidden ? null : this.root.querySelector<HTMLElement>(sel);
        return e && getComputedStyle(e).display !== 'none' ? e : null;
      };
      const bar = shown('.footbar');
      const sheet = shown('.sheet');
      const drawer = !!sheet && sheet.getBoundingClientRect().top < innerHeight / 4; // a phone on its side: the sheet is a drawer on the right
      const h = Math.max(bar?.offsetHeight ?? 0, sheet && !drawer ? sheet.offsetHeight : 0);
      el.style.bottom = h ? `${h + 14}px` : 'calc(14px + var(--safe-b))';
      if (drawer) el.style.right = `${sheet.offsetWidth + 12}px`;
    });
    clearTimeout(this.toastT);
    this.toastT = window.setTimeout(() => el.remove(), bad ? 4500 : 3200);
  }
  /** Report a refusal; returns true if there was one. */
  fail(text: string | null | undefined): boolean {
    if (!text) return false;
    this.say(text, true);
    this.hooks.sound.ui('deny');
    return true;
  }
  open(m: Modal): void {
    document.getElementById('toast')?.remove(); // a message must not sit on top of a window
    this.s.modal = m;
  }
  close(): void {
    const m = this.s.modal;
    this.s.modal = (m?.kind === 'confirm' || m?.kind === 'equip') && m.back ? m.back : null;
  }
  /** Ask first. Returns true when the player has just said yes (the action is re-sent with `confirmed` set). */
  ask(text: string, yes: string, a: string, v = '', w = ''): boolean {
    if (this.confirmed) return true;
    // as in `open`: the toast sits above the whole menu layer, so one said a moment ago (a wild pick) covered the question
    document.getElementById('toast')?.remove();
    const from = this.s.modal;
    this.s.modal = { kind: 'confirm', text, yes, a, v, w, back: from?.kind === 'result' ? from : undefined };
    return false;
  }

  // -------------------------------------------------------------- dispatch
  dispatch(a: string, v = '', w = ''): void {
    // the play log: what was done at camp, at a gate and in town, with what it cost
    const run = this.p.run;
    const inRun = this.view === 'run' && !!run && Log.RUN_ACTIONS.includes(a);
    const inTown = this.view === 'town' && Log.TOWN_ACTIONS.includes(a);
    const asked = this.s.modal?.kind === 'confirm' ? this.s.modal : null; // "yes" carries the action it confirms
    const what = inRun && run ? Log.describeAction(run, a, v) : inTown ? this.townWhat(a, v, w) : undefined;
    const before = { scrap: run?.scrap ?? 0, hp: run?.hp ?? 0, coin: this.p.coin, gear: this.p.gear.length, modal: this.s.modal };
    const keep = this.act(a, v, w);
    if (inRun && run && this.s.modal?.kind !== 'confirm') Log.action(this.p, run, a, what, before);
    else if (a === 'yes' && asked && run && this.view !== 'town' && Log.RUN_ACTIONS.includes(asked.a)) Log.action(this.p, run, asked.a, Log.describeAction(run, asked.a, asked.v), before);
    else if (inTown && this.s.modal?.kind !== 'confirm') Log.town(this.p, a, what, before.coin);
    else if (a === 'yes' && asked && Log.TOWN_ACTIONS.includes(asked.a)) Log.town(this.p, asked.a, [asked.v, asked.w].filter(Boolean).join(' ') || undefined, before.coin);
    if (keep === false) return; // the action left the menus (a wave began, the page reloads)
    if (this.view !== 'none') M.save(this.p);
    this.render();
  }
  /** What a town action is about, for the play log: the recipe and quantity for a craft, the reagents for a brew. */
  private townWhat(a: string, v: string, w: string): string | undefined {
    const s = this.s;
    if (a === 'make') return `${s.tab} ${s.recipe[s.tab] ?? ''}${s.qty > 1 ? ` ×${s.qty}` : ''}${s.perks.length && (s.recipe[s.tab] ?? '').startsWith('w:') ? ` [${s.perks.join('+')}]` : ''}`.trim();
    if (a === 'brew') return `${s.ra}+${s.rb} as ${s.form}`;
    return [v, w].filter(Boolean).join(' ') || undefined;
  }
  private act(a: string, v: string, w: string): boolean | void {
    const snd = this.hooks.sound;
    switch (a) {
      case 'tab':
        if (!tabOpen(this.p, v as Tab)) return;
        if (this.s.tab === 'Inventory' && v !== 'Inventory') for (const g of this.p.gear) g.isNew = false; // seen
        this.s.stPane = 'list';
        this.s.tab = v as Tab; this.s.slot = null; this.s.qty = 1; return;
      case 'sub': this.s.sub = v; return;
      case 'close': this.close(); return;
      case 'yes': {
        const m = this.s.modal;
        if (m?.kind !== 'confirm') return;
        this.close();
        this.confirmed = true;
        try {
          return this.act(m.a, m.v, m.w);
        } finally {
          this.confirmed = false;
        }
      }
      case 'help': this.open({ kind: 'help' }); return;
      case 'mute': snd.toggleMute(); return;
      case 'vol': snd.bumpVolume(v === 'amb' ? 'amb' : 'music', Number(w) || 0); return;
      case 'guided': this.p.guided = v === '1'; this.view = 'town'; return;
      case 'openall': this.p.guided = false; return;
      case 'resume': document.dispatchEvent(new CustomEvent('cw-resume')); return false;
      case 'wipe':
        if (!this.ask('Delete the save and start over? Everything you have made and learned is lost.', 'Delete everything', 'wipe')) return;
        M.wipe();
        location.reload();
        return false;
      case 'goto': {
        // "station:forge" or a thing reference: show it where it lives
        if (['Forge', 'Workshop', 'Apothecary'].includes(v)) {
          this.go(v as Tab);
          if (w) {
            this.s.qty = 1;
            this.s.recipe[v] = w; // open the station on that recipe ("p:<schematic>" or "up")
            this.s.stPane = 'recipe';
          }
        } else if ((TABS as readonly string[]).includes(v)) this.go(v as Tab, w || undefined);
        else {
          this.go('Inventory');
          this.s.sel = v;
          this.s.pane = 'grid';
          if (v.startsWith('gear:')) {
            const g = M.gearBy(this.p, Number(v.slice(5)));
            if (g) g.isNew = false;
          }
          this.s.cat = 'all';
          this.s.search = '';
        }
        return;
      }
    }
    // on an expedition the run screens come first: the shop and the armoury both have a "lock"
    const mods = this.view === 'town' ? [Modals, Expedition, Inventory, Station, Codex, Character, Run] : [Modals, Run, Expedition, Inventory, Station, Codex, Character];
    for (const mod of mods) {
      const r = mod.act(this, a, v, w);
      if (r === 'leave') return false;
      if (r) return;
    }
  }

  private onKey(e: KeyboardEvent): void {
    if (this.view === 'none' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    const box = t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'checkbox';
    // typing in a field keeps every key; a ticked box keeps only Space, so shortcuts still work after clicking it
    if ((t.tagName === 'INPUT' && !box) || t.tagName === 'TEXTAREA' || (box && e.key === ' ')) {
      if (e.key === 'Escape') (t as HTMLInputElement).blur();
      return;
    }
    const go = e.key === 'Enter' || e.key === ' ';
    // A held key never acts twice. Without this the browser re-clicks the focused button on every key repeat.
    if (e.repeat || performance.now() < this.graceUntil) {
      if (go) e.preventDefault();
      return;
    }
    if (this.view === 'pause' && e.key !== 'Enter') return; // main.ts owns P and Escape while a wave is paused
    const scope = this.root.querySelector<HTMLElement>('.modal') ?? this.root;
    const key = e.key === ' ' ? 'Enter' : e.key;
    // Enter belongs to the button that shows the Enter keycap. A button the player tabbed to keeps it;
    // a button that only has focus because it was just clicked does not.
    // (:focus-visible is not a reliable test here: inside a key handler it is already true for a clicked button)
    const tabbed = t.tagName === 'BUTTON' && this.byKeys;
    if (key === 'Enter' && tabbed && t.dataset.key !== 'Enter') return;
    // a numbered choice on the page wins over the numbered town tabs
    const q = `[data-key="${CSS.escape(key)}"]`;
    const hit = scope.querySelector<HTMLElement>(`.body ${q}, .footbar ${q}, .mb ${q}`) ?? scope.querySelector<HTMLElement>(q);
    if (hit && !(hit as HTMLButtonElement).disabled) {
      e.preventDefault();
      hit.click();
    } else if (key === 'Escape' && this.s.modal) {
      e.preventDefault();
      this.dispatch('close');
    } else if (go && t.tagName === 'BUTTON') e.preventDefault();
  }

  // ---------------------------------------------------------------- render
  /** Typing redraws the list around the field, never the field: a phone keyboard closes or drops the word when the focused input is replaced. */
  private refreshAround(input: HTMLElement): void {
    const row = input.closest('.filters');
    const box = row?.parentElement;
    const t = document.createElement('template');
    t.innerHTML = this.page().body;
    const freshRow = t.content.querySelector(`[data-in="${CSS.escape(input.dataset.in!)}"]`)?.closest('.filters');
    const freshBox = freshRow?.parentElement;
    if (!row || !box || !freshRow || !freshBox) return this.render();
    this.tips.hide();
    const kids = [...freshBox.childNodes];
    const at = kids.indexOf(freshRow);
    while (row.previousSibling) row.previousSibling.remove();
    while (row.nextSibling) row.nextSibling.remove();
    row.before(...kids.slice(0, at));
    row.after(...kids.slice(at + 1));
  }
  private tipFor(ref: string, el: HTMLElement): string {
    if (ref.startsWith('text:')) return `<div class="tt"><div class="tb">${esc(ref.slice(5))}</div></div>`;
    const d = describe(ref, this.ctx);
    if (el.dataset.qty) d.qty = Number(el.dataset.qty);
    // a weapon in storage is shown against the two in the loadout
    const g = ref.startsWith('gear:') ? M.gearBy(this.p, Number(ref.slice(5))) : null;
    if (g?.kind === 'weapon') {
      const same = Inventory.versusFor(this, g);
      if (same) return tipHtml(d, { versus: describe(`gear:${same.uid}`, this.ctx) }) + tipHtml(describe(`gear:${same.uid}`, this.ctx), { caption: `In your loadout, slot ${this.p.loadout.weapons.indexOf(same.uid) + 1}` });
    }
    return tipHtml(d);
  }

  render(): void {
    this.tips.hide();
    // a message belongs to the screen it was said on: an older one does not follow the player to the next screen
    if (this.view !== this.shownView && performance.now() - this.toastAt > 250) document.getElementById('toast')?.remove();
    this.shownView = this.view;
    if (this.view === 'none') {
      this.root.hidden = true;
      return;
    }
    // keep scroll positions while acting on a screen, but start a new screen at the top
    const key = `${this.view}:${this.view === 'run' ? this.run?.phase : this.view === 'town' ? this.s.tab + this.s.sub : ''}`;
    const scroll: Record<string, number> = {};
    if (key === this.lastKey) for (const el of this.root.querySelectorAll<HTMLElement>('[data-scroll]')) scroll[el.dataset.scroll!] = el.scrollTop;
    this.lastKey = key;
    const act = document.activeElement as HTMLElement | null;
    const focus = act && this.root.contains(act) ? { a: act.dataset.a, v: act.dataset.v, w: act.dataset.w, input: act.dataset.in, pos: (act as HTMLInputElement).selectionStart } : null;

    const layer = `${this.s.modal?.kind ?? ''}|${this.view === 'town' && this.s.tab === 'Inventory' ? (this.s.sel ?? '') : ''}`;
    if (layer !== this.lastLayer && layer !== '|') this.layerGrace = performance.now() + 400;
    this.lastLayer = layer;
    this.root.hidden = false;
    this.root.classList.toggle('glass', this.view === 'pause');
    const page = this.page();
    const modal = this.s.modal ? Modals.view(this, this.s.modal) : '';
    this.root.innerHTML = `${page.title !== undefined ? `<header class="top"><h1>${page.title}</h1><div class="cur">${page.cur ?? ''}</div></header>` : ''}
      ${this.view === 'town' ? this.nav() : ''}
      <main class="body${page.fit ? ' fit' : ''}" data-scroll="main"><div class="wrap${page.fit ? ' grow' : ''}" ${page.fit ? 'style="display:flex;flex-direction:column;min-height:0"' : ''}>${page.body}</div></main>
      ${page.foot ? `<footer class="footbar${page.footNarrow ? ' narrow' : ''}">${page.foot}</footer>` : ''}${modal}`;

    for (const el of this.root.querySelectorAll<HTMLElement>('[data-scroll]')) if (scroll[el.dataset.scroll!]) el.scrollTop = scroll[el.dataset.scroll!];
    this.root.querySelector<HTMLElement>('.nav .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    if (focus) {
      const sel = focus.input ? `[data-in="${focus.input}"]` : focus.a ? `[data-a="${CSS.escape(focus.a)}"]${focus.v !== undefined ? `[data-v="${CSS.escape(focus.v)}"]` : ''}${focus.w ? `[data-w="${CSS.escape(focus.w)}"]` : ''}` : '';
      const el = sel ? (this.root.querySelector<HTMLElement>(`.modal ${sel}`) ?? this.root.querySelector<HTMLElement>(sel)) : null;
      if (el) {
        el.focus({ preventScroll: true });
        if (focus.input && focus.pos !== null && focus.pos !== undefined) (el as HTMLInputElement).setSelectionRange(focus.pos, focus.pos);
      }
    }
    // Focus the window itself, not a button in it: Enter then goes through onKey (which ignores key repeats)
    // to the button that carries the Enter keycap, and a held Enter cannot confirm something by itself.
    if (this.s.modal && !this.root.querySelector('.modal :focus')) this.root.querySelector<HTMLElement>('.modal .box')?.focus({ preventScroll: true });
  }

  private nav(): string {
    const p = this.p;
    const feat = M.featFor(p);
    const badge: Partial<Record<Tab, number>> = {
      Inventory: p.gear.filter((g) => g.isNew).length,
      Codex: feat.schem ? Object.keys(p.schematics).filter((id) => p.schematics[id] > 0 && !p.codex.includes(id) && id.startsWith('r-')).length : 0,
      Character: p.standing.pending + (!p.week.claimed && M.vaultOptions(p).some((o) => p.week.runs >= o.need) ? 1 : 0),
    };
    return `<nav class="nav" aria-label="Town">${TABS.filter((t) => tabOpen(p, t)).map((t, i) => `<button class="${t === this.s.tab ? 'on' : ''}" data-a="tab" data-v="${t}" data-key="${i + 1}" aria-label="${t}" ${t === this.s.tab ? 'aria-current="page"' : ''}><span class="ti">${TAB_ICON[t]}</span><span class="tl">${t}</span>${badge[t] ? `<span class="badge">${badge[t]}</span>` : ''}<span class="key">${i + 1}</span></button>`).join('')}
      <span class="grow"></span><button data-a="help" aria-label="Help and settings">${uiIcon('settings')}</button></nav>`;
  }

  private page(): Page {
    const p = this.p;
    switch (this.view) {
      case 'welcome': return Run.welcome(this);
      case 'town': {
        if (!tabOpen(p, this.s.tab)) this.s.tab = 'Expedition';
        const body = { Expedition, Inventory, Forge: Station, Workshop: Station, Apothecary: Station, Codex, Character }[this.s.tab].view(this);
        return {
          // on a phone the tab bar has only icons, so the title names the tab instead of the town
          title: body.title ?? `<span class="hide-phone">Town</span><span class="ph">${this.s.tab}</span>`,
          cur: body.cur ?? `<span data-tip="text:Coin pays crafting fees. Every wave cleared pays coin; surplus materials sell in the inventory.">${uiIcon('coin')}<b class="num">${p.coin}</b></span>
            <span data-tip="text:Town standing. Earned for waves cleared and for materials given to town projects. Each level is a card to pick.">${uiIcon('standing')}<b class="num">${p.standing.lvl}</b></span>
            ${M.featFor(p).schem ? `<span data-tip="text:Your key: the highest danger level you may set for an expedition.">${uiIcon('key')}<b class="num">${p.key}</b></span>` : ''}`,
          ...body,
        };
      }
      case 'run': return Run.view(this);
      case 'summary': return Run.summaryView(this);
      case 'pause': return Run.pauseView(this);
      default: return { body: '' };
    }
  }
}
