import { describe, it, expect } from 'vitest';
import cards from '../src/content/cards.json';
import { CARDS, CONFIG } from '../src/engine';
import { formulaCost, cardCost, cardFeet, abilityBonus } from '../src/engine/cost';

const mk = (attack: number, health: number, abilities: string[] = [], extra: any = {}) => ({ type: 'creature', role: 'Fighter', attack, health, abilities, ...extra });

describe('Ken, Nov 1: a creature\'s cost and feet come from its stats', () => {
  it('the numbers stored in cards.json equal the formula (tools/gen-costs.py keeps them in step; this fails on drift)', () => {
    for (const c of cards as any[]) if (c.type === 'creature') { expect(c.cost, c.id).toBe(cardCost(c)); expect(c.move, c.id).toBe(cardFeet(c)); }
  });
  it('cost = (Attack + Health + bonus) / 2 rounded up; 5 + 2 per point above 10; cap 12; min 1', () => {
    expect(formulaCost(mk(1, 1))).toBe(1);
    expect(formulaCost(mk(2, 3))).toBe(3);
    expect(formulaCost(mk(3, 4, ['guard']))).toBe(4);
    expect(formulaCost(mk(5, 6, ['unbreakable']))).toBe(11); // B = 13 -> 5 + 2 x 3
    expect(formulaCost(mk(9, 9, ['flying']))).toBe(12); // capped
    expect(formulaCost(mk(0, 0))).toBe(1);
  });
  it('ability bonus: +2 big, +1 small, 0 for Miner abilities, only the biggest counts', () => {
    expect(abilityBonus(mk(1, 1, ['gather', 'tunnel']))).toBe(0);
    expect(abilityBonus(mk(1, 1, ['ranged']))).toBe(1);
    expect(abilityBonus(mk(1, 1, ['ranged', 'charge']))).toBe(2);
    expect(abilityBonus(mk(1, 1, ['guard', 'assist']))).toBe(1);
  });
  it('a hand-set costOverride wins over the formula, and never changes the feet', () => {
    expect(cardCost(mk(2, 3, [], { costOverride: 9 }))).toBe(9);
    expect(cardFeet(mk(2, 3, [], { costOverride: 9 }))).toBe(3);
    expect(cardCost(mk(2, 3, [], { costOverride: null }))).toBe(3);
  });
  it('feet: cost 1-3 walks 3, 4-6 walks 4, 7+ walks 5; every Miner walks 1; walls walk CONFIG.wallMove; nothing over 5', () => {
    for (const c of Object.values<any>(CARDS)) if (c.type === 'creature') {
      const miner = c.role === 'Gatherer' || c.role === 'Smith', f = formulaCost(c);
      expect(c.move, c.id).toBe(miner ? 1 : c.wall ? CONFIG.wallMove : f <= 3 ? 3 : f <= 6 ? 4 : 5);
      expect(c.move).toBeLessThanOrEqual(5);
      expect(c.cost).toBeGreaterThanOrEqual(1); expect(c.cost).toBeLessThanOrEqual(12);
    }
    expect(CONFIG.wallMove).toBe(2);
  });
  it('the four walls are 1 Attack, 6 Health, walk 2 and cost 4 (Ken, Nov 1: "all walls 1 six")', () => {
    for (const id of ['dwarf-miner', 'shieldbeard', 'gearward-sentinel', 'dwarf-pickman']) {
      const c = CARDS[id];
      expect([c.attack, c.health, c.move, c.cost, !!c.wall], id).toEqual([1, 6, 2, 4, true]);
    }
  });
});
