// The bench: upgrade picks, four offers, reroll, lock, scrap, the anvil
// (fusion), the mule and "Next wave". DOM, ledger style. Every action goes
// straight to the sim's bench functions; a refusal is shown as one dry line.
import { GLOSS, STAT_MEANING } from '../ui/glossary.ts';
import { setTip, term } from '../ui/tip.ts';
import type { Sprites } from '../art/index.ts';
import { audio } from '../audio/index.ts';
import { effectText, itemTier, type ItemSpec } from '../../shared/item.ts';
import { DEATH_RAW_KEEP } from '../../shared/protocol.ts';
import { PRIM, RAWS, STATS, STAT_LABEL, STAT_PERCENT, type RawBag, type RawId, type StatId } from '../../shared/vocab.ts';
import {
  BLUNT_KNOCK, CHARACTER, CLASSES, CLASS_LABEL, SET_BONUS, ST, WEAPONS, WEAPON_INDEX, buyBlock, fuseCost,
  rerollCost, weaponSlots, scrapValueItem, scrapValueWeapon, offerCost, twinOf, tierUpBlock, tierUpCost, SHOT_PIERCE, STACK_BONUS,
  weaponCooldown, weaponDamage, weaponRange, type Run, type WeaponClass,
} from '../../sim/index.ts';
import { rec } from '../../shared/replay.ts';
import type { FuseOutcome } from '../seam.ts';

// Every action goes through the recorder, so the town can play the run again (src/shared/replay.ts).
const { applyFusion, buy, pickUpgrade, reroll, scrapItem, scrapWeapon, sendMule, toggleLock } = rec;
import { cap, cost, el, ic, rawsText, stamp, tier, type Kid } from './dom.ts';
import { soundControls, type SoundControls } from './hud.ts';
import { learn, learned } from './progress.ts';

export interface BenchDeps {
  run: Run;
  sprites: () => Sprites;
  playerName: string;
  /** False: no teaching lines (the dev harness). */
  teach: boolean;
  fuse(a: string, b: string): Promise<FuseOutcome>;
  /** Start the next wave. */
  next(): void;
  /** Something at the bench was done: the run should be written down again. */
  changed?(): void;
  pause(): void;
}

export interface BenchScreen {
  el: HTMLElement;
  open(): void;
  close(): void;
  /** False while the pause panel is up. */
  active: boolean;
  destroy(): void;
}

type Slim = { def: number; tier: number };

/** The weapons held after one more is bought: side by side while a slot is free, combined with a twin when hands are full. */
function weaponsAfter(list: Slim[], def: number, t: number, slots: number): Slim[] {
  const out = list.map((w) => ({ def: w.def, tier: w.tier }));
  if (out.length >= slots && t < 4) {
    const twin = out.findIndex((w) => w.def === def && w.tier === t);
    if (twin >= 0) { out.splice(twin, 1); t++; }
  }
  out.push({ def, tier: t });
  return out;
}

/** Flat stats that come from the weapons held: passives and set bonuses. */
function weaponStats(list: Slim[]): Float64Array {
  const f = new Float64Array(STATS.length);
  const count = new Int32Array(CLASSES.length);
  for (const w of list) {
    const def = WEAPONS[w.def];
    for (const c of def.classes) count[(CLASSES as readonly string[]).indexOf(c)]++;
    if (def.passive) f[ST[def.passive.stat]] += def.passive.v[w.tier - 1];
  }
  for (let c = 0; c < CLASSES.length; c++) {
    if (count[c] < 2) continue;
    const step = count[c] >= 6 ? 2 : count[c] >= 4 ? 1 : 0;
    for (const b of SET_BONUS[CLASSES[c] as WeaponClass]) f[ST[b.stat]] += b.v[step];
  }
  return f;
}

const fmtStat = (id: StatId, v: number): string => `${Math.round(v * 10) / 10}${STAT_PERCENT[id] ? '%' : ''}`;
const signed = (id: StatId, v: number): string => `${v > 0 ? '+' : '-'}${fmtStat(id, Math.abs(v))}`;
const low = (s: string): string => s.toLowerCase();

