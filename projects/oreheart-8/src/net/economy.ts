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
import { setOwnedCounts, setOwnedTiers, deckLimit, ownedOf, copyLimit } from '../ui/decks';
import { COMMANDER_PACK_IDS, commanderPackCard, cardFor } from '../content/card-labels';
import { rankOfRating, DEFAULT_LADDER, type LadderRank, type LadderStep } from '../content/ladder';
import { summarize, capSummary } from './quest-summary';

type El = HTMLElement;

// ------------------------------------------------------------------ shapes (contract part 1)
export interface PackSlot { slot_no: number; count: number; odds: Record<string, number>; pool?: 'any' | 'miners' }
export interface PackInfo { id: string; name: string; blurb: string; price_coins: number; faction: string | null; art: string | null; max_per_day: number; opened_today: number; slots: PackSlot[] }
/** Nov 5 (Ken): a bundle for sale (size bought, bonus packs free, the promises its last pack keeps) */
export interface BundleInfo { size: number; bonus: number; promises: Record<string, any> }
export interface StashInfo { packs: Record<string, number>; free: number }
export interface ShopInfo { packs: PackInfo[]; coins: number; free_packs: number; bundles?: BundleInfo[]; stash?: StashInfo; pity?: { limit: number; since: number }; badges?: Record<string, any>; card_backs?: string[] }
export interface PulledCard { card_id: string; rarity: string; is_new: boolean; tier?: number; pity?: boolean; guarantee?: string; item?: string }
export interface BuyResult { bundle_id: string; pack_type: string; size: number; bonus: number; packs: number; price_paid: number; promises: Record<string, any>; coins_after: number; stash: StashInfo; repeat: boolean }
export interface StashResult { openings: OpenResult[]; opened: number; coins_after: number; free_packs_after: number; stash: StashInfo; repeat: boolean }
/** Upgraded cards (Nov 5): thresholds = copies for tiers 2..5; cards = per card id its best tier, owned copies and upgraded copies. */
export interface UpgradeInfo { steps: Record<string, number[]>; drop_bp: Record<string, number>; drop_tiers: Record<string, number>; cards: Record<string, { best: number; owned: number; upgraded: number; by_tier?: number[] /* Nov 5: copies per tier 1..5 */ }> }
export interface CardCopy { id: string; tier: number; worth: number; since: string }
export interface UpgradeResult { event_id: string; target: string; card_id: string; spent: number; left?: number; decks?: string[]; worth_before: number; worth_after: number; tier_before: number; tier_after: number; next_worth: number | null; repeat: boolean }
export { TIER_NAMES } from '../content/card-labels';
/** Extra copies per step (Enhanced, Overcharged, Legendary, Mythic) by rarity (Ken and Forge, Nov 5); the server's setting upgrade_steps is the truth */
export const DEFAULT_STEPS: Record<string, number[]> = { Common: [5, 15, 30, 50], Uncommon: [4, 12, 24, 40], Rare: [2, 4, 7, 14], 'Ultra Rare': [1, 2, 3, 4], Collector: [1, 1, 1, 1] };
export const stepsFor = (rarity: string, steps: Record<string, number[]> = DEFAULT_STEPS) => steps[rarity] || steps.Common || DEFAULT_STEPS.Common;
/** worth needed for a tier: 1 + the steps so far */
export const worthOfTier = (tier: number, steps: number[]) => (tier <= 1 ? 1 : 1 + steps.slice(0, Math.min(4, tier - 1)).reduce((a, b) => a + b, 0));
export const tierOfWorth = (worth: number, steps: number[]) => { for (let t = 5; t >= 2; t--) if (worth >= worthOfTier(t, steps)) return t; return 1; };
export interface OpenResult { opening_id: string; pack_type: string; price_paid: number; free: boolean; cards: PulledCard[]; coins_after: number; free_packs_after: number; odds: PackSlot[]; extras?: PulledCard[]; pity?: boolean; bundle_id?: string | null }
export interface Quest { id: string; quest_id: string; name: string; text: string; tier: 'easy' | 'medium' | 'hard'; reward: number; progress: number; target: number; done: boolean; expires_on: string }
export interface QuestsInfo { quests: Quest[]; reroll_left: number; streak_days: number; free_packs: number; today: string }
/** Nov 6 (Dashboard): the player's rank card from my_rank: the Elo rating and the ladder step read off it */
export interface RankCard { season: string; season_end: string | null; rating: number; name: string; games: number; wins: number; losses: number; peak: number; place: number | null; players?: number; rank: LadderRank; ladder: LadderStep[] }
export interface NewsPost { id: string; title: string; subtitle: string | null; body: any; posted_on?: string; event_on?: string | null; action?: 'join' | 'remind' | null }
export interface NewsFeed { patch: NewsPost[]; events: NewsPost[]; news: NewsPost[] }

