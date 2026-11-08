// Nov 5 (Ken approved studio/specs/new-cards-proposal-nov5.md, with his changes: piglets, Brood costs 2, "Sooey! Hog Call"):
// the 33 new cards, the 3 tokens and the engine features they need. Dice are 'sure' here (every swing lands, nothing blocks).
import { describe, it, expect } from 'vitest';
import { createMatch, applyAction, legalActions, CONFIG, CARDS, AI_DECKS, STARTER_DECKS, deckProblems, spellCost, atkValue, blockPctFor, rangedOf, ABILITY_COST, hasTag } from '../src/engine';

const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const P = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'player', row, col, ...x });
const O = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'opponent', row, col, ...x });
const at = (s: any, r: number, c: number) => s.board.creatures.find((x: any) => x.row === r && x.col === c);
const mk = (setup: any, extra: any = {}) => createMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', factionLock: false, mines: MINES, setup: { firstPlayer: 'player', playerHand: [], opponentHand: [], ...setup }, ...extra });
const act = (s: any, a: any) => { const r = applyAction(s, a); if (!r.ok) throw new Error(r.error + ' ' + JSON.stringify(a)); return r.state; };
const done = (s: any) => act(s, { type: 'done' });
const toAction = (s: any) => (s.phase === 'deploy' ? done(s) : s);
const ability = (s: any, uid: string, ab: string, pick?: (a: any) => boolean) => legalActions(s).find((a: any) => a.type === 'ability' && a.ability === ab && a.creatureUid === uid && (!pick || pick(a)));
const handUid = (s: any, who: string, id: string) => s.players[who].hand.find((h: any) => h.cardId === id).uid;
const count = (s: any, who: string, id: string) => s.board.creatures.filter((c: any) => c.owner === who && c.cardId === id).length;
(CONFIG as any).combat.dice = 'sure';

