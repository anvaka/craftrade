// The stash tab, which is also home: the next run, who heads out, the
// stash and kit, and the account in figures.

import { RELIC } from '../../shared/content/relics.ts';
import { itemName } from '../ui/describe.ts';
import { TITLE } from '../../shared/almanac.ts';
import { isRelic, itemPoints } from '../../shared/item.ts';
import { DAILY_WAVES, KIT_CHARGES, KIT_SLOTS, type CharacterId, type StashItem } from '../../shared/protocol.ts';
import { HAZARD_MARKS, MAX_HAZARD, REPAIR, canPay, kitPointCap, packItem, repairCost, stashNextCost, type Cost } from '../../shared/rules.ts';
import { audio } from '../audio/index.ts';
import { SOLO_ONLY, api, isSolo } from './api.ts';
import { charges, dock, el, empty, finder, fmt, isDocked, isPhone, itemRow, ordinal, plural, sprite, sprites, stamp, type Kid } from './dom.ts';
import { dropSavedRun, headOut, resumeRun, savedRun } from './run.ts';
import { openTab, soundControls, switchWorld } from './shell.ts';
import { act, app, getPrefs, hazardNow, redraw, savePrefs, say, setProfile } from './state.ts';
import { GLOSS } from '../ui/glossary.ts';
import { setTip, term } from '../ui/tip.ts';
import { CHARACTER_AT, CHARACTER_ORDER, CONTROLS, characterName, characterTwist } from './words.ts';

export function renderHome(root: HTMLElement): void {
  // The word from the world sits above the grid, across the whole page.
  const word = worldNotice();
  if (word) root.append(word);
  // On a phone the account is reference, not part of the next run: it is kept at the foot of the almanac.
  const phone = isPhone();
  root.append(el('div', 'home', nextRun(), who(), stash(), phone && app.profile.runs > 0 ? null : account()));
  if (isDocked()) root.append(dock(el('span', '', el('strong', '', characterName(app.character)), ' \u00b7 ', ...kitNames(), app.profile.runs > 0 ? ` \u00b7 hazard ${hazardNow()}` : ''), headOutStamp()));
}

function headOutStamp(): HTMLButtonElement {
  return stamp(app.busy.has('run') ? 'Heading out' : 'Head out', { key: 'headout', sound: 'waveStart', onClick: () => void headOut('run') });
}

// ---- word from the world ---------------------------------------------------

/** One line, for a day, when anyone anywhere brings a relic home. */
function worldNotice(): HTMLElement | null {
  const n = app.worldNotice;
  if (!n) return null;
  const who = n.finder === app.profile.name ? el('span', 'own', n.finder) : el('span', 'who', n.finder);
  const spec = RELIC[n.relic as keyof typeof RELIC];
  const line = el('div', 'notice notice--town world-notice', el('span', 'tag', 'Word'), el('span', 'text', who, ' brought home the ', el('strong', '', spec ? itemName({ ...spec, serial: n.serial, by: n.finder }) : n.name), `. No. ${n.serial} in the world.`));
  line.setAttribute('role', 'status');
  return line;
}

// ---- next run --------------------------------------------------------------

function kitNames(): Kid[] {
  const items = app.kit.map((uid) => app.profile.items.find((i) => i.uid === uid)?.item).filter((i): i is NonNullable<typeof i> => !!i);
  if (!items.length) return ['no kit'];
  return items.flatMap((it, i) => (i ? [' and ', itemName(it)] : [itemName(it)]));
}

function nextRun(): HTMLElement {
  const first = app.profile.runs === 0;
  const sec = el('section', 'section next');
  sec.append(
    el('h2', '', first ? 'First run' : 'Next run'),
    el(
      'div',
      'bar',
      el('div', 'bar-text', el('strong', '', characterName(app.character)), ', ', ...kitNames(), '. ', el('span', 'note', '12 waves, about 13 minutes.')),
      // Docked screens carry Head out in the dock at the foot instead, where it never scrolls away.
      isDocked() ? null : headOutStamp(),
    ),
  );
  const kept = savedRun();
  if (kept) {
    sec.append(
      el(
        'div',
        'bar bar--kept',
        el('div', 'bar-text', el('span', 'label', 'Waiting'), ' ', `A ${kept.launch.mode === 'run' ? 'run' : 'daily clearing'} as ${characterName(kept.ticket.character)} stands at the bench after wave ${kept.save.wave}. `, el('span', 'note', 'Heading out afresh lets it go.')),
        el(
          'div',
          'stamps',
          stamp('Back to the bench', { cls: 'stamp--small', key: 'run:resume', sound: 'waveStart', title: 'Pick the run up at the bench you left it at. It takes a second or two to get there.', onClick: () => void resumeRun() }),
          stamp('Let it go', { cls: 'stamp--small stamp--plain', key: 'run:drop', title: 'Give the run up. Nothing from it comes home.', onClick: () => { dropSavedRun(); redraw(); } }),
        ),
      ),
    );
  }
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
    setTip(b, shut ? `Opens with a win at hazard ${h - 1}` : h === 0 ? 'The plain clearing.' : `${Math.round(HAZARD_MARKS * h * 100)}% more marks. Packed items are cut down to ${kitPointCap(h) >= 999 ? 'nothing: they come whole' : `${kitPointCap(h)} points`}.`);
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
  const kit: Kid[] = now >= MAX_HAZARD ? ['A packed item comes whole.'] : ['A packed item brings up to ', setTip(el('span', 'term', `${cap} points`), 'An item\u2019s points are the sum of its effects. A packed item stronger than this is cut down to it for the run, and comes home whole.'), '.'];
  const next = book.open < MAX_HAZARD ? ` A win at hazard ${book.open} as ${characterName(app.character)} opens hazard ${book.open + 1}.` : '';
  if (isPhone()) {
    // One short line; the long terms are in the squares' tips and in the hazard word's.
    const short = now >= MAX_HAZARD ? 'packed items come whole' : `packed items bring up to ${cap} points`;
    row.append(el('div', 'bar-text', term('Hazard', 'hazard', 'label'), ' ', el('span', 'num', String(now)), ' ', el('span', 'note', now === 0 ? `Plain clearing, ${short}.` : `+${Math.round(HAZARD_MARKS * now * 100)}% marks, ${short}.`)), picks);
    return row;
  }
  row.append(el('div', 'bar-text', term('Hazard', 'hazard', 'label'), ' ', el('span', 'num', String(now)), '. ', terms, ' ', ...kit, el('span', 'note', next)), picks);
  return row;
}

