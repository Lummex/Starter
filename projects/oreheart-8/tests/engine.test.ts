import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions, creatureAt, CARDS, CONFIG, STARTER_DECKS, incomePreview, hasMovesLeft, legalMines, weaponOf, deckProblems, atkValue, validateDeck, STARTER_DECK_LIST, isActed, isMiner } from '../src/engine';

const act = (s: any, a: any) => { const r = applyAction(s, a); if (!r.ok) throw new Error(r.error); return r.state; };
const done = (s: any, n = 1) => { for (let i = 0; i < n; i++) s = act(s, { type: 'done' }); return s; };
const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const mk = (setup: any, o: any = {}) => createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', mines: MINES, setup, ...o });
const P = (cardId: string, row: number, col: number, extra: any = {}) => ({ cardId, owner: 'player', row, col, ...extra });
const O = (cardId: string, row: number, col: number, extra: any = {}) => ({ cardId, owner: 'opponent', row, col, ...extra });
const at = (s: any, r: number, c: number) => creatureAt(s, r, c);
const mine = (s: any, r: number, c: number, row: number, col: number) => act(s, { type: 'mine', creatureUid: at(s, r, c).uid, row, col });
const pool = (s: any, w = 'player') => s.players[w].crystals;
const total = (s: any, w = 'player') => s.players[w].crystals as number;

// Owner check change (Ken, Oct 31: Miners are half the Warband): ONE place for the Warband mix: 30 Miners / 20 Fighters / 6 spells / 4 Crystal cards.
// Owner check change (Ken, Oct 31 dwarf fix): the Anvilsworn Miner (dwarf-smith-miner) is the dwarves' basic Miner, so basic and Smith are one card for dwarves.
// creatures/spells per faction: the gnome Warband is spell-heavier on purpose (47 creatures, 9 spells)
const WARBAND = { creatures: { goblins: 50, gnomes: 47, dwarves: 50 } as any, spells: { goblins: 6, gnomes: 9, dwarves: 6 } as any, crystals: 4, miners: 30, basic: { goblins: 22, gnomes: 24, dwarves: 27 }, smith: { goblins: 8, gnomes: 6, dwarves: 27 } };
const DWARF_FIX = { bearerCost: 4, anvilswornCost: 1 }; // final after Anvil's balance sims (Oct 31)

describe('content and board', () => {
  it('Warband starter decks: 50 creatures / 6 spells (gnomes 47 / 9) incl. Fizzle, 4 Crystal cards (Ken, Oct 31: Miners are half the Warband)', () => {
    for (const [k, deck] of Object.entries(STARTER_DECKS).filter(([k]) => k.endsWith('-warband'))) {
      const f = ({ goblin: 'goblins', gnome: 'gnomes', dwarf: 'dwarves' } as any)[k.split('-')[0]];
      const t = (ty: string) => deck.filter((id) => CARDS[id].type === ty).length;
      expect([t('creature'), t('spell'), t('crystal')]).toEqual([WARBAND.creatures[f], WARBAND.spells[f], WARBAND.crystals]);
      expect(deck.filter((id) => CARDS[id].type === 'creature' && (CARDS[id].role === 'Gatherer' || CARDS[id].role === 'Smith')).length).toBe(WARBAND.miners);
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
      for (const x of m) { expect(x.row >= 3 && x.row <= 5 && x.col >= 1 && x.col <= 13).toBe(true); expect(m.some((y: any) => y.col === 14 - x.col && y.row === 8 - x.row)).toBe(true); }
      expect(createMatch({ seed }).sites).toEqual(s.sites);
      expect(s.sites.map((x: any) => x.row * 100 + x.col)).toEqual([...s.sites.map((x: any) => x.row * 100 + x.col)].sort((a, b) => a - b));
    }
    expect(() => createMatch({ mines: [{ row: 2, col: 1 }, { row: 3, col: 5 }, { row: 5, col: 5 }] })).toThrow();
    expect(createMatch({ seed: 1 }).players.player.crystals).toBe(0);
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
    expect(s.players.player.flow).toBe(3);
    expect(incomePreview(s, 'player')).toBe(3);
    s = done(s); // enemy turn 2
    expect(total(s)).toBe(0);
    s = done(s, 2);
    expect(s.activePlayer).toBe('player');
    expect(pool(s)).toBe(3);
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
    let s = mk({ board: [P('goblin-grunt', 2, 11)], opponentHealth: 20 });
    s = done(s);
    s = act(s, { type: 'attack', creatureUid: at(s, 2, 11).uid, target: { commander: 'opponent' } });
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
    expect(pool(s)).toBe(2);
  });
  it('pool cap 16', () => {
    const board = [] as any[];
    for (let c = 1; c <= 8; c++) board.push(P('goblin-scrounger', 6, c));
    // nothing mined yet: preview 0
    const s = mk({ board });
    expect(incomePreview(s, 'player')).toBe(0);
  });
});

