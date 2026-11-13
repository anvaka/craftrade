// A whole game from a fresh save, through the current menus, with real key and mouse input:
// welcome -> guided expeditions (waves, tally, camp, gate, summary) -> town (every tab, craft at each station) -> again.
// Usage: QA_URL=http://localhost:4181/ node scripts/e2e-full.mjs [expeditions=3] [width,height]
// START=open picks "Everything open" on the welcome screen (every town tab from the first visit); HEAT=n stops the
// scripted player mining above that heat (default 45; 10 is a careful player who gets further).
// It finds crashes, dead ends and buttons that cannot be hit. It does not measure fun.
import { Session, playWaveDesktop, sleep } from './e2e-lib.mjs';

const EXPEDITIONS = Number(process.argv[2]) || 3;
const [W, H] = (process.argv[3] || '1440,900').split(',').map(Number);
const OPEN = process.env.START === 'open';
const HEAT = Number(process.env.HEAT ?? 45);
const S = new Session(`full-${W}${OPEN ? '-open' : ''}`);
const page = await S.launch({ width: W, height: H });
await S.goto();
await page.evaluate(() => localStorage.clear());
await S.goto();

const q = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? { disabled: !!e.disabled, text: e.textContent.trim().slice(0, 70) } : null; }, sel);
const live = async (sel) => { const e = await q(sel); return !!e && !e.disabled; };
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#overlay *')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 2 && getComputedStyle(e).position !== 'fixed' && !e.closest('.tip'); }));
const look = async (label) => {
  await sleep(250);
  await S.shot(label);
  S.check(!(await overflow()), `${label}: nothing runs off the right edge`);
};

/** Visit every open tab; at each station make whatever can be made and check it landed in the save. */
async function townTour(n) {
  const tabs = await page.evaluate(() => [...document.querySelectorAll('#overlay nav [data-a="tab"]')].map((b) => b.dataset.v));
  S.log(`town ${n}: tabs open = ${tabs.join(', ')}`);
  for (const t of tabs) {
    await S.click('tab', t, { quiet: true });
    await look(`town${n}-${t}`);
    if (t === 'Forge' || t === 'Workshop' || t === 'Apothecary') {
      const keys = await page.evaluate(() => [...document.querySelectorAll('#overlay [data-a="rsel"]')].map((b) => b.dataset.v));
      let made = 0;
      for (const k of keys) {
        if (made >= 2) break;
        if (!(await S.click('rsel', k, { quiet: true }))) continue;
        await sleep(80);
        if (!(await live('#overlay [data-a="make"]'))) continue;
        const before = await S.save();
        await S.click('make');
        await sleep(600);
        const after = await S.save();
        const changed = JSON.stringify([before.gear, before.brews, before.stations, before.codex, before.book, before.tried, before.bank]) !== JSON.stringify([after.gear, after.brews, after.stations, after.codex, after.book, after.tried, after.bank]);
        S.check(changed || after.coin !== before.coin, `town${n}-${t}: making "${k}" changed the save`);
        if (k !== 'up') S.check((await q('.modal')) !== null, `town${n}-${t}: making "${k}" opens a result window`);
        await look(`town${n}-${t}-made-${k.replace(/\W+/g, '-')}`);
        for (let i = 0; i < 3 && (await q('.modal')); i++) await S.click('.modal [data-a="close"]', undefined, { quiet: true });
        made++;
      }
      S.log(`town ${n}: ${t}: ${keys.length} recipes listed, made ${made}`);
    }
    if (t === 'Inventory') {
      if (await S.click('#overlay .grid [data-a="sel"]', undefined, { quiet: true })) await look(`town${n}-Inventory-selected`);
    }
  }
  await S.click('tab', 'Expedition', { quiet: true });
  await sleep(100);
}

