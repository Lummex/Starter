// Coins, packs, collection and daily quests (contract factory-design/design/oreheart-pvp-nov2-contract.md, part 4).
// This file is the hub: the server calls (and their test-page stand-ins), the coin chip and menu buttons, the match-end
// quest report, and the test hooks. The screens live in shop.ts, collection.ts, quests.ts and packopen.ts.
// Owner rule: the browser never changes coins or cards itself. Every change is a server function; the "stub" data
// below exists only on ?test=1 pages without a signed-in player, so the screens can be seen and checked with no database.
import './net.css';
import './economy.css';
import { net } from './state';
import { rpc } from './online';
import { h } from '../ui/app';
import { CARDS } from '../engine';
import { setOwnedCounts, deckLimit, ownedOf, copyLimit } from '../ui/decks';
import { COMMANDER_PACK_IDS, commanderPackCard, cardFor } from '../content/card-labels';
import { summarize, capSummary } from './quest-summary';

type El = HTMLElement;

// ------------------------------------------------------------------ shapes (contract part 1)
export interface PackSlot { slot_no: number; count: number; odds: Record<string, number>; pool?: 'any' | 'miners' }
export interface PackInfo { id: string; name: string; blurb: string; price_coins: number; faction: string | null; art: string | null; max_per_day: number; opened_today: number; slots: PackSlot[] }
export interface ShopInfo { packs: PackInfo[]; coins: number; free_packs: number }
export interface PulledCard { card_id: string; rarity: string; is_new: boolean; tier?: number }
/** Upgraded cards (Nov 5): thresholds = copies for tiers 2..5; cards = per card id its best tier, owned copies and upgraded copies. */
export interface UpgradeInfo { steps: Record<string, number[]>; drop_bp: Record<string, number>; drop_tiers: Record<string, number>; cards: Record<string, { best: number; owned: number; upgraded: number }> }
export interface CardCopy { id: string; tier: number; worth: number; since: string }
export interface UpgradeResult { event_id: string; target: string; card_id: string; spent: number; worth_before: number; worth_after: number; tier_before: number; tier_after: number; next_worth: number | null; repeat: boolean }
export { TIER_NAMES } from '../content/card-labels';
/** Extra copies per step (Enhanced, Overcharged, Legendary, Mythic) by rarity (Ken and Forge, Nov 5); the server's setting upgrade_steps is the truth */
export const DEFAULT_STEPS: Record<string, number[]> = { Common: [5, 15, 30, 50], Uncommon: [4, 12, 24, 40], Rare: [2, 4, 7, 14], 'Ultra Rare': [1, 2, 3, 4], Collector: [1, 1, 1, 1] };
export const stepsFor = (rarity: string, steps: Record<string, number[]> = DEFAULT_STEPS) => steps[rarity] || steps.Common || DEFAULT_STEPS.Common;
/** worth needed for a tier: 1 + the steps so far */
export const worthOfTier = (tier: number, steps: number[]) => (tier <= 1 ? 1 : 1 + steps.slice(0, Math.min(4, tier - 1)).reduce((a, b) => a + b, 0));
export const tierOfWorth = (worth: number, steps: number[]) => { for (let t = 5; t >= 2; t--) if (worth >= worthOfTier(t, steps)) return t; return 1; };
export interface OpenResult { opening_id: string; pack_type: string; price_paid: number; free: boolean; cards: PulledCard[]; coins_after: number; free_packs_after: number; odds: PackSlot[] }
export interface Quest { id: string; quest_id: string; name: string; text: string; tier: 'easy' | 'medium' | 'hard'; reward: number; progress: number; target: number; done: boolean; expires_on: string }
export interface QuestsInfo { quests: Quest[]; reroll_left: number; streak_days: number; free_packs: number; today: string }

const params = () => new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const isTestPage = () => params().get('test') === '1';
/** Stand-in data: only on test pages, and only while nobody is signed in. */
export const stubMode = () => isTestPage() && !net.active;
export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Collector'];
/** what the player reads for a rarity key (Collector is shown as Legendary, Ken Nov 5) */
export { rarityLabel } from '../content/card-labels';
export const STREAK_DAYS = 7;

