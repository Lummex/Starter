// The Shop (contract 4.2, Nov 5 Ken): one kind of pack at a time, sold as bundles of 1, 6, 24 and 99 (the big ones with
// free packs on top), My Packs with everything still sealed (open one, or several with a slider), the odds and the
// guarantees in plain words, the bad-luck shield. The server does all paying, rolling and promising (buy_packs,
// open_stash, open_pack); the browser only shows what it says. No fake timers, no fake scarcity, odds always visible.
import { h } from '../ui/app';
import { econShow, backBtn, coinChip, coinIcon, api, setShop, buyPack, buyBundle, openStash, currentCoins, currentFreePacks, lastShop, STREAK_DAYS, type PackInfo, type ShopInfo, type BundleInfo } from './economy';
import { sealedPack } from './packopen';
import { shardChip } from './oreshards';
import { oddsWords } from './quest-summary';
import { TIER_NAMES, RARITY_LABEL } from '../content/card-labels';
export { oddsWords };

type El = HTMLElement;

const state = { kind: '' };

export async function showShop(): Promise<void> {
  const alert = h('p', { class: 'econ-alert', role: 'alert' });
  const stash = h('div', { class: 'shop-stash', role: 'region', 'aria-label': 'My Packs', 'data-testid': 'my-packs' });
  const kinds = h('div', { class: 'net-races shop-kinds', role: 'group', 'aria-label': 'Kind of pack' });
  const grid = h('div', { class: 'shop-bundles', role: 'list', 'aria-label': 'Bundles' }, h('p', { class: 'net-note' }, 'Unpacking the packs\u2026'));
  const odds = h('div', { class: 'shop-oddsbox' });
  // Nov 6 (design D): the strip under the offers, the streak, the best pulls and the daily limit in the side column
  const strip = h('div', { class: 'shop-strip econ-panel', 'data-testid': 'shop-strip' });
  const streak = h('div', { class: 'shop-streak', 'data-testid': 'shop-streak' });
  const pulls = h('div', { class: 'shop-pulls' }, h('h3', { class: 'h' }, 'Best pulls this week'), h('p', { class: 'shop-soon' }, 'coming soon'));
  const limit = h('div', { class: 'shop-limit', 'data-testid': 'shop-limit' });
  econShow('shop',
    h('div', { class: 'econ-head' }, backBtn(),
      h('div', { class: 'econ-titles' }, h('h1', {}, 'The Pack Shop'), h('p', { class: 'econ-sub' }, 'Shiny, crinkly, and only slightly haunted. Every pack holds 11 cards.')),
      h('div', { class: 'econ-wallet' }, shardChip(), coinChip())),
    alert,
    h('div', { class: 'shop-main' },
      h('div', { class: 'shop-left' }, kinds, grid, strip),
      h('div', { class: 'shop-side' }, stash, odds, streak, pulls, limit)));
  let info: ShopInfo;
  try { info = await api.shopInfo(); } catch (e: any) { grid.replaceChildren(); alert.textContent = 'The shop is closed right now: ' + String(e?.message || e); return; }
  setShop(info);
  render({ alert, stash, kinds, grid, odds, strip, streak, limit }, info);
}

interface Parts { alert: El; stash: El; kinds: El; grid: El; odds: El; strip?: El; streak?: El; limit?: El }

/** the words for a bundle's promises (the server keeps them; the shop only reads them out) */
export function promiseWords(p: Record<string, any> | null | undefined): string[] {
  const out: string[] = [];
  if (!p) return out;
  const t = Number(p.upgraded_min_tier) || 0;
  if (t >= 2) out.push(`one upgraded card at ${TIER_NAMES[t]}${t < 5 ? ' or better' : ''}`);
  if (p.legendary_unowned) out.push("one Legendary you don't own yet");
  if (p.card_back) out.push(`the ${String(p.card_back)} card back (only from this chest)`);
  return out;
}

