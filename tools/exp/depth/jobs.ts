// Run a suite of worker jobs, four at a time. Skips jobs whose output exists.
//   npx tsx tools/exp/depth/jobs.ts <suite ...>     suites: base strategies controls stack stats hazard matrix kits relics  (or: all). CONC=n sets the parallelism. SKIP=pol__char,... leaves jobs out.
import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATS } from '../../../src/shared/vocab.ts';
import { STRATEGIES } from '../../../src/sim/bot.ts';
import { BASE_ITEMS, CHARS, WEAPONS } from './harness.ts';

const here = dirname(fileURLToPath(import.meta.url));
type Job = [pol: string, ch: string, seeds: number];
const on = (ch: string, n: number, names: string[]): Job[] => names.map((p) => [p, ch, n] as Job);
const SUITES: Record<string, Job[]> = {
  // The default bot on every character.
  base: CHARS.map((c) => ['default', c, 200] as Job),
  // Every named strategy in src/sim/bot.ts on the plain character, 200 seeds each.
  strategies: on('greenhorn', 200, STRATEGIES.slice()),
  // Controls and ablations.
  controls: on('greenhorn', 200, ['fuseNever', 'fuseHalf', 'fuseAlways', 'gatherMax', 'noReroll', 'noTierUp', 'randomBuy', 'randomAll', 'afk', 'circle']),
  // One weapon type only.
  stack: WEAPONS.map((w) => [`stack:${w.id}`, 'greenhorn', 200] as Job),
  // Each stat, three tier I picks for free at the start.
  stats: STATS.map((s) => [`default+stat:${s}`, 'greenhorn', 150] as Job),
  // The hazard ladder.
  hazard: [1, 2, 3, 4, 5].map((h) => [`default+hz:${h}`, 'greenhorn', 200] as Job),
  // Strategy x character.
  matrix: CHARS.filter((c) => c !== 'greenhorn').flatMap((c) => on(c, 100, ['melee', 'ranged', 'gatherer', 'tank', 'evade', 'economy'])),
  // Each authored item, handed over as a kit at the start.
  kits: BASE_ITEMS.map((i) => [`default+kit:${i.id}`, 'greenhorn', 100] as Job),
  // Each relic that acts inside a run.
  relics: ['orderbook', 'hideblind', 'seedcorn', 'companydraft', 'brandyflask', 'saddlescabbard'].map((r) => [`default+kit:${r}`, 'greenhorn', 200] as Job),
};
const want = process.argv.slice(2);
const conc = Number(process.env.CONC ?? 4);
const names = want.length === 0 || want[0] === 'all' ? Object.keys(SUITES) : want;
const skip = (process.env.SKIP ?? '').split(',');
const queue: Job[] = names.flatMap((n) => SUITES[n]).filter(([p, c]) => !skip.includes(`${p}__${c}`) && !existsSync(join(here, 'out', `${p.replace(/[:=+]/g, '-')}__${c}.jsonl`)));
console.log(`${queue.length} jobs`);
let live = 0;
const next = () => {
  while (live < conc && queue.length) {
    const [p, c, n] = queue.shift()!;
    // A lock file per job lets several drivers share one queue.
    const stem = join(here, 'out', `${p.replace(/[:=+]/g, '-')}__${c}`);
    if (existsSync(stem + '.jsonl') || existsSync(stem + '.lock')) continue;
    writeFileSync(stem + '.lock', String(process.pid));
    live++;
    const k = spawn(process.execPath, [...process.execArgv, join(here, 'worker.ts'), p, c, String(n)], { stdio: ['ignore', 'inherit', 'inherit'], detached: true });
    k.on('exit', () => { live--; next(); });
  }
};
next();