// ------------------------------------------------------------------ test-page stand-in (never used in real play)
const STD_SLOTS: PackSlot[] = [
  { slot_no: 0, count: 3, odds: { Common: 10000 }, pool: 'miners' }, // Nov 5 (Ken): 3 cheap low-end Miners in every pack
  { slot_no: 1, count: 4, odds: { Common: 10000 } },
  { slot_no: 2, count: 2, odds: { Uncommon: 10000 } },
  { slot_no: 3, count: 1, odds: { Rare: 10000 } }, // the sure Rare
  { slot_no: 4, count: 1, odds: { Rare: 8500, 'Ultra Rare': 1300, Collector: 200 } }, // Rare or better
];
const stubPack = (id: string, name: string, blurb: string, faction: string | null): PackInfo => ({ id, name, blurb, price_coins: 100, faction, art: null, max_per_day: 50, opened_today: 0, slots: STD_SLOTS.map((s) => ({ ...s, odds: { ...s.odds } })) });
const STUB = {
  coins: 500,
  free_packs: 1,
  packs: [
    stubPack('standard', 'Oreheart Pack', 'Every army, every crystal. Shake well before opening.', null),
    stubPack('goblin', 'Junkpile Pack', 'Goblin cards and neutral finds. Smells faintly of victory (and old socks).', 'goblins'),
    stubPack('gnome', 'Gizmo Pack', 'Gnome cards and neutral finds. Some assembly required.', 'gnomes'),
    stubPack('dwarf', 'Deepforge Pack', 'Dwarf cards and neutral finds. Forged, not stirred.', 'dwarves'),
  ] as PackInfo[],
  owned: {} as Record<string, number>,
  copies: {} as Record<string, CardCopy[]>, // test page: each owned card's copies with tiers
  opens: 0,
  rerolled: false,
  quests: null as QuestsInfo | null,
};
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
function stubInit() {
  if (STUB.quests) return;
  // a starter-ish collection: four of most commons, a couple of the rest, some missing
  const ids = Object.keys(CARDS).filter((id) => !(CARDS as any)[id].disabled); // Nov 5: crystals are owned cards like any other
  ids.forEach((id, i) => { const r = (CARDS as any)[id].rarity; const n = r === 'Common' ? 4 : r === 'Uncommon' ? 2 : r === 'Rare' ? (i % 2 ? 1 : 0) : 0; if (n) STUB.owned[id] = n; });
  for (const id of COMMANDER_PACK_IDS) STUB.owned[id] = 1; // everyone starts with the three Commanders (Ken, Nov 5)
  const t = today();
  STUB.quests = { today: t, reroll_left: 1, streak_days: 3, free_packs: STUB.free_packs, quests: [
    { id: 'stub-q1', quest_id: 'thwack', name: 'THWACK!', text: 'Land 10 hits.', tier: 'easy', reward: 25, progress: 10, target: 10, done: true, expires_on: addDays(t, 3) },
    { id: 'stub-q2', quest_id: 'faction-pride', name: 'Gnome Pride', text: 'Play 10 Gnome cards.', tier: 'medium', reward: 50, progress: 4, target: 10, done: false, expires_on: addDays(t, 2) },
    { id: 'stub-q3', quest_id: 'crown-jewels', name: 'Crown Jewels', text: 'Win a battle with Grubnak.', tier: 'hard', reward: 75, progress: 0, target: 1, done: false, expires_on: addDays(t, 3) },
  ] };
}
const pickOf = (pool: any[], n: number) => pool[Math.floor(Math.random() * pool.length) % Math.max(1, n)];
let stubUid = 0;
const STUB_STEPS: Record<string, number[]> = { ...DEFAULT_STEPS, Common: [1, 3, 5, 10] }; // the test page keeps Commons quick to combine (the real numbers come from the server)
const stubSteps = (id: string) => stepsFor((cardFor(id) || {}).rarity || 'Common', STUB_STEPS);
function stubCopy(id: string, tier = 1) { (STUB.copies[id] ||= []).push({ id: 'stub-c' + (++stubUid), tier, worth: worthOfTier(tier, stubSteps(id)), since: new Date().toISOString() }); }
function stubCopies(id: string): CardCopy[] { const n = STUB.owned[id] || 0; const list = (STUB.copies[id] ||= []); while (list.length < n) stubCopy(id); return list; }
function stubRoll(pack: PackInfo, force?: string): PulledCard[] {
  const pool = ([...Object.values(CARDS as any), ...COMMANDER_PACK_IDS.map((id) => commanderPackCard(id))] as any[]).filter((c: any) => c && !c.disabled && (c.type === 'creature' || c.type === 'spell' || c.type === 'crystal' || c.type === 'commander') && (!pack.faction || c.faction === pack.faction || c.faction === 'any')) as any[];
  const miners = pool.filter((c) => (c.role === 'Gatherer' || c.role === 'Smith') && c.cost <= 1); // the cheap low-end Miners (the server's pack_miner_ids)
  const of = (r: string) => { for (let i = RARITIES.indexOf(r); i >= 0; i--) { const p = pool.filter((c) => c.rarity === RARITIES[i]); if (p.length) return p; } return pool; };
  const out: PulledCard[] = [];
  const seen: Record<string, number> = { ...STUB.owned };
  // a test page can force an upgraded drop: force 'tier5' (Mythic) .. 'tier2' puts it on the first card
  const forcedTier = force && /^tier[2-5]$/.test(force) ? Number(force.slice(4)) : 0;
  const add = (r: string) => { const p = of(r); const c = pickOf(p, p.length); out.push({ card_id: c.id, rarity: c.rarity, is_new: !seen[c.id], tier: 1 }); seen[c.id] = (seen[c.id] || 0) + 1; stubCopy(c.id, 1); };
  for (let i = 0; i < 3; i++) { const c = miners.length ? pickOf(miners, miners.length) : pickOf(of('Common'), of('Common').length); out.push({ card_id: c.id, rarity: c.rarity, is_new: !seen[c.id], tier: 1 }); seen[c.id] = (seen[c.id] || 0) + 1; stubCopy(c.id, 1); }
  for (let i = 0; i < 4; i++) add('Common');
  for (let i = 0; i < 2; i++) add('Uncommon');
  add('Rare'); // the sure Rare
  // the rare-or-better slot walks Rare -> Ultra Rare -> Collector on a test page, so every glow can be seen
  add(force && RARITIES.includes(force) ? force : ['Rare', 'Ultra Rare', 'Collector'][STUB.opens % 3]);
  if (forcedTier) { out[0].tier = forcedTier; const cp = STUB.copies[out[0].card_id]; if (cp && cp.length) cp[cp.length - 1].tier = forcedTier; } // the forced upgraded drop sits first
  return out;
}

