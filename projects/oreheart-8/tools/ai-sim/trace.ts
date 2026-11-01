import { createMatch, applyAction, CARDS } from '../../src/engine';
import { aiChoose, makeRand } from '../../src/ai/ai';
const dbg: any[] = []; (globalThis as any).__aiDebug = dbg;
let s: any = createMatch({ seed: +(process.argv[4] || 3), playerCommander: process.argv[5] || "grubnak", opponentCommander: "sproingle", testMode: true, firstPlayer: 'player' });
const r = makeRand(5); let n = 0, turn = -1;
while (s.phase !== 'over' && s.turn <= +(process.argv[2] || 12)) {
  if (s.turn !== turn) { turn = s.turn; n = 0; }
  dbg.length = 0;
  let a = aiChoose(s, 'hard', r);
  if (++n > 60 && !s.pendingResponse) a = { type: 'done' };
  if (s.priority === 'player' && s.turn >= +(process.argv[3] || 9)) {
    const c = a.creatureUid && s.board.creatures.find((x: any) => x.uid === a.creatureUid);
    console.log(`t${s.turn} ${s.phase} pool=${s.players.player.crystals}+${s.players.player.bank} -> ${a.type} ${a.ability || ''} ${c ? CARDS[c.cardId].name + '@' + c.row + ',' + c.col : ''} to ${a.row ?? a.target?.row ?? ''},${a.col ?? a.target?.col ?? ''}`, dbg[0] ? JSON.stringify(dbg[0].top.slice(0, 4)) : '');
  }
  let x: any = applyAction(s, a); if (!x.ok) x = applyAction(s, s.pendingResponse ? { type: 'pass' } : { type: 'done' });
  s = x.state;
}
const mine = s.board.creatures.filter((c: any) => c.owner === 'player').map((c: any) => `${CARDS[c.cardId].name}@${c.row},${c.col}${c.minedMine ? 'M' : ''}`);
console.log('player units', mine.join(' | ')); console.log('sites', JSON.stringify(s.sites.map((x: any) => [x.row, x.col, x.controller])));
