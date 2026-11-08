import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions, CONFIG, CARDS, blockPctFor, blockChance, commanderBlockChance, hitChance, swingOdds } from '../src/engine';

const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const P = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'player', row, col, ...x });
const O = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'opponent', row, col, ...x });
const at = (s: any, r: number, c: number) => s.board.creatures.find((x: any) => x.row === r && x.col === c);
const mk = (setup: any, extra: any = {}) => createMatch({ playerCommander: 'grubnak', opponentCommander: 'borgo', factionLock: false, mines: MINES, setup: { firstPlayer: 'player', playerHand: [], opponentHand: [], ...setup }, ...extra });
const unit = (cardId: string, health: number, extra: any = {}) => ({ cardId, health, abilities: CARDS[cardId].abilities, ...extra });

describe('Combat v4 dice (Ken, Nov 7: about 1 in 5 swings misses or is blocked; one block per fight)', () => {
  it('settings: 10 % miss, 11 % block before small modifiers, once per skirmish, no two misses in a row', () => {
    (CONFIG as any).combat.dice = 'roll';
    expect(CONFIG.combat.missPct).toBe(10); expect(CONFIG.combat.blockPct).toBe(11);
    expect(CONFIG.combat.blockOncePerSkirmish).toBe(true); expect(CONFIG.combat.missStreakGuard).toBe(true);
    expect(hitChance()).toBeCloseTo(0.9, 5);
  });
  it('block chance: a small Health bonus (+1 per Health above 2, +2 at most); Armored / Riot Shield +6; Large -4; a Large attacker -3; Commanders 8 %', () => {
    (CONFIG as any).combat.dice = 'roll';
    expect(blockPctFor(unit('goblin-grunt', 1), 1)).toBe(11);
    expect(blockPctFor(unit('goblin-grunt', 3), 3)).toBe(12);
    expect(blockPctFor(unit('dwarf-pickman', 6), 6)).toBe(13); // a plain wall: high Health barely matters
    expect(blockPctFor(unit('queen-brunhilda-stonebeard', 6), 6)).toBe(9); // cost 11: Large
    expect(blockPctFor(unit('ram-rider', 5), 5)).toBe(9); // cost 7: Large
    expect(blockPctFor(unit('dwarf-miner', 6), 6)).toBe(19); // Riot Shield Bearer
    expect(blockPctFor(unit('clockwork-beetle', 5), 5)).toBe(19); // Armored
    expect(blockPctFor(unit('goblin-grunt', 0), 0)).toBe(0);
    const big = unit('ram-rider', 5);
    expect(blockPctFor(unit('goblin-grunt', 3), 3, big)).toBe(9);
    expect(blockPctFor(unit('goblin-grunt', 1), 1, big)).toBe(8);
    expect(blockPctFor(unit('dwarf-miner', 6), 6, big)).toBe(16);
    expect(blockChance(unit('dwarf-pickman', 6))).toBeCloseTo(0.13, 5);
    expect(commanderBlockChance()).toBeCloseTo(0.08, 5);
    (CONFIG as any).combat.dice = 'sure';
    expect(commanderBlockChance()).toBe(0); expect(blockPctFor(unit('dwarf-miner', 6), 6)).toBe(0);
  });
  it('in one fight each unit blocks at most once, and never misses twice in a row (real dice, many seeds)', () => {
    (CONFIG as any).combat.dice = 'roll';
    let swings = 0, misses = 0, blocks = 0, twice = 0, missRuns = 0;
    for (let seed = 1; seed <= 400; seed++) {
      let s: any = mk({ board: [P('grubnaks-big-boss-troll', 4, 6), O('dwarf-miner', 4, 7)] }, { seed });
      s = applyAction(s, { type: 'done' }).state;
      const a = at(s, 4, 6);
      const r = applyAction(s, { type: 'attack', creatureUid: a.uid, target: { row: 4, col: 7 } });
      const by: Record<string, number> = {}, last: Record<string, string> = {};
      for (const e of r.events as any[]) {
        if (e.type !== 'swing') continue;
        swings++;
        if (e.result === 'miss') { misses++; if (last[e.uid] === 'miss') missRuns++; }
        if (e.result === 'block') { blocks++; by[e.targetUid] = (by[e.targetUid] || 0) + 1; }
        last[e.uid] = e.result;
      }
      if (Object.values(by).some((n) => n > 1)) twice++;
    }
    expect(twice, 'a unit blocked twice in one fight').toBe(0);
    expect(missRuns, 'two misses in a row').toBe(0);
    expect(misses / swings).toBeGreaterThan(0.04); expect(misses / swings).toBeLessThan(0.16);
    expect(blocks).toBeGreaterThan(0);
    (CONFIG as any).combat.dice = 'sure';
  });
  it('the exact odds follow the cap: a 6-swing attack on a 19 % blocker never expects more than one block', () => {
    (CONFIG as any).combat.dice = 'roll';
    const def = { ...unit('dwarf-miner', 6), health: 6 };
    const o = swingOdds(6, def);
    // without a cap 6 x 0.9... the cap keeps the expected damage above 6 swings minus misses minus one block
    expect(o.deal).toBeGreaterThan(6 - 6 * 0.1 - 1 - 1e-9);
    expect(o.deal).toBeLessThan(6);
    const cmd = swingOdds(3, null);
    expect(cmd.deal).toBeGreaterThan(3 - 0.3 - 0.08 * 3);
    (CONFIG as any).combat.dice = 'sure';
  });
  it('a Commander can block: with real dice a swing at him can come back as a block', () => {
    (CONFIG as any).combat.dice = 'roll';
    let blocks = 0, hits = 0;
    for (let seed = 1; seed <= 40; seed++) {
      let s: any = mk({ board: [P('grubnaks-big-boss-troll', 2, 11)] }, { seed });
      s = applyAction(s, { type: 'done' }).state;
      const u = at(s, 2, 11);
      const r = applyAction(s, { type: 'attack', creatureUid: u.uid, target: { commander: 'opponent' } });
      for (const e of r.events) if (e.type === 'swing' && e.commander) { if (e.result === 'block') blocks++; if (e.result === 'hit') hits++; }
    }
    expect(blocks).toBeGreaterThan(0); expect(hits).toBeGreaterThan(blocks);
    (CONFIG as any).combat.dice = 'sure';
  });
});

