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
// ends the active player's whole turn (Deploy -> Action -> next turn)
const passTurn = (page) => done(page, 2);
const at = (s, row, col) => s.board.creatures.find((c) => c.row === row && c.col === col);
const handUid = (s, side, cardId) => s.players[side].hand.find((c) => c.cardId === cardId).uid;
const total = (cr) => (cr.green || 0) + (cr.blue || 0) + (cr.purple || 0);
const sameTarget = (t, row, col) => t && t.row === row && t.col === col;
const SHARDS = Array(12).fill('soul-shard');
// first visit outside test mode shows the tutorial offer; dismiss it
async function openMenu(page) {
  await page.goto('/');
  const offer = page.getByRole('dialog', { name: 'Welcome to Oreheart!' });
  await expect(offer).toBeVisible();
  await offer.getByRole('button', { name: 'Skip' }).click();
  await expect(offer).toBeHidden();
}

const LIMITED = new Set([
  'goblin-bomber', 'goblin-sneak', 'wolf-rider', 'grubnaks-big-boss-troll',
  'clockwork-beetle', 'gnome-illusionist', 'gyrocopter-ace', 'the-great-steam-golem',
  'ironhammer-berserker', 'brewmaster', 'ram-rider', 'queen-brunhilda-stonebeard',
  'overclocked-conduit', 'crystal-drunk-delver', 'fireball', 'battle-cry', 'meteor-strike',
  'second-wind', 'hold-it', 'spell-snap', 'mirror-hex', 'glowing-geode', 'heart-of-the-fallen', 'motherlode',
]);
const CRYSTALS = new Set(['soul-shard', 'crystal-cluster', 'glowing-geode', 'heart-of-the-fallen', 'motherlode']);
const SPELLS = new Set(['prospectors-prayer', 'tunnel-rush', 'fireball', 'battle-cry', 'meteor-strike', 'healing-light',
  'shield-bubble', 'second-wind', 'fizzle', 'hold-it', 'spell-snap', 'mirror-hex']);
const CREATURES = ['goblin-scrounger', 'goblin-scrapper', 'goblin-slinger', 'goblin-bomber', 'goblin-sneak', 'wolf-rider',
  'grubnaks-big-boss-troll', 'gnome-prospector', 'gnome-tinker', 'spark-gnome', 'clockwork-beetle', 'gnome-illusionist',
  'gyrocopter-ace', 'the-great-steam-golem', 'dwarf-miner', 'shieldbeard', 'axe-thrower', 'ironhammer-berserker',
  'brewmaster', 'ram-rider', 'queen-brunhilda-stonebeard', 'shard-guzzler', 'overclocked-conduit', 'crystal-drunk-delver'];

