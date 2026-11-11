// The real app (built client served by the game server): page load to control, and death to the next run.
//   node tools/exp/fun/loop.cjs <shotDir> [base=http://localhost:8803]
// A fresh browser context is a new device. The "player" presses D once to start, then stands still until dead.
const { chromium } = require('playwright');
const fs = require('fs');
const dir = process.argv[2];
const base = process.argv[3] || 'http://localhost:8803';
fs.mkdirSync(dir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(base + '/');
  await page.waitForSelector('[data-fk="headout"]');
  out.loadToHeadOutMs = Date.now() - t0;
  await page.screenshot({ path: `${dir}/g01-first-page.png` });
  out.firstPageText = (await page.evaluate(() => document.body.innerText)).slice(0, 1500);
  out.firstPageWords = out.firstPageText.split(/\s+/).length;

  // A movement key starts the first run.
  const t1 = Date.now();
  await page.keyboard.press('d');
  await page.waitForSelector('canvas.g-canvas');
  out.keyToCanvasMs = Date.now() - t1;
  out.loadToControlMs = Date.now() - t0;
  await sleep(300);
  await page.screenshot({ path: `${dir}/g02-run-first-frame.png` });

  // Stand still. Walk through benches with the fewest presses. Stop at death.
  const tRun = Date.now();
  let benches = 0, presses = 0;
  for (;;) {
    if (await page.$('.g-end')) break;
    const bench = await page.$('.g-bench:not([hidden])');
    if (bench && await bench.isVisible()) {
      if (benches === 0) await page.screenshot({ path: `${dir}/g03-bench-1.png` });
      benches++;
      await page.keyboard.press('1'); presses++; await sleep(120);
      await page.keyboard.press('Enter'); presses++; await sleep(400);
    }
    if (Date.now() - tRun > 180000) break;
    await sleep(100);
  }
  out.idleRunSeconds = (Date.now() - tRun) / 1000;
  out.benchesSeen = benches;
  const tDead = Date.now();
  await sleep(250);
  await page.screenshot({ path: `${dir}/g04-end-screen.png` });
  // Death to the next run: Enter on the end screen, then Enter on the homecoming (Go again has focus).
  let again = 0;
  await page.keyboard.press('Enter'); again++;
  await page.waitForSelector('[data-fk="again"]');
  out.endToHomecomingMs = Date.now() - tDead;
  await sleep(600);
  await page.screenshot({ path: `${dir}/g05-homecoming-first-death.png`, fullPage: true });
  out.homecomingText = (await page.evaluate(() => document.body.innerText)).slice(0, 2500);
  const tAgain = Date.now();
  await page.keyboard.press('Enter'); again++;
  await page.waitForSelector('canvas.g-canvas');
  out.againToCanvasMs = Date.now() - tAgain;
  out.pressesDeathToNextRun = again;
  await sleep(400);
  await page.screenshot({ path: `${dir}/g06-second-run.png` });
  out.secondRunTeach = await page.evaluate(() => document.querySelector('.g-teach')?.textContent ?? '');

  // Quit to town to see what the town looks like after one run.
  await page.keyboard.press('Escape'); await sleep(200);
  await page.screenshot({ path: `${dir}/g07-pause.png` });
  await browser.close();
  fs.writeFileSync(`${dir}/loop.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