// ------------------------------------------------------------------ server calls (stub on test pages without a player)
async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e: any) {
    // a dropped connection (fetch TypeError) is retried once with the SAME arguments; the idem key makes it safe
    if (e && /fetch|network|Failed to/i.test(String(e.message || e))) return await fn();
    throw e;
  }
}
export const api = {
  async shopInfo(): Promise<ShopInfo> {
    if (stubMode()) { stubInit(); return JSON.parse(JSON.stringify({ packs: STUB.packs, coins: STUB.coins, free_packs: STUB.free_packs })); }
    return await rpc<ShopInfo>('shop_info');
  },
  async openPack(packType: string, idemKey: string, useFree: boolean, force?: string): Promise<OpenResult> {
    if (stubMode()) {
      stubInit();
      const pack = STUB.packs.find((p) => p.id === packType) || STUB.packs[0];
      const free = useFree && STUB.free_packs > 0;
      if (!free && STUB.coins < pack.price_coins) throw new Error('not enough coins');
      const cards = stubRoll(pack, force);
      STUB.opens += 1; pack.opened_today += 1;
      if (free) STUB.free_packs -= 1; else STUB.coins -= pack.price_coins;
      for (const c of cards) STUB.owned[c.card_id] = (STUB.owned[c.card_id] || 0) + 1;
      return { opening_id: 'stub-' + STUB.opens, pack_type: pack.id, price_paid: free ? 0 : pack.price_coins, free, cards, coins_after: STUB.coins, free_packs_after: STUB.free_packs, odds: pack.slots };
    }
    return await retryOnce(() => rpc<OpenResult>('open_pack', { p_pack_type: packType, p_idem_key: idemKey, p_use_free: useFree }));
  },
  async myCollection(): Promise<Record<string, number>> {
    if (stubMode()) { stubInit(); return { ...STUB.owned }; }
    const rows = await rpc<{ card_id: string; count: number | string }[]>('my_collection');
    const out: Record<string, number> = {};
    for (const r of rows || []) out[r.card_id] = Number(r.count) || 0;
    return out;
  },
  async myUpgradeInfo(): Promise<UpgradeInfo> {
    if (stubMode()) {
      stubInit();
      const cards: UpgradeInfo['cards'] = {};
      for (const id of Object.keys(STUB.owned)) { const cs = stubCopies(id); if (cs.length) cards[id] = { best: Math.max(...cs.map((c) => c.tier)), owned: cs.length, upgraded: cs.filter((c) => c.tier > 1).length }; }
      return { steps: JSON.parse(JSON.stringify(STUB_STEPS)), drop_bp: { Common: 200, Uncommon: 100, Rare: 50, 'Ultra Rare': 20, Collector: 5 }, drop_tiers: { '2': 8000, '3': 1500, '4': 400, '5': 100 }, cards };
    }
    return await rpc<UpgradeInfo>('my_upgrade_info');
  },
  async myCardCopies(cardId: string): Promise<CardCopy[]> {
    if (stubMode()) { stubInit(); return stubCopies(cardId).map((c) => ({ ...c })); }
    return (await rpc<CardCopy[]>('my_card_copies', { p_card: cardId })) || [];
  },
  async upgradeCard(target: string, sources: string[], idemKey: string): Promise<UpgradeResult> {
    if (stubMode()) {
      stubInit();
      const id = Object.keys(STUB.copies).find((k) => STUB.copies[k].some((c) => c.id === target));
      if (!id) throw new Error('That card is not yours.');
      const list = STUB.copies[id], t = list.find((c) => c.id === target)!;
      const srcs = list.filter((c) => sources.includes(c.id) && c.id !== target);
      if (!srcs.length) throw new Error('Pick at least one copy to combine.');
      if (t.tier >= 5) throw new Error('That card is already Mythic.');
      const before = { worth: t.worth, tier: t.tier };
      t.worth += srcs.reduce((s, c) => s + c.worth, 0); t.tier = tierOfWorth(t.worth, stubSteps(id));
      STUB.copies[id] = list.filter((c) => !srcs.includes(c)); STUB.owned[id] = STUB.copies[id].length;
      return { event_id: 'stub-e' + (++stubUid), target, card_id: id, spent: srcs.length, worth_before: before.worth, worth_after: t.worth, tier_before: before.tier, tier_after: t.tier, next_worth: t.tier < 5 ? worthOfTier(t.tier + 1, stubSteps(id)) : null, repeat: false };
    }
    return await retryOnce(() => rpc<UpgradeResult>('upgrade_card', { p_target: target, p_sources: sources, p_idem_key: idemKey }));
  },
  async myQuests(): Promise<QuestsInfo> {
    if (stubMode()) { stubInit(); return JSON.parse(JSON.stringify({ ...STUB.quests!, free_packs: STUB.free_packs })); }
    return await rpc<QuestsInfo>('my_quests');
  },
  async questReroll(id: string): Promise<QuestsInfo> {
    if (stubMode()) {
      stubInit();
      const q = STUB.quests!;
      if (q.reroll_left < 1) throw new Error('you already rerolled a quest today');
      const i = q.quests.findIndex((x) => x.id === id && !x.done);
      if (i < 0) throw new Error('that quest cannot be rerolled');
      const swaps: Record<string, Partial<Quest>> = { easy: { quest_id: 'clink-clink', name: 'Clink Clink', text: 'Mine with Miners 5 times.', target: 5 }, medium: { quest_id: 'bonk-collector', name: 'Bonk Collector', text: 'Defeat 8 enemy units.', target: 8 }, hard: { quest_id: 'hat-trick', name: 'Hat Trick', text: 'Win 3 battles.', target: 3 } };
      q.quests[i] = { ...q.quests[i], ...swaps[q.quests[i].tier], id: id + 'r', progress: 0 } as Quest;
      q.reroll_left = 0;
      return this.myQuests();
    }
    await rpc('quest_reroll', { p_quest: id });
    return await rpc<QuestsInfo>('my_quests');
  },
  async questReport(summary: any, ref: string): Promise<QuestsInfo> {
    if (stubMode()) { stubInit(); return this.myQuests(); }
    return await rpc<QuestsInfo>('quest_report', { p_summary: summary, p_ref: ref });
  },
};

