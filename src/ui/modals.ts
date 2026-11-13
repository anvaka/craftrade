// Modal layers: the craft result, the brew result, the two-slot equip choice, confirmations, help.
import { ATOMS, PERKS, SKILL_CAP, WEAPONS, skillXpFor, type GearWeapon, type ModKey, type Skill } from '../data';
import * as M from '../meta';
import { BINDINGS } from '../input';
import type { Modal, UI } from './app';
import * as I from './icons';
import { rangeBar, ring, tile, tipHtml, ui as uiIcon } from './kit';
import { atomColor, cap, describe, describeGear, gearRarity, gearTier, perkQuality, RARITY_NAME } from './things';
import { controls } from './run-common';
import { volumeRows } from './sound-controls';
import { gearTile } from './town-inventory';
import * as Station from './town-station';

/** Every binding, from the same list the input code reads. */
export function controlsHtml(): string {
  return `<div class="keys small">${BINDINGS.map((b) => `<b>${b.name}</b><span>${[b.keys.map((k) => `<span class="kc">${k}</span>`).join(' '), b.mouse].filter(Boolean).join(' · ')}${b.touch ? ` <span class="dim">· touch: ${b.touch}</span>` : ''}</span>`).join('')}</div>`;
}

function box(title: string, body: string, o: { wide?: boolean; cls?: string; closable?: boolean } = {}): string {
  return `<div class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="box${o.wide ? ' wide' : ''} ${o.cls ?? ''}" tabindex="-1">
    <div class="mh">${title}${o.closable === false ? '' : `<button class="sm ghost" data-a="close" aria-label="Close">${uiIcon('close')}</button>`}</div><div class="mb">${body}</div></div></div>`;
}

function skillLine(ui: UI, skill: string, before: { lvl: number; xp: number }): string {
  const now = ui.p.skills[skill as Skill];
  if (!now) return '';
  const up = now.lvl > before.lvl;
  const gained = up ? 0 : now.xp - before.xp;
  return `<div class="row" style="justify-content:center;margin-top:12px">${ring(now.lvl >= SKILL_CAP ? 1 : now.xp / skillXpFor(now.lvl), now.lvl, 54, '')}
    <div style="text-align:left"><b>${cap(skill)}</b> ${up ? `<span class="gold">rose to level ${now.lvl}</span>` : `<span style="color:var(--xp)">+${Math.round(gained)} xp</span>`}<br>
    <span class="dim small">${now.lvl >= SKILL_CAP ? 'At the cap.' : `${Math.round(now.xp)} / ${skillXpFor(now.lvl)} to level ${now.lvl + 1}`}</span></div></div>`;
}

