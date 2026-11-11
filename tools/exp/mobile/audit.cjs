// Experiment 2: layout audit of every screen on every device.
//   node tools/exp/mobile/audit.cjs [device ...]     (TAG=before|after; STATE=storage state of a seeded account)
// Prints a table of offender counts and writes <TAG>-audit.json with the full lists.
const L = require('./lib.cjs');
const fs = require('fs');
const measure = fs.readFileSync(__dirname + '/measure.js', 'utf8');
const STATE = process.env.STATE || L.OUT + '/state-pixel7.json';
const INSETS = {
  'iphone14': { top: 47, bottom: 34, left: 0, right: 0 },
  'iphone14-land': { top: 0, bottom: 21, left: 47, right: 47 },
  'ipad': { top: 0, bottom: 20, left: 0, right: 0 },
};
const devices = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(L.DEVICES);
const CATS = ['overflowX', 'offscreen', 'spill', 'smallText', 'smallTargets', 'closeTargets', 'clipped', 'unsafe', 'hudOverlap'];

(async () => {
  const browser = await L.chromium.launch();
  const all = {};
  for (const dev of devices) {
    const ins = INSETS[dev] || { top: 0, bottom: 0, left: 0, right: 0 };
    const res = all[dev] = {};
    const mk = async (state) => {
      const s = await L.open(browser, dev, state ? { storageState: STATE } : {});
      await s.cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: ins }).catch(() => {});
      return s;
    };
    const take = async (s, name) => {
      await s.page.waitForTimeout(250);
      const m = await s.page.evaluate(`(${measure})(${JSON.stringify(ins)})`);
      m.hudOverlap = m.hud ? m.hud.overlaps : [];
      // Again at the end of the scroll: the last row has to clear the home indicator.
      await s.page.evaluate(() => { window.scrollTo(0, 1e6); for (const e of document.querySelectorAll('.g-bench, .g-end')) e.scrollTop = 1e6; });
      const end = await s.page.evaluate(`(${measure})(${JSON.stringify(ins)}, ' (scrolled to end)')`);
      m.unsafe = [...new Set([...m.unsafe, ...end.unsafe])];
      await s.page.evaluate(() => { window.scrollTo(0, 0); for (const e of document.querySelectorAll('.g-bench, .g-end')) e.scrollTop = 0; });
      m.errors = s.log.errors.slice();
      res[name] = m;
      await L.shot(s.page, `${dev}-${name}`);
    };
    const harness = async (q, wait = 600) => {
      const s = await mk(false);
      await s.page.goto(`${L.HARNESS}/play.html?${q}`);
      await s.page.waitForFunction(() => window.__ready);
      await s.page.waitForTimeout(wait);
      return s;
    };
    try {
      // ---- town ----
      let s = await mk(false);
      await s.page.goto(L.BASE + '/'); await s.page.waitForSelector('[data-fk="headout"]');
      await take(s, 'town-first'); await s.ctx.close();
      s = await mk(true);
      await s.page.goto(L.BASE + '/'); await s.page.waitForSelector('[data-fk="tab:stash"]');
      for (const t of ['stash', 'workshop', 'market', 'town', 'daily']) {
        await L.tap(s.page, `[data-fk="tab:${t}"]`, { wait: 700 });
        await s.page.evaluate(() => window.scrollTo(0, 0));
        await take(s, `town-${t}`);
        if (t === 'workshop') { // put two on the anvil so the quote row is measured too
          const puts = s.page.locator('[data-fk^="put:"]');
          if (await puts.count() >= 2) { await L.tap(s.page, puts.nth(0)); await L.tap(s.page, s.page.locator('[data-fk^="put:"]').nth(1)); await s.page.evaluate(() => window.scrollTo(0, 0)); await take(s, 'town-workshop-anvil'); }
        }
        if (t === 'market') {
          const post = s.page.locator('[data-fk^="post:seed"]');
          if (await post.count()) { await L.tap(s.page, post.nth(0)); await take(s, 'town-market-post'); const c = s.page.locator('[data-fk="post:cancel"]'); if (await c.count()) await L.tap(s.page, c); }
        }
      }
      await s.ctx.close();
      s = await mk(true);
      await s.page.goto(L.BASE + '/?stubrun=1'); await s.page.waitForSelector('[data-fk="tab:stash"]');
      await L.tap(s.page, '[data-fk="tab:stash"]'); await L.tap(s.page, '[data-fk="headout"]'); await L.tap(s.page, '[data-fk="stub:late"]');
      await s.page.waitForSelector('[data-fk="totown"]'); await s.page.waitForTimeout(900);
      s.log.errors.length = 0; // the stub's instant "late death" is refused by the server on purpose
      await take(s, 'homecoming'); await s.ctx.close();

      // ---- run ----
      s = await harness('first=1&seed=2'); await take(s, 'run-first'); await s.ctx.close();
      s = await harness('wave=12&god=1&bot=1&seed=3', 5000);
      const { width: W, height: H } = s.d.viewport;
      await L.touch(s.cdp, 'touchStart', [{ x: W * 0.3, y: H * 0.7 }]); await L.touch(s.cdp, 'touchMove', [{ x: W * 0.3 + 30, y: H * 0.7 - 30 }]);
      await take(s, 'run-boss');
      await L.touch(s.cdp, 'touchEnd', []);
      await L.tap(s.page, '.g-snd button'); await take(s, 'run-pause'); await s.ctx.close();
      s = await harness('bench=6&seed=3'); await take(s, 'bench');
      const picks = s.page.locator('.g-anvil-picks button');
      if (await picks.count() >= 2) {
        await L.tap(s.page, picks.nth(0)); await L.tap(s.page, s.page.locator('.g-anvil-picks button').nth(1));
        await s.page.locator('.g-anvil').scrollIntoViewIfNeeded(); await take(s, 'bench-anvil');
        const st = s.page.locator('.g-bench [data-fk="strike"]:not([aria-disabled="true"])');
        if (await st.count()) { await L.tap(s.page, st); await s.page.waitForSelector('[data-fk="reveal-done"]', { timeout: 8000 }); await take(s, 'bench-reveal'); }
      }
      await s.ctx.close();
      s = await harness('wave=9&seed=3');
      await s.page.evaluate(() => { const r = window.__run; r.player.hp = 0.01; r.player.shield = 0; });
      await s.page.waitForFunction(() => { const e = document.querySelector('.g-end'); return e && !e.hidden; }, null, { timeout: 60000 });
      if (await s.page.locator('[data-fk="carry0"]').count()) await L.tap(s.page, '[data-fk="carry0"]');
      await s.page.evaluate(() => { document.querySelector('.g-end').scrollTop = 0; });
      await take(s, 'run-end'); await s.ctx.close();
    } catch (e) { res.__failed = String(e.message || e).split('\n')[0]; console.error(dev, 'FAILED', e.message); }
    // ---- table ----
    console.log(`\n== ${dev} ${L.DEVICES[dev].viewport.width}x${L.DEVICES[dev].viewport.height} ==`);
    console.log('screen'.padEnd(22) + CATS.map((c) => c.slice(0, 9).padStart(10)).join('') + '  verdict');
    for (const [name, m] of Object.entries(res)) {
      if (name === '__failed') continue;
      const n = CATS.map((c) => (c === 'overflowX' ? Math.max(0, m.overflowX) : m[c].length));
      const hard = n[0] + n[1] + n[2] + n[3] + n[6] + n[7] + n[8] + m.errors.length;
      console.log(name.padEnd(22) + n.map((v) => String(v).padStart(10)).join('') + '  ' + (hard ? 'FAIL' : n[4] + n[5] ? 'pass, small targets' : 'pass'));
    }
  }
  fs.writeFileSync(`${L.OUT}/${L.TAG}-audit${process.argv[2] ? '-' + devices.join('+') : ''}.json`, JSON.stringify(all, null, 1));
  await browser.close();
})();
