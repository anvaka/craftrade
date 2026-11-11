// Frame time in the 300-enemy stress scene, before against after, at 4x CPU throttle.
//   node tools/exp/feel/perf.cjs <before base> <after base> [rounds=3] [seconds=10]
// Phone viewport 390x844, device ratio 2, headless Chromium (software raster, no GPU). The two
// builds are measured turn about, so load on the machine falls on both. The player is at full
// health (god mode) in "stress"; "stress-low" holds the player at 2 HP so the low-health hatch and
// the heartbeat are on, which is the most this branch adds to a frame.
//   interval = time between animation frames; work = sim + draw + forced rasterisation (perf=2).
const { chromium } = require('playwright');
const fs = require('fs');
const BEFORE = process.argv[2] || 'http://localhost:8842';
const AFTER = process.argv[3] || 'http://localhost:8841';
const ROUNDS = Number(process.argv[4] || 3);
const SECONDS = Number(process.argv[5] || 10);
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/feel';
const Q = 'wave=6&bot=1&god=1&stuff=300&seed=7&perf=2';
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : NaN; };

async function run(browser, base, low) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.addInitScript(() => {
    window.__iv = []; let last = 0;
    const tick = (t) => { if (last && window.__rec) window.__iv.push(t - last); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.goto(`${base}/play.html?${Q}`);
  await page.waitForFunction(() => window.__ready);
  // Low health without dying: the harness tops health up before every step, so cap the maximum instead.
  if (low) await page.evaluate(() => { const p = window.__run.player; let v = p.hp; Object.defineProperty(p, 'hp', { get: () => Math.min(v, p.maxHp * 0.2), set: (x) => { v = x; } }); });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { window.__rec = true; window.__perf = []; });
  await page.waitForTimeout(SECONDS * 1000);
  const r = await page.evaluate(() => { window.__rec = false; return { iv: window.__iv, perf: window.__perf, enemies: window.__run.enemyCount, hp: window.__run.player.hp / window.__run.player.maxHp }; });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await ctx.close();
  const work = (r.perf || []).map((t) => /work ms p50=([\d.]+) p95=([\d.]+)/.exec(t)).filter(Boolean).map((m) => [+m[1], +m[2]]);
  const w = work[work.length - 1] || [NaN, NaN];
  return { p50: pct(r.iv, 0.5), p95: pct(r.iv, 0.95), workP50: w[0], workP95: w[1], frames: r.iv.length, enemies: r.enemies, hp: r.hp };
}

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (let i = 0; i < ROUNDS; i++) {
    for (const [tag, base, low] of [['before', BEFORE, false], ['after', AFTER, false], ['after-low', AFTER, true]]) {
      const r = await run(browser, base, low);
      rows.push({ tag, round: i + 1, ...r });
      console.log(`${tag.padEnd(9)} round ${i + 1}: frame p50 ${r.p50.toFixed(1)} p95 ${r.p95.toFixed(1)} ms | work p50 ${r.workP50} p95 ${r.workP95} ms | ${r.frames} frames, ${r.enemies} enemies, health ${(r.hp * 100).toFixed(0)}%`);
    }
  }
  const med = (tag, k) => pct(rows.filter((r) => r.tag === tag).map((r) => r[k]), 0.5);
  console.log('\nmedian of rounds:');
  for (const tag of ['before', 'after', 'after-low']) console.log(`  ${tag.padEnd(9)} frame p50 ${med(tag, 'p50').toFixed(1)} p95 ${med(tag, 'p95').toFixed(1)} ms | work p50 ${med(tag, 'workP50')} p95 ${med(tag, 'workP95')} ms`);
  fs.writeFileSync(`${OUT}/perf.json`, JSON.stringify(rows, null, 1));
  await browser.close();
})();
