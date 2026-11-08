import { describe, it, expect } from 'vitest';
import { PvpService } from '../src/server/service';
import { MemoryStore } from '../src/server/memory-store';

// Regions (Ken, Nov 5: East / Central / West servers with live counts). A region is a matchmaking pool: the queue pairs within it,
// or across regions once a player agreed to "Search all regions" (offered after the server's fallback time).
const alice = { userId: 'u-alice', username: 'Alice', avatar: null };
const bob = { userId: 'u-bob', username: 'Bob', avatar: null };
const carol = { userId: 'u-carol', username: 'Carol', avatar: null };
const T0 = 1_700_000_000_000;
const rig = () => { const store = new MemoryStore(() => 0.42); const svc = new PvpService(store, { engineVersion: 'test' }); return { store, svc }; };
const pick = { commander: 'grubnak', deckId: 'goblin-warband' };
const pickB = { commander: 'borgo', deckId: 'dwarf-warband' };

describe('regions: the queue is per server', () => {
  it('lists the enabled servers; a join says its region, the others near and everywhere, and when to offer every region', async () => {
    const { svc } = rig();
    const list = await svc.handle('regions', {}, alice, T0);
    expect(list.ok).toBe(true);
    expect(list.regions.map((r: any) => r.id)).toEqual(['us-east', 'us-central', 'us-west']);
    expect(list.regions[2].edge).toBe('us-west-1');
    const a = await svc.handle('queue', { mode: 'unranked', region: 'us-west', ...pick }, alice, T0);
    expect(a).toMatchObject({ ok: true, waiting: true, region: 'us-west', anyRegion: false, others: 0, othersAll: 0, fallback: 45 });
    const b = await svc.handle('queue', { mode: 'unranked', region: 'us-east', ...pickB }, bob, T0 + 1000);
    expect(b).toMatchObject({ ok: true, waiting: true, region: 'us-east', others: 0, othersAll: 1 }); // Alice waits, but in the West
  });
  it('East and West never meet by themselves; a region the list does not have becomes the default (US East)', async () => {
    const { store, svc } = rig();
    await svc.handle('queue', { mode: 'unranked', region: 'us-west', ...pick }, alice, T0);
    const b = await svc.handle('queue', { mode: 'unranked', region: 'us-east', ...pickB }, bob, T0 + 1000);
    expect(b.waiting).toBe(true);
    expect(store.queue.size).toBe(2);
    const c = await svc.handle('queue', { mode: 'unranked', region: 'moon', ...pick }, carol, T0 + 2000);
    expect(c.matchId).toBeTruthy(); // Carol lands in the East and meets Bob
    expect((await store.getMatch(c.matchId))!.region).toBe('us-east');
    const old = await svc.handle('queue', { mode: 'unranked', ...pick }, alice, T0 + 3000); // an older game sends no region at all
    expect(old).toMatchObject({ waiting: true, region: 'us-east' }); // ... and lands in the default too
  });
  it('"Search all regions" on either side pairs across regions, the same region first; the match keeps seat a\'s region', async () => {
    const { store, svc } = rig();
    await svc.handle('queue', { mode: 'unranked', region: 'us-west', ...pick }, alice, T0);
    expect((await svc.handle('queue', { mode: 'unranked', region: 'us-east', ...pickB }, bob, T0 + 1000)).waiting).toBe(true);
    // Bob agrees to search every server: the next poll pairs him with Alice in the West; the wait he already had is kept
    const r = await svc.handle('queue', { mode: 'unranked', region: 'us-east', anyRegion: true, ...pickB }, bob, T0 + 5000);
    expect(r.matchId).toBeTruthy();
    const m = (await store.getMatch(r.matchId))!;
    expect(m.region).toBe('us-west');
    expect(m.players.a.userId).toBe('u-alice');
    expect(store.queue.size).toBe(0);
    // the other way round: Carol searches everywhere from Central; Alice (back in the West) is found
    await svc.handle('forfeit', { matchId: r.matchId }, bob, T0 + 6000);
    await svc.handle('state', { matchId: r.matchId }, alice, T0 + 6500);
    await svc.handle('queue', { mode: 'unranked', region: 'us-central', anyRegion: true, ...pick }, carol, T0 + 7000);
    const a2 = await svc.handle('queue', { mode: 'unranked', region: 'us-west', ...pick }, alice, T0 + 8000);
    expect(a2.matchId).toBeTruthy();
    expect((await store.getMatch(a2.matchId))!.region).toBe('us-central');
  });
  it('a searcher of all regions still takes the one in their own region first, over a longer wait elsewhere', async () => {
    const { store, svc } = rig();
    await svc.handle('queue', { mode: 'unranked', region: 'us-west', ...pick }, alice, T0);                           // the longer wait, West
    await svc.handle('queue', { mode: 'unranked', region: 'us-east', ...pick }, carol, T0 + 20_000);                 // East
    const r = await svc.handle('queue', { mode: 'unranked', region: 'us-east', anyRegion: true, ...pickB }, bob, T0 + 21_000);
    expect(r.matchId).toBeTruthy();
    const m = (await store.getMatch(r.matchId))!;
    expect(m.players.a.userId).toBe('u-carol');
    expect(m.region).toBe('us-east');
    expect(store.queue.has('u-alice')).toBe(true);
  });
  it('ranked keeps its rating window across regions too, and the mock fallback can be shortened for the browser checks', async () => {
    const { store, svc } = rig();
    store.fallbackSeconds = 4;
    await svc.handle('rank', {}, alice, T0); // makes her rating row
    store.ratings.get('u-alice')!.rating = 1400; store.elo.set('u-alice', 1400); // Nov 7: matchmaking uses the hidden Elo
    await svc.handle('queue', { mode: 'ranked', region: 'us-west', anyRegion: true, ...pick }, alice, T0);
    const r = await svc.handle('queue', { mode: 'ranked', region: 'us-east', anyRegion: true, ...pickB }, bob, T0 + 1000);
    expect(r).toMatchObject({ waiting: true, fallback: 4 }); // 1400 vs 1000 is outside the window, in any region
  });
  it('a friend code remembers the host\'s region and the match counts under it', async () => {
    const { store, svc } = rig();
    const c = await svc.handle('create', { region: 'us-central', ...pick }, alice, T0);
    expect(c.ok).toBe(true);
    const j = await svc.handle('join', { code: c.code, region: 'us-west', ...pickB }, bob, T0 + 1000);
    expect(j.matchId).toBeTruthy();
    expect((await store.getMatch(j.matchId))!.region).toBe('us-central');
  });
});
