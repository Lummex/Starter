import { test, expect } from '@playwright/test';

// ---------- helpers ----------
async function openTest(page, seed = 123) {
  await page.goto(`/?test=1&seed=${seed}`);
  await page.waitForFunction(() => !!window.oreheart);
}
// fixed mine layout used by setup tests (a legal "all three on row 4" layout)
const OLD_MINES = [{ row: 4, col: 2 }, { row: 4, col: 4 }, { row: 4, col: 6 }];
const [M1, M2, M3] = OLD_MINES;
async function newMatch(page, opts) {
  const withMines = opts && opts.setup && !opts.mines ? { ...opts, mines: OLD_MINES } : opts;
  return page.evaluate(async (o) => {
    await window.oreheart.newMatch(o);
    return await window.oreheart.getState();
  }, withMines);
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
const total = (cr) => (cr.green || 0) + (cr.blue || 0) + (cr.purple || 0) + (cr.white || 0);
const ZERO = { green: 0, blue: 0, purple: 0, white: 0 };
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
  await expect(page.getByRole('button', { name: /^(Goblins|Gnomes|Dwarves)$/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /faction/i })).toHaveCount(0);
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
    const basic = { grubnak: 'goblin-scrounger', sproingle: 'gnome-prospector', borgo: 'dwarf-miner' }[cmd];
    expect(counts[basic]).toBe(5);
    const smith = { grubnak: 'goblin-smith-miner', sproingle: 'gnome-smith-miner', borgo: 'dwarf-smith-miner' }[cmd];
    expect(counts[smith]).toBe(3);
    const creatureIds = all.filter((id) => !SPELLS.has(id) && !CRYSTALS.has(id));
    const costs = await page.evaluate(async (ids) => {
      const out = [];
      for (const id of ids) out.push((await window.oreheart.getCard(id)).cost);
      return out;
    }, creatureIds);
    expect(costs.filter((c) => c <= 4).length).toBeGreaterThanOrEqual(16);
  });
}

// ---------- AC7 ----------
test('AC7: opening — start with 0 crystals, pool resets to flow, extra card for second player', async ({ page }) => {
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
  expect(s.players.player.crystals).toEqual(ZERO);
  expect(s.players.opponent.crystals).toEqual(ZERO);
  await passTurn(page);
  s = await getState(page);
  expect(s.turn).toBe(2);
  expect(s.activePlayer).toBe('opponent');
  expect(s.phase).toBe('deploy');
  expect(s.players.opponent.hand.length).toBe(7);
  expect(s.players.opponent.crystals).toEqual(ZERO);
  await passTurn(page);
  s = await getState(page);
  expect(s.turn).toBe(3);
  expect(s.players.player.crystals).toEqual(ZERO); // no flow, no Stronghold income
  const cfg = await page.evaluate(async () => await window.oreheart.getConfig());
  expect(cfg.startingCrystals).toBe(0);
  expect(cfg.poolCap).toBe(16);
  expect(cfg.gathererFlow).toBe(2);
  expect(cfg.fighterFlow).toBe(1);
  expect(cfg.underdogBonus).toBe(2);
  expect(cfg.strongholdIncome || 0).toBe(0);
  expect(cfg.phaseTimerSeconds).toBe(50);
  expect(cfg.timerHiddenSeconds).toBe(40);
  expect(cfg.countdownSeconds).toBe(10);
  expect(cfg.boardWidth).toBe(13);
  expect(cfg.boardHeight).toBe(7);
  expect(cfg.mineCount).toBe(3);
});

// ---------- AC8 ----------
test('AC8: HUD elements, hidden timer, Done advances Deploy -> Action -> Enemy turn', async ({ page }) => {
  await start(page, { ai: false, setup: { playerCrystals: { green: 4, white: 2 }, playerHealth: 17, opponentHealth: 12 } });
  const phase = page.getByLabel('Current phase', { exact: true });
  const timer = page.getByLabel('Phase timer', { exact: true });
  await expect(phase).toContainText('Deploy');
  await expect(phase).toContainText(/Your turn/i);
  await expect(timer).toBeHidden();
  await expect(page.getByLabel('Your green crystals', { exact: true })).toHaveText(/\b4\b/);
  await expect(page.getByLabel('Your blue crystals', { exact: true })).toHaveText(/\b0\b/);
  await expect(page.getByLabel('Your purple crystals', { exact: true })).toHaveText(/\b0\b/);
  await expect(page.getByLabel('Your white crystals', { exact: true })).toHaveText(/\b2\b/);
  await expect(page.getByLabel('Your Commander health', { exact: true })).toContainText('17');
  await expect(page.getByLabel('Enemy Commander health', { exact: true })).toContainText('12');
  const doneBtn = page.getByRole('button', { name: 'Done' });
  await doneBtn.click();
  await expect(phase).toContainText('Action');
  await expect(timer).toBeHidden();
  expect((await getState(page)).phase).toBe('action');
  await doneBtn.click();
  await expect(phase).toContainText(/Enemy turn/i);
  expect((await getState(page)).activePlayer).toBe('opponent');
});

// ---------- AC9 (Crystal Flow) ----------
test('AC9: example (a) — 1 Gnome Miner vs 2 Goblin Miners: mine is green, Goblins get 4 green, Gnomes 2 green', async ({ page }) => {
  let s = await start(page, {
    ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak',
    setup: {
      firstPlayer: 'opponent', playerDeck: SHARDS, opponentDeck: SHARDS,
      board: [
        { cardId: 'gnome-prospector', owner: 'player', row: 3, col: 2, minedMine: M1 },
        { cardId: 'goblin-scrounger', owner: 'opponent', row: 5, col: 1, minedMine: M1 },
        { cardId: 'goblin-scrounger', owner: 'opponent', row: 5, col: 2, minedMine: M1 },
      ],
    },
  });
  expect(s.sites[0].controller).toBe('opponent');
  expect(s.sites.map((x) => x.color)).toEqual(['green', 'white', 'white']);
  expect(s.players.opponent.flow).toEqual({ ...ZERO, green: 4 });
  expect(s.players.player.flow).toEqual({ ...ZERO, green: 2 });
  await passTurn(page); // -> player's turn 2
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(s.players.player.crystals).toEqual({ ...ZERO, green: 2, blue: 2 }); // 2 green flow + 2 blue underdog
  await passTurn(page); // -> opponent's turn 3
  s = await getState(page);
  expect(s.players.opponent.crystals).toEqual({ ...ZERO, green: 4 });
});

