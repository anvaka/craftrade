// Two sinks that live in the workshop and the stash: putting a charge back
// on a worn item, and buying another shelf. Both destroy what they cost.

import { isRelic } from '../src/shared/item.ts';
import { KIT_CHARGES, type ExpandReq, type RepairReq, type WorkshopRes } from '../src/shared/protocol.ts';
import { PERK, REPAIR, repairCost, stashNextCost } from './config.ts';
import { tx } from './db.ts';
import { bad } from './errors.ts';
import { once } from './idem.ts';
import { heldItem, move, perkOn, playerById, profile, stashRow, type Ctx, type Player } from './players.ts';

const view = (ctx: Ctx, player: Player): WorkshopRes => ({ profile: profile(ctx, player.id) });

/** One charge back, for marks and raws by the item's points. An item can be repaired twice, then it wears out for good. */
export function repair(ctx: Ctx, player: Player, req: RepairReq): WorkshopRes {
  return tx(ctx.db, () =>
    once(ctx, player.id, req.idem, req, () => {
      const row = stashRow(ctx, player.id, req.uid);
      const item = row && heldItem(ctx, row);
      if (!row || !item) throw bad('not_owned', 'That item is not in your stash.');
      if (isRelic(item)) throw bad('blocked', 'A relic does not wear and needs no repair.');
      if (row.charges >= KIT_CHARGES) throw bad('not_worn', 'That item has every charge left.');
      if (row.repairs >= REPAIR.perItem) throw bad('repair_limit', `An item can be repaired ${REPAIR.perItem} times. This one is past mending.`);
      const cost = repairCost(item, perkOn(ctx, 'granary') ? PERK.granaryRepair : 1);
      move(ctx, player.id, 'repair', { marks: -cost.marks, timber: -cost.raws.timber, ore: -cost.raws.ore, hide: -cost.raws.hide }, item.id);
      ctx.db.prepare('UPDATE stash SET charges = charges + 1, repairs = repairs + 1 WHERE uid = ?').run(row.uid);
      return view(ctx, player);
    }, () => view(ctx, player)),
  );
}

/** One more shelf in the stash. Each costs more than the last. */
export function expandStash(ctx: Ctx, player: Player, req: ExpandReq): WorkshopRes {
  return tx(ctx.db, () =>
    once(ctx, player.id, req.idem, req, () => {
      const bought = playerById(ctx, player.id).stash_bought;
      const cost = stashNextCost(bought);
      if (!cost) throw bad('stash_max', 'The stash is as large as it gets.');
      move(ctx, player.id, 'stash_shelf', { marks: -cost.marks, timber: -cost.raws.timber, ore: -cost.raws.ore, hide: -cost.raws.hide }, `shelf ${bought + 1}`);
      ctx.db.prepare('UPDATE players SET stash_bought = stash_bought + 1 WHERE id = ?').run(player.id);
      return view(ctx, player);
    }, () => view(ctx, player)),
  );
}
