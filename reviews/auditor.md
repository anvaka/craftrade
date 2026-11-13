# Simulation audit: session_sim.py and economy_model.py

## 1. Verdict

Neither model supports any claim that the loop is "engaging"; they are tuned spreadsheets whose headline numbers (best policy, close-call rate, number of near-best policies, lever labels) move with seed, grid and any ±30% parameter change. The only findings that survive my attempts to break them are negative ones: the curse is a non-choice, gathering under fire (the "core bet") is worth 0-10% of run value, and the reward-cadence numbers are hard-coded by the schedule.

## 2. Bugs and rigged assumptions, by severity

**session_sim.py**

1. **Reward cadence is an input, not a result (L52, L63-75).** Events fire at fixed boss waves (5, 10, ...) and curse-end waves (4, 9, ...). "Event every 2.4 waves, longest drought 4.0" is that schedule read back: with no curse I get exactly 0.200 events/wave and drought 5.00 for any policy. The drought also ignores the final stretch before death. Unfalsifiable.
2. **SOLVED/DEAD/live labels are artefacts (L98-117).** "SOLVED" is the share of policies within 5% of best that use the best option; that set has 1-3 members, so the share takes only a few coarse values (100%, 67%, 50%). With one member every lever is "SOLVED" by construction. "DEAD" needs a spread under 3% measured against deliberately bad options (spend 0, gather 1.0), so it can never fire. Across 30 seeds at the published 600 runs, hardcore depth and spend flip SOLVED/live 15/30 each.
3. **Winner picked by noise (L96 vs L104).** Policies are ranked on seed `i % 7` (no common random numbers) and the lever table is recomputed on seed 3. The published output contradicts itself: casual "best gather = 0.5" (106) loses to adaptive (107) on its own line. The published casual policy wins in 9/30 seeds; its "death 11%, close call 45%" becomes 4% and 30% for the true optimum at 20,000 runs.
4. **Value metric (L84) does not reward what the design cares about.** It is risk-neutral mean loot per run: no time, no loss aversion, no build power, no enjoyment. Per wave played, the optimum is depth 1 for every skill. Under the median, zero gathering is best for casual and regular. Schematics at an arbitrary 40 drive route and depth (at 0, casual best is gather 0 / safe; at 80, gather 0 for casual and regular).
5. **The core lever is nearly flat.** Never gathering (kill drops only) earns 97%, 97% and 90% of best (20,000 runs). Gathering matters only if `gather_time_cost` or `heat_per_gather` are cut (zero gathering falls to about 60%).
6. **Curse is dominant by construction (L64, L76).** Skipping it earns 63-65% of best. The flat bonus is also spendable on power, so the curse pays for its own penalty. It stays best at a tenth of the yield; it flips only when the penalty rises from +30% to +80% threat.
7. **Skill is only a multiplier on power (L55).** It has no effect on gathering, variance, or decisions. Seeds are the same across skill levels (acceptable).
8. **Only two state-dependent rules exist** (gather, route), with fixed thresholds 0.5/0.6. Spend, curse and depth are fixed plans. "Adaptive route is best" says only that one feedback rule beats two constants. A state-dependent extraction rule I added never won, so that conclusion is not sensitive to this gap.
9. **Depth is set by exponential threat against linear power (L54, L77).** No policy clears depth 4 with under 47% death; changing `threat_growth` 1.10 to 1.17 moves optimal depth from 3-4 to 2. Half of the 20 waves are effectively unreachable.
10. **Grid artefact.** On a finer grid (1,008 policies) regular's optimum moves to depth 3, gather 0.25, spend 0.83.
11. **Model contradicts the design.** "Two material classes: run currency resets" (keep-core) removes the spend-or-bank trade-off the spend lever models. Design notes cite depths "3, 4, 5"; this model gives 2, 2, 3.

**economy_model.py**

