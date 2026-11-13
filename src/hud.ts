// Everything drawn over the arena that is not the world itself: bars at the character, the top HUD,
// edge markers, banners, step prompts, the reticle, touch controls. The world is drawn by render.ts.
//
// Rules this file follows:
//  - A wave asks the player to track position, health, stamina, heat, the wave beat and one cooldown.
//    The urgent ones are repeated at the character; the top plate carries the detail. The bag meter is the one addition.
//  - Flat panels (#14171c, 1 px #616c7a border, square corners), white sans text, red #9a0000 bars for critical alerts.
//  - Gold means "rich vein / reward" and nothing else.
import { CFG, GROUNDS, MATS, WEAPONS } from './data';
import type { Enemy, Game, GameEvent, OreNode } from './game';
import { keyCap, uiScale, type InputMgr } from './input';
import type { Renderer } from './render';

export const BEAT = { lull: '#3f8f78', swell: '#d9a92a', peak: '#d6453d' };

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const C = {
  panel: '#14171c', border: '#616c7a', track: '#232323', text: '#ffffff', soft: '#c9d1db', dim: '#9aa3ad',
  gold: '#f2c230', red: '#ff5a4d', crit: '#9a0000', green: '#5fd07a', pink: '#ff7ab8', armor: '#cfe8ff', amber: '#e8a23a',
  heat: '#ff8a3c', cool: '#8fb8d8', bag: '#b9c0c9',
};
const heatColor = (k: number) => `rgb(255,${Math.round(190 - 150 * k)},${Math.round(60 - 40 * k)})`;
const NODE_WORD = { ore: 'the ore', wood: 'a tree', herb: 'the reeds' };
/** The two marks on the heat bar and arc: the heat at which it brings +50% and +100% enemies. */
const HEAT_TICKS = [0.5, 1].map((more) => Math.pow(more / CFG.heat.spawnBonus, 1 / CFG.heat.curve));
/** A scrap amount as the rules hold it: whole where it is whole, else one decimal (12.5, not 13). */
const amt = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));

interface Banner { text: string; color: string; t: number; max: number; crit: boolean }
interface Gain { mat: string; n: number; hot: number; t: number }
interface Tag { text: string; color: string; t: number; max: number; x: number; y: number; atPlayer: boolean }
type Part = { k: string } | { t: string };
type StepId = 'move' | 'mine' | 'dodge' | 'shield' | 'ability' | 'swap' | 'pause';

export class Hud {
  /** Set by main.ts for a new player's first expeditions: step prompts that teach the controls and clear when done. */
  teach = false;
  /** Seconds of grace left after resuming from pause; main.ts counts it down, the HUD shows 3-2-1. */
  resume = 0;

  private g: Game | null = null;
  private touch = false;
  private s = 1; // HUD scale for this window
  private pauseBox = { x: 0, y: 0 }; // right and bottom edge of the pause button and its key cap
  private banners: Banner[] = [];
  private queue: Banner[] = [];
  private gains: Gain[] = [];
  private tags: Tag[] = [];
  private hurts: { x: number; y: number; t: number }[] = [];
  private staminaBlink = 0;
  private cdShake = 0;
  private cdReady = 0;
  private lastCd = 0;
  private heatPulse = 0;
  private lastHeat = 0;
  private beatFlash = 0;
  private bagWarned = false;
  private closeWarned = false;
  private noteText = '';
  private noteT = 0;
  private over: 'no' | 'cleared' | 'fell' = 'no';
  private overT = 0;
  // step prompts: what has been learned stays learned for the whole session
  private done: Record<StepId, boolean> = { move: false, mine: false, dodge: false, shield: false, ability: false, swap: false, pause: false };
  private armed: Record<StepId, boolean> = { move: true, mine: true, dodge: false, shield: false, ability: false, swap: false, pause: false };
  private shownFor: Record<StepId, number> = { move: 0, mine: 0, dodge: 0, shield: 0, ability: 0, swap: 0, pause: 0 };
  private dodgeAt = -9;
  private rotateT = 0; // the "turn your phone" note
  private rotateShown = false;
  private safe = { top: 0, right: 0, bottom: 0, left: 0 };
  private moved = 0;
  private lastP: [number, number] | null = null;
  private step: StepId | null = null;

  constructor(private r: Renderer) {}

  reset(g?: Game): void {
    this.g = g ?? null;
    this.banners = [];
    this.queue = [];
    this.gains = [];
    this.tags = [];
    this.hurts = [];
    this.staminaBlink = this.cdShake = this.cdReady = this.heatPulse = this.beatFlash = 0;
    this.lastCd = 0;
    this.lastHeat = g ? g.heat : 0;
    this.bagWarned = false;
    this.closeWarned = false;
    this.over = 'no';
    this.overT = 0;
    this.lastP = null;
    this.step = null;
  }

  /** A banner line. Up to three show at once; more wait their turn. */
  say(text: string, color: string, time = 1.8, crit = false): void {
    const same = this.banners.find((b) => b.text === text) ?? this.queue.find((b) => b.text === text);
    if (same) {
      same.t = same.max = time;
      return;
    }
    const b = { text, color, t: time, max: time, crit };
    if (this.banners.length < 3) this.banners.push(b);
    else this.queue.push(b);
  }

  /** A small, short note in the corner (sound on / off). */
  note(text: string): void {
    this.noteText = text;
    this.noteT = 1.6;
  }

  private tag(text: string, color: string, x = 0, y = 0, atPlayer = true, time = 0.9): void {
    const same = this.tags.find((t) => t.text === text && t.atPlayer === atPlayer);
    if (same) {
      same.t = same.max = time;
      return;
    }
    this.tags.push({ text, color, t: time, max: time, x, y, atPlayer });
  }

  onEvent(e: GameEvent, game?: Game): void {
    const g = game ?? this.g;
    switch (e.t) {
      case 'pickup': {
        const gn = this.gains.find((x) => x.mat === e.mat);
        if (gn) {
          gn.n++;
          gn.t = 1.1;
        } else this.gains.push({ mat: e.mat, n: 1, hot: 0, t: 1.1 });
        if (e.part) this.say(`PART COLLECTED: ${(MATS[e.mat]?.name ?? '').toUpperCase()}`, C.gold, 1.6);
        break;
      }
      case 'nodeStrike':
        this.done.mine = true;
        if (e.hot > 0 && e.mat) {
          const gn = this.gains.find((x) => x.mat === e.mat);
          if (gn) {
            gn.hot += e.hot;
            gn.t = 1.1;
          } else this.gains.push({ mat: e.mat, n: 0, hot: e.hot, t: 1.1 });
        }
        break;
      case 'closedVein':
        this.tag(g && g.beat === 'lull' ? 'OPENS IN THE SWELL' : 'VEIN CLOSED', '#b9a45a', e.x, e.y - 44, false, 1.3);
        break;
      case 'swept': {
        let n = 0;
        for (const [mat, k] of Object.entries(e.mats)) {
          n += k;
          const gn = this.gains.find((x) => x.mat === mat);
          if (gn) {
            gn.n += k;
            gn.t = 1.4;
          } else this.gains.push({ mat, n: k, hot: 0, t: 1.4 });
        }
        this.say(`${n} DROP${n > 1 ? 'S' : ''} ON THE GROUND COLLECTED`, C.soft, 1.4);
        break;
      }
      case 'hurt':
        this.hurts.push({ x: e.x, y: e.y, t: 0.5 });
        if (this.hurts.length > 4) this.hurts.shift();
        this.armed.dodge = true;
        break;
      case 'noStamina':
        this.staminaBlink = 0.5;
        this.tag('NO STAMINA', C.red);
        break;
      case 'early':
        if (this.r.t - this.dodgeAt > 0.8) this.tag('HOLD', C.text); // letting go after a dodge is not a mistake
        break;
      case 'notReady':
        this.cdShake = 0.35;
        break;
      case 'swap':
        if (g) {
          const def = WEAPONS[g.spec.abilities[g.abilityIdx]];
          this.tags = this.tags.filter((t) => !t.text.startsWith('ABILITY: '));
          this.tag(`ABILITY: ${def.ability.name.toUpperCase()}`, def.color, 0, 0, true, 1.2);
        }
        this.done.swap = true;
        break;
      case 'ability':
        this.done.ability = true;
        this.armed.swap = true;
        break;
      case 'dodge':
        this.done.dodge = true;
        this.dodgeAt = this.r.t;
        break;
      case 'shieldBreak':
        this.done.shield = true;
        break;
      case 'beat':
        this.beatFlash = 1;
        if (e.beat === 'peak') this.say('PEAK', C.text, 1.8, true);
        else if (e.beat === 'swell') this.say('SWELL', BEAT.swell);
        break;
      case 'richOpen': {
        // the swell line and the vein line are one message
        const sw = this.banners.find((b) => b.text === 'SWELL') ?? this.queue.find((b) => b.text === 'SWELL');
        if (sw) {
          sw.text = 'SWELL: RICH VEINS OPEN';
          sw.color = C.gold;
          sw.t = sw.max = 2.2;
        } else this.say('SWELL: RICH VEINS OPEN', C.gold, 2.2);
        break;
      }
      case 'richClose':
        this.say('RICH VEINS CLOSED', '#b9a45a', 2);
        break;
      case 'say':
        this.say(e.text, e.color, 2.2);
        break;
      case 'objective': {
        const got: string[] = [];
        if (e.scrap > 0) got.push(`+${amt(e.scrap)} SCRAP`);
        if (e.heal >= 0.5) got.push(`+${Math.round(e.heal)} HEALTH`); // what was healed, not what was offered
        this.say(got.length ? `OBJECTIVE DONE: ${got.join(', ')}` : 'OBJECTIVE DONE', C.green, 2.4);
        break;
      }
      case 'over':
        this.over = e.died ? 'fell' : 'cleared';
        this.overT = 0;
        if (e.died) {
          this.banners = [];
          this.queue = [];
          this.say(`FELLED BY ${(g?.killer?.name ?? 'the wave').toUpperCase()}`, C.text, 9, true);
        } else this.say('WAVE CLEARED', C.green, 1.4);
        break;
    }
  }

