// The Upgrade panel (Nov 5). One piece of code for two places: the Collection close-up and, signed in, the Deck Builder
// close-up, where it takes the 3D model's place (Ken: "show the upgrading system where you can upgrade the cards with the
// copies you have. And is there a place where we can see what the upgraded cards look like?").
// Per copy (Ken): one TARGET copy; every other copy is on Hold until its toggle says Upgrade (feed it in); a quick
// "Combine with N <tier> copies" and an "Upgrade to <next tier>" button pick copies for you; a confirm box says how many
// copies go, how many stay, how many a deck may still play, and which saved decks would come up short.
// Owner rule: the browser never changes a card itself; Combine is the server function upgrade_card (stub on test pages).
import { h, pictureOf as pictureOfCard, commanderPortrait } from '../ui/app';
import { ohCardEl, hasUpgradeArt } from '../ui/cardfmt';
import { ownedOf, copyLimit } from '../ui/decks';
import { TIER_NAMES, cardFor } from '../content/card-labels';
import { api, tierOfWorth, worthOfTier, stepsFor, toast } from './economy';
import type { CardCopy } from './economy';
import { net } from './state';

const idem = () => 'up-' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
/** the card's picture; a pack Commander shows its portrait */
export const upgradePicture = (c: any): string | null => (c && c.type === 'commander' && c.commanderId ? commanderPortrait(c.commanderId) : pictureOfCard(c));

export interface UpgradePanelOpts {
  pic: string | null;
  /** the server's upgrade steps when the caller has them; loaded otherwise */
  steps?: Record<string, number[]> | null;
  /** after a combine, with the copies left */
  onChange?: (copies: CardCopy[]) => void;
  /** a look in the preview row was clicked: show that tier large */
  onLook?: (tier: number) => void;
  /** Nov 7 (Ken, the Deck Builder's big view): copies per tier in this deck, the spare ones, and "Put in deck" for a tier */
  deck?: DeckHooks;
}
export interface DeckHooks { inDeck: (tier: number) => number; spare: (tier: number) => number; room: () => boolean; add: (tier: number) => void }
export interface UpgradePanel { el: HTMLElement; load: () => Promise<void>; best: () => number; copies: () => CardCopy[] }

/** the cheapest copies (by worth) that lift `target` to the next tier, or null when there are not enough */
export function cheapestForNext(target: CardCopy, others: CardCopy[], steps: number[]): CardCopy[] | null {
  if (target.tier >= 5) return null;
  const want = worthOfTier(target.tier + 1, steps) - target.worth;
  const pool = others.slice().sort((a, b) => a.worth - b.worth || a.id.localeCompare(b.id));
  const out: CardCopy[] = [];
  let sum = 0;
  for (const k of pool) { if (sum >= want) break; out.push(k); sum += k.worth; }
  return sum >= want ? out : null;
}

