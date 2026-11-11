// The HUD: DOM over the canvas, built from the ledger kit's pieces. Every
// write is diffed against the last value so a quiet frame touches nothing.
import type { Sprites } from '../art/index.ts';
import { audio } from '../audio/index.ts';
import { ENEMIES, WEAPONS, weaponCooldown, type Run } from '../../sim/index.ts';
import { clock, el, icSized, stamp } from './dom.ts';

export interface SoundControls { el: HTMLElement; dispose(): void }

/** Mute button and volume slider, kept in step with the audio engine. */
export function soundControls(compact = false): SoundControls {
  const mute = stamp('Sound', 'stamp--plain stamp--small mute');
  mute.addEventListener('click', () => { audio.toggleMute(); audio.play('stamp'); });
  const vol = el('input', 'vol');
  vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05';
  vol.setAttribute('aria-label', 'Volume');
  vol.addEventListener('input', () => audio.setVolume(Number(vol.value)));
  vol.addEventListener('change', () => { audio.play('pickup'); vol.blur(); });
  const sync = (): void => {
    mute.setAttribute('aria-pressed', String(audio.muted));
    mute.setAttribute('aria-label', audio.muted ? 'Sound is off' : 'Sound is on');
    vol.value = String(audio.volume);
  };
  sync();
  const off = audio.onChange(sync);
  return { el: el('div', compact ? 'sound g-sound g-sound--compact' : 'sound g-sound', mute, vol), dispose: off };
}

export interface Hud {
  el: HTMLElement;
  update(dt: number): void;
  /** One ruled line under the wave box. */
  notice(tag: string, text: string, danger?: boolean, seconds?: number): void;
  /** The teaching line near the player; '' hides it. x, y in css px. */
  teach(text: string, x: number, y: number): void;
  hurt(): void;
  rebind(s: Sprites): void;
  destroy(): void;
}

const SEGMENTS = 16;

