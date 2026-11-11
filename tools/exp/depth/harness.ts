// Shared harness for the depth experiments: the policy registry, an instrumented
// run loop, and the record written per run. Nothing here edits src/.
import { BASE_ITEM, BASE_ITEMS } from '../../../src/shared/content/items.ts';
import { fusedItemId, recipeKey, type ItemSpec } from '../../../src/shared/item.ts';
import { PRIMITIVES, STATS, type StatId } from '../../../src/shared/vocab.ts';
import { ENEMIES } from '../../../src/sim/data/enemies.ts';
import { UPGRADE_VALUE } from '../../../src/sim/data/upgrades.ts';
import { SOURCE_IDS, WEAPONS, WEAPON_INDEX } from '../../../src/sim/data/weapons.ts';
import { ST, rebuild } from '../../../src/sim/core.ts';
import { clearEvents, createRun, nextWave, step, type StepInput } from '../../../src/sim/run.ts';
import type { Run } from '../../../src/sim/types.ts';
import type { CharacterId } from '../../../src/shared/protocol.ts';
import { ProceduralProvider, validatePick } from '../../../server/provider.ts';
import { botBench, botInput, createBot, type BenchLog, type Policy } from './pbot.ts';

export const CHARS: CharacterId[] = ['greenhorn', 'sawyer', 'smith', 'trapper', 'tinker', 'clerk'];
export const seedOf = (s: number) => s * 7919 + 13;

const provider = new ProceduralProvider();
const procCache = new Map<string, ItemSpec>();
/** The game's own no-model fusion path: ProceduralProvider -> validatePick -> fusedItemId. */
export async function procFuse(a: ItemSpec, b: ItemSpec, budget: number): Promise<ItemSpec> {
  const key = recipeKey(a.id, b.id);
  const hit = procCache.get(key);
  if (hit) return hit;
  const pick = await provider.propose(a, b, budget, key);
  const ok = validatePick(pick, budget, key)!;
  const out: ItemSpec = { id: fusedItemId(ok.effects), name: ok.names[0] ?? 'Fused lot', glyph: ok.glyph, tags: ok.tags, effects: ok.effects };
  procCache.set(key, out);
  return out;
}

const isMelee = (id: string) => WEAPONS[WEAPON_INDEX[id]].kind !== 'shot';
const isTool = (id: string) => !!WEAPONS[WEAPON_INDEX[id]].tool;

