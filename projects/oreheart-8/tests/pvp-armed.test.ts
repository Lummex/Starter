import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions } from '../src/engine';
import { viewFor } from '../src/engine/view';

// Armed counters (Ken, Nov 4: attacks must feel instant in PvP). The defender sets an instant on a unit during their own turn;
// it fires by itself when an enemy attack lands there. No Respond window per attack. Vs-computer play is unchanged.
describe('armed counters (PvP attack mode "armed")', () => {
  const mines = [{ row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 6 }];
  const setup = {
    playerHand: ['shield-bubble', 'healing-light', 'second-wind'], opponentHand: ['shield-bubble'], playerCrystals: 9, opponentCrystals: 9,
    board: [{ owner: 'player', cardId: 'shiv-rat', row: 4, col: 5 }, { owner: 'opponent', cardId: 'shiv-rat', row: 4, col: 6 }], firstPlayer: 'player',
  };
  const fresh = (mode: 'armed' | 'window' = 'armed') => createMatch({ seed: 1, setup, mines, factionLock: false, pvp: true, attackMode: mode });
  const step = (s: any, a: any) => { const r = applyAction(s, a); expect(r.ok, JSON.stringify(a) + ' ' + r.error).toBe(true); return r; };
  const toOpponentAction = (s: any) => { // player Done, Done; opponent is in Deploy; Done -> opponent Action
    s = step(s, { type: 'done' }).state; s = step(s, { type: 'done' }).state;
    expect(s.activePlayer).toBe('opponent');
    return step(s, { type: 'done' }).state;
  };

  it('offers arm on own units (and the Commander for Second Wind) on your own turn only, and disarm for a set one', () => {
    const s = fresh();
    const arms = legalActions(s).filter((a: any) => a.type === 'arm');
    expect(arms.some((a: any) => a.target.row === 4 && a.target.col === 5)).toBe(true);
    expect(arms.some((a: any) => a.target.row === 4 && a.target.col === 6), 'never on an enemy unit').toBe(false);
    expect(arms.some((a: any) => a.target.commander === 'player'), 'Second Wind on the Commander').toBe(true);
    const shield = arms.find((a: any) => a.target.row === 4 && a.target.col === 5 && s.players.player.hand.find((h: any) => h.uid === a.uid).cardId === 'shield-bubble');
    const r = step(s, shield);
    expect(r.state.players.player.crystals, 'arming costs nothing yet').toBe(9);
    expect(r.state.players.player.hand.length, 'the card stays in the hand').toBe(3);
    expect(legalActions(r.state).some((a: any) => a.type === 'disarm' && a.uid === shield.uid)).toBe(true);
    expect(legalActions(r.state).some((a: any) => a.type === 'arm' && a.uid === shield.uid), 'a set card is not offered again').toBe(false);
    const d = step(r.state, { type: 'disarm', uid: shield.uid });
    expect(d.state.armed.player).toEqual([]);
  });

  it('fires the set counter when an enemy attack lands on that unit: no window, paid then, and the attack resolves at once', () => {
    let s = fresh();
    const shield = legalActions(s).find((a: any) => a.type === 'arm' && a.target.row === 4 && a.target.col === 5 && s.players.player.hand.find((h: any) => h.uid === a.uid).cardId === 'shield-bubble');
    s = step(s, shield).state;
    s = toOpponentAction(s);
    expect(s.armed.player.length, 'the counter lasts through the enemy turn').toBe(1);
    const atk = legalActions(s).find((a: any) => a.type === 'attack' && a.target.row === 4 && a.target.col === 5);
    expect(atk).toBeTruthy();
    const r = step(s, atk);
    expect(r.state.pendingResponse, 'no Respond window').toBeNull();
    expect(r.state.priority).toBe('opponent');
    expect(r.events.some((e: any) => e.type === 'respond' && e.armed && e.cardId === 'shield-bubble')).toBe(true);
    expect(r.state.players.player.crystals, 'paid when it fired').toBe(7);
    expect(r.state.players.player.hand.length).toBe(2);
    expect(r.state.players.player.discard.some((c: any) => c.cardId === 'shield-bubble')).toBe(true);
    expect(r.state.armed.player).toEqual([]);
    const rat = r.state.board.creatures.find((c: any) => c.owner === 'player');
    expect(rat && rat.health, 'the bubble took the hit').toBe(rat.maxHealth);
  });

  it('does not fire for an attack elsewhere, and the set counters expire at the end of the enemy turn', () => {
    let s = createMatch({ seed: 1, setup: { ...setup, board: [...setup.board, { owner: 'player', cardId: 'shiv-rat', row: 5, col: 6 }] }, mines, factionLock: false, pvp: true, attackMode: 'armed' });
    const shield = legalActions(s).find((a: any) => a.type === 'arm' && a.target.row === 5 && a.target.col === 6);
    s = step(s, shield).state;
    s = toOpponentAction(s);
    const atk = legalActions(s).find((a: any) => a.type === 'attack' && a.target.row === 4 && a.target.col === 5);
    const r = step(s, atk);
    expect(r.events.some((e: any) => e.type === 'respond')).toBe(false);
    expect(r.state.armed.player.length).toBe(1);
    expect(r.state.players.player.crystals).toBe(9);
    const after = step(r.state, { type: 'done' }).state; // opponent's turn ends
    expect(after.activePlayer).toBe('player');
    expect(after.armed.player, 'gone with the enemy turn').toEqual([]);
  });

  it('keeps the other side\'s set counters secret in their view', () => {
    let s = fresh();
    s = step(s, legalActions(s).find((a: any) => a.type === 'arm')).state;
    expect(viewFor(s, 'opponent').armed.player).toEqual([]);
    expect(viewFor(s, 'player').armed.player.length).toBe(1);
  });

  it('leaves a counter set when it cannot be paid, and still resolves the attack at once', () => {
    let s = createMatch({ seed: 1, setup: { ...setup, playerCrystals: 1 }, mines, factionLock: false, pvp: true, attackMode: 'armed' });
    s = step(s, legalActions(s).find((a: any) => a.type === 'arm' && a.target.row === 4 && a.target.col === 5)).state;
    s = toOpponentAction(s);
    const r = step(s, legalActions(s).find((a: any) => a.type === 'attack' && a.target.row === 4 && a.target.col === 5));
    expect(r.state.pendingResponse).toBeNull();
    expect(r.events.some((e: any) => e.type === 'respond')).toBe(false);
    expect(r.state.armed.player.length).toBe(1);
  });

  it('mode "window" and vs-computer play: no arm actions, the old Respond window as before', () => {
    const w = fresh('window');
    expect(legalActions(w).some((a: any) => a.type === 'arm')).toBe(false);
    const off = createMatch({ seed: 1, setup, mines, factionLock: false });
    expect(off.attackMode).toBe('window');
    expect(legalActions(off).some((a: any) => a.type === 'arm')).toBe(false);
    let s = toOpponentAction(w);
    const r = step(s, legalActions(s).find((a: any) => a.type === 'attack'));
    expect(r.state.pendingResponse?.kind).toBe('attack');
  });
});
