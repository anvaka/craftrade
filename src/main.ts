import { Game, idleInput } from './game';
import { InputMgr, actionOf } from './input';
import { Renderer } from './render';
import { Sound } from './audio';
import { UI } from './ui/app';
import './ui/style.css';
import * as M from './meta';
import * as R from './run';
import * as Log from './log';
import { BOSSES, GROUNDS } from './data';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;
const renderer = new Renderer(canvas);
const input = new InputMgr(canvas);
const sound = new Sound();
const q = new URLSearchParams(location.search);
const demo = q.get('demo');
if (demo) M.noPersist(); // screenshot mode never touches the real save
const profile = demo ? M.newProfile() : M.load();
let game: Game | null = null;
let playing = false;
let paused = false;
let freeze = 0; // impact pause
let resumeIn = 0; // grace after a pause: the field is shown and counted in before it moves again
let ending = false;

const ui = new UI(overlay, profile, {
  beginWave,
  sound,
  stop: () => {
    playing = false;
    paused = false;
  },
});

function beginWave(): void {
  const run = profile.run;
  if (!run) return;
  run.phase = 'wave';
  M.save(profile);
  const spec = R.waveSpec(run);
  game = new Game(spec);
  renderer.reset(game);
  input.reset();
  freeze = 0;
  ending = false;
  paused = false;
  playing = true;
  ui.hide();
  const boss = R.isBossWave(run.wave) ? ` · ${BOSSES[R.segmentOf(run.wave)].name.toUpperCase()}` : '';
  renderer.say(`WAVE ${run.wave + 1} · ${GROUNDS[spec.ground].name.toUpperCase()}${boss}`, '#e8ecf1', 2.2);
  resumeIn = 0;
  // a new player's first expeditions carry step prompts for the controls; each clears once it has been done
  renderer.hud.teach = profile.stats.runs <= 2;
}

/** Settle the wave and save at once, so closing the tab after a fall cannot undo it. Returns what to show. */
function settleWave(): () => void {
  const run = profile.run;
  if (!run || !game) return () => {};
  R.applyWave(run, game.res);
  Log.wave(profile, run, game.res); // the play log: one row per wave, for reading balance later
  if (run.phase === 'over') {
    const sum = M.finishRun(profile, run);
    M.save(profile);
    return () => {
      playing = false;
      ui.showSummary(sum, run);
    };
  }
  M.save(profile);
  return () => {
    playing = false;
    ui.showRun();
  };
}

function setPaused(on: boolean): void {
  if (!playing || ending || paused === on) return;
  paused = on;
  input.release();
  resumeIn = on ? 0 : 1.2;
  ui.showPause(on);
}
document.addEventListener('cw-resume', () => setPaused(false));
document.addEventListener('cw-pause', () => setPaused(true));
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const a = actionOf(e.code);
  if (a === 'pause') setPaused(!paused);
  if (a === 'mute') {
    sound.toggleMute();
    renderer.hud.note(sound.muted ? 'Sound off' : 'Sound on');
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});
// a window that loses focus without being hidden (another window on top, a click elsewhere) pauses too
addEventListener('blur', () => setPaused(true));
// turning a phone moves every control under the thumbs: pause instead of playing through the flip
addEventListener('orientationchange', () => setPaused(true));
matchMedia('(orientation: portrait)').addEventListener('change', () => {
  if (input.touchMode) setPaused(true);
});

let prev = performance.now();
function frame(now: number): void {
  const real = Math.min(0.033, (now - prev) / 1000);
  prev = now;
  input.active = playing && !paused;
  sound.frame(real, game, playing, paused, ui); // the bed and the music follow the screen, in menus as well
  if (game) {
    renderer.hud.resume = playing && !paused ? Math.max(0, resumeIn) : 0;
    if (playing && !paused && resumeIn > 0) {
      resumeIn -= real;
      input.consume();
    } else if (playing && !paused) {
      if (freeze > 0) freeze -= real;
      else {
        const [sx, sy] = renderer.worldToScreen(game.p.x, game.p.y);
        game.update(real, input.sample(sx, sy, renderer.scale));
        input.consume();
        for (const e of game.events) {
          freeze = Math.max(freeze, renderer.onEvent(e, game));
          sound.onEvent(e, game.time);
          if (e.t === 'over' && !ending) {
            ending = true;
            setTimeout(settleWave(), e.died ? 2200 : 700); // a fall holds the frame long enough to read what did it
          }
        }
      }
      sound.crowd(game.phase === 'wave' ? game.enemies.length : 0, real);
      renderer.update(real);
    } else sound.crowd(0, real);
    renderer.draw(game, input, real);
  }
  requestAnimationFrame(frame);
}

// Debug hooks for headless screenshots: ?demo=camp|gate|wave|town&warp=N
if (demo) {
  Object.defineProperty(window, '__cw', { value: { get game() { return game; }, renderer, input, sound } });
  profile.guided = false;
  if (q.get('tab')) ui.setTab(q.get('tab')!);
  profile.run = null;
  if (demo === 'rich') {
    for (const id of ['iron', 'greenwood', 'reed', 'hide', 'sinew', 'ash', 'shard', 'bonedust', 'skysteel', 'oldwood', 'silkweed']) profile.bank[id] = 60;
    profile.coin = 500;
    profile.schematics['p-wpn-pelt'] = 1;
    profile.schematics['r-var-bow'] = 1;
    profile.bank.pelt = 1;
    profile.standing.pending = 1;
    ui.showTown();
  } else if (demo === 'town') ui.showTown();
  else {
    const run = M.startRun(profile);
    const warp = Number(q.get('warp')) || 0;
    const waves = Number(q.get('waves')) || (demo === 'gate' ? 4 : demo === 'camp' ? 1 : 0);
    for (let i = 0; i < waves; i++) {
      const g = new Game(R.waveSpec(run));
      g.p.hp = 9999;
      for (let k = 0; k < 60 * 120 && g.phase !== 'over'; k++) g.update(1 / 60, idleInput());
      g.res.hp = 80;
      R.applyWave(run, g.res);
      while (run.pendingPicks > 0) R.pickLevel(run, run.pickOffer[0]);
      if (i < waves - 1) {
        R.afterTally(run);
        if (run.phase === 'gate') {
          R.pickWild(run, null);
          R.push(run);
        }
        R.leaveCamp(run);
      }
    }
    if (demo === 'tally') {
      run.pendingPicks = 1;
      run.pickOffer = ['edge', 'eye', 'cool'];
      ui.showRun();
    }
    else if (demo === 'camp' || demo === 'gate') {
      R.afterTally(run);
      run.scrap += 120;
      ui.showRun();
    } else {
      const obj = q.get('obj'); // &obj=supply|nests|elite: force the wave's objective
      if (obj === 'supply' || obj === 'nests' || obj === 'elite') {
        run.route.objective = obj;
        run.route.elite = obj === 'elite' ? q.get('elite') ?? 'thornback' : null;
      }
      const ground = q.get('ground'); // &ground=quarry|grove|marsh: force the ground of the wave shown
      if (ground === 'quarry' || ground === 'grove' || ground === 'marsh') run.route.ground = ground;
      beginWave();
      game!.p.hp = 9999;
      for (let k = 0; k < warp * 60 && game!.phase !== 'over'; k++) {
        game!.update(1 / 60, idleInput());
        for (const e of game!.events) renderer.onEvent(e, game!);
        renderer.update(1 / 60);
      }
    }
  }
} else ui.showTown();
requestAnimationFrame(frame);
