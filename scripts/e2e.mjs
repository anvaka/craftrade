// End-to-end QA: node scripts/e2e.mjs A|B|C|D|E|F  (needs `npm run build` and `npx vite preview --port 4181 --strictPort`).
import { Session, playWaveDesktop, parseStatus, sleep, sum, toScreen, Keys, SAVE_KEY, afterWave, checkTally, campShop, startWave, matSum } from './e2e-lib.mjs';

const which = process.argv[2] || 'A';

// ------------------------------------------------------------ scenario A
async function scenarioA() {
  const S = new Session('A-guided');
  const page = await S.launch();
  try {
    await S.goto();
    let scr = await S.waitScreen((s) => !s.hidden, 5000, 'welcome');
    S.check(scr.h1 === 'Craft World', `welcome screen h1 "${scr.h1}"`);
    S.check((await S.save()) === null, 'nothing saved before a choice is made');
    await S.shot('welcome');
    await S.click('guided', '1');
    scr = await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');
    await S.shot('town-guided');
    S.check(/Guided start, expedition 1 of 3/.test(scr.text), 'town shows guided card 1 of 3');
    let save = await S.save();
    S.check(save && save.guided === true, 'save written with guided=true');
    // every tab renders without error for a brand-new player
    for (const t of ['Forge', 'Workshop', 'Apothecary', 'Codex', 'Storage', 'Standing', 'Vault', 'Expedition']) {
      await S.click('tab', t, { quiet: true });
      await S.shot(`town-new-${t}`);
    }

    await S.click('start');
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    await sleep(700);
    await S.shot('wave1-start');

    // wave 1: mine with real mouse, move with real keys
    let spaceTried = false;
    let r = await playWaveDesktop(S, {
      gather: true, shotAt: 14, shotName: 'wave1-mid',
      onTick: async (s) => {
        if (!spaceTried && s.waveT > 3) {
          spaceTried = true;
          const x0 = s.p.x;
          await page.keyboard.down('KeyD');
          await page.keyboard.press('Space');
          await sleep(60);
          const z = await S.state();
          await page.keyboard.up('KeyD');
          S.check(z.p.dodgeT <= 0, `guided expedition 1: Space does not dodge (dodgeT=${z.p.dodgeT}, feat.dodge=${s.feat.dodge}); moved ${Math.round(z.p.x - x0)}`);
        }
      },
    });
    S.check(r.first.feat.heat === true && r.first.feat.dodge === true && r.first.feat.gates === false, 'guided expedition 1 has heat and dodge on, and stops at the first boss');
    S.check(r.first.nodes.length === 9 && r.first.nodes.filter((n) => n.rich).length === 3, `wave 1 has six common and three rich nodes (${r.first.nodes.length})`);
    S.check(r.nodeSwings > 0, `bot swung at nodes ${r.nodeSwings} times`);
    S.check(matSum(r.last.gathered) > 0, `material collected in wave 1: ${JSON.stringify(r.last.gathered)}`);
    S.log('wave1 events ' + JSON.stringify(r.events.slice(0, 12)));
    scr = await afterWave(S, r);
    S.check(/Wave 1 cleared/.test(scr.h1), `tally h1 "${scr.h1}"`);
    let run = await checkTally(S, r, 'w1');
    await S.click('tallyok');
    scr = await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp');
    await S.shot('camp1');
    S.check(/Nothing is lost on this expedition/.test(scr.text), 'camp says nothing is lost (guided 1)');
    S.check(!/Camp craft/.test(scr.text) && !/Next ground/.test(scr.text), 'camp craft and routes hidden in guided 1');
    const bought = await campShop(S, 'camp1');
    S.log(`camp1 bought ${bought}`);
    await S.shot('camp1-after-buy');

    // reload at camp, mid-run
    const before = (await S.save()).run;
    await S.goto();
    scr = await S.waitScreen((s) => !s.hidden, 5000, 'town after reload');
    await S.shot('reload-town');
    S.check(/An expedition is under way/.test(scr.text), 'after reload the town offers Continue');
    await S.click('continue');
    scr = await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp after continue');
    const after = (await S.save()).run;
    S.check(JSON.stringify(before) === JSON.stringify(after), 'run state identical after reload + Continue');
    await S.shot('reload-camp');

    // wave 2, with a reload in the middle of the wave
    await startWave(S);
    await sleep(6000);
    await S.attach();
    const mid = await S.state();
    S.log(`mid-wave before reload: waveT=${mid.waveT.toFixed(1)} hp=${mid.p.hp}`);
    await S.goto();
    scr = await S.waitScreen((s) => !s.hidden, 5000, 'town after mid-wave reload');
    S.check(/An expedition is under way/.test(scr.text), 'mid-wave reload: town offers Continue');
    await S.shot('reload-midwave-town');
    await S.click('continue');
    await S.waitScreen((s) => s.hidden, 3000, 'arena after mid-wave continue');
    await S.attach();
    const again = await S.state();
    S.log(`after mid-wave reload + Continue: wave index ${again.index}, waveT=${again.waveT.toFixed(1)}, hp=${again.p.hp} (wave restarts from zero)`);

    for (let w = 2; w <= 4; w++) {
      r = await playWaveDesktop(S, { gather: true, shotAt: w === 4 ? 12 : 20, shotName: `wave${w}-mid` });
      scr = await afterWave(S, r);
      if (/Fell/.test(scr.h1)) {
        S.log(`bot died in wave ${w}`);
        break;
      }
      run = await checkTally(S, r, `w${w}`);
      await S.click('tallyok');
      if (w < 4) {
        scr = await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp');
        await S.shot(`camp${w}`);
        await campShop(S, `camp${w}`);
        await startWave(S);
      }
    }
    scr = await S.screen();
    if (/Boss gate/.test(scr.h1)) {
      await S.shot('gate-guided');
      S.check(/The expedition ends here/.test(scr.text), 'guided gate: "The expedition ends here"');
      S.check(!(await S.has('push')), 'guided gate has no Push on button');
      run = (await S.save()).run;
      S.log(`gate: killed=${run.gate.killed} final=${run.gate.final} wildOffer=${run.gate.wildOffer}`);
      const ex = await S.probe(S.sel('extract'));
      S.check(ex.disabled, 'Return to town disabled until chest and wild pick are dealt with');
      if (run.gate.killed) {
        await S.click('chest');
        await S.shot('gate-chest');
      }
      await S.click('wild', run.gate.wildOffer[0]);
      await S.shot('gate-wild');
      const bag = (await S.save()).run.bagMats;
      const bank0 = (await S.save()).bank;
      await S.click('extract');
      scr = await S.waitScreen((s) => /Extracted|Full clear|Fell/.test(s.h1), 3000, 'summary');
      await S.shot('summary');
      S.log('summary: ' + scr.text.replace(/\n+/g, ' | '));
      save = await S.save();
      for (const [id, n] of Object.entries(bag)) if (n > 0) S.check((save.bank[id] ?? 0) === (bank0[id] ?? 0) + n, `banked ${id}: ${save.bank[id]} = ${bank0[id] ?? 0} + ${n}`);
      S.check(save.run === null, 'run cleared from save after summary');
      S.check(save.sessions === 1 && save.stats.runs === 1, `sessions=${save.sessions} runs=${save.stats.runs}`);
    } else {
      await S.shot('summary-death');
      S.log('summary: ' + scr.text.replace(/\n+/g, ' | '));
    }
    await S.click('town');
    scr = await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town after run');
    await S.shot('town-after');
    S.check(/expedition 2 of 3/.test(scr.text), 'town shows guided expedition 2 of 3');
    await S.click('tab', 'Storage');
    await S.shot('town-storage');
    await S.click('tab', 'Standing');
    await S.shot('town-standing');
    // reload once more: town persists
    await S.goto();
    scr = await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town after final reload');
    S.check(/expedition 2 of 3/.test(scr.text), 'after reload still guided expedition 2 of 3');
  } catch (e) {
    S.finding('SCRIPT ABORTED: ' + (e.stack || e));
    await S.shot('abort').catch(() => {});
  }
  await S.close();
}

const scenarios = {
  A: scenarioA,
  B: async () => (await import('./e2e-B.mjs')).default(),
  C: async () => (await import('./e2e-C.mjs')).default(),
  D: async () => (await import('./e2e-D.mjs')).default(),
  E: async () => (await import('./e2e-E.mjs')).default(),
  F: async () => (await import('./e2e-F.mjs')).default(),
  G: async () => (await import('./e2e-G.mjs')).default(),
  H: async () => (await import('./e2e-H.mjs')).default(),
  I: async () => (await import('./e2e-I.mjs')).default(),
  J: async () => (await import('./e2e-J.mjs')).default(),
  K: async () => (await import('./e2e-K.mjs')).default(),
};
if (scenarios[which]) await scenarios[which]();
else console.error('unknown scenario ' + which);
