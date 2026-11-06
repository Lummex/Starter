// Oreheart rules engine. Pure: no DOM, no timers, no Math.random. State is plain JSON data.
import { CARDS, COMMANDERS, FACTIONS, STARTER_DECKS, STARTER_DECK_LIST, AI_DECKS, AI_DECK_LIST, warbandOf, CONFIG } from './content';
import { nextRand, shuffle } from './rng';
import { rollDie, randomIndex, randomFloat } from './dice'; // Ken, Nov 1: every die is a fresh roll in real play (seeded only in test mode)

export type Side = 'player' | 'opponent';
export const other = (p: Side): Side => (p === 'player' ? 'opponent' : 'player');
const cheb = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
const W: number = CONFIG.boardWidth;
const H: number = CONFIG.boardHeight;
const stronghold = (p: Side) => ({ row: CONFIG.strongholds[p][0], col: CONFIG.strongholds[p][1] });
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const colorOf = (s: any, p: Side) => FACTIONS[s.players[p].faction].crystal as string;

export const cardOf = (c: any) => CARDS[c.cardId];
const has = (c: any, a: string) => CARDS[c.cardId].abilities?.includes(a);
export const maxMove = (c: any) => CARDS[c.cardId].move;
// ---- Nov 5 (Ken approved the 33 new cards, studio/specs/new-cards-proposal-nov5.md): tags, tokens, auras, Poison X, Jinx
const TAGS = (c: any): string[] => { const k = CARDS[c.cardId] || {}; return [...(k.tags || []), ...(k.wall ? ['wall'] : [])]; };
/** Piglet, Wisp, Mule, Wall (the four 1/6 dwarves and the Shield Cadet), Automaton. */
export const hasTag = (c: any, t: string) => TAGS(c).includes(t);
export const isToken = (c: any) => !!(CARDS[c.cardId] || {}).token;
/** The spawn abilities and the token each makes (game-config "tokens"). */
export const SPAWNS: Record<string, string> = (CONFIG.tokens && CONFIG.tokens.spawnAbilities) || { brood: 'piglet', spark: 'spark-wisp', build: 'clockwork-mule' };
const friendlyNear = (s: any, c: any, ability: string, d: number) => s.board.creatures.some((o: any) => o !== c && o.owner === c.owner && CARDS[o.cardId].abilities?.includes(ability) && Math.max(Math.abs(o.row - c.row), Math.abs(o.col - c.col)) <= d);
const sideHas = (s: any, p: Side, ability: string) => s.board.creatures.some((o: any) => o.owner === p && CARDS[o.cardId].abilities?.includes(ability));
const isDwarf = (c: any) => CARDS[c.cardId].faction === 'dwarves';
/** Stand Fast, Lads!: this side's Dwarves are planted until the caster's next turn. */
const standFastOn = (s: any, c: any) => isDwarf(c) && s.turn < (s.players[c.owner].standFastUntil || 0);
/** Ranged reach of a unit right now: its printed range (+2 within 2 of a Lens Grinder); a Wisp beside a Spark Caddy shoots 2; 0 = melee. */
export function rangedOf(s: any, c: any): number {
  const k = CARDS[c.cardId];
  if (k.abilities?.includes('ranged')) return (k.range ?? CONFIG.rangedRange) + (friendlyNear(s, c, 'lensGrinder', 2) ? 2 : 0);
  if (hasTag(c, 'wisp') && friendlyNear(s, c, 'sparkCaddy', 1)) return 2;
  return 0;
}
const sneakyOf = (s: any, c: any) => !!CARDS[c.cardId].abilities?.includes('sneaky') || (CARDS[c.cardId].faction === 'goblins' && friendlyNear(s, c, 'greaser', 1));
/** Poison a hit of this unit leaves right now: the card's own (Pox Doctor 3, Sludge Lobber 1) or the Bogwater Brewer's soup this turn (2). */
const poisonHitOf = (s: any, c: any) => Math.max(CARDS[c.cardId].poisonHit || 0, c.brewPoisonTurn === s.turn ? 2 : 0);
function applyPoison(s: any, t: any, turns: number, ev: any[]) {
  t.poisonStacks = t.poison > 0 ? Math.min(CONFIG.stackCap ?? 3, (t.poisonStacks || 1) + 1) : 1; t.poison = Math.max(t.poison || 0, turns);
  ev.push({ type: 'poisoned', uid: t.uid, row: t.row, col: t.col, turns: t.poison, stacks: t.poisonStacks });
}
function jinx(s: any, o: any, ev: any[]) { if (!o.jinxed) { o.jinxed = true; ev.push({ type: 'jinxed', uid: o.uid, row: o.row, col: o.col }); } }
/** Tokens on the board of this kind that `p` owns. */
const tokenCount = (s: any, p: Side, tokenId: string) => s.board.creatures.filter((c: any) => c.owner === p && c.cardId === tokenId).length;
/** Derived flags every action refreshes (recomputeSites): Mama Grubsnout's +1 Health on Piglets, Hildegrim's Armored on Smith-upgraded Dwarves. */
function applyAuras(s: any) {
  for (const c of s.board.creatures) {
    const want = hasTag(c, 'piglet') && sideHas(s, c.owner, 'brood') ? 1 : 0, had = c.pigletBonus || 0;
    if (want !== had) { c.maxHealth += want - had; c.health = Math.max(1, c.health + want - had); c.pigletBonus = want; }
    c.forgeArmored = !!c.smithUpgraded && isDwarf(c) && sideHas(s, c.owner, 'forgemaster');
  }
}

// ---------------------------------------------------------------- board helpers
export const creatureAt = (s: any, row: number, col: number) => s.board.creatures.find((c: any) => c.row === row && c.col === col);
const isStronghold = (row: number, col: number) => (['player', 'opponent'] as Side[]).some((p) => stronghold(p).row === row && stronghold(p).col === col);
const isSite = (s: any, row: number, col: number) => s.sites.some((x: any) => x.row === row && x.col === col);
const inBounds = (row: number, col: number) => row >= 1 && row <= H && col >= 1 && col <= W;
export const emptyCell = (s: any, row: number, col: number) => inBounds(row, col) && !isStronghold(row, col) && !isSite(s, row, col) && !creatureAt(s, row, col);
const nearSite = (s: any, row: number, col: number) => s.sites.some((x: any) => cheb({ row, col }, x) <= 1 && !(x.row === row && x.col === col));
/** Tunnel rule (Ken, Oct 31: "only if your faction owns the crystal mine"): a space beside a mine that `p` currently owns. */
const nearOwnedSite = (s: any, p: Side, row: number, col: number) => s.sites.some((x: any) => x.controller === p && cheb({ row, col }, x) <= 1 && !(x.row === row && x.col === col));
const adjacentCreatures = (s: any, c: any) => s.board.creatures.filter((o: any) => o !== c && cheb(o, c) === 1);
const sgn = Math.sign;
const rint = (s: any, a: number, b: number) => a + randomIndex(s, b - a + 1);
/** Pushes `c` up to n spaces along (dr,dc); stops at the edge, a mine, a Stronghold or another unit. */
const FACE: Record<string, string> = { '-1,0': 'N', '-1,1': 'NE', '0,1': 'E', '1,1': 'SE', '1,0': 'S', '1,-1': 'SW', '0,-1': 'W', '-1,-1': 'NW' };
/** Turn `c` toward a square (never changes when the square is its own). */
const faceTo = (c: any, row: number, col: number) => { const k = sgn(row - c.row) + ',' + sgn(col - c.col); if (FACE[k]) c.facing = FACE[k]; };
function knock(s: any, c: any, dr: number, dc: number, n: number, ev: any[]) {
  if (has(c, 'riotShield')) return; // Ken (Oct 31): the Riot Shield Bearer is an immovable object: nothing knocks, bowls, shoves or lifts it
  if (standFastOn(s, c) || (hasTag(c, 'mule') && friendlyNear(s, c, 'wrangler', 2))) return; // Nov 5: Stand Fast, Lads!; Mule Wrangler Nessa
  for (let i = 0; i < n; i++) {
    const row = c.row + dr, col = c.col + dc;
    if (!emptyCell(s, row, col)) break;
    ev.push({ type: 'move', uid: c.uid, from: { row: c.row, col: c.col }, to: { row, col }, knock: true });
    c.row = row; c.col = col;
  }
}
const knockAway = (s: any, from: { row: number; col: number }, c: any, n: number, ev: any[]) => {
  const dr = sgn(c.row - from.row), dc = sgn(c.col - from.col);
  if (dr || dc) knock(s, c, dr, dc, n, ev);
};
const bonusOf = (s: any, p: Side, type: string) => {
  const a = COMMANDERS[s.players[p].commanderId].ability;
  return a.type === type ? a : null;
};
export const sitesControlled = (s: any, p: Side) => s.sites.filter((x: any) => x.controller === p).length;

function spawn(s: any, owner: Side, cardId: string, row: number, col: number, damage = 0, uid?: string, tier?: number) {
  const card = CARDS[cardId];
  const bh = bonusOf(s, owner, 'bonusHealth');
  const maxHealth = card.health + (bh ? bh.amount : 0);
  const c = {
    uid: uid || 'u' + s.nextUid++, cardId, owner, row, col, attack: card.attack, health: maxHealth - damage, maxHealth,
    upgrades: { attack: 0, health: 0 }, summonedThisTurn: false, hasMoved: false, hasAttacked: false, hasMined: false, minedMine: null as any, movedDistance: 0, movesLeft: 0, lockedUntil: 0, blinkUsed: false, shield: 0, bubble: false, ale: 0, poison: 0, drunk: 0, brewSave: false, brewTurn: 0, facing: owner === 'player' ? 'N' : 'S',
  };
  c.movesLeft = movesOf(card); // v2: a summoned unit has its points at once (Miners may move or mine the turn they are played, Haste units may act)
  if (tier && tier > 1) (c as any).tier = tier; // Nov 5: the copy's upgrade tier stays on the unit (looks only)
  if (card.token) (c as any).token = true;
  s.board.creatures.push(c);
  return c;
}
/** Nov 5: a token appears next to its summoner (or around a mine for Sooey! Hog Call); it can't act this turn (Sergeant Gurk may let a Piglet, never a called one). */
function spawnToken(s: any, owner: Side, tokenId: string, row: number, col: number, ev: any[], called = false) {
  const c: any = spawn(s, owner, tokenId, row, col);
  c.summonedThisTurn = true;
  if (called) c.calledTurn = s.turn;
  ev.push({ type: 'summon', uid: c.uid, cardId: c.cardId, owner, row, col, token: true });
  applyAuras(s);
  return c;
}
const makeCard = (s: any, cardId: string, tier?: number) => (tier && tier > 1 ? { uid: 'k' + s.nextUid++, cardId, tier } : { uid: 'k' + s.nextUid++, cardId }); // Nov 5 (Ken): each copy's own upgrade tier rides with the card (looks only)

// ---------------------------------------------------------------- costs
/** Miner = basic Miner, Smith Miner or Crystal Eater. */
export const isMiner = (card: any) => card.role === 'Gatherer' || card.role === 'Smith';
export const basicGatherer = (faction: string): string => CONFIG.basicGatherers[faction];
export const basicMiner = basicGatherer;
/** Ken (Oct 30): one full redraw of the opening hand per match (the whole hand, same size), never card by card. */
export const MULLIGAN_REDRAWS = 1;
export const canRedraw = (s: any, who: string) => (s.players[who].mulligans || 0) < MULLIGAN_REDRAWS && s.players[who].hand.length > 0;
/** Flow + Bank: everything a player can spend. */
export const funds = (pl: any) => pl.crystals + pl.bank;
const baseCost = (s: any, p: Side, card: any) => {
  let c = card.cost;
  const d = bonusOf(s, p, 'creatureDiscount');
  if (d && d.faction === card.faction) c = Math.max(1, c - d.amount);
  const disc = s.flags.discount[p];
  if (disc) c = Math.max(Math.min(card.cost, 1), c - disc);
  return c;
};
/** A basic Miner is free when Flow + Bank can't pay for it and no Miner stands on the battlefield.
 *  Fix (Ken, Oct 31: "they're putting units they don't even have crystals for out ... multiple"): the faction's basic Miner card itself
 *  always counts as "a Miner on the battlefield" here, even when the owner made it a Fighter (the dwarves' Riot Shield Bearer, Round 12c),
 *  and so does one still waiting in an open summon window. Before, a broke Dwarf side got a free Bearer again and again. */
const basicOnField = (s: any, p: Side) => {
  const pend = s.pendingResponse;
  const counts = (cardId: string) => { const k = CARDS[cardId]; return !!k && (isMiner(k) || cardId === basicGatherer(k.faction)); };
  if (pend && pend.kind === 'summon' && pend.actor === p && pend.card && counts(pend.card.cardId)) return true;
  return s.board.creatures.some((c: any) => c.owner === p && counts(c.cardId));
};
const goesFree = (s: any, p: Side, card: any) =>
  card.id === basicGatherer(card.faction) && !basicOnField(s, p) &&
  funds(s.players[p]) < baseCost(s, p, card);
export function creatureCost(s: any, p: Side, card: any) {
  return goesFree(s, p, card) ? 0 : baseCost(s, p, card);
}
export function spellCost(s: any, p: Side, card: any) {
  const d = bonusOf(s, p, 'spellDiscount');
  const w = (s.flags && s.flags.wispDiscount && s.flags.wispDiscount[p]) || 0; // Nov 5: a popped Spark Wisp makes the next spell this turn cheaper (never below 1)
  return d || w ? Math.max(1, card.cost - (d ? d.amount : 0) - w) : card.cost;
}
/** Nov 5: paying for a spell uses up the Wisp discount and charges the Hexfuse Battery Golem. */
function spellPaid(s: any, p: Side) {
  if (!s.flags.wispDiscount) s.flags.wispDiscount = { player: 0, opponent: 0 };
  if (!s.flags.spellsCast) s.flags.spellsCast = { player: 0, opponent: 0 };
  s.flags.wispDiscount[p] = 0; s.flags.spellsCast[p] = (s.flags.spellsCast[p] || 0) + 1;
}
/** Ken, Nov 1: the Miner swap's price: 1 Crystal while you have fewer than 3 Miners on the board, 3 Crystals once you have 3 or more (the Miner itself is paid for when you play it). */
export const swapCost = (s: any, who: Side) => { const n = s.board.creatures.filter((c: any) => c.owner === who && isMiner(CARDS[c.cardId])).length; if (!n && funds(s.players[who]) < 1) return 0; /* a broke side with no Miner on the board swaps free (matches the free Miner rule), or it could never start its economy */ return n < 3 ? 1 : 3; };
export const canPayCreature = (pl: any, _faction: string, cost: number) => funds(pl) >= cost;
/** Pays from Flow first, then Bank. */
function pay(pl: any, cost: number) {
  const f = Math.min(pl.crystals, cost);
  pl.crystals -= f;
  pl.bank -= cost - f;
}
/** How many Bank crystals paying `cost` would use (Flow is spent first; 0 when Flow covers it). */
export function bankNeeded(state: any, player: Side, cost: number): number {
  const pl = state.players[player];
  return Math.max(0, cost - Math.max(0, pl.crystals));
}
const payCreature = (pl: any, _faction: string, cost: number) => pay(pl, cost);
const paySpell = (pl: any, _faction: string, cost: number) => pay(pl, cost);
const gain = (s: any, p: Side, n: number) => {
  const pl = s.players[p];
  pl.crystals = Math.min(CONFIG.poolCap, pl.crystals + n);
};

// ---------------------------------------------------------------- mines
/** Legal test-layout: 3 mines in rows 3-5, at least 2 apart (Chebyshev), not adjacent to a Stronghold, on the board. */
export function legalMines(m: any): boolean {
  if (!Array.isArray(m) || m.length !== CONFIG.mineCount) return false;
  for (const x of m) if (!x || !Number.isInteger(x.row) || !Number.isInteger(x.col) || x.row < 3 || x.row > 5 || x.col < 1 || x.col > W) return false;
  for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) if (m[i].row === m[j].row && m[i].col === m[j].col) return false;
  for (const x of m) for (const p of ['player', 'opponent'] as Side[]) if (cheb(x, stronghold(p)) < 2) return false;
  return true;
}
/** Random layouts mirror corner to corner: (r, c) <-> (8 - r, 14 - c). */
function randomMines(seed: number) {
  const r = { rng: (seed ^ 0x2f6e2b1) | 0 };
  const pick = () => 1 + Math.floor(nextRand(r) * W);
  for (let tries = 0; tries < 1000; tries++) {
    const row = 3 + Math.floor(nextRand(r) * 3);
    const c = pick();
    // two mirrored mines anywhere in rows 3-5 (they may touch each other or the centre mine) plus the centre mine
    const m = [{ row, col: c }, { row: 8 - row, col: W + 1 - c }, { row: 4, col: 7 }];
    if (legalMines(m)) return m;
  }
  return [{ row: 3, col: 3 }, { row: 4, col: 7 }, { row: 5, col: 11 }];
}
const sortMines = (m: any[]) => m.map((x) => ({ row: x.row, col: x.col })).sort((a, b) => a.row - b.row || a.col - b.col);

