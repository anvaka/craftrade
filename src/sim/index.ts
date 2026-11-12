// The run simulation: pure, deterministic TypeScript. No DOM, no Math.random,
// no Date. Everything the client needs is exported from this file.
//
// LIFECYCLE
//
//   const run = createRun({ seed, character, waves, kit, stations, hazard });   // wave 1 is already running; hazard 0-5, see HAZARD_RULES
//   every 1/60 s while run.phase === 'wave':
//       step(run, { mx, my });            // mx, my: move direction, length 0..1
//   every frame:
//       for (i < run.events.n) play(run.events.list[i]);  clearEvents(run);
//       draw entities at  px + (x - px) * alpha
//   when run.phase === 'bench'  (after every wave but the last):
//       pickUpgrade(run, i)               // while run.bench.picks > 0; choices in run.bench.choices
//       buy(run, i) / buyBlock(run, i)    // run.bench.offers[0..3], [4] with the Order book, then the commission (offer.commission) from bench 5
//       offerCost(run, i)                 // scrip for offer i now: its price plus rawPrice(run) for each raw the player is short of
//       tierUp(run, w) / tierUpBlock / tierUpCost   // raise held weapon w one tier for scrip and one set of its raws
//       combineWeapons(run, w) / twinOf(run, w)     // merge two held twins into the next tier (buying with full hands still does it)
//       reroll(run) / rerollCost(run)     // free once all four are bought
//       toggleLock(run, i)
//       scrapWeapon(run, i) / scrapItem(run, i)
//       fuseCost(run, a, b)               // quote; then ask the server for the result, then
//       applyFusion(run, a, b, result)    // null on success, else the reason
//       sendMule(run, { timber, ore, hide })   // only when run.bench.mule (after waves 4 and 8)
//       nextWave(run)
//   when run.phase === 'over':
//       setCarry(run, ids)                // up to carryLimit(run) of carryable(run)
//       summary(run)                      // RunEndReq without runId, plus the recap
//
// Bench functions change nothing and return false (or a reason string) when
// the action is not allowed, so they can be wired straight to buttons.
//
// WHAT THE RENDERER READS (all on `run`, see types.ts for every field)
//
//   phase, wave, totalWaves, waveTime, waveSeconds, plan[wave-1] (standard wave number; WAVES[n-1].brief is its banner)
//   player    x, y, px, py, fx, fy (facing), moving, hp, maxHp, shield, iframes (flicker while > 0),
//             level, xp, xpNext, scrip, bank, raws, magnetR, workingNode,
//             stat[ST.<id>] (final capped stats), weapons[] (id, tier, cd, swing/swingDur, ax, ay, flip), items[]
//   enemies[] fixed pool of MAX_ENEMIES. Skip !alive. type indexes ENEMIES. x, y, px, py, r, hp, maxHp,
//             flash (ticks of hit flash), burnT, slowT, dx, dy (facing), state (ES.*), t (state timer):
//               ES.Spawn      ground mark, t counts down
//               ES.Windup     boar, stag, Old Tusk: t counts down, (dx, dy) is the locked charge line;
//                             spitter: about to spit
//               ES.Charge     moving along (dx, dy)
//               ES.Slam       brute, rotwood, Old Tusk: the ring itself is a Hazard
//               ES.Burrowed   underground, draw a furrow or nothing
//               ES.Surfacing  about to come up at (x, y); the blast is a Hazard
//               ES.Flee       magpie leaving with loot (loot0..3)
//               ES.Summon     Old Tusk calling a pack
//             n is Old Tusk's phase (1-3). work / AI.rotWork is progress on a live rotwood.
//   eliteIdx  index of the live elite or boss in enemies[], or -1 (for a health bar)
//   hazards[] HZ_RING: lands when t reaches 0, hits the band r0..r1, progress = 1 - t / dur.
//             HZ_SHARD: stag shard, radius r1, fades as t runs out.
//   shots[]   player shots. x, y, px, py, src (index into SOURCE_IDS: which weapon), crit.
//   eshots[]  enemy shots. x, y, px, py, r.
//   pickups[] x, y, px, py, kind (PK_SCRIP, PK_TIMBER, PK_ORE, PK_HIDE), value, pulled.
//   nodes[]   x, y, type (NODE_TREE, NODE_SEAM, NODE_CARCASS), rich, work / need, working. Ring radius NODE_RING.
//   lanes     the open lane mouths this wave (x, y pairs; laneCount of them).
//   bench     index, picks, choices[], offers[] (kind, id, tier, price, raws, locked, sold, item), rerolls,
//             freeReroll, mule, interestPaid.
//
// EVENTS (run.events.list[0 .. n-1]; objects are reused, so read them before the next step)
//
//   type        x, y            a                         b
//   attack      player          weapon index (WEAPONS)    weapon slot
//   hit, crit   enemy           damage                    enemy index
//   kill        enemy           enemy type index          rank (0, 1 elite, 2 boss)
//   hurt        player          damage                    enemy type index   c: attacker's enemy index (-1 for a shard),
//                                                                            d: HIT_TOUCH, HIT_SHOT, HIT_SLAM, HIT_CHARGE or HIT_SHARD
//   dodge       player
//   pickup      player          kind (PK_*)               value
//   work        node            node type                 (one chop, clink or scrape)
//   break       node            node type                 1 if rich
//   levelup     player          new level
//   tell        enemy           enemy type index          TELL_CHARGE, TELL_SPIT, TELL_SLAM, TELL_SURFACE, TELL_SUMMON
//                                                         c, d: target point (end of a charge line, the spitter's aim, a ring's centre)
//   slam        ring centre     outer radius              inner radius      (a ring has landed)
//   eliteSpawn, eliteDeath, bossSpawn, bossDeath   enemy   enemy type index
//   bossPhase   boss            phase 2 or 3
//   steal       magpie          kind (PK_*)               value
//   escape      magpie          pieces of loot taken
//   waveStart   player          wave number               standard wave number
//   waveEnd     player          wave number               b: scrip swept to the purse   c: scrip banked   d: raws swept up
//   shieldBreak, secondWind (a = HP left), death (a = enemy type index)   player
//   burst       centre          radius                    (kill burst or recoil blast)
//
// DETERMINISM: the same RunOptions and the same inputs give the same run,
// bit for bit, on any engine: the sim step uses only IEEE-exact arithmetic (sine and cosine come
// from src/sim/trig.ts, never Math.sin or Math.cos), so the server's replay matches a browser's run.

