// The mixer and the instrument voices. Everything is synthesised; there are no audio files.
// It runs on any BaseAudioContext, so the same code plays live and renders offline (dev/audio.ts).
//
//   ui      -> post                          dry interface ticks
//   jingle  -> post, reverb                  stingers
//   sfx     -> pre, a little echo and reverb arena events
//   strike  -> pre, full echo and reverb     gathering impacts: the place answers them
//   far     -> amb, echo                     distant things in an ambience bed
//   amb     -> ambience volume -> pre, reverb
//   music   -> duck -> music volume -> pre, reverb, a little echo
//   crowd   -> pre                           the enemy drone
//   pre -> muffle -> dim -> post -> limiter -> trim -> soft clip -> out -> speakers
// `muffle` and `dim` put the world behind glass while the game is paused; interface sounds stay clear.

export type Ctx = BaseAudioContext;
export type SpaceId = 'quarry' | 'grove' | 'marsh' | 'town' | 'camp';
export type NoiseKind = 'white' | 'pink' | 'brown';
export type Timbre = 'banjo' | 'lute';

/** How a place answers a sound: two cross-fed echoes and a generated reverb tail. */
interface SpaceDef {
  echoL: number; // seconds to the first echo on the left, and on the right
  echoR: number;
  fb: number; // how much of each echo crosses over and repeats
  echoLp: number; // each repeat is duller than the last
  echo: number; // echo return level
  rt: number; // reverb: seconds to fall 60 dB
  open: number; // tail brightness at its start, Hz
  damp: number; // and at its end
  pre: number; // seconds before the tail starts
  build: number; // seconds the tail takes to swell (0: it starts hard)
  early: [number, number][]; // discrete reflections: seconds, gain
  wet: number; // reverb return level
}

export const SPACES: Record<SpaceId, SpaceDef> = {
  // open stone: hard, separate slap-backs off the far wall, then a long thin tail
  quarry: { echoL: 0.19, echoR: 0.31, fb: 0.4, echoLp: 2600, echo: 0.42, rt: 2.3, open: 9000, damp: 1800, pre: 0.045, build: 0, early: [[0.071, 0.5], [0.128, 0.36], [0.243, 0.3]], wet: 0.3 },
  // trunks and leaves: no single echo, a soft swelling cloud that loses its top quickly
  grove: { echoL: 0.083, echoR: 0.127, fb: 0.3, echoLp: 1900, echo: 0.24, rt: 1.7, open: 5200, damp: 1100, pre: 0.02, build: 0.035, early: [[0.031, 0.3], [0.052, 0.26], [0.077, 0.2]], wet: 0.5 },
  // water and mud swallow it: short, dark, close
  marsh: { echoL: 0.058, echoR: 0.091, fb: 0.12, echoLp: 1000, echo: 0.1, rt: 0.75, open: 2600, damp: 700, pre: 0.008, build: 0.01, early: [[0.019, 0.22]], wet: 0.24 },
  // a timbered room
  town: { echoL: 0.05, echoR: 0.07, fb: 0.08, echoLp: 2200, echo: 0.05, rt: 1.05, open: 7000, damp: 2200, pre: 0.012, build: 0, early: [[0.013, 0.4], [0.022, 0.3], [0.037, 0.24]], wet: 0.3 },
  // open ground at night
  camp: { echoL: 0.14, echoR: 0.21, fb: 0.2, echoLp: 1500, echo: 0.16, rt: 1.3, open: 4500, damp: 1200, pre: 0.03, build: 0.02, early: [[0.06, 0.2]], wet: 0.3 },
};

export interface VoiceOpts {
  slideTo?: number;
  attack?: number;
  pan?: number;
  q?: number;
  buf?: NoiseKind;
  /** For `tone`: pass the oscillator through a band at this frequency (a throat, a creaking joint). */
  fmt?: number;
  /** 0: cosmetic, dropped first when the mix is busy; 1: normal; 2: must be heard. */
  pri?: number;
}
const NO: VoiceOpts = {};
/** The compressor adds make-up gain for its threshold and ratio; this takes it back out (measured in dev/audio.ts). */
export const COMP_TRIM = 0.5644;
const MAX_VOICES = 96;
const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export { midiHz };

