// Oreheart rules engine. Pure: no DOM, no timers, no Math.random. State is plain JSON data.
import { CARDS, COMMANDERS, FACTIONS, STARTER_DECKS, CONFIG, COLOR_ORDER } from './content';
import { nextRand, shuffle } from './rng';

export type Side = 'player' | 'opponent';
export const other = (p: Side): Side => (p === 'player' ? 'opponent' : 'player');
const cheb = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
const N = CONFIG.boardSize;
const SITES: number[][] = CONFIG.sites;
const stronghold = (p: Side) => ({ row: CONFIG.strongholds[p][0], col: CONFIG.strongholds[p][1] });
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const colorOf = (s: any, p: Side) => FACTIONS[s.players[p].faction].crystal as string;

export const cardOf = (c: any) => CARDS[c.cardId];
const has = (c: any, a: string) => CARDS[c.cardId].abilities?.includes(a);
export const maxMove = (c: any) => (c.upgrade === 'veteran' ? Math.max(2, CARDS[c.cardId].move) : CARDS[c.cardId].move);

// ---------------------------------------------------------------- board helpers
export const creatureAt = (s: any, row: number, col: number) => s.board.creatures.find((c: any) => c.row === row && c.col === col);
const isStronghold = (row: number, col: number) => (['player', 'opponent'] as Side[]).some((p) => stronghold(p).row === row && stronghold(p).col === col);
const isSite = (row: number, col: number) => SITES.some(([r, c]) => r === row && c === col);
const inBounds = (row: number, col: number) => row >= 1 && row <= N && col >= 1 && col <= N;
export const emptyCell = (s: any, row: number, col: number) => inBounds(row, col) && !isStronghold(row, col) && !isSite(row, col) && !creatureAt(s, row, col);
const nearSite = (row: number, col: number) => SITES.some(([r, c]) => cheb({ row, col }, { row: r, col: c }) <= 1 && !(r === row && c === col));
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
    upgrade: null as any, summonedThisTurn: false, hasMoved: false, hasAttacked: false, movedDistance: 0, lockedUntil: 0, blinkUsed: false, shield: 0, bubble: false, ale: 0,
  };
  s.board.creatures.push(c);
  return c;
}
const makeCard = (s: any, cardId: string) => ({ uid: 'k' + s.nextUid++, cardId });

// ---------------------------------------------------------------- costs
const isGatherer = (card: any) => card.role === 'Gatherer';
export const basicGatherer = (faction: string): string => CONFIG.basicGatherers[faction];
const ALL_COLORS = ['green', 'blue', 'purple', 'white'];
const total = (pl: any) => pl.crystals.green + pl.crystals.blue + pl.crystals.purple + pl.crystals.white;
const flowTotal = (f: any) => f.green + f.blue + f.purple + f.white;
const goesFree = (s: any, p: Side, card: any) =>
  card.id === basicGatherer(card.faction) && flowTotal(s.players[p].flow) === 0 && sitesControlled(s, p) === 0 &&
  !s.board.creatures.some((c: any) => c.owner === p && isGatherer(CARDS[c.cardId]));
