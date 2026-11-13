// Keyboard + mouse, and touch (left thumb moves; right thumb holds to swing and drags to aim; buttons for the rest).
import type { Input } from './game';

export type Action = 'move' | 'aim' | 'heavy' | 'dodge' | 'ability' | 'swap' | 'pause' | 'mute';
export interface Binding {
  id: Action;
  name: string;
  keys: string[]; // key caps as printed on the HUD and the help screen
  codes: string[]; // KeyboardEvent.code values
  mouse: string; // what the mouse does for this action, '' if nothing
  touch: string; // the touch gesture, '' if there is none
}
/** Every control in the game. The handlers below and in main.ts read their keys from here, so this list cannot go stale. */
export const BINDINGS: Binding[] = [
  { id: 'move', name: 'Move', keys: ['W', 'A', 'S', 'D', 'Arrows'], codes: ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'], mouse: '', touch: 'Left thumb: drag anywhere on the left half' },
  { id: 'aim', name: 'Aim', keys: [], codes: [], mouse: 'Move the mouse', touch: 'Drag the thumb that holds SWING (no drag: it aims at what is in reach)' },
  { id: 'heavy', name: 'Heavy swing (mines, breaks shields)', keys: [], codes: [], mouse: 'Hold the left button until the ring is gold, then release', touch: 'Hold the SWING button until the ring is gold, then lift' },
  { id: 'dodge', name: 'Dodge', keys: ['Space', 'Shift'], codes: ['Space', 'ShiftLeft', 'ShiftRight'], mouse: '', touch: 'DODGE button, or slide the thumb from SWING onto it' },
  { id: 'ability', name: 'Ability', keys: ['E', 'F'], codes: ['KeyE', 'KeyF'], mouse: 'Right button', touch: 'Ability button' },
  { id: 'swap', name: 'Swap ability', keys: ['Q'], codes: ['KeyQ'], mouse: '', touch: 'SWAP button' },
  { id: 'pause', name: 'Pause', keys: ['Esc', 'P'], codes: ['Escape', 'KeyP'], mouse: 'Pause button, top left', touch: 'Pause button, top left' },
  { id: 'mute', name: 'Sound on / off', keys: ['M'], codes: ['KeyM'], mouse: '', touch: '' },
];
const CODES: Record<string, Action> = {};
for (const b of BINDINGS) for (const c of b.codes) CODES[c] = b.id;
/** Which action a KeyboardEvent.code is bound to, if any. */
export const actionOf = (code: string): Action | undefined => CODES[code];
/** The first key cap of an action, for labels on the HUD. */
export const keyCap = (id: Action): string => BINDINGS.find((b) => b.id === id)?.keys[0] ?? '';

/** Size of HUD elements relative to a 1280 x 800 window. The world view does not change with the window; the HUD must. */
export function uiScale(w = innerWidth, h = innerHeight): number {
  return Math.max(0.8, Math.min(2, Math.sqrt((w * h) / 1024000)));
}

interface Stick {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
}
/** A HUD control: a circle of radius r on touch, a square of half-side r on desktop. */
export interface Btn {
  x: number;
  y: number;
  r: number;
}
export interface Layout {
  swing: Btn; // touch only
  dodge: Btn;
  ability: Btn;
  swap: Btn;
  pause: Btn;
  stick: Btn; // touch only: where the move stick rests while no thumb is down
  slots: { x: number; y: number; cell: number; gap: number; cols: number }; // top-left of the weapon pips
}
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
const STICK_R = 48; // travel of the move stick, CSS px
const STICK_EDGE = 60; // the stick's centre keeps this far from any screen edge, so it can be pushed every way

/** The notch and home-indicator insets, read from CSS env() through a hidden element. */
function readSafeArea(): Insets {
  if (typeof document === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 };
  let el = document.getElementById('cw-safe');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cw-safe';
    el.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;inset:0 auto auto 0;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(el);
  }
  const cs = getComputedStyle(el);
  const n = (v: string) => parseFloat(v) || 0;
  return { top: n(cs.paddingTop), right: n(cs.paddingRight), bottom: n(cs.paddingBottom), left: n(cs.paddingLeft) };
}

