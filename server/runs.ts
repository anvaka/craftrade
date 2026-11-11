import { createHash, createHmac, randomInt } from 'node:crypto';
import { BASE_ITEM } from '../src/shared/content/items.ts';
import { RELIC } from '../src/shared/content/relics.ts';
import { isRelic, itemPoints, itemTier, relicHas, type ItemSpec } from '../src/shared/item.ts';
import { packItem } from '../src/shared/kit.ts';
import {
  DAILY_WAVES, DEATH_RAW_KEEP, KIT_CHARGES, KIT_RELICS, RUN_WAVES,
  type CharacterId, type DailyRes, type Feature, type RunEndReq, type RunEndRes, type RunStartReq, type RunStartRes, type StationId,
} from '../src/shared/protocol.ts';
import { reportKey, type PlaybackInput, type PlaybackResult } from '../src/shared/replay.ts';
import { RAWS, emptyRaws, type RawBag } from '../src/shared/vocab.ts';
import { ENEMIES, WAVES, WAVE_PLAN, createRun, offerOdds } from '../src/sim/index.ts';
import { awardTitles, note } from './almanac.ts';
import {
  BOSS_WAVE_MIN_SECONDS, CHARACTERS, DURATION_SLACK_SECONDS, FEATURE_AT, HAZARD_MARKS, HAZARD_REPORT_SLACK, MARKS_PER_WAVE, MAX_HAZARD, MIN_REPORT_SECONDS,
  REPORT_CAPS, RUN_RATE, SCRIP_PAID_CAP, SCRIP_PER_MARK, TICKET_TTL_MS, UNCHECKED_PAY, charactersFor, featuresFor,
} from './config.ts';
import { tx } from './db.ts';
import { ApiErr, bad } from './errors.ts';
import {
  addStash, dayOf, getItem, hazardBook, heldItem, move, newId, playerById, profile, stashRoom, stashRow, stations, touch, type Ctx, type Player,
} from './players.ts';
import { rollForRun, worldNotice } from './relics.ts';

interface Ticket {
  id: string; player_id: number; mode: 'run' | 'daily' | 'practice'; character: CharacterId;
  seed: number; waves: number; kit: string; day: string; scored: number; status: string; started: number; kit_uids: string;
  hazard: number; ip: string; stations: string;
}

/** One packed item as the ticket remembers it. `spent` means its last charge went on this run. */
interface Packed { uid: string; id: string; spent: boolean }

/** True if the ticket says a relic with this effect was packed. */
const packedRelic = (t: Ticket, prim: string): boolean =>
  (JSON.parse(t.kit) as string[]).some((id) => Object.hasOwn(RELIC, id) && relicHas(RELIC[id], prim));

const seedFrom = (ctx: Ctx, what: string): number => createHmac('sha256', ctx.secret).update(what).digest().readUInt32BE(0);

/**
 * Today's clearing: the same seed and character for everyone, rotating daily.
 * The seed is keyed with a server secret, so tomorrow's cannot be worked out today.
 */
export function dailyInfo(ctx: Ctx) {
  const now = ctx.now();
  const date = dayOf(now);
  return { date, seed: seedFrom(ctx, `daily:${date}`), character: CHARACTERS[Math.floor(now / 86_400_000) % CHARACTERS.length] };
}

/** An address as the books keep it: enough to count by, not enough to read back. */
export const ipKey = (ip: string): string => (ip ? createHash('sha256').update(ip).digest('base64url').slice(0, 16) : '');

