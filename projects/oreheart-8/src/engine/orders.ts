// Round 28 (owner, Oct 28-29): "move orders" — a convenience layer on top of normal moves.
// Pure functions over the engine state. No new rules: every step a unit takes is an ordinary legal engine
// `move` action (moveDests), every automatic attack an ordinary legal `attack` action (attackTargets).
import { attackTargets, creatureAt, emptyCell, maxMove, moveDests, legalActions } from './engine';
import { CARDS } from './content';

export interface Cell { row: number; col: number }
/** A standing order for one of the player's units. `move`: walk to `dest`. `chase`: follow enemy `targetUid` and attack when in range. */
export type Order = { kind: 'move'; uid: string; dest: Cell } | { kind: 'chase'; uid: string; targetUid: string; /** Ken, Nov 1: more targets to go after, in order */ then?: string[] };
/** What an order looks like right now: the squares still to walk (excluding the unit's own square), the turns it takes, and whether it is blocked today. */
export interface OrderPlan { path: Cell[]; turns: number; blocked: boolean; done: boolean }

const DIRS8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const has = (c: any, a: string) => !!CARDS[c.cardId].abilities?.includes(a);
const key = (q: Cell) => q.row + ',' + q.col;

/** Shortest 8-way path from the unit's square to `dest`, excluding the start, including `dest`.
 *  Intermediate squares must be empty (in bounds, no Stronghold, no mine, no creature); a flying unit may pass over creatures.
 *  `dest` itself must be empty. null when there is no path. */
export function shortestPath(s: any, c: any, dest: Cell): Cell[] | null {
  if (!dest || (dest.row === c.row && dest.col === c.col) || !(emptyCell(s, dest.row, dest.col) || creatureAt(s, dest.row, dest.col)?.owner === c.owner)) return null;
  return bfs(s, c, (q) => q.row === dest.row && q.col === dest.col, dest, true);
}

/** Can `c` walk through square q on a multi-turn path? Empty squares always; a flyer also over creatures (never Strongholds, mines or off-board).
 *  Ken (Oct 30, "going around things for no reason"): our own units further away than this turn's move don't count as obstacles; they will
 *  have moved by then, and the route is planned again every turn. Allies within this turn's reach still do (never wait behind one). */
function passable(s: any, c: any, noUnits: any, q: Cell): boolean {
  if (emptyCell(s, q.row, q.col)) return true;
  const o = creatureAt(s, q.row, q.col);
  if (!o || !emptyCell(noUnits, q.row, q.col)) return false;
  return has(c, 'flying') || o.owner === c.owner; // Ken, Nov 1: anyone walks through their own units (never through enemies)
}

/** Ken (Oct 30): "always pick the most direct route". Breadth-first by steps (8 directions, so the fewest moves always wins), and among
 *  routes with the same number of steps the one that stays closest to the straight line toward `aim` (no wiggles, no needless detours).
 *  The goal must be an empty square that satisfies `goal`. Path excludes the start. */
