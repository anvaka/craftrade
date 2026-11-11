// Game-feel audit in the real client. Drives play.html (Vite dev, port 8804) with the keyboard only.
//   node tools/exp/fun/feel.cjs <shotDir> [base=http://localhost:8804]
// Screenshots at deviceScaleFactor 1. Timings are printed as JSON at the end.
const { chromium } = require('playwright');
const fs = require('fs');

const dir = process.argv[2];
const base = process.argv[3] || 'http://localhost:8804';
fs.mkdirSync(dir, { recursive: true });
const out = { notes: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(browser, query) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => out.notes.push(`pageerror ${query}: ${e.message}`));
  const t0 = Date.now();
  await page.goto(`${base}/play.html?${query}`);
  await page.waitForFunction(() => window.__ready === true);
  return { ctx, page, loadMs: Date.now() - t0 };
}
const st = (page) => page.evaluate(() => {
  const r = window.__run, p = r.player;
  return { phase: r.phase, wave: r.wave, t: r.waveTime, hp: p.hp, maxHp: p.maxHp, x: p.x, y: p.y, scrip: p.scrip, level: p.level, kills: r.kills,
    working: p.workingNode, raws: p.raws, enemies: r.enemyCount, picks: r.bench.picks,
    nodes: r.nodes.filter((n) => n.alive).map((n) => ({ x: n.x, y: n.y, type: n.type, work: n.work })) };
});
const shot = async (page, name) => { await page.screenshot({ path: `${dir}/${name}.png` }); return `${dir}/${name}.png`; };

// Hold keys so the player walks toward a world point. Re-evaluated every 80 ms, like a person correcting.
async function walkTo(page, tx, ty, tol = 30, maxMs = 6000, onStep) {
  const held = new Set();
  const set = async (k, on) => { if (on && !held.has(k)) { await page.keyboard.down(k); held.add(k); } else if (!on && held.has(k)) { await page.keyboard.up(k); held.delete(k); } };
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await st(page);
    if (s.phase !== 'wave') break;
    const dx = tx - s.x, dy = ty - s.y;
    if (Math.hypot(dx, dy) < tol) break;
    await set('d', dx > 12); await set('a', dx < -12); await set('s', dy > 12); await set('w', dy < -12);
    if (onStep) await onStep(s);
    await sleep(80);
  }
  for (const k of [...held]) await page.keyboard.up(k);
}

