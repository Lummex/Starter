// The Collection (contract 4.2): every card in the game, owned ones with "×N", the rest greyed with a small lock.
// Filters by faction, rarity and owned. Crystal cards are free and unlimited for everyone.
import { h, pictureOf as pictureOfCard, rarityKey, commanderPortrait } from '../ui/app';
const pictureOf = (c: any) => (c && c.type === 'commander' && c.commanderId ? commanderPortrait(c.commanderId) : pictureOfCard(c)); // Nov 5: Commanders in the Collection
import { ohCardEl, TIER_NAMES } from '../ui/cardfmt';
import { upgradePanel } from './upgrade-panel';
import { collectionCards, countLine } from './quest-summary';
export { collectionCards, countLine };
import { econShow, backBtn, coinChip, api, RARITIES, rarityLabel, dashSkinned } from './economy';
import type { UpgradeInfo, CardCopy } from './economy';


const FACTION_LABEL: [string, string][] = [['all', 'All'], ['goblins', 'Goblins'], ['gnomes', 'Gnomes'], ['dwarves', 'Dwarves'], ['any', 'Neutral']];

export async function showCollection(): Promise<void> {
  const state = { faction: 'all', rarity: 'All', owned: 'all', type: 'all', q: '' };
  const skinned = dashSkinned();
  const count = h('p', { class: 'col-count', 'aria-live': 'polite' }, 'Counting your cards…');
  const grid = h('div', { class: 'col-grid', role: 'list', 'aria-label': 'Cards' });
  const alert = h('p', { class: 'econ-alert', role: 'alert' });
  const pills = (label: string, key: 'faction' | 'rarity' | 'owned' | 'type', opts: [string, string][]) => {
    const wrap = h('div', { class: 'net-races', role: 'group', 'aria-label': label });
    const bs = opts.map(([v, t]) => h('button', { type: 'button', class: 'net-race', 'data-v': v, 'aria-pressed': String(state[key] === v), onclick: () => { state[key] = v; for (const b of bs) b.setAttribute('aria-pressed', String(b.dataset.v === v)); draw(); } }, t));
    wrap.append(...bs);
    return wrap;
  };
  const completion = h('section', { class: 'econ-panel col-completion', 'data-testid': 'col-completion', 'aria-label': 'Completion' });
  const upgraded = h('section', { class: 'econ-panel col-upgraded', 'data-testid': 'col-upgraded', 'aria-label': 'Upgraded cards' });
  const combine = h('section', { class: 'econ-panel col-right', 'data-testid': 'col-combine', 'aria-label': 'Combine copies' }, h('h2', { class: 'h' }, 'Combine copies'), h('p', { class: 'col-hint' }, 'Tap a card to see its copies and the five looks.'));
  const search = h('input', { type: 'search', class: 'col-search net-input', placeholder: 'Search cards', 'aria-label': 'Search cards', autocomplete: 'off' }) as HTMLInputElement;
  search.addEventListener('input', () => { state.q = search.value; draw(); });
  econShow('collection',
    h('div', { class: 'econ-head' }, backBtn(),
      h('div', { class: 'econ-titles' }, h('h1', {}, 'Your Collection'), h('p', { class: 'econ-sub' }, 'Every card you own. The grey ones are still out there, hiding in packs.')),
      coinChip()),
    alert,
    h('div', { class: 'col-main' },
      h('div', { class: 'col-left' }, completion, upgraded),
      h('section', { class: 'col-mid econ-panel', 'aria-label': 'All cards' },
        h('div', { class: 'col-mid-h' }, h('h2', { class: 'h' }, 'All cards'), count),
        h('div', { class: 'col-tools' },
          pills('Faction', 'faction', FACTION_LABEL),
          pills('Rarity', 'rarity', [['All', 'Any rarity'], ...RARITIES.map((r) => [r, rarityLabel(r)] as [string, string])]),
          h('div', { class: 'col-tools-row' }, pills('Type', 'type', [['all', 'All'], ['creature', 'Creatures'], ['spell', 'Spells'], ['crystal', 'Crystals']]),
            pills('Owned', 'owned', [['all', 'All'], ['owned', 'Owned'], ['upgraded', 'Upgraded'], ['missing', 'Missing']]), search)),
        grid),
      combine));
  let owned: Record<string, number> = {};
  let upg: UpgradeInfo | null = null;
  const selected = (c: any, n: number, best: number, onChange: (copies: CardCopy[]) => void) => {
    // the right column: the card large and its upgrade panel (the same panel as the close-up)
    const big = h('div', { class: 'col-big col-sel' }, ohCardEl({ ...c, tier: best }, pictureOf(c)));
    const swap = (t: number) => big.querySelector(':scope > .ohcard')?.replaceWith(ohCardEl({ ...c, tier: t }, pictureOf(c)));
    combine.replaceChildren(h('h2', { class: 'h' }, 'Combine copies'), h('p', { class: 'col-selname' }, c.name), big);
    if (n > 0) { const panel = upgradePanel(c, { pic: pictureOf(c), steps: upg?.steps, onChange: (copies) => { onChange(copies); swap(panel.best()); }, onLook: swap }); combine.append(panel.el); void panel.load().then(() => swap(panel.best())); }
    else combine.append(h('p', { class: 'col-hint' }, 'You do not own this card yet. It hides in packs.'));
  };
  try { [owned, upg] = await Promise.all([api.myCollection(), api.myUpgradeInfo().catch(() => null)]); } catch (e: any) { alert.textContent = 'Could not load your cards: ' + String(e?.message || e); }
  const bestOf = (id: string) => Math.max(1, Math.min(5, Number(upg?.cards?.[id]?.best) || 1));
  const all = collectionCards();
  count.textContent = countLine(owned, all);
  // one tile per card, built once; the filters only hide and show them
  const tiles = all.map((c) => {
    const free = false; // Nov 5 (Ken): crystals come out of packs at their rarity and are owned like any card
    const n = owned[c.id] || 0;
    const has = free || n > 0;
    const best = has && !free ? bestOf(c.id) : 1;
    const el = h('button', { type: 'button', class: `col-card${has ? '' : ' unowned'}${best > 1 ? ' upgraded' : ''}`, role: 'listitem', 'data-card-id': c.id, 'data-owned': free ? 'free' : String(n), 'data-tier': String(best), 'data-rarity': rarityKey(c), 'aria-label': `${c.name}: ${free ? 'free' : has ? 'you own ' + n : 'not owned yet'}` },
      ohCardEl({ ...c, tier: best }, pictureOf(c)),
      free ? h('span', { class: 'col-badge', title: 'Free and unlimited' }, '∞') : has ? h('span', { class: 'col-badge' }, '×' + n) : h('span', { class: 'col-lock', 'aria-hidden': 'true' }),
      best > 1 ? h('span', { class: 'col-tier', 'data-tier': String(best) }, TIER_NAMES[best]) : null);
    const t = { c, el, has, best };
    const onPick = (copies: CardCopy[]) => {
      // after a combine: the tile shows the new best tier and count
      const nb = copies.length ? Math.max(...copies.map((x) => x.tier)) : 1;
      owned[c.id] = copies.length; t.best = nb; el.dataset.owned = String(copies.length); el.dataset.tier = String(nb); el.classList.toggle('upgraded', nb > 1);
      el.querySelector('.ohcard')?.replaceWith(ohCardEl({ ...c, tier: nb }, pictureOf(c)));
      const badge = el.querySelector('.col-badge'); if (badge) badge.textContent = '×' + copies.length;
      el.querySelector('.col-tier')?.remove(); if (nb > 1) el.append(h('span', { class: 'col-tier', 'data-tier': String(nb) }, TIER_NAMES[nb]));
      count.textContent = countLine(owned, all);
      paintSide();
    };
    el.addEventListener('click', () => { if (skinned) selected(c, owned[c.id] || 0, t.best, onPick); else zoom(c, free ? null : { n, best, upg, onChange: onPick }); });
    return t;
  });
  grid.replaceChildren(...tiles.map((t) => t.el));
  // the left column: completion by faction, and the upgraded cards with the steps table (real numbers from the server)
  function paintSide() {
    const found = all.filter((c) => (owned[c.id] || 0) > 0);
    const copies = all.reduce((s, c) => s + (owned[c.id] || 0), 0);
    const pctAll = all.length ? Math.round((found.length / all.length) * 100) : 0;
    const rowsF = FACTION_LABEL.slice(1).map(([f, name]) => { const of = all.filter((c) => c.faction === f), got = of.filter((c) => (owned[c.id] || 0) > 0).length, miss = of.length - got; return h('div', { class: 'col-fac', 'data-faction': f }, h('div', { class: 'l' }, h('i', { class: 'dot' }), h('b', {}, name), h('small', {}, miss > 0 ? `${miss} missing` : 'complete')), h('span', { class: 'n' }, `${got}/${of.length}`), h('div', { class: 'bar' }, h('i', { style: `width:${of.length ? Math.round((got / of.length) * 100) : 0}%` }))); });
    completion.replaceChildren(h('h2', { class: 'h' }, 'Completion'), h('div', { class: 'col-tot' }, h('b', {}, `${found.length} / ${all.length}`), h('small', {}, `different cards found \u00b7 ${pctAll}%`), h('small', {}, `${copies} copies in all`)), ...rowsF);
    const byTier: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const c of all) { const b = (owned[c.id] || 0) > 0 ? bestOf(c.id) : 1; if (b > 1) byTier[b]++; }
    const tierRows = [2, 3, 4, 5].map((t) => h('div', { class: 'col-tr' }, h('span', { class: 'col-tier', 'data-tier': String(t) }, `${TIER_NAMES[t]} ${'\u2605'.repeat(t)}`), h('span', {}, `${byTier[t]} card${byTier[t] === 1 ? '' : 's'}`)));
    const steps = upg?.steps || {};
    const table = h('table', { class: 'col-steps' }, h('thead', {}, h('tr', {}, h('th', {}), ...['Enh.', 'Over.', 'Rad.', 'Myth.'].map((x) => h('th', {}, x)))),
      h('tbody', {}, ...RARITIES.map((r) => h('tr', { 'data-rarity': r }, h('th', {}, rarityLabel(r)), ...(steps[r] || [0, 0, 0, 0]).slice(0, 4).map((n: number) => h('td', {}, n ? `+${n}` : '\u2014'))))));
    upgraded.replaceChildren(h('h2', { class: 'h' }, 'Upgraded cards'), ...tierRows, table, h('p', { class: 'col-hint' }, 'Extra copies for each step up. Only the look changes, never the numbers.'));
  }
  paintSide();
  function draw() {
    let shown = 0;
    const q = state.q.trim().toLowerCase();
    for (const t of tiles) {
      const ok = (state.faction === 'all' || t.c.faction === state.faction) && (state.rarity === 'All' || t.c.rarity === state.rarity) && (state.type === 'all' || t.c.type === state.type) && (!q || String(t.c.name || '').toLowerCase().includes(q)) && (state.owned === 'all' || (state.owned === 'owned' ? t.has : state.owned === 'upgraded' ? t.best > 1 : !t.has));
      t.el.hidden = !ok; if (ok) shown++;
    }
    grid.dataset.shown = String(shown);
  }
  draw();
}