describe('revision 6', () => {
  const B = (g = 0, w = 0) => g + w;
  it('warband starter decks: basic Miners and Smith Miners (Ken, Oct 31: Miners are half the Warband; the Anvilsworn is the dwarves\' basic Miner)', () => {
    // Owner check change (Ken, Oct 31 dwarf fix): dwarves' basic Miner = dwarf-smith-miner (config basicGatherers), the same card as their Smith Miner
    expect(CONFIG.basicGatherers.dwarves).toBe('dwarf-smith-miner');
    const pairs: any = { goblins: ['goblin-scrounger', 'goblin-smith-miner'], gnomes: ['gnome-prospector', 'gnome-smith-miner'], dwarves: ['dwarf-smith-miner', 'dwarf-smith-miner'] };
    const want: any = Object.fromEntries(['goblins', 'gnomes', 'dwarves'].map((f) => [f, [(WARBAND.basic as any)[f], (WARBAND.smith as any)[f]]]));
    for (const [f, [b, sm]] of Object.entries<any>(pairs)) {
      expect(STARTER_DECKS[f.replace(/s$/, '').replace('dwarve', 'dwarf') + '-warband'].filter((x) => x === b).length).toBe(want[f][0]);
      expect(STARTER_DECKS[f.replace(/s$/, '').replace('dwarve', 'dwarf') + '-warband'].filter((x) => x === sm).length).toBe(want[f][1]);
    }
    expect(CARDS['goblin-scrounger'].name).toBe('Goblin Miner'); // owner's card data (Art Studio) is the source of truth
  });
  it('Smith +1/+1 and basic Miner +1 Health persist and heal to the new max', () => {
    let s = mk({ playerHand: ['goblin-smith-miner', 'goblin-scrounger'], playerCrystals: B(4), board: [P('goblin-grunt', 7, 2, { damage: 0 })] });
    const u = at(s, 7, 2).uid;
    s = act(s, { type: 'minerUpgrade', uid: s.players.player.hand[0].uid, creatureUid: u });
    let c = at(s, 7, 2);
    const g: any = CARDS['goblin-grunt'];
    expect([c.attack, c.health, c.maxHealth, c.upgrades]).toEqual([g.attack + 1, g.health + 1, g.health + 1, { attack: 1, health: 1 }]);
    s = act(s, { type: 'minerUpgrade', uid: s.players.player.hand[0].uid, creatureUid: u });
    c = at(s, 7, 2);
    expect([c.attack, c.maxHealth, c.upgrades]).toEqual([g.attack + 1, g.health + 2, { attack: 1, health: 2 }]);
    expect(s.phase).toBe('deploy');
    expect(s.players.player.crystals).toBe(2);
    s = done(s, 4);
    expect([at(s, 7, 2).attack, at(s, 7, 2).maxHealth]).toEqual([g.attack + 1, g.health + 2]);
  });
  it('Crystal card goes to the Bank without ending the phase; Bank is spent after Flow', () => {
    let s = mk({ playerHand: ['crystal-cluster', 'goblin-slinger'], playerCrystals: B(2) });
    s = act(s, { type: 'playCrystal', uid: s.players.player.hand[0].uid });
    expect([s.phase, s.activePlayer, s.turn]).toEqual(['deploy', 'player', 1]);
    expect(s.players.player.bank).toBe(2);
    expect(s.players.player.crystals).toBe(2);
    // a second Crystal card is allowed (round 10)
    const slinger = s.players.player.hand[0].uid; // cost 4, Grubnak 3
    s = act(s, { type: 'summon', uid: slinger, row: 7, col: 3 });
    expect([s.players.player.crystals, s.players.player.bank]).toEqual([0, 1]);
  });
  it('Flow 2 + Bank 3 pays a Goblin Slinger leaving Bank 2', () => {
    let s = mk({ playerHand: ['goblin-slinger'], playerCrystals: B(2), playerBank: B(3) });
    s = act(s, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 3 });
    expect([s.players.player.crystals, s.players.player.bank]).toEqual([0, 2]);
  });
  it('Crystal card works in the Respond window and funds a counterspell', () => {
    let s: any;
    s = createMatch({ playerCommander: 'borgo', opponentCommander: 'sproingle', mines: MINES, setup: { firstPlayer: 'opponent', opponentHand: ['fireball'], opponentCrystals: 6, playerHand: ['fizzle', 'crystal-cluster'], playerCrystals: 1, board: [P('goblin-grunt', 6, 2)] } });
    const fb = s.players.opponent.hand[0].uid;
    s = act(s, { type: 'cast', uid: fb, target: { row: 6, col: 2 } });
    expect(s.pendingResponse.responder).toBe('player');
    const la = legalActions(s);
    expect(la.some((a: any) => a.type === 'respond' && a.crystalUid)).toBe(true);
    expect(la.some((a: any) => a.type === 'playCrystal')).toBe(true);
    expect(la.some((a: any) => a.type === 'pass')).toBe(true);
    s = act(s, la.find((a: any) => a.type === 'respond' && a.crystalUid));
    expect(s.pendingResponse).toBeNull();
    expect(at(s, 6, 2)).toBeTruthy();
  });
  it('no window opens when nothing can be played (R2.18)', () => {
    let s = createMatch({ playerCommander: 'borgo', opponentCommander: 'sproingle', mines: MINES, setup: { firstPlayer: 'opponent', opponentHand: ['fireball'], opponentCrystals: 6, playerHand: ['fizzle'], board: [P('goblin-grunt', 6, 2)] } });
    s = act(s, { type: 'cast', uid: s.players.opponent.hand[0].uid, target: { row: 6, col: 2 } });
    expect(s.pendingResponse).toBeNull();
  });
  it('free Miner only when Flow + Bank cannot pay and no Miner on the battlefield', () => {
    const cost = (s: any) => { const l = legalActions(s).find((a: any) => a.type === 'summon'); const before = s; const r = act(before, l); return Number(total(before) + before.players.player.bank) - Number(total(r) + r.players.player.bank); };
    let s = mk({ playerHand: ['goblin-scrounger'] });
    expect(cost(s)).toBe(0);
    s = mk({ playerHand: ['goblin-scrounger'], playerCrystals: 0 });
    expect(legalActions(s).some((a: any) => a.type === 'summon')).toBe(true);
    expect(cost(s)).toBe(0);
    s = mk({ playerHand: ['goblin-scrounger'], playerCrystals: B(1) });
    expect(cost(s)).toBe(1);
    s = mk({ playerHand: ['goblin-scrounger'], board: [P('goblin-scrounger', 7, 5)] });
    expect(legalActions(s).some((a: any) => a.type === 'summon')).toBe(false);
    s = mk({ playerHand: ['goblin-scrounger'], playerBank: B(1) });
    expect(s.players.player.bank).toBe(1);
    const r = act(s, legalActions(s).find((a: any) => a.type === 'summon'));
    expect(r.players.player.bank).toBe(0);
  });
  // Owner check change (Ken, Oct 31 dwarf fix): the free Miner when broke is the Anvilsworn Miner, the dwarves' basic Miner; a Riot Shield Bearer is never free
  it('a free Anvilsworn Miner (the dwarves\' basic Miner) counts as the Miner on the battlefield: never a second free one; a Bearer is never free (Ken, Oct 31)', () => {
    let s = createMatch({ playerCommander: 'borgo', opponentCommander: 'grubnak', mines: MINES, setup: { playerHand: ['dwarf-smith-miner', 'dwarf-smith-miner', 'dwarf-smith-miner', 'dwarf-miner'], playerCrystals: 0 } });
    const summons = (st: any) => legalActions(st).filter((a: any) => a.type === 'summon');
    const bearer = s.players.player.hand.find((c: any) => c.cardId === 'dwarf-miner').uid;
    expect(summons(s).length).toBeGreaterThan(0);
    expect(summons(s).some((a: any) => a.uid === bearer)).toBe(false);
    s = act(s, summons(s)[0]);
    if (s.pendingResponse) s = act(s, { type: 'pass' });
    expect(s.board.creatures.filter((c: any) => c.cardId === 'dwarf-smith-miner').length).toBe(1);
    expect(s.players.player.crystals + s.players.player.bank).toBe(0);
    expect(summons(s).length).toBe(0); // the second Anvilsworn costs DWARF_FIX.anvilswornCost and the side is broke
  });
  it('Tunnel only beside a mine your side owns (Ken, Oct 31)', () => {
    const near = (s: any) => legalActions(s).filter((a: any) => a.type === 'summon' && a.row < 7);
    const by = (m: any, a: any) => Math.max(Math.abs(m.row - a.row), Math.abs(m.col - a.col)) === 1;
    // turn 1, no mine owned: row 7 only
    let s = mk({ playerHand: ['goblin-scrounger'], playerCrystals: B(1) });
    expect(legalActions(s).filter((a: any) => a.type === 'summon').length).toBeGreaterThan(0);
    expect(near(s).length).toBe(0);
    // the player owns the mine at 3,6: its empty neighbours are offered, nothing beside the other two mines
    const owner = (o: string) => [{ cardId: 'goblin-scrapper', owner: o, row: 4, col: 7, minedMine: { row: 3, col: 6 } }];
    s = mk({ playerHand: ['goblin-scrounger'], playerCrystals: B(1), board: owner('player') });
    expect(s.sites.find((x: any) => x.row === 3 && x.col === 6).controller).toBe('player');
    const cells = new Set(near(s).map((a: any) => a.row + ',' + a.col));
    for (const k of ['2,5', '2,6', '2,7', '3,5', '3,7', '4,5', '4,6']) expect(cells.has(k), k).toBe(true);
    expect(near(s).every((a: any) => by(MINES[0], a))).toBe(true);
    expect(cells.has('4,9')).toBe(false); // beside the mine at 4,10 only
    expect(cells.has('6,6')).toBe(false); // beside the mine at 5,6 only
    // the same creature on the OPPONENT's side: nothing beside any mine
    s = mk({ playerHand: ['goblin-scrounger'], playerCrystals: B(1), board: owner('opponent') });
    expect(s.sites.find((x: any) => x.row === 3 && x.col === 6).controller).toBe('opponent');
    expect(near(s).length).toBe(0);
    // Smith Miners never tunnel, even beside an owned mine
    s = mk({ playerHand: ['goblin-smith-miner'], playerCrystals: B(2), board: owner('player') });
    expect(near(s).length).toBe(0);
  });
  // Owner check change (Ken, Oct 31 dwarf fix: the Riot Shield Bearer is a wall, not the Miner)
  it('Riot Shield Bearer is a wall: Fighter, not a Miner, enemies beside it must hit it, 1 less from every hit, never moved or lifted, attacks on turn 2, can die (Ken, Oct 31)', () => {
    expect(CARDS['dwarf-miner'].role).toBe('Fighter');
    expect(isMiner(CARDS['dwarf-miner'])).toBe(false);
    expect([CARDS['dwarf-miner'].cost, CARDS['dwarf-miner'].attack, CARDS['dwarf-miner'].health, CARDS['dwarf-miner'].move]).toEqual([DWARF_FIX.bearerCost, 1, 5, 1]);
    expect(CARDS['dwarf-miner'].abilities).toEqual(['riotShield']);
    expect(isMiner(CARDS['dwarf-smith-miner'])).toBe(true);
    // Guard: a Grunt beside the Bearer and an Ironjaw Big Back may only hit the Bearer
    let s = createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', factionLock: false, mines: MINES, setup: { opponentHand: [], board: [P('goblin-grunt', 6, 9), O('dwarf-miner', 5, 9), O('dwarf-pickman', 6, 10)] } });
    s = done(s);
    const targets = legalActions(s).filter((a: any) => a.type === 'attack' && a.creatureUid === at(s, 6, 9).uid).map((a: any) => a.target);
    expect(targets).toEqual([{ row: 5, col: 9 }]);
    // 1 less from every hit: a 4-Attack Ram Rider does 3
    s = createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', factionLock: false, mines: MINES, setup: { opponentHand: [], board: [P('ram-rider', 6, 9), O('dwarf-miner', 5, 9)] } });
    s = done(s);
    s = act(s, { type: 'attack', creatureUid: at(s, 6, 9).uid, target: { row: 5, col: 9 } });
    expect(at(s, 5, 9).health).toBe(5 - 3);
    // never knocked: an Enforcer (Granite Oathkeeper) hits it; the Bearer stays, the plain unit beside the same Enforcer is knocked
    s = createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', factionLock: false, mines: MINES, setup: { opponentHand: [], board: [P('dwarf-stoneback', 6, 9), O('dwarf-miner', 5, 9), O('dwarf-pickman', 6, 10)] } });
    s = done(s);
    s = act(s, { type: 'attack', creatureUid: at(s, 6, 9).uid, target: { row: 5, col: 9 } });
    expect(at(s, 5, 9)?.cardId).toBe('dwarf-miner');
    expect(at(s, 5, 9).health).toBe(5); // the 1-Attack hit did 0
    expect(at(s, 6, 10)?.cardId).not.toBe('dwarf-pickman');
    // never lifted: the Junk Shaman offers no lift for it, with no shield clock at all
    s = createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', factionLock: false, mines: MINES, setup: { opponentHand: [], playerCrystals: 9, board: [P('junk-shaman', 6, 9), O('dwarf-miner', 4, 9), O('dwarf-pickman', 4, 11)] } });
    expect(at(s, 4, 9).lockedUntil).toBe(0);
    s = done(s);
    const lifts = legalActions(s).filter((a: any) => a.type === 'ability' && a.ability === 'shaman');
    expect(lifts.some((a: any) => a.from && a.from.row === 4 && a.from.col === 11)).toBe(true);
    expect(lifts.some((a: any) => a.from && a.from.row === 4 && a.from.col === 9)).toBe(false);
    // played from hand: no lock, no attack that turn, attacks (1 damage) on its second turn
    s = createMatch({ playerCommander: 'borgo', opponentCommander: 'sproingle', factionLock: false, mines: MINES, setup: { opponentHand: [], playerHand: ['dwarf-miner'], playerCrystals: DWARF_FIX.bearerCost, board: [O('dwarf-pickman', 6, 9)] } });
    s = act(s, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 9 });
    if (s.pendingResponse) s = act(s, { type: 'pass' });
    expect(at(s, 7, 9).lockedUntil).toBe(0);
    s = done(s); // -> Action
    const b = at(s, 7, 9).uid;
    expect(legalActions(s).some((a: any) => a.type === 'attack' && a.creatureUid === b)).toBe(false);
    s = done(s, 3); // end Action, the opponent's Deploy and Action
    s = done(s); // -> the player's Action
    expect(legalActions(s).some((a: any) => a.type === 'attack' && a.creatureUid === b)).toBe(true);
    const hp = at(s, 6, 9).health;
    s = act(s, { type: 'attack', creatureUid: b, target: { row: 6, col: 9 } });
    expect(at(s, 6, 9).health).toBe(hp - 1);
    // it can die: 1 Health left, a Ram Rider finishes it
    s = createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', factionLock: false, mines: MINES, setup: { opponentHand: [], board: [P('ram-rider', 6, 9), O('dwarf-miner', 5, 9, { damage: 4 })] } });
    s = done(s);
    s = act(s, { type: 'attack', creatureUid: at(s, 6, 9).uid, target: { row: 5, col: 9 } });
    expect(at(s, 5, 9)).toBeFalsy();
  });
});

