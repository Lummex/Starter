// Player avatars (Ken, Oct 31: painted portraits, not card art). Brush's list is src/content/avatars.json
// (all planned avatars, Ken's Goggle Rogue first); each picture is public/art/avatars/<id>.webp (512 px).
// The picker shows an avatar as soon as its picture is in that folder, so new pictures just drop in.
// The server's allowed list (settings avatar_cards) holds every id in avatars.json plus the old card ids.
import LIST from '../content/avatars.json';
import { CARDS } from '../engine';
import { pictureOf } from '../ui/app';

export interface Avatar { id: string; race: string; gender: string; label: string }
export const AVATAR_LIST = LIST as Avatar[];
export const DEFAULT_AVATAR = AVATAR_LIST[0].id; // goblin-goggle-rogue
export const RACES: [string, string][] = [['goblin', 'Goblins'], ['gnome', 'Gnomes'], ['dwarf', 'Dwarves'], ['human', 'Humans'], ['undead', 'Undead']];

const byId = new Map(AVATAR_LIST.map((a) => [a.id, a]));
export const avatarById = (id: string | null | undefined) => (id ? byId.get(id) : undefined);

/** Picture for a saved avatar: a portrait, an older card-art avatar, or the default portrait. */
export function avatarPicture(id: string | null | undefined): string {
  if (id && byId.has(id)) return `/art/avatars/${id}.webp`;
  const card = id ? CARDS[id] : null;
  return (card && pictureOf(card)) || `/art/avatars/${DEFAULT_AVATAR}.webp`;
}

export function avatarName(id: string | null | undefined): string {
  return avatarById(id)?.label || (id && CARDS[id]?.name) || avatarById(DEFAULT_AVATAR)!.label;
}
