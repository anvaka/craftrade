# Crafting in detail

Companion to `plan.md`. Proposal, nothing built.

## The three steps

1. **Gather** raws on an outing: wood, ore, fibre, hide, plus the odd rare.
2. **Refine** at a town station: wood to planks, ore to bars, fibre to cloth,
   hide to leather. Fixed recipes, no model, done in bulk.
   - Tier 1: 4 raws make 1 refined good.
   - Tier N: 2 refined goods of tier N-1, 4 raws of tier N and 1 reagent from
     another skill (charcoal from Logging, flux from Mining, tannin from
     Harvesting).
   - The station's tier is the highest tier it can refine.
3. **Make** an item at a crafting station. This is where the choices are.

## Making an item

An item is a **pattern** filled with **materials**.

- **The pattern says what it is.** Hatchet, blade, bow, coat, bag, charm,
  stew, trophy, chair. A pattern has named slots, each asking for a family:
  a hatchet is a head (metal), a haft (wood) and a binding (fibre or hide).
  The pattern and tier set the base numbers (damage, speed, armour, bag
  size) from tables in code. You start with the plain patterns; the rest are
  **schematics** found in chests, on bosses and as commission rewards
  (hooked hatchet, long bow, lined coat), with "?/N known" always shown.
- **The materials say what it does.** Every material has two or three
  properties from a list of about 24: hard, heavy, light, supple, bright,
  brittle, oily, warm, sharp-scented and so on. The set of materials in the
  slots decides the item's effects.
- **Tier sets the budget.** The item's tier is the lowest tier among its
  materials, capped by the station's tier and your skill level. Each tier
  has a fixed effect budget. Nothing else can raise it.

### Known and untried

- A **known** combination shows exactly what you will get. No lottery.
- An **untried** combination shows the budget and a hint read from the
  properties ("hard and bright: likely edge and crit"). The first time
  anyone makes it, the model spends the budget on effects from the closed
  effect list, in keeping with the properties, and offers three names. The
  maker picks one. The result is fixed for the world from then on.
- Negative effects buy more budget, as today, so odd materials make odd,
  lopsided items.

### Quality, the part you can prepare for

Effects never vary. **Quality** does: a roll inside a range the screen
shows, moving the base numbers a few percent up or down. The range moves
with your skill level, the station tier, the food you ate, your house
trophies and a crafter's outfit. The top of the range is a masterwork with
your name on it.

### One chosen extra

A pattern has one optional slot for a rare (resin, a gem, a perfect hide).
It adds one perk that you choose from that rare's short list.

## Invented materials

Rare nodes on charts yield materials the model invented: a name and
properties from the same list. Saltglass: brittle, bright. Each belongs to a
fixed tier and family, so it also works as plain metal in any recipe. Its
supply is limited to the charts that have it, so what it makes is scarce.

## Discoveries as knowledge

The result of a combination is the same for everyone, so a discovery is
information. The finder can:

- keep it quiet and be the only one who knows what saltglass does in a
  hatchet;
- sell the recipe note on the market;
- publish it at the station for town standing and their name in the codex.

Anyone who stumbles on the same combination gets the same item and is
listed as a later finder.

## What stops power creep

- The budget per tier is fixed, so every discovery is a sidegrade inside
  its tier. "Best" means best for a zone, a weapon or a twist, not a bigger
  number.
- Effects that touch yield, prices or drops are not on the model's list.
- Untried combinations cost materials and a daily allowance, raised by the
  assay station.

## What keeps materials moving

- Gear wears on outings and is repaired with the materials it was made of.
- Salvage returns part of the materials, always less than the cost.
- Food and charts are used up.
- Station tiers, the house, trophies and furniture are the large sinks.

## A worked example

You have Mining 12 and Smithing 9, and the forge is tier 2.

1. An outing in the fen on the chart "Sunken Orchard" gives you silver ore,
   aged wood, reed and three lumps of saltglass from a rare seam.
2. At the smelter: 4 silver ore, 2 iron bars and 1 charcoal make 1 silver
   bar. At the sawmill, aged planks.
3. At the forge you open the hatchet pattern. Silver head, aged haft, reed
   binding is known: "Fen hatchet, tier 2: works trees 2.5x, +6% speed".
   The screen shows quality 82-94 and says a smith's stew would make it
   86-98.
4. You swap the head for saltglass. The screen says: untried; tier 2
   budget; brittle and bright, likely bursts of speed and fragile. You make it. The
   model returns: every fifth stroke counts three times, wears twice as
   fast. You name it "Glass tooth". Nobody else in the world knows this
   recipe yet.
5. You keep one, and decide whether to sell the note or publish it.