1. **"Consumables make crafting pay" is forced (L67-70, L90).** Every player must buy consumables equal to 25% of yield, which give no benefit, through crafters at a fixed 15% margin with no competition or self-crafting. Crafter income scales roughly with consumables × margin ÷ crafter share: 50% uptake gives 0.43x, margin 5% gives 0.38x, crafter share 30% gives 0.57x. The author's "32 of 40" tests only "more than 2× baseline", not "about 1.0x"; at 0.8x or more it is 24/40. Shaking the assumptions the author held fixed (uptake, crafter share, margin, self-crafting, price speed) gives 1/40.
2. **Price-adjustment exponent 0.25 (L93)** is unshaken: end price runs 0.02 to 0.45 and baseline crafter income 0.01x to 0.28x across 0.1-1.0.
3. **Success rate is fixed per cohort and independent of gear (L13, L34),** and contradicts the session model (economy: 65/78/88% success; session best play: 96/84/60%). The author's own sensitivity refutes two design notes: front-loading holds 1/40, wear keeping the market 11/40.
4. Bug (L70 vs L83): consumable buyers pay in full when only a `fill` fraction is delivered.

## 3. Robustness table

Random = all 36 numeric parameters jointly ±30% (growth rates and multipliers perturbed as excess over 1), 2,000 runs, common random numbers. One-at-a-time = each parameter ×0.7 and ×1.3.

| Conclusion | Random (of 40) | One-at-a-time (of 72) |
|---|---|---|
| Curse taken by all skills | 40 | 72 |
| Adaptive route best for all skills | 18 | 66 |
| At most 2 policies within 5% of best, all skills | 19 | 7 (baseline fails: 3, 2, 2) |
| At most 5 policies within 5% of best | 40 | 70 |
| Close-call rate 30-50%, all skills | 6 | 12 (baseline fails: 30, 51, 28%) |
| Death rate of best play 5-45%, all skills | 19 | 33 |
| Optimal depth interior (2 or 3), all skills | 25 | 68 |
| Optimal depth differs by skill | 24 | 65 |
| Same best policy as baseline | 0 | 19 |
| Zero gathering within 5% of best, some skill | 25 | 64 |
| Zero gathering is the outright best, some skill | 21 | not tallied |
| Median policy earns under 40% of best | 37 | 72 |
| Published best policy reproduced (30 seeds, 600 runs) | casual 9/30, regular 28/30, hardcore 28/30 | |
| Economy: consumables lift crafters to 0.8x or more | 24 (author's shake) | 1 of 40 (unshaken assumptions) |

Close-call rates ranged 0-68% and death rates 0-67% across random perturbations.

## 4. What the models cannot tell anyone

- Whether any minute of play is enjoyable, readable or tense. There is no player, no arena, no time, no input.
- Whether choices feel meaningful. An optimiser finding one best policy says nothing about whether humans perceive or enjoy the trade-off.
- Retention, session length, or willingness to return after a death.
- They can support only conditional, structural statements: under these numbers the curse is free, gathering barely pays, and deep waves are unreachable. Those are tuning warnings, not evidence of engagement.

Missing metrics a sceptic would demand: value per minute; regret of simple heuristic players against the optimum; variety of viable builds (none are modelled); outcome variance attributable to decisions versus luck; loss-streak length; decisions per minute; confidence intervals on every reported number.

## 5. Three changes that would most improve the models

1. **Report distributions, not one tuned point.** Common random numbers, 5,000+ runs, intervals, and every headline stated as "holds in X of N perturbations". Replace SOLVED/DEAD/live with the best achievable value per lever option.
2. **Model decisions and time.** State-dependent policies for every lever, heuristic and loss-averse player types beside the optimiser, value per minute, skill that changes gathering and variance, and events that emerge from play.
3. **Join the two models and let demand respond.** Feed session outcomes (success, yield, depth) into the economy; make consumable demand depend on their benefit and price, with crafter competition and self-crafting.

Work files: `/home/claude/out/reviews/work-auditor/` (`sim_a.py`, `h.py`, `e1.py`-`e4.py`, `eco_a.py`, `e2.out`, `e3.out`). Originals untouched.