  update(dt: number): void {
    for (const b of this.banners) b.t -= dt;
    this.banners = this.banners.filter((b) => b.t > 0);
    while (this.banners.length < 3 && this.queue.length) this.banners.push(this.queue.shift()!);
    for (const x of this.gains) x.t -= dt;
    this.gains = this.gains.filter((x) => x.t > 0);
    for (const x of this.tags) x.t -= dt;
    this.tags = this.tags.filter((x) => x.t > 0);
    for (const x of this.hurts) x.t -= dt;
    this.hurts = this.hurts.filter((x) => x.t > 0);
    this.staminaBlink = Math.max(0, this.staminaBlink - dt);
    this.cdShake = Math.max(0, this.cdShake - dt);
    this.cdReady = Math.max(0, this.cdReady - dt);
    this.heatPulse = Math.max(0, this.heatPulse - dt);
    this.beatFlash = Math.max(0, this.beatFlash - dt * 1.2);
    this.noteT = Math.max(0, this.noteT - dt);
    this.rotateT = Math.max(0, this.rotateT - dt);
    if (this.over !== 'no') this.overT += dt;

    const g = this.g;
    if (!g || g.phase !== 'wave') return;
    if (g.heat > this.lastHeat + 1) this.heatPulse = 0.4;
    this.lastHeat = g.heat;
    if (this.lastCd > 0 && g.p.abilityCd <= 0) this.cdReady = 0.5;
    this.lastCd = g.p.abilityCd;
    if (!this.bagWarned && g.slow > 0.005 && g.waveT > 0.4) {
      this.bagWarned = true;
      this.say('BAG HEAVY: SLOWER', C.amber, 2.4);
    }
    const close = g.richCloseIn;
    if (!this.closeWarned && close <= 5 && close > 1.5) {
      this.closeWarned = true;
      this.say(`RICH VEINS CLOSE IN ${Math.ceil(close)}s`, C.gold, 1.6);
    }
    if (close > 6) this.closeWarned = false;
    if (this.teach) this.updateSteps(g, dt);
    else this.step = null;
  }

  // ---------------------------------------------------------------- step prompts

  private updateSteps(g: Game, dt: number): void {
    const p = g.p;
    if (this.lastP) this.moved += Math.hypot(p.x - this.lastP[0], p.y - this.lastP[1]);
    this.lastP = [p.x, p.y];
    if (this.moved > 90) this.done.move = true;
    const f = g.spec.feat;
    const canDodge = f.dodge && !g.spec.noDodge;
    const hasAbility = f.ability && g.spec.abilities.length > 0;
    let near = 0;
    for (const e of g.enemies) {
      if (!g.targetable(e)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 120 + e.r) this.armed.dodge = true;
      if (d < 170) near++;
      if (e.shield && !e.boss && d < 240) this.armed.shield = true;
    }
    if (hasAbility && near >= 3 && p.abilityCd <= 0) this.armed.ability = true;
    if (this.done.mine && this.done.move) this.armed.pause = true;

    const want = (id: StepId, ok = true, limit = 0): boolean => {
      if (!ok || this.done[id] || !this.armed[id]) return false;
      if (limit > 0 && this.shownFor[id] > limit) {
        this.done[id] = true;
        return false;
      }
      return true;
    };
    const next: StepId | null =
      want('dodge', canDodge, 8) ? 'dodge'
        : want('ability', hasAbility, 9) ? 'ability'
          : want('swap', hasAbility && g.spec.abilities.length > 1, 6) ? 'swap'
            : want('move') ? 'move'
              : want('shield', true, 9) ? 'shield'
                : want('mine', g.nodes.some((n) => n.alive && n.open && n.kind !== 'nest')) ? 'mine'
                  : want('pause', true, 5) ? 'pause'
                    : null;
    this.step = next;
    if (next) this.shownFor[next] += dt;
  }

  private stepParts(g: Game, id: StepId): Part[] {
    const ab = g.spec.abilities.length ? WEAPONS[g.spec.abilities[g.abilityIdx]].ability.name : '';
    const nextAb = g.spec.abilities.length > 1 ? WEAPONS[g.spec.abilities[(g.abilityIdx + 1) % g.spec.abilities.length]].ability.name : '';
    const what = NODE_WORD[GROUNDS[g.spec.ground].node];
    if (this.touch) {
      switch (id) {
        case 'move': return [{ t: 'Left thumb: drag to move' }];
        case 'mine': return [{ t: `Stand by ${what}. Hold` }, { k: 'SWING' }, { t: 'until gold, then lift' }];
        case 'dodge': return [{ k: 'DODGE' }, { t: 'slips through them' }];
        case 'shield': return [{ t: 'Shields break only to' }, { k: 'SWING' }];
        case 'ability': return [{ k: ab.toUpperCase() }, { t: 'when they crowd you' }];
        case 'swap': return [{ k: 'SWAP' }, { t: `switches to ${nextAb}` }];
        default: return [{ t: 'The button in the top left pauses' }];
      }
    }
    switch (id) {
      case 'move': return [{ k: 'W' }, { k: 'A' }, { k: 'S' }, { k: 'D' }, { t: 'move' }];
      case 'mine': return [{ t: 'Hold the' }, { k: 'Left mouse button' }, { t: `on ${what} until the ring is gold, then release` }];
      case 'dodge': return [{ k: keyCap('dodge') }, { t: 'dodge through them' }];
      case 'shield': return [{ t: 'Shields break only to the heavy swing: hold the' }, { k: 'Left mouse button' }, { t: 'then release' }];
      case 'ability': return [{ k: keyCap('ability') }, { t: `${ab}: use it when they crowd you` }];
      case 'swap': return [{ k: keyCap('swap') }, { t: `switch to ${nextAb}` }];
      default: return [{ k: keyCap('pause') }, { t: 'pause and controls' }];
    }
  }

  // ------------------------------------------------------------------ world layer

