// The market tab: the Factor's table for raws, the listings as a price
// ledger, and selling from the stash (post or salvage).

import { itemName } from '../ui/describe.ts';
import { isSolo } from './api.ts';
import { GLOSS } from '../ui/glossary.ts';
import { setTip, term } from '../ui/tip.ts';
import { effectText, isRelic, itemPoints, itemTier, type ItemSpec } from '../../shared/item.ts';
import { KIT_CHARGES, LISTING_FEE, SALE_TAX, type Listing, type MarketActionRes, type Order, type RawLot, type StashItem } from '../../shared/protocol.ts';
import { LISTING_MIN_RUNS, MAX_LOT, priceCeiling } from '../../shared/rules.ts';
import { RAWS, type RawId } from '../../shared/vocab.ts';
import { audio } from '../audio/index.ts';
import { api } from './api.ts';
import { el, empty, finder, fmt, fold, icon, isDocked, itemIcon, pips, plural, serial, sprites, stamp, stepper, tier, type Kid } from './dom.ts';
import { loadTab } from './shell.ts';
import { act, app, redraw, say, setProfile } from './state.ts';
import { RAW_NAME } from './words.ts';

// Mirrors of server rules, used only to state numbers before a press.
const PRICE_CAP = 100_000;
/** The most an item may be posted for: by its points and the charges it has left. A relic has no cap. */
const capFor = (it: StashItem): number => Math.min(PRICE_CAP, priceCeiling(it.item, it.charges));
/** A relic has no price cap; this is only the longest figure the price field takes. */
const RELIC_PRICE_DIGITS = 12;
const FACTOR_MAX_QTY = 100;
const feeFor = (price: number): number => Math.max(1, Math.ceil(price * LISTING_FEE));
const taxFor = (price: number): number => Math.min(price, Math.max(1, Math.ceil(price * SALE_TAX)));
const salvageFor = (it: StashItem): number => Math.max(1, Math.round((itemPoints(it.item.effects) * it.charges) / (KIT_CHARGES * 5)));

const qty: Record<RawId, number> = { timber: 10, ore: 10, hide: 10 };
/** Until a quantity is set by hand it follows what the player holds, so the sell stamp starts live. */
const qtySet: Record<RawId, boolean> = { timber: false, ore: false, hide: false };
let posting: { uid: string; price: string } | null = null;
let armed: string | null = null;
/** When the salvage stamp was armed. A second press sooner than ARM_GUARD_MS is a double tap, not a decision. */
let armedAt = 0;
let disarmTimer: number | undefined;
const ARM_GUARD_MS = 450;
const ARM_FOR_MS = 4000;
/** The raw the Factor's card shows on a phone. */
let factorRaw: RawId = 'timber';
/** The raw trade form: a lot to sell or an order to buy, for one raw, at a price for each unit. */
const lotForm: { side: 'sell' | 'want'; raw: RawId; qty: number; each: number } = { side: 'sell', raw: 'timber', qty: 20, each: 5 };

function arm(uid: string): void {
  armed = uid;
  armedAt = performance.now();
  window.clearTimeout(disarmTimer);
  // Left alone, the question lapses: the stamp goes back to "Salvage".
  disarmTimer = window.setTimeout(() => {
    if (armed !== uid) return;
    armed = null;
    redraw();
  }, ARM_FOR_MS);
}
function disarm(): void {
  armed = null;
  window.clearTimeout(disarmTimer);
}

function took(res: MarketActionRes): void {
  setProfile(res.profile);
  app.market = res.market;
}

const fxLine = (item: ItemSpec): string => item.effects.map(effectText).filter(Boolean).join(', ');

export function renderMarket(root: HTMLElement): void {
  const m = app.market;
  if (!m) {
    root.append(el('section', 'section section--first', el('h2', '', 'Market'), empty(app.online ? 'Fetching prices.' : 'The market is in town, which is out of reach. Prices and listings will be here when it answers.')));
    return;
  }
  if (!m.open) {
    root.append(el('div', 'notice notice--town', el('span', 'tag', 'Market'), el('span', 'text', 'Trading is closed for now. Stashes are safe. You can still withdraw a listing or salvage an item.')));
  }
  if (posting && !app.profile.items.some((i) => i.uid === posting!.uid)) posting = null;
  if (armed && !app.profile.items.some((i) => i.uid === armed)) disarm();
  // Solo has nobody to trade with: the Factor and salvage are the whole market.
  if (isSolo()) root.append(factor(), sell());
  else root.append(factor(), rawTrade(), listings(), sell());
}