export function startRun(ctx: Ctx, player: Player, req: RunStartReq, ip = ''): RunStartRes {
  return tx(ctx.db, () => {
    const me = playerById(ctx, player.id);
    const daily = dailyInfo(ctx);
    let character = req.character;
    let seed = randomInt(0, 2 ** 32);
    let waves = RUN_WAVES;
    let scored = 0;
    let hazard = 0;
    const kit: ItemSpec[] = [];
    const packed: Packed[] = [];

    if (req.mode === 'run') {
      if (!charactersFor(me.runs).includes(character)) throw new ApiErr(403, 'locked', 'That character is not unlocked yet.');
      hazard = req.hazard ?? 0;
      if (hazard > hazardBook(ctx, me.id)[character].open) {
        throw new ApiErr(403, 'hazard_locked', `Hazard ${hazard} opens with a win at hazard ${hazard - 1} as this character.`);
      }
      if (new Set(req.kit).size !== req.kit.length) throw bad('not_owned', 'A kit item was listed twice.');
      for (const uid of req.kit) {
        const row = stashRow(ctx, me.id, uid);
        const item = row && heldItem(ctx, row);
        if (!row || !item) throw bad('not_owned', 'A kit item is not in your stash.');
        if (isRelic(item)) {
          // A relic does not wear: no charge is spent and it stays in the stash.
          if (kit.filter(isRelic).length >= KIT_RELICS) throw bad('kit_relics', 'Only one relic can be packed for a run.');
        } else {
          // One charge per run started. The item is gone when the last is spent.
          if (row.charges <= 1) ctx.db.prepare('DELETE FROM stash WHERE uid = ?').run(uid);
          else ctx.db.prepare('UPDATE stash SET charges = charges - 1 WHERE uid = ?').run(uid);
          packed.push({ uid, id: item.id, spent: row.charges <= 1 });
        }
        // What enters the run is the item packed down to the hazard's cap. The stash copy is untouched.
        kit.push(packItem(item, hazard));
      }
    } else {
      if (!featuresFor(me.runs).includes('daily')) throw new ApiErr(403, 'locked', 'The daily clearing is not unlocked yet.');
      ({ character, seed } = daily);
      waves = DAILY_WAVES;
      // Only the first daily ticket of the day is scored, whether or not it is finished.
      const prior = ctx.db.prepare(`SELECT 1 FROM runs WHERE player_id = ? AND mode = 'daily' AND day = ?`).get(me.id, daily.date);
      scored = req.mode === 'daily' && !prior ? 1 : 0;
      // Practice before the scored try is on a different clearing, so the day's seed is first seen on the try that counts.
      if (req.mode === 'practice' && !prior) seed = seedFrom(ctx, `practice:${daily.date}`);
    }

    ctx.db.prepare(`UPDATE runs SET status = 'void' WHERE player_id = ? AND status = 'open'`).run(me.id);
    const runId = newId();
    const st = stations(ctx);
    ctx.db
      .prepare(`INSERT INTO runs (id, player_id, mode, character, seed, waves, kit, day, scored, status, started, kit_uids, hazard, ip, stations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`)
      .run(runId, me.id, req.mode, character, seed, waves, JSON.stringify(kit.map((i) => i.id)), daily.date, scored, ctx.now(), JSON.stringify(packed), hazard, ipKey(ip), JSON.stringify(st));
    touch(ctx, me.id);
    return { runId, seed, waves, character, kit, stations: st, hazard, profile: profile(ctx, me.id), notice: worldNotice(ctx) };
  });
}

// ---- what a run can be ----------------------------------------------------------

/** Length in seconds of each wave of a plan, from the sim's own tables. */
const waveSeconds = (waves: number): number[] => (WAVE_PLAN[waves] ?? WAVE_PLAN[RUN_WAVES]).map((n) => WAVES[n - 1].seconds);
/** The standard wave a plan's wave i (0-based) is. Caps are indexed by standard wave. */
const standardWave = (waves: number, i: number): number => {
  const plan = WAVE_PLAN[waves] ?? WAVE_PLAN[RUN_WAVES];
  return plan[Math.min(i, plan.length - 1)];
};

/** Least time, in ms, in which this many waves of a plan can be cleared. The last wave ends when the boss dies. */
export function minDurationMs(wavesCleared: number, waves = RUN_WAVES): number {
  const secs = waveSeconds(waves);
  let s = 0;
  for (let i = 0; i < wavesCleared && i < secs.length; i++) s += i === secs.length - 1 ? BOSS_WAVE_MIN_SECONDS : secs[i];
  return Math.max(0, s - DURATION_SLACK_SECONDS) * 1000;
}

