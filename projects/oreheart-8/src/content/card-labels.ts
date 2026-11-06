// Card labels and the pack Commanders, with no UI in them: shared by the game, the server engine bundle (match function, mock) and the checks.
// Nov 5: moved out of ui/cardfmt.ts, which pulls in CSS the server bundle cannot load.
import { CARDS, COMMANDERS } from '../engine';

/** The third upgrade tier. Ken (Nov 5): "Radiant" (the top RARITY is called Legendary, so the tier got its own name). */
export const TIER4_LABEL = 'Radiant';
export const TIER_NAMES = ['', 'Original', 'Enhanced', 'Overcharged', TIER4_LABEL, 'Mythic'];
/** The top rarity is stored as 'Collector' everywhere (keys, holo masks, odds); Ken calls it Legendary (Nov 5). Shown through this only. */
export const RARITY_LABEL: Record<string, string> = { Common: 'Common', Uncommon: 'Uncommon', Rare: 'Rare', 'Ultra Rare': 'Ultra Rare', Collector: 'Legendary' };
export const rarityLabel = (r: string) => RARITY_LABEL[r] || r;

/** A Commander as a `commander`-layout card (Choose Your Commander, close-ups). */
export function commanderCard(c: any) {
  return { id: 'cmd:' + c.id, type: 'commander', faction: c.faction, name: c.name, text: c.abilityText, health: c.health, cost: '', rarity: 'Collector', artPos: c.artPos };
}
/** Nov 5 (Ken: Commanders in packs at Rare): the pack / collection card for a Commander, by its pack id 'commander-<id>'. */
export const COMMANDER_PACK_IDS = ['commander-grubnak', 'commander-sproingle', 'commander-borgo'];
export const isCommanderPackId = (id: string) => typeof id === 'string' && id.startsWith('commander-');
export function commanderPackCard(id: string): any | null {
  if (!isCommanderPackId(id)) return null;
  const c = COMMANDERS[id.slice(10)];
  return c ? { ...commanderCard(c), id, commanderId: c.id, rarity: 'Rare', cost: 0 } : null;
}
/** A card by id, pack Commanders included (null when unknown). */
export const cardFor = (id: string): any | null => (CARDS as any)[id] || commanderPackCard(id);
