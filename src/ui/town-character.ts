// The Character tab: trade skills, weapon mastery and kits, town standing and its cards, the weekly vault, the record.
import {
  BAG_TYPES, CARDS, CFG, CODEX_RANKS, FAMS, FAM_CAP, ITEMS, KITS, POOL_UNLOCK, SKILLS, SKILL_CAP, WEAPONS, WILDS, modText, poolName, skillXpFor,
  type Fam, type Skill,
} from '../data';
import * as Log from '../log';
import * as M from '../meta';
import type { Page, UI } from './app';
import * as I from './icons';
import { bar, esc, ic, note, pips, ring, ui as uiIcon } from './kit';
import { cap, roman } from './things';
import { weekLeft } from './town-expedition';

const SUBS = ['Skills', 'Mastery', 'Standing', 'Vault', 'Record'] as const;
type Sub = (typeof SUBS)[number];
const SUB_NAME: Record<Sub, string> = { Skills: 'Trade skills', Mastery: 'Mastery and kits', Standing: 'Standing', Vault: 'Weekly vault', Record: 'Record' };
const num = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
const WAVES = CFG.waveDur.length;
const RANK_POINTS = 8; // mastery points per mastery rank (see meta.masteryRank)

// ------------------------------------------------------------ trade skills
interface SkillInfo {
  group: 'Gathering' | 'Crafting';
  /** The bonus at a level, as "<number> <what it is>". */
  bonus: (lvl: number) => [string, string];
  also?: (lvl: number) => string;
  earn: string;
}
const yieldOf = (what: string) => (lvl: number): [string, string] => [`+${num((lvl - 1) * 1.5)}%`, what];
const SKILL_INFO: Record<Skill, SkillInfo> = {
  mining: { group: 'Gathering', bonus: yieldOf('ore from every vein'), earn: '1 xp for each ore mined' },
  logging: { group: 'Gathering', bonus: yieldOf('wood from every tree'), earn: '1 xp for each wood cut' },
  harvesting: { group: 'Gathering', bonus: yieldOf('herbs from every reed bed'), earn: '1 xp for each herb cut' },
  skinning: { group: 'Gathering', bonus: (l) => [`+${(l - 1) * 2}%`, 'drops from kills'], also: () => "It multiplies each enemy's own chance to leave a creature part: at +20%, a 10% chance becomes 12%.", earn: '1.5 xp for each creature part picked up' },
  smithing: {
    group: 'Crafting', bonus: (l) => [`+${l * 2}`, 'lowest gear score a forged weapon can roll'],
    also: (l) => `Weapons made from patterns: +${l * 4} gear score.`,
    earn: '20 xp × grade for a weapon, 14 × grade for a tool, 60 for a pattern',
  },
  outfitting: { group: 'Crafting', bonus: (l) => [`+${l}`, 'comfort on every bag you make from the bag list'], also: () => 'Bags from named patterns have a fixed comfort.', earn: '25 xp × the workshop tier of the bag, 60 for a pattern' },
  alchemy: { group: 'Crafting', bonus: (l) => [`${(l - 1) * 4}%`, 'chance of one more brew from a batch'], earn: '12 xp for a brew, 3 for sludge' },
};

function skillTile(p: M.Profile, s: Skill): string {
  const info = SKILL_INFO[s];
  const { lvl, xp } = p.skills[s];
  const capped = lvl >= SKILL_CAP;
  const need = skillXpFor(lvl);
  const [n, what] = info.bonus(lvl);
  const [n2] = info.bonus(lvl + 1);
  return `<div class="skt">${ring(capped ? 1 : xp / need, lvl, 92, 'Level', capped ? 'var(--gold)' : 'var(--ring)')}
    <div class="sk-b"><div class="sk-n">${ic(I.skillIcon(s))}${cap(s)}</div>
      <div class="sk-x small">${capped ? `<span class="gold">At the cap, level ${SKILL_CAP}</span>` : `<b class="num">${Math.floor(xp)}</b> / ${need} xp to level ${lvl + 1}`}</div>
      <div class="sk-v"><b class="num">${n}</b> <span class="small">${what}</span></div>
      <div class="small dim">${capped ? 'No further levels.' : `At level ${lvl + 1}: ${n2}.`}${info.also ? ` ${info.also(lvl)}` : ''}</div>
      <div class="small dim">Earned: ${info.earn}.</div></div></div>`;
}
function skills(ui: UI): string {
  const p = ui.p;
  const group = (g: SkillInfo['group']) => SKILLS.filter((s) => SKILL_INFO[s].group === g).map((s) => skillTile(p, s)).join('');
  return `<div class="hd">Gathering</div>
    <p class="dim small">Raised by what you gather on expeditions, whether or not the bag comes home. The xp is multiplied by the share of the ${WAVES} waves you cleared (never less than a tenth).</p>
    <div class="skills">${group('Gathering')}</div>
    <div class="hd" style="margin-top:18px">Crafting</div>
    <p class="dim small">Raised by making things in town. Gear score runs from 200 to 500 and strengthens a weapon's perks from ×1.0 to ×1.5. Comfort is the weight a bag carries before it slows you.</p>
    <div class="skills">${group('Crafting')}</div>
    <p class="dim small" style="margin-top:12px">Every skill stops at level ${SKILL_CAP}. Each level above 1 is also one mastery point.</p><p class="small"><button class="link pad" data-a="sub" data-v="Mastery">See mastery and kits</button></p>`;
}

