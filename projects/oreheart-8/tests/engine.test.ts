import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions, creatureAt, CARDS, CONFIG, STARTER_DECKS } from '../src/engine';
import tutorialJson from '../src/content/tutorial.json';

const act = (s: any, a: any) => { const r = applyAction(s, a); if (!r.ok) throw new Error(r.error); return r.state; };
const done = (s: any, n = 1) => { for (let i = 0; i < n; i++) s = act(s, { type: 'done' }); return s; };
const mk = (setup: any, o: any = {}) => createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', setup, ...o });
const uidOf = (s: any, who: string, cardId: string) => s.players[who].hand.find((h: any) => h.cardId === cardId).uid;
const P = (cardId: string, row: number, col: number, extra: any = {}) => ({ cardId, owner: 'player', row, col, ...extra });
const O = (cardId: string, row: number, col: number, extra: any = {}) => ({ cardId, owner: 'opponent', row, col, ...extra });
const attack = (s: any, row: number, col: number, target: any) => act(s, { type: 'attack', creatureUid: creatureAt(s, row, col).uid, target });
const toPlayerTurn3 = (s: any) => done(s, 4);

describe('content', () => {
  it('starter decks: 50 cards = 40 creatures, 6 spells incl. Fizzle, 4 Crystal cards, rare copy limits', () => {
    for (const deck of Object.values(STARTER_DECKS)) {
      expect(deck.length).toBe(50);
      const t = (ty: string) => deck.filter((id) => CARDS[id].type === ty).length;
      expect([t('creature'), t('spell'), t('crystal')]).toEqual([40, 6, 4]);
      expect(deck).toContain('fizzle');
      for (const id of new Set(deck)) if (['Rare', 'Ultra Rare', 'Collector'].includes(CARDS[id].rarity)) expect(deck.filter((x) => x === id).length).toBeLessThanOrEqual(3);
    }
  });
  it('printed creature Health is at most 6', () => {
    for (const c of Object.values(CARDS)) if (c.type === 'creature') expect(c.health).toBeLessThanOrEqual(6);
    expect(['grubnaks-big-boss-troll', 'the-great-steam-golem', 'queen-brunhilda-stonebeard'].map((id) => CARDS[id].health)).toEqual([6, 6, 6]);
    expect(CONFIG.deployTimerSeconds).toBe(30);
    expect(CONFIG.actionTimerSeconds).toBe(45);
  });
});

describe('setup and opening', () => {
  it('is deterministic and serializable', () => {
    const a = createMatch({ seed: 5 }), b = createMatch({ seed: 5 });
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(a.players.player.hand.length + a.players.player.deck.length).toBe(50);
  });
  it('turn 1 gives exactly 1 crystal; second player has 6 cards, then 7 and 1 crystal on turn 2', () => {
    let s = createMatch({ seed: 1, skipMulligan: true, firstPlayer: 'player' });
    expect(s.turn).toBe(1);
    expect(s.players.player.crystals).toEqual({ green: 1, blue: 0, purple: 0 });
    expect(s.players.player.hand.length).toBe(5);
    expect(s.players.opponent.hand.length).toBe(6);
    expect(s.players.player.health).toBe(20);
    s = done(s, 2);
    expect(s.activePlayer).toBe('opponent');
    expect(s.players.opponent.hand.length).toBe(7);
    expect(s.players.opponent.crystals).toEqual({ green: 0, blue: 1, purple: 0 });
  });
});

describe('site control and income', () => {
  it('majority control, ties = nobody, shared columns count for both sites', () => {
    let s = mk({ board: [P('goblin-scrounger', 5, 2), P('goblin-scrapper', 5, 3), O('gnome-tinker', 3, 3), O('gnome-tinker', 3, 4)] });
    s = done(s, 2);
    expect(s.sites.map((x: any) => x.controller)).toEqual(['player', 'opponent', null]);
    expect(s.sites[0].color).toBe('green');
    expect(s.sites[1].color).toBe('blue');
  });
  it('income: stronghold 1 + site 1 + Gatherer 2 = 4', () => {
    const s = toPlayerTurn3(mk({ board: [P('goblin-scrounger', 5, 2)] }));
    expect(s.activePlayer).toBe('player');
    expect(s.players.player.crystals.green).toBe(4);
  });
  it('underdog +2 only when the enemy controls a site', () => {
    expect(toPlayerTurn3(mk({ board: [O('gnome-tinker', 3, 2)] })).players.player.crystals.green).toBe(3);
    expect(toPlayerTurn3(mk({})).players.player.crystals.green).toBe(1);
  });
  it('Glowing Geode adds 1', () => {
    let s = mk({ playerHand: ['glowing-geode'] });
    s = act(s, { type: 'playCrystal', uid: uidOf(s, 'player', 'glowing-geode') });
    expect(toPlayerTurn3(s).players.player.crystals.green).toBe(2);
  });
});