  /** Drawn inside the world transform, after the actors: everything that must stay glued to the character. */
  drawWorld(g: Game): void {
    this.g = g;
    const c = this.r.ctx;
    const p = g.p;
    const pc = CFG.player;
    // On a phone the world is drawn at about half desktop size. What is glued to the character is scaled up
    // round it so a bar is never thinner than about 8 px and text never smaller than about 12 px.
    const k = Math.max(1, 1.15 / this.r.scale);
    const px = 1 / (this.r.scale * k); // one screen pixel, in the units used below
    c.save();
    c.textBaseline = 'alphabetic';
    c.lineCap = 'butt';

    // the vein the mining prompt is about
    if (this.step === 'mine' && g.phase === 'wave' && !p.charging) {
      let best: OreNode | null = null;
      let bd = Infinity;
      for (const n of g.nodes) {
        if (!n.alive || !n.open || n.kind === 'nest') continue;
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      if (best) this.brackets(best.x, best.y, best.r + 9 + 2 * Math.sin(this.r.t * 5), 2 * px * k, C.text);
    }
    for (const t of this.tags) {
      if (t.atPlayer) continue;
      c.globalAlpha = Math.min(1, t.t / 0.25);
      this.wtext(t.text, t.x, t.y - (1 - t.t / t.max) * 8, 12 * k, t.color);
    }
    c.globalAlpha = 1;
    c.translate(p.x, p.y);
    c.scale(k, k);
    c.translate(-p.x, -p.y);

    // heat, repeated where the eyes are: an arc over the character
    if (g.spec.feat.heat && g.heat > 0.5) {
      const k = g.heat / CFG.heat.max;
      const R = pc.r + 13;
      const a0 = -Math.PI / 2 - 2;
      const span = 4;
      const holding = g.heatCoolT > 0 || g.spec.heatHolds;
      c.globalAlpha = Math.min(1, g.heat / 6) * 0.5;
      c.strokeStyle = '#0d0f12';
      c.lineWidth = 4.5;
      c.beginPath();
      c.arc(p.x, p.y, R, a0, a0 + span);
      c.stroke();
      c.globalAlpha = Math.min(1, g.heat / 6) * (holding ? 1 : 0.6);
      c.strokeStyle = heatColor(k);
      c.lineWidth = 3 + 3 * (this.heatPulse / 0.4);
      c.beginPath();
      c.arc(p.x, p.y, R, a0, a0 + span * k);
      c.stroke();
      c.globalAlpha = Math.min(1, g.heat / 6) * 0.9;
      c.strokeStyle = '#0d0f12';
      c.lineWidth = 1.2;
      for (const tick of HEAT_TICKS) {
        const a = a0 + span * tick;
        c.beginPath();
        c.moveTo(p.x + Math.cos(a) * (R - 3), p.y + Math.sin(a) * (R - 3));
        c.lineTo(p.x + Math.cos(a) * (R + 3), p.y + Math.sin(a) * (R + 3));
        c.stroke();
      }
      c.globalAlpha = 1;
    }

    // where the swing and the ability will go
    if (!this.touch && !p.charging && p.swingT <= 0 && g.phase === 'wave') {
      const a = Math.atan2(p.ay, p.ax);
      const tip = pc.r + 25;
      const base = pc.r + 18;
      c.beginPath();
      c.moveTo(p.x + Math.cos(a) * tip, p.y + Math.sin(a) * tip);
      c.lineTo(p.x + Math.cos(a + 0.2) * base, p.y + Math.sin(a + 0.2) * base);
      c.lineTo(p.x + Math.cos(a - 0.2) * base, p.y + Math.sin(a - 0.2) * base);
      c.closePath();
      c.lineJoin = 'round';
      c.strokeStyle = '#0d0f12';
      c.lineWidth = 2.5;
      c.stroke();
      c.fillStyle = C.text;
      c.fill();
    }

    // a hit shows where it came from
    for (const h of this.hurts) {
      const d = Math.hypot(h.x - p.x, h.y - p.y);
      const a = Math.atan2(h.y - p.y, h.x - p.x);
      const half = d < 2 ? Math.PI : 0.62;
      c.globalAlpha = Math.min(1, h.t / 0.3);
      c.lineCap = 'round';
      c.strokeStyle = '#0d0f12';
      c.lineWidth = 8;
      c.beginPath();
      c.arc(p.x, p.y, pc.r + 21, a - half, a + half);
      c.stroke();
      c.strokeStyle = '#ff3b30';
      c.lineWidth = 5.5;
      c.beginPath();
      c.arc(p.x, p.y, pc.r + 21, a - half, a + half);
      c.stroke();
      c.strokeStyle = '#ffffff'; // a white core sets it apart from the heat arc, which also runs to red
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(p.x, p.y, pc.r + 21, a - half, a + half);
      c.stroke();
      c.lineCap = 'butt';
      c.globalAlpha = 1;
    }

    // ---- bars under the character: health, stamina, bag
    const bw = 56;
    const bx = p.x - bw / 2;
    const top = p.y + pc.r + 10;
    let by = top;
    c.fillStyle = 'rgba(20,23,28,.88)';
    c.fillRect(bx - 1.5, by - 1.5, bw + 3, 23);
    c.strokeStyle = C.border;
    c.lineWidth = px;
    c.strokeRect(bx - 1.5, by - 1.5, bw + 3, 23);

    const hp = Math.max(0, Math.min(1, p.hp / g.spec.maxHp));
    c.fillStyle = C.track;
    c.fillRect(bx, by, bw, 7);
    c.fillStyle = hp > 0.35 ? C.green : C.red;
    c.fillRect(bx, by, bw * hp, 7);
    by += 8;

    const st = Math.max(0, Math.min(1, p.stamina / pc.stamina));
    const blink = this.staminaBlink > 0 && Math.floor(this.staminaBlink * 12) % 2 === 0;
    c.fillStyle = C.track;
    c.fillRect(bx, by, bw, 6);
    c.fillStyle = blink ? C.red : p.stamina >= g.heavyCost ? '#f4d35e' : '#a8914a';
    c.fillRect(bx, by, bw * st, 6);
    const costs = [g.heavyCost];
    if (g.spec.feat.dodge && !g.spec.noDodge) costs.push(g.dodgeCost);
    for (const cost of costs) {
      // a notch at what a dodge and a swing cost: dark where you can pay it, light where you cannot yet
      c.fillStyle = p.stamina >= cost ? '#14171c' : 'rgba(255,255,255,.7)';
      c.fillRect(bx + (bw * cost) / pc.stamina - 0.7, by, 1.4, 6);
    }
    if (this.staminaBlink > 0) {
      c.strokeStyle = blink ? '#ff3b30' : '#ffffff';
      c.lineWidth = 2;
      c.strokeRect(bx - 1, by - 1, bw + 2, 8);
    }
    by += 7;

    const slow = g.slow;
    const comfort = Math.max(1, g.spec.comfort);
    const span = pc.slowMax / pc.slowPerWeight;
    const kC = 0.6; // the bar's first 60% is the bag's comfort; the rest is the weight that slows
    const bagCol = slow <= 0.005 ? C.bag : slow < 0.25 ? C.amber : C.red;
    c.fillStyle = C.track;
    c.fillRect(bx, by, bw, 5);
    c.fillStyle = bagCol;
    const fillK = g.spec.noSlow
      ? Math.min(1, g.weight / (comfort + span))
      : kC * Math.min(1, g.weight / comfort) + (1 - kC) * Math.min(1, Math.max(0, g.weight - comfort) / span);
    c.fillRect(bx, by, bw * fillK, 5);
    if (!g.spec.noSlow) {
      c.fillStyle = '#ffffff';
      c.fillRect(bx + bw * kC - 0.6, by - 0.5, 1.2, 6);
    }
    // a little sack, so the third bar says what it is
    const kx = bx - 9;
    const ky = by + 1.5;
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(kx - 2, ky - 6.5);
    c.lineTo(kx + 2, ky - 6.5);
    c.lineTo(kx + 1.3, ky - 3.6);
    c.bezierCurveTo(kx + 6.5, ky - 1, kx + 6, ky + 5, kx, ky + 5);
    c.bezierCurveTo(kx - 6, ky + 5, kx - 6.5, ky - 1, kx - 1.3, ky - 3.6);
    c.closePath();
    c.strokeStyle = '#0d0f12';
    c.lineWidth = 2.2;
    c.stroke();
    c.fillStyle = bagCol;
    c.fill();
    c.fillStyle = '#0d0f12';
    c.fillRect(kx - 1.9, ky - 4.1, 3.8, 1);
    if (slow > 0.005) this.wtext(`-${Math.round(slow * 100)}% SPEED`, p.x, top + 35, 10.5, bagCol);

    // ---- the one cooldown, next to the bars
    if (g.spec.feat.ability && g.spec.abilities.length) {
      const def = WEAPONS[g.spec.abilities[g.abilityIdx]];
      const size = 20;
      const shake = this.cdShake > 0 ? Math.sin(this.r.t * 80) * 2.5 * (this.cdShake / 0.35) : 0;
      const ax = bx + bw + 5 + shake;
      const ay = top - 1.5;
      const ready = p.abilityCd <= 0;
      c.fillStyle = 'rgba(20,23,28,.9)';
      c.fillRect(ax, ay, size, size);
      if (ready) {
        c.fillStyle = def.color;
        c.fillRect(ax + 2, ay + 2, size - 4, size - 4);
        if (!this.touch) {
          c.fillStyle = '#14171c';
          c.font = `800 12px ${FONT}`;
          c.textAlign = 'center';
          c.fillText(keyCap('ability'), ax + size / 2, ay + size / 2 + 4.3);
        }
      } else {
        c.save();
        c.beginPath();
        c.rect(ax + 1, ay + 1, size - 2, size - 2);
        c.clip();
        c.globalAlpha = 0.45;
        c.fillStyle = def.color;
        c.beginPath();
        c.moveTo(ax + size / 2, ay + size / 2);
        c.arc(ax + size / 2, ay + size / 2, size, -Math.PI / 2, -Math.PI / 2 + (1 - p.abilityCd / p.abilityMax) * Math.PI * 2);
        c.closePath();
        c.fill();
        c.restore();
        c.fillStyle = C.text;
        c.font = `800 12px ${FONT}`;
        c.textAlign = 'center';
        c.fillText(String(Math.ceil(p.abilityCd)), ax + size / 2, ay + size / 2 + 4.3);
      }
      c.strokeStyle = this.cdShake > 0 ? '#ff3b30' : ready ? def.color : C.border;
      c.lineWidth = this.cdShake > 0 ? 2 : px;
      c.strokeRect(ax, ay, size, size);
      if (this.cdReady > 0) {
        const k = 1 - this.cdReady / 0.5;
        c.globalAlpha = 1 - k;
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2;
        c.strokeRect(ax - 6 * k, ay - 6 * k, size + 12 * k, size + 12 * k);
        c.globalAlpha = 1;
      }
      if (this.cdShake > 0) this.wtext('NOT READY', ax + size + 5, ay + size / 2 + 4, 10.5, '#ff8a80', 'left');
    }

    // ---- words at the character: refusals, the new ability, what was picked up
    let ty = p.y - pc.r - 22;
    for (const t of this.tags) {
      if (!t.atPlayer) continue;
      c.globalAlpha = Math.min(1, t.t / 0.25);
      this.wtext(t.text, p.x, ty, 13, t.color);
      ty -= 15;
    }
    for (const x of this.gains) {
      if (x.n <= 0) continue;
      const mat = MATS[x.mat];
      c.globalAlpha = Math.min(1, x.t / 0.3);
      const main = `+${x.n} ${mat ? mat.name : ''}`;
      if (x.hot > 0) {
        // the part of the haul that heat paid for is named and coloured as heat
        const extra = `  +${x.hot} from heat`;
        c.font = `700 13px ${FONT}`;
        const w1 = c.measureText(main).width;
        c.font = `700 11px ${FONT}`;
        const w2 = c.measureText(extra).width;
        const x0 = p.x - (w1 + w2) / 2;
        this.wtext(main, x0, ty, 13, mat?.color ?? C.text, 'left');
        this.wtext(extra, x0 + w1, ty, 11, C.heat, 'left');
      } else this.wtext(main, p.x, ty, 13, mat?.color ?? C.text);
      ty -= 15;
    }
    c.globalAlpha = 1;
    c.restore();
  }

  /** Text in world space, with a dark outline so it reads on any ground. */
  private wtext(text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center'): void {
    const c = this.r.ctx;
    c.font = `700 ${size}px ${FONT}`;
    c.textAlign = align;
    c.lineJoin = 'round';
    c.lineWidth = size * 0.3;
    c.strokeStyle = 'rgba(13,15,18,.92)';
    c.strokeText(text, x, y);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  /** White corner brackets: "this one". Works in either coordinate space. */
  private brackets(x: number, y: number, half: number, lw: number, color: string): void {
    const c = this.r.ctx;
    const arm = half * 0.45;
    c.lineCap = 'square';
    for (const pass of [0, 1]) {
      c.strokeStyle = pass === 0 ? 'rgba(13,15,18,.85)' : color;
      c.lineWidth = pass === 0 ? lw * 2.4 : lw;
      c.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        c.moveTo(x + sx * half, y + sy * (half - arm));
        c.lineTo(x + sx * half, y + sy * half);
        c.lineTo(x + sx * (half - arm), y + sy * half);
      }
      c.stroke();
    }
    c.lineCap = 'butt';
  }

  // ----------------------------------------------------------------- screen layer

  /** Drawn in screen space, over everything. */
  drawScreen(g: Game, input: InputMgr): void {
    this.g = g;
    this.touch = input.touchMode;
    this.safe = input.safe;
    this.s = uiScale(this.r.w, this.r.h);
    if (this.touch && this.r.h > this.r.w && !this.rotateShown && g.phase === 'wave') {
      this.rotateShown = true; // once per session: portrait shows about a third of the arena's width
      this.rotateT = 7;
    }
    if (input.dismissed || this.r.w >= this.r.h) {
      this.rotateT = 0;
      input.dismissed = false;
    }
    const f = g.spec.feat;
    input.shown.dodge = f.dodge && !g.spec.noDodge;
    input.shown.ability = f.ability && g.spec.abilities.length > 0;
    input.shown.swap = input.shown.ability && g.spec.abilities.length > 1;
    const pb = input.buttons().pause;
    this.pauseBox = { x: pb.x + pb.r + (input.touchMode ? 0 : Math.round(44 * this.s)), y: pb.y + pb.r };
    const c = this.r.ctx;
    c.save();
    c.textBaseline = 'alphabetic';
    this.drawOverlay(g);
    this.drawThreats(g);
    this.drawMarkers(g);
    const below = this.drawTop(g);
    this.drawBuild(g, input);
    if (input.touchMode) this.drawTouch(input, g);
    this.drawPause(input);
    this.drawBanners(g, below);
    this.drawStep(g);
    this.drawNote();
    this.drawRotate(input);
    if (this.over === 'fell') this.drawFell(g);
    if (this.resume > 0) this.drawResume();
    if (!input.touchMode && input.active) this.drawReticle(input);
    c.restore();
  }

  private font(size: number, weight = 600): string {
    return `${weight} ${Math.max(11, Math.round(size * this.s))}px ${FONT}`;
  }

  private panel(x: number, y: number, w: number, h: number, alpha = 0.9, border = C.border): void {
    const c = this.r.ctx;
    c.globalAlpha = alpha;
    c.fillStyle = C.panel;
    c.fillRect(x, y, w, h);
    c.globalAlpha = 1;
    c.strokeStyle = border;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  /** Text over the map: white with a soft shadow. */
  private shadowText(text: string, x: number, y: number, color: string): void {
    const c = this.r.ctx;
    c.shadowColor = 'rgba(0,0,0,.9)';
    c.shadowBlur = 4;
    c.shadowOffsetY = 1;
    c.fillStyle = color;
    c.fillText(text, x, y);
    c.shadowColor = 'transparent';
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;
  }

  /** A key cap. Returns its width. */
  private cap(text: string, x: number, y: number, h: number): number {
    const c = this.r.ctx;
    c.font = `700 ${Math.max(10, Math.round(h * 0.62))}px ${FONT}`;
    const w = Math.max(h, Math.round(c.measureText(text).width + h * 0.7));
    c.fillStyle = '#2b323b';
    c.fillRect(x, y, w, h);
    c.fillStyle = '#434c58';
    c.fillRect(x, y + h - 2, w, 2);
    c.strokeStyle = '#8b96a3';
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    c.fillStyle = C.text;
    c.textAlign = 'center';
    c.fillText(text, x + w / 2, y + h * 0.5 + Math.max(10, Math.round(h * 0.62)) * 0.35 - 1);
    return w;
  }

  private drawOverlay(g: Game): void {
    const c = this.r.ctx;
    const w = this.r.w;
    const h = this.r.h;
    // low health only: a dark red closing-in, dark enough that red enemies at the edge stay brighter than it
    if (g.p.hp / g.spec.maxHp < 0.3 && g.phase === 'wave') {
      const a = 0.5 + 0.1 * Math.sin(this.r.t * 7);
      const gr = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.hypot(w, h) * 0.55);
      gr.addColorStop(0, 'rgba(84,0,0,0)');
      gr.addColorStop(1, `rgba(84,0,0,${a})`);
      c.fillStyle = gr;
      c.fillRect(0, 0, w, h);
    }
    if (this.over === 'fell') {
      c.fillStyle = `rgba(13,15,18,${Math.min(0.5, this.overT * 1.6)})`;
      c.fillRect(0, 0, w, h);
    }
    // the beat, at the edge of sight: no frame in the lull, gold in the swell, red in the peak
    if (g.phase === 'wave' && g.beat !== 'lull') {
      const lw = Math.round(3 * this.s) + this.beatFlash * 14 * this.s;
      c.globalAlpha = 0.85;
      c.strokeStyle = BEAT[g.beat];
      c.lineWidth = lw;
      c.strokeRect(lw / 2, lw / 2, w - lw, h - lw);
      c.globalAlpha = 1;
    }
  }

  /** Bottom edge of the top plate and where its x range lies, for things that must keep clear of it. */
  private plate(g: Game): { x: number; y: number; w: number; h: number } {
    const s = this.s;
    const sa = this.safe;
    const w = Math.min(Math.round(520 * s), this.r.w - 16 - sa.left - sa.right);
    const x = Math.max(sa.left + 8, Math.min(this.r.w - sa.right - 8 - w, Math.round((this.r.w - w) / 2)));
    return { x, y: Math.round(8 * s) + sa.top, w, h: Math.round((g.spec.feat.heat ? 91 : 53) * s) };
  }

  /** Keeps an edge marker on screen and off the top plate and the bottom-right controls. */
  private edgePos(g: Game, sx: number, sy: number, pad: number): [number, number] {
    const w = this.r.w;
    const h = this.r.h;
    const sa = this.safe;
    const x = Math.max(pad + sa.left, Math.min(w - pad - sa.right, sx));
    let y = Math.max(pad + sa.top, Math.min(h - pad - sa.bottom, sy));
    // on touch, off the cluster of buttons under the right thumb
    if (this.touch && x > w - sa.right - 250) y = Math.min(y, h - sa.bottom - 228);
    const pl = this.plate(g);
    if (x > pl.x - pad && x < pl.x + pl.w + pad) y = Math.max(y, pl.y + pl.h + pad + Math.round(34 * this.s));
    if (!this.touch && x > w - Math.round(330 * this.s)) y = Math.min(y, h - Math.round(80 * this.s) - pad);
    // and off the pause button in the top left
    const pb = this.pauseBox;
    if (x < pb.x + pad && y < pb.y + pad) y = pb.y + pad;
    return [x, y];
  }

  private offscreen(sx: number, sy: number, m = 0): boolean {
    return sx < -m || sx > this.r.w + m || sy < -m || sy > this.r.h + m;
  }

  /** What is coming from outside the view: a glow where a group is arriving, chevrons for attacks already under way. */
  private drawThreats(g: Game): void {
    if (g.phase !== 'wave') return;
    const c = this.r.ctx;
    const w = this.r.w;
    const h = this.r.h;
    const s = this.s;
    const p = g.p;
    const cellPx = 150 * s;
    const groups = new Map<string, { x: number; y: number; n: number }>();
    for (const e of g.enemies) {
      if (e.dead || e.state === 'under') continue;
      const [sx, sy] = this.r.worldToScreen(e.x, e.y);
      if (!this.offscreen(sx, sy, e.r * this.r.scale)) continue;
      const out = Math.hypot(Math.max(0, -sx, sx - w), Math.max(0, -sy, sy - h)) / this.r.scale;
      const ex = Math.max(0, Math.min(w, sx));
      const ey = Math.max(0, Math.min(h, sy));
      if (out < 380) {
        const key = `${Math.round(ex / cellPx)}:${Math.round(ey / cellPx)}`;
        const gr = groups.get(key) ?? { x: 0, y: 0, n: 0 };
        const wt = e.kind === 'swarm' ? 1 : e.kind === 'brute' || e.boss || e.elite ? 4 : 2;
        gr.x += ex * wt;
        gr.y += ey * wt;
        gr.n += wt;
        groups.set(key, gr);
      }
      // attacks already under way out there
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      const rush = (e.kind === 'charger' || e.boss !== null) && (e.tele > 0 || e.dash > 0);
      const shot = e.kind === 'spitter' && e.stunT <= 0 && e.t1 < 0.9 && d < 520;
      if (!rush && !shot) continue;
      const pad = Math.round(20 * s);
      const [mx, my] = this.edgePos(g, sx, sy, pad);
      const a = Math.atan2(my - sy, mx - sx); // pointing inward, the way the attack travels
      const size = (e.boss ? 16 : 11) * s;
      if (Math.floor(this.r.t * 9) % 2 === 0 && !rush) continue;
      c.save();
      c.translate(mx, my);
      c.rotate(a);
      c.lineJoin = 'miter';
      for (const pass of [0, 1]) {
        c.strokeStyle = pass === 0 ? '#14171c' : rush ? '#ff3b30' : '#b6f25a';
        c.lineWidth = (pass === 0 ? 7 : 3.5) * s;
        c.beginPath();
        c.moveTo(-size * 0.5, -size);
        c.lineTo(size * 0.5, 0);
        c.lineTo(-size * 0.5, size);
        if (rush) {
          c.moveTo(-size * 1.4, -size);
          c.lineTo(-size * 0.4, 0);
          c.lineTo(-size * 1.4, size);
        }
        c.stroke();
      }
      if (!rush) {
        c.fillStyle = '#b6f25a';
        c.strokeStyle = '#14171c';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(size * 1.5, 0, size * 0.4, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      c.restore();
    }
    for (const gr of groups.values()) {
      if (gr.n < 3) continue;
      const x = gr.x / gr.n;
      const y = gr.y / gr.n;
      const R = (70 + 9 * Math.min(14, gr.n)) * s;
      const a = Math.min(0.5, 0.14 + 0.03 * gr.n) * (0.8 + 0.2 * Math.sin(this.r.t * 5 + x));
      const grad = c.createRadialGradient(x, y, 0, x, y, R);
      grad.addColorStop(0, `rgba(226,80,74,${a})`);
      grad.addColorStop(1, 'rgba(226,80,74,0)');
      c.fillStyle = grad;
      c.fillRect(x - R, y - R, R * 2, R * 2);
    }
  }

  /** Edge markers: one icon per meaning, each with a tip pointing at its target; nearer is larger. */
  private drawMarkers(g: Game): void {
    if (g.phase !== 'wave') return;
    const c = this.r.ctx;
    const s = this.s;
    const p = g.p;
    type Kind = 'rich' | 'richShut' | 'elite' | 'boss' | 'nest' | 'supply';
    const mark = (wx: number, wy: number, kind: Kind, label = '') => {
      const [sx, sy] = this.r.worldToScreen(wx, wy);
      if (!this.offscreen(sx, sy)) return;
      const d = Math.hypot(wx - p.x, wy - p.y);
      const near = 1 - Math.max(0, Math.min(1, (d - 350) / 800)); // 1 close, 0 far
      const size = Math.round((kind === 'boss' ? 30 : kind === 'richShut' ? 18 : 24) * s * (0.72 + 0.28 * near));
      const pad = Math.round(size * 0.5 + 14 * s);
      const [mx, my] = this.edgePos(g, sx, sy, pad);
      const a = Math.atan2(sy - my, sx - mx);
      const col = kind === 'rich' ? C.gold : kind === 'richShut' ? '#8d7c3c' : kind === 'nest' ? C.pink : kind === 'supply' ? C.green : '#ffffff';
      const fill = kind === 'boss' ? C.crit : kind === 'elite' ? '#5a1414' : C.panel;
      const edge = kind === 'boss' || kind === 'elite' ? '#ff5a4d' : col;
      const pulse = kind === 'rich' || kind === 'boss' || kind === 'elite' ? 0.82 + 0.18 * Math.sin(this.r.t * 7) : 1;
      c.globalAlpha = kind === 'richShut' ? 0.75 : pulse;
      // the tip
      const hs = size / 2;
      c.fillStyle = edge;
      c.beginPath();
      c.moveTo(mx + Math.cos(a) * (hs + 9 * s), my + Math.sin(a) * (hs + 9 * s));
      c.lineTo(mx + Math.cos(a + 0.5) * hs * 1.05, my + Math.sin(a + 0.5) * hs * 1.05);
      c.lineTo(mx + Math.cos(a - 0.5) * hs * 1.05, my + Math.sin(a - 0.5) * hs * 1.05);
      c.closePath();
      c.fill();
      c.fillStyle = fill;
      c.fillRect(mx - hs, my - hs, size, size);
      c.strokeStyle = edge;
      c.lineWidth = Math.max(1, Math.round(1.5 * s));
      c.strokeRect(mx - hs + 0.5, my - hs + 0.5, size - 1, size - 1);
      // the icon
      const u = size * 0.5;
      c.fillStyle = col;
      c.strokeStyle = col;
      c.lineWidth = Math.max(1.5, 2 * s);
      if (kind === 'rich' || kind === 'richShut') {
        c.beginPath();
        c.moveTo(mx, my - u * 0.62);
        c.lineTo(mx + u * 0.5, my);
        c.lineTo(mx, my + u * 0.62);
        c.lineTo(mx - u * 0.5, my);
        c.closePath();
        if (kind === 'rich') c.fill();
        else c.stroke();
      } else if (kind === 'nest') {
        c.beginPath();
        c.ellipse(mx, my, u * 0.42, u * 0.58, 0, 0, Math.PI * 2);
        c.fill();
      } else if (kind === 'supply') {
        c.fillRect(mx - u * 0.6, my - u * 0.17, u * 1.2, u * 0.34);
        c.fillRect(mx - u * 0.17, my - u * 0.6, u * 0.34, u * 1.2);
      } else if (kind === 'elite') {
        // a crown: a named enemy
        c.beginPath();
        c.moveTo(mx - u * 0.62, my + u * 0.45);
        c.lineTo(mx - u * 0.62, my - u * 0.3);
        c.lineTo(mx - u * 0.3, my + u * 0.02);
        c.lineTo(mx, my - u * 0.52);
        c.lineTo(mx + u * 0.3, my + u * 0.02);
        c.lineTo(mx + u * 0.62, my - u * 0.3);
        c.lineTo(mx + u * 0.62, my + u * 0.45);
        c.closePath();
        c.fill();
      } else {
        // a skull: the boss
        c.beginPath();
        c.arc(mx, my - u * 0.1, u * 0.5, 0, Math.PI * 2);
        c.fill();
        c.fillRect(mx - u * 0.28, my + u * 0.2, u * 0.56, u * 0.38);
        c.fillStyle = C.crit;
        c.beginPath();
        c.arc(mx - u * 0.2, my - u * 0.1, u * 0.13, 0, Math.PI * 2);
        c.arc(mx + u * 0.2, my - u * 0.1, u * 0.13, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      if (label) {
        c.font = this.font(13, 800);
        const lx = mx < this.r.w / 2 ? mx + hs + 6 * s : mx - hs - 6 * s;
        c.textAlign = mx < this.r.w / 2 ? 'left' : 'right';
        this.shadowText(label, lx, my + 5 * s, col);
      }
    };
    const closing = g.richCloseIn;
    for (const n of g.nodes) {
      if (!n.alive) continue;
      if (n.rich) mark(n.x, n.y, n.open ? 'rich' : 'richShut', n.open && closing <= 5 ? `${Math.ceil(closing)}s` : '');
      else if (n.kind === 'nest') mark(n.x, n.y, 'nest');
    }
    for (const z of g.zones) if (z.kind === 'supply') mark(z.x, z.y, 'supply');
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (e.boss) mark(e.x, e.y, 'boss');
      else if (e.elite) mark(e.x, e.y, 'elite');
    }
  }

  /** The top plate: wave, beat and clock, heat and what it is doing. Returns the y below everything it drew. */
  private drawTop(g: Game): number {
    const c = this.r.ctx;
    const s = this.s;
    const R = (n: number) => Math.round(n * s);
    const pl = this.plate(g);
    const pad = R(10);
    const x = pl.x + pad;
    const bw = pl.w - pad * 2;
    this.panel(pl.x, pl.y, pl.w, pl.h);

    // wave, beat, clock
    const left = Math.max(0, Math.ceil(g.dur - g.waveT));
    const yA = pl.y + R(23);
    c.textAlign = 'left';
    c.font = this.font(13);
    c.fillStyle = C.soft;
    c.fillText(`WAVE ${g.spec.index + 1}/${g.spec.feat.gates ? CFG.waveDur.length : CFG.wavesPerSegment}`, x, yA);
    c.textAlign = 'right';
    c.font = this.font(19, 700);
    c.fillStyle = C.text;
    const clock = `${left}s`;
    c.fillText(clock, x + bw, yA + R(1));
    const cw = c.measureText(clock).width;
    c.font = this.font(14, 800);
    c.fillStyle = BEAT[g.beat];
    c.fillText(g.beat.toUpperCase(), x + bw - cw - R(8), yA);
    const closing = g.richCloseIn;
    if (closing <= 5 && closing > 0 && Math.floor(this.r.t * 4) % 2 === 0) {
      c.textAlign = 'center';
      c.font = this.font(12, 700);
      c.fillStyle = C.gold;
      c.fillText(`VEINS CLOSE ${Math.ceil(closing)}s`, pl.x + pl.w / 2, yA);
    }

    // the beat bar
    const yB = pl.y + R(31);
    const hB = R(12);
    const segs: [number, string][] = [[g.lullShare, BEAT.lull], [g.swellShare, BEAT.swell], [1 - g.lullShare - g.swellShare, BEAT.peak]];
    const prog = Math.min(1, g.waveT / g.dur);
    c.fillStyle = C.track;
    c.fillRect(x, yB, bw, hB);
    let sx = x;
    for (const [share, col] of segs) {
      const sw = bw * share;
      c.fillStyle = col;
      c.globalAlpha = 0.3;
      c.fillRect(sx, yB, sw - 2, hB);
      c.globalAlpha = 1;
      c.fillRect(sx, yB, Math.max(0, Math.min(sw - 2, x + bw * prog - sx)), hB);
      sx += sw;
    }
    c.fillStyle = '#fff';
    c.fillRect(Math.round(x + bw * prog) - 1, yB - 3, 3, hB + 6);

    // heat: the level, what it is doing to the wave, and whether it is holding or cooling
    if (g.spec.feat.heat) {
      const yC = yB + hB + R(9);
      const hC = R(12);
      const k = g.heat / CFG.heat.max;
      c.fillStyle = C.track;
      c.fillRect(x, yC, bw, hC);
      c.globalAlpha = k > 0.7 ? 0.75 + 0.25 * Math.sin(this.r.t * 14) : 1;
      c.fillStyle = heatColor(k);
      c.fillRect(x, yC, bw * k, hC);
      c.globalAlpha = 1;
      for (const tick of HEAT_TICKS) {
        c.fillStyle = k >= tick ? '#14171c' : 'rgba(255,255,255,.55)';
        c.fillRect(Math.round(x + bw * tick), yC, Math.max(1, R(1.5)), hC);
      }
      const yD = yC + hC + R(16);
      c.font = this.font(12, 700);
      c.textAlign = 'left';
      const on = g.heat > 0.5;
      c.fillStyle = on ? C.heat : C.dim;
      c.fillText('HEAT', x, yD);
      let tx = x + c.measureText('HEAT').width + R(8);
      if (on) {
        const sp = `+${Math.round(g.heatSpawn * 100)}% enemies`;
        c.fillStyle = C.text;
        c.fillText(sp, tx, yD);
        tx += c.measureText(sp).width + R(10);
        c.fillStyle = C.gold;
        c.fillText(`+${Math.round(g.heatYield * 100)}% yield`, tx, yD);
      } else {
        c.font = this.font(12, 500);
        c.fillStyle = C.dim;
        c.fillText('none: mining raises it', tx, yD);
      }
      if (on) {
        c.textAlign = 'right';
        c.font = this.font(12, 700);
        if (g.spec.heatHolds) {
          c.fillStyle = C.heat;
          c.fillText('NEVER COOLS', x + bw, yD);
        } else if (g.heatCoolT > 0) {
          // a short draining strip: how long the heat still holds before it starts to fall
          const txt = `HOLDS ${g.heatCoolT.toFixed(1)}s`;
          c.fillStyle = C.text;
          c.fillText(txt, x + bw, yD);
          const tw = c.measureText('HOLDS 0.0s').width;
          c.fillStyle = C.track;
          c.fillRect(x + bw - tw, yD + R(3), tw, Math.max(2, R(2)));
          c.fillStyle = C.heat;
          c.fillRect(x + bw - tw, yD + R(3), tw * Math.min(1, g.heatCoolT / CFG.heat.coolDelay), Math.max(2, R(2)));
        } else {
          c.fillStyle = C.cool;
          c.fillText('COOLING ▼', x + bw, yD);
        }
      }
    }

    let y = pl.y + pl.h + R(6);
    // on a narrow screen the pause button sits under the plate's left end: what hangs under the plate starts beside it
    const x0 = y < this.pauseBox.y && pl.x < this.pauseBox.x + 6 ? this.pauseBox.x + 6 : pl.x;
    const x1 = pl.x + pl.w;
    const b = g.bossRef;
    if (b && b.boss) y = this.drawBoss(b, x0, y, x1 - x0);
    else y = this.drawObjective(g, y, x0, x1);
    return y;
  }

  /** The boss, under the top plate: health, and marks at the health where its armour comes back. */
  private drawBoss(b: Enemy, x: number, y: number, w: number): number {
    const c = this.r.ctx;
    const s = this.s;
    const R = (n: number) => Math.round(n * s);
    const def = b.boss!;
    const pad = R(10);
    const h = R(48);
    this.panel(x, y, w, h, 0.9, b.shield ? C.armor : C.border);
    c.font = this.font(14, 800);
    c.textAlign = 'left';
    c.fillStyle = C.text;
    c.fillText(def.name.toUpperCase(), x + pad, y + R(19));
    c.textAlign = 'right';
    if (b.shield) {
      const nameW = c.measureText(def.name.toUpperCase()).width;
      c.fillStyle = C.armor;
      c.font = this.font(13, 800);
      const long = 'ARMOURED: HEAVY SWING BREAKS IT';
      c.fillText(nameW + c.measureText(long).width + R(16) > w - pad * 2 ? 'ARMOURED: HEAVY SWING' : long, x + w - pad, y + R(19));
    } else {
      c.fillStyle = C.soft;
      c.font = this.font(13, 600);
      c.fillText(`${Math.max(0, Math.ceil((b.hp / b.maxHp) * 100))}%`, x + w - pad, y + R(19));
    }
    const bx = x + pad;
    const by = y + R(27);
    const bw = w - pad * 2;
    const bh = R(13);
    const k = Math.max(0, Math.min(1, b.hp / b.maxHp));
    c.fillStyle = C.track;
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = def.color;
    c.fillRect(bx, by, bw * k, bh);
    if (b.shield) {
      c.strokeStyle = C.armor;
      c.lineWidth = Math.max(2, R(2.5));
      c.strokeRect(bx, by, Math.max(4, bw * k), bh);
    }
    def.armorAt.forEach((at, i) => {
      if (at >= 1) return;
      const mx = Math.round(bx + bw * at);
      const todo = i >= b.armorIdx; // still to come
      c.fillStyle = '#14171c';
      c.fillRect(mx - 2, by - 1, 4, bh + 2);
      c.fillStyle = todo ? C.armor : '#5d6772';
      c.fillRect(mx - 1, by - R(3), 2, bh + R(6));
      // a small shield above the mark
      c.beginPath();
      c.moveTo(mx - R(5), by - R(9));
      c.lineTo(mx + R(5), by - R(9));
      c.lineTo(mx + R(5), by - R(5));
      c.lineTo(mx, by - R(1));
      c.lineTo(mx - R(5), by - R(5));
      c.closePath();
      c.fill();
    });
    return y + h + R(6);
  }

  /** What a supply drop or the nests pay this build: scrap after its modifiers, and the heal only if healing is allowed. */
  private objectivePays(g: Game): string {
    const scrap = g.objectiveScrap;
    const parts = [scrap > 0 ? `${amt(scrap)} scrap` : '', g.m.noHeal > 0 ? '' : 'up to 15 health'].filter(Boolean);
    return parts.length ? `pays ${parts.join(', ')}` : '';
  }

  /** The objective chip: what to do, a counter, and what it pays. */
  private drawObjective(g: Game, y: number, x0: number, x1: number): number {
    if (g.res.objective || g.phase !== 'wave') return y;
    const o = g.spec.objective;
    let label = '';
    let count = '';
    let pays = '';
    let col = C.soft;
    let bar = -1;
    if (o === 'supply') {
      label = 'HOLD THE CIRCLE';
      count = `${Math.min(10, Math.floor(g.supplyT))}/10s`;
      pays = this.objectivePays(g);
      col = C.green;
      bar = g.supplyT / 10;
    } else if (o === 'nests') {
      const nests = g.nodes.filter((n) => n.kind === 'nest');
      col = C.pink;
      pays = this.objectivePays(g);
      if (!nests.length) {
        if (g.beat !== 'lull') return y;
        label = 'NESTS COME WITH THE SWELL';
      } else {
        if (g.beat === 'peak') return y; // hatched: the banner said so
        label = 'BREAK THE NESTS BEFORE THE PEAK';
        const broken = nests.filter((n) => !n.alive).length;
        count = `${broken}/${nests.length}`;
        bar = broken / nests.length;
      }
    } else if (o === 'elite' && g.spec.elite) {
      const e = g.enemies.find((x) => x.elite && !x.dead);
      col = '#ff8a80';
      pays = 'pays its part, 8x scrap';
      if (e) {
        label = `BRING DOWN ${g.spec.elite.name.toUpperCase()}`;
        count = `${Math.max(1, Math.ceil((e.hp / e.maxHp) * 100))}%`;
        bar = e.hp / e.maxHp;
      } else if (g.beat === 'lull') label = `${g.spec.elite.name.toUpperCase()} COMES WITH THE SWELL`;
      else return y;
    } else return y;

    const c = this.r.ctx;
    const s = this.s;
    const R = (n: number) => Math.round(n * s);
    c.font = this.font(14, 800);
    const wl = c.measureText(label).width;
    const wc = count ? c.measureText(count).width + R(10) : 0;
    c.font = this.font(12, 600);
    const wp = c.measureText(pays).width + R(14);
    const one = Math.round(R(16) + wl + wc + wp + R(12));
    const two = one > x1 - x0; // too wide for the space: what it pays goes on a second line
    const h = two ? R(48) : R(30);
    const w = two ? Math.min(x1 - x0, Math.round(R(16) + Math.max(wl + wc, wp) + R(12))) : one;
    // centred on the screen where it fits, else centred in the space it has
    const mid = this.r.w / 2 - w / 2 >= x0 ? this.r.w / 2 : (x0 + x1) / 2;
    const x = Math.round(mid - w / 2);
    this.panel(x, y, w, h);
    c.fillStyle = col;
    c.fillRect(x, y, R(4), h);
    if (bar >= 0) {
      c.fillStyle = col;
      c.globalAlpha = 0.9;
      c.fillRect(x + R(4), y + h - Math.max(2, R(3)), (w - R(4)) * Math.max(0, Math.min(1, bar)), Math.max(2, R(3)));
      c.globalAlpha = 1;
    }
    let tx = x + R(14);
    c.textAlign = 'left';
    c.font = this.font(14, 800);
    c.fillStyle = col;
    c.fillText(label, tx, y + R(20));
    tx += wl + R(10);
    if (count) {
      c.fillStyle = C.text;
      c.fillText(count, tx, y + R(20));
      tx += wc;
    }
    c.font = this.font(12, 600);
    c.fillStyle = C.gold;
    if (two) c.fillText(pays, x + R(14), y + R(38));
    else c.fillText(pays, tx + R(4), y + R(20));
    return y + h + R(6);
  }

  /** Weapon pips and the ability tiles (desktop). What the build is doing, and what is paused. */
  private drawBuild(g: Game, input: InputMgr): void {
    const c = this.r.ctx;
    const s = this.s;
    const lay = input.buttons();
    const sl = lay.slots;
    const ws = g.spec.weapons;
    const held = g.p.charging || g.p.dodgeT > 0; // light attacks stop while winding up
    const n = Math.max(ws.length, g.spec.slots); // as many boxes as this expedition has slots: two for a Duelist, seven with Seventh hand
    const shift = Math.max(0, sl.cols - n) * (sl.cell + sl.gap); // a short row sits against the ability tile
    for (let i = 0; i < n; i++) {
      const col = i % sl.cols;
      const row = Math.floor(i / sl.cols);
      const x = sl.x + shift + col * (sl.cell + sl.gap);
      const y = sl.y - (Math.ceil(n / sl.cols) - 1 - row) * (sl.cell + sl.gap);
      c.globalAlpha = 0.85;
      c.fillStyle = C.panel;
      c.fillRect(x, y, sl.cell, sl.cell);
      c.globalAlpha = 1;
      if (i >= ws.length) {
        c.strokeStyle = '#3a424e';
        c.lineWidth = 1;
        c.strokeRect(x + 0.5, y + 0.5, sl.cell - 1, sl.cell - 1);
        continue;
      }
      const def = WEAPONS[ws[i].fam];
      const sealed = i === g.spec.sealed;
      const since = g.time - g.firedAt[i];
      const fired = since >= 0 && since < 0.14;
      const off = sealed || held;
      c.fillStyle = sealed ? '#4a4f57' : def.color;
      c.globalAlpha = fired ? 1 : off ? 0.22 : 0.6;
      const inset = fired ? 1 : 3;
      c.fillRect(x + inset, y + inset, sl.cell - inset * 2, sl.cell - inset * 2);
      c.globalAlpha = 1;
      c.strokeStyle = fired ? '#ffffff' : off ? '#4a525d' : def.color;
      c.lineWidth = fired ? 2 : 1;
      c.strokeRect(x + 0.5, y + 0.5, sl.cell - 1, sl.cell - 1);
      if (sealed) {
        c.strokeStyle = '#c9d1db';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(x + 4, y + 4);
        c.lineTo(x + sl.cell - 4, y + sl.cell - 4);
        c.moveTo(x + sl.cell - 4, y + 4);
        c.lineTo(x + 4, y + sl.cell - 4);
        c.stroke();
      }
    }
    if (held && g.p.charging && ws.length && g.phase === 'wave') {
      c.font = this.font(11, 700);
      c.textAlign = 'right';
      const rows = Math.ceil(n / sl.cols);
      this.shadowText(input.touchMode ? 'WEAPONS WAIT' : 'WEAPONS WAIT WHILE YOU WIND UP', sl.x + sl.cols * (sl.cell + sl.gap) - sl.gap, sl.y - (rows - 1) * (sl.cell + sl.gap) - Math.round(6 * s), C.soft);
    }
    if (input.touchMode || !input.shown.ability) return;

    // the ability tile: a real button for the mouse, with its key on it
    const def = WEAPONS[g.spec.abilities[g.abilityIdx]];
    const b = lay.ability;
    const ready = g.p.abilityCd <= 0;
    const shake = this.cdShake > 0 ? Math.sin(this.r.t * 80) * 4 * s * (this.cdShake / 0.35) : 0;
    const x = b.x - b.r + shake;
    const y = b.y - b.r;
    const d = b.r * 2;
    c.fillStyle = '#22323d';
    c.fillRect(x, y, d, d);
    if (!ready) {
      c.fillStyle = 'rgba(13,15,18,.72)';
      c.fillRect(x, y, d, d * Math.min(1, g.p.abilityCd / g.p.abilityMax));
    }
    c.strokeStyle = this.cdShake > 0 ? '#ff3b30' : ready ? def.color : C.border;
    c.lineWidth = this.cdShake > 0 || ready ? 2 : 1;
    c.strokeRect(x + 1, y + 1, d - 2, d - 2);
    c.textAlign = 'center';
    if (ready) {
      c.font = this.font(10, 700);
      c.fillStyle = def.color;
      c.fillText('READY', x + d / 2, y + d * 0.56);
    } else {
      c.font = this.font(22, 800);
      c.fillStyle = C.text;
      c.fillText(String(Math.ceil(g.p.abilityCd)), x + d / 2, y + d * 0.6);
    }
    c.font = this.font(12, 800);
    c.fillStyle = ready ? C.text : C.dim;
    c.fillText(def.ability.name.toUpperCase(), x + d / 2, y + d - Math.round(8 * s));
    this.cap(keyCap('ability'), x + 3, y + 3, Math.round(16 * s));

    if (input.shown.swap) {
      const sb = lay.swap;
      const next = WEAPONS[g.spec.abilities[(g.abilityIdx + 1) % g.spec.abilities.length]];
      const sx = sb.x - sb.r;
      const sy = sb.y - sb.r;
      const sd = sb.r * 2;
      c.fillStyle = '#22323d';
      c.fillRect(sx, sy, sd, sd);
      c.strokeStyle = C.border;
      c.lineWidth = 1;
      c.strokeRect(sx + 0.5, sy + 0.5, sd - 1, sd - 1);
      this.cap(keyCap('swap'), sx + 3, sy + 3, Math.round(16 * s));
      c.textAlign = 'center';
      c.font = `700 ${Math.max(10, Math.round(10 * s))}px ${FONT}`;
      c.fillStyle = C.dim;
      c.fillText('SWAP TO', sx + sd / 2, sy + sd - Math.round(19 * s));
      c.fillStyle = next.color;
      c.fillText(next.ability.name.toUpperCase(), sx + sd / 2, sy + sd - Math.round(7 * s));
    }
  }

  private drawPause(input: InputMgr): void {
    const c = this.r.ctx;
    const b = input.buttons().pause;
    if (input.touchMode) {
      c.fillStyle = 'rgba(20,23,28,.7)';
      c.beginPath();
      c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = C.border;
      c.lineWidth = 1;
      c.stroke();
    } else {
      this.panel(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, 0.85);
      this.cap(keyCap('pause'), b.x + b.r + Math.round(6 * this.s), b.y - Math.round(9 * this.s), Math.round(18 * this.s));
    }
    const u = b.r / 17;
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.fillRect(b.x - 6 * u, b.y - 7 * u, 4 * u, 14 * u);
    c.fillRect(b.x + 2 * u, b.y - 7 * u, 4 * u, 14 * u);
  }

  private drawBanners(g: Game, below: number): void {
    const c = this.r.ctx;
    const s = this.s;
    const w = this.r.w;
    let y = Math.max(Math.round(this.r.h * 0.23), below + Math.round(6 * s));

    // the last three seconds of the wave, counted out
    const left = g.dur - g.waveT;
    if (g.phase === 'wave' && left <= 3 && left > 0) {
      const frac = left - Math.floor(left);
      const size = Math.round(64 * s * (1 + 0.3 * frac));
      c.font = `800 ${size}px ${FONT}`;
      c.textAlign = 'center';
      c.globalAlpha = 0.45 + 0.55 * frac;
      c.lineJoin = 'round';
      c.lineWidth = 6 * s;
      c.strokeStyle = 'rgba(13,15,18,.85)';
      c.strokeText(String(Math.ceil(left)), w / 2, y + Math.round(58 * s));
      c.fillStyle = C.text;
      c.fillText(String(Math.ceil(left)), w / 2, y + Math.round(58 * s));
      c.globalAlpha = 1;
      y += Math.round(78 * s);
    }

    const fs = Math.max(15, Math.round(21 * s));
    const bh = Math.round(fs * 1.75);
    for (const b of this.banners) {
      c.font = `800 ${fs}px ${FONT}`;
      const tw = Math.min(w - 24, c.measureText(b.text).width + Math.round(36 * s));
      const a = Math.min(1, b.t * 4, (b.max - b.t) * 12 + 0.35);
      const x = Math.round((w - tw) / 2);
      c.globalAlpha = a;
      if (b.crit) {
        c.fillStyle = C.crit;
        c.fillRect(x, y, tw, bh);
        c.strokeStyle = '#ff5a4d';
        c.lineWidth = 1;
        c.strokeRect(x + 0.5, y + 0.5, tw - 1, bh - 1);
      } else {
        c.fillStyle = 'rgba(20,23,28,.9)';
        c.fillRect(x, y, tw, bh);
        c.strokeStyle = C.border;
        c.lineWidth = 1;
        c.strokeRect(x + 0.5, y + 0.5, tw - 1, bh - 1);
        c.fillStyle = b.color;
        c.fillRect(x, y, Math.max(3, Math.round(4 * s)), bh);
      }
      c.textAlign = 'center';
      c.fillStyle = b.crit ? '#ffffff' : b.color;
      c.fillText(b.text, w / 2, y + bh / 2 + fs * 0.36, w - 40);
      c.globalAlpha = 1;
      y += bh + Math.round(4 * s);
    }
  }

  /** One control at a time, on a plate low on the screen, gone as soon as the player has done it. */
  private drawStep(g: Game): void {
    if (!this.step || !this.teach || g.phase !== 'wave') return;
    const c = this.r.ctx;
    const s = this.s;
    const parts = this.stepParts(g, this.step);
    const fs = Math.max(13, Math.round(16 * s));
    const capH = Math.round(fs * 1.5);
    const gap = Math.round(7 * s);
    c.font = `600 ${fs}px ${FONT}`;
    let tw = 0;
    for (const p of parts) {
      if ('k' in p) {
        c.font = `700 ${Math.max(10, Math.round(capH * 0.62))}px ${FONT}`;
        tw += Math.max(capH, Math.round(c.measureText(p.k).width + capH * 0.7)) + gap;
      } else {
        c.font = `600 ${fs}px ${FONT}`;
        tw += c.measureText(p.t).width + gap;
      }
    }
    tw -= gap;
    const padX = Math.round(14 * s);
    const h = Math.round(capH + 14 * s);
    const w = Math.min(this.r.w - 16, tw + padX * 2);
    const x = Math.round((this.r.w - w) / 2);
    // desktop: low on the screen; portrait phone: just above the buttons (the camera keeps the character above it);
    // landscape phone: at the bottom, between the move stick and the buttons
    const y = Math.round(!this.touch ? this.r.h * 0.78 : this.r.h > this.r.w ? this.r.h - this.safe.bottom - 228 - h : this.r.h - this.safe.bottom - h - 40);
    const a = Math.min(1, this.shownFor[this.step] * 4);
    c.globalAlpha = a;
    this.panel(x, y, w, h, 0.92 * a);
    c.fillStyle = C.text;
    c.fillRect(x, y, Math.max(3, Math.round(4 * s)), h);
    let cx = x + padX;
    const cy = y + Math.round((h - capH) / 2);
    for (const p of parts) {
      if ('k' in p) cx += this.cap(p.k, cx, cy, capH) + gap;
      else {
        c.font = `600 ${fs}px ${FONT}`;
        c.textAlign = 'left';
        c.fillStyle = C.text;
        c.fillText(p.t, cx, y + h / 2 + fs * 0.36);
        cx += c.measureText(p.t).width + gap;
      }
    }
    c.globalAlpha = 1;
  }

  private drawNote(): void {
    if (this.noteT <= 0) return;
    const c = this.r.ctx;
    const s = this.s;
    c.font = this.font(14, 700);
    const w = Math.round(c.measureText(this.noteText).width + 28 * s);
    const h = Math.round(30 * s);
    const x = Math.round(14 * s);
    const y = this.r.h - h - Math.round(14 * s);
    c.globalAlpha = Math.min(1, this.noteT * 3);
    this.panel(x, y, w, h, 0.92);
    c.textAlign = 'left';
    c.fillStyle = C.text;
    c.fillText(this.noteText, x + Math.round(14 * s), y + h / 2 + Math.round(5 * s));
    c.globalAlpha = 1;
  }

  /** Portrait on a phone: say once that sideways shows more. Never blocks; a tap on it, or seven seconds, removes it. */
  private drawRotate(input: InputMgr): void {
    if (this.rotateT <= 0) {
      input.dismissBox = null;
      return;
    }
    const c = this.r.ctx;
    const text = 'Turn your phone sideways for a wider view';
    c.font = `600 13px ${FONT}`;
    const tw = c.measureText(text).width;
    const w = Math.min(this.r.w - 16, Math.round(tw + 62));
    const h = 40;
    const x = Math.round((this.r.w - w) / 2);
    const y = Math.round(this.r.h * 0.34);
    c.globalAlpha = Math.min(1, this.rotateT * 2);
    this.panel(x, y, w, h, 0.94);
    c.textAlign = 'left';
    c.fillStyle = C.text;
    c.fillText(text, x + 14, y + 25, w - 58);
    // the close mark
    c.strokeStyle = C.soft;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x + w - 26, y + 14);
    c.lineTo(x + w - 14, y + 26);
    c.moveTo(x + w - 14, y + 14);
    c.lineTo(x + w - 26, y + 26);
    c.stroke();
    c.globalAlpha = 1;
    input.dismissBox = { x: x - 6, y: y - 8, w: w + 12, h: h + 16 };
  }

  /** The fall: the frame is held, the field dims, and the thing that did it is bracketed and named. */
  private drawFell(g: Game): void {
    const c = this.r.ctx;
    const s = this.s;
    const k = g.killer;
    if (!k) return;
    const kx = k.enemy ? k.enemy.x : k.x;
    const ky = k.enemy ? k.enemy.y : k.y;
    const [sx, sy] = this.r.worldToScreen(kx, ky);
    const [px, py] = this.r.worldToScreen(g.p.x, g.p.y);
    const half = ((k.enemy ? k.enemy.r : 14) + 10) * this.r.scale;
    const pad = half + Math.round(30 * s);
    const mx = Math.max(pad, Math.min(this.r.w - pad, sx));
    const my = Math.max(pad, Math.min(this.r.h - pad, sy));
    // a line from the blow to where you fell
    c.strokeStyle = 'rgba(255,90,77,.9)';
    c.lineWidth = Math.max(2, 2 * s);
    c.setLineDash([6 * s, 6 * s]);
    c.beginPath();
    c.moveTo(mx, my);
    c.lineTo(px, py);
    c.stroke();
    c.setLineDash([]);
    const grow = 1 + Math.max(0, 0.3 - this.overT) * 3;
    this.brackets(mx, my, half * grow, Math.max(2, 2.5 * s), '#ffffff');
    this.brackets(px, py, (CFG.player.r + 8) * this.r.scale, Math.max(1.5, 2 * s), '#ff5a4d');
    c.font = this.font(14, 700);
    const name = k.name.charAt(0).toUpperCase() + k.name.slice(1);
    const tw = c.measureText(name).width + Math.round(14 * s);
    const ly = my - half * grow - Math.round(30 * s);
    c.fillStyle = 'rgba(13,15,18,.85)';
    c.fillRect(mx - tw / 2, ly, tw, Math.round(22 * s));
    c.textAlign = 'center';
    c.fillStyle = '#ff6b5e';
    c.fillText(name, mx, ly + Math.round(16 * s));
  }

  private drawResume(): void {
    const c = this.r.ctx;
    const s = this.s;
    const n = Math.max(1, Math.ceil(this.resume / 0.4));
    const frac = (this.resume / 0.4) % 1;
    const size = Math.round(84 * s * (1 + 0.25 * frac));
    c.font = `800 ${size}px ${FONT}`;
    c.textAlign = 'center';
    c.lineJoin = 'round';
    c.lineWidth = 7 * s;
    c.strokeStyle = 'rgba(13,15,18,.9)';
    c.strokeText(String(n), this.r.w / 2, this.r.h * 0.36);
    c.fillStyle = C.text;
    c.fillText(String(n), this.r.w / 2, this.r.h * 0.36);
    c.font = this.font(14, 700);
    this.shadowText('GET READY', this.r.w / 2, this.r.h * 0.36 + Math.round(26 * s), C.soft);
  }

  /** The aim point: the system cursor is hidden during a wave, this takes its place. */
  private drawReticle(input: InputMgr): void {
    if (input.mouseX < 0) return;
    const c = this.r.ctx;
    const s = this.s;
    const x = input.mouseX;
    const y = input.mouseY;
    if (input.overButton()) {
      // over a HUD button the reticle becomes a plain pointer
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y + 17 * s);
      c.lineTo(x + 4.5 * s, y + 13 * s);
      c.lineTo(x + 11.5 * s, y + 12.5 * s);
      c.closePath();
      c.lineJoin = 'round';
      c.strokeStyle = '#0d0f12';
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = '#ffffff';
      c.fill();
      return;
    }
    const r = 9 * s;
    for (const pass of [0, 1]) {
      c.strokeStyle = pass === 0 ? 'rgba(13,15,18,.9)' : '#ffffff';
      c.lineWidth = pass === 0 ? 4.5 : 2;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        c.moveTo(x + dx * (r - 3 * s), y + dy * (r - 3 * s));
        c.lineTo(x + dx * (r + 5 * s), y + dy * (r + 5 * s));
      }
      c.stroke();
    }
    c.fillStyle = '#ffffff';
    c.fillRect(x - 1, y - 1, 2, 2);
  }

  /**
   * Touch controls. All of them are drawn from the first frame, so a new player sees where the thumbs go:
   * the move stick's resting ring bottom-left, and SWING with DODGE, the ability and SWAP round it bottom-right.
   * Health and stamina are repeated as two arcs round SWING, 8 px thick, because the bars at the character are small on a phone.
   */
  private drawTouch(input: InputMgr, g: Game): void {
    const c = this.r.ctx;
    const b = input.buttons();
    const p = g.p;
    c.textAlign = 'center';

    // the move stick: a resting ring until a thumb is down, then it sits under the thumb
    const st = input.joy ?? { ox: b.stick.x, oy: b.stick.y, x: b.stick.x, y: b.stick.y };
    c.lineWidth = 2;
    c.strokeStyle = input.joy ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.2)';
    c.fillStyle = 'rgba(20,23,28,.25)';
    c.beginPath();
    c.arc(st.ox, st.oy, b.stick.r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    const jdx = st.x - st.ox;
    const jdy = st.y - st.oy;
    const jl = Math.max(1, Math.hypot(jdx, jdy) / b.stick.r);
    c.fillStyle = input.joy ? 'rgba(255,255,255,.32)' : 'rgba(255,255,255,.13)';
    c.beginPath();
    c.arc(st.ox + jdx / jl, st.oy + jdy / jl, 20, 0, Math.PI * 2);
    c.fill();
    if (!input.joy) {
      c.font = `700 10px ${FONT}`;
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.fillText('MOVE', st.ox, st.oy + b.stick.r + 14);
    }

    const round = (btn: { x: number; y: number; r: number }, label: string, edge: string, textCol: string, lit = false) => {
      c.fillStyle = lit ? 'rgba(60,70,82,.8)' : 'rgba(20,23,28,.62)';
      c.beginPath();
      c.arc(btn.x, btn.y, btn.r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = edge;
      c.lineWidth = 2;
      c.stroke();
      c.font = `700 ${btn.r > 40 ? 13 : 11}px ${FONT}`;
      c.fillStyle = textCol;
      c.fillText(label, btn.x, btn.y + 4);
    };

    // SWING: hold to wind up, drag to aim, lift to strike
    const sw = b.swing;
    const held = input.aim !== null;
    const canSwing = p.stamina >= g.heavyCost;
    round(sw, 'SWING', held ? '#ffffff' : 'rgba(255,255,255,.5)', canSwing ? '#ffffff' : '#ff8a80', held);
    if (p.charging) {
      c.strokeStyle = p.charge >= 1 ? '#ffd34d' : '#aab4c0';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(sw.x, sw.y, sw.r - 5, -Math.PI / 2, -Math.PI / 2 + p.charge * Math.PI * 2);
      c.stroke();
    }
    if (input.aim) {
      // where the thumb has dragged the aim
      const dx = input.aim.x - input.aim.ox;
      const dy = input.aim.y - input.aim.oy;
      const l = Math.hypot(dx, dy);
      if (l > 16) {
        const a = Math.atan2(dy, dx);
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(sw.x + Math.cos(a) * (sw.r - 12), sw.y + Math.sin(a) * (sw.r - 12));
        c.lineTo(sw.x + Math.cos(a + 0.35) * (sw.r - 24), sw.y + Math.sin(a + 0.35) * (sw.r - 24));
        c.lineTo(sw.x + Math.cos(a - 0.35) * (sw.r - 24), sw.y + Math.sin(a - 0.35) * (sw.r - 24));
        c.closePath();
        c.fill();
      }
    }
    // health (outer) and stamina (inner) round SWING, on the side the thumb does not cover
    const a0 = Math.PI * 0.75;
    const span = Math.PI;
    const arc = (radius: number, kFill: number, color: string) => {
      c.lineCap = 'butt';
      c.strokeStyle = 'rgba(13,15,18,.8)';
      c.lineWidth = 10;
      c.beginPath();
      c.arc(sw.x, sw.y, radius, a0 - 0.02, a0 + span + 0.02);
      c.stroke();
      c.strokeStyle = C.track;
      c.lineWidth = 8;
      c.beginPath();
      c.arc(sw.x, sw.y, radius, a0, a0 + span);
      c.stroke();
      if (kFill > 0.005) {
        c.strokeStyle = color;
        c.beginPath();
        c.arc(sw.x, sw.y, radius, a0, a0 + span * Math.min(1, kFill));
        c.stroke();
      }
    };
    const hp = Math.max(0, p.hp / g.spec.maxHp);
    const blink = this.staminaBlink > 0 && Math.floor(this.staminaBlink * 12) % 2 === 0;
    arc(sw.r + 9, p.stamina / CFG.player.stamina, blink ? C.red : canSwing ? '#f4d35e' : '#a8914a');
    arc(sw.r + 20, hp, hp > 0.35 ? C.green : C.red);
    const costs = [g.heavyCost];
    if (input.shown.dodge) costs.push(g.dodgeCost);
    for (const cost of costs) {
      const a = a0 + span * (cost / CFG.player.stamina);
      c.strokeStyle = p.stamina >= cost ? '#14171c' : 'rgba(255,255,255,.75)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(sw.x + Math.cos(a) * (sw.r + 5), sw.y + Math.sin(a) * (sw.r + 5));
      c.lineTo(sw.x + Math.cos(a) * (sw.r + 13), sw.y + Math.sin(a) * (sw.r + 13));
      c.stroke();
    }

    if (input.shown.dodge) round(b.dodge, 'DODGE', 'rgba(255,255,255,.5)', p.stamina >= g.dodgeCost ? '#ffffff' : '#ff8a80');
    if (input.shown.swap) round(b.swap, 'SWAP', 'rgba(255,255,255,.5)', '#ffffff');
    if (input.shown.ability) {
      const def = WEAPONS[g.spec.abilities[g.abilityIdx]];
      const ready = p.abilityCd <= 0;
      const btn = b.ability;
      const shake = this.cdShake > 0 ? Math.sin(this.r.t * 80) * 4 * (this.cdShake / 0.35) : 0;
      const bx = btn.x + shake;
      c.fillStyle = 'rgba(20,23,28,.62)';
      c.beginPath();
      c.arc(bx, btn.y, btn.r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,.2)';
      c.lineWidth = 3;
      c.stroke();
      c.strokeStyle = this.cdShake > 0 ? '#ff3b30' : def.color;
      c.beginPath();
      c.arc(bx, btn.y, btn.r, -Math.PI / 2, -Math.PI / 2 + (1 - p.abilityCd / p.abilityMax) * Math.PI * 2);
      c.stroke();
      if (ready) {
        c.font = `700 11px ${FONT}`;
        c.fillStyle = def.color;
        c.fillText(def.ability.name.toUpperCase(), bx, btn.y + 4);
      } else {
        c.font = `800 20px ${FONT}`;
        c.fillStyle = '#ffffff';
        c.fillText(String(Math.ceil(p.abilityCd)), bx, btn.y + 3);
        c.font = `700 9px ${FONT}`;
        c.fillStyle = C.dim;
        c.fillText(def.ability.name.toUpperCase(), bx, btn.y + 16);
      }
    }
  }
}
