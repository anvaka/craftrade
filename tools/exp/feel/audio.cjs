// Nobody can listen to the game from here, so measure it: render every sound, the work song and a
// busy wave through an OfflineAudioContext in headless Chromium and report levels.
//   node tools/exp/feel/audio.cjs [base url] [tag]        (default http://localhost:8841 after)
// Works against any tree that has src/client/audio/{kit,sounds}.ts; the engine and bed sections
// need this branch's index.ts (AudioEngine taking an offline context) and are skipped otherwise.
// Output: a table on stdout and $OUT/<tag>-audio.json.
//
// What is reported
//   raw       one sound from its definition, straight to the output: peak and RMS in dBFS over its
//             own length, spectral centroid, share of its energy in the telegraph's two bands
//             (430-550 Hz, its knock, and 880-1080 Hz, its rattle)
//   chain     the same sound through the game's chain (bus 0.8, compressor, limiter) at volume 1
//   bed       eight bars of the work song at four levels, through the engine
//   wave      six seconds of a wave-10 mix (15 hits/s, 7 kills/s, 6 shots/s, 5 scrip/s, the bed) with
//             a telegraph at 2 s and 4 s: how far the telegraph stands over everything else in its
//             own band, with and without the ducking; and the peak of the whole mix
//   pile      every sound started at once, through the chain: the limiter's worst case
// Clipping means any output sample at or over 1.0 (0 dBFS).
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:8841';
const TAG = process.argv[3] || 'after';
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/feel';
fs.mkdirSync(OUT, { recursive: true });