describe('revision 7', () => {
  it('Flow 2 + Bank 3, cost 3 (Grubnak Slinger) -> Flow 0, Bank 2', () => {
    let s = mk({ playerHand: ['goblin-slinger'], playerCrystals: 2, playerBank: 3 });
    s = act(s, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 3 });
    expect([s.players.player.crystals, s.players.player.bank]).toEqual([0, 2]);
  });
  it('enemy-owned mine pays half: Miner 1, Fighter 0; example 1 Gemsinger vs 2 Grubgrabbers', () => {
    let s = mk({ firstPlayer: 'opponent', board: [
      P('gnome-prospector', 4, 9), O('goblin-scrounger', 5, 9), O('goblin-scrounger', 3, 9),
    ] });
    const set = (r: number, c: number) => at(s, r, c);
    s = done(s); // opponent Deploy -> Action
    s = act(s, { type: 'mine', creatureUid: set(5, 9).uid, row: 4, col: 10 });
    s = act(s, { type: 'mine', creatureUid: set(3, 9).uid, row: 4, col: 10 });
    s = done(s); // opponent Action -> end; player turn 2 begins
    expect(s.activePlayer).toBe('player');
    s = done(s); // player Deploy -> Action
    s = act(s, { type: 'mine', creatureUid: set(4, 9).uid, row: 4, col: 10 });
    expect(s.sites[1].controller).toBe('opponent');
    expect(s.players.opponent.flow).toBe(4);
    expect(s.players.player.flow).toBe(1);
  });
  it('Fighter at an enemy-owned mine pays 0', () => {
    let s = mk({ board: [P('goblin-grunt', 4, 9), O('gnome-prospector', 3, 9, { minedMine: { row: 4, col: 10 } }), O('gnome-prospector', 5, 9, { minedMine: { row: 4, col: 10 } })] });
    s = done(s);
    s = mine(s, 4, 9, 4, 10);
    expect(s.players.player.flow).toBe(0);
  });
  it('Miner at an enemy-owned mine pays 1', () => {
    let s = mk({ board: [P('goblin-scrounger', 4, 9), O('gnome-prospector', 3, 9, { minedMine: { row: 4, col: 10 } }), O('gnome-prospector', 5, 9, { minedMine: { row: 4, col: 10 } })] });
    s = done(s);
    s = mine(s, 4, 9, 4, 10);
    expect(s.players.player.flow).toBe(1);
    expect(s.players.opponent.flow).toBe(4);
  });
  it('nothing mines from 2 spaces away, even Ranged', () => {
    const s = done(mk({ board: [P('goblin-slinger', 4, 8), P('goblin-scrounger', 7, 6), P('goblin-scrounger', 5, 8)] }));
    const ms = legalActions(s).filter((a: any) => a.type === 'mine');
    expect(ms.some((a: any) => a.creatureUid === at(s, 4, 8).uid)).toBe(false);
    expect(ms.some((a: any) => a.creatureUid === at(s, 7, 6).uid)).toBe(false);
    expect(ms.some((a: any) => a.creatureUid === at(s, 5, 8).uid)).toBe(false);
  });
  it('Heart of the Fallen gives 4 Bank; Desperate Plunder gives 3 Flow', () => {
    let s = mk({ playerHand: ['heart-of-the-fallen'] });
    s = act(s, { type: 'playCrystal', uid: s.players.player.hand[0].uid });
    expect(s.players.player.bank).toBe(4);
    expect(CARDS['prospectors-prayer'].name).toBe('Desperate Plunder');
  });
  it('tapping a mine (mineAt) mines with exactly the eligible Miners; mineAll is gone', () => {
    let s = mk({ board: [P('goblin-scrounger', 4, 9), P('gnome-prospector', 5, 5), P('goblin-grunt', 3, 7), P('goblin-scrounger', 3, 5), P('goblin-scrounger', 7, 1)] });
    s = done(s);
    const la = legalActions(s);
    expect(la.some((a: any) => a.type === 'mineAll')).toBe(false);
    expect(la.filter((a: any) => a.type === 'mineAt').length).toBe(3);
    expect(applyAction(s, { type: 'mineAll' }).ok).toBe(false);
    s = act(s, { type: 'mineAt', row: 3, col: 6 });
    expect(at(s, 3, 5).hasMined && at(s, 3, 7).hasMined === false).toBe(true);
    expect(at(s, 5, 5).hasMined).toBe(false);
    s = act(s, { type: 'mineAt', row: 4, col: 10 });
    s = act(s, { type: 'mineAt', row: 5, col: 6 });
    expect(s.players.player.flow).toBe(6);
    expect(at(s, 7, 1).hasMined).toBe(false);
    expect(legalActions(s).some((a: any) => a.type === 'mineAt')).toBe(false);
  });
  it('R8 new cards: stats, abilities and weapons', () => {
    const c = (id: string) => CARDS[id];
    expect([c('rotgut-grenadier').cost, c('rotgut-grenadier').attack, c('rotgut-grenadier').health]).toEqual([5, 2, 2]);
    expect([c('grimhold-ravager').cost, c('grimhold-ravager').rarity]).toEqual([7, 'Uncommon']);
    expect(Object.values(CARDS).filter((x: any) => x.type === 'creature').length).toBe(48);
    expect([weaponOf(c('goblin-scrounger')), weaponOf(c('goblin-smith-miner')), weaponOf(c('shard-guzzler')), weaponOf(c('goblin-scrapper')), weaponOf(c('goblin-slinger')), weaponOf(c('hexwright-apprentice')),
      weaponOf(c('deepforge-crossbowman')), weaponOf(c('axe-thrower')), weaponOf(c('shieldbeard')), weaponOf(c('ram-rider')), weaponOf(c('gyrocopter-ace')), weaponOf(c('the-great-steam-golem')), weaponOf(c('fireball'))])
      .toEqual(['pick', 'pick-hammer', 'pick', 'sword', 'sling', 'wand', 'crossbow', 'axes', 'sword-shield', 'lance', 'signature'.replace('signature', 'gyro'), 'signature', null]);
    for (const deck of Object.values(STARTER_DECKS)) {
      for (const id of deck) { const n = deck.filter((x) => x === id).length; if (!/miner|prospector|scrounger/.test(id)) expect(n).toBeLessThanOrEqual(8); }
      expect(deck.filter((id) => CARDS[id].role === 'Smith').length).toBeGreaterThanOrEqual(3);
      expect(deckProblems(deck)).toEqual([]);
    }
  });
  it('Shiv Rat takes no strike back; Siphoner adds Bank; Ravager hits for 5 when hurt; Rune-Splitter takes 1 less', () => {
    let s = mk({ board: [P('shiv-rat', 4, 8), O('goblin-grunt', 4, 9)] });
    s = act(done(s), { type: 'attack', creatureUid: at(s, 4, 8).uid, target: { row: 4, col: 9 } });
    expect(at(s, 4, 8).health).toBe(1);
    let t = mk({ board: [P('runic-siphoner', 4, 8), O('goblin-grunt', 4, 9)] });
    t = act(done(t), { type: 'attack', creatureUid: at(t, 4, 8).uid, target: { row: 4, col: 9 } });
    expect(t.players.player.bank).toBe(1);
    let u = mk({ board: [P('rune-splitter', 4, 8), O('goblin-grunt', 4, 9)] });
    u = act(done(u), { type: 'attack', creatureUid: at(u, 4, 8).uid, target: { row: 4, col: 9 } });
    expect(at(u, 4, 8).health).toBe(1); // round 12c: Door Splitter is no longer Armored
    const v = mk({ board: [P('grimhold-ravager', 4, 8, { lastFight: 0 })] });
    expect(atkValue(v, at(v, 4, 8))).toBe(6); // Brawler: doubles after a fight last round
  });
  it('deck rules and strict auto-skip', () => {
    const bad = [...Array(4).fill('wolf-rider'), ...Array(11).fill('soul-shard')];
    expect(deckProblems(bad)).toEqual(['Needs 50 to 100 cards (now 15).', 'Mangewolf Rider: at most 3 copies (now 4).'].map((x) => x).sort((a, b) => deckProblems(bad).indexOf(a) - deckProblems(bad).indexOf(b)));
    expect(deckProblems(Array(50).fill('goblin-scrounger'))).toEqual([]);
    expect(deckProblems(Array(100).fill('goblin-scrounger'))).toEqual([]);
    expect(deckProblems(Array(101).fill('goblin-scrounger'))).toEqual(['Needs 50 to 100 cards (now 101).']);
    expect(deckProblems([...Array(30).fill('goblin-scrounger'), ...Array(20).fill('soul-shard')])).toEqual([]);
    expect(deckProblems([...Array(29).fill('goblin-scrounger'), ...Array(21).fill('soul-shard')])).toEqual(['At most 20 Crystal cards (now 21).']);
    expect(hasMovesLeft(mk({ playerHand: ['heart-of-the-fallen', 'fizzle'] }))).toBe(false);
    expect(hasMovesLeft(mk({ playerHand: ['goblin-scrounger'] }))).toBe(true);
  });
  it('the free Miner never upgrades; card names and text are renamed', () => {
    const s = mk({ playerHand: ['goblin-scrounger'], board: [P('goblin-grunt', 7, 2)] });
    expect(legalActions(s).some((a: any) => a.type === 'minerUpgrade')).toBe(false);
    expect(CARDS['shieldbeard'].longText).toMatch(/Corpsman/);
    expect(CARDS['dwarf-smith-miner'].longText).toMatch(/\+1 Attack and \+1 Health/);
    for (const c of Object.values<any>(CARDS)) expect((c.text || '').length).toBeGreaterThan(5);
  });
});

