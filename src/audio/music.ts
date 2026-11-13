// Music that is made up as it goes: a drone, a plucked ostinato, a drum, and short modal phrases on a
// plucked or bowed voice with silence between them. Nothing is a fixed tune, so nothing loops.
// It follows the wave: thin in the lull, a pulse in the swell, fuller at the peak; heat darkens the mode
// one flat at a time and adds a note that grates. One short motif of our own (MOTIF) is quoted by the
// phrases and carried by every stinger, so the game has a voice without a melody to wear out.
// The style is folk (drone, open fifths, modal steps); every note here is generated or written for this game.
import { midiHz, type Core, type Timbre } from './core';
import { BAR, type Ground } from './beds';

export type MusicMode = 'off' | 'arena' | 'boss' | 'town' | 'camp' | 'gate' | 'fallen';
export const MUSIC_MODES: MusicMode[] = ['off', 'arena', 'boss', 'town', 'camp', 'gate', 'fallen'];
export type Stinger = 'buy' | 'merge' | 'craft' | 'level' | 'evolve' | 'waveClear' | 'richOpen' | 'richClose' | 'objective' | 'bossDown' | 'extract' | 'cleared' | 'fall';
export const STINGERS: Stinger[] = ['buy', 'merge', 'craft', 'level', 'evolve', 'waveClear', 'richOpen', 'richClose', 'objective', 'bossDown', 'extract', 'cleared', 'fall'];
export type Station = '' | 'forge' | 'workshop' | 'apothecary' | 'camp';

// bright to dark: each step down the list flattens one more note
const SCALES = [
  [0, 2, 4, 5, 7, 9, 11], // Ionian
  [0, 2, 4, 5, 7, 9, 10], // Mixolydian
  [0, 2, 3, 5, 7, 9, 10], // Dorian
  [0, 2, 3, 5, 7, 8, 10], // Aeolian
  [0, 1, 3, 5, 7, 8, 10], // Phrygian
];
const PHRYGIAN = 4;
/** Each ground has a key, a home mode and a pace. */
const KEYS: Record<Ground, { root: number; mode: number; bpm: number }> = {
  quarry: { root: 50, mode: 2, bpm: 80 }, // D Dorian: open and bare
  grove: { root: 55, mode: 1, bpm: 90 }, // G Mixolydian: the brightest of the three
  marsh: { root: 52, mode: 3, bpm: 72 }, // E Aeolian: slow and low
};
const TOWN = { root: 55, mode: 0, bpm: 60 }; // G major, five notes of it
/** The game's own call, as [step it starts on, scale degree, length in steps]: up a fifth, lean on the fourth, up to the octave. */
const MOTIF: readonly (readonly [number, number, number])[] = [[0, 0, 2], [2, 4, 2], [4, 3, 1], [5, 4, 1], [6, 7, 6]];
// plucked figures over one bar of eight steps, as scale degrees above the bar's bass note (-1: rest)
const FIGURES = [
  [0, -1, 4, -1, 7, -1, 4, -1],
  [0, 4, 7, 4, 8, 4, 7, 4],
  [0, -1, 4, 7, -1, 4, 9, 7],
  [0, 7, 4, 7, 2, 7, 4, 7],
];
const BOSS_FIGURE = [0, -1, 0, 1, 0, -1, 4, 1];
// where the bass sits in each of four bars, in scale degrees; the drone never moves
const PROGRESSIONS = [[0, 0, -1, 0], [0, 3, 0, -1], [0, -2, -1, 0], [0, 0, 3, 4]];

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];
const chance = (p: number): boolean => Math.random() < p;

interface PNote { at: number; deg: number; len: number }
interface Layer {
  out: GainNode;
  oscs: OscillatorNode[];
  lp: BiquadFilterNode;
  level: GainNode;
  second: OscillatorNode; // its detune widens with heat
  tense: GainNode; // the flat second, an octave up
  sub: GainNode;
  freeAt: number;
}

