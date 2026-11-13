// The screens around an expedition: the first launch, the pause, and the summary after a fall, an extraction or a clear.
import { BAG_TYPES, CARDS, CFG, FAMS, FAM_CAP, KITS, MATS, PATTERNS, SCHEMATICS, SKILL_CAP, STATIONS, WEAPONS, brewMods, skillXpFor, type Fam, type Mat, type Skill, type StationId } from '../data';
import * as M from '../meta';
import * as R from '../run';
import { tabOpen, type Page, type Tab, type UI } from './app';
import * as I from './icons';
import { bar, ic, tile, ui as icon } from './kit';
import { GRADE, cap, describeRunWeapon, roman } from './things';
import { volumeRows } from './sound-controls';
import { SAVE_FACT, controls, expeditionStrip, keepShare, matCount, matIds, matTiles, plural, schemTiles } from './run-common';

// ---------------------------------------------------------------- welcome
export function welcome(_ui: UI): Page {
  const step = (n: number, title: string, text: string) => `<div class="gstep"><span class="step">${n}</span><div><b>${title}</b><div class="dim small">${text}</div></div></div>`;
  const body = `<div class="welcome">
    <h1 class="logo">Craft World</h1>
    <p class="tag">Gather under fire, build a weapon set between waves, carry home what you dare, and craft in town for the next expedition.</p>
    <div class="starts">
      <div class="panel start"><h2>Guided start</h2>
        <p>The game opens over ${['no', 'one', 'two', 'three', 'four', 'five'][M.GUIDE_STEPS] ?? M.GUIDE_STEPS} expeditions, one layer at a time. Recommended for a first visit.</p>
        ${step(1, 'Three waves, then a boss wave','Nothing is lost if you fall. Weapons fire on their own; you mine with the heavy swing and watch the heat.')}
        ${step(2, 'All twelve waves', 'Your aimed ability. After each boss: extract with the bag, or push on. From here a fall loses most of the bag.')}
        ${step(3, 'Everything', 'Camp craft, a choice of ground before each wave, shrines, schematics and the key that raises the danger.')}
        <p class="dim small">You can open everything at any time from the town.</p>
        <button class="pri big" data-a="guided" data-v="1" data-key="Enter">Guided start <span class="kc">Enter</span></button></div>
      <div class="panel start"><h2>Everything open</h2>
        <p>All twelve waves, three bosses, heat, routes, shrines, schematics, the camp craft and the full town from the first expedition.</p>
        <p class="dim small">A fall loses most of the bag from the start. Choose this if you have played before.</p>
        <span class="grow"></span>
        <button class="big" data-a="guided" data-v="0">Everything open</button></div>
    </div>
    <div class="panel"><h2>Controls</h2>${controls()}
      <p class="dim small" style="margin:10px 0 0">The game saves by itself in this browser. ${SAVE_FACT}</p></div>
  </div>`;
  return { body };
}

// ------------------------------------------------------------------ pause
export function pauseView(ui: UI): Page {
  const run = ui.run;
  const muted = ui.hooks.sound.muted;
  const keep = Math.round(keepShare(ui) * 100);
  // abandoning from the pause is always in the middle of a wave: that wave's result is never applied
  const fall = !run ? '' : run.race ? 'The race ends here; nothing is banked or lost.'
    : run.feat.loss ? `It counts as a fall: ${keep}% of the bag from the earlier waves comes home, and what you gathered in this wave is forfeited.`
    : 'It counts as a fall. The bag from the earlier waves comes home whole on this expedition, but what you gathered in this wave is forfeited.';
  const body = `<div class="pausebox">
    ${run ? expeditionStrip(ui, run) : ''}
    <div class="panel">
      <button class="pri big" data-a="resume" data-key="Enter">Resume <span class="kc">Enter, P or Esc</span></button>
      <div class="two" style="margin-top:10px">
        <button class="big" data-a="mute" aria-pressed="${!muted}">${icon(muted ? 'sound-off' : 'sound-on')} Sound is ${muted ? 'off: turn on' : 'on: turn off'}</button>
        <button class="big danger" data-a="abandon">Abandon expedition</button></div>
      ${volumeRows(ui.hooks.sound)}
      <p class="dim small" style="margin:8px 0 0">Abandoning ends the expedition now. ${fall}</p>
      <p class="note" style="margin:10px 0 0">${SAVE_FACT}</p></div>
    <div class="panel"><h2>Controls</h2>${controls()}</div>
  </div>`;
  return { title: 'Paused', cur: run ? `<span class="rstat">${icon('wave')}<span class="rl" data-s="Wave"><span>Wave</span></span><b class="num">${Math.min(run.wave + 1, R.runWaves(run))}<i>/${R.runWaves(run)}</i></b></span>` : '', body };
}