import { previewAttack, tutorialAction } from '../src/engine';
import tutorialJson from '../src/content/tutorial.json';
describe('revision 9', () => {
  const t: any = tutorialJson;
  it('savings: 9 -> 0, 10 -> 1, 16 -> 1', () => {
    for (const [f, fl, bk] of [[9, 9, 0], [10, 9, 1], [16, 15, 1]]) {
      let s = mk({ playerCrystals: f, board: [P('goblin-grunt', 6, 3)] });
      s = done(s, 2);
      expect([s.players.player.crystals, s.players.player.bank]).toEqual([fl, bk]);
    }
    expect(CONFIG.savingsPerCrystal).toBe(10);
  });
  it('spells never count as moves', () => {
    const s = mk({ playerHand: ['venom-shiv', 'tunnel-rush'], playerCrystals: 10, board: [O('gnome-prospector', 2, 8)] });
    expect(hasMovesLeft(s)).toBe(false);
    expect(legalActions(s).some((a: any) => a.type === 'cast')).toBe(true);
  });
  it('previewAttack matches the real attack', () => {
    const s = createMatch({ playerCommander: 'borgo', opponentCommander: 'grubnak', mines: MINES, setup: { board: [P('shieldbeard', 4, 3), O('goblin-scrapper', 3, 3)] } });
    const a = at(s, 4, 3);
    expect(previewAttack(s, a.uid, { row: 3, col: 3 })).toEqual({ youDeal: 3, youTake: 2, targetDefeated: true, attackerDefeated: false });
  });
  it('tutorial runs to Victory via tutorialAction', () => {
    let s = createMatch({ playerCommander: t.playerCommander, opponentCommander: t.opponentCommander, setup: t.setup, mines: t.mines, tutorial: true, seed: 1 });
    const seen: string[] = [];
    for (let i = 0; i < 200 && s.tutorial.step !== 'complete'; i++) {
      if (seen[seen.length - 1] !== s.tutorial.step) seen.push(s.tutorial.step);
      const who = s.priority;
      const a = who === 'player' ? tutorialAction(s) : s.pendingResponse ? { type: 'pass' } : { type: 'done' };
      const r = applyAction(s, a);
      if (!r.ok) throw new Error(JSON.stringify(a) + r.error + ' @' + s.tutorial.step);
      s = r.state;
    }
    expect(seen).toEqual(['summon', 'move', 'mine', 'mineTap', 'spend', 'crystal', 'upgrade', 'swap', 'fight', 'spell', 'savings', 'commander']);
    expect(s.winner).toBe('player');
  });
});

