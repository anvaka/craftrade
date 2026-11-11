// Specimen sheet for the presentation kit: every sprite, every icon, the
// ledger UI with sample content, and a button per sound. Not shipped to
// players; served by Vite at /gallery.html.

import './ui/theme.css';
import { GLYPHS, RAWS, STATS, STAT_LABEL, STAT_PERCENT, type StatId } from '../shared/vocab.ts';
import {
  CHARACTER_IDS, MISC_ICON_IDS, NODE_IDS, PALETTE, STATION_IDS, WEAPON_IDS, bakeAll, capDpr, drawChargeLane,
  drawFloor, drawSlamRing, drawSprite, drawTreeline, drawWorkRing, spriteElement, type Icon, type Sprite, type Sprites,
} from './art/index.ts';
import { SOUND_IDS, audio, type SoundId } from './audio/index.ts';

const dpr = capDpr(window.devicePixelRatio);
const S: Sprites = bakeAll(dpr);
const app = document.getElementById('app')!;

type Kid = Node | string | null | undefined | false;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k) e.append(k);
  return e;
}
const ic = (i: Icon, large = false): HTMLCanvasElement => spriteElement(large ? i.l : i.s);

function section(title: string, note?: string): HTMLElement {
  const s = el('section', 'section', el('h2', '', title));
  if (note) s.append(el('p', 'note', note));
  app.append(s);
  return s;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return [c, ctx];
}

// A specimen: the sprite and its Ink silhouette at 1x, then both at 2x, on the floor.
let cellSeed = 0;
function specimen(name: string, s: Sprite): HTMLElement {
  const pad = 10;
  const w = pad + (s.w + pad) * 2 + (s.w * 2 + pad) * 2;
  const h = s.h * 2 + pad * 2;
  const [c, ctx] = canvas(w, h);
  cellSeed += 97;
  drawFloor(ctx, S.floor, cellSeed * 3, cellSeed * 7, w, h);
  const base = h - pad;
  let x = pad;
  for (const [sp, k] of [[s, 1], [s.ink, 1], [s, 2], [s.ink, 2]] as const) {
    drawSprite(ctx, sp, Math.round(x + s.ax * k), Math.round(base - (s.h - s.ay) * k), false, k);
    x += s.w * k + pad;
  }
  return el('div', 'cell', el('div', 'scroll', c), el('div', 'cap label', name));
}

function cells(parent: HTMLElement, items: [string, Sprite][]): void {
  const box = el('div', 'cells');
  for (const [n, s] of items) box.append(specimen(n, s));
  parent.append(box);
}

// ------------------------------------------------------------------- header

const muteBtns: HTMLButtonElement[] = [];
const volInputs: HTMLInputElement[] = [];
function soundControls(): HTMLElement {
  const mute = el('button', 'stamp stamp--plain stamp--small mute', 'Sound');
  mute.type = 'button';
  mute.addEventListener('click', () => {
    audio.toggleMute();
    audio.play('stamp');
  });
  const vol = el('input', 'vol');
  vol.type = 'range';
  vol.min = '0';
  vol.max = '1';
  vol.step = '0.05';
  vol.setAttribute('aria-label', 'Volume');
  vol.addEventListener('input', () => audio.setVolume(Number(vol.value)));
  vol.addEventListener('change', () => audio.play('pickup'));
  muteBtns.push(mute);
  volInputs.push(vol);
  return el('div', 'sound', mute, vol);
}
function syncSound(): void {
  for (const b of muteBtns) {
    b.setAttribute('aria-pressed', String(audio.muted));
    b.setAttribute('aria-label', audio.muted ? 'Sound is off' : 'Sound is on');
  }
  for (const v of volInputs) v.value = String(audio.volume);
}
audio.onChange(syncSound);

app.append(
  el(
    'header',
    'page-head',
    el('div', '', el('div', 'label', 'Scrip, presentation kit'), el('h1', '', 'Specimen sheet')),
    el('div', 'meta', el('span', 'note', `Baked at ${dpr}x. Nothing on this sheet is an image file.`), soundControls()),
  ),
);

