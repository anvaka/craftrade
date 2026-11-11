import type { GiveReq, GiveRes, StationId, TownPerk, TownProject, TownRes } from '../src/shared/protocol.ts';
import { RAWS, emptyRaws, type RawBag, type RawId } from '../src/shared/vocab.ts';
import { awardTitles, note } from './almanac.ts';
import { FACTOR, MAX_STATION_TIER, PROJECT_UNIT, STATIONS, WORKS, WORKS_PERK_MS, featuresFor, projectScale } from './config.ts';
import { tx } from './db.ts';
import { ApiErr, bad } from './errors.ts';
import { once } from './idem.ts';
import { activePlayers, logLedger, move, playerById, profile, stations, type Ctx, type Player } from './players.ts';

interface ProjectRow {
  id: number; station: string; to_tier: number; kind: 'station' | 'works';
  need_timber: number; need_ore: number; need_hide: number;
  have_timber: number; have_ore: number; have_hide: number;
}

const need = (p: ProjectRow): RawBag => ({ timber: p.need_timber, ore: p.need_ore, hide: p.need_hide });
const have = (p: ProjectRow): RawBag => ({ timber: p.have_timber, ore: p.have_ore, hide: p.have_hide });
const worksOf = (id: string) => WORKS.find((w) => w.id === id);

/**
 * The active project, starting the next one if there is none. Stations take
 * turns; a station at the top tier is skipped. When every station is at the
 * top, the town turns to works, one after another, for ever. A target is
 * fixed when its project starts, from the number of players with a paid run
 * that week.
 */