export function createHud(stage: HTMLElement, sprites: Sprites, run: Run, onPause: () => void): Hud {
  let S = sprites;
  const p = run.player;

  const bar = el('span', 'bar');
  const hpNum = el('span', 'num');
  const hp = el('div', 'hp', bar, hpNum);
  const lvLabel = el('span', 'label');
  const xp = el('div', 'meter g-xp');
  const tl = el('div', 'g-tl', hp, el('div', 'g-lv', lvLabel, xp));

  const waveLabel = el('span', 'label');
  const waveTime = el('span', 'time num');
  const wave = el('div', 'wave g-tc', waveLabel, waveTime);

  const counters = el('div', 'counters');
  const counterNums: HTMLElement[] = [];
  const counterEls: HTMLElement[] = [];
  const bank = el('div', 'g-bank');
  bank.hidden = true;
  const tr = el('div', 'g-tr', counters, bank);

  const slots = el('div', 'g-slots');
  const eliteName = el('span', 'label');
  const eliteFill = el('i');
  const elite = el('div', 'g-elite', eliteName, el('div', 'g-ebar', eliteFill));
  elite.hidden = true;
  const notices = el('div', 'g-notices');
  notices.setAttribute('aria-live', 'polite');
  const mid = el('div', 'g-mid', elite, notices);

  const pause = stamp('Pause', 'stamp--plain stamp--small');
  pause.addEventListener('click', () => { pause.blur(); onPause(); });
  const sound = soundControls(true);
  sound.el.prepend(pause);
  sound.el.classList.add('g-snd');

  const teach = el('div', 'g-teach');
  teach.hidden = true;

  const root = el('div', 'hud g-hud', tl, wave, tr, slots, mid, sound.el);
  stage.append(root, teach);

  function buildCounters(): void {
    counters.replaceChildren();
    counterNums.length = 0; counterEls.length = 0;
    const defs = [
      ['is-scrip', S.icon.scrip, 'Scrip'], ['', S.icon.raw.timber, 'Timber'], ['', S.icon.raw.ore, 'Ore'], ['', S.icon.raw.hide, 'Hide'],
    ] as const;
    for (const [cls, icon, name] of defs) {
      const num = el('span', 'num', '0');
      const c = el('span', `counter ${cls}`.trim(), icSized(icon, 28), num);
      c.title = name;
      counters.append(c);
      counterNums.push(num); counterEls.push(c);
    }
    for (let i = 0; i < 4; i++) counterNums[i].textContent = String(shown[i]);
  }

  // Cached state.
  const shown = [p.scrip, p.raws.timber, p.raws.ore, p.raws.hide];
  const flashT = [0, 0, 0, 0];
  let segN = -1, segOn = -1, segSh = -1, hpText = '', low = false, hurtT = 0;
  let lv = -1, xpV = -1, waveText = '', timeText = '', bankV = -1, slotSig = '';
  let eliteUid = -1, eliteV = -1;
  const slotCd: HTMLElement[] = [];
  const slotV: number[] = [];
  interface Note { el: HTMLElement; ttl: number }
  const notes: Note[] = [];
  let teachText = '', teachX = -1, teachY = -1;
  buildCounters();

  function update(dt: number): void {
    // Health: up to 16 segments, shield hatched after the fill.
    const maxHp = Math.max(1, p.maxHp);
    const n = Math.min(SEGMENTS, Math.ceil(maxHp));
    const on = p.hp <= 0 ? 0 : Math.max(1, Math.round((p.hp / maxHp) * n));
    const sh = p.shield > 0 ? Math.max(1, Math.min(6, Math.round((p.shield / maxHp) * n))) : 0;
    if (n !== segN || sh !== segSh) {
      bar.replaceChildren();
      for (let i = 0; i < n + sh; i++) bar.append(el('i', i >= n ? 'sh' : ''));
      segN = n; segSh = sh; segOn = -1;
    }
    if (on !== segOn) {
      for (let i = 0; i < n; i++) bar.children[i]!.className = i < on ? 'on' : '';
      segOn = on;
    }
    const t = `${Math.max(0, Math.ceil(p.hp))}/${Math.round(maxHp)}${p.shield > 0 ? ` +${Math.ceil(p.shield)}` : ''}`;
    if (t !== hpText) { hpNum.textContent = t; hpText = t; }
    const isLow = p.hp / maxHp <= 0.3;
    if (isLow !== low) { hp.classList.toggle('is-low', isLow); low = isLow; }
    if (hurtT > 0) { hurtT -= dt; if (hurtT <= 0) hp.classList.remove('is-hurt'); }

    if (p.level !== lv) { lvLabel.textContent = `Level ${p.level}`; lv = p.level; }
    const xv = Math.round(Math.min(1, p.xp / p.xpNext) * 40) / 40;
    if (xv !== xpV) { xp.style.setProperty('--v', String(xv)); xpV = xv; }

    const wt = `Wave ${run.wave} of ${run.totalWaves}`;
    if (wt !== waveText) { waveLabel.textContent = wt; waveText = wt; }
    const tt = clock(run.waveSeconds - run.waveTime);
    if (tt !== timeText) { waveTime.textContent = tt; timeText = tt; }

    // Counters tick toward their value and flash Ink when it changes.
    const target = [p.scrip, p.raws.timber, p.raws.ore, p.raws.hide];
    for (let i = 0; i < 4; i++) {
      if (shown[i] !== target[i]) {
        const d = target[i] - shown[i];
        shown[i] += Math.abs(d) <= 2 ? d : Math.sign(d) * Math.ceil(Math.abs(d) / 5);
        counterNums[i].textContent = String(shown[i]);
        if (flashT[i] <= 0) counterEls[i].classList.add('is-flash');
        flashT[i] = 0.08;
      } else if (flashT[i] > 0) {
        flashT[i] -= dt;
        if (flashT[i] <= 0) counterEls[i].classList.remove('is-flash');
      }
    }
    const bk = Math.round(p.bank);
    if (bk !== bankV) {
      bank.hidden = bk <= 0;
      if (bk > 0) bank.textContent = `${bk} banked, pays double`;
      bankV = bk;
    }

    // Weapon slots with a cooldown tick under each.
    let sig = '';
    for (const w of p.weapons) sig += `${w.id}${w.tier},`;
    if (sig !== slotSig) {
      slots.replaceChildren();
      slotCd.length = 0; slotV.length = 0;
      for (const w of p.weapons) {
        const cd = el('i');
        const icon = icSized(S.icon.weapon[w.id as keyof typeof S.icon.weapon], 24);
        const s = el('div', 'g-slot', icon, el('span', 'g-slot-tier', String(w.tier)), el('span', 'g-cd', cd));
        s.title = `${WEAPONS[w.def].name}, tier ${w.tier}`;
        slots.append(s);
        slotCd.push(cd); slotV.push(-1);
      }
      slotSig = sig;
    }
    for (let i = 0; i < p.weapons.length && i < slotCd.length; i++) {
      const w = p.weapons[i];
      const full = weaponCooldown(p, WEAPONS[w.def], w.tier);
      const v = Math.round(Math.max(0, Math.min(1, 1 - w.cd / full)) * 12) / 12;
      if (v !== slotV[i]) { slotCd[i].style.transform = `scaleX(${v})`; slotV[i] = v; }
    }

    // Elite or boss bar.
    const e = run.eliteIdx >= 0 && run.phase === 'wave' ? run.enemies[run.eliteIdx] : null;
    if (e && e.alive) {
      if (e.uid !== eliteUid) { eliteName.textContent = ENEMIES[e.type].name; elite.hidden = false; eliteUid = e.uid; eliteV = -1; }
      const v = Math.round(Math.max(0, e.hp / e.maxHp) * 100);
      if (v !== eliteV) { eliteFill.style.width = `${v}%`; eliteV = v; }
    } else if (eliteUid !== -1) { elite.hidden = true; eliteUid = -1; }

    for (let i = notes.length - 1; i >= 0; i--) {
      notes[i].ttl -= dt;
      if (notes[i].ttl <= 0) { notes[i].el.remove(); notes.splice(i, 1); }
    }
  }

  return {
    el: root,
    update,
    notice(tag, text, danger = false, seconds = 3) {
      const n = el('div', danger ? 'notice notice--danger' : 'notice', el('span', 'tag', tag), el('span', 'text', text));
      while (notes.length >= 2) notes.shift()!.el.remove();
      notices.append(n);
      notes.push({ el: n, ttl: seconds });
    },
    teach(text, x, y) {
      if (text !== teachText) { teach.textContent = text; teach.hidden = !text; teachText = text; }
      if (!text) return;
      const rx = Math.round(x), ry = Math.round(y);
      if (rx !== teachX || ry !== teachY) { teach.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, 0)`; teachX = rx; teachY = ry; }
    },
    hurt() { hp.classList.add('is-hurt'); hurtT = 0.08; },
    rebind(s) { S = s; buildCounters(); slotSig = ''; },
    destroy() { sound.dispose(); root.remove(); teach.remove(); },
  };
}
