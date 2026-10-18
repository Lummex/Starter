/** Unique step-by-step visual id for every spell (R3b.7): card flies out, turns into the effect, the result lands. */
export interface SpellVisual { glyph: string; land: string; fly: boolean; ms: number }
export const SPELL_VISUALS: Record<string, SpellVisual & { id: string }> = {
  'prospectors-prayer': { id: 'prayer-light-column', glyph: '🙏', land: '+CRYSTALS!', fly: false, ms: 1300 },
  'venom-shiv': { id: 'venom-dagger-drip', glyph: '🗡️', land: 'POISONED!', fly: true, ms: 1200 },
  'tunnel-rush': { id: 'tunnel-dust-burrow', glyph: '🕳️', land: 'RUSH!', fly: true, ms: 1100 },
  fireball: { id: 'fireball-arc', glyph: '🔥', land: 'BURN!', fly: true, ms: 1000 },
  'battle-cry': { id: 'battle-cry-shockwave', glyph: '📣', land: 'ATTACK UP!', fly: false, ms: 1300 },
  'meteor-strike': { id: 'meteor-sky-fall', glyph: '☄️', land: 'IMPACT!', fly: false, ms: 1200 },
  'healing-light': { id: 'healing-green-cross', glyph: '✚', land: 'HEALED!', fly: true, ms: 1200 },
  'shield-bubble': { id: 'shield-dome-bubble', glyph: '🛡️', land: 'SHIELDED!', fly: true, ms: 1400 },
  'second-wind': { id: 'second-wind-hearts', glyph: '💨', land: 'BREATHER!', fly: false, ms: 1300 },
  fizzle: { id: 'fizzle-spark-fade', glyph: '💫', land: 'FIZZLE!', fly: true, ms: 1000 },
  'hold-it': { id: 'hold-stop-stamp', glyph: '✋', land: 'HOLD IT!', fly: true, ms: 1100 },
  'spell-snap': { id: 'snap-lightning-crack', glyph: '⚡', land: 'SNAP!', fly: true, ms: 1000 },
  'mirror-hex': { id: 'mirror-flip-glass', glyph: '🪞', land: 'REFLECTED!', fly: true, ms: 1100 },
};