describe('the 33 cards and 3 tokens exist with the approved numbers', () => {
  const N: Record<string, [string, string, number, number, number, number]> = { // id: faction, rarity, cost, attack, health, move
    'mama-grubsnout': ['goblins', 'Collector', 7, 3, 6, 5], 'pox-doctor-ratsbane': ['goblins', 'Collector', 5, 2, 5, 4], 'snot-sergeant-gurk': ['goblins', 'Ultra Rare', 4, 2, 4, 4], 'fizzwick-fuse-lighter': ['goblins', 'Ultra Rare', 4, 2, 3, 4],
    'junk-catapult-crew': ['goblins', 'Rare', 3, 1, 4, 3], 'grease-gremlin': ['goblins', 'Rare', 3, 2, 3, 3], 'bogwater-brewer': ['goblins', 'Rare', 3, 1, 3, 3], 'runt-piglet': ['goblins', 'Common', 1, 1, 1, 3], 'bang-snap-imp': ['goblins', 'Common', 2, 1, 1, 3], 'sludge-lobber': ['goblins', 'Common', 2, 1, 2, 3],
    'wispmother-tallulah': ['gnomes', 'Collector', 5, 3, 5, 4], 'jinxmaster-wobblewick': ['gnomes', 'Collector', 5, 2, 5, 4], 'hexfuse-battery-golem': ['gnomes', 'Ultra Rare', 5, 3, 5, 4], 'rune-scribe-nimbletoe': ['gnomes', 'Ultra Rare', 4, 2, 3, 4], 'lens-grinder-lorelei': ['gnomes', 'Rare', 3, 1, 4, 3],
    'hexbolt-tinker': ['gnomes', 'Uncommon', 3, 1, 3, 3], 'spark-caddy': ['gnomes', 'Uncommon', 3, 2, 3, 3], 'stray-spark-wisp': ['gnomes', 'Common', 1, 1, 1, 3], 'hex-cadet': ['gnomes', 'Common', 2, 2, 2, 3], 'ratchet-runt': ['gnomes', 'Common', 2, 1, 2, 3],
    'engineer-cogsworth': ['dwarves', 'Collector', 5, 2, 6, 4], 'forgemaster-hildegrim': ['dwarves', 'Collector', 7, 3, 6, 5], 'shieldwall-sergeant-brasha': ['dwarves', 'Ultra Rare', 4, 2, 4, 4], 'master-smith-durga': ['dwarves', 'Ultra Rare', 4, 1, 4, 1], 'grumble-drummer': ['dwarves', 'Rare', 3, 1, 4, 3],
    'mule-wrangler-nessa': ['dwarves', 'Rare', 4, 2, 4, 4], 'stonebreaker-miner': ['dwarves', 'Common', 1, 1, 1, 1], 'shield-cadet': ['dwarves', 'Common', 2, 1, 3, 3], 'pebble-tosser': ['dwarves', 'Common', 2, 1, 2, 3], 'hammerhand-apprentice': ['dwarves', 'Common', 2, 2, 2, 3],
    piglet: ['goblins', 'Common', 1, 1, 1, 3], 'spark-wisp': ['gnomes', 'Common', 1, 1, 1, 3], 'clockwork-mule': ['dwarves', 'Common', 1, 0, 2, 1],
  };
  it('every creature: faction, rarity, cost (formula), attack, health, feet', () => {
    for (const [id, [f, r, cost, a, h, m]] of Object.entries(N)) { const c = CARDS[id]; expect(c, id).toBeTruthy(); expect([c.faction, c.rarity, c.cost, c.attack, c.health, c.move], id).toEqual([f, r, cost, a, h, m]); }
  });
  it('the three spells: Sooey! Hog Call (Legendary 5), Chain Lightning Lollapalooza (Ultra Rare 4), Stand Fast, Lads! (Legendary Instant 6)', () => {
    expect([CARDS['sooey-hog-call'].rarity, CARDS['sooey-hog-call'].cost, CARDS['sooey-hog-call'].spellKind, CARDS['sooey-hog-call'].name]).toEqual(['Collector', 5, 'regular', 'Sooey! Hog Call']);
    expect([CARDS['chain-lightning'].rarity, CARDS['chain-lightning'].cost, CARDS['chain-lightning'].spellKind]).toEqual(['Ultra Rare', 4, 'regular']);
    expect([CARDS['stand-fast-lads'].rarity, CARDS['stand-fast-lads'].cost, CARDS['stand-fast-lads'].spellKind]).toEqual(['Collector', 6, 'instant']);
  });
  it('every faction now has 4 Legendary, 5 Ultra Rare, 7 Rare, 7 Uncommon and 7 Common (tokens not counted); no spell is Common', () => {
    for (const f of ['goblins', 'gnomes', 'dwarves']) {
      const mine = Object.values<any>(CARDS).filter((c) => c.faction === f && !c.token && !c.disabled);
      const n = (r: string) => mine.filter((c) => c.rarity === r).length;
      expect([n('Collector'), n('Ultra Rare'), n('Rare'), n('Uncommon'), n('Common')], f).toEqual([4, 5, 7, 7, 7]);
    }
    for (const c of Object.values<any>(CARDS)) if (c.type === 'spell') expect(c.rarity, c.id).not.toBe('Common');
  });
  it('tags: Piglets, Wisps, Walls (the four 1/6 dwarves and the Shield Cadet) and Automatons', () => {
    const t = (id: string, tag: string) => hasTag({ cardId: id }, tag);
    expect([t('piglet', 'piglet'), t('runt-piglet', 'piglet'), t('spark-wisp', 'wisp'), t('stray-spark-wisp', 'wisp'), t('clockwork-mule', 'mule')]).toEqual([true, true, true, true, true]);
    for (const id of ['dwarf-miner', 'shieldbeard', 'gearward-sentinel', 'dwarf-pickman', 'shield-cadet']) expect(t(id, 'wall'), id).toBe(true);
    for (const id of ['clockwork-beetle', 'gearward-sentinel', 'overclocked-conduit', 'hexfuse-battery-golem']) expect(t(id, 'automaton'), id).toBe(true);
    expect(CARDS['shield-cadet'].move, 'the Cadet is a Wall for the auras but walks 3').toBe(3);
  });
  it('tokens: made in play only (a deck with one is illegal), never upgraded, spawn costs match the abilities', () => {
    for (const id of ['piglet', 'spark-wisp', 'clockwork-mule']) { expect(CARDS[id].token).toBe(true); expect(deckProblems([...Array(49).fill('goblin-grunt'), id]).join(' ')).toContain('token'); }
    expect([ABILITY_COST.brood, ABILITY_COST.spark, ABILITY_COST.build]).toEqual([CARDS.piglet.tokenCost, CARDS['spark-wisp'].tokenCost, CARDS['clockwork-mule'].tokenCost]);
    expect([ABILITY_COST.brood, ABILITY_COST.spark, ABILITY_COST.build, CARDS.piglet.tokenMax, CARDS['spark-wisp'].tokenMax, CARDS['clockwork-mule'].tokenMax]).toEqual([2, 1, 2, 4, 3, 3]);
    let s: any = mk({ playerHand: ['dwarf-smith-miner'], playerCrystals: 9, board: [P('clockwork-mule', 6, 3), P('goblin-grunt', 6, 5)] });
    const ups = legalActions(s).filter((a: any) => a.type === 'minerUpgrade').map((a: any) => s.board.creatures.find((c: any) => c.uid === a.creatureUid).cardId);
    expect(ups).toEqual(['goblin-grunt']);
  });
  it("the computer's own decks are legal 60-card decks and none of Ken's starter decks changed", () => {
    expect(Object.keys(AI_DECKS).length).toBe(3);
    for (const [id, cards] of Object.entries(AI_DECKS)) { expect(cards.length, id).toBe(60); expect(deckProblems(cards), id).toEqual([]); expect(cards.some((c) => CARDS[c].placeholder), id).toBe(true); }
    const starters = Object.values(STARTER_DECKS).flat();
    for (const c of Object.values<any>(CARDS)) if (c.placeholder) expect(starters.includes(c.id), c.id + ' must not be in a starter deck').toBe(false);
  });
});

