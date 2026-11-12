// The way out to the home wood: a first look at the gathering game. It is
// loaded on demand, like the run, and hands the screen back when it is done.
import { loadOuting } from '../outing/store.ts';
import { SKILL_NAME, skillLevel } from '../../sim/index.ts';
import { el, sprites, stamp } from './dom.ts';
import { showRun, showTown } from './shell.ts';
import { app } from './state.ts';

let out = false;

/** Leave town for the home wood. */
export async function scout(seed?: number): Promise<void> {
  if (out) return;
  out = true;
  try {
    const { mountOuting } = await import('../outing/mount.ts');
    const root = showRun();
    mountOuting({ root, sprites: sprites(), character: app.character, seed, onDone: () => { out = false; showTown(); } });
  } catch (e) {
    console.error(e);
    out = false;
    showTown();
  }
}

/** The home wood on the stash page: what the skills stand at, and the way out. */
export function outingSection(): HTMLElement {
  const s = loadOuting();
  const levels = SKILL_NAME.map((n, i) => `${n} ${skillLevel(s.xp[i])}`).join(', ');
  return el('section', 'section outing',
    el('h2', '', 'The home wood'),
    el('div', 'bar',
      el('div', 'bar-text', el('strong', '', 'Gather, then get out. '), s.outings > 0 ? `${levels}. ` : '', el('span', 'note', 'A first look at the gathering game: quiet at first, 5 to 10 minutes.')),
      stamp('Scout', { cls: 'stamp--plain', key: 'scout', sound: 'waveStart', onClick: () => void scout() })));
}
