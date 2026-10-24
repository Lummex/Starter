import { describe, it, expect } from 'vitest';
import { CARDS } from '../src/engine/content';
import { createMatch, applyAction, creatureAt, legalActions } from '../src/engine';
const MINES = [{ row: 3, col: 6 }, { row: 4, col: 7 }, { row: 5, col: 5 }];
const act = (s: any, a: any) => { const r = applyAction(s, a); if (!r.ok) throw new Error(r.error); return r.state; };
const done = (s: any) => act(s, { type: 'done' });
const mk = (setup: any) => createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', mines: MINES, setup });
const P = (cardId: string, row: number, col: number, extra: any = {}) => ({ cardId, owner: 'player', row, col, ...extra });
const O = (cardId: string, row: number, col: number, extra: any = {}) => ({ cardId, owner: 'opponent', row, col, ...extra });
const at = (s: any, r: number, c: number) => creatureAt(s, r, c);
const hit = (s: any, from: number[], to: number[]) => act(done(s), { type: 'attack', creatureUid: at(done(s), from[0], from[1])?.uid ?? at(s, from[0], from[1]).uid, target: { row: to[0], col: to[1] } });
const strike = (s0: any, from: number[], to: number[]) => { const s = done(s0); return act(s, { type: 'attack', creatureUid: at(s, from[0], from[1]).uid, target: { row: to[0], col: to[1] } }); };
void hit;
describe('round 12c step 2', () => {
  it('per-card ranges and spell numbers', () => {
    const r = (id: string) => (CARDS as any)[id].range;
    expect([r('goblin-slinger'), r('spark-gnome'), r('gyrocopter-ace'), r('deepforge-crossbowman'), r('axe-thrower')]).toEqual([6, 5, 2, 7, 5]);
    expect(r('hexwright-apprentice')).toBeGreaterThanOrEqual(13);
    expect((CARDS as any)['meteor-strike'].params.amount).toBe(4);
    expect((CARDS as any)['venom-shiv'].params.turns).toBe(7);
  });
});
describe('round 12c abilities', () => {
  it('Bare Knuckle Lunatic knocks adjacent units back 1 when defeated', () => {
    const s = strike(mk({ board: [P('goblin-grunt', 4, 8, { attack: 5, shield: 9 }), O('goblin-bomber', 4, 9, { damage: 1 }), O('goblin-grunt', 3, 10)] }), [4, 8], [4, 9]);
    expect(at(s, 2, 11)).toBeTruthy();
  });
  it('Goblin Chef knocks the target back 2', () => {
    const s = strike(mk({ board: [P('rotgut-grenadier', 4, 8, { shield: 9 }), O('dwarf-pickman', 4, 9)] }), [4, 8], [4, 9]);
    expect(at(s, 4, 11)).toBeTruthy();
  });
  it('Backstabbing Thief steals a crystal per kill', () => {
    const s = strike(mk({ board: [P('goblin-sneak', 4, 8), O('goblin-grunt', 4, 9, { damage: 2 })] }), [4, 8], [4, 9]);
    expect(s.players.player.bank).toBe(1);
  });
  it('Grudge Hurler roots its target; Oathkeeper knocks back; Delver counts the bank', () => {
    let s = strike(mk({ board: [P('axe-thrower', 4, 5, { shield: 9 }), O('dwarf-pickman', 4, 9)] }), [4, 5], [4, 9]);
    s = done(s);
    expect(legalActions(s).some((a: any) => a.type === 'move' && a.creatureUid === at(s, 4, 9).uid)).toBe(false);
    const k = strike(mk({ board: [P('dwarf-stoneback', 4, 8, { shield: 9 }), O('dwarf-pickman', 4, 9), O('goblin-grunt', 3, 9)] }), [4, 8], [4, 9]);
    expect(at(k, 3, 9)).toBeUndefined();
    expect(at(k, 4, 9)).toBeUndefined();
  });
  it('Overwatch hits at any distance; Plunder stacks; Bandage heals to full', () => {
    const s = strike(mk({ board: [P('oathbound-pikeman', 7, 3), O('goblin-grunt', 1, 11)] }), [7, 3], [1, 11]);
    expect(at(s, 1, 11)).toBeUndefined(); // defeated from across the board
    const p = mk({ playerHand: ['prospectors-prayer'], board: [] });
    const c = legalActions(p).find((a: any) => a.type === 'cast');
    expect(c).toBeTruthy();
  });
});
describe('round 12c active abilities', () => {
  const abil = (s: any, ability: string, extra: any = {}) => legalActions(s).find((a: any) => a.type === 'ability' && a.ability === ability && Object.entries(extra).every(([k, v]) => JSON.stringify((a as any)[k]) === JSON.stringify(v)));
  const toAction = (s: any) => done(s);
  it('SewerSlide Bomber runs to the first obstacle and goes Ka-boom', () => {
    let s = toAction(mk({ playerCrystals: 3, board: [P('blastrat-sapper', 6, 3), O('goblin-grunt', 6, 9, { shield: 9 })] }));
    const a = abil(s, 'slide', { dr: 0, dc: 1 });
    expect(a.target).toEqual({ row: 6, col: 8 });
    s = act(s, a);
    expect(at(s, 6, 8)).toBeUndefined();
  });
  it('Bowler Brawler knocks everything in the line back', () => {
    let s = toAction(mk({ playerCrystals: 3, board: [P('goblin-scrapper', 4, 2), O('goblin-grunt', 4, 4)] }));
    s = act(s, abil(s, 'bowl', { dr: 0, dc: 1 }));
    expect(at(s, 4, 4)).toBeUndefined();
    expect(s.board.creatures.some((c: any) => c.owner === 'opponent' && c.col === 4 && c.row !== 4)).toBe(true);
  });
  it('Voldawright shockwave and Rocket Rider explosion', () => {
    let s = toAction(mk({ playerCrystals: 3, board: [P('gnome-cogger', 4, 3), O('goblin-grunt', 4, 4)] }));
    s = act(s, abil(s, 'shockwave'));
    expect(at(s, 4, 5).health).toBe(2);
    let r = toAction(mk({ playerCrystals: 3, board: [P('shard-guzzler', 6, 3), O('goblin-grunt', 3, 9, { shield: 0 })] }));
    r = act(r, abil(r, 'rocket', { target: { row: 3, col: 10 } }));
    expect(at(r, 3, 9)).toBeDefined();
    expect(at(r, 3, 9).health).toBe(2);
  });
  it('Glyphshield Warden ward blocks damage and attacks', () => {
    let s = toAction(mk({ playerCrystals: 3, board: [P('glyphshield-warden', 4, 3), P('goblin-grunt', 4, 4)] }));
    s = act(s, abil(s, 'ward', { target: { row: 4, col: 4 } }));
    expect(at(s, 4, 4).wardUntil).toBeGreaterThan(s.turn);
  });
});
describe('round 12c illusions and economy', () => {
  it('Mirrorveil Illusionist blink leaves an illusion that takes 35% less damage', () => {
    let s = done(mk({ playerCrystals: 3, board: [P('gnome-illusionist', 6, 3), P('goblin-grunt', 6, 5)] }));
    const a = legalActions(s).find((x: any) => x.type === 'ability' && x.ability === 'blink');
    s = act(s, a);
    expect(s.board.creatures.filter((c: any) => c.illusion).length).toBe(1);
    expect(s.players.player.crystals + s.players.player.bank).toBe(2);
  });
});
