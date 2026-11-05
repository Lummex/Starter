// The PvP service (Anvil, Nov 2): the operations behind the `match` server function, written once over a small `Store`
// interface so the same code runs in the Supabase Edge Function (Deno + Postgres) and in the local mock server
// (Node + memory) that the hidden checks use. See factory-design/design/oreheart-pvp-nov2-contract.md part 2.5.
import { validateDeck, STARTER_DECKS, COMMANDERS } from '../engine';
import { startMatch, playerAction, applyTimeouts, forfeit, viewsFor, viewFor, seatOf, deckProblem, DEFAULT_RULES, type MatchRecord, type PlayerInfo, type DeckChoice, type Rules, type Seat, type View } from './referee';

export interface Room {
  code: string;
  host: PlayerInfo; hostDeck: DeckChoice;
  guest: PlayerInfo | null; guestDeck: DeckChoice | null;
  status: 'waiting' | 'started' | 'cancelled' | 'expired';
  matchId: string | null;
  createdAt: number; expiresAt: number;
}
export interface MoveLog { matchId: string; seq: number; userId: string; action: any; ok: boolean; error: string | null; ms: number }
export interface Summaries { a: any; b: any }

/** Storage the service needs. Every method may throw; the handler turns throws into { ok:false, error }. */
export interface Store {
  getRoom(code: string): Promise<Room | null>;
  putRoom(room: Room): Promise<void>;
  /** the player's own saved deck (card ids) by its id, or null */
  getSavedDeck(userId: string, deckId: string): Promise<{ commander: string; cards: string[] } | null>;
  getMatch(id: string): Promise<MatchRecord | null>;
  insertMatch(m: MatchRecord): Promise<void>;
  /** compare-and-swap on seq: false when someone else changed the match first */
  updateMatch(m: MatchRecord, expectedSeq: number): Promise<boolean>;
  putViews(m: MatchRecord, views: Record<Seat, View>): Promise<void>;
  logMove(mv: MoveLog): Promise<void>;
  activeMatchFor(userId: string): Promise<string | null>;
  /** claims a waiting room for this guest and match in one step; false when someone else got there first (or it expired) */
  claimRoom(room: Room): Promise<boolean>;
  /** called when a match ends (rewards, stats, quests); idempotent on the store side; true when it went through (false = retry later) */
  finished(m: MatchRecord, summaries: Summaries): Promise<boolean>;
  newId(): string;
  random(): number; // [0,1) from a secure source
}

export interface ServiceOptions {
  rules?: Rules;
  engineVersion?: string;
  /** quest summary of one seat from the full event log (Helper B's quest-summary.ts once bundled); a stub counts turns and the win */
  summarize?: (events: any[], finalState: any, side: 'player' | 'opponent') => any;
}

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (they read like 1 and 0)
export const ROOM_MINUTES = 30;
export const isCode = (c: unknown): c is string => typeof c === 'string' && /^[A-HJ-NP-Z]{6}$/.test(c);

export class ServiceError extends Error {}
const fail = (msg: string): never => { throw new ServiceError(msg); };

function basicSummary(events: any[], finalState: any, side: 'player' | 'opponent') {
  return { turns: finalState?.turn ?? 0, won: finalState?.winner === side, commander: finalState?.players?.[side]?.commanderId ?? null, battles: 1, wins: finalState?.winner === side ? 1 : 0 };
}

export class PvpService {
  rules: Rules;
  engineVersion: string;
  summarize: NonNullable<ServiceOptions['summarize']>;
  constructor(public store: Store, opts: ServiceOptions = {}) {
    this.rules = opts.rules ?? DEFAULT_RULES;
    this.engineVersion = opts.engineVersion ?? 'dev';
    this.summarize = opts.summarize ?? basicSummary;
  }

  /** One request. Never throws for a player mistake: returns { ok:false, error }. */
  async handle(op: string, body: any, user: PlayerInfo, now: number): Promise<any> {
    try {
      switch (op) {
        case 'create': return await this.create(body, user, now);
        case 'cancel': return await this.cancel(body, user, now);
        case 'join': return await this.join(body, user, now);
        case 'room': return await this.room(body, user, now);
        case 'my_match': return { ok: true, matchId: await this.store.activeMatchFor(user.userId) };
        case 'state': return await this.withMatch(body, user, now, async (m) => ({ view: viewFor(m, seatOf(m, user.userId)!, []) }));
        case 'act': return await this.act(body, user, now);
        case 'tick': return await this.withMatch(body, user, now, async (m) => ({ view: viewFor(m, seatOf(m, user.userId)!, []) }));
        case 'forfeit': return await this.forfeit(body, user, now);
        default: return { ok: false, error: `Unknown op "${op}"` };
      }
    } catch (e: any) {
      if (e instanceof ServiceError) return { ok: false, error: e.message };
      console.error('pvp service', op, String((e && e.message) || e)); // the detail stays in the log, never in a player's screen
      return { ok: false, error: 'Something went wrong on the server. Try again in a moment.' };
    }
  }

