import type { ItemSpec } from '../src/shared/item.ts';
import type { CharacterId } from '../src/shared/protocol.ts';
import { ENEMY_INDEX } from '../src/sim/data/enemies.ts';
import { killEnemy, rebuild, spawnEnemy } from '../src/sim/core.ts';
import { clearEvents, createRun, step } from '../src/sim/run.ts';
import { ES, type Run } from '../src/sim/types.ts';

export const testItem = (p: string, l = 3, neg = false): ItemSpec => ({
  id: `test-${p}-${l}${neg ? 'n' : ''}`, name: 'Test item', glyph: 'ring', tags: ['test'],
  effects: neg ? [{ p, l, neg: true }] : [{ p, l }],
});

/** A run with no spawns and no nodes, for controlled experiments. */
export function quietRun(kit: ItemSpec[] = [], character: CharacterId = 'greenhorn', seed = 5, startWeapon?: string): Run {
  const run = createRun({ seed, character, kit, startWeapon });
  hush(run);
  return run;
}

export function hush(run: Run): void {
  run.groupNext.fill(1e9);
  run.eliteSpawned = true;
  for (let i = 0; i < run.enemies.length; i++) killEnemy(run, i, false);
  for (const n of run.nodes) n.alive = false;
  for (const k of run.pickups) k.alive = false;
  run.waveSeconds = 1e9;
}

/** Put a live, awake enemy at (x, y) relative to the player. */
export function place(run: Run, id: string, dx: number, dy: number, hp?: number): number {
  const i = spawnEnemy(run, ENEMY_INDEX[id], run.player.x + dx, run.player.y + dy, 0);
  const e = run.enemies[i];
  e.state = ES.Move; e.t = 0;
  if (hp !== undefined) { e.hp = e.maxHp = hp; }
  return i;
}

/** A target that stands where it is put and never attacks. */
export function dummy(run: Run, dx: number, dy: number, hp = 1e6, id = 'boar'): number {
  const i = place(run, id, dx, dy, hp);
  run.enemies[i].state = ES.Recover; run.enemies[i].t = 1e9;
  return i;
}

export function ticks(run: Run, n: number, mx = 0, my = 0, each?: (run: Run) => void): void {
  for (let i = 0; i < n && run.phase === 'wave'; i++) { step(run, { mx, my }); if (each) each(run); clearEvents(run); }
}

export function disarm(run: Run): void { run.player.weapons.length = 0; rebuild(run); }

/** Count events of a type over n ticks. */
export function countEvents(run: Run, n: number, type: string): number {
  let c = 0;
  ticks(run, n, 0, 0, (r) => { for (let i = 0; i < r.events.n; i++) if (r.events.list[i].type === type) c++; });
  return c;
}
