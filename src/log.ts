// The play log: what happened in every wave, at every camp and in town, kept in this browser only.
// It exists so a session can be handed to someone else (a file or a paste) and read for balance: where runs end,
// what was bought, what each weapon did, how far heat was pushed. Nothing here changes the game and nothing is sent anywhere.
// `npm run log -- <file>` prints a report from an exported file (scripts/log-report.ts).
import { CFG, GROUNDS, ITEMS, KITS, RECIPES, WEAPONS, WILDS, brewName } from './data';
import type { WaveResult } from './game';
import * as M from './meta';
import * as R from './run';

const KEY = 'craftworld.log.v1';
const MAX_RUNS = 300;
const MAX_TOWN = 3000;

export interface LogWave {
  i: number; // wave index, 0-based
  ground: string;
  objective: string;
  objDone: boolean;
  boss: boolean;
  bossKilled: boolean;
  curse: string | null;
  secs: number;
  died: boolean;
  killer?: string;
  hpStart: number;
  hpEnd: number; // as the wave ended, before the rest
  maxHp: number;
  dmgTaken: number;
  kills: number;
  hotSpawned: number; // enemies that came because of heat
  heatPeak: number;
  heatEnd: number;
  gatherSecs: number;
  gathered: Record<string, number>;
  heatBonus: number; // node units heat added
  bagWeight: number; // after the wave
  comfort: number;
  scrap: number; // earned in the wave
  xp: number;
  level: number; // after the wave
  weapons: { w: string; dmg: number; kills: number }[]; // each slot's damage and kills in this wave
  heavyDmg: number;
  abilityDmg: number;
  elites: string[];
}
export interface LogEvent {
  w: number; // the wave that comes next (0-based) when it happened
  a: string; // buy, reroll, merge, sell, craft, drink, route, levelpick, wild, evolve, chest, push, extract ...
  what?: string;
  scrap?: [number, number]; // before, after
  hp?: [number, number];
}
export interface LogRun {
  id: string;
  at: string; // ISO time the first wave ended (or the run ended, if no wave did)
  kit: string;
  danger: number;
  race: boolean;
  guidedStep: number | null; // 1..3 during the guided start
  mutators: string[];
  screen: [number, number];
  touch: boolean;
  brought: { weapons: string[]; tool: string; bag: string; flasks: number; charms: number; oil: boolean; recipes: string[] };
  town: { runs: number; key: number; coin: number; standing: number; skills: Record<string, number>; mastery: Record<string, number>; stations: Record<string, number> };
  waves: LogWave[];
  events: LogEvent[];
  end?: {
    at: string;
    outcome: string;
    wavesCleared: number;
    level: number;
    secs: number;
    weapons: string[];
    items: string[];
    picks: string[];
    wilds: string[];
    scrapLeft: number;
    kept: Record<string, number>;
    lost: Record<string, number>;
    schematics: string[];
    coin: number;
    keyUp: boolean;
    keyWhy: string;
  };
}
export interface LogTown {
  at: string;
  a: string;
  what?: string;
  coin: number;
}
export interface PlayLog {
  v: 1;
  since: string;
  runs: LogRun[];
  town: LogTown[];
}

let log: PlayLog | null = null;
const fresh = (): PlayLog => ({ v: 1, since: new Date().toISOString(), runs: [], town: [] });
const on = () => M.persisting() && typeof localStorage !== 'undefined';

function load(): PlayLog {
  if (log) return log;
  log = fresh();
  if (!on()) return log;
  try {
    const raw = localStorage.getItem(KEY);
    const x = raw ? (JSON.parse(raw) as PlayLog) : null;
    if (x && x.v === 1 && Array.isArray(x.runs) && Array.isArray(x.town)) log = x;
  } catch {
    /* an unreadable log starts over; the save is not touched */
  }
  return log;
}
function write(): void {
  if (!on() || !log) return;
  if (log.runs.length > MAX_RUNS) log.runs.splice(0, log.runs.length - MAX_RUNS);
  if (log.town.length > MAX_TOWN) log.town.splice(0, log.town.length - MAX_TOWN);
  for (let tries = 0; tries < 4; tries++) {
    try {
      localStorage.setItem(KEY, JSON.stringify(log));
      return;
    } catch {
      // storage is full: the save matters more than the log, so the oldest fifth goes
      if (!log.runs.length && !log.town.length) return;
      log.runs.splice(0, Math.ceil(log.runs.length / 5));
      log.town.splice(0, Math.ceil(log.town.length / 5));
    }
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const weaponWord = (w: { fam: keyof typeof WEAPONS; tier: number; evolved: boolean; variant: boolean }) => `${R.weaponName(w as Parameters<typeof R.weaponName>[0])}${w.evolved ? ' (evolved)' : w.variant ? ' (variant)' : ''}`;
const lvls = (rec: Record<string, { lvl: number }>) => Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, v.lvl]));

