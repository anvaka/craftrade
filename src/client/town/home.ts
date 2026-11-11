// The stash tab, which is also home: the next run, who heads out, the
// stash and kit, and the account in figures.

import { TITLE } from '../../shared/almanac.ts';
import { isRelic, itemPoints } from '../../shared/item.ts';
import { DAILY_WAVES, KIT_CHARGES, KIT_SLOTS, type CharacterId, type StashItem } from '../../shared/protocol.ts';
import { HAZARD_MARKS, MAX_HAZARD, REPAIR, canPay, kitPointCap, packItem, repairCost, stashNextCost, type Cost } from '../../shared/rules.ts';
import { audio } from '../audio/index.ts';
import { api } from './api.ts';
import { charges, el, empty, finder, fmt, itemRow, ordinal, plural, sprite, sprites, stamp, type Kid } from './dom.ts';
import { headOut } from './run.ts';
import { act, app, getPrefs, hazardNow, redraw, savePrefs, say, setProfile } from './state.ts';
import { CHARACTER_AT, CHARACTER_ORDER, CONTROLS, characterName, characterTwist } from './words.ts';

export function renderHome(root: HTMLElement): void {
  // The word from the world sits above the grid, across the whole page.
  const word = worldNotice();
  if (word) root.append(word);
  root.append(el('div', 'home', nextRun(), who(), stash(), account()));
}

// ---- word from the world ---------------------------------------------------

/** One line, for a day, when anyone anywhere brings a relic home. */
function worldNotice(): HTMLElement | null {
  const n = app.worldNotice;
  if (!n) return null;
  const who = n.finder === app.profile.name ? el('span', 'own', n.finder) : el('span', 'who', n.finder);
  const line = el('div', 'notice notice--town world-notice', el('span', 'tag', 'Word'), el('span', 'text', who, ' brought home the ', el('strong', '', n.name), `. No. ${n.serial} in the world.`));
  line.setAttribute('role', 'status');
  return line;
}

// ---- next run --------------------------------------------------------------

function kitNames(): string {
  const names = app.kit.map((uid) => app.profile.items.find((i) => i.uid === uid)?.item.name).filter(Boolean);
  return names.length ? names.join(' and ') : 'no kit';
}

function nextRun(): HTMLElement {
  const first = app.profile.runs === 0;
  const sec = el('section', 'section next');
  sec.append(
    el('h2', '', first ? 'First run' : 'Next run'),
    el(
      'div',
      'bar',
      el('div', 'bar-text', el('strong', '', characterName(app.character)), `, ${kitNames()}. `, el('span', 'note', '12 waves, about 13 minutes.')),
      stamp(app.busy.has('run') ? 'Heading out' : 'Head out', { key: 'headout', sound: 'waveStart', onClick: () => void headOut('run') }),
    ),
  );
  if (first) sec.append(el('p', 'controls', CONTROLS));
  else sec.append(hazardRow());
  if (app.profile.features.includes('daily')) sec.append(dailyRow());
  return sec;
}

/** "40 marks, 5 timber, 5 ore, 5 hide", leaving out what is nil. */
export function costText(c: Cost): string {
  return [c.marks ? plural(c.marks, 'mark') : '', c.raws.timber ? `${fmt(c.raws.timber)} timber` : '', c.raws.ore ? `${fmt(c.raws.ore)} ore` : '', c.raws.hide ? `${fmt(c.raws.hide)} hide` : ''].filter(Boolean).join(', ');
}

/** The hazard ladder for the character who is going: six squares, the open ones can be pressed. */
function hazardRow(): HTMLElement {
  const book = app.profile.hazard[app.character] ?? { open: 0, best: -1 };
  const now = hazardNow();
  const row = el('div', 'bar bar--hazard');
  const picks = el('div', 'hazards');
  picks.setAttribute('role', 'radiogroup');
  picks.setAttribute('aria-label', 'Hazard');
  for (let h = 0; h <= MAX_HAZARD; h++) {
    const shut = h > book.open;
    const b = el('button', `hazard${h === now ? ' is-on' : ''}${h <= book.best ? ' is-won' : ''}`, String(h));
    b.type = 'button';
    b.dataset.fk = `hazard:${h}`;
    b.disabled = shut;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(h === now));
    b.setAttribute('aria-label', shut ? `Hazard ${h}, opens with a win at hazard ${h - 1}` : `Hazard ${h}${h <= book.best ? ', won' : ''}`);
    b.title = shut ? `Opens with a win at hazard ${h - 1}` : `${Math.round(HAZARD_MARKS * h * 100)}% more marks`;
    b.addEventListener('click', () => {
      audio.play('lock');
      app.hazard = h;
      savePrefs({ hazard: h });
      redraw();
    });
    picks.append(b);
  }
  const cap = kitPointCap(now);
  const terms = now === 0 ? 'The plain clearing.' : `Pays ${Math.round(HAZARD_MARKS * now * 100)}% more marks.`;
  const kit = now >= MAX_HAZARD ? 'A packed item comes whole.' : `A packed item brings up to ${cap} points.`;
  const next = book.open < MAX_HAZARD ? ` A win at hazard ${book.open} as ${characterName(app.character)} opens hazard ${book.open + 1}.` : '';
  row.append(el('div', 'bar-text', el('span', 'label', 'Hazard'), ' ', el('span', 'num', String(now)), '. ', terms, ' ', kit, el('span', 'note', next)), picks);
  return row;
}