describe('summoning', () => {
  const summons = (s: any, uid: string) => legalActions(s).filter((a) => a.type === 'summon' && a.uid === uid);
  it('only on the back row; Grubnak discount applies', () => {
    let s = mk({ playerHand: ['goblin-scrapper'], playerCrystals: { green: 1 } });
    const uid = uidOf(s, 'player', 'goblin-scrapper');
    const sp = summons(s, uid);
    expect(sp.length).toBe(6);
    expect(sp.every((a) => a.row === 7 && a.col !== 4)).toBe(true);
    s = act(s, sp[0]);
    expect(s.players.player.crystals.green).toBe(0);
    expect(creatureAt(s, 7, 1)).toBeDefined();
  });
  it('front row only when the back row is full; none when both are full', () => {
    const back = [1, 2, 3, 5, 6, 7].map((c, i) => (i % 2 ? O : P)('goblin-scrapper', 7, c));
    let s = mk({ playerHand: ['goblin-scrapper'], playerCrystals: { green: 1 }, board: back });
    const uid = uidOf(s, 'player', 'goblin-scrapper');
    const sp = summons(s, uid);
    expect(sp.length).toBe(7);
    expect(sp.every((a) => a.row === 6)).toBe(true);
    const front = [1, 2, 3, 4, 5, 6, 7].map((c) => P('goblin-scrapper', 6, c));
    s = mk({ playerHand: ['goblin-scrapper'], playerCrystals: { green: 1 }, board: back.concat(front as any) });
    expect(summons(s, uidOf(s, 'player', 'goblin-scrapper')).length).toBe(0);
  });
  it('summoned creatures cannot act, except Wolf Rider', () => {
    let s = mk({ playerHand: ['goblin-scrapper', 'wolf-rider'], playerCrystals: { green: 5 } });
    s = act(s, { type: 'summon', uid: uidOf(s, 'player', 'goblin-scrapper'), row: 7, col: 1 });
    s = act(s, { type: 'summon', uid: uidOf(s, 'player', 'wolf-rider'), row: 7, col: 2 });
    s = done(s);
    const l = legalActions(s);
    expect(l.some((a) => a.creatureUid === creatureAt(s, 7, 1).uid)).toBe(false);
    expect(l.some((a) => a.type === 'move' && a.creatureUid === creatureAt(s, 7, 2).uid)).toBe(true);
  });
  it('Tunnel only while the enemy controls more sites than you', () => {
    const near = (s: any, uid: string) => summons(s, uid).filter((a) => a.row === 5 && a.col === 2).length;
    let s = mk({ playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 } });
    expect(near(s, uidOf(s, 'player', 'goblin-scrounger'))).toBe(0);
    s = mk({ playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 }, board: [O('gnome-tinker', 3, 2)] });
    expect(near(s, uidOf(s, 'player', 'goblin-scrounger'))).toBe(1);
    s = mk({ playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 }, board: [O('gnome-tinker', 3, 2), P('goblin-scrapper', 5, 1), P('goblin-scrapper', 5, 7)] });
    expect(near(s, uidOf(s, 'player', 'goblin-scrounger'))).toBe(0);
  });
  it('Unique cards: one at a time; Borgo gives +1 Health', () => {
    const s = mk({ playerHand: ['grubnaks-big-boss-troll'], playerCrystals: { green: 6 }, board: [P('grubnaks-big-boss-troll', 7, 1)] });
    expect(legalActions(s).some((a) => a.type === 'summon')).toBe(false);
    const b = mk({ board: [P('shieldbeard', 7, 1)] }, { playerCommander: 'borgo' });
    expect(creatureAt(b, 7, 1).health).toBe(5);
    expect(creatureAt(b, 7, 1).maxHealth).toBe(5);
  });
});

