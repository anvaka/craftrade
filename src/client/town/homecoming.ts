// The one sheet shown after a run. There is no other recap: the game half
// hands over as soon as the run ends (it stops first only to ask what to
// carry, when there is a choice).
//
// Order: how it ended, in one large line with what did it; how close it was
// and the best so far; the two stamps, "Go again" with the focus, so death
// to the next run is one press; what is new; what came home; the run in
// figures.

import { WEAPONS, WEAPON_INDEX } from '../../sim/data/weapons.ts';
import { weaponName } from '../ui/describe.ts';
import { setTip, term } from '../ui/tip.ts';
import './homecoming.css';

import { TITLE } from '../../shared/almanac.ts';
import { plural } from './dom.ts';
import type { ItemSpec } from '../../shared/item.ts';
import { DEATH_RAW_KEEP, KIT_CHARGES, type RunStartRes } from '../../shared/protocol.ts';
import { RAWS } from '../../shared/vocab.ts';
import { audio } from '../audio/index.ts';
import type { RunRecap } from '../seam.ts';
import { charges, copyText, el, fmt, icon, isDocked, itemRow, ordinal, pips, sprite, sprites, stamp, thing, type Kid } from './dom.ts';
import { headOut, type Launch, type Report } from './run.ts';
import { pageHead, showSheet, showTown, soundControls } from './shell.ts';
import { app } from './state.ts';
import { FEATURE_OPENED, RAW_NAME, characterName, characterTwist } from './words.ts';

/** A press this soon after the sheet appears was meant for the run, not for "Go again". */
const GUARD_MS = 350;

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
  /** A relic is held back until everything else is on the sheet, then shown alone. */
  let relicShown = false;
  const shownAt = performance.now();

  let drawn = false;
  const draw = (): void => {
    const hadFocus = (document.activeElement as HTMLElement | null)?.dataset.fk;
    // A redraw keeps the reader's place; the first draw opens at the top, wherever the town was scrolled to.
    const at = drawn ? window.scrollY : 0;
    drawn = true;
    const root = showSheet(...sheet(h, report, copied, relicShown, { again, toTown, copy }));
    if (at) window.scrollTo(0, at);
    const key = hadFocus && root.querySelector(`[data-fk="${hadFocus}"]`) ? hadFocus : 'again';
    (root.querySelector(`[data-fk="${key}"]`) as HTMLElement | null)?.focus({ preventScroll: true });
  };

  const settle = async (): Promise<void> => {
    if (!report) report = await h.report;
  };
  const again = async (): Promise<void> => {
    if (leaving || performance.now() - shownAt < GUARD_MS) return;
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
    if (r.state === 'saved' && r.res.relic) {
      // Last, alone, after a beat: its own line and its own sound.
      window.setTimeout(() => {
        if (leaving) return;
        relicShown = true;
        draw();
        audio.play('relic');
        document.querySelector('.relic-reveal')?.scrollIntoView({ block: 'center' });
      }, RELIC_BEAT_MS);
    }
  });
}

/** The pause between the rest of the sheet and a relic. */
const RELIC_BEAT_MS = 1600;

/** The section a found relic is shown in. Nothing else shares it. */
function relicSection(item: ItemSpec): HTMLElement {
  const first = item.serial === 1;
  return el(
    'section',
    'section relic-reveal',
    el('h2', '', 'Also came home'),
    el('p', 'said', `A relic. ${first ? 'Nobody in the world has found this one before.' : `No. ${item.serial} in the world.`}`),
    el('ul', 'offers items', itemRow(item, { me: app.profile.name, actions: [charges(item, 1)] })),
    el('p', 'note', 'It is in your stash. A relic does not wear, cannot be fused or salvaged, and one can be packed for a run. Your name stays on it if it is sold.'),
  );
}

interface Acts {
  again: () => void;
  toTown: () => void;
  copy: (line: string) => void;
}

