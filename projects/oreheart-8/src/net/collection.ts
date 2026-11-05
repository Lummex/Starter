// The Collection (contract 4.2): every card in the game, owned ones with "×N", the rest greyed with a small lock.
// Filters by faction, rarity and owned. Crystal cards are free and unlimited for everyone.
import { h, pictureOf, rarityKey } from '../ui/app';
import { ohCardEl, TIER_NAMES, hasUpgradeArt } from '../ui/cardfmt';
import { collectionCards, countLine } from './quest-summary';
export { collectionCards, countLine };
import { econShow, backBtn, coinChip, api, RARITIES, toast, tierOfWorth, worthOfTier, stepsFor } from './economy';
import type { UpgradeInfo, CardCopy } from './economy';

const idem = () => 'up-' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

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
    const free = c.type === 'crystal';
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
    const steps = stepsFor(c.rarity, own.upg?.steps); // the steps for this card's rarity
    const panel = h('div', { class: 'col-upg', 'data-testid': 'upgrade-panel', role: 'group', 'aria-label': 'Upgrade ' + c.name },
      h('h2', {}, 'Upgrade'), h('p', { class: 'col-upg-sub' }, 'Combine copies of this card into one. Its look and stars go up; its numbers never change.'));
    const list = h('div', { class: 'col-upg-list', role: 'list' });
    const status = h('p', { class: 'col-upg-status', 'aria-live': 'polite' }, 'Loading your copies…');
    const btn = h('button', { type: 'button', class: 'net-btn primary col-upg-btn', disabled: 'true' }, 'Combine') as HTMLButtonElement;
    const preview = h('div', { class: 'col-upg-preview', 'aria-hidden': 'true' });
    panel.append(list, status, h('div', { class: 'net-actions' }, btn), hasUpgradeArt(c.id) ? preview : h('p', { class: 'col-upg-note' }, 'This card\'s upgraded pictures are still being painted; its stars change now.'));
    big.append(panel);
    let copies: CardCopy[] = [];
    let keep = '';
    const picked = new Set<string>();
    const show = () => {
      list.replaceChildren(...copies.map((k) => {
        const isKeep = k.id === keep;
        const row = h('label', { class: 'col-upg-row' + (isKeep ? ' keep' : picked.has(k.id) ? ' picked' : ''), role: 'listitem', 'data-copy': k.id, 'data-tier': String(k.tier) },
          h('input', { type: 'checkbox', class: 'col-upg-pick', 'aria-label': `combine this ${TIER_NAMES[k.tier]} copy`, disabled: isKeep ? 'true' : null, checked: picked.has(k.id) ? 'true' : null,
            onchange: (e: Event) => { if ((e.target as HTMLInputElement).checked) picked.add(k.id); else picked.delete(k.id); show(); } }),
          h('span', { class: 'col-upg-stars', 'data-tier': String(k.tier) }, '★'.repeat(k.tier)),
          h('span', { class: 'col-upg-name' }, TIER_NAMES[k.tier] + (k.worth > 1 ? ` · worth ${k.worth}` : '')),
          isKeep ? h('span', { class: 'col-upg-keeptag' }, 'KEEP') : h('button', { type: 'button', class: 'net-btn col-upg-keepbtn', onclick: (e: Event) => { e.preventDefault(); keep = k.id; picked.delete(k.id); show(); } }, 'Keep this one'));
        return row;
      }));
      const t = copies.find((k) => k.id === keep);
      const spent = copies.filter((k) => picked.has(k.id)).reduce((s, k) => s + k.worth, 0);
      const after = (t?.worth || 1) + spent, tierAfter = tierOfWorth(after, steps), next = tierAfter < 5 ? worthOfTier(tierAfter + 1, steps) : null;
      if (!t) status.textContent = 'Pick the copy to keep.';
      else if (t.tier >= 5) status.textContent = 'This one is Mythic already: the top.';
      else if (!picked.size) status.textContent = `Worth ${t.worth}. ${next ? `${TIER_NAMES[tierOfWorth(t.worth, steps) + 1]} at ${worthOfTier(tierOfWorth(t.worth, steps) + 1, steps)}.` : ''} Tick the copies to combine.`;
      else status.textContent = `Worth ${t.worth} + ${spent} = ${after}: ${TIER_NAMES[tierAfter]}${tierAfter > t.tier ? '!' : ''}${next ? ` (${TIER_NAMES[tierAfter + 1]} at ${next})` : ''}`;
      btn.disabled = !t || t.tier >= 5 || !picked.size;
      preview.replaceChildren(t && tierAfter > t.tier ? ohCardEl({ ...c, tier: tierAfter }, pictureOf(c)) : h('span'));
    };
    const load = async () => {
      try { copies = await api.myCardCopies(c.id); } catch (e: any) { status.textContent = 'Could not load your copies: ' + String(e?.message || e); return; }
      copies.sort((a, b) => b.tier - a.tier || b.worth - a.worth);
      keep = copies[0]?.id || ''; picked.clear(); show();
    };
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const r = await api.upgradeCard(keep, [...picked], idem());
        toast(r.tier_after > r.tier_before ? `${c.name} is now ${TIER_NAMES[r.tier_after]}!` : `${c.name}: worth ${r.worth_after} (${TIER_NAMES[r.tier_after]}), ${r.next_worth ? TIER_NAMES[r.tier_after + 1] + ' at ' + r.next_worth : 'the top'}`, '/art/packs/icons/free-pack.webp');
        await load();
        own.onChange(copies);
        big.querySelector(':scope > .ohcard')?.replaceWith(ohCardEl({ ...c, tier: copies.length ? Math.max(...copies.map((x) => x.tier)) : 1 }, pictureOf(c)));
      } catch (e: any) { status.textContent = String(e?.message || e); btn.disabled = false; }
    });
    void load();
  }
  document.body.append(ov);
  ov.focus();
}
