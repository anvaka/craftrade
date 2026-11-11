// Player policies of different skill for the fun critique. They read only the
// public run state, like src/sim/bot.ts, but are handicapped the way a person is:
// a reaction delay, a slow decision rate, eight keyboard directions, and simple bench rules.
//
// The sim module is passed in so the same policies run against patched copies of src/sim.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Sim = any;
type Run = any;

export interface Policy {
  name: string;
  /** Called every tick during a wave. */
  input(run: Run, out: { mx: number; my: number }): void;
  /** Called once per bench. */
  bench(run: Run): void;
}

const S2 = Math.SQRT1_2;
function snap8(x: number, y: number, out: { mx: number; my: number }): void {
  const d = Math.hypot(x, y);
  if (d < 1e-6) { out.mx = 0; out.my = 0; return; }
  const a = Math.round(Math.atan2(y, x) / (Math.PI / 4));
  const k = ((a % 8) + 8) % 8;
  out.mx = [1, S2, 0, -S2, -1, -S2, 0, S2][k];
  out.my = [0, S2, 1, S2, 0, -S2, -1, -S2][k];
}

/** Wrap a decision function with a reaction delay: the move decided now is applied `delay` ticks later. */
function delayed(delay: number, every: number, decide: (run: Run, out: { mx: number; my: number }) => void) {
  const N = 256;
  const qx = new Float64Array(N), qy = new Float64Array(N), qt = new Int32Array(N);
  let head = 0, tail = 0, curX = 0, curY = 0, lastWave = -1;
  const tmp = { mx: 0, my: 0 };
  return (run: Run, out: { mx: number; my: number }): void => {
    if (run.wave !== lastWave) { lastWave = run.wave; head = tail = 0; curX = curY = 0; }
    if (run.tick % every === 0) {
      decide(run, tmp);
      qx[tail % N] = tmp.mx; qy[tail % N] = tmp.my; qt[tail % N] = run.tick + delay; tail++;
    }
    while (head < tail && qt[head % N] <= run.tick) { curX = qx[head % N]; curY = qy[head % N]; head++; }
    out.mx = curX; out.my = curY;
  };
}