describe('tokens and the crystal-paid spawns', () => {
  it('Brood: 2 crystals in the Deploy phase, any number of times, next to Mama, up to 4 Piglets; her Piglets have +1 Health; a Piglet waits a turn', () => {
    let s: any = mk({ playerCrystals: 9, board: [P('mama-grubsnout', 6, 4)] });
    const mama = at(s, 6, 4);
    const a = ability(s, mama.uid, 'brood', (x) => x.target.row === 5 && x.target.col === 4);
    expect(a).toBeTruthy();
    s = act(s, a);
    expect(s.players.player.crystals).toBe(7);
    const pig = at(s, 5, 4);
    expect([pig.cardId, pig.token, pig.attack, pig.health, pig.maxHealth, pig.summonedThisTurn]).toEqual(['piglet', true, 1, 2, 2, true]);
    for (let i = 0; i < 3; i++) s = act(s, ability(s, mama.uid, 'brood'));
    expect(count(s, 'player', 'piglet')).toBe(4);
    expect(ability(s, mama.uid, 'brood'), 'cap 4').toBeUndefined();
    s = done(s);
    expect(legalActions(s).some((x: any) => x.type === 'attack' && x.creatureUid === pig.uid), 'a fresh Piglet cannot act this turn').toBe(false);
    expect(ability(s, mama.uid, 'brood'), 'Brood is a Deploy-phase move').toBeUndefined();
  });
  it('a defeated token vanishes: no discard pile, no Miner draw; Mama leaving takes the +1 Health away', () => {
    let s: any = mk({ playerCrystals: 9, board: [P('mama-grubsnout', 6, 4), O('goblin-grunt', 2, 10)] });
    s = act(s, ability(s, at(s, 6, 4).uid, 'brood', (x) => x.target.row === 5 && x.target.col === 4));
    const pig = at(s, 5, 4);
    expect(pig.health).toBe(2);
    s.board.creatures = s.board.creatures.filter((c: any) => c.cardId !== 'mama-grubsnout'); s.board.creatures.push({ ...at(s, 5, 4), uid: 'sip', cardId: 'runic-siphoner', row: 6, col: 6, health: 2, maxHealth: 2, attack: 5, pigletBonus: 0, summonedThisTurn: false, hasAttacked: false, hasMined: false, hasMoved: false, movesLeft: 4 }); s = done(s); // Mama gone; a Siphoner stands by
    expect(at(s, 5, 4).maxHealth).toBe(1);
    const d0 = s.players.player.discard.length;
    s = act(s, ability(s, 'sip', 'sacrifice', (x) => x.target.row === 5 && x.target.col === 4));
    expect(at(s, 5, 4)).toBeUndefined();
    expect(s.players.player.discard.length, 'nothing went to the discard').toBe(d0);
    expect(s.players.player.discard.some((x: any) => x.cardId === 'piglet')).toBe(false);
  });
  it('Spark: 1 crystal each, up to 3 Wisps; a popped Wisp makes the next spell this turn 1 cheaper (2 with Tallulah; min 1; next spell only)', () => {
    let s: any = mk({ playerCrystals: 12, playerHand: ['fireball', 'fireball'], board: [P('wispmother-tallulah', 6, 4), P('runic-siphoner', 6, 6), O('goblin-grunt', 2, 10)] });
    const tal = at(s, 6, 4);
    s = act(s, ability(s, tal.uid, 'spark', (x) => x.target.row === 6 && x.target.col === 5));
    expect(s.players.player.crystals).toBe(11);
    expect(at(s, 6, 5).cardId).toBe('spark-wisp');
    s = act(s, ability(s, tal.uid, 'spark')); s = act(s, ability(s, tal.uid, 'spark'));
    expect(ability(s, tal.uid, 'spark'), 'cap 3').toBeUndefined();
    s = done(s);
    const fb = CARDS.fireball;
    expect(spellCost(s, 'player', fb)).toBe(fb.cost);
    s = act(s, ability(s, at(s, 6, 6).uid, 'sacrifice', (x) => x.target.row === 6 && x.target.col === 5)); // the Siphoner eats a Wisp: +1 Bank
    expect(s.players.player.bank).toBe(1);
    expect(spellCost(s, 'player', fb)).toBe(Math.max(1, fb.cost - 2));
    const c0 = s.players.player.crystals;
    s = act(s, { type: 'cast', uid: handUid(s, 'player', 'fireball'), target: { row: 2, col: 10 } });
    expect(c0 - s.players.player.crystals).toBe(Math.max(1, fb.cost - 2));
    expect(spellCost(s, 'player', fb), 'the discount was for that one spell').toBe(fb.cost);
  });
  it('without Tallulah a Stray Spark Wisp still gives 1 off; the discount never goes below 1 and ends with the turn', () => {
    let s: any = mk({ playerCrystals: 9, playerHand: ['venom-shiv'], board: [P('stray-spark-wisp', 6, 5), P('runic-siphoner', 6, 6), O('goblin-grunt', 2, 10)] });
    s = done(s);
    s = act(s, ability(s, at(s, 6, 6).uid, 'sacrifice', (x) => x.target.row === 6 && x.target.col === 5)); // the Siphoner pops our Wisp
    expect(at(s, 6, 5)).toBeUndefined();
    expect(spellCost(s, 'player', CARDS['venom-shiv'])).toBe(Math.max(1, CARDS['venom-shiv'].cost - 1));
    s = done(s); // the enemy's turn: the discount is gone
    expect(s.flags.wispDiscount.player).toBe(0);
  });
  it('Build: 2 crystals, once per turn, up to 3 Mules; a Mule mines 2 (3 beside Cogsworth), walks 1, never attacks, counts as a Miner', () => {
    let s: any = mk({ playerCrystals: 9, board: [P('engineer-cogsworth', 4, 5)] });
    const cog = at(s, 4, 5);
    s = act(s, ability(s, cog.uid, 'build', (x) => x.target.row === 4 && x.target.col === 6)); // beside Cogsworth AND beside the mine at (3,6)
    expect(s.players.player.crystals).toBe(7);
    expect(ability(s, cog.uid, 'build'), 'once per turn').toBeUndefined();
    const mule = at(s, 4, 6);
    expect([mule.cardId, mule.attack, mule.health, mule.movesLeft]).toEqual(['clockwork-mule', 0, 2, 1]);
    s = done(s);
    expect(legalActions(s).some((x: any) => x.type === 'attack' && x.creatureUid === mule.uid)).toBe(false);
    expect(legalActions(s).some((x: any) => x.type === 'mineAt' && x.row === 3 && x.col === 6)).toBe(true);
    s = act(s, { type: 'mineAt', row: 3, col: 6 });
    expect(s.sites.find((x: any) => x.row === 3 && x.col === 6).flow.player, 'mines 3 beside Cogsworth').toBe(3);
    // a Mule away from both Cogsworth and Nessa mines 2
    let s2: any = mk({ board: [P('clockwork-mule', 4, 9)] });
    s2 = done(s2); s2 = act(s2, { type: 'mineAt', row: 4, col: 10 });
    expect(s2.sites.find((x: any) => x.row === 4 && x.col === 10).flow.player).toBe(2);
  });
  it('Mule Wrangler Nessa: Mules within 2 mine +1 and cannot be knocked back', () => {
    let s: any = mk({ board: [P('clockwork-mule', 4, 9), P('mule-wrangler-nessa', 6, 9)] });
    s = done(s); s = act(s, { type: 'mineAt', row: 4, col: 10 });
    expect(s.sites.find((x: any) => x.row === 4 && x.col === 10).flow.player).toBe(3);
    // a Bare Knuckle Lunatic's death knock shoves every neighbour 1 away: with Nessa within 2 the Mule stays put
    const knock = (nessa: boolean) => { let k: any = mk({ playerHand: ['fireball'], playerCrystals: 9, board: [P('clockwork-mule', 4, 8), ...(nessa ? [P('mule-wrangler-nessa', 6, 8)] : []), O('goblin-bomber', 4, 7)] }); k = act(k, { type: 'cast', uid: handUid(k, 'player', 'fireball'), target: { row: 4, col: 7 } }); return k; };
    expect(at(knock(true), 4, 8)?.cardId, 'the Mule did not move').toBe('clockwork-mule');
    expect(at(knock(false), 4, 9)?.cardId, 'without Nessa it is shoved').toBe('clockwork-mule');
  });
  it('Sooey! Hog Call: a Piglet on every empty space around one owned mine, past the cap of 4; they cannot act this turn, even near Gurk', () => {
    let s: any = mk({ playerCrystals: 9, playerHand: ['sooey-hog-call'], board: [P('goblin-scrounger', 4, 9, { minedMine: { row: 4, col: 10 } }), P('snot-sergeant-gurk', 3, 8)] });
    expect(s.sites.find((x: any) => x.row === 4 && x.col === 10).controller, 'the Miner owns the mine').toBe('player');
    const casts = legalActions(s).filter((a: any) => a.type === 'cast');
    expect(casts.length).toBe(1); expect(casts[0].target).toEqual({ row: 4, col: 10 });
    s = act(s, casts[0]);
    expect(count(s, 'player', 'piglet')).toBe(7); // 8 spaces around the mine, one holds the Miner
    s = done(s);
    expect(legalActions(s).some((a: any) => a.type === 'attack' && at(s, 3, 9) && a.creatureUid === at(s, 3, 9).uid), 'a called Piglet beside Gurk still waits').toBe(false);
  });
});