/** Most waves a run of this plan can have cleared after this long. */
export function wavesByNow(elapsedMs: number, waves = RUN_WAVES): number {
  let w = 0;
  while (w < waves && minDurationMs(w + 1, waves) <= elapsedMs) w++;
  return w;
}

/**
 * First bench (= waves cleared) at which an authored item of each tier can be
 * on offer, read from the sim's own odds so it follows a balance change.
 */
const TIER_FROM_WAVE: number[] = (() => {
  const out = [0, 0, 2, 4, 8];
  try {
    const run = createRun({ seed: 1, character: 'greenhorn' });
    for (let tier = 2; tier <= 4; tier++) {
      let from = RUN_WAVES;
      for (let b = RUN_WAVES - 1; b >= 1; b--) if ((offerOdds(run, b)[tier] ?? 0) > 0) from = b;
      out[tier] = from;
    }
  } catch {
    // keep the documented gates
  }
  return out;
})();
/** True if a run that has cleared this many waves could have bought this authored item. */
export const buyableBy = (item: ItemSpec, wavesCleared: number): boolean => wavesCleared >= (TIER_FROM_WAVE[itemTier(item)] ?? 0);

const forged = (message: string, code = 'bad_report') => bad(code, message);
const ENEMY_IDS = new Set(ENEMIES.map((e) => e.id));

/** Cap index for a run of this plan that cleared this many waves: the standard wave it died in, less one. */
const capIndex = (t: Pick<Ticket, 'waves'>, wavesCleared: number): number => Math.min(RUN_WAVES, standardWave(t.waves, wavesCleared)) - 1 + (wavesCleared >= t.waves ? 1 : 0);

/** Fusions the server answered for a run, in order. */
export function runFusions(ctx: Ctx, runId: string): [string, string, string][] {
  return (ctx.db.prepare('SELECT a, b, out FROM run_fusions WHERE run_id = ? ORDER BY seq').all(runId) as { a: string; b: string; out: string }[]).map((f) => [f.a, f.b, f.out]);
}

/** Fused items a run can still be holding: every recorded output, less those that went into a later fusion. */
export function fusedHeld(fusions: [string, string, string][]): Map<string, number> {
  const held = new Map<string, number>();
  for (const [a, b, out] of fusions) {
    for (const id of [a, b]) {
      const n = held.get(id) ?? 0;
      if (n > 0) held.set(id, n - 1);
    }
    held.set(out, (held.get(out) ?? 0) + 1);
  }
  return held;
}

