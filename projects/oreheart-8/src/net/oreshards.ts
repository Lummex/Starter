// Buy Oreshards (Ken, Nov 6: "let's get started" on Stripe; studio/specs/currency-store-plan.md): the premium currency.
// Four painted bundles; a tap asks the stripe-checkout function for a Stripe-hosted Checkout page and sends the player there, so
// card details never touch the game. Oreshards arrive ONLY when Stripe's webhook confirms the payment: this screen only shows
// what the server says (my_oreshards), and after the return from Stripe it re-reads the balance for a while. One-way conversion
// to Coins (1 for 1). Under-13 accounts without an approved parent see a message instead of the bundles. TEST + sandbox only.
import { h } from '../ui/app';
import { econShow, backBtn, coinChip, isTestPage, stubMode, setCoins } from './economy';
import { rpc, client } from './online';
import { net } from './state';

type El = HTMLElement;
export interface Bundle { id: string; name: string; usd_cents: number; oreshards: number; bonus_pct: number }
export interface OreshardInfo {
  pack_rate?: number;
  oreshards: number; coins: number; enabled: boolean; can_buy: boolean; blocked: string; bundles: Bundle[];
  purchases: { id: string; bundle: string; oreshards: number; amount_cents: number; currency: string; status: string; at: string; receipt: string | null }[];
  history: { delta: number; reason: string; at: string; balance_after: number }[];
}

const fmt = (n: number) => n.toLocaleString('en-US');
export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const params = () => new URLSearchParams(location.search);

// ---- stand-in data for test pages (?test=1&econ=oreshards; &kid=1 = an under-13 account without an approved parent)
const STUB_BUNDLES: Bundle[] = [
  { id: 'pouch', name: 'Pinch of Oreshards', usd_cents: 99, oreshards: 100, bonus_pct: 0 }, // Nov 7 (Ken): "$1 to $100"
  { id: 'sack', name: 'Sack of Oreshards', usd_cents: 499, oreshards: 550, bonus_pct: 10 },
  { id: 'chest', name: 'Chest of Oreshards', usd_cents: 999, oreshards: 1200, bonus_pct: 20 },
  { id: 'hoard', name: 'Hoard of Oreshards', usd_cents: 1999, oreshards: 2600, bonus_pct: 30 },
  { id: 'vault', name: 'Vault of Oreshards', usd_cents: 4999, oreshards: 7000, bonus_pct: 40 },
  { id: 'mountain', name: 'Mountain of Oreshards', usd_cents: 9999, oreshards: 15000, bonus_pct: 50 },
];
const STUB = { oreshards: 0, coins: 500, purchases: [] as OreshardInfo['purchases'], history: [] as OreshardInfo['history'], lastCheckout: null as null | { bundle: string; origin: string } };
const stubInfo = (): OreshardInfo => {
  const kid = params().get('kid') === '1';
  return { oreshards: STUB.oreshards, coins: STUB.coins, enabled: true, can_buy: !kid, blocked: kid ? 'A parent must approve this account before it can buy anything.' : '',
    bundles: STUB_BUNDLES.map((b) => ({ ...b })), pack_rate: 1, purchases: STUB.purchases.slice(), history: STUB.history.slice() };
};

export const api = {
  async info(): Promise<OreshardInfo> {
    if (stubMode()) return stubInfo();
    return await rpc<OreshardInfo>('my_oreshards');
  },
  /** asks the server for the Stripe page; the browser goes there */
  async checkout(bundle: string): Promise<{ ok: boolean; url?: string; error?: string }> {
    if (stubMode()) { STUB.lastCheckout = { bundle, origin: location.origin }; return { ok: true, url: 'stub://stripe/' + bundle }; }
    const { data, error } = await client().functions.invoke('stripe-checkout', { body: { bundle, origin: location.origin } });
    if (error) {
      try { const ctx: any = (error as any).context; if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); if (j) return j; } } catch { /* fall through */ }
      return { ok: false, error: error.message || 'The server did not answer.' };
    }
    return typeof data === 'string' ? JSON.parse(data) : data;
  },
  async convert(n: number): Promise<{ oreshards: number; coins: number; converted: number }> {
    if (stubMode()) {
      if (n > STUB.oreshards) throw new Error('not enough Oreshards');
      STUB.oreshards -= n; STUB.coins += n; STUB.history.unshift({ delta: -n, reason: 'convert', at: new Date().toISOString(), balance_after: STUB.oreshards });
      return { oreshards: STUB.oreshards, coins: STUB.coins, converted: n };
    }
    return await rpc('oreshards_to_coins', { p_n: n, p_idem_key: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10) });
  },
};

