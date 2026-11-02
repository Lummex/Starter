// Nov 2 (Helper C): the PvP client's match driver (src/net/pvp.ts NetGame) against a fake server.
import { describe, it, expect } from 'vitest';
import { NetGame, cleanCode, codeOk, friendlyError, type Transport } from '../src/net/pvp';
import { createMatch, legalActions } from '../src/engine';
import { viewFor } from '../src/engine/view';

/** A view as the server would send it: this player is 'player', the other hand and both decks hidden. */
function makeView(state: any, seq: number, extra: any = {}) {
  return { matchId: 'm1', seq, status: 'active', mySide: 'a', state: viewFor(state, 'player'), events: [], deadline: new Date(Date.now() + 120000).toISOString(), respondDeadline: null,
    bank: { me: 0, them: 0 }, timeouts: { me: 0, them: 0 }, names: { me: 'alice', them: 'bob' }, avatars: { me: null, them: null }, result: null, ...extra };
}
function fakeServer(answer: (op: string, body: any) => any) {
  const calls: { op: string; body: any }[] = [];
  const t: Transport = { call: async (op, body) => { calls.push({ op, body }); return answer(op, body); }, watch: () => () => {} };
  return { t, calls };
}
/** a fresh PvP match where this player has priority (the first seed that starts on our side) */
const deployState = () => { for (let seed = 1; seed < 50; seed++) { const s = createMatch({ pvp: true, seed, skipMulligan: true, testMode: true }); if (s.priority === 'player') return s; } throw new Error('no seed starts with the player'); };
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('NetGame views', () => {
  it('takes a view, ignores older ones and does not replay events for the same seq', () => {
    const s = deployState();
    const g = new NetGame(fakeServer(() => ({ ok: true })).t, 'm1');
    const seen: any[][] = [];
    g.subscribe((_st, ev) => seen.push(ev));
    expect(g.applyView(makeView(s, 5, { events: [{ type: 'income', player: 'player', amount: 1 }] }))).toBe(true);
    expect(g.seq).toBe(5);
    expect(g.applyView(makeView(s, 4))).toBe(false); // older
    expect(g.applyView(makeView(s, 5))).toBe(false); // same seq: clocks only
    expect(g.applyView(makeView(s, 8))).toBe(true); // more than one ahead is fine (full snapshots)
    expect(seen.length).toBe(2);
    expect(seen[0][0].type).toBe('income');
    expect(g.names.them).toBe('bob');
    expect(typeof g.deadline).toBe('number');
  });
  it('ignores a view of another match', () => {
    const g = new NetGame(fakeServer(() => ({ ok: true })).t, 'm1');
    expect(g.applyView({ ...makeView(deployState(), 1), matchId: 'other' })).toBe(false);
    expect(g.state).toBe(null);
  });
  it('tolerates hidden hand entries: legal actions and moves left work on the view', () => {
    const s = deployState();
    const g = new NetGame(fakeServer(() => ({ ok: true })).t, 'm1', makeView(s, 1));
    expect(g.state.players.opponent.hand.every((x: any) => x.hidden)).toBe(true);
    expect(Array.isArray(g.legalActions())).toBe(true);
    expect(g.legalActions().length).toBe(legalActions(viewFor(s, 'player')).length);
    expect(() => g.movesLeft()).not.toThrow();
    expect(g.getState().players.length).toBe(2);
  });
  it('a finished view shows the match over even if the state lags', () => {
    const s = deployState();
    const g = new NetGame(fakeServer(() => ({ ok: true })).t, 'm1');
    g.applyView(makeView(s, 3, { status: 'over', result: { won: true, reason: 'timeout', coins: 25 } }));
    expect(g.status).toBe('over');
    expect(g.state.phase).toBe('over');
    expect(g.state.winner).toBe('player');
    expect(g.legalActions()).toEqual([]);
  });
});

