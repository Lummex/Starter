import FORMAT from '../../public/art/card-format/format.json';
import { makeOHRenderer } from './ohrender';
import HOLO from '../content/holo-masks.json';
import UPG from '../content/upgrade-art.json';
import './ohcard.css';

/** Upgraded cards (Nov 5): five tiers, looks only. Tier 1 is the card as painted; tiers 2-5 have their own picture (Brush) and coloured stars. */
export const TIER_NAMES = ['', 'Original', 'Enhanced', 'Overcharged', 'Legendary', 'Mythic'];
const UPG_IDS = new Set<string>((UPG as any).ids || []);
export const hasUpgradeArt = (id: string) => UPG_IDS.has(id);
/** The picture for a card at a tier: its upgrade art when painted, else the normal one. */
export function tierArt(card: any, tier: number | undefined, normal: string | null): string | null {
  const t = Math.max(1, Math.min(5, Number(tier) || 1));
  return t > 1 && card && UPG_IDS.has(card.id) ? `/art/upgrades/${card.id}/${t}.webp` : normal;
}
/** The star row for a tier (one dim star on an Original, 2-5 coloured ones), for the bottom edge of a card face. */
export function tierStars(tier: number | undefined): HTMLElement {
  const t = Math.max(1, Math.min(5, Number(tier) || 1));
  const el = document.createElement('div');
  el.className = 'oh-stars';
  el.setAttribute('data-tier', String(t));
  el.setAttribute('aria-label', TIER_NAMES[t]);
  el.innerHTML = Array.from({ length: t }, () => '<i></i>').join('');
  return el;
}

/** The owner's card format (Art Studio, "Card format final 1.0") drawn by his own renderer: every card face in the game goes through here. */
const R = makeOHRenderer(FORMAT as any);

export const fitCardText = (el: HTMLElement) => R.fitText(el);

/** Oct 31 (Ken: "I don't want the whole card to be holographic, just certain areas ... if it's crystals, the crystals should be
 *  holographic ... Definitely not over the text."): the rarities that shine today (Ultra Rare, Collector; Commanders are Collector) shine
 *  only through Sketch's mask of their picture, plus the frame's crystal pieces; cards without a mask get no holo. */
const HOLO_IDS = new Set<string>((HOLO as any).ids || []);
const HOLO_RARITIES = new Set(['Ultra Rare', 'Collector']);
export function holoMaskOf(card: any): string {
  if (!card || !HOLO_RARITIES.has(card.rarity)) return '';
  const id = String(card.id || '');
  const key = id.startsWith('cmd:') ? 'cmd-' + id.slice(4) : id;
  return HOLO_IDS.has(key) ? `/art/holo-masks/${key}.webp` : '';
}
const withHolo = (card: any) => { const m = holoMaskOf(card); return m ? { ...card, holoMask: m } : card; };

/** HTML string of a card face drawn at `px` height (the CSS makes it fill its parent). */
export function ohCardHTML(card: any, artUrl: string | null, px = 624): string {
  return R.cardHTML(withHolo(card), artUrl || '', px);
}

/** Card face element: `.ohcard > .cardc`, sized by its parent; the text shrinks to fit once it has a size. */
export function ohCardEl(card: any, artUrl: string | null): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ohcard';
  el.setAttribute('data-layout', card.type === 'back' ? 'back' : card.type === 'spell' ? (card.spellKind === 'regular' ? 'spell' : 'instant') : card.type === 'crystal' ? 'crystal' : card.type === 'commander' ? 'commander' : 'unit');
  el.setAttribute('data-card-format', 'Card format final 1.0');
  el.innerHTML = ohCardHTML(card, tierArt(card, card.tier, artUrl));
  if (card.type !== 'back' && card.type !== 'crystal') el.querySelector('.cardc')?.append(tierStars(card.tier)); // every card shows its tier, the Original with one dim star
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

/** R26.A7: the owner's "Prismatic Crystal World Emblem" picture of a faction (Card Format spell layer, byFaction), read from format.json. */
export function mineEmblemUrl(faction: string): string | null {
  const F: any = FORMAT;
  const layer = (F.layouts?.spell?.layers || []).find((l: any) => l.name === 'Prismatic Crystal World Emblem');
  const key = layer?.img?.byFaction?.['spell:' + faction];
  const url = key ? F.images?.[String(key).replace(/^img:/, '')] : null;
  return url || null;
}
