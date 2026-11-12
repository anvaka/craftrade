// The loot prototype in town: the workbench. Refine, make from schematics, pack what was made.
// Everything is kept on this device (../loot/store.ts) and the real town never sees it.
import type { ItemSpec } from '../../shared/item.ts';
import { PK_HIDE, PK_ORE, PK_RARE, PK_TIMBER, WEAPONS, WEAPON_INDEX } from '../../sim/index.ts';
import { CHARGES, MAT_NAME, MATS, RARE_MATS, REFINES, SCHEMATICS, rawNeeds, type Mat, type Schematic } from '../loot/content.ts';
import { loadLoot, saveLoot, type LootSave } from '../loot/store.ts';
import type { LootProto, RunRecap } from '../seam.ts';
import { itemName, weaponName } from '../ui/describe.ts';
import { el, stamp } from './dom.ts';
import { headOutLoot } from './run.ts';
import { redraw } from './state.ts';

const KIND: Partial<Record<Mat, number>> = { timber: PK_TIMBER, ore: PK_ORE, hide: PK_HIDE, silver: PK_RARE, thickhide: PK_RARE + 1 };
const PACK_MAX = 2;
const schem = (id: string): Schematic => SCHEMATICS.find((s) => s.id === id)!;

function canPay(s: LootSave, needs: Partial<Record<Mat, number>>, times = 1): boolean {
  return (Object.entries(needs) as [Mat, number][]).every(([m, n]) => s.mats[m] >= n * times);
}
function pay(s: LootSave, needs: Partial<Record<Mat, number>>): void {
  for (const [m, n] of Object.entries(needs) as [Mat, number][]) s.mats[m] -= n;
}
const needText = (needs: Partial<Record<Mat, number>>): string =>
  (Object.entries(needs) as [Mat, number][]).map(([m, n]) => `${n} ${MAT_NAME[m].toLowerCase()}`).join(' + ');

function madeName(sc: Schematic): HTMLElement {
  const m = sc.makes;
  if (m.kind === 'weapon') {
    const def = WEAPONS[WEAPON_INDEX[m.id]];
    const w = weaponName(def, m.tier);
    w.textContent = sc.name;
    return w;
  }
  return itemName(m.item);
}

/** What the next loot run takes along, and what its strip counts toward. */
export function lootLaunch(): { proto: LootProto; kit: ItemSpec[] } {
  const s = loadLoot();
  const weapons: { id: string; tier: number }[] = [];
  const kit: ItemSpec[] = [];
  for (const g of s.gear) {
    if (!g.packed) continue;
    const m = schem(g.schematic).makes;
    if (m.kind === 'weapon') weapons.push({ id: m.id, tier: m.tier }); else kit.push(m.item);
  }
  const t = schem(s.track);
  const needs = (Object.entries(rawNeeds(t, s.mats)) as [Mat, number][])
    .filter(([m]) => KIND[m] !== undefined)
    .map(([m, n]) => ({ label: MAT_NAME[m].toLowerCase(), kind: KIND[m]!, need: n, home: Math.min(n, s.mats[m]) }));
  return {
    kit,
    proto: {
      schematics: SCHEMATICS.map((x) => x.name), known: SCHEMATICS.map((x) => s.known.includes(x.id)), rares: RARE_MATS.map((m) => MAT_NAME[m]),
      weapons, goal: needs.length ? { name: t.name, needs } : null,
    },
  };
}

/** A loot run is over: what it carried comes home (half on a fall), schematics are learned, packed gear wears. */
export function bankLoot(r: RunRecap): void {
  const s = loadLoot();
  const won = r.report.won;
  const share = won ? 1 : 0.5;
  const got: Partial<Record<Mat, number>> = {};
  const add = (m: Mat, n: number): void => { const k = Math.floor(n * share); if (k > 0) { s.mats[m] += k; got[m] = k; } };
  add('timber', r.report.raws.timber); add('ore', r.report.raws.ore); add('hide', r.report.raws.hide);
  (r.loot?.rare ?? []).forEach((n, i) => { const m = RARE_MATS[i]; if (m) add(m, n); });
  const learned: string[] = [];
  let dupes = 0;
  // Schematics come home whole, even from a fall: they are knowledge, not cargo. -1 is one already known.
  for (const i of r.loot?.found ?? []) {
    const sc = SCHEMATICS[i];
    if (!sc || s.known.includes(sc.id)) { dupes++; continue; }
    s.known.push(sc.id); learned.push(sc.id);
  }
  // A known schematic found again is worth its raws: a few of each.
  if (dupes) { s.mats.ore += 3 * dupes; s.mats.hide += 3 * dupes; s.mats.timber += 2 * dupes; }
  for (const g of s.gear) if (g.packed) g.charges--;
  s.gear = s.gear.filter((g) => g.charges > 0);
  s.runs++;
  s.last = { won, mats: got, learned, dupes };
  saveLoot(s);
}

