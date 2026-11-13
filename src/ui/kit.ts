// Shared pieces of every menu: item tiles, tooltips, bars, rings, material slots.
import { MATS } from '../data';
import type * as M from '../meta';
import * as I from './icons';
import { RARITY_NAME, describeMat, matSource, roman, type Desc } from './things';

export const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
/** An icon sized to the text around it. */
export const ic = (svg: string) => svg.replace('<svg', '<svg class="ic" aria-hidden="true"');
export const ui = (name: string) => ic(I.uiIcon(name));

export interface TileOpts {
  size?: 'xs' | 'sm' | 'lg' | 'xl';
  qty?: number | string;
  a?: string; // action on click
  v?: string | number;
  w?: string;
  sel?: boolean;
  dim?: boolean;
  isNew?: boolean;
  equipped?: boolean;
  locked?: boolean;
  gs?: boolean; // show gear score in the corner
  glyphs?: string[]; // small perk icons along the bottom, so look-alike items can be told apart
  slot?: string; // loadout slot badge: "1", "2" or "E"
  round?: boolean; // stackable materials are round, things you equip are square
  noTier?: boolean;
  label?: string; // accessible name override
}
export function tile(d: Desc, o: TileOpts = {}): string {
  const marks = `${o.isNew ? '<i class="new" title="New">!</i>' : ''}${o.slot || o.equipped ? `<i class="eq" title="In the loadout">${o.slot ?? 'E'}</i>` : ''}`;
  const cls = `tile r${d.rarity}${o.size ? ' ' + o.size : ''}${o.sel ? ' sel' : ''}${o.dim ? ' dimmed' : ''}${o.a ? '' : ' static'}${o.round ? ' round' : ''}`;
  const act = o.a ? ` data-a="${o.a}" data-v="${esc(String(o.v ?? ''))}"${o.w ? ` data-w="${esc(o.w)}"` : ''}` : '';
  const small = o.size === 'xs';
  // a tile with no action of its own is a span, so it can sit inside a button
  const tag = o.a ? 'button type="button"' : 'span role="img"';
  return `<${tag} class="${cls}" data-tip="${esc(d.ref)}"${act} aria-label="${esc(o.label ?? d.name)}">${d.icon}${
    !small && d.tier && !o.noTier ? `<span class="t">${roman(d.tier)}</span>` : ''}${
    !small && o.glyphs?.length ? `<span class="pg">${o.glyphs.slice(0, 3).join('')}</span>` : ''}${
    !small && o.locked ? `<span class="lk" title="Locked">${I.uiIcon('lock')}</span>` : ''}${
    !small && o.gs && d.gs ? `<span class="q">${d.gs}</span>` : o.qty !== undefined && o.qty !== '' ? `<span class="q">${o.qty}</span>` : ''}${marks ? `<span class="m">${marks}</span>` : ''}</${o.a ? 'button' : 'span'}>`;
}
/** An empty equipment slot. */
export function emptyTile(icon: string, label: string, a?: string, v?: string | number, size?: TileOpts['size']): string {
  return `<button type="button" class="tile empty${size ? ' ' + size : ''}"${a ? ` data-a="${a}" data-v="${v ?? ''}"` : ''} aria-label="${esc(label)}">${icon}</button>`;
}

/** The tooltip body. With `versus`, stats that differ are marked up or down. */
export function tipHtml(d: Desc, o: { caption?: string; versus?: Desc; actions?: string } = {}): string {
  const gsDiff = o.versus?.gs && d.gs ? d.gs - o.versus.gs : 0;
  const stats = d.stats.map(([k, v]) => `<div class="kv"><span class="dim">${k}</span><span>${v}</span></div>`).join('');
  const perks = d.perks.map((p) => `<div class="pk">${p.icon}<div>${p.name ? `<b>${p.name}</b>${p.tag ? `<span class="tag">${p.tag}</span>` : ''}${p.text ? '<br>' : ''}` : ''}<span class="${p.name ? 'dim' : ''}">${p.text}</span></div></div>`).join('');
  const notes = d.notes.filter(Boolean).map((n) => `<p class="dim">${n}</p>`).join('');
  return `<div class="tt r${d.rarity}">${o.caption ? `<div class="cap">${o.caption}</div>` : ''}
    <div class="th">${tile(d, { size: 'sm', qty: undefined })}<div><div class="nm">${d.name}</div><div class="ty">${d.type}${d.qty !== undefined ? ` · ${d.qty} owned` : ''}</div></div></div>
    <div class="tb">${d.gs ? `<div class="gs"><b>${d.gs}</b><span class="dim">gear score</span>${gsDiff ? `<span class="${gsDiff > 0 ? 'up' : 'down'}">${gsDiff > 0 ? '+' : ''}${gsDiff}</span>` : ''}</div>` : ''}
      ${stats}${perks ? `${stats ? '<div class="sep"></div>' : ''}${perks}` : ''}${notes ? `<div class="sep"></div>${notes}` : ''}
      ${d.source ? `<div class="src">${ui('route')} ${d.source}</div>` : ''}${d.warn ? `<div class="warn small">${d.warn}</div>` : ''}${o.actions ? `<div class="sep"></div>${o.actions}` : ''}</div></div>`;
}