  private newCode(): string {
    let s = '';
    for (let i = 0; i < 6; i++) s += CODE_LETTERS[Math.floor(this.store.random() * CODE_LETTERS.length)];
    return s;
  }

  /** The deck a player asked for: a starter deck id, or one of their own saved decks (checked again here). */
  private async deckFor(user: PlayerInfo, body: any): Promise<DeckChoice> {
    const commander = String(body?.commander || '');
    if (!COMMANDERS[commander]) fail('Pick a Commander first.');
    const deckId = body?.deckId != null ? String(body.deckId) : '';
    if (!deckId) fail('Pick a deck first.');
    if (STARTER_DECKS[deckId]) {
      const v = validateDeck(STARTER_DECKS[deckId].slice(), commander);
      if (!v.legal) fail(`That starter deck can't go with ${COMMANDERS[commander].name}.`);
      return { commander, cards: null, deckId };
    }
    const saved = await this.store.getSavedDeck(user.userId, deckId);
    if (!saved) fail("That deck isn't one of yours.");
    const v = validateDeck(saved.cards.slice(), commander);
    if (!v.legal) fail('That deck is not legal: ' + v.problems.join('; '));
    return { commander, cards: saved.cards.slice(), deckId };
  }

  async create(body: any, user: PlayerInfo, now: number) {
    if (await this.store.activeMatchFor(user.userId)) fail('You are already in a match. Finish it first.');
    const deck = await this.deckFor(user, body);
    let code = this.newCode();
    for (let i = 0; i < 20 && (await this.store.getRoom(code)); i++) code = this.newCode();
    const room: Room = { code, host: user, hostDeck: deck, guest: null, guestDeck: null, status: 'waiting', matchId: null, createdAt: now, expiresAt: now + ROOM_MINUTES * 60 * 1000 };
    await this.store.putRoom(room);
    return { ok: true, code, expiresAt: new Date(room.expiresAt).toISOString() };
  }

  async cancel(body: any, user: PlayerInfo, now: number) {
    const room = await this.roomOf(body);
    if (room.host.userId !== user.userId) fail('Only the player who made the code can cancel it.');
    if (room.status === 'waiting') { room.status = 'cancelled'; await this.store.putRoom(room); }
    void now;
    return { ok: true };
  }

  private async roomOf(body: any): Promise<Room> {
    const code = String(body?.code || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!isCode(code)) fail('A code is six letters.');
    const room = await this.store.getRoom(code);
    if (!room) fail('No match with that code. Check the letters.');
    return room;
  }

  async room(body: any, user: PlayerInfo, now: number) {
    const room = await this.roomOf(body);
    if (room.host.userId !== user.userId && room.guest?.userId !== user.userId) fail('That code is not yours.');
    if (room.status === 'waiting' && now > room.expiresAt) { room.status = 'expired'; await this.store.putRoom(room); }
    return { ok: true, status: room.status, matchId: room.matchId, host: room.host.username, guest: room.guest?.username ?? null };
  }

  async join(body: any, user: PlayerInfo, now: number) {
    const room = await this.roomOf(body);
    if (room.host.userId === user.userId) fail("That's your own code. Send it to a friend.");
    if (room.status === 'started' && room.matchId && room.guest?.userId === user.userId) {
      const m = await this.store.getMatch(room.matchId);
      if (m) return { ok: true, matchId: m.id, view: viewFor(m, 'b', []) };
    }
    if (room.status !== 'waiting') fail(room.status === 'expired' ? 'That code has expired.' : room.status === 'cancelled' ? 'That code was cancelled.' : 'That match has already started.');
    if (now > room.expiresAt) { room.status = 'expired'; await this.store.putRoom(room); fail('That code has expired.'); }
    if (await this.store.activeMatchFor(user.userId)) fail('You are already in a match. Finish it first.');
    if (await this.store.activeMatchFor(room.host.userId)) fail('Your friend is already in another match.');
    const deck = await this.deckFor(user, body);
    const pa = deckProblem(room.hostDeck), pb = deckProblem(deck);
    if (pa || pb) fail(pa || pb!);
    const id = this.store.newId();
    const seed = Math.floor(this.store.random() * 2147483647);
    const m = startMatch(id, room.code, { a: room.host, b: user }, { a: room.hostDeck, b: deck }, now, this.rules, seed, this.engineVersion);
    room.guest = user; room.guestDeck = deck; room.status = 'started'; room.matchId = id;
    if (!(await this.store.claimRoom(room))) fail('Someone else just joined that code.');
    await this.store.insertMatch(m);
    await this.store.putViews(m, viewsFor(m, [{ type: 'newMatch' }]));
    return { ok: true, matchId: id, view: viewFor(m, 'b', [{ type: 'newMatch' }]) };
  }

