// What one player may see of a match (Anvil, Nov 2). The server keeps the full state; each player gets a copy with the
// other hand hidden (card backs only), both decks hidden (counts only) and the seeded generator removed, so nothing in the
// network traffic tells a player what the other holds, what comes next or how the dice will fall. The second player's copy
// is then mirrored (mirror.ts) so their browser plays as 'player'.
import type { Side } from './engine';
import { other } from './engine';
import { mirror } from './mirror';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
export const isHidden = (card: any) => !!(card && card.hidden);

/** The state as `side` is allowed to see it (not yet mirrored). */
export function viewFor(state: any, side: Side): any {
  const v = clone(state);
  const them = v.players[other(side)];
  them.hand = them.hand.map((_: any, i: number) => ({ uid: 'h:' + i, hidden: true }));
  for (const who of ['player', 'opponent'] as Side[]) v.players[who].deck = v.players[who].deck.map((_: any, i: number) => ({ uid: 'd:' + i, hidden: true }));
  v.rng = 0;
  if (v.armed) v.armed[other(side)] = []; // what the other player set ahead of time is secret until it fires
  return v;
}

/** The events as `side` may see them: the other side's draws say only "drew a card". */
export function eventsFor(events: any[], side: Side): any[] {
  return clone(events).map((e: any) => {
    if (e && e.type === 'draw' && e.player !== side) return { type: 'draw', player: e.player, hidden: true };
    if (e && (e.type === 'arm' || e.type === 'disarm') && e.player !== side) return null; // a counter set ahead of time is secret until it fires
    return e;
  }).filter(Boolean);
}

/** State and events for a player, mirrored for engine side 'opponent' so every browser plays as 'player'. */
export function presentFor(state: any, events: any[], side: Side): { state: any; events: any[] } {
  const s = viewFor(state, side), ev = eventsFor(events, side);
  return side === 'opponent' ? { state: mirror(s), events: mirror(ev) } : { state: s, events: ev };
}

/** A player's action, turned back into a real one (side 'opponent' sends mirrored coordinates). */
export function realAction(action: any, side: Side): any {
  return side === 'opponent' ? mirror(action) : clone(action);
}
