// All sound is synthesised with WebAudio; there are no audio files.
// This file is the game's side of it: which place we are in, what the arena events sound like, the settings.
// The mixer and instruments are in audio/core.ts, gathering impacts in audio/impacts.ts, ambience in
// audio/beds.ts, music and stingers in audio/music.ts. dev/audio.html auditions all of it.
import type { Game, GameEvent } from './game';
import type { UI } from './ui/app';
import { CFG, MATS } from './data';
import { Core, midiHz, type Ctx, type SpaceId } from './audio/core';
import { Beds, type Ground, type Place } from './audio/beds';
import { Music, type MusicMode, type Station, type Stinger } from './audio/music';
import { strike, type NodeSound } from './audio/impacts';
import { CHOICE_KEY, Samples } from './audio/samples';

const MUTE_KEY = 'craftworld.mute';
export type Channel = 'music' | 'amb';
const VOL_KEY: Record<Channel, string> = { music: 'craftworld.vol.music', amb: 'craftworld.vol.amb' };
// The owner played one expedition with the generated music and did not want it (2026-11-12): it is off unless turned up.
const VOL_DEFAULT: Record<Channel, number> = { music: 0, amb: 7 };
/** Bus gain at volume 10 of 10; the default 7 is half of it. Set from the measurements in dev/audio.ts. */
const LEVEL: Record<Channel, number> = { music: 2.2, amb: 2.6 };
export const VOL_STEPS = 10;

/** The sound settings are remembered between visits. */
function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
function readVol(ch: Channel): number {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(VOL_KEY[ch]) : null;
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(VOL_STEPS, Math.round(n))) : VOL_DEFAULT[ch];
  } catch {
    return VOL_DEFAULT[ch];
  }
}
function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable */
  }
}

/** The same thirds the renderer lights by (art/light.ts): waves 1 to 4 day, 5 to 8 dusk, 9 to 12 night. */
const todOf = (wave: number): number => (wave < 4 ? 0 : wave < 8 ? 1 : 2);
/** The hit slots a place will need. */
const WARM: Partial<Record<Place, string[]>> = {
  quarry: ['pick', 'crumble', 'pickup-stone'], grove: ['axe', 'treefall', 'pickup-wood'], marsh: ['sickle', 'reedfall', 'pickup-plant'],
  forge: ['anvil'], workshop: ['saw'], apothecary: ['brew'],
};
const BENCH: Partial<Record<Place, string>> = { forge: 'anvil', workshop: 'saw', apothecary: 'brew' };
const SPACE_OF: Record<Exclude<Place, 'none'>, SpaceId> = {
  quarry: 'quarry', grove: 'grove', marsh: 'marsh', town: 'town', forge: 'town', workshop: 'town', apothecary: 'town', camp: 'camp', gate: 'camp', cold: 'camp',
};

export class Sound {
  muted = readMuted();
  /** 0 to 10 for each channel. */
  volume: Record<Channel, number> = { music: readVol('music'), amb: readVol('amb') };
  core: Core | null = null;
  beds!: Beds;
  music!: Music;
  /** The recordings under public/audio/, where a slot has one chosen; everything else is synthesised. */
  samples!: Samples;
  private samplesSeen = -1;
  place: Place = 'none';
  private ctx: AudioContext | null = null;
  private awake = true; // the window has focus and is visible
  private offline = false;
  private sleepT = 0;
  private crowdGain!: GainNode;
  private crowdFilter!: BiquadFilterNode;
  private droneGain!: GainNode;
  private droneOsc!: OscillatorNode;
  private crowdK = 0;
  private chitterT = 0;
  private chain = 0;
  private lastPickup = -10;
  private tod = 0;
  private ground: Ground = 'quarry';
  private seenWave = false;
  private lastView = '';
  private bossDown = false;
  private lastFall = -100;
  private px = CFG.arena.w / 2;
  private duckUntil = 0;
  private duckDepth = 1;
  private depth = new Map<number, number>(); // strikes each node has taken, for the deepening cut

  /** Where the recordings are served from; the default is public/audio/. Set before `init` or `attach`. */
  samplesBase: string | undefined;
  /** False: never look for recordings (offline renders of the synthesised sound). Set before `attach`. */
  useSamples = true;
  /** `listen` false: an instance that only renders offline and should not follow the window's focus. */
  constructor(listen = true) {
    if (!listen || typeof window === 'undefined') return;
    // sound stops when the window is not in front, and comes back with it
    addEventListener('blur', () => this.setAwake(false));
    addEventListener('focus', () => this.setAwake(!document.hidden));
    // the soundboard in another tab chose a different recording
    addEventListener('storage', (e) => {
      if (e.key === CHOICE_KEY && this.core) this.samples.rereadChoice();
    });
    document.addEventListener('visibilitychange', () => this.setAwake(!document.hidden));
  }

