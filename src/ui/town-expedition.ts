// The Expedition tab: as what, where, how dangerous, and the one button that starts it.
import { CFG, ELITES, GROUNDS, GROUND_IDS, KITS, MUTATORS, NODE_MAT, TOOLS, WEAPONS, weekMutators, weekNumber, type GearWeapon, type Ground, type NodeKind } from '../data';
import * as M from '../meta';
import * as R from '../run';
import { tabOpen, type Page, type UI } from './app';
import * as I from './icons';
import { emptyTile, esc, ic, note, tile, ui as uiIcon } from './kit';
import { describe, describeMat, type Desc } from './things';

/** Time until the week turns over (the same clock as `weekNumber`). */
export function weekLeft(now = Date.now()): string {
  const days = 7 - ((now / 86400000 + 3) % 7);
  const d = Math.floor(days);
  const h = Math.floor((days - d) * 24);
  if (d > 0) return `${d} day${d === 1 ? '' : 's'}${h > 0 ? ` ${h} h` : ''}`;
  return h > 0 ? `${h} hour${h === 1 ? '' : 's'}` : 'under an hour';
}
const pct = (x: number) => `${Math.round(x * 100)}%`;
/** A tile that is not a button, for use inside a card that is one. */
const tileSpan = (d: Desc, size = 'sm') => `<span class="tile ${size} static r${d.rarity}" data-tip="${esc(d.ref)}">${d.icon}</span>`;
const keepShare = (p: M.Profile) => Math.min(1, CFG.keptOnDeath + 0.08 * (p.standing.cards.keep ?? 0));

// ------------------------------------------------------------------ pieces
const NODE_WORD: Record<NodeKind, string> = { ore: 'ore veins', wood: 'trees', herb: 'reeds' };
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function guideCard(p: M.Profile): string {
  if (!p.guided || p.sessions >= M.GUIDE_STEPS) return '';
  const n = p.sessions + 1;
  // a step is passed only by clearing the fourth wave, so the same step can come round again
  const retry = p.stats.runs > p.sessions;
  const rule = n === 1 && retry
    ? `Expedition ${n} again: survive the fourth wave, the boss wave, to move on. The boss need not die.`
    : `Expedition ${n}: survive the fourth wave, the boss wave, to move on (the boss need not die). Until then this step repeats.`;
  return `<div class="guide"><div class="step">${n}<small>/${M.GUIDE_STEPS}</small></div><div class="grow">
    <b>Guided start, expedition ${n} of ${M.GUIDE_STEPS}</b>
    ${retry ? `<p class="gold" style="margin:4px 0 0">${rule}</p>` : ''}
    <p style="margin:4px 0 8px">${M.GUIDE_TEXT[p.sessions]}</p>
    <div class="row"><button class="sm ghost" data-a="openall">Open everything now</button><span class="dim small">Skips the guided start: all twelve waves, routes, schematics and danger levels at once.</span></div></div></div>`;
}

function kitPanel(ui: UI): string {
  const p = ui.p;
  const rank = M.masteryRank(p);
  const early = !tabOpen(p, 'Character'); // the first guided expedition: mastery has not been introduced yet
  const later = KITS.filter((k) => k.rank > rank).length;
  const craftOpen = M.featFor(p).craft; // the guided start holds camp craft back, so a kit card must not promise one
  const cards = KITS.filter((k) => !early || k.rank <= rank).map((k) => {
    const locked = k.rank > rank;
    const on = p.loadout.kit === k.id;
    const state = locked
      ? `<span class="why">${uiIcon('lock')} ${plural(k.rank - rank, 'more mastery rank')} (opens at rank ${k.rank})</span>`
      : p.kitBest[k.id] ? `<span class="dim small">Best full clear: danger ${p.kitBest[k.id]}</span>` : '';
    return `<button type="button" class="pickc${on ? ' on' : ''}" data-a="kit" data-v="${k.id}" aria-pressed="${on}" ${locked ? 'disabled' : ''}>
      <span class="pc-h">${ic(I.uiIcon(locked ? 'lock' : 'equip'))}<b>${k.name}</b>${on ? `<span class="mark">${uiIcon('check')} Chosen</span>` : ''}</span>
      <span class="pc-t">${craftOpen ? k.text : k.text.replace(/,?\s*one camp craft/i, '') /* camp craft is not open yet in the guided start */}</span>${state}</button>`;
  }).join('');
  return `<section class="panel"><h2>Kit</h2>
    <p class="dim small">A kit is a rule that holds for the whole expedition. ${early ? (later ? `${later} more kits open later, as your weapon and trade skills level up.` : '') : `Pick one.${later ? ` Locked kits open with mastery rank (yours is ${rank}), which rises as your weapon and trade skills level up.</p><p class="small"><button class="link pad" data-a="goto" data-v="Character" data-w="Mastery">See what feeds mastery rank</button>` : ''}`}</p>
    ${craftOpen ? '' : '<p class="dim small">Camp crafts are not open yet: they come with the third guided expedition.</p>'}
    <div class="picks">${cards}</div></section>`;
}

