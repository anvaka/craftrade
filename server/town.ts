import type { GiveReq, GiveRes, StationId, TownRes } from '../src/shared/protocol.ts';
import { RAWS, emptyRaws, type RawBag } from '../src/shared/vocab.ts';
import { MAX_STATION_TIER, PROJECT_UNIT, STATIONS, featuresFor, projectScale } from './config.ts';
import { tx } from './db.ts';
import { ApiErr, bad } from './errors.ts';
import { activePlayers, logLedger, move, playerById, profile, stations, type Ctx, type Player } from './players.ts';

interface ProjectRow {
  id: number; station: StationId; to_tier: number;
  need_timber: number; need_ore: number; need_hide: number;
  have_timber: number; have_ore: number; have_hide: number;
}

const need = (p: ProjectRow): RawBag => ({ timber: p.need_timber, ore: p.need_ore, hide: p.need_hide });
const have = (p: ProjectRow): RawBag => ({ timber: p.have_timber, ore: p.have_ore, hide: p.have_hide });

/**
 * The active project, starting the next one if there is none. Stations take
 * turns; a station at the top tier is skipped. The target is fixed when the
 * project starts, from the number of players active that week.
 */
function activeProject(ctx: Ctx): ProjectRow | undefined {
  const open = ctx.db.prepare('SELECT * FROM projects WHERE done = 0 ORDER BY id LIMIT 1').get() as ProjectRow | undefined;
  if (open) return open;
  const last = ctx.db.prepare('SELECT station FROM projects ORDER BY id DESC LIMIT 1').get() as { station: StationId } | undefined;
  const tiers = stations(ctx);
  const from = last ? STATIONS.indexOf(last.station) + 1 : 0;
  const station = STATIONS.map((_, i) => STATIONS[(from + i) % STATIONS.length]).find((s) => tiers[s] < MAX_STATION_TIER);
  if (!station) return undefined;
  const toTier = tiers[station] + 1;
  const mul = (toTier - 1) * projectScale(activePlayers(ctx));
  const unit = PROJECT_UNIT[station];
  ctx.db
    .prepare('INSERT INTO projects (station, to_tier, need_timber, need_ore, need_hide, created) VALUES (?, ?, ?, ?, ?, ?)')
    .run(station, toTier, unit.timber * mul, unit.ore * mul, unit.hide * mul, ctx.now());
  return activeProject(ctx);
}

/** Add raws to the project, up to what it still needs. Returns what was taken. Finishes the project when full. */
function contribute(ctx: Ctx, offered: Partial<RawBag>): RawBag {
  const p = activeProject(ctx);
  const taken = emptyRaws();
  if (!p) return taken;
  const n = need(p);
  const h = have(p);
  for (const raw of RAWS) taken[raw] = Math.max(0, Math.min(offered[raw] ?? 0, n[raw] - h[raw]));
  ctx.db
    .prepare('UPDATE projects SET have_timber = have_timber + ?, have_ore = have_ore + ?, have_hide = have_hide + ? WHERE id = ?')
    .run(taken.timber, taken.ore, taken.hide, p.id);
  if (RAWS.every((raw) => h[raw] + taken[raw] >= n[raw])) {
    ctx.db.prepare('UPDATE projects SET done = 1 WHERE id = ?').run(p.id);
    ctx.db.prepare('UPDATE stations SET tier = ? WHERE id = ?').run(p.to_tier, p.station);
    activeProject(ctx); // start the next one
  }
  return taken;
}

/** A share of sale tax counts toward the project: one mark fills one unit of whatever is most needed. */
export function taxToTown(ctx: Ctx, marks: number) {
  const p = activeProject(ctx);
  if (!p || marks <= 0) return;
  const left = RAWS.map((raw) => need(p)[raw] - have(p)[raw]);
  const add = emptyRaws();
  for (let m = marks; m > 0; m--) {
    const i = left.indexOf(Math.max(...left));
    if (left[i] <= 0) break;
    left[i]--;
    add[RAWS[i]]++;
  }
  const taken = contribute(ctx, add);
  logLedger(ctx, null, 'tax_to_town', taken, `project ${p.id}`);
}

export function townView(ctx: Ctx): TownRes {
  return tx(ctx.db, () => {
    const p = activeProject(ctx);
    return {
      stations: stations(ctx),
      project: p ? { station: p.station, toTier: p.to_tier, need: need(p), have: have(p) } : null,
      givers: ctx.db.prepare('SELECT name, standing AS given FROM players WHERE standing > 0 ORDER BY standing DESC, id LIMIT 10').all() as TownRes['givers'],
      activePlayers: activePlayers(ctx),
    };
  });
}

export function give(ctx: Ctx, player: Player, req: GiveReq): GiveRes {
  return tx(ctx.db, () => {
    if (!featuresFor(playerById(ctx, player.id).runs).includes('town')) {
      throw new ApiErr(403, 'locked', 'The town project is not unlocked yet.');
    }
    if (!activeProject(ctx)) throw bad('no_project', 'Every station is at its top tier.');
    const taken = contribute(ctx, req.raws);
    const total = taken.timber + taken.ore + taken.hide;
    if (total === 0) throw bad('not_needed', 'The project does not need those raws.');
    move(ctx, player.id, 'town_give', { timber: -taken.timber, ore: -taken.ore, hide: -taken.hide }, 'town project');
    ctx.db.prepare('UPDATE players SET standing = standing + ? WHERE id = ?').run(total, player.id);
    return { profile: profile(ctx, player.id), town: townView(ctx) };
  });
}