/** test pages: pay for packs with the stand-in Oreshards (economy.ts buyPacks with pay = 'oreshards') */
export function stubSpendShards(n: number): number { if (n > STUB.oreshards) throw new Error(`Not enough Oreshards (this costs ${n}, you have ${STUB.oreshards}).`); STUB.oreshards -= n; STUB.history.unshift({ delta: -n, reason: 'pack', at: new Date().toISOString(), balance_after: STUB.oreshards }); return STUB.oreshards; }
export const shardsNow = () => STUB.oreshards;
export const shardIcon = (cls = 'econ-shard-img') => h('img', { class: cls, src: '/art/packs/chest/chest-card-back.webp', alt: '', draggable: 'false' });

/** The Oreshard counter for the Shop header, with the "+" that opens this screen. */
export function shardChip(): El {
  const n = h('span', { class: 'econ-coins-n' }, '…');
  const c = h('div', { class: 'econ-coins econ-shards', role: 'status', 'data-testid': 'shard-chip', 'aria-label': 'Oreshards' }, shardIcon(), n,
    h('button', { type: 'button', class: 'econ-shards-plus', 'aria-label': 'Buy Oreshards', title: 'Buy Oreshards', 'data-testid': 'buy-oreshards', onclick: () => void showOreshards() }, '+'));
  void api.info().then((i) => { n.textContent = fmt(i.oreshards); c.setAttribute('aria-label', `${i.oreshards} Oreshards`); }).catch(() => { n.textContent = '0'; });
  return c;
}

export async function showOreshards(focus: '' | 'convert' = ''): Promise<void> {
  const alert = h('p', { class: 'econ-alert', role: 'alert', 'data-testid': 'oreshards-alert' });
  const grid = h('div', { class: 'shard-bundles', role: 'list', 'aria-label': 'Oreshard bundles', 'data-testid': 'shard-bundles' }, h('p', { class: 'net-note' }, 'Counting the shards…'));
  const balance = h('div', { class: 'shard-balance econ-panel', 'data-testid': 'shard-balance' });
  const convert = h('div', { class: 'shard-convert econ-panel', 'data-testid': 'shard-convert' });
  const hist = h('div', { class: 'shard-history econ-panel', 'data-testid': 'shard-history' });
  econShow('oreshards',
    h('div', { class: 'econ-head' }, backBtn(),
      h('div', { class: 'econ-titles' }, h('h1', {}, 'Buy Oreshards'), h('p', { class: 'econ-sub' }, 'Packs and cosmetics. Payment on Stripe’s secure page.')),
      h('div', { class: 'econ-wallet' }, coinChip())),
    alert,
    h('div', { class: 'shard-main' },
      h('div', { class: 'shard-left' }, grid, h('p', { class: 'shard-fine', 'data-testid': 'shard-fine' }, 'Oreshards are not refundable and have no cash value. 1 Oreshard turns into 1 Coin, never back.')),
      h('div', { class: 'shard-side' }, balance, convert, hist)));
  let info: OreshardInfo;
  try { info = await api.info(); } catch (e: any) { grid.replaceChildren(); alert.textContent = 'The shop is closed right now: ' + String(e?.message || e); return; }
  render({ alert, grid, balance, convert, history: hist }, info);
  if (focus === 'convert') { convert.scrollIntoView({ block: 'center' }); (convert.querySelector('input') as HTMLInputElement | null)?.focus(); convert.classList.add('flash'); } // Nov 7: the Shop's Oreshards -> Coins button
  // back from Stripe: the Oreshards come through the webhook, usually within seconds; read the balance again for a while
  const back = params().get('oreshards');
  if (back === 'paid' || back === 'cancel') {
    try { window.history.replaceState(null, '', location.pathname + location.search.replace(/([?&])(oreshards|session_id)=[^&]*&?/g, '$1').replace(/[?&]$/, '')); } catch { /* keep the address */ }
    if (back === 'cancel') alert.textContent = 'No payment was made.';
    else {
      alert.textContent = 'Thank you! Your Oreshards arrive as soon as Stripe confirms the payment…';
      const before = info.oreshards;
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        if (!document.querySelector('[data-screen="econ-oreshards"]')) return;
        try { const now = await api.info(); if (now.oreshards !== before) { render({ alert, grid, balance, convert, history: hist }, now); alert.textContent = `Your Oreshards are here: ${fmt(now.oreshards)}.`; return; } } catch { /* try again */ }
      }
      alert.textContent = 'Stripe has not confirmed the payment yet. Your Oreshards will show up here once it does.';
    }
  }
}