// ---------- AC1 ----------
test('AC1: main menu has exactly Play, Tutorial, Rules, Settings and no page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openMenu(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
  const buttons = page.getByRole('button');
  await expect(buttons).toHaveCount(4);
  const names = (await buttons.allInnerTexts()).map((t) => t.trim());
  expect(names).toEqual(['Play', 'Tutorial', 'Rules', 'Settings']);
  await expect(page.getByRole('button', { name: /play/i })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /play/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose Your Commander' })).toBeVisible();
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
  await page.getByRole('button', { name: 'Play', exact: true }).click();
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
test('AC3: Rules page with pictures and Back', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  expect(await page.getByRole('img').count()).toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
});

// ---------- AC4 ----------
test('AC4: Settings graphics toggle switches and persists', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Graphics: High' }).click();
  await expect(page.getByRole('button', { name: 'Graphics: Low' })).toBeVisible();
  await page.reload();
  const settingsBtn = page.getByRole('button', { name: 'Settings', exact: true });
  if (await settingsBtn.isVisible()) await settingsBtn.click();
  await expect(page.getByRole('button', { name: 'Graphics: Low' })).toBeVisible();
  await page.getByRole('button', { name: 'Graphics: Low' }).click();
  await expect(page.getByRole('button', { name: 'Graphics: High' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
});

// ---------- AC5 ----------
test('AC5: window.oreheart only in test mode; seeds are deterministic', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeAttached();
  expect(await page.evaluate(() => typeof window.oreheart)).toBe('undefined');
  const hands = async (seedUrl, opts) => {
    await openTest(page, seedUrl);
    const s = await newMatch(page, opts);
    return [s.players.player.hand.map((c) => c.cardId), s.players.opponent.hand.map((c) => c.cardId)];
  };
  expect(await hands(42, { ai: false, firstPlayer: 'player' })).toEqual(await hands(42, { ai: false, firstPlayer: 'player' }));
  expect(await hands(1, { ai: false, firstPlayer: 'player', seed: 99 })).toEqual(await hands(5, { ai: false, firstPlayer: 'player', seed: 99 }));
});

// ---------- AC6 ----------
for (const cmd of ['grubnak', 'sproingle', 'borgo']) {
  test(`AC6: ${cmd} starter deck is 40 creatures, 6 spells (with Fizzle), 4 Crystal cards`, async ({ page }) => {
    const s = await start(page, { playerCommander: cmd, ai: false, firstPlayer: 'player' });
    expect(s.phase).toBe('mulligan');
    const p = s.players.player;
    expect(p.health).toBe(20);
    expect(s.players.opponent.health).toBe(20);
    expect(p.hand.length).toBe(5);
    const all = [...p.deck, ...p.hand].map((c) => c.cardId);
    expect(all.length).toBe(50);
    expect(all.filter((id) => CRYSTALS.has(id)).length).toBe(4);
    expect(all.filter((id) => SPELLS.has(id)).length).toBe(6);
    expect(all.includes('fizzle')).toBe(true);
    expect(all.filter((id) => !SPELLS.has(id) && !CRYSTALS.has(id)).length).toBe(40);
    const counts = {};
    for (const id of all) counts[id] = (counts[id] || 0) + 1;
    for (const [id, n] of Object.entries(counts)) if (LIMITED.has(id)) expect(n, id).toBeLessThanOrEqual(3);
  });
}

// ---------- AC7 ----------
test('AC7: opening — 0 starting crystals, turn 1 gives exactly 1, extra card for second player', async ({ page }) => {
  let s = await start(page, { playerCommander: 'grubnak', opponentCommander: 'borgo', ai: false, firstPlayer: 'player' });
  expect(s.phase).toBe('mulligan');
  expect(s.priority).toBe('player');
  expect((await act(page, { type: 'mulligan', uids: [] })).ok).toBe(true);
  s = await getState(page);
  if (s.phase === 'mulligan') {
    expect(s.priority).toBe('opponent');
    expect((await act(page, { type: 'mulligan', uids: [] })).ok).toBe(true);
    s = await getState(page);
  }
  expect(s.turn).toBe(1);
  expect(s.activePlayer).toBe('player');
  expect(s.phase).toBe('deploy');
  expect(s.players.player.hand.length).toBe(5);
  expect(s.players.opponent.hand.length).toBe(6);
  expect(s.players.player.crystals).toEqual({ green: 1, blue: 0, purple: 0 });
  expect(s.players.opponent.crystals).toEqual({ green: 0, blue: 0, purple: 0 });
  await passTurn(page);
  s = await getState(page);
  expect(s.turn).toBe(2);
  expect(s.activePlayer).toBe('opponent');
  expect(s.phase).toBe('deploy');
  expect(s.players.opponent.hand.length).toBe(7);
  expect(s.players.opponent.crystals).toEqual({ green: 0, blue: 0, purple: 1 });
});

// ---------- AC8 ----------
test('AC8: HUD elements, 30/45 second timers, Done advances Deploy -> Action -> Enemy turn', async ({ page }) => {
  await start(page, { ai: false, setup: { playerCrystals: { green: 4 }, playerHealth: 17, opponentHealth: 12 } });
  const phase = page.getByLabel('Current phase', { exact: true });
  const timer = page.getByLabel('Phase timer', { exact: true });
  await expect(phase).toContainText('Deploy');
  await expect(phase).toContainText(/Your turn/i);
  await expect(timer).toHaveText(/\b30\b/);
  await expect(page.getByLabel('Your green crystals', { exact: true })).toHaveText(/\b4\b/);
  await expect(page.getByLabel('Your blue crystals', { exact: true })).toHaveText(/\b0\b/);
  await expect(page.getByLabel('Your purple crystals', { exact: true })).toHaveText(/\b0\b/);
  await expect(page.getByLabel('Your Commander health', { exact: true })).toContainText('17');
  await expect(page.getByLabel('Enemy Commander health', { exact: true })).toContainText('12');
  const doneBtn = page.getByRole('button', { name: 'Done' });
  await doneBtn.click();
  await expect(phase).toContainText('Action');
  await expect(timer).toHaveText(/\b45\b/);
  expect((await getState(page)).phase).toBe('action');
  await doneBtn.click();
  await expect(phase).toContainText(/Enemy turn/i);
  expect((await getState(page)).activePlayer).toBe('opponent');
});

// ---------- AC9 ----------
test('AC9: majority control with Gatherer bonus (exact income)', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    setup: {
      playerDeck: SHARDS, opponentDeck: SHARDS,
      board: [
        { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1 },
        { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 2 },
      ],
    },
  });
  expect(s.sites[0].controller).toBe('player');
  await passTurn(page);
  s = await getState(page);
  expect(total(s.players.opponent.crystals)).toBe(3); // enemy holds a site: 1 + 2 underdog
  await passTurn(page);
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(s.sites.map((x) => x.controller)).toEqual(['player', null, null]);
  expect(s.players.player.crystals.green).toBe(4); // 1 stronghold + 1 site + 2 gatherer
});