// ---------------------------------------------------------------- creation
export function createMatch(opts: any = {}) {
  const pcmd = COMMANDERS[opts.playerCommander ?? 'grubnak'];
  const ocmd = COMMANDERS[opts.opponentCommander ?? 'sproingle'];
  const s: any = {
    turn: 0, activePlayer: 'player', priority: 'player', phase: 'mulligan', winner: null,
    players: {}, board: { creatures: [] },
    sites: [] as any[], strongholds: { player: { ...stronghold('player') }, opponent: { ...stronghold('opponent') } },
    pendingResponse: null, deployed: [] as any[], armed: { player: [] as any[], opponent: [] as any[] }, attackMode: opts.pvp === true && opts.attackMode === 'armed' ? 'armed' : 'window', factionLock: opts.factionLock !== false, rng: (opts.seed ?? 1) | 0, nextUid: 1, firstPlayer: null, firstPlayerOption: opts.firstPlayer ?? null,
    mulliganDone: { player: false, opponent: false }, pvp: opts.pvp === true, tutorial: opts.tutorial ? { step: typeof opts.tutorial === 'string' && TUTORIAL_ORDER.includes(opts.tutorial) ? opts.tutorial : TUTORIAL_ORDER[0], done: false, ...(opts.tutorialInfo || {}) } : null,
    flags: { battleCry: null, battleCryN: { player: 0, opponent: 0 }, crystalsPlayed: { player: 0, opponent: 0 }, swapped: false, discount: { player: 0, opponent: 0 }, spellsCast: { player: 0, opponent: 0 }, wispDiscount: { player: 0, opponent: 0 } },
  };
  const setup = opts.setup;
  const mines = opts.mines ? opts.mines :  randomMines((opts.seed ?? 1) | 0);
  if (!legalMines(mines)) throw new Error('Illegal mine layout');
  s.sites = sortMines(mines).map((m: any) => ({ ...m, controller: null, color: 'white', flow: { player: 0, opponent: 0 }, miners: { player: 0, opponent: 0 } }));
  (['player', 'opponent'] as Side[]).forEach((who) => {
    const cmd = who === 'player' ? pcmd : ocmd;
    s.players[who] = {
      commanderId: cmd.id, mulligans: 0, faction: cmd.faction, health: cmd.health, maxHealth: cmd.health,
      crystals: 0, bank: 0, flow: 0, hand: [], deck: [], discard: [], geodes: 0, plunder: 0, minedLastTurn: 0,
    };
  });
  for (const who of ['player', 'opponent'] as Side[]) {
    const pl = s.players[who];
    const given = setup && setup[who + 'Deck'];
    if (given) pl.deck = given.map((id: string) => makeCard(s, id));
    else if (who === 'player' && opts.playerDeck && !opts.playerDeckId) { pl.deckId = null; pl.deck = shuffle(s, opts.playerDeck.map((id: string, i: number) => makeCard(s, id, opts.playerDeckTiers && opts.playerDeckTiers[i]))); }
    else if (who === 'opponent' && opts.opponentDeck && !opts.opponentDeckId) { pl.deckId = null; pl.deck = shuffle(s, opts.opponentDeck.map((id: string, i: number) => makeCard(s, id, opts.opponentDeckTiers && opts.opponentDeckTiers[i]))); } // Nov 2 (PvP): the other player's own deck list
    else {
      let id = who === 'player' ? opts.playerDeckId : opts.opponentDeckId;
      if (!id || !(STARTER_DECKS[id] || AI_DECKS[id])) { const mine = [...STARTER_DECK_LIST.filter((d) => d.faction === pl.faction), ...(who === 'opponent' && opts.computerDecks ? AI_DECK_LIST.filter((d) => d.faction === pl.faction) : [])]; id = who === 'opponent' && !opts.testMode && !opts.setup ? mine[Math.floor(nextRand(s) * mine.length)].id : warbandOf(pl.faction); } // Nov 5: in a live match the computer may also draw one of its own new-card decks
      pl.deckId = id;
      pl.deck = shuffle(s, (STARTER_DECKS[id] || AI_DECKS[id]).map((cid: string) => makeCard(s, cid)));
    }
    if (pl.deckId === undefined) pl.deckId = null;
  }
  if (!setup) {
    for (const who of ['player', 'opponent'] as Side[]) {
      const pl = s.players[who];
      pl.crystals = CONFIG.startingCrystals;
      for (let i = 0; i < CONFIG.openingHandSize; i++) pl.hand.push(pl.deck.shift());
    }
    if (opts.skipMulligan) {
      s.mulliganDone = { player: true, opponent: true };
      const ev: any[] = [];
      finishSetup(s, ev);
    }
    return s;
  }
  // test setup: straight into turn 1 deploy phase, no draw or income
  for (const who of ['player', 'opponent'] as Side[]) {
    const pl = s.players[who];
    pl.hand = (setup[who + 'Hand'] || []).map((id: string) => makeCard(s, id));
    const num = (v: any) => (typeof v === 'number' ? v : v && typeof v === 'object' ? (v.green || 0) + (v.blue || 0) + (v.purple || 0) + (v.white || 0) : 0);
    pl.crystals = num(setup[who + 'Crystals']);
    pl.bank = num(setup[who + 'Bank']);
    const h = setup[who + 'Health'];
    if (h != null) { pl.health = h; if (h > pl.maxHealth) pl.maxHealth = h; }
  }
  for (const b of setup.board || []) {
    const c = spawn(s, b.owner, b.cardId, b.row, b.col, b.damage || 0); c.shield = b.shield || 0; c.setupShield = b.shield || 0; c.lockedUntil = 0;
    for (const k of ['attack', 'lastFight', 'kills', 'drunk', 'poison', 'poisonStacks', 'bubbles', 'rootUntil', 'lockedUntil', 'wardUntil']) if (b[k] != null) c[k] = b[k];
    if (b.bubbles > 0) c.bubble = true;
    if (b.minedMine) { c.minedMine = { row: b.minedMine.row, col: b.minedMine.col }; }
    if (b.summonedThisTurn) c.summonedThisTurn = true;
    if (b.facing && Object.values(FACE).includes(b.facing)) c.facing = b.facing;
  }
  s.mulliganDone = { player: true, opponent: true };
  s.firstPlayer = setup.firstPlayer || opts.firstPlayer || 'player';
  s.turn = 1;
  s.activePlayer = s.firstPlayer;
  s.priority = s.firstPlayer;
  s.phase = 'deploy';
  recolorMines(s, []);
  recomputeSites(s, []);
  return s;
}


function finishSetup(s: any, ev: any[]) {
  const coin = randomFloat(s);
  const first: Side = s.firstPlayerOption || (coin < 0.5 ? 'player' : 'opponent');
  s.firstPlayer = first;
  const second = other(first);
  for (let i = 0; i < CONFIG.secondPlayerExtraCards; i++) drawCard(s, second, ev);
  s.turn = 0;
  s.activePlayer = second; // startTurn flips to `first` on turn 1
  startTurn(s, ev);
  // setup shields survive the first turn's reset
  for (const c of s.board.creatures) { if (c.setupShield) c.shield = Math.max(c.shield, c.setupShield); delete c.setupShield; }
}

// ---------------------------------------------------------------- turn flow
function drawCard(s: any, who: Side, ev: any[]) {
  const pl = s.players[who];
  if (pl.deck.length === 0) {
    ev.push({ type: 'deckOut', player: who });
    damageCommander(s, who, CONFIG.deckOutDamage, ev);
    return;
  }
  const card = pl.deck.shift();
  pl.hand.push(card);
  ev.push({ type: 'draw', player: who, uid: card.uid, cardId: card.cardId });
}

/** Creatures of `who` that mined a mine and still stand next to it. */
const miningNow = (s: any, who?: Side) => s.board.creatures.filter((c: any) => c.minedMine && (!who || c.owner === who) && cheb(c, c.minedMine) <= 1);
const fullYield = (s: any, c: any) => (isMiner(CARDS[c.cardId]) ? CONFIG.gathererFlow : CONFIG.fighterFlow) + (hasTag(c, 'mule') && (friendlyNear(s, c, 'build', 1) || friendlyNear(s, c, 'wrangler', 2)) ? 1 : 0); // Nov 5: a Clockwork Mule mines 3 beside Cogsworth or within 2 of Nessa (not 4)
/** Ownership of each mine from the creatures that mined it right now (tie or none = neutral). */
function mineColors(s: any) {
  return s.sites.map((site: any) => {
    const n = { player: 0, opponent: 0 };
    for (const c of miningNow(s)) if (c.minedMine.row === site.row && c.minedMine.col === site.col) n[c.owner as Side]++;
    const ctl: Side | null = n.player > n.opponent ? 'player' : n.opponent > n.player ? 'opponent' : null;
    return { ctl, color: ctl ? colorOf(s, ctl) : 'white', n };
  });
}
/** What `c` pays when mining `site` given current mine owners: half (rounded down) at an enemy-owned mine. */
function yieldAt(s: any, c: any, mc: any[], site: { row: number; col: number }) {
  const i = s.sites.findIndex((x: any) => x.row === site.row && x.col === site.col);
  const full = fullYield(s, c);
  return i >= 0 && mc[i].ctl && mc[i].ctl !== c.owner ? Math.floor(full / 2) : full;
}
/** Set each mine's controller and color from the creatures that mined it (Draw phases and match creation only). */
function recolorMines(s: any, ev: any[]) {
  const mc = mineColors(s);
  s.sites.forEach((site: any, i: number) => {
    if (mc[i].ctl !== site.controller) ev.push({ type: 'siteControl', row: site.row, col: site.col, controller: mc[i].ctl, color: mc[i].color });
    site.controller = mc[i].ctl;
    site.color = mc[i].color;
  });
}
/** Mining payout `who` would get if their Draw phase happened now. */
function payout(s: any, who: Side) {
  const mc = mineColors(s);
  let mined = 0;
  for (const c of miningNow(s, who)) mined += yieldAt(s, c, mc, c.minedMine);
  return { mined, mc };
}

/** Per-mine and per-player preview numbers from the current board. State `sites[i].controller/color` are not touched. */
export function recomputeSites(s: any, _ev: any[]) {
  applyAuras(s); // Nov 5
  for (const c of s.board.creatures) if (has(c, 'delver')) { const nb = s.players[c.owner].bank; c.attack += nb - (c.bankBonus || 0); c.bankBonus = nb; }
  const mc = mineColors(s);
  s.sites.forEach((site: any, i: number) => {
    site.flow = { player: 0, opponent: 0 };
    site.miners = { player: mc[i].n.player, opponent: mc[i].n.opponent };
  });
  for (const c of miningNow(s)) {
    const site = s.sites.find((x: any) => x.row === c.minedMine.row && x.col === c.minedMine.col);
    if (site) site.flow[c.owner as Side] += yieldAt(s, c, mc, site);
  }
  for (const who of ['player', 'opponent'] as Side[]) s.players[who].flow = payout(s, who).mined + s.players[who].geodes * CONFIG.geodeIncome;
}

/** Underdog bonus applies when you own no mine and the enemy owns at least one. */
const underdog = (colors: any[], s: any, who: Side) => !colors.some((x) => x.ctl === who) && colors.some((x) => x.ctl === other(who));

/** Flow `who` gets at the start of their next turn if the board stayed as it is now (mining + Geodes + underdog, capped). */
export function nextPool(s: any, who: Side): number {
  const pl = s.players[who];
  const { mined, mc } = payout(s, who);
  let n = mined + pl.geodes * CONFIG.geodeIncome;
  if (pl.plunder > 0 && s.players[other(who)].crystals > n) n += CONFIG.plunderFlow * pl.plunder;
  if (underdog(mc, s, who)) n += CONFIG.underdogBonus;
  return Math.min(CONFIG.poolCap, n);
}

/** The "+N next turn" number. */
export function incomePreview(s: any, who: Side) {
  return nextPool(s, who);
}

/** What a mine makes for its owner's side per turn (that side's flow at the mine). */
export function sitePays(s: any, site: any) {
  return site.controller ? site.flow[site.controller] : 0;
}

function collectIncome(s: any, who: Side, ev: any[]) {
  const pl = s.players[who];
  pl.minedLastTurn = payout(s, who).mined;
  // a side's very first turn keeps whatever the pool already holds (test setups)
  if (pl.plunder > 0 && !(s.players[other(who)].crystals > payout(s, who).mined + pl.geodes * CONFIG.geodeIncome)) pl.plunder = 0;
  pl.crystals = s.turn <= 2 ? Math.max(pl.crystals, nextPool(s, who)) : nextPool(s, who);
  for (const c of s.board.creatures) if (c.owner === who) { c.minedMine = null; c.hasMined = false; }
  ev.push({ type: 'income', player: who, amount: pl.crystals, crystals: pl.crystals });
}

function startTurn(s: any, ev: any[]) {
  s.turn += 1;
  s.activePlayer = s.turn === 1 ? s.firstPlayer : other(s.activePlayer);
  const who: Side = s.activePlayer;
  s.phase = 'draw';
  s.priority = null;
  s.pendingResponse = null;
  const cp = s.flags.crystalsPlayed;
  cp[who] = 0;
  s.flags = { battleCry: null, battleCryN: { player: 0, opponent: 0 }, crystalsPlayed: cp, swapped: false, discount: { player: 0, opponent: 0 }, spellsCast: { player: 0, opponent: 0 }, wispDiscount: { player: 0, opponent: 0 } };
  for (const c of s.board.creatures) if (c.owner === who) { c.summonedThisTurn = false; c.hasMoved = false; c.hasAttacked = false; c.movedDistance = 0; c.movesLeft = movesOf(CARDS[c.cardId]); c.jinxed = false; c.flung = false; }
  // Nov 5: the Grumble Drummer's neighbours walk 1 further; Walls within 2 of Sergeant Brasha walk 3 (judged where they stand at the start of the turn)
  for (const c of s.board.creatures) if (c.owner === who && !isMiner(CARDS[c.cardId])) {
    if (isDwarf(c) && friendlyNear(s, c, 'drummer', 1)) c.movesLeft += 1;
    if (hasTag(c, 'wall') && friendlyNear(s, c, 'shieldwall', 2)) c.movesLeft = Math.max(c.movesLeft, 3); // any Wall, the gnomes' Gearward Sentinel too
  }
  ev.push({ type: 'turnStart', player: who, turn: s.turn });
  // creatures heal to full, lose leftover Shield and expired Hearty Ale
  for (const c of s.board.creatures) {
    if (c.owner !== who) continue;
    c.maxHealth -= c.ale; c.ale = 0;
    c.brewSave = false;
    if (!c.poison && !(c.drunk > 0)) {
      if (c.health < c.maxHealth) healCreature(s, c, c.maxHealth - c.health, ev);
      c.health = c.maxHealth;
    }
    c.shield = 0;
    if (c.drunk > 0) c.drunk -= 1;
  }
  // poison: 1 damage at the start of its owner's turn, for the remaining turns
  for (const c of [...s.board.creatures]) {
    if (c.owner !== who || !(c.poison > 0)) continue;
    c.poison -= 1;
    const stacks = Math.max(1, Math.min(STACK_CAP(), c.poisonStacks || 1)); // stacking: 1 damage per dagger (up to 3)
    ev.push({ type: 'poison', uid: c.uid, row: c.row, col: c.col, left: c.poison, stacks });
    if (!(c.poison > 0)) c.poisonStacks = 0;
    dealDamage(s, c, (CONFIG.poisonDamage ?? 1) * stacks * (sideHas(s, other(who), 'poxDoctor') ? 2 : 1), ev, true); // Nov 5: Pox Doctor Ratsbane doubles the enemy's poison ticks
  }
  for (const c of [...s.board.creatures]) {
    if (c.owner !== who) continue;
    if (has(c, 'glyphShield')) c.shield += 1;
    if (has(c, 'fixit')) for (const a of adjacentCreatures(s, c)) if (a.owner === who) a.shield += CONFIG.shieldFixit;
    if (has(c, 'heartyale')) for (const a of adjacentCreatures(s, c)) if (a.owner === who) { a.maxHealth += CONFIG.aleBonus; a.health += CONFIG.aleBonus; a.ale += CONFIG.aleBonus; }
  }
  if (bonusOf(s, who, 'lowestShield')) {
    const mine = s.board.creatures.filter((c: any) => c.owner === who);
    if (mine.length) mine.reduce((a: any, b: any) => (b.health < a.health ? b : a)).shield += bonusOf(s, who, 'lowestShield').amount;
  }
  // bonus draws: +1 card per full minedPerBonusCard crystals your miners bring in, +1 if every mine is yours
  let bonus = 0;
  if (s.turn > 1) {
    const per = CONFIG.minedPerBonusCard ?? 4;
    const mined = payout(s, who).mined;
    const fromMining = per > 0 ? Math.floor(mined / per) : 0;
    const mc = mineColors(s);
    const allMines = mc.length > 0 && mc.every((m: any) => m.ctl === who) ? (CONFIG.allMinesBonusCards ?? 1) : 0;
    bonus = fromMining + allMines;
    if (bonus > 0) ev.push({ type: 'bonusDraw', player: who, cards: bonus, fromMining, allMines, mined });
  }
  if (s.turn > 1) drawCard(s, who, ev);
  // extra cards never cost Health for an empty deck
  for (let i = 0; i < bonus && s.players[who].deck.length > 0 && !s.winner; i++) drawCard(s, who, ev);
  if (s.winner) return;
  recolorMines(s, ev);
  collectIncome(s, who, ev);
  recomputeSites(s, ev);
  s.phase = 'deploy';
  s.priority = who;
}

