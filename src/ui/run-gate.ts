// After a wave: the tally (what was gained and why, level-up picks), and the boss gate (chest, then extract now or push on).
import { BOSSES, CFG, ELITES, EVOLVE_MUL, EVOLVE_TIER, GROUNDS, LEVEL_PICKS, MATS, NODE_MAT, OBJECTIVES, SCHEMATICS, WEAPONS, WILDS, type NodeKind } from '../data';
import * as M from '../meta';
import * as R from '../run';
import type { Page, UI } from './app';
import * as I from './icons';
import { bar, ic, req, tile, ui as icon } from './kit';
import { describe, describeRunWeapon, roman } from './things';
import {
  bagWords, cap, changeLines, cur, dpsText, evolveChecklist, expeditionStrip, healWays, healthBar, keepShare, matCount, matTiles, modText, plural, schemTiles, st, stile, weaponNums, weaponTile,
} from './run-common';

// ------------------------------------------------------------------ tally
function levelPanel(run: R.RunState, taken: string[]): string {
  const done = taken.map((id) => {
    const x = LEVEL_PICKS.find((q) => q.id === id)!;
    return `<b>${x.name}</b> <span class="dim">(${modText(x.mods)})</span>`;
  }).join(', ');
  if (run.pendingPicks <= 0) return taken.length ? `<p class="note">${icon('level')} Level ${run.level}. Picked: ${done}.</p>` : '';
  const cards = run.pickOffer.map((id, i) => {
    const x = LEVEL_PICKS.find((q) => q.id === id)!;
    const held = run.picks.filter((q) => q === id).length;
    return `<button type="button" class="card3" data-a="levelpick" data-v="${id}" data-key="${i + 1}">
      <span class="med">${I.modIcon(x.mods[0][0])}</span><span class="txt"><span class="nm">${x.name}</span><span>${cap(modText(x.mods))}</span>
      <span class="now">${changeLines(run, { ...run, picks: [...run.picks, id] })}</span>${held ? `<span class="dim small">held ×${held}</span>` : ''}</span><span class="kc">${i + 1}</span></button>`;
  }).join('');
  return `<div class="panel levelup"><h2>Level ${run.level - run.pendingPicks + 1}: pick one of three <span class="have">${run.pendingPicks > 1 ? `${run.pendingPicks} picks to make` : 'keys 1 to 3'}</span></h2>
    <div class="cards3">${cards}</div><p class="dim small" style="margin:8px 0 0">${taken.length ? `Picked: ${done}. ` : ''}A pick lasts the whole expedition and heals 2 health. Each line shows the stat now and after.</p></div>`;
}