export class Core {
  readonly ctx: Ctx;
  readonly ui: GainNode;
  readonly jingle: GainNode;
  readonly sfx: GainNode;
  readonly strike: GainNode;
  readonly far: GainNode;
  readonly amb: GainNode;
  readonly music: GainNode;
  readonly crowd: GainNode;
  readonly duck: GainNode; // music gives way to arena sounds and to the enemy drone
  readonly ambVol: GainNode;
  readonly musicVol: GainNode;
  readonly out: GainNode;
  readonly post: GainNode;
  private muffle: BiquadFilterNode;
  private dim: GainNode;
  private echoIn: GainNode;
  private echoOut: GainNode;
  private verbIn: GainNode;
  private verbOut: GainNode;
  private conv: ConvolverNode;
  private dL: DelayNode;
  private dR: DelayNode;
  private lpL: BiquadFilterNode;
  private lpR: BiquadFilterNode;
  private fbL: GainNode;
  private fbR: GainNode;
  private noiseBufs: Record<NoiseKind, AudioBuffer>;
  private irs: Partial<Record<SpaceId, AudioBuffer>> = {};
  private plucks = new Map<string, AudioBuffer>();
  private targets = new WeakMap<AudioParam, number>();
  private ends = new Float64Array(MAX_VOICES); // when each one-shot voice slot falls silent
  private space: SpaceId | null = null;
  private spaceNext: SpaceId | null = null;
  private spaceAt = 0;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
    const g = (v: number): GainNode => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    this.ui = g(0.6);
    this.jingle = g(0.6);
    this.sfx = g(0.6);
    this.strike = g(0.6);
    this.far = g(1);
    this.amb = g(1);
    this.music = g(1);
    this.crowd = g(0.6);
    this.duck = g(1);
    this.ambVol = g(1);
    this.musicVol = g(1);
    const pre = g(1);
    this.post = g(1);
    this.dim = g(1);
    this.out = g(1);
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = this.openHz;
    this.muffle.Q.value = 0.5;

    // ---- the place: two delays feeding each other across the stereo field, and a convolver
    this.echoIn = g(1);
    this.echoOut = g(0);
    this.verbIn = g(1);
    this.verbOut = g(0);
    this.dL = ctx.createDelay(1);
    this.dR = ctx.createDelay(1);
    this.lpL = ctx.createBiquadFilter();
    this.lpR = ctx.createBiquadFilter();
    this.lpL.type = this.lpR.type = 'lowpass';
    this.fbL = g(0);
    this.fbR = g(0);
    const pL = ctx.createStereoPanner();
    const pR = ctx.createStereoPanner();
    pL.pan.value = -0.7;
    pR.pan.value = 0.7;
    this.echoIn.connect(this.dL).connect(this.lpL).connect(pL).connect(this.echoOut);
    this.echoIn.connect(this.dR).connect(this.lpR).connect(pR).connect(this.echoOut);
    this.lpL.connect(this.fbL).connect(this.dR);
    this.lpR.connect(this.fbR).connect(this.dL);
    this.conv = ctx.createConvolver();
    this.conv.normalize = false;
    this.verbIn.connect(this.conv).connect(this.verbOut);
    this.echoOut.connect(pre);
    this.echoOut.connect(g(0.4)).connect(this.verbIn);
    this.verbOut.connect(pre);

    // ---- buses
    this.ui.connect(this.post);
    this.jingle.connect(this.post);
    this.jingle.connect(g(0.3)).connect(this.verbIn);
    this.sfx.connect(pre);
    this.sfx.connect(g(0.1)).connect(this.echoIn);
    this.sfx.connect(g(0.08)).connect(this.verbIn);
    this.strike.connect(pre);
    this.strike.connect(this.echoIn);
    this.strike.connect(g(0.45)).connect(this.verbIn);
    this.far.connect(this.amb);
    this.far.connect(g(0.6)).connect(this.echoIn);
    this.amb.connect(this.ambVol).connect(pre);
    this.ambVol.connect(g(0.12)).connect(this.verbIn);
    this.music.connect(this.duck).connect(this.musicVol).connect(pre);
    this.musicVol.connect(g(0.3)).connect(this.verbIn);
    this.musicVol.connect(g(0.08)).connect(this.echoIn);
    this.crowd.connect(pre);
    pre.connect(this.muffle).connect(this.dim).connect(this.post);

