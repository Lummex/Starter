// Local stand-in for the `match` server function (Anvil, Nov 2): the SAME referee/service code as the real Edge Function,
// over an in-memory store, so two browser pages can play a whole friend match on this PC without Supabase.
// Fake sign-in: header `x-mock-user: <name>` (or ?user=<name>). Never deployed; test pages pick it with ?pvp=mock.
//   node tools/bundle-engine.mjs && node tools/pvp-mock-server.mjs [port]      (default port 4310)
// Endpoints: POST /match {op, ...} like the real function; GET /health; GET /debug/views?matchId=..&user=.. (checks only).
import http from 'node:http';
import { webcrypto } from 'node:crypto';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// rebuild the bundle when it is missing or older than the engine/server sources
const here = dirname(fileURLToPath(import.meta.url));
const bundlePath = resolve(here, '.build/pvp-server.mjs');
const newest = (dir) => Math.max(0, ...readdirSync(dir).map((f) => statSync(resolve(dir, f)).mtimeMs));
const srcTime = Math.max(newest(resolve(here, '../src/engine')), newest(resolve(here, '../src/server')), newest(resolve(here, '../src/content')));
if (!existsSync(bundlePath) || statSync(bundlePath).mtimeMs < srcTime) { console.log('bundling the engine...'); execFileSync(process.execPath, [resolve(here, 'bundle-engine.mjs')], { stdio: 'inherit' }); }
const { PvpService, MemoryStore, setDiceMode, ENGINE_VERSION, summarize, DEFAULT_RULES, viewsFor, createMatch } = await import('./.build/pvp-server.mjs');

