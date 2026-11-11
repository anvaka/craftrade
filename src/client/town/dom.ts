// Small DOM helpers and the pieces every page shares: stamps, tier marks,
// charge pips, item rows, steppers. No framework; a page is rebuilt from
// state when something changes.

import { effectText, itemTier, type ItemSpec } from '../../shared/item.ts';
import { spriteElement, type Icon, type Sprite, type Sprites } from '../art/index.ts';
import { audio, type SoundId } from '../audio/index.ts';

export type Kid = Node | string | number | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k !== null && k !== undefined && k !== false) e.append(typeof k === 'number' ? String(k) : k);
  return e;
}

let S: Sprites;
export function setSprites(s: Sprites): void {
  S = s;
}
export const sprites = (): Sprites => S;

export const icon = (i: Icon, large = false): HTMLCanvasElement => spriteElement(large ? i.l : i.s);
export const sprite = (s: Sprite): HTMLCanvasElement => spriteElement(s);

export const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

export function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${fmt(n)}th`;
  return `${fmt(n)}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${fmt(n)} ${n === 1 ? one : many}`;

export interface StampOpts {
  cls?: string;
  /** Stable name so focus survives a redraw. */
  key?: string;
  sound?: SoundId | null;
  disabled?: boolean;
  /** Tooltip: the number and nothing else. */
  title?: string;
  onClick?: (ev: MouseEvent) => void;
}

export function stamp(label: Kid | Kid[], o: StampOpts = {}): HTMLButtonElement {
  const kids = Array.isArray(label) ? label : [label];
  const b = el('button', `stamp ${o.cls ?? ''}`.trim(), ...kids);
  b.type = 'button';
  if (o.key) b.dataset.fk = o.key;
  if (o.title) b.title = o.title;
  if (o.disabled) b.disabled = true;
  b.addEventListener('click', (ev) => {
    if (o.sound !== null) audio.play(o.sound ?? 'stamp');
    o.onClick?.(ev);
  });
  return b;
}

/** Four leaning notches, n inked. */
export function tier(n: number): HTMLElement {
  const t = el('span', 'tier', el('i'), el('i'), el('i'), el('i'));
  t.dataset.tier = String(n);
  t.setAttribute('role', 'img');
  t.setAttribute('aria-label', `tier ${n}`);
  return t;
}

/** Square pips: n of `of` inked. Used for charges and station tiers. */
export function pips(n: number, of: number, what: string): HTMLElement {
  const p = el('span', 'pips');
  for (let i = 0; i < of; i++) p.append(el('i', i < n ? 'on' : ''));
  p.setAttribute('role', 'img');
  p.setAttribute('aria-label', `${n} of ${of} ${what}`);
  p.title = `${n} of ${of}`;
  return p;
}

export function effectList(item: ItemSpec): HTMLElement {
  const ul = el('ul', 'effects');
  for (const e of item.effects) {
    const text = effectText(e);
    if (text) ul.append(el('li', e.neg ? 'cost' : '', text));
  }
  return ul;
}

/** The finder of an item: the reader in Ochre, anyone else in Woad, a bench recipe in italics. */
export function finder(by: string | undefined, me: string): HTMLElement {
  if (!by) return el('span', 'note', 'bench recipe');
  return by === me ? el('span', 'own', by) : el('span', 'who', by);
}

export function itemIcon(item: ItemSpec, large = false): HTMLCanvasElement {
  const g = S.icon.glyph[item.glyph] ?? S.icon.glyph.sack;
  return icon(g, large);
}

/** Icon and name on one line, for table cells. */
export function thing(ic: Node, ...kids: Kid[]): HTMLElement {
  return el('div', 'thing', ic, el('span', '', ...kids));
}

/**
 * One item as a ruled row: icon | name, tier, effect lines, extra | actions.
 * Uses the kit's .offer layout.
 */
export function itemRow(item: ItemSpec, o: { meta?: Kid[]; actions?: Kid[]; cls?: string } = {}): HTMLLIElement {
  return el(
    'li',
    `offer ${o.cls ?? ''}`.trim(),
    itemIcon(item, true),
    el('div', 'name', el('span', '', item.name), tier(itemTier(item)), ...(o.meta ?? [])),
    effectList(item),
    o.actions?.length ? el('div', 'buy', ...o.actions) : null,
  );
}

export interface StepperOpts {
  value: number;
  min?: number;
  max: number;
  key: string;
  label: string;
  onChange: (n: number) => void;
}

/** A quantity: minus, figure, plus. Typing a number works too. */
export function stepper(o: StepperOpts): HTMLElement {
  const min = o.min ?? 0;
  const clamp = (n: number) => Math.max(min, Math.min(o.max, Math.round(Number.isFinite(n) ? n : min)));
  const input = el('input', 'step-n num');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.value = String(clamp(o.value));
  input.dataset.fk = `${o.key}:n`;
  input.setAttribute('aria-label', o.label);
  const set = (n: number, fromTyping = false) => {
    const v = clamp(n);
    if (!fromTyping || String(v) !== input.value) input.value = String(v);
    minus.disabled = v <= min;
    plus.disabled = v >= o.max;
    o.onChange(v);
  };
  const bump = (d: number) => (ev: MouseEvent) => set(clamp(Number(input.value)) + d * (ev.shiftKey ? 10 : 1));
  const minus = stamp('−', { cls: 'stamp--plain stamp--small step-b', key: `${o.key}:-`, sound: 'lock', onClick: bump(-1) });
  const plus = stamp('+', { cls: 'stamp--plain stamp--small step-b', key: `${o.key}:+`, sound: 'lock', onClick: bump(1) });
  minus.setAttribute('aria-label', `Less ${o.label}`);
  plus.setAttribute('aria-label', `More ${o.label}`);
  minus.disabled = clamp(o.value) <= min;
  plus.disabled = clamp(o.value) >= o.max;
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D+/g, '');
    if (digits !== input.value) input.value = digits;
    if (digits !== '') set(Number(digits), true);
  });
  input.addEventListener('blur', () => set(Number(input.value)));
  input.addEventListener('focus', () => input.select());
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      set(clamp(Number(input.value)) + (ev.key === 'ArrowUp' ? 1 : -1) * (ev.shiftKey ? 10 : 1));
    }
  });
  return el('span', 'step', minus, input, plus);
}

/** An empty state: one italic line that says what will be here and how. */
export const empty = (text: string): HTMLElement => el('p', 'empty note', text);

/** Copy text to the clipboard. Falls back to a hidden field for old or locked-down browsers. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the field
  }
  try {
    const t = el('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed';
    t.style.top = '0';
    t.style.left = '-999px';
    document.body.append(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  } catch {
    return false;
  }
}
