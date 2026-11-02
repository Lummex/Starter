// Nov 1 (Ken: "you need to defend your commander ... you're either offense or defense. Or a mix of both ... the AI needs to use the new marker
// system too, to where he's planning out his attacks. If he sees that the commander's open, he should just rush the Commander").
// The computer plans with the SAME order system as the player (engine/orders.ts: chase orders with chained targets, move orders, the Guard /
// Hold / Aggressive stances) and no extra rules: every step it takes is a plain legal engine action. At the start of its Action phase, and again
// whenever the board changes, it reads the board (styles.ts) and hands every fighter a standing order:
//   defend  - rushers near its Commander: the nearest fighters chase them (chained), the rest stand Guard by the Commander;
//   rush    - the enemy Commander is open (no fighters guarding him) or the plan is all-out: fighters chase 'cmd:<enemy>' and hit him every turn;
//   hunt    - the enemy's Miners sit on mines and ours don't: chase them;
//   fortify - our Miners are threatened: Guard beside them;
//   regroup - our Commander is low: back to him;
//   steady  - chase the nearest enemy fighter (Aggressive).
// Hard commits more fighters and chains targets; Medium commits fewer and chains nothing. Miners, summons, spells and abilities still come from
// the scorer in ai.ts, so nothing else about the computer changed.
import { CARDS, CONFIG, isMiner, legalActions, previewAttack, other } from '../engine';
import { planOrder, nextStep, attackActionOn, chaseTarget, stanceAction, type Order, type Stance, type Cell } from '../engine/orders';
import { planFor, type StyleId } from './styles';

export type AiRole = 'defend' | 'rush' | 'hunt' | 'fortify' | 'regroup' | 'steady';
export interface AiPlanState { turn: number; key: string; plan: string; orders: Map<string, Order>; stances: Map<string, Stance>; roles: Map<string, AiRole>; /** Ken, Nov 1 (guard arrows): home guards watch the squares round the Commander */ guards: Map<string, { post: Cell; squares: Cell[] }> }

const plans = new Map<string, AiPlanState>();
const cheb = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
const sh = (p: string) => ({ row: CONFIG.strongholds[p][0], col: CONFIG.strongholds[p][1] });
const fighter = (c: any) => !isMiner(CARDS[c.cardId]);

/** What the plan reads: whatever moves, fights or dies re-plans (the computer changes its plans as the board changes). */
const boardKey = (s: any, me: string) => s.turn + '|' + s.phase + '|' + s.players.player.health + '|' + s.players.opponent.health + '|' + s.board.creatures.map((c: any) => c.uid + c.row + ',' + c.col + 'h' + c.health).join(';') + '|' + me;

/** The current plan for a side (test hook via game.aiOrders). */
export const aiPlanState = (me: string): AiPlanState | null => plans.get(me) || null;
export const aiPlanSummary = (me: string) => { const p = plans.get(me); return p ? { turn: p.turn, plan: p.plan, orders: [...p.orders.values()], stances: Object.fromEntries(p.stances), roles: Object.fromEntries(p.roles), guards: Object.fromEntries(p.guards) } : null; };

