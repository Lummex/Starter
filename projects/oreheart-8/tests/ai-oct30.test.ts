// Computer opponent upgrade (Ken, Oct 30: "medium and hard need to be adjusted ... hard needs to be pretty hard").
// Oct 31 (AI desk): Hard plays out the player's reply turn; Medium and Easy stay step-for-step the same (goldens below).
import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions, creatureAt } from '../src/engine';
import { aiChoose, makeRand, evaluate, replyValue, TUNE } from '../src/ai/ai';
import { CARDS, isMiner } from '../src/engine';
import { scenario, rushBot, mineBot, MINES as SC_MINES, HOME } from '../tools/ai-sim/scenarios';

const act = (s: any, a: any) => { const r = applyAction(s, a); if (!r.ok) throw new Error(r.error); return r.state; };
const P = (cardId: string, row: number, col: number, extra: any = {}) => ({ cardId, owner: 'player', row, col, ...extra });
const O = (cardId: string, row: number, col: number, extra: any = {}) => ({ cardId, owner: 'opponent', row, col, ...extra });
const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const deploy = (setup: any, first = 'player') => createMatch({ playerCommander: 'grubnak', opponentCommander: 'borgo', mines: MINES, firstPlayer: first, setup });
const action = (setup: any) => act(deploy(setup), { type: 'done' });