export class Music {
  mode: MusicMode = 'off';
  ground: Ground = 'quarry';
  /** While true nothing new is played (the game is paused); the drone holds. */
  hold = false;
  private root = KEYS.quarry.root;
  private home = KEYS.quarry.mode;
  private dark = 0; // steps down the mode ladder that heat has pushed us
  private beat = 0; // 0 lull, 1 swell, 2 peak
  private heat = 0;
  private layer: Layer | null = null;
  private dying: Layer[] = [];
  private step = 0;
  private nextT = 0;
  private stepDur = 0.3;
  private figure = FIGURES[0];
  private prog = PROGRESSIONS[0];
  private phrase: PNote[] = [];
  private phraseStart = 0;
  private phraseVoice: 'lute' | 'banjo' | 'bow' | 'reed' = 'lute';
  private phraseReg = 12;
  private phraseEnd = 0; // step after which the phrase is over
  private restUntil = 0; // bar at which another phrase may start
  private breathAt = 0;

  constructor(private core: Core) {}

  // -------------------------------------------------------------------- key
  private get scale(): number[] {
    const base = this.mode === 'boss' || this.mode === 'gate' ? PHRYGIAN : this.mode === 'fallen' ? Math.max(3, this.home) : this.home;
    return SCALES[Math.min(PHRYGIAN, base + (this.mode === 'arena' ? this.dark : 0))];
  }
  /** MIDI note of a scale degree above the root; degrees run on past the octave and below zero. */
  private note(deg: number, scale = this.scale): number {
    const i = ((deg % 7) + 7) % 7;
    return this.root + 12 * Math.floor(deg / 7) + scale[i];
  }
  private get minorish(): boolean {
    return this.scale[2] === 3;
  }
  /** The five-note scale inside the current mode, as semitones: what the pickups climb. */
  get penta(): readonly number[] {
    return this.minorish ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  }
  /** A root near C5 for reward sounds. */
  get rewardRoot(): number {
    let m = this.root + 12;
    while (m < 66) m += 12;
    return m;
  }
  /** Where the enemy drone should sit so that it agrees with the music: the root or fifth nearest 50 Hz. */
  get crowdHz(): number {
    let best = 0;
    for (const m of [this.root, this.root + 7]) {
      let f = midiHz(m);
      while (f > 60) f /= 2;
      if (f >= 40 && Math.abs(f - 50) < Math.abs(best - 50)) best = f;
    }
    return best || 49;
  }

  // ------------------------------------------------------------------- mode
  /** The key of a place, set whether or not any music plays: pickups and the feedback phrases are tuned to it. */
  setKey(mode: MusicMode, ground: Ground): void {
    if (mode === 'off' || this.mode !== 'off') return; // while music plays, setMode owns the key
    const key = mode === 'town' ? TOWN : KEYS[ground];
    this.root = key.root;
    this.home = key.mode;
  }
  /** Start, change or stop the music. 'off' leaves no node running and schedules nothing. */
  setMode(mode: MusicMode, ground: Ground = this.ground): void {
    if (mode === this.mode && (ground === this.ground || mode === 'town' || mode === 'off')) return;
    const now = this.core.now;
    this.mode = mode;
    this.ground = ground;
    if (this.layer) {
      this.layer.out.gain.setTargetAtTime(0, now, 0.45);
      this.layer.freeAt = now + 2.6;
      this.dying.push(this.layer);
      this.layer = null;
    }
    if (mode === 'off') return;
    const key = mode === 'town' ? TOWN : KEYS[ground];
    this.root = key.root;
    this.home = key.mode;
    const bpm = mode === 'arena' ? key.bpm : mode === 'boss' ? key.bpm + 8 : mode === 'town' ? TOWN.bpm : mode === 'camp' ? 54 : 50;
    this.stepDur = 60 / bpm / 2;
    this.dark = 0;
    this.step = 0;
    this.nextT = now + 0.5;
    this.figure = pick(FIGURES);
    this.prog = pick(PROGRESSIONS);
    this.phrase = [];
    this.phraseEnd = 0;
    this.restUntil = mode === 'arena' || mode === 'boss' ? 1 : 0;
    this.layer = this.makeLayer(now);
    this.shape(now, 1.2);
  }