/** Check a run report against its ticket. Throws on anything a real run could not produce. */
function checkReport(ctx: Ctx, t: Ticket, r: RunEndReq) {
  if (r.wavesCleared > t.waves) throw forged('More waves cleared than the run has.');
  if (r.won !== (r.wavesCleared === t.waves)) throw forged('The result does not match the waves cleared.');
  const elapsed = ctx.now() - t.started;
  if (elapsed < minDurationMs(r.wavesCleared, t.waves)) throw forged('The run ended sooner than its waves allow.', 'too_fast');

  // A hazard level is allowed a little more of everything (measured slack, see config).
  const k = capIndex(t, r.wavesCleared);
  const slack = 1 + HAZARD_REPORT_SLACK * t.hazard;
  const tiers = JSON.parse(t.stations || '{}') as Partial<Record<StationId, number>>;
  const stationOf: Record<string, StationId> = { timber: 'sawmill', ore: 'smelter', hide: 'tannery' };
  const lift = (tier: number) => 1 + REPORT_CAPS.rawsPerStationTier * Math.max(0, tier - 1);
  let total = 0, liftAll = 0;
  for (const raw of RAWS) {
    const n = r.raws[raw] + r.mule[raw];
    const l = lift(tiers[stationOf[raw]] ?? 1);
    total += n; liftAll += l / RAWS.length;
    if (n > REPORT_CAPS.rawsEach[k] * l * slack) throw forged('More raws than the waves could yield.', 'too_many_raws');
  }
  if (total > REPORT_CAPS.rawsTotal[k] * liftAll * slack) throw forged('More raws than the waves could yield.', 'too_many_raws');
  // The mule leaves after waves 4 and 8 only, with what had been gathered by then.
  const muleWaves = r.wavesCleared >= 8 ? 8 : r.wavesCleared >= 4 ? 4 : 0;
  const muleTotal = RAWS.reduce((n, raw) => n + r.mule[raw], 0);
  if (muleTotal > (muleWaves ? REPORT_CAPS.rawsTotal[capIndex(t, muleWaves - 1)] * liftAll * slack : 0)) {
    throw forged('The mule carried more than it could have.', 'too_many_raws');
  }
  if (r.scripEarned > REPORT_CAPS.scripEarned[k] * slack) throw forged('More scrip than the waves could yield.');
  // Kit items can be scrapped for scrip that was never earned, so held may pass earned by a little. Not by much.
  if (r.scripHeld > r.scripEarned + 400) throw forged('More scrip held than was ever earned.');
  if (r.kills > REPORT_CAPS.kills[k] * slack) throw forged('More kills than the waves could hold.');
  if (r.killsBy) {
    let n = 0;
    for (const [id, v] of Object.entries(r.killsBy)) {
      if (!ENEMY_IDS.has(id)) throw forged('A kill of something that does not live in the clearing.');
      n += v;
    }
    if (n > r.kills) throw forged('More kills by kind than kills.');
  }

  // Carried items: authored and of a tier the bench could have sold by then, or
  // the output of a fusion the server answered for this run and that was not
  // fused away again. A packed item never comes home as a carried one.
  const extra = packedRelic(t, 'extraCarry') ? 1 : 0;
  if (r.carry.length > Math.floor(r.wavesCleared / 4) + extra) throw forged('Too many items carried home.', 'bad_carry');
  const made = fusedHeld(runFusions(ctx, t.id));
  for (const id of r.carry) {
    if (Object.hasOwn(BASE_ITEM, id)) {
      if (!buyableBy(BASE_ITEM[id], r.wavesCleared)) throw forged('A carried item could not have been bought that early.', 'bad_carry');
      continue;
    }
    const left = made.get(id) ?? 0;
    if (left < 1) throw forged('A carried item was not made in this run.', 'bad_carry');
    made.set(id, left - 1);
  }
}

/** What the server needs to play a run again. */
function playbackInput(ctx: Ctx, t: Ticket, replay: string): PlaybackInput {
  const fusions = runFusions(ctx, t.id);
  const items: Record<string, ItemSpec> = {};
  for (const [, , out] of fusions) {
    const item = getItem(ctx, out);
    if (item) items[out] = item;
  }
  const kit = (JSON.parse(t.kit) as string[]).map((id) => getItem(ctx, id)).filter((i): i is ItemSpec => !!i).map((i) => packItem(i, t.hazard));
  return {
    opts: { seed: t.seed, character: t.character, waves: t.waves, kit, stations: JSON.parse(t.stations || '{}'), hazard: t.hazard },
    replay, items, fusions,
  };
}

/**
 * Oilskin wrap: on a win, the item packed beside it gets back the charge this
 * run spent. An item whose last charge went on the run comes back with one,
 * under its old uid. An item that has left the stash since is left alone.
 */
function keepCharges(ctx: Ctx, playerId: number, t: Ticket) {
  if (!packedRelic(t, 'keepCharge')) return;
  for (const k of JSON.parse(t.kit_uids) as Packed[]) {
    if (k.spent) {
      if (!ctx.db.prepare('SELECT 1 FROM stash WHERE uid = ?').get(k.uid)) addStash(ctx, playerId, k.id, 1, null, k.uid);
    } else {
      ctx.db.prepare('UPDATE stash SET charges = MIN(?, charges + 1) WHERE uid = ? AND player_id = ?').run(KIT_CHARGES, k.uid, playerId);
    }
  }
}

/** With replay checking on, only checked results are on the board. */
const boardOnly = (ctx: Ctx) => (ctx.replay === 'off' ? '' : ' AND verified = 1');

function rankOf(ctx: Ctx, day: string, waves: number, scrip: number, ts: number) {
  const better = ctx.db
    .prepare(`SELECT COUNT(*) AS n FROM daily_results WHERE day = ?${boardOnly(ctx)} AND (waves > ? OR (waves = ? AND (scrip > ? OR (scrip = ? AND ts < ?))))`)
    .get(day, waves, waves, scrip, scrip, ts) as { n: number };
  return better.n + 1;
}

