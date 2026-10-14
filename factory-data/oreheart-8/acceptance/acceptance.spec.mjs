import { test, expect } from '@playwright/test';

// ---------- helpers ----------
async function openTest(page, seed = 123) {
  await page.goto(`/?test=1&seed=${seed}`);
  await page.waitForFunction(() => !!window.oreheart);
}
async function newMatch(page, opts) {
  return page.evaluate(async (o) => {
    await window.oreheart.newMatch(o);
    return await window.oreheart.getState();
  }, opts);
}
async function start(page, opts) {
  await openTest(page);
  return newMatch(page, opts);
}
const getState = (page) => page.evaluate(async () => await window.oreheart.getState());
const legal = (page) => page.evaluate(async () => await window.oreheart.legalActions());
const act = (page, a) => page.evaluate(async (x) => await window.oreheart.act(x), a);
async function done(page, n = 1) {
  for (let i = 0; i < n; i++) {
    const r = await act(page, { type: 'done' });
    expect(r.ok, JSON.stringify(r)).toBe(true);
  }
}
// ends the active player's whole turn (Deploy -> Movement -> Attack -> next turn)
const passTurn = (page) => done(page, 3);
const at = (s, row, col) => s.board.creatures.find((c) => c.row === row && c.col === col);
const handUid = (s, side, cardId) => s.players[side].hand.find((c) => c.cardId === cardId).uid;
const total = (cr) => (cr.green || 0) + (cr.blue || 0) + (cr.purple || 0);
const sameTarget = (t, row, col) => t && t.row === row && t.col === col;

const LIMITED = new Set([
  'goblin-bomber', 'goblin-sneak', 'wolf-rider', 'grubnaks-big-boss-troll',
  'clockwork-beetle', 'gnome-illusionist', 'gyrocopter-ace', 'the-great-steam-golem',
  'ironhammer-berserker', 'brewmaster', 'ram-rider', 'queen-brunhilda-stonebeard',
  'overclocked-conduit', 'crystal-drunk-delver', 'fireball', 'battle-cry', 'meteor-strike',
  'second-wind', 'hold-it', 'spell-snap', 'mirror-hex', 'glowing-geode', 'heart-of-the-fallen', 'motherlode',
]);
const CRYSTALS = new Set(['soul-shard', 'crystal-cluster', 'glowing-geode', 'heart-of-the-fallen', 'motherlode']);

// ---------- AC1 ----------
test('AC1: main menu loads without page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'How to Play' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('AC1: starting a test-mode match causes no page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page, { ai: false, skipMulligan: true, firstPlayer: 'player' });
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

// ---------- AC2 ----------
test('AC2: menu -> choose Commander -> mulligan -> match', async ({ page }) => {
  await page.goto('/?test=1&seed=7');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('heading', { name: 'Choose Your Commander' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grubnak the Goblin Boss' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thane Borgo Anvilbottom' })).toBeVisible();
  await page.getByRole('button', { name: 'Professor Sproingle' }).click();
  await expect(page.getByRole('button', { name: 'Professor Sproingle' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Easy', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Normal', exact: true }).click();
  await page.getByRole('button', { name: 'Start Match' }).click();
  const mull = page.getByRole('dialog', { name: 'Mulligan' });
  await expect(mull).toBeVisible();
  await mull.getByRole('button', { name: 'Keep Hand' }).click();
  await expect(mull).toBeHidden();
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  const s = await getState(page);
  expect(s.players.player.commanderId).toBe('sproingle');
  expect(s.players.player.faction).toBe('gnomes');
});

// ---------- AC3 ----------
test('AC3: How to Play page with pictures and Back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'How to Play' }).click();
  await expect(page.getByRole('heading', { name: 'How to Play' })).toBeVisible();
  expect(await page.getByRole('img').count()).toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
});

