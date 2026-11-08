// Shared, dependency-free state so the deck code can follow the online flow without importing the network layer.
import type { SavedDeck } from '../ui/decks';
export const net = {
  active: false, // signed in and allowed: decks live on the server
  under13: false,
  ageGroup: null as string | null, // the signed-in account's stored age group; null when signed out or offline (restricted)
  offlineChosen: false,
  /** Nov 7 (launch): which database this page is signed in to (server_info().server_kind); production hides every TEST marker */
  serverKind: 'test' as 'test' | 'production',
  maxDecks: 30,
  /** Nov 7 (Ken): the name of the deck picked in the PvP lobby, shown bottom-left in the match */
  matchDeckName: '',
  decks: [] as SavedDeck[],
  saveDeck: (async () => { throw new Error('offline'); }) as (id: string | undefined, d: SavedDeck) => Promise<void>,
  removeDeck: (async () => { throw new Error('offline'); }) as (id: string) => Promise<void>,
  /** opens the Shop from anywhere (set once the economy screens are wired); null offline */
  openShop: null as (() => void) | null,
  /** Nov 6 (Dashboard): the signed-in avatar id, the Profile screen and the PvP doors (set by flow.ts / pvp.ts) */
  avatar: null as string | null,
  /** Nov 7: the signed-in player's avatar frame and title (Producer), and the Founder avatars they were given */
  frame: null as string | null,
  title: null as string | null,
  founderAvatars: [] as string[],
  openLooks: null as (() => void) | null,
  openProfile: null as (() => void) | null,
  /** Nov 7: the card-back chooser (set by the Dashboard, which has the app) */
  openCardBacks: null as (() => void) | null,
  openPvp: null as ((mode: 'ranked' | 'unranked' | 'friend') => void) | null,
};