export function createBench(parent: HTMLElement, deps: BenchDeps): BenchScreen {
  const { run } = deps;
  const p = run.player, b = run.bench;
  const root = el('div', 'g-bench g-overlay');
  root.hidden = true;
  root.tabIndex = -1;
  parent.append(root);

  let S = deps.sprites();
  let sound: SoundControls | null = null;
  let reason = '';
  let reasonBad = false;
  let anvil: [string | null, string | null] = [null, null];
  let pending = false;
  let waitTimer = 0;
  let stopLoop: (() => void) | null = null;
  let reveal: { item: ItemSpec; first: boolean; by: string } | null = null;
  let combined = -1;
  let scrapArm = '';
  /** What was armed before the current action; a second press on the same thing confirms. */
  let prevArm = '';
  let lockHeld = false;
  let load: RawBag = { timber: 0, ore: 0, hide: 0 };
  let muleNote = '';
  // Taught once per device, each kept until the thing has been done.
  let spendHint = deps.teach && !learned('bench');
  let anvilHint = deps.teach && !learned('anvil');
  let alive = true;
  const madeThisRun = new Map<string, ItemSpec>();
  let statDelta: HTMLElement[] = [];
  let statRow: HTMLElement[] = [];
  let statZero: boolean[] = [];
  let statNone: HTMLElement | null = null;
  let hovered = '';

  const pairKey = (a: string, c: string): string => (a < c ? `${a}+${c}` : `${c}+${a}`);
  const itemIndex = (id: string | null, skip = -1): number => {
    if (!id) return -1;
    // Only for the anvil: a packed item stays off it, so it is never the one found.
    for (let i = 0; i < p.items.length; i++) if (i !== skip && !p.itemKit[i] && p.items[i].id === id) return i;
    return -1;
  };

  function say(text: string, bad = false): void { reason = text; reasonBad = bad; }
  function refuse(text: string): void {
    say(text, true);
    audio.play('lock', { pitch: 0.7, gain: 0.7 });
  }

  // ---- stat preview ----------------------------------------------------------

  function preview(delta: Float64Array | null, key: string): void {
    hovered = delta ? key : '';
    for (let i = 0; i < STATS.length; i++) {
      const d = statDelta[i];
      if (!d) continue;
      const v = delta ? delta[i] : 0;
      const text = v ? signed(STATS[i], v) : '';
      if (d.textContent !== text) d.textContent = text;
      d.hidden = !v;
      if (statRow[i] && statZero[i]) statRow[i].hidden = !v;
    }
  }
  function offerDelta(i: number): Float64Array | null {
    const o = b.offers[i];
    if (!o || o.sold) return null;
    const d = new Float64Array(STATS.length);
    if (o.kind === 'item' && o.item) {
      for (const e of o.item.effects) {
        const prim = PRIM[e.p];
        if (prim && prim.kind === 'stat') d[ST[prim.stat!]] += (e.neg ? -1 : 1) * prim.values[e.l - 1];
      }
    } else {
      const before = weaponStats(p.weapons);
      const after = weaponStats(weaponsAfter(p.weapons, WEAPON_INDEX[o.id], o.tier, weaponSlots(run)));
      for (let k = 0; k < d.length; k++) d[k] = after[k] - before[k];
    }
    return d;
  }
  function watch(node: HTMLElement, key: string, delta: () => Float64Array | null): void {
    const on = (): void => preview(delta(), key);
    const off = (): void => { if (hovered === key) preview(null, ''); };
    node.addEventListener('pointerenter', on);
    node.addEventListener('pointerleave', off);
    node.addEventListener('focusin', on);
    node.addEventListener('focusout', off);
  }

  // ---- actions ---------------------------------------------------------------

  function act(fn: () => void, ev?: Event): void {
    if (pending || !alive) return;
    const fromKeys = !ev || (ev as MouseEvent).detail === 0;
    const fk = fromKeys ? (document.activeElement as HTMLElement | null)?.dataset?.fk ?? '' : '';
    combined = -1;
    prevArm = scrapArm;
    scrapArm = '';
    fn();
    deps.changed?.();
    render();
    if (fk) (root.querySelector(`[data-fk="${fk}"]`) as HTMLElement | null)?.focus();
    else if (ev) (document.activeElement as HTMLElement | null)?.blur();
  }

  function doPick(i: number): void {
    const c = b.choices[i];
    if (!c) return;
    if (pickUpgrade(run, i)) {
      audio.play('levelUp', { pitch: 1.2, gain: 0.7 });
      say(`${signed(c.stat, c.value)} ${STAT_LABEL[c.stat]}.`);
    }
  }
  function doBuy(i: number): void {
    const o = b.offers[i];
    if (!o) return;
    const block = buyBlock(run, i);
    if (block) { refuse(block); return; }
    const name = o.kind === 'weapon' ? WEAPONS[WEAPON_INDEX[o.id]].name : o.item!.name;
    const before = p.weapons.length;
    const wasTier = o.tier;
    buy(run, i);
    if (spendHint) { spendHint = false; learn('bench'); }
    if (o.kind === 'weapon' && p.weapons.length <= before) {
      combined = p.weapons.length - 1;
      audio.play('combine');
      say(`Two tier ${wasTier} made one tier ${p.weapons[combined].tier} ${low(name)}.`);
    } else {
      audio.play('buy');
      say(`${name} bought.`);
    }
    if (b.freeReroll) reason += ' All four bought: the next reroll is free.';
  }
  function doLock(i: number): void {
    if (toggleLock(run, i)) {
      audio.play('lock');
      say(b.offers[i].locked ? 'Locked. It stays, and its price holds.' : 'Unlocked.');
    } else refuse('Sold.');
  }
  function doReroll(): void {
    if (b.picks > 0) { refuse('Take your upgrade first.'); return; }
    const c = rerollCost(run);
    if (reroll(run)) { audio.play('reroll'); say(c ? `Rerolled for ${c} scrip.` : 'Rerolled, free.'); }
    else refuse('Not enough scrip.');
  }
  function doScrapWeapon(i: number): void {
    const w = p.weapons[i];
    if (!w) return;
    if (p.weapons.length <= 1) { refuse('The last weapon cannot be scrapped.'); return; }
    const key = `w${i}`;
    if (prevArm !== key) { scrapArm = key; say(`Scrap the ${low(WEAPONS[w.def].name)}? Press again.`); return; }
    const v = scrapValueWeapon(run, i);
    if (scrapWeapon(run, i)) { audio.play('buy', { pitch: 0.8 }); say(`${WEAPONS[w.def].name} scrapped for ${v} scrip.`); scrapArm = ''; }
  }
  function doTierUp(i: number): void {
    const w = p.weapons[i];
    if (!w) return;
    const block = tierUpBlock(run, i);
    if (block) { refuse(block); return; }
    if (rec.tierUp(run, i)) { audio.play('combine'); say(`${WEAPONS[w.def].name} raised to tier ${w.tier}.`); }
  }
  function doCombine(i: number): void {
    const w = p.weapons[i];
    if (!w || twinOf(run, i) < 0) return;
    const name = WEAPONS[w.def].name, was = w.tier;
    if (rec.combineWeapons(run, i)) { combined = Math.min(i, p.weapons.length - 1); audio.play('combine'); say(`Two tier ${was} made one tier ${was + 1} ${low(name)}. A slot is free.`); }
  }
  function doScrapItem(i: number): void {
    const it = p.items[i];
    if (!it) return;
    const key = `i${it.id}`;
    if (prevArm !== key) { scrapArm = key; say(`Scrap ${low(it.name)}? Press again.`); return; }
    const v = scrapValueItem(run, i);
    if (scrapItem(run, i)) {
      audio.play('buy', { pitch: 0.8 });
      say(`${it.name} scrapped for ${v} scrip.`);
      scrapArm = '';
      for (let k = 0; k < 2; k++) if (anvil[k] && itemIndex(anvil[k]) < 0) anvil[k] = null;
    }
  }
  function doAnvilPick(id: string): void {
    audio.play('stamp');
    if (anvil[0] === id) anvil[0] = null;
    else if (anvil[1] === id) anvil[1] = null;
    else if (!anvil[0]) anvil[0] = id;
    else anvil[1] = id;
    say('');
  }
  function doNext(): void {
    if (b.picks > 0) { refuse('Take your upgrade first.'); return; }
    deps.next();
  }
  function doMule(): void {
    const n = load.timber + load.ore + load.hide;
    if (n <= 0) { refuse('Nothing loaded.'); return; }
    const sent = { ...load };
    if (sendMule(run, load)) {
      audio.play('mule');
      muleNote = `Sent home: ${rawsText(sent)}.`;
      say(muleNote);
      load = { timber: 0, ore: 0, hide: 0 };
    } else refuse('The mule is not here.');
  }

  function strike(): void {
    if (pending) return;
    const ai = itemIndex(anvil[0]), bi = itemIndex(anvil[1], ai);
    if (ai < 0 || bi < 0) { refuse('Pick two different items.'); render(); return; }
    const q = fuseCost(run, ai, bi);
    if (q.block) { refuse(q.block); render(); return; }
    const A = p.items[ai], B = p.items[bi];
    pending = true;
    say('');
    audio.play('stamp');
    stopLoop = audio.loop('anvil');
    render();
    const done = (out: FuseOutcome): void => {
      if (!alive) return;
      pending = false;
      stopLoop?.(); stopLoop = null;
      window.clearInterval(waitTimer);
      if (!out.ok) {
        refuse(out.message || 'The anvil gave nothing. Nothing was used.');
        render();
        return;
      }
      // The bench is locked while we wait, so the indices still hold; look them up again all the same.
      const a2 = itemIndex(A.id), b2 = itemIndex(B.id, a2);
      const why = a2 < 0 || b2 < 0 ? 'Pick two different items.' : applyFusion(run, a2, b2, out.res.item);
      if (why) { refuse(`${why} Nothing was used.`); render(); return; }
      madeThisRun.set(pairKey(A.id, B.id), out.res.item);
      if (anvilHint) { anvilHint = false; learn('anvil'); }
      anvil = [null, null];
      reveal = { item: out.res.item, first: out.res.first, by: out.res.by || out.res.item.by || '' };
      audio.play(out.res.first ? 'revealFirst' : 'reveal');
      say('');
      render();
      (root.querySelector('[data-fk="reveal-done"]') as HTMLElement | null)?.focus();
    };
    let p0: Promise<FuseOutcome>;
    try { p0 = deps.fuse(A.id, B.id); } catch { p0 = Promise.resolve({ ok: false, code: 'error', message: 'The anvil gave nothing. Nothing was used.' }); }
    p0.then(done, () => done({ ok: false, code: 'error', message: 'The anvil gave nothing. Nothing was used.' }));
  }

  // ---- pieces ----------------------------------------------------------------

  const fx = (item: ItemSpec): HTMLElement => {
    const list = el('ul', 'effects');
    for (const e of item.effects) list.append(el('li', e.neg ? 'cost' : '', effectText(e)));
    return list;
  };
  const priceOf = (scrip: number, raws: RawBag, showScrip = true, mark = true): HTMLElement => {
    const price = el('span', 'price');
    if (showScrip) price.append(cost(S.icon.scrip, scrip, mark && p.scrip < scrip, 'scrip'));
    for (const r of RAWS) if (raws[r] > 0) price.append(cost(S.icon.raw[r], raws[r], mark && p.raws[r] < raws[r], r));
    return price;
  };
  const key = (k: string): HTMLElement => el('span', 'g-key', k);

  function upgradesSection(): HTMLElement {
    const s = el('section', 'section g-first');
    s.append(el('h2', '', term(`Level ${p.level - b.picks + 1}`, 'level'), ': pick one'));
    if (b.picks > 1) s.append(el('p', 'note', `${b.picks} picks owed.`));
    const list = el('ul', 'offers g-picks');
    b.choices.forEach((c, i) => {
      const cur = p.stat[ST[c.stat]];
      const btn = stamp('Take', 'stamp--small');
      btn.dataset.fk = `pick${i}`;
      btn.addEventListener('click', (ev) => act(() => doPick(i), ev));
      const li = el('li', 'offer g-pick',
        ic(S.icon.stat[c.stat], true),
        el('div', 'name', key(String(i + 1)), el('span', '', `${signed(c.stat, c.value)} ${STAT_LABEL[c.stat]}`), tier(c.tier)),
        el('ul', 'effects', el('li', '', `Now ${fmtStat(c.stat, cur)}, then ${fmtStat(c.stat, cur + c.value)}: ${low(statMeans(c.stat, cur + c.value))}`)),
        el('div', 'buy', btn));
      const d = new Float64Array(STATS.length);
      d[ST[c.stat]] = c.value;
      watch(li, `pick${i}`, () => d);
      list.append(li);
    });
    s.append(list);
    return s;
  }

  function offersSection(): HTMLElement {
    const s = el('section', 'section g-first');
    s.append(el('h2', '', 'Offers'));
    if (spendHint) s.append(el('p', 'note', 'Scrip buys these, and some also cost raws: the timber, ore and hide you gather. Buy what you can, then start the next wave.'));
    const list = el('ul', 'offers');
    b.offers.forEach((o, i) => {
      const lis: Kid[] = [];
      let icon: HTMLCanvasElement, name: string, kind: string, effects: HTMLElement;
      if (o.kind === 'weapon') {
        const def = WEAPONS[WEAPON_INDEX[o.id]];
        icon = ic(S.icon.weapon[o.id as keyof typeof S.icon.weapon], true);
        name = def.name;
        kind = `Weapon, ${def.classes.map((c) => low(CLASS_LABEL[c])).join(', ')}`;
        effects = el('ul', 'effects',
          el('li', '', def.note),
          el('li', '', `${Math.round(weaponDamage(p, def, o.tier))} damage every ${weaponCooldown(p, def, o.tier).toFixed(2)} s, reach ${Math.round(weaponRange(p, def))}`));
        const copies = p.copies[WEAPON_INDEX[o.id]];
        const twin = o.tier < 4 && p.weapons.some((w) => w.id === o.id && w.tier === o.tier);
        if (copies > 0 && !o.sold) effects.append(el('li', 'g-twin', p.weapons.length >= weaponSlots(run) && twin
          ? `Hands are full. This one combines with its twin into a tier ${o.tier + 1}.`
          : `You hold ${copies}. Each copy adds ${Math.round(STACK_BONUS * 100)}% damage to the others.`));
      } else {
        const it = o.item!;
        icon = ic(S.icon.glyph[it.glyph], true);
        name = it.name;
        kind = o.commission ? 'Commission, item' : 'Item';
        effects = fx(it);
      }
      const block = o.sold ? 'Sold.' : buyBlock(run, i);
      const buyBtn = stamp(o.sold ? 'Bought' : 'Buy', 'stamp--small');
      buyBtn.dataset.fk = `buy${i}`;
      if (o.sold) buyBtn.disabled = true;
      else {
        if (block) buyBtn.setAttribute('aria-disabled', 'true');
        if (block) setTip(buyBtn, block);
        buyBtn.addEventListener('click', (ev) => act(() => doBuy(i), ev));
      }
      const lockBtn = stamp(o.locked ? 'Locked' : 'Lock', `stamp--plain stamp--small${o.locked ? ' is-pressed' : ''}`);
      lockBtn.dataset.fk = `lock${i}`;
      lockBtn.setAttribute('aria-pressed', String(o.locked));
      setTip(lockBtn, o.locked ? 'Locked: it stays through rerolls. Press to unlock.' : `${GLOSS.lock} Key: L and the offer number.`);
      lockBtn.addEventListener('click', (ev) => act(() => doLock(i), ev));
      lis.push(
        icon,
        el('div', 'name', key(String(i + 1)), el('span', '', name), tier(o.tier), o.commission ? setTip(el('span', 'kind term', kind), 'One extra offer from bench 5: always tier 3 or 4, dear, and a reroll does not replace it.') : el('span', 'kind', kind), o.locked ? ic(S.icon.lock) : null),
        effects,
        el('div', 'buy', priceOf(o.price, o.raws, true, !o.sold),
          !o.sold && offerCost(run, i) > o.price ? el('span', 'note', `Short of raws: ${offerCost(run, i) - o.price} scrip more`) : null,
          el('div', 'acts', o.sold || o.commission ? null : lockBtn, buyBtn)),
      );
      const li = el('li', `offer${o.locked ? ' is-locked' : ''}${o.sold ? ' is-sold' : ''}`, ...lis);
      watch(li, `offer${i}`, () => offerDelta(i));
      list.append(li);
    });
    s.append(list);
    return s;
  }

  function anvilSection(): HTMLElement {
    const s = el('section', 'section g-anvil');
    s.append(el('h2', '', term('Anvil', 'anvil')));
    if (reveal) {
      const it = reveal.item;
      const mine = reveal.first || (!!reveal.by && reveal.by === deps.playerName);
      const find = setTip(el('div', `find-stamp thud${mine ? ' is-yours' : ''}`,
        el('span', 'label', reveal.first ? 'First find' : 'First made by'),
        el('span', 'name', reveal.first ? deps.playerName : reveal.by || 'someone before you')), reveal.first ? GLOSS.firstFind : GLOSS.firstMade);
      const done = stamp('Take it', '');
      done.dataset.fk = 'reveal-done';
      done.addEventListener('click', (ev) => act(() => { reveal = null; }, ev));
      s.append(el('div', 'g-reveal',
        ic(S.icon.glyph[it.glyph], true),
        el('div', 'g-reveal-body',
          el('div', 'name', el('span', '', it.name), tier(itemTier(it))),
          fx(it)),
        el('div', 'g-reveal-side', find, done)));
      return s;
    }
    if (pending) {
      const m = el('div', 'meter');
      let step = 0;
      window.clearInterval(waitTimer);
      waitTimer = window.setInterval(() => { step = (step % 6) + 1; m.style.setProperty('--v', String(step / 6)); }, 250);
      s.append(el('p', 'g-wait', 'On the anvil.'), m);
      return s;
    }
    const groups = new Map<string, ItemSpec>();
    // A relic never goes on the anvil, and nor does a packed item: it came in packed down, and the anvil would bring back the whole of it.
    p.items.forEach((it, i) => { if (!it.relic && !p.itemKit[i] && !groups.has(it.id)) groups.set(it.id, it); });
    const packedNote = p.itemKit.some(Boolean) ? ' Packed items stay off the anvil.' : '';
    if (groups.size < 2) {
      s.append(el('p', 'note', `Two different items go on and one new item comes off. What a pair makes is the same for everyone, and whoever strikes a pair first has their name on it for good. You need two items bought or made in this run.${packedNote}`));
      return s;
    }
    s.append(el('p', 'note', anvilHint
      ? 'You hold two different items. Pick both and strike: they are used up and one new item comes off. If nobody in the world has tried the pair, your name goes on what it makes.'
      : `Pick two different items. They are used up and one new item comes off.${packedNote}`));
    const picks = el('div', 'g-anvil-picks');
    for (const [id, it] of groups) {
      const on = anvil[0] === id || anvil[1] === id;
      const btn = stamp(null, `stamp--plain stamp--small${on ? ' is-pressed' : ''}`, ic(S.icon.glyph[it.glyph]), it.name, tier(itemTier(it)));
      btn.dataset.fk = `anvil${id}`;
      btn.setAttribute('aria-pressed', String(on));
      setTip(btn, it.effects.map((e) => effectText(e)).join(', '));
      btn.addEventListener('click', (ev) => act(() => doAnvilPick(id), ev));
      picks.append(btn);
    }
    s.append(picks);
    const ai = itemIndex(anvil[0]), bi = itemIndex(anvil[1], ai);
    const slot = (label: string, i: number): HTMLElement => {
      if (i < 0) return el('div', 'g-anvil-slot', el('span', 'label', label), el('span', 'note', 'Empty'));
      const it = p.items[i];
      return el('div', 'g-anvil-slot', el('span', 'label', label),
        el('span', 'thing', ic(S.icon.glyph[it.glyph]), el('span', '', el('span', 'g-item-name', it.name, tier(itemTier(it))), el('span', 'g-sub', it.effects.map((e) => effectText(e)).join(', ')))));
    };
    s.append(slot('First', ai), slot('Second', bi));
    const strikeBtn = stamp('Strike', '');
    strikeBtn.dataset.fk = 'strike';
    strikeBtn.addEventListener('click', strike);
    const row = el('div', 'g-anvil-quote');
    if (ai >= 0 && bi >= 0) {
      const q = fuseCost(run, ai, bi);
      const known = madeThisRun.get(pairKey(p.items[ai].id, p.items[bi].id));
      const free = q.raws.timber + q.raws.ore + q.raws.hide === 0;
      row.append(
        el('div', '',
          el('div', '', term('Budget', 'budget'), ` ${q.budget} points, up to tier ${q.tier}.`),
          el('div', 'g-anvil-cost', setTip(el('span', 'label term', 'Costs up to'), 'The price is set by the tier that comes off, which is known only once it is struck. This is the most it can be.'), free ? el('span', '', 'no raws') : priceOf(0, q.raws, false),
            q.scrip > 0 ? el('span', 'note', `Short of raws: ${q.scrip} scrip`) : null),
          known ? el('div', 'note', `You made this pair earlier: ${low(known.name)}.`) : setTip(el('div', 'g-untried label term', 'Not struck by you this run'), `You have not made this pair in this run. If nobody in the world has ever struck it, it is an untried pair: ${GLOSS.untried}`)),
      );
      if (q.block) { strikeBtn.setAttribute('aria-disabled', 'true'); setTip(strikeBtn, q.block); row.append(el('div', 'g-block', q.block)); }
      else setTip(strikeBtn, 'Fuse the two. Both are used up and one new item comes off.');
    } else {
      strikeBtn.setAttribute('aria-disabled', 'true');
      setTip(strikeBtn, 'Pick two different items first.');
      row.append(el('div', 'note', 'The cost shows once both are on.'));
    }
    row.append(strikeBtn);
    s.append(row);
    return s;
  }

  function muleSection(): HTMLElement {
    const s = el('section', 'section g-mule');
    s.append(el('h2', '', el('span', 'thing', ic(S.icon.mule), term('Send the mule', 'mule'))));
    s.append(el('p', 'note', `What you load is safe at home and gone from this run. Die and you keep the loads plus ${Math.round(DEATH_RAW_KEEP * 100)}% of the raws you hold. Win and you keep it all.`));
    const t = el('table', 'ledger');
    t.append(el('tr', '', el('th', '', 'Raw'), el('th', 'num', 'Held'), el('th', 'num', 'Load'), el('th', '', '')));
    for (const r of RAWS) {
      if (load[r] > p.raws[r]) load[r] = p.raws[r];
      const set = (v: number) => (ev: Event) => act(() => { load[r] = Math.max(0, Math.min(p.raws[r], v)); say(''); }, ev);
      const minus = stamp('Less', 'stamp--plain stamp--small'); minus.dataset.fk = `m-${r}`; minus.addEventListener('click', set(load[r] - 1));
      const plus = stamp('More', 'stamp--plain stamp--small'); plus.dataset.fk = `p-${r}`; plus.addEventListener('click', set(load[r] + 1));
      const all = stamp('All', 'stamp--plain stamp--small'); all.dataset.fk = `a-${r}`; all.addEventListener('click', set(p.raws[r]));
      minus.setAttribute('aria-label', `Load less ${r}`); plus.setAttribute('aria-label', `Load more ${r}`); all.setAttribute('aria-label', `Load all ${r}`);
      t.append(el('tr', '',
        el('td', '', el('div', 'thing', ic(S.icon.raw[r]), el('span', '', cap(r)))),
        el('td', 'num', String(p.raws[r])),
        el('td', 'num g-load', String(load[r])),
        el('td', 'act', el('span', 'g-steps', minus, plus, all))));
    }
    s.append(t);
    const send = stamp('Send the mule', '');
    send.dataset.fk = 'mule';
    if (load.timber + load.ore + load.hide <= 0) send.setAttribute('aria-disabled', 'true');
    send.addEventListener('click', (ev) => act(doMule, ev));
    const onMule = rawsText(run.mule);
    s.append(el('div', 'g-mule-foot', el('span', 'note', onMule ? `Home so far: ${onMule}.` : 'Nothing sent home yet.'), send));
    return s;
  }

  /** What a stat is worth at a value, in the game's own terms. Used on upgrade rows, where the value is not yet the player's. */
  function statMeans(id: StatId, v: number): string {
    switch (id) {
      case 'maxHp': return `${Math.round(p.maxHp - p.stat[ST.maxHp] + v)} health`;
      case 'mend': return `${(v > 0 ? 0.2 + 0.09 * (v - 1) : 0).toFixed(2)} HP per second`;
      case 'armor': return `Damage taken x${(1 / (1 + Math.max(0, v) / 15)).toFixed(2)}`;
      default: return statTitle(id, v);
    }
  }

  function statTitle(id: StatId, v: number): string {
    switch (id) {
      case 'maxHp': return `${Math.round(p.maxHp)} health`;
      case 'mend': return `${p.mendPerSec.toFixed(2)} HP per second`;
      case 'armor': return `Damage taken x${p.takenMul.toFixed(2)}`;
      case 'dodge': return `${Math.round(v)}% of hits miss, cap 60%`;
      case 'speed': return `Move speed x${(1 + v / 100).toFixed(2)}`;
      case 'damage': return `All damage x${(1 + v / 100).toFixed(2)}`;
      case 'melee': return `${Math.round(v)} flat melee damage, scaled per weapon`;
      case 'ranged': return `${Math.round(v)} flat ranged damage, scaled per weapon`;
      case 'rate': return `Attack speed x${(1 + v / 100).toFixed(2)}`;
      case 'crit': return `${Math.round(v)}% of hits deal x2`;
      case 'reach': return `${Math.round(v)} px more range, half for melee`;
      case 'harvest': return `Work rate x${Math.max(0.25, 1 + v / 20).toFixed(2)}, ${Math.floor(Math.max(0, v) / 10)} more raws per node`;
      case 'luck': return `Rare offers x${(1 + v / 100).toFixed(2)}`;
    }
  }

  function sideColumn(): HTMLElement {
    const side = el('aside', 'g-side');
    const ch = CHARACTER[run.character];

    // Stats.
    // A stat at nothing is not a row: thirteen zeros teach nobody. A row comes
    // up when the stat is raised, or while an offer that would raise it is under the pointer.
    const stats = el('dl', 'stats');
    statDelta = [];
    statRow = [];
    statZero = [];
    let shownRows = 0;
    for (const id of STATS) {
      const v = p.stat[ST[id]];
      const d = el('span', 'g-delta');
      d.hidden = true;
      statDelta.push(d);
      const row = el('div', '', el('dt', '', ic(S.icon.stat[id]), STAT_LABEL[id]), el('dd', 'num', d, fmtStat(id, v)));
      setTip(row, `${STAT_LABEL[id]}: ${STAT_MEANING[id]} Now: ${statTitle(id, v)}.`);
      const zero = Math.round(v * 10) === 0;
      row.hidden = zero;
      if (!zero) shownRows++;
      statRow.push(row); statZero.push(zero);
      stats.append(row);
    }
    statNone = el('p', 'note', 'No stats raised yet. Upgrades and items show here.');
    statNone.hidden = shownRows > 0;
    side.append(el('section', 'section g-first', el('h2', '', `${ch.name}, level ${p.level}`), ch.id !== 'greenhorn' ? el('p', 'note', ch.twist) : null, statNone, stats));

    // Weapons.
    const wt = el('table', 'ledger');
    p.weapons.forEach((w, i) => {
      const def = WEAPONS[w.def];
      const key_ = `w${i}`;
      const v = scrapValueWeapon(run, i);
      const sc = stamp(scrapArm === key_ ? 'Sure?' : 'Scrap', `stamp--plain stamp--small${scrapArm === key_ ? ' is-pressed' : ''}`, cost(S.icon.scrip, v));
      sc.dataset.fk = `scrapw${i}`;
      sc.setAttribute('aria-label', `Scrap ${def.name} for ${v} scrip`);
      setTip(sc, p.weapons.length <= 1 ? 'Your last weapon cannot be scrapped.' : scrapArm === key_ ? `Press again to scrap ${def.name} for ${v} scrip.` : `Scrap ${def.name} for ${v} scrip. Asks once more first.`);
      if (p.weapons.length <= 1) sc.setAttribute('aria-disabled', 'true');
      sc.addEventListener('click', (ev) => act(() => doScrapWeapon(i), ev));
      // Raise a tier for scrip and raws; combine two twins to free a slot.
      let up: HTMLElement | null = null, comb: HTMLElement | null = null;
      if (w.tier < 4) {
        const c = tierUpCost(run, i);
        up = stamp('Tier up', 'stamp--plain stamp--small', cost(S.icon.scrip, c));
        up.dataset.fk = `upw${i}`;
        up.setAttribute('aria-label', `Raise ${def.name} to tier ${w.tier + 1} for ${c} scrip`);
        if (tierUpBlock(run, i)) up.setAttribute('aria-disabled', 'true');
        up.addEventListener('click', (ev) => act(() => doTierUp(i), ev));
      }
      if (twinOf(run, i) >= 0) {
        comb = stamp('Combine', 'stamp--plain stamp--small');
        comb.dataset.fk = `combw${i}`;
        comb.setAttribute('aria-label', `Combine two tier ${w.tier} ${def.name} into one tier ${w.tier + 1}`);
        comb.addEventListener('click', (ev) => act(() => doCombine(i), ev));
      }
      wt.append(el('tr', i === combined ? 'g-combined' : '',
        el('td', '', el('div', 'thing', ic(S.icon.weapon[w.id as keyof typeof S.icon.weapon]),
          el('span', '', def.name, i === combined ? el('span', 'g-tag', 'Combined') : null,
            el('span', 'g-sub', def.classes.map((c) => CLASS_LABEL[c]).join(', '))))),
        el('td', '', tier(w.tier)),
        el('td', 'act', up, comb, sc)));
    });
    const sets: Kid[] = [];
    for (let c = 0; c < CLASSES.length; c++) {
      const n = p.classCount[c];
      if (n < 1) continue;
      const cls = CLASSES[c] as WeaponClass;
      if (n < 2) { sets.push(el('li', '', `${CLASS_LABEL[cls]} ${n}: no bonus until 2`)); continue; }
      const step = n >= 6 ? 2 : n >= 4 ? 1 : 0;
      const parts = SET_BONUS[cls].filter((sb) => sb.v[step] !== 0).map((sb) => `+${fmtStat(sb.stat, sb.v[step])} ${STAT_LABEL[sb.stat]}`);
      if (cls === 'blunt') parts.push(`+${BLUNT_KNOCK[step]} knockback`);
      if (cls === 'shot' && SHOT_PIERCE[step] > 0) parts.push(`shots pierce ${SHOT_PIERCE[step]} more`);
      if (n < 6) parts.push(`next at ${n < 4 ? 4 : 6}`);
      sets.push(el('li', 'g-set-on', `${CLASS_LABEL[cls]} ${n}: ${parts.join(', ')}`));
    }
    side.append(el('section', 'section', el('h2', '', `Weapons, ${p.weapons.length} of ${weaponSlots(run)}`), wt, el('ul', 'g-sets', ...sets)));

    // Items, grouped.
    const it = el('section', 'section', el('h2', '', `Items, ${p.items.length}`));
    if (p.items.length === 0) it.append(el('p', 'note', 'None yet. Items take no slot.'));
    else {
      const tbl = el('table', 'ledger g-items');
      const seen = new Map<string, number[]>();
      p.items.forEach((item, i) => { const g = seen.get(item.id); if (g) g.push(i); else seen.set(item.id, [i]); });
      for (const [id, idxs] of seen) {
        const item = p.items[idxs[0]];
        const kit = idxs.every((i) => p.itemKit[i]);
        const last = idxs[idxs.length - 1];
        const v = scrapValueItem(run, last);
        const armed = scrapArm === `i${id}`;
        const sc = stamp(armed ? 'Sure?' : 'Scrap', `stamp--plain stamp--small${armed ? ' is-pressed' : ''}`, cost(S.icon.scrip, v));
        sc.dataset.fk = `scrapi${id}`;
        sc.setAttribute('aria-label', `Scrap ${item.name} for ${v} scrip`);
        setTip(sc, armed ? `Press again to scrap ${item.name} for ${v} scrip.` : `Scrap ${item.name} for ${v} scrip. Asks once more first.`);
        sc.addEventListener('click', (ev) => act(() => doScrapItem(last), ev));
        tbl.append(el('tr', '',
          el('td', '', el('div', 'thing', ic(S.icon.glyph[item.glyph]),
            el('span', '',
              el('span', 'g-item-name', item.name, idxs.length > 1 ? el('span', 'num', ` x${idxs.length}`) : null, tier(itemTier(item)), kit ? setTip(el('span', 'g-tag g-tag--plain', 'Kit'), `Packed from your stash. ${GLOSS.kit}`) : null),
              el('span', 'g-sub', item.effects.map((e) => effectText(e)).join(', '))))),
          el('td', 'act', item.relic ? el('span', 'note', 'Relic') : sc)));
      }
      it.append(tbl);
    }
    side.append(it);
    return side;
  }

  function render(): void {
    if (!alive) return;
    S = deps.sprites();
    const scroll = root.scrollTop;
    window.clearInterval(waitTimer);
    sound?.dispose();
    sound = soundControls(true);
    const pauseBtn = stamp('Pause', 'stamp--plain stamp--small');
    pauseBtn.addEventListener('click', () => deps.pause());
    sound.el.prepend(pauseBtn);

    const head = el('header', 'page-head',
      el('div', '', el('div', 'label', `After wave ${b.index} of ${run.totalWaves}`), el('h1', '', 'Bench')),
      el('div', 'meta', b.interestPaid > 0 ? el('span', 'note', `Interest paid: ${b.interestPaid} scrip.`) : null, sound.el));

    const main = el('div', 'g-main');
    main.append(b.picks > 0 ? upgradesSection() : offersSection());
    main.append(anvilSection());
    if (b.mule) main.append(muleSection());

    const rr = rerollCost(run);
    const rerollBtn = stamp('Reroll', 'stamp--plain', rr > 0 ? cost(S.icon.scrip, rr, p.scrip < rr, 'scrip') : el('span', 'num', 'free'), key('R'));
    rerollBtn.dataset.fk = 'reroll';
    if (p.scrip < rr || b.picks > 0) rerollBtn.setAttribute('aria-disabled', 'true');
    setTip(rerollBtn, b.picks > 0 ? 'Take your upgrade first.' : p.scrip < rr ? `Costs ${rr} scrip. You hold ${p.scrip}.` : `${GLOSS.reroll} Each reroll at this bench costs more. Key: R.`);
    rerollBtn.addEventListener('click', (ev) => act(doReroll, ev));
    const nextBtn = stamp(`Wave ${run.wave + 1}`, '', key('Enter'));
    nextBtn.dataset.fk = 'next';
    nextBtn.setAttribute('aria-label', 'Next wave');
    if (b.picks > 0) nextBtn.setAttribute('aria-disabled', 'true');
    setTip(nextBtn, b.picks > 0 ? 'Take your upgrade first.' : `Leave the bench and start wave ${run.wave + 1}. Key: Enter.`);
    nextBtn.addEventListener('click', (ev) => act(doNext, ev));
    const waiting = !reason && b.picks > 0;
    const lineText = waiting ? `Take your upgrade first${b.picks > 1 ? `: ${b.picks} owed` : ''}. The offers and the next wave wait for it.` : reason;
    const line = el('div', `notice g-reason${reasonBad ? ' g-reason--bad' : ''}`, el('span', 'tag', reasonBad ? 'No' : waiting ? 'First' : 'Done'), el('span', 'text', lineText));
    line.setAttribute('role', 'status');
    if (!lineText) line.classList.add('is-empty');
    const foot = el('div', 'g-foot',
      line,
      el('div', 'g-foot-row',
        el('div', 'g-held', el('span', 'label', 'You hold'), el('span', 'price',
          setTip(cost(S.icon.scrip, p.scrip, false, 'scrip'), `Scrip: ${p.scrip}. ${GLOSS.scrip}`), ...RAWS.map((r: RawId) => setTip(cost(S.icon.raw[r], p.raws[r], false, r), `${cap(r)}: ${p.raws[r]}. ${GLOSS.raws}`)))),
        el('div', 'g-foot-acts', rerollBtn, nextBtn)));

    const page = el('div', 'page g-page', head, el('div', 'g-cols', main, sideColumn()));
    root.replaceChildren(page, foot);
    root.classList.toggle('is-waiting', pending);
    root.scrollTop = scroll;
    hovered = '';
  }

  // ---- keys ------------------------------------------------------------------

  const onKeyDown = (e: KeyboardEvent): void => {
    if (root.hidden || !self.active || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    const tag = t?.tagName ?? '';
    if (tag === 'INPUT') return;
    if (e.code === 'KeyL') { lockHeld = true; return; }
    if (pending) return;
    if (reveal) {
      if (e.code === 'Enter' && tag !== 'BUTTON') { e.preventDefault(); act(() => { reveal = null; }); }
      return;
    }
    const digit = e.code.startsWith('Digit') ? Number(e.code.slice(5)) : e.code.startsWith('Numpad') ? Number(e.code.slice(6)) : NaN;
    if (digit >= 1 && digit <= 4) {
      e.preventDefault();
      const i = digit - 1;
      if (lockHeld) act(() => (b.picks > 0 ? refuse('Take your upgrade first.') : doLock(i)));
      else if (b.picks > 0) act(() => doPick(i));
      else act(() => doBuy(i));
      return;
    }
    if (e.code === 'KeyR') { e.preventDefault(); act(doReroll); return; }
    if (e.code === 'Enter' && tag !== 'BUTTON') { e.preventDefault(); act(doNext); }
  };
  const onKeyUp = (e: KeyboardEvent): void => { if (e.code === 'KeyL') lockHeld = false; };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const self: BenchScreen = {
    el: root,
    active: true,
    open() {
      reason = ''; reasonBad = false; anvil = [null, null]; reveal = null; combined = -1; scrapArm = ''; lockHeld = false;
      load = { timber: 0, ore: 0, hide: 0 }; muleNote = '';
      if (b.interestPaid > 0) say(`Interest paid: ${b.interestPaid} scrip.`);
      root.hidden = false;
      root.scrollTop = 0;
      render();
      root.scrollTop = 0;
    },
    close() {
      root.hidden = true;
      window.clearInterval(waitTimer);
      root.replaceChildren();
      sound?.dispose(); sound = null;
    },
    destroy() {
      alive = false;
      stopLoop?.(); stopLoop = null;
      window.clearInterval(waitTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      sound?.dispose();
      root.remove();
    },
  };
  return self;
}