function bfs(s: any, c: any, goal: (q: Cell) => boolean, aim?: Cell, swapGoal = false): Cell[] | null {
  const noUnits = { ...s, board: { ...s.board, creatures: [] } };
  const start: Cell = { row: c.row, col: c.col };
  const to = aim || start;
  const vr = to.row - start.row, vc = to.col - start.col, vl = Math.hypot(vr, vc);
  /** how far square q lies from the straight line start -> aim (0 on the line) */
  const off = (q: Cell) => (vl < 1e-9 ? 0 : Math.abs((q.row - start.row) * vc - (q.col - start.col) * vr) / vl);
  const seen = new Set<string>([key(start)]);
  const prev = new Map<string, Cell | null>([[key(start), null]]);
  const dev = new Map<string, number>([[key(start), 0]]);
  let frontier: Cell[] = [start];
  while (frontier.length) {
    const layer = new Map<string, Cell>();
    for (const q of frontier) for (const [dr, dc] of DIRS8) {
      const n: Cell = { row: q.row + dr, col: q.col + dc };
      const k = key(n);
      if (seen.has(k) || !passable(s, c, noUnits, n)) continue;
      const d = dev.get(key(q))! + off(n) + (dr && dc ? 0.001 : 0); // straighter first; a hair less diagonal on exact ties
      if (!layer.has(k) || d < dev.get(k)!) { layer.set(k, n); dev.set(k, d); prev.set(k, q); }
    }
    for (const k of layer.keys()) seen.add(k);
    const goals = [...layer.values()].filter((n) => (emptyCell(s, n.row, n.col) || (swapGoal && creatureAt(s, n.row, n.col)?.owner === c.owner)) && goal(n)); // Ken, Nov 1: a move drawn onto your own unit ends in a swap
    if (goals.length) {
      goals.sort((a, b) => dev.get(key(a))! - dev.get(key(b))! || Math.hypot(a.row - to.row, a.col - to.col) - Math.hypot(b.row - to.row, b.col - to.col));
      const path: Cell[] = [];
      for (let x: Cell | null = goals[0]; x && key(x) !== key(start); x = prev.get(key(x)) ?? null) path.unshift(x);
      return path;
    }
    frontier = [...layer.values()];
  }
  return null;
}

/** Turns the path takes at the unit's move rate: ceil(length / move). Infinity when the unit cannot move. */
export function turnsFor(c: any, path: Cell[]): number {
  const m = maxMove(c);
  if (!m) return Infinity;
  return Math.ceil(path.length / m);
}

/** The furthest square along `path` the unit can reach THIS turn with one legal engine move (a `moveDests` square), or null when blocked. */
export function nextStep(s: any, c: any, path: Cell[]): Cell | null {
  if (!path || !path.length) return null;
  const dests = moveDests(s, c);
  for (let k = Math.min(c.movesLeft ?? (maxMove(c) || 0), path.length); k >= 1; k--) { // v2: as far as the points left allow
    const q = path[k - 1];
    if (creatureAt(s, q.row, q.col) && k !== path.length) continue; // never land on (swap with) one of our own units on the way; only the order's own last square may be a swap (Ken, Nov 1)
    if (dests.some((d) => d.row === q.row && d.col === q.col)) return { row: q.row, col: q.col };
  }
  return null;
}

/** True when `c`, standing on `at`, could attack `enemy` by the normal attack rules (attackTargets). */
export function canAttackFrom(s: any, c: any, at: Cell, enemy: any): boolean {
  // A fresh copy of c on `at`: only geometry (reach, line of sight, guards) decides; this-turn flags are cleared.
  const copy = { ...c, row: at.row, col: at.col, hasMoved: false, hasAttacked: false, hasMined: false, movesLeft: 1, summonedThisTurn: false, lockedUntil: 0, wardUntil: 0, rocketed: false };
  const s2 = { ...s, board: { ...s.board, creatures: s.board.creatures.map((x: any) => (x.uid === c.uid ? copy : x)) } };
  return attackTargets(s2, copy).some((t: any) => (enemy.commander ? t.commander === enemy.commander : !t.commander && t.row === enemy.row && t.col === enemy.col));
}

/** Shortest path to the nearest square from which `enemy` is in attack range (empty path = already in range). null = unreachable. */
export function chasePath(s: any, c: any, enemy: any): Cell[] | null {
  if (canAttackFrom(s, c, { row: c.row, col: c.col }, enemy)) return [];
  return bfs(s, c, (q) => canAttackFrom(s, c, q, enemy), { row: enemy.row, col: enemy.col });
}

/** The legal attack action of `c` on `enemy` right now, or null. */
export function attackActionOn(s: any, c: any, enemy: any): any | null {
  return legalActions(s).find((a: any) => a.type === 'attack' && a.creatureUid === c.uid && a.target && (enemy.commander ? a.target.commander === enemy.commander : a.target.row === enemy.row && a.target.col === enemy.col)) || null;
}

