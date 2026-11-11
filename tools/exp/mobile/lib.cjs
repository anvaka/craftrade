// Shared helpers for the mobile experiments. Chromium only: WebKit is not installed here.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE || 'http://localhost:8801';
const HARNESS = process.env.HARNESS || 'http://localhost:8802';
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/mobile';
const TAG = process.env.TAG || 'before';
fs.mkdirSync(OUT, { recursive: true });

const UA_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DEVICES = {
  'se':        { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, userAgent: UA_IOS },
  'iphone14':  { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, userAgent: UA_IOS },
  'pixel7':    { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, userAgent: UA_AND },
  'android360':{ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, userAgent: UA_AND },
  'se-land':   { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, userAgent: UA_IOS },
  'iphone14-land': { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, userAgent: UA_IOS },
  'pixel7-land':   { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, userAgent: UA_AND },
  'ipad':      { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, userAgent: UA_IOS.replace('iPhone; CPU iPhone OS', 'iPad; CPU OS') },
};

async function open(browser, dev, opts = {}) {
  const d = DEVICES[dev];
  if (!d) throw new Error('unknown device ' + dev);
  const ctx = await browser.newContext({ ...d, hasTouch: true, isMobile: true, ...opts });
  const page = await ctx.newPage();
  const log = { errors: [], failed: [], requests: 0 };
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); });
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => log.failed.push(r.method() + ' ' + r.url() + ' ' + (r.failure() || {}).errorText));
  page.on('response', (r) => { log.requests++; if (r.status() >= 400) log.failed.push(r.status() + ' ' + r.request().method() + ' ' + r.url()); });
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, log, cdp, dev, d };
}

/** Real touch tap on the centre of an element (scrolls it into view first). */
async function tap(page, sel, opt = {}) {
  const loc = typeof sel === 'string' ? page.locator(sel).first() : sel;
  await loc.waitFor({ state: 'visible', timeout: opt.timeout || 8000 });
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error('no box for ' + sel);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(opt.wait == null ? 150 : opt.wait);
}

/** A raw multi-step touch through CDP. points: [{x,y,id}] */
async function touch(cdp, type, points) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id || 0, radiusX: 10, radiusY: 10, force: 1 })) });
}
async function drag(cdp, page, x0, y0, x1, y1, ms = 400, hold = 0, id = 0) {
  await touch(cdp, 'touchStart', [{ x: x0, y: y0, id }]);
  const n = Math.max(4, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) { await touch(cdp, 'touchMove', [{ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n, id }]); await page.waitForTimeout(16); }
  if (hold) await page.waitForTimeout(hold);
}
const shot = (page, name, full = false) => page.screenshot({ path: path.join(OUT, `${TAG}-${name}.png`), fullPage: full });
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : NaN; };

module.exports = { chromium, BASE, HARNESS, OUT, TAG, DEVICES, open, tap, touch, drag, shot, pct };
