import { randomInt } from 'node:crypto';
import { BASE_ITEM } from '../src/shared/content/items.ts';
import { fnv1a, recipeKey, type ItemSpec } from '../src/shared/item.ts';
import {
  DAILY_WAVES, DEATH_RAW_KEEP, KIT_CHARGES, RUN_WAVES,
  type CharacterId, type DailyRes, type Feature, type RunEndReq, type RunEndRes, type RunStartReq, type RunStartRes,
} from '../src/shared/protocol.ts';
import { RAWS, emptyRaws } from '../src/shared/vocab.ts';
import {
  BOSS_WAVE_MIN_SECONDS, BOUNDS, CHARACTERS, DURATION_SLACK, FEATURE_AT, MARKS_PER_WAVE, SCRIP_PER_MARK,
  TICKET_TTL_MS, WAVE_SECONDS, charactersFor, featuresFor,
} from './config.ts';
import { tx } from './db.ts';
import { ApiErr, bad } from './errors.ts';
import { addStash, dayOf, getItem, move, newId, playerById, profile, stashRow, stations, touch, type Ctx, type Player } from './players.ts';

interface Ticket {
  id: string; player_id: number; mode: 'run' | 'daily' | 'practice'; character: CharacterId;
  seed: number; waves: number; kit: string; day: string; scored: number; status: string; started: number;
}

/** Today's clearing: the same seed and character for everyone, rotating daily. */
export function dailyInfo(ctx: Ctx) {
  const now = ctx.now();
  const date = dayOf(now);
  return { date, seed: fnv1a(`daily:${date}`), character: CHARACTERS[Math.floor(now / 86_400_000) % CHARACTERS.length] };
}

export function startRun(ctx: Ctx, player: Player, req: RunStartReq): RunStartRes {
  return tx(ctx.db, () => {
    const me = playerById(ctx, player.id);
    const daily = dailyInfo(ctx);
    let character = req.character;
    let seed = randomInt(0, 2 ** 32);
    let waves = RUN_WAVES;
    let scored = 0;
    const kit: ItemSpec[] = [];

    if (req.mode === 'run') {
      if (!charactersFor(me.runs).includes(character)) throw new ApiErr(403, 'locked', 'That character is not unlocked yet.');
      if (new Set(req.kit).size !== req.kit.length) throw bad('not_owned', 'A kit item was listed twice.');
      for (const uid of req.kit) {
        const row = stashRow(ctx, me.id, uid);
        const item = row && getItem(ctx, row.item_id);
        if (!row || !item) throw bad('not_owned', 'A kit item is not in your stash.');
        // One charge per run started. The item is gone when the last is spent.
        if (row.charges <= 1) ctx.db.prepare('DELETE FROM stash WHERE uid = ?').run(uid);
        else ctx.db.prepare('UPDATE stash SET charges = charges - 1 WHERE uid = ?').run(uid);
        kit.push(item);
      }
    } else {
      if (!featuresFor(me.runs).includes('daily')) throw new ApiErr(403, 'locked', 'The daily clearing is not unlocked yet.');
      ({ character, seed } = daily);
      waves = DAILY_WAVES;
      // Only the first daily ticket of the day is scored, whether or not it is finished.
      const prior = ctx.db.prepare(`SELECT 1 FROM runs WHERE player_id = ? AND mode = 'daily' AND day = ?`).get(me.id, daily.date);
      scored = req.mode === 'daily' && !prior ? 1 : 0;
    }

    ctx.db.prepare(`UPDATE runs SET status = 'void' WHERE player_id = ? AND status = 'open'`).run(me.id);
    const runId = newId();
    ctx.db
      .prepare(`INSERT INTO runs (id, player_id, mode, character, seed, waves, kit, day, scored, status, started) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`)
      .run(runId, me.id, req.mode, character, seed, waves, JSON.stringify(kit.map((i) => i.id)), daily.date, scored, ctx.now());
    touch(ctx, me.id);
    return { runId, seed, waves, character, kit, stations: stations(ctx), profile: profile(ctx, me.id) };
  });
}

