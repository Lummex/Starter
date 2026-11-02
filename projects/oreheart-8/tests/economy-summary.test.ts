// Daily quests: the match summary the browser reports (contract 4.3) and the server's per-report caps.
import { describe, it, expect } from 'vitest';
import { summarize, capSummary, QUEST_CAPS } from '../src/net/quest-summary';
import { CARDS, createMatch, applyAction, legalActions } from '../src/engine';

const ids = Object.keys(CARDS);
const find = (f: (c: any) => boolean) => ids.find((id) => f((CARDS as any)[id]))!;
const goblinMiner = find((c) => c.faction === 'goblins' && c.type === 'creature' && (c.role === 'Gatherer'));
const gnomeFighter = find((c) => c.faction === 'gnomes' && c.type === 'creature' && c.role !== 'Gatherer' && c.role !== 'Smith');
const dwarfFighter = find((c) => c.faction === 'dwarves' && c.type === 'creature' && c.role !== 'Gatherer' && c.role !== 'Smith');
const big = find((c) => (c.type === 'creature' || c.type === 'spell') && c.cost >= 7);
const spell = find((c) => c.type === 'spell' && c.faction === 'gnomes');

const st = (over: any = {}) => ({ turn: 9, winner: 'player', players: { player: { commanderId: 'grubnak', hand: [], deck: [], discard: [] }, opponent: { commanderId: 'borgo', hand: [], deck: [], discard: [] } }, board: { creatures: [] }, ...over });

describe('summarize', () => {
  const ev = [
    { type: 'turnStart', player: 'player', turn: 1 },
    { type: 'summon', uid: 'p1', cardId: goblinMiner, owner: 'player', row: 6, col: 2 },
    { type: 'summon', uid: 'p2', cardId: gnomeFighter, owner: 'player', row: 6, col: 3 },
    { type: 'summon', uid: 'p3', cardId: gnomeFighter, owner: 'player', row: 6, col: 4, illusion: true },
    { type: 'cast', player: 'player', cardId: spell },
    { type: 'summon', uid: 'p4', cardId: big, owner: 'player', row: 6, col: 5 },
    { type: 'mine', uid: 'p1', row: 4, col: 2, amount: 1 },
    { type: 'turnStart', player: 'opponent', turn: 2 },
    { type: 'summon', uid: 'o1', cardId: dwarfFighter, owner: 'opponent', row: 0, col: 2 },
    { type: 'attack', uid: 'o1', target: { row: 6, col: 3 } },
    { type: 'swing', uid: 'o1', targetUid: 'p2', result: 'block' },
    { type: 'swing', uid: 'o1', targetUid: 'p2', result: 'hit' },
    { type: 'shieldBlock', uid: 'p2' },
    { type: 'damage', commander: 'player', amount: 2 },
    { type: 'turnStart', player: 'player', turn: 3 },
    { type: 'mine', uid: 'p1', row: 4, col: 2, amount: 1 },
    { type: 'attack', uid: 'p2', target: { row: 0, col: 2 } },
    { type: 'swing', uid: 'p2', targetUid: 'o1', result: 'hit' },
    { type: 'swing', uid: 'p2', targetUid: 'o1', result: 'hit' },
    { type: 'swing', uid: 'p2', targetUid: 'o1', result: 'miss' },
    { type: 'defeat', uid: 'o1', cardId: dwarfFighter, owner: 'opponent' },
    { type: 'swing', uid: 'p2', commander: 'opponent', result: 'block' },
    { type: 'swing', uid: 'p4', commander: 'opponent', result: 'hit' },
    { type: 'damage', commander: 'opponent', amount: 3 },
    { type: 'turnStart', player: 'opponent', turn: 4 },
    { type: 'defeat', uid: 'p2', cardId: gnomeFighter, owner: 'player' },
    { type: 'turnStart', player: 'player', turn: 5 },
    { type: 'mine', uid: 'p1', row: 4, col: 2, amount: 1 },
    { type: 'turnStart', player: 'opponent', turn: 6 },
    { type: 'turnStart', player: 'player', turn: 7 },
    { type: 'mine', uid: 'p1', row: 4, col: 6, amount: 1 },
  ];
  const s = summarize(ev, st());
  it('reads the match result', () => { expect(s.turns).toBe(9); expect(s.won).toBe(true); expect(s.wins).toBe(1); expect(s.battles).toBe(1); expect(s.commander).toBe('grubnak'); });
  it('counts my creatures, not illusions or the enemy', () => expect(s.creaturesPlayed).toBe(3));
  it('counts my cards by faction', () => {
    const f = (id: string) => (CARDS as any)[id].faction;
    const want = { goblins: 0, gnomes: 0, dwarves: 0 } as any;
    for (const id of [goblinMiner, gnomeFighter, spell, big]) if (want[f(id)] !== undefined) want[f(id)]++;
    expect(s.cardsByFaction).toEqual(want);
  });
  it('counts plays costing 7 or more', () => expect(s.cost7Plays).toBe(1 + ((CARDS as any)[spell].cost >= 7 ? 1 : 0) + ((CARDS as any)[gnomeFighter].cost >= 7 ? 1 : 0) + ((CARDS as any)[goblinMiner].cost >= 7 ? 1 : 0)));
  it('counts my hits only', () => expect(s.hitsLanded).toBe(3));
  it('counts blocks on my side (dice block + shield)', () => expect(s.hitsBlocked).toBe(2));
  it('counts enemy units I defeated, not my losses', () => expect(s.unitsDefeated).toBe(1));
  it('counts damage to the enemy Commander', () => expect(s.commanderDamage).toBe(3));
  it('counts my Miner mining and the longest hold of one mine', () => { expect(s.minerMines).toBe(4); expect(s.mineHoldTurns).toBe(3); });
  it('a loss counts no win', () => { const l = summarize(ev, st({ winner: 'opponent' })); expect(l.won).toBe(false); expect(l.wins).toBe(0); });
  it('works from the other side too', () => { const o = summarize(ev, st(), 'opponent'); expect(o.creaturesPlayed).toBe(1); expect(o.hitsLanded).toBe(1); expect(o.commanderDamage).toBe(2); expect(o.commander).toBe('borgo'); });
  it('survives junk', () => { const j = summarize([null, 5, { type: 'swing' }] as any, null); expect(j.turns).toBe(0); expect(j.won).toBe(false); });
});

