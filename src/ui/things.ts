// One description for every thing the menus show, addressed by a short reference string
// ("gear:12", "mat:iron", "brew:flask:burn+chill"...). Tiles, tooltips and detail panes are all drawn from it.
import {
  ATOMS, BAG_TYPES, BOSSES, CARDS, ELITES, EVOLVE_MUL, FAMS, FORM, GROUNDS, ITEMS, KITS, LEVEL_PICKS, MATS, MUTATORS, NODE_MAT, PATTERNS, PERKS, RECIPES,
  SCHEMATICS, SOURCE_NAME, STATION_COST, STATION_T2, STATIONS, TIER_MUL, TOOLS, WEAPONS, WILDS, brewMods, brewName, modText,
  type Fam, type Gear, type GearTool, type Ground, type Mod, type ModKey, type NodeKind, type StationId,
} from '../data';
import * as M from '../meta';
import * as R from '../run';
import * as I from './icons';

export type Rarity = 0 | 1 | 2 | 3 | 4;
export const RARITY_NAME = ['Common', 'Uncommon', 'Rare', 'Epic', 'Named'];
export interface PerkLine {
  icon: string;
  name: string;
  text: string;
  tag?: string;
}
export interface Desc {
  ref: string;
  icon: string;
  name: string;
  rarity: Rarity;
  type: string;
  tier?: number;
  gs?: number;
  qty?: number;
  stats: [string, string][];
  perks: PerkLine[];
  notes: string[];
  source?: string;
  warn?: string;
}
export interface Ctx {
  p: M.Profile;
  run?: R.RunState | null;
}

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const roman = (n: number) => ['', 'I', 'II', 'III', 'IV', 'V'][n] ?? String(n);
export const GRADE = ['', 'Iron', 'Skysteel', 'Sunmetal'];
const first = (mods: Mod[]): ModKey => mods[0]?.[0] ?? 'dmg';
const clamp = (r: number): Rarity => Math.max(0, Math.min(4, r)) as Rarity;

/** How much a weapon's gear score strengthens its perks: 1.0 at 200, 1.5 at 500. */
export const perkQuality = (gs: number) => 1 + 0.5 * Math.max(0, Math.min(1, (gs - 200) / 300));

export function gearRarity(g: Gear): Rarity {
  if (g.kind === 'weapon') return g.named ? 4 : clamp(g.perks.length);
  if (g.kind === 'tool') return g.name.includes('Maw') ? 4 : clamp(g.tier - 1);
  return g.type === 'named' ? 4 : clamp(['sack', 'pack', 'frame'].indexOf(g.type));
}
export function gearTier(g: Gear): number {
  // the grade is recorded at the forge; a gear score on a boundary (300) belongs to the lower grade's range
  if (g.kind === 'weapon') return g.grade ?? (g.named ? 3 : Math.max(1, Math.min(3, Math.ceil((g.gs - 200) / 100))));
  if (g.kind === 'tool') return g.tier;
  // a named bag reads as the grade of the listed bag whose comfort is nearest its own
  if (g.type === 'named') {
    const base = Object.values(BAG_TYPES).map((b) => b.comfort);
    return 1 + base.indexOf(base.reduce((a, b) => (Math.abs(b - g.comfort) < Math.abs(a - g.comfort) ? b : a)));
  }
  return Math.max(1, ['sack', 'pack', 'frame'].indexOf(g.type) + 1);
}
export function gearIcon(g: Gear): string {
  if (g.kind === 'weapon') return I.weaponIcon(g.fam, false);
  if (g.kind === 'tool') return I.toolIcon(g.node, g.tier);
  return I.bagIcon(g.type);
}

