// Experiment 5: slow network, offline mid-run, refresh mid-run. Production build on the real server.
//   node tools/exp/mobile/network.cjs
const L = require('./lib.cjs');
const fs = require('fs');
const SLOW3G = { offline: false, downloadThroughput: (500 * 1024) / 8 * 0.8, uploadThroughput: (500 * 1024) / 8 * 0.8, latency: 2000 }; // DevTools "Slow 3G"
const FAST3G = { offline: false, downloadThroughput: (1.6 * 1024 * 1024) / 8 * 0.9, uploadThroughput: (750 * 1024) / 8 * 0.9, latency: 562.5 };

async function load(browser, name, cond) {
  const s = await L.open(browser, 'pixel7');
  await s.cdp.send('Network.enable');
  if (cond) await s.cdp.send('Network.emulateNetworkConditions', cond);
  let bytes = 0, n = 0; const by = {};
  const urls = new Map();
  s.cdp.on('Network.responseReceived', (e) => urls.set(e.requestId, { url: e.response.url.replace(L.BASE, ''), enc: e.response.headers['content-encoding'] || e.response.headers['Content-Encoding'] || 'none' }));
  s.cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; n++; const u = urls.get(e.requestId); if (u) by[u.url] = `${e.encodedDataLength} B (${u.enc})`; });
  const t0 = Date.now();
  await s.page.goto(L.BASE + '/', { waitUntil: 'commit', timeout: 120000 });
  await s.page.waitForFunction(() => document.querySelector('h1'), null, { timeout: 120000 });
  const firstPaint = Date.now() - t0;
  await s.page.waitForSelector('[data-fk="headout"]', { timeout: 120000 });
  const interactive = Date.now() - t0;
  const onlineLine = await s.page.evaluate(() => document.querySelector('.notices')?.textContent || '');
  await L.tap(s.page, '[data-fk="headout"]');
  await s.page.waitForSelector('.g-hud', { timeout: 120000 });
  const inRun = Date.now() - t0;
  await s.page.waitForTimeout(1500);
  const out = { name, shellVisibleMs: firstPaint, headOutReadyMs: interactive, tapToRunMs: inRun - interactive, noticeAtBoot: onlineLine.slice(0, 90), requests: n, transferKB: +(bytes / 1024).toFixed(1), files: by, errors: s.log.errors, failed: s.log.failed };
  await s.ctx.close();
  return out;
}