export function upgradePanel(c: any, opts: UpgradePanelOpts): UpgradePanel {
  let stepsAll: Record<string, number[]> | null = opts.steps || null;
  let steps = stepsFor(c.rarity, stepsAll || undefined);
  const panel = h('div', { class: 'col-upg', 'data-testid': 'upgrade-panel', role: 'group', 'aria-label': 'Upgrade ' + c.name },
    h('h2', {}, 'Upgrade'), h('p', { class: 'col-upg-sub' }, 'Pick the copy to upgrade (the TARGET), then feed other copies into it: tap Hold to turn it into Upgrade. Its look and stars go up; its numbers never change.'));
  const list = h('div', { class: 'col-upg-list', role: 'list' });
  const status = h('p', { class: 'col-upg-status', 'aria-live': 'polite' }, 'Loading your copies…');
  const btn = h('button', { type: 'button', class: 'net-btn primary col-upg-btn', disabled: 'true' }, 'Combine') as HTMLButtonElement;
  const nextBtn = h('button', { type: 'button', class: 'net-btn col-upg-next', hidden: true }, 'Upgrade to next level') as HTMLButtonElement;
  const qn = h('input', { type: 'number', class: 'col-upg-qn', min: '1', step: '1', value: '1', 'aria-label': 'how many copies to combine' }) as HTMLInputElement;
  const qt = h('select', { class: 'col-upg-qt', 'aria-label': 'which tier of copies' }) as HTMLSelectElement;
  const qgo = h('button', { type: 'button', class: 'net-btn col-upg-qgo' }, 'Pick') as HTMLButtonElement;
  const quick = h('div', { class: 'col-upg-quick' }, h('span', {}, 'Combine with'), qn, qt, h('span', {}, 'copies'), qgo);
  const looks = h('div', { class: 'upg-looks', 'data-testid': 'upg-looks', role: 'group', 'aria-label': 'The five looks' });
  panel.append(list, quick, status, h('div', { class: 'net-actions col-upg-actions' }, nextBtn, btn), h('h3', { class: 'upg-looks-h' }, 'The five looks'), looks,
    ...(hasUpgradeArt(c.id) ? [] : [h('p', { class: 'col-upg-note' }, 'This card\'s upgraded pictures are still being painted; its stars change now.')])); // Nov 6: append(null) wrote the word "null" into the panel
  let copies: CardCopy[] = [];
  let copiesLoaded = false;
  let target = '';
  const picked = new Set<string>();
  let shownLook = 0;
  const best = () => (copies.length ? Math.max(...copies.map((x) => x.tier)) : 0);
  const others = () => copies.filter((k) => k.id !== target);
  // the five looks: owned tiers lit, the rest dimmed with a lock and the copies they take; a click shows that look large
  // Nov 7 (Ken: "you need to see the upgrade cards and the upgrade cards available to the right hand side"): under each look, the copies
  // you own at that tier (and in this deck), "need N more copies" when you are short, and in the Deck Builder "Put in deck" for that tier
  let lastReach = 0;
  const drawLooks = (reach = lastReach) => {
    lastReach = reach;
    const b = best(), have = copies.reduce((s, k) => s + (k.worth || 1), 0), loaded = copiesLoaded;
    looks.replaceChildren(...[1, 2, 3, 4, 5].map((t) => {
      const owned = t <= b, need = worthOfTier(t, steps), n = copies.filter((k) => k.tier === t).length, more = Math.max(0, need - have);
      const look = h('button', { type: 'button', class: 'upg-look' + (owned ? ' lit' : ' locked') + (shownLook === t ? ' shown' : '') + (reach === t ? ' reach' : ''), 'data-tier': String(t), 'data-owned': String(owned), 'data-copies': String(n), 'aria-pressed': String(shownLook === t),
        'aria-label': owned ? `${TIER_NAMES[t]}: you have ${n}` : `${TIER_NAMES[t]}, locked: ${need} copies combined${more ? `, you need ${more} more` : ''}`, title: owned ? TIER_NAMES[t] : `${TIER_NAMES[t]}: ${need} copies combined into one`,
        onclick: (e: Event) => { e.preventDefault(); e.stopPropagation(); shownLook = t; drawLooks(reach); opts.onLook?.(t); } },
        ohCardEl({ ...c, tier: t }, opts.pic),
        owned ? null : h('span', { class: 'col-lock', 'aria-hidden': 'true' }),
        h('span', { class: 'upg-look-name', 'data-tier': String(t) }, TIER_NAMES[t]),
        owned ? null : h('span', { class: 'upg-look-need' }, `${need} copies`),
        loaded ? h('span', { class: 'upg-look-have' + (n ? ' some' : ''), 'data-testid': 'upg-have-' + t }, n ? `You have ${n}` : 'None yet') : null,
        loaded && !owned && more > 0 ? h('span', { class: 'upg-look-more', 'data-testid': 'upg-more-' + t }, `need ${more} more ${more === 1 ? 'copy' : 'copies'}`) : null);
      const d = opts.deck;
      if (!d || !loaded) return look;
      const inD = d.inDeck(t), spare = d.spare(t);
      const put = h('button', { type: 'button', class: 'net-btn upg-put', 'data-testid': 'upg-put-' + t, disabled: !(n > 0 && spare > 0 && d.room()) ? 'true' : null,
        title: n === 0 ? `You have no ${TIER_NAMES[t]} copy` : spare <= 0 ? `Every ${TIER_NAMES[t]} copy is in this deck` : !d.room() ? 'This deck is full for this card' : `Put a ${TIER_NAMES[t]} copy in this deck`,
        onclick: (e: Event) => { e.preventDefault(); e.stopPropagation(); d.add(t); drawLooks(); } }, 'Put in deck');
      return h('div', { class: 'upg-lookcol', 'data-tier': String(t) }, look, inD ? h('span', { class: 'upg-look-indeck', 'data-testid': 'upg-indeck-' + t }, `${inD} in deck`) : null, put);
    }));
  };
  const show = () => {
    list.replaceChildren(...copies.map((k) => {
      const isTarget = k.id === target, on = picked.has(k.id);
      return h('div', { class: 'col-upg-row' + (isTarget ? ' keep' : on ? ' picked' : ''), role: 'listitem', 'data-copy': k.id, 'data-tier': String(k.tier) },
        h('span', { class: 'col-upg-stars', 'data-tier': String(k.tier) }, '★'.repeat(k.tier)),
        h('span', { class: 'col-upg-name' }, TIER_NAMES[k.tier] + (k.worth > 1 ? ` · worth ${k.worth}` : '')),
        isTarget ? h('span', { class: 'col-upg-keeptag' }, 'TARGET')
          : h('button', { type: 'button', class: 'col-upg-pick' + (on ? ' on' : ''), 'aria-pressed': String(on), 'aria-label': `${on ? 'Upgrade' : 'Hold'}: this ${TIER_NAMES[k.tier]} copy`,
              onclick: (e: Event) => { e.preventDefault(); if (on) picked.delete(k.id); else picked.add(k.id); show(); } }, on ? 'Upgrade' : 'Hold'),
        isTarget ? null : h('button', { type: 'button', class: 'net-btn col-upg-keepbtn', onclick: (e: Event) => { e.preventDefault(); target = k.id; picked.delete(k.id); show(); } }, 'Upgrade this one'));
    }));
    const t = copies.find((k) => k.id === target);
    const spent = copies.filter((k) => picked.has(k.id)).reduce((s, k) => s + k.worth, 0);
    const after = (t?.worth || 1) + spent, tierAfter = tierOfWorth(after, steps), next = tierAfter < 5 ? worthOfTier(tierAfter + 1, steps) : null;
    if (!copies.length) status.textContent = 'You own no copies of this card yet. They come out of packs.';
    else if (!t) status.textContent = 'Pick the copy to upgrade.';
    else if (t.tier >= 5) status.textContent = 'This one is Mythic already: the top.';
    else if (!picked.size) status.textContent = `Worth ${t.worth}. ${next ? `${TIER_NAMES[tierOfWorth(t.worth, steps) + 1]} at ${worthOfTier(tierOfWorth(t.worth, steps) + 1, steps)}.` : ''} Turn Hold into Upgrade on the copies to feed in.`;
    else status.textContent = `Worth ${t.worth} + ${spent} = ${after}: ${TIER_NAMES[tierAfter]}${tierAfter > t.tier ? '!' : ''}${next ? ` (${TIER_NAMES[tierAfter + 1]} at ${next})` : ''}`;
    btn.disabled = !t || t.tier >= 5 || !picked.size;
    // the one-tap "Upgrade to <next>" with the cheapest copies, only when there are enough
    const cheap = t ? cheapestForNext(t, others(), steps) : null;
    nextBtn.hidden = !cheap;
    if (cheap && t) { nextBtn.textContent = `Upgrade to ${TIER_NAMES[t.tier + 1]} (uses ${cheap.length} ${cheap.length === 1 ? 'copy' : 'copies'})`; nextBtn.onclick = (e: Event) => { e.preventDefault(); picked.clear(); for (const k of cheap) picked.add(k.id); show(); }; }
    // the quick pick's tier list: only tiers with copies to give
    const have = new Map<number, number>();
    for (const k of others()) have.set(k.tier, (have.get(k.tier) || 0) + 1);
    const cur = Number(qt.value) || 1;
    qt.replaceChildren(...[1, 2, 3, 4, 5].filter((x) => have.get(x)).map((x) => h('option', { value: String(x), selected: x === cur ? 'true' : null }, `${TIER_NAMES[x]} (${have.get(x)})`)));
    quick.hidden = !t || t.tier >= 5 || !others().length;
    qn.max = String(Math.max(1, have.get(Number(qt.value) || 1) || 1));
    drawLooks(t && picked.size && tierAfter > t.tier ? tierAfter : 0);
  };
  qgo.addEventListener('click', (e) => {
    e.preventDefault();
    const n = Math.max(0, Math.floor(Number(qn.value) || 0)), tier = Number(qt.value) || 1;
    const pool = others().filter((k) => k.tier === tier).sort((a, b) => a.worth - b.worth || a.id.localeCompare(b.id)).slice(0, n);
    picked.clear(); for (const k of pool) picked.add(k.id);
    if (pool.length < n) status.textContent = `You have only ${pool.length} ${TIER_NAMES[tier]} ${pool.length === 1 ? 'copy' : 'copies'} to give.`;
    show();
    if (pool.length < n) status.textContent = `You have only ${pool.length} ${TIER_NAMES[tier]} ${pool.length === 1 ? 'copy' : 'copies'} to give; those are picked.`;
  });
  qt.addEventListener('change', () => show());
  const load = async () => {
    if (!stepsAll) { try { stepsAll = (await api.myUpgradeInfo()).steps; steps = stepsFor(c.rarity, stepsAll); } catch { /* the default steps */ } }
    try { copies = await api.myCardCopies(c.id); } catch (e: any) { status.textContent = 'Could not load your copies: ' + String(e?.message || e); drawLooks(); return; }
    copies.sort((a, b) => b.tier - a.tier || b.worth - a.worth);
    copiesLoaded = true;
    target = copies[0]?.id || ''; picked.clear(); show();
  };
  /** Ken (Nov 5): before any combine, say what it costs and what is left, and which decks would come up short */
  const confirmBox = (): Promise<{ go: boolean; force: boolean }> => new Promise((resolve) => {
    const t = copies.find((k) => k.id === target);
    const used = picked.size, total = copies.length, left = total - used;
    const limit = copyLimit(c.id), playable = Math.min(left, limit);
    const spent = copies.filter((k) => picked.has(k.id)).reduce((s, k) => s + k.worth, 0);
    const tierAfter = t ? tierOfWorth(t.worth + spent, steps) : 1;
    const shortDecks = (net.decks || []).filter((d) => d.cards.filter((x) => x === c.id).length > left);
    const most = shortDecks.reduce((m, d) => Math.max(m, d.cards.filter((x) => x === c.id).length), 0);
    const names = shortDecks.map((d) => d.name);
    const lines: HTMLElement[] = [
      h('p', { class: 'col-upg-c-what' }, `This combines ${used} ${used === 1 ? 'copy' : 'copies'} into the TARGET${t ? `, making it ${TIER_NAMES[tierAfter]}` : ''}.`),
      h('p', { class: 'col-upg-c-left' }, `${left} ${left === 1 ? 'copy' : 'copies'} left after, ${playable} ${playable === 1 ? 'copy' : 'copies'} playable in one deck (the limit is ${limit}).`),
    ];
    if (names.length) lines.push(h('p', { class: 'col-upg-warn', role: 'alert' }, `Only ${left} left to play. Your ${names.length === 1 ? 'deck' : 'decks'} ${names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]} ${names.length === 1 ? 'uses' : 'use'} ${most}. Are you sure?`));
    if (left <= 1) lines.push(h('p', { class: 'col-upg-danger', role: 'alert' }, 'This uses every copy you have. Only the upgraded one stays.'));
    const box = h('div', { class: 'col-upg-confirm', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Combine?', 'data-testid': 'upgrade-confirm' },
      h('div', { class: 'col-upg-confirm-box' }, h('h2', {}, 'Combine?'), ...lines,
        h('div', { class: 'net-actions' }, h('button', { type: 'button', class: 'net-btn col-upg-cancel', onclick: () => done(false) }, 'Cancel'), h('button', { type: 'button', class: 'net-btn primary col-upg-ok', onclick: () => done(true) }, 'Confirm'))));
    box.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === box) done(false); });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    const done = (go: boolean) => { box.remove(); document.removeEventListener('keydown', onKey, true); resolve({ go, force: names.length > 0 }); };
    document.addEventListener('keydown', onKey, true);
    document.body.append(box);
    (box.querySelector('.col-upg-cancel') as HTMLElement | null)?.focus();
  });
  btn.addEventListener('click', async () => {
    if (!picked.size || !target) return;
    const { go, force } = await confirmBox();
    if (!go) return;
    btn.disabled = true;
    try {
      const r = await api.upgradeCard(target, [...picked], idem(), force);
      toast(r.tier_after > r.tier_before ? `${c.name} is now ${TIER_NAMES[r.tier_after]}!` : `${c.name}: worth ${r.worth_after} (${TIER_NAMES[r.tier_after]}), ${r.next_worth ? TIER_NAMES[r.tier_after + 1] + ' at ' + r.next_worth : 'the top'}`, '/art/packs/icons/free-pack.webp');
      if (Array.isArray(r.decks) && r.decks.length) toast(`Decks updated: ${r.decks.join(', ')}`, '/art/packs/icons/free-pack.webp');
      await load();
      shownLook = 0; show();
      opts.onChange?.(copies);
    } catch (e: any) { status.textContent = String(e?.message || e); btn.disabled = false; }
  });
  panel.addEventListener('click', (e) => e.stopPropagation()); // a rebuilt row's button is detached by the time its click bubbles; the overlay around must not take it as "close"
  drawLooks();
  return { el: panel, load, best: () => Math.max(1, best()), copies: () => copies };
}