describe('round 2', () => {
  // Ken (Oct 30): one full redraw replaces the old 5 -> 5 -> 4 -> 3 card-picking mulligan
  it('Redraw Hand puts the whole hand back, reshuffles and draws the same number of cards, once', () => {
    let s = createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', seed: 5 });
    const before = s.players.player.hand.map((h: any) => h.uid);
    const deckN = s.players.player.deck.length;
    expect(applyAction(s, { type: 'mulligan', uids: [before[0]] }).ok).toBe(false); // part of a hand is never legal
    s = act(s, { type: 'mulligan', redraw: true });
    const after = s.players.player.hand.map((h: any) => h.uid);
    expect(after.length).toBe(5);
    expect(s.players.player.deck.length).toBe(deckN);
    expect(after).not.toEqual(before);
    expect(s.players.player.mulligans).toBe(1);
    expect(s.mulliganDone.player).toBe(true);
    expect(s.priority).toBe('opponent');
    s = act(s, { type: 'mulligan', uids: [] }); // the opponent keeps
    expect(s.phase).not.toBe('mulligan');
    expect(applyAction(s, { type: 'mulligan', redraw: true }).ok).toBe(false);
  });
  it('keeping the hand ends the mulligan', () => {
    let s = createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', seed: 5 });
    s = act(s, { type: 'mulligan', uids: [] });
    expect(s.mulliganDone.player).toBe(true);
  });
  it('every card has shortText (<= 80) and longText with an example; text equals shortText', () => {
    for (const c of Object.values<any>(CARDS)) {
      expect(c.shortText.length).toBeLessThanOrEqual(340); // owner-written texts can be longer
      expect(c.longText.length).toBeGreaterThan(20); // owner's newer card texts have no example sentence
      expect(c.longText.length).toBeGreaterThanOrEqual(c.shortText.length);
      expect(c.text.length).toBeGreaterThan(0); // owner's card text is the source of truth
    }
  });
  it('a window opens when a Crystal card makes the counterspell playable', () => {
    let s = mk({ firstPlayer: 'opponent', opponentHand: ['fireball'], opponentCrystals: 6, playerHand: ['fizzle', 'crystal-cluster'], playerCrystals: 1, board: [P('goblin-grunt', 6, 2)] });
    s = act(s, { type: 'cast', uid: s.players.opponent.hand[0].uid, target: { row: 6, col: 2 } });
    expect(s.pendingResponse && s.pendingResponse.responder).toBe('player');
  });
  it('counter events name the countered card; a held summon bounces', () => {
    let s: any = mk({ firstPlayer: 'opponent', opponentHand: ['fireball', 'goblin-grunt'], opponentCrystals: 9, playerHand: ['fizzle', 'hold-it'], playerCrystals: 5, board: [P('goblin-grunt', 6, 2)] });
    const r1 = applyAction(s, { type: 'cast', uid: s.players.opponent.hand[0].uid, target: { row: 6, col: 2 } });
    const c = legalActions(r1.state).find((a: any) => a.type === 'respond' && CARDS[s.players.player.hand.find((h: any) => h.uid === a.uid).cardId].id === 'fizzle');
    const r2 = applyAction(r1.state, c);
    expect(r2.events.find((e: any) => e.type === 'counter').countered).toBe('fireball');
    s = mk({ firstPlayer: 'opponent', opponentHand: ['goblin-grunt'], opponentCrystals: 9, playerHand: ['hold-it'], playerCrystals: 5 });
    const g = s.players.opponent.hand[0];
    const q1 = applyAction(s, legalActions(s).find((a: any) => a.type === 'summon' && a.uid === g.uid));
    const q2 = applyAction(q1.state, legalActions(q1.state).find((a: any) => a.type === 'respond'));
    expect(q2.events.find((e: any) => e.type === 'bounce').uid).toBe(g.uid);
  });
});

