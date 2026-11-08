// Deck tiles (Ken, Nov 7: "use graphic images to represent the decks with the names underneath. Make it look nice. And like it belongs
// there in the menu system. And you can scroll through it when you have a lot of decks."). One picture per deck for Choose Your Commander
// and the PvP lobby: the deck box with the deck's star card on its face, your card back peeking out behind and the Commander's coin;
// the name and the card count under it. A scroll row with arrows (PC), the mouse wheel, drag or swipe.
import { CARDS } from '../engine';
import { h, pictureOf, commanderPortrait } from './app';
import { backArt } from '../content/card-backs';

type El = HTMLElement;
const RANK: Record<string, number> = { Collector: 5, 'Ultra Rare': 4, Rare: 3, Uncommon: 2, Common: 1 };

/** the card that stands for the deck: the rarest (then the dearest) creature with a painting */
export function starCard(cards: string[]): string | null {
  let best: any = null;
  for (const id of new Set(cards)) {
    const c: any = CARDS[id];
    if (!c || c.type !== 'creature' || !pictureOf(c)) continue;
    if (!best || (RANK[c.rarity] || 0) > (RANK[best.rarity] || 0) || ((RANK[c.rarity] || 0) === (RANK[best.rarity] || 0) && c.cost > best.cost)) best = c;
  }
  return best ? best.id : null;
}

/** the picture: the deck box, the star card on its face, the card back behind, the Commander's coin */
export function deckArt(cards: string[], commander: string, back?: string | null): El {
  const star = starCard(cards);
  const pic = star ? pictureOf(CARDS[star]) : null;
  return h('span', { class: 'dk-art', 'aria-hidden': 'true', 'data-star': star || '' },
    h('img', { class: 'dk-sleeve', src: backArt(back || 'default'), alt: '', draggable: 'false' }),
    h('img', { class: 'deck-img dk-box', src: '/art/deck/deck-menu.png', alt: '', draggable: 'false' }),
    pic ? h('span', { class: 'dk-face', style: `background-image:url(${pic})` }) : null,
    h('span', { class: 'dk-cmd', style: `background-image:url(${commanderPortrait(commander)})` }));
}

/** a horizontal scroll row with arrows that show only when there is more to see; the wheel scrolls it sideways */
export function deckScroller(row: El): El {
  const step = (dir: number) => row.scrollBy({ left: dir * Math.max(120, row.clientWidth * 0.8), behavior: 'smooth' });
  const prev = h('button', { type: 'button', class: 'dk-arrow prev', 'aria-label': 'More decks to the left', onclick: () => step(-1) }, '‹') as HTMLButtonElement;
  const next = h('button', { type: 'button', class: 'dk-arrow next', 'aria-label': 'More decks to the right', onclick: () => step(1) }, '›') as HTMLButtonElement;
  const sync = () => { prev.hidden = row.scrollLeft <= 2; next.hidden = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2; };
  row.addEventListener('scroll', sync, { passive: true });
  row.addEventListener('wheel', (e: WheelEvent) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && row.scrollWidth > row.clientWidth) { e.preventDefault(); row.scrollLeft += e.deltaY; } }, { passive: false });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(sync).observe(row);
  new MutationObserver(() => requestAnimationFrame(sync)).observe(row, { childList: true });
  requestAnimationFrame(sync);
  return h('div', { class: 'dk-scroll' }, prev, row, next);
}

/** the last deck used with each Commander, on this device */
const LAST = 'oreheart.deckPerCmd';
export function lastDeckFor(commander: string): string { try { return (JSON.parse(localStorage.getItem(LAST) || '{}') || {})[commander] || ''; } catch { return ''; } }
export function rememberDeck(commander: string, key: string) { try { const m = JSON.parse(localStorage.getItem(LAST) || '{}') || {}; m[commander] = key; localStorage.setItem(LAST, JSON.stringify(m)); } catch { /* storage unavailable */ } }
