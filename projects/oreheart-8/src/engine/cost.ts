// Ken, Nov 1: a creature's cost and feet come from its stats, never from typed-in numbers, so a stat change can't drift:
//   cost = Attack + Health + ability bonus, halved and rounded up; above 10 the total climbs 2 per point (5 + 2 x (B - 10)); cap 12, min 1.
//   Ability bonus: +2 for a big ability (Flying, Charge, Haste, Unbreakable, Ramming), +1 for any other, 0 for Miner abilities; a card pays only its biggest.
//   Feet follow the cost: 1-3 -> 3, 4-6 -> 4, 7+ -> 5. Every Miner moves 1. Walls (card.wall, "slow by design") move CONFIG.wallMove.
//   A hand-set costOverride on a card wins over the formula; its feet still follow the formula cost.
// tools/gen-costs.py writes the same numbers into cards.json (for the editors, the card texts and the GDD); tests/cost-formula.test.ts fails if they drift.
import configJson from '../content/game-config.json';

const CF: any = (configJson as any).costFormula;
const FEET: any = (configJson as any).feetByCost;

export const isMinerCard = (card: any) => card.role === 'Gatherer' || card.role === 'Smith';

/** +2 for a big ability, +1 for a small one, 0 for Miner abilities; only the biggest counts. */
export function abilityBonus(card: any): number {
  let b = 0;
  for (const a of (card.abilities || []) as string[]) {
    if (CF.minerAbilities.includes(a) || (CF.zeroAbilities || []).includes(a)) continue; // Nov 5: tiny perks (Hex Cadet, Ratchet Runt, Eager) and a token's Harmless cost nothing
    b = Math.max(b, CF.bigAbilities.includes(a) ? CF.bigBonus : CF.smallBonus);
  }
  return b;
}

/** The formula cost (ignores any override). */
export function formulaCost(card: any): number {
  const B = (card.attack || 0) + (card.health || 0) + abilityBonus(card);
  const raw = B <= CF.halfUpTo ? Math.ceil(B / 2) : CF.overBase + CF.overPer * (B - CF.halfUpTo);
  return Math.max(CF.min, Math.min(CF.cap, raw));
}

/** What the card costs to play: the hand-set override when there is one, else the formula. */
export const cardCost = (card: any): number => (card.costOverride != null ? card.costOverride : formulaCost(card));

/** How far the card walks per turn (move points). */
export function cardFeet(card: any): number {
  if (isMinerCard(card)) return FEET.miner;
  if (card.wall) return (configJson as any).wallMove;
  const c = formulaCost(card);
  return c <= 3 ? FEET.upTo3 : c <= 6 ? FEET.upTo6 : FEET.else;
}