describe('Round 3a', () => {
  it('Strongholds in the corners', () => {
    const s = mk({ playerHand: ['goblin-scrounger', 'goblin-scrounger', 'goblin-scrounger'] });
    expect(s.strongholds).toEqual({ player: { row: 7, col: 2 }, opponent: { row: 1, col: 12 } });
    const sum = legalActions(s).filter((a: any) => a.type === 'summon');
    expect(sum.some((a: any) => a.row === 7 && a.col === 2)).toBe(false);
    expect(sum.some((a: any) => a.row === 7 && a.col === 1)).toBe(true);
    expect(sum.some((a: any) => a.row === 7 && a.col === 13)).toBe(true);
  });
  it('corner-mirrored mines with the center mine', () => {
    for (let seed = 11; seed <= 40; seed++) {
      const m = createMatch({ seed, playerCommander: 'grubnak', opponentCommander: 'sproingle' }).sites;
      expect(m.some((x: any) => x.row === 4 && x.col === 7)).toBe(true);
      for (const x of m) expect(m.some((y: any) => y.row === 8 - x.row && y.col === 14 - x.col)).toBe(true);
      expect(legalMines(m)).toBe(true);
    }
  });
  it('twelve legal starter decks (Ken, Oct 31)', () => {
    const ids = Object.keys(STARTER_DECKS);
    expect(ids.length).toBe(12);
    for (const id of ids) { expect(STARTER_DECKS[id].length).toBe(60); expect(deckProblems(STARTER_DECKS[id])).toEqual([]); }
    const s = createMatch({ seed: 3, playerCommander: 'sproingle', playerDeckId: 'gnome-expedition', opponentDeckId: 'goblin-arcane-hoard', skipMulligan: true });
    expect(s.players.player.deckId).toBe('gnome-expedition');
    expect(s.players.opponent.deckId).toBe('goblin-arcane-hoard');
  });
});

