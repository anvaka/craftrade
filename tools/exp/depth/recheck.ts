// The sim under src/ was edited by others while the suite ran (relics, 13:10 UTC).
// This replays stored runs on the current sim and reports any that differ.
//   npx tsx tools/exp/depth/recheck.ts [seeds=15]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CharacterId } from '../../../src/shared/protocol.ts';
import { playPolicy, policy, type Rec } from './harness.ts';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
const n = Number(process.argv[2] ?? 15);
let bad = 0, total = 0;
for (const [pol, ch] of [['default', 'greenhorn'], ['default', 'tinker'], ['glass', 'greenhorn'], ['gatherMax', 'greenhorn'], ['fuseProcAlways', 'greenhorn'], ['kit:burrs', 'greenhorn']]) {
  const old = readFileSync(join(OUT, `${pol.replace(':', '-')}__${ch}.jsonl`), 'utf8').trim().split('\n').slice(0, n).map((l) => JSON.parse(l) as Rec);
  for (const o of old) {
    const r = await playPolicy(ch as CharacterId, o.seed, policy(pol));
    total++;
    if (r.won !== o.won || r.secs !== o.secs || r.buy.join() !== o.buy.join() || r.scripEarned !== o.scripEarned) { bad++; console.log('DIFFERS', pol, ch, o.seed); }
  }
}
console.log(bad ? `${bad} of ${total} stored runs differ on the current sim` : `all ${total} stored runs replay identically on the current sim`);