function dailyRow(): HTMLElement {
  const d = app.daily;
  const row = el('div', 'bar bar--daily');
  if (!d) {
    row.append(el('div', 'bar-text', el('span', 'label', "Today's clearing"), ' ', el('span', 'note', app.online ? 'Asking the board.' : 'The board is in town, which is out of reach.')));
    return row;
  }
  const taken = d.taken || getPrefs().dailyTaken === d.date;
  let result: Kid;
  if (d.mine) result = `${d.mine.waves} of ${DAILY_WAVES} waves, ${fmt(d.mine.scrip)} scrip, ${ordinal(d.mine.rank)} of ${fmt(d.players)}.`;
  else if (taken) result = 'Scored attempt taken, no result. Practice is open.';
  else result = 'Not yet run.';
  row.append(
    el('div', 'bar-text', el('span', 'label', "Today's clearing"), ' ', el('span', 'num', d.date), '. ', characterName(d.character), '. ', result),
    el(
      'div',
      'stamps',
      !d.mine && !taken ? stamp('Scored attempt', { cls: 'stamp--small', key: 'daily:scored', sound: 'waveStart', onClick: () => void headOut('daily') }) : null,
      stamp('Practice', { cls: 'stamp--small stamp--plain', key: 'daily:practice', sound: 'waveStart', onClick: () => void headOut('practice') }),
    ),
  );
  return row;
}

// ---- who heads out ---------------------------------------------------------

function who(): HTMLElement {
  const S = sprites();
  const sec = el('section', 'section who-out', el('h2', '', 'Who heads out'));
  const list = el('div', 'chars');
  list.setAttribute('role', 'radiogroup');
  list.setAttribute('aria-label', 'Who heads out');
  const open = app.profile.characters;
  const pick = (id: CharacterId): void => {
    app.character = id;
    savePrefs({ character: id });
    redraw();
  };
  for (const id of CHARACTER_ORDER) {
    if (open.includes(id)) {
      const on = id === app.character;
      const b = el(
        'button',
        `char${on ? ' is-on' : ''}`,
        sprite(S.player[id].walk[0]),
        el('span', 'char-text', el('span', 'char-name', characterName(id), on ? el('span', 'label char-mark', 'Going') : null), el('span', 'char-twist', characterTwist(id))),
      );
      b.type = 'button';
      b.dataset.fk = `char:${id}`;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(on));
      b.addEventListener('click', () => {
        audio.play('lock');
        pick(id);
      });
      b.addEventListener('keydown', (ev) => {
        const d = ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        ev.preventDefault();
        const next = open[(open.indexOf(id) + d + open.length) % open.length]!;
        pick(next);
        (document.querySelector(`[data-fk="char:${next}"]`) as HTMLElement | null)?.focus();
      });
      list.append(b);
    } else {
      const left = Math.max(1, CHARACTER_AT[id] - app.profile.runs);
      list.append(
        el(
          'div',
          'char is-shut',
          sprite(S.player[id].walk[0].ink),
          el('span', 'char-text', el('span', 'char-name', characterName(id)), el('span', 'char-twist', `Heads out after ${left} more ${left === 1 ? 'run' : 'runs'}, won or lost.`)),
        ),
      );
    }
  }
  sec.append(list);
  return sec;
}

// ---- stash and kit ---------------------------------------------------------

function stash(): HTMLElement {
  const items = app.profile.items;
  const p = app.profile;
  const sec = el('section', 'section stash', el('h2', '', 'Stash'));
  if (app.met && (items.length || p.stashBought > 0)) sec.append(shelfRow());
  if (!items.length) {
    sec.append(empty(app.met ? 'Nothing in the stash. One item from your build can come home for every four waves you clear, and it will be listed here.' : 'Your stash is kept in town and will be listed here when the town answers.'));
    return sec;
  }
  sec.append(
    el(
      'p',
      'note',
      `Pack up to ${KIT_SLOTS} for the run. Each run you start spends one charge from every packed item, and an item with no charges left is gone. The daily clearing ignores kits. `,
      el('span', 'num', `${app.kit.length} of ${KIT_SLOTS} packed.`),
      items.some((i) => isRelic(i.item)) ? ' A relic does not wear, and one relic can be packed for a run.' : null,
    ),
  );
  const list = el('ul', 'offers items');
  const full = app.kit.length >= KIT_SLOTS;
  const relicPacked = app.kit.some((uid) => isRelic(items.find((i) => i.uid === uid)?.item));
  const hazard = hazardNow();
  for (const it of items) {
    const packed = app.kit.includes(it.uid);
    const down = packItem(it.item, hazard);
    const toggle = stamp(packed ? 'Packed' : 'Pack', {
      cls: `stamp--small stamp--plain${packed ? ' is-pressed' : ''}`,
      key: `pack:${it.uid}`,
      sound: 'lock',
      onClick: () => {
        app.kit = packed ? app.kit.filter((u) => u !== it.uid) : [...app.kit, it.uid].slice(0, KIT_SLOTS);
        savePrefs({ kit: app.kit });
        redraw();
      },
    });
    toggle.setAttribute('aria-pressed', String(packed));
    list.append(
      itemRow(it.item, {
        cls: packed ? 'is-locked' : '',
        me: app.profile.name,
        meta: isRelic(it.item)
          ? []
          : [
              el('span', 'made', it.item.by ? 'first made by ' : '', finder(it.item.by, app.profile.name)),
              down !== it.item ? el('span', 'made packs', `packs down to ${itemPoints(down.effects)} of ${itemPoints(it.item.effects)} points at hazard ${hazard}`) : null,
            ],
        actions: [charges(it.item, it.charges), mendStamp(it), packed || !(full || (relicPacked && isRelic(it.item))) ? toggle : null],
      }),
    );
  }
  sec.append(list);
  return sec;
}