function render(parts: Parts, info: ShopInfo) {
  const packs = (info.packs || []).filter(Boolean);
  if (!packs.length) { parts.grid.replaceChildren(h('p', { class: 'net-note' }, 'No packs on the shelf today. The goblins ate the stock.')); return; }
  if (!packs.some((p) => p.id === state.kind)) state.kind = packs[0].id;
  const pack = packs.find((p) => p.id === state.kind)!;
  // My Packs: everything still sealed, by kind, plus the free quest packs
  const st = info.stash || { packs: {}, free: info.free_packs || 0 };
  const rows: El[] = [];
  for (const p of packs) {
    const n = Number(st.packs?.[p.id]) || 0;
    if (n > 0) rows.push(stashRow(p, n, parts));
  }
  if ((st.free || 0) > 0) rows.push(stashRow(pack, st.free || 0, parts, true));
  parts.stash.replaceChildren(h('h2', {}, 'My Packs'), ...(rows.length ? rows : [h('p', { class: 'net-note shop-stash-empty' }, 'Nothing sealed yet. Packs you buy wait here until you open them.')]));
  parts.stash.dataset.count = String(rows.reduce((s, r) => s + (Number(r.dataset.n) || 0), 0));
  parts.stash.querySelector('h2')?.append(h('span', { class: 'more', 'data-testid': 'stash-count' }, `${parts.stash.dataset.count} unopened`));
  // the kind of pack (Ken, Nov 6: Oreheart packs only; the pills only show when an admin turns a second kind on)
  parts.kinds.hidden = packs.length < 2; parts.kinds.style.display = packs.length < 2 ? 'none' : '';
  parts.kinds.replaceChildren(...packs.map((p) => h('button', { type: 'button', class: 'net-race', 'data-v': p.id, 'aria-pressed': String(p.id === state.kind), onclick: () => { state.kind = p.id; render(parts, lastShop() || info); } }, p.name)));
  // the bundles of that kind: 1, 6, 24 (the big one in the middle), 99 (the chest)
  const bundles = (info.bundles && info.bundles.length ? info.bundles : [{ size: 1, bonus: 0, promises: {} }]).slice().sort((a, b) => a.size - b.size);
  parts.grid.replaceChildren(...bundles.map((b) => tile(pack, b, info, parts)));
  // the odds, and the bad-luck shield, in plain words
  const pity = info.pity;
  parts.odds.replaceChildren(
    h('p', { class: 'shop-odds' }, oddsWords(pack.slots)),
    pity ? h('p', { class: 'shop-shield', 'data-testid': 'shop-shield' }, `Bad-luck shield: ${pity.limit} packs in a row without a Legendary, and the ${ordinal(pity.limit)} brings one. You are at ${pity.since}.`) : null,
    h('p', { class: 'shop-fair' }, 'Odds are the same for every pack, bundle or not. Guarantees come on top: natural drops count, and only when luck falls short does the last pack of a bundle top it up.'));
  // Nov 6 (design D): what's in a pack (one chip per slot), the quest streak to the next free pack, the daily limit
  if (parts.strip) parts.strip.replaceChildren(h('div', { class: 'shop-strip-h' }, h('b', { class: 'h' }, "What's in a pack"), h('small', {}, 'Any card can arrive upgraded, up to Mythic')), ...slotChips(pack.slots));
  if (parts.limit) { const max = pack.max_per_day || 0, n = pack.opened_today || 0; parts.limit.replaceChildren(h('div', { class: 'shop-limit-l' }, h('span', {}, 'Opened today'), h('span', {}, max > 0 ? `${n} of ${max}` : String(n))), h('div', { class: 'bar' }, h('i', { style: `width:${max > 0 ? Math.min(100, Math.round((n / max) * 100)) : 0}%` }))); }
  if (parts.streak) { const el = parts.streak; void api.myQuests().then((q) => { if (!el.isConnected) return; const days = Math.max(0, q.streak_days || 0), into = days % STREAK_DAYS, left = STREAK_DAYS - into; el.replaceChildren(h('span', {}, `Next free pack in ${left} day${left === 1 ? '' : 's'}`), h('div', { class: 'dots', 'aria-hidden': 'true' }, ...Array.from({ length: STREAK_DAYS }, (_, i) => h('i', { class: i < into ? 'on' : '' }))), h('img', { src: '/art/packs/icons/free-pack.webp', alt: '' })); }).catch(() => { el.replaceChildren(); }); }
}