const dailyPlayers = (ctx: Ctx, day: string) =>
  (ctx.db.prepare(`SELECT COUNT(*) AS n FROM daily_results WHERE day = ?${boardOnly(ctx)}`).get(day) as { n: number }).n;

/** True if one more paying run is inside the hourly and daily limits for this account and this address. */
function withinRunRate(ctx: Ctx, playerId: number, ip: string): boolean {
  if (!ctx.runRate) return true;
  const now = ctx.now();
  const count = (sql: string, key: number | string, since: number) => (ctx.db.prepare(sql).get(key, since) as { n: number }).n;
  const mine = 'SELECT COUNT(*) AS n FROM runs WHERE player_id = ? AND paid = 1 AND ended >= ?';
  if (count(mine, playerId, now - 3600_000) >= RUN_RATE.perHour) return false;
  if (count(mine, playerId, now - 86_400_000) >= RUN_RATE.perDay) return false;
  if (!ip) return true;
  const theirs = 'SELECT COUNT(*) AS n FROM runs WHERE ip = ? AND paid = 1 AND ended >= ?';
  if (count(theirs, ip, now - 3600_000) >= RUN_RATE.perHour * RUN_RATE.ipMul) return false;
  return count(theirs, ip, now - 86_400_000) < RUN_RATE.perDay * RUN_RATE.ipMul;
}

function openTicket(ctx: Ctx, playerId: number, runId: string): Ticket {
  const t = ctx.db.prepare('SELECT * FROM runs WHERE id = ? AND player_id = ?').get(runId, playerId) as Ticket | undefined;
  if (!t) throw new ApiErr(404, 'unknown_run', 'No such run.');
  if (t.status === 'ended') throw new ApiErr(409, 'run_ended', 'That run has already been reported.');
  if (t.status !== 'open') throw new ApiErr(409, 'run_void', 'That run was replaced by a newer one.');
  if (ctx.now() - t.started > TICKET_TTL_MS) throw new ApiErr(410, 'run_expired', 'That run is too old to report.');
  return t;
}

