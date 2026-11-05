// An in-memory Store for the PvP service: the unit tests and the local mock server (tools/pvp-mock-server.mjs) use it.
// Nothing here is used by the real server function.
import type { Store, Room, MoveLog, Summaries, QueueEntry, RankInfo } from './service';
import type { MatchRecord, View, Seat, PlayerInfo, DeckChoice } from './referee';

const season = () => { const d = new Date(); return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`; };
const rankName = (r: number) => (r < 900 ? 'Scrap' : r < 1100 ? 'Ore' : r < 1300 ? 'Crystal' : r < 1500 ? 'Gem' : 'Mythic');

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export class MemoryStore implements Store {
  rooms = new Map<string, Room>();
  matches = new Map<string, MatchRecord>();
  views = new Map<string, Record<Seat, View>>();
  moves: MoveLog[] = [];
  finishedCalls: { matchId: string; summaries: Summaries }[] = [];
  savedDecks = new Map<string, { commander: string; cards: string[] }>(); // key `${userId}/${deckId}`
  /** every view written, newest last (the mock server's "realtime") */
  viewLog: { matchId: string; userId: string; seq: number }[] = [];
  queue = new Map<string, QueueEntry>();
  ratings = new Map<string, RankInfo>();
  private ids = 0;
  constructor(public rng: () => number = Math.random) {}

  async getRoom(code: string) { const r = this.rooms.get(code); return r ? clone(r) : null; }
  async putRoom(room: Room) { this.rooms.set(room.code, clone(room)); }
  async claimRoom(room: Room) {
    const cur = this.rooms.get(room.code);
    if (!cur || cur.status !== 'waiting' || cur.guest) return false;
    this.rooms.set(room.code, clone(room));
    return true;
  }
  async getSavedDeck(userId: string, deckId: string) { const d = this.savedDecks.get(`${userId}/${deckId}`); return d ? clone(d) : null; }
  async getMatch(id: string) { const m = this.matches.get(id); return m ? clone(m) : null; }
  async insertMatch(m: MatchRecord) { if (this.matches.has(m.id)) throw new Error('duplicate match'); this.matches.set(m.id, clone(m)); }
  async updateMatch(m: MatchRecord, expectedSeq: number) {
    const cur = this.matches.get(m.id);
    if (!cur || cur.seq !== expectedSeq) return false;
    this.matches.set(m.id, clone(m));
    return true;
  }
  async putViews(m: MatchRecord, views: Record<Seat, View>) {
    this.views.set(m.id, clone(views));
    for (const seat of ['a', 'b'] as Seat[]) this.viewLog.push({ matchId: m.id, userId: m.players[seat].userId, seq: views[seat].seq });
  }
  async logMove(mv: MoveLog) { this.moves.push({ ...clone(mv), at: Date.now() } as any); }
  async activeMatchFor(userId: string) {
    let best: MatchRecord | null = null;
    for (const m of this.matches.values()) if (m.status === 'active' && (m.players.a.userId === userId || m.players.b.userId === userId) && (!best || m.createdAt > best.createdAt)) best = m;
    return best ? best.id : null;
  }
  async finished(m: MatchRecord, summaries: Summaries) {
    if (this.finishedCalls.some((f) => f.matchId === m.id)) return true; // idempotent, like private.pvp_finish
    this.finishedCalls.push({ matchId: m.id, summaries: clone(summaries) });
    if (m.mode === 'ranked') { // Elo, K 32, like private.rating_apply
      const a = this.rankRow(m.players.a.userId), b = this.rankRow(m.players.b.userId);
      const ea = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400)), sa = m.result?.winner === 'a' ? 1 : m.result?.winner === 'b' ? 0 : 0.5;
      const d = Math.round(32 * (sa - ea));
      a.rating = Math.max(0, a.rating + d); b.rating = Math.max(0, b.rating - d);
      a.games++; b.games++; if (sa === 1) { a.wins++; b.losses++; } else if (sa === 0) { b.wins++; a.losses++; }
      a.peak = Math.max(a.peak, a.rating); b.peak = Math.max(b.peak, b.rating);
      a.name = rankName(a.rating); b.name = rankName(b.rating);
    }
    return true;
  }
  private rankRow(userId: string): RankInfo {
    let r = this.ratings.get(userId);
    if (!r) { r = { season: season(), rating: 1000, name: 'Ore', games: 0, wins: 0, losses: 0, peak: 1000 }; this.ratings.set(userId, r); }
    return r;
  }
  async queueJoin(user: PlayerInfo, mode: 'ranked' | 'unranked', deck: DeckChoice, now: number) {
    const cur = this.queue.get(user.userId);
    const e: QueueEntry = { user: clone(user), deck: clone(deck), mode, rating: this.rankRow(user.userId).rating, since: cur && cur.mode === mode ? cur.since : now };
    this.queue.set(user.userId, e);
    let others = 0; for (const q of this.queue.values()) if (q.mode === mode && q.user.userId !== user.userId) others++;
    return { rating: e.rating, since: e.since, others };
  }
  async queuePair(userId: string, now: number) {
    const me = this.queue.get(userId);
    if (!me) return null;
    const win = 100 + 50 * Math.floor((now - me.since) / 10000);
    let best: QueueEntry | null = null;
    for (const q of this.queue.values()) {
      if (q.user.userId === userId || q.mode !== me.mode) continue;
      if (me.mode === 'ranked' && Math.abs(q.rating - me.rating) > win) continue;
      if (await this.activeMatchFor(q.user.userId)) continue;
      if (!best || q.since < best.since) best = q;
    }
    if (!best) return null;
    this.queue.delete(userId); this.queue.delete(best.user.userId);
    return { mode: me.mode, myRating: me.rating, other: clone(best) };
  }
  async queueLeave(userId: string) { this.queue.delete(userId); }
  async rankOf(userId: string) { return clone(this.rankRow(userId)); }
  newId() { return 'm' + String(++this.ids).padStart(4, '0'); }
  random() { return this.rng(); }
  /** the latest view written for a player in a match (what Realtime would have delivered) */
  viewOf(matchId: string, userId: string): View | null {
    const v = this.views.get(matchId), m = this.matches.get(matchId);
    if (!v || !m) return null;
    const seat: Seat | null = m.players.a.userId === userId ? 'a' : m.players.b.userId === userId ? 'b' : null;
    return seat ? clone(v[seat]) : null;
  }
}