describe('AI Oct 30: Hard and Medium', () => {
  it('stacks Venom Shiv on an enemy that is already poisoned', () => {
    // (Hard only: Medium deliberately takes its second-best option now and then)
    const s = deploy({ playerHand: ['venom-shiv'], playerCrystals: 5, board: [P('goblin-grunt', 7, 6), O('queen-brunhilda-stonebeard', 2, 8, { poison: 5, poisonStacks: 1 })] });
    const a = aiChoose(s, 'hard', makeRand(1));
    expect(a.type).toBe('cast');
    expect(a.target).toEqual({ row: 2, col: 8 });
  });

  it('finishes off a wounded enemy instead of scratching a healthy one', () => {
    // a Slinger (ranged, no strike back) can shoot the Stoneback on 1 Health or the healthy one (Oct 31: was a Grunt in melee, where the
    // reply-turn search rightly saw that the kill cost the Grunt its life next turn and dodged instead)
    const s = action({ board: [P('goblin-slinger', 5, 9), O('dwarf-stoneback', 3, 7, { damage: 3 }), O('dwarf-stoneback', 3, 9)] });
    const a = aiChoose(s, 'hard', makeRand(2));
    expect(a.type).toBe('attack');
    expect(a.target).toEqual({ row: 3, col: 7 });
  });

  it('Hard looks one action ahead: uses Thunderhorn Blast when the +1 turns two hits into two kills', () => {
    const s = act(createMatch({ playerCommander: 'borgo', opponentCommander: 'grubnak', mines: MINES, firstPlayer: 'player', setup: { playerHand: ['battle-cry'], playerCrystals: 5,
      board: [P('rune-splitter', 4, 3), P('rune-splitter', 4, 9), O('goblin-grunt', 3, 3), O('goblin-grunt', 3, 9)] } }), { type: 'done' });
    // each Door Splitter hits for 3 +1 type advantage (dwarves beat goblins) = 4; the Grunts get 5 Health, so only the Blast's +1 makes a kill
    s.board.creatures.filter((c: any) => c.owner === 'opponent').forEach((c: any) => { c.maxHealth = 5; c.health = 5; });
    // play Hard's whole Action phase (order is its choice: Charge units may step first): it casts the Blast and both Grunts fall
    let st: any = s, cast = false;
    const r = makeRand(6);
    for (let i = 0; i < 30 && st.phase === 'action' && st.activePlayer === 'player'; i++) {
      const a = st.pendingResponse && st.priority !== 'player' ? { type: 'pass' } : aiChoose(st, 'hard', r);
      if (a.type === 'cast') cast = true;
      if (a.type === 'done') break;
      st = act(st, a);
    }
    expect(cast).toBe(true);
    expect(st.board.creatures.filter((c: any) => c.owner === 'opponent').length).toBe(0);
  });

  it('takes a lethal hit on the enemy Commander', () => {
    const s = action({ opponentHealth: 2, board: [P('goblin-grunt', 2, 11), O('dwarf-stoneback', 3, 7)] });
    for (const diff of ['hard', 'normal']) expect(aiChoose(s, diff, makeRand(3)).target).toEqual({ commander: 'opponent' });
  });

  it('marches forward off the home row instead of sliding along it', () => {
    const s = action({ board: [P('goblin-grunt', 7, 5), O('dwarf-stoneback', 1, 9)] });
    const a = aiChoose(s, 'hard', makeRand(4));
    expect(a.type).toBe('move');
    expect(a.row).toBe(6);
  });

  it('spends Ironclad Bulwark to save a unit from a lethal hit, but not on a scratch', () => {
    // the opponent (Thane Borgo, dwarves) attacks; the player holds a Bulwark
    const mk = (attacker: string) => {
      let s = createMatch({ playerCommander: 'borgo', opponentCommander: 'borgo', mines: MINES, firstPlayer: 'opponent', setup: { playerHand: ['shield-bubble'], playerCrystals: 5, board: [P('dwarf-stoneback', 4, 4), O(attacker, 3, 4), O('dwarf-stoneback', 1, 9)] } });
      s = act(s, { type: 'done' });
      const atk = legalActions(s).find((a: any) => a.type === 'attack' && a.target.row === 4 && a.target.col === 4);
      s = act(s, atk);
      expect(s.pendingResponse && s.priority).toBe('player');
      return aiChoose(s, 'hard', makeRand(5));
    };
    expect(mk('ram-rider').type).toBe('respond'); // 4 Attack kills a 1/3 (+1 Health from Borgo = 4)
    expect(mk('dwarf-pickman').type).toBe('pass'); // 1 Attack is a scratch that heals next turn
  });

  it('evaluate() prefers owning more mines and a healthier Commander', () => {
    const s = deploy({ board: [P('goblin-grunt', 7, 6)] });
    const hurt = deploy({ playerHealth: 10, board: [P('goblin-grunt', 7, 6)] });
    expect(evaluate(s, 'player')).toBeGreaterThan(evaluate(hurt, 'player'));
  });

  it('decides quickly in a busy mid-game (phones need headroom)', () => {
    let s: any = createMatch({ seed: 44, skipMulligan: true, testMode: true });
    const r = makeRand(9);
    let ms = 0, n = 0, guard = 0, count = 0, turn = -1;
    while (s.phase !== 'over' && s.turn < 18 && guard++ < 4000) {
      if (s.turn !== turn) { turn = s.turn; count = 0; }
      const t0 = performance.now();
      let a = aiChoose(s, 'hard', r);
      if (s.turn >= 10) { ms += performance.now() - t0; n++; }
      if (++count > 60 && !s.pendingResponse) a = { type: 'done' };
      let x: any = applyAction(s, a);
      if (!x.ok) x = applyAction(s, s.pendingResponse ? { type: 'pass' } : { type: 'done' });
      s = x.state;
    }
    expect(n).toBeGreaterThan(10);
    expect(ms / n).toBeLessThan(200);
  });

  it('Medium and Hard play a full match against each other to a winner', () => {
    let s: any = createMatch({ seed: 77, skipMulligan: true, testMode: true });
    const r = makeRand(77);
    let guard = 0, count = 0, turn = -1;
    while (s.phase !== 'over' && s.turn < 150 && guard++ < 20000) {
      if (s.turn !== turn) { turn = s.turn; count = 0; }
      let a = aiChoose(s, s.priority === 'player' ? 'hard' : 'normal', r);
      if (++count > 60 && !s.pendingResponse) a = { type: 'done' };
      let x: any = applyAction(s, a);
      if (!x.ok) x = applyAction(s, s.pendingResponse ? { type: 'pass' } : { type: 'done' });
      s = x.state;
    }
    expect(s.winner).toBeTruthy();
  });
});

