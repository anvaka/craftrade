// Scenario B: everything open. Camp actions, routes, gate, push, then death; checks the summary arithmetic.
import fs from 'node:fs';
import path from 'node:path';
import { Session, playWaveDesktop, parseStatus, sleep, afterWave, checkTally, campShop, startWave, matSum } from './e2e-lib.mjs';

const WOOD = ['greenwood', 'oldwood', 'heartwood'];
const HERB = ['reed', 'silkweed', 'ghostbloom'];

async function routes(S, label, want) {
  let run = (await S.save()).run;
  const n = run.routeOptions.length;
  S.log(`${label}: routes ${JSON.stringify(run.routeOptions)}`);
  for (let i = 0; i < n; i++) {
    await S.click('route', String(i), { quiet: true });
    run = (await S.save()).run;
    const on = await S.page.evaluate((i) => document.querySelector(`#overlay [data-a="route"][data-v="${i}"]`)?.classList.contains('on'), i);
    S.check(run.routePick === i && JSON.stringify(run.route) === JSON.stringify(run.routeOptions[i]) && on, `${label}: route ${i} (${run.routeOptions[i].ground}) selected and highlighted`);
  }
  let idx = run.routeOptions.findIndex(want);
  if (idx < 0) idx = 0;
  await S.click('route', String(idx));
  run = (await S.save()).run;
  S.log(`${label}: going to ${JSON.stringify(run.route)}`);
  return run.route;
}

async function crafts(S, label) {
  let run = (await S.save()).run;
  const info = await S.page.evaluate(() => [...document.querySelectorAll('#overlay [data-a="craft"]')].map((b) => ({ v: b.dataset.v, disabled: b.disabled, why: b.closest('.line')?.querySelector('.short')?.textContent ?? '' })));
  S.log(`${label}: crafts ${JSON.stringify(info)} craftsLeft=${run.craftsLeft} bag=${JSON.stringify(run.bagMats)} hp=${run.hp}`);
  const can = info.find((c) => !c.disabled);
  if (!can) return null;
  const bag0 = matSum(run.bagMats);
  const hp0 = run.hp;
  await S.click('craft', can.v);
  const run2 = (await S.save()).run;
  S.check(run2.craftsLeft === run.craftsLeft - 1 && run2.totals.crafts === run.totals.crafts + 1, `${label}: crafted ${can.v}: craftsLeft ${run.craftsLeft} -> ${run2.craftsLeft}`);
  S.log(`${label}: craft ${can.v}: bag units ${bag0} -> ${matSum(run2.bagMats)}, hp ${hp0} -> ${run2.hp}, campMods ${JSON.stringify(run2.campMods)}, variant ${run2.weapons.map((w) => w.variant)}`);
  S.check(matSum(run2.bagMats) < bag0, `${label}: crafting took materials from the bag`);
  const after = await S.page.evaluate(() => [...document.querySelectorAll('#overlay [data-a="craft"]')].map((b) => ({ v: b.dataset.v, disabled: b.disabled, why: b.closest('.line')?.querySelector('.short')?.textContent ?? '' })));
  if (run2.craftsLeft === 0) S.check(after.every((c) => c.disabled), `${label}: all craft buttons disabled after the one craft (${after.map((c) => c.why).join(' / ')})`);
  await S.shot(`${label}-crafted`);
  return can.v;
}

