// Small DOM helpers shared by the HUD, the bench and the run-end screen.
import { spriteElement, type Icon } from '../art/index.ts';

export type Kid = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k) e.append(k);
  return e;
}

export const ic = (i: Icon, large = false): HTMLCanvasElement => spriteElement(large ? i.l : i.s);

/** An icon drawn smaller than it was baked (HUD slots, phone rows). */
export function icSized(i: Icon, px: number): HTMLCanvasElement {
  const c = spriteElement(i.s);
  c.style.width = `${px}px`;
  c.style.height = `${px}px`;
  return c;
}

export function tier(n: number): HTMLElement {
  const t = el('span', 'tier', el('i'), el('i'), el('i'), el('i'));
  t.dataset.tier = String(n);
  t.setAttribute('aria-label', `tier ${n}`);
  return t;
}

export function cost(i: Icon, n: number | string, lack = false, label = ''): HTMLElement {
  const c = el('span', lack ? 'cost lack' : 'cost', ic(i), el('span', 'num', String(n)));
  if (label) c.setAttribute('aria-label', `${n} ${label}${lack ? ', not enough' : ''}`);
  return c;
}

export function stamp(label: Kid, cls = '', ...kids: Kid[]): HTMLButtonElement {
  const b = el('button', `stamp ${cls}`.trim(), label, ...kids);
  b.type = 'button';
  return b;
}

/** "1:07" from seconds. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const cap = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** "3 timber, 2 ore" from a bag; "" if empty. */
export function rawsText(bag: { timber: number; ore: number; hide: number }): string {
  const parts: string[] = [];
  if (bag.timber) parts.push(`${bag.timber} timber`);
  if (bag.ore) parts.push(`${bag.ore} ore`);
  if (bag.hide) parts.push(`${bag.hide} hide`);
  return parts.join(', ');
}

/** Local settings that are not the audio kit's: only the shake toggle. */
const SHAKE_KEY = 'scrip.shake';
export function loadShake(): boolean {
  try {
    const v = localStorage.getItem(SHAKE_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    // blocked storage: fall through to the default
  }
  return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
export function saveShake(on: boolean): void {
  try {
    localStorage.setItem(SHAKE_KEY, on ? '1' : '0');
  } catch {
    // not persisted
  }
}