function endTurn(s: any, ev: any[]) {
  s.phase = 'end';
  s.deployed = [];
  if (s.armed) s.armed[other(s.activePlayer)] = []; // the defender's set counters were for this turn only
  const own = s.players[s.activePlayer];
  const per = CONFIG.savingsPerCrystal;
  if (per && own.crystals >= per) {
    const saved = Math.floor(own.crystals / per);
    own.crystals -= saved; own.bank += saved;
    ev.push({ type: 'savings', player: s.activePlayer, amount: saved });
  }
  for (const c of [...s.board.creatures]) {
    if (c.owner !== s.activePlayer) continue;
    if (has(c, 'corpsman')) {
      let pool = 7;
      for (const a of adjacentCreatures(s, c).filter((x: any) => x.owner === c.owner && x.health < x.maxHealth).sort((x: any, y: any) => x.health - y.health)) {
        const n = Math.min(pool, a.maxHealth - a.health); if (n > 0) { healCreature(s, a, n, ev); pool -= n; }
      }
    }
    if (has(c, 'medic')) { const a = adjacentCreatures(s, c).find((x: any) => x.owner === c.owner && x.health < x.maxHealth && CARDS[x.cardId].faction === 'dwarves'); if (a) healCreature(s, a, 3, ev); }
    if (has(c, 'jinxmaster')) for (const o of [...s.board.creatures]) if (o.owner !== c.owner && o.jinxed && cheb(o, c) <= 4 && s.board.creatures.includes(o)) { ev.push({ type: 'jinxTick', uid: o.uid, row: o.row, col: o.col }); dealDamage(s, o, 1, ev, true); } // Nov 5: Wobblewick
  }
  ev.push({ type: 'turnEnd', player: s.activePlayer });
  startTurn(s, ev);
}

// ---------------------------------------------------------------- damage
function healCreature(s: any, c: any, n: number, ev: any[]) {
  if (c.poison > 0 || c.drunk > 0) return;
  const before = c.health;
  c.health = Math.min(c.maxHealth, c.health + n);
  ev.push({ type: 'heal', uid: c.uid, row: c.row, col: c.col, amount: c.health - before });
}

function damageCommander(s: any, who: Side, n: number, ev: any[]) {
  const pl = s.players[who];
  pl.health = Math.max(0, pl.health - n);
  ev.push({ type: 'damage', commander: who, amount: n });
  if (pl.health <= 0 && !s.winner) {
    s.winner = other(who);
    s.phase = 'over';
    s.priority = null;
    s.pendingResponse = null;
    ev.push({ type: 'retreat', commander: who });
  }
}

function hurt(s: any, c: any, amount: number, ev: any[], raw = false, swing = false) {
  let d = amount;
  if (s.turn < (c.wardUntil || 0)) d = 0;
  if (!raw) {
    // v2 (Ken, Nov 1): Armored / Riot Shield no longer take 1 less: they block on a 2 as well (blockFacesOf)
    if (has(c, 'unbreakable')) d = Math.min(d, 3);
    if (standFastOn(s, c)) d = Math.min(d, 1); // Nov 5: Stand Fast, Lads!
    if ((c.bubbles > 0 || c.bubble) && d > 0) { c.bubbles = Math.max(0, (c.bubbles || 1) - 1); c.bubble = c.bubbles > 0; d = 0; ev.push({ type: 'shieldBlock', uid: c.uid, row: c.row, col: c.col, left: c.bubbles }); } // stacking: one bubble per blocked hit
    if (c.shield > 0 && d > 0) { const b = Math.min(c.shield, d); c.shield -= b; d -= b; ev.push({ type: 'shieldBlock', uid: c.uid, row: c.row, col: c.col, amount: b }); }
  }
  if (c.illusion) d = Math.floor(d * 0.65);
  c.health -= d;
  if (c.brewSave && c.health <= 0 && d > 0) { c.health = 1; c.brewSave = false; ev.push({ type: 'brewSave', uid: c.uid, row: c.row, col: c.col }); }
  ev.push({ type: 'damage', uid: c.uid, row: c.row, col: c.col, amount: d, ...(swing ? { swing: true } : {}) });
  return d;
}

function dealDamage(s: any, c: any, amount: number, ev: any[], raw = false) {
  const d = hurt(s, c, amount, ev, raw);
  if (c.health <= 0) defeat(s, c, ev);
  return d;
}

function defeat(s: any, c: any, ev: any[]) {
  const i = s.board.creatures.indexOf(c);
  if (i < 0) return;
  s.board.creatures.splice(i, 1);
  const token = isToken(c); // Nov 5: tokens vanish (no discard pile, no draw)
  if (!c.illusion && !token) s.players[c.owner].discard.push({ uid: c.uid, cardId: c.cardId });
  const minerDraw = !token && (CARDS[c.cardId].role === 'Gatherer' || /When this dies, draw a card/i.test(CARDS[c.cardId].text || ''));
  ev.push({ type: 'defeat', uid: c.uid, cardId: c.cardId, owner: c.owner, row: c.row, col: c.col, ...(token ? { token: true } : {}) });
  if (has(c, 'deathKnock')) for (const o of [...s.board.creatures]) if (cheb(o, c) === 1) knockAway(s, c, o, 1, ev);
  const fuse = sideHas(s, c.owner, 'fuseLighter') ? 1 : 0; // Nov 5: Fizzwick: every Ka-boom on his side deals +1
  if (has(c, 'kaboom1')) {
    for (const o of [...s.board.creatures]) if (o.uid !== c.uid /* Ken, Nov 1: friend or foe */ && cheb(o, c) === 1) dealDamage(s, o, 1 + fuse, ev);
  }
  if (has(c, 'kaboom')) {
    for (const o of [...s.board.creatures]) if (o.uid !== c.uid && cheb(o, c) === 1) dealDamage(s, o, CONFIG.kaboomDamage + fuse, ev); // Ken, Nov 1: the blast hits every adjacent unit, friend or foe
  }
  if (!has(c, 'kaboom1') && !has(c, 'kaboom') && CARDS[c.cardId].faction === 'goblins' && s.board.creatures.some((o: any) => o.owner === c.owner && has(o, 'fuseLighter') && cheb(o, c) === 1)) { // Nov 5: a Goblin or Piglet defeated next to Fizzwick Ka-booms for 1
    ev.push({ type: 'kaboom', uid: c.uid, row: c.row, col: c.col, fuse: true });
    for (const o of [...s.board.creatures]) if (cheb(o, c) === 1) dealDamage(s, o, 1, ev);
  }
  if (hasTag(c, 'wisp')) { if (!s.flags.wispDiscount) s.flags.wispDiscount = { player: 0, opponent: 0 }; s.flags.wispDiscount[c.owner] = (s.flags.wispDiscount[c.owner] || 0) + (sideHas(s, c.owner, 'spark') ? 2 : 1); } // Nov 5: a popped Wisp
  if (minerDraw) drawCard(s, c.owner, ev);
}

// ---------------------------------------------------------------- combat v2 (Ken, Nov 1: swings, block dice and move points)
// A unit's foot number is its move points: each step costs 1 and the one attack costs 1 and ends its turn (Miners keep 1 foot, so they play as before).
// Attack N = N swings; each swing rolls a d6 and hits on 3-6. For each hit the defender rolls block dice equal to its CURRENT Health (at most 3);
// any 1 or 6 blocks the hit (Armored and Riot Shield also block on a 2). A hit that gets through does 1 damage. Commanders never block, but swings at
// them still roll. Spells and other non-swing damage stay flat. All the numbers live in game-config.json "combat"; dice: 'sure' (test pages) makes every swing land.
export const COMBAT = (): any => CONFIG.combat || {};
const d6 = (s: any) => rollDie(s, 6);
export const hitChance = (): number => (COMBAT().dice === 'sure' ? 1 : (7 - (COMBAT().hitFrom ?? 3)) / 6);
const blockFacesOf = (_c: any): number[] => (COMBAT().dice === 'sure' ? [] : COMBAT().blockFaces || [6]);
/** Block dice one landed hit faces (Combat v3, Ken, Nov 1): the defender's current Health, at most blockCap; a unit of cost bigUnitCost or more rolls bigUnitDice whatever its Health; Armored and Riot Shield roll one extra die, at most armoredCap. */
/** A Large unit: cost bigUnitCost (7) or more. It rolls bigUnitDice to block, and its attacks take bigAttackerTakesDie away from the defender's block dice (never below 1). Ken, Nov 1: "bad at blocking, so they're not overpowered, and their attack's kind of harder to block". */
export const isLarge = (c: any): boolean => { const K = COMBAT(); return K.bigUnitCost != null && ((CARDS[c.cardId] || {}).cost ?? 0) >= K.bigUnitCost; };
export const blockDiceFor = (c: any, health: number, attacker?: any): number => {
  const K = COMBAT();
  let n = Math.max(0, Math.min(K.blockCap ?? 2, health));
  if (isLarge(c)) n = Math.min(n, K.bigUnitDice ?? 1);
  if (n > 0 && (has(c, 'armored') || has(c, 'riotShield') || c.forgeArmored)) n = Math.min(K.armoredCap ?? 3, n + (K.armoredExtraDie ?? 1)); // Nov 5: Hildegrim's Smith-upgraded Dwarves are Armored
  if (n > 0 && attacker && isLarge(attacker)) n = Math.max(1, n - (K.bigAttackerTakesDie ?? 1));
  return n;
};
export const blockDiceOf = (c: any, attacker?: any): number => blockDiceFor(c, c.health, attacker);
/** Chance one landed hit is blocked by a defender at this Health (against `attacker`, if given: a Large attacker takes a die away). */
export function blockChance(c: any, health = c.health, attacker?: any): number {
  const n = blockDiceFor(c, health, attacker), p = blockFacesOf(c).length / 6;
  return 1 - Math.pow(1 - p, n);
}
/** Chance a Commander blocks one landed hit (Ken, Nov 1: one die, a 6 blocks). */
export const commanderBlockChance = (): number => { const K = COMBAT(); if (K.dice === 'sure') return 0; const n = K.commanderBlockDice ?? 0, p = (K.blockFaces || [6]).length / 6; return n ? 1 - Math.pow(1 - p, n) : 0; };
/** Exact odds of `n` swings at `def` (null = a Commander): expected damage and the chance the target drops to 0, with the dice shrinking as Health drops. */
export function swingOdds(n: number, def: any | null, attacker?: any): { deal: number; kill: number } {
  const ph = hitChance();
  if (!def) return { deal: n * ph * (1 - commanderBlockChance()), kill: 0 };
  // state: (Health left, hits still soaked by Shield X and Bulwark bubbles); a soaked hit costs no Health, the dice stay at the Health
  const ab0 = Math.max(0, def.shield || 0) + Math.max(0, def.bubbles || (def.bubble ? 1 : 0));
  const K = (hp: number, ab: number) => hp * 64 + ab;
  let dist = new Map<number, number>([[K(Math.max(0, def.health), ab0), 1]]);
  for (let i = 0; i < n; i++) {
    const nx = new Map<number, number>();
    for (const [k, p] of dist) {
      const hp = Math.floor(k / 64), ab = k % 64;
      if (hp <= 0) { nx.set(k, (nx.get(k) || 0) + p); continue; }
      const land = ph * (1 - blockChance(def, hp, attacker));
      const hitK = ab > 0 ? K(hp, ab - 1) : K(hp - 1, 0);
      nx.set(hitK, (nx.get(hitK) || 0) + p * land); nx.set(k, (nx.get(k) || 0) + p * (1 - land));
    }
    dist = nx;
  }
  let deal = 0, kill = 0;
  for (const [k, p] of dist) { const hp = Math.floor(k / 64); deal += p * (def.health - hp); if (hp <= 0) kill += p; }
  return { deal, kill };
}
/** Expected damage of `n` swings (the computer's guess and the attack preview). */
export const expectedSwings = (n: number, def: any | null, attacker?: any): number => swingOdds(n, def, attacker).deal;
/** Resolve `n` swings of `att` at `def`: hit roll, block roll, then 1 damage through hurt(). Events: swing {result: miss | block | hit}. */
function swingsAt(s: any, att: any, def: any, n: number, ev: any[], tag: string) {
  let landed = 0;
  const shooter = rangedOf(s, att) > 0 || has(att, 'overwatch'); // the further points of damage of a shooter are Bleeds: they only roll when the shot itself hit
  for (let i = 0; i < n && def.health > 0; i++) {
    const base = { type: 'swing', uid: att.uid, targetUid: def.uid, row: def.row, col: def.col, tag, n: i + 1, of: n };
    if (COMBAT().dice !== 'sure' && d6(s) < (COMBAT().hitFrom ?? 3)) { ev.push({ ...base, result: 'miss' }); if (i === 0 && shooter) break; continue; } // Ken, Nov 1: a ranged unit's first shot is the shot; if it misses (or is blocked) there are no Bleed chances
    const dice = COMBAT().dice === 'sure' ? 0 : blockDiceOf(def, att), faces = blockFacesOf(def);
    let blocked = false;
    for (let k = 0; k < dice && !blocked; k++) if (faces.includes(d6(s))) blocked = true;
    if (!blocked && has(def, 'unbreakable') && landed >= 3) blocked = true; // Unbreakable: never more than 3 from one attack
    if (!blocked && landed >= 1 && standFastOn(s, def)) blocked = true; // Nov 5: Stand Fast, Lads!: at most 1 from any attack
    if (blocked) { ev.push({ ...base, result: 'block', dice, armored: has(def, 'armored') || has(def, 'riotShield') }); if (i === 0 && shooter) break; continue; }
    ev.push({ ...base, result: 'hit', dice });
    const saved = def.brewSave;
    if (hurt(s, def, 1, ev, false, true) > 0) landed++;
    if (saved && !def.brewSave) break; // the Brewlord's save ends the attack: a unit it saves takes no more swings from it
  }
  return landed;
}
/** Move points a card starts its turn with (its foot number; 1 for every Miner). */
export const movesOf = (card: any) => (isMiner(card) ? 1 : card.move || 1);

// ---------------------------------------------------------------- combat
// Ken (Oct 30, approved stacking plan): the same lasting effect adds up; the clock keeps the longer; caps in game-config
const STACK_CAP = () => CONFIG.stackCap ?? 3, AURA_CAP = () => CONFIG.auraStackCap ?? 2, ROOT_CAP = () => CONFIG.rootStackCap ?? 2;
/** a Riot Shield Bearer behind its shield (can't be lifted, hurt or act) */
const ADV = (a: string, d: string) => FACTIONS[a]?.beats === d;
/** Ken (Oct 31): the faction triangle's +1 never applies when the creature being hit is a Miner (Gatherer or Smith). Shared by the engine and the computer's damage predictions. */
export const typeBonus = (attackerCard: any, targetCard: any) => (targetCard && !isMiner(targetCard) && ADV(attackerCard.faction, targetCard.faction) ? CONFIG.typeAdvantageBonus : 0);
/** Junk Shaman's situational +1 Attack for adjacent Goblins on their owner's turn. */
export function junkBonus(s: any, c: any): number {
  if (CARDS[c.cardId].faction !== 'goblins' || s.activePlayer !== c.owner) return 0;
  return Math.min(AURA_CAP(), s.board.creatures.filter((o: any) => o !== c && o.owner === c.owner && has(o, 'junkBoost') && cheb(o, c) === 1).length); // stacking: +1 per adjacent booster, up to +2
}
export function atkValue(s: any, c: any, target?: any) {
  const card = CARDS[c.cardId];
  let v = c.attack;
  if (has(c, 'frenzy') && s.board.creatures.some((o: any) => o !== c && o.owner === c.owner && CARDS[o.cardId].faction === 'goblins' && cheb(o, c) === 1)) v += CONFIG.frenzyBonus;
  if (card.faction === 'goblins') v += CONFIG.rallyBonus * Math.min(AURA_CAP(), s.board.creatures.filter((o: any) => o.owner === c.owner && has(o, 'rally')).length); // stacking: +1 per Tyrant, up to +2
  v += junkBonus(s, c);
  if (has(c, 'brawler') && c.lastFight != null && s.turn - c.lastFight <= 2) v *= 2;
  if (has(c, 'rage') && c.health * 2 < c.maxHealth) v += CONFIG.rageBonus;
  v += Math.min(AURA_CAP(), s.flags.battleCryN?.[c.owner] ?? (s.flags.battleCry === c.owner ? 1 : 0)); // stacking: +1 per Thunderhorn Blast this turn, up to +2
  if (target) v += typeBonus(card, CARDS[target.cardId]); /* Ken, Oct 31: no triangle bonus against Miners */
  // Nov 5 auras and statuses
  if (hasTag(c, 'piglet') && friendlyNear(s, c, 'drillSergeant', 2)) v += 1;
  if (hasTag(c, 'wall') && friendlyNear(s, c, 'shieldwall', 2)) v += 1;
  if (has(c, 'ratchet') && s.board.creatures.some((o: any) => o !== c && o.owner === c.owner && hasTag(o, 'automaton') && cheb(o, c) === 1)) v += 1;
  if (has(c, 'batteryCharge')) v += Math.min(3, (s.flags && s.flags.spellsCast && s.flags.spellsCast[c.owner]) || 0);
  if (target && has(c, 'hexCadet') && target.jinxed) v += 1;
  if (c.jinxed) v -= 1;
  if (c.poison > 0 && sideHas(s, other(c.owner), 'poxDoctor')) v -= 1;
  return Math.max(0, v);
}