// ---------------------------------------------------------------------------------------------
// Novice: 400 ms late, walks at the nearest pickup or node, stands in the ring, only runs after
// being hit, picks the leftmost upgrade and buys the first offer it can afford. Never rerolls,
// locks, fuses or sends the mule.
// ---------------------------------------------------------------------------------------------
export function novice(sim: Sim, opts: { delay?: number; every?: number; cautious?: boolean } = {}): Policy {
  const { MAX_ENEMIES, MAX_PICKUPS, MAX_NODES, NODE_RING, ENEMIES, ES, ARENA_W, ARENA_H } = sim;
  let lastHp = 0, fleeUntil = 0, lastWave = -1;
  const decide = (run: Run, out: { mx: number; my: number }): void => {
    const p = run.player;
    if (run.wave !== lastWave) { lastWave = run.wave; lastHp = p.hp; fleeUntil = 0; }
    if (p.hp < lastHp - 0.5) fleeUntil = run.tick + 60;
    lastHp = p.hp;
    if (run.tick < fleeUntil) {
      // Run from the nearest enemy, nothing smarter.
      let bd = 1e18, bx = 0, by = 0;
      for (let i = 0; i < MAX_ENEMIES; i++) {
        const e = run.enemies[i];
        if (!e.alive || e.state === ES.Spawn || ENEMIES[e.type].ai === 'thief') continue;
        const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        if (d < bd) { bd = d; bx = e.x; by = e.y; }
      }
      if (bd < 1e17) {
        let fx = p.x - bx, fy = p.y - by;
        // People do turn away from a wall they are pressed against.
        if (p.x < 80) fx = Math.abs(fx) + 1; if (p.x > ARENA_W - 80) fx = -Math.abs(fx) - 1;
        if (p.y < 80) fy = Math.abs(fy) + 1; if (p.y > ARENA_H - 80) fy = -Math.abs(fy) - 1;
        snap8(fx, fy, out); return;
      }
    }
    if (opts.cautious) {
      // 'novice+': also backs straight off anything about to touch it (still 400 ms late, still no telegraph reading).
      let nd = 1e18, nx = 0, ny = 0;
      for (let i = 0; i < MAX_ENEMIES; i++) {
        const e = run.enemies[i];
        if (!e.alive || e.state === ES.Spawn || e.state === ES.Burrowed || ENEMIES[e.type].ai === 'thief') continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r;
        if (d < nd) { nd = d; nx = e.x; ny = e.y; }
      }
      if (nd < 95) {
        let fx = p.x - nx, fy = p.y - ny;
        if (p.x < 80) fx = Math.abs(fx) + 1; if (p.x > ARENA_W - 80) fx = -Math.abs(fx) - 1;
        if (p.y < 80) fy = Math.abs(fy) + 1; if (p.y > ARENA_H - 80) fy = -Math.abs(fy) - 1;
        snap8(fx, fy, out); return;
      }
    }
    if (p.workingNode >= 0) { out.mx = 0; out.my = 0; return; }
    let bd = 600 * 600, tx = 0, ty = 0, found = false;
    for (let i = 0; i < MAX_PICKUPS; i++) {
      const k = run.pickups[i];
      if (!k.alive || k.pulled) continue;
      const d = (k.x - p.x) ** 2 + (k.y - p.y) ** 2;
      if (d < bd) { bd = d; tx = k.x; ty = k.y; found = true; }
    }
    if (!found) {
      bd = 1e18;
      for (let i = 0; i < MAX_NODES; i++) {
        const n = run.nodes[i];
        if (!n.alive) continue;
        const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
        if (d < bd) { bd = d; tx = n.x; ty = n.y; found = true; }
      }
      if (found && bd < (NODE_RING - 20) ** 2) { out.mx = 0; out.my = 0; return; }
    }
    if (!found) { out.mx = 0; out.my = 0; return; }
    snap8(tx - p.x, ty - p.y, out);
  };
  return {
    name: opts.cautious ? 'novice+' : 'novice',
    input: delayed(opts.delay ?? 24, opts.every ?? 9, decide),
    bench(run: Run) {
      while (run.bench.picks > 0) if (!sim.pickUpgrade(run, 0)) break;
      for (let guard = 0; guard < 8; guard++) {
        let bought = false;
        for (let i = 0; i < 4; i++) if (sim.buyBlock(run, i) === null) { sim.buy(run, i); bought = true; break; }
        if (!bought) break;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Average: 250 ms late, keeps a gap to what is closing, steps out of rings and off charge lines it
// has seen, collects when it is quiet, works a node when nothing is near it, fills weapon slots
// first and then buys the cheapest items. One reroll when nothing can be bought. No fusion.
// ---------------------------------------------------------------------------------------------
const AVG_STAT: Record<string, number> = {
  damage: 1.2, rate: 1.2, maxHp: 1.1, armor: 1.0, ranged: 1.0, melee: 0.8, speed: 0.8, dodge: 0.8, crit: 0.7,
  mend: 0.7, reach: 0.4, harvest: 0.4, luck: 0.3,
};
export function average(sim: Sim, opts: { delay?: number; every?: number; bench?: 'avg' | 'novice' | 'expert' } = {}): Policy {
  const { MAX_ENEMIES, MAX_PICKUPS, MAX_NODES, MAX_ESHOTS, MAX_HAZARDS, NODE_RING, ENEMIES, ES, ARENA_W, ARENA_H, AI, HZ_RING,
    WEAPONS, UPGRADE_VALUE, CHARACTER } = sim;
  const expertBot = opts.bench === 'expert' ? sim.createBot(12345) : null;
  const nov = opts.bench === 'novice' ? novice(sim) : null;
  const decide = (run: Run, out: { mx: number; my: number }): void => {
    const p = run.player;
    const frail = p.hp < p.maxHp * 0.4;
    const keep = frail ? 230 : 150;
    let rx = 0, ry = 0, nearD = 1e9, nearX = 0, nearY = 0, urgent = false;
    for (let i = 0; i < MAX_ENEMIES; i++) {
      const e = run.enemies[i];
      if (!e.alive) continue;
      const def = ENEMIES[e.type];
      if (def.ai === 'thief' || e.state === ES.Burrowed) continue;
      if (e.state === ES.Spawn && e.t > 0.3) continue;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, gap = d - e.r;
      if (gap < nearD && e.state !== ES.Surfacing) { nearD = gap; nearX = e.x; nearY = e.y; }
      // A charge it has seen wind up: get off the line.
      if ((e.state === ES.Windup || e.state === ES.Charge) && def.ai !== 'spit' && d < 620) {
        const along = dx * e.dx + dy * e.dy;
        if (along > -20) {
          const off = dx * -e.dy + dy * e.dx; // signed distance from the line
          if (Math.abs(off) < 70) { const s = off >= 0 ? 1 : -1; rx += -e.dy * s * 4; ry += e.dx * s * 4; urgent = true; }
        }
        continue;
      }
      if (gap < keep) { const w = (keep - gap) / keep; rx += (dx / d) * w * (def.rank > 0 ? 3 : 1); ry += (dy / d) * w * (def.rank > 0 ? 3 : 1); }
    }
    for (let i = 0; i < MAX_HAZARDS; i++) {
      const h = run.hazards[i];
      if (!h.alive) continue;
      const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy) || 1;
      if (h.kind === HZ_RING) {
        if (d > h.r0 - 20 && d < h.r1 + 30) {
          // Leave by the nearer edge.
          const outward = h.r0 <= 0 || h.r1 - d < d - h.r0;
          const s = outward ? 1 : -1;
          rx += (dx / d) * s * 5; ry += (dy / d) * s * 5; urgent = true;
        }
      } else if (d < h.r1 + 40) { rx += (dx / d) * 2; ry += (dy / d) * 2; }
    }
    for (let i = 0; i < MAX_ESHOTS; i++) {
      const s = run.eshots[i];
      if (!s.alive) continue;
      const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
      if (d > 220) continue;
      const v = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / v, uy = s.vy / v;
      const along = dx * ux + dy * uy;
      if (along < 0) continue;
      const off = dx * -uy + dy * ux;
      if (Math.abs(off) < 40) { const sg = off >= 0 ? 1 : -1; rx += -uy * sg * 3; ry += ux * sg * 3; urgent = true; }
    }
    // Stay out of corners.
    const ex = p.x < 140 ? 1 : p.x > ARENA_W - 140 ? -1 : 0, ey = p.y < 140 ? 1 : p.y > ARENA_H - 140 ? -1 : 0;
    const rl = Math.hypot(rx, ry);
    if (urgent || rl > 0.25) {
      rx += ex * 0.8 + ((ARENA_W / 2 - p.x) / ARENA_W) * 0.4; ry += ey * 0.8 + ((ARENA_H / 2 - p.y) / ARENA_H) * 0.4;
      snap8(rx, ry, out); return;
    }
    if (p.workingNode >= 0 && nearD > 110) { out.mx = 0; out.my = 0; return; }
    // Pickups when nothing is on top of us.
    let bd = (frail ? 220 : 380) ** 2, tx = 0, ty = 0, found = false;
    for (let i = 0; i < MAX_PICKUPS; i++) {
      const k = run.pickups[i];
      if (!k.alive || k.pulled) continue;
      const d = (k.x - p.x) ** 2 + (k.y - p.y) ** 2;
      if (d < bd) { bd = d; tx = k.x; ty = k.y; found = true; }
    }
    if (!found && !frail) {
      const left = run.waveSeconds - run.waveTime;
      bd = 1e18;
      for (let i = 0; i < MAX_NODES; i++) {
        const n = run.nodes[i];
        if (!n.alive) continue;
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d / p.moveSpeed + (n.need - n.work) / p.workRate > left) continue;
        let crowd = 0;
        for (let j = 0; j < MAX_ENEMIES; j++) {
          const e = run.enemies[j];
          if (e.alive && ENEMIES[e.type].ai !== 'thief' && (e.x - n.x) ** 2 + (e.y - n.y) ** 2 < 200 * 200) crowd++;
        }
        if (crowd > 2) continue;
        if (d < bd) { bd = d; tx = n.x; ty = n.y; found = true; }
      }
      if (found && bd < NODE_RING - 20) { out.mx = 0; out.my = 0; return; }
    }
    if (!found && nearD < 1e8) {
      let r = 1e9;
      for (const w of p.weapons) { const wr = sim.weaponRange(p, WEAPONS[w.def]); if (wr < r) r = wr; }
      if (nearD > r * 0.85) { tx = nearX; ty = nearY; found = true; }
    }
    if (!found) {
      if (Math.abs(p.x - ARENA_W / 2) > 400 || Math.abs(p.y - ARENA_H / 2) > 280) { tx = ARENA_W / 2; ty = ARENA_H / 2; found = true; }
    }
    if (!found) { out.mx = 0; out.my = 0; return; }
    snap8(tx - p.x + ex * 60, ty - p.y + ey * 60, out);
  };
  const bench = (run: Run): void => {
    const p = run.player, b = run.bench;
    while (b.picks > 0) {
      let best = 0, bu = -1;
      for (let i = 0; i < b.choices.length; i++) {
        const c = b.choices[i];
        const u = (AVG_STAT[c.stat] ?? 0.5) * (c.value / UPGRADE_VALUE[c.stat][0]);
        if (u > bu) { bu = u; best = i; }
      }
      if (!sim.pickUpgrade(run, best)) break;
    }
    const slots = CHARACTER[run.character].slots;
    for (let round = 0; round < 2; round++) {
      for (let guard = 0; guard < 8; guard++) {
        let pick = -1, score = -1;
        for (let i = 0; i < 4; i++) {
          if (sim.buyBlock(run, i) !== null) continue;
          const o = b.offers[i];
          let s: number;
          if (o.kind === 'weapon') {
            const twin = p.weapons.some((w: any) => w.id === o.id && w.tier === o.tier);
            s = twin ? 1000 : p.weapons.length < slots ? 500 + o.tier * 10 : -1;
          } else s = 100 - o.price * 0.1 + o.tier * 5;
          if (s > score) { score = s; pick = i; }
        }
        if (pick < 0) break;
        sim.buy(run, pick);
      }
      const cost = sim.rerollCost(run);
      if (round === 0 && p.scrip >= cost * 3 + 12) { if (!sim.reroll(run)) break; } else break;
    }
    if (b.mule) sim.sendMule(run, { timber: Math.floor(p.raws.timber / 2), ore: Math.floor(p.raws.ore / 2), hide: Math.floor(p.raws.hide / 2) });
  };
  return {
    name: 'average',
    input: delayed(opts.delay ?? 15, opts.every ?? 6, decide),
    bench: expertBot ? (run: Run) => sim.botBench(run, expertBot) : nov ? nov.bench : bench,
  };
}

// ---------------------------------------------------------------------------------------------
// Expert: the shipped bot (src/sim/bot.ts). `delay` > 0 gives it human latency, for a sensitivity check.
// ---------------------------------------------------------------------------------------------
export function expert(sim: Sim, seed: number, opts: { delay?: number; every?: number; bench?: 'novice' } = {}): Policy {
  const bot = sim.createBot(seed);
  const raw = (run: Run, out: { mx: number; my: number }): void => sim.botInput(run, bot, out);
  const nov = opts.bench === 'novice' ? novice(sim) : null;
  let input = raw;
  if (opts.delay) {
    // The bot re-decides every bot.every ticks on its own; sample it every tick and delay the result.
    input = delayed(opts.delay, 1, raw);
  }
  return { name: 'expert', input, bench: nov ? nov.bench : (run: Run) => sim.botBench(run, bot) };
}