function dailyRow(): HTMLElement {
  const d = app.daily;
  const row = el('div', 'bar bar--daily');
  if (!d) {
    row.append(el('div', 'bar-text', term("Today's clearing", 'daily', 'label'), ' ', el('span', 'note', app.online ? 'Asking the board.' : 'The board is in town, which is out of reach.')));
    return row;
  }
  const taken = d.taken || getPrefs().dailyTaken === d.date;
  let result: Kid;
  if (d.mine) result = `${d.mine.waves} of ${DAILY_WAVES} waves, ${fmt(d.mine.scrip)} scrip, ${ordinal(d.mine.rank)} of ${fmt(d.players)}.`;
  else if (taken) result = 'Scored attempt taken, no result. Practice is open.';
  else result = 'Not yet run.';
  if (isPhone()) {
    // One line that opens the daily tab, where its two stamps are. Head out stays the only big stamp here.
    const go = el('button', 'bar bar--daily bar--link', el('span', 'bar-text', el('span', 'label', "Today's clearing"), ' ', characterName(d.character), '. ', el('span', 'note', d.mine ? `${ordinal(d.mine.rank)} of ${fmt(d.players)}.` : taken ? 'Practice is open.' : 'Not yet run.')), el('span', 'bar-go', 'Daily \u2192'));
    go.type = 'button';
    go.dataset.fk = 'daily:open';
    go.addEventListener('click', () => {
      audio.play('stamp');
      openTab('daily');
      window.scrollTo(0, 0);
    });
    return go;
  }
  row.append(
    el('div', 'bar-text', term("Today's clearing", 'daily', 'label'), ' ', el('span', 'num', d.date), '. ', characterName(d.character), '. ', result),
    el(
      'div',
      'stamps',
      !d.mine && !taken ? stamp('Scored attempt', { cls: 'stamp--small', key: 'daily:scored', title: GLOSS.daily, sound: 'waveStart', onClick: () => void headOut('daily') }) : null,
      stamp('Practice', { cls: 'stamp--small stamp--plain', key: 'daily:practice', title: GLOSS.practice, sound: 'waveStart', onClick: () => void headOut('practice') }),
    ),
  );
  return row;
}

// ---- who heads out ---------------------------------------------------------

function who(): HTMLElement {
  const S = sprites();
  const strip = isPhone();
  const sec = el('section', 'section who-out', el('h2', '', 'Who heads out'));
  // On a phone the six are a strip of portraits, and the one going is named on a line under it.
  const list = el('div', `chars${strip ? ' chars--strip' : ''}`);
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
      if (strip) b.setAttribute('aria-label', characterName(id));
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
      const when = `Heads out after ${left} more ${left === 1 ? 'run' : 'runs'}, won or lost.`;
      const chip = el(
        'div',
        'char is-shut',
        sprite(S.player[id].walk[0].ink),
        el('span', 'char-text', el('span', 'char-name', characterName(id)), el('span', 'char-twist', when)),
        strip ? el('span', 'char-left num', String(left)) : null,
      );
      if (strip) {
        setTip(chip, `${characterName(id)}. ${when}`);
        chip.setAttribute('role', 'img');
        chip.setAttribute('aria-label', `${characterName(id)}, ${when.toLowerCase()}`);
      }
      list.append(chip);
    }
  }
  sec.append(list);
  if (strip) sec.append(el('p', 'char-caption', el('strong', '', characterName(app.character)), ' ', el('span', 'note', characterTwist(app.character))));
  return sec;
}

// ---- stash and kit ---------------------------------------------------------

