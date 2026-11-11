// The sheet shown after a run. What came home is first; what opened is said
// once in one line; two stamps keep the player moving.

import { DEATH_RAW_KEEP, KIT_CHARGES, type RunStartRes } from '../../shared/protocol.ts';
import { RAWS } from '../../shared/vocab.ts';
import { audio } from '../audio/index.ts';
import type { RunRecap } from '../seam.ts';
import { copyText, el, fmt, icon, itemRow, ordinal, pips, sprite, sprites, stamp, thing, type Kid } from './dom.ts';
import { headOut, type Launch, type Report } from './run.ts';
import { pageHead, showSheet, showTown, soundControls } from './shell.ts';
import { app } from './state.ts';
import { FEATURE_OPENED, RAW_NAME, characterName, characterTwist } from './words.ts';

export interface Homecoming {
  recap: RunRecap;
  launch: Launch;
  ticket: RunStartRes;
  report: Promise<Report>;
  firstRun: boolean;
}

const clock = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** The copyable daily line. Plain text. */
export function dailyLine(date: string, waves: number, of: number, scrip: number, rank: number, players: number): string {
  return `Scrip daily ${date}: ${waves} of ${of} waves, ${fmt(scrip)} scrip, ${ordinal(rank)} of ${fmt(players)}`;
}

