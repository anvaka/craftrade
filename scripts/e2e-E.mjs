// Scenario E: touch at a phone viewport, portrait 390x844 and landscape 844x390.
import { Session, sleep, toScreen } from './e2e-lib.mjs';

/** Layout audit of the overlay as it stands: horizontal overflow, things off-screen, small tap targets, sticky bar. */
export async function audit(S, label) {
  const a = await S.page.evaluate(() => {
    const o = document.getElementById('overlay');
    const vw = innerWidth;
    const vh = innerHeight;
    const desc = (el) => `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).replace(/\s+/g, '.') : ''} "${(el.textContent || '').trim().slice(0, 40)}"`;
    const out = { vw, vh, hScroll: o.scrollWidth - o.clientWidth, docHScroll: document.documentElement.scrollWidth - vw, scrollH: o.scrollHeight, off: [], small: [], tight: [], sticky: null };
    const seen = new Set();
    for (const el of o.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        // report the outermost offender only
        let p = el.parentElement;
        let inner = false;
        while (p && p !== o) {
          if (seen.has(p)) inner = true;
          p = p.parentElement;
        }
        seen.add(el);
        if (!inner) out.off.push(`${desc(el)} left=${Math.round(r.left)} right=${Math.round(r.right)}`);
      }
    }
    const btns = [...o.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0);
    for (const b of btns) {
      const r = b.getBoundingClientRect();
      if (r.height < 40 || r.width < 40) out.small.push(`"${b.textContent.trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i].getBoundingClientRect();
      const b = btns[j].getBoundingClientRect();
      const gapX = Math.max(a.left - b.right, b.left - a.right);
      const gapY = Math.max(a.top - b.bottom, b.top - a.bottom);
      if (gapX < 8 && gapY < 0 && gapX >= 0 && (a.height < 40 || b.height < 40)) out.tight.push(`"${btns[i].textContent.trim().slice(0, 16)}" | "${btns[j].textContent.trim().slice(0, 16)}" gap ${Math.round(gapX)}px`);
    }
    const st = o.querySelector('.row.sticky');
    if (st) {
      const keep = o.scrollTop;
      o.scrollTop = o.scrollHeight;
      const sr = st.getBoundingClientRect();
      const btn = st.querySelector('button').getBoundingClientRect();
      const cards = [...o.querySelectorAll('.card')];
      const last = cards[cards.length - 1].getBoundingClientRect();
      out.sticky = { barTop: Math.round(sr.top), buttonTop: Math.round(btn.top), buttonBottom: Math.round(btn.bottom), lastCardBottom: Math.round(last.bottom), vh, barShareOfScreen: +((vh - sr.top) / vh).toFixed(2), coversLastCardAtBottom: last.bottom > btn.top - 2 };
      o.scrollTop = keep;
    }
    return out;
  });
  const sm = [...new Set(a.small)];
  S.log(`AUDIT ${label} (${a.vw}x${a.vh}): hScroll=${a.hScroll} docHScroll=${a.docHScroll} contentHeight=${a.scrollH} offscreen=${a.off.length} smallButtons=${a.small.length} tightPairs=${a.tight.length}${a.sticky ? ' sticky=' + JSON.stringify(a.sticky) : ''}`);
  if (a.hScroll > 1 || a.docHScroll > 1) S.finding(`${label}: horizontal scrolling at ${a.vw}x${a.vh} (overlay overflows by ${a.hScroll}px)`);
  if (a.off.length) S.finding(`${label}: ${a.off.length} element(s) extend past the screen edge at ${a.vw}px: ${a.off.slice(0, 4).join(' ; ')}`);
  if (sm.length) S.log(`  small tap targets (<40px): ${sm.slice(0, 14).join(', ')}${sm.length > 14 ? ` … +${sm.length - 14}` : ''}`);
  if (a.tight.length) S.log(`  small buttons closer than 8px: ${[...new Set(a.tight)].slice(0, 6).join(' ; ')}`);
  if (a.sticky?.coversLastCardAtBottom) S.finding(`${label}: at full scroll the sticky bar still covers the last card (card bottom ${a.sticky.lastCardBottom}, button top ${a.sticky.buttonTop})`);
  return a;
}

export async function fullShot(S, label) {
  // scroll through the overlay and take a shot per screenful (max 4)
  const n = await S.page.evaluate(() => {
    const o = document.getElementById('overlay');
    return Math.min(4, Math.ceil(o.scrollHeight / o.clientHeight));
  });
  for (let i = 0; i < n; i++) {
    await S.page.evaluate((i) => {
      const o = document.getElementById('overlay');
      o.scrollTop = i * o.clientHeight * 0.9;
    }, i);
    await sleep(60);
    await S.shot(`${label}${n > 1 ? '-' + (i + 1) : ''}`);
  }
  await S.page.evaluate(() => (document.getElementById('overlay').scrollTop = 0));
}

async function touchWave(S, tag) {
  const page = S.page;
  const ts = page.touchscreen;
  await S.attach();
  let s = await S.state();
  const { w, h } = s.cam;
  S.log(`${tag}: wave started, viewport ${w}x${h}, scale ${s.cam.scale.toFixed(2)}, touchMode=${s.input.touchMode}`);
  await sleep(500);
  await S.shot(`${tag}-wave-before-first-touch`);
  const B = { dodge: [w - 62, h - 62], ability: [w - 150, h - 62], swap: [w - 62, h - 146] };

  // --- move stick: steer to the nearest node
  const node = s.nodes.filter((n) => n.alive && n.open).sort((a, b) => Math.hypot(a.x - s.p.x, a.y - s.p.y) - Math.hypot(b.x - s.p.x, b.y - s.p.y))[0];
  const ox = Math.round(w * 0.22);
  const oy = Math.round(h * 0.7);
  const stick = await ts.touchStart(ox, oy);
  await sleep(60);
  s = await S.state();
  S.check(s.input.touchMode && s.input.joy && !s.input.aim, `${tag}: a touch on the left half becomes the move stick (touchMode=${s.input.touchMode}, joy=${s.input.joy}, aim=${s.input.aim})`);
  const p0 = { ...s.p };
  let reached = false;
  for (let i = 0; i < 80; i++) {
    s = await S.state();
    if (s.phase === 'over') break;
    const dx = node.x - s.p.x;
    const dy = node.y - s.p.y;
    const d = Math.hypot(dx, dy);
    if (d - node.r < 45) {
      reached = true;
      break;
    }
    await stick.move(ox + (dx / d) * 50, oy + (dy / d) * 50);
    if (i === 6) await S.shot(`${tag}-stick`);
    await sleep(70);
  }
  s = await S.state();
  S.check(Math.hypot(s.p.x - p0.x, s.p.y - p0.y) > 60, `${tag}: the stick moves the player (${Math.round(Math.hypot(s.p.x - p0.x, s.p.y - p0.y))} units)`);
  S.check(reached, `${tag}: steered to the nearest node with the stick`);
  await stick.move(ox, oy); // centre: stop
  await sleep(150);
  const stopA = (await S.state()).p;
  await sleep(250);
  const stopB = (await S.state()).p;
  S.check(Math.hypot(stopA.x - stopB.x, stopA.y - stopB.y) < 3, `${tag}: stick back at centre stops the player`);

  // --- hold, drag to aim, release: with the stick finger still down (two touches at once)
  s = await S.state();
  const ax = node.x - s.p.x;
  const ay = node.y - s.p.y;
  const al = Math.hypot(ax, ay);
  const rx = Math.round(w * 0.72);
  const ry = Math.round(h * 0.55);
  const stage0 = s.nodes.find((n) => n.x === node.x && n.y === node.y).stage;
  const aim = await ts.touchStart(rx, ry);
  await sleep(50);
  await aim.move(rx + (ax / al) * 40, ry + (ay / al) * 40);
  let full = false;
  for (let i = 0; i < 30; i++) {
    s = await S.state();
    if (s.p.charge >= 1) {
      full = true;
      break;
    }
    await sleep(40);
  }
  S.check(s.input.aim && s.input.joy, `${tag}: second finger on the right half is tracked together with the stick (aim=${s.input.aim}, joy=${s.input.joy})`);
  S.check(full, `${tag}: holding on the right half winds up the heavy swing (charge ${s.p.charge.toFixed(2)})`);
  S.check(Math.abs(s.p.ax - ax / al) < 0.15 && Math.abs(s.p.ay - ay / al) < 0.15, `${tag}: dragging aims the swing (aim ${s.p.ax.toFixed(2)},${s.p.ay.toFixed(2)} wanted ${(ax / al).toFixed(2)},${(ay / al).toFixed(2)})`);
  await S.shot(`${tag}-swing-charged`);
  await aim.end();
  await sleep(150);
  s = await S.state();
  const n1 = s.nodes.find((n) => n.x === node.x && n.y === node.y);
  S.check(n1.stage > stage0, `${tag}: releasing strikes the node (stage ${stage0} -> ${n1.stage}); pickups ${s.pickups}, gathered ${JSON.stringify(s.gathered)}`);
  await stick.end();
  await sleep(100);
  s = await S.state();
  S.check(!s.input.joy && !s.input.aim, `${tag}: lifting both fingers clears stick and aim`);

  // --- buttons
  await sleep(1200);
  s = await S.state();
  const st0 = s.p.stamina;
  await ts.tap(...B.dodge);
  await sleep(60);
  let z = await S.state();
  S.check(z.p.dodgeT > 0 || z.p.stamina < st0 - 20, `${tag}: DODGE button dodges (dodgeT ${z.p.dodgeT.toFixed(2)}, stamina ${st0.toFixed(0)} -> ${z.p.stamina.toFixed(0)})`);
  S.check(!z.input.aim, `${tag}: tapping DODGE does not start an aim/swing`);
  await sleep(400);
  const idx0 = z.abilityIdx;
  await ts.tap(...B.swap);
  await sleep(80);
  z = await S.state();
  S.check(z.abilityIdx !== idx0, `${tag}: SWAP button swaps the ability (${idx0} -> ${z.abilityIdx})`);
  await ts.tap(...B.ability);
  await sleep(80);
  z = await S.state();
  S.check(z.p.abilityCd > 0, `${tag}: ability button fires (${z.abilities[z.abilityIdx]}, cooldown ${z.p.abilityCd.toFixed(1)}s)`);
  await S.shot(`${tag}-buttons`);

  // --- a hold on the right half without dragging: auto-aim
  s = await S.state();
  const hold = await ts.touchStart(rx, ry - 80);
  await sleep(750);
  z = await S.state();
  S.log(`${tag}: hold without drag: charging=${z.p.charging} charge=${z.p.charge.toFixed(2)} aim=(${z.p.ax.toFixed(2)},${z.p.ay.toFixed(2)})`);
  await hold.end();

  // --- is there any way to pause or mute by touch?
  S.log(`${tag}: no on-screen pause or mute control exists for touch (P / Escape / M are keyboard only)`);

  // --- ride out the wave: run from the nearest enemy with the stick
  const kite = await ts.touchStart(ox, oy);
  let last = null;
  for (;;) {
    s = await S.state();
    if (!s || s.phase === 'over') break;
    last = s;
    const live = s.enemies.filter((e) => e.state !== 'under');
    let vx = 750 - s.p.x;
    let vy = 475 - s.p.y;
    const cl = Math.hypot(vx, vy) || 1;
    vx = (vx / cl) * 0.3 + (-(475 - s.p.y) / cl) * 0.6;
    vy = (vy / cl) * 0.3 + ((750 - s.p.x) / cl) * 0.6;
    for (const e of live) {
      const d = Math.max(20, Math.hypot(e.x - s.p.x, e.y - s.p.y));
      if (d < 300) {
        vx += ((s.p.x - e.x) / d) * (9000 / (d * d));
        vy += ((s.p.y - e.y) / d) * (9000 / (d * d));
      }
    }
    const l = Math.hypot(vx, vy) || 1;
    await kite.move(ox + (vx / l) * 50, oy + (vy / l) * 50);
    await sleep(90);
  }
  await kite.end().catch(() => {});
  return last;
}

async function phone(S, tag, width, height) {
  const page = S.page;
  await page.setViewport({ width, height, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  await S.goto();
  let scr = await S.waitScreen((s) => !s.hidden, 5000, 'welcome');
  await audit(S, `${tag} welcome`);
  await fullShot(S, `${tag}-welcome`);
  await S.click('guided', '0', { tap: true });
  scr = await S.waitScreen((s) => s.h1 === 'Town', 3000, 'town by tap');
  S.check(scr.h1 === 'Town', `${tag}: tapping "Everything open" reaches the town`);
  for (const t of ['Expedition', 'Forge', 'Workshop', 'Apothecary', 'Codex', 'Storage', 'Standing', 'Vault']) {
    await S.click('tab', t, { tap: true, quiet: true });
    const on = await page.evaluate(() => document.querySelector('#overlay .tab.on')?.textContent);
    S.check(on.startsWith(t), `${tag}: tab ${t} opens by tap`);
    await audit(S, `${tag} town/${t}`);
    await fullShot(S, `${tag}-town-${t}`);
  }
  await S.click('tab', 'Expedition', { tap: true, quiet: true });
  await S.click('ground', 'grove', { tap: true });
  S.check((await S.save()).loadout.ground === 'grove', `${tag}: tapping a ground selects it`);
  await S.click('ground', 'quarry', { tap: true });
  await S.click('start', undefined, { tap: true });
  await S.waitScreen((s) => s.hidden, 3000, 'arena by tap');
  const last = await touchWave(S, tag);
  scr = await S.waitScreen((s) => !s.hidden, 8000, 'screen after touch wave');
  S.log(`${tag}: after the wave: "${scr.h1}"; gathered ${JSON.stringify(last?.gathered)} hp ${last?.p.hp}`);
  await sleep(900);
  if (/cleared/.test(scr.h1)) {
    await audit(S, `${tag} tally`);
    await fullShot(S, `${tag}-tally`);
    await S.click('tallyok', undefined, { tap: true });
    scr = await S.waitScreen((s) => s.h1 === 'Camp', 3000, 'camp by tap');
    await audit(S, `${tag} camp`);
    await fullShot(S, `${tag}-camp`);
    const run = (await S.save()).run;
    const i = run.shop.findIndex((o) => !o.sold && o.price <= run.scrap);
    if (i >= 0) {
      await S.click('buy', String(i), { tap: true });
      S.check((await S.save()).run.scrap === run.scrap - run.shop[i].price, `${tag}: buying by tap works`);
    }
    await S.click('lock', '0', { tap: true, quiet: true });
    await S.click('route', '1', { tap: true });
    S.check((await S.save()).run.routePick === 1, `${tag}: route chosen by tap`);
    // is the Start wave button reachable without scrolling to the very end?
    await page.evaluate(() => (document.getElementById('overlay').scrollTop = 0));
    const go = await page.evaluate(() => {
      const b = document.querySelector('#overlay [data-a="go"]').getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, vh: innerHeight };
    });
    S.log(`${tag}: at scroll 0 the Start wave button sits at y=${Math.round(go.top)}..${Math.round(go.bottom)} of ${go.vh} (sticky)`);
    await S.click('go', undefined, { tap: true });
    await S.waitScreen((s) => s.hidden, 3000, 'wave 2 by tap');
    await sleep(1500);
    await S.shot(`${tag}-wave2`);
  } else {
    await audit(S, `${tag} summary-after-death`);
    await fullShot(S, `${tag}-summary-death`);
  }

  // layouts that take long to reach by play: use the debug pages with the same viewport
  for (const [name, query] of [['gate', '?demo=gate'], ['camp-late', '?demo=camp&waves=6'], ['tally-late', '?demo=tally&waves=6'], ['forge-rich', '?demo=rich&tab=Forge'], ['apothecary-rich', '?demo=rich&tab=Apothecary'], ['standing-rich', '?demo=rich&tab=Standing'], ['codex-rich', '?demo=rich&tab=Codex'], ['expedition-rich', '?demo=rich&tab=Expedition']]) {
    await S.goto(query);
    await sleep(name.startsWith('tally') ? 1500 : 300);
    await audit(S, `${tag} ${name} (debug page)`);
    await fullShot(S, `${tag}-demo-${name}`);
    if (name === 'gate') {
      // walk the gate by tap and look at the summary
      await S.click('chest', undefined, { tap: true, quiet: true });
      await audit(S, `${tag} gate after chest (debug page)`);
      await S.click('wild', '', { tap: true, quiet: true });
      await fullShot(S, `${tag}-demo-gate-ready`);
      await S.click('extract', undefined, { tap: true });
      await sleep(200);
      await audit(S, `${tag} summary (debug page)`);
      await fullShot(S, `${tag}-demo-summary`);
    }
  }
  // pause overlay on a phone (reachable only by switching apps)
  await S.goto('?demo=wave&waves=1');
  await sleep(600);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;
  });
  await sleep(200);
  scr = await S.screen();
  S.check(/Paused/.test(scr.h1), `${tag}: visibilitychange pauses on the phone viewport`);
  await audit(S, `${tag} pause`);
  await S.shot(`${tag}-pause`);
  await S.click('resume', undefined, { tap: true });
  await sleep(300);
  S.check((await S.screen()).hidden, `${tag}: Resume by tap works`);
  await page.evaluate((k) => localStorage.removeItem(k), 'craftworld.save.v2');
}

export default async function scenarioE() {
  const S = new Session('E-touch');
  await S.launch({ width: 390, height: 844, touch: true, mobile: true, dsf: 3 });
  try {
    await phone(S, 'portrait', 390, 844);
    await phone(S, 'landscape', 844, 390);
  } catch (e) {
    S.finding('SCRIPT ABORTED: ' + (e.stack || e));
    await S.shot('abort').catch(() => {});
  }
  await S.close();
}
