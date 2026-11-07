// Card backs ("sleeves", Nov 7): the art for each back a player can wear. Every sleeve's picture is art/sleeves/<id>.webp
// (Brush's 512x768 versions), except the Oreheart default and the chest back, which keep their older paths. So a new sleeve is a
// row in the database's sleeves table plus one picture: no code. The match screen paints the opponent's hand with their back.
// The Founder back uses Brush's "crest" design; Ken may pick "hero" instead (replace art/sleeves/founder.webp, no code change).
const OLD_PATHS: Record<string, string> = {
  default: '/art/ui/oreheart-card-back.webp',
  chest: '/art/packs/chest/chest-card-back.webp',
};
export const BACK_NAME: Record<string, string> = {
  default: 'Oreheart', chest: 'Treasure Chest', founder: 'Founder',
  'goblin-junkpile': 'Goblin Junkpile', 'gnome-arcane': 'Gnome Arcane', 'dwarf-deepforge': 'Dwarf Deepforge',
  'crystal-mine': 'Crystal Mine', 'piglet-stampede': 'Piglet Stampede', 'skullfang-arena': 'Skullfang Arena',
};
const ID_OK = /^[a-z][a-z0-9-]{0,29}$/;
export const backArt = (item: string | null | undefined) => {
  const id = item || 'default';
  if (OLD_PATHS[id]) return OLD_PATHS[id];
  return ID_OK.test(id) ? `/art/sleeves/${id}.webp` : OLD_PATHS.default;
};
/** Paint a card-back element (the enemy hand's backs, a preview) with a back's art. */
export function paintBack(el: HTMLElement, item: string | null | undefined) {
  const art = backArt(item);
  el.dataset.back = item || 'default';
  el.style.setProperty('background-image', `url(${art})`, 'important');
  for (const img of el.querySelectorAll('img')) { const s = img.getAttribute('src') || ''; if (/card-back|\/sleeves\//.test(s)) img.setAttribute('src', art); }
}
