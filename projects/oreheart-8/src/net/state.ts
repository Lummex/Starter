// Shared, dependency-free state so the deck code can follow the online flow without importing the network layer.
import type { SavedDeck } from '../ui/decks';
export const net = {
  active: false, // signed in and allowed: decks live on the server
  under13: false,
  ageGroup: null as string | null, // the signed-in account's stored age group; null when signed out or offline (restricted)
  offlineChosen: false,
  maxDecks: 30,
  decks: [] as SavedDeck[],
  saveDeck: (async () => { throw new Error('offline'); }) as (id: string | undefined, d: SavedDeck) => Promise<void>,
  removeDeck: (async () => { throw new Error('offline'); }) as (id: string) => Promise<void>,
  /** opens the Shop from anywhere (set once the economy screens are wired); null offline */
  openShop: null as (() => void) | null,
  /** Nov 6 (Dashboard): the signed-in avatar id, the Profile screen and the PvP doors (set by flow.ts / pvp.ts) */
  avatar: null as string | null,
  openProfile: null as (() => void) | null,
  openPvp: null as ((mode: 'ranked' | 'unranked' | 'friend') => void) | null,
};
