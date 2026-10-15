// Testing deck builder: every card unlocked and unlimited; up to 5 decks saved on the device.
import { CARDS, FACTIONS, CONFIG, isMiner, deckCounts, deckProblems } from '../engine';
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

function select(label: string, id: string, opts: string[], onchange: () => void) {
  const s = h('select', { id, onchange }, ...opts.map((o) => h('option', { value: o }, o))) as HTMLSelectElement;
  return { wrap: h('div', { class: 'f-field' }, h('label', { for: id }, label), s), sel: s };
}

export function showDecks(app: App) {
  app.clear();
  let saved = loadDecks();
  let deck: string[] = [];
  let editing = -1;

  const fF = select('Faction', 'f-faction', ['All', 'Goblins', 'Gnomes', 'Dwarves', 'Neutral'], () => renderCards());
  const fT = select('Type', 'f-type', ['All', 'Miners', 'Fighters', 'Spells', 'Crystal cards'], () => renderCards());
  const fC = select('Cost', 'f-cost', ['Any', '1-2', '3-4', '5-6', '7+'], () => renderCards());
  const fR = select('Rarity', 'f-rarity', ['All', 'Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Collector'], () => renderCards());
  const nb = (t: string) => t.replace(/back/gi, (m) => m.slice(0, 3) + ' ' + m.slice(3));
  const cardsEl = h('div', { class: 'db-cards', 'aria-label': 'All cards', role: 'group' });
  const listEl = h('ul', { class: 'db-list', 'aria-label': 'Deck list' });
  const countsEl = h('p', { class: 'db-counts', 'aria-label': 'Deck counts' });
  const probEl = h('ul', { class: 'db-problems', 'aria-label': 'Deck problems' });
  const mineEl = h('ul', { class: 'db-mine', 'aria-label': 'My decks' });
  const status = h('p', { class: 'db-status', role: 'status' });
  const limitMsg = h('p', { class: 'db-status' });
  const nameIn = h('input', { id: 'deck-name', type: 'text', maxlength: '30' }) as HTMLInputElement;
  const newBtn = btn('New Deck', '', () => { deck = []; editing = -1; nameIn.value = defaultName(); status.textContent = ''; renderDeck(); }) as HTMLButtonElement;
  const defaultName = () => { for (let i = 1; ; i++) if (!saved.some((d) => d.name === `Deck ${i}`)) return `Deck ${i}`; };
  nameIn.value = defaultName();

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

  function tile(c: any) {
    const cr = c.type === 'creature';
    const kind = cr ? (c.role === 'Smith' ? 'Smith Miner' : isMiner(c) ? 'Miner' : 'Fighter') : c.type === 'spell' ? 'Spell' : 'Crystal card';
    return h('article', { class: `db-tile f-${c.faction} ${c.type}` },
      h('div', { class: 'db-top' }, h('span', { class: 'db-cost' }, c.type === 'crystal' ? '◆' : String(c.cost)), h('strong', {}, c.name)),
      h('div', { class: 'db-meta' }, `${FNAME[c.faction]} · ${kind} · ${c.rarity}`, c.unique ? ' · ' : '', c.unique ? h('span', { class: 'db-unique' }, 'Unique') : null),
      cr ? h('div', { class: 'db-stats' }, `⚔️${c.attack} ❤️${c.health} 👟${c.move}`) : null,
      h('p', { class: 'tx' }, c.text || ''),
      btn('Add', 'small', () => { deck.push(c.id); status.textContent = ''; renderDeck(); }, { 'aria-label': `Add ${nb(c.name)}` }));
  }
  function renderCards() { cardsEl.replaceChildren(...ALL.filter(matches).map(tile)); }

  function renderDeck() {
    const n: Record<string, number> = {};
    for (const id of deck) n[id] = (n[id] || 0) + 1;
    listEl.replaceChildren(...Object.keys(n).map((id) => h('li', {}, h('span', {}, `${n[id]}× ${CARDS[id].name}`), btn('−', 'small', () => { deck.splice(deck.indexOf(id), 1); status.textContent = ''; renderDeck(); }, { 'aria-label': `Remove ${nb(CARDS[id].name)}` }))));
    const c = deckCounts(deck);
    countsEl.textContent = `Cards: ${c.cards}/${CONFIG.deckSize} · Creatures: ${c.creatures} · Spells: ${c.spells} · Crystal cards: ${c.crystals}`;
    const p = deckProblems(deck);
    probEl.replaceChildren(...(p.length ? p : ['Deck is legal']).map((m) => h('li', { class: p.length ? 'bad' : 'good' }, m)));
    mineEl.replaceChildren(...saved.map((d, i) => {
      const legal = deckLegal(d);
      return h('li', {},
        btn(`${d.name} — ${d.cards.length}/${CONFIG.deckSize}, ${legal ? 'legal' : 'not legal'}`, '', () => { deck = d.cards.slice(); editing = i; nameIn.value = d.name; status.textContent = ''; renderDeck(); }),
        btn('Delete', 'small', () => confirmDelete(i), { 'aria-label': `Delete ${nb(d.name)}` }));
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
  function save() {
    const name = nameIn.value.trim() || defaultName();
    let idx = editing;
    if (idx < 0) {
      const same = saved.findIndex((d) => d.name === name);
      idx = same;
    }
    if (idx < 0 && saved.length >= MAX_DECKS) { status.textContent = ''; limitMsg.textContent = 'You can save up to 5 decks.'; return; }
    const rec = { name, cards: deck.slice() };
    if (idx >= 0) saved[idx] = rec; else { saved.push(rec); idx = saved.length - 1; }
    editing = idx;
    storeDecks(saved);
    status.textContent = 'Saved';
    renderDeck();
  }

  app.root.append(h('main', { class: 'screen db-screen' },
    h('h1', { class: 'section cinzel' }, 'Deck Builder'),
    h('div', { class: 'db-filters' }, fF.wrap, fT.wrap, fC.wrap, fR.wrap),
    h('div', { class: 'db-cols' },
      h('section', { class: 'db-left' }, h('h2', {}, 'All cards'), cardsEl),
      h('section', { class: 'db-right' },
        h('h2', {}, 'Your deck'), countsEl, probEl, listEl,
        h('div', { class: 'f-field' }, h('label', { for: 'deck-name' }, 'Deck name'), nameIn),
        h('div', { class: 'row' }, btn('Save Deck', 'primary', save), newBtn),
        status, limitMsg,
        h('h2', {}, 'My decks'), mineEl,
        btn('Back', '', () => app.showMenu())))));
  renderCards();
  renderDeck();
}