/** The Deck Builder close-up (app.closeUp), signed in: the card at its best tier plus the panel, in the 3D model's place.
 *  Returns null when the player is not in owned mode (offline, vs-computer): the caller keeps its 3D viewer. */
export function mountInCloseUp(ov: HTMLElement, cardId: string, face: HTMLElement, extra: { deck?: DeckHooks; view3d?: () => void } = {}): (() => void) | null {
  const id = cardId.startsWith('cmd:') ? 'commander-' + cardId.slice(4) : cardId;
  const c = cardFor(id);
  if (!net.active || !c || c.disabled || ownedOf(id) == null) return null;
  const pic = upgradePicture(c);
  const wrap = h('div', { class: 'cz-img cz-oh', role: 'img', 'aria-label': c.name, 'data-card-id': cardId }, ohCardEl({ ...c, tier: 1 }, pic));
  const swap = (t: number) => { wrap.querySelector(':scope > .ohcard')?.replaceWith(ohCardEl({ ...c, tier: t }, pic)); wrap.dataset.tier = String(t); };
  const panel = upgradePanel(c, { pic, onChange: () => swap(panel.best()), onLook: swap, deck: extra.deck });
  face.replaceWith(wrap);
  ov.append(panel.el);
  if (extra.view3d) { const go = extra.view3d; panel.el.prepend(h('button', { type: 'button', class: 'net-btn upg-3d', 'data-testid': 'view-3d', title: 'See the 3D model', onclick: (e: Event) => { e.preventDefault(); e.stopPropagation(); go(); } }, 'View 3D')); }
  ov.classList.add('with-upg');
  void panel.load().then(() => swap(panel.best()));
  return () => { /* nothing runs in the background */ };
}
