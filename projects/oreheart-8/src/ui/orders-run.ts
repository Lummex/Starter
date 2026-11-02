// Round 28 (owner, Oct 28-29): "move orders" runner.
// At the start of the player's Action phase, every unit with a standing order takes its step for this turn:
// a `move` order walks one normal move along its (re-planned) path; a `chase` order attacks automatically
// when the enemy is in range, otherwise walks toward it. No new rules: every step is an ordinary legal
// engine action sent through game.act(). Orders are the player's only; the computer is unchanged.
import type { Game } from '../game';
import { planOrder, nextStep, attackActionOn, chaseTarget, stanceAction, mineActionFor, type Order, type Stance, type Cell } from '../engine/orders';

export interface RunOrdersOptions { delayMs: number; onChange?: () => void; log?: (msg: string) => void; /** units with no order act by their stance after the ordered ones */ /** Ken, Nov 1 (guard arrows): the squares each guard watches and its post */ guards?: Map<string, { post: Cell; squares: Cell[] }>; stances?: Map<string, Stance> }
export interface RunOrdersResult { moved: string[]; attacked: string[]; blocked: string[]; done: string[] }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const RESPONSE_POLL_MS = 50;
const RESPONSE_MAX_MS = 30000;

/** True while the runner may still act: the same match and turn, the player's own Action phase, no Respond window. */
function canAct(game: Game, turn?: number, match?: any): boolean {
  const s = game.state;
  if (!s) return false;
  if (s.phase !== 'action' || s.activePlayer !== 'player' || s.priority !== 'player' || s.pendingResponse) return false;
  if ((s.mode ?? game.mode) !== 'standard' || game.mode !== 'standard' || s.tutorial) return false;
  if (turn != null && s.turn !== turn) return false;
  if (match !== undefined && game.options !== match) return false;
  return true;
}

/** Wait until a Respond window opened by our attack is answered (poll every 50 ms, give up quietly after 30 s). */
async function waitForResponse(game: Game, log: (m: string) => void): Promise<void> {
  let waited = 0;
  while (game.state && game.state.pendingResponse && game.state.phase !== 'over') {
    if (waited >= RESPONSE_MAX_MS) { log('orders: gave up waiting for the response window'); return; }
    await sleep(RESPONSE_POLL_MS);
    waited += RESPONSE_POLL_MS;
  }
}

