// The Collection (contract 4.2): every card in the game, owned ones with "×N", the rest greyed with a small lock.
// Filters by faction, rarity and owned. Crystal cards are free and unlimited for everyone.
import { h, pictureOf as pictureOfCard, rarityKey, commanderPortrait } from '../ui/app';
const pictureOf = (c: any) => (c && c.type === 'commander' && c.commanderId ? commanderPortrait(c.commanderId) : pictureOfCard(c)); // Nov 5: Commanders in the Collection
import { ohCardEl, TIER_NAMES } from '../ui/cardfmt';
import { upgradePanel } from './upgrade-panel';
import { collectionCards, countLine } from './quest-summary';
export { collectionCards, countLine };
import { econShow, backBtn, coinChip, api, RARITIES, rarityLabel } from './economy';
import type { UpgradeInfo, CardCopy } from './economy';


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
      pills('Rarity', 'rarity', [['All', 'Any rarity'], ...RARITIES.map((r) => [r, rarityLabel(r)] as [string, string])]),
      pills('Owned', 'owned', [['all', 'All'], ['owned', 'Owned'], ['upgraded', 'Upgraded'], ['missing', 'Missing']])),
    count, alert, grid);
  let owned: Record<string, number> = {};
  let upg: UpgradeInfo | null = null;
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
    el.addEventListener('click', () => zoom(c, free ? null : { n, best, upg, onChange: (copies: CardCopy[]) => {
      // after a combine: the tile shows the new best tier and count
      const nb = copies.length ? Math.max(...copies.map((x) => x.tier)) : 1;
      owned[c.id] = copies.length; t.best = nb; el.dataset.owned = String(copies.length); el.dataset.tier = String(nb); el.classList.toggle('upgraded', nb > 1);
      el.querySelector('.ohcard')?.replaceWith(ohCardEl({ ...c, tier: nb }, pictureOf(c)));
      const badge = el.querySelector('.col-badge'); if (badge) badge.textContent = '×' + copies.length;
      el.querySelector('.col-tier')?.remove(); if (nb > 1) el.append(h('span', { class: 'col-tier', 'data-tier': String(nb) }, TIER_NAMES[nb]));
      count.textContent = countLine(owned, all);
    } }));
    return t;
  });
  grid.replaceChildren(...tiles.map((t) => t.el));
  function draw() {
    let shown = 0;
    for (const t of tiles) {
      const ok = (state.faction === 'all' || t.c.faction === state.faction) && (state.rarity === 'All' || t.c.rarity === state.rarity) && (state.owned === 'all' || (state.owned === 'owned' ? t.has : state.owned === 'upgraded' ? t.best > 1 : !t.has));
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
