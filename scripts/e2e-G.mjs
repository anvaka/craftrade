// Scenario G: paths that take too long to reach by play, entered through an edited save and then driven with real clicks:
// reload at tally and gate, flask at camp, chest + evolution + wild pick + extract, full clear (key rises), death with schematics,
// and what each guided expedition switches on.
import fs from 'node:fs';
import path from 'node:path';
import { Session, playWaveDesktop, sleep, SAVE_KEY, afterWave, matSum } from './e2e-lib.mjs';

export default async function scenarioG() {
  const S = new Session('G-injected');
  const page = await S.launch();
  const inject = async (save) => {
    await page.evaluate((k, v) => localStorage.setItem(k, v), SAVE_KEY, JSON.stringify(save));
    await S.goto();
    await S.waitScreen((s) => !s.hidden, 4000, 'town after inject');
  };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  try {
    await S.goto();
    await S.waitScreen((s) => !s.hidden, 5000, 'welcome');
    await S.click('guided', '0');
    await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');
    const fresh = await S.save();
    await S.click('start');
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    let r = await playWaveDesktop(S, { gather: true, maxHeat: 10, gatherMinHp: 60 });
    let scr = await afterWave(S, r);
    if (!/cleared/.test(scr.h1)) throw new Error('bot died in wave 1; rerun');

    // reload on the tally
    const tallySave = await S.save();
    await S.goto();
    scr = await S.waitScreen((s) => /An expedition is under way/.test(s.text), 3000, 'town (reload at tally)');
    S.check(/Wave 2 of 12\. It was saved at camp/.test(scr.text), `reload at tally: town says "${scr.text.match(/Wave \d+ of 12[^\n]*/)?.[0]}"`);
    await S.click('continue');
    scr = await S.waitScreen((s) => /Wave 1 cleared/.test(s.h1), 3000, 'tally after reload');
    await sleep(800);
    await S.shot('tally-after-reload');
    S.check(/damage taken/.test(scr.text) && JSON.stringify((await S.save()).run) === JSON.stringify(tallySave.run), 'tally screen restored from the save after a reload');
    await S.click('tallyok');
    await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp');
    const campSave = await S.save();

    // ---- flask at camp
    let sv = clone(campSave);
    sv.run.flasks = [{ form: 'flask', atoms: ['guard', 'thorns'] }, { form: 'flask', atoms: ['burn', 'frenzy', 'might'] }];
    await inject(sv);
    await S.click('continue');
    scr = await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp with flasks');
    S.check(/Flasks/i.test(scr.text) && (await S.has('drink', '0')) && (await S.has('drink', '1')), 'camp lists two flasks with Drink buttons');
    await S.click('drink', '1');
    let run = (await S.save()).run;
    S.check(run.flaskActive && run.flaskActive.atoms.includes('frenzy') && run.flasks.length === 1, `drank flask: active ${JSON.stringify(run.flaskActive)}, left ${run.flasks.length}`);
    S.check((await S.probe(S.sel('drink', '0'))).disabled, 'second flask cannot be drunk while one is active');
    scr = await S.screen();
    S.check(/Flask: .*attack speed/.test(scr.text), 'camp shows the active flask effect');
    await S.shot('camp-flask');
    // frenzy = no healing: mending tonic should now be refused if herbs were there
    S.log('craft buttons with a no-heal flask active: ' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#overlay [data-a="craft"]')].map((b) => ({ v: b.dataset.v, disabled: b.disabled, why: b.closest('.line')?.querySelector('.short')?.textContent ?? '' })))));

    // ---- gate: chest, evolution, wild pick, reload, extract
    const gateSave = (final) => {
      const g = clone(campSave);
      const run = g.run;
      run.phase = 'gate';
      run.wave = final ? 12 : 4;
      run.totals.wavesCleared = run.wave;
      run.gate = { boss: final ? 2 : 0, killed: true, opened: false, loot: [], wildOffer: ['slot', 'veins', 'glass'], wildDone: false, final };
      run.last.index = run.wave - 1;
      run.last.res.armorBreaks = 3;
      run.last.res.bossKilled = true;
      run.weapons[0].tier = 3;
      run.recipes.push('evo-blade');
      run.bagMats = { iron: 51, greenwood: 13, reed: 7, hide: 3, seal: 1 };
      run.bagSchem = ['r-var-bow', 'p-wpn-pelt', 'b-forge-3'];
      run.scrap = 100;
      return g;
    };
    sv = gateSave(false);
    await inject(sv);
    await S.click('continue');
    scr = await S.waitScreen((s) => /Boss gate 1/.test(s.h1), 3000, 'gate');
    await S.shot('gate');
    await S.click('chest');
    run = (await S.save()).run;
    S.log(`chest loot: ${JSON.stringify(run.gate.loot)}; bag ${JSON.stringify(run.bagMats)}; schem ${run.bagSchem}`);
    S.check(run.scrap === 140 && run.bagMats.seal === 2 && run.bagSchem.length === 4, 'chest gives 40 scrap, a second seal for breaking all armour, and a schematic');
    scr = await S.screen();
    S.check(/Evolve Sword III with Foreman's seal → /.test(scr.text), `evolution offered: ${scr.text.match(/Evolve[^\n]*/)?.[0]}`);
    await S.shot('gate-chest-evolve');
    await page.click('#overlay [data-a="evolve"]');
    await sleep(100);
    run = (await S.save()).run;
    S.check(run.weapons[0].evolved === true && run.bagMats.seal === 1, `evolved: ${JSON.stringify(run.weapons[0])}, seals left ${run.bagMats.seal}`);
    scr = await S.screen();
    S.log('weapons card after evolving: ' + (scr.text.split('Weapons')[1] ?? '').split('Bag')[0].replace(/\n+/g, ' | '));
    await S.shot('gate-evolved');
    // reload in the middle of the gate
    await S.goto();
    await S.waitScreen((s) => /An expedition is under way/.test(s.text), 3000, 'town (reload at gate)');
    await S.click('continue');
    scr = await S.waitScreen((s) => /Boss gate 1/.test(s.h1), 3000, 'gate after reload');
    S.check(/In the chest/.test(scr.text) && !(await S.has('chest')), 'gate state (opened chest) survives a reload');
    await S.click('wild', 'slot');
    run = (await S.save()).run;
    S.check(run.slots === 7 && run.wilds.includes('slot'), `Seventh hand: slots ${run.slots}`);
    const bag = clone(run.bagMats);
    const schem = [...run.bagSchem];
    const p0 = await S.save();
    await S.shot('gate-ready');
    await S.click('extract');
    scr = await S.waitScreen((s) => /Extracted after wave 4/.test(s.h1), 3000, 'summary after extract');
    await S.shot('summary-extract');
    S.log('summary: ' + scr.text.replace(/\n+/g, ' | '));
    let p1 = await S.save();
    for (const [id, n] of Object.entries(bag)) S.check((p1.bank[id] ?? 0) === (p0.bank[id] ?? 0) + n, `extract banks all ${id}: ${p1.bank[id]}`);
    S.check(schem.every((id) => p1.schematics[id] >= 1), `extract keeps every schematic: ${JSON.stringify(p1.schematics)}`);
    S.check(p1.coin === p0.coin + 16 && p1.week.runs === p0.week.runs + 1 && p1.stats.bestWave === 4 && p1.key === 1, `coin +16, week runs +1, best wave 4, key unchanged (${p1.coin}, ${p1.week.runs}, ${p1.stats.bestWave}, ${p1.key})`);
    S.check(!/Lost with the bag/i.test(scr.text), 'no "lost" block after extracting');
    await S.click('town');
    await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');
    await S.click('tab', 'Vault');
    await S.shot('vault-after-run');
    await S.click('tab', 'Codex');
    await S.shot('codex-after-run');

    // ---- full clear
    sv = gateSave(true);
    await inject(sv);
    await S.click('continue');
    scr = await S.waitScreen((s) => /Boss gate 3/.test(s.h1), 3000, 'final gate');
    S.check(/The expedition ends here/.test(scr.text) && !(await S.has('push')), 'final gate has no Push on');
    await S.shot('gate-final');
    await S.click('chest');
    await S.click('wild', '');
    const q0 = await S.save();
    await S.click('extract');
    scr = await S.waitScreen((s) => /Full clear/.test(s.h1), 3000, 'summary after full clear');
    await S.shot('summary-clear');
    S.log('summary: ' + scr.text.replace(/\n+/g, ' | '));
    p1 = await S.save();
    S.check(p1.key === 2 && p1.loadout.keyLevel === 2 && /the key rises to danger 2/.test(scr.text), `full clear raises the key: key ${p1.key}, loadout ${p1.loadout.keyLevel}`);
    S.check(p1.coin === q0.coin + 48 + 40 && p1.stats.clears === 1, `coin +88 (${q0.coin} -> ${p1.coin}), clears ${p1.stats.clears}`);
    await S.click('town');
    scr = await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');
    S.check(/Danger 2/.test(scr.text) && /best 2/.test(scr.text), 'town shows Danger 2, best 2');
    if (p1.standing.pending > 0) {
      await S.click('tab', 'Standing');
      await S.shot('standing-pending');
    }

    // ---- death with schematics in the bag: push on from gate 1, then fall in wave 5
    sv = gateSave(false);
    sv.run.hp = 30;
    await inject(sv);
    await S.click('continue');
    await S.waitScreen((s) => /Boss gate 1/.test(s.h1), 3000, 'gate');
    await S.click('chest');
    await S.click('wild', '');
    await S.click('push');
    scr = await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp after push');
    await S.shot('camp-wave5');
    const pre = (await S.save()).run;
    const b0 = (await S.save()).bank;
    await S.click('go');
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    r = await playWaveDesktop(S, { suicide: true, shotAt: 20, shotName: 'wave5-dying' });
    scr = await afterWave(S, r);
    await sleep(300);
    await S.shot('summary-death');
    S.log('summary: ' + scr.text.replace(/\n+/g, ' | '));
    S.check(/Fell in wave 5/.test(scr.h1), `death title "${scr.h1}"`);
    p1 = await S.save();
    const exp = { ...pre.bagMats };
    for (const [id, n] of Object.entries(r.last.gathered)) exp[id] = (exp[id] ?? 0) + n;
    for (const [id, n] of Object.entries(exp)) S.check((p1.bank[id] ?? 0) - (b0[id] ?? 0) === Math.round(n * 0.2), `death keeps a fifth of ${id}: ${n} -> +${(p1.bank[id] ?? 0) - (b0[id] ?? 0)}`);
    const keptS = Object.values(p1.schematics).reduce((a, b) => a + b, 0);
    S.log(`schematics in bag ${pre.bagSchem.length}, kept ${keptS}; summary says: ${scr.text.match(/\d+ schematics?/)?.[0] ?? '(nothing about schematics)'}`);
    S.check(new RegExp(`${pre.bagSchem.length - keptS} schematic`).test(scr.text) || pre.bagSchem.length === keptS, 'summary states how many schematics were lost');
    await S.click('town');

    // ---- what each guided expedition switches on
    const expect = (s) => ({ dodge: s >= 1, loss: s >= 2, gates: s >= 2, ability: s >= 3, craft: s >= 3, routes: s >= 3, heat: s >= 4, rich: s >= 4, schem: s >= 4 });
    for (let s = 1; s <= 5; s++) {
      const g = clone(fresh);
      g.guided = true;
      g.sessions = s;
      g.run = null;
      await inject(g);
      scr = await S.screen();
      const card = scr.text.match(/Guided start, expedition (\d) of 5\.[^\n]*/)?.[0] ?? '(no guided card)';
      S.log(`sessions=${s}: ${card.slice(0, 150)}`);
      await S.shot(`guided-town-${s + 1}`);
      await S.click('start');
      await S.waitScreen((x) => x.hidden, 3000, 'arena');
      await sleep(400);
      const feat = (await S.save()).run.feat;
      S.check(JSON.stringify(feat) === JSON.stringify(s >= 5 ? expect(9) : expect(s)), `guided expedition ${s + 1}: feat ${JSON.stringify(feat)}`);
      await S.shot(`guided-wave-${s + 1}`);
      await S.goto();
      await S.waitScreen((x) => /An expedition is under way/.test(x.text), 3000, 'town');
      await S.click('abandon');
      await S.waitScreen((x) => /Fell/.test(x.h1), 3000, 'summary');
      await S.click('town');
      scr = await S.waitScreen((x) => x.h1 === 'Town', 3000, 'town');
      if (s === 5) S.log('town after the fifth guided expedition: ' + (scr.text.match(/Guided start[^\n]*/)?.[0] ?? 'no guided card'));
    }
  } catch (e) {
    S.finding('SCRIPT ABORTED: ' + (e.stack || e));
    await S.shot('abort').catch(() => {});
  }
  await S.close();
}
