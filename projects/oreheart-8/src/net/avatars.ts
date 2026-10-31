// Player avatars (Ken, Oct 31: painted portraits, not card art). Brush's list is src/content/avatars.json
// (all planned avatars, Ken's Goggle Rogue first); each picture is public/art/avatars/<id>.webp (512 px).
// Shape: {default, avatars:[{id, race, gender, label, shipped, mature?, safe_fallback?}]}, written by tools/avatars-copy.py;
// the same file feeds the match name plates (src/ui/avatars.ts).
// The picker shows an avatar as soon as its picture is in that folder, so new pictures just drop in.
// The server's allowed list (settings avatar_cards) holds every id in avatars.json plus the old card ids.
// Mature avatars and the age rules: mature.ts / age.ts.
import LIST from '../content/avatars.json';
import { CARDS } from '../engine';
import { pictureOf } from '../ui/app';
import { net } from './state';
import { aiAvatars, avatarAsSeenBy, visibleAvatars, type AvatarEntry } from './mature';

export type Avatar = AvatarEntry;
export const AVATAR_LIST = (LIST as unknown as { avatars: Avatar[] }).avatars;
export const DEFAULT_AVATAR: string = (LIST as unknown as { default?: string }).default || AVATAR_LIST[0].id; // goblin-goggle-rogue

const RACE_LABELS: Record<string, string> = { goblin: 'Goblins', gnome: 'Gnomes', dwarf: 'Dwarves', human: 'Humans', undead: 'Undead', troll: 'Trolls' };
/** Races in the order they first appear in Brush's list, so a new race (trolls, Oct 31) shows up by itself. */
export const RACES: [string, string][] = [...new Set(AVATAR_LIST.map((a) => a.race))].map((r) => [r, RACE_LABELS[r] || r.charAt(0).toUpperCase() + r.slice(1) + 's']);

const byId = new Map(AVATAR_LIST.map((a) => [a.id, a]));
export const avatarById = (id: string | null | undefined) => (id ? byId.get(id) : undefined);

/** The avatars the signed-in player may see and pick (restricted when signed out or offline). */
export const pickableAvatars = () => visibleAvatars(AVATAR_LIST, net.ageGroup);
/** Avatars for the computer players: never mature. */
export const AI_AVATARS = aiAvatars(AVATAR_LIST);

/** Another player's avatar as this viewer should see it (a restricted viewer gets the safe stand-in). */
export const avatarForViewer = (id: string | null | undefined) => avatarAsSeenBy(AVATAR_LIST, id, net.ageGroup);

/** Picture for a saved avatar: a portrait, an older card-art avatar, or the default portrait. */
export function avatarPicture(id: string | null | undefined): string {
  if (id && byId.has(id)) return `/art/avatars/${id}.webp`;
  const card = id ? CARDS[id] : null;
  return (card && pictureOf(card)) || `/art/avatars/${DEFAULT_AVATAR}.webp`;
}

export function avatarName(id: string | null | undefined): string {
  return avatarById(id)?.label || (id && CARDS[id]?.name) || avatarById(DEFAULT_AVATAR)!.label;
}