const DIRS8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const canAct = (s: any, c: any) => (!c.summonedThisTurn || has(c, 'haste') || c.flung || (hasTag(c, 'piglet') && c.calledTurn !== s.turn && friendlyNear(s, c, 'drillSergeant', 2))) && s.turn >= c.lockedUntil; // Nov 5: a flung Piglet, or one that appeared near Sergeant Gurk, acts at once

export function attackTargets(s: any, c: any): any[] {
  // v2: the attack costs 1 move point (Charge may still attack at 0); one attack a turn
  if (has(c, 'noAttack') || c.hasAttacked || c.hasMined || !canAct(s, c) || ((c.movesLeft ?? 1) < 1 && !has(c, 'charge') && !c.rocketed && !c.flung) || s.turn < (c.wardUntil || 0)) return [];
  const enemy = other(c.owner);
  const sh = stronghold(enemy);
  const out: any[] = [];
  if (has(c, 'overwatch')) {
    for (const o of s.board.creatures) if (o.owner === enemy) out.push({ row: o.row, col: o.col });
    out.push({ commander: enemy });
    return out;
  }
  const reach = rangedOf(s, c);
  if (reach > 0) {
    // 8 straight lines, up to the unit's reach (Nov 5: rangedOf: printed range, +2 near a Lens Grinder; a Wisp beside a Spark Caddy); the shot stops at the first unit (creature or Stronghold)
    for (const [dr, dc] of DIRS8) for (let k = 1; k <= reach; k++) {
      const r = c.row + dr * k, cl = c.col + dc * k;
      if (r < 1 || r > H || cl < 1 || cl > W) break;
      if (isStronghold(r, cl)) { if (r === sh.row && cl === sh.col) out.push({ commander: enemy }); break; }
      const o = creatureAt(s, r, cl);
      if (o) { if (o.owner === enemy) out.push({ row: o.row, col: o.col }); break; }
    }
    return out;
  }
  const adj = s.board.creatures.filter((o: any) => o.owner === enemy && cheb(o, c) === 1);
  const guards = adj.filter((o: any) => has(o, 'guard') || has(o, 'riotShield')); // Riot Shield (Ken, Oct 31): it stands in the way, so enemies beside it must hit it first
  if (guards.length) guards.forEach((g: any) => out.push({ row: g.row, col: g.col }));
  else {
    adj.forEach((o: any) => out.push({ row: o.row, col: o.col }));
    if (cheb(c, sh) <= 1) out.push({ commander: enemy });
  }
  return out;
}

function resolveAttack(s: any, attacker: any, target: any, ev: any[]) {
  attacker.hasAttacked = true;
  if (target.commander) faceTo(attacker, stronghold(target.commander).row, stronghold(target.commander).col); else faceTo(attacker, target.row, target.col);
  attacker.movesLeft = COMBAT().afterAttack === 'keep' ? Math.max(0, (attacker.movesLeft ?? 1) - 1) : 0; // v2: the attack ends the unit's turn
  if (target.commander) {
    const n = atkValue(s, attacker), sq = stronghold(target.commander);
    ev.push({ type: 'attack', uid: attacker.uid, from: { row: attacker.row, col: attacker.col }, target: { commander: target.commander } });
    let d = 0; // v3 (Ken, Nov 1): swings at a Commander roll to hit, and the Commander rolls commanderBlockDice: a 6 blocks
    const cmdDice = COMBAT().dice === 'sure' ? 0 : (COMBAT().commanderBlockDice ?? 0), cmdFaces = blockFacesOf(null);
    for (let i = 0; i < n; i++) { const hit = COMBAT().dice === 'sure' || d6(s) >= (COMBAT().hitFrom ?? 3); let result: string = hit ? 'hit' : 'miss'; if (hit && cmdDice) { let blocked = false; for (let k = 0; k < cmdDice && !blocked; k++) if (cmdFaces.includes(d6(s))) blocked = true; if (blocked) result = 'block'; } ev.push({ type: 'swing', uid: attacker.uid, commander: target.commander, row: sq.row, col: sq.col, result, dice: cmdDice, n: i + 1, of: n, tag: 'attack' }); if (result === 'hit') d++; }
    if (d > 0) damageCommander(s, target.commander, d, ev);
    return;
  }
  const def = creatureAt(s, target.row, target.col);
  const melee = cheb(attacker, def) === 1 && !rangedOf(s, attacker);
  ev.push({ type: 'attack', uid: attacker.uid, from: { row: attacker.row, col: attacker.col }, target: { row: def.row, col: def.col }, ranged: !melee });
  const pos = { row: def.row, col: def.col };
  const strikes = melee && !sneakyOf(s, attacker) && !has(attacker, 'overwatch');
  const back = strikes ? atkValue(s, def, attacker) + (standFastOn(s, def) ? 1 : 0) : 0; // Nov 5: Stand Fast, Lads!: +1 on the strike back
  const landed = swingsAt(s, attacker, def, atkValue(s, attacker, def), ev, 'attack');
  if (landed > 0 && def.health > 0) { // Nov 5: hits that leave Poison (Pox Doctor, Sludge Lobber, Bog Brew) or a Jinx (Hexbolt Tinker)
    const px = poisonHitOf(s, attacker); if (px > 0) applyPoison(s, def, px, ev);
    if (has(attacker, 'jinxHit')) jinx(s, def, ev);
  }
  // Smack knocks the target 2 away before it can strike back
  if (melee && def.health > 0 && has(attacker, 'smack') && attacker.health > 0) knockAway(s, attacker, def, 2, ev);
  if (strikes && cheb(attacker, def) === 1 && def.health > 0) { ev.push({ type: 'counter', uid: def.uid }); if (COMBAT().strikeBackRolls === false) hurt(s, attacker, back, ev); else swingsAt(s, def, attacker, back, ev, 'strikeBack'); } // v2: a strike-back rolls the same way, and only from a defender still standing
  if (has(attacker, 'overload'))
    for (const o of [...s.board.creatures]) if (o.owner === def.owner && o !== def && cheb(o, pos) === 1) hurt(s, o, CONFIG.overloadDamage, ev);
  const sdef = def.health > 0;
  if (has(attacker, 'brawler')) attacker.lastFight = s.turn;
  if (has(def, 'brawler')) def.lastFight = s.turn;
  if (sdef && has(def, 'grit')) def.attack += 1;
  if (!sdef && has(attacker, 'grit') && ((attacker.kills = (attacker.kills || 0) + 1) % 2 === 0)) attacker.attack += 1;
  if (!sdef && has(attacker, 'thief')) {
    const foe = s.players[def.owner], me = s.players[attacker.owner];
    if (foe.crystals > 0) foe.crystals -= 1; else if (foe.bank > 0) foe.bank -= 1;
    me.crystals += 1; ev.push({ type: 'steal', uid: attacker.uid, from: def.owner });
  }
  if (sdef && has(attacker, 'hobble')) def.rootUntil = s.turn < (def.rootUntil || 0) ? Math.min(def.rootUntil + 2, s.turn + 2 * ROOT_CAP()) : s.turn + 2; // stacking: a second hit holds it one turn longer (max 2)
  if (melee && attacker.health > 0 && has(attacker, 'enforcer'))
    for (const o of [...s.board.creatures]) if (o.owner !== attacker.owner && cheb(o, attacker) === 1) knockAway(s, attacker, o, rint(s, 1, 2), ev);
  if (melee && attacker.health > 0 && has(attacker, 'splitter'))
    for (const o of [...s.board.creatures]) if (o !== def && cheb(o, attacker) === 1) { const dir = DIRS8[rint(s, 0, 7)]; knock(s, o, dir[0], dir[1], rint(s, 1, 3), ev); }
  if (attacker.health > 0 && !has(attacker, 'ranged'))
    for (const g of [...s.board.creatures]) {
      if (g.owner !== def.owner || g === def || !has(g, 'assist') || g.health <= 0 || cheb(g, def) <= 1 && cheb(g, attacker) <= 1) continue;
      const spot = [-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => ({ row: def.row + dr, col: def.col + dc }))).filter((q) => (q.row !== def.row || q.col !== def.col) && emptyCell(s, q.row, q.col) && cheb(q, attacker) <= 1)[0];
      if (!spot) continue;
      ev.push({ type: 'move', uid: g.uid, from: { row: g.row, col: g.col }, to: spot, teleport: true });
      g.row = spot.row; g.col = spot.col;
      swingsAt(s, g, attacker, atkValue(s, g, attacker), ev, 'assist');
      break;
    }
  if (def.health <= 0 && has(attacker, 'siphon')) s.players[attacker.owner].bank += 1;
  if (attacker.health <= 0 && strikes && has(def, 'siphon')) s.players[def.owner].bank += 1;
  for (const c of [def, attacker, ...s.board.creatures]) if (c.health <= 0 && s.board.creatures.includes(c)) defeat(s, c, ev);
}

// ---------------------------------------------------------------- active abilities (round 12c)
export const ABILITY_COST: Record<string, number> = { slide: 1, bowl: 2, shockwave: 1, plow: 2, ramMove: 2, shaman: 2, ward: 2, rocket: 0, sacrifice: 0,
  brood: CARDS['piglet']?.tokenCost ?? 2, spark: CARDS['spark-wisp']?.tokenCost ?? 1, build: CARDS['clockwork-mule']?.tokenCost ?? 2, fling: 1, brewPoison: 1, forgeTouch: 2 }; // Nov 5