function sheet(h: Homecoming, report: Report | null, copied: boolean, relicShown: boolean, acts: Acts): Kid[] {
  const S = sprites();
  const { recap, ticket, launch } = h;
  const r = recap.report;
  const practice = launch.mode === 'practice';
  const res = report?.state === 'saved' ? report.res : null;

  // One verb for a death, here and on the card the run ends on: down.
  const title = r.won ? `All ${ticket.waves} waves cleared` : recap.killedBy ? `Down in wave ${recap.endWave}` : `Left in wave ${recap.endWave}`;
  const what = launch.mode === 'run' ? 'Homecoming' : launch.mode === 'daily' ? 'Daily clearing' : 'Daily clearing, practice';
  const by = !r.won && recap.killedBy ? `${gotYou(recap.killedBy)} ${clock(recap.seconds)} in the clearing.` : `${clock(recap.seconds)} in the clearing.`;

  const head = pageHead(`${what}. ${characterName(ticket.character)}`, title, el('span', 'note', by), soundControls({ compact: isDocked() }));
  head.classList.add('page-head--sheet');
  const out: Kid[] = [head];

  // ---- how close, and the best so far ---------------------------------------
  const marks = el('ul', 'recap-marks');
  const mark = (tag: string, text: string, cls = ''): void => void marks.append(el('li', cls, el('span', 'label', tag), el('span', '', text)));
  if (recap.nearMiss) mark('Close', recap.nearMiss, 'is-close');
  const best = recap.best;
  if (best) {
    if (r.won && !best.wonBefore) mark('Best', best.before > 0 ? `First win. Before this your best was wave ${best.before}.` : 'First win.', 'is-new');
    else if (r.won) mark('Best', `All ${ticket.waves} waves, again.`);
    else if (best.beaten) mark('New best', `Wave ${best.now}. Before this it was wave ${best.before}.`, 'is-new');
    else if (best.before <= 0) mark('Best', `Wave ${best.now}. That is the mark to beat.`);
    else if (best.wonBefore) mark('Best', `All ${ticket.waves} waves. This run reached wave ${recap.endWave}.`);
    else mark('Best', recap.endWave >= best.now ? `Wave ${best.now}. You matched it.` : `Wave ${best.now}. This run reached wave ${recap.endWave}.`);
  }
  // The next thing to aim for, said at the moment of loss.
  if (!r.won && launch.mode === 'run') {
    const nextAt = (Math.floor(r.wavesCleared / 4) + 1) * 4;
    if (r.wavesCleared < 4) mark('Next', 'Clear wave 4 and one item from your build comes home with you.');
    else if (nextAt <= ticket.waves) mark('Next', `Clear wave ${nextAt} and ${nextAt / 4} items come home.`);
  }
  if (marks.childElementCount) out.push(marks);

  // ---- stamps: one press to the next run -------------------------------------
  out.push(
    el(
      'div',
      'stamps stamps--main recap-stamps',
      stamp(launch.mode === 'run' ? 'Go again' : 'Go again, practice', { key: 'again', sound: 'waveStart', onClick: acts.again }),
      stamp('To town', { cls: 'stamp--town', key: 'totown', onClick: acts.toTown }),
      el('span', 'note', launch.mode === 'run' ? `${characterName(launch.character)}, ${launch.kit.length ? `same kit if it has charges left` : 'no kit'}.` : 'Practice is not scored.'),
    ),
  );

  // ---- what is new, once -----------------------------------------------------
  if (res && (res.unlockedFeature || res.unlockedCharacter || res.hazardOpened || res.titles?.length)) {
    const sec = el('section', 'section', el('h2', '', 'New in town'));
    const list = el('ul', 'opened');
    if (res.hazardOpened) list.append(el('li', '', el('span', 'label', 'Hazard'), el('span', '', `Hazard ${res.hazardOpened} is open for the ${characterName(ticket.character)}. It pays more marks and lets a packed item bring more of itself.`)));
    for (const id of res.titles ?? []) if (TITLE[id]) list.append(el('li', '', el('span', 'label', 'Title'), el('span', '', `Earned: "${TITLE[id].name}". ${TITLE[id].how} It can be worn from the almanac.`)));
    if (res.unlockedFeature) list.append(el('li', '', el('span', 'label', 'Opened'), el('span', '', FEATURE_OPENED[res.unlockedFeature])));
    if (res.unlockedCharacter) {
      const c = res.unlockedCharacter;
      list.append(el('li', '', sprite(S.player[c].walk[0]), el('span', '', `${characterName(c)} will head out for you now. ${characterTwist(c)}`)));
    }
    sec.append(list);
    out.push(sec);
  }

  // ---- what came home --------------------------------------------------------
  const came = el('section', 'section', el('h2', '', 'Came home'));
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
    const anyRaw = RAWS.some((raw) => recap.rawsGathered[raw] > 0 || r.raws[raw] > 0 || r.mule[raw] > 0 || g.raws[raw] > 0);
    if (!paid && (practice || (res.daily && !res.daily.scored))) {
      came.append(el('p', 'note', 'Practice pays nothing. The scored attempt is the one that counts.'));
    } else {
      // One table, one set of heads: gathered, sent by mule, held at the end, came home.
      const t = el('table', 'ledger came');
      const head = (text: string): HTMLElement => el('th', 'num wide', anyRaw ? text : '');
      t.append(el('tr', '', el('th', '', anyRaw ? 'Raw' : 'Goods'), head('Gathered'), head('Sent by mule'), head('Held at the end'), el('th', 'num', anyRaw ? setTip(el('span', 'term', 'Came home'), `A win keeps all held raws. A loss keeps ${Math.round(DEATH_RAW_KEEP * 100)}% of what was held, plus everything the mule took.`) : 'Came home')));
      if (anyRaw) {
        for (const raw of RAWS) {
          t.append(el('tr', '', el('td', '', thing(icon(S.icon.raw[raw]), RAW_NAME[raw])), el('td', 'num wide', fmt(recap.rawsGathered[raw])), el('td', 'num wide', fmt(r.mule[raw])), el('td', 'num wide', fmt(r.raws[raw])), el('td', 'num', `+${fmt(g.raws[raw])}`)));
        }
      }
      t.append(el('tr', 'total', el('td', '', thing(icon(S.icon.marks), 'Marks')), el('td', 'num wide', ''), el('td', 'num wide', ''), el('td', 'num wide', ''), el('td', 'num', `+${fmt(g.marks)}`)));
      came.append(t);
      if (res.paid === false) came.append(line('Town', 'This run was over the limit of paying runs for the hour or the day, or was over in seconds. It paid nothing and was not counted.'));
      if (res.salvaged) came.append(line('Stash', `The stash was full. ${plural(res.salvaged.items, 'item')} did not fit and ${res.salvaged.items === 1 ? 'was' : 'were'} salvaged for ${plural(res.salvaged.marks, 'mark')}.`));
      if (res.replay === 'mismatch') came.append(line('Report', 'The town played the run again from its log and came to a different result. The report was taken as unchecked.'));
      if (!anyRaw) came.append(el('p', 'note', 'No raws this time. Timber, ore and hide come from the trees, seams and carcasses in the clearing.'));
      else if (!r.won && RAWS.some((raw) => r.raws[raw] > 0)) {
        came.append(el('p', 'note', `Down in the clearing, you keep what the mule took and ${Math.round(DEATH_RAW_KEEP * 100)}% of the raws you held.`));
      }
      if (g.marks > 0 && h.firstRun) came.append(el('p', 'note', 'Marks are what the town pays in: a few for every wave cleared, and one for every 10 scrip in hand at the end.'));
      if (g.items.length) {
        const list = el('ul', 'offers items');
        for (const it of g.items) list.append(itemRow(it, { actions: [el('span', 'charges', pips(KIT_CHARGES, KIT_CHARGES, 'charges'), term('Charges', 'charges', 'label'))] }));
        came.append(list);
      } else if (r.wavesCleared >= 4) {
        came.append(el('p', 'note', 'No item was carried home.'));
      }
    }
  }
  out.push(came);

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

  // ---- a relic, last and alone ----------------------------------------------
  if (res?.relic && relicShown) out.push(relicSection(res.relic));

  // ---- the run in figures --------------------------------------------------
  const figures = el('dl', 'stats');
  const row = (name: Kid, value: string): void => void figures.append(el('div', '', el('dt', '', name), el('dd', 'num', value)));
  row('Waves cleared', `${r.wavesCleared} of ${ticket.waves}`);
  row('Time in the clearing', clock(recap.seconds));
  row('Level', String(r.level));
  row('Kills', fmt(r.kills));
  row('Scrip earned', fmt(r.scripEarned));
  if (r.scripHeld > 0) row('Scrip in hand at the end', fmt(r.scripHeld));
  row('Damage taken', fmt(recap.damageTaken));
  const top = [...recap.damageBy].sort((a, b) => b.damage - a.damage).slice(0, 4);
  for (const d of top) {
    const def = WEAPONS[WEAPON_INDEX[d.id]];
    // A weapon named here explains itself like everywhere else; burn, thorns and the like are plain words.
    row(def && d.tier ? el('span', '', 'Damage by ', weaponName(def, d.tier, undefined, 'lower')) : `Damage by ${d.name.toLowerCase()}`, fmt(d.damage));
  }
  out.push(el('section', 'section', el('h2', '', 'The run in figures'), figures));

  if (h.firstRun && res) {
    out.push(el('p', 'note foot', 'Your account is kept on this device. There is no sign-up and no password.'));
  }
  return out;
}

function line(tag: string, text: string): HTMLElement {
  return el('div', 'notice', el('span', 'tag', tag), el('span', 'text', text));
}

/** "A mite got you.", "Old Tusk got you.": the same words as the card the run ended on. */
function gotYou(name: string): string {
  const n = name.trim();
  if (/^(the|old) /i.test(n)) return `${n} got you.`;
  const low = n.toLowerCase();
  if (/s$/.test(low) || low === 'burn') return `${low[0]!.toUpperCase()}${low.slice(1)} got you.`;
  return `${/^[aeiou]/.test(low) ? 'An' : 'A'} ${low} got you.`;
}
