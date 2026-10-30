// Computer opponent. Uses only legalActions() and read-only engine helpers; never mutates state.
// Easy: the original weighted-random player (unchanged).
// Medium ('normal') and Hard (Anvil, Oct 30; Ken: "medium and hard need to be adjusted ... hard needs to be pretty hard"):
// every legal action is tried on a copy of the state and the result is scored by evaluate() below
// (Commander health, units, mines and income, poison, threats to its own units and Commander, and a goal for every fighter).
// Hard also looks one action ahead (e.g. Thunderhorn Blast then attack, damage then finish off) and makes no deliberate mistakes;
// Medium adds randomness and the odd second-best pick. No hidden information is used: the opponent's hand and deck are never read,
// Respond windows opened by a trial action are always answered "pass", and trial actions use a reshuffled random seed so the
// AI can't foresee knock-back directions.
import { applyAction, legalActions, atkValue, CARDS, CONFIG, FACTIONS, other, spellCost, creatureAt, isMiner, nextPool, previewAttack, canRedraw, basicGatherer } from '../engine';

export type Rand = () => number;
export function makeRand(seed: number): Rand {
  let t = seed | 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const cheb = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
const sh = (p: string) => ({ row: CONFIG.strongholds[p][0], col: CONFIG.strongholds[p][1] });

function posValue(s: any, who: string, card: any, row: number, col: number, uid?: string) {
  const foe = other(who as any);
  const here = { row, col };
  const SITES = s.sites.map((x: any) => ({ row: x.row, col: x.col }));
  const enemies = s.board.creatures.filter((c: any) => c.owner === foe);
  let v = 0;
  if (isMiner(card)) {
    const adj = SITES.map((x: any, i: number) => ({ x, i })).filter(({ x }) => cheb(here, x) <= 1);
    if (adj.length) {
      v += 30 + adj.length * 5 + (adj.some(({ i }) => s.sites[i].controller !== foe) ? 8 : 0);
      // don't pile up: a crowded mine (beyond 3 own creatures) is worth less so Fighters can get through
      const crowd = Math.max(...adj.map(({ x }) => s.board.creatures.filter((c: any) => c.owner === who && cheb(c, x) <= 1 && !(c.row === row && c.col === col)).length));
      v -= 7 * Math.max(0, crowd - 2);
    }
    else v -= 3 * Math.min(...SITES.map((x: any) => cheb(here, x)));
    v -= 12 * enemies.filter((e: any) => cheb(e, here) <= 2).length;
  } else {
    const e = sh(foe);
    v -= 2 * cheb(here, e);
    if (cheb(here, e) <= 1) v += 40;
    if (card.abilities?.includes('ranged') && cheb(here, e) <= (card.range ?? 7)) v += 30;
    const adj = SITES.map((x: any, i: number) => ({ x, i })).filter(({ x }) => cheb(here, x) <= 1);
    if (adj.some(({ i }) => s.sites[i].controller !== who)) v += 8;
  }
  void uid;
  return v;
}

/** Ken (Oct 30): the computer keeps or redraws its WHOLE opening hand, once. It redraws when the hand has no Miner
 *  (nothing to start the Crystal Flow) or no fighter it can afford early (a non-Miner creature costing 5 or less). */
export function wantsRedraw(s: any, who: string): boolean {
  const cards = s.players[who].hand.map((h: any) => CARDS[h.cardId]).filter((c: any) => c.type === 'creature');
  const minerCard = (c: any) => isMiner(c) || c.id === basicGatherer(c.faction);
  const miner = cards.some(minerCard);
  const fighter = cards.some((c: any) => !minerCard(c) && c.cost <= 5);
  return !miner || !fighter;
}

function scoreRespond(s: any, who: string, a: any): number {
  if (a.type === 'pass') return 0.5;
  const pend = s.pendingResponse;
  const hand = s.players[who].hand.find((h: any) => h.uid === a.uid);
  const card = CARDS[hand.cardId];
  const pc = pend.card ? CARDS[pend.card.cardId] : null;
  switch (card.effect) {
    case 'cancelSpell': return pc && pc.cost >= 4 ? 10 + pc.cost : 0;
    case 'mirror': return pc && pc.cost >= 4 && ['damage', 'areaDamage'].includes(pc.effect) ? 25 : 0;
    case 'cancelSummon': return pc && pc.cost >= 3 ? 8 + pc.cost : 0;
    case 'shield': {
      // a Bulwark is worth spending when the attack would defeat the unit (or hurt a lot); not on a scratch
      if (pend.kind === 'attack' && pend.creatureUid && pend.target?.row) {
        const pv: any = previewAttack(s, pend.creatureUid, pend.target);
        const t = creatureAt(s, pend.target.row, pend.target.col);
        if (pv && t) return pv.targetDefeated ? 30 + CARDS[t.cardId].cost * 2 : pv.youDeal >= 3 ? 6 : 0;
      }
      return 12;
    }
    case 'heal': {
      const t = creatureAt(s, a.target.row, a.target.col);
      return t && t.maxHealth - t.health >= 2 ? 6 : 0;
    }
    case 'healCommander': return s.players[who].health <= 12 ? 8 : 0;
  }
  return 0;
}

function scoreCast(s: any, who: string, a: any): number {
  const hand = s.players[who].hand.find((h: any) => h.uid === a.uid);
  const card = CARDS[hand.cardId];
  const foe = other(who as any);
  const t = a.target && a.target.row ? creatureAt(s, a.target.row, a.target.col) : null;
  const left = s.players[who].crystals + s.players[who].bank - spellCost(s, who as any, card);
  switch (card.effect) {
    case 'damage': {
      if (a.target.commander) return s.players[foe].health <= card.params.amount ? 10000 : s.players[foe].health <= 8 ? 40 : 18;
      if (!t) return 0;
      const kills = t.health <= card.params.amount - (CARDS[t.cardId].abilities?.includes('armored') ? 1 : 0);
      return kills ? 50 + CARDS[t.cardId].cost * 6 : 5;
    }
    case 'poison': return !t ? 0 : !t.poison ? 8 + CARDS[t.cardId].cost * 3 : (t.poisonStacks || 1) < (CONFIG.stackCap ?? 3) ? Math.round((8 + CARDS[t.cardId].cost * 3) / 2) : 0; // stacking (Ken, Oct 30): a second dagger is worth about half
    case 'areaDamage': {
      let v = 0;
      for (const c of s.board.creatures) if (cheb(c, a.target) <= 1) v += (c.owner === who ? -1 : 1) * (CARDS[c.cardId].cost * 3 + (c.health <= 2 ? 10 : 2));
      return v > 12 ? v : 0;
    }
    case 'buffAttack': {
      if (s.phase !== 'action') return 0;
      const n = s.board.creatures.filter((c: any) => c.owner === who && !c.hasAttacked && legalActions(s).some((x: any) => x.type === 'attack' && x.creatureUid === c.uid)).length;
      return n >= 2 ? 30 + n * 5 : 0;
    }
    case 'gainCrystals': return left >= 0 ? 35 : 0;
    case 'tunnelMove': {
      if (!t || !isMiner(CARDS[t.cardId])) return 0;
      return posValue(s, who, CARDS[t.cardId], a.to.row, a.to.col) - posValue(s, who, CARDS[t.cardId], t.row, t.col) - 15;
    }
    case 'heal': return t && t.maxHealth - t.health >= 3 && left >= 3 ? 12 : 0;
    default: return 0;
  }
}

// ---------------------------------------------------------------- Medium / Hard: board evaluation
const ab = (c: any, k: string) => !!CARDS[c.cardId].abilities?.includes(k);
const backRow = (p: string) => CONFIG.backRow[p];
const rangeOf = (c: any) => CARDS[c.cardId].range ?? CONFIG.rangedRange ?? 7;
const isStrongholdCell = (r: number, c: number) => ['player', 'opponent'].some((p) => CONFIG.strongholds[p][0] === r && CONFIG.strongholds[p][1] === c);

/** Straight or diagonal line from a to b within `range`, with nothing in between (the engine's ranged rule). */
const occCache = new WeakMap<any, Set<number>>();
const occupied = (s: any, r: number, c: number) => {
  let o = occCache.get(s.board);
  if (!o) { o = new Set(s.board.creatures.map((x: any) => x.row * 32 + x.col)); occCache.set(s.board, o); }
  return o.has(r * 32 + c);
};
function lineReach(s: any, a: any, b: any, range: number): boolean {
  const dr = b.row - a.row, dc = b.col - a.col;
  if ((dr && dc && Math.abs(dr) !== Math.abs(dc)) || (!dr && !dc)) return false;
  const n = Math.max(Math.abs(dr), Math.abs(dc));
  if (n > range) return false;
  const sr = Math.sign(dr), sc = Math.sign(dc);
  for (let k = 1; k < n; k++) { const r = a.row + sr * k, c = a.col + sc * k; if (isStrongholdCell(r, c) || occupied(s, r, c)) return false; }
  return true;
}
/** Can enemy unit f hit square/unit `t` on its next turn without help (melee next to it, ranged in line, Charge within reach)? */
function threatens(s: any, f: any, t: any): boolean {
  if ((f.lockedUntil || 0) > s.turn + 1 || (f.wardUntil || 0) > s.turn + 1) return false;
  if (ab(f, 'overwatch')) return true;
  if (ab(f, 'ranged')) return lineReach(s, f, t, rangeOf(f));
  const d = cheb(f, t);
  if (d === 1) return true;
  if ((ab(f, 'charge') || ab(f, 'ramMove')) && d <= (CARDS[f.cardId].move || 1) + 1 && !((f.rootUntil || 0) > s.turn + 1)) return true;
  return false;
}
function unitVal(s: any, c: any, minerRank: number): number {
  const card = CARDS[c.cardId];
  let v = card.cost * 2.5 + c.attack * 2 + c.maxHealth * 1.2;
  if (isMiner(card)) v += minerRank < 5 ? 6 : 1; // the first few Miners carry the economy; a flood of them doesn't
  if (c.illusion) v *= 0.5;
  return v;
}
/** Damage `u` would actually take from these hits next turn (Ward, Riot Shield, bubbles, Shield, Armored, Unbreakable). */
function effectiveDamage(s: any, u: any, hits: number[]): number {
  if ((u.wardUntil || 0) > s.turn + 1) return 0;
  if (ab(u, 'riotShield') && s.turn + 1 < (u.lockedUntil || 0)) return 0;
  const list = hits.slice().sort((a, b) => b - a);
  let bub = u.bubbles || (u.bubble ? 1 : 0);
  while (bub-- > 0 && list.length) list.shift();
  let shield = u.shield || 0, tot = 0;
  for (let d of list) {
    if (ab(u, 'armored')) d = Math.max(0, d - 1);
    if (ab(u, 'unbreakable')) d = Math.min(d, 3);
    const b = Math.min(shield, d); shield -= b; d -= b;
    tot += d;
  }
  return tot;
}

interface Prm { threatW: number; goalW: number; turnW: number; fwdW: number; rush?: number; mines?: number }

/** Reading the board at the start of each decision (Ken, Oct 30: "react to what I'm doing"):
 *  rush  = how hard the enemy is pushing toward our Commander (enemy fighters within 4 squares, weighted by Attack and closeness), 0..2
 *  mines = how far behind we are on mines and Crystal Flow (their next-turn crystals and owned mines vs ours), 0..2 */
export function readBoard(s: any, me: string): { rush: number; mines: number } {
  const foe = other(me as any);
  const home = sh(me);
  let R = 0;
  for (const f of s.board.creatures) {
    if (f.owner !== foe || isMiner(CARDS[f.cardId])) continue;
    const d = cheb(f, home);
    if (d <= 4) R += Math.max(1, atkValue(s, f)) * (5 - d) / 4;
  }
  const owned = (who: string) => s.sites.filter((x: any) => {
    let n = 0;
    for (const c of s.board.creatures) if (c.minedMine && c.minedMine.row === x.row && c.minedMine.col === x.col && cheb(c, x) <= 1) n += c.owner === who ? 1 : -1;
    return n > 0;
  }).length;
  const flowGap = nextPool(s, foe as any) - nextPool(s, me as any);
  const M = flowGap / 4 + (owned(foe) - owned(me)) * 0.5;
  return { rush: Math.max(0, Math.min(2, R / 6)), mines: Math.max(0, Math.min(2, M)) };
}
/** Tuning knobs (exported so the match simulator can try other values). */
export const TUNE = { cmdW: 16, pressW: 8, myEcon: 7, foeEcon: 5, specialBias: 3, hardThreat: 0.5, medThreat: 0.4, hardTurn: 6, medTurn: 6, hardFwd: 5.5, medFwd: 4, hardNoise: 4, medNoise: 6, hardMin: 1.5, medMin: 1.5, look: 1, lookW: 0.7, moveBias: 0, medMistake: 0.2, hardMs: 300, medMs: 60, medMoves: 60, defG: 14, react: 1, d2Base: 0, rushThresh: 0.3, mineThresh: 0.75, mineHit: 40, rushHit: 14, mineBonus: 12, fighterMine: 0, swapV: 16, swapMiners: 5 };
const cmdVal = (h: number) => h * TUNE.cmdW + Math.min(0, h - 8) * 10;

/** How good the board is for `me` (bigger = better). Reads only public information. */
export function evaluate(s: any, me: string, P: Prm = { threatW: 1, goalW: 1, turnW: 7, fwdW: 2.5 }): number {
  const foe = other(me as any);
  if (s.winner) return s.winner === me ? 1e6 : -1e6;
  const my = s.players[me], fp = s.players[foe];
  let v = cmdVal(my.health) - cmdVal(fp.health);
  const mine: any[] = [], foes: any[] = [];
  for (const c of s.board.creatures) (c.owner === me ? mine : foes).push(c);
  const myTurn = s.activePlayer === me;
  let mr = 0, fr = 0;
  // cached per evaluation (big late-game boards have 50+ units): Attack values, ready units, isolated enemies
  const atkMemo = new Map<any, number>();
  const atk = (c: any, target?: any) => {
    let b = atkMemo.get(c);
    if (b === undefined) { b = atkValue(s, c); atkMemo.set(c, b); }
    return target && FACTIONS[CARDS[c.cardId].faction]?.beats === CARDS[target.cardId].faction ? b + CONFIG.typeAdvantageBonus : b;
  };
  const ready = myTurn ? mine.filter((c) => !c.hasAttacked && !c.hasMined && !(c.hasMoved && !ab(c, 'charge')) && (c.lockedUntil || 0) <= s.turn && !(c.summonedThisTurn && !ab(c, 'haste'))) : [];
  const isolated = new Set(foes.filter((f) => !foes.some((o) => o !== f && cheb(o, f) <= 2)));
  // ---- units
  for (const c of mine) {
    v += unitVal(s, c, isMiner(CARDS[c.cardId]) ? mr++ : 0);
    if (c.poison > 0) { const fut = (c.poisonStacks || 1) * (CONFIG.poisonDamage ?? 1) * Math.min(c.poison, 4); v -= fut >= c.health ? unitVal(s, c, 9) * 0.6 : fut * 3; }
  }
  for (const f of foes) {
    v -= unitVal(s, f, isMiner(CARDS[f.cardId]) ? fr++ : 0);
    if (f.poison > 0) {
      // poisoned units don't heal: their damage stays, and the poison keeps ticking
      const fut = (f.poisonStacks || 1) * (CONFIG.poisonDamage ?? 1) * Math.min(f.poison, 4);
      v += fut >= f.health ? unitVal(s, f, 9) * 0.6 : fut * 3 + (f.maxHealth - f.health) * 3;
    } else if (myTurn && f.health < f.maxHealth) {
      // focus fire: a hurt enemy that one of our ready units can still hit this turn is nearly a kill
      const finisher = ready.some((c) => threatensNow(s, c, f));
      v += (f.maxHealth - f.health) * (finisher ? 2.5 : 0.2);
    }
  }
  // ---- economy: next turn's crystals for both sides (mining, mine ownership, Geodes, Plunder, underdog)
  // (own income counts more than the enemy's: mining your first mine also hands the enemy the underdog bonus, which must not scare us off mining)
  const rush = P.rush || 0, mineGap = P.mines || 0;
  // when they out-mine us, their income matters more: killing or knocking their Miners off a mine pays
  v += TUNE.myEcon * nextPool(s, me as any) - (TUNE.foeEcon + 4 * mineGap) * nextPool(s, foe as any);
  for (const x of s.sites) {
    let n = 0;
    for (const c of s.board.creatures) if (c.minedMine && c.minedMine.row === x.row && c.minedMine.col === x.col && cheb(c, x) <= 1) n += c.owner === me ? 1 : -1;
    v += n > 0 ? 6 : n < 0 ? -6 : 0; // owning a mine (more of your creatures mining it than theirs)
  }
  v += my.bank * 1.2 + my.crystals * 0.3 + my.hand.length * 2.5;
  // ---- positions: every fighter heads for its best goal; Miners for a mine
  const myHome = sh(me), foeHome = sh(foe);
  const sites = s.sites;
  const H = CONFIG.boardHeight, W = CONFIG.boardWidth;
  let room: any[] | null = null; // mines with a free square next to them (computed once, only if a Miner needs it)
  for (const c of mine) {
    const card = CARDS[c.cardId];
    if (isMiner(card)) {
      const near = sites.filter((x: any) => cheb(c, x) <= 1);
      if (near.length) v += 10 + (near.some((x: any) => x.controller !== foe) ? 3 : 0);
      else {
        if (!room) room = sites.filter((x: any) => [-1, 0, 1].some((dr) => [-1, 0, 1].some((dc) => (dr || dc) && !occupied(s, x.row + dr, x.col + dc) && x.row + dr >= 1 && x.row + dr <= H && x.col + dc >= 1 && x.col + dc <= W)));
        v -= 2.5 * Math.min(...(room!.length ? room! : sites).map((x: any) => cheb(c, x)));
      }
      continue;
    }
    const reach = ab(c, 'ranged') ? Math.min(rangeOf(c), 7) : 1;
    const mv = card.move || 1;
    const turns = (t: any, r = reach) => Math.max(0, Math.ceil((cheb(c, t) - r) / mv));
    const T = P.turnW;
    let best = 30 - T * turns(foeHome) + (fp.health <= 8 ? 8 : 0) - 8 * rush; // under a rush, racing to their Commander matters less
    for (const f of foes) {
      const fc = CARDS[f.cardId];
      // a rush on our Commander pulls fighters home (and widens the alarm zone); mine domination sends them after Miners
      const dh = cheb(f, myHome);
      const G = 9 + (isMiner(fc) ? 7 + 4 * mineGap : 0) + (f.health <= c.attack ? 5 : 0) + (dh <= 3 + Math.round(rush) ? TUNE.defG * (1 + rush) : 0) + (isolated.has(f) ? 3 : 0);
      const g = G - T * turns(f);
      if (g > best) best = g;
    }
    for (const x of sites) if (x.controller !== me) { const g = 12 + 8 * mineGap - T * Math.max(0, Math.ceil((cheb(c, x) - 1) / mv)); if (g > best) best = g; }
    v += P.goalW * best;
    v += P.fwdW * Math.min(6, Math.abs(c.row - backRow(me))); // forward, not sideways along the home row
    if (c.row === backRow(me) && s.turn >= 6) v -= 2; // don't clog the summoning row
  }
  // ---- threats: what the enemy can do on its next turn with the units it has now
  if (P.threatW > 0) {
    for (const u of mine) {
      const hits: number[] = [];
      let payback = 0; // melee attackers take our strike back: a unit that kills what hits it is a fair trade, not a blunder
      for (const f of foes) if (threatens(s, f, u)) {
        hits.push(atk(f, u));
        if (cheb(f, u) === 1 && !ab(f, 'ranged') && !ab(f, 'sneaky') && !ab(f, 'overwatch') && atk(u, f) >= f.health) payback = Math.max(payback, unitVal(s, f, 9));
      }
      if (!hits.length) continue;
      const d = effectiveDamage(s, u, hits);
      if (d >= u.health) v -= P.threatW * Math.max(0, 0.75 * unitVal(s, u, 9) - 0.5 * payback);
      else if (u.poison > 0) v -= P.threatW * d * 1.5;
    }
    let D = 0;
    for (const f of foes) if (threatens(s, f, myHome)) D += atk(f);
    if (D >= my.health) v -= P.threatW * 5000;
    else v -= P.threatW * D * 9;
    // the turn after: enemy fighters that can step onto a free square beside our Stronghold now and hit next turn.
    // Blocking those squares, killing the attackers or knocking them back all lower it (that is how a rush is stopped).
    const free = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r = myHome.row + dr, c = myHome.col + dc; if ((dr || dc) && r >= 1 && r <= H && c >= 1 && c <= W && !occupied(s, r, c) && !sites.some((x: any) => x.row === r && x.col === c)) free.push({ row: r, col: c }); }
    let D2 = 0;
    for (const f of foes) {
      if (isMiner(CARDS[f.cardId]) || threatens(s, f, myHome)) continue;
      const mv = CARDS[f.cardId].move || 1;
      if (ab(f, 'ranged') ? cheb(f, myHome) <= Math.min(rangeOf(f), 7) + mv : free.some((q) => cheb(f, q) <= mv)) D2 += atk(f);
    }
    v -= P.threatW * D2 * (TUNE.d2Base + 6 * rush);
  }
  // ---- pressure: our units already in position to hit the enemy Commander
  for (const c of mine) if (!isMiner(CARDS[c.cardId]) && (cheb(c, foeHome) === 1 || (ab(c, 'ranged') && lineReach(s, c, foeHome, rangeOf(c))))) v += c.attack * TUNE.pressW;
  return v;
}
function threatensNow(s: any, c: any, f: any): boolean {
  if (ab(c, 'overwatch')) return true;
  if (ab(c, 'ranged')) return lineReach(s, c, f, rangeOf(c));
  return cheb(c, f) === 1 || (ab(c, 'charge') && !c.hasMoved && cheb(c, f) <= (CARDS[c.cardId].move || 1) + 1);
}

