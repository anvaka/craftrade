// The way out to the home wood: a first look at the gathering game. It is
// loaded on demand, like the run, and hands the screen back when it is done.
import { loadOuting } from '../outing/store.ts';
import { SKILL_NAME, skillLevel } from '../../sim/index.ts';
import { el, sprites, stamp } from './dom.ts';
import { headOutLull, LULL_SECONDS } from './run.ts';
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

/** The prototype on the stash page: a run with a stretch of safe gathering after every wave. */
export function outingSection(): HTMLElement {
  const s = loadOuting();
  const levels = SKILL_NAME.slice(0, 3).map((n, i) => `${n} ${skillLevel(s.xp[i])}`).join(', ');
  return el('section', 'section outing',
    el('h2', '', 'Try: gather between waves'),
    el('div', 'bar',
      el('div', 'bar-text', el('strong', '', `${LULL_SECONDS} quiet seconds after every wave. `), `Plain nodes are free; rich ones and chests are guarded. ${levels}. `,
        el('span', 'note', 'A test: this run stays on this device and brings nothing home.')),
      stamp('Try it', { cls: 'stamp--plain', key: 'scout', sound: 'waveStart', onClick: () => void headOutLull() })));
}