// ------------------------------------------------------------------ palette

{
  const s = section('Seven colours, one job each');
  const jobs: Record<string, string> = {
    ink: 'Outlines, text',
    bone: 'Paper: UI ground only',
    moss: 'Clearing floor',
    spruce: 'Treeline, shade',
    ochre: 'The player, raws, crafted goods, scrip',
    madder: 'Enemies and danger only',
    woad: 'Town, market, other players',
  };
  const t = el('table', 'ledger');
  t.append(el('tr', '', el('th', '', 'Colour'), el('th', 'num', 'Hex'), el('th', '', 'Job')));
  for (const [name, hex] of Object.entries(PALETTE)) {
    const sw = el('span', 'swatch');
    sw.style.background = hex;
    t.append(el('tr', '', el('td', '', el('div', 'thing', sw, el('span', '', name[0]!.toUpperCase() + name.slice(1)))), el('td', 'num', hex), el('td', '', jobs[name]!)));
  }
  s.append(t);
}

// ------------------------------------------------------------------ sprites

{
  const s = section('Characters', 'Each cell: print and Ink silhouette at 1x, then at 2x. Two walk frames each.');
  cells(s, CHARACTER_IDS.flatMap((id) => [[`${id} 0`, S.player[id].walk[0]], [`${id} 1`, S.player[id].walk[1]]] as [string, Sprite][]));
}
{
  const s = section('Enemies');
  const e = S.enemy;
  cells(s, [
    ['mite 0', e.mite.walk[0]], ['mite 1', e.mite.walk[1]],
    ['gnat 0', e.gnat.walk[0]], ['gnat 1', e.gnat.walk[1]],
    ['boar walk', e.boar.walk[0]], ['boar wind-up', e.boar.windup],
    ['spitter', e.spitter.walk[0]], ['spitter spit', e.spitter.spit],
    ['magpie', e.magpie.walk[0]], ['magpie carrying 0', e.magpie.carry[0]], ['magpie carrying 1', e.magpie.carry[1]],
    ['burrower mound', e.burrower.mound], ['burrower out', e.burrower.walk[0]],
    ['brute', e.brute.walk[0]], ['brute slam', e.brute.slam],
    ['stag', e.stag.walk[0]], ['stag wind-up', e.stag.windup],
    ['rotwood 0', e.rotwood.walk[0]], ['rotwood 1', e.rotwood.walk[1]],
    ['old tusk, charge', e.tusk.phase[0]], ['old tusk, summon', e.tusk.phase[1]], ['old tusk, slam', e.tusk.phase[2]],
  ]);
}
{
  const s = section('Nodes', 'Stage 0 to 3 as the node is worked, then what is left.');
  for (const id of NODE_IDS) {
    const n = S.node[id];
    cells(s, [
      ...n.normal.map((sp, i) => [`${id} ${i}`, sp] as [string, Sprite]),
      [`${id} worked out`, n.remnant],
      ...n.rich.map((sp, i) => [`rich ${id} ${i}`, sp] as [string, Sprite]),
      [`rich ${id} worked out`, n.richRemnant],
    ]);
  }
}
{
  const s = section('Pickups, shots, arcs, chips');
  cells(s, [
    ...Object.entries(S.pickup).map(([k, v]) => [k, v] as [string, Sprite]),
    ...Object.entries(S.shot).map(([k, v]) => [k === 'spit' ? 'enemy spit' : k === 'shard' ? 'antler shard' : k, v] as [string, Sprite]),
    ['sweep 0', S.arc.sweep[0]], ['sweep 1', S.arc.sweep[1]], ['thrust 0', S.arc.thrust[0]], ['thrust 1', S.arc.thrust[1]],
  ]);
  // chips: all four shapes of each colour in one cell
  const box = el('div', 'cells');
  for (const col of ['ink', 'ochre', 'madder', 'spruce'] as const) {
    const [c, ctx] = canvas(150, 44);
    drawFloor(ctx, S.floor, 40, 90, 150, 44);
    S.chip[col].forEach((sp, i) => {
      drawSprite(ctx, sp, 14 + i * 16, 30, false, 1, i * 0.8);
      drawSprite(ctx, sp, 90 + i * 16, 22, false, 2, i * 0.8 + 1);
    });
    box.append(el('div', 'cell', el('div', 'scroll', c), el('div', 'cap label', `${col} chips`)));
  }
  s.append(box);
}

