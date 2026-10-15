// Testing deck builder: every card unlocked and unlimited; up to 5 decks saved on the device.
import { CARDS, FACTIONS, CONFIG, isMiner, deckCounts, deckProblems, basicMiner } from '../engine';
import { h, btn, App } from './app';

export interface SavedDeck { name: string; cards: string[] }
const KEY = 'oreheart.decks';
const MAX_DECKS = 5;

export function loadDecks(): SavedDeck[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((d) => d && typeof d.name === 'string' && Array.isArray(d.cards)).slice(0, MAX_DECKS) : [];
  } catch { return []; }
}
function storeDecks(d: SavedDeck[]) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage unavailable */ } }
export const deckLegal = (d: SavedDeck) => d.cards.every((id) => CARDS[id]) && deckProblems(d.cards).length === 0;

const ORDER = ['goblins', 'gnomes', 'dwarves', 'any'];
const ALL = (Object.values(CARDS) as any[]).slice().sort((a, b) => {
  const t = (c: any) => (c.type === 'creature' ? 0 : c.type === 'spell' ? 1 : 2);
  return t(a) - t(b) || ORDER.indexOf(a.faction) - ORDER.indexOf(b.faction) || a.cost - b.cost || a.name.localeCompare(b.name);
});
const FNAME: Record<string, string> = { goblins: 'Goblins', gnomes: 'Gnomes', dwarves: 'Dwarves', any: 'Neutral' };
const FSYMS: Record<string, string> = { goblins: '💀', gnomes: '⚙️', dwarves: '🔨', any: '✦' };

export const copyLimit = (id: string): number => CONFIG.copyLimits[CARDS[id]?.rarity] ?? (CARDS[id]?.type === 'crystal' ? 99 : 99);
const kindOf = (c: any) => (c.type === 'creature' ? (c.role === 'Smith' ? 'Smith Miner' : isMiner(c) ? 'Miner' : 'Fighter') : c.type === 'spell' ? 'Spell' : 'Crystal card');

/** A real card face: cost, name, art, stats, rarity, role and the complete ability text. */
export function cardFace(c: any, big = false) {
  const cr = c.type === 'creature';
  const pic = c.type === 'creature' && c.faction === 'goblins' ? `/art/cards/${c.id}.webp` : null;
  return h('div', { class: `face f-${c.faction} ${c.type}${big ? ' big' : ''}`, 'data-card-id': c.id, 'data-rarity': ({ Common: 'common', Uncommon: 'uncommon', Rare: 'rare', 'Ultra Rare': 'ultra-rare', Collector: 'collector' } as any)[c.rarity] || 'common' },
    h('span', { class: 'fc-cost' }, c.type === 'crystal' ? '◆' : String(c.cost)),
    h('strong', { class: 'fc-name' }, c.name),
    pic ? h('img', { class: 'fc-pic', src: pic, alt: '' }) : h('span', { class: 'fc-art' }, cr ? (isMiner(c) ? (c.role === 'Smith' ? '⚒️' : '⛏️') : '⚔️') : c.type === 'spell' ? '✨' : '💎', h('small', {}, FSYMS[c.faction])),
    cr ? h('span', { class: 'fc-stats' }, `⚔️${c.attack}${c.abilities?.includes('ranged') ? '🏹' : ''} ❤️${c.health} 👟${c.move}`) : null,
    h('span', { class: 'fc-meta' }, `${kindOf(c)} · ${c.rarity}`),
    h('span', { class: 'fc-text' }, c.text || ''),
    big ? h('span', { class: 'fc-flavor' }, c.tagline + ' — ' + c.flavor) : null);
}

