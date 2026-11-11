// The town tab: the shared project, the stations, and who gave.

import { isSolo } from './api.ts';
import { GLOSS } from '../ui/glossary.ts';
import { setTip, term } from '../ui/tip.ts';
import { nameWithTitle } from '../../shared/almanac.ts';
import type { StationId } from '../../shared/protocol.ts';
import { TOWN_FUND_PER_DAY } from '../../shared/rules.ts';
import { RAWS, emptyRaws, type RawBag } from '../../shared/vocab.ts';
import { api } from './api.ts';
import { el, empty, fmt, icon, pips, plural, sprites, stamp, stepper, thing } from './dom.ts';
import { act, app, say, setProfile } from './state.ts';
import { RAW_NAME, STATION_NAME, STATION_ORDER, STATION_TOP_TIER, stationDoes } from './words.ts';

const giving: RawBag = emptyRaws();
/** Marks to hand the Factor for the project. */
let funding = 0;

export function renderTownhall(root: HTMLElement): void {
  const t = app.town;
  if (!t) {
    root.append(el('section', 'section section--first', el('h2', '', 'Town project'), empty(app.online ? 'Asking after the project.' : 'The town is out of reach. The project and the stations will be here when it answers.')));
    return;
  }
  // Solo: the town is yours alone, so there is no table of who gave.
  root.append(project(), stations());
  if (!isSolo()) root.append(givers());
}

function project(): HTMLElement {
  const S = sprites();
  const t = app.town!;
  const p = app.profile;
  const sec = el('section', 'section section--first', el('h2', '', term('Town project', 'townProject')));
  const pr = t.project;
  if (!pr) {
    sec.append(empty('The town has nothing in hand. A new project will be listed here.'));
    return sec;
  }
  const station = pr.kind === 'station' ? pr.station : undefined;
  const name = station ? STATION_NAME[station].toLowerCase() : (pr.works?.name ?? 'the works').toLowerCase();
  sec.append(
    el(
      'div',
      'project-head',
      station ? icon(S.icon.station[station], true) : null,
      el(
        'div',
        '',
        el('div', 'project-name', station ? `Raise the ${name} to tier ${pr.toTier}` : (pr.works?.name ?? 'Town works')),
        el(
          'div',
          'note',
          station
            ? `When it is done: ${stationDoes(station, pr.toTier).toLowerCase()}${isSolo() ? '' : ', for every player'}.`
            : `Every station is at its top tier, so the town turns to works. When this is done: ${(pr.works?.perk ?? '').toLowerCase()}${isSolo() ? '' : ', for every player'}, for a week.`,
        ),
      ),
    ),
  );
  if (t.perks.length) {
    const list = el('ul', 'opened perks');
    for (const k of t.perks) list.append(el('li', '', el('span', 'label', 'In force'), el('span', '', `${k.perk}. From "${k.name}", until ${new Date(k.until).toISOString().slice(0, 10)}.`)));
    sec.append(list);
  }
  const rows = el('div', 'project');
  const giveStamp = stamp('', {
    cls: 'stamp--town',
    key: 'give',
    onClick: () =>
      void act('give', 'Town', async () => {
        const offer: Partial<RawBag> = {};
        for (const raw of RAWS) if (giving[raw] > 0) offer[raw] = giving[raw];
        const before = station ? app.stations[station] : 0;
        const wasWorks = pr.works?.id;
        const was = { ...p.raws };
        const res = await api.give(offer);
        setProfile(res.profile);
        app.town = res.town;
        app.stations = res.town.stations;
        const parts = RAWS.map((raw) => [raw, was[raw] - res.profile.raws[raw]] as const).filter(([, n]) => n > 0).map(([raw, n]) => `${fmt(n)} ${raw}`);
        for (const raw of RAWS) giving[raw] = 0;
        const raised = !!station && res.town.stations[station] > before;
        const finished = !station && res.town.project?.works?.id !== wasWorks;
        say('Town', `Gave ${parts.join(', ')}. ${raised ? `The ${name} is at tier ${res.town.stations[station!]}.` : finished ? `The works are done: ${(pr.works?.perk ?? '').toLowerCase()} for a week.` : `You have given ${fmt(res.profile.standing)} in all.`}`, 'town');
      }),
  });
  const sync = (): void => {
    const parts = RAWS.filter((raw) => giving[raw] > 0).map((raw) => `${fmt(giving[raw])} ${raw}`);
    giveStamp.textContent = parts.length ? `Give ${parts.join(', ')}` : 'Give';
    giveStamp.disabled = !parts.length || app.busy.has('give');
    setTip(giveStamp, parts.length ? 'Raws given go to the project for good and count toward your standing.' : 'Choose an amount with + or All first.');
  };
  for (const raw of RAWS) {
    const need = pr.need[raw];
    const have = Math.min(need, pr.have[raw]);
    const max = Math.max(0, Math.min(p.raws[raw], need - have));
    giving[raw] = Math.min(giving[raw], max);
    const meter = el('div', 'meter meter--town');
    meter.style.setProperty('--v', String(need ? have / need : 1));
    meter.setAttribute('role', 'img');
    meter.setAttribute('aria-label', `${fmt(have)} of ${fmt(need)} ${raw}`);
    rows.append(
      el(
        'div',
        'project-row',
        el('span', 'p-raw', icon(S.icon.raw[raw]), el('span', '', RAW_NAME[raw])),
        meter,
        el('span', 'p-fig num', `${fmt(have)} of ${fmt(need)}`),
        el(
          'span',
          'p-give',
          el('span', 'note num', `you hold ${fmt(p.raws[raw])}`),
          stepper({ value: giving[raw], min: 0, max, key: `give:${raw}`, label: `${raw} to give`, onChange: (v) => void ((giving[raw] = v), sync()) }),
          stamp('All', {
            cls: 'stamp--small stamp--plain',
            key: `give:${raw}:all`,
            sound: 'lock',
            disabled: max === 0,
            title: max === 0 ? (need - have === 0 ? `${fmt(need)} of ${fmt(need)}` : `You hold ${fmt(p.raws[raw])}`) : `${fmt(max)}`,
            onClick: () => {
              giving[raw] = max;
              const field = rows.querySelector(`[data-fk="give:${raw}:n"]`) as HTMLInputElement | null;
              if (field) {
                field.value = String(max);
                field.dispatchEvent(new Event('blur'));
              }
              sync();
            },
          }),
        ),
      ),
    );
  }
  sync();
  sec.append(rows, fundRow(station ? name : 'works'));
  sec.append(el('div', 'bar', el('div', 'bar-text note', isSolo() ? 'This town is yours alone: only what you give raises it. What you give is counted as your ' : 'Half of the tax on every market sale is spent on the project at the Factor\'s prices. What you give is counted as your ', term('standing', 'standing'), '.'), giveStamp));
  return sec;
}

