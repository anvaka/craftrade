// Helpers for scripts/e2e.mjs: drive the built game in headless Chrome with real key, mouse and touch events.
// The game state is only READ (through the DevTools heap query), never written, so every action goes through real input.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

export const QA = process.env.QA_DIR || '/private/tmp/claude-501/-Users-anvaka-projects-experiments-craft-world/cbdcad11-c04f-4d56-940f-5fb6841a2f68/scratchpad/qa';
export const URL0 = process.env.QA_URL || 'http://localhost:4181/';
export const SAVE_KEY = 'craftworld.save.v2';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Session {
  constructor(name) {
    this.name = name;
    this.dir = path.join(QA, name);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.logFile = path.join(this.dir, 'log.txt');
    this.problems = []; // console errors, page errors, failed requests
    this.findings = []; // things the script itself judged wrong
    this.shotN = 0;
    this.t0 = Date.now();
  }
  log(...a) {
    const line = `[${((Date.now() - this.t0) / 1000).toFixed(1)}s] ${a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}`;
    console.log(`${this.name} ${line}`);
    fs.appendFileSync(this.logFile, line + '\n');
  }
  finding(text) {
    this.findings.push(text);
    this.log('FINDING: ' + text);
  }
  check(cond, text) {
    if (cond) this.log('ok: ' + text);
    else this.finding('CHECK FAILED: ' + text);
    return !!cond;
  }

  async launch({ width = 1280, height = 900, touch = false, dsf = 1, mobile = false } = {}) {
    const profile = path.join(this.dir, 'profile');
    this.browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      userDataDir: profile,
      args: ['--mute-audio', '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `--window-size=${width},${height}`],
      defaultViewport: { width, height, deviceScaleFactor: dsf, hasTouch: touch, isMobile: mobile },
    });
    this.page = (await this.browser.pages())[0] ?? (await this.browser.newPage());
    await this.hook(this.page);
    return this.page;
  }
  async hook(page) {
    await page.evaluateOnNewDocument(() => {
      addEventListener('unhandledrejection', (e) => console.error('UNHANDLED REJECTION: ' + (e.reason && e.reason.stack ? e.reason.stack : e.reason)));
      addEventListener('error', (e) => console.error('WINDOW ERROR: ' + e.message + ' @' + e.filename + ':' + e.lineno));
    });
    page.on('console', (m) => {
      const t = m.type();
      if (t === 'error' || t === 'warn' || t === 'assert') {
        this.problems.push(`console.${t}: ${m.text()}`);
        this.log(`CONSOLE ${t}: ${m.text()}`);
      }
    });
    page.on('pageerror', (e) => {
      this.problems.push(`pageerror: ${e.stack || e.message || e}`);
      this.log(`PAGEERROR: ${e.stack || e.message || e}`);
    });
    page.on('requestfailed', (r) => {
      this.problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
      this.log(`REQUESTFAILED: ${r.url()} ${r.failure()?.errorText}`);
    });
    page.on('response', (r) => {
      if (r.status() >= 400) {
        this.problems.push(`http ${r.status()}: ${r.url()}`);
        this.log(`HTTP ${r.status()}: ${r.url()}`);
      }
    });
    page.on('dialog', async (d) => {
      this.log(`DIALOG ${d.type()}: ${d.message()}`);
      await d.accept();
    });
  }
  async goto(query = '') {
    await this.page.goto(URL0 + query, { waitUntil: 'load' });
    await sleep(300);
  }
  async shot(label) {
    const f = path.join(this.dir, `${String(++this.shotN).padStart(2, '0')}-${label}.png`);
    await this.page.screenshot({ path: f });
    this.log(`shot ${f}`);
    return f;
  }
  async close() {
    fs.writeFileSync(path.join(this.dir, 'problems.json'), JSON.stringify({ problems: this.problems, findings: this.findings }, null, 2));
    this.log(`DONE. console/page problems: ${this.problems.length}; findings: ${this.findings.length}`);
    await this.browser?.close();
  }

  // ------------------------------------------------------------ DOM screens
  save() {
    return this.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
  }
  /** What the overlay shows right now. */
  screen() {
    return this.page.evaluate(() => {
      const o = document.getElementById('overlay');
      if (!o || o.hidden) return { hidden: true, h1: '', text: '' };
      return { hidden: false, h1: o.querySelector('h1')?.textContent ?? '', text: o.innerText, note: o.querySelector('.note')?.textContent ?? '' };
    });
  }
  async waitScreen(pred, timeout = 15000, what = 'screen') {
    const t0 = Date.now();
    for (;;) {
      const s = await this.screen();
      if (pred(s)) return s;
      if (Date.now() - t0 > timeout) {
        await this.shot('timeout-' + what.replace(/\W+/g, '-'));
        throw new Error(`timeout waiting for ${what}; overlay hidden=${s.hidden} h1="${s.h1}"`);
      }
      await sleep(100);
    }
  }
  sel(a, v) {
    return v === undefined ? `#overlay [data-a="${a}"]` : `#overlay [data-a="${a}"][data-v="${v}"]`;
  }
  async has(a, v) {
    return (await this.page.$(this.sel(a, v))) !== null;
  }
  /** Info on a button: exists, disabled, and whether its centre is really hit-testable after scrolling it into view. */
  async probe(selector) {
    return this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { exists: false };
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return {
        exists: true, disabled: !!el.disabled, text: el.textContent.trim().slice(0, 80), x: cx, y: cy, w: r.width, h: r.height,
        hit: top === el || el.contains(top), coveredBy: top && !(top === el || el.contains(top)) ? top.tagName + '.' + top.className : null,
        inView: cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight,
      };
    }, selector);
  }
  /** A real click (or tap) at the centre of a data-a button. Returns false if it is absent or disabled. */
  async click(a, v, { tap = false, quiet = false } = {}) {
    // the tally now asks for a level-up pick before it can be dismissed: take the first offer each time
    if (a === 'tallyok') {
      for (let i = 0; i < 12; i++) {
        const lp = await this.probe('[data-a="levelpick"]');
        if (!lp.exists) break;
        if (tap) await this.page.touchscreen.tap(lp.x, lp.y);
        else await this.page.mouse.click(lp.x, lp.y);
        await sleep(90);
      }
    }
    // the camp no longer preselects a ground: choose the first one before starting the wave, unless one is chosen
    if (a === 'go') {
      const rp = await this.probe('#overlay [data-a="route"][data-v="0"]');
      const chosen = await this.page.evaluate(() => !!document.querySelector('#overlay [data-a="route"].on, #overlay [data-a="route"][aria-pressed="true"]'));
      if (rp.exists && !chosen) {
        if (tap) await this.page.touchscreen.tap(rp.x, rp.y);
        else await this.page.mouse.click(rp.x, rp.y);
        await sleep(120);
      }
    }
    const selector = a.startsWith('#') || a.startsWith('.') || a.includes('[') ? a : this.sel(a, v);
    const pr = await this.probe(selector);
    if (!pr.exists) {
      if (!quiet) this.log(`click ${selector}: NOT FOUND`);
      return false;
    }
    if (pr.disabled) {
      if (!quiet) this.log(`click ${selector}: disabled ("${pr.text}")`);
      return false;
    }
    if (!pr.hit || !pr.inView) this.finding(`button ${selector} ("${pr.text}") cannot be hit at its centre: inView=${pr.inView} coveredBy=${pr.coveredBy}`);
    if (tap) await this.page.touchscreen.tap(pr.x, pr.y);
    else await this.page.mouse.click(pr.x, pr.y);
    await sleep(60);
    if (!quiet) this.log(`click ${selector} ("${pr.text}")`);
    return true;
  }

  // ----------------------------------------------------------- arena state
  /** Locate the live Game, Renderer and InputMgr instances in the page heap (read only). */
  async attach(timeout = 8000) {
    const t0 = Date.now();
    for (;;) {
      const proto = await this.page.evaluateHandle(() => Object.prototype);
      const all = await this.page.queryObjects(proto);
      const ok = await this.page.evaluate((arr) => {
        let game = null;
        let ren = null;
        let inp = null;
        for (const o of arr) {
          try {
            if (!o || typeof o !== 'object') continue;
            if (o.spec && o.nodes && o.enemies && o.res && o.p) {
              if (o.phase === 'wave' && (!game || o.spec.index >= game.spec.index)) game = o;
            } else if ('camX' in o && 'hud' in o) ren = o;
            else if ('touchMode' in o && 'joy' in o) inp = o;
          } catch { /* exotic object */ }
        }
        window.__qa = { game, ren, inp };
        return !!(game && ren && inp);
      }, all);
      await all.dispose();
      await proto.dispose();
      if (ok) return true;
      if (Date.now() - t0 > timeout) return false;
      await sleep(200);
    }
  }
  state() {
    return this.page.evaluate(() => {
      const q = window.__qa;
      if (!q || !q.game) return null;
      const g = q.game;
      const r = q.ren;
      const p = g.p;
      return {
        phase: g.phase, waveT: g.waveT, dur: g.spec.dur, beat: g.beat, heat: g.heat, index: g.spec.index, weight: g.weight,
        objective: g.res.objective, objectiveText: g.objectiveText, sealed: g.spec.sealed, armor: g.m.armor, ward: g.m.ward, supplyT: g.supplyT, specObjective: g.spec.objective, elite: g.spec.elite ? g.spec.elite.id : null, scrap: g.res.scrap,
        feat: g.spec.feat, abilities: g.spec.abilities, abilityIdx: g.abilityIdx, noDodge: g.spec.noDodge,
        p: { x: p.x, y: p.y, hp: p.hp, stamina: p.stamina, charging: p.charging, charge: p.charge, abilityCd: p.abilityCd, dodgeT: p.dodgeT, iframes: p.iframes, ax: p.ax, ay: p.ay, swingT: p.swingT },
        nodes: g.nodes.map((n) => ({ x: n.x, y: n.y, r: n.r, kind: n.kind, rich: n.rich, open: n.open, alive: n.alive, stage: n.stage, stages: n.stages })),
        enemies: g.enemies.map((e) => ({ x: e.x, y: e.y, r: e.r, kind: e.kind, shield: e.shield, boss: !!e.boss, elite: !!e.elite, state: e.state, hp: e.hp, maxHp: e.maxHp, tele: e.tele, dash: e.dash })),
        shots: g.shots.filter((s) => s.hostile).map((s) => ({ x: s.x, y: s.y, vx: s.vx, vy: s.vy })),
        zones: g.zones.map((z) => ({ x: z.x, y: z.y, r: z.r, kind: z.kind })),
        pickups: g.pickups.length, gathered: { ...g.res.gathered }, kills: g.res.kills, dmgTaken: g.res.dmgTaken, gatherTime: g.res.gatherTime, heatPeak: g.res.heatPeak,
        cam: { x: r.camX, y: r.camY, scale: r.scale, w: r.w, h: r.h },
        input: { touchMode: q.inp.touchMode, joy: !!q.inp.joy, aim: !!q.inp.aim, mouseDown: q.inp.mouseDown, keys: [...q.inp.keys] },
        overlayHidden: document.getElementById('overlay').hidden,
      };
    });
  }
}

