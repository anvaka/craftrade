// The run: loop, pause, teaching lines, beats, bench and run-end hand-off.
//
// Beats: a wave cleared holds the scene for a moment while what was left on
// the floor flies in and a card says what the wave paid; a death holds it
// with the name of what did it; an elite or the boss arrives under a card.
// Teaching is one line near the player at a time, kept until the player has
// done the thing (see progress.ts), never a modal.
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
import { bedLevel } from '../audio/music.ts';
import type { ItemSpec } from '../../shared/item.ts';
import { RELICS } from '../../shared/content/relics.ts';
import {
  DT, ENEMIES, HAZARD_RULES, NODE_CHEST, PARTS, PK_PART, PK_RELIC, PK_SCHEMATIC, PK_T2, SKILL_NAME, doorShut, MAX_ENEMIES, MAX_NODES, NODE_IDS, PK_SCRIP, WAVES, abandon, botBench, botInput, carryLimit, carryable, clearEvents,
  createBot, createRun, nextWave, setCarry, step, summary, type Run, type SimEvent,
} from '../../sim/index.ts';
import { fusedOf, killsOf, rec, record, replayOf, resumeInto } from '../../shared/replay.ts';
import type { RunHandle, RunHost, RunRecap } from '../seam.ts';
import { CONFIRM_GAP, DISARM_MS, createBench } from './bench.ts';
import { el, loadShake, saveShake, stamp } from './dom.ts';
import { createEndScreen, defaultCarry, gotYou, killerName, sourceName, theName, type EndScreen } from './end.ts';
import { createHud, soundControls } from './hud.ts';
import { createInput } from './input.ts';
import { learn, learned, recordRun } from './progress.ts';
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
  expose?(run: Run, redraw: () => void, playerScreen: () => { x: number; y: number; zoom: number }): void;
  /** False: no teaching lines (the harness, unless ?first=1). */
  teach?: boolean;
}

