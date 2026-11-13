// Recorded sound: the freely licensed files under public/audio/, listed in two manifests (beds.json, hits.json).
// A slot (a place's ambience bed, or one kind of hit) has candidates; the one in use is the manifest's default
// unless the owner chose another on the soundboard (dev/audio.html), which stores a map in localStorage.
// Nothing here may break the game: a missing manifest, a missing file or a file that will not decode
// leaves the slot on its synthesised sound, as before there were recordings.
// A file is fetched and decoded the first time its slot is needed, then kept; decoded beds are large
// (about 23 MB a minute in stereo), so only the last few are kept.
import type { Core } from './core';

export interface Candidate {
  id: string;
  files: string[];
  title?: string;
  author?: string;
  source?: string;
  licence?: string;
  licenceUrl?: string;
  seconds?: number;
  edits?: string;
  note?: string;
  /** Optional trim on top of the automatic level, in dB. */
  gainDb?: number;
}
export const BED_SLOTS = ['quarry', 'grove', 'marsh', 'town', 'forge', 'workshop', 'apothecary', 'camp', 'night'] as const;
export const HIT_SLOTS = ['pick', 'crumble', 'axe', 'treefall', 'sickle', 'reedfall', 'anvil', 'saw', 'brew', 'pickup-stone', 'pickup-wood', 'pickup-plant'] as const;
export const CHOICE_KEY = 'craftworld.audio.choice';
/** slot -> candidate id, or 'synth' (keep the synthesised sound), or 'off'. */
export type Choice = Record<string, string>;

/** A decoded file, with what was measured in it and the gain that brings it to the house level. */
export interface Loaded {
  state: 'ready';
  buf: AudioBuffer;
  gain: number;
  peakDb: number;
  rmsDb: number;
}
export type Entry = Loaded | { state: 'loading' } | { state: 'failed'; why: string };

const BED_RMS = 0.02; // every bed is brought to this level (-34 dBFS) before the ambience volume, whatever its source level
const HIT_PEAK = 0.55; // and every hit to this peak before its bus
const KEEP_BEDS = 4; // decoded beds kept: the one playing, the night layer, and the last two places

function readChoice(): Choice {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(CHOICE_KEY) : null;
    const j: unknown = v ? JSON.parse(v) : null;
    const out: Choice = {};
    if (j && typeof j === 'object') for (const [k, x] of Object.entries(j)) if (typeof x === 'string') out[k] = x;
    return out;
  } catch {
    return {};
  }
}

export class Samples {
  slots: Record<string, Candidate[]> = {};
  defaults: Choice = {};
  choice: Choice = readChoice();
  /** The soundboard's audition: wins over the stored choice, and is never stored. */
  preview: Choice = {};
  /** Counts up whenever what should play may have changed (manifests arrived, a choice was made). */
  version = 0;
  /** The manifests have been read, or have failed: until then nobody knows whether a slot has a recording. */
  settled = false;
  /** Which manifests were found, for the soundboard. */
  found: Record<string, boolean> = {};
  private files = new Map<string, Entry>();
  private bedOrder: string[] = [];
  private last = new Map<string, number>();

  constructor(private core: Core, public base: string = `${import.meta.env.BASE_URL}audio/`) {}

  /** Read both manifests. Either may be missing or half written: what can be read is used. */
  async load(): Promise<void> {
    const names = ['beds.json', 'hits.json'];
    const got = await Promise.all(names.map((n) => this.manifest(n)));
    const slots: Record<string, Candidate[]> = {};
    const defaults: Choice = {};
    got.forEach((m, i) => {
      this.found[names[i]] = m !== null;
      if (!m) return;
      Object.assign(slots, m.slots);
      Object.assign(defaults, m.defaults);
    });
    this.slots = slots;
    this.defaults = defaults;
    this.settled = true;
    this.version++;
  }
  private async manifest(name: string): Promise<{ slots: Record<string, Candidate[]>; defaults: Choice } | null> {
    try {
      const r = await fetch(this.base + name, { cache: 'no-cache' });
      if (!r.ok) return null;
      const j = (await r.json()) as { slots?: unknown; default?: unknown };
      const slots: Record<string, Candidate[]> = {};
      if (j.slots && typeof j.slots === 'object') {
        for (const [slot, list] of Object.entries(j.slots)) {
          if (!Array.isArray(list)) continue;
          const ok = (list as Candidate[]).filter((c) => c && typeof c.id === 'string' && Array.isArray(c.files) && c.files.length > 0 && c.files.every((f) => typeof f === 'string'));
          if (ok.length) slots[slot] = ok;
        }
      }
      const defaults: Choice = {};
      if (j.default && typeof j.default === 'object') for (const [k, v] of Object.entries(j.default)) if (typeof v === 'string') defaults[k] = v;
      return { slots, defaults };
    } catch {
      return null; // not there, not JSON (a dev server answers a missing file with a page), or half written
    }
  }

