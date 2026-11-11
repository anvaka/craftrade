// Experiment 4: frame time under CPU throttling, harness build, headless Chromium (software rendering, no GPU).
//   node tools/exp/mobile/perf.cjs            (TAG=before|after; SECONDS=8; PROFILE=1 writes a CPU profile summary for the stress scene)
// interval = time between animation frames; work = sim + draw + forced rasterisation of the frame (perf=2).
const L = require('./lib.cjs');
const fs = require('fs');
const SECONDS = Number(process.env.SECONDS || 8);
const SCENES = { 'late wave 11': 'wave=11&bot=1&god=1&seed=7', 'stress 300': 'wave=6&bot=1&god=1&stuff=300&seed=7' };
const only = process.argv[2];

async function run(browser, scene, q, dpr, rate, profile) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.addInitScript(() => {
    window.__iv = []; let last = 0;
    const tick = (t) => { if (last && window.__rec) window.__iv.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    // wrap the game's own frame callback to time the work inside it
    window.__work = [];
  });
  await page.goto(`${L.HARNESS}/play.html?${q}`);
  await page.waitForFunction(() => window.__ready);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.waitForTimeout(3000);
  if (profile) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  await page.evaluate(() => { window.__rec = true; window.__perf = []; });
  await page.waitForTimeout(SECONDS * 1000);
  const r = await page.evaluate(() => { window.__rec = false; const c = document.querySelector('.g-canvas'); return { iv: window.__iv, perf: window.__perf, enemies: window.__run.enemyCount, canvas: [c.width, c.height] }; });
  let top = null;
  if (profile) {
    const { profile: p } = await cdp.send('Profiler.stop');
    const self = new Map(); const byId = new Map(p.nodes.map((n) => [n.id, n]));
    const dts = p.timeDeltas; let total = 0;
    p.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + dts[i]); total += dts[i]; });
    top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${(100 * v / total).toFixed(1)}% ${k}`);
  }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ctx.close();
  // the game's own "work ms" lines (5 s windows)
  const work = (r.perf || []).map((t) => { const m = /work ms p50=([\d.]+) p95=([\d.]+)/.exec(t); const d = /drawn=(\d+)/.exec(t); return m ? { p50: +m[1], p95: +m[2], drawn: d ? +d[1] : 0 } : null; }).filter(Boolean);
  const w = work[work.length - 1] || {};
  return { scene, dpr, rate, canvas: r.canvas.join('x'), enemies: r.enemies, frames: r.iv.length, fps: +(r.iv.length / SECONDS).toFixed(1),
    intervalP50: +L.pct(r.iv, 0.5).toFixed(1), intervalP95: +L.pct(r.iv, 0.95).toFixed(1), workP50: w.p50, workP95: w.p95, drawn: w.drawn, top };
}

(async () => {
  const browser = await L.chromium.launch();
  const rows = [];
  for (const [scene, q] of Object.entries(SCENES)) {
    if (only && !scene.includes(only)) continue;
    for (const dpr of [2, 3]) for (const rate of [4, 6]) {
      // perf=2: the frame is rasterised inside the measured span (software here). perf=1: script only, raster left to the compositor.
      const r = await run(browser, scene, q + '&perf=2', dpr, rate, false);
      const j = await run(browser, scene, q + '&perf=1', dpr, rate, false);
      r.jsWorkP50 = j.workP50; r.jsWorkP95 = j.workP95; r.jsIntervalP50 = j.intervalP50; r.jsIntervalP95 = j.intervalP95; r.jsFps = j.fps;
      rows.push(r);
      console.log(`${scene.padEnd(13)} dpr ${dpr} cpu ${rate}x canvas ${r.canvas.padEnd(9)} enemies ${String(r.enemies).padStart(3)} | with raster: frame p50 ${String(r.intervalP50).padStart(5)} p95 ${String(r.intervalP95).padStart(6)} ms, work p50 ${String(r.workP50).padStart(5)} p95 ${String(r.workP95).padStart(5)} | script only: frame p50 ${String(j.intervalP50).padStart(5)} p95 ${String(j.intervalP95).padStart(6)} ms, work p50 ${String(j.workP50).padStart(5)} p95 ${String(j.workP95).padStart(5)}`);
    }
  }
  if (process.env.PROFILE) {
    for (const scene of Object.keys(SCENES)) {
      const r = await run(browser, scene, SCENES[scene] + '&perf=2', 3, 4, true);
      console.log(`\nCPU profile, ${scene}, dpr 3, cpu 4x (self time):\n  ` + r.top.join('\n  '));
      rows.push(r);
    }
  }
  fs.writeFileSync(`${L.OUT}/${L.TAG}-perf.json`, JSON.stringify(rows, null, 1));
  await browser.close();
})();