// ------------------------------------------------------- mastery and kits
function mastery(ui: UI): string {
  const p = ui.p;
  const points = M.masteryPoints(p);
  const rank = M.masteryRank(p);
  const into = points % RANK_POINTS;
  const topKit = Math.max(...KITS.map((k) => k.rank));
  const fam = (f: Fam) => {
    const { lvl, xp } = p.fams[f];
    const capped = lvl >= FAM_CAP;
    return `<div class="famt">${ring(capped ? 1 : xp / M.famXpFor(lvl), lvl, 76, '', capped ? 'var(--gold)' : '#28b4dc')}
      <div class="sk-n">${ic(I.famIcon(f))}${WEAPONS[f].name}</div>
      <div class="small dim">${capped ? `At the cap, level ${FAM_CAP}` : `Level ${lvl}/${FAM_CAP}<br><b class="num">${Math.floor(xp)}</b> / ${M.famXpFor(lvl)} xp`}</div></div>`;
  };
  const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
  const feeds: [string, number, string][] = [
    ['Weapon families', sum(FAMS.map((f) => p.fams[f].lvl - 1)), '1 for each level above 1'],
    ['Trade skills', sum(SKILLS.map((s) => p.skills[s].lvl - 1)), '1 for each level above 1'],
    ['Kinds of bag made', p.bagTypes.length * 2, `2 each: ${p.bagTypes.length} of ${Object.keys(BAG_TYPES).length} kinds`],
    ['Codex rank', M.codexRank(p) * 3, `3 each: rank ${M.codexRank(p)} of ${CODEX_RANKS.length}`],
  ];
  const kits = KITS.map((k) => {
    const open = k.rank <= rank;
    const cls = open ? 'done' : k.rank === rank + 1 ? 'next' : 'locked';
    const chosen = p.loadout.kit === k.id;
    return `<div class="ms ${cls}" data-tip="kit:${k.id}"><div class="lv">${k.rank === 0 ? 'Start' : `Rank ${k.rank}`} ${open ? uiIcon('check') : uiIcon('lock')}</div>
      <div><b>${k.name}</b>${chosen ? ' <span class="ok small">in use</span>' : ''}</div><div class="small dim">${k.text}</div>
      <div class="small">${open ? (p.kitBest[k.id] ? `Best full clear: danger ${p.kitBest[k.id]}` : '<span class="dim">Open. No full clear yet.</span>') : `<span class="warn">${(k.rank - rank) * RANK_POINTS - into} more mastery points</span>`}</div></div>`;
  }).join('');
  return `<div class="cols mast">
    <section class="panel"><h2>Weapon mastery</h2>
      <p class="dim small">Every kill earns its weapon's family 0.25 xp (a kill by the heavy swing, an ability, burning or thorns counts for the family of the ability you have selected), multiplied by the share of the ${WAVES} waves you cleared (never less than a tenth). A family stops at level ${FAM_CAP}. Levels give no stats: each one above 1 is a mastery point.</p>
      <div class="fams">${FAMS.map(fam).join('')}</div></section>
    <section class="panel"><h2>Mastery rank</h2>
      <div class="row"><span class="bignum">${rank}</span><div class="grow"><div class="small"><b>${into}</b> of ${RANK_POINTS} points toward rank ${rank + 1} · ${points} points in all</div>
        <div class="row" style="margin-top:4px">${bar(into / RANK_POINTS, 'tall blue')}</div></div></div>
      <p class="dim small" style="margin:8px 0">Every ${RANK_POINTS} mastery points are one rank. A point comes from each weapon-family level and each trade-skill level above 1; each kind of bag made gives 2 and each codex rank 3. Ranks open kits, not stats.${rank >= topKit ? ' All kits are open.' : ''}</p>
      <h4>Where your points come from</h4>
      ${feeds.map(([name, n, how]) => `<div class="kv small"><span>${name} <span class="dim">· ${how}</span></span><span class="num">${n}</span></div>`).join('')}</section></div>
    <section class="panel" style="margin-top:12px"><h2>Kits</h2>
      <p class="dim small">A kit is a rule for a whole expedition, chosen on the Expedition tab.</p><p class="small"><button class="link pad" data-a="goto" data-v="Expedition">Choose a kit</button></p>
      <div class="milestones wrap kits">${kits}</div></section>`;
}

