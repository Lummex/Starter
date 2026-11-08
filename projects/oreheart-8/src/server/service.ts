import EMOTES from '../content/emotes.json';
// The PvP service (Anvil, Nov 2): the operations behind the `match` server function, written once over a small `Store`
// interface so the same code runs in the Supabase Edge Function (Deno + Postgres) and in the local mock server
// (Node + memory) that the hidden checks use. See factory-design/design/oreheart-pvp-nov2-contract.md part 2.5.
import { validateDeck, STARTER_DECKS, COMMANDERS } from '../engine';
import { startMatch, playerAction, applyTimeouts, forfeit, viewsFor, viewFor, seatOf, deckProblem, DEFAULT_RULES, type MatchRecord, type MatchMode, type PlayerInfo, type DeckChoice, type Rules, type Seat, type View, addEmote } from './referee';

export interface Room {
  code: string;
  mode?: 'friend' | 'practice'; // Nov 5: a practice code pays and counts nothing
  region?: string | null; // Nov 6: the host's region (the match counts under it)
  host: PlayerInfo; hostDeck: DeckChoice;
  guest: PlayerInfo | null; guestDeck: DeckChoice | null;
  status: 'waiting' | 'started' | 'cancelled' | 'expired';
  matchId: string | null;
  createdAt: number; expiresAt: number;
}
/** Nov 5 (modes): a player waiting in the ranked or unranked queue. */
export interface QueueEntry { user: PlayerInfo; deck: DeckChoice; mode: 'ranked' | 'unranked'; rating: number; since: number; region?: string; anyRegion?: boolean }
/** Nov 6: a server region as the admin setting lists it (id, name, the Supabase edge for x-region) */
export interface RegionInfo { id: string; name: string; edge: string }
export interface RankInfo { season: string; rating: number; name: string; games: number; wins: number; losses: number; peak: number; place?: number | null }
export interface MoveLog { matchId: string; seq: number; userId: string; action: any; ok: boolean; error: string | null; ms: number }
export interface Summaries { a: any; b: any }

