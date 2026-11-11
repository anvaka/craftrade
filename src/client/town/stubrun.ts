// A stand-in for the run, kept for tests and for working on the town
// without the game half. It is used when the page is opened with ?stubrun=1
// or when src/client/game/index.ts does not exist yet.
//
// It shows the ticket and three ways to end: win, die late, die at once.
// Each produces a RunRecap the server's report checks accept, given enough
// time on the clock (the server refuses reports that arrive sooner than the
// waves could have been played; dying on wave 1 is always accepted).

import { BASE_ITEMS } from '../../shared/content/items.ts';
import { itemTier, type ItemSpec } from '../../shared/item.ts';
import type { RawBag } from '../../shared/vocab.ts';
import type { MountRun, RunHost, RunRecap } from '../seam.ts';
import { el, stamp } from './dom.ts';

export const mountRun: MountRun = (host: RunHost) => {
  const t = host.ticket;
  const started = performance.now();
  let over = false;
  // Small seeded picker so each ticket carries different things home.
  let s = t.seed >>> 0 || 1;
  const rnd = (n: number): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % n;
  };
  const cheap = BASE_ITEMS.filter((i) => itemTier(i) <= 2);
  const held: ItemSpec[] = [...t.kit];
  for (let i = 0; i < 4; i++) held.push(cheap[rnd(cheap.length)]!);
  const fusions: [string, string, string][] = [];

  const log = el('p', 'note', 'Nothing fused yet.');
  log.dataset.stub = 'log';

  const finish = (wavesCleared: number, killedBy: string | null): RunRecap => {
    const won = wavesCleared >= t.waves;
    const attempted = Math.min(t.waves, wavesCleared + 1);
    const perWave = (n: number): number => Math.min(40 * attempted, n * attempted);
    const raws: RawBag = { timber: perWave(4), ore: perWave(3), hide: perWave(2) };
    const muleWaves = wavesCleared >= 8 ? 8 : wavesCleared >= 4 ? 4 : 0;
    const mule: RawBag = { timber: muleWaves * 2, ore: muleWaves, hide: muleWaves };
    const limit = Math.floor(wavesCleared / 4);
    // Fused items first: they are the ones worth carrying.
    const made = new Set(fusions.map((f) => f[2]));
    // Kit items stay out: the server only accepts bench items and items fused in this run.
    const own = held.filter((i) => !t.kit.includes(i));
    const order = [...own.filter((i) => made.has(i.id)), ...own.filter((i) => !made.has(i.id))];
    const carried = order.slice(0, limit);
    return {
      report: {
        wavesCleared,
        won,
        scripEarned: 60 * attempted + rnd(40),
        scripHeld: 12 * attempted,
        level: 1 + attempted,
        raws,
        mule,
        carry: carried.map((i) => i.id),
        kills: 30 * attempted,
        fusions,
      },
      killedBy,
      endWave: attempted,
      seconds: Math.round((performance.now() - started) / 1000),
      damageBy: [
        { id: 'sling', name: 'Sling', damage: 140 * attempted },
        { id: 'hatchet', name: 'Hatchet', damage: 95 * attempted },
      ],
      damageTaken: 9 * attempted,
      rawsGathered: { timber: raws.timber + mule.timber, ore: raws.ore + mule.ore, hide: raws.hide + mule.hide },
      items: held,
      carried,
    };
  };

  const end = (wavesCleared: number, killedBy: string | null, quit = false): void => {
    if (over) return;
    over = true;
    const recap = finish(Math.min(wavesCleared, t.waves), killedBy);
    if (quit) recap.report.quit = true;
    host.onEnd(recap);
    if (quit) host.onQuit();
  };

  const fuseTwo = async (): Promise<void> => {
    const pool = held.filter((i) => itemTier(i) < 4);
    const a = pool[rnd(pool.length)];
    const b = pool.find((i) => i.id !== a?.id);
    if (!a || !b) {
      log.textContent = 'Nothing left that will fuse.';
      return;
    }
    log.textContent = `Fusing ${a.name} and ${b.name}.`;
    const out = await host.fuse(a.id, b.id);
    if (over) return;
    if (!out.ok) {
      log.textContent = `${out.code}: ${out.message}`;
      return;
    }
    held.splice(held.indexOf(a), 1);
    held.splice(held.indexOf(b), 1);
    held.push(out.res.item);
    fusions.push([a.id, b.id, out.res.item.id]);
    log.textContent = `${a.name} + ${b.name} = ${out.res.item.name}${out.res.first ? ', a first find' : `, first made by ${out.res.by}`}.`;
  };

  const late = Math.min(4, t.waves - 1);
  const page = el(
    'div',
    'page stub-run',
    el(
      'header',
      'page-head',
      el('div', '', el('div', 'label', 'Stand-in for the run'), el('h1', '', `${t.character}, ${host.mode}`)),
      el('div', 'meta', el('span', 'note num', `seed ${t.seed}, ${t.waves} waves${host.firstRun ? ', first run' : ''}`)),
    ),
    el('p', '', `Kit: ${t.kit.length ? t.kit.map((i) => i.name).join(', ') : 'none'}.`),
    log,
    el(
      'div',
      'stamps',
      stamp(`Win at wave ${t.waves}`, { key: 'stub:win', onClick: () => end(t.waves, null) }),
      stamp(`Die at wave ${late + 1}`, { cls: 'stamp--plain', key: 'stub:late', onClick: () => end(late, 'Boar') }),
      stamp('Die at wave 1', { cls: 'stamp--plain', key: 'stub:early', onClick: () => end(0, 'Mite') }),
      stamp('Fuse two', { cls: 'stamp--plain', key: 'stub:fuse', onClick: () => void fuseTwo() }),
      stamp('Quit', { cls: 'stamp--plain', key: 'stub:quit', onClick: () => end(0, null, true) }),
    ),
  );
  host.root.append(page);
  (page.querySelector('[data-fk="stub:win"]') as HTMLElement | null)?.focus();

  return {
    destroy(): void {
      over = true;
      page.remove();
    },
  };
};