test('AC9: off-color crystals are worth half toward creatures (rounded down)', async ({ page }) => {
  let s = await start(page, {
    ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak',
    setup: {
      playerHand: ['gnome-prospector', 'gnome-prospector'], playerCrystals: { green: 2 },
      board: [{ cardId: 'gnome-prospector', owner: 'player', row: 6, col: 1 }],
    },
  });
  const [p1, p2] = s.players.player.hand.map((c) => c.uid);
  expect((await act(page, { type: 'summon', uid: p1, row: 7, col: 1 })).ok).toBe(true); // 2 green = 1
  s = await getState(page);
  expect(s.players.player.crystals).toEqual(ZERO);
  expect((await act(page, { type: 'summon', uid: p2, row: 7, col: 2 })).ok).toBe(false);
  // 9 green is worth 4: not enough for a 5-cost Spark Gnome
  s = await newMatch(page, { ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak', setup: { playerHand: ['spark-gnome'], playerCrystals: { green: 9 } } });
  expect((await legal(page)).some((a) => a.type === 'summon')).toBe(false);
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(false);
  // 1 blue + 8 green = 5: own color is used first
  s = await newMatch(page, { ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak', setup: { playerHand: ['spark-gnome'], playerCrystals: { green: 9, blue: 1 } } });
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals).toEqual({ ...ZERO, green: 1 });
});

test('AC9: example (b) — 2 vs 2 tie: mine is white, 4 white is worth 2 toward creatures and 4 toward spells', async ({ page }) => {
  let s = await start(page, {
    ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle',
    setup: {
      firstPlayer: 'opponent', playerDeck: SHARDS, opponentDeck: SHARDS,
      playerHand: ['goblin-scrounger', 'goblin-scrounger', 'goblin-scrounger', 'battle-cry'],
      board: [
        { cardId: 'goblin-scrounger', owner: 'player', row: 3, col: 1, minedMine: M1 },
        { cardId: 'goblin-scrounger', owner: 'player', row: 3, col: 2, minedMine: M1 },
        { cardId: 'gnome-prospector', owner: 'opponent', row: 5, col: 1, minedMine: M1 },
        { cardId: 'gnome-prospector', owner: 'opponent', row: 5, col: 2, minedMine: M1 },
      ],
    },
  });
  expect(s.sites[0].controller).toBe(null);
  expect(s.sites[0].color).toBe('white');
  expect(s.players.player.flow).toEqual({ ...ZERO, white: 4 });
  expect(s.players.opponent.flow).toEqual({ ...ZERO, white: 4 });
  await passTurn(page); // -> player's turn 2
  s = await getState(page);
  expect(s.players.player.crystals).toEqual({ ...ZERO, white: 4 }); // no underdog: no mine in the enemy's color
  const bc = handUid(s, 'player', 'battle-cry');
  expect((await legal(page)).some((a) => a.type === 'cast' && a.uid === bc)).toBe(true); // 4 toward spells
  const g = s.players.player.hand.filter((c) => c.cardId === 'goblin-scrounger').map((c) => c.uid);
  expect((await act(page, { type: 'summon', uid: g[0], row: 7, col: 1 })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals.white).toBe(2);
  expect((await act(page, { type: 'summon', uid: g[1], row: 7, col: 2 })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals.white).toBe(0);
  expect((await act(page, { type: 'summon', uid: g[2], row: 7, col: 3 })).ok).toBe(false);
});

test('AC9: examples (c) and (d) — pool is set to flow, unspent crystals last through the enemy turn', async ({ page }) => {
  let s = await start(page, {
    ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak',
    setup: {
      playerDeck: SHARDS, opponentDeck: SHARDS,
      board: [
        { cardId: 'gnome-prospector', owner: 'player', row: 3, col: 1, minedMine: M1 },
        { cardId: 'gnome-prospector', owner: 'player', row: 4, col: 1, minedMine: M1 },
        { cardId: 'gnome-prospector', owner: 'player', row: 5, col: 1, minedMine: M1 },
        { cardId: 'goblin-scrapper', owner: 'opponent', row: 2, col: 1 },
      ],
    },
  });
  expect(s.sites[0].color).toBe('blue');
  expect(s.players.player.flow.blue).toBe(6);
  await passTurn(page);
  await passTurn(page); // player's turn 3
  s = await getState(page);
  expect(s.turn).toBe(3);
  expect(s.players.player.crystals).toEqual({ ...ZERO, blue: 6 });
  expect(s.players.player.flow).toEqual(ZERO); // last turn's mining is paid out; nobody has mined yet
  await done(page); // -> action; the Miner on row 3 attacks the Scrapper and is defeated
  const m2 = at(s, 4, 1).uid;
  const m3 = at(s, 5, 1).uid;
  expect((await act(page, { type: 'attack', creatureUid: at(s, 3, 1).uid, target: { row: 2, col: 1 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 3, 1)).toBeUndefined();
  // the two remaining Miners mine again
  expect((await act(page, { type: 'mine', creatureUid: m2, row: 4, col: 2 })).ok).toBe(true);
  expect((await act(page, { type: 'mine', creatureUid: m3, row: 4, col: 2 })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.flow.blue).toBe(4);
  await done(page); // -> opponent's turn 4
  s = await getState(page);
  expect(s.activePlayer).toBe('opponent');
  expect(s.players.player.crystals).toEqual({ ...ZERO, blue: 6 }); // still usable on the enemy's turn
  await passTurn(page); // player's turn 5
  s = await getState(page);
  expect(s.players.player.crystals).toEqual({ ...ZERO, blue: 4 }); // reset to flow, not 6 + 4
});

test('AC9: example (e) — the pool never goes above 16', async ({ page }) => {
  let s = await start(page, { ai: false, setup: { playerHand: ['crystal-cluster'], playerCrystals: { green: 15 } } });
  expect((await act(page, { type: 'playCrystal', uid: s.players.player.hand[0].uid })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals).toEqual({ ...ZERO, green: 15 }); // Crystal cards go to the Bank (R6.4)
  expect(s.players.player.bank).toEqual({ ...ZERO, green: 2 });
  const spots = [[3, 1], [4, 1], [5, 1], [3, 2], [5, 2], [3, 6], [5, 6], [3, 7], [4, 7], [5, 7]];
  await newMatch(page, { ai: false, setup: {
    playerDeck: SHARDS, opponentDeck: SHARDS,
    board: spots.map(([row, col]) => ({ cardId: 'goblin-scrounger', owner: 'player', row, col, minedMine: col <= 3 ? M1 : M3 })),
  } });
  await passTurn(page);
  await passTurn(page);
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(s.players.player.crystals).toEqual({ ...ZERO, green: 16 }); // flow 20, capped
});

// ---------- AC39 ----------
test('AC39: mining is an action — Gatherer 2, Fighter 1, nothing without mining; pool set to last turn\'s mining', async ({ page }) => {
  let s = await start(page, { ai: false, setup: {
    playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [
      { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1 },
      { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 3 }, // touches mines (4,2) and (4,4)
      { cardId: 'goblin-scrounger', owner: 'player', row: 3, col: 6 }, // next to (4,6)
    ],
  } });
  expect(s.sites.map((x) => [x.row, x.col])).toEqual([[4, 2], [4, 4], [4, 6]]);
  expect(s.sites.map((x) => x.color)).toEqual(['white', 'white', 'white']); // standing nearby doesn't count
  expect(s.players.player.flow).toEqual(ZERO);
  await done(page); // -> action
  const g = at(s, 5, 1).uid;
  const f = at(s, 5, 3).uid;
  const idle = at(s, 3, 6).uid;
  let acts = await legal(page);
  const canMine = (uid, row, col) => acts.some((a) => a.type === 'mine' && a.creatureUid === uid && a.row === row && a.col === col);
  expect(canMine(g, 4, 2)).toBe(true);
  expect(canMine(g, 4, 4)).toBe(false); // not adjacent
  expect(canMine(f, 4, 2)).toBe(true);
  expect(canMine(f, 4, 4)).toBe(true); // between two mines: the player chooses
  expect((await act(page, { type: 'mine', creatureUid: g, row: 4, col: 4 })).ok).toBe(false);
  expect((await act(page, { type: 'mine', creatureUid: g, row: 4, col: 2 })).ok).toBe(true);
  expect((await act(page, { type: 'mine', creatureUid: f, row: 4, col: 4 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 5, 1).hasMined).toBe(true);
  expect(at(s, 5, 1).minedMine).toMatchObject({ row: 4, col: 2 });
  expect(s.players.player.flow).toEqual({ ...ZERO, green: 3 }); // Gatherer 2 + Fighter 1; the idle Scrounger makes 0
  expect(s.sites.map((x) => x.flow.player)).toEqual([2, 1, 0]);
  // mining is the creature's one action
  acts = await legal(page);
  expect(acts.some((a) => ['move', 'attack', 'mine'].includes(a.type) && a.creatureUid === g)).toBe(false);
  expect((await act(page, { type: 'move', creatureUid: g, row: 6, col: 1 })).ok).toBe(false);
  // a creature that moved can't mine
  expect((await act(page, { type: 'move', creatureUid: idle, row: 3, col: 7 })).ok).toBe(true);
  expect((await act(page, { type: 'mine', creatureUid: idle, row: 4, col: 6 })).ok).toBe(false);
  const label = page.getByLabel('Goblin Miner, row 5, column 1', { exact: true });
  await expect(label).toHaveAttribute('data-mining', 'true');
  await expect(label).toHaveAttribute('data-acted', 'true');
  await done(page); // -> opponent's turn 2
  s = await getState(page);
  expect(s.activePlayer).toBe('opponent');
  expect(s.sites.map((x) => x.color)).toEqual(['green', 'green', 'white']); // colored by miners only
  expect(s.sites[0].controller).toBe('player');
  expect(s.players.player.crystals).toEqual(ZERO); // paid out on the player's own turn
  await passTurn(page); // -> player's turn 3
  s = await getState(page);
  expect(s.turn).toBe(3);
  expect(s.players.player.crystals).toEqual({ ...ZERO, green: 3 }); // set to what was mined
  expect(s.players.player.flow).toEqual(ZERO);
  await expect(label).toHaveAttribute('data-mining', 'false');
  // nobody mines on turn 3 -> the pool on turn 5 is 0 and the mines are white again
  await passTurn(page);
  await passTurn(page);
  s = await getState(page);
  expect(s.turn).toBe(5);
  expect(s.players.player.crystals).toEqual(ZERO);
  expect(s.sites.map((x) => x.color)).toEqual(['white', 'white', 'white']);
});

// ---------- AC10 ----------
test('AC10: back-row summoning, Grubnak discount, summoning sickness, Wolf Rider', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    setup: { playerHand: ['goblin-scrapper', 'goblin-scrounger', 'wolf-rider'], playerCrystals: { green: 20 } },
  });
  const scrapper = handUid(s, 'player', 'goblin-scrapper');
  const scrounger = handUid(s, 'player', 'goblin-scrounger');
  const wolf = handUid(s, 'player', 'wolf-rider');
  const summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.length).toBeGreaterThan(0);
  expect(summons.every((a) => a.row === 7)).toBe(true); // back row only; no Tunnel (no sites held)
  expect(summons.some((a) => a.uid === scrapper && a.row === 7 && a.col === 1)).toBe(true);
  expect(summons.some((a) => a.row === 7 && a.col === 7)).toBe(false); // stronghold
  expect(summons.some((a) => a.uid === scrounger && a.row === 3)).toBe(false);
  expect((await act(page, { type: 'summon', uid: scrapper, row: 6, col: 1 })).ok).toBe(false);
  expect((await act(page, { type: 'summon', uid: scrapper, row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 1).cardId).toBe('goblin-scrapper');
  expect(at(s, 7, 1).summonedThisTurn).toBe(true);
  expect(s.players.player.crystals.green).toBe(15); // Scrapper 6 - 1 Grubnak
  expect((await act(page, { type: 'summon', uid: wolf, row: 7, col: 2 })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals.green).toBe(7); // Wolf Rider 9 - 1
  await done(page); // -> action
  const acts = await legal(page);
  expect(acts.some((a) => (a.type === 'move' || a.type === 'attack') && a.creatureUid === at(s, 7, 1).uid)).toBe(false);
  expect(acts.some((a) => a.type === 'move' && a.creatureUid === at(s, 7, 2).uid)).toBe(true);
});

test('AC10: row in front only when the back row is full; nothing when both are full', async ({ page }) => {
  const row7 = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13].map((col, i) => ({ cardId: 'goblin-scrapper', owner: i === 0 ? 'opponent' : 'player', row: 7, col }));
  let s = await start(page, { ai: false, setup: { playerHand: ['goblin-slinger'], playerCrystals: { green: 5 }, board: row7 } });
  let summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.row === 6 && a.col === 1)).toBe(true);
  expect(summons.every((a) => a.row === 6)).toBe(true);
  const row6 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((col) => ({ cardId: 'goblin-scrapper', owner: 'player', row: 6, col }));
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
      playerHand: ['queen-brunhilda-stonebeard', 'shieldbeard', 'dwarf-miner'],
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
  expect(at(s, 7, 2).attack).toBe(2);
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'dwarf-miner'), row: 7, col: 3 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 3).attack).toBe(1);
  expect(at(s, 7, 3).maxHealth).toBe(2); // Dwarf Miner 1/1 + Borgo = 1/2
  expect(at(s, 7, 3).health).toBe(2);
});

// ---------- AC11 ----------
test('AC11: Tunnel only while more mines are in the enemy color', async ({ page }) => {
  const hand = { playerHand: ['goblin-scrounger'], playerCrystals: { green: 5 } };
  let s = await start(page, { ai: false, setup: { ...hand } });
  let summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.row === 3 && a.col === 3)).toBe(false);
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 3, col: 3 })).ok).toBe(false);

  s = await newMatch(page, { ai: false, setup: { ...hand, board: [
    { cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1, minedMine: M1 },
    { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 7, minedMine: M3 },
  ] } });
  expect(s.sites.map((x) => x.controller)).toEqual(['opponent', null, 'player']);
  expect(s.sites.map((x) => x.color)).toEqual(['blue', 'white', 'green']);
  summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.row === 3 && a.col === 3)).toBe(false); // 1 vs 1: equal

  s = await newMatch(page, { ai: false, setup: { ...hand, board: [{ cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1, minedMine: M1 }] } });
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
      { cardId: 'gnome-tinker', owner: 'opponent', row: 7, col: 1 },
    ] },
  });
  await done(page); // -> action
  const scrap = at(s, 6, 2).uid;
  const wolf = at(s, 6, 6).uid;
  const moves = (await legal(page)).filter((a) => a.type === 'move');
  expect(moves.some((a) => a.creatureUid === scrap && a.row === 5 && a.col === 1)).toBe(true);
  expect(moves.some((a) => a.creatureUid === scrap && a.row === 5 && a.col === 2)).toBe(true); // own creature: a legal swap
  expect(moves.some((a) => a.creatureUid === scrap && a.row === 7 && a.col === 1)).toBe(false); // enemy: never
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
    playerCommander: 'sproingle',
    opponentCommander: 'sproingle',
    setup: { board: [
      { cardId: 'gnome-tinker', owner: 'player', row: 5, col: 1, damage: 1 }, // 1/3 damaged to 1/2
      { cardId: 'gnome-prospector', owner: 'opponent', row: 4, col: 1 }, // 1/1
      { cardId: 'gnome-prospector', owner: 'player', row: 5, col: 7 },
      { cardId: 'gnome-prospector', owner: 'opponent', row: 4, col: 7 },
    ] },
  });
  expect(at(s, 5, 1).health).toBe(2);
  expect(at(s, 4, 1).health).toBe(1);
  await done(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 1).uid, target: { row: 4, col: 1 } })).ok).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 7).uid, target: { row: 4, col: 7 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 1)).toBeUndefined();
  expect(at(s, 5, 1).health).toBe(1); // struck back even though defeated
  expect(at(s, 4, 7)).toBeUndefined();
  expect(at(s, 5, 7)).toBeUndefined();
  expect(s.players.opponent.discard.filter((c) => c.cardId === 'gnome-prospector').length).toBe(2);
  expect(s.players.player.discard.filter((c) => c.cardId === 'gnome-prospector').length).toBe(1);
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