/** Storage the service needs. Every method may throw; the handler turns throws into { ok:false, error }. */
export interface Store {
  getRoom(code: string): Promise<Room | null>;
  putRoom(room: Room): Promise<void>;
  /** the player's own saved deck (card ids) by its id, or null */
  getSavedDeck(userId: string, deckId: string): Promise<{ commander: string; cards: string[]; tiers?: number[] | null } | null>;
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
  finished(m: MatchRecord, summaries: Summaries): Promise<boolean | { rating?: Record<Seat, { before: number; after: number }> }>;
  newId(): string;
  random(): number; // [0,1) from a secure source
  // Nov 5 (modes): the ranked / unranked queue and the season ratings
  /** wantAvg: also the average wait of recent pairings in this mode (seconds; null when fewer than 3 in the last 30 min) */
  queueJoin(user: PlayerInfo, mode: 'ranked' | 'unranked', deck: DeckChoice, now: number, wantAvg?: boolean, region?: string, anyRegion?: boolean): Promise<{ rating: number; since: number; others: number; avgWait?: number | null; pairings?: number; region?: string; othersAll?: number; fallback?: number }>;
  /** pairs this player with the longest-waiting fit (Nov 6: in the same region, or across regions when either side said "search all"); both leave the queue in the same step; null when nobody fits */
  queuePair(userId: string, now: number): Promise<{ mode: 'ranked' | 'unranked'; myRating: number; other: QueueEntry; region?: string } | null>;
  /** Nov 6: the enabled server regions, first = the default */
  regions(): Promise<RegionInfo[]>;
  queueLeave(userId: string): Promise<void>;
  rankOf(userId: string): Promise<RankInfo>;
  /** Nov 5 (upgraded cards): the best tier this player owns of each of these cards (card id -> 2..5); {} when none */
  tiersOf(userId: string, cards: string[] | null): Promise<Record<string, number>>;
  /** Nov 7: may this player use this emote (free, or bought)? */
  emoteOk(userId: string, emote: string): Promise<boolean>;
  /** Nov 6: does the player own a copy of this card at this tier (1 = Original)? */
  hasCopy(userId: string, cardId: string, tier: number): Promise<boolean>;
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
// Nov 7: the emote catalog (the same list the game shows); the free starter ones need no check
const EMOTE_IDS = new Set<string>((EMOTES as any).packs.flatMap((p: any) => p.emotes.map((e: any) => e.id)));
const FREE_EMOTES = new Set<string>((EMOTES as any).packs.filter((p: any) => p.free).flatMap((p: any) => p.emotes.map((e: any) => e.id)));
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
        case 'emote': return await this.emote(body, user, now); // Nov 7 (Ken): emotes from the avatar
        case 'queue': return await this.queue(body, user, now);
        case 'leave': await this.store.queueLeave(user.userId); return { ok: true };
        case 'rank': return { ok: true, rank: await this.store.rankOf(user.userId) };
        case 'regions': return { ok: true, regions: await this.store.regions() }; // Nov 6: the enabled servers (the full picker with counts is regions_info() in the database)
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
    // Nov 6 (Ken): the Commander copy (tier) to fight as, 1..5; checked against his collection in tiersFor
    const commanderTier = body?.commanderTier != null && Number.isFinite(Number(body.commanderTier)) ? Math.max(1, Math.min(5, Math.round(Number(body.commanderTier)))) : null;
    if (STARTER_DECKS[deckId]) {
      const v = validateDeck(STARTER_DECKS[deckId].slice(), commander);
      if (!v.legal) fail(`That starter deck can't go with ${COMMANDERS[commander].name}.`);
      return { commander, cards: null, deckId, commanderTier };
    }
    const saved = await this.store.getSavedDeck(user.userId, deckId);
    if (!saved) fail("That deck isn't one of yours.");
    const v = validateDeck(saved.cards.slice(), commander);
    if (!v.legal) fail('That deck is not legal: ' + v.problems.join('; '));
    const tiers = Array.isArray(saved.tiers) && saved.tiers.length === saved.cards.length ? saved.tiers.map((t) => Math.max(1, Math.min(5, Number(t) || 1))) : null;
    return { commander, cards: saved.cards.slice(), deckId, tiers, commanderTier };
  }

  async create(body: any, user: PlayerInfo, now: number) {
    if (await this.store.activeMatchFor(user.userId)) fail('You are already in a match. Finish it first.');
    const deck = await this.deckFor(user, body);
    let code = this.newCode();
    for (let i = 0; i < 20 && (await this.store.getRoom(code)); i++) code = this.newCode();
    const room: Room = { code, mode: body?.practice === true ? 'practice' : 'friend', region: await this.regionOf(body), host: user, hostDeck: deck, guest: null, guestDeck: null, status: 'waiting', matchId: null, createdAt: now, expiresAt: now + ROOM_MINUTES * 60 * 1000 };
    await this.store.putRoom(room);
    return { ok: true, code, mode: room.mode, expiresAt: new Date(room.expiresAt).toISOString() };
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
    m.mode = room.mode === 'practice' ? 'practice' : 'friend';
    m.region = room.region ?? null;
    await this.tiersFor(m);
    room.guest = user; room.guestDeck = deck; room.status = 'started'; room.matchId = id;
    // Nov 7 (friends): a block between the two players refuses the claim; say so (any other store error stays in the log)
    let claimed = false;
    try { claimed = await this.store.claimRoom(room); } catch (e: any) { if (/can't join this player/i.test(String(e?.message || e))) fail("You can't join this player's game."); throw e; }
    if (!claimed) fail('Someone else just joined that code.');
    await this.store.insertMatch(m);
    await this.store.putViews(m, viewsFor(m, [{ type: 'newMatch' }]));
    return { ok: true, matchId: id, view: viewFor(m, 'b', [{ type: 'newMatch' }]) };
  }

  /** Nov 5 (modes): join the ranked or unranked queue, or poll it. Pairs at once when someone fits; the other player's next
   *  poll finds the match through my_match. The same call every 2 s keeps the player "seen" (a closed browser drops out). */
  async queue(body: any, user: PlayerInfo, now: number) {
    const mode = body?.mode === 'ranked' ? 'ranked' : body?.mode === 'unranked' ? 'unranked' : null;
    if (!mode) fail('Pick ranked or unranked.');
    const active = await this.store.activeMatchFor(user.userId);
    if (active) { await this.store.queueLeave(user.userId); return { ok: true, matchId: active }; }
    const deck = await this.deckFor(user, body);
    const pd = deckProblem(deck);
    if (pd) fail(pd);
    const wantAvg = body?.avg === true; // Nov 5 (Ken: the average wait): asked for now and then, not on every poll
    // Nov 6 (regions): the queue is per region; anyRegion = the player agreed to "Search all regions" (offered after `fallback` seconds)
    const region = await this.regionOf(body), anyRegion = body?.anyRegion === true;
    const q = await this.store.queueJoin(user, mode!, deck, now, wantAvg, region, anyRegion);
    const avg = wantAvg ? { avgWait: q.avgWait ?? null, pairings: q.pairings ?? 0 } : {};
    const where = { region: q.region ?? region, anyRegion, othersAll: q.othersAll ?? q.others, fallback: q.fallback ?? 45 };
    const pair = await this.store.queuePair(user.userId, now);
    if (!pair) return { ok: true, waiting: true, mode, rating: q.rating, since: new Date(q.since).toISOString(), waited: Math.max(0, Math.round((now - q.since) / 1000)), others: q.others, ...where, ...avg };
    if (await this.store.activeMatchFor(pair.other.user.userId)) return { ok: true, waiting: true, mode, rating: q.rating, since: new Date(q.since).toISOString(), waited: 0, others: 0, ...where, ...avg };
    const pa = deckProblem(pair.other.deck), pb = deckProblem(deck);
    if (pa || pb) fail(pa || pb!);
    const id = this.store.newId();
    const seed = Math.floor(this.store.random() * 2147483647);
    // the one who waited longer is seat a (the host side), like the maker of a code
    const m = startMatch(id, null, { a: pair.other.user, b: user }, { a: pair.other.deck, b: deck }, now, this.rules, seed, this.engineVersion);
    m.mode = pair.mode;
    m.region = pair.region ?? pair.other.region ?? region;
    await this.tiersFor(m);
    await this.store.insertMatch(m);
    await this.store.putViews(m, viewsFor(m, [{ type: 'newMatch' }]));
    return { ok: true, matchId: id, mode: pair.mode, region: m.region, view: viewFor(m, 'b', [{ type: 'newMatch' }]) };
  }

  /** Nov 6: the region the player asked for, if the admin list has it enabled; else the first enabled one (an older game sends none) */
  private async regionOf(body: any): Promise<string> {
    const want = typeof body?.region === 'string' && /^[a-z][a-z0-9-]{1,19}$/.test(body.region) ? body.region : '';
    const list = await this.store.regions();
    if (want && list.some((r) => r.id === want)) return want;
    return list.length ? list[0].id : 'us-east';
  }

  /** Nov 5: each player's upgraded cards for the match (looks only). Never stops a match from starting. */
  private async tiersFor(m: MatchRecord) {
    const cardsOf = (d: DeckChoice): string[] => ['commander-' + d.commander]; // Nov 5 (Ken): a card's tier is its own copy's, carried in the deck; only the Commander's best tier comes from the collection
    try {
      m.tiers = { a: await this.store.tiersOf(m.players.a.userId, cardsOf(m.decks.a)), b: await this.store.tiersOf(m.players.b.userId, cardsOf(m.decks.b)) };
      // Nov 6 (Ken): the player picks WHICH Commander copy fights. His pick counts when he owns a copy of that tier; otherwise his best copy stands.
      for (const seat of ['a', 'b'] as const) {
        const d = m.decks[seat], want = d.commanderTier, key = 'commander-' + d.commander;
        if (!want || !(await this.store.hasCopy(m.players[seat].userId, key, want))) continue;
        if (want > 1) m.tiers[seat][key] = want; else delete m.tiers[seat][key];
      }
    } catch { m.tiers = m.tiers || { a: {}, b: {} }; }
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
    if (typeof ok === 'object' && ok.rating) m.rating = ok.rating; // Nov 5: a ranked match tells both players how their rating moved
    await this.store.updateMatch(m, m.seq);
    if (m.rating) await this.store.putViews(m, viewsFor(m, []));
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

  /** Nov 7 (Ken): an emote. Known ids only, owned (free or bought), one every 2 s; the views go out with the same seq, so no move is disturbed. */
  async emote(body: any, user: PlayerInfo, now: number) {
    const id = String(body?.emote || '');
    if (!EMOTE_IDS.has(id)) fail('No such emote.');
    if (!FREE_EMOTES.has(id) && !(await this.store.emoteOk(user.userId, id))) fail("You don't have that emote yet.");
    return this.withMatch(body, user, now, async (m) => {
      const seat = seatOf(m, user.userId)!;
      const r = addEmote(m, user.userId, id, now, body?.code ?? null);
      if (!r.ok) return { ok: false, error: r.error };
      const saved = await this.store.updateMatch(m, m.seq);
      if (!saved) return { ok: false, error: 'The match moved on; try again.' };
      const views = viewsFor(m, []);
      await this.store.putViews(m, views);
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