/** The log entry of this expedition, made the first time it is needed. */
function entry(p: M.Profile, run: R.RunState): LogRun {
  const l = load();
  const tagged = run as R.RunState & { logId?: string };
  let e = tagged.logId ? l.runs.find((x) => x.id === tagged.logId) : undefined;
  if (e) return e;
  tagged.logId = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  const gear = (uid: number | null | undefined) => (uid == null ? undefined : M.gearBy(p, uid));
  const b = run.brought;
  const wpn = (b ? b.weapons : p.loadout.weapons).map(gear).filter((g) => g?.kind === 'weapon')
    .map((g) => (g?.kind === 'weapon' ? `${g.name} · gs ${g.gs} · ${g.perks.join('+') || 'no perks'}` : ''));
  const tool = gear(b ? b.tool : p.loadout.tool);
  const bag = gear(b ? b.bag : p.loadout.bag);
  e = {
    id: tagged.logId, at: new Date().toISOString(), kit: run.kit, danger: run.keyLevel, race: run.race,
    guidedStep: p.guided && p.sessions < M.GUIDE_STEPS ? p.sessions + 1 : null,
    mutators: [...run.mutators],
    screen: typeof innerWidth === 'number' ? [innerWidth, innerHeight] : [0, 0],
    touch: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
    brought: {
      weapons: wpn, tool: tool?.kind === 'tool' ? `${tool.name} (grade ${tool.tier})` : 'none', bag: bag?.kind === 'bag' ? `${bag.name} (comfort ${bag.comfort})` : 'none',
      flasks: run.flasks.length + (run.flaskActive ? 1 : 0), charms: run.charms.length, oil: !!run.oil,
      recipes: [...run.recipes],
    },
    town: { runs: p.stats.runs, key: p.key, coin: p.coin, standing: p.standing.lvl, skills: lvls(p.skills), mastery: lvls(p.fams), stations: { ...p.stations } },
    waves: [], events: [],
  };
  l.runs.push(e);
  return e;
}

/** A wave has just been applied to the run. */
export function wave(p: M.Profile, run: R.RunState, res: WaveResult): void {
  if (!on()) return;
  try {
    const e = entry(p, run);
    const i = run.last?.index ?? e.waves.length;
    const n = run.weapons.length;
    e.waves.push({
      i, ground: run.route.ground, objective: run.route.objective === 'elite' ? `elite:${run.route.elite ?? ''}` : run.route.objective, objDone: res.objective,
      boss: R.isBossWave(i), bossKilled: res.bossKilled, curse: run.curse,
      secs: r1(res.time), died: res.died, killer: res.died ? res.killer : undefined,
      hpStart: Math.round(res.hpStart ?? 0), hpEnd: Math.round(res.hp), maxHp: R.maxHp(run),
      dmgTaken: Math.round(res.dmgTaken), kills: res.kills, hotSpawned: res.hotSpawned ?? 0,
      heatPeak: Math.round(res.heatPeak), heatEnd: Math.round(res.heat), gatherSecs: r1(res.gatherTime),
      gathered: { ...res.gathered }, heatBonus: res.heatBonus ?? 0, bagWeight: r1(R.bagWeight(run)), comfort: run.comfort,
      scrap: Math.round(res.scrap), xp: Math.round(res.xp), level: run.level,
      weapons: run.weapons.map((w, k) => ({ w: weaponWord(w), dmg: Math.round(res.dmgBy[k] ?? 0), kills: res.killsBy[k] ?? 0 })),
      heavyDmg: Math.round(res.dmgBy[n] ?? 0), abilityDmg: Math.round(res.dmgBy[n + 1] ?? 0),
      elites: [...res.elitesKilled],
    });
    write();
  } catch (err) {
    console.warn('play log: wave not recorded', err);
  }
}

