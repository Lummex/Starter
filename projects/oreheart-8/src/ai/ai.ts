// Computer opponent. Uses only legalActions() and read-only engine helpers; never mutates state.
import { legalActions, atkValue, CARDS, CONFIG, FACTIONS, other, spellCost, creatureAt } from '../engine';

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
const SITES = (CONFIG.sites as number[][]).map(([row, col]) => ({ row, col }));
const sh = (p: string) => ({ row: CONFIG.strongholds[p][0], col: CONFIG.strongholds[p][1] });

function posValue(s: any, who: string, card: any, row: number, col: number, uid?: string) {
  const foe = other(who as any);
  const here = { row, col };
  const enemies = s.board.creatures.filter((c: any) => c.owner === foe);
  let v = 0;
  if (card.role === 'Gatherer') {
    const adj = SITES.map((x, i) => ({ x, i })).filter(({ x }) => cheb(here, x) <= 1);
    if (adj.length) v += 30 + adj.length * 5 + (adj.some(({ i }) => s.sites[i].controller !== foe) ? 8 : 0);
    else v -= 3 * Math.min(...SITES.map((x) => cheb(here, x)));
    v -= 12 * enemies.filter((e: any) => cheb(e, here) <= 2).length;
  } else {
    const e = sh(foe);
    v -= 2 * cheb(here, e);
    if (cheb(here, e) <= 1) v += 40;
    if (card.abilities.includes('ranged') && cheb(here, e) <= 2) v += 30;
    const adj = SITES.map((x, i) => ({ x, i })).filter(({ x }) => cheb(here, x) <= 1);
    if (adj.length) v += 6 + (adj.some(({ i }) => s.sites[i].controller !== who) ? 6 : 0);
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
  const left = Object.values(s.players[who].crystals).reduce((x: number, y: any) => x + y, 0) as number - spellCost(s, who as any, card);
  switch (card.effect) {
    case 'damage': {
      if (a.target.commander) return s.players[foe].health <= card.params.amount ? 10000 : s.players[foe].health <= 8 ? 40 : 18;
      if (!t) return 0;
      const kills = t.health <= card.params.amount - (CARDS[t.cardId].abilities.includes('armored') ? 1 : 0);
      return kills ? 50 + CARDS[t.cardId].cost * 6 : 5;
    }
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
      if (!t || CARDS[t.cardId].role !== 'Gatherer') return 0;
      return posValue(s, who, CARDS[t.cardId], a.to.row, a.to.col) - posValue(s, who, CARDS[t.cardId], t.row, t.col) - 15;
    }
    case 'heal': return t && t.maxHealth - t.health >= 3 && left >= 3 ? 12 : 0;
    default: return 0;
  }
}

export function aiChoose(s: any, difficulty: string, rand: Rand): any {
  const who = s.priority as string;
  const legal = legalActions(s).filter((a: any) => a.type !== 'surrender');
  if (s.phase === 'mulligan') return { type: 'mulligan', uids: difficulty === 'normal' ? mulliganUids(s, who) : [] };
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
    const w = (a: any) => (a.type === 'summon' || a.type === 'attack' ? 3 : a.type === 'playCrystal' ? 2 : a.type === 'upgrade' ? 0.3 : 1);
    let tot = acts.reduce((x: number, a: any) => x + w(a), 0);
    let r = rand() * tot;
    for (const a of acts) { r -= w(a); if (r <= 0) return a; }
    return acts[0];
  }

  if (s.pendingResponse) return pickBest(legal.map((a: any) => [scoreRespond(s, who, a), a]), 0.5) || { type: 'pass' };

  const scored: [number, any][] = [];
  const fcol = FACTIONS[s.players[who].faction].crystal;
  for (const a of legal) {
    if (a.type === 'playCrystal') {
      const card = CARDS[s.players[who].hand.find((h: any) => h.uid === a.uid).cardId];
      if (card.effect === 'chooseColors' && a.colors[fcol] !== card.params.amount) continue;
      scored.push([100, a]);
    } else if (a.type === 'summon') {
      const h = s.players[who].hand.find((x: any) => x.uid === a.uid);
      const card = CARDS[h.cardId];
      scored.push([40 + card.cost * 2 + posValue(s, who, card, a.row, a.col) * 0.5 + rand(), a]);
    } else if (a.type === 'gathererSwap') {
      const h = a.discardUid ? s.players[who].hand.find((x: any) => x.uid === a.discardUid) : null;
      const dc = h ? CARDS[h.cardId] : null;
      scored.push([dc ? 30 - (dc.type === 'crystal' ? 0 : dc.cost * 2) - (dc.cost <= 2 ? 10 : 0) : 30, a]);
    } else if (a.type === 'upgrade') {
      const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid);
      const u = a.upgrade;
      const left = s.players[who].crystals[fcol] - CONFIG.upgradeCosts[u];
      scored.push([left >= 0 && (u === 'heavy-armor' || u === 'sharpened-weapons') && CARDS[c.cardId].role === 'Fighter' ? 12 + rand() : 0, a]);
    } else if (a.type === 'cast') scored.push([scoreCast(s, who, a), a]);
    else if (a.type === 'move') {
      const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid);
      const card = CARDS[c.cardId];
      scored.push([posValue(s, who, card, a.row, a.col) - posValue(s, who, card, c.row, c.col) + rand() * 0.1, a]);
    } else if (a.type === 'attack') {
      const c = s.board.creatures.find((x: any) => x.uid === a.creatureUid);
      if (a.target.commander) { scored.push([200 + atkValue(s, c) + (s.players[other(who as any)].health <= atkValue(s, c) ? 10000 : 0), a]); continue; }
      const d = creatureAt(s, a.target.row, a.target.col);
      const dmg = atkValue(s, c, d);
      const kills = dmg - (CARDS[d.cardId].abilities.includes('armored') ? 1 : 0) >= d.health;
      const melee = cheb(c, d) === 1 && !CARDS[c.cardId].abilities.includes('ranged');
      const strike = melee && !CARDS[c.cardId].abilities.includes('sneaky') ? atkValue(s, d, c) : 0;
      const dies = strike >= c.health;
      scored.push([dmg * 8 + (kills ? 40 + CARDS[d.cardId].cost * 6 : 0) - strike * 6 - (dies ? 10 + CARDS[c.cardId].cost * 8 : 0), a]);
    }
  }
  return pickBest(scored, 0.5) || done;
}