export function tallyView(ui: UI): Page {
  const run = ui.run!;
  const last = run.last!;
  const res = last.res;
  const boss = R.isBossWave(last.index) ? BOSSES[R.segmentOf(last.index)] : null;
  const m = R.runMods(run);
  const key = `${run.seed}:${last.index}`;
  const still = st.tallyShown === key; // the bars animate once, not after every pick
  st.tallyShown = key;

  // what was gained, by where it came from
  const group = (cats: string[]) => Object.fromEntries(Object.entries(res.gathered).filter(([id, n]) => n > 0 && MATS[id] && cats.includes(MATS[id].cat)));
  const gain = (label: string, why: string, rec: Record<string, number>) => (matCount(rec) ? `<div class="gain"><div class="cat">${label} <small>${why}</small></div><div class="tiles">${matTiles(ui, rec, { plus: true })}</div></div>` : '');
  const elites = res.elitesKilled.map((id) => ELITES.find((e) => e.id === id)?.name ?? id);
  const need = R.xpNeed(run.level);
  const played = run.memo?.played?.wave === run.wave ? run.memo.played.route : null;
  const objName = played && played.objective !== 'none' && played.objective !== 'elite' ? OBJECTIVES[played.objective].name : 'Objective';
  // what the objective paid and healed is read from the wave's own record, never worked out again from the build as it is now
  const objScrap = res.objScrap ?? 0;
  const objPaid = res.objScrap === undefined ? '' : `: it paid ${Math.round(objScrap)} scrap and ${(res.objHeal ?? 0) >= 0.5 ? `healed ${Math.round(res.objHeal!)}` : 'healed nothing (full health, or healing was forbidden)'}`;
  // the rest is what applyWave gave; anything health gained since then came from level picks
  const rest = last.rest ?? Math.max(0, run.hp - res.hp);
  const fromPicks = last.rest === undefined ? 0 : Math.round(run.hp - res.hp - last.rest);
  const restText = `${Math.round(rest) > 0 ? `Resting healed ${Math.round(rest)}.` : last.restBarred ? `No rest healing: ${run.wilds.includes('haggler') ? 'Haggler forbids it' : 'healing was forbidden in that wave'}.` : 'No rest healing this time.'}${fromPicks > 0 ? ` Level picks healed ${fromPicks} more.` : ''}`;
  const facts = [
    boss ? (res.bossKilled ? `<div class="req ok">${icon('check')}<span><b>${boss.name}</b> is dead: there is a chest at the gate.</span></div>` : `<div class="req bad">${icon('cross')}<span><b>${boss.name}</b> still stands. You outlasted the clock, but there is no chest.</span></div>`) : '',
    res.objective && !elites.length ? req(true, `${objName} done${objPaid}.`) : '',
    played && !boss && (played.objective === 'supply' || played.objective === 'nests') && !res.objective ? req(false, `${objName} not done: no reward.`) : '',
    elites.length ? req(true, `Named elite down: ${elites.join(', ')}. Its part is in the bag.`) : '',
    played?.objective === 'elite' && !elites.length ? req(false, 'The named elite got away: no part.') : '',
  ].join('');
  const brought = `<div class="panel"><h2>Brought in</h2>
    ${gain('From nodes', 'heavy swings on veins, trees and reeds', group(['ore', 'wood', 'herb']))}${gain('From kills', 'left by enemies your weapons killed', group(['creature']))}${gain('Parts', 'carried by named elites and bosses', group(['part']))}
    ${matCount(res.gathered) ? '' : '<p class="dim">No materials this wave. Hold the heavy swing on a node to mine it; kills leave creature parts.</p>'}
    ${last.found.length ? `<div class="gain"><div class="cat">Schematics found <small>now in the bag</small></div><div class="tiles">${schemTiles(ui, last.found)}</div><div class="small" style="margin-top:4px">${last.found.map((id) => SCHEMATICS[id].name).join(', ')}</div></div>` : ''}
    <div class="kv" style="margin-top:8px"><span class="dim">${icon('scrap')} ${objScrap > 0 ? 'Scrap this wave' : 'Scrap from kills'}</span><span><b class="gold num">+${Math.round(res.scrap)}</b> <span class="dim">· ${objScrap > 0 ? `${Math.round(res.scrap - objScrap)} from kills, ${Math.round(objScrap)} from the objective · ` : ''}now ${run.scrap}</span></span></div>
    <div class="kv"><span class="dim">${icon('level')} Experience</span><span><b class="num" style="color:var(--xp)">+${Math.round(res.xp)} xp</b>${last.levelUps ? ` · <b class="gold">level ${run.level}</b>` : ''}</span></div>
    <div class="row" style="gap:8px"><span class="small dim">Level ${run.level}</span>${bar(run.xp / need, 'green')}<span class="small dim num">${Math.floor(run.xp)} / ${need} xp</span></div>
    ${facts ? `<div style="margin-top:8px">${facts}</div>` : ''}
    <div class="kv" style="margin-top:8px"><span class="dim">${icon('heart')} Damage taken</span><span>${Math.round(res.dmgTaken)}${res.hpStart !== undefined ? ` <span class="dim">· health ${Math.round(res.hpStart)} → ${Math.max(0, Math.round(res.hp))}</span>` : ''}</span></div>
    ${healthBar(run, m)}<p class="dim small" style="margin:2px 0 0">${restText}</p></div>`;

  // what did the work
  const names = run.weapons.map((w) => R.weaponName(w));
  const rows: [string, string, number, number][] = run.weapons.map((_, i) => [weaponTile(ui, run, i, { size: 'xs' }), `${names[i]}${names.filter((x) => x === names[i]).length > 1 ? ` <span class="dim">· slot ${i + 1}</span>` : ''}`, res.dmgBy[i] ?? 0, res.killsBy[i] ?? 0]);
  const n = res.dmgBy.length;
  const plain = (svg: string) => `<i class="tile xs static">${svg}</i>`;
  rows.push([plain(I.modIcon('heavyDmg')), 'Heavy swing', res.dmgBy[n - 2] ?? 0, res.killsBy[n - 2] ?? 0], [plain(I.uiIcon('star')), 'Ability and effects', res.dmgBy[n - 1] ?? 0, res.killsBy[n - 1] ?? 0]);
  const top = Math.max(1, ...rows.map((r) => r[2]));
  const all = rows.reduce((a, r) => a + r[2], 0);
  const weakest = run.weapons.length > 1 ? rows.slice(0, run.weapons.length).sort((a, b) => a[2] - b[2])[0] : null;
  const work = `<div class="panel"><h2>What did the work</h2>
    ${rows.map(([t, name, dmg, k], i) => `<div class="tallyrow${still ? ' still' : ''}" style="animation-delay:${i * 0.1}s"><span class="who">${t}<span>${name}</span></span>${bar(dmg / top, 'tall')}<span class="did"><b>${Math.round(dmg)}</b> damage · ${plural(k, 'kill')}</span></div>`).join('')}
    <p class="dim small" style="margin:8px 0 0">${Math.round(all)} damage and ${plural(res.kills, 'kill')} in ${Math.round(res.time)} seconds.${weakest ? ` <span class="warn">Weakest weapon this wave: ${weakest[1]}.</span>` : ''}</p></div>`;

  // what heat did
  let heat: string;
  if (run.feat.heat) {
    const peak = res.heatPeak / CFG.heat.max;
    const spawn = CFG.heat.spawnBonus * Math.pow(peak, CFG.heat.curve);
    const kv = (k: string, v: string) => `<div class="kv"><span class="dim">${k}</span><span>${v}</span></div>`;
    heat = `<div class="panel"><h2>What heat did</h2>
      <div class="row" style="gap:8px"><span class="small dim">Peak</span>${bar(peak, 'heat tall')}<b class="num">${Math.round(res.heatPeak)}</b><span class="small dim">of ${CFG.heat.max}</span></div>
      ${res.heatPeak >= 1 ? `${res.hotSpawned !== undefined ? kv('Extra enemies it brought', `<b class="warn">${res.hotSpawned}</b> <span class="dim">· they pay ${Math.round(CFG.heat.hotPay * 100)}% scrap, xp and drops</span>`) : ''}
      ${res.heatBonus !== undefined ? kv('Extra material from hot strikes', `<b class="ok">+${res.heatBonus}</b>`) : ''}
      ${kv('At the peak', `enemies came <span class="warn">+${Math.round(spawn * 100)}%</span> faster, a strike gave <span class="ok">+${Math.round(CFG.heat.yieldBonus * peak * 100)}%</span>`)}
      ${kv('Time spent striking nodes', `${res.gatherTime.toFixed(1)} s`)}
      ${kv('Carried into the next wave', `<b>${Math.round(run.heat)}</b> <span class="dim">· half of the ${Math.round(res.heat)} left at the end</span>`)}`
      : '<p class="dim" style="margin-top:6px">No heat: you left the nodes alone, so no extra enemies came.</p>'}
      <p class="dim small" style="margin:6px 0 0">Every strike on a node raises heat. Heat brings more enemies and makes a strike yield more; ${R.kitOf(run).heatHolds ? 'with the Firebrand kit it does not cool during a wave, and half of it comes with you to the next' : 'it cools while you leave the nodes alone'}.</p></div>`;
  } else {
    heat = `<div class="panel"><h2>Gathering</h2><div class="kv"><span class="dim">Time spent striking nodes</span><span>${res.gatherTime.toFixed(1)} s</span></div></div>`;
  }

  const taken = run.picks.slice(run.picks.length - Math.max(0, last.levelUps - run.pendingPicks));
  const body = `${levelPanel(run, taken)}<div class="cols tallycols">${brought}${work}${heat}</div>`;
  const where = run.gate ? 'the boss gate' : 'camp';
  const foot = run.pendingPicks > 0
    ? `<span class="footnote">${icon('level')} Level up: choose one of the three picks above${run.pendingPicks > 1 ? ` (${run.pendingPicks} to make)` : ''}.</span><button class="pri" disabled>Pick a level-up first</button>`
    : `<span class="footnote">Next: ${where}${run.gate ? '' : ', the shop and the next ground'}.</span><button class="pri" data-a="tallyok" data-key="Enter">Continue to ${where} <span class="kc">Enter</span></button>`;
  return { title: `Wave ${last.index + 1} cleared`, cur: cur(ui, run), body, foot };
}

