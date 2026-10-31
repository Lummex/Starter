// Replays the factory's hidden checks AC21 and AC114 headlessly (same seed 1 and AI seed 978 as the test page).
import { createMatch, applyAction } from '../../src/engine';
import { aiChoose as newC, makeRand } from '../../src/ai/ai';
import { aiChoose as oldC } from './ai-old';
function run(choose: any, opts: any, passive: boolean, diff = 'normal') {
  let s: any = createMatch({ seed: 1, testMode: true, ...opts });
  const rand = makeRand(978); let n = 0, turn = -1, g = 0, ms = 0, calls = 0;
  while (s.phase !== 'over' && s.turn < 200 && g++ < 40000) {
    if (s.turn !== turn) { turn = s.turn; n = 0; }
    let a: any;
    if (passive && s.priority === 'player') a = s.pendingResponse ? { type: 'pass' } : s.phase === 'mulligan' ? { type: 'mulligan', uids: [] } : { type: 'done' };
    else { const t0 = performance.now(); a = choose(s, diff, rand); ms += performance.now() - t0; calls++; if (++n > 60 && !s.pendingResponse && s.phase !== 'mulligan') a = { type: 'done' }; }
    let r: any = applyAction(s, a); if (!r.ok) r = applyAction(s, s.pendingResponse ? { type: 'pass' } : s.phase === 'mulligan' ? { type: 'mulligan', uids: [] } : { type: 'done' });
    s = r.state;
  }
  return { winner: s.winner, turn: s.turn, aiSeconds: +(ms / 1000).toFixed(1), decisions: calls };
}
const ac21 = { skipMulligan: true, firstPlayer: 'player', opponentCommander: 'grubnak', playerCommander: 'sproingle' };
console.log('AC21 old', JSON.stringify(run(oldC, ac21, true)), 'new', JSON.stringify(run(newC, ac21, true)));
console.log('AC21-hard new', JSON.stringify(run(newC, ac21, true, 'hard')));
for (const st of ['warband', 'mine-rush', 'arcane-hoard', 'expedition']) {
  const o = { skipMulligan: true, playerCommander: 'grubnak', opponentCommander: 'sproingle', playerDeckId: `goblin-${st}`, opponentDeckId: `gnome-${st}` };
  console.log('AC114', st, 'old', JSON.stringify(run(oldC, o, false)), 'new', JSON.stringify(run(newC, o, false)));
}