// ---------- AC4 ----------
test('AC4: graphics toggle switches and persists', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Graphics: High' }).click();
  await expect(page.getByRole('button', { name: 'Graphics: Low' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Graphics: Low' })).toBeVisible();
  await page.getByRole('button', { name: 'Graphics: Low' }).click();
  await expect(page.getByRole('button', { name: 'Graphics: High' })).toBeVisible();
});

// ---------- AC5 ----------
test('AC5: window.oreheart only in test mode; seeds are deterministic', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
  expect(await page.evaluate(() => typeof window.oreheart)).toBe('undefined');

  const hands = async (seedUrl, opts) => {
    await openTest(page, seedUrl);
    const s = await newMatch(page, opts);
    return [s.players.player.hand.map((c) => c.cardId), s.players.opponent.hand.map((c) => c.cardId)];
  };
  const a = await hands(42, { ai: false, firstPlayer: 'player' });
  const b = await hands(42, { ai: false, firstPlayer: 'player' });
  expect(a).toEqual(b);
  const c = await hands(1, { ai: false, firstPlayer: 'player', seed: 99 });
  const d = await hands(5, { ai: false, firstPlayer: 'player', seed: 99 });
  expect(c).toEqual(d);
});

// ---------- AC6 ----------
for (const cmd of ['grubnak', 'sproingle', 'borgo']) {
  test(`AC6: ${cmd} starter deck follows the deck rules`, async ({ page }) => {
    const s = await start(page, { playerCommander: cmd, ai: false, firstPlayer: 'player' });
    expect(s.phase).toBe('mulligan');
    const p = s.players.player;
    expect(p.health).toBe(20);
    expect(s.players.opponent.health).toBe(20);
    expect(p.hand.length).toBe(5);
    const all = [...p.deck, ...p.hand].map((c) => c.cardId);
    expect(all.length).toBe(50);
    expect(all.filter((id) => CRYSTALS.has(id)).length).toBeLessThanOrEqual(10);
    const counts = {};
    for (const id of all) counts[id] = (counts[id] || 0) + 1;
    for (const [id, n] of Object.entries(counts)) if (LIMITED.has(id)) expect(n, id).toBeLessThanOrEqual(3);
  });
}

// ---------- AC7 ----------
test('AC7: opening sequence, first-player skip, extra card and turn-1 income', async ({ page }) => {
  let s = await start(page, { playerCommander: 'grubnak', opponentCommander: 'borgo', ai: false, firstPlayer: 'player' });
  expect(s.phase).toBe('mulligan');
  expect(s.priority).toBe('player');
  let r = await act(page, { type: 'mulligan', uids: [] });
  expect(r.ok).toBe(true);
  s = await getState(page);
  if (s.phase === 'mulligan') {
    expect(s.priority).toBe('opponent');
    r = await act(page, { type: 'mulligan', uids: [] });
    expect(r.ok).toBe(true);
    s = await getState(page);
  }
  expect(s.turn).toBe(1);
  expect(s.activePlayer).toBe('player');
  expect(s.phase).toBe('deploy');
  expect(s.players.player.hand.length).toBe(5);
  expect(s.players.opponent.hand.length).toBe(6);
  expect(s.players.player.crystals.green).toBe(6);
  await passTurn(page);
  s = await getState(page);
  expect(s.turn).toBe(2);
  expect(s.activePlayer).toBe('opponent');
  expect(s.phase).toBe('deploy');
  expect(s.players.opponent.hand.length).toBe(7);
  expect(s.players.opponent.crystals.purple).toBe(6);
});

// ---------- AC8 ----------
test('AC8: HUD elements and Done button advance phases', async ({ page }) => {
  await start(page, { ai: false, setup: { playerCrystals: { green: 4 }, playerHealth: 17, opponentHealth: 12 } });
  await expect(page.getByLabel('Current phase', { exact: true })).toContainText('Deploy');
  await expect(page.getByLabel('Phase timer', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Your green crystals', { exact: true })).toHaveText(/\b4\b/);
  await expect(page.getByLabel('Your blue crystals', { exact: true })).toHaveText(/\b0\b/);
  await expect(page.getByLabel('Your purple crystals', { exact: true })).toHaveText(/\b0\b/);
  await expect(page.getByLabel('Your Commander health', { exact: true })).toContainText('17');
  await expect(page.getByLabel('Enemy Commander health', { exact: true })).toContainText('12');
  const doneBtn = page.getByRole('button', { name: 'Done' });
  await doneBtn.click();
  await expect(page.getByLabel('Current phase', { exact: true })).toContainText('Movement');
  await doneBtn.click();
  await expect(page.getByLabel('Current phase', { exact: true })).toContainText('Attack');
  await doneBtn.click();
  await expect(page.getByLabel('Current phase', { exact: true })).toContainText(/Enemy turn/i);
  const s = await getState(page);
  expect(s.activePlayer).toBe('opponent');
});

// ---------- AC9 ----------
test('AC9: majority control with Gatherer bonus', async ({ page }) => {
  await start(page, {
    ai: false,
    setup: {
      board: [
        { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1 },
        { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 2 },
      ],
    },
  });
  await passTurn(page);
  await passTurn(page);
  const s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(s.sites[0].controller).toBe('player');
  expect(s.sites[1].controller).toBe(null);
  expect(s.sites[2].controller).toBe(null);
  // +1 stronghold, +1 site, +2 gatherer, no underdog
  expect(s.players.player.crystals.green).toBe(4);
});

test('AC9: tie means nobody controls; underdog bonus applies', async ({ page }) => {
  await start(page, {
    ai: false,
    setup: {
      board: [
        { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1 },
        { cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1 },
      ],
    },
  });
  await passTurn(page);
  await passTurn(page);
  const s = await getState(page);
  expect(s.sites[0].controller).toBe(null);
  // +1 stronghold, +2 underdog
  expect(s.players.player.crystals.green).toBe(3);
});

test('AC9: shared column 3 counts for two sites', async ({ page }) => {
  await start(page, {
    ai: false,
    setup: { board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 3 }] },
  });
  await passTurn(page);
  await passTurn(page);
  const s = await getState(page);
  expect(s.sites[0].controller).toBe('player');
  expect(s.sites[1].controller).toBe('player');
  expect(s.sites[2].controller).toBe(null);
  expect(s.players.player.crystals.green).toBe(3); // 1 + 1 + 1
});

// ---------- AC10 ----------
test('AC10: summoning rules, Grubnak discount, Tunnel and summoning sickness', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    setup: { playerHand: ['goblin-scrapper', 'goblin-scrounger', 'wolf-rider'], playerCrystals: { green: 10 } },
  });
  const scrapper = handUid(s, 'player', 'goblin-scrapper');
  const scrounger = handUid(s, 'player', 'goblin-scrounger');
  const wolf = handUid(s, 'player', 'wolf-rider');
  const acts = await legal(page);
  const summons = acts.filter((a) => a.type === 'summon');
  // Scrapper: only home rows 6-7
  expect(summons.some((a) => a.uid === scrapper && a.row === 3)).toBe(false);
  expect(summons.some((a) => a.uid === scrapper && a.row === 6 && a.col === 1)).toBe(true);
  expect(summons.some((a) => a.uid === scrapper && a.row === 7 && a.col === 4)).toBe(false); // stronghold
  // Scrounger has Tunnel
  expect(summons.some((a) => a.uid === scrounger && a.row === 3 && a.col === 2)).toBe(true);

  expect((await act(page, { type: 'summon', uid: scrapper, row: 3, col: 2 })).ok).toBe(false);
  expect((await act(page, { type: 'summon', uid: scrapper, row: 6, col: 1 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 1).cardId).toBe('goblin-scrapper');
  expect(at(s, 6, 1).summonedThisTurn).toBe(true);
  expect(s.players.player.crystals.green).toBe(9); // cost 2 - 1 (Grubnak)
  expect((await act(page, { type: 'summon', uid: scrounger, row: 3, col: 2 })).ok).toBe(true);
  expect((await act(page, { type: 'summon', uid: wolf, row: 6, col: 4 })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals.green).toBe(5); // 9 - 1 - 3

  await done(page); // -> movement
  const moves = (await legal(page)).filter((a) => a.type === 'move');
  expect(moves.some((a) => a.creatureUid === at(s, 6, 1).uid)).toBe(false);
  expect(moves.some((a) => a.creatureUid === at(s, 6, 4).uid)).toBe(true); // Wolf Rider acts immediately
});

test('AC10: Unique card limited to one on the battlefield; Borgo +1 Health', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'borgo',
    setup: {
      playerHand: ['queen-brunhilda-stonebeard', 'shieldbeard'],
      playerCrystals: { purple: 20 },
      board: [{ cardId: 'queen-brunhilda-stonebeard', owner: 'player', row: 6, col: 7 }],
    },
  });
  const queen = handUid(s, 'player', 'queen-brunhilda-stonebeard');
  const acts = await legal(page);
  expect(acts.some((a) => a.type === 'summon' && a.uid === queen)).toBe(false);
  expect((await act(page, { type: 'summon', uid: queen, row: 6, col: 1 })).ok).toBe(false);
  const sb = handUid(s, 'player', 'shieldbeard');
  expect((await act(page, { type: 'summon', uid: sb, row: 6, col: 2 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 2).maxHealth).toBe(5);
  expect(at(s, 6, 2).health).toBe(5);
  expect(at(s, 6, 7).maxHealth).toBe(10);
});