// ------------------------------------------------------------------- gate
function chestPanel(ui: UI, run: R.RunState, g: R.Gate): string {
  const boss = BOSSES[g.boss];
  if (!g.killed) {
    return `<div class="panel chest"><h2>Chest</h2><div class="req bad">${icon('cross')}<span><b>${boss.name}</b> still stands. You outlasted the clock, but there is no chest${g.final ? '' : ' and no evolution at this gate'}.</span></div>
      <p class="dim small" style="margin-top:6px">A boss's armour breaks only to the heavy swing. Kill it before the wave ends for the chest.</p></div>`;
  }
  if (!g.opened) {
    return `<div class="panel chest"><h2>Chest <span class="have">open it first</span></h2><div class="row"><button class="pri" data-a="chest" data-key="c">${icon('chest')} Open the chest <span class="kc">C</span></button>
      <span class="dim small grow"><b>${boss.name}</b> is down. Inside: 40 scrap${run.feat.schem ? `, a schematic of ${boss.name}` : ''}, and a second ${MATS[boss.part].name} if you broke every plate of its armour.${run.race ? ' Only the scrap is of use: the race banks nothing.' : ''}</span></div></div>`;
  }
  const loot = g.loot.map((text) => {
    if (/^\d+ scrap$/.test(text)) return `<div class="loot"><span class="tile sm static">${I.uiIcon('scrap')}<span class="q">${parseInt(text, 10)}</span></span><span><b>${text}</b><br><span class="dim small">added to your scrap</span></span></div>`;
    const s = Object.values(SCHEMATICS).find((x) => x.name === text);
    if (s) return `<div class="loot">${tile(describe(`schem:${s.id}`, ui.ctx), { size: 'sm' })}<span><b>${s.name}</b><br><span class="dim small">${cap(s.kind)} · ${run.race ? 'not kept: the race banks nothing' : 'in the bag until you extract'}</span></span></div>`;
    if (text.includes(MATS[boss.part].name)) return `<div class="loot">${tile(describe(`bag:${boss.part}`, ui.ctx), { size: 'sm' })}<span><b>${MATS[boss.part].name}</b><br><span class="dim small">${cap(text)}</span></span></div>`;
    return `<div class="loot"><span>${cap(text)}</span></div>`;
  }).join('');
  return `<div class="panel chest"><h2>Chest <span class="have">${icon('check')} opened</span></h2><div class="loots">${loot}</div></div>`;
}

