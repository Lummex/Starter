import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions, creatureAt } from '../src/engine';

const act = (s: any, a: any) => { const r = applyAction(s, a); if (!r.ok) throw new Error(r.error); return r.state; };
const done = (s: any, n = 1) => { for (let i = 0; i < n; i++) s = act(s, { type: 'done' }); return s; };
const mk = (setup: any, o: any = {}) => createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', setup, ...o });
const uidOf = (s: any, who: string, cardId: string) => s.players[who].hand.find((h: any) => h.cardId === cardId).uid;

describe('setup and opening', () => {
  it('is deterministic and serializable', () => {
    const a = createMatch({ seed: 5 }), b = createMatch({ seed: 5 });
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(a.players.player.hand.length + a.players.player.deck.length).toBe(50);
  });
  it('first player skips draw, gets 6 crystals; second has 6 then 7 cards', () => {
    let s = createMatch({ seed: 1, skipMulligan: true, firstPlayer: 'player' });
    expect(s.turn).toBe(1);
    expect(s.players.player.hand.length).toBe(5);
    expect(s.players.opponent.hand.length).toBe(6);
    expect(s.players.player.crystals.green).toBe(6);
    s = done(s, 3);
    expect(s.activePlayer).toBe('opponent');
    expect(s.players.opponent.hand.length).toBe(7);
  });
});

describe('site control and income', () => {
  it('majority control, ties = nobody, gatherer bonus', () => {
    let s = mk({ board: [
      { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 2 },
      { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 3 },
      { cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 3 },
      { cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 4 },
    ] });
    s = done(s, 3); // opponent turn starts
    expect(s.sites.map((x: any) => x.controller)).toEqual(['player', 'opponent', null]); // col 3 is shared by two sites
  });
  it('income: stronghold + site + gatherer', () => {
    let s = mk({ board: [{ cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 2 }], playerCrystals: { green: 0 } });
    s = done(s, 3); s = done(s, 3);
    expect(s.activePlayer).toBe('player');
    expect(s.players.player.crystals.green).toBe(1 + 1 + 2);
  });
  it('underdog bonus', () => {
    let s = mk({});
    s = done(s, 3); s = done(s, 3);
    expect(s.players.player.crystals.green).toBe(3);
  });
});

describe('combat', () => {
  it('type advantage, strike back, damage stays, defeat to discard', () => {
    let s = mk({ board: [
      { cardId: 'shieldbeard', owner: 'player', row: 4, col: 3 },
    ].concat([{ cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 3 }] as any) }, { playerCommander: 'borgo' });
    s = done(s, 2);
    const me = creatureAt(s, 4, 3);
    s = act(s, { type: 'attack', creatureUid: me.uid, target: { row: 3, col: 3 } });
    expect(creatureAt(s, 3, 3)).toBeUndefined();
    expect(s.players.opponent.discard.length).toBe(1);
  });
  it('strike back damages attacker', () => {
    let s = mk({ board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 4, col: 3 },
      { cardId: 'shieldbeard', owner: 'opponent', row: 3, col: 3 },
    ] });
    s = done(s, 2);
    s = act(s, { type: 'attack', creatureUid: creatureAt(s, 4, 3).uid, target: { row: 3, col: 3 } });
    expect(creatureAt(s, 3, 3).health).toBe(2);
    expect(creatureAt(s, 4, 3)).toBeUndefined(); // dwarves beat goblins: 2+1 kills it on the strike back
  });
  it('guard forces target; ranged hits at 2', () => {
    let s = mk({ board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 4, col: 3 },
      { cardId: 'shieldbeard', owner: 'opponent', row: 3, col: 3 },
      { cardId: 'goblin-slinger', owner: 'opponent', row: 3, col: 4 },
    ] });
    s = done(s, 2);
    const t = legalActions(s).filter((a: any) => a.type === 'attack').map((a: any) => a.target);
    expect(t).toEqual([{ row: 3, col: 3 }]);
    const r = mk({ board: [
      { cardId: 'goblin-slinger', owner: 'player', row: 5, col: 3 },
      { cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 3 },
    ] });
    const t2 = legalActions(done(r, 2)).filter((a: any) => a.type === 'attack');
    expect(t2.length).toBe(1);
  });
});