describe('Piglet friends', () => {
  it('Sergeant Gurk: Piglets within 2 get +1 Attack and act the turn they appear', () => {
    let s: any = mk({ playerCrystals: 9, board: [P('mama-grubsnout', 6, 4), P('snot-sergeant-gurk', 5, 6), O('goblin-grunt', 4, 4)] });
    s = act(s, ability(s, at(s, 6, 4).uid, 'brood', (x) => x.target.row === 5 && x.target.col === 4));
    const pig = at(s, 5, 4);
    expect(atkValue(s, pig)).toBe(2);
    s = done(s);
    const atk = legalActions(s).find((a: any) => a.type === 'attack' && a.creatureUid === pig.uid && a.target.row === 4);
    expect(atk, 'acts at once beside Gurk').toBeTruthy();
    s = act(s, atk);
    expect(at(s, 4, 4).health).toBe(CARDS['goblin-grunt'].health - 2);
  });
  it('Junk Catapult Crew: Fling (1 crystal, once a turn) throws an adjacent Piglet up to 5 spaces and it can attack this turn', () => {
    let s: any = mk({ playerCrystals: 9, board: [P('junk-catapult-crew', 6, 4), P('runt-piglet', 6, 5, { summonedThisTurn: true }), O('dwarf-pickman', 2, 9)] });
    s = done(s);
    const cat = at(s, 6, 4), pig = at(s, 6, 5);
    expect(ability(s, cat.uid, 'fling', (x) => x.target.row === 2 && x.target.col === 11), 'over 5 away').toBeUndefined();
    const a = ability(s, cat.uid, 'fling', (x) => x.target.row === 3 && x.target.col === 9);
    expect(a).toBeTruthy(); expect(a.from).toEqual({ row: 6, col: 5 });
    s = act(s, a);
    expect(s.players.player.crystals).toBe(8);
    expect(at(s, 3, 9).uid).toBe(pig.uid);
    expect(ability(s, cat.uid, 'fling'), 'once per turn').toBeUndefined();
    const atk = legalActions(s).find((x: any) => x.type === 'attack' && x.creatureUid === pig.uid && x.target.row === 2 && x.target.col === 9);
    expect(atk, 'the flung Piglet attacks although it was summoned this turn').toBeTruthy();
    expect([at(s, 6, 4).hasAttacked, at(s, 6, 4).movesLeft], 'the crew itself keeps its action').toEqual([false, CARDS['junk-catapult-crew'].move]);
  });
  it('Grease Gremlin: adjacent Goblins are Sneaky (no strike back)', () => {
    let s: any = mk({ board: [P('goblin-grunt', 4, 4), P('grease-gremlin', 5, 4), O('dwarf-pickman', 3, 4)] });
    s = done(s);
    const g = at(s, 4, 4);
    s = act(s, { type: 'attack', creatureUid: g.uid, target: { row: 3, col: 4 } });
    expect(at(s, 4, 4).health, 'no strike back').toBe(at(s, 4, 4).maxHealth);
    let s2: any = mk({ board: [P('goblin-grunt', 4, 4), O('dwarf-pickman', 3, 4)] });
    s2 = done(s2); s2 = act(s2, { type: 'attack', creatureUid: at(s2, 4, 4).uid, target: { row: 3, col: 4 } });
    expect(at(s2, 4, 4).health, 'without the Gremlin the wall strikes back').toBeLessThan(at(s2, 4, 4).maxHealth);
  });
  it('Fizzwick: Ka-booms deal +1; a Goblin or Piglet defeated next to him Ka-booms for 1', () => {
    let s: any = mk({ firstPlayer: 'opponent', opponentHand: ['fireball'], opponentCrystals: 9, board: [P('fizzwick-fuse-lighter', 5, 5), P('bang-snap-imp', 5, 6), O('dwarf-pickman', 4, 7), O('dwarf-pickman', 6, 7)] });
    s = act(s, { type: 'cast', uid: handUid(s, 'opponent', 'fireball'), target: { row: 5, col: 6 } }); // the enemy kills our Imp
    expect(at(s, 5, 6)).toBeUndefined();
    expect(at(s, 4, 7).health, 'Ka-boom 1 + 1').toBe(at(s, 4, 7).maxHealth - 2);
    expect(at(s, 5, 5).health, 'Fizzwick himself is in the blast').toBe(CARDS['fizzwick-fuse-lighter'].health - 2);
    let s2: any = mk({ firstPlayer: 'opponent', opponentHand: ['fireball'], opponentCrystals: 9, board: [P('fizzwick-fuse-lighter', 5, 5), P('runt-piglet', 5, 6), O('dwarf-pickman', 4, 7)] });
    s2 = act(s2, { type: 'cast', uid: handUid(s2, 'opponent', 'fireball'), target: { row: 5, col: 6 } });
    expect(at(s2, 4, 7).health, 'a plain Piglet beside Fizzwick blows up for 1').toBe(at(s2, 4, 7).maxHealth - 1);
    let s3: any = mk({ firstPlayer: 'opponent', opponentHand: ['fireball'], opponentCrystals: 9, board: [P('runt-piglet', 5, 6), O('dwarf-pickman', 4, 7)] });
    s3 = act(s3, { type: 'cast', uid: handUid(s3, 'opponent', 'fireball'), target: { row: 5, col: 6 } });
    expect(at(s3, 4, 7).health, 'no Fizzwick, no boom').toBe(at(s3, 4, 7).maxHealth);
  });
});