export async function runOrders(game: Game, orders: Map<string, Order>, opts: RunOrdersOptions): Promise<RunOrdersResult> {
  const result: RunOrdersResult = { moved: [], attacked: [], blocked: [], done: [] };
  const log = (m: string) => { try { opts.log?.(m); } catch { /* ignore */ } };
  const changed = () => { try { opts.onChange?.(); } catch (e: any) { log('orders: onChange failed: ' + (e?.message || e)); } };
  try {
    if (!canAct(game) || (!orders.size && !opts.stances?.size)) return result;
    const turn = game.state.turn;
    const match = game.options;
    const find = (uid: string) => game.state.board.creatures.find((x: any) => x.uid === uid);
    let first = true;
    for (const [key, order] of Array.from(orders.entries())) {
      if (orders.get(key) !== order) continue; // removed or replaced meanwhile (e.g. the player cancelled)
      if (!canAct(game, turn, match)) { log('orders: stopped (phase, turn or match changed)'); break; }
      const c = find(order.uid);
      if (!c || c.owner !== 'player') { orders.delete(key); result.done.push(order.uid); changed(); continue; }
      let plan;
      try { plan = planOrder(game.state, order); } catch (e: any) { log('orders: plan failed for ' + order.uid + ': ' + (e?.message || e)); result.blocked.push(order.uid); continue; }
      if (plan.done) { orders.delete(key); result.done.push(order.uid); changed(); continue; }

      if (!first && opts.delayMs > 0) {
        await sleep(opts.delayMs);
        if (!canAct(game, turn, match)) { log('orders: stopped (phase, turn or match changed)'); break; }
      }

      if (order.kind === 'mine' && !plan.path.length) { // Ken, Nov 1: standing next to its mine: mine it (the order stays for next turn)
        const m = mineActionFor(game.state, c, order.site);
        if (m) { if (!first && opts.delayMs > 0) await sleep(opts.delayMs); const r = game.act(m); if (r.ok) { first = false; result.attacked.push(order.uid); changed(); } else result.blocked.push(order.uid); }
        continue;
      }
      // Combat v2 (Ken, Nov 1): a unit walks as far as its move points allow and a chaser attacks when in reach in the same turn
      let cur = c, curPlan = plan, legs = 0;
      while (legs++ < 8 && canAct(game, turn, match)) {
        if (order.kind === 'chase') {
          const enemy = chaseTarget(game.state, order);
          if (!enemy) { orders.delete(key); result.done.push(order.uid); changed(); break; }
          const attack = attackActionOn(game.state, cur, enemy);
          if (attack) {
            const r = game.act(attack);
            if (r.ok) {
              first = false;
              result.attacked.push(order.uid); // Ken, Nov 1: the order stays: it keeps attacking turn after turn, follows if the target runs, and goes on to the next target when this one is gone
              changed();
              if (game.state && game.state.pendingResponse) { await waitForResponse(game, log); changed(); }
            } else {
              log('orders: attack refused for ' + order.uid + ': ' + r.error);
              result.blocked.push(order.uid);
            }
            break;
          }
        }
        if (curPlan.blocked) { result.blocked.push(order.uid); break; }
        const step = nextStep(game.state, cur, curPlan.path);
        if (!step) { result.blocked.push(order.uid); break; }
        const r = game.act({ type: 'move', creatureUid: cur.uid, row: step.row, col: step.col });
        if (!r.ok) { log('orders: move refused for ' + order.uid + ': ' + r.error); result.blocked.push(order.uid); break; }
        first = false;
        if (!result.moved.includes(order.uid)) result.moved.push(order.uid);
        changed();
        const again = find(order.uid);
        if (!again) break;
        if (order.kind === 'move') {
          let after;
          try { after = planOrder(game.state, order); } catch { after = null; }
          if (after && after.done) { orders.delete(key); result.done.push(order.uid); break; }
          if (!after || after.blocked) break;
          curPlan = after;
        } else {
          try { curPlan = planOrder(game.state, order); } catch { break; }
          if (curPlan.done) { orders.delete(key); result.done.push(order.uid); changed(); break; }
          if (order.kind === 'mine' && !curPlan.path.length) { const m = mineActionFor(game.state, again, order.site); if (m) { const r = game.act(m); if (r.ok) { result.attacked.push(order.uid); changed(); } } break; } // arrived: mine now if it still can
        }
        cur = again;
        if ((cur.movesLeft ?? 0) < 1) break;
        if (opts.delayMs > 0) { await sleep(opts.delayMs); if (!canAct(game, turn, match)) break; }
      }
    }
    if (opts.stances) for (const [uid, stance] of Array.from(opts.stances.entries())) {
      if (orders.has(uid)) continue; // an order beats the stance
      if (!canAct(game, turn, match)) break;
      const c = find(uid);
      if (!c) { opts.stances.delete(uid); continue; }
      for (let legs = 0; legs < 4 && canAct(game, turn, match); legs++) { // v2: a stance may walk and then attack in the same turn
        const cc = find(uid); if (!cc) break;
        const g = opts.guards?.get(uid); const a = stanceAction(game.state, cc, stance, g?.squares, g?.post);
        if (!a) break;
        if (!first && opts.delayMs > 0) { await sleep(opts.delayMs); if (!canAct(game, turn, match)) break; }
        const r = game.act(a);
        if (!r.ok) { log('stance: refused for ' + uid + ': ' + r.error); break; }
        first = false;
        if (a.type === 'attack') { result.attacked.push(uid); changed(); if (game.state && game.state.pendingResponse) { await waitForResponse(game, log); changed(); } break; }
        if (!result.moved.includes(uid)) result.moved.push(uid);
        changed();
        if (stance === 'guard') break;
      }
    }
  } catch (e: any) {
    log('orders: runner error: ' + (e?.message || e));
  }
  return result;
}