/** One card per weapon that can evolve: before and after, the effect, and a part to spend. Otherwise the checklist. */
function evolution(ui: UI, run: R.RunState, g: R.Gate): string {
  if (!g.killed) return `<p class="dim small">No chest, so nothing can evolve at this gate.</p>`;
  // no choice of ground means no named elites, so there is no part to spend (the second guided expedition)
  if (!run.feat.routes && R.eliteParts(run).length === 0) return `<p class="dim small">Evolving a weapon takes the part of a named elite. Named elites come with the choice of ground, from the third guided expedition, so nothing can evolve on this one.</p>`;
  const check = evolveChecklist(run);
  if (!g.opened) return `<p class="dim small">Open the chest first. Then, if these hold, a weapon can evolve:</p><div class="evoreq">${check.html}</div>`;
  const parts = R.eliteParts(run);
  const m = R.runMods(run);
  const cards = R.evolvable(run).map((i) => {
    const w = run.weapons[i];
    const d = WEAPONS[w.fam];
    const now = weaponNums(w, run, m);
    const then = weaponNums({ ...w, evolved: true }, run, m);
    const after = describeRunWeapon({ ...w, evolved: true }, `text:${d.evolved}: ${d.evolvedText}. It deals ${EVOLVE_MUL} times the damage of the ${R.weaponName(w)}.`, ui.ctx);
    return `<div class="evocard"><div class="evohead">${weaponTile(ui, run, i, { size: 'sm' })}<span class="plus">${icon('arrow')}</span>${tile(after, { size: 'sm' })}
        <div class="grow"><b class="nm r4">${d.evolved}</b> <span class="dim small">from ${R.weaponName(w)}, slot ${i + 1}</span><div class="small">${cap(d.evolvedText)}. <span class="dim">${dpsText(now)} →</span> <b class="ok">${dpsText(then)}</b> damage per second.${then.note ? ` <span class="dim">${then.note}</span>` : ''}</div></div></div>
      <div class="row" style="gap:6px"><span class="dim small">Spend one part:</span>${parts.map((part) => `<button class="sm evob" data-a="evolve" data-v="${i}" data-w="${part}">${stile(describe(`bag:${part}`, ui.ctx), { size: 'xs' })} ${MATS[part].name} <span class="dim">(${run.bagMats[part]} held)</span></button>`).join('')}</div></div>`;
  }).join('');
  if (!cards) return `<div class="evoreq">${check.html}<p class="warn small" style="margin:4px 0 0">Nothing can evolve at this gate.</p></div>`;
  return `${cards}<p class="dim small" style="margin:6px 0 0">The part is used up and does not come home. An evolved weapon no longer merges. Tier ${roman(EVOLVE_TIER)} or higher, of a kind you brought or packed the recipe for.</p>`;
}

