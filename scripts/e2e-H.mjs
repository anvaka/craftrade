// Scenario H: follow-up probes for things seen in A-G.
import { Session, playWaveDesktop, sleep, SAVE_KEY, afterWave } from './e2e-lib.mjs';
import { audit, fullShot } from './e2e-E.mjs';

export default async function scenarioH() {
  const S = new Session('H-probes');
  const page = await S.launch();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const inject = async (save) => {
    await page.evaluate((k, v) => localStorage.setItem(k, v), SAVE_KEY, JSON.stringify(save));
    await S.goto();
    await S.waitScreen((s) => !s.hidden, 4000, 'town after inject');
  };
  try {
    await S.goto();
    await S.waitScreen((s) => !s.hidden, 5000, 'welcome');
    await S.click('guided', '0');
    await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');
    await S.click('start');
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    let r = await playWaveDesktop(S, { gather: true, maxHeat: 30, gatherMinHp: 50 });
    let scr = await afterWave(S, r);
    if (!/cleared/.test(scr.h1)) throw new Error('bot died in wave 1; rerun');
    await S.click('tallyok');
    await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp');
    const camp = await S.save();
    S.log(`camp save: hp ${camp.run.hp}, bag ${JSON.stringify(camp.run.bagMats)}`);

    // ---- H1: reload at the moment of death
    await S.click('go');
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    const before = (await S.save()).run;
    r = await playWaveDesktop(S, { suicide: true });
    S.log(`died in wave 2: hp ${r.last.p.hp}, phase ${r.last.phase}, waveT ${r.last.waveT.toFixed(1)}`);
    await S.goto(); // reload inside the 1.1 s between death and the summary
    scr = await S.waitScreen((s) => !s.hidden, 4000, 'screen after reload at death');
    await S.shot('reload-at-death');
    const after = await S.save();
    S.log(`after reloading on death: screen "${scr.h1}", run in save: ${after.run ? `wave index ${after.run.wave}, phase ${after.run.phase}, hp ${after.run.hp}, bag ${JSON.stringify(after.run.bagMats)}` : 'none'}; deaths recorded ${after.stats.deaths}`);
    S.check(!after.run || after.stats.deaths === 1, 'a death is recorded even if the page is reloaded before the summary appears');
    if (after.run) {
      await S.click('continue');
      await S.waitScreen((s) => s.hidden, 3000, 'arena again');
      await S.attach();
      const z = await S.state();
      S.log(`Continue after the reload: wave index ${z.index} restarts at waveT ${z.waveT.toFixed(1)} with hp ${z.p.hp} and the bag intact (was ${before.hp} before the fatal attempt)`);
      await S.shot('wave-restarted-after-death');
    }

    // ---- H2: long set-bonus chips and brew lines, desktop and phone widths
    const c2 = clone(camp);
    const w = (fam, tier) => ({ fam, tier, gs: 0.5, variant: false, evolved: false, dmg: 0, kills: 0 });
    c2.run.weapons = [w('bow', 1), w('bow', 2), w('blade', 1), w('blade', 2), w('fire', 1), w('hammer', 1)];
    c2.run.items = ['whetstone', 'bandolier', 'lodestone'].filter(() => true);
    c2.run.phase = 'camp';
    c2.brews = { 'flask:burn+frenzy+might': 2, 'charm:guard+thorns': 1, 'oil:chain+haste+quick': 1 };
    c2.stations.apothecary = 3;
    for (const [name, vp] of [['desktop-1280', { width: 1280, height: 900, deviceScaleFactor: 1 }], ['desktop-1000', { width: 1000, height: 800, deviceScaleFactor: 1 }], ['phone-390', { width: 390, height: 844, deviceScaleFactor: 2, hasTouch: true, isMobile: true }]]) {
      await page.setViewport(vp);
      await inject(c2);
      await S.click('continue');
      await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp');
      const clip = await page.evaluate(() => [...document.querySelectorAll('#overlay .card')].flatMap((card) => {
        const cr = card.getBoundingClientRect();
        return [...card.querySelectorAll('.chip, .line, button, p')].filter((el) => el.getBoundingClientRect().right > cr.right + 1).map((el) => `"${el.textContent.trim().slice(0, 50)}" sticks out of its card by ${Math.round(el.getBoundingClientRect().right - cr.right)}px`);
      }));
      S.log(`${name} camp: ${clip.length} element(s) overflow their card: ${clip.slice(0, 5).join(' ; ')}`);
      if (clip.length) S.finding(`${name} camp: content overflows its card: ${clip.slice(0, 3).join(' ; ')}`);
      await audit(S, `${name} camp with six weapons`);
      await fullShot(S, `${name}-camp-six-weapons`);
      // apothecary with brews in storage
      const t = clone(c2);
      t.run = null;
      await inject(t);
      await S.click('tab', 'Apothecary');
      const clip2 = await page.evaluate(() => [...document.querySelectorAll('#overlay .card')].flatMap((card) => {
        const cr = card.getBoundingClientRect();
        return [...card.querySelectorAll('.chip, .line > div, button, p')].filter((el) => el.getBoundingClientRect().right > cr.right + 1).map((el) => `"${el.textContent.trim().slice(0, 50)}" sticks out of its card by ${Math.round(el.getBoundingClientRect().right - cr.right)}px`);
      }));
      S.log(`${name} apothecary: ${clip2.length} element(s) overflow their card: ${clip2.slice(0, 5).join(' ; ')}`);
      if (clip2.length) S.finding(`${name} apothecary: content overflows its card: ${clip2.slice(0, 3).join(' ; ')}`);
      await audit(S, `${name} apothecary with brews`);
      await page.evaluate(() => document.querySelector('#overlay .card:last-child')?.scrollIntoView({ block: 'center' }));
      await S.shot(`${name}-apothecary-brews`);
      await S.click('tab', 'Expedition');
      await audit(S, `${name} expedition with brews`);
    }
  } catch (e) {
    S.finding('SCRIPT ABORTED: ' + (e.stack || e));
    await S.shot('abort').catch(() => {});
  }
  await S.close();
}
