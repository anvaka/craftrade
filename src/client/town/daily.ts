// The daily tab: today's clearing, your result, the board, and a line to copy.

import { nameWithTitle } from '../../shared/almanac.ts';
import { DAILY_WAVES } from '../../shared/protocol.ts';
import { copyText, el, empty, fmt, ordinal, plural, sprite, sprites, stamp } from './dom.ts';
import { dailyLine } from './homecoming.ts';
import { headOut } from './run.ts';
import { app, getPrefs, redraw } from './state.ts';
import { characterName, characterTwist } from './words.ts';

let copiedFor = '';

export function renderDaily(root: HTMLElement): void {
  const d = app.daily;
  if (!d) {
    root.append(el('section', 'section section--first', el('h2', '', 'Daily clearing'), empty(app.online ? 'Asking the board.' : 'The board is in town, which is out of reach. Today\'s clearing will be here when it answers.')));
    return;
  }
  const S = sprites();
  const p = app.profile;
  const taken = d.taken || getPrefs().dailyTaken === d.date;

  const sec = el('section', 'section section--first', el('h2', '', 'Daily clearing, ', el('span', 'num', d.date)));
  sec.append(
    el(
      'div',
      'project-head',
      sprite(S.player[d.character].walk[0]),
      el('div', '', el('div', 'project-name', characterName(d.character)), el('div', '', characterTwist(d.character))),
    ),
    el(
      'p',
      'note',
      `${DAILY_WAVES} waves. Everyone gets the same clearing and the same bench, and kits stay home. One scored attempt a day, which pays like a run. Practice is unlimited and pays nothing.`,
    ),
  );

  const line = d.mine ? dailyLine(d.date, d.mine.waves, DAILY_WAVES, d.mine.scrip, d.mine.rank, d.players) : '';
  const result = el('div', 'bar bar--daily');
  if (d.mine) {
    result.append(
      el('div', 'bar-text', el('span', 'label', 'Your result'), ' ', el('span', 'copy-text num', line)),
      el(
        'div',
        'stamps',
        stamp(copiedFor === line ? 'Copied' : 'Copy', {
          cls: 'stamp--small stamp--town',
          key: 'daily:copy',
          onClick: () =>
            void copyText(line).then((ok) => {
              copiedFor = ok ? line : '';
              redraw();
            }),
        }),
        stamp('Practice', { cls: 'stamp--small stamp--plain', key: 'daily:practice', sound: 'waveStart', onClick: () => void headOut('practice') }),
      ),
    );
  } else {
    result.append(
      el('div', 'bar-text', el('span', 'label', 'Your result'), ' ', taken ? 'Scored attempt taken, no result. Practice is open.' : 'Not yet run.'),
      el(
        'div',
        'stamps',
        taken ? null : stamp('Scored attempt', { cls: 'stamp--small', key: 'daily:scored', sound: 'waveStart', onClick: () => void headOut('daily') }),
        stamp('Practice', { cls: 'stamp--small stamp--plain', key: 'daily:practice', sound: 'waveStart', onClick: () => void headOut('practice') }),
      ),
    );
  }
  sec.append(result);
  root.append(sec);

  const board = el('section', 'section', el('h2', '', 'Board'));
  board.append(el('p', 'note num', `${plural(d.players, 'player')} today. You have played on ${plural(p.daysPlayed, 'day')}. There is no streak to lose.`));
  if (!d.top.length) {
    board.append(empty('Nobody has a score yet today. The best twenty are listed here, by waves cleared and then by scrip earned.'));
  } else {
    const t = el('table', 'ledger givers');
    t.append(el('tr', '', el('th', 'num rank', 'Place'), el('th', '', 'Name'), el('th', 'num', 'Waves'), el('th', 'num', 'Scrip')));
    d.top.forEach((r, i) => {
      t.append(el('tr', '', el('td', 'num rank', ordinal(i + 1)), el('td', '', r.name === p.name ? el('span', 'own', nameWithTitle(r.name, r.title)) : el('span', 'who', nameWithTitle(r.name, r.title))), el('td', 'num', `${r.waves} of ${DAILY_WAVES}`), el('td', 'num', fmt(r.scrip))));
    });
    board.append(t);
    if (d.mine && d.mine.rank > d.top.length) board.append(el('p', 'note num', `You are ${ordinal(d.mine.rank)} of ${fmt(d.players)}.`));
  }
  root.append(board);
}