test('AC9: tie means nobody controls; no underdog bonus while nobody holds a site', async ({ page }) => {
  await start(page, {
    ai: false,
    setup: {
      playerDeck: SHARDS, opponentDeck: SHARDS,
      board: [
        { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1 },
        { cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1 },
      ],
    },
  });
  await passTurn(page);
  let s = await getState(page);
  expect(total(s.players.opponent.crystals)).toBe(1);
  await passTurn(page);
  s = await getState(page);
  expect(s.sites[0].controller).toBe(null);
  expect(s.players.player.crystals.green).toBe(1);
});

test('AC9: underdog bonus +2 when the enemy controls a site', async ({ page }) => {
  await start(page, {
    ai: false,
    setup: { playerDeck: SHARDS, opponentDeck: SHARDS, board: [{ cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1 }] },
  });
  await passTurn(page);
  let s = await getState(page);
  expect(s.sites[0].controller).toBe('opponent');
  expect(s.players.opponent.crystals.blue).toBe(2); // 1 + 1 site
  await passTurn(page);
  s = await getState(page);
  expect(s.players.player.crystals.green).toBe(3); // 1 + 2 underdog
});

test('AC9: shared column 3 counts for two sites', async ({ page }) => {
  await start(page, {
    ai: false,
    setup: { playerDeck: SHARDS, opponentDeck: SHARDS, board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 3 }] },
  });
  await passTurn(page);
  await passTurn(page);
  const s = await getState(page);
  expect(s.sites.map((x) => x.controller)).toEqual(['player', 'player', null]);
  expect(s.players.player.crystals.green).toBe(3); // 1 + 1 + 1
});

// ---------- AC10 ----------
test('AC10: back-row summoning, Grubnak discount, summoning sickness, Wolf Rider', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    setup: { playerHand: ['goblin-scrapper', 'goblin-scrounger', 'wolf-rider'], playerCrystals: { green: 10 } },
  });
  const scrapper = handUid(s, 'player', 'goblin-scrapper');
  const scrounger = handUid(s, 'player', 'goblin-scrounger');
  const wolf = handUid(s, 'player', 'wolf-rider');
  const summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.length).toBeGreaterThan(0);
  expect(summons.every((a) => a.row === 7)).toBe(true); // back row only; no Tunnel (no sites held)
  expect(summons.some((a) => a.uid === scrapper && a.row === 7 && a.col === 1)).toBe(true);
  expect(summons.some((a) => a.row === 7 && a.col === 4)).toBe(false); // stronghold
  expect(summons.some((a) => a.uid === scrounger && a.row === 3)).toBe(false);
  expect((await act(page, { type: 'summon', uid: scrapper, row: 6, col: 1 })).ok).toBe(false);
  expect((await act(page, { type: 'summon', uid: scrapper, row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 1).cardId).toBe('goblin-scrapper');
  expect(at(s, 7, 1).summonedThisTurn).toBe(true);
  expect(s.players.player.crystals.green).toBe(9); // 2 - 1 Grubnak
  expect((await act(page, { type: 'summon', uid: wolf, row: 7, col: 2 })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals.green).toBe(6); // 4 - 1
  await done(page); // -> action
  const acts = await legal(page);
  expect(acts.some((a) => (a.type === 'move' || a.type === 'attack') && a.creatureUid === at(s, 7, 1).uid)).toBe(false);
  expect(acts.some((a) => a.type === 'move' && a.creatureUid === at(s, 7, 2).uid)).toBe(true);
});

test('AC10: row in front only when the back row is full; nothing when both are full', async ({ page }) => {
  const row7 = [1, 2, 3, 5, 6, 7].map((col, i) => ({ cardId: 'goblin-scrapper', owner: i === 0 ? 'opponent' : 'player', row: 7, col }));
  let s = await start(page, { ai: false, setup: { playerHand: ['goblin-slinger'], playerCrystals: { green: 5 }, board: row7 } });
  let summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.row === 6 && a.col === 1)).toBe(true);
  expect(summons.every((a) => a.row === 6)).toBe(true);
  const row6 = [1, 2, 3, 4, 5, 6, 7].map((col) => ({ cardId: 'goblin-scrapper', owner: 'player', row: 6, col }));
  s = await newMatch(page, { ai: false, setup: { playerHand: ['goblin-slinger'], playerCrystals: { green: 5 }, board: [...row7, ...row6] } });
  summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.length).toBe(0);
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 5, col: 1 })).ok).toBe(false);
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
  expect((await legal(page)).some((a) => a.type === 'summon' && a.uid === queen)).toBe(false);
  expect((await act(page, { type: 'summon', uid: queen, row: 7, col: 1 })).ok).toBe(false);
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'shieldbeard'), row: 7, col: 2 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 2).maxHealth).toBe(5);
  expect(at(s, 7, 2).health).toBe(5);
  expect(at(s, 6, 7).maxHealth).toBe(7);
});