  /** Read the owner's choice again (another tab changed it). */
  rereadChoice(): void {
    this.choice = readChoice();
    this.version++;
  }
  /** Store a choice for a slot: a candidate id, 'synth', 'off', or null to go back to the manifest's default. */
  choose(slot: string, value: string | null): void {
    if (value === null) delete this.choice[slot];
    else this.choice[slot] = value;
    delete this.preview[slot];
    try {
      localStorage.setItem(CHOICE_KEY, JSON.stringify(this.choice));
    } catch {
      /* storage may be unavailable */
    }
    this.version++;
  }
  /** Audition a candidate (or 'synth', 'off') without storing it; null ends the audition. */
  audition(slot: string, value: string | null): void {
    if (value === null) delete this.preview[slot];
    else this.preview[slot] = value;
    this.version++;
  }
  /** The id in force for a slot, before it is looked up: for the soundboard. */
  chosen(slot: string): string {
    return this.preview[slot] ?? this.choice[slot] ?? this.defaults[slot] ?? 'synth';
  }
  /** What plays for a slot: a recording, the synthesised sound, or nothing. */
  pick(slot: string): Candidate | 'synth' | 'off' {
    const want = this.chosen(slot);
    if (want === 'off') return 'off';
    if (want === 'synth') return 'synth';
    return this.slots[slot]?.find((c) => c.id === want) ?? 'synth';
  }

  /** A file: ready, on its way, or failed. Asking for it is what starts it loading. */
  entry(file: string, bed = false): Entry {
    const have = this.files.get(file);
    if (have) {
      if (bed && have.state === 'ready') this.touch(file);
      return have;
    }
    const loading: Entry = { state: 'loading' };
    this.files.set(file, loading);
    void this.fetch(file, bed);
    return loading;
  }
  private async fetch(file: string, bed: boolean): Promise<void> {
    try {
      const r = await fetch(this.base + file);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = await this.core.ctx.decodeAudioData(await r.arrayBuffer());
      let peak = 0;
      let sq = 0;
      let n = 0;
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < d.length; i += bed ? 5 : 1) {
          const v = Math.abs(d[i]);
          if (v > peak) peak = v;
          sq += v * v;
          n++;
        }
      }
      const rms = Math.sqrt(sq / Math.max(1, n));
      if (!(peak > 0.0005)) throw new Error('silent');
      const gain = bed ? Math.max(0.2, Math.min(5, BED_RMS / rms)) : Math.max(0.3, Math.min(4, HIT_PEAK / peak));
      const db = (v: number): number => Math.round(200 * Math.log10(Math.max(v, 1e-6))) / 10;
      this.files.set(file, { state: 'ready', buf, gain, peakDb: db(peak), rmsDb: db(rms) });
      if (bed) this.touch(file);
    } catch (e) {
      this.files.set(file, { state: 'failed', why: e instanceof Error ? e.message : String(e) });
    }
  }
  /** Beds are big once decoded: remember the order they were used in and drop the oldest. */
  private touch(file: string): void {
    const i = this.bedOrder.indexOf(file);
    if (i >= 0) this.bedOrder.splice(i, 1);
    this.bedOrder.push(file);
    while (this.bedOrder.length > KEEP_BEDS) this.files.delete(this.bedOrder.shift()!);
  }
  /** Start loading a slot's files so the first hit is not a synthesised one. */
  warm(slot: string): void {
    const c = this.pick(slot);
    if (typeof c === 'object') for (const f of c.files) this.entry(f);
  }
  /** Forget every file and the manifests, so they are read again (the soundboard's reload). */
  async reload(): Promise<void> {
    this.files.clear();
    this.bedOrder.length = 0;
    this.settled = false;
    await this.load();
  }

  /**
   * Play one variation of a slot's recording into a bus, never the same one twice running, with a small random
   * change of pitch and level. False when no recording is ready: the caller then plays the synthesised sound.
   * A slot switched off counts as played.
   */
  hit(slot: string, dest: AudioNode, t: number, o: { rate?: number; vol?: number; pan?: number; pri?: number } = {}): boolean {
    const c = this.pick(slot);
    if (c === 'off') return true;
    if (c === 'synth') return false;
    let n = 0;
    for (const f of c.files) if (this.entry(f).state === 'ready') n++;
    if (n === 0) return false;
    let k = Math.floor(Math.random() * n);
    if (n > 1 && k === this.last.get(slot)) k = (k + 1 + Math.floor(Math.random() * (n - 1))) % n;
    this.last.set(slot, k);
    let e: Loaded | null = null;
    for (const f of c.files) {
      const x = this.entry(f);
      if (x.state === 'ready' && k-- === 0) e = x;
    }
    if (!e) return false;
    const core = this.core;
    const ctx = core.ctx;
    const rate = (o.rate ?? 1) * (0.97 + Math.random() * 0.06);
    if (!core.claim(t + e.buf.duration / rate, o.pri ?? 2)) return true;
    t = Math.max(t, core.now);
    const src = ctx.createBufferSource();
    src.buffer = e.buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const vol = e.gain * (o.vol ?? 1) * Math.pow(10, ((c.gainDb ?? 0) + (Math.random() - 0.5) * 3) / 20);
    g.gain.value = 0; // see Core.env: zero before the first event
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.002);
    src.connect(g);
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p).connect(dest);
    } else g.connect(dest);
    src.start(t);
    src.onended = () => g.disconnect();
    return true;
  }
}
