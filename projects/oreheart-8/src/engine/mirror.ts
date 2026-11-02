// Board mirror for online play (Anvil, Nov 2). The engine always calls the two sides 'player' (home row 7, stronghold (7,2))
// and 'opponent' (home row 1, stronghold (1,12)). In a match between two people, the second player's browser must still
// play as 'player', so the server shows that player the board turned half a turn: every side name swapped and every
// square reflected through the centre (row -> 8 - row, col -> 14 - col; (7,2) <-> (1,12)). Facing and direction fields
// reverse with it. The same transform turns that player's actions back into real ones. mirror(mirror(x)) deep-equals x.
//
// The server applies actions only to the TRUE state; the mirror is presentation plus action translation, so tie-breaks
// inside the engine never run on a mirrored board.
import { CONFIG } from './content';

const ROWS: number = CONFIG.boardHeight;
const COLS: number = CONFIG.boardWidth;
const SIDE: Record<string, string> = { player: 'opponent', opponent: 'player' };
const FACING: Record<string, string> = { N: 'S', S: 'N', E: 'W', W: 'E', NE: 'SW', SW: 'NE', NW: 'SE', SE: 'NW' };
/** Keys whose number value is a row / column / direction step. */
const ROW_KEYS = new Set(['row']);
const COL_KEYS = new Set(['col']);
const DROW_KEYS = new Set(['dr']);
const DCOL_KEYS = new Set(['dc']);

export const mirrorRow = (row: number) => ROWS + 1 - row;
export const mirrorCol = (col: number) => COLS + 1 - col;
export const mirrorSide = (s: string) => SIDE[s] ?? s;

function mirrorValue(key: string | null, v: any): any {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') return key === 'facing' ? (FACING[v] ?? v) : (SIDE[v] ?? v);
  if (typeof v === 'number') {
    if (key && ROW_KEYS.has(key)) return mirrorRow(v);
    if (key && COL_KEYS.has(key)) return mirrorCol(v);
    if (key && (DROW_KEYS.has(key) || DCOL_KEYS.has(key))) return -v;
    return v;
  }
  if (Array.isArray(v)) return v.map((x) => mirrorValue(null, x));
  if (typeof v === 'object') {
    const out: any = {};
    // a per-side map ({ player: .., opponent: .. }) swaps its keys; a lone 'player' key is a field name (moveMark.player) and keeps its name
    const perSide = 'player' in v && 'opponent' in v;
    for (const k of Object.keys(v)) out[perSide ? (SIDE[k] ?? k) : k] = mirrorValue(k, v[k]);
    return out;
  }
  return v;
}

/** Deep copy of a state, action, event or event list with the board turned half a turn and the sides swapped. */
export function mirror<T>(x: T): T {
  return mirrorValue(null, x) as T;
}
