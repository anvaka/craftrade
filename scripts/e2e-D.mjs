// Scenario D: input details inside a wave (pause, mute, ability, swap, dodge, stamina, tab switch, resize).
import { Session, sleep, toScreen } from './e2e-lib.mjs';

/** Get into a live wave with at least `minLeft` seconds on the clock, walking through whatever screens are in the way. */
async function ensureWave(S, minLeft = 10, minHp = 35) {
  for (let guard = 0; guard < 600; guard++) {
    const scr = await S.screen();
    if (scr.hidden) {
      if (!(await S.attach(3000))) {
        await sleep(300);
        continue;
      }
      const s = await S.state();
      if (s && s.phase === 'wave' && s.dur - s.waveT >= minLeft && s.p.hp > minHp) return s;
      await sleep(400);
      continue;
    }
    if (/Paused/.test(scr.h1)) await S.click('resume', undefined, { quiet: true });
    else if (/cleared/.test(scr.h1)) await S.click('tallyok', undefined, { quiet: true });
    else if (scr.h1 === 'Camp') {
      for (let i = 0; i < 4; i++) await S.click('buy', String(i), { quiet: true });
      await S.click('go', undefined, { quiet: true });
    } else if (/Boss gate/.test(scr.h1)) {
      await S.click('chest', undefined, { quiet: true });
      await S.click('wild', '', { quiet: true });
      if (!(await S.click('push', undefined, { quiet: true }))) await S.click('extract', undefined, { quiet: true });
    } else if (/Fell|Extracted|Full clear/.test(scr.h1)) await S.click('town', undefined, { quiet: true });
    else if (scr.h1 === 'Town') {
      if (!(await S.click('start', undefined, { quiet: true }))) await S.click('continue', undefined, { quiet: true });
    } else if (scr.h1 === 'Craft World') await S.click('guided', '0', { quiet: true });
    await sleep(250);
  }
  throw new Error('could not get into a wave');
}
export { ensureWave };

async function sound(S) {
  const proto = await S.page.evaluateHandle(() => Object.prototype);
  const all = await S.page.queryObjects(proto);
  const r = await S.page.evaluate((arr) => {
    for (const o of arr) {
      try {
        if (o && Object.prototype.hasOwnProperty.call(o, 'muted') && 'toggleMute' in o) {
          window.__qaSnd = o;
          return true;
        }
      } catch { /* */ }
    }
    return false;
  }, all);
  await all.dispose();
  await proto.dispose();
  return r;
}
const sndState = (S) => S.page.evaluate(() => (window.__qaSnd ? { muted: window.__qaSnd.muted, ctx: window.__qaSnd.ctx ? window.__qaSnd.ctx.state : null, gain: window.__qaSnd.ctx ? window.__qaSnd.master.gain.value : null } : null));