/** The state after `a` (Respond windows answered "pass"; a reshuffled seed so random knock-backs aren't foreseen). */
function trial(s: any, a: any, me: string): any | null {
  if (a.type === 'move') {
    // moves have no side effects beyond position and swap: do them on a light copy (much faster than applyAction)
    const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid);
    if (!c) return null;
    const mate = creatureAt(s, a.row, a.col);
    const creatures = s.board.creatures.map((x: any) => (x === c ? { ...x, row: a.row, col: a.col, hasMoved: true } : x === mate ? { ...x, row: c.row, col: c.col } : x));
    return { ...s, board: { ...s.board, creatures } };
  }
  const r: any = applyAction({ ...s, rng: (Math.imul(s.rng | 0, 1103515245) + 12345 + s.turn) | 0 }, a);
  if (!r.ok) return null;
  let t = r.state;
  for (let i = 0; i < 3 && t.pendingResponse && t.priority !== me; i++) { const q: any = applyAction(t, { type: 'pass' }); if (!q.ok) break; t = q.state; }
  return t;
}

/** Abilities can have dozens of targets (Rocket: every empty square). Keep the promising ones: near enemies or the enemy Stronghold. */
function pruneAbilities(s: any, me: string, legal: any[], rand: Rand, keep: number): any[] {
  const foe = other(me as any);
  const foes = s.board.creatures.filter((c: any) => c.owner === foe);
  const groups: Record<string, any[]> = {};
  const out: any[] = [];
  for (const a of legal) {
    if (a.type !== 'ability') { out.push(a); continue; }
    (groups[a.ability + ':' + a.creatureUid] ||= []).push(a);
  }
  const spot = (a: any) => a.target && typeof a.target.row === 'number' ? a.target : a.from || null;
  for (const g of Object.values(groups)) {
    if (g.length <= keep) { out.push(...g); continue; }
    const d = (a: any) => { const p = spot(a); if (!p) return 0; return Math.min(cheb(p, sh(foe)), ...foes.map((f: any) => cheb(p, f))); };
    const sorted = g.map((a) => [d(a) + rand() * 0.5, a] as [number, any]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
    out.push(...sorted.slice(0, keep - 2), ...[0, 1].map(() => sorted[keep - 2 + Math.floor(rand() * (sorted.length - keep + 2))]));
  }
  return out;
}

/** Trim a long action list to the options worth simulating: identical cards in hand count once, area spells only where they hit
 *  enemies, Miner upgrades only on the best units, the best summoning squares, and a sample of ability targets. */
function shortlist(s: any, me: string, legal: any[], rand: Rand, hard: boolean): any[] {
  const foe = other(me as any);
  const foes = s.board.creatures.filter((c: any) => c.owner === foe);
  const hand = (uid: string) => s.players[me].hand.find((h: any) => h.uid === uid);
  const seen = new Set<string>();
  const out: any[] = [];
  const summons: Record<string, any[]> = {}, ups: Record<string, any[]> = {}, areas: Record<string, any[]> = {};
  for (const a of legal) {
    if (['done', 'pass', 'surrender'].includes(a.type)) continue;
    const h = a.uid ? hand(a.uid) : null;
    if (h) { // two copies of the same card in hand give the same options: keep one
      const key = JSON.stringify({ ...a, uid: h.cardId, crystalUid: undefined });
      if (seen.has(key)) continue;
      seen.add(key);
    }
    if (a.type === 'ability' && a.ability === 'blink') { const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid); if (!c || c.illusion) continue; } // an illusion re-blinking makes endless illusions (engine bug, reported)
    if (a.type === 'summon') { (summons[h.cardId] ||= []).push(a); continue; }
    if (a.type === 'minerUpgrade') { (ups[h.cardId] ||= []).push(a); continue; }
    if (a.type === 'cast' && h && CARDS[h.cardId].effect === 'areaDamage') { (areas[h.cardId] ||= []).push(a); continue; }
    out.push(a);
  }
  for (const g of Object.values(summons)) {
    if (g.length <= 10) { out.push(...g); continue; }
    const card = CARDS[hand(g[0].uid).cardId];
    out.push(...g.map((a) => [posValue(s, me, card, a.row, a.col) + rand(), a] as [number, any]).sort((x, y) => y[0] - x[0]).slice(0, 10).map((x) => x[1]));
  }
  for (const g of Object.values(ups)) {
    const w = (a: any) => { const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid); return c ? (isMiner(CARDS[c.cardId]) ? 0 : CARDS[c.cardId].cost + c.attack) : -1; };
    out.push(...g.sort((x, y) => w(y) - w(x)).slice(0, 3));
  }
  for (const g of Object.values(areas)) {
    const hit = (a: any) => foes.filter((f: any) => cheb(f, a.target) <= 1).reduce((t: number, f: any) => t + CARDS[f.cardId].cost, 0) - s.board.creatures.filter((c: any) => c.owner === me && cheb(c, a.target) <= 1).length * 4;
    out.push(...g.filter((a) => hit(a) > 0).sort((x, y) => hit(y) - hit(x)).slice(0, 6));
  }
  return pruneAbilities(s, me, out, rand, hard ? 12 : 8);
}

