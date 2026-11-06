import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, CONFIG } from '../src/engine';
import { planOrder, mineActionFor, stanceAction, type Cell } from '../src/engine/orders';

(CONFIG as any).combat.dice = 'sure';
const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const P = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'player', row, col, ...x });
const O = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'opponent', row, col, ...x });
const at = (s: any, r: number, c: number) => s.board.creatures.find((x: any) => x.row === r && x.col === c);
function action(board: any[]) {
  let s: any = createMatch({ playerCommander: 'grubnak', opponentCommander: 'borgo', factionLock: false, mines: MINES, setup: { firstPlayer: 'player', playerHand: [], opponentHand: [], board } });
  return applyAction(s, { type: 'done' }).state;
}

describe('Ken, Nov 1: a standing mining order (drag a Miner onto a mine)', () => {
  it('plans a walk to a free square beside the mine, is never done by itself, and offers the mine action once there', () => {
    let s = action([P('goblin-scrounger', 7, 9), O('goblin-grunt', 1, 3)]);
    const m = at(s, 7, 9);
    const o: any = { kind: 'mine', uid: m.uid, site: { row: 4, col: 10 } };
    const plan = planOrder(s, o);
    expect(plan.blocked).toBe(false); expect(plan.done).toBe(false);
    expect(plan.path.length).toBeGreaterThanOrEqual(2);
    const last = plan.path[plan.path.length - 1];
    expect(Math.max(Math.abs(last.row - 4), Math.abs(last.col - 10))).toBe(1);
    expect(mineActionFor(s, m, o.site)).toBeNull(); // not there yet
    // beside the mine: nothing left to walk, and the mine action is there
    s = action([P('goblin-scrounger', 5, 10), O('goblin-grunt', 1, 3)]);
    const m2 = at(s, 5, 10);
    const p2 = planOrder(s, { kind: 'mine', uid: m2.uid, site: { row: 4, col: 10 } });
    expect(p2).toMatchObject({ path: [], blocked: false, done: false });
    const a = mineActionFor(s, m2, { row: 4, col: 10 });
    expect(a).toMatchObject({ type: 'mine', creatureUid: m2.uid, row: 4, col: 10 });
    expect(applyAction(s, a).ok).toBe(true);
  });
});

describe('Ken, Nov 1: guard arrows (guards never chase)', () => {
  const watch: Cell[] = [{ row: 5, col: 4 }, { row: 5, col: 5 }];
  it('a guard with watched squares hits an enemy standing on one, ignores one elsewhere in reach', () => {
    const s = action([P('goblin-grunt', 6, 4), O('goblin-pebbler', 5, 5), O('goblin-pebbler', 7, 5)]);
    const g = at(s, 6, 4);
    const a = stanceAction(s, g, 'guard', watch, { row: 6, col: 4 });
    expect(a).toMatchObject({ type: 'attack', target: { row: 5, col: 5 } });
    const s2 = action([P('goblin-grunt', 6, 4), O('goblin-pebbler', 7, 5)]);
    expect(stanceAction(s2, at(s2, 6, 4), 'guard', watch, { row: 6, col: 4 })).toBeNull(); // an enemy in reach but off the watched squares: left alone
  });
  it('steps once toward an enemy on a watched square just out of reach, and never follows one that is not on them', () => {
    const s = action([P('goblin-grunt', 7, 3), O('goblin-pebbler', 5, 5)]);
    const a = stanceAction(s, at(s, 7, 3), 'guard', watch, { row: 7, col: 3 });
    expect(a).toMatchObject({ type: 'move', row: 6, col: 4 });
    const s2 = action([P('goblin-grunt', 7, 3), O('goblin-pebbler', 3, 8)]);
    expect(stanceAction(s2, at(s2, 7, 3), 'guard', watch, { row: 7, col: 3 })).toBeNull();
  });
  it('with nothing on its squares it walks back to its post', () => {
    const s = action([P('goblin-grunt', 6, 4), O('goblin-pebbler', 1, 9)]);
    const a = stanceAction(s, at(s, 6, 4), 'guard', watch, { row: 7, col: 3 });
    expect(a).toMatchObject({ type: 'move', row: 7, col: 3 });
  });
});