// ---- the Factor ------------------------------------------------------------

function factor(): HTMLElement {
  const S = sprites();
  const m = app.market!;
  const p = app.profile;
  const sec = el('section', 'section section--first', el('h2', '', term('The Factor', 'factor')));
  sec.append(el('p', 'note', 'Buys and sells raws for marks at his own prices, which follow trade. He takes and gives only so much in a day.'));
  // A phone trades one raw at a time: three stamps choose which, and one card shows it.
  const phone = isDocked();
  if (phone) {
    const seg = el('div', 'seg');
    seg.setAttribute('role', 'radiogroup');
    seg.setAttribute('aria-label', 'Raw');
    for (const raw of RAWS) {
      const on = raw === factorRaw;
      const b = stamp([icon(S.icon.raw[raw]), RAW_NAME[raw]], {
        cls: `stamp--small stamp--plain${on ? ' is-pressed' : ''}`,
        key: `seg:${raw}`,
        sound: 'lock',
        onClick: () => {
          factorRaw = raw;
          redraw();
        },
      });
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(on));
      seg.append(b);
    }
    sec.append(seg);
  }
  const table = el('div', `factor${phone ? ' factor--one' : ''}`);
  table.setAttribute('role', 'table');
  const head = el('div', 'factor-row factor-head', el('span', '', 'Raw'), el('span', 'num', 'You hold'), el('span', 'num', term('Factor pays', 'factorPays')), el('span', 'num', term('Factor asks', 'factorAsks')), el('span', 'f-act', 'Quantity'));
  head.setAttribute('role', 'row');
  table.append(head);
  for (const raw of RAWS) {
    const q = m.factor[raw];
    if (!qtySet[raw]) qty[raw] = Math.max(1, Math.min(10, p.raws[raw]));
    const n = Math.max(1, Math.min(FACTOR_MAX_QTY, qty[raw]));
    const row = el(
      'div',
      `factor-row${phone && raw !== factorRaw ? ' is-off' : ''}`,
      el('span', 'f-raw', icon(S.icon.raw[raw]), el('span', '', RAW_NAME[raw])),
      el('span', 'num f-fig', el('span', 'f-cap label', 'You hold'), fmt(p.raws[raw])),
      el('span', 'num f-fig', el('span', 'f-cap label', 'Pays'), fmt(q.sell), el('span', 'f-left note', phone ? `${fmt(q.sellLeft)} more today` : `takes ${fmt(q.sellLeft)} more today`)),
      el('span', 'num f-fig', el('span', 'f-cap label', 'Asks'), fmt(q.buy), el('span', 'f-left note', phone ? `${fmt(q.buyLeft)} left today` : `has ${fmt(q.buyLeft)} left today`)),
      el(
        'span',
        'f-act',
        stepper({ value: n, min: 1, max: FACTOR_MAX_QTY, key: `q:${raw}`, label: `${RAW_NAME[raw].toLowerCase()} quantity`, onChange: (v) => void ((qty[raw] = v), (qtySet[raw] = true), syncFactorRow(row, raw)) }),
        stamp('', {
          cls: 'stamp--small stamp--plain f-sell',
          key: `sell:${raw}`,
          sound: null,
          onClick: () =>
            void act(`factor:${raw}`, 'Factor', async () => {
              const count = qty[raw];
              const pay = count * app.market!.factor[raw].sell;
              took(await api.factor(raw, 'sell', count));
              audio.play('scrip');
              say('Factor', `Sold ${fmt(count)} ${raw} for ${plural(pay, 'mark')}.`, 'town');
            }),
        }),
        stamp('', {
          cls: 'stamp--small stamp--town f-buy',
          key: `buy:${raw}`,
          sound: null,
          onClick: () =>
            void act(`factor:${raw}`, 'Factor', async () => {
              const count = qty[raw];
              const cost = count * app.market!.factor[raw].buy;
              took(await api.factor(raw, 'buy', count));
              audio.play('buy');
              say('Factor', `Bought ${fmt(count)} ${raw} for ${plural(cost, 'mark')}.`, 'town');
            }),
        }),
      ),
    );
    row.setAttribute('role', 'row');
    syncFactorRow(row, raw);
    table.append(row);
  }
  sec.append(table);
  return sec;
}