  /** Loads the match, runs due timeouts, saves if anything changed, then `fn`. */
  private async withMatch(body: any, user: PlayerInfo, now: number, fn: (m: MatchRecord) => Promise<any>): Promise<any> {
    const id = String(body?.matchId || '');
    const m = id ? await this.store.getMatch(id) : null;
    if (!m) fail('No such match.');
    if (!seatOf(m!, user.userId)) fail('You are not in this match.');
    await this.settle(m!, now);
    const r = await fn(m!);
    return { ok: true, ...r };
  }

  /** Applies due timeouts and saves (with the views) when something happened. */
  private async settle(m: MatchRecord, now: number): Promise<void> {
    if (m.status === 'finished' && !m.rewarded) { await this.afterEnd(m); return; } // a reward call that failed earlier gets another go
    if (m.status !== 'active') return;
    const before = m.seq;
    const events = applyTimeouts(m, now, this.rules);
    if (m.seq === before) return;
    const saved = await this.store.updateMatch(m, before);
    if (!saved) { const fresh = await this.store.getMatch(m.id); if (fresh) Object.assign(m, fresh); return; }
    await this.store.putViews(m, viewsFor(m, events));
    await this.afterEnd(m);
  }

  /** Rewards, stats and quests once the match is over; retried on later calls until the store confirms it. */
  private async afterEnd(m: MatchRecord) {
    if (m.status !== 'finished' || m.rewarded) return;
    const ok = await this.store.finished(m, { a: this.summarize(m.log, m.state, 'player'), b: this.summarize(m.log, m.state, 'opponent') });
    if (!ok) return;
    m.rewarded = true;
    await this.store.updateMatch(m, m.seq);
  }

  async act(body: any, user: PlayerInfo, now: number) {
    const t0 = now;
    return this.withMatch(body, user, now, async (m) => {
      const seat = seatOf(m, user.userId)!;
      const seq = typeof body?.seq === 'number' ? body.seq : Number(body?.seq);
      const before = m.seq;
      const r = playerAction(m, user.userId, seq, body?.action, now, this.rules);
      const logged = this.store.logMove({ matchId: m.id, seq: before, userId: user.userId, action: body?.action ?? null, ok: r.ok, error: r.ok ? null : r.error ?? null, ms: Date.now() - t0 });
      if (!r.ok) { await logged; return { ok: false, error: r.error, tooSoonMs: r.tooSoonMs, view: viewFor(m, seat, []) }; }
      const [saved] = await Promise.all([this.store.updateMatch(m, before), logged]); // Nov 4: the log line rides alongside the save, one hop less
      if (!saved) {
        const fresh = await this.store.getMatch(m.id);
        return { ok: false, error: 'The match moved on; try again.', view: fresh ? viewFor(fresh, seat, []) : null };
      }
      const views = viewsFor(m, r.events);
      await this.store.putViews(m, views);
      await this.afterEnd(m);
      return { view: views[seat] };
    });
  }

  async forfeit(body: any, user: PlayerInfo, now: number) {
    return this.withMatch(body, user, now, async (m) => {
      const seat = seatOf(m, user.userId)!;
      const before = m.seq;
      const r = forfeit(m, user.userId, now);
      if (!r.ok) return { ok: false, error: r.error, view: viewFor(m, seat, []) };
      const saved = await this.store.updateMatch(m, before);
      if (!saved) { const fresh = await this.store.getMatch(m.id); return { ok: false, error: 'The match moved on; try again.', view: fresh ? viewFor(fresh, seat, []) : null }; }
      const views = viewsFor(m, r.events);
      await this.store.putViews(m, views);
      await this.afterEnd(m);
      return { view: views[seat] };
    });
  }
}
