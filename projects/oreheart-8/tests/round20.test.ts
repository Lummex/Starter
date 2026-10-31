import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, creatureAt, CONFIG } from '../src/engine';

const act = (s: any, a: any) => { const r = applyAction(s, a); if (!r.ok) throw new Error(r.error); return r.state; };
const done = (s: any, n = 1) => { for (let i = 0; i < n; i++) s = act(s, { type: 'done' }); return s; };
const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const mk = (setup: any) => createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', mines: MINES, setup });
const P = (cardId: string, row: number, col: number) => ({ cardId, owner: 'player', row, col });
const at = (s: any, r: number, c: number) => creatureAt(s, r, c);
const G = () => CONFIG.basicGatherers.goblins;
/** Player mines with the listed miners, then plays through to their next turn's Deploy phase. */
function nextTurnHand(board: any[], minesBy: [number, number, number, number][]) {
  let s = done(mk({ board }));
  for (const [r, c, mr, mc] of minesBy) s = act(s, { type: 'mine', creatureUid: at(s, r, c).uid, row: mr, col: mc });
  const before = s.players.player.hand.length;
  s = done(s);                         // end player's turn
  while (s.activePlayer !== 'player') s = done(s);
  return { gained: s.players.player.hand.length - before, s };
}

describe('round 20: bonus draws', () => {
  it('config: 1 extra card per 4 crystals mined, 1 for holding all mines', () => {
    expect(CONFIG.minedPerBonusCard).toBe(4);
    expect(CONFIG.allMinesBonusCards).toBe(1);
  });
  it('2 crystals mined: only the normal draw', () => {
    const { gained } = nextTurnHand([P(G(), 3, 5)], [[3, 5, 3, 6]]);
    expect(gained).toBe(1);
  });
  it('4 crystals mined at one mine: normal draw + 1', () => {
    const { gained, s } = nextTurnHand([P(G(), 3, 5), P(G(), 2, 6)], [[3, 5, 3, 6], [2, 6, 3, 6]]);
    expect(gained).toBe(2);
    expect(s.events?.some?.((e: any) => e.type === 'bonusDraw') ?? true).toBe(true);
  });
  it('8 crystals mined: normal draw + 2', () => {
    const b = [P(G(), 3, 5), P(G(), 2, 6), P(G(), 5, 5), P(G(), 6, 6)];
    const { gained } = nextTurnHand(b, [[3, 5, 3, 6], [2, 6, 3, 6], [5, 5, 5, 6], [6, 6, 5, 6]]);
    expect(gained).toBe(3);
  });
  it('all three mines yours (6 crystals): normal draw + 1 for mining + 1 for all mines', () => {
    const b = [P(G(), 3, 5), P(G(), 5, 5), P(G(), 4, 9)];
    const { gained } = nextTurnHand(b, [[3, 5, 3, 6], [5, 5, 5, 6], [4, 9, 4, 10]]);
    expect(gained).toBe(3);
  });
});