function wildBlock(ui: UI, run: R.RunState, g: R.Gate): string {
  if (g.wildDone) {
    const held = run.wilds.map((id) => WILDS.find((x) => x.id === id)!);
    return held.length ? held.map((x) => `<div class="small" style="padding:2px 0">${icon('check')} <b>${x.name}.</b> <span class="dim">${x.text}</span></div>`).join('') : `<p class="dim small">${icon('check')} No wild pick taken.</p>`;
  }
  const cards = g.wildOffer.map((id, i) => {
    const x = WILDS.find((q) => q.id === id)!;
    const after = { ...run, wilds: [...run.wilds, id], slots: run.slots + (id === 'slot' ? 1 : 0) };
    const n = run.weapons.length;
    const extra = id === 'slot' ? `<span class="fx"><span><span class="dim">Weapon slots</span> ${run.slots} → <b class="ok">${run.slots + 1}</b></span></span><span class="fx"><span><span class="dim">With your ${plural(n, 'weapon')}</span> all damage ×${Math.max(0.4, 1 - 0.02 * n).toFixed(2)}, and 2% less for each one added</span></span>` : '';
    return `<button type="button" class="card3 wild" data-a="wild" data-v="${id}" data-key="${i + 1}"><span class="med">${describe(`wild:${id}`, ui.ctx).icon}</span>
      <span class="txt"><span class="nm">${x.name}</span><span>${x.text}</span><span class="now">${extra}${changeLines(run, after)}</span></span><span class="kc">${i + 1}</span></button>`;
  }).join('');
  return `<p class="dim small">One rule to bend for the rest of the expedition. Each gives and takes; it cannot be undone. Push on needs an answer, one or none; extracting does not.</p>
    ${cards ? `<div class="cards3 three">${cards}</div>` : '<p class="dim">Nothing left to offer.</p>'}
    <button class="big ghost" style="margin-top:6px" data-a="wild" data-v="" data-key="0">Take none <span class="kc">0</span></button>`;
}
/**
 * The wild pick as its own panel: first on a phone, at the head of the push-on side on a wider screen. Inside the
 * push-on column it sat below the fold on a phone, while the disabled Push on button only said to answer it first.
 */
