// Testing deck builder: every card unlocked and unlimited; up to 5 decks saved on the device.
import { CARDS, FACTIONS, COMMANDERS, CONFIG, isMiner, deckCounts, deckProblems, basicMiner } from '../engine';
import { h, btn, combo, App, faceKids, rarityKey, FRAME } from './app';

export interface SavedDeck { name: string; cards: string[]; commander?: string }
const CMD_NAMES: Record<string, string> = { grubnak: 'Grubnak', sproingle: 'Sproingle', borgo: 'Borgo' };
const CMD_BY_NAME: Record<string, string> = { Grubnak: 'grubnak', Sproingle: 'sproingle', Borgo: 'borgo' };
const KEY = 'oreheart.decks';
const MAX_DECKS = 5;

export function loadDecks(): SavedDeck[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((d) => d && typeof d.name === 'string' && Array.isArray(d.cards)).slice(0, MAX_DECKS) : [];
  } catch { return []; }
}
function storeDecks(d: SavedDeck[]) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage unavailable */ } }
/** The faction most of a deck's creatures belong to: it decides which faction spells the deck may hold. */
export function deckMainFaction(ids: string[]): string | undefined {
  const t: Record<string, number> = {};
  for (const id of ids) { const c = CARDS[id]; if (c && c.type === 'creature' && c.faction !== 'any') t[c.faction] = (t[c.faction] || 0) + 1; }
  return Object.keys(t).sort((a, b) => t[b] - t[a])[0];
}
export const deckLegal = (d: SavedDeck, commander?: string) => d.cards.every((id) => CARDS[id]) && deckProblems(d.cards, commander).length === 0;

const ORDER = ['goblins', 'gnomes', 'dwarves', 'any'];
const ALL = (Object.values(CARDS) as any[]).slice().sort((a, b) => {
  const t = (c: any) => (c.type === 'creature' ? 0 : c.type === 'spell' ? 1 : 2);
  return t(a) - t(b) || ORDER.indexOf(a.faction) - ORDER.indexOf(b.faction) || a.cost - b.cost || a.name.localeCompare(b.name);
});
const SING: Record<string, string> = { goblins: 'Goblin', gnomes: 'Gnome', dwarves: 'Dwarf' };
const FNAME: Record<string, string> = { goblins: 'Goblins', gnomes: 'Gnomes', dwarves: 'Dwarves', any: 'Neutral' };
const FSYMS: Record<string, string> = { goblins: '💀', gnomes: '⚙️', dwarves: '🔨', any: '✦' };

export const copyLimit = (id: string): number => CONFIG.copyLimits[CARDS[id]?.rarity] ?? (CARDS[id]?.type === 'crystal' ? 99 : 99);
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
  const hay = [c.name, c.shortText, c.longText, ab.join(' '), FNAME[c.faction], c.role || '', c.type, c.rarity, c.spellKind || '', String(c.cost)].join(' ').toLowerCase();
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
  const add = (id: string, cap: number) => { if (room() > 0 && count(id) < Math.min(cap, copyLimit(id))) { out.push(id); return true; } return false; };
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

