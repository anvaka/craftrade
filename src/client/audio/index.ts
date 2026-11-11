// Audio engine. Everything is synthesised in WebAudio; there are no files.
//
//   import { audio } from './audio/index.ts';
//   audio.play('chop', { pan: -0.3 });           // pan -1..1, pitch multiplier, gain multiplier
//   audio.play('pickup');                        // rises along a streak, resets after 0.6 s; so do 'scrip' and 'kill'
//   const stop = audio.loop('anvil');            // fusion wait; call stop() then play('reveal')
//   audio.setBed(0.4);  audio.setBed(null);      // the work song at a level 0..1, or silent (bench, pause, run end)
//   audio.setVolume(0.6); audio.toggleMute(); audio.setSong(false);   // all persisted
//   audio.onChange(() => redrawMuteButton());
//
// Behaviour
//   - Silent until the first key, click or touch (browser autoplay rules).
//     The engine listens for that itself on import; play() before it is a no-op.
//   - Chain: voices -> combat | alert | fx | bed -> bus -> compressor -> limiter -> volume -> out.
//   - An alert (telegraph, hurt, elite, boss, death) holds the combat bus and
//     the bed down while it sounds, so a wall of hits cannot mask a warning.
//   - Each sound has its own voice cap and minimum gap (sounds.ts), and there
//     is a global cap, so 50 kills in one frame make one kill sound.
//   - Every play drifts a little in pitch so repeats do not machine-gun.
//   - Volume, mute and the work song switch live in localStorage under
//     "scrip.audio"; failures to read or write are ignored.
//   - The context is suspended while the tab is hidden.
//   - new AudioEngine(offlineContext) builds the same chain on an
//     OfflineAudioContext, for measuring levels without a listener.
//
// Sound ids (SOUND_IDS): chop chopBreak clink clinkBreak scrape scrapeBreak
// pickup scrip edge blunt shot musket hit crit kill hurt dodge telegraph elite
// boss bossDeath steal levelUp waveStart waveEnd heart paid buy reroll lock
// combine anvil reveal revealFirst relic stamp mule death win

import { Kit } from './kit.ts';
import { BED_BAR, scheduleBar } from './music.ts';
import { SOUNDS, SOUND_IDS, type Bus, type SoundId } from './sounds.ts';

export { SOUND_IDS, type SoundId };

export interface PlayOpts {
  /** Stereo position, -1 (left) to 1 (right). */
  pan?: number;
  /** Pitch multiplier. 1 is as written. */
  pitch?: number;
  /** Gain multiplier. 1 is as written. */
  gain?: number;
  /** Context time to start at. For offline renders; live play starts now. */
  at?: number;
  /** Play an alert without holding the other buses down (a warning that is not aimed at the player). */
  noDuck?: boolean;
}

const STORE_KEY = 'scrip.audio';
const MAX_VOICES = 28;
// Streaks: a sound played again inside its window steps up a scale, then
// holds at the top. Raws climb two octaves of a five-note scale; scrip, which
// starts much higher, climbs a little over one; kills climb a fifth.
interface Ladder { window: number; scale: readonly number[] }
const LADDER: Partial<Record<SoundId, Ladder>> = {
  pickup: { window: 0.6, scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] },
  scrip: { window: 0.5, scale: [0, 2, 4, 7, 9, 12, 14, 16] },
  kill: { window: 0.7, scale: [0, 0, 1, 2, 3, 4, 5, 7] },
};
/** How far an alert pushes the combat bus and the bed down. */
const DUCK_COMBAT = 0.4;
const DUCK_BED = 0.3;
/** The bed's own level on its bus. Set by measurement: see tools/exp/feel/audio.cjs. */
export const BED_GAIN = 0.22;

export class AudioEngine {
  private ac: BaseAudioContext | null = null;
  private bus: GainNode | null = null;
  private buses: Record<Bus, GainNode> | null = null;
  private bedGain: GainNode | null = null;
  private bedDuck: GainNode | null = null;
  private master: GainNode | null = null;
  private nbuf: AudioBuffer | null = null;
  private live = new Map<SoundId, number[]>();
  private lastStart = new Map<SoundId, number>();
  private total: number[] = [];
  private streak = new Map<SoundId, { n: number; at: number }>();
  private duckUntil = -10;
  private vol = 0.7;
  private mute = false;
  private song = true;
  private bedWant: number | null = null;
  private bedTimer: ReturnType<typeof setInterval> | null = null;
  private bedNext = 0;
  private bedBar = 0;
  private listeners = new Set<() => void>();
  private armed = false;
  private offline = false;
  /** Offline renders can switch the ducking off to measure what it buys. */
  ducking = true;