function groundPanel(ui: UI): string {
  const p = ui.p;
  const l = p.loadout;
  const feat = M.featFor(p);
  const tool = M.gearBy(p, l.tool);
  const nodeTool = tool?.kind === 'tool' && tool.node !== 'knife' ? tool : null;
  // swings to break a node, as the arena counts them: the right tool and the kit each add a stage to every swing
  const strike = KITS.find((k) => k.id === l.kit)?.strike ?? 0;
  const swings = (rich: boolean, fits: boolean) => Math.ceil(CFG.nodes[rich ? 'rich' : 'common'].drops.length / (1 + (fits ? 1 : 0) + strike));
  const fewer = (rich: boolean, what: string) => (swings(rich, false) === swings(rich, true) ? `${what} stay at ${swings(rich, true)}` : `${what} ${swings(rich, false)} → ${swings(rich, true)}`);
  const saved = `${fewer(false, 'common nodes')}, ${fewer(true, 'rich veins')}`;
  const cards = GROUND_IDS.map((g) => {
    const gd = GROUNDS[g];
    const on = l.ground === g;
    const mats = NODE_MAT[gd.node].slice(0, feat.gates ? 3 : 1).map((id) => describeMat(id, ui.ctx));
    const cut = gd.text.indexOf('. ');
    const enemy = cut > 0 ? gd.text.slice(cut + 2) : gd.text;
    const elites = feat.routes ? ELITES.filter((e) => e.ground === g) : [];
    const right = TOOLS[gd.node].name.toLowerCase();
    // owning the right tool but not packing it is a different problem from not having one
    const owned = p.gear.some((x) => x.kind === 'tool' && x.node === gd.node);
    const fix = owned ? `You own a ${right}: pack it in the Inventory to cut the swings here.` : `A ${right} would cut the swings here (${saved}).`;
    let fit: string;
    if (nodeTool && nodeTool.node === gd.node) fit = `<span class="small ok">${uiIcon('check')} Your ${nodeTool.name.toLowerCase()} cuts the swings here: ${saved}</span>`;
    else if (nodeTool) fit = `<span class="small ${on ? 'warn' : 'dim'}">Your ${nodeTool.name.toLowerCase()} cuts swings on ${NODE_WORD[nodeTool.node as NodeKind]}; the ${gd.name} has ${NODE_WORD[gd.node]}. ${fix}</span>`;
    else fit = `<span class="small ${on ? 'warn' : 'dim'}">No ${right} packed: nodes here take the full number of swings.${owned ? ` You own one: pack it in the Inventory.` : ''}</span>`;
    return `<button type="button" class="pickc ground${on ? ' on' : ''}" data-a="ground" data-v="${g}" aria-pressed="${on}">
      <span class="pc-h"><span class="gi">${I.groundIcon(g)}</span><b>${gd.name}</b>${on ? `<span class="mark">${uiIcon('check')} Chosen</span>` : ''}</span>
      <span class="depths">${mats.map((m, i) => `<span class="depth">${tileSpan(m)}${feat.gates ? `<small>waves ${i * 4 + 1}–${i * 4 + 4}</small>` : ''}</span>`).join('')}</span>
      <span class="small"><span class="dim">You gather</span> ${mats.map((m) => `<b>${m.name}</b>`).join(', then ')}${feat.gates ? ' <span class="dim">(a better grade past each boss)</span>' : ''}</span>
      <span class="pc-l"><span class="ei">${I.enemyIcon(gd.lean)}</span><span class="small">${enemy}</span></span>
      ${elites.length ? `<span class="small"><span class="dim">Named elites here:</span> ${elites.map((e) => `<b data-tip="mat:${e.part}">${e.name}</b>`).join(', ')}</span>` : ''}
      ${fit}</button>`;
  }).join('');
  return `<section class="panel"><h2>First ground</h2>
    <p class="dim small">${feat.routes ? 'Where the first wave is fought. This is only the start: after every wave you choose the next ground at camp, and the other grounds are on offer there.' : 'Where the expedition is fought.'}</p>
    <div class="picks three">${cards}</div></section>`;
}