describe("AI Oct 31: Hard plays out the player's reply turn", () => {
  const HP = () => ({ threatW: TUNE.hardThreat, goalW: 1, turnW: TUNE.hardTurn, fwdW: TUNE.hardFwd });
  it('the reply value sees a Rocket unit jumping next to its Commander (the static threat check cannot)', () => {
    // same board, except one enemy is a Shard Guzzler (Rocket: jump anywhere, blast, then hit) instead of a plain Grunt
    const mk = (enemy: string) => action({ board: [P('goblin-scrounger', 6, 5, { minedMine: MINES[2] }), P('goblin-grunt', 6, 8), O(enemy, 2, 10), O('goblin-grunt', 2, 8)] }, 'player');
    const plain = replyValue(mk('goblin-grunt'), 'player', HP(), makeRand(1), performance.now() + 2000);
    const rocket = replyValue(mk('shard-guzzler'), 'player', HP(), makeRand(1), performance.now() + 2000);
    expect(plain - rocket).toBeGreaterThan(20);
  });
  it('Hard still decides within budget with the reply search on (worst single decision, busy board)', () => {
    let s: any = createMatch({ seed: 45, skipMulligan: true, testMode: true });
    const r = makeRand(5);
    let worst = 0, guard = 0, count = 0, turn = -1;
    while (s.phase !== 'over' && s.turn < 16 && guard++ < 3000) {
      if (s.turn !== turn) { turn = s.turn; count = 0; }
      const t0 = performance.now();
      let a = aiChoose(s, 'hard', r);
      worst = Math.max(worst, performance.now() - t0);
      if (++count > 60 && !s.pendingResponse) a = { type: 'done' };
      let x: any = applyAction(s, a);
      if (!x.ok) x = applyAction(s, s.pendingResponse ? { type: 'pass' } : { type: 'done' });
      s = x.state;
    }
    expect(worst).toBeLessThan(1500);
  });

  // Ken (Oct 31): a slow phone must never stall a turn. Hard's thinking per turn is pooled (TUNE.hardTurnMs): once the pool is spent, the
  // rest of the turn decides lean, so even a 25-action late-game turn stays under about 2 s of thinking (on a phone the budgets shrink too).
  const turnMs = (seed: number, scale: number, maxTurn: number) => {
    (globalThis as any).__aiTimeScale = scale;
    try {
      let s: any = createMatch({ seed, skipMulligan: true, testMode: true });
      const r = makeRand(5);
      const perTurn = new Map<string, number>();
      let guard = 0, count = 0, turn = -1, lean = 0;
      while (s.phase !== 'over' && s.turn < maxTurn && guard++ < 4000) {
        if (s.turn !== turn) { turn = s.turn; count = 0; }
        const t0 = performance.now();
        let a = aiChoose(s, 'hard', r);
        const k = s.turn + ':' + s.priority;
        perTurn.set(k, (perTurn.get(k) || 0) + performance.now() - t0);
        if (++count > 60 && !s.pendingResponse) a = { type: 'done' };
        let x: any = applyAction(s, a);
        if (!x.ok) x = applyAction(s, s.pendingResponse ? { type: 'pass' } : { type: 'done' });
        s = x.state;
        lean = Math.max(lean, (globalThis as any).__aiTurnMs.lean);
      }
      return { worst: Math.max(...perTurn.values()), turns: perTurn.size, lean };
    } finally { delete (globalThis as any).__aiTimeScale; }
  };
  it("Hard's whole turn of thinking stays under 2 s, PC budgets", () => {
    const r = turnMs(45, 1, 22);
    expect(r.turns).toBeGreaterThan(10);
    expect(r.worst).toBeLessThan(2000);
  });
  it("Hard's whole turn of thinking stays under 1.3 s with phone budgets (the pool, not the clock, bounds it)", () => {
    const r = turnMs(44, 0.6, 22);
    expect(r.turns).toBeGreaterThan(10);
    expect(r.worst).toBeLessThan(1300);
  });
  it('the pool is per turn: a fresh turn thinks fully again', () => {
    let s: any = createMatch({ seed: 45, skipMulligan: true, testMode: true });
    const r = makeRand(5);
    const pool = (globalThis as any).__aiTurnMs;
    let guard = 0, seen = 0, lastKey = '';
    while (s.phase !== 'over' && s.turn < 8 && guard++ < 800) {
      let a = aiChoose(s, 'hard', r);
      if (s.priority === 'opponent' || s.priority === 'player') { if (pool.key !== lastKey) { lastKey = pool.key; seen++; expect(pool.ms).toBeLessThan(1500); } }
      let x: any = applyAction(s, a);
      if (!x.ok) x = applyAction(s, s.pendingResponse ? { type: 'pass' } : { type: 'done' });
      s = x.state;
    }
    expect(seen).toBeGreaterThan(3);
  });
});

describe('AI Oct 31: Medium is unchanged', () => {
  // recorded on branch ai-oct30b (f3518716) with the decision time budget switched off (the budget makes Medium timing-dependent under load)
  const GOLDEN: Record<number, { turn: number; units: number; steps: number }> = { 21: { turn: 27, units: 31, steps: 246 }, 23: { turn: 26, units: 18, steps: 206 }, 25: { turn: 27, units: 18, steps: 302 } };
  for (const seed of [21, 23, 25]) {
    it('medium vs medium, seed ' + seed, () => {
      const keep = { medMs: TUNE.medMs, hardMs: TUNE.hardMs };
      TUNE.medMs = 1e9; TUNE.hardMs = 1e9;
      try {
        let s: any = createMatch({ seed, playerCommander: ['grubnak', 'sproingle', 'borgo'][seed % 3], opponentCommander: ['borgo', 'grubnak', 'sproingle'][seed % 3], testMode: true });
        const rand = makeRand(seed);
        let g = 0, n = 0, turn = -1;
        while (s.phase !== 'over' && s.turn < 40 && g++ < 30000) {
          if (s.turn !== turn) { turn = s.turn; n = 0; }
          let a = aiChoose(s, 'normal', rand);
          if (++n > 60 && !s.pendingResponse && s.phase !== 'mulligan') a = { type: 'done' };
          let r: any = applyAction(s, a);
          if (!r.ok) r = applyAction(s, s.pendingResponse ? { type: 'pass' } : s.phase === 'mulligan' ? { type: 'mulligan', uids: [] } : { type: 'done' });
          s = r.state;
        }
        expect({ turn: s.turn, units: s.board.creatures.length, steps: g }).toEqual(GOLDEN[seed]);
      } finally { Object.assign(TUNE, keep); }
    });
  }
});

