/** Unique visual id for every spell (R3b.7). Oct 31 (Ken: "make it like an event"): the emoji glyphs are gone; every spell plays
 *  Brush's painted FX (public/art/spell-fx, timing in spell-fx-spec.json, played by src/ui/spell-fx.ts). */
import SPEC from './spell-fx-spec.json';
export interface SpellVisual { id: string; path: string; ms: number; word: string }
export const SPELL_VISUALS: Record<string, SpellVisual> = Object.fromEntries(
  Object.entries((SPEC as any).spells).map(([k, s]: [string, any]) => [k, { id: `${k}-painted-${s.path.replace(/_/g, '-')}`, path: s.path, ms: s.total_ms, word: s.sound_word }]),
);
