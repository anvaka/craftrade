// Audio engine. Everything is synthesised in WebAudio; there are no files.
//
//   import { audio } from './audio/index.ts';
//   audio.play('chop', { pan: -0.3 });           // pan -1..1, pitch multiplier, gain multiplier
//   audio.play('pickup');                        // rises along a streak, resets after 0.6 s
//   const stop = audio.loop('anvil');            // fusion wait; call stop() then play('reveal')
//   audio.setVolume(0.6); audio.toggleMute();    // both persisted
//   audio.onChange(() => redrawMuteButton());
//
// Behaviour
//   - Silent until the first key, click or touch (browser autoplay rules).
//     The engine listens for that itself on import; play() before it is a no-op.
//   - Master chain: voices -> compressor -> limiter -> volume -> out.
//   - Each sound has its own voice cap and minimum gap (sounds.ts), and there
//     is a global cap, so 50 kills in one frame make one kill sound.
//   - Every play drifts a little in pitch so repeats do not machine-gun.
//   - Volume and mute live in localStorage under "scrip.audio"; failures to
//     read or write are ignored.
//   - The context is suspended while the tab is hidden.
//
// Sound ids (SOUND_IDS): chop chopBreak clink clinkBreak scrape scrapeBreak
// pickup scrip edge blunt shot musket hit crit kill hurt dodge telegraph elite
// boss bossDeath steal levelUp waveStart waveEnd buy reroll lock combine anvil
// reveal revealFirst stamp mule death win

import { Kit } from './kit.ts';
import { SOUNDS, SOUND_IDS, type SoundId } from './sounds.ts';

export { SOUND_IDS, type SoundId };

export interface PlayOpts {
  /** Stereo position, -1 (left) to 1 (right). */
  pan?: number;
  /** Pitch multiplier. 1 is as written. */
  pitch?: number;
  /** Gain multiplier. 1 is as written. */
  gain?: number;
}

const STORE_KEY = 'scrip.audio';
const MAX_VOICES = 28;
const STREAK_WINDOW = 0.6;
// Pickup streak: steps up a five-note scale, two octaves, then holds.
const STREAK_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

class AudioEngine {
  private ac: AudioContext | null = null;
  private bus: GainNode | null = null;
  private master: GainNode | null = null;
  private nbuf: AudioBuffer | null = null;
  private live = new Map<SoundId, number[]>();
  private lastStart = new Map<SoundId, number>();
  private total: number[] = [];
  private streak = 0;
  private streakAt = -10;
  private vol = 0.7;
  private mute = false;
  private listeners = new Set<() => void>();
  private armed = false;

  constructor() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { v?: unknown; m?: unknown };
        if (typeof s.v === 'number' && s.v >= 0 && s.v <= 1) this.vol = s.v;
        if (typeof s.m === 'boolean') this.mute = s.m;
      }
    } catch {
      // private mode or blocked storage: keep defaults
    }
    this.arm();
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
      if (!this.ac) return;
      if (document.hidden) void this.ac.suspend();
      else void this.ac.resume();
    });
  }

  /** Create or resume the context. Must run inside a user gesture the first time. */
  unlock(): void {
    try {
      if (!this.ac) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ac = new AC({ latencyHint: 'interactive' });
        // voices -> bus -> compressor -> limiter -> master volume -> out
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
        // two seconds of white noise, shared by every voice
        const nbuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = nbuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.ac = ac;
        this.bus = bus;
        this.master = master;
        this.nbuf = nbuf;
      }
      if (this.ac.state !== 'running' && !document.hidden) void this.ac.resume();
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
    if (!ac || !this.bus || !this.nbuf || !def || this.mute) return;
    // A context still waking from the unlocking gesture queues the sound;
    // a hidden tab or a closed context drops it.
    if (ac.state === 'closed' || (ac.state !== 'running' && document.hidden)) return;
    const now = ac.currentTime;

    // voice limits
    let voices = this.live.get(id);
    if (!voices) this.live.set(id, (voices = []));
    for (let i = voices.length - 1; i >= 0; i--) if (voices[i]! <= now) voices.splice(i, 1);
    if (voices.length >= def.max) return;
    if (now - (this.lastStart.get(id) ?? -10) < def.gap) return;
    for (let i = this.total.length - 1; i >= 0; i--) if (this.total[i]! <= now) this.total.splice(i, 1);
    if (this.total.length >= MAX_VOICES) return;

    let pitch = (opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * def.vary);
    if (id === 'pickup') {
      this.streak = now - this.streakAt <= STREAK_WINDOW ? Math.min(this.streak + 1, STREAK_SCALE.length - 1) : 0;
      this.streakAt = now;
      pitch *= Math.pow(2, STREAK_SCALE[this.streak]! / 12);
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
    tail.connect(this.bus);

    const kit = new Kit(ac, voice, this.nbuf, pitch, t);
    def.make(kit, t);
    const end = t + kit.end + 0.05;
    voices.push(end);
    this.total.push(end);
    this.lastStart.set(id, now);
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

  /**
   * Repeat a sound end to end until the returned function is called.
   * Meant for 'anvil' (1.5 s) while a fusion is being decided.
   */
  loop(id: SoundId, period = 1.5, opts: PlayOpts = {}): () => void {
    this.play(id, opts);
    const h = setInterval(() => this.play(id, opts), period * 1000);
    return () => clearInterval(h);
  }

  get volume(): number {
    return this.vol;
  }

  get muted(): boolean {
    return this.mute;
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

  /** Called whenever volume or mute changes. Returns an unsubscribe function. */
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
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ v: this.vol, m: this.mute }));
    } catch {
      // not persisted; still applies for this session
    }
    for (const fn of this.listeners) fn();
  }
}

export const audio = new AudioEngine();
