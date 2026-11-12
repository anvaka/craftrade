// The outing on screen: the loop, a thin HUD, the camps and the sheet at the end.
// A prototype of the gathering game: it uses the run's renderer, input and
// sound, pays into a store on this device, and never talks to the town.
import '../ui/theme.css';
import '../game/game.css';
import './outing.css';
import { bakeAll, capDpr, type Sprites } from '../art/index.ts';
import { audio } from '../audio/index.ts';
import { bedLevel } from '../audio/music.ts';
import type { CharacterId } from '../../shared/protocol.ts';
import {
  DT, MATERIALS, OUTING, SKILL_NAME, STAGE_NAME, bagCount, bagUsed, clearEvents, createOuting, haul, leaveOuting, matIndex, nodeLocked,
  skillLevel, skillProgress, step, type Haul, type Run,
} from '../../sim/index.ts';
import { clock, el, loadShake, stamp } from '../game/dom.ts';
import { soundControls } from '../game/hud.ts';
import { createInput } from '../game/input.ts';
import { createRenderer } from '../game/render.ts';
import { createRunSound } from '../game/sound.ts';
import { bankHaul, loadOuting } from './store.ts';

export interface OutingHost {
  root: HTMLElement;
  sprites: Sprites;
  character: CharacterId;
  /** Fixed seed, for tests. A real outing reshuffles. */
  seed?: number;
  /** Back to town. */
  onDone(): void;
}
export interface OutingHandle { destroy(): void }

const MAX_STEPS = 5;
const INK = '#1B2226', BONE = '#D9D3BD', OCHRE = '#D99A2B', MADDER = '#B8402E';
const STAGE_SAY: readonly [string, string][] = [
  ['', ''],
  ['The woods are stirring', 'Small packs will find you now.'],
  ['You are being hunted', 'They come faster. Think about a camp.'],
  ['The woods are awake', 'Get to a camp.'],
];
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function meter(cls: string): { el: HTMLElement; name: HTMLElement; val: HTMLElement; fill: HTMLElement; bar: HTMLElement } {
  const name = el('b'), val = el('span'), fill = el('i'), bar = el('div', 'o-bar', fill);
  return { el: el('div', `o-meter ${cls}`, el('div', 'lab', name, val), bar), name, val, fill, bar };
}

