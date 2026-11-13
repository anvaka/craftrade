// Time of day: a full-screen multiply tint, with soft warm lights added into it before it is applied.
// Waves 1 to 4 are daylight (no tint), 5 to 8 dusk, 9 to 12 night. Night is blue-slate, never black.
import { canvas, sprite, type Ctx, type Sprite } from './util';

const DUSK = '#cdb49b';
const NIGHT = '#7d89a4';
const PAD = 24; // world units the light layer reaches past the view, so camera shake never shows an unlit strip
const PX = 0.25; // light pixels per screen pixel: light is soft, a quarter is plenty

export function ambientFor(waveIndex: number): string | null {
  return waveIndex < 4 ? null : waveIndex < 8 ? DUSK : NIGHT;
}

let lamp: Sprite | null = null;
function lampSprite(): Sprite {
  if (lamp) return lamp;
  lamp = sprite(128, 128, 64, 64, (c) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,236,206,1)');
    g.addColorStop(0.5, 'rgba(255,224,184,0.62)');
    g.addColorStop(1, 'rgba(255,214,170,0)');
    c.fillStyle = g;
    c.fillRect(-64, -64, 128, 128);
  }, 1);
  return lamp;
}

export class Lighting {
  private cv = canvas(4, 4);
  private c = this.cv.getContext('2d')!;
  private x0 = 0;
  private y0 = 0;
  private vw = 1;
  private vh = 1;
  on = false;

  /** Start a frame: the view rectangle in world units, and the ambient colour (null in daylight). */
  begin(camX: number, camY: number, vw: number, vh: number, screenW: number, screenH: number, ambient: string | null): void {
    this.on = ambient !== null;
    if (!ambient) return;
    const w = Math.max(4, Math.ceil(screenW * PX));
    const h = Math.max(4, Math.ceil(screenH * PX));
    if (this.cv.width !== w || this.cv.height !== h) {
      this.cv.width = w;
      this.cv.height = h;
    }
    this.vw = vw + PAD * 2;
    this.vh = vh + PAD * 2;
    this.x0 = camX - this.vw / 2;
    this.y0 = camY - this.vh / 2;
    const c = this.c;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = ambient;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'lighter';
    c.setTransform(w / this.vw, 0, 0, h / this.vh, (-this.x0 * w) / this.vw, (-this.y0 * h) / this.vh);
  }

  /** A warm light at a world position. */
  add(x: number, y: number, r: number, strength = 1): void {
    if (!this.on) return;
    if (x + r < this.x0 || y + r < this.y0 || x - r > this.x0 + this.vw || y - r > this.y0 + this.vh) return;
    const c = this.c;
    c.globalAlpha = strength;
    c.drawImage(lampSprite().c, x - r, y - r, r * 2, r * 2);
  }

  /** Multiply the light layer over the world. Call inside the world transform. */
  apply(c: Ctx): void {
    if (!this.on) return;
    c.globalCompositeOperation = 'multiply';
    c.imageSmoothingEnabled = true;
    c.drawImage(this.cv, this.x0, this.y0, this.vw, this.vh);
    c.globalCompositeOperation = 'source-over';
  }
}
