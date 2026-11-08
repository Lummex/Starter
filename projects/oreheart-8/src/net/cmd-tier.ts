/** Nov 6 (Ken: "make sure that I can upgrade the commanders ... with the cards"): the Commander copy (tier) the player fights as.
 *  Every extra Commander copy from a pack feeds the upgrade steps (Rare); the player then picks WHICH copy stands on the board:
 *  Choose Your Commander and the PvP lobby offer the tiers he owns, the pick is kept on this device, and the server checks it
 *  against his real copies (a pick he does not own falls back to his best copy). Tier 1 = Original .. 5 = Mythic. */
import { net } from './state';
const KEY = 'oreheart.cmdTier';
const owned: Record<string, number[]> = {};
const read = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
/** the tiers the player owns a copy of (from my_upgrade_info's by_tier), once known */
export function setCommanderTiersOwned(id: string, tiers: number[]) { owned[id] = tiers.filter((t) => t >= 1 && t <= 5); }
export function commanderTiersOwned(id: string): number[] | null { return owned[id] ? owned[id].slice() : null; }
/** the tier to fight as: the pick when owned (or not yet checkable), else the best owned copy, else Original */
export function chosenCommanderTier(id: string): number {
  const pick = Math.max(0, Math.min(5, Math.round(Number(read()[id]) || 0)));
  const have = owned[id];
  if (!have) return pick || 1;
  if (pick && have.includes(pick)) return pick;
  return have.length ? Math.max(...have) : 1;
}
export function setChosenCommanderTier(id: string, tier: number) {
  try { const o = read(); o[id] = Math.max(1, Math.min(5, Math.round(tier) || 1)); localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* storage unavailable */ }
}

/** Nov 7 (Ken: "When my commanders upgraded to Mythic, it just shows the regular image"): a Commander's picture at a tier
 *  (tiers 2-5 are Brush's upgrade paintings), and the picture of the copy this player fights as (signed in; else the Original). */
export const commanderBasePortrait = (id: string) => (id === 'grubnak' ? '/art/owner/goblin/grubnak-on-throne-art.png' : id === 'sproingle' ? '/art/owner/gnome/sproingle-portrait.webp' : id === 'borgo' ? '/art/owner/dwarf/borgo-portrait.webp' : `/art/commanders/${id}.webp`);
const UPGRADED = new Set(['grubnak', 'sproingle', 'borgo']);
export function commanderPortraitAt(id: string, tier: number): string {
  const t = Math.max(1, Math.min(5, Math.round(Number(tier)) || 1));
  return t > 1 && UPGRADED.has(id) ? `/art/upgrades/commander-${id}/${t}.webp` : commanderBasePortrait(id);
}
export const myCommanderTier = (id: string) => (net.active ? chosenCommanderTier(id) : 1);
export const myCommanderPortrait = (id: string) => commanderPortraitAt(id, myCommanderTier(id));
