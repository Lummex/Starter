// The server referee for player-vs-player matches (Anvil, Nov 2). Pure: no network, no clock of its own (every call takes
// `now` in ms). Holds the ONLY full match state, applies each player's action through the same engine the game uses,
// keeps Ken's clock (2-minute phases, a 60 s bank of unused time, a 12 s Respond window that freezes the main clock),
// turns three timeouts in a row into a forfeit, and makes each player's view (view.ts): the other hand and both decks
// hidden, the dice rolled here and only here, and the second player's board mirrored so their browser plays as 'player'.
import { createMatch, applyAction, STARTER_DECKS, COMMANDERS, type Side } from '../engine';
import { presentFor, realAction } from '../engine/view';

export type Seat = 'a' | 'b';
export interface PlayerInfo { userId: string; username: string; avatar: string | null }
export interface DeckChoice { commander: string; cards: string[] | null; deckId: string | null; tiers?: number[] | null /* Nov 5: each slot's copy tier, parallel to cards */ }
export interface Rules { phaseSeconds: number; bankSeconds: number; respondSeconds: number; timeoutsToForfeit: number; mulliganSeconds?: number; respondMinSeconds?: number; attackMode?: 'armed' | 'window' }
export const DEFAULT_RULES: Rules = { phaseSeconds: 120, bankSeconds: 60, respondSeconds: 12, timeoutsToForfeit: 3, respondMinSeconds: 2 };
export interface Clock {
  deadline: number | null;        // ms; the priority holder's clock (null while a Respond window is open or the match is over)
  respondDeadline: number | null; // ms; the responder's clock during a Respond window
  respondOpenedAt?: number | null; // ms; when this Respond window opened (server only, never in a view): no window closes sooner than respondMinSeconds after it
  frozenLeft: number | null;      // ms left on the main clock while a Respond window is open
  bank: Record<Seat, number>;     // seconds of unused time carried into that player's next phase (Ken: capped at 60)
  timeouts: Record<Seat, number>; // timeouts in a row per player (a timely action resets it)
}
export interface MatchResult { winner: Seat | null; reason: 'win' | 'surrender' | 'timeout' | 'abandoned' }
export type MatchMode = 'friend' | 'ranked' | 'unranked' | 'practice';
export interface MatchRecord {
  id: string;
  mode?: MatchMode;       // Nov 5: friend (code), ranked / unranked (queue), practice (code, nothing paid or counted)
  tiers?: Record<Seat, Record<string, number>>; // Nov 5: each player's Commander tier ('commander-<id>' -> 2..5), public to both; a card's tier rides on its copy in the state
  rating?: Record<Seat, { before: number; after: number }>; // Nov 5: a ranked match's rating change, once the store paid it out
  roomCode: string | null;
  players: Record<Seat, PlayerInfo>;
  decks: Record<Seat, DeckChoice>;
  state: any;            // the FULL engine state; never leaves the server
  seq: number;
  status: 'active' | 'finished';
  clock: Clock;
  result: MatchResult | null;
  log: any[];            // every event so far (for the quest summary at the end)
  engineVersion: string;
  createdAt: number;
  endedAt: number | null;
  rewarded?: boolean;     // rewards/stats/quests were paid out (set once the store confirmed it)
}
export interface View {
  matchId: string; seq: number; status: 'active' | 'over'; mySide: Seat;
  state: any; events: any[];
  deadline: string | null; respondDeadline: string | null;
  bank: { me: number; them: number }; timeouts: { me: number; them: number };
  names: { me: string; them: string }; avatars: { me: string | null; them: string | null };
  result: null | { won: boolean; reason: string; mode?: string; rating?: { before: number; after: number } };
  tiers?: { me: Record<string, number>; them: Record<string, number> };
}

