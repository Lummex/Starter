// The `match` server function (Anvil, Nov 2): player-vs-player friend matches for Oreheart Online.
// Thin Deno wrapper around the bundled referee/service (engine.bundle.js, GENERATED from projects/oreheart-8/src/server by
// tools/bundle-engine.mjs; the deploy workflow rebuilds it). Everything that decides a match lives in that shared code and is
// unit-tested in the game repo; this file only does sign-in, the database and the HTTP envelope.
//
// POST { op, ... } with the player's JWT -> { ok, ... } (see factory-design/design/oreheart-pvp-nov2-contract.md part 2.5).
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by the platform; nothing is in this file.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { PvpService, setDiceMode, ENGINE_VERSION, DEFAULT_RULES, summarize } from './engine.bundle.js';

setDiceMode('live'); // every die and shuffle is a fresh secure roll on the server

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS: Record<string, string> = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
const json = (code: number, body: unknown) => new Response(JSON.stringify(body), { status: code, headers: { ...CORS, 'content-type': 'application/json' } });

interface PlayerInfo { userId: string; username: string; avatar: string | null }

/** Storage over the real database with the service role (players never write these tables themselves). */
class SupabaseStore {
  constructor(private db: SupabaseClient) {}
  async getRoom(code: string) {
    const { data, error } = await this.db.from('rooms').select('*').eq('code', code).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { code: data.code, host: data.host_deck.player, hostDeck: data.host_deck.deck, guest: data.guest_deck?.player ?? null, guestDeck: data.guest_deck?.deck ?? null,
      status: data.status, matchId: data.match_id, createdAt: Date.parse(data.created_at), expiresAt: Date.parse(data.expires_at) };
  }
  async putRoom(r: any) {
    const row = { code: r.code, host: r.host.userId, guest: r.guest?.userId ?? null, host_deck: { player: r.host, deck: r.hostDeck }, guest_deck: r.guest ? { player: r.guest, deck: r.guestDeck } : null,
      status: r.status, match_id: r.matchId, created_at: new Date(r.createdAt).toISOString(), expires_at: new Date(r.expiresAt).toISOString() };
    const { error } = await this.db.from('rooms').upsert(row, { onConflict: 'code' });
    if (error) throw new Error(error.message);
  }
  /** one guest per room: the database swaps 'waiting' -> 'started' in a single statement */
  async claimRoom(r: any) {
    const { data, error } = await this.db.rpc('claim_room', { p_code: r.code, p_guest: r.guest.userId, p_guest_deck: { player: r.guest, deck: r.guestDeck }, p_match: r.matchId });
    if (error) throw new Error(error.message);
    return data === true;
  }
  async getSavedDeck(userId: string, deckId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(deckId)) return null;
    const { data, error } = await this.db.from('decks').select('commander,cards').eq('id', deckId).eq('user_id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data && Array.isArray(data.cards) ? { commander: data.commander, cards: data.cards } : null;
  }
  async getMatch(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data, error } = await this.db.from('matches').select('id,state,seq,status').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { ...data.state, id: data.id, seq: data.seq, status: data.status };
  }
  private columns(m: any) {
    const { id: _id, ...rest } = m;
    return { state: rest, seq: m.seq, status: m.status, winner: m.result?.winner ? m.players[m.result.winner].userId : null,
      result: m.result?.winner ?? (m.result ? 'tie' : null), end_reason: m.result?.reason ?? null, turns: m.state?.turn ?? 0, updated_at: new Date().toISOString(), ended_at: m.endedAt ? new Date(m.endedAt).toISOString() : null };
  }
  async insertMatch(m: any) {
    const { error } = await this.db.from('matches').insert({ id: m.id, mode: 'friend', room_code: m.roomCode, player_a: m.players.a.userId, player_b: m.players.b.userId, engine_version: m.engineVersion, created_at: new Date(m.createdAt).toISOString(), ...this.columns(m) });
    if (error) throw new Error(error.message);
  }
  async updateMatch(m: any, expectedSeq: number) {
    const { data, error } = await this.db.from('matches').update(this.columns(m)).eq('id', m.id).eq('seq', expectedSeq).select('id');
    if (error) throw new Error(error.message);
    return !!(data && data.length === 1);
  }
  async putViews(m: any, views: any) {
    const rows = (['a', 'b'] as const).map((seat) => ({ match_id: m.id, user_id: m.players[seat].userId, side: seat, seq: views[seat].seq, view: views[seat], events: views[seat].events, deadline: views[seat].respondDeadline ?? views[seat].deadline, updated_at: new Date().toISOString() }));
    const { error } = await this.db.from('match_views').upsert(rows, { onConflict: 'match_id,user_id' });
    if (error) throw new Error(error.message);
  }
  async logMove(mv: any) {
    const { error } = await this.db.from('match_moves').insert({ match_id: mv.matchId, seq: mv.seq, user_id: mv.userId, action: mv.action, ok: mv.ok, error: mv.error, ms: mv.ms });
    if (error) console.error('match_moves', error.message); // a lost log line must not fail the move
  }
  async activeMatchFor(userId: string) {
    const { data, error } = await this.db.from('matches').select('id').eq('status', 'active').or(`player_a.eq.${userId},player_b.eq.${userId}`).order('created_at', { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    return data && data.length ? data[0].id : null;
  }
  async finished(m: any, summaries: any) {
    const winner = m.result?.winner ? m.players[m.result.winner].userId : null;
    const { error } = await this.db.rpc('pvp_finish', { p_match: m.id, p_winner: winner, p_result: m.result?.winner ?? 'tie', p_end_reason: m.result?.reason ?? 'win', p_turns: m.state?.turn ?? 0, p_summary_a: summaries.a, p_summary_b: summaries.b });
    if (error) { console.error('pvp_finish', error.message); return false; } // idempotent; the service retries on the next call for this match
    return true;
  }
  newId() { return crypto.randomUUID(); }
  random() { const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0] / 4294967296; }
  /** Ken's clock numbers from `settings` (admin-editable), with the game's defaults when unset. */
  async rules() {
    const keys = ['pvp_phase_seconds', 'pvp_bank_seconds', 'pvp_respond_seconds', 'pvp_timeouts_to_forfeit'];
    const { data } = await this.db.from('settings').select('key,value').in('key', keys);
    const get = (k: string, d: number) => { const row = (data || []).find((r: any) => r.key === k); const n = row ? Number(row.value) : NaN; return Number.isFinite(n) && n > 0 ? n : d; };
    return { phaseSeconds: get('pvp_phase_seconds', DEFAULT_RULES.phaseSeconds), bankSeconds: get('pvp_bank_seconds', DEFAULT_RULES.bankSeconds), respondSeconds: get('pvp_respond_seconds', DEFAULT_RULES.respondSeconds), timeoutsToForfeit: get('pvp_timeouts_to_forfeit', DEFAULT_RULES.timeoutsToForfeit) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' });
  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(auth)) return json(401, { ok: false, error: 'not signed in' });
  // who is asking: the player's own token, checked by Auth; then the player door (ban, consent) as that player
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: who, error: whoErr } = await asUser.auth.getUser();
  if (whoErr || !who?.user) return json(401, { ok: false, error: 'not signed in' });
  const gate = await asUser.rpc('pvp_gate');
  if (gate.error) return json(200, { ok: false, error: gate.error.message });
  const g: any = gate.data || {};
  const user: PlayerInfo = { userId: who.user.id, username: String(g.username || 'Player'), avatar: g.avatar ?? null };
  const len = Number(req.headers.get('content-length') || 0);
  if (len > 50_000) return json(413, { ok: false, error: 'too big' });
  const text = await req.text();
  if (text.length > 50_000) return json(413, { ok: false, error: 'too big' });
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { return json(400, { ok: false, error: 'bad JSON' }); }
  const store = new SupabaseStore(createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
  const service = new PvpService(store, { engineVersion: ENGINE_VERSION, rules: await store.rules(), summarize });
  const out = await service.handle(String(body.op || ''), body, user, Date.now());
  return json(200, out);
});