export function bar(frac: number, cls = ''): string {
  return `<span class="bar ${cls}"><i style="width:${Math.max(0, Math.min(1, frac || 0)) * 100}%"></i></span>`;
}
/** A range inside a wider scale, with an optional pin (where a roll landed) and notch (a floor raised by skill). */
export function rangeBar(min: number, max: number, lo: number, hi: number, o: { pin?: number; notch?: number } = {}): string {
  const at = (v: number) => `${Math.max(0, Math.min(1, (v - min) / Math.max(1, max - min))) * 100}%`;
  return `<div class="range"><i style="left:${at(lo)};right:calc(100% - ${at(hi)})"></i>${o.notch !== undefined ? `<s style="left:${at(o.notch)}"></s>` : ''}${o.pin !== undefined ? `<u style="left:${at(o.pin)}"></u>` : ''}</div>
    <div class="range-ends"><span>${min}</span><span>${max}</span></div>`;
}
/** A level ring: number inside, arc for progress to the next level. */
export function ring(frac: number, lvl: number | string, d = 96, label = 'Level', color = 'var(--ring)'): string {
  const r = 44;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, frac || 0));
  return `<span class="ringt" style="--d:${d}px"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="none" stroke="#2a2823" stroke-width="6"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c * f} ${c}"/></svg><span class="in">${label ? `<small>${label}</small>` : ''}<b>${lvl}</b></span></span>`;
}
export function pips(n: number, max: number): string {
  return `<span class="pips" aria-label="${n} of ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
}
export function chip(text: string, icon = '', cls = ''): string {
  return `<span class="chip ${cls}">${icon ? ic(icon) : ''}${text}</span>`;
}
export function req(ok: boolean, text: string): string {
  return `<div class="req ${ok ? 'ok' : 'bad'}">${ui(ok ? 'check' : 'cross')}<span>${text}</span></div>`;
}
export function note(text: string, bad = false): string {
  return text ? `<p class="note${bad ? ' bad' : ''}" role="status">${text}</p>` : '';
}

/** How many times a cost can be paid from the bank and purse. */
export function affordable(p: M.Profile, cost: Record<string, number>, coin = 0): number {
  let n = coin > 0 ? Math.floor(p.coin / coin) : 999;
  for (const [id, need] of Object.entries(cost)) if (need > 0) n = Math.min(n, Math.floor((p.bank[id] ?? 0) / need));
  return Math.max(0, n);
}
/** The first thing that is missing, in words: "12 more iron ore". */
export function shortfall(p: M.Profile, cost: Record<string, number>, coin = 0, qty = 1): string | null {
  for (const [id, need] of Object.entries(cost)) {
    const miss = need * qty - (p.bank[id] ?? 0);
    if (miss > 0) return `${miss} more ${MATS[id].name.toLowerCase()}`;
  }
  if (p.coin < coin * qty) return `${coin * qty - p.coin} more coin`;
  return null;
}
/** Ingredient slots: icon, owned / needed, and where a missing material comes from. */
export function costSlots(p: M.Profile, cost: Record<string, number>, coin = 0, qty = 1): string {
  const rows = Object.entries(cost).map(([id, n]) => {
    const have = p.bank[id] ?? 0;
    const need = n * qty;
    const short = have < need;
    return `<div class="slot${short ? ' short' : ''}">${tile(describeMat(id, { p }), { size: 'sm' })}<div class="grow"><div class="lab">${MATS[id].cat === 'part' ? 'Part' : MATS[id].cat}</div><div class="cnt"><b>${have}</b> / ${need} <span class="small dim" style="font-family:var(--sans)">${MATS[id].name}</span></div>${short ? `<div class="small dim">${matSource(id)}</div>` : ''}</div></div>`;
  });
  if (coin > 0) {
    const need = coin * qty;
    rows.push(`<div class="slot${p.coin < need ? ' short' : ''}"><span class="tile sm static">${I.uiIcon('coin')}</span><div class="grow"><div class="lab">Fee</div><div class="cnt"><b>${p.coin}</b> / ${need} <span class="small dim" style="font-family:var(--sans)">coin</span></div>${p.coin < need ? '<div class="small dim">Paid for every wave cleared; surplus materials sell in the inventory</div>' : ''}</div></div>`);
  }
  return rows.join('');
}
export const rarityWord = (r: number) => RARITY_NAME[r] ?? '';

// ------------------------------------------------- one pane at a time (phones)
/** True where a station or the inventory shows one pane at a time and the page itself scrolls. */
export const onePane = () => matchMedia('(max-width: 900px)').matches;
/** How far the page is scrolled now. */
export const pageScroll = () => document.querySelector<HTMLElement>('#overlay .body')?.scrollTop ?? 0;
/** Once the screen has re-rendered (which keeps the old scroll), put the page at `y`: a newly shown pane starts at its top. */
export function scrollPageAfter(y: number): void {
  queueMicrotask(() => {
    const m = document.querySelector<HTMLElement>('#overlay .body');
    if (m) m.scrollTop = y;
  });
}

// ---------------------------------------------------------------- tooltips
/** Hover tooltips on desktop; on touch, a tap on a tile that has no action of its own pins the tooltip, and a tap anywhere closes it. */
export class Tips {
  private el: HTMLDivElement;
  private pinned: Element | null = null;
  constructor(root: HTMLElement, private resolve: (ref: string, el: HTMLElement) => string) {
    this.el = document.createElement('div');
    this.el.id = 'tip';
    this.el.hidden = true;
    this.el.setAttribute('role', 'tooltip');
    document.body.appendChild(this.el);
    const hover = matchMedia('(hover: hover)');
    root.addEventListener('mouseover', (e) => {
      if (!hover.matches || this.pinned) return;
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      if (t) this.show(t);
      else this.hide();
    });
    root.addEventListener('mouseleave', () => !this.pinned && this.hide());
    root.addEventListener('focusin', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      if (t && t.matches(':focus-visible')) this.show(t);
    });
    root.addEventListener('focusout', () => !this.pinned && this.hide());
    document.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
      // a tile inside a button belongs to the button: the tap acts, and the screen it re-renders would hide a pinned tip at once
      if (t && !t.closest('[data-a]') && !hover.matches && t !== this.pinned && root.contains(t)) {
        this.show(t);
        this.pinned = t;
        // a pinned tip takes the tap that closes it, so that tap cannot land on the button underneath
        this.el.style.pointerEvents = 'auto';
      } else {
        this.pinned = null;
        if (!hover.matches || !t) this.hide();
      }
    }, true);
    // a pinned tip taller than a phone held sideways scrolls inside itself; any other scroll closes it
    addEventListener('scroll', (e) => !this.el.contains(e.target as Node) && this.hide(), true);
    addEventListener('resize', () => this.hide()); // a turned phone: the tip would point at where the tile was
  }
  hide(): void {
    this.el.hidden = true;
    this.el.style.pointerEvents = '';
    this.pinned = null;
  }
  private show(t: HTMLElement): void {
    if (t.classList.contains('sel')) return this.hide(); // the selected tile is already shown in full beside the grid
    const html = this.resolve(t.dataset.tip!, t);
    if (!html) return this.hide();
    this.el.innerHTML = html;
    this.el.hidden = false;
    const r = t.getBoundingClientRect();
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    let x = r.right + 10;
    if (x + w > innerWidth - 8) x = r.left - w - 10;
    if (x < 8) x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    let y = r.top;
    if (x < r.right && x + w > r.left) y = r.bottom + 8; // could not fit beside it: go below, or above
    if (y + h > innerHeight - 8) y = x < r.right && x + w > r.left ? Math.max(8, r.top - h - 8) : Math.max(8, innerHeight - h - 8);
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
  }
}
