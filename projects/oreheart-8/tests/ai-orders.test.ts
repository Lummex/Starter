import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, CONFIG, CARDS, isMiner } from '../src/engine';
import { aiChoose, makeRand } from '../src/ai/ai';
import { planAiOrders, aiOrderAction, aiPlanSummary } from '../src/ai/orders-ai';
import { chaseList } from '../src/engine/orders';

(CONFIG as any).combat.dice = 'sure';
const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const P = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'player', row, col, ...x });
const O = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'opponent', row, col, ...x });
/** the computer (opponent) in its Action phase */
function aiAction(setup: any) {
  let s: any = createMatch({ playerCommander: 'grubnak', opponentCommander: 'borgo', factionLock: false, mines: MINES, setup: { firstPlayer: 'opponent', opponentHand: [], playerHand: [], ...setup } });
  s = applyAction(s, { type: 'done' }).state; // deploy -> action
  return s;
}
const at = (s: any, r: number, c: number) => s.board.creatures.find((x: any) => x.row === r && x.col === c);

describe('Nov 1 (Ken): the computer plans with the marker orders', () => {
  it('a rush on its Commander: the nearest fighters chase the rushers (Hard chains them), the rest guard', () => {
    const s = aiAction({ board: [O('dwarf-pickman', 2, 8), O('ironhammer-berserker', 3, 9), O('axe-thrower', 1, 6), P('goblin-grunt', 2, 11), P('goblin-grunt', 3, 12), P('shiv-rat', 6, 3)] });
    const st = planAiOrders(s, 'opponent', 'balanced', true);
    const roles = [...st.roles.values()];
    expect(roles.filter((r) => r === 'defend').length).toBeGreaterThanOrEqual(2);
    const def = [...st.orders.values()].filter((o) => o.kind === 'chase' && [at(s, 2, 11).uid, at(s, 3, 12).uid].includes(o.targetUid));
    expect(def.length).toBeGreaterThanOrEqual(2);
    expect(def.some((o) => chaseList(o).length >= 2)).toBe(true); // Hard chains the second rusher
    const a = aiOrderAction(s, 'opponent', true);
    expect(a && ['attack', 'move'].includes(a.type)).toBe(true);
    const medium = planAiOrders(s, 'opponent', 'balanced', false);
    expect([...medium.orders.values()].every((o) => chaseList(o).length <= 1)).toBe(true); // Medium chains nothing
  });
  it('an open enemy Commander (no fighter within 3 of him): fighters chase him (cmd:player) and the first step heads his way', () => {
    const s = aiAction({ board: [O('goblin-grunt', 3, 5), O('shiv-rat', 2, 4), P('goblin-scrounger', 3, 6), P('goblin-grunt', 4, 7)] }); // the player's fighter is far from both Commanders
    const st = planAiOrders(s, 'opponent', 'balanced', true);
    const rush = [...st.orders.values()].filter((o) => o.kind === 'chase' && o.targetUid === 'cmd:player');
    expect(rush.length).toBe(2);
    const a = aiOrderAction(s, 'opponent', true);
    expect(a).toBeTruthy();
    if (a.type === 'move') { const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid); expect(Math.max(Math.abs(a.row - 7), Math.abs(a.col - 2))).toBeLessThan(Math.max(Math.abs(c.row - 7), Math.abs(c.col - 2))); }
  });
  it('the enemy Commander is guarded and nobody rushes: fighters chase the nearest enemy fighter', () => {
    const s = aiAction({ board: [O('goblin-grunt', 3, 5), P('goblin-grunt', 6, 3), P('shiv-rat', 7, 3), P('goblin-grunt', 4, 8)] });
    const st = planAiOrders(s, 'opponent', 'balanced', true);
    const o: any = st.orders.get(at(s, 3, 5).uid);
    expect(o?.kind).toBe('chase');
    expect(o.targetUid).toBe(at(s, 4, 8).uid);
  });
  it('aiChoose takes the order step in the Action phase and re-plans when the board changes', () => {
    let s = aiAction({ board: [O('goblin-grunt', 3, 5), P('goblin-grunt', 4, 8)] });
    const a = aiChoose(s, 'hard', makeRand(1));
    expect(['move', 'attack']).toContain(a.type);
    expect(a.creatureUid).toBe(at(s, 3, 5).uid);
    const before = aiPlanSummary('opponent')!;
    s = applyAction(s, a).state;
    aiChoose(s, 'hard', makeRand(1));
    const after = aiPlanSummary('opponent')!;
    expect(after.turn).toBe(before.turn);
    expect(isMiner(CARDS['goblin-grunt'])).toBe(false);
  });
});
