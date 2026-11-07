// An in-memory Store for the PvP service: the unit tests and the local mock server (tools/pvp-mock-server.mjs) use it.
// Nothing here is used by the real server function.
import { rankOfRating, pointsDelta } from '../content/ladder';
import type { Store, Room, MoveLog, Summaries, QueueEntry, RankInfo, RegionInfo } from './service';
import type { MatchRecord, View, Seat, PlayerInfo, DeckChoice } from './referee';

const season = () => { const d = new Date(); return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`; };
const rankName = (r: number) => rankOfRating(r).label; // the 10-step ladder (Forge, Nov 5), as private.rank_name on the server

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export class MemoryStore implements Store {
  rooms = new Map<string, Room>();
  matches = new Map<string, MatchRecord>();
  views = new Map<string, Record<Seat, View>>();
  moves: MoveLog[] = [];
  finishedCalls: { matchId: string; summaries: Summaries }[] = [];
  savedDecks = new Map<string, { commander: string; cards: string[]; tiers?: number[] | null }>(); // key `${userId}/${deckId}`
  /** every view written, newest last (the mock server's "realtime") */
  viewLog: { matchId: string; userId: string; seq: number }[] = [];
  queue = new Map<string, QueueEntry>();
  tiers = new Map<string, Record<string, number>>(); // user -> card id -> tier (the mock's /debug/tier sets it)
  pairings: { mode: string; waitedA: number; waitedB: number; at: number }[] = []; // Nov 5: for the average wait
  ratings = new Map<string, RankInfo>(); // `rating` = the shown ladder points
  elo = new Map<string, number>(); // the hidden Elo, matchmaking only (private.ratings.rating)
  /** Nov 6 (regions): the three US regions as the admin setting seeds them; fallbackSeconds = when the game offers "Search all regions" */
  regionList: RegionInfo[] = [{ id: 'us-east', name: 'US East', edge: 'us-east-1' }, { id: 'us-central', name: 'US Central', edge: 'us-east-1' }, { id: 'us-west', name: 'US West', edge: 'us-west-1' }];
  fallbackSeconds = 45;
  private ids = 0;
  constructor(public rng: () => number = Math.random) {}

  async getRoom(code: string) { const r = this.rooms.get(code); return r ? clone(r) : null; }
  async putRoom(room: Room) { this.rooms.set(room.code, clone(room)); }
  async claimRoom(room: Room) {
    const cur = this.rooms.get(room.code);
    if (!cur || cur.status !== 'waiting' || cur.guest) return false;
    const bl: Set<string> | undefined = (this as any).blocks; // Nov 7 (friends): a blocked player can't join (the real check is claim_room in SQL)
    if (bl && room.guest && (bl.has(`${cur.host.userId}|${room.guest.userId}`) || bl.has(`${room.guest.userId}|${cur.host.userId}`))) throw new Error("You can't join this player's game.");
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
    if (m.mode === 'ranked') { // like private.rating_apply: the hidden Elo (K 32) moves, then the shown ladder points (`rating` here) follow it
      const ua = m.players.a.userId, ub = m.players.b.userId, a = this.rankRow(ua), b = this.rankRow(ub);
      const ra = this.elo.get(ua) ?? 1000, rb = this.elo.get(ub) ?? 1000;
      const ea = 1 / (1 + Math.pow(10, (rb - ra) / 400)), sa = m.result?.winner === 'a' ? 1 : m.result?.winner === 'b' ? 0 : 0.5;
      const d = Math.round(32 * (sa - ea)), na = Math.max(0, ra + d), nb = Math.max(0, rb - d);
      this.elo.set(ua, na); this.elo.set(ub, nb);
      const pa = a.rating, pb = b.rating;
      a.rating = Math.max(0, pa + pointsDelta(pa, na, sa)); b.rating = Math.max(0, pb + pointsDelta(pb, nb, 1 - sa));
      a.games++; b.games++; if (sa === 1) { a.wins++; b.losses++; } else if (sa === 0) { b.wins++; a.losses++; }
      a.peak = Math.max(a.peak, a.rating); b.peak = Math.max(b.peak, b.rating);
      a.name = rankName(a.rating); b.name = rankName(b.rating);
      return { rating: { a: { before: pa, after: a.rating }, b: { before: pb, after: b.rating } } };
    }
    return true;
  }
  private rankRow(userId: string): RankInfo {
    let r = this.ratings.get(userId);
    if (!r) { r = { season: season(), rating: 0, name: rankName(0), games: 0, wins: 0, losses: 0, peak: 0 }; this.ratings.set(userId, r); } // Nov 7: everyone starts at Stone III
    return r;
  }
  async regions() { return clone(this.regionList); }
  async queueJoin(user: PlayerInfo, mode: 'ranked' | 'unranked', deck: DeckChoice, now: number, wantAvg = false, region?: string, anyRegion = false) {
    const cur = this.queue.get(user.userId);
    const reg = region && this.regionList.some((r) => r.id === region) ? region : this.regionList[0].id;
    const e: QueueEntry = { user: clone(user), deck: clone(deck), mode, rating: (this.rankRow(user.userId), this.elo.get(user.userId) ?? 1000), since: cur && cur.mode === mode && cur.region === reg ? cur.since : now, region: reg, anyRegion };
    this.queue.set(user.userId, e);
    let others = 0, othersAll = 0;
    for (const q of this.queue.values()) if (q.mode === mode && q.user.userId !== user.userId) { othersAll++; if (q.region === reg || anyRegion || q.anyRegion) others++; }
    const base = { rating: e.rating, since: e.since, others, othersAll, region: reg, fallback: this.fallbackSeconds };
    if (!wantAvg) return base;
    const recent = this.pairings.filter((p) => p.mode === mode && now - p.at < 30 * 60 * 1000).slice(-20);
    const avgWait = recent.length >= 3 ? Math.round(recent.reduce((s, p) => s + (p.waitedA + p.waitedB) / 2, 0) / recent.length) : null;
    return { ...base, avgWait, pairings: recent.length };
  }
  async queuePair(userId: string, now: number) {
    const me = this.queue.get(userId);
    if (!me) return null;
    const win = 100 + 50 * Math.floor((now - me.since) / 10000);
    let best: QueueEntry | null = null;
    for (const q of this.queue.values()) {
      if (q.user.userId === userId || q.mode !== me.mode) continue;
      if (!(q.region === me.region || me.anyRegion || q.anyRegion)) continue; // Nov 6: same region, unless either side searches all
      if (me.mode === 'ranked' && Math.abs(q.rating - me.rating) > win) continue;
      if (await this.activeMatchFor(q.user.userId)) continue;
      // the same region first, then the longer wait
      if (!best || ((q.region === me.region) !== (best.region === me.region) ? q.region === me.region : q.since < best.since)) best = q;
    }
    if (!best) return null;
    this.queue.delete(userId); this.queue.delete(best.user.userId);
    this.pairings.push({ mode: me.mode, waitedA: Math.round((now - best.since) / 1000), waitedB: Math.round((now - me.since) / 1000), at: now });
    return { mode: me.mode, myRating: me.rating, other: clone(best), region: best.region };
  }
  async queueLeave(userId: string) { this.queue.delete(userId); }
  async rankOf(userId: string) { return clone(this.rankRow(userId)); }
  async tiersOf(userId: string, cards: string[] | null) { const t = this.tiers.get(userId) || {}; const out: Record<string, number> = {}; for (const [k, v] of Object.entries(t)) if (v > 1 && (!cards || cards.includes(k))) out[k] = v; return out; }
  /** the mock's collection: one tier per card per user (the /debug/tier route sets it); an Original is always owned */
  async hasCopy(userId: string, cardId: string, tier: number) { const t = this.tiers.get(userId) || {}; return tier <= 1 ? true : t[cardId] === tier; }
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