test('AC13: Ranged hits anything within 2 spaces, over creatures, with no strike back', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'borgo',
    opponentCommander: 'borgo',
    setup: { board: [
      { cardId: 'axe-thrower', owner: 'player', row: 5, col: 7 },
      { cardId: 'shieldbeard', owner: 'opponent', row: 4, col: 7 }, // in between
      { cardId: 'dwarf-miner', owner: 'opponent', row: 3, col: 7 }, // 2 straight ahead, behind the Shieldbeard
      { cardId: 'dwarf-miner', owner: 'opponent', row: 3, col: 6 }, // knight-move angle
      { cardId: 'dwarf-miner', owner: 'opponent', row: 2, col: 7 }, // 3 away: out of range
      { cardId: 'goblin-slinger', owner: 'player', row: 3, col: 9 }, // 2 from the enemy Stronghold (1,7)
    ] },
  });
  await done(page);
  const axe = at(s, 5, 7).uid;
  const acts = (await legal(page)).filter((a) => a.type === 'attack');
  expect(acts.some((a) => a.creatureUid === axe && sameTarget(a.target, 3, 7))).toBe(true);
  expect(acts.some((a) => a.creatureUid === axe && sameTarget(a.target, 3, 6))).toBe(true);
  expect(acts.some((a) => a.creatureUid === axe && sameTarget(a.target, 4, 7))).toBe(true);
  expect(acts.some((a) => a.creatureUid === axe && sameTarget(a.target, 2, 7))).toBe(false);
  const sling = at(s, 3, 9).uid;
  expect(acts.some((a) => a.creatureUid === sling && a.target && a.target.commander === 'opponent')).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: axe, target: { row: 4, col: 7 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 7).health).toBe(3); // Shieldbeard 4 + 1 Borgo - 2
  expect(at(s, 5, 7).health).toBe(4); // Axe Thrower 3 + 1 Borgo, no strike back
  expect((await act(page, { type: 'attack', creatureUid: sling, target: { commander: 'opponent' } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(19); // exactly 1
  expect(at(s, 3, 9).health).toBe(3); // Slinger 2 + 1 Borgo, untouched
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
  expect(at(s, 2, 6).health).toBe(2); // opponent Shieldbeard: 4 - 2 (Grubnak gives no Health)
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
  expect(at(s, 5, 3)).toBeUndefined(); // Miner 1 + 1 Borgo = 2, struck back for 2 + 1 type advantage
});

// ---------- AC16 ----------
test('AC16: Commander damage equals Attack and never resets', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'borgo',
    setup: {
      playerDeck: SHARDS, opponentDeck: SHARDS,
      playerHand: ['battle-cry'],
      board: [
        { cardId: 'dwarf-miner', owner: 'player', row: 3, col: 7, minedMine: M3 },
        { cardId: 'dwarf-miner', owner: 'player', row: 5, col: 7, minedMine: M3 },
        { cardId: 'queen-brunhilda-stonebeard', owner: 'player', row: 2, col: 6 },
        { cardId: 'goblin-scrapper', owner: 'player', row: 2, col: 8 },
      ],
    },
  });
  const queen = at(s, 2, 6).uid;
  const scrap = at(s, 2, 8).uid;
  await done(page);
  expect((await legal(page)).some((a) => a.type === 'attack' && a.creatureUid === queen && a.target && a.target.commander === 'opponent')).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: queen, target: { commander: 'opponent' } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(15); // exactly 5
  await expect(page.getByLabel('Enemy Commander health', { exact: true })).toContainText('15');
  expect((await act(page, { type: 'attack', creatureUid: scrap, target: { commander: 'opponent' } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(13); // exactly 2
  await done(page); // end the player's Action phase -> opponent's turn 2
  await passTurn(page); // -> player's turn 3, Deploy phase
  s = await getState(page);
  expect(s.phase).toBe('deploy');
  expect(s.players.opponent.health).toBe(13); // never resets
  expect(s.players.player.crystals).toEqual({ ...ZERO, purple: 4 }); // 2 Miners mined 2 each on turn 1: pays Battle Cry (4)
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
    setup: { playerHand: ['fireball'], playerCrystals: { blue: 3 }, board: [{ cardId: 'shieldbeard', owner: 'opponent', row: 3, col: 4 }] },
  });
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'fireball'), target: { row: 3, col: 4 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 3, 4).health).toBe(2);
  expect(total(s.players.player.crystals)).toBe(0);
  expect(s.players.player.discard.some((c) => c.cardId === 'fireball')).toBe(true);
});

