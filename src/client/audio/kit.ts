// The sound bench: four ways to make a dry, struck sound, and nothing else.
//
//   noise  a filtered burst of air: bites, cracks, swishes, rumble
//   tone   one oscillator with a pitch fall: thumps, knocks, twangs
//   ring   a handful of inharmonic sine partials: iron, struck
//   rasp   noise chopped by a fast gate: blade dragged over hide
//
// Every voice has a near-instant attack and an exponential decay. There are
// no sustained notes, no reverb and no slow filter sweeps, which is what
// keeps the palette wood, iron and leather and away from synth pads.

export interface NoiseOpts {
  /** Filter frequency, Hz. */
  f: number;
  /** Frequency at the end of the burst (exponential glide). */
  f1?: number;
  q?: number;
  type?: BiquadFilterType;
  /** Peak gain. */
  g: number;
  /** Attack, seconds. Default 0.002. */
  a?: number;
}

export interface ToneOpts {
  f: number;
  f1?: number;
  type?: OscillatorType;
  g: number;
  a?: number;
  /** Lowpass on the oscillator, Hz. For saw and square only. */
  lp?: number;
}

const FLOOR = 0.0001;

export class Kit {
  readonly ac: BaseAudioContext;
  readonly out: AudioNode;
  /** Pitch multiplier for this play (caller's pitch times a small random drift). */
  readonly p: number;
  private nbuf: AudioBuffer;
  /** Latest scheduled end, relative to the start time. */
  end = 0;
  private t0: number;

  constructor(ac: BaseAudioContext, out: AudioNode, noiseBuffer: AudioBuffer, pitch: number, t0: number) {
    this.ac = ac;
    this.out = out;
    this.nbuf = noiseBuffer;
    this.p = pitch;
    this.t0 = t0;
  }

  /** Random in [a, b). */
  r(a = 0, b = 1): number {
    return a + Math.random() * (b - a);
  }

  private env(t: number, dur: number, g: number, a = 0.002): GainNode {
    const n = this.ac.createGain();
    n.gain.setValueAtTime(FLOOR, t);
    n.gain.linearRampToValueAtTime(Math.max(FLOOR, g), t + a);
    n.gain.exponentialRampToValueAtTime(FLOOR, t + Math.max(dur, a + 0.005));
    n.connect(this.out);
    this.end = Math.max(this.end, t + dur - this.t0);
    return n;
  }

  private src(t: number, dur: number): AudioBufferSourceNode {
    const s = this.ac.createBufferSource();
    s.buffer = this.nbuf;
    s.loop = true;
    s.start(t, Math.random() * (this.nbuf.duration - 0.1));
    s.stop(t + dur + 0.02);
    return s;
  }

  noise(t: number, dur: number, o: NoiseOpts): void {
    const s = this.src(t, dur);
    const flt = this.ac.createBiquadFilter();
    flt.type = o.type ?? 'bandpass';
    flt.Q.value = o.q ?? 1;
    flt.frequency.setValueAtTime(o.f, t);
    if (o.f1) flt.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    s.connect(flt);
    flt.connect(this.env(t, dur, o.g, o.a));
  }

  tone(t: number, dur: number, o: ToneOpts): void {
    const osc = this.ac.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f * this.p, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1 * this.p, t + dur);
    const e = this.env(t, dur, o.g, o.a);
    if (o.lp) {
      const flt = this.ac.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = o.lp;
      osc.connect(flt);
      flt.connect(e);
    } else {
      osc.connect(e);
    }
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /**
   * Struck iron. partials are frequency ratios over f0; higher partials are
   * quieter and die sooner, as they do in a real bar or plate.
   */
  ring(t: number, f0: number, partials: readonly number[], dur: number, g: number): void {
    for (let i = 0; i < partials.length; i++) {
      const k = 1 / (1 + i * 0.7);
      this.tone(t, dur * (0.45 + 0.55 * k), { f: f0 * partials[i]! * this.r(0.997, 1.003), g: g * k });
    }
  }

  /** Noise gated at `rate` Hz: the catch and drag of an edge on hide or bark. */
  rasp(t: number, dur: number, o: NoiseOpts & { rate: number; rate1?: number }): void {
    const s = this.src(t, dur);
    const flt = this.ac.createBiquadFilter();
    flt.type = o.type ?? 'bandpass';
    flt.Q.value = o.q ?? 1.5;
    flt.frequency.setValueAtTime(o.f, t);
    if (o.f1) flt.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const gate = this.ac.createGain();
    gate.gain.value = 0.5;
    const lfo = this.ac.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(o.rate, t);
    if (o.rate1) lfo.frequency.exponentialRampToValueAtTime(o.rate1, t + dur);
    const depth = this.ac.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth);
    depth.connect(gate.gain);
    s.connect(flt);
    flt.connect(gate);
    gate.connect(this.env(t, dur, o.g, o.a ?? 0.004));
    lfo.start(t);
    lfo.stop(t + dur + 0.02);
  }

  /** A dry knock on wood: a short sine with a click on the front. */
  knock(t: number, f: number, g: number, dur = 0.05): void {
    this.tone(t, dur, { f, f1: f * 0.8, g });
    this.noise(t, 0.012, { f: f * 4, q: 1.2, g: g * 0.7 });
  }
}
