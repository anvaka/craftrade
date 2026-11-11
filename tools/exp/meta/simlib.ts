// Helpers that need only the sim: skills, the headless player, small statistics. No server import, so
// experiments that only play runs keep working while the server is being changed.
import {
  createBot, botInput, botBench, createRun, step, clearEvents, nextWave, fuseCost, applyFusion, type Run,
} from '../../../src/sim/index.ts';
import { itemPoints, itemTier, type ItemSpec } from '../../../src/shared/item.ts';
import type { StationId } from '../../../src/shared/protocol.ts';

export const pts = (i: ItemSpec) => itemPoints(i.effects);

export interface Skill { name: string; every: number; noise: number }
export const SKILLS: Record<string, Skill> = {
  expert: { name: 'expert', every: 3, noise: 0 },
  average: { name: 'average', every: 8, noise: 0.06 },
  novice: { name: 'novice', every: 16, noise: 0.15 },
};

let nrng = 12345;
const nr = () => { nrng = (Math.imul(nrng, 1664525) + 1013904223) >>> 0; return nrng / 4294967296; };

/** Play a run headless. `fuseVia` asks the server what a pair becomes (in-run fusion), or null to skip fusing. */
export async function playSim(
  opts: { seed: number; character: any; waves?: number; kit?: ItemSpec[]; stations?: Partial<Record<StationId, number>> },
  skill: Skill, botSeed: number,
  fuseVia: ((a: ItemSpec, b: ItemSpec) => Promise<ItemSpec | null>) | null = null,
): Promise<Run> {
  const run = createRun(opts);
  const bot = createBot(botSeed, false);
  bot.every = skill.every;
  const input = { mx: 0, my: 0 };
  let hold = 0, hx = 0, hy = 0;
  for (let g = 0; g < 300000 && run.phase !== 'over'; g++) {
    if (run.phase === 'wave') {
      botInput(run, bot, input);
      if (skill.noise > 0) {
        // A mistake: walk a random way for a third of a second.
        if (hold > 0) { hold--; input.mx = hx; input.my = hy; }
        else if (run.tick % 20 === 0 && nr() < skill.noise) { const a = nr() * 6.283; hx = Math.cos(a); hy = Math.sin(a); hold = 20; }
      }
      step(run, input); clearEvents(run);
    } else {
      botBench(run, bot);
      if (fuseVia && run.player.items.length >= 2 && nr() < 0.5) {
        const p = run.player; let a = -1, c = -1;
        for (let i = 0; i < p.items.length; i++) {
          if (itemTier(p.items[i]) > 2) continue;
          if (a < 0) a = i; else if (c < 0 && p.items[i].id !== p.items[a].id) c = i;
        }
        if (a >= 0 && c >= 0 && !fuseCost(run, a, c).block) {
          const res = await fuseVia(p.items[a], p.items[c]);
          if (res) applyFusion(run, a, c, res);
        }
      }
      nextWave(run);
    }
  }
  return run;
}

export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const median = (a: number[]) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
export function table(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${cols.map((c) => String(r[c])).join(' | ')} |`)].join('\n');
}