if (!globalThis.crypto) globalThis.crypto = webcrypto;
setDiceMode('live'); // the referee rolls fresh dice, like the real server
const port = Number(process.argv[2] || process.env.PVP_MOCK_PORT || 4310);
const store = new MemoryStore(() => { const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0] / 4294967296; });
store.newId = () => crypto.randomUUID();
store.fallbackSeconds = 4; // Nov 6 (regions): "Search all regions" is offered after 4 s here (45 s on the real server, an admin setting), so the checks can see it
const service = new PvpService(store, { engineVersion: ENGINE_VERSION + '-mock', summarize });
// API checks that play hundreds of moves ask for no minimum Respond window with this header; browsers and the real function never have it
const noMinService = new PvpService(store, { engineVersion: ENGINE_VERSION + '-mock', summarize, rules: { ...DEFAULT_RULES, respondMinSeconds: 0 } });
const users = new Map();
const { makeFriends } = await import('./friends-mock.mjs'); // Nov 7: friends in memory (the real rules are SQL)
const friends = makeFriends(store, users);
const userOf = (name) => {
  const n = String(name || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16);
  if (!n) return null;
  if (!users.has(n)) users.set(n, { userId: 'mock-' + n, username: n, avatar: null });
  return users.get(n);
};
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, GET, OPTIONS' }); res.end(JSON.stringify(body)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (url.pathname === '/health') return json(res, 200, { ok: true, engine: ENGINE_VERSION, matches: store.matches.size, rooms: store.rooms.size });
  if (url.pathname === '/debug/views' && req.method === 'GET') { const v = store.viewOf(url.searchParams.get('matchId'), 'mock-' + url.searchParams.get('user')); return json(res, 200, { ok: !!v, view: v }); }
  if (url.pathname === '/debug/give' && req.method === 'GET') { // checks only: puts a card in a player's hand with crystals to pay for it
    const m = await store.getMatch(url.searchParams.get('matchId'));
    const u = users.get(url.searchParams.get('user'));
    const seat = m && u ? (m.players.a.userId === u.userId ? 'a' : m.players.b.userId === u.userId ? 'b' : null) : null;
    if (!seat) return json(res, 200, { ok: false });
    const p = m.state.players[seat === 'a' ? 'player' : 'opponent'];
    p.hand.push({ uid: 'give' + m.seq, cardId: url.searchParams.get('card') });
    p.bank = 40; m.state.factionLock = false;
    const before = m.seq++;
    await store.updateMatch(m, before);
    await store.putViews(m, viewsFor(m, []));
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/debug/place' && req.method === 'GET') { // checks only: puts a unit of a player's on the board (real coordinates), ready to act
    const m = await store.getMatch(url.searchParams.get('matchId'));
    const u = users.get(url.searchParams.get('user'));
    const seat = m && u ? (m.players.a.userId === u.userId ? 'a' : m.players.b.userId === u.userId ? 'b' : null) : null;
    if (!seat) return json(res, 200, { ok: false });
    const side = seat === 'a' ? 'player' : 'opponent', row = Number(url.searchParams.get('row')), col = Number(url.searchParams.get('col'));
    if (m.state.board.creatures.some((c) => c.row === row && c.col === col) || m.state.sites.some((x) => x.row === row && x.col === col)) return json(res, 200, { ok: false, error: 'square taken' });
    const made = createMatch({ seed: 1, factionLock: false, setup: { playerHand: [], opponentHand: [], board: [{ owner: side, cardId: url.searchParams.get('card'), row, col }] }, mines: m.state.sites.map((x) => ({ row: x.row, col: x.col })) });
    const c = made.board.creatures[0]; c.uid = 'place' + m.seq; c.summonedThisTurn = false; c.lockedUntil = 0;
    m.state.board.creatures.push(c);
    const before = m.seq++;
    await store.updateMatch(m, before);
    await store.putViews(m, viewsFor(m, []));
    return json(res, 200, { ok: true, uid: c.uid });
  }
  if (url.pathname === '/debug/tier' && req.method === 'GET' && !url.searchParams.get('matchId')) { // checks only (Nov 6): the player OWNS a copy of that card at that tier (the Commander copy he may fight as)
    const u = userOf(url.searchParams.get('user'));
    if (!u) return json(res, 200, { ok: false });
    const tier = Math.max(1, Math.min(5, Number(url.searchParams.get('tier')) || 5)), card = url.searchParams.get('card');
    const t = store.tiers.get(u.userId) || {}; t[card] = tier; store.tiers.set(u.userId, t);
    return json(res, 200, { ok: true, owned: { [card]: tier } });
  }
  if (url.pathname === '/debug/tier' && req.method === 'GET') { // checks only: one of a player's cards is an upgraded one (tier 2..5) in this match
    const m = await store.getMatch(url.searchParams.get('matchId'));
    const u = users.get(url.searchParams.get('user'));
    const seat = m && u ? (m.players.a.userId === u.userId ? 'a' : m.players.b.userId === u.userId ? 'b' : null) : null;
    if (!seat) return json(res, 200, { ok: false });
    const tier = Math.max(1, Math.min(5, Number(url.searchParams.get('tier')) || 5)), card = url.searchParams.get('card');
    m.tiers = m.tiers || { a: {}, b: {} }; m.tiers[seat][card] = tier;
    { const side = seat === 'a' ? 'player' : 'opponent', pl = m.state.players[side]; for (const k of [...pl.hand, ...pl.deck, ...pl.discard]) if (k.cardId === card) k.tier = tier; for (const c of m.state.board.creatures) if (c.owner === side && c.cardId === card) c.tier = tier; } // Nov 5: per copy
    const t = store.tiers.get(u.userId) || {}; t[card] = tier; store.tiers.set(u.userId, t);
    const before = m.seq++;
    await store.updateMatch(m, before);
    await store.putViews(m, viewsFor(m, []));
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/debug/moves' && req.method === 'GET') return json(res, 200, { ok: true, moves: store.moves.filter((m) => m.matchId === url.searchParams.get('matchId')) });
  if (url.pathname === '/debug/expire-invites' && req.method === 'GET') { friends.debugExpire(); return json(res, 200, { ok: true }); }
  if (url.pathname === '/friends' && req.method === 'POST') { // Nov 7: the friends list, requests, blocks and challenges
    const who = userOf(req.headers['x-mock-user'] || url.searchParams.get('user'));
    if (!who) return json(res, 401, { ok: false, error: 'not signed in' });
    let fb = ''; for await (const chunk of req) { fb += chunk; if (fb.length > 20_000) return json(res, 413, { ok: false, error: 'too big' }); }
    let fbody; try { fbody = fb ? JSON.parse(fb) : {}; } catch { return json(res, 400, { ok: false, error: 'bad JSON' }); }
    return json(res, 200, await friends.handle(String(fbody.op || ''), fbody, who));
  }
  if (url.pathname !== '/match' || req.method !== 'POST') return json(res, 404, { ok: false, error: 'not found' });
  const user = userOf(req.headers['x-mock-user'] || url.searchParams.get('user'));
  if (!user) return json(res, 401, { ok: false, error: 'not signed in' });
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 200_000) return json(res, 413, { ok: false, error: 'too big' }); }
  let b; try { b = body ? JSON.parse(body) : {}; } catch { return json(res, 400, { ok: false, error: 'bad JSON' }); }
  const out = await (req.headers['x-mock-respond-min'] === '0' ? noMinService : service).handle(String(b.op || ''), b, user, Date.now());
  json(res, 200, out);
});
server.listen(port, '127.0.0.1', () => console.log(`pvp mock server on http://127.0.0.1:${port}/match (engine ${ENGINE_VERSION})`));
