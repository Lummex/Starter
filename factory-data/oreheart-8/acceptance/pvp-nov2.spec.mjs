// =====================================================================
// Online PvP server checks AC600–AC609 (Anvil, Nov 2): the friend-match referee through its HTTP API.
// They run against the local mock server (tools/pvp-mock-server.mjs: the SAME referee/service code as the real
// `match` function over an in-memory store), so they need no database. AC609 talks to the real function when the
// test-runner has a database (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_TEST_ADMIN_KEY), otherwise it skips.
// =====================================================================
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '../../../projects/oreheart-8');
const MOCK = process.env.PVP_MOCK_URL || 'http://127.0.0.1:4310';
let mockProc = null;
let engine = null; // the bundled engine (legalActions) for picking moves like a browser would

async function healthy() { try { const r = await fetch(MOCK + '/health'); return r.ok; } catch { return false; } }
test.beforeAll(async () => {
  if (!(await healthy())) {
    mockProc = spawn(process.execPath, [path.join(APP, 'tools/pvp-mock-server.mjs'), String(new URL(MOCK).port)], { cwd: APP, stdio: 'ignore', detached: false });
    for (let i = 0; i < 60 && !(await healthy()); i++) await new Promise((r) => setTimeout(r, 500));
  }
  expect(await healthy(), 'pvp mock server reachable').toBe(true);
  engine = await import(path.join(APP, 'tools/.build/pvp-server.mjs').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
});
test.afterAll(() => { if (mockProc) { try { mockProc.kill(); } catch { /* gone */ } } });

const letters = (n) => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');
const who = (name) => name + letters(6);
// the API checks play hundreds of moves, so they ask the stand-in server for no minimum Respond window; AC670 checks the real rule with `callAsReal`
async function call(user, body, extra = { 'x-mock-respond-min': '0' }) {
  const r = await fetch(MOCK + '/match', { method: 'POST', headers: { 'content-type': 'application/json', 'x-mock-user': user, ...extra }, body: JSON.stringify(body) });
  return r.json();
}
const callAsReal = (user, body) => call(user, body, {});
const viewOf = async (matchId, user) => (await (await fetch(`${MOCK}/debug/views?matchId=${matchId}&user=${user}`)).json()).view;
const movesOf = async (matchId) => (await (await fetch(`${MOCK}/debug/moves?matchId=${matchId}`)).json()).moves;
async function startMatch() {
  const a = who('alice'), b = who('bob');
  const c = await call(a, { op: 'create', commander: 'grubnak', deckId: 'goblin-warband' });
  expect(c.ok, JSON.stringify(c)).toBe(true);
  const j = await call(b, { op: 'join', code: c.code, commander: 'borgo', deckId: 'dwarf-warband' });
  expect(j.ok, JSON.stringify(j)).toBe(true);
  return { a, b, code: c.code, matchId: j.matchId, viewB: j.view };
}
const hiddenHand = (v) => v.state.players.opponent.hand.length > 0 && v.state.players.opponent.hand.every((h) => h.hidden === true && !('cardId' in h));
const hiddenDecks = (v) => ['player', 'opponent'].every((s) => v.state.players[s].deck.every((h) => h.hidden === true && !('cardId' in h)));

test('AC600 friend code: six letters without I or O; the host cannot join their own code; a stranger cannot look at it', async () => {
  const a = who('alice');
  const c = await call(a, { op: 'create', commander: 'grubnak', deckId: 'goblin-warband' });
  expect(c.ok).toBe(true);
  expect(c.code).toMatch(/^[A-HJ-NP-Z]{6}$/);
  const self = await call(a, { op: 'join', code: c.code, commander: 'borgo', deckId: 'dwarf-warband' });
  expect(self.ok).toBe(false); expect(self.error).toMatch(/own code/);
  const stranger = await call(who('carl'), { op: 'room', code: c.code });
  expect(stranger.ok).toBe(false);
  const bad = await call(who('dora'), { op: 'join', code: 'AAAAAA', commander: 'borgo', deckId: 'dwarf-warband' });
  expect(bad.ok).toBe(false); expect(bad.error).toMatch(/No match with that code/);
  const mine = await call(a, { op: 'room', code: c.code });
  expect(mine).toMatchObject({ ok: true, status: 'waiting', matchId: null });
  expect((await call(a, { op: 'cancel', code: c.code })).ok).toBe(true);
  expect((await call(who('ed'), { op: 'join', code: c.code, commander: 'borgo', deckId: 'dwarf-warband' })).error).toMatch(/cancelled/);
});

test('AC601 joining starts the match for both; the second player sees the board as "player" with their own Commander and the names the right way round', async () => {
  const { a, b, code, matchId, viewB } = await startMatch();
  expect(viewB.mySide).toBe('b');
  expect(viewB.state.players.player.commanderId).toBe('borgo');
  expect(viewB.state.players.opponent.commanderId).toBe('grubnak');
  expect(viewB.names.them).toBe(a);
  const room = await call(a, { op: 'room', code });
  expect(room).toMatchObject({ ok: true, status: 'started', matchId });
  const va = (await call(a, { op: 'state', matchId })).view;
  expect(va.mySide).toBe('a');
  expect(va.state.players.player.commanderId).toBe('grubnak');
  expect(va.names).toEqual({ me: a, them: b });
  expect(va.seq).toBe(viewB.seq);
  expect((await call(a, { op: 'my_match' })).matchId).toBe(matchId);
  expect((await call(b, { op: 'my_match' })).matchId).toBe(matchId);
  // the first clock: about two minutes for the first mulligan
  const left = (Date.parse(va.deadline) - Date.now()) / 1000;
  expect(left).toBeGreaterThan(100); expect(left).toBeLessThanOrEqual(121);
});

test('AC602 nothing hidden leaks: the other hand and both decks are card backs only and the random seed is gone, in every view and in the stored views', async () => {
  const { a, b, matchId, viewB } = await startMatch();
  const va = (await call(a, { op: 'state', matchId })).view;
  for (const v of [va, viewB, await viewOf(matchId, a), await viewOf(matchId, b)]) {
    expect(hiddenHand(v)).toBe(true);
    expect(hiddenDecks(v)).toBe(true);
    expect(v.state.rng).toBe(0);
    expect(v.state.players.player.hand.every((h) => typeof h.cardId === 'string')).toBe(true);
    const text = JSON.stringify(v);
    expect(text).not.toMatch(/"deck":\[\{"uid":"k/); // real card uids start with k; hidden ones with d: / h:
    expect(text.match(/"cardId"/g).length).toBe(v.state.players.player.hand.length); // only my own hand names cards at the start
  }
});

test('AC603 out-of-turn, stale and illegal moves are refused, logged, and change nothing', async () => {
  const { a, b, matchId } = await startMatch();
  const before = (await call(a, { op: 'state', matchId })).view;
  const r1 = await call(b, { op: 'act', matchId, seq: before.seq, action: { type: 'mulligan', uids: [] } });
  expect(r1.ok).toBe(false); expect(r1.error).toMatch(/not your turn/);
  const r2 = await call(a, { op: 'act', matchId, seq: before.seq + 7, action: { type: 'mulligan', uids: [] } });
  expect(r2.ok).toBe(false); expect(r2.error).toMatch(/Out of date/);
  const r3 = await call(a, { op: 'act', matchId, seq: before.seq, action: { type: 'summon', uid: 'k1', row: 7, col: 3 } });
  expect(r3.ok).toBe(false); expect(r3.error).toMatch(/Illegal/);
  const r4 = await call(b, { op: 'act', matchId, seq: before.seq, action: { type: 'done', player: 'opponent' } });
  expect(r4.ok).toBe(false);
  const r5 = await call(who('eve'), { op: 'act', matchId, seq: before.seq, action: { type: 'done' } });
  expect(r5.ok).toBe(false); expect(r5.error).toMatch(/not in this match/);
  const after = (await call(a, { op: 'state', matchId })).view;
  expect(after.seq).toBe(before.seq);
  expect(JSON.stringify(after.state)).toBe(JSON.stringify(before.state));
  const moves = await movesOf(matchId);
  expect(moves.filter((m) => m.ok === false).length).toBe(4); // the stranger never reaches the log (refused before the match)
  expect(moves.every((m) => typeof m.action === 'object')).toBe(true);
});

test('AC604 a whole friend match plays to the end through the API, each side acting only on its own view', async () => {
  test.setTimeout(120_000);
  const { a, b, matchId } = await startMatch();
  let va = (await call(a, { op: 'state', matchId })).view, vb = (await call(b, { op: 'state', matchId })).view;
  let moves = 0, refused = 0, done = false;
  for (let n = 0; n < 500; n++) {
    const v = engine.legalActions(va.state).length ? va : vb; // whoever's view lists moves holds priority (the other sees none: hidden hand)
    const idle = v === va ? vb : va;
    expect(engine.legalActions(idle.state)).toEqual([]);
    const legal = engine.legalActions(v.state).filter((x) => x.type !== 'surrender');
    expect(legal.length).toBeGreaterThan(0);
    const busy = legal.filter((x) => x.type !== 'done' && x.type !== 'pass');
    const act = busy.length && Math.random() < 0.75 ? busy[Math.floor(Math.random() * busy.length)] : legal[Math.floor(Math.random() * legal.length)];
    if (Math.random() < 0.1) { const bad = await call(v === va ? b : a, { op: 'act', matchId, seq: idle.seq, action: { type: 'done' } }); expect(bad.ok).toBe(false); refused++; }
    const r = await call(v === va ? a : b, { op: 'act', matchId, seq: v.seq, action: act });
    expect(r.ok, JSON.stringify(act) + ' -> ' + r.error).toBe(true);
    moves++;
    expect(r.view.seq).toBeGreaterThan(v.seq);
    expect(hiddenHand(r.view) || r.view.state.players.opponent.hand.length === 0).toBe(true);
    va = await viewOf(matchId, a); vb = await viewOf(matchId, b);
    expect(va.seq).toBe(vb.seq);
    expect(vb.state.players.player.commanderId).toBe('borgo');
    if (va.status === 'over') { done = true; break; }
  }
  if (!done) { const f = await call(a, { op: 'forfeit', matchId }); expect(f.ok).toBe(true); va = await viewOf(matchId, a); vb = await viewOf(matchId, b); }
  expect(va.status).toBe('over'); expect(vb.status).toBe('over');
  expect(va.result.won).not.toBe(vb.result.won);
  expect(moves).toBeGreaterThan(20);
  const log = await movesOf(matchId);
  expect(log.filter((m) => m.ok).length).toBe(moves);
  expect(log.filter((m) => !m.ok).length).toBe(refused);
  expect((await call(a, { op: 'act', matchId, seq: va.seq, action: { type: 'done' } })).error).toMatch(/over/);
  expect((await call(a, { op: 'my_match' })).matchId).toBeNull();
});

test('AC605 giving up ends the match for both players and the loser is the one who gave up', async () => {
  const { a, b, matchId } = await startMatch();
  const f = await call(b, { op: 'forfeit', matchId });
  expect(f.ok).toBe(true);
  expect(f.view.status).toBe('over');
  expect(f.view.result).toEqual({ won: false, reason: 'surrender' });
  const va = await viewOf(matchId, a);
  expect(va.status).toBe('over');
  expect(va.result).toEqual({ won: true, reason: 'surrender' });
  expect(va.deadline).toBeNull();
  expect((await call(b, { op: 'forfeit', matchId })).error).toMatch(/over/);
});

test('AC606 the clock lives on the server: Done moves the deadline, and a Respond window swaps it for the short respond clock', async () => {
  test.setTimeout(120_000);
  const { a, b, matchId } = await startMatch();
  let va = (await call(a, { op: 'state', matchId })).view, vb = (await call(b, { op: 'state', matchId })).view;
  const d0 = va.deadline;
  expect(d0).toBeTruthy(); expect(va.respondDeadline).toBeNull();
  // keep both hands, then look for the first attack within a few turns
  let sawRespond = false;
  for (let n = 0; n < 300 && !sawRespond; n++) {
    const mine = engine.legalActions(va.state).length > 0;
    const v = mine ? va : vb;
    const legal = engine.legalActions(v.state).filter((x) => x.type !== 'surrender');
    const atk = legal.find((x) => x.type === 'attack');
    // walk towards the enemy so a fight happens within a few turns
    const foes = v.state.board.creatures.filter((c) => c.owner === 'opponent');
    const dist = (sq) => Math.min(...foes.map((f) => Math.max(Math.abs(f.row - sq.row), Math.abs(f.col - sq.col))), 99);
    const moves = legal.filter((x) => x.type === 'move').sort((x, y) => dist(x) - dist(y));
    const closer = moves.length && foes.length && dist(moves[0]) < dist(v.state.board.creatures.find((c) => c.uid === moves[0].creatureUid)) ? moves[0] : null;
    const pick = atk || legal.find((x) => x.type === 'summon') || closer || legal.find((x) => x.type === 'done' || x.type === 'mulligan' || x.type === 'pass');
    const r = await call(mine ? a : b, { op: 'act', matchId, seq: v.seq, action: pick });
    expect(r.ok, JSON.stringify(pick) + ' ' + r.error).toBe(true);
    if (atk) {
      sawRespond = true;
      expect(r.view.deadline).toBeNull();
      expect(r.view.respondDeadline).toBeTruthy();
      const left = (Date.parse(r.view.respondDeadline) - Date.now()) / 1000;
      expect(left).toBeGreaterThan(5); expect(left).toBeLessThanOrEqual(12.5);
      const other = await viewOf(matchId, mine ? b : a);
      expect(engine.legalActions(other.state).some((x) => x.type === 'pass')).toBe(true); // the defender may only pass (nothing to respond with) or respond
      const p = await call(mine ? b : a, { op: 'act', matchId, seq: other.seq, action: { type: 'pass' } });
      expect(p.ok).toBe(true);
      expect(p.view.respondDeadline).toBeNull();
      expect(p.view.deadline).toBeTruthy();
    }
    va = await viewOf(matchId, a); vb = await viewOf(matchId, b);
    if (va.status === 'over') break;
  }
  expect(sawRespond).toBe(true);
  expect(va.deadline === null || va.deadline !== d0).toBe(true);
});

test('AC670 no Respond window closes under 2 s: a quick pass straight to the server is refused, the same pass at 2 s goes through, and the attacker sees nothing of it', async () => {
  test.setTimeout(60_000);
  const { a, b, matchId } = await startMatch();
  let va = await viewOf(matchId, a), vb = await viewOf(matchId, b);
  let opened = 0, attacker = null, responder = null;
  for (let n = 0; n < 40 && !opened; n++) {
    const v = engine.legalActions(va.state).length ? va : vb, me = v === va ? a : b, them = v === va ? b : a;
    const legal = engine.legalActions(v.state).filter((x) => x.type !== 'surrender');
    const act = legal.find((x) => x.type === 'summon') || legal.find((x) => x.type === 'mulligan') || legal.find((x) => x.type === 'done');
    const r = await callAsReal(me, { op: 'act', matchId, seq: v.seq, action: act });
    expect(r.ok, r.error).toBe(true);
    if (r.view.respondDeadline) { opened = Date.now(); attacker = me; responder = them; }
    va = await viewOf(matchId, a); vb = await viewOf(matchId, b);
  }
  expect(opened, 'Done after a summon opened the Deploy window (no window per unit)').toBeGreaterThan(0);
  const seq = va.seq, seenBefore = await viewOf(matchId, attacker);
  let refused = 0;
  while (Date.now() - opened < 1500) {
    const p = await callAsReal(responder, { op: 'act', matchId, seq, action: { type: 'pass' } });
    expect(p.ok, 'a pass before 2 s').toBe(false);
    expect(p.tooSoonMs).toBeGreaterThan(0); expect(p.tooSoonMs).toBeLessThanOrEqual(2000);
    refused++;
    await new Promise((r) => setTimeout(r, 100));
  }
  expect(refused).toBeGreaterThan(3);
  expect(await viewOf(matchId, attacker), 'the attacker sees nothing change').toEqual(seenBefore);
  expect(JSON.stringify(seenBefore)).not.toContain('respondOpenedAt');
  await new Promise((r) => setTimeout(r, Math.max(0, opened + 2100 - Date.now())));
  const ok = await callAsReal(responder, { op: 'act', matchId, seq, action: { type: 'pass' } });
  expect(ok.ok, ok.error).toBe(true);
  expect(ok.view.respondDeadline).toBeNull();
});

test('AC607 a player can be in one match at a time, and a finished match frees them', async () => {
  const { a, b, matchId } = await startMatch();
  expect((await call(a, { op: 'create', commander: 'grubnak', deckId: 'goblin-warband' })).error).toMatch(/already in a match/);
  const c = await call(who('fay'), { op: 'create', commander: 'grubnak', deckId: 'goblin-warband' });
  expect((await call(b, { op: 'join', code: c.code, commander: 'borgo', deckId: 'dwarf-warband' })).error).toMatch(/already in a match/);
  await call(a, { op: 'forfeit', matchId });
  expect((await call(b, { op: 'join', code: c.code, commander: 'borgo', deckId: 'dwarf-warband' })).ok).toBe(true);
});

test('AC608 a saved deck must be the player\'s own and legal; a stranger\'s id or a made-up one is refused', async () => {
  const a = who('gus');
  const r = await call(a, { op: 'create', commander: 'grubnak', deckId: '00000000-0000-4000-8000-000000000000' });
  expect(r.ok).toBe(false); expect(r.error).toMatch(/isn't one of yours/);
  expect((await call(a, { op: 'create', commander: 'nobody', deckId: 'goblin-warband' })).error).toMatch(/Commander/);
  expect((await call(a, { op: 'create', commander: 'grubnak' })).error).toMatch(/deck/);
});

// ---- the real function on the test-runner's database (skips without one)
const SB_URL = process.env.SUPABASE_URL, SB_ANON = process.env.SUPABASE_ANON_KEY, SB_TEST_ADMIN = process.env.SUPABASE_TEST_ADMIN_KEY;
test('AC609 the real `match` function answers a signed-in player and turns away an anonymous one', async () => {
  test.skip(!SB_URL || !SB_ANON || !SB_TEST_ADMIN || process.env.PVP_FUNCTION_SKIP === '1', 'local Supabase not configured');
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(SB_URL, SB_TEST_ADMIN, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `t-${letters(12)}@test.local`, password = 'Goodpass123x';
  const fs = await import('node:fs');
  const eula = JSON.parse(fs.readFileSync(path.join(APP, 'src/content/eula.json'), 'utf8')).version;
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username: 'T' + letters(11), age_group: '13_plus', eula_version: eula } });
  expect(error, error && error.message).toBeNull();
  const c = createClient(SB_URL, SB_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: e2 } = await c.auth.signInWithPassword({ email, password });
  expect(e2, e2 && e2.message).toBeNull();
  const fnUrl = (process.env.SUPABASE_FUNCTIONS_URL || SB_URL.replace(/\/$/, '') + '/functions/v1') + '/match';
  const anon = await fetch(fnUrl, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SB_ANON }, body: JSON.stringify({ op: 'my_match' }) });
  expect(anon.status).toBe(401);
  const mine = await fetch(fnUrl, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SB_ANON, authorization: 'Bearer ' + s.session.access_token }, body: JSON.stringify({ op: 'my_match' }) });
  const body = await mine.json();
  expect(body).toEqual({ ok: true, matchId: null });
});
