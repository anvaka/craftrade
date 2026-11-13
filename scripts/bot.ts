// Headless check: scripted players run whole expeditions, including camp decisions.
// It finds crashes and gross balance problems. It cannot tell whether the game is fun.
import { CFG, EVOLVE_TIER, GROUNDS, type Ground } from '../src/data';
import { Game, idleInput, type Input, type OreNode } from '../src/game';
import { newProfile } from '../src/meta';
import * as R from '../src/run';

declare const process: { argv: string[] };

export type Greed = 'none' | 'cool' | 'careful' | 'greedy';
export interface Policy {
  greed: Greed;
  extractAt: number; // extract at this gate (1..3); 3 means full clear
  shop: boolean;
  craft: boolean;
  shrine: boolean;
  wild?: string;
  kit?: string;
  key?: number;
}

export function botInput(g: Game, greed: Greed): Input {
  const p = g.p;
  const inp = idleInput();
  inp.hasAim = true;
  inp.ax = p.ax;
  inp.ay = p.ay;
  let rx = 0;
  let ry = 0;
  let nearest = Infinity;
  let heavyTarget: { x: number; y: number } | null = null;
  let crowd = 0;
  for (const e of g.enemies) {
    if (!g.targetable(e)) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    nearest = Math.min(nearest, d - e.r - CFG.player.r);
    const far = e.kind === 'spitter' ? 120 : e.boss ? 330 : 260;
    if (d < far) {
      rx += (dx / d) * (far - d) * (e.boss ? 3 : 1);
      ry += (dy / d) * (far - d) * (e.boss ? 3 : 1);
    }
    if (d < 200) crowd++;
    if (e.shield && d < CFG.player.heavyRange + e.r - 5) heavyTarget = e;
  }
  for (const s of g.shots) {
    if (!s.hostile) continue;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 110) {
      rx += (dx / d) * (110 - d) * 2 - (s.vy / 250) * 40;
      ry += (dy / d) * (110 - d) * 2 + (s.vx / 250) * 40;
    }
    if (d < 34) nearest = Math.min(nearest, 0);
  }
  const cx = CFG.arena.w / 2 - p.x;
  const cy = CFG.arena.h / 2 - p.y;
  rx += cx * 0.35 - cy * 0.15;
  ry += cy * 0.35 + cx * 0.15;

  // objectives
  let goal: { x: number; y: number; r: number } | null = null;
  const supply = g.zones.find((z) => z.kind === 'supply');
  if (supply && !g.res.objective) goal = supply;
  const nest = g.nodes.find((n) => n.kind === 'nest' && n.alive);

  let node: OreNode | null = nest ?? null;
  const hpFrac = p.hp / g.spec.maxHp;
  const wants = greed === 'greedy' ? hpFrac > 0.3 : greed === 'careful' ? hpFrac > 0.5 && g.heat < 50 && crowd < 6 : greed === 'cool' ? hpFrac > 0.4 && g.heat < 12 : false;
  if (!node && wants) {
    let best = Infinity;
    for (const n of g.nodes) {
      if (!n.alive || !n.open || n.kind === 'nest') continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y) - (n.rich ? 300 : 0);
      if (d < best) {
        best = d;
        node = n;
      }
    }
  }
  let aim: { x: number; y: number } | null = heavyTarget;
  if (node) {
    const dx = node.x - p.x;
    const dy = node.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d - node.r < CFG.player.heavyRange - 6) {
      // in reach: stand and swing unless something is about to touch us
      aim = node;
      const hold = nearest > 55 ? 0 : 0.6;
      rx *= hold;
      ry *= hold;
    } else {
      rx = rx * 0.4 + (dx / d) * 200;
      ry = ry * 0.4 + (dy / d) * 200;
    }
  } else if (goal) {
    const dx = goal.x - p.x;
    const dy = goal.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > goal.r * 0.5) {
      rx = rx * 0.3 + (dx / d) * 220;
      ry = ry * 0.3 + (dy / d) * 220;
    } else {
      rx *= 0.25;
      ry *= 0.25;
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
  } else if (crowd >= 4 || g.bossRef) {
    inp.hasAim = false;
    inp.ability = p.abilityCd <= 0;
  }
  if (nearest < 6 && p.stamina >= CFG.player.dodgeCost && p.dodgeT <= 0 && !p.charging) inp.dodge = true;
  return inp;
}

const PICK_ORDER = ['edge', 'tempo', 'plating', 'vigor', 'reach', 'wind', 'stride', 'eye', 'cool', 'lever', 'drill', 'brawn', 'scav', 'packer', 'skinner', 'pull'];

function camp(run: R.RunState, pol: Policy): void {
  if (pol.shop) {
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < run.weapons.length; i++) if (R.merge(run, i)) i = -1;
      // weapons first, then items; keep a small reserve for rerolls
      const order = run.shop.map((o, i) => ({ o, i })).sort((a, b) => (a.o.kind === 'weapon' ? 0 : 1) - (b.o.kind === 'weapon' ? 0 : 1));
      for (const { o, i } of order) {
        if (o.kind === 'item' && o.item === 'rations' && run.hp > R.maxHp(run) * 0.6) continue;
        if (!R.canBuy(run, o)) R.buy(run, i);
      }
      if (run.scrap > R.rerollCost(run) + 25) R.reroll(run);
      else break;
    }
    for (let i = 0; i < run.weapons.length; i++) if (R.merge(run, i)) i = -1;
  }
  if (pol.craft) {
    for (const id of run.recipes) {
      if (id === 'mending' && run.hp > R.maxHp(run) * 0.6) continue;
      if (!R.canCraft(run, id)) R.craft(run, id);
    }
  }
  if (run.flasks.length && !run.flaskActive) R.drink(run, 0);
  // route: where the build's needs are; shrine only if allowed
  let best = 0;
  run.routeOptions.forEach((r, i) => {
    if (r.shrine && !pol.shrine) return;
    if (r.shrine && pol.shrine) best = i;
    else if (r.objective === 'elite' && !run.routeOptions[best].shrine) best = i;
  });
  if (run.routeOptions[best]?.shrine && !pol.shrine) best = run.routeOptions.findIndex((r) => !r.shrine);
  R.chooseRoute(run, Math.max(0, best));
  R.leaveCamp(run);
}