  constructor(offline?: BaseAudioContext) {
    if (offline) {
      this.offline = true;
      this.vol = 1;
      this.setup(offline);
      this.bedGain!.gain.value = BED_GAIN;
      return;
    }
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { v?: unknown; m?: unknown; s?: unknown };
        if (typeof s.v === 'number' && s.v >= 0 && s.v <= 1) this.vol = s.v;
        if (typeof s.m === 'boolean') this.mute = s.m;
        if (typeof s.s === 'boolean') this.song = s.s;
      }
    } catch {
      // private mode or blocked storage: keep defaults
    }
    this.arm();
  }

  /** Build the chain on a context: four buses into one, a compressor, a limiter, the volume. */
  private setup(ac: BaseAudioContext): void {
    const bus = ac.createGain();
    bus.gain.value = 0.8;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 8;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.14;
    const limit = ac.createDynamicsCompressor();
    limit.threshold.value = -3;
    limit.knee.value = 0;
    limit.ratio.value = 20;
    limit.attack.value = 0.001;
    limit.release.value = 0.06;
    const master = ac.createGain();
    master.gain.value = this.mute ? 0 : this.vol;
    bus.connect(comp);
    comp.connect(limit);
    limit.connect(master);
    master.connect(ac.destination);
    const mk = (): GainNode => {
      const g = ac.createGain();
      g.connect(bus);
      return g;
    };
    this.buses = { combat: mk(), alert: mk(), fx: mk() };
    // the work song: its own level, then the duck, then the bus
    const bedDuck = mk();
    const bedGain = ac.createGain();
    bedGain.gain.value = 0;
    bedGain.connect(bedDuck);
    // two seconds of white noise, shared by every voice
    const nbuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = nbuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.ac = ac;
    this.bus = bus;
    this.bedGain = bedGain;
    this.bedDuck = bedDuck;
    this.master = master;
    this.nbuf = nbuf;
  }

  /** Listen for the first input and unlock on it. Safe to call twice. */
  private arm(): void {
    if (this.armed || typeof window === 'undefined') return;
    this.armed = true;
    // Kept for the life of the page: iOS Safari only counts touchend and click
    // as a gesture, and it can put a running context back to sleep
    // ("interrupted") after a call, an alarm or a trip to another app.
    const go = (): void => {
      if (!this.ac || this.ac.state !== 'running') this.unlock();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchend', 'click'] as const) window.addEventListener(ev, go, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      const ac = this.ac as AudioContext | null;
      if (!ac) return;
      if (document.hidden) void ac.suspend();
      else void ac.resume();
    });
  }

  /** Create or resume the context. Must run inside a user gesture the first time. */
  unlock(): void {
    if (this.offline) return;
    try {
      if (!this.ac) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.setup(new AC({ latencyHint: 'interactive' }));
        this.syncBed();
      }
      const ac = this.ac as AudioContext;
      if (ac.state !== 'running' && !document.hidden) void ac.resume();
    } catch {
      // no audio device: stay silent
    }
  }

  /** True once sound can come out. */
  get ready(): boolean {
    return !!this.ac && this.ac.state === 'running';
  }

  play(id: SoundId, opts: PlayOpts = {}): void {
    const ac = this.ac;
    const def = SOUNDS[id];
    if (!ac || !this.bus || !this.buses || !this.nbuf || !def || this.mute) return;
    // A context still waking from the unlocking gesture queues the sound;
    // a hidden tab or a closed context drops it.
    if (!this.offline && (ac.state === 'closed' || (ac.state !== 'running' && document.hidden))) return;
    const now = opts.at ?? ac.currentTime;

    // voice limits
    let voices = this.live.get(id);
    if (!voices) this.live.set(id, (voices = []));
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i]! <= now) voices.splice(i, 1);
    if (voices.length >= def.max) return;
    if (now - (this.lastStart.get(id) ?? -10) < def.gap) return;
    for (let i = this.total.length - 1; i >= 0; i--) if (this.total[i]! <= now) this.total.splice(i, 1);
    if (this.total.length >= MAX_VOICES) return;

    let pitch = (opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * def.vary);
    const ladder = LADDER[id];
    if (ladder) {
      let st = this.streak.get(id);
      if (!st) this.streak.set(id, (st = { n: 0, at: -10 }));
      st.n = now - st.at <= ladder.window ? Math.min(st.n + 1, ladder.scale.length - 1) : 0;
      st.at = now;
      pitch *= Math.pow(2, ladder.scale[st.n]! / 12);
    }

    const t = now + 0.005 + Math.random() * 0.006;
    const voice = ac.createGain();
    voice.gain.value = def.gain * (opts.gain ?? 1);
    let tail: AudioNode = voice;
    if (opts.pan && typeof ac.createStereoPanner === 'function') {
      const pan = ac.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, opts.pan));
      voice.connect(pan);
      tail = pan;
    }
    tail.connect(this.buses[def.bus]);
    if (def.duck > 0 && !opts.noDuck) this.duck(t, def.duck);

    const kit = new Kit(ac, voice, this.nbuf, pitch, t);
    def.make(kit, t);
    const end = t + kit.end + 0.05;
    voices.push(end);
    this.total.push(end);
    this.lastStart.set(id, now);
    if (this.offline) return;
    // free the voice's nodes once it has rung out
    const ms = (end - now) * 1000 + 60;
    setTimeout(() => {
      try {
        tail.disconnect();
        if (tail !== voice) voice.disconnect();
      } catch {
        // already gone
      }
    }, ms);
  }

  /** Hold the combat bus and the bed down from t for `seconds`, then let them back up. */
  private duck(t: number, seconds: number): void {
    if (!this.ducking || !this.buses || !this.bedDuck) return;
    const until = t + seconds;
    if (until <= this.duckUntil) return;
    this.duckUntil = until;
    const c = this.buses.combat.gain;
    const b = this.bedDuck.gain;
    c.cancelScheduledValues(t);
    c.setTargetAtTime(DUCK_COMBAT, t, 0.012);
    c.setTargetAtTime(1, until, 0.09);
    b.cancelScheduledValues(t);
    b.setTargetAtTime(DUCK_BED, t, 0.02);
    b.setTargetAtTime(1, until, 0.25);
  }

  /**
   * Repeat a sound end to end until the returned function is called.
   * Meant for 'anvil' (1.5 s) while a fusion is being decided.
   */
  loop(id: SoundId, period = 1.5, opts: PlayOpts = {}): () => void {
    this.play(id, opts);
    const h = setInterval(() => this.play(id, opts), period * 1000);
    return () => clearInterval(h);
  }

  // ---- the work song -------------------------------------------------------

  /** Set the bed's level, 0..1 (see music.ts), or null for silence. A new level is heard from the next bar. */
  setBed(level: number | null): void {
    if (level === this.bedWant) return;
    const was = this.bedWant;
    this.bedWant = level;
    if ((was === null) !== (level === null)) this.syncBed();
  }

  /** The level last asked for; null when the bed is meant to be silent. */
  get bed(): number | null {
    return this.bedWant;
  }

  private syncBed(): void {
    const ac = this.ac;
    if (!ac || !this.bedGain || this.offline) return;
    const on = this.bedWant !== null && this.song && !this.mute;
    const g = this.bedGain.gain;
    const now = ac.currentTime;
    g.cancelScheduledValues(now);
    g.setTargetAtTime(on ? BED_GAIN : 0, now, on ? 0.2 : 0.07);
    if (on && this.bedTimer === null) {
      this.bedTimer = setInterval(() => this.pumpBed(), 180);
      this.pumpBed();
    } else if (!on && this.bedTimer !== null) {
      clearInterval(this.bedTimer);
      this.bedTimer = null;
    }
  }

  /** Keep about half a second of bars written ahead of the clock. */
  private pumpBed(): void {
    const ac = this.ac;
    if (!ac || ac.state !== 'running' || this.bedWant === null) return;
    const now = ac.currentTime;
    if (this.bedNext < now) this.bedNext = now + 0.08;
    while (this.bedNext < now + 0.5) {
      this.writeBar(this.bedNext, this.bedBar++, this.bedWant);
      this.bedNext += BED_BAR;
    }
  }

  /** Write one bar of the bed at context time t. Public for offline renders. */
  writeBar(t: number, bar: number, level: number): void {
    const ac = this.ac;
    if (!ac || !this.bedGain || !this.nbuf) return;
    const voice = ac.createGain();
    voice.connect(this.bedGain);
    const kit = new Kit(ac, voice, this.nbuf, 1, t);
    scheduleBar(kit, t, bar, level);
    if (this.offline) return;
    setTimeout(() => {
      try {
        voice.disconnect();
      } catch {
        // already gone
      }
    }, (t - ac.currentTime + kit.end) * 1000 + 300);
  }

  // ---- settings ------------------------------------------------------------

  get volume(): number {
    return this.vol;
  }

  get muted(): boolean {
    return this.mute;
  }

  /** True when the work song is switched on (it still needs a level to sound). */
  get songOn(): boolean {
    return this.song;
  }

  setVolume(v: number): void {
    this.vol = Math.max(0, Math.min(1, v));
    this.apply();
  }

  setMuted(m: boolean): void {
    this.mute = m;
    this.apply();
  }

  toggleMute(): boolean {
    this.setMuted(!this.mute);
    return this.mute;
  }

  setSong(on: boolean): void {
    this.song = on;
    this.apply();
  }

  /** Called whenever volume, mute or the song switch changes. Returns an unsubscribe function. */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private apply(): void {
    if (this.ac && this.master) {
      const g = this.master.gain;
      const now = this.ac.currentTime;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(this.mute ? 0 : this.vol, now, 0.012);
    }
    this.syncBed();
    if (this.offline) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ v: this.vol, m: this.mute, s: this.song }));
    } catch {
      // not persisted; still applies for this session
    }
    for (const fn of this.listeners) fn();
  }
}

export const audio = new AudioEngine();