  /** Must be called from a user gesture. */
  init(): void {
    if (this.ctx) {
      if (!this.muted && this.awake) void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.attach(this.ctx);
    this.apply();
  }

  /** Build the mixer on a context. The game calls this through `init`; dev/audio.ts also renders offline with it. */
  attach(ctx: Ctx): void {
    this.offline = ctx !== this.ctx; // a context of the caller's own: its clock is not ours to stop
    const core = (this.core = new Core(ctx));
    this.samples = new Samples(core, this.samplesBase);
    if (this.useSamples) void this.samples.load();
    else this.samples.settled = true;
    this.beds = new Beds(core, this.samples);
    this.music = new Music(core);
    this.place = 'none';
    for (const ch of ['music', 'amb'] as const) this.setVolume(ch, this.volume[ch], false);

    // enemy ambience: a noise bed and a low drone, both driven by the enemy count
    const src = core.loop('white');
    this.crowdFilter = ctx.createBiquadFilter();
    this.crowdFilter.type = 'bandpass';
    this.crowdFilter.frequency.value = 300;
    this.crowdFilter.Q.value = 0.8;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0;
    src.connect(this.crowdFilter).connect(this.crowdGain).connect(core.crowd);
    src.start();
    this.droneOsc = ctx.createOscillator();
    this.droneOsc.type = 'sawtooth';
    this.droneOsc.frequency.value = 49;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 170;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.droneOsc.connect(lp).connect(this.droneGain).connect(core.crowd);
    this.droneOsc.start();
  }

  /** True when sounds may be scheduled: there is a context and it is neither muted nor asleep. */
  get live(): boolean {
    return this.core !== null && (this.offline || (!this.muted && this.awake));
  }

  private setAwake(on: boolean): void {
    if (this.awake === on) return;
    this.awake = on;
    this.apply();
  }
  /** Fade the output out and stop the clock, or start it and fade back in. */
  private apply(): void {
    const ctx = this.ctx;
    if (!ctx || !this.core) return;
    const on = !this.muted && this.awake;
    clearTimeout(this.sleepT);
    if (on) {
      void ctx.resume();
      this.core.out.gain.setTargetAtTime(1, ctx.currentTime, 0.06);
    } else {
      this.core.out.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      this.sleepT = window.setTimeout(() => {
        if (this.muted || !this.awake) void ctx.suspend();
      }, 220);
    }
  }

  toggleMute(): void {
    this.muted = !this.muted;
    store(MUTE_KEY, this.muted ? '1' : '0');
    if (!this.ctx && !this.muted) this.init();
    else this.apply();
  }
  /** Music or ambience volume, 0 to 10. */
  setVolume(ch: Channel, v: number, save = true): void {
    v = Math.max(0, Math.min(VOL_STEPS, Math.round(v)));
    this.volume[ch] = v;
    if (save) store(VOL_KEY[ch], String(v));
    if (!this.core) return;
    const k = v / VOL_STEPS;
    this.core.glide((ch === 'music' ? this.core.musicVol : this.core.ambVol).gain, LEVEL[ch] * k * k, 0.05);
  }
  bumpVolume(ch: Channel, by: number): void {
    this.setVolume(ch, this.volume[ch] + by);
  }

  // ------------------------------------------------------------------ scene
  /**
   * Called every frame from the main loop, in menus as well as in the arena: works out which place this is,
   * moves the bed and the music to it, and runs their schedulers.
   */
  frame(_dt: number, game: Game | null, playing: boolean, paused: boolean, ui: UI): void {
    const core = this.core;
    if (!core || !this.live) return;
    const now = core.now;
    const view = ui.view;
    let place: Place = 'none';
    let mode: MusicMode = 'off';
    let tod = 0;
    let ground = this.ground;
    const inWave = playing && game !== null && (view === 'none' || view === 'pause');
    if (inWave) {
      ground = game.spec.ground;
      place = ground;
      tod = todOf(game.spec.index);
      this.seenWave = true;
      const over = game.phase === 'over';
      mode = over ? (game.res.died ? 'fallen' : 'off') : game.spec.boss ? (game.res.bossKilled ? 'off' : 'boss') : 'arena';
      if (game.res.bossKilled && !this.bossDown) this.jingle('bossDown');
      this.bossDown = game.res.bossKilled;
      this.px = game.p.x;
      this.music.setState(over || game.beat === 'lull' ? 0 : game.beat === 'swell' ? 1 : 2, game.heat / CFG.heat.max);
    } else if (view === 'run') {
      const run = ui.p.run;
      if (run) {
        if (!this.seenWave) ground = run.route.ground; // straight from a save: the camp is on the ground ahead
        tod = todOf(run.wave);
        place = mode = run.phase === 'gate' ? 'gate' : 'camp';
      }
    } else if (view === 'town' || view === 'welcome') {
      const tab = view === 'town' ? ui.s.tab : '';
      place = tab === 'Forge' ? 'forge' : tab === 'Workshop' ? 'workshop' : tab === 'Apothecary' ? 'apothecary' : 'town';
      mode = 'town';
    } else if (view === 'summary') {
      const out = ui.summary?.outcome ?? 'died';
      if (this.lastView !== 'summary') {
        if (out !== 'died') this.jingle(out === 'cleared' ? 'cleared' : 'extract');
        else if (now - this.lastFall > 6) this.jingle('fall'); // abandoned from the pause screen: no fall was heard yet
      }
      place = out === 'died' ? 'cold' : 'town';
      mode = out === 'died' ? 'fallen' : 'town';
    }
    this.lastView = view;
    this.scene(place, tod, ground, mode);
    this.step(paused && inWave);
  }

  /** One turn of the mixer: `frame` ends with this; the lab calls it on its own clock. */
  step(held: boolean): void {
    const core = this.core;
    if (!core) return;
    const now = core.now;
    // paused: the world goes behind glass and nothing new is played
    core.setMuffled(held);
    this.music.hold = held;
    // the music gives way to the enemy drone, and briefly to anything that must be heard
    const ducked = now < this.duckUntil;
    core.glide(core.duck.gain, (1 - 0.5 * this.crowdK) * (ducked ? this.duckDepth : 1), ducked ? 0.03 : 0.3, now);
    core.tick();
    this.beds.tick();
    this.music.tick();
  }

  /** Move to a place: its bed, how it echoes, its music. The lab calls this directly. */
  scene(place: Place, tod: number, ground: Ground, mode: MusicMode): void {
    const core = this.core;
    if (!core) return;
    // the bed is rebuilt when the place changes, and when the recordings on offer or the owner's choice of them do
    if (place !== this.place || tod !== this.tod || ground !== this.ground || this.samples.version !== this.samplesSeen) {
      if (place !== this.place) this.depth.clear();
      this.place = place;
      this.tod = tod;
      this.ground = ground;
      this.samplesSeen = this.samples.version;
      this.beds.set(place, tod, ground);
      if (place !== 'none') core.setSpace(SPACE_OF[place]);
      // fetch this place's hits now, so that the first swing is already the recording
      for (const slot of WARM[place] ?? []) this.samples.warm(slot);
    }
    // Music at volume 0 is not merely silent: nothing is built and nothing is scheduled.
    // The short feedback phrases (craft, level, buy...) are not music: they go to the `jingle` bus and still play.
    this.music.setMode(this.volume.music > 0 ? mode : 'off', ground);
    this.music.setKey(mode, ground);
    core.glide(this.droneOsc.frequency, this.music.crowdHz, 0.5);
  }
  /** Let the music drop to `depth` for `seconds`, so something else is heard. */
  private duck(depth: number, seconds: number): void {
    const now = this.core?.now ?? 0;
    if (now < this.duckUntil && this.duckDepth < depth && this.duckUntil > now + seconds) return; // a deeper, longer one is in force
    this.duckDepth = now < this.duckUntil ? Math.min(depth, this.duckDepth) : depth;
    this.duckUntil = Math.max(this.duckUntil, now + seconds);
  }
  /** A stinger, with the music held under it. */
  jingle(kind: Stinger, station: Station = ''): void {
    if (!this.live) return;
    const len = this.music.stinger(kind, station);
    if (len > 0.6) this.duck(0.35, len);
  }

  // ------------------------------------------------------------- primitives
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo = 0, delay = 0, pri = 1): void {
    const c = this.core;
    if (c) c.tone(c.sfx, c.now + delay, freq, dur, type, vol, { slideTo, pri });
  }
  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass', slideTo = 0, pri = 1): void {
    const c = this.core;
    if (c) c.noise(c.sfx, c.now, dur, vol, freq, type, { slideTo, pri });
  }
  /** A note of the current key's five-note scale, counted up from a root near C5. */
  private reward(i: number): number {
    const p = this.music.penta;
    return midiHz(this.music.rewardRoot + p[i % 5] + 12 * Math.floor(i / 5));
  }

  /** Called every frame: the more enemies, the louder and busier the ambience. */
  crowd(count: number, dt: number): void {
    const c = this.core;
    if (!c || !this.live) return;
    const k = Math.min(1, count / 45);
    this.crowdK = k;
    c.glide(this.crowdGain.gain, k * 0.2, 0.25);
    c.glide(this.crowdFilter.frequency, 240 + k * 900, 0.25);
    c.glide(this.droneGain.gain, k * k * 0.22, 0.25);
    if (count <= 0) return;
    this.chitterT -= dt;
    if (this.chitterT <= 0) {
      this.tone(900 + Math.random() * 1500, 0.03, 'square', 0.012 + 0.025 * k, 0, 0, 0);
      this.chitterT = (0.5 + Math.random()) / Math.min(16, 0.4 + count * 0.35);
    }
  }

  private lastAt: Record<string, number> = {};
  /** Many weapons fire at once; do not let one kind of sound stack up. */
  private gate(key: string, gap: number): boolean {
    const now = this.core?.now ?? 0;
    if (now - (this.lastAt[key] ?? -1) < gap) return false;
    this.lastAt[key] = now;
    return true;
  }

  onEvent(e: GameEvent, now: number): void {
    const c = this.core;
    if (!c || !this.live) return;
    switch (e.t) {
      case 'shot':
        if (this.gate('shot', 0.07)) this.noise(0.04, 0.04, 1800, 'highpass', 0, 0);
        break;
      case 'sweep':
        if (this.gate('sweep', 0.09)) this.noise(0.09, 0.06, 1200, 'bandpass', 500, 0);
        break;
      case 'burst':
        if (this.gate('burst', 0.08)) {
          this.tone(95, 0.18, 'sine', 0.22, 45);
          this.noise(0.12, 0.1, 500);
        }
        break;
      case 'tink':
        if (this.gate('tink', 0.1)) this.tone(2400, 0.05, 'triangle', 0.05, 0, 0, 0);
        break;
      case 'kill':
        if (e.sweep) break;
        if (e.big) {
          this.tone(160, 0.5, 'sawtooth', 0.2, 40, 0, 2);
          this.noise(0.4, 0.2, 400, 'lowpass', 0, 2);
          this.duck(0.55, 0.5);
        } else if (e.kind === 'swarm') {
          if (this.gate('pop', 0.04)) this.tone(520, 0.07, 'square', 0.04, 180, 0, 0);
        } else if (this.gate('kill', 0.06)) {
          this.tone(200, 0.2, 'sawtooth', 0.09, 60);
          this.noise(0.18, 0.1, 500);
        }
        break;
      case 'swing':
        this.noise(0.14, e.hits || e.struck ? 0.1 : 0.16, 900, 'bandpass', 250);
        break;
      case 'heavyHit':
        if (this.gate('heavy', 0.03)) {
          this.tone(110, 0.16, 'sine', 0.3, 45);
          this.noise(0.08, 0.14, 700);
        }
        break;
      case 'shieldBreak':
        this.tone(1500, 0.25, 'triangle', 0.14, 500, 0, 2);
        this.noise(0.22, 0.16, 3500, 'highpass', 0, 2);
        this.duck(0.6, 0.3);
        break;
      case 'nodeStrike': {
        const m = e.mat ? MATS[e.mat] : null;
        const kind: NodeSound = !m ? 'nest' : m.cat === 'ore' ? 'ore' : m.cat === 'wood' ? 'wood' : 'herb';
        const key = Math.round(e.x) * 4096 + Math.round(e.y);
        const depth = this.depth.get(key) ?? 0;
        if (e.broke) this.depth.delete(key);
        else this.depth.set(key, depth + 1);
        strike(c, { kind, tier: m?.tier ?? 1, rich: e.rich, broke: e.broke, depth, pan: Math.max(-0.6, Math.min(0.6, (e.x - this.px) / 420)) }, c.now, this.samples);
        this.duck(0.6, e.broke ? 0.9 : 0.3);
        break;
      }
      case 'pickup': {
        // pitch climbs one step of the key's five-note scale per pickup while they keep chaining
        this.chain = now - this.lastPickup < 0.7 ? Math.min(this.chain + 1, 21) : 0;
        this.lastPickup = now;
        // a recorded pickup climbs too, by playing a little faster each time, up to an octave
        const cat = MATS[e.mat]?.cat;
        const slot = cat === 'ore' ? 'pickup-stone' : cat === 'wood' ? 'pickup-wood' : cat === 'herb' ? 'pickup-plant' : '';
        if (!slot || !this.samples.hit(slot, c.sfx, c.now, { rate: Math.pow(2, (Math.min(this.chain, 14) * 0.85) / 12), vol: 0.45, pri: 1 })) {
          this.tone(this.reward(this.chain), 0.12, 'triangle', 0.12);
        }
        if (e.part) [7, 9, 10, 12].forEach((i, n) => this.tone(this.reward(i), 0.2, 'triangle', 0.12, 0, n * 0.07, 2));
        break;
      }
      case 'hurt':
        this.tone(160, 0.22, 'sawtooth', 0.2, 70, 0, 2);
        this.noise(0.1, 0.15, 400, 'bandpass', 0, 2);
        this.duck(0.5, 0.4);
        break;
      case 'dodge':
        this.noise(0.18, 0.12, 500, 'bandpass', 2200);
        break;
      case 'noStamina':
        this.tone(140, 0.09, 'square', 0.07);
        break;
      case 'early': // let go before the wind-up was full
        if (this.gate('early', 0.15)) this.tone(170, 0.07, 'square', 0.06, 120);
        break;
      case 'notReady': // the ability is still cooling
        if (this.gate('notReady', 0.15)) [150, 110].forEach((f, i) => this.tone(f, 0.08, 'square', 0.07, 0, i * 0.09));
        break;
      case 'closedVein':
        this.tone(260, 0.12, 'triangle', 0.08, 180);
        break;
      case 'ability':
        this.tone(330, 0.35, 'sawtooth', 0.14, 990, 0, 2);
        this.noise(0.3, 0.14, 800, 'bandpass', 3000, 2);
        this.duck(0.6, 0.4);
        break;
      case 'swap':
        this.tone(880, 0.06, 'triangle', 0.1, 1320);
        break;
      case 'beat':
        // the peak is called on the fifth of the key
        if (e.beat === 'peak') for (let i = 0; i < 3; i++) this.tone(this.reward(3), 0.16, 'square', 0.1, this.reward(3) * 0.76, i * 0.22, 2);
        break;
      case 'richOpen':
        this.jingle('richOpen');
        break;
      case 'richClose':
        this.jingle('richClose');
        break;
      case 'burrowUp':
        this.tone(70, 0.5, 'sawtooth', 0.16, 150);
        this.noise(0.4, 0.12, 200, 'lowpass');
        break;
      case 'nodeBite':
        this.noise(0.12, 0.14, 1200);
        this.tone(e.ate ? 220 : 300, 0.12, 'square', 0.06, 120);
        break;
      case 'spit':
        if (this.gate('spit', 0.15)) this.tone(420, 0.14, 'sine', 0.08, 160, 0, 0);
        break;
      case 'telegraph':
        this.tone(220, 0.5, 'square', 0.08, 660);
        break;
      case 'say': {
        // a call falling from the fifth to the root
        const r = midiHz(this.music.rewardRoot - 12);
        [r * 1.498, r].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.1, 0, i * 0.18, 2));
        this.duck(0.5, 0.9);
        break;
      }
      case 'objective':
        this.jingle('objective');
        break;
      case 'over':
        if (e.died) {
          this.tone(220, 0.9, 'sawtooth', 0.18, 40, 0, 2);
          this.jingle('fall');
          this.lastFall = c.now;
        } else this.jingle('waveClear');
        break;
    }
  }

  /** Short interface sounds for the camp and town screens. */
  ui(kind: 'buy' | 'craft' | 'deny' | 'merge' | 'click' | 'evolve' | 'level'): void {
    const c = this.core;
    if (!c || !this.live) return;
    if (kind === 'deny') c.tone(c.ui, c.now, 140, 0.12, 'square', 0.07);
    else if (kind === 'click') {
      // a fingernail on wood
      c.tone(c.ui, c.now, 520, 0.035, 'sine', 0.07, { slideTo: 380 });
      c.noise(c.ui, c.now, 0.006, 0.05, 3500, 'highpass');
    } else if (kind === 'craft') {
      const p = this.place;
      // at a bench with a recording chosen, the thing made is announced by the bench itself and nothing else
      const bench = BENCH[p];
      if (bench && this.samples.hit(bench, c.jingle, c.now, { vol: 0.8 })) return;
      this.jingle('craft', p === 'forge' || p === 'workshop' || p === 'apothecary' || p === 'camp' ? p : p === 'gate' ? 'camp' : '');
    } else this.jingle(kind);
  }
}
