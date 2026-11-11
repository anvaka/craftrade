// Build a patched copy of src/sim + src/shared so constants can be overridden without touching src/.
//   node tools/exp/fun/mkvariant.mjs <outDir> 'sim/data/tuning.ts::PLAYER_BASE_HP = 10::PLAYER_BASE_HP = 14' ...
// Each patch is file::search::replace (literal, every occurrence). Fails if the search text is absent.
import { cpSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [out, ...patches] = process.argv.slice(2);
const src = resolve(new URL('../../../src', import.meta.url).pathname);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(src, 'sim'), join(out, 'sim'), { recursive: true });
cpSync(join(src, 'shared'), join(out, 'shared'), { recursive: true });
for (const p of patches) {
  const [file, search, replace] = p.split('::');
  const path = join(out, file);
  const text = readFileSync(path, 'utf8');
  if (!text.includes(search)) { console.error(`patch not found in ${file}: ${search}`); process.exit(1); }
  writeFileSync(path, text.split(search).join(replace));
}
writeFileSync(join(out, 'PATCHES.txt'), patches.join('\n') + '\n');
console.log(`variant at ${out}: ${patches.length} patches`);