export function planAiOrders(s: any, me: string, style: StyleId, hard: boolean): AiPlanState {
  const foe = other(me as any) as string, myHome = sh(me), foeHome = sh(foe);
  const read = planFor(s, me, style), plan = read.plan;
  const mine = s.board.creatures.filter((c: any) => c.owner === me && fighter(c));
  const foes = s.board.creatures.filter((c: any) => c.owner === foe);
  const foeFighters = foes.filter(fighter);
  const rushers = foeFighters.filter((f: any) => cheb(f, myHome) <= 4).sort((a: any, b: any) => cheb(a, myHome) - cheb(b, myHome));
  const foeGuards = foeFighters.filter((f: any) => cheb(f, foeHome) <= 3);
  const foeMinersOnMines = foes.filter((c: any) => isMiner(CARDS[c.cardId]) && s.sites.some((x: any) => cheb(c, x) <= 1));
  const myMiners = s.board.creatures.filter((c: any) => c.owner === me && isMiner(CARDS[c.cardId]));
  const myHealth = s.players[me].health, foeHealth = s.players[foe].health;
  const orders = new Map<string, Order>(), stances = new Map<string, Stance>(), roles = new Map<string, AiRole>(), guards = new Map<string, { post: Cell; squares: Cell[] }>();
  const homeRing: Cell[] = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && myHome.row + dr >= 1 && myHome.row + dr <= CONFIG.boardHeight && myHome.col + dc >= 1 && myHome.col + dc <= CONFIG.boardWidth) homeRing.push({ row: myHome.row + dr, col: myHome.col + dc });

  // 1. defence first: how many fighters turn back
  const byHome = mine.slice().sort((a: any, b: any) => cheb(a, myHome) - cheb(b, myHome));
  let nDef = 0;
  if (rushers.length) {
    const danger = read.read.rush;
    if (danger >= 1.2 || myHealth <= 8) nDef = byHome.filter((c: any) => cheb(c, myHome) <= 6).length;
    else if (danger >= 0.5) nDef = Math.ceil(rushers.length * (hard ? 1 : 0.75));
    else nDef = hard ? Math.min(1, rushers.length) : 0;
  } else if (plan === 'hold' || plan === 'build') nDef = mine.length >= 2 ? 1 : 0; // a Defensive plan keeps one guard home
  nDef = Math.min(nDef, mine.length);
  const defenders = byHome.slice(0, nDef), others = byHome.slice(nDef);
  for (const c of defenders) {
    roles.set(c.uid, 'defend');
    if (rushers.length) { const chain = hard ? rushers.slice(1, 3).map((r: any) => r.uid) : []; orders.set(c.uid, { kind: 'chase', uid: c.uid, targetUid: rushers[0].uid, ...(chain.length ? { then: chain } : {}) }); }
    else { stances.set(c.uid, 'guard'); const spot = cheb(c, myHome) > 2 ? homeSpot(s, c, myHome) : null; if (spot) orders.set(c.uid, { kind: 'move', uid: c.uid, dest: spot }); guards.set(c.uid, { post: spot || { row: c.row, col: c.col }, squares: homeRing }); } // a home guard watches the squares round the Commander (guard arrows) and never chases
  }

  // 2. offence for the rest
  const open = foeGuards.length === 0 || foeHealth <= 6;
  const allOut = plan === 'allout' || plan === 'counterpush';
  for (const c of others) {
    if (plan === 'regroup' && myHealth <= 10) { roles.set(c.uid, 'regroup'); stances.set(c.uid, 'guard'); const spot = cheb(c, myHome) > 2 ? homeSpot(s, c, myHome) : null; if (spot) orders.set(c.uid, { kind: 'move', uid: c.uid, dest: spot }); continue; }
    if (open || allOut) { roles.set(c.uid, 'rush'); orders.set(c.uid, { kind: 'chase', uid: c.uid, targetUid: 'cmd:' + foe }); continue; }
    if ((plan === 'hunt' || read.read.mineGap >= 1) && foeMinersOnMines.length) {
      roles.set(c.uid, 'hunt');
      const near = foeMinersOnMines.slice().sort((a: any, b: any) => cheb(a, c) - cheb(b, c));
      orders.set(c.uid, { kind: 'chase', uid: c.uid, targetUid: near[0].uid, ...(hard && near.length > 1 ? { then: near.slice(1, 3).map((m: any) => m.uid) } : {}) });
      continue;
    }
    if (plan === 'fortify' && myMiners.length) {
      roles.set(c.uid, 'fortify'); stances.set(c.uid, 'guard');
      const exposed = myMiners.slice().sort((a: any, b: any) => nearestFoe(a, foeFighters) - nearestFoe(b, foeFighters))[0];
      if (cheb(c, exposed) > 1) { const spot = homeSpot(s, c, exposed); if (spot) orders.set(c.uid, { kind: 'move', uid: c.uid, dest: spot }); }
      continue;
    }
    if (plan === 'hold' || plan === 'build') { roles.set(c.uid, 'steady'); stances.set(c.uid, 'hold'); continue; }
    // steady: go after the nearest enemy fighter (the Commander when nobody is left to fight)
    roles.set(c.uid, 'steady');
    if (foeFighters.length) {
      const near = foeFighters.slice().sort((a: any, b: any) => cheb(a, c) - cheb(b, c));
      orders.set(c.uid, { kind: 'chase', uid: c.uid, targetUid: near[0].uid, ...(hard && near.length > 1 ? { then: near.slice(1, 3).map((f: any) => f.uid) } : {}) });
    } else orders.set(c.uid, { kind: 'chase', uid: c.uid, targetUid: 'cmd:' + foe });
  }
  // Ken, Nov 1: a Miner not yet beside a mine gets a standing mining order to the nearest mine with a free square beside it (the scorer still decides the mining itself)
  for (const m of myMiners) {
    if (s.sites.some((x: any) => cheb(m, x) <= 1)) continue;
    const site = s.sites.slice().sort((a: any, b: any) => cheb(a, m) - cheb(b, m)).find((x: any) => homeSpot(s, m, x));
    if (site) { orders.set(m.uid, { kind: 'mine', uid: m.uid, site: { row: site.row, col: site.col } }); roles.set(m.uid, 'steady'); }
  }
  const st: AiPlanState = { turn: s.turn, key: boardKey(s, me), plan, orders, stances, roles, guards };
  plans.set(me, st);
  return st;
}