function activeProject(ctx: Ctx): ProjectRow {
  const open = ctx.db.prepare('SELECT * FROM projects WHERE done = 0 ORDER BY id LIMIT 1').get() as ProjectRow | undefined;
  if (open) return open;
  const scale = projectScale(activePlayers(ctx));
  const start = ctx.db.prepare('INSERT INTO projects (station, to_tier, kind, need_timber, need_ore, need_hide, created) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const last = ctx.db.prepare(`SELECT station FROM projects WHERE kind = 'station' ORDER BY id DESC LIMIT 1`).get() as { station: StationId } | undefined;
  const tiers = stations(ctx);
  const from = last ? STATIONS.indexOf(last.station) + 1 : 0;
  const station = STATIONS.map((_, i) => STATIONS[(from + i) % STATIONS.length]).find((s) => tiers[s] < MAX_STATION_TIER);
  if (station) {
    const toTier = tiers[station] + 1;
    const mul = (toTier - 1) * scale;
    const unit = PROJECT_UNIT[station];
    start.run(station, toTier, 'station', unit.timber * mul, unit.ore * mul, unit.hide * mul, ctx.now());
  } else {
    const prev = ctx.db.prepare(`SELECT station FROM projects WHERE kind = 'works' ORDER BY id DESC LIMIT 1`).get() as { station: string } | undefined;
    const w = WORKS[(prev ? WORKS.findIndex((x) => x.id === prev.station) + 1 : 0) % WORKS.length];
    start.run(w.id, 0, 'works', w.need.timber * scale, w.need.ore * scale, w.need.hide * scale, ctx.now());
  }
  return activeProject(ctx);
}

/** Add raws to the project, up to what it still needs. Returns what was taken. Finishes the project when full. */
function contribute(ctx: Ctx, offered: Partial<RawBag>): RawBag {
  const p = activeProject(ctx);
  const taken = emptyRaws();
  const n = need(p);
  const h = have(p);
  for (const raw of RAWS) taken[raw] = Math.max(0, Math.min(offered[raw] ?? 0, n[raw] - h[raw]));
  ctx.db
    .prepare('UPDATE projects SET have_timber = have_timber + ?, have_ore = have_ore + ?, have_hide = have_hide + ? WHERE id = ?')
    .run(taken.timber, taken.ore, taken.hide, p.id);
  if (RAWS.every((raw) => h[raw] + taken[raw] >= n[raw])) {
    ctx.db.prepare('UPDATE projects SET done = 1 WHERE id = ?').run(p.id);
    if (p.kind === 'station') ctx.db.prepare('UPDATE stations SET tier = ? WHERE id = ?').run(p.to_tier, p.station);
    // A finished works gives its perk to everyone for a week from now.
    else ctx.db.prepare('INSERT INTO perks (id, until) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET until = excluded.until').run(p.station, ctx.now() + WORKS_PERK_MS);
    activeProject(ctx); // start the next one
  }
  return taken;
}

/** What the Factor charges for one unit of a raw right now. */
function factorBuyPrice(ctx: Ctx, raw: RawId): number {
  const row = ctx.db.prepare('SELECT ref FROM factor WHERE raw = ?').get(raw) as { ref: number };
  return Math.max(2, Math.ceil(row.ref * FACTOR.buyMul));
}

/**
 * A share of sale tax goes to the project. The town spends it at the Factor's
 * price on whatever the project needs most, so tax builds no faster than the
 * same marks spent on raws would. What is left over is lost.
 */
export function taxToTown(ctx: Ctx, marks: number) {
  if (marks <= 0) return;
  const p = activeProject(ctx);
  const left = RAWS.map((raw) => need(p)[raw] - have(p)[raw]);
  const price = RAWS.map((raw) => factorBuyPrice(ctx, raw));
  const add = emptyRaws();
  for (let budget = marks; ;) {
    const i = left.indexOf(Math.max(...left));
    if (left[i] <= 0 || budget < price[i]) break;
    budget -= price[i];
    left[i]--;
    add[RAWS[i]]++;
  }
  const taken = contribute(ctx, add);
  logLedger(ctx, null, 'tax_to_town', taken, `project ${p.id}`);
}

function projectView(p: ProjectRow): TownProject {
  if (p.kind === 'works') {
    const w = worksOf(p.station);
    return { kind: 'works', toTier: 0, works: { id: p.station, name: w?.name ?? p.station, perk: w?.perk ?? '' }, need: need(p), have: have(p) };
  }
  return { kind: 'station', station: p.station as StationId, toTier: p.to_tier, need: need(p), have: have(p) };
}

export function townPerks(ctx: Ctx): TownPerk[] {
  const rows = ctx.db.prepare('SELECT id, until FROM perks WHERE until > ? ORDER BY until').all(ctx.now()) as { id: string; until: number }[];
  return rows.flatMap((r) => {
    const w = worksOf(r.id);
    return w ? [{ id: w.id, name: w.name, perk: w.perk, until: r.until }] : [];
  });
}

export function townView(ctx: Ctx): TownRes {
  return tx(ctx.db, () => ({
    stations: stations(ctx),
    project: projectView(activeProject(ctx)),
    perks: townPerks(ctx),
    givers: ctx.db.prepare('SELECT name, title, standing AS given FROM players WHERE standing > 0 ORDER BY standing DESC, id LIMIT 10').all() as TownRes['givers'],
    activePlayers: activePlayers(ctx),
  }));
}

export function give(ctx: Ctx, player: Player, req: GiveReq): GiveRes {
  return tx(ctx.db, () => {
    const done = (): GiveRes => ({ profile: profile(ctx, player.id), town: townView(ctx) });
    const act = (): GiveRes => {
      if (!featuresFor(playerById(ctx, player.id).runs).includes('town')) {
        throw new ApiErr(403, 'locked', 'The town project is not unlocked yet.');
      }
      const p = activeProject(ctx);
      const taken = contribute(ctx, req.raws);
      const total = taken.timber + taken.ore + taken.hide;
      if (total === 0) throw bad('not_needed', 'The project does not need those raws.');
      move(ctx, player.id, 'town_give', { timber: -taken.timber, ore: -taken.ore, hide: -taken.hide }, `project ${p.id}`);
      ctx.db.prepare('UPDATE players SET standing = standing + ? WHERE id = ?').run(total, player.id);
      note(ctx, player.id, p.kind === 'works' ? 'works' : 'gave', p.station, total);
      awardTitles(ctx, player.id);
      return done();
    };
    // With a key, a retry whose first try landed gives nothing more.
    return req.idem ? once(ctx, player.id, req.idem, req, act, done) : act();
  });
}
