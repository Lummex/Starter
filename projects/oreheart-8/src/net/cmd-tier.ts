/** Nov 6 (Ken: "make sure that I can upgrade the commanders ... with the cards"): the Commander copy (tier) the player fights as.
 *  Every extra Commander copy from a pack feeds the upgrade steps (Rare); the player then picks WHICH copy stands on the board:
 *  Choose Your Commander and the PvP lobby offer the tiers he owns, the pick is kept on this device, and the server checks it
 *  against his real copies (a pick he does not own falls back to his best copy). Tier 1 = Original .. 5 = Mythic. */
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