/** Abilities usable in the Deploy phase (the spawns and Durga's Forge Touch are Deploy-phase moves, like playing cards; Ward too). */
export const DEPLOY_ABILITIES = ['ward', 'brood', 'spark', 'build', 'forgeTouch'];
/** Deploy-phase only (never in the Action phase). */
export const DEPLOY_ONLY_ABILITIES = ['brood', 'spark', 'build'];
const D4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const fresh = (s: any, c: any) => !c.hasAttacked && !c.hasMined && !c.hasMoved && canAct(s, c) && !(c.wardUntil > s.turn);
/** Last cell a creature reaches walking (dr,dc) over empty cells, and what stopped it. */
function runLine(s: any, c: any, dr: number, dc: number, max = 99) {
  let r = c.row, cl = c.col, n = 0;
  while (n < max && emptyCell(s, r + dr, cl + dc)) { r += dr; cl += dc; n++; }
  return { row: r, col: cl, steps: n, hit: { row: r + dr, col: cl + dc } };
}
export function abilityActions(s: any, who: Side): any[] {
  const out: any[] = [];
  const pl = s.players[who];
  for (const c of s.board.creatures) {
    if (c.owner !== who) continue;
    const mk = (ability: string, extra: any) => { if (funds(pl) >= (ABILITY_COST[ability] || 0)) out.push({ type: 'ability', ability, creatureUid: c.uid, ...extra }); };
    const ok = fresh(s, c);
    if (has(c, 'slide') && ok) for (const [dr, dc] of DIRS8) { const e = runLine(s, c, dr, dc); const h = e.hit; if (e.steps >= 1 && (creatureAt(s, h.row, h.col) || isStronghold(h.row, h.col))) mk('slide', { target: { row: e.row, col: e.col }, dr, dc }); }
    if (has(c, 'bowl') && ok) for (const [dr, dc] of D4) { let r = c.row + dr, cl = c.col + dc, hit = false; while (inBounds(r, cl) && !isStronghold(r, cl) && !isSite(s, r, cl)) { if (creatureAt(s, r, cl)) hit = true; r += dr; cl += dc; } if (hit) mk('bowl', { dr, dc }); }
    if (has(c, 'shockwave') && ok && adjacentCreatures(s, c).some((o: any) => o.owner !== who)) mk('shockwave', {});
    if (has(c, 'plow') && ok) for (const [dr, dc] of D4) for (let dist = 1; dist <= 7; dist++) { const r = c.row + dr * dist, cl = c.col + dc * dist; if (!inBounds(r, cl) || isStronghold(r, cl) || isSite(s, r, cl)) break; mk('plow', { dr, dc, dist }); }
    if (has(c, 'ramMove') && ok) for (const [dr, dc] of DIRS8) { const e = runLine(s, c, dr, dc); for (let k = 1; k <= e.steps; k++) mk('ramMove', { target: { row: c.row + dr * k, col: c.col + dc * k } }); }
    if (has(c, 'shaman') && !c.hasAttacked && canAct(s, c))
      for (const o of s.board.creatures) if (o !== c && cheb(o, c) <= 5 && !has(o, 'riotShield') && !standFastOn(s, o)) // Riot Shield (Ken, Oct 31): the Bearer is immovable, never lifted; Nov 5: Stand Fast
        for (let r = 1; r <= H; r++) for (let cl = 1; cl <= W; cl++) if (cheb({ row: r, col: cl }, c) <= 5 && emptyCell(s, r, cl)) mk('shaman', { from: { row: o.row, col: o.col }, target: { row: r, col: cl } });
    if (has(c, 'rocket') && ok) for (let r = 1; r <= H; r++) for (let cl = 1; cl <= W; cl++) if (emptyCell(s, r, cl)) mk('rocket', { target: { row: r, col: cl } });
    if (has(c, 'ward') && c.wardTurn !== s.turn && canAct(s, c)) for (const o of s.board.creatures) if (o.owner === who && o !== c) mk('ward', { target: { row: o.row, col: o.col } });
    if (has(c, 'sacrifice') && canAct(s, c)) for (const o of s.board.creatures) if (o.owner === who && o !== c) mk('sacrifice', { target: { row: o.row, col: o.col } });
    // Nov 5: spawns (Mama Grubsnout's Brood, Tallulah's Spark, Cogsworth's Build): an empty space next to the summoner, under the token's cap; Build once a turn
    for (const [ab, tok] of Object.entries(SPAWNS)) if (has(c, ab) && tokenCount(s, who, tok) < (CARDS[tok].tokenMax ?? 99) && !(ab === 'build' && c.builtTurn === s.turn))
      for (const [dr, dc] of DIRS8) if (emptyCell(s, c.row + dr, c.col + dc)) mk(ab, { target: { row: c.row + dr, col: c.col + dc } });
    // Junk Catapult: throw an adjacent Piglet up to 5 spaces (once a turn); Bogwater Brewer: soup for an adjacent Goblin (once a turn); Durga: Forge Touch on an adjacent Dwarf (once a turn)
    if (has(c, 'fling') && c.flingTurn !== s.turn) for (const o of adjacentCreatures(s, c)) if (o.owner === who && hasTag(o, 'piglet'))
      for (let r = 1; r <= H; r++) for (let cl = 1; cl <= W; cl++) if (cheb({ row: r, col: cl }, o) <= 5 && emptyCell(s, r, cl)) mk('fling', { from: { row: o.row, col: o.col }, target: { row: r, col: cl } });
    if (has(c, 'brewPoison') && c.brewPoisonTurn !== s.turn) for (const o of adjacentCreatures(s, c)) if (o.owner === who && CARDS[o.cardId].faction === 'goblins' && o.brewPoisonTurn !== s.turn) mk('brewPoison', { target: { row: o.row, col: o.col } });
    if (has(c, 'masterSmith') && c.forgeTurn !== s.turn) for (const o of adjacentCreatures(s, c)) if (o.owner === who && isDwarf(o) && !isToken(o) && (o.upgradeCount || 0) < (CONFIG.upgradeCap ?? 3)) mk('forgeTouch', { target: { row: o.row, col: o.col } });
  }
  return out;
}
/** Nov 5: one permanent upgrade on a creature (a Miner card, Durga's Forge Touch): the stats, the cap count, Hammerhand Apprentice's first-time bonus, Hildegrim's spread to the neighbours. */
function applyUpgrade(s: any, who: Side, c: any, atk: number, hp: number, ev: any[], cardId: string | null, smith: boolean) {
  if (atk > 0 && has(c, 'eager') && !(c.upgradeCount || 0)) atk += 1;
  c.upgrades.attack += atk; c.upgrades.health += hp; c.upgradeCount = (c.upgradeCount || 0) + 1;
  c.attack += atk; c.maxHealth += hp; c.health += hp;
  if (smith) c.smithUpgraded = true;
  ev.push({ type: 'minerUpgrade', uid: c.uid, cardId, attack: atk, health: hp, row: c.row, col: c.col });
  if (isDwarf(c) && sideHas(s, who, 'forgemaster')) for (const o of adjacentCreatures(s, c)) if (o.owner === who && isDwarf(o) && !isToken(o) && (o.upgradeCount || 0) < (CONFIG.upgradeCap ?? 3)) {
    o.upgrades.health += 1; o.upgradeCount = (o.upgradeCount || 0) + 1; o.maxHealth += 1; o.health += 1;
    ev.push({ type: 'forgeSpread', uid: o.uid, row: o.row, col: o.col, health: 1 });
  }
  applyAuras(s);
}
function blastAround(s: any, c: any, dmg: number, ev: any[]) { // Ken, Nov 1: "it is a bomb": the blast hits every unit in its area, friend, foe and the rider himself (it can kill him); the enemy Commander beside it too
  const foe = other(c.owner);
  for (const o of [...s.board.creatures]) if (cheb(o, c) <= 1) dealDamage(s, o, dmg, ev);
  if (!s.winner && cheb(c, stronghold(foe)) <= 1) damageCommander(s, foe, dmg, ev);
}
function runAbility(s: any, l: any, who: Side, ev: any[]) {
  const c = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
  pay(s.players[who], ABILITY_COST[l.ability] || 0);
  const to = (row: number, col: number, teleport = false) => { faceTo(c, row, col); ev.push({ type: 'move', uid: c.uid, from: { row: c.row, col: c.col }, to: { row, col }, teleport }); c.row = row; c.col = col; };
  if (l.dr || l.dc) faceTo(c, c.row + (l.dr || 0), c.col + (l.dc || 0)); else if (l.target && l.ability !== 'slide' && l.ability !== 'ramMove' && l.ability !== 'rocket') faceTo(c, l.target.row, l.target.col);
  ev.push({ type: 'abilityUsed', uid: c.uid, ability: l.ability, row: c.row, col: c.col });
  switch (l.ability) {
    case 'slide':
      to(l.target.row, l.target.col); c.hasAttacked = true;
      if (!s.winner && cheb(c, stronghold(other(who))) <= 1) damageCommander(s, other(who), 1, ev);
      c.health = 0; defeat(s, c, ev);
      break;
    case 'bowl': {
      c.hasAttacked = true;
      const path: { row: number; col: number }[] = [];
      const hits: any[] = [];
      for (let r = c.row + l.dr, cl = c.col + l.dc; inBounds(r, cl) && !isStronghold(r, cl) && !isSite(s, r, cl); r += l.dr, cl += l.dc) path.push({ row: r, col: cl });
      const line = path.map((p) => creatureAt(s, p.row, p.col)).filter(Boolean).filter((o: any) => !has(o, 'riotShield') && !standFastOn(s, o) && !(hasTag(o, 'mule') && friendlyNear(s, o, 'wrangler', 2))); // Riot Shield (Ken, Oct 31): immovable; Nov 5: Stand Fast, Nessa's Mules
      for (const o of line) {
        const from = { row: o.row, col: o.col };
        const side = rint(s, 0, 1) ? 1 : -1, n = rint(s, 1, 2);
        const sr = l.dc * side, sc = l.dr * side;
        const free = (k: number, a: number, b: number) => emptyCell(s, o.row + a * k, o.col + b * k);
        let dir: number[] | null = null;
        if (free(1, sr, sc)) dir = [sr, sc]; else if (free(1, -sr, -sc)) dir = [-sr, -sc];
        if (dir) { const steps = n === 2 && free(2, dir[0], dir[1]) ? 2 : 1; for (let k = 0; k < steps; k++) { o.row += dir[0]; o.col += dir[1]; } }
        hits.push({ id: o.uid, uid: o.uid, from, to: { row: o.row, col: o.col } });
      }
      ev.push({ type: 'bowl', uid: c.uid, from: { row: c.row, col: c.col }, dr: l.dr, dc: l.dc, path, hits });
      { const bd = atkValue(s, c); for (const h of hits) { const o = s.board.creatures.find((x: any) => x.uid === h.uid); if (o && o.owner !== who) dealDamage(s, o, bd, ev); } } // only enemies are hurt (the ball still knocks friends aside). Ken, Nov 1: "the bowler needs to do 2 damage": every unit the ball hits takes his Attack (halved above the printed number)
      break;
    }
    case 'shockwave':
      c.hasAttacked = true;
      for (const o of adjacentCreatures(s, c)) if (o.owner !== who) { knockAway(s, c, o, 1, ev); dealDamage(s, o, atkValue(s, c), ev); } // Ken, Nov 1: what it shows is what it does: the shown Attack, no halving
      break;
    case 'plow': {
      c.hasAttacked = true;
      let steps = 0;
      for (let k = 1; k <= l.dist; k++) {
        const r = c.row + l.dr, cl = c.col + l.dc;
        const o = creatureAt(s, r, cl);
        if (o) {
          const side = rint(s, 0, 1) ? 1 : -1, n = rint(s, 1, 2);
          knock(s, o, l.dc * side, l.dr * side, n, ev);
          if (creatureAt(s, r, cl) === o) knock(s, o, -l.dc * side, -l.dr * side, n, ev);
          if (creatureAt(s, r, cl)) break;
        }
        to(r, cl); steps++;
      }
      break;
    }
    case 'ramMove': to(l.target.row, l.target.col); c.hasMoved = true; break;
    case 'shaman': {
      const o = creatureAt(s, l.from.row, l.from.col);
      c.hasAttacked = true;
      ev.push({ type: 'move', uid: o.uid, from: { row: o.row, col: o.col }, to: { row: l.target.row, col: l.target.col }, teleport: true });
      o.row = l.target.row; o.col = l.target.col;
      break;
    }
    case 'rocket':
      to(l.target.row, l.target.col, true); c.hasMoved = true; c.rocketed = true;
      blastAround(s, c, atkValue(s, c), ev); // Ken, Nov 1: the shown Attack, no halving; the rider is in it too
      break;
    case 'ward': {
      const o = creatureAt(s, l.target.row, l.target.col);
      o.wardUntil = s.turn + 2; c.wardTurn = s.turn;
      ev.push({ type: 'ward', uid: o.uid, row: o.row, col: o.col });
      break;
    }
    case 'sacrifice': {
      const o = creatureAt(s, l.target.row, l.target.col);
      o.health = 0; defeat(s, o, ev); s.players[who].bank += 1; c.hasAttacked = true;
      break;
    }
    case 'brood': case 'spark': case 'build': { // Nov 5
      spawnToken(s, who, SPAWNS[l.ability], l.target.row, l.target.col, ev);
      if (l.ability === 'build') c.builtTurn = s.turn;
      break;
    }
    case 'fling': {
      const o = creatureAt(s, l.from.row, l.from.col);
      c.flingTurn = s.turn;
      ev.push({ type: 'move', uid: o.uid, from: { row: o.row, col: o.col }, to: { row: l.target.row, col: l.target.col }, teleport: true, flung: true });
      o.row = l.target.row; o.col = l.target.col; o.flung = true; o.summonedThisTurn = false; o.movesLeft = Math.max(o.movesLeft || 0, 1);
      break;
    }
    case 'brewPoison': {
      const o = creatureAt(s, l.target.row, l.target.col);
      o.brewPoisonTurn = s.turn; c.brewPoisonTurn = s.turn;
      ev.push({ type: 'bogBrew', uid: o.uid, row: o.row, col: o.col });
      break;
    }
    case 'forgeTouch': {
      const o = creatureAt(s, l.target.row, l.target.col);
      c.forgeTurn = s.turn;
      applyUpgrade(s, who, o, 1, 1, ev, null, false);
      break;
    }
  }
}

// ---------------------------------------------------------------- spawning / movement helpers
export function summonSpaces(s: any, p: Side, card: any): { row: number; col: number }[] {
  const out: any[] = [];
  const seen = new Set<string>();
  const add = (row: number, col: number) => { const k = row + ',' + col; if (!seen.has(k) && emptyCell(s, row, col)) { seen.add(k); out.push({ row, col }); } };
  const rowCells = (row: number) => { const o: number[] = []; for (let col = 1; col <= W; col++) if (!isStronghold(row, col) && !isSite(s, row, col)) o.push(col); return o; };
  const back = CONFIG.backRow[p], front = CONFIG.frontRow[p];
  for (const col of rowCells(back)) add(back, col);
  if (out.length === 0) for (const col of rowCells(front)) add(front, col);
  // Tunnel (Ken, Oct 31): a basic Miner can also come up on any empty space beside a mine its own side owns right now (never beside a neutral or enemy mine)
  if (card.abilities?.includes('tunnel')) for (let r = 1; r <= H; r++) for (let c = 1; c <= W; c++) if (nearOwnedSite(s, p, r, c)) add(r, c);
  return out;
}

/** Mines `c` can mine this turn (one action: afterwards it can't move or attack). */
export function mineTargets(s: any, c: any): { row: number; col: number }[] {
  // Riot Shield (Ken, Oct 31 dwarf rebalance): a shielded Riot Shield Bearer can't move or attack, but it can still mine
  if (c.hasMoved || c.hasAttacked || c.hasMined || s.turn < c.lockedUntil) return [];
  if (c.summonedThisTurn && !has(c, 'haste') && !isMiner(CARDS[c.cardId])) return [];
  return s.sites.filter((x: any) => cheb(c, x) <= 1).map((x: any) => ({ row: x.row, col: x.col }));
}

/** Spaces `c` can move to; a space held by one of its own creatures is a swap. */
export function moveDests(s: any, c: any): { row: number; col: number }[] {
  // Riot Shield (Ken, Oct 31 dwarf rebalance): the shield stops attacking and dying, not walking: a Bearer can walk to a mine and dig while shielded
  // v2 (Ken, Nov 1): move points: every step costs 1; the attack ends the turn
  if (s.turn < (c.rootUntil || 0) || c.hasAttacked || c.hasMined || s.turn < c.lockedUntil || (c.summonedThisTurn && !has(c, 'haste') && !isMiner(CARDS[c.cardId])) || (c.movesLeft ?? 1) < 1) return [];
  const m = c.movesLeft ?? maxMove(c);
  if (m > 1) return v2MoveDests(s, c, m);
  const out: any[] = [];
  for (let dr = -m; dr <= m; dr++) for (let dc = -m; dc <= m; dc++) {
    if (!dr && !dc) continue;
    const row = c.row + dr, col = c.col + dc;
    const there = creatureAt(s, row, col);
    const free = emptyCell(s, row, col);
    if (!free && !(there && there.owner === c.owner && inBounds(row, col))) continue;
    const d = Math.max(Math.abs(dr), Math.abs(dc));
    if (d === 1) { out.push({ row, col }); continue; }
    let ok = false;
    for (let mr = c.row - 1; mr <= c.row + 1 && !ok; mr++) for (let mc = c.col - 1; mc <= c.col + 1 && !ok; mc++) {
      if (!inBounds(mr, mc) || (mr === c.row && mc === c.col) || cheb({ row: mr, col: mc }, { row, col }) !== 1) continue;
      if (has(c, 'flying') || emptyCell(s, mr, mc)) ok = true;
    }
    if (ok) out.push({ row, col });
  }
  return out;
}

// ---------------------------------------------------------------- spells
const tunnelCells = (s: any) => {
  const o: any[] = [];
  for (let r = 1; r <= H; r++) for (let c = 1; c <= W; c++) if (nearSite(s, r, c) && emptyCell(s, r, c)) o.push({ row: r, col: c });
  return o;
};

/** Faction spells need a Commander of that faction; shared spells ('any') are open to all; disabled cards never. */
export function spellUsable(s: any, p: Side, card: any): boolean {
  if (card.disabled) return false;
  if (s.factionLock === false) return true;
  return card.faction === 'any' || !card.faction || card.faction === s.players[p].faction;
}

/** All target options for casting `card` as `p`. `[{}]` = castable with no target; `[]` = not castable. */
export function spellTargets(s: any, p: Side, card: any): any[] {
  if (!spellUsable(s, p, card)) return [];
  const own = s.board.creatures.filter((c: any) => c.owner === p);
  const foe = s.board.creatures.filter((c: any) => c.owner !== p);
  const pos = (c: any) => ({ row: c.row, col: c.col });
  switch (card.effect) {
    case 'gainCrystals': case 'plunder': return [{}];
    case 'rations': return [...(s.players[p].health < s.players[p].maxHealth ? [{ target: { commander: p } }] : []), ...own.filter((c: any) => c.health < c.maxHealth).map((c: any) => ({ target: pos(c) }))];
    case 'tunnelMove': {
      const cells = tunnelCells(s);
      return own.flatMap((c: any) => cells.map((to: any) => ({ target: pos(c), to })));
    }
    case 'damage': return [...foe.map((c: any) => ({ target: pos(c) })), { target: { commander: other(p) } }];
    case 'poison': return foe.map((c: any) => ({ target: pos(c) }));
    case 'buffAttack': return [{}];
    case 'areaDamage': {
      const o: any[] = [];
      for (let r = 1; r <= H; r++) for (let c = 1; c <= W; c++) o.push({ target: { row: r, col: c } });
      return o;
    }
    case 'heal': return own.filter((c: any) => c.health < c.maxHealth).map((c: any) => ({ target: pos(c) }));
    case 'shield': return own.map((c: any) => ({ target: pos(c) }));
    case 'healCommander': return s.players[p].health < s.players[p].maxHealth ? [{}] : [];
    case 'chainLightning': return foe.map((c: any) => ({ target: pos(c) })); // Nov 5
    case 'hogCall': return s.sites.filter((x: any) => x.controller === p && DIRS8.some(([dr, dc]) => emptyCell(s, x.row + dr, x.col + dc))).map((x: any) => ({ target: { row: x.row, col: x.col } }));
    case 'standFast': return [{}];
    default: return [];
  }
}

function autoTarget(s: any, p: Side, card: any) {
  const opts = spellTargets(s, p, card);
  if (!opts.length) return null;
  const score = (o: any) => {
    const t = o.target && o.target.row ? creatureAt(s, o.target.row, o.target.col) : null;
    if (card.effect === 'damage' || card.effect === 'chainLightning') return t ? t.attack + CARDS[t.cardId].cost : 0.5;
    if (card.effect === 'poison') return t ? t.attack + CARDS[t.cardId].cost + t.maxHealth : 0;
    if (card.effect === 'heal') return t ? t.maxHealth - t.health : 0;
    if (card.effect === 'areaDamage') {
      let v = 0;
      for (const c of s.board.creatures) if (cheb(c, o.target) <= 1) v += c.owner === p ? -2 : 2;
      return v;
    }
    return 0;
  };
  return opts.reduce((a: any, b: any) => (score(b) > score(a) ? b : a));
}