export function mountOuting(host: OutingHost): OutingHandle {
  const saved = loadOuting();
  const seed = host.seed ?? ((Math.random() * 0xffffffff) >>> 0);
  const run: Run = createOuting({ seed, character: host.character, xp: saved.xp });
  const o = run.outing!;

  let sprites = host.sprites;
  const root = el('div', 'g-root');
  if (host.root.clientHeight < 60) root.classList.add('g-root--fixed');
  const canvas = el('canvas', 'g-canvas');
  canvas.setAttribute('aria-label', 'The home wood');
  const stage = el('div', 'g-stage', canvas);
  root.append(stage);
  host.root.append(root);

  const renderer = createRenderer(canvas, sprites, run);
  renderer.shake = loadShake();
  renderer.reduced = reducedMotion();
  const sound = createRunSound(run);
  const input = createInput(stage);
  const moveIn = { mx: 0, my: 0 };

  // ---- the ground: camps under, skill gates over ---------------------------------
  renderer.under = (ctx, x0, y0, x1, y1) => {
    const R = OUTING.campR;
    for (let i = 0; i < o.campCount; i++) {
      const x = o.camps[i * 2], y = o.camps[i * 2 + 1];
      if (x < x0 - R || x > x1 + R || y < y0 - R || y > y1 + R) continue;
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = o.inCamp === i ? OCHRE : INK;
      ctx.setLineDash([14, 10]);
      ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.92, 0, 0, 6.2832); ctx.stroke();
      ctx.setLineDash([]);
      // A tent: the one shape on the ground that means safe.
      ctx.fillStyle = BONE; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.moveTo(x - 34, y - 26); ctx.lineTo(x, y - 76); ctx.lineTo(x + 34, y - 26); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.moveTo(x - 9, y - 26); ctx.lineTo(x, y - 52); ctx.lineTo(x + 9, y - 26); ctx.closePath(); ctx.fill();
      ctx.fillStyle = OCHRE;
      ctx.beginPath(); ctx.moveTo(x, y - 76); ctx.lineTo(x + 18, y - 84); ctx.lineTo(x, y - 92); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  };
  renderer.over = (ctx, x0, y0, x1, y1) => {
    const z = renderer.zoom();
    ctx.save();
    ctx.font = `700 ${13 / z}px "Zilla Slab", serif`;
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4 / z;
    for (const n of run.nodes) {
      if (!n.alive || n.tier < 2 || n.x < x0 || n.x > x1 || n.y < y0 || n.y > y1 + 120) continue;
      if (!nodeLocked(run, n.type, n.tier)) continue;
      const text = `${SKILL_NAME[n.type]} ${OUTING.tier2Level}`;
      ctx.strokeStyle = BONE; ctx.fillStyle = MADDER;
      ctx.strokeText(text, n.x, n.y + 22 / z);
      ctx.fillText(text, n.x, n.y + 22 / z);
    }
    ctx.restore();
  };

  // ---- HUD ---------------------------------------------------------------------------
  const hp = meter('o-hp'), threat = meter('o-threat'), bag = meter('o-bag');
  hp.name.textContent = 'Health';
  bag.name.textContent = 'Bag';
  for (const at of OUTING.stages) {
    const tick = el('s');
    tick.style.left = `${at * 100}%`;
    threat.bar.append(tick);
  }
  const pauseBtn = stamp('Pause', 'stamp--plain stamp--small');
  pauseBtn.addEventListener('click', () => setPaused(true));
  const top = el('div', 'o-top', hp.el, threat.el, bag.el, pauseBtn);
  const note = el('div', 'o-note');
  note.hidden = true;
  note.setAttribute('role', 'status');
  const skills = SKILL_NAME.map((name) => {
    const lv = el('span'), fill = el('i');
    const box = el('div', 'o-skill', el('div', 'n', el('span', '', name), lv), el('div', 'o-bar', fill));
    return { box, lv, fill };
  });
  const arrow = el('i', '', '➤'), far = el('span');
  const compass = el('div', 'o-compass', el('span', '', 'Camp'), arrow, far);
  const leave = stamp('Walk out', 'o-leave');
  leave.hidden = true;
  leave.addEventListener('click', () => { if (leaveOuting(run, 'camp')) audio.play('paid'); });
  const toasts = el('div', 'o-toasts');
  const foot = el('div', 'o-foot', el('div', 'o-skills', ...skills.map((s) => s.box)), el('div', 'o-way', compass, leave));
  const hud = el('div', 'o-hud', top, note, toasts, foot);
  stage.append(hud);

  let noteT = 0;
  function say(title: string, sub: string, bad: boolean, seconds: number): void {
    note.replaceChildren(el('b', '', title), ...(sub ? [el('span', '', sub)] : []));
    note.classList.toggle('is-bad', bad);
    note.hidden = false;
    noteT = seconds;
  }
  function toast(text: string): void {
    const t = el('div', 'o-toast', text);
    toasts.append(t);
    while (toasts.childElementCount > 4) toasts.firstElementChild!.remove();
    window.setTimeout(() => t.remove(), 1650);
  }
  const skillUp = new Float64Array(SKILL_NAME.length);

  function hudUpdate(dt: number): void {
    const p = run.player;
    hp.val.textContent = `${Math.max(0, Math.ceil(p.hp))}/${Math.round(p.maxHp)}`;
    hp.fill.style.width = `${Math.max(0, Math.min(100, (p.hp / Math.max(1, p.maxHp)) * 100))}%`;
    threat.name.textContent = STAGE_NAME[o.stage];
    threat.val.textContent = clock(o.time);
    threat.fill.style.width = `${Math.min(100, o.threat * 100)}%`;
    threat.el.className = `o-meter o-threat is-${o.stage}`;
    const used = bagUsed(o);
    bag.val.textContent = `${bagCount(o)} · ${used}/${o.bagSlots}`;
    bag.fill.style.width = `${Math.min(100, (used / o.bagSlots) * 100)}%`;
    bag.el.classList.toggle('is-full', used >= o.bagSlots);
    for (let i = 0; i < skills.length; i++) {
      skills[i].lv.textContent = String(skillLevel(o.xp[i]));
      skills[i].fill.style.width = `${skillProgress(o.xp[i]) * 100}%`;
      if (skillUp[i] > 0) { skillUp[i] -= dt; skills[i].box.classList.toggle('is-up', skillUp[i] > 0); }
    }
    // The way home: the nearest camp, as a heading and a distance in paces.
    let best = 1e18, bx = 0, by = 0;
    for (let i = 0; i < o.campCount; i++) {
      const dx = o.camps[i * 2] - p.x, dy = o.camps[i * 2 + 1] - p.y, d = dx * dx + dy * dy;
      if (d < best) { best = d; bx = dx; by = dy; }
    }
    const inCamp = o.inCamp >= 0;
    compass.hidden = inCamp;
    if (!inCamp) {
      arrow.style.transform = `rotate(${Math.atan2(by, bx)}rad)`;
      far.textContent = `${Math.max(1, Math.round(Math.sqrt(best) / 40))} paces`;
    }
    const canLeave = inCamp && (bagCount(o) > 0 || o.time > 20);
    if (leave.hidden === canLeave) {
      leave.hidden = !canLeave;
      leave.textContent = bagCount(o) > 0 ? 'Walk out, keep it all' : 'Walk out';
    }
    if (noteT > 0) { noteT -= dt; if (noteT <= 0) note.hidden = true; }
  }

  // ---- state -------------------------------------------------------------------------
  type State = 'out' | 'beat' | 'end';
  let state: State = 'out';
  let alive = true, paused = false;
  let raf = 0, last = performance.now(), acc = 0, alpha = 1, freezeT = 0, beatT = 0, insetT = 0;
  let sheet: HTMLElement | null = null;
  let pauseSound: { el: HTMLElement; dispose(): void } | null = null;

  function setPaused(on: boolean): void {
    if (state !== 'out' || paused === on) return;
    paused = on;
    input.reset();
    pauseSound?.dispose(); pauseSound = null;
    sheet?.remove(); sheet = null;
    if (!on) { last = performance.now(); return; }
    const resume = stamp('Back to it');
    resume.addEventListener('click', () => setPaused(false));
    const recall = stamp(`Recall, keep ${Math.round(OUTING.keep.recall * 100)}%`, 'stamp--plain');
    let armed = 0;
    recall.addEventListener('click', () => {
      const now = performance.now();
      if (now - armed > 4000 || now - armed < 450) { armed = now; recall.textContent = 'Tap again to recall'; return; }
      paused = false; sheet?.remove(); sheet = null;
      leaveOuting(run, 'recall');
      last = performance.now();
    });
    pauseSound = soundControls();
    sheet = el('div', 'o-sheet g-overlay', el('div', 'o-panel',
      el('h2', '', 'Paused'),
      el('p', 'sub', `Walking out at a camp keeps everything. A recall from here keeps ${Math.round(OUTING.keep.recall * 100)}%; a fall keeps ${Math.round(OUTING.keep.dead * 100)}%.`),
      pauseSound.el,
      el('div', 'acts', resume, recall)));
    hud.append(sheet);
    resume.focus();
  }

  function showEnd(h: Haul): void {
    state = 'end';
    audio.setBed(null);
    const store = bankHaul(h);
    const title = h.result === 'camp' ? 'Home with everything' : h.result === 'recall' ? `Recalled: ${Math.round(h.share * 100)}% kept` : `Down: ${Math.round(h.share * 100)}% kept`;
    const rows = MATERIALS.map((m, i) => h.carried[i] > 0 || store.store[i] > 0
      ? el('tr', '', el('td', '', m.name), el('td', '', String(h.kept[i])), el('td', 'lost', h.carried[i] > h.kept[i] ? `-${h.carried[i] - h.kept[i]}` : ''), el('td', '', String(store.store[i])))
      : null);
    const total = h.kept.reduce((a, b) => a + b, 0);
    const sk = SKILL_NAME.map((name, i) => {
      const fill = el('i');
      fill.style.width = `${skillProgress(h.xp[i]) * 100}%`;
      return el('div', 'skrow', el('span', '', `${name} ${skillLevel(h.xp[i])}`), el('div', 'o-bar', fill), el('span', 'g', h.gained[i] > 0 ? `+${Math.round(h.gained[i])}` : ''));
    });
    const again = stamp('Go out again');
    again.addEventListener('click', () => { const hst = host; self.destroy(); mountOuting({ ...hst, seed: undefined }); });
    const back = stamp('Back to town', 'stamp--plain');
    back.addEventListener('click', () => { self.destroy(); host.onDone(); });
    sheet = el('div', 'o-sheet g-overlay', el('div', 'o-panel',
      el('h2', '', title),
      el('p', 'sub', `${clock(h.seconds)} out · ${h.broken.reduce((a, b) => a + b, 0)} nodes · ${h.kills} kills · ${total} brought home`),
      el('table', '', el('tr', '', el('th', '', 'Material'), el('th', '', 'Kept'), el('th', '', ''), el('th', '', 'In store')), ...rows),
      el('h3', '', 'Skills'), ...sk,
      el('div', 'acts', again, back),
      el('p', 'fine', 'A first look at the gathering game. The store is kept on this device and the town does not use it yet.')));
    hud.append(sheet);
    top.hidden = true; foot.hidden = true; note.hidden = true;
    audio.play(h.result === 'dead' ? 'death' : 'win');
    again.focus();
  }

  function drain(): void {
    const q = run.events, vw = renderer.viewW();
    for (let i = 0; i < q.n; i++) {
      const ev = q.list[i];
      renderer.event(ev);
      sound.event(ev, renderer.screenX(ev.x), vw);
      switch (ev.type) {
        case 'skill': {
          toast(`+${ev.b} ${SKILL_NAME[ev.a]}`);
          if (ev.c > 0) {
            skillUp[ev.a] = 2.5;
            audio.play('levelUp');
            say(`${SKILL_NAME[ev.a]} ${ev.c}`, ev.c === OUTING.tier2Level ? `You can now work ${MATERIALS[matIndex(ev.a, 2)].name.toLowerCase()}.` : '', false, 3.2);
          }
          break;
        }
        case 'stage':
          if (ev.a > 0) { say(STAGE_SAY[ev.a][0], STAGE_SAY[ev.a][1], ev.a >= 2, 4.5); audio.play(ev.a === 3 ? 'boss' : ev.a === 2 ? 'elite' : 'telegraph'); }
          break;
        case 'full': say('Bag full', 'A camp keeps all of it.', false, 2.6); break;
        case 'locked': say(`Needs ${SKILL_NAME[ev.a]} ${ev.b}`, `Work the common kind to get there.`, false, 2.4); break;
        default: break;
      }
    }
    clearEvents(run);
  }

  function syncInsets(): void {
    const r = stage.getBoundingClientRect();
    renderer.setInsets(top.getBoundingClientRect().height, 0, Math.min(90, r.height * 0.2), 0);
  }

  function frame(now: number): void {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.25) dt = 0.25;
    if (paused || state === 'end') return;
    if (state === 'out') {
      audio.setBed(bedLevel(1 + o.stage * 3, 12, o.stage === 3));
      insetT -= dt;
      if (insetT <= 0) { insetT = 0.5; syncInsets(); }
      if (freezeT > 0) freezeT -= dt;
      else {
        acc += dt;
        let steps = 0;
        while (acc >= DT && steps < MAX_STEPS) {
          input.read(moveIn);
          step(run, moveIn);
          steps++; acc -= DT;
          drain();
          if (run.phase !== 'wave') { acc = 0; break; }
          const f = renderer.takeFreeze();
          if (f > 0) { freezeT = f; if (acc > DT) acc = DT; break; }
        }
        if (acc >= DT) acc = 0;
        alpha = run.phase === 'wave' ? acc / DT : 1;
        renderer.update(dt);
      }
      hudUpdate(dt);
      if (run.phase === 'over') {
        state = 'beat';
        beatT = o.result === 'dead' ? 1.4 : 0.5;
        input.reset();
        if (o.result === 'dead') say('Down', renderer.lastHurtBy() ? `${renderer.lastHurtBy()} got you.` : '', true, 2);
      }
    } else {
      renderer.takeFreeze();
      renderer.update(dt);
      beatT -= dt;
      if (beatT <= 0) showEnd(haul(run));
    }
    renderer.draw(alpha);
  }

  let world: Sprites = sprites;
  function fit(): void {
    if (!alive) return;
    const full = capDpr(window.devicePixelRatio || 1);
    if (full !== sprites.dpr) sprites = bakeAll(full);
    const r = stage.getBoundingClientRect();
    renderer.resize(r.width, r.height, full);
    const want = capDpr(full * renderer.zoom());
    if (want !== world.dpr) { world = want === sprites.dpr ? sprites : bakeAll(want); renderer.setSprites(world); }
    syncInsets();
    if (state !== 'end') renderer.draw(alpha);
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  ro?.observe(stage);
  window.addEventListener('resize', fit);
  const onBlur = (): void => setPaused(true);
  const onVis = (): void => { if (document.hidden) setPaused(true); else last = performance.now(); };
  const onKey = (e: KeyboardEvent): void => {
    if (e.code !== 'Escape' || e.repeat) return;
    e.preventDefault();
    setPaused(!paused);
  };
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('keydown', onKey);

  const self: OutingHandle = {
    destroy() {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('keydown', onKey);
      audio.setBed(null);
      pauseSound?.dispose();
      input.destroy();
      root.remove();
    },
  };

  fit();
  if (saved.outings < 3) say('The home wood', 'Stand in a ring to gather. The meter fills with time and noise. Walk out at a camp to keep it all.', false, 9);
  raf = requestAnimationFrame(frame);
  // For tests and the console.
  (window as unknown as { __outing?: unknown }).__outing = { run, leave: (how: 'camp' | 'recall') => leaveOuting(run, how) };
  return self;
}
