// Shared harness for the depth experiments: the policy registry, an instrumented
// run loop, and the record written per run. Nothing here edits src/.
// The policies themselves now live in src/sim/bot.ts (POLICIES), so balance.ts prints the same table.
import { BASE_ITEM, BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { RELIC } from '../../../src/shared/content/relics.ts';
import type { ItemSpec } from '../../../src/shared/item.ts';
import { STATS, type StatId } from '../../../src/shared/vocab.ts';
import { ENEMIES } from '../../../src/sim/data/enemies.ts';
import { UPGRADE_VALUE } from '../../../src/sim/data/upgrades.ts';
import { SOURCE_IDS, WEAPONS } from '../../../src/sim/data/weapons.ts';
import { ST, rebuild } from '../../../src/sim/core.ts';
import { clearEvents, createRun, nextWave, step, type StepInput } from '../../../src/sim/run.ts';
import type { Run } from '../../../src/sim/types.ts';
import type { CharacterId } from '../../../src/shared/protocol.ts';
import { botBench, botInput, createBot, policy as basePolicy, POLICIES, type BenchLog, type Policy } from '../../../src/sim/bot.ts';

export const CHARS: CharacterId[] = ['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk'];
export const seedOf = (s: number) => s * 7919 + 13;

/** A policy plus what the harness sets up before wave 1. */
export interface Setup extends Policy { kit?: ItemSpec[]; startStats?: Partial<Record<StatId, number>>; hazard?: number }

/**
 * Names: any strategy in src/sim/bot.ts (default, offence, melee, ranged, edge, blunt, shot, stack:<weapon>, gatherer,
 * tank, evade, economy, lucky, lowGather, gatherMax, fuseNever, fuseHalf, fuseAlways, ...), and modifiers joined with '+':
 *   kit:<item or relic id>   stat:<stat> (three free tier I picks)   add:<stat>=<n>   hz:<0-5>   every:<ticks>
 * for example  default+hz:3  or  tank+kit:anvil.
 */
export function policy(name: string): Setup {
  const parts = name.split('+');
  const out: Setup = { name };
  for (const part of parts) {
    const [kind, arg] = part.split(':');
    if (kind === 'kit') out.kit = [...(out.kit ?? []), BASE_ITEM[arg] ?? RELIC[arg]];
    else if (kind === 'stat') out.startStats = { ...out.startStats, [arg]: 3 * UPGRADE_VALUE[arg as StatId][0] };
    else if (kind === 'add') { const [st, v] = arg.split('='); out.startStats = { ...out.startStats, [st]: Number(v) }; }
    else if (kind === 'hz') out.hazard = Number(arg);
    else if (kind === 'every') out.every = Number(arg);
    else Object.assign(out, basePolicy(part), { name });
  }
  return out;
}
export const FIXED_NAMES = Object.keys(POLICIES);

export interface Rec {
  pol: string; ch: string; seed: number; won: boolean; endWave: number; killedBy: string; level: number; secs: number;
  weapons: [string, number][]; items: string[]; fusedHeld: number;
  buy: string[]; up: string[]; flat: number[]; sp: Record<string, number>;
  dmgBy: Record<string, number>; hurtBy: Record<string, number>;
  /** Per wave, index = wave - 1. */
  taken: number[]; minHp: number[]; workT: number[]; hurtWork: number[]; kills: number[]; dealt: number[]; peak: number[]; waveSecs: number[];
  /** At the bench after wave 8: weapons held, most copies of one weapon, most of one class. -1 if not reached. */
  w8: [number, number, number];
  gathered: number; muled: number; rawsHeld: number; scripEarned: number; scripHeld: number;
  bossKilled: boolean; bossT: number; diedWorking: boolean;
  bench: BenchLog[]; fusions: number;
}

const itemLabel = (it: ItemSpec) => (BASE_ITEM[it.id] || it.relic ? it.id : 'F:' + it.effects.map((e) => `${e.p}${e.l}${e.neg ? '-' : ''}`).join(','));

export function playPolicy(ch: CharacterId, seed: number, pol: Setup): Rec {
  const run: Run = createRun({ seed, character: ch, startWeapon: pol.startWeapon, kit: pol.kit, hazard: pol.hazard });
  if (pol.startStats) {
    for (const s of STATS) run.player.base[ST[s]] += pol.startStats[s] ?? 0;
    rebuild(run);
    run.player.hp = run.player.maxHp;
  }
  const bot = createBot(seed ^ 0x5bd1e995, true, pol);
  const input: StepInput = { mx: 0, my: 0 };
  const W = run.totalWaves;
  const z = () => new Array(W).fill(0);
  const taken = z(), minHp = new Array(W).fill(1), workT = z(), hurtWork = z(), kills = z(), dealt = z(), peak = z(), waveSecs = z();
  const hurtBy: Record<string, number> = {};
  let wasWorking = false, lastTaken = 0, lastKills = 0, lastDealt = 0, bossT = 0, diedWorking = false;
  let w8: [number, number, number] = [-1, -1, -1];
  const sumDealt = () => { let n = 0; for (let i = 0; i < run.dmgBy.length; i++) n += run.dmgBy[i]; return n; };
  for (let guard = 0; guard < 400000 && run.phase !== 'over'; guard++) {
    if (run.phase === 'wave') {
      const w = run.wave - 1;
      botInput(run, bot, input);
      step(run, input);
      const p = run.player;
      const d = run.damageTaken - lastTaken;
      if (d > 0) {
        taken[w] += d; lastTaken = run.damageTaken;
        if (wasWorking) hurtWork[w] += d;
        const q = run.events;
        for (let i = 0; i < q.n; i++) if (q.list[i].type === 'hurt') { const id = ENEMIES[q.list[i].b]?.id ?? '?'; hurtBy[id] = (hurtBy[id] ?? 0) + q.list[i].a; }
      }
      clearEvents(run);
      if ((run.phase as string) === 'over' && !run.won) diedWorking = wasWorking;
      wasWorking = p.workingNode !== -1;
      if (wasWorking) workT[w] += 1 / 60;
      const f = p.hp / p.maxHp;
      if (f < minHp[w]) minHp[w] = f;
      if (run.enemyCount > peak[w]) peak[w] = run.enemyCount;
      if (run.phase !== 'wave') {
        waveSecs[w] = run.waveTime;
        kills[w] = run.kills - lastKills; lastKills = run.kills;
        const sd = sumDealt(); dealt[w] = sd - lastDealt; lastDealt = sd;
        if (w === W - 1) bossT = run.waveTime;
        wasWorking = false;
      }
    } else {
      botBench(run, bot);
      if (run.bench.index === 8) {
        const p = run.player;
        let cop = 0, cls = 0;
        for (let i = 0; i < WEAPONS.length; i++) if (p.copies[i] > cop) cop = p.copies[i];
        for (let i = 0; i < 4; i++) if (p.classCount[i] > cls) cls = p.classCount[i];
        w8 = [p.weapons.length, cop, cls];
      }
      nextWave(run);
    }
  }
  const p = run.player;
  const dmgBy: Record<string, number> = {};
  for (let i = 0; i < run.dmgBy.length; i++) if (run.dmgBy[i] > 0) dmgBy[SOURCE_IDS[i]] = Math.round(run.dmgBy[i]);
  const sp: Record<string, number> = {};
  for (const it of p.items) for (const e of it.effects) if (!STATS.includes(e.p as StatId)) sp[e.p] = (sp[e.p] ?? 0) + e.l;
  const r3 = (a: number[]) => a.map((v) => Math.round(v * 1000) / 1000);
  return {
    pol: pol.name ?? 'default', ch, seed, won: run.won, endWave: run.won ? W : run.deathWave, killedBy: run.killedBy, level: p.level,
    secs: Math.round(run.tick / 60),
    weapons: p.weapons.map((w) => [w.id, w.tier]), items: p.items.map(itemLabel), fusedHeld: p.items.filter((it) => !BASE_ITEM[it.id] && !it.relic).length,
    buy: run.buyLog.slice(), up: run.upgradeLog.slice(), flat: Array.from(p.flat, (v) => Math.round(v * 10) / 10), sp,
    dmgBy, hurtBy,
    taken: r3(taken), minHp: r3(minHp), workT: r3(workT), hurtWork: r3(hurtWork), kills, dealt: r3(dealt), peak, waveSecs: r3(waveSecs), w8,
    gathered: run.gathered.timber + run.gathered.ore + run.gathered.hide, muled: run.mule.timber + run.mule.ore + run.mule.hide,
    rawsHeld: p.raws.timber + p.raws.ore + p.raws.hide, scripEarned: run.scripEarned, scripHeld: p.scrip,
    bossKilled: run.bossDead, bossT: Math.round(bossT * 10) / 10, diedWorking,
    bench: bot.log, fusions: run.fusions.length,
  };
}

export { BASE_ITEMS, WEAPONS };