function resolveSpell(s: any, p: Side, card: any, target: any, to: any, ev: any[]) {
  ev.push({ type: 'spell', player: p, cardId: card.id, target: target || null });
  const pl = s.players[p];
  const t = target && target.row ? creatureAt(s, target.row, target.col) : null;
  switch (card.effect) {
    case 'gainCrystals': gain(s, p, card.params.amount); break;
    case 'plunder': pl.plunder++; break;
    case 'rations': if (target && target.commander) { pl.health = Math.min(pl.maxHealth, pl.health + 4); ev.push({ type: 'heal', commander: p, amount: 4 }); } else if (t && t.owner === p) healCreature(s, t, 4, ev); break;
    case 'tunnelMove': {
      if (!t || t.owner !== p) break;
      const dest = to && emptyCell(s, to.row, to.col) ? to : tunnelCells(s)[0];
      if (!dest) break;
      ev.push({ type: 'move', uid: t.uid, from: { row: t.row, col: t.col }, to: dest, teleport: true });
      t.row = dest.row; t.col = dest.col;
      break;
    }
    case 'damage':
      if (target && target.commander) damageCommander(s, target.commander, card.params.amount, ev);
      else if (t) spellHit(s, p, t, card.params.amount, ev);
      break;
    case 'chainLightning': { // Nov 5: 3 to the target; a Jinxed target passes 2 on to every enemy next to it
      if (!t || t.owner === p) break;
      const jumped = !!t.jinxed, at = { row: t.row, col: t.col };
      spellHit(s, p, t, card.params.amount, ev);
      if (jumped) { ev.push({ type: 'chainJump', row: at.row, col: at.col }); for (const o of [...s.board.creatures]) if (o.owner !== p && o !== t && cheb(o, at) === 1 && s.board.creatures.includes(o)) spellHit(s, p, o, card.params.jump, ev); }
      break;
    }
    case 'hogCall': { // Nov 5: Sooey! Hog Call: a Piglet on every empty space around one owned mine, past the cap; they wait a turn
      if (!target) break;
      for (const [dr, dc] of DIRS8) if (emptyCell(s, target.row + dr, target.col + dc)) spawnToken(s, p, card.params.token || 'piglet', target.row + dr, target.col + dc, ev, true);
      break;
    }
    case 'standFast': s.players[p].standFastUntil = s.turn + (s.activePlayer === p ? 2 : 1); ev.push({ type: 'standFast', player: p }); break; // Nov 5: until the caster's next turn
    case 'poison': if (t && t.owner !== p) { t.poisonStacks = t.poison > 0 ? Math.min(STACK_CAP(), (t.poisonStacks || 1) + 1) : 1; t.poison = Math.max(t.poison || 0, card.params.turns); ev.push({ type: 'poisoned', uid: t.uid, row: t.row, col: t.col, turns: t.poison, stacks: t.poisonStacks }); } break; // stacking: +1 damage a turn per dagger (up to 3), the clock keeps the longer
    case 'buffAttack': s.flags.battleCry = p; s.flags.battleCryN = s.flags.battleCryN || { player: 0, opponent: 0 }; s.flags.battleCryN[p] = Math.min(AURA_CAP(), (s.flags.battleCryN[p] || 0) + 1); break;
    case 'areaDamage':
      if (target) for (const c of [...s.board.creatures]) if (cheb(c, target) <= 1) spellHit(s, p, c, card.params.amount, ev);
      break;
    case 'heal': if (t && t.owner === p) healCreature(s, t, card.params.amount, ev); break;
    case 'shield': if (t && t.owner === p) { t.bubbles = Math.min(STACK_CAP(), (t.bubbles || (t.bubble ? 1 : 0)) + 1); t.bubble = true; } break; // stacking: each Bulwark blocks one more hit (up to 3)
    case 'healCommander': pl.health = Math.min(pl.maxHealth, pl.health + card.params.amount); ev.push({ type: 'heal', commander: p, amount: card.params.amount }); break;
  }
  // Nov 5: spell-cast triggers. Rune-Scribe Nimbletoe fires a free spark at one Jinxed enemy she could shoot.
  for (const c of [...s.board.creatures]) if (c.owner === p && has(c, 'runeSpark') && s.board.creatures.includes(c)) {
    const reach = rangedOf(s, c); let best: any = null;
    for (const [dr, dc] of DIRS8) for (let k = 1; k <= reach; k++) {
      const r = c.row + dr * k, cl = c.col + dc * k;
      if (!inBounds(r, cl) || isStronghold(r, cl)) break;
      const o = creatureAt(s, r, cl);
      if (o) { if (o.owner !== p && o.jinxed && (!best || o.health < best.health)) best = o; break; }
    }
    if (best) { ev.push({ type: 'runeSpark', uid: c.uid, targetUid: best.uid, row: best.row, col: best.col }); dealDamage(s, best, 1, ev, true); }
  }
}
/** Nov 5: spell damage on a creature: +1 if it is Jinxed; while Wobblewick is out, an enemy hurt by your spell becomes Jinxed. */
function spellHit(s: any, p: Side, t: any, amount: number, ev: any[]) {
  dealDamage(s, t, amount + (t.jinxed ? 1 : 0), ev);
  if (t.owner !== p && t.health > 0 && s.board.creatures.includes(t) && sideHas(s, p, 'jinxmaster')) jinx(s, t, ev);
}

// ---------------------------------------------------------------- respond window
const pendingTargetCreature = (s: any, pend: any) => {
  const t = pend.kind === 'attack' ? pend.target : pend.kind === 'cast' ? pend.target : null;
  return t && t.row ? creatureAt(s, t.row, t.col) : null;
};

const hasEater = (s: any, p: Side) => s.board.creatures.some((c: any) => c.owner === p && CARDS[c.cardId].abilities?.some((a: string) => a.startsWith('eater')));
const crystalOk = (_s: any, _p: Side) => true; // R10.12: no once-per-round limit
/** Crystals a Crystal card adds to the Bank right now (Geode adds none). */
const crystalAmount = (card: any) => (['gain', 'motherlode'].includes(card.effect) ? card.params.amount : 0);

/** Instants in the responder's hand whose effect could apply to `pend`, affordable or not. */
export function respondMatches(s: any, responder: Side, pend: any): { h: any; card: any; opts: any[] }[] {
  const out: any[] = [];
  const pl = s.players[responder];
  const pt = pendingTargetCreature(s, pend);
  for (const h of pl.hand) {
    const card = CARDS[h.cardId];
    if (card.type !== 'spell' || card.spellKind === 'regular' || !spellUsable(s, responder, card)) continue;
    let opts: any[] = [];
    if (card.spellKind === 'counter') {
      if (card.effect === 'cancelSummon' && pend.kind === 'summon') opts = [{}];
      else if (card.effect === 'cancelSummon' && pend.kind === 'deploy') opts = (pend.summons || []).map((x: any) => ({ summonUid: x.uid })); // PvP: name the unit to send back
      else if ((card.effect === 'cancelSpell' || card.effect === 'mirror') && pend.kind === 'cast') {
        if (card.params.maxCost && CARDS[pend.card.cardId].cost > card.params.maxCost) continue;
        opts = [{}];
      }
    } else if (card.effect === 'shield') {
      if (pt && pt.owner === responder) opts = [{ target: { row: pt.row, col: pt.col } }];
    } else if (card.effect === 'heal') {
      if (pt && pt.owner === responder) opts = spellTargets(s, responder, card);
    } else if (card.effect === 'healCommander') {
      if (pend.kind === 'cast' && pend.target && pend.target.commander === responder) opts = spellTargets(s, responder, card);
    } else opts = spellTargets(s, responder, card);
    if (opts.length) out.push({ h, card, opts });
  }
  return out;
}

export function respondActions(s: any, responder: Side, pend: any): any[] {
  const out: any[] = [];
  const pl = s.players[responder];
  const have = funds(pl);
  for (const m of respondMatches(s, responder, pend)) {
    const cost = spellCost(s, responder, m.card);
    let combo: any = null;
    if (have < cost && crystalOk(s, responder)) {
      combo = pl.hand.filter((x: any) => CARDS[x.cardId].type === 'crystal' && crystalAmount(CARDS[x.cardId]) > 0 && have + crystalAmount(CARDS[x.cardId]) >= cost)
        .sort((a: any, b: any) => crystalAmount(CARDS[a.cardId]) - crystalAmount(CARDS[b.cardId]))[0] || null;
    }
    for (const o of m.opts) {
      if (have >= cost) out.push({ type: 'respond', uid: m.h.uid, ...o });
      else if (combo) out.push({ type: 'respond', uid: m.h.uid, ...o, crystalUid: combo.uid });
    }
  }
  return out;
}

/** What the responder is missing for each matching Instant (for the Respond dialog). */
export function respondNeeds(s: any, responder: Side, pend: any): { uid: string; cardId: string; need: number }[] {
  const have = funds(s.players[responder]);
  return respondMatches(s, responder, pend).map((m) => ({ uid: m.h.uid, cardId: m.card.id, need: Math.max(0, spellCost(s, responder, m.card) - have) }));
}


// ---------------------------------------------------------------- Armed counters (PvP, Nov 4)
/** Instants `who` can set ahead of time on their own turn (Deploy or Action), on any own unit (or the Commander for Second Wind). They last through the enemy's next turn. */
export function armActions(s: any, who: Side): any[] {
  const out: any[] = [];
  if (!s.pvp || s.attackMode !== 'armed' || !s.armed) return out;
  const pl = s.players[who];
  const own = s.board.creatures.filter((c: any) => c.owner === who);
  for (const h of pl.hand) {
    const card = CARDS[h.cardId];
    if (!card || card.type !== 'spell' || card.spellKind !== 'instant' || !spellUsable(s, who, card)) continue;
    const already = s.armed[who].find((x: any) => x.uid === h.uid);
    if (already) { out.push({ type: 'disarm', uid: h.uid }); continue; }
    if (card.effect === 'rations') out.push({ type: 'arm', uid: h.uid, target: { commander: who } });
    for (const c of own) out.push({ type: 'arm', uid: h.uid, target: { row: c.row, col: c.col } });
  }
  return out;
}
/** An enemy attack is about to land on `target`: the defender's set counters for it fire, in the order they were set, paid now; one that can't be paid stays set. */
function fireArmed(s: any, def: Side, target: any, ev: any[]) {
  if (!s.armed || !s.armed[def]) return;
  const pl = s.players[def];
  const hits = (t: any) => (target.commander ? !!t.commander && t.commander === target.commander : !t.commander && t.row === target.row && t.col === target.col);
  for (const a of [...s.armed[def]]) {
    if (!hits(a.target)) continue;
    const i = pl.hand.findIndex((h: any) => h.uid === a.uid);
    if (i < 0) { s.armed[def] = s.armed[def].filter((x: any) => x !== a); continue; }
    const card = CARDS[pl.hand[i].cardId];
    const cost = spellCost(s, def, card);
    if (funds(pl) < cost) continue; // stays set; maybe affordable next time
    paySpell(pl, pl.faction, cost);
    const used = pl.hand.splice(i, 1)[0];
    pl.discard.push(used);
    s.armed[def] = s.armed[def].filter((x: any) => x !== a);
    ev.push({ type: 'respond', player: def, cardId: card.id, armed: true });
    resolveSpell(s, def, card, a.target, null, ev);
  }
}

// ---------------------------------------------------------------- Corpsman Brewlord (brew)
/** Brew targets for `who`: adjacent wounded, sober Dwarves; once per turn per Brewlord, any time. */
export function brewActions(s: any, who: Side, pend?: any): any[] {
  const out: any[] = [];
  if (s.phase === 'over' || s.phase === 'mulligan') return out;
  const pt = pend ? pendingTargetCreature(s, pend) : null;
  for (const c of s.board.creatures) {
    if (c.owner !== who || !has(c, 'brew') || c.brewTurn === s.turn) continue;
    for (const a of adjacentCreatures(s, c)) {
      if (a.owner !== who || CARDS[a.cardId].faction !== 'dwarves' || !(a.health < a.maxHealth) || a.drunk > 0) continue;
      if (pend && a !== pt) continue;
      out.push({ type: 'ability', ability: 'brew', creatureUid: c.uid, target: { row: a.row, col: a.col } });
    }
  }
  return out;
}
function runBrew(s: any, l: any, ev: any[], inResponse = false) {
  const c = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
  const t = creatureAt(s, l.target.row, l.target.col);
  c.brewTurn = s.turn;
  ev.push({ type: 'abilityUsed', uid: c.uid, ability: 'brew', row: c.row, col: c.col });
  if (!inResponse) healCreature(s, t, CONFIG.brewHeal ?? 3, ev);
  t.brewSave = true;
  t.drunk = CONFIG.drunkRounds ?? 2;
  ev.push({ type: 'drunk', uid: t.uid, row: t.row, col: t.col, rounds: t.drunk });
}

function openWindow(s: any, pend: any, ev: any[]) {
  const responder = other(pend.actor);
  // PvP (Nov 2, Forge's call): the window always opens, so the attacker can't tell whether the other player holds a counter
  if (s.pvp || respondActions(s, responder, { ...pend, responder }).length || brewActions(s, responder, pend).length) {
    s.pendingResponse = { ...pend, responder };
    s.priority = responder;
  } else finishPending(s, pend, ev, false);
}

function finishPending(s: any, pend: any, ev: any[], cancelled: boolean) {
  s.pendingResponse = null;
  s.priority = s.activePlayer;
  const actor: Side = pend.actor;
  if (pend.kind === 'summon') {
    if (cancelled) { s.players[actor].hand.push(pend.card); ev.push({ type: 'bounce', uid: pend.card.uid, cardId: pend.card.cardId, owner: actor, row: pend.row, col: pend.col }); }
    else {
      const c = spawn(s, actor, pend.card.cardId, pend.row, pend.col, 0, pend.card.uid, pend.card.tier);
      c.summonedThisTurn = true;
      ev.push({ type: 'summon', uid: c.uid, cardId: c.cardId, owner: actor, row: c.row, col: c.col });
    }
  } else if (pend.kind === 'deploy') {
    // PvP: the window at the end of the Deploy phase. A counter named one of the units deployed: it goes back to the hand (its cost stays paid, as before)
    if (cancelled && pend.cancelUid) {
      const d = (s.deployed || []).find((x: any) => x.uid === pend.cancelUid);
      const i = s.board.creatures.findIndex((c: any) => c.uid === pend.cancelUid);
      if (d && i >= 0) {
        const c = s.board.creatures.splice(i, 1)[0];
        s.players[actor].hand.push(d.card);
        ev.push({ type: 'bounce', uid: c.uid, cardId: c.cardId, owner: actor, row: c.row, col: c.col });
      }
    }
    s.deployed = [];
    if (s.phase === 'deploy') { s.phase = 'action'; ev.push({ type: 'phase', phase: s.phase }); }
  } else if (pend.kind === 'cast') {
    s.players[actor].discard.push(pend.card);
    if (!cancelled) resolveSpell(s, actor, CARDS[pend.card.cardId], pend.target, pend.to, ev);
  } else if (pend.kind === 'attack') {
    const a = s.board.creatures.find((c: any) => c.uid === pend.creatureUid);
    if (a && !cancelled && attackTargets(s, a).some((t: any) => t.row === pend.target.row && t.col === pend.target.col)) resolveAttack(s, a, pend.target, ev);
    else if (a && !cancelled) ev.push({ type: 'fizzle' });
  }
}

// ---------------------------------------------------------------- legal actions

function crystalPlays(s: any, who: Side): any[] {
  const pl = s.players[who];
  const out: any[] = [];
  if (!crystalOk(s, who)) return out;
  for (const h of pl.hand) {
    const card = CARDS[h.cardId];
    if (card.type !== 'crystal') continue;
    if (card.effect === 'geode' && pl.geodes >= 1) continue;
    out.push({ type: 'playCrystal', uid: h.uid });
  }
  return out;
}

