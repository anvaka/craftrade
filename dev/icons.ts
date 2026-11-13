// Contact sheet for src/ui/icons.ts. Open /dev/icons.html on the Vite dev server.
//   ?only=mats,items   show only these sections
//   ?bg=panel,blue     show only these backgrounds in the cards (default: all six)
//   ?strips=0          hide the 24 px and 20 px strips at the top of each section
import { BAG_TYPES, CFG, FAMS, GROUND_IDS, ITEMS, MATS, SKILLS, STATIONS } from '../src/data';
import type { EnemyKind, StationId } from '../src/data';
import * as I from '../src/ui/icons';

type Entry = [id: string, svg: string];
const SIZES = [64, 40, 24, 20];
const BGS = ['panel', 'grey', 'green', 'blue', 'purple', 'orange'];
const RARITY = BGS.slice(1);

const brewColors: [string, string][] = [['red', '#e2504a'], ['green', '#7fc94a'], ['violet', '#b18cff']];
const sections: [key: string, title: string, list: Entry[]][] = [
  ['mats', 'matIcon(id)', Object.keys(MATS).map((id) => [id, I.matIcon(id)])],
  ['weapons', 'weaponIcon(fam, evolved)', FAMS.flatMap((fam): Entry[] => [[fam, I.weaponIcon(fam)], [`${fam} evolved`, I.weaponIcon(fam, true)]])],
  ['tools', 'toolIcon(node, tier)', (['ore', 'wood', 'herb', 'knife'] as const).flatMap((n) => [1, 2, 3].map((t): Entry => [`${n} t${t}`, I.toolIcon(n, t)]))],
  ['bags', 'bagIcon(type)', [...Object.keys(BAG_TYPES), 'named'].map((t) => [t, I.bagIcon(t)])],
  ['brews', 'brewIcon(form, color)', (['flask', 'oil', 'charm'] as const).flatMap((form): Entry[] => [[form, I.brewIcon(form)], ...brewColors.map(([n, c]): Entry => [`${form} ${n}`, I.brewIcon(form, c)])])],
  ['schems', 'schemIcon(kind)', (['recipe', 'pattern', 'blueprint'] as const).map((k) => [k, I.schemIcon(k)])],
  ['items', 'itemIcon(id)', Object.keys(ITEMS).map((id) => [id, I.itemIcon(id)])],
  ['mods', 'modIcon(key)', I.MOD_ICON_KEYS.map((k) => [k, I.modIcon(k)])],
  ['fams', 'famIcon(fam)', FAMS.map((fam) => [fam, I.famIcon(fam)])],
  ['skills', 'skillIcon(skill)', SKILLS.map((s) => [s, I.skillIcon(s)])],
  ['stations', 'stationIcon(id)', (Object.keys(STATIONS) as StationId[]).map((s) => [s, I.stationIcon(s)])],
  ['grounds', 'groundIcon(ground)', GROUND_IDS.map((g) => [g, I.groundIcon(g)])],
  ['enemies', 'enemyIcon(kind)', (Object.keys(CFG.enemies) as EnemyKind[]).map((k) => [k, I.enemyIcon(k)])],
  ['ui', 'uiIcon(name)', I.UI_ICON_NAMES.map((n) => [n, I.uiIcon(n)])],
  ['unknown', 'fallback for unknown ids', [['matIcon(nope)', I.matIcon('nope')], ['itemIcon(nope)', I.itemIcon('nope')], ['uiIcon(nope)', I.uiIcon('nope')], ['bagIcon(nope)', I.bagIcon('nope')]]],
];

const q = new URLSearchParams(location.search);
const only = q.get('only')?.split(',');
const bgs = q.get('bg')?.split(',') ?? BGS;
const strips = q.get('strips') !== '0';

const sized = (svg: string, px: number) => svg.replace('<svg', `<svg width="${px}" height="${px}"`);
const cell = (svg: string, bg: string) => `<div class="cell bg-${bg}">${SIZES.map((s) => sized(svg, s)).join('')}</div>`;
const card = ([id, svg]: Entry) =>
  `<div class="card"><div class="cells" style="--cols:${Math.min(3, bgs.length)}">${bgs.map((bg) => cell(svg, bg)).join('')}</div><div class="id">${id}</div></div>`;
const strip = (list: Entry[], px: number) =>
  `<div class="strip"><b>${px} px</b>${list.map(([id, svg]) => `<span title="${id}">${sized(svg, px)}</span>`).join('')}</div>` +
  `<div class="strip tiles"><b></b>${list.map(([id, svg], i) => `<span class="t bg-${RARITY[i % RARITY.length]}" style="width:${px + 10}px;height:${px + 10}px" title="${id}">${sized(svg, px)}</span>`).join('')}</div>`;

const shown = sections.filter(([key]) => !only || only.includes(key));
document.getElementById('nav')!.innerHTML =
  `${sections.reduce((n, s) => n + s[2].length, 0)} icons. ` + ['<a href="?">all</a>', ...sections.map(([key]) => `<a href="?only=${key}">${key}</a>`)].join('');
document.getElementById('root')!.innerHTML = shown
  .map(([, title, list]) => `<h2>${title}<small>${list.length}</small></h2>` + (strips ? strip(list, 24) + strip(list, 20) : '') + `<div class="grid">${list.map(card).join('')}</div>`)
  .join('');
document.body.dataset.ready = '1';
