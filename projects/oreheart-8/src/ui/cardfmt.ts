import FORMAT from '../../public/art/card-format/format.json';
import { makeOHRenderer } from './ohrender';
import './ohcard.css';

/** The owner's card format (Art Studio, "Card format final 1.0") drawn by his own renderer: every card face in the game goes through here. */
const R = makeOHRenderer(FORMAT as any);

/** HTML string of a card face drawn at `px` height (the CSS makes it fill its parent). */
export function ohCardHTML(card: any, artUrl: string | null, px = 624): string {
  return R.cardHTML(card, artUrl || '', px);
}

/** Card face element: `.ohcard > .cardc`, sized by its parent; the text shrinks to fit once it has a size. */
export function ohCardEl(card: any, artUrl: string | null): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ohcard';
  el.innerHTML = ohCardHTML(card, artUrl);
  const fit = () => R.fitText(el);
  const ro = new ResizeObserver(() => {
    if (!el.clientHeight) return;
    fit();
    ro.disconnect();
  });
  ro.observe(el);
  if (document.fonts?.ready) void document.fonts.ready.then(() => el.isConnected && el.clientHeight && fit());
  return el;
}

/** A Commander as a `commander`-layout card (Choose Your Commander, close-ups). */
export function commanderCard(c: any) {
  return { id: 'cmd:' + c.id, type: 'commander', faction: c.faction, name: c.name, text: c.abilityText, health: c.health, cost: '', rarity: 'Collector', artPos: c.artPos };
}

/** The Oreheart card back, drawn from the format's `back` layout. */
export const ohBackEl = () => ohCardEl({ id: 'back', type: 'back', faction: 'goblins', name: '', text: '' }, null);