// ------------------------------------------------------------------ coins
let coins: number | null = null;
let freePacks = 0;
let shopCache: ShopInfo | null = null;
const chips = new Set<El>();
export const coinIcon = (cls = 'econ-coin-img') => h('img', { class: cls, src: '/art/packs/icons/coin.webp', alt: '', draggable: 'false' });
const fmt = (n: number) => n.toLocaleString('en-US');
function paintChip(c: El) {
  const num = c.querySelector('.econ-coins-n');
  if (num) num.textContent = coins == null ? '…' : fmt(coins);
  c.setAttribute('aria-label', coins == null ? 'Coins' : `${coins} coins`);
  const fp = c.querySelector('.econ-coins-free') as El | null;
  if (fp) { fp.hidden = !(freePacks > 0); fp.title = `${freePacks} free pack${freePacks === 1 ? '' : 's'}`; const n = fp.querySelector('span'); if (n) n.textContent = '×' + freePacks; }
}
/** The painted coin counter (refreshes itself from shop_info). */
export function coinChip(): El {
  const c = h('div', { class: 'econ-coins', role: 'status', 'data-testid': 'coin-chip' }, coinIcon(), h('span', { class: 'econ-coins-n' }, '…'),
    h('span', { class: 'econ-coins-free', hidden: true }, h('img', { src: '/art/packs/icons/free-pack.webp', alt: 'Free pack' }), h('span', {}, '')));
  chips.add(c);
  paintChip(c);
  return c;
}
export function setCoins(n: number | null | undefined, free?: number) {
  if (typeof n === 'number' && isFinite(n)) coins = n;
  if (typeof free === 'number' && isFinite(free)) freePacks = free;
  for (const c of [...chips]) { if (!c.isConnected) { chips.delete(c); continue; } paintChip(c); }
}
export const currentCoins = () => coins;
export const currentFreePacks = () => freePacks;
export const lastShop = () => shopCache;
export const setShop = (s: ShopInfo) => { shopCache = s; setCoins(s.coins, s.free_packs); };