/** Labels and reach of the two stamps follow the quantity without a full redraw. */
function syncFactorRow(row: HTMLElement, raw: RawId): void {
  const m = app.market!;
  const p = app.profile;
  const q = m.factor[raw];
  const n = qty[raw];
  const sellB = row.querySelector('.f-sell') as HTMLButtonElement;
  const buyB = row.querySelector('.f-buy') as HTMLButtonElement;
  const busy = app.busy.has(`factor:${raw}`);
  sellB.textContent = `Sell ${fmt(n)} for ${fmt(n * q.sell)}`;
  buyB.textContent = `Buy ${fmt(n)} for ${fmt(n * q.buy)}`;
  const noSell = !m.open ? 'Trading is closed' : n > p.raws[raw] ? `You hold ${fmt(p.raws[raw])}` : n > q.sellLeft ? `He takes ${fmt(q.sellLeft)} more today` : '';
  const noBuy = !m.open ? 'Trading is closed' : n * q.buy > p.marks ? `You have ${plural(p.marks, 'mark')}` : n > q.buyLeft ? `He has ${fmt(q.buyLeft)} left today` : '';
  sellB.disabled = !!noSell || busy;
  buyB.disabled = !!noBuy || busy;
  setTip(sellB, noSell || `Sell ${fmt(n)} ${raw} to the Factor at ${fmt(q.sell)} marks each.`);
  setTip(buyB, noBuy || `Buy ${fmt(n)} ${raw} from the Factor at ${fmt(q.buy)} marks each.`);
}

// ---- raws between players ----------------------------------------------------