describe('movement', () => {
  it('moves 1 in 8 directions; move-2 creatures can go 2', () => {
    let s = done(mk({ board: [P('goblin-scrapper', 5, 5), P('wolf-rider', 6, 1)] }));
    const mv = (r: number, c: number) => legalActions(s).filter((a) => a.type === 'move' && a.creatureUid === creatureAt(s, r, c).uid).map((a) => `${a.row},${a.col}`);
    expect(mv(5, 5).sort()).toEqual(['4,4', '4,5', '4,6', '5,4', '5,6', '6,4', '6,5', '6,6'].filter((x) => x !== '4,4' && x !== '4,6').sort());
    expect(mv(6, 1)).toContain('4,3');
    expect(mv(6, 1)).toContain('5,2');
  });
  it('a creature either moves or attacks, never both', () => {
    let s = done(mk({ board: [P('goblin-scrapper', 4, 3), O('gnome-tinker', 3, 3)] }));
    const uid = creatureAt(s, 4, 3).uid;
    expect(legalActions(s).some((a) => a.type === 'attack' && a.creatureUid === uid)).toBe(true);
    const moved = act(s, { type: 'move', creatureUid: uid, row: 5, col: 3 });
    expect(legalActions(moved).some((a) => a.creatureUid === uid)).toBe(false);
    const hit = attack(s, 4, 3, { row: 3, col: 3 });
    expect(legalActions(hit).some((a) => a.type === 'move' && a.creatureUid === uid)).toBe(false);
  });
  it('Ram Rider (Charge) can move and attack', () => {
    let s = done(mk({ board: [P('ram-rider', 5, 3), O('gnome-tinker', 3, 3)] }));
    const uid = creatureAt(s, 5, 3).uid;
    s = act(s, { type: 'move', creatureUid: uid, row: 4, col: 3 });
    expect(legalActions(s).some((a) => a.type === 'attack' && a.creatureUid === uid)).toBe(true);
  });
});

describe('combat', () => {
  const fight = (a: string, ad: number, b: string, bd: number) => {
    let s = done(mk({ board: [P(a, 4, 3, { damage: ad }), O(b, 3, 3, { damage: bd })] }));
    return attack(s, 4, 3, { row: 3, col: 3 });
  };
  it('1/2 vs 1/1: the 1/1 dies, the 1/2 survives at 1', () => {
    const s = fight('goblin-slinger', 0, 'goblin-scrounger', 1);
    expect(creatureAt(s, 3, 3)).toBeUndefined();
    expect(creatureAt(s, 4, 3).health).toBe(1);
    expect(s.players.opponent.discard.length).toBe(1);
  });
  it('two 1/1s defeat each other', () => {
    const s = fight('goblin-slinger', 1, 'goblin-scrounger', 1);
    expect(s.board.creatures.length).toBe(0);
    expect(s.players.player.discard.length).toBe(1);
    expect(s.players.opponent.discard.length).toBe(1);
  });
  it('Shieldbeard vs Scrapper: type advantage 3 kills, strike back 2 leaves 2', () => {
    const s = fight('shieldbeard', 0, 'goblin-scrapper', 0);
    expect(creatureAt(s, 3, 3)).toBeUndefined();
    expect(creatureAt(s, 4, 3).health).toBe(2);
  });
  it('ranged attacks get no strike back; Sneaky prevents it too', () => {
    let s = done(mk({ board: [P('goblin-slinger', 5, 3), O('clockwork-beetle', 3, 3)] }));
    s = attack(s, 5, 3, { row: 3, col: 3 });
    expect(creatureAt(s, 5, 3).health).toBe(2);
    expect(creatureAt(s, 3, 3).health).toBe(4); // 1 + type advantage 1 - armored 1 = 1 damage
  });
  it('Sneaky: no strike back', () => {
    let s = done(mk({ board: [P('goblin-sneak', 4, 3), O('clockwork-beetle', 3, 3)] }));
    s = attack(s, 4, 3, { row: 3, col: 3 });
    expect(creatureAt(s, 4, 3).health).toBe(2);
  });
  it('Guard: melee must target the Guard', () => {
    const s = done(mk({ board: [P('goblin-scrapper', 4, 3), O('shieldbeard', 3, 3), O('gnome-tinker', 3, 4)] }));
    const t = legalActions(s).filter((a) => a.type === 'attack').map((a) => `${a.target.row},${a.target.col}`);
    expect(t).toEqual(['3,3']);
  });
});

