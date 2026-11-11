// One description per thing, used wherever its name is shown: an item's name
// or a weapon's name, anywhere in the game, carries the same tooltip.
// Pages that already print the effects beside the name still give the name
// this tooltip, so pointing at a name always answers "what does this do?".

import { effectText, isRelic, itemTier, type ItemSpec } from '../../shared/item.ts';
import { CLASS_LABEL, type WeaponDef } from '../../sim/data/weapons.ts';
import { setTip } from './tip.ts';

const STAT_WORD: Record<string, string> = { armor: 'Armor', maxHp: 'Max HP', melee: 'Melee', ranged: 'Ranged', reach: 'Reach', harvest: 'Harvest' };

/** "Wood collar, tier 1: +1 Mend, +2 Ranged." A relic says so and says it does not wear. */
export function itemTip(item: ItemSpec): string {
  const fx = item.effects.map(effectText).filter(Boolean).join(', ');
  if (isRelic(item)) {
    const no = item.serial ? ` No. ${item.serial} in the world${item.by ? `, found by ${item.by}` : ''}.` : '';
    return `${item.name}, relic: ${fx}. Does not wear and cannot be fused.${no}`;
  }
  const by = item.by ? ` First made by ${item.by}.` : '';
  return `${item.name}, tier ${itemTier(item)}: ${fx || 'no effect'}.${by}`;
}

/** What a weapon does at a tier: with the player's stats when they are given, else its own base figures. */
export interface WeaponNow { damage: number; cooldown: number; reach: number }

/** "Hatchet, tier 2 (Edge, Tool): 7 damage every 0.90 s, reach 96. Sweep. Works trees at double rate. Scales with Harvest." */
export function weaponTip(def: WeaponDef, tier: number, now?: WeaponNow): string {
  const t = Math.max(1, Math.min(4, tier)) - 1;
  const dmg = now ? now.damage : def.dmg[t];
  const cd = now ? now.cooldown : def.cd[t];
  const reach = now ? now.reach : def.range;
  const parts = [`${Math.round(dmg)} damage every ${cd.toFixed(2)} s, reach ${Math.round(reach)}${now ? ' with your stats' : ''}.`];
  if (def.burn) parts.push(`Burns ${def.burn[t]} a second for 3 s.`);
  if (def.slow) parts.push(`Slows by ${Math.round(def.slow[t] * 100)}% for 2 s.`);
  if (def.passive) parts.push(`+${def.passive.v[t]} ${STAT_WORD[def.passive.stat] ?? def.passive.stat} while held.`);
  if (def.crit >= 10) parts.push(`+${def.crit}% crit.`);
  parts.push(def.note);
  return `${def.name}, tier ${tier} (${def.classes.map((c) => CLASS_LABEL[c]).join(', ')}): ${parts.join(' ')}`;
}

function named(text: string, tip: string, cls: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = `term ${cls}`.trim();
  s.textContent = text;
  s.tabIndex = 0;
  setTip(s, tip);
  return s;
}

/** An item's name that explains the item. */
export const itemName = (item: ItemSpec, cls = ''): HTMLSpanElement => named(item.name, itemTip(item), cls);

/** A weapon's name that explains the weapon. */
export const weaponName = (def: WeaponDef, tier: number, now?: WeaponNow, cls = ''): HTMLSpanElement =>
  named(def.name, weaponTip(def, tier, now), cls);