/** Lots of raws posted by players, orders for raws posted by players, and one form that posts either. */
function rawTrade(): HTMLElement {
  const S = sprites();
  const m = app.market!;
  const p = app.profile;
  const kids: Kid[] = [];
  const sec = { append: (...k: Kid[]) => void kids.push(...k) };
  const locked = p.runs < LISTING_MIN_RUNS;
  sec.append(
    el(
      'p',
      'note',
      locked
        ? `Trading with other players opens after ${LISTING_MIN_RUNS} runs. You have ${p.runs}. The Factor trades with anyone.`
        : 'A lot is raws you post at a price. An order is raws you want, with the marks for them set aside when it goes up. Both sit between what the Factor pays and what he asks.',
    ),
  );
  const rows: HTMLElement[] = [];
  const lotRow = (l: RawLot): HTMLElement => {
    const short = l.price > p.marks;
    const action = l.mine
      ? stamp('Withdraw', {
          cls: 'stamp--small stamp--plain',
          key: `wd:${l.id}`,
          onClick: () => void act(`l:${l.id}`, 'Market', async () => { took(await api.cancel(l.id)); say('Market', `${fmt(l.qty)} ${l.raw} is back with you. The listing fee is not returned.`, 'town'); }).then((ok) => ok === undefined && void loadTab('market')),
        })
      : stamp('Buy', {
          cls: 'stamp--small stamp--town',
          key: `buy:${l.id}`,
          sound: null,
          disabled: !m.open || short || locked,
          title: !m.open ? 'Trading is closed' : locked ? `${p.runs} of ${LISTING_MIN_RUNS} runs` : short ? `You have ${plural(p.marks, 'mark')}` : undefined,
          onClick: () => void act(`l:${l.id}`, 'Market', async () => { took(await api.buy(l.id)); audio.play('buy'); say('Market', `Bought ${fmt(l.qty)} ${l.raw} for ${plural(l.price, 'mark')}.`, 'town'); }).then((ok) => ok === undefined && void loadTab('market')),
        });
    return el(
      'tr',
      l.mine ? 'is-mine' : '',
      el('td', '', el('div', 'thing', icon(S.icon.raw[l.raw]), el('span', 'l-item', el('span', 'l-name', `Lot: ${fmt(l.qty)} ${l.raw}`), el('span', 'l-seller', 'sold by ', l.mine ? el('span', 'own', 'You') : el('span', 'who', l.seller))))),
      el('td', 'num wide', (l.price / l.qty).toFixed(1)),
      el('td', 'num', fmt(l.price)),
      el('td', 'act', action),
    );
  };
  const orderRow = (o: Order): HTMLElement | null => {
    if (!o.raw) return null;
    const raw = o.raw;
    const left = o.qty - o.filled;
    const can = Math.min(left, p.raws[raw]);
    const action = o.mine
      ? stamp('Withdraw', {
          cls: 'stamp--small stamp--plain',
          key: `wo:${o.id}`,
          onClick: () => void act(`o:${o.id}`, 'Market', async () => { took(await api.cancelOrder(o.id)); say('Market', `Order withdrawn. ${plural(left * o.price, 'mark')} came back.`, 'town'); }).then((ok) => ok === undefined && void loadTab('market')),
        })
      : stamp(can > 0 ? `Sell ${fmt(can)}` : 'Sell', {
          cls: 'stamp--small stamp--plain',
          key: `fill:${o.id}`,
          sound: null,
          disabled: !m.open || can < 1 || locked,
          title: !m.open ? 'Trading is closed' : locked ? `${p.runs} of ${LISTING_MIN_RUNS} runs` : can < 1 ? `You hold ${fmt(p.raws[raw])}` : `${plural(can * o.price - taxFor(can * o.price), 'mark')} after tax`,
          onClick: () => void act(`o:${o.id}`, 'Market', async () => { took(await api.fillRaw(o.id, can)); audio.play('scrip'); say('Market', `Sold ${fmt(can)} ${raw} into the order for ${plural(can * o.price, 'mark')}, less tax.`, 'town'); }).then((ok) => ok === undefined && void loadTab('market')),
        });
    return el(
      'tr',
      o.mine ? 'is-mine' : '',
      el('td', '', el('div', 'thing', icon(S.icon.raw[raw]), el('span', 'l-item', el('span', 'l-name', `Wanted: ${fmt(left)} ${raw}`), el('span', 'l-seller', 'wanted by ', o.mine ? el('span', 'own', 'You') : el('span', 'who', o.buyer))))),
      el('td', 'num wide', fmt(o.price)),
      el('td', 'num', fmt(left * o.price)),
      el('td', 'act', action),
    );
  };
  for (const l of m.lots) rows.push(lotRow(l));
  for (const o of m.orders) {
    const r = orderRow(o);
    if (r) rows.push(r);
  }
  if (rows.length) {
    const t = el('table', 'ledger listings lots');
    t.append(el('tr', '', el('th', '', 'Raws'), el('th', 'num wide', 'Each'), el('th', 'num', 'Marks'), el('th', '', '')), ...rows);
    sec.append(t);
  } else {
    sec.append(empty('No lots and no orders are up. Raws that players post or ask for are listed here.'));
  }
  if (!locked) sec.append(rawForm());
  return fold('rawtrade', '', 'Raws between players', `${fmt(rows.length)} up`, ...kids);
}