export function creatureCost(s: any, p: Side, card: any) {
  if (goesFree(s, p, card)) return 0;
  let c = card.cost;
  const d = bonusOf(s, p, 'creatureDiscount');
  if (d && d.faction === card.faction) c = Math.max(1, c - d.amount);
  const disc = s.flags.discount[p];
  if (disc) c = Math.max(0, c - disc);
  return c;
}
export function spellCost(s: any, p: Side, card: any) {
  const d = bonusOf(s, p, 'spellDiscount');
  return d ? Math.max(1, card.cost - d.amount) : card.cost;
}
/** Off-color crystals in payment order: white, then green/blue/purple skipping the own color. */
const offOrder = (faction: string) => ['white'].concat(COLOR_ORDER.filter((c) => c !== faction));
/** Crystals toward a creature or upgrade: own color 1 each, everything else ½ each (rounded down in total). */
export function creatureValue(pl: any, faction: string) {
  const own = pl.crystals[FACTIONS[faction].crystal];
  return own + Math.floor((total(pl) - own) / 2);
}
export const canPayCreature = (pl: any, faction: string, cost: number) => creatureValue(pl, faction) >= cost;
function payCreature(pl: any, faction: string, cost: number) {
  const fc = FACTIONS[faction].crystal;
  const own = Math.min(pl.crystals[fc], cost);
  pl.crystals[fc] -= own;
  let others = (cost - own) * 2;
  for (const col of offOrder(fc)) {
    const t = Math.min(pl.crystals[col], others);
    pl.crystals[col] -= t;
    others -= t;
  }
}
/** Spells take any color at full value: white first, then off-colors, then the own color. */
function paySpell(pl: any, faction: string, cost: number) {
  const order = offOrder(FACTIONS[faction].crystal).concat(FACTIONS[faction].crystal);
  let left = cost;
  for (const col of order) {
    const t = Math.min(pl.crystals[col], left);
    pl.crystals[col] -= t;
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

// ---------------------------------------------------------------- creation
export function createMatch(opts: any = {}) {
  const pcmd = COMMANDERS[opts.playerCommander ?? 'grubnak'];
  const ocmd = COMMANDERS[opts.opponentCommander ?? 'sproingle'];
  const s: any = {
    turn: 0, activePlayer: 'player', priority: 'player', phase: 'mulligan', winner: null,
    players: {}, board: { creatures: [] },
    sites: SITES.map(([row, col]) => ({ row, col, controller: null, color: 'white', flow: { player: 0, opponent: 0 } })),
    pendingResponse: null, rng: (opts.seed ?? 1) | 0, nextUid: 1, firstPlayer: null, firstPlayerOption: opts.firstPlayer ?? null,
    mulliganDone: { player: false, opponent: false }, tutorial: opts.tutorial ? { step: 'summon' } : null,
    flags: { battleCry: null, crystalsPlayed: 0, swapped: false, discount: { player: 0, opponent: 0 } },
  };
  const setup = opts.setup;
  (['player', 'opponent'] as Side[]).forEach((who) => {
    const cmd = who === 'player' ? pcmd : ocmd;
    s.players[who] = {
      commanderId: cmd.id, faction: cmd.faction, health: cmd.health, maxHealth: cmd.health,
      crystals: { green: 0, blue: 0, purple: 0, white: 0 }, flow: { green: 0, blue: 0, purple: 0, white: 0 }, hand: [], deck: [], discard: [], geodes: 0,
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
    const h = setup[who + 'Health'];
    if (h != null) { pl.health = h; if (h > pl.maxHealth) pl.maxHealth = h; }
  }
  for (const b of setup.board || []) { const c = spawn(s, b.owner, b.cardId, b.row, b.col, b.damage || 0); c.shield = b.shield || 0; }
  s.mulliganDone = { player: true, opponent: true };
  s.firstPlayer = setup.firstPlayer || 'player';
  s.turn = 1;
  s.activePlayer = s.firstPlayer;
  s.priority = s.firstPlayer;
  s.phase = 'deploy';
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

/** Assign each creature standing around a mine to one mine (a creature touching two counts at only one). */
function assignMines(s: any) {
  const n = SITES.length;
  const count = SITES.map(() => ({ player: 0, opponent: 0 }));
  const assigned: { c: any; i: number }[] = [];
  const shared: any[] = [];
  const sorted = [...s.board.creatures].sort((a: any, b: any) => a.row - b.row || a.col - b.col);
  for (const c of sorted) {
    const near: number[] = [];
    for (let i = 0; i < n; i++) if (cheb(c, { row: SITES[i][0], col: SITES[i][1] }) <= 1) near.push(i);
    if (near.length === 1) { count[near[0]][c.owner as Side]++; assigned.push({ c, i: near[0] }); }
    else if (near.length > 1) shared.push({ c, near });
  }
  for (const { c, near } of shared) {
    const me = c.owner as Side, foe = other(me);
    let best = near[0];
    for (const i of near.slice(1)) {
      const b = count[best], x = count[i];
      if (x[me] > b[me] || (x[me] === b[me] && x[foe] > b[foe])) best = i;
    }
    count[best][me]++;
    assigned.push({ c, i: best });
  }
  return { count, assigned };
}

/** Recompute mine colors, per-mine flow and each player's flow from the current board. */
export function recomputeSites(s: any, ev: any[]) {
  const { count, assigned } = assignMines(s);
  const flow: any = { player: { green: 0, blue: 0, purple: 0, white: 0 }, opponent: { green: 0, blue: 0, purple: 0, white: 0 } };
  const site = (i: number) => s.sites[i];
  for (let i = 0; i < s.sites.length; i++) {
    const ctl: Side | null = count[i].player > count[i].opponent ? 'player' : count[i].opponent > count[i].player ? 'opponent' : null;
    const color = ctl ? colorOf(s, ctl) : 'white';
    if (ctl !== site(i).controller) ev.push({ type: 'siteControl', row: site(i).row, col: site(i).col, controller: ctl, color });
    site(i).controller = ctl;
    site(i).color = color;
    site(i).flow = { player: 0, opponent: 0 };
  }
  for (const { c, i } of assigned) {
    const f = CARDS[c.cardId].role === 'Gatherer' ? CONFIG.gathererFlow : CONFIG.fighterFlow;
    site(i).flow[c.owner as Side] += f;
    flow[c.owner as Side][site(i).color] += f;
  }
  for (const who of ['player', 'opponent'] as Side[]) {
    flow[who][colorOf(s, who)] += s.players[who].geodes * CONFIG.geodeIncome;
    s.players[who].flow = flow[who];
  }
}

/** Pool `who` gets at the start of their next turn if the board stayed as it is now (flow + underdog, capped). */
export function nextPool(s: any, who: Side) {
  const pl = s.players[who];
  const tmp = { crystals: { ...pl.flow } };
  const enemy = s.sites.filter((x: any) => x.controller === other(who)).length;
  if (sitesControlled(s, who) === 0 && enemy > 0) tmp.crystals[colorOf(s, who)] += CONFIG.underdogBonus;
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
  pl.crystals = nextPool(s, who);
  ev.push({ type: 'income', player: who, amount: total(pl), crystals: { ...pl.crystals } });
}

function startTurn(s: any, ev: any[]) {
  s.turn += 1;
  s.activePlayer = s.turn === 1 ? s.firstPlayer : other(s.activePlayer);
  const who: Side = s.activePlayer;
  s.phase = 'draw';
  s.priority = null;
  s.pendingResponse = null;
  s.flags = { battleCry: null, crystalsPlayed: 0, swapped: false, discount: { player: 0, opponent: 0 } };
  for (const c of s.board.creatures) if (c.owner === who) { c.summonedThisTurn = false; c.hasMoved = false; c.hasAttacked = false; c.movedDistance = 0; }
  ev.push({ type: 'turnStart', player: who, turn: s.turn });
  recomputeSites(s, ev);
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
  collectIncome(s, who, ev);
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
  if (c.hasAttacked || !canAct(s, c) || (c.hasMoved && !has(c, 'charge'))) return [];
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
  const rowCells = (row: number) => { const o: number[] = []; for (let col = 1; col <= N; col++) if (!isStronghold(row, col) && !isSite(row, col)) o.push(col); return o; };
  const back = CONFIG.backRow[p], front = CONFIG.frontRow[p];
  for (const col of rowCells(back)) add(back, col);
  if (out.length === 0) for (const col of rowCells(front)) add(front, col);
  if (card.abilities?.includes('tunnel') && sitesControlled(s, other(p)) > sitesControlled(s, p)) for (let r = 1; r <= N; r++) for (let c = 1; c <= N; c++) if (nearSite(r, c)) add(r, c);
  return out;
}

/** Spaces `c` can move to; a space held by one of its own creatures is a swap. */
export function moveDests(s: any, c: any): { row: number; col: number }[] {
  if (c.hasMoved || c.hasAttacked || s.turn < c.lockedUntil || (c.summonedThisTurn && !has(c, 'haste') && CARDS[c.cardId].role !== 'Gatherer')) return [];
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
  for (let r = 1; r <= N; r++) for (let c = 1; c <= N; c++) if (nearSite(r, c) && emptyCell(s, r, c)) o.push({ row: r, col: c });
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
      for (let r = 1; r <= N; r++) for (let c = 1; c <= N; c++) o.push({ target: { row: r, col: c } });
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

export function respondActions(s: any, responder: Side, pend: any): any[] {
  const out: any[] = [];
  const pl = s.players[responder];
  for (const h of pl.hand) {
    const card = CARDS[h.cardId];
    if (card.type !== 'spell' || card.spellKind === 'regular') continue;
    if (total(pl) < spellCost(s, responder, card)) continue;
    if (card.spellKind === 'counter') {
      if (card.effect === 'cancelSummon' && pend.kind === 'summon') out.push({ type: 'respond', uid: h.uid });
      else if ((card.effect === 'cancelSpell' || card.effect === 'mirror') && pend.kind === 'cast') {
        if (card.params.maxCost && CARDS[pend.card.cardId].cost > card.params.maxCost) continue;
        out.push({ type: 'respond', uid: h.uid });
      }
      continue;
    }
    if (card.effect === 'shield') {
      const t = pendingTargetCreature(s, pend);
      if (t && t.owner === responder) out.push({ type: 'respond', uid: h.uid, target: { row: t.row, col: t.col } });
    } else for (const o of spellTargets(s, responder, card)) out.push({ type: 'respond', uid: h.uid, ...o });
  }
  return out;
}

function openWindow(s: any, pend: any, ev: any[]) {
  const responder = other(pend.actor);
  const opts = respondActions(s, responder, { ...pend, responder });
  if (opts.length) {
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
const upgradeCost = (u: string) => CONFIG.upgradeCosts[u];
const hasEater = (s: any, p: Side) => s.board.creatures.some((c: any) => c.owner === p && CARDS[c.cardId].abilities.some((a: string) => a.startsWith('eater')));

function heartCombos() {
  const n = CARDS['heart-of-the-fallen'].params.amount;
  const out: any[] = [];
  for (let g = 0; g <= n; g++) for (let b = 0; g + b <= n; b++) for (let p = 0; g + b + p <= n; p++) out.push({ green: g, blue: b, purple: p, white: n - g - b - p });
  return out;
}

export function legalActions(s: any): any[] {
  if (s.phase === 'over' || !s.priority) return [];
  const who: Side = s.priority;
  const pl = s.players[who];
  const out: any[] = [];
  const surrender = { type: 'surrender' };
  if (s.pendingResponse) {
    out.push(...respondActions(s, who, s.pendingResponse), { type: 'pass' }, surrender);
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
    } else if (card.type === 'spell' && card.spellKind !== 'counter' && ['deploy', 'action'].includes(ph)) {
      if (total(pl) < spellCost(s, who, card)) continue;
      for (const o of spellTargets(s, who, card)) out.push({ type: 'cast', uid: h.uid, ...o });
    } else if (card.type === 'crystal' && ph === 'deploy') {
      if (s.flags.crystalsPlayed >= CONFIG.crystalCardsPerTurn && !hasEater(s, who)) continue;
      if (card.effect === 'geode' && pl.geodes >= 1) continue;
      if (card.effect === 'chooseColors') for (const colors of heartCombos()) out.push({ type: 'playCrystal', uid: h.uid, colors });
      else out.push({ type: 'playCrystal', uid: h.uid });
    }
    seenCards.add(h.uid);
  }
  if (ph === 'deploy') {
    for (const c of s.board.creatures) if (c.owner === who && !c.upgrade)
      for (const u of Object.keys(CONFIG.upgradeCosts)) if (canPayCreature(pl, pl.faction, upgradeCost(u))) out.push({ type: 'upgrade', creatureUid: c.uid, upgrade: u });
  }
  if (ph === 'action') for (const c of s.board.creatures) if (c.owner === who) for (const d of moveDests(s, c)) out.push({ type: 'move', creatureUid: c.uid, row: d.row, col: d.col });
  if (ph === 'action') for (const c of s.board.creatures) if (c.owner === who) for (const t of attackTargets(s, c)) out.push({ type: 'attack', creatureUid: c.uid, target: t });
  if (ph === 'deploy' && !s.flags.swapped && !pl.hand.some((h: any) => isGatherer(CARDS[h.cardId])) && pl.deck.some((d: any) => d.cardId === basicGatherer(pl.faction))) {
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
    if (['done', 'surrender', 'upgrade', 'gathererSwap', 'pass', 'respond'].includes(a.type)) return false;
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
      const h = takeHand(l.uid);
      const card = CARDS[h.cardId];
      const fc = colorOf(s, who);
      if (s.flags.crystalsPlayed >= CONFIG.crystalCardsPerTurn) {
        for (const c of [...s.board.creatures]) {
          if (c.owner !== who) continue;
          if (has(c, 'eaterGuzzler')) dealDamage(s, c, CONFIG.eaterGuzzlerDamage, ev, true);
          else if (has(c, 'eaterConduit')) { c.lockedUntil = s.turn + 2; dealDamage(s, c, CONFIG.eaterConduitDamage, ev, true); }
          else if (has(c, 'eaterDelver')) c.attack = Math.max(0, c.attack - CONFIG.eaterDelverPenalty);
        }
      }
      s.flags.crystalsPlayed++;
      pl.discard.push(h);
      if (card.effect === 'gain') gain(s, who, fc, card.params.amount);
      else if (card.effect === 'geode') pl.geodes++;
      else if (card.effect === 'motherlode') { gain(s, who, fc, card.params.amount); s.flags.discount[who] += card.params.discount; }
      else if (card.effect === 'chooseColors') {
        const cols = act.colors || { [fc]: card.params.amount };
        for (const k of ALL_COLORS) pl.crystals[k] += cols[k] || 0;
        capPool(pl, pl.faction);
      }
      ev.push({ type: 'playCrystal', player: who, cardId: card.id });
      break;
    }
    case 'upgrade': {
      const c = s.board.creatures.find((x: any) => x.uid === l.creatureUid);
      const u = CONFIG.upgrades[l.upgrade];
      payCreature(pl, pl.faction, upgradeCost(l.upgrade));
      c.upgrade = l.upgrade;
      if (u.attack) c.attack += u.attack;
      if (u.maxHealth) c.maxHealth += u.maxHealth;
      if (u.heal) c.health = Math.min(c.maxHealth, c.health + u.heal);
      ev.push({ type: 'upgrade', uid: c.uid, upgrade: l.upgrade });
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

const TUTORIAL_ORDER = ['summon', 'move', 'swap', 'capture', 'spend', 'fight', 'spell', 'commander', 'complete'];
function advanceTutorial(s: any, act: any, actor: Side, events: any[]) {
  const t = s.tutorial;
  if (!t || t.step === 'complete') return;
  const next = () => { t.step = TUTORIAL_ORDER[TUTORIAL_ORDER.indexOf(t.step) + 1]; };
  const mine = actor === 'player';
  switch (t.step) {
    case 'summon': if (mine && act.type === 'summon') next(); break;
    case 'move': if (mine && act.type === 'move') next(); break;
    case 'swap': if (mine && events.some((e: any) => e.type === 'swap')) next(); break;
    case 'capture': if (s.sites.some((x: any) => x.controller === 'player')) next(); break;
    case 'spend': if (mine && ['summon', 'upgrade', 'cast'].includes(act.type)) next(); break;
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
  return c.hasMoved || c.hasAttacked || (c.summonedThisTurn && !has(c, 'haste')) || s.turn < c.lockedUntil;
}
