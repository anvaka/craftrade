// The market tab: the Factor's table for raws, the listings as a price
// ledger, and selling from the stash (post or salvage).

import { effectText, itemPoints, itemTier, type ItemSpec } from '../../shared/item.ts';
import { KIT_CHARGES, LISTING_FEE, SALE_TAX, type Listing, type MarketActionRes, type StashItem } from '../../shared/protocol.ts';
import { RAWS, type RawId } from '../../shared/vocab.ts';
import { audio } from '../audio/index.ts';
import { api } from './api.ts';
import { el, empty, finder, fmt, icon, itemIcon, pips, plural, sprites, stamp, stepper, tier, type Kid } from './dom.ts';
import { loadTab } from './shell.ts';
import { act, app, redraw, say, setProfile } from './state.ts';
import { RAW_NAME } from './words.ts';

// Mirrors of server rules, used only to state numbers before a press.
const LISTING_MIN_RUNS = 3;
const FACTOR_MAX_QTY = 100;
const feeFor = (price: number): number => Math.max(1, Math.ceil(price * LISTING_FEE));
const taxFor = (price: number): number => Math.min(price, Math.max(1, Math.ceil(price * SALE_TAX)));
const salvageFor = (it: StashItem): number => Math.max(1, Math.round((itemPoints(it.item.effects) * it.charges) / (KIT_CHARGES * 5)));

const qty: Record<RawId, number> = { timber: 10, ore: 10, hide: 10 };
/** Until a quantity is set by hand it follows what the player holds, so the sell stamp starts live. */
const qtySet: Record<RawId, boolean> = { timber: false, ore: false, hide: false };
let posting: { uid: string; price: string } | null = null;
let armed: string | null = null;

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
  if (armed && !app.profile.items.some((i) => i.uid === armed)) armed = null;
  root.append(factor(), listings(), sell());
}

// ---- the Factor ------------------------------------------------------------

