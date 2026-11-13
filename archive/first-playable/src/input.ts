// Keyboard + mouse, and touch (left thumb moves, right thumb holds to swing and drags to aim).
import type { Input } from './game';

interface Stick {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

export class InputMgr {
  touchMode = false;
  joy: Stick | null = null;
  aim: Stick | null = null;
  private keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private mouseDown = false;
  private dodgeQueued = false;

  constructor(canvas: HTMLCanvasElement) {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.dodgeQueued = true;
        e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.reset());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.pointerType === 'touch') {
        this.touchMode = true;
        const b = this.dodgeButton();
        if (Math.hypot(e.clientX - b.x, e.clientY - b.y) < b.r + 14) {
          this.dodgeQueued = true;
        } else if (e.clientX < innerWidth / 2) {
          if (!this.joy) this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        } else if (!this.aim) {
          this.aim = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        }
        return;
      }
      this.touchMode = false;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.dodgeQueued = true;
    });
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        for (const s of [this.joy, this.aim]) {
          if (s && s.id === e.pointerId) {
            s.x = e.clientX;
            s.y = e.clientY;
          }
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

  reset(): void {
    this.keys.clear();
    this.joy = null;
    this.aim = null;
    this.mouseDown = false;
    this.dodgeQueued = false;
  }

  dodgeButton(): { x: number; y: number; r: number } {
    return { x: innerWidth - 64, y: innerHeight - 64, r: 36 };
  }

  /** playerSx/Sy: where the player is on screen, to turn the mouse position into an aim. */
  sample(playerSx: number, playerSy: number): Input {
    const k = this.keys;
    let mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let my = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    const out: Input = { mx, my, ax: 1, ay: 0, hasAim: false, heavy: false, dodge: this.dodgeQueued };

    if (this.touchMode) {
      if (this.joy) {
        mx = (this.joy.x - this.joy.ox) / 48;
        my = (this.joy.y - this.joy.oy) / 48;
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
    if (l > 1) {
      out.hasAim = true;
      out.ax = dx / l;
      out.ay = dy / l;
    }
    out.heavy = this.mouseDown;
    return out;
  }

  /** Call after a simulation step has used the sampled input. */
  consume(): void {
    this.dodgeQueued = false;
  }
}