(async () => {
  const browser = await L.chromium.launch();
  const out = {};
  if (process.env.ONLY === 'offline') { out.skip = true; } else {
  out.unthrottled = await load(browser, 'unthrottled', null);
  out.fast3g = await load(browser, 'fast 3G', FAST3G);
  out.slow3g = await load(browser, 'slow 3G', SLOW3G);
  for (const k of ['unthrottled', 'fast3g', 'slow3g']) { const r = out[k]; console.log(`${r.name.padEnd(12)} shell ${r.shellVisibleMs} ms | Head out ready ${r.headOutReadyMs} ms | tap to run ${r.tapToRunMs} ms | ${r.requests} requests, ${r.transferKB} KB | notice: "${r.noticeAtBoot}" | errors ${r.errors.length}`); }
  console.log(out.unthrottled.files);
  }

  // ---- server unreachable mid-run ----
  let s = await L.open(browser, 'pixel7', { storageState: process.env.STATE || L.OUT + '/state-pixel7.json' });
  const { page, cdp, ctx } = s;
  const W = 412, H = 915;
  await page.goto(L.BASE + '/'); await page.waitForSelector('[data-fk="tab:stash"]'); await L.tap(page, '[data-fk="tab:stash"]');
  await L.tap(page, '[data-fk="headout"]'); await page.waitForSelector('.g-hud');
  await ctx.setOffline(true);
  const off = { };
  // play the wave with touch, then the bench
  await L.touch(cdp, 'touchStart', [{ x: W / 2, y: H * 0.7 }]);
  let a = 0;
  while (!(await page.evaluate(() => { const b = document.querySelector('.g-bench'); const e = document.querySelector('.g-end'); return (b && !b.hidden) || !!e; }))) { a += 0.02; await L.touch(cdp, 'touchMove', [{ x: W / 2 + Math.cos(a) * 60, y: H * 0.7 + Math.sin(a) * 60 }]); await page.waitForTimeout(40); }
  await L.touch(cdp, 'touchEnd', []);
  off.waveSurvivedOffline = await page.evaluate(() => !document.querySelector('.g-end'));
  if (off.waveSurvivedOffline) {
    for (let i = 0; i < 6 && await page.locator('.g-bench [data-fk="pick0"]').count(); i++) await L.tap(page, '.g-bench [data-fk="pick0"]');
    const picks = page.locator('.g-anvil-picks button');
    if (await picks.count() >= 2) {
      await L.tap(page, picks.nth(0)); await L.tap(page, page.locator('.g-anvil-picks button').nth(1));
      const st = page.locator('.g-bench [data-fk="strike"]:not([aria-disabled="true"])');
      if (await st.count()) { await L.tap(page, st); await page.waitForTimeout(9000); off.fuseOffline = await page.evaluate(() => document.querySelector('.g-reason .text')?.textContent); await L.shot(page, 'net-fuse-offline'); }
    } else off.fuseOffline = 'not enough items to try (kit of ' + (await picks.count()) + ')';
    await L.tap(page, '.g-bench [data-fk="next"]');
  }
  // die: stand still
  await page.waitForFunction(() => !!document.querySelector('.g-end') || (!document.querySelector('.g-bench').hidden && (document.querySelector('.g-bench [data-fk="next"]')?.click(), false)), null, { timeout: 240000, polling: 1000 });
  await L.tap(page, '[data-fk="go"]');
  await page.waitForSelector('[data-fk="totown"]');
  const sheet = () => page.evaluate(() => { const t = document.querySelector('#town'); return { notices: [...t.querySelectorAll('.notice')].map((n) => n.textContent).join(' | '), firstLines: t.innerText.replace(/\n+/g, ' / ').slice(0, 260) }; });
  await page.waitForTimeout(1500);
  off.homecomingAt1s = await sheet();
  await page.waitForTimeout(2500);
  await ctx.setOffline(false);
  await page.waitForTimeout(9000);
  off.reconnectedAt4s = await sheet();
  await L.shot(page, 'net-homecoming-reconnected', true);
  const retry = page.locator('#town button', { hasText: /again|Send|Try/ });
  off.buttons = await page.evaluate(() => [...document.querySelectorAll('#town button')].map((b) => b.textContent).join(', '));
  off.errors = s.log.errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
  out.serverGoneMidRun = off;
  console.log('server gone mid-run', off);
  await ctx.close();

  // ---- refresh mid-run ----
  s = await L.open(browser, 'pixel7', { storageState: process.env.STATE || L.OUT + '/state-pixel7.json' });
  await s.page.goto(L.BASE + '/'); await s.page.waitForSelector('[data-fk="tab:stash"]'); await L.tap(s.page, '[data-fk="tab:stash"]');
  const before = await s.page.evaluate(() => document.querySelector('.page-head .counters')?.textContent);
  await L.tap(s.page, '[data-fk="headout"]'); await s.page.waitForSelector('.g-hud'); await s.page.waitForTimeout(4000);
  await s.page.reload(); await s.page.waitForSelector('[data-fk="tab:stash"]'); await s.page.waitForTimeout(1500);
  const rf = { landsOn: await s.page.evaluate(() => document.querySelector('.g-hud') ? 'the run' : 'town'), notice: await s.page.evaluate(() => document.querySelector('.notices')?.textContent || '(none)'),
    holdingsSame: before === await s.page.evaluate(() => document.querySelector('.page-head .counters')?.textContent) };
  await L.tap(s.page, '[data-fk="tab:stash"]'); await L.tap(s.page, '[data-fk="headout"]');
  rf.canHeadOutAgain = await s.page.waitForSelector('.g-hud', { timeout: 8000 }).then(() => true, () => false);
  rf.noticeIfNot = rf.canHeadOutAgain ? '' : await s.page.evaluate(() => document.querySelector('.notices')?.textContent);
  rf.errors = s.log.errors; rf.failed = s.log.failed;
  out.refreshMidRun = rf;
  console.log('refresh mid-run', rf);
  fs.writeFileSync(`${L.OUT}/${L.TAG}-network.json`, JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