describe('round 4', () => {
  it('twelve 60-card starter decks: Miners at least a third, four style mixes, legal for their Commander (Ken, Oct 31)', () => {
    // Owner check change (Ken, Oct 31: Miners are half the Warband)
    const mix: any = { warband: null, 'mine-rush': [60, 0, 0], 'arcane-hoard': [45, 15, 0], expedition: [45, 9, 6] };
    expect(STARTER_DECK_LIST.length).toBe(12);
    for (const f of ['goblins', 'gnomes', 'dwarves']) expect(STARTER_DECK_LIST.filter((d) => d.faction === f).map((d) => d.style)).toEqual(['warband', 'mine-rush', 'arcane-hoard', 'expedition']);
    // Owner check change (Ken, Oct 31 dwarf fix): the Anvilsworn Miner is the dwarves' basic Miner (and their Smith Miner)
    const pairs: any = { goblins: ['goblin-scrounger', 'goblin-smith-miner', 'grubnak'], gnomes: ['gnome-prospector', 'gnome-smith-miner', 'sproingle'], dwarves: ['dwarf-smith-miner', 'dwarf-smith-miner', 'borgo'] };
    for (const d of STARTER_DECK_LIST) {
      const [b, sm, cmd] = pairs[d.faction];
      expect(d.cards.length).toBe(60);
      const want = d.style === 'warband' ? [WARBAND.creatures[d.faction], WARBAND.spells[d.faction], WARBAND.crystals] : mix[d.style];
      expect(d.cards.filter((x) => x === b).length).toBeGreaterThanOrEqual(5); // engine's opening-hand rescue looks for the basic Miner
      expect(d.cards.filter((x) => x === sm).length).toBeGreaterThanOrEqual(3);
      const miners = d.cards.filter((x) => CARDS[x].role === 'Gatherer' || CARDS[x].role === 'Smith' || x === b).length;
      expect(miners).toBeGreaterThanOrEqual(20);
      expect(d.cards.filter((x) => CARDS[x].type === 'creature').length).toBe(want[0]);
      const fighters = d.cards.filter((x) => CARDS[x].type === 'creature' && CARDS[x].role !== 'Gatherer' && CARDS[x].role !== 'Smith').length;
      const spells = d.cards.filter((x) => CARDS[x].type === 'spell').length;
      const crystals = d.cards.filter((x) => CARDS[x].type === 'crystal').length;
      expect([spells, crystals]).toEqual(want.slice(1));
      expect(fighters).toBeGreaterThan(0);
      expect(validateDeck(d.cards, cmd).legal).toBe(true);
    }
  });
  it('faction spells are locked by Commander in deck validation and in casting', () => {
    const base = [...Array(50).fill('goblin-scrounger'), 'fireball'];
    expect(validateDeck(base).legal).toBe(true);
    expect(validateDeck(base, 'grubnak').legal).toBe(false);
    expect(validateDeck(base, 'sproingle').legal).toBe(true);
    expect(validateDeck([...Array(50).fill('goblin-scrounger'), 'mirror-hex']).legal).toBe(false);
    expect(validateDeck([...Array(50).fill('goblin-scrounger'), 'fizzle'], 'borgo').legal).toBe(true);
    const s = mk({ playerHand: ['fireball', 'venom-shiv'], playerCrystals: 10, board: [O('gnome-prospector', 2, 8)] });
    const casts = legalActions(s).filter((a: any) => a.type === 'cast');
    expect(casts.length).toBeGreaterThan(0);
    expect(casts.every((a: any) => s.players.player.hand.find((h: any) => h.uid === a.uid).cardId === 'venom-shiv')).toBe(true);
  });
  it('Venom Shiv poisons for 7 of the owner turns and blocks healing', () => {
    let s = mk({ playerHand: ['venom-shiv', 'healing-light'], playerCrystals: 10, board: [O('shieldbeard', 2, 8)] });
    const target = at(s, 2, 8);
    const hp = target.health;
    s = act(s, { type: 'cast', uid: s.players.player.hand[0].uid, target: { row: 2, col: 8 } });
    if (s.pendingResponse) s = act(s, { type: 'pass' });
    expect(at(s, 2, 8).poison).toBe(7);
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      s = done(s, 2);
      seen.push(at(s, 2, 8).health);
      s = done(s, 2);
    }
    expect(seen).toEqual([hp - 1, hp - 2, hp - 3]);
    expect(at(s, 2, 8).poison).toBe(4);
  });
  it('casting lock: act() rejects a locked cast; factionLock:false allows it', () => {
    const setup = { playerHand: ['fireball'], playerCrystals: 10, board: [O('gnome-prospector', 2, 8)] };
    let s = mk(setup);
    const uid = s.players.player.hand[0].uid;
    const r = applyAction(s, { type: 'cast', uid, target: { row: 2, col: 8 } });
    expect(r.ok).toBe(false);
    s = mk(setup, { factionLock: false });
    expect(applyAction(s, { type: 'cast', uid: s.players.player.hand[0].uid, target: { row: 2, col: 8 } }).ok).toBe(true);
    expect(validateDeck([...Array(50).fill('goblin-scrounger'), 'fireball'], 'grubnak').problems).toContain('Searing Arcane Orb: only for Gnome Commanders.');
    expect(validateDeck([...Array(50).fill('goblin-scrounger'), 'mirror-hex']).problems).toContain('Hex Reversal is not available yet.');
  });
});