/** How full the stash is, and the price of another shelf. */
function shelfRow(): HTMLElement {
  const p = app.profile;
  const cost = stashNextCost(p.stashBought);
  const short = !!cost && !canPay(p, cost);
  return el(
    'div',
    'bar bar--shelf',
    el(
      'div',
      'bar-text',
      el('span', 'num', `${fmt(p.stashUsed)} of ${fmt(p.stashLimit)} places filled.`),
      ' ',
      el('span', 'note', cost ? `What does not fit when you come home is salvaged. Another shelf of 8 costs ${costText(cost)}.` : 'The stash is as large as it gets. What does not fit when you come home is salvaged.'),
    ),
    cost
      ? stamp('Another shelf', {
          cls: 'stamp--small stamp--plain',
          key: 'shelf',
          disabled: short || app.busy.has('shelf'),
          title: short ? `You have ${plural(p.marks, 'mark')}` : costText(cost),
          onClick: () =>
            void act('shelf', 'Stash', async () => {
              setProfile((await api.expandStash()).profile);
              say('Stash', `A shelf went up. The stash holds ${fmt(app.profile.stashLimit)}.`, 'town');
            }),
        })
      : null,
  );
}

/** One charge back on a worn item, at a price. Nothing for an item that is whole, a relic, or past mending. */
function mendStamp(it: StashItem): HTMLElement | null {
  if (isRelic(it.item) || it.charges >= KIT_CHARGES) return null;
  if ((it.repairs ?? 0) >= REPAIR.perItem) return el('span', 'note', 'Past mending');
  const cost = repairCost(it.item, app.town?.perks.some((k) => k.id === 'granary') ? 0.75 : 1);
  const short = !canPay(app.profile, cost);
  return stamp('Mend', {
    cls: 'stamp--small stamp--plain',
    key: `mend:${it.uid}`,
    disabled: short || app.busy.has(`mend:${it.uid}`),
    title: `One charge back for ${costText(cost)}`,
    onClick: () =>
      void act(`mend:${it.uid}`, 'Stash', async () => {
        setProfile((await api.repair(it.uid)).profile);
        say('Stash', `${it.item.name} mended for ${costText(cost)}. An item can be mended ${REPAIR.perItem} times.`, 'town');
      }),
  });
}

// ---- the account in figures -----------------------------------------------

function account(): HTMLElement {
  const p = app.profile;
  const sec = el('section', 'section account', el('h2', '', 'Account'));
  if (!app.met) {
    sec.append(empty('Your name and your figures are kept in town. They will be here when it answers.'));
    return sec;
  }
  const dl = el('dl', 'stats stats--one');
  const row = (name: string, ...value: Kid[]): void => void dl.append(el('div', '', el('dt', '', name), el('dd', 'num', ...value)));
  const wait = p.nameChangeAt > Date.now();
  row(
    'Name',
    el('span', 'own', p.name),
    stamp('Another name', {
      cls: 'stamp--small stamp--plain',
      key: 'reroll',
      sound: 'reroll',
      disabled: wait,
      title: wait ? `Once a week. Next on ${new Date(p.nameChangeAt).toISOString().slice(0, 10)}` : 'Once a week',
      onClick: () =>
        void act('reroll', 'Name', async () => {
          setProfile((await api.rerollName()).profile);
        }),
    }),
  );
  row('Title worn', p.title && TITLE[p.title] ? TITLE[p.title].name : el('span', 'note', 'none'));
  row('Runs', fmt(p.runs));
  row('Wins', fmt(p.wins));
  row('Finds that count', fmt(p.finds));
  row('Titles earned', fmt(p.titles.length));
  row('Days played in the daily', fmt(p.daysPlayed));
  if (p.features.includes('town')) row('Given to the town', fmt(p.standing));
  sec.append(dl);
  return sec;
}