export default async function scenarioD() {
  const S = new Session('D-input');
  const page = await S.launch();
  const waitFor = async (pred, timeout = 15000) => {
    const t0 = Date.now();
    for (;;) {
      const s = await S.state();
      if (!s || pred(s)) return s;
      if (Date.now() - t0 > timeout) return null;
      await sleep(40);
    }
  };
  try {
    await S.goto();
    await S.waitScreen((s) => !s.hidden, 5000, 'welcome');
    await S.click('guided', '0');
    await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');

    // ---- keyboard in menus
    await page.evaluate(() => document.querySelector('#overlay [data-a="tab"][data-v="Forge"]').focus());
    await page.keyboard.press('Space');
    await sleep(100);
    let onTab = await page.evaluate(() => document.querySelector('#overlay .tab.on')?.textContent);
    S.check(onTab === 'Forge', `keyboard: Space on a focused tab button activates it (active tab is "${onTab}")`);
    await page.evaluate(() => document.querySelector('#overlay [data-a="tab"][data-v="Codex"]').focus());
    await page.keyboard.press('Enter');
    await sleep(100);
    onTab = await page.evaluate(() => document.querySelector('#overlay .tab.on')?.textContent);
    S.check(onTab === 'Codex', `keyboard: Enter on a focused tab button activates it (active tab is "${onTab}")`);
    await page.keyboard.press('KeyP');
    await page.keyboard.press('Escape');
    await sleep(100);
    S.check((await S.screen()).h1 === 'Town', 'P and Escape in town do not open the pause screen');
    await S.click('tab', 'Expedition');
    await sound(S);
    S.log('sound before any expedition: ' + JSON.stringify(await sndState(S)));

    let s = await ensureWave(S, 30);
    S.log('sound after Start: ' + JSON.stringify(await sndState(S)));
    S.check((await sndState(S))?.ctx === 'running', 'audio context is running after the Start click');

    // ---- T1 pause with P
    await page.keyboard.press('KeyP');
    let scr = await S.waitScreen((x) => /Paused/.test(x.h1), 2000, 'pause via P');
    let a = (await S.state()).waveT;
    await sleep(700);
    let b = (await S.state()).waveT;
    S.check(a === b, `P pauses: waveT frozen at ${a.toFixed(2)}`);
    await S.shot('paused-P');
    await page.keyboard.press('KeyP');
    await S.waitScreen((x) => x.hidden, 2000, 'resume via P');
    await sleep(400);
    let c = (await S.state()).waveT;
    S.check(c > b, `P resumes: waveT ${b.toFixed(2)} -> ${c.toFixed(2)}`);

    // ---- T2 Escape, then the Resume button
    await page.keyboard.press('Escape');
    await S.waitScreen((x) => /Paused/.test(x.h1), 2000, 'pause via Escape');
    a = (await S.state()).waveT;
    await sleep(500);
    S.check((await S.state()).waveT === a, 'Escape pauses');
    await page.keyboard.press('Escape');
    await S.waitScreen((x) => x.hidden, 2000, 'resume via Escape');
    await page.keyboard.press('Escape');
    await S.waitScreen((x) => /Paused/.test(x.h1), 2000, 'pause via Escape 2');
    await S.click('resume');
    await S.waitScreen((x) => x.hidden, 2000, 'resume via button');
    await sleep(300);
    S.check((await S.state()).waveT > a, 'Resume button resumes');

    // ---- T3 a movement key held through a pause
    s = await ensureWave(S, 12);
    await page.keyboard.down('KeyD');
    await sleep(300);
    await page.keyboard.press('KeyP');
    await S.waitScreen((x) => /Paused/.test(x.h1), 2000, 'pause while moving');
    await page.keyboard.press('KeyP');
    await S.waitScreen((x) => x.hidden, 2000, 'resume while moving');
    const x0 = (await S.state()).p.x;
    await sleep(500);
    const x1 = (await S.state()).p.x;
    S.check(x1 - x0 > 40, `a movement key still held after unpausing keeps moving the player (moved ${Math.round(x1 - x0)} in 0.5s; keys seen by the game: ${(await S.state()).input.keys})`);
    await page.keyboard.up('KeyD');

    // ---- T4 mute
    const m0 = await sndState(S);
    await S.shot('before-mute');
    await page.keyboard.press('KeyM');
    await sleep(100);
    const m1 = await sndState(S);
    await S.shot('after-mute');
    S.check(m1.muted === true && m1.gain === 0, `M mutes: ${JSON.stringify(m0)} -> ${JSON.stringify(m1)}`);
    await page.keyboard.press('KeyM');
    await sleep(100);
    const m2 = await sndState(S);
    S.check(m2.muted === false && m2.gain > 0, `M unmutes: ${JSON.stringify(m2)}`);

    // ---- T5 ability with E
    s = await ensureWave(S, 14);
    s = await waitFor((z) => z.p.abilityCd <= 0);
    await page.mouse.move(s.cam.w / 2 + 150, s.cam.h / 2);
    await page.keyboard.press('KeyE');
    await sleep(120);
    let z = await S.state();
    S.check(z.p.abilityCd > 0, `E fires the ability (${z.abilities[z.abilityIdx]}), cooldown now ${z.p.abilityCd.toFixed(1)}s`);
    await S.shot('ability-E');

    // ---- T7 Q swaps (does not need the cooldown)
    const idx0 = z.abilityIdx;
    await page.keyboard.press('KeyQ');
    await sleep(120);
    z = await S.state();
    S.check(z.abilityIdx !== idx0, `Q swaps the ability: index ${idx0} -> ${z.abilityIdx} (${z.abilities[z.abilityIdx]})`);
    await S.shot('ability-swapped');
    S.log(`after swap the cooldown is ${z.p.abilityCd.toFixed(1)}s (shared)`);

    // ---- T6 ability with right click; no context menu
    await page.evaluate(() => {
      window.__ctx = [];
      addEventListener('contextmenu', (e) => window.__ctx.push({ prevented: e.defaultPrevented, target: e.target.tagName }));
    });
    s = await ensureWave(S, 16);
    s = await waitFor((q) => q.p.abilityCd <= 0, 14000);
    if (s && (await S.screen()).hidden) {
      await page.mouse.click(s.cam.w / 2 + 120, s.cam.h / 2 + 40, { button: 'right' });
      await sleep(120);
      z = await S.state();
      const ctx = await page.evaluate(() => window.__ctx);
      S.check(z.p.abilityCd > 0, `right click fires the ability, cooldown ${z.p.abilityCd.toFixed(1)}s`);
      S.check(ctx.length === 1 && ctx[0].prevented === true, `context menu suppressed on the canvas: ${JSON.stringify(ctx)}`);
      S.check(z.input.mouseDown === false, 'right click does not leave the heavy swing held');
    } else S.finding('could not test right click: cooldown did not come back inside the wave');

    // ---- T8 dodge with Space and with Shift
    s = await ensureWave(S, 10);
    s = await waitFor((q) => q.p.stamina >= 99);
    await page.keyboard.down('KeyA');
    await sleep(80);
    const before = await S.state();
    await page.keyboard.press('Space');
    await sleep(50);
    const during = await S.state();
    await sleep(260);
    const after = await S.state();
    await page.keyboard.up('KeyA');
    S.check(during.p.dodgeT > 0 && during.p.iframes > 0, `Space starts a dodge (dodgeT ${during.p.dodgeT.toFixed(2)}, iframes ${during.p.iframes.toFixed(2)})`);
    S.check(Math.abs(before.p.stamina - 28 - during.p.stamina) < 3, `dodge costs 28 stamina: ${before.p.stamina.toFixed(0)} -> ${during.p.stamina.toFixed(0)}`);
    S.check(before.p.x - after.p.x > 100, `dodge moved the player ${Math.round(before.p.x - after.p.x)} left`);
    const scrollY = await page.evaluate(() => [scrollY, document.documentElement.scrollTop, document.getElementById('overlay').scrollTop]);
    S.check(scrollY[0] === 0 && scrollY[1] === 0, 'Space did not scroll the page');
    await sleep(900);
    const sh0 = await S.state();
    await page.keyboard.press('ShiftLeft');
    await sleep(50);
    S.check((await S.state()).p.dodgeT > 0, 'Shift also dodges (not listed in the controls help)');

    // ---- T9 pressing the heavy swing during a dodge
    s = await ensureWave(S, 10);
    s = await waitFor((q) => q.p.stamina >= 99);
    await page.mouse.move(s.cam.w / 2 + 100, s.cam.h / 2);
    await page.keyboard.press('Space');
    await sleep(60);
    await page.mouse.down();
    let everCharged = false;
    let t0 = Date.now();
    while (Date.now() - t0 < 1500) {
      z = await S.state();
      if (z.p.charging) everCharged = true;
      await sleep(40);
    }
    z = await S.state();
    S.check(everCharged, `holding the mouse from mid-dodge starts the wind-up once the dodge ends (after 1.5s held: charging=${z.p.charging}, charge=${z.p.charge.toFixed(2)}, stamina=${z.p.stamina.toFixed(0)}, game sees mouseDown=${z.input.mouseDown})`);
    await S.shot('held-after-dodge');
    await page.mouse.up();
    await sleep(100);
    await page.mouse.down();
    z = await waitFor((q) => q.p.charge >= 1, 1500);
    S.check(!!z, 'releasing and pressing again does wind up');
    const st0 = (await S.state()).p.stamina;
    await page.mouse.up();
    await sleep(100);
    z = await S.state();
    S.check(z.p.swingT > 0 || z.p.stamina < st0 - 20, `release at full charge swings (stamina ${st0.toFixed(0)} -> ${z.p.stamina.toFixed(0)})`);

    // ---- T10 holding the mouse with no stamina
    s = await ensureWave(S, 12);
    s = await waitFor((q) => q.p.stamina >= 95);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Space');
      await sleep(280);
    }
    z = await S.state();
    S.log(`stamina after three dodges: ${z.p.stamina.toFixed(0)}`);
    await page.mouse.down();
    await sleep(60);
    await S.shot('no-stamina-press');
    everCharged = false;
    t0 = Date.now();
    let trace = [];
    while (Date.now() - t0 < 3500) {
      z = await S.state();
      if (z.p.charging) everCharged = true;
      trace.push(`${((Date.now() - t0) / 1000).toFixed(1)}s st=${z.p.stamina.toFixed(0)} ch=${z.p.charging ? z.p.charge.toFixed(1) : '-'}`);
      await sleep(250);
    }
    S.log('hold with no stamina: ' + trace.join(' | '));
    S.check(everCharged, `holding the mouse through "no stamina" starts the wind-up once stamina returns (it never did in 3.5s; stamina ended at ${z.p.stamina.toFixed(0)})`);
    await page.mouse.up();
    await sleep(80);
    await page.mouse.down();
    z = await waitFor((q) => q.p.charging, 800);
    S.check(!!z, 'after release + press the wind-up starts (not stuck for good)');
    await page.mouse.up();

    // ---- T11 a short click does nothing
    s = await ensureWave(S, 8);
    s = await waitFor((q) => q.p.stamina >= 95);
    await page.mouse.down();
    await sleep(200);
    await page.mouse.up();
    await sleep(80);
    z = await S.state();
    S.log(`short click (0.2s): stamina ${s.p.stamina.toFixed(0)} -> ${z.p.stamina.toFixed(0)}, swingT ${z.p.swingT} (no swing unless fully wound)`);

    // ---- T12 a hit while winding up
    s = await ensureWave(S, 14, 50);
    {
      let seen = null;
      const tEnd = Date.now() + 12000;
      await page.mouse.down();
      let wasCharging = false;
      let dmg0 = (await S.state()).dmgTaken;
      while (Date.now() < tEnd && !seen) {
        z = await S.state();
        if (!z || z.phase === 'over' || !z.overlayHidden) break;
        const near = z.enemies.filter((e) => e.state !== 'under').sort((a, b) => Math.hypot(a.x - z.p.x, a.y - z.p.y) - Math.hypot(b.x - z.p.x, b.y - z.p.y))[0];
        if (near) {
          const dx = near.x - z.p.x;
          const dy = near.y - z.p.y;
          await page.keyboard[dx > 20 ? 'down' : 'up']('KeyD');
          await page.keyboard[dx < -20 ? 'down' : 'up']('KeyA');
          await page.keyboard[dy > 20 ? 'down' : 'up']('KeyS');
          await page.keyboard[dy < -20 ? 'down' : 'up']('KeyW');
        }
        if (wasCharging && !z.p.charging && z.dmgTaken > dmg0 && z.input.mouseDown) seen = z;
        if (!z.p.charging && !seen) {
          // (re)start a wind-up
          await page.mouse.up();
          await sleep(40);
          await page.mouse.down();
          dmg0 = z.dmgTaken;
        }
        wasCharging = z.p.charging;
        await sleep(30);
      }
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) await page.keyboard.up(k);
      if (seen) {
        let restarted = false;
        const t1 = Date.now();
        while (Date.now() - t1 < 1500) {
          z = await S.state();
          if (z.p.charging) restarted = true;
          await sleep(40);
        }
        S.log(`a hit cancelled the wind-up (stamina ${seen.p.stamina.toFixed(0)}, hp ${seen.p.hp.toFixed(0)}); mouse still held for 1.5s more: wind-up restarted=${restarted}`);
        S.check(restarted, 'after a hit cancels the wind-up, a still-held mouse starts it again');
        await S.shot('hit-cancelled-windup');
      } else S.log('T12: no hit landed during a wind-up in 12s; not observed');
      await page.mouse.up();
    }

    // ---- T17 arrow keys
    const ax0 = (await S.state()).p.y;
    await page.keyboard.down('ArrowUp');
    await sleep(300);
    await page.keyboard.up('ArrowUp');
    S.check(ax0 - (await S.state()).p.y > 30, 'arrow keys move the player');

    // ---- T13 switching tabs pauses
    s = await ensureWave(S, 10);
    const other = await S.browser.newPage();
    await other.goto('about:blank');
    await other.bringToFront();
    await sleep(800);
    let hidden = await page.evaluate(() => document.hidden);
    S.log(`after opening another tab: document.hidden=${hidden}`);
    if (!hidden) {
      S.log('headless Chrome did not hide the first tab; dispatching visibilitychange by hand');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }
    await page.bringToFront();
    await other.close();
    await page.evaluate(() => {
      delete document.hidden;
    });
    await sleep(300);
    scr = await S.screen();
    S.check(/Paused/.test(scr.h1), `switching tabs pauses the wave (overlay "${scr.h1}")`);
    await S.shot('paused-after-tab-switch');
    a = (await S.state()).waveT;
    await sleep(400);
    S.check((await S.state()).waveT === a, 'still paused after coming back');
    await S.click('resume');
    await sleep(300);
    S.check((await S.state()).waveT > a, 'resumes after the tab switch');

    // ---- T14 window blur while keys are held
    await page.keyboard.down('KeyS');
    await sleep(100);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await sleep(100);
    z = await S.state();
    S.check(z.input.keys.length === 0 && z.overlayHidden, `window blur drops held keys but does not pause (keys ${z.input.keys}, overlay hidden ${z.overlayHidden})`);
    await page.keyboard.up('KeyS');

    // ---- T15 resize mid-wave
    for (const [w, h] of [[700, 500], [1600, 1000], [420, 760], [1280, 900]]) {
      s = await ensureWave(S, 6);
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await sleep(400);
      z = await S.state();
      const cv = await page.evaluate(() => ({ w: document.getElementById('game').width, h: document.getElementById('game').height, iw: innerWidth, ih: innerHeight }));
      S.check(cv.w === w && cv.h === h && z.cam.w === w && z.cam.h === h, `resize to ${w}x${h}: canvas ${cv.w}x${cv.h}, renderer ${z.cam.w}x${z.cam.h}, scale ${z.cam.scale.toFixed(2)}`);
      const [px, py] = toScreen(z, z.p.x, z.p.y);
      S.check(px > 0 && px < w && py > 0 && py < h, `player on screen after resize at (${Math.round(px)}, ${Math.round(py)})`);
      await page.mouse.move(Math.min(w - 5, px + 100), py);
      await sleep(120);
      z = await S.state();
      S.check(z.p.ax > 0.9, `mouse aim follows after resize (ax ${z.p.ax.toFixed(2)})`);
      await S.shot(`resize-${w}x${h}`);
    }

    // ---- mouse held when the wave ends, then released over the tally
    s = await ensureWave(S, 2, 1);
    await sleep(Math.max(0, (s.dur - s.waveT - 1.2) * 1000));
    await page.mouse.down();
    scr = await S.waitScreen((x) => !x.hidden, 8000, 'screen after wave with mouse held');
    await page.mouse.up();
    S.log(`wave ended with the mouse held: screen "${scr.h1}"`);
    await sleep(300);
    scr = await S.screen();
    S.check(/cleared|Fell/.test(scr.h1), `releasing the held mouse over the tally does not click through it (screen "${scr.h1}")`);
    s = await ensureWave(S, 5, 1);
    await sleep(300);
    z = await S.state();
    S.check(z.input.mouseDown === false && !z.p.charging, 'next wave does not start with a phantom held swing');
  } catch (e) {
    S.finding('SCRIPT ABORTED: ' + (e.stack || e));
    await S.shot('abort').catch(() => {});
  }
  await S.close();
}
