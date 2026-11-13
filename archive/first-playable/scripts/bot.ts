// Headless sanity check: runs the five waves with crude scripted players.
// It checks the simulation does not crash and that the numbers are in a sane range.
// It says nothing about fun; only a person playing can judge that.
import { CFG } from '../src/config';
import { Game, type Input, type OreNode } from '../src/game';

type Policy = 'fighter' | 'cautious' | 'greedy';

function bot(g: Game, policy: Policy): Input {
  const p = g.p;
  const inp: Input = { mx: 0, my: 0, ax: p.ax, ay: p.ay, hasAim: true, heavy: false, dodge: false };

  // run from nearby enemies, drift toward the centre, circle a little
  let rx = 0;
  let ry = 0;
  let nearest = Infinity;
  let shieldTarget: { x: number; y: number } | null = null;
  for (const e of g.enemies) {
    if (!g.targetable(e)) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const gap = d - e.r - CFG.player.r;
    nearest = Math.min(nearest, gap);
    if (d < 260) {
      rx += (dx / d) * (260 - d);
      ry += (dy / d) * (260 - d);
    }
    if (e.shield && d < CFG.player.heavyRange + e.r - 5) shieldTarget = e;
  }
  const cx = CFG.arena.w / 2 - p.x;
  const cy = CFG.arena.h / 2 - p.y;
  rx += cx * 0.35 - cy * 0.15;
  ry += cy * 0.35 + cx * 0.15;

  let node: OreNode | null = null;
  const wantsOre = policy === 'greedy' ? p.hp > 30 : policy === 'cautious' ? p.hp > 50 && g.heat < 45 : false;
  if (wantsOre) {
    let best = Infinity;
    for (const n of g.nodes) {
      if (!n.alive || !n.open) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y) - (n.rich ? 300 : 0);
      if (d < best) {
        best = d;
        node = n;
      }
    }
  }

  let aim: { x: number; y: number } | null = shieldTarget;
  if (node) {
    const dx = node.x - p.x;
    const dy = node.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d - node.r < CFG.player.heavyRange - 15) {
      aim = node;
      rx *= 0.3;
      ry *= 0.3;
    } else {
      rx = rx * 0.4 + (dx / d) * 200;
      ry = ry * 0.4 + (dy / d) * 200;
    }
  }

  const rl = Math.hypot(rx, ry);
  if (rl > 1) {
    inp.mx = rx / rl;
    inp.my = ry / rl;
  }
  if (aim) {
    const d = Math.hypot(aim.x - p.x, aim.y - p.y) || 1;
    inp.ax = (aim.x - p.x) / d;
    inp.ay = (aim.y - p.y) / d;
    if (p.charging || p.stamina >= CFG.player.heavyCost) inp.heavy = p.charge < 1;
  }
  if (nearest < 6 && p.stamina >= CFG.player.dodgeCost && p.dodgeT <= 0 && !p.charging) inp.dodge = true;
  return inp;
}

function run(gathering: boolean, policy: Policy, seed: number) {
  const g = new Game(gathering, seed);
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 400 && g.phase !== 'over'; i++) g.update(dt, bot(g, policy));
  return g.stats;
}

const rows: [string, boolean, Policy][] = [
  ['gathering OFF, fighter', false, 'fighter'],
  ['gathering ON,  ignores nodes', true, 'fighter'],
  ['gathering ON,  cautious miner', true, 'cautious'],
  ['gathering ON,  greedy miner', true, 'greedy'],
];
const N = 20;
console.log(`${N} seeds each (seed 0 is the shipped one)\n`);
console.log('policy'.padEnd(32), 'survive', ' waves', '  ore', ' dmg', ' heat', ' gather s', ' kills');
for (const [name, gathering, policy] of rows) {
  const s = { surv: 0, waves: 0, ore: 0, dmg: 0, heat: 0, gt: 0, kills: 0 };
  for (let i = 0; i < N; i++) {
    const r = run(gathering, policy, CFG.seed + i * 77);
    s.surv += r.died ? 0 : 1;
    s.waves += r.wavesCleared;
    s.ore += r.material;
    s.dmg += r.damageTaken;
    s.heat += r.heatPeak;
    s.gt += r.gatherTime;
    s.kills += r.kills;
  }
  const f = (v: number, w: number, d = 0) => (v / N).toFixed(d).padStart(w);
  console.log(
    name.padEnd(32),
    `${Math.round((s.surv / N) * 100)}%`.padStart(7),
    f(s.waves, 6, 1),
    f(s.ore, 5),
    f(s.dmg, 4),
    f(s.heat, 5),
    f(s.gt, 9, 1),
    f(s.kills, 6),
  );
}