function result(ui: UI, m: Extract<Modal, { kind: 'result' }>): string {
  const p = ui.p;
  const made = m.uids.map((u) => M.gearBy(p, u)).filter((g) => !!g);
  if (!made.length) return box('Made', '<p class="dim">Dismantled.</p><button class="big" data-a="close" data-key="Enter">Back</button>');
  const more = Station.moreNow(ui);
  const againBtn = `<button class="pri big" data-a="${m.again}" data-key="Enter" ${more.n > 0 ? '' : 'disabled'}>${more.n > 0 ? `Craft another <span class="kc">Enter</span>` : more.why}</button>
    <p class="dim small" style="text-align:center;margin:4px 0 0">${more.n > 0 ? `Materials for ${more.n} more.` : ''}</p>`;
  const count = (kind: string) => p.gear.filter((g) => g.kind === kind).length;
  if (made.length > 1) {
    // a batch: every roll listed, best first
    const rows = [...made].sort((a, b) => (b.kind === 'weapon' ? b.gs : 0) - (a.kind === 'weapon' ? a.gs : 0)).map((g) => `<div class="item">${gearTile(ui, g)}<div class="grow"><div class="nm r${gearRarity(g)}">${g.name}${g.kind === 'weapon' ? ` <span class="num gold">${g.gs}</span>` : ''}</div>
      <div class="sub">${g.kind === 'weapon' ? g.perks.map((x) => `${PERKS[x].name}${x === g.rolled ? ' <span class="warn">rolled</span>' : ''}`).join(' · ') : ''}</div></div>
      <div class="act"><button class="sm" data-a="equip" data-v="${g.uid}">Equip</button><button class="sm danger" data-a="scrapgear" data-v="${g.uid}">Dismantle</button></div></div>`).join('');
    return box(`${made.length} made`, `${rows}<p class="dim small" style="margin:10px 0">All ${made.length} are in your Inventory (${count(made[0].kind)} ${made[0].kind}s). <button class="link" data-a="goto" data-v="gear:${made[0].uid}">Show them</button></p>
      ${skillLine(ui, m.skill, m.before)}<div class="stack" style="margin-top:12px">${againBtn}<button class="big ghost" data-a="close" data-key="Escape">Done <span class="kc">Esc</span></button></div>`, { wide: true });
  }
  const g = made[0];
  const d = describeGear(g, ui.ctx);
  const r = gearRarity(g);
  let body = `<div class="glow">${tile(d, { size: 'xl' })}
    <div class="nm r${r}" style="font:600 22px var(--serif);letter-spacing:.14em;text-transform:uppercase;margin-top:10px">${g.name}</div>
    <div class="dim small">${d.type}</div>`;
  if (g.kind === 'weapon') {
    // the range it was really rolled in: the craft itself may have raised the skill, and a pattern has its own range
    const now = M.gsRange(p, gearTier(g));
    const range = g.roll ? { min: Math.min(now.min, g.roll[0]), lo: g.roll[0], hi: g.roll[1] } : now;
    const q = perkQuality(g.gs);
    body += `<div style="max-width:340px;margin:12px auto 0"><div class="bignum">${g.gs}</div><div class="dim small">gear score · rolled between ${range.lo} and ${range.hi}</div>${rangeBar(range.min, range.hi, range.lo, range.hi, { pin: g.gs })}</div>
      <div class="perks">${g.perks.map((x, i) => `<div class="pk" style="animation-delay:${0.15 + i * 0.12}s">${I.modIcon(PERKS[x].mods[0][0] as ModKey)}<div><b>${PERKS[x].name}</b><span class="tag">${x === g.rolled ? 'rolled' : g.rolled && m.chosen.includes(x) ? 'chosen' : ''}</span><br><span class="dim">${cap(describeGear(g, ui.ctx).perks.find((pk) => pk.name === PERKS[x].name)?.text ?? '')}</span></div></div>`).join('')}
      <p class="dim small" style="margin-top:6px">Perk strength ×${q.toFixed(2)} from the gear score. ${RARITY_NAME[r]}: ${g.perks.length} perk${g.perks.length === 1 ? '' : 's'}.</p></div>`;
  } else if (g.kind === 'bag') body += `<div class="bignum" style="margin-top:10px">${g.comfort}</div><div class="dim small">weight carried before slowing${g.burden ? ` · ${g.burden} weighs 40% less` : ''}</div>`;
  else body += `<div class="perks">${d.perks.map((pk) => `<div class="pk">${pk.icon}<div>${pk.text}</div></div>`).join('')}<p class="dim small">${d.notes[0] ?? ''}</p></div>`;
  body += `</div><p class="small" style="margin:10px 0">${uiIcon('check')} In your <b>Inventory</b> under ${cap(g.kind)}s (${count(g.kind)} owned). <button class="link" data-a="goto" data-v="gear:${g.uid}">Show it</button></p>${skillLine(ui, m.skill, m.before)}`;
  const l = p.loadout;
  let equip: string;
  if (g.kind === 'weapon') {
    equip = `<div class="two">${[0, 1].map((i) => {
      const cur = M.gearBy(p, l.weapons[i]) as GearWeapon | undefined;
      const here = l.weapons[i] === g.uid;
      return `<button class="big" style="flex-direction:column;gap:0" data-a="equip" data-v="${g.uid}" data-w="${i}" ${here ? 'disabled' : ''}>${here ? `In slot ${i + 1}` : `Equip in slot ${i + 1}`}${!here && cur ? `<span class="dim small">replaces ${cur.name} ${cur.gs}</span>` : ''}</button>`;
    }).join('')}</div>`;
  } else {
    const here = (g.kind === 'tool' ? l.tool : l.bag) === g.uid;
    const cur = M.gearBy(p, g.kind === 'tool' ? l.tool : l.bag);
    equip = `<button class="big" data-a="equip" data-v="${g.uid}" ${here ? 'disabled' : ''}>${here ? 'Equipped' : `Equip${cur ? ` <span class="dim small">replaces ${cur.name}</span>` : ''}`}</button>`;
  }
  body += `<div class="stack" style="margin-top:14px;text-align:left">${againBtn}${equip}
    <div class="two"><button class="big ghost" data-a="lock" data-v="${g.uid}">${g.locked ? `${uiIcon('unlock')} Unlock` : `${uiIcon('lock')} Lock`}</button><button class="big danger" data-a="scrapgear" data-v="${g.uid}" ${g.locked || (g.kind === 'weapon' ? l.weapons.includes(g.uid) : false) ? 'disabled' : ''}>Dismantle for 2 coin</button></div>
    <button class="big ghost" data-a="close" data-key="Escape">Done <span class="kc">Esc</span></button></div>`;
  return box('Forged', body, { cls: `result r${r}` });
}