// ------------------------------------------------------------- standing
/** What a pool entry does, in words. */
function poolEffect(key: string): string {
  if (key.startsWith('wild:')) return WILDS.find((w) => `wild:${w.id}` === key)?.text ?? '';
  const it = ITEMS[key];
  if (!it) return '';
  return `${cap([it.heal ? `heals ${it.heal} health` : '', modText(it.mods)].filter(Boolean).join(', '))}. Shop item, tier ${roman(it.tier)}.`;
}
/** The pick-one-of-three. Clicking a card asks first: the pick is permanent. */
export function cardPickHtml(ui: UI): string {
  const p = ui.p;
  const dealt = !p.standing.offer;
  const offer = M.cardOffer(p);
  if (!offer) return '';
  if (dealt) M.save(p); // the three cards are fixed once dealt: a reload must not deal again
  const cards = offer.map((id, i) => {
    const c = CARDS.find((x) => x.id === id)!;
    const held = p.standing.cards[id] ?? 0;
    return `<button type="button" class="card3" data-a="card" data-v="${id}" data-key="${i + 1}"><span class="med">${I.uiIcon('standing')}</span><span class="nm">${c.name}</span>
      <span>${c.text}</span><span class="small dim">${pips(held, c.max)} ${held} of ${c.max} held</span><span class="kc">${i + 1}</span></button>`;
  }).join('');
  return `<section class="panel claim"><div class="claim-h"><span>Claim your reward</span><span class="small">${p.standing.pending} to pick</span></div>
    <p class="small" style="margin:10px 0">Pick one card. The pick is permanent and the other two go back into the pool. The same card can be taken again up to its limit.</p>
    <div class="cards3">${cards}</div></section>`;
}
function standing(ui: UI): string {
  const p = ui.p;
  const st = p.standing;
  const need = M.standingFor(st.lvl);
  const held = CARDS.filter((c) => (st.cards[c.id] ?? 0) > 0);
  const rest = CARDS.filter((c) => !(st.cards[c.id] ?? 0));
  const cardRow = (c: (typeof CARDS)[number]) => {
    const n = st.cards[c.id] ?? 0;
    return `<div class="item${n ? '' : ' unheld'}"><span class="med sm">${I.uiIcon('standing')}</span><div class="grow"><div class="nm">${c.name}</div><div class="sub">${c.text}${n > 1 ? ` <span class="gold">Held ${n} times.</span>` : ''}</div></div>
      <div class="act small">${pips(n, c.max)}<span class="num">${n} / ${c.max}</span></div></div>`;
  };
  const byLvl = new Map<number, string[]>();
  for (const [key, lvl] of Object.entries(POOL_UNLOCK).sort((a, b) => a[1] - b[1])) byLvl.set(lvl, [...(byLvl.get(lvl) ?? []), key]);
  const nextLvl = [...byLvl.keys()].find((l) => l > st.lvl);
  const pool = [...byLvl.entries()].map(([lvl, keys]) => {
    const cls = lvl <= st.lvl ? 'done' : lvl === nextLvl ? 'next' : 'locked';
    return `<div class="ms ${cls}"><div class="lv">Standing ${lvl} ${lvl <= st.lvl ? uiIcon('check') : ''}</div>${keys.map((k) => `<div class="small pool" data-tip="${esc(k.startsWith('wild:') ? k : `item:${k}`)}"><b>${poolName(k)}</b><br><span class="dim">${poolEffect(k)}</span></div>`).join('')}</div>`;
  }).join('');
  const fullClear = Math.round(WAVES * 9 + 40);
  return `${cardPickHtml(ui)}
    <div class="cols" style="margin-top:${st.pending > 0 ? 12 : 0}px">
    <section class="panel"><h2>Town standing</h2>
      <div class="row">${ring(st.xp / need, st.lvl, 92, 'Level', 'var(--gold)')}<div class="grow">
        <div class="small"><b class="num">${Math.floor(st.xp)}</b> / ${need} standing to level ${st.lvl + 1}</div>
        <div class="row" style="margin:4px 0 8px">${bar(st.xp / need, 'tall')}</div>
        <div class="small dim">Each level is one card to pick, for good.</div></div></div>
      <h4>How it is earned</h4>
      <div class="kv small"><span>Each wave cleared</span><span class="num">+9</span></div>
      <div class="kv small"><span>A full clear of all ${WAVES} waves <span class="dim">· ${fullClear} in all</span></span><span class="num">+40</span></div>
      <div class="kv small"><span>Materials given to town projects <span class="dim">· Inventory</span></span><span>half its tier, for each one</span></div>
      <div class="kv small"><span>A full clear with all three bosses dead, at a higher danger than that kit has cleared before</span><span>one more card</span></div>
      <button class="sm" style="margin-top:8px" data-a="goto" data-v="Inventory">Give materials in the Inventory</button></section>
    <section class="panel"><h2>Cards <span class="num cnt">${held.reduce((a, c) => a + st.cards[c.id], 0)} held</span></h2>
      ${held.length ? held.map(cardRow).join('') : '<p class="dim small">None held yet. The first comes at standing level 2.</p>'}
      ${rest.length ? `<h4>Not held yet</h4>${rest.map(cardRow).join('')}` : ''}</section></div>
    <section class="panel" style="margin-top:12px"><h2>The pool grows with standing</h2>
      <p class="dim small">The pool is what an expedition can offer you: the items the camp shop sells between waves, and the wild picks (a strong rule with a price) offered after a boss. These join it from the next expedition you begin at that standing.</p>
      <div class="milestones wrap">${pool}</div></section>`;
}