  /** The drone: two sawtooths on the root a few cents apart, one on the fifth, through a low filter. A hurdy-gurdy, roughly. */
  private makeLayer(t: number): Layer {
    const ctx = this.core.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setValueAtTime(0, t);
    out.gain.setTargetAtTime(1, t, 0.6);
    out.connect(this.core.music);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 0.9;
    const level = ctx.createGain();
    level.gain.value = 0;
    lp.connect(level).connect(out);
    const oscs: OscillatorNode[] = [];
    const voice = (midi: number, type: OscillatorType, vol: number, cents = 0): [OscillatorNode, GainNode] => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midiHz(midi);
      o.detune.value = cents;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g).connect(lp);
      o.start(t);
      oscs.push(o);
      return [o, g];
    };
    // The drone sits on the root below middle C and its fifth, with only a little of the octave under it:
    // the band below 120 Hz is left to the enemy drone and the drums.
    const low = this.root;
    voice(low - 12, 'sawtooth', 0.04);
    voice(low, 'sawtooth', 0.085);
    const [second] = voice(low, 'sawtooth', 0.065, 7);
    voice(low + 7, 'sawtooth', 0.055, -4);
    const [, sub] = voice(low - 24, 'sine', 0);
    const [, tense] = voice(low + 13, 'triangle', 0);
    return { out, oscs, lp, level, second, tense, sub, freeAt: Infinity };
  }
  private freeLayer(l: Layer): void {
    for (const o of l.oscs) {
      o.stop();
      o.disconnect();
    }
    l.out.disconnect();
  }

  /** What the game is doing: beat 0 lull, 1 swell, 2 peak; heat 0..1. */
  setState(beat: number, heat: number): void {
    this.beat = beat;
    this.heat = heat;
    // heat darkens the mode one flat at a time, with slack so it does not flicker at the edge
    if (this.dark < 1 && heat > 0.38) this.dark = 1;
    if (this.dark < 2 && heat > 0.72) this.dark = 2;
    if (this.dark > 1 && heat < 0.6) this.dark = 1;
    if (this.dark > 0 && heat < 0.26) this.dark = 0;
  }
  /** Set the drone for the mode, the beat and the heat. */
  private shape(now: number, tc: number): void {
    const l = this.layer;
    if (!l) return;
    const c = this.core;
    const m = this.mode;
    const i = m === 'arena' || m === 'boss' ? this.beat : 0;
    const h = m === 'arena' ? this.heat : m === 'boss' ? 0.5 : m === 'gate' ? 0.55 : 0;
    const level = m === 'arena' ? [0.5, 0.72, 0.9][i] : m === 'boss' ? [0.75, 0.9, 1][i] : m === 'gate' ? 0.6 : m === 'town' ? 0.3 : 0.4;
    c.glide(l.level.gain, level * DRONE, tc, now);
    c.glide(l.lp.frequency, ([420, 600, 860][i] + (m === 'boss' ? 120 : 0)) * (1 - 0.32 * h), tc, now);
    c.glide(l.second.detune, 7 + 24 * h, tc, now);
    c.glide(l.tense.gain, h * h * 0.05, tc, now);
    c.glide(l.sub.gain, m === 'boss' ? 0.07 : h > 0.5 ? 0.05 * h : 0, tc, now);
  }

  // -------------------------------------------------------------- conductor
  tick(): void {
    const now = this.core.now;
    for (let i = this.dying.length - 1; i >= 0; i--) {
      if (now < this.dying[i].freeAt) continue;
      this.freeLayer(this.dying[i]);
      this.dying.splice(i, 1);
    }
    if (this.mode === 'off' || !this.layer) return;
    this.shape(now, 0.8);
    if (now > this.breathAt) {
      // the bow never holds quite still
      this.breathAt = now + rnd(2, 5);
      this.layer.out.gain.setTargetAtTime(rnd(0.82, 1), now, 1.2);
    }
    if (this.hold) {
      if (this.nextT < now + 0.3) this.nextT = now + 0.3;
      return;
    }
    if (this.nextT < now - 0.05) this.nextT = now + 0.05; // the tab was asleep: carry on from here, do not catch up
    let guard = 0;
    while (this.nextT < now + 0.25 && guard++ < 8) {
      this.onStep(this.step, this.nextT);
      this.step++;
      this.nextT += this.stepDur;
    }
  }

  private onStep(step: number, t: number): void {
    const l = this.layer;
    if (!l) return;
    const c = this.core;
    const out = l.out;
    const s = step % 8;
    const bar = Math.floor(step / 8);
    const m = this.mode;
    const I = this.beat;
    const bass = this.prog[bar % 4];

    if (m === 'arena') {
      // the pulse: nothing in the lull, the beat in the swell, a 3+3+2 at the peak
      if (I === 1 && (s === 0 || s === 4)) c.drum(out, t, s === 0 ? 0.15 : 0.085);
      if (I === 2) {
        if (s === 0 || s === 3 || s === 6) c.drum(out, t, s === 0 ? 0.19 : 0.11);
        if (s % 2 === 1) c.noise(out, t, 0.022, 0.018, 6200, 'highpass', { pri: 0 });
      }
      // the figure: on the beat in the swell, every step at the peak
      const d = this.figure[s];
      if (I >= 1 && d >= 0 && (I === 2 || s % 2 === 0)) {
        c.pluck(out, t, this.note(d + bass), (I === 2 ? 0.055 : 0.045) * (s % 4 === 0 ? 1.3 : 1), 'banjo', s % 2 ? 0.25 : -0.25);
      }
    } else if (m === 'boss') {
      // the war drum never stops; the horn answers every other bar, and on the fourth it sits a semitone above the root
      if (s === 0 || (I > 0 && s === 3) || s === 6) c.drum(out, t, s === 0 ? 0.26 : 0.17, true);
      if (I === 2 && s % 2 === 1) c.drum(out, t, 0.06);
      if (s === 0 && bar % 2 === 0) c.sustain(out, t, this.note(bar % 8 === 6 ? 1 : 0) - 12, this.stepDur * 6, 0.05 + 0.015 * I, 'horn', 0, 0.3 + 0.25 * I);
      const d = BOSS_FIGURE[s];
      if (I >= 1 && d >= 0) c.pluck(out, t, this.note(d), 0.05 * (s === 0 ? 1.3 : 1), 'banjo', s % 2 ? 0.2 : -0.2);
    } else if (m === 'gate') {
      // a heart, and now and then the horn from the other side
      if (s === 0) c.drum(out, t, 0.11, true);
      if (s === 1) c.drum(out, t, 0.07, true);
      if (s === 0 && bar % 4 === 2) c.sustain(out, t, this.note(0) - 12, this.stepDur * 7, 0.035, 'horn', 0, 0.15);
    }

    // ---- phrases
    if (this.phrase.length) {
      const rel = step - this.phraseStart;
      for (const n of this.phrase) if (n.at === rel) this.sing(n, t);
      if (step >= this.phraseEnd) {
        this.phrase = [];
        this.restUntil = bar + 1 + this.restBars();
      }
    } else if (s === 0 && bar >= this.restUntil && chance(this.phraseOdds())) this.startPhrase(step, t);
  }

  private restBars(): number {
    const m = this.mode;
    const I = this.beat;
    if (m === 'arena') return I === 0 ? 1 + Math.floor(Math.random() * 3) : I === 1 ? 1 + Math.floor(Math.random() * 2) : Math.floor(Math.random() * 2);
    if (m === 'boss') return I === 2 ? Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 2);
    if (m === 'town') return Math.floor(Math.random() * 3); // a bar here is four seconds
    if (m === 'gate') return 4 + Math.floor(Math.random() * 4);
    return 1 + Math.floor(Math.random() * 2); // camp, fallen
  }
  private phraseOdds(): number {
    const m = this.mode;
    if (m === 'arena') return [0.55, 0.75, 0.9][this.beat];
    if (m === 'boss') return [0.3, 0.6, 0.85][this.beat];
    return m === 'gate' ? 0.35 : 0.7;
  }

  private startPhrase(step: number, t: number): void {
    const m = this.mode;
    const five = m === 'town' || m === 'camp';
    let ph: PNote[];
    if (m === 'gate') ph = [{ at: 0, deg: 1, len: 4 }, { at: 4, deg: 0, len: 8 }]; // the flat second falling to the root
    else if (m === 'fallen') {
      let d = pick([4, 2, 7]);
      ph = [];
      for (let i = 0, at = 0; i < 3; i++) {
        const len = i === 2 ? 8 : 4;
        ph.push({ at, deg: d, len });
        at += len;
        d -= pick([1, 1, 2]);
      }
    } else ph = chance(0.3) ? this.quote() : this.invent();
    if (five) {
      // five notes only: a degree outside them steps down to the nearest one inside
      const ok = this.minorish ? [0, 2, 3, 4, 6] : [0, 1, 2, 4, 5];
      for (const n of ph) while (!ok.includes(((n.deg % 7) + 7) % 7)) n.deg--;
    }
    this.phrase = ph;
    this.phraseStart = step;
    const last = ph[ph.length - 1];
    this.phraseEnd = step + last.at + last.len;
    const I = this.beat;
    if (m === 'arena') {
      this.phraseVoice = I === 0 ? 'lute' : 'bow';
      this.phraseReg = 12;
    } else if (m === 'boss' || m === 'gate' || m === 'fallen') {
      this.phraseVoice = 'bow';
      this.phraseReg = 0;
    } else {
      // the quiet places: a lute, with a mouth-organ at camp and now and then a bow in town, kept around middle C
      this.phraseVoice = m === 'camp' ? (chance(0.45) ? 'reed' : 'lute') : chance(0.2) ? 'bow' : 'lute';
      this.phraseReg = this.root >= 54 ? 0 : 12;
    }
    // in the quiet places a phrase starts over a low string
    if ((m === 'town' || m === 'camp') && this.layer) this.core.pluck(this.layer.out, t, this.note(pick([0, 0, 4])) - 12, 0.09, 'lute', -0.15);
  }
  private quote(): PNote[] {
    const up = this.mode === 'arena' && chance(0.3) ? 4 : 0; // sometimes from the fifth
    return MOTIF.map(([at, deg, len]) => ({ at, deg: deg + up, len }));
  }
  /** A new phrase: mostly steps, a leap now and then, ending long on the root, the fifth or the octave. */
  private invent(): PNote[] {
    const n = 3 + Math.floor(Math.random() * 4);
    const ph: PNote[] = [];
    let deg = pick([0, 2, 4, 4, 7]);
    let at = 0;
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      if (last) deg = [0, 4, 7].reduce((a, b) => (Math.abs(b - deg) < Math.abs(a - deg) ? b : a));
      const len = last ? pick([4, 6, 8]) : pick([1, 2, 2, 2, 4]);
      ph.push({ at, deg, len });
      at += len;
      deg = Math.max(-3, Math.min(9, deg + pick([-2, -1, -1, -1, 1, 1, 1, 2, 2, 4, -3])));
    }
    return ph;
  }
  private sing(n: PNote, t: number): void {
    const l = this.layer;
    if (!l) return;
    const c = this.core;
    const midi = this.note(n.deg) + this.phraseReg;
    const I = this.mode === 'arena' || this.mode === 'boss' ? this.beat : 0;
    const v = this.phraseVoice;
    const pan = v === 'bow' ? 0.2 : -0.1;
    if (v === 'lute' || v === 'banjo') c.pluck(l.out, t, midi, this.mode === 'arena' ? 0.11 : 0.12, v as Timbre, pan);
    else {
      const quiet = this.mode === 'town' || this.mode === 'camp' || this.mode === 'fallen' || this.mode === 'gate';
      c.sustain(l.out, t, midi, n.len * this.stepDur * 0.92, (quiet ? 0.045 : 0.04 + 0.008 * I) * (v === 'reed' ? 0.55 : 1), v, pan, quiet ? 0.25 : 0.35 + 0.2 * I);
    }
  }

  // --------------------------------------------------------------- stingers
  /** A short phrase for something that happened, in the current key, on the stinger bus. Returns its length in seconds. */
  stinger(kind: Stinger, station: Station = ''): number {
    const c = this.core;
    const j = c.jingle;
    const t = c.now + 0.02;
    const bright = SCALES[Math.min(1, this.home)]; // coming home and winning are in the major, whatever the ground
    const N = (deg: number, scale = this.scale): number => this.note(deg, scale) + 12;
    const run = (degs: number[], gap: number, vol: number, timbre: Timbre = 'lute', at = t, scale = this.scale): void => {
      degs.forEach((d, i) => c.pluck(j, at + i * gap, N(d, scale), vol, timbre, (i % 2 ? 0.2 : -0.2)));
    };
    switch (kind) {
      case 'buy': // two coins
        c.ring(j, t, 2900, [1, 1.52, 2.9], 0.09, 0.12, { pri: 2 });
        c.ring(j, t + 0.06, 3650, [1, 1.52, 2.9], 0.09, 0.16, { pri: 2 });
        return 0.25;
      case 'merge':
        run([0, 2, 4, 7], 0.06, 0.2);
        return 0.5;
      case 'craft': {
        // first the sound of the bench it was made on, then the top of the motif
        if (station === 'workshop') {
          for (const at of [0, 0.14]) {
            c.tone(j, t + at, 430, 0.06, 'sine', 0.22, { pri: 2 });
            c.tone(j, t + at, 905, 0.03, 'triangle', 0.11, { pri: 2 });
            c.noise(j, t + at, 0.008, 0.12, 3000, 'highpass', { pri: 2 });
          }
        } else if (station === 'apothecary') {
          c.ring(j, t, 3100, [1, 2.32, 3.86], 0.15, 0.35, { pri: 2 });
          for (let i = 0; i < 4; i++) c.tone(j, t + 0.04 + i * 0.05, 380 + i * 90, 0.045, 'sine', 0.13, { slideTo: (380 + i * 90) * 1.5, attack: 0.008, pri: 1 });
        } else if (station === 'camp') {
          c.noise(j, t, 0.3, 0.16, 300, 'lowpass', { attack: 0.05, buf: 'brown', pri: 2 });
          for (let i = 0; i < 4; i++) c.noise(j, t + rnd(0.02, 0.25), 0.012, 0.09, rnd(1800, 4500), 'bandpass', { q: 2, pri: 1 });
        } else {
          c.ring(j, t, 1100, BAR, 0.13, 0.5, { pri: 2 });
          c.tone(j, t, 190, 0.05, 'sine', 0.2, { slideTo: 120, pri: 2 });
          c.ring(j, t + 0.15, 1100, BAR, 0.05, 0.3, { pri: 1 });
        }
        run([4, 7], 0.13, 0.2, 'lute', t + 0.24);
        return 0.9;
      }
      case 'level':
        run([0, 4, 7, 9], 0.07, 0.22);
        c.sustain(j, t + 0.21, N(9), 0.45, 0.07, 'bow', 0.1, 0.6);
        return 1.1;
      case 'evolve':
        run([0, 2, 4, 7, 9, 11, 14], 0.085, 0.2);
        c.sustain(j, t, N(0) - 12, 0.9, 0.09, 'horn', 0, 0.5);
        c.noise(j, t, 0.9, 0.07, 400, 'bandpass', { slideTo: 4000, attack: 0.3, pri: 1 });
        c.drum(j, t + 0.6, 0.2, true);
        return 1.7;
      case 'waveClear':
        run([2, 4, 7], 0.1, 0.18);
        c.sustain(j, t + 0.2, N(0), 0.5, 0.05, 'bow', 0, 0.3);
        return 1;
      case 'richOpen': // veins open: three high rings climbing
        [0, 4, 7].forEach((d, i) => c.ring(j, t + i * 0.08, midiHz(N(d) + 12), [1, 2.01, 3.03], 0.1, 0.45, { pri: 2 }));
        return 0.7;
      case 'richClose':
        [4, 0].forEach((d, i) => c.ring(j, t + i * 0.1, midiHz(N(d) + 12), [1, 2.01], 0.07, 0.3, { pri: 1 }));
        return 0.5;
      case 'objective':
        run([0, 2, 4, 7], 0.08, 0.17, 'banjo');
        c.drum(j, t, 0.16);
        return 0.7;
      case 'bossDown': {
        // drums, horns on the root and the fifth, the motif broad on the bow, a strummed chord to close
        c.drum(j, t, 0.42, true);
        c.drum(j, t + 0.18, 0.3, true);
        c.sustain(j, t + 0.05, N(0, bright) - 24, 1.6, 0.075, 'horn', -0.2, 0.7);
        c.sustain(j, t + 0.05, N(4, bright) - 24, 1.6, 0.06, 'horn', 0.2, 0.7);
        const at = [0.3, 0.62, 0.94, 1.1, 1.26];
        MOTIF.forEach(([, deg], i) => c.sustain(j, t + at[i], N(deg, bright), i === 4 ? 1.1 : 0.28, 0.085, 'bow', 0.1, 0.7));
        [0, 4, 7, 9].forEach((d, i) => c.pluck(j, t + 1.3 + i * 0.03, N(d, bright), 0.18, 'lute', -0.2 + i * 0.13));
        return 3;
      }
      case 'cleared':
      case 'extract': {
        // home: a low string, a rising run, and the bow settling on the root
        c.pluck(j, t, N(0, bright) - 24, 0.22, 'lute', -0.1);
        run([0, 2, 4, 7], 0.14, 0.2, 'lute', t + 0.14, bright);
        c.sustain(j, t + 0.6, N(2, bright), 0.5, 0.075, 'bow', 0.15, 0.4);
        c.sustain(j, t + 1.15, N(0, bright), 1.1, 0.085, 'bow', 0.15, 0.4);
        if (kind === 'cleared') {
          c.drum(j, t + 1.15, 0.3, true);
          c.sustain(j, t + 1.15, N(0, bright) - 24, 1.4, 0.07, 'horn', -0.2, 0.7);
          c.sustain(j, t + 1.15, N(4, bright) - 24, 1.4, 0.055, 'horn', 0.2, 0.7);
          [0, 4, 7, 9].forEach((d, i) => c.pluck(j, t + 1.75 + i * 0.035, N(d, bright), 0.18, 'lute', -0.2 + i * 0.13));
        }
        return kind === 'cleared' ? 3.2 : 2.6;
      }
      case 'fall': {
        // a drum, and the bow going down by the flat second to the root
        const phr = SCALES[PHRYGIAN];
        c.drum(j, t, 0.4, true);
        c.noise(j, t, 1.6, 0.12, 180, 'lowpass', { attack: 0.3, buf: 'brown', pri: 2 });
        c.sustain(j, t + 0.1, N(4, phr) - 12, 0.5, 0.085, 'bow', 0, 0.25);
        c.sustain(j, t + 0.65, N(1, phr) - 12, 0.5, 0.085, 'bow', 0, 0.2);
        c.sustain(j, t + 1.2, N(0, phr) - 12, 1.3, 0.09, 'bow', 0, 0.15);
        return 2.9;
      }
    }
  }

  /** Release every node at once. */
  dispose(): void {
    if (this.layer) this.freeLayer(this.layer);
    for (const l of this.dying) this.freeLayer(l);
    this.layer = null;
    this.dying.length = 0;
    this.mode = 'off';
  }
}

/** Level of the drone at full, against plucks and bows written at about 0.05 to 0.1. */
const DRONE = 0.55;
