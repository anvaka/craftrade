// Experiment 3: touch controls, measured on the harness build.
//   node tools/exp/mobile/controls.cjs [device]
const L = require('./lib.cjs');
const fs = require('fs');
const dev = process.argv[2] || 'se';

(async () => {
  const browser = await L.chromium.launch();
  const out = { dev };
  const s = await L.open(browser, dev);
  const { page, cdp } = s;
  const { width: W, height: H } = s.d.viewport;
  await page.addInitScript(() => {
    const AC = window.AudioContext; window.__acs = [];
    window.AudioContext = class extends AC { constructor(o) { super(o); window.__acs.push(this); } };
    window.__cancels = 0; window.addEventListener('pointercancel', () => window.__cancels++, true);
  });
  await page.goto(`${L.HARNESS}/play.html?seed=5&wave=10&god=1&first=1`);
  await page.waitForFunction(() => window.__ready);
  await page.waitForTimeout(500);
  const pos = () => page.evaluate(() => ({ x: window.__run.player.x, y: window.__run.player.y, t: window.__run.time ?? performance.now() / 1000 }));
  const speed = async (ms = 500) => { const a = await pos(); const t0 = Date.now(); await page.waitForTimeout(ms); const b = await pos(); const dt = (Date.now() - t0) / 1000; return { v: Math.hypot(b.x - a.x, b.y - a.y) / dt, dx: b.x - a.x, dy: b.y - a.y }; };
  const stick = () => page.evaluate(() => { const e = document.querySelector('.g-stick'); if (e.hidden) return null; const r = e.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width }; });
  const audioState = () => page.evaluate(() => window.__acs.map((a) => a.state).join(',') || 'none');

  out.audioBeforeTouch = await audioState();
  out.teachLine = await page.evaluate(() => document.querySelector('.g-teach')?.textContent);
  // a. anchor
  const x0 = Math.round(W * 0.3), y0 = Math.round(H * 0.75);
  await L.touch(cdp, 'touchStart', [{ x: x0, y: y0 }]);
  await page.waitForTimeout(80);
  const st = await stick();
  out.anchor = st ? { touch: [x0, y0], stickCentre: [Math.round(st.cx), Math.round(st.cy)], sizePx: st.w, floating: Math.hypot(st.cx - x0, st.cy - y0) < 2 } : 'no stick shown';
  out.audioAfterFirstTouchDown = await audioState();
  // b. response curve
  out.curve = [];
  for (const d of [0, 4, 6, 8, 12, 22, 33, 44, 90]) {
    await L.touch(cdp, 'touchMove', [{ x: x0 + d, y: y0 }]);
    await page.waitForTimeout(120);
    out.curve.push({ dragPx: d, speedPxS: Math.round((await speed(400)).v) });
    await L.touch(cdp, 'touchMove', [{ x: x0 + Math.min(d, 44) - d + (d > 44 ? d : 0), y: y0 }]); // settle
    await L.touch(cdp, 'touchEnd', []); await page.waitForTimeout(60);
    await L.touch(cdp, 'touchStart', [{ x: x0, y: y0 }]); await page.waitForTimeout(40);
  }
  // direction change after the base has followed the thumb: how far back must the thumb travel to reverse
  await L.touch(cdp, 'touchMove', [{ x: x0 + 150, y: y0 }]); await page.waitForTimeout(100);
  let rev = null;
  for (let back = 4; back <= 100; back += 4) { await L.touch(cdp, 'touchMove', [{ x: x0 + 150 - back, y: y0 }]); const v = await speed(120); if (v.dx < -1) { rev = back; break; } }
  out.reverseAfterLongDragPx = rev;
  // c. lift stops
  await L.touch(cdp, 'touchMove', [{ x: x0 + 60, y: y0 }]); await page.waitForTimeout(200);
  await L.touch(cdp, 'touchEnd', []);
  await page.waitForTimeout(50);
  out.liftStops = { speedAfterLift: Math.round((await speed(300)).v), stickHidden: (await stick()) === null };
  out.audioAfterFirstLift = await audioState();
  // d. second finger
  await L.touch(cdp, 'touchStart', [{ x: x0, y: y0, id: 0 }]);
  await L.touch(cdp, 'touchMove', [{ x: x0 + 44, y: y0, id: 0 }]); await page.waitForTimeout(150);
  const before = await speed(300);
  await L.touch(cdp, 'touchStart', [{ x: x0 + 44, y: y0, id: 0 }, { x: W * 0.8, y: H * 0.6, id: 1 }]);
  await L.touch(cdp, 'touchMove', [{ x: x0 + 44, y: y0, id: 0 }, { x: W * 0.8, y: H * 0.6 - 60, id: 1 }]); await page.waitForTimeout(100);
  const during = await speed(300);
  await L.touch(cdp, 'touchEnd', [{ x: W * 0.8, y: H * 0.6 - 60, id: 1 }]); await page.waitForTimeout(100); // second finger lifts (touchEnd lists the released points)
  const after2 = await speed(300);
  // now the first finger lifts while a second is still down
  await L.touch(cdp, 'touchStart', [{ x: x0 + 44, y: y0, id: 0 }, { x: W * 0.8, y: H * 0.6, id: 1 }]); await page.waitForTimeout(60);
  await L.touch(cdp, 'touchEnd', [{ x: x0 + 44, y: y0, id: 0 }]); await page.waitForTimeout(100); // first finger lifts, second stays
  await L.touch(cdp, 'touchMove', [{ x: W * 0.8, y: H * 0.6 - 50, id: 1 }]); await page.waitForTimeout(150);
  const handover = await speed(300);
  await L.touch(cdp, 'touchEnd', []); await page.waitForTimeout(80);
  out.secondFinger = {
    firstAlone: `${Math.round(before.dx)},${Math.round(before.dy)}`, withSecondDown: `${Math.round(during.dx)},${Math.round(during.dy)}`,
    afterSecondLifts: `${Math.round(after2.dx)},${Math.round(after2.dy)}`, keepsDirection: before.dx > 5 && during.dx > 5 && Math.abs(during.dy) < 3 && after2.dx > 5,
    handoverToRemainingFinger: `${Math.round(handover.dx)},${Math.round(handover.dy)}`, remainingFingerSteers: handover.dy < -5,
    stuckAfterAllLift: Math.round((await speed(250)).v),
  };
  // e. edges and browser gestures (what Chromium can show: no scroll, no zoom, no pointercancel)
  const cancels0 = await page.evaluate(() => window.__cancels);
  for (const [ex, ey, tx, ty] of [[2, H / 2, 120, H / 2], [W - 2, H / 2, W - 120, H / 2], [W / 2, 2, W / 2, 160], [W / 2, H - 2, W / 2, H - 160]]) {
    await L.drag(cdp, page, ex, ey, tx, ty, 200); await L.touch(cdp, 'touchEnd', []);
  }
  // pinch
  await L.touch(cdp, 'touchStart', [{ x: W / 2 - 30, y: H / 2, id: 0 }, { x: W / 2 + 30, y: H / 2, id: 1 }]);
  for (let i = 1; i <= 10; i++) { await L.touch(cdp, 'touchMove', [{ x: W / 2 - 30 - i * 10, y: H / 2, id: 0 }, { x: W / 2 + 30 + i * 10, y: H / 2, id: 1 }]); await page.waitForTimeout(16); }
  await L.touch(cdp, 'touchEnd', []);
  // double tap
  await page.touchscreen.tap(W / 2, H / 2); await page.waitForTimeout(60); await page.touchscreen.tap(W / 2, H / 2); await page.waitForTimeout(400);
  out.gestures = await page.evaluate((c0) => ({ scrollY: window.scrollY, scrollX: window.scrollX, zoom: window.visualViewport.scale, pointercancels: window.__cancels - c0,
    stageTouchAction: getComputedStyle(document.querySelector('.g-stage')).touchAction, bodyOverscroll: getComputedStyle(document.body).overscrollBehaviorY, htmlOverscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
    selection: String(getSelection()).length }), cancels0);
  // f. touch that starts on HUD furniture
  const hp = await page.locator('.g-tl').boundingBox();
  await L.touch(cdp, 'touchStart', [{ x: hp.x + 30, y: hp.y + 20 }]); await L.touch(cdp, 'touchMove', [{ x: hp.x + 80, y: hp.y + 20 }]);
  out.dragFromHpBarMoves = (await speed(250)).v > 20; await L.touch(cdp, 'touchEnd', []);
  const snd = await page.locator('.g-snd').boundingBox();
  out.bottomPanel = { rect: [Math.round(snd.x), Math.round(snd.y), Math.round(snd.width), Math.round(snd.height)], shareOfBottomRowPct: Math.round(100 * snd.width / W) };
  const vol = page.locator('.g-snd .vol');
  if (await vol.isVisible()) {
    const vb = await vol.boundingBox(); const v0 = await vol.inputValue();
    await L.drag(cdp, page, vb.x + vb.width * 0.7, vb.y + vb.height / 2, vb.x + 4, vb.y + vb.height / 2, 200); await L.touch(cdp, 'touchEnd', []);
    out.thumbOnVolumeSliderChangesVolume = (await vol.inputValue()) !== v0;
  } else out.thumbOnVolumeSliderChangesVolume = 'no slider in the HUD';
  // g. rotate mid-run with the stick held
  await L.touch(cdp, 'touchStart', [{ x: x0, y: y0 }]); await L.touch(cdp, 'touchMove', [{ x: x0 + 44, y: y0 }]);
  await page.setViewportSize({ width: H, height: W }); await page.waitForTimeout(500);
  const rot = await page.evaluate(() => { const c = document.querySelector('.g-canvas'); const r = c.getBoundingClientRect(); const p = window.__run.player;
    return { canvasCss: [r.width, r.height], canvasPx: [c.width, c.height], win: [innerWidth, innerHeight], dpr: devicePixelRatio, hudCols: getComputedStyle(document.querySelector('.g-hud')).gridTemplateColumns.split(' ').length, phase: window.__run.phase }; });
  await L.touch(cdp, 'touchEnd', []);
  await L.touch(cdp, 'touchStart', [{ x: 200, y: 200 }]); await L.touch(cdp, 'touchMove', [{ x: 244, y: 200 }]);
  rot.movesAfterRotate = (await speed(300)).dx > 5; await L.touch(cdp, 'touchEnd', []);
  await L.shot(page, `${dev}-controls-rotated`);
  await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(400);
  rot.backCanvasCss = await page.evaluate(() => { const r = document.querySelector('.g-canvas').getBoundingClientRect(); return [r.width, r.height]; });
  rot.errors = s.log.errors.slice();
  out.rotate = rot;
  // h. backgrounding (synthetic: Chromium headless does not hide a tab for real)
  await L.touch(cdp, 'touchStart', [{ x: x0, y: y0 }]); await L.touch(cdp, 'touchMove', [{ x: x0 + 44, y: y0 }]);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => window.__run.waveTime);
  const bg = { paused: await page.evaluate(() => !document.querySelector('.g-pause').hidden), audio: await audioState() };
  await page.waitForTimeout(1000);
  bg.simAdvancedWhileHidden = (await page.evaluate(() => window.__run.waveTime)) - t1;
  await L.touch(cdp, 'touchEnd', []);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  bg.afterReturn = { stillPaused: await page.evaluate(() => !document.querySelector('.g-pause').hidden), audio: await audioState(), driftsWithoutTouch: Math.round((await speed(300)).v) };
  await L.shot(page, `${dev}-controls-pause`);
  await L.tap(page, '[data-fk="resume"]');
  bg.resumed = await page.evaluate(() => document.querySelector('.g-pause').hidden);
  out.background = bg;
  out.errors = s.log.errors;
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(`${L.OUT}/${L.TAG}-controls-${dev}.json`, JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