test('AC17: only one Crystal card per round; it goes to the Bank', async ({ page }) => {
  let s = await start(page, { ai: false, setup: { playerHand: ['soul-shard', 'soul-shard'], playerDeck: SHARDS, opponentDeck: SHARDS } });
  const [a, b] = s.players.player.hand.map((c) => c.uid);
  expect((await act(page, { type: 'playCrystal', uid: a })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.bank.green).toBe(1);
  expect(s.players.player.crystals).toEqual(ZERO);
  expect((await legal(page)).some((x) => x.type === 'playCrystal')).toBe(false);
  expect((await act(page, { type: 'playCrystal', uid: b })).ok).toBe(false);
  await passTurn(page);
  await passTurn(page);
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(s.phase).toBe('deploy');
  expect((await legal(page)).some((x) => x.type === 'playCrystal' && x.uid === b)).toBe(true);
  expect((await act(page, { type: 'playCrystal', uid: b })).ok).toBe(true);
  expect((await getState(page)).players.player.bank.green).toBe(2);
});
test("AC17: Prospector's Prayer costs 1 and gives 3 own-color crystals only when behind on mines", async ({ page }) => {
  let s = await start(page, { ai: false, setup: { playerHand: ['prospectors-prayer'], playerCrystals: { white: 1 } } });
  expect((await act(page, { type: 'cast', uid: s.players.player.hand[0].uid })).ok).toBe(false); // 0 vs 0 mines
  s = await newMatch(page, { ai: false, setup: {
    playerHand: ['prospectors-prayer'], playerCrystals: { white: 1 },
    board: [{ cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1, minedMine: M1 }],
  } });
  expect((await act(page, { type: 'cast', uid: s.players.player.hand[0].uid })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals).toEqual({ ...ZERO, green: 3 });
});

test('AC17: crystal-bought upgrades are gone', async ({ page }) => {
  await start(page, { ai: false, setup: { playerCrystals: { green: 10 }, board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 }] } });
  expect((await legal(page)).some((x) => x.type === 'upgrade')).toBe(false);
  const s = await getState(page);
  expect((await act(page, { type: 'upgrade', creatureUid: at(s, 6, 3).uid, upgrade: 'sharpened-weapons' })).ok).toBe(false);
  expect((await page.evaluate(async () => await window.oreheart.getConfig())).upgradeCosts).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Upgrade', exact: true })).toHaveCount(0);
});
// ---------- AC18 ----------
test('AC18: Fizzle counters Fireball; crystals still spent', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'borgo',
    setup: {
      playerHand: ['fireball'],
      playerCrystals: { green: 3 },
      opponentHand: ['fizzle'],
      opponentCrystals: { purple: 3 },
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

test('AC18: Fizzle cannot cancel a spell costing more than 3', async ({ page }) => {
  let s = await start(page, {
    ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo',
    setup: { playerHand: ['battle-cry'], playerCrystals: { green: 4 }, opponentHand: ['fizzle'], opponentCrystals: { purple: 3 } },
  });
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'battle-cry') })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse).toBe(null); // Battle Cry costs 4: no usable Instant, so no Respond window
  expect(s.players.opponent.hand.some((c) => c.cardId === 'fizzle')).toBe(true);
});

test('AC18: Hold It! returns a summoned creature to hand', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'borgo',
    setup: {
      playerHand: ['goblin-scrapper'],
      playerCrystals: { green: 5 },
      opponentHand: ['hold-it'],
      opponentCrystals: { purple: 4 },
    },
  });
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrapper'), row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse && s.pendingResponse.responder).toBe('opponent');
  expect((await act(page, { type: 'respond', uid: handUid(s, 'opponent', 'hold-it') })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 1)).toBeUndefined();
  expect(s.players.player.hand.some((c) => c.cardId === 'goblin-scrapper')).toBe(true);
  expect(s.players.player.crystals.green).toBe(0); // Scrapper 6 - 1 Grubnak, still spent
});