const MAX_STEPS = 5;
const PK_NAME = ['scrip', 'timber', 'ore', 'hide'];
/** Seconds the scene holds after a wave is cleared, before the bench. */
const CLEAR_BEAT = 1.05;
const DEATH_BEAT = 1.5, WIN_BEAT = 2.1;
/** What an elite or the boss does, said once on its card. */
const ARRIVAL: Record<string, string> = {
  stag: 'It charges three times and leaves shards where it stops.',
  rotwood: 'It sheds mites. Stand in its ring to work it like a tree.',
  tusk: 'Three phases: it charges, it calls a pack, it slams.',
};
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mount(host: RunHost, dev: DevOpts = {}): RunHandle {
  const t = host.ticket;
  const run = createRun({ seed: t.seed, character: t.character, waves: t.waves, kit: t.kit, stations: t.stations, hazard: t.hazard ?? 0, lull: host.proto?.lull, skillXp: host.proto?.skillXp,
    forge: host.proto?.forge?.run } as Parameters<typeof createRun>[0]);
  // The input log the town checks the report against. A run driven by the dev harness is not a real one and is not logged.
  if (!Object.keys(dev).length) record(run);
  // A run saved at a bench: play its log forward (a second or two) and stand at that bench again.
  if (host.resume && !resumeInto(run, host.resume.replay, host.resume.items)) throw new Error('The saved run could not be played forward.');
  /** Write the run down while it stands at a bench, so closing the page does not lose it. */
  const saveAtBench = (): void => {
    if (run.phase !== 'bench' || !host.onSave) return;
    const replay = replayOf(run);
    if (replay) host.onSave({ replay, items: fusedOf(run), wave: run.wave });
  };
  // A phone may close the page without a word once it is in the background.
  const onHidden = (): void => { if (document.visibilityState === 'hidden') saveAtBench(); };
  document.addEventListener('visibilitychange', onHidden);
  // Forge game: what each drop is called, and which schematics the next drops teach.
  const fp = host.proto?.forge ?? null;
  let teachNext = 0;

  // For tests of the lull prototype.
  if (host.proto) (window as unknown as { __run?: Run }).__run = run;
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
  renderer.reduced = reducedMotion();
  const sound = createRunSound(run);
  const input = createInput(stage);
  const moveIn = { mx: 0, my: 0 };
  const hud = createHud(stage, sprites, run, () => setPaused(true));

  // Forge game: a shut door says what opens it.
  if (fp) {
    renderer.over = (ctx, x0, y0, x1, y1) => {
      const z = renderer.zoom();
      ctx.save();
      ctx.font = `700 ${13 / z}px "Zilla Slab", serif`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4 / z;
      for (const n of run.nodes) {
        if (!n.alive || n.tier < 2 || n.x < x0 || n.x > x1 || n.y < y0 || n.y > y1 + 120) continue;
        const shut = doorShut(run, n.type, n.tier);
        const text = shut ? `Tier ${n.tier} ${['hatchet', 'pick', 'knife'][n.type] ?? 'tool'}` : 'Tier 2';
        ctx.strokeStyle = '#D9D3BD'; ctx.fillStyle = shut ? '#B8402E' : '#3E6C8A';
        ctx.strokeText(text, n.x, n.y + 22 / z);
        ctx.fillText(text, n.x, n.y + 22 / z);
      }
      ctx.restore();
    };
  }

  // In a lull, every node off the screen has a mark at the edge pointing to it: plain Ink, rich Ochre, the chest largest.
  // Without them a phone shows one node at a time and there is nothing to choose between.
  if (run.lull > 0) {
    renderer.over = (ctx, x0, y0, x1, y1) => {
      if (run.lullT <= 0) return;
      const z = renderer.zoom(), [it, ir, ib, il] = hud.insets();
      const m = 22 / z;
      const L = x0 + 90 + il / z + m, R = x1 - 90 - ir / z - m, T = y0 + 90 + it / z + m, B = y1 - 90 - ib / z - m;
      if (R <= L || B <= T) return;
      const cx = (L + R) / 2, cy = (T + B) / 2;
      ctx.save();
      ctx.lineJoin = 'miter';
      ctx.lineWidth = 3 / z;
      ctx.strokeStyle = '#1B2226';
      for (const n of run.nodes) {
        if (!n.alive || (n.x >= L && n.x <= R && n.y >= T && n.y <= B)) continue;
        const dx = n.x - cx, dy = n.y - cy;
        const k = Math.min(dx !== 0 ? (dx > 0 ? R - cx : L - cx) / dx : 1e9, dy !== 0 ? (dy > 0 ? B - cy : T - cy) / dy : 1e9);
        const px = cx + dx * k, py = cy + dy * k, a = Math.atan2(dy, dx);
        const chest = n.type === NODE_CHEST, s = (chest ? 15 : n.rich ? 11 : 8) / z;
        ctx.fillStyle = chest || n.rich ? '#D99A2B' : '#D9D3BD';
        ctx.beginPath();
        ctx.moveTo(px + Math.cos(a) * s, py + Math.sin(a) * s);
        ctx.lineTo(px + Math.cos(a + 2.45) * s, py + Math.sin(a + 2.45) * s);
        ctx.lineTo(px + Math.cos(a - 2.45) * s, py + Math.sin(a - 2.45) * s);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        if (chest) {
          const bx = px - Math.cos(a) * s * 1.5, by = py - Math.sin(a) * s * 1.5, h = 6 / z;
          ctx.fillRect(bx - h, by - h, h * 2, h * 2); ctx.strokeRect(bx - h, by - h, h * 2, h * 2);
        }
      }
      ctx.restore();
    };
  }

  type State = 'wave' | 'clear' | 'bench' | 'beat' | 'end' | 'done';
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
  let clearT = 0, sweepTickT = 0, sweepTicks = 0, paidDue = -1;
  let heartT = 0;
  let insetT = 0;
  // What the wave has paid so far is the difference from these.
  let scrip0 = run.scripEarned, bank0 = run.player.bank;
  let raws0 = { ...run.gathered };
  let endScreen: EndScreen | null = null;
  let stealAt = -10, stolen = 0;
  // A phone, by its pointer or by having no hover and a touch screen; and any device the moment it is touched.
  let coarse = typeof matchMedia === 'function' &&
    (matchMedia('(pointer: coarse)').matches || (matchMedia('(hover: none)').matches && navigator.maxTouchPoints > 0));
  const onFirstTouch = (): void => { coarse = true; };
  stage.addEventListener('touchstart', onFirstTouch, { passive: true, once: true });

  // ---- teaching: one line near the player, each kept until the thing is done ----
  // Tracked per device, not per run: a player who died without moving is
  // still told how to move on the next run.
  const teachOn = dev.teach !== false;
  let teachMove = teachOn && !learned('move'), teachWork = teachOn && !learned('work');
  let teachKeep = teachOn && !learned('keepMoving'), teachRaws = teachOn && !learned('raws'), teachLevel = teachOn && !learned('level');
  let moved = 0, keepArmed = false, keepMoved = 0, idleT = 0;

  const bench = createBench(root, {
    run,
    sprites: () => sprites,
    playerName: t.profile?.name || 'You',
    teach: teachOn,
    fuse: (a, b) => host.fuse(a, b),
    next: startNext,
    changed: saveAtBench,
    pause: () => setPaused(true),
  });

  function startNext(): void {
    // What was bought at this bench is part of the save.
    saveAtBench();
    if (!rec.nextWave(run)) return;
    bench.close();
    state = 'wave';
    hud.card('', '', '', 'plain', 0);
    scrip0 = run.scripEarned; bank0 = run.player.bank; raws0 = { ...run.gathered };
    acc = 0; alpha = 1; freezeT = 0;
    input.reset();
    renderer.snap();
    last = performance.now();
  }

  // ---- pause panel ----------------------------------------------------------
  const pausePanel = el('div', 'g-pause g-overlay');
  pausePanel.hidden = true;
  let quitArmed = false;
  let quitArmedAt = 0, quitTimer = 0;
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
    const song = stamp(audio.songOn ? 'On' : 'Off', 'stamp--plain stamp--small');
    song.setAttribute('aria-pressed', String(audio.songOn));
    song.setAttribute('aria-label', audio.songOn ? 'The work song is on' : 'The work song is off');
    song.addEventListener('click', () => { audio.setSong(!audio.songOn); audio.play('stamp'); renderPause(); });
    const quit = stamp(quitArmed ? 'Sure?' : 'Quit', `stamp--plain stamp--small${quitArmed ? ' is-pressed' : ''}`);
    quit.dataset.fk = 'quit';
    quit.addEventListener('click', () => {
      if (!quitArmed) {
        quitArmed = true; quitArmedAt = performance.now(); audio.play('lock'); renderPause();
        // Unanswered, it goes back to Quit: a tap much later is not the yes.
        window.clearTimeout(quitTimer);
        quitTimer = window.setTimeout(() => { if (quitArmed && paused && alive) { quitArmed = false; renderPause(); } }, DISARM_MS);
        return;
      }
      // A double tap or a bounce is not a decision.
      if (performance.now() - quitArmedAt < CONFIRM_GAP) return;
      window.clearTimeout(quitTimer);
      doQuit();
    });
    pausePanel.replaceChildren(el('div', 'g-panel',
      el('div', 'label', state === 'bench' ? `Bench after wave ${run.bench.index}` : `Wave ${run.wave} of ${run.totalWaves}`),
      el('h2', '', 'Paused'),
      run.hazard > 0 ? el('p', 'note', `Hazard ${run.hazard}. ${HAZARD_RULES.slice(1, run.hazard + 1).map((r) => r.text).join(' ')}`) : null,
      el('div', 'g-panel-rows', resume, pauseSound.el,
        el('div', 'g-panel-row', el('span', '', 'Work song'), song),
        el('div', 'g-panel-row', el('span', '', 'Screen shake'), shake),
        el('div', 'g-panel-row g-panel-quit', el('span', '', quitArmed ? 'The run ends here as a loss' : 'Quit the run'), quit))));
  }
  function setPaused(on: boolean): void {
    if (!alive || paused === on || state === 'end' || state === 'done' || state === 'beat' || state === 'clear') return;
    paused = on;
    bench.active = !on;
    input.reset();
    if (on) {
      audio.setBed(null);
      quitArmed = false;
      renderPause();
      pausePanel.hidden = false;
      (pausePanel.querySelector('[data-fk="resume"]') as HTMLElement | null)?.focus();
    } else {
      pausePanel.hidden = true;
      pausePanel.replaceChildren();
      pauseSound?.dispose(); pauseSound = null;
      quitArmed = false;
      window.clearTimeout(quitTimer);
      last = performance.now();
      acc = 0;
      slowT = 0; slowBadT = 0; slowSkip = 500;
    }
  }
  root.append(pausePanel);

  function doQuit(): void {
    paused = false;
    pausePanel.hidden = true;
    pauseSound?.dispose(); pauseSound = null;
    bench.close();
    quitting = true;
    rec.abandon(run);
    showEnd();
  }

  // ---- run end ----------------------------------------------------------------
  // One recap, and it is the town's. The game only stops to ask when there is
  // something to choose: more items that could go home than may.
  function showEnd(): void {
    state = 'end';
    audio.setBed(null);
    hud.teach('', 0, 0);
    renderer.pointAt(null);
    const limit = carryLimit(run), pool = carryable(run);
    if (limit <= 0 || pool.length <= limit) { finish(defaultCarry(run)); return; }
    hud.el.hidden = true;
    endScreen = createEndScreen(root, sprites, run, quitting, finish);
  }
  /** One true line about how close it was, or null. */
  function nearMiss(): string | null {
    if (run.won || quitting || run.phase !== 'over') return null;
    const e = run.eliteIdx >= 0 ? run.enemies[run.eliteIdx] : null;
    if (e && e.alive && e.hp / e.maxHp <= 0.35) {
      return `${theName(ENEMIES[e.type]?.name ?? 'It')} had ${Math.max(1, Math.round((e.hp / e.maxHp) * 100))}% of its health left.`;
    }
    const left = Math.ceil(run.waveSeconds - run.waveTime);
    if (left >= 1 && left <= 8 && !(e && e.alive && ENEMIES[e.type]?.rank === 2)) return `${left} ${left === 1 ? 'second' : 'seconds'} from clearing wave ${run.wave}.`;
    if (run.wave % 4 === 0 && run.wave <= run.totalWaves) return 'One wave short of carrying an item home.';
    return null;
  }
  function finish(carried: ItemSpec[]): void {
    if (state === 'done') return;
    state = 'done';
    rec.setCarry(run, carried.map((i) => i.id));
    const s = summary(run);
    const replay = replayOf(run);
    const best = host.mode === 'run' && !quitting ? recordRun(s.won ? s.totalWaves : s.endWave, s.won) : undefined;
    const recap: RunRecap = {
      report: {
        wavesCleared: s.wavesCleared, won: s.won, scripEarned: s.scripEarned, scripHeld: s.scripHeld, level: s.level,
        raws: s.raws, mule: s.mule, carry: s.carry, kills: s.kills, fusions: s.fusions,
        ...(quitting ? { quit: true } : {}),
        ...(replay ? { replay, killsBy: killsOf(run) } : {}),
      },
      killedBy: killerName(run),
      endWave: s.endWave,
      seconds: s.seconds,
      damageBy: Object.entries(s.damageBy).sort((a, b) => b[1] - a[1]).map(([id, damage]) => ({ id, name: sourceName(id), damage, tier: run.player.weapons.filter((w) => w.id === id).reduce((t, w) => Math.max(t, w.tier), 0) || undefined })),
      damageTaken: s.damageTaken,
      rawsGathered: s.rawsGathered,
      ...(run.lull > 0 ? { skillXp: Array.from(run.skillXp) } : {}),
      ...(s.forge ? { forge: s.forge } : {}),
      items: run.player.items.slice(),
      carried,
      nearMiss: nearMiss(),
      best,
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
          if (def) hud.notice(fp && ev.a === 1 ? `${fp.zoneName}, wave 1` : `Wave ${ev.a}`, def.brief, !!def.elite, 3.6);
          break;
        }
        case 'lull':
          hud.card('Cleared', `${Math.round(ev.a)} seconds to gather`, ev.c ? 'Plain nodes are free. Rich ones and the chest are guarded.' : 'Plain nodes are free. Rich ones are guarded.', 'paid', 4);
          break;
        case 'glint':
          // The colour comes before the name: a chime for purple, a stop and a ring for orange.
          if (!fp) break;
          if (ev.a >= 4) { freezeT = Math.max(freezeT, renderer.reduced ? 0 : 0.4); audio.play('relic'); }
          else if (ev.a === 3) audio.play('reveal');
          break;
        case 'loot': {
          if (!fp) break;
          if (ev.a === PK_SCHEMATIC) {
            const name = fp.teach[teachNext++];
            audio.play(name ? 'revealFirst' : 'reveal');
            hud.card('Schematic', name ?? 'One you know', name ? 'New. You can make it at home.' : 'Known already: it will sell at home.', 'paid', 3.4);
          } else if (ev.a === PK_PART) {
            const pd = PARTS[ev.b];
            audio.play('combine');
            if (pd) hud.card('Part', pd.name, ev.c ? `${pd.what} Fitted for this run.` : 'No free socket. It goes home with you.', 'paid', 3.4);
          } else if (ev.a === PK_RELIC) {
            const r = RELICS[ev.b];
            if (r) hud.card('Relic', r.name, 'In play for the rest of the run, and yours to keep.', 'paid', 4);
          } else if (ev.a >= PK_T2 && ev.a < PK_T2 + 3) {
            hud.notice(fp.t2Names[ev.a - PK_T2] ?? 'Tier 2', 'A tier 2 material.', false, 1.6);
          }
          break;
        }
        case 'locked':
          if (fp) hud.notice(`Needs a tier ${ev.b} ${['hatchet', 'pick', 'knife'][ev.a] ?? 'tool'}`, 'Made at the forge at home.', false, 2.2);
          break;
        case 'chest':
          audio.play('paid');
          hud.notice('Chest', `${ev.a} scrip, raws, and one more upgrade pick at the bench.`, false, 4);
          break;
        case 'skill':
          if (ev.c > 0) { audio.play('levelUp'); hud.notice(`${SKILL_NAME[ev.a]} ${ev.c}`, 'You work that kind of node 6% faster.', false, 3.4); }
          break;
        case 'hurt':
          hud.hurt();
          if (teachKeep) keepArmed = true;
          break;
        case 'levelup': {
          hud.levelUp();
          if (teachLevel) {
            teachLevel = false; learn('level');
            hud.notice(`Level ${ev.a}`, 'Scrip is also experience. A level is one upgrade pick at the bench.', false, 6);
          }
          break;
        }
        case 'eliteSpawn':
        case 'bossSpawn': {
          const def = ENEMIES[ev.a];
          if (def) hud.card(ev.type === 'bossSpawn' ? 'Boss' : 'Elite', theName(def.name), ARRIVAL[def.id] ?? '', 'danger', 3.4);
          break;
        }
        case 'eliteDeath': {
          const def = ENEMIES[ev.a];
          if (def) hud.card('Elite', `${theName(def.name)} is down`, def.scrip > 0 ? `It dropped ${def.scrip} scrip.` : '', 'paid', 2.6);
          break;
        }
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
        case 'break':
          if (teachWork) { teachWork = false; learn('work'); renderer.pointAt(null); }
          break;
        case 'pickup':
          if (ev.a !== PK_SCRIP && teachRaws) {
            teachRaws = false; learn('raws');
            hud.notice('Raws', 'Timber, ore and hide are raws. They pay for bench recipes, and what you keep goes home.', false, 7);
          }
          break;
      }
    }
    clearEvents(run);
  }

  /** The wave is cleared: say what it paid, and let the floor fly in before the bench. */
  function waveCleared(): void {
    const p = run.player;
    const paid: string[] = [`${run.scripEarned - scrip0} scrip`];
    for (const r of ['timber', 'ore', 'hide'] as const) { const n = run.gathered[r] - raws0[r]; if (n > 0) paid.push(`${n} ${r}`); }
    let sub = `Paid ${paid.join(', ')}.`;
    const left = Math.round(p.bank - bank0);
    if (left > 0) sub += ` ${left} scrip left behind.`;
    if (!run.won && run.bench.picks > 0) sub += ` ${run.bench.picks === 1 ? '1 upgrade pick' : `${run.bench.picks} upgrade picks`} at the bench.`;
    hud.card('Cleared', run.won ? `All ${run.totalWaves} waves cleared` : `Wave ${run.wave} cleared`, sub, 'paid', 0);
    sweepTickT = 0.12; sweepTicks = 0; paidDue = 0.42;
    audio.setBed(null);
    input.reset();
    hud.teach('', 0, 0);
    renderer.pointAt(null);
  }
  /** Sounds of the sweep: a rising run of ticks while pickups land, then the count. */
  function clearSounds(dt: number): void {
    if (renderer.sweeping() > 0 && sweepTicks < 9) {
      sweepTickT -= dt;
      if (sweepTickT <= 0) { sweepTickT = 0.065; sweepTicks++; audio.play('scrip', { gain: 0.9 }); }
    }
    if (paidDue >= 0) { paidDue -= dt; if (paidDue < 0) audio.play('paid'); }
  }

  function nearestEnemy2(): number {
    const p = run.player;
    let best = 1e12;
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const e = run.enemies[i];
      if (!e.alive) continue;
      const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
      if (d < best) best = d;
    }
    return best;
  }

  function teach(dt: number): void {
    if (!teachMove && !teachWork && !teachKeep) { hud.teach('', 0, 0); return; }
    const p = run.player;
    const x = renderer.screenX(p.x), y = renderer.screenY(p.y) + 26;
    if (teachMove) {
      if (p.moving) moved += dt;
      if (moved > 0.7) { teachMove = false; learn('move'); }
      else { hud.teach(coarse ? 'Drag anywhere to move' : 'Move with WASD or the arrow keys', x, y); return; }
    }
    // The two words that matter. Said after the first hit, or when something is
    // on top of a player who is standing still, and kept until they have moved off.
    if (teachKeep) {
      if (!keepArmed) {
        idleT = p.moving ? 0 : idleT + dt;
        if (idleT > 1.2 && nearestEnemy2() < 150 * 150) keepArmed = true;
      } else {
        if (p.moving) keepMoved += dt;
        if (keepMoved > 2.5) { teachKeep = false; learn('keepMoving'); }
        else { renderer.pointAt(null); hud.teach('Keep moving. Touch hurts.', x, y, true); return; }
      }
    }
    if (teachWork) {
      let best = -1, bd = 1e12;
      for (let i = 0; i < MAX_NODES; i++) {
        const n = run.nodes[i];
        if (!n.alive) continue;
        const d = (n.x - p.x) * (n.x - p.x) + (n.y - p.y) * (n.y - p.y);
        if (d < bd) { bd = d; best = i; }
      }
      // Said until a node has been broken; quiet while the player is doing it.
      if (best < 0) { renderer.pointAt(null); hud.teach('', 0, 0); return; }
      const n = run.nodes[best];
      renderer.pointAt(n.x, n.y);
      if (p.workingNode >= 0) { hud.teach('Stay in the ring until it breaks', x, y); return; }
      hud.teach(`Stand in the ring to work the ${NODE_IDS[n.type] ?? 'tree'}`, x, y);
      return;
    }
    hud.teach('', 0, 0);
  }

  /** Low health: a heartbeat, quicker when it is nearly over, and the edge hatch steps with it. */
  function heart(dt: number): void {
    const p = run.player;
    const k = p.hp / Math.max(1, p.maxHp);
    if (p.hp <= 0 || k > 0.3) { heartT = 0; return; }
    heartT -= dt;
    if (heartT > 0) return;
    heartT = k <= 0.15 ? 0.62 : 0.95;
    audio.play('heart');
    renderer.pulse();
  }

  /** Tell the camera what the HUD covers. Cheap, and only a few times a second. */
  function syncInsets(): void {
    const [it, ir, ib, il] = hud.insets();
    renderer.setInsets(it, ir, ib, il);
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

  // ---- slow devices -----------------------------------------------------------------
  // Filling the canvas is the main cost of a frame. If most of three seconds
  // of play went on frames slower than 25 a second (so a phone capped at 30
  // is left alone), draw fewer pixels: device ratio x 0.75, then x 0.5. It
  // only ever steps down, at most twice a run.
  const SLOW_MS = 40, SLOW_WINDOW_MS = 3000;
  let slowT = 0, slowBadT = 0, slowSkip = 2000;
  function slowWatch(ms: number): void {
    if (quality <= 0.5 || ms > 1500) return; // a stall that long is the tab coming back, not the device
    if (slowSkip > 0) { slowSkip -= ms; return; }
    slowT += ms;
    if (ms > SLOW_MS) slowBadT += ms;
    if (slowT < SLOW_WINDOW_MS) return;
    const bad = slowBadT / slowT;
    slowT = 0; slowBadT = 0;
    if (bad < 0.6) return;
    if (capDpr(window.devicePixelRatio || 1) * quality <= 1) { quality = 0.5; return; }
    quality = quality > 0.75 ? 0.75 : 0.5;
    slowSkip = 1500; // let the rebake and the resize settle before judging again
    fit();
    (window as unknown as { __quality?: number }).__quality = quality;
  }

  // ---- the loop --------------------------------------------------------------------
  function frame(now: number): void {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dev.perf && state === 'wave' && !paused && dt > 0) frameMs.push(dt * 1000);
    if (state === 'wave' && !paused && dt > 0 && !dev.slow) slowWatch(dt * 1000);
    if (dt > 0.25) dt = 0.25;
    if (dev.slow) dt /= dev.slow;
    if (paused || state === 'bench' || state === 'end' || state === 'done') return;
    const t0 = dev.perf ? performance.now() : 0;

    if (state === 'wave') {
      const el_ = run.eliteIdx >= 0 ? run.enemies[run.eliteIdx] : null;
      audio.setBed(bedLevel(run.wave, run.totalWaves, !!el_ && el_.alive));
      insetT -= dt;
      if (insetT <= 0) { insetT = 0.25; syncInsets(); }
      if (freezeT > 0) freezeT -= dt;
      else {
        acc += dt;
        let steps = 0;
        while (acc >= DT && steps < MAX_STEPS) {
          if (bot && dev.bot) botInput(run, bot, moveIn); else input.read(moveIn);
          dev.beforeStep?.(run);
          rec.step(run, moveIn);
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
      if (run.phase === 'wave') { teach(dt); heart(dt); }
      if (dev.perf && run.enemyCount > perfEnemies) perfEnemies = run.enemyCount;
      if (run.phase === 'bench') {
        // The beat between the fight and the bench.
        state = 'clear';
        clearT = CLEAR_BEAT;
        waveCleared();
      } else if (run.phase === 'over') {
        state = 'beat';
        beatT = run.won ? WIN_BEAT : DEATH_BEAT;
        input.reset();
        hud.teach('', 0, 0);
        renderer.pointAt(null);
        audio.setBed(null);
        if (run.won) { waveCleared(); audio.play('win'); }
        else {
          // What hurt you, on the line the run ends on.
          const by = killerName(run);
          hud.card('Down', `Down in wave ${run.wave}`, by ? gotYou(by) : '', 'danger', 0);
        }
      }
    } else if (state === 'clear') {
      // The scene holds while the floor flies in; then the bench.
      renderer.takeFreeze();
      renderer.update(dt);
      hud.update(dt);
      clearSounds(dt);
      clearT -= dt;
      alpha = 1;
      if (clearT <= 0) {
        state = 'bench';
        hud.card('', '', '', 'plain', 0);
        if (bot && dev.autoBench) { botBench(run, bot); startNext(); }
        else { saveAtBench(); bench.open(); return; }
      }
    } else if (state === 'beat') {
      // The scene holds; only the debris keeps moving.
      renderer.takeFreeze();
      renderer.update(dt);
      hud.update(dt);
      if (run.won) clearSounds(dt);
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
  // The canvas may be drawn below the device ratio (never below 1) when the
  // device cannot keep up; see slowWatch(). DOM icons stay at the full ratio.
  let quality = 1;
  function fit(): void {
    if (!alive) return;
    const full = capDpr(window.devicePixelRatio || 1);
    if (full !== sprites.dpr) {
      sprites = bakeAll(full);
      hud.rebind(sprites);
    }
    const ratio = Math.max(1, full * quality);
    const r = stage.getBoundingClientRect();
    renderer.resize(r.width, r.height, ratio);
    const want = capDpr(ratio * renderer.zoom());
    if (want !== world.dpr) {
      world = want === sprites.dpr ? sprites : bakeAll(want);
      renderer.setSprites(world);
    }
    syncInsets();
    if (state === 'wave' || state === 'beat' || state === 'clear') renderer.draw(alpha);
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
  // Back during a run (Android's back, an edge swipe, the browser's button) opens
  // the pause panel instead of leaving: the run stands on a history entry of
  // its own, and a back that takes it away puts it back.
  const RUN_STATE = 'scrip-run';
  const onRunEntry = (): boolean => (history.state as { [k: string]: unknown } | null)?.[RUN_STATE] === true;
  const pushRunEntry = (): void => { try { history.pushState({ ...(history.state ?? {}), [RUN_STATE]: true }, ''); } catch { /* sandboxed: no history */ } };
  const onPop = (): void => {
    if (!alive || onRunEntry()) return;
    pushRunEntry();
    if (state === 'wave' || state === 'bench') setPaused(true);
  };
  pushRunEntry();
  window.addEventListener('popstate', onPop);
  // The browser's bar takes the clearing's colour while the run is up.
  const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]') ?? null;
  const themeWas = themeMeta?.getAttribute('content') ?? null;
  const themeOwn = themeMeta ?? document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'theme-color' }));
  themeOwn.setAttribute('content', getComputedStyle(root).backgroundColor || '#2f4a3c');

  // Safari's own pinch event, for versions that let it through touch-action.
  const onGesture = (e: Event): void => { e.preventDefault(); };
  root.addEventListener('gesturestart', onGesture);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('keydown', onKey);

  dev.expose?.(run, () => renderer.draw(alpha), () => ({ x: renderer.screenX(run.player.x), y: renderer.screenY(run.player.y), zoom: renderer.zoom() }));
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
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      // Leave history as it was: step back off the run's own entry if it is still the current one.
      if (onRunEntry()) history.back();
      if (themeMeta && themeWas !== null) themeMeta.setAttribute('content', themeWas);
      else themeOwn.remove();
      window.clearTimeout(quitTimer);
      audio.setBed(null);
      pauseSound?.dispose();
      input.destroy();
      hud.destroy();
      bench.destroy();
      endScreen?.destroy();
      root.remove();
    },
  };
}