// -------------------------------------------------------------------- scene

function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, small: boolean): void {
  const camX = 180;
  const camY = 150;
  drawFloor(ctx, S.floor, camX, camY, w, h);
  ctx.save();
  ctx.translate(-camX, -camY);
  const R = Math.round;
  const put = (s: Sprite, x: number, y: number, flip = false): void => drawSprite(ctx, s, R(x), R(y), flip);
  // telegraphs go under everything that stands
  drawChargeLane(ctx, 760, 420, 470, 380, 20, 0.65);
  if (!small) drawSlamRing(ctx, 900, 330, 70, 0.55);
  drawWorkRing(ctx, 420, 300, 54, 0.4);
  drawWorkRing(ctx, 610, 260, 50, 0);
  // things, sorted by foot line
  const things: [Sprite, number, number, boolean?][] = [
    [S.node.tree.normal[1], 420, 300],
    [S.node.seam.rich[0], 610, 260],
    [S.node.carcass.normal[2], 330, 440],
    [S.node.tree.remnant, 700, 470],
    [S.player.sawyer.walk[0], 455, 318],
    [S.enemy.boar.windup, 790, 425, true],
    [S.enemy.mite.walk[0], 540, 360, true],
    [S.enemy.mite.walk[1], 575, 395, true],
    [S.enemy.mite.walk[0], 520, 420, true],
    [S.enemy.gnat.walk[0], 350, 350],
    [S.enemy.gnat.walk[1], 372, 368],
    [S.enemy.gnat.walk[0], 338, 380],
    [S.enemy.spitter.spit, 660, 330, true],
    [S.enemy.magpie.carry[0], 250, 300, true],
    [S.enemy.burrower.walk[0], 470, 250],
    [S.enemy.brute.walk[0], 900, 330, true],
    [S.enemy.stag.walk[0], 1010, 470, true],
    [S.pickup.scrip, 500, 345], [S.pickup.scrip, 512, 332], [S.pickup.timber, 395, 335], [S.pickup.ore, 640, 290], [S.pickup.hide, 300, 460],
    [S.shot.spit, 580, 318], [S.shot.shard, 860, 450],
  ];
  things.sort((a, b) => a[2] - b[2]);
  for (const [s, x, y, f] of things) put(s, x, y, f);
  drawSprite(ctx, S.arc.sweep[0], 462, 296, false, 0.9);
  drawSprite(ctx, S.shot.axe, 520, 290, false, 1, 0.9);
  drawSprite(ctx, S.chip.ochre[0], 432, 262, false, 1, 0.4);
  drawSprite(ctx, S.chip.ochre[2], 446, 250, false, 1, 2);
  drawSprite(ctx, S.chip.madder[1], 548, 338, false, 1, 1);
  drawTreeline(ctx, S.treeline, { x: 210, y: 190, w: 1400, h: 900 });
  ctx.restore();
}

{
  const s = section('Ground', 'Floor tile, treeline with a cut corner, work rings (one at 40%), a charge lane and a slam ring part filled.');
  const box = el('div', 'scene');
  const w = Math.min(1008, document.documentElement.clientWidth - 38);
  const h = 400;
  const [c, ctx] = canvas(w, h);
  drawScene(ctx, w, h, w < 600);
  box.append(c);
  s.append(box);
}

// -------------------------------------------------------------------- icons

