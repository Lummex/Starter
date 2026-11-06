import { describe, it, expect } from 'vitest';
import { CONFIG as _CFG } from '../src/engine';
(_CFG as any).combat.dice = 'sure'; // Combat v2 (Nov 1): these older tests pin exact damage, so every swing lands and nothing blocks here (the dice have their own tests)
import { createMatch, applyAction, creatureAt, moveDests, CARDS, CONFIG } from '../src/engine';
import { shortestPath, turnsFor, nextStep, canAttackFrom, chasePath, planOrder, attackActionOn } from '../src/engine/orders';

const act = (s: any, a: any) => { const r = applyAction(s, a); if (!r.ok) throw new Error(r.error); return r.state; };
const done = (s: any, n = 1) => { for (let i = 0; i < n; i++) s = act(s, { type: 'done' }); return s; };
const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const mk = (board: any[]) => done(createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', mines: MINES, setup: { board } }));
const P = (cardId: string, row: number, col: number) => ({ cardId, owner: 'player', row, col });
const O = (cardId: string, row: number, col: number) => ({ cardId, owner: 'opponent', row, col });
const at = (s: any, r: number, c: number) => creatureAt(s, r, c);
const cheb = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
const has = (path: any[], r: number, c: number) => path.some((q) => q.row === r && q.col === c);
const isMine = (q: any) => MINES.some((m) => m.row === q.row && m.col === q.col);
/** Every step of a path is one king-step from the previous square. */
const connected = (start: any, path: any[]) => path.every((q, i) => cheb(q, i ? path[i - 1] : start) === 1);

describe('Round 28 orders: card assumptions', () => {
  it('cards used here have the expected move/abilities', () => {
    expect(CARDS['goblin-grunt'].move).toBe(3); // Ken, Nov 1: feet follow the cost (1-3 walks 3)
    expect(CARDS['goblin-grunt'].abilities || []).toEqual([]);
    expect(CARDS['ram-rider'].move).toBe(5); // Nov 1: dearer units walk further (Ken)
    expect(CARDS['goblin-slinger'].abilities).toContain('ranged');
    expect(CARDS['gyrocopter-ace'].abilities).toContain('flying');
  });
});

describe('Round 28 orders: shortestPath and turns', () => {
  it('straight path: length, connectivity, turns for move 2 and move 3 (v2 feet)', () => {
    const s = mk([P('goblin-grunt', 1, 1), P('ram-rider', 2, 1), O('goblin-grunt', 7, 13)]);
    const g = at(s, 1, 1), r = at(s, 2, 1);
    const p = shortestPath(s, g, { row: 1, col: 6 })!;
    expect(p.length).toBe(5);
    expect(p[p.length - 1]).toEqual({ row: 1, col: 6 });
    expect(connected(g, p)).toBe(true);
    expect(turnsFor(g, p)).toBe(2); // 5 squares at 3 feet
    const p2 = shortestPath(s, r, { row: 2, col: 6 })!;
    expect(p2.length).toBe(5);
    expect(turnsFor(r, p2)).toBe(1);
    expect(turnsFor(r, p2.slice(0, 4))).toBe(1);
  });
  it('goes around a blocking unit and around a mine', () => {
    const s = mk([P('goblin-grunt', 2, 2), P('goblin-grunt', 2, 3), P('goblin-grunt', 3, 5), O('goblin-grunt', 7, 13)]);
    const a = at(s, 2, 2);
    const p = shortestPath(s, a, { row: 2, col: 4 })!;
    expect(p.length).toBe(2);
    expect(has(p, 2, 3)).toBe(true); // Ken, Nov 1: it walks straight through its own unit instead of around it
    expect(connected(a, p)).toBe(true);
    const b = at(s, 3, 5);
    const q = shortestPath(s, b, { row: 3, col: 7 })!;
    expect(q.length).toBe(2);
    expect(q.some(isMine)).toBe(false);
    expect(connected(b, q)).toBe(true);
  });
  it('walled in → null; destination occupied, a mine, or the start → null', () => {
    const s = mk([P('goblin-grunt', 1, 1), P('goblin-grunt', 1, 2), P('goblin-grunt', 2, 1), P('goblin-grunt', 2, 2), O('goblin-grunt', 6, 9)]);
    const g = at(s, 1, 1);
    expect(shortestPath(s, g, { row: 1, col: 5 })!.length).toBe(4); // Ken, Nov 1: own units never wall you in; you walk through them
    const h = at(s, 2, 2);
    expect(shortestPath(s, h, { row: 1, col: 2 })).toEqual([{ row: 1, col: 2 }]); // ally there: a move onto your own unit is a swap (Ken, Nov 1)
    expect(shortestPath(s, h, { row: 6, col: 9 })).toBeNull(); // enemy there
    expect(shortestPath(s, h, { row: 3, col: 6 })).toBeNull(); // mine
    expect(shortestPath(s, h, { row: 2, col: 2 })).toBeNull(); // start
    expect(shortestPath(s, h, { row: 0, col: 2 })).toBeNull(); // off board
  });
  it('a flyer passes over creatures but never over a mine', () => {
    const s = mk([P('gyrocopter-ace', 1, 1), P('goblin-grunt', 1, 2), P('goblin-grunt', 2, 1), P('goblin-grunt', 2, 2),
      P('gyrocopter-ace', 3, 5), O('goblin-grunt', 2, 6), O('goblin-grunt', 4, 6), O('goblin-grunt', 7, 13)]);
    const f = at(s, 1, 1);
    const p = shortestPath(s, f, { row: 1, col: 3 })!;
    expect(p.length).toBe(2);
    expect(connected(f, p)).toBe(true);
    // a walking unit in the same pocket walks through its own units (Ken, Nov 1); enemies would wall it in
    expect(shortestPath(s, { ...at(s, 1, 2), row: 1, col: 1, cardId: 'goblin-grunt' }, { row: 1, col: 3 })!.length).toBe(2);
    const f2 = at(s, 3, 5);
    const q = shortestPath(s, f2, { row: 3, col: 7 })!;
    expect(q.length).toBe(2);
    expect(q.some(isMine)).toBe(false);
    expect(has(q, 2, 6) || has(q, 4, 6)).toBe(true); // flew over a creature, not the mine
  });
});

describe('Round 28 orders: nextStep', () => {
  it('returns a legal moveDests square and walks along the path', () => {
    let s = mk([P('ram-rider', 4, 1), P('goblin-grunt', 1, 1), O('goblin-grunt', 7, 13)]);
    const r = at(s, 4, 1);
    const p = shortestPath(s, r, { row: 4, col: 5 })!;
    const step = nextStep(s, r, p)!;
    expect(step).toEqual(p[p.length - 1]); // v2: 5 feet cover the whole 4-square path in one go
    expect(moveDests(s, r)).toContainEqual(step);
    s = act(s, { type: 'move', creatureUid: r.uid, row: step.row, col: step.col });
    const g = at(s, 1, 1);
    const pg = shortestPath(s, g, { row: 1, col: 4 })!;
    expect(nextStep(s, g, pg)).toEqual(pg[pg.length - 1]); // 3 feet cover the 3-square path
    // the moved unit cannot move again this turn
    expect(nextStep(s, at(s, step.row, step.col), shortestPath(s, at(s, step.row, step.col), { row: 4, col: 5 })!)).toBeNull();
  });
  it('blocked first square: with 2 feet it steps round to the second square; empty path → null', () => {
    const s = mk([P('goblin-grunt', 4, 1), O('goblin-grunt', 4, 2), O('goblin-grunt', 7, 13)]);
    const g = at(s, 4, 1);
    expect(nextStep(s, g, [{ row: 4, col: 2 }, { row: 4, col: 3 }])).toEqual({ row: 4, col: 3 }); // v2 (Nov 1): two steps reach it round the enemy
    expect(nextStep(s, g, [])).toBeNull();
  });
});

describe('Round 28 orders: chase', () => {
  it('melee chase ends next to the enemy', () => {
    const s = mk([P('goblin-grunt', 4, 1), O('goblin-grunt', 4, 5)]);
    const g = at(s, 4, 1), e = at(s, 4, 5);
    const p = chasePath(s, g, e)!;
    expect(p.length).toBe(3);
    expect(cheb(p[p.length - 1], e)).toBe(1);
    expect(connected(g, p)).toBe(true);
    expect(canAttackFrom(s, g, p[p.length - 1], e)).toBe(true);
    expect(canAttackFrom(s, g, { row: 4, col: 1 }, e)).toBe(false);
  });
  it('ranged chase ends in a clear straight line within range; already in range → []', () => {
    const s = mk([P('goblin-slinger', 1, 1), O('goblin-grunt', 6, 4)]);
    const sl = at(s, 1, 1), e = at(s, 6, 4);
    const range = CARDS['goblin-slinger'].range ?? CONFIG.rangedRange;
    const p = chasePath(s, sl, e)!;
    expect(p.length).toBeGreaterThan(0);
    const end = p[p.length - 1];
    const dr = e.row - end.row, dc = e.col - end.col;
    expect(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)).toBe(true);
    expect(cheb(end, e)).toBeLessThanOrEqual(range);
    expect(canAttackFrom(s, sl, end, e)).toBe(true);
    const s2 = mk([P('goblin-slinger', 4, 1), O('goblin-grunt', 4, 5)]);
    expect(chasePath(s2, at(s2, 4, 1), at(s2, 4, 5))).toEqual([]);
    expect(attackActionOn(s2, at(s2, 4, 1), at(s2, 4, 5))).not.toBeNull();
  });
  it('line of sight: a unit in the way blocks the shot, so the chase moves', () => {
    const s = mk([P('goblin-slinger', 4, 1), P('goblin-grunt', 4, 3), O('goblin-grunt', 4, 5)]);
    const sl = at(s, 4, 1), e = at(s, 4, 5);
    expect(canAttackFrom(s, sl, { row: 4, col: 1 }, e)).toBe(false);
    const p = chasePath(s, sl, e)!;
    expect(p.length).toBe(2);
    expect(connected(sl, p)).toBe(true);
    expect(canAttackFrom(s, sl, p[p.length - 1], e)).toBe(true);
  });
  it('canAttackFrom ignores the unit\'s old square for line of sight', () => {
    // Slinger at (4,4) sits between (4,1) and the enemy at (4,6); standing at (4,2) it must not block itself.
    const s = mk([P('goblin-slinger', 4, 4), O('goblin-grunt', 4, 6)]);
    const sl = at(s, 4, 4), e = at(s, 4, 6);
    expect(canAttackFrom(s, sl, { row: 4, col: 2 }, e)).toBe(true);
  });
});

