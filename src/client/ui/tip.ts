// Tooltips. Any element with data-tip gets one: shown on hover with a mouse,
// on keyboard focus, and on touch by a tap (plain text, a disabled button)
// or a long press (a live button, so the tap still presses it).
// A native title is taken over the first time the pointer meets it, so old
// title= tooltips look the same and also work on a phone.

import { GLOSS, type GlossKey } from './glossary.ts';

const HOVER_MS = 280;
const WARM_MS = 600; // after one tip, the next shows at once
const LONG_MS = 450;
const GAP = 8;

let box: HTMLDivElement | null = null;
let shownFor: HTMLElement | null = null;
let hoverTimer = 0;
let longTimer = 0;
let lastHidden = 0;
let swallowClick = false;

/** Give an element a tooltip. Empty text removes it. */
export function setTip<T extends HTMLElement>(e: T, text: string): T {
  if (text) e.dataset.tip = text;
  else delete e.dataset.tip;
  e.removeAttribute('title');
  if (shownFor === e) place(e);
  return e;
}

/** A game word with its meaning under it: dotted underline, tap or hover to read. */
export function term(text: string, key: GlossKey, cls = ''): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = `term ${cls}`.trim();
  s.textContent = text;
  s.dataset.tip = GLOSS[key];
  s.tabIndex = 0;
  return s;
}

/** Tip an element with a glossary entry. */
export const glossTip = <T extends HTMLElement>(e: T, key: GlossKey): T => setTip(e, GLOSS[key]);

const INTERACTIVE = 'button, a[href], input, select, textarea, summary, [role="tab"]';

function tipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const t = node.closest<HTMLElement>('[data-tip], [title]');
  if (!t) return null;
  // Take over a native title so the browser's own box does not show as well.
  if (!t.dataset.tip && t.title) {
    t.dataset.tip = t.title;
    t.removeAttribute('title');
  }
  return t.dataset.tip ? t : null;
}

function ensureBox(): HTMLDivElement {
  if (box?.isConnected) return box;
  box = document.createElement('div');
  box.className = 'tipbox';
  box.id = 'tipbox';
  box.setAttribute('role', 'tooltip');
  box.hidden = true;
  document.body.append(box);
  return box;
}

function place(t: HTMLElement): void {
  const b = ensureBox();
  b.textContent = t.dataset.tip ?? '';
  b.hidden = false;
  b.style.left = '0px';
  b.style.top = '0px';
  const r = t.getBoundingClientRect();
  const w = b.offsetWidth;
  const h = b.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const left = Math.max(GAP, Math.min(vw - w - GAP, r.left + r.width / 2 - w / 2));
  let top = r.top - h - GAP;
  const below = top < GAP;
  if (below) top = r.bottom + GAP;
  b.classList.toggle('is-below', below);
  b.style.left = `${Math.round(left)}px`;
  b.style.top = `${Math.round(top)}px`;
}

function show(t: HTMLElement): void {
  if (shownFor && shownFor !== t) shownFor.removeAttribute('aria-describedby');
  shownFor = t;
  place(t);
  t.setAttribute('aria-describedby', 'tipbox');
  watch();
}

export function hideTip(): void {
  clearTimeout(hoverTimer);
  if (!shownFor) return;
  shownFor.removeAttribute('aria-describedby');
  shownFor = null;
  if (box) box.hidden = true;
  lastHidden = performance.now();
}

// Pages are rebuilt on every change: a tip whose element is gone goes too.
function watch(): void {
  const tick = () => {
    if (!shownFor) return;
    if (!shownFor.isConnected || !shownFor.dataset.tip) return hideTip();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const isLive = (t: HTMLElement): boolean => {
  const i = t.closest<HTMLElement>(INTERACTIVE);
  return !!i && !(i as HTMLButtonElement).disabled;
};

let installed = false;
export function installTips(): void {
  if (installed) return;
  installed = true;

  document.addEventListener('pointerover', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const t = tipTarget(ev.target);
    if (!t || t === shownFor) return;
    clearTimeout(hoverTimer);
    const warm = shownFor !== null || performance.now() - lastHidden < WARM_MS;
    if (warm) show(t);
    else hoverTimer = window.setTimeout(() => t.isConnected && t.matches(':hover') && show(t), HOVER_MS);
  });
  document.addEventListener('pointerout', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const from = tipTarget(ev.target);
    const to = tipTarget(ev.relatedTarget);
    if (from && from !== to) {
      clearTimeout(hoverTimer);
      if (shownFor === from && !from.contains(document.activeElement)) hideTip();
    }
  });

  document.addEventListener('pointerdown', (ev) => {
    clearTimeout(longTimer);
    const t = tipTarget(ev.target);
    if (ev.pointerType === 'mouse') {
      if (!t || !isLive(t)) return;
      return hideTip(); // pressing a button puts its tip away
    }
    if (!t) return hideTip();
    // In play a touch anywhere steers; a counter under the thumb is not a question.
    if (t.closest('.g-hud')) return hideTip();
    if (!isLive(t)) {
      if (shownFor === t) hideTip();
      else show(t);
      return;
    }
    hideTip();
    longTimer = window.setTimeout(() => {
      swallowClick = true;
      show(t);
    }, LONG_MS);
  });
  const cancelLong = () => clearTimeout(longTimer);
  document.addEventListener('pointerup', cancelLong);
  document.addEventListener('pointercancel', cancelLong);
  // A long press read the tip; it should not also press the button.
  document.addEventListener(
    'click',
    (ev) => {
      if (!swallowClick) return;
      swallowClick = false;
      ev.preventDefault();
      ev.stopImmediatePropagation();
    },
    true,
  );
  document.addEventListener('contextmenu', (ev) => {
    if (shownFor && ev.target instanceof Node && shownFor.contains(ev.target)) ev.preventDefault();
  });

  document.addEventListener('focusin', (ev) => {
    const t = tipTarget(ev.target);
    if (t && (ev.target as HTMLElement).matches(':focus-visible')) show(t);
  });
  document.addEventListener('focusout', (ev) => {
    if (shownFor && ev.target instanceof Node && shownFor.contains(ev.target)) hideTip();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && shownFor) hideTip();
  });
  window.addEventListener('scroll', hideTip, { capture: true, passive: true });
  window.addEventListener('resize', hideTip);
}