function smartChoose(s: any, hard: boolean, rand: Rand, legal: any[], done: any): any {
  const me = s.priority as string;
  const mood = readBoard(s, me), sharp = hard ? 1 : 0.5; // Medium reacts too, less sharply
  const P: Prm = hard ? { threatW: TUNE.hardThreat, goalW: 1, turnW: TUNE.hardTurn, fwdW: TUNE.hardFwd } : { threatW: TUNE.medThreat, goalW: 1, turnW: TUNE.medTurn, fwdW: TUNE.medFwd };
  // react only to a real push or a real gap (small swings are normal play)
  P.rush = Math.max(0, mood.rush - TUNE.rushThresh) * sharp * TUNE.react; P.mines = Math.max(0, mood.mines - TUNE.mineThresh) * sharp * TUNE.react;
  // the forward push gives way while defending, and every step toward a goal (home, or the enemy Miners) counts more
  P.fwdW = P.fwdW * Math.max(0.2, 1 - 0.5 * P.rush);
  P.goalW = 1 + 0.75 * P.rush;
  // per-turn priorities: how many enemy Miners sit on mines, and how hard the enemy fighters press our Commander
  const myHome = sh(me), foeSide = other(me as any);
  const onMines = (st: any) => st.board.creatures.filter((c: any) => c.owner === foeSide && isMiner(CARDS[c.cardId]) && st.sites.some((x: any) => cheb(c, x) <= 1)).length;
  const pressure = (st: any) => st.board.creatures.reduce((t: number, c: any) => t + (c.owner === foeSide && !isMiner(CARDS[c.cardId]) && cheb(c, myHome) <= 4 ? 5 - cheb(c, myHome) : 0), 0);
  const nearest = (st: any, c: any, pick: (o: any) => boolean) => { let d = 99; for (const o of st.board.creatures) if (o.owner === foeSide && pick(o)) d = Math.min(d, cheb(o, c)); return d; };
  const isRusher = (o: any) => !isMiner(CARDS[o.cardId]) && cheb(o, myHome) <= 4;
  const isMineMiner = (o: any) => isMiner(CARDS[o.cardId]) && s.sites.some((x: any) => cheb(o, x) <= 1);
  const m0 = P.mines > 0 ? onMines(s) : 0, p0 = P.rush > 0 ? pressure(s) : 0;
  const priority = (a: any, t: any) => {
    let b = 0;
    if (P.mines! > 0) b += (m0 - onMines(t)) * TUNE.mineHit * P.mines!;
    if (P.rush! > 0) b += (p0 - pressure(t)) * TUNE.rushHit * P.rush!;
    if (a.type === 'move') {
      const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid);
      if (c && !isMiner(CARDS[c.cardId])) {
        if (P.mines! > 0) b += (nearest(s, c, isMineMiner) - nearest(s, a, isMineMiner)) * 3 * P.mines!;
        if (P.rush! > 0) b += (nearest(s, c, isRusher) - nearest(s, a, isRusher)) * 3 * P.rush!;
      }
    }
    return b;
  };
  const noise = hard ? TUNE.hardNoise : TUNE.medNoise;
  const base = evaluate(s, me, P);
  const pl = s.players[me];
  // a time budget keeps big late-game boards quick on phones: non-move options first, then moves (most forward first)
  const t0 = performance.now(), budget = hard ? TUNE.hardMs : TUNE.medMs;
  const short = shortlist(s, me, legal, rand, hard);
  const movesFirst = short.filter((a) => a.type === 'move').map((a) => { const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid); return [c ? posValue(s, me, CARDS[c.cardId], a.row, a.col) - posValue(s, me, CARDS[c.cardId], c.row, c.col) : 0, a] as [number, any]; }).sort((x, y) => y[0] - x[0]).map((x) => x[1]);
  const cands = [...short.filter((a) => a.type !== 'move'), ...(hard ? movesFirst : movesFirst.slice(0, TUNE.medMoves))];
  const scored: { v: number; a: any; t: any }[] = [];
  const handHasMiner = pl.hand.some((h: any) => isMiner(CARDS[h.cardId]));
  for (const a of cands) {
    if (a.type === 'playCrystal') { scored.push({ v: 1000 + rand(), a, t: null }); continue; }
    if (a.type === 'gathererSwap') {
      const h = a.discardUid ? pl.hand.find((x: any) => x.uid === a.discardUid) : null;
      const dc = h ? CARDS[h.cardId] : null;
      const myMiners = s.board.creatures.filter((c: any) => c.owner === me && isMiner(CARDS[c.cardId])).length;
      // the swap is how a short-on-Miners hand keeps the Crystal Flow growing (60-card decks hold only ~11 Miners)
      scored.push({ v: !handHasMiner && myMiners < TUNE.swapMiners ? TUNE.swapV - (dc ? (dc.type === 'crystal' ? 0 : dc.cost) : 0) : -1, a, t: null });
      continue;
    }
    if (performance.now() - t0 > budget) break;
    const t = trial(s, a, me);
    if (!t) continue;
    if (t.winner === me) return a; // a match-winning action is always taken, whatever the level
    let v = evaluate(t, me, P) - base;
    if (a.type === 'cast') {
      const card = CARDS[pl.hand.find((h: any) => h.uid === a.uid)?.cardId];
      if (card?.effect === 'buffAttack' && !hard) v = scoreCast(s, me, a) > 0 ? 10 + scoreCast(s, me, a) * 0.3 : -5; // Medium: the old rule of thumb
    }
    if ((a.type === 'ability' || a.type === 'cast') && v > -1) v += TUNE.specialBias; // Ken: use special abilities and spells, not only plain attacks
    if (a.type === 'move') v += TUNE.moveBias;
    if (a.type === 'mineAt') v += TUNE.mineBonus;
    else if (a.type === 'mine') v += isMiner(CARDS[s.board.creatures.find((x: any) => x.uid === a.creatureUid)?.cardId] || {}) ? TUNE.mineBonus : TUNE.fighterMine; // the Crystal Flow is the engine of every turn
    if (P.mines! > 0 || P.rush! > 0) v += priority(a, t);
    if (a.type === 'mine' && P.rush > 0.3) { const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid); if (c && !isMiner(CARDS[c.cardId])) v -= 12 * P.rush; } // a fighter doesn't stop to mine while the Commander is rushed
    scored.push({ v: v + rand() * noise, a, t });
  }
  if (hard && TUNE.look && s.phase === 'action' && performance.now() - t0 < budget * 0.6) {
    // look one action ahead for the most promising options: set-ups (Blast, damage, Shield, Ward, knock-backs) that pay off next action
    const live = scored.filter((x) => x.t && x.t.priority === me && x.t.phase === s.phase && !x.t.winner).sort((x, y) => y.v - x.v);
    // the 4 best options, plus the best spells and specials: a set-up like Thunderhorn Blast looks useless on its own
    const top = [...live.slice(0, 4), ...live.slice(4).filter((x) => x.a.type === 'cast' || x.a.type === 'ability').slice(0, 4)];
    for (const x of top) {
      if (performance.now() - t0 > budget * 1.5) break;
      const b0 = evaluate(x.t, me, P);
      const hand1 = x.t.players[me].hand;
      const strike = (b: any) => b.type === 'attack' || b.type === 'ability' || (b.type === 'cast' && ['damage', 'poison', 'buffAttack', 'areaDamage'].includes(CARDS[hand1.find((h: any) => h.uid === b.uid)?.cardId]?.effect))
        || (b.type === 'move' && ab(x.t.board.creatures.find((c: any) => c.uid === b.creatureUid) || { cardId: 'goblin-grunt' }, 'charge'));
      const follow = shortlist(x.t, me, legalActions(x.t).filter(strike), rand, false);
      // best follow-up per unit; a set-up (spell or special) is credited with its two best follow-ups (Thunderhorn Blast helps every attacker)
      const perUnit = new Map<string, number>();
      for (const b of follow.slice(0, 20)) {
        const t2 = trial(x.t, b, me);
        if (!t2) continue;
        const d = evaluate(t2, me, P) - b0, k = b.creatureUid || b.uid || b.type;
        if (d > (perUnit.get(k) ?? 0)) perUnit.set(k, d);
      }
      const gains = [...perUnit.values()].sort((p, q) => q - p);
      const setup = x.a.type === 'cast' || x.a.type === 'ability';
      x.v += TUNE.lookW * ((gains[0] || 0) + (setup ? gains[1] || 0 : 0));
    }
  }
  scored.sort((x, y) => y.v - x.v);
  if ((globalThis as any).__aiDebug) (globalThis as any).__aiDebug.push({ turn: s.turn, phase: s.phase, base, top: scored.slice(0, 6).map((x) => [Math.round(x.v * 10) / 10, x.a.type, x.a.ability || x.a.creatureUid || x.a.uid, x.a.row ?? x.a.target?.row, x.a.col ?? x.a.target?.col]) });
  const min = hard ? TUNE.hardMin : TUNE.medMin;
  if (!scored.length || scored[0].v <= min) return done;
  if (!hard && scored.length > 1 && scored[1].v > min && rand() < TUNE.medMistake) return scored[1].a; // Medium makes the odd second-best choice
  return scored[0].a;
}

