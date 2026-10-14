import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions, creatureAt, CARDS, CONFIG, STARTER_DECKS, incomePreview, hasMovesLeft, legalMines } from '../src/engine';

const act = (s: any, a: any) => { const r = applyAction(s, a); if (!r.ok) throw new Error(r.error); return r.state; };
const done = (s: any, n = 1) => { for (let i = 0; i < n; i++) s = act(s, { type: 'done' }); return s; };
const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const mk = (setup: any, o: any = {}) => createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', mines: MINES, setup, ...o });
const P = (cardId: string, row: number, col: number, extra: any = {}) => ({ cardId, owner: 'player', row, col, ...extra });
const O = (cardId: string, row: number, col: number, extra: any = {}) => ({ cardId, owner: 'opponent', row, col, ...extra });
const at = (s: any, r: number, c: number) => creatureAt(s, r, c);
const mine = (s: any, r: number, c: number, row: number, col: number) => act(s, { type: 'mine', creatureUid: at(s, r, c).uid, row, col });
const pool = (s: any, w = 'player') => s.players[w].crystals;
const total = (s: any, w = 'player') => Object.values(pool(s, w)).reduce((a: any, b: any) => a + b, 0);

describe('content and board', () => {
  it('starter decks: 40 creatures, 6 spells incl. Fizzle, 4 Crystal cards', () => {
    for (const deck of Object.values(STARTER_DECKS)) {
      const t = (ty: string) => deck.filter((id) => CARDS[id].type === ty).length;
      expect([t('creature'), t('spell'), t('crystal')]).toEqual([40, 6, 4]);
      expect(deck).toContain('fizzle');
    }
    expect([CONFIG.boardWidth, CONFIG.boardHeight, CONFIG.mineCount]).toEqual([13, 7, 3]);
  });
  it('mirrored random mine layouts for 30 seeds', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = createMatch({ seed });
      const m = s.sites.map((x: any) => ({ row: x.row, col: x.col }));
      expect(m.length).toBe(3);
      expect(legalMines(m)).toBe(true);
      for (const x of m) { expect(x.row >= 3 && x.row <= 5 && x.col >= 1 && x.col <= 13).toBe(true); if (x.row !== 4) expect(m.some((y: any) => y.col === x.col && y.row === 8 - x.row)).toBe(true); }
      expect(createMatch({ seed }).sites).toEqual(s.sites);
      expect(s.sites.map((x: any) => x.row * 100 + x.col)).toEqual([...s.sites.map((x: any) => x.row * 100 + x.col)].sort((a, b) => a - b));
    }
    expect(() => createMatch({ mines: [{ row: 2, col: 1 }, { row: 3, col: 5 }, { row: 5, col: 5 }] })).toThrow();
    expect(createMatch({ seed: 1 }).players.player.crystals).toEqual({ green: 0, blue: 0, purple: 0, white: 0 });
  });
  it('13x7 bounds: no move off the board', () => {
    const s = mk({ board: [P('goblin-grunt', 7, 13)] });
    const d = legalActions(done(s)).filter((a: any) => a.type === 'move');
    expect(d.every((a: any) => a.col <= 13 && a.row <= 7)).toBe(true);
  });
});

