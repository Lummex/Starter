// The Collection (contract 4.2): every card in the game, owned ones with "×N", the rest greyed with a small lock.
// Filters by faction, rarity and owned. Crystal cards are free and unlimited for everyone.
import { h, pictureOf, rarityKey } from '../ui/app';
import { ohCardEl } from '../ui/cardfmt';
import { collectionCards, countLine } from './quest-summary';
export { collectionCards, countLine };
import { econShow, backBtn, coinChip, api, RARITIES } from './economy';

const FACTION_LABEL: [string, string][] = [['all', 'All'], ['goblins', 'Goblins'], ['gnomes', 'Gnomes'], ['dwarves', 'Dwarves'], ['any', 'Neutral']];

export async function showCollection(): Promise<void> {
  const state = { faction: 'all', rarity: 'All', owned: 'all' };
  const count = h('p', { class: 'col-count', 'aria-live': 'polite' }, 'Counting your cards…');
  const grid = h('div', { class: 'col-grid', role: 'list', 'aria-label': 'Cards' });
  const alert = h('p', { class: 'econ-alert', role: 'alert' });
  const pills = (label: string, key: 'faction' | 'rarity' | 'owned', opts: [string, string][]) => {
    const wrap = h('div', { class: 'net-races', role: 'group', 'aria-label': label });
    const bs = opts.map(([v, t]) => h('button', { type: 'button', class: 'net-race', 'data-v': v, 'aria-pressed': String(state[key] === v), onclick: () => { state[key] = v; for (const b of bs) b.setAttribute('aria-pressed', String(b.dataset.v === v)); draw(); } }, t));
    wrap.append(...bs);
    return wrap;
  };
  econShow('collection',
    h('div', { class: 'econ-head' }, backBtn(),
      h('div', { class: 'econ-titles' }, h('h1', {}, 'Your Collection'), h('p', { class: 'econ-sub' }, 'Every card you own. The grey ones are still out there, hiding in packs.')),
      coinChip()),
    h('div', { class: 'col-tools' },
      pills('Faction', 'faction', FACTION_LABEL),
      pills('Rarity', 'rarity', [['All', 'Any rarity'], ...RARITIES.map((r) => [r, r] as [string, string])]),
      pills('Owned', 'owned', [['all', 'All'], ['owned', 'Owned'], ['missing', 'Missing']])),
    count, alert, grid);
  let owned: Record<string, number> = {};
  try { owned = await api.myCollection(); } catch (e: any) { alert.textContent = 'Could not load your cards: ' + String(e?.message || e); }
  const all = collectionCards();
  count.textContent = countLine(owned, all);
  // one tile per card, built once; the filters only hide and show them
  const tiles = all.map((c) => {
    const free = c.type === 'crystal';
    const n = owned[c.id] || 0;
    const has = free || n > 0;
    const el = h('button', { type: 'button', class: `col-card${has ? '' : ' unowned'}`, role: 'listitem', 'data-card-id': c.id, 'data-owned': free ? 'free' : String(n), 'data-rarity': rarityKey(c), 'aria-label': `${c.name}: ${free ? 'free' : has ? 'you own ' + n : 'not owned yet'}` },
      ohCardEl(c, pictureOf(c)),
      free ? h('span', { class: 'col-badge', title: 'Free and unlimited' }, '∞') : has ? h('span', { class: 'col-badge' }, '×' + n) : h('span', { class: 'col-lock', 'aria-hidden': 'true' }, '🔒'));
    el.addEventListener('click', () => zoom(c));
    return { c, el, has };
  });
  grid.replaceChildren(...tiles.map((t) => t.el));
  function draw() {
    let shown = 0;
    for (const t of tiles) {
      const ok = (state.faction === 'all' || t.c.faction === state.faction) && (state.rarity === 'All' || t.c.rarity === state.rarity) && (state.owned === 'all' || (state.owned === 'owned' ? t.has : !t.has));
      t.el.hidden = !ok; if (ok) shown++;
    }
    grid.dataset.shown = String(shown);
  }
  draw();
}

function zoom(c: any) {
  const ov = h('div', { class: 'col-zoom', role: 'dialog', 'aria-modal': 'true', 'aria-label': c.name, tabindex: '-1' }, h('div', { class: 'col-big' }, ohCardEl(c, pictureOf(c))));
  const close = () => ov.remove();
  ov.addEventListener('click', close);
  ov.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') close(); });
  document.body.append(ov);
  ov.focus();
}
