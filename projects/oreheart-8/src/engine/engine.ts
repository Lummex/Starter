// Oreheart rules engine. Pure: no DOM, no timers, no Math.random. State is plain JSON data.
import { CARDS, COMMANDERS, FACTIONS, STARTER_DECKS, CONFIG, COLOR_ORDER } from './content';
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
    upgrades: { attack: 0, health: 0 }, summonedThisTurn: false, hasMoved: false, hasAttacked: false, hasMined: false, minedMine: null as any, movedDistance: 0, lockedUntil: 0, blinkUsed: false, shield: 0, bubble: false, ale: 0,
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
const ALL_COLORS = ['green', 'blue', 'purple', 'white'];
const sum = (st: any) => st.green + st.blue + st.purple + st.white;
const total = (pl: any) => sum(pl.crystals);
/** Flow + Bank: what a spell can spend. */
export const funds = (pl: any) => sum(pl.crystals) + sum(pl.bank || { green: 0, blue: 0, purple: 0, white: 0 });
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
  !canPayCreature(s.players[p], card.faction, baseCost(s, p, card));
export function creatureCost(s: any, p: Side, card: any) {
  return goesFree(s, p, card) ? 0 : baseCost(s, p, card);
}
export function spellCost(s: any, p: Side, card: any) {
  const d = bonusOf(s, p, 'spellDiscount');
  return d ? Math.max(1, card.cost - d.amount) : card.cost;
}
/** Off-color crystals in payment order: white, then green/blue/purple skipping the own color. */
const offOrder = (faction: string) => ['white'].concat(COLOR_ORDER.filter((c) => c !== faction));
const flowValue = (st: any, fc: string) => st[fc] + Math.floor((sum(st) - st[fc]) / 2);
/** Crystals toward a creature: own color 1 each, everything else ½ each (rounded down in total), Flow and Bank together. */
export function creatureValue(pl: any, faction: string) {
  const fc = FACTIONS[faction].crystal;
  const bank = pl.bank || { green: 0, blue: 0, purple: 0, white: 0 };
  const own = pl.crystals[fc] + bank[fc];
  return own + Math.floor((total(pl) + sum(bank) - own) / 2);
}
export const canPayCreature = (pl: any, faction: string, cost: number) => creatureValue(pl, faction) >= cost;
function spendOff(st: any, fc: string, n: number) {
  for (const col of offOrder(fc)) {
    const t = Math.min(st[col], n);
    st[col] -= t;
    n -= t;
  }
}
/** Pays from Flow first; only if Flow alone can't cover it, all usable Flow goes and the rest comes from Bank. */
function payCreature(pl: any, faction: string, cost: number) {
  const fc = FACTIONS[faction].crystal;
  const f = pl.crystals;
  if (flowValue(f, fc) >= cost) {
    const own = Math.min(f[fc], cost);
    f[fc] -= own;
    spendOff(f, fc, (cost - own) * 2);
    return;
  }
  const offF = sum(f) - f[fc];
  let rem = cost - f[fc] - Math.floor(offF / 2);
  f[fc] = 0;
  spendOff(f, fc, Math.floor(offF / 2) * 2);
  const ownB = Math.min(pl.bank[fc], rem);
  pl.bank[fc] -= ownB;
  rem -= ownB;
  if (rem > 0) {
    let need = rem * 2;
    if (offF % 2 === 1) { spendOff(f, fc, 1); need -= 1; }
    spendOff(pl.bank, fc, need);
  }
}
/** Spells take any color at full value: Flow first, then Bank; white first, then off-colors, then the own color. */
function paySpell(pl: any, faction: string, cost: number) {
  const order = offOrder(FACTIONS[faction].crystal).concat(FACTIONS[faction].crystal);
  let left = cost;
  for (const st of [pl.crystals, pl.bank]) for (const col of order) {
    const t = Math.min(st[col], left);
    st[col] -= t;
    left -= t;
  }
}
/** Pool cap: excess comes off white first, then off-colors, then the own color. */
function capPool(pl: any, faction: string) {
  const fc = FACTIONS[faction].crystal;
  let over = total(pl) - CONFIG.poolCap;
  for (const col of offOrder(fc).concat(fc)) {
    if (over <= 0) break;
    const t = Math.min(pl.crystals[col], over);
    pl.crystals[col] -= t;
    over -= t;
  }
}
const gain = (s: any, p: Side, color: string, n: number) => {
  const pl = s.players[p];
  pl.crystals[color] += n;
  capPool(pl, pl.faction);
};