// ---------------------------------------------------------------- summary
/** A failed run should show the player what to change. The first cause that applies is the one named. */
function deathHint(run: R.RunState): string {
  const t = run.totals;
  const last = run.last?.res;
  // a wave left unfinished was never settled (a fall sets the phase to 'over'), so nothing from it was counted
  if (run.phase === 'wave') return 'You left in the middle of a wave, which counts as a fall. What you gathered in that wave is forfeited.';
  if (!last?.died) return 'You left the expedition, which counts as a fall.';
  const max = R.maxHp(run);
  const slots = R.effSlots(run);
  const tonic = run.feat.craft && run.recipes.includes('mending') ? plural(R.craftCost(run, 'mending'), 'herb') : '';
  if (last.hpStart !== undefined && last.hpStart < max * 0.4) {
    // only the ways to heal that this expedition really had
    const never = [...run.charms, ...(run.oil ? [run.oil] : [])].some((b) => brewMods(b).some(([k]) => k === 'noHeal'));
    const ways = never ? [] : [
      run.mutators.includes('dryshop') || run.wilds.includes('haggler') ? '' : 'rations from the shop',
      tonic ? `a Mending tonic (${tonic})` : '',
      run.feat.routes ? 'a ground with a supply drop' : '',
    ].filter(Boolean);
    const list = ways.length > 1 ? `${ways.slice(0, -1).join(', ')} or ${ways[ways.length - 1]}` : ways[0];
    // with no way to heal there is no advice to give here: the next cause that applies is named instead
    if (ways.length) return `That is under two fifths of your health. Heal at camp before a wave like that: ${list}.`;
  }
  if (last.heatPeak > 75) return `Heat peaked at ${Math.round(last.heatPeak)} in that wave. Each strike brings more enemies; ${R.kitOf(run).heatHolds ? `with the ${R.kitOf(run).name} kit heat never cools during a wave, so strike fewer nodes` : 'leave the nodes alone until it cools'}.`;
  if (!run.wilds.includes('stoneback') && R.bagWeight(run) > run.comfort * 4) return `The bag was more than four times what it carries in comfort, so you were slow and stamina came back late. ${run.feat.gates ? 'Extract earlier or craft a bigger bag.' : 'Leave some nodes alone, or bring a bigger bag once you have made one.'}`;
  if (run.weapons.length * 2 <= slots) return `You fell with ${run.weapons.length} of ${slots} weapon slots filled. An empty slot is damage you did not have: fill the slots before anything else.`;
  if (t.crafts === 0 && tonic) return `No camp crafts were used. A Mending tonic costs ${tonic}.`;
  return 'Shield-bearers and armoured bosses only break to the heavy swing; keep stamina for it.';
}

