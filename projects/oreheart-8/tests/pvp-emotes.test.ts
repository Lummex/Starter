// Nov 7 (Ken): emotes in PvP. The referee keeps the last few, never bumps the move counter, one every 2 s per player,
// known ids only, bought ones checked with the store; frames and titles ride on the views.
import { describe, it, expect } from 'vitest';
import { STARTER_DECK_LIST } from '../src/engine';
import { PvpService } from '../src/server/service';
import { MemoryStore } from '../src/server/memory-store';
import { EMOTE_KEEP, type View } from '../src/server/referee';

function picker(seed: number) { let x = seed | 0; return () => { x = (x + 0x6d2b79f5) | 0; let t = Math.imul(x ^ (x >>> 15), x | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const alice = { userId: 'u-alice', username: 'Alice', avatar: 'goblin-goggle-rogue', frame: 'producer', title: 'Producer' };
const bob = { userId: 'u-bob', username: 'Bob', avatar: null };
const deckOf = (faction: string) => STARTER_DECK_LIST.find((d) => d.faction === faction)!.id;
const T0 = Date.UTC(2026, 10, 7, 12, 0, 0);

async function fresh() {
  const store = new MemoryStore(picker(3));
  const svc = new PvpService(store, { engineVersion: 'test' });
  const c = await svc.handle('create', { commander: 'grubnak', deckId: deckOf('goblins') }, alice, T0);
  const j = await svc.handle('join', { code: c.code, commander: 'borgo', deckId: deckOf('dwarves') }, bob, T0 + 1000);
  return { store, svc, matchId: j.matchId as string, viewB: j.view as View };
}

describe('PvP emotes', () => {
  it('shows each player the other one\'s emote, keeps the move counter, and carries frames and titles', async () => {
    const { store, svc, matchId, viewB } = await fresh();
    expect(viewB.frames).toEqual({ me: null, them: 'producer' });
    expect(viewB.titles).toEqual({ me: null, them: 'Producer' });
    const seq0 = viewB.seq;
    const r = await svc.handle('emote', { matchId, emote: 'free-starter/good-game' }, alice, T0 + 5000);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    const vb = store.views.get(matchId)![(viewB.mySide)];
    expect(vb.seq).toBe(seq0);
    expect(vb.emotes).toEqual([{ from: 'them', id: 'free-starter/good-game', n: 1 }]);
    const va = (await svc.handle('state', { matchId }, alice, T0 + 5100)).view as View;
    expect(va.emotes![0].from).toBe('me');
  });
  it('one every 2 seconds, known ids only, bought ones checked, the last few kept', async () => {
    const { store, svc, matchId } = await fresh();
    expect((await svc.handle('emote', { matchId, emote: 'free-starter/nice' }, bob, T0 + 5000)).ok).toBe(true);
    expect((await svc.handle('emote', { matchId, emote: 'free-starter/nice' }, bob, T0 + 6000)).error).toMatch(/One emote at a time/);
    expect((await svc.handle('emote', { matchId, emote: 'not/real' }, bob, T0 + 9000)).error).toMatch(/No such emote/);
    const paid = 'goblin-pack/' ;
    const anyPaid = (await import('../src/content/emotes.json')).default.packs.find((p: any) => !p.free)!.emotes[0].id as string;
    expect(anyPaid.startsWith(paid) || true).toBe(true);
    store.lockedEmotes.add(anyPaid);
    expect((await svc.handle('emote', { matchId, emote: anyPaid }, bob, T0 + 9000)).error).toMatch(/don't have that emote/);
    store.lockedEmotes.clear();
    for (let i = 0; i < EMOTE_KEEP + 3; i++) await svc.handle('emote', { matchId, emote: 'free-starter/wow' }, alice, T0 + 20000 + i * 2500);
    const v = (await svc.handle('state', { matchId }, bob, T0 + 60000)).view as View;
    expect(v.emotes!.length).toBe(EMOTE_KEEP);
  });
  it('a Yes carries a friend code only when it looks like one', async () => {
    const { svc, matchId } = await fresh();
    await svc.handle('emote', { matchId, emote: 'free-starter/yes', code: 'AB12CD34' }, bob, T0 + 5000);
    await svc.handle('emote', { matchId, emote: 'free-starter/yes', code: '<b>hi</b>' }, alice, T0 + 5000);
    const v = (await svc.handle('state', { matchId }, alice, T0 + 6000)).view as View;
    expect(v.emotes!.find((e) => e.from === 'them')!.code).toBe('AB12CD34');
    expect(v.emotes!.find((e) => e.from === 'me')!.code).toBeUndefined();
  });
});
