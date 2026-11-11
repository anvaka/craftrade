// One job: play `seeds` runs of one policy on one character and write a JSONL file.
//   npx tsx tools/exp/depth/worker.ts <policy> <character> <seeds> [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CharacterId } from '../../../src/shared/protocol.ts';
import { playPolicy, policy, seedOf } from './harness.ts';

const [polName, ch, seedsArg, outArg] = process.argv.slice(2);
const seeds = Number(seedsArg ?? 200);
const out = outArg ?? join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(out, { recursive: true });
const pol = policy(polName);
const lines: string[] = [];
let wins = 0;
for (let s = 1; s <= seeds; s++) {
  const r = await playPolicy(ch as CharacterId, seedOf(s), pol);
  if (r.won) wins++;
  lines.push(JSON.stringify(r));
}
writeFileSync(join(out, `${polName.replace(/[:=+]/g, '-')}__${ch}.jsonl`), lines.join('\n') + '\n');
console.log(`${polName} ${ch}: ${wins}/${seeds} = ${((100 * wins) / seeds).toFixed(1)}%`);