/** Re-reads the coin count shown on the menu. */
export async function refreshCoins(): Promise<void> {
  if (!net.active && !stubMode()) return;
  try { const s = await api.shopInfo(); shopCache = s; setCoins(s.coins, s.free_packs); } catch { /* the chip keeps its last number */ }
}

/** The deck builder's owned counts (crystals are free and unlimited there). */
export async function refreshOwned(): Promise<Record<string, number> | null> {
  if (!net.active && !stubMode()) { setOwnedCounts(null); return null; }
  try { const m = await api.myCollection(); if (net.active) setOwnedCounts(m); return m; } catch { return null; }
}

// ------------------------------------------------------------------ toast
export function toast(text: string, icon = '/art/packs/icons/coin-pile.webp') {
  const t = h('div', { class: 'econ-toast', role: 'status' }, h('img', { src: icon, alt: '' }), h('span', {}, text));
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3800);
}

// ------------------------------------------------------------------ screens
export type EconScreen = 'shop' | 'collection' | 'quests' | 'pack';
/** While an economy screen is up, everything else in the game's root is inert: no keyboard focus, no clicks, nothing read out. */
function syncInert(root: Element) {
  const open = !!root.querySelector(':scope > .econ-screen');
  for (const c of [...root.children] as HTMLElement[]) {
    if (c.classList.contains('econ-screen')) continue;
    if (open) { if (!c.hasAttribute('inert')) { c.setAttribute('inert', ''); c.dataset.econInert = '1'; } }
    else if (c.dataset.econInert) { c.removeAttribute('inert'); delete c.dataset.econInert; }
  }
}
let inertWatch: MutationObserver | null = null;
/** Puts up one of the economy screens over whatever is showing (the menu stays underneath and comes back on Back). */
export function econShow(name: string, ...kids: (El | null)[]): El {
  closeEcon();
  const root = document.getElementById('app') || document.body;
  const main = h('main', { class: 'screen net-screen econ-screen', 'data-screen': 'econ-' + name, 'aria-label': name, tabindex: '-1' }, ...kids);
  root.append(main);
  syncInert(root);
  if (!inertWatch) { inertWatch = new MutationObserver(() => syncInert(root)); inertWatch.observe(root, { childList: true }); } // catches every way a screen closes
  main.focus({ preventScroll: true });
  return main;
}
export function closeEcon() { for (const s of document.querySelectorAll('.econ-screen')) s.remove(); }
/** Back to the main menu: close the screen and refresh the numbers the menu shows. */
export function backToMenu() { closeEcon(); void refreshCoins(); }
export const backBtn = (onclick: () => void = backToMenu) => h('button', { type: 'button', class: 'net-btn econ-back', 'aria-label': 'Back', onclick }, '◂ Back');