function rawForm(): HTMLElement {
  const m = app.market!;
  const p = app.profile;
  const f = lotForm;
  const q = m.factor[f.raw];
  const selling = f.side === 'sell';
  f.each = Math.max(1, Math.min(q.buy, f.each));
  const maxQty = Math.max(1, Math.min(MAX_LOT, selling ? p.raws[f.raw] : Math.floor(p.marks / f.each)));
  f.qty = Math.max(1, Math.min(maxQty, f.qty));
  const total = f.qty * f.each;
  const choice = <T extends string>(name: string, opts: [T, string][], on: T, set: (v: T) => void): HTMLElement => {
    const g = el('span', 'choice');
    g.setAttribute('role', 'radiogroup');
    g.setAttribute('aria-label', name);
    for (const [v, label] of opts) {
      const b = stamp(label, { cls: `stamp--small stamp--plain${v === on ? ' is-pressed' : ''}`, key: `raw:${name}:${v}`, sound: 'lock', onClick: () => { set(v); redraw(); } });
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(v === on));
      g.append(b);
    }
    return g;
  };
  const short = selling ? p.raws[f.raw] < f.qty || p.marks < feeFor(total) : p.marks < total;
  const post = stamp(selling ? `Post ${fmt(f.qty)} ${f.raw} for ${fmt(total)}` : `Order ${fmt(f.qty)} ${f.raw} for ${fmt(total)}`, {
    cls: 'stamp--town',
    key: 'raw:post',
    disabled: !m.open || short || app.busy.has('rawpost'),
    title: !m.open ? 'Trading is closed' : short ? (selling ? `You hold ${fmt(p.raws[f.raw])} ${f.raw}` : `You have ${plural(p.marks, 'mark')}`) : undefined,
    onClick: () =>
      void act('rawpost', 'Market', async () => {
        if (selling) {
          took(await api.listLot(f.raw, f.qty, total));
          say('Market', `${fmt(f.qty)} ${f.raw} is up at ${plural(total, 'mark')}. Fee paid: ${fmt(feeFor(total))}.`, 'town');
        } else {
          took(await api.orderRaw(f.raw, f.qty, f.each));
          say('Market', `Order up for ${fmt(f.qty)} ${f.raw} at ${fmt(f.each)} each. ${plural(total, 'mark')} set aside.`, 'town');
        }
      }),
  });
  return el(
    'div',
    'raw-form',
    el('div', 'raw-form-row', el('span', 'label', 'I want to'), choice('side', [['sell', 'Post a lot'], ['want', 'Place an order']], f.side, (v) => void (f.side = v))),
    el('div', 'raw-form-row', el('span', 'label', 'Raw'), choice('raw', RAWS.map((r) => [r, RAW_NAME[r]] as [RawId, string]), f.raw, (v) => void (f.raw = v))),
    el('div', 'raw-form-row', el('span', 'label', 'Quantity'), stepper({ value: f.qty, min: 1, max: maxQty, key: 'raw:qty', label: 'quantity', onChange: (v) => { if (v !== f.qty) { f.qty = v; redraw(); } } })),
    el('div', 'raw-form-row', el('span', 'label', 'Marks each'), stepper({ value: f.each, min: 1, max: q.buy, key: 'raw:each', label: 'marks each', onChange: (v) => { if (v !== f.each) { f.each = v; redraw(); } } }), el('span', 'note num', `The Factor pays ${fmt(q.sell)} and asks ${fmt(q.buy)}.`)),
    el(
      'div',
      'raw-form-row',
      el('span', 'post-terms num', selling ? `Fee ${fmt(feeFor(total))} now. Tax ${fmt(taxFor(total))} when it sells. You receive ${fmt(total - taxFor(total))}.` : `${plural(total, 'mark')} are set aside now and come back for whatever is not filled.`),
      post,
    ),
  );
}

// ---- listings --------------------------------------------------------------

function listingRow(l: Listing): HTMLElement {
  const p = app.profile;
  const open = app.market!.open;
  const short = l.price > p.marks;
  const action = l.mine
    ? stamp('Withdraw', {
        cls: 'stamp--small stamp--plain',
        key: `wd:${l.id}`,
        onClick: () =>
          void act(`l:${l.id}`, 'Market', async () => {
            took(await api.cancel(l.id));
            say('Market', `${l.item.name} is back in your stash. The listing fee is not returned.`, 'town');
          }).then((ok) => ok === undefined && void loadTab('market')),
      })
    : stamp('Buy', {
        cls: 'stamp--small stamp--town',
        key: `buy:${l.id}`,
        sound: null,
        disabled: !open || short || p.runs < LISTING_MIN_RUNS,
        title: !open ? 'Trading is closed' : p.runs < LISTING_MIN_RUNS ? `${p.runs} of ${LISTING_MIN_RUNS} runs` : short ? `You have ${plural(p.marks, 'mark')}` : undefined,
        onClick: () =>
          void act(`l:${l.id}`, 'Market', async () => {
            took(await api.buy(l.id));
            audio.play('buy');
            say('Market', `Bought ${l.item.name} for ${plural(l.price, 'mark')}. It is in your stash.`, 'town');
          }).then((ok) => ok === undefined && void loadTab('market')),
      });
  const seller: Kid = l.mine ? el('span', 'own', 'You') : el('span', 'who', l.seller);
  return el(
    'tr',
    `${l.mine ? 'is-mine' : ''}${isRelic(l.item) ? ' is-relic' : ''}`.trim(),
    el(
      'td',
      '',
      el('div', 'thing', itemIcon(l.item), el('span', 'l-item', el('span', 'l-name', itemName(l.item), serial(l.item)), el('span', 'fx', fxLine(l.item)), el('span', 'l-seller', 'sold by ', l.mine ? el('span', 'own', 'You') : el('span', 'who', l.seller)))),
    ),
    el('td', '', tier(itemTier(l.item))),
    el('td', 'wide', finder(l.item.by, p.name)),
    el('td', 'wide', seller),
    el('td', 'wide', isRelic(l.item) ? el('span', 'note', 'Does not wear') : pips(l.charges, KIT_CHARGES, 'charges')),
    el('td', 'num', fmt(l.price)),
    el('td', 'act', action),
  );
}

