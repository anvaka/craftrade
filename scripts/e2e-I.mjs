// Scenario I: route objectives (supply drop, nests) and a shrine curse, entered from an edited camp save and played with real input.
import { Session, playWaveDesktop, sleep, SAVE_KEY, afterWave } from './e2e-lib.mjs';

export default async function scenarioI() {
  const S = new Session('I-objectives');
  const page = await S.launch();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const inject = async (save) => {
    await page.evaluate((k, v) => localStorage.setItem(k, v), SAVE_KEY, JSON.stringify(save));
    await S.goto();
    await S.waitScreen((s) => !s.hidden, 4000, 'town after inject');
    await S.click('continue');
    return S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp');
  };
  try {
    await S.goto();
    await S.waitScreen((s) => !s.hidden, 5000, 'welcome');
    await S.click('guided', '0');
    await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');
    await S.click('start');
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    let r = await playWaveDesktop(S, { gather: true, maxHeat: 10, gatherMinHp: 50 });
    let scr = await afterWave(S, r);
    if (!/cleared/.test(scr.h1)) throw new Error('bot died in wave 1; rerun');
    await S.click('tallyok');
    await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp');
    const camp = await S.save();
    const w = (fam, tier) => ({ fam, tier, gs: 0.5, variant: false, evolved: false, dmg: 0, kills: 0 });
    camp.run.weapons = [w('bow', 2), w('blade', 2), w('fire', 2), w('hammer', 1), w('frost', 1), w('bow', 1)];
    camp.run.hp = 100;
    camp.run.heat = 0;
    camp.run.bagMats = { iron: 6 };
    camp.run.routeOptions = [
      { ground: 'grove', objective: 'supply', elite: null, shrine: null },
      { ground: 'quarry', objective: 'nests', elite: null, shrine: null },
      { ground: 'marsh', objective: 'none', elite: null, shrine: { curse: 'bound', prize: 'p-wpn-pelt' } },
    ];
    camp.run.route = camp.run.routeOptions[0];
    camp.run.routePick = 0;

    // ---- supply drop
    scr = await inject(clone(camp));
    await S.shot('camp-routes');
    S.log('route cards: ' + (scr.text.split('Next ground')[1] ?? '').replace(/\n+/g, ' | ').slice(0, 600));
    await S.click('route', '0');
    let pre = (await S.save()).run;
    await S.click('go');
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    let doneAt = null;
    let shot = false;
    r = await playWaveDesktop(S, {
      gather: false,
      onTick: async (s, { keys }) => {
        const z = s.zones.find((q) => q.kind === 'supply');
        if (s.objective && doneAt === null) doneAt = s.waveT;
        if (!z || s.objective) return;
        const d = Math.hypot(z.x - s.p.x, z.y - s.p.y);
        if (d > 45) await keys.move(z.x - s.p.x, z.y - s.p.y);
        else await keys.release();
        if (d < 45 && !shot) {
          shot = true;
          await S.shot('supply-circle');
          S.log(`standing in the supply circle at waveT ${s.waveT.toFixed(1)}; HUD objective text "${s.objectiveText}"`);
        }
        await sleep(70);
        return 'skip';
      },
    });
    S.check(r.first.specObjective === 'supply' && r.first.zones.some((z) => z.kind === 'supply'), 'supply wave has a marked circle');
    S.check(doneAt !== null, `supply objective completed by standing in the circle (at waveT ${doneAt?.toFixed(1)})`);
    scr = await afterWave(S, r);
    if (/cleared/.test(scr.h1)) {
      S.check(/objective done/.test(scr.text), 'tally says "objective done"');
      await sleep(700);
      await S.shot('tally-objective');
    }

    // ---- nests
    scr = await inject(clone(camp));
    await S.click('route', '1');
    await S.click('go');
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    const seen = { nests: 0, broken: 0, hatchedBrutes: 0, text: '' };
    let nestShot = false;
    r = await playWaveDesktop(S, {
      gather: true, maxHeat: -1, gatherCrowd: 9, gatherMinHp: 25,
      onTick: async (s) => {
        const nests = s.nodes.filter((n) => n.kind === 'nest');
        seen.nests = Math.max(seen.nests, nests.length);
        seen.broken = nests.filter((n) => !n.alive).length;
        if (s.objectiveText) seen.text = s.objectiveText;
        if (nests.length && !nestShot) {
          nestShot = true;
          await S.shot('nests');
        }
      },
    });
    S.log(`nests: seen ${seen.nests}, not alive at the end ${seen.broken}, objective done=${r.last.objective}, HUD text "${seen.text}", swings ${r.swings}`);
    S.check(seen.nests === 3, 'three nests appear in the swell');
    scr = await afterWave(S, r);
    S.log(`nests wave ended on "${scr.h1}"; tally objective line: ${/objective done/.test(scr.text)}`);

    // ---- shrine with the Bound curse
    scr = await inject(clone(camp));
    await S.click('route', '2');
    scr = await S.screen();
    S.check(/Shrine\. Price until the next boss: your last weapon slot is sealed/.test(scr.text) && /Prize: Pattern: Ashfang cleaver/.test(scr.text), 'shrine route card states price and prize');
    await S.shot('camp-shrine-picked');
    pre = (await S.save()).run;
    S.check(pre.curse === null, 'no curse until leaving camp');
    await S.click('go');
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    let run = (await S.save()).run;
    S.check(run.curse === 'bound', `curse applied on leaving camp: ${run.curse}`);
    r = await playWaveDesktop(S, { gather: false, shotAt: 15, shotName: 'wave-bound' });
    S.check(r.first.sealed === 5, `sixth weapon is sealed in the wave (spec.sealed=${r.first.sealed})`);
    scr = await afterWave(S, r);
    if (/cleared/.test(scr.h1)) {
      S.check(/found Pattern: Ashfang cleaver/.test(scr.text), 'tally lists the shrine prize');
      await S.click('tallyok');
      scr = await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp');
      run = (await S.save()).run;
      S.check(run.bagSchem.includes('p-wpn-pelt'), 'prize is in the bag');
      S.check(/Cursed: your last weapon slot is sealed/.test(scr.text) && /Weapons 6\/5/.test(scr.text) && /sealed/.test(scr.text.split('Weapons 6/5')[1] ?? ''), 'camp shows the curse, 6/5 weapons and the sealed weapon');
      S.check(run.routeOptions.every((o) => !o.shrine), 'no second shrine is offered while cursed');
      const dmg = run.last.res.dmgBy;
      S.log(`damage by weapon under Bound: ${dmg.map((d) => Math.round(d))} (index 5 is the sealed one)`);
      S.check(dmg[5] === 0, 'the sealed weapon dealt no damage');
      await S.shot('camp-cursed');
      // buying a weapon with a sealed slot
      const info = await page.evaluate(() => [...document.querySelectorAll('#overlay [data-a="buy"]')].map((b) => ({ v: b.dataset.v, disabled: b.disabled, title: b.title, text: b.textContent })));
      S.log('shop buttons while bound and full: ' + JSON.stringify(info));
    }
  } catch (e) {
    S.finding('SCRIPT ABORTED: ' + (e.stack || e));
    await S.shot('abort').catch(() => {});
  }
  await S.close();
}
