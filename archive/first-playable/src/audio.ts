// All sound is synthesised with WebAudio; there are no audio files.
import type { GameEvent } from './game';

export class Sound {
  muted = false;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noiseBuf!: AudioBuffer;
  private crowdGain!: GainNode;
  private crowdFilter!: BiquadFilterNode;
  private droneGain!: GainNode;
  private chitterT = 0;
  private chain = 0;
  private lastPickup = -10;

  /** Must be called from a user gesture. */
  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(ctx.destination);

    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // enemy ambience: a noise bed and a low drone, both driven by the enemy count
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    this.crowdFilter = ctx.createBiquadFilter();
    this.crowdFilter.type = 'bandpass';
    this.crowdFilter.frequency.value = 300;
    this.crowdFilter.Q.value = 0.8;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0;
    src.connect(this.crowdFilter).connect(this.crowdGain).connect(this.master);
    src.start();

    const drone = ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 49;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 170;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    drone.connect(lp).connect(this.droneGain).connect(this.master);
    drone.start();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.value = this.muted ? 0 : 0.6;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo = 0, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo > 0) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass', slideTo = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slideTo > 0) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  /** Called every frame: the more enemies, the louder and busier the ambience. */
  crowd(count: number, dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const k = Math.min(1, count / 45);
    const t = ctx.currentTime;
    this.crowdGain.gain.setTargetAtTime(k * 0.2, t, 0.25);
    this.crowdFilter.frequency.setTargetAtTime(240 + k * 900, t, 0.25);
    this.droneGain.gain.setTargetAtTime(k * k * 0.22, t, 0.25);
    if (count <= 0) return;
    this.chitterT -= dt;
    if (this.chitterT <= 0) {
      this.tone(900 + Math.random() * 1500, 0.03, 'square', 0.012 + 0.025 * k);
      this.chitterT = (0.5 + Math.random()) / Math.min(16, 0.4 + count * 0.35);
    }
  }

  onEvent(e: GameEvent, now: number): void {
    switch (e.t) {
      case 'shot':
        if (e.blocked) this.tone(2400, 0.05, 'triangle', 0.05);
        else this.noise(0.04, 0.05, 1800, 'highpass');
        break;
      case 'kill':
        if (e.sweep) break;
        if (e.kind === 'swarm') this.tone(520, 0.07, 'square', 0.04, 180);
        else {
          this.tone(200, 0.2, 'sawtooth', 0.1, 60);
          this.noise(0.18, 0.12, 500);
        }
        break;
      case 'swing':
        this.noise(0.14, e.hits || e.struck ? 0.1 : 0.16, 900, 'bandpass', 250);
        break;
      case 'heavyHit':
        this.tone(110, 0.16, 'sine', 0.3, 45);
        this.noise(0.08, 0.14, 700);
        break;
      case 'shieldBreak':
        this.tone(1500, 0.25, 'triangle', 0.14, 500);
        this.noise(0.22, 0.16, 3500, 'highpass');
        break;
      case 'nodeStrike': {
        const f = e.rich ? 1250 : 820;
        this.tone(f, 0.22, 'square', 0.09, f * 0.96);
        this.tone(f * 1.51, 0.16, 'triangle', 0.08);
        this.tone(90, 0.12, 'sine', 0.3, 50);
        this.noise(0.06, 0.16, 3000, 'highpass');
        if (e.broke) {
          this.noise(0.35, 0.22, 600, 'lowpass', 150);
          this.tone(e.rich ? 660 : 440, 0.3, 'triangle', 0.1, e.rich ? 1320 : 880);
        }
        break;
      }
      case 'pickup': {
        // pitch climbs one scale step per pickup while they keep chaining
        this.chain = now - this.lastPickup < 0.7 ? Math.min(this.chain + 1, 21) : 0;
        this.lastPickup = now;
        const scale = [0, 2, 4, 7, 9];
        const semis = scale[this.chain % 5] + 12 * Math.floor(this.chain / 5);
        this.tone(523 * Math.pow(2, semis / 12), 0.12, 'triangle', 0.12);
        break;
      }
      case 'hurt':
        this.tone(160, 0.22, 'sawtooth', 0.2, 70);
        this.noise(0.1, 0.15, 400);
        break;
      case 'dodge':
        this.noise(0.18, 0.12, 500, 'bandpass', 2200);
        break;
      case 'noStamina':
        this.tone(140, 0.09, 'square', 0.07);
        break;
      case 'beat':
        if (e.beat === 'peak') for (let i = 0; i < 3; i++) this.tone(740, 0.16, 'square', 0.1, 560, i * 0.22);
        break;
      case 'richOpen':
        [660, 880, 1320].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.12, 0, i * 0.08));
        break;
      case 'richClose':
        [660, 440].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.08, 0, i * 0.1));
        break;
      case 'burrowUp':
        this.tone(70, 0.5, 'sawtooth', 0.16, 150);
        this.noise(0.4, 0.12, 200, 'lowpass');
        break;
      case 'nodeBite':
        this.noise(0.12, 0.14, 1200);
        this.tone(e.ate ? 220 : 300, 0.12, 'square', 0.06, 120);
        break;
      case 'waveEnd':
        [392, 523, 659].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, 0, i * 0.09));
        break;
      case 'over':
        if (e.died) this.tone(220, 0.9, 'sawtooth', 0.18, 40);
        break;
    }
  }
}
