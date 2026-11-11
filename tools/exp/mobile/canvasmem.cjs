// iOS Safari caps total canvas backing store (about 256 MB on older phones, 384 MB on newer) and is slow to free it.
// Count what the game allocates: canvases created, and bytes if every one were alive at once.
//   node tools/exp/mobile/canvasmem.cjs
const L = require('./lib.cjs');
(async () => {
  const browser = await L.chromium.launch();
  const s = await L.open(browser, 'iphone14', { storageState: process.env.STATE || L.OUT + '/state-pixel7.json' });
  await s.page.addInitScript(() => {
    const all = window.__cv = [];
    const ce = document.createElement.bind(document);
    document.createElement = function (tag, o) { const e = ce(tag, o); if (String(tag).toLowerCase() === 'canvas') all.push(new WeakRef(e)); return e; };
    window.__cvStat = () => { let live = 0, px = 0, inDom = 0, domPx = 0; for (const r of all) { const c = r.deref(); if (!c) continue; live++; px += c.width * c.height; if (c.isConnected) { inDom++; domPx += c.width * c.height; } }
      return { created: all.length, notYetCollected: live, notCollectedMB: +(px * 4 / 1048576).toFixed(1), inDom, inDomMB: +(domPx * 4 / 1048576).toFixed(1) }; };
  });
  const stat = async (label) => { const r = await s.page.evaluate(() => window.__cvStat()); console.log(label.padEnd(34), JSON.stringify(r)); return r; };
  await s.page.goto(L.BASE + '/'); await s.page.waitForSelector('[data-fk="tab:stash"]'); await s.page.waitForTimeout(800);
  await stat('boot, town open');
  for (let i = 0; i < 4; i++) for (const t of ['workshop', 'market', 'town', 'daily', 'stash']) await L.tap(s.page, `[data-fk="tab:${t}"]`, { wait: 250 });
  await stat('after 20 tab changes');
  await L.tap(s.page, '[data-fk="headout"]'); await s.page.waitForSelector('.g-hud'); await s.page.waitForTimeout(6000);
  await stat('6 s into a run');
  await s.cdp.send('HeapProfiler.collectGarbage'); await s.page.waitForTimeout(500);
  await stat('same, after a forced collection');
  await browser.close();
})();