// ---------------------------------------------------------------- mines
/** Legal layout: 3 mines in rows 3-5, mirrored between halves, at least 2 apart (Chebyshev), on the board. */
export function legalMines(m: any): boolean {
  if (!Array.isArray(m) || m.length !== CONFIG.mineCount) return false;
  for (const x of m) if (!x || !Number.isInteger(x.row) || !Number.isInteger(x.col) || x.row < 3 || x.row > 5 || x.col < 1 || x.col > W) return false;
  for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) if (cheb(m[i], m[j]) < 2) return false;
  for (const x of m) {
    if (x.row === 4) continue;
    if (!m.some((y: any) => y.col === x.col && y.row === 8 - x.row)) return false;
  }
  return true;
}
function randomMines(seed: number) {
  const r = { rng: (seed ^ 0x2f6e2b1) | 0 };
  for (let tries = 0; tries < 1000; tries++) {
    const pick = () => 1 + Math.floor(nextRand(r) * W);
    let m: any[];
    if (nextRand(r) < 0.6) { const c = pick(); m = [{ row: 3, col: c }, { row: 5, col: c }, { row: 4, col: pick() }]; }
    else m = [{ row: 4, col: pick() }, { row: 4, col: pick() }, { row: 4, col: pick() }];
    if (legalMines(m)) return m;
  }
  return [{ row: 3, col: 3 }, { row: 5, col: 3 }, { row: 4, col: 9 }];
}
const sortMines = (m: any[]) => m.map((x) => ({ row: x.row, col: x.col })).sort((a, b) => a.row - b.row || a.col - b.col);
const emptyFlow = () => ({ green: 0, blue: 0, purple: 0, white: 0 });