export function aiChoose(s: any, difficulty: string, rand: Rand, only?: string[]): any {
  const who = s.priority as string;
  const legal = legalActions(s).filter((a: any) => a.type !== 'surrender' && (!only || only.includes(a.type)));
  if (s.phase === 'mulligan') return { type: 'mulligan', redraw: difficulty !== 'easy' && canRedraw(s, who) && wantsRedraw(s, who), uids: [] };
  const pickBest = (scored: [number, any][], min: number) => {
    let best: any = null, bv = min;
    for (const [v, a] of scored) if (v > bv || (v === bv && best && rand() < 0.3)) { best = a; bv = v; }
    return best;
  };
  const done = legal.find((a: any) => a.type === 'done') || legal.find((a: any) => a.type === 'pass');

  if (difficulty === 'easy') {
    if (s.pendingResponse) {
      const r = legal.filter((a: any) => a.type === 'respond' || a.ability === 'brew');
      return r.length && rand() < 0.3 ? r[Math.floor(rand() * r.length)] : { type: 'pass' };
    }
    const acts = legal.filter((a: any) => a.type !== 'done' && a.type !== 'gathererSwap');
    if (!acts.length || rand() < 0.12) return done;
    const w = (a: any) => (a.type === 'summon' || a.type === 'attack' || a.type === 'mine' ? 3 : a.type === 'playCrystal' ? 2 : a.type === 'minerUpgrade' ? 0.3 : 1);
    let tot = acts.reduce((x: number, a: any) => x + w(a), 0);
    let r = rand() * tot;
    for (const a of acts) { r -= w(a); if (r <= 0) return a; }
    return acts[0];
  }

  if (s.pendingResponse) {
    const bw = legal.find((a: any) => a.ability === 'brew');
    if (bw) return bw;
  }
  if (s.pendingResponse) return pickBest(legal.map((a: any) => [scoreRespond(s, who, a), a]), 0.5) || { type: 'pass' };

  return smartChoose(s, difficulty === 'hard', rand, legal, done);
}
void FACTIONS;