describe('Poison X', () => {
  it('Sludge Lobber: Ranged 3, its hits Poison 1 (a turn of 1 damage, no healing)', () => {
    let s: any = mk({ board: [P('sludge-lobber', 5, 4), O('dwarf-pickman', 5, 7)] });
    s = done(s);
    expect(rangedOf(s, at(s, 5, 4))).toBe(3);
    s = act(s, { type: 'attack', creatureUid: at(s, 5, 4).uid, target: { row: 5, col: 7 } });
    const w = at(s, 5, 7);
    expect([w.poison, w.poisonStacks]).toEqual([1, 1]);
    const hp = w.health;
    s = done(s); // the enemy's turn starts: the poison ticks
    expect(at(s, 5, 7).health).toBe(hp - 1);
  });
  it('Pox Doctor Ratsbane: hits Poison 3, poisoned enemies have -1 Attack, enemy poison ticks deal double; Bog Brew gives a Goblin Poison 2 hits this turn', () => {
    let s: any = mk({ playerCrystals: 9, board: [P('pox-doctor-ratsbane', 5, 4), P('bogwater-brewer', 6, 6), P('goblin-grunt', 6, 7), O('dwarf-pickman', 5, 7), O('goblin-grunt', 7, 8)] });
    s = done(s);
    s = act(s, { type: 'attack', creatureUid: at(s, 5, 4).uid, target: { row: 5, col: 7 } });
    const w = at(s, 5, 7);
    expect(w.poison).toBe(3);
    expect(atkValue(s, w), '1 Attack wall, poisoned: 0').toBe(0);
    // Bog Brew: pay 1, the grunt's hits poison 2 this turn
    const brew = ability(s, at(s, 6, 6).uid, 'brewPoison', (x) => x.target.row === 6 && x.target.col === 7);
    expect(brew).toBeTruthy();
    s = act(s, brew);
    expect(s.players.player.crystals).toBe(8);
    s = act(s, { type: 'attack', creatureUid: at(s, 6, 7).uid, target: { row: 7, col: 8 } });
    expect(at(s, 7, 8).poison).toBe(2);
    const hp = w.health;
    s = done(s);
    expect(at(s, 5, 7).health, 'double tick with Ratsbane out').toBe(hp - 2);
  });
});

