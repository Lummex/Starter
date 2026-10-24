// Oreheart rules engine. Pure: no DOM, no timers, no Math.random. State is plain JSON data.
import { CARDS, COMMANDERS, FACTIONS, STARTER_DECKS, STARTER_DECK_LIST, warbandOf, CONFIG } from './content';
import { nextRand, shuffle } from './rng';

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

// ---------------------------------------------------------------- board helpers
export const creatureAt = (s: any, row: number, col: number) => s.board.creatures.find((c: any) => c.row === row && c.col === col);
const isStronghold = (row: number, col: number) => (['player', 'opponent'] as Side[]).some((p) => stronghold(p).row === row && stronghold(p).col === col);
const isSite = (s: any, row: number, col: number) => s.sites.some((x: any) => x.row === row && x.col === col);
const inBounds = (row: number, col: number) => row >= 1 && row <= H && col >= 1 && col <= W;
export const emptyCell = (s: any, row: number, col: number) => inBounds(row, col) && !isStronghold(row, col) && !isSite(s, row, col) && !creatureAt(s, row, col);
const nearSite = (s: any, row: number, col: number) => s.sites.some((x: any) => cheb({ row, col }, x) <= 1 && !(x.row === row && x.col === col));
const adjacentCreatures = (s: any, c: any) => s.board.creatures.filter((o: any) => o !== c && cheb(o, c) === 1);
const sgn = Math.sign;
const rint = (s: any, a: number, b: number) => a + Math.floor(nextRand(s) * (b - a + 1));
/** Pushes `c` up to n spaces along (dr,dc); stops at the edge, a mine, a Stronghold or another unit. */
function knock(s: any, c: any, dr: number, dc: number, n: number, ev: any[]) {
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

function spawn(s: any, owner: Side, cardId: string, row: number, col: number, damage = 0, uid?: string) {
  const card = CARDS[cardId];
  const bh = bonusOf(s, owner, 'bonusHealth');
  const maxHealth = card.health + (bh ? bh.amount : 0);
  const c = {
    uid: uid || 'u' + s.nextUid++, cardId, owner, row, col, attack: card.attack, health: maxHealth - damage, maxHealth,
    upgrades: { attack: 0, health: 0 }, summonedThisTurn: false, hasMoved: false, hasAttacked: false, hasMined: false, minedMine: null as any, movedDistance: 0, lockedUntil: card.abilities?.includes('riotShield') ? s.turn + 6 : 0, blinkUsed: false, shield: 0, bubble: false, ale: 0, poison: 0, drunk: 0, brewSave: false, brewTurn: 0,
  };
  s.board.creatures.push(c);
  return c;
}
const makeCard = (s: any, cardId: string) => ({ uid: 'k' + s.nextUid++, cardId });

// ---------------------------------------------------------------- costs
/** Miner = basic Miner, Smith Miner or Crystal Eater. */
export const isMiner = (card: any) => card.role === 'Gatherer' || card.role === 'Smith';
export const basicGatherer = (faction: string): string => CONFIG.basicGatherers[faction];
export const basicMiner = basicGatherer;
/** Flow + Bank: everything a player can spend. */
export const funds = (pl: any) => pl.crystals + pl.bank;
const baseCost = (s: any, p: Side, card: any) => {
  let c = card.cost;
  const d = bonusOf(s, p, 'creatureDiscount');
  if (d && d.faction === card.faction) c = Math.max(1, c - d.amount);
  const disc = s.flags.discount[p];
  if (disc) c = Math.max(0, c - disc);
  return c;
};
/** A basic Miner is free when Flow + Bank can't pay for it and no Miner stands on the battlefield. */
const goesFree = (s: any, p: Side, card: any) =>
  card.id === basicGatherer(card.faction) && !s.board.creatures.some((c: any) => c.owner === p && isMiner(CARDS[c.cardId])) &&
  funds(s.players[p]) < baseCost(s, p, card);
export function creatureCost(s: any, p: Side, card: any) {
  return goesFree(s, p, card) ? 0 : baseCost(s, p, card);
}
export function spellCost(s: any, p: Side, card: any) {
  const d = bonusOf(s, p, 'spellDiscount');
  return d ? Math.max(1, card.cost - d.amount) : card.cost;
}
export const canPayCreature = (pl: any, _faction: string, cost: number) => funds(pl) >= cost;
/** Pays from Flow first, then Bank. */
function pay(pl: any, cost: number) {
  const f = Math.min(pl.crystals, cost);
  pl.crystals -= f;
  pl.bank -= cost - f;
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
    pendingResponse: null, factionLock: opts.factionLock !== false, rng: (opts.seed ?? 1) | 0, nextUid: 1, firstPlayer: null, firstPlayerOption: opts.firstPlayer ?? null,
    mulliganDone: { player: false, opponent: false }, tutorial: opts.tutorial ? { step: 'summon' } : null,
    flags: { battleCry: null, crystalsPlayed: { player: 0, opponent: 0 }, swapped: false, discount: { player: 0, opponent: 0 } },
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
    else if (who === 'player' && opts.playerDeck && !opts.playerDeckId) { pl.deckId = null; pl.deck = shuffle(s, opts.playerDeck.map((id: string) => makeCard(s, id))); }
    else {
      let id = who === 'player' ? opts.playerDeckId : opts.opponentDeckId;
      if (!id || !STARTER_DECKS[id]) id = who === 'opponent' && !opts.testMode && !opts.setup ? STARTER_DECK_LIST.filter((d) => d.faction === pl.faction)[Math.floor(nextRand(s) * 3)].id : warbandOf(pl.faction);
      pl.deckId = id;
      pl.deck = shuffle(s, STARTER_DECKS[id].map((cid: string) => makeCard(s, cid)));
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
    const c = spawn(s, b.owner, b.cardId, b.row, b.col, b.damage || 0); c.shield = b.shield || 0;
    for (const k of ['attack', 'lastFight', 'kills', 'drunk', 'poison']) if (b[k] != null) c[k] = b[k];
    if (b.minedMine) { c.minedMine = { row: b.minedMine.row, col: b.minedMine.col }; }
    if (b.summonedThisTurn) c.summonedThisTurn = true;
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
  const coin = nextRand(s);
  const first: Side = s.firstPlayerOption || (coin < 0.5 ? 'player' : 'opponent');
  s.firstPlayer = first;
  const second = other(first);
  for (let i = 0; i < CONFIG.secondPlayerExtraCards; i++) drawCard(s, second, ev);
  s.turn = 0;
  s.activePlayer = second; // startTurn flips to `first` on turn 1
  startTurn(s, ev);
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
const fullYield = (c: any) => (isMiner(CARDS[c.cardId]) ? CONFIG.gathererFlow : CONFIG.fighterFlow);
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
  const full = fullYield(c);
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
  s.flags = { battleCry: null, crystalsPlayed: cp, swapped: false, discount: { player: 0, opponent: 0 } };
  for (const c of s.board.creatures) if (c.owner === who) { c.summonedThisTurn = false; c.hasMoved = false; c.hasAttacked = false; c.movedDistance = 0; }
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
    ev.push({ type: 'poison', uid: c.uid, row: c.row, col: c.col, left: c.poison });
    dealDamage(s, c, CONFIG.poisonDamage ?? 1, ev, true);
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
  if (s.turn > 1) drawCard(s, who, ev);
  if (s.winner) return;
  recolorMines(s, ev);
  collectIncome(s, who, ev);
  recomputeSites(s, ev);
  s.phase = 'deploy';
  s.priority = who;
}

function endTurn(s: any, ev: any[]) {
  s.phase = 'end';
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

function hurt(s: any, c: any, amount: number, ev: any[], raw = false) {
  let d = amount;
  if ((has(c, 'riotShield') && s.turn < c.lockedUntil) || s.turn < (c.wardUntil || 0)) d = 0;
  if (!raw) {
    if (has(c, 'armored')) d = Math.max(0, d - 1);
    if (has(c, 'unbreakable')) d = Math.min(d, 3);
    if (c.bubble && d > 0) { c.bubble = false; d = 0; ev.push({ type: 'shieldBlock', uid: c.uid, row: c.row, col: c.col }); }
    if (c.shield > 0 && d > 0) { const b = Math.min(c.shield, d); c.shield -= b; d -= b; ev.push({ type: 'shieldBlock', uid: c.uid, row: c.row, col: c.col, amount: b }); }
  }
  if (c.illusion) d = Math.floor(d * 0.65);
  c.health -= d;
  if (c.brewSave && c.health <= 0 && d > 0) { c.health = 1; c.brewSave = false; ev.push({ type: 'brewSave', uid: c.uid, row: c.row, col: c.col }); }
  ev.push({ type: 'damage', uid: c.uid, row: c.row, col: c.col, amount: d });
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
  if (!c.illusion) s.players[c.owner].discard.push({ uid: c.uid, cardId: c.cardId });
  const minerDraw = CARDS[c.cardId].role === 'Gatherer';
  ev.push({ type: 'defeat', uid: c.uid, cardId: c.cardId, owner: c.owner, row: c.row, col: c.col });
  if (has(c, 'deathKnock')) for (const o of [...s.board.creatures]) if (cheb(o, c) === 1) knockAway(s, c, o, 1, ev);
  if (has(c, 'kaboom1')) {
    for (const o of [...s.board.creatures]) if (o.owner !== c.owner && cheb(o, c) === 1) dealDamage(s, o, 1, ev);
  }
  if (has(c, 'kaboom')) {
    for (const o of [...s.board.creatures]) if (o.owner !== c.owner && cheb(o, c) === 1) dealDamage(s, o, CONFIG.kaboomDamage, ev);
  }
  if (minerDraw) drawCard(s, c.owner, ev);
}

// ---------------------------------------------------------------- combat
const ADV = (a: string, d: string) => FACTIONS[a]?.beats === d;
/** Junk Shaman's situational +1 Attack for adjacent Goblins on their owner's turn. */
export function junkBonus(s: any, c: any): number {
  if (CARDS[c.cardId].faction !== 'goblins' || s.activePlayer !== c.owner) return 0;
  return s.board.creatures.some((o: any) => o !== c && o.owner === c.owner && has(o, 'junkBoost') && cheb(o, c) === 1) ? 1 : 0;
}
export function atkValue(s: any, c: any, target?: any) {
  const card = CARDS[c.cardId];
  let v = c.attack;
  if (has(c, 'frenzy') && s.board.creatures.some((o: any) => o !== c && o.owner === c.owner && CARDS[o.cardId].faction === 'goblins' && cheb(o, c) === 1)) v += CONFIG.frenzyBonus;
  if (card.faction === 'goblins' && s.board.creatures.some((o: any) => o.owner === c.owner && has(o, 'rally'))) v += CONFIG.rallyBonus;
  v += junkBonus(s, c);
  if (has(c, 'delver')) v += s.players[c.owner].bank;
  if (has(c, 'brawler') && c.lastFight != null && s.turn - c.lastFight <= 2) v *= 2;
  if (has(c, 'rage') && c.health * 2 < c.maxHealth) v += CONFIG.rageBonus;
  if (s.flags.battleCry === c.owner) v += 1;
  if (target && ADV(card.faction, CARDS[target.cardId].faction)) v += CONFIG.typeAdvantageBonus;
  return Math.max(0, v);
}

const DIRS8 = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const canAct = (s: any, c: any) => (!c.summonedThisTurn || has(c, 'haste')) && s.turn >= c.lockedUntil;

export function attackTargets(s: any, c: any): any[] {
  if (c.hasAttacked || c.hasMined || !canAct(s, c) || (c.hasMoved && !has(c, 'charge') && !c.rocketed) || s.turn < (c.wardUntil || 0)) return [];
  const enemy = other(c.owner);
  const sh = stronghold(enemy);
  const out: any[] = [];
  if (has(c, 'overwatch')) {
    for (const o of s.board.creatures) if (o.owner === enemy) out.push({ row: o.row, col: o.col });
    out.push({ commander: enemy });
    return out;
  }
  if (has(c, 'ranged')) {
    // 8 straight lines, up to CONFIG.rangedRange squares; the shot stops at the first unit (creature or Stronghold)
    for (const [dr, dc] of DIRS8) for (let k = 1; k <= (CARDS[c.cardId].range ?? CONFIG.rangedRange); k++) {
      const r = c.row + dr * k, cl = c.col + dc * k;
      if (r < 1 || r > H || cl < 1 || cl > W) break;
      if (isStronghold(r, cl)) { if (r === sh.row && cl === sh.col) out.push({ commander: enemy }); break; }
      const o = creatureAt(s, r, cl);
      if (o) { if (o.owner === enemy) out.push({ row: o.row, col: o.col }); break; }
    }
    return out;
  }
  const adj = s.board.creatures.filter((o: any) => o.owner === enemy && cheb(o, c) === 1);
  const guards = adj.filter((o: any) => has(o, 'guard'));
  if (guards.length) guards.forEach((g: any) => out.push({ row: g.row, col: g.col }));
  else {
    adj.forEach((o: any) => out.push({ row: o.row, col: o.col }));
    if (cheb(c, sh) <= 1) out.push({ commander: enemy });
  }
  return out;
}

function resolveAttack(s: any, attacker: any, target: any, ev: any[]) {
  attacker.hasAttacked = true;
  if (target.commander) {
    const d = atkValue(s, attacker);
    ev.push({ type: 'attack', uid: attacker.uid, from: { row: attacker.row, col: attacker.col }, target: { commander: target.commander } });
    damageCommander(s, target.commander, d, ev);
    return;
  }
  const def = creatureAt(s, target.row, target.col);
  const melee = cheb(attacker, def) === 1 && !has(attacker, 'ranged');
  ev.push({ type: 'attack', uid: attacker.uid, from: { row: attacker.row, col: attacker.col }, target: { row: def.row, col: def.col }, ranged: !melee });
  const pos = { row: def.row, col: def.col };
  const strikes = melee && !has(attacker, 'sneaky') && !has(attacker, 'overwatch');
  const back = strikes ? atkValue(s, def, attacker) : 0;
  hurt(s, def, atkValue(s, attacker, def), ev);
  if (strikes) { ev.push({ type: 'counter', uid: def.uid }); hurt(s, attacker, back, ev); }
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
    me.bank += 1; ev.push({ type: 'steal', uid: attacker.uid, from: def.owner });
  }
  if (sdef && melee && has(attacker, 'smack') && attacker.health > 0) knockAway(s, attacker, def, 2, ev);
  if (sdef && has(attacker, 'hobble')) def.rootUntil = s.turn + 2;
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
      hurt(s, attacker, atkValue(s, g, attacker), ev);
      break;
    }
  if (def.health <= 0 && has(attacker, 'siphon')) s.players[attacker.owner].bank += 1;
  if (attacker.health <= 0 && strikes && has(def, 'siphon')) s.players[def.owner].bank += 1;
  for (const c of [def, attacker, ...s.board.creatures]) if (c.health <= 0 && s.board.creatures.includes(c)) defeat(s, c, ev);
}

// ---------------------------------------------------------------- active abilities (round 12c)
export const ABILITY_COST: Record<string, number> = { slide: 1, bowl: 2, shockwave: 1, plow: 2, ramMove: 2, shaman: 2, ward: 2, rocket: 0, sacrifice: 0 };
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
    if (has(c, 'bowl') && ok) for (const [dr, dc] of D4) { let r = c.row + dr, cl = c.col + dc, hit = false; while (inBounds(r, cl)) { if (creatureAt(s, r, cl)) hit = true; r += dr; cl += dc; } if (hit) mk('bowl', { dr, dc }); }
    if (has(c, 'shockwave') && ok && adjacentCreatures(s, c).some((o: any) => o.owner !== who)) mk('shockwave', {});
    if (has(c, 'plow') && ok) for (const [dr, dc] of D4) for (let dist = 1; dist <= 7; dist++) { const r = c.row + dr * dist, cl = c.col + dc * dist; if (!inBounds(r, cl) || isStronghold(r, cl) || isSite(s, r, cl)) break; mk('plow', { dr, dc, dist }); }
    if (has(c, 'ramMove') && ok) for (const [dr, dc] of DIRS8) { const e = runLine(s, c, dr, dc); for (let k = 1; k <= e.steps; k++) mk('ramMove', { target: { row: c.row + dr * k, col: c.col + dc * k } }); }
    if (has(c, 'shaman') && !c.hasAttacked && canAct(s, c))
      for (const o of s.board.creatures) if (o !== c && cheb(o, c) <= 5 && !(o.riotShield))
        for (let r = 1; r <= H; r++) for (let cl = 1; cl <= W; cl++) if (cheb({ row: r, col: cl }, c) <= 5 && emptyCell(s, r, cl)) mk('shaman', { from: { row: o.row, col: o.col }, target: { row: r, col: cl } });
    if (has(c, 'rocket') && ok) for (let r = 1; r <= H; r++) for (let cl = 1; cl <= W; cl++) if (emptyCell(s, r, cl)) mk('rocket', { target: { row: r, col: cl } });
    if (has(c, 'ward') && c.wardTurn !== s.turn && canAct(s, c)) for (const o of s.board.creatures) if (o.owner === who && o !== c) mk('ward', { target: { row: o.row, col: o.col } });
    if (has(c, 'sacrifice') && canAct(s, c)) for (const o of s.board.creatures) if (o.owner === who && o !== c) mk('sacrifice', { target: { row: o.row, col: o.col } });
  }
  return out;
}
function blastAround(s: any, c: any, dmg: number, ev: any[]) {
  const foe = other(c.owner);
  for (const o of [...s.board.creatures]) if (o.owner === foe && cheb(o, c) <= 1) dealDamage(s, o, dmg, ev);
  if (!s.winner && cheb(c, stronghold(foe)) <= 1) damageCommander(s, foe, dmg, ev);
}
function runAbility(s: any, l: any, who: Side, ev: any[]) {
  const c = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
  pay(s.players[who], ABILITY_COST[l.ability] || 0);
  const to = (row: number, col: number, teleport = false) => { ev.push({ type: 'move', uid: c.uid, from: { row: c.row, col: c.col }, to: { row, col }, teleport }); c.row = row; c.col = col; };
  ev.push({ type: 'abilityUsed', uid: c.uid, ability: l.ability, row: c.row, col: c.col });
  switch (l.ability) {
    case 'slide':
      to(l.target.row, l.target.col); c.hasAttacked = true;
      blastAround(s, c, CONFIG.kaboomDamage ?? 1, ev);
      c.health = 0; defeat(s, c, ev);
      break;
    case 'bowl': {
      c.hasAttacked = true;
      const line: any[] = [];
      for (let r = c.row + l.dr, cl = c.col + l.dc; inBounds(r, cl); r += l.dr, cl += l.dc) { const o = creatureAt(s, r, cl); if (o) line.push(o); }
      for (const o of line.reverse()) knock(s, o, l.dr, l.dc, rint(s, 1, 2), ev);
      break;
    }
    case 'shockwave':
      c.hasAttacked = true;
      for (const o of adjacentCreatures(s, c)) if (o.owner !== who) { knockAway(s, c, o, 1, ev); dealDamage(s, o, 1, ev); }
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
      blastAround(s, c, atkValue(s, c), ev);
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
  if (card.abilities?.includes('tunnel')) for (let r = 1; r <= H; r++) for (let c = 1; c <= W; c++) if (nearSite(s, r, c)) add(r, c);
  return out;
}

/** Mines `c` can mine this turn (one action: afterwards it can't move or attack). */
export function mineTargets(s: any, c: any): { row: number; col: number }[] {
  if (c.hasMoved || c.hasAttacked || c.hasMined || s.turn < c.lockedUntil) return [];
  if (c.summonedThisTurn && !has(c, 'haste') && !isMiner(CARDS[c.cardId])) return [];
  return s.sites.filter((x: any) => cheb(c, x) <= 1).map((x: any) => ({ row: x.row, col: x.col }));
}

/** Spaces `c` can move to; a space held by one of its own creatures is a swap. */
export function moveDests(s: any, c: any): { row: number; col: number }[] {
  if (s.turn < (c.rootUntil || 0) || c.hasMoved || c.hasAttacked || c.hasMined || s.turn < c.lockedUntil || (c.summonedThisTurn && !has(c, 'haste') && !isMiner(CARDS[c.cardId]))) return [];
  const m = maxMove(c);
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
    default: return [];
  }
}

