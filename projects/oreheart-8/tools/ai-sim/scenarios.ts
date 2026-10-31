// Reaction scenarios shared by tools/ai-sim/react.ts and tests/ai-oct30.test.ts.
import { createMatch, legalActions, CONFIG } from '../../src/engine';
import { makeRand } from '../../src/ai/ai';

export const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const cheb = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
export const HOME = { row: CONFIG.strongholds.player[0], col: CONFIG.strongholds.player[1] };
const empty = (taken: Set<string>, r: number, c: number) => !taken.has(r + ',' + c) && !MINES.some((m) => m.row === r && m.col === c) && !(r === 7 && c === 2) && !(r === 1 && c === 12);

/** Scripted enemy for the rush: every fighter walks at the AI's Commander and hits it when it can (or hits whatever blocks it). */
export function rushBot(s: any): any {
  if (s.pendingResponse) return { type: 'pass' };
  const la = legalActions(s);
  const cmd = la.find((a: any) => a.type === 'attack' && a.target.commander);
  if (cmd) return cmd;
  let best: any = null, bd = 0;
  for (const a of la) if (a.type === 'move') {
    const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid);
    const gain = cheb(c, HOME) - cheb(a, HOME);
    if (gain > bd) { bd = gain; best = a; }
  }
  if (best) return best;
  return la.find((a: any) => a.type === 'attack') || { type: 'done' };
}
/** Scripted enemy for mine domination: Miners mine every turn; guards hit anything next to them. */
export function mineBot(s: any): any {
  if (s.pendingResponse) return { type: 'pass' };
  const la = legalActions(s);
  return la.find((a: any) => a.type === 'mineAt') || la.find((a: any) => a.type === 'mine') || la.find((a: any) => a.type === 'attack') || { type: 'done' };
}

export function scenario(kind: 'rush' | 'mines', seed: number) {
  const r = makeRand(seed * 101 + 7);
  const taken = new Set<string>();
  const put = (cardId: string, owner: string, rows: number[], cols: number[], extra: any = {}) => {
    for (let k = 0; k < 50; k++) {
      const row = rows[Math.floor(r() * rows.length)], col = cols[Math.floor(r() * cols.length)];
      if (empty(taken, row, col)) { taken.add(row + ',' + col); return { cardId, owner, row, col, ...extra }; }
    }
    return null;
  };
  const board: any[] = [];
  const GOB = ['goblin-grunt', 'goblin-pebbler', 'shiv-rat', 'skullbasher-rusher', 'goblin-grunt', 'wolf-rider'];
  if (kind === 'rush') {
    // our army is out in mid-board, 3+ squares from either Commander; four enemy fighters are 2-4 squares from our Commander
    for (let i = 0; i < 4; i++) board.push(put(GOB[Math.floor(r() * GOB.length)], 'player', [3, 4], [7, 8, 9]));
    board.push(put('goblin-scrounger', 'player', [6], [5, 7], { minedMine: MINES[2] }));
    // gnome attackers: goblins beat gnomes, so going back to fight them is the right answer (tough dwarves: TOUGH=1)
    const RUSH = process.env.TOUGH ? ['dwarf-stoneback', 'ironhammer-berserker', 'grimhold-ravager', 'dwarf-pickman'] : ['gnome-cogger', 'gnome-widget', 'gearward-sentinel', 'gnome-widget'];
    for (let i = 0; i < 4; i++) board.push(put(RUSH[Math.floor(r() * RUSH.length)], 'opponent', [4, 5, 6], [3, 4, 5, 6]));
  } else {
    // the enemy owns every mine with two Miners each, plus two guards; our fighters wait near home
    for (const m of MINES) for (let i = 0; i < 2; i++) board.push(put('gnome-prospector', 'opponent', [m.row - 1, m.row, m.row + 1], [m.col - 1, m.col, m.col + 1], { minedMine: m }));
    for (let i = 0; i < 2; i++) board.push(put(['gnome-cogger', 'gearward-sentinel'][i], 'opponent', [2, 3], [7, 8, 9]));
    for (let i = 0; i < 4; i++) board.push(put(GOB[Math.floor(r() * GOB.length)], 'player', [6, 7], [3, 4, 5, 6, 7, 8]));
  }
  return createMatch({ playerCommander: 'grubnak', opponentCommander: kind === 'rush' && process.env.TOUGH ? 'borgo' : 'sproingle', mines: MINES, firstPlayer: 'player',
    setup: { playerCrystals: 4, opponentCrystals: 0, board: board.filter(Boolean) } });
}