describe('Round 28 orders: planOrder', () => {
  it('move order: plan, arrived → done, walled (by enemies) → blocked', () => {
    const s = mk([P('goblin-grunt', 4, 1), P('goblin-grunt', 1, 1), O('goblin-grunt', 1, 2), O('goblin-grunt', 2, 1), O('goblin-grunt', 2, 2), O('goblin-grunt', 7, 13)]); // Ken, Nov 1: only enemies wall a unit in
    const g = at(s, 4, 1);
    const plan = planOrder(s, { kind: 'move', uid: g.uid, dest: { row: 4, col: 4 } });
    expect(plan).toMatchObject({ turns: 1, blocked: false, done: false }); // Nov 1: 3 feet
    expect(plan.path.length).toBe(3);
    expect(planOrder(s, { kind: 'move', uid: g.uid, dest: { row: 4, col: 1 } }).done).toBe(true);
    const w = at(s, 1, 1);
    expect(planOrder(s, { kind: 'move', uid: w.uid, dest: { row: 1, col: 5 } })).toMatchObject({ blocked: true, done: false });
    expect(planOrder(s, { kind: 'move', uid: 'nope', dest: { row: 1, col: 5 } }).done).toBe(true);
  });
  it('chase order: target gone → done, unreachable → blocked, otherwise a path', () => {
    const s = mk([P('goblin-grunt', 4, 1), P('goblin-grunt', 1, 1), O('goblin-grunt', 1, 2), O('goblin-grunt', 2, 1), O('goblin-grunt', 2, 2), O('goblin-grunt', 4, 5)]); // Ken, Nov 1: only enemies wall a unit in
    const g = at(s, 4, 1), e = at(s, 4, 5), w = at(s, 1, 1);
    expect(planOrder(s, { kind: 'chase', uid: g.uid, targetUid: 'gone' }).done).toBe(true);
    expect(planOrder(s, { kind: 'chase', uid: g.uid, targetUid: e.uid })).toMatchObject({ turns: 1, blocked: false, done: false }); // Nov 1: 3 feet
    expect(planOrder(s, { kind: 'chase', uid: w.uid, targetUid: e.uid })).toMatchObject({ blocked: true, done: false });
  });
});