// ---------- AC11 ----------
test('AC11: movement in 8 directions, move 2 only for move-2 creatures', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    setup: {
      board: [
        { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 2 },
        { cardId: 'wolf-rider', owner: 'player', row: 6, col: 6 },
        { cardId: 'goblin-slinger', owner: 'player', row: 5, col: 2 },
      ],
    },
  });
  await done(page); // -> movement
  const scrap = at(s, 6, 2).uid;
  const wolf = at(s, 6, 6).uid;
  const moves = (await legal(page)).filter((a) => a.type === 'move');
  expect(moves.some((a) => a.creatureUid === scrap && a.row === 5 && a.col === 1)).toBe(true); // diagonal
  expect(moves.some((a) => a.creatureUid === scrap && a.row === 5 && a.col === 2)).toBe(false); // occupied
  expect(moves.some((a) => a.creatureUid === scrap && a.row === 4 && a.col === 2)).toBe(false); // too far
  expect(moves.some((a) => a.creatureUid === wolf && a.row === 4 && a.col === 6)).toBe(false); // site
  expect(moves.some((a) => a.creatureUid === wolf && a.row === 4 && a.col === 7)).toBe(true); // 2 spaces

  expect((await act(page, { type: 'move', creatureUid: scrap, row: 4, col: 1 })).ok).toBe(false);
  expect((await act(page, { type: 'move', creatureUid: scrap, row: 6, col: 3 })).ok).toBe(true);
  expect((await act(page, { type: 'move', creatureUid: wolf, row: 4, col: 7 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 3).uid).toBe(scrap);
  expect(at(s, 4, 7).uid).toBe(wolf);
  // each creature moves once per turn
  expect((await act(page, { type: 'move', creatureUid: scrap, row: 6, col: 4 })).ok).toBe(false);
});

