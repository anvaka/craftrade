// The run: loop, pause, teaching lines, bench and run-end hand-off.
//
// Timing: the sim advances in fixed 1/60 s steps from an accumulator fed by
// requestAnimationFrame. A frame never runs more than 5 steps; anything owed
// beyond that is dropped, and a frame gap is clamped to 250 ms, so a tab left
// in the background does not come back in fast-forward. Entities are drawn
// between their last two positions by alpha = accumulator / step.
import '../ui/theme.css';
import './game.css';
import { bakeAll, capDpr, type Sprites } from '../art/index.ts';
import { audio } from '../audio/index.ts';
import type { ItemSpec } from '../../shared/item.ts';
import {
  DT, ENEMIES, MAX_NODES, NODE_IDS, PK_SCRIP, WAVES, abandon, botBench, botInput, clearEvents, createBot, createRun, nextWave,
  setCarry, step, summary, type Run, type SimEvent,
} from '../../sim/index.ts';
import type { RunHandle, RunHost, RunRecap } from '../seam.ts';
import { createBench } from './bench.ts';
import { el, loadShake, saveShake, stamp } from './dom.ts';
import { createEndScreen, killerName, sourceName, type EndScreen } from './end.ts';
import { createHud, soundControls } from './hud.ts';
import { createInput } from './input.ts';
import { createRenderer } from './render.ts';
import { createRunSound } from './sound.ts';

/** Switches for the dev harness (play.html). None of them are used by the real game. */
export interface DevOpts {
  /** Let the sim's bot play forward to the start of this wave. */
  wave?: number;
  /** Or to the bench after this wave. */
  bench?: number;
  /** The bot steers during waves. */
  bot?: boolean;
  /** The bot also plays every bench and starts the next wave. */
  autoBench?: boolean;
  /** Log frame-time percentiles. */
  perf?: boolean;
  /** With perf: force the canvas to rasterise inside the measured span. */
  flush?: boolean;
  /** Run time this many times slower, to look at single frames. */
  slow?: number;
  /** Called before every sim step (god mode, stuffing the enemy pool). */
  beforeStep?(run: Run): void;
  /** Hand the run, and a way to redraw the current frame, to the harness. */
  expose?(run: Run, redraw: () => void): void;
}

const MAX_STEPS = 5;
const PK_NAME = ['scrip', 'timber', 'ore', 'hide'];