describe('Commander damage equals Attack', () => {
  it('Queen Brunhilda deals 5, Scrapper deals 2 (no type advantage), Battle Cry adds 1', () => {
    let s = done(mk({ board: [P('queen-brunhilda-stonebeard', 2, 4)] }));
    s = attack(s, 2, 4, { commander: 'opponent' });
    expect(s.players.opponent.health).toBe(15);
  });
  it('Scrapper deals exactly 2 and Battle Cry makes it 3', () => {
    let s = done(mk({ board: [P('goblin-scrapper', 2, 3)] }));
    expect(attack(s, 2, 3, { commander: 'opponent' }).players.opponent.health).toBe(18);
    s = mk({ board: [P('goblin-scrapper', 2, 3)], playerHand: ['battle-cry'], playerCrystals: { green: 7 } });
    s = act(s, { type: 'cast', uid: uidOf(s, 'player', 'battle-cry') });
    s = done(s);
    expect(attack(s, 2, 3, { commander: 'opponent' }).players.opponent.health).toBe(17);
  });
  it('Commander damage never resets', () => {
    let s = mk({ board: [P('goblin-scrapper', 2, 3)] });
    s = done(s); s = attack(s, 2, 3, { commander: 'opponent' });
    s = done(s, 5);
    expect(s.players.opponent.health).toBe(18);
  });
});

describe('healing and Shield', () => {
  it('creatures heal at the start of their owner turn only', () => {
    let s = done(mk({ board: [P('shieldbeard', 4, 3), O('goblin-scrapper', 3, 3)] }));
    s = attack(s, 4, 3, { row: 3, col: 3 });
    expect(creatureAt(s, 4, 3).health).toBe(2);
    s = done(s);
    expect(s.activePlayer).toBe('opponent');
    expect(creatureAt(s, 4, 3).health).toBe(2);
    s = done(s, 3);
    expect(s.activePlayer).toBe('player');
    expect(creatureAt(s, 4, 3).health).toBe(4);
  });
  it('Gnome Tinker gives adjacent allies Shield 1 at the start of its owner turn', () => {
    const s = toPlayerTurn3(mk({ board: [P('gnome-tinker', 5, 4), P('goblin-scrapper', 5, 5)] }));
    expect(creatureAt(s, 5, 5).shield).toBe(1);
    expect(creatureAt(s, 5, 4).shield).toBe(0);
  });
  it('Shield blocks exactly 1 damage', () => {
    let s = mk({ firstPlayer: 'opponent', board: [O('goblin-scrapper', 3, 3), P('shieldbeard', 4, 3, { shield: 1 })] });
    s = done(s);
    s = attack(s, 3, 3, { row: 4, col: 3 });
    expect(creatureAt(s, 4, 3).health).toBe(3);
    expect(creatureAt(s, 4, 3).shield).toBe(0);
  });
  it('Brewmaster gives adjacent allies +1 Health until the next turn', () => {
    const s = toPlayerTurn3(mk({ board: [P('brewmaster', 5, 4), P('goblin-scrapper', 5, 5)] }));
    expect(creatureAt(s, 5, 5).maxHealth).toBe(4);
    expect(creatureAt(s, 5, 5).health).toBe(4);
  });
});

