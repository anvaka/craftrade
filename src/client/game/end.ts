// Run end: the recap and the choice of what to carry home.
import type { Sprites } from '../art/index.ts';
import { audio } from '../audio/index.ts';
import { effectText, itemTier, type ItemSpec } from '../../shared/item.ts';
import { DEATH_RAW_KEEP } from '../../shared/protocol.ts';
import { RAWS } from '../../shared/vocab.ts';
import { ENEMIES, ENEMY_INDEX, WEAPONS, WEAPON_INDEX, carryLimit, carryable, summary, type Run } from '../../sim/index.ts';
import { cap, clock, el, ic, stamp, tier } from './dom.ts';

const SOURCE_NAME: Record<string, string> = {
  burn: 'Burn', thorns: 'Thorns', burst: 'Kill bursts', recoil: 'Recoil blast', shards: 'Node shards',
};
export const sourceName = (id: string): string => WEAPONS[WEAPON_INDEX[id]]?.name ?? SOURCE_NAME[id] ?? cap(id);

/** The plain name of what ended the run, or null on a win or a quit. */
export function killerName(run: Run): string | null {
  const id = run.killedBy;
  if (!id || id === 'abandoned') return null;
  return ENEMIES[ENEMY_INDEX[id]]?.name ?? SOURCE_NAME[id] ?? cap(id);
}

export interface EndScreen { el: HTMLElement; destroy(): void }

