# Round 2 breaker review: session_sim2.py

## 1. Verdict

v2 fixes the round-1 method errors (reactive policy, common random numbers, held-out scoring), but its headline "9 of 10 for regular" rests on an under-converged search, thresholds smaller than the search's own noise, and a strawman rule family. A five-clause plain rule I wrote scores 97-98% of the best policy I could find at all three skills and beats the author's "optimiser" outright, so at the tuned point the loop is solved.

## 2. Round-1 findings

| Round-1 finding | Status | Evidence (code and my runs) |
|---|---|---|
| Only fixed plans; reactive player earns 2.6x | Fixed | 16-parameter reactive policy; my stronger search gains only 3-8% |
| Winner picked by noise, no common random numbers | Partly | Seeds are shared, but four search seeds give regular optimum 205-224 |
| SOLVED/DEAD labels are artefacts | Partly | Replaced by re-optimised lever ratios; same-force ratio spans 0.78-0.94 across search seeds |
| Reward cadence is an input | Fixed by deletion | No cadence claim remains |
| Value is risk-neutral loot, no time | Not fixed | Per-wave added; no per-minute, no between-run overhead |
| Never gathering earns 90-97% | Partly | Now 83-90% at the tuned point; author's shake 4/8 |
| Curse dominant | Partly | Shrine taken 75-85% by the optimum; "always" keeps 93-99% |
| Skill only multiplies power | Partly | Adds gather cost and noise, yet regular's policy scores 96.6-100% on all skills |
| Spend-then-hoard clock | Not fixed | Optimum crafts at every camp to wave 11; health and need triggers unused (0.02-0.05, 0.97) |
| First-boss reset farming | Not fixed | 25.9 per wave against 21.2 |
| Death does not matter | Partly | Keep 0 / 0.2 / 0.8 gives 212 / 224 / 285; at 0.8 the optimum dies 98% |
| Exponential threat against linear power | Not fixed | Hidden by cutting to 12 waves plus a one-off 1.8x |
| Bag drop, heat timing, weapon equals drops, economy | Not addressed | Weapon is random per run, not chosen; economy model untouched here |

## 3. New bugs and rigging, ranked

1. **Not an optimiser.** Restarts give 152-167 (casual), 203-223 (regular), 244-266 (hardcore). Best found: 171 / 227 / 272 against the author's 158 / 220 / 251. The printed "shrine always keeps 102%" already showed this.
2. **Thresholds below noise.** Checks use 3-5% margins; search noise is about 5%. With search seed 1 or 3, regular fails shrine (0.991) and craft (0.995, 0.999).
3. **Rule family is a strawman.** Constant gathering, and "craft always" burns the bag on wave 12. Its best scores 61-72% of my optimum.
4. **Two of the three "robust" checks cannot fail:** flat-out gathering and random routing are deliberately bad baselines. Need-only routing loses about 2%; matchup is nearly dead.
5. **Breakout is not earned.** Requiring 0 or 2 crafts gives 229 against 227; removing it gives 136.
6. **Bag weight is the model.** bag_slow 0.40 to 0 moves the optimum from 224 to 533.
7. **Final-boss coin flip.** Regular deaths: 16% by wave 11, 28% in total.
8. Robustness: 8 draws, regular only, one search seed.
9. Minor: "one craft per camp" allows two (harmless: fixing it changes value under 1%). Lull gathering is always full, untested.

## 4. Dominant strategy: found at the tuned point

Go where the town's most-needed material is. Take the shrine unless another ground is much more needed. Gather flat out in lulls; under fire gather fully when healthy and out-gunning the wave, not at all when hurt (0.5 + 2 x health - 2 x threat/power). Craft at every camp to wave 11. Extract early only below 20% health.

Scores 165 / 223 / 267, which is 97% / 98% / 98% of my best. Caveat: with constants frozen it falls to 69-76% under ±30% shakes; coarsely retuned it reaches 98%, 88%, 88%, 75% on four draws. The shape is dominant at baseline, not proven everywhere.

## 5. Depth versus farming

Partly real, partly artefact. Real in this model: deep_bonus 3 passes depth (0.93) and narrowly fails per-wave; 4 passes per-wave and fails depth (0.99); 6 gives 1.02. Only bag weight makes bailing attractive, and it taxes deep income equally. Artefact: per-wave ignores overhead. With one wave-equivalent per run, farming still leads (20.7 against 19.4); with three, deep leads (16.5 against 14.8). Stopping at gate 2 is worst (19.0), so depth is binary.

The proposed fix would pass the per-wave check by fiat and likely fail the depth check, as deep_bonus 6 does. If deep materials are tradable, farmers buy them. What is missing is a bail-out reason other than bag weight.

## 6. Issues

**Blockers:** search noise exceeds check margins; the one-sentence check fails once a fair rule is written; "9 of 10" does not survive ±30%.

**Major:** breakout unearned; bag_slow dominance; no time metric; craft and shrine near-mandatory; skill does not change policy; binary depth.

**Minor:** craft counter bug; untested lull lever; 8-draw robustness; final-wave death clustering.

## 7. More simulation before a prototype?

No. Every surviving conclusion is negative or tuning-dependent, and the remaining unknowns (whether gathering under fire is readable and tense, real overhead per run, how players bail) are not in the model. One cheap exception: an overhead-adjusted per-minute table to set first-boss rewards.

Work files: `/home/claude/out/reviews/work-r2-breaker/` (`h.py`, `e1.py`-`e6.py`, `sim_fix.py`). Originals untouched.