const respondSetup = {
  ai: false,
  playerCommander: 'grubnak',
  opponentCommander: 'borgo',
  setup: {
    firstPlayer: 'opponent',
    opponentHand: ['fireball'],
    opponentCrystals: { purple: 3 },
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
    setup: { opponentHealth: 2, board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 2, col: 7 }] },
  });
  await done(page);
  const acts = await legal(page);
  expect(acts.some((a) => a.type === 'attack' && a.target && a.target.commander === 'opponent')).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 2, 7).uid, target: { commander: 'opponent' } })).ok).toBe(true);
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
        if (s.pendingResponse && s.priority === 'player') await act(page, { type: 'pass' });
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
for (const [w, h] of [[844, 390], [740, 360], [667, 375]]) {
  test.describe(`landscape phone viewport ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test(`AC24: menu and full-screen match fit a ${w}x${h} landscape phone`, async ({ page }) => {
      await page.goto('/?test=1');
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeInViewport();
      await expect(page.getByText('Please rotate your phone')).toBeHidden();
      let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await page.waitForFunction(() => !!window.oreheart);
      await newMatch(page, { ai: false, setup: { playerHand: ['fireball', 'goblin-scrapper', 'goblin-slinger'] } });
      const field = page.getByLabel('Battlefield', { exact: true });
      await expect(field).toBeVisible();
      const box = await field.boundingBox();
      expect(box.x).toBeLessThanOrEqual(1);
      expect(box.y).toBeLessThanOrEqual(1);
      expect(box.x + box.width).toBeGreaterThanOrEqual(w - 1);
      expect(box.y + box.height).toBeGreaterThanOrEqual(h - 1);
      await expect(page.getByRole('button', { name: 'Done' })).toBeInViewport();
      await expect(page.getByLabel('Your Commander health', { exact: true })).toBeInViewport();
      await expect(page.getByLabel('Enemy Commander health', { exact: true })).toBeInViewport();
      await expect(page.getByLabel('Current phase', { exact: true })).toBeInViewport();
      if (w === 844) {
        const card = await page.getByRole('button', { name: 'Fireball', exact: true }).boundingBox();
        expect(card.width).toBeGreaterThanOrEqual(60);
        expect(card.height).toBeGreaterThanOrEqual(90);
      }
      overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth - window.innerWidth,
        document.documentElement.scrollHeight - window.innerHeight));
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
}

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
  expect(s.players.player.crystals).toEqual(ZERO); // the first troop is the free Gatherer
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

// ---------- AC27 ----------
const COSTS = {
  'goblin-scrounger': 1, 'goblin-scrapper': 6, 'goblin-slinger': 4, 'goblin-bomber': 5, 'goblin-sneak': 6, 'wolf-rider': 9,
  'grubnaks-big-boss-troll': 13, 'gnome-prospector': 1, 'gnome-tinker': 5, 'spark-gnome': 5, 'clockwork-beetle': 8,
  'gnome-illusionist': 6, 'gyrocopter-ace': 8, 'the-great-steam-golem': 13, 'dwarf-miner': 1, 'shieldbeard': 7,
  'axe-thrower': 6, 'ironhammer-berserker': 8, 'brewmaster': 7, 'ram-rider': 11, 'queen-brunhilda-stonebeard': 13,
  'shard-guzzler': 5, 'overclocked-conduit': 5, 'crystal-drunk-delver': 7,
};
test('AC27: creature costs match the revision 3 table; basic Gatherers are 1/1 for 1', async ({ page }) => {
  await openTest(page);
  const cards = await page.evaluate(async (ids) => {
    const out = {};
    for (const id of ids) out[id] = await window.oreheart.getCard(id);
    return out;
  }, Object.keys(COSTS));
  for (const [id, cost] of Object.entries(COSTS)) expect(cards[id].cost, id).toBe(cost);
  for (const id of ['goblin-scrounger', 'gnome-prospector', 'dwarf-miner']) {
    expect(cards[id].attack, id).toBe(1);
    expect(cards[id].health, id).toBe(1);
  }
});

test('AC27: summoning spends exactly the new costs', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'borgo',
    setup: { playerHand: ['dwarf-miner', 'shieldbeard', 'axe-thrower', 'ram-rider'], playerCrystals: { purple: 30 } },
  });
  const steps = [['dwarf-miner', 1, 29], ['shieldbeard', 2, 22], ['axe-thrower', 3, 16], ['ram-rider', 5, 5]];
  for (const [id, col, left] of steps) {
    expect((await act(page, { type: 'summon', uid: handUid(s, 'player', id), row: 7, col })).ok, id).toBe(true);
    s = await getState(page);
    expect(s.players.player.crystals.purple, id).toBe(left);
  }
  s = await newMatch(page, {
    ai: false, playerCommander: 'grubnak',
    setup: { playerHand: ['goblin-scrounger', 'goblin-scrapper'], playerCrystals: { green: 6 } },
  });
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrounger'), row: 7, col: 1 })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals.green).toBe(5); // minimum 1
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrapper'), row: 7, col: 2 })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals.green).toBe(0); // 6 - 1
});

// ---------- AC28 ----------
test('AC28: phase banner appears when a phase begins', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 } } });
  await page.waitForTimeout(2500); // let opening banners finish
  await page.getByRole('button', { name: 'Done' }).click();
  const dlg = page.getByRole('dialog', { name: /Moves still available/ });
  if (await dlg.isVisible()) await dlg.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByLabel('Phase banner', { exact: true })).toContainText('ACTION');
});

test('AC28: auto-skipped phases show no banner; ENEMY TURN does', async ({ page }) => {
  await openTest(page);
  await page.evaluate(() => {
    window.__banners = [];
    setInterval(() => {
      const e = document.querySelector('[aria-label="Phase banner"]');
      if (e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden') {
        const t = e.textContent.trim().toUpperCase();
        if (t && !window.__banners.includes(t)) window.__banners.push(t);
      }
    }, 50);
  });
  await newMatch(page, { ai: false, autoSkip: true, setup: { playerDeck: SHARDS, opponentDeck: SHARDS } });
  await expect.poll(async () => (await getState(page)).activePlayer, { timeout: 15000 }).toBe('opponent');
  await expect.poll(async () => page.evaluate(() => window.__banners), { timeout: 5000 }).toContain('ENEMY TURN');
  const seen = await page.evaluate(() => window.__banners);
  expect(seen).not.toContain('DEPLOY');
  expect(seen).not.toContain('ACTION');
});

// ---------- AC29 ----------
const movesLeft = (page) => page.evaluate(async () => await window.oreheart.movesLeft());
test('AC29: moves left ignores Instants and the Miner swap', async ({ page }) => {
  await start(page, {
    ai: false,
    setup: {
      playerHand: ['healing-light'], playerCrystals: { green: 10 }, playerDeck: ['goblin-scrounger', ...SHARDS],
      board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 2 }],
    },
  });
  const acts = await legal(page);
  expect(acts.some((a) => a.type === 'gathererSwap')).toBe(true);
  expect(await movesLeft(page)).toBe(false);
  await done(page);
  expect(await movesLeft(page)).toBe(true); // the Scrapper can move
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 } } });
  expect(await movesLeft(page)).toBe(true);
});

test('AC29: with auto-skip on, an empty turn passes by itself; a phase with moves left does not', async ({ page }) => {
  await openTest(page);
  await newMatch(page, { ai: false, autoSkip: true, setup: { playerDeck: SHARDS, opponentDeck: SHARDS } });
  await expect.poll(async () => (await getState(page)).activePlayer, { timeout: 15000 }).toBe('opponent');
  let s = await getState(page);
  expect(s.turn).toBe(2);
  expect(s.phase).toBe('deploy'); // the opponent drew a Soul Shard, so it has a move
  await newMatch(page, { ai: false, autoSkip: true, setup: { playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 } } });
  await page.waitForTimeout(3000);
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(s.phase).toBe('deploy');
});

// ---------- AC30 ----------
test('AC30: creature labels show Attack, Health, Movement and darken after acting', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    setup: {
      playerDeck: SHARDS, opponentDeck: SHARDS, playerHand: ['goblin-scrapper'], playerCrystals: { green: 6 },
      board: [{ cardId: 'wolf-rider', owner: 'player', row: 6, col: 6 }],
    },
  });
  const wolf = page.getByLabel('Wolf Rider, row 6, column 6', { exact: true });
  await expect(wolf).toHaveText(/3\D+4\D+2/);
  await expect(wolf).toHaveAttribute('data-acted', 'false');
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrapper'), row: 7, col: 1 })).ok).toBe(true);
  const scrap = page.getByLabel('Goblin Scrapper, row 7, column 1', { exact: true });
  await expect(scrap).toHaveAttribute('data-acted', 'true');
  await expect(scrap).toHaveText(/2\D+3\D+1/);
  await done(page);
  expect((await act(page, { type: 'move', creatureUid: at(s, 6, 6).uid, row: 5, col: 6 })).ok).toBe(true);
  const moved = page.getByLabel('Wolf Rider, row 5, column 6', { exact: true });
  await expect(moved).toHaveAttribute('data-acted', 'true');
  await done(page); // enemy turn
  await expect(moved).toHaveAttribute('data-acted', 'true');
  await passTurn(page); // player's turn 3
  await expect(moved).toHaveAttribute('data-acted', 'false');
  await expect(scrap).toHaveAttribute('data-acted', 'false');
});

// ---------- AC31 ----------
test('AC31: Moves still available pop-up — Go back and Continue', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 } } });
  const doneBtn = page.getByRole('button', { name: 'Done' });
  const dlg = page.getByRole('dialog', { name: 'Moves still available! Continue to the next phase?' });
  await doneBtn.click();
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Go back' }).click();
  await expect(dlg).toBeHidden();
  expect((await getState(page)).phase).toBe('deploy');
  await doneBtn.click();
  await dlg.getByRole('button', { name: 'Continue' }).click();
  await expect(dlg).toBeHidden();
  expect((await getState(page)).phase).toBe('action');
  await doneBtn.click(); // no creatures: no moves left, no pop-up
  await expect.poll(async () => (await getState(page)).activePlayer).toBe('opponent');
  await expect(dlg).toBeHidden();
});

test('AC31: no pop-up on timeout, and Settings can turn it off', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 } } });
  const dlg = page.getByRole('dialog', { name: /Moves still available/ });
  await page.evaluate(async () => await window.oreheart.setPhaseTimeLeft(0));
  await expect.poll(async () => (await getState(page)).phase).toBe('action');
  await expect(dlg).toBeHidden();
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Moves reminder: On' }).click();
  await expect(page.getByRole('button', { name: 'Moves reminder: Off' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Moves reminder: Off' })).toBeVisible();
  await page.waitForFunction(() => !!window.oreheart);
  await newMatch(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 } } });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(async () => (await getState(page)).phase).toBe('action');
  await expect(dlg).toBeHidden();
});

// ---------- AC32 ----------
test('AC32: countdown appears only in the last 10 seconds; 0 ends just the phase', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 } } });
  const timer = page.getByLabel('Phase timer', { exact: true });
  const setLeft = (n) => page.evaluate(async (x) => await window.oreheart.setPhaseTimeLeft(x), n);
  await expect(timer).toBeHidden();
  await setLeft(11);
  await expect(timer).toBeHidden();
  await setLeft(10);
  await expect(timer).toBeVisible();
  await expect(timer).toHaveText(/\b10\b/);
  await setLeft(3);
  await expect(timer).toHaveText(/\b3\b/);
  await setLeft(0);
  await expect.poll(async () => (await getState(page)).phase).toBe('action');
  const s = await getState(page);
  expect(s.turn).toBe(1);
  expect(s.activePlayer).toBe('player');
  await expect(timer).toBeHidden();
});

// ---------- AC33 ----------
test('AC33: Gatherer swap moves one basic Gatherer from deck to hand, once per turn', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    setup: { playerHand: ['fireball', 'goblin-scrapper'], playerDeck: ['soul-shard', 'goblin-scrounger', 'goblin-scrapper', 'goblin-scrounger'] },
  });
  const fireball = handUid(s, 'player', 'fireball');
  const swaps = (await legal(page)).filter((a) => a.type === 'gathererSwap');
  expect(swaps.length).toBe(2); // one per discardable card
  expect((await act(page, { type: 'gathererSwap', discardUid: fireball })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.hand.map((c) => c.cardId).sort()).toEqual(['goblin-scrapper', 'goblin-scrounger']);
  expect(s.players.player.deck.map((c) => c.cardId)).toEqual(['soul-shard', 'goblin-scrapper', 'goblin-scrounger']);
  expect(s.players.player.discard.map((c) => c.cardId)).toEqual(['fireball']);
  expect((await legal(page)).some((a) => a.type === 'gathererSwap')).toBe(false);
  expect((await act(page, { type: 'gathererSwap', discardUid: handUid(s, 'player', 'goblin-scrapper') })).ok).toBe(false);
  // empty hand: swap without discarding; not in the Action phase
  s = await newMatch(page, { ai: false, setup: { playerDeck: ['soul-shard', 'goblin-scrounger'] } });
  expect((await legal(page)).filter((a) => a.type === 'gathererSwap').length).toBe(1);
  await done(page);
  expect((await act(page, { type: 'gathererSwap' })).ok).toBe(false);
  s = await newMatch(page, { ai: false, setup: { playerDeck: ['soul-shard', 'goblin-scrounger'] } });
  expect((await act(page, { type: 'gathererSwap' })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.hand.map((c) => c.cardId)).toEqual(['goblin-scrounger']);
  expect(s.players.player.deck.length).toBe(1);
  // a Gatherer already in hand: no swap
  await newMatch(page, { ai: false, setup: { playerHand: ['goblin-scrounger', 'fireball'], playerDeck: ['goblin-scrounger'] } });
  expect((await legal(page)).some((a) => a.type === 'gathererSwap')).toBe(false);
});

// ---------- AC34 ----------
test('AC34: free Miner only when Flow + Bank cannot pay and no Miner is on the battlefield', async ({ page }) => {
  let s = await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger', 'goblin-scrounger', 'goblin-scrapper'] } });
  const [g1, g2] = s.players.player.hand.filter((c) => c.cardId === 'goblin-scrounger').map((c) => c.uid);
  const summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.uid === g1)).toBe(true);
  expect(summons.some((a) => a.uid === handUid(s, 'player', 'goblin-scrapper'))).toBe(false);
  expect((await act(page, { type: 'summon', uid: g1, row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 1).cardId).toBe('goblin-scrounger');
  expect(s.players.player.crystals).toEqual(ZERO);
  expect((await act(page, { type: 'summon', uid: g2, row: 7, col: 2 })).ok).toBe(false); // a Miner is now on the battlefield
  // 1 green Flow pays for it: not free
  s = await newMatch(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 } } });
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals).toEqual(ZERO);
  // 1 green Bank pays for it: not free
  s = await newMatch(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerBank: { green: 1 } } });
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(true);
  expect((await getState(page)).players.player.bank).toEqual(ZERO);
  // 1 white is worth 0 toward a Goblin creature: still free, and the white stays
  s = await newMatch(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: { white: 1 } } });
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals).toEqual({ ...ZERO, white: 1 });
  // a mine in your color doesn't matter any more
  s = await newMatch(page, { ai: false, setup: {
    playerHand: ['goblin-scrounger'], board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 1, minedMine: M1 }],
  } });
  expect(s.sites[0].controller).toBe('player');
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(true);
  // a Smith Miner on the battlefield counts as a Miner: not free
  s = await newMatch(page, { ai: false, setup: {
    playerHand: ['goblin-scrounger'], board: [{ cardId: 'goblin-smith-miner', owner: 'player', row: 6, col: 1 }],
  } });
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(false);
  // a Smith Miner card is never free
  s = await newMatch(page, { ai: false, setup: { playerHand: ['goblin-smith-miner'] } });
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(false);
});
// ---------- AC35 ----------
test('AC35: a Gatherer summoned this turn can move or mine but not attack; a Fighter can do nothing', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    setup: {
      playerHand: ['goblin-scrounger', 'goblin-slinger'], playerCrystals: { green: 4 },
      board: [{ cardId: 'gnome-tinker', owner: 'opponent', row: 6, col: 2 }],
    },
  });
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrounger'), row: 7, col: 1 })).ok).toBe(true);
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-slinger'), row: 7, col: 3 })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals.green).toBe(0); // Scrounger 1 + Slinger 4 - 1 Grubnak
  await expect(page.getByLabel('Goblin Miner, row 7, column 1', { exact: true })).toHaveAttribute('data-acted', 'false'); // stays bright
  await expect(page.getByLabel('Goblin Slinger, row 7, column 3', { exact: true })).toHaveAttribute('data-acted', 'true'); // summoning sickness
  await done(page);
  const g = at(s, 7, 1).uid;
  const sl = at(s, 7, 3).uid;
  const acts = await legal(page);
  expect(acts.some((a) => a.type === 'move' && a.creatureUid === g && a.row === 6 && a.col === 1)).toBe(true);
  expect(acts.some((a) => a.type === 'attack' && a.creatureUid === g)).toBe(false);
  expect(acts.some((a) => (a.type === 'move' || a.type === 'attack') && a.creatureUid === sl)).toBe(false);
  expect((await act(page, { type: 'attack', creatureUid: g, target: { row: 6, col: 2 } })).ok).toBe(false);
  expect((await act(page, { type: 'move', creatureUid: g, row: 6, col: 1 })).ok).toBe(true);
  expect(at(await getState(page), 6, 1).uid).toBe(g);
  // freshly summoned next to a mine: the Gatherer may mine, the Fighter may not
  s = await newMatch(page, { ai: false, setup: { board: [
    { cardId: 'goblin-scrounger', owner: 'player', row: 4, col: 1, summonedThisTurn: true },
    { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 3, summonedThisTurn: true },
  ] } });
  await done(page);
  const acts2 = await legal(page);
  expect(acts2.some((a) => a.type === 'mine' && a.creatureUid === at(s, 4, 1).uid && a.row === 4 && a.col === 2)).toBe(true);
  expect(acts2.some((a) => ['move', 'attack', 'mine'].includes(a.type) && a.creatureUid === at(s, 5, 3).uid)).toBe(false);
  expect((await act(page, { type: 'mine', creatureUid: at(s, 4, 1).uid, row: 4, col: 2 })).ok).toBe(true);
});

// ---------- AC36 ----------
test('AC36: flow preview, mine ring numbers and mine info', async ({ page }) => {
  await start(page, { ai: false, setup: {} });
  const preview = page.getByLabel('Your income next turn', { exact: true });
  await expect(preview).toHaveText(/^\s*\+0 next turn\s*$/);
  await newMatch(page, { ai: false, setup: { board: [
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 },
    { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 2, minedMine: M1 },
    { cardId: 'goblin-scrounger', owner: 'player', row: 3, col: 6 }, // next to a mine but not mining
  ] } });
  await expect(preview).toHaveText(/^\s*\+3 next turn\s*$/);
  await page.getByRole('button', { name: 'Crystal site, row 4, column 2', exact: true }).click();
  const info = page.getByRole('dialog', { name: 'Crystal site' });
  await expect(info).toBeVisible();
  await expect(info).toContainText('Controlled by: You');
  await expect(info).toContainText('Color: Green');
  await expect(info).toContainText('Your flow: +3');
  await expect(info).toContainText('Enemy flow: +0');
  await info.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Crystal site, row 4, column 6', exact: true }).click();
  await expect(info).toContainText('Controlled by: Nobody');
  await expect(info).toContainText('Color: White');
  await info.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByLabel('Mine flow, row 4, column 2', { exact: true })).toContainText('+3');
  // underdog bonus is part of the preview: 0 flow + 2 = "+2 next turn"
  await newMatch(page, { ai: false, setup: { board: [{ cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1, minedMine: M1 }] } });
  await expect(preview).toHaveText(/^\s*\+2 next turn\s*$/);
});

// ---------- AC38 ----------
test('AC38: swapping places with your own creature uses only the dragged creature\'s action', async ({ page }) => {
  let s = await start(page, { ai: false, setup: { board: [
    { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 2 },
    { cardId: 'goblin-slinger', owner: 'player', row: 6, col: 3 },
    { cardId: 'gnome-tinker', owner: 'opponent', row: 5, col: 2 },
  ] } });
  const a = at(s, 6, 2).uid;
  const b = at(s, 6, 3).uid;
  await done(page); // -> action
  let acts = await legal(page);
  expect(acts.some((x) => x.type === 'move' && x.creatureUid === a && x.row === 6 && x.col === 3)).toBe(true);
  expect(acts.some((x) => x.type === 'move' && x.creatureUid === a && x.row === 5 && x.col === 2)).toBe(false); // never with enemies
  expect((await act(page, { type: 'move', creatureUid: a, row: 6, col: 3 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 3).uid).toBe(a);
  expect(at(s, 6, 2).uid).toBe(b);
  expect(at(s, 6, 3).hasMoved).toBe(true);
  expect(at(s, 6, 2).hasMoved).toBe(false);
  acts = await legal(page);
  expect(acts.some((x) => (x.type === 'move' || x.type === 'attack') && x.creatureUid === a)).toBe(false);
  expect((await act(page, { type: 'move', creatureUid: b, row: 7, col: 2 })).ok).toBe(true);
  expect(at(await getState(page), 7, 2).uid).toBe(b);
});

// ---------- AC37 ----------
test('AC37: the confirm pop-up sits above the countdown', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: { green: 1 } } });
  await page.evaluate(async () => await window.oreheart.setPhaseTimeLeft(5));
  await expect(page.getByLabel('Phase timer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  const dlg = page.getByRole('dialog', { name: 'Moves still available! Continue to the next phase?' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Continue' }).click(); // fails if covered by the countdown
  await expect.poll(async () => (await getState(page)).phase).toBe('action');
});

// ---------- AC40 ----------
test('AC40: 13 x 7 board; 3 random, mirrored mines from the seed; fixed tutorial layout', async ({ page }) => {
  await openTest(page);
  const cheb = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  const layouts = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const s = await newMatch(page, { ai: false, seed, skipMulligan: true });
    const m = s.sites.map((x) => ({ row: x.row, col: x.col }));
    expect(m.length, `seed ${seed}`).toBe(3);
    for (const a of m) {
      expect(a.row >= 3 && a.row <= 5 && a.col >= 1 && a.col <= 13, `seed ${seed}`).toBe(true);
      expect(m.some((b) => b.row === 8 - a.row && b.col === a.col), `mirror, seed ${seed}`).toBe(true);
      expect(cheb(a, { row: 1, col: 7 }) >= 2 && cheb(a, { row: 7, col: 7 }) >= 2).toBe(true);
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(cheb(m[i], m[j]), `spacing, seed ${seed}`).toBeGreaterThanOrEqual(2);
    expect([1, 3]).toContain(m.filter((a) => a.row === 4).length);
    const sorted = [...m].sort((a, b) => a.row - b.row || a.col - b.col);
    expect(m).toEqual(sorted); // reading order
    const again = await newMatch(page, { ai: false, seed, skipMulligan: true });
    expect(again.sites.map((x) => ({ row: x.row, col: x.col }))).toEqual(m);
    layouts.push(JSON.stringify(m));
  }
  expect(new Set(layouts).size).toBeGreaterThan(1);
  // board bounds: columns 1-13, Stronghold at column 7
  const s = await newMatch(page, { ai: false, setup: { playerHand: ['goblin-scrounger'] } });
  const summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.row === 7 && a.col === 13)).toBe(true);
  expect(summons.some((a) => a.row === 7 && a.col === 7)).toBe(false);
  expect(summons.every((a) => a.col >= 1 && a.col <= 13)).toBe(true);
  const uid = s.players.player.hand[0].uid;
  expect((await act(page, { type: 'summon', uid, row: 7, col: 14 })).ok).toBe(false);
  expect((await act(page, { type: 'summon', uid, row: 7, col: 13 })).ok).toBe(true);
  // the tutorial always uses the same layout
  const tut = async () => page.evaluate(async () => {
    await window.oreheart.startTutorial();
    return (await window.oreheart.getState()).sites.map((x) => [x.row, x.col]);
  });
  const t1 = await tut();
  await openTest(page, 999);
  expect(await tut()).toEqual(t1);
});

// ---------- AC41 ----------
test('AC41: the moves pop-up names miners that have not mined', async ({ page }) => {
  let s = await start(page, { ai: false, setup: { board: [
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1 },
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 2 },
  ] } });
  await done(page); // -> action
  expect(await movesLeft(page)).toBe(true);
  const doneBtn = page.getByRole('button', { name: 'Done' });
  const dlg = page.getByRole('dialog', { name: 'Moves still available! Continue to the next phase?' });
  await doneBtn.click();
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText("2 miners haven't mined");
  await dlg.getByRole('button', { name: 'Go back' }).click();
  await expect(dlg).toBeHidden();
  expect((await act(page, { type: 'mine', creatureUid: at(s, 5, 1).uid, row: 4, col: 2 })).ok).toBe(true);
  await doneBtn.click();
  await expect(dlg).toContainText("1 miner hasn't mined");
  await dlg.getByRole('button', { name: 'Continue' }).click();
  await expect.poll(async () => (await getState(page)).activePlayer).toBe('opponent');
});

// ---------- AC42 ----------
test('AC42: Ranged creatures show the bow icon on the board and in the hand', async ({ page }) => {
  await start(page, { ai: false, setup: {
    playerHand: ['goblin-slinger', 'goblin-scrapper'],
    board: [
      { cardId: 'goblin-slinger', owner: 'player', row: 6, col: 1 },
      { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 },
    ],
  } });
  await expect(page.getByLabel('Goblin Slinger, row 6, column 1', { exact: true })).toContainText('🏹');
  await expect(page.getByLabel('Goblin Scrapper, row 6, column 3', { exact: true })).not.toContainText('🏹');
  const hand = page.getByLabel('Your hand', { exact: true });
  await expect(hand.getByRole('button', { name: 'Goblin Slinger' })).toContainText('🏹');
  await expect(hand.getByRole('button', { name: 'Goblin Scrapper' })).not.toContainText('🏹');
});

test.describe('landscape layout details', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  // ---------- AC43 ----------
  test('AC43: hovering a hand card slides it up out of the fan', async ({ page }) => {
    await start(page, { ai: false, setup: { playerHand: ['fireball', 'goblin-scrapper', 'goblin-slinger'] } });
    const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Goblin Scrapper' });
    await expect(card).toBeVisible();
    await page.mouse.move(422, 150);
    await page.waitForTimeout(500);
    const before = await card.boundingBox();
    await card.hover();
    await expect.poll(async () => before.y - (await card.boundingBox()).y).toBeGreaterThanOrEqual(30);
  });

  // ---------- AC44 ----------
  test('AC44: deck piles on each player\'s right and Commander hearts', async ({ page }) => {
    await start(page, { ai: false, setup: { playerDeck: SHARDS, opponentDeck: SHARDS.slice(0, 5) } });
    const mine = page.getByLabel('Your deck', { exact: true });
    const theirs = page.getByLabel('Enemy deck', { exact: true });
    await expect(mine).toBeVisible();
    await expect(theirs).toBeVisible();
    await expect(mine).toContainText('12');
    await expect(theirs).toContainText('5');
    const a = await mine.boundingBox();
    const b = await theirs.boundingBox();
    expect(a.x + a.width / 2).toBeGreaterThan(422); // bottom-right
    expect(a.y + a.height / 2).toBeGreaterThan(195);
    expect(b.x + b.width / 2).toBeLessThan(422); // top-left
    expect(b.y + b.height / 2).toBeLessThan(195);
    await expect(page.getByLabel('Your Commander health', { exact: true })).toContainText('20');
    await expect(page.getByLabel('Enemy Commander health', { exact: true })).toContainText('20');
  });
});

// ---------- Revision 6 (AC45–AC51) ----------
test('AC45: Miner names, roles and badges', async ({ page }) => {
  await start(page, { ai: false, setup: {
    playerHand: ['goblin-scrounger', 'goblin-scrapper', 'goblin-smith-miner'],
    board: [
      { cardId: 'goblin-scrounger', owner: 'player', row: 6, col: 1 },
      { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 2 },
    ],
  } });
  const cards = await page.evaluate(async () => {
    const out = {};
    for (const id of ['goblin-scrounger', 'gnome-prospector', 'dwarf-miner', 'goblin-smith-miner', 'gnome-smith-miner', 'dwarf-smith-miner']) {
      out[id] = await window.oreheart.getCard(id);
    }
    return out;
  });
  expect(cards['goblin-scrounger'].name).toBe('Goblin Miner');
  expect(cards['gnome-prospector'].name).toBe('Gnome Miner');
  expect(cards['dwarf-miner'].name).toBe('Dwarf Miner');
  for (const [id, name, faction] of [['goblin-smith-miner', 'Goblin Smith Miner', 'goblins'], ['gnome-smith-miner', 'Gnome Smith Miner', 'gnomes'], ['dwarf-smith-miner', 'Dwarf Smith Miner', 'dwarves']]) {
    expect(cards[id].name).toBe(name);
    expect(cards[id].faction).toBe(faction);
    expect(cards[id].role).toBe('smith');
    expect(cards[id].type).toBe('creature');
    expect([cards[id].cost, cards[id].attack, cards[id].health, cards[id].move]).toEqual([2, 1, 1, 1]);
  }
  const hand = page.getByLabel('Your hand', { exact: true });
  await expect(hand.getByRole('button', { name: 'Goblin Miner', exact: true })).toContainText('⛏');
  await expect(hand.getByRole('button', { name: 'Goblin Scrapper', exact: true })).toContainText('⚔');
  await expect(hand.getByRole('button', { name: 'Goblin Scrapper', exact: true })).not.toContainText('⛏');
  const smith = hand.getByRole('button', { name: 'Goblin Smith Miner', exact: true });
  await expect(smith).toContainText('⚒');
  await expect(smith).toContainText('SMITH');
  await expect(page.getByLabel('Goblin Miner, row 6, column 1', { exact: true })).toContainText('⛏');
  await expect(page.getByLabel('Goblin Scrapper, row 6, column 2', { exact: true })).not.toContainText('⛏');
});

const smithSetup = (n, blue) => ({
  ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak',
  setup: {
    playerHand: Array(n).fill('gnome-smith-miner'), playerCrystals: { blue },
    playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [{ cardId: 'gnome-tinker', owner: 'player', row: 6, col: 3, damage: 1 }],
  },
});

test('AC46: Smith Miner upgrades stack, persist and heal; summoned Smith is a Miner', async ({ page }) => {
  let s = await start(page, smithSetup(4, 8));
  const base = await page.evaluate(async () => await window.oreheart.getCard('gnome-tinker'));
  const tinker = at(s, 6, 3).uid;
  const smiths = s.players.player.hand.map((c) => c.uid);
  expect(at(s, 6, 3).upgrades).toEqual({ attack: 0, health: 0 });
  expect((await legal(page)).some((a) => a.type === 'smith' && a.creatureUid === tinker && a.stat === 'attack')).toBe(true);
  expect(await page.evaluate(async () => await window.oreheart.movesLeft())).toBe(true); // the summon counts, not the upgrade
  expect((await act(page, { type: 'smith', uid: smiths[0], creatureUid: tinker, stat: 'attack' })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 3).attack).toBe(base.attack + 1);
  expect(s.players.player.crystals).toEqual({ ...ZERO, blue: 6 });
  expect((await act(page, { type: 'smith', uid: smiths[1], creatureUid: tinker, stat: 'health' })).ok).toBe(true);
  s = await getState(page);
  const t = at(s, 6, 3);
  expect(t.maxHealth).toBe(base.health + 1);
  expect(t.health).toBe(base.health); // was damaged by 1, +1 Health
  expect(t.upgrades).toEqual({ attack: 1, health: 1 });
  expect(s.board.creatures.length).toBe(1);
  expect(s.players.player.crystals).toEqual({ ...ZERO, blue: 4 });
  expect(s.players.player.discard.filter((c) => c.cardId === 'gnome-smith-miner').length).toBe(2);
  await expect(page.getByLabel('Gnome Tinker, row 6, column 3', { exact: true })).toHaveAttribute('data-upgrades', '2');
  // summoned on the back row: a normal Miner that may move this turn
  expect((await act(page, { type: 'summon', uid: smiths[2], row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  const sm = at(s, 7, 1);
  expect(sm.cardId).toBe('gnome-smith-miner');
  expect(s.players.player.crystals).toEqual({ ...ZERO, blue: 2 });
  await done(page);
  expect((await legal(page)).some((a) => a.type === 'move' && a.creatureUid === sm.uid)).toBe(true);
  expect((await legal(page)).some((a) => a.type === 'attack' && a.creatureUid === sm.uid)).toBe(false);
  expect((await act(page, { type: 'smith', uid: smiths[3], creatureUid: tinker, stat: 'attack' })).ok).toBe(false); // Deploy only
  await done(page);
  await passTurn(page);
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  const t2 = at(s, 6, 3);
  expect(t2.attack).toBe(base.attack + 1);
  expect(t2.maxHealth).toBe(base.health + 1);
  expect(t2.health).toBe(base.health + 1); // healed up to the raised max
  expect(t2.upgrades).toEqual({ attack: 1, health: 1 });
});

test('AC46: dropping a Smith Miner on your creature asks +1 Attack or +1 Health', async ({ page }) => {
  let s = await start(page, smithSetup(1, 2));
  const base = await page.evaluate(async () => await window.oreheart.getCard('gnome-tinker'));
  await page.waitForTimeout(2000); // let opening banners finish
  const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Gnome Smith Miner', exact: true });
  const label = page.getByLabel('Gnome Tinker, row 6, column 3', { exact: true });
  const a = await card.boundingBox();
  const b = await label.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height + 12, { steps: 15 });
  await page.mouse.up();
  const dlg = page.getByRole('dialog', { name: 'Smith upgrade' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('button', { name: '+1 Health' })).toBeVisible();
  await dlg.getByRole('button', { name: '+1 Attack' }).click();
  await expect(dlg).toBeHidden();
  await expect.poll(async () => at(await getState(page), 6, 3).attack).toBe(base.attack + 1);
});

test('AC47: Crystal Bank persists, has no cap and is spent after Flow', async ({ page }) => {
  let s = await start(page, { ai: false, playerCommander: 'grubnak', setup: {
    playerHand: ['goblin-slinger'], playerCrystals: { green: 2 }, playerBank: { green: 3 },
    playerDeck: SHARDS, opponentDeck: SHARDS,
  } });
  expect(s.players.player.bank).toEqual({ ...ZERO, green: 3 });
  await expect(page.getByLabel('Your green crystals', { exact: true })).toContainText('Flow 2');
  await expect(page.getByLabel('Your green crystals', { exact: true })).toContainText('Bank 3');
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(true); // 4 - 1 Grubnak = 3
  s = await getState(page);
  expect(s.players.player.crystals).toEqual(ZERO);
  expect(s.players.player.bank).toEqual({ ...ZERO, green: 2 });
  await passTurn(page);
  await passTurn(page);
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(s.players.player.crystals).toEqual(ZERO); // Flow reset to last turn's mining
  expect(s.players.player.bank).toEqual({ ...ZERO, green: 2 }); // Bank kept
  await expect(page.getByLabel('Your green crystals', { exact: true })).toContainText('Bank 2');
  // no cap on the Bank
  s = await newMatch(page, { ai: false, setup: { playerHand: ['crystal-cluster'], playerBank: { green: 20 } } });
  expect((await act(page, { type: 'playCrystal', uid: s.players.player.hand[0].uid })).ok).toBe(true);
  expect((await getState(page)).players.player.bank).toEqual({ ...ZERO, green: 22 });
});

test('AC48: playing a Crystal card never ends the phase or turn', async ({ page }) => {
  let s = await start(page, { ai: false, autoSkip: true, setup: { playerHand: ['soul-shard', 'goblin-scrapper'], playerCrystals: { green: 4 } } });
  const before = { turn: s.turn, phase: s.phase, activePlayer: s.activePlayer };
  expect(before.phase).toBe('deploy');
  expect((await act(page, { type: 'playCrystal', uid: handUid(s, 'player', 'soul-shard') })).ok).toBe(true);
  s = await getState(page);
  expect({ turn: s.turn, phase: s.phase, activePlayer: s.activePlayer }).toEqual(before);
  await page.waitForTimeout(2000);
  s = await getState(page);
  expect({ turn: s.turn, phase: s.phase, activePlayer: s.activePlayer }).toEqual(before);
  expect((await legal(page)).some((a) => a.type === 'summon')).toBe(true); // 4 Flow + 1 Bank pays the Scrapper (6 - 1)
  // not in your own Action phase
  s = await newMatch(page, { ai: false, setup: { playerHand: ['soul-shard'], board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 }] } });
  await done(page);
  expect((await getState(page)).phase).toBe('action');
  expect((await legal(page)).some((a) => a.type === 'playCrystal')).toBe(false);
  expect((await act(page, { type: 'playCrystal', uid: s.players.player.hand[0].uid })).ok).toBe(false);
});

const respondR6 = (playerHand, playerCrystals) => ({
  ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo',
  setup: {
    firstPlayer: 'opponent', opponentHand: ['fireball'], opponentCrystals: { purple: 3 },
    playerHand, playerCrystals,
    board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 4 }],
  },
});
const castFireball = async (page, s) =>
  expect((await act(page, { type: 'cast', uid: handUid(s, 'opponent', 'fireball'), target: { row: 6, col: 4 } })).ok).toBe(true);

test('AC49: Respond window opens even when the counterspell is unaffordable', async ({ page }) => {
  let s = await start(page, respondR6(['fizzle'], {}));
  expect((await page.evaluate(async () => await window.oreheart.getConfig())).respondWindowSeconds).toBe(12);
  await castFireball(page, s);
  s = await getState(page);
  expect(s.pendingResponse && s.pendingResponse.responder).toBe('player');
  const acts = await legal(page);
  expect(acts.some((a) => a.type === 'pass')).toBe(true);
  expect(acts.some((a) => a.type === 'respond')).toBe(false);
  const dlg = page.getByRole('dialog', { name: 'Respond?' });
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('need 3 more');
  await expect(dlg.getByRole('button', { name: /^Fizzle/ })).toBeDisabled();
  await expect(page.getByRole('progressbar', { name: 'Respond time left' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Let it happen' }).click();
  await expect(dlg).toBeHidden();
  await expect.poll(async () => at(await getState(page), 6, 4)).toBeUndefined();
});

test('AC49: "Crystal Cluster + Fizzle" plays both and cancels the enemy spell', async ({ page }) => {
  let s = await start(page, respondR6(['fizzle', 'crystal-cluster'], { green: 1 }));
  await castFireball(page, s);
  s = await getState(page);
  const fizzle = handUid(s, 'player', 'fizzle');
  const cluster = handUid(s, 'player', 'crystal-cluster');
  expect((await legal(page)).some((a) => a.type === 'respond' && a.uid === fizzle && a.crystalUid === cluster)).toBe(true);
  expect((await legal(page)).some((a) => a.type === 'respond' && a.uid === fizzle && !a.crystalUid)).toBe(false);
  const dlg = page.getByRole('dialog', { name: 'Respond?' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Crystal Cluster + Fizzle', exact: true }).click();
  await expect(dlg).toBeHidden();
  await expect.poll(async () => (await getState(page)).pendingResponse).toBe(null);
  s = await getState(page);
  expect(at(s, 6, 4)).toBeDefined(); // Fireball was cancelled
  expect(s.players.player.crystals).toEqual(ZERO); // 1 Flow + 2 Bank paid Fizzle (3)
  expect(s.players.player.bank).toEqual(ZERO);
  expect(s.players.player.discard.map((c) => c.cardId).sort()).toEqual(['crystal-cluster', 'fizzle']);
  expect(s.players.opponent.discard.some((c) => c.cardId === 'fireball')).toBe(true);
  expect(s.activePlayer).toBe('opponent');
});

test('AC49: a Crystal card played alone in the Respond window keeps it open and funds the counterspell', async ({ page }) => {
  let s = await start(page, respondR6(['fizzle', 'crystal-cluster'], { green: 1 }));
  await castFireball(page, s);
  s = await getState(page);
  expect((await act(page, { type: 'playCrystal', uid: handUid(s, 'player', 'crystal-cluster') })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse && s.pendingResponse.responder).toBe('player');
  expect(s.priority).toBe('player');
  expect(s.players.player.bank).toEqual({ ...ZERO, green: 2 });
  expect((await act(page, { type: 'respond', uid: handUid(s, 'player', 'fizzle') })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse).toBe(null);
  expect(at(s, 6, 4)).toBeDefined();
  expect(total(s.players.player.crystals) + total(s.players.player.bank)).toBe(0);
});

test('AC50: Smith Miners never Tunnel; the Tunnel! tag shows only when behind', async ({ page }) => {
  const hand = { playerHand: ['goblin-smith-miner', 'goblin-scrounger'], playerCrystals: { green: 5 } };
  let s = await start(page, { ai: false, setup: { ...hand, board: [{ cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1, minedMine: M1 }] } });
  expect(s.sites[0].color).toBe('blue');
  const smith = handUid(s, 'player', 'goblin-smith-miner');
  const summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.uid === smith && a.row === 3 && a.col === 3)).toBe(false);
  expect(summons.some((a) => a.uid === smith && a.row === 7)).toBe(true);
  expect((await act(page, { type: 'summon', uid: smith, row: 3, col: 3 })).ok).toBe(false);
  const hb = page.getByLabel('Your hand', { exact: true });
  await expect(hb.getByRole('button', { name: 'Goblin Miner', exact: true })).toContainText('Tunnel!');
  await expect(hb.getByRole('button', { name: 'Goblin Smith Miner', exact: true })).not.toContainText('Tunnel!');
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrounger'), row: 3, col: 3 })).ok).toBe(true);
  await newMatch(page, { ai: false, setup: { ...hand } });
  await expect(page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Goblin Miner', exact: true })).not.toContainText('Tunnel!');
});

const STRONGHOLD_CROWD = [
  ...[[7, 6], [7, 8], [6, 6], [6, 7], [6, 8]].map(([row, col]) => ({ cardId: 'goblin-scrapper', owner: 'player', row, col })),
  ...[[1, 6], [1, 8], [2, 6], [2, 7], [2, 8]].map(([row, col]) => ({ cardId: 'gnome-tinker', owner: 'opponent', row, col })),
];
for (const [w, h] of [[844, 390], [740, 360], [667, 375]]) {
  test.describe(`hearts and turn display ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test(`AC51: Commander hearts never cover creature labels; turn display top-right (${w}x${h})`, async ({ page }) => {
      await start(page, { ai: false, setup: { board: STRONGHOLD_CROWD } });
      await expect(page.getByLabel('Your Commander health', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Enemy Commander health', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Goblin Scrapper, row 6, column 7', { exact: true })).toBeVisible();
      await page.waitForTimeout(1500);
      const overlaps = await page.evaluate(() => {
        const hearts = ['Your Commander health', 'Enemy Commander health']
          .map((n) => document.querySelector(`[aria-label="${n}"]`).getBoundingClientRect());
        const labels = [...document.querySelectorAll('[aria-label*=", row "]')]
          .filter((e) => !/^(Crystal site|Mine flow)/.test(e.getAttribute('aria-label')) && e.getClientRects().length)
          .map((e) => [e.getAttribute('aria-label'), e.getBoundingClientRect()]);
        const out = [];
        for (const hr of hearts) for (const [name, r] of labels) {
          const ox = Math.min(hr.right, r.right) - Math.max(hr.left, r.left);
          const oy = Math.min(hr.bottom, r.bottom) - Math.max(hr.top, r.top);
          if (ox > 1 && oy > 1) out.push(name);
        }
        return { out, count: labels.length };
      });
      expect(overlaps.count).toBeGreaterThanOrEqual(10);
      expect(overlaps.out).toEqual([]);
      if (w === 844) {
        const phase = page.getByLabel('Current phase', { exact: true });
        await expect(phase).toContainText(/your turn/i);
        await expect(phase).toContainText(/deploy/i);
        const b = await phase.boundingBox();
        expect(b.x + b.width / 2).toBeGreaterThan(w * 2 / 3);
        expect(b.y + b.height / 2).toBeLessThan(h / 2);
      }
    });
  });
}
