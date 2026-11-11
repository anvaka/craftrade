// The stash tab, which is also home: the next run, who heads out, the
// stash and kit, and the account in figures.

import { DAILY_WAVES, KIT_CHARGES, KIT_SLOTS, type CharacterId } from '../../shared/protocol.ts';
import { audio } from '../audio/index.ts';
import { api } from './api.ts';
import { el, empty, finder, fmt, itemRow, ordinal, pips, sprite, sprites, stamp, type Kid } from './dom.ts';
import { headOut } from './run.ts';
import { act, app, getPrefs, redraw, savePrefs, setProfile } from './state.ts';
import { CHARACTER_AT, CHARACTER_ORDER, CONTROLS, characterName, characterTwist } from './words.ts';

export function renderHome(root: HTMLElement): void {
  root.append(el('div', 'home', nextRun(), who(), stash(), account()));
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
  if (app.profile.features.includes('daily')) sec.append(dailyRow());
  return sec;
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
  const sec = el('section', 'section stash', el('h2', '', 'Stash'));
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
    ),
  );
  const list = el('ul', 'offers items');
  const full = app.kit.length >= KIT_SLOTS;
  for (const it of items) {
    const packed = app.kit.includes(it.uid);
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
        meta: [el('span', 'made', it.item.by ? 'first made by ' : '', finder(it.item.by, app.profile.name))],
        actions: [el('span', 'charges', pips(it.charges, KIT_CHARGES, 'charges'), el('span', 'label', 'Charges')), packed || !full ? toggle : null],
      }),
    );
  }
  sec.append(list);
  return sec;
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
  row(
    'Name',
    el('span', 'own', p.name),
    stamp('Another name', {
      cls: 'stamp--small stamp--plain',
      key: 'reroll',
      sound: 'reroll',
      onClick: () =>
        void act('reroll', 'Name', async () => {
          setProfile((await api.rerollName()).profile);
        }),
    }),
  );
  row('Runs', fmt(p.runs));
  row('Wins', fmt(p.wins));
  row('First finds', fmt(p.finds));
  row('Days played in the daily', fmt(p.daysPlayed));
  if (p.features.includes('town')) row('Given to the town', fmt(p.standing));
  sec.append(dl);
  return sec;
}