const params = () => new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const isTestPage = () => params().get('test') === '1';
/** Stand-in data: only on test pages, and only while nobody is signed in. */
export const stubMode = () => isTestPage() && (!net.active || STUB.pretend);
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
  { slot_no: 4, count: 1, odds: { Rare: 7800, 'Ultra Rare': 2000, Collector: 200 } }, // Rare or better (Ken, Nov 5: 78 / 20 / 2)
];
const stubPack = (id: string, name: string, blurb: string, faction: string | null): PackInfo => ({ id, name, blurb, price_coins: 100, faction, art: null, max_per_day: 50, opened_today: 0, slots: STD_SLOTS.map((s) => ({ ...s, odds: { ...s.odds } })) });
const STUB = {
  coins: 500,
  free_packs: 1,
  pretend: false, // a test page pretending to be signed in (packs.setOwned): the stand-in data stays in use
  packs: [
    stubPack('standard', 'Oreheart Pack', 'Every army, every crystal. Shake well before opening.', null), // Ken (Nov 6): Oreheart packs only (the faction packs are switched off in pack_types)
  ] as PackInfo[],
  owned: {} as Record<string, number>,
  copies: {} as Record<string, CardCopy[]>, // test page: each owned card's copies with tiers
  // Nov 5 (Ken): bundles and My Packs on the test page (the real ones are settings and rows on the server)
  bundles: [{ size: 1, bonus: 0, promises: {} }, { size: 6, bonus: 0, promises: {} }, { size: 24, bonus: 3, promises: { upgraded_min_tier: 3, legendary_min: 2 } }, { size: 99, bonus: 16, promises: { upgraded_min_tier: 4, legendary_min: 10, legendary_unowned: true, card_back: 'chest' } }] as BundleInfo[],
  stashBundles: [] as { id: string; type: string; left: number; promises: Record<string, any>; best: number; newLeg: boolean }[],
  pitySince: 0, pityLimit: 20,
  cardBacks: [] as string[],
  opens: 0,
  rerolled: false,
  quests: null as QuestsInfo | null,
  region: null as string | null, // Nov 6: the stand-in's chosen server
};
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
function stubInit() {
  if (STUB.quests) return;
  // a starter-ish collection: four of most commons, a couple of the rest, some missing
  if (!STUB.pretend) {
    const ids = Object.keys(CARDS).filter((id) => !(CARDS as any)[id].disabled); // Nov 5: crystals are owned cards like any other
    ids.forEach((id, i) => { const r = (CARDS as any)[id].rarity; const n = r === 'Common' ? 4 : r === 'Uncommon' ? 2 : r === 'Rare' ? (i % 2 ? 1 : 0) : 0; if (n) STUB.owned[id] = n; });
    for (const id of COMMANDER_PACK_IDS) STUB.owned[id] = 1; // everyone starts with the three Commanders (Ken, Nov 5)
  }
  const t = today();
  STUB.quests = { today: t, reroll_left: 1, streak_days: 3, free_packs: STUB.free_packs, quests: [
    { id: 'stub-q1', quest_id: 'thwack', name: 'THWACK!', text: 'Land 10 hits.', tier: 'easy', reward: 25, progress: 10, target: 10, done: true, expires_on: addDays(t, 3) },
    { id: 'stub-q2', quest_id: 'faction-pride', name: 'Gnome Pride', text: 'Play 10 Gnome cards.', tier: 'medium', reward: 50, progress: 4, target: 10, done: false, expires_on: addDays(t, 2) },
    { id: 'stub-q3', quest_id: 'crown-jewels', name: 'Crown Jewels', text: 'Win a battle with Grubnak.', tier: 'hard', reward: 75, progress: 0, target: 1, done: false, expires_on: addDays(t, 3) },
  ] };
}
const pickOf = (pool: any[], n: number) => pool[Math.floor(Math.random() * pool.length) % Math.max(1, n)];
const stubStash = (): StashInfo => { const packs: Record<string, number> = {}; for (const b of STUB.stashBundles) if (b.left > 0) packs[b.type] = (packs[b.type] || 0) + b.left; return { packs, free: STUB.free_packs }; };
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
  // the bad-luck shield (Ken, Nov 5): the pityLimit-th pack without a Legendary gets one in its last slot
  if (!out.some((c) => c.rarity === 'Collector') && STUB.pitySince + 1 >= STUB.pityLimit) { const p = of('Collector'); const c = pickOf(p, p.length); out[out.length - 1] = { card_id: c.id, rarity: c.rarity, is_new: !seen[c.id], tier: 1, pity: true }; stubCopy(c.id, 1); }
  STUB.pitySince = out.some((c) => c.rarity === 'Collector') ? 0 : STUB.pitySince + 1;
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
    if (stubMode()) { stubInit(); return JSON.parse(JSON.stringify({ packs: STUB.packs, coins: STUB.coins, free_packs: STUB.free_packs, bundles: STUB.bundles, stash: stubStash(), pity: { limit: STUB.pityLimit, since: STUB.pitySince }, badges: { best_value: 99, most_popular: null }, card_backs: STUB.cardBacks })); }
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
  /** Nov 5 (Ken): buy a bundle; the packs go to My Packs */
  async buyPacks(packType: string, size: number, idemKey: string): Promise<BuyResult> {
    if (stubMode()) {
      stubInit();
      const pack = STUB.packs.find((p) => p.id === packType) || STUB.packs[0];
      const b = STUB.bundles.find((x) => x.size === size);
      if (!b) throw new Error('That bundle is not for sale.');
      const price = pack.price_coins * b.size;
      if (STUB.coins < price) throw new Error('not enough coins');
      STUB.coins -= price;
      const id = 'stub-b' + (++stubUid);
      STUB.stashBundles.push({ id, type: pack.id, left: b.size + b.bonus, promises: { ...b.promises }, best: 1, newLeg: false });
      return { bundle_id: id, pack_type: pack.id, size: b.size, bonus: b.bonus, packs: b.size + b.bonus, price_paid: price, promises: { ...b.promises }, coins_after: STUB.coins, stash: stubStash(), repeat: false };
    }
    return await retryOnce(() => rpc<BuyResult>('buy_packs', { p_pack_type: packType, p_size: size, p_idem_key: idemKey }));
  },
  /** Nov 5 (Ken): open up to `count` sealed packs of one kind from My Packs (oldest bundle first, then the free quest packs) */
  async openStash(packType: string, count: number, idemKey: string): Promise<StashResult> {
    if (stubMode()) {
      stubInit();
      const pack = STUB.packs.find((p) => p.id === packType) || STUB.packs[0];
      const openings: OpenResult[] = [];
      for (let i = 0; i < Math.min(120, Math.max(1, count)); i++) {
        const b = STUB.stashBundles.find((x) => x.type === pack.id && x.left > 0);
        let free = false;
        if (!b) { if (STUB.free_packs < 1) break; STUB.free_packs -= 1; free = true; }
        const cards = stubRoll(pack);
        STUB.opens += 1;
        for (const c of cards) STUB.owned[c.card_id] = (STUB.owned[c.card_id] || 0) + 1;
        const extras: PulledCard[] = [];
        if (b) {
          b.left -= 1;
          b.best = Math.max(b.best, ...cards.map((c) => c.tier || 1)); if (cards.some((c) => c.rarity === 'Collector' && c.is_new)) b.newLeg = true;
          if (b.left === 0) {
            const want = Number(b.promises.upgraded_min_tier) || 0;
            const pool = ([...Object.values(CARDS as any)] as any[]).filter((c) => c && !c.disabled && (c.type === 'creature' || c.type === 'spell') && (!pack.faction || c.faction === pack.faction || c.faction === 'any'));
            if (want > b.best) { const c = pickOf(pool, pool.length); extras.push({ card_id: c.id, rarity: c.rarity, is_new: !STUB.owned[c.id], tier: want, guarantee: 'upgraded' }); STUB.owned[c.id] = (STUB.owned[c.id] || 0) + 1; stubCopy(c.id, want); b.best = want; }
            if (b.promises.legendary_unowned && !b.newLeg) { const legs = pool.filter((c) => c.rarity === 'Collector'); const un = legs.filter((c) => !STUB.owned[c.id]); const c = pickOf(un.length ? un : legs, (un.length ? un : legs).length); if (c) { extras.push({ card_id: c.id, rarity: 'Collector', is_new: !STUB.owned[c.id], tier: 1, guarantee: 'legendary' }); STUB.owned[c.id] = (STUB.owned[c.id] || 0) + 1; stubCopy(c.id, 1); b.newLeg = true; } }
            if (b.promises.card_back) { if (!STUB.cardBacks.includes(String(b.promises.card_back))) STUB.cardBacks.push(String(b.promises.card_back)); extras.push({ card_id: '', rarity: '', is_new: false, guarantee: 'card_back', item: String(b.promises.card_back) }); }
          }
        }
        openings.push({ opening_id: 'stub-' + STUB.opens, pack_type: pack.id, price_paid: 0, free, cards, coins_after: STUB.coins, free_packs_after: STUB.free_packs, odds: pack.slots, extras, pity: cards.some((c) => c.pity), bundle_id: b ? b.id : null });
      }
      if (!openings.length) throw new Error('No sealed packs of that kind in My Packs.');
      return { openings, opened: openings.length, coins_after: STUB.coins, free_packs_after: STUB.free_packs, stash: stubStash(), repeat: false };
    }
    return await retryOnce(() => rpc<StashResult>('open_stash', { p_pack_type: packType, p_count: count, p_idem_key: idemKey }));
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
      for (const id of Object.keys(STUB.owned)) { const cs = stubCopies(id); if (cs.length) cards[id] = { best: Math.max(...cs.map((c) => c.tier)), owned: cs.length, upgraded: cs.filter((c) => c.tier > 1).length, by_tier: [1, 2, 3, 4, 5].map((t) => cs.filter((c) => c.tier === t).length) }; }
      return { steps: JSON.parse(JSON.stringify(STUB_STEPS)), drop_bp: { Common: 200, Uncommon: 100, Rare: 50, 'Ultra Rare': 20, Collector: 5 }, drop_tiers: { '2': 8000, '3': 1500, '4': 400, '5': 100 }, cards };
    }
    return await rpc<UpgradeInfo>('my_upgrade_info');
  },
  async myCardCopies(cardId: string): Promise<CardCopy[]> {
    if (stubMode()) { stubInit(); return stubCopies(cardId).map((c) => ({ ...c })); }
    return (await rpc<CardCopy[]>('my_card_copies', { p_card: cardId })) || [];
  },
  async upgradeCard(target: string, sources: string[], idemKey: string, force = false): Promise<UpgradeResult> {
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
      return { event_id: 'stub-e' + (++stubUid), target, card_id: id, spent: srcs.length, left: STUB.copies[id].length, decks: [], worth_before: before.worth, worth_after: t.worth, tier_before: before.tier, tier_after: t.tier, next_worth: t.tier < 5 ? worthOfTier(t.tier + 1, stubSteps(id)) : null, repeat: false };
    }
    return await retryOnce(() => rpc<UpgradeResult>('upgrade_card', { p_target: target, p_sources: sources, p_idem_key: idemKey, p_force: force === true }));
  },
  /** Nov 6 (Dashboard): the rank card */
  async myRank(): Promise<RankCard> {
    if (stubMode()) { stubInit(); const rating = 1250; /* Nov 7: ladder points (Sapphire III) */ return { season: '2026-Q4', season_end: new Date(Date.now() + 12 * 86400000 + 6 * 3600000).toISOString(), rating, name: rankOfRating(rating).label, games: 27, wins: 18, losses: 9, peak: 1290, place: 84, players: 2184, rank: rankOfRating(rating), ladder: DEFAULT_LADDER.slice() }; }
    const r = await rpc<any>('my_rank');
    const ladder: LadderStep[] = Array.isArray(r?.ladder) ? r.ladder.map((s: any) => ({ name: String(s.name), min: Number(s.min) || 0 })) : DEFAULT_LADDER.slice();
    return { ...r, rank: r && r.rank && r.rank.label ? { ...rankOfRating(Number(r.rating) || 0, ladder), ...r.rank, divFloor: Number(r.rank.div_floor), divNext: r.rank.div_next == null ? null : Number(r.rank.div_next), progress: Number(r.rank.progress) || 0 } : rankOfRating(Number(r?.rating) || 1000, ladder), ladder };
  },
  /** Nov 6 (regions): the enabled servers with live counts, the caller's choice, the fallback time; calling it is the heartbeat */
  async regionsInfo(): Promise<import('./regions').RegionsInfo> {
    if (stubMode()) { stubInit(); return { regions: [{ id: 'us-east', name: 'US East', edge: 'us-east-1', online: 14, playing: 6, waiting: 2 }, { id: 'us-central', name: 'US Central', edge: 'us-east-1', online: 5, playing: 2, waiting: 0 }, { id: 'us-west', name: 'US West', edge: 'us-west-1', online: 9, playing: 4, waiting: 1 }], mine: STUB.region, fallback_seconds: 45, counts: true }; }
    return await rpc('regions_info');
  },
  async setRegion(id: string | null): Promise<import('./regions').RegionsInfo> {
    if (stubMode()) { STUB.region = id; return await this.regionsInfo(); }
    return await rpc('set_region', { p_region: id });
  },
  /** Nov 6 (Dashboard): What's New from the news table (admin-editable) */
  async newsFeed(): Promise<NewsFeed> {
    if (stubMode()) { stubInit(); return { patch: [{ id: 'stub-p1', title: 'Patch 0.9.5 (test server)', subtitle: 'November 5', body: [{ section: 'new', items: ['<b>Ranked and Unranked PvP</b> on the test server', '<b>Card upgrades</b>: Enhanced to Mythic, found in packs', '<b>Treasure Chest</b>: 99 packs and an exclusive card back'] }, { section: 'fixed', items: ['Units no longer freeze after a Respond window'] }, { section: 'known', items: ['Friend codes can take a moment to appear'] }] }], events: [{ id: 'stub-e1', title: 'Crystal Cup', subtitle: 'Tournament · coming soon', body: [], event_on: null, action: 'join' }, { id: 'stub-e2', title: 'Goblin Rumble Weekend', subtitle: 'Double coins on goblin quests · coming soon', body: [], event_on: null, action: 'remind' }], news: [{ id: 'stub-n1', title: 'Welcome to the test server', subtitle: 'Oreheart Online, early days', body: ['Coins, packs and ranks here are for testing.'] }] }; }
    return await rpc<NewsFeed>('news_feed');
  },
  /** Nov 6 (Dashboard): the top of the season and the caller's row */
  async leaderboard(limit = 10): Promise<any> {
    if (stubMode()) { stubInit(); const names = ['Snagtooth', 'Amvilina', 'ProfessorZap', 'MossQueen', 'SirBonksAlot', 'IronBeardBetty', 'Propellerhead', 'LadyGloom', 'HexyBexy', 'BigBogBrian']; const top = names.map((n, i) => { const rating = 2860 - i * 120; return { place: i + 1, user_id: 'stub-' + i, username: n, avatar: null, rating, label: rankOfRating(rating).label, wins: 200 - i * 12, losses: 100 - i * 3, games: 300 - i * 15, me: false }; }); return { season: '2026-Q4', season_end: new Date(Date.now() + 12 * 86400000).toISOString(), top, me: await this.myRank(), players: 2184, shares: { Stone: 180, Copper: 220, Iron: 260, Silver: 330, Sapphire: 480, Emerald: 320, Ruby: 200, Amethyst: 120, Diamond: 54, Oreheart: 20 } }; }
    return await rpc<any>('leaderboard', { p_limit: limit });
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
  try {
    const m = await api.myCollection();
    if (net.active) setOwnedCounts(m);
    // Nov 5 (Ken, per copy): the copies per tier, so the Deck Builder can say which copy goes in
    try { const u = await api.myUpgradeInfo(); const t: Record<string, number[]> = {}; for (const [id, x] of Object.entries(u.cards || {})) if (Array.isArray(x.by_tier)) t[id] = x.by_tier.map((n) => Number(n) || 0); if (net.active) setOwnedTiers(t); } catch { if (net.active) setOwnedTiers(null); }
    return m;
  } catch { return null; }
}

