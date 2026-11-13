import { CFG } from './config';
import { Game, type Stats } from './game';
import { InputMgr } from './input';
import { Renderer } from './render';
import { Sound } from './audio';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;
const renderer = new Renderer(canvas);
const input = new InputMgr(canvas);
const sound = new Sound();

let game = new Game(true);
let screen: 'menu' | 'play' | 'paused' | 'results' = 'menu';
let freeze = 0; // impact pause
// Kept in memory only, so the two modes can be compared side by side. Nothing is saved.
const last: { on?: Stats; off?: Stats } = {};

const CONTROLS = `
  <div class="controls">
    <div><b>Desktop</b> WASD move · mouse aims · hold left button to wind up, release to swing · Space or right button dodges · P pauses · M mutes</div>
    <div><b>Touch</b> left thumb moves · right thumb: hold to wind up, drag to aim, release to swing · DODGE button</div>
  </div>`;

function buttons(): string {
  return `
    <div class="buttons">
      <button data-mode="on">Play with gathering ON</button>
      <button data-mode="off" class="alt">Play with gathering OFF</button>
    </div>`;
}

function show(html: string): void {
  overlay.innerHTML = `<div class="card">${html}</div>`;
  overlay.hidden = false;
  overlay.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((b) => {
    b.onclick = () => start(b.dataset.mode === 'on');
  });
  const resume = overlay.querySelector<HTMLButtonElement>('button[data-resume]');
  if (resume) resume.onclick = () => setPaused(false);
}

function menu(): void {
  screen = 'menu';
  const t = CFG.targets;
  show(`
    <h1>Gathering under fire</h1>
    <p class="sub">First playable: five timed waves, one arena. Play it both ways and compare.</p>
    <ul>
      <li>Light attacks are automatic. The <b>heavy swing</b> breaks shields and is also how you <b>mine</b>.</li>
      <li>Dodge and heavy swing share one <b>stamina</b> bar (yellow, under your character).</li>
      <li>Every strike on a node raises <b>heat</b>, and heat brings more enemies. It cools while you leave the ore alone.</li>
      <li>Gold <b>rich veins</b> at the edges only open during the <b>swell</b> and close at the peak.</li>
      <li>Ore is heavy: each unit slows you a little. Haul targets: bronze ${t.bronze}, silver ${t.silver}, gold ${t.gold}.</li>
    </ul>
    ${CONTROLS}
    ${buttons()}`);
}

function tier(n: number): string {
  const t = CFG.targets;
  if (n >= t.gold) return 'Gold haul';
  if (n >= t.silver) return `Silver haul (gold at ${t.gold})`;
  if (n >= t.bronze) return `Bronze haul (silver at ${t.silver})`;
  return `No medal (bronze at ${t.bronze})`;
}

function results(): void {
  screen = 'results';
  const s = game.stats;
  last[s.gathering ? 'on' : 'off'] = { ...s };
  const col = (r: Stats | undefined, f: (r: Stats) => string) => `<td>${r ? f(r) : '<span class="dim">not played</span>'}</td>`;
  const row = (label: string, f: (r: Stats) => string) => `<tr><th>${label}</th>${col(last.on, f)}${col(last.off, f)}</tr>`;
  const na = '<span class="dim">n/a</span>';
  show(`
    <h1>${s.died ? `Died in wave ${game.wave + 1}` : 'Survived all five waves'}</h1>
    <p class="sub">This run: gathering ${s.gathering ? 'ON' : 'OFF'}${s.gathering ? ` · ${tier(s.material)}` : ''}</p>
    <table>
      <tr><th></th><th>Gathering ON</th><th>Gathering OFF</th></tr>
      ${row('Outcome', (r) => (r.died ? `died, ${r.wavesCleared} waves cleared` : 'survived'))}
      ${row('Material collected', (r) => (r.gathering ? `${r.material}` : na))}
      ${row('Damage taken', (r) => `${Math.round(r.damageTaken)}`)}
      ${row('Heat peak', (r) => (r.gathering ? `${Math.round(r.heatPeak)} / ${CFG.heat.max}` : na))}
      ${row('Time spent gathering', (r) => (r.gathering ? `${r.gatherTime.toFixed(1)} s` : na))}
    </table>
    <p class="dim small">Each column shows the latest run in that mode. Nothing is saved when you close the page.</p>
    ${buttons()}`);
}

function start(gathering: boolean): void {
  sound.init();
  input.reset();
  game = new Game(gathering);
  renderer.reset(game);
  for (const e of game.events) renderer.onEvent(e, game);
  freeze = 0;
  overlay.hidden = true;
  screen = 'play';
}

function setPaused(p: boolean): void {
  if (p && screen === 'play') {
    screen = 'paused';
    show(`<h1>Paused</h1>${CONTROLS}<div class="buttons"><button data-resume>Resume</button></div>`);
  } else if (!p && screen === 'paused') {
    overlay.hidden = true;
    input.reset();
    screen = 'play';
  }
}

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyP' || e.code === 'Escape') setPaused(screen === 'play');
  if (e.code === 'KeyM') sound.toggleMute();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});

let prev = performance.now();
function frame(now: number): void {
  const real = Math.min(0.033, (now - prev) / 1000);
  prev = now;

  if (screen === 'play') {
    if (freeze > 0) {
      freeze -= real;
    } else {
      const [sx, sy] = renderer.worldToScreen(game.p.x, game.p.y);
      game.update(real, input.sample(sx, sy));
      input.consume();
      for (const e of game.events) {
        freeze = Math.max(freeze, renderer.onEvent(e, game));
        sound.onEvent(e, game.time);
        if (e.t === 'over') setTimeout(results, e.died ? 900 : 600);
      }
    }
    sound.crowd(game.phase === 'wave' ? game.enemies.length : 0, real);
    renderer.update(real);
  } else {
    sound.crowd(0, real);
  }
  renderer.draw(game, input, real);
  requestAnimationFrame(frame);
}

menu();
// ?auto=on or ?auto=off skips the menu (used for automated screenshots)
const auto = new URLSearchParams(location.search).get('auto');
if (auto === 'on' || auto === 'off') {
  start(auto === 'on');
  // &warp=N runs N seconds with no input first, to screenshot a wave in progress
  const warp = Number(new URLSearchParams(location.search).get('warp')) || 0;
  const idle = { mx: 0, my: 0, ax: 1, ay: 0, hasAim: false, heavy: false, dodge: false };
  for (let i = 0; i < warp * 60 && game.phase !== 'over'; i++) {
    game.update(1 / 60, idle);
    for (const e of game.events) renderer.onEvent(e, game);
    renderer.update(1 / 60);
  }
  if (game.phase === 'over') results();
}
requestAnimationFrame(frame);
