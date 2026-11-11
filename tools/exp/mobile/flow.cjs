// Experiment 1: the whole real flow by touch only.
//   node tools/exp/mobile/flow.cjs se            (TAG=before|after, WAVES_ACTIVE=4)
// first load -> Head out -> waves steered with a touch drag -> bench (pick, lock, buy, reroll, anvil, mule)
// -> stand still and die -> carry -> homecoming -> town; then four stub runs to open every tab and a visit to each.
const L = require('./lib.cjs');
const dev = process.argv[2] || 'se';
const ACTIVE = Number(process.env.WAVES_ACTIVE || 4);
const fs = require('fs');

(async () => {
  const browser = await L.chromium.launch();
  const s = await L.open(browser, dev);
  const { page, cdp, log } = s;
  const { width: W, height: H } = s.d.viewport;
  const out = { dev, steps: [], bench: {}, notes: [] };
  const step = (n, extra) => { out.steps.push(n + (extra ? ': ' + extra : '')); console.log(`[${dev}] ${n}${extra ? ': ' + extra : ''}`); };
  const vis = (sel) => page.evaluate((q) => { const e = document.querySelector(q); return !!e && !e.hidden && e.getClientRects().length > 0; }, sel);
  const has = (sel) => page.locator(sel).count().then((n) => n > 0);

  const t0 = Date.now();
  await page.goto(L.BASE + '/');
  await page.waitForSelector('[data-fk="headout"]');
  step('first load', `${Date.now() - t0} ms to Head out`);
  await L.shot(page, `${dev}-flow-01-home`);
  await L.tap(page, '[data-fk="headout"]');
  await page.waitForSelector('.g-hud');
  step('run started');
  await page.waitForTimeout(600);
  await L.shot(page, `${dev}-flow-02-wave1`);

  let benchN = 0, ended = false;
  for (let guard = 0; guard < 40 && !ended; guard++) {
    // ---- a wave ----
    const active = benchN < ACTIVE;
    const cx = W * 0.5, cy = H * 0.72;
    let a = 0, downAt = 0;
    if (active) { await L.touch(cdp, 'touchStart', [{ x: cx, y: cy }]); downAt = Date.now(); }
    let shotDone = false;
    for (;;) {
      if (await vis('.g-bench')) break;
      if (await vis('.g-end')) { ended = true; break; }
      if (active) {
        // Hold the stick over and turn it slowly: the player runs a wide loop, which outpaces most early waves.
        for (let i = 0; i < 12; i++) { a += 0.012; await L.touch(cdp, 'touchMove', [{ x: cx + Math.cos(a) * 60, y: cy + Math.sin(a) * 60 }]); await page.waitForTimeout(25); }
        if (!shotDone && Date.now() - downAt > 4000) { shotDone = true; await L.shot(page, `${dev}-flow-03-wave${benchN + 1}-stick`); }
      } else await page.waitForTimeout(400);
    }
    if (active) await L.touch(cdp, 'touchEnd', []);
    if (ended) break;
    benchN++;
    step(`bench ${benchN}`);
    await page.waitForTimeout(300);
    if (benchN <= 2) await L.shot(page, `${dev}-flow-04-bench${benchN}`, false);
    // ---- the bench, by touch ----
    const B = out.bench;
    for (let i = 0; i < 6 && await has('.g-bench [data-fk="pick0"]'); i++) { await L.tap(page, '.g-bench [data-fk="pick0"]'); B.pick = (B.pick || 0) + 1; }
    if (benchN <= ACTIVE) {
      if (await has('.g-bench [data-fk="lock0"]')) { await L.tap(page, '.g-bench [data-fk="lock0"]'); B.lock = (B.lock || 0) + 1; await L.tap(page, '.g-bench [data-fk="lock0"]'); }
      for (let i = 0; i < 4; i++) {
        const sel = `.g-bench [data-fk="buy${i}"]:not([disabled]):not([aria-disabled="true"])`;
        if (await has(sel)) { await L.tap(page, sel); B.buy = (B.buy || 0) + 1; }
      }
      const rr = '.g-bench [data-fk="reroll"]:not([aria-disabled="true"])';
      if (await has(rr)) { await L.tap(page, rr); B.reroll = (B.reroll || 0) + 1; }
      for (let i = 0; i < 4; i++) {
        const sel = `.g-bench [data-fk="buy${i}"]:not([disabled]):not([aria-disabled="true"])`;
        if (await has(sel)) { await L.tap(page, sel); B.buy = (B.buy || 0) + 1; }
      }
      const picks = page.locator('.g-anvil-picks button');
      if (await picks.count() >= 2) {
        await L.tap(page, picks.nth(0)); await L.tap(page, page.locator('.g-anvil-picks button').nth(1));
        const st = '.g-bench [data-fk="strike"]:not([aria-disabled="true"])';
        if (await has(st)) {
          await L.tap(page, st);
          try { await page.waitForSelector('.g-bench [data-fk="reveal-done"]', { timeout: 15000 }); await L.shot(page, `${dev}-flow-05-reveal`); await L.tap(page, '.g-bench [data-fk="reveal-done"]'); B.fuse = (B.fuse || 0) + 1; }
          catch { B.fuseFail = await page.evaluate(() => document.querySelector('.g-reason .text')?.textContent); }
        } else B.strikeBlocked = await page.evaluate(() => document.querySelector('.g-block')?.textContent || 'disabled');
      }
      const more = '.g-bench [data-fk="p-timber"]:not([disabled]):not([aria-disabled="true"])';
      if (await has(more) && await has('.g-bench [data-fk="mule"]')) { await L.tap(page, more); await L.tap(page, '.g-bench [data-fk="mule"]'); B.mule = (B.mule || 0) + 1; }
      if (benchN === 1) await L.shot(page, `${dev}-flow-04-bench1-after`, false);
    }
    await L.tap(page, '.g-bench [data-fk="next"]');
    await page.waitForTimeout(300);
    if (await vis('.g-bench')) { out.notes.push(`bench ${benchN}: next did not start the wave: ` + await page.evaluate(() => document.querySelector('.g-reason .text')?.textContent)); await L.tap(page, '.g-bench [data-fk="next"]'); }
  }
  step('run over', JSON.stringify(out.bench));
  await page.waitForTimeout(400);
  await L.shot(page, `${dev}-flow-06-end`);
  out.endText = await page.evaluate(() => document.querySelector('.g-end h1')?.textContent);
  if (await has('[data-fk="carry0"]')) { await L.tap(page, '[data-fk="carry0"]'); out.carried = await page.evaluate(() => document.querySelector('[data-fk="carry0"]')?.getAttribute('aria-pressed')); await L.shot(page, `${dev}-flow-07-carry`); }
  else out.carried = 'no carry offered';
  await L.tap(page, '[data-fk="go"]');
  await page.waitForSelector('[data-fk="totown"]', { timeout: 10000 });
  await page.waitForTimeout(1200);
  step('homecoming', await page.evaluate(() => document.querySelector('#town h1')?.textContent));
  await L.shot(page, `${dev}-flow-08-homecoming`, true);
  await L.tap(page, '[data-fk="totown"]');
  await page.waitForSelector('[data-fk="tab:stash"]');
  step('town', await page.evaluate(() => [...document.querySelectorAll('.tab')].map((t) => t.textContent).join(',')));

  // Four more (stub) runs open every tab.
  await page.goto(L.BASE + '/?stubrun=1');
  for (let i = 0; i < 4; i++) {
    await L.tap(page, '[data-fk="headout"]');
    await L.tap(page, '[data-fk="stub:early"]');
    await L.tap(page, '[data-fk="totown"]', { wait: 600 });
  }
  await page.goto(L.BASE + '/');
  await page.waitForSelector('[data-fk="tab:stash"]');
  await page.waitForTimeout(500);
  const tabs = await page.evaluate(() => [...document.querySelectorAll('.tab')].map((t) => t.dataset.fk));
  step('tabs open', tabs.join(' '));
  for (const t of tabs) {
    await L.tap(page, `[data-fk="${t}"]`, { wait: 700 });
    await L.shot(page, `${dev}-flow-09-${t.replace(':', '-')}`, true);
    out[t] = await page.evaluate(() => document.querySelector('.tab-body')?.innerText.length);
  }
  await page.context().storageState({ path: L.OUT + `/state-${dev}.json` });
  out.errors = log.errors; out.failed = log.failed;
  step('console errors', String(log.errors.length) + ' ' + log.errors.slice(0, 5).join(' | '));
  step('failed requests', String(log.failed.length) + ' ' + log.failed.slice(0, 5).join(' | '));
  fs.writeFileSync(L.OUT + `/${L.TAG}-flow-${dev}.json`, JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(`[${dev}] FAILED`, e); process.exit(1); });
