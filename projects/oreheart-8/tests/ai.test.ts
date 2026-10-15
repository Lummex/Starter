import { describe, it, expect } from 'vitest';
import { createMatch, applyAction } from '../src/engine';
import { aiChoose, makeRand } from '../src/ai/ai';

function play(s: any, diffs: any, passive: boolean, max = 200) {
  const rand = makeRand(7);
  let guard = 0;
  while (s.phase !== 'over' && s.turn < max && guard++ < 20000) {
    const who = s.priority;
    let a: any;
    if (who === 'player' && passive) a = s.phase === 'mulligan' ? { type: 'mulligan', uids: [] } : s.pendingResponse ? { type: 'pass' } : { type: 'done' };
    else a = aiChoose(s, diffs[who], rand);
    let r = applyAction(s, a);
    if (!r.ok) { r = applyAction(s, s.pendingResponse ? { type: 'pass' } : { type: 'done' }); }
    expect(r.ok).toBe(true);
    s = r.state;
  }
  return s;
}

describe('AI', () => {
  for (const seed of [1, 2, 3, 4]) {
    it('normal beats a passive player before turn 60 (seed ' + seed + ')', () => {
      const s = play(createMatch({ seed, playerCommander: ['grubnak', 'sproingle', 'borgo'][seed % 3], opponentCommander: 'borgo', firstPlayer: 'player' }), { opponent: 'normal' }, true);
      expect(s.winner).toBe('opponent');
      expect(s.turn).toBeLessThan(60);
    });
  }
  it('hard vs normal finishes and hard beats a passive player', () => {
    const s = play(createMatch({ seed: 5, skipMulligan: true }), { player: 'hard', opponent: 'normal' }, false, 120);
    expect(s.turn).toBeGreaterThan(2);
    const w = play(createMatch({ seed: 6, playerCommander: 'borgo', opponentCommander: 'grubnak' }), { opponent: 'hard' }, true);
    expect(w.winner).toBe('opponent');
  });
  it('easy vs normal finishes', () => {
    const s = play(createMatch({ seed: 9, skipMulligan: true }), { player: 'easy', opponent: 'normal' }, false, 120);
    expect(s.turn).toBeGreaterThan(2);
  });
});