// ---------- AC11 ----------
test('AC11: Tunnel only while the enemy controls more sites', async ({ page }) => {
  const hand = { playerHand: ['goblin-scrounger'], playerCrystals: { green: 5 } };
  let s = await start(page, { ai: false, setup: { ...hand } });
  let summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.row === 3 && a.col === 3)).toBe(false);
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 3, col: 3 })).ok).toBe(false);

  s = await newMatch(page, { ai: false, setup: { ...hand, board: [
    { cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1 },
    { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 7 },
  ] } });
  expect(s.sites.map((x) => x.controller)).toEqual(['opponent', null, 'player']);
  summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.row === 3 && a.col === 3)).toBe(false); // 1 vs 1: equal

  s = await newMatch(page, { ai: false, setup: { ...hand, board: [{ cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1 }] } });
  summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.row === 3 && a.col === 3)).toBe(true);
  expect(summons.some((a) => a.row === 5 && a.col === 4)).toBe(true);
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 3, col: 3 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 3, 3).cardId).toBe('goblin-scrounger');
});

// ---------- AC12 ----------
test('AC12: movement in 8 directions, move 2 only for move-2 creatures', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    setup: { board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 2 },
      { cardId: 'wolf-rider', owner: 'player', row: 6, col: 6 },
      { cardId: 'goblin-slinger', owner: 'player', row: 5, col: 2 },
    ] },
  });
  await done(page); // -> action
  const scrap = at(s, 6, 2).uid;
  const wolf = at(s, 6, 6).uid;
  const moves = (await legal(page)).filter((a) => a.type === 'move');
  expect(moves.some((a) => a.creatureUid === scrap && a.row === 5 && a.col === 1)).toBe(true);
  expect(moves.some((a) => a.creatureUid === scrap && a.row === 5 && a.col === 2)).toBe(false);
  expect(moves.some((a) => a.creatureUid === scrap && a.row === 4 && a.col === 2)).toBe(false);
  expect(moves.some((a) => a.creatureUid === wolf && a.row === 4 && a.col === 6)).toBe(false);
  expect(moves.some((a) => a.creatureUid === wolf && a.row === 4 && a.col === 7)).toBe(true);
  expect((await act(page, { type: 'move', creatureUid: scrap, row: 4, col: 1 })).ok).toBe(false);
  expect((await act(page, { type: 'move', creatureUid: scrap, row: 6, col: 3 })).ok).toBe(true);
  expect((await act(page, { type: 'move', creatureUid: wolf, row: 4, col: 7 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 3).uid).toBe(scrap);
  expect(at(s, 4, 7).uid).toBe(wolf);
  expect((await act(page, { type: 'move', creatureUid: scrap, row: 6, col: 4 })).ok).toBe(false);
});

test('AC12: each creature moves OR attacks, never both; Ram Rider (Charge) can do both', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'borgo',
    setup: { board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 3, col: 3 },
      { cardId: 'goblin-scrapper', owner: 'player', row: 3, col: 5 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 2, col: 4 },
      { cardId: 'ram-rider', owner: 'player', row: 4, col: 7 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 2, col: 6 },
    ] },
  });
  await done(page);
  const a = at(s, 3, 3).uid;
  const b = at(s, 3, 5).uid;
  const ram = at(s, 4, 7).uid;
  // A moves (still next to the Miner) -> may no longer attack
  expect((await act(page, { type: 'move', creatureUid: a, row: 2, col: 3 })).ok).toBe(true);
  let acts = await legal(page);
  expect(acts.some((x) => x.type === 'attack' && x.creatureUid === a)).toBe(false);
  expect((await act(page, { type: 'attack', creatureUid: a, target: { row: 2, col: 4 } })).ok).toBe(false);
  // B attacks -> may no longer move
  expect((await act(page, { type: 'attack', creatureUid: b, target: { row: 2, col: 4 } })).ok).toBe(true);
  acts = await legal(page);
  expect(acts.some((x) => x.type === 'move' && x.creatureUid === b)).toBe(false);
  expect((await act(page, { type: 'move', creatureUid: b, row: 4, col: 5 })).ok).toBe(false);
  // Ram Rider moves next to the second Miner, then attacks
  expect((await act(page, { type: 'move', creatureUid: ram, row: 3, col: 7 })).ok).toBe(true);
  acts = await legal(page);
  expect(acts.some((x) => x.type === 'attack' && x.creatureUid === ram && sameTarget(x.target, 2, 6))).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: ram, target: { row: 2, col: 6 } })).ok).toBe(true);
});