// ------------------------------------------------------------------ toast
export function toast(text: string, icon = '/art/packs/icons/coin-pile.webp') {
  const t = h('div', { class: 'econ-toast', role: 'status' }, h('img', { src: icon, alt: '' }), h('span', {}, text));
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3800);
}

// ------------------------------------------------------------------ screens
export type EconScreen = 'shop' | 'collection' | 'quests' | 'pack' | 'oreshards';
/** While an economy screen is up, everything else in the game's root is inert: no keyboard focus, no clicks, nothing read out. */
function syncInert(root: Element) {
  const open = !!root.querySelector(':scope > .econ-screen');
  for (const c of [...root.children] as HTMLElement[]) {
    // Nov 7 (Ken: the Exit box over the Collection let clicks through to the cards): a pop-up opened over an economy screen is never
    // made inert (an inert box takes no clicks, so they fell through to the screen behind); if one was, it is freed again
    if (c.classList.contains('overlay')) { if (c.dataset.econInert) { c.removeAttribute('inert'); delete c.dataset.econInert; } continue; }
    if (c.classList.contains('econ-screen')) continue;
    if (open) { if (!c.hasAttribute('inert')) { c.setAttribute('inert', ''); c.dataset.econInert = '1'; } }
    else if (c.dataset.econInert) { c.removeAttribute('inert'); delete c.dataset.econInert; }
  }
}
let inertWatch: MutationObserver | null = null;
/** Puts up one of the economy screens over whatever is showing (the menu stays underneath and comes back on Back). */
/** Nov 6: true when the economy screens wear the D shell (signed in, or a test page pretending to be) */
export const dashSkinned = () => (net.active && !stubMode()) || (isTestPage() && STUB.pretend);
export function econShow(name: string, ...kids: (El | null)[]): El {
  closeEcon();
  const root = document.getElementById('app') || document.body;
  const main = h('main', { class: 'screen net-screen econ-screen', 'data-screen': 'econ-' + name, 'aria-label': name, tabindex: '-1' }, ...kids);
  root.append(main);
  // Nov 6 (design D): signed in, the D shell goes around the screen (the pack opening keeps its own stage)
  if (net.active && !stubMode() || (isTestPage() && STUB.pretend)) { const titles: Record<string, string> = { shop: 'Shop', collection: 'Collection', quests: 'Daily Quests', pack: 'Pack opening' }; const infos: Record<string, string> = { shop: 'Every pack: 11 cards, at least 2 Rares \u00b7 a Legendary within every 40 packs', collection: "Every card in Oreheart. Combine spare copies to upgrade a card's look.", quests: 'Three quests a day, one free reroll, a free pack every 7 days of finished quests' }; if (name !== 'pack') void import('./dashboard').then((m) => m.dashSkin(main, titles[name] || name, () => { backToMenu(); }, { info: infos[name] })).catch(() => {}); }
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
  else if (kind === 'oreshards') (await import('./oreshards')).showOreshards(); // Nov 6 (Stripe): Buy Oreshards
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

/** Nov 5 (Ken): buy a bundle of 6, 24 or 99; the packs wait in My Packs. */
export async function buyBundle(pack: PackInfo, size: number, onErr?: (msg: string) => void): Promise<void> {
  const key = (globalThis.crypto && 'randomUUID' in crypto) ? crypto.randomUUID() : 'k' + Date.now() + Math.random().toString(36).slice(2);
  let res: BuyResult;
  try { res = await api.buyPacks(pack.id, size, key); } catch (e: any) {
    const m = String(e?.message || e);
    const msg = /not enough coins|insufficient|below zero/i.test(m) ? `You need ${(pack.price_coins * size).toLocaleString('en-US')} coins for that bundle. Finish quests to earn coins!` : /enough of those|per day|daily|limit/i.test(m) ? 'That bundle is sold out for today. The goblins are restocking.' : m;
    if (onErr) onErr(msg); else toast(msg);
    return;
  }
  setCoins(res.coins_after);
  if (shopCache) { shopCache.coins = res.coins_after; shopCache.stash = res.stash; }
  toast(`${res.packs} ${res.packs === 1 ? 'pack is' : 'packs are'} waiting in My Packs${res.bonus ? ` (${res.bonus} free)` : ''}.`, '/art/packs/icons/free-pack.webp');
  void import('./shop').then((m) => m.showShop());
}
/** Nov 5 (Ken): open `n` sealed packs from My Packs: one gets the rip; several get the big rip and the grid. */
export async function openStash(pack: PackInfo, n: number, onErr?: (msg: string) => void): Promise<void> {
  const key = (globalThis.crypto && 'randomUUID' in crypto) ? crypto.randomUUID() : 'k' + Date.now() + Math.random().toString(36).slice(2);
  let res: StashResult;
  try { res = await api.openStash(pack.id, n, key); } catch (e: any) { const m = String(e?.message || e); if (onErr) onErr(m); else toast(m); return; }
  setCoins(res.coins_after, res.free_packs_after);
  if (shopCache) { shopCache.coins = res.coins_after; shopCache.free_packs = res.free_packs_after; shopCache.stash = res.stash; } // packs from My Packs never count against the single pack's daily limit
  void refreshOwned();
  const left = () => (shopCache && shopCache.stash ? (Number(shopCache.stash.packs[pack.id]) || 0) + (shopCache.stash.free || 0) : 0);
  const mod = await import('./packopen');
  if (res.openings.length === 1 && n === 1) {
    mod.showPackOpening({
      pack, result: res.openings[0],
      canAgain: () => left() > 0 || (coins ?? 0) >= pack.price_coins,
      againLabel: () => (left() > 0 ? `Open another (${left()} left)` : `Open another (${pack.price_coins})`),
      onAgain: () => { if (left() > 0) void openStash(pack, 1, onErr); else void buyPack(pack, onErr); },
      onDone: () => { void import('./shop').then((m) => m.showShop()); },
    });
    return;
  }
  mod.showMultiOpening({ pack, openings: res.openings, onDone: () => { void import('./shop').then((m) => m.showShop()); } });
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
    /** stand-in only: more coins for the checks (the real wallet moves only through the ledger) */
    giveCoins: (n: number) => { if (!stubMode()) return false; STUB.coins += Math.max(0, Math.floor(n)); setCoins(STUB.coins); return true; },
    /** the deck builder's copy limit for a card (signed in: capped by the copies owned) */
    deckLimit: (id: string) => ({ limit: deckLimit(id), owned: ownedOf(id), copyLimit: copyLimit(id) }),
    /** test pages: pretend to be signed in with exactly these owned counts (zero start checks) */
    /** a count, or the tiers of the copies ([2, 1, 1] = one Enhanced and two plain); `decks` stands in for the saved decks */
    setOwned: (m: Record<string, number | number[]>, decks?: { name: string; cards: string[]; commander?: string }[]) => {
      if (params().get('test') !== '1') return false;
      STUB.pretend = true; STUB.owned = {}; STUB.copies = {};
      const counts: Record<string, number> = {}, tiers: Record<string, number[]> = {};
      for (const [id, v] of Object.entries(m)) { const ts = Array.isArray(v) ? v.slice() : []; const n = Array.isArray(v) ? v.length : Number(v) || 0; STUB.owned[id] = n; counts[id] = n; for (const t of ts) stubCopy(id, Math.max(1, Math.min(5, Number(t) || 1))); tiers[id] = [1, 2, 3, 4, 5].map((t) => stubCopies(id).filter((c) => c.tier === t).length); }
      net.active = true; setOwnedCounts(counts); setOwnedTiers(tiers); net.decks = (decks || []).map((d, i) => ({ id: 'stub-d' + i, name: d.name, cards: d.cards.slice(), commander: d.commander || 'grubnak' }));
      net.openShop = () => { void openScreen('shop'); }; return true;
    },
  };
  const attach = () => { const w = window as any; w.oreheart = Object.assign(w.oreheart || {}, { packs }); if (!w.oreheart.oreshards) void import('./oreshards').then((m) => { w.oreheart.oreshards = m.oreshardHooks(); }); };
  attach(); setTimeout(attach, 0); setTimeout(attach, 500);
  const want = params().get('econ') as EconScreen | null;
  // Nov 6 (Stripe): back from Stripe's page (?oreshards=paid|cancel): open Buy Oreshards once the sign-in is back, and it reads the balance again
  if (params().get('oreshards') && !want) { let tries = 0; const t = setInterval(() => { if (net.active || ++tries > 40) { clearInterval(t); if (net.active) void openScreen('oreshards'); } }, 500); }
  if (want && ['shop', 'collection', 'quests', 'pack', 'oreshards'].includes(want)) setTimeout(() => {
    for (const w of document.querySelectorAll('.overlay.welcome')) w.remove(); // the test page's first-visit welcome box would sit on top
    void refreshCoins().then(() => openScreen(want));
  }, 50);
}