// ------------------------------------------------------- where things come from
const SEG_WAVES = ['waves 1–4', 'waves 5–8', 'waves 9–12'];
const NODE_WORD: Record<NodeKind, string> = { ore: 'veins', wood: 'trees', herb: 'reeds' };
export function matSource(id: string): string {
  const m = MATS[id];
  if (!m) return '';
  for (const kind of Object.keys(NODE_MAT) as NodeKind[]) {
    const seg = NODE_MAT[kind].indexOf(id);
    if (seg >= 0) {
      const ground = (Object.keys(GROUNDS) as Ground[]).find((g) => GROUNDS[g].node === kind)!;
      return `${GROUNDS[ground].name} ${NODE_WORD[kind]}, ${SEG_WAVES[seg]}${seg > 0 ? ` (past boss gate ${seg})` : ''}`;
    }
  }
  const fam = FAMS.find((f) => WEAPONS[f].harvest === id);
  if (fam) return `Left by enemies killed with a ${WEAPONS[fam].name.toLowerCase()}, or by the heavy swing or an ability while ${WEAPONS[fam].ability.name} is the selected ability. The camp shop sells every weapon family during an expedition`;
  const elite = ELITES.find((e) => e.part === id);
  if (elite) return `Carried by ${elite.name}, a named elite of the ${GROUNDS[elite.ground].name.toLowerCase()} (take a route marked "Named elite")`;
  const bi = BOSSES.findIndex((b) => b.part === id);
  if (bi >= 0) return `Dropped by ${BOSSES[bi].name} when it dies (wave ${(bi + 1) * 4}); a second is in its chest if you broke every plate of its armour`;
  return '';
}
/** Names of what a material is spent on in town. */
export function matUses(id: string): string[] {
  const out: string[] = [];
  const m = MATS[id];
  for (let t = 1; t <= 3; t++) {
    if (NODE_MAT.ore[t - 1] === id) out.push(`${GRADE[t]} weapons and tools`);
    if (t > 1 && NODE_MAT.wood[t - 1] === id) out.push(`${GRADE[t]} weapons and tools`);
  }
  const fam = FAMS.find((f) => WEAPONS[f].harvest === id);
  if (fam) out.push(`${WEAPONS[fam].name}s (any grade)`);
  if (id === 'hide') out.push('Skinning knife');
  for (const b of Object.values(BAG_TYPES)) if (b.cost[id]) out.push(b.name);
  for (const pat of Object.values(PATTERNS)) if (pat.cost[id]) out.push(pat.name);
  for (const s of Object.keys(STATION_T2) as StationId[]) if (STATION_T2[s][id]) out.push(`${STATIONS[s].name} tier II`);
  for (const t of [3, 4, 5]) if (STATION_COST[t][id]) out.push(`Station tier ${roman(t)}`);
  if (m?.fx) out.push('Brewing');
  if (m && ['ore', 'wood', 'herb', 'creature'].includes(m.cat)) out.push('Camp crafts');
  return [...new Set(out)];
}
export function schemSource(id: string): string {
  const s = SCHEMATICS[id];
  if (!s) return '';
  const where: Record<string, string> = {
    elite: 'Dropped by named elites (routes marked "Named elite")', shrine: 'The prize of a shrine route',
    boss1: 'From the chest of The Foreman (wave 4)', boss2: 'From the chest of The Broodmother (wave 8)', boss3: 'From the chest of The Kiln (wave 12)',
  };
  return where[s.source] ?? SOURCE_NAME[s.source];
}

// --------------------------------------------------------------- describe
function perkLines(perks: string[], quality: number): PerkLine[] {
  return perks.filter((x) => PERKS[x]).map((x) => ({ icon: I.modIcon(first(PERKS[x].mods)), name: PERKS[x].name, text: cap(modText(PERKS[x].mods, quality)) }));
}
function modLines(mods: Mod[]): PerkLine[] {
  return mods.map((m) => ({ icon: I.modIcon(m[0]), name: '', text: cap(modText([m])) }));
}