// ---------- AC13 ----------
test('AC13: simultaneous hits — 1/2 beats 1/1, two 1/1s defeat each other', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'grubnak',
    setup: { board: [
      { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1 },
      { cardId: 'goblin-scrounger', owner: 'opponent', row: 3, col: 1, damage: 1 },
      { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 7, damage: 1 },
      { cardId: 'goblin-scrounger', owner: 'opponent', row: 3, col: 7, damage: 1 },
    ] },
  });
  expect(at(s, 3, 1).health).toBe(1);
  await done(page);
  // move into range is not allowed after attacking, so attack from 2 away is melee-invalid; first step up
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 1).uid, target: { row: 3, col: 1 } })).ok).toBe(false);
  s = await newMatch(page, {
    ai: false, playerCommander: 'grubnak', opponentCommander: 'grubnak',
    setup: { board: [
      { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1 },
      { cardId: 'goblin-scrounger', owner: 'opponent', row: 4, col: 1, damage: 1 },
      { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 7, damage: 1 },
      { cardId: 'goblin-scrounger', owner: 'opponent', row: 4, col: 7, damage: 1 },
    ] },
  });
  await done(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 1).uid, target: { row: 4, col: 1 } })).ok).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 7).uid, target: { row: 4, col: 7 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 1)).toBeUndefined();
  expect(at(s, 5, 1).health).toBe(1); // struck back even though defeated
  expect(at(s, 4, 7)).toBeUndefined();
  expect(at(s, 5, 7)).toBeUndefined();
  expect(s.players.opponent.discard.filter((c) => c.cardId === 'goblin-scrounger').length).toBe(2);
  expect(s.players.player.discard.filter((c) => c.cardId === 'goblin-scrounger').length).toBe(1);
});

test('AC13: Shieldbeard vs Scrapper — type advantage defeats it, strike back still lands', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'borgo',
    opponentCommander: 'grubnak',
    setup: { board: [
      { cardId: 'shieldbeard', owner: 'player', row: 5, col: 4 },
      { cardId: 'goblin-scrapper', owner: 'opponent', row: 4, col: 3 },
    ] },
  });
  await done(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 4).uid, target: { row: 4, col: 3 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 3)).toBeUndefined();
  expect(at(s, 5, 4).health).toBe(3); // 4 + 1 Borgo - 2 strike back
  expect(s.players.opponent.discard.some((c) => c.cardId === 'goblin-scrapper')).toBe(true);
});

test('AC13: strike back with type advantage defeats the attacker', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'borgo',
    setup: { board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 3, col: 5 },
      { cardId: 'shieldbeard', owner: 'opponent', row: 2, col: 5 },
    ] },
  });
  await done(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 3, 5).uid, target: { row: 2, col: 5 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 2, 5).health).toBe(3); // 5 - 2
  expect(at(s, 3, 5)).toBeUndefined(); // strike back 2 + 1 = 3
  expect(s.players.player.discard.some((c) => c.cardId === 'goblin-scrapper')).toBe(true);
});

test('AC13: Guard forces adjacent melee attackers to hit it', async ({ page }) => {
  const s = await start(page, {
    ai: false,
    opponentCommander: 'borgo',
    setup: { board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 3, col: 4 },
      { cardId: 'shieldbeard', owner: 'opponent', row: 2, col: 3 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 2, col: 5 },
    ] },
  });
  await done(page);
  const atk = (await legal(page)).filter((a) => a.type === 'attack' && a.creatureUid === at(s, 3, 4).uid);
  expect(atk.some((a) => sameTarget(a.target, 2, 3))).toBe(true);
  expect(atk.some((a) => sameTarget(a.target, 2, 5))).toBe(false);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 3, 4).uid, target: { row: 2, col: 5 } })).ok).toBe(false);
});