const FIXED: Record<string, Policy> = {
  default: {},
  // fusion
  nofuse: { fuse: 'never' },
  fuseProc: { fuse: 'proc' },
  fuseProcAlways: { fuse: 'procAlways' },
  fuseProcSmart: { fuse: 'procSmart' },
  fuseStandinAlways: { fuse: 'standinAlways' },
  // gathering
  gatherNever: { gather: 'never' },
  gatherMax: { gather: 'max' },
  gatherMaxNoMule: { gather: 'max', mule: 0 },
  gatherNeverNoMule: { gather: 'never', mule: 0 },
  nomule: { mule: 0 },
  // Raws handed out at every bench: separates the raw gate from the act of gathering.
  freeRaws: { freeRaws: true, mule: 0 },
  gatherNeverFreeRaws: { gather: 'never', freeRaws: true, mule: 0 },
  muleAll: { mule: 1 },
  // weapon constraints
  meleeOnly: { startWeapon: 'hatchet', weaponOk: isMelee },
  rangedOnly: { startWeapon: 'sling', weaponOk: (id) => !isMelee(id) },
  toolsOnly: { startWeapon: 'hatchet', weaponOk: isTool, gather: 'max', statW: { harvest: 1.5 }, specialW: { nodeBurst: 1.5, nodeHeal: 1.3, richNodes: 1.3 } },
  toolsHeavy: { gather: 'max', statW: { harvest: 1.6 }, weaponW: { hatchet: 2, pick: 2, knife: 2 }, specialW: { nodeBurst: 1.6, nodeHeal: 1.4, richNodes: 1.4, hoardTimber: 1.2, hoardOre: 1.2, hoardHide: 1.2 }, mule: 0 },
  // stat directions
  // Interest is capped (clerk 15 at 188 scrip held, items 20). Light: hold 10 x wave. Full: hold 190 from wave 5 to 9.
  hoardLight: { reserve: (run) => (run.wave <= 9 ? 10 * run.wave : 0), specialW: { interest: 2.0, killScrip: 1.5 } },
  hoardFull: { reserve: (run) => (run.wave >= 5 && run.wave <= 9 ? 190 : 0), specialW: { interest: 2.0, killScrip: 1.5 } },
  thorns: {
    statW: { armor: 1.8, maxHp: 1.6, mend: 1.3, dodge: 1.2, damage: 0.5, rate: 0.5, melee: 0.5, ranged: 0.5, crit: 0.3 },
    specialW: { thorns: 2.5, hurtBlast: 2.0, waveShield: 1.6, secondWind: 1.6, hoardOre: 1.5, hoardHide: 1.5 }, weaponW: { buckler: 2, maul: 1.5 },
  },
  tank: { statW: { armor: 1.8, maxHp: 1.8, mend: 1.5, dodge: 1.5 }, specialW: { waveShield: 1.6, secondWind: 1.6 } },
  glass: { statW: { damage: 1.8, rate: 1.8, crit: 1.4, melee: 1.5, ranged: 1.5, maxHp: 0.3, armor: 0.3, dodge: 0.3, mend: 0.2 } },
  // Follow-ups to the glass result: the same offence weights with a weapon constraint, and with defence at zero.
  glassMelee: { startWeapon: 'hatchet', weaponOk: isMelee, statW: { damage: 1.8, rate: 1.8, crit: 1.4, melee: 1.5, ranged: 1.5, maxHp: 0.3, armor: 0.3, dodge: 0.3, mend: 0.2 } },
  glassRanged: { startWeapon: 'sling', weaponOk: (id) => !isMelee(id), statW: { damage: 1.8, rate: 1.8, crit: 1.4, melee: 1.5, ranged: 1.5, maxHp: 0.3, armor: 0.3, dodge: 0.3, mend: 0.2 } },
  glassPure: { statW: { damage: 2, rate: 2, crit: 1.5, melee: 1.6, ranged: 1.6, maxHp: 0, armor: 0, dodge: 0, mend: 0, speed: 0.4, harvest: 0.2, luck: 0.2 }, specialW: { waveShield: 0, secondWind: 0, thorns: 0, movingDodge: 0, nodeHeal: 0 } },
  glassNoGather: { gather: 'never', freeRaws: true, mule: 0, statW: { damage: 1.8, rate: 1.8, crit: 1.4, melee: 1.5, ranged: 1.5, maxHp: 0.3, armor: 0.3, dodge: 0.3, mend: 0.2 } },
  evade: { statW: { speed: 1.6, dodge: 1.8 }, specialW: { movingDodge: 2.0 } },
  lucky: { statW: { luck: 2.0 }, specialW: { rerollCut: 1.2 } },
  burn: { specialW: { burn: 2.2 }, weaponW: { brand: 2.5 } },
  blast: { specialW: { killBlast: 2.2, hurtBlast: 1.2 } },
  // ablations of the bench
  noItems: { itemOk: () => false },
  noWeapons: { weaponOk: () => false },
  noBuy: { buy: 'none', fuse: 'never' },
  noBuyNoUp: { buy: 'none', fuse: 'never', upgrade: 'random' },
  randomBuy: { buy: 'random' },
  randomUpgrade: { upgrade: 'random' },
  randomAll: { buy: 'random', upgrade: 'random' },
  noReroll: { reroll: false },
  noLock: { lock: false },
  // ablations of movement
  afk: { move: 'still' },
  circle: { move: 'circle' },
  every9: { every: 9 },
  every18: { every: 18 },
  every30: { every: 30 },
};

/** What-if runs: change a data table in memory (never on disk) and play a registered policy against it. */
const WHATIF: Record<string, { base: string; apply: () => void }> = {
  'whatif-tusk2.5': { base: 'default', apply: () => { const t = ENEMIES.find((e) => e.id === 'tusk') as { hp: number; hpW: number }; t.hp *= 2.5; t.hpW *= 2.5; } },
  'whatif-tusk4': { base: 'default', apply: () => { const t = ENEMIES.find((e) => e.id === 'tusk') as { hp: number; hpW: number }; t.hp *= 4; t.hpW *= 4; } },
  'whatif-tusk4-glass': { base: 'glass', apply: () => { const t = ENEMIES.find((e) => e.id === 'tusk') as { hp: number; hpW: number }; t.hp *= 4; t.hpW *= 4; } },
  'whatif-thorns3': { base: 'thorns', apply: () => { const p = PRIMITIVES.find((x) => x.id === 'thorns') as unknown as { values: number[] }; p.values = p.values.map((v) => v * 3); } }, // the cap of 60 in SPECIAL_CAP still applies (read at module load), so this is "thorns at its cap from the first item"
};

