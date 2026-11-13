// Scenario K: phone, guided expedition 1: which touch buttons are drawn, and do they do anything.
import { Session, sleep } from './e2e-lib.mjs';

export default async function scenarioK() {
  const S = new Session('K-touch-guided');
  const page = await S.launch({ width: 390, height: 844, touch: true, mobile: true, dsf: 2 });
  try {
    await S.goto();
    await S.waitScreen((s) => !s.hidden, 5000, 'welcome');
    await S.click('guided', '1', { tap: true });
    await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');
    await S.click('start', undefined, { tap: true });
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    await S.attach();
    await sleep(500);
    await S.shot('guided1-before-touch');
    const t = await page.touchscreen.touchStart(90, 600);
    await sleep(200);
    await t.end();
    await sleep(200);
    await S.shot('guided1-after-touch');
    let s = await S.state();
    const st = s.p.stamina;
    await page.touchscreen.tap(390 - 62, 844 - 62);
    await sleep(80);
    let z = await S.state();
    S.check(z.p.dodgeT > 0, `guided expedition 1 on touch: the DODGE button that is drawn does something (feat.dodge=${z.feat.dodge}, dodgeT=${z.p.dodgeT}, stamina ${st.toFixed(0)} -> ${z.p.stamina.toFixed(0)})`);
    await page.touchscreen.tap(390 - 62, 844 - 146);
    await sleep(80);
    z = await S.state();
    S.check(z.abilityIdx !== s.abilityIdx, `guided expedition 1 on touch: the SWAP button that is drawn does something (feat.ability=${z.feat.ability})`);
  } catch (e) {
    S.finding('SCRIPT ABORTED: ' + (e.stack || e));
    await S.shot('abort').catch(() => {});
  }
  await S.close();
}
