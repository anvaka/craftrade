// The slow-device fallback: under heavy CPU throttling the canvas should step down in resolution and frames should get cheaper.
//   node tools/exp/mobile/quality.cjs [rate=20]
const L = require('./lib.cjs');
(async () => {
  const rate = Number(process.argv[2] || 20);
  const browser = await L.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  await page.addInitScript(() => { window.__iv = []; let last = 0; const tick = (t) => { if (last) window.__iv.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.goto(`${L.HARNESS}/play.html?wave=6&bot=1&god=1&stuff=300&seed=7&perf=2`);
  await page.waitForFunction(() => window.__ready);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => { window.__iv.length = 0; });
    await page.waitForTimeout(4000);
    const r = await page.evaluate(() => { const c = document.querySelector('.g-canvas'); const s = window.__iv.slice().sort((a, b) => a - b); return { canvas: c.width + 'x' + c.height, quality: window.__quality ?? 1, frames: s.length, p50: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)] }; });
    console.log(`t=${(i + 1) * 4}s cpu ${rate}x canvas ${r.canvas} quality ${r.quality} frames ${r.frames} frame p50 ${r.p50?.toFixed(1)} p95 ${r.p95?.toFixed(1)} ms`);
  }
  await L.shot(page, 'quality-low');
  await browser.close();
})();
