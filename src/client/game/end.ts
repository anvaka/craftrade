// Run end. The recap is one sheet and it belongs to the town (see
// town/homecoming.ts). The game only stops here when there is something to
// choose: more items that could go home than may. Then it asks that one
// question and nothing else.
import type { Sprites } from '../art/index.ts';
import { audio } from '../audio/index.ts';
import { effectText, itemTier, type ItemSpec } from '../../shared/item.ts';
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

/** "The stag", "Old Tusk": a name as the subject of a sentence about one particular thing. */
export function theName(name: string): string {
  const n = name.trim();
  return /^(the|old) /i.test(n) ? n : `The ${n.toLowerCase()}`;
}

/** "A mite got you.", "Old Tusk got you.": what hurt you, on the line a run ends on. */
export function gotYou(name: string): string {
  const n = name.trim();
  if (/^(the|old) /i.test(n)) return `${n} got you.`;
  const low = n.toLowerCase();
  if (/s$/.test(low) || low === 'burn' || low === 'thorns') return `${cap(low)} got you.`;
  return `${/^[aeiou]/.test(low) ? 'An' : 'A'} ${low} got you.`;
}

/** What goes home when nobody is asked: the highest tiers, up to the limit. */
export function defaultCarry(run: Run): ItemSpec[] {
  const limit = carryLimit(run);
  const pool = carryable(run);
  if (limit <= 0) return [];
  return pool.map((it, i) => [itemTier(it), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, limit)
    .map(([, i]) => i).sort((a, b) => a - b).map((i) => pool[i]);
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
      el('div', 'meta', el('span', 'note', killer && !sum.won ? `${gotYou(killer)} ${clock(sum.seconds)} in the clearing.` : `${clock(sum.seconds)} in the clearing.`)));

    const carry = el('section', 'section g-first');
    carry.append(el('h2', '', 'What comes home with you'));
    carry.append(el('p', 'note', `You may carry ${limit} of these ${pool.length} items: one for every 4 waves cleared. The rest stay in the clearing.`));
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
    carry.append(tbl);
    if (run.player.itemKit.some(Boolean)) carry.append(el('p', 'note', 'Kit items are not listed. They wear out here.'));

    const go = stamp('Head home', 'stamp--town');
    go.dataset.fk = 'go';
    go.addEventListener('click', finish);
    const note = el('div', `notice g-reason g-reason--bad${line ? '' : ' is-empty'}`, el('span', 'tag', 'No'), el('span', 'text', line));
    note.setAttribute('role', 'status');
    const foot = el('div', 'g-foot', note,
      el('div', 'g-foot-row',
        el('span', 'note', `Carrying ${chosen.size} of ${limit}.`),
        el('div', 'g-foot-acts', go)));

    root.replaceChildren(el('div', 'page g-page', head, carry), foot);
    root.scrollTop = scroll;
    if (!document.activeElement || document.activeElement === document.body || document.activeElement === root) {
      (root.querySelector('[data-fk="go"]') as HTMLElement | null)?.focus({ preventScroll: true });
    }
  }

  parent.append(root);
  render();
  return {
    el: root,
    destroy() { window.removeEventListener('keydown', onKey); root.remove(); },
  };
}