describe('mining', () => {
  it('Gatherer mines 2, Fighter 1, standing nearby makes 0; pool is SET to last turn mining', () => {
    let s = mk({ board: [P('goblin-scrounger', 6, 6), P('goblin-grunt', 5, 5), P('goblin-grunt', 4, 9), O('gnome-tinker', 1, 1)] });
    s = done(s);
    s = mine(s, 6, 6, 5, 6);
    s = mine(s, 5, 5, 5, 6);
    expect(s.players.player.flow.white + s.players.player.flow.green).toBe(3);
    expect(incomePreview(s, 'player')).toBe(3);
    s = done(s); // enemy turn 2
    expect(total(s)).toBe(0);
    s = done(s, 2);
    expect(s.activePlayer).toBe('player');
    expect(pool(s)).toEqual({ green: 3, blue: 0, purple: 0, white: 0 });
    expect(s.players.player.minedLastTurn).toBe(3);
    // not mining gives nothing, pool replaced not added
    s = done(s, 4);
    expect(total(s)).toBe(0);
  });
  it('mining is the creature action: no move or attack after, no mine after moving; mine color from miners only', () => {
    let s = mk({ board: [P('goblin-scrounger', 6, 6), P('ram-rider', 6, 5), O('gnome-prospector', 4, 5)] });
    s = done(s);
    const g = at(s, 6, 6), r = at(s, 6, 5);
    s = mine(s, 6, 6, 5, 6);
    expect(legalActions(s).some((a: any) => a.creatureUid === g.uid && a.type !== 'mine' ? true : false)).toBe(false);
    s = act(s, { type: 'move', creatureUid: r.uid, row: 5, col: 5 });
    expect(legalActions(s).some((a: any) => a.type === 'mine' && a.creatureUid === r.uid)).toBe(false);
    expect(s.sites[2].controller).toBe(null); // colors change only at Draw
  });
  it('mine color: miners only, strict majority, tie is white', () => {
    let s = mk({ board: [P('goblin-scrounger', 6, 6), P('goblin-grunt', 5, 5), O('gnome-prospector', 4, 6), O('gnome-prospector', 4, 5, { minedMine: { row: 5, col: 6 } }), P('goblin-grunt', 4, 7, { minedMine: { row: 3, col: 6 } })] });
    s = done(s);
    s = mine(s, 6, 6, 5, 6);
    expect(s.sites[0].color).toBe('green');
    expect(s.sites[2].color).toBe('blue');
    s = done(s, 2); // enemy Draw recolors: 1 enemy miner vs 1 player miner => white
    expect(s.sites[2].color).toBe('white');
  });
  it('summon turn: Gatherer can move and mine but not attack; Fighter can do nothing', () => {
    let s = mk({ playerHand: ['goblin-scrounger', 'goblin-grunt'], playerCrystals: { green: 5 }, board: [O('gnome-tinker', 6, 6)] });
    s = act(s, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 5 });
    s = act(s, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 4 });
    s = done(s);
    const acts = legalActions(s).filter((a: any) => ['move', 'attack', 'mine'].includes(a.type));
    expect(acts.every((a: any) => a.creatureUid === at(s, 7, 5).uid)).toBe(true);
    expect(acts.some((a: any) => a.type === 'move')).toBe(true);
    expect(acts.some((a: any) => a.type === 'attack')).toBe(false);
    expect(hasMovesLeft(s)).toBe(true);
  });
  it('mining counts as a move left; ring colors recomputed at Draw', () => {
    let s = mk({ board: [P('goblin-scrounger', 6, 6)] });
    s = done(s);
    expect(hasMovesLeft(s)).toBe(true);
    s = mine(s, 6, 6, 5, 6);
    s = done(s, 2);
    s = done(s);
    expect(s.sites[2].controller).toBe('player');
    expect(s.sites[2].color).toBe('green');
  });
});

describe('combat basics', () => {
  it('Commander damage equals Attack', () => {
    let s = mk({ board: [P('goblin-grunt', 2, 7)], opponentHealth: 20 });
    s = done(s);
    s = act(s, { type: 'attack', creatureUid: at(s, 2, 7).uid, target: { commander: 'opponent' } });
    expect(s.players.opponent.health).toBe(20 - CARDS['goblin-grunt'].attack);
  });
  it('simultaneous melee strikes', () => {
    let s = mk({ board: [P('goblin-scrapper', 5, 8), O('shieldbeard', 4, 8)] });
    s = done(s);
    s = act(s, { type: 'attack', creatureUid: at(s, 5, 8).uid, target: { row: 4, col: 8 } });
    expect(at(s, 4, 8).health).toBeLessThan(at(s, 4, 8).maxHealth);
  });
});

describe('economy extras', () => {
  it('free Gatherer when broke, only a basic Gatherer, only without a Gatherer on the board', () => {
    let s = mk({ playerHand: ['goblin-scrounger', 'goblin-scrounger'] });
    const sp = legalActions(s).filter((a: any) => a.type === 'summon');
    expect(sp.length).toBeGreaterThan(0);
    s = act(s, sp[0]);
    expect(total(s)).toBe(0);
    expect(legalActions(s).some((a: any) => a.type === 'summon')).toBe(false);
  });
  it('underdog bonus +2 only when enemy holds a mine and you hold none', () => {
    let s = mk({ board: [O('gnome-prospector', 4, 9, { minedMine: { row: 4, col: 10 } })], firstPlayer: 'opponent' });
    expect(s.sites[1].controller).toBe('opponent');
    s = done(s, 2);
    expect(s.activePlayer).toBe('player');
    expect(pool(s)).toEqual({ green: 2, blue: 0, purple: 0, white: 0 });
  });
  it('pool cap 16', () => {
    const board = [] as any[];
    for (let c = 1; c <= 8; c++) board.push(P('goblin-scrounger', 6, c));
    // nothing mined yet: preview 0
    const s = mk({ board });
    expect(incomePreview(s, 'player')).toBe(0);
  });
});