export async function endRun(ctx: Ctx, player: Player, r: RunEndReq): Promise<RunEndRes> {
  // Playing the run again takes a moment of CPU, so it happens before the write transaction, off the main thread.
  const pre = openTicket(ctx, player.id, r.runId);
  const pays = pre.mode === 'run' || !!pre.scored;
  let played: PlaybackResult | undefined;
  if (ctx.replay !== 'off' && pays) {
    if (r.replay) {
      played = await ctx.verify(playbackInput(ctx, pre, r.replay)).catch((): PlaybackResult => ({ ok: false, why: 'The replay could not be played.' }));
    } else if (ctx.replay === 'enforce') {
      throw bad('no_replay', 'The run came without its replay, so the town cannot check it.');
    }
  }

  return tx(ctx.db, () => {
    const t = openTicket(ctx, player.id, r.runId);
    checkReport(ctx, t, r);
    const now = ctx.now();
    const elapsed = now - t.started;

    // The replay, if there was one: the server's own copy of the run must come to the same report, in no more time than passed.
    let verified = 0;
    if (played) {
      const same = played.ok && reportKey(played.summary) === reportKey(r) && (played.ticks / 60 - DURATION_SLACK_SECONDS) * 1000 <= elapsed;
      verified = same ? 1 : -1;
      if (!same && ctx.replay === 'enforce') {
        throw bad('replay_mismatch', 'The replay of the run does not come to the same result. Nothing was paid.');
      }
      if (!same) {
        console.warn(`[replay] run ${t.id} of player ${player.id} did not match: ${played.ok ? 'different result' : played.why}`);
        ctx.db.prepare('INSERT OR REPLACE INTO replays (run_id, data, created) VALUES (?, ?, ?)').run(t.id, r.replay ?? '', now);
      }
    }

    // A report inside the first few seconds, or over the limit of paying runs, is taken but pays nothing and counts for nothing.
    const paid = pays && elapsed >= MIN_REPORT_SECONDS * 1000 && withinRunRate(ctx, player.id, t.ip);
    ctx.db
      .prepare(`UPDATE runs SET status = 'ended', ended = ?, paid = ?, verified = ?, waves_cleared = ?, won = ? WHERE id = ?`)
      .run(now, paid ? 1 : 0, verified, r.wavesCleared, r.won ? 1 : 0, t.id);
    touch(ctx, player.id);

    const gained = { raws: emptyRaws(), marks: 0, items: [] as ItemSpec[] };
    let unlockedFeature: Feature | undefined;
    let unlockedCharacter: CharacterId | undefined;
    let salvaged: RunEndRes['salvaged'];
    let hazardOpened: number | undefined;
    let titles: string[] | undefined;

    // A full run and the day's scored daily pay out. Practice and repeat dailies do not.
    if (paid) {
      const reason = `${t.mode} ${t.id}`;
      for (const raw of RAWS) {
        gained.raws[raw] = (r.won ? r.raws[raw] : Math.floor(r.raws[raw] * DEATH_RAW_KEEP)) + r.mule[raw];
      }
      // Scrip held pays only up to what a run can plausibly hold at that point; hazard pays a little more.
      const k = capIndex(t, r.wavesCleared);
      const slack = 1 + HAZARD_REPORT_SLACK * t.hazard;
      let heldPaid = Math.min(r.scripHeld, Math.round(SCRIP_PAID_CAP[k] * slack));
      if (ctx.replay !== 'off' && verified !== 1) {
        // Not played again by the server: taken, but paid no better than an ordinary run.
        heldPaid = Math.min(heldPaid, Math.round(UNCHECKED_PAY.scripHeld[k] * slack));
        const tiers = JSON.parse(t.stations || '{}') as Partial<Record<StationId, number>>;
        const lift = 1 + REPORT_CAPS.rawsPerStationTier * (((tiers.sawmill ?? 1) + (tiers.smelter ?? 1) + (tiers.tannery ?? 1)) / 3 - 1);
        const most = Math.round(UNCHECKED_PAY.rawsTotal[k] * lift * slack);
        const total = rawTotal(gained.raws);
        if (total > most) for (const raw of RAWS) gained.raws[raw] = Math.floor((gained.raws[raw] * most) / total);
      }
      gained.marks = Math.floor((Math.floor(heldPaid / SCRIP_PER_MARK) + MARKS_PER_WAVE * r.wavesCleared) * (1 + HAZARD_MARKS * t.hazard));
      move(ctx, player.id, 'run_raws', gained.raws, reason);
      move(ctx, player.id, 'run_marks', { marks: gained.marks }, reason);
      // A run the town has not played again brings home fewer items, and no finished one: an unchecked
      // report could otherwise claim three tier 4 items every eight minutes.
      let carry = r.carry;
      if (ctx.replay !== 'off' && verified !== 1) {
        carry = carry.filter((id) => itemTier(getItem(ctx, id)!) < 4).slice(0, Math.floor(r.wavesCleared / UNCHECKED_PAY.wavesPerItem));
      }
      // What does not fit in the stash is salvaged at the door.
      let room = stashRoom(ctx, player.id);
      for (const id of carry) {
        const item = getItem(ctx, id)!;
        if (Object.hasOwn(BASE_ITEM, id)) note(ctx, player.id, 'item', id);
        if (room > 0) {
          addStash(ctx, player.id, id, KIT_CHARGES);
          gained.items.push(item);
          room--;
        } else {
          const marks = Math.max(1, Math.round(itemPoints(item.effects) / 5));
          move(ctx, player.id, 'salvage', { marks }, `no room ${id}`);
          salvaged = { items: (salvaged?.items ?? 0) + 1, marks: (salvaged?.marks ?? 0) + marks };
          gained.marks += marks;
        }
      }
      const before = playerById(ctx, player.id).runs;
      ctx.db.prepare('UPDATE players SET runs = runs + 1, wins = wins + ? WHERE id = ?').run(r.won ? 1 : 0, player.id);
      unlockedFeature = (Object.keys(FEATURE_AT) as Feature[]).find((f) => FEATURE_AT[f] === before + 1);
      unlockedCharacter = charactersFor(before + 1).find((c) => !charactersFor(before).includes(c));
      if (t.mode === 'run' && r.won) {
        keepCharges(ctx, player.id, t);
        // The record: a win at hazard n as this character opens n + 1 for it.
        const open = hazardBook(ctx, player.id)[t.character].open;
        const secs = Math.round(elapsed / 1000);
        ctx.db
          .prepare(`INSERT INTO records (player_id, character, hazard, wins, best_seconds, first) VALUES (?, ?, ?, 1, ?, ?)
                    ON CONFLICT (player_id, character, hazard) DO UPDATE SET wins = wins + 1, best_seconds = MIN(best_seconds, excluded.best_seconds)`)
          .run(player.id, t.character, t.hazard, secs, now);
        if (t.hazard === open && open < MAX_HAZARD) hazardOpened = open + 1;
      }
      // Kills by kind for the almanac: the server's own count when the run was replayed, else the report's.
      const kills = played?.ok && verified === 1 ? played.kills : r.killsBy;
      if (kills) for (const [id, n] of Object.entries(kills)) if (ENEMY_IDS.has(id)) note(ctx, player.id, 'enemy', id, n);
    }

    // The relic roll: the server's dice, on a report that has passed its checks. See server/relics.ts.
    // With replay checking on, only a run the server has played again can roll.
    const mayRoll = paid && (ctx.replay === 'off' || verified === 1);
    const relic = mayRoll ? rollForRun(ctx, player.id, t, r) : undefined;
    if (relic) note(ctx, player.id, 'relic', relic.id);

    let daily: RunEndRes['daily'];
    if (t.mode !== 'run') {
      if (t.scored && paid) {
        ctx.db.prepare('INSERT INTO daily_results (day, player_id, waves, scrip, ts, verified) VALUES (?, ?, ?, ?, ?, ?)').run(t.day, player.id, r.wavesCleared, r.scripEarned, now, verified === 1 ? 1 : 0);
      }
      // For an unscored try this is where it would have placed.
      daily = { rank: rankOf(ctx, t.day, r.wavesCleared, r.scripEarned, now), players: dailyPlayers(ctx, t.day), scored: !!t.scored && paid };
    }
    if (paid) {
      const earned = awardTitles(ctx, player.id);
      if (earned.length) titles = earned;
    }
    return {
      profile: profile(ctx, player.id), gained, relic, notice: worldNotice(ctx), unlockedFeature, unlockedCharacter, daily,
      paid: pays ? paid : undefined, salvaged, hazardOpened, titles,
      replay: ctx.replay === 'off' || !pays ? undefined : verified === 1 ? 'ok' : verified === -1 ? 'mismatch' : 'none',
    };
  });
}