describe('spells and instants', () => {
  it('fireball deals 3, paid with any color', () => {
    let s = mk({ playerHand: ['fireball'], playerCrystals: { blue: 3, green: 2 }, board: [{ cardId: 'clockwork-beetle', owner: 'opponent', row: 3, col: 3 }, { cardId: 'goblin-scrapper', owner: 'opponent', row: 2, col: 2 }] });
    s = act(s, { type: 'cast', uid: uidOf(s, 'player', 'fireball'), target: { row: 2, col: 2 } });
    expect(creatureAt(s, 2, 2)).toBeUndefined();
    expect(s.players.player.crystals).toEqual({ green: 0, blue: 0, purple: 0 });
  });
  it('fizzle counters fireball, crystals still spent', () => {
    let s = mk({ playerHand: ['fireball'], playerCrystals: { green: 5 }, opponentHand: ['fizzle'], opponentCrystals: { blue: 5 }, board: [{ cardId: 'goblin-scrapper', owner: 'opponent', row: 2, col: 2 }] }, { opponentCommander: 'borgo' });
    s = act(s, { type: 'cast', uid: uidOf(s, 'player', 'fireball'), target: { row: 2, col: 2 } });
    expect(s.pendingResponse.responder).toBe('opponent');
    s = act(s, { type: 'respond', uid: uidOf(s, 'opponent', 'fizzle') });
    expect(creatureAt(s, 2, 2).health).toBe(4);
    expect(s.players.player.crystals.green).toBe(0);
    expect(s.players.player.discard.length).toBe(1);
  });
  it('hold it returns creature to hand', () => {
    let s = mk({ playerHand: ['goblin-scrapper'], playerCrystals: { green: 3 }, opponentHand: ['hold-it'], opponentCrystals: { purple: 6 } }, { opponentCommander: 'borgo' });
    s = act(s, { type: 'summon', uid: uidOf(s, 'player', 'goblin-scrapper'), row: 7, col: 1 });
    s = act(s, { type: 'respond', uid: uidOf(s, 'opponent', 'hold-it') });
    expect(s.board.creatures.length).toBe(0);
    expect(s.players.player.hand.length).toBe(1);
    expect(s.players.player.crystals.green).toBe(2); // Grubnak discount: cost 1, still spent
  });
  it('rejects illegal actions without changing state', () => {
    const s = mk({ playerHand: ['goblin-scrapper'] });
    const r = applyAction(s, { type: 'summon', uid: s.players.player.hand[0].uid, row: 1, col: 1 });
    expect(r.ok).toBe(false);
    expect(r.state).toEqual(s);
  });
});

describe('crystal cards', () => {
  it('one per turn', () => {
    let s = mk({ playerHand: ['soul-shard', 'soul-shard'] });
    s = act(s, { type: 'playCrystal', uid: s.players.player.hand[0].uid });
    expect(s.players.player.crystals.green).toBe(1);
    expect(applyAction(s, { type: 'playCrystal', uid: s.players.player.hand[0].uid }).ok).toBe(false);
  });
});

describe('win / deck-out', () => {
  it('commander at 0 retreats', () => {
    let s = mk({ opponentHealth: 1, playerHand: ['fireball'], playerCrystals: { green: 5 } });
    s = act(s, { type: 'cast', uid: s.players.player.hand[0].uid, target: { commander: 'opponent' } });
    expect(s.winner).toBe('player');
    expect(s.phase).toBe('over');
  });
  it('deck-out costs 1 health', () => {
    let s = mk({ opponentDeck: [] });
    s = done(s, 3);
    expect(s.players.opponent.health).toBe(19);
  });
  it('surrender', () => {
    const s = act(mk({}), { type: 'surrender' });
    expect(s.winner).toBe('opponent');
  });
});