function factor(): HTMLElement {
  const S = sprites();
  const m = app.market!;
  const p = app.profile;
  const sec = el('section', 'section section--first', el('h2', '', 'The Factor'));
  sec.append(el('p', 'note', 'Buys and sells raws for marks at his own prices, which follow trade. He takes and gives only so much in a day.'));
  const table = el('div', 'factor');
  table.setAttribute('role', 'table');
  const head = el('div', 'factor-row factor-head', el('span', '', 'Raw'), el('span', 'num', 'You hold'), el('span', 'num', 'Factor pays'), el('span', 'num', 'Factor asks'), el('span', 'f-act', 'Quantity'));
  head.setAttribute('role', 'row');
  table.append(head);
  for (const raw of RAWS) {
    const q = m.factor[raw];
    if (!qtySet[raw]) qty[raw] = Math.max(1, Math.min(10, p.raws[raw]));
    const n = Math.max(1, Math.min(FACTOR_MAX_QTY, qty[raw]));
    const row = el(
      'div',
      'factor-row',
      el('span', 'f-raw', icon(S.icon.raw[raw]), el('span', '', RAW_NAME[raw])),
      el('span', 'num f-fig', el('span', 'f-cap label', 'You hold'), fmt(p.raws[raw])),
      el('span', 'num f-fig', el('span', 'f-cap label', 'Pays'), fmt(q.sell), el('span', 'f-left note', `takes ${fmt(q.sellLeft)} more today`)),
      el('span', 'num f-fig', el('span', 'f-cap label', 'Asks'), fmt(q.buy), el('span', 'f-left note', `has ${fmt(q.buyLeft)} left today`)),
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
  sellB.title = noSell;
  buyB.title = noBuy;
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
        disabled: !open || short,
        title: !open ? 'Trading is closed' : short ? `You have ${plural(p.marks, 'mark')}` : undefined,
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
    l.mine ? 'is-mine' : '',
    el(
      'td',
      '',
      el('div', 'thing', itemIcon(l.item), el('span', 'l-item', el('span', 'l-name', l.item.name), el('span', 'fx', fxLine(l.item)), el('span', 'l-seller', 'sold by ', l.mine ? el('span', 'own', 'You') : el('span', 'who', l.seller)))),
    ),
    el('td', '', tier(itemTier(l.item))),
    el('td', 'wide', finder(l.item.by, p.name)),
    el('td', 'wide', seller),
    el('td', 'wide', pips(l.charges, KIT_CHARGES, 'charges')),
    el('td', 'num', fmt(l.price)),
    el('td', 'act', action),
  );
}

function listings(): HTMLElement {
  const m = app.market!;
  const sec = el('section', 'section', el('h2', '', 'Listings'));
  if (!m.listings.length) {
    sec.append(empty('No listings are up. Items that players post are listed here with their price. Yours go up from the table below.'));
    return sec;
  }
  const t = el('table', 'ledger listings');
  t.append(el('tr', '', el('th', '', 'Item'), el('th', '', 'Tier'), el('th', 'wide', 'First made by'), el('th', 'wide', 'Seller'), el('th', 'wide', 'Charges'), el('th', 'num', 'Marks'), el('th', '', '')));
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
    const ok = Number.isInteger(price) && price >= 1 && price <= 100_000;
    if (!ok) {
      terms.textContent = 'Set a price from 1 to 100,000 marks.';
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
    const digits = input.value.replace(/\D+/g, '').slice(0, 6);
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
      locked
        ? `Listings open after ${LISTING_MIN_RUNS} runs. The Factor trades with anyone. `
        : 'Post an item at your price for other players, or salvage it for a few marks. Posting takes the item out of your stash until it sells or you withdraw it. ',
    ),
  );
  if (!p.items.length) {
    sec.append(empty('Nothing to sell. Items you carry home or make at the anvil are listed here.'));
    return sec;
  }
  const t = el('table', 'ledger selling');
  t.append(el('tr', '', el('th', '', 'Item'), el('th', '', 'Tier'), el('th', 'wide', 'Charges'), el('th', 'num', 'Salvage'), el('th', '', '')));
  for (const it of p.items) {
    const worth = salvageFor(it);
    const isPosting = posting?.uid === it.uid;
    const isArmed = armed === it.uid;
    t.append(
      el(
        'tr',
        isPosting ? 'is-on' : '',
        el('td', '', el('div', 'thing', itemIcon(it.item), el('span', 'l-item', el('span', 'l-name', it.item.name), el('span', 'fx', fxLine(it.item))))),
        el('td', '', tier(itemTier(it.item))),
        el('td', 'wide', pips(it.charges, KIT_CHARGES, 'charges')),
        el('td', 'num', fmt(worth)),
        el(
          'td',
          'act',
          isPosting
            ? null
            : stamp('Post', {
                cls: 'stamp--small stamp--town',
                key: `post:${it.uid}`,
                disabled: locked || !open,
                title: locked ? `${p.runs} of ${LISTING_MIN_RUNS} runs` : !open ? 'Trading is closed' : undefined,
                onClick: () => {
                  posting = { uid: it.uid, price: String(Math.max(5, worth * 5)) };
                  armed = null;
                  redraw();
                  const field = document.querySelector('[data-fk="post:price"]') as HTMLInputElement | null;
                  field?.focus();
                  field?.select();
                },
              }),
          ' ',
          stamp(isArmed ? `Destroy for ${fmt(worth)}` : 'Salvage', {
            cls: isArmed ? 'stamp--small is-armed' : 'stamp--small stamp--plain',
            key: `salvage:${it.uid}`,
            onClick: () => {
              if (!isArmed) {
                armed = it.uid;
                posting = null;
                redraw();
                return;
              }
              void act(`salvage:${it.uid}`, 'Market', async () => {
                took(await api.salvage(it.uid));
                armed = null;
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