export const toScreen = (s, x, y) => [(x - s.cam.x) * s.cam.scale + s.cam.w / 2, (y - s.cam.y) * s.cam.scale + s.cam.h / 2];
const ARENA = { w: 1500, h: 950 };
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

/** Holds a set of keys down with real keydown/keyup events. */
export class Keys {
  constructor(page) {
    this.page = page;
    this.down = new Set();
  }
  async set(want) {
    for (const k of [...this.down]) if (!want.includes(k)) {
      await this.page.keyboard.up(k);
      this.down.delete(k);
    }
    for (const k of want) if (!this.down.has(k)) {
      await this.page.keyboard.down(k);
      this.down.add(k);
    }
  }
  async move(dx, dy) {
    const want = [];
    const l = Math.hypot(dx, dy);
    if (l > 0.01) {
      const a = Math.atan2(dy, dx);
      const oct = Math.round(a / (Math.PI / 4));
      const c = Math.round(Math.cos(oct * Math.PI / 4));
      const s = Math.round(Math.sin(oct * Math.PI / 4));
      if (c > 0) want.push('KeyD');
      if (c < 0) want.push('KeyA');
      if (s > 0) want.push('KeyS');
      if (s < 0) want.push('KeyW');
    }
    await this.set(want);
  }
  async release() {
    await this.set([]);
  }
}