describe('spells, upgrades and Crystal cards', () => {
  it('Fireball deals 3 and can be paid with any color', () => {
    let s = mk({ playerHand: ['fireball'], playerCrystals: { blue: 5 } });
    s = act(s, { type: 'cast', uid: uidOf(s, 'player', 'fireball'), target: { commander: 'opponent' } });
    expect(s.players.opponent.health).toBe(17);
    expect(s.players.player.crystals.blue).toBe(0);
  });
  it('only one Crystal card per turn', () => {
    let s = mk({ playerHand: ['soul-shard', 'soul-shard'] });
    s = act(s, { type: 'playCrystal', uid: s.players.player.hand[0].uid });
    expect(s.players.player.crystals.green).toBe(1);
    expect(legalActions(s).some((a) => a.type === 'playCrystal')).toBe(false);
    const before = JSON.stringify(s);
    const r = applyAction(s, { type: 'playCrystal', uid: s.players.player.hand[0].uid });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('upgrades: Heavy Armor +3 Health costs 6, one per creature; Sharpened Weapons +1 Attack', () => {
    let s = mk({ playerCrystals: { green: 12 }, board: [P('goblin-scrapper', 7, 1)] });
    const uid = creatureAt(s, 7, 1).uid;
    s = act(s, { type: 'upgrade', creatureUid: uid, upgrade: 'heavy-armor' });
    expect(creatureAt(s, 7, 1).health).toBe(6);
    expect(creatureAt(s, 7, 1).maxHealth).toBe(6);
    expect(s.players.player.crystals.green).toBe(6);
    expect(legalActions(s).some((a) => a.type === 'upgrade' && a.creatureUid === uid)).toBe(false);
    s = mk({ playerCrystals: { green: 6 }, board: [P('goblin-scrapper', 7, 1)] });
    s = act(s, { type: 'upgrade', creatureUid: creatureAt(s, 7, 1).uid, upgrade: 'sharpened-weapons' });
    expect(creatureAt(s, 7, 1).attack).toBe(3);
    expect(s.players.player.crystals.green).toBe(0);
  });
});

describe('Instants and counterspells', () => {
  it('Fizzle cancels Fireball, crystals still spent', () => {
    let s = mk({ playerHand: ['fireball'], playerCrystals: { green: 5 }, opponentHand: ['fizzle'], opponentCrystals: { blue: 4 } });
    s = act(s, { type: 'cast', uid: uidOf(s, 'player', 'fireball'), target: { commander: 'opponent' } });
    expect(s.pendingResponse.responder).toBe('opponent');
    s = act(s, { type: 'respond', uid: uidOf(s, 'opponent', 'fizzle') });
    expect(s.players.opponent.health).toBe(20);
    expect(s.players.player.crystals.green).toBe(0);
    expect(s.pendingResponse).toBeNull();
  });
  it('Hold It! returns a summoned creature to hand', () => {
    let s = mk({ playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 }, opponentHand: ['hold-it'], opponentCrystals: { blue: 5 } });
    s = act(s, { type: 'summon', uid: uidOf(s, 'player', 'goblin-scrounger'), row: 7, col: 1 });
    s = act(s, { type: 'respond', uid: uidOf(s, 'opponent', 'hold-it') });
    expect(s.board.creatures.length).toBe(0);
    expect(s.players.player.hand.map((h: any) => h.cardId)).toEqual(['goblin-scrounger']);
    expect(s.players.player.crystals.green).toBe(0);
  });
});

describe('deck-out, winning, tutorial', () => {
  it('deck-out costs 1 Health each time', () => {
    let s = mk({ playerDeck: [] });
    s = done(s, 4);
    expect(s.players.player.health).toBe(19);
    s = done(s, 4);
    expect(s.players.player.health).toBe(18);
  });
  it('Commander at 0 retreats and the other side wins', () => {
    let s = done(mk({ opponentHealth: 2, board: [P('goblin-scrapper', 2, 3)] }));
    s = attack(s, 2, 3, { commander: 'opponent' });
    expect(s.winner).toBe('player');
    expect(s.phase).toBe('over');
  });
  it('surrender loses; illegal actions are rejected without changing state', () => {
    const s = mk({});
    const bad = applyAction(s, { type: 'summon', uid: 'nope', row: 1, col: 1 });
    expect(bad.ok).toBe(false);
    expect(bad.state).toBe(s);
    const r = applyAction(s, { type: 'surrender' });
    expect(r.state.winner).toBe('opponent');
  });
  it('tutorial starts at summon, back row only, advances to move', () => {
    const t: any = tutorialJson;
    let s = createMatch({ ...t, tutorial: true });
    expect(s.tutorial.step).toBe('summon');
    expect(s.players.player.crystals.green).toBe(1);
    const sums = legalActions(s).filter((a) => a.type === 'summon');
    expect(sums.length).toBeGreaterThan(0);
    expect(sums.every((a) => a.row === 7)).toBe(true);
    s = act(s, sums[0]);
    expect(s.tutorial.step).toBe('move');
  });
});