test('AC13: Ranged hits 2 away with no strike back, blocked by a creature in between', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    opponentCommander: 'borgo',
    setup: { board: [
      { cardId: 'goblin-slinger', owner: 'player', row: 5, col: 1 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 3, col: 1 },
      { cardId: 'goblin-slinger', owner: 'player', row: 5, col: 7 },
      { cardId: 'shieldbeard', owner: 'opponent', row: 4, col: 7 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 3, col: 7 },
    ] },
  });
  await done(page);
  const left = at(s, 5, 1).uid;
  const right = at(s, 5, 7).uid;
  const acts = (await legal(page)).filter((a) => a.type === 'attack');
  expect(acts.some((a) => a.creatureUid === right && sameTarget(a.target, 3, 7))).toBe(false);
  expect(acts.some((a) => a.creatureUid === left && sameTarget(a.target, 3, 1))).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: left, target: { row: 3, col: 1 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 3, 1).health).toBe(3); // 3 + 1 Borgo - 1
  expect(at(s, 5, 1).health).toBe(2); // no strike back
});

// ---------- AC14 ----------
test('AC14: creatures heal at the start of their owner\'s turn; damaged Health is marked', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'borgo',
    opponentCommander: 'grubnak',
    setup: { playerDeck: SHARDS, opponentDeck: SHARDS, board: [
      { cardId: 'shieldbeard', owner: 'player', row: 5, col: 4 },
      { cardId: 'goblin-scrapper', owner: 'opponent', row: 4, col: 3 },
      { cardId: 'goblin-scrapper', owner: 'player', row: 3, col: 6 },
      { cardId: 'shieldbeard', owner: 'opponent', row: 2, col: 6, damage: 0 },
    ] },
  });
  const label = page.getByLabel('Shieldbeard, row 5, column 4', { exact: true });
  await expect(label).toHaveAttribute('data-damaged', 'false');
  await done(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 4).uid, target: { row: 4, col: 3 } })).ok).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 3, 6).uid, target: { row: 2, col: 6 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 5, 4).health).toBe(3);
  expect(at(s, 2, 6).health).toBe(3); // opponent Shieldbeard: 4 - 2 (Grubnak gives no Health)
  await expect(label).toHaveAttribute('data-damaged', 'true');
  await expect(label).toContainText('3');
  await done(page); // -> opponent's turn 2
  s = await getState(page);
  expect(s.activePlayer).toBe('opponent');
  expect(at(s, 2, 6).health).toBe(4); // opponent's creature healed at its owner's turn
  expect(at(s, 5, 4).health).toBe(3); // ours stays damaged during the enemy turn
  await passTurn(page); // -> player's turn 3
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(at(s, 5, 4).health).toBe(5);
  await expect(label).toHaveAttribute('data-damaged', 'false');
});

// ---------- AC15 ----------
test('AC15: Gnome Tinker gives Shield 1, which blocks exactly 1 damage', async ({ page }) => {
  await start(page, {
    ai: false,
    playerCommander: 'sproingle',
    opponentCommander: 'borgo',
    setup: { playerDeck: SHARDS, opponentDeck: SHARDS, board: [
      { cardId: 'gnome-tinker', owner: 'player', row: 6, col: 1 },
      { cardId: 'spark-gnome', owner: 'player', row: 6, col: 2 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 5, col: 3 },
    ] },
  });
  let s = await getState(page);
  expect(at(s, 6, 2).shield).toBe(0);
  await passTurn(page);
  await passTurn(page); // player's turn 3: Fix-it
  s = await getState(page);
  expect(at(s, 6, 2).shield).toBe(1);
  expect(at(s, 6, 1).shield).toBe(0);
  await passTurn(page); // opponent's turn 4: shield still there
  s = await getState(page);
  expect(s.activePlayer).toBe('opponent');
  expect(at(s, 6, 2).shield).toBe(1);
  await done(page); // -> action
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 3).uid, target: { row: 6, col: 2 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 2).health).toBe(2); // 1 damage fully blocked
  expect(at(s, 6, 2).shield).toBe(0);
  expect(at(s, 5, 3).health).toBe(1); // Miner 3 + 1 Borgo - (2 + 1 type advantage)
});