describe('Oct 30 (Ken): always the most direct route', () => {
  it('an open board gives a straight line, not a zig-zag', () => {
    const s = mk([P('goblin-grunt', 4, 1), O('goblin-grunt', 7, 13)]);
    const p = shortestPath(s, at(s, 4, 1), { row: 4, col: 5 })!;
    expect(p).toEqual([{ row: 4, col: 2 }, { row: 4, col: 3 }, { row: 4, col: 4 }, { row: 4, col: 5 }]);
    const d = shortestPath(s, at(s, 4, 1), { row: 1, col: 4 })!; // a pure diagonal stays on the diagonal
    expect(d).toEqual([{ row: 3, col: 2 }, { row: 2, col: 3 }, { row: 1, col: 4 }]);
  });
  it('an ally on the road is never a reason to go around (Ken, Nov 1: you walk through your own units)', () => {
    const s = mk([P('goblin-grunt', 6, 1), P('goblin-grunt', 6, 4), O('goblin-grunt', 1, 13)]);
    const p = shortestPath(s, at(s, 6, 1), { row: 6, col: 6 })!;
    expect(p.every((q) => q.row === 6)).toBe(true);
    const near = mk([P('goblin-grunt', 6, 1), P('goblin-grunt', 6, 2), O('goblin-grunt', 1, 13)]);
    expect(has(shortestPath(near, at(near, 6, 1), { row: 6, col: 6 })!, 6, 2)).toBe(true);
  });
});