/** Basic Miners and Smith Miners can upgrade one of your own creatures. */
export const upgradeCard = (card: any) => card.type === 'creature' && (card.role === 'Smith' || (card.role === 'Gatherer' && card.abilities?.includes('gather')));
/** Miner-role creatures of `p` that could take a mine action now. */
export function readyMiners(s: any, p: Side) {
  return s.board.creatures.filter((c: any) => c.owner === p && isMiner(CARDS[c.cardId]) && mineTargets(s, c).length > 0);
}
/** Ready Miner-role creatures of `p` next to site `x`, in reading order. */
export function readyMinersAt(s: any, p: Side, x: { row: number; col: number }) {
  return readyMiners(s, p).filter((c: any) => cheb(c, x) <= 1).sort((a: any, b: any) => a.row - b.row || a.col - b.col);
}
/** Nov 5 (PvP mulligan at the same time): the opening-hand choices of one side while the other still picks. */
export function mulliganActions(s: any, who: Side): any[] {
  if (!s.pvp || s.phase !== 'mulligan' || s.mulliganDone[who]) return [];
  const out: any[] = [{ type: 'mulligan', uids: [], player: who }];
  if (canRedraw(s, who)) out.push({ type: 'mulligan', redraw: true, uids: [], player: who });
  return out;
}
export function legalActions(s: any): any[] {
  if (s.phase === 'over' || !s.priority) return [];
  const who: Side = s.priority;
  const pl = s.players[who];
  if (pl.hand.some((h: any) => h && h.hidden)) return []; // PvP (Nov 2): a player's view hides the other hand; nothing can be worked out for that side
  const out: any[] = [];
  const surrender = { type: 'surrender' };
  if (s.pendingResponse) {
    out.push(...respondActions(s, who, s.pendingResponse), ...crystalPlays(s, who), ...brewActions(s, who, s.pendingResponse), { type: 'pass' }, surrender);
    return out;
  }
  if (s.phase === 'mulligan') {
    if (s.mulliganDone[who]) return [surrender];
    // Ken (Oct 30): keep the hand, or redraw the WHOLE hand once (same size, drawn from the reshuffled deck)
    out.push({ type: 'mulligan', uids: [] });
    if (canRedraw(s, who)) out.push({ type: 'mulligan', redraw: true, uids: [] });
    out.push(surrender);
    return out;
  }
  if (who !== s.activePlayer) return [surrender];
  const ph = s.phase;
  const seenCards = new Set<string>();
  for (const h of pl.hand) {
    const card = CARDS[h.cardId];
    if (card.type === 'creature' && ph === 'deploy') {
      if (upgradeCard(card) && funds(pl) >= baseCost(s, who, card)) for (const c of s.board.creatures) if (c.owner === who && !isToken(c) && (c.upgradeCount || 0) < (CONFIG.upgradeCap ?? 3)) out.push({ type: 'minerUpgrade', uid: h.uid, creatureUid: c.uid }); // Ken, Nov 1: at most 3 upgrade cards per creature; Nov 5: never a token
      if (!canPayCreature(pl, card.faction, creatureCost(s, who, card))) continue;
      if (card.unique && s.board.creatures.some((c: any) => c.owner === who && c.cardId === card.id)) continue;
      for (const sp of summonSpaces(s, who, card)) out.push({ type: 'summon', uid: h.uid, row: sp.row, col: sp.col });
    } else if (card.type === 'spell' && card.spellKind !== 'counter' && ['deploy', 'action'].includes(ph)) {
      if (funds(pl) < spellCost(s, who, card)) continue;
      const tg = spellTargets(s, who, card);
      for (const o of tg.length || card.effect !== 'rations' ? tg : [{}]) out.push({ type: 'cast', uid: h.uid, ...o });
    }
    seenCards.add(h.uid);
  }
  if (ph === 'deploy' || ph === 'action') out.push(...crystalPlays(s, who), ...armActions(s, who));
  if (ph === 'action') for (const c of s.board.creatures) if (c.owner === who) for (const d of moveDests(s, c)) out.push({ type: 'move', creatureUid: c.uid, row: d.row, col: d.col });
  if (ph === 'action') for (const c of s.board.creatures) if (c.owner === who) for (const d of mineTargets(s, c)) out.push({ type: 'mine', creatureUid: c.uid, row: d.row, col: d.col });
  if (ph === 'action') for (const x of s.sites) if (readyMinersAt(s, who, x).length) out.push({ type: 'mineAt', row: x.row, col: x.col });
  if (ph === 'action') for (const c of s.board.creatures) if (c.owner === who) for (const t of attackTargets(s, c)) out.push({ type: 'attack', creatureUid: c.uid, target: t });
  if (ph === 'deploy' && !s.flags.swapped && funds(pl) >= swapCost(s, who) /* Ken, Nov 1: swapping a card for a Miner costs Crystals first (then you still pay for the Miner when you play it) */ && !pl.hand.some((h: any) => isMiner(CARDS[h.cardId])) && pl.deck.some((d: any) => d.cardId === basicGatherer(pl.faction))) {
    if (pl.hand.length) for (const h of pl.hand) out.push({ type: 'gathererSwap', discardUid: h.uid });
    else out.push({ type: 'gathererSwap' });
  }
  if (['deploy', 'action'].includes(ph)) {
    out.push(...abilityActions(s, who).filter((a: any) => (ph === 'action' ? !DEPLOY_ONLY_ABILITIES.includes(a.ability) : DEPLOY_ABILITIES.includes(a.ability)))); // Nov 5: spawns in the Deploy phase only
    out.push(...brewActions(s, who));
    for (const c of s.board.creatures) if (c.owner === who && has(c, 'blink') && !c.illusion && !c.blinkUsed && funds(pl) >= 1) // fix (Oct 31): an illusion never Blinks (it made illusions forever)
      for (const o of s.board.creatures) if (o !== c && o.owner === who) out.push({ type: 'ability', creatureUid: c.uid, ability: 'blink', target: { row: o.row, col: o.col } });
    out.push({ type: 'done' });
  }
  out.push(surrender);
  return out;
}

/** True if the priority player has a real move left (ignores done, surrender, upgrades, Gatherer swap and Instants). */
export function hasMovesLeft(s: any): boolean {
  if (s.phase === 'over' || !s.priority || s.pendingResponse || !['deploy', 'action'].includes(s.phase) || s.priority !== s.activePlayer) return false;
  // Rev 9: spells, Instants, Crystal cards, upgrades, abilities and the swap never count.
  const kinds = s.phase === 'deploy' ? ['summon'] : ['move', 'mine', 'mineAt', 'attack'];
  const la = legalActions(s);
  if (la.some((a: any) => kinds.includes(a.type))) return true;
  // a Crystal card is never a move itself, but playing it may fund a summon that was out of reach
  if (s.phase === 'deploy') {
    for (const c of la.filter((a: any) => a.type === 'playCrystal')) {
      const r = applyAction(s, c);
      if (r.ok && legalActions(r.state).some((a: any) => a.type === 'summon')) return true;
    }
  }
  return false;
}

/** Preview of an attack, computed by running the real attack code on a copy of the state. */
export function previewAttack(state: any, attackerUid: string, target: any) {
  // v2 (Ken, Nov 1): the exact odds of the swings and the strike back (Shield, bubbles and Unbreakable are not counted; the dice are)
  const s = state, a = s.board.creatures.find((x: any) => x.uid === attackerUid);
  if (!a) return null;
  const def = target && target.row ? creatureAt(s, target.row, target.col) : null;
  const swings = atkValue(s, a, def || undefined), o = swingOdds(swings, def, a);
  const melee = !!def && cheb(a, def) === 1 && !rangedOf(s, a) && !sneakyOf(s, a) && !has(a, 'overwatch');
  const back = melee ? atkValue(s, def, a) : 0, b = melee ? swingOdds(back, a, def) : { deal: 0, kill: 0 };
  const alive = 1 - o.kill;
  const r = (x: number) => Math.round(x * 100) / 100;
  return { youDeal: r(o.deal), youTake: r(alive * b.deal), targetDefeated: def ? o.kill >= 0.995 : s.players[target.commander].health <= swings && hitChance() >= 1, attackerDefeated: alive * b.kill >= 0.995,
    swings, back, kill: r(o.kill), die: r(alive * b.kill), melee, commander: !def, sure: COMBAT().dice === 'sure' };
}

// ---------------------------------------------------------------- apply
const eq = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
const OPTIONAL = new Set(['target', 'to']);
/** Owner-facing ability names (run, strike, pickUp, rocketRide, gallop) and click targets map onto the engine's internal ones. */
function aliasAbility(s: any, a: any) {
  if (!a || a.type !== 'ability' || typeof a.ability !== 'string') return a;
  const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid);
  const out: any = { ...a };
  const t = a.target;
  const dir = () => (c && t && typeof t.row === 'number' ? { dr: sgn(t.row - c.row), dc: sgn(t.col - c.col) } : null);
  switch (a.ability) {
    case 'run': case 'slide': { out.ability = 'slide'; const d = dir(); if (d && (d.dr || d.dc)) { out.dr = d.dr; out.dc = d.dc; delete out.target; } break; }
    case 'strike': case 'bowl': { out.ability = 'bowl'; const d = dir(); if (d && (d.dr || d.dc)) { out.dr = d.dr; out.dc = d.dc; delete out.target; } break; }
    case 'plow': { const d = dir(); if (d && c && !a.dr && !a.dc && (!d.dr || !d.dc) && (d.dr || d.dc)) { out.dr = d.dr; out.dc = d.dc; out.dist = cheb(c, t); delete out.target; } else if (d && !a.dr && !a.dc) out.dist = -1; break; }
    case 'pickUp': case 'shaman': if (a.ability === 'pickUp' || (a.to && !a.from)) { out.ability = 'shaman'; out.from = t; out.target = a.to; delete out.to; } break;
    case 'rocketRide': case 'rocket': out.ability = 'rocket'; break;
    case 'gallop': case 'ramMove': out.ability = 'ramMove'; break;
  }
  return out;
}
/** Status of every card's ability for the inspector (all are built). */
export function abilityStatusMap(): Record<string, string> {
  return Object.fromEntries(Object.values(CARDS).map((c: any) => [c.id, 'done']));
}
const normalize = (a: any) => a;
function matchLegal(s: any, a: any): any | null {
  if (a.type === 'mulligan') {
    // Ken (Oct 30): no picking cards any more. `{ redraw: true }` (or uids naming the whole hand) shuffles the whole hand
    // back and draws a new one of the same size, once per match; `uids: []` keeps the hand. Part of a hand is never legal.
    const uids = a.uids === undefined ? [] : Array.isArray(a.uids) ? a.uids : null;
    const hand = s.players[s.priority].hand.map((h: any) => h.uid);
    if (!uids || new Set(uids).size !== uids.length || !uids.every((u: string) => hand.includes(u))) return null;
    if (uids.length && uids.length !== hand.length) return null;
    const redraw = a.redraw === true || uids.length > 0;
    if (redraw && !canRedraw(s, s.priority)) return null;
    if (s.phase !== 'mulligan' || s.pendingResponse || s.mulliganDone[s.priority]) return null;
    return { type: 'mulligan', redraw, uids: [] };
  }
  for (const l of legalActions(s)) {
    if (l.type !== a.type) continue;
    if (a.crystalUid && !l.crystalUid) continue;
    let ok = true;
    for (const k of Object.keys(l)) {
      if (k === 'type') continue;
      if (a[k] === undefined || a[k] === null) { if (!OPTIONAL.has(k)) { ok = false; break; } else continue; }
      if (!eq(l[k], a[k])) { ok = false; break; }
    }
    if (ok) return l;
  }
  return null;
}

function playCrystalCard(s: any, who: Side, h: any, ev: any[]) {
  const pl = s.players[who];
  const card = CARDS[h.cardId];
  // Round 10 (R10.12): Crystal cards have no once-per-round limit, so Crystal Eaters never punish a second one
  s.flags.crystalsPlayed[who]++;
  pl.discard.push(h);
  // Crystal cards fill the Bank: it never resets and has no cap
  if (card.effect === 'gain') pl.bank += card.params.amount;
  else if (card.effect === 'geode') pl.geodes++;
  else if (card.effect === 'motherlode') { pl.bank += card.params.amount; s.flags.discount[who] += card.params.discount; }
  ev.push({ type: 'playCrystal', player: who, cardId: card.id });
}

function applyActionInner(state: any, action: any): { ok: boolean; state: any; events: any[]; error?: string } {
  const fail = (error: string) => ({ ok: false, state, events: [], error });
  if (!action || typeof action.type !== 'string') return fail('Invalid action');
  if (state.phase === 'over') return fail('The match is over');
  const s = clone(state);
  const ev: any[] = [];
  let act = normalize(aliasAbility(s, action));
  // Done before the opening hand was kept means "keep my hand" (so a bare newMatch() followed by Done just plays on)
  if (act.type === 'done' && s.phase === 'mulligan' && !s.pendingResponse && s.priority && !s.mulliganDone[s.priority]) act = { ...act, type: 'mulligan', uids: [] };
  if (act.type === 'surrender') {
    const who: Side = act.player === 'player' || act.player === 'opponent' ? act.player : s.priority || s.activePlayer;
    s.winner = other(who);
    s.phase = 'over'; s.priority = null; s.pendingResponse = null;
    ev.push({ type: 'surrender', player: who }, { type: 'retreat', commander: who });
    return { ok: true, state: s, events: ev };
  }
  if (act.type === 'ability' && act.ability === 'brew') {
    const bw: Side = act.player === 'player' || act.player === 'opponent' ? act.player : s.priority || s.activePlayer;
    const m = brewActions(s, bw, s.pendingResponse && s.priority === bw ? s.pendingResponse : undefined).find((x: any) => x.creatureUid === act.creatureUid && act.target && x.target.row === act.target.row && x.target.col === act.target.col);
    if (!m) return fail('Illegal action: brew');
    const pend = s.pendingResponse;
    runBrew(s, m, ev, !!pend);
    if (pend && s.priority === bw) finishPending(s, pend, ev, false);
    return { ok: true, state: s, events: ev };
  }
  const l = matchLegal(s, act);
  if (!l) return fail(`Illegal action: ${act.type}`);
  const who: Side = (s.pvp && s.phase === 'mulligan' && act.type === 'mulligan' && (act.player === 'player' || act.player === 'opponent')) ? act.player : s.priority; // Nov 5 (PvP): both players pick their opening hand at the same time
  const pl = s.players[who];
  const hand = (uid: string) => pl.hand.find((h: any) => h.uid === uid);
  const takeHand = (uid: string) => pl.hand.splice(pl.hand.findIndex((h: any) => h.uid === uid), 1)[0];

  switch (act.type) {
    case 'mulligan': {
      // Ken (Oct 30): one full redraw. The whole hand goes back, the deck is reshuffled, and a new hand of the SAME size is drawn.
      const n = act.redraw ? pl.hand.length : 0;
      if (n) {
        pl.deck.push(...pl.hand.splice(0, pl.hand.length));
        shuffle(s, pl.deck);
        for (let i = 0; i < n; i++) pl.hand.push(pl.deck.shift());
        pl.mulligans = (pl.mulligans || 0) + 1;
      }
      ev.push({ type: 'mulligan', player: who, count: n, redraw: n > 0, mulligans: pl.mulligans || 0 });
      s.mulliganDone[who] = true;
      if (s.pvp) { if (s.mulliganDone.player && s.mulliganDone.opponent) finishSetup(s, ev); else s.priority = s.mulliganDone.player ? 'opponent' : 'player'; } // Nov 5 (Ken): against a person both pick at the same time (either side acts with `player` set); priority points at whoever still has to pick
      else if (who === 'player') s.priority = 'opponent';
      else finishSetup(s, ev);
      break;
    }
    case 'arm': { // PvP, Ken Nov 4: set an instant ahead of time; it fires by itself when an enemy attack meets it (fireArmed). Secret until then.
      const h = hand(l.uid);
      s.armed[who] = s.armed[who].filter((x: any) => x.uid !== l.uid);
      s.armed[who].push({ uid: h.uid, cardId: h.cardId, target: l.target, turn: s.turn });
      ev.push({ type: 'arm', player: who, uid: h.uid });
      break;
    }
    case 'disarm': {
      s.armed[who] = s.armed[who].filter((x: any) => x.uid !== l.uid);
      ev.push({ type: 'disarm', player: who, uid: l.uid });
      break;
    }
    case 'pass': finishPending(s, s.pendingResponse, ev, false); break;
    case 'respond': {
      const pend = s.pendingResponse;
      if (l.crystalUid) playCrystalCard(s, who, takeHand(l.crystalUid), ev);
      const card = CARDS[hand(l.uid).cardId];
      paySpell(pl, pl.faction, spellCost(s, who, card)); spellPaid(s, who);
      const used = takeHand(l.uid);
      pl.discard.push(used);
      ev.push({ type: 'respond', player: who, cardId: card.id });
      s.pendingResponse = null;
      s.priority = s.activePlayer;
      if (card.spellKind === 'counter') {
        ev.push({ type: 'counter', cardId: card.id, player: who, countered: pend.card ? pend.card.cardId : null, ckind: pend.kind });
        if (pend.kind === 'deploy') finishPending(s, { ...pend, cancelUid: l.summonUid }, ev, true);
        else if (card.effect === 'mirror') {
          finishPending(s, pend, ev, true);
          const orig = CARDS[pend.card.cardId];
          const t = autoTarget(s, who, orig);
          if (t || orig.effect === 'buffAttack') resolveSpell(s, who, orig, t?.target, t?.to, ev);
        } else finishPending(s, pend, ev, true);
      } else {
        resolveSpell(s, who, card, l.target, l.to, ev);
        if (!s.winner) finishPending(s, pend, ev, false);
      }
      break;
    }
    case 'summon': {
      const h = takeHand(l.uid);
      const card = CARDS[h.cardId];
      payCreature(pl, card.faction, creatureCost(s, who, card));
      if (s.flags.discount[who]) s.flags.discount[who] = 0;
      if (s.pvp) {
        // Nov 4 (Ken: "you just put your units out, boom, boom, boom"): against a person the unit lands at once; the other player
        // gets ONE Respond window for the whole Deploy phase when this player presses Done (see 'done'). Hold It then names a unit.
        const c = spawn(s, who, card.id, l.row, l.col, 0, h.uid, h.tier);
        c.summonedThisTurn = true;
        ev.push({ type: 'summon', uid: c.uid, cardId: c.cardId, owner: who, row: c.row, col: c.col });
        (s.deployed ||= []).push({ uid: c.uid, cardId: c.cardId, row: c.row, col: c.col, card: h });
        break;
      }
      openWindow(s, { kind: 'summon', actor: who, card: h, row: l.row, col: l.col }, ev);
      break;
    }
    case 'cast': {
      const h = takeHand(l.uid);
      const card = CARDS[h.cardId];
      paySpell(pl, pl.faction, spellCost(s, who, card)); spellPaid(s, who);
      ev.push({ type: 'cast', player: who, cardId: card.id, target: l.target || null });
      openWindow(s, { kind: 'cast', actor: who, card: h, target: l.target || null, to: l.to || null }, ev);
      break;
    }
    case 'playCrystal': {
      playCrystalCard(s, who, takeHand(l.uid), ev);
      break;
    }
    case 'minerUpgrade': {
      const h = takeHand(l.uid);
      const card = CARDS[h.cardId];
      const c = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
      pay(pl, baseCost(s, who, card));
      if (s.flags.discount[who]) s.flags.discount[who] = 0;
      pl.discard.push(h);
      const atk = card.role === 'Smith' ? (sideHas(s, who, 'masterSmith') ? 2 : 1) : 0; // Nov 5: Master Smith Durga: Smith upgrades give +2 Attack
      applyUpgrade(s, who, c, atk, 1, ev, card.id, card.role === 'Smith');
      break;
    }
    case 'mineAt': {
      const group = readyMinersAt(s, who, l);
      for (const m of group) { faceTo(m, l.row, l.col); m.hasMined = true; m.minedMine = { row: l.row, col: l.col }; }
      const mc = mineColors(s);
      for (const m of group) ev.push({ type: 'mine', uid: m.uid, row: l.row, col: l.col, amount: yieldAt(s, m, mc, l) });
      break;
    }
    case 'move': {
      const c = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
      const from = { row: c.row, col: c.col };
      const mate = creatureAt(s, l.row, l.col);
      faceTo(c, l.row, l.col);
      ev.push({ type: 'move', uid: c.uid, from, to: { row: l.row, col: l.col } });
      if (mate) {
        ev.push({ type: 'move', uid: mate.uid, from: { row: mate.row, col: mate.col }, to: from }, { type: 'swap', uid: c.uid, withUid: mate.uid });
        mate.row = from.row; mate.col = from.col;
      }
      c.movedDistance = cheb(c, l);
      c.movesLeft = Math.max(0, (c.movesLeft ?? 1) - cheb(c, l)); // v2: each step costs a move point
      c.row = l.row; c.col = l.col; c.hasMoved = true;
      break;
    }
    case 'mine': {
      const c = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
      const amount = yieldAt(s, c, mineColors(s), l);
      faceTo(c, l.row, l.col);
      c.hasMined = true; c.minedMine = { row: l.row, col: l.col };
      ev.push({ type: 'mine', uid: c.uid, row: l.row, col: l.col, amount });
      break;
    }
    case 'attack': {
      const a = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
      if (l.target.row) {
        const tgt = creatureAt(s, l.target.row, l.target.col);
        const resp = other(who);
        if (s.pvp && s.attackMode === 'armed') { fireArmed(s, resp, l.target, ev); resolveAttack(s, a, l.target, ev); break; } // Nov 4 (Ken: "smooth, fluid"): no window, the set counters fire now
        if (s.pvp || respondActions(s, resp, { kind: 'attack', actor: who, target: l.target }).length || brewActions(s, resp, { kind: 'attack', actor: who, target: l.target }).length) {
          s.pendingResponse = { kind: 'attack', actor: who, creatureUid: a.uid, target: l.target, responder: resp };
          s.priority = resp;
          void tgt;
          break;
        }
      }
      if (s.pvp && s.attackMode === 'armed' && l.target.commander) fireArmed(s, other(who), l.target, ev);
      resolveAttack(s, a, l.target, ev);
      break;
    }
    case 'ability': {
      if (l.ability !== 'blink') { runAbility(s, l, who, ev); break; }
      { const bl = s.board.creatures.find((x: any) => x.uid === l.creatureUid); if (!bl || bl.illusion || bl.blinkUsed) break; } // fix (Oct 31): an illusion cannot Blink or make copies
      pay(pl, 1);
      const a = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
      const b = creatureAt(s, l.target.row, l.target.col);
      const pa = { row: a.row, col: a.col }, pb = { row: b.row, col: b.col };
      a.row = pb.row; a.col = pb.col; b.row = pa.row; b.col = pa.col;
      a.blinkUsed = true;
      {
        // an illusion of the Illusionist appears in front of it (the free space nearest the enemy Stronghold)
        const eh = stronghold(other(who));
        const spot = [-1, 0, 1].flatMap((dr) => [-1, 0, 1].map((dc) => ({ row: a.row + dr, col: a.col + dc }))).filter((q) => emptyCell(s, q.row, q.col)).sort((x, y) => cheb(x, eh) - cheb(y, eh))[0];
        if (spot) {
          const ill: any = spawn(s, who, a.cardId, spot.row, spot.col);
          ill.illusion = true; ill.summonedThisTurn = true;
          ev.push({ type: 'summon', uid: ill.uid, cardId: ill.cardId, owner: who, row: spot.row, col: spot.col, illusion: true });
        }
      }
      ev.push({ type: 'move', uid: a.uid, from: pa, to: pb, teleport: true }, { type: 'move', uid: b.uid, from: pb, to: pa, teleport: true });
      break;
    }
    case 'gathererSwap': {
      pay(pl, swapCost(s, who));
      if (l.discardUid) pl.discard.push(takeHand(l.discardUid));
      const idx = pl.deck.findIndex((d: any) => d.cardId === basicGatherer(pl.faction));
      const g = pl.deck.splice(idx, 1)[0];
      pl.hand.push(g);
      s.flags.swapped = true;
      ev.push({ type: 'gathererSwap', player: who, uid: g.uid, cardId: g.cardId });
      break;
    }
    case 'done': {
      if (s.phase === 'deploy' && s.pvp && s.deployed && s.deployed.length) {
        // PvP: the one Respond window for everything deployed this phase; the phase moves on when it closes (finishPending)
        openWindow(s, { kind: 'deploy', actor: who, summons: (s.deployed || []).map((d: any) => ({ uid: d.uid, cardId: d.cardId, row: d.row, col: d.col })) }, ev);
        break;
      }
      if (s.phase === 'deploy') s.phase = 'action';
      else endTurn(s, ev);
      ev.push({ type: 'phase', phase: s.phase });
      break;
    }
  }
  recomputeSites(s, ev);
  return { ok: true, state: s, events: ev };
}

