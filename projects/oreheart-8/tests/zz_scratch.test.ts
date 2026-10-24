import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions } from '../src/engine';
const OLD_MINES = [{ row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 6 }];
const start = (o: any) => { let w = { ...o }; if (w.setup && !w.mines) w.mines = OLD_MINES; if (w.setup && w.factionLock === undefined) w.factionLock = false; return { s: createMatch({ seed: 123, testMode: true, ...w }) }; };
let S: any;
const mk = (o: any) => { S = start(o).s; return S; };
const act = (a: any) => { const r = applyAction(S, a); if (r.ok) S = r.state; return r; };
const at = (r: number, c: number) => S.board.creatures.find((x: any) => x.row === r && x.col === c);
const legal = () => legalActions(S);
const hu = (side: string, id: string) => S.players[side].hand.find((c: any) => c.cardId === id).uid;
const done = () => expect(act({ type: 'done' }).ok).toBe(true);
const pass = () => { done(); done(); };
describe('scratch', () => {
  it('AC13', () => {
    mk({ ai: false, playerCommander: 'borgo', opponentCommander: 'borgo', setup: { board: [
      { cardId: 'axe-thrower', owner: 'player', row: 5, col: 7 }, { cardId: 'shieldbeard', owner: 'opponent', row: 4, col: 7 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 3, col: 7 }, { cardId: 'dwarf-miner', owner: 'opponent', row: 3, col: 6 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 2, col: 10 }, { cardId: 'dwarf-miner', owner: 'opponent', row: 5, col: 12 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 5, col: 1 }, { cardId: 'goblin-slinger', owner: 'player', row: 4, col: 12 },
      { cardId: 'goblin-slinger', owner: 'player', row: 6, col: 1 }, { cardId: 'dwarf-miner', owner: 'opponent', row: 6, col: 8 },
      { cardId: 'goblin-slinger', owner: 'player', row: 7, col: 4 }, { cardId: 'dwarf-miner', owner: 'opponent', row: 7, col: 12 } ] } });
    done();
    const axe = at(5, 7).uid;
    const acts = legal().filter((a: any) => a.type === 'attack');
    const can = (u: string, r: number, c: number) => acts.some((a: any) => a.creatureUid === u && a.target.row === r && a.target.col === c);
    expect([can(axe,4,7),can(axe,3,7),can(axe,3,6),can(axe,2,10),can(axe,5,12),can(axe,5,1),can(at(6,1).uid,6,8),can(at(7,4).uid,7,12)]).toEqual([true,false,false,true,true,true,true,false]);
    const sling = at(4, 12).uid;
    expect(acts.some((a: any) => a.creatureUid === sling && a.target.commander === 'opponent')).toBe(true);
  });
  it('AC15', () => {
    mk({ ai: false, playerCommander: 'sproingle', opponentCommander: 'borgo', setup: { playerDeck: Array(12).fill('soul-shard'), opponentDeck: Array(12).fill('soul-shard'), board: [
      { cardId: 'gnome-tinker', owner: 'player', row: 6, col: 1 }, { cardId: 'spark-gnome', owner: 'player', row: 6, col: 2 }, { cardId: 'dwarf-miner', owner: 'opponent', row: 5, col: 3 } ] } });
    expect(at(6,2).shield).toBe(0); pass(); pass();
    expect(at(6,2).shield).toBe(1); expect(at(6,1).shield).toBe(0);
    pass(); expect(S.activePlayer).toBe('opponent'); expect(at(6,2).shield).toBe(1);
    done();
    const r = act({ type: 'attack', creatureUid: at(5,3).uid, target: { row: 6, col: 2 } });
    expect(r.ok, JSON.stringify(r.error)).toBe(true);
    expect(at(6,2).health).toBe(2); expect(at(6,2).shield).toBe(0); expect(at(5,3)).toBeUndefined();
  });
  it('AC18 snuff', () => {
    mk({ ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: { playerHand: ['second-wind'], playerCrystals: 5, opponentHand: ['fizzle'], opponentCrystals: 3 } });
    expect(act({ type: 'cast', uid: hu('player', 'second-wind') }).ok).toBe(true);
    expect(S.pendingResponse).toBe(null);
  });
  it('AC109', () => {
    mk({ ai: false, setup: { playerHand: ['goblin-scrounger'], board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 2, col: 11 }, { cardId: 'goblin-scrapper', owner: 'player', row: 2, col: 7 }] } });
    const sm = legal().filter((a: any) => a.type === 'summon');
    console.log(sm.length, sm.filter((a:any)=>a.row!==7).length);
    mk({ ai: false, setup: { firstPlayer: 'opponent', opponentHand: ['goblin-scrapper'] } });
    const opp = legal().filter((a: any) => a.type === 'summon');
    console.log(JSON.stringify(opp.map((a: any) => [a.row, a.col])));
  });
  it('AC254', () => {
    mk({ ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: 5 } });
    expect(legal().some((a: any) => a.type === 'summon' && a.row === 5 && a.col === 5)).toBe(true);
    mk({ ai: false, firstPlayer: 'opponent', setup: { opponentHand: ['dwarf-miner'], opponentCrystals: 5, firstPlayer: 'opponent' } });
    expect(legal().some((a: any) => a.type === 'summon' && a.row === 3 && a.col === 4)).toBe(true);
  });
});
describe('dbg', () => { it('x', () => {
    mk({ ai: false, playerCommander: 'sproingle', opponentCommander: 'borgo', setup: { board: [
      { cardId: 'gnome-tinker', owner: 'player', row: 6, col: 1 }, { cardId: 'spark-gnome', owner: 'player', row: 6, col: 2 }, { cardId: 'dwarf-miner', owner: 'opponent', row: 5, col: 3 } ] } });
    pass(); pass(); pass(); done();
    console.log(S.turn, S.phase, S.activePlayer, JSON.stringify(at(5,3)), JSON.stringify(legal().filter((a:any)=>a.type==='attack')));
});});
