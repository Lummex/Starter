import cardsJson from '../content/cards.json';
import commandersJson from '../content/commanders.json';
import factionsJson from '../content/factions.json';
import colorsJson from '../content/crystal-colors.json';
import abilitiesJson from '../content/abilities.json';
import decksJson from '../content/starter-decks.json';
import configJson from '../content/game-config.json';

export const CARDS: Record<string, any> = Object.fromEntries((cardsJson as any[]).map((c) => [c.id, c]));
export const COMMANDERS: Record<string, any> = Object.fromEntries((commandersJson as any[]).map((c) => [c.id, c]));
export const FACTIONS: Record<string, any> = Object.fromEntries((factionsJson as any[]).map((c) => [c.id, c]));
export const COLORS: Record<string, any> = Object.fromEntries((colorsJson as any[]).map((c) => [c.id, c]));
export const ABILITIES: Record<string, any> = abilitiesJson as any;
export const STARTER_DECKS: Record<string, string[]> = decksJson as any;
export const CONFIG: any = configJson;
export const COLOR_ORDER = ['green', 'blue', 'purple'];