{
  const s = section('Icons', 'Small (32) and large (64). The large size is the same cut with the same line.');
  const group = (title: string, items: [string, Icon][]): void => {
    s.append(el('h3', '', title));
    const g = el('div', 'icons');
    for (const [n, i] of items) g.append(el('div', '', ic(i), ic(i, true), el('span', 'cap label', n)));
    s.append(g);
    s.append(el('div', 'row'));
  };
  group('Weapons', WEAPON_IDS.map((id) => [id, S.icon.weapon[id]]));
  group('Item glyphs', GLYPHS.map((id) => [id, S.icon.glyph[id]]));
  group('Stats', STATS.map((id) => [STAT_LABEL[id], S.icon.stat[id]]));
  group('Raws, money, marks', [
    ...RAWS.map((id) => [id, S.icon.raw[id]] as [string, Icon]),
    ...MISC_ICON_IDS.map((id) => [id, S.icon[id]] as [string, Icon]),
  ]);
  group('Stations', STATION_IDS.map((id) => [id, S.icon.station[id]]));
}

// ------------------------------------------------------------------- UI kit

function tier(n: number): HTMLElement {
  const t = el('span', 'tier', el('i'), el('i'), el('i'), el('i'));
  t.dataset.tier = String(n);
  t.setAttribute('aria-label', `tier ${n}`);
  return t;
}
function cost(i: Icon, n: number, lack = false): HTMLElement {
  return el('span', lack ? 'cost lack' : 'cost', ic(i), el('span', 'num', String(n)));
}
function stamp(label: string, cls = '', sound: SoundId = 'stamp', ...kids: Kid[]): HTMLButtonElement {
  const b = el('button', `stamp ${cls}`.trim(), label, ...kids);
  b.type = 'button';
  b.addEventListener('click', () => audio.play(sound));
  return b;
}

{
  const s = section('Bench', 'A mock bench after wave 4 with four offers.');
  const tabs = el('div', 'tabs');
  tabs.setAttribute('role', 'tablist');
  for (const [name, n] of [['Offers', '4'], ['Upgrades', '2'], ['Anvil', ''], ['Kit', '9']] as const) {
    const t = el('button', 'tab', name, n ? el('span', 'count num', n) : null);
    t.type = 'button';
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', String(name === 'Offers'));
    t.addEventListener('click', () => {
      for (const o of tabs.children) o.setAttribute('aria-selected', String(o === t));
      audio.play('stamp');
    });
    tabs.append(t);
  }
  s.append(el('div', 'row'), tabs);

  const held = el(
    'div',
    'heldbar',
    el('div', 'group', el('span', 'label', 'You hold'), el('span', 'price', cost(S.icon.scrip, 47), cost(S.icon.raw.timber, 6), cost(S.icon.raw.ore, 2), cost(S.icon.raw.hide, 1))),
    el('div', 'group', stamp('Reroll', 'stamp--plain', 'reroll', cost(S.icon.scrip, 3)), stamp('Send the mule', 'stamp--plain', 'mule'), stamp('Next wave', '', 'waveStart')),
  );
  s.append(held);

  interface Offer {
    icon: Icon; name: string; kind: string; tier: number; fx: string[]; costs: string[]; price: HTMLElement[]; state?: 'locked' | 'sold'; cant?: boolean;
  }
  const offers: Offer[] = [
    {
      icon: S.icon.glyph.boot, name: 'Hobnail boots', kind: 'Item', tier: 1, fx: ['+6% Speed', '+4 knockback'], costs: [],
      price: [cost(S.icon.scrip, 21), cost(S.icon.raw.ore, 1), cost(S.icon.raw.hide, 1)],
    },
    {
      icon: S.icon.weapon.pike, name: 'Pike', kind: 'Weapon, edge', tier: 2, fx: ['Long thrust, 14 damage every 1.3 s', 'Damage grows with Reach'], costs: [],
      price: [cost(S.icon.scrip, 38), cost(S.icon.raw.timber, 2), cost(S.icon.raw.ore, 1)], state: 'locked',
    },
    {
      icon: S.icon.glyph.pelt, name: 'Burr coat', kind: 'Item', tier: 1, fx: ['Attackers take 6 damage'], costs: ['-3% Speed'],
      price: [cost(S.icon.scrip, 18), cost(S.icon.raw.hide, 2, true)], cant: true,
    },
    {
      icon: S.icon.glyph.candle, name: 'Tallow', kind: 'Item', tier: 1, fx: ['+8% Rate'], costs: ['-1 Armor'],
      price: [cost(S.icon.scrip, 16), cost(S.icon.raw.hide, 1)], state: 'sold',
    },
  ];
  const list = el('ul', 'offers');
  for (const o of offers) {
    const fx = el('ul', 'effects');
    for (const f of o.fx) fx.append(el('li', '', f));
    for (const f of o.costs) fx.append(el('li', 'cost', f));
    const buy = stamp(o.state === 'sold' ? 'Bought' : 'Buy', 'stamp--small', 'buy');
    if (o.state === 'sold' || o.cant) buy.disabled = true;
    const lock = stamp(o.state === 'locked' ? 'Locked' : 'Lock', 'stamp--plain stamp--small', 'lock');
    if (o.state === 'locked') lock.classList.add('is-pressed');
    const li = el(
      'li',
      `offer${o.state ? ` is-${o.state}` : ''}`,
      ic(o.icon, true),
      el('div', 'name', el('span', '', o.name), tier(o.tier), el('span', 'kind', o.kind), o.state === 'locked' ? ic(S.icon.lock) : null),
      fx,
      el('div', 'buy', el('span', 'price', ...o.price), el('div', 'acts', o.state === 'sold' ? null : lock, buy)),
    );
    list.append(li);
  }

  const vals: Record<StatId, number> = { maxHp: 30, mend: 2, armor: 4, dodge: 6, speed: 6, damage: 13, melee: 4, ranged: 0, rate: 8, crit: 5, reach: 20, harvest: 10, luck: 5 };
  const stats = el('dl', 'stats');
  for (const id of STATS) {
    const row = el('div', id === 'speed' ? 'up' : '', el('dt', '', ic(S.icon.stat[id]), STAT_LABEL[id]), el('dd', 'num', `${vals[id]}${STAT_PERCENT[id] ? '%' : ''}`));
    stats.append(row);
  }
  s.append(el('div', 'bench', el('div', '', list), el('div', '', el('div', 'row'), el('h3', '', 'Sawyer, level 6'), el('div', 'row'), stats)));
}