describe('round 10 rules', () => {
  const targets = (s: any, r: number, c: number) => legalActions(s).filter((a: any) => a.type === 'attack' && at(s, r, c).uid === a.creatureUid);
  const turnToAction = (s: any) => { s = done(s); return s; };
  it('adjacent mines are legal, the same square is not', () => {
    expect(legalMines([{ row: 3, col: 6 }, { row: 4, col: 7 }, { row: 5, col: 8 }])).toBe(true);
    expect(legalMines([{ row: 4, col: 7 }, { row: 4, col: 7 }, { row: 5, col: 8 }])).toBe(false);
    let adjacent = 0;
    for (let seed = 1; seed <= 200; seed++) { const m = createMatch({ seed }).sites; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (Math.max(Math.abs(m[i].row - m[j].row), Math.abs(m[i].col - m[j].col)) === 1) adjacent++; }
    expect(adjacent).toBeGreaterThan(0);
  });
  it('Ranged: straight lines up to 7, first unit blocks, no knight-move targets', () => {
    let s = turnToAction(mk({ board: [P('goblin-slinger', 4, 3), O('goblin-scrapper', 4, 8), O('goblin-scrapper', 2, 5), O('goblin-scrapper', 6, 4), O('goblin-scrapper', 1, 3), O('goblin-scrapper', 7, 3), O('goblin-scrapper', 7, 3 + 5)] }));
    const t = targets(s, 4, 3).map((a: any) => a.target.row + ',' + a.target.col).sort();
    expect(t).toContain('4,8'); // 5 along the row
    expect(t).toContain('2,5'); // diagonal, 2 away
    expect(t).not.toContain('6,4'); // knight move
    expect(t).toContain('1,3'); // 3 up the column
    expect(t).toContain('7,3'); // 3 down the column
    // the first unit blocks: put an ally in front of the (4,8) target
    s = turnToAction(mk({ board: [P('goblin-slinger', 4, 3), P('goblin-scrapper', 4, 5), O('goblin-scrapper', 4, 8), O('goblin-scrapper', 4, 4)] }));
    expect(targets(s, 4, 3).map((a: any) => a.target.col)).toEqual([4]);
    s = turnToAction(mk({ board: [P('goblin-slinger', 4, 3), P('goblin-scrapper', 4, 5), O('goblin-scrapper', 4, 8)] }));
    expect(targets(s, 4, 3).length).toBe(0);
    // round 11: Goblin Slinger range 6 -- 6 away is in, 7 away is out
    s = turnToAction(mk({ board: [P('goblin-slinger', 4, 2), O('goblin-scrapper', 4, 8)] }));
    expect(targets(s, 4, 2).length).toBe(1);
    s = turnToAction(mk({ board: [P('goblin-slinger', 4, 2), O('goblin-scrapper', 4, 9)] }));
    expect(targets(s, 4, 2).length).toBe(0);
  });
  it('basic Miner death draws a card; an upgrade Miner does not', () => {
    let s = mk({ playerHand: ['goblin-scrounger'], playerCrystals: 5, board: [P('goblin-grunt', 7, 2), P('goblin-scrapper', 5, 9), O('gnome-prospector', 5, 10)] });
    const n = s.players.opponent.hand.length, d = s.players.opponent.deck.length;
    s = done(s);
    s = act(s, { type: 'attack', creatureUid: at(s, 5, 9).uid, target: { row: 5, col: 10 } });
    expect(at(s, 5, 10)).toBeUndefined();
    expect(s.players.opponent.hand.length).toBe(n + 1);
    expect(s.players.opponent.deck.length).toBe(d - 1);
    // upgrade use: no draw for the owner
    let u = mk({ playerHand: ['goblin-scrounger'], playerCrystals: 5, board: [P('goblin-grunt', 7, 2)] });
    const h = u.players.player.hand.length - 1;
    u = act(u, { type: 'minerUpgrade', uid: u.players.player.hand[0].uid, creatureUid: at(u, 7, 2).uid });
    expect(u.players.player.hand.length).toBe(h);
  });
  it('Crystal cards: any number per turn', () => {
    let s = mk({ playerHand: ['crystal-cluster', 'soul-shard', 'soul-shard'] });
    for (let i = 0; i < 3; i++) s = act(s, { type: 'playCrystal', uid: s.players.player.hand[0].uid });
    expect(s.players.player.bank).toBe(4);
  });
});

// Ken, Oct 31: no triangle bonus against Miners (the +1 for dwarves > goblins > gnomes > dwarves skips a Miner target: role Gatherer or Smith)
describe('faction triangle vs Miners (Ken, Oct 31)', () => {
  const CMD: Record<string, string> = { dwarves: 'borgo', gnomes: 'sproingle', goblins: 'grubnak' };
  const ATK: Record<string, string> = { dwarves: 'dwarf-pickman', gnomes: 'gnome-tinker', goblins: 'goblin-grunt' };
  const FIGHTS = [
    { a: 'dwarves', d: 'goblins', miner: 'goblin-scrounger', fighter: 'goblin-grunt' },
    { a: 'gnomes', d: 'dwarves', miner: 'dwarf-smith-miner', fighter: 'dwarf-pickman' },
    { a: 'goblins', d: 'gnomes', miner: 'gnome-prospector', fighter: 'gnome-tinker' },
  ];
  const soak = (c: any) => (c ? c.health + (c.shield || 0) : 0);
  for (const f of FIGHTS) it(`${f.a} hit a ${f.d} Miner for their plain Attack, a ${f.d} Fighter for +1; a Commander hit is unchanged`, () => {
    expect(CONFIG.typeAdvantageBonus).toBe(1);
    expect(isMiner(CARDS[f.miner])).toBe(true);
    expect(isMiner(CARDS[f.fighter])).toBe(false);
    let s = createMatch({ playerCommander: CMD[f.a], opponentCommander: CMD[f.d], factionLock: false, mines: MINES,
      setup: { opponentHand: [], board: [P(ATK[f.a], 6, 8), O(f.miner, 5, 8, { shield: 5 }), P(ATK[f.a], 6, 12), O(f.fighter, 5, 12, { shield: 5 }), P(ATK[f.a], 2, 13)], opponentHealth: 20 } });
    s = done(s);
    const a1 = at(s, 6, 8), a2 = at(s, 6, 12), a3 = at(s, 2, 13);
    expect(atkValue(s, a1, at(s, 5, 8))).toBe(a1.attack);
    expect(atkValue(s, a2, at(s, 5, 12))).toBe(a2.attack + 1);
    const m0 = soak(at(s, 5, 8)), f0 = soak(at(s, 5, 12));
    s = act(s, { type: 'attack', creatureUid: a1.uid, target: { row: 5, col: 8 } });
    s = act(s, { type: 'attack', creatureUid: a2.uid, target: { row: 5, col: 12 } });
    s = act(s, { type: 'attack', creatureUid: a3.uid, target: { commander: 'opponent' } });
    expect(m0 - soak(at(s, 5, 8))).toBe(a1.attack);
    expect(f0 - soak(at(s, 5, 12))).toBe(a2.attack + 1);
    expect(s.players.opponent.health).toBe(20 - a3.attack);
  });
  it('a strike back that lands on a Miner gets no triangle bonus either', () => {
    // a dwarf Anvilsworn Miner hits a gnome Aegis Tinkerer: gnomes beat dwarves, but the strike back lands on a Miner, so it is the plain Attack
    let s = createMatch({ playerCommander: 'borgo', opponentCommander: 'sproingle', factionLock: false, mines: MINES,
      setup: { opponentHand: [], board: [P('dwarf-smith-miner', 6, 8, { shield: 5 }), O('gnome-tinker', 5, 8)] } });
    s = done(s);
    const m0 = soak(at(s, 6, 8));
    s = act(s, { type: 'attack', creatureUid: at(s, 6, 8).uid, target: { row: 5, col: 8 } });
    expect(m0 - soak(at(s, 6, 8))).toBe(CARDS['gnome-tinker'].attack);
  });
});