describe('Jinx', () => {
  it('Hexbolt Tinker Jinxes what it hits: -1 Attack, +1 damage from spells, until the start of its owner\'s next turn; Hex Cadet gets +1 against it', () => {
    let s: any = mk({ playerCrystals: 9, playerHand: ['fireball'], board: [P('hexbolt-tinker', 5, 4), P('hex-cadet', 4, 8), O('dwarf-pickman', 5, 7)] });
    s = done(s);
    s = act(s, { type: 'attack', creatureUid: at(s, 5, 4).uid, target: { row: 5, col: 7 } });
    const t = at(s, 5, 7);
    expect(t.jinxed).toBe(true);
    expect(atkValue(s, t)).toBe(Math.max(0, CARDS['dwarf-pickman'].attack - 1));
    expect(atkValue(s, at(s, 4, 8), t) - atkValue(s, at(s, 4, 8), { ...t, jinxed: false }), 'Hex Cadet vs a Jinxed enemy').toBe(1);
    expect(t.health, 'two swings landed (1 Attack + the faction triangle)').toBe(4);
    s = act(s, { type: 'cast', uid: handUid(s, 'player', 'fireball'), target: { row: 5, col: 7 } });
    expect(at(s, 5, 7), 'a 3-damage spell did 4 to the Jinxed wall').toBeUndefined();
    let s2: any = mk({ board: [P('hexbolt-tinker', 5, 4), O('dwarf-pickman', 5, 7)] });
    s2 = done(s2); s2 = act(s2, { type: 'attack', creatureUid: at(s2, 5, 4).uid, target: { row: 5, col: 7 } });
    expect(at(s2, 5, 7).jinxed).toBe(true);
    s2 = done(s2);
    expect(at(s2, 5, 7).jinxed, 'cleared when its owner turn starts').toBe(false);
  });
  it('Chain Lightning Lollapalooza: 3 to one enemy; a Jinxed target passes 2 to every enemy next to it', () => {
    let s: any = mk({ playerCrystals: 9, playerHand: ['chain-lightning', 'chain-lightning'], board: [O('dwarf-pickman', 3, 7), O('dwarf-pickman', 3, 8), O('dwarf-pickman', 2, 6), O('dwarf-pickman', 5, 9)] });
    s.board.creatures[0].jinxed = true;
    s = act(s, { type: 'cast', uid: handUid(s, 'player', 'chain-lightning'), target: { row: 3, col: 7 } });
    expect(at(s, 3, 7).health).toBe(CARDS['dwarf-pickman'].health - 4);
    expect(at(s, 3, 8).health).toBe(at(s, 3, 8).maxHealth - 2);
    expect(at(s, 2, 6).health).toBe(at(s, 2, 6).maxHealth - 2);
    expect(at(s, 5, 9).health, 'not adjacent').toBe(at(s, 5, 9).maxHealth);
    s = act(s, { type: 'cast', uid: handUid(s, 'player', 'chain-lightning'), target: { row: 5, col: 9 } }); // not Jinxed: no jump
    expect(at(s, 5, 9).health).toBe(at(s, 5, 9).maxHealth - 3);
  });
  it('Wobblewick: enemies your spells damage become Jinxed; at the end of your turn Jinxed enemies within 4 take 1; Nimbletoe fires a free spark at a Jinxed enemy when you cast', () => {
    let s: any = mk({ playerCrystals: 9, playerHand: ['fireball', 'venom-shiv'], board: [P('jinxmaster-wobblewick', 6, 8), P('rune-scribe-nimbletoe', 6, 3), O('dwarf-pickman', 4, 6), O('dwarf-pickman', 1, 10)] });
    s = act(s, { type: 'cast', uid: handUid(s, 'player', 'fireball'), target: { row: 4, col: 6 } });
    const t = at(s, 4, 6);
    expect(t.jinxed).toBe(true);
    const hp = t.health;
    s = act(s, { type: 'cast', uid: handUid(s, 'player', 'venom-shiv'), target: { row: 1, col: 10 } }); // any spell: Nimbletoe sparks the Jinxed wall in her line (6,3)->(4,5)? no: she needs a straight line
    expect(at(s, 4, 6).health, 'no straight line from (6,3) to (4,6): no spark').toBe(hp);
    s.board.creatures.find((c: any) => c.cardId === 'rune-scribe-nimbletoe').col = 6; // now she is 2 straight below the wall
    s.players.player.hand.push({ uid: 'k7', cardId: 'fireball' }); s.players.player.crystals = 9;
    s = act(s, { type: 'cast', uid: 'k7', target: { row: 1, col: 10 } });
    expect(at(s, 4, 6).health, 'the spark: 1 damage').toBe(hp - 1);
    at(s, 4, 6).health = 1; // units heal to full when their own turn starts, so the tick matters as a finisher
    s = done(s); s = done(s); // end of our turn: Wobblewick's tick on Jinxed enemies within 4 (the wall at distance 2)
    expect(at(s, 4, 6), 'finished off by the Jinx tick').toBeUndefined();
    expect(at(s, 1, 10), 'the far wall (5 away) got no tick and lives').toBeTruthy();
  });
});

