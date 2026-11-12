# Decision log

## 2026-11-12: the owner's answers to the five questions

1. New World evenings: collect resources, turn them into higher tiers, find
   rare loot and rare schematics, craft furniture and equipment, sell on the
   trading post, run dungeons.
2. Stopped wanting another run: the lull test is boring, you stand and nothing
   happens. Earlier versions were repetitive, and it was hard to collect
   anything, with no clear sign of why collecting is useful.
3. Best moment: in Brotato, when the build finally meets the curve and you roll
   from there. In Scrip, not found yet, but glimpses of discovery were fun.
4. Too much in a wave: it is impossible to collect anything, and it became
   repetitive.
5. Strength: the town grows stronger over years; each run can become wilder.

What follows from them:

- The run is the dungeon. Collecting in it must never mean standing still:
  materials drop from what you kill and fly to you.
- Every drop must say what it is for, in the run, at the moment it lands.
- The town is New World's chain: refine to higher tiers, craft from
  schematics, furniture, the trading post. It is where power lasts.
- The run is Brotato's: the build gets wilder inside it. Discovery is the
  thread that already worked.
- Out: the lull, standing in rings as the main way to gather, calm phases.

## Test card 1: loot that is for something (approved 2026-11-12, built, link `?proto=loot`)

- **Feeling:** "that drop is exactly what I needed", and wanting the next run
  to get the rest.
- **What you do:** play an ordinary run. Kills drop materials that fly to you,
  no standing. Elites and the boss drop rarer ones and sometimes a schematic,
  which stops the picture for a moment with its name. A strip on the HUD shows
  the craft you are collecting for ("Iron 7/10 for a Steel hatchet"). At home,
  a workbench turns iron into steel and the schematic plus materials into the
  item, which you can pack for the next run.
- **Faked:** two tiers, three schematics, one bench. No trading post, no
  furniture, no model.
- **Build:** about 2 hours. One link, `?proto=loot`.
- **Stop if:** after three runs you cannot name a drop you were glad of, or you
  do not care about the next craft.

## 2026-11-12: test card 1 played

Verdict: still boring. Critique: a bespoke answer to one slice ("kills drop
materials for one recipe") instead of the whole picture. Round 3 researches
New World's loot model and its whole system graph before anything is built.

The owner's further diagnosis: "weapons/tools are given to you by default and
not crafted". In Scrip the starting weapon is free and every other weapon and
tool is bought for run scrip at the bench; town fusion only makes items. So
nothing the player fights or gathers with comes out of the crafting chain, and
the loop gather, refine, craft gear, use it to reach rarer materials is open.
Open question for round 3: how the loadout taken into a run can be the output
of the chain while the run itself still gets wilder (the owner's own split:
the town grows stronger over years, each run can become wilder).

## 2026-11-12: round 3, and the forge game

Round 3 mapped New World as one system (`../round3/`). The owner approved the
whole-game skeleton ("the town forges the loadout, the run bends it") and the
change that the bench stops selling weapons, and asked for the build.

Built as `?proto=forge`, one thin version through every node of the skeleton:
two material tiers, refining, three stations with tiers, three trade skills,
13 recipes with a shown range and a quality roll, parts as perks, a house with
trophies and a relic shelf, a trader, wear and repair; in the run, made weapons
only, tool doors, two zones, drops in four colours, parts that fit sockets, and
a bad-luck floor for relics. The model is not wired into the forge yet: a first
part-and-recipe pair is named from a word list.

Question for the owner: after a few runs, which moment do you remember, and do
you want to go back to the forge?