export class InputMgr {
  touchMode = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  joy: Stick | null = null;
  aim: Stick | null = null;
  mouseX = -1;
  mouseY = -1;
  /** Which controls the current wave has; the HUD sets it, and hidden ones take no clicks. */
  shown = { dodge: true, ability: true, swap: true };
  /** Notch and home-indicator insets in CSS px; every control and the HUD stay inside them. */
  safe: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  /** A HUD note that a tap dismisses (the HUD sets the box while it shows one, and reads `dismissed`). */
  dismissBox: { x: number; y: number; w: number; h: number } | null = null;
  dismissed = false;
  private aimOnDodge = false; // the thumb holding SWING is over DODGE right now
  private live = false;
  private keys = new Set<string>();
  private mouseDown = false;
  private dodgeQ = false;
  private abilityQ = false;
  private abilityAuto = false; // the ability was clicked on its HUD tile: aim it for the player
  private swapQ = false;

  constructor(private canvas: HTMLCanvasElement) {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const a = actionOf(e.code);
      if (a === 'dodge') {
        this.dodgeQ = true;
        if (this.live) e.preventDefault();
      }
      if (a === 'ability') this.abilityQ = true;
      if (a === 'swap') this.swapQ = true;
      if (a === 'move' && this.live && e.code.startsWith('Arrow')) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.reset());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    const measure = () => {
      this.safe = readSafeArea();
    };
    measure();
    addEventListener('resize', measure);
    addEventListener('orientationchange', () => setTimeout(measure, 60));

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const b = this.buttons();
      if (e.pointerType === 'touch') {
        if (!this.touchMode) {
          this.touchMode = true;
          return; // the layout just changed under this finger: it must not land on a button it could not see
        }
        const d = this.dismissBox;
        if (d && e.clientX >= d.x && e.clientX <= d.x + d.w && e.clientY >= d.y && e.clientY <= d.y + d.h) {
          this.dismissed = true;
          return;
        }
        // Only buttons that are drawn take a touch, and the nearest one wins where two hit circles meet.
        const cand: [Btn, string][] = [[b.pause, 'pause'], [b.swing, 'swing']];
        if (this.shown.dodge) cand.push([b.dodge, 'dodge']);
        if (this.shown.ability) cand.push([b.ability, 'ability']);
        if (this.shown.swap) cand.push([b.swap, 'swap']);
        let hit = '';
        let best = Infinity;
        for (const [btn, name] of cand) {
          const dist = Math.hypot(e.clientX - btn.x, e.clientY - btn.y);
          if (dist < btn.r + 12 && dist - btn.r < best) {
            best = dist - btn.r;
            hit = name;
          }
        }
        if (hit === 'pause') document.dispatchEvent(new CustomEvent('cw-pause'));
        else if (hit === 'dodge') this.dodgeQ = true;
        else if (hit === 'ability') this.abilityQ = true;
        else if (hit === 'swap') this.swapQ = true;
        else if (hit === 'swing') {
          // hold to wind up, drag to aim, lift to strike
          if (!this.aim) this.aim = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
          this.aimOnDodge = false;
        } else if (e.clientX < innerWidth / 2 && !this.joy) {
          this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
          this.anchorStick(this.joy);
        }
        // anywhere else on the right half does nothing: a resting thumb must not hold a wind-up
        return;
      }
      this.touchMode = false;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      const on = (btn: Btn) => Math.abs(e.clientX - btn.x) <= btn.r + 3 && Math.abs(e.clientY - btn.y) <= btn.r + 3;
      if (e.button === 0) {
        // the HUD tiles are real buttons for the mouse too; a click on one never starts a swing
        if (on(b.pause)) document.dispatchEvent(new CustomEvent('cw-pause'));
        else if (this.shown.ability && on(b.ability)) this.abilityQ = this.abilityAuto = true;
        else if (this.shown.swap && on(b.swap)) this.swapQ = true;
        else this.mouseDown = true;
      }
      if (e.button === 2) this.abilityQ = true;
    });
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        if (this.joy && this.joy.id === e.pointerId) {
          const s = this.joy;
          s.x = e.clientX;
          s.y = e.clientY;
          // the stick follows the thumb: past its radius the centre is dragged along, so reversing answers at once
          const dx = s.x - s.ox;
          const dy = s.y - s.oy;
          const l = Math.hypot(dx, dy);
          if (l > STICK_R) {
            s.ox = s.x - (dx / l) * STICK_R;
            s.oy = s.y - (dy / l) * STICK_R;
          }
          this.anchorStick(s);
        }
        if (this.aim && this.aim.id === e.pointerId) {
          this.aim.x = e.clientX;
          this.aim.y = e.clientY;
          // sliding the thumb that holds SWING onto DODGE dodges, so two thumbs can move, wind up and dodge
          const db = this.buttons().dodge;
          const over = this.shown.dodge && Math.hypot(e.clientX - db.x, e.clientY - db.y) < db.r + 6;
          if (over && !this.aimOnDodge) this.dodgeQ = true;
          this.aimOnDodge = over;
        }
        return;
      }
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (this.joy?.id === e.pointerId) this.joy = null;
        if (this.aim?.id === e.pointerId) this.aim = null;
        return;
      }
      if (e.button === 0) this.mouseDown = false;
    };
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  }

  /** True while a wave is being played: only then do Space and the arrows belong to the game, and the HUD draws its own reticle. */
  get active(): boolean {
    return this.live;
  }
  set active(on: boolean) {
    if (on === this.live) return;
    this.live = on;
    this.canvas.style.cursor = on ? 'none' : '';
  }

  /** True if the mouse is over a HUD tile that takes clicks (the reticle turns into a pointer there). */
  overButton(): boolean {
    if (this.touchMode) return false;
    const b = this.buttons();
    const on = (btn: Btn) => Math.abs(this.mouseX - btn.x) <= btn.r + 3 && Math.abs(this.mouseY - btn.y) <= btn.r + 3;
    return on(b.pause) || (this.shown.ability && on(b.ability)) || (this.shown.swap && on(b.swap));
  }

  reset(): void {
    this.keys.clear();
    this.joy = null;
    this.aim = null;
    this.mouseDown = false;
    this.consume();
  }

  /** Keeps a stick's centre far enough from every edge that the thumb has room to push toward that edge. */
  private anchorStick(s: Stick): void {
    const lo = STICK_EDGE;
    s.ox = Math.max(this.safe.left + lo, Math.min(innerWidth - this.safe.right - lo, s.ox));
    s.oy = Math.max(this.safe.top + lo, Math.min(innerHeight - this.safe.bottom - lo, s.oy));
  }

  /**
   * How much of each screen edge the HUD and the controls cover, in CSS px. The camera keeps the character
   * out of these bands when it stops at an arena edge (the renderer divides by its scale).
   */
  viewPad(): Insets {
    const s = uiScale();
    const half = innerHeight / 2;
    // the top plate, the chip or boss bar under it, and room for the heat arc over the character;
    // never more than the half screen above the character, or the two bands would meet
    const top = Math.min(half - 40, this.safe.top + Math.round(135 * s) + 34);
    if (!this.touchMode) return { top, right: 0, bottom: 0, left: 0 };
    // Portrait: the stick and the buttons fill the bottom, so the band is below (buttons, a line for the step prompt, then
    // room for the bars under the character). Landscape: the character stands level with the buttons, so the bands are at the sides.
    // (75 on the right: the cooldown pip beside the bars must not run off the screen)
    if (innerHeight >= innerWidth) return { top, right: this.safe.right + 75, bottom: Math.min(half - 10, this.safe.bottom + 330), left: this.safe.left };
    return { top, right: this.safe.right + 262, bottom: Math.min(half - 10, this.safe.bottom + 150), left: this.safe.left + 160 };
  }

  /** Screen positions of the HUD controls. The ability button doubles as the cooldown display. */
  buttons(): Layout {
    const w = innerWidth;
    const h = innerHeight;
    const s = uiScale(w, h);
    const none: Btn = { x: -999, y: -999, r: 0 };
    if (this.touchMode) {
      // Everything for the right thumb sits in one cluster round SWING; the left thumb's stick floats.
      const R = w - this.safe.right;
      const B = h - this.safe.bottom;
      const plateW = Math.min(Math.round(520 * s), w - 16 - this.safe.left - this.safe.right);
      const roomLeft = (w - plateW) / 2 - this.safe.left >= 64; // is there space beside the top plate
      return {
        swing: { x: R - 84, y: B - 84, r: 46 },
        dodge: { x: R - 186, y: B - 58, r: 32 },
        ability: { x: R - 164, y: B - 156, r: 32 },
        swap: { x: R - 62, y: B - 182, r: 26 },
        pause: { x: this.safe.left + 30, y: this.safe.top + (roomLeft ? 30 : Math.round(99 * s) + 26), r: 17 },
        stick: { x: this.safe.left + 96, y: B - 96, r: STICK_R },
        // the weapon pips: beside the ability in portrait; in landscape a row along the bottom, left of DODGE,
        // because there the character can stand level with the cluster and its bars need that space
        slots: h >= w ? { x: R - 272, y: B - 173, cell: 20, gap: 3, cols: 3 } : { x: R - 374, y: B - 28, cell: 20, gap: 3, cols: 6 },
      };
    }
    const m = Math.round(14 * s);
    const ar = Math.round(31 * s);
    const sr = Math.round(27 * s);
    const cell = Math.round(22 * s);
    const gap = Math.max(2, Math.round(3 * s));
    const ability: Btn = { x: w - m - ar, y: h - m - ar, r: ar };
    const swap: Btn = { x: ability.x - ar - gap * 2 - sr, y: h - m - sr, r: sr };
    let left = w - m;
    if (this.shown.ability) left = ability.x - ar - gap * 2;
    if (this.shown.ability && this.shown.swap) left = swap.x - sr - gap * 2;
    return {
      swing: none,
      dodge: none,
      stick: none,
      ability,
      swap,
      pause: { x: m + Math.round(17 * s), y: m + Math.round(17 * s), r: Math.round(17 * s) },
      slots: { x: left - 6 * cell - 5 * gap - gap, y: h - m - cell, cell, gap, cols: 6 },
    };
  }

  sample(playerSx: number, playerSy: number, scale: number): Input {
    const k = this.keys;
    let mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let my = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    const out: Input = { mx, my, ax: 1, ay: 0, hasAim: false, aimDist: 0, heavy: false, dodge: this.dodgeQ, ability: this.abilityQ, swap: this.swapQ };

    if (this.touchMode) {
      if (this.joy) {
        mx = (this.joy.x - this.joy.ox) / STICK_R;
        my = (this.joy.y - this.joy.oy) / STICK_R;
        const l = Math.hypot(mx, my);
        if (l < 0.18) mx = my = 0;
        else if (l > 1) {
          mx /= l;
          my /= l;
        }
        out.mx = mx;
        out.my = my;
      }
      if (this.aim) {
        out.heavy = true;
        const dx = this.aim.x - this.aim.ox;
        const dy = this.aim.y - this.aim.oy;
        const l = Math.hypot(dx, dy);
        if (l > 16) {
          out.hasAim = true;
          out.ax = dx / l;
          out.ay = dy / l;
        }
      }
      return out;
    }
    const dx = this.mouseX - playerSx;
    const dy = this.mouseY - playerSy;
    const l = Math.hypot(dx, dy);
    if (l > 1 && this.mouseX >= 0 && !(this.abilityAuto && this.abilityQ)) {
      out.hasAim = true;
      out.ax = dx / l;
      out.ay = dy / l;
      out.aimDist = l / scale;
    }
    out.heavy = this.mouseDown;
    return out;
  }

  /** For pausing: drop touches and the mouse button, but keep keys that are still held down. */
  release(): void {
    this.joy = null;
    this.aim = null;
    this.mouseDown = false;
    this.consume();
  }

  /** Call after a simulation step has used the sampled input. */
  consume(): void {
    this.dodgeQ = false;
    this.abilityQ = false;
    this.abilityAuto = false;
    this.swapQ = false;
  }
}
