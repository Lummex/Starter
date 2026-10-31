// The computer opponent's thinking, off the main thread (Anvil, Oct 31; Ken: "the game seems kind of stuttery and laggy").
// Hard's search can spend up to 1.2 s per turn in 50-300 ms chunks; on the main thread every chunk froze the animation.
// The match controller (game.ts) posts the match state here and applies the answer when it comes back; the drawing goes on.
// Test mode (hidden checks, probes) keeps the old synchronous path, so replays stay step for step the same.
import { aiChoose, makeRand } from './ai';

self.onmessage = (e: MessageEvent) => {
  const { id, state, difficulty, seed } = e.data || {};
  const t0 = performance.now();
  let action: any = null, error: string | null = null;
  try { action = aiChoose(state, difficulty, makeRand(seed)); } catch (err: any) { error = String((err && err.message) || err); }
  (self as any).postMessage({ id, action, error, ms: performance.now() - t0 });
};
