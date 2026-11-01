// Mature avatars (Ken, Oct 31): an avatar marked "mature" in avatars.json has a "safe_fallback" of the same race
// and gender. A restricted viewer (see age.ts) never sees a mature avatar: not in the picker, and another
// player's mature pick shows as its fallback. The server enforces the same rules (set_avatar, avatar_as_seen_by).
// Nothing is ever shown or said about it to players: no badges, locks or messages. Pure functions, no DOM.
import { canSeeMature } from './age';

export interface AvatarEntry { id: string; race: string; gender: string; label: string; mature?: boolean; safe_fallback?: string }

export const isMature = (a: AvatarEntry | undefined) => !!a?.mature;

/** The avatars this viewer may see and pick. */
export function visibleAvatars<T extends AvatarEntry>(list: T[], group: string | null | undefined): T[] {
  return canSeeMature(group) ? list : list.filter((a) => !a.mature);
}

/** The avatar id a viewer should see for someone else's pick (the owner always sees their own pick as it is). */
export function avatarAsSeenBy(list: AvatarEntry[], id: string | null | undefined, group: string | null | undefined): string | null | undefined {
  if (!id || canSeeMature(group)) return id;
  const a = list.find((x) => x.id === id);
  if (!a || !a.mature) return id;
  const fb = a.safe_fallback && list.find((x) => x.id === a.safe_fallback && !x.mature);
  if (fb) return fb.id;
  // no usable fallback: the first non-mature avatar of the same race and gender, else the first non-mature one
  const same = list.find((x) => !x.mature && x.race === a.race && x.gender === a.gender);
  return (same || list.find((x) => !x.mature))?.id ?? null;
}

/** Avatars the computer players may use (never mature). */
export const aiAvatars = <T extends AvatarEntry>(list: T[]): T[] => list.filter((a) => !a.mature);