/**
 * Plays one wave with keyboard and mouse. Returns a log of what it did and saw.
 * opts.gather: mine nodes; opts.suicide: stand still holding a charge (weapons stop firing) to exercise death;
 * opts.maxHeat: stop mining above this heat; opts.onTick(state, ctx): hook for scenario-specific probes.
 */
export async function playWaveDesktop(S, opts = {}) {
  const page = S.page;
  const keys = new Keys(page);
  const out = { swings: 0, nodeSwings: 0, dodges: 0, abilities: 0, ticks: 0, died: false, last: null, first: null, maxEnemies: 0, minHp: 1e9, gatheredSeen: 0, events: [] };
  if (!(await S.attach())) throw new Error('could not find the live game in the page');
  const t0 = Date.now();
  let lastDodge = 0;
  const lap = {};
  let lastAbility = 0;
  let shotMid = false;
  for (;;) {
    const s = await S.state();
    if (!s) break;
    out.ticks++;
    out.last = s;
    out.first ??= s;
    if (s.phase === 'over') break;
    if (!s.overlayHidden) {
      // paused by something; the caller's hook may handle it, else resume
      if (opts.onOverlay) await opts.onOverlay(s);
      else await S.click('resume', undefined, { quiet: true });
      await sleep(100);
      continue;
    }
    out.maxEnemies = Math.max(out.maxEnemies, s.enemies.length);
    out.minHp = Math.min(out.minHp, s.p.hp);
    out.gatheredSeen = sum(s.gathered);
    if (opts.onTick && (await opts.onTick(s, { keys, out })) === 'skip') continue;
    if (!shotMid && opts.shotAt !== undefined && s.waveT >= opts.shotAt) {
      shotMid = true;
      await S.shot(opts.shotName ?? `wave${s.index + 1}-mid`);
    }
    if (Date.now() - t0 > (s.dur + 30) * 1000) {
      S.finding(`wave ${s.index + 1} did not end ${s.dur + 30}s after it began (waveT=${s.waveT.toFixed(1)})`);
      break;
    }
    const p = s.p;

    if (opts.suicide) {
      // walk into the thickest group and hold a charge so nothing fires
      const near = s.enemies.filter((e) => e.state !== 'under').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (near) await keys.move(near.x - p.x, near.y - p.y);
      if (!s.input.mouseDown) {
        await page.mouse.move(s.cam.w / 2 + 50, s.cam.h / 2);
        await page.mouse.down();
      } else if (!p.charging) {
        // released by the game (no stamina); re-press
        await page.mouse.up();
      }
      await sleep(90);
      continue;
    }

    const live = s.enemies.filter((e) => e.state !== 'under');
    const dist = (e) => Math.hypot(e.x - p.x, e.y - p.y) - e.r;
    const nearest = live.slice().sort((a, b) => dist(a) - dist(b))[0];
    const nearD = nearest ? dist(nearest) : 1e9;
    const crowd = live.filter((e) => dist(e) < 170).length;

    // repulsion from enemies, hostile shots and walls
    let rx = 0;
    let ry = 0;
    for (const e of live) {
      const d = Math.max(20, dist(e));
      if (d > 330) continue;
      const w = (e.boss ? 3 : e.kind === 'brute' ? 2 : 1) * (1 / (d * d));
      rx += ((p.x - e.x) / d) * w * 9000;
      ry += ((p.y - e.y) / d) * w * 9000;
    }
    for (const sh of s.shots) {
      const d = Math.hypot(sh.x - p.x, sh.y - p.y);
      if (d < 160) {
        // step sideways off the line
        const l = Math.hypot(sh.vx, sh.vy) || 1;
        rx += (-sh.vy / l) * 1.2;
        ry += (sh.vx / l) * 1.2;
      }
    }
    const wall = 130;
    if (p.x < wall) rx += (wall - p.x) / 40;
    if (p.x > ARENA.w - wall) rx -= (p.x - (ARENA.w - wall)) / 40;
    if (p.y < wall) ry += (wall - p.y) / 40;
    if (p.y > ARENA.h - wall) ry -= (p.y - (ARENA.h - wall)) / 40;
    // run laps on an ellipse round the centre; turn round when the way ahead is thicker than the way behind
    const RX = 470;
    const RY = 265;
    const ang = Math.atan2((p.y - ARENA.h / 2) / RY, (p.x - ARENA.w / 2) / RX);
    const ahead = (sgn) => {
      const a = ang + sgn * 0.7;
      const tx = ARENA.w / 2 + RX * Math.cos(a);
      const ty = ARENA.h / 2 + RY * Math.sin(a);
      return live.filter((e) => Math.hypot(e.x - tx, e.y - ty) < 190).reduce((n, e) => n + (e.boss ? 4 : e.kind === 'brute' ? 2 : 1), 0);
    };
    lap.dir ??= 1;
    if (ahead(lap.dir) > ahead(-lap.dir) + 1 && Date.now() - (lap.flip ?? 0) > 1200) {
      lap.dir = -lap.dir;
      lap.flip = Date.now();
    }
    const la = ang + lap.dir * 0.5;
    const ox = ARENA.w / 2 + RX * Math.cos(la) - p.x;
    const oy = ARENA.h / 2 + RY * Math.sin(la) - p.y;
    const ol = Math.hypot(ox, oy) || 1;
    const orbit = [(ox / ol) * 1.1, (oy / ol) * 1.1];

    const swingAt = async (tx, ty, isNode) => {
      await keys.release();
      const [sx, sy] = toScreen(s, tx, ty);
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      const t1 = Date.now();
      let charged = false;
      while (Date.now() - t1 < 1100) {
        const z = await S.state();
        if (!z || z.phase === 'over') break;
        if (z.p.charge >= 1) {
          charged = true;
          break;
        }
        if (!z.p.charging && Date.now() - t1 > 250) break; // refused (no stamina) or knocked out of it
        await sleep(30);
      }
      const before = await S.state();
      await page.mouse.up();
      await sleep(80);
      const after = await S.state();
      out.swings++;
      if (isNode) out.nodeSwings++;
      out.events.push({ t: s.waveT.toFixed(1), swing: isNode ? 'node' : 'enemy', charged, stam: [Math.round(before?.p.stamina ?? -1), Math.round(after?.p.stamina ?? -1)] });
      return charged;
    };

    // dodge when touched, or when a shot is about to land
    const incoming = s.shots.some((sh) => Math.hypot(sh.x - p.x, sh.y - p.y) < 60 && (p.x - sh.x) * sh.vx + (p.y - sh.y) * sh.vy > 0);
    if (s.feat.dodge && !s.noDodge && (nearD < 18 || incoming) && p.stamina >= (incoming ? 30 : 62) && Date.now() - lastDodge > 900 && opts.dodge !== false) {
      await keys.move(rx + orbit[0], ry + orbit[1]);
      await page.keyboard.press('Space');
      lastDodge = Date.now();
      out.dodges++;
      await sleep(60);
      continue;
    }
    // ability on a crowd
    if (s.feat.ability && s.abilities.length && p.abilityCd <= 0 && crowd >= 3 && Date.now() - lastAbility > 500 && opts.ability !== false) {
      if (nearest) {
        const [sx, sy] = toScreen(s, nearest.x, nearest.y);
        await page.mouse.move(sx, sy);
      }
      if (out.abilities % 2 === 0) await page.keyboard.press('KeyE');
      else await page.mouse.click(...toScreen(s, nearest.x, nearest.y), { button: 'right' });
      out.abilities++;
      lastAbility = Date.now();
    }

    // armoured things need the heavy swing
    const armoured = live.filter((e) => e.shield && dist(e) < 420).sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || dist(a) - dist(b))[0];
    if (armoured && p.stamina >= 36 && opts.breakShields !== false) {
      const d = dist(armoured);
      if (d < 70) {
        await swingAt(armoured.x, armoured.y, false);
        continue;
      }
      if (crowd < (armoured.boss ? 6 : 3) && (armoured.boss || d < 220)) {
        await keys.move(armoured.x - p.x + rx * 0.3, armoured.y - p.y + ry * 0.3);
        await sleep(70);
        continue;
      }
    }

    // mining
    const wantGather = opts.gather !== false && p.hp > (opts.gatherMinHp ?? 35);
    const wantNodes = s.heat <= (opts.maxHeat ?? 70) && s.weight <= (opts.maxWeight ?? 1e9);
    if (wantGather) {
      const nodes = wantNodes ? s.nodes.filter((n) => n.alive && n.open && n.kind !== 'nest') : [];
      const nests = s.nodes.filter((n) => n.alive && n.open && n.kind === 'nest');
      const nd = (n) => Math.hypot(n.x - p.x, n.y - p.y) - n.r;
      const target = [...nests, ...nodes.filter((n) => n.rich), ...nodes.filter((n) => !n.rich)].sort((a, b) => (a.kind === 'nest' ? -1000 : 0) + (a.rich ? -200 : 0) + nd(a) - ((b.kind === 'nest' ? -1000 : 0) + (b.rich ? -200 : 0) + nd(b)))[0];
      if (target && crowd < (opts.gatherCrowd ?? 5)) {
        const d = nd(target);
        if (d < 62) {
          if (p.stamina >= 36) {
            const before = sum(s.gathered) + s.pickups;
            const stage = target.stage;
            await swingAt(target.x, target.y, true);
            const z = await S.state();
            if (z && z.phase !== 'over') {
              const n2 = z.nodes.find((n) => n.x === target.x && n.y === target.y);
              out.events.push({ t: z.waveT.toFixed(1), node: { rich: target.rich, stage: [stage, n2?.stage], alive: n2?.alive }, matBefore: before, matAfter: sum(z.gathered) + z.pickups, heat: Math.round(z.heat) });
            }
          } else {
            await keys.move(rx, ry);
            await sleep(80);
          }
          continue;
        }
        await keys.move(target.x - p.x + rx * 0.35, target.y - p.y + ry * 0.35);
        await sleep(70);
        continue;
      }
    }

    // otherwise kite
    await keys.move(rx + orbit[0], ry + orbit[1]);
    await sleep(70);
  }
  await keys.release();
  await page.mouse.up().catch(() => {});
  out.died = !!out.last && out.last.p.hp <= 0;
  return out;
}