// ---- Tutorial (Ken, Nov 1: "explain it to a five-year-old"; the player DOES each thing). One small board per lesson (src/ui/tutorial.ts
// starts each lesson as its own scripted match with `tutorial: '<step>'`); the engine only notices when the lesson's goal was done.
// 'controls', 'order' and 'chain' are taught with the real controls and drawn orders (UI only): the tutorial screen marks them done
// with markTutorialDone(). Room is kept before 'swap' for Anvil's coming lessons (a standing mining order; guard arrows).
export const TUTORIAL_ORDER = ['card', 'controls', 'move', 'order', 'chase', 'chain', 'ranged', 'fight', 'commander', 'mineorder', 'guardarrows', 'swap', 'complete'];
export const TUTORIAL_UI_STEPS = ['controls', 'order', 'chain', 'mineorder', 'guardarrows'];
export function markTutorialDone(s: any) { if (s && s.tutorial && s.tutorial.step !== 'complete') s.tutorial.done = true; }
function advanceTutorial(s: any, act: any, actor: Side, events: any[]) {
  const t = s.tutorial;
  if (!t || t.done || t.step === 'complete' || actor !== 'player' || !act) return;
  const attacker = act.type === 'attack' ? s.board.creatures.find((c: any) => c.uid === act.creatureUid) : null;
  const hit = act.type === 'attack' && events.some((e: any) => e.type === 'swing' || e.type === 'damage' || e.type === 'attack');
  switch (t.step) {
    case 'card': if (act.type === 'summon') t.done = true; break;
    case 'move': if (act.type === 'move') t.done = true; break;
    case 'chase': if (hit && s.turn > 1) t.done = true; break; // the chase order attacked by itself on a later turn
    case 'ranged': if (hit && attacker && has(attacker, 'ranged')) t.done = true; break;
    case 'fight': if (hit && act.target && act.target.row && !act.target.commander) t.done = true; break;
    case 'commander': if (hit && act.target && act.target.commander) t.done = true; break;
    case 'swap': if (act.type === 'gathererSwap') t.done = true; break;
  }
}

/** A legal action that does the current tutorial lesson (test hook). { type: 'done' } when the phase must end first;
 *  { type: 'order', order } for the drawn-order lessons (give it to the UI's setOrder); null when the lesson is done or the tutorial is over. */
export function tutorialAction(s: any): any | null {
  const t = s && s.tutorial;
  if (!t || t.step === 'complete' || t.done || s.phase === 'over') return null;
  if (s.pendingResponse) return { type: 'pass' };
  if (s.priority !== 'player') return null;
  const legal = legalActions(s);
  const mine = s.board.creatures.filter((c: any) => c.owner === 'player');
  const foes = s.board.creatures.filter((c: any) => c.owner === 'opponent');
  const unit = mine[0];
  const near = (c: any) => (a: any, b: any) => dist2(a, c) - dist2(b, c);
  const action = s.phase === 'action';
  let a: any = null;
  switch (t.step) {
    case 'card': a = s.phase === 'deploy' ? legal.filter((x: any) => x.type === 'summon').sort(near({ row: 7, col: 7 }))[0] : null; break;
    case 'controls': if (s.turn > 1) return null; a = { type: 'done' }; break; // a whole turn (the screen also has the player press each control)
    case 'move': a = action ? legal.find((x: any) => x.type === 'move' && t.target && x.row === t.target.row && x.col === t.target.col) || legal.find((x: any) => x.type === 'move') : null; break;
    case 'order': if (unit && t.target) return { type: 'order', order: { kind: 'move', uid: unit.uid, dest: { row: t.target.row, col: t.target.col } } }; break;
    case 'mineorder': if (unit && s.sites.length) { const site = s.sites[0]; return { type: 'order', order: { kind: 'mine', uid: unit.uid, site: { row: site.row, col: site.col } } }; } break; // Nov 1: a standing mining order (the UI's setOrder)
    case 'guardarrows': return null; // UI only: Guard stance + a drag to a square
    case 'chase': {
      a = action ? legal.find((x: any) => x.type === 'attack' && x.creatureUid === unit?.uid && x.target.row) : null;
      if (!a && action && unit && !unit.hasMoved && s.turn === 1 && foes[0]) return { type: 'order', order: { kind: 'chase', uid: unit.uid, targetUid: foes.slice().sort(near(unit))[0].uid } };
      break;
    }
    case 'chain': if (unit && foes.length >= 3) { const f = foes.slice().sort(near(unit)); return { type: 'order', order: { kind: 'chase', uid: unit.uid, targetUid: f[0].uid, then: [f[1].uid, f[2].uid] } }; } break;
    case 'ranged': a = action ? legal.find((x: any) => x.type === 'attack' && x.target.row && has(s.board.creatures.find((c: any) => c.uid === x.creatureUid), 'ranged')) : null; break;
    case 'fight': a = action ? legal.find((x: any) => x.type === 'attack' && x.target.row) : null; break;
    case 'commander': a = action ? legal.find((x: any) => x.type === 'attack' && x.target.commander) : null; break;
    case 'swap': a = s.phase === 'deploy' ? legal.find((x: any) => x.type === 'gathererSwap') : null; break;
  }
  return a || { type: 'done' };
}
const dist2 = (a: any, b: any) => (a.row - b.row) ** 2 + (a.col - b.col) ** 2;
/** Match-end summary numbers (R9.11): mined, summoned, lost and per-creature damage. */
function trackStats(s: any, ev: any[]) {
  const st = s.stats || (s.stats = { mined: { player: 0, opponent: 0 }, summoned: { player: 0, opponent: 0 }, lost: { player: 0, opponent: 0 }, damage: {}, cards: {} });
  for (const c of s.board.creatures) st.cards[c.uid] = c.cardId;
  for (const e of ev) if (e.type === 'summon' || e.type === 'defeat') st.cards[e.uid] = e.cardId;
  let att: any = null;
  const credit = (u: string, n: number) => { st.damage[u] = (st.damage[u] || 0) + n; };
  for (const e of ev) {
    if (e.type === 'summon') st.summoned[e.owner]++;
    else if (e.type === 'defeat') st.lost[e.owner]++;
    else if (e.type === 'mine') { const c = s.board.creatures.find((x: any) => x.uid === e.uid); if (c) st.mined[c.owner] += e.amount; }
    else if (e.type === 'attack') att = { uid: e.uid, target: e.target };
    else if (e.type === 'damage' && att && e.amount > 0) {
      if (e.commander) credit(att.uid, e.amount);
      else if (e.uid === att.uid) { const d = s.board.creatures.find((x: any) => x.row === att.target.row && x.col === att.target.col); void d; if (att.defUid) credit(att.defUid, e.amount); }
      else { att.defUid = e.uid; credit(att.uid, e.amount); }
    }
  }
}

/** True when the active player has made a move (card, move, attack, mine, ability) in the current phase. */
export function movedThisPhase(state: any): boolean {
  const m = state && state.moveMark;
  return !!m && m.turn === state.turn && m.phase === state.phase && m.player === state.activePlayer;
}
const MOVE_TYPES = ['summon', 'cast', 'playCrystal', 'minerUpgrade', 'mineAt', 'move', 'mine', 'attack', 'ability', 'gathererSwap'];

/** Characters the Shaman can lift: any character within 5 spaces (ally or enemy), not shielded. */
export function shamanLiftTargets(state: any, shamanUid: string): any[] {
  const c = state.board.creatures.find((x: any) => x.uid === shamanUid);
  if (!c || !has(c, 'shaman')) return [];
  return state.board.creatures.filter((o: any) => o !== c && cheb(o, c) <= 5 && !has(o, 'riotShield') && !standFastOn(state, o));
}
/** Empty squares within 5 of the Shaman where the chosen target may land. */
export function shamanLandingSquares(state: any, shamanUid: string, targetUid: string): { row: number; col: number }[] {
  const c = state.board.creatures.find((x: any) => x.uid === shamanUid);
  const o = state.board.creatures.find((x: any) => x.uid === targetUid);
  if (!c || !o || o === c || !has(c, 'shaman') || cheb(o, c) > 5 || has(o, 'riotShield') || standFastOn(state, o)) return [];
  const out: { row: number; col: number }[] = [];
  for (let r = 1; r <= H; r++) for (let cl = 1; cl <= W; cl++) if (cheb({ row: r, col: cl }, c) <= 5 && emptyCell(state, r, cl)) out.push({ row: r, col: cl });
  return out;
}
/** Lift via the normal action path: applyAction(state, shamanLiftAction(...)). Illegal squares (over 5 away) are rejected by the engine. */
export function shamanLiftAction(state: any, shamanUid: string, targetUid: string, square: { row: number; col: number }): any {
  const o = state.board.creatures.find((x: any) => x.uid === targetUid);
  return { type: 'ability', ability: 'shaman', creatureUid: shamanUid, from: o ? { row: o.row, col: o.col } : undefined, target: { row: square.row, col: square.col } };
}

export function applyAction(state: any, action: any): { ok: boolean; state: any; events: any[]; error?: string } {
  const actor: Side = state && state.priority;
  const r = applyActionInner(state, action);
  if (r.ok && action && MOVE_TYPES.includes(action.type) && r.state.phase === state.phase) r.state.moveMark = { turn: r.state.turn, phase: r.state.phase, player: r.state.activePlayer };
  if (r.ok) trackStats(r.state, r.events);
  if (r.ok && r.state.tutorial) { advanceTutorial(r.state, action, actor, r.events); if (r.state.winner === 'player') r.state.tutorial.step = 'complete'; }
  return r;
}

/** True when a creature has acted this turn, or cannot act yet (shown darker in the UI). */
export function isActed(s: any, c: any): boolean {
  return c.hasAttacked || c.hasMined || (c.movesLeft ?? 1) < 1 || (c.summonedThisTurn && !has(c, 'haste') && !c.flung && !isMiner(CARDS[c.cardId])) || s.turn < c.lockedUntil; // v2: grey only at 0 points or after the attack
}
/** v2: every square reachable in at most m steps over empty squares (a flyer passes over units; anyone walks through their own units, never through enemies); your own units at any reached distance are swaps. */
function v2MoveDests(s: any, c: any, m: number) {
  const out: any[] = []; const seen = new Set<string>([c.row + ',' + c.col]);
  let frontier = [{ row: c.row, col: c.col }];
  for (let step = 1; step <= m && frontier.length; step++) {
    const next: any[] = [];
    for (const q of frontier) for (const [dr, dc] of DIRS8) {
      const row = q.row + dr, col = q.col + dc, k = row + ',' + col;
      if (seen.has(k) || !inBounds(row, col)) continue;
      const there = creatureAt(s, row, col);
      if (emptyCell(s, row, col)) { seen.add(k); out.push({ row, col }); next.push({ row, col }); }
      else if (there && there.owner === c.owner) { seen.add(k); out.push({ row, col }); next.push({ row, col }); } // Ken, Nov 1: you may walk through your own units (never stop on one except to swap), never through enemies
      else if (there && has(c, 'flying')) { seen.add(k); next.push({ row, col }); }
    }
    frontier = next;
  }
  return out;
}