// ---------- AC12 ----------
test('AC12: type advantage kills before strike back; defeated go to discard', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'borgo',
    opponentCommander: 'grubnak',
    setup: {
      board: [
        { cardId: 'shieldbeard', owner: 'player', row: 5, col: 4 },
        { cardId: 'goblin-scrapper', owner: 'opponent', row: 4, col: 3 },
      ],
    },
  });
  await done(page, 2); // -> attack
  const r = await act(page, { type: 'attack', creatureUid: at(s, 5, 4).uid, target: { row: 4, col: 3 } });
  expect(r.ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 3)).toBeUndefined();
  expect(at(s, 5, 4).health).toBe(5); // 4 + Borgo, no strike back
  expect(s.players.opponent.discard.some((c) => c.cardId === 'goblin-scrapper')).toBe(true);
});

test('AC12: strike back with type advantage, damage stays', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'borgo',
    setup: {
      board: [
        { cardId: 'goblin-scrapper', owner: 'player', row: 3, col: 5 },
        { cardId: 'shieldbeard', owner: 'opponent', row: 2, col: 5 },
      ],
    },
  });
  await done(page, 2);
  const r = await act(page, { type: 'attack', creatureUid: at(s, 3, 5).uid, target: { row: 2, col: 5 } });
  expect(r.ok).toBe(true);
  s = await getState(page);
  expect(at(s, 2, 5).health).toBe(3); // 5 - 2
  expect(at(s, 2, 5).maxHealth).toBe(5);
  expect(at(s, 3, 5)).toBeUndefined(); // strike back 2 + 1 = 3 kills the Scrapper
  expect(s.players.player.discard.some((c) => c.cardId === 'goblin-scrapper')).toBe(true);
  await passTurn(page);
  s = await getState(page);
  expect(at(s, 2, 5).health).toBe(3); // damage stays
});

test('AC12: Guard forces adjacent melee attackers to hit it', async ({ page }) => {
  const s = await start(page, {
    ai: false,
    opponentCommander: 'borgo',
    setup: {
      board: [
        { cardId: 'goblin-scrapper', owner: 'player', row: 3, col: 4 },
        { cardId: 'shieldbeard', owner: 'opponent', row: 2, col: 3 },
        { cardId: 'dwarf-miner', owner: 'opponent', row: 2, col: 5 },
      ],
    },
  });
  await done(page, 2);
  const atk = (await legal(page)).filter((a) => a.type === 'attack' && a.creatureUid === at(s, 3, 4).uid);
  expect(atk.some((a) => sameTarget(a.target, 2, 3))).toBe(true);
  expect(atk.some((a) => sameTarget(a.target, 2, 5))).toBe(false);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 3, 4).uid, target: { row: 2, col: 5 } })).ok).toBe(false);
});

