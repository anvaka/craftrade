// Checks of this branch's behaviour in the real client (play.html on the feel dev server).
//   node tools/exp/feel/verify.cjs [base=http://localhost:8841] [check ...]
// Each check prints PASS or FAIL with what it saw, and leaves stills in $OUT as verify-*.png.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:8841';
const ONLY = process.argv.slice(3);
const OUT = process.env.OUT || '/tmp/claude-0/-home-user-craftrade/f25dc36b-8df5-594a-b0f7-efca5aaf75e4/scratchpad/feel';
const DSF = Number(process.env.DSF || 1);
fs.mkdirSync(OUT, { recursive: true });
const DESK = { width: 1280, height: 720 }, PHONE = { width: 360, height: 640 }, LAND = { width: 640, height: 360 };
const results = [];
const ok = (name, pass, saw) => { results.push({ name, pass, saw }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}: ${typeof saw === 'string' ? saw : JSON.stringify(saw)}`); };

async function open(browser, q, vp = DESK, o = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: DSF, hasTouch: !!o.touch, isMobile: !!o.touch, reducedMotion: o.reduced ? 'reduce' : 'no-preference', storageState: o.state });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/play.html?${q}`);
  await page.waitForFunction(() => window.__ready);
  return { ctx, page, errors };
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/verify-${name}.png` });
const teachText = (page) => page.evaluate(() => { const t = document.querySelector('.g-teach'); return t && !t.hidden ? t.textContent : ''; });
const notices = (page) => page.evaluate(() => [...document.querySelectorAll('.g-notices .notice')].map((n) => n.textContent));
const card = (page) => page.evaluate(() => { const c = document.querySelector('.g-card'); return c && !c.hidden ? `${c.querySelector('.tag').textContent} / ${c.querySelector('.g-card-title').textContent} / ${c.querySelector('.g-card-sub').textContent}` : ''; });
const feel = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('scrip.feel') || '{}'));
const wait = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout, polling: 50 });

const checks = {
  // Teaching lines stay until the thing is done, and what is learned is kept on the device.
  async teach(b) {
    const { ctx, page, errors } = await open(b, 'first=1&seed=3');
    await page.waitForTimeout(600);
    const t0 = await teachText(page);
    ok('teach: first line says how to move', /Move with WASD/.test(t0), t0);
    await page.keyboard.down('KeyD'); await page.waitForTimeout(1000); await page.keyboard.up('KeyD');
    await page.waitForTimeout(200);
    const t1 = await teachText(page);
    ok('teach: then the ring, with the pointer on the node', /Stand in the ring to work the/.test(t1), t1);
    await shot(page, 'teach-ring');
    // stand still until something hits
    await page.evaluate(() => { window.__hp0 = window.__run.player.hp; });
    for (let i = 0; i < 400; i++) {
      if (await page.evaluate(() => window.__run.player.hp < window.__hp0 || /Keep moving/.test(document.querySelector('.g-teach')?.textContent || ''))) break;
      if (await page.evaluate(() => window.__run.phase === 'bench' && !document.querySelector('.g-bench').hidden)) { await page.keyboard.press('1'); await page.waitForTimeout(150); await page.keyboard.press('Enter'); await page.evaluate(() => { window.__hp0 = window.__run.player.hp; }); }
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(250);
    const t2 = await teachText(page);
    ok('teach: "Keep moving" after the first hit or a crowding', /Keep moving\. Touch hurts\./.test(t2), t2);
    await shot(page, 'teach-keep-moving');
    // keep it up while standing still, drop it after moving off
    await page.waitForTimeout(800);
    ok('teach: it stays while the player stands still', /Keep moving/.test(await teachText(page)), await teachText(page));
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) { await page.keyboard.down(k); await page.waitForTimeout(800); await page.keyboard.up(k); }
    const t3 = await teachText(page);
    ok('teach: gone once the player has moved for a while', !/Keep moving/.test(t3), t3 || '(no line)');
    const f = await feel(page);
    ok('teach: move and keepMoving are stored on the device', !!(f.done && f.done.move && f.done.keepMoving), f.done);
    const state = await ctx.storageState();
    await ctx.close();
    // a second run on the same device: no move line, the ring is still taught (no node was broken)
    const second = await open(b, 'first=keep&seed=4', DESK, { state });
    await second.page.waitForTimeout(700);
    const t4 = await teachText(second.page);
    ok('teach: the next run does not teach moving again, and still teaches the ring', /Stand in the ring/.test(t4), t4);
    await second.ctx.close();
    ok('teach: no console errors', errors.length === 0, errors.slice(0, 2));
  },
  // Raws are defined the first time one is picked up; a level says scrip is experience.
  async words(b) {
    const { ctx, page } = await open(b, 'first=1&seed=5&bot=1&god=1');
    const seen = new Set();
    const t0 = Date.now();
    while (Date.now() - t0 < 30000 && seen.size < 2) {
      for (const n of await notices(page)) { if (/are raws/.test(n)) seen.add('raws'); if (/Scrip is also experience/.test(n)) { seen.add('level'); } }
      if (seen.has('raws') && !seen.has('shot')) { await shot(page, 'teach-raws'); seen.add('shot'); seen.delete('shot'); }
      await page.waitForTimeout(100);
    }
    ok('words: raws defined at the first raw picked up', seen.has('raws'), [...seen]);
    ok('words: the first level says scrip is experience', seen.has('level'), [...seen]);
    const f = await feel(page);
    ok('words: both stored, and the node lesson with them', !!(f.done && f.done.raws && f.done.level && f.done.work), f.done);
    await ctx.close();
  },
  // The bench is explained once, zero stats are not rows, and the anvil is taught when two items are held.
  async bench(b) {
    const { ctx, page } = await open(b, 'bench=1&first=1&seed=3');
    await page.waitForTimeout(500);
    const txt = await page.evaluate(() => document.querySelector('.g-bench').innerText);
    ok('bench: an upgrade row says what the number means', /Now .*, then .*: /.test(txt), (txt.match(/Now [^\n]*/) || [''])[0]);
    ok('bench: the reason line says what is waited for before anything is pressed', /Take your upgrade first/.test(txt), (txt.match(/Take your upgrade[^\n]*/) || [''])[0]);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.g-bench .stats > div')].filter((r) => !r.hidden).length);
    ok('bench: stats at zero are not rows', rows <= 3, `${rows} rows shown`);
    await shot(page, 'bench-first-pick');
    await page.keyboard.press('1');
    await page.waitForTimeout(200);
    const txt2 = await page.evaluate(() => document.querySelector('.g-bench').innerText);
    ok('bench: explained once, with raws named', /Scrip buys these, and some also cost raws: the timber, ore and hide you gather/.test(txt2), (txt2.match(/Scrip buys[^\n]*/) || [''])[0]);
    await shot(page, 'bench-first-offers');
    await ctx.close();
    const two = await open(b, 'bench=6&first=1&seed=7');
    await two.page.waitForTimeout(500);
    const items = await two.page.evaluate(() => new Set(window.__run.player.items.map((i) => i.id)).size);
    const anvil = await two.page.evaluate(() => document.querySelector('.g-anvil').innerText);
    ok('bench: the anvil is taught when two different items are held', items < 2 || /You hold two different items/.test(anvil), `${items} different items; "${(anvil.match(/You hold[^.]*\./) || [''])[0]}"`);
    await two.page.evaluate(() => document.querySelector('.g-anvil').scrollIntoView());
    await shot(two.page, 'bench-anvil-taught');
    await two.ctx.close();
  },
  // Pause panel: work song and shake switches; volume, mute and the song switch persist.
  async settings(b) {
    const { ctx, page } = await open(b, 'seed=3');
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(400);
    const live = await page.evaluate(() => { const a = window.__audio; return { ready: a.ready, bed: a.bed, song: a.songOn }; });
    ok('settings: the work song is asked for during a wave', live.bed !== null && live.song === true, live);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const paused = await page.evaluate(() => { const m = { audio: window.__audio }; return { bed: m.audio.bed, rows: [...document.querySelectorAll('.g-panel-row')].map((r) => r.innerText.replace(/\n/g, ' ')) }; });
    ok('settings: the bed is silent while paused, and the panel has both switches', paused.bed === null && paused.rows.some((r) => /Work song/.test(r)) && paused.rows.some((r) => /Screen shake/.test(r)), paused);
    await shot(page, 'pause-panel');
    await page.click('.g-panel-row:has-text("Work song") button');
    await page.click('.g-panel-row:has-text("Screen shake") button');
    await page.click('.g-pause .mute');
    await page.evaluate(() => { const v = document.querySelector('.g-pause .vol'); v.value = '0.35'; v.dispatchEvent(new Event('input', { bubbles: true })); });
    const stored = await page.evaluate(() => ({ audio: JSON.parse(localStorage.getItem('scrip.audio')), shake: localStorage.getItem('scrip.shake') }));
    ok('settings: volume, mute, song and shake are written to the device', stored.audio.v === 0.35 && stored.audio.m === true && stored.audio.s === false && stored.shake === '0', stored);
    const state = await ctx.storageState();
    await ctx.close();
    const again = await open(b, 'seed=3', DESK, { state });
    await again.page.keyboard.press('KeyD');
    await again.page.waitForTimeout(300);
    const kept = await again.page.evaluate(() => { const m = { audio: window.__audio }; return { v: m.audio.volume, m: m.audio.muted, s: m.audio.songOn }; });
    ok('settings: and read back on the next load', kept.v === 0.35 && kept.m === true && kept.s === false, kept);
    await again.ctx.close();
    const calm = await open(b, 'seed=3', DESK, { reduced: true });
    await calm.page.keyboard.press('Escape');
    await calm.page.waitForTimeout(200);
    const shake = await calm.page.evaluate(() => document.querySelector('.g-panel-row button[aria-label^="Screen shake"]')?.getAttribute('aria-label') || '');
    ok('settings: with reduced motion asked for, shake starts off', /Screen shake is off/.test(shake), shake);
    await calm.ctx.close();
  },
  // The bed drops out at the bench and comes back with the wave.
  async bed(b) {
    const { ctx, page } = await open(b, 'seed=5&bot=1&god=1');
    await page.keyboard.press('KeyD');
    const read = () => page.evaluate(() => { const m = { audio: window.__audio }; return { bed: m.audio.bed, phase: window.__run.phase, wave: window.__run.wave }; });
    await page.waitForTimeout(500);
    const w1 = await read();
    await wait(page, () => window.__run.phase === 'bench');
    await page.waitForTimeout(1500);
    const be = await read();
    ok('bed: level 0 in wave 1, silent at the bench', w1.bed === 0 && be.bed === null, { wave1: w1, bench: be });
    await page.keyboard.press('1'); await page.waitForTimeout(150); await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const w2 = await read();
    ok('bed: back and thicker in wave 2', w2.phase === 'wave' && w2.bed > 0, w2);
    await ctx.close();
  },
  // A death with more to carry than may go: the game asks that one question. And the near-miss line.
  async carry(b) {
    for (const [name, vp, touch] of [['desk', DESK, false], ['phone', PHONE, true]]) {
      const { ctx, page } = await open(b, 'wave=12&seed=7', vp, { touch });
      await wait(page, () => window.__run.eliteIdx >= 0 && window.__run.enemies[window.__run.eliteIdx].state !== 0);
      await page.waitForTimeout(1500);
      await page.evaluate(() => { const r = window.__run; const e = r.enemies[r.eliteIdx]; e.hp = e.maxHp * 0.12; r.player.hp = 0.5; r.player.shield = 0; r.player.dodge = 0; setInterval(() => { if (r.phase === 'wave') { e.hp = e.maxHp * 0.12; r.player.hp = Math.min(r.player.hp, 0.5); r.player.shield = 0; } }, 10); });
      await wait(page, () => window.__run.phase === 'over', null, 90000);
      await page.waitForTimeout(500);
      const c = await card(page);
      await shot(page, `death-beat-boss-${name}`);
      await wait(page, () => !!document.querySelector('.g-end') || !!window.__recap, null, 15000);
      await page.waitForTimeout(300);
      const end = await page.evaluate(() => { const e = document.querySelector('.g-end'); return e ? { text: e.innerText.slice(0, 220).replace(/\n+/g, ' | '), sections: e.querySelectorAll('.section').length, focus: document.activeElement?.dataset?.fk || '' } : null; });
      if (name === 'desk') {
        ok('death: the card names the wave and what did it', /Down in wave 12/.test(c) && /got you\./.test(c), c);
        ok('carry: asked only what to carry, "Head home" focused', !!end && end.sections === 1 && end.focus === 'go', end);
      }
      await shot(page, `carry-pick-${name}`);
      if (end) { if (touch) await page.tap('[data-fk="go"]'); else await page.keyboard.press('Enter'); }
      await wait(page, () => !!window.__recap, null, 10000);
      const recap = await page.evaluate(() => ({ nearMiss: window.__recap.nearMiss, best: window.__recap.best, carried: window.__recap.carried.length, killedBy: window.__recap.killedBy }));
      if (name === 'desk') ok('near miss: the boss and what it had left', /Old Tusk had 1[0-3]% of its health left\./.test(recap.nearMiss || ''), recap);
      else ok('carry: works by touch on a phone', recap.carried > 0, recap);
      await ctx.close();
    }
  },
  // A win: the card, the sweep, then straight to the recap hand-off.
  async win(b) {
    const { ctx, page } = await open(b, 'wave=12&bot=1&god=1&seed=7');
    await wait(page, () => window.__run.eliteIdx >= 0 && window.__run.enemies[window.__run.eliteIdx].state !== 0);
    await page.waitForTimeout(2500);
    await page.evaluate(() => { const r = window.__run; r.enemies[r.eliteIdx].hp = 1; });
    await wait(page, () => window.__run.phase === 'over', null, 60000);
    await page.waitForTimeout(450);
    const c = await card(page);
    ok('win: the card says all waves and what the last one paid', /All 12 waves cleared/.test(c) && /Paid \d+ scrip/.test(c), c);
    await shot(page, 'win-beat');
    await ctx.close();
  },
  // Phone portrait and landscape: the player is never under the HUD, in a corner or with the elite bar up.
  async hudclear(b) {
    for (const [name, vp] of [['phone', PHONE], ['land', LAND], ['desk', DESK]]) {
      const { ctx, page } = await open(b, 'wave=6&god=1&seed=7', vp, { touch: name !== 'desk' });
      await wait(page, () => window.__run.eliteIdx >= 0);
      const worst = { overlap: 0, where: '' };
      for (const [x, y] of [[60, 60], [2300, 60], [60, 1500], [1200, 800], [1200, 40]]) {
        await page.evaluate(([px, py]) => { const p = window.__run.player; p.x = p.px = px; p.y = p.py = py; }, [x, y]);
        await page.waitForTimeout(1300);
        // Where the player is drawn, from the head mark's place on the canvas: find the body by the sim and the HUD by its boxes.
        const o = await page.evaluate(() => {
          const stage = document.querySelector('.g-stage').getBoundingClientRect();
          const boxes = [...document.querySelectorAll('.g-tl, .g-tc, .g-tr, .g-slots, .g-elite, .g-snd')].filter((e) => !e.hidden && e.getClientRects().length).map((e) => e.getBoundingClientRect());
          return { stage: [stage.width, stage.height], boxes: boxes.map((r) => [r.left, r.top, r.right, r.bottom]) };
        });
        const pos = await page.evaluate(() => window.__playerScreen ? window.__playerScreen() : null);
        if (!pos) continue;
        // the body: about 44 px wide and 70 px tall above the feet, in world px times zoom
        const body = [pos.x - 20 * pos.zoom, pos.y - 66 * pos.zoom, pos.x + 20 * pos.zoom, pos.y + 6 * pos.zoom];
        for (const r of o.boxes) {
          const w = Math.min(body[2], r[2]) - Math.max(body[0], r[0]), h = Math.min(body[3], r[3]) - Math.max(body[1], r[1]);
          if (w > 0 && h > 0 && w * h > worst.overlap) { worst.overlap = Math.round(w * h); worst.where = `${x},${y}`; }
        }
        if (x === 60 && y === 60) await shot(page, `hud-corner-${name}`);
      }
      ok(`hud: the player's body never under a HUD box, ${name}`, worst.overlap === 0, worst);
      await ctx.close();
    }
  },
};