export { createRun, createOuting, step, nextWave, abandon, clearEvents, summary, stateHash, hasBadNumber, setCarry, carryLimit, carryable } from './run.ts';
export type { RunSummary, StepInput, OutingOptions } from './run.ts';
export {
  pickUpgrade, buy, buyBlock, reroll, rerollCost, toggleLock, scrapWeapon, scrapItem, scrapValueWeapon, scrapValueItem,
  fuseCost, applyFusion, fusionResultBlock, sendMule, priceAt, weaponPrice, itemPrice, offerOdds,
  offerCost, rawPrice, combineWeapons, twinOf, tierUp, tierUpBlock, tierUpCost,
} from './bench.ts';
export type { FuseQuote } from './bench.ts';
export { ST, SP, CLASSES, xpForLevel, weaponSlots, HIT_TOUCH, HIT_SHOT, HIT_SLAM, HIT_CHARGE, HIT_SHARD } from './core.ts';
export { weaponRange, weaponDamage, weaponCooldown } from './weapons.ts';
export { nodeYield, NODE_IDS } from './world.ts';
export {
  SKILLS, SKILL_NAME, OUTING_NODE, MATERIALS, matIndex, PK_MAT, OUTING, STAGE_NAME, xpToNext, skillLevel, skillProgress,
  bagUsed, bagCount, nodeLocked, leaveOuting, haul,
} from './outing.ts';
export type { MaterialDef, Haul } from './outing.ts';
export { LANE_MOUTHS, TELL_CHARGE, TELL_SPIT, TELL_SLAM, TELL_SURFACE, TELL_SUMMON } from './enemies.ts';
export { ES, HZ_RING, HZ_SHARD, PK_SCRIP, PK_TIMBER, PK_ORE, PK_HIDE, NODE_TREE, NODE_SEAM, NODE_CARCASS, NODE_PLANT } from './types.ts';
export type {
  Run, RunOptions, Player, Enemy, Shot, EShot, Pickup, ResNode, Hazard, WeaponState, Bench, Offer, OfferKind,
  UpgradeChoice, SimEvent, EventType, EventQueue, Phase, Outing,
} from './types.ts';

// Content tables. Tuning is editing these files.
export { WEAPONS, WEAPON_INDEX, SET_BONUS, BLUNT_KNOCK, SHOT_PIERCE, CLASS_LABEL, SOURCE_IDS } from './data/weapons.ts';
export type { WeaponDef, WeaponClass, WeaponKind, NodeType } from './data/weapons.ts';
export { ENEMIES, ENEMY_INDEX, AI, enemySpeed } from './data/enemies.ts';
export type { EnemyDef } from './data/enemies.ts';
export { WAVES, WAVE_PLAN, MULE_AFTER } from './data/waves.ts';
export type { WaveDef, SpawnGroup } from './data/waves.ts';
export { CHARACTERS, CHARACTER } from './data/characters.ts';
export type { CharacterDef } from './data/characters.ts';
export { UPGRADE_VALUE } from './data/upgrades.ts';
export {
  TICK_HZ, DT, ARENA_W, ARENA_H, ARENA_PAD, MAX_ENEMIES, MAX_SHOTS, MAX_ESHOTS, MAX_PICKUPS, MAX_NODES, MAX_HAZARDS,
  PLAYER_R, NODE_RING, IFRAMES, SPAWN_TELL, BLAST_RADIUS, HURT_BLAST_RADIUS, STAT_CAP, SPECIAL_CAP,
  HAZARD_RULES, MAX_HAZARD, STACK_BONUS, SLOW_VULN, WORK_EXPOSED, NOISE_FROM_WAVE, COMMISSION_FROM,
} from './data/tuning.ts';

// The headless player, for demos, tests and the balance script.
export { createBot, botInput, botBench, playRun, standInFusion, POLICIES, STRATEGIES, policy } from './bot.ts';
export type { BotState, Policy, BenchLog } from './bot.ts';