function dangerPanel(ui: UI): string {
  const p = ui.p;
  const l = p.loadout;
  const lv = Math.max(1, Math.min(p.key, l.keyLevel));
  const k = CFG.key;
  const n = lv - 1;
  // every level while there are few; otherwise three around the chosen one, and always the highest allowed
  const from = p.key <= 5 ? 1 : Math.max(1, Math.min(lv - 1, p.key - 3));
  const to = p.key <= 5 ? p.key : from + 2;
  const rung = (i: number) => `<button type="button" class="rung${i === lv ? ' on' : ''}" data-a="keyset" data-v="${i}" aria-pressed="${i === lv}" aria-label="Danger ${i}${i === p.key ? ', the highest your key allows' : ''}">${i}${i === p.key ? `<small>key</small>` : ''}</button>`;
  const rungs: string[] = [];
  for (let i = from; i <= to; i++) rungs.push(rung(i));
  if (to < p.key) rungs.push(to < p.key - 1 ? '<span class="dim">…</span>' : '', rung(p.key));
  const quota = M.keyQuota(p.key);
  const changes: [string, string][] = [
    ['Enemy health', `+${pct(k.hp * n)}`], ['Enemy damage', `+${pct(k.dmg * n)}`], ['Enemies arriving', `+${pct(k.rate * n)}`],
    ['Node yield', `+${pct(k.yield * n)}`], ['Coin for waves cleared', `+${pct(0.25 * n)}`],
  ];
  const muts = weekMutators(weekNumber());
  return `<section class="panel"><h2>Danger</h2>
    <p class="dim small">Danger is how hard the expedition is. Your key allows danger <b>${p.key > 1 ? `1 to ${p.key}` : '1 only'}</b>.</p>
    <div class="ladder" role="group" aria-label="Danger">
      <button type="button" class="rung step" data-a="key" data-v="-1" ${lv <= 1 ? 'disabled' : ''} aria-label="Lower the danger">−</button>
      ${from > 1 ? '<span class="dim">…</span>' : ''}${rungs.join('')}
      <span class="rung shut" aria-label="Danger ${p.key + 1}, locked">${ic(I.uiIcon('lock'))}<small>${p.key + 1}</small></span>
      <button type="button" class="rung step" data-a="key" data-v="1" ${lv >= p.key ? 'disabled' : ''} aria-label="Raise the danger">+</button>
    </div>
    <p class="small ${lv < p.key ? 'warn' : 'dim'}">${lv < p.key
      ? `At danger ${lv} this expedition cannot raise the key. Only danger ${p.key} can.`
      : `Danger ${p.key} is the highest your key allows, so + does nothing. Danger ${p.key + 1} opens when the key rises.`}</p>
    <h4>What danger ${lv} changes</h4>
    ${n === 0 ? '<p class="small">Nothing: danger 1 is the base.</p>' : changes.map(([a, b]) => `<div class="kv small"><span class="dim">${a}</span><span>${b}</span></div>`).join('')}
    <p class="dim small" style="margin-top:6px">Every danger above 1 adds: enemies +${pct(k.hp)} health, +${pct(k.dmg)} damage, +${pct(k.rate)} numbers; nodes +${pct(k.yield)} yield; +25% coin.</p>
    <h4>To raise the key (it would allow danger ${p.key + 1})</h4>
    <ul class="todo small"><li>Set danger ${p.key}${lv < p.key ? ` <span class="warn">(you have set ${lv})</span>` : ` ${uiIcon('check')}`}</li><li>Clear all twelve waves</li><li>Kill all three bosses</li><li>Bring home ${quota} ore, wood or herbs in total</li></ul>
    <p class="dim small">The key never falls. A full clear with all three bosses dead pays a standing card each time it beats that kit's highest danger so far.</p>
    <h4>This week's rules</h4>
    <p class="dim small">Two rules change every Monday and hold on every expedition at any danger. They change in ${weekLeft()}.</p>
    ${muts.map((m) => `<div class="mut"><span class="chip" data-tip="mut:${m}">${ic(I.uiIcon('skull'))}${MUTATORS[m].name}</span><span class="small">${MUTATORS[m].text}</span></div>`).join('')}</section>`;
}

