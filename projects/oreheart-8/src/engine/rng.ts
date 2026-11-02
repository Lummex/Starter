// Seeded RNG (mulberry32). The generator state lives in the match state (`rng`) so it stays serializable.
export function nextRand(s: { rng: number }): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// Shuffles live in dice.ts now (fresh, secure shuffles in a real match; seeded ones for tests). Re-exported so old imports keep working.
export { shuffle } from './dice';