export function policy(name: string): Policy {
  if (WHATIF[name]) { WHATIF[name].apply(); return { ...FIXED[WHATIF[name].base], name }; }
  if (FIXED[name]) return { ...FIXED[name], name };
  const [kind, arg] = name.split(':');
  if (kind === 'stack') return { name, startWeapon: arg, weaponOk: (id) => id === arg };
  if (kind === 'start') return { name, startWeapon: arg };
  if (kind === 'kit') return { name, kit: [BASE_ITEM[arg]] };
  if (kind === 'stat') return { name, startStats: { [arg]: 3 * UPGRADE_VALUE[arg as StatId][0] } };
  // add:damage=-4  adds an exact amount of one stat at the start.
  if (kind === 'add') { const [st, v] = arg.split('='); return { name, startStats: { [st]: Number(v) } }; }
  throw new Error(`unknown policy ${name}`);
}
export const FIXED_NAMES = Object.keys(FIXED);

export interface Rec {
  pol: string; ch: string; seed: number; won: boolean; endWave: number; killedBy: string; level: number; secs: number;
  weapons: [string, number][]; items: string[]; fusedHeld: number;
  buy: string[]; up: string[]; flat: number[]; sp: Record<string, number>;
  dmgBy: Record<string, number>; hurtBy: Record<string, number>;
  /** Per wave, index = wave - 1. */
  taken: number[]; minHp: number[]; workT: number[]; hurtWork: number[]; kills: number[]; dealt: number[]; left: number[]; peak: number[]; waveSecs: number[];
  maxHpW: number[];
  gathered: number; muled: number; rawsHeld: number; scripEarned: number; scripHeld: number;
  bossKilled: boolean; bossT: number; diedWorking: boolean;
  bench: BenchLog[]; fusions: number;
}

const itemLabel = (it: ItemSpec) => (BASE_ITEM[it.id] ? it.id : 'F:' + it.effects.map((e) => `${e.p}${e.l}${e.neg ? '-' : ''}`).join(','));

export async function playPolicy(ch: CharacterId, seed: number, pol: Policy): Promise<Rec> {
  const run: Run = createRun({ seed, character: ch, startWeapon: pol.startWeapon, kit: pol.kit });
  if (pol.startStats) {
    for (const s of STATS) run.player.base[ST[s]] += pol.startStats[s] ?? 0;
    rebuild(run);
    run.player.hp = run.player.maxHp;
  }
  const bot = createBot(seed ^ 0x5bd1e995, true, pol);
  const input: StepInput = { mx: 0, my: 0 };
  const W = run.totalWaves;
  const z = () => new Array(W).fill(0);
  const taken = z(), minHp = new Array(W).fill(1), workT = z(), hurtWork = z(), kills = z(), dealt = z(), left = z(), peak = z(), waveSecs = z(), maxHpW = z();
  const hurtBy: Record<string, number> = {};
  let wasWorking = false, lastTaken = 0, lastKills = 0, lastDealt = 0, count = 0, bossT = 0, diedWorking = false;
  const sumDealt = () => { let n = 0; for (let i = 0; i < run.dmgBy.length; i++) n += run.dmgBy[i]; return n; };
  for (let guard = 0; guard < 400000 && run.phase !== 'over'; guard++) {
    if (run.phase === 'wave') {
      const w = run.wave - 1;
      count = run.enemyCount;
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
        left[w] = count; waveSecs[w] = run.waveTime; maxHpW[w] = p.maxHp;
        kills[w] = run.kills - lastKills; lastKills = run.kills;
        const sd = sumDealt(); dealt[w] = sd - lastDealt; lastDealt = sd;
        if (w === W - 1) bossT = run.waveTime;
        wasWorking = false;
      }
    } else {
      await botBench(run, bot, procFuse);
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
    weapons: p.weapons.map((w) => [w.id, w.tier]), items: p.items.map(itemLabel), fusedHeld: p.items.filter((it) => !BASE_ITEM[it.id]).length,
    buy: run.buyLog.slice(), up: run.upgradeLog.slice(), flat: Array.from(p.flat, (v) => Math.round(v * 10) / 10), sp,
    dmgBy, hurtBy,
    taken: r3(taken), minHp: r3(minHp), workT: r3(workT), hurtWork: r3(hurtWork), kills, dealt: r3(dealt), left, peak, waveSecs: r3(waveSecs), maxHpW,
    gathered: run.gathered.timber + run.gathered.ore + run.gathered.hide, muled: run.mule.timber + run.mule.ore + run.mule.hide,
    rawsHeld: p.raws.timber + p.raws.ore + p.raws.hide, scripEarned: run.scripEarned, scripHeld: p.scrip,
    bossKilled: run.bossDead, bossT: Math.round(bossT * 10) / 10, diedWorking,
    bench: bot.log, fusions: run.fusions.length,
  };
}

export { BASE_ITEMS, WEAPONS };
