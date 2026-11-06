// The dice box (Anvil, Nov 1; Ken: "a truly fresh roll, every time ... a little dice program it can access each time it needs to
// ... I don't want it to be pre-done", and "a random deck shuffler that actually shuffles the deck, so there can be no cheating").
//
// Every die roll, random pick and deck shuffle in a match goes through this module.
//  - 'live' (the default, every real match): each roll is fresh from the operating system's secure random source
//    (crypto.getRandomValues), made at the moment it is needed. Nothing is decided in advance, nothing is stored, and the match
//    state's `rng` field is not touched, so no seed or saved match can predict or replay a roll.
//  - 'seeded': rolls come from the match's own seeded generator (`nextRand(s)`), exactly as before, so the same seed gives the
//    same match. Used ONLY by the hidden checks (?test=1), the unit tests (vitest setup), the AI simulators/replays in
//    tools/ai-sim, and the computer's private look-ahead on its own copy of the board (so its thinking never uses real rolls).
//    A real match can never switch to it.
//
// Online PvP: this is where server-side rolls plug in. When matches are played against another person, the server (not either
// player's browser) rolls the dice and shuffles the decks; a 'server' mode here would take its results instead of
// crypto.getRandomValues, and the rest of the game keeps calling rollDie / randomIndex / shuffle unchanged.
import { nextRand } from './rng';

export type DiceMode = 'live' | 'seeded';
let mode: DiceMode = 'live';

export function setDiceMode(m: DiceMode): void { mode = m === 'seeded' ? 'seeded' : 'live'; }
export function getDiceMode(): DiceMode { return mode; }
/** Runs `fn` in mode `m`, then restores the previous mode (also when `fn` throws). */
export function withDiceMode<T>(m: DiceMode, fn: () => T): T {
  const prev = mode;
  setDiceMode(m);
  try { return fn(); } finally { mode = prev; }
}

// ---- the secure source: 32-bit values from crypto.getRandomValues, fetched a small batch at a time
const BUF = new Uint32Array(64);
let bufPos = BUF.length;
function freshU32(): number {
  if (bufPos >= BUF.length) {
    const c: any = (globalThis as any).crypto;
    if (!c || typeof c.getRandomValues !== 'function') throw new Error('dice: no secure random source (crypto.getRandomValues)');
    c.getRandomValues(BUF);
    bufPos = 0;
  }
  return BUF[bufPos++];
}
/** A fresh whole number 0..n-1 with no modulo bias (values above the last full multiple of n are thrown away and re-drawn). */
function freshIndex(n: number): number {
  if (!(n >= 1)) return 0;
  n = Math.floor(n);
  if (n > 0x100000000) throw new Error('dice: range too large');
  const limit = 0x100000000 - (0x100000000 % n); // largest multiple of n that fits in 32 bits
  let x: number;
  do x = freshU32(); while (x >= limit);
  return x % n;
}

/** One die: 1..faces. Live: a fresh secure roll (s.rng untouched). Seeded: `1 + floor(nextRand(s) * faces)`, as the game always did. */
export function rollDie(s: { rng: number }, faces = 6): number {
  if (mode === 'seeded') return 1 + Math.floor(nextRand(s) * faces);
  return 1 + freshIndex(faces);
}
/** A random index 0..n-1. Seeded: `floor(nextRand(s) * n)`. */
export function randomIndex(s: { rng: number }, n: number): number {
  if (mode === 'seeded') return Math.floor(nextRand(s) * n);
  return freshIndex(n);
}
/** A random number in [0, 1). Live: 53 fresh random bits. Seeded: `nextRand(s)`. */
export function randomFloat(s: { rng: number }): number {
  if (mode === 'seeded') return nextRand(s);
  return ((freshU32() >>> 5) * 67108864 + (freshU32() >>> 6)) / 9007199254740992;
}
/** Fisher-Yates shuffle, in place (returns the same array). Every position is equally likely in live play. */
export function shuffle<T>(s: { rng: number }, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIndex(s, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