export function parseStatus(text) {
  const num = (re) => {
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };
  return { hp: num(/Health\s+(\d+)\//), maxHp: num(/Health\s+\d+\/(\d+)/), scrap: num(/Scrap\s+(-?\d+)/), level: num(/Level\s+(\d+)/), bag: num(/Bag\s+(\d+)\//), comfort: num(/Bag\s+\d+\/(\d+)/) };
}
export { sum };

export const matSum = (rec) => sum(Object.fromEntries(Object.entries(rec ?? {}).filter(([, n]) => n > 0)));

// ----------------------------------------------------------- shared steps

/** Wait for the wave to hand over to a DOM screen (tally, gate or summary). */
export async function afterWave(S, r) {
  const scr = await S.waitScreen((s) => !s.hidden && !/^Paused/.test(s.h1), 8000, 'screen after wave');
  S.log(`after wave: h1="${scr.h1}" swings=${r.swings} nodeSwings=${r.nodeSwings} dodges=${r.dodges} abilities=${r.abilities} maxEnemies=${r.maxEnemies} minHp=${Math.round(r.minHp)} gathered=${JSON.stringify(r.last?.gathered)}`);
  return scr;
}

/** Check the tally screen against what the bot saw in the arena. */
export async function checkTally(S, r, label) {
  const scr = await S.screen();
  await sleep(900); // let the bars animate in
  await S.shot(`${label}-tally`);
  const save = await S.save();
  const run = save.run;
  S.check(run && run.phase === 'tally', `${label}: save says phase tally (is ${run?.phase})`);
  const g = r.last?.gathered ?? {};
  for (const [id, n] of Object.entries(run.last.res.gathered)) S.check((g[id] ?? 0) <= n, `${label}: tally gathered ${id}=${n} >= seen in arena ${g[id] ?? 0}`);
  const m = scr.text.match(/(\d+) damage taken · heat peaked at (\d+) · ([\d.]+)s gathering/);
  S.check(!!m, `${label}: tally shows damage/heat/gather line`);
  if (m) {
    S.check(Math.abs(Number(m[1]) - Math.round(run.last.res.dmgTaken)) <= 1, `${label}: damage taken shown ${m[1]} = ${Math.round(run.last.res.dmgTaken)}`);
    if (r.nodeSwings > 0 && Object.keys(run.last.res.gathered).length) S.check(Number(m[3]) > 0, `${label}: gathering time ${m[3]}s > 0 after ${r.nodeSwings} node swings`);
  }
  return run;
}

/** Buy everything affordable, weapons first, merging whenever offered; verifies scrap arithmetic each time. */
export async function campShop(S, label, { max = 12 } = {}) {
  let bought = 0;
  for (let guard = 0; guard < max; guard++) {
    const run = (await S.save()).run;
    if (await S.has('merge')) {
      const n = run.weapons.length;
      await S.click('merge');
      const run2 = (await S.save()).run;
      S.check(run2.weapons.length === n - 1, `${label}: merge reduced weapons ${n} -> ${run2.weapons.length}`);
      continue;
    }
    const order = run.shop.map((o, i) => ({ o, i })).filter((x) => !x.o.sold && x.o.price <= run.scrap).sort((a, b) => (a.o.kind === 'weapon' ? 0 : 1) - (b.o.kind === 'weapon' ? 0 : 1) || a.o.price - b.o.price);
    let did = false;
    for (const { o, i } of order) {
      const pr = await S.probe(S.sel('buy', i));
      if (!pr.exists || pr.disabled) continue;
      await S.click('buy', i);
      const run2 = (await S.save()).run;
      S.check(run2.scrap === run.scrap - o.price, `${label}: bought ${o.kind} ${o.fam ?? o.item} tier ${o.tier}: scrap ${run.scrap} -> ${run2.scrap} (price ${o.price})`);
      const st = parseStatus((await S.screen()).text);
      S.check(st.scrap === run2.scrap, `${label}: status bar scrap ${st.scrap} = save ${run2.scrap}`);
      bought++;
      did = true;
      break;
    }
    if (!did) break;
  }
  return bought;
}

export async function startWave(S) {
  const ok = await S.click('go');
  if (!ok) throw new Error('no Start wave button');
  await S.waitScreen((s) => s.hidden, 3000, 'arena after Start wave');
}