function racePanel(p: M.Profile): string {
  return `<section class="panel"><h2>Weekly race</h2>
    <p class="dim small">Every run this week starts from the same seed, so the waves are drawn the same way; the shops and the routes on offer diverge with your choices. Danger 3, the Wayfarer kit and starter gear, no town bonuses. Nothing is banked or paid, nothing is lost and no brews are used. Rank is deepest wave, then time.</p>
    <div class="row"><button data-a="race">Run the race</button><span class="small">${p.race.waves ? `Your best this week: <b>${p.race.waves} waves</b> in <b>${p.race.time} s</b>` : '<span class="dim">No run yet this week</span>'}</span></div></section>`;
}

/** The brews that leave town with the loadout and are used up, as words: "1 charm, 2 flasks". */
function brewsUsed(p: M.Profile): string {
  const l = p.loadout;
  const left = { ...p.brews };
  const take = (key: string | null) => (key && left[key] > 0 ? (left[key]--, 1) : 0);
  const charms = l.charms.slice(0, 2).reduce((a, k) => a + take(k), 0);
  const oil = take(l.oil);
  const flasks = l.flasks.slice(0, M.flaskSlots(p)).reduce((a, k) => a + take(k), 0);
  return [charms ? plural(charms, 'charm') : '', oil ? '1 oil' : '', flasks ? plural(flasks, 'flask') : ''].filter(Boolean).join(', ');
}

function loadoutPanel(ui: UI): string {
  const p = ui.p;
  const l = p.loadout;
  const problem = M.loadoutProblem(p);
  const feat = M.featFor(p);
  const canChange = tabOpen(p, 'Inventory');
  const gearRow = (label: string, uid: number | undefined, emptyIcon: string, emptyText: string) => {
    const g = uid !== undefined ? M.gearBy(p, uid) : undefined;
    if (!g) return `<div class="item">${emptyTile(emptyIcon, `${label}: empty`, canChange ? 'goto' : undefined, 'Inventory', 'sm')}<div class="grow"><div class="sub">${label}</div><div class="dim">${emptyText}</div></div></div>`;
    const d = describe(`gear:${g.uid}`, ui.ctx);
    const extra = g.kind === 'weapon' ? `Gear score ${g.gs}${feat.ability ? ` · ability: ${WEAPONS[g.fam].ability.name}` : ''}`
      : g.kind === 'bag' ? `Carries ${g.comfort} weight before slowing` : g.node === 'knife' ? 'Kills leave more' : `Fewer swings on ${NODE_WORD[g.node]}`;
    return `<div class="item">${tile(d, { size: 'sm' })}<div class="grow"><div class="sub">${label}</div><div class="nm r${d.rarity}">${d.name}</div><div class="sub"${g.kind === 'weapon' ? ` data-tip="text:Gear score runs from 200 to 500. It strengthens the weapon's perks from ×1.0 to ×1.5."` : ''}>${extra}</div></div></div>`;
  };
  const brew = (key: string | null | undefined, form: string) => (key ? tile(describe(`brew:${key}`, ui.ctx), { size: 'sm' }) : emptyTile(I.brewIcon(form as 'flask'), `Empty ${form} slot`, canChange ? 'goto' : undefined, 'Inventory', 'sm'));
  const flasks = Array.from({ length: M.flaskSlots(p) }, (_, i) => brew(l.flasks[i], 'flask')).join('');
  const known = M.knownRecipes(p);
  const recipes = l.recipes.filter((r) => known.includes(r));
  const w = l.weapons.map((u) => M.gearBy(p, u)).filter((g): g is GearWeapon => g?.kind === 'weapon');
  const twin = feat.ability && w.length === 2 && w[0].fam === w[1].fam;
  const used = brewsUsed(p);
  return `<section class="panel"><h2>Loadout</h2>
    ${problem ? note(`${uiIcon('cross')} ${problem}`, true) : ''}
    <div class="lo-gear">${gearRow('Weapon 1', l.weapons[0], I.weaponIcon('blade'), 'None. Two weapons are needed.')}
    ${gearRow('Weapon 2', l.weapons[1], I.weaponIcon('bow'), 'None. Two weapons are needed.')}
    ${gearRow('Tool', l.tool, I.toolIcon('ore'), 'None. Nodes take the full number of swings.')}
    ${gearRow('Bag', l.bag, I.bagIcon('sack'), 'None. A bag is needed.')}</div>
    ${twin ? `<p class="warn small" style="margin:6px 0 0">Both weapons are a ${WEAPONS[w[0].fam].name.toLowerCase()}: you get one ability (${WEAPONS[w[0].fam].ability.name}), not two. A second family adds a second ability.</p>` : ''}
    ${feat.craft ? `<div class="lo-brews"><div><div class="lo-lab">Charms</div><div class="tiles">${brew(l.charms[0], 'charm')}${brew(l.charms[1], 'charm')}</div></div>
      <div><div class="lo-lab">Oil</div><div class="tiles">${brew(l.oil, 'oil')}</div></div>
      <div><div class="lo-lab">Flasks</div><div class="tiles">${flasks}</div></div></div>
    <div class="lo-lab" style="margin-top:10px">Recipes ${recipes.length} of ${M.recipeSlots(p)}</div>
    <div class="tiles">${recipes.map((r) => tile(describe(`recipe:${r}`, ui.ctx), { size: 'sm' })).join('') || '<span class="dim small">None packed.</span>'}</div>` : ''}
    <p class="dim small" style="margin:8px 0">${feat.ability ? 'The two weapons set your two abilities and start at tier I; the expedition supplies the power.' : 'Both weapons fire on their own and start at tier I; the expedition supplies the power.'}${feat.craft ? ` Packed brews are used up when you leave${used ? `: this loadout uses ${used}` : ''}.` : ''}</p>
    ${canChange ? '<button class="big" data-a="goto" data-v="Inventory">Change loadout</button>' : ''}</section>`;
}