describe('Blasts hit friend and foe (Ken, Nov 1)', () => {
  it('Rocket Ride hurts every unit in the 3x3, the rider too (1 point of his 4 Health at stock Attack)', () => {
    (CONFIG as any).combat.dice = 'sure';
    let s: any = mk({ playerCrystals: 5, board: [P('shard-guzzler', 6, 3), P('goblin-grunt', 3, 7), O('dwarf-pickman', 3, 9)] });
    s = applyAction(s, { type: 'done' }).state;
    const rider = at(s, 6, 3);
    const a = legalActions(s).find((x: any) => x.type === 'ability' && x.ability === 'rocket' && x.creatureUid === rider.uid && x.target?.row === 3 && x.target?.col === 8);
    expect(a).toBeTruthy();
    const r = applyAction(s, a); expect(r.ok).toBe(true); s = r.state;
    expect(at(s, 3, 7).health).toBe(CARDS['goblin-grunt'].health - 1); // our own grunt
    expect(at(s, 3, 9).health).toBe(at(s, 3, 9).maxHealth - 1); // the enemy wall (Borgo's dwarves carry +1 Health)
    expect(at(s, 3, 8).health).toBe(CARDS['shard-guzzler'].health - 1); // the rider himself
  });
  it("the Bomber's Ka-boom hurts adjacent friends as well as foes", () => {
    (CONFIG as any).combat.dice = 'sure';
    let s: any = mk({ playerCrystals: 3, board: [P('blastrat-sapper', 6, 5), P('goblin-grunt', 4, 5), O('dwarf-pickman', 3, 5)] });
    s = applyAction(s, { type: 'done' }).state;
    const b = at(s, 6, 5);
    const a = legalActions(s).find((x: any) => x.type === 'ability' && x.ability === 'slide' && x.creatureUid === b.uid && x.dr === -1 && x.dc === 0);
    expect(a).toBeTruthy();
    s = applyAction(s, a).state;
    expect(s.board.creatures.some((c: any) => c.cardId === 'blastrat-sapper'), 'the Bomber blows up').toBe(false);
    expect(at(s, 4, 5).health, 'our grunt beside the blast').toBeLessThan(CARDS['goblin-grunt'].health);
  });
});

describe('Miner upgrades: 3 cards at most (Ken, Nov 1)', () => {
  it('the fourth upgrade card has no legal target on that creature', () => {
    (CONFIG as any).combat.dice = 'sure';
    let s: any = mk({ playerCrystals: 20, playerHand: ['goblin-scrounger', 'goblin-scrounger', 'goblin-scrounger', 'goblin-scrounger'], board: [P('goblin-grunt', 6, 5)] });
    const g = at(s, 6, 5);
    for (let i = 0; i < 3; i++) {
      const a = legalActions(s).find((x: any) => x.type === 'minerUpgrade' && x.creatureUid === g.uid);
      expect(a, `upgrade ${i + 1}`).toBeTruthy();
      s = applyAction(s, a).state;
    }
    expect(at(s, 6, 5).upgradeCount).toBe(3);
    expect(legalActions(s).some((x: any) => x.type === 'minerUpgrade' && x.creatureUid === g.uid), 'no fourth').toBe(false);
    expect(CONFIG.upgradeCap).toBe(3);
  });
});