function brewed(ui: UI, m: Extract<Modal, { kind: 'brewed' }>): string {
  const more = Station.moreNow(ui);
  const d = m.key ? describe(`brew:${m.key}`, ui.ctx) : null;
  return box(m.ok ? 'Brewed' : 'Sludge', `<div class="glow">${d ? `${tile(d, { size: 'xl', qty: `×${m.count}` })}<div class="nm r${d.rarity}" style="font:600 20px var(--serif);letter-spacing:.12em;text-transform:uppercase;margin-top:10px">${d.name}</div>` : `<div class="tile xl static">${I.brewIcon('flask', '#55503f')}</div>`}
      <p style="margin-top:10px">${m.title}</p>
      ${d ? `<div class="perks">${d.perks.map((pk) => `<div class="pk">${pk.icon}<div>${pk.text}</div></div>`).join('')}${d.warn ? `<p class="warn small">${d.warn}</p>` : ''}<p class="dim small">${d.stats.map(([k, v]) => `${k}: ${v}`).join(' · ')}</p></div>` : ''}
      ${m.found.length ? `<p class="gold" style="margin-top:8px">${uiIcon('star')} Discovered: ${m.found.map((x) => `<span class="chip"><i style="width:9px;height:9px;border-radius:50%;background:${atomColor(x)}"></i>${ATOMS[x as keyof typeof ATOMS].name}</span>`).join('')}</p>` : ''}
      ${m.lines.map((x) => `<p class="dim small">${x}</p>`).join('')}</div>
    ${m.key ? `<p class="small" style="margin:10px 0">${uiIcon('check')} In your <b>Inventory</b> under Brews. Pack it into the loadout before you leave. <button class="link" data-a="goto" data-v="brew:${m.key}">Show it</button></p>` : ''}
    ${skillLine(ui, 'alchemy', (m as unknown as { before?: { lvl: number; xp: number } }).before ?? ui.p.skills.alchemy)}
    <div class="stack" style="margin-top:12px">${m.ok ? `<button class="pri big" data-a="brew" data-key="Enter" ${more.n > 0 ? '' : 'disabled'}>${more.n > 0 ? 'Brew again <span class="kc">Enter</span>' : more.why}</button>
      <button class="big ghost" data-a="close" data-key="Escape">Done <span class="kc">Esc</span></button>` : `<button class="pri big" data-a="close" data-key="Enter">Choose another pair <span class="kc">Enter</span></button>`}</div>`, { cls: `result r${d?.rarity ?? 0}` });
}

function equipChoice(ui: UI, uid: number): string {
  const p = ui.p;
  const g = M.gearBy(p, uid);
  if (g?.kind !== 'weapon') return '';
  const rows = [0, 1].map((i) => {
    const cur = M.gearBy(p, p.loadout.weapons[i]) as GearWeapon | undefined;
    return `<button class="item pickable" style="width:100%;text-align:left" data-a="equip" data-v="${uid}" data-w="${i}" data-key="${i + 1}">${cur ? gearTile(ui, cur) : `<span class="tile empty static">${I.weaponIcon('blade')}</span>`}
      <div class="grow"><div class="nm">Slot ${i + 1} <span class="kc">${i + 1}</span></div><div class="sub">${cur ? `replaces ${cur.name}, gear score ${cur.gs}, ${cur.perks.map((x) => PERKS[x].name).join(' · ') || 'no perks'} · ability ${WEAPONS[cur.fam].ability.name}` : 'empty'}</div></div></button>`;
  }).join('');
  return box('Equip in which slot?', `<div class="detail" style="margin-bottom:10px">${tipHtml(describeGear(g, ui.ctx))}</div>${rows}`);
}

function help(ui: UI): string {
  const p = ui.p;
  const guiding = !!p.guided && p.sessions < M.GUIDE_STEPS;
  return box('Help and settings', `<h4 style="margin-top:0">Controls in the arena</h4>${controls()}
    <h4>In the menus</h4><p class="small dim">Number keys switch tabs and pick numbered choices. Enter or Space presses the bright button. Escape closes a window. Hover a tile to read it (on touch, tap it).</p>
    <h4>Settings</h4><div class="stack">
      <button class="big" data-a="mute">${uiIcon(ui.hooks.sound.muted ? 'sound-off' : 'sound-on')} Sound is ${ui.hooks.sound.muted ? 'off: turn on' : 'on: turn off'}</button>
      ${volumeRows(ui.hooks.sound)}
      ${guiding ? `<button class="big" data-a="openall">Skip the guided start: open everything now</button>` : ''}
      <button class="big danger" data-a="wipe">Delete the save and start over</button></div>
    <p class="dim small" style="margin-top:10px">The game saves by itself in this browser: in town after every action, and on an expedition at camp and at boss gates. Leaving in the middle of a wave counts as a fall.</p>`, { wide: true });
}

export function view(ui: UI, m: Modal): string {
  switch (m.kind) {
    case 'result': return result(ui, m);
    case 'brewed': return brewed(ui, m);
    case 'equip': return equipChoice(ui, m.uid);
    case 'confirm': return box('Are you sure?', `<p>${m.text}</p><div class="row end" style="margin-top:14px"><button data-a="close" data-key="Escape">Cancel <span class="kc">Esc</span></button><button class="danger" data-a="yes">${m.yes}</button></div><p class="dim small" style="margin-top:8px;text-align:right">Confirm with a click. Esc cancels.</p>`, { closable: false });
    case 'help': return help(ui);
    case 'info': return box(m.title, m.html, { wide: true });
    default: return '';
  }
}

export function act(_ui: UI, _a: string, _v: string, _w: string): boolean | 'leave' | void {
  return false;
}