interface Hint {
  text: string;
  tab: Tab;
  sub?: string;
}
const TAB_OF: Record<StationId, Tab> = { forge: 'Forge', workshop: 'Workshop', apothecary: 'Apothecary' };
/** New things to do in town after this expedition, most pressing first. */
function townHints(ui: UI): Hint[] {
  const p = ui.p;
  const out: Hint[] = [];
  const feat = M.featFor(p);
  if (p.standing.pending > 0 && CARDS.some((c) => (p.standing.cards[c.id] ?? 0) < c.max)) out.push({ text: `${plural(p.standing.pending, 'standing card')} to pick`, tab: 'Character', sub: 'Standing' });
  if (feat.schem) {
    const learn = Object.keys(p.schematics).filter((id) => p.schematics[id] > 0 && SCHEMATICS[id]?.kind === 'recipe' && !p.codex.includes(id)).length;
    if (learn) out.push({ text: `${plural(learn, 'recipe')} to learn`, tab: 'Codex' });
    if (!p.week.claimed && M.vaultOptions(p).some((o) => p.week.runs >= o.need)) out.push({ text: 'the weekly vault is open', tab: 'Character', sub: 'Vault' });
  }
  for (const id of Object.keys(STATIONS) as StationId[]) {
    const n = M.stationNeeds(p, id);
    if (n && (!n.blueprint || p.schematics[n.blueprint] > 0) && M.has(p, n.cost, n.coin)) out.push({ text: `enough to raise the ${STATIONS[id].name} to tier ${roman(n.tier)}`, tab: TAB_OF[id] });
  }
  for (const id of Object.keys(p.schematics)) {
    const sc = SCHEMATICS[id];
    const pat = sc?.kind === 'pattern' ? PATTERNS[sc.ref] : null;
    if (pat && p.schematics[id] > 0 && p.stations[pat.station] >= 2 && M.has(p, pat.cost, M.patternFee(p, pat.station))) out.push({ text: `materials for the ${pat.name}`, tab: TAB_OF[pat.station] });
  }
  for (let t = 3; t >= 1; t--) {
    if (p.stations.forge < M.gradeStation(t)) continue;
    const fam = FAMS.find((f) => M.has(p, M.weaponCost(f, t), M.weaponFee(p, t)));
    if (fam) {
      out.push({ text: `materials to forge ${t === 1 ? 'an' : 'a'} ${GRADE[t].toLowerCase()} ${WEAPONS[fam].name.toLowerCase()}`, tab: 'Forge' });
      break;
    }
  }
  const bag = Object.entries(BAG_TYPES).reverse().find(([type, b]) => p.stations.workshop >= b.station && M.has(p, b.cost, M.bagFee(p, type)));
  if (bag) out.push({ text: `materials for a ${bag[1].name.toLowerCase()}`, tab: 'Workshop' });
  return out;
}
/** Where a schematic that came home is used. */
function schemUse(p: M.Profile, id: string): string {
  const sc = SCHEMATICS[id];
  const spare = 'break it into a fragment in the Codex';
  if (sc.kind === 'recipe') return p.codex.includes(id) ? `<b>${sc.name}</b>: you already know this recipe, so ${spare}.` : `<b>${sc.name}</b>: learn it in the Codex, then pack it in the loadout.`;
  if (sc.kind === 'pattern') {
    const pat = PATTERNS[sc.ref];
    return `<b>${sc.name}</b>: make it once at the ${cap(pat.station)} (tier II${p.stations[pat.station] < 2 ? ', yours is tier I' : ''}); it needs ${Object.entries(pat.cost).map(([m, n]) => `${n} ${MATS[m].name.toLowerCase()}`).join(', ')} and ${M.patternFee(p, pat.station)} coin.`;
  }
  const [station, tier] = sc.ref.split('-');
  const have = p.stations[station as StationId];
  const want = Number(tier);
  if (have >= want) return `<b>${sc.name}</b>: the ${cap(station)} is already tier ${roman(have)}, so ${spare}.`;
  return `<b>${sc.name}</b>: it lets you raise the ${cap(station)} to tier ${roman(want)}, at that station${have < want - 1 ? `, once it is tier ${roman(want - 1)}` : ''}.`;
}

