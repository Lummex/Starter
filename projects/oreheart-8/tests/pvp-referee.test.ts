import { describe, it, expect } from 'vitest';
import { legalActions, createMatch, STARTER_DECK_LIST } from '../src/engine';
import { PvpService } from '../src/server/service';
import { MemoryStore } from '../src/server/memory-store';
import { DEFAULT_RULES, type View } from '../src/server/referee';

function picker(seed: number) { let x = seed | 0; return () => { x = (x + 0x6d2b79f5) | 0; let t = Math.imul(x ^ (x >>> 15), x | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const alice = { userId: 'u-alice', username: 'Alice', avatar: 'goblin-goggle-rogue' };
const bob = { userId: 'u-bob', username: 'Bob', avatar: null };
const deckOf = (faction: string) => STARTER_DECK_LIST.find((d) => d.faction === faction)!.id;
const T0 = Date.UTC(2026, 10, 2, 12, 0, 0);
const SEC = 1000;

async function freshMatch(seed = 1) {
  const store = new MemoryStore(picker(seed));
  const svc = new PvpService(store, { engineVersion: 'test' });
  const c = await svc.handle('create', { commander: 'grubnak', deckId: deckOf('goblins') }, alice, T0);
  expect(c.ok, JSON.stringify(c)).toBe(true);
  const j = await svc.handle('join', { code: c.code, commander: 'borgo', deckId: deckOf('dwarves') }, bob, T0 + SEC);
  expect(j.ok, JSON.stringify(j)).toBe(true);
  return { store, svc, code: c.code as string, matchId: j.matchId as string, viewB: j.view as View };
}
const userOf = (v: View) => (v.mySide === 'a' ? alice : bob);

describe('PvP rooms', () => {
  it('makes a six-letter code, joins once, refuses the host and strangers', async () => {
    const store = new MemoryStore(picker(7));
    const svc = new PvpService(store);
    const c = await svc.handle('create', { commander: 'grubnak', deckId: deckOf('goblins') }, alice, T0);
    expect(c.code).toMatch(/^[A-HJ-NP-Z]{6}$/);
    expect((await svc.handle('join', { code: c.code, commander: 'borgo', deckId: deckOf('dwarves') }, alice, T0)).error).toMatch(/your own code/);
    expect((await svc.handle('join', { code: 'ZZZZZZ', commander: 'borgo', deckId: deckOf('dwarves') }, bob, T0)).error).toMatch(/No match with that code/);
    expect((await svc.handle('join', { code: c.code, commander: 'borgo', deckId: 'not-a-deck' }, bob, T0)).error).toMatch(/isn't one of yours/);
    expect((await svc.handle('room', { code: c.code }, { userId: 'u-x', username: 'X', avatar: null }, T0)).error).toMatch(/not yours/);
    const j = await svc.handle('join', { code: c.code.toLowerCase() }, bob, T0); // lower case is fine; a missing commander is not
    expect(j.error).toMatch(/Commander/);
    const ok = await svc.handle('join', { code: c.code, commander: 'borgo', deckId: deckOf('dwarves') }, bob, T0 + SEC);
    expect(ok.ok).toBe(true);
    expect((await svc.handle('room', { code: c.code }, alice, T0 + 2 * SEC))).toMatchObject({ ok: true, status: 'started', matchId: ok.matchId, guest: 'Bob' });
    const again = await svc.handle('join', { code: c.code, commander: 'borgo', deckId: deckOf('dwarves') }, bob, T0 + 3 * SEC);
    expect(again.ok).toBe(true); // the guest asking again just gets the match back
    expect(again.matchId).toBe(ok.matchId);
    const third = { userId: 'u-carl', username: 'Carl', avatar: null };
    expect((await svc.handle('join', { code: c.code, commander: 'borgo', deckId: deckOf('dwarves') }, third, T0 + 3 * SEC)).error).toMatch(/already started/);
    expect((await svc.handle('my_match', {}, alice, T0)).matchId).toBe(ok.matchId);
    expect((await svc.handle('my_match', {}, third, T0)).matchId).toBeNull();
    expect((await svc.handle('create', { commander: 'grubnak', deckId: deckOf('goblins') }, alice, T0)).error).toMatch(/already in a match/);
  });
  it('expires a code after 30 minutes and lets the host cancel', async () => {
    const store = new MemoryStore(picker(8));
    const svc = new PvpService(store);
    const c = await svc.handle('create', { commander: 'grubnak', deckId: deckOf('goblins') }, alice, T0);
    expect((await svc.handle('join', { code: c.code, commander: 'borgo', deckId: deckOf('dwarves') }, bob, T0 + 31 * 60 * SEC)).error).toMatch(/expired/);
    const c2 = await svc.handle('create', { commander: 'grubnak', deckId: deckOf('goblins') }, alice, T0);
    expect((await svc.handle('cancel', { code: c2.code }, bob, T0)).error).toMatch(/Only the player who made/);
    expect((await svc.handle('cancel', { code: c2.code }, alice, T0)).ok).toBe(true);
    expect((await svc.handle('join', { code: c2.code, commander: 'borgo', deckId: deckOf('dwarves') }, bob, T0)).error).toMatch(/cancelled/);
  });
});

describe('PvP referee', () => {
  it('shows each player only their own side, mirrored for the second player, with nothing hidden leaking', async () => {
    const { store, svc, matchId, viewB } = await freshMatch(2);
    expect(viewB.mySide).toBe('b');
    expect(viewB.state.players.player.commanderId).toBe('borgo'); // Bob plays as 'player' on his screen
    expect(viewB.state.players.opponent.commanderId).toBe('grubnak');
    expect(viewB.names).toEqual({ me: 'Bob', them: 'Alice' });
    expect(viewB.state.players.opponent.hand.every((h: any) => h.hidden)).toBe(true);
    expect(viewB.state.players.player.deck.every((h: any) => h.hidden)).toBe(true);
    expect(viewB.state.rng).toBe(0);
    const va = (await svc.handle('state', { matchId }, alice, T0 + 2 * SEC)).view as View;
    expect(va.mySide).toBe('a');
    expect(va.state.players.player.commanderId).toBe('grubnak');
    const truth = (await store.getMatch(matchId))!.state;
    const leak = (v: View, side: 'player' | 'opponent') => { const t = JSON.stringify(v); return [...truth.players[side].hand, ...truth.players.player.deck, ...truth.players.opponent.deck].some((c: any) => t.includes(JSON.stringify(c.uid))); };
    expect(leak(va, 'opponent')).toBe(false);
    expect(leak(viewB, 'player')).toBe(false);
    expect(JSON.stringify(va).includes('"rng":' + truth.rng)).toBe(false);
    expect(va.deadline).toBe(new Date(T0 + SEC + DEFAULT_RULES.phaseSeconds * SEC).toISOString()); // Alice (mulligan first) has 2 minutes from the join
  });

  it('refuses out-of-turn, stale and illegal moves, logs them, and changes nothing', async () => {
    const { store, svc, matchId } = await freshMatch(3);
    const before = JSON.stringify((await store.getMatch(matchId))!.state);
    // Alice holds the first mulligan; Bob may not act
    const r1 = await svc.handle('act', { matchId, seq: 0, action: { type: 'mulligan', uids: [] } }, bob, T0 + 2 * SEC);
    expect(r1.ok).toBe(false); expect(r1.error).toMatch(/not your turn/);
    const r2 = await svc.handle('act', { matchId, seq: 5, action: { type: 'mulligan', uids: [] } }, alice, T0 + 2 * SEC);
    expect(r2.ok).toBe(false); expect(r2.error).toMatch(/Out of date/);
    const r3 = await svc.handle('act', { matchId, seq: 0, action: { type: 'summon', uid: 'nope', row: 7, col: 3 } }, alice, T0 + 2 * SEC);
    expect(r3.ok).toBe(false); expect(r3.error).toMatch(/Illegal/);
    const stranger = await svc.handle('act', { matchId, seq: 0, action: { type: 'done' } }, { userId: 'u-x', username: 'X', avatar: null }, T0);
    expect(stranger.error).toMatch(/not in this match/);
    expect(JSON.stringify((await store.getMatch(matchId))!.state)).toBe(before);
    expect(store.moves.filter((m) => !m.ok).length).toBe(3);
    expect((await store.getMatch(matchId))!.seq).toBe(0);
    // a player may never act for the other side by naming it
    const r4 = await svc.handle('act', { matchId, seq: 0, action: { type: 'mulligan', uids: [], player: 'opponent' } }, bob, T0 + 2 * SEC);
    expect(r4.ok).toBe(false);
  });

  it('plays whole random matches to the end through the service, both players acting on their own views', async () => {
    let finished = 0, moves = 0;
    for (let seed = 11; seed <= 16; seed++) {
      const { store, svc, matchId } = await freshMatch(seed);
      const rnd = picker(seed * 977);
      let now = T0 + 2 * SEC;
      let va = (await svc.handle('state', { matchId }, alice, now)).view as View;
      let vb = (await svc.handle('state', { matchId }, bob, now)).view as View;
      for (let n = 0; n < 700; n++) {
        const cur = (await store.getMatch(matchId))!;
        if (cur.status !== 'active') break;
        // the player whose turn it is acts from THEIR view (Bob's is mirrored); the other player must be refused
        const holderIsA = cur.state.priority === 'player';
        const v = holderIsA ? va : vb, idle = holderIsA ? vb : va;
        const legal = legalActions(v.state).filter((a: any) => a.type !== 'surrender');
        expect(legal.length).toBeGreaterThan(0);
        const busy = legal.filter((a: any) => a.type !== 'done' && a.type !== 'pass');
        const a = busy.length && rnd() < 0.75 ? busy[Math.floor(rnd() * busy.length)] : legal[Math.floor(rnd() * legal.length)];
        now += 3 * SEC;
        expect(legalActions(idle.state)).toEqual([]); // the idle player's view can't even list moves for the other side (hidden hand)
        if (rnd() < 0.1) { const bad = await svc.handle('act', { matchId, seq: idle.seq, action: { type: 'done' } }, userOf(idle), now); expect(bad.ok).toBe(false); expect(bad.error).toMatch(/not your turn|over/); }
        const r = await svc.handle('act', { matchId, seq: v.seq, action: a }, userOf(v), now);
        expect(r.ok, `seed ${seed} move ${n}: ${JSON.stringify(a)} -> ${r.error}`).toBe(true);
        moves++;
        // what Realtime would deliver to each side
        va = store.viewOf(matchId, alice.userId)!; vb = store.viewOf(matchId, bob.userId)!;
        expect(va.seq).toBe(vb.seq);
        expect(r.view.seq).toBe(va.seq);
        // the second player always sees himself as 'player'
        expect(vb.state.players.player.commanderId).toBe('borgo');
        expect(vb.state.players.opponent.hand.every((h: any) => h.hidden)).toBe(true);
        expect(va.state.players.opponent.hand.every((h: any) => h.hidden)).toBe(true);
      }
      const cur = (await store.getMatch(matchId))!;
      if (cur.status === 'active') { const f = await svc.handle('forfeit', { matchId }, alice, now); expect(f.ok).toBe(true); }
      const done = (await store.getMatch(matchId))!;
      expect(done.status).toBe('finished');
      expect(done.result).toBeTruthy();
      expect(store.finishedCalls.filter((f) => f.matchId === matchId).length).toBe(1);
      const sa = store.finishedCalls.find((f) => f.matchId === matchId)!.summaries;
      expect(sa.a.won !== sa.b.won || done.result!.winner === null).toBe(true);
      expect(store.viewOf(matchId, bob.userId)!.status).toBe('over');
      expect((await svc.handle('act', { matchId, seq: done.seq, action: { type: 'done' } }, alice, now)).error).toMatch(/over/);
      expect((await svc.handle('my_match', {}, alice, now)).matchId).toBeNull();
      finished++;
    }
    expect(finished).toBe(6);
    expect(moves).toBeGreaterThan(300);
  });

  it("runs Ken's clock on the server: 2 minutes a phase, the unused time banked up to 60 s, timeouts, forfeit after three", async () => {
    const { store, svc, matchId } = await freshMatch(21);
    let now = T0 + 2 * SEC;
    // both keep their hands; Alice used 10 s, Bob 30 s
    now = T0 + 10 * SEC;
    let r = await svc.handle('act', { matchId, seq: 0, action: { type: 'mulligan', uids: [] } }, alice, now); expect(r.ok).toBe(true);
    expect(r.view.bank.me).toBe(110 > 60 ? 60 : 110); // 110 s unused, capped at 60
    now = T0 + 40 * SEC;
    r = await svc.handle('act', { matchId, seq: 1, action: { type: 'mulligan', uids: [] } }, bob, now); expect(r.ok).toBe(true);
    expect(r.view.bank.me).toBe(60);
    let m = (await store.getMatch(matchId))!;
    const first = m.state.priority; // whoever goes first gets 120 + 60 s
    expect(m.clock.deadline).toBe(now + 180 * SEC);
    // nothing happens before the deadline
    r = await svc.handle('tick', { matchId }, alice, now + 100 * SEC); expect(r.view.seq).toBe(2);
    // the clock runs out: the referee plays Done for the slow player, their bank is gone, one timeout counted
    r = await svc.handle('tick', { matchId }, alice, now + 181 * SEC);
    m = (await store.getMatch(matchId))!;
    expect(m.seq).toBe(3);
    const slow = first === 'player' ? 'a' : 'b';
    expect(m.clock.timeouts[slow]).toBe(1);
    expect(m.clock.bank[slow]).toBe(0);
    expect(m.state.phase).toBe('action');
    expect(m.clock.deadline).toBe(now + 181 * SEC + 120 * SEC);
    // two more timeouts in a row and that player forfeits
    r = await svc.handle('tick', { matchId }, bob, now + 181 * SEC + 121 * SEC);
    m = (await store.getMatch(matchId))!;
    expect(m.clock.timeouts[slow]).toBe(2);
    expect(m.status).toBe('active');
    // from here the turn passes back and forth; whoever reaches three timeouts in a row first (the slow player) forfeits
    let ticks = 0;
    while (m.status === 'active' && ticks++ < 8) { const due = m.clock.deadline!; r = await svc.handle('tick', { matchId }, bob, due + SEC); m = (await store.getMatch(matchId))!; }
    expect(ticks).toBeLessThanOrEqual(4);
    expect(m.status).toBe('finished');
    expect(m.result).toEqual({ winner: slow === 'a' ? 'b' : 'a', reason: 'timeout' });
    expect(store.finishedCalls.length).toBe(1);
    const vb = store.viewOf(matchId, bob.userId)!;
    expect(vb.status).toBe('over');
    expect(vb.result!.won).toBe(slow === 'a');
  });

  it('freezes the main clock during a Respond window and passes for a sleeping responder', async () => {
    // a hand-built board: two rats face to face, Alice (player) to act first
    const { store, svc, matchId } = await freshMatch(31);
    const rec = (await store.getMatch(matchId))!;
    const setup = { playerHand: [], opponentHand: [], board: [{ owner: 'player', cardId: 'shiv-rat', row: 4, col: 5 }, { owner: 'opponent', cardId: 'shiv-rat', row: 4, col: 6 }], firstPlayer: 'player' };
    rec.state = createMatch({ seed: 1, setup, mines: [{ row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 6 }], factionLock: false, pvp: true });
    rec.clock.deadline = T0 + 120 * SEC;
    await store.updateMatch(rec, rec.seq);
    let now = T0 + 10 * SEC;
    let r = await svc.handle('act', { matchId, seq: rec.seq, action: { type: 'done' } }, alice, now); // deploy -> action
    expect(r.ok).toBe(true);
    const atk = legalActions(r.view.state).find((a: any) => a.type === 'attack');
    expect(atk).toBeTruthy();
    now = T0 + 20 * SEC;
    r = await svc.handle('act', { matchId, seq: r.view.seq, action: atk }, alice, now);
    expect(r.ok).toBe(true);
    const after = (await store.getMatch(matchId))!;
    expect(after.state.pendingResponse?.kind).toBe('attack'); // PvP: the window always opens, Bob holds nothing to respond with
    expect(after.state.priority).toBe('opponent');
    expect(after.clock.deadline).toBeNull();
    expect(after.clock.respondDeadline).toBe(now + DEFAULT_RULES.respondSeconds * SEC);
    const frozen = after.clock.frozenLeft!;
    expect(frozen).toBe(170 * SEC); // Alice banked 60 s from the Deploy phase: 120 + 60 - 10 s used = 170 s left when the window opened
    expect(r.view.deadline).toBeNull();
    expect(r.view.respondDeadline).toBe(new Date(now + 12 * SEC).toISOString());
    // Bob sleeps: after 12 s the referee passes for him; the attack resolves and Alice's clock runs on from where it froze
    const t = await svc.handle('tick', { matchId }, alice, now + 13 * SEC);
    expect(t.ok).toBe(true);
    const resumed = (await store.getMatch(matchId))!;
    expect(resumed.state.pendingResponse).toBeNull();
    expect(resumed.clock.respondDeadline).toBeNull();
    expect(resumed.clock.deadline).toBe(now + 13 * SEC + frozen);
    expect(resumed.clock.timeouts.b).toBe(0); // Gauge, Nov 2: a Respond window running out is not a timeout
    expect(resumed.log.some((e: any) => e.type === 'timeout')).toBe(false);
  });

  it('never counts a Respond run-out as a timeout: a player who looks away during the enemy turn cannot lose by it', async () => {
    const { store, svc, matchId } = await freshMatch(32);
    const rec = (await store.getMatch(matchId))!;
    const hand = Array(8).fill('shiv-rat');
    const setup = { playerHand: hand, opponentHand: [], playerCrystals: 40, board: [], firstPlayer: 'player' };
    rec.state = createMatch({ seed: 1, setup, mines: [{ row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 6 }], factionLock: false, pvp: true });
    rec.clock.deadline = T0 + 120 * SEC;
    await store.updateMatch(rec, rec.seq);
    let now = T0 + SEC;
    for (let i = 0; i < 6; i++) { // Alice summons six times; Bob never touches anything, and each 12 s window runs out
      const v = (await svc.handle('state', { matchId }, alice, now)).view as View;
      const summon = legalActions(v.state).find((a: any) => a.type === 'summon');
      expect(summon, 'a summon is legal').toBeTruthy();
      const r = await svc.handle('act', { matchId, seq: v.seq, action: summon }, alice, now);
      expect(r.ok, r.error).toBe(true);
      expect(r.view.respondDeadline).toBeTruthy();
      now += 13 * SEC;
      expect((await svc.handle('tick', { matchId }, bob, now)).ok).toBe(true);
      const m = (await store.getMatch(matchId))!;
      expect(m.status).toBe('active');
      expect(m.clock.timeouts.b).toBe(0);
      expect(m.state.pendingResponse).toBeNull();
    }
    expect((await store.getMatch(matchId))!.state.board.creatures.length).toBe(6);
  });

  it('a pass (the browser answers by itself) does not clear the count of whole phases that ran out', async () => {
    const { store, svc, matchId } = await freshMatch(33);
    const rec = (await store.getMatch(matchId))!;
    const setup = { playerHand: ['shiv-rat'], opponentHand: [], playerCrystals: 40, board: [], firstPlayer: 'player' };
    rec.state = createMatch({ seed: 1, setup, mines: [{ row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 6 }], factionLock: false, pvp: true });
    rec.clock.deadline = T0 + 120 * SEC;
    rec.clock.timeouts.b = 2; // Bob already let two phases run out
    await store.updateMatch(rec, rec.seq);
    const v = (await svc.handle('state', { matchId }, alice, T0 + SEC)).view as View;
    const summon = legalActions(v.state).find((a: any) => a.type === 'summon');
    const r = await svc.handle('act', { matchId, seq: v.seq, action: summon }, alice, T0 + SEC);
    expect(r.ok).toBe(true);
    const vb = store.viewOf(matchId, bob.userId)!;
    const p = await svc.handle('act', { matchId, seq: vb.seq, action: { type: 'pass' } }, bob, T0 + 3 * SEC);
    expect(p.ok, p.error).toBe(true);
    expect((await store.getMatch(matchId))!.clock.timeouts.b).toBe(2);
  });

  it('never applies two moves on one seq (compare-and-swap)', async () => {
    const { store, svc, matchId } = await freshMatch(41);
    const orig = store.updateMatch.bind(store);
    let once = true;
    store.updateMatch = async (m, exp) => { if (once) { once = false; return false; } return orig(m, exp); };
    const r = await svc.handle('act', { matchId, seq: 0, action: { type: 'mulligan', uids: [] } }, alice, T0 + SEC);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/moved on/);
    expect((await store.getMatch(matchId))!.seq).toBe(0);
    const r2 = await svc.handle('act', { matchId, seq: 0, action: { type: 'mulligan', uids: [] } }, alice, T0 + 2 * SEC);
    expect(r2.ok).toBe(true);
  });

  it('lets a player surrender at any time, even off turn', async () => {
    const { store, svc, matchId } = await freshMatch(51);
    const r = await svc.handle('act', { matchId, seq: 0, action: { type: 'surrender' } }, bob, T0 + SEC);
    expect(r.ok).toBe(true);
    const m = (await store.getMatch(matchId))!;
    expect(m.status).toBe('finished');
    expect(m.result).toEqual({ winner: 'a', reason: 'surrender' });
    expect(r.view.result).toEqual({ won: false, reason: 'surrender' });
  });
});
