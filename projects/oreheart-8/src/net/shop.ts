// The Shop (contract 4.2): the four packs with their painted foil, price, "opened today", the odds in plain words, Buy.
// The server does all paying and rolling (open_pack); the browser only shows what it says.
import { h } from '../ui/app';
import { econShow, backBtn, coinChip, coinIcon, api, setShop, buyPack, currentCoins, currentFreePacks, type PackInfo, type ShopInfo } from './economy';
import { sealedPack } from './packopen';
import { oddsWords } from './quest-summary';
export { oddsWords };

type El = HTMLElement;


export async function showShop(): Promise<void> {
  const alert = h('p', { class: 'econ-alert', role: 'alert' });
  const grid = h('div', { class: 'shop-grid', role: 'list', 'aria-label': 'Packs' }, h('p', { class: 'net-note' }, 'Unpacking the packs…'));
  econShow('shop',
    h('div', { class: 'econ-head' }, backBtn(),
      h('div', { class: 'econ-titles' }, h('h1', {}, 'The Pack Shop'), h('p', { class: 'econ-sub' }, 'Shiny, crinkly, and only slightly haunted. Every pack holds 8 cards.')),
      h('div', { class: 'econ-wallet' }, coinChip())),
    alert, grid);
  let info: ShopInfo;
  try { info = await api.shopInfo(); } catch (e: any) { grid.replaceChildren(); alert.textContent = 'The shop is closed right now: ' + String(e?.message || e); return; }
  setShop(info);
  render(grid, info, alert);
}

function render(grid: El, info: ShopInfo, alert: El) {
  const packs = (info.packs || []).filter(Boolean);
  if (!packs.length) { grid.replaceChildren(h('p', { class: 'net-note' }, 'No packs on the shelf today. The goblins ate the stock.')); return; }
  grid.replaceChildren(...packs.map((p) => tile(p, alert)));
}

function tile(p: PackInfo, alert: El): El {
  const coins = currentCoins() ?? 0;
  const free = currentFreePacks() > 0;
  const soldOut = p.max_per_day > 0 && p.opened_today >= p.max_per_day;
  const afford = free || coins >= p.price_coins;
  const label = soldOut ? 'Sold out today' : free ? 'Open FREE' : afford ? `Open for ${p.price_coins}` : `Need ${p.price_coins} coins`;
  const buy = h('button', { type: 'button', class: 'net-btn primary shop-buy', 'data-pack': p.id, 'aria-label': `${label}: ${p.name}`, disabled: !afford || soldOut }, label) as HTMLButtonElement;
  const go = async () => {
    if (buy.disabled) return;
    alert.textContent = '';
    for (const b of document.querySelectorAll<HTMLButtonElement>('.shop-buy')) b.disabled = true;
    await buyPack(p, (m) => { alert.textContent = m; for (const b of document.querySelectorAll<HTMLButtonElement>('.shop-buy')) b.disabled = false; });
  };
  buy.addEventListener('click', () => { void go(); });
  const art = h('div', { class: 'shop-art', role: 'img', 'aria-label': p.name }, sealedPack(p));
  art.addEventListener('click', () => { void go(); });
  return h('div', { class: 'shop-pack econ-panel', role: 'listitem', 'data-pack': p.id },
    free ? h('span', { class: 'shop-free', 'aria-label': 'Free pack available' }, 'FREE') : null,
    art,
    h('h2', {}, p.name),
    h('p', { class: 'shop-blurb' }, p.blurb || ''),
    h('div', { class: 'shop-price', 'aria-label': `${p.price_coins} coins` }, coinIcon(''), String(p.price_coins)),
    h('p', { class: 'shop-today' }, `${p.opened_today || 0} opened today`),
    h('p', { class: 'shop-odds' }, oddsWords(p.slots)),
    buy,
    !afford && !soldOut ? h('p', { class: 'shop-hint' }, 'Finish quests to earn coins') : null);
}
