// Player avatars on the name plates (Brush's 60, art/avatars; copied by tools/avatars-copy.py).
// Ken, Oct 31: the player gets goblin-goggle-rogue until Online supplies theirs; every AI rival has a fixed avatar of its own race.
import AV from '../content/avatars.json';

export interface Avatar { id: string; race: string; gender?: string; label: string; shipped: boolean; mature?: boolean; safe_fallback?: string }
export const AVATARS: Avatar[] = (AV as any).avatars;
export const DEFAULT_AVATAR: string = (AV as any).default;
const shipped = new Set(AVATARS.filter((a) => a.shipped).map((a) => a.id));
const hash = (s: string) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };

/** Ken, Nov 1: a mature avatar shows only to its owner on a 16+ account; signed-out, offline and under-16 viewers see its safe stand-in, with no wording about it anywhere.
 *  Online Phase A turns this on for a signed-in 16+ account (setMatureAllowed). Offline it is always off. */
let matureAllowed = false;
export function setMatureAllowed(on: boolean) { matureAllowed = on; }
export const isMatureAllowed = () => matureAllowed;
const byId = new Map(AVATARS.map((a) => [a.id, a]));
/** The avatar to show for a planned id: its own picture once Brush has painted it (a mature one only when allowed, else its safe stand-in), until then a painted one of the same race. */
export function shownAvatar(id: string): string {
  const a = byId.get(id);
  if (a?.mature && !matureAllowed) { const f = a.safe_fallback || ''; if (f && shipped.has(f)) return f; }
  if (shipped.has(id)) return id;
  const race = AVATARS.find((a) => a.id === id)?.race;
  const same = AVATARS.filter((a) => a.shipped && a.race === race && a.id !== DEFAULT_AVATAR);
  const pool = same.length ? same : AVATARS.filter((a) => a.shipped && a.id !== DEFAULT_AVATAR);
  return pool.length ? pool[hash(id) % pool.length].id : '';
}
export const avatarUrl = (id: string) => { const s = id ? shownAvatar(id) : ''; return s ? `/art/avatars/${s}.webp` : ''; };

/** Your avatar: Online Phase A plugs the account's choice in with setPlayerAvatarProvider(); until then a locally saved one, else Ken's pick. */
let provider: (() => string | null | undefined) | null = null;
export function setPlayerAvatarProvider(fn: (() => string | null | undefined) | null) { provider = fn; }
export function getPlayerAvatar(): string {
  try { const p = provider?.(); if (p && AVATARS.some((a) => a.id === p)) return p; } catch { /* fall through */ }
  try { const s = localStorage.getItem('oreheart.avatar'); if (s && AVATARS.some((a) => a.id === s)) return s; } catch { /* storage blocked */ }
  return DEFAULT_AVATAR;
}

/** The planned avatars a faction's rivals take, in order: their own race first, then the races that fit anyone (trolls with the goblins, humans with the gnomes,
 *  the undead with the dwarves), so the 60 rivals each get a fixed one. Ken's goblin-goggle-rogue stays the player's. */
export function rivalAvatars(faction: string): string[] {
  const race = faction === 'gnomes' ? 'gnome' : faction === 'dwarves' ? 'dwarf' : 'goblin';
  const extra = faction === 'gnomes' ? ['human', 'undead'] : faction === 'dwarves' ? ['undead', 'human'] : ['troll', 'human'];
  const ids = (r: string) => AVATARS.filter((a) => a.race === r && a.id !== DEFAULT_AVATAR && !a.mature).map((a) => a.id); // rivals never take a mature one
  return [...ids(race), ...extra.flatMap(ids)];
}