/** Least time, in ms, in which this many waves can be cleared. */
export function minDurationMs(wavesCleared: number): number {
  let s = 0;
  for (let i = 0; i < wavesCleared; i++) s += i === RUN_WAVES - 1 ? BOSS_WAVE_MIN_SECONDS : WAVE_SECONDS[i];
  return Math.max(0, s * (1 - DURATION_SLACK.fraction) - DURATION_SLACK.seconds) * 1000;
}

const forged = (message: string, code = 'bad_report') => bad(code, message);

/** Check a run report against its ticket. Throws on anything a real run could not produce. */
function checkReport(ctx: Ctx, t: Ticket, r: RunEndReq) {
  if (r.wavesCleared > t.waves) throw forged('More waves cleared than the run has.');
  if (r.won !== (r.wavesCleared === t.waves)) throw forged('The result does not match the waves cleared.');
  if (ctx.now() - t.started < minDurationMs(r.wavesCleared)) throw forged('The run ended sooner than its waves allow.', 'too_fast');

  const attempted = Math.min(t.waves, r.wavesCleared + 1);
  let total = 0;
  for (const raw of RAWS) {
    const n = r.raws[raw] + r.mule[raw];
    total += n;
    if (n > BOUNDS.rawPerWave * attempted) throw forged('More raws than the waves could yield.', 'too_many_raws');
  }
  if (total > BOUNDS.rawTotalPerWave * attempted) throw forged('More raws than the waves could yield.', 'too_many_raws');
  // The mule leaves after waves 4 and 8 only.
  const muleWaves = r.wavesCleared >= 8 ? 8 : r.wavesCleared >= 4 ? 4 : 0;
  for (const raw of RAWS) {
    if (r.mule[raw] > BOUNDS.rawPerWave * muleWaves) throw forged('The mule carried more than it could have.', 'too_many_raws');
  }
  if (r.scripEarned > BOUNDS.scripPerWave * attempted || r.scripHeld > BOUNDS.scripPerWave * attempted) {
    throw forged('More scrip than the waves could yield.');
  }
  if (r.kills > BOUNDS.killsPerWave * attempted) throw forged('More kills than the waves could hold.');

  // Carried items: authored, or made in this run by a recipe the server knows.
  if (r.carry.length > Math.floor(r.wavesCleared / 4)) throw forged('Too many items carried home.', 'bad_carry');
  const made = new Map<string, number>();
  const recipe = ctx.db.prepare('SELECT out FROM recipes WHERE key = ?');
  for (const [a, b, out] of r.fusions) {
    const row = recipe.get(recipeKey(a, b)) as { out: string } | undefined;
    if (row?.out === out) made.set(out, (made.get(out) ?? 0) + 1);
  }
  for (const id of r.carry) {
    if (Object.hasOwn(BASE_ITEM, id)) continue;
    const left = made.get(id) ?? 0;
    if (left < 1) throw forged('A carried item was not made in this run.', 'bad_carry');
    made.set(id, left - 1);
  }
}

function rankOf(ctx: Ctx, day: string, waves: number, scrip: number, ts: number) {
  const better = ctx.db
    .prepare('SELECT COUNT(*) AS n FROM daily_results WHERE day = ? AND (waves > ? OR (waves = ? AND (scrip > ? OR (scrip = ? AND ts < ?))))')
    .get(day, waves, waves, scrip, scrip, ts) as { n: number };
  return better.n + 1;
}

const dailyPlayers = (ctx: Ctx, day: string) =>
  (ctx.db.prepare('SELECT COUNT(*) AS n FROM daily_results WHERE day = ?').get(day) as { n: number }).n;