const PAGE = `<!doctype html><meta charset="utf-8"><title>feel audio</title><script type="module">
import { Kit } from '/src/client/audio/kit.ts';
import { SOUNDS } from '/src/client/audio/sounds.ts';
let engineMod = null, musicMod = null;
try { engineMod = await import('/src/client/audio/index.ts'); musicMod = await import('/src/client/audio/music.ts'); } catch (e) { /* older tree */ }
const SR = 48000;
// A fixed generator in place of Math.random, so two runs give the same numbers.
let seed = 12345;
Math.random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function noise(ctx) { const b = ctx.createBuffer(1, SR * 2, SR); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function chain(ctx) { // the game's master chain, as in audio/index.ts
  const bus = ctx.createGain(); bus.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.14;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
  bus.connect(comp); comp.connect(lim); lim.connect(ctx.destination); return bus;
}
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = -2 * Math.PI / len; const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k]; const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
      re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } } }
const N = 4096;
function spectrum(x, from, to) { // averaged power spectrum over [from, to) samples
  const P = new Float64Array(N / 2); let frames = 0;
  for (let s = from; s + N <= Math.max(to, from + N); s += N / 2) { const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = (x[s + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); fft(re, im);
    for (let i = 0; i < N / 2; i++) P[i] += re[i] * re[i] + im[i] * im[i]; frames++; if (s + N >= to) break; }
  for (let i = 0; i < N / 2; i++) P[i] /= Math.max(1, frames); return P; }
const hz = (i) => i * SR / N;
function band(P, lo, hi) { let e = 0; for (let i = 0; i < P.length; i++) if (hz(i) >= lo && hz(i) < hi) e += P[i]; return e; }
const db = (v) => v > 0 ? 20 * Math.log10(v) : -Infinity;
function analyse(x, t0, t1) { const a = Math.floor(t0 * SR), b = Math.min(x.length, Math.ceil(t1 * SR)); let peak = 0, sq = 0, clip = 0;
  for (let i = a; i < b; i++) { const v = Math.abs(x[i]); if (v > peak) peak = v; sq += v * v; if (v >= 1) clip++; }
  const P = spectrum(x, a, b); let num = 0, den = 0; for (let i = 1; i < P.length; i++) { num += hz(i) * P[i]; den += P[i]; }
  const share = (lo, hi) => +(den ? band(P, lo, hi) / den : 0).toFixed(3);
  return { peakDb: +db(peak).toFixed(1), rmsDb: +db(Math.sqrt(sq / Math.max(1, b - a))).toFixed(1), centroidHz: Math.round(den ? num / den : 0), tellBand: +(den ? (band(P, 430, 550) + band(P, 880, 1080)) / den : 0).toFixed(3),
    bands: [share(0, 300), share(300, 430), share(430, 550), share(550, 880), share(880, 1080), share(1080, 2500), share(2500, 24000)], clipped: clip, seconds: +(t1 - t0).toFixed(2) }; }

async function renderRaw(id, useChain) { const ctx = new OfflineAudioContext(1, SR * 3, SR); const out = useChain ? chain(ctx) : ctx.destination; const def = SOUNDS[id];
  const v = ctx.createGain(); v.gain.value = def.gain; v.connect(out); const kit = new Kit(ctx, v, noise(ctx), 1, 0.02); def.make(kit, 0.02);
  const buf = await ctx.startRendering(); return analyse(buf.getChannelData(0), 0.02, 0.02 + kit.end + 0.03); }

// The wave-10 mix. gains are what game/sound.ts passes.
function waveEvents(seconds) { const ev = []; const add = (id, rate, gain, pitch = 1) => { for (let t = 0.05; t < seconds; t += 1 / rate) ev.push({ t: t + Math.random() * 0.02, id, gain, pitch }); };
  add('hit', 15, 0.8); add('kill', 7, 1); add('shot', 6, 0.75 * 0.8, 1.25); add('edge', 4, 0.8); add('scrip', 5, 0.8); add('crit', 2, 1);
  return ev.sort((a, b) => a.t - b.t); }
const TELLS = [2.0, 4.0];
async function mixRaw(events, seconds) { const ctx = new OfflineAudioContext(1, SR * seconds, SR); const out = chain(ctx); const nb = noise(ctx);
  for (const e of events) { const def = SOUNDS[e.id]; const v = ctx.createGain(); v.gain.value = def.gain * e.gain; v.connect(out); def.make(new Kit(ctx, v, nb, e.pitch || 1, e.t), e.t); }
  return (await ctx.startRendering()).getChannelData(0); }
async function mixEngine(events, seconds, o) { const ctx = new OfflineAudioContext(2, SR * seconds, SR); const eng = new engineMod.AudioEngine(ctx); eng.ducking = o.duck;
  if (o.bed !== null) for (let b = 0, t = 0.02; t < seconds; b++, t += musicMod.BED_BAR) eng.writeBar(t, b, o.bed);
  for (const e of events) eng.play(e.id, { at: e.t, gain: e.gain, pitch: e.pitch });
  const buf = await ctx.startRendering(); const L = buf.getChannelData(0), R = buf.getChannelData(1); const m = new Float32Array(L.length); for (let i = 0; i < m.length; i++) m[i] = Math.max(Math.abs(L[i]), Math.abs(R[i])) * Math.sign(L[i] || 1); return { m, L }; }
// The telegraph is a 490 Hz knock under a narrow rattle at 980 Hz: its energy sits in those two bands.
function tellEnergy(x) { let e = 0; for (const t of TELLS) { const P = spectrum(x, Math.floor(t * SR), Math.floor((t + 0.3) * SR)); e += band(P, 430, 550) + band(P, 880, 1080); } return e; }
const ratio = (sig, mask) => +(10 * Math.log10(sig / mask)).toFixed(1);

window.__measure = async () => {
  const res = { sounds: {}, hasEngine: !!engineMod?.AudioEngine };
  for (const id of Object.keys(SOUNDS)) { seed = 12345; const raw = await renderRaw(id, false); seed = 12345; const ch = await renderRaw(id, true); res.sounds[id] = { raw, chain: ch, bus: SOUNDS[id].bus || '', duck: SOUNDS[id].duck || 0 }; }
  // telegraph against the wave mix, tool's own chain, no ducking: comparable between trees
  seed = 777; const maskEv = waveEvents(6); const tellEv = TELLS.map((t) => ({ t, id: 'telegraph', gain: 1, pitch: 1 }));
  seed = 1; const maskRaw = await mixRaw(maskEv, 6); seed = 1; const tellRaw = await mixRaw(tellEv, 6); seed = 1; const allRaw = await mixRaw([...maskEv, ...tellEv].sort((a, b) => a.t - b.t), 6);
  res.wave = { noDuck: { tellOverMaskDb: ratio(tellEnergy(tellRaw), tellEnergy(maskRaw)), mix: analyse(allRaw, 0, 6) } };
  if (res.hasEngine) {
    const silentTell = TELLS.map((t) => ({ t, id: 'telegraph', gain: 0, pitch: 1 }));
    for (const duck of [false, true]) {
      seed = 1; const mask = await mixEngine([...maskEv, ...silentTell].sort((a, b) => a.t - b.t), 6, { duck, bed: 0.8 });
      seed = 1; const tell = await mixEngine(tellEv, 6, { duck, bed: null });
      seed = 1; const all = await mixEngine([...maskEv, ...tellEv].sort((a, b) => a.t - b.t), 6, { duck, bed: 0.8 });
      res.wave[duck ? 'engineDuck' : 'engineNoDuck'] = { tellOverMaskDb: ratio(tellEnergy(tell.L), tellEnergy(mask.L)), mix: analyse(all.m, 0, 6) };
    }
    res.bed = {};
    for (const level of [0, 0.2, 0.5, 0.7, 1]) { seed = 5; const b = await mixEngine([], Math.ceil(musicMod.BED_BAR * 8 + 1), { duck: true, bed: level }); res.bed[level] = analyse(b.m, 0.02, musicMod.BED_BAR * 8); }
    res.bedGain = engineMod.BED_GAIN; res.bpm = musicMod.BED_BPM;
    // the level-up, wave-clear and heartbeat beats as the game plays them
    res.beats = {};
    for (const [name, evs, len] of [['levelUp x1.15', [{ t: 0.02, id: 'levelUp', gain: 1.15 }], 1], ['waveEnd + sweep + paid', [{ t: 0.02, id: 'waveEnd', gain: 1 }, ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ t: 0.14 + i * 0.065, id: 'scrip', gain: 0.9 })), { t: 0.44, id: 'paid', gain: 1 }], 1.6], ['heart', [{ t: 0.02, id: 'heart', gain: 1 }], 0.6]]) {
      seed = 9; const b = await mixEngine(evs, 3, { duck: true, bed: null }); res.beats[name] = analyse(b.m, 0.02, len); }
  }
  // every sound at once
  seed = 3; const pile = await mixRaw(Object.keys(SOUNDS).map((id) => ({ t: 0.05, id, gain: 1, pitch: 1 })), 3); res.pile = analyse(pile, 0, 2.5);
  return res;
};
window.__ready = true;
</script>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(`${BASE}/__feel_audio.html`, (r) => r.fulfill({ contentType: 'text/html', body: PAGE }));
  await page.goto(`${BASE}/__feel_audio.html`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  const res = await page.evaluate(() => window.__measure());
  await browser.close();
  fs.writeFileSync(`${OUT}/${TAG}-audio.json`, JSON.stringify(res, null, 1));

  const pad = (s, n) => String(s).padEnd(n), num = (v, n = 7) => String(v).padStart(n);
  console.log(`${TAG}: ${BASE}${errors.length ? `  page errors: ${errors.join(' | ')}` : ''}`);
  console.log(`\n${pad('sound', 12)} ${pad('bus', 7)} raw peak   rms  centroid  tell-band | chain peak   rms  clipped`);
  let clipped = 0; const chainRms = [];
  for (const [id, s] of Object.entries(res.sounds)) {
    clipped += s.chain.clipped; chainRms.push(s.chain.rmsDb);
    console.log(`${pad(id, 12)} ${pad(s.bus, 7)} ${num(s.raw.peakDb)} ${num(s.raw.rmsDb, 6)} ${num(s.raw.centroidHz, 7)} Hz ${num((s.raw.tellBand * 100).toFixed(1), 6)}% | ${num(s.chain.peakDb, 9)} ${num(s.chain.rmsDb, 6)} ${num(s.chain.clipped, 6)}`);
  }
  chainRms.sort((a, b) => a - b);
  const med = chainRms[Math.floor(chainRms.length / 2)];
  console.log(`\nchain RMS over all sounds: min ${chainRms[0]}  median ${med}  max ${chainRms[chainRms.length - 1]} dBFS; samples at or over 0 dBFS after the chain, all single sounds: ${clipped}`);
  console.log('\nshare of energy by band, Hz:   0-300  300-430  430-550  550-880  880-1080  1080-2500  2500+');
  for (const id of ['telegraph', 'hit', 'crit', 'kill', 'shot', 'edge', 'hurt', 'heart']) if (res.sounds[id]) console.log(`  ${pad(id, 12)}              ${res.sounds[id].raw.bands.map((v) => num((v * 100).toFixed(0) + '%', 8)).join(' ')}`);
  if (res.bed) {
    console.log(`\nwork song, ${res.bpm} bpm, bed gain ${res.bedGain}, 8 bars through the engine:`);
    // "over 300 Hz" is the part a phone speaker gives back: the RMS of what is left above it.
    const hi = (a) => (a.rmsDb + 10 * Math.log10(Math.max(1e-9, 1 - a.bands[0]))).toFixed(1);
    for (const [lv, a] of Object.entries(res.bed)) console.log(`  level ${pad(lv, 4)} peak ${num(a.peakDb)}  rms ${num(a.rmsDb, 6)} (${(a.rmsDb - med).toFixed(1)} dB against the median effect)  over 300 Hz ${num(hi(a), 6)}  centroid ${num(a.centroidHz, 5)} Hz  clipped ${a.clipped}`);
    console.log(`  heart: rms ${res.sounds.heart.chain.rmsDb}, over 300 Hz ${hi(res.sounds.heart.chain)}; hit: rms ${res.sounds.hit.chain.rmsDb}, over 300 Hz ${hi(res.sounds.hit.chain)}; scrip: rms ${res.sounds.scrip.chain.rmsDb}, over 300 Hz ${hi(res.sounds.scrip.chain)}`);
    console.log('\nbeats, through the engine:');
    for (const [k, a] of Object.entries(res.beats)) console.log(`  ${pad(k, 24)} peak ${num(a.peakDb)}  rms ${num(a.rmsDb, 6)}  centroid ${num(a.centroidHz, 5)} Hz  clipped ${a.clipped}`);
  }
  console.log('\ntelegraph over the wave-10 mix, in its own two bands (430-550 and 880-1080 Hz), 0.3 s windows:');
  for (const [k, w] of Object.entries(res.wave)) console.log(`  ${pad(k, 13)} ${num(w.tellOverMaskDb)} dB   whole mix: peak ${w.mix.peakDb}  rms ${w.mix.rmsDb} dBFS  clipped ${w.mix.clipped}`);
  console.log(`\nevery sound at once through the chain: peak ${res.pile.peakDb} dBFS, rms ${res.pile.rmsDb}, clipped ${res.pile.clipped}`);
  console.log('\nNobody has listened to any of this. These are levels, not a judgement of how it sounds.');
})();