export function describeGear(g: Gear, c: Ctx): Desc {
  const l = c.p.loadout;
  const base: Desc = { ref: `gear:${g.uid}`, icon: gearIcon(g), name: g.name, rarity: gearRarity(g), type: '', tier: gearTier(g), stats: [], perks: [], notes: [] };
  if (g.kind === 'weapon') {
    const d = WEAPONS[g.fam];
    const q = perkQuality(g.gs);
    base.type = `${d.name} · ${RARITY_NAME[base.rarity]} weapon`;
    base.gs = g.gs;
    base.stats = [
      ['Ability', `${d.ability.name} (${d.ability.cd}s base cooldown)`], // before Focus and other cooldown effects
      ['Perk strength', `×${q.toFixed(2)}`],
      ['Kills leave', MATS[d.harvest].name],
    ];
    base.perks = perkLines(g.perks, q);
    base.notes = [`${d.ability.text}.`, `Brought on an expedition it starts as a tier I ${d.name.toLowerCase()}; its ability and perks last the whole run.`];
    if (l.weapons.includes(g.uid)) base.warn = 'In your loadout';
  } else if (g.kind === 'tool') {
    const t = TOOLS[g.node];
    base.type = `${t.name} · grade ${roman(g.tier)} tool`;
    base.perks = modLines(t.mods(g.tier));
    base.notes = [t.text];
    if (l.tool === g.uid) base.warn = 'In your loadout';
  } else {
    base.type = `Bag${g.type === 'named' ? ' · named' : ''}`;
    base.stats = [['Comfort', `${g.comfort} weight`]];
    if (g.burden) base.stats.push(['Lightens', `${cap(g.burden)} −40% weight`]);
    base.notes = ['Carried weight above the comfort slows you and your stamina, up to 45%.'];
    if (l.bag === g.uid) base.warn = 'In your loadout';
  }
  return base;
}

export function describeMat(id: string, c: Ctx, qty?: number): Desc {
  const m = MATS[id];
  if (!m) return unknown(`mat:${id}`);
  const catName = { ore: 'Ore', wood: 'Wood', herb: 'Herb', creature: 'Creature part', part: m.tier >= 2 || BOSSES.some((b) => b.part === id) ? 'Boss part' : 'Elite part' }[m.cat];
  const d: Desc = {
    ref: `mat:${id}`, icon: I.matIcon(id), name: m.name, rarity: m.cat === 'part' ? (BOSSES.some((b) => b.part === id) ? 4 : 3) : clamp(m.tier - 1), type: `${catName}${m.cat === 'part' ? '' : ` · tier ${roman(m.tier)}`}`,
    tier: m.cat === 'part' ? undefined : m.tier, qty: qty ?? c.p.bank[id] ?? 0, stats: [['Weight', `${m.weight} each`]], perks: [], notes: [], source: matSource(id),
  };
  const sell = M.sellValue(id);
  if (sell > 0) d.stats.push(['Sells for', `${sell / 2} coin each`]);
  const uses = matUses(id);
  if (uses.length) d.stats.push(['Used for', `${uses.slice(0, 5).join(', ')}${uses.length > 5 ? ` and ${uses.length - 5} more` : ''}`]);
  if (m.fx) {
    const known = c.p.book[id] ?? [];
    d.perks = [...known.map((x) => ({ icon: I.modIcon(first(ATOMS[x].mods(1))), name: ATOMS[x].name, text: 'Reagent effect' })),
      ...(known.length < 4 ? [{ icon: I.uiIcon('help'), name: `${4 - known.length} unknown`, text: 'Brew it with another reagent to find out' }] : [])];
  }
  return d;
}

export function describeBrew(key: string, c: Ctx): Desc {
  const b = M.parseBrew(key);
  const vol = b.atoms.map((x) => ATOMS[x]?.volatile).filter(Boolean);
  return {
    ref: `brew:${key}`, icon: I.brewIcon(b.form, MATS_COLOR[b.atoms[0]] ?? '#9fd0c0'), name: cap(brewName(b)), rarity: clamp(b.atoms.length), type: FORM[b.form].name,
    qty: c.p.brews[key] ?? 0, stats: [['Lasts', FORM[b.form].lasts]], perks: modLines(brewMods(b)), notes: [], warn: vol.length ? `Volatile: ${vol.join('; ')}` : undefined,
    source: 'Brewed at the apothecary',
  };
}
const MATS_COLOR: Record<string, string> = {
  burn: '#ff8a3c', chill: '#8fd8ff', chain: '#e6e06a', leech: '#d0605e', haste: '#b8c95a', magnet: '#b18cff', thorns: '#7bb661', might: '#e2504a', guard: '#7f9db6',
  feather: '#e6d9f2', frenzy: '#ff5a2a', greed: '#ffd34d', detonate: '#ffb347', slip: '#6fd0e0', quick: '#c9b27a',
};
export const atomColor = (id: string) => MATS_COLOR[id] ?? '#9fd0c0';