export function endRun(ctx: Ctx, player: Player, r: RunEndReq): RunEndRes {
  return tx(ctx.db, () => {
    const t = ctx.db.prepare('SELECT * FROM runs WHERE id = ? AND player_id = ?').get(r.runId, player.id) as Ticket | undefined;
    if (!t) throw new ApiErr(404, 'unknown_run', 'No such run.');
    if (t.status === 'ended') throw new ApiErr(409, 'run_ended', 'That run has already been reported.');
    if (t.status !== 'open') throw new ApiErr(409, 'run_void', 'That run was replaced by a newer one.');
    if (ctx.now() - t.started > TICKET_TTL_MS) throw new ApiErr(410, 'run_expired', 'That run is too old to report.');
    checkReport(ctx, t, r);

    const now = ctx.now();
    ctx.db.prepare(`UPDATE runs SET status = 'ended', ended = ? WHERE id = ?`).run(now, t.id);
    touch(ctx, player.id);

    const gained = { raws: emptyRaws(), marks: 0, items: [] as ItemSpec[] };
    let unlockedFeature: Feature | undefined;
    let unlockedCharacter: CharacterId | undefined;

    // A full run and the day's scored daily pay out. Practice and repeat dailies do not.
    if (t.mode === 'run' || t.scored) {
      const reason = `${t.mode} ${t.id}`;
      for (const raw of RAWS) {
        gained.raws[raw] = (r.won ? r.raws[raw] : Math.floor(r.raws[raw] * DEATH_RAW_KEEP)) + r.mule[raw];
      }
      gained.marks = Math.floor(r.scripHeld / SCRIP_PER_MARK) + MARKS_PER_WAVE * r.wavesCleared;
      move(ctx, player.id, 'run_raws', gained.raws, reason);
      move(ctx, player.id, 'run_marks', { marks: gained.marks }, reason);
      for (const id of r.carry) {
        addStash(ctx, player.id, id, KIT_CHARGES);
        gained.items.push(getItem(ctx, id)!);
      }
      const before = playerById(ctx, player.id).runs;
      ctx.db.prepare('UPDATE players SET runs = runs + 1, wins = wins + ? WHERE id = ?').run(r.won ? 1 : 0, player.id);
      unlockedFeature = (Object.keys(FEATURE_AT) as Feature[]).find((f) => FEATURE_AT[f] === before + 1);
      unlockedCharacter = charactersFor(before + 1).find((c) => !charactersFor(before).includes(c));
    }

    let daily: RunEndRes['daily'];
    if (t.mode !== 'run') {
      if (t.scored) {
        ctx.db.prepare('INSERT INTO daily_results (day, player_id, waves, scrip, ts) VALUES (?, ?, ?, ?, ?)').run(t.day, player.id, r.wavesCleared, r.scripEarned, now);
      }
      // For an unscored try this is where it would have placed.
      daily = { rank: rankOf(ctx, t.day, r.wavesCleared, r.scripEarned, now), players: dailyPlayers(ctx, t.day), scored: !!t.scored };
    }
    return { profile: profile(ctx, player.id), gained, unlockedFeature, unlockedCharacter, daily };
  });
}

export function dailyBoard(ctx: Ctx, player: Player): DailyRes {
  const { date, character } = dailyInfo(ctx);
  const row = ctx.db.prepare('SELECT waves, scrip, ts FROM daily_results WHERE day = ? AND player_id = ?').get(date, player.id) as
    | { waves: number; scrip: number; ts: number }
    | undefined;
  const top = ctx.db
    .prepare('SELECT p.name, d.waves, d.scrip FROM daily_results d JOIN players p ON p.id = d.player_id WHERE d.day = ? ORDER BY d.waves DESC, d.scrip DESC, d.ts LIMIT 20')
    .all(date) as DailyRes['top'];
  return {
    date,
    character,
    mine: row ? { waves: row.waves, scrip: row.scrip, rank: rankOf(ctx, date, row.waves, row.scrip, row.ts) } : null,
    players: dailyPlayers(ctx, date),
    top,
  };
}
