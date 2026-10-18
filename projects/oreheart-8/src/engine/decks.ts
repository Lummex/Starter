// Deck rules shared by the Deck Builder and the match setup.
import { CARDS, CONFIG } from './content';

export function deckCounts(ids: string[]) {
  let creatures = 0, spells = 0, crystals = 0;
  for (const id of ids) {
    const t = CARDS[id]?.type;
    if (t === 'creature') creatures++; else if (t === 'spell') spells++; else if (t === 'crystal') crystals++;
  }
  return { cards: ids.length, creatures, spells, crystals };
}

/** Problem messages for a deck; an empty list means the deck is legal. */
export function deckProblems(ids: string[]): string[] {
  const out: string[] = [];
  if (ids.length < CONFIG.deckMin || ids.length > CONFIG.deckMax) out.push(`Needs ${CONFIG.deckMin} to ${CONFIG.deckMax} cards (now ${ids.length}).`);
  const n: Record<string, number> = {};
  for (const id of ids) n[id] = (n[id] || 0) + 1;
  for (const [id, k] of Object.entries(n)) {
    const lim = CONFIG.copyLimits[CARDS[id]?.rarity];
    if (lim != null && k > lim) out.push(`${CARDS[id].name}: at most ${lim} copies (now ${k}).`);
  }
  const cr = deckCounts(ids).crystals;
  if (cr > CONFIG.crystalCardLimit) out.push(`At most ${CONFIG.crystalCardLimit} Crystal cards (now ${cr}).`);
  return out;
}

/** Test hook: legality and problem messages for a list of card ids. */
export function validateDeck(ids: string[]) {
  const problems = deckProblems(ids);
  return { legal: problems.length === 0, problems };
}