{
  const s = section('Market', 'Listings posted by players, then the Factor on raws.');
  const tabs = el('div', 'tabs');
  for (const name of ['Stash', 'Workshop', 'Market', 'Town']) {
    const t = el('button', 'tab', name);
    t.type = 'button';
    t.setAttribute('aria-selected', String(name === 'Market'));
    tabs.append(t);
  }
  s.append(el('div', 'row'), tabs);

  const t = el('table', 'ledger');
  t.append(el('tr', '', el('th', '', 'Item'), el('th', '', 'Tier'), el('th', 'wide', 'First made by'), el('th', 'wide', 'Seller'), el('th', 'num', 'Marks'), el('th', '', '')));
  const rows: [Icon, string, number, string, string, number, boolean][] = [
    [S.icon.glyph.boot, 'Pitch boots', 2, 'Odd Hale', 'Odd Hale', 140, false],
    [S.icon.glyph.lantern, 'Tallow lantern', 2, 'millpond', 'Reece', 95, false],
    [S.icon.glyph.sack, 'Nailed sack', 3, 'you', 'you', 310, true],
    [S.icon.glyph.hook, 'Burr hook', 2, 'Reece', 'tvarga', 120, false],
    [S.icon.glyph.stone, 'Whetstone', 1, '', 'millpond', 22, false],
  ];
  for (const [icon, name, tr, by, seller, price, mine] of rows) {
    const who = (n: string): Kid => (n === 'you' ? el('span', 'own', 'You') : n ? el('span', 'who', n) : el('span', 'note', 'bench recipe'));
    const b = stamp(mine ? 'Withdraw' : 'Buy', `stamp--small ${mine ? 'stamp--plain' : 'stamp--town'}`, 'buy');
    t.append(el('tr', '', el('td', '', el('div', 'thing', ic(icon), el('span', '', name))), el('td', '', tier(tr)), el('td', 'wide', who(by)), el('td', 'wide', who(seller)), el('td', 'num', String(price)), el('td', 'act', b)));
  }
  s.append(t);

  const f = el('table', 'ledger');
  f.append(el('tr', '', el('th', '', 'Raw'), el('th', 'num', 'Factor pays'), el('th', 'num', 'Factor asks'), el('th', 'num wide', 'Left today'), el('th', 'num', 'You hold')));
  const fr: [Icon, string, number, number, number, number][] = [[S.icon.raw.timber, 'Timber', 4, 15, 220, 61], [S.icon.raw.ore, 'Ore', 7, 26, 140, 18], [S.icon.raw.hide, 'Hide', 6, 23, 95, 9]];
  for (const [icon, name, pay, ask, left, hold] of fr)
    f.append(el('tr', '', el('td', '', el('div', 'thing', ic(icon), el('span', '', name))), el('td', 'num', String(pay)), el('td', 'num', String(ask)), el('td', 'num wide', String(left)), el('td', 'num', String(hold))));
  f.append(el('tr', 'total', el('td', '', el('div', 'thing', ic(S.icon.marks), el('span', '', 'Marks in hand'))), el('td', 'num', ''), el('td', 'num', ''), el('td', 'num wide', ''), el('td', 'num', '412')));
  s.append(el('div', 'row'), f);

  const m = el('div', 'meter meter--town');
  m.style.setProperty('--v', '0.62');
  s.append(
    el('div', 'row', el('div', 'thing', ic(S.icon.station.sawmill, true), el('div', '', el('div', 'label', 'Town project'), el('div', '', 'Raise the sawmill to tier 2'), el('div', 'note num', '1,860 of 3,000 timber')))),
    el('div', 'row'),
    m,
  );
}

