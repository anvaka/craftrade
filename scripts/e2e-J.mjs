// Scenario J: small UI probes (double clicks on destructive buttons, scroll carried between screens).
import { Session, sleep, SAVE_KEY } from './e2e-lib.mjs';

export default async function scenarioJ() {
  const S = new Session('J-ui');
  const page = await S.launch();
  try {
    await S.goto();
    await S.waitScreen((s) => !s.hidden, 5000, 'welcome');
    await S.click('guided', '0');
    await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');
    await S.click('start');
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    const sv = await S.save();
    const w = (fam, tier) => ({ fam, tier, gs: 0.5, variant: false, evolved: false, dmg: 0, kills: 0 });
    const run = sv.run;
    run.phase = 'camp';
    run.wave = 3;
    run.totals.wavesCleared = 3;
    run.weapons = [w('bow', 2), w('blade', 2), w('fire', 2), w('hammer', 1), w('frost', 1)];
    run.scrap = 60;
    run.craftsLeft = 1;
    run.bagMats = { iron: 30, reed: 9, greenwood: 11 };
    run.shop = [{ kind: 'item', item: 'whetstone', tier: 1, price: 20, locked: false, sold: false }, { kind: 'weapon', fam: 'bow', tier: 1, price: 19, locked: false, sold: false }, { kind: 'item', item: 'boots', tier: 1, price: 20, locked: false, sold: false }, { kind: 'item', item: 'vest', tier: 1, price: 20, locked: false, sold: false }];
    run.routeOptions = [{ ground: 'quarry', objective: 'none', elite: null, shrine: null }, { ground: 'grove', objective: 'none', elite: null, shrine: null }, { ground: 'marsh', objective: 'none', elite: null, shrine: null }];
    run.route = run.routeOptions[0];
    const camp = JSON.stringify(sv);
    const load = async (json, vp) => {
      if (vp) await page.setViewport(vp);
      await page.evaluate((k, v) => localStorage.setItem(k, v), SAVE_KEY, json);
      await S.goto();
      await S.waitScreen((s) => !s.hidden, 4000, 'town');
      await S.click('continue', undefined, { tap: !!vp?.hasTouch });
      return S.waitScreen((s) => !s.hidden && s.h1 !== 'Town', 3000, 'run screen');
    };

    // ---- a double click on Sell
    await load(camp);
    let pr = await S.probe(S.sel('sell', '4'));
    await page.mouse.click(pr.x, pr.y, { clickCount: 1 });
    await page.mouse.click(pr.x, pr.y, { clickCount: 2 });
    await sleep(150);
    let r = (await S.save()).run;
    S.log(`double click on "Sell" of the 5th weapon: weapons ${r.weapons.map((x) => x.fam + x.tier)} scrap ${r.scrap}`);
    await load(camp);
    pr = await S.probe(S.sel('sell', '1'));
    await page.mouse.click(pr.x, pr.y);
    await sleep(60);
    await page.mouse.click(pr.x, pr.y);
    await sleep(150);
    r = (await S.save()).run;
    S.check(r.weapons.length === 4, `two quick clicks on one Sell button sell only one weapon (left: ${r.weapons.map((x) => x.fam + x.tier)}; the row below slides under the cursor)`);
    await S.shot('double-sell');

    // ---- mending tonic at full health
    await load(camp);
    const hp0 = (await S.save()).run.hp;
    const max = (await S.screen()).text.match(/Health\s+(\d+)\/(\d+)/);
    await S.click('craft', 'mending');
    r = (await S.save()).run;
    S.log(`mending tonic at ${max?.[1]}/${max?.[2]} health: reed 9 -> ${r.bagMats.reed}, hp ${hp0} -> ${r.hp}, craftsLeft ${r.craftsLeft}`);
    S.check(!(Number(max?.[1]) >= Number(max?.[2])) || r.bagMats.reed === 9, 'mending tonic is not wasted when health is already full');

    // ---- scroll offset carried from one screen to the next (phone)
    const phone = { width: 390, height: 844, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
    await load(camp, phone);
    await page.evaluate(() => (document.getElementById('overlay').scrollTop = 99999));
    const y0 = await page.evaluate(() => document.getElementById('overlay').scrollTop);
    await S.click('route', '1', { tap: true });
    const y1 = await page.evaluate(() => document.getElementById('overlay').scrollTop);
    S.check(Math.abs(y1 - y0) < 5, `choosing a route keeps the scroll position (${y0} -> ${y1})`);
    // gate -> push -> camp
    const g = JSON.parse(camp);
    g.run.phase = 'gate';
    g.run.wave = 4;
    g.run.gate = { boss: 0, killed: false, opened: false, loot: [], wildOffer: ['slot', 'veins', 'glass'], wildDone: false, final: false };
    await load(JSON.stringify(g), phone);
    await S.click('wild', '', { tap: true });
    await page.evaluate(() => (document.getElementById('overlay').scrollTop = 99999));
    const gy = await page.evaluate(() => document.getElementById('overlay').scrollTop);
    await S.click('push', undefined, { tap: true });
    await sleep(100);
    let scr = await S.screen();
    const cy = await page.evaluate(() => document.getElementById('overlay').scrollTop);
    S.check(cy === 0, `after Push on, the camp opens at the top (opened scrolled to ${cy}px; the gate was at ${gy}px)`);
    await S.shot('camp-opened-scrolled');
    // gate -> extract -> summary -> town
    await load(JSON.stringify(g), phone);
    await S.click('wild', '', { tap: true });
    await page.evaluate(() => (document.getElementById('overlay').scrollTop = 99999));
    await S.click('extract', undefined, { tap: true });
    await sleep(100);
    const sy = await page.evaluate(() => document.getElementById('overlay').scrollTop);
    scr = await S.screen();
    S.check(sy === 0, `summary opens at the top (opened at ${sy}px, screen "${scr.h1}")`);
    await S.shot('summary-opened-scrolled');
    await page.evaluate(() => (document.getElementById('overlay').scrollTop = 99999));
    await S.click('town', undefined, { tap: true });
    await sleep(100);
    const ty = await page.evaluate(() => document.getElementById('overlay').scrollTop);
    S.check(ty === 0, `town opens at the top after the summary (opened at ${ty}px)`);
    // town tab switch from a scrolled position
    await page.evaluate(() => (document.getElementById('overlay').scrollTop = 600));
    await page.evaluate(() => document.querySelector('#overlay [data-a="tab"][data-v="Forge"]').click());
    const fy = await page.evaluate(() => document.getElementById('overlay').scrollTop);
    S.log(`tab switch from scroll 600: new tab at ${fy}px`);
  } catch (e) {
    S.finding('SCRIPT ABORTED: ' + (e.stack || e));
    await S.shot('abort').catch(() => {});
  }
  await S.close();
}