test('AC12: Ranged hits 2 away with no strike back, blocked by a creature in between', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    opponentCommander: 'borgo',
    setup: {
      board: [
        { cardId: 'goblin-slinger', owner: 'player', row: 5, col: 1 },
        { cardId: 'dwarf-miner', owner: 'opponent', row: 3, col: 1 },
        { cardId: 'goblin-slinger', owner: 'player', row: 5, col: 7 },
        { cardId: 'shieldbeard', owner: 'opponent', row: 4, col: 7 },
        { cardId: 'dwarf-miner', owner: 'opponent', row: 3, col: 7 },
      ],
    },
  });
  await done(page, 2);
  const left = at(s, 5, 1).uid;
  const right = at(s, 5, 7).uid;
  const acts = (await legal(page)).filter((a) => a.type === 'attack');
  expect(acts.some((a) => a.creatureUid === right && sameTarget(a.target, 3, 7))).toBe(false);
  expect(acts.some((a) => a.creatureUid === left && sameTarget(a.target, 3, 1))).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: left, target: { row: 3, col: 1 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 3, 1).health).toBe(3); // Miner 3 + Borgo 1 - 1
  expect(at(s, 5, 1).health).toBe(2); // no strike back
});

// ---------- AC13 ----------
test('AC13: Fireball deals 3 damage and can be paid with any color', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'borgo',
    setup: {
      playerHand: ['fireball'],
      playerCrystals: { blue: 5 },
      board: [{ cardId: 'shieldbeard', owner: 'opponent', row: 3, col: 4 }],
    },
  });
  const r = await act(page, { type: 'cast', uid: handUid(s, 'player', 'fireball'), target: { row: 3, col: 4 } });
  expect(r.ok).toBe(true);
  s = await getState(page);
  expect(at(s, 3, 4).health).toBe(2);
  expect(total(s.players.player.crystals)).toBe(0);
  expect(s.players.player.discard.some((c) => c.cardId === 'fireball')).toBe(true);
});

test('AC13: only one Crystal card per turn', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    setup: { playerHand: ['soul-shard', 'soul-shard'], playerCrystals: { green: 0 } },
  });
  const [a, b] = s.players.player.hand.map((c) => c.uid);
  expect((await act(page, { type: 'playCrystal', uid: a })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals.green).toBe(1);
  expect((await legal(page)).some((x) => x.type === 'playCrystal')).toBe(false);
  expect((await act(page, { type: 'playCrystal', uid: b })).ok).toBe(false);
  s = await getState(page);
  expect(s.players.player.crystals.green).toBe(1);
});

test('AC13: upgrade costs 6 and is limited to one per creature', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    setup: {
      playerCrystals: { green: 12 },
      board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 }],
    },
  });
  const uid = at(s, 6, 3).uid;
  expect((await act(page, { type: 'upgrade', creatureUid: uid, upgrade: 'sharpened-weapons' })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 3).attack).toBe(3);
  expect(at(s, 6, 3).upgrade).toBe('sharpened-weapons');
  expect(s.players.player.crystals.green).toBe(6);
  expect((await legal(page)).some((x) => x.type === 'upgrade' && x.creatureUid === uid)).toBe(false);
  expect((await act(page, { type: 'upgrade', creatureUid: uid, upgrade: 'heavy-armor' })).ok).toBe(false);
});