export function createEndScreen(parent: HTMLElement, S: Sprites, run: Run, quit: boolean, done: (carry: ItemSpec[]) => void): EndScreen {
  const sum = summary(run);
  const root = el('div', 'g-end g-overlay');
  root.tabIndex = -1;
  const limit = carryLimit(run);
  const pool = carryable(run);
  const chosen = new Set<number>();
  // Start with the highest tiers picked; the player can change it.
  pool.map((it, i) => [itemTier(it), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, limit).forEach(([, i]) => chosen.add(i));
  let line = '';
  let finished = false;

  const title = sum.won ? `All ${sum.totalWaves} waves cleared` : quit ? `Left in wave ${sum.endWave}` : `Down in wave ${sum.endWave}`;
  const killer = killerName(run);

  function finish(): void {
    if (finished) return;
    finished = true;
    audio.play('stamp');
    window.removeEventListener('keydown', onKey);
    done([...chosen].sort((a, b) => a - b).map((i) => pool[i]));
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.code !== 'Enter' || (e.target as HTMLElement | null)?.tagName === 'BUTTON') return;
    e.preventDefault();
    finish();
  };
  window.addEventListener('keydown', onKey);

  function render(): void {
    const scroll = root.scrollTop;
    const head = el('header', 'page-head',
      el('div', '', el('div', 'label', sum.won ? 'Run won' : 'Run over'), el('h1', '', title)),
      el('div', 'meta', el('span', 'note', `${clock(sum.seconds)} in the clearing`)));

    // Recap.
    const facts = el('table', 'ledger');
    const row = (k: string, v: string): void => { facts.append(el('tr', '', el('td', '', k), el('td', 'num', v))); };
    row('Waves cleared', `${sum.wavesCleared} of ${sum.totalWaves}`);
    if (killer) row('Killed by', killer);
    row('Time', clock(sum.seconds));
    row('Level', String(sum.level));
    row('Kills', String(sum.kills));
    row('Scrip earned', String(sum.scripEarned));
    row('Damage taken', String(Math.round(sum.damageTaken)));

    const dmg = Object.entries(sum.damageBy).sort((a, b) => b[1] - a[1]);
    const top = dmg.length ? dmg[0][1] : 1;
    const bars = el('div', 'g-bars');
    for (const [id, v] of dmg) {
      const bar = el('i');
      bar.style.width = `${Math.max(1, Math.round((v / top) * 100))}%`;
      bars.append(el('div', 'g-bar', el('span', 'g-bar-name', sourceName(id)), el('span', 'g-bar-rule', bar), el('span', 'num', String(v))));
    }
    if (!dmg.length) bars.append(el('p', 'note', 'No damage dealt.'));

    const raws = el('table', 'ledger');
    raws.append(el('tr', '', el('th', '', 'Raw'), el('th', 'num wide', 'Gathered'), el('th', 'num', 'Mule'), el('th', 'num', 'Held'), el('th', 'num', 'Goes home')));
    for (const r of RAWS) {
      const home = sum.mule[r] + (sum.won ? sum.raws[r] : Math.floor(sum.raws[r] * DEATH_RAW_KEEP));
      raws.append(el('tr', '',
        el('td', '', el('div', 'thing', ic(S.icon.raw[r]), el('span', '', cap(r)))),
        el('td', 'num wide', String(sum.rawsGathered[r])), el('td', 'num', String(sum.mule[r])), el('td', 'num', String(sum.raws[r])),
        el('td', 'num g-home', String(home))));
    }
    const rule = sum.won
      ? 'You won, so everything you hold goes home with the mule loads.'
      : `Mule loads go home whole. Of the raws you held, ${Math.round(DEATH_RAW_KEEP * 100)}% go home, rounded down.`;

    // Carry.
    const carry = el('section', 'section');
    carry.append(el('h2', '', 'Carry home'));
    const nextAt = (Math.floor(sum.wavesCleared / 4) + 1) * 4;
    if (limit <= 0) {
      carry.append(el('p', 'note', nextAt <= sum.totalWaves
        ? `No items go home this time. Clear wave ${nextAt} and you carry 1.`
        : 'No items go home this time.'));
    } else {
      carry.append(el('p', 'note', `You may carry ${limit} ${limit === 1 ? 'item' : 'items'}: one for every 4 waves cleared.`));
      if (pool.length === 0) carry.append(el('p', '', 'You hold nothing that can be carried.'));
      const tbl = el('table', 'ledger g-items');
      pool.forEach((it, i) => {
        const on = chosen.has(i);
        const btn = stamp(on ? 'Carrying' : 'Carry', `stamp--plain stamp--small${on ? ' is-pressed' : ''}`);
        btn.setAttribute('aria-pressed', String(on));
        btn.dataset.fk = `carry${i}`;
        btn.addEventListener('click', (ev) => {
          if (on) { chosen.delete(i); line = ''; }
          else if (chosen.size >= limit) { line = `The limit is ${limit}. Put one back first.`; audio.play('lock', { pitch: 0.7, gain: 0.7 }); }
          else { chosen.add(i); line = ''; audio.play('stamp'); }
          render();
          if ((ev as MouseEvent).detail === 0) (root.querySelector(`[data-fk="carry${i}"]`) as HTMLElement | null)?.focus();
        });
        tbl.append(el('tr', on ? 'g-carrying' : '',
          el('td', '', el('div', 'thing', ic(S.icon.glyph[it.glyph]),
            el('span', '', el('span', 'g-item-name', it.name, tier(itemTier(it))), el('span', 'g-sub', it.effects.map((e) => effectText(e)).join(', '))))),
          el('td', 'act', btn)));
      });
      if (pool.length) carry.append(tbl);
      if (run.player.itemKit.some(Boolean)) carry.append(el('p', 'note', 'Kit items are not listed. They wear out here.'));
    }

    const go = stamp('Head back to town', 'stamp--town');
    go.dataset.fk = 'go';
    go.addEventListener('click', finish);
    const note = el('div', `notice g-reason g-reason--bad${line ? '' : ' is-empty'}`, el('span', 'tag', 'No'), el('span', 'text', line));
    note.setAttribute('role', 'status');
    const foot = el('div', 'g-foot', note,
      el('div', 'g-foot-row',
        el('span', 'note', limit > 0 && pool.length ? `Carrying ${chosen.size} of ${limit}.` : ''),
        el('div', 'g-foot-acts', go)));

    root.replaceChildren(
      el('div', 'page g-page', head,
        el('div', 'g-cols',
          el('div', 'g-main',
            el('section', 'section g-first', el('h2', '', 'Raws'), raws, el('p', 'note', rule)),
            carry),
          el('aside', 'g-side',
            el('section', 'section g-first', el('h2', '', 'The run'), facts),
            el('section', 'section', el('h2', '', 'Damage by source'), bars)))),
      foot);
    root.scrollTop = scroll;
  }

  parent.append(root);
  render();
  return {
    el: root,
    destroy() { window.removeEventListener('keydown', onKey); root.remove(); },
  };
}
