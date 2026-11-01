import { describe, it, expect } from 'vitest';
import { createMatch, applyAction as ap, legalActions, creatureAt } from '../src/engine';
const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const applyAction = (s: any, a: any): any => ap(s, a);
const mk = (board: any[]) => createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', mines: MINES, setup: { board, playerCrystals: 5 } });
describe('round 15', () => {
  it('facing set on summon and move', () => {
    const s = mk([{ cardId: 'goblin-scrapper', owner: 'player', row: 7, col: 3 }, { cardId: 'goblin-scrapper', owner: 'opponent', row: 1, col: 3 }]);
    expect(creatureAt(s, 7, 3).facing).toBe('N');
    expect(creatureAt(s, 1, 3).facing).toBe('S');
  });
  it('bowl knocks sideways and reports path/hits', () => {
    let s = mk([{ cardId: 'goblin-scrapper', owner: 'player', row: 7, col: 2 }, { cardId: 'goblin-grunt', owner: 'opponent', row: 4, col: 2 }]);
    s = applyAction(s, { type: 'done' }).state;
    const a = legalActions(s).find((x: any) => x.ability === 'bowl' && x.dr === -1);
    expect(a).toBeTruthy();
    const r: any = applyAction(s, a);
    expect(r.ok).toBe(true);
    const ev = r.events.find((e: any) => e.type === 'bowl');
    expect(ev.path.length).toBeGreaterThan(0);
    expect(ev.hits.length).toBe(1);
    expect(ev.hits[0].to.col).not.toBe(2);
    expect(ev.hits[0].to.row).toBe(4);
  });
});