function stash(): HTMLElement {
  const items = app.profile.items;
  const p = app.profile;
  const sec = el('section', 'section stash', el('h2', '', 'Stash'));
  const phone = isPhone();
  if (app.met && (items.length || p.stashBought > 0)) sec.append(shelfRow(phone && items.length > 0));
  if (!items.length) {
    sec.append(empty(app.met ? 'Nothing in the stash. One item from your build can come home for every four waves you clear, and it will be listed here.' : 'Your stash is kept in town and will be listed here when the town answers.'));
    return sec;
  }
  if (!phone) sec.append(
    el(
      'p',
      'note',
      'Pack up to ', term(`${KIT_SLOTS} for the run`, 'kit'), '. Each run you start spends one charge from every packed item, and an item with no ', term('charges', 'charges'), ' left is gone. The daily clearing ignores kits. ',
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
      title: packed ? 'Comes with you on the next run. Press to unpack.' : GLOSS.kit,
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
              el('span', 'made', it.item.by ? term('first made by', 'firstMade') : '', it.item.by ? ' ' : '', finder(it.item.by, app.profile.name)),
              down !== it.item ? setTip(el('span', 'made packs term', phone ? `packs to ${itemPoints(down.effects)} of ${itemPoints(it.item.effects)} points` : `packs down to ${itemPoints(down.effects)} of ${itemPoints(it.item.effects)} points at hazard ${hazard}`), 'Packed for a run at this hazard, the item is cut down to the cap. It comes home whole.') : null,
            ],
        // On a phone the charge pips sit by the name and the right-hand column holds only stamps.
        actions: [phone ? null : charges(it.item, it.charges), mendStamp(it), packed || !(full || (relicPacked && isRelic(it.item))) ? toggle : null],
        lead: phone ? [charges(it.item, it.charges, null)] : undefined,
      }),
    );
  }
  sec.append(list);
  return sec;
}

/** How full the stash is, and the price of another shelf. `short`: one line with the packed count, for a phone. */
function shelfRow(brief = false): HTMLElement {
  const p = app.profile;
  const cost = stashNextCost(p.stashBought);
  const short = !!cost && !canPay(p, cost);
  const why = cost ? `What does not fit when you come home is salvaged. Another shelf of 8 costs ${costText(cost)}.` : 'The stash is as large as it gets. What does not fit when you come home is salvaged.';
  return el(
    'div',
    'bar bar--shelf',
    brief
      ? el(
          'div',
          'bar-text',
          setTip(el('span', 'num term', `${fmt(p.stashUsed)}/${fmt(p.stashLimit)} places`), `${fmt(p.stashUsed)} of ${fmt(p.stashLimit)} places filled. ${why}`),
          ' \u00b7 ',
          setTip(el('span', 'num term', `${app.kit.length}/${KIT_SLOTS} packed`), `Pack up to ${KIT_SLOTS} for the run. Each run you start spends one charge from every packed item, and an item with no charges left is gone. The daily clearing ignores kits.`),
        )
      : el('div', 'bar-text', el('span', 'num', `${fmt(p.stashUsed)} of ${fmt(p.stashLimit)} places filled.`), ' ', el('span', 'note', why)),
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

export function account(): HTMLElement {
  const p = app.profile;
  const sec = el('section', 'section account', el('h2', '', 'Account'));
  if (!app.met) {
    sec.append(empty('Your name and your figures are kept in town. They will be here when it answers.'));
    return sec;
  }
  const dl = el('dl', 'stats stats--one');
  const row = (name: Kid, ...value: Kid[]): void => void dl.append(el('div', '', el('dt', '', name), el('dd', 'num', ...value)));
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
  if (!SOLO_ONLY) {
    const solo = isSolo();
    row(
      'World',
      setTip(el('span', 'term', solo ? 'Solo' : 'Shared'), solo ? 'Solo: the whole game kept on this device, with a town of your own. Works with no connection.' : 'The shared town: one world for every player, on the game server.'),
      stamp(solo ? 'Go to the shared town' : 'Play solo', {
        cls: 'stamp--small stamp--plain',
        key: 'world:switch',
        title: solo
          ? 'The shared town is one world for every player and needs a connection. Its save is separate: this solo save stays on the device and you can come back to it.'
          : 'Solo is the whole game kept on this device, with a town of your own. It needs no connection. Its save is separate: this account stays in the shared town and you can come back to it.',
        onClick: () => switchWorld(solo ? 'town' : 'solo'),
      }),
    );
  }
  // The phone head has only the mute stamp; the volume is set here, where nothing scrolls under the thumb at the top of a page.
  if (isDocked()) row('Sound', soundControls());
  row('Title worn', p.title && TITLE[p.title] ? TITLE[p.title].name : el('span', 'note', 'none'));
  row('Runs', fmt(p.runs));
  row('Wins', fmt(p.wins));
  row(term('Finds that count', 'firstFind'), fmt(p.finds));
  row('Titles earned', fmt(p.titles.length));
  row('Days played in the daily', fmt(p.daysPlayed));
  if (p.features.includes('town')) row(term('Given to the town', 'standing'), fmt(p.standing));
  sec.append(dl);
  return sec;
}