function listings(): HTMLElement {
  const m = app.market!;
  // Nothing up folds to one line on a phone; listings that are up stay open.
  if (!m.listings.length) return fold('listings', '', 'Listings', 'none up', empty('No listings are up. Items that players post are listed here with their price. Yours go up from the table below.'));
  const sec = el('section', 'section', el('h2', '', 'Listings'));
  const t = el('table', 'ledger listings');
  t.append(el('tr', '', el('th', '', 'Item'), el('th', '', term('Tier', 'tier')), el('th', 'wide', term('First made or found by', 'firstMade')), el('th', 'wide', 'Seller'), el('th', 'wide', term('Charges', 'charges')), el('th', 'num', 'Marks'), el('th', '', '')));
  for (const l of m.listings) t.append(listingRow(l));
  sec.append(t);
  return sec;
}

// ---- selling from the stash ------------------------------------------------

function postForm(it: StashItem): HTMLElement {
  const p = app.profile;
  const input = el('input', 'field field--num num');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.value = posting!.price;
  input.dataset.fk = 'post:price';
  input.setAttribute('aria-label', 'Price in marks');
  const terms = el('span', 'post-terms num');
  const confirm = stamp('', {
    cls: 'stamp--town',
    key: 'post:confirm',
    onClick: () => {
      const price = Number(posting?.price);
      if (!Number.isInteger(price) || price < 1) return;
      void act('post', 'Market', async () => {
        took(await api.list(it.uid, price));
        posting = null;
        say('Market', `${it.item.name} is up at ${plural(price, 'mark')}. Fee paid: ${fmt(feeFor(price))}.`, 'town');
      });
    },
  });
  const sync = (): void => {
    const price = Number(posting!.price);
    const relic = isRelic(it.item);
    const ok = Number.isInteger(price) && price >= 1 && (relic || price <= capFor(it));
    if (!ok) {
      terms.textContent = relic ? 'Set a price of 1 mark or more. A relic has no price cap.' : `Set a price from 1 to ${fmt(capFor(it))} marks. The most an item can ask follows its points and its charges.`;
      confirm.textContent = 'Post';
      confirm.disabled = true;
      return;
    }
    const fee = feeFor(price);
    const tax = taxFor(price);
    terms.textContent = `Fee ${Math.round(LISTING_FEE * 100)}%: ${plural(fee, 'mark')}, paid now and not returned. Tax ${Math.round(SALE_TAX * 100)}%: ${plural(tax, 'mark')}, taken when it sells. You receive ${fmt(price - tax)}.`;
    confirm.textContent = `Post at ${fmt(price)}`;
    const short = fee > p.marks;
    confirm.disabled = short || app.busy.has('post');
    confirm.title = short ? `You have ${plural(p.marks, 'mark')}` : '';
  };
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D+/g, '').slice(0, isRelic(it.item) ? RELIC_PRICE_DIGITS : 6);
    if (digits !== input.value) input.value = digits;
    posting!.price = digits;
    sync();
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') confirm.click();
  });
  sync();
  return el(
    'div',
    'post-form',
    el('label', 'field-wrap', el('span', 'label', 'Price in marks'), input),
    terms,
    el(
      'span',
      'stamps',
      confirm,
      stamp('Keep it', {
        cls: 'stamp--plain',
        key: 'post:cancel',
        onClick: () => {
          posting = null;
          redraw();
        },
      }),
    ),
  );
}