// ---------------------------------------------------------------- creation
export function createMatch(opts: any = {}) {
  const pcmd = COMMANDERS[opts.playerCommander ?? 'grubnak'];
  const ocmd = COMMANDERS[opts.opponentCommander ?? 'sproingle'];
  const s: any = {
    turn: 0, activePlayer: 'player', priority: 'player', phase: 'mulligan', winner: null,
    players: {}, board: { creatures: [] },
    sites: [] as any[],
    pendingResponse: null, rng: (opts.seed ?? 1) | 0, nextUid: 1, firstPlayer: null, firstPlayerOption: opts.firstPlayer ?? null,
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
      commanderId: cmd.id, faction: cmd.faction, health: cmd.health, maxHealth: cmd.health,
      crystals: { green: 0, blue: 0, purple: 0, white: 0 }, bank: { green: 0, blue: 0, purple: 0, white: 0 }, flow: { green: 0, blue: 0, purple: 0, white: 0 }, hand: [], deck: [], discard: [], geodes: 0, minedLastTurn: 0,
    };
  });
  for (const who of ['player', 'opponent'] as Side[]) {
    const pl = s.players[who];
    const given = setup && setup[who + 'Deck'];
    if (given) pl.deck = given.map((id: string) => makeCard(s, id));
    else pl.deck = shuffle(s, STARTER_DECKS[pl.faction].map((id: string) => makeCard(s, id)));
  }
  if (!setup) {
    for (const who of ['player', 'opponent'] as Side[]) {
      const pl = s.players[who];
      pl.crystals[colorOf(s, who)] = CONFIG.startingCrystals;
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
    const cr = setup[who + 'Crystals'] || {};
    pl.crystals = { green: cr.green || 0, blue: cr.blue || 0, purple: cr.purple || 0, white: cr.white || 0 };
    const bk = setup[who + 'Bank'] || {};
    pl.bank = { green: bk.green || 0, blue: bk.blue || 0, purple: bk.purple || 0, white: bk.white || 0 };
    const h = setup[who + 'Health'];
    if (h != null) { pl.health = h; if (h > pl.maxHealth) pl.maxHealth = h; }
  }
  for (const b of setup.board || []) {
    const c = spawn(s, b.owner, b.cardId, b.row, b.col, b.damage || 0); c.shield = b.shield || 0;
    if (b.minedMine) { c.minedMine = { row: b.minedMine.row, col: b.minedMine.col }; }
    if (b.summonedThisTurn) c.summonedThisTurn = true;
  }
  s.mulliganDone = { player: true, opponent: true };
  s.firstPlayer = setup.firstPlayer || 'player';
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
const yieldOf = (c: any) => (isMiner(CARDS[c.cardId]) ? CONFIG.gathererFlow : CONFIG.fighterFlow);
/** Colors each mine would have from the creatures that mined it right now. */
function mineColors(s: any) {
  return s.sites.map((site: any) => {
    const n = { player: 0, opponent: 0 };
    for (const c of miningNow(s)) if (c.minedMine.row === site.row && c.minedMine.col === site.col) n[c.owner as Side]++;
    const ctl: Side | null = n.player > n.opponent ? 'player' : n.opponent > n.player ? 'opponent' : null;
    return { ctl, color: ctl ? colorOf(s, ctl) : 'white', n };
  });
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

/** Mining payout `who` would get if their Draw phase happened now (colors recomputed from current miners). */
function payout(s: any, who: Side) {
  const mc = mineColors(s);
  const out = emptyFlow();
  let mined = 0;
  for (const c of miningNow(s, who)) {
    const i = s.sites.findIndex((x: any) => x.row === c.minedMine.row && x.col === c.minedMine.col);
    if (i < 0) continue;
    out[mc[i].color as keyof typeof out] += yieldOf(c);
    mined += yieldOf(c);
  }
  return { out, mined, mc };
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
    if (site) site.flow[c.owner as Side] += yieldOf(c);
  }
  for (const who of ['player', 'opponent'] as Side[]) {
    const f = payout(s, who).out;
    f[colorOf(s, who) as keyof typeof f] += s.players[who].geodes * CONFIG.geodeIncome;
    s.players[who].flow = f;
  }
}

/** Underdog bonus applies when no mine is in the player's color and at least one is in the enemy's color. */
const underdog = (colors: any[], s: any, who: Side) => !colors.some((x) => x.ctl === who) && colors.some((x) => x.ctl === other(who));

/** Pool `who` gets at the start of their next turn if the board stayed as it is now (mining + Geodes + underdog, capped). */
export function nextPool(s: any, who: Side) {
  const pl = s.players[who];
  const { out, mc } = payout(s, who);
  out[colorOf(s, who) as keyof typeof out] += pl.geodes * CONFIG.geodeIncome;
  if (underdog(mc, s, who)) out[colorOf(s, who) as keyof typeof out] += CONFIG.underdogBonus;
  const tmp = { crystals: out };
  capPool(tmp, pl.faction);
  return tmp.crystals;
}

/** Total crystals `who` would have at the start of their next turn (the "+N next turn" number). */
export function incomePreview(s: any, who: Side) {
  const c = nextPool(s, who);
  return c.green + c.blue + c.purple + c.white;
}

/** What a mine makes for its controller's side per turn (that side's flow at the mine). */
export function sitePays(s: any, site: any) {
  return site.controller ? site.flow[site.controller] : 0;
}

function collectIncome(s: any, who: Side, ev: any[]) {
  const pl = s.players[who];
  pl.minedLastTurn = payout(s, who).mined;
  pl.crystals = nextPool(s, who);
  for (const c of s.board.creatures) if (c.owner === who) { c.minedMine = null; c.hasMined = false; }
  ev.push({ type: 'income', player: who, amount: total(pl), crystals: { ...pl.crystals } });
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
    if (c.health < c.maxHealth) healCreature(s, c, c.maxHealth - c.health, ev);
    c.health = c.maxHealth;
    c.shield = 0;
  }
  for (const c of [...s.board.creatures]) {
    if (c.owner !== who) continue;
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
  for (const c of s.board.creatures) c.bubble = false;
  ev.push({ type: 'turnEnd', player: s.activePlayer });
  startTurn(s, ev);
}

// ---------------------------------------------------------------- damage
function healCreature(s: any, c: any, n: number, ev: any[]) {
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
  if (!raw) {
    if (has(c, 'armored')) d = Math.max(0, d - 1);
    if (has(c, 'unbreakable')) d = Math.min(d, 3);
    if (c.bubble && d > 0) { c.bubble = false; d = 0; ev.push({ type: 'shieldBlock', uid: c.uid, row: c.row, col: c.col }); }
    if (c.shield > 0 && d > 0) { const b = Math.min(c.shield, d); c.shield -= b; d -= b; ev.push({ type: 'shieldBlock', uid: c.uid, row: c.row, col: c.col, amount: b }); }
  }
  c.health -= d;
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
  s.players[c.owner].discard.push({ uid: c.uid, cardId: c.cardId });
  ev.push({ type: 'defeat', uid: c.uid, cardId: c.cardId, owner: c.owner, row: c.row, col: c.col });
  if (has(c, 'kaboom')) {
    for (const o of [...s.board.creatures]) if (o.owner !== c.owner && cheb(o, c) === 1) dealDamage(s, o, CONFIG.kaboomDamage, ev);
  }
}

// ---------------------------------------------------------------- combat
const ADV = (a: string, d: string) => FACTIONS[a]?.beats === d;
export function atkValue(s: any, c: any, target?: any) {
  const card = CARDS[c.cardId];
  let v = c.attack;
  if (has(c, 'frenzy') && s.board.creatures.some((o: any) => o !== c && o.owner === c.owner && CARDS[o.cardId].faction === 'goblins' && cheb(o, c) === 1)) v += CONFIG.frenzyBonus;
  if (card.faction === 'goblins' && s.board.creatures.some((o: any) => o.owner === c.owner && has(o, 'rally'))) v += CONFIG.rallyBonus;
  if (has(c, 'rage') && c.health * 2 < c.maxHealth) v += CONFIG.rageBonus;
  if (s.flags.battleCry === c.owner) v += 1;
  if (target && ADV(card.faction, CARDS[target.cardId].faction)) v += CONFIG.typeAdvantageBonus;
  return Math.max(0, v);
}

const canAct = (s: any, c: any) => (!c.summonedThisTurn || has(c, 'haste')) && s.turn >= c.lockedUntil;

export function attackTargets(s: any, c: any): any[] {
  if (c.hasAttacked || c.hasMined || !canAct(s, c) || (c.hasMoved && !has(c, 'charge'))) return [];
  const enemy = other(c.owner);
  const sh = stronghold(enemy);
  const out: any[] = [];
  if (has(c, 'ranged')) {
    // any enemy within Chebyshev distance 2, over creatures; Guard only affects melee
    for (const o of s.board.creatures) if (o.owner === enemy && cheb(o, c) <= 2) out.push({ row: o.row, col: o.col });
    if (cheb(c, sh) <= 2) out.push({ commander: enemy });
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
  const strikes = melee && !has(attacker, 'sneaky');
  const back = strikes ? atkValue(s, def, attacker) : 0;
  hurt(s, def, atkValue(s, attacker, def), ev);
  if (strikes) { ev.push({ type: 'counter', uid: def.uid }); hurt(s, attacker, back, ev); }
  if (has(attacker, 'overload'))
    for (const o of [...s.board.creatures]) if (o.owner === def.owner && o !== def && cheb(o, pos) === 1) hurt(s, o, CONFIG.overloadDamage, ev);
  for (const c of [def, attacker, ...s.board.creatures]) if (c.health <= 0 && s.board.creatures.includes(c)) defeat(s, c, ev);
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
  if (card.abilities?.includes('tunnel') && sitesControlled(s, other(p)) > sitesControlled(s, p)) for (let r = 1; r <= H; r++) for (let c = 1; c <= W; c++) if (nearSite(s, r, c)) add(r, c);
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
  if (c.hasMoved || c.hasAttacked || c.hasMined || s.turn < c.lockedUntil || (c.summonedThisTurn && !has(c, 'haste') && !isMiner(CARDS[c.cardId]))) return [];
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

/** All target options for casting `card` as `p`. `[{}]` = castable with no target; `[]` = not castable. */
export function spellTargets(s: any, p: Side, card: any): any[] {
  const own = s.board.creatures.filter((c: any) => c.owner === p);
  const foe = s.board.creatures.filter((c: any) => c.owner !== p);
  const pos = (c: any) => ({ row: c.row, col: c.col });
  switch (card.effect) {
    case 'gainCrystals': return card.params.needFewerSites && sitesControlled(s, p) >= sitesControlled(s, other(p)) ? [] : [{}];
    case 'tunnelMove': {
      const cells = tunnelCells(s);
      return own.flatMap((c: any) => cells.map((to: any) => ({ target: pos(c), to })));
    }
    case 'damage': return [...foe.map((c: any) => ({ target: pos(c) })), { target: { commander: other(p) } }];
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
    case 'gainCrystals': gain(s, p, colorOf(s, p), card.params.amount); break;
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
const crystalOk = (s: any, p: Side) => s.flags.crystalsPlayed[p] < CONFIG.crystalCardsPerTurn || hasEater(s, p);
/** Crystals a Crystal card adds to the Bank right now (Geode adds none). */
const crystalAmount = (card: any) => (['gain', 'chooseColors', 'motherlode'].includes(card.effect) ? card.params.amount : 0);

/** Instants in the responder's hand whose effect could apply to `pend`, affordable or not. */
export function respondMatches(s: any, responder: Side, pend: any): { h: any; card: any; opts: any[] }[] {
  const out: any[] = [];
  const pl = s.players[responder];
  const pt = pendingTargetCreature(s, pend);
  for (const h of pl.hand) {
    const card = CARDS[h.cardId];
    if (card.type !== 'spell' || card.spellKind === 'regular') continue;
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

function openWindow(s: any, pend: any, ev: any[]) {
  const responder = other(pend.actor);
  if (respondMatches(s, responder, { ...pend, responder }).length) {
    s.pendingResponse = { ...pend, responder };
    s.priority = responder;
  } else finishPending(s, pend, ev, false);
}

function finishPending(s: any, pend: any, ev: any[], cancelled: boolean) {
  s.pendingResponse = null;
  s.priority = s.activePlayer;
  const actor: Side = pend.actor;
  if (pend.kind === 'summon') {
    if (cancelled) s.players[actor].hand.push(pend.card);
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

function heartCombos() {
  const n = CARDS['heart-of-the-fallen'].params.amount;
  const out: any[] = [];
  for (let g = 0; g <= n; g++) for (let b = 0; g + b <= n; b++) for (let p = 0; g + b + p <= n; p++) out.push({ green: g, blue: b, purple: p, white: n - g - b - p });
  return out;
}

function crystalPlays(s: any, who: Side): any[] {
  const pl = s.players[who];
  const out: any[] = [];
  if (!crystalOk(s, who)) return out;
  for (const h of pl.hand) {
    const card = CARDS[h.cardId];
    if (card.type !== 'crystal') continue;
    if (card.effect === 'geode' && pl.geodes >= 1) continue;
    if (card.effect === 'chooseColors') for (const colors of heartCombos()) out.push({ type: 'playCrystal', uid: h.uid, colors });
    else out.push({ type: 'playCrystal', uid: h.uid });
  }
  return out;
}

export function legalActions(s: any): any[] {
  if (s.phase === 'over' || !s.priority) return [];
  const who: Side = s.priority;
  const pl = s.players[who];
  const out: any[] = [];
  const surrender = { type: 'surrender' };
  if (s.pendingResponse) {
    out.push(...respondActions(s, who, s.pendingResponse), ...crystalPlays(s, who), { type: 'pass' }, surrender);
    return out;
  }
  if (s.phase === 'mulligan') {
    if (s.mulliganDone[who]) return [surrender];
    out.push({ type: 'mulligan', uids: [] }, { type: 'mulligan', uids: pl.hand.map((h: any) => h.uid) });
    for (const h of pl.hand) out.push({ type: 'mulligan', uids: [h.uid] });
    out.push(surrender);
    return out;
  }
  if (who !== s.activePlayer) return [surrender];
  const ph = s.phase;
  const seenCards = new Set<string>();
  for (const h of pl.hand) {
    const card = CARDS[h.cardId];
    if (card.type === 'creature' && ph === 'deploy') {
      if (!canPayCreature(pl, card.faction, creatureCost(s, who, card))) continue;
      if (card.unique && s.board.creatures.some((c: any) => c.owner === who && c.cardId === card.id)) continue;
      for (const sp of summonSpaces(s, who, card)) out.push({ type: 'summon', uid: h.uid, row: sp.row, col: sp.col });
      if (card.role === 'Smith') for (const c of s.board.creatures) if (c.owner === who) for (const stat of ['attack', 'health']) out.push({ type: 'smith', uid: h.uid, creatureUid: c.uid, stat });
    } else if (card.type === 'spell' && card.spellKind !== 'counter' && ['deploy', 'action'].includes(ph)) {
      if (funds(pl) < spellCost(s, who, card)) continue;
      for (const o of spellTargets(s, who, card)) out.push({ type: 'cast', uid: h.uid, ...o });
    }
    seenCards.add(h.uid);
  }
  if (ph === 'deploy') out.push(...crystalPlays(s, who));
  if (ph === 'action') for (const c of s.board.creatures) if (c.owner === who) for (const d of moveDests(s, c)) out.push({ type: 'move', creatureUid: c.uid, row: d.row, col: d.col });
  if (ph === 'action') for (const c of s.board.creatures) if (c.owner === who) for (const d of mineTargets(s, c)) out.push({ type: 'mine', creatureUid: c.uid, row: d.row, col: d.col });
  if (ph === 'action') for (const c of s.board.creatures) if (c.owner === who) for (const t of attackTargets(s, c)) out.push({ type: 'attack', creatureUid: c.uid, target: t });
  if (ph === 'deploy' && !s.flags.swapped && !pl.hand.some((h: any) => isMiner(CARDS[h.cardId])) && pl.deck.some((d: any) => d.cardId === basicGatherer(pl.faction))) {
    if (pl.hand.length) for (const h of pl.hand) out.push({ type: 'gathererSwap', discardUid: h.uid });
    else out.push({ type: 'gathererSwap' });
  }
  if (['deploy', 'action'].includes(ph)) {
    for (const c of s.board.creatures) if (c.owner === who && has(c, 'blink') && !c.blinkUsed)
      for (const o of s.board.creatures) if (o !== c && o.owner === who) out.push({ type: 'ability', creatureUid: c.uid, ability: 'blink', target: { row: o.row, col: o.col } });
    out.push({ type: 'done' });
  }
  out.push(surrender);
  return out;
}

/** True if the priority player has a real move left (ignores done, surrender, upgrades, Gatherer swap and Instants). */
export function hasMovesLeft(s: any): boolean {
  if (s.phase === 'over' || !s.priority || s.pendingResponse || !['deploy', 'action'].includes(s.phase) || s.priority !== s.activePlayer) return false;
  const pl = s.players[s.priority];
  return legalActions(s).some((a: any) => {
    if (['done', 'surrender', 'smith', 'gathererSwap', 'pass', 'respond'].includes(a.type)) return false;
    if (a.type === 'cast') {
      const h = pl.hand.find((x: any) => x.uid === a.uid);
      return !h || CARDS[h.cardId].spellKind === 'regular';
    }
    return true;
  });
}

// ---------------------------------------------------------------- apply
const eq = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
const OPTIONAL = new Set(['target', 'to', 'colors']);
function normalize(a: any) {
  if (a && a.type === 'playCrystal' && Array.isArray(a.colors)) {
    const colors = { green: 0, blue: 0, purple: 0, white: 0 };
    for (const c of a.colors) if (c in colors) (colors as any)[c]++;
    return { ...a, colors };
  }
  if (a && a.type === 'playCrystal' && a.colors) return { ...a, colors: { green: a.colors.green || 0, blue: a.colors.blue || 0, purple: a.colors.purple || 0, white: a.colors.white || 0 } };
  return a;
}
function matchLegal(s: any, a: any): any | null {
  if (a.type === 'mulligan') {
    const uids = Array.isArray(a.uids) ? a.uids : null;
    const hand = s.players[s.priority].hand.map((h: any) => h.uid);
    if (!uids || new Set(uids).size !== uids.length || !uids.every((u: string) => hand.includes(u))) return null;
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

function playCrystalCard(s: any, who: Side, h: any, colors: any, ev: any[]) {
  const pl = s.players[who];
  const card = CARDS[h.cardId];
  const fc = colorOf(s, who);
  if (s.flags.crystalsPlayed[who] >= CONFIG.crystalCardsPerTurn) {
    for (const c of [...s.board.creatures]) {
      if (c.owner !== who) continue;
      if (has(c, 'eaterGuzzler')) dealDamage(s, c, CONFIG.eaterGuzzlerDamage, ev, true);
      else if (has(c, 'eaterConduit')) { c.lockedUntil = s.turn + 2; dealDamage(s, c, CONFIG.eaterConduitDamage, ev, true); }
      else if (has(c, 'eaterDelver')) c.attack = Math.max(0, c.attack - CONFIG.eaterDelverPenalty);
    }
  }
  s.flags.crystalsPlayed[who]++;
  pl.discard.push(h);
  // Crystal cards fill the Bank: it never resets and has no cap
  if (card.effect === 'gain') pl.bank[fc] += card.params.amount;
  else if (card.effect === 'geode') pl.geodes++;
  else if (card.effect === 'motherlode') { pl.bank[fc] += card.params.amount; s.flags.discount[who] += card.params.discount; }
  else if (card.effect === 'chooseColors') {
    const cols = colors || { [fc]: card.params.amount };
    for (const k of ALL_COLORS) pl.bank[k] += cols[k] || 0;
  }
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
  const l = matchLegal(s, act);
  if (!l) return fail(`Illegal action: ${act.type}`);
  const who: Side = s.priority;
  const pl = s.players[who];
  const hand = (uid: string) => pl.hand.find((h: any) => h.uid === uid);
  const takeHand = (uid: string) => pl.hand.splice(pl.hand.findIndex((h: any) => h.uid === uid), 1)[0];

  switch (act.type) {
    case 'mulligan': {
      const n = act.uids.length;
      const back = act.uids.map((u: string) => takeHand(u));
      pl.deck.push(...back);
      if (n) shuffle(s, pl.deck);
      for (let i = 0; i < n; i++) pl.hand.push(pl.deck.shift());
      s.mulliganDone[who] = true;
      ev.push({ type: 'mulligan', player: who, count: n });
      if (who === 'player') s.priority = 'opponent';
      else finishSetup(s, ev);
      break;
    }
    case 'pass': finishPending(s, s.pendingResponse, ev, false); break;
    case 'respond': {
      const pend = s.pendingResponse;
      if (l.crystalUid) playCrystalCard(s, who, takeHand(l.crystalUid), null, ev);
      const card = CARDS[hand(l.uid).cardId];
      paySpell(pl, pl.faction, spellCost(s, who, card));
      const used = takeHand(l.uid);
      pl.discard.push(used);
      ev.push({ type: 'respond', player: who, cardId: card.id });
      s.pendingResponse = null;
      s.priority = s.activePlayer;
      if (card.spellKind === 'counter') {
        ev.push({ type: 'counter', cardId: card.id, player: who });
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
      openWindow(s, { kind: 'cast', actor: who, card: h, target: l.target || null, to: l.to || null }, ev);
      break;
    }
    case 'playCrystal': {
      playCrystalCard(s, who, takeHand(l.uid), act.colors, ev);
      break;
    }
    case 'smith': {
      const h = takeHand(l.uid);
      const card = CARDS[h.cardId];
      const c = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
      payCreature(pl, card.faction, creatureCost(s, who, card));
      if (s.flags.discount[who]) s.flags.discount[who] = 0;
      pl.discard.push(h);
      c.upgrades[l.stat]++;
      if (l.stat === 'attack') c.attack += 1;
      else { c.maxHealth += 1; c.health += 1; }
      ev.push({ type: 'smith', uid: c.uid, stat: l.stat, row: c.row, col: c.col });
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
      c.hasMined = true; c.minedMine = { row: l.row, col: l.col };
      ev.push({ type: 'mine', uid: c.uid, row: l.row, col: l.col, amount: yieldOf(c) });
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
      const a = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
      const b = creatureAt(s, l.target.row, l.target.col);
      const pa = { row: a.row, col: a.col }, pb = { row: b.row, col: b.col };
      a.row = pb.row; a.col = pb.col; b.row = pa.row; b.col = pa.col;
      a.blinkUsed = true;
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

const TUTORIAL_ORDER = ['summon', 'move', 'mine', 'spend', 'smith', 'swap', 'fight', 'spell', 'commander', 'complete'];
function advanceTutorial(s: any, act: any, actor: Side, events: any[]) {
  const t = s.tutorial;
  if (!t || t.step === 'complete') return;
  const next = () => { t.step = TUTORIAL_ORDER[TUTORIAL_ORDER.indexOf(t.step) + 1]; };
  const mine = actor === 'player';
  switch (t.step) {
    case 'summon': if (mine && act.type === 'summon') next(); break;
    case 'move': if (mine && act.type === 'move') next(); break;
    case 'mine': if (mine && act.type === 'mine') next(); break;
    case 'spend': if (mine && ['summon', 'cast'].includes(act.type)) next(); break;
    case 'smith': if (mine && act.type === 'smith') next(); break;
    case 'swap': if (mine && events.some((e: any) => e.type === 'swap')) next(); break;
    case 'fight': if (mine && act.type === 'attack' && act.target && act.target.row) next(); break;
    case 'spell': if (mine && act.type === 'cast') next(); break;
    case 'commander': if (s.winner === 'player') next(); break;
  }
}

export function applyAction(state: any, action: any): { ok: boolean; state: any; events: any[]; error?: string } {
  const actor: Side = state && state.priority;
  const r = applyActionInner(state, action);
  if (r.ok && r.state.tutorial) { advanceTutorial(r.state, action, actor, r.events); if (r.state.winner === 'player') r.state.tutorial.step = 'complete'; }
  return r;
}

/** True when a creature has acted this turn, or cannot act yet (shown darker in the UI). */
export function isActed(s: any, c: any): boolean {
  return c.hasMoved || c.hasAttacked || c.hasMined || (c.summonedThisTurn && !has(c, 'haste') && !isMiner(CARDS[c.cardId])) || s.turn < c.lockedUntil;
}