{
  const s = section('HUD', 'Health, wave, counters, sound and the touch stick over a wave in progress.');
  const box = el('div', 'hudbox');
  const w = Math.min(1008, document.documentElement.clientWidth - 38);
  const [c, ctx] = canvas(w, 420);
  ctx.translate(Math.min(0, w - 760) / 2 - 120, 0);
  drawScene(ctx, w + 400, 420, true);
  box.append(c);

  const bar = el('span', 'bar');
  for (let i = 0; i < 15; i++) bar.append(el('i', i < 11 ? 'on' : ''));
  const hp = el('div', 'hp', bar, el('span', 'num', '22/30'));
  const wave = el('div', 'wave', el('span', 'label', 'Wave 5 of 12'), el('span', 'time num', '0:27'));
  const counters = el(
    'div',
    'counters',
    el('span', 'counter is-scrip', ic(S.icon.scrip), el('span', 'num', '47')),
    el('span', 'counter', ic(S.icon.raw.timber), el('span', 'num', '6')),
    el('span', 'counter', ic(S.icon.raw.ore), el('span', 'num', '2')),
    el('span', 'counter', ic(S.icon.raw.hide), el('span', 'num', '1')),
  );
  const stick = el('div', 'stick', el('div', 'knob'));
  stick.style.setProperty('--x', '14px');
  stick.style.setProperty('--y', '-9px');
  const notices = el('div', 'notices', el('div', 'notice notice--danger', el('span', 'tag', 'Magpie'), el('span', 'text', 'Took 6 scrip. Kill it before the treeline.')));
  box.append(el('div', 'hud', hp, wave, counters, notices, stick, soundControls()));
  s.append(box);
}

