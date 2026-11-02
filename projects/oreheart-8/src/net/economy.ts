// Coins, packs, collection and quests: menu hooks (Helper B fills this in; see factory-design/design/oreheart-pvp-nov2-contract.md part 4)
type El = HTMLElement;
/** Main-menu extras when signed in: coin chip + Shop / Collection / Quests buttons. */
export function economyMenu(_el: El): void { /* filled in by the economy worker */ }
/** Called by the match screen when a match ends; vs-computer matches report quest progress. */
export async function onMatchEnd(_o: { state: any; events: any[]; pvp: boolean }): Promise<void> { /* filled in by the economy worker */ }
/** Re-reads the coin count shown on the menu. */
export async function refreshCoins(): Promise<void> { /* filled in by the economy worker */ }