export function describeSchem(id: string, c: Ctx): Desc {
  const s = SCHEMATICS[id];
  if (!s) return unknown(`schem:${id}`);
  const learned = c.p.codex.includes(id);
  const held = c.p.schematics[id] ?? 0;
  const d: Desc = {
    ref: `schem:${id}`, icon: I.schemIcon(s.kind), name: s.name, rarity: s.kind === 'recipe' ? 2 : s.kind === 'pattern' ? 3 : 4, type: cap(s.kind), qty: held, stats: [], perks: [], notes: [], source: schemSource(id),
  };
  if (s.kind === 'recipe') {
    d.notes.push(RECIPES[s.ref]?.text ?? '');
    d.notes.push(learned ? 'Learned for good. A spare copy breaks into a fragment.' : 'Learn it to add the recipe to your notebook for good.');
  } else if (s.kind === 'pattern') {
    const pat = PATTERNS[s.ref];
    d.notes.push(pat.text, `Used once at the ${pat.station}; the pattern is consumed.`);
    d.stats.push(['Needs', Object.entries(pat.cost).map(([m, n]) => `${n} ${MATS[m].name.toLowerCase()}`).join(', ')]);
  } else {
    const [station, tier] = s.ref.split('-');
    d.notes.push(`Needed to raise the ${station} to tier ${roman(Number(tier))}: ${STATIONS[station as StationId].tiers[Number(tier) - 1]}.`);
  }
  return d;
}

export function describeRunWeapon(wi: { fam: Fam; tier: number; gs: number; variant: boolean; evolved: boolean }, ref: string, c: Ctx): Desc {
  const w = { dmg: 0, kills: 0, ...wi };
  const d = WEAPONS[w.fam];
  const dmg = d.dmg * TIER_MUL[w.tier] * (0.9 + 0.2 * w.gs) * (w.evolved ? EVOLVE_MUL : 1);
  const [c1, b1, c2, b2] = d.set;
  const pts = c.run ? R.famCounts(c.run)[w.fam] ?? 0 : 0;
  const desc: Desc = {
    ref, icon: I.weaponIcon(w.fam, w.evolved), name: R.weaponName(w), rarity: w.evolved ? 4 : clamp(w.tier - 1), type: `${d.name} · tier ${roman(w.tier)}${w.evolved ? ' · evolved' : w.variant ? ' · variant' : ''}`,
    tier: w.tier,
    // the roll is not called gear score here: that name belongs to the weapons forged in town
    stats: [['Damage', `${dmg.toFixed(0)} every ${d.every}s`], ['Per second', (dmg / d.every).toFixed(1)], ['Range', String(Math.round(d.range * (w.fam === 'blade' && w.evolved ? 1.8 : 1)))], ['Quality of this roll', `${Math.round(w.gs * 100)}% (damage ×${(0.9 + 0.2 * w.gs).toFixed(2)})`], ['Kills leave', MATS[d.harvest].name]],
    perks: [], notes: [w.evolved ? cap(d.evolvedText) + '.' : d.text],
  };
  desc.perks.push({ icon: I.famIcon(w.fam), name: `${d.name} set ${pts}/${pts >= c1 ? c2 : c1}`, text: `At ${c1} tier points: ${modText(b1)}. At ${c2}: ${modText(b2)}. A tier III weapon counts three.` });
  if (w.variant && !w.evolved) desc.perks.push({ icon: I.uiIcon('star'), name: RECIPES[`var-${w.fam}`].name, text: RECIPES[`var-${w.fam}`].text });
  return desc;
}

function option(ref: string, icon: string, name: string, type: string, text: string, mods: Mod[] = [], rarity: Rarity = 0): Desc {
  return { ref, icon, name, rarity, type, stats: [], perks: text ? [] : modLines(mods), notes: text ? [text] : [] };
}
function unknown(ref: string): Desc {
  return { ref, icon: I.uiIcon('help'), name: 'Unknown', rarity: 0, type: '', stats: [], perks: [], notes: [] };
}

