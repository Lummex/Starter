import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions, CONFIG, CARDS, blockDiceFor, blockChance, commanderBlockChance } from '../src/engine';

const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const P = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'player', row, col, ...x });
const O = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'opponent', row, col, ...x });
const at = (s: any, r: number, c: number) => s.board.creatures.find((x: any) => x.row === r && x.col === c);
const mk = (setup: any, extra: any = {}) => createMatch({ playerCommander: 'grubnak', opponentCommander: 'borgo', factionLock: false, mines: MINES, setup: { firstPlayer: 'player', playerHand: [], opponentHand: [], ...setup }, ...extra });
const unit = (cardId: string, health: number, extra: any = {}) => ({ cardId, health, abilities: CARDS[cardId].abilities, ...extra });

describe('Combat v3 dice (Forge/Ken, Nov 1)', () => {
  it('settings: 2-6 hits, only a 6 blocks, at most 2 dice', () => {
    (CONFIG as any).combat.dice = 'roll';
    expect(CONFIG.combat.hitFrom).toBe(2); expect(CONFIG.combat.blockFaces).toEqual([6]); expect(CONFIG.combat.blockCap).toBe(2);
  });
  it('block dice: Health up to 2; a cost-7+ unit rolls 1; Armored / Riot Shield roll one more, 3 at most; Commanders roll 1', () => {
    (CONFIG as any).combat.dice = 'roll';
    expect(blockDiceFor(unit('goblin-grunt', 3), 3)).toBe(2);
    expect(blockDiceFor(unit('goblin-grunt', 1), 1)).toBe(1);
    expect(blockDiceFor(unit('queen-brunhilda-stonebeard', 6), 6)).toBe(1); // cost 11
    expect(blockDiceFor(unit('ram-rider', 5), 5)).toBe(1); // cost 7
    expect(blockDiceFor(unit('dwarf-miner', 6), 6)).toBe(3); // Riot Shield Bearer: 2 + 1
    expect(blockDiceFor(unit('clockwork-beetle', 5), 5)).toBe(3); // Armored
    expect(blockDiceFor(unit('dwarf-pickman', 6), 6)).toBe(2); // a plain wall: 31 %
    expect(blockChance(unit('dwarf-pickman', 6))).toBeCloseTo(1 - Math.pow(5 / 6, 2), 5);
    expect(blockChance(unit('dwarf-miner', 6))).toBeCloseTo(1 - Math.pow(5 / 6, 3), 5);
    expect(commanderBlockChance()).toBeCloseTo(1 / 6, 5);
    (CONFIG as any).combat.dice = 'sure';
    expect(commanderBlockChance()).toBe(0);
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
