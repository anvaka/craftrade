// One real action per town screen, by touch, against the real server (seeded account).
//   node tools/exp/mobile/townacts.cjs [device]
const L = require('./lib.cjs');
const dev = process.argv[2] || 'se';
(async () => {
  const browser = await L.chromium.launch();
  const s = await L.open(browser, dev, { storageState: process.env.STATE || L.OUT + '/state-pixel7.json' });
  const { page } = s; const out = {};
  const head = () => page.evaluate(() => document.querySelector('.page-head .counters')?.textContent);
  const note = () => page.evaluate(() => document.querySelector('.notices')?.textContent || '');
  await page.goto(L.BASE + '/'); await page.waitForSelector('[data-fk="tab:stash"]');
  // workshop: a real fusion
  await L.tap(page, '[data-fk="tab:workshop"]', { wait: 600 });
  await L.tap(page, page.locator('[data-fk^="put:"]').nth(0)); await L.tap(page, page.locator('[data-fk^="put:"]').nth(1));
  await L.tap(page, '[data-fk="strike"]');
  await page.waitForTimeout(4000);
  out.workshopFuse = await page.evaluate(() => (document.querySelector('.outcome, .find-stamp')?.textContent || document.querySelector('.notices')?.textContent || '').slice(0, 120));
  await L.shot(page, `${dev}-townacts-fuse`);
  // market: sell ten timber
  await L.tap(page, '[data-fk="tab:market"]', { wait: 600 });
  const h0 = await head();
  await L.tap(page, '[data-fk="sell:timber"]', { wait: 800 });
  out.marketSell = `${h0} -> ${await head()} ${await note()}`;
  // stepper by touch, then type in the field (checks no zoom on focus)
  await L.tap(page, '[data-fk="q:ore:+"]'); await L.tap(page, '[data-fk="q:ore:+"]');
  await L.tap(page, '[data-fk="q:ore:n"]');
  out.afterFocus = await page.evaluate(() => ({ zoom: visualViewport.scale, value: document.activeElement.value, fontPx: getComputedStyle(document.activeElement).fontSize, inputs16: [...document.querySelectorAll('input:not([type=range])')].every((i) => parseFloat(getComputedStyle(i).fontSize) >= 16) }));
  // town: give to the project
  await L.tap(page, '[data-fk="tab:town"]', { wait: 600 });
  if (await page.locator('[data-fk="give:timber:+"]').count()) {
    await L.tap(page, '[data-fk="give:timber:+"]'); const g0 = await head();
    await L.tap(page, '[data-fk="give"]', { wait: 800 });
    out.townGive = `${g0} -> ${await head()} ${await note()}`;
  } else out.townGive = 'no project row: ' + (await page.evaluate(() => document.querySelector('.tab-body').innerText.slice(0, 80)));
  // daily: practice starts a run
  await L.tap(page, '[data-fk="tab:daily"]', { wait: 600 });
  await L.tap(page, '[data-fk="daily:practice"]');
  out.dailyPracticeStarts = await page.waitForSelector('.g-hud', { timeout: 8000 }).then(() => true, () => false);
  // quit from the pause panel by touch
  await L.tap(page, '.g-snd button'); await L.shot(page, `${dev}-townacts-pause`);
  await L.tap(page, page.locator('.g-pause button', { hasText: 'Quit' })); await L.tap(page, page.locator('.g-pause button', { hasText: 'Sure?' }));
  await page.waitForSelector('.g-end'); await L.tap(page, '[data-fk="go"]');
  await page.waitForSelector('[data-fk="tab:stash"]', { timeout: 8000 });
  out.quitBackInTown = await note();
  out.errors = s.log.errors; out.failed = s.log.failed;
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
