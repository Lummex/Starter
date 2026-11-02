// The dice box (Nov 1; Ken: "a truly fresh roll, every time" and "a random deck shuffler that actually shuffles the deck").
import { describe, it, expect, afterEach } from 'vitest';
import { rollDie, randomIndex, randomFloat, shuffle, setDiceMode, getDiceMode, withDiceMode } from '../src/engine/dice';
import { nextRand, shuffle as rngShuffle } from '../src/engine/rng';
import { shuffle as indexShuffle, createMatch } from '../src/engine';
import { aiChoose, makeRand } from '../src/ai/ai';

afterEach(() => setDiceMode('seeded')); // the vitest setup default

describe('dice: live mode', () => {
  it('rolls fresh, fair dice that ignore the seed and leave it alone', () => {
    setDiceMode('live');
    const N = 20000;
    const run = (seed: number) => {
      const s = { rng: seed };
      const seq: number[] = [], count = [0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < N; i++) { const r = rollDie(s); seq.push(r); count[r]++; }
      expect(s.rng).toBe(seed); // a live roll never touches the match seed
      return { seq, count };
    };
    const a = run(1), b = run(2), c = run(1);
    expect(a.seq).not.toEqual(b.seq);
    expect(a.seq).not.toEqual(c.seq); // same seed, still a different (fresh) sequence
    for (const r of [a, b]) {
      expect(r.seq.every((x) => Number.isInteger(x) && x >= 1 && x <= 6)).toBe(true);
      for (let f = 1; f <= 6; f++) expect(Math.abs(r.count[f] / N - 1 / 6)).toBeLessThan(0.02);
    }
  });
  it('randomIndex, randomFloat and other die sizes stay in range', () => {
    setDiceMode('live');
    const s = { rng: 5 };
    for (let i = 0; i < 2000; i++) {
      const k = randomIndex(s, 7); expect(k >= 0 && k < 7 && Number.isInteger(k)).toBe(true);
      const f = randomFloat(s); expect(f >= 0 && f < 1).toBe(true);
      const d = rollDie(s, 20); expect(d >= 1 && d <= 20).toBe(true);
    }
    expect(s.rng).toBe(5);
  });
  it('shuffles a 60-card deck freshly every time, every card equally likely on top', () => {
    setDiceMode('live');
    const deck = () => Array.from({ length: 60 }, (_, i) => i);
    const s = { rng: 9 };
    const x = shuffle(s, deck()), y = shuffle(s, deck());
    expect(x).not.toEqual(y);
    expect([...x].sort((p, q) => p - q)).toEqual(deck());
    // 20,000 shuffles: each card should start on top 1/60 of the time; +-40% is then about 7 standard deviations, so this never flakes
    const N = 20000, top = new Array(60).fill(0);
    for (let i = 0; i < N; i++) top[shuffle(s, deck())[0]]++;
    const exp = N / 60;
    for (let k = 0; k < 60; k++) { expect(top[k]).toBeGreaterThan(exp * 0.6); expect(top[k]).toBeLessThan(exp * 1.4); }
    expect(s.rng).toBe(9);
  });
  it('the old shuffle imports (rng.ts, engine index) go through the dice box', () => {
    expect(rngShuffle).toBe(shuffle);
    expect(indexShuffle).toBe(shuffle);
  });
});

describe('dice: seeded mode', () => {
  it('same seed, same rolls, bit for bit the old nextRand formula', () => {
    setDiceMode('seeded');
    const a = { rng: 1234 }, b = { rng: 1234 }, ref = { rng: 1234 };
    for (let i = 0; i < 500; i++) {
      const r = rollDie(a);
      expect(r).toBe(1 + Math.floor(nextRand(ref) * 6));
      expect(rollDie(b)).toBe(r);
    }
    expect(a.rng).toBe(ref.rng);
    const f = { rng: 77 }, fr = { rng: 77 };
    expect(randomFloat(f)).toBe(nextRand(fr));
    expect(randomIndex(f, 13)).toBe(Math.floor(nextRand(fr) * 13));
  });
  it('seeded shuffles match the old Fisher-Yates exactly', () => {
    setDiceMode('seeded');
    const old = (s: { rng: number }, arr: number[]) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(nextRand(s) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
    const d = () => Array.from({ length: 60 }, (_, i) => i);
    expect(shuffle({ rng: 42 }, d())).toEqual(old({ rng: 42 }, d()));
  });
});

describe('dice: withDiceMode', () => {
  it('restores the previous mode, also when the work throws', () => {
    setDiceMode('live');
    expect(withDiceMode('seeded', () => getDiceMode())).toBe('seeded');
    expect(getDiceMode()).toBe('live');
    expect(() => withDiceMode('seeded', () => { throw new Error('boom'); })).toThrow('boom');
    expect(getDiceMode()).toBe('live');
    setDiceMode('seeded');
    withDiceMode('live', () => withDiceMode('seeded', () => 0));
    expect(getDiceMode()).toBe('seeded');
  });
  it('the computer thinks with seeded dice even in a live match', () => {
    setDiceMode('live');
    const s: any = createMatch({ seed: 3, testMode: true });
    let seen: string | null = null;
    const g: any = globalThis.crypto, orig = g.getRandomValues.bind(g);
    let calls = 0;
    g.getRandomValues = (a: any) => { calls++; return orig(a); };
    try {
      const st = JSON.parse(JSON.stringify(s));
      aiChoose(st, 'hard', makeRand(1));
      seen = getDiceMode();
    } finally { g.getRandomValues = orig; }
    expect(seen).toBe('live');
    expect(calls).toBe(0); // no live dice were drawn while the computer thought
  }, 30000);
});