// ---------- AC16 ----------
test('AC16: Commander damage equals Attack and never resets', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'borgo',
    setup: {
      playerDeck: SHARDS, opponentDeck: SHARDS,
      playerHand: ['battle-cry'],
      playerCrystals: { purple: 7 },
      board: [
        { cardId: 'queen-brunhilda-stonebeard', owner: 'player', row: 2, col: 3 },
        { cardId: 'goblin-scrapper', owner: 'player', row: 2, col: 5 },
      ],
    },
  });
  const queen = at(s, 2, 3).uid;
  const scrap = at(s, 2, 5).uid;
  await done(page);
  expect((await legal(page)).some((a) => a.type === 'attack' && a.creatureUid === queen && a.target && a.target.commander === 'opponent')).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: queen, target: { commander: 'opponent' } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(15); // exactly 5
  await expect(page.getByLabel('Enemy Commander health', { exact: true })).toContainText('15');
  expect((await act(page, { type: 'attack', creatureUid: scrap, target: { commander: 'opponent' } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(13); // exactly 2
  await passTurn(page);
  await passTurn(page);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(13); // never resets
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'battle-cry') })).ok).toBe(true);
  await done(page);
  expect((await act(page, { type: 'attack', creatureUid: queen, target: { commander: 'opponent' } })).ok).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: scrap, target: { commander: 'opponent' } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(4); // 13 - 6 - 3
});

// ---------- AC17 ----------
test('AC17: Fireball deals 3 damage and can be paid with any color', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'borgo',
    setup: { playerHand: ['fireball'], playerCrystals: { blue: 5 }, board: [{ cardId: 'shieldbeard', owner: 'opponent', row: 3, col: 4 }] },
  });
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'fireball'), target: { row: 3, col: 4 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 3, 4).health).toBe(2);
  expect(total(s.players.player.crystals)).toBe(0);
  expect(s.players.player.discard.some((c) => c.cardId === 'fireball')).toBe(true);
});