/** Marks for the town: the Factor delivers what the project needs most, at his price. */
function fundRow(name: string): HTMLElement {
  const p = app.profile;
  const max = Math.max(0, p.marks);
  funding = Math.min(funding, max);
  const fund = stamp('', {
    cls: 'stamp--small stamp--town',
    key: 'fund',
    onClick: () =>
      void act('fund', 'Town', async () => {
        const was = app.profile.marks;
        const before = app.profile.standing;
        const res = await api.give({}, funding);
        setProfile(res.profile);
        app.town = res.town;
        app.stations = res.town.stations;
        funding = 0;
        say('Town', `The Factor delivered ${fmt(res.profile.standing - before)} raws to the ${name} for ${plural(was - res.profile.marks, 'mark')}.`, 'town');
      }),
  });
  const sync = (): void => {
    fund.textContent = funding > 0 ? `Pay ${fmt(funding)}` : 'Pay';
    fund.disabled = funding < 1 || app.busy.has('fund');
  };
  sync();
  return el(
    'div',
    'bar bar--fund',
    el('div', 'bar-text', el('span', 'label', 'With marks'), ' ', el('span', 'note', `Pay the Factor to deliver what the project needs most, at his asking price. He will carry ${TOWN_FUND_PER_DAY} units a day for one player. Marks that do not buy a whole unit stay with you.`)),
    el('span', 'stamps', stepper({ value: funding, min: 0, max, key: 'fund:marks', label: 'marks to pay', onChange: (v) => void ((funding = v), sync()) }), fund),
  );
}

function stations(): HTMLElement {
  const S = sprites();
  const t = app.town!;
  const sec = el('section', 'section', el('h2', '', term('Stations', 'station')));
  const table = el('table', 'ledger');
  table.append(el('tr', '', el('th', '', 'Station'), el('th', '', setTip(el('span', 'term', 'Tier'), 'A station has five tiers. The town project raises one at a time.')), el('th', '', 'Does now'), el('th', 'wide', 'At the next tier')));
  for (const id of STATION_ORDER as StationId[]) {
    const tr = t.stations[id] ?? 1;
    table.append(
      el(
        'tr',
        t.project?.kind === 'station' && t.project.station === id ? 'is-on' : '',
        el('td', '', thing(icon(S.icon.station[id]), STATION_NAME[id])),
        el('td', '', pips(tr, STATION_TOP_TIER, 'tiers')),
        el('td', '', stationDoes(id, tr)),
        el('td', 'wide', tr >= STATION_TOP_TIER ? el('span', 'note', 'Top tier') : stationDoes(id, tr + 1)),
      ),
    );
  }
  sec.append(table);
  return sec;
}

function givers(): HTMLElement {
  const t = app.town!;
  const p = app.profile;
  const sec = el('section', 'section', el('h2', '', 'Who gave'));
  sec.append(el('p', 'note num', `${plural(t.activePlayers, 'player')} active this week. You have given ${fmt(p.standing)}.`));
  if (!t.givers.length) {
    sec.append(empty('Nobody has given yet. The ten who have given most are listed here by name.'));
    return sec;
  }
  const table = el('table', 'ledger givers');
  table.append(el('tr', '', el('th', 'num rank', 'Place'), el('th', '', 'Name'), el('th', 'num', 'Given')));
  t.givers.forEach((g, i) => {
    table.append(el('tr', '', el('td', 'num rank', String(i + 1)), el('td', '', g.name === p.name ? el('span', 'own', nameWithTitle(g.name, g.title)) : el('span', 'who', nameWithTitle(g.name, g.title))), el('td', 'num', fmt(g.given))));
  });
  sec.append(table);
  return sec;
}
