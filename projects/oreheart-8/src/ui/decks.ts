// Testing deck builder: every card unlocked and unlimited; up to 5 decks saved on the device.
import { CARDS, FACTIONS, COMMANDERS, CONFIG, isMiner, deckCounts, deckProblems, basicMiner } from '../engine';
import { h, btn, combo, App, faceKids, rarityKey, FRAME, commanderPortrait, pictureOf } from './app';
import { myCommanderPortrait } from '../net/cmd-tier';
import { ohCardEl } from './cardfmt';
import '../net/dashboard.css'; // the D kit (offline too)
import './deck-d.css'; // the Deck Builder in design D (Ken approved Nov 5; built Nov 6)

import { net } from '../net/state';
import { TIER_NAMES } from '../content/card-labels';
export interface SavedDeck { name: string; cards: string[]; commander?: string; id?: string; tiers?: number[] /* Nov 5: each slot's copy tier (1 when plain) */ }
const CMD_NAMES: Record<string, string> = { grubnak: 'Grubnak', sproingle: 'Sproingle', borgo: 'Borgo' };
const CMD_BY_NAME: Record<string, string> = { Grubnak: 'grubnak', Sproingle: 'sproingle', Borgo: 'borgo' };
const KEY = 'oreheart.decks';
const MAX_DECKS = 5;
const NAME_MAX = 24; // Nov 7 (Forge): deck names up to 24 letters in the builder

export const maxDecks = () => (net.active ? net.maxDecks : MAX_DECKS);
export function loadDecks(): SavedDeck[] {
  if (net.active) return net.decks.map((d) => ({ ...d, cards: d.cards.slice(), tiers: d.tiers ? d.tiers.slice() : undefined }));
  return loadBrowserDecks();
}
/** The decks kept in this browser, whatever the online state (used for the one-time import). */
export function loadBrowserDecks(): SavedDeck[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((d) => d && typeof d.name === 'string' && Array.isArray(d.cards)).slice(0, MAX_DECKS) : [];
  } catch { return []; }
}
export function hiddenStarters(): string[] {
  try { const v = JSON.parse(localStorage.getItem('oreheart.hiddenStarters') || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; }
}
export function setHiddenStarters(v: string[]) { try { localStorage.setItem('oreheart.hiddenStarters', JSON.stringify(v)); } catch { /* storage unavailable */ } }
export function storeDecks(d: SavedDeck[]) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage unavailable */ } }
/** The faction most of a deck's creatures belong to: it decides which faction spells the deck may hold. */
export function deckMainFaction(ids: string[]): string | undefined {
  const t: Record<string, number> = {};
  for (const id of ids) { const c = CARDS[id]; if (c && c.type === 'creature' && c.faction !== 'any') t[c.faction] = (t[c.faction] || 0) + 1; }
  return Object.keys(t).sort((a, b) => t[b] - t[a])[0];
}
export const deckLegal = (d: SavedDeck, commander?: string) => d.cards.every((id) => CARDS[id]) && deckProblems(d.cards, commander).length === 0;

const ORDER = ['goblins', 'gnomes', 'dwarves', 'any'];
const ALL = (Object.values(CARDS) as any[]).filter((c) => !c.token /* Nov 5: tokens appear in play only */).slice().sort((a, b) => {
  const t = (c: any) => (c.type === 'creature' ? 0 : c.type === 'spell' ? 1 : 2);
  return t(a) - t(b) || ORDER.indexOf(a.faction) - ORDER.indexOf(b.faction) || a.cost - b.cost || a.name.localeCompare(b.name);
});
const SING: Record<string, string> = { goblins: 'Goblin', gnomes: 'Gnome', dwarves: 'Dwarf' };
const FNAME: Record<string, string> = { goblins: 'Goblins', gnomes: 'Gnomes', dwarves: 'Dwarves', any: 'Neutral' };
const FSYMS: Record<string, string> = { goblins: '💀', gnomes: '⚙️', dwarves: '🔨', any: '✦' };

export const copyLimit = (id: string): number => CONFIG.copyLimits[CARDS[id]?.rarity] ?? (CARDS[id]?.type === 'crystal' ? 99 : 99);

// Online (contract 4.2): signed in, a deck can only use the copies the player owns (src/net/economy.ts fills this from
// my_collection). Crystal cards are free and unlimited. Offline nothing changes: no counts, every card unlimited as before.
let ownedCounts: Record<string, number> | null = null;
export function setOwnedCounts(m: Record<string, number> | null) { ownedCounts = m ? { ...m } : null; }
/** Signed in and not one card of your own yet: the Deck Builder has nothing to build with. */
export const ownsNothing = () => ownedMode() && !Object.entries(ownedCounts!).some(([id, n]) => n > 0 && CARDS[id]);
const ownedMode = () => net.active && !!ownedCounts;
/** Copies owned, or null when ownership doesn't apply (offline). Nov 5: crystals are owned cards too. */
export const ownedOf = (id: string): number | null => (ownedMode() ? ownedCounts![id] || 0 : null);
// Nov 5 (Ken, per copy): the copies per tier (index 0 = plain .. 4 = Mythic); a deck slot names the tier of the copy in it
let ownedTiers: Record<string, number[]> | null = null;
export function setOwnedTiers(m: Record<string, number[]> | null) { ownedTiers = m ? { ...m } : null; }
/** copies owned per tier; without tier data every owned copy counts as plain */
export const ownedTiersOf = (id: string): number[] => { const o = ownedOf(id); if (o == null) return [99, 0, 0, 0, 0]; const t = ownedTiers && ownedTiers[id]; return t && t.length === 5 ? t.slice() : [o, 0, 0, 0, 0]; };
/** the words for a card's copies by tier, best first ("Overcharged ×1 · Original ×5"); '' when all are plain */
export const tierSummary = (id: string): string => { const t = ownedTiersOf(id); if (!t.slice(1).some((n) => n > 0)) return ''; return [5, 4, 3, 2, 1].filter((k) => t[k - 1] > 0).map((k) => `${TIER_NAMES[k]} ×${t[k - 1]}`).join(' · '); };
/** The copy limit in the deck builder: the normal limit, capped by the copies owned when signed in. */
export const deckLimit = (id: string): number => { const o = ownedOf(id); return o == null ? copyLimit(id) : Math.min(copyLimit(id), o); };
// test pages only: ?test=1&econ=shop|collection|quests|pack loads the economy screens with stand-in data (no database)
if (typeof location !== 'undefined' && /[?&]test=1(&|$)/.test(location.search) && /[?&]econ=/.test(location.search)) setTimeout(() => { void import('../net/economy'); }, 0);
const kindOf = (c: any) => (c.type === 'creature' ? (c.role === 'Smith' ? 'Smith Miner' : isMiner(c) ? 'Miner' : 'Fighter') : c.type === 'spell' ? 'Spell' : 'Crystal card');

/** A real card face: cost, name, art, stats, rarity, role and the complete ability text. */
export function cardFace(c: any, big = false) {
  return h('div', { class: `face hand-card static f-${c.faction} ${c.type}${big ? ' big' : ''}`, 'data-card-id': c.id, 'data-frame': FRAME[c.faction] || 'neutral', 'data-rarity': rarityKey(c) }, ...faceKids(c));
}