export const seatSide = (seat: Seat): Side => (seat === 'a' ? 'player' : 'opponent');
export const otherSeat = (seat: Seat): Seat => (seat === 'a' ? 'b' : 'a');
export const sideSeat = (side: Side | null): Seat | null => (side === 'player' ? 'a' : side === 'opponent' ? 'b' : null);
export function seatOf(m: MatchRecord, userId: string): Seat | null {
  return m.players.a.userId === userId ? 'a' : m.players.b.userId === userId ? 'b' : null;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** A match's deck options for the engine from one player's choice. */
function deckOpts(choice: DeckChoice, side: Side): any {
  const key = side === 'player' ? 'playerDeck' : 'opponentDeck';
  if (choice.cards && choice.cards.length) return { [key]: choice.cards.slice(), ...(choice.tiers && choice.tiers.length === choice.cards.length ? { [key + 'Tiers']: choice.tiers.slice() } : {}) };
  if (choice.deckId && STARTER_DECKS[choice.deckId]) return { [key + 'Id']: choice.deckId };
  return {};
}

/** Why a deck choice is not playable, or null. */
export function deckProblem(choice: DeckChoice): string | null {
  if (!choice || !COMMANDERS[choice.commander]) return 'Pick a Commander first.';
  if (choice.cards && choice.cards.length) return null; // the service checked the saved deck (validateDeck + ownership) before it got here
  if (choice.deckId && STARTER_DECKS[choice.deckId]) return null;
  return 'Pick a deck first.';
}

/** A fresh match between two seated players. `seed` is for the mine layout; every die and shuffle is rolled live. */
export function startMatch(id: string, roomCode: string | null, players: Record<Seat, PlayerInfo>, decks: Record<Seat, DeckChoice>, now: number, rules: Rules, seed: number, engineVersion: string): MatchRecord {
  const state = createMatch({ pvp: true, attackMode: rules.attackMode || 'armed', seed, playerCommander: decks.a.commander, opponentCommander: decks.b.commander, ...deckOpts(decks.a, 'player'), ...deckOpts(decks.b, 'opponent') });
  const m: MatchRecord = {
    id, roomCode, players: clone(players), decks: clone(decks), state, seq: 0, status: 'active',
    clock: { deadline: null, respondDeadline: null, frozenLeft: null, bank: { a: 0, b: 0 }, timeouts: { a: 0, b: 0 } },
    result: null, log: [], engineVersion, createdAt: now, endedAt: null,
  };
  m.clock.deadline = now + phaseMs(m, rules, holderOf(state));
  return m;
}

const holderOf = (s: any): Seat | null => sideSeat(s.priority);
const phaseMs = (m: MatchRecord, rules: Rules, seat: Seat | null) => (rules.phaseSeconds + (seat ? m.clock.bank[seat] : 0)) * 1000;
/** Which Respond window this is: a crystal or a side move inside it keeps it the same one. */
const windowKey = (p: any) => (p ? JSON.stringify([p.kind, p.actor, p.responder, p.creatureUid ?? null, p.card?.uid ?? null, p.target ?? null, (p.summons || []).length]) : '');

/** Moves the clock after an accepted action (`timedOut`: the action was the referee's own timeout move for `prevHolder`). */
function afterChange(m: MatchRecord, prev: any, now: number, rules: Rules, timedOut: boolean) {
  const s = m.state, c = m.clock;
  if (s.phase === 'over') { c.deadline = null; c.respondDeadline = null; c.respondOpenedAt = null; c.frozenLeft = null; return; }
  const prevHolder = holderOf(prev), holder = holderOf(s);
  const windowBefore = !!prev.pendingResponse, windowNow = !!s.pendingResponse;
  if (!windowBefore && windowNow) {
    // a Respond window opened: freeze the main clock, start the short one
    c.frozenLeft = Math.max(0, (c.deadline ?? now) - now);
    c.deadline = null;
    c.respondDeadline = now + rules.respondSeconds * 1000;
    c.respondOpenedAt = now;
    return;
  }
  if (windowBefore && windowNow) {
    // still (or again) inside a window (a brew during it, or a new window right away): give the responder a fresh short clock
    if (windowKey(s.pendingResponse) !== windowKey(prev.pendingResponse)) { c.respondDeadline = now + rules.respondSeconds * 1000; c.respondOpenedAt = now; }
    return;
  }
  if (windowBefore && !windowNow) {
    // the window closed: the main clock runs on from where it froze; a new phase may have started meanwhile (a counter can't, but be safe)
    c.respondDeadline = null;
    c.respondOpenedAt = null;
    const left = c.frozenLeft ?? phaseMs(m, rules, holder);
    c.frozenLeft = null;
    const samePhase = prev.phase === s.phase && prev.turn === s.turn && prev.activePlayer === s.activePlayer;
    c.deadline = samePhase ? now + left : now + phaseMs(m, rules, holder);
    return;
  }
  // no window: a phase or priority change restarts the clock; Ken's bank = the unused seconds of the phase that just ended (capped)
  const samePhase = prev.phase === s.phase && prev.turn === s.turn && prevHolder === holder && prev.activePlayer === s.activePlayer;
  if (samePhase) return;
  if (prevHolder) {
    if (timedOut) c.bank[prevHolder] = 0;
    else c.bank[prevHolder] = Math.min(rules.bankSeconds, Math.max(0, Math.floor(((c.deadline ?? now) - now) / 1000)));
  }
  c.deadline = now + phaseMs(m, rules, holder);
}

function endWith(m: MatchRecord, winner: Seat | null, reason: MatchResult['reason'], now: number) {
  if (m.status === 'finished') return;
  m.status = 'finished';
  m.result = { winner, reason };
  m.endedAt = now;
  m.clock.deadline = null; m.clock.respondDeadline = null; m.clock.respondOpenedAt = null; m.clock.frozenLeft = null;
}

export interface ActResult { ok: boolean; error?: string; events: any[]; tooSoonMs?: number }

/** One player's action. On success the record is changed in place (state, seq, clock, log) and the events are returned. */
export function playerAction(m: MatchRecord, userId: string, seq: number, action: any, now: number, rules: Rules): ActResult {
  const seat = seatOf(m, userId);
  if (!seat) return { ok: false, error: 'You are not in this match.', events: [] };
  if (m.status !== 'active') return { ok: false, error: 'The match is over.', events: [] };
  if (typeof seq !== 'number' || seq !== m.seq) return { ok: false, error: `Out of date (the match is at move ${m.seq}).`, events: [] };
  if (!action || typeof action.type !== 'string') return { ok: false, error: 'Invalid action', events: [] };
  const side = seatSide(seat);
  const real = realAction(action, side);
  const s = m.state;
  const isBrew = real.type === 'ability' && real.ability === 'brew';
  if (real.type === 'surrender') { real.player = side; }
  else if (isBrew) { real.player = side; }
  else if (s.phase === 'mulligan' && real.type === 'mulligan') { real.player = side; } // Nov 5 (Ken): both pick their hand at once
  else if (s.priority !== side) return { ok: false, error: "It is not your turn.", events: [] };
  else delete real.player; // a player can only ever act for their own side
  let r: any;
  try { r = applyAction(s, real); } catch (e: any) { return { ok: false, error: String((e && e.message) || e), events: [] }; }
  if (!r.ok) return { ok: false, error: r.error || 'Illegal action', events: [] };
  // Nov 2 (Gauge): a window with no counter takes about 2 s, so a window that closes sooner would say its responder holds something.
  // No answer closes one sooner, whoever sends it and however: refused here with how long is left, so a changed browser gains nothing.
  // A crystal or the attacker's own side move stays inside the window; only giving up ends it early. The views never show any of this.
  const openedAt = m.clock.respondOpenedAt;
  if (s.pendingResponse && real.type !== 'surrender' && openedAt != null && windowKey(r.state.pendingResponse) !== windowKey(s.pendingResponse)) {
    const left = openedAt + (rules.respondMinSeconds ?? 0) * 1000 - now;
    if (left > 0) return { ok: false, error: 'Too soon: the Respond window is still open.', events: [], tooSoonMs: left };
  }
  const prev = s;
  m.state = r.state;
  m.seq++;
  if (real.type !== 'pass') m.clock.timeouts[seat] = 0; // a pass proves nothing: the browser answers by itself when you hold no counter
  m.log.push(...r.events);
  afterChange(m, prev, now, rules, false);
  if (m.state.phase === 'over') endWith(m, sideSeat(m.state.winner), real.type === 'surrender' ? 'surrender' : 'win', now);
  return { ok: true, events: r.events };
}

/** The referee's own moves for players whose clock ran out. Returns the events (possibly several moves' worth). */
export function applyTimeouts(m: MatchRecord, now: number, rules: Rules): any[] {
  const out: any[] = [];
  for (let guard = 0; guard < 8 && m.status === 'active'; guard++) {
    const s = m.state, c = m.clock;
    let seat: Seat | null = null, action: any = null, respondRunOut = false;
    if (c.respondDeadline != null && now >= c.respondDeadline && s.pendingResponse) { seat = sideSeat(s.pendingResponse.responder); action = { type: 'pass' }; respondRunOut = true; }
    else if (c.deadline != null && now >= c.deadline && !s.pendingResponse) {
      if (s.phase === 'mulligan') { const side = (['player', 'opponent'] as const).find((x) => !s.mulliganDone[x]) || null; seat = sideSeat(side); action = { type: 'mulligan', uids: [], player: side }; } // Nov 5: both pick at once; the clock keeps the hand for whoever is late
      else { seat = holderOf(s); action = { type: 'done' }; }
    }
    if (!seat || !action) break;
    const r = applyAction(s, action);
    if (!r.ok) {
      // should not happen (pass / done / keep are always legal); never loop forever on it
      const fallback = applyAction(s, { type: 'surrender', player: seatSide(seat) });
      if (!fallback.ok) break;
      r.state = fallback.state; r.events = fallback.events; r.ok = true;
    }
    const prev = s;
    m.state = r.state;
    m.seq++;
    m.log.push(...r.events);
    if (respondRunOut) {
      // Nov 2 (Gauge): a Respond window running out just means "let it happen". It is never a timeout and never leads to a forfeit:
      // someone who looks away during the other player's turn can't lose in 36 s. The referee's pass is the only thing that happens.
      out.push(...r.events);
      afterChange(m, prev, now, rules, false);
      if (m.state.phase === 'over') { endWith(m, sideSeat(m.state.winner), 'win', now); break; }
      continue;
    }
    const ev = { type: 'timeout', player: seatSide(seat), count: c.timeouts[seat] + 1 };
    out.push(ev, ...r.events);
    m.log.push(ev);
    c.timeouts[seat]++;
    afterChange(m, prev, now, rules, true);
    if (m.state.phase === 'over') { endWith(m, sideSeat(m.state.winner), 'win', now); break; }
    if (c.timeouts[seat] >= rules.timeoutsToForfeit) {
      const r2 = applyAction(m.state, { type: 'surrender', player: seatSide(seat) });
      if (r2.ok) { m.state = r2.state; m.seq++; m.log.push(...r2.events); out.push(...r2.events); }
      endWith(m, otherSeat(seat), 'timeout', now);
      break;
    }
  }
  return out;
}

/** A player gives up. */
export function forfeit(m: MatchRecord, userId: string, now: number): ActResult {
  const seat = seatOf(m, userId);
  if (!seat) return { ok: false, error: 'You are not in this match.', events: [] };
  if (m.status !== 'active') return { ok: false, error: 'The match is over.', events: [] };
  const r = applyAction(m.state, { type: 'surrender', player: seatSide(seat) });
  if (!r.ok) return { ok: false, error: r.error, events: [] };
  m.state = r.state; m.seq++; m.log.push(...r.events);
  endWith(m, otherSeat(seat), 'surrender', now);
  return { ok: true, events: r.events };
}

const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());

