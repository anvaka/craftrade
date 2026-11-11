// Standalone harness for the run, served by Vite at /play.html. Not shipped.
//
//   ?seed=123        run seed (default 1)
//   ?char=sawyer     character (default greenhorn)
//   ?waves=8         8 or 12 (default 12)
//   ?wave=7          the bot plays forward to the start of wave 7
//   ?bench=4         or to the bench after wave 4
//   ?bot=1           the bot steers during waves      ?auto=1  and plays every bench too
//   ?god=1           health is topped up every tick
//   ?stuff=300       keep this many enemies alive (perf test)
//   ?perf=1          print frame-time percentiles every 5 s (perf=2 also forces rasterisation into the measured span)
//   ?slow=8          run time 8 times slower, to look at single frames
//   ?first=1         a new device: teaching lines, nothing learned (first=keep: teach, keep what was learned)
//   ?fuse=first|known|fail|slow   what the fake server answers (default: first, 1.2 s)
//   ?kit=1           start with two kit items
import { bakeAll } from '../art/index.ts';
import { audio } from '../audio/index.ts';
import { BASE_ITEMS } from '../../shared/content/items.ts';
import { fusionBudget, type ItemSpec } from '../../shared/item.ts';
import type { CharacterId, Profile } from '../../shared/protocol.ts';
import { ARENA_H, ARENA_W, ENEMIES, ES, MAX_ENEMIES, standInFusion, type Run } from '../../sim/index.ts';
import type { FuseOutcome, RunHost } from '../seam.ts';
import { mount } from './mount.ts';
import { forget } from './progress.ts';

const q = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (q.has(k) ? Number(q.get(k)) || d : d);
const seed = num('seed', 1);
const character = (q.get('char') ?? 'greenhorn') as CharacterId;
const waves = num('waves', 12) === 8 ? 8 : 12;
const profile: Profile = {
  name: 'Odd Hale', marks: 0, raws: { timber: 0, ore: 0, hide: 0 }, items: [], runs: 0, wins: 0, characters: [character],
  features: [], standing: 0, novelLeft: 20, daysPlayed: 1, finds: 0,
};
const byId = new Map<string, ItemSpec>(BASE_ITEMS.map((i) => [i.id, i]));
let live: Run | null = null;
const known = new Set<string>();

function fuse(a: string, b: string): Promise<FuseOutcome> {
  const mode = q.get('fuse') ?? 'first';
  const wait = mode === 'slow' ? 6000 : 1200;
  return new Promise((resolve) => {
    setTimeout(() => {
      if (mode === 'fail') { resolve({ ok: false, code: 'model_down', message: 'The assay office cannot be reached. Nothing was used.' }); return; }
      const A = byId.get(a) ?? live?.player.items.find((i) => i.id === a);
      const B = byId.get(b) ?? live?.player.items.find((i) => i.id === b);
      if (!A || !B) { resolve({ ok: false, code: 'unknown_item', message: 'The anvil does not know that item.' }); return; }
      const item = standInFusion(A, B, fusionBudget(A, B));
      byId.set(item.id, item);
      const key = a < b ? `${a}+${b}` : `${b}+${a}`;
      const first = mode !== 'known' && !known.has(key);
      known.add(key);
      const by = first ? profile.name : 'millpond';
      resolve({ ok: true, res: { item: { ...item, by }, first, newToYou: true, by } });
    }, wait);
  });
}

// Keep the pool full of ordinary enemies around the player, for the perf run.
let stuffN = num('stuff', 0);
function stuff(run: Run): void {
  if (run.enemyCount >= stuffN) return;
  const p = run.player;
  for (let i = 0; i < MAX_ENEMIES && run.enemyCount < stuffN; i++) {
    const e = run.enemies[i];
    if (e.alive) continue;
    const type = [0, 0, 0, 1, 1, 2, 3, 6][(run.nextUid * 7) % 8];
    const def = ENEMIES[type];
    const a = (run.nextUid * 2.399) % 6.2832, d = 220 + ((run.nextUid * 97) % 420);
    e.alive = true; e.uid = run.nextUid++; e.type = type;
    e.x = e.px = Math.max(30, Math.min(ARENA_W - 30, p.x + Math.cos(a) * d));
    e.y = e.py = Math.max(30, Math.min(ARENA_H - 30, p.y + Math.sin(a) * d));
    e.kx = 0; e.ky = 0; e.hp = e.maxHp = def.hp + def.hpW * (run.wave - 1) + 400; e.dmg = def.dmg; e.r = def.r;
    e.state = ES.Move; e.t = 0; e.t2 = 1; e.t3 = 0; e.dx = 1; e.dy = 0; e.burnT = 0; e.burnDps = 0; e.slowT = 0; e.slowF = 0;
    e.flash = 0; e.n = 0; e.loot0 = e.loot1 = e.loot2 = e.loot3 = 0; e.work = 0; e.seed = i;
    run.enemyCount++;
  }
}

const god = q.has('god') || stuffN > 0;
const kit = q.has('kit') ? BASE_ITEMS.slice(0, 2) : [];
const sprites = bakeAll(window.devicePixelRatio);
const host: RunHost = {
  root: document.getElementById('app')!,
  sprites,
  ticket: { runId: 'dev', seed, waves, character, kit, stations: { sawmill: 1, smelter: 1, tannery: 1, assay: 1 }, profile, notice: null },
  mode: 'run',
  firstRun: q.has('first'),
  fuse,
  onEnd(recap) {
    console.log('recap', JSON.stringify(recap, null, 1));
    (window as unknown as { __recap: unknown }).__recap = recap;
    document.title = 'Scrip: run over';
  },
  onQuit() {
    console.log('quit');
    (window as unknown as { __quit: boolean }).__quit = true;
  },
};

function start(): void {
  // ?first=1 is a new device: nothing learned, no best. Without it the harness teaches nothing.
  if (q.get('first') === '1') forget();
  mount(host, {
    teach: q.has('first'),
    wave: q.has('wave') ? num('wave', 1) : undefined,
    bench: q.has('bench') ? num('bench', 1) : undefined,
    bot: q.has('bot'),
    autoBench: q.has('auto'),
    perf: q.has('perf'),
    slow: q.has('slow') ? num('slow', 8) : undefined,
    flush: q.get('perf') === '2',
    beforeStep: god || stuffN ? (run) => { if (god) run.player.hp = run.player.maxHp; if (stuffN) stuff(run); } : undefined,
    expose(run, redraw, playerScreen) {
      live = run;
      const w = window as unknown as { __run: Run; __draw: () => void; __playerScreen: () => { x: number; y: number; zoom: number } };
      w.__run = run; w.__draw = redraw; w.__playerScreen = playerScreen;
      (window as unknown as { __audio: typeof audio }).__audio = audio;
    },
  });
  (window as unknown as { __ready: boolean }).__ready = true;
}
// The typeface is used on the canvas too, so wait for it.
const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
if (fonts?.load) Promise.all([fonts.load('700 16px "Zilla Slab"'), fonts.load('400 16px "Zilla Slab"')]).then(start, start);
else start();
(window as unknown as { __setStuff: (n: number) => void }).__setStuff = (n) => { stuffN = n; };
