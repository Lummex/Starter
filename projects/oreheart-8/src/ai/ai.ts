// Computer opponent. Uses only legalActions() and read-only engine helpers; never mutates state.
import { applyAction, legalActions, atkValue, CARDS, CONFIG, FACTIONS, other, spellCost, creatureAt, isMiner } from '../engine';

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
    if (card.abilities?.includes('ranged') && cheb(here, e) <= 7) v += 30;
    const adj = SITES.map((x: any, i: number) => ({ x, i })).filter(({ x }) => cheb(here, x) <= 1);
    if (adj.some(({ i }) => s.sites[i].controller !== who)) v += 8;
  }
  void uid;
  return v;
}

function mulliganUids(s: any, who: string) {
  const hand = s.players[who].hand;
  return hand.filter((h: any) => CARDS[h.cardId].type !== 'crystal' && CARDS[h.cardId].cost >= 6).map((h: any) => h.uid);
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
    case 'shield': return 12;
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
    case 'poison': return t && !t.poison ? 8 + CARDS[t.cardId].cost * 3 : 0;
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

/** Material + Commander Health balance from `who`'s point of view (used to score special abilities by simulation). */
function material(s: any, who: string): number {
  let v = 0;
  for (const c of s.board.creatures) v += (c.owner === who ? 1 : -1) * (CARDS[c.cardId].cost * 2 + c.health + c.attack);
  return v + (s.players[who].health - s.players[other(who as any)].health) * 3;
}
function scoreAbility(s: any, who: string, a: any): number {
  if (a.ability === 'blink' || a.ability === 'ward') return 0;
  const r: any = applyAction(s, a);
  if (!r.ok) return 0;
  const d = material(r.state, who) - material(s, who);
  return d >= 4 ? 30 + d : 0;
}

export function aiChoose(s: any, difficulty: string, rand: Rand): any {
  const who = s.priority as string;
  const legal = legalActions(s).filter((a: any) => a.type !== 'surrender');
  if (s.phase === 'mulligan') return { type: 'mulligan', uids: difficulty !== 'easy' && !s.players[who].mulligans ? mulliganUids(s, who) : [] };
  const pickBest = (scored: [number, any][], min: number) => {
    let best: any = null, bv = min;
    for (const [v, a] of scored) if (v > bv || (v === bv && best && rand() < 0.3)) { best = a; bv = v; }
    return best;
  };
  const done = legal.find((a: any) => a.type === 'done') || legal.find((a: any) => a.type === 'pass');

  if (difficulty === 'easy') {
    if (s.pendingResponse) {
      const r = legal.filter((a: any) => a.type === 'respond');
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

  if (s.pendingResponse) return pickBest(legal.map((a: any) => [scoreRespond(s, who, a), a]), 0.5) || { type: 'pass' };

  const hard = difficulty === 'hard';
  const scored: [number, any][] = [];
  // special abilities have many target options: simulate a sample of each kind only
  const seenAb: Record<string, number> = {};
  for (const a of legal) {
    if (a.type === 'ability') {
      const k = a.ability + ':' + a.creatureUid;
      seenAb[k] = (seenAb[k] || 0) + 1;
      if (seenAb[k] > 8 && rand() < 0.97) continue;
    }
    if (a.type === 'playCrystal') {
      const card = CARDS[s.players[who].hand.find((h: any) => h.uid === a.uid).cardId];
      scored.push([100, a]);
    } else if (a.type === 'summon') {
      const h = s.players[who].hand.find((x: any) => x.uid === a.uid);
      const card = CARDS[h.cardId];
      const myMiners = s.board.creatures.filter((c: any) => c.owner === who && isMiner(CARDS[c.cardId])).length;
      const flood = isMiner(card) ? Math.max(0, myMiners - 4) * 9 : 0; // 100-card decks hold 50 Miners: keep fighters coming
      scored.push([(card.role === 'Smith' ? 26 : 40) - flood + card.cost * 2 + posValue(s, who, card, a.row, a.col) * 0.5 + rand(), a]);
    } else if (a.type === 'gathererSwap') {
      const h = a.discardUid ? s.players[who].hand.find((x: any) => x.uid === a.discardUid) : null;
      const dc = h ? CARDS[h.cardId] : null;
      scored.push([dc ? 30 - (dc.type === 'crystal' ? 0 : dc.cost * 2) - (dc.cost <= 2 ? 10 : 0) : 30, a]);
    } else if (a.type === 'minerUpgrade') {
      // upgrade a strong fighter when nothing better can be summoned; Miner cards otherwise come down as Miners
      const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid);
      const cc = CARDS[c.cardId];
      scored.push([!isMiner(cc) && cc.cost >= 4 ? 28 + cc.cost + rand() : 0, a]);
    } else if (a.type === 'ability') scored.push([scoreAbility(s, who, a), a]);
    else if (a.type === 'cast') scored.push([scoreCast(s, who, a), a]);
    else if (a.type === 'mine') {
      const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid);
      const site = s.sites.find((x: any) => x.row === a.row && x.col === a.col);
      const enemyOwned = site && site.controller === other(who as any);
      scored.push([(isMiner(CARDS[c.cardId]) ? (enemyOwned ? 45 : 60) + (hard ? 15 : 0) : (s.turn >= 5 ? 1 : 14)) + rand(), a]);
    } else if (a.type === 'move') {
      const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid);
      const card = CARDS[c.cardId];
      const mate = creatureAt(s, a.row, a.col);
      let v = posValue(s, who, card, a.row, a.col) - posValue(s, who, card, c.row, c.col) + rand() * 0.1;
      if (mate) {
        const mc = CARDS[mate.cardId];
        v += posValue(s, who, mc, c.row, c.col) - posValue(s, who, mc, mate.row, mate.col) - 1;
      }
      scored.push([v, a]);
    } else if (a.type === 'attack') {
      const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid);
      if (a.target.commander) { scored.push([200 + atkValue(s, c) + (s.players[other(who as any)].health <= atkValue(s, c) ? 10000 : 0) + (hard && s.players[other(who as any)].health <= atkValue(s, c) * 2 ? 60 : 0), a]); continue; }
      const d = creatureAt(s, a.target.row, a.target.col);
      const dmg = atkValue(s, c, d);
      const kills = dmg - (CARDS[d.cardId].abilities?.includes('armored') ? 1 : 0) >= d.health;
      const melee = cheb(c, d) === 1 && !CARDS[c.cardId].abilities?.includes('ranged');
      const strike = melee && !CARDS[c.cardId].abilities?.includes('sneaky') ? atkValue(s, d, c) : 0;
      const dies = strike >= c.health;
      scored.push([dmg * 8 + (kills ? 40 + CARDS[d.cardId].cost * 6 : 0) + (hard && d.health < d.maxHealth ? 12 : 0) + (hard && isMiner(CARDS[d.cardId]) ? 8 : 0) - strike * 6 - (dies ? 10 + CARDS[c.cardId].cost * 8 : 0), a]);
    }
  }
  return pickBest(scored, 0.5) || done;
}
