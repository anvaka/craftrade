// Run a suite of worker jobs, four at a time. Skips jobs whose output exists.
//   npx tsx tools/exp/depth/jobs.ts <suite ...>     suites: base strategies stack stats matrix kits extra  (or: all). CONC=n sets the parallelism. SKIP=pol__char,... leaves jobs out.
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATS } from '../../../src/shared/vocab.ts';
import { BASE_ITEMS, CHARS, FIXED_NAMES, WEAPONS } from './harness.ts';

const here = dirname(fileURLToPath(import.meta.url));
type Job = [pol: string, ch: string, seeds: number];
const on = (ch: string, n: number, names: string[]): Job[] => names.map((p) => [p, ch, n] as Job);
const SUITES: Record<string, Job[]> = {
  // 1, 5, 6, 7: the shipped bot on every character.
  base: CHARS.map((c) => ['default', c, 200] as Job),
  // 2, 3, 4: forced strategies and ablations on the plain character, 200 seeds each.
  strategies: on('greenhorn', 200, ['nofuse', 'gatherNever', 'gatherMax', 'meleeOnly', 'rangedOnly', 'noBuy', 'randomAll', 'afk',
    'fuseProc', 'fuseProcAlways', 'fuseProcSmart', 'toolsHeavy', 'toolsOnly', 'thorns', 'tank', 'glass', 'evade', 'hoardLight', 'hoardFull',
    'noItems', 'noWeapons', 'randomBuy', 'randomUpgrade', 'noReroll', 'nomule', 'circle', 'every18', 'freeRaws', 'gatherNeverFreeRaws']),
  // 2: one weapon type only.
  stack: WEAPONS.map((w) => [`stack:${w.id}`, 'greenhorn', 200] as Job),
  // 1: each stat, three tier I picks for free at the start.
  stats: STATS.map((s) => [`stat:${s}`, 'greenhorn', 150] as Job),
  // 5: strategy x character interaction.
  glass: [...on('greenhorn', 200, ['glassMelee', 'glassRanged', 'glassPure']), ...CHARS.filter((c) => c !== 'greenhorn').map((c) => ['glass', c, 100] as Job), ['glassNoGather', 'greenhorn', 200]],
  matrix2: CHARS.filter((c) => c !== 'greenhorn').flatMap((c) => on(c, 100, ['toolsHeavy', 'thorns', 'nofuse'])),
  matrix: CHARS.filter((c) => c !== 'greenhorn').flatMap((c) => on(c, 100, ['meleeOnly', 'rangedOnly'])),
  // 1: each authored item, handed over as a kit at the start.
  kits: BASE_ITEMS.map((i) => [`kit:${i.id}`, 'greenhorn', 100] as Job),
  // The items the shipped bot buys in under 10% of runs, so the buy log says nothing about them.
  kitsRare: ['lodestone', 'tallybook', 'burrs', 'rabbitfoot', 'fishhook', 'springsteel', 'smellingsalts', 'ballastbelt', 'timbersledge', 'hidebundle', 'tripod',
    'quarrycharge', 'coiledspring', 'favourlist', 'prospectorpan', 'surveyorglass', 'skippingstones', 'blastingkit', 'anvil', 'factorseal', 'forgebellows', 'pitch']
    .map((i) => [`kit:${i}`, 'greenhorn', 100] as Job),
  // Extras, run only if there is time.
  extra: [...on('greenhorn', 200, FIXED_NAMES), ...WEAPONS.map((w) => [`start:${w.id}`, 'greenhorn', 200] as Job)],
};
const want = process.argv.slice(2);
const conc = Number(process.env.CONC ?? 4);
const names = want.length === 0 || want[0] === 'all' ? Object.keys(SUITES) : want;
const skip = (process.env.SKIP ?? '').split(',');
const queue: Job[] = names.flatMap((n) => SUITES[n]).filter(([p, c]) => !skip.includes(`${p}__${c}`) && !existsSync(join(here, 'out', `${p.replace(':', '-')}__${c}.jsonl`)));
console.log(`${queue.length} jobs`);
let live = 0;
const next = () => {
  while (live < conc && queue.length) {
    const [p, c, n] = queue.shift()!;
    // A lock file per job lets several drivers share one queue.
    const stem = join(here, 'out', `${p.replace(':', '-')}__${c}`);
    if (existsSync(stem + '.jsonl') || existsSync(stem + '.lock')) continue;
    writeFileSync(stem + '.lock', String(process.pid));
    live++;
    const k = spawn(process.execPath, [...process.execArgv, join(here, 'worker.ts'), p, c, String(n)], { stdio: ['ignore', 'inherit', 'inherit'], detached: true });
    k.on('exit', () => { live--; next(); });
  }
};
next();
