// Scenario F: frame times in a late wave with many enemies (debug page ?demo=wave&waves=9, warped to the swell/peak).
import { Session, sleep } from './e2e-lib.mjs';

async function measure(S, label, seconds = 10) {
  const page = S.page;
  await S.attach();
  const s0 = await S.state();
  const m0 = await page.metrics();
  const samples = [];
  const timer = setInterval(async () => {
    const s = await S.state().catch(() => null);
    if (s) samples.push({ t: +s.waveT.toFixed(1), beat: s.beat, enemies: s.enemies.length, shots: s.shots.length });
  }, 1000);
  const ts = await page.evaluate((ms) => new Promise((res) => {
    const out = [];
    let last = performance.now();
    const t0 = last;
    const f = (now) => {
      out.push(now - last);
      last = now;
      if (now - t0 < ms) requestAnimationFrame(f);
      else res(out);
    };
    requestAnimationFrame(f);
  }), seconds * 1000);
  clearInterval(timer);
  const m1 = await page.metrics();
  const s1 = await S.state();
  ts.shift();
  const sorted = [...ts].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const avg = ts.reduce((a, b) => a + b, 0) / ts.length;
  const r = {
    label, frames: ts.length, fps: +(1000 / avg).toFixed(1), avgMs: +avg.toFixed(2), p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), p99: +q(0.99).toFixed(1), worstMs: +sorted[sorted.length - 1].toFixed(1),
    over20ms: ts.filter((x) => x > 20).length, over34ms: ts.filter((x) => x > 34).length, over50ms: ts.filter((x) => x > 50).length,
    scriptMsPerFrame: +(((m1.ScriptDuration - m0.ScriptDuration) * 1000) / ts.length).toFixed(2), taskMsPerFrame: +(((m1.TaskDuration - m0.TaskDuration) * 1000) / ts.length).toFixed(2),
    heapMB: [+(m0.JSHeapUsedSize / 1e6).toFixed(1), +(m1.JSHeapUsedSize / 1e6).toFixed(1)],
    waveT: [+s0.waveT.toFixed(1), +s1.waveT.toFixed(1)], gameSecondsPerRealSecond: +((s1.waveT - s0.waveT) / seconds).toFixed(2),
    enemies: samples.map((x) => x.enemies), beats: [...new Set(samples.map((x) => x.beat))],
  };
  S.log('PERF ' + JSON.stringify(r));
  return r;
}

export default async function scenarioF() {
  const S = new Session('F-perf');
  const page = await S.launch({ width: 1280, height: 900, dsf: 1 });
  try {
    const gpu = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    S.log('renderer: ' + gpu);
    for (const [label, vp, query] of [
      ['wave10 desktop 1280x900 dpr1', { width: 1280, height: 900, deviceScaleFactor: 1 }, '?demo=wave&waves=9&warp=38'],
      ['wave10 desktop 1280x900 dpr2', { width: 1280, height: 900, deviceScaleFactor: 2 }, '?demo=wave&waves=9&warp=38'],
      ['wave10 desktop 1920x1080 dpr2', { width: 1920, height: 1080, deviceScaleFactor: 2 }, '?demo=wave&waves=9&warp=38'],
      ['wave11 desktop 1280x900 dpr2', { width: 1280, height: 900, deviceScaleFactor: 2 }, '?demo=wave&waves=10&warp=42'],
      ['wave10 phone 390x844 dpr3', { width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, '?demo=wave&waves=9&warp=38'],
      ['wave1 desktop 1280x900 dpr1 (baseline)', { width: 1280, height: 900, deviceScaleFactor: 1 }, '?demo=wave&waves=0&warp=2'],
    ]) {
      await page.setViewport(vp);
      const t0 = Date.now();
      await S.goto(query);
      S.log(`${label}: page ready ${Date.now() - t0}ms after navigation (includes the headless warp simulation)`);
      await sleep(1200);
      await measure(S, label, 10);
      await S.shot(label.replace(/\W+/g, '-'));
    }
    // Stress: pin heat at 100 so the arrival rate triples and the enemy cap (90) is reached; the harness writes game state here, and only here.
    const cdp = await page.createCDPSession();
    for (const [label, vp, rate] of [
      ['STRESS wave10 heat100 desktop 1280x900 dpr2', { width: 1280, height: 900, deviceScaleFactor: 2 }, 1],
      ['STRESS wave10 heat100 desktop 1280x900 dpr2 cpu4x', { width: 1280, height: 900, deviceScaleFactor: 2 }, 4],
      ['STRESS wave10 heat100 phone 390x844 dpr3 cpu4x', { width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, 4],
      ['STRESS wave10 heat100 phone 390x844 dpr3 cpu6x', { width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, 6],
      ['STRESS wave12 heat100 phone 844x390 dpr3 cpu6x', { width: 844, height: 390, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, 6],
    ]) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await page.setViewport(vp);
      await S.goto(label.includes('wave12') ? '?demo=wave&waves=11&warp=30' : '?demo=wave&waves=9&warp=30');
      await S.attach();
      await page.evaluate(() => {
        setInterval(() => {
          const g = window.__qa.game;
          g.heat = 100;
          g.p.hp = 9999;
        }, 100);
      });
      await sleep(6000);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await sleep(1500);
      await measure(S, label, 10);
      await S.shot(label.replace(/\W+/g, '-'));
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  } catch (e) {
    S.finding('SCRIPT ABORTED: ' + (e.stack || e));
    await S.shot('abort').catch(() => {});
  }
  await S.close();
}