/** Smart search (R2.20): plain words against name, text, keywords, faction, role, type, rarity and cost. */
const STOP = new Set(['card', 'cards', 'with', 'and', 'the', 'a', 'than', 'cost', 'costing', 'that', 'are', 'of']);
export function smartMatch(c: any, query: string): boolean {
  const words = query.toLowerCase().replace(/[^a-z0-9+ ]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w));
  const ab: string[] = c.abilities || [];
  const hay = [c.name, c.shortText, c.longText, ab.join(' '), FNAME[c.faction], c.role || '', c.type, c.rarity, c.rarity === 'Collector' ? 'legendary' : '', c.spellKind || '', String(c.cost)].join(' ').toLowerCase();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const num = (j: number) => { const n = parseInt(words[j], 10); return isNaN(n) ? null : n; };
    if (w === 'cheap') { if (!(c.cost <= 3)) return false; }
    else if (w === 'under' || w === 'below' || w === 'less') { const n = num(i + 1); if (n == null) continue; i++; if (!(c.cost < n)) return false; }
    else if (w === 'over' || w === 'above' || w === 'more') { const n = num(i + 1); if (n == null) continue; i++; if (!(c.cost > n)) return false; }
    else if (/^goblins?$/.test(w)) { if (c.faction !== 'goblins') return false; }
    else if (/^gnomes?$/.test(w)) { if (c.faction !== 'gnomes') return false; }
    else if (/^(dwarf|dwarves|dwarfs)$/.test(w)) { if (c.faction !== 'dwarves') return false; }
    else if (/^miners?$/.test(w)) { if (!(c.type === 'creature' && isMiner(c))) return false; }
    else if (/^fighters?$/.test(w)) { if (!(c.type === 'creature' && !isMiner(c))) return false; }
    else if (/^ranged$/.test(w)) { if (!ab.includes('ranged') && !/ranged/i.test(c.shortText + ' ' + c.longText)) return false; }
    else if (/^bombs?$/.test(w)) { if (!(ab.includes('kaboom') || ab.includes('kaboom1'))) return false; }
    else if (/^guards?$/.test(w)) { if (!ab.includes('guard')) return false; }
    else if (/^spells?$/.test(w)) { if (c.type !== 'spell') return false; }
    else if (/^crystals?$/.test(w)) { if (c.type !== 'crystal') return false; }
    else if (/^\d+$/.test(w)) { if (c.cost !== +w) return false; }
    else if (!hay.includes(w.replace(/s$/, '')) && !hay.includes(w)) return false;
  }
  return true;
}

/** Completes `deck` to exactly 50 cards without removing anything (R9.1). */
export function autoFill(deck: string[], faction?: string): string[] {
  const out = deck.slice();
  const n = () => { const m: Record<string, number> = {}; for (const id of out) m[id] = (m[id] || 0) + 1; return m; };
  const room = () => CONFIG.deckMin - out.length;
  const count = (id: string) => n()[id] || 0;
  const tally: Record<string, number> = {};
  for (const id of out) if (CARDS[id].type === 'creature' && CARDS[id].faction !== 'any') tally[CARDS[id].faction] = (tally[CARDS[id].faction] || 0) + 1;
  const main = faction || Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || 'goblins';
  const add = (id: string, cap: number) => { if (room() > 0 && count(id) < Math.min(cap, deckLimit(id))) { out.push(id); return true; } return false; }; // Nov 4: capped by the copies owned when signed in
  const basic = basicMiner(main);
  while (count(basic) < 5 && add(basic, 5));
  const smith = (ALL.find((c) => c.role === 'Smith' && c.faction === main) || {}).id;
  while (smith && count(smith) < 3 && add(smith, 3));
  const cur = () => deckCounts(out);
  const crystals = ALL.filter((c) => c.type === 'crystal');
  for (let i = 0; cur().crystals < 4 && room() > 0 && i < 40; i++) out.push(crystals[i % crystals.length].id);
  const spells = ALL.filter((c) => c.type === 'spell' && (c.faction === main || c.faction === 'any') && ['Common', 'Uncommon'].includes(c.rarity)).sort((a, b) => a.cost - b.cost);
  for (let i = 0; cur().spells < 4 && room() > 0 && i < 60; i++) add(spells[i % spells.length].id, 2);
  const fighters = (f: (c: any) => boolean) => ALL.filter((c) => c.type === 'creature' && !isMiner(c) && f(c)).sort((a, b) => Math.abs(a.cost - 4) - Math.abs(b.cost - 4) || a.cost - b.cost);
  const pools = [fighters((c) => c.faction === main || c.faction === 'any'), fighters(() => true)];
  for (const pool of pools) {
    for (let cap = 2; cap <= 4 && room() > 0; cap++) for (const c of pool) { if (room() <= 0) break; if (c.rarity !== 'Common' && c.rarity !== 'Uncommon' && cap < 4) continue; add(c.id, cap); }
  }
  for (const c of ALL) while (room() > 0 && c.type === 'creature' && add(c.id, 4));
  return out;
}

