# After the trust and depth pass: the critic's experiments, run again

Companion to `docs/critique/meta.md`. Every number below comes from the scripts
in `tools/exp/meta/`, run against the changed server (procedural provider, no
model credentials). Samples are small and the machine was shared; win rates
carry about +/-5 points at 240-400 seeds and +/-10 at 100 runs.

New or changed scripts: `maxima.ts` and `maxima-report.ts` (report caps from
bot maxima, and the false-refusal check), `kitcap.ts` (kit cap sweep),
`recbot.ts` and `honest.ts` (recorded runs against an enforcing server),
`career.ts` (new `regular` policy, `+climb`), `econ.ts` (raw lots and orders),
`exploits.ts` (the critic's requests, with a verdict each). `lib.ts` turns
replay checking and the paying-run limit off, because those experiments
report bot runs in bulk without logs; `honest.ts` is the one that does not.

## Part A: the exploits

Live server on :8821, rate limits on, real clock, 482 s
(`exploits.ts`). BLOCKED: refused or pays nothing. CONTAINED: taken, but paid
no better than an ordinary honest run. Each also has a test in
`tests/server/exploits.test.ts` or `replay.test.ts` that performs the attack.

| id | before | after | verdict |
|---|---|---|---|
| E1 instant forged death | 180,000 marks, ~100,000 raws per device-hour | the critic's body: 50 of 50 refused (`too_many_raws`), +0. At the caps with the 6 s floor waited out: 1 mark and 4 raws a run, 12 paying runs an hour: about 12 marks and 48 raws an hour | BLOCKED |
| E2a forged instant win | refused | refused (`too_fast`) | BLOCKED |
| E2b forged 4-wave death | +450 raws, +262 marks, an Anvil | at 97 s `too_fast`; at 112 s `too_many_raws`; Anvil alone `bad_carry` (tier 4 is not on a bench before wave 8). The most the caps let through: +39 raws, +18 marks, no replay so paid as unchecked | CONTAINED |
| E2c forged win | +1,080 raws, +636 marks, three tier 4 items | at 367 s `too_fast`; at 482 s `too_many_raws`; fused item by naming its recipe `bad_carry`. At the caps with three authored tier 4 items: +54 raws, +98 marks, **no items** (an unchecked run carries no tier 4), no relic roll | CONTAINED |
| E3 marks funnel | main 362 -> 6,899 marks | listing at 7,030: `price_cap` (20 marks a point); both sides need 10 paid runs; a new account (under 30 runs) pays out and takes in 600 a day; relics: no cap but both sides need 30 runs and 3 days | BLOCKED |
| E4 town/give retry | gave twice | `GiveReq.idem`; client sends one; test shows one effect | BLOCKED |
| E5 / E5b bad input, `__proto__` id | E5b 500 | all 400/404; `getItem` uses `Object.hasOwn` | BLOCKED |
| E7 seed shopping | free tickets | unchanged: a ticket is still free. Under replay checking it no longer pays to scout seeds offline unless the run is then really played | OPEN (low) |
| E8 forged daily, predictable seed | rank 1 at 4,000 | seed = HMAC(server secret, date); practice before the scored ticket is on another seed; with replay checking on (default) only checked runs are on the board | BLOCKED |
| E9 hello-only devices active | 6 -> 15 | active = a paid run in the last week: 1 -> 1 | BLOCKED |
| E10 one device closes the Factor | world cap drained | per-player cap, 150 a side per raw per day; another player keeps 150/150 | BLOCKED |
| E11 wash trading for the town | 0.025 units a mark | tax reaches the project at the Factor's asking price; test shows a wash builds less than the same marks spent on raws | BLOCKED |
| E12 first find without items | `first:true` | `no_run`: in-run fusion needs `runId` of an open run of the caller, and both items must be plausible (authored and buyable by now on the server's clock, or an unconsumed earlier output of that run). Recorded in `run_fusions` | BLOCKED |
| E12b free devices' untried pairs | 20 a device | 3 a day until 5 paid runs | BLOCKED |
| E13 fusing resets charges | 1 -> 3 | output keeps the fewer charges; town fusion costs marks and raws | BLOCKED |
| E14 unlimited rerolls | free | once a week (`name_wait`) | BLOCKED |
| E15 idempotency rows | 47.8 KB each, purged at start | a 43-character hash, no response, under 100 bytes; purged hourly after a day. 40-player month: 3,245 rows, 0.0 MB of responses (was 430 MB) | BLOCKED |

**Report caps.** `maxima.ts`: 4,200 bot runs over 300 seeds per character for
the expert bot (1,800), 120 for average (720), 40 idle (240), 120 each with
tier 5 stations and with two cap-point kit items whole (720 + 720), all six
characters. Caps are 1.5x the largest seen at the end of the wave the run died
in. Before -> after, per run of 12 waves: all raws 1,080 -> 210 (per station
tier step +69%), scrip earned 6,000 -> 6,445 (a total, no longer per wave
attempted: 45 at 0 waves where it was 500), kills 7,200 -> 4,765 (40 at 0
waves), scrip that pays clamped to 1.25x the most held. Minimum time = the sum
of wave lengths on the server's clock less 2 s (boss wave 3 s: the fastest
real one was 5.2 s); a report under 6 s pays nothing (the fastest any bot,
including one that never moves, died was 10.3 s). **False refusals:
`maxima-report.ts check` finds 0 of 4,200 measured runs refused.** Also 0 of 36
recorded honest runs against an enforcing server (`honest.ts`).

**Replay verification: built.** `src/shared/replay.ts` (version 1, tied to
RULESET; depends only on `src/sim/index.ts`): the client logs each tick's
move vector quantised to a 31x31 grid, run-length encoded, plus every bench
action the sim accepted; the change in `src/client/game/mount.ts` and
`bench.ts` is that calls go through `rec.*`. The server plays the log on a
worker thread (`server/verify.ts`) before the write transaction and compares
the whole report. Measured (`honest.ts`, 36 runs, all characters, 10 with
in-run fusions, 4 left early): replay median 6.8 KB, max 15.8 KB; playback
mean 130 ms for runs averaging 243 s, about 2,000x real time (min 1,300x);
through the worker 232 ms, 12 at once 1.6 s. Modes: `REPLAY_VERIFY=flag`
(default) pays a matching replay in full and an unchecked or mismatched one
as at most an ordinary run (75th percentile scrip and raws, one item per six
waves, no tier 4), keeps it off the relic roll and the daily board, and keeps
a mismatched log in `replays`; `enforce` refuses both; `off` is caps only.
Left: enforce is not the default because the sim uses `Math.sin`/`Math.cos`,
which can differ in the last bit between browser engines; the sim needs a
table for them before cross-engine replays can be trusted. Practice runs are
not replayed.

Rate limit: 12 paying runs an hour, 80 a day per account; three times that per
address (hashed). Over it a run is taken, paid nothing and not counted.

## Part B

### B1 Kit power

Rule: a packed item brings at most `KIT_POINT_CAP[hazard]` points into the run
(13, 26, 40, 58, 80, whole), packed down by the deterministic fusion repair;
the stash item is unchanged (`src/shared/kit.ts`, server writes the packed kit
on the ticket; no change to `vocab.ts`). Chosen over a one-wave head start
because a cap is a single number to tune and makes the hazard ladder the
place where strong items matter. Sweep (`kitcap.ts`, average bot, Greenhorn,
same seeds):

| kit | before (whole) | cap 24 | cap 16 | cap 14 | cap 13 (chosen) |
|---|---|---|---|---|---|
| none | 25.8% (400 seeds) | | | | |
| two authored tier 4 | 72.1% | 26.3% | 29.6% | 34.6% | 33.3% |
| two fused cap items | 96.3% | 45.6%* | 45.4% | 44.2% | **39.3%** |

(*an earlier cap that limited gains only; dropped because drawback items then
packed down to a net loss.) Best kit: **+13.5 points** at hazard 0 (was +70).
Novice: none 3.8%, cap kit 9.4% at cap 14 (was 76%). `kitab.ts` rerun (40
seeds, packed): average none 20% / t2 25% / t4 20% / cap 35%.

From the sim side I need: `createRun({ hazard })` with real scaling. Until it
merges the ticket carries `hazard` and the client passes it; the sim ignores
it, so a climbing career wins too easily (below), and report caps allow +25%
per hazard level as a guess that must be re-measured with `maxima.ts`.

### B2 Sinks

Added: priced town fusion (3x run raws + 15/40/90/200 marks), mending (2
marks a point, min 15, plus raws; twice per item), a 24-item stash with
shelves (150 marks up, rising; salvage at the door when full), marks given to
the town through the Factor (300 units a day per player), works after tier 5
(four, each a week-long perk), scrip-to-marks 10 -> 20.

Careers through the API (`career.ts`, `regular` = fuses authored pairs for
the almanac, mends kit items, buys shelves, gives half its spare raws and
marks above a float of 300 to the town):

| career | before: marks / raws / stash at end | after: marks / raws / stash | marks in runs of income |
|---|---|---|---|
| average, 100 runs (2 careers) | 3,315 / 5,129 / 89 (optimal) | **237 / 619 / 37** | 3.9 |
| novice, 100 | 2,065 / 2,893 / 79 (optimal) | 138 / 135 / 34 | 3.5 |
| expert, 150 | 9,226 / 17,632 / 161 (optimal) | 284 / 1,150 / 38 | 5.0 |
| average naive (never spends), 100 | 18,588 / 0 / 197 | 13,185 / 0 / 20 | 207 |

Marks meet the target (under 10 runs of income) for anyone who uses the
sinks; raws do not quite: 619 for average is about 19 runs of raw income,
because the regular policy keeps half its raws. A player who never spends
still hoards marks (naive row), which only seasons will fix. Stash no longer
piles up (20-38 against 89-330). Expert's solo town reached tier 5 at run 91
(was 40-46) and then finished 19 works by run 150: raws keep a use. Ledger
audit passed in every career and in both population runs.

### B3 Long-term goals

(a) Hazard ladder on the server: `RunStartReq/Res.hazard`, `records` table,
n+1 opens on a win at n per character, +10% marks a level, relic odds
unchanged (test). A climbing average career reached hazard 5 and "the whole
ladder" title by run 100; with real scaling it should not.
(b) Almanac tab and `GET /api/almanac`: 10 lists, 852 bounded entries (741
pairs, 43 items, 10 enemies, 6 hands, 36 hazard cells, 8 relics, 4 stations, 4
works); 15 titles, one a world first, worn after the name on the head, the
daily board and the givers list. Average regular career at run 100: 54 of
852 filled, 3-4 titles; climbing: 123, 6 titles.
(c) Finds count only for authored pairs or the first making of a finished
item; migration 3 recounts old databases. Codex shows "you have made x of
741, the world has tried y". `fusepop.ts` was not rerun.

### B4 Market

Raw lots, buy orders (marks held, audited), 10-run gate, price ceilings,
Factor revert 0.1 -> 0.25 and per-player caps. 40 players, 30 days
(`econ.ts`):

| | before | after |
|---|---|---|
| sales | 2,004 items | 259 items + 456 raw lots/fills (6,541 units, 189 via orders, 113 orders placed) |
| sales to someone who used the goods | 8 (0.4%) | 443 (**62%**); item sales to users still 0 |
| traders | spent 3,489, earned 1,725 | spent 463, earned 1,212: raws can be traded at a profit |
| median raw price | Factor floor, 1 mark | 6 marks a unit, inside the Factor's 3-12 |

Raws are now a market; items still are not. Items are still a byproduct
everyone has, and with the kit cap a stronger item is worth little at hazard
0. An item market probably needs the sim's hazard scaling, so that packed
points at hazard 3+ are worth buying.

### B5 Seasons

Design only: `docs/DESIGN.md` 5.10.

## What is left

- Sim: hazard scaling in `createRun`, then re-measure the caps (`maxima.ts`) and kit caps per level (`kitcap.ts` with a hazard argument); a sin/cos table so `REPLAY_VERIFY=enforce` can be the default.
- Re-run `fusepop.ts` for B3c, and the 100/1,000-player econ runs.
- Item demand (above). A tickets-are-free change for E7.
- Raws for a player who keeps them, and marks for one who never spends: seasons.

## Score

**5 / 10 for long-term depth** (was 3). The trust model holds: the forged
reports that made the economy meaningless are refused or paid as honest runs,
and real replay checking exists. The kit is a key, not the game. Currencies
have sinks that bind for anyone who plays the town. There is a 36-cell ladder,
an 852-entry almanac and titles. It is not higher because the ladder has no
teeth until the sim scales with hazard, the item market still has no buyers,
and nothing yet resets.