export async function openScreen(kind: EconScreen) {
  if (kind === 'shop') (await import('./shop')).showShop();
  else if (kind === 'collection') (await import('./collection')).showCollection();
  else if (kind === 'quests') (await import('./quests')).showQuests();
  else if (kind === 'pack') await testOpen('standard');
}

/** Buy (or use a free pack) and play the opening. The server does the paying and the rolling; the idem key makes a retry safe. */
export async function buyPack(pack: PackInfo, onErr?: (msg: string) => void, force?: string): Promise<void> {
  const useFree = freePacks > 0;
  const key = (globalThis.crypto && 'randomUUID' in crypto) ? crypto.randomUUID() : 'k' + Date.now() + Math.random().toString(36).slice(2);
  let res: OpenResult;
  try { res = await api.openPack(pack.id, key, useFree, force); } catch (e: any) {
    const m = String(e?.message || e);
    const msg = /not enough coins|insufficient|below zero/i.test(m) ? `You need ${pack.price_coins} coins for that pack. Finish quests to earn coins!` : /per day|daily|max_per_day|limit/i.test(m) ? 'That pack is sold out for today. The goblins are restocking.' : m;
    if (onErr) onErr(msg); else toast(msg);
    return;
  }
  setCoins(res.coins_after, res.free_packs_after);
  if (shopCache) { const p = shopCache.packs.find((x) => x.id === pack.id); if (p) p.opened_today += 1; shopCache.coins = res.coins_after; shopCache.free_packs = res.free_packs_after; }
  void refreshOwned();
  const { showPackOpening } = await import('./packopen');
  showPackOpening({
    pack, result: res,
    canAgain: () => (coins ?? 0) >= pack.price_coins || freePacks > 0,
    againLabel: () => (freePacks > 0 ? 'Open another (FREE)' : `Open another (${pack.price_coins})`),
    onAgain: () => { void buyPack(pack, onErr); },
    onDone: () => { void import('./shop').then((m) => m.showShop()); },
  });
}

// ------------------------------------------------------------------ main menu
/** Main-menu extras when signed in: coin chip + Shop / Collection / Quests buttons. */
export function economyMenu(el: El): void {
  if (!net.active) return;
  net.openShop = () => { void openScreen('shop'); };
  const b = (label: string, icon: string, kind: EconScreen) => h('button', { type: 'button', class: 'net-btn econ-menu-btn', 'data-econ': kind, onclick: () => { void openScreen(kind); } }, h('img', { src: icon, alt: '' }), h('span', {}, label));
  el.prepend(coinChip());
  el.append(h('div', { class: 'econ-bar', role: 'group', 'aria-label': 'Coins and packs' },
    b('Shop', '/art/packs/icons/free-pack.webp', 'shop'), b('Collection', '/art/ui/oreheart-card-back.webp', 'collection'), b('Quests', '/art/packs/icons/quest.webp', 'quests')));
  void refreshCoins();
  void refreshOwned();
}

