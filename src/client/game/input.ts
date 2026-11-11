// Movement input: keyboard, a floating touch stick, a gamepad's left stick.
// The sim takes one vector of length 0..1 per tick.
import { el } from './dom.ts';

const LEFT = ['KeyA', 'ArrowLeft'], RIGHT = ['KeyD', 'ArrowRight'], UP = ['KeyW', 'ArrowUp'], DOWN = ['KeyS', 'ArrowDown'];
const MOVE_KEYS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);
const STICK_R = 44;
const DEAD = 0.16;

export interface MoveInput {
  /** Write this frame's move vector into out. */
  read(out: { mx: number; my: number }): void;
  /** Forget everything held (pause, blur, wave end). */
  reset(): void;
  /** True once the player has moved by any means. */
  used: boolean;
  destroy(): void;
}

export function createInput(stage: HTMLElement): MoveInput {
  const down = new Set<string>();
  let touchId = -1, ox = 0, oy = 0, tx = 0, ty = 0;
  const stick = el('div', 'stick g-stick', el('div', 'knob'));
  stick.hidden = true;
  stage.append(stick);

  const any = (codes: string[]): boolean => down.has(codes[0]!) || down.has(codes[1]!);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!MOVE_KEYS.has(e.code) || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    down.add(e.code);
    if (e.code.startsWith('Arrow') && !stage.hidden) e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent): void => { down.delete(e.code); };
  const clear = (): void => { down.clear(); spare.clear(); endTouch(); };

  function endTouch(): void {
    touchId = -1; tx = 0; ty = 0;
    stick.hidden = true;
  }
  // Other fingers resting on the clearing, and where each one is now. When the
  // steering finger lifts, the newest of these takes the stick over, so a
  // player can change thumbs without the character stopping dead for good.
  const spare = new Map<number, { x: number; y: number }>();
  function plant(id: number, x: number, y: number): void {
    touchId = id;
    ox = x; oy = y; tx = 0; ty = 0;
    stick.style.left = `${ox - 56}px`;
    stick.style.top = `${oy - 56}px`;
    stick.style.setProperty('--x', '0px');
    stick.style.setProperty('--y', '0px');
    stick.hidden = false;
  }
  const onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest('button, input, a, .g-overlay')) return;
    const r = stage.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (touchId !== -1) { spare.set(e.pointerId, { x, y }); e.preventDefault(); return; }
    plant(e.pointerId, x, y);
    e.preventDefault();
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== touchId) {
      const sp = spare.get(e.pointerId);
      if (sp) { const r = stage.getBoundingClientRect(); sp.x = e.clientX - r.left; sp.y = e.clientY - r.top; }
      return;
    }
    const r = stage.getBoundingClientRect();
    let dx = e.clientX - r.left - ox, dy = e.clientY - r.top - oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) {
      // The base follows a thumb that has run past the rim, so the stick never dead-ends.
      const over = d - STICK_R;
      ox += (dx / d) * over; oy += (dy / d) * over;
      stick.style.left = `${ox - 56}px`;
      stick.style.top = `${oy - 56}px`;
      dx = (dx / d) * STICK_R; dy = (dy / d) * STICK_R;
    }
    tx = dx / STICK_R; ty = dy / STICK_R;
    stick.style.setProperty('--x', `${dx}px`);
    stick.style.setProperty('--y', `${dy}px`);
  };
  const onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== touchId) { spare.delete(e.pointerId); return; }
    endTouch();
    let last = -1;
    for (const id of spare.keys()) last = id;
    if (last !== -1) {
      const sp = spare.get(last)!;
      spare.delete(last);
      plant(last, sp.x, sp.y);
    }
  };
  // iOS Safari: a touch that starts on the clearing must never scroll, zoom,
  // select or start an edge swipe. touch-action covers most of it; this covers the rest.
  const onTouch = (e: TouchEvent): void => {
    if (!(e.target as HTMLElement).closest('button, input, a, .g-overlay') && e.cancelable) e.preventDefault();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clear);
  stage.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  stage.addEventListener('touchstart', onTouch, { passive: false });
  stage.addEventListener('touchmove', onTouch, { passive: false });

  const self: MoveInput = {
    used: false,
    read(out) {
      let x = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
      let y = (any(DOWN) ? 1 : 0) - (any(UP) ? 1 : 0);
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      if (x === 0 && y === 0 && touchId !== -1) {
        const d = Math.hypot(tx, ty);
        if (d > DEAD) {
          // Past the dead zone the stick is close to full speed: a thumb is not a precise thing.
          const k = Math.min(1, 0.45 + ((d - DEAD) / (1 - DEAD)) * 0.75) / d;
          x = tx * k; y = ty * k;
        }
      }
      if (x === 0 && y === 0 && typeof navigator.getGamepads === 'function') {
        const pads = navigator.getGamepads();
        for (const pad of pads) {
          if (!pad || !pad.connected) continue;
          let gx = pad.axes[0] ?? 0, gy = pad.axes[1] ?? 0;
          const b = pad.buttons;
          if (b[14]?.pressed) gx = -1; else if (b[15]?.pressed) gx = 1;
          if (b[12]?.pressed) gy = -1; else if (b[13]?.pressed) gy = 1;
          const d = Math.hypot(gx, gy);
          if (d > 0.22) {
            const k = Math.min(1, (d - 0.22) / 0.7) / d;
            x = gx * k; y = gy * k;
            break;
          }
        }
      }
      if (x !== 0 || y !== 0) self.used = true;
      out.mx = x; out.my = y;
    },
    reset: clear,
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      stage.removeEventListener('touchstart', onTouch);
      stage.removeEventListener('touchmove', onTouch);
      stick.remove();
    },
  };
  return self;
}
