// Boot: bake the sprites once, say hello to the town without waiting on it
// for long, and put the player on the stash page with "Head out" under
// their hands. A new device is one press from its first run.

import { bakeAll } from '../art/index.ts';
import { api, isSolo } from './api.ts';
import { setSprites } from './dom.ts';
import { headOut, loadMountRun } from './run.ts';
import { scout } from './outing.ts';
import { currentView, loadTab, showTown, watchReach } from './shell.ts';
import { app, getPrefs, redraw, setProfile } from './state.ts';

/** The longest the first screen waits for the town before going on without it. */
const HELLO_WAIT_MS = 1500;
const SOLO_WAIT_MS = 8000;

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

export async function boot(): Promise<void> {
  const hello = api.hello(8000);
  // The run is the largest part of the page. Start fetching it now.
  loadMountRun().catch(() => {});
  setSprites(bakeAll(window.devicePixelRatio));

  const prefs = getPrefs();
  if (prefs.character) app.character = prefs.character;
  if (prefs.kit) app.kit = prefs.kit.slice(0, 2);
  if (typeof prefs.hazard === 'number') app.hazard = prefs.hazard;
  if (prefs.tab) app.tab = prefs.tab;

  const first = await Promise.race([
    hello.then((res) => res, () => null),
    // The solo world opens from this device: slower than a ping the first time, but it always arrives.
    new Promise<null>((r) => setTimeout(() => r(null), isSolo() ? SOLO_WAIT_MS : HELLO_WAIT_MS)),
  ]);
  if (first) {
    setProfile(first.profile);
    app.stations = first.stations;
    app.worldNotice = first.notice ?? null;
    app.online = true;
  } else {
    // Go on without the town. If the answer is only late, take it when it lands.
    app.online = false;
    hello
      .then((res) => {
        setProfile(res.profile);
        app.stations = res.stations;
        app.worldNotice = res.notice ?? null;
        app.online = true;
        redraw();
        if (currentView() === 'town') void loadTab(app.tab);
      })
      .catch(() => {});
    watchReach();
  }
  showTown();
  // ?outing opens the home wood at once; ?outing=7 with that seed.
  const q = new URLSearchParams(location.search);
  if (q.has('outing')) void scout(q.get('outing') ? Number(q.get('outing')) >>> 0 : undefined);

  // On a first run the movement keys start it, so hands never leave them.
  window.addEventListener('keydown', (ev) => {
    if (currentView() !== 'town' || app.profile.runs !== 0 || app.tab !== 'stash') return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
    const t = ev.target as HTMLElement | null;
    const onPage = !t || t === document.body || t.dataset?.fk === 'headout';
    if (onPage && MOVE_KEYS.has(ev.key.toLowerCase())) {
      ev.preventDefault();
      void headOut('run');
    }
  });
}