export default async function scenarioB() {
  const S = new Session('B-open');
  const page = await S.launch();
  try {
    await S.goto();
    await S.waitScreen((s) => !s.hidden, 5000, 'welcome');
    await S.click('guided', '0');
    let scr = await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');
    S.check(!/Guided start/.test(scr.text), 'no guided card when everything is open');
    await S.shot('town-open');
    await S.click('start');
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    let save = await S.save();
    S.log(`run: feat=${JSON.stringify(save.run.feat)} mutators=${save.run.mutators} key=${save.run.keyLevel}`);

    // wave 1: heat and rich nodes
    const seen = { richOpenSwell: null, richOpenPeak: null, richOpenLull: null, heatMax: 0 };
    let pre = save.run; // the run as saved before the wave being played
    let fell = false;
    let r = await playWaveDesktop(S, {
      gather: true, maxHeat: 20, gatherCrowd: 3, gatherMinHp: 60, maxWeight: 30, shotAt: 18, shotName: 'wave1-swell',
      onTick: async (s) => {
        const rich = s.nodes.filter((n) => n.rich && n.alive);
        if (rich.length) {
          if (s.beat === 'lull') seen.richOpenLull = rich.some((n) => n.open);
          if (s.beat === 'swell' && s.waveT > s.dur * 0.32) seen.richOpenSwell = rich.every((n) => n.open);
          if (s.beat === 'peak' && s.waveT > s.dur * 0.8) seen.richOpenPeak = rich.some((n) => n.open);
        }
        seen.heatMax = Math.max(seen.heatMax, s.heat);
      },
    });
    S.check(r.first.nodes.filter((n) => n.rich).length === 3, `three rich nodes exist (${r.first.nodes.filter((n) => n.rich).length})`);
    S.check(seen.richOpenLull === false, `rich nodes closed in the lull (${seen.richOpenLull})`);
    S.check(seen.richOpenSwell !== false, `rich nodes open in the swell (${seen.richOpenSwell})`);
    S.check(seen.richOpenPeak !== true, `rich nodes closed in the peak (${seen.richOpenPeak})`);
    S.check(seen.heatMax > 0, `heat rose while mining (max ${seen.heatMax.toFixed(0)})`);
    S.log('wave1 events ' + JSON.stringify(r.events.filter((e) => e.node).slice(0, 14)));
    scr = await afterWave(S, r);
    let run = pre;
    let run2;
    fell = /Fell/.test(scr.h1);
    if (!fell) {
    run = await checkTally(S, r, 'w1');
    S.check(Math.abs(run.heat - r.last.heat * 0.5) < 6, `heat carried into camp at half: run.heat=${run.heat.toFixed(1)} last seen ${r.last.heat.toFixed(1)}`);
    await S.click('tallyok');
    scr = await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp');
    await S.shot('camp1');
    S.check(/Camp craft/.test(scr.text) && /Next ground/.test(scr.text) && /If you fall, 20% comes home/.test(scr.text), 'camp shows craft, routes and the loss warning');

    // lock + reroll
    run = (await S.save()).run;
    const lockI = run.shop.findIndex((o) => o.kind === 'weapon') >= 0 ? run.shop.findIndex((o) => o.kind === 'weapon') : 0;
    await S.click('lock', String(lockI));
    run2 = (await S.save()).run;
    const lockText = (await S.probe(S.sel('lock', String(lockI)))).text;
    S.check(run2.shop[lockI].locked === true && lockText === 'Locked', `lock offer ${lockI}: locked=${run2.shop[lockI].locked}, button "${lockText}"`);
    const cost = 2 + run.wave;
    const rr = await S.probe(S.sel('reroll'));
    S.check(rr.text === `Reroll ${cost}`, `reroll button "${rr.text}" (expected cost ${cost})`);
    if (!rr.disabled) {
      await S.click('reroll');
      const run3 = (await S.save()).run;
      S.check(run3.scrap === run2.scrap - cost && run3.rerolls === 1 && run3.shop.length === 4, `reroll: scrap ${run2.scrap} -> ${run3.scrap}, offers ${run3.shop.length}`);
      S.check(JSON.stringify(run3.shop[0]) === JSON.stringify(run2.shop[lockI]), `locked offer survived the reroll (now first): ${JSON.stringify(run3.shop[0])}`);
      S.check((await S.probe(S.sel('reroll'))).text === `Reroll ${cost + 2}`, 'reroll price rises by 2');
      await S.shot('camp1-rerolled');
      await S.click('lock', '0'); // unlock
      S.check((await S.save()).run.shop[0].locked === false, 'unlock works');
    }
    await campShop(S, 'camp1');
    await crafts(S, 'camp1');
    await routes(S, 'camp1', (o) => o.ground === 'grove' && !o.shrine && o.objective !== 'nests');
    await S.shot('camp1-done');
    pre = (await S.save()).run;
    await startWave(S);

    // waves 2-4
    let soldOnce = false;
    let shrineTaken = false;
    for (let w = 2; w <= 4; w++) {
      r = await playWaveDesktop(S, { gather: true, maxHeat: 20, gatherCrowd: 3, gatherMinHp: 60, maxWeight: 30, shotAt: w === 4 ? 10 : 24, shotName: `wave${w}-mid` });
      S.check(r.first.index === w - 1, `wave index ${r.first.index} = ${w - 1}`);
      S.check(Math.abs(r.first.heat - pre.heat) < 8, `wave ${w} starts with carried heat ${pre.heat.toFixed(1)} (seen ${r.first.heat.toFixed(1)})`);
      if (pre.curse) S.log(`wave ${w} played under curse ${pre.curse}`);
      scr = await afterWave(S, r);
      fell = /Fell/.test(scr.h1);
      if (fell) break;
      run = await checkTally(S, r, `w${w}`);
      if (pre.route.shrine) S.check(run.bagSchem.includes(pre.route.shrine.prize), `shrine prize ${pre.route.shrine.prize} is in the bag: ${run.bagSchem}`);
      await S.click('tallyok');
      if (w === 4) break;
      scr = await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp');
      await S.shot(`camp${w}`);
      run = (await S.save()).run;
      if (run.curse) S.check(/Cursed:/.test(scr.text), `camp shows the curse ${run.curse}`);
      await campShop(S, `camp${w}`);
      run = (await S.save()).run;
      if (!soldOnce && run.weapons.length >= 4) {
        const i = run.weapons.length - 1;
        const btn = await S.probe(S.sel('sell', String(i)));
        const price = Number(btn.text.replace(/\D+/g, ''));
        await S.click('sell', String(i));
        run2 = (await S.save()).run;
        S.check(run2.weapons.length === run.weapons.length - 1 && run2.scrap === run.scrap + price, `sold weapon ${i} for ${price}: scrap ${run.scrap} -> ${run2.scrap}`);
        soldOnce = true;
        await campShop(S, `camp${w}-after-sell`);
      }
      await crafts(S, `camp${w}`);
      const route = await routes(S, `camp${w}`, w === 2 ? (o) => (!shrineTaken && o.shrine) || (o.ground === 'marsh' && o.objective !== 'nests') : (o) => o.ground === 'quarry');
      if (route.shrine) shrineTaken = true;
      await S.shot(`camp${w}-done`);
      pre = (await S.save()).run;
      await startWave(S);
      if (route.shrine) {
        const c = (await S.save()).run.curse;
        S.check(c === route.shrine.curse, `leaving camp by a shrine sets the curse ${c}`);
      }
    }

    }
    scr = await S.screen();
    if (/Boss gate/.test(scr.h1)) {
      await S.shot('gate1');
      run = (await S.save()).run;
      fs.writeFileSync(path.join(S.dir, 'save-at-gate1.json'), JSON.stringify(await S.save()));
      S.log(`gate1: ${JSON.stringify(run.gate)} curse=${run.curse} bagSchem=${run.bagSchem}`);
      S.check(run.curse === null, 'the curse ends at the boss gate');
      S.check((await S.probe(S.sel('extract'))).disabled && (await S.probe(S.sel('push'))).disabled, 'Extract and Push on disabled before chest/wild pick');
      const scrap0 = run.scrap;
      if (run.gate.killed) {
        await S.click('chest');
        run2 = (await S.save()).run;
        S.check(run2.scrap === scrap0 + 40 && run2.gate.opened && run2.gate.loot.length >= 2, `chest: scrap ${scrap0} -> ${run2.scrap}, loot ${JSON.stringify(run2.gate.loot)}, bagSchem ${run2.bagSchem}`);
        await S.shot('gate1-chest');
      } else S.log('boss survived: no chest to open');
      const wild = run.gate.wildOffer.find((x) => !['haggler', 'glass', 'stoneback'].includes(x)) ?? run.gate.wildOffer[0];
      await S.click('wild', wild);
      run2 = (await S.save()).run;
      S.check(run2.wilds.includes(wild) && run2.gate.wildDone, `wild pick ${wild} taken`);
      await S.shot('gate1-wild');
      S.check(!(await S.probe(S.sel('push'))).disabled, 'Push on enabled');
      await S.click('push');
      scr = await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp after push');
      run = (await S.save()).run;
      S.check(run.phase === 'camp' && run.wave === 4 && run.gate === null, `pushed on: phase ${run.phase}, next wave index ${run.wave}`);
      S.check(/Next: wave 5 of 12/.test(scr.text), 'camp says next is wave 5');
      await S.shot('camp4-after-push');
      await campShop(S, 'camp4');
      await crafts(S, 'camp4');
      await routes(S, 'camp4', (o) => o.ground === 'marsh');
      pre = (await S.save()).run;
      await startWave(S);
      r = await playWaveDesktop(S, { gather: true, maxHeat: 20, gatherCrowd: 3, gatherMinHp: 60, maxWeight: 30, shotAt: 30, shotName: 'wave5-mid' });
      S.log(`wave5: tier-2 material? gathered ${JSON.stringify(r.last.gathered)}`);
      scr = await afterWave(S, r);
      if (!/Fell/.test(scr.h1)) {
        run = await checkTally(S, r, 'w5');
        await S.click('tallyok');
        await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp5');
        await S.shot('camp5');
        await campShop(S, 'camp5');
        await crafts(S, 'camp5');
        pre = (await S.save()).run;
        await startWave(S);
        // die on purpose: stand in the crowd holding a charge
        r = await playWaveDesktop(S, { suicide: true, shotAt: 25, shotName: 'wave6-dying' });
        scr = await afterWave(S, r);
      }
    }

    // summary after death
    scr = await S.screen();
    await sleep(300);
    await S.shot('summary');
    S.log('summary: ' + scr.text.replace(/\n+/g, ' | '));
    if (/Fell in wave/.test(scr.h1)) {
      const expectedBag = { ...pre.bagMats };
      for (const [id, n] of Object.entries(r.last.gathered)) expectedBag[id] = (expectedBag[id] ?? 0) + n;
      save = await S.save();
      S.log(`bag before the fatal wave ${JSON.stringify(pre.bagMats)} + gathered in it ${JSON.stringify(r.last.gathered)}; bank now ${JSON.stringify(save.bank)}`);
      let total = 0;
      let kept = 0;
      for (const [id, n] of Object.entries(expectedBag)) {
        if (n <= 0) continue;
        const k = Math.round(n * 0.2);
        total += n;
        kept += save.bank[id] ?? 0;
        S.check((save.bank[id] ?? 0) === k, `death keeps a fifth of ${id}: bag ${n} -> bank ${save.bank[id] ?? 0} (expected ${k})`);
      }
      S.log(`death kept ${kept} of ${total} units (${((kept / Math.max(1, total)) * 100).toFixed(0)}%)`);
      S.check(/Lost with the bag/i.test(scr.text), 'summary lists what was lost');
      const waves = pre.totals.wavesCleared;
      S.check(new RegExp(`Fell in wave ${waves + 1}`).test(scr.h1), `title "${scr.h1}" matches ${waves} waves cleared`);
      S.check(scr.text.includes(`${waves * 4} coin`) && save.coin === 40 + waves * 4, `coin paid ${waves * 4}: save coin ${save.coin}`);
      S.check(save.run === null && save.stats.deaths === 1 && save.stats.bestWave === waves, `stats ${JSON.stringify(save.stats)}`);
      S.log(`schematics: bag had ${pre.bagSchem}, kept ${JSON.stringify(save.schematics)}`);
      S.check(save.week.runs === (waves >= 4 ? 1 : 0), `weekly vault counter ${save.week.runs}`);
    }
    await S.click('town');
    scr = await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');
    await S.shot('town-after');
    for (const t of ['Storage', 'Standing', 'Vault', 'Codex']) {
      await S.click('tab', t, { quiet: true });
      await S.shot(`town-after-${t}`);
    }
  } catch (e) {
    S.finding('SCRIPT ABORTED: ' + (e.stack || e));
    await S.shot('abort').catch(() => {});
  }
  await S.close();
}
