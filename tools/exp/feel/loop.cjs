// Death to the next run in the real app (built client served by the game server), by keyboard or by touch.
//   node tools/exp/feel/loop.cjs <base url> <tag> [desk|phone|land]
// A fresh context is a new device. The player starts the run and then stands still: benches are
// passed with the fewest presses, and the run ends in wave 2 or 3. Then: how long from the killing
// blow to a focused "Go again", how many presses that took, how long to the next run, what the
// second run teaches, and what the second recap says about the best.
// Works on the tree before this branch too (two recap screens), for the comparison.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:8851';
const TAG = process.argv[3] || 'after';
const DEV = process.argv[4] || 'desk';
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/feel';
const DSF = Number(process.env.DSF || 1);
const VP = { desk: { width: 1280, height: 720 }, phone: { width: 360, height: 640 }, land: { width: 640, height: 360 } }[DEV];
const touch = DEV !== 'desk';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: DSF, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (name, full = false) => page.screenshot({ path: `${OUT}/${TAG}-loop-${DEV}-${name}.png`, fullPage: full });
  const press = async (sel, key) => { if (touch) { const b = await page.$(sel); if (b) { const r = await b.boundingBox(); if (r) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); } } else await page.keyboard.press(key); };
  const out = { tag: TAG, device: DEV };

  await page.goto(BASE + '/');
  await page.waitForSelector('[data-fk="headout"]');
  await press('[data-fk="headout"]', 'd');
  await page.waitForSelector('canvas.g-canvas');
  await sleep(500);
  await shot('run1-start');

  // One idle run. Returns when the next screen with a way on is up.
  async function idleRun(n) {
    const t0 = Date.now();
    let tDead = 0, presses = 0, cardShot = false;
    for (;;) {
      const st = await page.evaluate(() => {
        const vis = (s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0; };
        const hp = document.querySelector('.g-tl .hp .num');
        return { bench: vis('.g-bench'), end: vis('.g-end'), again: vis('[data-fk="again"]'), focus: document.activeElement?.dataset?.fk || '', hp: hp ? hp.textContent : '', card: document.querySelector('.g-card-title')?.textContent || '' };
      });
      if (!tDead && /^0\//.test(st.hp)) tDead = Date.now();
      if (tDead && !cardShot && Date.now() - tDead > 500 && !st.again && !st.end) { cardShot = true; await shot(`run${n}-death-beat`); out[`deathCard${n}`] = st.card; }
      if (st.again) { if (!tDead) tDead = Date.now(); return { tDead, presses, seconds: (tDead - t0) / 1000 }; }
      if (st.end) {
        if (!tDead) tDead = Date.now();
        await sleep(250); await shot(`run${n}-end-screen`);
        await press('[data-fk="go"]', 'Enter'); presses++;
        await sleep(150);
      } else if (st.bench) {
        await sleep(300);
        if (touch) { await press('[data-fk="pick0"]', '1'); await sleep(200); await press('[data-fk="next"]', 'Enter'); }
        else { await page.keyboard.press('1'); await sleep(120); await page.keyboard.press('Enter'); }
        await sleep(300);
      }
      if (Date.now() - t0 > 240000) throw new Error('the idle player did not die');
      await sleep(40);
    }
  }

  for (const n of [1, 2]) {
    const r = await idleRun(n);
    const tAgain = Date.now();
    await page.waitForFunction(() => document.activeElement?.dataset?.fk === 'again', null, { timeout: 15000 });
    out[`run${n}`] = { ranSeconds: +r.seconds.toFixed(1), deathToGoAgainMs: Date.now() - r.tDead, pressesBeforeGoAgain: r.presses, detectLagMs: tAgain - r.tDead };
    await sleep(900); // let the report land so the sheet is whole
    await shot(`run${n}-recap`);
    await shot(`run${n}-recap-full`, true);
    out[`recap${n}`] = (await page.evaluate(() => document.querySelector('main, #app, body').innerText)).replace(/\n+/g, ' | ').slice(0, 900);
    out[`recap${n}Overflow`] = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    out[`recap${n}Stamp`] = await page.evaluate(() => { const b = document.querySelector('[data-fk="again"]').getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), inView: b.bottom <= innerHeight }; });
    if (n === 2) break;
    const t1 = Date.now();
    await press('[data-fk="again"]', 'Enter');
    await page.waitForSelector('canvas.g-canvas');
    out.goAgainToRunMs = Date.now() - t1;
    await sleep(700);
    await shot('run2-start');
    out.run2Teach = await page.evaluate(() => { const t = document.querySelector('.g-teach'); return t && !t.hidden ? t.textContent : ''; });
  }
  out.errors = errors;
  fs.writeFileSync(`${OUT}/${TAG}-loop-${DEV}.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(String(e)); process.exit(1); });