function underWay(ui: UI, run: R.RunState): Page {
  const p = ui.p;
  const lost = run.phase === 'wave';
  const kit = KITS.find((k) => k.id === run.kit);
  const mats = Object.entries(run.bagMats).filter(([, n]) => n > 0);
  const rows: [string, string][] = [
    ['Wave', `${Math.min(run.wave + 1, R.runWaves(run))} of ${R.runWaves(run)}`],
    ['Kit', kit?.name ?? run.kit],
    ['Danger', String(run.keyLevel)],
    ['Health', String(Math.max(0, Math.round(run.hp)))],
    ['Scrap', String(run.scrap)],
  ];
  const body = `<section class="panel" style="max-width:640px;margin:0 auto"><h2>${run.race ? 'The weekly race is under way' : 'An expedition is under way'}</h2>
    ${lost ? note('You left in the middle of a wave. That counts as a fall, and what you gathered in that wave is forfeited.', true) : `<p>It is waiting at ${run.phase === 'gate' ? 'the boss gate' : run.phase === 'tally' ? 'the tally after its last wave' : 'camp'}, saved where you left it.</p>`}
    ${rows.map(([a, b]) => `<div class="kv"><span class="dim">${a}</span><span class="num">${b}</span></div>`).join('')}
    <h4>In the bag</h4>
    <div class="tiles">${mats.map(([id, n]) => tile(describeMat(id, ui.ctx, n), { size: 'sm', qty: n, round: true })).join('') || '<span class="dim small">Nothing yet.</span>'}</div>
    ${run.bagSchem.length ? `<p class="small" style="margin-top:8px">${run.bagSchem.length} schematic${run.bagSchem.length === 1 ? '' : 's'} in the bag.</p>` : ''}
    ${lost ? '' : `<p class="dim small" style="margin-top:12px">${run.race ? 'The race banks nothing and loses nothing.' : run.feat.loss ? `Abandoning counts as a fall: you keep about ${pct(keepShare(p))} of the bag.` : 'Abandoning counts as a fall, but nothing is lost on this expedition.'}</p>`}</section>`;
  const foot = `${lost ? '' : '<button class="danger tap" data-a="abandon">Abandon</button>'}<button class="pri exp-go" data-a="continue" data-key="Enter">${lost ? 'See what came home' : 'Continue the expedition'} <span class="kc">Enter</span></button>`;
  return { body, foot };
}

