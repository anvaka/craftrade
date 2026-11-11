// The almanac tab: what this account has seen and done, as "x of y", the
// hazard ladder, and the titles that follow. Nothing here can be bought.

import { MAX_HAZARD } from '../../shared/kit.ts';
import { api } from './api.ts';
import { el, empty, fmt, sprite, sprites, stamp } from './dom.ts';
import { act, app, setProfile } from './state.ts';
import { CHARACTER_ORDER, characterName } from './words.ts';

export function renderAlmanac(root: HTMLElement): void {
  const a = app.almanac;
  if (!a) {
    root.append(el('section', 'section section--first', el('h2', '', 'Almanac'), empty(app.online ? 'Opening the book.' : 'The almanac is kept in town, which is out of reach. It will be here when the town answers.')));
    return;
  }
  root.append(counts(), ladder(), titles());
}

/** One line per list: what it is, a ruled meter, and the count. */
function counts(): HTMLElement {
  const a = app.almanac!;
  const sec = el('section', 'section section--first', el('h2', '', 'Almanac'));
  sec.append(el('p', 'note num', `${fmt(a.have)} of ${fmt(a.of)} entries filled. The world has tried ${fmt(a.world.found)} of ${fmt(a.world.authoredPairs)} authored pairs.`));
  const rows = el('div', 'almanac');
  for (const l of a.lines) {
    const meter = el('div', 'meter meter--town');
    meter.style.setProperty('--v', String(l.of ? Math.min(1, l.have / l.of) : 0));
    meter.setAttribute('role', 'img');
    meter.setAttribute('aria-label', l.of ? `${fmt(l.have)} of ${fmt(l.of)}` : fmt(l.have));
    rows.append(el('div', 'almanac-row', el('span', 'a-name', l.label), l.of ? meter : el('span', 'a-open note', 'No end to this list'), el('span', 'a-fig num', l.of ? `${fmt(l.have)} of ${fmt(l.of)}` : fmt(l.have))));
  }
  sec.append(rows);
  return sec;
}

/** Six characters by six hazard levels. A cleared level is an inked square. */
function ladder(): HTMLElement {
  const S = sprites();
  const a = app.almanac!;
  const p = app.profile;
  const sec = el('section', 'section', el('h2', '', 'Hazard ladder'));
  sec.append(el('p', 'note', 'A win at one hazard as a character opens the next for that character. Higher hazards pay more marks and let a packed item bring more of itself.'));
  const table = el('table', 'ledger ladder');
  table.append(el('tr', '', el('th', '', 'Character'), el('th', '', 'Hazard 0 to 5'), el('th', 'num', 'Open')));
  for (const id of CHARACTER_ORDER) {
    const won = new Set(a.wins[id] ?? []);
    const cells = el('span', 'pips ladder-pips');
    for (let h = 0; h <= MAX_HAZARD; h++) cells.append(el('i', won.has(h) ? 'on' : ''));
    cells.setAttribute('role', 'img');
    cells.setAttribute('aria-label', won.size ? `won at hazard ${[...won].sort().join(', ')}` : 'no wins yet');
    const shut = !p.characters.includes(id);
    table.append(
      el(
        'tr',
        '',
        el('td', '', el('div', 'thing', sprite(shut ? S.player[id].walk[0].ink : S.player[id].walk[0]), el('span', '', characterName(id)))),
        el('td', '', cells),
        el('td', 'num', shut ? el('span', 'note', 'Not yet') : `Hazard ${p.hazard[id]?.open ?? 0}`),
      ),
    );
  }
  sec.append(table);
  return sec;
}

function titles(): HTMLElement {
  const a = app.almanac!;
  const sec = el('section', 'section', el('h2', '', 'Titles'));
  sec.append(el('p', 'note', 'A title is something you did. One can be worn after your name, where other players see it.'));
  const table = el('table', 'ledger titles');
  table.append(el('tr', '', el('th', '', 'Title'), el('th', 'wide', 'How it is earned'), el('th', '', '')));
  const wear = (id: string): void =>
    void act('title', 'Almanac', async () => {
      setProfile((await api.wearTitle(id)).profile);
      app.almanac = await api.almanac();
    });
  for (const t of a.titles) {
    const action = t.earned === null
      ? el('span', 'note', 'Not earned')
      : stamp(t.worn ? 'Worn' : 'Wear', {
          cls: `stamp--small stamp--plain${t.worn ? ' is-pressed' : ''}`,
          key: `title:${t.id}`,
          sound: 'lock',
          onClick: () => wear(t.worn ? '' : t.id),
        });
    if (action instanceof HTMLButtonElement) action.setAttribute('aria-pressed', String(t.worn));
    table.append(el('tr', t.earned === null ? 'is-shut' : '', el('td', '', el('span', 't-name', t.name), el('span', 't-how fx', t.how)), el('td', 'wide', t.how), el('td', 'act', action)));
  }
  sec.append(table);
  return sec;
}