    // ---- the ceiling: a fast compressor, its make-up gain taken back out, then a soft clip that cannot pass 0.91
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 12;
    comp.attack.value = 0.002;
    comp.release.value = 0.22;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(2049);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      const a = Math.abs(x);
      curve[i] = a <= 0.7 ? x : Math.sign(x) * (0.7 + 0.25 * Math.tanh((a - 0.7) / 0.25));
    }
    shaper.curve = curve;
    this.post.connect(comp).connect(g(COMP_TRIM)).connect(shaper).connect(this.out).connect(ctx.destination);

    this.noiseBufs = { white: this.makeNoise('white', 2), pink: this.makeNoise('pink', 4), brown: this.makeNoise('brown', 4) };
  }

  get now(): number {
    return this.ctx.currentTime;
  }
  private get openHz(): number {
    return Math.min(20000, this.ctx.sampleRate * 0.45);
  }

  /** Move a parameter towards a value, without stacking up automation when the value has not changed. */
  glide(p: AudioParam, v: number, tc = 0.1, t = this.ctx.currentTime): void {
    const last = this.targets.get(p);
    if (last !== undefined && Math.abs(last - v) <= 1e-4 + Math.abs(v) * 0.01) return;
    this.targets.set(p, v);
    p.setTargetAtTime(v, t, tc);
  }

  /** The world behind glass (paused) or not. */
  setMuffled(on: boolean): void {
    this.glide(this.muffle.frequency, on ? 650 : this.openHz, 0.12);
    this.glide(this.dim.gain, on ? 0.5 : 1, 0.12);
  }

  // ------------------------------------------------------------------ space
  /** Change how the place answers. The returns are faded down, the delays and the tail swapped, then faded up. */
  setSpace(id: SpaceId): void {
    if (id === (this.spaceNext ?? this.space)) return;
    if (this.space === null) {
      this.applySpace(id);
      return;
    }
    const t = this.now;
    this.glide(this.echoOut.gain, 0, 0.04, t);
    this.glide(this.verbOut.gain, 0, 0.04, t);
    this.spaceNext = id;
    this.spaceAt = t + 0.25;
  }
  private applySpace(id: SpaceId): void {
    const d = SPACES[id];
    const t = this.now;
    this.space = id;
    this.spaceNext = null;
    this.dL.delayTime.setValueAtTime(d.echoL, t);
    this.dR.delayTime.setValueAtTime(d.echoR, t);
    this.lpL.frequency.setValueAtTime(d.echoLp, t);
    this.lpR.frequency.setValueAtTime(d.echoLp, t);
    this.fbL.gain.setValueAtTime(d.fb, t);
    this.fbR.gain.setValueAtTime(d.fb, t);
    this.conv.buffer = this.irs[id] ??= this.makeIR(d);
    this.glide(this.echoOut.gain, d.echo, 0.05, t);
    this.glide(this.verbOut.gain, d.wet, 0.05, t);
  }
  /** Call every frame. */
  tick(): void {
    if (this.spaceNext && this.now >= this.spaceAt) this.applySpace(this.spaceNext);
  }

  private makeIR(d: SpaceDef): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const pre = Math.floor(d.pre * sr);
    const len = pre + Math.ceil(d.rt * 1.05 * sr);
    const buf = this.ctx.createBuffer(2, len, sr);
    const k = Math.exp(-6.908 / (d.rt * sr));
    const build = d.build * sr;
    for (let ch = 0; ch < 2; ch++) {
      const out = buf.getChannelData(ch);
      let env = 1;
      let lp = 0;
      let a = 1;
      let sum = 0;
      for (let i = pre; i < len; i++) {
        const n = i - pre;
        if ((n & 63) === 0) a = 1 - Math.exp((-2 * Math.PI * (d.damp + (d.open - d.damp) * env)) / sr);
        lp += a * (Math.random() * 2 - 1 - lp);
        const v = lp * env * (build > 0 ? 1 - Math.exp(-n / build) : 1);
        out[i] = v;
        sum += v * v;
        env *= k;
      }
      const norm = 1 / Math.sqrt(sum || 1);
      for (let i = pre; i < len; i++) out[i] *= norm;
      // discrete reflections, a little later and weaker on the right so they do not sit dead centre
      for (let j = 0; j < d.early.length; j++) {
        const i = Math.floor(d.early[j][0] * (ch ? 1.09 : 1) * sr);
        if (i < len) out[i] += d.early[j][1] * (ch ? 0.85 : 1) * (j % 2 ? -1 : 1);
      }
    }
    return buf;
  }

  private makeNoise(kind: NoiseKind, seconds: number): AudioBuffer {
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * seconds), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    if (kind === 'white') {
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } else if (kind === 'pink') {
      // Paul Kellet's filter: about 3 dB per octave
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.5;
      }
    }
    // the loop point must not click: blend the last 50 ms into the start
    const n = Math.floor(this.ctx.sampleRate * 0.05);
    for (let i = 0; i < n; i++) {
      const f = i / n;
      d[d.length - n + i] = d[d.length - n + i] * (1 - f) + d[i] * f;
    }
    return buf;
  }

  // ----------------------------------------------------------------- voices
  /** One-shot voices sounding now. */
  get voices(): number {
    const now = this.now;
    let n = 0;
    for (let i = 0; i < MAX_VOICES; i++) if (this.ends[i] > now) n++;
    return n;
  }
  /** Take a voice slot until `end`, or refuse: cosmetic sounds go first when the mix is busy. */
  claim(end: number, pri = 1): boolean {
    const now = this.now;
    let free = -1;
    let busy = 0;
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this.ends[i] > now) busy++;
      else if (free < 0) free = i;
    }
    if (free < 0 || busy >= (pri >= 2 ? MAX_VOICES : pri === 1 ? 64 : 36)) return false;
    this.ends[free] = end;
    return true;
  }
  /** Connect the end of a voice to a bus, through a panner when it is off centre. */
  private send(node: AudioNode, dest: AudioNode, pan?: number): void {
    if (pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p).connect(dest);
    } else node.connect(dest);
  }
  /** Rise in `attack`, fall away exponentially to the end, and land on true zero. */
  private env(g: GainNode, t: number, dur: number, vol: number, attack: number): void {
    const a = Math.min(attack, dur * 0.6);
    // The gain must already be zero before its first event: a source that starts between two render blocks
    // can run one sample ahead of the automation, and that sample would pass at the default gain of 1.
    g.gain.value = 0;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(vol * 0.001, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.012);
  }
  private release(src: AudioScheduledSourceNode, tail: AudioNode): void {
    src.onended = () => tail.disconnect();
  }

  tone(dest: AudioNode, t: number, freq: number, dur: number, type: OscillatorType, vol: number, o: VoiceOpts = NO): void {
    if (vol <= 0 || !this.claim(t + dur, o.pri)) return;
    t = Math.max(t, this.now);
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (o.slideTo) {
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
    }
    const g = this.ctx.createGain();
    this.env(g, t, dur, vol, o.attack ?? 0.003);
    if (o.fmt) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = o.fmt;
      f.Q.value = o.q ?? 3;
      osc.connect(f).connect(g);
    } else osc.connect(g);
    this.send(g, dest, o.pan);
    osc.start(t);
    osc.stop(t + dur + 0.03);
    this.release(osc, g);
  }

  noise(dest: AudioNode, t: number, dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass', o: VoiceOpts = NO): void {
    if (vol <= 0 || !this.claim(t + dur, o.pri)) return;
    t = Math.max(t, this.now);
    const s = this.ctx.createBufferSource();
    const buf = this.noiseBufs[o.buf ?? 'white'];
    s.buffer = buf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (o.slideTo) {
      f.frequency.setValueAtTime(freq, t);
      f.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
    }
    if (o.q) f.Q.value = o.q;
    const g = this.ctx.createGain();
    this.env(g, t, dur, vol, o.attack ?? 0.002);
    s.connect(f).connect(g);
    this.send(g, dest, o.pan);
    s.start(t, Math.random() * (buf.duration - 0.2));
    s.stop(t + dur + 0.03);
    this.release(s, g);
  }

  /** Struck metal, glass or stone: a few sine partials that are not harmonics, the high ones dying first. */
  ring(dest: AudioNode, t: number, f0: number, ratios: readonly number[], vol: number, decay: number, o: VoiceOpts = NO): void {
    if (vol <= 0 || !this.claim(t + decay, o.pri)) return;
    t = Math.max(t, this.now);
    const sum = this.ctx.createGain();
    sum.gain.value = 1;
    let last: OscillatorNode | null = null;
    for (let i = 0; i < ratios.length; i++) {
      const f = f0 * ratios[i];
      if (f > 15000) continue;
      const osc = this.ctx.createOscillator();
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      this.env(g, t, decay / (1 + i * 0.7), vol / (1 + i * 0.8), 0.0015);
      osc.connect(g).connect(sum);
      osc.start(t);
      osc.stop(t + decay + 0.03);
      last ??= osc;
    }
    if (!last) return;
    this.send(sum, dest, o.pan);
    this.release(last, sum);
  }

  /** A plucked string (Karplus-Strong), rendered once per pitch and kept. */
  pluck(dest: AudioNode, t: number, midi: number, vol: number, timbre: Timbre = 'lute', pan = 0): void {
    if (vol <= 0 || !this.claim(t + 0.8, 2)) return;
    t = Math.max(t, this.now);
    const key = `${timbre}${midi}`;
    let buf = this.plucks.get(key);
    if (!buf) {
      if (this.plucks.size > 56) this.plucks.clear();
      buf = this.makePluck(midiHz(midi), timbre);
      this.plucks.set(key, buf);
    }
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    if (timbre === 'banjo') {
      // a skin head: nasal, with little bottom
      f.type = 'peaking';
      f.frequency.value = 1250;
      f.Q.value = 1.1;
      f.gain.value = 7;
    } else {
      f.type = 'lowpass';
      f.frequency.value = 3400;
      f.Q.value = 0.6;
    }
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.002);
    s.connect(f).connect(g);
    this.send(g, dest, pan);
    s.start(t);
    this.release(s, g);
  }
  private makePluck(freq: number, timbre: Timbre): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const banjo = timbre === 'banjo';
    const seconds = banjo ? 1.1 : 2.2;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const s = banjo ? 0.36 : 0.5; // weight of the previous sample in the loop filter: lower is brighter
    // loss per trip round the string, set so the fundamental falls 60 dB in t60 seconds; high strings die sooner
    const t60 = (banjo ? 0.85 : 2.3) * Math.pow(147 / freq, 0.35);
    const loss = Math.pow(10, -3 / (freq * t60));
    const P = sr / freq;
    let N = Math.floor(P - s - 1e-6);
    let frac = P - s - N;
    if (frac < 0.1) {
      N -= 1;
      frac += 1;
    }
    const C = (1 - frac) / (1 + frac); // allpass for the fraction of a sample, so the string is in tune
    const line = new Float32Array(N);
    // the pluck: a noise burst, softened for the lute, and combed by where along the string it is plucked
    const pick = Math.max(1, Math.round(N * (banjo ? 0.13 : 0.24)));
    let lp = 0;
    const soft = banjo ? 0.75 : 0.32;
    const raw = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      lp += soft * (Math.random() * 2 - 1 - lp);
      raw[i] = lp;
    }
    let peak = 0;
    for (let i = 0; i < N; i++) {
      line[i] = raw[i] - raw[(i + N - pick) % N];
      peak = Math.max(peak, Math.abs(line[i]));
    }
    for (let i = 0; i < N; i++) line[i] /= peak || 1;
    let idx = 0;
    let xPrev = 0;
    let apIn = 0;
    let apOut = 0;
    const fade = Math.floor(len * 0.25);
    for (let i = 0; i < len; i++) {
      const x = line[idx];
      const l = loss * ((1 - s) * x + s * xPrev);
      xPrev = x;
      const ap = C * l + apIn - C * apOut;
      apIn = l;
      apOut = ap;
      line[idx] = ap;
      idx = idx + 1 === N ? 0 : idx + 1;
      out[i] = i > len - fade ? x * ((len - i) / fade) : x;
    }
    return buf;
  }

  /**
   * A sustained voice with a slow attack. `bow`: a fiddle or viol. `reed`: a mouth-organ. `horn`: a war horn.
   * One or two sawtooths through a body filter, with vibrato that arrives after the note has started.
   */
  sustain(dest: AudioNode, t: number, midi: number, dur: number, vol: number, kind: 'bow' | 'reed' | 'horn' = 'bow', pan = 0, bright = 0.5): void {
    if (vol <= 0 || !this.claim(t + dur, 2)) return;
    t = Math.max(t, this.now);
    const ctx = this.ctx;
    const f = midiHz(midi);
    const attack = kind === 'horn' ? Math.min(0.7, dur * 0.4) : kind === 'reed' ? 0.06 : Math.min(0.16, dur * 0.35);
    const rel = kind === 'horn' ? 0.9 : 0.28;
    const end = t + dur + rel;
    const a = ctx.createOscillator();
    a.type = kind === 'reed' ? 'square' : 'sawtooth';
    a.frequency.value = f;
    const b = ctx.createOscillator();
    b.type = 'sawtooth';
    b.frequency.value = f;
    b.detune.value = kind === 'horn' ? -9 : 5;
    if (kind === 'reed') {
      // a reed speaks slightly flat and comes up to pitch
      a.detune.setValueAtTime(-35, t);
      a.detune.linearRampToValueAtTime(0, t + 0.09);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = kind === 'horn' ? 4.1 : kind === 'reed' ? 5.8 : 5.3;
    const depth = ctx.createGain();
    depth.gain.value = 0;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(kind === 'horn' ? 5 : 11, t + Math.min(dur, 0.55));
    lfo.connect(depth);
    depth.connect(a.detune);
    depth.connect(b.detune);
    const mixB = ctx.createGain();
    mixB.gain.value = kind === 'reed' ? 0.35 : 0.6;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = kind === 'horn' ? 1.6 : 0.7;
    const top = kind === 'horn' ? 500 + 900 * bright : kind === 'reed' ? 2200 + 1200 * bright : 1500 + 2600 * bright;
    if (kind === 'horn') {
      // brass opens as it is blown harder
      lp.frequency.value = 180;
      lp.frequency.setValueAtTime(180, t);
      lp.frequency.linearRampToValueAtTime(top, t + attack);
      lp.frequency.setTargetAtTime(260, t + dur, rel / 3);
    } else lp.frequency.value = top;
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = kind === 'reed' ? 1350 : kind === 'horn' ? 420 : 520;
    body.Q.value = 1.2;
    body.gain.value = kind === 'reed' ? 8 : 5;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setTargetAtTime(vol * 0.8, t + attack, 0.4);
    g.gain.setTargetAtTime(0, t + dur, rel / 5);
    a.connect(lp);
    b.connect(mixB).connect(lp);
    lp.connect(body).connect(g);
    this.send(g, dest, pan);
    for (const o of [a, b, lfo]) {
      o.start(t);
      o.stop(end);
    }
    this.release(a, g);
  }

  /** A skin drum: a pitched thump that drops, and the slap of the hand. `deep` is the war drum. */
  drum(dest: AudioNode, t: number, vol: number, deep = false, pan = 0): void {
    const f = deep ? 74 : 104;
    this.tone(dest, t, f, deep ? 0.42 : 0.24, 'sine', vol, { slideTo: f * 0.55, attack: 0.004, pan, pri: 2 });
    this.noise(dest, t, deep ? 0.09 : 0.05, vol * 0.7, deep ? 240 : 420, 'bandpass', { q: 0.9, pan, pri: 1, buf: 'pink' });
  }

  /** A looping noise source for a bed. The caller starts, stops and disconnects it. */
  loop(kind: NoiseKind, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBufs[kind];
    s.loop = true;
    s.playbackRate.value = rate;
    return s;
  }
}