/** What `seat` may see right now, with `events` (the latest accepted move's) presented for that seat. */
export function viewFor(m: MatchRecord, seat: Seat, events: any[]): View {
  const side = seatSide(seat), them = otherSeat(seat);
  const p = presentFor(m.state, events, side);
  return {
    matchId: m.id, seq: m.seq, status: m.status === 'finished' || m.state.phase === 'over' ? 'over' : 'active', mySide: seat,
    state: p.state, events: p.events,
    deadline: iso(m.clock.deadline), respondDeadline: iso(m.clock.respondDeadline),
    bank: { me: m.clock.bank[seat], them: m.clock.bank[them] }, timeouts: { me: m.clock.timeouts[seat], them: m.clock.timeouts[them] },
    names: { me: m.players[seat].username, them: m.players[them].username }, avatars: { me: m.players[seat].avatar, them: m.players[them].avatar },
    result: m.result ? { won: m.result.winner === seat, reason: m.result.reason, mode: m.mode || 'friend', ...(m.rating && m.rating[seat] ? { rating: m.rating[seat] } : {}) } : null,
    tiers: { me: (m.tiers && m.tiers[seat]) || {}, them: (m.tiers && m.tiers[them]) || {} },
  };
}

/** Both players' views after a change. */
export function viewsFor(m: MatchRecord, events: any[]): Record<Seat, View> {
  return { a: viewFor(m, 'a', events), b: viewFor(m, 'b', events) };
}

/** The next moment the referee has something to do, or null. */
export const nextDue = (m: MatchRecord): number | null => (m.status !== 'active' ? null : m.clock.respondDeadline ?? m.clock.deadline);