// -------------------------------------------------------------------- page
export function view(ui: UI): Page {
  const p = ui.p;
  if (p.run) return underWay(ui, p.run);
  const l = p.loadout;
  const feat = M.featFor(p);
  const problem = M.loadoutProblem(p);
  const kit = KITS.find((k) => k.id === l.kit);
  const waves = feat.gates ? CFG.waveDur.length : CFG.wavesPerSegment;
  const body = `<div class="prog">${guideCard(p)}
    <div class="exp"><div class="stack">${kitPanel(ui)}${groundPanel(ui)}</div>
      <div class="stack">${loadoutPanel(ui)}${feat.schem ? dangerPanel(ui) + racePanel(p) : ''}</div></div></div>`;
  const summary = [kit?.name ?? 'No kit', GROUNDS[l.ground].name, ...(feat.schem ? [`danger ${Math.max(1, Math.min(p.key, l.keyLevel))}`] : []), `${waves} waves${feat.gates ? ', a boss every fourth' : ', the last a boss wave'}`];
  const used = feat.craft ? brewsUsed(p) : '';
  const foot = `<span class="small sumline">${summary.join(' · ')}<br><span class="dim">Once you leave, turning back counts as a fall${feat.loss ? '' : ' (the bag still comes home whole on this one)'}, and leaving in the middle of a wave forfeits what that wave gathered.</span>${used ? ` <span class="warn">Uses up ${used}.</span>` : ''}</span>
    ${problem && tabOpen(p, 'Inventory') ? '<button class="tap" data-a="goto" data-v="Inventory">Change loadout</button>' : ''}
    <button class="pri exp-go" data-a="start" data-key="Enter" ${problem ? 'disabled' : ''}>${problem ? `Cannot leave: ${problem}` : 'Begin expedition <span class="kc">Enter</span>'}</button>`;
  return { body, foot };
}

export function act(ui: UI, a: string, v: string, _w: string): boolean | 'leave' | void {
  const p = ui.p;
  const l = p.loadout;
  const snd = ui.hooks.sound;
  switch (a) {
    case 'kit': {
      const k = KITS.find((x) => x.id === v);
      if (!k) return true;
      if (k.rank > M.masteryRank(p)) {
        ui.fail(`${k.name} needs mastery rank ${k.rank}.`);
        return true;
      }
      l.kit = k.id;
      snd.ui('click');
      return true;
    }
    case 'ground':
      if (GROUND_IDS.includes(v as Ground)) {
        l.ground = v as Ground;
        snd.ui('click');
      }
      return true;
    case 'key':
    case 'keyset': {
      const want = a === 'key' ? l.keyLevel + Number(v) : Number(v);
      const next = Math.max(1, Math.min(p.key, want || 1));
      if (want > p.key) ui.fail(`Your key allows danger ${p.key > 1 ? `1 to ${p.key}` : '1 only'}. Danger ${want} opens when the key rises.`);
      else snd.ui('click');
      l.keyLevel = next;
      return true;
    }
    case 'start': {
      if (p.run) return true;
      if (ui.fail(M.loadoutProblem(p))) return true;
      snd.init();
      M.startRun(p);
      M.save(p);
      ui.hooks.beginWave();
      return 'leave';
    }
    case 'race':
      if (p.run) return true;
      snd.init();
      M.startRun(p, true);
      M.save(p);
      ui.hooks.beginWave();
      return 'leave';
    case 'continue': {
      const run = p.run;
      if (!run) return true;
      snd.init();
      if (run.phase === 'wave') {
        // the save is from the start of a wave that was never finished: leaving mid-wave is a fall, not a retry
        run.outcome = 'died';
        ui.showSummary(M.finishRun(p, run), run);
      } else ui.showRun();
      return true;
    }
    case 'abandon': {
      const run = p.run;
      if (!run) return true;
      // from the pause this is the middle of a wave, and that wave's result is never applied
      const mid = run.phase === 'wave';
      const cost = run.race ? 'The race banks nothing and loses nothing.'
        : run.feat.loss ? `It counts as a fall: you keep about ${pct(keepShare(p))} of the bag${mid ? ' from the earlier waves, and what you gathered in this wave is forfeited' : ''}.`
        : mid ? 'It counts as a fall. The bag from the earlier waves comes home whole on this expedition, but what you gathered in this wave is forfeited.'
        : 'It counts as a fall, but nothing is lost on this expedition.';
      if (!ui.ask(`Abandon the ${run.race ? 'race' : 'expedition'}? ${cost}`, 'Abandon', 'abandon')) return true;
      ui.hooks.stop();
      run.outcome = 'died';
      ui.showSummary(M.finishRun(p, run), run);
      return true;
    }
  }
  return false;
}
