import cardsJson from '../content/cards.json';
import commandersJson from '../content/commanders.json';
import factionsJson from '../content/factions.json';
import colorsJson from '../content/crystal-colors.json';
import abilitiesJson from '../content/abilities.json';
import decksJson from '../content/starter-decks.json';
import configJson from '../content/game-config.json';
import flavorJson from '../content/card-flavor.json';

const FLAV: Record<string, string[]> = flavorJson as any;
export const CARDS: Record<string, any> = Object.fromEntries((cardsJson as any[]).map((c) => [c.id, { ...c, tagline: FLAV[c.id]?.[0] || c.name, flavor: FLAV[c.id]?.[1] || 'Nobody wrote this one down.' }]));
export const COMMANDERS: Record<string, any> = Object.fromEntries((commandersJson as any[]).map((c) => [c.id, c]));
export const FACTIONS: Record<string, any> = Object.fromEntries((factionsJson as any[]).map((c) => [c.id, c]));
export const COLORS: Record<string, any> = Object.fromEntries((colorsJson as any[]).map((c) => [c.id, c]));
export const ABILITIES: Record<string, any> = abilitiesJson as any;
export const STARTER_DECKS: Record<string, string[]> = decksJson as any;
export const CONFIG: any = configJson;
export const COLOR_ORDER = ['green', 'blue', 'purple'];

/** Weapon shown on a creature's 3D figure (first matching rule wins). */
export function weaponOf(c: any): string | null {
  if (!c || c.type !== 'creature') return null;
  const ab: string[] = c.abilities || [];
  if (c.rarity === 'Collector') return 'signature';
  if (ab.includes('flying')) return 'gyro';
  if (ab.includes('charge') || c.id === 'wolf-rider' || c.id === 'ram-rider') return 'lance';
  if (ab.includes('ranged')) return c.id === 'axe-thrower' ? 'axes' : c.faction === 'goblins' ? 'sling' : c.faction === 'gnomes' ? 'wand' : 'crossbow';
  if (ab.includes('guard')) return 'sword-shield';
  if (c.role === 'Gatherer' && c.abilities?.some((a: string) => a.startsWith('eater'))) return 'pick-crystal';
  if (c.role === 'Smith') return 'pick-hammer';
  if (c.role === 'Gatherer') return 'pick';
  return 'sword';
}
