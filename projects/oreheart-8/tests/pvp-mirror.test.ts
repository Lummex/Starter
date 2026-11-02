import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions, CONFIG } from '../src/engine';
import { mirror, mirrorRow, mirrorCol } from '../src/engine/mirror';
import { viewFor, eventsFor, presentFor, realAction } from '../src/engine/view';

const canon = (a: any) => JSON.stringify(Object.keys(a).sort().reduce((o: any, k) => (o[k] = a[k], o), {}));
const canonSet = (list: any[]) => list.map(canon).sort();
// a small seeded picker for the playouts (the dice themselves are seeded by tests/setup-dice.ts)
function picker(seed: number) { let x = seed | 0; return () => { x = (x + 0x6d2b79f5) | 0; let t = Math.imul(x ^ (x >>> 15), x | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

describe('mirror (PvP board for the second player)', () => {
  it('reflects the strongholds onto each other and is its own inverse', () => {
    const [pr, pc] = CONFIG.strongholds.player, [or, oc] = CONFIG.strongholds.opponent;
    expect([mirrorRow(pr), mirrorCol(pc)]).toEqual([or, oc]);
    expect(mirrorRow(CONFIG.backRow.player)).toBe(CONFIG.backRow.opponent);
    expect(mirrorRow(CONFIG.frontRow.player)).toBe(CONFIG.frontRow.opponent);
    const s = createMatch({ seed: 5, pvp: true, playerCommander: 'grubnak', opponentCommander: 'borgo' });
    const m = mirror(s);
    expect(m.players.player.commanderId).toBe('borgo');
    expect(m.strongholds.player).toEqual(s.strongholds.player);
    expect(m.sites.map((x: any) => [x.row, x.col])).toEqual(s.sites.map((x: any) => [mirrorRow(x.row), mirrorCol(x.col)]));
    expect(mirror(m)).toEqual(s);
    expect(mirror({ type: 'ability', ability: 'slide', dr: 1, dc: -1, creatureUid: 'c1' })).toEqual({ type: 'ability', ability: 'slide', dr: -1, dc: 1, creatureUid: 'c1' });
    expect(mirror({ facing: 'NE', owner: 'player', target: { commander: 'opponent' } })).toEqual({ facing: 'SW', owner: 'opponent', target: { commander: 'player' } });
  });

  it('gives the mirrored board exactly the mirrored legal actions, all through random matches', () => {
    let states = 0, checked = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const rnd = picker(seed * 131);
      let s = createMatch({ seed, pvp: true, playerCommander: ['grubnak', 'sproingle', 'borgo'][seed % 3], opponentCommander: ['borgo', 'grubnak', 'sproingle'][seed % 3] });
      for (let n = 0; n < 160 && s.phase !== 'over'; n++) {
        const legal = legalActions(s).filter((a: any) => a.type !== 'surrender');
        const mirrored = legalActions(mirror(s)).filter((a: any) => a.type !== 'surrender');
        expect(canonSet(mirrored), `seed ${seed} step ${n} (${s.phase}, ${s.priority})`).toEqual(canonSet(mirror(legal)));
        states++; checked += legal.length;
        if (!legal.length) break;
        // play something other than Done when we can, so boards fill up
        const busy = legal.filter((a: any) => a.type !== 'done' && a.type !== 'pass');
        const a = busy.length && rnd() < 0.8 ? busy[Math.floor(rnd() * busy.length)] : legal[Math.floor(rnd() * legal.length)];
        // the mirrored action applied to the mirrored board gives the mirrored board (same seeded dice on both)
        const r = applyAction(s, a);
        expect(r.ok, `seed ${seed} step ${n}: ${JSON.stringify(a)} ${r.error}`).toBe(true);
        // (the mulligan ORDER is the one side-specific rule: 'player' keeps first, then 'opponent', so that phase is only compared by legal actions above)
        if (s.phase !== 'mulligan') {
          const rm = applyAction(mirror(s), mirror(a));
          expect(rm.ok).toBe(true);
          expect(mirror(rm.state)).toEqual(r.state);
          expect(canonSet(mirror(rm.events))).toEqual(canonSet(r.events)); // same events; a payout over several miners may list them in another order
        }
        s = r.state;
      }
    }
    expect(states).toBeGreaterThan(1500);
    expect(checked).toBeGreaterThan(10000);
  });
});

describe('viewFor / presentFor (hidden information)', () => {
  it('hides the other hand, both decks and the generator, and keeps my hand', () => {
    const s = createMatch({ seed: 9, pvp: true });
    const v = viewFor(s, 'player');
    expect(v.players.player.hand).toEqual(s.players.player.hand);
    expect(v.players.opponent.hand.length).toBe(s.players.opponent.hand.length);
    expect(v.players.opponent.hand.every((h: any) => h.hidden && !h.cardId)).toBe(true);
    expect(v.players.player.deck.length).toBe(s.players.player.deck.length);
    expect(v.players.player.deck.every((h: any) => h.hidden && !h.cardId)).toBe(true);
    expect(v.players.opponent.deck.every((h: any) => h.hidden && !h.cardId)).toBe(true);
    expect(v.rng).toBe(0);
    const text = JSON.stringify(v);
    for (const h of s.players.opponent.hand) expect(text.includes(JSON.stringify(h.uid))).toBe(false);
    for (const h of s.players.player.deck) expect(text.includes(JSON.stringify(h.uid))).toBe(false);
    // the other side's draws are anonymous, mine are not
    const ev = eventsFor([{ type: 'draw', player: 'opponent', uid: 'x9', cardId: 'shiv-rat' }, { type: 'draw', player: 'player', uid: 'y1', cardId: 'shiv-rat' }], 'player');
    expect(ev[0]).toEqual({ type: 'draw', player: 'opponent', hidden: true });
    expect(ev[1].cardId).toBe('shiv-rat');
  });
  it('shows the second player the board as "player" and turns their actions back', () => {
    let s = createMatch({ seed: 3, pvp: true, playerCommander: 'grubnak', opponentCommander: 'sproingle', skipMulligan: true });
    const p = presentFor(s, [], 'opponent');
    expect(p.state.players.player.commanderId).toBe('sproingle');
    expect(p.state.players.player.hand.every((h: any) => h.cardId)).toBe(true);
    expect(p.state.players.opponent.hand.every((h: any) => h.hidden)).toBe(true);
    // every legal action on the mirrored view is accepted by the real state once turned back
    while (s.priority !== 'opponent' && s.phase !== 'over') { const r = applyAction(s, { type: 'done' }); if (!r.ok) break; s = r.state; }
    const view = presentFor(s, [], 'opponent').state;
    const legal = legalActions(view).filter((a: any) => a.type !== 'surrender');
    expect(legal.length).toBeGreaterThan(0);
    for (const a of legal.slice(0, 12)) expect(applyAction(s, realAction(a, 'opponent')).ok, JSON.stringify(a)).toBe(true);
  });
});

describe('pvp engine switches', () => {
  const setup = { playerHand: [], opponentHand: [], board: [{ owner: 'player', cardId: 'shiv-rat', row: 4, col: 5 }, { owner: 'opponent', cardId: 'shiv-rat', row: 4, col: 6 }], firstPlayer: 'player' };
  const attackWith = (pvp: boolean) => {
    let s = createMatch({ seed: 1, setup, mines: [{ row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 6 }], factionLock: false, pvp });
    s = applyAction(s, { type: 'done' }).state; // deploy -> action
    const atk = legalActions(s).find((a: any) => a.type === 'attack');
    expect(atk).toBeTruthy();
    return applyAction(s, atk);
  };
  it('always opens a Respond window in PvP, even with nothing to respond with', () => {
    const r = attackWith(true);
    expect(r.ok).toBe(true);
    expect(r.state.pendingResponse?.kind).toBe('attack');
    expect(r.state.priority).toBe('opponent');
    expect(legalActions(r.state).some((a: any) => a.type === 'pass')).toBe(true);
    const after = applyAction(r.state, { type: 'pass' });
    expect(after.ok).toBe(true);
    expect(after.state.pendingResponse).toBeNull();
    expect(after.events.length).toBeGreaterThan(0);
  });
  it('resolves at once offline (unchanged)', () => {
    const r = attackWith(false);
    expect(r.ok).toBe(true);
    expect(r.state.pendingResponse).toBeNull();
  });
  it("takes the second player's own deck list", () => {
    const deck = Array(30).fill('shiv-rat').concat(Array(30).fill('goblin-scrounger'));
    const s = createMatch({ seed: 2, pvp: true, opponentDeck: deck, playerDeck: deck });
    const all = [...s.players.opponent.deck, ...s.players.opponent.hand].map((c: any) => c.cardId);
    expect(all.length).toBe(60);
    expect(all.every((id) => id === 'shiv-rat' || id === 'goblin-scrounger')).toBe(true);
    expect(s.players.opponent.deckId).toBeNull();
  });
});