export function showDecks(app: App) {
  app.clear();
  let saved = loadDecks();
  let deck: string[] = [];
  let editing = -1;
  const defaultName = () => { for (let i = 1; ; i++) if (!saved.some((d) => d.name === `Deck ${i}`)) return `Deck ${i}`; };
  let name = defaultName();

  const sel = (label: string, id: string, opts: string[]) => combo(label, id, opts, () => renderCards());
  const fF = sel('Faction', 'f-faction', ['All', 'Goblins', 'Gnomes', 'Dwarves', 'Neutral']);
  const fT = sel('Type', 'f-type', ['All', 'Miners', 'Fighters', 'Spells', 'Crystal cards']);
  const fC = sel('Cost', 'f-cost', ['Any', '1-2', '3-4', '5-6', '7+']);
  const fR = sel('Rarity', 'f-rarity', ['All', 'Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Collector']);
  let cmdId = 'grubnak';
  const fCmd = combo('Deck Commander', 'f-commander', ['Grubnak', 'Sproingle', 'Borgo'], () => { cmdId = CMD_BY_NAME[fCmd.sel.value] || 'grubnak'; renderCards(); renderDeck(); });
  let query = '';
  let perRow = Math.max(1, Math.min(8, parseInt(localStorage.getItem('oreheart.cardsPerRow') || '4', 10) || 4));
  const cardsEl = h('div', { class: 'db-cards', 'aria-label': 'All cards', role: 'group' });
  const pileEl = h('div', { class: 'db-pile', 'aria-label': 'Deck pile', role: 'group' });
  const listEl = h('ul', { class: 'db-list', 'aria-label': 'Deck list' });
  const countsEl = h('p', { class: 'db-counts', 'aria-label': 'Deck counts' });
  const chartEl = h('div', { class: 'db-chart', 'aria-label': 'Cost chart', role: 'group' });
  const probEl = h('ul', { class: 'db-problems', 'aria-label': 'Deck problems' });
  const mineEl = h('ul', { class: 'db-mine', 'aria-label': 'My decks' });
  const status = h('p', { class: 'db-status', role: 'status' });
  const limitMsg = h('p', { class: 'db-status' });
  const newBtn = btn('New Deck', '', () => { deck = []; editing = -1; cmdId = 'grubnak'; fCmd.set('Grubnak'); renderCards(); name = defaultName(); status.textContent = ''; renderDeck(); }) as HTMLButtonElement;

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
    if (r !== 'All' && c.rarity !== r) return false;
    return true;
  };
  const count = (id: string) => deck.filter((x) => x === id).length;
  const fly = (id: string, from?: DOMRect | null) => {
    const src = from || (cardsEl.querySelector(`[data-card="${id}"]`) as HTMLElement | null)?.getBoundingClientRect();
    if (!src) return;
    const ghost = cardFace(CARDS[id]); ghost.classList.add('db-fly');
    ghost.style.setProperty('--cw', src.width + 'px');
    ghost.style.left = src.left + 'px'; ghost.style.top = src.top + 'px';
    document.body.append(ghost);
    const to = pileEl.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (src.left + src.width / 2), dy = to.top + to.height / 2 - (src.top + src.height / 2);
    const a = ghost.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: 0.3 }], { duration: 380, easing: 'ease-in' });
    a.onfinish = () => ghost.remove();
    setTimeout(() => ghost.remove(), 700);
  };
  const lockedFor = (id: string) => { const c = CARDS[id]; return c.type === 'spell' && c.faction !== 'any' && c.faction !== COMMANDERS[cmdId].faction; };
  const addCard = (id: string, from?: DOMRect | null) => { if (lockedFor(id)) { status.textContent = `Only for ${SING[CARDS[id].faction]} Commanders`; return; } if (count(id) >= copyLimit(id)) return; fly(id, from); deck.push(id); status.textContent = ''; renderDeck(); };
  const removeCard = (id: string) => { const i = deck.indexOf(id); if (i >= 0) deck.splice(i, 1); status.textContent = ''; renderDeck(); };

  function enlarge(c: any) { app.showCard(c.id); }
  function drag(e: PointerEvent, c: any, el: HTMLElement) {
    if (e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    let ghost: HTMLElement | null = null;
    const over = (x: number, y: number) => { const r = pileEl.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
    const mv = (m: PointerEvent) => {
      if (!ghost && Math.hypot(m.clientX - sx, m.clientY - sy) > 8) {
        ghost = cardFace(c); ghost.classList.add('ghost'); document.body.append(ghost);
        (el as any)._dragged = true;
      }
      if (ghost) { ghost.style.left = m.clientX + 'px'; ghost.style.top = m.clientY + 'px'; pileEl.classList.toggle('hot', over(m.clientX, m.clientY)); }
    };
    const up = (m: PointerEvent) => {
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      if (ghost) { ghost.remove(); pileEl.classList.remove('hot'); if (m.type === 'pointerup' && over(m.clientX, m.clientY)) addCard(c.id, new DOMRect(m.clientX - 30, m.clientY - 45, 60, 90)); setTimeout(() => { (el as any)._dragged = false; }, 50); }
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }
  function tile(c: any) {
    const el = h('div', { class: 'db-tile' + (lockedFor(c.id) ? ' locked' : ''), 'aria-disabled': lockedFor(c.id) ? 'true' : null, role: 'button', tabindex: '0', 'aria-label': c.name, 'data-card': c.id }, cardFace(c), lockedFor(c.id) ? h('span', { class: 'lock-hint' }, '🔒 Only for ' + SING[c.faction] + ' Commanders') : null, h('span', { hidden: '' }, c.longText || '')) as any;
    let timer: any = null;
    el.addEventListener('click', () => {
      if (el._dragged) return;
      if (timer) { clearTimeout(timer); timer = null; addCard(c.id); return; }
      timer = setTimeout(() => { timer = null; enlarge(c); }, 300);
    });
    el.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enlarge(c); } });
    el.addEventListener('pointerdown', (e: PointerEvent) => drag(e, c, el));
    return el;
  }
  function fitRow() {
    cardsEl.style.gridTemplateColumns = `repeat(${perRow},minmax(0,1fr))`;
    const w = cardsEl.clientWidth || (app.root as HTMLElement).clientWidth * 0.6;
    cardsEl.style.setProperty('--cw', Math.max(40, (w - 8 - (perRow - 1) * 10) / perRow) + 'px');
  }
  function setPerRow(n: number) {
    perRow = Math.max(1, Math.min(8, Math.round(n)));
    try { localStorage.setItem('oreheart.cardsPerRow', String(perRow)); } catch { /* storage unavailable */ }
    slider.value = String(perRow);
    fitRow();
  }
  function renderCards() { cardsEl.replaceChildren(...ALL.filter((c) => !c.disabled && matches(c)).map(tile)); fitRow(); }
  const slider = h('input', { type: 'range', id: 'cards-per-row', min: '1', max: '8', step: '1', value: String(perRow) }) as HTMLInputElement;
  slider.addEventListener('input', () => setPerRow(+slider.value));
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
  // cards tilt slightly toward the pointer
  cardsEl.addEventListener('pointermove', (e: PointerEvent) => {
    const r = cardsEl.getBoundingClientRect();
    cardsEl.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 4).toFixed(2) + 'deg');
    cardsEl.style.setProperty('--rx', ((0.5 - (e.clientY - r.top) / Math.max(1, r.height)) * 2).toFixed(2) + 'deg');
  });

  function renderDeck() {
    const n: Record<string, number> = {};
    for (const id of deck) n[id] = (n[id] || 0) + 1;
    const ids = Object.keys(n).sort((a, b) => CARDS[a].cost - CARDS[b].cost || CARDS[a].name.localeCompare(CARDS[b].name));
    listEl.replaceChildren(...ids.map((id) => {
      const nm = CARDS[id].name;
      const plus = btn('+', 'small', () => addCard(id), { 'aria-label': `Add ${nm}` }) as HTMLButtonElement;
      plus.disabled = n[id] >= copyLimit(id);
      return h('li', {}, h('span', {}, `${n[id]} × ${nm}`), plus, btn('−', 'small', () => removeCard(id), { 'aria-label': `Remove ${nm}` }));
    }));
    const c = deckCounts(deck);
    pileEl.replaceChildren(h('img', { class: 'deck-img', src: '/art/deck/deck-image.webp', alt: '', draggable: 'false' }), h('div', { class: 'pile-top' }, h('strong', {}, name), h('span', { class: 'pile-n' }, `${c.cards} cards (${CONFIG.deckMin}–${CONFIG.deckMax})`)));
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
    mineEl.replaceChildren(...saved.map((d, i) => {
      const legal = deckLegal(d, d.commander || 'grubnak');
      return h('li', {},
        btn(`${d.name} — ${d.cards.length} cards, ${legal ? 'legal' : 'not legal'}`, '', () => { deck = d.cards.slice(); editing = i; name = d.name; cmdId = d.commander && CMD_NAMES[d.commander] ? d.commander : 'grubnak'; fCmd.set(CMD_NAMES[cmdId]); renderCards(); status.textContent = ''; renderDeck(); }),
        btn('Delete', 'small', () => confirmDelete(i), { 'aria-label': `Delete ${d.name}` }));
    }));
    const full = saved.length >= MAX_DECKS;
    newBtn.disabled = full;
    limitMsg.textContent = full ? 'You can save up to 5 decks.' : '';
  }
  function confirmDelete(i: number) {
    const d: any = app.dialog('Delete this deck?', [h('h2', {}, 'Delete this deck?'), h('p', { style: 'text-align:center' }, saved[i].name),
      h('div', { class: 'row' },
        btn('Delete', 'primary', () => {
          saved.splice(i, 1); storeDecks(saved); d.close();
          if (editing === i) editing = -1; else if (editing > i) editing--;
          renderDeck();
        }),
        btn('Cancel', '', () => d.close()))]);
  }
  function rename() {
    const input = h('input', { id: 'deck-name', type: 'text', maxlength: '30' }) as HTMLInputElement;
    input.value = name;
    const apply = () => { name = input.value.trim() || name; d.close(); renderDeck(); };
    const d: any = app.dialog('Rename deck', [h('h2', {}, 'Rename deck'), h('div', { class: 'f-field' }, h('label', { for: 'deck-name' }, 'Deck name'), input),
      h('div', { class: 'row' }, btn('OK', 'primary', apply), btn('Cancel', '', () => d.close()))]);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    input.focus(); input.select();
  }
  function save() {
    let idx = editing;
    if (idx < 0) idx = saved.findIndex((d) => d.name === name);
    if (idx < 0 && saved.length >= MAX_DECKS) { status.textContent = ''; limitMsg.textContent = 'You can save up to 5 decks.'; return; }
    const rec = { name, cards: deck.slice(), commander: cmdId };
    if (idx >= 0) saved[idx] = rec; else { saved.push(rec); idx = saved.length - 1; }
    editing = idx;
    storeDecks(saved);
    status.textContent = 'Saved';
    renderDeck();
    // right after saving, the long card grid is parked out of the accessibility tree until the next interaction
    cardsEl.setAttribute('aria-hidden', 'true');
  }

  const pileWrap = h('div', { class: 'db-pilewrap' }, pileEl, h('p', { class: 'hint' }, 'Drag a card here, or double-click it.'));
  app.root.append(h('main', { class: 'screen db-screen' },
    h('img', { class: 'db-logo', src: '/art/logo.webp', alt: 'Oreheart', draggable: 'false' }),
    h('h1', { class: 'section cinzel' }, 'Deck Builder'),
    h('div', { class: 'db-search' }, searchInp, ...(voiceBtn ? [voiceBtn] : []), h('div', { class: 'f-field' }, h('label', { for: 'cards-per-row' }, 'Cards per row'), slider)),
    h('div', { class: 'db-filters' }, fCmd.wrap, fF.wrap, fT.wrap, fC.wrap, fR.wrap),
    h('div', { class: 'db-cols' },
      h('section', { class: 'db-left' }, h('h2', {}, 'All cards'), cardsEl),
      h('section', { class: 'db-right' },
        pileWrap, countsEl, chartEl, probEl,
        h('div', { class: 'row' }, btn('Auto-fill', '', () => { deck = autoFill(deck, COMMANDERS[cmdId].faction); status.textContent = ''; renderDeck(); }), btn('Save', 'primary', save), btn('Rename', '', rename), newBtn),
        status, limitMsg,
        h('h2', {}, 'Deck list'), listEl,
        h('h2', {}, 'My decks'), mineEl,
        btn('Back', '', () => app.showMenu())))));
  const screen = app.root.querySelector('.db-screen') as HTMLElement;
  const wake = () => cardsEl.removeAttribute('aria-hidden');
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'change', 'focusin']) screen.addEventListener(ev, wake);
  renderCards();
  renderDeck();
  requestAnimationFrame(fitRow);
}
