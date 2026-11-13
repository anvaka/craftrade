// Scenario C: the town, with an injected save that has materials.
import { Session, sleep, SAVE_KEY } from './e2e-lib.mjs';

const MATS = ['iron', 'skysteel', 'sunmetal', 'greenwood', 'oldwood', 'heartwood', 'reed', 'silkweed', 'ghostbloom', 'hide', 'sinew', 'bonedust', 'ash', 'shard'];
const PARTS = ['maw', 'plate', 'bile', 'pelt', 'seal', 'heart', 'core'];

export default async function scenarioC() {
  const S = new Session('C-town');
  const page = await S.launch();
  const errs = () => S.problems.filter((p) => !/favicon/.test(p) && !/status of 404/.test(p)).length;
  let errs0 = 0;
  const noNewErrors = (what) => {
    const n = errs();
    S.check(n === errs0, `no console/page errors after ${what}`);
    errs0 = n;
  };
  const note = async () => (await S.screen()).note;
  const tab = async (t) => {
    await S.click('tab', t, { quiet: true });
    const scr = await S.screen();
    S.check(scr.h1 === 'Town', `tab ${t} renders the town`);
    return scr;
  };
  try {
    await S.goto();
    await S.waitScreen((s) => !s.hidden, 5000, 'welcome');
    await S.click('guided', '0');
    await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');
    const base = await S.save();
    S.check(base.guided === false, 'Everything open: guided=false saved');
    // prepared save
    for (const m of MATS) base.bank[m] = 1000;
    for (const m of PARTS) base.bank[m] = 3;
    base.coin = 5000;
    base.schematics = { 'r-var-bow': 2, 'r-quicksilver': 5, 'r-stoneskin': 1, 'p-wpn-pelt': 1, 'p-bag-thorn': 1, 'p-pick-maw': 1, 'b-forge-3': 1, 'b-workshop-3': 1, 'b-apothecary-3': 1 };
    base.stations = { forge: 1, workshop: 1, apothecary: 1 };
    base.standing.pending = 1;
    base.week.runs = 4;
    base.key = 3;
    for (const k of Object.keys(base.skills)) base.skills[k].lvl = 4; // mastery points so that kits unlock
    await page.evaluate((k, v) => localStorage.setItem(k, v), SAVE_KEY, JSON.stringify(base));
    await S.goto();
    let scr = await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town with injected save');
    await S.shot('town-injected');
    S.log('header: ' + scr.text.split('\n').slice(0, 3).join(' | '));
    S.check(/5000 coin/.test(scr.text) && /key level 3/.test(scr.text), 'header shows 5000 coin and key level 3');
    S.check(/Standing •/.test(scr.text) && /Vault •/.test(scr.text), 'Standing and Vault tabs carry a dot');

    for (const t of ['Forge', 'Workshop', 'Apothecary', 'Codex', 'Storage', 'Standing', 'Vault', 'Expedition']) {
      await tab(t);
      await S.shot(`tab-${t}`);
    }
    noNewErrors('visiting every tab');

    // ---------------------------------------------------------------- forge
    await tab('Forge');
    let p0 = await S.save();
    await S.click('fcraft');
    S.check(/Choose 1 perk/.test(await note()), `forge without a perk is refused: "${await note()}"`);
    await S.click('ffam', 'bow');
    await S.click('ftier', '2');
    await S.click('fperk', 'keen');
    await S.click('fcraft');
    S.check(/forge must be tier 3/.test(await note()), `grade II at forge I is refused: "${await note()}"`);
    await S.shot('forge-refused');
    await S.click('ftier', '1');
    await S.click('fcraft');
    let p1 = await S.save();
    S.log('forge note: ' + (await note()));
    S.check(p1.gear.length === p0.gear.length + 1, 'forging adds one gear');
    const made = p1.gear[p1.gear.length - 1];
    S.check(made.kind === 'weapon' && made.fam === 'bow' && made.perks[0] === 'keen' && made.perks.length === 2, `forged ${JSON.stringify(made)}`);
    S.check(made.gs >= 200 + p0.skills.smithing.lvl * 2 && made.gs <= 300, `gear score ${made.gs} within shown range`);
    S.check(p1.bank.iron === p0.bank.iron - 12 && p1.bank.greenwood === p0.bank.greenwood - 6 && p1.coin === p0.coin - 10, `forge cost taken: iron ${p0.bank.iron}->${p1.bank.iron}, greenwood ${p0.bank.greenwood}->${p1.bank.greenwood}, coin ${p0.coin}->${p1.coin}`);
    const harvest = Object.keys(p1.bank).find((k) => !['iron', 'greenwood'].includes(k) && p1.bank[k] === p0.bank[k] - 4);
    S.check(!!harvest, `third forge material taken (4 ${harvest})`);
    scr = await S.screen();
    S.check(scr.text.includes(made.name), `new weapon "${made.name}" listed on the forge tab`);
    await S.shot('forge-made');
    noNewErrors('forging a weapon');
    // every family
    for (const f of ['blade', 'hammer', 'fire', 'frost']) {
      await S.click('ffam', f, { quiet: true });
      const b = await S.save();
      await S.click('fcraft', undefined, { quiet: true });
      const a = await S.save();
      S.check(a.gear.length === b.gear.length + 1 && a.gear[a.gear.length - 1].fam === f, `forged a ${f}: ${a.gear[a.gear.length - 1].name} gs ${a.gear[a.gear.length - 1].gs} perks ${a.gear[a.gear.length - 1].perks}`);
    }

    // tool
    p0 = await S.save();
    await S.click('ttool', 'wood');
    await S.click('ttier', '1');
    await S.click('tcraft');
    p1 = await S.save();
    S.log('tool note: ' + (await note()));
    const tool = p1.gear[p1.gear.length - 1];
    S.check(tool.kind === 'tool' && tool.node === 'wood', `made tool ${JSON.stringify(tool)}`);
    S.check(p1.bank.iron === p0.bank.iron - 8 && p1.bank.greenwood === p0.bank.greenwood - 6 && p1.coin === p0.coin - 8, 'tool cost taken (8 iron, 6 greenwood, 8 coin)');
    await S.click('ttool', 'knife');
    await S.click('tcraft');
    await S.click('ttool', 'herb');
    await S.click('tcraft');
    noNewErrors('making tools');

    // pattern at forge tier 1 (needs tier 2)
    await S.click('pattern', 'p-wpn-pelt');
    S.check(/forge must be tier 2/.test(await note()), `pattern at forge I refused: "${await note()}"`);

    // raise the forge twice (second needs the blueprint)
    p0 = await S.save();
    await S.click('upgrade', 'forge');
    p1 = await S.save();
    S.check(p1.stations.forge === 2, `forge raised to ${p1.stations.forge}; note "${await note()}"`);
    S.check(p1.bank.iron === p0.bank.iron - 30 && p1.bank.greenwood === p0.bank.greenwood - 24 && p1.bank.reed === p0.bank.reed - 16 && p1.coin === p0.coin - 60, `station cost taken, coin ${p0.coin}->${p1.coin}`);
    await S.click('upgrade', 'forge');
    let p2 = await S.save();
    S.check(p2.stations.forge === 3 && !(p2.schematics['b-forge-3'] > 0) && p2.codex.includes('b-forge-3'), `forge raised to ${p2.stations.forge} using the blueprint; codex ${p2.codex}`);
    await S.click('upgrade', 'forge');
    S.check(/Needs Blueprint: Forge IV/.test(await note()), `forge IV without blueprint refused: "${await note()}"`);
    await S.shot('forge-raised');
    // grade II weapon now allowed
    await S.click('ffam', 'blade');
    await S.click('ftier', '2');
    p0 = await S.save();
    await S.click('fcraft');
    p1 = await S.save();
    const sky = p1.gear[p1.gear.length - 1];
    S.check(sky.kind === 'weapon' && sky.gs >= 300 && sky.gs <= 400 && /Skysteel/.test(sky.name), `grade II weapon ${JSON.stringify(sky)}`);
    S.check(p1.coin === p0.coin - 18, `grade II fee with forge II discount: coin ${p0.coin}->${p1.coin} (expected 18)`);
    // pattern
    p0 = await S.save();
    await S.click('pattern', 'p-wpn-pelt');
    p1 = await S.save();
    const named = p1.gear[p1.gear.length - 1];
    S.check(named.name === 'Ashfang cleaver' && !(p1.schematics['p-wpn-pelt'] > 0) && p1.codex.includes('p-wpn-pelt') && p1.bank.pelt === p0.bank.pelt - 1, `pattern made ${JSON.stringify(named)}; note "${await note()}"`);
    await S.click('pattern', 'p-pick-maw');
    await S.shot('forge-pattern');
    noNewErrors('raising the forge and using patterns');

    // --------------------------------------------------------------- workshop
    await tab('Workshop');
    p0 = await S.save();
    await S.click('bcraft', 'sack');
    p1 = await S.save();
    const bag = p1.gear[p1.gear.length - 1];
    S.check(bag.kind === 'bag' && bag.comfort === 20 + p0.skills.outfitting.lvl && !!bag.burden, `made bag ${JSON.stringify(bag)}; note "${await note()}"`);
    S.check(p1.bank.hide === p0.bank.hide - 8 && p1.bank.reed === p0.bank.reed - 6 && p1.coin === p0.coin - 12, 'bag cost taken');
    await S.click('bcraft', 'pack');
    S.check(/workshop must be tier 3/.test(await note()), `pack at workshop I refused: "${await note()}"`);
    await S.click('upgrade', 'workshop');
    await S.click('upgrade', 'workshop');
    p1 = await S.save();
    S.check(p1.stations.workshop === 3, `workshop raised to ${p1.stations.workshop}`);
    await S.click('bcraft', 'pack');
    p2 = await S.save();
    S.check(p2.gear[p2.gear.length - 1].type === 'pack' && p2.bagTypes.includes('pack'), `traveller's pack made: ${JSON.stringify(p2.gear[p2.gear.length - 1])}`);
    await S.click('pattern', 'p-bag-thorn');
    p2 = await S.save();
    S.check(p2.gear[p2.gear.length - 1].name === 'Thornback satchel', `workshop pattern made: ${JSON.stringify(p2.gear[p2.gear.length - 1])}`);
    await S.shot('workshop');
    noNewErrors('workshop');

    // ------------------------------------------------------------- apothecary
    scr = await tab('Apothecary');
    S.check(!/Guard|Thorns/.test(scr.text.split('Reagent book')[1] ?? ''), 'reagent book starts with no known effects');
    const brewBtn = await S.probe(S.sel('brew'));
    S.check(brewBtn.disabled, 'Brew disabled before two reagents are chosen');
    // a pair that shares effects: iron (might, guard, thorns, detonate) + greenwood (guard, thorns, feather, leech)
    await S.click('ra', 'iron');
    await S.click('rb', 'greenwood');
    await S.click('form', 'flask');
    p0 = await S.save();
    await S.click('brew');
    p1 = await S.save();
    S.log('brew note: ' + (await note()));
    S.check(p1.brews['flask:guard+thorns'] === 1, `brew stored: ${JSON.stringify(p1.brews)}`);
    S.check(p1.bank.iron === p0.bank.iron - 2 && p1.bank.greenwood === p0.bank.greenwood - 2, 'two of each reagent used');
    S.check(JSON.stringify(p1.book.iron) === '["guard","thorns"]' && JSON.stringify(p1.book.greenwood) === '["guard","thorns"]', `book updated: ${JSON.stringify(p1.book)}`);
    scr = await S.screen();
    const bookText = scr.text.split('Reagent book')[1] ?? '';
    S.check(/Iron ore\s+Guard\s+Thorns\s+\?\s+\?/.test(bookText), `reagent book shows Guard, Thorns for iron: "${bookText.slice(0, 80).replace(/\n/g, ' ')}"`);
    await S.shot('apothecary-brewed');
    // a pair that shares nothing: iron + reed
    await S.click('rb', 'reed');
    p0 = await S.save();
    await S.click('brew');
    p1 = await S.save();
    S.log('sludge note: ' + (await note()));
    S.check(/share nothing/.test(await note()), 'sludge message shown');
    S.check(p1.bank.iron === p0.bank.iron - 2 && p1.bank.reed === p0.bank.reed - 2, 'sludge still used the reagents');
    S.check(p1.tried.includes('iron+reed'), `failed pair recorded in save.tried: ${JSON.stringify(p1.tried)}`);
    scr = await S.screen();
    const book2 = scr.text.split('Reagent book')[1] ?? '';
    S.check(/iron.*reed|reed.*iron|share nothing|ruled out/i.test(book2.replace(/\n/g, ' ').replace(/Iron ore.*?Marsh reed/, '')), 'reagent book shows the failed pair iron + reed somewhere (so it is not tried twice)');
    await S.shot('apothecary-sludge');
    // same reagent twice
    await S.click('rb', 'iron');
    S.check((await S.probe(S.sel('brew'))).disabled, 'Brew disabled when both reagents are the same');
    // forms gated by tier
    await S.click('rb', 'greenwood');
    await S.click('form', 'charm');
    await S.click('brew');
    S.check(/apothecary must be tier 3/.test(await note()), `charm at apothecary I refused: "${await note()}"`);
    await S.click('upgrade', 'apothecary');
    await S.click('upgrade', 'apothecary');
    p1 = await S.save();
    S.check(p1.stations.apothecary === 3, `apothecary raised to ${p1.stations.apothecary}`);
    await S.click('brew');
    await S.click('form', 'oil');
    await S.click('brew');
    await S.click('form', 'flask');
    await S.click('brew');
    p1 = await S.save();
    S.check(p1.brews['charm:guard+thorns'] === 1 && p1.brews['oil:guard+thorns'] === 1 && p1.brews['flask:guard+thorns'] === 2, `brews: ${JSON.stringify(p1.brews)}`);
    // a three-effect and a volatile brew: sunmetal (might, burn, frenzy, detonate) + ash (burn, frenzy, might, thorns)
    await S.click('ra', 'sunmetal');
    await S.click('rb', 'ash');
    await S.click('brew');
    S.log('volatile brew note: ' + (await note()));
    await S.shot('apothecary-forms');
    noNewErrors('apothecary');

    // ------------------------------------------------------------------ codex
    scr = await tab('Codex');
    await S.shot('codex-before');
    p0 = await S.save();
    await S.click('learn', 'r-var-bow');
    p1 = await S.save();
    S.check(p1.codex.includes('r-var-bow') && p1.schematics['r-var-bow'] === 1, `learned var-bow; note "${await note()}"; copies left ${p1.schematics['r-var-bow']}`);
    S.check(!(await S.has('learn', 'r-var-bow')), 'Learn button gone once learned');
    await S.click('break', 'r-var-bow');
    p1 = await S.save();
    S.check(p1.fragments.elite === 1 && !(p1.schematics['r-var-bow'] > 0), `spare broken into a fragment: ${JSON.stringify(p1.fragments)}`);
    S.check(!(await S.has('break', 'r-quicksilver')), 'an unlearned recipe cannot be broken (no Break button)');
    await S.click('learn', 'r-quicksilver');
    for (let i = 0; i < 4; i++) await S.click('break', 'r-quicksilver', { quiet: true });
    p1 = await S.save();
    S.check(p1.fragments.elite === 5, `five elite fragments: ${JSON.stringify(p1.fragments)}`);
    scr = await S.screen();
    S.check(/Fragments 5\/4/.test(scr.text), 'codex shows Fragments 5/4');
    await S.click('redeem', 'elite');
    p2 = await S.save();
    S.log('redeem note: ' + (await note()));
    const gained = Object.keys(p2.schematics).filter((k) => (p2.schematics[k] ?? 0) > (p1.schematics[k] ?? 0));
    S.check(p2.fragments.elite === 1 && gained.length === 1, `traded four fragments for ${gained}`);
    S.check((await S.probe(S.sel('redeem', 'elite'))).disabled, 'trade button disabled below four fragments');
    await S.click('learn', 'r-stoneskin');
    p2 = await S.save();
    S.log(`codex ${p2.codex.length}: ${p2.codex}`);
    await S.shot('codex-after');
    noNewErrors('codex');

    // --------------------------------------------------------------- standing
    scr = await tab('Standing');
    await S.shot('standing-offer');
    p0 = await S.save();
    S.check(Array.isArray(p0.standing.offer) && p0.standing.offer.length === 3, `card offer saved: ${JSON.stringify(p0.standing.offer)}`);
    const card = p0.standing.offer[0];
    await S.click('card', card);
    p1 = await S.save();
    S.check(p1.standing.cards[card] === 1 && p1.standing.pending === 0 && p1.standing.offer === null, `picked card ${card}: ${JSON.stringify(p1.standing)}`);
    scr = await S.screen();
    S.check(!/Pick one card/.test(scr.text) && !/Standing •/.test(scr.text), 'offer and tab dot gone after picking');
    await S.shot('standing-picked');
    noNewErrors('standing');

    // ------------------------------------------------------------------ vault
    scr = await tab('Vault');
    await S.shot('vault');
    p0 = await S.save();
    S.check((await S.probe(S.sel('vault', '2'))).disabled, 'vault row at 8 is disabled with 4 runs');
    await S.click('vault', '1');
    p1 = await S.save();
    S.check(p1.coin === p0.coin + 80 && p1.week.claimed === true, `vault gave 80 coin: ${p0.coin}->${p1.coin}`);
    S.check((await S.probe(S.sel('vault', '0'))).disabled, 'vault buttons disabled after claiming');
    scr = await S.screen();
    S.check(/Taken for this week/.test(scr.text), 'vault says taken');
    S.check(new RegExp(`${p1.coin} coin`).test(scr.text), 'header coin updated');
    await S.shot('vault-claimed');
    noNewErrors('vault');

    // ---------------------------------------------------------------- storage
    scr = await tab('Storage');
    p1 = await S.save();
    S.check(scr.text.includes(`${p1.bank.iron} Iron ore`), `storage shows ${p1.bank.iron} Iron ore`);
    await S.shot('storage');

    // ------------------------------------------------------------- expedition
    scr = await tab('Expedition');
    p0 = await S.save();
    S.log(`loadout before: ${JSON.stringify(p0.loadout)}`);
    S.check(p0.loadout.keyLevel === 1, 'key level starts at 1 although best is 3');
    await S.click('key', '1');
    await S.click('key', '1');
    await S.click('key', '1');
    p1 = await S.save();
    S.check(p1.loadout.keyLevel === 3, `key + three times stops at best 3: ${p1.loadout.keyLevel}`);
    await S.click('key', '-1');
    p1 = await S.save();
    S.check(p1.loadout.keyLevel === 2, `key - gives 2: ${p1.loadout.keyLevel}`);
    scr = await S.screen();
    S.check(/Danger 2/.test(scr.text) && /danger 2/.test(scr.text), 'Danger 2 shown in the key card and next to Start');
    await S.click('ground', 'marsh');
    // kits: masteryPoints from injected skills
    const kitInfo = await page.evaluate(() => [...document.querySelectorAll('#overlay [data-a="kit"]')].map((b) => ({ v: b.dataset.v, disabled: b.disabled })));
    S.log('kits: ' + JSON.stringify(kitInfo));
    const openKit = kitInfo.filter((k) => !k.disabled && k.v !== 'wayfarer').pop();
    if (openKit) await S.click('kit', openKit.v);
    else S.finding('no kit other than wayfarer unlocked in the injected save, kit choice not exercised');
    // weapons
    const weapons = p1.gear.filter((g) => g.kind === 'weapon');
    const w3 = weapons.find((g) => g.name === 'Ashfang cleaver');
    await S.click('lw', String(w3.uid));
    p1 = await S.save();
    S.check(p1.loadout.weapons.length === 2 && p1.loadout.weapons.includes(w3.uid) && !p1.loadout.weapons.includes(1), `choosing a third weapon drops the oldest: ${p1.loadout.weapons}`);
    await S.click('lw', String(w3.uid));
    scr = await S.screen();
    S.check(/Pick two weapons/.test(scr.text) && (await S.probe(S.sel('start'))).disabled, 'with one weapon, Start is disabled and says "Pick two weapons."');
    await S.shot('expedition-one-weapon');
    const fire = weapons.find((g) => g.fam === 'fire');
    await S.click('lw', String(fire.uid));
    const tools = p1.gear.filter((g) => g.kind === 'tool');
    const sickle = tools.find((g) => g.node === 'herb');
    await S.click('ltool', String(sickle.uid));
    const bags = p1.gear.filter((g) => g.kind === 'bag');
    const pack = bags.find((g) => g.type === 'pack');
    await S.click('lbag', String(pack.uid));
    // recipes
    const recs = await page.evaluate(() => [...document.querySelectorAll('#overlay [data-a="lrec"]')].map((b) => ({ v: b.dataset.v, on: b.classList.contains('on') })));
    S.log('recipes offered: ' + JSON.stringify(recs));
    S.check(recs.some((r) => r.v === 'var-bow') && recs.some((r) => r.v === 'quicksilver') && recs.some((r) => r.v === 'stoneskin'), 'learned recipes appear in the loadout list');
    for (const r of recs.filter((x) => !x.on)) await S.click('lrec', r.v, { quiet: true });
    await S.click('lrec', 'snare');
    p1 = await S.save();
    S.check(!p1.loadout.recipes.includes('snare') && p1.loadout.recipes.includes('var-bow'), `recipes toggled: ${p1.loadout.recipes}`);
    // brews
    const brewKeys = Object.keys(p1.brews).filter((k) => p1.brews[k] > 0);
    S.log('brews held: ' + JSON.stringify(p1.brews));
    for (const k of brewKeys) await S.click('pack', k, { quiet: true });
    p1 = await S.save();
    S.log(`packed: charms ${p1.loadout.charms} oil ${p1.loadout.oil} flasks ${p1.loadout.flasks}`);
    S.check(p1.loadout.charms.length >= 1 && p1.loadout.oil && p1.loadout.flasks.length >= 1, 'a charm, an oil and a flask are packed');
    await S.shot('expedition-packed');
    scr = await S.screen();
    // scrapping gear
    await tab('Forge');
    p0 = await S.save();
    const spare = p0.gear.find((g) => g.kind === 'weapon' && !p0.loadout.weapons.includes(g.uid));
    await S.click('scrapgear', String(spare.uid));
    p1 = await S.save();
    S.check(p1.gear.length === p0.gear.length - 1 && p1.coin === p0.coin + 5, `scrapped ${spare.name}: +5 coin`);
    S.check(!(await S.has('scrapgear', String(p1.loadout.weapons[0]))), 'gear in the loadout has no Scrap button');
    noNewErrors('loadout changes');

    // start: brews consumed, loadout applied
    await tab('Expedition');
    p0 = await S.save();
    await S.shot('expedition-ready');
    await S.click('start');
    await S.waitScreen((s) => s.hidden, 3000, 'arena');
    await sleep(600);
    await S.shot('wave-started');
    p1 = await S.save();
    const run = p1.run;
    S.check(!!run, 'run exists in save after Start');
    if (run) {
      S.log(`run: kit=${run.kit} key=${run.keyLevel} ground=${run.route.ground} tool=${run.toolNode} comfort=${run.comfort} burden=${run.burden} recipes=${run.recipes} charms=${JSON.stringify(run.charms)} oil=${JSON.stringify(run.oil)} flasks=${JSON.stringify(run.flasks)} weapons=${run.weapons.map((w) => w.fam)} abilities=${run.abilities} mutators=${run.mutators}`);
      S.check(run.keyLevel === 2 && run.route.ground === 'marsh' && run.toolNode === 'herb' && run.comfort === pack.comfort, 'run carries key level, ground, tool and bag');
      S.check(!openKit || run.kit === openKit.v, `run carries kit ${openKit?.v}`);
      S.check(run.charms.length === p0.loadout.charms.length && !!run.oil && run.flasks.length === p0.loadout.flasks.length, 'run carries the packed brews');
      for (const k of new Set([...p0.loadout.charms, ...p0.loadout.flasks, p0.loadout.oil])) {
        const used = p0.loadout.charms.filter((x) => x === k).length + p0.loadout.flasks.filter((x) => x === k).length + (p0.loadout.oil === k ? 1 : 0);
        S.check((p1.brews[k] ?? 0) === p0.brews[k] - used, `brew ${k} consumed: ${p0.brews[k]} -> ${p1.brews[k]}`);
      }
      S.check(!run.recipes.includes('snare') && run.recipes.includes('var-bow'), 'run carries the chosen recipes');
    }
    // back out: reload and abandon
    await S.goto();
    scr = await S.waitScreen((s) => /An expedition is under way/.test(s.text), 3000, 'town with run');
    await S.shot('town-run-under-way');
    await S.click('abandon');
    scr = await S.waitScreen((s) => /Fell/.test(s.h1), 3000, 'summary after abandon');
    await S.shot('abandon-summary');
    S.log('abandon summary: ' + scr.text.replace(/\n+/g, ' | '));
    await S.click('town');
    scr = await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town');
    p2 = await S.save();
    S.log(`after abandon: loadout charms ${p2.loadout.charms} oil ${p2.loadout.oil} flasks ${p2.loadout.flasks}; brews ${JSON.stringify(p2.brews)}; stats ${JSON.stringify(p2.stats)}`);
    await S.shot('town-after-abandon');
    noNewErrors('starting and abandoning an expedition');

    // delete save
    await S.click('wipe');
    await sleep(800);
    scr = await S.waitScreen((s) => !s.hidden, 3000, 'welcome after wipe');
    S.check(scr.h1 === 'Craft World' && (await S.save()) === null, 'Delete save returns to the welcome screen with no save');
  } catch (e) {
    S.finding('SCRIPT ABORTED: ' + (e.stack || e));
    await S.shot('abort').catch(() => {});
  }
  await S.close();
}
