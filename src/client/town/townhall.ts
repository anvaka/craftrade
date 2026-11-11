// The town tab: the shared project, the stations, and who gave.

import type { StationId } from '../../shared/protocol.ts';
import { RAWS, emptyRaws, type RawBag } from '../../shared/vocab.ts';
import { api } from './api.ts';
import { el, empty, fmt, icon, pips, plural, sprites, stamp, stepper, thing } from './dom.ts';
import { act, app, say, setProfile } from './state.ts';
import { RAW_NAME, STATION_NAME, STATION_ORDER, STATION_TOP_TIER, stationDoes } from './words.ts';

const giving: RawBag = emptyRaws();

export function renderTownhall(root: HTMLElement): void {
  const t = app.town;
  if (!t) {
    root.append(el('section', 'section section--first', el('h2', '', 'Town project'), empty(app.online ? 'Asking after the project.' : 'The town is out of reach. The project and the stations will be here when it answers.')));
    return;
  }
  root.append(project(), stations(), givers());
}

function project(): HTMLElement {
  const S = sprites();
  const t = app.town!;
  const p = app.profile;
  const sec = el('section', 'section section--first', el('h2', '', 'Town project'));
  const pr = t.project;
  if (!pr) {
    sec.append(empty('Every station is at its top tier. There is nothing to build until a new project is set.'));
    return sec;
  }
  const name = STATION_NAME[pr.station].toLowerCase();
  sec.append(
    el(
      'div',
      'project-head',
      icon(S.icon.station[pr.station], true),
      el(
        'div',
        '',
        el('div', 'project-name', `Raise the ${name} to tier ${pr.toTier}`),
        el('div', 'note', `When it is done: ${stationDoes(pr.station, pr.toTier).toLowerCase()}, for every player.`),
      ),
    ),
  );
  const rows = el('div', 'project');
  const giveStamp = stamp('', {
    cls: 'stamp--town',
    key: 'give',
    onClick: () =>
      void act('give', 'Town', async () => {
        const offer: Partial<RawBag> = {};
        for (const raw of RAWS) if (giving[raw] > 0) offer[raw] = giving[raw];
        const before = app.stations[pr.station];
        const was = { ...p.raws };
        const res = await api.give(offer);
        setProfile(res.profile);
        app.town = res.town;
        app.stations = res.town.stations;
        const parts = RAWS.map((raw) => [raw, was[raw] - res.profile.raws[raw]] as const).filter(([, n]) => n > 0).map(([raw, n]) => `${fmt(n)} ${raw}`);
        for (const raw of RAWS) giving[raw] = 0;
        const raised = res.town.stations[pr.station] > before;
        say('Town', `Gave ${parts.join(', ')}. ${raised ? `The ${name} is at tier ${res.town.stations[pr.station]}.` : `You have given ${fmt(res.profile.standing)} in all.`}`, 'town');
      }),
  });
  const sync = (): void => {
    const parts = RAWS.filter((raw) => giving[raw] > 0).map((raw) => `${fmt(giving[raw])} ${raw}`);
    giveStamp.textContent = parts.length ? `Give ${parts.join(', ')}` : 'Give';
    giveStamp.disabled = !parts.length || app.busy.has('give');
    giveStamp.title = parts.length ? '' : '0 chosen';
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
  sec.append(rows, el('div', 'bar', el('div', 'bar-text note', 'Half of the tax on every market sale also goes to the project. What you give is counted as your standing.'), giveStamp));
  return sec;
}

function stations(): HTMLElement {
  const S = sprites();
  const t = app.town!;
  const sec = el('section', 'section', el('h2', '', 'Stations'));
  const table = el('table', 'ledger');
  table.append(el('tr', '', el('th', '', 'Station'), el('th', '', 'Tier'), el('th', '', 'Does now'), el('th', 'wide', 'At the next tier')));
  for (const id of STATION_ORDER as StationId[]) {
    const tr = t.stations[id] ?? 1;
    table.append(
      el(
        'tr',
        t.project?.station === id ? 'is-on' : '',
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
    table.append(el('tr', '', el('td', 'num rank', String(i + 1)), el('td', '', g.name === p.name ? el('span', 'own', g.name) : el('span', 'who', g.name)), el('td', 'num', fmt(g.given))));
  });
  sec.append(table);
  return sec;
}