export function showHomecoming(h: Homecoming): void {
  let report: Report | null = null;
  let copied = false;
  let leaving = false;

  const draw = (): void => {
    const hadFocus = (document.activeElement as HTMLElement | null)?.dataset.fk;
    const root = showSheet(...sheet(h, report, copied, { again, toTown, copy }));
    const key = hadFocus && root.querySelector(`[data-fk="${hadFocus}"]`) ? hadFocus : 'again';
    (root.querySelector(`[data-fk="${key}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
  };

  const settle = async (): Promise<void> => {
    if (!report) report = await h.report;
  };
  const again = async (): Promise<void> => {
    if (leaving) return;
    leaving = true;
    // A new ticket voids an open one, so the report must land first.
    await settle();
    void headOut(h.launch.mode === 'run' ? 'run' : 'practice');
  };
  const toTown = (): void => {
    if (leaving) return;
    leaving = true;
    showTown();
  };
  const copy = async (line: string): Promise<void> => {
    copied = await copyText(line);
    if (!leaving) draw();
  };

  draw();
  void h.report.then((r) => {
    report = r;
    if (leaving) return;
    if (r.state === 'saved' && (r.res.unlockedFeature || r.res.unlockedCharacter || r.res.gained.items.length)) audio.play('reveal');
    draw();
  });
}

interface Acts {
  again: () => void;
  toTown: () => void;
  copy: (line: string) => void;
}

function sheet(h: Homecoming, report: Report | null, copied: boolean, acts: Acts): Kid[] {
  const S = sprites();
  const { recap, ticket, launch } = h;
  const r = recap.report;
  const practice = launch.mode === 'practice';
  const res = report?.state === 'saved' ? report.res : null;

  const title = r.won ? `Cleared all ${ticket.waves} waves` : recap.killedBy ? `Died on wave ${recap.endWave}` : `Left on wave ${recap.endWave}`;
  const what = launch.mode === 'run' ? 'Homecoming' : launch.mode === 'daily' ? 'Daily clearing' : 'Daily clearing, practice';
  const by = !r.won && recap.killedBy ? `Killed by ${article(recap.killedBy)} after ${clock(recap.seconds)}.` : `${clock(recap.seconds)} in the clearing.`;

  const out: Kid[] = [pageHead(`${what}. ${characterName(ticket.character)}`, title, el('span', 'note', by), soundControls())];

  // ---- what came home ------------------------------------------------------
  const came = el('section', 'section section--first', el('h2', '', 'Came home'));
  if (!report) {
    came.append(el('p', 'note', 'Counting at the gate.'));
  } else if (report.state === 'local') {
    came.append(line('Town', 'The town was out of reach, so nothing from this run was saved. The run itself was real.'));
  } else if (report.state === 'refused') {
    came.append(
      line('Report', report.fail.unreachable ? 'The town could not be reached to take the report. Nothing from this run was saved.' : `The town did not take the report: ${report.fail.message} Nothing from this run was saved.`),
    );
  } else if (report.state === 'lost-reply') {
    came.append(line('Report', 'The report reached town but the reply was lost. What you earned is in your stash.'));
  } else if (res) {
    const g = res.gained;
    const paid = g.marks > 0 || RAWS.some((raw) => g.raws[raw] > 0) || g.items.length > 0;
    if (!paid && (practice || (res.daily && !res.daily.scored))) {
      came.append(el('p', 'note', 'Practice pays nothing. The scored attempt is the one that counts.'));
    } else {
      const t = el('table', 'ledger came');
      t.append(el('tr', '', el('th', '', 'Goods'), el('th', 'num wide', 'Held at the end'), el('th', 'num wide', 'Sent by mule'), el('th', 'num', 'Came home')));
      for (const raw of RAWS) {
        t.append(el('tr', '', el('td', '', thing(icon(S.icon.raw[raw]), RAW_NAME[raw])), el('td', 'num wide', fmt(r.raws[raw])), el('td', 'num wide', fmt(r.mule[raw])), el('td', 'num', `+${fmt(g.raws[raw])}`)));
      }
      t.append(el('tr', 'total', el('td', '', thing(icon(S.icon.marks), 'Marks')), el('td', 'num wide', ''), el('td', 'num wide', ''), el('td', 'num', `+${fmt(g.marks)}`)));
      came.append(t);
      if (!r.won && RAWS.some((raw) => r.raws[raw] > 0)) {
        came.append(el('p', 'note', `A death keeps what the mule took and ${Math.round(DEATH_RAW_KEEP * 100)}% of what you held.`));
      }
      if (g.items.length) {
        const list = el('ul', 'offers items');
        for (const it of g.items) list.append(itemRow(it, { actions: [el('span', 'charges', pips(KIT_CHARGES, KIT_CHARGES, 'charges'), el('span', 'label', 'Charges'))] }));
        came.append(list);
      } else {
        came.append(el('p', 'note', r.wavesCleared < 4 ? 'No item came home. One item can be carried for every four waves cleared.' : 'No item was carried home.'));
      }
    }
  }
  out.push(came);

  // ---- what opened, once ---------------------------------------------------
  if (res && (res.unlockedFeature || res.unlockedCharacter)) {
    const sec = el('section', 'section', el('h2', '', 'New in town'));
    const list = el('ul', 'opened');
    if (res.unlockedFeature) list.append(el('li', '', el('span', 'label', 'Opened'), el('span', '', FEATURE_OPENED[res.unlockedFeature])));
    if (res.unlockedCharacter) {
      const c = res.unlockedCharacter;
      list.append(el('li', '', sprite(S.player[c].walk[0]), el('span', '', `${characterName(c)} will head out for you now. ${characterTwist(c)}`)));
    }
    sec.append(list);
    out.push(sec);
  }

  // ---- daily ---------------------------------------------------------------
  if (res?.daily) {
    const d = res.daily;
    const sec = el('section', 'section', el('h2', '', 'Daily board'));
    if (d.scored) {
      const text = dailyLine(app.daily?.date ?? new Date().toISOString().slice(0, 10), r.wavesCleared, ticket.waves, r.scripEarned, d.rank, d.players);
      sec.append(
        el(
          'div',
          'copyline',
          el('span', 'copy-text num', text),
          stamp(copied ? 'Copied' : 'Copy', { cls: 'stamp--town stamp--small', key: 'copy', onClick: () => acts.copy(text) }),
        ),
      );
    } else {
      sec.append(el('p', '', `Practice. ${r.wavesCleared} of ${ticket.waves} waves and ${fmt(r.scripEarned)} scrip would have placed ${ordinal(d.rank)} of ${fmt(Math.max(d.players, d.rank))}.`));
    }
    out.push(sec);
  }

  // ---- stamps --------------------------------------------------------------
  out.push(
    el(
      'div',
      'stamps stamps--main',
      stamp(launch.mode === 'run' ? 'Go again' : 'Go again, practice', { key: 'again', sound: 'waveStart', onClick: acts.again }),
      stamp('To town', { cls: 'stamp--town', key: 'totown', onClick: acts.toTown }),
      el('span', 'note', launch.mode === 'run' ? `${characterName(launch.character)}, ${launch.kit.length ? `same kit if it has charges left` : 'no kit'}.` : 'Practice is not scored.'),
    ),
  );

  // ---- the run in figures --------------------------------------------------
  const figures = el('dl', 'stats');
  const row = (name: string, value: string): void => void figures.append(el('div', '', el('dt', '', name), el('dd', 'num', value)));
  row('Waves cleared', `${r.wavesCleared} of ${ticket.waves}`);
  row('Level', String(r.level));
  row('Kills', fmt(r.kills));
  row('Scrip earned', fmt(r.scripEarned));
  row('Scrip in hand at the end', fmt(r.scripHeld));
  row('Damage taken', fmt(recap.damageTaken));
  const top = [...recap.damageBy].sort((a, b) => b.damage - a.damage).slice(0, 4);
  for (const d of top) row(`Damage by ${d.name.toLowerCase()}`, fmt(d.damage));
  out.push(el('section', 'section', el('h2', '', 'The run in figures'), figures));

  if (h.firstRun && res) {
    out.push(el('p', 'note foot', 'Your account is kept on this device. There is nothing to sign.'));
  }
  return out;
}

function line(tag: string, text: string): HTMLElement {
  return el('div', 'notice', el('span', 'tag', tag), el('span', 'text', text));
}

function article(name: string): string {
  const n = name.trim();
  if (/^(the|old) /i.test(n)) return n;
  const low = n.toLowerCase();
  return `${/^[aeiou]/.test(low) ? 'an' : 'a'} ${low}`;
}