// ------------------------------------------------------------------ end of a match
let lastQuests: QuestsInfo | null = null;
export const rememberQuests = (q: QuestsInfo) => { lastQuests = q; if (typeof q.free_packs === 'number') setCoins(undefined, q.free_packs); };
/** Called by the match screen when a match ends; vs-computer matches report quest progress. */
export async function onMatchEnd(o: { state: any; events: any[]; pvp: boolean }): Promise<void> {
  if (!net.active) return;
  if (o.pvp || !o.state || o.state.tutorial) { await refreshCoins(); return; } // PvP progress is reported by the server itself
  const sum = capSummary(summarize(o.events || [], o.state, 'player'));
  if (sum.turns < 3) return; // the server would count nothing
  try {
    const before = lastQuests || await api.myQuests();
    const ref = 'practice:' + ((globalThis.crypto && 'randomUUID' in crypto) ? crypto.randomUUID() : String(Date.now()));
    const after = await api.questReport(sum, ref);
    rememberQuests(after);
    const wasDone = new Set(before.quests.filter((q) => q.done).map((q) => q.id));
    const fresh = after.quests.filter((q) => q.done && !wasDone.has(q.id));
    if (fresh.length) {
      const total = fresh.reduce((n, q) => n + (q.reward || 0), 0);
      toast(fresh.length === 1 ? `Quest done! +${total} coins` : `${fresh.length} quests done! +${total} coins`, '/art/packs/icons/quest-done.webp');
    }
  } catch { /* a missed report only costs quest progress; the match itself is unaffected */ }
  await refreshCoins();
}

// ------------------------------------------------------------------ test hooks (test pages only)
async function testOpen(id: string, force?: string) {
  if (!shopCache) await refreshCoins();
  const pack = (shopCache?.packs || []).find((p) => p.id === id) || shopCache?.packs[0];
  if (!pack) throw new Error('no packs');
  await buyPack(pack, (m) => { throw new Error(m); }, force);
}
if (isTestPage() && typeof window !== 'undefined') {
  const packs = {
    /** Opens a pack (the stand-in result when nobody is signed in); `force` picks the rare slot's rarity on the stand-in. */
    open: (id = 'standard', force?: string) => testOpen(id, force),
    state: () => (window as any).__ohPack?.state() ?? { phase: 'idle', flipped: 0, cards: [] },
    flipAll: () => (window as any).__ohPack?.flipAll(),
    skip: () => (window as any).__ohPack?.skip(),
    screen: (kind: EconScreen) => openScreen(kind),
    summarize: (events: any[], state: any, side = 'player') => capSummary(summarize(events, state, side)),
    coins: () => ({ coins, free_packs: freePacks }),
    /** the deck builder's copy limit for a card (signed in: capped by the copies owned) */
    deckLimit: (id: string) => ({ limit: deckLimit(id), owned: ownedOf(id), copyLimit: copyLimit(id) }),
    /** test pages: pretend to be signed in with exactly these owned counts (zero start checks) */
    setOwned: (m: Record<string, number>) => { if (params().get('test') !== '1') return false; net.active = true; setOwnedCounts(m); net.openShop = () => { void openScreen('shop'); }; return true; },
  };
  const attach = () => { const w = window as any; w.oreheart = Object.assign(w.oreheart || {}, { packs }); };
  attach(); setTimeout(attach, 0); setTimeout(attach, 500);
  const want = params().get('econ') as EconScreen | null;
  if (want && ['shop', 'collection', 'quests', 'pack'].includes(want)) setTimeout(() => {
    for (const w of document.querySelectorAll('.overlay.welcome')) w.remove(); // the test page's first-visit welcome box would sit on top
    void refreshCoins().then(() => openScreen(want));
  }, 50);
}