export function dailyBoard(ctx: Ctx, player: Player): DailyRes {
  const { date, character } = dailyInfo(ctx);
  const row = ctx.db.prepare('SELECT waves, scrip, ts FROM daily_results WHERE day = ? AND player_id = ?').get(date, player.id) as
    | { waves: number; scrip: number; ts: number }
    | undefined;
  const top = ctx.db
    .prepare(`SELECT p.name, p.title, d.waves, d.scrip FROM daily_results d JOIN players p ON p.id = d.player_id WHERE d.day = ?${boardOnly(ctx).replace('verified', 'd.verified')} ORDER BY d.waves DESC, d.scrip DESC, d.ts LIMIT 20`)
    .all(date) as DailyRes['top'];
  return {
    date,
    character,
    mine: row ? { waves: row.waves, scrip: row.scrip, rank: rankOf(ctx, date, row.waves, row.scrip, row.ts) } : null,
    taken: !!ctx.db.prepare(`SELECT 1 FROM runs WHERE player_id = ? AND mode = 'daily' AND day = ?`).get(player.id, date),
    players: dailyPlayers(ctx, date),
    top,
  };
}

/** A helper for callers that hold raws as a bag. */
export const rawTotal = (b: RawBag): number => RAWS.reduce((n, r) => n + b[r], 0);