const nearestFoe = (c: any, foes: any[]) => (foes.length ? Math.min(...foes.map((f) => cheb(f, c))) : 99);
/** A free square next to `at` (nearest to the unit); null when there is none. */
function homeSpot(s: any, c: any, at: { row: number; col: number }) {
  let best: any = null;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const q = { row: at.row + dr, col: at.col + dc };
    if ((dr || dc) && q.row >= 1 && q.row <= CONFIG.boardHeight && q.col >= 1 && q.col <= CONFIG.boardWidth && !s.board.creatures.some((x: any) => x.row === q.row && x.col === q.col) && !s.sites.some((x: any) => x.row === q.row && x.col === q.col) && !(['player', 'opponent'] as const).some((p) => sh(p).row === q.row && sh(p).col === q.col)) {
      if (!best || cheb(q, c) < cheb(best, c)) best = q;
    }
  }
  return best;
}

/** The next order-driven unit action for `me`, or null when no ordered unit has a step left (the scorer takes over: Miners, cards, abilities, done). */
export function aiOrderAction(s: any, me: string, hard: boolean, style: StyleId = 'balanced'): any | null {
  if (s.phase !== 'action' || s.priority !== me || s.pendingResponse || s.winner) return null;
  let st = plans.get(me);
  const key = boardKey(s, me);
  if (!st || st.key !== key) st = planAiOrders(s, me, style, hard);
  const legal = legalActions(s);
  const canAct = new Set(legal.filter((a: any) => a.creatureUid).map((a: any) => a.creatureUid));
  let best: { v: number; a: any } | null = null;
  const offer = (v: number, a: any) => { if (!best || v > best.v) best = { v, a }; };
  for (const c of s.board.creatures) {
    if (c.owner !== me || !canAct.has(c.uid)) continue;
    const o = st.orders.get(c.uid), role = st.roles.get(c.uid);
    if (o?.kind === 'chase') {
      const t = chaseTarget(s, o);
      if (!t) continue;
      const atk = attackActionOn(s, c, t);
      if (atk && legal.some((a: any) => a.type === 'ability' && a.creatureUid === c.uid)) continue; // a unit that could use an ability first (Thunderhorn Blast, a brew...) is left to the scorer this call
      if (atk) {
        let ok = true;
        if (!t.commander && role !== 'defend') { const pv: any = previewAttack(s, c.uid, atk.target); if (pv && pv.attackerDefeated && !pv.targetDefeated) ok = false; } // no suicide for nothing (defenders fight anyway)
        if (ok) { offer(30 + (t.commander ? 20 : 0) + (role === 'defend' ? 10 : 0), atk); continue; }
      }
      const p = planOrder(s, o);
      if (!p.blocked && p.path.length) { const step = nextStep(s, c, p.path); if (step) offer(10 + (role === 'defend' ? 5 : 0) + (role === 'rush' ? 3 : 0), { type: 'move', creatureUid: c.uid, row: step.row, col: step.col }); }
      continue;
    }
    if (o?.kind === 'mine') { // walk toward the mine; beside it the scorer mines (it weighs group mining, Mine All and the Flow)
      const p = planOrder(s, o);
      if (!p.blocked && p.path.length) { const step = nextStep(s, c, p.path); if (step) offer(6, { type: 'move', creatureUid: c.uid, row: step.row, col: step.col }); }
      continue;
    }
    if (o?.kind === 'move') {
      const p = planOrder(s, o);
      if (!p.done && !p.blocked && p.path.length) { const step = nextStep(s, c, p.path); if (step) offer(8, { type: 'move', creatureUid: c.uid, row: step.row, col: step.col }); }
      const stn = st.stances.get(c.uid), g = st.guards.get(c.uid); if (stn) { const a = stanceAction(s, c, stn, g?.squares, g?.post); if (a) offer(a.type === 'attack' ? 25 : 4, a); }
      continue;
    }
    const stn = st.stances.get(c.uid), g = st.guards.get(c.uid);
    if (stn) { const a = stanceAction(s, c, stn, g?.squares, g?.post); if (a) offer(a.type === 'attack' ? 25 : 4, a); }
  }
  return best ? (best as any).a : null;
}