// ---------------------------------------------------------------- vault
const more = (n: number) => `${n} more expedition${n === 1 ? '' : 's'}`;

function vault(ui: UI): string {
  const p = ui.p;
  const wk = p.week;
  const opts = M.vaultOptions(p).map((o, i) => ({ ...o, i }));
  // What was taken is kept as the option's id and what it gave then; the labels below follow this week's counts and move on.
  const taken = wk.claimed ? wk.taken : undefined;
  const takenOpt = typeof taken === 'object' ? opts.find((o) => o.id === taken.id) : undefined;
  const takenText = typeof taken === 'object' ? `${takenOpt ? `${takenOpt.row}: ` : ''}${taken.got}` : taken; // older saves hold a plain label
  const runs = wk.runs;
  const names = [...new Set(opts.map((o) => o.row))];
  const firstOf = (row: string) => opts.find((o) => o.row === row)!;
  const top = Math.max(...opts.map((o) => o.need));
  const rows = names.map((row) => {
    const list = opts.filter((o) => o.row === row);
    const need = list[0].need;
    const open = runs >= need;
    const shutAbove = names.filter((r) => firstOf(r).need > need && runs < firstOf(r).need);
    const choices = list.map((o, k) => {
      const mine = typeof taken === 'object' ? taken.id === o.id : !!taken && taken === `${o.row}: ${o.label}`;
      return `<div class="item${mine ? ' on' : ''}"><div class="grow">${cap(mine && typeof taken === 'object' ? taken.got : o.label)}${k > 0 ? ' <span class="chip">Vault key card</span>' : ''}${mine ? ` <span class="ok small">${uiIcon('check')} Taken this week</span>` : ''}</div><div class="act">${
        !wk.claimed && open ? `<button class="sm${shutAbove.length ? ' ghost' : ''}" data-a="vault" data-v="${o.i}">Take</button>` : ''}</div></div>`;
    }).join('');
    const status = wk.claimed ? '<span class="small dim">Shut until next week</span>'
      : open ? `<span class="small ok">${uiIcon('check')} Open</span>`
      : `<span class="small warn">${uiIcon('lock')} ${more(need - runs)} this week</span>`;
    return `<div class="vrow${open && !wk.claimed ? ' open' : ' shut'}"><div class="vth"><b class="num">${need}</b><span class="small">expedition${need === 1 ? '' : 's'}</span></div>
      <div class="grow"><div class="row"><b>${row}</b>${status}</div>
        <div class="row small" style="margin:4px 0">${bar(Math.min(1, runs / need), open ? 'green' : '')}<span class="num">${Math.min(runs, need)} of ${need}</span></div>${choices}
        ${!wk.claimed && open && shutAbove.length ? `<div class="small warn">Taking from this row gives up the ${shutAbove.join(' and ')} row${shutAbove.length > 1 ? 's' : ''} for this week.</div>` : ''}</div></div>`;
  }).join('');
  return `<section class="panel" style="max-width:860px"><h2>Weekly vault</h2>
    <div class="row" style="margin-bottom:8px"><span class="bignum">${runs}</span><div class="grow"><div><b>of ${top} expeditions this week</b></div>
      <div class="small dim">An expedition counts when it clears four waves or more. The week resets on Monday (00:00 UTC), in ${weekLeft()}.</div>
      <div class="row" style="margin-top:4px">${bar(Math.min(1, runs / top), 'tall')}</div></div></div>
    ${wk.claimed ? note(`${uiIcon('check')} Taken for this week${takenText ? `: ${takenText}` : ''}. The vault fills again in ${weekLeft()}.`) : '<p class="small">Take <b>one</b> item a week, from any open row. Higher rows open with more expeditions, and taking from a lower row closes the vault for the week. A missed week costs nothing.</p>'}
    ${rows}
    ${(p.standing.cards.vault ?? 0) > 0 ? '' : '<p class="dim small" style="margin-top:8px">The Vault key standing card adds one more choice to every row.</p>'}</section>`;
}