let expedition = 0;
let toured = -1;
let stuck = 0;
let lastSig = '';
const T0 = Date.now();
for (let step = 0; step < 4000 && expedition <= EXPEDITIONS; step++) {
  if (Date.now() - T0 > 50 * 60e3) { S.finding('ran out of time'); break; }
  const scr = await S.screen();
  if (scr.hidden) {
    const save = await S.save();
    const w = save?.run?.wave ?? -1;
    S.log(`--- expedition ${expedition}, wave ${w + 1}`);
    const r = await playWaveDesktop(S, { maxHeat: HEAT, gatherMinHp: HEAT < 20 ? 60 : 35, shotAt: 12, shotName: `x${expedition}-wave${w + 1}` });
    S.log(`wave ${w + 1} done: died=${r.died} minHp=${Math.round(r.minHp)} swings=${r.swings} nodeSwings=${r.nodeSwings} maxEnemies=${r.maxEnemies}`);
    await S.waitScreen((s) => !s.hidden && !/^Paused/.test(s.h1), 9000, 'screen after wave');
    await sleep(700); // the menu ignores input for a moment after it replaces the arena
    await look(`x${expedition}-after-wave${w + 1}`);
    continue;
  }
  const sig = scr.text.slice(0, 400);
  stuck = sig === lastSig ? stuck + 1 : 0;
  lastSig = sig;
  if (stuck > 25) {
    await S.shot('stuck');
    S.finding(`stuck on a screen: h1="${scr.h1}" text="${scr.text.slice(0, 200).replace(/\n/g, ' | ')}"`);
    break;
  }
  // a window on top: confirm it if it asks, else close it
  if (await q('.modal')) {
    if (!(await S.click('.modal [data-a="yes"]', undefined, { quiet: true }))) await S.click('.modal [data-a="close"]', undefined, { quiet: true });
    await sleep(450);
    continue;
  }
  if (await q('#overlay [data-a="guided"]')) { await look('welcome'); await S.click('guided', OPEN ? '0' : '1'); continue; }
  if (await q('#overlay [data-a="levelpick"]')) { await S.click('levelpick'); await sleep(450); continue; }
  if (await live('#overlay [data-a="tallyok"]')) { await S.click('tallyok'); await sleep(450); continue; }
  const save = await S.save();
  const run = save?.run;
  if (run?.phase === 'gate' && !(await q('#overlay nav [data-a="tab"]'))) {
    if (await live('#overlay [data-a="chest"]')) { await look(`x${expedition}-gate-w${run.wave}`); await S.click('chest'); await sleep(450); continue; }
    // expedition 2 goes home at the second gate; the others push as far as the game lets them
    const home = expedition === 2 && run.wave >= 8;
    if (!home && (await q('#overlay [data-a="push"]'))) {
      if (await q('#overlay [data-a="wild"]')) { await S.click('wild'); await sleep(450); }
      if (await live('#overlay [data-a="push"]')) { await look(`x${expedition}-gate-ready-w${run.wave}`); await S.click('push'); await sleep(500); continue; }
    }
    if (await live('#overlay [data-a="extract"]')) { await S.click('extract'); await sleep(500); continue; }
  }
  if (run?.phase === 'camp' && (await q('#overlay [data-a="go"]'))) {
    if (stuck === 0) await look(`x${expedition}-camp-w${run.wave}`);
    if (await live('#overlay [data-a="merge"]')) { await S.click('merge'); await sleep(450); continue; }
    const buys = await page.evaluate(() => [...document.querySelectorAll('#overlay [data-a="buy"]')].filter((b) => !b.disabled).map((b) => b.dataset.v));
    if (buys.length && stuck < 6) {
      const before = run.scrap;
      await S.click('buy', buys[0]);
      await sleep(450);
      const after = (await S.save()).run;
      if (after.scrap < before) { stuck = 0; lastSig = ''; }
      continue;
    }
    if (await q('#overlay [data-a="route"]')) { await S.click('route', '0', { quiet: true }); await sleep(120); }
    await S.click('go');
    await sleep(500);
    continue;
  }
  if (await q('#overlay [data-a="town"]')) {
    await look(`x${expedition}-summary`);
    S.log(`summary ${expedition}: ${scr.text.slice(0, 500).replace(/\n+/g, ' | ')}`);
    await S.click('town');
    await sleep(450);
    continue;
  }
  if (await q('#overlay nav [data-a="tab"]')) {
    if (toured < expedition) {
      toured = expedition;
      const s = await S.save();
      S.log(`town after ${expedition} expeditions: coin=${s.coin} guided=${s.guided} runs=${s.stats?.runs} bank=${JSON.stringify(s.bank)} gear=${s.gear?.length} key=${s.key}`);
      await townTour(expedition);
    }
    expedition++;
    if (expedition > EXPEDITIONS) break;
    if (await live('#overlay [data-a="continue"]')) { await S.click('continue'); await sleep(500); continue; }
    if (!(await S.click('start'))) { S.finding('town: no live Start button'); await S.shot('no-start'); break; }
    await sleep(600);
    continue;
  }
  await sleep(200);
}
// the play log: save it through the game's own button, so the export path is tested too
if (await q('#overlay nav [data-a="tab"][data-v="Character"]')) {
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: S.dir });
  await S.click('tab', 'Character', { quiet: true });
  await S.click('sub', 'Record', { quiet: true });
  await look('town-Record-play-log');
  await S.click('logsave');
  await sleep(1500);
  const fs = await import('node:fs');
  const saved = fs.readdirSync(S.dir).filter((f) => /^craftworld-log-.*\.json$/.test(f));
  S.check(saved.length === 1, `play log: saved as a file (${saved.join(', ') || 'nothing'})`);
  if (saved.length) {
    const log = JSON.parse(fs.readFileSync(`${S.dir}/${saved[0]}`, 'utf8'));
    S.check(log.runs.length === Math.min(expedition, EXPEDITIONS), `play log: ${log.runs.length} expeditions logged, ${Math.min(expedition, EXPEDITIONS)} played`);
    S.check(log.runs.every((r) => r.end && r.waves.length > 0), 'play log: every expedition has its waves and its end');
    S.log(`play log: ${log.runs.map((r) => `${r.waves.length} waves, ${r.events.length} camp actions, ${r.end?.outcome}`).join(' | ')}; ${log.town.length} town actions; file ${S.dir}/${saved[0]}`);
  }
}
const end = await S.save();
S.log(`END: expeditions started=${Math.min(expedition, EXPEDITIONS)} runs=${end?.stats?.runs} coin=${end?.coin} key=${end?.key} guided=${end?.guided} gear=${end?.gear?.length} deaths=${end?.stats?.deaths} clears=${end?.stats?.clears}`);
await S.close();
console.log(JSON.stringify({ problems: S.problems, findings: S.findings }, null, 2));
process.exit(S.problems.length + S.findings.length ? 1 : 0);