/** the strip's chips: the count, the rarity (or the Miner pool) and the odds when a slot can roll up */
function slotChips(slots: PackInfo['slots']): El[] {
  const ss = [...(slots || [])].sort((a, b) => a.slot_no - b.slot_no);
  const label = (r: string) => RARITY_LABEL[r] || r;
  const pct = (bp: number) => { const v = Math.round(bp) / 100; return (Number.isInteger(v) ? String(v) : v.toFixed(1)) + '%'; };
  return ss.map((sl) => {
    if (sl.pool === 'miners') return h('div', { class: 'slot', 'data-r': 'miners' }, h('span', { class: 'n' }, String(sl.count)), h('div', {}, h('b', {}, 'Miners'), h('span', {}, 'cheap low-end Miners')));
    const rs = Object.keys(sl.odds || {}).filter((r) => (sl.odds[r] || 0) > 0).sort((x, y) => (sl.odds[y] || 0) - (sl.odds[x] || 0));
    if (rs.length <= 1) return h('div', { class: 'slot', 'data-r': rs[0] || '' }, h('span', { class: 'n' }, String(sl.count)), h('div', {}, h('b', {}, rs[0] ? label(rs[0]) : 'Card'), h('span', {}, rs[0] === 'Rare' ? 'always' : 'any army')));
    return h('div', { class: 'slot', 'data-r': rs[0] }, h('span', { class: 'n' }, String(sl.count)), h('div', {}, h('b', {}, `${label(rs[0])} or better`), h('span', {}, rs.slice(1).map((r) => `${pct(sl.odds[r])} ${label(r)}`).join(' \u00b7 '))));
  });
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][Math.min(n % 10, 4) < 4 ? n % 10 : 0] || 'th'}`;

/** one line of My Packs: the sealed count, Open one, Open several (a slider) */
function stashRow(p: PackInfo, n: number, parts: Parts, free = false): El {
  const slider = h('input', { type: 'range', min: '1', max: String(Math.max(1, n)), value: String(Math.min(n, 5)), class: 'shop-slider', 'aria-label': `how many ${p.name}s to open` }) as HTMLInputElement;
  const count = h('span', { class: 'shop-slider-n' }, slider.value);
  slider.addEventListener('input', () => { count.textContent = slider.value; several.textContent = `Open ${slider.value}`; });
  const several = h('button', { type: 'button', class: 'net-btn shop-open-n', onclick: () => { void go(Number(slider.value) || 1); } }, `Open ${slider.value}`) as HTMLButtonElement;
  const one = h('button', { type: 'button', class: 'net-btn primary shop-open-one', onclick: () => { void go(1); } }, 'Open one') as HTMLButtonElement;
  const pickBox = h('div', { class: 'shop-several', hidden: n < 2 }, h('span', {}, 'or open'), slider, count, several);
  const go = async (k: number) => {
    parts.alert.textContent = '';
    one.disabled = several.disabled = true;
    await openStash(p, k, (m) => { parts.alert.textContent = m; one.disabled = several.disabled = false; });
  };
  const row = h('div', { class: 'shop-stash-row', 'data-pack': p.id, 'data-n': String(n), 'data-free': free ? 'true' : null },
    h('div', { class: 'shop-stash-art' }, sealedPack(p, 'small'), h('span', { class: 'shop-stash-count' }, `×${n}`)),
    h('div', { class: 'shop-stash-text' }, h('strong', {}, free ? `Free pack${n === 1 ? '' : 's'} (quests)` : p.name), h('span', {}, `${n} sealed`)),
    h('div', { class: 'shop-stash-actions' }, one, pickBox));
  return row;
}

/** Brush's treasure chest (art/packs/chest, approved Nov 5): the closed chest with its seam light pulsing */
export function chestArt(cls = ''): El {
  return h('div', { class: `chest-art ${cls}`.trim(), 'data-testid': 'chest-art' },
    h('img', { class: 'chest-closed', src: '/art/packs/chest/chest-closed.webp', alt: '', draggable: 'false' }),
    h('img', { class: 'chest-glow', src: '/art/packs/chest/chest-glow.webp', alt: '', draggable: 'false', 'aria-hidden': 'true' }));
}

function tile(p: PackInfo, b: BundleInfo, info: ShopInfo, parts: Parts): El {
  const coins = currentCoins() ?? 0;
  const free = currentFreePacks() > 0;
  const total = b.size + (b.bonus || 0);
  const price = p.price_coins * b.size;
  const perPack = total > 0 ? price / total : p.price_coins;
  const soldOut = b.size === 1 && p.max_per_day > 0 && p.opened_today >= p.max_per_day;
  const afford = (b.size === 1 && free) || coins >= price;
  const chest = b.size >= 99;
  const badges = info.badges || {};
  const label = b.size === 1 ? (soldOut ? 'Sold out today' : free ? 'Open FREE' : afford ? `Open now for ${price}` : `Need ${price} coins`)
    : afford ? `Buy ${total} packs for ${price.toLocaleString('en-US')}` : `Need ${price.toLocaleString('en-US')} coins`;
  const buy = h('button', { type: 'button', class: 'net-btn primary shop-buy', 'data-pack': p.id, 'data-size': String(b.size), 'aria-label': `${label}: ${p.name}`, disabled: !afford || soldOut }, label) as HTMLButtonElement;
  const go = async () => {
    if (buy.disabled) return;
    parts.alert.textContent = '';
    for (const x of document.querySelectorAll<HTMLButtonElement>('.shop-buy')) x.disabled = true;
    const onErr = (m: string) => { parts.alert.textContent = m; for (const x of document.querySelectorAll<HTMLButtonElement>('.shop-buy')) x.disabled = false; };
    if (b.size === 1) await buyPack(p, onErr); else await buyBundle(p, b.size, onErr);
  };
  buy.addEventListener('click', () => { void go(); });
  const art = h('div', { class: 'shop-art' + (chest ? ' shop-chest' : ''), role: 'img', 'aria-label': chest ? `${p.name} treasure chest` : p.name },
    chest ? chestArt() : sealedPack(p),
    total > 1 ? h('span', { class: 'shop-count', 'aria-hidden': 'true' }, `×${total}`) : null);
  art.addEventListener('click', () => { void go(); });
  const promises = promiseWords(b.promises);
  return h('div', { class: `shop-pack shop-bundle econ-panel${b.size === 24 ? ' shop-big' : ''}${chest ? ' shop-bundle-chest' : ''}`, role: 'listitem', 'data-pack': p.id, 'data-size': String(b.size), 'data-packs': String(total) },
    Number(badges.best_value) === b.size ? h('span', { class: 'shop-badge shop-best', 'data-testid': 'best-value' }, 'BEST VALUE') : null,
    Number(badges.most_popular) === b.size ? h('span', { class: 'shop-badge shop-popular' }, 'MOST POPULAR') : null,
    b.size === 1 && free ? h('span', { class: 'shop-free', 'aria-label': 'Free pack available' }, 'FREE') : null,
    b.bonus > 0 ? h('span', { class: 'shop-bonus', 'data-testid': 'bundle-bonus' }, `+${b.bonus} FREE`) : null,
    art,
    h('h2', {}, b.size === 1 ? 'Single Pack' : chest ? 'Treasure Chest' : b.size >= 24 ? 'Warband Bundle' : 'Pack Bundle'),
    h('p', { class: 'shop-blurb shop-qty' }, ...(b.size === 1 ? ['1 pack \u00b7 11 cards'] : b.bonus > 0 ? [`${b.size} packs `, h('b', { class: 'plus' }, `+${b.bonus} FREE`), ` = ${total} packs`] : [`${b.size} packs \u00b7 ${b.size * 11} cards`])),
    h('div', { class: 'shop-price', 'aria-label': `${price} coins` }, coinIcon(''), price.toLocaleString('en-US')),
    h('p', { class: 'shop-perpack', 'data-testid': 'per-pack' }, b.bonus > 0 ? `~${Math.round(perPack)} per pack` : `${Math.round(perPack)} per pack`),
    promises.length ? h('p', { class: 'shop-promise', 'data-testid': 'bundle-promise' }, 'Guaranteed: ' + promises.join(', ') + '.') : h('p', { class: 'shop-promise shop-promise-none' }, b.size === 1 ? `${p.opened_today || 0} opened today` : 'No guarantee: just the odds.'),
    buy,
    !afford && !soldOut ? h('p', { class: 'shop-hint' }, 'Finish quests to earn coins') : null);
}