/** Minutes and seconds, rounded once: 119.6 s is 2:00, not 1:00. */
const clock = (sec: number) => {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const SKILL_OF: [Skill, Mat['cat'], number][] = [['mining', 'ore', 1], ['logging', 'wood', 1], ['harvesting', 'herb', 1], ['skinning', 'creature', 1.5]];

export function summaryView(ui: UI): Page {
  const s = ui.summary;
  const run = ui.doneRun;
  const backBtn = `<button class="pri" data-a="town" data-key="Enter">Back to town <span class="kc">Enter</span></button>`;
  if (!s || !run) return { title: 'Expedition over', body: '<p class="dim">The expedition is over.</p>', foot: backBtn };
  const p = ui.p;
  const t = run.totals;
  const last = run.last?.res;
  const total = R.runWaves(run);
  // an expedition that was abandoned did not fall in a wave: it was left in one, or at a camp or gate after one
  const left = s.outcome === 'died' && !last?.died;
  const head = s.outcome === 'cleared' ? 'Full clear' : s.outcome === 'extracted' ? `${s.race ? 'Stopped' : 'Extracted'} after wave ${s.waves}`
    : left ? (run.phase === 'wave' ? `Left in wave ${s.waves + 1}` : `Abandoned after wave ${s.waves}`) : `Fell in wave ${s.waves + 1}`;
  const banked = s.race ? 'The race banks nothing: the result is the record.' : 'Everything in the bag is banked.';
  const lostAny = matCount(s.lost) > 0 || s.schemGone.length > 0;
  const keptAny = matCount(s.kept) > 0 || s.schemKept.length > 0;
  const fell = s.outcome === 'died';

  // the outcome and why it ended
  let cause: string;
  if (fell) {
    const died = !!last?.died;
    const max = R.maxHp(run);
    const facts = died ? [
      last!.killer ? `Felled by <b>${last!.killer}</b>` : '',
      last!.hpStart !== undefined ? `you entered the wave with ${Math.round(last!.hpStart)} of ${max} health` : '',
      run.feat.heat && last!.heat >= 1 ? `heat was ${Math.round(last!.heat)} of 100` : '',
    ].filter(Boolean).join('; ') : '';
    const blows = died && last!.lastHits?.length ? `<div class="dim small" style="margin-top:4px">The last blows: ${last!.lastHits.map((h) => `${h.by} ${Math.round(h.dmg)}`).join(', ')}.</div>` : '';
    cause = `${facts ? `${cap(facts)}. ` : ''}${deathHint(run)}${blows}`;
  } else if (s.outcome === 'cleared') cause = `All ${total} waves cleared, ${plural(t.bosses, 'boss', 'bosses')} killed. ${banked}`;
  else if (s.waves >= total) cause = `All ${total} waves of this expedition cleared, ${plural(t.bosses, 'boss', 'bosses')} killed. ${banked}`;
  else cause = `You ${s.race ? 'stopped' : 'left'} at boss gate ${Math.ceil(s.waves / 4)} with ${plural(t.bosses, 'boss', 'bosses')} killed. ${banked}`;
  const hero = `<div class="hero ${s.outcome}">${icon(fell ? 'skull' : s.outcome === 'cleared' ? 'star' : 'storage')}
    <div><div class="big">${s.race ? 'Weekly race · ' : ''}${head}</div><p>${cause}</p></div></div>`;

  // bag -> storage
  const carried: Record<string, number> = {};
  for (const id of [...matIds(s.kept), ...matIds(s.lost)]) carried[id] = (s.kept[id] ?? 0) + (s.lost[id] ?? 0);
  const share = keepShare(ui);
  const shareWords = Math.abs(share - 0.2) < 0.001 ? 'a fifth' : `${Math.round(share * 100)}%`;
  const bank = s.race ? `<div class="panel"><h2>Bag</h2><p class="dim">The weekly race banks nothing and loses nothing. It is a record to beat.</p></div>`
    : `<div class="panel flowp"><h2>Bag ${icon('arrow')} Storage</h2>
      <div class="flow">
        <div class="fgroup"><div class="cat">In the bag <small>${plural(matCount(carried), 'material')}${run.bagSchem.length ? `, ${plural(run.bagSchem.length, 'schematic')}` : ''}</small></div>
          <div class="tiles">${matTiles(ui, carried, { ref: 'mat', size: 'sm', dim: fell && run.feat.loss })}${schemTiles(ui, run.bagSchem, { size: 'sm', dim: fell && run.feat.loss })}${matCount(carried) || run.bagSchem.length ? '' : '<span class="dim small">Empty.</span>'}</div></div>
        <div class="farrow">${icon('arrow')}<small>${lostAny ? `you kept about ${shareWords}` : 'all of it'}</small></div>
        <div class="fgroup bank"><div class="cat">${fell ? 'Came home' : 'Banked in storage'} <small>${plural(matCount(s.kept), 'material')}${s.schemKept.length ? `, ${plural(s.schemKept.length, 'schematic')}` : ''}</small></div>
          <div class="tiles">${matTiles(ui, s.kept, { ref: 'mat', plus: true })}${schemTiles(ui, s.schemKept)}${keptAny ? '' : '<span class="dim small">Nothing came home.</span>'}</div></div>
      </div>
      ${lostAny ? `<div class="fgroup lost"><div class="cat">Lost with the bag <small>${plural(matCount(s.lost), 'material')}${s.schemGone.length ? `, ${plural(s.schemGone.length, 'schematic')}` : ''}</small></div>
          <div class="tiles">${matTiles(ui, s.lost, { ref: 'mat', size: 'sm', dim: true })}${schemTiles(ui, s.schemGone, { size: 'sm', dim: true })}</div>
          ${s.schemGone.length ? `<div class="small dim" style="margin-top:4px">${s.schemGone.map((id) => SCHEMATICS[id].name).join(', ')}</div>` : ''}
          <p class="dim small" style="margin:6px 0 0">A fall keeps ${Math.round(share * 100)}% of every stack. Extracting at a boss gate keeps all of it.</p></div>` : ''}
      ${fell && !run.feat.loss ? `<p class="ok small" style="margin:8px 0 0">${run.phase === 'wave' ? 'The bag from the earlier waves came home whole: nothing in it is lost on this expedition. Only what the unfinished wave gathered is forfeited.' : 'Nothing is lost on this expedition: the whole bag came home.'}</p>` : ''}
      ${s.schemKept.length ? `<div class="small uses"><div class="cat">What to do with the schematics</div>${[...new Set(s.schemKept)].map((id) => `<div>${schemUse(p, id)}</div>`).join('')}</div>` : ''}</div>`;

  // what the session earned: progress bars with what the next level takes
  const frac = Math.max(0.1, s.waves / CFG.waveDur.length);
  const danger = 1 + 0.25 * (run.keyLevel - 1);
  const prog = (svg: string, name: string, gain: string, l: { lvl: number; xp: number }, need: number, capped: boolean, up: boolean, note = '') => `<div class="earn">${svg}<div class="grow"><div class="kv"><span><b>${name}</b> <span class="dim">level ${l.lvl}</span>${up ? ' <b class="gold">level up</b>' : ''}</span><span class="num" style="color:var(--xp)">${gain}</span></div>
    <div class="row" style="gap:8px">${bar(capped ? 1 : l.xp / need, 'green')}<span class="dim small num">${capped ? 'at the cap' : `${Math.floor(l.xp)} / ${need} to level ${l.lvl + 1}`}</span></div>${note ? `<div class="dim small">${note}</div>` : ''}</div></div>`;
  const rows: string[] = [];
  const used: string[] = [];
  const lineOf = (start: string) => {
    const hit = s.lines.find((x) => x.startsWith(start));
    if (hit) used.push(hit);
    return hit ?? '';
  };
  const standLine = lineOf('Town standing:');
  const stand = Math.round(s.waves * 9 + (s.outcome === 'cleared' ? 40 : 0));
  if (!s.race && stand > 0) rows.push(prog(icon('standing'), 'Town standing', `+${stand}`, p.standing, M.standingFor(p.standing.lvl), false, /now level/.test(standLine), `9 per wave cleared${s.outcome === 'cleared' ? ', 40 for the clear' : ''}.${/now level/.test(standLine) ? ' A new level is a card to pick in town.' : ''}`));
  else lineOf('Town standing:');
  if (!s.race) {
    for (const [skill, cat, mul] of SKILL_OF) {
      const units = Object.entries(t.gathered).reduce((a, [id, n]) => a + (MATS[id]?.cat === cat ? n : 0), 0) * mul;
      const line = lineOf(`${cap(skill)}:`);
      if (Math.floor(units * frac) <= 0) continue;
      rows.push(prog(ic(I.skillIcon(skill)), cap(skill), `+${Math.floor(units * frac)} xp`, p.skills[skill], skillXpFor(p.skills[skill].lvl), p.skills[skill].lvl >= SKILL_CAP, /now level/.test(line)));
    }
    for (const [f, kills] of Object.entries(t.famKills)) {
      const fam = f as Fam;
      const line = lineOf(`${WEAPONS[fam].name} mastery:`);
      if (Math.floor(kills * 0.25 * frac) <= 0) continue;
      rows.push(prog(ic(I.famIcon(fam)), `${WEAPONS[fam].name} mastery`, `+${Math.floor(kills * 0.25 * frac)} xp`, p.fams[fam], M.famXpFor(p.fams[fam].lvl), p.fams[fam].lvl >= FAM_CAP, !!line));
    }
  }
  const rest = s.lines.filter((x) => !used.includes(x) && !/\+0 (xp|for)/.test(x));
  const key = s.keyUp ? `<div class="keyup">${icon('key')}<span><b>The key rises to danger ${p.key}.</b> A higher danger is open for the next expedition.</span></div>` : s.keyWhy && t.bosses > 0 ? `<p class="dim small keyline">${icon('key')} ${s.keyWhy}</p>` : '';
  const paid = `<div class="panel"><h2>You earned</h2>
    ${s.race ? '' : `<div class="kv"><span>${icon('coin')} <b>Coin</b></span><span><b class="gold num">+${s.coin}</b></span></div>
    <div class="dim small" style="margin-bottom:6px">${s.coin > 0 ? `4 per wave cleared${s.outcome === 'cleared' ? ', 40 for the clear' : ''}${run.keyLevel > 1 ? `, ×${danger.toFixed(2)} for danger ${run.keyLevel}` : ''}. ` : 'No wave was cleared. '}Skill and mastery experience is paid in proportion to the waves cleared (${s.waves} of ${CFG.waveDur.length}, never less than a tenth).</div>`}
    ${rows.join('')}${rest.map((x) => `<div class="payline">${x}</div>`).join('')}${key}</div>`;

  // the expedition in numbers
  const top = [...run.weapons].sort((a, b) => b.dmg - a.dmg)[0];
  const kv = (k: string, v: string) => `<div class="kv"><span class="dim">${k}</span><span>${v}</span></div>`;
  const stats = `<div class="panel"><h2>The expedition</h2>
    ${kv('Waves cleared', `${s.waves} of ${total}`)}${kv('Kit and danger', `${KITS.find((k) => k.id === run.kit)?.name ?? run.kit} · danger ${run.keyLevel}`)}
    ${kv('Kills', String(t.kills))}${kv('Bosses killed', String(t.bosses))}${kv('Named elites killed', String(t.elites))}${kv('Level reached', String(run.level))}
    ${kv('Damage taken', String(Math.round(t.dmgTaken)))}${run.feat.heat ? kv('Highest heat', `${Math.round(t.heatPeak)} of 100`) : ''}${kv('Time striking nodes', `${t.gatherTime.toFixed(0)} s`)}
    ${kv('Camp crafts', String(t.crafts))}${kv('Scrap earned', String(t.scrap))}${kv('Time in waves', `${clock(t.time)} min`)}
    ${top ? `<div class="item best">${tile(describeRunWeapon(top, `rw:${run.weapons.indexOf(top)}`, { p, run }), { size: 'sm' })}<div class="grow"><div class="sub">Best weapon</div><div class="nm">${R.weaponName(top)}</div><div class="sub">${Math.round(top.dmg)} damage · ${plural(top.kills, 'kill')}</div></div></div>` : ''}</div>`;

  // a hint is a link, so it only names a tab the guided start has already opened
  const hints = s.race ? [] : townHints(ui).slice(0, 3);
  // the guided start opens the town a few tabs at a time (see `tabOpen`): a hint for a closed tab says when it opens, and is not a link
  const opensWith = (tab: Tab) => (tab === 'Workshop' || tab === 'Character' ? 'second' : 'third');
  const hintHtml = (h: Hint) => (tabOpen(p, h.tab) ? `<button class="link" data-a="goto" data-v="${h.tab}" data-w="${h.sub ?? ''}">${h.text}</button>`
    : `<span>${h.text} <span class="dim">(the ${h.tab} tab opens with the ${opensWith(h.tab)} guided expedition)</span></span>`);
  const nextDanger = Math.max(1, Math.min(p.key, p.loadout.keyLevel)); // a key that has just risen moved the loadout up with it
  const guiding = !!p.guided && p.sessions < M.GUIDE_STEPS;
  const again = !s.race && !guiding && !M.loadoutProblem(p) ? `<button data-a="start" ${`data-tip="text:Leaves at once with the same loadout and kit${M.featFor(p).schem ? `, at danger ${nextDanger}${s.keyUp ? ' (the key has just risen, and the danger with it)' : ''}` : ''}. Packed brews are used up again."`}>Expedition again</button>` : '';
  const foot = `<span class="footnote">${hints.length ? `New in town: ${hints.map(hintHtml).join(' · ')}` : 'Nothing new is waiting in town.'}</span>${again}${backBtn}`;
  return { title: fell ? 'Expedition lost' : 'Expedition over', body: `${hero}<div class="sumcols"><div class="stack">${bank}${paid}</div>${stats}</div>`, foot };
}