/** What a camp, tally or gate action is, in words, read before it is applied. */
export function describeAction(run: R.RunState, a: string, v: string): string | undefined {
  const i = Number(v);
  switch (a) {
    case 'buy': {
      const o = run.shop[i];
      return o ? `${o.kind === 'weapon' ? `${WEAPONS[o.fam!].name} ${['', 'I', 'II', 'III', 'IV', 'V'][o.tier] ?? o.tier}` : ITEMS[o.item ?? '']?.name ?? o.item} for ${o.price}` : undefined;
    }
    case 'sell': case 'evolve': return run.weapons[i] ? weaponWord(run.weapons[i]) : undefined;
    case 'merge': return v;
    case 'craft': return RECIPES[v]?.name ?? v;
    case 'drink': return run.flasks[i] ? brewName(run.flasks[i]) : undefined;
    case 'route': {
      const r = run.routeOptions[i];
      return r ? `${GROUNDS[r.ground].name} · ${r.objective}${r.elite ? `:${r.elite}` : ''}${r.shrine ? ` · shrine ${r.shrine.curse}` : ''}` : undefined;
    }
    case 'levelpick': return v;
    case 'wild': return WILDS.find((x) => x.id === v)?.name ?? (v ? v : 'declined');
    case 'reroll': return `cost ${R.rerollCost(run)}`;
    default: return undefined;
  }
}
export const RUN_ACTIONS = ['buy', 'reroll', 'merge', 'sell', 'unsell', 'craft', 'drink', 'route', 'levelpick', 'wild', 'evolve', 'chest', 'push', 'extract', 'lock'];
/** A camp, tally or gate action was applied. `before` is the scrap and health it started from. */
export function action(p: M.Profile, run: R.RunState, a: string, what: string | undefined, before: { scrap: number; hp: number }): void {
  if (!on()) return;
  try {
    const ev: LogEvent = { w: run.wave, a };
    if (what) ev.what = what;
    if (run.scrap !== before.scrap) ev.scrap = [before.scrap, run.scrap];
    if (Math.round(run.hp) !== Math.round(before.hp)) ev.hp = [Math.round(before.hp), Math.round(run.hp)];
    entry(p, run).events.push(ev);
    write();
  } catch (err) {
    console.warn('play log: action not recorded', err);
  }
}

/** The expedition is over and has been applied to the profile. */
export function finish(p: M.Profile, run: R.RunState, s: M.Summary): void {
  if (!on()) return;
  try {
    const e = entry(p, run);
    if (e.end) return;
    e.end = {
      at: new Date().toISOString(), outcome: s.outcome, wavesCleared: s.waves, level: run.level, secs: Math.round(run.totals.time),
      weapons: run.weapons.map(weaponWord), items: [...run.items], picks: [...run.picks], wilds: [...run.wilds], scrapLeft: run.scrap,
      kept: { ...s.kept }, lost: { ...s.lost }, schematics: [...s.schemKept], coin: s.coin, keyUp: s.keyUp, keyWhy: s.keyWhy,
    };
    write();
  } catch (err) {
    console.warn('play log: end not recorded', err);
  }
}

export const TOWN_ACTIONS = ['make', 'brew', 'sellmat', 'donate', 'scrapgear', 'learn', 'break', 'redeem', 'card', 'vault', 'equip', 'kit', 'keyset', 'ground', 'start', 'race', 'abandon', 'guided', 'openall'];
/** Something was done in town. */
export function town(p: M.Profile, a: string, what: string | undefined, coinBefore: number): void {
  if (!on()) return;
  try {
    const ev: LogTown = { at: new Date().toISOString(), a, coin: p.coin };
    if (what) ev.what = what;
    if (p.coin !== coinBefore) ev.what = `${ev.what ? `${ev.what} · ` : ''}coin ${coinBefore} → ${p.coin}`;
    load().town.push(ev);
    write();
  } catch (err) {
    console.warn('play log: town action not recorded', err);
  }
}

// ------------------------------------------------------------------ export
export function info(): { runs: number; town: number; kb: number; since: string } {
  const l = load();
  return { runs: l.runs.length, town: l.town.length, kb: Math.round(JSON.stringify(l).length / 1024), since: l.since };
}
/** The whole log with the state of the town now, as text to save or paste. */
export function exportText(p: M.Profile): string {
  const l = load();
  const kitName = (id: string) => KITS.find((k) => k.id === id)?.name ?? id;
  return JSON.stringify({
    game: 'craft-world', log: 1, exported: new Date().toISOString(), waves: CFG.waveDur.length,
    now: {
      coin: p.coin, key: p.key, guided: p.guided, sessions: p.sessions, stats: p.stats, standing: { lvl: p.standing.lvl, cards: p.standing.cards },
      skills: lvls(p.skills), mastery: lvls(p.fams), stations: p.stations, kit: kitName(p.loadout.kit), kitBest: p.kitBest, records: p.records,
      gear: p.gear.map((g) => (g.kind === 'weapon' ? `${g.name} gs ${g.gs} [${g.perks.join('+')}]` : g.kind === 'bag' ? `${g.name} comfort ${g.comfort}` : `${g.name} grade ${g.tier}`)),
      bank: p.bank, brews: p.brews, codex: p.codex.length, schematics: p.schematics,
    },
    since: l.since, runs: l.runs, town: l.town,
  });
}
export function clear(): void {
  log = fresh();
  if (on()) localStorage.removeItem(KEY);
}
