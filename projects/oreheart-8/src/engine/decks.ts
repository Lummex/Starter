// Deck rules shared by the Deck Builder and the match setup.
import { CARDS, CONFIG, COMMANDERS, FACTIONS } from './content';

export function deckCounts(ids: string[]) {
  let creatures = 0, spells = 0, crystals = 0;
  for (const id of ids) {
    const t = CARDS[id]?.type;
    if (t === 'creature') creatures++; else if (t === 'spell') spells++; else if (t === 'crystal') crystals++;
  }
  return { cards: ids.length, creatures, spells, crystals };
}

const SING: Record<string, string> = { goblins: 'Goblin', gnomes: 'Gnome', dwarves: 'Dwarf' };
/** Problem messages for a deck; an empty list means the deck is legal. */
export function deckProblems(ids: string[], commander?: string): string[] {
  const out: string[] = [];
  const fac = commander ? (COMMANDERS[commander]?.faction ?? (FACTIONS[commander] ? commander : null)) : null;
  const seen = new Set<string>();
  for (const id of ids) {
    const c = CARDS[id];
    if (!c || seen.has(id)) continue;
    if (c.disabled) { seen.add(id); out.push(`${c.name} is not available yet.`); }
    else if (c.token) { seen.add(id); out.push(`${c.name} is a token: it appears in play and can't go in a deck.`); } // Nov 5
    else if (fac && c.type === 'spell' && c.faction !== 'any' && c.faction !== fac) { seen.add(id); out.push(`${c.name}: only for ${SING[c.faction] ?? c.faction} Commanders.`); }
  }
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
export function validateDeck(ids: string[], commander?: string) {
  const problems = deckProblems(ids, commander);
  return { legal: problems.length === 0, problems };
}

/** Shards streaming from one owned mine (Ken, Nov 1: twice as many as before, and the more Miners on the mine, the more crystals flow out):
 *  4 for the mine itself plus 4 for every Miner working it, at most 32 (1 Miner 8, 2 Miners 12, 3 Miners 16). */
export function flowShardCount(miners: number): number {
  const m = Math.max(1, Math.round(Number(miners) || 1));
  return Math.min(32, 4 + 4 * m);
}