export function playRun(pol: Policy, seed: number, keyLevel = 1, ground: Ground = 'quarry', kit = 'wayfarer', setup?: (run: R.RunState) => void): R.RunState {
  const p = newProfile();
  const run = R.newRun({
    seed, keyLevel, mutators: [], kit, feat: R.ALL_FEATS, race: false,
    weapons: p.gear.filter((g) => g.kind === 'weapon') as never, tool: p.gear.find((g) => g.kind === 'tool') as never,
    bag: p.gear.find((g) => g.kind === 'bag') as never, charms: [], oil: null, flasks: [],
    recipes: ['mending', 'var-blade', 'var-bow', 'snare', 'stoneskin', 'evo-blade', 'evo-bow', 'quicksilver'], ground,
    cards: {}, poolLvl: 99, yieldBonus: { ore: 0, wood: 0, herb: 0 },
  });
  setup?.(run);
  void GROUNDS;
  for (let guard = 0; guard < 40 && run.phase !== 'over'; guard++) {
    const g = new Game(R.waveSpec(run));
    for (let i = 0; i < 60 * 200 && g.phase !== 'over'; i++) g.update(1 / 60, botInput(g, pol.greed));
    R.applyWave(run, g.res);
    if ((run.phase as string) === 'over') break;
    while (run.pendingPicks > 0) R.pickLevel(run, PICK_ORDER.find((id) => run.pickOffer.includes(id)) ?? run.pickOffer[0]);
    R.afterTally(run);
    if (run.phase === 'gate') {
      const gate = run.gate!;
      R.openChest(run);
      const ev = R.evolvable(run);
      if (ev.length) R.evolve(run, ev[0], R.eliteParts(run)[0]);
      R.pickWild(run, pol.wild ? run.gate!.wildOffer.find((w) => w === pol.wild) ?? null : null);
      if (gate.final || gate.boss + 1 >= pol.extractAt) {
        R.extract(run);
        break;
      }
      R.push(run);
    }
    camp(run, pol);
  }
  return run;
}

if (process.argv[1]?.includes('bot')) {
  const N = Number(process.argv[2]) || 12;
  const base: Policy = { greed: 'careful', extractAt: 3, shop: true, craft: true, shrine: false };
  const rows: [string, Policy][] = [
    ['never gathers', { ...base, greed: 'none' }],
    ['strikes only when heat < 12', { ...base, greed: 'cool' }],
    ['strikes while heat < 50', base],
    ['always gathers', { ...base, greed: 'greedy' }],
    ['heat<50, extract gate 1', { ...base, extractAt: 1 }],
    ['heat<50, extract gate 2', { ...base, extractAt: 2 }],
    ['heat<50, no shop', { ...base, shop: false }],
    ['heat<50, takes shrines', { ...base, shrine: true }],
    ['heat<50, danger 3', { ...base, key: 3 }],
    ['heat<50, danger 5', { ...base, key: 5 }],
    ...['prospector', 'duelist', 'tinker', 'firebrand', 'mule'].map((kit): [string, Policy] => [`heat<50, ${kit}`, { ...base, kit }]),
  ];
  console.log(`${N} seeds each, danger 1 unless stated. "kept" is materials banked after the death rule.\n`);
  console.log('policy'.padEnd(30), ' out%', 'waves', ' kept', ' /wave', '  dmg', 'heat', 'lvl', 'wpnT', 'evo', 'boss', 'schem');
  for (const [name, pol] of rows) {
    const a = { out: 0, waves: 0, kept: 0, dmg: 0, heat: 0, lvl: 0, tier: 0, evo: 0, boss: 0, schem: 0 };
    for (let i = 0; i < N; i++) {
      const run = playRun(pol, 1000 + i * 7919, pol.key ?? 1, 'quarry', pol.kit ?? 'wayfarer');
      const mats = Object.values(run.bagMats).reduce((x, y) => x + y, 0);
      const alive = run.outcome !== 'died';
      a.out += alive ? 1 : 0;
      a.waves += run.totals.wavesCleared;
      a.kept += alive ? mats : mats * CFG.keptOnDeath;
      a.dmg += run.totals.dmgTaken;
      a.heat += run.totals.heatPeak;
      a.lvl += run.level;
      a.tier += Math.max(...run.weapons.map((w) => w.tier));
      a.evo += run.weapons.some((w) => w.evolved) ? 1 : 0;
      a.boss += run.totals.bosses;
      a.schem += alive ? run.bagSchem.length : 0;
    }
    const f = (v: number, w: number, d = 0) => (v / N).toFixed(d).padStart(w);
    console.log(name.padEnd(30), `${Math.round((a.out / N) * 100)}%`.padStart(5), f(a.waves, 5, 1), f(a.kept, 5), (a.kept / Math.max(1, a.waves)).toFixed(1).padStart(6), f(a.dmg, 5), f(a.heat, 4), f(a.lvl, 3, 1), f(a.tier, 4, 1), f(a.evo, 3, 1), f(a.boss, 4, 1), f(a.schem, 5, 1));
  }
  void EVOLVE_TIER;
}
