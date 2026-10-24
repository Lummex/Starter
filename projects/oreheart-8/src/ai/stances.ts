// Stance AI for Card Play: chooses ONE unit action (move / attack / mine) for the player's units.
import { legalActions, previewAttack, CARDS, CONFIG, other, isMiner, creatureAt, spellCost } from '../engine';
import { aiChoose, Rand } from './ai';

export type Stance = 'aggressive' | 'mine-control' | 'guard' | 'free';
export const STANCES: { id: Stance; label: string; icon: string; desc: string }[] = [
  { id: 'aggressive', label: 'Aggressive', icon: '⚔️', desc: 'Miners mine; Fighters rush the enemy Commander.' },
  { id: 'mine-control', label: 'Mine Control', icon: '⛏️', desc: 'Win the crystal fight: protect mining, hunt enemy Miners.' },
  { id: 'guard', label: 'Guard', icon: '🛡️', desc: 'Stay near your Commander and Miners; hit what comes close.' },
  { id: 'free', label: 'Free-for-all', icon: '🗡️', desc: 'Units decide everything with the full computer AI.' },
];
export const UNIT_TYPES = ['move', 'attack', 'mine'];

const cheb = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
const sh = (p: string) => ({ row: CONFIG.strongholds[p][0], col: CONFIG.strongholds[p][1] });

function canAffordMost(s: any, who: string): boolean {
  const hand = s.players[who].hand.map((h: any) => CARDS[h.cardId]).filter((c: any) => c.type !== 'crystal');
  if (!hand.length) return true;
  const have = s.players[who].crystals + s.players[who].bank;
  const ok = hand.filter((c: any) => (c.type === 'spell' ? spellCost(s, who, c) : c.cost) <= have).length;
  return ok * 2 >= hand.length;
}

/** The unit-action the stance picks for `who`, or null when no unit has anything worth doing. */
export function stanceChoose(s: any, stance: Stance, who: string, difficulty: string, rand: Rand): any {
  if (stance === 'free') {
    const a = aiChoose(s, difficulty, rand, UNIT_TYPES);
    return a && UNIT_TYPES.includes(a.type) ? a : null;
  }
  const foe = other(who as any);
  const legal = legalActions(s).filter((a: any) => UNIT_TYPES.includes(a.type));
  if (!legal.length) return null;
  const myHome = sh(who), foeHome = sh(foe);
  const sites = s.sites.map((x: any) => ({ row: x.row, col: x.col, controller: x.controller }));
  const mine = s.board.creatures.filter((c: any) => c.owner === who);
  const foes = s.board.creatures.filter((c: any) => c.owner === foe);
  const foeMiners = foes.filter((c: any) => isMiner(CARDS[c.cardId]));
  const ownAllMines = sites.length > 0 && sites.every((x: any) => x.controller === who);
  const lowCrystals = !canAffordMost(s, who);
  const unit = (uid: string) => s.board.creatures.find((c: any) => c.uid === uid);
  const nearestDist = (p: any, list: any[]) => (list.length ? Math.min(...list.map((x) => cheb(p, x))) : 99);
  const attackCommanderMode = stance === 'aggressive' || ownAllMines || !foeMiners.length;
  let best: any = null, bv = -Infinity;
  const consider = (v: number, a: any) => { v += rand() * 0.05; if (v > bv) { bv = v; best = a; } };

  // does any move bring this unit closer to the goal? (used so that blockers only get attacked when in the way)
  const goalOf = (c: any) => {
    const card = CARDS[c.cardId];
    if (isMiner(card)) return sites.length ? sites.reduce((b: any, x: any) => (cheb(c, x) < cheb(c, b) ? x : b)) : foeHome;
    if (attackCommanderMode) return foeHome;
    const tgt = [...foeMiners, ...foes.filter((f: any) => nearestDist(f, sites) <= 2)];
    return tgt.length ? tgt.reduce((b: any, x: any) => (cheb(c, x) < cheb(c, b) ? x : b)) : (sites.length ? sites.reduce((b: any, x: any) => (cheb(c, x) < cheb(c, b) ? x : b)) : foeHome);
  };
  const canAdvance = new Set<string>();
  for (const a of legal) if (a.type === 'move') { const c = unit(a.creatureUid); if (c && cheb(a, goalOf(c)) < cheb(c, goalOf(c))) canAdvance.add(c.uid); }

  for (const a of legal) {
    const c = unit(a.creatureUid);
    if (!c) continue;
    const card = CARDS[c.cardId];
    const miner = isMiner(card);
    if (a.type === 'mine') {
      const site = s.sites.find((x: any) => x.row === a.row && x.col === a.col);
      const enemyOwned = site && site.controller === foe;
      if (miner) consider((enemyOwned ? 55 : 70), a);
      else if (stance === 'mine-control') consider(lowCrystals ? 5 : 12, a);
      continue;
    }
    if (a.type === 'move') {
      const g = goalOf(c);
      const gain = cheb(c, g) - cheb(a, g);
      if (stance === 'guard') {
        const homeOk = cheb(a, myHome) <= 2 || mine.some((m: any) => m.uid !== c.uid && isMiner(CARDS[m.cardId]) && cheb(a, m) <= 2);
        if (!miner && !homeOk) continue;
        if (miner) { const danger = foes.filter((f: any) => cheb(f, a) <= 2).length; if (danger) continue; }
        const near = nearestDist(a, foes);
        consider(20 + gain * 8 - (miner ? 0 : near > 3 ? 8 : 0), a);
        continue;
      }
      if (gain <= 0) continue;
      if (stance === 'mine-control' && miner && lowCrystals && !sites.some((x: any) => cheb(a, x) <= 1)) { consider(10 + gain * 4, a); continue; }
      consider(30 + gain * 10 + (nearestDist(a, foes) <= 1 ? 3 : 0), a);
      continue;
    }
    if (a.type === 'attack') {
      if (a.target && a.target.commander) { consider(250, a); continue; }
      const d = creatureAt(s, a.target.row, a.target.col);
      if (!d) continue;
      const pv: any = previewAttack(s, c.uid, a.target) || { youDeal: 0, youTake: 0, attackerDefeated: false, targetDefeated: false };
      const kill = pv.targetDefeated ? 30 : 0;
      if (stance === 'aggressive') { if (canAdvance.has(c.uid) && !pv.targetDefeated) continue; if (miner) continue; consider(40 + kill + pv.youDeal * 3 - pv.youTake * 2, a); continue; }
      if (stance === 'mine-control') {
        if (miner) { if (isMiner(CARDS[d.cardId]) && !pv.attackerDefeated && !lowCrystals) consider(65 + kill, a); continue; }
        const dm = isMiner(CARDS[d.cardId]) || nearestDist(d, sites) <= 2;
        consider((dm ? 75 : 35) + kill + pv.youDeal * 3 - pv.youTake * 2 - (pv.attackerDefeated ? 40 : 0), a);
        continue;
      }
      // guard: fight what comes near, but not a losing fight with a Miner
      if (miner && pv.attackerDefeated) continue;
      if (!miner && cheb(d, myHome) > 4 && !mine.some((m: any) => cheb(d, m) <= 2)) continue;
      consider(60 + kill + pv.youDeal * 3 - pv.youTake * 2 - (pv.attackerDefeated ? 30 : 0), a);
    }
  }
  return best;
}