/** Resolve any reference to its description. Unknown references never throw. */
export function describe(ref: string, c: Ctx): Desc {
  const i = ref.indexOf(':');
  const kind = i < 0 ? ref : ref.slice(0, i);
  const id = i < 0 ? '' : ref.slice(i + 1);
  switch (kind) {
    case 'gear': {
      const g = M.gearBy(c.p, Number(id));
      return g ? describeGear(g, c) : unknown(ref);
    }
    case 'mat': return describeMat(id, c);
    case 'bag': { // a material in the expedition bag: its count there, and what the stack weighs
      const n = c.run?.bagMats[id] ?? 0;
      const d = describeMat(id, c, n);
      if (c.run && MATS[id]) d.stats.splice(1, 0, ['This stack weighs', (n * MATS[id].weight * (c.run.burden === MATS[id].cat ? 0.6 : 1) * Math.max(0, 1 - R.runMods(c.run).weight)).toFixed(1)]);
      return d;
    }
    case 'brew': return describeBrew(id, c);
    case 'schem': return describeSchem(id, c);
    case 'rw': {
      const w = c.run?.weapons[Number(id)];
      return w ? describeRunWeapon(w, ref, c) : unknown(ref);
    }
    case 'wpn': {
      const [fam, tier] = id.split(':');
      return WEAPONS[fam as Fam] ? describeRunWeapon({ fam: fam as Fam, tier: Number(tier) || 1, gs: 0.5, variant: false, evolved: false }, ref, c) : unknown(ref);
    }
    case 'item': {
      const it = ITEMS[id];
      if (!it) return unknown(ref);
      const d = option(ref, I.itemIcon(id), it.name, `Item · tier ${roman(it.tier)}`, it.heal ? `Heals ${it.heal} health now.` : '', it.mods, clamp(it.tier - 1));
      d.tier = it.tier;
      return d;
    }
    case 'perk': return PERKS[id] ? option(ref, I.modIcon(first(PERKS[id].mods)), PERKS[id].name, 'Weapon perk', '', PERKS[id].mods, 1) : unknown(ref);
    case 'pick': {
      const x = LEVEL_PICKS.find((q) => q.id === id);
      return x ? option(ref, I.modIcon(first(x.mods)), x.name, 'Level-up pick', '', x.mods) : unknown(ref);
    }
    case 'wild': {
      const x = WILDS.find((q) => q.id === id);
      return x ? option(ref, I.modIcon(first(x.mods.length ? x.mods : [['dmg', 0]])), x.name, 'Wild pick', x.text, [], 3) : unknown(ref);
    }
    case 'card': {
      const x = CARDS.find((q) => q.id === id);
      return x ? option(ref, I.uiIcon('standing'), x.name, `Standing card · ${c.p.standing.cards[id] ?? 0}/${x.max} held`, x.text, [], 2) : unknown(ref);
    }
    case 'kit': {
      const x = KITS.find((q) => q.id === id);
      return x ? option(ref, I.uiIcon('equip'), x.name, x.rank ? `Kit · mastery rank ${x.rank}` : 'Kit', x.text, [], 1) : unknown(ref);
    }
    case 'recipe': {
      const x = RECIPES[id];
      return x ? option(ref, x.fam ? I.weaponIcon(x.fam, x.kind === 'evolution') : I.modIcon(first(x.mods ?? [['regen', 1]])), x.name, x.kind === 'camp' ? 'Camp recipe' : x.kind === 'variant' ? 'Weapon variant recipe' : 'Evolution recipe', x.text, [], x.kind === 'evolution' ? 3 : 1) : unknown(ref);
    }
    case 'mut': return MUTATORS[id] ? option(ref, I.uiIcon('skull'), MUTATORS[id].name, 'This week', MUTATORS[id].text) : unknown(ref);
    case 'tool': {
      const [node, tier] = id.split(':');
      const t = TOOLS[node as GearTool['node']];
      if (!t) return unknown(ref);
      const d = option(ref, I.toolIcon(node as GearTool['node'], Number(tier) || 1), `${GRADE[Number(tier) || 1]} ${t.name.toLowerCase()}`, `${t.name} · grade ${roman(Number(tier) || 1)} tool`, '', t.mods(Number(tier) || 1), clamp((Number(tier) || 1) - 1));
      d.notes = [t.text];
      d.tier = Number(tier) || 1;
      return d;
    }
    default: return unknown(ref);
  }
}
