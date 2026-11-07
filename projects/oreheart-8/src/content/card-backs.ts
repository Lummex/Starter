// Card backs (Nov 7): the art for each back a player can wear. The match screen paints the opponent's hand with theirs.
// The Founder back is a placeholder until Brush's painting replaces art/ui/card-backs/founder.webp (same file name, no code change).
export const BACK_ART: Record<string, string> = {
  default: '/art/ui/oreheart-card-back.webp',
  chest: '/art/packs/chest/chest-card-back.webp',
  founder: '/art/ui/card-backs/founder.webp',
};
export const BACK_NAME: Record<string, string> = { default: 'Oreheart', chest: 'Treasure Chest', founder: 'Founder' };
export const backArt = (item: string | null | undefined) => BACK_ART[item || 'default'] || BACK_ART.default;
/** Paint a card-back element (the enemy hand's backs, a preview) with a back's art. */
export function paintBack(el: HTMLElement, item: string | null | undefined) {
  const art = backArt(item);
  el.dataset.back = item || 'default';
  el.style.setProperty('background-image', `url(${art})`, 'important');
  for (const img of el.querySelectorAll('img')) { const s = img.getAttribute('src') || ''; if (/card-back/.test(s)) img.setAttribute('src', art); }
}