// --------------------------------------------------------------- record
function record(ui: UI): string {
  const p = ui.p;
  const kv = (a: string, b: string | number) => `<div class="kv"><span class="dim">${a}</span><span class="num">${b}</span></div>`;
  const rank = M.masteryRank(p);
  return `<div class="cols">
    <section class="panel"><h2>Expeditions</h2>
      ${kv('Begun', p.stats.runs)}${kv(`Full clears (all ${WAVES} waves)`, p.stats.clears)}${kv('Falls', p.stats.deaths)}${kv('Deepest wave cleared', `${p.stats.bestWave} of ${WAVES}`)}${kv('Completed this week', p.week.runs)}</section>
    <section class="panel"><h2>Records</h2>
      ${kv('Best haul banked (ore, wood, herbs)', p.records.haul)}${kv('Most kills in one expedition', p.records.kills)}
      ${kv('Key (highest danger you may set)', p.key)}${kv('Weekly race, best this week', p.race.waves ? `${p.race.waves} waves in ${p.race.time} s` : 'no run yet')}</section>
    <section class="panel"><h2>Best full clear by kit</h2>
      ${KITS.map((k) => `<div class="kv"><span class="${k.rank > rank ? 'dim' : ''}">${k.name}</span><span>${p.kitBest[k.id] ? `<span class="num">danger ${p.kitBest[k.id]}</span>` : k.rank > rank ? `<span class="dim small">${uiIcon('lock')} mastery rank ${k.rank}</span>` : '<span class="dim small">no full clear yet</span>'}</span></div>`).join('')}
      <p class="dim small" style="margin-top:8px">A full clear with all three bosses dead pays a standing card each time it beats that kit's highest danger so far. Clearing a lower danger afterwards pays none.</p></section>
    ${logPanel()}</div>`;
}