/** Completes `deck` to exactly 50 cards without removing anything (R9.1). */
export function autoFill(deck: string[]): string[] {
  const out = deck.slice();
  const n = () => { const m: Record<string, number> = {}; for (const id of out) m[id] = (m[id] || 0) + 1; return m; };
  const room = () => CONFIG.deckSize - out.length;
  const count = (id: string) => n()[id] || 0;
  const tally: Record<string, number> = {};
  for (const id of out) if (CARDS[id].type === 'creature' && CARDS[id].faction !== 'any') tally[CARDS[id].faction] = (tally[CARDS[id].faction] || 0) + 1;
  const main = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || 'goblins';
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

  const sel = (label: string, id: string, opts: string[]) => {
    const s = h('select', { id, onchange: () => renderCards() }, ...opts.map((o) => h('option', { value: o }, o))) as HTMLSelectElement;
    return { wrap: h('div', { class: 'f-field' }, h('label', { for: id }, label), s), sel: s };
  };
  const fF = sel('Faction', 'f-faction', ['All', 'Goblins', 'Gnomes', 'Dwarves', 'Neutral']);
  const fT = sel('Type', 'f-type', ['All', 'Miners', 'Fighters', 'Spells', 'Crystal cards']);
  const fC = sel('Cost', 'f-cost', ['Any', '1-2', '3-4', '5-6', '7+']);
  const fR = sel('Rarity', 'f-rarity', ['All', 'Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Collector']);
  const cardsEl = h('div', { class: 'db-cards', 'aria-label': 'All cards', role: 'group' });
  const pileEl = h('div', { class: 'db-pile', 'aria-label': 'Deck pile', role: 'group' });
  const listEl = h('ul', { class: 'db-list', 'aria-label': 'Deck list' });
  const countsEl = h('p', { class: 'db-counts', 'aria-label': 'Deck counts' });
  const chartEl = h('div', { class: 'db-chart', 'aria-label': 'Cost chart', role: 'group' });
  const probEl = h('ul', { class: 'db-problems', 'aria-label': 'Deck problems' });
  const mineEl = h('ul', { class: 'db-mine', 'aria-label': 'My decks' });
  const status = h('p', { class: 'db-status', role: 'status' });
  const limitMsg = h('p', { class: 'db-status' });
  const newBtn = btn('New Deck', '', () => { deck = []; editing = -1; name = defaultName(); status.textContent = ''; renderDeck(); }) as HTMLButtonElement;

  const matches = (c: any) => {
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
  const addCard = (id: string) => { if (count(id) >= copyLimit(id)) return; deck.push(id); status.textContent = ''; renderDeck(); };
  const removeCard = (id: string) => { const i = deck.indexOf(id); if (i >= 0) deck.splice(i, 1); status.textContent = ''; renderDeck(); };

  function enlarge(c: any) {
    const d: any = app.dialog(c.name, [h('div', { class: 'db-enlarged' }, cardFace(c, true)), h('div', { class: 'row' }, btn('Close', 'primary', () => d.close()))]);
  }
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
      if (ghost) { ghost.remove(); pileEl.classList.remove('hot'); if (m.type === 'pointerup' && over(m.clientX, m.clientY)) addCard(c.id); setTimeout(() => { (el as any)._dragged = false; }, 50); }
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  }
  function tile(c: any) {
    const el = h('div', { class: 'db-tile', role: 'button', tabindex: '0', 'aria-label': c.name, 'data-card': c.id }, cardFace(c)) as any;
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
  function renderCards() { cardsEl.replaceChildren(...ALL.filter(matches).map(tile)); }

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
    pileEl.replaceChildren(h('div', { class: 'pile-top' }, h('strong', {}, name), h('span', { class: 'pile-n' }, `${c.cards}/${CONFIG.deckSize}`)));
    countsEl.textContent = `Cards: ${c.cards}/${CONFIG.deckSize} · Creatures: ${c.creatures} · Spells: ${c.spells} · Crystal cards: ${c.crystals}`;
    const buckets = [1, 2, 3, 4, 5, 6, 7].map((k) => deck.filter((id) => CARDS[id].type !== 'crystal' && (k === 7 ? CARDS[id].cost >= 7 : CARDS[id].cost === k)).length);
    const mx = Math.max(4, ...buckets);
    chartEl.replaceChildren(...buckets.map((v, i) => {
      const lab = i === 6 ? '7+' : String(i + 1);
      return h('div', { class: 'bar-col' }, h('span', { class: 'bar-n', 'aria-hidden': 'true' }, String(v)),
        h('div', { class: 'bar', role: 'img', 'aria-label': `Cost ${lab}: ${v} ${v === 1 ? 'card' : 'cards'}`, style: `height:${Math.round((v / mx) * 100)}%` }),
        h('span', { class: 'bar-l', 'aria-hidden': 'true' }, lab));
    }));
    const p = deckProblems(deck);
    probEl.replaceChildren(...(p.length ? p : ['Deck is legal']).map((m) => h('li', { class: p.length ? 'bad' : 'good' }, m)));
    mineEl.replaceChildren(...saved.map((d, i) => {
      const legal = deckLegal(d);
      return h('li', {},
        btn(`${d.name} — ${d.cards.length}/${CONFIG.deckSize}, ${legal ? 'legal' : 'not legal'}`, '', () => { deck = d.cards.slice(); editing = i; name = d.name; status.textContent = ''; renderDeck(); }),
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
    const rec = { name, cards: deck.slice() };
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
    h('h1', { class: 'section cinzel' }, 'Deck Builder'),
    h('div', { class: 'db-filters' }, fF.wrap, fT.wrap, fC.wrap, fR.wrap),
    h('div', { class: 'db-cols' },
      h('section', { class: 'db-left' }, h('h2', {}, 'All cards'), cardsEl),
      h('section', { class: 'db-right' },
        pileWrap, countsEl, chartEl, probEl,
        h('div', { class: 'row' }, btn('Auto-fill', '', () => { deck = autoFill(deck); status.textContent = ''; renderDeck(); }), btn('Save', 'primary', save), btn('Rename', '', rename), newBtn),
        status, limitMsg,
        h('h2', {}, 'Deck list'), listEl,
        h('h2', {}, 'My decks'), mineEl,
        btn('Back', '', () => app.showMenu())))));
  const screen = app.root.querySelector('.db-screen') as HTMLElement;
  const wake = () => cardsEl.removeAttribute('aria-hidden');
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'change', 'focusin']) screen.addEventListener(ev, wake);
  renderCards();
  renderDeck();
}
