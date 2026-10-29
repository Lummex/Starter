// Round 28 (owner, Oct 28-29): "move orders" — a convenience layer on top of normal moves.
// Pure functions over the engine state. No new rules: every step a unit takes is an ordinary legal engine
// `move` action (moveDests), every automatic attack an ordinary legal `attack` action (attackTargets).
import { attackTargets, creatureAt, emptyCell, maxMove, moveDests, legalActions } from './engine';
import { CARDS } from './content';

export interface Cell { row: number; col: number }
/** A standing order for one of the player's units. `move`: walk to `dest`. `chase`: follow enemy `targetUid` and attack when in range. */
export type Order = { kind: 'move'; uid: string; dest: Cell } | { kind: 'chase'; uid: string; targetUid: string };
/** What an order looks like right now: the squares still to walk (excluding the unit's own square), the turns it takes, and whether it is blocked today. */
export interface OrderPlan { path: Cell[]; turns: number; blocked: boolean; done: boolean }

const DIRS8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const has = (c: any, a: string) => !!CARDS[c.cardId].abilities?.includes(a);
const key = (q: Cell) => q.row + ',' + q.col;

/** Shortest 8-way path from the unit's square to `dest`, excluding the start, including `dest`.
 *  Intermediate squares must be empty (in bounds, no Stronghold, no mine, no creature); a flying unit may pass over creatures.
 *  `dest` itself must be empty. null when there is no path. */
export function shortestPath(s: any, c: any, dest: Cell): Cell[] | null {
  if (!dest || (dest.row === c.row && dest.col === c.col) || !emptyCell(s, dest.row, dest.col)) return null;
  return bfs(s, c, (q) => q.row === dest.row && q.col === dest.col);
}

/** Can `c` walk through square q on a multi-turn path? Empty squares always; a flyer also over creatures (never Strongholds, mines or off-board). */
function passable(s: any, c: any, noUnits: any, q: Cell): boolean {
  if (emptyCell(s, q.row, q.col)) return true;
  return has(c, 'flying') && !!creatureAt(s, q.row, q.col) && emptyCell(noUnits, q.row, q.col);
}

/** BFS from c's square (8 directions, DIRS8 order) to the nearest square that is empty and satisfies `goal`. Path excludes the start. */
function bfs(s: any, c: any, goal: (q: Cell) => boolean): Cell[] | null {
  const noUnits = { ...s, board: { ...s.board, creatures: [] } };
  const start: Cell = { row: c.row, col: c.col };
  const prev = new Map<string, Cell | null>([[key(start), null]]);
  let frontier: Cell[] = [start];
  while (frontier.length) {
    const next: Cell[] = [];
    for (const q of frontier) for (const [dr, dc] of DIRS8) {
      const n: Cell = { row: q.row + dr, col: q.col + dc };
      const k = key(n);
      if (prev.has(k) || !passable(s, c, noUnits, n)) continue;
      prev.set(k, q);
      if (emptyCell(s, n.row, n.col) && goal(n)) {
        const path: Cell[] = [];
        for (let x: Cell | null = n; x && key(x) !== key(start); x = prev.get(key(x)) ?? null) path.unshift(x);
        return path;
      }
      next.push(n);
    }
    frontier = next;
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
  for (let k = Math.min(maxMove(c) || 0, path.length); k >= 1; k--) {
    const q = path[k - 1];
    if (dests.some((d) => d.row === q.row && d.col === q.col)) return { row: q.row, col: q.col };
  }
  return null;
}

/** True when `c`, standing on `at`, could attack `enemy` by the normal attack rules (attackTargets). */
export function canAttackFrom(s: any, c: any, at: Cell, enemy: any): boolean {
  // A fresh copy of c on `at`: only geometry (reach, line of sight, guards) decides; this-turn flags are cleared.
  const copy = { ...c, row: at.row, col: at.col, hasMoved: false, hasAttacked: false, hasMined: false, summonedThisTurn: false, lockedUntil: 0, wardUntil: 0, rocketed: false };
  const s2 = { ...s, board: { ...s.board, creatures: s.board.creatures.map((x: any) => (x.uid === c.uid ? copy : x)) } };
  return attackTargets(s2, copy).some((t: any) => !t.commander && t.row === enemy.row && t.col === enemy.col);
}

/** Shortest path to the nearest square from which `enemy` is in attack range (empty path = already in range). null = unreachable. */
export function chasePath(s: any, c: any, enemy: any): Cell[] | null {
  if (canAttackFrom(s, c, { row: c.row, col: c.col }, enemy)) return [];
  return bfs(s, c, (q) => canAttackFrom(s, c, q, enemy));
}

/** The legal attack action of `c` on `enemy` right now, or null. */
export function attackActionOn(s: any, c: any, enemy: any): any | null {
  return legalActions(s).find((a: any) => a.type === 'attack' && a.creatureUid === c.uid && a.target && a.target.row === enemy.row && a.target.col === enemy.col) || null;
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
  const enemy = s.board.creatures.find((x: any) => x.uid === order.targetUid);
  if (!enemy || enemy.owner === c.owner) return { path: [], turns: 0, blocked: false, done: true };
  const path = chasePath(s, c, enemy);
  if (!path) return { path: [], turns: Infinity, blocked: true, done: false };
  return { path, turns: turnsFor(c, path), blocked: false, done: false };
}