/** The play log: what it holds and how to hand it over. */
function logPanel(): string {
  const i = Log.info();
  return `<section class="panel"><h2>Play log</h2>
      <p class="small">Every wave, camp purchase and town action is written to a log in this browser: where expeditions ended, what you bought, what each weapon did, how far heat went. It is for reading balance, and it never leaves this browser unless you save or copy it.</p>
      <div class="kv"><span class="dim">Expeditions logged</span><span class="num">${i.runs}</span></div>
      <div class="kv"><span class="dim">Town actions logged</span><span class="num">${i.town}</span></div>
      <div class="kv"><span class="dim">Size</span><span class="num">${i.kb} KB</span></div>
      <div class="kv"><span class="dim">Since</span><span>${esc(i.since.slice(0, 10))}</span></div>
      <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="sm" data-a="logsave">Save as a file</button>
        <button class="sm" data-a="logcopy">Copy to clipboard</button>
        <button class="sm danger" data-a="logclear" ${i.runs + i.town ? '' : 'disabled'}>Clear the log</button></div>
      <p class="dim small" style="margin-top:8px">The log keeps the last 300 expeditions. Clearing it does not touch your save.</p></section>`;
}

// ------------------------------------------------------------------ page
const subOf = (ui: UI): Sub => (SUBS as readonly string[]).includes(ui.s.sub) ? (ui.s.sub as Sub) : 'Skills';

export function view(ui: UI): Page {
  const p = ui.p;
  const sub = subOf(ui);
  const badge: Partial<Record<Sub, number>> = {
    Standing: p.standing.pending,
    Vault: !p.week.claimed && M.vaultOptions(p).some((o) => p.week.runs >= o.need) ? 1 : 0,
  };
  const nav = `<div class="subnav" role="tablist">${SUBS.map((s) => `<button class="seg${s === sub ? ' on' : ''}" role="tab" aria-selected="${s === sub}" data-a="sub" data-v="${s}">${SUB_NAME[s]}${badge[s] ? `<span class="badge">${badge[s]}</span>` : ''}</button>`).join('')}</div>`;
  const body = { Skills: skills, Mastery: mastery, Standing: standing, Vault: vault, Record: record }[sub](ui);
  return { body: `<div class="prog">${nav}${body}</div>` };
}

export function act(ui: UI, a: string, v: string, _w: string): boolean | 'leave' | void {
  const p = ui.p;
  const snd = ui.hooks.sound;
  switch (a) {
    case 'card': {
      const c = CARDS.find((x) => x.id === v);
      if (!c || !p.standing.offer?.includes(v)) return ui.fail('That card is not on offer.') || true;
      if (!ui.ask(`Take <b>${c.name}</b>? ${c.text} The pick is permanent.`, `Take ${c.name}`, 'card', v)) return true;
      M.pickCard(p, v);
      const n = p.standing.cards[v] ?? 0;
      ui.say(`<b>${c.name}</b> taken (${n} of ${c.max}). ${c.text}${p.standing.pending > 0 ? ` ${p.standing.pending} more to pick.` : ''}`);
      snd.ui('buy');
      return true;
    }
    case 'logsave': {
      const name = `craftworld-log-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(new Blob([Log.exportText(p)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      ui.say(`Saved as <b>${name}</b> in your downloads.`);
      return true;
    }
    case 'logcopy': {
      const text = Log.exportText(p);
      const done = (ok: boolean) => (ok ? ui.say(`The log is on the clipboard (${Math.round(text.length / 1024)} KB).`) : ui.fail('The browser refused the clipboard. Save it as a file instead.'));
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
      else done(false);
      return true;
    }
    case 'logclear':
      if (!ui.ask('Clear the play log? Your save is not touched; only the history of waves and purchases goes.', 'Clear the log', 'logclear')) return true;
      Log.clear();
      ui.say('The play log is empty.');
      return true;
    case 'vault': {
      const i = Number(v);
      const o = M.vaultOptions(p)[i];
      if (!o) return true;
      if (p.week.claimed) return ui.fail('Already taken this week.') || true;
      if (p.week.runs < o.need) return ui.fail(`This row opens after ${o.need} expeditions this week.`) || true;
      const opts = M.vaultOptions(p);
      const above = [...new Set(opts.filter((x) => x.need > o.need && p.week.runs < x.need).map((x) => `the ${x.row} row opens after ${more(x.need - p.week.runs)}`))];
      const warn = above.length ? ` <b>You would give up better rows:</b> ${above.join(', and ')}. The week has ${weekLeft()} left.` : '';
      if (!ui.ask(`Take ${o.label}? It is your one item from the vault this week.${warn}`, above.length ? 'Take it and close the vault' : 'Take it', 'vault', v)) return true;
      if (M.claimVault(p, i)) {
        ui.say(`From the vault: ${o.label}.`);
        snd.ui('merge');
      }
      return true;
    }
  }
  return false;
}
