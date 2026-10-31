// Shared, dependency-free state so the deck code can follow the online flow without importing the network layer.
import type { SavedDeck } from '../ui/decks';
export const net = {
  active: false, // signed in and allowed: decks live on the server
  under13: false,
  offlineChosen: false,
  maxDecks: 30,
  decks: [] as SavedDeck[],
  saveDeck: (async () => { throw new Error('offline'); }) as (id: string | undefined, d: SavedDeck) => Promise<void>,
  removeDeck: (async () => { throw new Error('offline'); }) as (id: string) => Promise<void>,
};