function wildPanel(ui: UI, run: R.RunState, g: R.Gate): string {
  return `<div class="panel way wild${g.wildDone ? '' : ' need'}"><h2>${icon('star')} Wild pick <span class="have">${g.wildDone ? 'done' : 'before you push on'}</span></h2>
    ${wildBlock(ui, run, g)}</div>`;
}

/** What the session pays for the waves cleared so far: the same sums `finishRun` uses. */
function pays(run: R.RunState, cleared: boolean): string {
  const waves = run.totals.wavesCleared;
  const danger = 1 + 0.25 * (run.keyLevel - 1);
  const coin = Math.round((waves * 4 + (cleared ? 40 : 0)) * danger);
  const kv = (k: string, v: string) => `<div class="kv small"><span class="dim">${k}</span><span>${v}</span></div>`;
  return `${kv(`${icon('coin')} Coin`, `<b class="gold">+${coin}</b> <span class="dim">· 4 a wave${cleared ? ', 40 for the clear' : ''}${run.keyLevel > 1 ? `, ×${danger.toFixed(2)} for danger ${run.keyLevel}` : ''}</span>`)}
    ${kv(`${icon('standing')} Town standing`, `<b>+${waves * 9 + (cleared ? 40 : 0)}</b> <span class="dim">· 9 a wave${cleared ? ', 40 for the clear' : ''}</span>`)}
    ${kv('Trade skill experience', `<b>${Math.round(Math.max(0.1, waves / CFG.waveDur.length) * 100)}%</b> <span class="dim">of what you gathered · waves cleared out of ${CFG.waveDur.length}</span>`)}`;
}

function extractCol(ui: UI, run: R.RunState, ready: boolean): string {
  const any = matCount(run.bagMats) > 0 || run.bagSchem.length > 0;
  if (run.race) {
    return `<div class="panel way out"><h2>${icon('storage')} Stop here</h2><p>End the race after wave ${run.wave}.</p>
      <p class="small">Your result is ${plural(run.wave, 'wave')} in ${Math.round(run.totals.time)} seconds. The race banks nothing and loses nothing.</p></div>`;
  }
  return `<div class="panel way out"><h2>${icon('storage')} Extract now</h2>
    <p>Bank the bag and end the expedition here, after wave ${run.wave} of ${R.runWaves(run)}.</p>
    <div class="tiles">${matTiles(ui, run.bagMats, { size: 'sm' })}${schemTiles(ui, run.bagSchem, { size: 'sm' })}${any ? '' : '<span class="dim small">The bag is empty.</span>'}</div>
    <p class="small" style="margin:6px 0"><b>${cap(bagWords(run))}</b> ${any ? 'go' : 'goes'} to storage, safe.</p>
    <h4>What ${plural(run.totals.wavesCleared, 'wave')} pay</h4>${pays(run, false)}
    <p class="small warn" style="margin:8px 0 0">${icon('warn')} Scrap is not banked: your <b>${run.scrap} scrap</b> is left behind, with the weapons and items.</p>
    ${ready ? '' : '<p class="note" style="margin:8px 0 0">Open the chest first: what is in it comes home too.</p>'}</div>`;
}