/** The workbench on the stash page. */
export function lootSection(): HTMLElement {
  const s = loadLoot();
  const change = (fn: (s: LootSave) => void): void => { const t = loadLoot(); fn(t); saveLoot(t); redraw(); };
  const sec = el('section', 'section loot');
  sec.append(el('h2', '', 'Workbench'));
  sec.append(el('div', 'bar',
    el('div', 'bar-text', el('strong', '', 'Kills drop raws; big ones drop rare things and schematics. '), el('span', 'note', 'A test on this device only. Half comes home if you fall.')),
    stamp('Head out', { key: 'loot:go', sound: 'waveStart', onClick: () => void headOutLoot() })));

  if (s.last) {
    const bits = (Object.entries(s.last.mats) as [Mat, number][]).map(([m, n]) => `${n} ${MAT_NAME[m].toLowerCase()}`);
    const learned = s.last.learned.map((id) => schem(id).name);
    sec.append(el('p', 'loot-last', el('strong', '', s.last.won ? 'Last run, all of it home: ' : 'Last run, half of it home: '),
      bits.length ? bits.join(', ') : 'nothing', learned.length ? `. New schematic: ${learned.join(', ')}` : '',
      s.last.dupes ? `. ${s.last.dupes} known schematic${s.last.dupes > 1 ? 's' : ''} broken down for raws` : '', '.'));
  }

  // Store.
  const store = el('div', 'loot-store');
  for (const m of MATS) store.append(el('span', s.mats[m] ? 'mat' : 'mat is-none', el('b', '', String(s.mats[m])), ' ', MAT_NAME[m]));
  sec.append(el('h3', '', 'Store'), store);

  // Refining.
  const ref = el('div', 'loot-rows');
  for (const r of REFINES) {
    const all = Math.min(...(Object.entries(r.needs) as [Mat, number][]).map(([m, n]) => Math.floor(s.mats[m] / n)));
    ref.append(el('div', 'loot-row',
      el('span', 'what', el('strong', '', `${r.verb} ${MAT_NAME[r.out].toLowerCase()}`), el('span', 'note', ` ${needText(r.needs)}`)),
      stamp('1', { cls: 'stamp--small', disabled: all < 1, onClick: () => change((t) => { if (canPay(t, r.needs)) { pay(t, r.needs); t.mats[r.out]++; } }) }),
      stamp(all > 1 ? `All ${all}` : 'All', { cls: 'stamp--small stamp--plain', disabled: all < 2, onClick: () => change((t) => { while (canPay(t, r.needs)) { pay(t, r.needs); t.mats[r.out]++; } }) })));
  }
  sec.append(el('h3', '', 'Refine'), ref);

  // Schematics.
  const rows = el('div', 'loot-rows');
  for (const sc of SCHEMATICS) {
    const known = s.known.includes(sc.id);
    if (!known) { rows.append(el('div', 'loot-row is-unknown', el('span', 'what', el('strong', '', 'Unknown schematic'), el('span', 'note', ' Elites and the boss drop them.')))); continue; }
    const tracked = s.track === sc.id;
    const ok = canPay(s, sc.needs);
    rows.append(el('div', `loot-row${tracked ? ' is-tracked' : ''}`,
      el('span', 'what', madeName(sc), el('span', 'note', ` ${needText(sc.needs)}. ${sc.what}`)),
      stamp(tracked ? 'Tracked' : 'Track', { cls: 'stamp--small stamp--plain', disabled: tracked, title: 'The line at the foot of a run counts toward this.', onClick: () => change((t) => { t.track = sc.id; }) }),
      stamp('Make', { cls: 'stamp--small', disabled: !ok, onClick: () => change((t) => {
        if (!canPay(t, sc.needs)) return;
        pay(t, sc.needs);
        t.gear.push({ schematic: sc.id, charges: CHARGES, packed: t.gear.filter((g) => g.packed).length < PACK_MAX });
        // Made it: the strip moves on to the next thing known and not yet made.
        const next = t.known.find((k) => k !== sc.id && !t.gear.some((g) => g.schematic === k));
        if (t.track === sc.id && next) t.track = next;
      }) })));
  }
  sec.append(el('h3', '', `Schematics, ${s.known.length} of ${SCHEMATICS.length}`), rows);

  // Made.
  if (s.gear.length) {
    const made = el('div', 'loot-rows');
    s.gear.forEach((g, i) => {
      const sc = schem(g.schematic);
      const full = !g.packed && s.gear.filter((x) => x.packed).length >= PACK_MAX;
      made.append(el('div', 'loot-row',
        el('span', 'what', madeName(sc), el('span', 'note', ` ${g.charges} run${g.charges > 1 ? 's' : ''} left`)),
        stamp(g.packed ? 'Packed' : 'Pack', { cls: g.packed ? 'stamp--small' : 'stamp--small stamp--plain', disabled: full, title: full ? `${PACK_MAX} at most.` : '',
          onClick: () => change((t) => { const x = t.gear[i]; if (x) x.packed = !x.packed; }) })));
    });
    sec.append(el('h3', '', `Made, ${PACK_MAX} can go along`), made);
  }
  return sec;
}