/** Plan an order against the current state. `done` = nothing left to do (arrived / target gone). */
export function planOrder(s: any, order: Order): OrderPlan {
  const c = s.board.creatures.find((x: any) => x.uid === order.uid);
  if (!c) return { path: [], turns: 0, blocked: false, done: true };
  if (order.kind === 'move') {
    if (c.row === order.dest.row && c.col === order.dest.col) return { path: [], turns: 0, blocked: false, done: true };
    const path = shortestPath(s, c, order.dest);
    if (!path) return { path: [], turns: Infinity, blocked: true, done: false };
    return { path, turns: turnsFor(c, path), blocked: false, done: false };
  }
  const enemy = chaseTarget(s, order);
  if (!enemy) return { path: [], turns: 0, blocked: false, done: true };
  const path = chasePath(s, c, enemy);
  if (!path) return { path: [], turns: Infinity, blocked: true, done: false };
  return { path, turns: turnsFor(c, path), blocked: false, done: false };
}

/** Ken, Nov 1: a chase order's whole list of targets, current one first. */
export const chaseList = (o: Order): string[] => (o.kind === 'chase' ? [o.targetUid, ...(o.then || [])] : []);
/** The first target on the list still on the board (one that died or retreated is skipped), or null when the list is finished. */
export function chaseTarget(s: any, o: Order): any | null {
  const c = s.board.creatures.find((x: any) => x.uid === o.uid);
  for (const u of chaseList(o)) {
    if (u.startsWith('cmd:')) { // Ken, Nov 1: the enemy Commander is a target too: the unit walks to him and hits him every turn until the match ends
      const side = u.slice(4), sh = s.strongholds?.[side];
      if (sh && !s.winner && (!c || side !== c.owner)) return { uid: u, commander: side, owner: side, row: sh.row, col: sh.col };
      continue;
    }
    const e = s.board.creatures.find((x: any) => x.uid === u); if (e && (!c || e.owner !== c.owner)) return e;
  }
  return null;
}

// Ken, Nov 1: "Smarter without taking the control away": what a unit with no order does by itself at the start of the player's Action phase.
// All reach comes from the engine's own legal actions, attack targets and moves, so a change to the combat rules carries over. A unit with no stance does nothing by itself.
export type Stance = 'aggressive' | 'guard' | 'hold';
export const UNIT_STANCES: Stance[] = ['hold', 'guard', 'aggressive'];
/** The action a stance takes now, or null. hold: attack what's in range. guard: also step 1 square to reach an enemy just beyond its reach. aggressive: also walk toward the nearest enemy. */
export function stanceAction(s: any, c: any, stance: Stance): any | null {
  const acts = legalActions(s).filter((a: any) => a.creatureUid === c.uid);
  const atk = acts.filter((a: any) => a.type === 'attack' && a.target);
  if (atk.length) {
    const hp = (a: any) => { if (a.target.commander) return -1; const e = creatureAt(s, a.target.row, a.target.col); return e ? e.health : 99; };
    return atk.slice().sort((a: any, b: any) => hp(a) - hp(b))[0]; // the Commander first, then the weakest
  }
  if (stance === 'hold' || !acts.some((a: any) => a.type === 'move')) return null;
  const foes = s.board.creatures.filter((x: any) => x.owner !== c.owner).sort((a: any, b: any) => Math.max(Math.abs(a.row - c.row), Math.abs(a.col - c.col)) - Math.max(Math.abs(b.row - c.row), Math.abs(b.col - c.col)));
  let best: Cell[] | null = null;
  for (const e of foes.slice(0, 6)) { const p = chasePath(s, c, e); if (p && p.length && (!best || p.length < best.length)) best = p; }
  if (!best) return null;
  if (stance === 'guard' && best.length > 1) return null;
  const step = stance === 'guard' ? (acts.some((a: any) => a.type === 'move' && a.row === best![0].row && a.col === best![0].col) ? best[0] : null) : nextStep(s, c, best);
  return step ? { type: 'move', creatureUid: c.uid, row: step.row, col: step.col } : null;
}