function pushCol(ui: UI, run: R.RunState, g: R.Gate): string {
  const p = ui.p;
  const keep = keepShare(ui);
  const mats = matCount(run.bagMats);
  const items = mats + run.bagSchem.length;
  const nextSeg = g.boss + 1;
  // without a choice of ground the expedition stays where it is, and that ground has one kind of node
  const kinds: NodeKind[] = run.feat.routes ? ['ore', 'wood', 'herb'] : [GROUNDS[run.route.ground].node];
  const deeper = kinds.map((k) => NODE_MAT[k][nextSeg]);
  const m = R.runMods(run);
  const danger = 1 + 0.25 * (run.keyLevel - 1); // the same multiplier `finishRun` puts on coin
  const more = run.race ? 'The race pays no coin and no standing: only the record counts.'
    : `Each further wave pays ${4 * danger} coin${run.keyLevel > 1 ? ` (4, ×${danger.toFixed(2)} for danger ${run.keyLevel})` : ''} and 9 standing more, even on a fall; a full clear adds ${40 * danger} coin and 40 standing.`;
  const quota = M.keyQuota(run.keyLevel);
  const haul = M.nodeUnits(run.bagMats);
  let key = '';
  if (run.race) key = 'Weekly race: rank is the deepest wave, then time.';
  else if (run.feat.schem) {
    key = run.keyLevel < p.key ? `The key rises only at your best danger (${p.key}); this expedition is at danger ${run.keyLevel}.`
      : run.totals.bosses < g.boss + 1 ? `The key cannot rise on this expedition: a boss got away (${run.totals.bosses} of ${g.boss + 1} killed).`
      : `The key rises to danger ${p.key + 1} only on a full clear: all twelve waves, all three bosses killed (${run.totals.bosses} so far) and ${quota} ore, wood or herbs banked (the bag holds ${haul}).`;
  }
  const lose = run.race || !run.feat.loss ? `<p class="small ok">${icon('check')} Nothing in the bag is at risk on this expedition.</p>` : items
    ? `<p class="small warn">${icon('warn')} If you fall, <b>${Math.round(keep * 100)}%</b> comes home${(p.standing.cards.keep ?? 0) > 0 ? ` (20%, and ${8 * p.standing.cards.keep}% from Stitched lining)` : ''}: about <b>${Math.round(items * keep)} of ${plural(items, 'item')}</b> in this bag. The same share of every stack; each schematic has that chance.</p>`
    : `<p class="small dim">The bag is empty, so nothing is at risk yet. Of what you gather next, a fall brings ${Math.round(keep * 100)}% home.</p>`;
  return `<div class="panel way deep"><h2>${icon('skull')} Push on</h2>
    <p>Waves ${run.wave + 1}–${run.wave + 4}, then <b>${BOSSES[nextSeg].name}</b>. No extraction until the next gate, after wave ${run.wave + 4}.</p>
    <div class="tiles">${deeper.map((id) => tile(describe(`mat:${id}`, ui.ctx), { size: 'sm', round: true })).join('')}${tile(describe(`mat:${BOSSES[nextSeg].part}`, ui.ctx), { size: 'sm' })}</div>
    <p class="small" style="margin:6px 0">New there: <b>${deeper.map((id) => MATS[id].name).join(', ')}</b>; from the boss, ${MATS[BOSSES[nextSeg].part].name}${run.feat.schem && !run.race ? ' and its own schematics' : ''}.${run.race ? ' None of it is banked in the race.' : ''}</p>
    ${lose}
    ${healthBar(run, m)}<ul class="heals">${healWays(run, m, true).map((x) => `<li>${x}</li>`).join('')}</ul>
    <p class="dim small">You keep your ${run.scrap} scrap for the next shop. ${more}</p>
    <h4>Evolution <span class="hint">· optional</span></h4>${evolution(ui, run, g)}
    ${key ? `<p class="small keyline">${icon('key')} ${key}</p>` : ''}</div>`;
}