test('AC17: only one Crystal card per turn', async ({ page }) => {
  let s = await start(page, { ai: false, setup: { playerHand: ['soul-shard', 'soul-shard'] } });
  const [a, b] = s.players.player.hand.map((c) => c.uid);
  expect((await act(page, { type: 'playCrystal', uid: a })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals.green).toBe(1);
  expect((await legal(page)).some((x) => x.type === 'playCrystal')).toBe(false);
  expect((await act(page, { type: 'playCrystal', uid: b })).ok).toBe(false);
  expect((await getState(page)).players.player.crystals.green).toBe(1);
});

test('AC17: upgrades cost 6, one per creature; Heavy Armor adds +3 Health', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    setup: { playerCrystals: { green: 12 }, board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 },
      { cardId: 'goblin-slinger', owner: 'player', row: 6, col: 6 },
    ] },
  });
  const uid = at(s, 6, 3).uid;
  expect((await act(page, { type: 'upgrade', creatureUid: uid, upgrade: 'sharpened-weapons' })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 3).attack).toBe(3);
  expect(at(s, 6, 3).upgrade).toBe('sharpened-weapons');
  expect(s.players.player.crystals.green).toBe(6);
  expect((await legal(page)).some((x) => x.type === 'upgrade' && x.creatureUid === uid)).toBe(false);
  expect((await act(page, { type: 'upgrade', creatureUid: uid, upgrade: 'heavy-armor' })).ok).toBe(false);
  expect((await act(page, { type: 'upgrade', creatureUid: at(s, 6, 6).uid, upgrade: 'heavy-armor' })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 6).maxHealth).toBe(5);
  expect(at(s, 6, 6).health).toBe(5);
  expect(s.players.player.crystals.green).toBe(0);
});
// ---------- AC18 ----------
test('AC18: Fizzle counters Fireball; crystals still spent', async ({ page }) => {
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

test('AC18: Hold It! returns a summoned creature to hand', async ({ page }) => {
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
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrapper'), row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse && s.pendingResponse.responder).toBe('opponent');
  expect((await act(page, { type: 'respond', uid: handUid(s, 'opponent', 'hold-it') })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 1)).toBeUndefined();
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

test('AC18: Respond dialog — Let it happen', async ({ page }) => {
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

test('AC18: Respond dialog — cast Shield Bubble saves the creature', async ({ page }) => {
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

// ---------- AC19 ----------
test('AC19: deck-out deals 1 damage per failed draw', async ({ page }) => {
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

// ---------- AC20 ----------
test('AC20: reducing enemy Commander to 0 shows Victory!', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    setup: { opponentHealth: 2, board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 2, col: 4 }] },
  });
  await done(page);
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

test('AC20: surrender from the match menu shows Defeat', async ({ page }) => {
  await start(page, { ai: false, skipMulligan: true, firstPlayer: 'player' });
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Surrender' }).click();
  await expect(page.getByText('Surrender this match?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, surrender' }).click();
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible({ timeout: 15000 });
  const s = await getState(page);
  expect(s.winner).toBe('opponent');
});

test('AC20: surrender action via API', async ({ page }) => {
  await start(page, { ai: false, skipMulligan: true, firstPlayer: 'player' });
  expect((await act(page, { type: 'surrender' })).ok).toBe(true);
  const s = await getState(page);
  expect(s.winner).toBe('opponent');
  expect(s.phase).toBe('over');
});

// ---------- AC21 ----------
for (const difficulty of ['easy', 'normal']) {
  test(`AC21: ${difficulty} AI completes its turn and hands it back`, async ({ page }) => {
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

test('AC21: Normal AI defeats a passive player before turn 60', async ({ page }) => {
  test.setTimeout(180000);
  await start(page, { ai: true, difficulty: 'normal', skipMulligan: true, firstPlayer: 'player', opponentCommander: 'grubnak', playerCommander: 'sproingle' });
  const result = await page.evaluate(async () => {
    const o = window.oreheart;
    const deadline = Date.now() + 160000;
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
  expect(result.turn).toBeLessThan(60);
});

// ---------- AC22 ----------
test('AC22: hand cards are buttons and open a card view', async ({ page }) => {
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

// ---------- AC23 ----------
test('AC23: illegal actions are rejected and state is unchanged', async ({ page }) => {
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

// ---------- AC24 ----------
test.describe('landscape phone viewport', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('AC24: menu and match fit a landscape phone screen', async ({ page }) => {
    await page.goto('/?test=1');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeInViewport();
    await expect(page.getByText('Please rotate your phone')).toBeHidden();
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

test.describe('portrait phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('AC24: upright phone shows the rotate message', async ({ page }) => {
    await page.goto('/?test=1');
    await expect(page.getByText('Please rotate your phone')).toBeVisible();
    await page.waitForFunction(() => !!window.oreheart);
    await newMatch(page, { ai: false, skipMulligan: true, firstPlayer: 'player' });
    await expect(page.getByText('Please rotate your phone')).toBeVisible();
  });
});

// ---------- AC25 ----------
test('AC25: first visit offers the tutorial; Skip is remembered', async ({ page }) => {
  await page.goto('/');
  const offer = page.getByRole('dialog', { name: 'Welcome to Oreheart!' });
  await expect(offer).toBeVisible();
  await expect(offer.getByRole('button', { name: 'Start Tutorial' })).toBeVisible();
  await offer.getByRole('button', { name: 'Skip' }).click();
  await expect(offer).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(offer).toBeHidden();
});

test('AC25: Tutorial button opens the guided match with tips and Skip Tutorial', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  const tip = page.getByLabel('Tutorial tip', { exact: true });
  await expect(tip).toBeVisible();
  await expect(tip).toContainText(/back row/i);
  await page.getByRole('button', { name: 'Skip Tutorial' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
});

test('AC25: tutorial steps start at summon and advance after a back-row summon', async ({ page }) => {
  await openTest(page);
  let s = await page.evaluate(async () => {
    await window.oreheart.startTutorial();
    return await window.oreheart.getState();
  });
  expect(s.tutorial && s.tutorial.step).toBe('summon');
  expect(s.activePlayer).toBe('player');
  expect(s.phase).toBe('deploy');
  await expect(page.getByLabel('Tutorial tip', { exact: true })).toBeVisible();
  const summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.length).toBeGreaterThan(0);
  expect(summons.every((a) => a.row === 7)).toBe(true);
  expect((await act(page, summons[0])).ok).toBe(true);
  s = await getState(page);
  expect(s.tutorial.step).toBe('move');
});

// ---------- AC26 ----------
test('AC26: printed creature Health is at most 6', async ({ page }) => {
  const spaces = [];
  for (const row of [2, 3, 5, 6]) for (let col = 1; col <= 7; col++) spaces.push({ row, col });
  const board = CREATURES.map((cardId, i) => ({ cardId, owner: 'player', ...spaces[i] }));
  const s = await start(page, { ai: false, playerCommander: 'sproingle', setup: { board } });
  expect(s.board.creatures.length).toBe(CREATURES.length);
  for (const c of s.board.creatures) {
    expect(c.maxHealth, c.cardId).toBeLessThanOrEqual(6);
    expect(c.health, c.cardId).toBe(c.maxHealth);
  }
  for (const id of ['grubnaks-big-boss-troll', 'the-great-steam-golem', 'queen-brunhilda-stonebeard']) {
    expect(s.board.creatures.find((c) => c.cardId === id).maxHealth, id).toBe(6);
  }
});