describe('NetGame acts', () => {
  it('sends {matchId, seq, action} and takes the returned view', async () => {
    const s = deployState();
    const after = JSON.parse(JSON.stringify(s)); after.turn = s.turn; // the server's answer (content does not matter here)
    const srv = fakeServer((op) => (op === 'act' ? { ok: true, view: makeView(after, 2, { events: [{ type: 'phase' }] }) } : { ok: true }));
    const g = new NetGame(srv.t, 'm1', makeView(s, 1));
    const a = s.priority === 'player' ? { type: 'done' } : { type: 'pass' };
    expect(s.priority).toBe('player'); // the seed gives the first priority to the player
    const r = g.act(a);
    expect(r.ok).toBe(true);
    await flush(); await flush();
    expect(srv.calls[0]).toEqual({ op: 'act', body: { matchId: 'm1', seq: 1, action: a } });
    expect(g.seq).toBe(2);
  });
  it('refuses at once when it is the other player\'s turn (brew aside)', () => {
    const s = deployState();
    s.priority = 'opponent';
    const g = new NetGame(fakeServer(() => ({ ok: true })).t, 'm1', makeView(s, 1));
    expect(g.act({ type: 'done' }).ok).toBe(false);
  });
  it('a server refusal re-syncs to the returned view and reports the error', async () => {
    const s = deployState();
    const srv = fakeServer((op) => (op === 'act' ? { ok: false, error: 'Not your turn', view: makeView(s, 1) } : { ok: true }));
    const g = new NetGame(srv.t, 'm1', makeView(s, 1));
    const errors: string[] = [];
    g.onError = (m) => errors.push(m);
    const evs: any[][] = [];
    g.subscribe((_s, e) => evs.push(e));
    const r = await g.actRemote({ type: 'done' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Not your turn');
    expect(r.seq).toBe(1);
    expect(evs[evs.length - 1]).toEqual([{ type: 'sync' }]);
    g.act({ type: 'done' }); await flush(); await flush(); expect(errors).toEqual(['Not your turn']);
  });
  it('holds an answer to a Respond window until 2 s after the window came up, and waits again when the server says too soon', async () => {
    const s = deployState();
    s.pendingResponse = { kind: 'summon', actor: 'opponent', responder: 'player', card: { uid: 'x', cardId: 'shiv-rat' }, target: null };
    let refuse = 1;
    const srv = fakeServer((op) => { if (op !== 'act') return { ok: true }; if (refuse-- > 0) return { ok: false, error: 'Too soon', tooSoonMs: 20 }; return { ok: true }; });
    const g = new NetGame(srv.t, 'm1', makeView(s, 1));
    g.respondMinMs = 60;
    const errors: string[] = [];
    g.onError = (m) => errors.push(m);
    expect(g.act({ type: 'pass' }).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 25));
    expect(srv.calls.filter((c) => c.op === 'act').length).toBe(0); // still held
    await new Promise((r) => setTimeout(r, 120));
    expect(srv.calls.filter((c) => c.op === 'act').length).toBe(2); // sent, told too soon, sent again
    expect(errors).toEqual([]);
  });
  it('drops a held pass when the window closed meanwhile', async () => {
    const s = deployState();
    s.pendingResponse = { kind: 'summon', actor: 'opponent', responder: 'player', card: { uid: 'x', cardId: 'shiv-rat' }, target: null };
    const srv = fakeServer(() => ({ ok: true }));
    const g = new NetGame(srv.t, 'm1', makeView(s, 1));
    g.respondMinMs = 30;
    g.act({ type: 'pass' });
    g.applyView(makeView(deployState(), 2));
    await new Promise((r) => setTimeout(r, 60));
    expect(srv.calls.filter((c) => c.op === 'act').length).toBe(0);
  });
  it('surrender goes to the forfeit op', async () => {
    const s = deployState();
    const srv = fakeServer((op) => (op === 'forfeit' ? { ok: true, view: makeView(s, 2, { status: 'over', result: { won: false, reason: 'surrender' } }) } : { ok: true }));
    const g = new NetGame(srv.t, 'm1', makeView(s, 1));
    expect(g.act({ type: 'surrender' }).ok).toBe(true);
    await flush(); await flush();
    expect(srv.calls.map((c) => c.op)).toEqual(['forfeit']);
    expect(g.status).toBe('over');
    expect(g.state.winner).toBe('opponent');
  });
});

describe('NetGame clock', () => {
  it('asks the server to tick only a second past the deadline, at most every 2 s', async () => {
    const s = deployState();
    const srv = fakeServer(() => ({ ok: true }));
    const g = new NetGame(srv.t, 'm1', makeView(s, 1, { deadline: new Date(1_000_000).toISOString() }));
    let now = 1_000_500;
    g.now = () => now;
    expect(await g.maybeTick()).toBe(false); // only 0.5 s past
    now = 1_001_200;
    expect(await g.maybeTick()).toBe(true);
    now = 1_002_000;
    expect(await g.maybeTick()).toBe(false); // throttled
    now = 1_003_300;
    expect(await g.maybeTick()).toBe(true);
    expect(srv.calls.filter((c) => c.op === 'tick').length).toBe(2);
  });
  it('a Respond window uses its own deadline', async () => {
    const s = deployState();
    const srv = fakeServer(() => ({ ok: true }));
    const g = new NetGame(srv.t, 'm1', makeView(s, 1, { deadline: new Date(9_000_000).toISOString(), respondDeadline: new Date(1_000_000).toISOString() }));
    g.now = () => 1_001_500;
    expect(await g.maybeTick()).toBe(true);
  });
});

describe('room codes', () => {
  it('six letters, no I or O, uppercased', () => {
    expect(cleanCode('ab-cd ef')).toBe('ABCDEF');
    expect(cleanCode('hijklmnop')).toBe('HJKLMN');
    expect(codeOk('ABCDEF')).toBe(true);
    expect(codeOk('ABCDEI')).toBe(false);
    expect(codeOk('ABCDE')).toBe(false);
  });
  it('plain-word errors', () => {
    expect(friendlyError('room expired')).toMatch(/expired/);
    expect(friendlyError(new Error('cannot join your own room'))).toMatch(/your own code/);
  });
});