// ---------- AC14 ----------
test('AC14: Fizzle counters Fireball; crystals still spent', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'borgo',
    setup: {
      playerHand: ['fireball'],
      playerCrystals: { green: 5 },
      opponentHand: ['fizzle'],
      opponentCrystals: { purple: 5 },
      board: [{ cardId: 'shieldbeard', owner: 'opponent', row: 3, col: 4 }],
    },
  });
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'fireball'), target: { row: 3, col: 4 } })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse).not.toBe(null);
  expect(s.pendingResponse.responder).toBe('opponent');
  expect(s.priority).toBe('opponent');
  const fizzle = handUid(s, 'opponent', 'fizzle');
  const acts = await legal(page);
  expect(acts.some((a) => a.type === 'pass')).toBe(true);
  expect(acts.some((a) => a.type === 'respond' && a.uid === fizzle)).toBe(true);
  expect((await act(page, { type: 'respond', uid: fizzle })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse).toBe(null);
  expect(at(s, 3, 4).health).toBe(5);
  expect(total(s.players.player.crystals)).toBe(0);
  expect(total(s.players.opponent.crystals)).toBe(0);
  expect(s.players.player.discard.some((c) => c.cardId === 'fireball')).toBe(true);
  expect(s.players.opponent.discard.some((c) => c.cardId === 'fizzle')).toBe(true);
  expect(s.priority).toBe('player');
});

test('AC14: Hold It! returns a summoned creature to hand', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'borgo',
    setup: {
      playerHand: ['goblin-scrapper'],
      playerCrystals: { green: 3 },
      opponentHand: ['hold-it'],
      opponentCrystals: { purple: 6 },
    },
  });
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrapper'), row: 6, col: 1 })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse && s.pendingResponse.responder).toBe('opponent');
  expect((await act(page, { type: 'respond', uid: handUid(s, 'opponent', 'hold-it') })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 1)).toBeUndefined();
  expect(s.players.player.hand.some((c) => c.cardId === 'goblin-scrapper')).toBe(true);
  expect(s.players.player.crystals.green).toBe(2);
});

const respondSetup = {
  ai: false,
  playerCommander: 'grubnak',
  opponentCommander: 'borgo',
  setup: {
    firstPlayer: 'opponent',
    opponentHand: ['fireball'],
    opponentCrystals: { purple: 5 },
    playerHand: ['shield-bubble'],
    playerCrystals: { green: 5 },
    board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 4 }],
  },
};

test('AC14: Respond dialog — Let it happen', async ({ page }) => {
  let s = await start(page, respondSetup);
  expect(s.activePlayer).toBe('opponent');
  expect((await act(page, { type: 'cast', uid: handUid(s, 'opponent', 'fireball'), target: { row: 6, col: 4 } })).ok).toBe(true);
  const dlg = page.getByRole('dialog', { name: 'Respond?' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Shield Bubble' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Let it happen' }).click();
  await expect(dlg).toBeHidden();
  await expect.poll(async () => at(await getState(page), 6, 4)).toBeUndefined();
});