interface Parts { alert: El; grid: El; balance: El; convert: El; history: El }

function render(p: Parts, info: OreshardInfo) {
  bestId = (info.bundles || []).slice().sort((a, c) => c.oreshards / c.usd_cents - a.oreshards / a.usd_cents || c.usd_cents - a.usd_cents)[0]?.id || '';
  p.balance.replaceChildren(h('h3', { class: 'h' }, 'Your Oreshards'), h('p', { class: 'shard-big', 'data-testid': 'shard-count' }, shardIcon('econ-shard-img big'), h('b', {}, fmt(info.oreshards))),
    ...(info.oreshards < 0 ? [h('p', { class: 'shard-owe', 'data-testid': 'shard-owe' }, 'A refund took Oreshards back: nothing can be spent until the balance is back to zero.')] : []));
  setCoins(info.coins);
  p.grid.replaceChildren();
  if (!info.enabled) { p.grid.append(h('p', { class: 'net-note', 'data-testid': 'shard-closed' }, 'Oreshards are not on sale right now.')); }
  else if (!info.can_buy) { p.grid.append(h('p', { class: 'shard-blocked', 'data-testid': 'shard-blocked', role: 'status' }, info.blocked || 'This account cannot buy Oreshards.')); }
  else for (const b of info.bundles) p.grid.append(bundleCard(b, p));
  renderConvert(p, info);
  renderHistory(p, info);
}

let bestId = '';
function bundleCard(b: Bundle, p: Parts): El {
  const busy = h('span', { class: 'shard-busy', hidden: true }, 'Opening Stripe…');
  const btn = h('button', { type: 'button', class: 'net-btn primary shard-buy', 'data-testid': 'shard-buy-' + b.id, 'aria-label': `Buy ${b.name} for ${usd(b.usd_cents)}` }, usd(b.usd_cents)) as HTMLButtonElement;
  const best = b.id === bestId; // Nov 7 (Ken): the biggest gets "Best value" and the chest treatment
  const card = h('div', { class: 'shard-bundle shard-' + b.id + (best ? ' shard-best' : ''), role: 'listitem', 'data-bundle': b.id },
    best ? h('span', { class: 'ohb ohb-ribbon shard-best-badge', 'data-testid': 'shard-best' }, h('span', {}, 'BEST VALUE')) : null,
    h('div', { class: 'shard-art' }, h('img', { class: 'chest-closed', src: '/art/packs/chest/chest-closed.webp', alt: '', draggable: 'false' }), h('img', { class: 'chest-glow', src: '/art/packs/chest/chest-glow.webp', alt: '', draggable: 'false' })),
    h('h3', { class: 'h shard-name' }, b.name),
    h('p', { class: 'shard-amount' }, shardIcon(), h('b', {}, fmt(b.oreshards)), ' Oreshards'),
    b.bonus_pct > 0 ? h('p', { class: 'shard-bonus', 'data-testid': 'shard-bonus' }, `+${b.bonus_pct}% bonus`) : h('p', { class: 'shard-bonus none' }, ' '),
    btn, busy);
  btn.addEventListener('click', async () => {
    btn.disabled = true; busy.hidden = false; p.alert.textContent = '';
    try {
      const r = await api.checkout(b.id);
      if (!r.ok || !r.url) { p.alert.textContent = r.error || 'Stripe could not start the payment.'; btn.disabled = false; busy.hidden = true; return; }
      if (r.url.startsWith('stub://')) { p.alert.textContent = `Stand-in: Stripe would open for ${b.name}.`; btn.disabled = false; busy.hidden = true; return; }
      location.assign(r.url); // Stripe's own page; it brings the player back to ?oreshards=paid or ?oreshards=cancel
    } catch (e: any) { p.alert.textContent = String(e?.message || e); btn.disabled = false; busy.hidden = true; }
  });
  return card;
}