function sell(): HTMLElement {
  const p = app.profile;
  const open = app.market!.open;
  const sec = el('section', 'section', el('h2', '', 'Sell from your stash'));
  const locked = p.runs < LISTING_MIN_RUNS;
  sec.append(
    el(
      'p',
      'note',
      isSolo()
        ? 'Salvage an item for a few marks. Posting items for other players is part of the shared town. '
        : locked
          ? `Trading with other players opens after ${LISTING_MIN_RUNS} runs. You have ${p.runs}. The Factor trades with anyone. `
          : 'Post an item at your price for other players, or salvage it for a few marks. Posting takes the item out of your stash until it sells or you withdraw it. ',
    ),
  );
  if (!p.items.length) {
    sec.append(empty('Nothing to sell. Items you carry home or make at the anvil are listed here.'));
    return sec;
  }
  const t = el('table', 'ledger selling');
  t.append(el('tr', '', el('th', '', 'Item'), el('th', '', term('Tier', 'tier')), el('th', 'wide', term('Charges', 'charges')), el('th', 'num', term('Salvage', 'salvage')), el('th', '', '')));
  for (const it of p.items) {
    const relic = isRelic(it.item);
    const worth = salvageFor(it);
    const isPosting = posting?.uid === it.uid;
    const isArmed = armed === it.uid;
    t.append(
      el(
        'tr',
        `${isPosting ? 'is-on' : ''}${relic ? ' is-relic' : ''}`.trim(),
        el('td', '', el('div', 'thing', itemIcon(it.item), el('span', 'l-item', el('span', 'l-name', itemName(it.item), serial(it.item)), el('span', 'fx', fxLine(it.item))))),
        el('td', '', tier(itemTier(it.item))),
        el('td', 'wide', relic ? el('span', 'note', 'Does not wear') : pips(it.charges, KIT_CHARGES, 'charges')),
        el('td', 'num', relic ? '' : fmt(worth)),
        el(
          'td',
          'act',
          isPosting || isSolo()
            ? null
            : stamp('Post', {
                cls: 'stamp--small stamp--town',
                key: `post:${it.uid}`,
                disabled: locked || !open,
                title: locked ? `Posting opens after ${LISTING_MIN_RUNS} runs. You have ${p.runs}.` : !open ? 'Trading is closed' : GLOSS.post,
                onClick: () => {
                  posting = { uid: it.uid, price: relic ? '' : String(Math.min(capFor(it), Math.max(5, worth * 5))) };
                  disarm();
                  redraw();
                  const field = document.querySelector('[data-fk="post:price"]') as HTMLInputElement | null;
                  field?.focus();
                  field?.select();
                },
              }),
          ' ',
          // A relic cannot be salvaged, so there is no stamp to press by accident.
          relic ? el('span', 'note', 'Cannot be salvaged') : stamp(isArmed ? `Destroy for ${fmt(worth)}` : 'Salvage', {
            cls: isArmed ? 'stamp--small is-armed' : 'stamp--small stamp--plain',
            key: `salvage:${it.uid}`,
            title: isArmed ? `Press again to destroy ${it.item.name} for ${plural(worth, 'mark')}. It cannot be undone.` : `${GLOSS.salvage} Asks once more before it goes.`,
            onClick: () => {
              if (!isArmed) {
                arm(it.uid);
                posting = null;
                redraw();
                return;
              }
              // The armed stamp is drawn where the first press landed: a quick second tap is a bounce, not a yes.
              if (performance.now() - armedAt < ARM_GUARD_MS) return;
              disarm();
              void act(`salvage:${it.uid}`, 'Market', async () => {
                took(await api.salvage(it.uid));
                audio.play('scrip');
                say('Market', `${it.item.name} salvaged for ${plural(worth, 'mark')}.`, 'town');
              });
            },
          }),
        ),
      ),
    );
    if (isPosting) {
      const cell = el('td', 'post-cell', postForm(it));
      cell.colSpan = 5;
      t.append(el('tr', 'post-row', cell));
    }
  }
  sec.append(t);
  return sec;
}