// The mobile pass must hold: 12 px text, 44 px targets, no HUD pieces on top of each other, nothing off screen.
checks.mobile = async (b) => {
  const measure = () => {
    const vis = (e) => !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
    const scope = document.querySelector('.g-root');
    let minFont = 99, minWhere = '';
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || !vis(n.parentElement)) continue;
      const f = parseFloat(getComputedStyle(n.parentElement).fontSize);
      if (f < minFont) { minFont = f; minWhere = n.textContent.trim().slice(0, 24); }
    }
    const small = [...scope.querySelectorAll('button, input')].filter(vis).map((e) => ({ r: e.getBoundingClientRect(), t: (e.textContent || e.getAttribute('aria-label') || '').trim() })).filter((x) => x.r.width < 44 || x.r.height < 44).map((x) => `${x.t} ${Math.round(x.r.width)}x${Math.round(x.r.height)}`);
    const boxes = [...document.querySelectorAll('.g-tl, .g-tc, .g-tr, .g-slots, .g-elite, .g-card, .g-snd .stamp')].filter(vis).map((e) => [e.className.split(' ')[0], e.getBoundingClientRect()]);
    const over = [], off = [];
    for (let i = 0; i < boxes.length; i++) {
      const r = boxes[i][1];
      if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5) off.push(boxes[i][0]);
      for (let j = i + 1; j < boxes.length; j++) { const q = boxes[j][1]; if (Math.min(r.right, q.right) - Math.max(r.left, q.left) > 1 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 1) over.push(`${boxes[i][0]}+${boxes[j][0]}`); }
    }
    return { minFont, minWhere, small, over, off, overflowX: document.documentElement.scrollWidth - innerWidth };
  };
  const good = (m) => m.minFont >= 12 && m.small.length === 0 && m.over.length === 0 && m.off.length === 0 && m.overflowX <= 0;
  for (const [name, vp] of [['phone 360x640', PHONE], ['landscape 640x360', LAND], ['iPhone SE 375x667', { width: 375, height: 667 }]]) {
    const { ctx, page } = await open(b, 'wave=6&god=1&seed=7&bot=1', vp, { touch: true });
    await wait(page, () => window.__run.eliteIdx >= 0);
    await page.waitForTimeout(600);
    const hud = await page.evaluate(measure);
    ok(`mobile: HUD with the elite card up, ${name}`, good(hud), hud);
    await shot(page, `mobile-elite-${name.split(' ')[0]}`);
    await wait(page, () => window.__run.bench.picks > 0, null, 40000).catch(() => {});
    const owed = await page.evaluate(measure);
    ok(`mobile: HUD with picks owed, ${name}`, good(owed), owed);
    await page.tap('.g-snd .stamp');
    await page.waitForTimeout(250);
    const pause = await page.evaluate(measure);
    ok(`mobile: pause panel, ${name}`, pause.minFont >= 12 && pause.small.length === 0 && pause.overflowX <= 0, { minFont: pause.minFont, small: pause.small });
    if (name.startsWith('phone')) await shot(page, 'mobile-pause-phone');
    await ctx.close();
  }
};

(async () => {
  const browser = await chromium.launch();
  for (const [name, fn] of Object.entries(checks)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    try { await fn(browser); } catch (e) { ok(`${name}: ran to the end`, false, String(e).split('\n')[0]); }
  }
  await browser.close();
  const failed = results.filter((r) => !r.pass);
  fs.writeFileSync(`${OUT}/verify.json`, JSON.stringify(results, null, 1));
  console.log(`\n${results.length - failed.length} of ${results.length} passed`);
})();
