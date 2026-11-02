// An in-memory Store for the PvP service: the unit tests and the local mock server (tools/pvp-mock-server.mjs) use it.
// Nothing here is used by the real server function.
import type { Store, Room, MoveLog, Summaries } from './service';
import type { MatchRecord, View, Seat } from './referee';

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
  private ids = 0;
  constructor(public rng: () => number = Math.random) {}

  async getRoom(code: string) { const r = this.rooms.get(code); return r ? clone(r) : null; }
  async putRoom(room: Room) { this.rooms.set(room.code, clone(room)); }
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
  async logMove(mv: MoveLog) { this.moves.push(clone(mv)); }
  async activeMatchFor(userId: string) {
    let best: MatchRecord | null = null;
    for (const m of this.matches.values()) if (m.status === 'active' && (m.players.a.userId === userId || m.players.b.userId === userId) && (!best || m.createdAt > best.createdAt)) best = m;
    return best ? best.id : null;
  }
  async finished(m: MatchRecord, summaries: Summaries) {
    if (this.finishedCalls.some((f) => f.matchId === m.id)) return; // idempotent, like private.pvp_finish
    this.finishedCalls.push({ matchId: m.id, summaries: clone(summaries) });
  }
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