/** The close-up. An owned card also gets the Upgrade panel (Nov 5): its copies with their tiers, pick the one to keep and the ones to
 *  combine into it; worth adds up and the tier follows the thresholds. Looks only: no number on the card changes. */
function zoom(c: any, own: { n: number; best: number; upg: UpgradeInfo | null; onChange: (copies: CardCopy[]) => void } | null) {
  const big = h('div', { class: 'col-big' }, ohCardEl({ ...c, tier: own?.best || 1 }, pictureOf(c)));
  const ov = h('div', { class: 'col-zoom' + (own ? ' with-upg' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': c.name, tabindex: '-1' }, big);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey, true); };
  ov.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('.col-upg')) close(); });
  document.addEventListener('keydown', onKey, true); // Escape closes it wherever the focus went (a disabled Combine button drops it)
  if (own) {
    // Nov 5: the panel is shared with the Deck Builder close-up (upgrade-panel.ts); a look click shows that tier large
    const swap = (t: number) => big.querySelector(':scope > .ohcard')?.replaceWith(ohCardEl({ ...c, tier: t }, pictureOf(c)));
    const panel = upgradePanel(c, { pic: pictureOf(c), steps: own.upg?.steps, onChange: (copies) => { own.onChange(copies); swap(panel.best()); }, onLook: swap });
    big.append(panel.el);
    void panel.load().then(() => swap(panel.best()));
  }
  document.body.append(ov);
  ov.focus();
}
