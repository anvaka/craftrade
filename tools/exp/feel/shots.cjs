// Before/after stills and short frame sequences of the run, from play.html on a Vite dev server.
//   node tools/exp/feel/shots.cjs <base url> <tag> [scene ...]
//   BASE e.g. http://localhost:8841, tag "before" or "after". DSF=2 for the listed stills (default 1).
// Output: $OUT (default: the session scratchpad feel/ folder) /<tag>-<scene>[-n].png
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:8841';
const TAG = process.argv[3] || 'after';
const ONLY = process.argv.slice(4);
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/feel';
const DSF = Number(process.env.DSF || 1);
fs.mkdirSync(OUT, { recursive: true });

const DESK = { width: 1280, height: 720 };
const PHONE = { width: 360, height: 640 };
const LAND = { width: 640, height: 360 };

async function open(browser, q, vp, touch = false, init = null) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: DSF, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  if (init) await page.addInitScript(init);
  await page.goto(`${BASE}/play.html?${q}`);
  await page.waitForFunction(() => window.__ready);
  return { ctx, page, errors };
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
const waitFor = (page, fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout, polling: 50 });

const scenes = {
  // A crowd with the player somewhere in it.
  async crowd(b) {
    const { ctx, page, errors } = await open(b, 'wave=8&bot=1&god=1&seed=7', DESK);
    await page.waitForTimeout(24000);
    await shot(page, 'crowd-wave8');
    await ctx.close(); return errors;
  },
  async spit(b) {
    const { ctx, page, errors } = await open(b, 'wave=7&bot=1&god=1&seed=7', DESK);
    await waitFor(page, () => window.__run.eshots.filter((s) => s.alive).length >= 5);
    await shot(page, 'spit-wave7');
    await ctx.close(); return errors;
  },
  async tusk(b) {
    const { ctx, page, errors } = await open(b, 'wave=12&bot=1&god=1&seed=7', DESK);
    await page.waitForTimeout(40000);
    await shot(page, 'tusk-wave12');
    await ctx.close(); return errors;
  },
  // Many telegraphs at once: wait for a dozen lanes and rings in view of a late wave.
  async tells(b) {
    const { ctx, page, errors } = await open(b, 'wave=11&bot=1&god=1&seed=7', DESK);
    const count = () => page.evaluate(() => { const r = window.__run; let n = 0; for (const e of r.enemies) if (e.alive && (e.state === 2 || e.state === 3) && (e.type === 2 || e.type === 7 || e.type === 9)) n++; for (const h of r.hazards) if (h.alive && h.kind === 0) n++; return n; });
    let best = 0;
    for (let i = 0; i < 500; i++) { const n = await count(); if (n > best) best = n; if (n >= 9 && i > 60) break; await page.waitForTimeout(100); }
    await shot(page, 'tells-wave11');
    console.log(`  lanes and rings live at the shot: ${await count()} (most seen ${best})`);
    await ctx.close(); return errors;
  },
  async phone(b) {
    const { ctx, page, errors } = await open(b, 'wave=9&bot=1&god=1&seed=7', PHONE, true);
    await page.waitForTimeout(22000);
    await shot(page, 'phone-wave9');
    await ctx.close(); return errors;
  },
  // The player walked into the top-left corner, under the HUD, on a phone.
  async phonecorner(b) {
    const { ctx, page, errors } = await open(b, 'wave=3&god=1&seed=7', PHONE, true);
    await page.evaluate(() => { const p = window.__run.player; p.x = p.px = 60; p.y = p.py = 60; });
    await page.waitForTimeout(1500);
    await shot(page, 'phone-corner');
    await ctx.close(); return errors;
  },
  async corner(b) {
    const { ctx, page, errors } = await open(b, 'wave=3&god=1&seed=7', DESK);
    await page.evaluate(() => { const p = window.__run.player; p.x = p.px = 60; p.y = p.py = 60; });
    await page.waitForTimeout(1500);
    await shot(page, 'desk-corner');
    await ctx.close(); return errors;
  },
  async land(b) {
    const { ctx, page, errors } = await open(b, 'wave=9&bot=1&god=1&seed=7', LAND, true);
    await page.waitForTimeout(22000);
    await shot(page, 'land-wave9');
    await ctx.close(); return errors;
  },
  // Level-up: frames around the moment the level changes.
  async levelup(b) {
    const { ctx, page, errors } = await open(b, 'bot=1&god=1&seed=5&slow=5', DESK);
    await waitFor(page, () => window.__run.player.level >= 2);
    for (let i = 0; i < 8; i++) { await shot(page, `levelup-${i}`); await page.waitForTimeout(140); }
    await ctx.close(); return errors;
  },
  // Wave clear: frames across the end of wave 1 and into the bench.
  async waveclear(b) {
    const { ctx, page, errors } = await open(b, 'bot=1&god=1&seed=5', DESK);
    await waitFor(page, () => window.__run.waveSeconds - window.__run.waveTime < 0.4 || window.__run.phase !== 'wave');
    for (let i = 0; i < 9; i++) { await shot(page, `waveclear-${i}`); await page.waitForTimeout(160); }
    await ctx.close(); return errors;
  },
  // Being hurt, and low health.
  async hurt(b) {
    const { ctx, page, errors } = await open(b, 'wave=2&seed=3&slow=4', DESK);
    await page.evaluate(() => { window.__hp0 = window.__run.player.hp; });
    await waitFor(page, () => window.__run.player.hp < window.__hp0);
    for (let i = 0; i < 4; i++) { await shot(page, `hurt-${i}`); await page.waitForTimeout(120); }
    await waitFor(page, () => window.__run.player.hp / window.__run.player.maxHp <= 0.3 || window.__run.phase === 'over');
    await page.waitForTimeout(400);
    await shot(page, 'lowhp');
    await ctx.close(); return errors;
  },
  async elite(b) {
    const { ctx, page, errors } = await open(b, 'wave=6&bot=1&god=1&seed=7', DESK);
    await waitFor(page, () => window.__run.eliteIdx >= 0);
    await page.waitForTimeout(500);
    await shot(page, 'elite-arrival');
    await ctx.close(); return errors;
  },
  async boss(b) {
    const { ctx, page, errors } = await open(b, 'wave=12&bot=1&god=1&seed=7', DESK);
    await waitFor(page, () => window.__run.eliteIdx >= 0);
    await page.waitForTimeout(500);
    await shot(page, 'boss-arrival');
    await ctx.close(); return errors;
  },
  // First run: the opening frame, after moving, the first node.
  async first(b) {
    const { ctx, page, errors } = await open(b, 'first=1&seed=3', DESK, false, () => { try { localStorage.clear(); } catch {} });
    await page.waitForTimeout(700);
    await shot(page, 'first-0-open');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(1100);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(250);
    await shot(page, 'first-1-moved');
    await ctx.close(); return errors;
  },
  // Do nothing: die, and show what comes up.
  async death(b) {
    const { ctx, page, errors } = await open(b, 'seed=3&first=1', DESK, false, () => { try { localStorage.clear(); } catch {} });
    await page.keyboard.press('KeyD');
    const t0 = Date.now();
    // Stand still; pass each bench with the fewest presses.
    for (let i = 0; i < 1200; i++) {
      const st = await page.evaluate(() => ({ over: window.__run.phase === 'over', bench: window.__run.phase === 'bench' && !document.querySelector('.g-bench').hidden }));
      if (st.over) break;
      if (st.bench) { await page.keyboard.press('1'); await page.waitForTimeout(120); await page.keyboard.press('Enter'); }
      await page.waitForTimeout(60);
    }
    const tDead = Date.now();
    await shot(page, 'death-0');
    await page.waitForTimeout(500);
    await shot(page, 'death-1');
    await waitFor(page, () => !!document.querySelector('.g-end') || !!window.__recap, null, 20000);
    const tEnd = Date.now();
    await page.waitForTimeout(300);
    await shot(page, 'death-2-screen');
    console.log(`  died after ${((tDead - t0) / 1000).toFixed(1)} s, death to next screen ${tEnd - tDead} ms`);
    await ctx.close(); return errors;
  },
  async bench(b) {
    const { ctx, page, errors } = await open(b, 'bench=1&seed=3&first=1', DESK, false, () => { try { localStorage.clear(); } catch {} });
    await page.waitForTimeout(600);
    await shot(page, 'bench-1');
    await ctx.close(); return errors;
  },
  async phonebench(b) {
    const { ctx, page, errors } = await open(b, 'bench=1&seed=3&first=1', PHONE, true, () => { try { localStorage.clear(); } catch {} });
    await page.waitForTimeout(600);
    await shot(page, 'phone-bench-1');
    await ctx.close(); return errors;
  },
};

(async () => {
  const browser = await chromium.launch();
  for (const [name, fn] of Object.entries(scenes)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const t = Date.now();
    try {
      const errors = await fn(browser);
      console.log(`${TAG} ${name}: ${((Date.now() - t) / 1000).toFixed(1)} s${errors.length ? `, console errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
    } catch (e) {
      console.log(`${TAG} ${name}: FAILED ${String(e).split('\n')[0]}`);
    }
  }
  await browser.close();
})();
