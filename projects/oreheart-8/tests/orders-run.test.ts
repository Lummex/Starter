import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../src/game';
import { runOrders } from '../src/ui/orders-run';
import { planOrder, nextStep, attackActionOn, type Order } from '../src/engine/orders';

vi.mock('../src/engine/orders', () => ({ planOrder: vi.fn(), nextStep: vi.fn(), attackActionOn: vi.fn() }));
const mPlan = vi.mocked(planOrder);
const mStep = vi.mocked(nextStep);
const mAttack = vi.mocked(attackActionOn);

const OPTS = { delayMs: 0 };
const live = (path: any[] = [{ row: 6, col: 3 }]) => ({ path, turns: 1, blocked: false, done: false });

/** Player goblin-scrapper (move 1, melee) at 7,3; optional extra board units. Returns the game in the player's Action phase. */
function start(extra: any[] = []) {
  const g = new Game(true);
  g.newMatch({ ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle', setup: { board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 7, col: 3 }, ...extra] } });
  g.act({ type: 'done' });
  expect(g.state.phase).toBe('action');
  return g;
}
const unit = (g: Game, owner = 'player') => g.state.board.creatures.find((c: any) => c.owner === owner);

beforeEach(() => {
  mPlan.mockReset(); mStep.mockReset(); mAttack.mockReset();
  mAttack.mockReturnValue(null);
});

describe('round 28 order runner', () => {
  it('does nothing outside the player Action phase', async () => {
    const g = new Game(true);
    g.newMatch({ ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle', setup: { board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 7, col: 3 }] } });
    expect(g.state.phase).toBe('deploy');
    const uid = unit(g).uid;
    const orders = new Map<string, Order>([[uid, { kind: 'move', uid, dest: { row: 4, col: 3 } }]]);
    mPlan.mockReturnValue(live()); mStep.mockReturnValue({ row: 6, col: 3 });
    const r = await runOrders(g, orders, OPTS);
    expect(r).toEqual({ moved: [], attacked: [], blocked: [], done: [] });
    expect(mPlan).not.toHaveBeenCalled();
    expect(unit(g).row).toBe(7);
    expect(orders.size).toBe(1);
  });

  it('does nothing in a tutorial or a non-standard mode', async () => {
    const g = start();
    const uid = unit(g).uid;
    const orders = new Map<string, Order>([[uid, { kind: 'move', uid, dest: { row: 4, col: 3 } }]]);
    mPlan.mockReturnValue(live()); mStep.mockReturnValue({ row: 6, col: 3 });
    g.state.tutorial = { step: 'move' };
    await runOrders(g, orders, OPTS);
    g.state.tutorial = null; g.mode = 'cardplay';
    await runOrders(g, orders, OPTS);
    expect(unit(g).row).toBe(7);
    expect(mPlan).not.toHaveBeenCalled();
  });

  it('a move order makes exactly one legal move and keeps the order', async () => {
    const g = start();
    const uid = unit(g).uid;
    const order: Order = { kind: 'move', uid, dest: { row: 4, col: 3 } };
    const orders = new Map<string, Order>([[uid, order]]);
    mPlan.mockReturnValue(live([{ row: 6, col: 3 }, { row: 5, col: 3 }, { row: 4, col: 3 }]));
    mStep.mockReturnValue({ row: 6, col: 3 });
    const onChange = vi.fn();
    const r = await runOrders(g, orders, { delayMs: 0, onChange });
    expect(r.moved).toEqual([uid]);
    expect(unit(g)).toMatchObject({ row: 6, col: 3, hasMoved: true });
    expect(orders.get(uid)).toBe(order);
    expect(onChange).toHaveBeenCalled();
  });

  it('deletes a move order once the move reaches the destination', async () => {
    const g = start();
    const uid = unit(g).uid;
    const orders = new Map<string, Order>([[uid, { kind: 'move', uid, dest: { row: 6, col: 3 } }]]);
    mPlan.mockImplementation((s: any) => {
      const c = s.board.creatures.find((x: any) => x.uid === uid);
      return c.row === 6 ? { path: [], turns: 0, blocked: false, done: true } : live();
    });
    mStep.mockReturnValue({ row: 6, col: 3 });
    const r = await runOrders(g, orders, OPTS);
    expect(r.moved).toEqual([uid]);
    expect(r.done).toEqual([uid]);
    expect(orders.size).toBe(0);
  });

  it('an order that is already done is deleted without acting', async () => {
    const g = start();
    const uid = unit(g).uid;
    const orders = new Map<string, Order>([[uid, { kind: 'move', uid, dest: { row: 7, col: 3 } }]]);
    mPlan.mockReturnValue({ path: [], turns: 0, blocked: false, done: true });
    const r = await runOrders(g, orders, OPTS);
    expect(r.done).toEqual([uid]);
    expect(orders.size).toBe(0);
    expect(mStep).not.toHaveBeenCalled();
    expect(unit(g).hasMoved).toBeFalsy();
  });

  it('a blocked order is kept and makes no move', async () => {
    const g = start();
    const uid = unit(g).uid;
    const orders = new Map<string, Order>([[uid, { kind: 'move', uid, dest: { row: 4, col: 3 } }]]);
    mPlan.mockReturnValue({ path: [], turns: Infinity, blocked: true, done: false });
    const r = await runOrders(g, orders, OPTS);
    expect(r.blocked).toEqual([uid]);
    expect(orders.size).toBe(1);
    expect(unit(g)).toMatchObject({ row: 7, col: 3 });
    expect(mStep).not.toHaveBeenCalled();
  });

  it('no step this turn counts as blocked and keeps the order', async () => {
    const g = start();
    const uid = unit(g).uid;
    const orders = new Map<string, Order>([[uid, { kind: 'move', uid, dest: { row: 4, col: 3 } }]]);
    mPlan.mockReturnValue(live()); mStep.mockReturnValue(null);
    const r = await runOrders(g, orders, OPTS);
    expect(r.blocked).toEqual([uid]);
    expect(orders.size).toBe(1);
  });

  it('a chase with an attack available attacks and ends the chase', async () => {
    const g = start([{ cardId: 'goblin-grunt', owner: 'opponent', row: 6, col: 3 }]);
    const me = unit(g), foe = unit(g, 'opponent');
    const orders = new Map<string, Order>([[me.uid, { kind: 'chase', uid: me.uid, targetUid: foe.uid }]]);
    mPlan.mockReturnValue(live([]));
    mAttack.mockImplementation((_s: any, c: any, e: any) => ({ type: 'attack', creatureUid: c.uid, target: { row: e.row, col: e.col } }));
    const r = await runOrders(g, orders, OPTS);
    expect(r.attacked).toEqual([me.uid]);
    expect(orders.size).toBe(0);
    expect(unit(g).hasAttacked).toBe(true);
    expect(mStep).not.toHaveBeenCalled();
  });

  it('waits for a Respond window opened by the automatic attack before the next unit', async () => {
    const g = start([{ cardId: 'goblin-scrapper', owner: 'player', row: 7, col: 8 }, { cardId: 'goblin-grunt', owner: 'opponent', row: 6, col: 3 }]);
    const [a, b] = g.state.board.creatures.filter((c: any) => c.owner === 'player');
    const foe = unit(g, 'opponent');
    const orders = new Map<string, Order>([[a.uid, { kind: 'chase', uid: a.uid, targetUid: foe.uid }], [b.uid, { kind: 'move', uid: b.uid, dest: { row: 4, col: 8 } }]]);
    mPlan.mockReturnValue(live([{ row: 6, col: 8 }]));
    mAttack.mockImplementation((_s: any, c: any, e: any) => (c.uid === a.uid ? { type: 'attack', creatureUid: c.uid, target: { row: e.row, col: e.col } } : null));
    mStep.mockReturnValue({ row: 6, col: 8 });
    const realAct = g.act.bind(g);
    let cleared = false;
    vi.spyOn(g, 'act').mockImplementation((act: any) => {
      const r = realAct(act);
      if (act.type === 'attack') { g.state.pendingResponse = { fake: true }; setTimeout(() => { g.state.pendingResponse = null; cleared = true; }, 120); }
      if (act.type === 'move') expect(cleared).toBe(true);
      return r;
    });
    const r = await runOrders(g, orders, OPTS);
    expect(r.attacked).toEqual([a.uid]);
    expect(r.moved).toEqual([b.uid]);
    expect(cleared).toBe(true);
  });

  it('a chase without an attack moves toward the enemy and keeps the order', async () => {
    const g = start([{ cardId: 'goblin-grunt', owner: 'opponent', row: 3, col: 3 }]);
    const me = unit(g), foe = unit(g, 'opponent');
    const order: Order = { kind: 'chase', uid: me.uid, targetUid: foe.uid };
    const orders = new Map<string, Order>([[me.uid, order]]);
    mPlan.mockReturnValue(live([{ row: 6, col: 3 }, { row: 5, col: 3 }, { row: 4, col: 3 }]));
    mStep.mockReturnValue({ row: 6, col: 3 });
    const r = await runOrders(g, orders, OPTS);
    expect(r.moved).toEqual([me.uid]);
    expect(orders.get(me.uid)).toBe(order);
    expect(unit(g)).toMatchObject({ row: 6, col: 3 });
  });

  it('a failing act leaves the state unchanged and keeps the order', async () => {
    const g = start();
    const uid = unit(g).uid;
    const orders = new Map<string, Order>([[uid, { kind: 'move', uid, dest: { row: 3, col: 3 } }]]);
    mPlan.mockReturnValue(live()); mStep.mockReturnValue({ row: 3, col: 3 }); // 4 squares: illegal for a move-1 unit
    const before = JSON.stringify(g.state);
    const log = vi.fn();
    const r = await runOrders(g, orders, { delayMs: 0, log });
    expect(r.blocked).toEqual([uid]);
    expect(r.moved).toEqual([]);
    expect(JSON.stringify(g.state)).toBe(before);
    expect(orders.size).toBe(1);
    expect(log).toHaveBeenCalled();
  });

  it('deletes orders for units that no longer exist (and chases whose target is gone)', async () => {
    const g = start();
    const uid = unit(g).uid;
    const orders = new Map<string, Order>([
      ['ghost', { kind: 'move', uid: 'ghost', dest: { row: 4, col: 3 } }],
      [uid, { kind: 'chase', uid, targetUid: 'gone' }],
    ]);
    mPlan.mockReturnValue(live());
    const r = await runOrders(g, orders, OPTS);
    expect(r.done).toEqual(['ghost', uid]);
    expect(orders.size).toBe(0);
    expect(unit(g).row).toBe(7);
  });

  it('stops when the turn changes mid-way', async () => {
    const g = start([{ cardId: 'goblin-scrapper', owner: 'player', row: 7, col: 8 }]);
    const [a, b] = g.state.board.creatures.filter((c: any) => c.owner === 'player');
    const orders = new Map<string, Order>([[a.uid, { kind: 'move', uid: a.uid, dest: { row: 4, col: 3 } }], [b.uid, { kind: 'move', uid: b.uid, dest: { row: 4, col: 8 } }]]);
    mPlan.mockReturnValue(live());
    mStep.mockImplementation((_s: any, c: any) => ({ row: c.row - 1, col: c.col }));
    // the player presses Done while the first unit's move animation plays
    const r = await runOrders(g, orders, { delayMs: 30, onChange: () => { if (g.state.phase === 'action') g.act({ type: 'done' }); } });
    expect(r.moved).toEqual([a.uid]);
    expect(g.state.turn).toBe(2);
    const bNow = g.state.board.creatures.find((c: any) => c.uid === b.uid);
    expect(bNow.row).toBe(7);
    expect(orders.size).toBe(2);
  });

  it('never throws when the planner throws', async () => {
    const g = start();
    const uid = unit(g).uid;
    const orders = new Map<string, Order>([[uid, { kind: 'move', uid, dest: { row: 4, col: 3 } }]]);
    mPlan.mockImplementation(() => { throw new Error('boom'); });
    const r = await runOrders(g, orders, OPTS);
    expect(r.blocked).toEqual([uid]);
    expect(orders.size).toBe(1);
  });
});
