import { describe, it, expect } from 'vitest';
import { PvpService } from '../src/server/service';
import { MemoryStore } from '../src/server/memory-store';
import { legalActions, STARTER_DECKS } from '../src/engine';

// Modes (Ken, Nov 4): Ranked and Unranked queues, Practice codes. The service pairs players; the store keeps the queue and the ratings.
const alice = { userId: 'u-alice', username: 'Alice', avatar: null };
const bob = { userId: 'u-bob', username: 'Bob', avatar: null };
const carol = { userId: 'u-carol', username: 'Carol', avatar: null };
const T0 = 1_700_000_000_000;
const rig = () => { const store = new MemoryStore(() => 0.42); const svc = new PvpService(store, { engineVersion: 'test' }); return { store, svc }; };
const pick = { commander: 'grubnak', deckId: 'goblin-warband' };

describe('modes: the ranked / unranked queue', () => {
  it('refuses a mode it does not know and a deck that is not right', async () => {
    const { svc } = rig();
    expect((await svc.handle('queue', { mode: 'speedy', ...pick }, alice, T0)).ok).toBe(false);
    expect((await svc.handle('queue', { mode: 'ranked', commander: 'grubnak', cards: ['shiv-rat'] }, alice, T0)).ok).toBe(false);
  });
  it('one player waits; a second of the same mode is paired at once, the match carries the mode, the first finds it by my_match', async () => {
    const { store, svc } = rig();
    const r1 = await svc.handle('queue', { mode: 'unranked', ...pick }, alice, T0);
    expect(r1).toMatchObject({ ok: true, waiting: true, mode: 'unranked', rating: 1000, others: 0 });
    expect(store.queue.size).toBe(1);
    const r1b = await svc.handle('queue', { mode: 'unranked', ...pick }, alice, T0 + 2000); // the poll keeps the same wait
    expect(r1b.waiting).toBe(true);
    expect(r1b.waited).toBe(2);
    const r2 = await svc.handle('queue', { mode: 'unranked', commander: 'borgo', deckId: 'dwarf-warband' }, bob, T0 + 3000);
    expect(r2.ok).toBe(true);
    expect(r2.matchId).toBeTruthy();
    expect(r2.view.state.players.player.commanderId).toBe('borgo'); // Bob is seat b, sees himself as player
    const m = (await store.getMatch(r2.matchId))!;
    expect(m.mode).toBe('unranked');
    expect(m.players.a.userId).toBe('u-alice'); // the longer wait is seat a
    expect(store.queue.size).toBe(0);
    expect((await svc.handle('my_match', {}, alice, T0 + 4000)).matchId).toBe(r2.matchId);
    expect((await svc.handle('queue', { mode: 'unranked', ...pick }, alice, T0 + 4000)).matchId).toBe(r2.matchId); // a late poll answers with the match
  });
  it('ranked and unranked never meet; leave takes a player out; rank reads 1000 Sapphire III to start', async () => {
    const { store, svc } = rig();
    await svc.handle('queue', { mode: 'ranked', ...pick }, alice, T0);
    const r = await svc.handle('queue', { mode: 'unranked', ...pick }, bob, T0 + 1000);
    expect(r.waiting).toBe(true);
    expect(store.queue.size).toBe(2);
    expect((await svc.handle('leave', {}, alice, T0 + 2000)).ok).toBe(true);
    expect(store.queue.size).toBe(1);
    expect((await svc.handle('rank', {}, alice, T0)).rank).toMatchObject({ rating: 1000, name: 'Sapphire III', games: 0 });
  });
  it('a ranked match moves both ratings when it ends (the winner up, the loser down), and a practice code pays nothing', async () => {
    const { store, svc } = rig();
    await svc.handle('queue', { mode: 'ranked', ...pick }, alice, T0);
    const r = await svc.handle('queue', { mode: 'ranked', commander: 'borgo', deckId: 'dwarf-warband' }, bob, T0 + 500);
    expect(r.matchId).toBeTruthy();
    expect((await svc.handle('forfeit', { matchId: r.matchId }, bob, T0 + 1000)).ok).toBe(true);
    await svc.handle('state', { matchId: r.matchId }, alice, T0 + 1500); // the referee settles the finished match on the next call
    expect((await svc.handle('rank', {}, alice, T0)).rank).toMatchObject({ rating: 1016, wins: 1, games: 1 });
    expect((await svc.handle('rank', {}, bob, T0)).rank).toMatchObject({ rating: 984, losses: 1 });
    // practice: a code made with practice: true
    const c = await svc.handle('create', { ...pick, practice: true }, carol, T0 + 2000);
    expect(c).toMatchObject({ ok: true, mode: 'practice' });
    const j = await svc.handle('join', { code: c.code, commander: 'borgo', deckId: 'dwarf-warband' }, bob, T0 + 3000);
    expect(j.ok).toBe(true);
    expect((await store.getMatch(j.matchId))!.mode).toBe('practice');
    const plain = await svc.handle('create', { ...pick }, alice, T0 + 4000);
    expect(plain.mode).toBe('friend');
    void legalActions;
  });
  it("Nov 5 (Ken, per copy): a saved deck's copies carry their own tiers into the match (hidden in the other player's hand); the id map carries only the Commander", async () => {
    const { store, svc } = rig();
    const cards = STARTER_DECKS['goblin-warband'].slice();
    const tiers = cards.map((_, i) => (i === 0 ? 5 : i === 1 ? 2 : 1)); // one Mythic copy, one Enhanced, the rest plain
    store.savedDecks.set('u-alice/mine', { commander: 'grubnak', cards, tiers });
    store.tiers.set('u-alice', { 'commander-grubnak': 3, 'goblin-grunt': 5, 'not-in-deck': 4 });
    await svc.handle('queue', { mode: 'unranked', commander: 'grubnak', deckId: 'mine' }, alice, T0);
    const r = await svc.handle('queue', { mode: 'unranked', commander: 'borgo', deckId: 'dwarf-warband' }, bob, T0 + 500);
    const m = (await store.getMatch(r.matchId))!;
    expect(m.tiers!.a).toEqual({ 'commander-grubnak': 3 }); // the id map is the Commander's alone now
    const all = [...m.state.players.player.hand, ...m.state.players.player.deck];
    expect(all.filter((k: any) => k.tier === 5).length).toBe(1);
    expect(all.filter((k: any) => k.tier === 2).length).toBe(1);
    expect(all.filter((k: any) => k.tier).length).toBe(2); // plain copies carry no tier at all
    expect(m.state.players.opponent.deck.some((k: any) => k.tier)).toBe(false);
    // Bob's view: Alice's hand and deck are hidden, tiers included; the id map shows her Commander
    expect(r.view.tiers).toEqual({ me: {}, them: { 'commander-grubnak': 3 } });
    expect(r.view.state.players.opponent.hand.every((k: any) => k.hidden && k.tier === undefined)).toBe(true);
    const mine = (await svc.handle('state', { matchId: r.matchId }, alice, T0 + 600)).view.state.players.player;
    expect([...mine.hand, ...mine.deck.filter((k: any) => !k.hidden)].filter((k: any) => k.tier).length + mine.deck.filter((k: any) => k.hidden).length).toBeGreaterThan(0);
  });
});
