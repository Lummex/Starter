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
  let withMines = opts && opts.setup && !opts.mines ? { ...opts, mines: OLD_MINES } : opts;
  // Round 4: older setup-based tests hand-pick spells for any Commander; they run with the faction lock off
  if (withMines && withMines.setup && withMines.factionLock === undefined) withMines = { ...withMines, factionLock: false };
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
const total = (n) => n; // Revision 7: Flow and Bank are plain numbers
const ZERO = 0;
const sameTarget = (t, row, col) => t && t.row === row && t.col === col;
const SHARDS = Array(12).fill('soul-shard');
// Round 5b: Last turn, Mute, Card pop-ups and Recenter live in the pop-out match Menu
async function openMatchMenu(page) {
  if (await page.getByRole('button', { name: 'Last turn', exact: true }).isVisible()) return;
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Last turn', exact: true })).toBeVisible();
}
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
const NEW_BY_FACTION = {
  grubnak: ['rotgut-grenadier', 'shiv-rat', 'skullbasher-rusher', 'junk-shaman', 'blastrat-sapper'],
  sproingle: ['hexwright-apprentice', 'gearward-sentinel', 'runic-siphoner', 'phase-stalker', 'glyphshield-warden'],
  borgo: ['oathbound-pikeman', 'deepforge-crossbowman', 'barrelback-courier', 'rune-splitter', 'grimhold-ravager'],
};
const CRYSTALS = new Set(['soul-shard', 'crystal-cluster', 'glowing-geode', 'heart-of-the-fallen', 'motherlode']);
const SPELLS = new Set(['prospectors-prayer', 'tunnel-rush', 'fireball', 'battle-cry', 'meteor-strike', 'healing-light',
  'shield-bubble', 'second-wind', 'fizzle', 'hold-it', 'spell-snap', 'mirror-hex', 'venom-shiv']);
const CREATURES = ['goblin-scrounger', 'goblin-scrapper', 'goblin-slinger', 'goblin-bomber', 'goblin-sneak', 'wolf-rider',
  'grubnaks-big-boss-troll', 'gnome-prospector', 'gnome-tinker', 'spark-gnome', 'clockwork-beetle', 'gnome-illusionist',
  'gyrocopter-ace', 'the-great-steam-golem', 'dwarf-miner', 'shieldbeard', 'axe-thrower', 'ironhammer-berserker',
  'brewmaster', 'ram-rider', 'queen-brunhilda-stonebeard', 'shard-guzzler', 'overclocked-conduit', 'crystal-drunk-delver'];

// ---------- AC1 ----------
test('AC1: main menu has exactly Play, Tutorial, Decks, Rules, Settings and no page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openMenu(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
  const buttons = page.getByRole('button');
  await expect(buttons).toHaveCount(5);
  const names = (await buttons.allInnerTexts()).map((t) => t.trim());
  expect(names).toEqual(['Play', 'Tutorial', 'Decks', 'Rules', 'Settings']);
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
  await expect(page.getByRole('button', { name: 'Grubnak Rotgut, King of the Junkpile' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thane Borgo Gravelgrim' })).toBeVisible();
  await page.getByRole('button', { name: 'Archmagister Sproingle the Unfathomable' }).click();
  await expect(page.getByRole('button', { name: 'Archmagister Sproingle the Unfathomable' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Easy', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Normal', exact: true }).click();
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
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
  await page.getByRole('button', { name: 'Back', exact: true }).click();
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
  await page.getByRole('button', { name: 'Back', exact: true }).click();
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
  test(`AC6: ${cmd} Warband starter deck is 100 cards: 30 + 20 Miners, 38 Fighters, 7 spells, 5 Crystal cards`, async ({ page }) => {
    const s = await start(page, { playerCommander: cmd, ai: false, firstPlayer: 'player' });
    expect(s.phase).toBe('mulligan');
    const p = s.players.player;
    expect(p.health).toBe(20);
    expect(s.players.opponent.health).toBe(20);
    expect(p.hand.length).toBe(5);
    const all = [...p.deck, ...p.hand].map((c) => c.cardId);
    expect(all.length).toBe(100);
    expect(all.filter((id) => CRYSTALS.has(id)).length).toBe(5);
    expect(all.filter((id) => SPELLS.has(id)).length).toBe(7);
    expect(all.filter((id) => !SPELLS.has(id) && !CRYSTALS.has(id)).length).toBe(88);
    const counts = {};
    for (const id of all) counts[id] = (counts[id] || 0) + 1;
    for (const [id, n] of Object.entries(counts)) if (LIMITED.has(id)) expect(n, id).toBeLessThanOrEqual(3);
    const basic = { grubnak: 'goblin-scrounger', sproingle: 'gnome-prospector', borgo: 'dwarf-miner' }[cmd];
    expect(counts[basic]).toBe(30);
    const smith = { grubnak: 'goblin-smith-miner', sproingle: 'gnome-smith-miner', borgo: 'dwarf-smith-miner' }[cmd];
    expect(counts[smith]).toBe(20);
    for (const id of NEW_BY_FACTION[cmd]) expect(counts[id] || 0, id).toBeGreaterThanOrEqual(1);
    const creatureIds = all.filter((id) => !SPELLS.has(id) && !CRYSTALS.has(id) && id !== basic && id !== smith);
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
  await start(page, { ai: false, setup: { playerCrystals: 4, playerBank: 2, playerHealth: 17, opponentHealth: 12 } });
  const phase = page.getByLabel('Current phase', { exact: true });
  const timer = page.getByLabel('Phase timer', { exact: true });
  await expect(phase).toContainText('Deploy');
  await expect(phase).toContainText(/Your turn/i);
  await expect(timer).toBeHidden();
  await expect(page.getByLabel('Your Flow crystals', { exact: true })).toHaveText(/\b4\b/);
  await expect(page.getByLabel('Your Bank crystals', { exact: true })).toHaveText(/\b2\b/);
  // Revision 7: one crystal type, no per-color counters
  await expect(page.getByLabel(/^Your (green|blue|purple|white) crystals$/)).toHaveCount(0);
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
test('AC9: example (a) — 1 Gemsinger Miner vs 2 Grubgrabber Miners: enemy owns the mine, enemy gets 4, you get 1 (+2 underdog)', async ({ page }) => {
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
  expect(s.players.opponent.flow).toBe(4);
  expect(s.players.player.flow).toBe(1); // half at an enemy-owned mine
  expect(s.sites[0].flow).toEqual({ player: 1, opponent: 4 });
  await passTurn(page); // -> player's turn 2
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(s.players.player.crystals).toBe(3); // 1 mined + 2 underdog
  await passTurn(page); // -> opponent's turn 3
  s = await getState(page);
  expect(s.players.opponent.crystals).toBe(4);
});

test('AC9: one crystal type — every card costs plain crystals, Flow is a single number', async ({ page }) => {
  let s = await start(page, {
    ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak',
    setup: { playerHand: ['gnome-prospector', 'gnome-prospector', 'spark-gnome'], playerCrystals: 6 },
  });
  expect(typeof s.players.player.crystals).toBe('number');
  expect(typeof s.players.player.bank).toBe('number');
  expect(typeof s.players.player.flow).toBe('number');
  const [p1] = s.players.player.hand.filter((c) => c.cardId === 'gnome-prospector').map((c) => c.uid);
  expect((await act(page, { type: 'summon', uid: p1, row: 7, col: 1 })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals).toBe(5);
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'spark-gnome'), row: 7, col: 3 })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals).toBe(0); // 6 - 1 - 5
  // a Gnome player can pay a Goblin card at full value (decks may mix factions)
  s = await newMatch(page, { ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak', setup: { playerHand: ['goblin-slinger'], playerCrystals: 4 } });
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals).toBe(0);
});

test('AC9: example (b) — 2 vs 2 tie: mine is neutral, each side gets the full 4', async ({ page }) => {
  let s = await start(page, {
    ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle',
    setup: {
      firstPlayer: 'opponent', playerDeck: SHARDS, opponentDeck: SHARDS,
      playerHand: ['goblin-scrounger', 'goblin-scrounger', 'goblin-scrounger', 'goblin-scrounger', 'goblin-scrounger', 'battle-cry'],
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
  expect(s.players.player.flow).toBe(4);
  expect(s.players.opponent.flow).toBe(4);
  await passTurn(page); // -> player's turn 2
  s = await getState(page);
  expect(s.players.player.crystals).toBe(4); // no underdog: the enemy owns no mine
  const bc = handUid(s, 'player', 'battle-cry');
  expect((await legal(page)).some((a) => a.type === 'cast' && a.uid === bc)).toBe(true);
  const g = s.players.player.hand.filter((c) => c.cardId === 'goblin-scrounger').map((c) => c.uid);
  const freeCols = [1, 3, 4, 5]; // Round 3b: skip (7,2), the player's Stronghold
  for (let i = 0; i < 4; i++) expect((await act(page, { type: 'summon', uid: g[i], row: 7, col: freeCols[i] })).ok).toBe(true); // 1 each (Grubnak minimum 1)
  expect((await getState(page)).players.player.crystals).toBe(0);
  expect((await act(page, { type: 'summon', uid: g[4], row: 7, col: 6 })).ok).toBe(false);
});

test('AC9: mining at an enemy-owned mine pays half — Miner 1, Fighter 0; own or neutral pays full', async ({ page }) => {
  let s = await start(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: {
    playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [
      { cardId: 'dwarf-miner', owner: 'opponent', row: 5, col: 1, minedMine: M1 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 5, col: 2, minedMine: M1 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 5, col: 3, minedMine: M1 },
      { cardId: 'goblin-scrounger', owner: 'player', row: 3, col: 1 },
      { cardId: 'goblin-scrapper', owner: 'player', row: 3, col: 2 },
      { cardId: 'goblin-scrounger', owner: 'player', row: 3, col: 4 },
    ],
  } });
  expect(s.sites[0].controller).toBe('opponent');
  await done(page); // -> action
  expect((await act(page, { type: 'mine', creatureUid: at(s, 3, 1).uid, row: 4, col: 2 })).ok).toBe(true);
  expect((await act(page, { type: 'mine', creatureUid: at(s, 3, 2).uid, row: 4, col: 2 })).ok).toBe(true);
  expect((await act(page, { type: 'mine', creatureUid: at(s, 3, 4).uid, row: 4, col: 4 })).ok).toBe(true);
  s = await getState(page);
  expect(s.sites[0].controller).toBe('opponent'); // 3 enemy miners vs 2
  expect(s.sites.map((x) => x.flow.player)).toEqual([1, 2, 0]); // Miner 1 + Fighter 0 at the enemy mine; Miner 2 at the neutral one
  expect(s.players.player.flow).toBe(3);
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
  expect(s.players.player.flow).toBe(6);
  await passTurn(page);
  await passTurn(page); // player's turn 3
  s = await getState(page);
  expect(s.turn).toBe(3);
  expect(s.players.player.crystals).toEqual(6);
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
  expect(s.players.player.flow).toBe(4);
  await done(page); // -> opponent's turn 4
  s = await getState(page);
  expect(s.activePlayer).toBe('opponent');
  expect(s.players.player.crystals).toEqual(6); // still usable on the enemy's turn
  await passTurn(page); // player's turn 5
  s = await getState(page);
  expect(s.players.player.crystals).toEqual(4); // reset to flow, not 6 + 4
});

test('AC9: example (e) — the pool never goes above 16', async ({ page }) => {
  let s = await start(page, { ai: false, setup: { playerHand: ['crystal-cluster'], playerCrystals: 15 } });
  expect((await act(page, { type: 'playCrystal', uid: s.players.player.hand[0].uid })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals).toEqual(15); // Crystal cards go to the Bank (R6.4)
  expect(s.players.player.bank).toEqual(2);
  const spots = [[3, 1], [4, 1], [5, 1], [3, 2], [5, 2], [3, 6], [5, 6], [3, 7], [4, 7], [5, 7]];
  await newMatch(page, { ai: false, setup: {
    playerDeck: SHARDS, opponentDeck: SHARDS,
    board: spots.map(([row, col]) => ({ cardId: 'goblin-scrounger', owner: 'player', row, col, minedMine: col <= 3 ? M1 : M3 })),
  } });
  await passTurn(page);
  await passTurn(page);
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(s.players.player.crystals).toEqual(16); // flow 20, capped
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
  expect(s.players.player.flow).toEqual(3); // Gatherer 2 + Fighter 1; the idle Scrounger makes 0
  expect(s.sites.map((x) => x.flow.player)).toEqual([2, 1, 0]);
  // mining is the creature's one action
  acts = await legal(page);
  expect(acts.some((a) => ['move', 'attack', 'mine'].includes(a.type) && a.creatureUid === g)).toBe(false);
  expect((await act(page, { type: 'move', creatureUid: g, row: 6, col: 1 })).ok).toBe(false);
  // a creature that moved can't mine
  expect((await act(page, { type: 'move', creatureUid: idle, row: 3, col: 7 })).ok).toBe(true);
  expect((await act(page, { type: 'mine', creatureUid: idle, row: 4, col: 6 })).ok).toBe(false);
  const label = page.getByLabel('Grubgrabber Miner, row 5, column 1', { exact: true });
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
  expect(s.players.player.crystals).toEqual(3); // set to what was mined
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
test('AC10: back-row summoning, Grubnak discount, summoning sickness, Mangewolf Rider', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    setup: { playerHand: ['goblin-scrapper', 'goblin-scrounger', 'wolf-rider'], playerCrystals: 20 },
  });
  const scrapper = handUid(s, 'player', 'goblin-scrapper');
  const scrounger = handUid(s, 'player', 'goblin-scrounger');
  const wolf = handUid(s, 'player', 'wolf-rider');
  const summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.length).toBeGreaterThan(0);
  expect(summons.every((a) => a.row === 7)).toBe(true); // back row only; no Tunnel (no sites held)
  expect(summons.some((a) => a.uid === scrapper && a.row === 7 && a.col === 1)).toBe(true);
  expect(summons.some((a) => a.row === 7 && a.col === 2)).toBe(false); // Round 3a: player Stronghold at (7,2)
  expect(summons.some((a) => a.uid === scrounger && a.row === 3)).toBe(false);
  expect((await act(page, { type: 'summon', uid: scrapper, row: 6, col: 1 })).ok).toBe(false);
  expect((await act(page, { type: 'summon', uid: scrapper, row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 1).cardId).toBe('goblin-scrapper');
  expect(at(s, 7, 1).summonedThisTurn).toBe(true);
  expect(s.players.player.crystals).toBe(15); // Scrapper 6 - 1 Grubnak
  expect((await act(page, { type: 'summon', uid: wolf, row: 7, col: 3 })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals).toBe(7); // Mangewolf Rider 9 - 1
  await done(page); // -> action
  const acts = await legal(page);
  expect(acts.some((a) => (a.type === 'move' || a.type === 'attack') && a.creatureUid === at(s, 7, 1).uid)).toBe(false);
  expect(acts.some((a) => a.type === 'move' && a.creatureUid === at(s, 7, 3).uid)).toBe(true);
});

test('AC10: row in front only when the back row is full; nothing when both are full', async ({ page }) => {
  const row7 = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((col, i) => ({ cardId: 'goblin-scrapper', owner: i === 0 ? 'opponent' : 'player', row: 7, col }));
  let s = await start(page, { ai: false, setup: { playerHand: ['goblin-slinger'], playerCrystals: 5, board: row7 } });
  let summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.row === 6 && a.col === 1)).toBe(true);
  expect(summons.every((a) => a.row === 6)).toBe(true);
  const row6 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((col) => ({ cardId: 'goblin-scrapper', owner: 'player', row: 6, col }));
  s = await newMatch(page, { ai: false, setup: { playerHand: ['goblin-slinger'], playerCrystals: 5, board: [...row7, ...row6] } });
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
      playerCrystals: 20,
      board: [{ cardId: 'queen-brunhilda-stonebeard', owner: 'player', row: 6, col: 7 }],
    },
  });
  const queen = handUid(s, 'player', 'queen-brunhilda-stonebeard');
  expect((await legal(page)).some((a) => a.type === 'summon' && a.uid === queen)).toBe(false);
  expect((await act(page, { type: 'summon', uid: queen, row: 7, col: 1 })).ok).toBe(false);
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'shieldbeard'), row: 7, col: 4 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 4).maxHealth).toBe(5);
  expect(at(s, 7, 4).health).toBe(5);
  expect(at(s, 6, 7).maxHealth).toBe(7);
  expect(at(s, 7, 4).attack).toBe(2);
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'dwarf-miner'), row: 7, col: 3 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 3).attack).toBe(1);
  expect(at(s, 7, 3).maxHealth).toBe(2); // Stonebreaker Miner 1/1 + Borgo = 1/2
  expect(at(s, 7, 3).health).toBe(2);
});

// ---------- AC11 ----------
test('AC11: Tunnel only while more mines are in the enemy color', async ({ page }) => {
  const hand = { playerHand: ['goblin-scrounger'], playerCrystals: 5 };
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

test('AC12: each creature moves OR attacks, never both; Thunderhorn Ram Rider (Charge) can do both', async ({ page }) => {
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
  // Thunderhorn Ram Rider moves next to the second Miner, then attacks
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
      { cardId: 'goblin-slinger', owner: 'player', row: 3, col: 11 }, // 2 from the enemy Stronghold (1,12)
    ] },
  });
  await done(page);
  const axe = at(s, 5, 7).uid;
  const acts = (await legal(page)).filter((a) => a.type === 'attack');
  expect(acts.some((a) => a.creatureUid === axe && sameTarget(a.target, 3, 7))).toBe(true);
  expect(acts.some((a) => a.creatureUid === axe && sameTarget(a.target, 3, 6))).toBe(true);
  expect(acts.some((a) => a.creatureUid === axe && sameTarget(a.target, 4, 7))).toBe(true);
  expect(acts.some((a) => a.creatureUid === axe && sameTarget(a.target, 2, 7))).toBe(false);
  const sling = at(s, 3, 11).uid;
  expect(acts.some((a) => a.creatureUid === sling && a.target && a.target.commander === 'opponent')).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: axe, target: { row: 4, col: 7 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 7).health).toBe(3); // Shieldbeard 4 + 1 Borgo - 2
  expect(at(s, 5, 7).health).toBe(4); // Axe Thrower 3 + 1 Borgo, no strike back
  expect((await act(page, { type: 'attack', creatureUid: sling, target: { commander: 'opponent' } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(19); // exactly 1
  expect(at(s, 3, 11).health).toBe(3); // Slinger 2 + 1 Borgo, untouched
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
test('AC15: Aegis Tinkerer gives Shield 1, which blocks exactly 1 damage', async ({ page }) => {
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
        { cardId: 'queen-brunhilda-stonebeard', owner: 'player', row: 2, col: 11 }, // next to the enemy Stronghold (1,12)
        { cardId: 'goblin-scrapper', owner: 'player', row: 2, col: 13 },
      ],
    },
  });
  const queen = at(s, 2, 11).uid;
  const scrap = at(s, 2, 13).uid;
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
  expect(s.players.player.crystals).toEqual(4); // 2 Miners mined 2 each on turn 1: pays Thunderhorn Blast (4)
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'battle-cry') })).ok).toBe(true);
  await done(page);
  expect((await act(page, { type: 'attack', creatureUid: queen, target: { commander: 'opponent' } })).ok).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: scrap, target: { commander: 'opponent' } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(4); // 13 - 6 - 3
});

// ---------- AC17 ----------
test('AC17: Searing Arcane Orb deals 3 damage for 3 crystals', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'borgo',
    setup: { playerHand: ['fireball'], playerCrystals: 3, board: [{ cardId: 'shieldbeard', owner: 'opponent', row: 3, col: 4 }] },
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
  expect(s.players.player.bank).toBe(1);
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
  expect((await getState(page)).players.player.bank).toBe(2);
});
test("AC17: Desperate Plunder costs 1 and gives 3 Flow only when behind on mines", async ({ page }) => {
  let s = await start(page, { ai: false, setup: { playerHand: ['prospectors-prayer'], playerCrystals: 1 } });
  expect((await act(page, { type: 'cast', uid: s.players.player.hand[0].uid })).ok).toBe(false); // 0 vs 0 mines
  s = await newMatch(page, { ai: false, setup: {
    playerHand: ['prospectors-prayer'], playerCrystals: 1,
    board: [{ cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1, minedMine: M1 }],
  } });
  expect((await act(page, { type: 'cast', uid: s.players.player.hand[0].uid })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals).toEqual(3);
});

test('AC17: crystal-bought upgrades are gone', async ({ page }) => {
  await start(page, { ai: false, setup: { playerCrystals: 10, board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 }] } });
  expect((await legal(page)).some((x) => x.type === 'upgrade')).toBe(false);
  const s = await getState(page);
  expect((await act(page, { type: 'upgrade', creatureUid: at(s, 6, 3).uid, upgrade: 'sharpened-weapons' })).ok).toBe(false);
  expect((await page.evaluate(async () => await window.oreheart.getConfig())).upgradeCosts).toBeUndefined();
  await expect(page.getByRole('button', { name: 'Upgrade', exact: true })).toHaveCount(0);
});
// ---------- AC18 ----------
test('AC18: Snuff Out counters Searing Arcane Orb; crystals still spent', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'borgo',
    setup: {
      playerHand: ['fireball'],
      playerCrystals: 3,
      opponentHand: ['fizzle'],
      opponentCrystals: 3,
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

test('AC18: Snuff Out cannot cancel a spell costing more than 3', async ({ page }) => {
  let s = await start(page, {
    ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo',
    setup: { playerHand: ['battle-cry'], playerCrystals: 4, opponentHand: ['fizzle'], opponentCrystals: 3 },
  });
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'battle-cry') })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse).toBe(null); // Thunderhorn Blast costs 4: no usable Instant, so no Respond window
  expect(s.players.opponent.hand.some((c) => c.cardId === 'fizzle')).toBe(true);
});

test('AC18: Pickpocket! returns a summoned creature to hand', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'borgo',
    setup: {
      playerHand: ['goblin-scrapper'],
      playerCrystals: 5,
      opponentHand: ['hold-it'],
      opponentCrystals: 4,
    },
  });
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrapper'), row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse && s.pendingResponse.responder).toBe('opponent');
  expect((await act(page, { type: 'respond', uid: handUid(s, 'opponent', 'hold-it') })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 1)).toBeUndefined();
  expect(s.players.player.hand.some((c) => c.cardId === 'goblin-scrapper')).toBe(true);
  expect(s.players.player.crystals).toBe(0); // Scrapper 6 - 1 Grubnak, still spent
});

const respondSetup = {
  ai: false,
  playerCommander: 'grubnak',
  opponentCommander: 'borgo',
  setup: {
    firstPlayer: 'opponent',
    opponentHand: ['fireball'],
    opponentCrystals: 3,
    playerHand: ['shield-bubble'],
    playerCrystals: 5,
    board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 4 }],
  },
};

test('AC18: Respond dialog — Let it happen', async ({ page }) => {
  let s = await start(page, respondSetup);
  expect(s.activePlayer).toBe('opponent');
  expect((await act(page, { type: 'cast', uid: handUid(s, 'opponent', 'fireball'), target: { row: 6, col: 4 } })).ok).toBe(true);
  const dlg = page.getByRole('dialog', { name: 'Respond?' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Ironclad Bulwark' })).toBeVisible();
  await dlg.getByRole('button', { name: 'Let it happen' }).click();
  await expect(dlg).toBeHidden();
  await expect.poll(async () => at(await getState(page), 6, 4)).toBeUndefined();
});

test('AC18: Respond dialog — cast Ironclad Bulwark saves the creature', async ({ page }) => {
  let s = await start(page, respondSetup);
  expect((await act(page, { type: 'cast', uid: handUid(s, 'opponent', 'fireball'), target: { row: 6, col: 4 } })).ok).toBe(true);
  const dlg = page.getByRole('dialog', { name: 'Respond?' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Ironclad Bulwark' }).click();
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
    setup: { opponentHealth: 2, board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 2, col: 12 }] },
  });
  await done(page);
  const acts = await legal(page);
  expect(acts.some((a) => a.type === 'attack' && a.target && a.target.commander === 'opponent')).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 2, 12).uid, target: { commander: 'opponent' } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(0);
  expect(s.winner).toBe('player');
  expect(s.phase).toBe('over');
  await expect(page.getByRole('heading', { name: 'Victory!' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
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
for (const difficulty of ['easy', 'normal', 'hard']) {
  test(`${difficulty === 'hard' ? 'AC78' : 'AC21'}: ${difficulty} AI completes its turn and hands it back`, async ({ page }) => {
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
  const card = page.getByRole('button', { name: 'Searing Arcane Orb', exact: true });
  await expect(card).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gutripper Brawler', exact: true })).toBeVisible();
  await card.click();
  const view = page.getByRole('dialog', { name: 'Searing Arcane Orb' });
  await expect(view).toBeVisible();
  await expect(view).toContainText('3 damage');
  await view.getByRole('button', { name: 'Close' }).click();
  await expect(view).toBeHidden();
});

// ---------- AC23 ----------
test('AC23: illegal actions are rejected and state is unchanged', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['wolf-rider'], playerCrystals: 1 } });
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
        const card = await page.getByRole('button', { name: 'Searing Arcane Orb', exact: true }).boundingBox();
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
    setup: { playerHand: ['dwarf-miner', 'shieldbeard', 'axe-thrower', 'ram-rider'], playerCrystals: 30 },
  });
  const steps = [['dwarf-miner', 1, 29], ['shieldbeard', 3, 22], ['axe-thrower', 4, 16], ['ram-rider', 5, 5]]; // Round 3b: (7,2) is the Stronghold
  for (const [id, col, left] of steps) {
    expect((await act(page, { type: 'summon', uid: handUid(s, 'player', id), row: 7, col })).ok, id).toBe(true);
    s = await getState(page);
    expect(s.players.player.crystals, id).toBe(left);
  }
  s = await newMatch(page, {
    ai: false, playerCommander: 'grubnak',
    setup: { playerHand: ['goblin-scrounger', 'goblin-scrapper'], playerCrystals: 6 },
  });
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrounger'), row: 7, col: 1 })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals).toBe(5); // minimum 1
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrapper'), row: 7, col: 3 })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals).toBe(0); // 6 - 1
});

// ---------- AC28 ----------
test('AC28: phase banner appears when a phase begins', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: 1 } });
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
test('AC29: moves left ignores Instants, Crystal cards and the Miner swap', async ({ page }) => {
  await start(page, {
    ai: false,
    setup: {
      playerHand: ['healing-light', 'soul-shard'], playerCrystals: 10, playerDeck: ['goblin-scrounger', ...SHARDS],
      board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 2 }],
    },
  });
  const acts = await legal(page);
  expect(acts.some((a) => a.type === 'gathererSwap')).toBe(true);
  expect(await movesLeft(page)).toBe(false);
  await done(page);
  expect(await movesLeft(page)).toBe(true); // the Scrapper can move
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: 1 } });
  expect(await movesLeft(page)).toBe(true);
});

test('AC29: with auto-skip on, an empty turn passes by itself; a phase with moves left does not', async ({ page }) => {
  await openTest(page);
  await newMatch(page, { ai: false, autoSkip: true, setup: { playerDeck: SHARDS, opponentDeck: SHARDS } });
  await expect.poll(async () => (await getState(page)).activePlayer, { timeout: 15000 }).toBe('opponent');
  let s = await getState(page);
  expect(s.turn).toBe(2);
  expect(s.phase).toBe('deploy'); // the opponent's phases are never auto-skipped (R8.9)
  await newMatch(page, { ai: false, autoSkip: true, setup: { playerHand: ['goblin-scrounger'], playerCrystals: 1 } });
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
      playerDeck: SHARDS, opponentDeck: SHARDS, playerHand: ['goblin-scrapper'], playerCrystals: 6,
      board: [{ cardId: 'wolf-rider', owner: 'player', row: 6, col: 6 }],
    },
  });
  const wolf = page.getByLabel('Mangewolf Rider, row 6, column 6', { exact: true });
  await expect(wolf).toHaveText(/3\D+4\D+2/);
  await expect(wolf).toHaveAttribute('data-acted', 'false');
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrapper'), row: 7, col: 1 })).ok).toBe(true);
  const scrap = page.getByLabel('Gutripper Brawler, row 7, column 1', { exact: true });
  await expect(scrap).toHaveAttribute('data-acted', 'true');
  await expect(scrap).toHaveText(/2\D+3\D+1/);
  await done(page);
  expect((await act(page, { type: 'move', creatureUid: at(s, 6, 6).uid, row: 5, col: 6 })).ok).toBe(true);
  const moved = page.getByLabel('Mangewolf Rider, row 5, column 6', { exact: true });
  await expect(moved).toHaveAttribute('data-acted', 'true');
  await done(page); // enemy turn
  await expect(moved).toHaveAttribute('data-acted', 'true');
  await passTurn(page); // player's turn 3
  await expect(moved).toHaveAttribute('data-acted', 'false');
  await expect(scrap).toHaveAttribute('data-acted', 'false');
});

// ---------- AC31 ----------
test('AC31: Moves still available pop-up — Go back and Continue', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: 1 } });
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
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: 1 } });
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
  await newMatch(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: 1 } });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(async () => (await getState(page)).phase).toBe('action');
  await expect(dlg).toBeHidden();
});

// ---------- AC32 ----------
test('AC32: countdown appears only in the last 10 seconds; 0 ends just the phase', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: 1 } });
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
  expect((await act(page, { type: 'summon', uid: g2, row: 7, col: 3 })).ok).toBe(false); // a Miner is now on the battlefield
  // 1 Flow pays for it: not free
  s = await newMatch(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: 1 } });
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(true);
  expect((await getState(page)).players.player.crystals).toEqual(ZERO);
  // 1 Bank pays for it: not free
  s = await newMatch(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerBank: 1 } });
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(true);
  expect((await getState(page)).players.player.bank).toEqual(ZERO);
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
      playerHand: ['goblin-scrounger', 'goblin-slinger'], playerCrystals: 4,
      board: [{ cardId: 'gnome-tinker', owner: 'opponent', row: 6, col: 2 }],
    },
  });
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrounger'), row: 7, col: 1 })).ok).toBe(true);
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-slinger'), row: 7, col: 3 })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals).toBe(0); // Scrounger 1 + Slinger 4 - 1 Grubnak
  await expect(page.getByLabel('Grubgrabber Miner, row 7, column 1', { exact: true })).toHaveAttribute('data-acted', 'false'); // stays bright
  await expect(page.getByLabel('Skullflinger, row 7, column 3', { exact: true })).toHaveAttribute('data-acted', 'true'); // summoning sickness
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
  await expect(preview).toHaveText(/^\s*Next \+0\s*$/);
  await newMatch(page, { ai: false, setup: { board: [
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 },
    { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 2, minedMine: M1 },
    { cardId: 'goblin-scrounger', owner: 'player', row: 3, col: 6 }, // next to a mine but not mining
  ] } });
  await expect(preview).toHaveText(/^\s*Next \+3\s*$/);
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
  // underdog bonus is part of the preview: 0 flow + 2 = "Next +2"
  await newMatch(page, { ai: false, setup: { board: [{ cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1, minedMine: M1 }] } });
  await expect(preview).toHaveText(/^\s*Next \+2\s*$/);
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
  expect((await act(page, { type: 'move', creatureUid: b, row: 7, col: 3 })).ok).toBe(true);
  expect(at(await getState(page), 7, 3).uid).toBe(b);
});

// ---------- AC37 ----------
test('AC37: the confirm pop-up sits above the countdown', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger'], playerCrystals: 1 } });
  await page.evaluate(async () => await window.oreheart.setPhaseTimeLeft(5));
  await expect(page.getByLabel('Phase timer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  const dlg = page.getByRole('dialog', { name: 'Moves still available! Continue to the next phase?' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Continue' }).click(); // fails if covered by the countdown
  await expect.poll(async () => (await getState(page)).phase).toBe('action');
});

// ---------- AC40 ----------
test('AC40: 13 x 7 board; 3 random, corner-mirrored mines from the seed; Strongholds at (7,2) and (1,12); fixed tutorial layout', async ({ page }) => {
  await openTest(page);
  const cheb = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  const layouts = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const s = await newMatch(page, { ai: false, seed, skipMulligan: true });
    const m = s.sites.map((x) => ({ row: x.row, col: x.col }));
    expect(m.length, `seed ${seed}`).toBe(3);
    for (const a of m) {
      expect(a.row >= 3 && a.row <= 5 && a.col >= 1 && a.col <= 13, `seed ${seed}`).toBe(true);
      expect(m.some((b) => b.row === 8 - a.row && b.col === 14 - a.col), `corner mirror, seed ${seed}`).toBe(true);
      expect(cheb(a, { row: 1, col: 12 }) >= 2 && cheb(a, { row: 7, col: 2 }) >= 2, `Stronghold distance, seed ${seed}`).toBe(true);
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(cheb(m[i], m[j]), `spacing, seed ${seed}`).toBeGreaterThanOrEqual(2);
    expect([1, 3]).toContain(m.filter((a) => a.row === 4).length);
    expect(m.some((a) => a.row === 4 && a.col === 7), `center mine, seed ${seed}`).toBe(true);
    const sorted = [...m].sort((a, b) => a.row - b.row || a.col - b.col);
    expect(m).toEqual(sorted); // reading order
    const again = await newMatch(page, { ai: false, seed, skipMulligan: true });
    expect(again.sites.map((x) => ({ row: x.row, col: x.col }))).toEqual(m);
    layouts.push(JSON.stringify(m));
  }
  expect(new Set(layouts).size).toBeGreaterThan(1);
  // board bounds: columns 1-13, player Stronghold at column 2 (Round 3a)
  const s = await newMatch(page, { ai: false, setup: { playerHand: ['goblin-scrounger'] } });
  const summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.row === 7 && a.col === 13)).toBe(true);
  expect(summons.some((a) => a.row === 7 && a.col === 7)).toBe(true);
  expect(summons.some((a) => a.row === 7 && a.col === 1)).toBe(true);
  expect(summons.some((a) => a.row === 7 && a.col === 2)).toBe(false);
  const st = await getState(page);
  expect(st.strongholds).toEqual({ player: { row: 7, col: 2 }, opponent: { row: 1, col: 12 } });
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
  await expect(page.getByLabel('Skullflinger, row 6, column 1', { exact: true })).toContainText('🏹');
  await expect(page.getByLabel('Gutripper Brawler, row 6, column 3', { exact: true })).not.toContainText('🏹');
  const hand = page.getByLabel('Your hand', { exact: true });
  await expect(hand.getByRole('button', { name: 'Skullflinger' })).toContainText('🏹');
  await expect(hand.getByRole('button', { name: 'Gutripper Brawler' })).not.toContainText('🏹');
});

test.describe('landscape layout details', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  // ---------- AC43 ----------
  test('AC43: the hand rests tucked halfway at the bottom and slides up on hover (Round 6a)', async ({ page }) => {
    await start(page, { ai: false, setup: { playerHand: ['fireball', 'goblin-scrapper', 'goblin-slinger'] } });
    const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Gutripper Brawler' });
    await expect(card).toBeAttached();
    await page.mouse.move(422, 120);
    await page.waitForTimeout(800);
    const rest = await card.boundingBox();
    expect(rest.y).toBeLessThan(390);
    const shown = (390 - rest.y) / rest.height;
    expect(shown).toBeGreaterThanOrEqual(0.35);
    expect(shown).toBeLessThanOrEqual(0.65);
    expect(rest.height).toBeGreaterThanOrEqual(390 * 0.36);
    expect(rest.height).toBeLessThanOrEqual(390 * 0.46);
    await page.mouse.move(rest.x + rest.width / 2, rest.y + rest.height * 0.2);
    await expect.poll(async () => { const b = await card.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(391);
    await expect.poll(async () => (await card.boundingBox()).y).toBeGreaterThanOrEqual(-1);
    await page.mouse.move(422, 120);
    await expect.poll(async () => { const b = await card.boundingBox(); return (390 - b.y) / b.height; }).toBeLessThanOrEqual(0.65);
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
    expect(a.y + a.height / 2).toBeGreaterThan(195); // Round 2: next to the player's hand (bottom)
    expect(b.y + b.height / 2).toBeLessThan(195); // next to the enemy hand (top)
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
  expect(cards['goblin-scrounger'].name).toBe('Grubgrabber Miner');
  expect(cards['gnome-prospector'].name).toBe('Gemsinger Miner');
  expect(cards['dwarf-miner'].name).toBe('Stonebreaker Miner');
  for (const [id, name, faction] of [['goblin-smith-miner', 'Scrapsmith Miner', 'goblins'], ['gnome-smith-miner', 'Arcsmith Miner', 'gnomes'], ['dwarf-smith-miner', 'Anvilsworn Miner', 'dwarves']]) {
    expect(cards[id].name).toBe(name);
    expect(cards[id].faction).toBe(faction);
    expect(cards[id].role).toBe('smith');
    expect(cards[id].type).toBe('creature');
    expect([cards[id].cost, cards[id].attack, cards[id].health, cards[id].move]).toEqual([2, 1, 1, 1]);
  }
  const hand = page.getByLabel('Your hand', { exact: true });
  await expect(hand.getByRole('button', { name: 'Grubgrabber Miner', exact: true })).toContainText('⛏');
  await expect(hand.getByRole('button', { name: 'Gutripper Brawler', exact: true })).toContainText('⚔');
  await expect(hand.getByRole('button', { name: 'Gutripper Brawler', exact: true })).not.toContainText('⛏');
  const smith = hand.getByRole('button', { name: 'Scrapsmith Miner', exact: true });
  await expect(smith).toContainText('⚒');
  await expect(smith).toContainText('SMITH');
  await expect(page.getByLabel('Grubgrabber Miner, row 6, column 1', { exact: true })).toContainText('⛏');
  await expect(page.getByLabel('Gutripper Brawler, row 6, column 2', { exact: true })).not.toContainText('⛏');
});

const smithSetup = (n, blue) => ({
  ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak',
  setup: {
    playerHand: Array(n).fill('gnome-smith-miner'), playerCrystals: blue,
    playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [{ cardId: 'gnome-tinker', owner: 'player', row: 6, col: 3, damage: 1 }],
  },
});

test('AC46: Miner upgrades — Smith gives +1 Attack and +1 Health, basic Miner +1 Health; they stack, persist and heal', async ({ page }) => {
  let s = await start(page, smithSetup(4, 10));
  const base = await page.evaluate(async () => await window.oreheart.getCard('gnome-tinker'));
  const tinker = at(s, 6, 3).uid;
  const smiths = s.players.player.hand.map((c) => c.uid);
  expect(at(s, 6, 3).upgrades).toEqual({ attack: 0, health: 0 });
  expect((await legal(page)).some((a) => a.type === 'minerUpgrade' && a.uid === smiths[0] && a.creatureUid === tinker)).toBe(true);
  expect((await legal(page)).some((a) => a.type === 'smith')).toBe(false); // the old choice action is gone
  expect(await page.evaluate(async () => await window.oreheart.movesLeft())).toBe(true); // the summon counts, not the upgrade
  expect((await act(page, { type: 'minerUpgrade', uid: smiths[0], creatureUid: tinker })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 3).attack).toBe(base.attack + 1);
  expect(at(s, 6, 3).maxHealth).toBe(base.health + 1);
  expect(at(s, 6, 3).health).toBe(base.health); // was damaged by 1, +1 Health
  expect(s.players.player.crystals).toBe(8);
  expect((await act(page, { type: 'minerUpgrade', uid: smiths[1], creatureUid: tinker })).ok).toBe(true);
  s = await getState(page);
  const t = at(s, 6, 3);
  expect(t.attack).toBe(base.attack + 2);
  expect(t.maxHealth).toBe(base.health + 2);
  expect(t.upgrades).toEqual({ attack: 2, health: 2 });
  expect(s.board.creatures.length).toBe(1);
  expect(s.players.player.crystals).toBe(6);
  expect(s.players.player.discard.filter((c) => c.cardId === 'gnome-smith-miner').length).toBe(2);
  await expect(page.getByLabel('Aegis Tinkerer, row 6, column 3', { exact: true })).toHaveAttribute('data-upgrades', '4');
  // summoned on the back row: a normal Miner that may move this turn
  expect((await act(page, { type: 'summon', uid: smiths[2], row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  const sm = at(s, 7, 1);
  expect(sm.cardId).toBe('gnome-smith-miner');
  expect(s.players.player.crystals).toBe(4);
  await done(page);
  expect((await legal(page)).some((a) => a.type === 'move' && a.creatureUid === sm.uid)).toBe(true);
  expect((await legal(page)).some((a) => a.type === 'attack' && a.creatureUid === sm.uid)).toBe(false);
  expect((await act(page, { type: 'minerUpgrade', uid: smiths[3], creatureUid: tinker })).ok).toBe(false); // Deploy only
  await done(page);
  await passTurn(page);
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  const t2 = at(s, 6, 3);
  expect(t2.attack).toBe(base.attack + 2);
  expect(t2.maxHealth).toBe(base.health + 2);
  expect(t2.health).toBe(base.health + 2); // healed up to the raised max
  expect(t2.upgrades).toEqual({ attack: 2, health: 2 });
});

test('AC46: a basic Miner played onto your creature gives exactly +1 Health; the free Miner can never upgrade', async ({ page }) => {
  let s = await start(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle', setup: {
    playerHand: ['goblin-scrounger', 'goblin-scrounger'], playerCrystals: 1, playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 }],
  } });
  const base = await page.evaluate(async () => await window.oreheart.getCard('goblin-scrapper'));
  const scrap = at(s, 6, 3).uid;
  const [g1, g2] = s.players.player.hand.map((c) => c.uid);
  expect((await act(page, { type: 'minerUpgrade', uid: g1, creatureUid: scrap })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 3).attack).toBe(base.attack);
  expect(at(s, 6, 3).maxHealth).toBe(base.health + 1);
  expect(at(s, 6, 3).upgrades).toEqual({ attack: 0, health: 1 });
  expect(s.players.player.crystals).toBe(0); // paid its normal cost (1)
  // now broke with no Miner on the battlefield: the second one could be a free Miner, but only as a summon
  expect((await legal(page)).some((a) => a.type === 'minerUpgrade' && a.uid === g2)).toBe(false);
  expect((await act(page, { type: 'minerUpgrade', uid: g2, creatureUid: scrap })).ok).toBe(false);
  expect((await act(page, { type: 'summon', uid: g2, row: 7, col: 1 })).ok).toBe(true); // free Miner
});

test('AC46: dropping a Smith Miner on your creature upgrades it at once (no choice pop-up)', async ({ page }) => {
  let s = await start(page, smithSetup(1, 2));
  const base = await page.evaluate(async () => await window.oreheart.getCard('gnome-tinker'));
  await page.waitForTimeout(2000); // let opening banners finish
  const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Arcsmith Miner', exact: true });
  const label = page.getByLabel('Aegis Tinkerer, row 6, column 3', { exact: true });
  const a = await card.boundingBox();
  const b = await label.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height + 12, { steps: 15 });
  await page.mouse.up();
  await expect.poll(async () => at(await getState(page), 6, 3).attack).toBe(base.attack + 1);
  expect(at(await getState(page), 6, 3).maxHealth).toBe(base.health + 1);
  await expect(page.getByRole('dialog', { name: 'Smith upgrade' })).toHaveCount(0);
});

test('AC47: Crystal Bank persists, has no cap and is spent after Flow', async ({ page }) => {
  let s = await start(page, { ai: false, playerCommander: 'grubnak', setup: {
    playerHand: ['goblin-slinger'], playerCrystals: 2, playerBank: 3,
    playerDeck: SHARDS, opponentDeck: SHARDS,
  } });
  expect(s.players.player.bank).toEqual(3);
  await expect(page.getByLabel('Your Flow crystals', { exact: true })).toHaveText(/\b2\b/);
  await expect(page.getByLabel('Your Bank crystals', { exact: true })).toHaveText(/\b3\b/);
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(true); // 4 - 1 Grubnak = 3
  s = await getState(page);
  expect(s.players.player.crystals).toEqual(ZERO);
  expect(s.players.player.bank).toEqual(2);
  await passTurn(page);
  await passTurn(page);
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(s.players.player.crystals).toEqual(ZERO); // Flow reset to last turn's mining
  expect(s.players.player.bank).toEqual(2); // Bank kept
  await expect(page.getByLabel('Your Bank crystals', { exact: true })).toHaveText(/\b2\b/);
  // no cap on the Bank
  s = await newMatch(page, { ai: false, setup: { playerHand: ['crystal-cluster'], playerBank: 20 } });
  expect((await act(page, { type: 'playCrystal', uid: s.players.player.hand[0].uid })).ok).toBe(true);
  expect((await getState(page)).players.player.bank).toEqual(22);
});

test('AC48: playing a Crystal card never ends the phase or turn', async ({ page }) => {
  let s = await start(page, { ai: false, autoSkip: true, setup: { playerHand: ['soul-shard', 'goblin-scrapper'], playerCrystals: 4 } });
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
    firstPlayer: 'opponent', opponentHand: ['fireball'], opponentCrystals: 3,
    playerHand, playerCrystals,
    board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 4 }],
  },
});
const castFireball = async (page, s) =>
  expect((await act(page, { type: 'cast', uid: handUid(s, 'opponent', 'fireball'), target: { row: 6, col: 4 } })).ok).toBe(true);

test('AC49: an unaffordable counterspell opens no Respond window (Round 2)', async ({ page }) => {
  let s = await start(page, respondR6(['fizzle'], 0));
  expect((await page.evaluate(async () => await window.oreheart.getConfig())).respondWindowSeconds).toBe(12);
  await castFireball(page, s);
  s = await getState(page);
  expect(s.pendingResponse).toBe(null);
  expect(at(s, 6, 4)).toBeUndefined();
  await expect(page.getByRole('dialog', { name: 'Respond?' })).toHaveCount(0);
});

test('AC49: "Soul Cluster + Snuff Out" plays both and cancels the enemy spell', async ({ page }) => {
  let s = await start(page, respondR6(['fizzle', 'crystal-cluster'], 1));
  await castFireball(page, s);
  s = await getState(page);
  const fizzle = handUid(s, 'player', 'fizzle');
  const cluster = handUid(s, 'player', 'crystal-cluster');
  expect((await legal(page)).some((a) => a.type === 'respond' && a.uid === fizzle && a.crystalUid === cluster)).toBe(true);
  expect((await legal(page)).some((a) => a.type === 'respond' && a.uid === fizzle && !a.crystalUid)).toBe(false);
  const dlg = page.getByRole('dialog', { name: 'Respond?' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Soul Cluster + Snuff Out', exact: true }).click();
  await expect(dlg).toBeHidden();
  await expect.poll(async () => (await getState(page)).pendingResponse).toBe(null);
  s = await getState(page);
  expect(at(s, 6, 4)).toBeDefined(); // Searing Arcane Orb was cancelled
  expect(s.players.player.crystals).toEqual(ZERO); // 1 Flow + 2 Bank paid Snuff Out (3)
  expect(s.players.player.bank).toEqual(ZERO);
  expect(s.players.player.discard.map((c) => c.cardId).sort()).toEqual(['crystal-cluster', 'fizzle']);
  expect(s.players.opponent.discard.some((c) => c.cardId === 'fireball')).toBe(true);
  expect(s.activePlayer).toBe('opponent');
});

test('AC49: a Crystal card played alone in the Respond window keeps it open and funds the counterspell', async ({ page }) => {
  let s = await start(page, respondR6(['fizzle', 'crystal-cluster'], 1));
  await castFireball(page, s);
  s = await getState(page);
  expect((await act(page, { type: 'playCrystal', uid: handUid(s, 'player', 'crystal-cluster') })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse && s.pendingResponse.responder).toBe('player');
  expect(s.priority).toBe('player');
  expect(s.players.player.bank).toEqual(2);
  expect((await act(page, { type: 'respond', uid: handUid(s, 'player', 'fizzle') })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse).toBe(null);
  expect(at(s, 6, 4)).toBeDefined();
  expect(total(s.players.player.crystals) + total(s.players.player.bank)).toBe(0);
});

test('AC50: Smith Miners never Tunnel; the Tunnel! tag shows only when behind', async ({ page }) => {
  const hand = { playerHand: ['goblin-smith-miner', 'goblin-scrounger'], playerCrystals: 5 };
  let s = await start(page, { ai: false, setup: { ...hand, board: [{ cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 1, minedMine: M1 }] } });
  expect(s.sites[0].color).toBe('blue');
  const smith = handUid(s, 'player', 'goblin-smith-miner');
  const summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.uid === smith && a.row === 3 && a.col === 3)).toBe(false);
  expect(summons.some((a) => a.uid === smith && a.row === 7)).toBe(true);
  expect((await act(page, { type: 'summon', uid: smith, row: 3, col: 3 })).ok).toBe(false);
  const hb = page.getByLabel('Your hand', { exact: true });
  await expect(hb.getByRole('button', { name: 'Grubgrabber Miner', exact: true })).toContainText('Tunnel!');
  await expect(hb.getByRole('button', { name: 'Scrapsmith Miner', exact: true })).not.toContainText('Tunnel!');
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrounger'), row: 3, col: 3 })).ok).toBe(true);
  await newMatch(page, { ai: false, setup: { ...hand } });
  await expect(page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Grubgrabber Miner', exact: true })).not.toContainText('Tunnel!');
});

const STRONGHOLD_CROWD = [
  ...[[7, 1], [7, 3], [6, 1], [6, 2], [6, 3]].map(([row, col]) => ({ cardId: 'goblin-scrapper', owner: 'player', row, col })),
  ...[[1, 11], [1, 13], [2, 11], [2, 12], [2, 13]].map(([row, col]) => ({ cardId: 'gnome-tinker', owner: 'opponent', row, col })),
];
for (const [w, h] of [[844, 390], [740, 360], [667, 375]]) {
  test.describe(`hearts and turn display ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test(`AC51: Commander hearts never cover creature labels; turn display top-right (${w}x${h})`, async ({ page }) => {
      await start(page, { ai: false, setup: { board: STRONGHOLD_CROWD } });
      await expect(page.getByLabel('Your Commander health', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Enemy Commander health', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Gutripper Brawler, row 6, column 2', { exact: true })).toBeVisible();
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
        expect(b.x).toBeGreaterThanOrEqual(w * 0.74); // Round 5b: top-right (80 %, 0 %)
        expect(b.y).toBeLessThanOrEqual(h * 0.04);
      }
    });
  });
}

// ---------- Revision 7 ----------
const RENAMES = {
  'goblin-scrounger': 'Grubgrabber Miner', 'goblin-scrapper': 'Gutripper Brawler', 'goblin-slinger': 'Skullflinger',
  'goblin-bomber': 'Boomfist Lunatic', 'goblin-sneak': 'Backstab Weasel', 'wolf-rider': 'Mangewolf Rider',
  'grubnaks-big-boss-troll': 'Gutcrusher the Troll Tyrant', 'gnome-prospector': 'Gemsinger Miner', 'gnome-tinker': 'Aegis Tinkerer',
  'spark-gnome': 'Stormcaller Savant', 'clockwork-beetle': 'Iron Scarab Automaton', 'gnome-illusionist': 'Mirrorveil Illusionist',
  'gyrocopter-ace': 'Thunderwing Gyronaut', 'the-great-steam-golem': 'The Arcane Colossus', 'dwarf-miner': 'Stonebreaker Miner',
  'shieldbeard': 'Ironwall Shieldbeard', 'axe-thrower': 'Grudge Hurler', 'ironhammer-berserker': 'Bloodbeard Berserker',
  'brewmaster': 'Forgefire Brewlord', 'ram-rider': 'Thunderhorn Ram Rider', 'queen-brunhilda-stonebeard': 'Queen Brunhilda Ironheart, the Unbroken',
  'shard-guzzler': 'Shardguzzler the Bottomless', 'overclocked-conduit': 'Overclocked Aethervein', 'crystal-drunk-delver': 'Gemdrunk Deepdelver',
  'goblin-smith-miner': 'Scrapsmith Miner', 'gnome-smith-miner': 'Arcsmith Miner', 'dwarf-smith-miner': 'Anvilsworn Miner',
  'prospectors-prayer': 'Desperate Plunder', 'tunnel-rush': 'Rat-Tunnel Ambush', 'fireball': 'Searing Arcane Orb', 'battle-cry': 'Thunderhorn Blast',
  'meteor-strike': 'Starfall Cataclysm', 'healing-light': 'Field Bandage', 'shield-bubble': 'Ironclad Bulwark', 'second-wind': 'Emergency Repairs',
  'fizzle': 'Snuff Out', 'hold-it': 'Pickpocket!', 'spell-snap': 'Unweave', 'mirror-hex': 'Hex Reversal',
  'soul-shard': 'Soul Shard', 'crystal-cluster': 'Soul Cluster', 'glowing-geode': 'Wellspring Geode', 'heart-of-the-fallen': 'Heart of the Fallen',
  'motherlode': 'Motherlode',
};

test('AC52: one crystal type — two counters only; Heart of the Fallen puts 4 into the Bank', async ({ page }) => {
  let s = await start(page, { ai: false, setup: { playerHand: ['heart-of-the-fallen'], playerCrystals: 3 } });
  await expect(page.getByLabel('Your Flow crystals', { exact: true })).toHaveText(/\b3\b/);
  await expect(page.getByLabel('Your Bank crystals', { exact: true })).toHaveText(/\b0\b/);
  await expect(page.getByLabel(/^Your (green|blue|purple|white) crystals$/)).toHaveCount(0);
  const acts = (await legal(page)).filter((a) => a.type === 'playCrystal');
  expect(acts.length).toBe(1);
  expect(acts[0].colors).toBeUndefined();
  expect((await act(page, { type: 'playCrystal', uid: s.players.player.hand[0].uid })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.bank).toBe(4);
  expect(s.players.player.crystals).toBe(3);
  await expect(page.getByLabel('Your Bank crystals', { exact: true })).toHaveText(/\b4\b/);
});

test('AC53: the Respond pop-up has a standalone "Play Soul Cluster" button that keeps it open', async ({ page }) => {
  let s = await start(page, respondR6(['fizzle', 'crystal-cluster'], 1));
  await castFireball(page, s);
  const dlg = page.getByRole('dialog', { name: 'Respond?' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Soul Cluster + Snuff Out', exact: true })).toBeVisible();
  await dlg.getByRole('button', { name: 'Play Soul Cluster', exact: true }).click();
  await expect.poll(async () => (await getState(page)).players.player.bank).toBe(2);
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Play Soul Cluster', exact: true })).toHaveCount(0); // used up / limit reached
  const snuff = dlg.getByRole('button', { name: 'Snuff Out', exact: true });
  await expect(snuff).toBeEnabled();
  await snuff.click();
  await expect(dlg).toBeHidden();
  await expect.poll(async () => (await getState(page)).pendingResponse).toBe(null);
  expect(at(await getState(page), 6, 4)).toBeDefined();
});

test('AC54: nothing can mine from 2 spaces away — only the 8 adjacent spaces', async ({ page }) => {
  let s = await start(page, { ai: false, setup: {
    board: [
      { cardId: 'goblin-scrounger', owner: 'player', row: 6, col: 2 }, // 2 below mine (4,2)
      { cardId: 'goblin-slinger', owner: 'player', row: 2, col: 4 }, // Ranged, 2 above mine (4,4)
      { cardId: 'goblin-scrounger', owner: 'player', row: 4, col: 8 }, // 2 right of mine (4,6)
      { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 6 }, // diagonal distance 2 from (4,4) and 2 from (4,6)
    ],
  } });
  await done(page);
  const acts = await legal(page);
  expect(acts.some((a) => a.type === 'mine')).toBe(false);
  for (const c of s.board.creatures) {
    for (const m of [M1, M2, M3]) expect((await act(page, { type: 'mine', creatureUid: c.uid, row: m.row, col: m.col })).ok).toBe(false);
  }
  expect(acts.some((a) => a.type === 'mineAt')).toBe(false);
  for (const m of [M1, M2, M3]) {
    await expect(page.getByRole('button', { name: `Crystal site, row ${m.row}, column ${m.col}`, exact: true })).toHaveAttribute('data-ready-miners', '0');
  }
});

test('AC55: casting a spell shows "GRUBNAK CASTS SEARING ARCANE ORB!" over the Stronghold; Commanders never attack', async ({ page }) => {
  let s = await start(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: {
    playerHand: ['fireball'], playerCrystals: 3, board: [{ cardId: 'shieldbeard', owner: 'opponent', row: 3, col: 4 }],
  } });
  const acts = await legal(page);
  const uids = new Set(s.board.creatures.map((c) => c.uid));
  expect(acts.filter((a) => a.type === 'attack').every((a) => uids.has(a.creatureUid))).toBe(true);
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'fireball'), target: { row: 3, col: 4 } })).ok).toBe(true);
  await expect(page.getByText(/GRUBNAK CASTS SEARING ARCANE ORB!/i)).toBeVisible();
});

test('AC56: Settings has "Card reveals: Normal" / "Fast", saved across reloads', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const btn = page.getByRole('button', { name: /^Card reveals: (Normal|Fast)/ });
  await expect(btn).toHaveText(/Card reveals: Normal/);
  await btn.click();
  await expect(btn).toHaveText(/Card reveals: Fast/);
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('button', { name: /^Card reveals: Fast/ })).toBeVisible();
});

test('AC57: every card shows its full ability text, in the hand and in the card view; names follow the rename table', async ({ page }) => {
  const ids = Object.keys(RENAMES);
  await start(page, { ai: false, setup: { playerHand: ids } });
  const cards = await page.evaluate(async (list) => {
    const out = {};
    for (const id of list) out[id] = await window.oreheart.getCard(id);
    return out;
  }, ids);
  const hand = page.getByLabel('Your hand', { exact: true });
  for (const id of ids) {
    expect(cards[id].name, id).toBe(RENAMES[id]);
    expect(typeof cards[id].text, id).toBe('string');
    expect(cards[id].text, id).toBe(cards[id].shortText);
    if (cards[id].type !== 'creature' || !/Miner$/.test(cards[id].name) || cards[id].role !== 'gatherer') {
      expect(cards[id].text.length, id).toBeGreaterThan(8);
    }
    const btn = hand.getByRole('button', { name: RENAMES[id], exact: true });
    await expect(btn, id).toHaveCount(1);
    await expect(btn, id).toContainText(cards[id].text);
  }
  expect(cards['shieldbeard'].longText).toContain('Guard: adjacent enemies must attack it first');
  expect(cards['goblin-slinger'].text).toContain('Ranged');
  expect(cards['goblin-smith-miner'].longText).toContain('+1 Attack and +1 Health');
  expect(cards['goblin-scrounger'].longText).toContain('+1 Health');
  await hand.getByRole('button', { name: 'Ironwall Shieldbeard', exact: true }).click();
  const view = page.getByRole('dialog', { name: 'Ironwall Shieldbeard' });
  await expect(view).toBeVisible();
  await expect(view).toContainText(cards['shieldbeard'].text);
});

test('AC57: the Commander picker uses the new Commander names', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  for (const n of ['Grubnak Rotgut, King of the Junkpile', 'Archmagister Sproingle the Unfathomable', 'Thane Borgo Gravelgrim']) {
    await expect(page.getByRole('button', { name: n })).toBeVisible();
  }
});

async function mineAllSetup(page) {
  return start(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle', setup: {
    playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [
      { cardId: 'gnome-prospector', owner: 'opponent', row: 5, col: 1, minedMine: M1 },
      { cardId: 'gnome-prospector', owner: 'opponent', row: 5, col: 2, minedMine: M1 },
      { cardId: 'goblin-scrounger', owner: 'player', row: 3, col: 1 }, // A: M1 only (enemy-owned)
      { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 3 }, // B: M1 (half) or M2 (neutral, full)
      { cardId: 'goblin-scrounger', owner: 'player', row: 3, col: 6 }, // C: will move first
      { cardId: 'goblin-scrapper', owner: 'player', row: 3, col: 5 }, // D: Fighter, never included
      { cardId: 'goblin-scrounger', owner: 'player', row: 7, col: 9 }, // E: not next to a mine
      { cardId: 'shard-guzzler', owner: 'player', row: 5, col: 7 }, // F: Crystal Eater next to M3
    ],
  } });
}

const siteBtn = (page, m) => page.getByRole('button', { name: `Crystal site, row ${m.row}, column ${m.col}`, exact: true });
test('AC58: tapping a mine mines with exactly the ready Miners next to it', async ({ page }) => {
  let s = await mineAllSetup(page);
  await expect(page.getByRole('button', { name: /Mine All/ })).toHaveCount(0);
  for (const m of [M1, M2, M3]) await expect(siteBtn(page, m)).toHaveAttribute('data-ready-miners', '0'); // Deploy
  await done(page);
  await expect(siteBtn(page, M1)).toHaveAttribute('data-ready-miners', '2'); // A, B
  await expect(siteBtn(page, M2)).toHaveAttribute('data-ready-miners', '1'); // B (D is a Fighter)
  await expect(siteBtn(page, M3)).toHaveAttribute('data-ready-miners', '2'); // C, F
  expect((await act(page, { type: 'mineAll' })).ok).toBe(false);
  const mineAts = (await legal(page)).filter((a) => a.type === 'mineAt');
  expect(mineAts.length).toBe(3);
  expect((await act(page, { type: 'move', creatureUid: at(s, 3, 6).uid, row: 2, col: 6 })).ok).toBe(true);
  await expect(siteBtn(page, M3)).toHaveAttribute('data-ready-miners', '1');
  await siteBtn(page, M1).click();
  await expect.poll(async () => at(await getState(page), 3, 1).hasMined).toBe(true);
  s = await getState(page);
  expect(at(s, 3, 1).minedMine).toMatchObject(M1);
  expect(at(s, 5, 3).minedMine).toMatchObject(M1); // the tapped mine
  expect(at(s, 5, 7).hasMined).toBe(false);
  await expect(siteBtn(page, M2)).toHaveAttribute('data-ready-miners', '0');
  await siteBtn(page, M3).click();
  await expect.poll(async () => at(await getState(page), 5, 7).hasMined).toBe(true);
  s = await getState(page);
  expect(at(s, 5, 7).minedMine).toMatchObject(M3);
  expect(at(s, 3, 5).hasMined).toBe(false); // Fighter
  expect(at(s, 7, 9).hasMined).toBe(false); // not next to a mine
  expect(at(s, 2, 6).hasMined).toBe(false); // already moved
  expect(s.players.player.flow).toBe(6); // M1 now 2 vs 2 = neutral: 2 + 2, plus F 2
  expect((await legal(page)).some((a) => a.type === 'mineAt')).toBe(false);
});

test('AC58: mineAt action matches the tap; hovering a mine only shows its info', async ({ page }) => {
  let s = await mineAllSetup(page);
  await done(page);
  await siteBtn(page, M1).hover();
  const info = page.getByRole('dialog', { name: 'Crystal site' });
  await expect(info).toBeVisible();
  await expect(info).toContainText('Controlled by: Enemy');
  await page.mouse.move(5, 200);
  s = await getState(page);
  expect(s.board.creatures.some((c) => c.hasMined)).toBe(false);
  await page.keyboard.press('m'); // the M shortcut is gone
  await page.waitForTimeout(500);
  expect((await getState(page)).board.creatures.some((c) => c.hasMined)).toBe(false);
  expect((await act(page, { type: 'mineAt', row: M3.row, col: M3.col })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 3, 6).hasMined && at(s, 5, 7).hasMined).toBe(true);
  expect(at(s, 3, 5).hasMined).toBe(false);
  expect((await act(page, { type: 'mineAt', row: M3.row, col: M3.col })).ok).toBe(false); // nobody left there
});

test.describe('hand pop-out at 2x', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('AC59: a hovered hand card doubles in size and stays fully on-screen', async ({ page }) => {
    await start(page, { ai: false, setup: { playerHand: ['goblin-scrapper', 'fireball', 'soul-shard', 'goblin-slinger', 'goblin-scrounger'] } });
    await page.waitForTimeout(2000);
    for (const name of ['Gutripper Brawler', 'Grubgrabber Miner']) {
      const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name, exact: true });
      const before = await card.boundingBox();
      await page.mouse.move(before.x + before.width / 2, before.y + 8); // the visible top of the tucked card
      await expect.poll(async () => (await card.boundingBox()).width).toBeGreaterThan(before.width * 1.8);
      const b = await card.boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(-1);
      expect(b.y).toBeGreaterThanOrEqual(-1);
      expect(b.x + b.width).toBeLessThanOrEqual(845);
      expect(b.y + b.height).toBeLessThanOrEqual(391);
      await page.mouse.move(422, 100);
    }
  });
});

// ---------- Revision 8 ----------
async function openDecks(page, url = '/?test=1') {
  await page.goto(url);
  await page.getByRole('button', { name: 'Decks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
}
const allCards = (page) => page.getByLabel('All cards', { exact: true });
// Round 3b: filters are custom ornate dropdowns (combobox -> floating listbox of options)
async function chooseFilter(page, label, option) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('listbox', { name: label, exact: true }).getByRole('option', { name: option, exact: true }).click();
  await expect(page.getByRole('combobox', { name: label, exact: true })).toContainText(option);
}
const deckList = (page) => page.getByLabel('Deck list', { exact: true });
// first copy by double-click on the card face, further copies with the + button
async function addCard(page, name, n = 1) {
  const plus = deckList(page).getByRole('button', { name: `Add ${name}`, exact: true });
  if ((await plus.count()) === 0) {
    await allCards(page).getByRole('button', { name, exact: true }).dblclick();
    await expect(plus).toBeVisible();
    n -= 1;
  }
  for (let i = 0; i < n; i++) await plus.click();
}
async function renameDeck(page, name) {
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Rename deck' });
  await dlg.getByLabel('Deck name', { exact: true }).fill(name);
  await dlg.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByLabel('Deck pile', { exact: true })).toContainText(name);
}
async function saveDeck(page) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
}

test('AC60: Deck Builder shows card faces with full text and filters them', async ({ page }) => {
  await openDecks(page);
  const all = allCards(page);
  for (const n of ['Rotgut Grenadier', 'Shiv Rat', 'Phase Stalker', 'Grimhold Ravager', 'Snotskull Grunt', 'Searing Arcane Orb', 'Soul Cluster', 'Gutcrusher the Troll Tyrant']) {
    await expect(all.getByRole('button', { name: n, exact: true })).toHaveCount(1);
  }
  await expect(all).toContainText('Guard: adjacent enemies must attack it first');
  await chooseFilter(page, 'Faction', 'Dwarves');
  await expect(all.getByRole('button', { name: 'Ironjaw Raider', exact: true })).toBeVisible();
  await expect(all.getByRole('button', { name: 'Snotskull Grunt', exact: true })).toHaveCount(0);
  await chooseFilter(page, 'Faction', 'All');
  await chooseFilter(page, 'Type', 'Spells');
  await expect(all.getByRole('button', { name: 'Searing Arcane Orb', exact: true })).toBeVisible();
  await expect(all.getByRole('button', { name: 'Ironjaw Raider', exact: true })).toHaveCount(0);
  await chooseFilter(page, 'Type', 'All');
  await chooseFilter(page, 'Rarity', 'Collector');
  await expect(all.getByRole('button', { name: 'Gutcrusher the Troll Tyrant', exact: true })).toBeVisible();
  await expect(all.getByRole('button', { name: 'Snotskull Grunt', exact: true })).toHaveCount(0);
  await chooseFilter(page, 'Rarity', 'All');
  await chooseFilter(page, 'Cost', '7+');
  await expect(all.getByRole('button', { name: 'Mangewolf Rider', exact: true })).toBeVisible();
  await expect(all.getByRole('button', { name: 'Shiv Rat', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
});

test('AC61: Deck Builder problems use the exact messages and counts', async ({ page }) => {
  await openDecks(page);
  await addCard(page, 'Mangewolf Rider', 3);
  await addCard(page, 'Soul Shard', 11);
  const counts = page.getByLabel('Deck counts', { exact: true });
  const problems = page.getByLabel('Deck problems', { exact: true });
  await expect(counts).toContainText(/Cards: 14 \(50[–-]100\)/);
  await expect(counts).toContainText('Creatures: 3');
  await expect(counts).toContainText('Spells: 0');
  await expect(counts).toContainText('Crystal cards: 11');
  await expect(problems).not.toContainText('At most 20 Crystal cards');
  await expect(problems).toContainText('Needs 50 to 100 cards (now 14).');
  await expect(problems).not.toContainText('Crystal cards (now');
  await addCard(page, 'Soul Shard', 10);
  await expect(problems).toContainText('At most 20 Crystal cards (now 21).');
  await expect(deckList(page)).toContainText('3 × Mangewolf Rider');
  await deckList(page).getByRole('button', { name: 'Remove Soul Shard', exact: true }).click();
  await expect(problems).not.toContainText('At most 20 Crystal cards');
  await expect(problems).toContainText('Needs 50 to 100 cards (now 23).');
  await addCard(page, 'Snotskull Grunt', 27);
  await expect(counts).toContainText(/Cards: 50 \(50[–-]100\)/);
  await expect(problems).toContainText('Deck is legal');
});

test('AC62: up to 5 saved decks persist after a reload', async ({ page }) => {
  await openDecks(page);
  await renameDeck(page, 'Miner Rush');
  await addCard(page, 'Grubgrabber Miner', 50);
  await expect(page.getByLabel('Deck problems', { exact: true })).toContainText('Deck is legal');
  await saveDeck(page);
  for (const name of ['Too Small', 'Deck C', 'Deck D', 'Deck E']) {
    await page.getByRole('button', { name: 'New Deck', exact: true }).click();
    await renameDeck(page, name);
    await addCard(page, 'Shiv Rat');
    await saveDeck(page);
  }
  await page.reload();
  await page.getByRole('button', { name: 'Decks', exact: true }).click();
  const mine = page.getByLabel('My decks', { exact: true });
  for (const name of ['Miner Rush', 'Too Small', 'Deck C', 'Deck D', 'Deck E']) {
    await expect(mine.getByRole('button', { name: new RegExp(`^${name}`) })).toHaveCount(1);
  }
  await expect(page.getByRole('button', { name: 'New Deck', exact: true })).toBeDisabled();
  await expect(page.getByText('You can save up to 5 decks.')).toBeVisible();
});

const NEW_CARDS = {
  'rotgut-grenadier': ['Rotgut Grenadier', 'goblins', 'Common', 5, 2, 2, /Ranged/],
  'shiv-rat': ['Shiv Rat', 'goblins', 'Common', 4, 2, 1, /Sneaky/],
  'skullbasher-rusher': ['Skullbasher Rusher', 'goblins', 'Uncommon', 6, 2, 2, /Charge/],
  'junk-shaman': ['Junk Shaman', 'goblins', 'Uncommon', 5, 1, 3, /\+1 Attack/],
  'blastrat-sapper': ['Blastrat Sapper', 'goblins', 'Uncommon', 4, 2, 1, /Ka-boom/i],
  'hexwright-apprentice': ['Hexwright Apprentice', 'gnomes', 'Common', 4, 1, 2, /Ranged/],
  'gearward-sentinel': ['Gearward Sentinel', 'gnomes', 'Common', 6, 1, 4, /Guard/],
  'runic-siphoner': ['Runic Siphoner', 'gnomes', 'Uncommon', 5, 2, 2, /Bank/],
  'phase-stalker': ['Phase Stalker', 'gnomes', 'Uncommon', 6, 2, 3, /Blink/],
  'glyphshield-warden': ['Glyphshield Warden', 'gnomes', 'Uncommon', 6, 2, 3, /Shield/],
  'oathbound-pikeman': ['Oathbound Pikeman', 'dwarves', 'Common', 6, 2, 3, /Guard/],
  'deepforge-crossbowman': ['Deepforge Crossbowman', 'dwarves', 'Common', 5, 2, 2, /Ranged/],
  'barrelback-courier': ['Barrelback Courier', 'dwarves', 'Common', 6, 1, 3, /turn it.s played/],
  'rune-splitter': ['Rune-Splitter', 'dwarves', 'Uncommon', 7, 3, 3, /Armored/],
  'grimhold-ravager': ['Grimhold Ravager', 'dwarves', 'Uncommon', 8, 3, 4, /Rage/],
};

test('AC63: the 15 new cards have the exact printed stats', async ({ page }) => {
  await openTest(page);
  for (const [id, [name, faction, rarity, cost, atk, hp, re]] of Object.entries(NEW_CARDS)) {
    const c = await page.evaluate(async (x) => await window.oreheart.getCard(x), id);
    expect(c, id).toMatchObject({ id, name, type: 'creature', faction, rarity, role: 'fighter', cost, attack: atk, health: hp, move: 1 });
    expect(c.text, id).toMatch(re);
  }
});

test('AC63: new card abilities with exact numbers', async ({ page }) => {
  const fight = async (board, extra = {}) => {
    const s = await start(page, { ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak', setup: { playerDeck: SHARDS, opponentDeck: SHARDS, board, ...extra } });
    await done(page);
    return s;
  };
  // Shiv Rat: Sneaky, no strike back
  let s = await fight([{ cardId: 'shiv-rat', owner: 'player', row: 5, col: 4 }, { cardId: 'goblin-grunt', owner: 'opponent', row: 4, col: 4 }]);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 4).uid, target: { row: 4, col: 4 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 4)).toBeUndefined();
  expect(at(s, 5, 4).health).toBe(1);
  // Blastrat Sapper: dies to the strike back, Ka-boom 1 finishes the adjacent Grunt
  s = await fight([
    { cardId: 'blastrat-sapper', owner: 'player', row: 5, col: 4 },
    { cardId: 'goblin-pebbler', owner: 'opponent', row: 4, col: 4 },
    { cardId: 'goblin-grunt', owner: 'opponent', row: 4, col: 5 },
  ]);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 4).uid, target: { row: 4, col: 4 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 5, 4)).toBeUndefined();
  expect(at(s, 4, 4)).toBeUndefined();
  expect(at(s, 4, 5)).toBeUndefined();
  // Rune-Splitter: Armored takes 1 less (2 -> 1)
  s = await fight([{ cardId: 'dwarf-pickman', owner: 'player', row: 5, col: 4 }, { cardId: 'rune-splitter', owner: 'opponent', row: 4, col: 4 }]);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 4).uid, target: { row: 4, col: 4 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 4).health).toBe(2);
  expect(at(s, 5, 4)).toBeUndefined();
  // Grimhold Ravager: below half Health it hits for 3 + 2 = 5
  s = await fight([
    { cardId: 'grimhold-ravager', owner: 'player', row: 5, col: 4, damage: 3 },
    { cardId: 'grimhold-ravager', owner: 'opponent', row: 4, col: 4 },
  ]);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 4).uid, target: { row: 4, col: 4 } })).ok).toBe(true);
  expect(at(await getState(page), 4, 4)).toBeUndefined();
  // Runic Siphoner: defeating a creature puts 1 in the Bank
  s = await fight([{ cardId: 'runic-siphoner', owner: 'player', row: 5, col: 4 }, { cardId: 'gnome-widget', owner: 'opponent', row: 4, col: 4 }]);
  expect(s.players.player.bank).toBe(0);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 4).uid, target: { row: 4, col: 4 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 4)).toBeUndefined();
  expect(at(s, 5, 4).health).toBe(1);
  expect(s.players.player.bank).toBe(1);
  // Glyphshield Warden: Shield 1 at the start of its owner's turn
  s = await fight([{ cardId: 'glyphshield-warden', owner: 'player', row: 6, col: 4 }]);
  await done(page); // end player turn 1
  await passTurn(page); // opponent turn 2
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(at(s, 6, 4).shield).toBe(1);
  // Barrelback Courier: can move the turn it's played
  s = await start(page, { ai: false, playerCommander: 'sproingle', setup: { playerHand: ['barrelback-courier'], playerCrystals: 6 } });
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'barrelback-courier'), row: 7, col: 3 })).ok).toBe(true);
  await done(page);
  const c = at(await getState(page), 7, 3);
  expect((await legal(page)).some((a) => a.type === 'move' && a.creatureUid === c.uid)).toBe(true);
});

const strictSetup = { playerHand: ['grubnaks-big-boss-troll', 'soul-shard', 'healing-light'], playerCrystals: 20,
  board: [{ cardId: 'grubnaks-big-boss-troll', owner: 'player', row: 6, col: 3 }] };

test('AC64: Deploy auto-skips with an unplayable hand; Action skips once nothing can act', async ({ page }) => {
  let s = await start(page, { ai: false, playerCommander: 'grubnak', setup: strictSetup });
  expect(await page.evaluate(async () => await window.oreheart.movesLeft())).toBe(false);
  s = await newMatch(page, { ai: false, autoSkip: true, playerCommander: 'grubnak', setup: strictSetup });
  await expect.poll(async () => (await getState(page)).phase, { timeout: 5000 }).toBe('action');
  await expect(page.getByRole('dialog', { name: /Moves still available/ })).toHaveCount(0);
  await page.waitForTimeout(2000);
  s = await getState(page);
  expect(s.phase).toBe('action'); // the Troll can still move
  expect(s.activePlayer).toBe('player');
  expect((await act(page, { type: 'move', creatureUid: at(s, 6, 3).uid, row: 5, col: 3 })).ok).toBe(true);
  await expect.poll(async () => (await getState(page)).activePlayer, { timeout: 5000 }).toBe('opponent');
});

test('AC64: Done with only a Crystal card, an Instant or an unplaceable card shows no pop-up', async ({ page }) => {
  await start(page, { ai: false, playerCommander: 'grubnak', setup: strictSetup });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(async () => (await getState(page)).phase).toBe('action');
  await expect(page.getByRole('dialog', { name: /Moves still available/ })).toHaveCount(0);
});

test('AC65: every creature carries the weapon of its type', async ({ page }) => {
  await openTest(page);
  const expected = {
    'goblin-scrounger': 'pick', 'goblin-smith-miner': 'pick-hammer', 'shard-guzzler': 'pick-crystal',
    'goblin-scrapper': 'sword', 'goblin-slinger': 'sling', 'hexwright-apprentice': 'wand',
    'deepforge-crossbowman': 'crossbow', 'axe-thrower': 'axes', 'shieldbeard': 'sword-shield',
    'ram-rider': 'lance', 'skullbasher-rusher': 'lance', 'gyrocopter-ace': 'gyro',
    'grubnaks-big-boss-troll': 'signature', 'fireball': null, 'soul-shard': null,
  };
  for (const [id, w] of Object.entries(expected)) {
    expect((await page.evaluate(async (x) => await window.oreheart.getCard(x), id)).weapon, id).toBe(w);
  }
});

test.describe('compact stat pill', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('AC66: creature labels are compact pills with Attack, Health, Movement', async ({ page }) => {
    await start(page, { ai: false, setup: { board: [{ cardId: 'wolf-rider', owner: 'player', row: 5, col: 6 }, { cardId: 'goblin-slinger', owner: 'player', row: 5, col: 8 }] } });
    for (const name of ['Mangewolf Rider, row 5, column 6', 'Skullflinger, row 5, column 8']) {
      const label = page.getByLabel(name, { exact: true });
      await expect(label).toBeVisible();
      const lb = await label.boundingBox();
      expect(lb.width, name).toBeLessThanOrEqual(76); // Round 8b: painted icons, about half the old footprint
      expect(lb.height, name).toBeLessThanOrEqual(30);
      expect(await label.evaluate((el) => [...el.querySelectorAll('*')].filter((e) => (e.tagName === 'IMG' && /stat-/.test(e.getAttribute('src') || '')) || /stat-/.test(getComputedStyle(e).backgroundImage)).length), `${name} stat icons`).toBeGreaterThanOrEqual(3);
    }
    await expect(page.getByLabel('Mangewolf Rider, row 5, column 6', { exact: true })).toHaveText(/3\D+4\D+2/);
  });
});

// ---------- Revision 9 ----------
for (const [flow, saved] of [[9, 0], [10, 1], [16, 1]]) {
  test(`AC67: ending your turn with ${flow} Flow saves ${saved} into the Bank`, async ({ page }) => {
    let s = await start(page, { ai: false, setup: { playerCrystals: flow } });
    expect((await page.evaluate(async () => (await window.oreheart.getConfig()).savingsPerCrystal))).toBe(10);
    await passTurn(page);
    s = await getState(page);
    expect(s.activePlayer).toBe('opponent');
    expect(s.players.player.crystals).toBe(flow - saved);
    expect(s.players.player.bank).toBe(saved);
    if (saved > 0) await expect(page.getByText(`+${saved} banked`)).toBeVisible();
    // the enemy's turn end never saves the player's Flow
    await passTurn(page);
    s = await getState(page);
    expect(s.activePlayer).toBe('player');
    expect(s.players.player.bank).toBe(saved);
  });
}

test('AC67: savings applies to the opponent at the end of its own turn', async ({ page }) => {
  await start(page, { ai: false, setup: { firstPlayer: 'opponent', opponentCrystals: 12 } });
  let s = await getState(page);
  expect(s.activePlayer).toBe('opponent');
  expect(s.players.opponent.bank).toBe(0);
  await passTurn(page);
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  expect(s.players.opponent.crystals).toBe(11);
  expect(s.players.opponent.bank).toBe(1);
});

const spellsOnly = { playerHand: ['fireball', 'fireball'], playerCrystals: 10,
  board: [{ cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 4 }] };
test('AC68: a hand of only affordable spells does not count as moves left', async ({ page }) => {
  await start(page, { ai: false, opponentCommander: 'grubnak', setup: spellsOnly });
  expect(await page.evaluate(async () => await window.oreheart.movesLeft())).toBe(false);
  expect((await legal(page)).some((a) => a.type === 'cast')).toBe(true);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect.poll(async () => (await getState(page)).phase).toBe('action');
  await expect(page.getByRole('dialog', { name: /Moves still available/ })).toHaveCount(0);
});

test('AC68: with auto-skip on, a spells-only turn passes by itself', async ({ page }) => {
  await start(page, { ai: false, autoSkip: true, opponentCommander: 'grubnak', setup: spellsOnly });
  await expect.poll(async () => (await getState(page)).activePlayer, { timeout: 8000 }).toBe('opponent');
  await expect(page.getByRole('dialog', { name: /Moves still available/ })).toHaveCount(0);
});

const previewSetup = { board: [
  { cardId: 'shieldbeard', owner: 'player', row: 5, col: 4 },
  { cardId: 'goblin-scrapper', owner: 'opponent', row: 4, col: 3 },
  { cardId: 'axe-thrower', owner: 'player', row: 3, col: 7 },
  { cardId: 'goblin-scrounger', owner: 'opponent', row: 3, col: 9 },
] };
const preview = (page, uid, target) => page.evaluate(async ([u, t]) => await window.oreheart.previewAttack(u, t), [uid, target]);
test('AC69: previewAttack matches the real attack exactly', async ({ page }) => {
  let s = await start(page, { ai: false, playerCommander: 'borgo', opponentCommander: 'grubnak', setup: previewSetup });
  await done(page);
  s = await getState(page);
  const sb = at(s, 5, 4); const hurler = at(s, 3, 7); const scr = at(s, 3, 9);
  const p1 = await preview(page, sb.uid, { row: 4, col: 3 });
  expect(p1).toMatchObject({ youDeal: 3, youTake: 2, targetDefeated: true, attackerDefeated: false });
  const pc = await preview(page, hurler.uid, { commander: 'opponent' });
  expect(pc).toMatchObject({ youDeal: hurler.attack, youTake: 0, targetDefeated: false, attackerDefeated: false });
  const p2 = await preview(page, hurler.uid, { row: 3, col: 9 });
  expect(p2.youTake).toBe(0);
  expect(JSON.stringify(await getState(page))).toBe(JSON.stringify(s)); // preview never changes the state
  expect((await act(page, { type: 'attack', creatureUid: sb.uid, target: { row: 4, col: 3 } })).ok).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: hurler.uid, target: { row: 3, col: 9 } })).ok).toBe(true);
  const after = await getState(page);
  expect(at(after, 4, 3)).toBeUndefined();
  expect(at(after, 5, 4).health).toBe(sb.health - p1.youTake);
  expect(at(after, 3, 7).health).toBe(hurler.health);
  const scrAfter = at(after, 3, 9);
  if (p2.targetDefeated) expect(scrAfter).toBeUndefined();
  else expect(scrAfter.health).toBe(scr.health - p2.youDeal);
});

test('AC69: dragging a creature over an enemy shows the attack preview; letting go elsewhere cancels', async ({ page }) => {
  await start(page, { ai: false, playerCommander: 'borgo', opponentCommander: 'grubnak', setup: previewSetup });
  await done(page);
  const from = await page.getByLabel('Ironwall Shieldbeard, row 5, column 4', { exact: true }).boundingBox();
  const to = await page.getByLabel('Gutripper Brawler, row 4, column 3', { exact: true }).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  const box = page.getByLabel('Attack preview', { exact: true });
  await expect(box).toBeVisible();
  await expect(box).toContainText('You deal 3 / You take 2');
  await expect(box).toContainText('💀');
  await page.mouse.move(5, 5, { steps: 12 });
  await page.mouse.up();
  await expect(box).toBeHidden();
  const s = await getState(page);
  expect(at(s, 4, 3)).toBeDefined();
  expect(at(s, 5, 4).hasAttacked).toBe(false);
});

test('AC70: double-click and + add cards; single click only enlarges; copy limit and cost chart', async ({ page }) => {
  await openDecks(page);
  const all = allCards(page);
  await all.getByRole('button', { name: 'Shiv Rat', exact: true }).click();
  const view = page.getByRole('dialog', { name: 'Shiv Rat' });
  await expect(view).toBeVisible();
  await view.locator('[data-card-id]').first().click(); // Round 6a: no Close button, click dismisses
  await expect(view).toBeHidden();
  await expect(deckList(page)).not.toContainText('Shiv Rat');
  await all.getByRole('button', { name: 'Grubgrabber Miner', exact: true }).dblclick();
  await expect(deckList(page)).toContainText('1 × Grubgrabber Miner');
  await deckList(page).getByRole('button', { name: 'Add Grubgrabber Miner', exact: true }).click();
  await expect(deckList(page)).toContainText('2 × Grubgrabber Miner');
  await expect(page.getByLabel('Cost chart', { exact: true }).getByLabel('Cost 1: 2 cards', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Deck pile', { exact: true })).toContainText(/2 cards \(50[–-]100\)/);
  await addCard(page, 'Mangewolf Rider', 3);
  await expect(deckList(page)).toContainText('3 × Mangewolf Rider');
  await expect(deckList(page).getByRole('button', { name: 'Add Mangewolf Rider', exact: true })).toBeDisabled();
  await all.getByRole('button', { name: 'Mangewolf Rider', exact: true }).dblclick();
  await expect(deckList(page)).toContainText('3 × Mangewolf Rider');
  await deckList(page).getByRole('button', { name: 'Remove Grubgrabber Miner', exact: true }).click();
  await deckList(page).getByRole('button', { name: 'Remove Grubgrabber Miner', exact: true }).click();
  await expect(deckList(page)).not.toContainText('Grubgrabber Miner');
  await expect(page.getByLabel('Deck pile', { exact: true })).toContainText(/3 cards \(50[–-]100\)/);
});

test('AC71: Auto-fill completes a legal deck; Rename and Save', async ({ page }) => {
  await openDecks(page);
  await renameDeck(page, 'Rat Pack');
  await addCard(page, 'Shiv Rat', 2);
  await page.getByRole('button', { name: 'Auto-fill', exact: true }).click();
  const counts = page.getByLabel('Deck counts', { exact: true });
  await expect(counts).toContainText(/Cards: 50 \(50[–-]100\)/);
  await expect(page.getByLabel('Deck problems', { exact: true })).toContainText('Deck is legal');
  const rat = (await deckList(page).innerText()).match(/(\d+) × Shiv Rat/);
  expect(rat && Number(rat[1])).toBeGreaterThanOrEqual(2);
  const crystals = Number((await counts.innerText()).match(/Crystal cards: (\d+)/)[1]);
  expect(crystals).toBeLessThanOrEqual(4);
  await expect(deckList(page)).toContainText('Miner');
  await saveDeck(page);
  await expect(page.getByLabel('My decks', { exact: true }).getByRole('button', { name: /^Rat Pack/ })).toHaveCount(1);
});

async function makeSelectDecks(page) {
  await openDecks(page);
  await renameDeck(page, 'Miner Rush');
  await addCard(page, 'Grubgrabber Miner', 50);
  await saveDeck(page);
  await page.getByRole('button', { name: 'New Deck', exact: true }).click();
  await renameDeck(page, 'Too Small');
  await addCard(page, 'Shiv Rat');
  await saveDeck(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose Your Commander' })).toBeVisible();
}
const deckRow = (page) => page.getByLabel('Deck choice', { exact: true });
async function keepAndGetState(page) {
  const mull = page.getByRole('dialog', { name: 'Mulligan' });
  await expect(mull).toBeVisible();
  await mull.getByRole('button', { name: 'Keep Hand' }).click();
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  return getState(page);
}
const allIds = (s, side) => [...s.players[side].hand, ...s.players[side].deck, ...s.players[side].discard].map((c) => c.cardId)
  .concat(s.board.creatures.filter((c) => c.owner === side).map((c) => c.cardId));

test('AC72: select screen — Commander cards, deck stacks, difficulty and Fight! (no dropdowns)', async ({ page }) => {
  await makeSelectDecks(page);
  await expect(page.locator('select')).toHaveCount(0);
  for (const n of ['Grubnak Rotgut, King of the Junkpile', 'Archmagister Sproingle the Unfathomable', 'Thane Borgo Gravelgrim']) {
    await expect(page.getByRole('button', { name: n, exact: true })).toBeVisible();
  }
  const stacks = deckRow(page).getByRole('button', { name: /cards, (ready|not ready)$/ });
  await expect(stacks.first()).toHaveAccessibleName('Goblin Warband, 100 cards, ready');
  // Round 8b: only the selected Commander's decks (Grubnak by default)
  for (const f of ['Goblin', 'Gnome', 'Dwarf']) for (const st of ['Warband', 'Arcane Hoard', 'Horde']) {
    await expect(deckRow(page).getByRole('button', { name: `${f} ${st}, 100 cards, ready`, exact: true })).toHaveCount(f === 'Goblin' ? 1 : 0);
  }
  await expect(deckRow(page).getByRole('button', { name: 'Miner Rush, 50 cards, ready', exact: true })).toHaveCount(1);
  const small = deckRow(page).getByRole('button', { name: /^Too Small, 1 cards?, not ready$/ });
  await expect(small).toHaveAttribute('aria-disabled', 'true');
  await small.click({ force: true });
  await expect(page.getByLabel('Deck message', { exact: true })).toContainText('Needs 50 to 100 cards (now 1).');
  await expect(small).not.toHaveAttribute('aria-pressed', 'true');
  for (const d of ['Easy', 'Normal', 'Hard']) await expect(page.getByRole('button', { name: d, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Grubnak Rotgut, King of the Junkpile', exact: true }).click();
  await deckRow(page).getByRole('button', { name: 'Miner Rush, 50 cards, ready', exact: true }).click();
  await expect(deckRow(page).getByRole('button', { name: 'Miner Rush, 50 cards, ready', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Hard', exact: true }).click();
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  const s = await keepAndGetState(page);
  expect(s.difficulty).toBe('hard');
  const ids = allIds(s, 'player');
  expect(ids.length).toBe(50);
  expect(ids.every((id) => id === 'goblin-scrounger')).toBe(true);
  expect(allIds(s, 'opponent').some((id) => id !== 'goblin-scrounger')).toBe(true);
});

test('AC72: "+ New Deck" on the select screen opens the Deck Builder', async ({ page }) => {
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await deckRow(page).getByRole('button', { name: '+ New Deck', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
});

test('AC73: the select screen remembers the last Commander, deck and difficulty', async ({ page }) => {
  await makeSelectDecks(page);
  await page.getByRole('button', { name: 'Archmagister Sproingle the Unfathomable', exact: true }).click();
  await deckRow(page).getByRole('button', { name: 'Miner Rush, 50 cards, ready', exact: true }).click();
  await page.getByRole('button', { name: 'Hard', exact: true }).click();
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  await keepAndGetState(page);
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Archmagister Sproingle the Unfathomable', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(deckRow(page).getByRole('button', { name: 'Miner Rush, 50 cards, ready', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Hard', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

async function surrenderViaMenu(page) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Surrender', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, surrender' }).click();
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible({ timeout: 15000 });
}
test('AC74: match-end summary, Play again with the same choices, and Menu', async ({ page }) => {
  await page.goto('/?test=1&seed=5');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Thane Borgo Gravelgrim', exact: true }).click();
  await deckRow(page).getByRole('button', { name: 'Dwarf Warband, 100 cards, ready', exact: true }).click();
  await page.getByRole('button', { name: 'Hard', exact: true }).click();
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  await keepAndGetState(page);
  await surrenderViaMenu(page);
  const sum = page.getByLabel('Match summary', { exact: true });
  await expect(sum).toBeVisible();
  for (const t of ['Crystals mined', 'Creatures summoned', 'Creatures lost', 'Turns', 'MVP']) await expect(sum).toContainText(t);
  await page.getByRole('button', { name: 'Play again', exact: true }).click();
  const s = await keepAndGetState(page);
  expect(s.players.player.commanderId).toBe('borgo');
  expect(s.difficulty).toBe('hard');
  expect(s.winner).toBeNull();
  expect(allIds(s, 'player').length).toBe(100);
  await surrenderViaMenu(page);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
});

const TUTORIAL_STEPS = ['summon', 'move', 'mine', 'mineTap', 'spend', 'crystal', 'upgrade', 'swap', 'fight', 'spell', 'savings', 'commander'];
const TUTORIAL_WORDS = { summon: /back row/i, mineTap: /Tap the mine/i, spend: /Flow/, crystal: /Bank/, upgrade: /upgrade/i,
  fight: /You deal/, savings: /banked/i, commander: /Commander/ };
// Round 3b (AC125): rewritten tips also teach the features added since Phase 1A
const TUTORIAL_WORDS_3B = { summon: /corner/i, move: /zoom/i, spell: /Full explanation/i, savings: /Last turn/i };
test('AC75 + AC125: the tutorial runs to the end, teaching only the current rules', async ({ page }) => {
  test.setTimeout(180000);
  await openTest(page);
  await page.evaluate(async () => await window.oreheart.startTutorial());
  const tip = page.getByLabel('Tutorial tip', { exact: true });
  const seen = [];
  let s;
  for (let i = 0, actions = 0; i < 600 && actions < 200; i++) {
    s = await getState(page);
    if (s.phase === 'over' || s.tutorial.step === 'complete') break;
    const step = s.tutorial.step;
    if (!seen.includes(step)) {
      seen.push(step);
      if (TUTORIAL_WORDS[step]) await expect(tip).toContainText(TUTORIAL_WORDS[step]);
      if (TUTORIAL_WORDS_3B[step]) await expect(tip).toContainText(TUTORIAL_WORDS_3B[step]);
      expect(await tip.innerText()).not.toMatch(/column 7|top of the screen|bottom center/i);
      expect(await tip.innerText()).not.toMatch(/off-color|Gatherer|Mine All|green crystals?|purple crystals?|blue crystals?|white crystals?/i);
    }
    if (s.priority !== 'player') { await page.waitForTimeout(150); continue; }
    if (s.pendingResponse) { await act(page, { type: 'pass' }); continue; }
    const a = await page.evaluate(async () => await window.oreheart.tutorialAction());
    if (!a) break;
    const r = await act(page, a);
    expect(r.ok, `${step}: ${JSON.stringify(a)} -> ${JSON.stringify(r)}`).toBe(true);
    actions++;
  }
  expect(seen).toEqual(TUTORIAL_STEPS);
  await expect.poll(async () => (await getState(page)).tutorial.step, { timeout: 10000 }).toBe('complete');
  expect((await getState(page)).winner).toBe('player');
  await expect(page.getByRole('heading', { name: 'Victory!' })).toBeVisible({ timeout: 15000 });
});

test('AC76: the Last turn recap lists what the enemy did', async ({ page }) => {
  let s = await start(page, { ai: false, opponentCommander: 'grubnak', setup: {
    opponentHand: ['goblin-scrapper'], opponentCrystals: 10,
    board: [{ cardId: 'goblin-scrounger', owner: 'opponent', row: 2, col: 11 }] } });
  const btn = page.getByRole('button', { name: 'Last turn', exact: true });
  await openMatchMenu(page);
  await btn.click();
  const dlg = page.getByRole('dialog', { name: 'Last turn' });
  await expect(dlg).toContainText('Nothing yet.');
  await dlg.getByRole('button', { name: 'Close' }).click();
  await passTurn(page);
  const summon = (await legal(page)).find((a) => a.type === 'summon');
  expect((await act(page, summon)).ok).toBe(true);
  await done(page);
  s = await getState(page);
  const mv = (await legal(page)).find((a) => a.type === 'move' && a.creatureUid === at(s, 2, 11).uid);
  expect((await act(page, mv)).ok).toBe(true);
  await done(page);
  expect((await getState(page)).activePlayer).toBe('player');
  await openMatchMenu(page);
  await btn.click();
  await expect(dlg).toContainText('Summoned Gutripper Brawler');
  await expect(dlg).toContainText('Moved Grubgrabber Miner');
});

test('AC77: a mine with ready Miners shows the swinging pickaxe count; it goes once they mined', async ({ page }) => {
  await start(page, { ai: false, setup: { board: [
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1 },
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 2 },
  ] } });
  await done(page);
  const m1 = page.getByRole('button', { name: `Crystal site, row ${M1.row}, column ${M1.col}`, exact: true });
  await expect(m1).toHaveAttribute('data-ready-miners', '2');
  await expect(m1).toContainText('×2');
  await m1.click();
  await expect(m1).toHaveAttribute('data-ready-miners', '0');
  await expect(m1).not.toContainText('×');
  const s = await getState(page);
  expect(at(s, 5, 1).hasMined && at(s, 5, 2).hasMined).toBe(true);
});

// =====================================================================
// Phase 1B, Round 1 — art and sound (AC79–AC90)
// =====================================================================
async function appDir() {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.APP_DIR && path.resolve(process.env.APP_DIR),
    path.resolve(here, '../../../projects/oreheart-8'),
    path.resolve(process.cwd(), 'projects/oreheart-8'),
    path.resolve(process.cwd(), '../projects/oreheart-8'),
  ].filter(Boolean);
  const dir = candidates.find((d) => fs.existsSync(path.join(d, 'package.json')));
  expect(dir, `app folder not found in ${candidates.join(', ')}`).toBeTruthy();
  return { fs, path, dir };
}
function walk(fs, path, dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(fs, path, p) : [p];
  });
}
const goblinCreatures = async (page) =>
  (await page.evaluate(async () => await window.oreheart.listCards()))
    .filter((c) => c.faction === 'goblins' && c.type === 'creature');

test('AC79: main menu shows the logo as the h1, the tagline and the five plaques', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openMenu(page);
  const h1 = page.getByRole('heading', { level: 1, name: 'Oreheart' });
  await expect(h1).toBeVisible();
  const logo = h1.getByRole('img', { name: 'Oreheart' });
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.getByText('Goblins, Gnomes and Dwarves fight over the Soul Crystals.', { exact: true })).toBeVisible();
  expect(await page.locator('link[rel~="icon"]').count()).toBeGreaterThan(0);
  const names = (await page.getByRole('button').allInnerTexts()).map((t) => t.trim());
  expect(names).toEqual(['Play', 'Tutorial', 'Decks', 'Rules', 'Settings']);
  expect(errors).toEqual([]);
});

test('AC80: every Goblin creature has a finished figure; Gnomes and Dwarves are placeholders', async ({ page }) => {
  await openTest(page);
  const all = await page.evaluate(async () => await window.oreheart.listCards());
  const goblins = all.filter((c) => c.faction === 'goblins' && c.type === 'creature');
  expect(goblins.length).toBeGreaterThanOrEqual(16);
  for (const id of ['goblin-scrounger', 'goblin-scrapper', 'goblin-smith-miner', 'shard-guzzler', 'blastrat-sapper']) {
    expect(goblins.map((c) => c.id)).toContain(id);
  }
  for (const c of all) {
    const info = await page.evaluate(async (id) => await window.oreheart.getArtInfo(id), c.id);
    if (c.type !== 'creature') expect(info.figure, c.id).toBeNull();
    else if (c.faction === 'goblins') expect(info.figure, c.id).toBe('finished');
    else if (c.faction === 'gnomes' || c.faction === 'dwarves') expect(info.figure, c.id).toBe('placeholder');
  }
});

test('AC81: every Goblin creature has a committed WebP card picture and an art entry', async ({ page }) => {
  await openTest(page);
  const goblins = await goblinCreatures(page);
  const { fs, path, dir } = await appDir();
  const art = JSON.parse(fs.readFileSync(path.join(dir, 'src/content/card-art.json'), 'utf8'));
  const entries = Array.isArray(art) ? art : art.entries || Object.values(art);
  expect(fs.existsSync(path.join(dir, 'tools/gen-card-art.mjs'))).toBe(true);
  for (const c of goblins) {
    const info = await page.evaluate(async (id) => await window.oreheart.getArtInfo(id), c.id);
    expect(info.picture, c.id).toBe(`/art/cards/${c.id}.webp`);
    const res = await page.request.get(info.picture);
    expect(res.status(), c.id).toBe(200);
    const body = await res.body();
    expect(body.length, c.id).toBeLessThan(200 * 1024);
    expect(body.subarray(0, 4).toString('latin1'), c.id).toBe('RIFF');
    expect(body.subarray(8, 12).toString('latin1'), c.id).toBe('WEBP');
    const entry = entries.find((e) => e.cardId === c.id);
    expect(entry, `card-art.json entry for ${c.id}`).toBeTruthy();
    expect(entry.file).toBe(`art/cards/${c.id}.webp`);
    expect(entry.prompt.toLowerCase()).toContain('no text');
  }
  const key = process.env.XAI_API_KEY;
  if (key) {
    for (const f of walk(fs, path, path.join(dir, 'src')).concat(walk(fs, path, path.join(dir, 'dist')))) {
      if (/\.(js|ts|mjs|json|html|css)$/.test(f)) expect(fs.readFileSync(f, 'utf8').includes(key), f).toBe(false);
    }
  }
});

test('AC82: every card has a tagline and a flavor line', async ({ page }) => {
  await openTest(page);
  const all = await page.evaluate(async () => await window.oreheart.listCards());
  expect(all.length).toBeGreaterThan(40);
  for (const c of all) {
    expect(typeof c.tagline === 'string' && c.tagline.trim().length > 0, `${c.id} tagline`).toBe(true);
    expect(typeof c.flavor === 'string' && c.flavor.trim().length > 0, `${c.id} flavor`).toBe(true);
  }
  const one = await page.evaluate(async () => await window.oreheart.getCard('goblin-scrapper'));
  expect(one.tagline.trim().length).toBeGreaterThan(0);
  expect(one.flavor.trim().length).toBeGreaterThan(0);
});

test('AC83: a Goblin hand card uses the new card face with its picture and rarity', async ({ page }) => {
  await start(page, { ai: false, setup: { playerHand: ['goblin-scrapper'] } });
  const hand = page.getByLabel('Your hand', { exact: true });
  const btn = hand.getByRole('button', { name: 'Gutripper Brawler' });
  await expect(btn).toBeVisible();
  const face = hand.locator('[data-card-id="goblin-scrapper"]').first();
  await expect(face).toBeAttached();
  const rarity = await face.getAttribute('data-rarity');
  expect(['common', 'uncommon', 'rare', 'ultra-rare', 'collector']).toContain(rarity);
  const img = face.locator('img[src*="/art/cards/goblin-scrapper.webp"]');
  await expect(img.first()).toBeAttached();
});

test('AC84: finished Goblin figures, Grubnak, Strongholds and mines on the battlefield', async ({ page }) => {
  await start(page, {
    ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle',
    setup: { board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 },
      { cardId: 'goblin-scrounger', owner: 'player', row: 6, col: 5 },
      { cardId: 'gnome-tinker', owner: 'opponent', row: 0, col: 4 },
    ] },
  });
  const r = await page.evaluate(async () => await window.oreheart.getRenderStats());
  const s = await getState(page);
  expect(r.figures.length).toBe(3);
  for (const f of r.figures) {
    const c = s.board.creatures.find((x) => x.uid === f.uid);
    expect(c, f.uid).toBeTruthy();
    expect(f.model, f.cardId).toBe(c.cardId.startsWith('gnome') ? 'placeholder' : 'finished');
  }
  expect(r.commanders.player).toMatchObject({ commanderId: 'grubnak', model: 'finished' });
  expect(r.commanders.opponent).toMatchObject({ commanderId: 'sproingle', model: 'placeholder' });
  expect(r.strongholds).toEqual({ player: 'finished', opponent: 'finished' });
  expect(r.mines).toBe('finished');
});

test('AC85: poking a Goblin figure plays a reaction and changes nothing', async ({ page }) => {
  await start(page, { ai: false, setup: { board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 }] } });
  const before = await getState(page);
  const uid = before.board.creatures[0].uid;
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    const r = await page.evaluate(async (u) => await window.oreheart.poke(u), uid);
    expect(['cackle', 'rude dance', 'angry stomp']).toContain(r);
    seen.add(r);
  }
  expect(await getState(page)).toEqual(before);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('AC86: CREDITS.md lists fonts, card pictures and every outside asset file', async () => {
  const { fs, path, dir } = await appDir();
  const credits = path.join(dir, 'CREDITS.md');
  expect(fs.existsSync(credits), 'CREDITS.md').toBe(true);
  const text = fs.readFileSync(credits, 'utf8');
  expect(text).toContain('Alegreya SC'); // Round 5a: the one bundled font
  expect(text).toContain('art/cards');
  expect(/xai|grok/i.test(text)).toBe(true);
  const files = walk(fs, path, path.join(dir, 'public/assets/external')).concat(walk(fs, path, path.join(dir, 'dist/assets/external')));
  for (const f of files) expect(text.includes(path.basename(f)), `${path.basename(f)} in CREDITS.md`).toBe(true);
});

test('AC87: sound stays locked until the first tap', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openTest(page);
  const a = await page.evaluate(async () => await window.oreheart.getAudioState());
  expect(a.unlocked).toBe(false);
  await page.mouse.click(5, 5); // a tap anywhere counts as the first gesture
  await expect.poll(async () => (await page.evaluate(async () => await window.oreheart.getAudioState())).unlocked).toBe(true);
  expect(errors).toEqual([]);
});

test('AC88: volume sliders and the match mute button are remembered', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const sfx = page.getByLabel('Sound effects', { exact: true });
  const voices = page.getByLabel('Voices', { exact: true });
  await expect(sfx).toHaveValue('80');
  await expect(voices).toHaveValue('80');
  await sfx.fill('35');
  await voices.fill('10');
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Sound effects', { exact: true })).toHaveValue('35');
  await expect(page.getByLabel('Voices', { exact: true })).toHaveValue('10');

  await start(page, { ai: false });
  let a = await page.evaluate(async () => await window.oreheart.getAudioState());
  expect(a).toMatchObject({ muted: false, sfxVolume: 35, voiceVolume: 10 });
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute sound', exact: true })).toBeVisible();
  a = await page.evaluate(async () => await window.oreheart.getAudioState());
  expect(a.muted).toBe(true);
  await start(page, { ai: false });
  await expect(page.getByRole('button', { name: 'Unmute sound', exact: true })).toBeVisible();
  expect((await page.evaluate(async () => await window.oreheart.getAudioState())).muted).toBe(true);
  await page.getByRole('button', { name: 'Unmute sound', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute sound', exact: true })).toBeVisible();
});

test('AC89: Low graphics turns off bloom, shadows and particles and uses fewer draw calls', async ({ page }) => {
  const setup = { ai: false, seed: 7, mines: OLD_MINES, setup: { board: [
    { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 },
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 2 },
    { cardId: 'gnome-tinker', owner: 'opponent', row: 0, col: 4 },
  ] } };
  await start(page, setup);
  const high = await page.evaluate(async () => await window.oreheart.getRenderStats());
  expect(high.graphics).toBe('high');
  expect(high.webgl).toBe(true);
  expect(high.drawCalls).toBeGreaterThan(0);

  await openMenu(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Graphics: High' }).click();
  await expect(page.getByRole('button', { name: 'Graphics: Low' })).toBeVisible();

  await start(page, setup);
  const low = await page.evaluate(async () => await window.oreheart.getRenderStats());
  expect(low.graphics).toBe('low');
  expect(low).toMatchObject({ bloom: false, shadows: false, particles: false });
  expect(low.drawCalls).toBeLessThan(high.drawCalls);
});

test('AC90: the built dist folder stays under 40 MB', async () => {
  const { fs, path, dir } = await appDir();
  const dist = path.join(dir, 'dist');
  expect(fs.existsSync(path.join(dist, 'index.html')), 'dist/index.html').toBe(true);
  const bytes = walk(fs, path, dist).reduce((n, f) => n + fs.statSync(f).size, 0);
  expect(bytes).toBeLessThan(40 * 1024 * 1024);
});

test.describe('phone-size match screenshot', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('AC90: the match screen renders full screen at 844x390 with no page errors', async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await start(page, { ai: false, setup: { playerHand: ['goblin-scrapper', 'goblin-scrounger', 'goblin-slinger'], board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 },
      { cardId: 'gnome-tinker', owner: 'opponent', row: 0, col: 4 },
    ] } });
    const field = page.getByLabel('Battlefield', { exact: true });
    await expect(field).toBeVisible();
    const box = await field.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(840);
    expect(box.height).toBeGreaterThanOrEqual(386);
    await page.evaluate(async () => await window.oreheart.getRenderStats());
    await testInfo.attach('match-844x390', { body: await page.screenshot(), contentType: 'image/png' });
    expect(errors).toEqual([]);
  });
});

// ---------- Phase 1B Round 2 (Build A): AC91–AC108 ----------
const fxLog = (page) => page.evaluate(async () => await window.oreheart.getFxLog());
const clearFx = (page) => page.evaluate(async () => await window.oreheart.clearFxLog());
const idx = (log, pred, from = 0) => log.findIndex((e, i) => i >= from && pred(e));
const FRAME = { goblins: 'goblin', gnomes: 'gnome', dwarves: 'dwarf' };
const RARITY_WORD = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', 'ultra-rare': 'Ultra Rare', collector: 'Collector' };
const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
const quiet = (extra) => ({ ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: { opponentHand: [], ...extra } });

test('AC91: card faces use the faction frame, stat slots, type icon and rarity colors', async ({ page }) => {
  await openTest(page);
  const cards = await page.evaluate(async () => await window.oreheart.listCards());
  const pick = new Map();
  for (const f of ['goblins', 'gnomes', 'dwarves']) { const c = cards.find((x) => x.faction === f && x.type === 'creature'); if (c) pick.set(c.id, c); }
  for (const r of Object.keys(RARITY_WORD)) { const c = cards.find((x) => x.rarity === r); if (c) pick.set(c.id, c); }
  for (const id of ['fireball', 'soul-shard']) pick.set(id, cards.find((x) => x.id === id));
  await newMatch(page, quiet({ playerHand: [...pick.keys()] }));
  const hand = page.getByLabel('Your hand', { exact: true });
  for (const [id, c] of pick) {
    const face = hand.locator(`[data-card-id="${id}"]`).first();
    await expect(face, id).toBeAttached();
    const spell = c.type === 'spell'; // Round 4: spells use the spell frames
    const frame = spell ? (FRAME[c.faction] || 'shared') : (FRAME[c.faction] || 'neutral');
    await expect(face, id).toHaveAttribute('data-frame', spell ? `spell-${frame}` : frame);
    expect(await face.locator(`img[src*="${spell ? 'spell' : 'card'}-frame-${frame}"]`).count(), id).toBeGreaterThan(0);
    await expect(face.getByLabel(/^Cost \d+$/), id).toHaveCount(1); // may show a Commander discount
    await expect(face.getByLabel(/^Type: /), id).toHaveCount(1);
    if (c.type === 'creature') {
      await expect(face.getByLabel(/^Attack \d+$/), id).toHaveCount(1);
      await expect(face.getByLabel(/^Health \d+$/), id).toHaveCount(1);
      await expect(face.getByLabel(/^Movement \d+$/), id).toHaveCount(1);
    } else {
      await expect(face.getByLabel(/^(Attack|Health|Movement) \d+$/), id).toHaveCount(0);
    }
    const word = RARITY_WORD[c.rarity];
    const gem = face.getByLabel(`Rarity: ${word}`, { exact: true });
    await expect(gem, id).toHaveCount(1);
    await expect(gem, id).toContainText(word);
    const st = await gem.evaluate((e) => ({ color: getComputedStyle(e).color, anim: getComputedStyle(e).animationName }));
    const [r, g, b] = rgb(st.color);
    if (c.rarity === 'common') expect(Math.min(r, g, b), id).toBeGreaterThanOrEqual(220);
    if (c.rarity === 'uncommon') { expect(b - r, id).toBeGreaterThanOrEqual(40); expect(b, id).toBeGreaterThanOrEqual(g); }
    if (c.rarity === 'rare') { expect(r - g, id).toBeGreaterThanOrEqual(40); expect(b - g, id).toBeGreaterThanOrEqual(40); }
    if (c.rarity === 'ultra-rare') { expect(r - g, id).toBeGreaterThanOrEqual(60); expect(r - b, id).toBeGreaterThanOrEqual(60); }
    if (c.rarity === 'collector') expect(st.anim, id).not.toBe('none');
  }
});

test('AC92: every card has short and long text; Full explanation shows the long text', async ({ page }) => {
  await openTest(page);
  const cards = await page.evaluate(async () => await window.oreheart.listCards());
  for (const c of cards) {
    expect(typeof c.shortText, c.id).toBe('string');
    expect(c.shortText.length, c.id).toBeGreaterThan(0);
    expect(c.shortText.length, c.id).toBeLessThanOrEqual(80);
    expect(c.longText.length, c.id).toBeGreaterThan(c.shortText.length);
    expect(c.longText, c.id).toContain('Example:');
    expect(c.text, c.id).toBe(c.shortText);
  }
  const sb = cards.find((c) => c.id === 'shieldbeard');
  expect(sb.longText).toContain('Guard: adjacent enemies must attack it first');
  await newMatch(page, quiet({ playerHand: ['shieldbeard', 'goblin-slinger'] }));
  const hand = page.getByLabel('Your hand', { exact: true });
  await expect(hand.getByRole('button', { name: 'Ironwall Shieldbeard', exact: true })).toContainText(sb.shortText);
  await hand.getByRole('button', { name: 'Ironwall Shieldbeard', exact: true }).click();
  const view = page.getByRole('dialog', { name: 'Ironwall Shieldbeard', exact: true });
  await expect(view).toBeVisible();
  await view.getByRole('button', { name: 'Full explanation' }).click();
  const more = page.getByRole('dialog', { name: 'Ironwall Shieldbeard: full explanation' });
  await expect(more).toBeVisible();
  await expect(more).toContainText('Guard: adjacent enemies must attack it first');
  await expect(more).toContainText('Example:');
});

async function expectDeckImage(loc, label) {
  const img = loc.locator('img[src*="deck-pile"]').first();
  await expect(img, label).toBeAttached();
  await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0), { message: label }).toBe(true);
  const corners = await img.evaluate((i) => {
    const c = document.createElement('canvas');
    c.width = i.naturalWidth; c.height = i.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(i, 0, 0);
    const w = c.width - 2, h = c.height - 2;
    return [[1, 1], [w, 1], [1, h], [w, h]].map(([a, b]) => x.getImageData(a, b, 1, 1).data[3]);
  });
  expect(corners, label).toEqual([0, 0, 0, 0]);
}
test('AC93: the cut-out deck image is used on every deck pile outside the match', async ({ page }) => {
  // Round 7: the owner's deck-pile.png is used on every deck pile (the match piles are checked in AC176)
  await openDecks(page);
  await expectDeckImage(page.getByLabel('Deck pile', { exact: true }), 'Deck pile');
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expectDeckImage(page.getByLabel('Deck choice', { exact: true }), 'Deck choice');
});

test('AC94: Commander select shows borderless full-art Commander cards without stats', async ({ page }) => {
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  for (const [name, id, faction] of [['Grubnak Rotgut, King of the Junkpile', 'grubnak', 'Goblins'],
    ['Archmagister Sproingle the Unfathomable', 'sproingle', 'Gnomes'], ['Thane Borgo Gravelgrim', 'borgo', 'Dwarves']]) {
    const btn = page.getByRole('button', { name });
    await expect(btn).toBeVisible();
    const img = btn.locator(`img[src*="/art/commanders/${id}.webp"]`);
    await expect(img).toHaveCount(1);
    await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
    await expect(btn).toContainText(faction);
    await expect(btn.getByLabel(/^(Cost|Attack|Health|Movement) /)).toHaveCount(0);
  }
});

test('AC95: up to 3 mulligans — 5 -> 5 -> 4 -> 3, then no more', async ({ page }) => {
  let s = await start(page, { ai: false, firstPlayer: 'player' });
  expect(s.phase).toBe('mulligan');
  expect(s.priority).toBe('player');
  const hand = () => s.players.player.hand.map((c) => c.uid);
  expect((await act(page, { type: 'mulligan', uids: hand() })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.hand.length).toBe(5);
  expect(s.players.player.mulligans).toBe(1);
  expect(s.priority).toBe('player');
  expect((await act(page, { type: 'mulligan', uids: hand().slice(0, 2) })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.hand.length).toBe(4);
  expect(s.players.player.mulligans).toBe(2);
  expect((await act(page, { type: 'mulligan', uids: hand().slice(0, 1) })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.hand.length).toBe(3);
  expect(s.players.player.mulligans).toBe(3);
  expect(s.phase === 'mulligan' ? s.priority : 'done').not.toBe('player');
  const r = await act(page, { type: 'mulligan', uids: hand().slice(0, 1) });
  expect(r.ok).toBe(false);
  expect((await getState(page)).players.player.hand.length).toBe(3);
});

test('AC95: the Mulligan screen shows one straight row and counts mulligans left', async ({ page }) => {
  await page.goto('/?test=1&seed=7');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Grubnak Rotgut, King of the Junkpile' }).click();
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  const mull = page.getByRole('dialog', { name: 'Mulligan' });
  await expect(mull).toBeVisible();
  await expect(mull).toContainText('Mulligans left: 3');
  const faces = mull.locator('[data-card-id]');
  await expect(faces).toHaveCount(5);
  const boxes = [];
  for (let i = 0; i < 5; i++) boxes.push(await faces.nth(i).boundingBox());
  boxes.sort((a, b) => a.x - b.x);
  for (let i = 1; i < 5; i++) {
    expect(Math.abs(boxes[i].y - boxes[0].y)).toBeLessThanOrEqual(2);
    expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width - 1);
  }
  await faces.first().click();
  await mull.getByRole('button', { name: 'Redraw Selected' }).click();
  await expect(mull).toContainText('Mulligans left: 2');
  await expect(faces).toHaveCount(5);
  await mull.getByRole('button', { name: 'Keep Hand' }).click();
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
});

const boxless = (loc) => loc.evaluate((e) => {
  const cs = getComputedStyle(e);
  const m = cs.backgroundColor.match(/[\d.]+/g) || [0, 0, 0, 0];
  return { alpha: m.length > 3 ? Number(m[3]) : (cs.backgroundColor === 'transparent' ? 0 : 1), image: cs.backgroundImage };
});
const ornate = (loc) => loc.evaluate((e) => {
  const cs = getComputedStyle(e);
  return cs.backgroundImage !== 'none' || (cs.borderImageSource && cs.borderImageSource !== 'none');
});
test('AC96: dialogs float with no box; buttons are ornate', async ({ page }) => {
  await page.goto('/?test=1&seed=7');
  expect(await ornate(page.getByRole('button', { name: 'Play', exact: true }))).toBe(true);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Grubnak Rotgut, King of the Junkpile' }).click();
  expect(await ornate(page.getByRole('button', { name: 'Fight!', exact: true }))).toBe(true);
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  const mull = page.getByRole('dialog', { name: 'Mulligan' });
  await expect(mull).toBeVisible();
  let b = await boxless(mull);
  expect(b.alpha).toBeLessThanOrEqual(0.35);
  expect(b.image).toBe('none');
  await newMatch(page, quiet({ playerHand: ['fireball'] }));
  expect(await boxedButtons(page, ['Done'])).toEqual([]); // Round 5b: plain text
  await page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Searing Arcane Orb', exact: true }).click();
  const view = page.getByRole('dialog', { name: 'Searing Arcane Orb', exact: true });
  await expect(view).toBeVisible();
  b = await boxless(view);
  expect(b.alpha).toBeLessThanOrEqual(0.35);
  expect(b.image).toBe('none');
  const s = await start(page, respondR6(['fizzle', 'crystal-cluster'], 1));
  await castFireball(page, s);
  const dlg = page.getByRole('dialog', { name: 'Respond?' });
  await expect(dlg).toBeVisible();
  b = await boxless(dlg);
  expect(b.alpha).toBeLessThanOrEqual(0.35);
  expect(b.image).toBe('none');
});

test('AC97: card reveals never block the game and can be pinned', async ({ page }) => {
  await page.goto('/?test=1&seed=123&fx=1');
  await page.waitForFunction(() => !!window.oreheart);
  const s = await newMatch(page, respondR6([], 0));
  await castFireball(page, s);
  const reveal = page.getByLabel('Card reveal', { exact: true });
  await expect(reveal).toBeVisible();
  await expect(reveal).toContainText('Searing Arcane Orb');
  expect(at(await getState(page), 6, 4)).toBeUndefined(); // already resolved underneath
  await reveal.click();
  await expect(reveal).toHaveAttribute('data-pinned', 'true');
  await page.waitForTimeout(4000);
  await expect(reveal).toBeVisible();
  await reveal.click();
  await expect(reveal).toBeHidden();
});

test('AC98: tapping a creature shows its card and changes nothing', async ({ page }) => {
  const before = await start(page, quiet({ board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 7, col: 3 }] }));
  await page.getByLabel('Gutripper Brawler, row 7, column 3', { exact: true }).click();
  const card = page.getByRole('dialog', { name: 'Gutripper Brawler', exact: true });
  await expect(card).toBeVisible();
  await expect(card.locator('[data-card-id="goblin-scrapper"]')).toHaveCount(1);
  expect(await getState(page)).toEqual(before);
  await card.getByRole('button', { name: 'Close' }).click();
  await expect(card).toBeHidden();
});

const orbSetup = quiet({ playerHand: ['fireball', 'fireball'], playerCrystals: 6, board: [
  { cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 3 },
  { cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 5 },
] });
const castOrb = async (page, row, col) => {
  const s = await getState(page);
  const uid = s.players.player.hand.find((c) => c.cardId === 'fireball').uid;
  expect((await act(page, { type: 'cast', uid, target: { row, col } })).ok).toBe(true);
};
test('AC99: the Card pop-ups switch skips reveals but never effects, and is remembered', async ({ page }) => {
  await start(page, orbSetup);
  const sw = page.getByRole('switch', { name: 'Card pop-ups' });
  await openMatchMenu(page);
  await expect(sw).toBeVisible();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await clearFx(page);
  await castOrb(page, 3, 3);
  let log = await fxLog(page);
  const r = idx(log, (e) => e.kind === 'reveal' && e.cardId === 'fireball');
  expect(r).toBeGreaterThanOrEqual(0);
  expect(idx(log, (e) => e.kind === 'effect' && e.cardId === 'fireball', r)).toBeGreaterThan(r);
  expect(idx(log, (e) => e.kind === 'impact')).toBeGreaterThan(r);
  if (!(await sw.isVisible())) await openMatchMenu(page);
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await clearFx(page);
  await castOrb(page, 3, 5);
  log = await fxLog(page);
  expect(log.some((e) => e.kind === 'reveal')).toBe(false);
  expect(log.some((e) => e.kind === 'effect' && e.cardId === 'fireball')).toBe(true);
  expect(log.some((e) => e.kind === 'impact')).toBe(true);
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Card pop-ups' })).toHaveAttribute('aria-checked', 'false');
});

test('AC100: spells play step by step and nothing vanishes without a cause', async ({ page }) => {
  let s = await start(page, orbSetup);
  const victim = at(s, 3, 3).uid;
  await clearFx(page);
  const before = at(s, 3, 3).health; // includes Commander bonuses (Borgo: +1 Health)
  await castOrb(page, 3, 3);
  s = await getState(page);
  if (before > 3) { // Searing Arcane Orb deals exactly 3: it survives, so a second Orb finishes it
    expect(at(s, 3, 3).health).toBe(before - 3);
    await castOrb(page, 3, 3);
  }
  expect(at(await getState(page), 3, 3)).toBeUndefined();
  let log = await fxLog(page);
  const e = idx(log, (x) => x.kind === 'effect' && x.cardId === 'fireball');
  const i = idx(log, (x) => x.kind === 'impact', e);
  const d = idx(log, (x) => x.kind === 'damage' && x.uid === victim, i);
  const dl = log.map((x, n) => (x.kind === 'damage' && x.uid === victim ? n : -1)).filter((n) => n >= 0).pop();
  const k = idx(log, (x) => x.kind === 'defeat' && x.uid === victim, dl);
  expect([e, i, d, k].every((n) => n >= 0)).toBe(true);
  // counterspell: the countered card shatters
  s = await start(page, respondR6(['fizzle', 'crystal-cluster'], 1));
  await castFireball(page, s);
  s = await getState(page);
  expect((await act(page, { type: 'respond', uid: handUid(s, 'player', 'fizzle'), crystalUid: handUid(s, 'player', 'crystal-cluster') })).ok).toBe(true);
  log = await fxLog(page);
  expect(log.some((x) => x.kind === 'shatter' && x.cardId === 'fireball')).toBe(true);
  // Pickpocket!: the returned creature gets a bounce
  s = await start(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo',
    setup: { playerHand: ['goblin-scrapper'], playerCrystals: 5, opponentHand: ['hold-it'], opponentCrystals: 4 } });
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrapper'), row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  expect((await act(page, { type: 'respond', uid: handUid(s, 'opponent', 'hold-it') })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.hand.some((c) => c.cardId === 'goblin-scrapper')).toBe(true);
  log = await fxLog(page);
  expect(log.some((x) => x.kind === 'bounce')).toBe(true);
});

test('AC101: Blastrat Sapper carries a bomb: drop, KA-BOOM, then 1 damage to the adjacent enemy', async ({ page }) => {
  let s = await start(page, quiet({ playerHand: ['fireball'], playerCrystals: 3, board: [
    { cardId: 'blastrat-sapper', owner: 'opponent', row: 3, col: 4 },
    { cardId: 'goblin-scrapper', owner: 'player', row: 4, col: 4 },
  ] }));
  const sapper = at(s, 3, 4).uid;
  const brawler = at(s, 4, 4);
  const stats = await page.evaluate(async () => await window.oreheart.getRenderStats());
  expect(stats.figures.find((f) => f.uid === sapper).bomb).toBe(true);
  expect(stats.figures.find((f) => f.uid === brawler.uid).bomb).toBe(false);
  await clearFx(page);
  await castOrb(page, 3, 4);
  s = await getState(page);
  expect(at(s, 3, 4)).toBeUndefined();
  expect(at(s, 4, 4).health).toBe(brawler.health - 1);
  const log = await fxLog(page);
  const drop = idx(log, (x) => x.kind === 'bombDrop' && x.uid === sapper);
  const boom = idx(log, (x) => x.kind === 'boom' && x.uid === sapper, drop);
  const hit = idx(log, (x) => x.kind === 'damage' && x.uid === brawler.uid, boom);
  expect(drop).toBeGreaterThanOrEqual(0);
  expect(boom).toBeGreaterThan(drop);
  expect(hit).toBeGreaterThan(boom);
});

test('AC102: the Respond pop-up only lists playable options', async ({ page }) => {
  let s = await start(page, respondR6(['fizzle', 'crystal-cluster'], 1));
  await castFireball(page, s);
  const dlg = page.getByRole('dialog', { name: 'Respond?' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Soul Cluster + Snuff Out', exact: true })).toBeEnabled();
  await expect(dlg.getByRole('button', { name: /need \d+ more/ })).toHaveCount(0);
  await expect(dlg.getByRole('button', { name: 'Let it happen' })).toBeVisible();
  s = await start(page, respondR6(['fizzle'], 0));
  await castFireball(page, s);
  expect((await getState(page)).pendingResponse).toBe(null);
  await expect(dlg).toHaveCount(0);
});

test.describe('display mode on a PC window', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  const ratio = async (page) => {
    await newMatch(page, quiet({}));
    const b = await page.getByLabel('Battlefield', { exact: true }).boundingBox();
    return b.width / b.height;
  };
  test('AC103: Display mode Auto / PC / Phone, remembered, without extra menu buttons', async ({ page }) => {
    await openMenu(page);
    const group = page.getByRole('radiogroup', { name: 'Display mode' });
    await expect(group).toBeVisible();
    await expect(group.getByRole('radio', { name: 'Auto' })).toBeChecked();
    await expect(page.getByRole('button')).toHaveCount(5);
    await openTest(page);
    await page.getByRole('radio', { name: 'Phone' }).check();
    expect(Math.abs((await ratio(page)) - 19.5 / 9)).toBeLessThanOrEqual(0.08);
    await openTest(page);
    await expect(page.getByRole('radio', { name: 'Phone' })).toBeChecked();
    await page.getByRole('radio', { name: 'PC' }).check();
    expect(Math.abs((await ratio(page)) - 16 / 9)).toBeLessThanOrEqual(0.08);
    await openTest(page);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const inSettings = page.getByRole('radiogroup', { name: 'Display mode' });
    await expect(inSettings.getByRole('radio', { name: 'PC' })).toBeChecked();
    await inSettings.getByRole('radio', { name: 'Auto' }).check();
    await openTest(page);
    const b = await (async () => { await newMatch(page, quiet({})); return page.getByLabel('Battlefield', { exact: true }).boundingBox(); })();
    expect(b.width).toBeGreaterThanOrEqual(1270);
    expect(b.height).toBeGreaterThanOrEqual(710);
  });
});

test.describe('straight-on road board and corner HUD at 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  const W = 844, H = 390;
  const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
  test('AC104: straight-on road perspective, Commanders in the corners, HUD around them', async ({ page }) => {
    await start(page, quiet({ playerHand: ['goblin-scrapper', 'goblin-slinger', 'fireball', 'soul-shard', 'shieldbeard'], opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard'], board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 7, col: 3 },
      { cardId: 'goblin-scrapper', owner: 'player', row: 7, col: 11 },
      { cardId: 'gnome-tinker', owner: 'opponent', row: 1, col: 3 },
      { cardId: 'gnome-tinker', owner: 'opponent', row: 1, col: 11 },
    ] }));
    const near3 = await center(page.getByLabel('Gutripper Brawler, row 7, column 3', { exact: true }));
    const near11 = await center(page.getByLabel('Gutripper Brawler, row 7, column 11', { exact: true }));
    const far3 = await center(page.getByLabel('Aegis Tinkerer, row 1, column 3', { exact: true }));
    const far11 = await center(page.getByLabel('Aegis Tinkerer, row 1, column 11', { exact: true }));
    expect(near3.y - far3.y).toBeGreaterThanOrEqual(60); // near row lower on screen
    expect(Math.abs(near3.y - near11.y)).toBeLessThanOrEqual(12); // straight on: a row is level (no diagonal)
    expect(Math.abs(far3.y - far11.y)).toBeLessThanOrEqual(12);
    expect(near11.x - near3.x).toBeGreaterThan((far11.x - far3.x) * 1.1); // road perspective: near rows wider
    expect(near3.x).toBeLessThan(far3.x); // columns converge toward the far side
    expect(near11.x).toBeGreaterThan(far11.x);
    const bf = await page.getByLabel('Battlefield', { exact: true }).boundingBox();
    expect(bf.width).toBeGreaterThanOrEqual(W - 2);
    expect(bf.height).toBeGreaterThanOrEqual(H - 2);
    // Round 5b: owner HUD layout (crystals along the top, phase tracker top-right, Menu on the right)
    for (const n of ['Your Flow crystals', 'Your Bank crystals']) {
      const c = await center(page.getByLabel(n, { exact: true }));
      expect(c.x, n).toBeLessThan(W * 0.3);
      expect(c.y, n).toBeLessThan(H / 2);
    }
    const myHeart0 = await center(page.getByLabel('Your Commander health', { exact: true }));
    expect(myHeart0.x).toBeLessThan(W / 2);
    expect(myHeart0.y).toBeGreaterThan(H / 2);
    const theirHeart0 = await center(page.getByLabel('Enemy Commander health', { exact: true }));
    expect(theirHeart0.x).toBeGreaterThan(W / 2);
    expect(theirHeart0.y).toBeLessThan(H / 2);
    const eh = await center(page.getByLabel('Enemy hand', { exact: true }));
    expect(eh.x).toBeLessThan(W / 2);
    expect(eh.y).toBeLessThan(H / 4);
    const ed = await center(page.getByLabel('Enemy deck', { exact: true }));
    expect(ed.x).toBeLessThan(W / 2);
    expect(ed.y).toBeLessThan(H / 4);
    const yd = await center(page.getByLabel('Your deck', { exact: true }));
    expect(yd.x).toBeGreaterThan(W * 0.85);
    expect(yd.y).toBeGreaterThan(H * 0.7);
    const yh = (await page.getByLabel('Your hand', { exact: true }).getByRole('button').first().boundingBox());
    expect(yh.x).toBeGreaterThanOrEqual(W * 0.1);
    const ph = await page.getByLabel('Current phase', { exact: true }).boundingBox();
    expect(ph.x).toBeGreaterThanOrEqual(W * 0.74);
    expect(ph.y).toBeLessThanOrEqual(H * 0.04);
    const menu = await center(page.getByRole('button', { name: 'Menu', exact: true }));
    expect(menu.x).toBeGreaterThan(W * 0.8);
    await openMatchMenu(page);
    for (const loc of [page.getByRole('button', { name: 'Last turn', exact: true }), page.getByRole('switch', { name: 'Card pop-ups' }), page.getByRole('button', { name: 'Recenter', exact: true })]) {
      const c = await center(loc);
      expect(c.x).toBeGreaterThan(W * 0.7);
    }
    await page.mouse.move(W / 2, 120);
    await page.waitForTimeout(800);
    const heart = (await center(page.getByLabel('Your Commander health', { exact: true }))).b;
    const cards = page.getByLabel('Your hand', { exact: true }).getByRole('button');
    for (let i = 0; i < await cards.count(); i++) {
      const r = await cards.nth(i).boundingBox();
      const ox = Math.min(heart.x + heart.width, r.x + r.width) - Math.max(heart.x, r.x);
      const oy = Math.min(heart.y + heart.height, r.y + r.height) - Math.max(heart.y, r.y);
      expect(ox > 1 && oy > 1, `hand card ${i} covers the heart`).toBe(false);
    }
  });

  test('AC105: the enemy hand is smaller than the player hand', async ({ page }) => {
    await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball'], opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard'] }));
    const back = page.getByLabel('Enemy hand', { exact: true }).locator('[data-card-back]');
    await expect(back).toHaveCount(3);
    const eb = await back.first().boundingBox();
    const pb = await page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Gutripper Brawler', exact: true }).boundingBox();
    expect(eb.height).toBeLessThanOrEqual(pb.height * 0.8);
  });
});

const camera = (page) => page.evaluate(async () => await window.oreheart.getCamera());
test('AC106: zoom in, drag-to-attack still works, Re-center resets', async ({ page }) => {
  await start(page, { ai: false, playerCommander: 'borgo', opponentCommander: 'grubnak', setup: { ...previewSetup, opponentHand: [] } });
  await done(page);
  expect((await camera(page)).zoom).toBe(1);
  const field = await page.getByLabel('Battlefield', { exact: true }).boundingBox();
  await page.mouse.move(field.x + field.width / 2, field.y + field.height / 2);
  await page.mouse.wheel(0, -200);
  await expect.poll(async () => (await camera(page)).zoom).toBeGreaterThan(1);
  await page.waitForTimeout(500);
  const fromL = page.getByLabel('Ironwall Shieldbeard, row 5, column 4', { exact: true });
  const toL = page.getByLabel('Gutripper Brawler, row 4, column 3', { exact: true });
  await expect(fromL).toBeInViewport();
  await expect(toL).toBeInViewport();
  const from = await fromL.boundingBox();
  const to = await toL.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect.poll(async () => at(await getState(page), 5, 4).hasAttacked).toBe(true);
  expect((await camera(page)).zoom).toBeGreaterThan(1);
  await openMatchMenu(page);
  await page.getByRole('button', { name: 'Recenter', exact: true }).click();
  await expect.poll(async () => (await camera(page)).zoom).toBe(1);
  const c = await camera(page);
  expect(c.panX).toBe(0);
  expect(c.panY).toBe(0);
});

test('AC107: Deck Builder logo, smart search and cards per row', async ({ page }) => {
  await openDecks(page);
  await expect(page.getByRole('img', { name: 'Oreheart' }).first()).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Search cards' });
  const shownIds = async () => allCards(page).locator('[data-card-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card-id')));
  const info = async (ids) => page.evaluate(async (l) => Promise.all(l.map((i) => window.oreheart.getCard(i))), ids);
  await search.fill('ranged under 4');
  await expect(allCards(page).getByRole('button', { name: 'Mangewolf Rider', exact: true })).toHaveCount(0);
  let ids = await shownIds();
  expect(ids.length).toBeGreaterThan(0);
  for (const c of await info(ids)) {
    expect(c.cost, c.id).toBeLessThan(4);
    expect(c.shortText + ' ' + c.longText, c.id).toMatch(/Ranged/);
  }
  const slinger = (await info(['goblin-slinger']))[0];
  if (slinger.cost < 4) await expect(allCards(page).getByRole('button', { name: 'Skullflinger', exact: true })).toHaveCount(1);
  await search.fill('goblin miners');
  await expect(allCards(page).getByRole('button', { name: 'Grubgrabber Miner', exact: true })).toHaveCount(1);
  ids = await shownIds();
  for (const c of await info(ids)) {
    expect(c.faction, c.id).toBe('goblins');
    expect(['gatherer', 'smith'], c.id).toContain(c.role);
  }
  await search.fill('');
  const slider = page.getByLabel('Cards per row', { exact: true });
  await slider.fill('3');
  await expect.poll(async () => {
    const ys = await allCards(page).locator('[data-card-id]').evaluateAll((els) => els.slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().top)));
    return ys[0] === ys[1] && ys[1] === ys[2] && ys[3] > ys[2] + 5;
  }).toBe(true);
  await openDecks(page);
  await expect(page.getByLabel('Cards per row', { exact: true })).toHaveValue('3');
});

test('AC108: title screen uses the painted cavern background with the logo, without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openMenu(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' }).getByRole('img', { name: 'Oreheart' })).toBeVisible();
  const usesCavern = await page.evaluate(() =>
    [...document.querySelectorAll('img')].some((i) => /cavern/.test(i.src)) ||
    [...document.querySelectorAll('*')].some((e) => /cavern/.test(getComputedStyle(e).backgroundImage)));
  expect(usesCavern).toBe(true);
  expect(errors).toEqual([]);
});

// ================= Phase 1B Round 3a: board and rules =================
const cardInfo = (page, ids) => page.evaluate(async (list) => {
  const out = {};
  for (const id of list) out[id] = await window.oreheart.getCard(id);
  return out;
}, ids);
const validate = (page, ids, cmd) => page.evaluate(async ([l, c]) => await (c ? window.oreheart.validateDeck(l, c) : window.oreheart.validateDeck(l)), [ids, cmd]);

test('AC109: Strongholds stand in the corners: player (7,2), enemy (1,12)', async ({ page }) => {
  let s = await start(page, quiet({ playerHand: ['goblin-scrounger'], board: [
    { cardId: 'goblin-scrapper', owner: 'player', row: 2, col: 11 },
    { cardId: 'goblin-scrapper', owner: 'player', row: 2, col: 7 },
  ] }));
  expect(s.strongholds).toEqual({ player: { row: 7, col: 2 }, opponent: { row: 1, col: 12 } });
  const summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.row === 7 && a.col === 1)).toBe(true);
  expect(summons.some((a) => a.row === 7 && a.col === 3)).toBe(true);
  expect(summons.some((a) => a.row === 7 && a.col === 7)).toBe(true);
  expect(summons.some((a) => a.row === 7 && a.col === 2)).toBe(false);
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrounger'), row: 7, col: 2 })).ok).toBe(false);
  await done(page); // -> action
  const near = at(s, 2, 11).uid;
  const far = at(s, 2, 7).uid;
  const acts = await legal(page);
  expect(acts.some((a) => a.type === 'attack' && a.creatureUid === near && a.target && a.target.commander === 'opponent')).toBe(true);
  expect(acts.some((a) => a.type === 'attack' && a.creatureUid === far && a.target && a.target.commander === 'opponent')).toBe(false);
  expect(acts.some((a) => a.type === 'move' && a.creatureUid === near && a.row === 1 && a.col === 12)).toBe(false);
  expect(acts.some((a) => a.type === 'move' && a.creatureUid === near && a.row === 1 && a.col === 11)).toBe(true);
  // the enemy summons beside its own Stronghold, never on it
  s = await newMatch(page, { ai: false, setup: { firstPlayer: 'opponent', opponentHand: ['goblin-scrounger'] } });
  const opp = (await legal(page)).filter((a) => a.type === 'summon');
  expect(opp.some((a) => a.row === 1 && a.col === 13)).toBe(true);
  expect(opp.some((a) => a.row === 1 && a.col === 12)).toBe(false);
  expect(opp.every((a) => a.row === 1)).toBe(true);
});

test('AC110: random mines are always corner-mirrored, fair and away from both Strongholds', async ({ page }) => {
  await openTest(page);
  const cheb = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  for (let seed = 11; seed <= 40; seed++) {
    const s = await newMatch(page, { ai: false, seed, skipMulligan: true });
    const m = s.sites.map((x) => ({ row: x.row, col: x.col }));
    expect(m.length).toBe(3);
    expect(m.some((a) => a.row === 4 && a.col === 7), `center mine, seed ${seed}`).toBe(true);
    for (const a of m) {
      expect(a.row >= 3 && a.row <= 5, `seed ${seed}`).toBe(true);
      expect(m.some((b) => b.row === 8 - a.row && b.col === 14 - a.col), `corner mirror, seed ${seed}`).toBe(true);
      expect(cheb(a, s.strongholds.player), `seed ${seed}`).toBeGreaterThanOrEqual(2);
      expect(cheb(a, s.strongholds.opponent), `seed ${seed}`).toBeGreaterThanOrEqual(2);
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(cheb(m[i], m[j])).toBeGreaterThanOrEqual(2);
    // fair: the sum of distances from each Stronghold to the mines is equal
    const dist = (st) => m.reduce((t, a) => t + cheb(a, st), 0);
    expect(dist(s.strongholds.player), `seed ${seed}`).toBe(dist(s.strongholds.opponent));
  }
});

test('AC111: decks of 50 to 100 cards and at most 20 Crystal cards', async ({ page }) => {
  await openTest(page);
  const cfg = await page.evaluate(async () => await window.oreheart.getConfig());
  expect(cfg.deckMin).toBe(50);
  expect(cfg.deckMax).toBe(100);
  expect(cfg.crystalCardLimit).toBe(20);
  const grunts = (n) => Array(n).fill('goblin-scrapper');
  expect((await validate(page, grunts(50))).legal).toBe(true);
  expect((await validate(page, grunts(100))).legal).toBe(true);
  const small = await validate(page, grunts(49));
  expect(small.legal).toBe(false);
  expect(small.problems).toContain('Needs 50 to 100 cards (now 49).');
  const big = await validate(page, grunts(101));
  expect(big.legal).toBe(false);
  expect(big.problems).toContain('Needs 50 to 100 cards (now 101).');
  const shards = (n) => Array(n).fill('soul-shard');
  expect((await validate(page, [...grunts(30), ...shards(20)])).legal).toBe(true);
  const many = await validate(page, [...grunts(30), ...shards(21)]);
  expect(many.legal).toBe(false);
  expect(many.problems).toContain('At most 20 Crystal cards (now 21).');
  // the Deck Builder shows the range
  await openDecks(page);
  await addCard(page, 'Shiv Rat', 2);
  await expect(page.getByLabel('Deck counts', { exact: true })).toContainText(/Cards: 2 \(50[–-]100\)/);
  await page.getByRole('button', { name: 'Auto-fill', exact: true }).click();
  await expect(page.getByLabel('Deck counts', { exact: true })).toContainText(/Cards: 50 \(50[–-]100\)/);
  await expect(page.getByLabel('Deck problems', { exact: true })).toContainText('Deck is legal');
});

const STYLES = { warband: 'Warband', 'arcane-hoard': 'Arcane Hoard', horde: 'Horde' };
const FACTIONS = { goblin: 'Goblin', gnome: 'Gnome', dwarf: 'Dwarf' };
test('AC112/AC128: nine legal 100-card starter decks: Warband, Arcane Hoard and Horde for each faction', async ({ page }) => {
  await openTest(page);
  const decks = await page.evaluate(async () => await window.oreheart.listStarterDecks());
  expect(decks.length).toBe(9);
  const ids = new Set(decks.flatMap((d) => d.cards));
  const info = await cardInfo(page, [...ids]);
  for (const [f, fname] of Object.entries(FACTIONS)) for (const [st, sname] of Object.entries(STYLES)) {
    const d = decks.find((x) => x.id === `${f}-${st}`);
    expect(d, `${f}-${st}`).toBeTruthy();
    expect(d.name).toBe(`${fname} ${sname}`);
    expect(d.style).toBe(st);
    expect(d.cards.length).toBe(100);
    expect((await validate(page, d.cards)).legal, d.id).toBe(true);
    const of = (pred) => d.cards.filter((id) => pred(info[id])).length;
    const creatures = of((c) => c.type === 'creature');
    const spells = of((c) => c.type === 'spell');
    const crystals = of((c) => c.type === 'crystal');
    const miners = of((c) => c.type === 'creature' && (c.role === 'gatherer' || c.role === 'smith'));
    const counters = of((c) => c.type === 'spell' && c.speed === 'counter');
    const want = { warband: [88, 7, 5], 'arcane-hoard': [68, 24, 8], horde: [96, 0, 4] }[st];
    expect([creatures, spells, crystals], d.id).toEqual(want);
    expect(miners, `${d.id} Miners`).toBe(50);
    const basic = { goblin: 'goblin-scrounger', gnome: 'gnome-prospector', dwarf: 'dwarf-miner' }[f];
    expect(d.cards.filter((id) => id === basic).length, `${d.id} basic Miners`).toBe(30);
    expect(d.cards.filter((id) => id === `${f}-smith-miner`).length, `${d.id} Smith Miners`).toBe(20);
    const faction = { goblin: 'goblins', gnome: 'gnomes', dwarf: 'dwarves' }[f];
    for (const id of d.cards) if (info[id].type === 'spell') expect([faction, null, 'neutral'], `${d.id} ${id}`).toContain(info[id].faction ?? null);
    const cmd = { goblin: 'grubnak', gnome: 'sproingle', dwarf: 'borgo' }[f];
    expect((await validate(page, d.cards, cmd)).legal, `${d.id} with ${cmd}`).toBe(true);
    if (st === 'warband') expect(counters, d.id).toBeGreaterThanOrEqual(1);
    if (st === 'arcane-hoard') expect(counters, d.id).toBeGreaterThanOrEqual(2);
  }
});

test('AC113: matches use the chosen starter decks; the opponent deck can be any of the three', async ({ page }) => {
  await openTest(page);
  const decks = await page.evaluate(async () => await window.oreheart.listStarterDecks());
  const sorted = (a) => [...a].sort();
  const deckOf = (s, side) => sorted([...s.players[side].deck, ...s.players[side].hand].map((c) => c.cardId));
  let s = await newMatch(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', playerDeckId: 'goblin-horde', opponentDeckId: 'dwarf-arcane-hoard' });
  expect(s.players.player.deckId).toBe('goblin-horde');
  expect(s.players.opponent.deckId).toBe('dwarf-arcane-hoard');
  expect(deckOf(s, 'player')).toEqual(sorted(decks.find((d) => d.id === 'goblin-horde').cards));
  expect(deckOf(s, 'opponent')).toEqual(sorted(decks.find((d) => d.id === 'dwarf-arcane-hoard').cards));
  s = await newMatch(page, { ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak' });
  expect(s.players.player.deckId).toBe('gnome-warband');
  expect(s.players.opponent.deckId).toBe('goblin-warband');
});

for (const st of Object.keys(STYLES)) {
  test(`AC114: the computer plays the ${STYLES[st]} style to the end of a match`, async ({ page }) => {
    test.setTimeout(240000);
    await openTest(page, 3);
    const s = await newMatch(page, { aiBoth: true, skipMulligan: true, playerCommander: 'grubnak', opponentCommander: 'sproingle',
      playerDeckId: `goblin-${st}`, opponentDeckId: `gnome-${st}` });
    expect(s.players.opponent.deckId).toBe(`gnome-${st}`);
    await expect.poll(async () => (await getState(page)).phase, { timeout: 200000, intervals: [1000] }).toBe('over');
    const end = await getState(page);
    expect(['player', 'opponent']).toContain(end.winner);
    expect(end.turn).toBeGreaterThan(2);
  });
}

test.describe('both hands at 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  const inView = (b) => b && b.x >= -1 && b.y >= -1 && b.x + b.width <= 845 && b.y + b.height <= 391;
  test('AC115: the enemy hand is always on-screen and the hand shows about 7 cards, then scrolls', async ({ page }, testInfo) => {
    const fifteen = ['goblin-scrapper', 'goblin-slinger', 'goblin-scrounger', 'shiv-rat', 'fireball', 'soul-shard', 'shieldbeard', 'wolf-rider',
      'goblin-bomber', 'goblin-sneak', 'gnome-tinker', 'dwarf-miner', 'battle-cry', 'fizzle', 'crystal-cluster'];
    await start(page, quiet({ playerHand: fifteen, opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard', 'shiv-rat', 'fizzle'] }));
    const backs = page.getByLabel('Enemy hand', { exact: true }).locator('[data-card-back]');
    await expect(backs).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await expect(backs.nth(i)).toBeVisible();
      const b = await backs.nth(i).boundingBox();
      expect(inView(b), `enemy card back ${i} on-screen`).toBe(true);
      expect(b.height).toBeGreaterThanOrEqual(20);
    }
    const hand = page.getByLabel('Your hand', { exact: true });
    const hb = await hand.boundingBox();
    expect(hb.width).toBeLessThanOrEqual(844 * 0.7); // fixed width, never stretched across the screen
    await expect(page.getByLabel('Hand count', { exact: true })).toHaveCount(0); // Round 6a: no hand counts
    const cards = hand.getByRole('button', { name: /./ }).filter({ has: page.locator('[data-card-id]') });
    await expect(cards).toHaveCount(15);
    const shown = async () => {
      let n = 0;
      for (let i = 0; i < 15; i++) {
        const b = await cards.nth(i).boundingBox();
        if (b && b.x + b.width / 2 >= 0 && b.x + b.width / 2 <= 844 && b.x + b.width / 2 >= hb.x && b.x + b.width / 2 <= hb.x + hb.width && await cards.nth(i).isVisible()) n++;
      }
      return n;
    };
    const first = await shown();
    expect(first).toBeGreaterThanOrEqual(5);
    expect(first).toBeLessThanOrEqual(8);
    await page.getByRole('button', { name: 'Scroll hand right', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Scroll hand left', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('match-both-hands-844x390.png') });
  });

  test('AC116: a tapped creature shows its card at hovered-hand-card size, fully on-screen', async ({ page }) => {
    await start(page, quiet({ playerHand: ['goblin-scrapper'], board: [{ cardId: 'goblin-slinger', owner: 'player', row: 5, col: 9 }] }));
    const handCard = await page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Gutripper Brawler', exact: true }).boundingBox();
    await page.getByLabel(/, row 5, column 9$/).click();
    const dlg = page.getByRole('dialog').filter({ has: page.locator('[data-card-id="goblin-slinger"]') });
    await expect(dlg).toBeVisible();
    const face = await dlg.locator('[data-card-id="goblin-slinger"]').first().boundingBox();
    expect(face.height).toBeGreaterThanOrEqual(handCard.height * 1.6);
    expect(face.height).toBeLessThanOrEqual(handCard.height * 2.5);
    expect(inView(face)).toBe(true);
  });

  test('AC117: the deck picker shows the nine starter decks as named stacks', async ({ page }, testInfo) => {
    await page.goto('/?test=1&seed=5');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Archmagister Sproingle the Unfathomable', exact: true }).click();
    const row = page.getByLabel('Deck choice', { exact: true });
    const stacks = row.getByRole('button', { name: /, 100 cards, ready$/ });
    await expect(stacks.first()).toHaveAccessibleName('Gnome Warband, 100 cards, ready');
    await expect(stacks.nth(1)).toHaveAccessibleName('Gnome Arcane Hoard, 100 cards, ready');
    await expect(stacks.nth(2)).toHaveAccessibleName('Gnome Horde, 100 cards, ready');
    await expect(row.getByRole('button', { name: 'Goblin Horde, 100 cards, ready', exact: true })).toHaveCount(0); // Round 8b: only his decks
    await expect(row.getByRole('button', { name: 'Dwarf Arcane Hoard, 100 cards, ready', exact: true })).toHaveCount(0);
    await expect(row.locator('img[src*="deck-pile"]').first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('deck-picker-844x390.png') });
    await row.getByRole('button', { name: 'Gnome Horde, 100 cards, ready', exact: true }).click();
    await expect(row.getByRole('button', { name: 'Gnome Horde, 100 cards, ready', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Fight!', exact: true }).click();
    await page.getByRole('button', { name: 'Keep Hand' }).click();
    const s = await page.evaluate(async () => await window.oreheart.getState());
    expect(s.players.player.deckId).toBe('gnome-horde');
  });
});

// ================= Phase 1B Round 3b: visual polish =================
const faceStyle = (e) => {
  const st = getComputedStyle(e);
  return { color: st.color, fill: st.webkitTextFillColor, bg: st.backgroundImage, shadow: st.textShadow,
    stroke: st.webkitTextStrokeWidth, filter: st.filter, weight: st.fontWeight, size: parseFloat(st.fontSize) };
};
const CLEAR = /rgba\(0, 0, 0, 0\)|transparent/;
const isGold = (st) => {
  if (/gradient/.test(st.bg) && (CLEAR.test(st.fill) || CLEAR.test(st.color))) return true;
  const [r, g, b] = rgb(st.fill && !CLEAR.test(st.fill) ? st.fill : st.color);
  return r >= 150 && g >= 100 && r >= g && g - b >= 30;
};
const hasOutline = (st) => (st.shadow && st.shadow !== 'none') || parseFloat(st.stroke) > 0 || /drop-shadow/.test(st.filter);
// one card face per faction, per rarity, plus a spell and a Crystal card, shown in the Deck Builder grid
async function sampleFaces(page) {
  await openDecks(page);
  const cards = await page.evaluate(async () => await window.oreheart.listCards());
  const pick = new Map();
  for (const f of ['goblins', 'gnomes', 'dwarves']) { const c = cards.find((x) => x.faction === f && x.type === 'creature'); if (c) pick.set(c.id, c); }
  for (const r of Object.keys(RARITY_WORD)) { const c = cards.find((x) => x.rarity === r); if (c) pick.set(c.id, c); }
  for (const id of ['fireball', 'soul-shard']) pick.set(id, cards.find((x) => x.id === id));
  return { cards, pick };
}
const gridFace = (page, id) => allCards(page).locator(`[data-card-id="${id}"]`).first();

test('AC118: card numbers sit centered inside their slots in 3D gold', async ({ page }) => {
  const { pick } = await sampleFaces(page);
  for (const [id] of pick) {
    const face = gridFace(page, id);
    await face.scrollIntoViewIfNeeded();
    const slots = face.getByLabel(/^(Cost|Attack|Health|Movement) \d+$/);
    const n = await slots.count();
    expect(n, id).toBeGreaterThan(0);
    const faceBox = await face.boundingBox();
    for (let i = 0; i < n; i++) {
      const m = await slots.nth(i).evaluate((el, fs) => {
        const label = el.getAttribute('aria-label');
        const digits = label.match(/\d+$/)[0];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node = null;
        while (walker.nextNode()) if (walker.currentNode.textContent.trim() === digits) { node = walker.currentNode; break; }
        if (!node) return { label, missing: true };
        const range = document.createRange(); range.selectNodeContents(node);
        const t = range.getBoundingClientRect(); const s = el.getBoundingClientRect();
        return { label, t: { l: t.left, r: t.right, tp: t.top, b: t.bottom }, s: { l: s.left, r: s.right, tp: s.top, b: s.bottom }, st: eval(`(${fs})`)(node.parentElement) };
      }, faceStyle.toString());
      expect(m.missing, `${id} ${m.label}: number is DOM text`).toBeFalsy();
      const { t, s, st } = m;
      expect(t.l >= s.l - 1 && t.r <= s.r + 1 && t.tp >= s.tp - 1 && t.b <= s.b + 1, `${id} ${m.label} inside its slot`).toBe(true);
      const sw = s.r - s.l, sh = s.b - s.tp;
      expect(Math.abs((t.l + t.r) / 2 - (s.l + s.r) / 2), `${id} ${m.label} centered x`).toBeLessThanOrEqual(0.2 * sw + 1);
      expect(Math.abs((t.tp + t.b) / 2 - (s.tp + s.b) / 2), `${id} ${m.label} centered y`).toBeLessThanOrEqual(0.2 * sh + 1);
      expect(st.size, `${id} ${m.label} small`).toBeLessThanOrEqual(0.1 * faceBox.height + 0.5);
      expect(isGold(st), `${id} ${m.label} gold`).toBe(true);
      expect(hasOutline(st), `${id} ${m.label} outline/bevel`).toBe(true);
    }
  }
});

test('AC119: the rarity crystal is a small art crystal with the rarity word centered below', async ({ page }) => {
  const { pick } = await sampleFaces(page);
  for (const [id, c] of pick) {
    const face = gridFace(page, id);
    await face.scrollIntoViewIfNeeded();
    const word = RARITY_WORD[c.rarity];
    const gem = face.getByLabel(`Rarity: ${word}`, { exact: true });
    await expect(gem, id).toHaveCount(1);
    const m = await gem.evaluate((el, w) => {
      const crystal = el.querySelector('svg, img');
      if (!crystal) return null;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = null;
      while (walker.nextNode()) if (walker.currentNode.textContent.trim() === w) { node = walker.currentNode; break; }
      if (!node) return { noWord: true };
      const range = document.createRange(); range.selectNodeContents(node);
      const t = range.getBoundingClientRect(); const k = crystal.getBoundingClientRect();
      return { k: { cx: (k.left + k.right) / 2, cy: (k.top + k.bottom) / 2, h: k.height }, t: { cx: (t.left + t.right) / 2, top: t.top } };
    }, word);
    expect(m, `${id}: crystal svg/img inside the rarity element`).not.toBeNull();
    expect(m.noWord, `${id}: rarity word as text`).toBeFalsy();
    const fb = await face.boundingBox();
    expect(m.k.h, `${id} crystal small`).toBeLessThanOrEqual(0.12 * fb.height);
    expect(m.k.h, `${id} crystal visible`).toBeGreaterThanOrEqual(0.03 * fb.height);
    expect(Math.abs(m.k.cx - (fb.x + fb.width / 2)), `${id} crystal bottom center`).toBeLessThanOrEqual(0.08 * fb.width);
    expect(m.k.cy, `${id} crystal in the lower part`).toBeGreaterThan(fb.y + fb.height * 0.75);
    expect(m.t.top, `${id} word below crystal`).toBeGreaterThanOrEqual(m.k.cy);
    expect(Math.abs(m.t.cx - m.k.cx), `${id} word centered under crystal`).toBeLessThanOrEqual(0.06 * fb.width);
  }
});

test('AC120: card names and text boxes use one size, gold lettering, thin text', async ({ page }) => {
  await openDecks(page);
  const faces = allCards(page).locator('[data-card-id]');
  const data = await faces.evaluateAll((els, fs) => {
    const f = eval(`(${fs})`);
    return els.map((e) => {
      const name = e.querySelector('[data-part="name"]');
      const text = e.querySelector('[data-part="text"]');
      return {
        id: e.getAttribute('data-card-id'),
        name: name && { txt: name.textContent.trim(), st: f(name), over: name.scrollWidth > name.clientWidth + 1 },
        text: text && { st: f(text), over: text.scrollHeight > text.clientHeight + 1 },
      };
    });
  }, faceStyle.toString());
  expect(data.length).toBeGreaterThan(20);
  const shortNames = [];
  const textSizes = new Set();
  for (const d of data) {
    expect(d.name, `${d.id}: data-part="name"`).toBeTruthy();
    expect(d.text, `${d.id}: data-part="text"`).toBeTruthy();
    expect(isGold(d.name.st), `${d.id} name gold`).toBe(true);
    expect(hasOutline(d.name.st), `${d.id} name outline`).toBe(true);
    expect(d.name.over, `${d.id} name fits`).toBe(false);
    if (d.name.txt.length <= 16) shortNames.push(d.name.st.size);
    expect(isGold(d.text.st), `${d.id} text gold`).toBe(true);
    expect(hasOutline(d.text.st), `${d.id} text outline`).toBe(true);
    expect(Number(d.text.st.weight), `${d.id} text not bold`).toBeLessThanOrEqual(500);
    textSizes.add(d.text.st.size.toFixed(1));
  }
  const maxName = Math.max(...shortNames);
  expect(new Set(shortNames.map((x) => x.toFixed(1))).size, 'names up to 16 letters share one size').toBe(1);
  for (const d of data) expect(d.name.st.size, `${d.id} long names shrink only a little`).toBeGreaterThanOrEqual(0.6 * maxName);
  expect(textSizes.size, 'one text box size on every card').toBe(1);
});

test('AC121: Deck Builder deck art has no frame; painted background', async ({ page }) => {
  await openDecks(page);
  const pile = page.getByLabel('Deck pile', { exact: true });
  const img = pile.locator('img[src*="deck-pile"]').first();
  await expect(img).toBeVisible();
  const boxes = await img.evaluate((el) => {
    const pileEl = el.closest('[aria-label="Deck pile"]');
    const out = [];
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      out.push({ tag: e.tagName, border: ['Top', 'Right', 'Bottom', 'Left'].map((k) => parseFloat(s[`border${k}Width`]) * (s[`border${k}Style`] === 'none' ? 0 : 1)), bgc: s.backgroundColor, bgi: s.backgroundImage, shadow: s.boxShadow, outline: s.outlineStyle === 'none' ? 0 : parseFloat(s.outlineWidth) });
      if (e === pileEl) break;
    }
    return out;
  });
  for (const b of boxes) {
    expect(b.border.every((w) => w === 0), `${b.tag} has no border`).toBe(true);
    expect(CLEAR.test(b.bgc), `${b.tag} has no box color`).toBe(true);
    expect(b.bgi, `${b.tag} has no box image`).toBe('none');
    expect(b.shadow, `${b.tag} has no box shadow (use drop-shadow glow)`).toBe('none');
    expect(b.outline, `${b.tag} has no outline`).toBe(0);
  }
  const painted = await page.evaluate(() =>
    [...document.querySelectorAll('img')].some((i) => /deck-builder-bg/.test(i.src)) ||
    [...document.querySelectorAll('*')].some((e) => /deck-builder-bg/.test(getComputedStyle(e).backgroundImage)));
  expect(painted).toBe(true);
});

// every visible native control is restyled; no native <select>; every scrollbar is gold
async function checkControls(page, where) {
  const r = await page.evaluate(() => {
    const bad = [];
    const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2 && e.checkVisibility({ opacityProperty: true, visibilityProperty: true }); };
    for (const e of document.querySelectorAll('button, input, select, textarea')) {
      if (!vis(e) || e.type === 'hidden') continue;
      if (e.tagName === 'SELECT') bad.push(`native select ${e.getAttribute('aria-label') || e.name}`);
      const a = getComputedStyle(e).appearance;
      if (a !== 'none') bad.push(`${e.tagName.toLowerCase()}[${e.type}] "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)}" appearance ${a}`);
    }
    for (const e of [document.documentElement, ...document.querySelectorAll('body *')]) {
      const s = getComputedStyle(e);
      const y = /auto|scroll/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1;
      const x = /auto|scroll/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1;
      const root = e === document.documentElement && (e.scrollHeight > innerHeight + 1 || e.scrollWidth > innerWidth + 1);
      if (!(x || y || root)) continue;
      if (/none/.test(s.scrollbarWidth)) continue; // hidden scrollbar (e.g. hand fan with arrows) is fine
      const c = s.scrollbarColor;
      const [r1, g1, b1] = (c.match(/[\d.]+/g) || []).map(Number);
      if (c === 'auto' || !(r1 >= 120 && r1 >= g1 && g1 > b1)) bad.push(`scrollbar ${e.tagName.toLowerCase()} "${e.getAttribute('aria-label') || ''}" color ${c}`);
    }
    return bad;
  });
  expect(r, where).toEqual([]);
}

test('AC122: one ornate control style everywhere: no default browser controls or scrollbars', async ({ page }) => {
  await page.goto('/?test=1');
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
  await checkControls(page, 'title');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Card pop-ups' })).toBeVisible();
  await checkControls(page, 'settings');
  await openDecks(page);
  await checkControls(page, 'deck builder');
  await page.getByRole('combobox', { name: 'Faction', exact: true }).click();
  await expect(page.getByRole('listbox', { name: 'Faction', exact: true })).toBeVisible();
  await checkControls(page, 'deck builder with an open dropdown');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('slider', { name: 'Cards per row' })).toBeVisible();
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fight!' })).toBeVisible();
  await checkControls(page, 'commander and deck select');
  await newMatch(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'soul-shard'] }));
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  await checkControls(page, 'match');
});

test.describe('title layout and ornaments', () => {
  for (const vp of [{ width: 844, height: 390 }, { width: 1280, height: 720 }]) {
    test(`AC123: "Welcome to Oreheart!" never overlaps the logo or the Tutorial button; no frame ornaments on any screen (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize(vp);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/');
      const offer = page.getByRole('dialog', { name: 'Welcome to Oreheart!' });
      await expect(offer).toBeVisible();
      await page.waitForTimeout(800); // let entrance animations settle
      const logo = await page.getByRole('heading', { level: 1, name: 'Oreheart' }).getByRole('img', { name: 'Oreheart' }).boundingBox();
      const tut = await page.getByRole('button', { name: 'Tutorial', exact: true }).boundingBox();
      const texts = await offer.evaluate((d) => {
        const out = [];
        const walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const n = walker.currentNode;
          if (!n.textContent.trim() || n.parentElement.closest('button')) continue;
          const r = document.createRange(); r.selectNodeContents(n);
          for (const b of r.getClientRects()) out.push({ txt: n.textContent.trim().slice(0, 30), x: b.left, y: b.top, width: b.width, height: b.height });
        }
        return out;
      });
      expect(texts.length).toBeGreaterThan(0);
      const hit = (a, b) => a && b && a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
      for (const t of texts) {
        expect(hit(t, logo), `"${t.txt}" overlaps the logo`).toBe(false);
        expect(hit(t, tut), `"${t.txt}" overlaps the Tutorial button`).toBe(false);
      }
      expect(await page.locator('[data-ornament=\"frame\"], [data-ornament=\"corner\"]').count(), 'title ornaments').toBe(0);
      await offer.getByRole('button', { name: 'Skip' }).click();
      await page.getByRole('button', { name: 'Decks', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
      expect(await page.locator('[data-ornament=\"frame\"], [data-ornament=\"corner\"]').count(), 'deck builder ornaments').toBe(0);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
      expect(await page.locator('[data-ornament=\"frame\"], [data-ornament=\"corner\"]').count(), 'Rules ornaments').toBe(0);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Fight!' })).toBeVisible();
      expect(await page.locator('[data-ornament=\"frame\"], [data-ornament=\"corner\"]').count(), 'select screen ornaments').toBe(0);
      await page.goto('/');
      const again = page.getByRole('dialog', { name: 'Welcome to Oreheart!' });
      if (await again.isVisible()) await again.getByRole('button', { name: 'Skip' }).click();
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible();
      expect(await page.locator('[data-ornament=\"frame\"], [data-ornament=\"corner\"]').count(), 'Settings ornaments').toBe(0);
      expect(errors).toEqual([]);
    });
  }
});

test('AC124: every spell has its own visual, played step by step', async ({ page }) => {
  await openTest(page);
  const cards = await page.evaluate(async () => await window.oreheart.listCards());
  const spells = cards.filter((c) => c.type === 'spell');
  expect(spells.length).toBeGreaterThan(5);
  const info = await cardInfo(page, spells.map((c) => c.id));
  const visuals = spells.map((c) => info[c.id].visual);
  for (const c of spells) {
    expect(typeof info[c.id].visual, c.id).toBe('string');
    expect(info[c.id].visual, c.id).not.toMatch(/^(generic|default|none|)$/);
  }
  expect(new Set(visuals).size, 'no two spells share a visual').toBe(spells.length);
  await newMatch(page, orbSetup);
  await clearFx(page);
  await castOrb(page, 3, 3);
  const log = await fxLog(page);
  const r = idx(log, (e) => e.kind === 'reveal' && e.cardId === 'fireball');
  const e = idx(log, (x) => x.kind === 'effect' && x.cardId === 'fireball', Math.max(r, 0));
  expect(r).toBeGreaterThanOrEqual(0);
  expect(e).toBeGreaterThan(r);
  expect(log[e].visual).toBe(info.fireball.visual);
  expect(idx(log, (x) => x.kind === 'impact', e)).toBeGreaterThan(e);
});

test.describe('round 3b phone screenshots (844x390)', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('AC126: close-up cards, deck builder, title and a spell being cast render without errors', async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    const offer = page.getByRole('dialog', { name: 'Welcome to Oreheart!' });
    await expect(offer).toBeVisible();
    await offer.getByRole('button', { name: 'Skip' }).click();
    await page.waitForTimeout(800);
    await testInfo.attach('title-844x390', { body: await page.screenshot(), contentType: 'image/png' });
    const { pick } = await sampleFaces(page);
    await page.getByLabel('Cards per row', { exact: true }).fill('2');
    await testInfo.attach('deck-builder-844x390', { body: await page.screenshot(), contentType: 'image/png' });
    for (const [id, c] of pick) {
      const face = gridFace(page, id);
      await face.scrollIntoViewIfNeeded();
      await testInfo.attach(`card-${c.faction || 'neutral'}-${c.rarity}-${id}`, { body: await face.screenshot(), contentType: 'image/png' });
    }
    await openTest(page);
    await newMatch(page, orbSetup);
    await page.waitForTimeout(1500);
    await castOrb(page, 3, 3);
    await page.waitForTimeout(400);
    await testInfo.attach('spell-cast-844x390', { body: await page.screenshot(), contentType: 'image/png' });
    expect(errors).toEqual([]);
  });
});

// ================= Phase 1B, Round 4 =================
const R4_SPELLS = {
  'venom-shiv': ['Venom Shiv', 'goblins', 2], 'tunnel-rush': ['Rat-Tunnel Ambush', 'goblins', 2], 'hold-it': ['Pickpocket!', 'goblins', 4],
  fireball: ['Searing Arcane Orb', 'gnomes', 3], 'meteor-strike': ['Starfall Cataclysm', 'gnomes', 7], 'spell-snap': ['Unweave', 'gnomes', 5],
  'shield-bubble': ['Ironclad Bulwark', 'dwarves', 2], 'battle-cry': ['Thunderhorn Blast', 'dwarves', 4], 'second-wind': ['Emergency Repairs', 'dwarves', 5],
  'healing-light': ['Field Bandage', null, 2], fizzle: ['Snuff Out', null, 3], 'prospectors-prayer': ['Desperate Plunder', null, 1],
};
async function openMulligan(page, seed = 7) {
  await page.goto(`/?test=1&seed=${seed}`);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Grubnak Rotgut, King of the Junkpile' }).click();
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  const mull = page.getByRole('dialog', { name: 'Mulligan' });
  await expect(mull).toBeVisible();
  return mull;
}

for (const vp of [{ width: 1280, height: 720, min: 300 }, { width: 844, height: 390, min: 165 }]) {
  test(`AC127: mulligan cards are double size, one row, on-screen (${vp.width}x${vp.height})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const mull = await openMulligan(page);
    const faces = mull.locator('[data-card-id]');
    await expect(faces).toHaveCount(5);
    await page.waitForTimeout(600);
    const boxes = [];
    for (let i = 0; i < 5; i++) boxes.push(await faces.nth(i).boundingBox());
    boxes.sort((a, b) => a.x - b.x);
    for (const [i, b] of boxes.entries()) {
      expect(b.height, `face ${i} height`).toBeGreaterThanOrEqual(vp.min);
      expect(b.x).toBeGreaterThanOrEqual(-1);
      expect(b.y).toBeGreaterThanOrEqual(-1);
      expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 1);
      expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 1);
      if (i > 0) {
        expect(Math.abs(b.y - boxes[0].y)).toBeLessThanOrEqual(2);
        expect(b.x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width - 1);
      }
    }
  });
}

test('AC129: faction spells — names, factions, deck validation and the casting lock', async ({ page }) => {
  await openTest(page);
  const info = await cardInfo(page, Object.keys(R4_SPELLS));
  for (const [id, [name, faction, cost]] of Object.entries(R4_SPELLS)) {
    expect(info[id].name, id).toBe(name);
    expect(info[id].faction ?? null, id).toBe(faction);
    expect(info[id].cost, id).toBe(cost);
    expect(info[id].type, id).toBe('spell');
  }
  expect(info['venom-shiv'].speed).toBe('regular');
  expect(info['hold-it'].speed).toBe('counter');
  const deck = [...Array(30).fill('goblin-scrounger'), ...Array(20).fill('goblin-smith-miner'), 'fireball'];
  const bad = await validate(page, deck, 'grubnak');
  expect(bad.legal).toBe(false);
  expect(bad.problems).toContain('Searing Arcane Orb: only for Gnome Commanders.');
  expect((await validate(page, deck, 'sproingle')).legal).toBe(true);
  const shared = [...deck.slice(0, 50), 'fizzle', 'healing-light', 'prospectors-prayer', 'venom-shiv'];
  expect((await validate(page, shared, 'grubnak')).legal).toBe(true);
  expect((await validate(page, shared, 'borgo')).problems).toContain('Venom Shiv: only for Goblin Commanders.');
  const board = [{ cardId: 'shieldbeard', owner: 'opponent', row: 3, col: 4 }];
  const setup = { playerHand: ['fireball', 'venom-shiv'], opponentHand: [], playerCrystals: 6, board };
  let s = await newMatch(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', factionLock: true, setup });
  let acts = await legal(page);
  const orbUid = handUid(s, 'player', 'fireball');
  expect(acts.some((a) => a.type === 'cast' && a.uid === orbUid)).toBe(false);
  expect(acts.some((a) => a.type === 'cast' && a.uid === handUid(s, 'player', 'venom-shiv'))).toBe(true);
  expect((await act(page, { type: 'cast', uid: orbUid, target: { row: 3, col: 4 } })).ok).toBe(false);
  s = await newMatch(page, { ai: false, playerCommander: 'sproingle', opponentCommander: 'borgo', factionLock: true, setup });
  acts = await legal(page);
  expect(acts.some((a) => a.type === 'cast' && a.uid === handUid(s, 'player', 'venom-shiv'))).toBe(false);
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'fireball'), target: { row: 3, col: 4 } })).ok).toBe(true);
  await expect(page.getByText(/SPROINGLE CASTS SEARING ARCANE ORB!/i)).toBeVisible();
});

test('AC130: Deck Commander locks other factions’ spells in the Deck Builder', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: 'Decks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
  const cmd = page.getByRole('combobox', { name: 'Deck Commander' });
  await expect(cmd).toContainText('Grubnak');
  const counts = page.getByText(/^Cards: \d+ \(50–100\)/);
  const before = await counts.innerText();
  const orb = page.getByRole('button', { name: 'Searing Arcane Orb', exact: true }).first();
  await orb.scrollIntoViewIfNeeded();
  await expect(orb).toHaveAttribute('aria-disabled', 'true');
  // Round 5a: the locked tile is aria-disabled, so force the double-click past Playwright's enabled check
  await orb.dblclick({ force: true });
  await expect(counts).toHaveText(before);
  const shiv = page.getByRole('button', { name: 'Venom Shiv', exact: true }).first();
  await expect(shiv).not.toHaveAttribute('aria-disabled', 'true');
  await cmd.click();
  await page.getByRole('option', { name: 'Sproingle' }).click();
  await expect(cmd).toContainText('Sproingle');
  await expect(orb).not.toHaveAttribute('aria-disabled', 'true');
  await expect(shiv).toHaveAttribute('aria-disabled', 'true');
  await orb.dblclick();
  await expect(counts).not.toHaveText(before);
});

test('AC131: Venom Shiv poisons for exactly 3 of the owner’s turns, then the creature heals; Hex Reversal is disabled', async ({ page }) => {
  await openTest(page);
  const hex = await page.evaluate(async () => await window.oreheart.getCard('mirror-hex'));
  expect(hex.disabled).toBe(true);
  expect((await page.evaluate(async () => await window.oreheart.getCard('fireball'))).disabled).toBe(false);
  const ids = (await page.evaluate(async () => await window.oreheart.listCards())).map((c) => c.id);
  expect(ids).not.toContain('mirror-hex');
  expect(ids).toContain('venom-shiv');
  let s = await newMatch(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'grubnak', firstPlayer: 'player', factionLock: true,
    setup: { playerHand: ['venom-shiv'], opponentHand: [], playerCrystals: 2, board: [{ cardId: 'grimhold-ravager', owner: 'opponent', row: 2, col: 4 }] } });
  const H = at(s, 2, 4).health;
  expect(H).toBeGreaterThanOrEqual(4);
  expect(at(s, 2, 4).poison).toBe(0);
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'venom-shiv'), target: { row: 2, col: 4 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 2, 4).health).toBe(H);
  expect(at(s, 2, 4).poison).toBe(3);
  expect(s.players.player.crystals).toBe(0);
  const toTurnOf = async (side) => {
    for (let i = 0; i < 8; i++) {
      const st = await getState(page);
      if (st.activePlayer === side && st.phase === 'deploy') return st;
      await done(page);
    }
    throw new Error('turn not reached');
  };
  await passTurn(page);
  s = await toTurnOf('opponent');
  expect([at(s, 2, 4).health, at(s, 2, 4).poison]).toEqual([H - 1, 2]);
  await passTurn(page);
  s = await toTurnOf('player');
  expect(at(s, 2, 4).health).toBe(H - 1);
  await passTurn(page);
  s = await toTurnOf('opponent');
  expect([at(s, 2, 4).health, at(s, 2, 4).poison]).toEqual([H - 2, 1]);
  await passTurn(page); await toTurnOf('player'); await passTurn(page);
  s = await toTurnOf('opponent');
  expect([at(s, 2, 4).health, at(s, 2, 4).poison]).toEqual([H - 3, 0]);
  await passTurn(page); await toTurnOf('player'); await passTurn(page);
  s = await toTurnOf('opponent');
  expect(at(s, 2, 4).health).toBe(H);
});

test('AC132: spell frames per faction with the cost and type orbs', async ({ page }) => {
  await openTest(page);
  const want = { 'venom-shiv': ['spell-goblin', 'Spell', 'SPELL'], fireball: ['spell-gnome', 'Spell', 'SPELL'],
    'shield-bubble': ['spell-dwarf', 'Instant', 'INSTANT'], fizzle: ['spell-shared', 'Instant', 'INSTANT'] };
  await newMatch(page, quiet({ playerHand: Object.keys(want) }));
  const hand = page.getByLabel('Your hand', { exact: true });
  for (const [id, [frame, type, word]] of Object.entries(want)) {
    const face = hand.locator(`[data-card-id="${id}"]`).first();
    await expect(face, id).toHaveAttribute('data-frame', frame);
    expect(await face.locator(`img[src*="${frame.replace('spell-', 'spell-frame-')}"]`).count(), id).toBeGreaterThan(0);
    expect(await face.locator('img[src*="card-frame-"]').count(), id).toBe(0);
    await expect(face.getByLabel(/^(Attack|Health|Movement) \d+$/), id).toHaveCount(0);
    const fb = await face.boundingBox();
    const cost = await face.getByLabel(/^Cost \d+$/).boundingBox();
    const typeEl = face.getByLabel(`Type: ${type}`, { exact: true });
    await expect(typeEl, id).toContainText(word);
    const tb = await typeEl.boundingBox();
    const cx = (b) => (b.x + b.width / 2 - fb.x) / fb.width;
    const cy = (b) => (b.y + b.height / 2 - fb.y) / fb.height;
    expect(cx(cost), `${id} cost x`).toBeLessThanOrEqual(0.3);
    expect(cy(cost), `${id} cost y`).toBeLessThanOrEqual(0.25);
    expect(cx(tb), `${id} type x`).toBeGreaterThanOrEqual(0.7);
    expect(cy(tb), `${id} type y`).toBeGreaterThanOrEqual(0.7);
  }
});

// AC133 (Round 4 metal lettering) was retired in Round 5a; AC135 checks the new plain gold Alegreya SC lettering.

test.describe('round 4 phone screenshots (844x390)', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('AC134: mulligan, spell cards per faction, a creature close-up and a menu screen render without errors', async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openMenu(page);
    await page.waitForTimeout(500);
    await testInfo.attach('menu-844x390', { body: await page.screenshot(), contentType: 'image/png' });
    const mull = await openMulligan(page);
    await page.waitForTimeout(600);
    await testInfo.attach('mulligan-844x390', { body: await page.screenshot(), contentType: 'image/png' });
    await openTest(page);
    const ids = ['venom-shiv', 'fireball', 'battle-cry', 'fizzle', 'goblin-scrapper'];
    await newMatch(page, quiet({ playerHand: ids }));
    await page.waitForTimeout(800);
    const hand = page.getByLabel('Your hand', { exact: true });
    for (const id of ids) {
      const face = hand.locator(`[data-card-id="${id}"]`).first();
      await face.hover();
      await page.waitForTimeout(400);
      await testInfo.attach(`card-${id}`, { body: await page.screenshot(), contentType: 'image/png' });
    }
    expect(mull).toBeTruthy();
    expect(errors).toEqual([]);
  });
});

// ---------- Phase 1B Round 5a (menus, deck builder, lettering) ----------
const deckPile = (page) => page.getByLabel('Deck pile', { exact: true });
const myDecks = (page) => page.getByLabel('My decks', { exact: true });
const deckName = (page) => deckPile(page).locator('[data-part="deck-name"]');
const deckSize = (page) => deckPile(page).locator('[data-part="deck-size"]');
const STARTERS = ['Goblin', 'Gnome', 'Dwarf'].flatMap((f) => ['Warband', 'Arcane Hoard', 'Horde'].map((st) => `${f} ${st}`));
const px = async (loc, prop = 'fontSize') => loc.evaluate((e, p) => parseFloat(getComputedStyle(e)[p]), prop);
const box = async (loc) => loc.boundingBox();
async function toTitle(page) {
  await page.goto('/?test=1');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
}
async function toSelect(page) {
  await toTitle(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toBeVisible();
}

// every visible text node: Alegreya SC italic, weight 400/700, no textured / clipped letters
async function letteringProblems(page) {
  return page.evaluate(() => {
    const bad = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!/[\p{L}\p{N}]/u.test(n.textContent)) continue;
      const el = n.parentElement;
      if (!el || el.closest('[aria-hidden="true"], canvas, svg, script, style, noscript, textarea')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const cs = getComputedStyle(el);
      const t = n.textContent.trim().slice(0, 30);
      if (!/^["']?Alegreya SC\b/.test(cs.fontFamily)) bad.push(`${t} [font ${cs.fontFamily}]`);
      else if (cs.fontStyle !== 'italic') bad.push(`${t} [style ${cs.fontStyle}]`);
      else if (!['400', '500', '700', '800'].includes(cs.fontWeight)) bad.push(`${t} [weight ${cs.fontWeight}]`);
    }
    for (const e of document.querySelectorAll('body *')) {
      const s = getComputedStyle(e);
      if (s.backgroundClip === 'text' || s.webkitBackgroundClip === 'text') bad.push(`background-clip:text on ${e.tagName} "${(e.textContent || '').trim().slice(0, 20)}"`);
      if (/metal-(gold|silver)/.test(s.backgroundImage)) bad.push(`metal texture on ${e.tagName}`);
    }
    return bad.slice(0, 15);
  });
}

test('AC135: one font everywhere: Alegreya SC Italic, bundled, no metal or textured letters', async ({ page }) => {
  const remote = [];
  page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) remote.push(r.url()); });
  await openMenu(page);
  await page.evaluate(async () => { await document.fonts.ready; });
  expect(await page.evaluate(() => document.fonts.check('italic 400 20px "Alegreya SC"'))).toBe(true);
  expect(await letteringProblems(page), 'title').toEqual([]);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toHaveCSS('color', 'rgb(255, 215, 0)');
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  expect(await letteringProblems(page), 'rules').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible();
  expect(await letteringProblems(page), 'settings').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Decks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(await letteringProblems(page), 'deck builder').toEqual([]);
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toHaveCSS('color', 'rgb(255, 215, 0)');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toBeVisible();
  expect(await letteringProblems(page), 'select').toEqual([]);
  await openTest(page);
  await newMatch(page, quiet({ playerHand: ['goblin-scrapper', 'venom-shiv', 'soul-shard'] }));
  await page.waitForTimeout(800);
  expect(await letteringProblems(page), 'match').toEqual([]);
  expect(remote, 'font is self-hosted').toEqual([]);
});

// every visible card face keeps its frame's exact proportions (never stretched)
async function stretchedFaces(page) {
  return page.evaluate(() => {
    const out = { checked: 0, bad: [] };
    for (const face of document.querySelectorAll('[data-card-id]')) {
      if (!face.checkVisibility({ opacityProperty: true, visibilityProperty: true }) || face.offsetWidth < 10) continue;
      const img = [...face.querySelectorAll('img')].find((i) => /frame/.test(i.src) && i.naturalWidth > 0);
      if (!img) continue;
      out.checked++;
      const want = img.naturalWidth / img.naturalHeight;
      const id = face.getAttribute('data-card-id');
      const faceR = face.offsetWidth / face.offsetHeight;
      const imgR = img.offsetWidth / img.offsetHeight;
      if (Math.abs(faceR / want - 1) > 0.03) out.bad.push(`${id} face ${faceR.toFixed(3)} vs ${want.toFixed(3)}`);
      if (Math.abs(imgR / want - 1) > 0.03) out.bad.push(`${id} frame img ${imgR.toFixed(3)} vs ${want.toFixed(3)}`);
      for (let e = face; e && e !== document.body; e = e.parentElement) {
        const m = new DOMMatrix(getComputedStyle(e).transform === 'none' ? undefined : getComputedStyle(e).transform);
        const sx = Math.hypot(m.a, m.b), sy = Math.hypot(m.c, m.d);
        if (Math.abs(sx / sy - 1) > 0.03) { out.bad.push(`${id} non-uniform scale ${sx.toFixed(2)}/${sy.toFixed(2)}`); break; }
      }
    }
    out.bad = out.bad.slice(0, 10);
    return out;
  });
}
test('AC136: cards are never stretched (Deck Builder at 2 and 8 per row, mulligan, hand) at several window sizes', async ({ page }) => {
  for (const vp of [{ width: 1920, height: 1080 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(vp);
    await openDecks(page);
    for (const n of ['2', '8']) {
      await page.getByLabel('Cards per row', { exact: true }).fill(n);
      await page.waitForTimeout(400);
      const r = await stretchedFaces(page);
      expect(r.checked, `${vp.width} ${n}/row faces`).toBeGreaterThan(1);
      expect(r.bad, `${vp.width}x${vp.height} ${n} per row`).toEqual([]);
    }
  }
  await openMulligan(page);
  await page.waitForTimeout(500);
  let r = await stretchedFaces(page);
  expect(r.checked).toBeGreaterThan(1);
  expect(r.bad, 'mulligan').toEqual([]);
  await openTest(page);
  await newMatch(page, quiet({ playerHand: ['venom-shiv', 'fireball', 'goblin-scrapper', 'soul-shard'] }));
  await page.waitForTimeout(800);
  r = await stretchedFaces(page);
  expect(r.checked).toBeGreaterThan(1);
  expect(r.bad, 'hand').toEqual([]);
});

// menu actions are plain gold text: no border, box color, box image, shadow or outline at rest
async function boxedButtons(page, names) {
  await page.mouse.move(1, 1);
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await page.waitForTimeout(300);
  const bad = [];
  for (const name of names) {
    const b = page.getByRole('button', { name, exact: true }).first();
    await expect(b, name).toBeVisible();
    const s = await b.evaluate((e) => {
      const c = getComputedStyle(e);
      return { border: ['Top', 'Right', 'Bottom', 'Left'].map((k) => (c[`border${k}Style`] === 'none' ? 0 : parseFloat(c[`border${k}Width`]))),
        bgc: c.backgroundColor, bgi: c.backgroundImage, shadow: c.boxShadow, outline: c.outlineStyle === 'none' ? 0 : parseFloat(c.outlineWidth), color: c.color };
    });
    if (!s.border.every((w) => w === 0)) bad.push(`${name} border ${s.border}`);
    if (!CLEAR.test(s.bgc)) bad.push(`${name} background ${s.bgc}`);
    if (s.bgi !== 'none') bad.push(`${name} background-image`);
    if (s.shadow !== 'none') bad.push(`${name} box-shadow`);
    if (s.outline !== 0) bad.push(`${name} outline`);
    if (s.color !== 'rgb(255, 215, 0)') bad.push(`${name} color ${s.color}`);
  }
  return bad;
}
test('AC137: menu buttons are plain gold text with a hover glow, no boxes or borders', async ({ page }) => {
  await toTitle(page);
  expect(await boxedButtons(page, ['Play', 'Tutorial', 'Decks', 'Rules', 'Settings']), 'title').toEqual([]);
  const play = page.getByRole('button', { name: 'Play', exact: true });
  const look = () => play.evaluate((e) => { const c = getComputedStyle(e); return [c.textShadow, c.filter, c.transform, c.backgroundImage, c.color, c.fontSize].join('|'); });
  const rest = await look();
  await play.hover();
  await expect.poll(look).not.toBe(rest);
  await expect(play).toHaveCSS('cursor', 'pointer');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  expect(await boxedButtons(page, ['Back', 'Restore starter decks']), 'settings').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  expect(await boxedButtons(page, ['Back']), 'rules').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Decks', exact: true }).click();
  expect(await boxedButtons(page, ['Auto-fill', 'Save', 'Rename', 'New Deck', 'Back']), 'deck builder').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Normal', exact: true }).click();
  expect(await boxedButtons(page, ['Easy', 'Hard', 'Fight!', 'Remove Goblin Warband', 'Copy Goblin Warband to my decks', 'Restore starter decks']), 'select').toEqual([]);
});

async function fillsWindow(page, screen, where) {
  const r = await page.evaluate((sc) => {
    const el = document.querySelector(`[data-screen="${sc}"]`);
    if (!el) return { missing: true };
    const b = el.getBoundingClientRect();
    const d = document.documentElement;
    return { x: b.left, y: b.top, w: b.width, h: b.height, W: innerWidth, H: innerHeight, sw: d.scrollWidth, sh: d.scrollHeight };
  }, screen);
  expect(r.missing, `${where}: data-screen="${screen}"`).toBeUndefined();
  expect(Math.abs(r.x) <= 2 && Math.abs(r.y) <= 2, `${where} at the top-left corner`).toBe(true);
  expect(Math.abs(r.w - r.W) <= 2 && Math.abs(r.h - r.H) <= 2, `${where} ${r.w}x${r.h} fills ${r.W}x${r.H}`).toBe(true);
  expect(r.sw <= r.W + 1 && r.sh <= r.H + 1, `${where}: the page itself never scrolls`).toBe(true);
}
test('AC138: every menu screen fills the window edge to edge at 844x390, 1280x720, 1920x1080 and rescales live', async ({ page }) => {
  for (const vp of [{ width: 844, height: 390 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp);
    const at = `${vp.width}x${vp.height}`;
    await toTitle(page);
    await fillsWindow(page, 'title', `title ${at}`);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await fillsWindow(page, 'settings', `settings ${at}`);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await fillsWindow(page, 'rules', `rules ${at}`);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Decks', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
    await fillsWindow(page, 'deck-builder', `deck builder ${at}`);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toBeVisible();
    await fillsWindow(page, 'select', `select ${at}`);
  }
  // live resize without a reload
  await toSelect(page);
  for (const vp of [{ width: 1100, height: 600 }, { width: 844, height: 390 }, { width: 1600, height: 900 }]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(400);
    await fillsWindow(page, 'select', `select live ${vp.width}x${vp.height}`);
  }
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Decks', exact: true }).click();
  for (const vp of [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(400);
    await fillsWindow(page, 'deck-builder', `deck builder live ${vp.width}x${vp.height}`);
  }
});

const left = async (loc) => (await box(loc)).x;
test('AC139: Deck Builder layout: big title, logo, deck name, left-aligned panel at the top, text actions with Back under them', async ({ page }) => {
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(vp);
    await openDecks(page);
    for (const n of ['Shiv Rat', 'Snotskull Grunt', 'Soul Shard']) await addCard(page, n);
    const W = vp.width, H = vp.height, at = `${W}x${H}`;
    const panel = page.getByLabel('Deck panel', { exact: true });
    const pb = await box(panel);
    expect(pb.y, `${at} panel touches the top`).toBeLessThanOrEqual(2);
    expect(pb.x, `${at} panel on the right`).toBeGreaterThanOrEqual(W * 0.45);
    const title = panel.getByRole('heading', { name: 'Deck Builder' });
    const tb = await box(title);
    expect(tb.y - pb.y, `${at} title at the top of the panel`).toBeLessThanOrEqual(H * 0.15);
    const logo = page.getByRole('img', { name: 'Oreheart' }).first();
    const lb = await box(logo);
    expect(lb.y, `${at} logo at the top`).toBeLessThanOrEqual(H * 0.15);
    expect(lb.height, `${at} logo is big`).toBeGreaterThanOrEqual(H * 0.12);
    const lc = lb.x + lb.width / 2;
    expect(lc >= W * 0.2 && lc <= W * 0.65, `${at} logo top middle`).toBe(true);
    const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    const search = page.getByRole('searchbox', { name: 'Search cards' });
    const slider = page.getByLabel('Cards per row', { exact: true });
    for (const [n, l] of [['panel', panel], ['search', search], ['slider', slider]]) expect(overlap(lb, await box(l)), `${at} logo covers ${n}`).toBe(false);
    expect(Math.abs((await left(search)) - (await left(slider))), `${at} left controls aligned`).toBeLessThanOrEqual(24);
    expect(await left(search), `${at} controls on the left`).toBeLessThanOrEqual(W * 0.4);
    const acts = ['Auto-fill', 'Save', 'Rename', 'New Deck'].map((n) => panel.getByRole('button', { name: n, exact: true }));
    const ab = [];
    for (const a of acts) ab.push(await box(a));
    for (let i = 1; i < ab.length; i++) {
      expect(Math.abs(ab[i].y - ab[0].y), `${at} actions in one row`).toBeLessThanOrEqual(8);
      expect(ab[i].x, `${at} action order`).toBeGreaterThan(ab[i - 1].x);
    }
    const back = panel.getByRole('button', { name: 'Back', exact: true });
    const bb = await box(back);
    expect(bb.y, `${at} Back under the actions`).toBeGreaterThanOrEqual(ab[0].y + ab[0].height - 2);
    expect(await px(back), `${at} Back is large`).toBeGreaterThanOrEqual(await px(acts[0]));
    const list = deckList(page);
    const listHead = list.getByRole('heading', { name: 'Deck list' });
    expect((await box(listHead)).y, `${at} Back above the deck list`).toBeGreaterThanOrEqual(bb.y + bb.height - 2);
    const name = deckName(page);
    const lefts = [await left(title), await left(name), ab[0].x, bb.x, await left(listHead)];
    expect(Math.max(...lefts) - Math.min(...lefts), `${at} panel left-aligned ${lefts}`).toBeLessThanOrEqual(24);
    const [tf, nf, sf, hf] = [await px(title), await px(name), await px(deckSize(page)), await px(listHead)];
    expect(nf, `${at} name at least twice the count line`).toBeGreaterThanOrEqual(2 * sf);
    expect(tf, `${at} title biggest`).toBeGreaterThan(nf);
    await expect(deckSize(page)).toContainText(/3 cards \(50[–-]100\)/);
    if (W === 1920) {
      expect(tf, 'title size').toBeGreaterThanOrEqual(48);
      expect(nf, 'deck name size').toBeGreaterThanOrEqual(32);
      expect(hf, '"Deck list" heading size').toBeGreaterThanOrEqual(32);
      const row = list.getByRole('listitem').first();
      expect((await box(row)).height, 'list row height').toBeGreaterThanOrEqual(40);
      expect(await px(row), 'list entry size').toBeGreaterThanOrEqual(20);
    }
  }
});

test('AC140: the cards-per-row slider goes from 2 to 8', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openDecks(page);
  const slider = page.getByLabel('Cards per row', { exact: true });
  await expect(slider).toHaveAttribute('min', '2');
  await expect(slider).toHaveAttribute('max', '8');
  const perRow = () => allCards(page).locator('[data-card-id]').evaluateAll((els) => {
    const tops = els.slice(0, 12).map((e) => Math.round(e.getBoundingClientRect().top));
    return tops.filter((t) => Math.abs(t - tops[0]) <= 2).length;
  });
  for (const n of [2, 8]) {
    await slider.fill(String(n));
    await expect.poll(perRow).toBe(n);
  }
});

test('AC141: the deck carousel shows only my decks plus a New Deck slot; arrows, keys and dragging pick the deck', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openDecks(page);
  const car = myDecks(page);
  await expect(car.getByRole('button', { name: '+ New Deck', exact: true })).toBeVisible();
  for (const st of STARTERS) await expect(car.getByRole('button', { name: new RegExp(st) })).toHaveCount(0);
  await renameDeck(page, 'Alpha');
  await addCard(page, 'Shiv Rat');
  await saveDeck(page);
  await page.getByRole('button', { name: 'New Deck', exact: true }).click();
  await renameDeck(page, 'Beta');
  await addCard(page, 'Snotskull Grunt');
  await saveDeck(page);
  await expect(car.getByRole('button', { name: /^Beta/ })).toHaveAttribute('aria-current', 'true');
  await expect(deckName(page)).toHaveText('Beta');
  await car.getByRole('button', { name: 'Previous deck', exact: true }).click();
  await expect(deckName(page)).toHaveText('Alpha');
  await expect(car.getByRole('button', { name: /^Alpha/ })).toHaveAttribute('aria-current', 'true');
  await expect(deckList(page)).toContainText('1 × Shiv Rat');
  await car.getByRole('button', { name: /^Alpha/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(deckName(page)).toHaveText('Beta');
  // drag right with the mouse: the earlier deck (Alpha) comes to the center
  const cb = await box(car);
  const y = cb.y + cb.height / 2, x = cb.x + cb.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + i * 20, y);
  await page.mouse.up();
  await expect(deckName(page)).toHaveText('Alpha');
  await expect(car.getByRole('button', { name: /^Alpha/ })).toHaveAttribute('aria-current', 'true');
});

test('AC142: a card dragged from the grid shows at its 3-per-row size and lands in the deck', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openDecks(page);
  const slider = page.getByLabel('Cards per row', { exact: true });
  await slider.fill('3');
  await page.waitForTimeout(400);
  const tile = allCards(page).getByRole('button', { name: 'Shiv Rat', exact: true });
  await tile.scrollIntoViewIfNeeded();
  const w3 = (await box(tile)).width;
  await slider.fill('8');
  await page.waitForTimeout(400);
  await tile.scrollIntoViewIfNeeded();
  const tb = await box(tile);
  expect(tb.width).toBeLessThan(w3 * 0.8);
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(tb.x + tb.width / 2 + i * 10, tb.y + tb.height / 2 + i * 5);
  const ghost = page.locator('[data-drag-ghost]');
  await expect(ghost).toBeVisible();
  const gw = (await box(ghost)).width;
  expect(Math.abs(gw / w3 - 1), `ghost ${gw} vs 3-per-row ${w3}`).toBeLessThanOrEqual(0.1);
  const pb = await box(deckPile(page));
  for (let i = 1; i <= 10; i++) await page.mouse.move(tb.x + (pb.x + pb.width / 2 - tb.x) * i / 10, tb.y + (pb.y + pb.height / 2 - tb.y) * i / 10);
  await page.mouse.up();
  await expect(deckList(page)).toContainText('1 × Shiv Rat');
  await expect(ghost).toHaveCount(0);
});

const TWELVE = ['Shiv Rat', 'Grubgrabber Miner', 'Mangewolf Rider', 'Snotskull Grunt', 'Rotgut Grenadier', 'Skullbasher Rusher',
  'Soul Shard', 'Soul Cluster', 'Phase Stalker', 'Grimhold Ravager', 'Ironjaw Raider', 'Skullflinger'];
async function visibleRows(page) {
  return deckList(page).evaluate((list) => {
    const items = [...list.querySelectorAll('li, [role="listitem"]')];
    let sc = items[0] && items[0].parentElement;
    while (sc && sc !== list.parentElement && !(sc.scrollHeight > sc.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    const view = (sc && sc !== list.parentElement ? sc : list).getBoundingClientRect();
    const top = Math.max(view.top, 0), bottom = Math.min(view.bottom, innerHeight);
    return items.filter((i) => { const b = i.getBoundingClientRect(); return b.height > 0 && b.top >= top - 1 && b.bottom <= bottom + 1; }).length;
  });
}
test('AC143: the deck list always shows about 8 rows; it scrolls inside its panel', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openDecks(page);
  for (const n of TWELVE) await addCard(page, n);
  await expect(deckList(page).getByRole('listitem')).toHaveCount(12);
  expect(await visibleRows(page), '1280x720').toBeGreaterThanOrEqual(8);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(500);
  expect(await visibleRows(page), '844x390').toBeGreaterThanOrEqual(7);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
});

test('AC144: starter decks can be removed (in-game confirm) and restored; at least one deck always remains', async ({ page }) => {
  test.setTimeout(120000);
  page.on('dialog', (d) => { throw new Error(`browser dialog used: ${d.message()}`); });
  await toSelect(page);
  const row = deckRow(page);
  const removeDeck = async (name) => {
    await row.getByRole('button', { name: `Remove ${name}`, exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Remove deck?' });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText(name);
    await dlg.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(row.getByRole('button', { name: `${name}, 100 cards, ready`, exact: true })).toHaveCount(0);
  };
  await row.getByRole('button', { name: 'Remove Goblin Horde', exact: true }).click();
  await page.getByRole('dialog', { name: 'Remove deck?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Goblin Horde, 100 cards, ready', exact: true })).toHaveCount(1);
  await removeDeck('Goblin Horde');
  await page.reload();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Goblin Horde, 100 cards, ready', exact: true })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Goblin Warband, 100 cards, ready', exact: true })).toHaveCount(1);
  // Restore from Settings
  await toTitle(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Restore starter decks', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Goblin Horde, 100 cards, ready', exact: true })).toHaveCount(1);
  // Round 8b: per Commander, his last deck can't be removed
  for (const st of ['Goblin Warband', 'Goblin Arcane Hoard']) await removeDeck(st);
  await expect(row.getByRole('button', { name: 'Remove Goblin Horde', exact: true })).toBeDisabled();
  await expect(row.getByRole('button', { name: 'Goblin Horde, 100 cards, ready', exact: true })).toHaveCount(1);
  // Restore from the deck picker
  await page.getByRole('button', { name: 'Restore starter decks', exact: true }).click();
  for (const st of STARTERS.slice(0, 3)) await expect(row.getByRole('button', { name: `${st}, 100 cards, ready`, exact: true })).toHaveCount(1);
});

test('AC145: Copy to my decks makes an editable saved copy and leaves the starter deck unchanged; my decks can be removed', async ({ page }) => {
  page.on('dialog', (d) => { throw new Error(`browser dialog used: ${d.message()}`); });
  await toSelect(page);
  await deckRow(page).getByRole('button', { name: 'Copy Goblin Warband to my decks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
  await expect(deckName(page)).toHaveText('Goblin Warband (copy)');
  await expect(deckSize(page)).toContainText(/100 cards \(50[–-]100\)/);
  await expect(myDecks(page).getByRole('button', { name: /^Goblin Warband \(copy\)/ })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByLabel('Deck problems', { exact: true })).toContainText('Deck is legal');
  await renameDeck(page, 'My Warband');
  await deckList(page).getByRole('button', { name: 'Remove Grubgrabber Miner', exact: true }).click();
  await saveDeck(page);
  const starters = await page.evaluate(async () => await window.oreheart.listStarterDecks());
  expect(starters.find((d) => d.name === 'Goblin Warband').cards.length).toBe(100);
  await page.reload();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(deckRow(page).getByRole('button', { name: 'Goblin Warband, 100 cards, ready', exact: true })).toHaveCount(1);
  await expect(deckRow(page).getByRole('button', { name: 'My Warband, 99 cards, ready', exact: true })).toHaveCount(1);
  await deckRow(page).getByRole('button', { name: 'Remove My Warband', exact: true }).click();
  await page.getByRole('dialog', { name: 'Remove deck?' }).getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(deckRow(page).getByRole('button', { name: /^My Warband,/ })).toHaveCount(0);
  await toTitle(page);
  await page.getByRole('button', { name: 'Decks', exact: true }).click();
  await expect(myDecks(page).getByRole('button', { name: /^My Warband/ })).toHaveCount(0);
});

const COMMANDERS = ['Grubnak Rotgut, King of the Junkpile', 'Archmagister Sproingle the Unfathomable', 'Thane Borgo Gravelgrim'];
test('AC146: Choose Your Commander: big glowing Commander cards that stand out, big decks and text, filling the screen', async ({ page }) => {
  for (const vp of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(vp);
    await toSelect(page);
    const W = vp.width, H = vp.height, at = `${W}x${H}`;
    // Round 8b: measured in the row state (Grubnak preselected); clicking would focus him and hide the others
    const boxes = [];
    for (const n of COMMANDERS) {
      const b = await box(page.getByRole('button', { name: n, exact: true }));
      boxes.push(b);
      expect(b.height, `${at} ${n} height`).toBeGreaterThanOrEqual(H * 0.3);
      expect(b.x >= -1 && b.y >= -1 && b.x + b.width <= W + 1 && b.y + b.height <= H + 1, `${at} ${n} on-screen`).toBe(true);
    }
    for (const [a, b] of [[0, 1], [1, 2]]) {
      const gap = boxes[b].x - (boxes[a].x + boxes[a].width);
      expect(gap, `${at} cards ${a}/${b} do not overlap`).toBeGreaterThanOrEqual(8);
      expect(gap, `${at} cards ${a}/${b} sit close`).toBeLessThanOrEqual(W * 0.06 + 1);
    }
    const stack = deckRow(page).getByRole('button', { name: 'Goblin Warband, 100 cards, ready', exact: true });
    expect((await box(stack)).height, `${at} deck stack size`).toBeGreaterThanOrEqual(H * 0.15);
    const glow = (n) => page.getByRole('button', { name: n, exact: true }).evaluate((e) => {
      for (const x of [e, ...e.querySelectorAll('*')]) {
        const c = getComputedStyle(x);
        if (c.boxShadow !== 'none' || /drop-shadow/.test(c.filter)) return `${c.boxShadow}|${c.filter}`;
      }
      return null;
    });
    for (const n of COMMANDERS) expect(await glow(n), `${at} ${n} glows`).not.toBeNull();
    expect(await glow(COMMANDERS[0]), `${at} selected glows strongest`).not.toBe(await glow(COMMANDERS[1]));
    const blurred = await page.evaluate(() => [...document.querySelectorAll('*')].some((e) => {
      const c = getComputedStyle(e);
      return /blur\(/.test(c.backdropFilter || c.webkitBackdropFilter || '') || /blur\(/.test(c.filter);
    }));
    expect(blurred, `${at} dimmed/blurred wall behind the cards`).toBe(true);
    const fb = await box(page.getByRole('button', { name: 'Fight!', exact: true }));
    expect(fb.y + fb.height, `${at} Fight! on-screen`).toBeLessThanOrEqual(H + 1);
    if (W === 1280) expect(await px(page.getByRole('heading', { name: 'Choose Your Commander' })), 'heading 2x').toBeGreaterThanOrEqual(28);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  }
});

test('AC147: spell cards use the owner\'s real spell frames per faction', async ({ page }) => {
  await openTest(page);
  const want = { 'venom-shiv': 'goblin', fireball: 'gnome', 'shield-bubble': 'dwarf', fizzle: 'shared' };
  await newMatch(page, quiet({ playerHand: Object.keys(want) }));
  const hand = page.getByLabel('Your hand', { exact: true });
  for (const [id, f] of Object.entries(want)) {
    const face = hand.locator(`[data-card-id="${id}"]`).first();
    const img = face.locator(`img[src*="spell-frame-${f}"]`).first();
    await expect(img, id).toHaveCount(1);
    const nat = await img.evaluate(async (i) => { await i.decode().catch(() => {}); return [i.naturalWidth, i.naturalHeight]; });
    expect(nat[1], `${id} full-size owner art`).toBeGreaterThanOrEqual(1000);
    expect(Math.abs(nat[0] / nat[1] - 1152 / 1712), `${id} owner frame proportions`).toBeLessThanOrEqual(0.01);
  }
});

for (const vp of [{ width: 1920, height: 1080 }, { width: 844, height: 390 }]) {
  test.describe(`round 5a screenshots (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: vp });
    test(`AC148: Deck Builder, Choose Your Commander and a spell card per faction render without errors (${vp.width}x${vp.height})`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await openDecks(page);
      await page.waitForTimeout(600);
      await testInfo.attach(`deck-builder-${vp.width}x${vp.height}`, { body: await page.screenshot(), contentType: 'image/png' });
      await toSelect(page);
      await page.waitForTimeout(600);
      await testInfo.attach(`choose-commander-${vp.width}x${vp.height}`, { body: await page.screenshot(), contentType: 'image/png' });
      await openTest(page);
      const ids = ['venom-shiv', 'fireball', 'battle-cry', 'fizzle'];
      await newMatch(page, quiet({ playerHand: ids }));
      await page.waitForTimeout(800);
      const hand = page.getByLabel('Your hand', { exact: true });
      for (const id of ids) {
        await hand.locator(`[data-card-id="${id}"]`).first().hover();
        await page.waitForTimeout(400);
        await testInfo.attach(`spell-${id}-${vp.width}x${vp.height}`, { body: await page.screenshot(), contentType: 'image/png' });
      }
      expect(errors).toEqual([]);
    });
  });
}

// ---------- Phase 1B Round 5b (match screen: owner camera and layout) ----------
const SHAPES_5B = [[1920, 1080], [1920, 1200], [2560, 1080], [1600, 1200], [844, 390]];
const rects5b = (page) => page.evaluate(async () => await window.oreheart.screenRects());
const insideWin = (r, W, H) => r.x >= -1 && r.y >= -1 && r.x + r.width <= W + 1 && r.y + r.height <= H + 1;
const overlapShare = (a, b) => {
  const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return (ox * oy) / Math.max(1, b.width * b.height);
};
const BOARD_5B = [
  { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 },
  { cardId: 'gnome-tinker', owner: 'opponent', row: 2, col: 11 },
];

test('AC149: the cover-fit painted view keeps both Commanders whole at every window shape (Round 8a)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball'], board: BOARD_5B }));
  for (const [W, H] of SHAPES_5B) {
    await page.setViewportSize({ width: W, height: H });
    await expect.poll(async () => {
      const c = await camera(page);
      const r = await rects5b(page);
      const cover = Math.max(W / 1672, H / 941);
      return Math.abs(c.zoom - 1) < 1e-6 && Math.abs(c.minScale - cover) / cover < 0.01 && Math.abs(c.scale - c.minScale) / cover < 0.01
        && c.view.x >= -0.5 && c.view.y >= -0.5 && c.view.y <= 1 && c.view.x + c.view.width <= 1672.5 && c.view.y + c.view.height <= 941.5
        && insideWin(r.playerCommander, W, H) && insideWin(r.opponentCommander, W, H) && r.board.y > 0;
    }, { message: `${W}x${H}: cover-fit default view, both Commanders whole` }).toBe(true);
  }
});

async function blackEdges(page) {
  const buf = await page.screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const W = img.width, H = img.height, n = 40;
    const black = ([x, y]) => { const d = g.getImageData(x, y, 1, 1).data; return Math.max(d[0], d[1], d[2]) <= 6; };
    const xs = [...Array(n)].map((_, i) => Math.floor(((i + 0.5) * W) / n));
    const ys = [...Array(n)].map((_, i) => Math.floor(((i + 0.5) * H) / n));
    const out = [];
    if (xs.map((x) => [x, 2]).every(black)) out.push('top');
    if (xs.map((x) => [x, H - 3]).every(black)) out.push('bottom');
    if (ys.map((y) => [2, y]).every(black)) out.push('left');
    if (ys.map((y) => [W - 3, y]).every(black)) out.push('right');
    return out;
  }, buf.toString('base64'));
}

test('AC150: no black bars at any window shape', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await start(page, quiet({ playerHand: ['goblin-scrapper'], board: BOARD_5B }));
  for (const [W, H] of SHAPES_5B) {
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(800);
    const bf = await page.getByLabel('Battlefield', { exact: true }).boundingBox();
    expect(bf.x <= 1 && bf.y <= 1 && bf.width >= W - 2 && bf.height >= H - 2, `${W}x${H} battlefield fills the window`).toBe(true);
    expect(await blackEdges(page), `${W}x${H} black bars`).toEqual([]);
  }
});

for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`owner HUD layout ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });
    test(`AC151: HUD pieces sit at the owner's positions and never cover a Commander (${W}x${H})`, async ({ page }) => {
      await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'goblin-slinger'], opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard'], board: BOARD_5B }));
      await page.mouse.move(W / 2, H * 0.45);
      await page.waitForTimeout(1000);
      const box = async (loc) => { await expect(loc).toBeVisible(); return loc.boundingBox(); };
      const tol = 0.05;
      const pieces = {
        'Your crystal': [await box(page.getByLabel('Your crystal', { exact: true })), 0, 0.01],
        'Enemy crystal': [await box(page.getByLabel('Enemy crystal', { exact: true })), null, 0],
        'Current phase': [await box(page.getByLabel('Current phase', { exact: true })), null, 0],
        'Enemy hand': [await box(page.getByLabel('Enemy hand', { exact: true })), null, null],
        'Enemy deck': [await box(page.getByLabel('Enemy deck', { exact: true })), null, null],
        Menu: [await box(page.getByRole('button', { name: 'Menu', exact: true })), 0.89, 0.15],
        'Your deck': [await box(page.getByLabel('Your deck', { exact: true })), 0.93, null],
        Done: [await box(page.getByRole('button', { name: 'Done', exact: true })), null, null],
      };
      for (const [name, [b, px, py]] of Object.entries(pieces)) {
        if (px !== null) expect(Math.abs(b.x / W - px), `${name} x ${b.x / W}`).toBeLessThanOrEqual(tol);
        if (py !== null) expect(Math.abs(b.y / H - py), `${name} y ${b.y / H}`).toBeLessThanOrEqual(tol);
      }
      // Round 6a: enemy crystal nudged, phase tracker top-right, Your deck nudged up
      expect(pieces['Enemy crystal'][0].x / W).toBeGreaterThanOrEqual(0.58);
      expect(pieces['Enemy crystal'][0].x / W).toBeLessThanOrEqual(0.76);
      const ph = pieces['Current phase'][0];
      expect((ph.x + ph.width) / W).toBeGreaterThanOrEqual(0.96);
      const yd = pieces['Your deck'][0];
      expect(yd.y / H).toBeGreaterThanOrEqual(0.62);
      expect(yd.y / H).toBeLessThanOrEqual(0.84);
      const eh = pieces['Enemy hand'][0], ed = pieces['Enemy deck'][0];
      expect(eh.y / H).toBeLessThanOrEqual(0.06);
      expect(ed.y / H).toBeLessThanOrEqual(0.02);
      const handBox = await page.getByLabel('Your hand', { exact: true }).boundingBox();
      const handCx = (handBox.x + handBox.width / 2) / W;
      expect(handCx).toBeGreaterThanOrEqual(0.44);
      expect(handCx).toBeLessThanOrEqual(0.56);
      const ehCx = (eh.x + eh.width / 2) / W;
      expect(ehCx).toBeGreaterThanOrEqual(0.42);
      expect(ehCx).toBeLessThanOrEqual(0.58);
      expect(Math.abs(ehCx - handCx)).toBeLessThanOrEqual(0.06);
      expect((ed.x + ed.width - eh.x) / W, 'enemy deck right edge vs enemy hand left edge').toBeLessThanOrEqual(0.02);
      expect((eh.x - (ed.x + ed.width)) / W, 'enemy deck just left of the enemy hand').toBeLessThanOrEqual(0.12);
      const first = await page.getByLabel('Your hand', { exact: true }).getByRole('button').first().boundingBox();
      expect(first.height / H).toBeGreaterThanOrEqual(0.36);
      expect(first.height / H).toBeLessThanOrEqual(0.46);
      const shown = (H - first.y) / first.height;
      expect(shown).toBeGreaterThanOrEqual(0.35);
      expect(shown).toBeLessThanOrEqual(0.65);
      const r = await rects5b(page);
      const all = { ...Object.fromEntries(Object.entries(pieces).map(([k, v]) => [k, v[0]])), 'Your hand card': first };
      for (const [name, b] of Object.entries(all)) {
        for (const side of ['playerCommander', 'opponentCommander']) {
          expect(overlapShare(b, r[side]), `${name} covers ${side}`).toBeLessThanOrEqual(0.1);
        }
      }
    });
  });
}

test('AC152: Flow and bank numbers sit on both crystals with name, Flow and Next beside them', async ({ page }) => {
  await start(page, quiet({ playerCrystals: 7, playerBank: 3, opponentCrystals: 5, opponentBank: 2 }));
  const centerIn = async (label, img) => {
    const a = await page.getByLabel(label, { exact: true }).boundingBox();
    const b = await page.getByRole('img', { name: img, exact: true }).boundingBox();
    const cx = a.x + a.width / 2, cy = a.y + a.height / 2;
    return cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height;
  };
  for (const [label, n, img] of [['Your Flow crystals', '7', 'Your soul crystal'], ['Your Bank crystals', '3', 'Your soul crystal'],
    ['Enemy Flow crystals', '5', 'Enemy soul crystal'], ['Enemy Bank crystals', '2', 'Enemy soul crystal']]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveText(new RegExp(`^\\s*${n}\\s*$`));
    expect(await centerIn(label, img), `${label} on ${img}`).toBe(true);
  }
  const mine = page.getByLabel('Your crystal', { exact: true });
  const theirs = page.getByLabel('Enemy crystal', { exact: true });
  await expect(mine).toContainText(/Grubnak/);
  await expect(mine).toContainText('Flow');
  await expect(theirs).toContainText(/Borgo/);
  await expect(theirs).toContainText('Flow');
  await expect(page.getByLabel('Your income next turn', { exact: true })).toHaveText(/Next \+\d+/);
  await expect(page.getByLabel('Enemy income next turn', { exact: true })).toHaveText(/Next \+\d+/);
});

test('AC153: the phase tracker shows whose turn, the turn number and the current phase', async ({ page }) => {
  await start(page, quiet({}));
  const ph = page.getByLabel('Current phase', { exact: true });
  await expect(ph).toContainText('Your turn');
  await expect(ph).toContainText('Turn 1');
  for (const w of ['Draw', 'Deploy', 'Action', 'End']) await expect(ph).toContainText(w);
  await expect(ph.locator('[aria-current="step"]')).toHaveText(/Deploy/);
  await done(page);
  await expect(ph.locator('[aria-current="step"]')).toHaveText(/Action/);
  await done(page);
  await expect(ph).toContainText('Enemy turn');
});

test('AC154: the match Menu hides its items until hovered or tapped; Mute and Recenter work', async ({ page }) => {
  await start(page, quiet({ board: BOARD_5B }));
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  const items = [page.getByRole('button', { name: 'Last turn', exact: true }), page.getByRole('button', { name: 'Mute', exact: true }),
    page.getByRole('switch', { name: 'Card pop-ups' }), page.getByRole('button', { name: 'Recenter', exact: true })];
  await expect(menu).toBeVisible();
  for (const it of items) await expect(it).toBeHidden();
  await menu.hover();
  for (const it of items) await expect(it).toBeVisible();
  const vp = page.viewportSize();
  await page.mouse.move(vp.width * 0.3, vp.height * 0.5);
  for (const it of items) await expect(it).toBeHidden();
  await menu.click();
  await page.mouse.move(vp.width * 0.3, vp.height * 0.5);
  await page.waitForTimeout(500);
  for (const it of items) await expect(it).toBeVisible();
  const mute = items[1];
  const was = await mute.getAttribute('aria-pressed');
  await mute.click();
  await openMatchMenu(page);
  await expect(mute).toHaveAttribute('aria-pressed', was === 'true' ? 'false' : 'true');
  await page.keyboard.press('Escape');
  const field = await page.getByLabel('Battlefield', { exact: true }).boundingBox();
  await page.mouse.move(field.x + field.width / 2, field.y + field.height / 2);
  await page.mouse.wheel(0, -200);
  await expect.poll(async () => (await camera(page)).zoom).toBeGreaterThan(1);
  await openMatchMenu(page);
  await page.getByRole('button', { name: 'Recenter', exact: true }).click();
  await expect.poll(async () => (await camera(page)).zoom).toBe(1);
});

const halo = (loc) => loc.evaluate((e) => [e, ...e.querySelectorAll('[data-card-id]')].some((x) => {
  const c = getComputedStyle(x);
  return (c.boxShadow && c.boxShadow !== 'none') || /drop-shadow/.test(c.filter);
}));
test('AC155: playable hand cards glow, the others do not, and it updates at once', async ({ page }) => {
  await openTest(page);
  const cost = (id) => page.evaluate(async (i) => (await window.oreheart.getCard(i)).cost, id);
  const cheap = await cost('goblin-scrapper');
  expect(await cost('grubnaks-big-boss-troll')).toBeGreaterThan(cheap);
  await newMatch(page, quiet({ playerHand: ['goblin-scrapper', 'grubnaks-big-boss-troll'], playerCrystals: cheap }));
  const hand = page.getByLabel('Your hand', { exact: true });
  const yes = hand.getByRole('button', { name: 'Gutripper Brawler', exact: true });
  const no = hand.locator('button:has([data-card-id="grubnaks-big-boss-troll"])').first();
  await expect(yes).toHaveAttribute('data-playable', 'true');
  await expect(no).toHaveAttribute('data-playable', 'false');
  await page.mouse.move(5, 5);
  await expect.poll(() => halo(yes)).toBe(true);
  expect(await halo(no)).toBe(false);
  await done(page);
  await expect(yes).toHaveAttribute('data-playable', 'false');
  await expect.poll(() => halo(yes)).toBe(false);
});

test('AC156: Done shows only when needed, bottom-right, as plain text', async ({ page }) => {
  await start(page, { ai: false, firstPlayer: 'player' });
  await expect(page.getByRole('dialog', { name: 'Mulligan' })).toBeVisible();
  const doneBtn = page.getByRole('button', { name: 'Done' });
  await expect(doneBtn).toBeHidden();
  await newMatch(page, quiet({ playerHand: ['goblin-scrapper'] }));
  await expect(doneBtn).toBeVisible();
  const W = page.viewportSize().width;
  const b = await doneBtn.boundingBox();
  expect((b.x + b.width / 2) / W).toBeGreaterThan(0.8); // Round 6a: bottom-right under the deck
  expect(await boxedButtons(page, ['Done'])).toEqual([]);
  await done(page);
  await expect(doneBtn).toBeVisible();
  await done(page);
  expect((await getState(page)).activePlayer).toBe('opponent');
  await expect(doneBtn).toBeHidden();
});

test('AC157: mulligan, Respond, surrender and match-end controls are plain text', async ({ page }) => {
  await start(page, { ai: false, firstPlayer: 'player' });
  await expect(page.getByRole('dialog', { name: 'Mulligan' })).toBeVisible();
  expect(await boxedButtons(page, ['Keep Hand'])).toEqual([]);
  const s = await newMatch(page, respondR6(['fizzle', 'crystal-cluster'], 1));
  await castFireball(page, s);
  await expect(page.getByRole('dialog', { name: 'Respond?' })).toBeVisible();
  expect(await boxedButtons(page, ['Let it happen'])).toEqual([]);
  await newMatch(page, quiet({}));
  await openMatchMenu(page);
  await page.getByRole('button', { name: 'Surrender', exact: true }).click();
  expect(await boxedButtons(page, ['Yes, surrender'])).toEqual([]);
  await page.getByRole('button', { name: 'Yes, surrender' }).click();
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible({ timeout: 15000 });
  expect(await boxedButtons(page, ['Play again', 'Menu'])).toEqual([]);
});

async function smallText(page) {
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const bad = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const t = w.currentNode;
      const txt = t.textContent.trim();
      const el = t.parentElement;
      if (!txt || !el || el.closest('[data-card-id],[data-card-back],[aria-hidden="true"]')) continue;
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2 || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 13.5) bad.push(`${txt.slice(0, 30)} (${fs}px)`);
    }
    return bad.slice(0, 12);
  });
}
test.describe('readable sizes at 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('AC158: no text below about 14 px on any screen at phone size', async ({ page }) => {
    await page.goto('/?test=1');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    expect(await smallText(page), 'title').toEqual([]);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    expect(await smallText(page), 'settings').toEqual([]);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    expect(await smallText(page), 'rules').toEqual([]);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Decks', exact: true }).click();
    await expect(page.getByRole('slider', { name: 'Cards per row' })).toBeVisible();
    expect(await smallText(page), 'deck builder').toEqual([]);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fight!' })).toBeVisible();
    expect(await smallText(page), 'select').toEqual([]);
    await page.waitForFunction(() => !!window.oreheart);
    await newMatch(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'soul-shard'], board: BOARD_5B }));
    await page.waitForTimeout(800);
    expect(await smallText(page), 'match').toEqual([]);
  });
});

test('AC159: longer card reveals, ruby hearts with white numbers, Flow particles setting', async ({ page }) => {
  await openTest(page);
  expect((await page.evaluate(async () => await window.oreheart.getConfig())).revealSeconds).toBe(5.5);
  await newMatch(page, quiet({}));
  for (const n of ['Your Commander health', 'Enemy Commander health']) {
    const heart = page.getByLabel(n, { exact: true });
    await expect(heart).toBeVisible();
    const r = await heart.evaluate((e) => {
      const els = [e, ...e.querySelectorAll('*')];
      const ruby = /ruby-heart/.test(e.outerHTML) || els.some((x) => /ruby-heart/.test(getComputedStyle(x).backgroundImage));
      const num = els.find((x) => x.children.length === 0 && /^\d+$/.test(x.textContent.trim()));
      return { ruby, color: num ? getComputedStyle(num).color : null };
    });
    expect(r.ruby, `${n} uses the ruby heart`).toBe(true);
    expect(r.color, `${n} number is white`).toBe('rgb(255, 255, 255)');
  }
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const g = page.getByRole('radiogroup', { name: 'Flow particles' });
  for (const o of ['On', 'Reduced', 'Off']) await expect(g.getByRole('radio', { name: o, exact: true })).toBeAttached();
  await g.getByRole('radio', { name: 'Reduced', exact: true }).check();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('radiogroup', { name: 'Flow particles' }).getByRole('radio', { name: 'Reduced', exact: true })).toBeChecked();
});

for (const vp of [{ width: 1920, height: 1080 }, { width: 2560, height: 1080 }, { width: 844, height: 390 }]) {
  test.describe(`round 5b screenshots (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: vp });
    test(`AC160: match, Menu popped out and hand popped out render without errors (${vp.width}x${vp.height})`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'soul-shard', 'goblin-slinger', 'venom-shiv'],
        opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard'], playerCrystals: 4, playerBank: 2, opponentCrystals: 3, board: BOARD_5B }));
      await page.mouse.move(vp.width / 2, vp.height * 0.45);
      await page.waitForTimeout(1200);
      await testInfo.attach(`match-${vp.width}x${vp.height}`, { body: await page.screenshot(), contentType: 'image/png' });
      await page.getByRole('button', { name: 'Menu', exact: true }).hover();
      await page.waitForTimeout(500);
      await testInfo.attach(`menu-open-${vp.width}x${vp.height}`, { body: await page.screenshot(), contentType: 'image/png' });
      await page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Gutripper Brawler', exact: true }).hover();
      await page.waitForTimeout(600);
      await testInfo.attach(`hand-open-${vp.width}x${vp.height}`, { body: await page.screenshot(), contentType: 'image/png' });
      expect(errors).toEqual([]);
    });
  });
}

// ---------- Phase 1B Round 6a (AC161–AC173) ----------
const SHAPES_6A = [[1920, 1080], [844, 390]];
const hitsBattlefield = (page, pts) => page.evaluate((points) => {
  const field = document.querySelector('[aria-label="Battlefield"]');
  return points.filter(([x, y]) => { const e = document.elementFromPoint(x, y); return !(field && e && (e === field || field.contains(e))); });
}, pts);
const centralPoints = (W, H) => {
  const pts = [];
  for (const fx of [0.35, 0.45, 0.5, 0.55, 0.65]) for (const fy of [0.3, 0.4, 0.5, 0.6]) pts.push([Math.round(W * fx), Math.round(H * fy)]);
  return pts;
};

for (const [W, H] of SHAPES_6A) {
  test.describe(`round 6a match layout ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });

    test(`AC161: Done sits bottom-right under the deck and nothing invisible blocks the board (${W}x${H})`, async ({ page }) => {
      await start(page, quiet({ playerHand: ['goblin-scrapper'], board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 4, col: 8 }] }));
      const doneBtn = page.getByRole('button', { name: 'Done', exact: true });
      await expect(doneBtn).toBeVisible();
      await page.mouse.move(W / 2, H * 0.45);
      await page.waitForTimeout(1500);
      const d = await doneBtn.boundingBox();
      const deck = await page.getByLabel('Your deck', { exact: true }).boundingBox();
      expect(d.y).toBeGreaterThanOrEqual(deck.y + deck.height - 4);
      const cx = d.x + d.width / 2;
      expect(cx).toBeGreaterThanOrEqual(deck.x);
      expect(cx).toBeLessThanOrEqual(deck.x + deck.width);
      expect(cx / W).toBeGreaterThan(0.8);
      expect(d.x + d.width).toBeLessThanOrEqual(W + 1);
      expect(d.y + d.height).toBeLessThanOrEqual(H + 1);
      await expect.poll(() => hitsBattlefield(page, centralPoints(W, H)), { message: 'points in the middle blocked', timeout: 15000 }).toEqual([]);
      const unit = page.getByLabel('Gutripper Brawler, row 4, column 8', { exact: true });
      const u = await unit.boundingBox();
      await page.mouse.click(u.x + u.width / 2, u.y + u.height / 2);
      await expect(page.getByRole('dialog', { name: 'Gutripper Brawler', exact: true })).toBeVisible();
    });

    test(`AC163: the hand is 2x, centered, overlapping, tucked halfway and slides up on hover (${W}x${H})`, async ({ page }) => {
      await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'goblin-slinger', 'soul-shard', 'goblin-scrounger'] }));
      await page.mouse.move(W / 2, H * 0.3);
      await page.waitForTimeout(1200);
      const hand = page.getByLabel('Your hand', { exact: true });
      const cards = hand.getByRole('button').filter({ has: page.locator('[data-card-id]') });
      await expect(cards).toHaveCount(5);
      const boxes = [];
      for (let i = 0; i < 5; i++) boxes.push(await cards.nth(i).boundingBox());
      for (const b of boxes) {
        expect(b.height / H).toBeGreaterThanOrEqual(0.36);
        expect(b.height / H).toBeLessThanOrEqual(0.46);
        const shown = (H - b.y) / b.height;
        expect(shown, 'tucked halfway').toBeGreaterThanOrEqual(0.35);
        expect(shown, 'tucked halfway').toBeLessThanOrEqual(0.65);
      }
      const xs = boxes.map((b) => b.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) {
        const step = (xs[i] - xs[i - 1]) / boxes[0].width;
        expect(step, 'half-card overlap').toBeGreaterThanOrEqual(0.4);
        expect(step, 'half-card overlap').toBeLessThanOrEqual(0.6);
      }
      const hb = await hand.boundingBox();
      expect((hb.x + hb.width / 2) / W).toBeGreaterThanOrEqual(0.44);
      expect((hb.x + hb.width / 2) / W).toBeLessThanOrEqual(0.56);
      const target = cards.nth(0);
      const t0 = await target.boundingBox();
      await page.mouse.move(t0.x + Math.min(t0.width * 0.25, 20), t0.y + t0.height * 0.15);
      await expect.poll(async () => { const b = await cards.nth(4).boundingBox(); return b.y + b.height; }, { message: 'hand fully up' }).toBeLessThanOrEqual(H + 1);
      await page.mouse.move(W / 2, H * 0.3);
      await expect.poll(async () => { const b = await cards.nth(4).boundingBox(); return (H - b.y) / b.height; }, { message: 'tucked again' }).toBeLessThanOrEqual(0.65);
    });

    test(`AC164: the hovered card pops out at about 70% of the height on the top layer (${W}x${H})`, async ({ page }) => {
      await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'goblin-slinger', 'soul-shard', 'goblin-scrounger'] }));
      await page.waitForTimeout(1200);
      const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Searing Arcane Orb', exact: true });
      const b0 = await card.boundingBox();
      await page.mouse.move(b0.x + b0.width / 2, Math.min(H - 4, b0.y + 10));
      await expect.poll(async () => (await card.boundingBox()).height / H).toBeGreaterThanOrEqual(0.64);
      await page.waitForTimeout(500);
      const b = await card.boundingBox();
      expect(b.height / H).toBeLessThanOrEqual(0.76); // Round 8b: 20% smaller
      expect(b.x).toBeGreaterThanOrEqual(-1);
      expect(b.y).toBeGreaterThanOrEqual(-1);
      expect(b.x + b.width).toBeLessThanOrEqual(W + 1);
      expect(b.y + b.height).toBeLessThanOrEqual(H + 1);
      const pts = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([fx, fy]) => [b.x + b.width * fx, b.y + b.height * fy]);
      const covered = await card.evaluate((el, points) => points.filter(([x, y]) => { const e = document.elementFromPoint(x, y); return !(e && (e === el || el.contains(e))); }), pts);
      expect(covered, 'something covers the popped card').toEqual([]);
    });

    test(`AC166: enemy hand centered with the deck to its left; nothing covers a Commander (${W}x${H})`, async ({ page }) => {
      await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'goblin-slinger'], opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard', 'goblin-slinger'], board: BOARD_5B }));
      await page.mouse.move(W / 2, H * 0.45);
      await page.waitForTimeout(1200);
      const eh = await page.getByLabel('Enemy hand', { exact: true }).boundingBox();
      const ed = await page.getByLabel('Enemy deck', { exact: true }).boundingBox();
      const yh = await page.getByLabel('Your hand', { exact: true }).boundingBox();
      const ehCx = (eh.x + eh.width / 2) / W;
      expect(ehCx).toBeGreaterThanOrEqual(0.42);
      expect(ehCx).toBeLessThanOrEqual(0.58);
      expect(Math.abs(ehCx - (yh.x + yh.width / 2) / W)).toBeLessThanOrEqual(0.06);
      expect(eh.y / H).toBeLessThanOrEqual(0.06);
      expect(ed.y / H).toBeLessThanOrEqual(0.02);
      expect((ed.x + ed.width - eh.x) / W).toBeLessThanOrEqual(0.02);
      expect((eh.x - (ed.x + ed.width)) / W).toBeLessThanOrEqual(0.12);
      const textRects = (label) => page.getByLabel(label, { exact: true }).evaluate((root) => {
        const out = [];
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) {
          if (!w.currentNode.textContent.trim()) continue;
          const r = document.createRange(); r.selectNodeContents(w.currentNode);
          for (const b of r.getClientRects()) if (b.width && b.height) out.push({ x: b.left, y: b.top, width: b.width, height: b.height });
        }
        return out;
      });
      const a = await textRects('Enemy crystal');
      const p = await textRects('Current phase');
      const hit = (m, n) => m.x < n.x + n.width - 1 && n.x < m.x + m.width - 1 && m.y < n.y + n.height - 1 && n.y < m.y + m.height - 1;
      for (const m of a) for (const n of p) expect(hit(m, n), 'enemy crystal text overlaps the phase tracker text').toBe(false);
      const r = await rects5b(page);
      const pieces = {
        'Your crystal': page.getByLabel('Your crystal', { exact: true }), 'Enemy crystal': page.getByLabel('Enemy crystal', { exact: true }),
        'Current phase': page.getByLabel('Current phase', { exact: true }), 'Enemy hand': page.getByLabel('Enemy hand', { exact: true }),
        'Enemy deck': page.getByLabel('Enemy deck', { exact: true }), Menu: page.getByRole('button', { name: 'Menu', exact: true }),
        'Your deck': page.getByLabel('Your deck', { exact: true }), Done: page.getByRole('button', { name: 'Done', exact: true }),
        'Hand card': page.getByLabel('Your hand', { exact: true }).getByRole('button').first(),
      };
      for (const [name, loc] of Object.entries(pieces)) {
        const b = await loc.boundingBox();
        for (const side of ['playerCommander', 'opponentCommander']) expect(overlapShare(b, r[side]), `${name} covers ${side}`).toBeLessThanOrEqual(0.1);
      }
    });
  });
}

test('AC162: no hand counts for either player; deck numbers stay', async ({ page }) => {
  await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'soul-shard', 'goblin-slinger', 'venom-shiv'], opponentHand: ['goblin-scrapper', 'fireball'],
    playerDeck: SHARDS, opponentDeck: SHARDS.slice(0, 5) }));
  await page.waitForTimeout(800);
  await expect(page.getByLabel('Hand count', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Enemy hand count', { exact: true })).toHaveCount(0);
  const counts = await page.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode; const el = n.parentElement;
      if (!el || el.closest('[aria-hidden="true"], [data-card-id], [role="dialog"]')) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      if (/^\s*\d+\s*cards?\s*$/i.test(n.textContent)) out.push(n.textContent.trim());
    }
    return out;
  });
  expect(counts).toEqual([]);
  await expect(page.getByLabel('Your deck', { exact: true })).toContainText('12');
  await expect(page.getByLabel('Enemy deck', { exact: true })).toContainText('5');
});

test('AC165: face-down cards use the original Oreheart card back', async ({ page, request }) => {
  await start(page, quiet({ opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard'], playerDeck: SHARDS, opponentDeck: SHARDS.slice(0, 5) }));
  await page.waitForTimeout(800);
  const srcs = new Set();
  for (const label of ['Enemy hand']) { // Round 7: the match deck piles show deck-pile.png (AC176)
    const backs = page.getByLabel(label, { exact: true }).locator('[data-card-back]');
    const n = await backs.count();
    expect(n, `${label} has card backs`).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const src = await backs.nth(i).evaluate((e) => {
        const img = e.matches('img') ? e : e.querySelector('img[src*="oreheart-card-back"]');
        if (img && /oreheart-card-back/.test(img.src)) return img.src;
        for (const x of [e, ...e.querySelectorAll('*')]) {
          const m = /url\(["']?([^"')]*oreheart-card-back[^"')]*)/.exec(getComputedStyle(x).backgroundImage);
          if (m) return new URL(m[1], location.href).href;
        }
        return null;
      });
      expect(src, `${label} back ${i} shows oreheart-card-back`).not.toBeNull();
      srcs.add(src);
    }
  }
  for (const src of srcs) {
    const res = await request.get(src);
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toMatch(/^image\//);
  }
});

const PALETTE_6A = ['--text-gold', '--text-brown', '--text-brown-light', '--text-white', '--text-soft', '--text-black', '--text-ink', '--color-player', '--color-enemy', '--color-warning', '--color-success', '--color-damage', '--color-goblins', '--color-gnomes', '--color-dwarves'];
const strayColors = (page) => page.evaluate((vars) => {
  const probe = document.createElement('span');
  document.body.appendChild(probe);
  const rgb = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); return m ? m[1].split(',').slice(0, 3).map((v) => Math.round(parseFloat(v))).join(',') : c; };
  const allowed = new Set(vars.map((v) => { probe.style.color = `var(${v})`; return rgb(getComputedStyle(probe).color); }));
  probe.remove();
  const bad = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const n = w.currentNode; const el = n.parentElement;
    if (!/[\p{L}\p{N}]/u.test(n.textContent)) continue;
    if (!el || el.closest('[aria-hidden="true"], [data-card-id], [data-card-back], canvas, svg, script, style, noscript')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const c = rgb(getComputedStyle(el).color);
    if (!allowed.has(c)) bad.push(`${n.textContent.trim().slice(0, 25)} [${c}]`);
  }
  return bad.slice(0, 15);
}, PALETTE_6A);

test('AC167: one shared text palette, no stray text colors', async ({ page }) => {
  await openMenu(page);
  const vals = await page.evaluate((vars) => Object.fromEntries(vars.map((v) => [v, getComputedStyle(document.documentElement).getPropertyValue(v).trim().toLowerCase()])), PALETTE_6A);
  expect(vals['--text-gold']).toBe('#ffd700');
  expect(vals['--text-brown']).toBe('#b8862b');
  expect(vals['--text-brown-light']).toBe('#d4a94f');
  expect(vals['--text-white']).toBe('#ffffff');
  expect(vals['--text-soft']).toBe('#d4a94f'); // Round 8b: body text brown-gold
  expect(vals['--text-black']).toBe('#000000');
  expect(vals['--text-ink']).toBe('#1a1208');
  for (const v of ['--color-player', '--color-enemy', '--color-warning', '--color-success', '--color-damage', '--color-goblins', '--color-gnomes', '--color-dwarves']) expect(vals[v], v).not.toBe('');
  expect(vals['--color-damage']).toBe('#ff4040');
  expect(await strayColors(page), 'title').toEqual([]);
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  expect(await strayColors(page), 'rules').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible();
  expect(await strayColors(page), 'settings').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Decks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(await strayColors(page), 'deck builder').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toBeVisible();
  expect(await strayColors(page), 'select').toEqual([]);
  await openTest(page);
  await newMatch(page, quiet({ playerHand: ['goblin-scrapper', 'fireball'], board: BOARD_5B }));
  await page.waitForTimeout(800);
  expect(await strayColors(page), 'match').toEqual([]);
});

test('AC168: bold titles and main actions, regular body text, only four weights', async ({ page }) => {
  const weight = (loc) => loc.evaluate((e) => getComputedStyle(e).fontWeight);
  const bold = async (loc, label) => expect(['700', '800'], label).toContain(await weight(loc));
  await openMenu(page);
  for (const name of ['Play', 'Tutorial', 'Decks', 'Rules', 'Settings']) await bold(page.getByRole('button', { name, exact: true }), name);
  expect(await letteringProblems(page), 'title').toEqual([]);
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  const h = page.getByRole('heading', { name: 'Rules', exact: true });
  await bold(h, 'Rules heading');
  const bodyWeight = await page.evaluate(() => { const p = [...document.querySelectorAll('p, li')].find((e) => e.checkVisibility() && e.textContent.trim().length > 40); return p && getComputedStyle(p).fontWeight; });
  expect(bodyWeight).toBe('400');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Decks', exact: true }).click();
  await bold(page.getByRole('heading', { name: 'Deck Builder' }), 'Deck Builder heading');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await bold(page.getByRole('button', { name: 'Fight!', exact: true }), 'Fight!');
  await openTest(page);
  await newMatch(page, quiet({ playerHand: ['goblin-scrapper'] }));
  await bold(page.getByRole('button', { name: 'Done', exact: true }), 'Done');
  await bold(page.getByRole('button', { name: 'Menu', exact: true }), 'Menu');
  expect(await letteringProblems(page), 'match').toEqual([]);
});

test('AC169: Deck Builder close-up fills the height, has no scrollbar or Close, and dismisses on click or Esc', async ({ page }) => {
  await openDecks(page);
  const H = page.viewportSize().height;
  const tile = allCards(page).getByRole('button', { name: 'Shiv Rat', exact: true });
  const tb = await tile.locator('[data-card-id]').first().boundingBox();
  const view = page.getByRole('dialog', { name: 'Shiv Rat' });
  const open = async () => { await tile.click(); await expect(view).toBeVisible(); await page.waitForTimeout(400); };
  await open();
  const face = view.locator('[data-card-id]').first();
  const fb = await face.boundingBox();
  expect(fb.height / H).toBeGreaterThanOrEqual(0.9);
  expect(fb.height).toBeLessThanOrEqual(H + 1);
  expect(Math.abs(fb.width / fb.height - tb.width / tb.height) / (tb.width / tb.height)).toBeLessThanOrEqual(0.03);
  await expect(view.getByRole('button', { name: 'Close' })).toHaveCount(0);
  const scrollers = await view.evaluate((d) => [d, ...d.querySelectorAll('*'), document.documentElement, document.body]
    .filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)
    .filter((e) => { const s = getComputedStyle(e); return e === document.documentElement || e === document.body ? s.overflow !== 'hidden' : /(auto|scroll)/.test(s.overflowY + s.overflowX); })
    .map((e) => e.tagName));
  expect(scrollers, 'scrollable elements in the close-up').toEqual([]);
  await face.click();
  await expect(view).toBeHidden();
  await open();
  await page.mouse.click(5, 5);
  await expect(view).toBeHidden();
  await open();
  await page.keyboard.press('Escape');
  await expect(view).toBeHidden();
});

test('AC170: deck list + and - change counts at once, without moving the row; rapid clicks all count', async ({ page }) => {
  await openDecks(page);
  await allCards(page).getByRole('button', { name: 'Grubgrabber Miner', exact: true }).dblclick();
  const list = deckList(page);
  await expect(list).toContainText('1 × Grubgrabber Miner');
  const add = list.getByRole('button', { name: 'Add Grubgrabber Miner', exact: true });
  const rem = list.getByRole('button', { name: 'Remove Grubgrabber Miner', exact: true });
  const clickAndRead = (btn) => btn.evaluate(async (b) => {
    const row = b.parentElement;
    b.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const list = b.closest('[aria-label="Deck list"]');
    const anims = list ? list.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length : 0;
    return { text: list ? list.textContent : '', anims, rowConnected: row.isConnected };
  });
  const pos = async () => [await add.boundingBox(), await rem.boundingBox()];
  let before = await pos();
  let r = await clickAndRead(add);
  expect(r.text).toContain('2 × Grubgrabber Miner');
  expect(r.anims, 'running animations after +').toBe(0);
  let after = await pos();
  for (let i = 0; i < 2; i++) { expect(Math.abs(after[i].x - before[i].x)).toBeLessThanOrEqual(1); expect(Math.abs(after[i].y - before[i].y)).toBeLessThanOrEqual(1); }
  before = after;
  r = await clickAndRead(rem);
  expect(r.text).toContain('1 × Grubgrabber Miner');
  expect(r.anims, 'running animations after -').toBe(0);
  after = await pos();
  for (let i = 0; i < 2; i++) { expect(Math.abs(after[i].x - before[i].x)).toBeLessThanOrEqual(1); expect(Math.abs(after[i].y - before[i].y)).toBeLessThanOrEqual(1); }
  for (let i = 0; i < 5; i++) await add.click({ delay: 0 });
  await expect(list).toContainText('6 × Grubgrabber Miner');
});

test('AC171: no "All cards" text and no corner ornaments on any screen', async ({ page }) => {
  const noOrnaments = async (label) => {
    expect(await page.locator('[data-ornament="frame"], [data-ornament="corner"]').count(), `${label} ornaments`).toBe(0);
  };
  await openMenu(page);
  await noOrnaments('title');
  await page.getByRole('button', { name: 'Decks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
  await expect(page.getByText('All cards', { exact: true })).toHaveCount(0);
  await expect(allCards(page)).toBeVisible();
  await noOrnaments('deck builder');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await noOrnaments('rules');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await noOrnaments('settings');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toBeVisible();
  await noOrnaments('select');
  await openTest(page);
  await newMatch(page, quiet({}));
  await noOrnaments('match');
});

test('AC172: crystal mines use the owner\'s mine model (glTF placeholder or Round 8a Meshy GLB), exactly 1.5 tall, tinted by owner', async ({ page }) => {
  await start(page, quiet({ board: [
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 },
    { cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 6, minedMine: M3 },
  ] }));
  const r = await page.evaluate(async () => await window.oreheart.getRenderStats());
  if (!r.webgl) test.skip(true, 'WebGL unavailable');
  expect(r.mines).toBe('finished');
  expect(r.mineModels).toHaveLength(3);
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const neutral = new Set();
  for (const m of r.mineModels) {
    expect(m.source).toMatch(/(crystal-mine-placeholder\.gltf|crystal-mine\.glb)$/); // Round 8a: Meshy mine or placeholder
    expect(m.height).toBeGreaterThanOrEqual(1.47);
    expect(m.height).toBeLessThanOrEqual(1.53);
    expect(['player', 'opponent', 'neutral']).toContain(m.owner);
    expect(m.tint).toMatch(/^#[0-9a-f]{6}$/i);
    const [R, , B] = rgb(m.tint);
    if (m.owner === 'player') expect(B).toBeGreaterThan(R);
    if (m.owner === 'opponent') expect(R).toBeGreaterThan(B);
    if (m.owner === 'neutral') neutral.add(m.tint.toLowerCase());
  }
  expect(neutral.size).toBeLessThanOrEqual(1);
  for (const m of r.mineModels) if (m.owner !== 'neutral' && neutral.size) expect(neutral.has(m.tint.toLowerCase())).toBe(false);
});

for (const vp of [{ width: 1920, height: 1080 }, { width: 844, height: 390 }]) {
  test.describe(`round 6a screenshots (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: vp });
    test(`AC173: match with hand at rest and popped out, deck builder close-up and card back render without errors (${vp.width}x${vp.height})`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'soul-shard', 'goblin-slinger', 'venom-shiv', 'goblin-scrounger', 'fireball'],
        opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard', 'goblin-slinger'], playerCrystals: 4, playerBank: 2, opponentCrystals: 3, board: BOARD_5B }));
      await page.mouse.move(vp.width / 2, vp.height * 0.3);
      await page.waitForTimeout(1200);
      await testInfo.attach(`6a-match-rest-${vp.width}x${vp.height}`, { body: await page.screenshot(), contentType: 'image/png' });
      const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Gutripper Brawler', exact: true });
      const b = await card.boundingBox();
      await page.mouse.move(b.x + b.width / 2, Math.min(vp.height - 4, b.y + 10));
      await page.waitForTimeout(800);
      await testInfo.attach(`6a-match-popout-${vp.width}x${vp.height}`, { body: await page.screenshot(), contentType: 'image/png' });
      const back = page.getByLabel('Enemy hand', { exact: true }).locator('[data-card-back]').first();
      await testInfo.attach(`6a-card-back-${vp.width}x${vp.height}`, { body: await back.screenshot(), contentType: 'image/png' });
      await page.goto('/?test=1');
      await page.getByRole('button', { name: 'Decks', exact: true }).click();
      await allCards(page).getByRole('button', { name: 'Shiv Rat', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Shiv Rat' })).toBeVisible();
      await page.waitForTimeout(600);
      await testInfo.attach(`6a-deck-closeup-${vp.width}x${vp.height}`, { body: await page.screenshot(), contentType: 'image/png' });
      expect(errors).toEqual([]);
    });
  });
}

// ---------- Round 7 ----------
const handCards7 = (page) => page.getByLabel('Your hand', { exact: true }).getByRole('button').filter({ has: page.locator('[data-card-id]') });
// a point inside the card's visible part where the card itself receives the pointer
const hoverPointOf = (card) => card.evaluate((el) => {
  const b = el.getBoundingClientRect();
  for (const fy of [0.08, 0.15, 0.25, 0.35, 0.5]) for (const fx of [0.15, 0.3, 0.5, 0.7, 0.85]) {
    const x = b.left + b.width * fx; const y = Math.min(innerHeight - 3, b.top + b.height * fy);
    if (x < 1 || x > innerWidth - 1 || y < 1) continue;
    const e = document.elementFromPoint(x, y);
    if (e && (e === el || el.contains(e))) return [x, y];
  }
  return null;
});
const HAND_R7 = ['goblin-scrapper', 'fireball', 'goblin-slinger', 'soul-shard', 'goblin-scrounger'];

for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`round 7 hand (${W}x${H})`, () => {
    test.use({ viewport: { width: W, height: H } });

    test(`AC174: hovered hand cards always retract; only one pops at a time; nothing stays stuck (${W}x${H})`, async ({ page }) => {
    test.setTimeout(120000);
      await start(page, quiet({ playerHand: HAND_R7, playerCrystals: 6 }));
      const away = () => page.mouse.move(W / 2, H * 0.3, { steps: 3 });
      await away();
      await page.waitForTimeout(1200);
      const cards = handCards7(page);
      await expect(cards).toHaveCount(5);
      const heights = async () => {
        const n = await cards.count(); const out = [];
        for (let i = 0; i < n; i++) out.push((await cards.nth(i).boundingBox()).height / H);
        return out;
      };
      const allRest = (msg) => expect.poll(async () => (await heights()).filter((h) => h > 0.47).length, { message: msg, timeout: 4000 }).toBe(0);
      const onlyPopped = (i, msg) => expect.poll(async () => (await heights()).every((h, j) => (j === i ? h >= 0.6 : h <= 0.47)), { message: msg, timeout: 4000 }).toBe(true);
      for (let i = 0; i < 5; i++) {
        const pt = await hoverPointOf(cards.nth(i));
        expect(pt, `card ${i} can be hovered`).not.toBeNull();
        await page.mouse.move(pt[0], pt[1], { steps: 4 });
        await onlyPopped(i, `only card ${i} is popped`);
        await away();
        await allRest(`card ${i} retracts after the pointer leaves`);
      }
      // moving straight from one card to another retracts the first (when the second can be reached)
      let pt = await hoverPointOf(cards.nth(0));
      await page.mouse.move(pt[0], pt[1], { steps: 4 });
      await onlyPopped(0, 'card 0 popped');
      const pt4 = await hoverPointOf(cards.nth(4));
      if (pt4) {
        await page.mouse.move(pt4[0], pt4[1], { steps: 4 });
        await onlyPopped(4, 'card 4 popped, card 0 retracted');
      }
      await away();
      await allRest('all cards back after leaving the hand');
      await expect.poll(async () => {
        const n = await cards.count(); const shown = [];
        for (let i = 0; i < n; i++) { const b = await cards.nth(i).boundingBox(); shown.push((H - b.y) / b.height); }
        return shown.every((s) => s >= 0.35 && s <= 0.65);
      }, { message: 'hand tucked halfway again' }).toBe(true);
      // a drag dropped back on the hand leaves nothing stuck
      pt = await hoverPointOf(cards.nth(2));
      await page.mouse.move(pt[0], pt[1], { steps: 3 });
      await page.mouse.down();
      await page.mouse.move(W / 2, H * 0.5, { steps: 8 });
      await page.mouse.move(pt[0], pt[1], { steps: 8 });
      await page.mouse.up();
      await away();
      await allRest('nothing stuck after a drag dropped back on the hand');
      await page.waitForTimeout(500);
      const before = await cards.count();
      // playing a card while one is popped leaves nothing stuck
      const s = await getState(page);
      const uid = handUid(s, 'player', 'goblin-scrapper');
      const summon = (await legal(page)).find((a) => a.type === 'summon' && a.uid === uid);
      expect(summon, 'the scrapper can be summoned').toBeTruthy();
      const scrapper = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Gutripper Brawler', exact: true });
      pt = await hoverPointOf(scrapper);
      await page.mouse.move(pt[0], pt[1], { steps: 3 });
      await expect.poll(async () => (await scrapper.boundingBox()).height / H).toBeGreaterThanOrEqual(0.6);
      expect((await act(page, summon)).ok).toBe(true);
      await expect(cards).toHaveCount(before - 1);
      await page.waitForTimeout(600);
      expect((await heights()).filter((h) => h > 0.47).length, 'at most one card popped after playing').toBeLessThanOrEqual(1);
      await away();
      await allRest('nothing stuck after a card was played');
    });

    test(`AC175: hand cards are about 10% smaller (36-46% of the height), still tucked halfway (${W}x${H})`, async ({ page }) => {
      await start(page, quiet({ playerHand: HAND_R7 }));
      await page.mouse.move(W / 2, H * 0.3);
      await page.waitForTimeout(1200);
      const cards = handCards7(page);
      await expect(cards).toHaveCount(5);
      for (let i = 0; i < 5; i++) {
        const b = await cards.nth(i).boundingBox();
        expect(b.height / H).toBeGreaterThanOrEqual(0.36);
        expect(b.height / H).toBeLessThanOrEqual(0.46);
        const shown = (H - b.y) / b.height;
        expect(shown).toBeGreaterThanOrEqual(0.35);
        expect(shown).toBeLessThanOrEqual(0.65);
      }
    });
  });
}

const oldDeckArt = (page) => page.evaluate(() => {
  const bad = [];
  for (const e of document.querySelectorAll('*')) {
    const src = e.tagName === 'IMG' ? e.getAttribute('src') || '' : '';
    const bg = getComputedStyle(e).backgroundImage || '';
    if (/deck-image|Deck_image/i.test(src + ' ' + bg)) bad.push(src || bg);
  }
  return bad;
});
const pileSize = (pile) => pile.locator('img[src*="deck-pile"]').first().evaluate((i) => [i.naturalWidth, i.naturalHeight]);

test('AC176: the owner\'s card back and deck-pile pictures are used exactly', async ({ page }) => {
  await start(page, quiet({ opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard'], playerDeck: SHARDS, opponentDeck: SHARDS.slice(0, 5) }));
  await page.waitForTimeout(800);
  const backs = page.getByLabel('Enemy hand', { exact: true }).locator('[data-card-back]');
  expect(await backs.count()).toBeGreaterThan(0);
  const size = await backs.first().evaluate(async (e) => {
    let src = null;
    const img = e.matches('img') ? e : e.querySelector('img[src*="oreheart-card-back"]');
    if (img && /oreheart-card-back/.test(img.src)) src = img.src;
    if (!src) for (const x of [e, ...e.querySelectorAll('*')]) {
      const m = /url\(["']?([^"')]*oreheart-card-back[^"')]*)/.exec(getComputedStyle(x).backgroundImage);
      if (m) { src = new URL(m[1], location.href).href; break; }
    }
    if (!src) return null;
    const i = new Image(); i.src = src; await i.decode();
    return [i.naturalWidth, i.naturalHeight];
  });
  expect(size, 'owner card back (1184x1664)').toEqual([1184, 1664]);
  for (const label of ['Your deck', 'Enemy deck']) {
    const pile = page.getByLabel(label, { exact: true });
    await expectDeckImage(pile, label);
    expect(await pileSize(pile), label).toEqual([1155, 1313]);
    await expect(pile.locator('[data-card-back]'), `${label} uses deck-pile.png, not card backs`).toHaveCount(0);
  }
  await expect(page.getByLabel('Your deck', { exact: true })).toContainText('12');
  await expect(page.getByLabel('Enemy deck', { exact: true })).toContainText('5');
  const yd = await page.getByLabel('Your deck', { exact: true }).boundingBox();
  const ed = await page.getByLabel('Enemy deck', { exact: true }).boundingBox();
  expect(ed.width * ed.height, 'enemy deck smaller than yours').toBeLessThan(yd.width * yd.height);
  expect(await oldDeckArt(page), 'match').toEqual([]);
  await openDecks(page);
  const dp = page.getByLabel('Deck pile', { exact: true });
  await expectDeckImage(dp, 'Deck pile');
  expect(await pileSize(dp)).toEqual([1155, 1313]);
  expect(await oldDeckArt(page), 'deck builder').toEqual([]);
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expectDeckImage(page.getByLabel('Deck choice', { exact: true }), 'Deck choice');
  expect(await oldDeckArt(page), 'deck picker').toEqual([]);
});

const handGlow = (page) => page.evaluate(async () => await window.oreheart.getHandGlow());
const glowOutset = (card) => card.evaluate((el) => {
  const g = el.querySelector('[data-card-glow]'); const f = el.querySelector('[data-card-id]');
  if (!g || !f) return null;
  const a = g.getBoundingClientRect(); const b = f.getBoundingClientRect();
  return ((b.left - a.left) + (a.right - b.right) + (b.top - a.top) + (a.bottom - b.bottom)) / 4;
});

test('AC177: a popped card keeps the at-rest glow thickness and opacity', async ({ page }) => {
  await start(page, quiet({ playerHand: ['goblin-scrapper', 'goblin-slinger', 'goblin-scrounger'], playerCrystals: 10 }));
  await page.mouse.move(640, 200);
  await page.waitForTimeout(1200);
  const g0 = await handGlow(page);
  expect(g0).toHaveLength(3);
  const idx = g0.findIndex((g) => g.glowing);
  expect(idx, 'a playable card glows').toBeGreaterThanOrEqual(0);
  const card = handCards7(page).nth(idx);
  const rest = await glowOutset(card);
  expect(rest, 'glow element present').not.toBeNull();
  expect(rest).toBeGreaterThan(0);
  const pt = await hoverPointOf(card);
  await page.mouse.move(pt[0], pt[1], { steps: 3 });
  await expect.poll(async () => (await handGlow(page))[idx].popped).toBe(true);
  await page.waitForTimeout(500);
  const popped = await glowOutset(card);
  const g1 = (await handGlow(page))[idx];
  expect(Math.abs(popped - rest), `glow ${rest}px at rest vs ${popped}px popped`).toBeLessThanOrEqual(2);
  expect(popped).toBeLessThan(rest * 2 + 2);
  expect(Math.abs(g1.thicknessPx - g0[idx].thicknessPx)).toBeLessThanOrEqual(2);
  expect(Math.abs(g1.opacity - g0[idx].opacity)).toBeLessThanOrEqual(0.05);
});

test('AC178: glow colors contrast with each faction frame', async ({ page }) => {
  await start(page, quiet({ playerHand: ['goblin-scrapper', 'gnome-tinker', 'ironhammer-berserker', 'healing-light'], playerCrystals: 10 }));
  await page.waitForTimeout(800);
  const g = await handGlow(page);
  expect(new Set(g.map((x) => x.faction))).toEqual(new Set(['goblins', 'gnomes', 'dwarves', 'shared']));
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (const x of g) {
    expect(x.color).toMatch(/^#[0-9a-f]{6}$/i);
    const [R, G, B] = rgb(x.color);
    const msg = `${x.cardId} ${x.color}`;
    if (x.faction === 'goblins') { expect(B - G, msg).toBeGreaterThan(30); expect(R - G, msg).toBeGreaterThan(30); }
    if (x.faction === 'gnomes') { expect(B - R, msg).toBeGreaterThan(30); expect(B - G, msg).toBeGreaterThan(30); }
    if (x.faction === 'dwarves') { expect(R - B, msg).toBeGreaterThan(40); expect(G - B, msg).toBeGreaterThan(40); }
    if (x.faction === 'shared') { expect(Math.min(R, G, B), msg).toBeGreaterThanOrEqual(170); expect(R, msg).toBeGreaterThanOrEqual(B); }
  }
});

test('AC179: crystal mines are exactly 1.5 spaces tall', async ({ page }) => {
  await start(page, quiet({}));
  const r = await page.evaluate(async () => await window.oreheart.getRenderStats());
  if (!r.webgl) test.skip(true, 'WebGL unavailable');
  expect(r.mineModels).toHaveLength(3);
  for (const m of r.mineModels) {
    expect(m.height).toBeGreaterThanOrEqual(1.47);
    expect(m.height).toBeLessThanOrEqual(1.53);
  }
});

// Part B (Meshy). Skips itself when the builder could not deliver the models (owner allowed Part B to fail).
const CANON_ANIMS = ['idle', 'laugh', 'point', 'celebrate', 'surprised', 'cast', 'hit', 'defeat'];
async function grubnakModels(request) {
  const res = await request.get('/models/commanders/models.json');
  if (!res.ok()) return null;
  try { const j = await res.json(); return j && j.grubnak ? j : null; } catch { return null; }
}
const renderStats = (page) => page.evaluate(async () => await window.oreheart.getRenderStats());
const grubnakEntry = async (page, side) => (await renderStats(page)).commanderModels.find((c) => c.side === side);

test('AC180: Grubnak model files are saved once with models.json; the game never calls Meshy', async ({ page, request }) => {
  const m = await grubnakModels(request);
  test.skip(!m, 'Part B not delivered (no models.json)');
  for (const k of CANON_ANIMS) expect(typeof m.grubnak.animations[k], `animation ${k}`).toBe('string');
  for (const [key, file, max] of [['grubnak', 'grubnak.glb', 10.5 * 1024 * 1024], ['fortress', 'grubnak-fortress.glb', 5.25 * 1024 * 1024], ['scepter', 'grubnak-scepter.glb', 5.25 * 1024 * 1024]]) {
    expect(m[key].file).toBe(file);
    const res = await request.get(`/models/commanders/${file}`);
    expect(res.ok(), file).toBe(true);
    const body = await res.body();
    expect(body.subarray(0, 4).toString('latin1'), `${file} is a GLB`).toBe('glTF');
    expect(body.length, `${file} bytes`).toBe(m[key].bytes);
    expect(body.length, `${file} size`).toBeLessThanOrEqual(max);
  }
  const meshy = [];
  page.on('request', (r) => { try { if (/meshy\.ai$/i.test(new URL(r.url()).hostname)) meshy.push(r.url()); } catch { /* ignore */ } });
  await start(page, quiet({}));
  await renderStats(page);
  await page.waitForTimeout(1000);
  expect(meshy).toEqual([]);
});

test('AC181: Grubnak is the Meshy model on his fortress with the scepter, about 2.4 tall, idling', async ({ page, request }) => {
  test.skip(!(await grubnakModels(request)), 'Part B not delivered (no models.json)');
  for (const side of ['player', 'opponent']) {
    await openTest(page);
    await newMatch(page, { ai: false, playerCommander: side === 'player' ? 'grubnak' : 'borgo', opponentCommander: side === 'player' ? 'borgo' : 'grubnak', setup: { opponentHand: [] } });
    const r = await renderStats(page);
    if (!r.webgl) test.skip(true, 'WebGL unavailable');
    const g = r.commanderModels.find((c) => c.side === side);
    expect(g, `${side} commander model`).toBeTruthy();
    expect(g.commanderId).toBe('grubnak');
    expect(g.source).toMatch(/grubnak\.glb$/);
    expect(g.fortress).toMatch(/grubnak-fortress\.glb$/);
    expect(g.scepter).toMatch(/grubnak-scepter\.glb$/);
    expect(g.scepterBone).toMatch(/hand|wrist|palm/i);
    expect(g.scepterBone).toMatch(/right|(^|[^a-z])r([^a-z]|$)/i);
    expect(g.height).toBeGreaterThanOrEqual(2.2);
    expect(g.height).toBeLessThanOrEqual(2.6);
    for (const a of CANON_ANIMS) expect(g.animations).toContain(a);
    expect(g.currentAnimation).toBe('idle');
  }
});

test('AC182: Grubnak plays cast, defeat and celebrate at the right moments', async ({ page, request }) => {
  test.setTimeout(120000);
  test.skip(!(await grubnakModels(request)), 'Part B not delivered (no models.json)');
  await start(page, quiet({ playerHand: ['fireball'], playerCrystals: 10, board: [{ cardId: 'goblin-scrapper', owner: 'opponent', row: 4, col: 8 }] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  await castOrb(page, 4, 8);
  await expect.poll(async () => (await grubnakEntry(page, 'player')).animationLog, { timeout: 15000 }).toContain('cast');
  await surrenderViaMenu(page);
  await expect.poll(async () => (await grubnakEntry(page, 'player')).animationLog, { timeout: 15000 }).toContain('defeat');
  await openTest(page);
  await newMatch(page, { ai: false, playerCommander: 'borgo', opponentCommander: 'grubnak', setup: { opponentHand: [] } });
  await surrenderViaMenu(page);
  await expect.poll(async () => (await grubnakEntry(page, 'opponent')).animationLog, { timeout: 15000 }).toContain('celebrate');
});

async function checkGrubnakViewer(page) {
  await page.getByRole('button', { name: 'View Grubnak in 3D', exact: true }).click();
  const dlg = page.getByRole('dialog', { name: 'Grubnak in 3D', exact: true });
  await expect(dlg).toBeVisible();
  const canvas = dlg.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const vs = () => page.evaluate(async () => await window.oreheart.getViewerState());
  await expect.poll(async () => (await vs()).open).toBe(true);
  expect((await vs()).source).toMatch(/grubnak\.glb$/);
  for (const name of CANON_ANIMS) {
    const label = name[0].toUpperCase() + name.slice(1);
    const b = dlg.getByRole('button', { name: label, exact: true });
    await expect(b).toBeVisible();
    await b.click();
    await expect.poll(async () => (await vs()).animation, { message: label }).toBe(name);
  }
  const cb = await canvas.boundingBox();
  const r0 = (await vs()).rotationY;
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width / 2 + Math.min(150, cb.width / 3), cb.y + cb.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await vs()).rotationY - r0), { message: 'drag spins' }).toBeGreaterThan(0.1);
  const z0 = (await vs()).zoom;
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await vs()).zoom, { message: 'wheel zooms' }).not.toBe(z0);
  await dlg.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dlg).toBeHidden();
  await page.getByRole('button', { name: 'View Grubnak in 3D', exact: true }).click();
  await expect(dlg).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
}

test('AC183: no "View Grubnak in 3D" button remains on Choose Your Commander or the Deck Builder (Round 8b)', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => !!window.oreheart);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /in 3D/ })).toHaveCount(0);
  await openDecks(page);
  await expect(page.getByRole('button', { name: /in 3D/ })).toHaveCount(0);
});

test.describe('round 7 screenshots (1920x1080)', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC184: Grubnak in a match and in the 3D viewer render without errors', async ({ page, request }, testInfo) => {
    test.skip(!(await grubnakModels(request)), 'Part B not delivered (no models.json)');
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await start(page, quiet({ playerHand: HAND_R7, playerCrystals: 4, board: BOARD_5B }));
    await page.mouse.move(960, 300);
    await page.waitForTimeout(1500);
    await testInfo.attach('r7-grubnak-match-1920x1080', { body: await page.screenshot(), contentType: 'image/png' });
    await openDecks(page);
    await page.getByLabel('Commander card', { exact: true }).getByRole('button', { name: COMMANDERS[0], exact: true }).click();
    await expect(page.getByRole('dialog', { name: COMMANDERS[0], exact: true }).getByLabel('3D model', { exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
    await testInfo.attach('r7-grubnak-viewer-1920x1080', { body: await page.screenshot(), contentType: 'image/png' });
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Phase 1B Round 8a: painted Skullfang Arena board, view controls, Meshy crystal mine
// ---------------------------------------------------------------------------
const arenaInfo = (page) => page.evaluate(async () => await window.oreheart.getArena());
const sq2s = (page, row, col) => page.evaluate(async ([r, c]) => await window.oreheart.squareToScreen(r, c), [row, col]);
const ARENA_FILES = ['skullfang-swamp-background.jpg', 'skullfang-arena.png', 'skullfang-arena-layout.json'];
async function arenaLayout(request) {
  const res = await request.get('/art/arena/skullfang-arena-layout.json');
  expect(res.ok(), 'layout served from /art/arena/').toBe(true);
  return res.json();
}
// Unit square (0,0)(1,0)(1,1)(0,1) -> quad p0..p3 (top-left, top-right, bottom-right, bottom-left)
function homography([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
  return (u, v) => { const w = g * u + h * v + 1; return [(a * u + b * v + x0) / w, (d * u + e * v + y0) / w]; };
}
// Expected window position of a square center from the layout and the current view
function expectedCenter(layout, arenaPic, cam, row, col) {
  const H = homography(layout.boardCorners);
  const [ax, ay] = H((col - 0.5) / 13, (row - 0.5) / 7);
  const bx = layout.arena.centerX + (ax - arenaPic.width / 2) * layout.arena.scale;
  const by = layout.arena.centerY + (ay - arenaPic.height / 2) * layout.arena.scale;
  return { x: (bx - cam.view.x) * cam.scale, y: (by - cam.view.y) * cam.scale };
}
const SAMPLE_SQUARES = [[1, 1], [1, 13], [7, 13], [7, 1], [4, 7], [2, 4], [6, 10], [3, 12], [5, 2]];
async function checkSquares(page, layout) {
  const ar = await arenaInfo(page);
  const cam = await camera(page);
  for (const [r, c] of SAMPLE_SQUARES) {
    const got = await sq2s(page, r, c);
    const want = expectedCenter(layout, ar.arenaPicture, cam, r, c);
    const next = expectedCenter(layout, ar.arenaPicture, cam, r, c === 13 ? 12 : c + 1);
    const tol = Math.max(3, 0.05 * Math.abs(next.x - want.x));
    expect(Math.abs(got.x - want.x), `square ${r},${c} x`).toBeLessThanOrEqual(tol);
    expect(Math.abs(got.y - want.y), `square ${r},${c} y`).toBeLessThanOrEqual(tol);
  }
}
async function zoomIn(page, x, y, clicks = 4) {
  await page.mouse.move(x, y);
  for (let i = 0; i < clicks; i++) { await page.mouse.wheel(0, -240); await page.waitForTimeout(120); }
  await expect.poll(async () => (await camera(page)).zoom).toBeGreaterThan(1.2);
  await page.waitForTimeout(600);
}
const viewOk = (v) => v.x >= -0.5 && v.y >= -0.5 && v.x + v.width <= 1672.5 && v.y + v.height <= 941.5;
const ARENA_BOARD = [
  { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 },
  { cardId: 'gnome-tinker', owner: 'opponent', row: 2, col: 11 },
];

test('AC185: the owner\'s arena pictures and layout are loaded unchanged', async ({ page, request }) => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const here = path.dirname((await import('node:url')).fileURLToPath(import.meta.url));
  const refDirs = [path.resolve(here, '../../../factory-design/design/references'), path.resolve(process.cwd(), 'factory-design/design/references')];
  const refDir = refDirs.find((d) => fs.existsSync(path.join(d, 'skullfang-arena.png')));
  for (const f of ARENA_FILES) {
    const res = await request.get(`/art/arena/${f}`);
    expect(res.ok(), `/art/arena/${f}`).toBe(true);
    if (refDir) expect(Buffer.compare(await res.body(), fs.readFileSync(path.join(refDir, f))), `${f} byte-identical`).toBe(0);
  }
  const layout = await arenaLayout(request);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await start(page, quiet({ board: ARENA_BOARD }));
  await expect.poll(async () => (await arenaInfo(page)).layoutName).toBe('skull arena final draft');
  const a = await arenaInfo(page);
  expect(a.background.src).toContain('/art/arena/skullfang-swamp-background.jpg');
  expect(a.arenaPicture.src).toContain('/art/arena/skullfang-arena.png');
  expect([a.background.width, a.background.height]).toEqual([1672, 941]);
  expect([a.arenaPicture.width, a.arenaPicture.height]).toEqual([1672, 941]);
  expect(a.arena).toEqual(layout.arena);
  expect(a.boardCorners).toEqual(layout.boardCorners);
  expect(a.look).toEqual(layout.arenaLook);
});

test('AC186: all 54 effects are drawn, off-painting pools are clipped, two foreground cut-outs', async ({ page, request }) => {
  const layout = await arenaLayout(request);
  await start(page, quiet({ board: ARENA_BOARD }));
  await expect.poll(async () => (await arenaInfo(page)).effects.length).toBe(54);
  const a = await arenaInfo(page);
  expect(layout.effects).toHaveLength(54);
  layout.effects.forEach((e, i) => {
    expect(a.effects[i].type, `effect ${i} type`).toBe(e.type);
    expect(a.effects[i].x, `effect ${i} x`).toBeCloseTo(e.x, 0);
    expect(a.effects[i].y, `effect ${i} y`).toBeCloseTo(e.y, 0);
  });
  const outside = layout.effects.map((e, i) => [e, i]).filter(([e]) => e.type === 'pool' && e.x + (e.width || 0) / 2 > 1672);
  expect(outside.length).toBe(2);
  for (const [, i] of outside) expect(a.effects[i].clipped, `pool ${i} clipped`).toBe(true);
  expect(a.foregroundCutouts).toBe(2);
});

test('AC187: no grid lines are drawn, even while dragging a card', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await start(page, quiet({ playerHand: ['goblin-scrapper'], playerCrystals: 5, board: ARENA_BOARD }));
  expect((await arenaInfo(page)).gridLines).toBe(0);
  await page.waitForTimeout(1500);
  const card = await page.getByLabel('Your hand', { exact: true }).getByRole('button').first().boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.25);
  await page.mouse.down();
  const t = await sq2s(page, 7, 11);
  await page.mouse.move(t.x, t.y - 40, { steps: 12 });
  expect((await arenaInfo(page)).gridLines).toBe(0);
  await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.25, { steps: 8 });
  await page.mouse.up();
});

for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`arena homography ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });
    test(`AC188: square centers follow the homography of the owner's corners (${W}x${H})`, async ({ page, request }) => {
      const layout = await arenaLayout(request);
      await start(page, quiet({ board: ARENA_BOARD }));
      await page.waitForTimeout(800);
      await checkSquares(page, layout);
      // creature labels stand on their squares
      const cam = await camera(page);
      const ar = await arenaInfo(page);
      for (const [name, r, c] of [['goblin-scrapper', 6, 3], ['gnome-tinker', 2, 11]]) {
        expect(at(await getState(page), r, c), `${name} on ${r},${c}`).toBeTruthy();
        const lb = await page.getByLabel(new RegExp(`, row ${r}, column ${c}$`)).first().boundingBox();
        const want = expectedCenter(layout, ar.arenaPicture, cam, r, c);
        const next = expectedCenter(layout, ar.arenaPicture, cam, r, c + 1);
        expect(Math.abs(lb.x + lb.width / 2 - want.x), `${name} label centered on its square`).toBeLessThanOrEqual(Math.abs(next.x - want.x) / 2);
      }
      // still exact after zooming and panning
      await zoomIn(page, W * 0.45, H * 0.45, 3);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(800);
      await checkSquares(page, layout);
    });
  });
}

test.describe('arena highlights 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC189: drag highlights are the legal summon squares on the painted floor; drop uses the mapping', async ({ page, request }) => {
    const layout = await arenaLayout(request);
    let s = await start(page, quiet({ playerHand: ['goblin-scrapper'], playerCrystals: 5, board: ARENA_BOARD }));
    await page.waitForTimeout(1500);
    const uid = s.players.player.hand[0].uid;
    const legalSquares = (await legal(page)).filter((a) => a.type === 'summon' && a.uid === uid).map((a) => `${a.row},${a.col}`).sort();
    expect(legalSquares.length).toBeGreaterThan(0);
    const hand = page.getByLabel('Your hand', { exact: true }).getByRole('button').first();
    let card = await hand.boundingBox();
    const t = await sq2s(page, 7, 11);
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(t.x, t.y - 60, { steps: 15 });
    await page.waitForTimeout(300);
    const a = await arenaInfo(page);
    const cam = await camera(page);
    const summon = a.highlights.filter((h) => h.kind === 'summon');
    expect(summon.map((h) => `${h.row},${h.col}`).sort()).toEqual(legalSquares);
    for (const h of summon) {
      const want = expectedCenter(layout, a.arenaPicture, cam, h.row, h.col);
      expect(Math.hypot(h.center.x - want.x, h.center.y - want.y), `highlight ${h.row},${h.col} on its painted square`).toBeLessThanOrEqual(6);
    }
    // cancel: back over the hand and release
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.25, { steps: 10 });
    await page.mouse.up();
    const crystal = await page.getByLabel('Your crystal', { exact: true }).boundingBox();
    await page.mouse.move(crystal.x + crystal.width / 2, crystal.y + crystal.height / 2);
    await expect.poll(async () => (await arenaInfo(page)).highlights.length).toBe(0);
    expect(at(await getState(page), 7, 11)).toBeFalsy();
    // drop on the mapped square
    card = await hand.boundingBox();
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(t.x, t.y, { steps: 15 });
    await page.mouse.up();
    await expect.poll(async () => at(await getState(page), 7, 11)?.cardId).toBe('goblin-scrapper');
  });
});

test('AC190: cover-fit with no black bars at 16:9, 4:3, 21:9 and phone; max zoom about 2.5 px per painting pixel', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await start(page, quiet({ board: ARENA_BOARD }));
  for (const [W, H] of [[1920, 1080], [1600, 1200], [2560, 1080], [844, 390]]) {
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(800);
    const cover = Math.max(W / 1672, H / 941);
    const c = await camera(page);
    expect(c.zoom, `${W}x${H} zoom`).toBeCloseTo(1, 3);
    expect(Math.abs(c.minScale - cover) / cover, `${W}x${H} cover scale`).toBeLessThanOrEqual(0.01);
    expect(Math.abs(c.scale - cover) / cover).toBeLessThanOrEqual(0.01);
    expect(viewOk(c.view), `${W}x${H} view inside painting`).toBe(true);
    expect(c.view.y, `${W}x${H} view starts at the painting top`).toBeLessThanOrEqual(1);
    expect(Math.abs(c.view.width - W / c.scale)).toBeLessThanOrEqual(2);
    const bf = await page.getByLabel('Battlefield', { exact: true }).boundingBox();
    expect(bf.x <= 1 && bf.y <= 1 && bf.width >= W - 2 && bf.height >= H - 2, `${W}x${H} battlefield fills the window`).toBe(true);
    expect(await blackEdges(page), `${W}x${H} black bars`).toEqual([]);
    const r = await rects5b(page);
    expect(insideWin(r.playerCommander, W, H) && insideWin(r.opponentCommander, W, H), `${W}x${H} Commanders whole`).toBe(true);
    // cannot zoom out past the cover fit
    await page.mouse.move(W / 2, H / 2);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(500);
    expect((await camera(page)).zoom).toBeGreaterThanOrEqual(0.999);
    expect(viewOk((await camera(page)).view)).toBe(true);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);
  await page.mouse.move(960, 500);
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(40); }
  await page.waitForTimeout(1200);
  const c = await camera(page);
  expect(c.scale).toBeGreaterThanOrEqual(2.25);
  expect(c.scale).toBeLessThanOrEqual(2.75);
  expect(c.maxScale).toBeGreaterThanOrEqual(2.25);
  expect(c.maxScale).toBeLessThanOrEqual(2.75);
  expect(Math.abs(c.scale - c.maxScale)).toBeLessThanOrEqual(0.05);
  expect(viewOk(c.view)).toBe(true);
  expect(await blackEdges(page)).toEqual([]);
});

test.describe('arena pan 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC191: keys, WASD and dragging empty board pan the view, always clamped to the painting', async ({ page }) => {
    await start(page, quiet({ board: ARENA_BOARD }));
    await page.waitForTimeout(800);
    await zoomIn(page, 960, 500, 4);
    const before = (await camera(page)).view;
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await camera(page)).view.x).toBeGreaterThan(before.x + 1);
    const v1 = (await camera(page)).view;
    for (let i = 0; i < 4; i++) await page.keyboard.press('a');
    await expect.poll(async () => (await camera(page)).view.x).toBeLessThan(v1.x - 1);
    const v2 = (await camera(page)).view;
    for (let i = 0; i < 4; i++) await page.keyboard.press('s');
    await expect.poll(async () => (await camera(page)).view.y).toBeGreaterThan(v2.y + 1);
    for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'w', 'd']) {
      for (let i = 0; i < 40; i++) await page.keyboard.press(key);
      await page.waitForTimeout(700);
      expect(viewOk((await camera(page)).view), `clamped after ${key}`).toBe(true);
    }
    // drag on an empty square pans; drag far stays clamped
    await page.keyboard.press('ArrowUp');
    for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(700);
    const p = await sq2s(page, 6, 8);
    const v3 = (await camera(page)).view;
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x - 200, p.y - 60, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => Math.abs((await camera(page)).view.x - v3.x)).toBeGreaterThan(5);
    const p2 = await sq2s(page, 6, 8);
    await page.mouse.move(p2.x, p2.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(p2.x + 3000, p2.y + 2000, { steps: 20 });
    await page.mouse.up({ button: 'middle' });
    await page.waitForTimeout(700);
    expect(viewOk((await camera(page)).view)).toBe(true);
  });
});

test('AC191: at zoom 1 on a 4:3 window the view pans sideways but never past the edges', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await start(page, quiet({ board: ARENA_BOARD }));
  await page.waitForTimeout(800);
  const v0 = (await camera(page)).view;
  for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(800);
  const v1 = (await camera(page)).view;
  expect(v1.x).toBeLessThan(v0.x - 20);
  expect(v1.x).toBeGreaterThanOrEqual(-0.5);
  for (let i = 0; i < 120; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);
  const v2 = (await camera(page)).view;
  expect(v2.x + v2.width).toBeLessThanOrEqual(1672.5);
  expect(v2.x).toBeGreaterThan(v0.x + 20);
  expect((await camera(page)).zoom).toBeCloseTo(1, 3);
});

test.describe('arena HUD 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC192: the HUD stays fixed while zooming and panning; Recenter and double-click reset the view', async ({ page }) => {
    await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball'], opponentHand: ['goblin-scrapper'], board: ARENA_BOARD }));
    await page.waitForTimeout(1500);
    const pieces = {
      'Your crystal': page.getByLabel('Your crystal', { exact: true }),
      'Enemy crystal': page.getByLabel('Enemy crystal', { exact: true }),
      'Current phase': page.getByLabel('Current phase', { exact: true }),
      Menu: page.getByRole('button', { name: 'Menu', exact: true }),
      'Your deck': page.getByLabel('Your deck', { exact: true }),
      Done: page.getByRole('button', { name: 'Done', exact: true }),
      'Your hand': page.getByLabel('Your hand', { exact: true }),
    };
    const boxes = async () => Object.fromEntries(await Promise.all(Object.entries(pieces).map(async ([k, l]) => [k, await l.boundingBox()])));
    const crystal = await pieces['Your crystal'].boundingBox();
    await page.mouse.move(crystal.x + crystal.width / 2, crystal.y + crystal.height / 2);
    await page.waitForTimeout(500);
    const b0 = await boxes();
    await zoomIn(page, 960, 480, 4);
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    await page.mouse.move(crystal.x + crystal.width / 2, crystal.y + crystal.height / 2);
    await page.waitForTimeout(800);
    const b1 = await boxes();
    for (const k of Object.keys(pieces)) {
      expect(b1[k], k).toBeTruthy();
      for (const f of ['x', 'y', 'width', 'height']) expect(Math.abs(b1[k][f] - b0[k][f]), `${k} ${f} unchanged`).toBeLessThanOrEqual(2);
    }
    await openMatchMenu(page);
    await page.getByRole('button', { name: 'Recenter', exact: true }).click();
    await expect.poll(async () => (await camera(page)).zoom).toBeCloseTo(1, 3);
    await expect.poll(async () => { const c = await camera(page); return Math.abs(c.panX) + Math.abs(c.panY); }).toBeLessThanOrEqual(0.5);
    expect((await camera(page)).view.y).toBeLessThanOrEqual(1);
    // double-click on an empty square also recenters
    await page.mouse.move(1500, 120);
    await page.waitForTimeout(600);
    await zoomIn(page, 960, 480, 3);
    const e = await sq2s(page, 6, 8);
    await page.mouse.dblclick(e.x, e.y);
    await expect.poll(async () => (await camera(page)).zoom).toBeCloseTo(1, 3);
    await expect.poll(async () => { const c = await camera(page); return Math.abs(c.panX) + Math.abs(c.panY); }).toBeLessThanOrEqual(0.5);
  });
});

test('AC193: the Meshy crystal mine is saved once and used for every mine, tinted by owner', async ({ page, request }) => {
  const res = await request.get('/models/mines/models.json');
  let m = null;
  if (res.ok()) { try { m = await res.json(); } catch { m = null; } }
  test.skip(!(m && m.crystalMine), 'Meshy mine not delivered (no /models/mines/models.json)');
  expect(m.crystalMine.file).toBe('crystal-mine.glb');
  const glb = await request.get('/models/mines/crystal-mine.glb');
  expect(glb.ok()).toBe(true);
  const body = await glb.body();
  expect(body.subarray(0, 4).toString('latin1')).toBe('glTF');
  expect(body.length).toBe(m.crystalMine.bytes);
  expect(body.length).toBeLessThanOrEqual(5.25 * 1024 * 1024);
  const meshy = [];
  page.on('request', (r) => { try { if (/meshy\.ai$/i.test(new URL(r.url()).hostname)) meshy.push(r.url()); } catch { /* ignore */ } });
  await start(page, quiet({ board: [
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 },
    { cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 6, minedMine: M3 },
  ] }));
  const r = await renderStats(page);
  if (!r.webgl) test.skip(true, 'WebGL unavailable');
  expect(r.mineModels).toHaveLength(3);
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (const mm of r.mineModels) {
    expect(mm.source).toMatch(/crystal-mine\.glb$/);
    expect(mm.height).toBeGreaterThanOrEqual(1.47);
    expect(mm.height).toBeLessThanOrEqual(1.53);
    const [R, , B] = rgb(mm.tint);
    if (mm.owner === 'player') expect(B).toBeGreaterThan(R);
    if (mm.owner === 'opponent') expect(R).toBeGreaterThan(B);
  }
  await page.waitForTimeout(1000);
  expect(meshy).toEqual([]);
});

test.describe('arena drags 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC194: dragging a hand card or a creature never pans the view', async ({ page }) => {
    await start(page, quiet({ playerHand: ['goblin-scrapper'], playerCrystals: 5, board: ARENA_BOARD }));
    await page.waitForTimeout(1500);
    const lbl = page.getByLabel(/, row 6, column 3$/).first();
    let lb = await lbl.boundingBox();
    await zoomIn(page, lb.x + lb.width / 2, lb.y + lb.height / 2, 3);
    const same = (a, b) => Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.width - b.width) <= 1;
    const v0 = (await camera(page)).view;
    const card = await page.getByLabel('Your hand', { exact: true }).getByRole('button').first().boundingBox();
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(960, 420, { steps: 10 });
    await page.mouse.move(1100, 380, { steps: 10 });
    expect(same((await camera(page)).view, v0), 'card drag does not pan').toBe(true);
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.25, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect(same((await camera(page)).view, v0)).toBe(true);
    await done(page); // to the Action phase
    await page.waitForTimeout(1500);
    lb = await lbl.boundingBox();
    const v1 = (await camera(page)).view;
    const to = await sq2s(page, 5, 3);
    await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    expect(same((await camera(page)).view, v1), 'creature drag does not pan').toBe(true);
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect(same((await camera(page)).view, v1)).toBe(true);
  });
});

for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`round 8a screenshots ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });
    test(`AC195: the painted arena match fully zoomed out and zoomed in renders without errors (${W}x${H})`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await start(page, quiet({ playerHand: HAND_R7, playerCrystals: 4, board: ARENA_BOARD }));
      await page.mouse.move(W * 0.5, H * 0.3);
      await page.waitForTimeout(2000);
      await testInfo.attach(`r8a-match-zoomed-out-${W}x${H}`, { body: await page.screenshot(), contentType: 'image/png' });
      await zoomIn(page, W * 0.5, H * 0.45, 5);
      await page.waitForTimeout(800);
      await testInfo.attach(`r8a-match-zoomed-in-${W}x${H}`, { body: await page.screenshot(), contentType: 'image/png' });
      expect(errors).toEqual([]);
    });
  });
}

// ---------------------------------------------------------------------------
// Phase 1B Round 8b: Commander facing, glow, hand hover box, pop-out, stat badges,
// Deck Builder drag / no shift, Choose Your Commander, brown-gold text, close-up viewer
// ---------------------------------------------------------------------------
const cmdEntry = async (page, side) => (await renderStats(page)).commanderModels.find((c) => c.side === side);
const handHover = (page) => page.evaluate(async () => await window.oreheart.getHandHover());
const selectState = (page) => page.evaluate(async () => await window.oreheart.getSelectState());
const HAND8 = ['goblin-scrapper', 'fireball', 'goblin-slinger', 'soul-shard', 'goblin-scrounger', 'goblin-scrapper', 'goblin-slinger', 'goblin-scrounger'];

test('AC196: the player Commander faces the opponent and turns back after a look-back', async ({ page }) => {
  await start(page, { ...quiet({ playerHand: HAND_R7, playerCrystals: 4, board: BOARD_5B }), firstPlayer: 'player' });
  await expect.poll(async () => (await cmdEntry(page, 'player')).emoteLog, { timeout: 10000 }).toContain('lookBack');
  await expect.poll(async () => { const c = await cmdEntry(page, 'player'); return c.facingDeg <= 15 && c.emote === 'none'; }, { timeout: 10000, message: 'back to facing the opponent' }).toBe(true);
  const p = await cmdEntry(page, 'player');
  expect(p.turnMs).toBeGreaterThanOrEqual(400);
  expect(p.turnMs).toBeLessThanOrEqual(600);
  expect((await cmdEntry(page, 'opponent')).facingDeg, 'enemy faces our side').toBeLessThanOrEqual(15);
});

test('AC197: impatience starts after about 20 s idle and stops on an action', async ({ page }) => {
  await start(page, { ...quiet({ playerHand: HAND_R7, playerCrystals: 4, board: BOARD_5B }), firstPlayer: 'player' });
  await expect.poll(async () => (await cmdEntry(page, 'player')).emote, { timeout: 10000 }).toBe('none');
  await page.evaluate(async () => await window.oreheart.advanceIdle(10));
  await page.waitForTimeout(300);
  expect((await cmdEntry(page, 'player')).emote, 'not impatient after 10 s').not.toBe('impatient');
  await page.evaluate(async () => await window.oreheart.advanceIdle(11));
  await expect.poll(async () => { const c = await cmdEntry(page, 'player'); return c.emote === 'impatient' && c.facingDeg >= 120; }, { timeout: 5000 }).toBe(true);
  await done(page);
  await expect.poll(async () => { const c = await cmdEntry(page, 'player'); return c.emote !== 'impatient' && c.facingDeg <= 15; }, { timeout: 3000 }).toBe(true);
});

test('AC198: the hand glow is brightest at the card edge and fades outward', async ({ page }) => {
  await start(page, quiet({ playerHand: HAND_R7, playerCrystals: 6 }));
  await page.mouse.move(640, 200);
  await page.waitForTimeout(1200);
  const check = async (when) => {
    const g = (await page.evaluate(async () => await window.oreheart.getHandGlow())).filter((c) => c.glowing);
    expect(g.length, `${when}: some cards glow`).toBeGreaterThan(0);
    for (const c of g) {
      expect(c.profile, `${when} ${c.cardId} profile`).toHaveLength(5);
      expect(c.profile[0], `${when} ${c.cardId} bright at the edge`).toBeGreaterThanOrEqual(0.8 * c.opacity - 0.001);
      for (let i = 1; i < 5; i++) expect(c.profile[i], `${when} ${c.cardId} fades outward`).toBeLessThanOrEqual(c.profile[i - 1] + 0.001);
      expect(c.profile[4], `${when} ${c.cardId} fades to nothing`).toBeLessThanOrEqual(0.1);
    }
  };
  await check('rest');
  const insets = await page.evaluate(() => [...document.querySelectorAll('[data-card-glow]')].filter((e) => /inset/.test(getComputedStyle(e).boxShadow)).length);
  expect(insets, 'no inset glow').toBe(0);
  const cards = handCards7(page);
  const pt = await hoverPointOf(cards.nth(0));
  await page.mouse.move(pt[0], pt[1], { steps: 4 });
  await expect.poll(async () => (await page.evaluate(async () => await window.oreheart.getHandGlow()))[0].popped).toBe(true);
  await check('popped');
});

for (const n of [1, 4, 8]) {
  test(`AC199: the hand hover box fits ${n} card(s) and a point above it does not raise the hand`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await start(page, quiet({ playerHand: HAND8.slice(0, n), playerCrystals: 6 }));
    await page.mouse.move(640, 150);
    await page.waitForTimeout(1200);
    const fits = (h, when) => {
      const z = h.zone, c = h.cards;
      expect(z.width, `${when} zone exists`).toBeGreaterThan(0);
      expect(Math.abs(z.x - c.x), `${when} left`).toBeLessThanOrEqual(16);
      expect(Math.abs(z.y - c.y), `${when} top`).toBeLessThanOrEqual(16);
      expect(Math.abs(z.x + z.width - (c.x + c.width)), `${when} right`).toBeLessThanOrEqual(16);
      expect(Math.abs(z.y + z.height - (c.y + c.height)), `${when} bottom`).toBeLessThanOrEqual(16);
      expect(z.x <= c.x + 1 && z.y <= c.y + 1 && z.x + z.width >= c.x + c.width - 1 && z.y + z.height >= c.y + c.height - 1, `${when} zone contains the cards`).toBe(true);
    };
    let h = await handHover(page);
    expect(h.raised).toBe(false);
    fits(h, 'rest');
    if (h.zone.y - 40 > 5) {
      await page.mouse.move(h.zone.x + h.zone.width / 2, h.zone.y - 40, { steps: 3 });
      await page.waitForTimeout(600);
      expect((await handHover(page)).raised, 'above the box: hand stays tucked').toBe(false);
    }
    const pt = await hoverPointOf(handCards7(page).nth(0));
    await page.mouse.move(pt[0], pt[1], { steps: 3 });
    await expect.poll(async () => (await handHover(page)).raised).toBe(true);
    await page.waitForTimeout(500);
    fits(await handHover(page), 'raised');
    await page.mouse.move(640, 150, { steps: 3 });
    await expect.poll(async () => (await handHover(page)).raised).toBe(false);
  });
}

test.describe('hand never rises while dragging 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC200: dragging a creature or panning across the hand never raises it', async ({ page }) => {
    await start(page, { ...quiet({ playerHand: HAND_R7, playerCrystals: 6, board: BOARD_5B }), firstPlayer: 'player' });
    await done(page); // Action phase: the Scrapper can move
    await page.mouse.move(960, 300);
    await page.waitForTimeout(1200);
    const hz = (await handHover(page)).zone;
    const target = { x: hz.x + hz.width / 2, y: hz.y + hz.height / 2 };
    const sweep = async (from) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) {
        await page.mouse.move(from.x + (target.x - from.x) * i / 12, from.y + (target.y - from.y) * i / 12);
        expect((await handHover(page)).raised, `raised during drag step ${i}`).toBe(false);
      }
      await page.waitForTimeout(400);
      expect((await handHover(page)).raised, 'raised while held over the hand').toBe(false);
      for (let i = 11; i >= 0; i--) await page.mouse.move(from.x + (target.x - from.x) * i / 12, from.y + (target.y - from.y) * i / 12);
      await page.mouse.up();
    };
    await sweep(await sq2s(page, 6, 3)); // drag the creature, then drop it back on its own square
    await zoomIn(page, 960, 400);
    const empty = await sq2s(page, 4, 7);
    await sweep(empty); // pan from empty board across the hand
    await page.mouse.move(960, 300);
    await page.waitForTimeout(400);
    expect((await handHover(page)).raised).toBe(false);
  });
});

for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`round 8b pop-out ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });
    test(`AC201: the pop-out is about 70% of the window height, eased 150-200 ms (${W}x${H})`, async ({ page }) => {
      await start(page, quiet({ playerHand: HAND_R7, playerCrystals: 6 }));
      await page.mouse.move(W / 2, H * 0.3);
      await page.waitForTimeout(1200);
      const card = handCards7(page).nth(2);
      const pt = await hoverPointOf(card);
      await page.mouse.move(pt[0], pt[1], { steps: 4 });
      await expect.poll(async () => (await card.boundingBox()).height / H).toBeGreaterThanOrEqual(0.64);
      await page.waitForTimeout(500);
      const b = await card.boundingBox();
      expect(b.height / H).toBeLessThanOrEqual(0.76);
      expect(b.x >= -1 && b.y >= -1 && b.x + b.width <= W + 1 && b.y + b.height <= H + 1, 'on-screen').toBe(true);
      const top = await card.evaluate((el, [x, y]) => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); }, [b.x + b.width / 2, b.y + b.height / 2]);
      expect(top, 'popped card on top').toBe(true);
      const ms = (await handHover(page)).popMs;
      expect(ms).toBeGreaterThanOrEqual(150);
      expect(ms).toBeLessThanOrEqual(200);
    });
  });
}

test.describe('round 8b stat badges 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('AC202: stat badges are small painted icons with readable numbers', async ({ page }) => {
    await start(page, { ai: false, setup: { board: [
      { cardId: 'wolf-rider', owner: 'player', row: 5, col: 6 },
      { cardId: 'gnome-tinker', owner: 'player', row: 5, col: 9, damage: 1 },
    ] } });
    await page.waitForTimeout(800);
    for (const name of ['Mangewolf Rider, row 5, column 6', 'Aegis Tinkerer, row 5, column 9']) {
      const label = page.getByLabel(name, { exact: true });
      await expect(label).toBeVisible();
      const b = await label.boundingBox();
      expect(b.width, `${name} width`).toBeLessThanOrEqual(76);
      expect(b.height, `${name} height`).toBeLessThanOrEqual(30);
      const info = await label.evaluate((el) => {
        const icons = [...el.querySelectorAll('*')].filter((e) => (e.tagName === 'IMG' && /stat-/.test(e.getAttribute('src') || '')) || /stat-/.test(getComputedStyle(e).backgroundImage)).length;
        const nums = [];
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) { const t = w.currentNode.textContent.trim(); if (/^\d+$/.test(t)) { const e = w.currentNode.parentElement; const c = getComputedStyle(e); nums.push({ t, size: parseFloat(c.fontSize), color: c.color }); } }
        return { icons, nums };
      });
      expect(info.icons, `${name} icons`).toBeGreaterThanOrEqual(3);
      expect(info.nums.length, `${name} numbers`).toBeGreaterThanOrEqual(3);
      for (const nn of info.nums) expect(nn.size, `${name} number size`).toBeGreaterThanOrEqual(14);
    }
    await expect(page.getByLabel('Mangewolf Rider, row 5, column 6', { exact: true })).toHaveText(/3\D+4\D+2/);
    const tinker = await page.getByLabel('Aegis Tinkerer, row 5, column 9', { exact: true }).evaluate((el) =>
      [...el.querySelectorAll('*')].some((e) => e.children.length === 0 && /^\d+$/.test(e.textContent.trim()) && getComputedStyle(e).color === 'rgb(255, 64, 64)'));
    expect(tinker, 'damaged Health in the damage color').toBe(true);
  });
});

async function dragTile(page, tile, to, steps = 10) {
  const tb = await box(tile);
  const from = { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps);
  await page.mouse.up();
}
const listDrop = async (page) => { const b = await box(deckList(page)); return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 80) }; };

test('AC203: dragging a card onto the deck list adds one copy; a plain click opens the close-up', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openDecks(page);
  const tile = allCards(page).getByRole('button', { name: 'Shiv Rat', exact: true });
  await tile.scrollIntoViewIfNeeded();
  await dragTile(page, tile, await listDrop(page));
  await expect(deckList(page)).toContainText('1 × Shiv Rat');
  await expect(page.getByRole('dialog', { name: 'Shiv Rat' })).toHaveCount(0);
  await expect(page.locator('[data-drag-ghost]')).toHaveCount(0);
  await tile.click();
  await expect(page.getByRole('dialog', { name: 'Shiv Rat' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Shiv Rat' })).toBeHidden();
  await expect(deckList(page)).toContainText('1 × Shiv Rat');
  await expect(deckList(page)).not.toContainText('2 × Shiv Rat');
});

test('AC204: adding cards by double-click, drag and + never moves the panel, the grid or the cards', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await openDecks(page);
  await page.getByRole('button', { name: 'New Deck', exact: true }).click();
  await page.waitForTimeout(500);
  const firstCard = allCards(page).getByRole('button').filter({ has: page.locator('[data-card-id]') }).first();
  const snap = async () => ({ panel: await box(page.getByLabel('Deck panel', { exact: true })), grid: await box(allCards(page)), card: await box(firstCard) });
  const s0 = await snap();
  const same = async (when) => {
    await page.waitForTimeout(250);
    const s1 = await snap();
    for (const k of ['panel', 'grid', 'card']) for (const d of ['x', 'y', 'width', 'height']) {
      expect(Math.abs(s1[k][d] - s0[k][d]), `${when}: ${k}.${d}`).toBeLessThanOrEqual(1);
    }
  };
  const names = TWELVE;
  for (let i = 0; i < names.length; i++) {
    const tile = allCards(page).getByRole('button', { name: names[i], exact: true });
    if (i % 2 === 0) await tile.dblclick();
    else {
      await tile.scrollIntoViewIfNeeded();
      await dragTile(page, tile, await listDrop(page));
    }
    await expect(deckList(page).getByRole('button', { name: `Add ${names[i]}`, exact: true })).toBeVisible();
    await allCards(page).evaluate((g) => { let e = g; while (e) { e.scrollTop = 0; e = e.parentElement; } });
    await same(`after adding ${names[i]} (${i % 2 === 0 ? 'double-click' : 'drag'})`);
    await deckList(page).getByRole('button', { name: `Add ${names[i]}`, exact: true }).click();
    await same(`after + on ${names[i]}`);
  }
});

const deckStacks = (page) => deckRow(page).getByRole('button', { name: /(cards, (ready|not ready)|New Deck)$/ });

test('AC205: every deck entry on Choose Your Commander has the same size, also for long names and when selected', async ({ page }) => {
  await openDecks(page);
  await renameDeck(page, 'The Extremely Long Named Goblin Junkpile Deck');
  await addCard(page, 'Grubgrabber Miner', 50);
  await saveDeck(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toBeVisible();
  const stacks = deckStacks(page);
  await expect(stacks.first()).toBeVisible();
  const n = await stacks.count();
  expect(n).toBeGreaterThanOrEqual(5);
  const measure = async () => { const out = []; for (let i = 0; i < n; i++) { await stacks.nth(i).scrollIntoViewIfNeeded(); out.push(await box(stacks.nth(i))); } return out; };
  const b0 = await measure();
  for (const b of b0) {
    expect(Math.abs(b.width - b0[0].width), 'same width').toBeLessThanOrEqual(1);
    expect(Math.abs(b.height - b0[0].height), 'same height').toBeLessThanOrEqual(1);
  }
  await deckRow(page).getByRole('button', { name: /^The Extremely Long Named Goblin Junkpile Deck, 50 cards/ }).click();
  await page.waitForTimeout(400);
  const b1 = await measure();
  for (let i = 0; i < n; i++) {
    expect(Math.abs(b1[i].width - b0[i].width), `entry ${i} width after select`).toBeLessThanOrEqual(1);
    expect(Math.abs(b1[i].height - b0[i].height), `entry ${i} height after select`).toBeLessThanOrEqual(1);
  }
});

test('AC206: choosing a Commander hides the other two and shows only his decks; Change Commander, Esc and a second click bring the row back', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await toSelect(page);
  for (const n of COMMANDERS) await expect(page.getByRole('button', { name: n, exact: true })).toBeVisible();
  expect((await selectState(page)).mode).toBe('row');
  // hover grows the hovered card and shrinks the others
  const w = async () => Promise.all(COMMANDERS.map(async (n) => (await box(page.getByRole('button', { name: n, exact: true }))).width));
  const w0 = await w();
  await page.getByRole('button', { name: COMMANDERS[1], exact: true }).hover();
  await expect.poll(async () => { const x = await w(); return x[1] > w0[1] + 1 && x[0] < w0[0] - 0.5 && x[2] < w0[2] - 0.5; }, { message: 'hover grow/shrink' }).toBe(true);
  const grub = page.getByRole('button', { name: COMMANDERS[0], exact: true });
  const focus = async () => {
    await grub.click();
    await expect(page.getByRole('button', { name: COMMANDERS[1], exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: COMMANDERS[2], exact: true })).toBeHidden();
    await expect(grub).toBeVisible();
    await expect(grub).toHaveAttribute('aria-pressed', 'true');
    expect((await selectState(page)).mode).toBe('focused');
    await expect(page.getByRole('button', { name: 'Change Commander', exact: true })).toBeVisible();
    await expect(deckRow(page).getByRole('button', { name: 'Goblin Warband, 100 cards, ready', exact: true })).toBeVisible();
    await expect(deckRow(page).getByRole('button', { name: /^(Gnome|Dwarf) / })).toHaveCount(0);
  };
  const backToRow = async (how) => {
    for (const n of COMMANDERS) await expect(page.getByRole('button', { name: n, exact: true }), how).toBeVisible();
    expect((await selectState(page)).mode, how).toBe('row');
    await expect(page.getByRole('button', { name: 'Change Commander', exact: true })).toHaveCount(0);
  };
  await focus();
  await page.getByRole('button', { name: 'Change Commander', exact: true }).click();
  await backToRow('Change Commander');
  await focus();
  await page.keyboard.press('Escape');
  await backToRow('Esc');
  await focus();
  await grub.click();
  await backToRow('second click');
  await page.getByRole('button', { name: COMMANDERS[1], exact: true }).click();
  expect((await selectState(page)).commanderId).toBe('sproingle');
  await expect(deckRow(page).getByRole('button', { name: 'Gnome Warband, 100 cards, ready', exact: true })).toBeVisible();
  await expect(deckRow(page).getByRole('button', { name: /^(Goblin|Dwarf) / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  const s = await keepAndGetState(page);
  expect(s.players.player.commanderId).toBe('sproingle');
});

test('AC207: Grubnak\'s 3D model pops up in front of his card when he is chosen', async ({ page, request }) => {
  test.skip(!(await grubnakModels(request)), 'no Grubnak models.json');
  await toSelect(page);
  await page.getByRole('button', { name: COMMANDERS[0], exact: true }).click();
  await expect.poll(async () => { const m = (await selectState(page)).model; return !!(m && m.shown && /grubnak\.glb$/.test(m.source)); }, { timeout: 15000 }).toBe(true);
  await expect(page.locator('canvas:visible').first()).toBeVisible();
});

test('AC208: Fight! sits bottom-right in both states at 1920x1080 and 844x390', async ({ page }) => {
  for (const [W, H] of [[1920, 1080], [844, 390]]) {
    await page.setViewportSize({ width: W, height: H });
    await toSelect(page);
    const check = async (state) => {
      const fb = await box(page.getByRole('button', { name: 'Fight!', exact: true }));
      expect(fb.x + fb.width, `${W}x${H} ${state} right`).toBeGreaterThanOrEqual(W * 0.85);
      expect(fb.y + fb.height, `${W}x${H} ${state} bottom`).toBeGreaterThanOrEqual(H * 0.85);
      expect(fb.x + fb.width <= W + 1 && fb.y + fb.height <= H + 1, `${W}x${H} ${state} on-screen`).toBe(true);
    };
    await check('row');
    await page.getByRole('button', { name: COMMANDERS[0], exact: true }).click();
    await expect(page.getByRole('button', { name: 'Change Commander', exact: true })).toBeVisible();
    await check('focused');
    await expect(page.getByRole('button', { name: /in 3D/ })).toHaveCount(0);
  }
  await openDecks(page);
  await expect(page.getByRole('button', { name: /in 3D/ })).toHaveCount(0);
});

test('AC209: the Deck Builder close-up shows the 3D viewer beside Grubnak\'s card and dismisses correctly', async ({ page, request }) => {
  test.setTimeout(120000);
  await openDecks(page);
  // a card without a model: close-up alone
  await allCards(page).getByRole('button', { name: 'Shiv Rat', exact: true }).click();
  const shiv = page.getByRole('dialog', { name: 'Shiv Rat' });
  await expect(shiv).toBeVisible();
  await expect(shiv.getByLabel('3D model', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(shiv).toBeHidden();
  const tile = page.getByLabel('Commander card', { exact: true }).getByRole('button', { name: COMMANDERS[0], exact: true });
  await expect(tile).toBeVisible();
  test.skip(!(await grubnakModels(request)), 'no Grubnak models.json');
  const dlg = page.getByRole('dialog', { name: COMMANDERS[0], exact: true });
  const open = async () => { await tile.click(); await expect(dlg).toBeVisible(); await page.waitForTimeout(500); };
  await open();
  const viewer = dlg.getByLabel('3D model', { exact: true });
  await expect(viewer).toBeVisible();
  const { width: W, height: H } = page.viewportSize();
  const face = dlg.locator('[data-card-id]').first();
  const fb = await box(face), vb = await box(viewer);
  expect(fb.x + fb.width, 'card left of the viewer').toBeLessThanOrEqual(vb.x + 2);
  expect(fb.height / H).toBeGreaterThanOrEqual(0.7);
  for (const b of [fb, vb]) expect(b.x >= -1 && b.y >= -1 && b.x + b.width <= W + 1 && b.y + b.height <= H + 1, 'on-screen').toBe(true);
  const vs = () => page.evaluate(async () => await window.oreheart.getViewerState());
  await expect.poll(async () => (await vs()).open).toBe(true);
  expect((await vs()).source).toMatch(/grubnak\.glb$/);
  for (const name of CANON_ANIMS) {
    const label = name[0].toUpperCase() + name.slice(1);
    await viewer.getByRole('button', { name: label, exact: true }).click();
    await expect.poll(async () => (await vs()).animation, { message: label }).toBe(name);
    await expect(dlg).toBeVisible();
  }
  const canvas = viewer.locator('canvas').first();
  const cb = await box(canvas);
  const r0 = (await vs()).rotationY;
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width / 2 + Math.min(150, cb.width / 3), cb.y + cb.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await vs()).rotationY - r0), { message: 'drag spins' }).toBeGreaterThan(0.1);
  await expect(dlg, 'dragging inside the viewer keeps it open').toBeVisible();
  const z0 = (await vs()).zoom;
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await vs()).zoom, { message: 'wheel zooms' }).not.toBe(z0);
  await face.click();
  await expect(dlg).toBeHidden();
  await open();
  await page.mouse.click(3, H - 3);
  await expect(dlg).toBeHidden();
  await open();
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
});

test('AC210: body text uses the brown-gold palette variables, no white body text on menu screens', async ({ page }) => {
  await openMenu(page);
  const vals = await page.evaluate(() => Object.fromEntries(['--text-body', '--text-body-small', '--text-soft', '--text-gold', '--text-white'].map((v) => [v, getComputedStyle(document.documentElement).getPropertyValue(v).trim().toLowerCase()])));
  expect(vals['--text-body']).toBe('#d4a94f');
  expect(vals['--text-body-small']).toBe('#b8862b');
  expect(vals['--text-soft']).toBe('#d4a94f');
  expect(vals['--text-gold']).toBe('#ffd700');
  expect(vals['--text-white']).toBe('#ffffff');
  const whites = () => page.evaluate(() => {
    const bad = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const n = w.currentNode; const el = n.parentElement;
      if (!/\p{L}/u.test(n.textContent)) continue;
      if (!el || el.closest('[aria-hidden="true"], [data-card-id], [data-card-back], canvas, svg, script, style, noscript')) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const c = getComputedStyle(el).color;
      if (c === 'rgb(255, 255, 255)' || c === 'rgb(244, 236, 220)') bad.push(n.textContent.trim().slice(0, 30));
    }
    return bad.slice(0, 10);
  });
  expect(await whites(), 'title').toEqual([]);
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  const pColors = await page.evaluate(() => [...document.querySelectorAll('p')].filter((p) => p.textContent.trim() && p.getBoundingClientRect().height > 0 && !p.closest('[data-card-id]')).map((p) => getComputedStyle(p).color));
  expect(pColors.length).toBeGreaterThan(0);
  for (const c of pColors) expect(c, 'Rules paragraph color').toBe('rgb(212, 169, 79)');
  expect(await whites(), 'rules').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible();
  expect(await whites(), 'settings').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Decks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(await whites(), 'deck builder').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toBeVisible();
  expect(await whites(), 'select').toEqual([]);
});

for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`round 8b screenshots ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });
    test(`AC211: Commander screen, close-up viewer and stat badges render without errors (${W}x${H})`, async ({ page, request }, testInfo) => {
      test.setTimeout(120000);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await toSelect(page);
      await page.waitForTimeout(800);
      await testInfo.attach(`r8b-commander-row-${W}x${H}`, { body: await page.screenshot(), contentType: 'image/png' });
      await page.getByRole('button', { name: COMMANDERS[0], exact: true }).click();
      await expect(page.getByRole('button', { name: 'Change Commander', exact: true })).toBeVisible();
      await page.waitForTimeout(1500);
      await testInfo.attach(`r8b-commander-grubnak-${W}x${H}`, { body: await page.screenshot(), contentType: 'image/png' });
      await openDecks(page);
      await page.getByLabel('Commander card', { exact: true }).getByRole('button', { name: COMMANDERS[0], exact: true }).click();
      await expect(page.getByRole('dialog', { name: COMMANDERS[0], exact: true })).toBeVisible();
      await page.waitForTimeout(1500);
      await testInfo.attach(`r8b-closeup-viewer-${W}x${H}`, { body: await page.screenshot(), contentType: 'image/png' });
      await start(page, quiet({ playerHand: HAND_R7, playerCrystals: 4, board: [...BOARD_5B, { cardId: 'gnome-tinker', owner: 'player', row: 5, col: 6, damage: 1 }] }));
      await page.mouse.move(W / 2, H * 0.3);
      await zoomIn(page, W / 2, H * 0.6, 3);
      await testInfo.attach(`r8b-stat-badges-${W}x${H}`, { body: await page.screenshot(), contentType: 'image/png' });
      expect(errors).toEqual([]);
    });
  });
}