function autoTarget(s: any, p: Side, card: any) {
  const opts = spellTargets(s, p, card);
  if (!opts.length) return null;
  const score = (o: any) => {
    const t = o.target && o.target.row ? creatureAt(s, o.target.row, o.target.col) : null;
    if (card.effect === 'damage') return t ? t.attack + CARDS[t.cardId].cost : 0.5;
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
      else if (t) dealDamage(s, t, card.params.amount, ev);
      break;
    case 'poison': if (t && t.owner !== p) { t.poison = card.params.turns; ev.push({ type: 'poisoned', uid: t.uid, row: t.row, col: t.col, turns: t.poison }); } break;
    case 'buffAttack': s.flags.battleCry = p; break;
    case 'areaDamage':
      if (target) for (const c of [...s.board.creatures]) if (cheb(c, target) <= 1) dealDamage(s, c, card.params.amount, ev);
      break;
    case 'heal': if (t && t.owner === p) healCreature(s, t, card.params.amount, ev); break;
    case 'shield': if (t && t.owner === p) t.bubble = true; break;
    case 'healCommander': pl.health = Math.min(pl.maxHealth, pl.health + card.params.amount); ev.push({ type: 'heal', commander: p, amount: card.params.amount }); break;
  }
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
function runBrew(s: any, l: any, ev: any[]) {
  const c = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
  const t = creatureAt(s, l.target.row, l.target.col);
  c.brewTurn = s.turn;
  ev.push({ type: 'abilityUsed', uid: c.uid, ability: 'brew', row: c.row, col: c.col });
  healCreature(s, t, CONFIG.brewHeal ?? 3, ev);
  t.brewSave = true;
  t.drunk = CONFIG.drunkRounds ?? 2;
  ev.push({ type: 'drunk', uid: t.uid, row: t.row, col: t.col, rounds: t.drunk });
}

function openWindow(s: any, pend: any, ev: any[]) {
  const responder = other(pend.actor);
  if (respondActions(s, responder, { ...pend, responder }).length || brewActions(s, responder, pend).length) {
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
      const c = spawn(s, actor, pend.card.cardId, pend.row, pend.col, 0, pend.card.uid);
      c.summonedThisTurn = true;
      ev.push({ type: 'summon', uid: c.uid, cardId: c.cardId, owner: actor, row: c.row, col: c.col });
    }
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
export function legalActions(s: any): any[] {
  if (s.phase === 'over' || !s.priority) return [];
  const who: Side = s.priority;
  const pl = s.players[who];
  const out: any[] = [];
  const surrender = { type: 'surrender' };
  if (s.pendingResponse) {
    out.push(...respondActions(s, who, s.pendingResponse), ...crystalPlays(s, who), ...brewActions(s, who, s.pendingResponse), { type: 'pass' }, surrender);
    return out;
  }
  if (s.phase === 'mulligan') {
    if (s.mulliganDone[who]) return [surrender];
    out.push({ type: 'mulligan', uids: [] });
    if ((pl.mulligans || 0) < 3 && pl.hand.length) out.push({ type: 'mulligan', uids: pl.hand.map((h: any) => h.uid) });
    if ((pl.mulligans || 0) < 3) for (const h of pl.hand) out.push({ type: 'mulligan', uids: [h.uid] });
    if ((pl.mulligans || 0) < 3 && pl.hand.length > 1) out.push({ type: 'mulligan', uids: pl.hand.slice(0, 2).map((h: any) => h.uid) });
    out.push(surrender);
    return out;
  }
  if (who !== s.activePlayer) return [surrender];
  const ph = s.phase;
  const seenCards = new Set<string>();
  for (const h of pl.hand) {
    const card = CARDS[h.cardId];
    if (card.type === 'creature' && ph === 'deploy') {
      if (upgradeCard(card) && funds(pl) >= baseCost(s, who, card)) for (const c of s.board.creatures) if (c.owner === who) out.push({ type: 'minerUpgrade', uid: h.uid, creatureUid: c.uid });
      if (!canPayCreature(pl, card.faction, creatureCost(s, who, card))) continue;
      if (card.unique && s.board.creatures.some((c: any) => c.owner === who && c.cardId === card.id)) continue;
      for (const sp of summonSpaces(s, who, card)) out.push({ type: 'summon', uid: h.uid, row: sp.row, col: sp.col });
    } else if (card.type === 'spell' && card.spellKind !== 'counter' && ['deploy', 'action'].includes(ph)) {
      if (funds(pl) < spellCost(s, who, card)) continue;
      for (const o of spellTargets(s, who, card)) out.push({ type: 'cast', uid: h.uid, ...o });
    }
    seenCards.add(h.uid);
  }
  if (ph === 'deploy' || ph === 'action') out.push(...crystalPlays(s, who));
  if (ph === 'action') for (const c of s.board.creatures) if (c.owner === who) for (const d of moveDests(s, c)) out.push({ type: 'move', creatureUid: c.uid, row: d.row, col: d.col });
  if (ph === 'action') for (const c of s.board.creatures) if (c.owner === who) for (const d of mineTargets(s, c)) out.push({ type: 'mine', creatureUid: c.uid, row: d.row, col: d.col });
  if (ph === 'action') for (const x of s.sites) if (readyMinersAt(s, who, x).length) out.push({ type: 'mineAt', row: x.row, col: x.col });
  if (ph === 'action') for (const c of s.board.creatures) if (c.owner === who) for (const t of attackTargets(s, c)) out.push({ type: 'attack', creatureUid: c.uid, target: t });
  if (ph === 'deploy' && !s.flags.swapped && !pl.hand.some((h: any) => isMiner(CARDS[h.cardId])) && pl.deck.some((d: any) => d.cardId === basicGatherer(pl.faction))) {
    if (pl.hand.length) for (const h of pl.hand) out.push({ type: 'gathererSwap', discardUid: h.uid });
    else out.push({ type: 'gathererSwap' });
  }
  if (['deploy', 'action'].includes(ph)) {
    if (ph === 'action') out.push(...abilityActions(s, who));
    out.push(...brewActions(s, who));
    for (const c of s.board.creatures) if (c.owner === who && has(c, 'blink') && !c.blinkUsed && funds(pl) >= 1)
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
  const s = JSON.parse(JSON.stringify(state));
  const a = s.board.creatures.find((x: any) => x.uid === attackerUid);
  if (!a) return null;
  const def = target && target.row ? creatureAt(s, target.row, target.col) : null;
  const ev: any[] = [];
  resolveAttack(s, a, target, ev);
  let youDeal = 0, youTake = 0;
  for (const e of ev) {
    if (e.type !== 'damage') continue;
    if (e.commander) youDeal += e.amount;
    else if (def && e.uid === def.uid) youDeal += e.amount;
    else if (e.uid === a.uid) youTake += e.amount;
  }
  const alive = (u: string) => s.board.creatures.some((x: any) => x.uid === u);
  return { youDeal, youTake, targetDefeated: def ? !alive(def.uid) : s.winner === a.owner, attackerDefeated: !alive(a.uid) };
}

// ---------------------------------------------------------------- apply
const eq = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
const OPTIONAL = new Set(['target', 'to']);
const normalize = (a: any) => a;
function matchLegal(s: any, a: any): any | null {
  if (a.type === 'mulligan') {
    const uids = Array.isArray(a.uids) ? a.uids : null;
    const hand = s.players[s.priority].hand.map((h: any) => h.uid);
    if (!uids || new Set(uids).size !== uids.length || !uids.every((u: string) => hand.includes(u))) return null;
    if (uids.length && (s.players[s.priority].mulligans || 0) >= 3) return null;
    return s.phase === 'mulligan' && !s.pendingResponse && !s.mulliganDone[s.priority] ? a : null;
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
  const act = normalize(action);
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
    runBrew(s, m, ev);
    return { ok: true, state: s, events: ev };
  }
  const l = matchLegal(s, act);
  if (!l) return fail(`Illegal action: ${act.type}`);
  const who: Side = s.priority;
  const pl = s.players[who];
  const hand = (uid: string) => pl.hand.find((h: any) => h.uid === uid);
  const takeHand = (uid: string) => pl.hand.splice(pl.hand.findIndex((h: any) => h.uid === uid), 1)[0];

  switch (act.type) {
    case 'mulligan': {
      const n = act.uids.length;
      const k = (pl.mulligans || 0) + (n ? 1 : 0);
      const back = act.uids.map((u: string) => takeHand(u));
      pl.deck.push(...back);
      if (n) shuffle(s, pl.deck);
      const draw = n && k >= 2 ? n - 1 : n;
      for (let i = 0; i < draw; i++) pl.hand.push(pl.deck.shift());
      pl.mulligans = k;
      ev.push({ type: 'mulligan', player: who, count: n, mulligans: k });
      if (n && k < 3) break;
      s.mulliganDone[who] = true;
      if (who === 'player') s.priority = 'opponent';
      else finishSetup(s, ev);
      break;
    }
    case 'pass': finishPending(s, s.pendingResponse, ev, false); break;
    case 'respond': {
      const pend = s.pendingResponse;
      if (l.crystalUid) playCrystalCard(s, who, takeHand(l.crystalUid), ev);
      const card = CARDS[hand(l.uid).cardId];
      paySpell(pl, pl.faction, spellCost(s, who, card));
      const used = takeHand(l.uid);
      pl.discard.push(used);
      ev.push({ type: 'respond', player: who, cardId: card.id });
      s.pendingResponse = null;
      s.priority = s.activePlayer;
      if (card.spellKind === 'counter') {
        ev.push({ type: 'counter', cardId: card.id, player: who, countered: pend.card ? pend.card.cardId : null, ckind: pend.kind });
        if (card.effect === 'mirror') {
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
      openWindow(s, { kind: 'summon', actor: who, card: h, row: l.row, col: l.col }, ev);
      break;
    }
    case 'cast': {
      const h = takeHand(l.uid);
      const card = CARDS[h.cardId];
      paySpell(pl, pl.faction, spellCost(s, who, card));
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
      const atk = card.role === 'Smith' ? 1 : 0;
      c.upgrades.attack += atk; c.upgrades.health += 1;
      c.attack += atk; c.maxHealth += 1; c.health += 1;
      ev.push({ type: 'minerUpgrade', uid: c.uid, cardId: card.id, attack: atk, health: 1, row: c.row, col: c.col });
      break;
    }
    case 'mineAt': {
      const group = readyMinersAt(s, who, l);
      for (const m of group) { m.hasMined = true; m.minedMine = { row: l.row, col: l.col }; }
      const mc = mineColors(s);
      for (const m of group) ev.push({ type: 'mine', uid: m.uid, row: l.row, col: l.col, amount: yieldAt(s, m, mc, l) });
      break;
    }
    case 'move': {
      const c = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
      const from = { row: c.row, col: c.col };
      const mate = creatureAt(s, l.row, l.col);
      ev.push({ type: 'move', uid: c.uid, from, to: { row: l.row, col: l.col } });
      if (mate) {
        ev.push({ type: 'move', uid: mate.uid, from: { row: mate.row, col: mate.col }, to: from }, { type: 'swap', uid: c.uid, withUid: mate.uid });
        mate.row = from.row; mate.col = from.col;
      }
      c.movedDistance = cheb(c, l);
      c.row = l.row; c.col = l.col; c.hasMoved = true;
      break;
    }
    case 'mine': {
      const c = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
      const amount = yieldAt(s, c, mineColors(s), l);
      c.hasMined = true; c.minedMine = { row: l.row, col: l.col };
      ev.push({ type: 'mine', uid: c.uid, row: l.row, col: l.col, amount });
      break;
    }
    case 'attack': {
      const a = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
      if (l.target.row) {
        const tgt = creatureAt(s, l.target.row, l.target.col);
        const resp = other(who);
        if (respondActions(s, resp, { kind: 'attack', actor: who, target: l.target }).length) {
          s.pendingResponse = { kind: 'attack', actor: who, creatureUid: a.uid, target: l.target, responder: resp };
          s.priority = resp;
          void tgt;
          break;
        }
      }
      resolveAttack(s, a, l.target, ev);
      break;
    }
    case 'ability': {
      if (l.ability !== 'blink') { runAbility(s, l, who, ev); break; }
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
      if (l.discardUid) pl.discard.push(takeHand(l.discardUid));
      const idx = pl.deck.findIndex((d: any) => d.cardId === basicGatherer(pl.faction));
      const g = pl.deck.splice(idx, 1)[0];
      pl.hand.push(g);
      s.flags.swapped = true;
      ev.push({ type: 'gathererSwap', player: who, uid: g.uid, cardId: g.cardId });
      break;
    }
    case 'done': {
      if (s.phase === 'deploy') s.phase = 'action';
      else endTurn(s, ev);
      ev.push({ type: 'phase', phase: s.phase });
      break;
    }
  }
  recomputeSites(s, ev);
  return { ok: true, state: s, events: ev };
}

import tutorialJson from '../content/tutorial.json';
const tutorialGifts = () => (tutorialJson as any).gifts || {};
const TUTORIAL_ORDER = ['summon', 'move', 'mine', 'mineTap', 'spend', 'crystal', 'upgrade', 'swap', 'fight', 'spell', 'savings', 'commander', 'complete'];
function advanceTutorial(s: any, act: any, actor: Side, events: any[]) {
  const t = s.tutorial;
  if (!t || t.step === 'complete') return;
  const did = t.did || (t.did = {});
  const gifts: any = tutorialGifts();
  const enter = (step: string) => {
    t.step = step;
    const g = gifts[step];
    if (g) {
      const pl = s.players.player;
      if (g.bank != null) pl.bank = Math.max(pl.bank, g.bank);
      if (g.flow != null) pl.crystals = Math.max(pl.crystals, g.flow);
    }
  };
  const next = () => {
    enter(TUTORIAL_ORDER[TUTORIAL_ORDER.indexOf(t.step) + 1]);
    // out-of-order moves already made are not asked for twice
    while (did[t.step] && !['complete', 'commander', 'savings'].includes(t.step)) enter(TUTORIAL_ORDER[TUTORIAL_ORDER.indexOf(t.step) + 1]);
  };
  const mine = actor === 'player';
  const swapped = events.some((e: any) => e.type === 'swap');
  if (mine && TUTORIAL_ORDER.indexOf(t.step) >= TUTORIAL_ORDER.indexOf('mineTap')) {
    if (['summon', 'cast'].includes(act.type)) did.spend = true;
    if (act.type === 'playCrystal') did.crystal = true;
    if (act.type === 'minerUpgrade') did.upgrade = true;
    if (swapped) did.swap = true;
    if (act.type === 'attack' && act.target && act.target.row) did.fight = true;
    if (act.type === 'cast') did.spell = true;
  }
  switch (t.step) {
    case 'summon': if (mine && act.type === 'summon') next(); break;
    case 'move': if (mine && act.type === 'move') next(); break;
    case 'mine': if (mine && act.type === 'mine') next(); break;
    case 'mineTap': if (mine && act.type === 'mineAt') next(); break;
    case 'spend': if (mine && ['summon', 'cast'].includes(act.type)) next(); break;
    case 'crystal': if (mine && act.type === 'playCrystal') next(); break;
    case 'upgrade': if (mine && act.type === 'minerUpgrade') next(); break;
    case 'swap': if (mine && swapped) next(); break;
    case 'fight': if (mine && act.type === 'attack' && act.target && act.target.row) next(); break;
    case 'spell': if (mine && act.type === 'cast') next(); break;
    case 'savings': if (events.some((e: any) => e.type === 'savings' && e.player === 'player')) next(); break;
    case 'commander': if (s.winner === 'player') next(); break;
  }
}

const dist2 = (a: any, b: any) => (a.row - b.row) ** 2 + (a.col - b.col) ** 2;
/** A legal action that makes progress on the current tutorial step; { type: 'done' } when the phase must end; null when complete. */
export function tutorialAction(s: any): any | null {
  if (!s.tutorial || s.tutorial.step === 'complete' || s.phase === 'over') return null;
  if (s.pendingResponse) return { type: 'pass' };
  const legal = legalActions(s);
  const step = s.tutorial.step;
  const pl = s.players.player;
  const cardOfUid = (uid: string) => CARDS[pl.hand.find((h: any) => h.uid === uid)?.cardId];
  const first = (f: (a: any) => boolean) => legal.find(f);
  const mineSpots = s.sites;
  const nearestMine = (p: any) => Math.min(...mineSpots.map((m: any) => dist2(p, m)));
  const enemySh = stronghold('opponent');
  let a: any;
  switch (step) {
    case 'summon': {
      const opts = legal.filter((x: any) => x.type === 'summon' && isMiner(cardOfUid(x.uid)));
      a = opts.sort((x: any, y: any) => nearestMine(x) - nearestMine(y))[0];
      break;
    }
    case 'move': {
      const isM = (x: any) => isMiner(CARDS[s.board.creatures.find((o: any) => o.uid === x.creatureUid).cardId]);
      const opts = legal.filter((x: any) => x.type === 'move' && !creatureAt(s, x.row, x.col) && isM(x));
      a = opts.sort((x: any, y: any) => nearestMine(x) - nearestMine(y))[0];
      break;
    }
    case 'mine': a = first((x: any) => x.type === 'mine' && isMiner(CARDS[s.board.creatures.find((o: any) => o.uid === x.creatureUid).cardId])); break;
    case 'mineTap': a = first((x: any) => x.type === 'mineAt'); break;
    case 'spend': {
      const opts = legal.filter((x: any) => x.type === 'summon');
      a = opts.sort((x: any, y: any) => cardOfUid(x.uid).cost - cardOfUid(y.uid).cost || nearestMine(x) - nearestMine(y))[0];
      break;
    }
    case 'crystal': a = first((x: any) => x.type === 'playCrystal'); break;
    case 'upgrade': a = first((x: any) => x.type === 'minerUpgrade'); break;
    case 'swap': a = first((x: any) => x.type === 'move' && creatureAt(s, x.row, x.col)); break;
    case 'fight': {
      a = first((x: any) => x.type === 'attack' && x.target.row);
      if (!a) a = stepToward(s, legal, (c: any) => s.board.creatures.filter((o: any) => o.owner === 'opponent').reduce((m: number, o: any) => Math.min(m, dist2(c, o)), 1e9));
      break;
    }
    case 'spell': {
      const casts = legal.filter((x: any) => x.type === 'cast');
      a = casts.find((x: any) => x.row) || casts[0];
      break;
    }
    case 'commander': {
      a = first((x: any) => x.type === 'attack' && x.target.commander);
      if (!a) a = first((x: any) => x.type === 'attack');
      if (!a) a = stepToward(s, legal, (c: any) => dist2(c, enemySh));
      break;
    }
  }
  return a || { type: 'done' };
}
function stepToward(s: any, legal: any[], score: (c: any) => number) {
  let best: any = null, bv = 1e9;
  for (const x of legal) {
    if (x.type !== 'move' || creatureAt(s, x.row, x.col)) continue;
    const c = s.board.creatures.find((o: any) => o.uid === x.creatureUid);
    if (isMiner(CARDS[c.cardId])) continue;
    const v = score({ row: x.row, col: x.col }) - score(c);
    if (v < bv) { bv = v; best = x; }
  }
  return bv < 0 ? best : null;
}

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

export function applyAction(state: any, action: any): { ok: boolean; state: any; events: any[]; error?: string } {
  const actor: Side = state && state.priority;
  const r = applyActionInner(state, action);
  if (r.ok) trackStats(r.state, r.events);
  if (r.ok && r.state.tutorial) { advanceTutorial(r.state, action, actor, r.events); if (r.state.winner === 'player') r.state.tutorial.step = 'complete'; }
  return r;
}

/** True when a creature has acted this turn, or cannot act yet (shown darker in the UI). */
export function isActed(s: any, c: any): boolean {
  return c.hasMoved || c.hasAttacked || c.hasMined || (c.summonedThisTurn && !has(c, 'haste') && !isMiner(CARDS[c.cardId])) || s.turn < c.lockedUntil;
}