export function showDecks(app: App, opts: { focus?: number; onBack?: () => void } = {}) {
  app.clear();
  let saved = loadDecks();
  let deck: string[] = [];
  let deckTiers: number[] = []; // Nov 5: the tier of the copy in each slot, parallel to deck (1 = plain)
  let editing = -1;
  // the tiers used so far in the deck for a card, and the best tier that still has a spare copy (plain when nothing better)
  const usedTiers = (id: string, skip = -1) => { const u = [0, 0, 0, 0, 0]; deck.forEach((x, i) => { if (x === id && i !== skip) u[Math.max(1, Math.min(5, deckTiers[i] || 1)) - 1]++; }); return u; };
  const spareTier = (id: string, skip = -1, below = 6) => { const own = ownedTiersOf(id), used = usedTiers(id, skip); for (let t = Math.min(5, below - 1); t >= 1; t--) if (own[t - 1] - used[t - 1] > 0) return t; return 1; };
  // Nov 7 (Ken: "it should show the upgraded first ... each one will cycle through as you add to the deck"): the copies still free for
  // this deck, per tier (owned minus in the deck); null offline, where every card is unlimited
  const spareByTier = (id: string): number[] | null => { if (ownedOf(id) == null) return null; const own = ownedTiersOf(id), used = usedTiers(id); return own.map((n, i) => Math.max(0, n - used[i])); };
  const spareOf = (id: string): number | null => { const s = spareByTier(id); return s ? s.reduce((a, b) => a + b, 0) : null; };
  /** the tier the pool tile shows: the best copy not already in the deck (the best owned one when none is left) */
  const bestSpare = (id: string): number => { const s = spareByTier(id); if (!s) return 1; for (let k = 5; k >= 1; k--) if (s[k - 1] > 0) return k; const own = ownedTiersOf(id); for (let k = 5; k >= 1; k--) if (own[k - 1] > 0) return k; return 1; };
  /** why a card can't go in right now ('' when it can) */
  const outReason = (id: string): string => { if (lockedFor(id)) return `Only for ${SING[CARDS[id].faction]} Commanders`; const o = ownedOf(id); if (o === 0) return "You don't own this card yet"; if (count(id) >= deckLimit(id)) return o != null && count(id) >= o ? 'All copies in deck' : `At most ${copyLimit(id)} in a deck`; return ''; };
  /** keeps deckTiers in step with deck: new slots take the best spare copy; the test page reads it */
  const syncTiers = () => { while (deckTiers.length < deck.length) deckTiers.push(spareTier(deck[deckTiers.length])); if (deckTiers.length > deck.length) deckTiers.length = deck.length; if (app.test) (window as any).__dbTiers = () => deck.map((id, i) => ({ id, tier: deckTiers[i] || 1 })); };
  // Nov 7 (Forge): new decks get a fun default after their Commander ("Grubnak's Deck 2")
  const NAME_CMD: Record<string, string> = { grubnak: 'Grubnak', sproingle: 'Knobbin', borgo: 'Borgo' };
  const defaultName = () => { const who = NAME_CMD[cmdId] || 'My'; for (let i = 1; ; i++) if (!saved.some((d) => d.name === `${who}'s Deck ${i}`)) return `${who}'s Deck ${i}`; };
  let name = '';
  let nameTouched = false; // a default name follows the Commander until the player types one

  const sel = (label: string, id: string, opts: string[]) => combo(label, id, opts, () => renderCards());
  const fF = sel('Faction', 'f-faction', ['All', 'Goblins', 'Gnomes', 'Dwarves', 'Neutral']);
  const fT = sel('Type', 'f-type', ['All', 'Miners', 'Fighters', 'Spells', 'Crystal cards']);
  const fC = sel('Cost', 'f-cost', ['Any', '1-2', '3-4', '5-6', '7+']);
  const fR = sel('Rarity', 'f-rarity', ['All', 'Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Legendary']);
  let cmdId = 'grubnak';
  const fCmd = { set: (_: string) => {} }; // the Deck Commander combobox is gone: the three portraits choose it
  let query = '';
  const savedRow = parseInt(localStorage.getItem('oreheart.cardsPerRow') || '', 10);
  let perRow = savedRow >= 2 && savedRow <= 8 ? savedRow : 0; // 0: not chosen yet; fitRow picks a size from the pool's width (design D: about 160 px per card, so names stay readable)
  const cardsEl = h('div', { class: 'db-cards', 'aria-label': 'All cards', role: 'group' });
  const pileEl = h('div', { class: 'db-pile', 'aria-label': 'Deck pile', role: 'group' });
  const carEl = h('div', { class: 'db-car' });
  const track = h('div', { class: 'db-track' });
  carEl.append(track);
  const nameEl = h('p', { class: 'db-name', 'data-part': 'deck-name' });
  const sizeEl = h('p', { class: 'db-size', 'data-part': 'deck-size' });
  let cur = -1;
  const listEl = h('ul', { class: 'db-list', 'aria-label': 'Deck cards' });
  const countsEl = h('p', { class: 'db-counts', 'aria-label': 'Deck counts' });
  const chartEl = h('div', { class: 'db-chart', 'aria-label': 'Cost chart', role: 'group' });
  const alertEl = h('span', { class: 'db-alert', role: 'alert', style: 'display:block;color:#ff8f7a' });
  const probEl = h('ul', { class: 'db-problems', 'aria-label': 'Deck problems' });
  const status = h('p', { class: 'db-status', role: 'status' });
  const limitMsg = h('p', { class: 'db-status' });
  // Round 9c: Play starts a match with the deck on screen (disabled, with a short reason, while the deck is not legal)
  const startWith = (cards: string[], commander: string, deckName = name) => {
    let diff = 'normal';
    try { diff = JSON.parse(localStorage.getItem('oreheart.picks') || '{}').diff || 'normal'; } catch { /* ignore */ }
    const others = Object.keys(COMMANDERS).filter((k) => k !== commander);
    app.beginMatch({ playerCommander: commander, opponentCommander: others[Math.floor(Math.random() * others.length)], difficulty: diff, playerDeck: cards.slice(), deckName });
  };
  const playBtn = btn('Play', 'db-play', () => { if (!deckProblems(deck, cmdId).length) startWith(deck, cmdId); }) as HTMLButtonElement;
  const syncPlay = () => { const pr = deckProblems(deck, cmdId); playBtn.disabled = pr.length > 0; playBtn.title = pr.length ? pr[0] : 'Start a match with this deck'; playBtn.setAttribute('aria-disabled', pr.length ? 'true' : 'false'); };
  const newBtn = btn('New Deck', '', () => { if (saved.length >= maxDecks()) { status.textContent = ''; limitMsg.textContent = `You can save up to ${maxDecks()} decks.`; return; } setCur(saved.length); }) as HTMLButtonElement;

  const matches = (c: any) => {
    if (query && !smartMatch(c, query)) return false;
    const f = fF.sel.value, t = fT.sel.value, co = fC.sel.value, r = fR.sel.value;
    if (f !== 'All' && FNAME[c.faction] !== f) return false;
    if (t === 'Miners' && !(c.type === 'creature' && isMiner(c))) return false;
    if (t === 'Fighters' && !(c.type === 'creature' && !isMiner(c))) return false;
    if (t === 'Spells' && c.type !== 'spell') return false;
    if (t === 'Crystal cards' && c.type !== 'crystal') return false;
    const k = c.cost;
    if (co === '1-2' && k > 2) return false;
    if (co === '3-4' && (k < 3 || k > 4)) return false;
    if (co === '5-6' && (k < 5 || k > 6)) return false;
    if (co === '7+' && k < 7) return false;
    if (r !== 'All' && c.rarity !== (r === 'Legendary' ? 'Collector' : r)) return false; // Ken, Nov 5: shown as Legendary, stored as 'Collector'
    return true;
  };
  const count = (id: string) => deck.filter((x) => x === id).length;
  const fly = (id: string, from?: DOMRect | null, tier = 1) => {
    const src = from || (cardsEl.querySelector(`[data-card="${id}"]`) as HTMLElement | null)?.getBoundingClientRect();
    if (!src) return;
    const ghost = tier > 1 ? detailFace(CARDS[id], tier) : cardFace(CARDS[id]); ghost.classList.add('db-fly'); // Nov 7: the copy that goes in flies over
    ghost.style.setProperty('--cw', src.width + 'px');
    ghost.style.left = src.left + 'px'; ghost.style.top = src.top + 'px';
    document.body.append(ghost);
    const to = pileEl.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (src.left + src.width / 2), dy = to.top + to.height / 2 - (src.top + src.height / 2);
    const a = ghost.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: 0.3 }], { duration: 200, easing: 'ease-in' });
    a.onfinish = () => ghost.remove();
    setTimeout(() => ghost.remove(), 400);
  };
  const lockedFor = (id: string) => { const c = CARDS[id]; return c.faction !== 'any' && c.faction !== COMMANDERS[cmdId].faction; };
  /** adds one copy: the best spare one, or the tier asked for (the double-click view's "Put in deck") */
  const addCard = (id: string, from?: DOMRect | null, noFly = false, tier = 0) => {
    if (lockedFor(id)) { status.textContent = `Only for ${SING[CARDS[id].faction]} Commanders`; return; }
    if (count(id) >= deckLimit(id)) { const o = ownedOf(id); status.textContent = o === 0 ? `You don't own ${CARDS[id].name} yet` : o != null && count(id) >= o ? `All your copies of ${CARDS[id].name} are in this deck` : `At most ${copyLimit(id)} of ${CARDS[id].name} in a deck`; return; }
    syncTiers();
    const sp = spareByTier(id);
    const k = tier >= 1 && tier <= 5 && (!sp || sp[tier - 1] > 0) ? tier : spareTier(id);
    if (!noFly) fly(id, from, k);
    deck.push(id); deckTiers.push(k); status.textContent = ''; renderDeck();
  };
  const removeCard = (id: string) => { syncTiers(); let i = -1; deck.forEach((x, k) => { if (x === id && (i < 0 || (deckTiers[k] || 1) < (deckTiers[i] || 1))) i = k; }); if (i >= 0) { deck.splice(i, 1); deckTiers.splice(i, 1); } status.textContent = ''; renderDeck(); }; // the plainest copy leaves first

  /** Nov 7 (Ken): the big view on a double-click (or a long press): the card in full colour, its tier ladder with your copies, Put in deck */
  function enlarge(c: any) {
    app.closeUp(c.id, true, { deck: { inDeck: (k: number) => usedTiers(c.id)[k - 1], spare: (k: number) => { const s = spareByTier(c.id); return s ? s[k - 1] : 99; }, room: () => !outReason(c.id), add: (k: number) => addCard(c.id, null, true, k) } });
  }
  const ghostW = () => Math.max(40, ((cardsEl.clientWidth || 300) - 8 - 2 * 10) / 3);
  function drag(e: PointerEvent, c: any, el: HTMLElement) {
    if (e.button !== 0) return;
    if (e.pointerType === 'mouse') e.preventDefault();
    (el as any)._dragged = false;
    const sx = e.clientX, sy = e.clientY;
    let ghost: HTMLElement | null = null;
    const inside = (n: Element, x: number, y: number) => { const r = n.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
    const wrapEl = app.root.querySelector('.db-listwrap') as Element | null;
    const over = (x: number, y: number) => inside(pileEl, x, y) || inside(listEl, x, y) || (!!wrapEl && inside(wrapEl, x, y));
    const mv = (m: PointerEvent) => {
      if (!ghost && Math.hypot(m.clientX - sx, m.clientY - sy) > 6 && (e.pointerType !== 'touch' || Math.abs(m.clientX - sx) > Math.abs(m.clientY - sy))) {
        ghost = cardFace(c); ghost.setAttribute('data-drag-ghost', '1');
        const gw = ghostW();
        ghost.style.setProperty('--cw', gw + 'px'); ghost.style.setProperty('width', gw + 'px', 'important');
        document.body.append(ghost);
        (el as any)._dragged = true;
      }
      if (ghost) { ghost.style.left = m.clientX + 'px'; ghost.style.top = m.clientY + 'px'; pileEl.classList.toggle('hot', over(m.clientX, m.clientY)); }
    };
    const up = (m: PointerEvent) => {
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      if (ghost) { ghost.remove(); pileEl.classList.remove('hot'); if (m.type === 'pointerup' && over(m.clientX, m.clientY)) addCard(c.id, new DOMRect(m.clientX - 30, m.clientY - 45, 60, 90)); setTimeout(() => { (el as any)._dragged = false; }, 0); }
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }
  function tile(c: any) {
    const own = ownedOf(c.id);
    const summary = tierSummary(c.id); // Nov 5: "Overcharged ×1 · Original ×5" on a card with upgraded copies (Nov 7: the copies still free)
    const indeck = h('span', { class: 'db-indeck', 'aria-hidden': 'true' }, ''); // design D: "2/4 in deck" on the tile
    const tierSum = h('span', { class: 'db-tiersum', 'aria-hidden': 'true', hidden: summary ? null : '' }, summary);
    const ownEl = own == null ? null : h('span', { class: 'db-owned', 'data-testid': 'db-left', 'aria-label': `You own ${own}` }, own === 0 ? '' : `×${own}`);
    // Nov 7 (Ken: "it makes it hard to push add to the deck or take one out"): + / − on every tile; they never open the big view
    const stop = (e: Event) => { e.stopPropagation(); };
    let el: any = null;
    const plus = h('button', { type: 'button', class: 'db-tplus', 'data-testid': 'db-plus', 'aria-label': `Add ${c.name} to the deck`, onclick: (e: Event) => { e.stopPropagation(); select(c.id); addCard(c.id, (el as HTMLElement).getBoundingClientRect()); } }, '+') as HTMLButtonElement;
    const minus = h('button', { type: 'button', class: 'db-tminus', 'data-testid': 'db-minus', 'aria-label': `Take one ${c.name} out of the deck`, onclick: (e: Event) => { e.stopPropagation(); select(c.id); if (count(c.id) > 0) removeCard(c.id); } }, '−') as HTMLButtonElement;
    const acts = h('div', { class: 'db-tacts' }, minus, plus);
    for (const ev of ['pointerdown', 'dblclick', 'mousedown', 'touchstart', 'keydown']) acts.addEventListener(ev, stop);
    const faceBox = h('div', { class: 'db-tface', 'data-tier': '1' }, cardFace(c));
    el = h('div', { class: 'db-tile' + (lockedFor(c.id) ? ' locked' : '') + (own === 0 ? ' unowned' : '') + (c.id === selId ? ' sel' : ''), 'data-owned': own == null ? null : String(own), 'data-locked': lockedFor(c.id) ? 'true' : null, 'aria-disabled': lockedFor(c.id) ? 'true' : null, role: 'button', tabindex: '0', 'aria-label': c.name, 'data-card': c.id }, faceBox, indeck, tierSum, lockedFor(c.id) ? h('span', { class: 'lock-hint' }, '🔒 Only for ' + SING[c.faction] + ' Commanders') : null, ownEl, acts, h('span', { hidden: '' }, c.longText || ''));
    el._indeck = indeck; el._sum = tierSum; el._own = ownEl; el._plus = plus; el._minus = minus; el._face = faceBox;
    el.addEventListener('focus', () => select(c.id));
    el.addEventListener('click', () => { select(c.id); }); // one click: pick it (the detail column shows it); nothing pops up
    el.addEventListener('dblclick', () => { if (el._dragged) return; enlarge(c); });
    // a long press on a phone opens the big view too (not when it turns into a drag or a scroll)
    let press: any = null;
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      clearTimeout(press);
      const sx = e.clientX, sy = e.clientY;
      const off = () => { clearTimeout(press); press = null; document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', off); document.removeEventListener('pointercancel', off); };
      const mv = (m: PointerEvent) => { if (Math.hypot(m.clientX - sx, m.clientY - sy) > 8) off(); };
      press = setTimeout(() => { off(); if (!el._dragged) { el._longPressed = true; enlarge(c); } }, 550);
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', off); document.addEventListener('pointercancel', off);
    });
    el.addEventListener('contextmenu', (e: Event) => { if (el._longPressed) { e.preventDefault(); el._longPressed = false; } });
    el.addEventListener('keydown', (e: KeyboardEvent) => { if (e.target !== el) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enlarge(c); } else if (e.key === '+' || e.key === '=') { e.preventDefault(); addCard(c.id); } else if (e.key === '-') { e.preventDefault(); if (count(c.id) > 0) removeCard(c.id); } });
    el.addEventListener('pointerdown', (e: PointerEvent) => drag(e, c, el));
    el.addEventListener('dragstart', (e: Event) => e.preventDefault());
    return el;
  }
  /** Nov 7 (Ken): a tile shows the best copy still free, how many are left, which tiers; greyed (and + off) when none can go in */
  function syncTile(t: any) {
    const id = t.dataset.card as string; if (!id || !CARDS[id]) return;
    const c = CARDS[id];
    const k = bestSpare(id), why = outReason(id), left = spareOf(id), sp = spareByTier(id);
    if (t._face && t._face.dataset.tier !== String(k)) { t._face.dataset.tier = String(k); t._face.replaceChildren(k > 1 ? detailFace(c, k) : cardFace(c)); }
    t.classList.toggle('out', !!why && !lockedFor(id));
    t.dataset.left = left == null ? '' : String(left);
    if (t._own) { const own = ownedOf(id) || 0; const txt = own === 0 ? '' : `×${left}`; if (t._own.textContent !== txt) t._own.textContent = txt; t._own.setAttribute('aria-label', own === 0 ? 'You own none' : `${left} of your ${own} left to add`); t._own.title = own === 0 ? "You don't own this card yet" : `${left} of your ${own} copies left to add`; }
    if (t._sum) { const up = !!sp && ownedTiersOf(id).slice(1).some((n) => n > 0); const s = up ? [5, 4, 3, 2, 1].filter((x) => sp![x - 1] > 0).map((x) => `${TIER_NAMES[x]} ×${sp![x - 1]}`).join(' · ') : ''; if (t._sum.textContent !== s) t._sum.textContent = s; t._sum.hidden = !s; }
    if (t._plus) { t._plus.disabled = !!why; t._plus.title = why || `Add ${c.name}`; }
    if (t._minus) { t._minus.disabled = count(id) === 0; t._minus.hidden = count(id) === 0; }
    t.title = why;
  }
  function fitRow() {
    if (!perRow && cardsEl.clientWidth) { perRow = Math.max(2, Math.min(8, Math.round(cardsEl.clientWidth / 160))); slider.value = String(perRow); }
    const n = perRow || 4;
    cardsEl.style.gridTemplateColumns = `repeat(${n},minmax(0,1fr))`;
    const w = cardsEl.clientWidth || (app.root as HTMLElement).clientWidth * 0.6;
    cardsEl.style.setProperty('--cw', Math.max(40, (w - 8 - (n - 1) * 10) / n) + 'px');
  }
  function setPerRow(n: number) {
    perRow = Math.max(2, Math.min(8, Math.round(n)));
    try { localStorage.setItem('oreheart.cardsPerRow', String(perRow)); } catch { /* storage unavailable */ }
    slider.value = String(perRow);
    fitRow();
  }
  // Owner (Ken, Oct 30): the background hall follows the faction filter, else the deck's Commander; Neutral shows the tavern
  const setHall = () => { const f = fF.sel.value; const hall = f === 'Goblins' ? 'goblins' : f === 'Gnomes' ? 'gnomes' : f === 'Dwarves' ? 'dwarves' : f === 'Neutral' ? 'neutral' : (COMMANDERS[cmdId]?.faction || 'neutral'); const s = app.root.querySelector('.deck-d') as HTMLElement | null; if (s && s.dataset.hall !== hall) s.dataset.hall = hall; };
  // Zero start (Ken, Nov 4): a new player owns no cards, so the builder says where cards come from instead of showing a wall of locks with no way on
  const emptyNote = () => h('div', { class: 'db-empty', role: 'status', 'data-testid': 'db-empty' },
    h('p', { class: 'db-empty-head' }, 'Your card chest is empty!'),
    h('p', {}, "Not a single card of your own yet, just dust and one confused rat. The three starter decks are yours to play any time, but a deck of your own is built from cards you own, and those come out of packs."),
    h('div', { class: 'row' }, btn('To the Shop', 'primary', () => { if (net.openShop) net.openShop(); else status.textContent = 'The Shop is on the main menu.'; }, { 'data-testid': 'db-empty-shop' }),
      btn('Play a starter deck', '', () => app.showMenu(), { 'data-testid': 'db-empty-play' })));
  const poolMore = h('span', { class: 'more', 'aria-hidden': 'true' }, '');
  function renderCards() {
    setHall();
    const pool = ALL.filter((c) => !c.disabled && !lockedFor(c.id));
    const shown = pool.filter(matches);
    cardsEl.replaceChildren(...(ownsNothing() ? [emptyNote()] : []), ...shown.map(tile));
    poolMore.textContent = `${shown.length} of ${pool.length} shown`;
    fitRow();
    syncIndeck();
    if (!selId || !CARDS[selId]) { if (shown.length) select(shown[0].id); else renderDetail(); }
  }
  const slider = h('input', { type: 'range', id: 'cards-per-row', min: '2', max: '8', step: '1', value: String(perRow) }) as HTMLInputElement;
  slider.addEventListener('input', () => setPerRow(+slider.value));
  const pickCmd = (id: string) => { cmdId = id; fCmd.set(CMD_NAMES[id]); if (!nameTouched && editing < 0) name = defaultName(); renderCards(); renderDeck(); };
  const cmdBtns = ['grubnak', 'sproingle', 'borgo'].map((id) => h('button', { type: 'button', class: 'db-cmdcard', 'data-cmd': id, 'aria-label': COMMANDERS[id].name, 'aria-pressed': 'false', onclick: () => pickCmd(id), ondblclick: () => app.closeUp('cmd:' + id, true) }, h('img', { alt: '', draggable: 'false', src: myCommanderPortrait(id) })) as HTMLElement);
  const cmdWrap = h('div', { class: 'db-cmdwrap', role: 'group', 'aria-label': 'Deck Commander' }, h('div', { class: 'db-cmdinner', role: 'group', 'aria-label': 'Commander card' }, ...cmdBtns)) as HTMLElement;
  const syncThumb = () => { for (const b of cmdBtns) { const on = b.dataset.cmd === cmdId; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } };
  const searchInp = h('input', { type: 'search', id: 'card-search', role: 'searchbox', 'aria-label': 'Search cards', placeholder: 'Search: "cheap goblin miners", "ranged under 4"…', autocomplete: 'off' }) as HTMLInputElement;
  searchInp.addEventListener('input', () => { query = searchInp.value.trim(); renderCards(); });
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const voiceBtn = SR ? btn('🎤', 'small voice-btn', () => {
    try {
      const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false;
      rec.onresult = (ev: any) => { searchInp.value = ev.results[0][0].transcript; query = searchInp.value.trim(); renderCards(); };
      rec.start();
    } catch { /* microphone unavailable */ }
  }, { 'aria-label': 'Voice search' }) : null;
  cardsEl.addEventListener('wheel', (e: WheelEvent) => { if (e.ctrlKey) { e.preventDefault(); setPerRow(perRow + (e.deltaY > 0 ? 1 : -1)); } }, { passive: false });
  const tp = new Map<number, number[]>();
  let pinch0 = 0;
  cardsEl.addEventListener('pointerdown', (e: PointerEvent) => { if (e.pointerType === 'touch') { tp.set(e.pointerId, [e.clientX, e.clientY]); pinch0 = 0; } }, true);
  cardsEl.addEventListener('pointermove', (e: PointerEvent) => {
    if (!tp.has(e.pointerId)) return;
    tp.set(e.pointerId, [e.clientX, e.clientY]);
    if (tp.size === 2) {
      const [a, b] = [...tp.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (!pinch0) pinch0 = d;
      else if (d > pinch0 * 1.35) { setPerRow(perRow - 1); pinch0 = d; } else if (d < pinch0 / 1.35) { setPerRow(perRow + 1); pinch0 = d; }
    }
  });
  const endTouch = (e: PointerEvent) => { tp.delete(e.pointerId); pinch0 = 0; };
  cardsEl.addEventListener('pointerup', endTouch); cardsEl.addEventListener('pointercancel', endTouch);
  window.addEventListener('resize', fitRow);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fitRow()).observe(cardsEl);
  // cards tilt slightly toward the pointer
  cardsEl.addEventListener('pointermove', (e: PointerEvent) => {
    const r = cardsEl.getBoundingClientRect();
    cardsEl.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 4).toFixed(2) + 'deg');
    cardsEl.style.setProperty('--rx', ((0.5 - (e.clientY - r.top) / Math.max(1, r.height)) * 2).toFixed(2) + 'deg');
  });

  function renderDeck() {
    syncTiers();
    syncPlay();
    syncThumb();
    const n: Record<string, number> = {};
    for (const id of deck) n[id] = (n[id] || 0) + 1;
    const ids = Object.keys(n).sort((a, b) => CARDS[a].cost - CARDS[b].cost || CARDS[a].name.localeCompare(CARDS[b].name));
    // keyed in-place update: rows (and their + / − buttons) survive a click, so nothing lags or shifts
    const rows = ((listEl as any)._rows ||= new Map()) as Map<string, HTMLElement>;
    for (const [id, li] of rows) if (!n[id]) { li.remove(); rows.delete(id); }
    ids.forEach((id, i) => {
      let li = rows.get(id);
      if (!li) {
        const nm = CARDS[id].name;
        const cnt = h('span', { class: 'db-cnt' }, '');
        const plus = btn('+', 'small', () => addCard(id, null, true), { 'aria-label': `Add ${nm}` }) as HTMLButtonElement;
        const tiersEl = h('span', { class: 'db-tiers', role: 'group', 'aria-label': `${nm}: which copies` });
        li = h('li', { class: id === selId ? 'sel' : '' }, h('span', { class: 'db-lbl', onclick: () => select(id) }, cnt, ' ', h('span', { class: 'db-nm' }, nm), tiersEl), plus, btn('−', 'small', () => removeCard(id), { 'aria-label': `Remove ${nm}` })) as HTMLElement;
        (li as any)._cnt = cnt; (li as any)._plus = plus; (li as any)._tiers = tiersEl;
        rows.set(id, li);
      }
      const cnt = (li as any)._cnt as HTMLElement;
      const txt = `${n[id]} ×`;
      if (cnt.textContent !== txt) cnt.textContent = txt;
      (li as any)._plus.disabled = n[id] >= deckLimit(id);
      // Nov 5 (Ken): one chip per copy in the deck; a tap swaps that slot to the next tier with a spare copy (best first, round and round)
      const slots: number[] = []; deck.forEach((x, k) => { if (x === id) slots.push(k); });
      const own = ownedTiersOf(id), anyUp = own.slice(1).some((v) => v > 0) || slots.some((k) => (deckTiers[k] || 1) > 1);
      const te = (li as any)._tiers as HTMLElement;
      const key = anyUp ? slots.map((k) => deckTiers[k] || 1).join(',') + '|' + own.join(',') : '';
      if (te.dataset.key !== key) {
        te.dataset.key = key;
        te.replaceChildren(...(anyUp ? slots.map((k, j) => { const t = deckTiers[k] || 1; return h('button', { type: 'button', class: 'db-tier', 'data-tier': String(t), 'data-slot': String(k), title: `${TIER_NAMES[t]} copy. Tap to change which copy goes in.`, 'aria-label': `copy ${j + 1}: ${TIER_NAMES[t]}, tap to change`,
          onclick: (e: Event) => { e.preventDefault(); e.stopPropagation(); const next = spareTier(id, k, t); deckTiers[k] = next === t ? spareTier(id, k, 6) : next; renderDeck(); } }, '★'.repeat(t)); }) : []));
      }
      if (listEl.children[i] !== li) listEl.insertBefore(li, listEl.children[i] || null);
    });
    const c = deckCounts(deck);
    nameEl.textContent = name;
    if (document.activeElement !== nameIn && nameIn.value !== name) nameIn.value = name;
    sizeEl.textContent = `${c.cards} cards (${CONFIG.deckMin}–${CONFIG.deckMax})`;
    countsEl.textContent = `Cards: ${c.cards} (${CONFIG.deckMin}–${CONFIG.deckMax}) · Creatures: ${c.creatures} · Spells: ${c.spells} · Crystal cards: ${c.crystals}`;
    const buckets = [1, 2, 3, 4, 5, 6, 7].map((k) => deck.filter((id) => CARDS[id].type !== 'crystal' && (k === 7 ? CARDS[id].cost >= 7 : CARDS[id].cost === k)).length);
    const mx = Math.max(4, ...buckets);
    chartEl.replaceChildren(...buckets.map((v, i) => {
      const lab = i === 6 ? '7+' : String(i + 1);
      return h('div', { class: 'bar-col' }, h('span', { class: 'bar-n', 'aria-hidden': 'true' }, String(v)),
        h('div', { class: 'bar', role: 'img', 'aria-label': `Cost ${lab}: ${v} ${v === 1 ? 'card' : 'cards'}`, style: `height:${Math.round((v / mx) * 100)}%` }),
        h('span', { class: 'bar-l', 'aria-hidden': 'true' }, lab));
    }));
    const p = deckProblems(deck, cmdId);
    probEl.replaceChildren(...(p.length ? p : ['Deck is legal']).map((m) => h('li', { class: p.length ? 'bad' : 'good' }, m)));
    // design D: the curve's words, the tile badges, the detail's count and the "n of max" decks line
    const nonCr = deck.filter((id) => CARDS[id].type !== 'crystal');
    curveNote.textContent = nonCr.length ? `avg cost ${(nonCr.reduce((s, id) => s + CARDS[id].cost, 0) / nonCr.length).toFixed(1)} · ${c.crystals} crystal card${c.crystals === 1 ? '' : 's'}` : 'no cards yet';
    syncIndeck();
    decksMore.textContent = `${saved.length} of ${maxDecks()}`;
    renderCarousel();
    const full = saved.length >= maxDecks();
    limitMsg.textContent = full ? `You can save up to ${maxDecks()} decks.` : '';
    newBtn.disabled = full;
  }
  /** the "2/4 in deck" badge on every tile and the detail's count line follow the deck */
  function syncIndeck() {
    for (const t of cardsEl.querySelectorAll('.db-tile')) { const id = (t as HTMLElement).dataset.card!; const b = (t as any)._indeck as HTMLElement | undefined; if (!b) continue; const k = count(id); const lim = deckLimit(id); const txt = k ? (lim >= 99 ? `${k} in deck` : `${k}/${lim} in deck`) : ''; if (b.textContent !== txt) b.textContent = txt; syncTile(t); }
    syncDetailCount();
  }
  // ---- deck carousel (saved decks only, plus the "+ New Deck" slot)
  let carDrag = false;
  const baseShift = () => {
    const it = track.children[cur] as HTMLElement | undefined;
    return it ? carEl.clientWidth / 2 - (it.offsetLeft + it.offsetWidth / 2) : 0;
  };
  function place(extra = 0, animate = true) {
    track.style.transition = animate ? 'transform .25s ease' : 'none';
    track.style.transform = `translateX(${baseShift() + extra}px)`;
  }
  function setCur(i: number, load = true) {
    cur = Math.max(0, Math.min(saved.length, i));
    if (load) {
      if (cur < saved.length) {
        const d = saved[cur];
        deck = d.cards.slice(); deckTiers = d.tiers && d.tiers.length === d.cards.length ? d.tiers.slice() : []; editing = cur; name = d.name;
        cmdId = d.commander && CMD_NAMES[d.commander] ? d.commander : 'grubnak';
      } else { deck = []; deckTiers = []; editing = -1; cmdId = 'grubnak'; name = defaultName(); }
      nameTouched = false;
      fCmd.set(CMD_NAMES[cmdId]);
      status.textContent = ''; limitMsg.textContent = '';
      renderCards();
    }
    renderDeck();
  }
  function renderCarousel() {
    const items = saved.map((d, i) => { const cm = d.commander && CMD_NAMES[d.commander] ? d.commander : cmdId; const ok = deckLegal(d, cm); return h('button', { type: 'button', class: 'db-deck', 'aria-label': `${d.name}, ${d.cards.length} ${d.cards.length === 1 ? 'card' : 'cards'}`, 'aria-current': i === cur ? 'true' : null, tabindex: i === cur ? '0' : '-1', 'data-i': String(i), 'data-faction': ((COMMANDERS[d.commander || cmdId] || {}).faction || '').replace(/s$/, '').replace('dwarve', 'dwarf') },
      h('img', { class: 'deck-img', src: '/art/deck/deck-menu.png', alt: '', draggable: 'false' }), h('span', { class: 'ds-name', 'aria-hidden': 'true' }, d.name),
      h('span', { class: 'ds-sub', 'aria-hidden': 'true' }, CMD_NAMES[cm], ' · ', h('span', { class: ok ? 'ok' : 'bad' }, ok ? 'Valid' : 'Not ready'), h('span', { class: 'n' }, `${d.cards.length}`))); });
    items.push(h('button', { type: 'button', class: 'db-deck new', 'aria-label': '+ New Deck', 'aria-current': cur === saved.length ? 'true' : null, tabindex: cur === saved.length ? '0' : '-1', 'data-i': String(saved.length) },
      h('img', { class: 'deck-img', src: '/art/deck/deck-menu.png', alt: '', draggable: 'false' }), h('span', { class: 'ds-name', 'aria-hidden': 'true' }, '+ New Deck')));
    items.forEach((b, i) => {
      b.addEventListener('click', () => { if (carDrag) return; if (i !== cur) setCur(i); });
      b.addEventListener('dblclick', () => { const d = saved[i]; if (!d || carDrag) return; const cm = d.commander || cmdId; if (!deckProblems(d.cards, cm).length) startWith(d.cards, cm, d.name); });
      b.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        setCur(cur + (e.key === 'ArrowRight' ? 1 : -1));
        (track.children[cur] as HTMLElement | undefined)?.focus();
      });
    });
    track.replaceChildren(...items);
    place(0, false);
    requestAnimationFrame(() => place(0, false));
  }
  carEl.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    const sx = e.clientX;
    let moved = false;
    const mv = (m: PointerEvent) => { const dx = m.clientX - sx; if (Math.abs(dx) > 5) { moved = true; carDrag = true; } if (moved) place(dx, false); };
    const up = (m: PointerEvent) => {
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      if (moved) {
        const dx = m.clientX - sx;
        const it = track.children[0] as HTMLElement | undefined;
        const iw = (it ? (track.children[1] ? (track.children[1] as HTMLElement).offsetLeft - it.offsetLeft : it.offsetWidth) : 100) || (it ? it.offsetWidth : 100); // design D: the decks stack vertically, so a sideways drag of about a row's width is one step
        const thr = Math.min(120, iw / 2);
        if (Math.abs(dx) >= thr) { const steps = Math.max(1, Math.round(Math.abs(dx) / iw)); setCur(cur - Math.sign(dx) * steps); } else place(0, true);
        setTimeout(() => { carDrag = false; }, 0);
      }
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => place(0, false)).observe(carEl);

  function rename() {
    const input = h('input', { id: 'deck-name', type: 'text', maxlength: String(NAME_MAX) }) as HTMLInputElement;
    input.value = name;
    const apply = () => { const v = input.value.trim().slice(0, NAME_MAX); if (v) { name = v; nameTouched = true; } d.close(); renderDeck(); };
    const d: any = app.dialog('Rename deck', [h('h2', {}, 'Rename deck'), h('div', { class: 'f-field' }, h('label', { for: 'deck-name' }, 'Deck name'), input),
      h('div', { class: 'row' }, btn('OK', 'primary', apply), btn('Cancel', '', () => d.close()))]);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    input.focus(); input.select();
  }
  function save() {
    let idx = editing;
    if (idx < 0) idx = saved.findIndex((d) => d.name === name);
    if (idx < 0 && saved.length >= maxDecks()) { status.textContent = ''; limitMsg.textContent = `You can save up to ${maxDecks()} decks.`; return; }
    syncTiers();
    const rec: SavedDeck = { name, cards: deck.slice(), commander: cmdId, ...(deckTiers.some((t) => t > 1) ? { tiers: deckTiers.slice() } : {}) };
    if (net.active) {
      // server decks: the server may refuse; the edits stay on screen
      alertEl.textContent = ''; status.textContent = '';
      net.saveDeck(idx >= 0 ? saved[idx].id : undefined, rec).then(() => {
        const prevId = idx >= 0 ? saved[idx].id : undefined;
        saved = loadDecks();
        const at = prevId ? saved.findIndex((d) => d.id === prevId) : saved.length - 1;
        editing = at; cur = at; if (at >= 0) name = saved[at].name;
        status.textContent = 'Saved';
        renderDeck();
        cardsEl.setAttribute('aria-hidden', 'true');
      }, (e: any) => { alertEl.textContent = e && e.message ? e.message : 'The server refused this deck.'; });
      return;
    }
    if (idx >= 0) saved[idx] = rec; else { saved.push(rec); idx = saved.length - 1; }
    editing = idx;
    storeDecks(saved);
    status.textContent = 'Saved';
    cur = idx;
    renderDeck();
    // right after saving, the long card grid is parked out of the accessibility tree until the next interaction
    cardsEl.setAttribute('aria-hidden', 'true');
  }

  // ---- design D (Ken approved Nov 5; built Nov 6): the card detail column, the selected card
  // The old Menu Builder zones (dTitle / dFilters / dSlider / dGrid / dDecks / dList / dCount / dActions / dBack in
  // src/content/menus.json) are not used by this screen any more; a copy sits in _discontinued/menu-builder-deck-zones-nov6.json.
  let selId = '';
  let detailSeq = 0;
  let upgMod: Promise<any> | null = null;
  const RAR: Record<string, string> = { Common: 'r-Common', Uncommon: 'r-Uncommon', Rare: 'r-Rare', 'Ultra Rare': 'r-Ultra', Collector: 'r-Collector', Legendary: 'r-Legendary' };
  const detailEl = h('section', { class: 'panel db-detail', 'aria-label': 'Card detail' });
  const detailCount = h('p', { class: 'db-dcount' });
  function syncDetailCount() { if (!selId || !CARDS[selId]) return; const o = ownedOf(selId); detailCount.replaceChildren('In this deck ', h('b', {}, deckLimit(selId) >= 99 ? String(count(selId)) : `${count(selId)} / ${deckLimit(selId)}`), ...(o == null ? [] : [' · own ', h('b', {}, String(o))])); }
  const detailFace = (c: any, tier: number) => h('div', { class: `face hand-card static f-${c.faction} ${c.type}`, 'data-card-id': c.id, 'data-frame': FRAME[c.faction] || 'neutral', 'data-rarity': rarityKey(c) }, ohCardEl({ ...c, tier }, pictureOf(c)));
  function renderDetail() {
    const c = selId ? CARDS[selId] : null;
    const seq = ++detailSeq;
    if (!c) { detailEl.replaceChildren(h('div', { class: 'ptitle h' }, 'Card'), h('p', { class: 'db-dnone' }, 'Tap a card in the pool to see it here: its text, how many are in the deck' + (ownedMode() ? ', your copies and the upgrade looks.' : '.'))); return; }
    const holder = h('div', { class: 'db-dcard' }, detailFace(c, 1));
    const swap = (t: number) => { holder.replaceChildren(detailFace(c, t)); };
    const stats = c.type === 'creature' ? h('b', {}, `Attack ${c.attack} · Health ${c.health} · Move ${c.move}. `) : null;
    const words = h('div', { class: 'db-dwords' },
      h('h3', { class: 'db-dname' }, c.name),
      h('p', { class: 'db-dmeta' }, h('span', { class: 'fdot ' + c.faction, 'aria-hidden': 'true' }), `${FNAME[c.faction]} · ${kindOf(c)} · `, h('span', { class: RAR[c.rarity] || '' }, c.rarity), ` · Cost ${c.cost}`),
      h('p', { class: 'db-dtext' }, ...(stats ? [stats] : []), c.longText || c.shortText || ''),
      detailCount,
      h('div', { class: 'db-dacts' }, h('button', { type: 'button', class: 'sbtn panel', onclick: () => addCard(c.id, null, true) }, 'Add to deck'), h('button', { type: 'button', class: 'sbtn panel', onclick: () => { if (count(c.id) > 0) removeCard(c.id); } }, 'Take one out'), h('button', { type: 'button', class: 'sbtn panel', onclick: () => enlarge(c) }, 'See it large')));
    detailEl.replaceChildren(h('div', { class: 'db-dtop' }, holder, words));
    syncDetailCount();
    if (ownedMode()) {
      // signed in: the same Upgrade panel as the close-up (your copies, Combine, the five looks), inline
      upgMod ||= import('../net/upgrade-panel');
      void upgMod.then((m) => {
        if (seq !== detailSeq) return;
        const panel = m.upgradePanel(c, { pic: m.upgradePicture(c), onChange: () => { swap(panel.best()); renderCards(); renderDeck(); }, onLook: swap });
        detailEl.append(panel.el);
        void panel.load().then(() => { if (seq === detailSeq) swap(panel.best()); });
      }).catch(() => {});
    } else detailEl.append(h('p', { class: 'db-dhint' }, net.active ? 'Your copies and their upgrade looks show here once your collection has loaded.' : 'Click a card to see it here, double-click it to see it large, + to add it. Practice decks may use every card.'));
  }
  function select(id: string) {
    if (selId === id) return;
    selId = id;
    for (const t of cardsEl.querySelectorAll('.db-tile')) t.classList.toggle('sel', (t as HTMLElement).dataset.card === id);
    for (const [k, li] of (((listEl as any)._rows || new Map()) as Map<string, HTMLElement>)) li.classList.toggle('sel', k === id);
    renderDetail();
  }
  const decksMore = h('span', { class: 'more', 'aria-hidden': 'true' }, '');
  const curveNote = h('span', {}, '');
  const online = net.active;
  // left: your decks (the My decks group keeps its arrows and keys; the list stands vertically) and the deck check
  const carWrap = h('div', { class: 'db-carwrap', 'aria-label': 'My decks', role: 'group' },
    h('div', { class: 'db-carnav', style: 'display:flex;gap:.3em' }, btn('▲', 'small scroll', () => setCur(cur - 1), { 'aria-label': 'Previous deck' }), btn('▼', 'small scroll', () => setCur(cur + 1), { 'aria-label': 'Next deck' })), carEl);
  const renameBtn = online && net.under13 ? null : btn('Rename', '', rename);
  // Nov 7 (Ken: "you need to be able to name the deck inside the deck builder"): the name, editable in place, at the top of the deck column
  const kidNames = online && net.under13;
  const nameIn = h('input', { type: 'text', class: 'db-namein', 'data-testid': 'db-name', maxlength: String(NAME_MAX), 'aria-label': 'Deck name', placeholder: 'Name your deck', spellcheck: 'false', autocomplete: 'off', readonly: kidNames ? 'true' : null, title: kidNames ? 'Deck names are set for you' : 'Click to rename this deck' }) as HTMLInputElement;
  nameIn.addEventListener('input', () => { const v = nameIn.value.slice(0, NAME_MAX).trim(); if (v) { name = v; nameTouched = true; nameEl.textContent = name; } });
  nameIn.addEventListener('change', () => { if (!nameIn.value.trim()) nameIn.value = name; renderDeck(); });
  nameIn.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); nameIn.blur(); } else if (e.key === 'Escape') { nameIn.value = name; nameIn.blur(); } });
  const nameRow = h('label', { class: 'db-namerow' }, h('span', { class: 'f-label' }, 'Deck name'), nameIn, kidNames ? null : h('span', { class: 'db-namepen', 'aria-hidden': 'true' }, '✎'));
  const actsL = h('div', { class: 'row db-actions db-acts-l' }, newBtn, ...(renameBtn ? [renameBtn] : []));
  const limits = CONFIG.copyLimits || {};
  const rulesP = h('p', { class: 'db-rules' }, h('b', {}, `${CONFIG.deckMin} to ${CONFIG.deckMax} cards`), ', one Commander. Up to ', h('b', {}, `${limits.Rare ?? 3} copies`), ' of each Rare, Ultra Rare and Collector card. Up to ', h('b', {}, `${CONFIG.crystalCardLimit} crystal cards`), '. Online, a deck only uses copies ', h('b', {}, 'you own'), '.');
  // middle: the card pool
  const rowLab = h('label', { for: 'cards-per-row' }, 'Cards per row');
  const filtersEl = h('div', { class: 'db-filters' }, fF.wrap, fT.wrap, fC.wrap, fR.wrap, h('div', { class: 'f-field db-rowfield' }, rowLab, slider));
  // right: the deck (the Deck pile keeps the deck image, the name and the size), the Commander, the curve, the list, Save
  pileEl.append(h('img', { class: 'deck-img db-pileimg', src: '/art/deck/deck-menu.png', alt: '', draggable: 'false' }), h('div', { class: 'db-pilewords' }, nameEl, sizeEl));
  const listWrap = h('div', { class: 'db-listwrap' }, h('div', { class: 'db-sub' }, 'Crystal curve', curveNote), chartEl, h('div', { class: 'db-deck-list', 'aria-label': 'Deck list', role: 'group' }, h('h2', {}, 'Deck list'), listEl));
  const actsR = h('div', { class: 'row db-actions db-acts-r' }, btn('Auto-fill', '', () => { deck = autoFill(deck, COMMANDERS[cmdId].faction); status.textContent = ''; renderDeck(); }), playBtn);
  const saveBtn = h('button', { type: 'button', class: 'btn panel play db-save', 'aria-label': 'Save', onclick: save }, h('img', { src: '/art/ui/silver/icon-deck.webp', alt: '', draggable: 'false' }), 'Save deck');
  // the shell: top bar (online), header with Back / ‹ Dashboard, the phone tabs
  const title = h('h1', { class: 'h ttl db-title' }, 'Deck Builder');
  const backBtn = btn(opts.onBack ? '\u2039 Back' : online ? '‹ Dashboard' : 'Back', 'panel back-btn db-back', () => (opts.onBack ? opts.onBack() : app.showMenu())); // Nov 7: from the deck picker, back to it
  const ptabs = h('div', { class: 'db-ptabs', role: 'group', 'aria-label': 'Deck Builder panels' }, ...[['decks', 'Decks'], ['cards', 'Cards'], ['list', 'List']].map(([k, l]) => h('button', { type: 'button', class: 'sbtn panel db-ptab', 'aria-pressed': String(k === 'cards'), 'data-tab': k, onclick: () => { mainEl.dataset.ptab = k; for (const b of ptabs.querySelectorAll('.db-ptab')) b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.tab === k)); } }, l)));
  const top = h('div', { class: 'top', 'aria-hidden': 'true' });
  const mainEl = h('main', { class: 'screen dash deck-d' + (online ? '' : ' offline'), 'data-screen': 'deck-builder', 'data-ptab': 'cards' },
    top, h('div', { class: 'logo', 'aria-hidden': 'true' }),
    h('div', { class: 'hdr' }, backBtn, title, h('div', { class: 'info' }, 'Pick a deck, add cards from the pool, then save.'), ptabs),
    h('div', { class: 'main' },
      h('div', { class: 'col dd-left' },
        h('section', { class: 'panel db-decksbox', 'aria-label': 'Your decks' }, h('div', { class: 'ptitle h' }, 'Your decks', decksMore), carWrap, actsL),
        h('section', { class: 'panel db-check', 'aria-label': 'Deck check' }, h('div', { class: 'ptitle h' }, 'Deck check'), probEl, countsEl, h('div', { class: 'db-sub' }, 'Deck rules'), rulesP)),
      h('section', { class: 'panel db-pool', 'aria-label': 'Card pool' }, h('div', { class: 'ptitle h' }, 'Card pool', poolMore), filtersEl, h('div', { class: 'db-sline' }, searchInp, ...(voiceBtn ? [voiceBtn] : [])), cardsEl),
      detailEl,
      h('section', { class: 'panel dd-right', 'aria-label': 'Deck' }, nameRow, pileEl, h('div', { class: 'db-cmdrow' }, h('span', { class: 'f-label', 'aria-hidden': 'true' }, 'Commander'), cmdWrap), listWrap, actsR, saveBtn, h('p', { class: 'db-msgs' }, status, limitMsg, alertEl))));
  app.root.append(mainEl);
  if (online) void import('../net/dashboard').then((m) => m.loadAll().then((d) => { if (top.isConnected) { const t = m.topBar(d); t.setAttribute('aria-hidden', 'true'); top.replaceWith(t); } })).catch(() => {});
  const wake = () => cardsEl.removeAttribute('aria-hidden');
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'change', 'focusin']) mainEl.addEventListener(ev, wake);
  setCur(opts.focus != null && opts.focus >= 0 && opts.focus < saved.length ? opts.focus : saved.length);
  requestAnimationFrame(fitRow);
  // Nov 7: signed in, the copies you own load here (the D Dashboard skipped the old menu that loaded them, so the builder thought every
  // card was free: nothing greyed, cards you don't own could go in, and the close-up showed the 3D model instead of your copies)
  if (online) void import('../net/economy').then((m) => m.refreshOwned()).then((got) => { if (!got || !mainEl.isConnected) return; renderCards(); renderDeck(); renderDetail(); }).catch(() => {});
}