describe('auras, spells and upgrades', () => {
  it('Lens Grinder Lorelei: Ranged allies within 2 shoot 2 further; Spark Caddy: adjacent Wisps shoot 2', () => {
    let s: any = mk({ board: [P('sludge-lobber', 6, 4), P('lens-grinder-lorelei', 6, 6), P('spark-caddy', 4, 8), P('stray-spark-wisp', 4, 9), O('dwarf-pickman', 4, 11)] });
    s = done(s);
    expect(rangedOf(s, at(s, 6, 4))).toBe(5);
    expect(rangedOf(s, at(s, 4, 9))).toBe(2);
    expect(legalActions(s).some((a: any) => a.type === 'attack' && a.creatureUid === at(s, 4, 9).uid && a.target.row === 4 && a.target.col === 11), 'the Wisp shoots 2 squares').toBe(true);
    s.board.creatures = s.board.creatures.filter((c: any) => c.cardId !== 'spark-caddy');
    expect(rangedOf(s, at(s, 4, 9)), 'melee again without the Caddy').toBe(0);
  });
  it('Ratchet Runt: +1 Attack next to an Automaton; Hexfuse Battery Golem: +1 Attack per spell cast this turn, max +3, gone next turn', () => {
    let s: any = mk({ playerCrystals: 12, playerHand: ['venom-shiv', 'venom-shiv', 'venom-shiv', 'venom-shiv'], board: [P('ratchet-runt', 6, 4), P('hexfuse-battery-golem', 6, 5), O('dwarf-pickman', 2, 9)] });
    expect(atkValue(s, at(s, 6, 4))).toBe(2);
    (CONFIG as any).combat.dice = 'roll'; expect(blockPctFor(at(s, 6, 5), 5), 'Armored').toBe(19); (CONFIG as any).combat.dice = 'sure';
    const golem = at(s, 6, 5);
    for (let i = 0; i < 4; i++) { s = act(s, { type: 'cast', uid: handUid(s, 'player', 'venom-shiv'), target: { row: 2, col: 9 } }); }
    expect(atkValue(s, at(s, 6, 5))).toBe(CARDS['hexfuse-battery-golem'].attack + 3);
    s = done(s); s = done(s); s = done(s); s = done(s); // back to our next turn
    expect(atkValue(s, s.board.creatures.find((c: any) => c.uid === golem.uid))).toBe(CARDS['hexfuse-battery-golem'].attack);
  });
  it('Grumble Drummer: adjacent Dwarves walk 1 further; Sergeant Brasha: Walls within 2 get +1 Attack and walk 3 (the Gearward Sentinel too)', () => {
    let s: any = mk({ board: [P('grumble-drummer', 6, 4), P('dwarf-stoneback', 6, 5), P('shieldwall-sergeant-brasha', 6, 9), P('shieldbeard', 6, 10), P('gearward-sentinel', 5, 8), P('dwarf-pickman', 7, 12)] });
    s = done(s); s = done(s); s = done(s); s = done(s); // our second turn: the start-of-turn feet are set
    expect(at(s, 6, 5).movesLeft, 'Oathkeeper beside the drum').toBe(CARDS['dwarf-stoneback'].move + 1);
    expect(at(s, 6, 10).movesLeft, 'a wall within 2 of Brasha walks 3').toBe(3);
    expect(at(s, 5, 8).movesLeft, 'the Gearward Sentinel is a Wall').toBe(3);
    expect(at(s, 7, 12).movesLeft, 'a wall away from both').toBe(CONFIG.wallMove);
    expect(atkValue(s, at(s, 6, 10))).toBe(CARDS.shieldbeard.attack + 1);
    expect(atkValue(s, at(s, 7, 12))).toBe(CARDS['dwarf-pickman'].attack);
  });
  it('Stand Fast, Lads!: until your next turn your Dwarves take at most 1 from any attack or spell, cannot be knocked back, and strike back with +1', () => {
    let s: any = mk({ playerCrystals: 9, playerHand: ['stand-fast-lads'], board: [P('dwarf-pickman', 4, 6), O('grubnaks-big-boss-troll', 3, 7), O('gnome-cogger', 5, 7)], opponentCrystals: 9, opponentHand: ['fireball'] });
    s = act(s, { type: 'cast', uid: handUid(s, 'player', 'stand-fast-lads') });
    expect(s.players.player.standFastUntil).toBe(s.turn + 2);
    s = done(s); s = done(s); // the enemy's turn
    s = done(s); // enemy deploy -> action
    const d = at(s, 4, 6), troll = at(s, 3, 7);
    const hp = d.health, thp = troll.health;
    s = act(s, { type: 'attack', creatureUid: troll.uid, target: { row: 4, col: 6 } });
    expect(hp - at(s, 4, 6).health, 'a 5-swing attack lands 1').toBe(1);
    expect(thp - at(s, 3, 7).health, 'the strike back: its Attack (with the faction triangle) + 1').toBe(atkValue(s, at(s, 4, 6), at(s, 3, 7)) + 1);
    s = act(s, ability(s, at(s, 5, 7).uid, 'shockwave'));
    expect(at(s, 4, 6)?.cardId, 'not knocked back').toBe('dwarf-pickman');
    expect(at(s, 4, 6).health, 'the Shockwave hit for 1, not its Attack').toBe(hp - 2);
    s.players.opponent.hand.push({ uid: 'k6', cardId: 'fireball' });
    s = act(s, { type: 'cast', uid: 'k6', target: { row: 4, col: 6 } });
    expect(at(s, 4, 6).health, 'a 3-damage spell does 1').toBe(hp - 3);
  });
  it('Durga: Smith upgrades give +2 Attack; Forge Touch (2 crystals, once a turn) upgrades an adjacent Dwarf; Hammerhand Apprentice gets +1 extra the first time; Hildegrim spreads +1 Health and makes Smith-upgraded Dwarves Armored', () => {
    let s: any = mk({ playerCrystals: 9, playerHand: ['dwarf-smith-miner', 'dwarf-smith-miner'], board: [P('master-smith-durga', 6, 4), P('hammerhand-apprentice', 6, 5), P('forgemaster-hildegrim', 7, 6), P('shield-cadet', 5, 6), P('goblin-grunt', 5, 4)] }, { playerCommander: 'sproingle' });
    const app = at(s, 6, 5), cadet = at(s, 5, 6), grunt = at(s, 5, 4);
    s = act(s, { type: 'minerUpgrade', uid: handUid(s, 'player', 'dwarf-smith-miner'), creatureUid: app.uid });
    const a1 = at(s, 6, 5);
    expect([a1.attack, a1.health, a1.upgradeCount], 'Smith +2 with Durga, +1 more for the eager first upgrade').toEqual([CARDS['hammerhand-apprentice'].attack + 3, CARDS['hammerhand-apprentice'].health + 1, 1]);
    expect(at(s, 5, 6).maxHealth, 'Hildegrim: the Cadet next to it gains 1 Health').toBe(CARDS['shield-cadet'].health + 1);
    expect(at(s, 5, 6).upgradeCount).toBe(1);
    expect(at(s, 5, 4).maxHealth, 'a goblin neighbour gains nothing').toBe(CARDS['goblin-grunt'].health);
    (CONFIG as any).combat.dice = 'roll'; expect(blockPctFor(at(s, 6, 5), 3), 'Smith-upgraded + Hildegrim = Armored (+6)').toBe(18);
    expect(blockPctFor(at(s, 5, 6), 4), 'a plain +1 Health is not a Smith upgrade: no Armored').toBe(13); (CONFIG as any).combat.dice = 'sure';
    const ft = ability(s, at(s, 6, 4).uid, 'forgeTouch', (x) => x.target.row === 6 && x.target.col === 5);
    expect(ft).toBeTruthy();
    s = act(s, ft);
    expect(s.players.player.crystals, '9 - 1 for the Smith card - 2 for Forge Touch').toBe(6);
    expect([at(s, 6, 5).attack, at(s, 6, 5).maxHealth, at(s, 6, 5).upgradeCount]).toEqual([a1.attack + 1, a1.maxHealth + 1, 2]);
    expect(ability(s, at(s, 6, 4).uid, 'forgeTouch'), 'once per turn').toBeUndefined();
    void cadet; void grunt;
  });
  it('the Soul Stone Siphoner can eat any token (Piglets too) for +1 Bank', () => {
    let s: any = mk({ board: [P('runic-siphoner', 6, 6), P('piglet', 6, 7)] });
    s = done(s);
    s = act(s, ability(s, at(s, 6, 6).uid, 'sacrifice', (x) => x.target.row === 6 && x.target.col === 7));
    expect(s.players.player.bank).toBe(1);
    expect(at(s, 6, 7)).toBeUndefined();
  });
});
