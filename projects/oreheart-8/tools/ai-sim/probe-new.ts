// Nov 6: what the computer does with the new cards in fixed spots (prints its pick on Medium and Hard). Not part of the game build.
import { createMatch, applyAction, legalActions, CARDS } from '../../src/engine';
import { aiChoose, makeRand } from '../../src/ai/ai';
import { setDiceMode } from '../../src/engine/dice';
setDiceMode('seeded');
const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const P = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'player', row, col, ...x });
const O = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'opponent', row, col, ...x });
const mk = (setup: any, extra: any = {}) => createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', factionLock: false, mines: MINES, testMode: true, setup: { firstPlayer: 'player', playerHand: [], opponentHand: [], ...setup }, ...extra });
const show = (s: any, a: any) => { const c = a.creatureUid && s.board.creatures.find((x: any) => x.uid === a.creatureUid); const h = a.uid && s.players.player.hand.find((x: any) => x.uid === a.uid); return `${a.type}${a.ability ? ':' + a.ability : ''} ${c ? CARDS[c.cardId].name + '@' + c.row + ',' + c.col : ''}${h ? CARDS[h.cardId].name : ''} ${a.row != null ? '->' + a.row + ',' + a.col : a.target ? '->' + JSON.stringify(a.target) : ''}`; };
function run(name: string, s: any, steps = 6) {
  for (const diff of ['normal', 'hard']) {
    let st = s, out: string[] = [];
    const r = makeRand(7);
    for (let i = 0; i < steps; i++) {
      if (st.phase === 'over' || st.priority !== 'player') break;
      const a = aiChoose(st, diff, r);
      out.push(show(st, a));
      if (a.type === 'done') break;
      const x: any = applyAction(st, a); if (!x.ok) { out.push('ILLEGAL ' + x.error); break; }
      st = x.state;
    }
    console.log(`[${name}] ${diff}: ${out.join(' | ')}`);
  }
}
// 1. Deploy with Mama and 9 crystals, a Miner and a Grunt in hand: does it brood (and still play the Miner)?
run('brood', mk({ playerCrystals: 9, playerHand: ['goblin-scrounger', 'goblin-grunt'], board: [P('mama-grubsnout', 6, 4), P('snot-sergeant-gurk', 5, 6), O('dwarf-pickman', 3, 7)] }));
// 2. Tallulah with 6 crystals and a Fireball in hand, an enemy in reach
run('spark', mk({ playerCrystals: 6, playerHand: ['fireball'], board: [P('wispmother-tallulah', 6, 4), P('runic-siphoner', 6, 5), O('dwarf-pickman', 3, 7)] }));
// 3. Cogsworth with 6 crystals beside a mine
run('build', mk({ playerCrystals: 6, board: [P('engineer-cogsworth', 4, 5)] }));
// 4. Action phase: Catapult with a Piglet beside it, an enemy 4 away
let s4: any = mk({ playerCrystals: 5, board: [P('junk-catapult-crew', 6, 4), P('runt-piglet', 6, 5), O('dwarf-pickman', 3, 8), O('goblin-grunt', 2, 7)] }); s4 = applyAction(s4, { type: 'done' }).state;
run('fling', s4);
// 5. Action phase: Tinker in line with a wall, Fireball in hand (Jinx first, then the spell?)
let s5: any = mk({ playerCrystals: 9, playerHand: ['fireball'], board: [P('hexbolt-tinker', 5, 4), O('dwarf-pickman', 5, 8, { damage: 2 })] }); s5 = applyAction(s5, { type: 'done' }).state;
run('jinx-spell', s5);
// 6. Sooey in hand, an owned mine with free spaces
run('sooey', mk({ playerCrystals: 9, playerHand: ['sooey-hog-call', 'goblin-grunt'], board: [P('goblin-scrounger', 4, 9, { minedMine: { row: 4, col: 10 } }), O('dwarf-pickman', 1, 5)] }));
// 7. Stand Fast in hand on our own turn (should keep it), and as a response when a wall is attacked
run('standfast-own', mk({ playerCrystals: 9, playerHand: ['stand-fast-lads'], board: [P('dwarf-pickman', 4, 6), O('grubnaks-big-boss-troll', 2, 6)] }, { playerCommander: 'borgo' }));
let s7: any = mk({ playerCrystals: 9, playerHand: ['stand-fast-lads'], board: [P('dwarf-pickman', 4, 6), O('grubnaks-big-boss-troll', 3, 6)], firstPlayer: 'opponent' }, { playerCommander: 'borgo' });
s7 = applyAction(s7, { type: 'done' }).state; const troll = s7.board.creatures.find((c: any) => c.cardId === 'grubnaks-big-boss-troll');
const r7: any = applyAction(s7, { type: 'attack', creatureUid: troll.uid, target: { row: 4, col: 6 } });
console.log('respond window open:', !!r7.state.pendingResponse, 'legal:', legalActions(r7.state).map((a: any) => a.type).join());
for (const diff of ['normal', 'hard']) console.log(`[standfast-respond] ${diff}: ${show(r7.state, aiChoose(r7.state, diff, makeRand(3)))}`);
// 8. Durga with 4 crystals and an Apprentice beside her, a Smith card in hand
run('durga', mk({ playerCrystals: 4, playerHand: ['dwarf-smith-miner'], board: [P('master-smith-durga', 6, 4), P('hammerhand-apprentice', 6, 5), O('dwarf-pickman', 2, 7)] }, { playerCommander: 'borgo' }));