function renderConvert(p: Parts, info: OreshardInfo) {
  const n = h('input', { type: 'number', class: 'net-input shard-n', min: '1', step: '1', value: String(Math.min(100, Math.max(1, info.oreshards))), 'aria-label': 'Oreshards to convert', 'data-testid': 'shard-convert-n' }) as HTMLInputElement;
  const go = h('button', { type: 'button', class: 'net-btn shard-convert-btn', 'data-testid': 'shard-convert-btn' }, 'Turn into Coins') as HTMLButtonElement;
  const note = h('p', { class: 'shard-note' }, 'This can’t be undone. Coins can’t turn back into Oreshards.');
  go.disabled = info.oreshards < 1;
  go.addEventListener('click', async () => {
    const k = Math.floor(Number(n.value) || 0);
    if (k < 1) { p.alert.textContent = 'How many Oreshards?'; return; }
    if (k > info.oreshards) { p.alert.textContent = `You have ${fmt(info.oreshards)} Oreshards.`; return; }
    if (!confirmBox(`Turn ${fmt(k)} Oreshards into ${fmt(k)} Coins? This can’t be undone.`)) return;
    go.disabled = true;
    try { const r = await api.convert(k); p.alert.textContent = `${fmt(r.converted)} Oreshards became ${fmt(r.converted)} Coins.`; render(p, await api.info()); }
    catch (e: any) { p.alert.textContent = String(e?.message || e); go.disabled = false; }
  });
  p.convert.replaceChildren(h('h3', { class: 'h' }, 'Turn Oreshards into Coins'), h('p', { class: 'shard-note' }, '1 Oreshard = 1 Coin. Coins buy packs in the Pack Shop.'),
    h('div', { class: 'shard-convert-row' }, n, go), note);
}

function renderHistory(p: Parts, info: OreshardInfo) {
  const rows = info.purchases.map((x) => h('li', { class: 'shard-row ' + x.status, 'data-testid': 'shard-purchase' },
    h('span', { class: 'shard-when' }, new Date(x.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    h('span', { class: 'shard-what' }, x.bundle, ' ', h('small', {}, `${fmt(x.oreshards)} Oreshards`)),
    h('span', { class: 'shard-cost' }, usd(x.amount_cents)),
    h('span', { class: 'shard-state' }, x.status === 'paid' ? 'paid' : x.status === 'refunded' ? 'refunded' : x.status === 'disputed' ? 'disputed' : x.status === 'failed' ? 'failed' : 'pending')));
  p.history.replaceChildren(h('h3', { class: 'h' }, 'Purchases'), rows.length ? h('ul', { class: 'shard-rows' }, ...rows) : h('p', { class: 'net-note' }, 'No purchases yet.'),
    h('p', { class: 'shard-note' }, 'Something wrong with a purchase? Write to us from the Contact page with the date and the amount.'));
}

/** a plain confirm; the game's own dialog would do too, but this screen must never block a test page */
function confirmBox(text: string): boolean { if (isTestPage() && (window as any).__autoConfirm !== false) return true; return window.confirm(text); }

/** test hooks: the stand-in state and the last checkout the page asked for */
export function oreshardHooks() {
  return {
    state: () => ({ oreshards: STUB.oreshards, coins: STUB.coins, lastCheckout: STUB.lastCheckout }),
    give: (n: number) => { if (!stubMode()) return false; STUB.oreshards += Math.max(0, Math.floor(n)); STUB.history.unshift({ delta: n, reason: 'purchase', at: new Date().toISOString(), balance_after: STUB.oreshards }); STUB.purchases.unshift({ id: 'stub', bundle: 'Pouch of Oreshards', oreshards: n, amount_cents: 199, currency: 'usd', status: 'paid', at: new Date().toISOString(), receipt: null }); return true; },
    open: () => void showOreshards(),
    signedIn: () => net.active,
  };
}