{
  const s = section('Pieces');
  const dis = stamp('Buy', '', 'stamp');
  dis.disabled = true;
  const pressed = stamp('Pressed', 'is-pressed');
  s.append(
    el('h3', '', 'Stamps'),
    el('div', 'row', stamp('Go again'), stamp('Pack kit', 'stamp--plain'), stamp('Post listing', 'stamp--town'), pressed, stamp('Locked', 'stamp--plain is-pressed'), dis, stamp('Scrap', 'stamp--small stamp--plain')),
    el('h3', '', 'Tier marks'),
    el('div', 'row', tier(1), tier(2), tier(3), tier(4)),
    el('h3', '', 'Tooltip'),
    el('div', 'row', el('div', 'tip', el('span', 'label', 'Harvest'), 'Work rate x1.5. One more raw from every node.'), el('div', 'tip', el('span', 'label', 'Lodestone'), '+30% pickup range')),
    el('h3', '', 'Notices'),
    el(
      'div',
      'row',
      el(
        'div',
        '',
        el('div', 'notice', el('span', 'tag', 'Mule'), el('span', 'text', 'Home with 12 timber, 4 ore.')),
        el('div', 'notice notice--town', el('span', 'tag', 'Market'), el('span', 'text', 'Pitch boots sold for 140 marks.')),
        el('div', 'notice notice--danger', el('span', 'tag', 'Wave 6'), el('span', 'text', 'A stag is in the clearing.')),
      ),
    ),
    el('h3', '', 'First find'),
    el(
      'div',
      'row',
      el('div', 'find-stamp', el('span', 'label', 'First made by'), el('span', 'name', 'Odd Hale')),
      el('div', 'find-stamp is-yours', el('span', 'label', 'First made by'), el('span', 'name', 'You')),
    ),
    el('h3', '', 'Touch stick'),
    el('div', 'row', el('div', 'stickpad', el('div', 'stick', el('div', 'knob')))),
  );
  const again = stamp('Stamp it again', 'stamp--plain stamp--small', 'revealFirst');
  again.addEventListener('click', () => {
    for (const f of s.querySelectorAll('.find-stamp')) {
      f.classList.remove('thud');
      void (f as HTMLElement).offsetWidth;
      f.classList.add('thud');
    }
  });
  s.append(el('div', 'row', again));
}

// ------------------------------------------------------------------- sounds

{
  const s = section('Sounds', 'All synthesised. The first press unlocks audio. Pickup rises when pressed in a streak.');
  const groups: [string, SoundId[]][] = [
    ['Work', ['chop', 'chopBreak', 'clink', 'clinkBreak', 'scrape', 'scrapeBreak']],
    ['Pickups', ['pickup', 'scrip']],
    ['Weapons', ['edge', 'blunt', 'shot', 'musket']],
    ['Combat', ['hit', 'crit', 'kill', 'hurt', 'dodge', 'telegraph', 'elite', 'boss', 'bossDeath', 'steal']],
    ['Run', ['levelUp', 'waveStart', 'waveEnd', 'mule', 'death', 'win']],
    ['Bench', ['buy', 'reroll', 'lock', 'combine', 'anvil', 'reveal', 'revealFirst', 'stamp']],
  ];
  const listed = new Set(groups.flatMap((g) => g[1]));
  const rest = SOUND_IDS.filter((id) => !listed.has(id));
  if (rest.length) groups.push(['Other', rest]);
  for (const [title, ids] of groups) {
    const row = el('div', 'sounds');
    for (const id of ids) {
      const b = el('button', 'stamp stamp--plain stamp--small', id);
      b.type = 'button';
      b.dataset.sound = id;
      b.addEventListener('click', () => audio.play(id));
      row.append(b);
    }
    s.append(el('div', 'row'), el('h3', '', title), row);
  }
  let stop: (() => void) | null = null;
  const loop = el('button', 'stamp stamp--small', 'Fusion wait, then reveal');
  loop.type = 'button';
  loop.addEventListener('click', () => {
    if (stop) return;
    stop = audio.loop('anvil');
    setTimeout(() => {
      stop?.();
      stop = null;
      audio.play('reveal');
    }, 2950);
  });
  const burst = el('button', 'stamp stamp--small', '50 kills in one frame');
  burst.type = 'button';
  burst.addEventListener('click', () => {
    for (let i = 0; i < 50; i++) audio.play('kill', { pan: Math.random() * 2 - 1 });
    for (let i = 0; i < 50; i++) audio.play('scrip');
  });
  s.append(el('div', 'row', loop, burst));
}

syncSound();
(window as unknown as { __galleryReady: boolean }).__galleryReady = true;