export function gateView(ui: UI): Page {
  const run = ui.run!;
  const g = run.gate!;
  const boss = BOSSES[g.boss];
  const chestDone = !g.killed || g.opened;
  const canPush = chestDone && g.wildDone;
  const keep = Math.round(keepShare(ui) * 100);
  const hasBag = matCount(run.bagMats) > 0 || run.bagSchem.length > 0;
  const total = R.runWaves(run);
  const menu = `<button class="sm ghost helpb" data-a="runmenu" aria-label="Menu: controls, leave, abandon">${icon('settings')}<span>Menu</span></button>`;
  const lead = `<p class="gatelead">${ic(I.enemyIcon('boss'))} ${g.killed ? `<b>${boss.name}</b> is dead.` : `<b>${boss.name}</b> got away.`} <b>${run.wave} of ${total}</b> waves cleared. ${g.final ? 'The expedition ends here.' : `${run.race ? 'Stop here' : 'Extract with the bag'}, or push on to waves ${run.wave + 1}–${run.wave + 4}.`}</p>`;
  let body: string;
  let foot: string;
  if (g.final) {
    const cleared = run.wave >= R.WAVES;
    body = `${chestPanel(ui, run, g)}<div class="panel way out"><h2>${icon('storage')} The expedition ends here</h2>
        <p>${cleared ? 'All twelve waves are cleared.' : `This expedition was ${plural(total, 'wave')} long.`} ${run.race ? 'The race banks nothing: your result is the record.' : 'Everything in the bag goes to storage.'}</p>
        <div class="tiles">${matTiles(ui, run.bagMats)}${schemTiles(ui, run.bagSchem)}</div>
        ${run.race ? '' : `<p class="small" style="margin:6px 0"><b>${cap(bagWords(run))}</b> to bank.</p><h4>What ${plural(run.totals.wavesCleared, 'wave')} pay</h4>${pays(run, cleared)}
        <p class="small dim" style="margin:8px 0 0">Scrap is not banked: your ${run.scrap} scrap is left behind, with the weapons and items.</p>`}
        ${chestDone ? '' : '<p class="note" style="margin:8px 0 0">Open the chest first: what is in it comes home too.</p>'}</div>`;
    foot = `${menu}<span class="footnote">${chestDone ? (run.race ? 'The race is run.' : `${cap(bagWords(run))} will be banked.`) : 'Open the chest first.'}</span>
      <button class="pri" data-a="extract" data-key="Enter" ${chestDone ? '' : 'disabled'}>${chestDone ? `Return to town <span class="kc">Enter</span>` : 'Open the chest first'}</button>`;
  } else {
    body = `${chestPanel(ui, run, g)}<div class="ways">${wildPanel(ui, run, g)}${extractCol(ui, run, chestDone)}${pushCol(ui, run, g)}</div>`;
    const risk = run.race || !run.feat.loss ? 'Nothing in the bag is at risk.' : hasBag ? `Fall, and ${100 - keep}% of the bag is lost.` : 'The bag is empty: nothing to lose yet.';
    const pushWhy = !chestDone ? 'Open the chest first.' : 'Take or decline the wild pick first.';
    foot = `${menu}<button class="choice out" data-a="extract" ${chestDone ? '' : 'disabled'}><b>${run.race ? 'Stop here' : 'Extract now'}</b><small>${chestDone ? (run.race ? 'End the race. Nothing is banked or lost.' : `Bank ${bagWords(run)}. The expedition ends; ${run.scrap} scrap is left behind.`) : 'Open the chest first.'}</small></button>
      <button class="choice pri" data-a="push" data-key="Enter" ${canPush ? '' : 'disabled'}><b>Push on <span class="kc">Enter</span></b><small>${canPush ? `Waves ${run.wave + 1}–${run.wave + 4}, then ${BOSSES[g.boss + 1].name}. ${risk}` : pushWhy}</small></button>`;
  }
  return { title: `Boss gate ${g.boss + 1}`, cur: cur(ui, run), body: `${lead}${expeditionStrip(ui, run)}${body}`, foot };
}