test('AC14: Respond dialog — cast Shield Bubble saves the creature', async ({ page }) => {
  let s = await start(page, respondSetup);
  expect((await act(page, { type: 'cast', uid: handUid(s, 'opponent', 'fireball'), target: { row: 6, col: 4 } })).ok).toBe(true);
  const dlg = page.getByRole('dialog', { name: 'Respond?' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Shield Bubble' }).click();
  await expect(dlg).toBeHidden();
  await expect.poll(async () => (await getState(page)).pendingResponse).toBe(null);
  s = await getState(page);
  expect(at(s, 6, 4).health).toBe(3);
  expect(s.players.player.discard.some((c) => c.cardId === 'shield-bubble')).toBe(true);
});

// ---------- AC15 ----------
test('AC15: deck-out deals 1 damage per failed draw', async ({ page }) => {
  await start(page, { ai: false, setup: { playerDeck: [] } });
  await passTurn(page);
  await passTurn(page);
  let s = await getState(page);
  expect(s.players.player.health).toBe(19);
  await passTurn(page);
  await passTurn(page);
  s = await getState(page);
  expect(s.players.player.health).toBe(18);
});

// ---------- AC16 ----------
test('AC16: reducing enemy Commander to 0 shows Victory!', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    setup: { opponentHealth: 2, board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 2, col: 4 }] },
  });
  await done(page, 2);
  const acts = await legal(page);
  expect(acts.some((a) => a.type === 'attack' && a.target && a.target.commander === 'opponent')).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 2, 4).uid, target: { commander: 'opponent' } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(0);
  expect(s.winner).toBe('player');
  expect(s.phase).toBe('over');
  await expect(page.getByRole('heading', { name: 'Victory!' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Back to Menu' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
});

test('AC16: surrender from the match menu shows Defeat', async ({ page }) => {
  await start(page, { ai: false, skipMulligan: true, firstPlayer: 'player' });
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Surrender' }).click();
  await expect(page.getByText('Surrender this match?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, surrender' }).click();
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible({ timeout: 15000 });
  const s = await getState(page);
  expect(s.winner).toBe('opponent');
});

test('AC16: surrender action via API', async ({ page }) => {
  await start(page, { ai: false, skipMulligan: true, firstPlayer: 'player' });
  expect((await act(page, { type: 'surrender' })).ok).toBe(true);
  const s = await getState(page);
  expect(s.winner).toBe('opponent');
  expect(s.phase).toBe('over');
});

// ---------- AC17 ----------
for (const difficulty of ['easy', 'normal']) {
  test(`AC17: ${difficulty} AI completes its turn and hands it back`, async ({ page }) => {
    await start(page, { ai: true, difficulty, skipMulligan: true, firstPlayer: 'player' });
    await passTurn(page);
    await expect
      .poll(async () => {
        const s = await getState(page);
        return `${s.activePlayer}|${s.phase}|${s.turn}`;
      }, { timeout: 15000 })
      .toBe('player|deploy|3');
  });
}

test('AC17: Normal AI defeats a passive player before turn 40', async ({ page }) => {
  test.setTimeout(120000);
  await start(page, { ai: true, difficulty: 'normal', skipMulligan: true, firstPlayer: 'player', opponentCommander: 'grubnak' });
  const result = await page.evaluate(async () => {
    const o = window.oreheart;
    const deadline = Date.now() + 100000;
    while (Date.now() < deadline) {
      const s = await o.getState();
      if (s.winner) return { winner: s.winner, turn: s.turn };
      if (s.priority === 'player') {
        const acts = await o.legalActions();
        const a = acts.find((x) => x.type === 'pass') || acts.find((x) => x.type === 'done') || acts.find((x) => x.type === 'mulligan');
        if (a) await o.act(a);
        else await new Promise((r) => setTimeout(r, 20));
      } else {
        await new Promise((r) => setTimeout(r, 20));
      }
    }
    const s = await o.getState();
    return { winner: s.winner, turn: s.turn };
  });
  expect(result.winner).toBe('opponent');
  expect(result.turn).toBeLessThan(40);
});

// ---------- AC18 ----------
test('AC18: hand cards are buttons and open a card view', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['fireball', 'goblin-scrapper'] } });
  const card = page.getByRole('button', { name: 'Fireball', exact: true });
  await expect(card).toBeVisible();
  await expect(page.getByRole('button', { name: 'Goblin Scrapper', exact: true })).toBeVisible();
  await card.click();
  const view = page.getByRole('dialog', { name: 'Fireball' });
  await expect(view).toBeVisible();
  await expect(view).toContainText('3 damage');
  await view.getByRole('button', { name: 'Close' }).click();
  await expect(view).toBeHidden();
});

// ---------- AC19 ----------
test('AC19: illegal actions are rejected and state is unchanged', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['wolf-rider'], playerCrystals: { green: 1 } } });
  const before = await getState(page);
  const uid = before.players.player.hand[0].uid;
  const r1 = await act(page, { type: 'summon', uid, row: 6, col: 1 }); // can't afford
  expect(r1.ok).toBe(false);
  expect(typeof r1.error).toBe('string');
  const r2 = await act(page, { type: 'move', creatureUid: 'nope', row: 1, col: 1 });
  expect(r2.ok).toBe(false);
  const r3 = await act(page, { type: 'attack', creatureUid: 'nope', target: { commander: 'opponent' } });
  expect(r3.ok).toBe(false);
  const after = await getState(page);
  expect(after).toEqual(before);
});

// ---------- AC20 ----------
test.describe('phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('AC20: menu and match fit a phone screen', async ({ page }) => {
    await page.goto('/?test=1');
    await expect(page.getByRole('button', { name: 'Play' })).toBeInViewport();
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.waitForFunction(() => !!window.oreheart);
    await newMatch(page, { ai: false, setup: { playerHand: ['fireball', 'goblin-scrapper', 'goblin-slinger'] } });
    await expect(page.getByRole('button', { name: 'Done' })).toBeInViewport();
    await expect(page.getByLabel('Your Commander health', { exact: true })).toBeInViewport();
    await expect(page.getByLabel('Enemy Commander health', { exact: true })).toBeInViewport();
    await expect(page.getByLabel('Current phase', { exact: true })).toBeInViewport();
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
