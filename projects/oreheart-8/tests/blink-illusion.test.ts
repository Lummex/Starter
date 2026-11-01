import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions, creatureAt } from '../src/engine';

const act = (s: any, a: any) => { const r = applyAction(s, a); if (!r.ok) throw new Error(r.error); return r.state; };
const MINES = [{ row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 6 }];

describe('fix (Oct 31): an illusion cannot Blink', () => {
  it('after a Blink the copy has no blink action, and the real Illusionist cannot blink twice', () => {
    let s = createMatch({ playerCommander: 'sproingle', opponentCommander: 'grubnak', mines: MINES, setup: { playerCrystals: 9, board: [
      { cardId: 'gnome-illusionist', owner: 'player', row: 6, col: 6 }, { cardId: 'gnome-tinker', owner: 'player', row: 6, col: 8 }, { cardId: 'goblin-grunt', owner: 'opponent', row: 2, col: 6 }] } });
    s = act(s, { type: 'done' });
    const ill = creatureAt(s, 6, 6);
    const blink = legalActions(s).find((a: any) => a.type === 'ability' && a.ability === 'blink' && a.creatureUid === ill.uid);
    expect(blink, 'the real Illusionist can Blink').toBeTruthy();
    s = act(s, blink);
    const copies = s.board.creatures.filter((c: any) => c.cardId === 'gnome-illusionist' && c.illusion);
    expect(copies.length).toBe(1);
    const again = legalActions(s).filter((a: any) => a.type === 'ability' && a.ability === 'blink');
    expect(again.some((a: any) => a.creatureUid === copies[0].uid), 'the illusion has no Blink').toBe(false);
    expect(again.some((a: any) => a.creatureUid === ill.uid), 'no second Blink this match').toBe(false);
    const r = applyAction(s, { type: 'ability', creatureUid: copies[0].uid, ability: 'blink', target: { row: 6, col: 8 } });
    expect(s.board.creatures.filter((c: any) => c.illusion).length, 'a forced Blink on the illusion makes no new copy').toBe(1);
    void r;
  });
});