describe('capSummary (the server caps, 4.3)', () => {
  const huge = summarize([], st({ turn: 999 }));
  Object.assign(huge, { creaturesPlayed: 999, cost7Plays: 999, hitsLanded: 999, hitsBlocked: 999, unitsDefeated: 999, commanderDamage: 999, mineHoldTurns: 999, minerMines: 999 });
  const c = capSummary(huge);
  it('caps every number', () => {
    expect(c.turns).toBe(QUEST_CAPS.turns); expect(c.creaturesPlayed).toBe(60); expect(c.cost7Plays).toBe(20); expect(c.hitsLanded).toBe(200);
    expect(c.hitsBlocked).toBe(100); expect(c.unitsDefeated).toBe(60); expect(c.commanderDamage).toBe(60); expect(c.mineHoldTurns).toBe(60); expect(c.minerMines).toBe(120);
  });
  it('a match under 3 turns counts nothing', () => {
    const s = capSummary({ ...huge, turns: 2 });
    expect(s.wins).toBe(0); expect(s.creaturesPlayed).toBe(0); expect(s.hitsLanded).toBe(0); expect(s.minerMines).toBe(0);
  });
  it('3 turns counts', () => expect(capSummary({ ...huge, turns: 3 }).creaturesPlayed).toBe(60));
});

describe('summarize on a real engine match', () => {
  it('matches the engine events of a played-out game', () => {
    let s: any = createMatch({ seed: 7, playerCommander: 'grubnak', opponentCommander: 'borgo' });
    const all: any[] = [];
    for (let i = 0; i < 400 && !s.winner; i++) {

      const acts = legalActions(s);
      if (!acts.length) break;
      const pick = acts.find((a: any) => a.type === 'attack') || acts.find((a: any) => a.type === 'summon') || acts.find((a: any) => a.type === 'mine') || acts.find((a: any) => a.type === 'endPhase' || a.type === 'pass') || acts[0];
      const r: any = applyAction(s, pick);
      if (!r.ok) break;
      s = r.state; all.push(...r.events);
    }
    const sum = summarize(all, s);
    const summons = all.filter((e) => e.type === 'summon' && e.owner === 'player' && !e.illusion).length;
    expect(sum.creaturesPlayed).toBe(summons);
    expect(sum.turns).toBe(s.turn);
    expect(s.turn).toBeGreaterThan(2);
    expect(summons).toBeGreaterThan(0);
    expect(sum.hitsLanded).toBeGreaterThanOrEqual(0);
  });
});