export function mount(host: RunHost, dev: DevOpts = {}): RunHandle {
  const t = host.ticket;
  const run = createRun({ seed: t.seed, character: t.character, waves: t.waves, kit: t.kit, stations: t.stations });
  const bot = dev.bot || dev.wave || dev.bench ? createBot((t.seed ^ 0x5bd1e995) >>> 0) : null;
  const botIn = { mx: 0, my: 0 };

  // Dev only: play forward headlessly. Health is topped up so the bot always arrives.
  if (bot && (dev.wave || dev.bench)) {
    for (let guard = 0; guard < 400000 && run.phase !== 'over'; guard++) {
      if (run.phase === 'wave') {
        if (dev.wave && run.wave >= dev.wave) break;
        botInput(run, bot, botIn);
        run.player.hp = run.player.maxHp;
        step(run, botIn);
        clearEvents(run);
      } else {
        if (dev.bench && run.bench.index >= dev.bench) break;
        botBench(run, bot);
        nextWave(run);
        if (dev.wave && run.wave >= dev.wave) break;
      }
    }
  }

  let sprites: Sprites = host.sprites;
  const root = el('div', 'g-root');
  if (host.root.clientHeight < 60) root.classList.add('g-root--fixed');
  const canvas = el('canvas', 'g-canvas');
  canvas.setAttribute('aria-label', 'The clearing');
  const stage = el('div', 'g-stage', canvas);
  root.append(stage);
  host.root.append(root);

  const renderer = createRenderer(canvas, sprites, run);
  renderer.shake = loadShake();
  const sound = createRunSound();
  const input = createInput(stage);
  const moveIn = { mx: 0, my: 0 };
  const hud = createHud(stage, sprites, run, () => setPaused(true));

  type State = 'wave' | 'bench' | 'beat' | 'end' | 'done';
  let state: State = 'wave';
  let alive = true;
  let paused = false;
  let quitting = false;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let alpha = 1;
  let freezeT = 0;
  let beatT = 0;
  let endScreen: EndScreen | null = null;
  let stealAt = -10, stolen = 0;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  // ---- first-run teaching: one line near the player, each shown once -------
  let teachMove = host.firstRun, teachWork = host.firstRun;
  let moved = 0, worked = 0;

  const bench = createBench(root, {
    run,
    sprites: () => sprites,
    playerName: t.profile?.name || 'You',
    firstRun: host.firstRun,
    fuse: (a, b) => host.fuse(a, b),
    next: startNext,
    pause: () => setPaused(true),
  });

  function startNext(): void {
    if (!nextWave(run)) return;
    bench.close();
    state = 'wave';
    acc = 0; alpha = 1; freezeT = 0;
    input.reset();
    renderer.snap();
    last = performance.now();
  }

  // ---- pause panel ----------------------------------------------------------
  const pausePanel = el('div', 'g-pause g-overlay');
  pausePanel.hidden = true;
  let quitArmed = false;
  let pauseSound: ReturnType<typeof soundControls> | null = null;
  function renderPause(): void {
    pauseSound?.dispose();
    pauseSound = soundControls();
    const resume = stamp('Resume', '');
    resume.dataset.fk = 'resume';
    resume.addEventListener('click', () => setPaused(false));
    const shake = stamp(renderer.shake ? 'On' : 'Off', 'stamp--plain stamp--small');
    shake.setAttribute('aria-pressed', String(renderer.shake));
    shake.setAttribute('aria-label', renderer.shake ? 'Screen shake is on' : 'Screen shake is off');
    shake.addEventListener('click', () => { renderer.shake = !renderer.shake; saveShake(renderer.shake); audio.play('stamp'); renderPause(); });
    const quit = stamp(quitArmed ? 'Sure?' : 'Quit', 'stamp--plain stamp--small');
    quit.addEventListener('click', () => {
      if (!quitArmed) { quitArmed = true; audio.play('lock'); renderPause(); return; }
      doQuit();
    });
    pausePanel.replaceChildren(el('div', 'g-panel',
      el('div', 'label', state === 'bench' ? `Bench after wave ${run.bench.index}` : `Wave ${run.wave} of ${run.totalWaves}`),
      el('h2', '', 'Paused'),
      el('div', 'g-panel-rows', resume, pauseSound.el,
        el('div', 'g-panel-row', el('span', '', 'Screen shake'), shake),
        el('div', 'g-panel-row', el('span', '', quitArmed ? 'The run ends here as a loss' : 'Quit the run'), quit))));
  }
  function setPaused(on: boolean): void {
    if (!alive || paused === on || state === 'end' || state === 'done' || state === 'beat') return;
    paused = on;
    bench.active = !on;
    input.reset();
    if (on) {
      quitArmed = false;
      renderPause();
      pausePanel.hidden = false;
      (pausePanel.querySelector('[data-fk="resume"]') as HTMLElement | null)?.focus();
    } else {
      pausePanel.hidden = true;
      pausePanel.replaceChildren();
      pauseSound?.dispose(); pauseSound = null;
      last = performance.now();
      acc = 0;
    }
  }
  root.append(pausePanel);

  function doQuit(): void {
    paused = false;
    pausePanel.hidden = true;
    pauseSound?.dispose(); pauseSound = null;
    bench.close();
    quitting = true;
    abandon(run);
    showEnd();
  }

  // ---- run end ----------------------------------------------------------------
  function showEnd(): void {
    state = 'end';
    hud.teach('', 0, 0);
    hud.el.hidden = true;
    endScreen = createEndScreen(root, sprites, run, quitting, finish);
    endScreen.el.focus();
  }
  function finish(carried: ItemSpec[]): void {
    if (state === 'done') return;
    state = 'done';
    setCarry(run, carried.map((i) => i.id));
    const s = summary(run);
    const recap: RunRecap = {
      report: {
        wavesCleared: s.wavesCleared, won: s.won, scripEarned: s.scripEarned, scripHeld: s.scripHeld, level: s.level,
        raws: s.raws, mule: s.mule, carry: s.carry, kills: s.kills, fusions: s.fusions,
      },
      killedBy: killerName(run),
      endWave: s.endWave,
      seconds: s.seconds,
      damageBy: Object.entries(s.damageBy).sort((a, b) => b[1] - a[1]).map(([id, damage]) => ({ id, name: sourceName(id), damage })),
      damageTaken: s.damageTaken,
      rawsGathered: s.rawsGathered,
      items: run.player.items.slice(),
      carried,
    };
    host.onEnd(recap);
    if (quitting) host.onQuit();
  }

  // ---- events -------------------------------------------------------------------
  function drain(): void {
    const q = run.events;
    const vw = renderer.viewW();
    for (let i = 0; i < q.n; i++) {
      const ev: SimEvent = q.list[i];
      renderer.event(ev);
      sound.event(ev, renderer.screenX(ev.x), vw);
      switch (ev.type) {
        case 'waveStart': {
          const def = WAVES[ev.b - 1];
          if (def) hud.notice(`Wave ${ev.a}`, def.brief, !!def.elite, 3.6);
          break;
        }
        case 'hurt': hud.hurt(); break;
        case 'steal': {
          stolen += ev.b;
          const now = performance.now() / 1000;
          if (now - stealAt > 2.5) {
            hud.notice('Magpie', `Took ${stolen} ${PK_NAME[ev.a] ?? 'scrip'}. Kill it to get it back.`, true, 2.6);
            stealAt = now; stolen = 0;
          }
          break;
        }
        case 'escape': hud.notice('Magpie', `Got away with ${ev.a} ${ev.a === 1 ? 'piece' : 'pieces'}.`, true, 2.6); break;
        case 'secondWind': hud.notice('Second wind', `${Math.ceil(ev.a)} HP left.`, true, 2.4); break;
        case 'bossPhase': hud.notice(ENEMIES[run.enemies[run.eliteIdx]?.type ?? 9]?.name ?? 'Old Tusk', `Phase ${ev.a} of 3.`, true, 2.4); break;
        case 'break': if (teachWork) worked = 99; break;
        case 'pickup': if (ev.a !== PK_SCRIP && teachWork) worked = 99; break;
      }
    }
    clearEvents(run);
  }

  function teach(dt: number): void {
    if (!teachMove && !teachWork) { hud.teach('', 0, 0); return; }
    const p = run.player;
    const x = renderer.screenX(p.x), y = renderer.screenY(p.y) + 26;
    if (teachMove) {
      if (p.moving) moved += dt;
      if (moved > 0.7) teachMove = false;
      else { hud.teach(coarse ? 'Drag anywhere to move' : 'Move with WASD or the arrow keys', x, y); return; }
    }
    if (teachWork) {
      if (worked > 1) { teachWork = false; hud.teach('', 0, 0); return; }
      let best = -1, bd = 1e12;
      for (let i = 0; i < MAX_NODES; i++) {
        const n = run.nodes[i];
        if (!n.alive) continue;
        const d = (n.x - p.x) * (n.x - p.x) + (n.y - p.y) * (n.y - p.y);
        if (d < bd) { bd = d; best = i; }
      }
      // Said until a node has been broken; quiet while the player is doing it.
      if (best < 0 || p.workingNode >= 0) { hud.teach('', 0, 0); return; }
      hud.teach(`Stand in a ring to work the ${NODE_IDS[run.nodes[best].type] ?? 'tree'}`, x, y);
    }
  }

  // ---- perf readout (dev) ---------------------------------------------------------
  const frameMs: number[] = [], workMs: number[] = [];
  let perfAt = performance.now();
  let perfEnemies = 0;
  function perfReport(now: number): void {
    if (now - perfAt < 5000 || frameMs.length < 30) return;
    const pct = (a: number[], q: number): string => {
      const s = a.slice().sort((x, y) => x - y);
      return s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(2);
    };
    const text = `perf frames=${frameMs.length} enemies(max)=${perfEnemies} drawn=${renderer.drawn} ` +
      `interval ms p50=${pct(frameMs, 0.5)} p95=${pct(frameMs, 0.95)} p99=${pct(frameMs, 0.99)} max=${pct(frameMs, 1)} | ` +
      `work ms p50=${pct(workMs, 0.5)} p95=${pct(workMs, 0.95)} p99=${pct(workMs, 0.99)} max=${pct(workMs, 1)}`;
    console.log(text);
    (window as unknown as { __perf?: string[] }).__perf = [...((window as unknown as { __perf?: string[] }).__perf ?? []), text];
    frameMs.length = 0; workMs.length = 0; perfAt = now; perfEnemies = 0;
  }

  // ---- the loop --------------------------------------------------------------------
  function frame(now: number): void {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dev.perf && state === 'wave' && !paused && dt > 0) frameMs.push(dt * 1000);
    if (dt > 0.25) dt = 0.25;
    if (dev.slow) dt /= dev.slow;
    if (paused || state === 'bench' || state === 'end' || state === 'done') return;
    const t0 = dev.perf ? performance.now() : 0;

    if (state === 'wave') {
      if (freezeT > 0) freezeT -= dt;
      else {
        acc += dt;
        let steps = 0;
        while (acc >= DT && steps < MAX_STEPS) {
          if (bot && dev.bot) botInput(run, bot, moveIn); else input.read(moveIn);
          dev.beforeStep?.(run);
          step(run, moveIn);
          steps++;
          acc -= DT;
          drain();
          if (run.phase !== 'wave') { acc = 0; break; }
          const f = renderer.takeFreeze();
          if (f > 0) { freezeT = f; if (acc > DT) acc = DT; break; }
        }
        if (acc >= DT) acc = 0; // more than five steps owed: drop the rest
        alpha = run.phase === 'wave' ? acc / DT : 1;
        renderer.update(dt);
      }
      hud.update(dt);
      teach(dt);
      if (dev.perf && run.enemyCount > perfEnemies) perfEnemies = run.enemyCount;
      if (run.phase === 'bench') {
        state = 'bench';
        input.reset();
        hud.teach('', 0, 0);
        if (bot && dev.autoBench) { botBench(run, bot); startNext(); }
        else bench.open();
        return;
      }
      if (run.phase === 'over') {
        state = 'beat';
        beatT = run.won ? 1.7 : 1.5;
        if (run.won) audio.play('win');
        input.reset();
        hud.teach('', 0, 0);
      }
    } else if (state === 'beat') {
      // The scene holds; only the debris keeps moving.
      renderer.takeFreeze();
      renderer.update(dt);
      hud.update(dt);
      beatT -= dt;
      alpha = 1;
      if (beatT <= 0) { showEnd(); return; }
    }
    renderer.draw(alpha);
    if (dev.perf) {
      // With flush set, read one pixel back so the time includes rasterising the frame, not just recording it.
      if (dev.flush) canvas.getContext('2d')!.getImageData(0, 0, 1, 1);
      workMs.push(performance.now() - t0);
      perfReport(now);
    }
  }

  // ---- size, pixel ratio, focus --------------------------------------------------------
  // Two sprite sets may be live: `sprites` at the device pixel ratio for DOM
  // icons, and `world` at ratio x zoom so the clearing is blitted 1:1 on phones.
  let world: Sprites = sprites;
  function fit(): void {
    if (!alive) return;
    const ratio = capDpr(window.devicePixelRatio || 1);
    if (ratio !== sprites.dpr) {
      sprites = bakeAll(ratio);
      hud.rebind(sprites);
    }
    const r = stage.getBoundingClientRect();
    renderer.resize(r.width, r.height, ratio);
    const want = capDpr(ratio * renderer.zoom());
    if (want !== world.dpr) {
      world = want === sprites.dpr ? sprites : bakeAll(want);
      renderer.setSprites(world);
    }
    if (state === 'wave' || state === 'beat') renderer.draw(alpha);
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  ro?.observe(stage);
  let dprQuery: MediaQueryList | null = null;
  const onDpr = (): void => { armDpr(); fit(); };
  function armDpr(): void {
    dprQuery?.removeEventListener('change', onDpr);
    dprQuery = typeof matchMedia === 'function' ? matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`) : null;
    dprQuery?.addEventListener('change', onDpr);
  }
  armDpr();
  window.addEventListener('resize', fit);

  const onBlur = (): void => { if (state === 'wave' && !dev.bot) setPaused(true); };
  const onVis = (): void => { if (document.hidden) { if (state === 'wave') setPaused(true); } else last = performance.now(); };
  const onKey = (e: KeyboardEvent): void => {
    if (e.code !== 'Escape' || e.repeat) return;
    e.preventDefault();
    setPaused(!paused);
  };
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('keydown', onKey);

  dev.expose?.(run, () => renderer.draw(alpha));
  fit();
  if (run.phase === 'bench') { state = 'bench'; bench.open(); }
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      dprQuery?.removeEventListener('change', onDpr);
      window.removeEventListener('resize', fit);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('keydown', onKey);
      pauseSound?.dispose();
      input.destroy();
      hud.destroy();
      bench.destroy();
      endScreen?.destroy();
      root.remove();
    },
  };
}