(async () => {
  const browser = await chromium.launch();

  // ---- A. first run, real time, keyboard only -------------------------------------------------
  {
    const { page, ctx, loadMs } = await open(browser, 'seed=7&first=1');
    out.loadToReadyMs = loadMs;
    await sleep(250);
    await shot(page, 'a01-first-frame');
    out.firstFrame = await st(page);
    // Stand still 2 s: what does a player who does nothing see?
    await sleep(1800);
    await shot(page, 'a02-idle-2s');
    // Move right for 0.8 s to clear the move line.
    await page.keyboard.down('d'); await sleep(800); await page.keyboard.up('d');
    await shot(page, 'a03-after-move-work-line');
    // Walk to the first tree and stand in the ring.
    const s0 = await st(page);
    const tree = s0.nodes.find((n) => n.type === 0) || s0.nodes[0];
    await walkTo(page, tree.x - 20, tree.y + 30, 26, 5000);
    await shot(page, 'a04-in-ring-working');
    await sleep(900);
    await shot(page, 'a05-working-progress');
    // Wait for the break.
    for (let i = 0; i < 60; i++) { const s = await st(page); if (!s.nodes.some((n) => n.x === tree.x && n.y === tree.y)) break; await sleep(60); }
    await shot(page, 'a06-node-break');
    await sleep(350);
    await shot(page, 'a07-raws-on-ground');
    out.afterFirstNode = await st(page);
    // Collect and kite until the bench opens. Screenshot once a second.
    let n = 0, firstKillAt = null, firstHurtAt = null, lastHp = out.afterFirstNode.hp;
    const tStart = Date.now();
    while (true) {
      const s = await st(page);
      if (s.phase !== 'wave') break;
      if (s.kills > 0 && firstKillAt === null) firstKillAt = s.t;
      if (s.hp < lastHp && firstHurtAt === null) { firstHurtAt = s.t; await shot(page, 'a08-first-hurt'); }
      lastHp = s.hp;
      // Walk a slow circle round the middle: the simplest thing a person does.
      const a = (Date.now() - tStart) / 1400;
      await walkTo(page, 1100 + Math.cos(a) * 240, 750 + Math.sin(a) * 180, 20, 400);
      if (n++ % 3 === 0) await shot(page, `a09-wave1-${String(n).padStart(2, '0')}`);
    }
    out.wave1 = { firstKillAt, firstHurtAt, end: await st(page) };
    await sleep(400);
    await shot(page, 'a10-bench-1');
    out.bench1Text = await page.evaluate(() => document.querySelector('.g-bench, .g-overlay')?.innerText?.slice(0, 2500) ?? document.body.innerText.slice(0, 2500));
    await page.screenshot({ path: `${dir}/a10-bench-1-full.png`, fullPage: true });
    await ctx.close();
  }

  // ---- B. frame sequences at 1/6 speed: a hit and kill, a hurt, a level-up, a death -----------
  {
    const { page, ctx } = await open(browser, 'seed=7&slow=6');
    // Watch the sim for the first kill, then grab frames.
    await page.evaluate(() => {
      const r = window.__run; window.__marks = {};
      let k = r.kills, hp = r.player.hp, lv = r.player.level;
      (function poll() {
        if (r.kills > k && !window.__marks.kill) window.__marks.kill = performance.now();
        if (r.player.hp < hp && !window.__marks.hurt) window.__marks.hurt = performance.now();
        if (r.player.level > lv && !window.__marks.level) window.__marks.level = performance.now();
        if (r.phase === 'over' && !window.__marks.death) window.__marks.death = performance.now();
        k = r.kills; hp = r.player.hp; lv = r.player.level;
        requestAnimationFrame(poll);
      })();
    });
    const seq = async (name, cond, frames = 8, timeout = 90000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) { if (await page.evaluate(cond)) break; await sleep(15); }
      for (let i = 0; i < frames; i++) await shot(page, `${name}-${i}`);
    };
    // Stand still: mites walk in, the sling fires. Catch a shot in flight then the kill.
    await page.waitForFunction(() => window.__run.shots.some((s) => s.alive), null, { timeout: 60000 });
    await shot(page, 'b01-shot-in-flight');
    await seq('b02-kill', () => !!window.__marks.kill, 8);
    await seq('b03-hurt', () => !!window.__marks.hurt, 10, 120000);
    out.slowSeq = await st(page);
    await ctx.close();
  }

  // ---- C. level-up and death in real time, standing still (the do-nothing player) -------------
  {
    const { page, ctx } = await open(browser, 'seed=11');
    const t0 = Date.now();
    let lv = 1, levelShot = false, deathAt = null, hurtShots = 0, lastHp = 10;
    while (Date.now() - t0 < 120000) {
      const s = await st(page);
      if (s.level > lv && !levelShot) { levelShot = true; await shot(page, 'c01-levelup-0'); await shot(page, 'c01-levelup-1'); await shot(page, 'c01-levelup-2'); out.levelUpAt = { wave: s.wave, t: s.t }; }
      if (s.hp < lastHp && hurtShots < 3) { await shot(page, `c02-hurt-${hurtShots++}`); }
      lastHp = s.hp;
      if (s.phase === 'bench') { await shot(page, `c03-bench-wave${s.wave}`); await page.keyboard.press('Enter'); await sleep(300); const s2 = await st(page); if (s2.phase === 'bench') { out.notes.push('Enter did not leave the bench with a pick owed'); await page.keyboard.press('1'); await sleep(150); await page.keyboard.press('Enter'); await sleep(300); } }
      if (s.phase === 'over') { deathAt = Date.now(); out.idleDeath = { wave: s.wave, t: s.t, kills: s.kills }; break; }
      await sleep(40);
    }
    if (deathAt) {
      await shot(page, 'c04-death-0'); await sleep(120); await shot(page, 'c04-death-1'); await sleep(400); await shot(page, 'c04-death-2');
      await page.waitForSelector('.g-end', { timeout: 5000 });
      out.deathToEndScreenMs = Date.now() - deathAt;
      await sleep(200);
      await shot(page, 'c05-end-screen');
      await page.screenshot({ path: `${dir}/c05-end-screen-full.png`, fullPage: true });
      out.endText = await page.evaluate(() => document.querySelector('.g-end')?.innerText.slice(0, 1500));
    }
    await ctx.close();
  }

  // ---- D. mid and late game stills (bot plays, real time) -------------------------------------
  for (const [name, q, wait] of [
    ['d01-wave3-boars', 'seed=5&wave=3&bot=1&god=1', 9000], ['d02-wave4-spitters-magpie', 'seed=5&wave=4&bot=1&god=1', 12000],
    ['d03-wave5-burrowers', 'seed=5&wave=5&bot=1&god=1', 12000], ['d04-wave6-stag', 'seed=5&wave=6&bot=1&god=1', 9000],
    ['d05-wave7-brutes', 'seed=5&wave=7&bot=1&god=1', 14000], ['d06-wave8-raid', 'seed=5&wave=8&bot=1&god=1', 25000],
    ['d07-wave10', 'seed=5&wave=10&bot=1&god=1', 30000], ['d08-wave12-tusk', 'seed=5&wave=12&bot=1&god=1', 30000],
  ]) {
    const { page, ctx } = await open(browser, q);
    await sleep(wait);
    await shot(page, name);
    const s = await st(page);
    out[name] = { enemies: s.enemies, wave: s.wave, t: s.t };
    await sleep(700); await shot(page, `${name}-b`);
    await ctx.close();
  }

  // ---- E. benches: 1 (first), 4 (mule), 8 (late, fusion) ---------------------------------------
  for (const b of [2, 4, 8]) {
    const { page, ctx } = await open(browser, `seed=5&bench=${b}&first=1`);
    await sleep(500);
    await shot(page, `e-bench-${b}`);
    await page.screenshot({ path: `${dir}/e-bench-${b}-full.png`, fullPage: true });
    if (b === 8) out.bench8Text = await page.evaluate(() => document.body.innerText.slice(0, 4000));
    await ctx.close();
  }

  // ---- F. phone portrait ------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(`${base}/play.html?seed=5&wave=5&bot=1&god=1&first=1`);
    await page.waitForFunction(() => window.__ready === true);
    await sleep(8000);
    await page.screenshot({ path: `${dir}/f01-phone-wave5.png` });
    await ctx.close();
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const p2 = await ctx2.newPage();
    await p2.goto(`${base}/play.html?seed=5&bench=4`);
    await p2.waitForFunction(() => window.__ready === true);
    await sleep(600);
    await p2.screenshot({ path: `${dir}/f02-phone-bench4.png` });
    await ctx2.close();
  }

  await browser.close();
  fs.writeFileSync(`${dir}/feel.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