describe('AI Oct 30: Easy is unchanged', () => {
  // recorded with the AI before this upgrade (factory/issue-8 858b9550, 60-card decks): the same seeds must play out step for step the same
  const GOLDEN: Record<number, { turn: number; units: number; steps: number }> = { 11: { turn: 80, units: 11, steps: 295 }, 12: { turn: 80, units: 16, steps: 445 }, 13: { turn: 80, units: 23, steps: 427 } };
  for (const seed of [11, 12, 13]) {
    it('easy vs easy, seed ' + seed, () => {
      let s: any = createMatch({ seed, playerCommander: ['grubnak', 'sproingle', 'borgo'][seed % 3], opponentCommander: ['borgo', 'grubnak', 'sproingle'][seed % 3] });
      const rand = makeRand(seed);
      let g = 0, n = 0, turn = -1;
      while (s.phase !== 'over' && s.turn < 80 && g++ < 30000) {
        if (s.turn !== turn) { turn = s.turn; n = 0; }
        let a = aiChoose(s, 'easy', rand);
        if (++n > 60 && !s.pendingResponse && s.phase !== 'mulligan') a = { type: 'done' };
        let r: any = applyAction(s, a);
        if (!r.ok) r = applyAction(s, s.pendingResponse ? { type: 'pass' } : s.phase === 'mulligan' ? { type: 'mulligan', uids: [] } : { type: 'done' });
        s = r.state;
      }
      expect({ turn: s.turn, units: s.board.creatures.length, steps: g }).toEqual(GOLDEN[seed]);
    });
  }
});
void creatureAt;

// Ken, Oct 30: "I want the harder AI to actually react to what I'm doing too."
const ch = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
/** Plays Hard ('player') against a scripted enemy; returns the AI turn (1, 2, ...) of its first hit on the threat, or null. */
function reaction(kind: 'rush' | 'mines', seed: number, turns = 8) {
  let s: any = scenario(kind, seed);
  const r = makeRand(seed), bot = kind === 'rush' ? rushBot : mineBot;
  const threat = (st: any) => st.board.creatures.filter((c: any) => c.owner === 'opponent' && (kind === 'rush' ? !isMiner(CARDS[c.cardId]) && ch(c, HOME) <= 4 : isMiner(CARDS[c.cardId]) && SC_MINES.some((m) => ch(c, m) <= 1))).length;
  const start = threat(s);
  let n = 0, turn = -1, first: number | null = null;
  for (let g = 0; g < 3000 && s.phase !== 'over' && s.turn <= turns; g++) {
    if (s.turn !== turn) { turn = s.turn; n = 0; }
    let a = s.priority === 'player' ? aiChoose(s, 'hard', r) : bot(s);
    if (++n > 60 && !s.pendingResponse) a = { type: 'done' };
    let x: any = applyAction(s, a);
    if (!x.ok) x = applyAction(s, s.pendingResponse ? { type: 'pass' } : { type: 'done' });
    s = x.state;
    if (first == null && s.activePlayer === 'player' && threat(s) < start) first = Math.ceil(s.turn / 2);
  }
  return { first, lost: s.winner === 'opponent' };
}
describe('AI Oct 30: Hard reacts to the player', () => {
  it('a Commander rush: it turns back and hits the attackers (most cases) and never loses', () => {
    const res = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => reaction('rush', seed));
    expect(res.filter((x) => x.lost).length).toBe(0);
    expect(res.filter((x) => x.first != null).length).toBeGreaterThanOrEqual(4);
  });
  it('mine domination: it knocks enemy Miners off the mines within its first three turns', () => {
    const res = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => reaction('mines', seed));
    expect(res.filter((x) => x.first != null && x.first <= 3).length).toBeGreaterThanOrEqual(7);
  });
});
