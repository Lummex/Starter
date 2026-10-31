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
// Owner check change (Ken, Oct 30 playtest): the resting hand tucks down below the home row so it never covers the board,
// and every card keeps at least 30 % showing to grab (it was "fully on screen at rest", Round 17). Hover / touch raises it fully.
async function restTuckedOk(page, b, H) {
  const home = await page.evaluate(async () => { let y = -Infinity; for (let c = 1; c <= 13; c++) for (const p of await window.oreheart.squareQuad(7, c)) y = Math.max(y, p.y); return y; });
  return (H - b.y) / b.height >= 0.3 && b.y >= home - 6 && b.y < H;
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
// Round 12a: owner card paintings (factory-design/goblin-art/), used unchanged
const OWNER_CARD_ART = { 'goblin-scrounger': 'goblin-miner-card-art.png', 'goblin-pebbler': 'boneknocker-card-art.png', 'shiv-rat': 'shiv-rat-card-art.png', 'goblin-smith-miner': 'scrapsmith-miner-card-art.png' };
const sameTarget = (t, row, col) => t && t.row === row && t.col === col;
const SHARDS = Array(12).fill('soul-shard');
// Round 9a: Last turn, Mute, Card pop-ups and Recenter live in Menu -> Settings ("Match settings")
async function openMatchMenu(page) {
  if (await page.getByRole('button', { name: 'Last turn', exact: true }).isVisible()) return;
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  if (!(await page.getByRole('menu', { name: 'Match menu' }).isVisible())) await menu.click();
  await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Match settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Last turn', exact: true })).toBeVisible();
}
// Round 9a: "Give up match!" replaces Surrender
async function giveUp(page) {
  if (!(await page.getByRole('menu', { name: 'Match menu' }).isVisible())) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Give up match!', exact: true }).click();
  await expect(page.getByText('Give up this match?')).toBeVisible();
}
// first visit outside test mode shows the tutorial offer; dismiss it
// Round 9c: outside test mode the owner's Intro screen plays first (once per tab); a click skips it
async function skipIntro(page) {
  const intro = page.getByLabel('Intro', { exact: true });
  await intro.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await intro.isVisible()) await intro.click({ position: { x: 30, y: 30 } });
  await expect(intro).toBeHidden({ timeout: 5000 });
}
async function openMenu(page) {
  await page.goto('/');
  await skipIntro(page);
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
test('AC1: main menu has exactly Play, Deck Builder, How to Play, Settings, Quit and no page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openMenu(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
  const buttons = page.getByRole('button');
  await expect(buttons).toHaveCount(5);
  const names = (await buttons.allInnerTexts()).map((t) => t.trim());
  expect(names).toEqual(['Play', 'Deck Builder', 'How to Play', 'Settings', 'Quit']);
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
  await expect(page.getByRole('button', { name: 'Grubnak Rotgut, Goblin King' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thane Borgo Gravelgrim' })).toBeVisible();
  await page.getByRole('button', { name: 'Knobbin the Gnomeificent' }).click();
  await expect(page.getByRole('button', { name: 'Knobbin the Gnomeificent' })).toHaveAttribute('aria-pressed', 'true');
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
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
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
  await skipIntro(page);
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
  // Owner check change (Ken, Oct 31: four 60-card starter decks per faction): the Warband (default) is 22 Miners + 26 fighters, 8 spells, 4 Crystal cards
  test(`AC6: ${cmd} Warband starter deck is 60 cards: 22 Miners, 48 creatures, 8 spells, 4 Crystal cards`, async ({ page }) => {
    const s = await start(page, { playerCommander: cmd, ai: false, firstPlayer: 'player' });
    expect(s.phase).toBe('mulligan');
    const p = s.players.player;
    expect(p.health).toBe(20);
    expect(s.players.opponent.health).toBe(20);
    expect(p.hand.length).toBe(5);
    const all = [...p.deck, ...p.hand].map((c) => c.cardId);
    expect(all.length).toBe(60);
    expect(all.filter((id) => CRYSTALS.has(id)).length).toBe(4);
    expect(all.filter((id) => SPELLS.has(id)).length).toBe(8);
    expect(all.filter((id) => !SPELLS.has(id) && !CRYSTALS.has(id)).length).toBe(48);
    const counts = {};
    for (const id of all) counts[id] = (counts[id] || 0) + 1;
    for (const [id, n] of Object.entries(counts)) if (LIMITED.has(id)) expect(n, id).toBeLessThanOrEqual(3);
    // Ken, Oct 31: basic + Smith Miners goblins 15 + 7, gnomes 17 + 5, dwarves 14 + 5 (+3 Gemdrunk Deepdelver); 22 Miners in all
    const basic = { grubnak: 'goblin-scrounger', sproingle: 'gnome-prospector', borgo: 'dwarf-miner' }[cmd];
    expect(counts[basic] || 0).toBe({ grubnak: 15, sproingle: 17, borgo: 14 }[cmd]);
    const smith = { grubnak: 'goblin-smith-miner', sproingle: 'gnome-smith-miner', borgo: 'dwarf-smith-miner' }[cmd];
    expect(counts[smith]).toBe(cmd === 'grubnak' ? 7 : 5);
    const extra = { grubnak: null, sproingle: null, borgo: 'crystal-drunk-delver' }[cmd];
    if (extra) expect(counts[extra] || 0, extra).toBe(3);
    // (the old "every new card at least once" rule is gone with the Oct 31 decks; at least two of the faction's new cards still appear)
    expect(NEW_BY_FACTION[cmd].filter((id) => (counts[id] || 0) >= 1).length).toBeGreaterThanOrEqual(2);
    const creatureIds = all.filter((id) => !SPELLS.has(id) && !CRYSTALS.has(id) && id !== basic && id !== smith && id !== extra);
    const costs = await page.evaluate(async (ids) => {
      const out = [];
      for (const id of ids) out.push((await window.oreheart.getCard(id)).cost);
      return out;
    }, creatureIds);
    expect(costs.filter((c) => c <= 4).length).toBeGreaterThanOrEqual(cmd === 'borgo' ? 4 : 16); // Dwarf cards are expensive by design (5 cheap Riot Shield Bearers are the basic Miners)
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
test('AC9: example (a) — 1 Gemsinger Miner vs 2 Goblin Miners: enemy owns the mine, enemy gets 4, you get 1 (+2 underdog)', async ({ page }) => {
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
  expect(s.players.player.crystals).toBe(1); // 6 - 1 - 4 (owner change, Ken, Oct 31 rebalance: Stormcaller Savant costs 4)
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
  // Round 11: non-Miners summon on the back row only.
  // Owner check change (Ken, Oct 31: Tunnel only beside a mine your side owns): on turn 1 no mine is owned, so the basic Miner is back row only too
  expect(summons.filter((a) => a.uid !== scrounger).every((a) => a.row === 7)).toBe(true);
  const nextToMine = (a) => s.sites.some((m) => Math.max(Math.abs(m.row - a.row), Math.abs(m.col - a.col)) === 1);
  expect(summons.filter((a) => a.uid === scrounger).every((a) => a.row === 7)).toBe(true);
  expect(summons.some((a) => a.uid === scrapper && a.row === 7 && a.col === 1)).toBe(true);
  expect(summons.some((a) => a.row === 7 && a.col === 2)).toBe(false); // Round 3a: player Stronghold at (7,2)
  expect(summons.some((a) => a.uid === scrounger && a.row === 3 && !nextToMine(a))).toBe(false);
  expect((await act(page, { type: 'summon', uid: scrapper, row: 6, col: 1 })).ok).toBe(false);
  expect((await act(page, { type: 'summon', uid: scrapper, row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 1).cardId).toBe('goblin-scrapper');
  expect(at(s, 7, 1).summonedThisTurn).toBe(true);
  expect(s.players.player.crystals).toBe(15); // Scrapper 6 - 1 Grubnak
  expect((await act(page, { type: 'summon', uid: wolf, row: 7, col: 3 })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals).toBe(8); // Round 14 data: Mangewolf Rider 8 - 1 Grubnak
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
  expect(at(s, 7, 3).maxHealth).toBe(6); // Round 12c: Riot Shield Bearer 1/5 + Borgo = 1/6
  expect(at(s, 7, 3).health).toBe(6);
});

// ---------- AC11 ----------
// Owner check change (Ken, Oct 31: Tunnel only beside a mine your side owns). Was: Tunnel from turn 1 next to any mine (Round 10).
test('AC11: Tunnel only onto empty spaces next to a mine your side owns; nothing beside a neutral or enemy mine (Ken, Oct 31)', async ({ page }) => {
  const hand = { playerHand: ['goblin-scrounger'], playerCrystals: 5 };
  const near = (m, r, c) => Math.max(Math.abs(m.row - r), Math.abs(m.col - c)) === 1;
  const siteAt = (s, m) => s.sites.find((x) => x.row === m.row && x.col === m.col);
  const tunnelSummons = async (s) => {
    const uid = s.players.player.hand[0].uid;
    const summons = (await legal(page)).filter((a) => a.type === 'summon' && a.uid === uid);
    return { uid, summons, has: (r, c) => summons.some((a) => a.row === r && a.col === c) };
  };
  // turn 1, no mine owned: back row only, no Tunnel squares at all
  let s = await start(page, { ai: false, setup: { ...hand } });
  expect(s.sites.every((x) => x.controller === null)).toBe(true);
  let t = await tunnelSummons(s);
  expect(t.summons.length).toBeGreaterThan(0);
  expect(t.summons.every((a) => a.row === 7), JSON.stringify(t.summons.filter((a) => a.row !== 7))).toBe(true);
  expect((await act(page, { type: 'summon', uid: t.uid, row: 3, col: 3 })).ok).toBe(false);
  // the player owns M3: every empty space around M3 is offered, none that is only beside M1 or M2
  s = await newMatch(page, { ai: false, setup: { ...hand, board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 7, minedMine: M3 }] } });
  expect(siteAt(s, M3).controller).toBe('player');
  expect(siteAt(s, M1).controller).toBe(null);
  expect(siteAt(s, M2).controller).toBe(null);
  t = await tunnelSummons(s);
  const st = [s.strongholds.player, s.strongholds.opponent];
  for (let r = 1; r <= 7; r++) for (let c = 1; c <= 13; c++) {
    if (s.sites.some((x) => x.row === r && x.col === c) || st.some((x) => x.row === r && x.col === c) || at(s, r, c) || r === 7) continue;
    if (near(M3, r, c)) expect(t.has(r, c), `tunnel beside the owned mine ${r},${c}`).toBe(true);
    else expect(t.has(r, c), `no tunnel at ${r},${c} (not beside an owned mine)`).toBe(false);
  }
  expect((await act(page, { type: 'summon', uid: t.uid, row: 5, col: 4 })).ok).toBe(false); // beside M2 only
  expect((await act(page, { type: 'summon', uid: t.uid, row: 5, col: 6 })).ok).toBe(true); // beside M3
  s = await getState(page);
  expect(at(s, 5, 6).cardId).toBe('goblin-scrounger');
  // an enemy-owned mine offers nothing
  s = await newMatch(page, { ai: false, setup: { ...hand, board: [{ cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 1, minedMine: M1 }] } });
  expect(siteAt(s, M1).controller).toBe('opponent');
  t = await tunnelSummons(s);
  expect(t.summons.every((a) => a.row === 7)).toBe(true);
  expect((await act(page, { type: 'summon', uid: t.uid, row: 5, col: 2 })).ok).toBe(false);
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

test('AC13: Ranged shoots up to its card range (Grudge Hurler 5, Skullflinger 6) in 8 straight lines, stops at the first unit, no strike back (Round 22)', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'borgo',
    opponentCommander: 'borgo',
    setup: { board: [
      { cardId: 'axe-thrower', owner: 'player', row: 5, col: 7 },
      { cardId: 'shieldbeard', owner: 'opponent', row: 4, col: 7 }, // first unit straight up
      { cardId: 'dwarf-miner', owner: 'opponent', row: 3, col: 7 }, // behind the Shieldbeard: blocked
      { cardId: 'dwarf-miner', owner: 'opponent', row: 3, col: 6 }, // knight-move: not a straight line
      { cardId: 'dwarf-miner', owner: 'opponent', row: 2, col: 10 }, // diagonal, 3 away, clear
      { cardId: 'dwarf-miner', owner: 'opponent', row: 5, col: 12 }, // same row, 5 away, clear
      { cardId: 'dwarf-miner', owner: 'opponent', row: 5, col: 1 }, // same row, 6 away: out of Grudge Hurler's range 5 (owner cards.json)
      { cardId: 'goblin-slinger', owner: 'player', row: 4, col: 12 }, // 3 straight below the enemy Stronghold (1,12)
      { cardId: 'goblin-slinger', owner: 'player', row: 6, col: 1 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 6, col: 7 }, // same row, exactly 6 away, clear: in Skullflinger's range 6
      { cardId: 'goblin-slinger', owner: 'player', row: 7, col: 4 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 7, col: 12 }, // same row, 8 away, clear: out of range
    ] },
  });
  await done(page);
  const axe = at(s, 5, 7).uid;
  const acts = (await legal(page)).filter((a) => a.type === 'attack');
  const can = (u, r, c) => acts.some((a) => a.creatureUid === u && sameTarget(a.target, r, c));
  expect(can(axe, 4, 7)).toBe(true);
  expect(can(axe, 3, 7)).toBe(false);
  expect(can(axe, 3, 6)).toBe(false);
  expect(can(axe, 2, 10)).toBe(true);
  expect(can(axe, 5, 12)).toBe(true);
  expect(can(axe, 5, 1)).toBe(false);
  expect(can(at(s, 6, 1).uid, 6, 7)).toBe(true);
  expect(can(at(s, 7, 4).uid, 7, 12)).toBe(false);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 7, 4).uid, target: { row: 7, col: 12 } })).ok).toBe(false);
  expect((await act(page, { type: 'attack', creatureUid: axe, target: { row: 3, col: 7 } })).ok).toBe(false);
  const sling = at(s, 4, 12).uid;
  expect(acts.some((a) => a.creatureUid === sling && a.target && a.target.commander === 'opponent')).toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: axe, target: { row: 4, col: 7 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 7).health).toBe(3); // Shieldbeard 4 + 1 Borgo - 2
  expect(at(s, 5, 7).health).toBe(4); // Axe Thrower 3 + 1 Borgo, no strike back
  expect((await act(page, { type: 'attack', creatureUid: sling, target: { commander: 'opponent' } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(19); // exactly 1
  expect(at(s, 4, 12).health).toBe(3); // Slinger 2 + 1 Borgo, untouched
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
      { cardId: 'dwarf-pickman', owner: 'opponent', row: 5, col: 3 }, // Ironjaw Big Back, 1 Attack
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
        { cardId: 'dwarf-smith-miner', owner: 'player', row: 3, col: 7, minedMine: M3 },
        { cardId: 'dwarf-smith-miner', owner: 'player', row: 5, col: 7, minedMine: M3 },
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
  expect(s.players.player.crystals).toEqual(4); // 2 Smith Miners mined 2 each on turn 1: pays Thunderhorn Blast (3)
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

test('AC17: Crystal cards have no once-per-round limit; each goes to the Bank (Round 10)', async ({ page }) => {
  let s = await start(page, { ai: false, setup: { playerHand: ['soul-shard', 'soul-shard', 'soul-shard'], playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 5 }] } }); // a creature keeps the Action phase open
  const [a, b, c] = s.players.player.hand.map((x) => x.uid);
  expect((await act(page, { type: 'playCrystal', uid: a })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.bank).toBe(1);
  expect(s.players.player.crystals).toEqual(ZERO);
  expect((await legal(page)).some((x) => x.type === 'playCrystal' && x.uid === b)).toBe(true);
  expect((await act(page, { type: 'playCrystal', uid: b })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.bank).toBe(2);
  expect(s.phase).toBe('deploy');
  await done(page); // Action phase
  s = await getState(page);
  expect(s.phase).toBe('action');
  expect((await act(page, { type: 'playCrystal', uid: c })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.bank).toBe(3);
  expect(s.phase).toBe('action');
  expect(s.activePlayer).toBe('player');
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
    setup: { playerHand: ['second-wind'], playerCrystals: 5, opponentHand: ['fizzle'], opponentCrystals: 3 },
  });
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'second-wind') })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse).toBe(null); // Emergency Rations costs 5: no usable Instant, so no Respond window
  expect(s.players.opponent.hand.some((c) => c.cardId === 'fizzle')).toBe(true);
});

test('AC18: Pickpocket! returns a summoned creature to hand', async ({ page }) => {
  let s = await start(page, {
    ai: false,
    playerCommander: 'grubnak',
    opponentCommander: 'borgo',
    setup: {
      playerHand: ['goblin-scrapper'],
      playerCrystals: 6, // Round 12c: Bowler Brawler costs 6
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
  expect(s.players.player.crystals).toBe(1); // Bowler Brawler 6 - 1 Grubnak = 5 spent, still spent
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

test('AC20: giving up from the match menu shows Defeat', async ({ page }) => {
  await start(page, { ai: false, skipMulligan: true, firstPlayer: 'player' });
  await giveUp(page);
  await page.getByRole('button', { name: 'Yes, give up' }).click();
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
  await expect(page.getByRole('button', { name: 'Bowler Brawler', exact: true })).toBeVisible();
  await card.click();
  const view = page.getByRole('dialog', { name: 'Searing Arcane Orb' });
  await expect(view).toBeVisible();
  await expect(view).toContainText('3 damage');
  await expect(view.getByRole('button', { name: 'Close' })).toHaveCount(1); // owner check change (Ken, Oct 30: ✕ Close on the card view)
  await page.keyboard.press('Escape');
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
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('AC24: upright phone shows the rotate message', async ({ page }) => {
    await page.goto('/?test=1');
    await expect(page.getByText('Please rotate your phone')).toBeVisible();
    await page.waitForFunction(() => !!window.oreheart);
    await newMatch(page, { ai: false, skipMulligan: true, firstPlayer: 'player' });
    await expect(page.getByText('Please rotate your phone')).toBeVisible();
  });
});

// owner (Oct 25): on a computer the game letterboxes to 16:9 and never asks to rotate
test.describe('computer browser window, tall and narrow', () => {
  test.use({ viewport: { width: 700, height: 900 } });
  test('AC24b: a computer window never shows the rotate message and keeps the 16:9 shape', async ({ page }) => {
    await page.goto('/?test=1');
    await page.waitForFunction(() => !!window.oreheart);
    await expect(page.getByText('Please rotate your phone')).toBeHidden();
    const r = await page.evaluate(() => { const b = document.getElementById('app').getBoundingClientRect(); return b.width / b.height; });
    expect(Math.abs(r - 16 / 9)).toBeLessThan(0.02);
  });
});

// ---------- AC25 ----------
test('AC25: first visit offers the tutorial; Skip is remembered', async ({ page }) => {
  await page.goto('/');
  await skipIntro(page);
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
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
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
  // Round 11: back row, or (basic Miners) Tunnel onto a space next to a mine.
  // Owner check change (Ken, Oct 31: Tunnel only beside a mine your side owns): only beside a mine the player owns
  const nextToMine = (a) => s.sites.some((m) => m.controller === 'player' && Math.max(Math.abs(m.row - a.row), Math.abs(m.col - a.col)) === 1);
  expect(summons.every((a) => a.row === 7 || nextToMine(a))).toBe(true);
  const backRow = summons.find((a) => a.row === 7);
  expect(backRow).toBeTruthy();
  expect((await act(page, backRow)).ok).toBe(true);
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
  'goblin-scrounger': 1, 'goblin-scrapper': 6, 'goblin-slinger': 4, 'goblin-bomber': 3, 'goblin-sneak': 3, 'wolf-rider': 8,
  'grubnaks-big-boss-troll': 7, 'gnome-prospector': 1, 'gnome-tinker': 4, 'spark-gnome': 4, 'clockwork-beetle': 6,
  'gnome-illusionist': 6, 'gyrocopter-ace': 8, 'the-great-steam-golem': 10, 'dwarf-miner': 2, 'shieldbeard': 6,
  'axe-thrower': 6, 'ironhammer-berserker': 7, 'brewmaster': 6, 'ram-rider': 10, 'queen-brunhilda-stonebeard': 10,
  'shard-guzzler': 6, 'overclocked-conduit': 5, 'crystal-drunk-delver': 7,
};
test('AC27: creature costs match the revision 3 table; basic Gatherers are 1/1 for 1', async ({ page }) => {
  await openTest(page);
  const cards = await page.evaluate(async (ids) => {
    const out = {};
    for (const id of ids) out[id] = await window.oreheart.getCard(id);
    return out;
  }, Object.keys(COSTS));
  for (const [id, cost] of Object.entries(COSTS)) expect(cards[id].cost, id).toBe(cost);
  for (const id of ['goblin-scrounger', 'gnome-prospector']) { // Round 12c: Dwarves have no basic Miner
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
  const steps = [['dwarf-miner', 1, 28], ['shieldbeard', 3, 22], ['axe-thrower', 4, 16], ['ram-rider', 5, 6]]; // Round 12c owner costs 2/6/6/10; // Round 3b: (7,2) is the Stronghold
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
  await expect(wolf).toHaveText(/3\D+4\D+3/);
  await expect(wolf).toHaveAttribute('data-acted', 'false');
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrapper'), row: 7, col: 1 })).ok).toBe(true);
  const scrap = page.getByLabel('Bowler Brawler, row 7, column 1', { exact: true });
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
  const dlg = page.getByRole('dialog', { name: /Moves still available/ });
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
  await expect(page.getByLabel('Goblin Miner, row 7, column 1', { exact: true })).toHaveAttribute('data-acted', 'false'); // stays bright
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
  const dlg = page.getByRole('dialog', { name: /Moves still available/ });
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
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(cheb(m[i], m[j]), `distinct squares (mines may touch, Round 10), seed ${seed}`).toBeGreaterThanOrEqual(1);
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
test('AC41: the moves drop-up says miners have not mined; after any move Done asks nothing (Round 26)', async ({ page }) => {
  let s = await start(page, { ai: false, setup: { board: [
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1 },
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 2 },
  ] } });
  await done(page); // -> action
  expect(await movesLeft(page)).toBe(true);
  const doneBtn = page.getByRole('button', { name: 'Done' });
  const dlg = page.getByRole('dialog', { name: /Moves still available/ });
  await doneBtn.click();
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText("miners haven't mined");
  await dlg.getByRole('button', { name: 'Go back' }).click();
  await expect(dlg).toBeHidden();
  expect((await act(page, { type: 'mine', creatureUid: at(s, 5, 1).uid, row: 4, col: 2 })).ok).toBe(true);
  await doneBtn.click(); // a move was made this phase: no question
  await expect.poll(async () => (await getState(page)).activePlayer).toBe('opponent');
  await expect(dlg).toBeHidden();
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
  await expect(page.getByLabel('Bowler Brawler, row 6, column 3', { exact: true })).not.toContainText('🏹');
  const hand = page.getByLabel('Your hand', { exact: true });
  await expect(hand.getByRole('button', { name: 'Skullflinger' })).toContainText('🏹');
  await expect(hand.getByRole('button', { name: 'Bowler Brawler' })).not.toContainText('🏹');
});

test.describe('landscape layout details', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  // ---------- AC43 ----------
  test('AC43: the hand rests fully on screen at the bottom and rises on hover (Round 17)', async ({ page }) => {
    await start(page, { ai: false, setup: { playerHand: ['fireball', 'goblin-scrapper', 'goblin-slinger'] } });
    const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Bowler Brawler' });
    await expect(card).toBeAttached();
    await page.mouse.move(422, 120);
    await page.waitForTimeout(800);
    const rest = await card.boundingBox();
    expect(rest.y).toBeLessThan(390);
    expect(await restTuckedOk(page, rest, 390), 'Ken, Oct 30: rests tucked below the home row, top showing').toBe(true);
    expect(rest.height).toBeGreaterThanOrEqual(390 * 0.31);
    expect(rest.height).toBeLessThanOrEqual(390 * 0.37);
    await page.mouse.move(rest.x + rest.width / 2, rest.y + rest.height * 0.2);
    await expect.poll(async () => { const b = await card.boundingBox(); return b.y + b.height; }).toBeLessThanOrEqual(391);
    await expect.poll(async () => (await card.boundingBox()).y).toBeGreaterThanOrEqual(-1);
    await page.mouse.move(422, 120);
    await expect.poll(async () => restTuckedOk(page, await card.boundingBox(), 390)).toBe(true); // Ken, Oct 30: back to the tucked rest
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
  expect(cards['goblin-scrounger'].name).toBe('Goblin Miner');
  expect(cards['gnome-prospector'].name).toBe('Gemsinger Miner');
  expect(cards['dwarf-miner'].name).toBe('Riot Shield Bearer');
  // Owner check change (Ken, Oct 31 dwarf rebalance): the Riot Shield Bearer is the dwarves' real basic Miner again (was a Fighter since Round 12c)
  expect(cards['dwarf-miner'].role).toBe('gatherer');
  for (const [id, name, faction] of [['goblin-smith-miner', 'Scrapsmith Miner', 'goblins'], ['gnome-smith-miner', 'Arcsmith Miner', 'gnomes'], ['dwarf-smith-miner', 'Anvilsworn Miner', 'dwarves']]) {
    expect(cards[id].name).toBe(name);
    expect(cards[id].faction).toBe(faction);
    expect(cards[id].role).toBe('smith');
    expect(cards[id].type).toBe('creature');
    expect([cards[id].cost, cards[id].attack, cards[id].health, cards[id].move]).toEqual([2, 1, 1, 1]);
  }
  const hand = page.getByLabel('Your hand', { exact: true });
  await expect(hand.getByRole('button', { name: 'Goblin Miner', exact: true })).toContainText('⛏');
  await expect(hand.getByRole('button', { name: 'Bowler Brawler', exact: true })).toContainText('⚔');
  await expect(hand.getByRole('button', { name: 'Bowler Brawler', exact: true })).not.toContainText('⛏');
  const smith = hand.getByRole('button', { name: 'Scrapsmith Miner', exact: true });
  await expect(smith).toContainText('⚒');
  await expect(smith).toContainText('SMITH');
  await expect(page.getByLabel('Goblin Miner, row 6, column 1', { exact: true })).toContainText('⛏');
  await expect(page.getByLabel('Bowler Brawler, row 6, column 2', { exact: true })).not.toContainText('⛏');
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
  // Round 10/11: the hand rests tucked to a quarter; hover its visible top edge to raise it, then grab the card
  let a = await card.boundingBox();
  await page.mouse.move(a.x + a.width / 2, Math.min(a.y + a.height * 0.08, page.viewportSize().height - 3), { steps: 3 });
  await page.waitForTimeout(600);
  a = await card.boundingBox();
  const b = await label.boundingBox();
  await page.mouse.move(a.x + a.width / 2, Math.min(a.y + a.height * 0.15, page.viewportSize().height - 3));
  await page.mouse.down();
  // owner check change (Ken, Oct 30 hand spec): the drop lands on the unit itself; a drop 12 px below it (the square underneath) now deploys there
  // instead (Ken: "I just put a tunneling goblin out right underneath my cook goblin, and it upgraded my cook goblin")
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
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
  // Round 10 (R10.12): also legal in your own Action phase, and the phase stays
  s = await newMatch(page, { ai: false, setup: { playerHand: ['soul-shard'], board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 }] } });
  await done(page);
  expect((await getState(page)).phase).toBe('action');
  expect((await legal(page)).some((a) => a.type === 'playCrystal')).toBe(true);
  expect((await act(page, { type: 'playCrystal', uid: s.players.player.hand[0].uid })).ok).toBe(true);
  s = await getState(page);
  expect({ phase: s.phase, activePlayer: s.activePlayer }).toEqual({ phase: 'action', activePlayer: 'player' });
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

// Owner check changes (Ken, Oct 31): Tunnel only beside a mine your side owns (AI desk), and "On the cards with special abilities,
// like tunnel, you have it over the card, just remove that." -- so no Tunnel! tag is drawn on any card, owned mine or not.
test('AC50: Smith Miners never Tunnel; a basic Miner Tunnels only beside a mine the player owns; no Tunnel! tag on any card (Ken, Oct 31)', async ({ page }) => {
  const hand = { playerHand: ['goblin-smith-miner', 'goblin-scrounger'], playerCrystals: 5 };
  let s = await start(page, { ai: false, setup: { ...hand } });
  const hb = page.getByLabel('Your hand', { exact: true });
  await expect(hb.getByRole('button', { name: 'Goblin Miner', exact: true })).toBeVisible();
  await expect(hb.getByRole('button', { name: 'Goblin Miner', exact: true })).not.toContainText('Tunnel!');
  await expect(hb.getByRole('button', { name: 'Scrapsmith Miner', exact: true })).not.toContainText('Tunnel!');
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrounger'), row: 3, col: 3 })).ok).toBe(false);
  // the player owns M2 (4,4): (3,3) is beside it
  s = await newMatch(page, { ai: false, setup: { ...hand, board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 3, col: 4, minedMine: M2 }] } });
  expect(s.sites.find((x) => x.row === M2.row && x.col === M2.col).controller).toBe('player');
  const smith = handUid(s, 'player', 'goblin-smith-miner');
  const summons = (await legal(page)).filter((a) => a.type === 'summon');
  expect(summons.some((a) => a.uid === smith && a.row === 3 && a.col === 3)).toBe(false);
  expect(summons.some((a) => a.uid === smith && a.row === 7)).toBe(true);
  expect((await act(page, { type: 'summon', uid: smith, row: 3, col: 3 })).ok).toBe(false);
  await expect(hb.getByRole('button', { name: 'Goblin Miner', exact: true })).not.toContainText('Tunnel!');
  await expect(hb.getByRole('button', { name: 'Scrapsmith Miner', exact: true })).not.toContainText('Tunnel!');
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrounger'), row: 3, col: 3 })).ok).toBe(true);
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
      await expect(page.getByLabel('Bowler Brawler, row 6, column 2', { exact: true })).toBeVisible();
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
        // Round 9c: its position follows the owner layout (checked by AC212)
      }
    });
  });
}

// ---------- Revision 7 ----------
const RENAMES = {
  'goblin-scrounger': 'Goblin Miner', 'goblin-scrapper': 'Bowler Brawler', 'goblin-slinger': 'Skullflinger',
  'goblin-bomber': 'Bare Knuckle Lunatic', 'goblin-sneak': 'Backstabbing Thief', 'wolf-rider': 'Mangewolf Rider',
  'grubnaks-big-boss-troll': 'Gronkowski Troll Tyrant', 'gnome-prospector': 'Gemsinger Miner', 'gnome-tinker': 'Aegis Tinkerer',
  'spark-gnome': 'Stormcaller Savant', 'clockwork-beetle': 'Iron Scarab Automaton', 'gnome-illusionist': 'Mirrorveil Illusionist',
  'gyrocopter-ace': 'Thunderwing Gyronaut', 'the-great-steam-golem': 'The Arcane Colossus', 'dwarf-miner': 'Riot Shield Bearer',
  'shieldbeard': 'Ironwall Shieldbeard', 'axe-thrower': 'Grudge Hurler', 'ironhammer-berserker': 'Bloodbeard Berserker',
  'brewmaster': 'Corpsman Brewlord', 'ram-rider': 'Thunderhorn Ram Rider', 'queen-brunhilda-stonebeard': 'Queen Brunhilda',
  'shard-guzzler': 'Goblin Rocket Rider', 'overclocked-conduit': 'Overclocked Aethervein', 'crystal-drunk-delver': 'Gemdrunk Deepdelver',
  'goblin-smith-miner': 'Scrapsmith Miner', 'gnome-smith-miner': 'Arcsmith Miner', 'dwarf-smith-miner': 'Anvilsworn Miner',
  'prospectors-prayer': 'Desperate Plunder', 'tunnel-rush': 'Rat-Tunnel Ambush', 'fireball': 'Searing Arcane Orb', 'battle-cry': 'Thunderhorn Blast',
  'meteor-strike': 'Starfall Cataclysm', 'healing-light': 'Field Bandage', 'shield-bubble': 'Ironclad Bulwark', 'second-wind': 'Emergency Rations',
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


test('AC57: the Commander picker uses the new Commander names', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  for (const n of ['Grubnak Rotgut, Goblin King', 'Knobbin the Gnomeificent', 'Thane Borgo Gravelgrim']) {
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
      { cardId: 'shard-guzzler', owner: 'player', row: 5, col: 7 }, // F: next to M3; Owner change (Oct 22, 43286e36): Shard Guzzler became Goblin Rocket Rider, a Fighter, so it never mines
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
  await expect(siteBtn(page, M3)).toHaveAttribute('data-ready-miners', '1'); // C only; Owner change (Oct 22, 43286e36): F (Rocket Rider) is a Fighter
  expect((await act(page, { type: 'mineAll' })).ok).toBe(false);
  const mineAts = (await legal(page)).filter((a) => a.type === 'mineAt');
  expect(mineAts.length).toBe(3);
  expect((await act(page, { type: 'move', creatureUid: at(s, 3, 6).uid, row: 2, col: 6 })).ok).toBe(true);
  await expect(siteBtn(page, M3)).toHaveAttribute('data-ready-miners', '0'); // Owner change (Oct 22, 43286e36): C moved away and F is a Fighter, so nobody is ready at M3
  await siteBtn(page, M1).click();
  await expect.poll(async () => at(await getState(page), 3, 1).hasMined).toBe(true);
  s = await getState(page);
  expect(at(s, 3, 1).minedMine).toMatchObject(M1);
  expect(at(s, 5, 3).minedMine).toMatchObject(M1); // the tapped mine
  expect(at(s, 5, 7).hasMined).toBe(false);
  await expect(siteBtn(page, M2)).toHaveAttribute('data-ready-miners', '0');
  // Owner change (Oct 22, 43286e36): F is a Fighter, so a tap on M3 (nobody ready) opens the mine info instead of mining
  await siteBtn(page, M3).click();
  await expect(page.getByRole('dialog', { name: 'Crystal site' })).toBeVisible();
  await page.keyboard.press('Escape');
  s = await getState(page);
  expect(at(s, 5, 7).hasMined).toBe(false); // Fighter (Rocket Rider)
  expect(at(s, 3, 5).hasMined).toBe(false); // Fighter
  expect(at(s, 7, 9).hasMined).toBe(false); // not next to a mine
  expect(at(s, 2, 6).hasMined).toBe(false); // already moved
  expect(s.players.player.flow).toBe(4); // M1 now 2 vs 2 = neutral: 2 + 2; Owner change (Oct 22, 43286e36): F is a Fighter and adds nothing
  expect((await legal(page)).some((a) => a.type === 'mineAt')).toBe(false);
});

test('AC58: mineAt action matches the tap; hovering a mine only shows its info', async ({ page }) => {
  let s = await mineAllSetup(page);
  await done(page);
  await siteBtn(page, M1).hover();
  const info = page.getByRole('dialog', { name: 'Crystal site' });
  // Owner change (Oct 28, 2f49dd3): hovering a mine shows NO info pop-up any more (tap / hold still opens it, checked below)
  await page.waitForTimeout(700);
  await expect(info).toHaveCount(0);
  await page.mouse.move(5, 200);
  s = await getState(page);
  expect(s.board.creatures.some((c) => c.hasMined)).toBe(false);
  await page.keyboard.press('m'); // the M shortcut is gone
  await page.waitForTimeout(500);
  expect((await getState(page)).board.creatures.some((c) => c.hasMined)).toBe(false);
  expect((await act(page, { type: 'mineAt', row: M3.row, col: M3.col })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 3, 6).hasMined).toBe(true);
  expect(at(s, 5, 7).hasMined).toBe(false); // Owner change (Oct 22, 43286e36): Rocket Rider is a Fighter
  expect(at(s, 3, 5).hasMined).toBe(false);
  expect((await act(page, { type: 'mineAt', row: M3.row, col: M3.col })).ok).toBe(false); // nobody left there
  // Owner change (Oct 28, 2f49dd3): a tap on a mine with nobody ready still opens its info
  await siteBtn(page, M3).click();
  await expect(info).toBeVisible();
  await expect(info).toContainText('Controlled by:');
});

test.describe('hand pop-out at 2x', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
  test('AC59: a hovered hand card rises to about 1.6x and stays fully on-screen', async ({ page }) => {
    await start(page, { ai: false, setup: { playerHand: ['goblin-scrapper', 'fireball', 'soul-shard', 'goblin-slinger', 'goblin-scrounger'] } });
    await page.waitForTimeout(2000);
    for (const name of ['Bowler Brawler', 'Goblin Miner']) {
      const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name, exact: true });
      const before = await card.boundingBox();
      await page.mouse.move(before.x + before.width / 2, before.y + 8); // the visible top of the tucked card
      await expect.poll(async () => (await card.boundingBox()).height).toBeGreaterThan(before.height * 1.4); // Round 9a: ~1.6x
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
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
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
  // Round 13/14: only the chosen Commander's faction plus neutral cards are listed (Grubnak by default)
  for (const n of ['Goblin Chef', 'Shiv Rat', 'Snotskull Grunt', 'Venom Shiv', 'Soul Cluster', 'Gronkowski Troll Tyrant']) {
    await expect(all.getByRole('button', { name: n, exact: true })).toHaveCount(1);
  }
  for (const n of ['Gnome Plow', 'Grimhold Ravager', 'Searing Arcane Orb']) await expect(all.getByRole('button', { name: n, exact: true })).toHaveCount(0);
  await chooseFilter(page, 'Type', 'Spells');
  await expect(all.getByRole('button', { name: 'Venom Shiv', exact: true })).toBeVisible();
  await expect(all.getByRole('button', { name: 'Shiv Rat', exact: true })).toHaveCount(0);
  await chooseFilter(page, 'Type', 'All');
  await chooseFilter(page, 'Rarity', 'Collector');
  await expect(all.getByRole('button', { name: 'Gronkowski Troll Tyrant', exact: true })).toBeVisible();
  await expect(all.getByRole('button', { name: 'Snotskull Grunt', exact: true })).toHaveCount(0);
  await chooseFilter(page, 'Rarity', 'All');
  await page.getByRole('group', { name: 'Deck Commander' }).getByRole('button', { name: /^Knobbin/ }).click();
  await expect(all.getByRole('button', { name: 'Gnome Plow', exact: true })).toHaveCount(1);
  await expect(all.getByRole('button', { name: 'Searing Arcane Orb', exact: true })).toHaveCount(1);
  await expect(all.getByRole('button', { name: 'Shiv Rat', exact: true })).toHaveCount(0);
  await expect(all).toContainText(/Guard\. Adjacent enemies must attack it first/);
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
  await addCard(page, 'Goblin Miner', 50);
  await expect(page.getByLabel('Deck problems', { exact: true })).toContainText('Deck is legal');
  await saveDeck(page);
  for (const name of ['Too Small', 'Deck C', 'Deck D', 'Deck E']) {
    await page.getByRole('button', { name: 'New Deck', exact: true }).click();
    await renameDeck(page, name);
    await addCard(page, 'Shiv Rat');
    await saveDeck(page);
  }
  await page.reload();
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  const mine = page.getByLabel('My decks', { exact: true });
  for (const name of ['Miner Rush', 'Too Small', 'Deck C', 'Deck D', 'Deck E']) {
    await expect(mine.getByRole('button', { name: new RegExp(`^${name}`) })).toHaveCount(1);
  }
  await expect(page.getByRole('button', { name: 'New Deck', exact: true })).toBeDisabled();
  await expect(page.getByText('You can save up to 5 decks.')).toBeVisible();
});

const NEW_CARDS = {
  'rotgut-grenadier': ['Goblin Chef', 'goblins', 'Common', 5, 2, 2, /Ranged/],
  'shiv-rat': ['Shiv Rat', 'goblins', 'Common', 4, 2, 1, /Sneaky/],
  'skullbasher-rusher': ['Skullbasher Rusher', 'goblins', 'Uncommon', 6, 2, 2, /Charge/],
  'junk-shaman': ['Junk Shaman', 'goblins', 'Uncommon', 5, 1, 3, /\+1 Attack/],
  'blastrat-sapper': ['SewerSlide Bomber', 'goblins', 'Uncommon', 4, 2, 1, /Ka-boom/i],
  'hexwright-apprentice': ['Hexslinger Apprentice', 'gnomes', 'Common', 3, 1, 2, /Ranged/], // owner change (Ken, Oct 31 rebalance): cost 4 -> 3
  'gearward-sentinel': ['Gearward Sentinel', 'gnomes', 'Common', 6, 1, 4, /Guard/],
  'runic-siphoner': ['Soul Stone Siphoner', 'gnomes', 'Uncommon', 5, 2, 2, /Bank/],
  'phase-stalker': ['Gnome Plow', 'gnomes', 'Uncommon', 6, 2, 3, /Blink/],
  'glyphshield-warden': ['Glyphshield Warden', 'gnomes', 'Uncommon', 6, 2, 3, /Shield/],
  'oathbound-pikeman': ['Oathbound Overwatch', 'dwarves', 'Common', 6, 2, 3, /Guard/],
  'deepforge-crossbowman': ['Marksmen Gunner', 'dwarves', 'Common', 5, 2, 2, /Ranged/],
  'barrelback-courier': ['Barrelback Courier', 'dwarves', 'Common', 6, 1, 3, /turn it.s played/],
  'rune-splitter': ['Door Splitter', 'dwarves', 'Uncommon', 7, 3, 3, /Armored/],
  'grimhold-ravager': ['Grimhold Ravager', 'dwarves', 'Uncommon', 8, 3, 4, /Rage/],
};



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
  const to = await page.getByLabel('Bowler Brawler, row 4, column 3', { exact: true }).boundingBox();
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
  await all.getByRole('button', { name: 'Goblin Miner', exact: true }).dblclick();
  await expect(deckList(page)).toContainText('1 × Goblin Miner');
  await deckList(page).getByRole('button', { name: 'Add Goblin Miner', exact: true }).click();
  await expect(deckList(page)).toContainText('2 × Goblin Miner');
  await expect(page.getByLabel('Cost chart', { exact: true }).getByLabel('Cost 1: 2 cards', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Deck pile', { exact: true })).toContainText(/2 cards \(50[–-]100\)/);
  await addCard(page, 'Mangewolf Rider', 3);
  await expect(deckList(page)).toContainText('3 × Mangewolf Rider');
  await expect(deckList(page).getByRole('button', { name: 'Add Mangewolf Rider', exact: true })).toBeDisabled();
  await all.getByRole('button', { name: 'Mangewolf Rider', exact: true }).dblclick();
  await expect(deckList(page)).toContainText('3 × Mangewolf Rider');
  await deckList(page).getByRole('button', { name: 'Remove Goblin Miner', exact: true }).click();
  await deckList(page).getByRole('button', { name: 'Remove Goblin Miner', exact: true }).click();
  await expect(deckList(page)).not.toContainText('Goblin Miner');
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
  await addCard(page, 'Goblin Miner', 50);
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
  for (const n of ['Grubnak Rotgut, Goblin King', 'Knobbin the Gnomeificent', 'Thane Borgo Gravelgrim']) {
    await expect(page.getByRole('button', { name: n, exact: true })).toBeVisible();
  }
  const stacks = deckRow(page).getByRole('button', { name: /cards, (ready|not ready)$/ });
  await expect(stacks.first()).toHaveAccessibleName('Goblin Warband, 60 cards, ready');
  // Round 8b: only the selected Commander's decks (Grubnak by default)
  // Owner check change (Ken, Oct 31): four starter styles per faction
  for (const f of ['Goblin', 'Gnome', 'Dwarf']) for (const st of ['Warband', 'Mine Rush', 'Arcane Hoard', 'Expedition']) {
    await expect(deckRow(page).getByRole('button', { name: `${f} ${st}, 60 cards, ready`, exact: true })).toHaveCount(f === 'Goblin' ? 1 : 0);
  }
  await expect(deckRow(page).getByRole('button', { name: 'Miner Rush, 50 cards, ready', exact: true })).toHaveCount(1);
  const small = deckRow(page).getByRole('button', { name: /^Too Small, 1 cards?, not ready$/ });
  await expect(small).toHaveAttribute('aria-disabled', 'true');
  await small.click({ force: true });
  await expect(page.getByLabel('Deck message', { exact: true })).toContainText('Needs 50 to 100 cards (now 1).');
  await expect(small).not.toHaveAttribute('aria-pressed', 'true');
  for (const d of ['Easy', 'Normal', 'Hard']) await expect(page.getByRole('button', { name: d, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Grubnak Rotgut, Goblin King', exact: true }).click();
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
  // Round 9a: use a deck that belongs to Sproingle (only his decks show under him)
  await openDecks(page);
  await pickDeckCommander(page, 'Knobbin the Gnomeificent');
  await renameDeck(page, 'Gnome Rush');
  await addCard(page, 'Gemsinger Miner', 50);
  await saveDeck(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Knobbin the Gnomeificent', exact: true }).click();
  await deckRow(page).getByRole('button', { name: 'Gnome Rush, 50 cards, ready', exact: true }).click();
  await page.getByRole('button', { name: 'Hard', exact: true }).click();
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  await keepAndGetState(page);
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Knobbin the Gnomeificent', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(deckRow(page).getByRole('button', { name: 'Gnome Rush, 50 cards, ready', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Hard', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

async function surrenderViaMenu(page) {
  await giveUp(page);
  await page.getByRole('button', { name: 'Yes, give up' }).click();
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible({ timeout: 15000 });
}
test('AC74: match-end summary, Play again with the same choices, and Menu', async ({ page }) => {
  await page.goto('/?test=1&seed=5');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Thane Borgo Gravelgrim', exact: true }).click();
  await deckRow(page).getByRole('button', { name: 'Dwarf Warband, 60 cards, ready', exact: true }).click();
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
  expect(allIds(s, 'player').length).toBe(60); // Ken, Oct 30: 60-card starter decks
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
  await expect(dlg).toContainText('Summoned Bowler Brawler');
  await expect(dlg).toContainText('Moved Goblin Miner');
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
  expect(await page.locator('link[rel~="icon"]').count()).toBeGreaterThan(0);
  const names = (await page.getByRole('button').allInnerTexts()).map((t) => t.trim());
  expect(names).toEqual(['Play', 'Deck Builder', 'How to Play', 'Settings', 'Quit']);
  expect(errors).toEqual([]);
});

// owner (Oct 25): Gnomes and Dwarves with an approved Model Editor sheet now have finished 3D models
const GD_MODELS = ["axe-thrower", "barrelback-courier", "brewmaster", "clockwork-beetle", "crystal-drunk-delver", "deepforge-crossbowman", "dwarf-miner", "dwarf-smith-miner", "dwarf-pickman", "dwarf-stoneback", "gearward-sentinel", "glyphshield-warden", "gnome-cogger", "gnome-illusionist", "gnome-prospector", "gnome-smith-miner", "gnome-tinker", "gnome-widget", "grimhold-ravager", "gyrocopter-ace", "hexwright-apprentice", "ironhammer-berserker", "oathbound-pikeman", "overclocked-conduit", "phase-stalker", "queen-brunhilda-stonebeard", "ram-rider", "rune-splitter", "runic-siphoner", "shieldbeard", "spark-gnome", "the-great-steam-golem"];
test('AC80: every Goblin creature has a finished figure; Gnomes and Dwarves are finished when they have a model, else placeholders', async ({ page }) => {
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
    else if (c.faction === 'gnomes' || c.faction === 'dwarves') expect(info.figure, c.id).toBe(GD_MODELS.includes(c.id) ? 'finished' : 'placeholder');
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


test('AC84: finished Goblin figures, Grubnak, Strongholds and mines on the battlefield', async ({ page }) => {
  await start(page, {
    ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle',
    setup: { board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 },
      { cardId: 'goblin-scrounger', owner: 'player', row: 6, col: 5 },
      { cardId: 'gnome-prospector', owner: 'opponent', row: 0, col: 4 },
    ] },
  });
  const r = await page.evaluate(async () => await window.oreheart.getRenderStats());
  const s = await getState(page);
  expect(r.figures.length).toBe(3);
  for (const f of r.figures) {
    const c = s.board.creatures.find((x) => x.uid === f.uid);
    expect(c, f.uid).toBeTruthy();
    expect(f.model, f.cardId).toBe(c.cardId.startsWith('gnome') && !GD_MODELS.includes(c.cardId) ? 'placeholder' : 'finished'); // owner change (Ken, Oct 30): the Gemsinger Miner has its 3D model
  }
  expect(r.commanders.player).toMatchObject({ commanderId: 'grubnak', model: 'finished' });
  // owner change (Ken, Oct 30): Archmagister Sproingle is a 3D Commander now (Clay's rigged model, moves from the shared pack)
  expect(r.commanders.opponent.commanderId).toBe('sproingle');
  await expect.poll(async () => (await page.evaluate(async () => await window.oreheart.getRenderStats())).commanders.opponent.model, { timeout: 20000 }).toBe('finished');
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
    { cardId: 'gnome-tinker', owner: 'opponent', row: 2, col: 4 }, // Round 22: was row 0 (not a board row)
  ] } };
  await start(page, setup);
  // owner change (Ken, Oct 30): both Commanders are 3D models now, so compare only once they have loaded in both matches
  const loaded = async () => expect.poll(async () => { const r = await page.evaluate(async () => await window.oreheart.getRenderStats()); return r.commanders.player.model === 'finished' && r.commanders.opponent.model === 'finished' && r.figures.every((f) => f.model === 'finished'); }, { timeout: 20000 }).toBe(true);
  await loaded();
  const high = await page.evaluate(async () => await window.oreheart.getRenderStats());
  expect(high.graphics).toBe('high');
  expect(high.webgl).toBe(true);
  expect(high.drawCalls).toBeGreaterThan(0);

  await openMenu(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Graphics: High' }).click();
  await expect(page.getByRole('button', { name: 'Graphics: Low' })).toBeVisible();

  await start(page, setup);
  await loaded();
  const low = await page.evaluate(async () => await window.oreheart.getRenderStats());
  expect(low.graphics).toBe('low');
  expect(low).toMatchObject({ bloom: false, shadows: false, particles: false });
  expect(low.drawCalls).toBeLessThan(high.drawCalls);
});

// owner (Oct 25): stay under Vercel's free 100 MB upload limit (budget 95 MB); shrink only where it doesn't show, never re-mesh models
// Owner change (Ken, Oct 29: "set it for 250 megabytes then"; Vercel Pro, 1 GB upload cap): the budget is now 250 MB
test('AC90: the built dist folder stays under 250 MB', async () => {
  const { fs, path, dir } = await appDir();
  const dist = path.join(dir, 'dist');
  expect(fs.existsSync(path.join(dist, 'index.html')), 'dist/index.html').toBe(true);
  const bytes = walk(fs, path, dist).reduce((n, f) => n + fs.statSync(f).size, 0);
  expect(bytes).toBeLessThan(250 * 1000 * 1000);
});

test.describe('phone-size match screenshot', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
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



async function expectDeckImage(loc, label) {
  const img = loc.locator('img[src*="deck-menu"]').first();
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
  // Owner (Oct 24): menus show the neat deck stack deck-menu.png; the match piles keep deck-pile.png (checked in AC176)
  await openDecks(page);
  await expectDeckImage(page.getByLabel('Deck pile', { exact: true }), 'Deck pile');
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expectDeckImage(page.getByLabel('Deck choice', { exact: true }), 'Deck choice');
});


// Owner check change (Ken, Oct 30 mulligan rule): no more picking cards (5 -> 5 -> 4 -> 3). One full redraw per match:
// the whole hand goes back, the deck is reshuffled and a new hand of the SAME size is drawn. Keep = unchanged.
test('AC95: Redraw Hand = the whole hand back and a same-size new hand from the reshuffled deck, once; part of a hand is never legal', async ({ page }) => {
  let s = await start(page, { ai: false, firstPlayer: 'player' });
  expect(s.phase).toBe('mulligan');
  expect(s.priority).toBe('player');
  const before = s.players.player.hand.map((c) => c.uid);
  const deckN = s.players.player.deck.length;
  expect(before.length).toBe(5);
  const legalNow = await legal(page);
  expect(legalNow.some((a) => a.type === 'mulligan' && a.redraw === true)).toBe(true);
  expect(legalNow.some((a) => a.type === 'mulligan' && !a.redraw)).toBe(true);
  expect((await act(page, { type: 'mulligan', uids: before.slice(0, 2) })).ok).toBe(false); // picking cards is gone
  expect((await act(page, { type: 'mulligan', redraw: true })).ok).toBe(true);
  s = await getState(page);
  const after = s.players.player.hand.map((c) => c.uid);
  expect(after.length).toBe(5);
  expect(after).not.toEqual(before);
  expect(s.players.player.deck.length).toBe(deckN);
  const all = new Set([...after, ...s.players.player.deck.map((c) => c.uid)]);
  for (const u of before) expect(all.has(u), 'old cards are back in deck or hand').toBe(true);
  expect(s.players.player.mulligans).toBe(1);
  expect(s.mulliganDone.player).toBe(true);
  expect(s.phase === 'mulligan' ? s.priority : 'done').not.toBe('player');
  if (s.phase === 'mulligan') { expect((await act(page, { type: 'mulligan', uids: [] })).ok).toBe(true); s = await getState(page); }
  expect(s.phase).toBe('deploy');
  expect((await act(page, { type: 'mulligan', redraw: true })).ok).toBe(false); // only once
  expect((await getState(page)).players.player.mulligans).toBe(1);
});

test('AC406: Keep Hand leaves the opening hand exactly as it was', async ({ page }) => {
  let s = await start(page, { ai: false, firstPlayer: 'player' });
  const before = s.players.player.hand.map((c) => c.uid);
  const deck = s.players.player.deck.map((c) => c.uid);
  expect((await act(page, { type: 'mulligan', uids: [] })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.hand.map((c) => c.uid)).toEqual(before);
  expect(s.players.player.deck.map((c) => c.uid)).toEqual(deck);
  expect(s.players.player.mulligans).toBe(0);
  expect(s.mulliganDone.player).toBe(true);
});

test('AC407: the computer redraws a hand with no affordable fighter and keeps a workable one', async ({ page }) => {
  await openTest(page);
  const run = async (seed) => {
    const s0 = await newMatch(page, { ai: true, difficulty: 'normal', seed, firstPlayer: 'player', playerCommander: 'grubnak', opponentCommander: 'borgo' });
    const before = s0.players.opponent.hand.map((c) => c.uid);
    expect((await act(page, { type: 'mulligan', uids: [] })).ok).toBe(true);
    await expect.poll(async () => (await getState(page)).mulliganDone.opponent, { timeout: 8000 }).toBe(true);
    const s = await getState(page);
    return { before, ids: s0.players.opponent.hand.map((c) => c.cardId), after: s.players.opponent.hand.map((c) => c.uid), m: s.players.opponent.mulligans };
  };
  // Owner check change (Ken, Oct 30: 60-card starter decks): new seeds for the new Dwarf Warband.
  // Owner check change (Ken, Oct 31: new Dwarf Warband): new seeds again.
  // seed 41: Riot Shield Bearers, an Anvilsworn and two Gemdrunk Deepdelvers (Miners, cost 7): no fighter at all -> redraw
  const r1 = await run(41);
  expect(r1.ids.filter((id) => !/miner|delver/.test(id)).every((id) => ['crystal-cluster', 'glowing-geode'].includes(id)), JSON.stringify(r1.ids)).toBe(true);
  expect(r1.m).toBe(1);
  expect(r1.after.slice(0, 5)).not.toEqual(r1.before);
  // a full redraw, not a swap: the old rule swapped only the two dear cards and kept the three Miners in hand
  expect(r1.before.filter((u) => r1.after.includes(u)).length).toBeLessThan(3);
  // seed 46: Miners + Barrelback Courier (5) -> keep (the hand stays, plus the second player's extra card)
  const r3 = await run(46);
  expect(r3.ids).toContain('barrelback-courier');
  expect(r3.m).toBe(0);
  expect(r3.after.slice(0, r3.before.length)).toEqual(r3.before);
});

// Owner check change (Ken, Oct 30 mulligan rule): the screen keeps its one straight row, but the cards are not tapped any more;
// the buttons are Keep Hand and Redraw Hand, and it counts "Redraws left: 1".
test('AC95: the Mulligan screen shows one straight row, Keep Hand / Redraw Hand, and Redraws left: 1', async ({ page }) => {
  await page.goto('/?test=1&seed=4'); // Ken, Oct 30 (60-card starter decks): seed 7 now puts the player second; seed 4 has the player first
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Grubnak Rotgut, Goblin King' }).click();
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  const mull = page.getByRole('dialog', { name: 'Mulligan' });
  await expect(mull).toBeVisible();
  await expect(mull).toContainText('Redraws left: 1');
  await expect(mull).not.toContainText('Mulligans left');
  await expect(mull.getByRole('button', { name: 'Redraw Selected' })).toHaveCount(0);
  await expect(mull.locator('button[aria-pressed]')).toHaveCount(0);
  const faces = mull.locator('[data-card-id]');
  await expect(faces).toHaveCount(5);
  const boxes = [];
  for (let i = 0; i < 5; i++) boxes.push(await faces.nth(i).boundingBox());
  boxes.sort((a, b) => a.x - b.x);
  for (let i = 1; i < 5; i++) {
    expect(Math.abs(boxes[i].y - boxes[0].y)).toBeLessThanOrEqual(2);
    expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width - 1);
  }
  const before = await faces.evaluateAll((els) => els.map((e) => e.dataset.uid));
  await expect(mull.getByRole('button', { name: 'Keep Hand' })).toBeVisible();
  await expect(mull.getByRole('button', { name: 'Redraw Hand' })).toBeEnabled();
  await mull.getByRole('button', { name: 'Redraw Hand' }).click();
  await expect(mull).toBeHidden();
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  const s = await getState(page);
  expect(s.players.player.mulligans).toBe(1);
  expect(s.players.player.hand.length).toBe(5);
  expect(s.players.player.hand.map((c) => c.uid)).not.toEqual(before);
});

test('AC408: How to Play tells the new rule, not the old 5-4-3 one', async ({ page }) => {
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  const all = await page.evaluate(() => document.body.innerText);
  expect(all).toMatch(/Redraw Hand/);
  expect(all).toMatch(/one redraw per match/i);
  expect(all).not.toMatch(/then 4, then 3|Redraw Selected|up to 3 times/);
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

test('AC97: card reveals never block the game and can be pinned', async ({ page }) => {
  await page.goto('/?test=1&seed=123&fx=1');
  await page.waitForFunction(() => !!window.oreheart);
  const s = await newMatch(page, respondR6([], 0));
  await castFireball(page, s);
  const reveal = page.getByLabel('Card reveal', { exact: true });
  await expect(reveal).toBeVisible();
  // owner check change (Ken, Oct 30): the computer's card shows big for about a second, then is laid down; a tap pins it (also while it is moving)
  await reveal.click({ force: true });
  await expect(reveal).toHaveAttribute('data-pinned', 'true');
  await expect(reveal).toContainText('Searing Arcane Orb');
  expect(at(await getState(page), 6, 4)).toBeUndefined(); // already resolved underneath
  await page.waitForTimeout(4000);
  await expect(reveal).toBeVisible();
  await reveal.click();
  await expect(reveal).toBeHidden();
});

test('AC98: right-clicking a creature shows its card and changes nothing; left-click only selects (owner, Oct 25)', async ({ page }) => {
  const before = await start(page, quiet({ board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 7, col: 3 }] }));
  const unit = page.getByLabel('Bowler Brawler, row 7, column 3', { exact: true });
  const card = page.getByRole('dialog', { name: 'Bowler Brawler', exact: true });
  await unit.click();
  await expect(card).toHaveCount(0); // left-click selects, it does not open the card
  await page.keyboard.press('Escape');
  await unit.click({ button: 'right' });
  await expect(card).toBeVisible();
  await expect(card.locator('[data-card-id="goblin-scrapper"]')).toHaveCount(1);
  expect(await getState(page)).toEqual(before);
  await expect(card.getByRole('button', { name: 'Close' })).toHaveCount(1); // owner check change (Ken, Oct 30: ✕ Close on the card view)
  await page.keyboard.press('Escape');
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

test('AC101: SewerSlide Bomber carries a bomb: drop, KA-BOOM, then 1 damage to the adjacent enemy', async ({ page }) => {
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
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const W = 844, H = 390;
  const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; };
  test('AC104: straight-on road perspective, Commanders in the corners, HUD around them', async ({ page }) => {
    await start(page, quiet({ playerHand: ['goblin-scrapper', 'goblin-slinger', 'fireball', 'soul-shard', 'shieldbeard'], opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard'], board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 7, col: 3 },
      { cardId: 'goblin-scrapper', owner: 'player', row: 7, col: 11 },
      { cardId: 'gnome-tinker', owner: 'opponent', row: 1, col: 3 },
      { cardId: 'gnome-tinker', owner: 'opponent', row: 1, col: 11 },
    ] }));
    const near3 = await center(page.getByLabel('Bowler Brawler, row 7, column 3', { exact: true }));
    const near11 = await center(page.getByLabel('Bowler Brawler, row 7, column 11', { exact: true }));
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
    // Round 9a: HUD positions are checked against the owner's layout in AC212
  });

  test('AC105: the enemy hand is smaller than the player hand', async ({ page }) => {
    await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball'], opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard'] }));
    const back = page.getByLabel('Enemy hand', { exact: true }).locator('[data-card-back]');
    await expect(back).toHaveCount(3);
    const eb = await back.first().boundingBox();
    const pb = await page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Bowler Brawler', exact: true }).boundingBox();
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
  const toL = page.getByLabel('Bowler Brawler, row 4, column 3', { exact: true });
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


test('AC108: title screen uses the painted cavern background with the logo, without errors', async ({ page }) => {
  // Owner change (Forge, Oct 30): Ken's new front menu picture is /art/menu-front-oct29.webp (Oct 29), so the picture may be the old cavern or the new menu-front one.
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openMenu(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' }).getByRole('img', { name: 'Oreheart' })).toBeVisible();
  const usesCavern = await page.evaluate(() =>
    [...document.querySelectorAll('img')].some((i) => /cavern|menu-front/.test(i.src)) ||
    [...document.querySelectorAll('*')].some((e) => /cavern|menu-front/.test(getComputedStyle(e).backgroundImage)));
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
  s = await newMatch(page, { ai: false, factionLock: false, setup: { firstPlayer: 'opponent', opponentHand: ['goblin-scrapper'], opponentCrystals: 6 } }); // a Fighter: no Tunnel (Round 10); Round 24: give the enemy crystals to pay for it
  const opp = (await legal(page)).filter((a) => a.type === 'summon');
  expect(opp.some((a) => a.row === 1 && a.col === 13)).toBe(true);
  expect(opp.some((a) => a.row === 1 && a.col === 12)).toBe(false);
  expect(opp.every((a) => a.row === 1)).toBe(true);
});

test('AC110: random mines are always corner-mirrored, fair, away from both Strongholds and never on the same square', async ({ page }) => {
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
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(cheb(m[i], m[j])).toBeGreaterThanOrEqual(1); // Round 10: may touch
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

// Owner check change (Ken, Oct 31): four 60-card starter decks per faction, in the deck-picker order Warband, Mine Rush, Arcane Hoard, Expedition
const STYLES = { warband: 'Warband', 'mine-rush': 'Mine Rush', 'arcane-hoard': 'Arcane Hoard', expedition: 'Expedition' };
const FACTIONS = { goblin: 'Goblin', gnome: 'Gnome', dwarf: 'Dwarf' };
// Owner check change (Ken, Oct 30: 60-card starter decks; Oct 31: twelve decks, four styles, Miners at least a third)
test('AC112/AC128: twelve legal 60-card starter decks: Warband, Mine Rush, Arcane Hoard and Expedition for each faction', async ({ page }) => {
  await openTest(page);
  const decks = await page.evaluate(async () => await window.oreheart.listStarterDecks());
  expect(decks.length).toBe(12);
  const ids = new Set(decks.flatMap((d) => d.cards));
  const info = await cardInfo(page, [...ids]);
  for (const [f, fname] of Object.entries(FACTIONS)) for (const [st, sname] of Object.entries(STYLES)) {
    const d = decks.find((x) => x.id === `${f}-${st}`);
    expect(d, `${f}-${st}`).toBeTruthy();
    expect(d.name).toBe(`${fname} ${sname}`);
    expect(d.style).toBe(st);
    expect(d.cards.length).toBe(60);
    expect((await validate(page, d.cards)).legal, d.id).toBe(true);
    const of = (pred) => d.cards.filter((id) => pred(info[id])).length;
    const creatures = of((c) => c.type === 'creature');
    const spells = of((c) => c.type === 'spell');
    const crystals = of((c) => c.type === 'crystal');
    const miners = of((c) => c.type === 'creature' && (c.role === 'gatherer' || c.role === 'smith'));
    const counters = of((c) => c.type === 'spell' && c.speed === 'counter');
    // [creatures, spells, Crystal cards, Miners] (Ken, Oct 31)
    const want = { warband: [48, 8, 4, 22], 'mine-rush': [60, 0, 0, 45], 'arcane-hoard': [45, 15, 0, 30], expedition: [45, 9, 6, 24] }[st];
    expect([creatures, spells, crystals, miners], d.id).toEqual(want);
    expect(miners, `${d.id} Miners`).toBeGreaterThanOrEqual(20); // Ken, Oct 31: Miners at least a third of every starter deck
    const basic = { goblin: 'goblin-scrounger', gnome: 'gnome-prospector', dwarf: 'dwarf-miner' }[f]; // config basicGatherers
    const nb = d.cards.filter((id) => id === basic).length;
    expect(nb, `${d.id} basic Miners`).toBeGreaterThanOrEqual(5);
    if (st === 'warband') expect(nb, `${d.id} basic Miners`).toBe({ goblin: 15, gnome: 17, dwarf: 14 }[f]);
    const ns = d.cards.filter((id) => id === `${f}-smith-miner`).length;
    expect(ns, `${d.id} Smith Miners`).toBeGreaterThanOrEqual(3);
    if (st === 'warband') expect(ns, `${d.id} Smith Miners`).toBe(f === 'goblin' ? 7 : 5);
    const faction = { goblin: 'goblins', gnome: 'gnomes', dwarf: 'dwarves' }[f];
    for (const id of d.cards) if (info[id].type === 'spell') expect([faction, null, 'neutral'], `${d.id} ${id}`).toContain(info[id].faction ?? null);
    const cmd = { goblin: 'grubnak', gnome: 'sproingle', dwarf: 'borgo' }[f];
    expect((await validate(page, d.cards, cmd)).legal, `${d.id} with ${cmd}`).toBe(true);
    if (st === 'warband') expect(counters, d.id).toBeGreaterThanOrEqual(1);
    if (st === 'arcane-hoard') expect(counters, d.id).toBeGreaterThanOrEqual(2);
  }
});

// New check (Ken, Oct 30: 60-card starter decks); owner check change (Ken, Oct 31): twelve decks
test('AC417: every starter deck is exactly 60 cards, legal for its Commander, and a match deals from it', async ({ page }) => {
  await openTest(page);
  const decks = await page.evaluate(async () => await window.oreheart.listStarterDecks());
  expect(decks.length).toBe(12);
  for (const d of decks) {
    expect(d.cards.length, d.id).toBe(60);
    const cmd = { goblins: 'grubnak', gnomes: 'sproingle', dwarves: 'borgo' }[d.faction];
    const v = await validate(page, d.cards, cmd);
    expect(v.problems, `${d.id} with ${cmd}`).toEqual([]);
    expect(v.legal, d.id).toBe(true);
  }
  const s = await newMatch(page, { ai: false, playerCommander: 'borgo', opponentCommander: 'sproingle', playerDeckId: 'dwarf-arcane-hoard', opponentDeckId: 'gnome-expedition' });
  expect(s.players.player.deck.length + s.players.player.hand.length).toBe(60);
  expect(s.players.opponent.deck.length + s.players.opponent.hand.length).toBe(60);
});

// Owner check change (Ken, Oct 31): four styles per faction ("Horde" is gone)
test('AC113: matches use the chosen starter decks; the opponent deck can be any of the four', async ({ page }) => {
  await openTest(page);
  const decks = await page.evaluate(async () => await window.oreheart.listStarterDecks());
  const sorted = (a) => [...a].sort();
  const deckOf = (s, side) => sorted([...s.players[side].deck, ...s.players[side].hand].map((c) => c.cardId));
  let s = await newMatch(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', playerDeckId: 'goblin-expedition', opponentDeckId: 'dwarf-arcane-hoard' });
  expect(s.players.player.deckId).toBe('goblin-expedition');
  expect(s.players.opponent.deckId).toBe('dwarf-arcane-hoard');
  expect(deckOf(s, 'player')).toEqual(sorted(decks.find((d) => d.id === 'goblin-expedition').cards));
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
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const inView = (b) => b && b.x >= -1 && b.y >= -1 && b.x + b.width <= 845 && b.y + b.height <= 391;
  test('AC115: the enemy hand is always on-screen and the hand shows all 15 cards in a dock row (Ken, Oct 30)', async ({ page }, testInfo) => {
    // owner check change (Ken, Oct 30 hand spec): was "shows about 7 cards, then scrolls"; with many cards the hand is a dock-like row around the pointer
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
    expect(first).toBe(15);
    await expect(page.getByRole('button', { name: 'Scroll hand right', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Scroll hand left', exact: true })).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath('match-both-hands-844x390.png') });
  });

  test('AC116: a right-clicked creature shows its card at hovered-hand-card size, fully on-screen', async ({ page }) => {
    await start(page, quiet({ playerHand: ['goblin-scrapper'], board: [{ cardId: 'goblin-slinger', owner: 'player', row: 5, col: 9 }] }));
    const handCard = await page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Bowler Brawler', exact: true }).boundingBox();
    await page.getByLabel(/, row 5, column 9$/).click({ button: 'right' }); // owner, Oct 25: right-click opens the card
    const dlg = page.getByRole('dialog').filter({ has: page.locator('[data-card-id="goblin-slinger"]') });
    await expect(dlg).toBeVisible();
    const face = await dlg.locator('[data-card-id="goblin-slinger"]').first().boundingBox();
    expect(face.height).toBeGreaterThanOrEqual(handCard.height * 1.6);
    expect(face.height).toBeLessThanOrEqual(handCard.height * 2.5);
    expect(inView(face)).toBe(true);
  });

  // Owner check change (Ken, Oct 31): four starter stacks per faction, in the order Warband, Mine Rush, Arcane Hoard, Expedition
  test('AC117: the deck picker shows the starter decks as named stacks', async ({ page }, testInfo) => {
    await page.goto('/?test=1&seed=5');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Knobbin the Gnomeificent', exact: true }).click();
    const row = page.getByLabel('Deck choice', { exact: true });
    const stacks = row.getByRole('button', { name: /, 60 cards, ready$/ });
    await expect(stacks.first()).toHaveAccessibleName('Gnome Warband, 60 cards, ready');
    await expect(stacks.nth(1)).toHaveAccessibleName('Gnome Mine Rush, 60 cards, ready');
    await expect(stacks.nth(2)).toHaveAccessibleName('Gnome Arcane Hoard, 60 cards, ready');
    await expect(stacks.nth(3)).toHaveAccessibleName('Gnome Expedition, 60 cards, ready');
    await expect(row.getByRole('button', { name: 'Goblin Expedition, 60 cards, ready', exact: true })).toHaveCount(0); // Round 8b: only his decks
    await expect(row.getByRole('button', { name: 'Dwarf Arcane Hoard, 60 cards, ready', exact: true })).toHaveCount(0);
    await expect(row.locator('img[src*="deck-menu"]').first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('deck-picker-844x390.png') });
    await row.getByRole('button', { name: 'Gnome Expedition, 60 cards, ready', exact: true }).click();
    await expect(row.getByRole('button', { name: 'Gnome Expedition, 60 cards, ready', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Fight!', exact: true }).click();
    await page.getByRole('button', { name: 'Keep Hand' }).click();
    const s = await page.evaluate(async () => await window.oreheart.getState());
    expect(s.players.player.deckId).toBe('gnome-expedition');
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




test('AC121: Deck Builder deck art has no frame; painted background', async ({ page }) => {
  await openDecks(page);
  const pile = page.getByLabel('Deck pile', { exact: true });
  const img = pile.locator('img[src*="deck-menu"]').first();
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

// every visible native control is restyled; no native <select>; every scrollbar is silver
// Owner check change (Ken, Oct 30 silver theme): the whole UI is silvery, not gold, so scrollbars are silver (a light, cool grey thumb) instead of gold
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
      if (c === 'auto' || !(r1 >= 110 && b1 >= r1 && b1 >= g1 && b1 - r1 <= 60)) bad.push(`scrollbar ${e.tagName.toLowerCase()} "${e.getAttribute('aria-label') || ''}" color ${c}`);
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
  await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toBeVisible();
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
      await skipIntro(page);
      const offer = page.getByRole('dialog', { name: 'Welcome to Oreheart!' });
      await expect(offer).toBeVisible();
      await page.waitForTimeout(800); // let entrance animations settle
      const logo = await page.getByRole('heading', { level: 1, name: 'Oreheart' }).getByRole('img', { name: 'Oreheart' }).boundingBox();
      const tut = await page.getByRole('button', { name: 'How to Play', exact: true }).boundingBox();
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
      await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
      expect(await page.locator('[data-ornament=\"frame\"], [data-ornament=\"corner\"]').count(), 'deck builder ornaments').toBe(0);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await page.getByRole('button', { name: 'How to Play', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
      expect(await page.locator('[data-ornament=\"frame\"], [data-ornament=\"corner\"]').count(), 'Rules ornaments').toBe(0);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toBeVisible();
      expect(await page.locator('[data-ornament=\"frame\"], [data-ornament=\"corner\"]').count(), 'select screen ornaments').toBe(0);
      await page.goto('/');
      await skipIntro(page);
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


// ================= Phase 1B, Round 4 =================
const R4_SPELLS = {
  'venom-shiv': ['Venom Shiv', 'goblins', 2], 'tunnel-rush': ['Rat-Tunnel Ambush', 'goblins', 2], 'hold-it': ['Pickpocket!', 'goblins', 3],
  fireball: ['Searing Arcane Orb', 'gnomes', 3], 'meteor-strike': ['Starfall Cataclysm', 'gnomes', 6], 'spell-snap': ['Unweave', 'gnomes', 5],
  'shield-bubble': ['Ironclad Bulwark', 'dwarves', 2], 'battle-cry': ['Thunderhorn Blast', 'dwarves', 3], 'second-wind': ['Emergency Rations', 'dwarves', 5],
  'healing-light': ['Field Bandage', null, 2], fizzle: ['Snuff Out', null, 3], 'prospectors-prayer': ['Desperate Plunder', null, 0],
};
async function openMulligan(page, seed = 7) {
  await page.goto(`/?test=1&seed=${seed}`);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Grubnak Rotgut, Goblin King' }).click();
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


test('AC131: Venom Shiv poisons for 7 of the target’s turns (1 damage each, no healing); Hex Reversal is disabled', async ({ page }) => {
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
  expect(at(s, 2, 4).poison).toBe(7);
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
  expect([at(s, 2, 4).health, at(s, 2, 4).poison]).toEqual([H - 1, 6]);
  await passTurn(page);
  s = await toTurnOf('player');
  expect(at(s, 2, 4).health).toBe(H - 1); // no healing while poisoned
});


// AC133 (Round 4 metal lettering) was retired in Round 5a; AC135 checks the new plain gold Alegreya SC lettering.

test.describe('round 4 phone screenshots (844x390)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
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
// Owner check change (Ken, Oct 31): four starter decks per faction ("Horde" is gone)
const STARTERS = ['Goblin', 'Gnome', 'Dwarf'].flatMap((f) => ['Warband', 'Mine Rush', 'Arcane Hoard', 'Expedition'].map((st) => `${f} ${st}`));
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
      // Round 12d: card faces use the owner's card format fonts (Alegreya SC, Russo One, IM Fell English SC)
      if (!el || el.closest('[aria-hidden="true"], canvas, svg, script, style, noscript, textarea, .cardc')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const cs = getComputedStyle(el);
      const t = n.textContent.trim().slice(0, 30);
      // Owner change (Oct 24, c874f715 owner-layout.json; Oct 18, e0d6b3fc menus.json): text the owner marks italic:false (e.g. deck counts, the Play button) is upright on purpose: the HUD sets --os/font-style normal (owner-hud.ts), menu pieces set font-style normal inline (menus.ts)
      let ownerUpright = false;
      for (let a = el; a && a !== document.body; a = a.parentElement) { if (a.style && (a.style.fontStyle === 'normal' || a.style.getPropertyValue('--os').trim() === 'normal') && a.closest('[data-hud-role], .mb-pc')) { ownerUpright = true; break; } }
      if (!/^["']?Alegreya SC\b/.test(cs.fontFamily)) bad.push(`${t} [font ${cs.fontFamily}]`);
      else if (cs.fontStyle !== 'italic' && !ownerUpright) bad.push(`${t} [style ${cs.fontStyle}]`);
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
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)'); // Round 15: white
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  expect(await letteringProblems(page), 'rules').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible();
  expect(await letteringProblems(page), 'settings').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(await letteringProblems(page), 'deck builder').toEqual([]);
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toHaveCSS('color', 'rgb(255, 255, 255)');
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
      // Round 12d: owner card format faces (.cardc) are 420 x 624; frames are layers inside them
      const cc = face.querySelector('.cardc');
      const img = cc ? null : [...face.querySelectorAll('img')].find((i) => /frame/.test(i.src) && i.naturalWidth > 0);
      if (!img && !cc) continue;
      out.checked++;
      const want = cc ? 420 / 624 : img.naturalWidth / img.naturalHeight;
      const id = face.getAttribute('data-card-id');
      const faceR = (cc || face).offsetWidth / (cc || face).offsetHeight;
      if (Math.abs(faceR / want - 1) > 0.03) out.bad.push(`${id} face ${faceR.toFixed(3)} vs ${want.toFixed(3)}`);
      if (img) { const imgR = img.offsetWidth / img.offsetHeight; if (Math.abs(imgR / want - 1) > 0.03) out.bad.push(`${id} frame img ${imgR.toFixed(3)} vs ${want.toFixed(3)}`); }
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

// menu actions are plain white text (Round 15): no border, box color, box image, shadow or outline at rest
// Owner check change (Ken, Oct 30 silver theme: "silvery UI, not gold, with fancier buttons: a border with a gem in it"):
// the main actions now sit in Brush's silver gem frame, drawn as a border image (no CSS border width, box colour or shadow), text still white
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
    if (s.color !== 'rgb(255, 255, 255)') bad.push(`${name} color ${s.color}`);
  }
  return bad;
}
const unframed = async (page, names) => { const bad = []; for (const name of names) { const src = await page.getByRole('button', { name, exact: true }).first().evaluate((e) => getComputedStyle(e).borderImageSource); if (!/\/art\/ui\/silver\/btn-/.test(src)) bad.push(`${name} has no silver gem frame (${src})`); } return bad; };
test('AC137: menu buttons are plain white text with a hover glow, no boxes or borders', async ({ page }) => {
  await toTitle(page);
  expect(await boxedButtons(page, ['Play', 'Deck Builder', 'How to Play', 'Settings', 'Quit']), 'title').toEqual([]);
  expect(await unframed(page, ['Play', 'Deck Builder', 'How to Play', 'Settings', 'Quit']), 'title gem frames (Ken, Oct 30)').toEqual([]);
  const play = page.getByRole('button', { name: 'Play', exact: true });
  const look = () => play.evaluate((e) => { const c = getComputedStyle(e); return [c.textShadow, c.filter, c.transform, c.backgroundImage, c.color, c.fontSize].join('|'); });
  const rest = await look();
  await play.hover();
  await expect.poll(look).not.toBe(rest);
  await expect(play).toHaveCSS('cursor', 'pointer');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  expect(await boxedButtons(page, ['Back', 'Restore starter decks']), 'settings').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  expect(await boxedButtons(page, ['Back']), 'rules').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  expect(await boxedButtons(page, ['Auto-fill', 'Save', 'Rename', 'New Deck', 'Back']), 'deck builder').toEqual([]);
  expect(await unframed(page, ['Auto-fill', 'Save', 'Rename', 'New Deck', 'Back']), 'deck builder gem frames (Ken, Oct 30)').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Normal', exact: true }).click();
  expect(await boxedButtons(page, ['Easy', 'Hard', 'Fight!', 'Remove Goblin Warband', 'Copy Goblin Warband to my decks', 'Restore starter decks']), 'select').toEqual([]);
  expect(await unframed(page, ['Back', 'Fight!']), 'select gem frames (Ken, Oct 30)').toEqual([]);
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
    await page.getByRole('button', { name: 'How to Play', exact: true }).click();
    await fillsWindow(page, 'rules', `rules ${at}`);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
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
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  for (const vp of [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(400);
    await fillsWindow(page, 'deck-builder', `deck builder live ${vp.width}x${vp.height}`);
  }
});

const left = async (loc) => (await box(loc)).x;

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

const TWELVE = ['Shiv Rat', 'Goblin Miner', 'Mangewolf Rider', 'Snotskull Grunt', 'Goblin Chef', 'Skullbasher Rusher',
  'Soul Shard', 'Soul Cluster', 'Bowler Brawler', 'Boneknocker', 'Junk Shaman', 'Skullflinger']; // Goblin deck: other factions' cards are hidden (Round 13)
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
    await expect(row.getByRole('button', { name: `${name}, 60 cards, ready`, exact: true })).toHaveCount(0);
  };
  // Owner check change (Ken, Oct 31): four starter decks per faction; "Goblin Expedition" replaces "Goblin Horde"
  await row.getByRole('button', { name: 'Remove Goblin Expedition', exact: true }).click();
  await page.getByRole('dialog', { name: 'Remove deck?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Goblin Expedition, 60 cards, ready', exact: true })).toHaveCount(1);
  await removeDeck('Goblin Expedition');
  await page.reload();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Goblin Expedition, 60 cards, ready', exact: true })).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Goblin Warband, 60 cards, ready', exact: true })).toHaveCount(1);
  // Restore from Settings
  await toTitle(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Restore starter decks', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Goblin Expedition, 60 cards, ready', exact: true })).toHaveCount(1);
  // Round 8b: per Commander, his last deck can't be removed (Oct 31: four decks, so remove three)
  for (const st of ['Goblin Warband', 'Goblin Mine Rush', 'Goblin Arcane Hoard']) await removeDeck(st);
  await expect(row.getByRole('button', { name: 'Remove Goblin Expedition', exact: true })).toBeDisabled();
  await expect(row.getByRole('button', { name: 'Goblin Expedition, 60 cards, ready', exact: true })).toHaveCount(1);
  // Restore from the deck picker
  await page.getByRole('button', { name: 'Restore starter decks', exact: true }).click();
  for (const st of STARTERS.slice(0, 4)) await expect(row.getByRole('button', { name: `${st}, 60 cards, ready`, exact: true })).toHaveCount(1);
});

test('AC145: Copy to my decks makes an editable saved copy and leaves the starter deck unchanged; my decks can be removed', async ({ page }) => {
  page.on('dialog', (d) => { throw new Error(`browser dialog used: ${d.message()}`); });
  await toSelect(page);
  await deckRow(page).getByRole('button', { name: 'Copy Goblin Warband to my decks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
  await expect(deckName(page)).toHaveText('Goblin Warband (copy)');
  await expect(deckSize(page)).toContainText(/60 cards \(50[–-]100\)/); // Ken, Oct 30: 60-card starter decks
  await expect(myDecks(page).getByRole('button', { name: /^Goblin Warband \(copy\)/ })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByLabel('Deck problems', { exact: true })).toContainText('Deck is legal');
  await renameDeck(page, 'My Warband');
  await deckList(page).getByRole('button', { name: 'Remove Goblin Miner', exact: true }).click();
  await saveDeck(page);
  const starters = await page.evaluate(async () => await window.oreheart.listStarterDecks());
  expect(starters.find((d) => d.name === 'Goblin Warband').cards.length).toBe(60);
  await page.reload();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(deckRow(page).getByRole('button', { name: 'Goblin Warband, 60 cards, ready', exact: true })).toHaveCount(1);
  await expect(deckRow(page).getByRole('button', { name: 'My Warband, 59 cards, ready', exact: true })).toHaveCount(1);
  await deckRow(page).getByRole('button', { name: 'Remove My Warband', exact: true }).click();
  await page.getByRole('dialog', { name: 'Remove deck?' }).getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(deckRow(page).getByRole('button', { name: /^My Warband,/ })).toHaveCount(0);
  await toTitle(page);
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  await expect(myDecks(page).getByRole('button', { name: /^My Warband/ })).toHaveCount(0);
});

const COMMANDERS = ['Grubnak Rotgut, Goblin King', 'Knobbin the Gnomeificent', 'Thane Borgo Gravelgrim'];
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
    const stack = deckRow(page).getByRole('button', { name: 'Goblin Warband, 60 cards, ready', exact: true });
    // owner check change (Ken, Oct 31, via Forge: the deck picker is a list on the right-hand side with room for four named starter decks): a deck row, not a big stack
    expect((await box(stack)).height, `${at} deck entry size`).toBeGreaterThanOrEqual(34);
    const glow = (n) => page.getByRole('button', { name: n, exact: true }).evaluate((e) => {
      for (const x of [e, ...e.querySelectorAll('*')]) {
        const c = getComputedStyle(x);
        if (c.boxShadow !== 'none' || /drop-shadow/.test(c.filter)) return `${c.boxShadow}|${c.filter}`;
      }
      return null;
    });
    for (const n of COMMANDERS) expect(await glow(n), `${at} ${n} glows`).not.toBeNull();
    expect(await glow(COMMANDERS[0]), `${at} selected glows strongest`).not.toBe(await glow(COMMANDERS[1]));
    // owner check change (Ken, Oct 31): "the background box that the commander cards sit in, I don't want that. Just take that out." -> no dimmed/blurred wall behind the cards any more
    const blurred = await page.evaluate(() => [...document.querySelectorAll('[data-screen="select"] *')].some((e) => {
      const c = getComputedStyle(e);
      return /blur\(/.test(c.backdropFilter || c.webkitBackdropFilter || '') || /blur\(/.test(c.filter);
    }));
    expect(blurred, `${at} no dimmed/blurred wall behind the cards`).toBe(false);
    const fb = await box(page.getByRole('button', { name: 'Fight!', exact: true }));
    expect(fb.y + fb.height, `${at} Fight! on-screen`).toBeLessThanOrEqual(H + 1);
    if (W === 1280) expect(await px(page.getByRole('heading', { name: 'Choose Your Commander' })), 'heading 2x').toBeGreaterThanOrEqual(28);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
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
        // owner change (Ken, Oct 30 hand spec): the resting hand is half tucked below the screen, so hover the card's visible top part
        const cb = await hand.locator(`[data-card-id="${id}"]`).first().boundingBox();
        await page.mouse.move(cb.x + cb.width / 2, Math.min(vp.height - 2, cb.y + cb.height * 0.2));
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
    test.skip(true, 'Round 9a: replaced by AC212–AC213');
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
      expect(shown).toBeGreaterThanOrEqual(0.97); // Round 17: the hand rests fully on screen
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
  for (const [label, n, img] of [['Your Flow crystals', '7', 'Your soul crystal'], ['Enemy Flow crystals', '5', 'Enemy soul crystal']]) {
    await expect(page.getByLabel(label, { exact: true })).toHaveText(new RegExp(`^\\s*${n}\\s*$`));
    expect(await centerIn(label, img), `${label} on ${img}`).toBe(true);
  }
  // Round 9a/9c: banks are their own pieces; the Commander name and "Flow" sit beside the crystal (owner layout)
  await expect(page.getByLabel('Your Bank crystals', { exact: true })).toHaveText(/^\s*3\s*$/);
  await expect(page.getByLabel('Enemy Bank crystals', { exact: true })).toHaveText(/^\s*2\s*$/);
  await expect(page.getByText(/Grubnak/).first()).toBeVisible();
  await expect(page.getByText(/Borgo/).first()).toBeVisible();
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
    test.skip(true, 'Round 9a: replaced by AC216–AC217');
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
  const cheap = await cost('goblin-scrounger'); // Round 22: a 1-cost Miner, so Grubnak's discount can't make the troll affordable
  expect(await cost('grubnaks-big-boss-troll')).toBeGreaterThan(cheap + 2);
  await newMatch(page, quiet({ playerHand: ['goblin-scrounger', 'grubnaks-big-boss-troll'], playerCrystals: cheap }));
  const hand = page.getByLabel('Your hand', { exact: true });
  const yes = hand.locator('button:has([data-card-id="goblin-scrounger"])').first();
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
  await giveUp(page);
  expect(await boxedButtons(page, ['Yes, give up'])).toEqual([]);
  await page.getByRole('button', { name: 'Yes, give up' }).click();
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
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
  test('AC158: no text below about 14 px on any screen at phone size', async ({ page }) => {
    await page.goto('/?test=1');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    expect(await smallText(page), 'title').toEqual([]);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    expect(await smallText(page), 'settings').toEqual([]);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'How to Play', exact: true }).click();
    expect(await smallText(page), 'rules').toEqual([]);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
    await expect(page.getByRole('slider', { name: 'Cards per row' })).toBeVisible();
    expect(await smallText(page), 'deck builder').toEqual([]);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toBeVisible();
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
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.waitForTimeout(500);
      await testInfo.attach(`menu-open-${vp.width}x${vp.height}`, { body: await page.screenshot(), contentType: 'image/png' });
      await page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Bowler Brawler', exact: true }).hover();
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
    test.skip(true, 'Round 9a: replaced by AC212');
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
      const unit = page.getByLabel('Bowler Brawler, row 4, column 8', { exact: true });
      const u = await unit.boundingBox();
      await page.mouse.click(u.x + u.width / 2, u.y + u.height / 2);
      await expect(page.getByRole('dialog', { name: 'Bowler Brawler', exact: true })).toBeVisible();
    });

    test(`AC163: the hand is 2x, centered, overlapping, fully on screen at rest and rises on hover (${W}x${H})`, async ({ page }) => {
    test.skip(true, 'Round 9a: replaced by AC212 and AC218');
      await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'goblin-slinger', 'soul-shard', 'goblin-scrounger'] }));
      await page.mouse.move(W / 2, H * 0.3);
      await page.waitForTimeout(1200);
      const hand = page.getByLabel('Your hand', { exact: true });
      const cards = hand.getByRole('button').filter({ has: page.locator('[data-card-id]') });
      await expect(cards).toHaveCount(5);
      const boxes = [];
      for (let i = 0; i < 5; i++) boxes.push(await cards.nth(i).boundingBox());
      for (const b of boxes) {
        expect(b.height / H).toBeGreaterThanOrEqual(0.31); // Round 9a: owner hand 33.81 % of the frame
        expect(b.height / H).toBeLessThanOrEqual(0.37);
        const shown = (H - b.y) / b.height;
        expect(shown, 'Round 17: fully on screen at rest').toBeGreaterThanOrEqual(0.97);
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
      await expect.poll(async () => { const b = await cards.nth(4).boundingBox(); return (H - b.y) / b.height; }, { message: 'back at rest, fully on screen (Round 17)' }).toBeGreaterThanOrEqual(0.97);
    });

    test(`AC164: the hovered card rises to 48-60% of the height on the top layer (${W}x${H})`, async ({ page }) => {
      await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'goblin-slinger', 'soul-shard', 'goblin-scrounger'] }));
      await page.waitForTimeout(1200);
      const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Searing Arcane Orb', exact: true });
      const b0 = await card.boundingBox();
      await page.mouse.move(b0.x + b0.width / 2, Math.min(H - 4, b0.y + 10));
      await expect.poll(async () => (await card.boundingBox()).height / H).toBeGreaterThanOrEqual(0.47);
      await page.waitForTimeout(500);
      const b = await card.boundingBox();
      expect(b.height / H).toBeLessThanOrEqual(0.61); // Round 9a: 1.6x of a 33.81 % card
      expect(b.x).toBeGreaterThanOrEqual(-1);
      expect(b.y).toBeGreaterThanOrEqual(-1);
      expect(b.x + b.width).toBeLessThanOrEqual(W + 1);
      expect(b.y + b.height).toBeLessThanOrEqual(H + 1);
      const pts = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([fx, fy]) => [b.x + b.width * fx, b.y + b.height * fy]);
      const covered = await card.evaluate((el, points) => points.filter(([x, y]) => { const e = document.elementFromPoint(x, y); return !(e && (e === el || el.contains(e))); }), pts);
      expect(covered, 'something covers the popped card').toEqual([]);
    });

    test(`AC166: enemy hand centered with the deck to its left; nothing covers a Commander (${W}x${H})`, async ({ page }) => {
    test.skip(true, 'Round 9a: replaced by AC212–AC213');
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
  const allowed = new Set(['255,255,255']); // Round 15: every text outside the card faces is plain white
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

test('AC167: every text outside the card faces is plain white #ffffff (title, Rules, Settings, Deck Builder, Choose Your Commander, match)', async ({ page }) => {
  await openMenu(page);
  const vals = await page.evaluate((vars) => Object.fromEntries(vars.map((v) => [v, getComputedStyle(document.documentElement).getPropertyValue(v).trim().toLowerCase()])), PALETTE_6A);
  expect(vals['--text-white']).toBe('#ffffff');
  expect(vals['--color-damage']).toBe('#ff4040');
  expect(await strayColors(page), 'title').toEqual([]);
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  expect(await strayColors(page), 'rules').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible();
  expect(await strayColors(page), 'settings').toEqual([]);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
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
  for (const name of ['Play', 'Deck Builder', 'How to Play', 'Settings', 'Quit']) await bold(page.getByRole('button', { name, exact: true }), name);
  expect(await letteringProblems(page), 'title').toEqual([]);
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  const h = page.getByRole('heading', { name: 'Rules', exact: true });
  await bold(h, 'Rules heading');
  const bodyWeight = await page.evaluate(() => { const p = [...document.querySelectorAll('p, li')].find((e) => e.checkVisibility() && e.textContent.trim().length > 40); return p && getComputedStyle(p).fontWeight; });
  expect(bodyWeight).toBe('400');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
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
  await allCards(page).getByRole('button', { name: 'Goblin Miner', exact: true }).dblclick();
  const list = deckList(page);
  await expect(list).toContainText('1 × Goblin Miner');
  const add = list.getByRole('button', { name: 'Add Goblin Miner', exact: true });
  const rem = list.getByRole('button', { name: 'Remove Goblin Miner', exact: true });
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
  expect(r.text).toContain('2 × Goblin Miner');
  expect(r.anims, 'running animations after +').toBe(0);
  let after = await pos();
  for (let i = 0; i < 2; i++) { expect(Math.abs(after[i].x - before[i].x)).toBeLessThanOrEqual(1); expect(Math.abs(after[i].y - before[i].y)).toBeLessThanOrEqual(1); }
  before = after;
  r = await clickAndRead(rem);
  expect(r.text).toContain('1 × Goblin Miner');
  expect(r.anims, 'running animations after -').toBe(0);
  after = await pos();
  for (let i = 0; i < 2; i++) { expect(Math.abs(after[i].x - before[i].x)).toBeLessThanOrEqual(1); expect(Math.abs(after[i].y - before[i].y)).toBeLessThanOrEqual(1); }
  for (let i = 0; i < 5; i++) await add.click({ delay: 0 });
  await expect(list).toContainText('6 × Goblin Miner');
});

test('AC171: no "All cards" text and no corner ornaments on any menu screen', async ({ page }) => {
  const noOrnaments = async (label) => {
    expect(await page.locator('[data-ornament="frame"], [data-ornament="corner"]').count(), `${label} ornaments`).toBe(0);
  };
  await openMenu(page);
  await noOrnaments('title');
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
  await expect(page.getByText('All cards', { exact: true })).toHaveCount(0);
  await expect(allCards(page)).toBeVisible();
  await noOrnaments('deck builder');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
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
  expect(await page.locator('[data-ornament="frame"]').count(), 'match frame ornaments').toBe(0); // Round 9a: 3 goblin corner frames allowed (AC215)
});

test('AC172: crystal mines use the owner\'s Crystal Node model, about 1.3 squares tall and inside its square, in the owner\'s faction color; unowned mines are white (owner, Oct 24)', async ({ page }) => {
  await start(page, quiet({ board: [
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 },
    { cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 6, minedMine: M3 },
  ] }));
  const r = await page.evaluate(async () => await window.oreheart.getRenderStats());
  if (!r.webgl) test.skip(true, 'WebGL unavailable');
  expect(r.mines).toBe('finished');
  expect(r.mineModels).toHaveLength(3);
  const FAC = ['#3ee06a', '#9b4dff', '#2f5fd8'];
  for (const m of r.mineModels) {
    expect(['code:buildMineModel', 'model:crystal-node.glb']).toContain(m.source);
    expect(m.height).toBeGreaterThanOrEqual(1.1);
    expect(m.height).toBeLessThanOrEqual(1.45);
    expect(['player', 'opponent', 'neutral']).toContain(m.owner);
    if (m.owner === 'neutral') expect(m.tint.toLowerCase()).toBe('#ffffff');
    else expect(FAC).toContain(m.tint.toLowerCase());
  }
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
      const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Bowler Brawler', exact: true });
      const b = await card.boundingBox();
      await page.mouse.move(b.x + b.width / 2, Math.min(vp.height - 4, b.y + 10));
      await page.waitForTimeout(800);
      await testInfo.attach(`6a-match-popout-${vp.width}x${vp.height}`, { body: await page.screenshot(), contentType: 'image/png' });
      const back = page.getByLabel('Enemy hand', { exact: true }).locator('[data-card-back]').first();
      await testInfo.attach(`6a-card-back-${vp.width}x${vp.height}`, { body: await back.screenshot(), contentType: 'image/png' });
      await page.goto('/?test=1');
      await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
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
      const allRest = (msg) => expect.poll(async () => (await heights()).filter((h) => h > 0.42).length, { message: msg, timeout: 4000 }).toBe(0);
      const onlyPopped = (i, msg) => expect.poll(async () => (await heights()).every((h, j) => (j === i ? h >= 0.47 : h <= 0.42)), { message: msg, timeout: 4000 }).toBe(true);
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
        for (let i = 0; i < n; i++) shown.push(await restTuckedOk(page, await cards.nth(i).boundingBox(), H));
        return shown.every((s) => s);
      }, { message: 'hand back at its tucked rest (Ken, Oct 30)' }).toBe(true);
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
      const scrapper = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Bowler Brawler', exact: true });
      pt = await hoverPointOf(scrapper);
      await page.mouse.move(pt[0], pt[1], { steps: 3 });
      await expect.poll(async () => (await scrapper.boundingBox()).height / H).toBeGreaterThanOrEqual(0.47);
      expect((await act(page, summon)).ok).toBe(true);
      await expect(cards).toHaveCount(before - 1);
      await page.waitForTimeout(600);
      expect((await heights()).filter((h) => h > 0.42).length, 'at most one card popped after playing').toBeLessThanOrEqual(1);
      await away();
      await allRest('nothing stuck after a card was played');
    });

    test(`AC175: hand cards follow the owner layout (about 34% of the height), fully on screen at rest (${W}x${H})`, async ({ page }) => {
      await start(page, quiet({ playerHand: HAND_R7 }));
      await page.mouse.move(W / 2, H * 0.3);
      await page.waitForTimeout(1200);
      const cards = handCards7(page);
      await expect(cards).toHaveCount(5);
      for (let i = 0; i < 5; i++) {
        const b = await cards.nth(i).boundingBox();
        expect(b.height / H).toBeGreaterThanOrEqual(0.30); // Round 14: owner hand h 33.81%, fanned cards' boxes grow a little
        expect(b.height / H).toBeLessThanOrEqual(0.40);
        expect(await restTuckedOk(page, b, H), 'Ken, Oct 30: rests tucked below the home row, top showing').toBe(true);
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
  expect(size, 'owner card back (Oct 24, 1024x1536)').toEqual([1024, 1536]);
  for (const label of ['Your deck', 'Enemy deck']) {
    const pile = page.getByLabel(label, { exact: true });
    await expectDeckImage(pile, label);
    expect(await pileSize(pile), label).toEqual([900, 999]); // owner's new deck pile (Oct 24)
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
  // Owner change (Oct 24, 11acd779 / c874f715): the Deck Builder pile is the owner's neat deck stack deck-menu.png (800x1000), not deck-pile
  expect(await dp.locator('img[src*="deck-menu"]').first().evaluate((i) => [i.naturalWidth, i.naturalHeight])).toEqual([800, 1000]);
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

test('AC179: crystal mines are about 1.3 spaces tall and fit inside their square (owner, Oct 24)', async ({ page }) => {
  await start(page, quiet({}));
  const r = await page.evaluate(async () => await window.oreheart.getRenderStats());
  if (!r.webgl) test.skip(true, 'WebGL unavailable');
  expect(r.mineModels).toHaveLength(3);
  for (const m of r.mineModels) {
    expect(m.height).toBeGreaterThanOrEqual(1.1);
    expect(m.height).toBeLessThanOrEqual(1.45);
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
  // Round 12b-1: a seated Grubnak sits on a throne instead of the fortress, with his staff instead of the scepter
  const files = m.grubnak.pose === 'seated'
    ? [['grubnak', 'grubnak.glb', 10.5 * 1024 * 1024], ['throne', 'grubnak-throne.glb', 5.25 * 1024 * 1024]]
    : [['grubnak', 'grubnak.glb', 10.5 * 1024 * 1024], ['fortress', 'grubnak-fortress.glb', 5.25 * 1024 * 1024], ['scepter', 'grubnak-scepter.glb', 5.25 * 1024 * 1024]];
  for (const [key, file, max] of files) {
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
  const gm = await grubnakModels(request);
  test.skip(!gm, 'Part B not delivered (no models.json)');
  test.skip(gm.grubnak.pose === 'seated', 'Round 12b-1 seated Grubnak is checked by AC280');
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

test('AC186: all 54 arena effects are drawn, off-painting pools are clipped, two foreground cut-outs', async ({ page, request }) => {
  const layout = await arenaLayout(request);
  await start(page, quiet({ board: ARENA_BOARD }));
  await expect.poll(async () => (await arenaInfo(page)).effects.filter((e) => e.type !== 'flow').length).toBe(54);
  const a = await arenaInfo(page);
  a.effects = a.effects.filter((e) => e.type !== 'flow'); // Round 9c: the 3 owner flow streams are drawn by Crystal Flow (AC228)
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
  await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.08);
  await page.mouse.down();
  const t = await sq2s(page, 7, 11);
  await page.mouse.move(t.x, t.y - 40, { steps: 12 });
  expect((await arenaInfo(page)).gridLines).toBe(0);
  await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.08, { steps: 8 });
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
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.08);
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
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.08, { steps: 10 });
    await page.mouse.up();
    const crystal = await page.getByLabel('Your crystal', { exact: true }).boundingBox();
    await page.mouse.move(crystal.x + crystal.width / 2, crystal.y + crystal.height / 2);
    await expect.poll(async () => (await arenaInfo(page)).highlights.length).toBe(0);
    expect(at(await getState(page), 7, 11)).toBeFalsy();
    // drop on the mapped square
    card = await hand.boundingBox();
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.08);
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
    // Owner change (Ken, Oct 29, commit 135b9f4): one wheel notch now zooms ~16 % (was ~4 %), so 4 notches reach max zoom and square (6,8) ends up off-screen; 1 notch gives zoom 1.43, the old 4-notch zoom (1.47).
    await zoomIn(page, 960, 500, 1);
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
    test.skip(true, 'Round 9a: replaced by AC221 (code-built mine)');
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
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.08);
    await page.mouse.down();
    await page.mouse.move(960, 420, { steps: 10 });
    await page.mouse.move(1100, 380, { steps: 10 });
    expect(same((await camera(page)).view, v0), 'card drag does not pan').toBe(true);
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.08, { steps: 10 });
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
    test.skip(true, 'Round 9a: replaced by AC218');
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
  await addCard(page, 'Goblin Miner', 50);
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

// owner check change (Ken, Oct 31): "when you click the goblin king, I don't want his 3D image to pop up anymore. Just leave it his card, selected, and put arrows on either side of the card so you can page through the commanders. Instead of [the] change commander [button], just have the arrows ... Forward and back."
test('AC206: choosing a Commander hides the other two and shows only his decks; the arrows page on, Esc brings the row back, a second click keeps him selected', async ({ page }) => {
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
  const focused = async () => {
    await expect(page.getByRole('button', { name: COMMANDERS[1], exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: COMMANDERS[2], exact: true })).toBeHidden();
    await expect(grub).toBeVisible();
    await expect(grub).toHaveAttribute('aria-pressed', 'true');
    expect((await selectState(page)).mode).toBe('focused');
    await expect(page.getByRole('button', { name: 'Change Commander', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Previous commander', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next commander', exact: true })).toBeVisible();
    await expect(deckRow(page).getByRole('button', { name: 'Goblin Warband, 60 cards, ready', exact: true })).toBeVisible();
    await expect(deckRow(page).getByRole('button', { name: /^(Gnome|Dwarf) / })).toHaveCount(0);
  };
  const backToRow = async (how) => {
    for (const n of COMMANDERS) await expect(page.getByRole('button', { name: n, exact: true }), how).toBeVisible();
    expect((await selectState(page)).mode, how).toBe('row');
  };
  await grub.click();
  await focused();
  await grub.click(); // a second click leaves his card selected
  await focused();
  await page.keyboard.press('Escape');
  await backToRow('Esc');
  await grub.click();
  await focused();
  await page.getByRole('button', { name: 'Next commander', exact: true }).click();
  expect((await selectState(page)).commanderId).toBe('sproingle');
  await expect(page.getByRole('button', { name: COMMANDERS[1], exact: true })).toBeVisible();
  await expect(grub).toBeHidden();
  await expect(deckRow(page).getByRole('button', { name: 'Gnome Warband, 60 cards, ready', exact: true })).toBeVisible();
  await expect(deckRow(page).getByRole('button', { name: /^(Goblin|Dwarf) / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  const s = await keepAndGetState(page);
  expect(s.players.player.commanderId).toBe('sproingle');
});

// owner check change (Ken, Oct 31): "when you click the goblin king, I don't want his 3D image to pop up anymore. Just leave it his card, selected, and put arrows on either side of the card so you can page through the commanders. Instead of [the] change commander [button], just have the arrows ... Forward and back."
test('AC207: choosing Grubnak shows only his card, selected: no 3D model pops up', async ({ page }) => {
  await toSelect(page);
  await page.getByRole('button', { name: COMMANDERS[0], exact: true }).click();
  await page.waitForTimeout(1500);
  expect((await selectState(page)).model).toBeNull();
  await expect(page.locator('[data-screen="select"] canvas')).toHaveCount(0);
  await expect(page.getByRole('button', { name: COMMANDERS[0], exact: true })).toHaveAttribute('aria-pressed', 'true');
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
    await expect(page.getByRole('button', { name: 'Next commander', exact: true })).toBeVisible(); // owner check change (Ken, Oct 31): arrows replace Change Commander
    await check('focused');
    await expect(page.getByRole('button', { name: /in 3D/ })).toHaveCount(0);
  }
  await openDecks(page);
  await expect(page.getByRole('button', { name: /in 3D/ })).toHaveCount(0);
});

test('AC209: the Deck Builder close-up shows the 3D viewer beside Grubnak\'s card and dismisses correctly', async ({ page, request }) => {
  test.setTimeout(120000);
  await openDecks(page);
  // a card without a model (a spell; Round 12b-1 gives Shiv Rat a model): close-up alone
  await allCards(page).getByRole('button', { name: /Venom Shiv/ }).first().click();
  const shiv = page.getByRole('dialog', { name: /Venom Shiv/ });
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


for (const [W, H] of [[1920, 1080], [844, 390]]) {
}

// ---------- Phase 1B Round 9a (AC212–AC227) ----------
const hud = (page) => page.evaluate(async () => await window.oreheart.getHudLayout());
const R9_MATCH = (extra = {}) => quiet({ playerHand: ['goblin-scrapper', 'fireball', 'soul-shard', 'goblin-slinger', 'venom-shiv'],
  playerCrystals: 4, playerBank: 2, opponentBank: 3, ...extra });
async function ownerLayout(request) {
  const r = await request.get('/owner-layouts/final-draft/layout.json');
  expect(r.ok()).toBe(true);
  const body = await r.body();
  expect(body.length).toBe(34877); // owner check change (Ken, Oct 31: the Done button the size of the Menu button, both centred). Was 34877. Round 14: the owner's Oct 24 layout (same bytes as src/content/owner-layout.json; Oct 30: synced to the owner's flame 0.4 / glow x1.15 fixes and hand overlap 0.26; Ken Oct 30 playtest: Commanders 1.8x, no thrones)
  return JSON.parse(body.toString('utf8'));
}
const SKIP_ROLES = new Set(['player-hand', 'done-button']);
const norm360 = (a) => ((a % 360) + 540) % 360 - 180; // -180..180

for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`round 9a owner layout ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });
    test(`AC212: every HUD piece sits where the owner's layout puts it (${W}x${H})`, async ({ page, request }) => {
      const L = await ownerLayout(request);
      await start(page, R9_MATCH());
      await page.waitForTimeout(1500);
      const h = await hud(page);
      const fw = Math.min(W, H * 16 / 9), fh = fw * 9 / 16;
      expect(Math.abs(h.frame.width - fw)).toBeLessThanOrEqual(2);
      expect(Math.abs(h.frame.height - fh)).toBeLessThanOrEqual(2);
      const tol = fh * 0.01 + 1;
      for (const p of L.hud.filter((x) => x.role && !x.parent && !x.hidden && !SKIP_ROLES.has(x.role))) {
        const got = h.pieces.find((q) => q.role === p.role);
        expect(got, p.role).toBeTruthy();
        const cx = p.x + p.w / 2;
        const offX = W > fw ? (cx < 33.33 ? 0 : cx > 66.67 ? W - fw : (W - fw) / 2) : 0;
        const offY = H > fh ? ((p.y + p.h / 2) < 33.33 ? 0 : (p.y + p.h / 2) > 66.67 ? H - fh : (H - fh) / 2) : 0;
        const want = { x: offX + p.x / 100 * fw, y: offY + p.y / 100 * fh, width: p.w / 100 * fw, height: p.h / 100 * fh };
        for (const k of ['x', 'y', 'width', 'height']) expect(Math.abs(got.rect[k] - want[k]), `${p.role} ${k}`).toBeLessThanOrEqual(W === 1920 ? W * 0.01 : tol);
        expect(Math.abs(norm360((got.rot || 0) - (p.rot || 0))), `${p.role} rot`).toBeLessThanOrEqual(3);
        await expect(page.locator(`[data-hud-role="${p.role}"]`).first(), p.role).toBeAttached();
      }
      for (const id of ['pic2', 'pic3', 'pic4']) await expect(page.locator(`[data-hud-role="${id}"]`).first()).toBeAttached();
    });
  });
}

test('AC213: the enemy deck and card fan are upside down with a readable deck count', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const s = await start(page, R9_MATCH({ opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard'] }));
  const h = await hud(page);
  const deck = h.pieces.find((p) => p.role === 'enemy-deck');
  const fan = h.pieces.find((p) => p.role === 'enemy-hand');
  expect(Math.abs(norm360(deck.rot - 172))).toBeLessThanOrEqual(3);
  expect(Math.abs(norm360(fan.rot - 180))).toBeLessThanOrEqual(3);
  const count = h.pieces.find((p) => p.role === 'enemy-deck-count');
  expect(Math.abs(norm360(count.rot))).toBeLessThanOrEqual(10);
  await expect(page.locator('[data-hud-role="enemy-deck-count"]').first()).toHaveText(String(s.players.opponent.deck.length));
});


test('AC215: themes follow each side\'s Commander faction; goblin corner frames only for a Goblin player', async ({ page, request }) => {
  const r = await request.get('/themes/goblin.json');
  expect(r.ok()).toBe(true);
  const t = await r.json();
  expect(t.faction).toBe('goblin');
  expect(t.cornerFrames).toHaveLength(3);
  await start(page, R9_MATCH());
  const theme = (side) => page.evaluate(async (x) => await window.oreheart.getTheme(x), side);
  const p = await theme('player'), o = await theme('opponent');
  expect(p.faction).toBe('goblin'); expect(p.placeholder).toBe(false); expect(p.cornerFrames).toBe(3);
  expect(o.faction).toBe('dwarf'); expect(o.placeholder).toBe(true); expect(o.bankSrc).toMatch(/opponent-bank-placeholder\.png/);
  await expect(page.locator('[data-ornament="corner"]')).toHaveCount(3);
  await newMatch(page, { ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak', setup: { opponentHand: [] } });
  const p2 = await theme('player');
  expect(p2.faction).toBe('gnome'); expect(p2.placeholder).toBe(true); expect(p2.cornerFrames).toBe(0);
  expect((await theme('opponent')).bankSrc).toMatch(/goblin-bank\.png/);
  await expect(page.locator('[data-ornament="corner"]')).toHaveCount(0);
});

test('AC216: the drop-down Menu has the owner\'s six items, closes properly and Give up asks first', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await start(page, R9_MATCH());
  const btn = page.getByRole('button', { name: 'Menu', exact: true });
  const menu = page.getByRole('menu', { name: 'Match menu' });
  await expect(menu).toBeHidden();
  await btn.hover();
  await page.waitForTimeout(400);
  await expect(menu).toBeHidden(); // opens on click only
  await btn.click();
  await expect(menu).toBeVisible();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  const names = (await menu.getByRole('menuitem').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
  // Owner change (Oct 28, d6a8871 + 7af662c): the Menu also has "Square highlights" and a Full screen / Windowed switch (its label shows the current mode)
  expect(names.length).toBe(8);
  expect(names.slice(0, 3)).toEqual(['Resume', 'Settings', 'Square highlights']);
  expect(['Full screen', 'Windowed']).toContain(names[3]);
  expect(names.slice(4)).toEqual(['How to play', 'Sound Effects', 'Background music', 'Give up match!']);
  const bb = await btn.boundingBox(), first = await menu.getByRole('menuitem').first().boundingBox();
  expect(first.y).toBeGreaterThan(bb.y);
  expect(Math.abs(first.x - bb.x)).toBeLessThanOrEqual(1920 * 0.03);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await btn.click();
  await page.mouse.click(960, 500);
  await expect(menu).toBeHidden();
  await btn.click();
  await menu.getByRole('menuitem', { name: 'Resume', exact: true }).click();
  await expect(menu).toBeHidden();
  await giveUp(page);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await getState(page)).winner).toBeNull();
  await giveUp(page);
  await page.getByRole('button', { name: 'Yes, give up', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible({ timeout: 15000 });
  expect((await getState(page)).winner).toBe('opponent');
});

test('AC217: Settings, Sound Effects, Background music and How to play open their controls', async ({ page }) => {
  await start(page, R9_MATCH());
  await openMatchMenu(page);
  const dlg = page.getByRole('dialog', { name: 'Match settings' });
  for (const loc of [dlg.getByRole('button', { name: 'Last turn', exact: true }), dlg.getByRole('button', { name: 'Mute', exact: true }),
    dlg.getByRole('switch', { name: 'Card pop-ups' }), dlg.getByRole('button', { name: 'Recenter', exact: true }),
    dlg.getByRole('slider', { name: 'Music volume' }), dlg.getByRole('slider', { name: 'Sound effects volume' })]) await expect(loc).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  const btn = page.getByRole('button', { name: 'Menu', exact: true });
  await btn.click();
  await page.getByRole('menuitem', { name: 'Sound Effects', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Sound effects volume' })).toBeVisible();
  await page.keyboard.press('Escape');
  if (!(await page.getByRole('menu', { name: 'Match menu' }).isVisible())) await btn.click();
  await page.getByRole('menuitem', { name: 'Background music', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Music volume' })).toBeVisible();
  await page.keyboard.press('Escape');
  if (!(await page.getByRole('menu', { name: 'Match menu' }).isVisible())) await btn.click();
  await page.getByRole('menuitem', { name: 'How to play', exact: true }).click();
  const how = page.getByRole('dialog', { name: 'How to play' });
  await expect(how).toBeVisible();
  await how.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(how).toBeHidden();
});

for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`round 9a hand ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });
    test(`AC218: hovering raises the whole card, neighbors move aside, moving across shuffles (${W}x${H})`, async ({ page }) => {
      const fh = Math.min(W, H * 16 / 9) * 9 / 16;
      await start(page, R9_MATCH());
      await page.mouse.move(W / 2, H * 0.3);
      await page.waitForTimeout(1500);
      const cards = page.getByLabel('Your hand', { exact: true }).getByRole('button');
      await expect(cards).toHaveCount(5);
      const rest = [];
      for (let i = 0; i < 5; i++) rest.push(await cards.nth(i).boundingBox());
      for (const b of rest) {
        expect(b.height / fh).toBeGreaterThanOrEqual(0.30); expect(b.height / fh).toBeLessThanOrEqual(0.40); // Round 14: fanned
        expect(await restTuckedOk(page, b, H), 'Ken, Oct 30: rests tucked below the home row, top showing').toBe(true);
      }
      const hoverAt = async (i) => {
        const b = rest[i];
        const nx = i < 4 ? rest[i + 1].x : b.x + b.width;
        await page.mouse.move((b.x + Math.min(nx, b.x + b.width)) / 2, Math.min(H - 4, b.y + 10), { steps: 4 });
        await page.waitForTimeout(800);
      };
      await hoverAt(2);
      const up = await cards.nth(2).boundingBox();
      expect(up.y + up.height).toBeLessThanOrEqual(H + 1);
      expect(up.height / fh).toBeGreaterThanOrEqual(0.48); expect(up.height / fh).toBeLessThanOrEqual(0.6);
      const hh = await handHover(page);
      expect(hh.raisedIndex).toBe(2);
      expect(hh.popScale).toBeCloseTo(1.6, 2);
      // owner check change (Ken, Oct 31): "It looks jerky, and blurry. Play with the speed some" -- the rise is now a short ease (was 400-500 ms)
      expect(hh.popMs).toBeGreaterThanOrEqual(120); expect(hh.popMs).toBeLessThanOrEqual(220);
      const l = await cards.nth(1).boundingBox(), r = await cards.nth(3).boundingBox();
      expect(l.x).toBeLessThan(rest[1].x - 2);
      expect(r.x).toBeGreaterThan(rest[3].x + 2);
      await hoverAt(3);
      expect((await handHover(page)).raisedIndex).toBe(3);
      const b3 = await cards.nth(3).boundingBox();
      expect(b3.y + b3.height).toBeLessThanOrEqual(H + 1);
      const b2 = await cards.nth(2).boundingBox();
      expect(b2.y).toBeGreaterThanOrEqual(up.y + 10); // card 2 went back down (Round 22: rest is fully on screen, Round 17)
      expect(b2.height).toBeLessThan(up.height - 5);
      // owner, Oct 25: leaving the fan, even onto the enlarged card's top, lowers the hand at once
      await page.mouse.move(b3.x + b3.width / 2, Math.max(2, b3.y + 4), { steps: 2 });
      await page.mouse.move(b3.x + b3.width / 2, Math.max(2, b3.y - 40), { steps: 2 });
      await expect.poll(async () => (await handHover(page)).raisedIndex, { timeout: 2000 }).toBe(-1);
    });
  });
}

test('AC219: the opening hand deals in one card at a time', async ({ page }) => {
  await start(page, R9_MATCH());
  await page.waitForTimeout(2500);
  const s = await getState(page);
  const log = await page.evaluate(async () => await window.oreheart.getDealLog());
  const uids = s.players.player.hand.map((c) => c.uid);
  const mine = log.filter((e) => uids.includes(e.uid));
  expect(mine.length).toBe(uids.length);
  for (const e of mine) { expect(e.durationMs).toBeGreaterThanOrEqual(650); expect(e.durationMs).toBeLessThanOrEqual(750); }
  for (let i = 1; i < mine.length; i++) {
    const gap = mine[i].startMs - mine[i - 1].startMs;
    expect(gap).toBeGreaterThanOrEqual(100); expect(gap).toBeLessThanOrEqual(160);
  }
});


test('AC221: mines are the code-built owner mine with all its parts', async ({ page }) => {
  await start(page, quiet({ board: [{ cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 }] }));
  const r = await page.evaluate(async () => await window.oreheart.getRenderStats());
  if (!r.webgl) test.skip(true, 'WebGL unavailable');
  expect(r.mineModels).toHaveLength(3);
  for (const m of r.mineModels) {
    expect(['code:buildMineModel', 'model:crystal-node.glb']).toContain(m.source); // owner, Oct 24: the Crystal Node model replaces the code-built mine once loaded
    expect(m.height).toBeGreaterThanOrEqual(1.1); expect(m.height).toBeLessThanOrEqual(1.45);
    if (m.source === 'code:buildMineModel') for (const part of ['rubble', 'pedestal', 'banner', 'crystal']) expect(m.parts).toContain(part);
    expect(m.shards).toBeGreaterThanOrEqual(6);
    expect(m.pulsing).toBe(true);
  }
});

test('AC222: Crystal Flow streams run from owned mines to each side\'s Flow crystal when Flow is gained', async ({ page }) => {
  await start(page, { ...quiet({ board: [
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 },
    { cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 6, minedMine: M3 },
  ] }), firstPlayer: 'player' });
  expect((await page.evaluate(async () => await window.oreheart.getArena())).effects).toHaveLength(57);
  const streams = () => page.evaluate(async () => await window.oreheart.getFlowStreams());
  await passTurn(page); // opponent's turn starts: it gains Flow from M3
  await expect.poll(async () => (await streams()).log.filter((x) => x.side === 'opponent').length).toBeGreaterThanOrEqual(1);
  const o = (await streams()).log.find((x) => x.side === 'opponent');
  expect(o.to).toBe('enemy-flow-crystal'); // Round 10
  expect(sameTarget(o.from, M3.row, M3.col)).toBe(true);
  await passTurn(page); // back to the player
  await expect.poll(async () => (await streams()).log.filter((x) => x.side === 'player').length).toBeGreaterThanOrEqual(1);
  const p = (await streams()).log.find((x) => x.side === 'player');
  expect(p.to).toBe('player-flow-crystal'); // Round 10
  expect(p.shards).toBe('faceted');
  expect(p.sBends).toBeGreaterThanOrEqual(1);
  expect(p.count).toBeGreaterThan(0);
});

test('AC223: menu music on menus, match music in matches, crossfades, Mute silences both', async ({ page, request }) => {
  for (const [u, n] of [['/audio/music/tense-cycle.mp3', 1540211], ['/audio/music/first-fight.mp3', 1667679]]) {
    const r = await request.get(u);
    expect(r.ok(), u).toBe(true);
    expect((await r.body()).length, u).toBe(n);
  }
  await page.goto('/?test=1&seed=5');
  await page.waitForFunction(() => !!window.oreheart);
  const audio = () => page.evaluate(async () => await window.oreheart.getAudioState());
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => (await audio()).music.track).toBe('tense-cycle');
  expect((await audio()).unlocked).toBe(true);
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  await expect.poll(async () => (await audio()).music.track).toBe('first-fight');
  let a = await audio();
  let last = a.log[a.log.length - 1];
  expect(last.track).toBe('first-fight');
  expect(last.fadeMs).toBeGreaterThanOrEqual(1000); expect(last.fadeMs).toBeLessThanOrEqual(2000);
  const mull = page.getByRole('dialog', { name: 'Mulligan' });
  if (await mull.isVisible()) await mull.getByRole('button', { name: 'Keep Hand' }).click();
  await openMatchMenu(page);
  const mute = page.getByRole('button', { name: 'Mute', exact: true });
  if ((await mute.getAttribute('aria-pressed')) === 'true') await mute.click();
  await mute.click();
  await expect.poll(async () => (await audio()).muted).toBe(true);
  expect((await audio()).music.gain).toBe(0);
  await mute.click();
  await page.keyboard.press('Escape');
  await giveUp(page);
  await page.getByRole('button', { name: 'Yes, give up', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => (await audio()).music.track).toBe('tense-cycle');
  a = await audio();
  last = a.log[a.log.length - 1];
  expect(last.fadeMs).toBeGreaterThanOrEqual(1000); expect(last.fadeMs).toBeLessThanOrEqual(2000);
});

test('AC224: the music and sound effects volume sliders work and are remembered', async ({ page }) => {
  await start(page, R9_MATCH());
  await openMatchMenu(page);
  const dlg = page.getByRole('dialog', { name: 'Match settings' });
  await dlg.getByRole('slider', { name: 'Music volume' }).fill('35');
  await dlg.getByRole('slider', { name: 'Sound effects volume' }).fill('60');
  const audio = () => page.evaluate(async () => await window.oreheart.getAudioState());
  await expect.poll(async () => Math.round((await audio()).musicVolume * ((await audio()).musicVolume <= 1 ? 100 : 1))).toBe(35);
  await expect.poll(async () => Math.round((await audio()).sfxVolume * ((await audio()).sfxVolume <= 1 ? 100 : 1))).toBe(60);
  await openTest(page);
  const v = (await audio()).musicVolume;
  expect(Math.round(v <= 1 ? v * 100 : v)).toBe(35);
});

test('AC225: savings land in the bank piece', async ({ page }) => {
  await start(page, { ...quiet({ playerCrystals: 10, playerBank: 0, playerHand: [] }), firstPlayer: 'player' });
  await passTurn(page);
  const s = await getState(page);
  expect(s.players.player.bank).toBe(1);
  await expect(page.locator('[data-hud-role="player-bank"]').first().getByLabel('Your Bank crystals', { exact: true })).toHaveText('1');
});

test('AC226: the in-game editor (round 9b) is not built yet', async ({ page }) => {
  await page.goto('/?test=1&editor=1');
  await page.waitForFunction(() => !!window.oreheart);
  await newMatch(page, R9_MATCH());
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  for (const n of ['Hide handles', 'Export layout', 'Import layout']) await expect(page.getByRole('button', { name: n })).toHaveCount(0);
});

for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`round 9a screenshots ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });
    test(`AC227: match at rest, raised card, open menu and a Crystal Flow stream render without errors (${W}x${H})`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await start(page, { ...R9_MATCH({ board: [{ cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 }] }), firstPlayer: 'player' });
      await page.mouse.move(W / 2, H * 0.3);
      await page.waitForTimeout(1500);
      await testInfo.attach(`r9a-match-${W}x${H}`, { body: await page.screenshot(), contentType: 'image/png' });
      const card = page.getByLabel('Your hand', { exact: true }).getByRole('button').nth(2);
      const b = await card.boundingBox();
      await page.mouse.move(b.x + b.width * 0.3, Math.min(H - 4, b.y + 10), { steps: 4 });
      await page.waitForTimeout(900);
      await testInfo.attach(`r9a-raised-${W}x${H}`, { body: await page.screenshot(), contentType: 'image/png' });
      await page.mouse.move(W / 2, H * 0.3);
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.waitForTimeout(600);
      await testInfo.attach(`r9a-menu-${W}x${H}`, { body: await page.screenshot(), contentType: 'image/png' });
      await page.keyboard.press('Escape');
      await passTurn(page);
      await passTurn(page);
      await page.waitForTimeout(700);
      await testInfo.attach(`r9a-flow-${W}x${H}`, { body: await page.screenshot(), contentType: 'image/png' });
      expect(errors).toEqual([]);
    });
  });
}

// ---------- Round 9c ----------
const R9C_MENUS = '/menus/menus.json';
// counts WebGL draw calls per canvas (Round 9c: the arena must draw every frame)
async function countDrawCalls(page) {
  await page.addInitScript(() => {
    window.__drawCalls = new Map();
    for (const P of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
      for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const orig = P.prototype[fn];
        if (!orig) continue;
        P.prototype[fn] = function (...a) { const c = this.canvas; window.__drawCalls.set(c, (window.__drawCalls.get(c) || 0) + 1); return orig.apply(this, a); };
      }
    }
  });
}
const arenaDraws = (page) => page.evaluate(() => {
  const c = document.querySelector('canvas[data-arena-canvas]');
  return c ? (window.__drawCalls.get(c) || 0) : -1;
});
async function centerPixel(page) {
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const out = [];
    for (const [fx, fy] of [[0.5, 0.5], [0.45, 0.45], [0.55, 0.55]]) out.push([...g.getImageData(Math.floor(img.width * fx), Math.floor(img.height * fy), 1, 1).data].slice(0, 3));
    return out;
  }, png);
}

test.describe('round 9c arena', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC228: the arena canvas draws every frame and the screen center is not the plain board color', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await countDrawCalls(page);
    await start(page, quiet({}));
    if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
    await expect.poll(async () => (await arenaInfo(page)).drawn, { timeout: 15000 }).toBe(true);
    for (let i = 0; i < 2; i++) {
      const a = await arenaDraws(page);
      expect(a, 'canvas[data-arena-canvas] exists').toBeGreaterThanOrEqual(0);
      await page.waitForTimeout(500);
      expect(await arenaDraws(page), `arena draw calls in window ${i}`).toBeGreaterThan(a);
    }
    for (const [r, g, b] of await centerPixel(page)) {
      expect(Math.abs(r - 42) + Math.abs(g - 29) + Math.abs(b - 56), `pixel ${r},${g},${b} is the plain board color`).toBeGreaterThan(12);
    }
    expect(errors).toEqual([]);
  });

  test('AC229: all 57 owner effects (54 arena + 3 Crystal Flow), 2 cut-outs, no arena errors; unknown effect types are skipped', async ({ page, request }) => {
    const layout = await (await request.get('/owner-layouts/final-draft/layout.json')).json();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    await start(page, quiet({}));
    await expect.poll(async () => (await arenaInfo(page)).drawn, { timeout: 15000 }).toBe(true);
    const a = await arenaInfo(page);
    expect(a.effects).toHaveLength(57);
    expect(a.effects.filter((e) => e.type === 'flow')).toHaveLength(3);
    expect(a.effects.filter((e) => e.type !== 'flow')).toHaveLength(54);
    expect(a.flowEffects).toBe(3);
    expect(a.foregroundCutouts).toBe(layout.foregroundCutouts.length);
    expect(a.errors).toEqual([]);
    expect(consoleErrors.filter((t) => /arena/i.test(t))).toEqual([]);
    // a bad effect type can never take down the arena
    await newMatch(page, quiet({ arenaExtraEffects: [{ type: 'bogus', x: 400, y: 300 }] }));
    await expect.poll(async () => (await arenaInfo(page)).drawn, { timeout: 15000 }).toBe(true);
    const b = await arenaInfo(page);
    expect(b.skippedTypes).toContain('bogus');
    expect(b.foregroundCutouts).toBe(layout.foregroundCutouts.length);
  });
});

const poses = (page) => page.evaluate(async () => await window.oreheart.getPiecePoses());
const yawDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

test('AC230: Commanders stand on the ground inside their strongholds, upright, facing the owner turn', async ({ page }) => {
  await start(page, quiet({}));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  await expect.poll(async () => !!(await poses(page)).pCmd, { timeout: 15000 }).toBe(true);
  const p = await poses(page);
  for (const [cmd, fort, cx, cy, turn] of [['pCmd', 'pFort', 1.5, 6.5, 146], ['eCmd', 'eFort', 11.5, 0.5, -15]]) {
    expect(p[cmd].cx).toBeCloseTo(cx, 2); expect(p[cmd].cy).toBeCloseTo(cy, 2);
    expect(p[fort].cx).toBeCloseTo(cx, 2); expect(p[fort].cy).toBeCloseTo(cy, 2);
    // Round 12b-1: a seated Commander sits on his throne (above the ground); the throne stands on it
    if (p[cmd].seated) expect(p[cmd].baseY, `${cmd} on the seat`).toBeGreaterThan(p.boardY);
    else expect(Math.abs(p[cmd].baseY - p.boardY), `${cmd} on the ground`).toBeLessThanOrEqual(0.01 * p.square);
    expect(Math.abs(p[fort].baseY - p.boardY), `${fort} on the ground`).toBeLessThanOrEqual(0.01 * p.square);
    expect(yawDiff(p[cmd].yawDeg, turn), `${cmd} faces turn ${turn}`).toBeLessThanOrEqual(3);
    for (const k of ['pCmd', 'pFort', 'eCmd', 'eFort']) {
      expect(Math.abs(p[k].tiltDeg), `${k} tilt`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(p[k].leanDeg), `${k} lean`).toBeLessThanOrEqual(0.5);
    }
  }
  expect(yawDiff(p.pFort.yawDeg, p.pCmd.seated ? 146 : 137)).toBeLessThanOrEqual(3);
});

test('AC231: the stronghold never moves; Grubnak emotes in place and returns to his turn', async ({ page }) => {
  test.setTimeout(60000);
  await start(page, quiet({}));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  await expect.poll(async () => !!(await poses(page)).pFort, { timeout: 15000 }).toBe(true);
  const p0 = await poses(page);
  for (const emote of ['laugh', 'point', 'celebrate', 'surprised']) {
    await page.evaluate(async (e) => await window.oreheart.playEmote('player', e), emote);
    await page.waitForTimeout(2500);
    const p = await poses(page);
    expect(p.pFort.matrix, `stronghold moved during ${emote}`).toEqual(p0.pFort.matrix);
    expect(p.eFort.matrix).toEqual(p0.eFort.matrix);
    expect(p.pCmd.cx).toBeCloseTo(1.5, 2); expect(p.pCmd.cy).toBeCloseTo(6.5, 2);
    if (p.pCmd.seated) expect(p.pCmd.baseY).toBeGreaterThan(p.boardY);
    else expect(Math.abs(p.pCmd.baseY - p.boardY)).toBeLessThanOrEqual(0.01 * p.square);
  }
  await expect.poll(async () => yawDiff((await poses(page)).pCmd.yawDeg, 146), { timeout: 8000 }).toBeLessThanOrEqual(3);
});

test('AC232: the owner menus file, pictures, sound and main menu picture are shipped', async ({ page, request }) => {
  const res = await request.get(R9C_MENUS);
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.first).toBe('intro');
  expect(m.screens.map((s) => s.id)).toEqual(['intro', 'main', 'deck', 'commander']);
  const snd = await request.get('/audio/menu/snd-qoqhrj.mp3');
  expect(snd.ok()).toBe(true);
  expect((await snd.body()).length).toBe(98253);
  await openTest(page);
  const dims = await page.evaluate(async () => {
    // Owner change (Ken, Oct 29, v2): the front menu picture is front-menu-background-oct29-v2 (1670x942); v1 and menu-cavern.webp are in _discontinued
    const img = new Image(); img.src = '/art/menu-front-oct29.webp'; await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  });
  expect(dims).toEqual([1670, 942]);
});

async function menuPieceBoxes(page, request, screenId) {
  const m = await (await request.get(R9C_MENUS)).json();
  const sc = m.screens.find((s) => s.id === screenId);
  const vp = page.viewportSize();
  const out = [];
  for (const p of sc.pieces.filter((q) => !q.hidden)) {
    const el = page.locator(`[data-menu-piece="${p.id}"]`);
    await expect(el, `piece ${p.id}`).toHaveCount(1);
    const b = await el.boundingBox();
    const want = { x: (p.x / 100) * vp.width, y: (p.y / 100) * vp.height, w: (p.w / 100) * vp.width, h: (p.h / 100) * vp.height };
    const bad = Math.max(Math.abs(b.x - want.x) / vp.width, Math.abs(b.y - want.y) / vp.height, Math.abs(b.width - want.w) / vp.width, Math.abs(b.height - want.h) / vp.height);
    if (bad > 0.01) out.push(`${p.id} off by ${(bad * 100).toFixed(1)}%`);
  }
  return out;
}

test.describe('round 9c menus 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC233: main menu, Deck Builder and Choose Your Commander pieces sit in the owner boxes', async ({ page, request }) => {
    await openTest(page);
    await page.waitForTimeout(2500);
    expect(await menuPieceBoxes(page, request, 'main')).toEqual([]);
    await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
    await page.waitForTimeout(2000);
    expect(await menuPieceBoxes(page, request, 'deck')).toEqual([]);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Choose Your Commander' })).toBeVisible();
    await page.waitForTimeout(2000);
    expect(await menuPieceBoxes(page, request, 'commander')).toEqual([]);
  });

  test('AC234: the intro plays first, the logo crashes in with dirt, owner sounds fire on time, then the main menu', async ({ page, request }) => {
    test.setTimeout(60000);
    await page.goto('/?test=1&intro=1');
    const intro = page.getByLabel('Intro', { exact: true });
    await expect(intro).toBeVisible();
    await expect(intro.getByText('Deadly serious. Completely ridiculous.')).toBeVisible({ timeout: 8000 });
    await expect(intro.getByText('Click to continue')).toBeVisible({ timeout: 8000 });
    await expect.poll(async () => page.locator('[data-crash-debris]').count(), { timeout: 6000 }).toBeGreaterThan(0);
    await page.waitForTimeout(800);
    expect(await menuPieceBoxes(page, request, 'intro')).toEqual([]);
    const log = (await page.evaluate(async () => await window.oreheart.getAudioState())).sfxLog;
    const owner = log.find((e) => e.src === 'snd:qoqhrj');
    expect(owner, 'owner rock-fall sound cued').toBeTruthy();
    expect(Math.abs(owner.t - 2450)).toBeLessThanOrEqual(400);
    const thunder = log.find((e) => e.src === 'thunder');
    expect(thunder, 'screen thunder cued').toBeTruthy();
    expect(Math.abs(thunder.t - 470)).toBeLessThanOrEqual(400);
    // intro -> main after intro.length (7000 ms) without a click
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 9000 });
    await expect(intro).toBeHidden();
  });
});

test('AC235: a click skips the intro; Quit returns to it; How to Play opens Rules with a Tutorial button', async ({ page }) => {
  await page.goto('/?test=1&intro=1');
  const intro = page.getByLabel('Intro', { exact: true });
  await expect(intro).toBeVisible();
  await page.waitForTimeout(500);
  await intro.click({ position: { x: 30, y: 30 } });
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible({ timeout: 3000 });
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tutorial', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Quit', exact: true }).click();
  await expect(intro).toBeVisible();
});

test('AC236: menu buttons go where the owner file says; the main menu picture is cover-fit', async ({ page }) => {
  await openTest(page);
  const bg = page.locator('[data-menu-bg]').first();
  await expect(bg).toBeVisible();
  const fit = await bg.evaluate((e) => { const s = getComputedStyle(e); return [s.objectFit, s.backgroundSize]; });
  expect(fit.some((v) => v === 'cover')).toBe(true);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Mulligan' })).toBeVisible();
});

test('AC237: menus play the music the owner file names (tense-cycle)', async ({ page }) => {
  await openTest(page);
  await page.mouse.click(5, 5);
  await expect.poll(async () => (await page.evaluate(async () => await window.oreheart.getAudioState())).music.track).toBe('tense-cycle');
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  expect((await page.evaluate(async () => await window.oreheart.getAudioState())).music.track).toBe('tense-cycle');
});

async function saveFactionDeck(page, name, commanderLabel) {
  await page.getByRole('button', { name: 'New Deck', exact: true }).click();
  await renameDeck(page, name);
  if (commanderLabel) await pickDeckCommander(page, commanderLabel);
  await page.getByRole('button', { name: 'Auto-fill', exact: true }).click();
  await saveDeck(page);
}

test('AC238: saved deck entries glow in their faction color; the deck name text is white (Round 15)', async ({ page }) => {
  await openDecks(page);
  await saveFactionDeck(page, 'Green Deck');
  const entry = page.getByLabel('My decks', { exact: true }).getByRole('button', { name: /^Green Deck/ });
  const st = await entry.evaluate((e) => {
    const all = [e, ...e.querySelectorAll('*')];
    const txt = all.find((n) => [...n.childNodes].some((c) => c.nodeType === 3 && /Green Deck/.test(c.textContent))) || e;
    const s = getComputedStyle(txt);
    const effects = all.map((n) => getComputedStyle(n)).flatMap((c) => [c.filter, c.boxShadow, c.textShadow, c.backgroundColor, c.backgroundImage, c.borderColor]).filter((v) => v && v !== 'none').join(' ');
    const glow = all.map((n) => getComputedStyle(n)).some((c) => (c.filter && c.filter.includes('drop-shadow')) || (c.boxShadow && c.boxShadow !== 'none') || (c.textShadow && c.textShadow !== 'none'));
    const green = (effects.match(/rgba?\([^)]*\)/g) || []).some((x) => { const [r, g, b, a = 1] = x.match(/[\d.]+/g).map(Number); return a > 0.05 && g > r + 20 && g > b + 20; });
    return { color: s.color, glow, green, faction: e.closest('[data-faction]')?.dataset.faction || e.querySelector('[data-faction]')?.dataset.faction || e.dataset.faction };
  });
  expect(st.faction).toBe('goblin');
  expect(st.color, 'deck name text is white (Round 15)').toBe('rgb(255, 255, 255)');
  expect(st.glow).toBe(true);
  expect(st.green, 'glow/tint uses the Goblin green').toBe(true);
});

test('AC239: every creature card close-up has a 3D viewer; spells do not', async ({ page }) => {
  await openDecks(page);
  await allCards(page).getByRole('button', { name: /Bowler Brawler/ }).first().click();
  const dlg = page.getByRole('dialog', { name: /Bowler Brawler/ });
  await expect(dlg).toBeVisible();
  const viewer = page.getByRole('region', { name: '3D model' });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Idle', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  await allCards(page).getByRole('button', { name: /Venom Shiv/ }).first().click();
  await expect(page.getByRole('dialog', { name: /Venom Shiv/ })).toBeVisible();
  await expect(page.getByRole('region', { name: '3D model' })).toHaveCount(0);
});

test('AC240: Play action in the Deck Builder (disabled with a reason while illegal); double-click a saved deck starts a match', async ({ page }) => {
  await openDecks(page);
  await page.getByRole('button', { name: 'New Deck', exact: true }).click();
  const play = page.getByRole('button', { name: 'Play', exact: true });
  await expect(play).toBeVisible();
  await expect(play).toBeDisabled();
  await expect(page.getByText(/not legal|needs|at least 50/i).first()).toBeVisible();
  await page.getByRole('button', { name: 'Auto-fill', exact: true }).click();
  await expect(play).toBeEnabled();
  await renameDeck(page, 'Double Deck');
  await saveDeck(page);
  const entry = page.getByLabel('My decks', { exact: true }).getByRole('button', { name: /^Double Deck/ });
  await entry.click();
  await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
  await entry.dblclick();
  await expect(page.getByRole('dialog', { name: 'Mulligan' })).toBeVisible();
});

test('AC241: Deck Builder text colors: deck list lines and counts white, Back bold', async ({ page }) => {
  await openDecks(page);
  await page.getByRole('button', { name: 'Auto-fill', exact: true }).click();
  const white = async (loc, what) => {
    const c = await loc.evaluate((e) => {
      const n = [...e.querySelectorAll('*')].find((x) => [...x.childNodes].some((t) => t.nodeType === 3 && t.textContent.trim())) || e;
      return getComputedStyle(n).color;
    });
    expect(c, what).toBe('rgb(255, 255, 255)');
  };
  await white(deckList(page).getByText(/\d+ × /).first(), 'deck list line');
  await white(page.getByLabel('Deck counts', { exact: true }), 'deck counts');
  const w = await page.getByRole('button', { name: 'Back', exact: true }).evaluate((e) => parseInt(getComputedStyle(e).fontWeight, 10));
  expect(w).toBeGreaterThanOrEqual(700);
});

for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`round 9c screenshots ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });
    test(`AC242: screenshots of the match with the arena, Commander close-ups, every menu screen and a creature close-up (${W}x${H})`, async ({ page }, testInfo) => {
      test.setTimeout(120000);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = async (name) => testInfo.attach(`r9c-${name}-${W}x${H}`, { body: await page.screenshot(), contentType: 'image/png' });
      await page.goto('/?test=1&intro=1');
      await page.waitForTimeout(3600);
      await shot('intro');
      await page.getByLabel('Intro', { exact: true }).click({ position: { x: 30, y: 30 } });
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
      await page.waitForTimeout(1500);
      await shot('main-menu');
      await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
      await page.waitForTimeout(1200);
      await shot('deck-builder');
      await allCards(page).getByRole('button', { name: /Bowler Brawler/ }).first().click();
      await page.waitForTimeout(1500);
      await shot('deck-builder-closeup');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.waitForTimeout(1200);
      await shot('choose-commander');
      await newMatch(page, quiet({}));
      await expect.poll(async () => (await arenaInfo(page)).drawn, { timeout: 15000 }).toBe(true);
      await page.waitForTimeout(2000);
      await shot('match-at-rest');
      for (const side of ['player', 'enemy']) {
        await page.evaluate(async (s) => await window.oreheart.focusCommander(s), side);
        await page.waitForTimeout(1200);
        await shot(`commander-${side}`);
      }
      await page.evaluate(async () => await window.oreheart.playEmote('player', 'laugh'));
      await page.evaluate(async () => await window.oreheart.focusCommander('player'));
      await page.waitForTimeout(700);
      await shot('commander-player-emote');
      expect(errors).toEqual([]);
    });
  });
}

// ================= Round 10 =================
const R10_GOBLIN = '#3ee06a';
const R10_GNOME = '#9b4dff';
const isRed = (hex) => { const n = parseInt(hex.slice(1), 16); return (n >> 16) >= 200 && ((n >> 8) & 255) <= 90 && (n & 255) <= 90; };
const renderStats10 = (page) => page.evaluate(async () => await window.oreheart.getRenderStats());
const inBox = (p, b, pad = 2) => p.x >= b.x - pad && p.x <= b.x + b.width + pad && p.y >= b.y - pad && p.y <= b.y + b.height + pad;

test.describe('round 10 at 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('AC243: drag highlights are bright in the faction color; attack squares are red', async ({ page }) => {
    // summon drag, Goblin player
    await start(page, quiet({ playerHand: ['goblin-scrapper'], playerCrystals: 5 }));
    await page.waitForTimeout(1000);
    const hand = page.getByLabel('Your hand', { exact: true }).getByRole('button').first();
    let card = await hand.boundingBox();
    let t = await sq2s(page, 7, 6);
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.08);
    await page.mouse.down();
    await page.mouse.move(t.x, t.y - 40, { steps: 15 });
    await page.waitForTimeout(300);
    let hl = (await arenaInfo(page)).highlights;
    expect(hl.filter((h) => h.kind === 'summon').length).toBeGreaterThan(0);
    for (const h of hl) {
      expect(h.color.toLowerCase()).toBe(R10_GOBLIN);
      expect(h.glow).toBe(true);
      // Round 11: light from the ground — bright edges, mostly transparent center
      expect(h.style).toBe('edge-glow');
      expect(h.edgeAlpha).toBeGreaterThanOrEqual(0.6);
      expect(h.centerAlpha).toBeLessThanOrEqual(0.35);
      expect(h.centerAlpha).toBeLessThan(h.edgeAlpha);
    }
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.08, { steps: 10 });
    await page.mouse.up();

    // creature drag next to an enemy: move squares in faction color, attack square red
    await newMatch(page, quiet({ board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 9 },
      { cardId: 'gnome-tinker', owner: 'opponent', row: 4, col: 10 },
    ] }));
    await done(page);
    await page.waitForTimeout(800);
    const lbl = await page.getByLabel('Bowler Brawler, row 5, column 9', { exact: true }).boundingBox();
    const from = await sq2s(page, 5, 9);
    const start0 = lbl ? { x: lbl.x + lbl.width / 2, y: lbl.y + lbl.height / 2 } : from;
    t = await sq2s(page, 5, 8);
    await page.mouse.move(start0.x, start0.y);
    await page.mouse.down();
    await page.mouse.move(t.x, t.y, { steps: 15 });
    await page.waitForTimeout(300);
    hl = (await arenaInfo(page)).highlights;
    const moves = hl.filter((h) => h.kind === 'move');
    const attacks = hl.filter((h) => h.kind === 'attack');
    expect(moves.length).toBeGreaterThan(0);
    for (const h of moves) expect(h.color.toLowerCase()).toBe(R10_GOBLIN);
    expect(attacks.some((h) => h.row === 4 && h.col === 10)).toBe(true);
    for (const h of attacks) { expect(isRed(h.color)).toBe(true); expect(h.style).toBe('edge-glow'); expect(h.centerAlpha).toBeLessThan(h.edgeAlpha); }
    await page.mouse.move(start0.x, start0.y, { steps: 5 });
    await page.mouse.up();

    // Gnome player: faction main color
    await newMatch(page, { ai: false, playerCommander: 'sproingle', opponentCommander: 'grubnak', setup: { opponentHand: [], playerHand: ['gnome-tinker'], playerCrystals: 5 } });
    await page.waitForTimeout(1000);
    card = await hand.boundingBox();
    t = await sq2s(page, 7, 6);
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.08);
    await page.mouse.down();
    await page.mouse.move(t.x, t.y - 40, { steps: 15 });
    await page.waitForTimeout(300);
    hl = (await arenaInfo(page)).highlights;
    expect(hl.length).toBeGreaterThan(0);
    for (const h of hl) expect(h.color.toLowerCase()).toBe(R10_GNOME);
    await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.08, { steps: 10 });
    await page.mouse.up();
  });

  test('AC244: only the opponent\'s played cards pop up, big in the middle, then onto the enemy discard pile at the left (owner, Oct 30)', async ({ page }) => {
    const W = 1920, H = 1080;
    await page.goto('/?test=1&seed=123&fx=1');
    await page.waitForFunction(() => !!window.oreheart);
    let s = await newMatch(page, { ...quiet({ playerHand: ['soul-shard', 'soul-shard'] }), firstPlayer: 'player' });
    for (const c of s.players.player.hand) expect((await act(page, { type: 'playCrystal', uid: c.uid })).ok).toBe(true);
    const mine = page.locator('[aria-label="Card reveal"][data-side="player"]');
    const visibleMine = () => mine.evaluateAll((els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length);
    await page.waitForTimeout(800);
    expect(await visibleMine()).toBe(0);
    s = await newMatch(page, { ...quiet({ opponentHand: ['soul-shard'] }), firstPlayer: 'opponent' });
    expect(s.activePlayer).toBe('opponent');
    expect((await act(page, { type: 'playCrystal', uid: s.players.opponent.hand[0].uid })).ok).toBe(true);
    const theirs = page.locator('[aria-label="Card reveal"][data-side="opponent"]').first();
    await expect(theirs).toBeVisible();
    // owner check change (Ken, Oct 30): the computer's card pops up big in the middle, then is laid down on the enemy discard pile at the left
    await page.waitForTimeout(350); // after the quick pop-in
    const b = await theirs.boundingBox();
    expect(Math.abs(b.x + b.width / 2 - W / 2)).toBeLessThanOrEqual(W * 0.05);
    expect(b.height).toBeGreaterThanOrEqual(H * 0.85);
    await expect(theirs).toHaveCount(0, { timeout: 6000 });
    const pile = page.getByRole('button', { name: 'Enemy discard pile', exact: true });
    const pb = await pile.boundingBox();
    expect(pb.x).toBeGreaterThanOrEqual(0); expect(pb.x).toBeLessThanOrEqual(W * 0.06);
    await expect(pile).toHaveAttribute('data-top', 'soul-shard');
  });

  test('AC246: the mine click area is only its own square; clicking inside it mines (Round 11)', async ({ page }) => {
    await mineAllSetup(page);
    await done(page);
    await page.waitForTimeout(1000);
    for (const m of OLD_MINES) {
      const btn = await siteBtn(page, m).boundingBox();
      const q = await page.evaluate(async ([r, c]) => await window.oreheart.squareQuad(r, c), [m.row, m.col]);
      expect(q.length).toBe(4);
      const xs = q.map((p) => p.x), ys = q.map((p) => p.y);
      expect(btn.x).toBeGreaterThanOrEqual(Math.min(...xs) - 3);
      expect(btn.y).toBeGreaterThanOrEqual(Math.min(...ys) - 3);
      expect(btn.x + btn.width).toBeLessThanOrEqual(Math.max(...xs) + 3);
      expect(btn.y + btn.height).toBeLessThanOrEqual(Math.max(...ys) + 3);
    }
    const c = await sq2s(page, M1.row, M1.col);
    await page.mouse.click(c.x, c.y);
    await expect.poll(async () => at(await getState(page), 3, 1).hasMined).toBe(true);
  });

  test('AC249: Crystal Flow streams end at the Flow crystal counters in faction colors', async ({ page }) => {
    await start(page, { ...quiet({ board: [
      { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 },
      { cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 6, minedMine: M3 },
    ] }), firstPlayer: 'player' });
    const streams = () => page.evaluate(async () => await window.oreheart.getFlowStreams());
    await passTurn(page);
    await passTurn(page);
    await expect.poll(async () => (await streams()).log.filter((x) => x.side === 'player').length).toBeGreaterThanOrEqual(1);
    const log = (await streams()).log;
    const p = log.find((x) => x.side === 'player');
    expect(p.to).toBe('player-flow-crystal');
    expect(p.colors[0].toLowerCase()).toBe(R10_GOBLIN);
    expect(p.colors.map((c) => c.toLowerCase())).toContain('#b45cff');
    const pc = await page.getByLabel('Your crystal', { exact: true }).boundingBox();
    expect(inBox(p.toScreen, pc, 4)).toBe(true);
    const o = log.find((x) => x.side === 'opponent');
    expect(o.to).toBe('enemy-flow-crystal');
    expect(o.colors[0].toLowerCase()).toBe('#2f5fd8'); // Borgo = Dwarves
    const ec = await page.getByLabel('Enemy crystal', { exact: true }).boundingBox();
    expect(inBox(o.toScreen, ec, 4)).toBe(true);
  });

  test('AC250: card close-up fills 80–100 % of the height, no scrollbar, a ✕ Close (owner, Oct 30); outside click and Esc close it', async ({ page }) => {
    const H = 1080;
    await start(page, quiet({ playerHand: ['fireball'], board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 5 }] }));
    await page.waitForTimeout(800);
    const check = async (dlg, id) => {
      await expect(dlg).toBeVisible();
      const face = await dlg.locator(`[data-card-id="${id}"]`).first().boundingBox();
      expect(face.height / H).toBeGreaterThanOrEqual(0.8); expect(face.height / H).toBeLessThanOrEqual(1.0);
      expect(face.y).toBeGreaterThanOrEqual(0); expect(face.y + face.height).toBeLessThanOrEqual(H + 1);
      await expect(dlg.getByRole('button', { name: 'Close' })).toHaveCount(1); // owner check change (Ken, Oct 30: ✕ Close on the card view)
      const scroll = await dlg.evaluate((d) => [d, ...d.querySelectorAll('*')].filter((e) => e.clientHeight > 0 && e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY)).length);
      expect(scroll).toBe(0);
      return face;
    };
    await page.getByLabel('Bowler Brawler, row 6, column 5', { exact: true }).click({ button: 'right' }); // owner, Oct 25
    const dlg = page.getByRole('dialog', { name: 'Bowler Brawler', exact: true });
    const face = await check(dlg, 'goblin-scrapper');
    await page.mouse.click(face.x > 40 ? 15 : 1905, H / 2);
    await expect(dlg).toBeHidden();
    await page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Searing Arcane Orb', exact: true }).click();
    const v = page.getByRole('dialog', { name: 'Searing Arcane Orb' });
    await check(v, 'fireball');
    await expect(v.getByRole('button', { name: 'Cast this spell', exact: true })).toBeVisible(); // owner, Oct 25
    await page.keyboard.press('Escape');
    await expect(v).toBeHidden();
  });

  test('AC251: the resting hand is fully on screen (Round 17); hovering raises it', async ({ page }) => {
    const H = 1080;
    await start(page, R9_MATCH());
    await page.mouse.move(960, 300);
    await page.waitForTimeout(1500);
    const cards = page.getByLabel('Your hand', { exact: true }).getByRole('button');
    const n = await cards.count();
    expect(n).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < n; i++) {
      const b = await cards.nth(i).boundingBox();
      expect(await restTuckedOk(page, b, H), 'Ken, Oct 30: rests tucked below the home row, top showing').toBe(true);
    }
    const b = await cards.nth(Math.floor(n / 2)).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + 6, { steps: 4 });
    await expect.poll(async () => { const c = await cards.nth(0).boundingBox(); return (H - c.y) / c.height; }, { timeout: 4000 }).toBeGreaterThanOrEqual(0.95);
    await page.mouse.move(960, 300, { steps: 4 });
    await expect.poll(async () => restTuckedOk(page, await cards.nth(0).boundingBox(), H), { timeout: 4000 }).toBe(true); // Ken, Oct 30: back to the tucked rest
  });

  test('AC256: Round 10 screenshots render without errors', async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const shot = async (name) => testInfo.attach(`r10-${name}-1920x1080`, { body: await page.screenshot(), contentType: 'image/png' });
    await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'soul-shard'], playerCrystals: 8, board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 9 },
      { cardId: 'gnome-tinker', owner: 'opponent', row: 4, col: 10 },
      { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 },
    ] }));
    await page.mouse.move(960, 300);
    await page.waitForTimeout(1500);
    await shot('hand-at-rest');
    const card = await page.getByLabel('Your hand', { exact: true }).getByRole('button').first().boundingBox();
    await page.mouse.move(card.x + card.width / 2, card.y + 6, { steps: 4 });
    await page.waitForTimeout(800);
    await shot('hand-raised');
    await page.mouse.move(960, 300);
    await done(page);
    const lbl = await page.getByLabel('Bowler Brawler, row 5, column 9', { exact: true }).boundingBox();
    const t = await sq2s(page, 5, 8);
    await page.mouse.move(lbl.x + lbl.width / 2, lbl.y + lbl.height / 2);
    await page.mouse.down();
    await page.mouse.move(t.x, t.y, { steps: 12 });
    await page.waitForTimeout(300);
    await shot('drag-highlights');
    await page.mouse.move(lbl.x + lbl.width / 2, lbl.y + lbl.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.getByLabel('Bowler Brawler, row 5, column 9', { exact: true }).click();
    await page.waitForTimeout(500);
    await shot('close-up');
    await page.keyboard.press('Escape');
    await page.goto('/?test=1&seed=123&fx=1');
    await page.waitForFunction(() => !!window.oreheart);
    const s = await newMatch(page, { ...quiet({ playerHand: ['soul-shard', 'soul-shard'], board: [{ cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 }] }), firstPlayer: 'player' });
    for (const c of s.players.player.hand) await act(page, { type: 'playCrystal', uid: c.uid });
    await page.waitForTimeout(400);
    await shot('played-card-stack');
    await passTurn(page);
    await page.waitForTimeout(600);
    await shot('enemy-pop-up-and-flow');
    await passTurn(page);
    await page.waitForTimeout(600);
    await shot('flow-stream');
    expect(errors).toEqual([]);
  });
});

test('AC245: random mines may touch; every layout keeps the placement rules', async ({ page }) => {
  test.setTimeout(600000); // Round 11: 200 seeded matches need more than the default timeout
  await openTest(page);
  const cheb = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  let touching = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = await newMatch(page, { ai: false, seed, skipMulligan: true });
    const m = s.sites;
    expect(m.length).toBe(3);
    for (const a of m) {
      expect(a.row >= 3 && a.row <= 5, `seed ${seed}`).toBe(true);
      expect(m.some((b) => b.row === 8 - a.row && b.col === 14 - a.col), `mirror, seed ${seed}`).toBe(true);
      expect(cheb(a, s.strongholds.player)).toBeGreaterThanOrEqual(2);
      expect(cheb(a, s.strongholds.opponent)).toBeGreaterThanOrEqual(2);
    }
    let t = false;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      expect(cheb(m[i], m[j]), `distinct squares, seed ${seed}`).toBeGreaterThanOrEqual(1);
      if (cheb(m[i], m[j]) === 1) t = true;
    }
    if (t) touching++;
  }
  expect(touching, 'some layouts have touching mines').toBeGreaterThanOrEqual(1);
});

test('AC247: a basic Miner dying draws its owner a card; Smith Miners and upgrades do not', async ({ page }) => {
  // basic Miner killed in combat
  let s = await start(page, quiet({ playerDeck: SHARDS, opponentDeck: SHARDS, board: [
    { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 5 },
    { cardId: 'gnome-prospector', owner: 'opponent', row: 4, col: 5 }, // Gemsinger Miner (basic Miner)
  ] }));
  await done(page);
  s = await getState(page);
  let hand0 = s.players.opponent.hand.length, deck0 = s.players.opponent.deck.length;
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 5).uid, target: { row: 4, col: 5 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 5)).toBeFalsy();
  expect(s.players.opponent.hand.length).toBe(hand0 + 1);
  expect(s.players.opponent.deck.length).toBe(deck0 - 1);

  // Smith Miner killed: no draw (Round 12c: Arcsmith; Scrapsmith's own text now draws, AC290)
  s = await newMatch(page, quiet({ playerDeck: SHARDS, opponentDeck: SHARDS, board: [
    { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 5 },
    { cardId: 'gnome-smith-miner', owner: 'opponent', row: 4, col: 5 },
  ] }));
  await done(page);
  s = await getState(page);
  hand0 = s.players.opponent.hand.length; deck0 = s.players.opponent.deck.length;
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 5).uid, target: { row: 4, col: 5 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 5)).toBeFalsy();
  expect(s.players.opponent.hand.length).toBe(hand0);
  expect(s.players.opponent.deck.length).toBe(deck0);

  // basic Miner used as an upgrade: no draw
  s = await newMatch(page, quiet({ playerHand: ['goblin-scrounger'], playerCrystals: 5, playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 5 }] }));
  const deckP = s.players.player.deck.length;
  expect((await act(page, { type: 'minerUpgrade', uid: s.players.player.hand[0].uid, creatureUid: at(s, 6, 5).uid })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.hand.length).toBe(0);
  expect(s.players.player.deck.length).toBe(deckP);
});

test('AC248: Ranged straight lines also apply to previewAttack and the Commander', async ({ page }) => {
  let s = await start(page, quiet({ board: [
    { cardId: 'goblin-slinger', owner: 'player', row: 6, col: 12 }, // 5 straight below (in range 7) the enemy Stronghold (1,12)
    { cardId: 'goblin-slinger', owner: 'player', row: 3, col: 10 }, // diagonal 2 to (1,12), (2,11) empty
    { cardId: 'goblin-slinger', owner: 'player', row: 4, col: 10 }, // (1,12) is off-line
  ] }));
  await done(page);
  const acts = (await legal(page)).filter((a) => a.type === 'attack' && a.target && a.target.commander === 'opponent');
  const can = (r, c) => acts.some((a) => a.creatureUid === at(s, r, c).uid);
  expect(can(6, 12)).toBe(true);
  expect(can(3, 10)).toBe(true);
  expect(can(4, 10)).toBe(false);
  const h0 = s.players.opponent.health;
  expect((await act(page, { type: 'attack', creatureUid: at(s, 6, 12).uid, target: { commander: 'opponent' } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.opponent.health).toBe(h0 - 1);
  const ranged = await page.evaluate(async () => await window.oreheart.getCard('goblin-slinger'));
  expect(ranged.longText).toMatch(/\b6\b/); // owner text: Skullflinger range 6
});

test('AC252: mines have no ring, a flat glow-rubble decal that stays white (owner, Oct 24: the ground never changes color), and sit level at equal height', async ({ page }) => {
  await start(page, quiet({ board: [{ cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 }] }));
  await page.waitForTimeout(800);
  const r = await renderStats10(page);
  if (!r.webgl) test.skip(true, 'WebGL unavailable');
  const poses = await page.evaluate(async () => await window.oreheart.getPiecePoses());
  expect(r.mineModels).toHaveLength(3);
  const h0 = r.mineModels[0].height;
  for (const m of r.mineModels) {
    expect(m.ring).toBe(false);
    expect(m.decal.kind).toBe('glow-rubble');
    expect(m.decal.flat).toBe(true);
    expect(m.tiltDeg).toBeLessThanOrEqual(0.5);
    expect(Math.abs(m.baseY - poses.boardY)).toBeLessThanOrEqual(0.02 * poses.square);
    expect(Math.abs(m.height - h0)).toBeLessThanOrEqual(0.01);
  }
  const owned = r.mineModels.find((m) => m.owner === 'player');
  expect(owned.decal.color.toLowerCase()).toBe('#ffffff');
  await expect(page.getByLabel(`Mine flow, row ${M1.row}, column ${M1.col}`, { exact: true })).toHaveCount(1);
});

test('AC253: several Crystal cards in one turn, in Deploy and Action, never ending the phase', async ({ page }) => {
  let s = await start(page, quiet({ playerHand: ['soul-shard', 'soul-shard', 'soul-shard', 'soul-shard'], playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 5 }] }));
  const uids = s.players.player.hand.map((c) => c.uid);
  expect((await act(page, { type: 'playCrystal', uid: uids[0] })).ok).toBe(true);
  expect((await act(page, { type: 'playCrystal', uid: uids[1] })).ok).toBe(true);
  s = await getState(page);
  expect(s.phase).toBe('deploy');
  await done(page);
  expect((await act(page, { type: 'playCrystal', uid: uids[2] })).ok).toBe(true);
  expect((await act(page, { type: 'playCrystal', uid: uids[3] })).ok).toBe(true);
  s = await getState(page);
  expect(s.phase).toBe('action');
  expect(s.activePlayer).toBe('player');
  expect(s.players.player.bank).toBe(4);
  const card = await page.evaluate(async () => await window.oreheart.getCard('soul-shard'));
  expect(`${card.shortText} ${card.longText}`.toLowerCase()).not.toMatch(/(once|one) per (round|turn)/);
});

// Owner check change (Ken, Oct 31: Tunnel only beside a mine your side owns): each side first owns a mine (a creature that mined it)
test('AC254: Tunnel — drag-and-drop next to an owned mine works and the AI uses the same rule', async ({ page }) => {
  let s = await start(page, quiet({ playerHand: ['goblin-scrounger'], playerCrystals: 5, board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 3, col: 7, minedMine: M3 }] }));
  expect(s.sites.find((x) => x.row === M3.row && x.col === M3.col).controller).toBe('player');
  await page.waitForTimeout(1000);
  // owner check change (Ken, Oct 31): "Remove all those special ability ... overlays" -- the card shows no Tunnel! tag any more
  await expect(page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Goblin Miner', exact: true })).not.toContainText('Tunnel!');
  const card = await page.getByLabel('Your hand', { exact: true }).getByRole('button').first().boundingBox();
  const t = await sq2s(page, 5, 5); // next to M2 (4,4) and M3 (4,6)
  await page.mouse.move(card.x + card.width / 2, card.y + card.height * 0.08);
  await page.mouse.down();
  await page.mouse.move(t.x, t.y, { steps: 15 });
  await page.mouse.up();
  await expect.poll(async () => at(await getState(page), 5, 5)?.cardId).toBe('goblin-scrounger');
  // opponent side: summon next to a mine it owns, on its turn 1; beside a mine it doesn't own is refused
  s = await newMatch(page, { ...quiet({ opponentHand: ['dwarf-miner'], opponentCrystals: 5, board: [{ cardId: 'goblin-scrapper', owner: 'opponent', row: 5, col: 4, minedMine: M2 }] }), firstPlayer: 'opponent' });
  expect(s.sites.find((x) => x.row === M2.row && x.col === M2.col).controller).toBe('opponent');
  expect((await act(page, { type: 'summon', uid: s.players.opponent.hand[0].uid, row: 3, col: 7 })).ok).toBe(false); // beside M3 (neutral)
  expect((await act(page, { type: 'summon', uid: s.players.opponent.hand[0].uid, row: 3, col: 4 })).ok).toBe(true);
});


// ================= Round 11 =================
const audioState = (page) => page.evaluate(async () => await window.oreheart.getAudioState());
const shownFrac = (b, H) => (H - b.y) / b.height;
async function raiseHandAt(page, card) {
  const H = page.viewportSize().height;
  let a = await card.boundingBox();
  await page.mouse.move(a.x + a.width / 2, Math.min(a.y + a.height * 0.08, H - 3), { steps: 3 });
  await page.waitForTimeout(600);
  a = await card.boundingBox();
  return { x: a.x + a.width / 2, y: Math.min(a.y + a.height * 0.15, H - 3) };
}
const handNamesInOrder = async (page) => {
  const btns = page.getByLabel('Your hand', { exact: true }).getByRole('button').filter({ has: page.locator('[data-card-id]') });
  const n = await btns.count(); const out = [];
  for (let i = 0; i < n; i++) {
    const b = btns.nth(i);
    out.push({ id: await b.locator('[data-card-id]').first().getAttribute('data-card-id'), x: (await b.boundingBox()).x });
  }
  return out.sort((p, q) => p.x - q.x).map((p) => p.id);
};

test.describe('round 11 at 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('AC257: "Click to begin" gate, then the intro crash sound and thunder actually play', async ({ page }) => {
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?test=1&intro=1&begin=1');
    const gate = page.getByLabel('Begin', { exact: true });
    await expect(gate).toBeVisible();
    await expect(gate.getByLabel('Oreheart deck', { exact: true })).toBeVisible(); // Round 13: card-back stack replaces the logo
    await expect(page.getByLabel('Intro', { exact: true })).toBeHidden();
    expect((await audioState(page)).unlocked).toBe(false);
    await page.getByRole('button', { name: 'Click to begin', exact: true }).click();
    await expect(page.getByLabel('Intro', { exact: true })).toBeVisible();
    expect((await audioState(page)).unlocked).toBe(true);
    await expect.poll(async () => {
      const log = (await audioState(page)).sfxLog || [];
      return ['snd:qoqhrj', 'thunder'].every((n) => log.some((e) => e.name === n && e.played === true));
    }, { timeout: 8000 }).toBe(true);
    const a = await audioState(page);
    expect(a.music.track).toBe('tense-cycle');
    expect(a.music.playing).toBe(true);
    expect(errors).toEqual([]);
  });

  test('AC258: Tense Cycle plays continuously through every menu and only changes when a match starts', async ({ page }) => {
    await page.goto('/?test=1&intro=1&begin=1');
    await page.getByRole('button', { name: 'Click to begin', exact: true }).click();
    await skipIntro(page);
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    const check = async () => {
      const a = await audioState(page);
      expect(a.music.track).toBe('tense-cycle');
      expect(a.music.playing).toBe(true);
      expect(a.music.startCount).toBe(1);
    };
    await check();
    await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
    await check();
    await page.getByRole('button', { name: 'Back', exact: true }).first().click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await check();
    await page.getByRole('button', { name: 'Back', exact: true }).first().click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Choose Your Commander' })).toBeVisible();
    await check();
    await page.getByRole('button', { name: 'Fight!', exact: true }).click();
    await expect.poll(async () => (await audioState(page)).music.track, { timeout: 10000 }).toBe('first-fight');
  });

  test('AC259: main menu button words are white, bold and styled as in menus.json', async ({ page }) => {
    await openMenu(page);
    const italic = { 'Play': false, 'Deck Builder': true, 'How to Play': true, 'Settings': true, 'Quit': true };
    const sizes = [];
    for (const [name, it] of Object.entries(italic)) {
      const btn = page.getByRole('button', { name, exact: true });
      await expect(btn).toBeVisible();
      const st = await btn.evaluate((el) => {
        const all = [el, ...el.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
        const t = all[0] || el; const cs = getComputedStyle(t);
        return { color: cs.color, weight: parseInt(cs.fontWeight), style: cs.fontStyle, size: parseFloat(cs.fontSize) };
      });
      expect(st.color, name).toBe('rgb(255, 255, 255)');
      expect(st.weight, name).toBeGreaterThanOrEqual(700);
      expect(st.style === 'italic' || st.style.startsWith('oblique'), name).toBe(it);
      sizes.push(st.size);
    }
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  test('AC260: Settings "Square highlights" panel: defaults, live preview, saved, applied in a match, Reset to default', async ({ page }) => {
    await openTest(page); // window.oreheart exists only with ?test=1 (R17.3)
    let hs = await page.evaluate(async () => await window.oreheart.getHighlightSettings());
    expect(hs.edgeColor).toBeNull(); // null = faction default
    expect(isRed(hs.attackColor)).toBe(true);
    await openMenu(page);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Square highlights' });
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel('Highlight preview', { exact: true })).toBeVisible();
    for (const l of ['Edge color', 'Glow color', 'Attack color', 'Strength', 'Glow size', 'Edge thickness', 'Inner fill', 'Pulse', 'Pulse speed']) {
      await expect(panel.getByLabel(l, { exact: true }), l).toBeVisible();
    }
    await panel.getByLabel('Edge color', { exact: true }).fill('#123456');
    await panel.getByLabel('Inner fill', { exact: true }).fill('0');
    await openTest(page);
    hs = await page.evaluate(async () => await window.oreheart.getHighlightSettings());
    expect(hs.edgeColor).toBe('#123456');
    expect(hs.fill).toBe(0);
    await start(page, quiet({ playerHand: ['goblin-scrapper'], playerCrystals: 5 }));
    await page.waitForTimeout(800);
    const card = page.getByLabel('Your hand', { exact: true }).getByRole('button').first();
    const p = await raiseHandAt(page, card);
    const t = await sq2s(page, 7, 6);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(t.x, t.y - 40, { steps: 15 });
    await page.waitForTimeout(300);
    const hl = (await arenaInfo(page)).highlights;
    expect(hl.length).toBeGreaterThan(0);
    for (const h of hl) { expect(h.color.toLowerCase()).toBe('#123456'); expect(h.centerAlpha).toBeLessThanOrEqual(0.05); }
    await page.mouse.move(p.x, p.y, { steps: 8 });
    await page.mouse.up();
    await openMenu(page);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('region', { name: 'Square highlights' }).getByRole('button', { name: 'Reset to default', exact: true }).click();
    await openTest(page);
    hs = await page.evaluate(async () => await window.oreheart.getHighlightSettings());
    expect(hs.edgeColor).toBeNull();
    expect(hs.fill).toBeGreaterThan(0);
  });

  test('AC261: unit rings use faction colors, grey out after acting; "Unit rings" settings are saved and applied', async ({ page }) => {
    await start(page, quiet({ board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 6 },
      { cardId: 'dwarf-miner', owner: 'opponent', row: 2, col: 6 },
    ] }));
    let r = await renderStats10(page);
    if (!r.webgl) test.skip(true, 'WebGL unavailable');
    const s = await getState(page);
    const ring = (rr, uid) => rr.unitRings.find((x) => x.uid === uid);
    const mineU = at(s, 6, 6).uid, theirs = at(s, 2, 6).uid;
    expect(ring(r, mineU).color.toLowerCase()).toBe('#3ee06a');
    expect(ring(r, mineU).greyed).toBe(false);
    expect(ring(r, theirs).color.toLowerCase()).toBe('#2f5fd8'); // Borgo: Dwarf main
    await done(page);
    expect((await act(page, { type: 'move', creatureUid: mineU, row: 5, col: 6 })).ok).toBe(true);
    await expect.poll(async () => ring(await renderStats10(page), mineU).greyed).toBe(true);
    expect(ring(await renderStats10(page), mineU).color.toLowerCase()).not.toBe('#3ee06a');
    // settings panel
    await openMenu(page);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Unit rings' });
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel('Ring preview', { exact: true })).toBeVisible();
    for (const l of ['My ring color', 'Enemy ring color', 'Moved color', 'Grey amount', 'Ring thickness', 'Ring glow', 'Ring opacity']) {
      await expect(panel.getByLabel(l, { exact: true }), l).toBeVisible();
    }
    await panel.getByLabel('My ring color', { exact: true }).fill('#abcdef');
    await openTest(page);
    expect((await page.evaluate(async () => await window.oreheart.getRingSettings())).myColor).toBe('#abcdef');
    await start(page, quiet({ board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 6 }] }));
    r = await renderStats10(page);
    expect(r.unitRings[0].color.toLowerCase()).toBe('#abcdef');
    await openMenu(page);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('region', { name: 'Unit rings' }).getByRole('button', { name: 'Reset to default', exact: true }).click();
    await openTest(page);
    expect((await page.evaluate(async () => await window.oreheart.getRingSettings())).myColor).toBeNull();
  });

  test('AC262: a creature standing behind a mine can be selected by clicking it; the mine square still mines', async ({ page }) => {
    await start(page, quiet({ playerDeck: SHARDS, opponentDeck: SHARDS, board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: M2.row - 1, col: M2.col }, // behind the mine, on screen above it
      { cardId: 'goblin-scrounger', owner: 'player', row: M2.row + 1, col: M2.col },
    ] }));
    await done(page);
    await page.waitForTimeout(1000);
    let s = await getState(page);
    const behind = at(s, M2.row - 1, M2.col).uid;
    // owner check change (Ken via Forge, Oct 31): units are 3x and the mine's pickaxe badge is drawn over the square behind the mine.
    // The unit wins where its body is tapped; the pickaxe picture itself still mines (AC421). So click the unit's body, above the pickaxe.
    let sb = null;
    await expect.poll(async () => { sb = ((await renderStats(page)).figures.find((f) => f.row === M2.row - 1 && f.col === M2.col) || {}).screenBox; return sb ? sb.height : 0; }, { timeout: 15000 }).toBeGreaterThan(20);
    const pkTop = await page.locator(`.site-mark[data-row="${M2.row}"][data-col="${M2.col}"] .pk-img`).evaluate((e) => e.getBoundingClientRect().top).catch(() => 1e9);
    const c = { x: sb.x + sb.width / 2, y: Math.min(sb.y + sb.height * 0.3, pkTop - 22) };
    await page.mouse.click(c.x, c.y);
    await expect.poll(async () => await page.evaluate(async () => await window.oreheart.getSelected())).toBe(behind);
    s = await getState(page);
    expect(at(s, M2.row + 1, M2.col).hasMined).toBeFalsy();
    await page.keyboard.press('Escape');
    const m = await sq2s(page, M2.row, M2.col);
    await page.mouse.click(m.x, m.y);
    await expect.poll(async () => at(await getState(page), M2.row + 1, M2.col).hasMined).toBe(true);
  });

  test('AC263: only the opponent\'s played cards pop up, one big card at a time, all laid on the enemy discard pile (owner, Oct 30)', async ({ page }) => {
    const W = 1920;
    await page.goto('/?test=1&seed=123&fx=1');
    await page.waitForFunction(() => !!window.oreheart);
    let s = await newMatch(page, { ...quiet({ playerHand: ['soul-shard'], opponentHand: ['soul-shard', 'soul-shard', 'soul-shard', 'soul-shard'] }), firstPlayer: 'opponent' });
    for (const c of s.players.opponent.hand) expect((await act(page, { type: 'playCrystal', uid: c.uid })).ok).toBe(true);
    const theirs = page.locator('[aria-label="Card reveal"][data-side="opponent"]');
    const vis = (loc) => loc.evaluateAll((els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => e.getBoundingClientRect().toJSON()));
    // owner check change (Ken, Oct 30): one big card in the middle at a time; each earlier one is laid down on the enemy discard pile
    const big = page.locator('[aria-label="Card reveal"][data-side="opponent"][data-stage="big"]');
    expect((await vis(big)).length).toBeLessThanOrEqual(1);
    for (const b of await vis(big)) expect(Math.abs(b.x + b.width / 2 - W / 2)).toBeLessThanOrEqual(W * 0.05);
    await expect.poll(async () => (await vis(theirs)).length, { timeout: 8000 }).toBe(0);
    await expect(page.getByRole('button', { name: 'Enemy discard pile', exact: true })).toHaveAttribute('data-count', '4');
    s = await newMatch(page, { ...quiet({ playerHand: ['soul-shard'] }), firstPlayer: 'player' });
    expect((await act(page, { type: 'playCrystal', uid: s.players.player.hand[0].uid })).ok).toBe(true);
    await page.waitForTimeout(800);
    expect((await vis(page.locator('[aria-label="Card reveal"]'))).length).toBe(0);
  });

  test('AC264: dragging a card sideways in the hand reorders it, the hand stays up, and the order is kept', async ({ page }) => {
    const H = 1080;
    await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'goblin-slinger', 'soul-shard'], playerCrystals: 0 }));
    await page.waitForTimeout(800);
    expect(await handNamesInOrder(page)).toEqual(['goblin-scrapper', 'fireball', 'goblin-slinger', 'soul-shard']);
    const hand = page.getByLabel('Your hand', { exact: true });
    const first = hand.getByRole('button', { name: 'Bowler Brawler', exact: true });
    const last = hand.getByRole('button', { name: 'Soul Shard', exact: true });
    const p = await raiseHandAt(page, first);
    const lb = await last.boundingBox();
    await page.mouse.down();
    await page.mouse.move(lb.x + lb.width * 0.8, p.y, { steps: 20 });
    await page.waitForTimeout(300);
    // reordering inside the hand: the other cards stay raised
    const sb = await hand.getByRole('button', { name: 'Skullflinger', exact: true }).boundingBox();
    expect(shownFrac(sb, H)).toBeGreaterThanOrEqual(0.6);
    await page.mouse.up();
    await expect.poll(() => handNamesInOrder(page)).toEqual(['fireball', 'goblin-slinger', 'soul-shard', 'goblin-scrapper']);
    let s = await getState(page);
    expect(s.phase).toBe('deploy');
    expect(s.players.player.hand.length).toBe(4); // nothing was played
    expect((await act(page, { type: 'playCrystal', uid: handUid(s, 'player', 'soul-shard') })).ok).toBe(true);
    await expect.poll(() => handNamesInOrder(page)).toEqual(['fireball', 'goblin-slinger', 'goblin-scrapper']);
  });

  test('AC265: dragging a card shows the real card face, floating and tilting; the hand tucks while over the board', async ({ page }) => {
    const H = 1080;
    await start(page, quiet({ playerHand: ['goblin-scrapper', 'goblin-slinger', 'fireball'], playerCrystals: 9 }));
    await page.waitForTimeout(800);
    const hand = page.getByLabel('Your hand', { exact: true });
    const card = hand.getByRole('button', { name: 'Bowler Brawler', exact: true });
    const p = await raiseHandAt(page, card);
    await page.mouse.down();
    const t = await sq2s(page, 4, 7);
    await page.mouse.move(t.x - 300, t.y, { steps: 10 });
    await page.mouse.move(t.x, t.y, { steps: 6 });
    const drag = page.getByLabel('Dragged card', { exact: true });
    await expect(drag).toBeVisible();
    await expect(drag.locator('[data-card-id="goblin-scrapper"]')).toHaveCount(1);
    await expect(drag).toContainText('Bowler Brawler');
    const tilt = parseFloat(await drag.getAttribute('data-tilt'));
    expect(Number.isFinite(tilt)).toBe(true);
    expect(Math.abs(tilt)).toBeLessThanOrEqual(8); // Round 26: gentle tilt ≤ 8° around the center
    // the rest of the hand tucks down while over the board
    await expect.poll(async () => shownFrac(await hand.getByRole('button', { name: 'Skullflinger', exact: true }).boundingBox(), H)).toBeLessThanOrEqual(0.32);
    await page.mouse.move(p.x, p.y, { steps: 10 });
    await page.mouse.up();
    await expect(drag).toBeHidden();
  });

  test('AC266: Ranged range 7 — the shot stops at the first unit, also your own', async ({ page }) => {
    // Marksmen Gunner has range 7 (Skullflinger is 6, owner Round 12c; AC286)
    let s = await start(page, { ...quiet({ board: [
      { cardId: 'deepforge-crossbowman', owner: 'player', row: 6, col: 1 },
      { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 4 }, // own unit in the line
      { cardId: 'dwarf-pickman', owner: 'opponent', row: 6, col: 7 }, // behind it: blocked
      { cardId: 'deepforge-crossbowman', owner: 'player', row: 7, col: 5 },
      { cardId: 'dwarf-pickman', owner: 'opponent', row: 7, col: 12 }, // exactly 7 away, clear
    ] }), factionLock: false });
    await done(page);
    const acts = (await legal(page)).filter((a) => a.type === 'attack');
    const can = (u, r, c) => acts.some((a) => a.creatureUid === u && sameTarget(a.target, r, c));
    expect(can(at(s, 6, 1).uid, 6, 7)).toBe(false);
    expect((await act(page, { type: 'attack', creatureUid: at(s, 6, 1).uid, target: { row: 6, col: 7 } })).ok).toBe(false);
    expect(can(at(s, 7, 5).uid, 7, 12)).toBe(true);
    const pv = await preview(page, at(s, 7, 5).uid, { row: 7, col: 12 });
    expect(pv.youDeal).toBeGreaterThanOrEqual(2); // Gunner Attack 2
    expect(pv.youTake).toBe(0);
    expect((await act(page, { type: 'attack', creatureUid: at(s, 7, 5).uid, target: { row: 7, col: 12 } })).ok).toBe(true);
    s = await getState(page);
    expect(at(s, 7, 12).health).toBe(at(s, 7, 12).maxHealth - pv.youDeal);
    expect(at(s, 7, 5).health).toBe(at(s, 7, 5).maxHealth); // no strike back
  });

  test('AC267: Round 11 screenshots render without errors', async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const shot = async (n) => testInfo.attach(n, { body: await page.screenshot(), contentType: 'image/png' });
    await page.goto('/?test=1&intro=1&begin=1');
    await expect(page.getByLabel('Begin', { exact: true })).toBeVisible();
    await shot('r11-begin');
    await page.getByRole('button', { name: 'Click to begin', exact: true }).click();
    await page.waitForTimeout(1500);
    await shot('r11-intro');
    await skipIntro(page);
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await shot('r11-main-menu');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Square highlights' })).toBeVisible();
    await shot('r11-settings-highlights');
    await page.getByRole('region', { name: 'Unit rings' }).scrollIntoViewIfNeeded();
    await shot('r11-settings-rings');
    await start(page, quiet({ playerHand: ['goblin-scrapper'], playerCrystals: 5 }));
    await page.waitForTimeout(800);
    const card = page.getByLabel('Your hand', { exact: true }).getByRole('button').first();
    const p = await raiseHandAt(page, card);
    const t = await sq2s(page, 7, 6);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(t.x, t.y - 40, { steps: 15 });
    await shot('r11-drag-highlights');
    await page.mouse.move(p.x, p.y, { steps: 8 });
    await page.mouse.up();
    expect(errors).toEqual([]);
  });
});

// ================= Round 12a =================
const homeRowBottom = (page) => page.evaluate(async () => {
  let y = -Infinity;
  for (let c = 1; c <= 13; c++) for (const p of await window.oreheart.squareQuad(7, c)) y = Math.max(y, p.y);
  return y;
});
const handButtons = (page) => page.getByLabel('Your hand', { exact: true }).getByRole('button').filter({ has: page.locator('[data-card-id]') });
// real mouse drag: press on the card, several moves, release at the target point
async function realDrag(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 10, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps });
  await page.waitForTimeout(150);
  await page.mouse.up();
}
const MINER_HAND = ['goblin-scrounger', 'goblin-scrapper', 'goblin-slinger', 'fireball', 'soul-shard'];

for (const vp of [{ width: 1920, height: 1080 }, { width: 1568, height: 782 }]) {
  test.describe(`round 12a drag-to-play at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test(`AC269: dragging Goblin Miner from the raised hand onto a legal home-row square summons it (${vp.width}x${vp.height})`, async ({ page }) => {
      let s = await start(page, quiet({ playerHand: MINER_HAND, playerCrystals: 9 }));
      await page.waitForTimeout(800);
      const uid = handUid(s, 'player', 'goblin-scrounger');
      const spot = (await legal(page)).find((a) => a.type === 'summon' && a.uid === uid && a.row === 7 && !at(s, a.row, a.col));
      expect(spot, 'a legal home-row summon').toBeTruthy();
      const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Goblin Miner', exact: true });
      const p = await raiseHandAt(page, card);
      const t = await sq2s(page, spot.row, spot.col);
      await page.mouse.down();
      await page.mouse.move(p.x, p.y - 12, { steps: 2 });
      await page.mouse.move(t.x, t.y, { steps: 14 });
      await expect(page.getByLabel('Dragged card', { exact: true })).toBeVisible();
      await expect.poll(async () => (await page.evaluate(async () => (await window.oreheart.getArena()).highlights))
        .some((h) => h.row === spot.row && h.col === spot.col)).toBe(true);
      await page.mouse.up();
      await expect.poll(async () => { const c = at(await getState(page), spot.row, spot.col); return c && c.cardId; }).toBe('goblin-scrounger');
      s = await getState(page);
      expect(s.players.player.hand.length).toBe(MINER_HAND.length - 1);
      expect(s.players.player.hand.some((c) => c.uid === uid)).toBe(false);
      await expect(page.getByLabel('Dragged card', { exact: true })).toBeHidden();
    });

    test(`AC270: a drag from the tucked hand also plays; a drop back in the hand or on an illegal square plays nothing (${vp.width}x${vp.height})`, async ({ page }) => {
      let s = await start(page, quiet({ playerHand: MINER_HAND, playerCrystals: 9 }));
      await page.waitForTimeout(800);
      const H = vp.height;
      const uid = handUid(s, 'player', 'goblin-scrapper');
      const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Bowler Brawler', exact: true });
      const b = await card.boundingBox();
      const from = { x: b.x + b.width / 2, y: Math.min(b.y + 8, H - 3) };
      // illegal: the enemy back row
      const bad = await sq2s(page, 1, 7);
      await realDrag(page, from, bad);
      await page.waitForTimeout(400);
      s = await getState(page);
      expect(s.players.player.hand.length).toBe(MINER_HAND.length);
      expect(s.board.creatures.filter((c) => c.owner === 'player').length).toBe(0);
      // back into the hand band
      const b2 = await card.boundingBox();
      await realDrag(page, { x: b2.x + b2.width / 2, y: Math.min(b2.y + 8, H - 3) }, { x: b2.x + b2.width / 2, y: H - 4 }, 6);
      await page.waitForTimeout(400);
      expect((await getState(page)).players.player.hand.length).toBe(MINER_HAND.length);
      // legal, started straight from the tucked strip (move the mouse away first so the hand is tucked)
      await page.mouse.move(vp.width / 2, vp.height * 0.3);
      await page.waitForTimeout(700);
      const spot = (await legal(page)).find((a) => a.type === 'summon' && a.uid === uid && a.row === 7);
      const t = await sq2s(page, spot.row, spot.col);
      const b3 = await card.boundingBox();
      await realDrag(page, { x: b3.x + b3.width / 2, y: Math.min(b3.y + 6, H - 2) }, t);
      await expect.poll(async () => { const c = at(await getState(page), spot.row, spot.col); return c && c.cardId; }).toBe('goblin-scrapper');
    });
  });
}

test.describe('round 12a at 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('AC271: dragging a targeted spell onto an enemy casts it there; a Crystal card dragged over the board is played', async ({ page }) => {
    let s = await start(page, quiet({ playerHand: ['fireball', 'soul-shard', 'goblin-scrapper'], playerCrystals: 9,
      board: [{ cardId: 'dwarf-stoneback', owner: 'opponent', row: 4, col: 7 }] }));
    await page.waitForTimeout(800);
    const hand = page.getByLabel('Your hand', { exact: true });
    const target = at(s, 4, 7);
    const fb = await hand.getByRole('button', { name: 'Searing Arcane Orb', exact: true }).boundingBox();
    await realDrag(page, { x: fb.x + fb.width / 2, y: Math.min(fb.y + 8, 1077) }, await sq2s(page, 4, 7));
    await expect.poll(async () => (await getState(page)).players.player.hand.some((c) => c.cardId === 'fireball')).toBe(false);
    s = await getState(page);
    const after = s.board.creatures.find((c) => c.uid === target.uid);
    expect(!after || after.health < target.health).toBe(true);
    const bank0 = s.players.player.bank;
    const cb = await hand.getByRole('button', { name: 'Soul Shard', exact: true }).boundingBox();
    await realDrag(page, { x: cb.x + cb.width / 2, y: Math.min(cb.y + 8, 1077) }, await sq2s(page, 4, 4));
    await expect.poll(async () => (await getState(page)).players.player.bank).toBe(bank0 + 1);
    expect((await getState(page)).players.player.hand.some((c) => c.cardId === 'soul-shard')).toBe(false);
  });

  test('AC273: owner card paintings and Grubnak\'s on-throne portrait are used unchanged', async ({ page, request }) => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const here = path.dirname((await import('node:url')).fileURLToPath(import.meta.url));
    const dirs = [path.resolve(here, '../../../factory-design/goblin-art'), path.resolve(process.cwd(), 'factory-design/goblin-art')];
    const ref = dirs.find((d) => fs.existsSync(path.join(d, 'grubnak-on-throne-art.png')));
    for (const f of [...Object.values(OWNER_CARD_ART), 'grubnak-on-throne-art.png']) {
      const res = await request.get(`/art/owner/goblin/${f}`);
      expect(res.ok(), f).toBe(true);
      if (ref) expect(Buffer.compare(await res.body(), fs.readFileSync(path.join(ref, f))), `${f} byte-identical`).toBe(0);
    }
    await openTest(page);
    for (const [id, f] of Object.entries(OWNER_CARD_ART)) {
      const info = await page.evaluate(async (x) => await window.oreheart.getArtInfo(x), id);
      expect(info.picture, id).toBe(`/art/owner/goblin/${f}`);
    }
    // hand faces
    await newMatch(page, quiet({ playerHand: Object.keys(OWNER_CARD_ART), playerCrystals: 9 }));
    await page.waitForTimeout(800);
    const hand = page.getByLabel('Your hand', { exact: true });
    for (const [id, f] of Object.entries(OWNER_CARD_ART)) {
      const img = hand.locator(`[data-card-id="${id}"] img[src*="${f}"]`).first();
      await expect(img, id).toHaveCount(1);
      await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
      const ratio = await img.evaluate((i) => { const r = i.getBoundingClientRect(); const fit = getComputedStyle(i).objectFit;
        return { box: r.width / r.height, nat: i.naturalWidth / i.naturalHeight, fit }; });
      if (!['cover', 'contain'].includes(ratio.fit)) expect(Math.abs(ratio.box - ratio.nat) / ratio.nat, `${id} not stretched`).toBeLessThanOrEqual(0.03);
    }
    // Deck Builder close-up
    await openDecks(page);
    for (const name of ['Goblin Miner', 'Boneknocker', 'Shiv Rat', 'Scrapsmith Miner']) {
      const tile = allCards(page).getByRole('button', { name, exact: true });
      await tile.scrollIntoViewIfNeeded();
      const id = { 'Goblin Miner': 'goblin-scrounger', 'Boneknocker': 'goblin-pebbler', 'Shiv Rat': 'shiv-rat', 'Scrapsmith Miner': 'goblin-smith-miner' }[name];
      await expect(tile.locator(`img[src*="${OWNER_CARD_ART[id]}"]`).first()).toHaveCount(1);
      await tile.click();
      const view = page.getByRole('dialog', { name });
      await expect(view).toBeVisible();
      await expect(view.locator(`img[src*="${OWNER_CARD_ART[id]}"]`).first()).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(view).toBeHidden();
    }
    // Grubnak select card
    await page.goto('/?test=1');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const g = page.getByRole('button', { name: 'Grubnak Rotgut, Goblin King' });
    const gi = g.locator('img[src*="grubnak-on-throne-art"]');
    await expect(gi).toHaveCount(1);
    await expect.poll(() => gi.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
  });

  test('AC274: Round 12a screenshots render without errors', async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const shot = async (n) => testInfo.attach(n, { body: await page.screenshot(), contentType: 'image/png' });
    await start(page, quiet({ playerHand: [...Object.keys(OWNER_CARD_ART), 'fireball'], playerCrystals: 9 }));
    await page.waitForTimeout(800);
    const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Goblin Miner', exact: true });
    const p = await raiseHandAt(page, card);
    await shot('r12a-hand-raised');
    const t = await sq2s(page, 7, 6);
    await page.mouse.down();
    await page.mouse.move(p.x, p.y - 12, { steps: 2 });
    await page.mouse.move(t.x, t.y, { steps: 14 });
    await shot('r12a-drag-highlights');
    await page.mouse.move(p.x, 1076, { steps: 8 });
    await page.mouse.up();
    await openDecks(page);
    for (const name of ['Goblin Miner', 'Boneknocker', 'Shiv Rat', 'Scrapsmith Miner']) {
      await allCards(page).getByRole('button', { name, exact: true }).click();
      await expect(page.getByRole('dialog', { name })).toBeVisible();
      await page.waitForTimeout(300);
      await shot(`r12a-card-${name.toLowerCase().replace(/ /g, '-')}`);
      await page.keyboard.press('Escape');
    }
    await page.goto('/?test=1');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForTimeout(800);
    await shot('r12a-grubnak-select');
    expect(errors).toEqual([]);
  });
});

for (const vp of [{ width: 1920, height: 1080 }, { width: 1568, height: 782 }, { width: 1366, height: 768 }]) {
  test.describe(`round 12a hand layout at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test(`AC272: the raised hand is an even fan fully on screen, hovered card bigger (${vp.width}x${vp.height})`, async ({ page }) => {
      const { width: W, height: H } = vp;
      await start(page, quiet({ playerHand: ['goblin-scrounger', 'goblin-scrapper', 'goblin-slinger', 'fireball', 'soul-shard', 'goblin-pebbler', 'shiv-rat'], playerCrystals: 9 }));
      await page.waitForTimeout(800);
      const minH = W >= 1920 ? 120 : 90;
      const rowBottom = await homeRowBottom(page);
      const btns = handButtons(page);
      const n = await btns.count();
      expect(n).toBe(7);
      // even fan (measured before any hover): equal spacing between neighbour centers
      const rest = [];
      for (let i = 0; i < n; i++) rest.push(await btns.nth(i).boundingBox());
      const centers = rest.map((b) => b.x + b.width / 2).sort((a, c) => a - c);
      const gaps = centers.slice(1).map((c, i) => c - centers[i]);
      expect(Math.max(...gaps) - Math.min(...gaps), `gaps ${gaps.map((g) => g.toFixed(0))}`).toBeLessThanOrEqual(4);
      for (const b of rest) { expect(b.x).toBeGreaterThanOrEqual(-1); expect(b.x + b.width).toBeLessThanOrEqual(W + 1); }
      const middle = btns.nth(3);
      await raiseHandAt(page, middle);
      await page.waitForTimeout(500);
      const boxes = [];
      for (let i = 0; i < n; i++) boxes.push(await btns.nth(i).boundingBox());
      const order = boxes.map((b, i) => ({ b, i })).sort((a, c) => a.b.x - c.b.x);
      const hovered = boxes[3];
      const others = boxes.filter((_, i) => i !== 3);
      // Round 23: the owner's layout editor decides how high the raised hand rises (pop out fully), so no home-row limit
      void rowBottom;
      // owner, Oct 25: closer fan — neighbours overlap (center gap under 70 % of a card width)
      expect(Math.max(...gaps)).toBeLessThan(0.7 * rest[0].width);
      for (const b of boxes) {
        expect(b.x).toBeGreaterThanOrEqual(-1);
        expect(b.x + b.width).toBeLessThanOrEqual(W + 1);
        expect(b.y).toBeGreaterThanOrEqual(-1);
        expect(b.y + b.height, 'card bottom on screen').toBeLessThanOrEqual(H + 1);
      }
      for (const b of others) expect(b.height).toBeGreaterThanOrEqual(minH);
      expect(hovered.height).toBeGreaterThanOrEqual(1.1 * Math.max(...others.map((b) => b.height)) - 1);
      void order; // Round 23: overlap 0.2 like the owner's layout editor; neighbours may sit behind the enlarged card
    });
  });
}

// ---------- Round 12b-1: Goblin 3D models from the owner's sheets ----------
const R12B_MODELS = {
  'goblin-scrounger': { name: 'Goblin Miner', parts: ['backpack', 'lantern', 'helmetLamp', 'pickaxe'], anims: ['idle', 'walk', 'attack', 'mine'], miner: true },
  'goblin-pebbler': { name: 'Boneknocker', parts: ['club'], anims: ['idle', 'walk', 'attack'], miner: false },
  'shiv-rat': { name: 'Shiv Rat', parts: ['dagger'], anims: ['idle', 'walk', 'attack'], miner: false },
  'goblin-smith-miner': { name: 'Scrapsmith Miner', parts: ['apron', 'scarf', 'helmetLamp', 'backpack', 'pickaxe', 'hammer'], anims: ['idle', 'walk', 'attack', 'mine'], miner: true },
};
async function creatureModels(request) {
  const res = await request.get('/models/creatures/models.json');
  if (!res.ok()) return null;
  try { return await res.json(); } catch { return null; }
}
async function seatedGrubnak(request) {
  const m = await grubnakModels(request);
  return m && m.grubnak.pose === 'seated' ? m : null;
}
const figureOf = (r, cardId) => (r.figures || []).find((f) => f.cardId === cardId);

test('AC275: creature model files are saved once with models.json; the game never calls Meshy', async ({ page, request }) => {
  const m = await creatureModels(request);
  test.skip(!m, 'no creature models delivered yet');
  const delivered = Object.keys(R12B_MODELS).filter((id) => m[id]);
  expect(delivered.length).toBeGreaterThan(0);
  for (const id of delivered) {
    expect(m[id].file).toBe(`${id}.glb`);
    expect(typeof m[id].sheet).toBe('string');
    const res = await request.get(`/models/creatures/${m[id].file}`);
    expect(res.ok(), m[id].file).toBe(true);
    const body = await res.body();
    expect(body.subarray(0, 4).toString('latin1'), `${id} is a GLB`).toBe('glTF');
    expect(body.length, `${id} bytes`).toBe(m[id].bytes);
    expect(body.length).toBeLessThanOrEqual(6 * 1024 * 1024);
    for (const a of R12B_MODELS[id].anims) expect(typeof m[id].animations[a], `${id} animation ${a}`).toBe('string');
  }
  const meshy = [];
  page.on('request', (r) => { try { if (/meshy\.ai$/i.test(new URL(r.url()).hostname)) meshy.push(r.url()); } catch { /* ignore */ } });
  await start(page, quiet({ board: delivered.map((cardId, i) => ({ cardId, owner: 'player', row: 6, col: 4 + i })) }));
  await renderStats(page);
  await page.waitForTimeout(1000);
  expect(meshy).toEqual([]);
});

for (const [cardId, spec] of Object.entries(R12B_MODELS)) {
  test(`AC276: ${spec.name} stands on the board as its new model with its gear and animations`, async ({ page, request }) => {
    const m = await creatureModels(request);
    test.skip(!m || !m[cardId], `${spec.name} model not delivered`);
    await start(page, quiet({ board: [{ cardId, owner: 'player', row: 6, col: 5 }] }));
    if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
    await expect.poll(async () => (figureOf(await renderStats(page), cardId) || {}).source, { timeout: 15000 }).toBe(`${cardId}.glb`);
    const f = figureOf(await renderStats(page), cardId);
    expect(f.row).toBe(6); expect(f.col).toBe(5);
    expect(f.height).toBeGreaterThanOrEqual(0.9);
    expect(f.height).toBeLessThanOrEqual(1.3);
    for (const part of spec.parts) expect(f.parts, `part ${part}`).toContain(part);
    for (const a of spec.anims) expect(f.animations, `animation ${a}`).toContain(a);
    expect(f.currentAnimation).toBe('idle');
    if (spec.miner) expect(f.lampLit).toBe(true);
  });

  test(`AC278: the Deck Builder 3D viewer shows the new ${spec.name} model with its animation buttons`, async ({ page, request }) => {
    const m = await creatureModels(request);
    test.skip(!m || !m[cardId], `${spec.name} model not delivered`);
    await openDecks(page);
    await allCards(page).getByRole('button', { name: spec.name, exact: true }).click();
    const dlg = page.getByRole('dialog', { name: spec.name });
    await expect(dlg).toBeVisible();
    const viewer = page.getByRole('region', { name: '3D model' });
    await expect(viewer).toBeVisible();
    for (const label of ['Idle', 'Walk', 'Attack', ...(spec.miner ? ['Mine'] : [])]) {
      await expect(viewer.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    const vs = () => page.evaluate(async () => await window.oreheart.getViewerState());
    await expect.poll(async () => (await vs()).source, { timeout: 15000 }).toBe(`${cardId}.glb`);
    await viewer.getByRole('button', { name: 'Attack', exact: true }).click();
    await expect.poll(async () => (await vs()).animation, { timeout: 5000 }).toBe('attack');
    await expect(dlg).toBeVisible();
  });
}

test('AC277: Goblin Miner plays its mine and walk animations', async ({ page, request }) => {
  const m = await creatureModels(request);
  test.skip(!m || !m['goblin-scrounger'], 'Goblin Miner model not delivered');
  // two Miners: one next to the mine at row 4 col 2, one free to walk
  await start(page, quiet({ board: [
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 2 },
    { cardId: 'goblin-scrounger', owner: 'player', row: 6, col: 8 },
  ] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  let s = await getState(page);
  const miner = s.board.find((c) => c.row === 5 && c.col === 2);
  const walker = s.board.find((c) => c.row === 6 && c.col === 8);
  let mineAct = null, moveAct = null;
  for (let i = 0; i < 3 && !(mineAct && moveAct); i++) {
    const l = await legal(page);
    mineAct = l.find((a) => a.type === 'mine' && a.creatureUid === miner.uid);
    moveAct = l.find((a) => a.type === 'move' && a.creatureUid === walker.uid);
    if (!(mineAct && moveAct)) await done(page);
  }
  expect(mineAct && moveAct, 'mine and move are legal in the Action phase').toBeTruthy();
  expect((await act(page, mineAct)).ok).toBe(true);
  expect((await act(page, moveAct)).ok).toBe(true);
  await expect.poll(async () => {
    const r = await renderStats(page);
    const a = (r.figures || []).find((f) => f.uid === miner.uid) || {};
    const b = (r.figures || []).find((f) => f.uid === walker.uid) || {};
    return (a.animationLog || []).includes('mine') && (b.animationLog || []).includes('walk');
  }, { timeout: 10000 }).toBe(true);
});

test('AC279: seated Grubnak and his throne are saved once; the fortress and scepter are gone', async ({ request }) => {
  const m = await seatedGrubnak(request);
  test.skip(!m, 'seated Grubnak not delivered');
  expect(m.fortress).toBeFalsy();
  expect(m.scepter).toBeFalsy();
  expect(m.grubnak.sheet).toBe('grubnak-model-sheet.png');
  expect(m.throne.sheet).toBe('grubnak-throne-model-sheet.png');
  for (const [key, file, max] of [['grubnak', 'grubnak.glb', 10 * 1024 * 1024], ['throne', 'grubnak-throne.glb', 5 * 1024 * 1024]]) {
    expect(m[key].file).toBe(file);
    const res = await request.get(`/models/commanders/${file}`);
    expect(res.ok(), file).toBe(true);
    const body = await res.body();
    expect(body.subarray(0, 4).toString('latin1')).toBe('glTF');
    expect(body.length).toBe(m[key].bytes);
    expect(body.length).toBeLessThanOrEqual(max);
  }
  for (const a of CANON_ANIMS) expect(typeof m.grubnak.animations[a], `animation ${a}`).toBe('string');
});

test('AC280: Grubnak sits on his junk throne as player and as enemy Commander, holding his staff', async ({ page, request }) => {
  test.skip(!(await seatedGrubnak(request)), 'seated Grubnak not delivered');
  for (const side of ['player', 'opponent']) {
    await openTest(page);
    await newMatch(page, { ai: false, playerCommander: side === 'player' ? 'grubnak' : 'borgo', opponentCommander: side === 'player' ? 'borgo' : 'grubnak', setup: { opponentHand: [] } });
    if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
    await expect.poll(async () => !!(await grubnakEntry(page, side)), { timeout: 15000 }).toBe(true);
    const g = await grubnakEntry(page, side);
    expect(g.commanderId).toBe('grubnak');
    expect(g.source).toMatch(/grubnak\.glb$/);
    expect(g.pose).toBe('seated');
    expect(g.throne).toMatch(/grubnak-throne\.glb$/);
    expect(g.fortress || null).toBeNull();
    expect(g.height).toBeGreaterThanOrEqual(2.2);
    expect(g.height).toBeLessThanOrEqual(2.6);
    expect(g.characterHeight).toBeGreaterThanOrEqual(1.3);
    expect(g.held.item).toBe('staff');
    expect(g.held.bone).toMatch(/hand|wrist|palm|baked/i);
    for (const a of CANON_ANIMS) expect(g.animations).toContain(a);
    expect(g.currentAnimation).toBe('idle');
  }
});

test('AC281: the throne stands on the ground in the stronghold spot facing 146 degrees; Grubnak sits on it', async ({ page, request }) => {
  test.setTimeout(60000);
  test.skip(!(await seatedGrubnak(request)), 'seated Grubnak not delivered');
  await start(page, quiet({}));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  await expect.poll(async () => !!(await poses(page)).pFort, { timeout: 15000 }).toBe(true);
  const p0 = await poses(page);
  expect(p0.pFort.cx).toBeCloseTo(1.5, 2); expect(p0.pFort.cy).toBeCloseTo(6.5, 2);
  expect(Math.abs(p0.pFort.baseY - p0.boardY), 'throne on the ground').toBeLessThanOrEqual(0.01 * p0.square);
  expect(yawDiff(p0.pFort.yawDeg, 146)).toBeLessThanOrEqual(3);
  expect(Math.abs(p0.pFort.tiltDeg)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(p0.pFort.leanDeg)).toBeLessThanOrEqual(0.5);
  expect(p0.pCmd.seated).toBe(true);
  expect(p0.pCmd.cx).toBeCloseTo(1.5, 2); expect(p0.pCmd.cy).toBeCloseTo(6.5, 2);
  expect(p0.pCmd.baseY, 'Grubnak sits above the ground').toBeGreaterThan(p0.boardY + 0.05 * p0.square);
  expect(yawDiff(p0.pCmd.yawDeg, 146)).toBeLessThanOrEqual(3);
  for (const emote of ['laugh', 'cast']) {
    await page.evaluate(async (e) => await window.oreheart.playEmote('player', e), emote);
    await page.waitForTimeout(2000);
    expect((await poses(page)).pFort.matrix, `throne moved during ${emote}`).toEqual(p0.pFort.matrix);
  }
});

test('AC282: Choose Your Commander and the Deck Builder viewer show the seated Grubnak', async ({ page, request }) => {
  test.skip(!(await seatedGrubnak(request)), 'seated Grubnak not delivered');
  await openDecks(page);
  const tile = page.getByLabel('Commander card', { exact: true }).getByRole('button', { name: COMMANDERS[0], exact: true });
  await tile.click();
  await expect(page.getByRole('dialog', { name: COMMANDERS[0], exact: true }).getByLabel('3D model', { exact: true })).toBeVisible();
  await expect.poll(async () => (await page.evaluate(async () => await window.oreheart.getViewerState())).source, { timeout: 15000 }).toMatch(/grubnak\.glb$/);
  // owner check change (Ken, Oct 31): no 3D pop-up on Choose Your Commander any more ("I don't want his 3D image to pop up anymore"); AC207 checks it stays away
});


// ---------- Round 12c: every card does what its text says ----------
// opponent = Sproingle (no Borgo +1 Health), faction lock off, owner mines on row 4 (cols 2, 4, 6)
const q12 = (extra, more = {}) => ({ ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle', factionLock: false, ...more, setup: { opponentHand: [], playerDeck: SHARDS, opponentDeck: SHARDS, ...extra } });
const P = (cardId, row, col, x = {}) => ({ cardId, owner: 'player', row, col, ...x });
const O = (cardId, row, col, x = {}) => ({ cardId, owner: 'opponent', row, col, ...x });
const ability = (page, s, row, col, name, x = {}) => act(page, { type: 'ability', creatureUid: at(s, row, col).uid, ability: name, ...x });
const toAction = async (page) => { await done(page); return getState(page); };
const canAttack = (acts, uid, row, col) => acts.some((a) => a.type === 'attack' && a.creatureUid === uid && sameTarget(a.target, row, col));

test('AC284: card data carries artPos framing (default 1/0/0) and the owner text', async ({ page }) => {
  await openTest(page);
  const cards = await page.evaluate(async () => await window.oreheart.listCards());
  for (const c of cards) {
    expect(c.artPos, c.id).toBeTruthy();
    for (const k of ['s', 'x', 'y']) expect(typeof c.artPos[k], `${c.id}.${k}`).toBe('number');
  }
  const pick = (id) => cards.find((c) => c.id === id);
  expect(pick('goblin-scrounger').name).toBe('Goblin Miner');
  expect(pick('dwarf-miner').name).toBe('Riot Shield Bearer');
  expect(pick('goblin-slinger').text).toContain('Hits up to 6 spaces away');
  expect(pick('meteor-strike').text).toContain('4 damage to everything in a 3×3 area');
});

test('AC285: Betty Fizzlebottom is archived: not on Choose Your Commander and not in any starter deck', async ({ page }) => {
  await toSelect(page);
  await expect(page.getByText(/Betty/)).toHaveCount(0);
  await openTest(page);
  const decks = await page.evaluate(async () => await window.oreheart.listStarterDecks());
  for (const d of decks) expect(d.commanderId ?? d.commander ?? '', d.id).not.toBe('sprocket');
  expect(decks.length).toBe(12); // owner check change (Ken, Oct 31): four starter decks per faction
});

test('AC286: per-card Ranged ranges: Skullflinger 6, Gyronaut 2, Gunner 7, Hexslinger any distance but not through allies', async ({ page }) => {
  // same row (row 5), shooting left from column 13: a target exactly `range` away is hittable, one further is not
  for (const [id, range] of [['goblin-slinger', 6], ['gyrocopter-ace', 2], ['deepforge-crossbowman', 7], ['spark-gnome', 5], ['axe-thrower', 5]]) {
    await start(page, q12({ board: [P(id, 5, 13), O('dwarf-pickman', 5, 13 - range)] }));
    let s = await toAction(page);
    expect(canAttack(await legal(page), at(s, 5, 13).uid, 5, 13 - range), `${id} hits ${range} away`).toBe(true);
    await newMatch(page, q12({ board: [P(id, 5, 13), O('dwarf-pickman', 5, 12 - range)] }));
    s = await toAction(page);
    expect(canAttack(await legal(page), at(s, 5, 13).uid, 5, 12 - range), `${id} misses ${range + 1} away`).toBe(false);
    expect((await page.evaluate(async (x) => await window.oreheart.getCard(x), id)).range, id).toBe(range);
  }
  // Hexslinger Apprentice: any distance in a straight line, but not through an ally
  await newMatch(page, q12({ board: [P('hexwright-apprentice', 7, 13), O('dwarf-pickman', 1, 7)] })); // diagonal, 6 away
  let s = await toAction(page);
  expect(canAttack(await legal(page), at(s, 7, 13).uid, 1, 7)).toBe(true);
  await newMatch(page, q12({ board: [P('hexwright-apprentice', 7, 13), P('goblin-bomber', 4, 10), O('dwarf-pickman', 1, 7)] }));
  s = await toAction(page);
  expect(canAttack(await legal(page), at(s, 7, 13).uid, 1, 7)).toBe(false);
});

test('AC287: Starfall Cataclysm deals exactly 4 to everything in a 3x3 area', async ({ page }) => {
  let s = await start(page, q12({ playerHand: ['meteor-strike'], playerCrystals: 6,
    board: [O('dwarf-pickman', 2, 9), O('dwarf-pickman', 3, 10), O('dwarf-pickman', 3, 12)] }));
  const before = { a: at(s, 2, 9).health, b: at(s, 3, 10).health, c: at(s, 3, 12).health };
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'meteor-strike'), target: { row: 2, col: 10 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 2, 9).health).toBe(before.a - 4);
  expect(at(s, 3, 10).health).toBe(before.b - 4);
  expect(at(s, 3, 12).health).toBe(before.c); // outside the 3x3
  expect(s.players.player.crystals).toBe(0);
});

test('AC288: Venom Shiv: 1 damage at the start of each of the target\'s next 7 turns, and no healing meanwhile', async ({ page }) => {
  let s = await start(page, q12({ playerHand: ['venom-shiv'], playerCrystals: 2, board: [O('dwarf-pickman', 2, 9, { damage: 2 })] }));
  const hp = at(s, 2, 9).health;
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'venom-shiv'), target: { row: 2, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 2, 9).poison).toBe(7);
  await passTurn(page); // opponent's turn 1 starts: no heal, 1 poison
  s = await getState(page);
  expect(at(s, 2, 9).health).toBe(hp - 1);
  expect(at(s, 2, 9).poison).toBe(6);
  await passTurn(page); await passTurn(page); // opponent's next turn
  s = await getState(page);
  expect(at(s, 2, 9).health).toBe(hp - 2);
});

test('AC289: SewerSlide Bomber pays 1, runs in a line until it hits something, then Ka-booms', async ({ page }) => {
  let s = await start(page, q12({ playerCrystals: 3, board: [P('blastrat-sapper', 6, 9), O('dwarf-pickman', 2, 9)] }));
  const hp = at(s, 2, 9).health;
  s = await toAction(page);
  expect((await ability(page, s, 6, 9, 'run', { target: { row: 5, col: 9 } })).ok).toBe(true); // direction: up
  s = await getState(page);
  expect(s.board.creatures.some((c) => c.cardId === 'blastrat-sapper')).toBe(false);
  expect(at(s, 2, 9).health).toBe(hp - 1);
  expect(s.players.player.crystals).toBe(2);
});

test('AC290: Scrapsmith Miner draws a card when it dies (its own text)', async ({ page }) => {
  let s = await start(page, q12({ board: [P('goblin-sneak', 5, 9), O('goblin-smith-miner', 4, 9)] }));
  s = await toAction(page);
  const hand0 = s.players.opponent.hand.length;
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 9).uid, target: { row: 4, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 9)).toBeFalsy();
  expect(s.players.opponent.hand.length).toBe(hand0 + 1);
});

test('AC291: Bare Knuckle Lunatic knocks every adjacent unit back 1 when defeated', async ({ page }) => {
  let s = await start(page, q12({ board: [P('goblin-sneak', 5, 9), O('goblin-bomber', 4, 9), O('dwarf-pickman', 3, 9), O('dwarf-pickman', 4, 10)] }));
  s = await toAction(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 9).uid, target: { row: 4, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(s.board.creatures.some((c) => c.cardId === 'goblin-bomber')).toBe(false);
  expect(at(s, 6, 9) && at(s, 6, 9).cardId).toBe('goblin-sneak');
  expect(at(s, 2, 9) && at(s, 2, 9).cardId).toBe('dwarf-pickman');
  expect(at(s, 4, 11) && at(s, 4, 11).cardId).toBe('dwarf-pickman');
});

test('AC292: Backstabbing Thief steals 1 crystal for each enemy it defeats', async ({ page }) => {
  let s = await start(page, q12({ playerCrystals: 0, opponentCrystals: 3, board: [P('goblin-sneak', 5, 9), O('goblin-scrounger', 4, 9)] }));
  s = await toAction(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 9).uid, target: { row: 4, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.crystals).toBe(1);
  expect(s.players.opponent.crystals).toBe(2);
});

test('AC293: Bowler Brawler Strike (2) rolls a ball along a line; every creature on it is knocked 1-2 spaces sideways like a pin', async ({ page }) => {
  // ball rolls up column 9: the dwarf at (4,9) is knocked left or right, never backwards
  let s = await start(page, q12({ playerCrystals: 2, board: [P('goblin-scrapper', 6, 9), O('dwarf-pickman', 4, 9)] }));
  s = await toAction(page);
  expect((await ability(page, s, 6, 9, 'strike', { target: { row: 5, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  const p = s.board.creatures.find((c) => c.cardId === 'dwarf-pickman');
  expect(p.row).toBe(4);
  expect([7, 8, 10, 11]).toContain(p.col);
  expect(at(s, 6, 9).cardId).toBe('goblin-scrapper');
  expect(s.players.player.crystals).toBe(0);
  // column 13: the board edge blocks the right side, so (4,13) goes left; (2,13) has a unit on its left and the edge on its right, so it stays
  s = await newMatch(page, q12({ playerCrystals: 2, board: [P('goblin-scrapper', 6, 13), O('dwarf-pickman', 4, 13), P('goblin-scrounger', 2, 13), O('dwarf-pickman', 2, 12)] }));
  s = await toAction(page);
  const miner = at(s, 2, 13).uid;
  expect((await ability(page, s, 6, 13, 'strike', { target: { row: 5, col: 13 } })).ok).toBe(true);
  s = await getState(page);
  const hit = s.board.creatures.filter((c) => c.cardId === 'dwarf-pickman' && c.row === 4);
  expect(hit.length).toBe(1);
  expect([11, 12]).toContain(hit[0].col);
  const m = s.board.creatures.find((c) => c.uid === miner);
  expect([m.row, m.col]).toEqual([2, 13]); // friend or foe: both sides blocked, it stays
  expect(at(s, 2, 12).cardId).toBe('dwarf-pickman');
});

test('AC293: Bowler Brawler shows the owner\'s Strike text', async ({ page }) => {
  await openTest(page);
  const c = await page.evaluate(async () => await window.oreheart.getCard('goblin-scrapper'));
  const all = [c.text, c.shortText, c.longText].join(' ');
  expect(all).toContain('Like bowling pins');
  expect(all).toContain('off to the side');
  expect(all).toContain('it goes to the other side');
});

test('AC294: Junk Shaman pays 2 to move any character within 5 to a space within 5 of it', async ({ page }) => {
  let s = await start(page, q12({ playerCrystals: 4, board: [P('junk-shaman', 6, 9), O('dwarf-pickman', 2, 9)] }));
  s = await toAction(page);
  expect((await ability(page, s, 6, 9, 'pickUp', { target: { row: 2, col: 9 }, to: { row: 7, col: 13 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 7, 13) && at(s, 7, 13).cardId).toBe('dwarf-pickman');
  expect(s.players.player.crystals).toBe(2);
  // 6 away: not allowed
  s = await newMatch(page, q12({ playerCrystals: 4, board: [P('junk-shaman', 7, 9), O('dwarf-pickman', 1, 9)] }));
  s = await toAction(page);
  expect((await ability(page, s, 7, 9, 'pickUp', { target: { row: 1, col: 9 }, to: { row: 7, col: 10 } })).ok).toBe(false);
});

test('AC295: Goblin Chef Smack knocks its target back 2 and is not Ranged', async ({ page }) => {
  let s = await start(page, q12({ board: [P('rotgut-grenadier', 5, 9), O('dwarf-pickman', 4, 9), O('dwarf-pickman', 3, 11)] }));
  s = await toAction(page);
  const uid = at(s, 5, 9).uid;
  expect(canAttack(await legal(page), uid, 3, 11)).toBe(false);
  expect((await act(page, { type: 'attack', creatureUid: uid, target: { row: 4, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 2, 9) && at(s, 2, 9).cardId).toBe('dwarf-pickman');
});

test('AC296: Goblin Rocket Rider rides to any space, explodes 3x3 for its Attack, then attacks once; it is a Fighter (Round 14)', async ({ page }) => {
  let s = await start(page, q12({ board: [P('shard-guzzler', 7, 9), O('dwarf-pickman', 3, 9), O('dwarf-pickman', 3, 10), O('dwarf-pickman', 1, 9)] }));
  const hp = at(s, 3, 9).health, far = at(s, 1, 9).health;
  s = await toAction(page);
  expect((await ability(page, s, 7, 9, 'rocketRide', { target: { row: 4, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 9).cardId).toBe('shard-guzzler');
  expect(at(s, 3, 9).health).toBe(hp - 1);
  expect(at(s, 3, 10).health).toBe(hp - 1);
  expect(at(s, 1, 9).health).toBe(far);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 4, 9).uid, target: { row: 3, col: 9 } })).ok).toBe(true);
  expect((await page.evaluate(async () => await window.oreheart.getCard('shard-guzzler'))).role).toBe('fighter'); // Round 14: owner made it a Fighter
});

test('AC297: Rat-Tunnel Ambush moves a creature next to a mine and it can still attack', async ({ page }) => {
  let s = await start(page, q12({ playerHand: ['tunnel-rush'], playerCrystals: 2, board: [P('dwarf-pickman', 7, 11), O('goblin-scrounger', 4, 7)] }));
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'tunnel-rush'), target: { row: 7, col: 11 }, to: { row: 5, col: 7 } })).ok).toBe(true);
  s = await toAction(page);
  expect(at(s, 5, 7) && at(s, 5, 7).cardId).toBe('dwarf-pickman');
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 7).uid, target: { row: 4, col: 7 } })).ok).toBe(true);
});

test('AC298: Voldawright Shockwave (1): adjacent enemies take 1 and are knocked back 1', async ({ page }) => {
  let s = await start(page, q12({ playerCrystals: 1, board: [P('gnome-cogger', 4, 9), O('dwarf-pickman', 3, 9), O('dwarf-pickman', 4, 10)] }));
  const hp = at(s, 3, 9).health;
  s = await toAction(page);
  expect((await ability(page, s, 4, 9, 'shockwave')).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 2, 9).health).toBe(hp - 1);
  expect(at(s, 4, 11).health).toBe(hp - 1);
  expect(s.players.player.crystals).toBe(0);
});

test('AC299: Glyphshield Warden gets Shield 1 each turn; Ward (2, once per turn) stops all damage to an ally for a round', async ({ page }) => {
  let s = await start(page, q12({ playerBank: 4, board: [P('glyphshield-warden', 6, 9), P('dwarf-pickman', 5, 9), O('goblin-scrapper', 4, 9)] }));
  await passTurn(page); await passTurn(page); // the player's turn 2 begins
  s = await getState(page);
  expect(at(s, 6, 9).shield).toBe(1);
  const hp = at(s, 5, 9).health;
  expect((await ability(page, s, 6, 9, 'ward', { target: { row: 5, col: 9 } })).ok).toBe(true);
  expect((await ability(page, s, 6, 9, 'ward', { target: { row: 5, col: 9 } })).ok).toBe(false); // once per turn
  s = await getState(page);
  expect(s.players.player.bank).toBe(2);
  const warded = at(s, 5, 9).uid;
  s = await toAction(page);
  expect((await legal(page)).some((a) => a.type === 'attack' && a.creatureUid === warded)).toBe(false); // can't attack while warded
  await done(page); await done(page); // opponent's turn, Deploy -> Action
  s = await getState(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 4, 9).uid, target: { row: 5, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 5, 9).health).toBe(hp);
});

test('AC300: Gnome Plow (2) moves in a straight line and knocks creatures in its path aside 1-2 spaces', async ({ page }) => {
  let s = await start(page, q12({ playerCrystals: 2, board: [P('phase-stalker', 7, 9), O('dwarf-pickman', 5, 9)] }));
  s = await toAction(page);
  expect((await ability(page, s, 7, 9, 'plow', { target: { row: 3, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 3, 9) && at(s, 3, 9).cardId).toBe('phase-stalker');
  const p = s.board.creatures.find((c) => c.cardId === 'dwarf-pickman');
  expect(p.row).toBe(5);
  expect([1, 2]).toContain(Math.abs(p.col - 9));
  expect((await ability(page, s, 3, 9, 'plow', { target: { row: 1, col: 11 } })).ok).toBe(false); // used / diagonal
});

test('AC301: Unweave cancels any enemy spell; Snuff Out only spells costing 3 or less', async ({ page }) => {
  const base = { firstPlayer: 'opponent', opponentHand: ['meteor-strike'], opponentCrystals: 6, board: [P('dwarf-pickman', 6, 9)] };
  let s = await start(page, q12({ ...base, playerHand: ['fizzle'], playerCrystals: 3 }));
  expect((await act(page, { type: 'cast', uid: handUid(s, 'opponent', 'meteor-strike'), target: { row: 6, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse).toBeFalsy(); // Snuff Out can't cancel a 6-cost spell, so no window opens
  s = await newMatch(page, q12({ ...base, playerHand: ['spell-snap'], playerCrystals: 5 }));
  const hp = at(s, 6, 9).health;
  expect((await act(page, { type: 'cast', uid: handUid(s, 'opponent', 'meteor-strike'), target: { row: 6, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse && s.pendingResponse.responder).toBe('player');
  expect((await act(page, { type: 'respond', uid: handUid(s, 'player', 'spell-snap') })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 9).health).toBe(hp);
});

// Owner check change (Ken, Oct 31 dwarf rebalance): the shield stops attacking and dying, not walking: a shielded Bearer may move (and mine)
test('AC302: Riot Shield Bearer can\'t attack and can\'t die for its first 3 turns, but it can still move', async ({ page }) => {
  let s = await start(page, q12({ playerHand: ['dwarf-miner'], playerCrystals: 2, board: [O('ram-rider', 6, 9)] }, { playerCommander: 'borgo' }));
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'dwarf-miner'), row: 7, col: 9 })).ok).toBe(true);
  await passTurn(page);
  // opponent's Ram Rider (4 Attack) hits it twice over two turns: it never drops below 1
  for (let i = 0; i < 2; i++) {
    s = await toAction(page);
    await act(page, { type: 'attack', creatureUid: at(s, 6, 9).uid, target: { row: 7, col: 9 } });
    s = await getState(page);
    expect(at(s, 7, 9) && at(s, 7, 9).cardId).toBe('dwarf-miner');
    expect(at(s, 7, 9).health).toBeGreaterThanOrEqual(1);
    await done(page); // end opponent's Action
    s = await toAction(page);
    const mine = at(s, 7, 9).uid;
    const acts = await legal(page);
    expect(acts.some((a) => a.type === 'attack' && a.creatureUid === mine), 'no attack while shielded').toBe(false);
    expect(acts.some((a) => a.type === 'move' && a.creatureUid === mine), 'it can walk while shielded').toBe(true);
    await done(page);
  }
});

test('AC303: Queen Brunhilda takes at most 3 from a hit; Bloodbeard Grit +1 Attack after surviving', async ({ page }) => {
  let s = await start(page, q12({ board: [P('the-great-steam-golem', 5, 9), O('queen-brunhilda-stonebeard', 4, 9)] })); // 5 Attack
  const q = at(s, 4, 9).health;
  s = await toAction(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 9).uid, target: { row: 4, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 9).health).toBe(q - 3);
  s = await newMatch(page, q12({ board: [P('goblin-scrounger', 5, 9), O('ironhammer-berserker', 4, 9)] }));
  const atk = at(s, 4, 9).attack;
  s = await toAction(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 9).uid, target: { row: 4, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 4, 9).attack).toBe(atk + 1);
});

test('AC304: Gemdrunk Deepdelver gets +1 Attack per banked crystal; Grudge Hurler roots its target', async ({ page }) => {
  let s = await start(page, q12({ playerBank: 3, board: [P('crystal-drunk-delver', 6, 9)] }));
  const base = (await page.evaluate(async () => await window.oreheart.getCard('crystal-drunk-delver'))).attack;
  expect(at(s, 6, 9).attack).toBe(base + 3);
  s = await newMatch(page, q12({ board: [P('axe-thrower', 6, 9), O('dwarf-pickman', 2, 9)] }));
  s = await toAction(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 6, 9).uid, target: { row: 2, col: 9 } })).ok).toBe(true);
  await done(page); await done(page); // opponent's turn, Deploy -> Action
  s = await getState(page);
  const uid = at(s, 2, 9).uid;
  expect((await legal(page)).some((a) => a.type === 'move' && a.creatureUid === uid)).toBe(false);
});

test('AC305: Ram Rider pays 2 to move any distance; Oathbound Overwatch attacks at any distance; Barrelback acts at once', async ({ page }) => {
  let s = await start(page, q12({ playerCrystals: 2, board: [P('ram-rider', 7, 9), P('oathbound-pikeman', 7, 11), O('dwarf-pickman', 1, 3)] }));
  s = await toAction(page);
  expect((await ability(page, s, 7, 9, 'gallop', { target: { row: 2, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 2, 9) && at(s, 2, 9).cardId).toBe('ram-rider');
  expect(s.players.player.crystals).toBe(0);
  expect(canAttack(await legal(page), at(s, 7, 11).uid, 1, 3)).toBe(true);
  s = await newMatch(page, q12({ playerHand: ['barrelback-courier'], playerCrystals: 5 }));
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'barrelback-courier'), row: 7, col: 9 })).ok).toBe(true);
  s = await toAction(page);
  expect((await legal(page)).some((a) => a.type === 'move' && a.creatureUid === at(s, 7, 9).uid)).toBe(true);
});

test('AC306: Ironclad Bulwark makes the next hit do 0; Field Bandage heals to full; Emergency Rations heals the Commander 4', async ({ page }) => {
  let s = await start(page, q12({ playerHand: ['shield-bubble', 'healing-light', 'second-wind'], playerCrystals: 9, playerHealth: 10,
    board: [P('dwarf-pickman', 5, 9, { damage: 3 }), O('goblin-scrapper', 4, 9)] }));
  const full = at(s, 5, 9).maxHealth;
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'healing-light'), target: { row: 5, col: 9 } })).ok).toBe(true);
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'second-wind'), target: { commander: 'player' } })).ok).toBe(true);
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'shield-bubble'), target: { row: 5, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 5, 9).health).toBe(full);
  expect(s.players.player.health).toBe(14);
  await passTurn(page); await done(page);
  s = await getState(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 4, 9).uid, target: { row: 5, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 5, 9).health).toBe(full);
});

test('AC307: Crystal cards: Soul Shard +1, Soul Cluster +2, Heart +4, Motherlode +3 and next creature 2 cheaper, Geode +1 Flow each turn', async ({ page }) => {
  let s = await start(page, q12({ playerHand: ['soul-shard', 'crystal-cluster', 'heart-of-the-fallen', 'motherlode', 'glowing-geode', 'goblin-bomber'] }));
  for (const id of ['soul-shard', 'crystal-cluster', 'heart-of-the-fallen', 'motherlode']) expect((await act(page, { type: 'playCrystal', uid: handUid(s, 'player', id) })).ok, id).toBe(true);
  s = await getState(page);
  expect(s.players.player.bank).toBe(10);
  const s0total = s.players.player.bank + s.players.player.crystals;
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-bomber'), row: 7, col: 9 })).ok).toBe(true);
  s = await getState(page);
  expect(s.players.player.bank + s.players.player.crystals).toBe(s0total - 1); // Bare Knuckle Lunatic costs 3, 2 less = 1 (Flow is spent first)
  expect((await act(page, { type: 'playCrystal', uid: handUid(s, 'player', 'glowing-geode') })).ok).toBe(true);
  await passTurn(page); await passTurn(page);
  s = await getState(page);
  expect(s.players.player.crystals).toBe(1);
});

test('AC308: Desperate Plunder gives +3 Flow each turn while the opponent has more Flow, and stops once you have more', async ({ page }) => {
  let s = await start(page, q12({ playerHand: ['prospectors-prayer'], opponentCrystals: 0,
    board: [O('goblin-scrounger', 3, 4, { minedMine: { row: 4, col: 4 } }), O('goblin-scrounger', 3, 6, { minedMine: { row: 4, col: 6 } })] }));
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'prospectors-prayer') })).ok).toBe(true);
  await passTurn(page); await passTurn(page);
  s = await getState(page);
  expect(s.players.player.crystals).toBe(3);
});

test('AC309: every Round 12c card reports its ability as built, and close-ups show the owner text', async ({ page }) => {
  await openTest(page);
  const status = await page.evaluate(async () => await window.oreheart.getAbilityStatus());
  const ids = ['blastrat-sapper', 'goblin-bomber', 'goblin-scrapper', 'goblin-sneak', 'junk-shaman', 'rotgut-grenadier', 'shard-guzzler', 'hold-it', 'tunnel-rush',
    'gearward-sentinel', 'glyphshield-warden', 'gnome-cogger', 'gnome-illusionist', 'gnome-widget', 'phase-stalker', 'overclocked-conduit', 'runic-siphoner', 'spell-snap',
    'dwarf-miner', 'shieldbeard', 'axe-thrower', 'ironhammer-berserker', 'brewmaster', 'ram-rider', 'queen-brunhilda-stonebeard', 'crystal-drunk-delver', 'dwarf-pickman',
    'dwarf-stoneback', 'oathbound-pikeman', 'barrelback-courier', 'rune-splitter', 'grimhold-ravager', 'battle-cry', 'shield-bubble', 'second-wind',
    'fizzle', 'healing-light', 'prospectors-prayer', 'soul-shard', 'crystal-cluster', 'heart-of-the-fallen', 'motherlode', 'glowing-geode',
    'goblin-slinger', 'spark-gnome', 'gyrocopter-ace', 'deepforge-crossbowman', 'hexwright-apprentice', 'meteor-strike', 'venom-shiv'];
  for (const id of ids) expect(status[id], id).toBe('done');
  for (const id of ['goblin-scrapper', 'shieldbeard', 'motherlode']) {
    const c = await page.evaluate(async (x) => await window.oreheart.getCard(x), id);
    expect(c.longText.length, id).toBeGreaterThan(c.text.length - 1);
    expect(c.longText, id).toContain('Example:');
  }
});

// ---------- Round 12d: owner card format ----------
const REF_CARDS = ['goblin-scrounger', 'gnome-prospector', 'rune-splitter', 'fireball', 'healing-light', 'soul-shard', 'venom-shiv', 'second-wind'];
// inserts renderCard() HTML into the page, runs fitText, and measures it
const renderAndMeasure = (page, id, h = 624) => page.evaluate(async ([cid, hh]) => {
  const html = await window.oreheart.renderCard(cid, hh);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
  host.innerHTML = html;
  document.body.appendChild(host);
  const root = host.firstElementChild;
  if (window.oreheart.fitText) window.oreheart.fitText(root);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const rr = root.getBoundingClientRect();
  const overflow = [...root.querySelectorAll('.tx[data-fit="1"]')].filter((el) => {
    const sp = el.firstElementChild, box = el.parentElement;
    return sp && (sp.scrollHeight > box.clientHeight + 1 || sp.scrollWidth > box.clientWidth + 1);
  }).map((el) => el.textContent.slice(0, 30));
  const art = root.querySelector('.artclip img') || root.querySelector('img');
  const ar = art ? art.closest('.ly').getBoundingClientRect() : null;
  const out = { cls: root.className, w: rr.width, h: rr.height, text: root.textContent, overflow, html,
    artCover: ar ? (Math.min(ar.right, rr.right) - Math.max(ar.left, rr.left)) * (Math.min(ar.bottom, rr.bottom) - Math.max(ar.top, rr.top)) / (rr.width * rr.height) : 0,
    imgs: [...root.querySelectorAll('img')].map((i) => i.getAttribute('src')) };
  host.remove();
  return out;
}, [id, h]);

test('AC310: the game loads the owner card format and renders every layout at 420:624', async ({ page }) => {
  await openTest(page);
  const fmt = await page.evaluate(async () => await window.oreheart.cardFormat());
  expect(fmt.name).toBe('Card format final 1.0');
  const layoutNames = Array.isArray(fmt.layouts) ? fmt.layouts : Object.keys(fmt.layouts || {}); // Round 16: layouts may be a name list or a name-keyed object
  for (const k of ['unit', 'commander', 'spell', 'instant', 'crystal', 'back']) expect(layoutNames, k).toContain(k);
  for (const id of ['goblin-scrounger', 'fireball', 'healing-light', 'soul-shard', 'grubnak', 'back']) {
    const r = await renderAndMeasure(page, id, 624);
    expect(r.cls.split(/\s+/), id).toContain('cardc');
    expect(Math.abs(r.h - 624), `${id} height`).toBeLessThanOrEqual(1);
    expect(Math.abs(r.w - 420), `${id} width`).toBeLessThanOrEqual(1);
  }
  const gob = await renderAndMeasure(page, 'goblin-scrounger');
  const gno = await renderAndMeasure(page, 'gnome-prospector');
  expect(gob.imgs.some((s) => /card-format\/images\//.test(s))).toBe(true);
  expect(gob.imgs.join('|'), 'faction frames differ').not.toBe(gno.imgs.join('|'));
  for (const r of [gob, gno]) expect(r.imgs.join('|')).not.toContain('/art/frames/');
});

test('AC311: every card face uses the new renderer, and the old frames are gone', async ({ page }) => {
  const requests = [];
  page.on('request', (r) => requests.push(r.url()));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { fs, path, dir } = await appDir();
  expect(fs.existsSync(path.join(dir, 'public/art/frames')), 'public/art/frames deleted').toBe(false);
  const checkFaces = async (scope, where) => {
    const faces = scope.locator('[data-card-id]');
    const n = await faces.count();
    expect(n, `${where}: card faces`).toBeGreaterThan(0);
    const bad = await faces.evaluateAll((els) => els.filter((e) => e.offsetWidth > 10).filter((e) =>
      e.getAttribute('data-card-format') !== 'Card format final 1.0' || !e.getAttribute('data-layout') || e.querySelectorAll('.cardc').length !== 1)
      .map((e) => e.getAttribute('data-card-id')));
    expect(bad, `${where}: faces not drawn by the card format`).toEqual([]);
  };
  await start(page, quiet({ playerHand: ['goblin-scrounger', 'venom-shiv', 'soul-shard'], opponentHand: ['fireball', 'fireball'] }));
  const hand = page.getByLabel('Your hand', { exact: true });
  await checkFaces(hand, 'hand');
  await expect(hand.locator('[data-card-id="venom-shiv"]').first()).toHaveAttribute('data-layout', 'spell');
  await expect(hand.locator('[data-card-id="soul-shard"]').first()).toHaveAttribute('data-layout', 'crystal');
  await expect(hand.locator('[data-card-id="goblin-scrounger"]').first()).toHaveAttribute('data-layout', 'unit');
  const backs = page.getByLabel('Enemy hand', { exact: true }).locator('[data-layout="back"]');
  expect(await backs.count(), 'enemy card backs').toBeGreaterThan(0);
  expect(await backs.first().locator('.cardc').count()).toBe(1);
  await page.getByRole('button', { name: 'Venom Shiv', exact: true }).click();
  const view = page.getByRole('dialog', { name: 'Venom Shiv' });
  await expect(view).toBeVisible();
  await checkFaces(view, 'close-up');
  await page.keyboard.press('Escape');
  await openDecks(page);
  await expect(allCards(page).locator('[data-card-id]').first()).toBeVisible();
  await checkFaces(allCards(page), 'deck builder');
  await page.goto('/?test=1');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose Your Commander' })).toBeVisible();
  const cmd = page.locator('[data-layout="commander"]');
  await expect(cmd.first()).toBeVisible();
  expect(await cmd.count(), 'commander cards').toBeGreaterThanOrEqual(2);
  expect(await cmd.first().locator('.cardc').count()).toBe(1);
  expect(requests.filter((u) => u.includes('/art/frames/')), 'old frame requests').toEqual([]);
  expect(errors).toEqual([]);
});

test('AC312: the 8 reference cards render at 420x624 with their name and cost, and text fits', async ({ page }) => {
  await openTest(page);
  for (const id of REF_CARDS) {
    const card = await page.evaluate(async (x) => await window.oreheart.getCard(x), id);
    const r = await renderAndMeasure(page, id, 624);
    expect(Math.abs(r.w - 420) <= 1 && Math.abs(r.h - 624) <= 1, `${id} size ${r.w}x${r.h}`).toBe(true);
    expect(r.text.toUpperCase(), `${id} name`).toContain(card.name.toUpperCase());
    expect(r.text, `${id} cost`).toContain(String(card.cost));
    expect(r.overflow, `${id} overflowing text`).toEqual([]);
    expect(r.text, `${id} no truncation`).not.toContain('…');
  }
  const crystal = await renderAndMeasure(page, 'soul-shard', 624);
  expect(crystal.artCover, 'Crystal card picture is full-bleed').toBeGreaterThanOrEqual(0.95);
});

test('AC313: a card\'s artPos is honored in the art layer', async ({ page }) => {
  await openTest(page);
  const card = await page.evaluate(async () => await window.oreheart.getCard('second-wind'));
  const { s, x, y } = card.artPos;
  const r = await renderAndMeasure(page, 'second-wind', 624);
  expect(r.html).toContain('artclip');
  expect(r.html.replace(/\s/g, '')).toContain(`translate(${x}%,${y}%)scale(${s})`);
});

test('AC314: the three card-format fonts are bundled locally and loaded', async ({ page }) => {
  const google = [];
  page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url()) && /russo|fell|alegreya/i.test(r.url())) google.push(r.url()); });
  await start(page, quiet({ playerHand: ['goblin-scrounger', 'fireball'] }));
  await page.evaluate(async () => { await document.fonts.ready; });
  const fams = await page.evaluate(async () => {
    const out = {};
    for (const f of ['Alegreya SC', 'Russo One', 'IM Fell English SC']) {
      await document.fonts.load(`20px "${f}"`).catch(() => {});
      out[f] = [...document.fonts].some((ff) => ff.family.replace(/["']/g, '') === f && ff.status === 'loaded');
    }
    return out;
  });
  expect(fams).toEqual({ 'Alegreya SC': true, 'Russo One': true, 'IM Fell English SC': true });
  expect(google).toEqual([]);
  const { fs, path, dir } = await appDir();
  const files = [...walk(fs, path, path.join(dir, 'public')), ...walk(fs, path, path.join(dir, 'src'))].map((f) => path.basename(f).toLowerCase());
  for (const k of ['russo', 'fell']) expect(files.some((f) => f.includes(k) && /\.(woff2?|ttf|otf)$/.test(f)), `${k} font file bundled`).toBe(true);
  const credits = fs.readFileSync(path.join(dir, 'CREDITS.md'), 'utf8');
  for (const k of ['Russo One', 'IM Fell English SC']) expect(credits).toContain(k);
});

test.describe('round 12d screenshots (1920x1080)', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC315: hand, close-up, Deck Builder, Choose Your Commander and reference cards render without errors', async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const shot = async (name) => testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
    await start(page, quiet({ playerHand: ['goblin-scrounger', 'goblin-scrapper', 'venom-shiv', 'soul-shard', 'fireball'] }));
    await expect(page.getByLabel('Your hand', { exact: true }).locator('.cardc').first()).toBeVisible();
    await shot('r12d-hand');
    await page.getByRole('button', { name: 'Venom Shiv', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Venom Shiv' })).toBeVisible();
    await shot('r12d-close-up');
    await page.keyboard.press('Escape');
    await page.evaluate(async (ids) => {
      const host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#111;display:flex;gap:16px;padding:16px';
      for (const id of ids) host.insertAdjacentHTML('beforeend', await window.oreheart.renderCard(id, 624));
      document.body.appendChild(host);
      host.querySelectorAll('.cardc').forEach((c) => window.oreheart.fitText && window.oreheart.fitText(c));
    }, ['goblin-scrounger', 'fireball', 'soul-shard']);
    await page.waitForTimeout(500);
    await shot('r12d-reference-cards');
    await openDecks(page);
    await expect(allCards(page).locator('.cardc').first()).toBeVisible();
    await shot('r12d-deck-builder');
    await page.goto('/?test=1');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Choose Your Commander' })).toBeVisible();
    await shot('r12d-choose-commander');
    expect(errors).toEqual([]);
  });
});

// ======================= Round 13 =======================
async function pickDeckCommander(page, label) {
  const g = page.getByRole('group', { name: 'Deck Commander', exact: true });
  await g.getByRole('button', { name: label, exact: true }).click();
  await expect(g.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
}
const R13_SPELLS = ['prospectors-prayer', 'healing-light', 'fizzle', 'venom-shiv', 'hold-it', 'tunnel-rush'];
// problems list for a card face: name/rules text hidden or covered by a dark background (R13.1)
const spellBoxProblems = (page, sel) => page.evaluate(async (s) => {
  const face = document.querySelector(s);
  if (!face) return ['no face ' + s];
  face.scrollIntoView({ block: 'center' });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const id = face.getAttribute('data-card-id');
  const card = await window.oreheart.getCard(id);
  const root = face.querySelector('.cardc');
  const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const txs = [...root.querySelectorAll('.tx')];
  const nameEl = txs.find((e) => norm(e.textContent) === norm(card.name));
  const textEl = txs.find((e) => e !== nameEl && norm(e.textContent).startsWith(norm(card.text).slice(0, 12)));
  const out = [];
  for (const [k, el] of [['name', nameEl], ['text', textEl]]) {
    if (!el) { out.push(`${id}: no ${k} element`); continue; }
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (r.width < 4 || r.height < 4 || cs.visibility === 'hidden' || cs.opacity === '0') { out.push(`${id}: ${k} hidden`); continue; }
    const cx = r.x + r.width / 2, cy = r.y + Math.min(r.height / 2, 12);
    for (const x of root.querySelectorAll('*')) {
      if (x.tagName === 'IMG' || x === el || el.contains(x)) continue;
      const b = x.getBoundingClientRect();
      if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) continue;
      const m = getComputedStyle(x).backgroundColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
      if (!m) continue;
      const a = m[4] === undefined ? 1 : +m[4];
      if (a >= 0.4 && +m[1] < 90 && +m[2] < 90 && +m[3] < 90) out.push(`${id}: dark box over ${k} (${x.className})`);
    }
  }
  return out;
}, sel);

test('AC316: spell faces show their name and text without dark boxes (Deck Builder and hand)', async ({ page }) => {
  await openDecks(page);
  await pickDeckCommander(page, 'Grubnak Rotgut, Goblin King');
  await chooseFilter(page, 'Type', 'Spells');
  const probs = [];
  for (const id of R13_SPELLS) probs.push(...await spellBoxProblems(page, `[aria-label="All cards"] [data-card-id="${id}"]`));
  expect(probs).toEqual([]);
  await start(page, q12({ playerHand: R13_SPELLS }));
  await page.waitForTimeout(600);
  for (const id of R13_SPELLS) probs.push(...await spellBoxProblems(page, `[aria-label="Your hand"] [data-card-id="${id}"]`));
  expect(probs).toEqual([]);
});

test('AC317: every card face applies its owner artPos exactly', async ({ page }) => {
  await openDecks(page);
  const bad = [];
  let checked = 0;
  for (const cmd of ['Grubnak Rotgut, Goblin King', 'Knobbin the Gnomeificent', 'Thane Borgo Gravelgrim']) {
    await pickDeckCommander(page, cmd);
    await page.waitForTimeout(300);
    const r = await page.evaluate(async () => {
      const out = { bad: [], n: 0 };
      for (const face of document.querySelectorAll('[aria-label="All cards"] [data-card-id]')) {
        const id = face.getAttribute('data-card-id');
        const c = await window.oreheart.getCard(id);
        const ap = c && c.artPos;
        if (!ap || (+ap.s === 1 && !+ap.x && !+ap.y)) continue;
        out.n++;
        const img = face.querySelector('.artclip img');
        const want = `translate(${+ap.x || 0}%,${+ap.y || 0}%)scale(${+ap.s || 1})`;
        if (!img || !(img.getAttribute('style') || '').replace(/\s/g, '').includes(want)) out.bad.push(`${id}: want ${want}`);
      }
      return out;
    });
    bad.push(...r.bad); checked += r.n;
  }
  expect(checked).toBeGreaterThan(0);
  expect(bad).toEqual([]);
});

test('AC318: units with activated abilities show a round ability button above them', async ({ page }) => {
  let s = await start(page, q12({ playerCrystals: 4, board: [P('goblin-scrapper', 6, 9), P('junk-shaman', 6, 4), O('dwarf-pickman', 3, 9)] }));
  s = await toAction(page);
  const strike = page.locator(`[data-ability="strike"][data-creature-uid="${at(s, 6, 9).uid}"]`);
  const pick = page.locator(`[data-ability="pickUp"][data-creature-uid="${at(s, 6, 4).uid}"]`);
  await expect(strike).toBeVisible();
  await expect(pick).toBeVisible();
  await expect(strike).toHaveAttribute('aria-label', /Bowler Brawler/);
  await expect(strike).toHaveAttribute('aria-label', /\(2\)/);
  const i1 = await strike.getAttribute('data-icon'), i2 = await pick.getAttribute('data-icon');
  expect(i1 && i2 && i1 !== i2).toBeTruthy();
  const c = await sq2s(page, 6, 9), n = await sq2s(page, 6, 10);
  const b = await strike.boundingBox();
  expect(Math.abs(b.x + b.width / 2 - c.x)).toBeLessThanOrEqual(Math.abs(n.x - c.x) * 0.6 + 2);
  // Owner change (Oct 25, 39d93d5c): the ability button sits in the unit's stat badge (in place of the unit-type icon), not above the unit
  expect(await strike.evaluate((el) => !!el.closest('[data-unit-badge]')), 'ability button lives in the stat badge').toBe(true);
  expect(Math.abs(b.y + b.height / 2 - c.y), 'badge stays with its unit').toBeLessThanOrEqual(Math.abs(n.x - c.x) * 1.5);
  const list = await page.evaluate(async () => await window.oreheart.getAbilityButtons());
  expect(list.some((x) => x.ability === 'strike' && x.cardId === 'goblin-scrapper' && x.cost === 2 && x.enabled === true)).toBe(true);
  expect(list.some((x) => x.ability === 'pickUp' && x.cardId === 'junk-shaman')).toBe(true);
});

test('AC319: ability buttons are greyed when unaffordable, on enemy units, or already used', async ({ page }) => {
  let s = await start(page, q12({ playerCrystals: 0, board: [P('goblin-scrapper', 6, 9), O('glyphshield-warden', 2, 4), O('dwarf-pickman', 3, 9)] }));
  s = await toAction(page);
  await expect(page.locator(`[data-ability="strike"][data-creature-uid="${at(s, 6, 9).uid}"]`)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator(`[data-ability="ward"][data-creature-uid="${at(s, 2, 4).uid}"]`)).toHaveAttribute('aria-disabled', 'true');
  s = await newMatch(page, q12({ playerCrystals: 6, board: [P('glyphshield-warden', 6, 4), P('goblin-scrounger', 6, 5), O('dwarf-pickman', 2, 9)] }));
  s = await toAction(page);
  const ward = page.locator(`[data-ability="ward"][data-creature-uid="${at(s, 6, 4).uid}"]`);
  await expect(ward).not.toHaveAttribute('aria-disabled', 'true');
  expect((await ability(page, s, 6, 4, 'ward', { target: { row: 6, col: 5 } })).ok).toBe(true);
  await expect(ward).toHaveAttribute('aria-disabled', 'true');
});

test('AC320: clicking the Strike button and a target pays 2 and knocks the enemy sideways; hover shows the ability text', async ({ page }) => {
  let s = await start(page, q12({ playerCrystals: 2, board: [P('goblin-scrapper', 6, 9), O('dwarf-pickman', 4, 9)] }));
  s = await toAction(page);
  const strike = page.locator(`[data-ability="strike"][data-creature-uid="${at(s, 6, 9).uid}"]`);
  await strike.hover();
  const tip = page.getByRole('tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('2');
  await expect(tip).toContainText(/Strike/i);
  await strike.click();
  const t = await sq2s(page, 5, 9);
  await page.mouse.click(t.x, t.y);
  await expect.poll(async () => (await getState(page)).players.player.crystals).toBe(0);
  s = await getState(page);
  const p = s.board.creatures.find((c) => c.cardId === 'dwarf-pickman');
  expect(p.row).toBe(4);
  expect([7, 8, 10, 11]).toContain(p.col);
});

test('AC321: Deck Builder — three Commander portraits by the title, no logo, other factions hidden not locked', async ({ page }) => {
  await openDecks(page);
  await expect(page.getByRole('img', { name: 'Oreheart' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Deck Commander' })).toHaveCount(0);
  const g = page.getByRole('group', { name: 'Deck Commander', exact: true });
  await expect(g.getByRole('button')).toHaveCount(3);
  const title = await page.getByRole('heading', { name: 'Deck Builder' }).boundingBox();
  const gb = await g.boundingBox();
  const W = page.viewportSize().width;
  expect(gb.x).toBeGreaterThanOrEqual(title.x + title.width - 4);
  expect(gb.x - (title.x + title.width)).toBeLessThanOrEqual(W * 0.25);
  expect(Math.abs((gb.y + gb.height / 2) - (title.y + title.height / 2))).toBeLessThanOrEqual(Math.max(title.height, gb.height));
  await pickDeckCommander(page, 'Grubnak Rotgut, Goblin King');
  await expect(g.getByRole('button', { name: 'Knobbin the Gnomeificent', exact: true })).toHaveAttribute('aria-pressed', 'false');
  const all = allCards(page);
  await expect(all.getByRole('button', { name: 'Searing Arcane Orb', exact: true })).toHaveCount(0);
  await expect(all.getByRole('button', { name: 'Gemsinger Miner', exact: true })).toHaveCount(0);
  await expect(all.getByRole('button', { name: 'Venom Shiv', exact: true })).toHaveCount(1);
  await expect(all.getByRole('button', { name: 'Field Bandage', exact: true })).toHaveCount(1);
  await expect(all).not.toContainText('Only for');
  await expect(all.locator('[aria-disabled="true"]')).toHaveCount(0);
  await pickDeckCommander(page, 'Knobbin the Gnomeificent');
  await expect(all.getByRole('button', { name: 'Venom Shiv', exact: true })).toHaveCount(0);
  await expect(all.getByRole('button', { name: 'Field Bandage', exact: true })).toHaveCount(1);
  const orb = all.getByRole('button', { name: 'Searing Arcane Orb', exact: true });
  await expect(orb).toHaveCount(1);
  const before = await deckSize(page).innerText();
  await orb.scrollIntoViewIfNeeded();
  await orb.dblclick();
  await expect(deckSize(page)).not.toHaveText(before);
  await pickDeckCommander(page, 'Thane Borgo Gravelgrim');
  await expect(all.getByRole('button', { name: 'Ironclad Bulwark', exact: true })).toHaveCount(1);
});

for (const [w, h] of [[1920, 1080], [1280, 720], [844, 390]]) {
  test.describe(`Deck Builder top bar ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test(`AC322: search, filters and Cards per row never overlap (${w}x${h})`, async ({ page }) => {
      await openDecks(page);
      const els = [page.getByRole('searchbox', { name: 'Search cards' }), page.getByLabel('Cards per row', { exact: true }),
        page.getByRole('heading', { name: 'Deck Builder' }), page.getByRole('group', { name: 'Deck Commander', exact: true })];
      for (const f of ['Faction', 'Type', 'Cost', 'Rarity']) els.push(page.getByRole('combobox', { name: f, exact: true }));
      const boxes = [];
      for (const e of els) { await expect(e).toBeVisible(); boxes.push(await e.boundingBox()); }
      const ov = (a, b) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(ov(boxes[i], boxes[j]), `${i} overlaps ${j}`).toBe(false);
    });
  });
}

for (const [w, h] of [[1920, 1080], [844, 390]]) {
  test.describe(`title card stack ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test(`AC323: the Begin gate shows a fanned Oreheart deck with Click to begin over it (${w}x${h})`, async ({ page }) => {
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/?test=1&intro=1&begin=1');
      const gate = page.getByLabel('Begin', { exact: true });
      await expect(gate).toBeVisible();
      await expect(gate.getByRole('img', { name: 'Oreheart' })).toHaveCount(0);
      const deck = gate.getByLabel('Oreheart deck', { exact: true });
      await expect(deck).toBeVisible();
      const backs = deck.locator('[data-layout="back"]');
      expect(await backs.count()).toBeGreaterThanOrEqual(3);
      const info = await backs.evaluateAll((els) => els.map((e) => ({ cardc: !!e.querySelector('.cardc'), t: getComputedStyle(e).transform })));
      expect(info.every((x) => x.cardc)).toBe(true);
      expect(new Set(info.map((x) => x.t)).size).toBeGreaterThanOrEqual(2);
      const db = await deck.boundingBox();
      expect(Math.abs(db.x + db.width / 2 - w / 2)).toBeLessThanOrEqual(w * 0.08);
      const cb = await page.getByRole('button', { name: 'Click to begin', exact: true }).boundingBox();
      expect(cb.x < db.x + db.width && db.x < cb.x + cb.width && cb.y < db.y + db.height && db.y < cb.y + cb.height).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`r13-title-${w}.png`) });
      expect(errors).toEqual([]);
    });
  });
}

test('AC324: Knobbin and Thane Borgo can be picked and a match starts with the chosen Commander', async ({ page }) => {
  for (const [label, id] of [['Knobbin the Gnomeificent', 'sproingle'], ['Thane Borgo Gravelgrim', 'borgo']]) {
    await page.goto('/?test=1&seed=7');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Choose Your Commander' })).toBeVisible();
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Fight!', exact: true }).click();
    const keep = page.getByRole('button', { name: 'Keep Hand', exact: true });
    await expect(keep).toBeVisible();
    await keep.click();
    await expect.poll(async () => (await getState(page)).players.player.commanderId).toBe(id);
  }
});

test.describe('Round 13 screenshots 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC325: title, Deck Builder with spells, hand with spells, spell close-up and an ability button render without errors', async ({ page }) => {
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const shot = (n) => page.screenshot({ path: test.info().outputPath(`r13-${n}.png`) });
    await page.goto('/?test=1&intro=1&begin=1');
    await expect(page.getByRole('button', { name: 'Click to begin', exact: true })).toBeVisible();
    await shot('title');
    await openDecks(page);
    await chooseFilter(page, 'Type', 'Spells');
    await shot('deck-builder-spells');
    let s = await start(page, q12({ playerCrystals: 4, playerHand: ['venom-shiv', 'hold-it', 'healing-light', 'goblin-scrapper'], board: [P('goblin-scrapper', 6, 9), O('dwarf-pickman', 4, 9)] }));
    await page.waitForTimeout(800);
    await shot('hand-spells');
    await page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Venom Shiv', exact: true }).click();
    await page.waitForTimeout(500);
    await shot('spell-closeup');
    await page.keyboard.press('Escape');
    s = await toAction(page);
    const strike = page.locator(`[data-ability="strike"][data-creature-uid="${at(s, 6, 9).uid}"]`);
    await strike.hover();
    await strike.click();
    await shot('ability-button');
    expect(errors).toEqual([]);
  });
});

// ---------- Phase 1B Round 14 (AC326–AC332) ----------
const hexToRgb = (h) => { const n = parseInt(h.replace('#', ''), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
// the computed style of the element that actually draws a HUD piece's text
const hudTextStyle = (page, role) => page.locator(`[data-hud-role="${role}"]`).first().evaluate((root) => {
  let el = root;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.textContent.trim()) { el = n.parentElement; break; }
  const cs = getComputedStyle(el);
  return { color: cs.color, size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10), style: cs.fontStyle, visible: root.getBoundingClientRect().width > 0 };
});

for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`round 14 owner text style ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });
    test(`AC326: every HUD text uses the owner's size, bold and italic, in white (${W}x${H})`, async ({ page, request }) => {
      const L = await ownerLayout(request);
      await start(page, R9_MATCH());
      const h = await hud(page);
      const fh = h.frame.height;
      const pieces = L.hud.filter((x) => x.role && x.text && !x.hidden && x.role !== 'done-button');
      expect(pieces.length).toBeGreaterThanOrEqual(12);
      for (const p of pieces) {
        if (p.role === 'phase-timer' && !(await page.locator('[data-hud-role="phase-timer"]').count())) continue; // the timer may be hidden early in a phase
        const st = await hudTextStyle(page, p.role);
        expect(st.color, `${p.role} color`).toBe('rgb(255, 255, 255)'); // Round 15: white overrides the layout's text colors
        const want = Math.max(p.text.size / 100 * fh * (L.textScale || 1), H <= 500 ? 14 : 0); // Round 16: the 14 px phone minimum (AC158) wins over smaller layout sizes
        expect(Math.abs(st.size - want), `${p.role} size ${st.size} vs ${want}`).toBeLessThanOrEqual(Math.max(1.5, want * 0.1));
        expect(st.weight >= 600, `${p.role} bold`).toBe(!!p.text.bold);
        expect(st.style === 'italic', `${p.role} italic`).toBe(!!p.text.italic);
      }
      // the moved pieces: your commander name by the Flow crystal, the bigger Menu text
      const name = h.pieces.find((q) => q.role === 'player-name');
      expect(Math.abs(name.rect.y - (H - fh) - 70.99 / 100 * fh)).toBeLessThanOrEqual(fh * 0.01 + 1);
      await expect(page.locator('[data-hud-role="player-name"]').first()).toContainText('Grubnak Rotgut');
    });
  });
}

test.describe('round 14 Done text 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC326: the Done button uses the owner\'s size 5.7 in white when it shows', async ({ page, request }) => {
    const L = await ownerLayout(request);
    const d = L.hud.find((x) => x.role === 'done-button');
    await start(page, quiet({ playerHand: ['goblin-scrapper'], playerCrystals: 6 }));
    const btn = page.getByRole('button', { name: 'Done', exact: true });
    await expect(btn).toBeVisible();
    const fh = (await hud(page)).frame.height;
    const st = await hudTextStyle(page, 'done-button');
    expect(st.color).toBe('rgb(255, 255, 255)');
    expect(Math.abs(st.size - d.text.size / 100 * fh)).toBeLessThanOrEqual(d.text.size / 100 * fh * 0.1);
  });
});

test.describe('round 14 fanned hand 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC327: your hand is a flat fan (at most 1.4° per card, no arc; Ken, Oct 30), hover straightens and pops the card 1.6x', async ({ page }) => {
    // owner check change (Ken, Oct 30 hand spec): was 4° per card with an arc ("do less of a fan")
    await start(page, quiet({ playerHand: ['goblin-scrapper', 'fireball', 'soul-shard', 'goblin-slinger', 'venom-shiv'] }));
    await page.mouse.move(960, 200);
    const cards = handCards7(page);
    await expect(cards).toHaveCount(5);
    await expect.poll(async () => (await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-fan-angle')))).every((a) => a !== null)).toBe(true);
    const ang = (await cards.evaluateAll((els) => els.map((e) => parseFloat(e.getAttribute('data-fan-angle')))));
    ang.forEach((a, i) => expect(Math.abs(a - (i - 2) * 1.4), `card ${i} angle ${a}`).toBeLessThanOrEqual(0.3));
    const box = [];
    for (let i = 0; i < 5; i++) box.push(await cards.nth(i).boundingBox());
    // rotated cards have slightly wider bounding boxes; no arc: the outer cards sit level with the middle one
    expect(box[0].width).toBeGreaterThan(box[2].width * 1.02);
    expect(box[4].width).toBeGreaterThan(box[2].width * 1.02);
    expect(Math.abs(box[0].y - box[2].y)).toBeLessThanOrEqual(box[2].height * 0.04);
    expect(Math.abs(box[4].y - box[2].y)).toBeLessThanOrEqual(box[2].height * 0.04);
    for (let i = 1; i < 5; i++) expect(box[i].x).toBeGreaterThan(box[i - 1].x);
    const restH = box[2].height;
    const pt = await hoverPointOf(cards.nth(0));
    await page.mouse.move(pt[0], pt[1], { steps: 4 });
    await expect.poll(async () => parseFloat(await cards.nth(0).getAttribute('data-fan-angle'))).toBe(0);
    await expect.poll(async () => (await cards.nth(0).boundingBox()).height / restH, { timeout: 4000 }).toBeGreaterThan(1.4);
    expect((await cards.nth(0).boundingBox()).height / restH).toBeLessThan(1.85);
  });

  test('AC328: the enemy hand is a fan of card backs, 9° apart, at most 6 shown', async ({ page }) => {
    await start(page, quiet({ opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard', 'goblin-slinger', 'venom-shiv', 'fizzle', 'fireball'] }));
    const backs = page.locator('[data-hud-role="enemy-hand"] [data-fan-angle]');
    await expect(backs).toHaveCount(6);
    const a = (await backs.evaluateAll((els) => els.map((e) => parseFloat(e.getAttribute('data-fan-angle'))))).sort((x, y) => x - y);
    for (let i = 1; i < a.length; i++) expect(Math.abs(a[i] - a[i - 1] - 9)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(a[0] + a[a.length - 1])).toBeLessThanOrEqual(0.6); // centered
  });
});

test.describe('round 14 crystal flow 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC329: shards fly from the mine to each side\'s Flow crystal icon, which pulses on arrival', async ({ page }) => {
    await start(page, { ...quiet({ board: [
      { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 },
      { cardId: 'gnome-tinker', owner: 'opponent', row: 3, col: 6, minedMine: M3 },
    ] }), firstPlayer: 'player' });
    const streams = () => page.evaluate(async () => await window.oreheart.getFlowStreams());
    const inside = async (role, pt) => {
      const b = await page.locator(`[data-hud-role="${role}"]`).first().boundingBox();
      return pt.x >= b.x - 4 && pt.x <= b.x + b.width + 4 && pt.y >= b.y - 4 && pt.y <= b.y + b.height + 4;
    };
    await passTurn(page);
    await expect.poll(async () => (await streams()).log.some((x) => x.side === 'opponent')).toBe(true);
    const o = (await streams()).log.find((x) => x.side === 'opponent');
    expect(o.to).toBe('enemy-flow-crystal');
    expect(await inside('enemy-flow-crystal', o.toPoint)).toBe(true);
    await expect.poll(async () => (await streams()).pulses.opponent, { timeout: 8000 }).toBeGreaterThanOrEqual(1);
    await passTurn(page);
    await expect.poll(async () => (await streams()).log.some((x) => x.side === 'player')).toBe(true);
    const p = (await streams()).log.find((x) => x.side === 'player');
    expect(p.to).toBe('player-flow-crystal');
    expect(await inside('player-flow-crystal', p.toPoint)).toBe(true);
    await expect.poll(async () => (await streams()).pulses.player, { timeout: 8000 }).toBeGreaterThanOrEqual(1);
  });
});

test('AC330: more shards per mine when that side\'s Flow is higher (2 at Flow 1 up to about 12)', async ({ page }) => {
  await openTest(page);
  const n = await page.evaluate(async () => { const r = []; for (let f = 0; f <= 16; f++) r.push(await window.oreheart.flowShardCount(f)); return r; });
  expect(n[1]).toBe(2);
  for (let f = 2; f <= 16; f++) expect(n[f], `Flow ${f}`).toBeGreaterThanOrEqual(n[f - 1]);
  expect(n[16]).toBeGreaterThanOrEqual(10);
  expect(n[16]).toBeLessThanOrEqual(14);
  expect(n[8]).toBeGreaterThan(n[2]);
  await newMatch(page, { ...quiet({ board: [
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 1, minedMine: M1 },
    { cardId: 'goblin-scrounger', owner: 'player', row: 3, col: 1, minedMine: M1 },
    { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 3, minedMine: M2 },
  ] }), firstPlayer: 'opponent' });
  await passTurn(page);
  await expect.poll(async () => (await page.evaluate(async () => await window.oreheart.getFlowStreams())).log.some((x) => x.side === 'player')).toBe(true);
  const s = await getState(page);
  const log = (await page.evaluate(async () => await window.oreheart.getFlowStreams())).log.filter((x) => x.side === 'player');
  for (const e of log) {
    expect(e.flow).toBe(s.players.player.flow);
    expect(e.count).toBe(n[Math.min(16, e.flow)]);
  }
});

test('AC331: Corpsman Brewlord heals an adjacent wounded dwarf once per turn; the dwarf is Drunk for 2 rounds and can\'t be healed', async ({ page }) => {
  let s = await start(page, q12({ playerHand: ['healing-light'], playerCrystals: 6, board: [
    P('brewmaster', 6, 9), P('dwarf-pickman', 6, 10, { damage: 2 }), P('dwarf-pickman', 7, 9, { damage: 1 }),
    P('dwarf-pickman', 6, 12, { damage: 2 }), P('goblin-scrapper', 5, 9, { damage: 1 }), P('dwarf-pickman', 7, 11, { damage: 2, drunk: 2 }),
  ] }, { playerCommander: 'borgo' }));
  const card = await page.evaluate(async () => await window.oreheart.getCard('brewmaster'));
  expect(card.text).toMatch(/Drunk for 2 rounds/);
  const full = at(s, 6, 10).health + 2;
  const drunkOld = at(s, 7, 11);
  expect(drunkOld.drunk).toBe(2);
  // Field Bandage can't heal a drunk dwarf
  const fb = await act(page, { type: 'cast', uid: handUid(s, 'player', 'healing-light'), target: { row: 7, col: 11 } });
  s = await getState(page);
  expect(at(s, 7, 11).health).toBe(drunkOld.health);
  expect(fb.ok === false || at(s, 7, 11).health === drunkOld.health).toBe(true);
  expect((await ability(page, s, 6, 9, 'brew', { target: { row: 6, col: 12 } })).ok).toBe(false); // not adjacent
  expect((await ability(page, s, 6, 9, 'brew', { target: { row: 5, col: 9 } })).ok).toBe(false); // not a dwarf
  expect((await ability(page, s, 6, 9, 'brew', { target: { row: 6, col: 10 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 10).health).toBe(full);
  expect(at(s, 6, 10).drunk).toBe(2);
  await expect(page.locator(`[data-uid="${at(s, 6, 10).uid}"]`).first()).toHaveAttribute('data-drunk', '2');
  expect((await ability(page, s, 6, 9, 'brew', { target: { row: 7, col: 9 } })).ok).toBe(false); // once per turn
  // one round later: still drunk (1), and the start-of-turn refresh does not heal a drunk dwarf
  await passTurn(page); await passTurn(page);
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  const old = s.board.creatures.find((c) => c.uid === drunkOld.uid);
  expect(old.drunk).toBe(1);
  expect(old.health).toBe(drunkOld.health);
  await passTurn(page); await passTurn(page);
  s = await getState(page);
  expect(s.board.creatures.find((c) => c.uid === drunkOld.uid).drunk || 0).toBe(0);
  await expect(page.locator(`[data-uid="${drunkOld.uid}"]`).first()).not.toHaveAttribute('data-drunk', /[1-9]/);
});

test('AC332: on the enemy\'s turn, Brewlord saves an adjacent dwarf from a lethal hit: it survives with 1 Health and is Drunk', async ({ page }) => {
  let s = await start(page, q12({ board: [
    P('brewmaster', 6, 9), P('dwarf-pickman', 6, 10, { damage: 6 }), O('goblin-scrapper', 5, 10),
  ] }, { playerCommander: 'borgo', firstPlayer: 'opponent' }));
  const pick = at(s, 6, 10).uid, brew = at(s, 6, 9).uid;
  // the ability button is lit on the enemy's turn
  await done(page); // opponent -> action
  s = await getState(page);
  expect(s.activePlayer).toBe('opponent');
  const brewBtn = page.locator(`[data-ability="brew"][data-creature-uid="${brew}"]`);
  await expect(brewBtn).toBeVisible();
  await expect(brewBtn).not.toHaveAttribute('aria-disabled', 'true');
  // a lethal hit opens a Respond window for the Brewlord's owner
  const hp = at(s, 6, 10).health;
  expect(hp).toBe(1); // Ironjaw Big Back 6 Health + 1 (Borgo), 6 damage
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 10).uid, target: { row: 6, col: 10 } })).ok).toBe(true);
  s = await getState(page);
  expect(s.pendingResponse && s.pendingResponse.responder).toBe('player');
  expect((await legal(page)).some((a) => a.type === 'ability' && a.creatureUid === brew && a.ability === 'brew')).toBe(true);
  expect((await act(page, { type: 'ability', creatureUid: brew, ability: 'brew', target: { row: 6, col: 10 } })).ok).toBe(true);
  s = await getState(page);
  const d = s.board.creatures.find((c) => c.uid === pick);
  expect(d).toBeTruthy();
  expect(d.health).toBe(1);
  expect(d.drunk).toBe(2);
});

// ---------- Phase 1B Round 15 (AC333–AC337) ----------
const facingOf = async (page, uid) => (await getState(page)).board.creatures.find((c) => c.uid === uid).facing;

test('AC333: a unit faces the way it moved and keeps that facing a full round later (state and data-facing)', async ({ page }) => {
  let s = await start(page, quiet({ playerDeck: SHARDS, opponentDeck: SHARDS, board: [P('wolf-rider', 6, 6), O('dwarf-pickman', 2, 9)] }));
  const uid = at(s, 6, 6).uid;
  expect(await facingOf(page, uid)).toBe('N'); // player units start facing the enemy side
  expect(await facingOf(page, at(s, 2, 9).uid)).toBe('S');
  s = await toAction(page);
  expect((await act(page, { type: 'move', creatureUid: uid, row: 6, col: 8 })).ok).toBe(true);
  expect(await facingOf(page, uid)).toBe('E');
  await expect(page.getByLabel('Mangewolf Rider, row 6, column 8', { exact: true })).toHaveAttribute('data-facing', 'E');
  await done(page); // end Action -> enemy turn
  await passTurn(page); // enemy passes -> our next turn
  expect((await getState(page)).activePlayer).toBe('player');
  expect(await facingOf(page, uid)).toBe('E');
  await expect(page.getByLabel('Mangewolf Rider, row 6, column 8', { exact: true })).toHaveAttribute('data-facing', 'E');
  s = await toAction(page);
  expect((await act(page, { type: 'move', creatureUid: uid, row: 4, col: 8 })).ok).toBe(true);
  expect(await facingOf(page, uid)).toBe('N');
});

test('AC334: an attacker faces its target and a miner faces the node it mined; both keep it one turn later', async ({ page }) => {
  let s = await start(page, quiet({ playerDeck: SHARDS, opponentDeck: SHARDS, board: [
    P('wolf-rider', 5, 10), O('dwarf-pickman', 5, 11), P('goblin-scrounger', 5, 3)] }));
  const wolf = at(s, 5, 10).uid; const miner = at(s, 5, 3).uid;
  s = await toAction(page);
  expect((await act(page, { type: 'attack', creatureUid: wolf, target: { row: 5, col: 11 } })).ok).toBe(true);
  expect(await facingOf(page, wolf)).toBe('E');
  expect((await act(page, { type: 'mine', creatureUid: miner, row: M1.row, col: M1.col })).ok).toBe(true); // node at (4,2): up-left
  expect(await facingOf(page, miner)).toBe('NW');
  await done(page);
  await passTurn(page);
  expect((await getState(page)).activePlayer).toBe('player');
  expect(await facingOf(page, wolf)).toBe('E');
  expect(await facingOf(page, miner)).toBe('NW');
});

const badgeOf = (page, label) => page.getByLabel(label, { exact: true }).locator('[data-unit-badge]');
test.describe('round 15 unit badges 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC335: every unit has the owner stat badge: faction metal frame, type icon, live white Russo One numbers under its feet', async ({ page }) => {
    const units = [['goblin-scrapper', 'player', 6, 6], ['goblin-scrounger', 'player', 6, 8], ['goblin-slinger', 'player', 6, 10],
      ['dwarf-pickman', 'opponent', 2, 6], ['gnome-tinker', 'opponent', 2, 8]];
    await start(page, { ...quiet({ board: units.map(([cardId, owner, row, col]) => ({ cardId, owner, row, col })) }), factionLock: false });
    const metal = { goblins: 'rust', gnomes: 'silver', dwarves: 'gold' };
    const live = await getState(page); // live numbers (Commander buffs such as Borgo's +1 Health count)
    for (const [id, , row, col] of units) {
      const u = at(live, row, col);
      const c = await page.evaluate(async (x) => await window.oreheart.getCard(x), id);
      const type = /miner|smith|gatherer/i.test(c.role) ? 'pickaxe' : c.range != null ? 'bow' : 'sword';
      const b = badgeOf(page, `${c.name}, row ${row}, column ${col}`);
      await expect(b, c.name).toHaveCount(1);
      await expect(b).toHaveAttribute('data-metal', metal[c.faction]);
      await expect(b).toHaveAttribute('data-type', type);
      const srcs = await b.locator('img').evaluateAll((els) => els.map((e) => e.getAttribute('src')));
      expect(srcs.some((x) => x.endsWith(`badges/frame-${metal[c.faction]}.webp`)), `${c.name} frame`).toBe(true);
      expect(srcs.some((x) => x.endsWith(`badges/icon-${type}-${metal[c.faction]}.webp`)), `${c.name} icon`).toBe(true);
      await expect(b.locator('[data-stat="attack"]')).toHaveText(String(u.attack));
      await expect(b.locator('[data-stat="health"]')).toHaveText(String(u.health));
      await expect(b.locator('[data-stat="movement"]')).toHaveText(String(c.movement ?? c.move));
      const st = await b.locator('[data-stat="health"]').evaluate((e) => { const cs = getComputedStyle(e); return { color: cs.color, font: cs.fontFamily, weight: parseInt(cs.fontWeight, 10), outline: cs.webkitTextStrokeWidth, shadow: cs.textShadow }; });
      expect(st.font).toContain('Russo One');
      expect(st.weight === 400 || st.weight >= 700).toBe(true);
      expect(parseFloat(st.outline) > 0 || st.shadow !== 'none').toBe(true);
      const sq = await sq2s(page, row, col);
      const bb = await b.boundingBox();
      expect(bb.y + bb.height / 2, `${c.name} badge under the feet`).toBeGreaterThan(sq.y);
      expect(Math.abs(bb.x + bb.width / 2 - sq.x)).toBeLessThan(bb.width);
    }
  });
});

test('AC336: badge numbers update with damage (and the Health number stays live text)', async ({ page }) => {
  let s = await start(page, quiet({ board: [P('wolf-rider', 5, 10), O('ironhammer-berserker', 5, 11)] }));
  const enemy = await page.evaluate(async () => await window.oreheart.getCard('ironhammer-berserker'));
  const wolf = await page.evaluate(async () => await window.oreheart.getCard('wolf-rider'));
  s = await toAction(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 5, 10).uid, target: { row: 5, col: 11 } })).ok).toBe(true);
  s = await getState(page);
  const e = at(s, 5, 11); // 4 Health - 3 Attack: it survives
  await expect(badgeOf(page, `${enemy.name}, row 5, column 11`).locator('[data-stat="health"]')).toHaveText(String(e.health));
  expect(e.health).toBeLessThan(enemy.health);
  expect(e.health).toBeGreaterThan(0);
  expect(wolf.attack).toBeGreaterThan(0);
});

test.describe('round 15 screenshots 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC337: facing, a miner at a node, the bowling ball, white-text menus and the unit badges render without errors', async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const shot = async (n) => info.attach(n, { body: await page.screenshot(), contentType: 'image/png' });
    await toTitle(page);
    await shot('title-white-text');
    await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Deck Builder' })).toBeVisible();
    await shot('deck-builder-white-text');
    let s = await start(page, q12({ playerCrystals: 2, board: [P('goblin-scrapper', 6, 13), O('dwarf-pickman', 4, 13), P('goblin-scrounger', 2, 13), O('dwarf-pickman', 2, 12),
      P('wolf-rider', 6, 6), P('goblin-scrounger', 5, 3), O('gnome-tinker', 3, 8)] }));
    await shot('badges');
    s = await toAction(page);
    await act(page, { type: 'move', creatureUid: at(s, 6, 6).uid, row: 6, col: 8 });
    await act(page, { type: 'mine', creatureUid: at(s, 5, 3).uid, row: M1.row, col: M1.col });
    await page.waitForTimeout(600);
    await shot('moved-and-mining');
    await ability(page, s, 6, 13, 'strike', { target: { row: 5, col: 13 } });
    await page.waitForTimeout(400);
    await shot('bowling-ball-rolling');
    await page.waitForTimeout(1200);
    await shot('pins-scattered');
    expect(errors).toEqual([]);
  });
});

// ---------- Phase 1B Round 17 (AC338–AC347): game modes, stances, fixes ----------
const MODES = ['Standard', 'Card Play', 'Card Comp vs Card Comp'];
const STANCES = ['Aggressive', 'Mine Control', 'Guard', 'Free-for-all'];
const stanceBtn = (page, n) => page.getByLabel('Stance', { exact: true }).getByRole('button', { name: n, exact: true });
const cheb = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
const PLAYER_HOLD = { row: 7, col: 2 };
const ENEMY_HOLD = { row: 1, col: 12 };
// Card Play match from a setup board; units act only through autoActStep (unitAutoPlay: false)
const cardPlay = (extra, stance = 'freeforall') => ({ ...quiet(extra), mode: 'cardplay', stance, unitAutoPlay: false });
const stanceChoice = (page, uid) => page.evaluate(async (u) => await window.oreheart.stanceChoice(u), uid);
const autoStep = (page) => page.evaluate(async () => await window.oreheart.autoActStep());
const setStance = (page, n) => page.evaluate(async (x) => await window.oreheart.setStance(x), n);
const creature = (s, uid) => s.board.creatures.find((c) => c.uid === uid);

test('AC338: Choose Your Commander has one visible Fight! button and the three modes; the mode is remembered; Standard is the default and unchanged', async ({ page }) => {
  await toSelect(page);
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Fight!', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Fight!', exact: true }).click({ trial: true }); // nothing covers it
  for (const m of MODES) await expect(page.getByRole('button', { name: m, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Standard', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const d of ['Easy', 'Normal', 'Hard']) await expect(page.getByRole('button', { name: d, exact: true })).toBeVisible();
  // Standard: no stance buttons, units are moved by hand as before
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  let s = await keepAndGetState(page);
  expect(s.mode).toBe('standard');
  await expect(page.getByLabel('Stance', { exact: true })).toHaveCount(0);
  // choose Card Play: remembered after a reload
  await toSelect(page);
  await page.getByRole('button', { name: 'Card Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Card Play', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await toSelect(page);
  await expect(page.getByRole('button', { name: 'Card Play', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Standard', exact: true })).not.toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Fight!', exact: true }).click();
  s = await keepAndGetState(page);
  expect(s.mode).toBe('cardplay');
  for (const n of STANCES) await expect(stanceBtn(page, n)).toBeVisible();
  await expect(stanceBtn(page, 'Free-for-all')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.oreheart.getStance())).toBe('freeforall');
  await stanceBtn(page, 'Guard').click();
  await expect(stanceBtn(page, 'Guard')).toHaveAttribute('aria-pressed', 'true');
  await expect(stanceBtn(page, 'Free-for-all')).not.toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.oreheart.getStance())).toBe('guard');
  for (const n of STANCES) expect((await stanceBtn(page, n).getAttribute('title')) || '', `${n} description`).not.toBe('');
});

test('AC339: in Card Play the player plays cards but can never move, attack or mine with units by hand; units act on their own', async ({ page }) => {
  let s = await start(page, cardPlay({ playerHand: ['goblin-scrounger'], playerCrystals: 5, playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [P('goblin-pebbler', 6, 6), O('dwarf-pickman', 2, 9)] }));
  expect(s.mode).toBe('cardplay');
  const uid = at(s, 6, 6).uid;
  expect((await legal(page)).some((a) => a.type === 'summon')).toBe(true);
  s = await toAction(page);
  const L = await legal(page);
  expect(L.some((a) => ['move', 'attack', 'mine', 'swap'].includes(a.type)), JSON.stringify(L.slice(0, 5))).toBe(false);
  const r = await act(page, { type: 'move', creatureUid: uid, row: 5, col: 6 });
  expect(r.ok).toBe(false);
  expect(creature(await getState(page), uid)).toMatchObject({ row: 6, col: 6 });
  // the unit acts by itself through the stance AI (one legal action)
  const step = await autoStep(page);
  expect(step.ok, JSON.stringify(step)).toBe(true);
  expect(step.action.creatureUid).toBe(uid);
  const c = creature(await getState(page), uid);
  expect(c.hasMoved || c.hasAttacked || c.hasMined).toBe(true);
});

test('AC340: Aggressive — a Fighter next to the enemy Commander hits it; a far Fighter moves toward it', async ({ page }) => {
  let s = await start(page, cardPlay({ playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [P('goblin-pebbler', 2, 11), P('shiv-rat', 6, 5), O('dwarf-smith-miner', 3, 11)] }, 'aggressive'));
  const near = at(s, 2, 11).uid; const far = at(s, 6, 5).uid;
  s = await toAction(page);
  const hp = s.players.opponent.health;
  const ch = await stanceChoice(page, near);
  expect(ch.type).toBe('attack');
  expect(ch.target).toEqual({ commander: 'opponent' });
  const chFar = await stanceChoice(page, far);
  expect(chFar.type).toBe('move');
  expect(cheb(chFar, ENEMY_HOLD)).toBeLessThan(cheb({ row: 6, col: 5 }, ENEMY_HOLD));
  expect((await autoStep(page)).ok).toBe(true); // reading order: the row-2 Fighter acts first
  s = await getState(page);
  expect(s.players.opponent.health).toBe(hp - creature(s, near).attack); // exactly its Attack
  expect((await autoStep(page)).ok).toBe(true);
  s = await getState(page);
  expect(cheb(creature(s, far), ENEMY_HOLD)).toBeLessThan(cheb({ row: 6, col: 5 }, ENEMY_HOLD));
});

test('AC341: Mine Control — a Miner attacks an adjacent enemy Miner only if it survives, and mines when crystals are low', async ({ page }) => {
  // mines at (4,2), (4,4), (4,6); our Miner at (5,4) beside mine (4,4); the enemy Miner at (5,5)
  // Rule check (Oct 28): Dwarves beat Goblins (+1 type advantage), so the enemy Miner strikes back for 2; Shield 2 is what lets a 1-Health Goblin Miner survive the trade
  const board = (shield) => [P('goblin-scrounger', 5, 4, shield ? { shield: 2 } : {}), O('dwarf-smith-miner', 5, 5)];
  const base = { playerDeck: SHARDS, opponentDeck: SHARDS, playerCrystals: 16, playerHand: ['goblin-scrounger', 'goblin-pebbler'] };
  // survives the strike back (Shield 2 against a 2-damage counter) and has plenty of crystals -> attacks
  let s = await start(page, cardPlay({ ...base, board: board(true) }, 'minecontrol'));
  let uid = at(s, 5, 4).uid;
  await toAction(page);
  let ch = await stanceChoice(page, uid);
  expect(ch.type).toBe('attack');
  expect(sameTarget(ch.target, 5, 5)).toBe(true);
  // would die in the trade (1/1 vs 1/1) -> mines instead
  s = await start(page, cardPlay({ ...base, board: board(false) }, 'minecontrol'));
  uid = at(s, 5, 4).uid;
  await toAction(page);
  ch = await stanceChoice(page, uid);
  expect(ch.type).toBe('mine');
  expect({ row: ch.row, col: ch.col }).toEqual({ row: 4, col: 4 });
  // survives, but low on crystals (0 Flow, 0 Bank, hand it cannot pay for) -> mines
  s = await start(page, cardPlay({ ...base, playerCrystals: 0, playerBank: 0, playerHand: ['wolf-rider', 'goblin-scrapper', 'shiv-rat'], board: board(true) }, 'minecontrol'));
  uid = at(s, 5, 4).uid;
  await toAction(page);
  ch = await stanceChoice(page, uid);
  expect(ch.type).toBe('mine');
  expect((await autoStep(page)).ok).toBe(true);
  expect(creature(await getState(page), uid).hasMined).toBe(true);
});

test('AC342: Guard — Fighters stay within 2 spaces of the stronghold or a Miner and hit enemies that come near', async ({ page }) => {
  let s = await start(page, cardPlay({ playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [P('shiv-rat', 6, 4), O('dwarf-pickman', 2, 9)] }, 'guard'));
  const uid = at(s, 6, 4).uid;
  await toAction(page);
  expect((await autoStep(page)).ok).toBe(true);
  s = await getState(page);
  expect(cheb(creature(s, uid), PLAYER_HOLD), 'stays near the stronghold').toBeLessThanOrEqual(2);
  // an enemy steps next to the guard: it attacks
  s = await start(page, cardPlay({ playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [P('shiv-rat', 6, 3), O('goblin-pebbler', 5, 4)] }, 'guard'));
  await toAction(page);
  const ch = await stanceChoice(page, at(s, 6, 3).uid);
  expect(ch.type).toBe('attack');
  expect(sameTarget(ch.target, 5, 4)).toBe(true);
});

test('AC343: switching the stance mid-turn changes the next unit\'s choice', async ({ page }) => {
  let s = await start(page, cardPlay({ playerDeck: SHARDS, opponentDeck: SHARDS,
    board: [P('goblin-pebbler', 2, 11), P('shiv-rat', 6, 4), O('dwarf-smith-miner', 3, 11)] }, 'aggressive'));
  const second = at(s, 6, 4).uid;
  await toAction(page);
  const before = await stanceChoice(page, second);
  expect(before.type).toBe('move');
  expect(cheb(before, PLAYER_HOLD), 'Aggressive leaves the stronghold').toBeGreaterThan(2);
  expect((await autoStep(page)).ok).toBe(true); // first unit, Aggressive
  await setStance(page, 'guard');
  await expect(stanceBtn(page, 'Guard')).toHaveAttribute('aria-pressed', 'true');
  const step = await autoStep(page); // next unit uses Guard
  expect(step.ok).toBe(true);
  expect(step.action.creatureUid).toBe(second);
  expect(cheb(creature(await getState(page), second), PLAYER_HOLD)).toBeLessThanOrEqual(2);
});

test('AC344: a Card Comp vs Card Comp match plays to the end with no input; watch bar, stances and Rematch', async ({ page }) => {
  test.setTimeout(60000);
  await openTest(page, 7);
  const s0 = await page.evaluate(async () => await window.oreheart.newMatch({ mode: 'compvscomp', seed: 7, skipMulligan: true, paused: true,
    playerCommander: 'grubnak', opponentCommander: 'sproingle', setup: { playerHealth: 4, opponentHealth: 4 } }));
  expect(s0.mode).toBe('compvscomp');
  for (const n of ['Play', '1×', '2×', '4×', 'Exit to menu']) await expect(page.getByRole('button', { name: n, exact: true })).toBeVisible();
  for (const n of STANCES) await expect(stanceBtn(page, n)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeHidden();
  const t0 = (await getState(page)).turn;
  await page.getByRole('button', { name: '4×', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.waitForFunction(async () => (await window.oreheart.getState()).phase === 'over', null, { timeout: 50000, polling: 250 });
  const s = await getState(page);
  expect(s.turn).toBeGreaterThan(t0);
  expect(['player', 'opponent']).toContain(s.winner);
  await expect(page.getByRole('button', { name: 'Rematch', exact: true })).toBeVisible();
});

test('AC345: the four stance buttons sit on the right edge, vertically centered, big enough to tap (1920x1080 and 844x390)', async ({ page }) => {
  for (const [W, H] of [[1920, 1080], [844, 390]]) {
    await page.setViewportSize({ width: W, height: H });
    await start(page, cardPlay({ playerDeck: SHARDS, opponentDeck: SHARDS }));
    // Owner change (Oct 25, 39d93d5c): the stance column hides at the right edge (a sliver shows) and slides out on hover; measure it slid out
    await page.getByLabel('Stance', { exact: true }).hover();
    await page.waitForTimeout(400); // slide-out transition .28s
    const boxes = [];
    for (const n of STANCES) boxes.push(await stanceBtn(page, n).boundingBox());
    for (const [i, b] of boxes.entries()) {
      expect(b.x + b.width, `${W}x${H} ${STANCES[i]} at the right edge`).toBeGreaterThanOrEqual(W * 0.9);
      expect(b.x + b.width, `${W}x${H} ${STANCES[i]} on screen`).toBeLessThanOrEqual(W + 1);
      expect(b.height, `${W}x${H} ${STANCES[i]} height`).toBeGreaterThanOrEqual(W >= 1920 ? 60 : 40);
      if (i) expect(b.y, 'a vertical column').toBeGreaterThanOrEqual(boxes[i - 1].y + boxes[i - 1].height - 1);
    }
    const mid = (boxes[0].y + boxes[3].y + boxes[3].height) / 2;
    expect(Math.abs(mid - H / 2) / H, `${W}x${H} vertically centered`).toBeLessThanOrEqual(0.08);
    expect(boxes[0].y).toBeGreaterThanOrEqual(0);
    expect(boxes[3].y + boxes[3].height).toBeLessThanOrEqual(H + 1);
  }
});

test.describe('round 17 fixes at 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
  test('AC346: Choose Your Commander fits a phone with nothing overlapping or cut off', async ({ page }) => {
    await toSelect(page);
    const names = ['Fight!', 'Back', 'Easy', 'Normal', 'Hard', ...MODES, 'Remove Goblin Warband', 'Copy Goblin Warband to my decks', 'Previous commander', 'Next commander', ...COMMANDERS];
    const boxes = {};
    for (const n of names) {
      const b = await page.getByRole('button', { name: n, exact: true }).boundingBox();
      expect(b, `${n} visible`).not.toBeNull();
      expect(b.x >= -1 && b.y >= -1 && b.x + b.width <= 845 && b.y + b.height <= 391, `${n} on screen`).toBe(true);
      boxes[n] = b;
    }
    const deck = await deckRow(page).getByRole('button', { name: 'Goblin Warband, 60 cards, ready', exact: true }).boundingBox();
    boxes['Goblin Warband deck'] = deck;
    const keys = Object.keys(boxes);
    const hit = (a, b) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      if (keys[i] === 'Goblin Warband deck' || keys[j] === 'Goblin Warband deck') {
        const other = keys[i] === 'Goblin Warband deck' ? keys[j] : keys[i];
        if (other.includes('Goblin Warband')) continue; // Remove / Copy sit on their own deck stack
      }
      expect(hit(boxes[keys[i]], boxes[keys[j]]), `${keys[i]} overlaps ${keys[j]}`).toBe(false);
    }
  });

  test('AC347: the hand is "Your hand" with data-card-id buttons, an even fan fully on screen, and a raised card never covers most of the board', async ({ page }) => {
    await start(page, quiet({ playerHand: ['goblin-scrounger', 'goblin-pebbler', 'shiv-rat', 'fireball', 'goblin-scrapper'], playerDeck: SHARDS, opponentDeck: SHARDS }));
    await page.mouse.move(422, 120);
    const cards = page.getByLabel('Your hand', { exact: true }).locator('button[data-card-id]');
    await expect(cards).toHaveCount(5);
    await expect.poll(async () => {
      for (let i = 0; i < 5; i++) { const b = await cards.nth(i).boundingBox(); if (b.x < -1 || b.x + b.width > 845 || !(await restTuckedOk(page, b, 390))) return false; }
      return true;
    }, { message: 'every hand card on screen at its tucked rest (Ken, Oct 30)', timeout: 4000 }).toBe(true);
    const xs = []; for (let i = 0; i < 5; i++) { const b = await cards.nth(i).boundingBox(); xs.push(b.x + b.width / 2); }
    const steps = xs.slice(1).map((x, i) => x - xs[i]);
    for (const st of steps) expect(Math.abs(st - steps[0]), 'even fan spacing').toBeLessThanOrEqual(Math.max(4, Math.abs(steps[0]) * 0.15));
    const b = await cards.nth(2).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + 10, { steps: 4 });
    await page.waitForTimeout(600);
    const r = await cards.nth(2).boundingBox();
    expect(r.width * r.height, 'a raised card covers less than half the screen').toBeLessThan(844 * 390 * 0.5);
    expect(r.y + r.height).toBeLessThanOrEqual(391);
    expect(await page.evaluate(() => typeof window.oreheart)).toBe('object');
  });
});

test.describe('round 17 screenshots', () => {
  for (const [W, H] of [[1920, 1080], [844, 390]]) {
    test(`AC348: fight menu with modes, a Card Play match with stances and a Card Comp vs Card Comp match render without errors (${W}x${H})`, async ({ page }, info) => {
      test.setTimeout(45000);
      await page.setViewportSize({ width: W, height: H });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = async (n) => info.attach(`r17-${n}-${W}x${H}`, { body: await page.screenshot(), contentType: 'image/png' });
      await toSelect(page);
      await shot('fight-menu-modes');
      await start(page, cardPlay({ playerDeck: SHARDS, opponentDeck: SHARDS, board: [P('goblin-pebbler', 6, 6), P('goblin-scrounger', 5, 4), O('dwarf-smith-miner', 5, 5)] }, 'aggressive'));
      await toAction(page);
      await shot('cardplay-stances');
      for (let i = 0; i < 2; i++) { await autoStep(page); await page.waitForTimeout(400); await shot(`aggressive-step-${i}`); }
      await page.evaluate(async () => await window.oreheart.newMatch({ mode: 'compvscomp', seed: 3, skipMulligan: true, paused: true }));
      await expect(page.getByRole('button', { name: 'Exit to menu', exact: true })).toBeVisible();
      await shot('compvscomp-watch-bar');
      expect(errors).toEqual([]);
    });
  }
});

// ---------- Owner rule (Oct 24, "round 20" in the owner's tests): bonus draws (AC349) ----------
const BONUS_MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
/** Player mines with the listed Miners on turn 1, then plays through to their next turn; returns the cards gained. */
async function bonusGain(page, board, minesBy) {
  await openTest(page);
  await newMatch(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle', mines: BONUS_MINES, setup: { opponentHand: [], board } });
  await done(page); // -> Action
  let s = await getState(page);
  for (const [r, c, mr, mc] of minesBy) {
    const res = await act(page, { type: 'mine', creatureUid: at(s, r, c).uid, row: mr, col: mc });
    expect(res.ok, JSON.stringify(res)).toBe(true);
  }
  const before = (await getState(page)).players.player.hand.length;
  await done(page); // end the player's turn
  for (let i = 0; i < 12 && (await getState(page)).activePlayer !== 'player'; i++) await done(page);
  s = await getState(page);
  expect(s.activePlayer).toBe('player');
  return s.players.player.hand.length - before;
}
test('AC349: bonus draws — +1 card per 4 crystals mined, +1 for holding every mine', async ({ page }) => {
  const cfg = await page.goto('/?test=1').then(() => page.waitForFunction(() => !!window.oreheart)).then(() => page.evaluate(async () => await window.oreheart.getConfig?.()));
  if (cfg) { expect(cfg.minedPerBonusCard).toBe(4); expect(cfg.allMinesBonusCards).toBe(1); }
  const G = 'goblin-scrounger'; // Goblin Miner: mines 2
  expect(await bonusGain(page, [P(G, 3, 5)], [[3, 5, 3, 6]])).toBe(1); // 2 mined: normal draw only
  expect(await bonusGain(page, [P(G, 3, 5), P(G, 2, 6)], [[3, 5, 3, 6], [2, 6, 3, 6]])).toBe(2); // 4 mined: +1
  expect(await bonusGain(page, [P(G, 3, 5), P(G, 5, 5), P(G, 4, 9)], [[3, 5, 3, 6], [5, 5, 5, 6], [4, 9, 4, 10]])).toBe(3); // 6 mined + all 3 mines: +2
});

// ---------- Round 21: every goblin unit in 3D in matches (owner, Oct 25) ----------
// The 16 goblin units with finished Meshy models, folder per card in public/models/creatures/<card id>/
const R21_GOBLINS = {
  'goblin-scrounger': 'Goblin Miner', 'goblin-pebbler': 'Boneknocker', 'goblin-smith-miner': 'Scrapsmith Miner', 'shiv-rat': 'Shiv Rat',
  'goblin-scrapper': 'Bowler Brawler', 'goblin-slinger': 'Skullflinger', 'goblin-bomber': 'Bare Knuckle Lunatic', 'goblin-sneak': 'Backstabbing Thief',
  'wolf-rider': 'Mangewolf Rider', 'grubnaks-big-boss-troll': 'Gronkowski Troll Tyrant', 'shard-guzzler': 'Goblin Rocket Rider', 'goblin-grunt': 'Snotskull Grunt',
  'rotgut-grenadier': 'Goblin Chef', 'skullbasher-rusher': 'Skullbasher Rusher', 'junk-shaman': 'Junk Shaman', 'blastrat-sapper': 'SewerSlide Bomber',
};
// the 12 models copied this round and the item files each one carries (from factory-design/models/<id>/models.json "parts")
const R21_NEW = {
  'goblin-scrapper': ['bowling-ball'], 'goblin-slinger': ['skull-mace'], 'goblin-bomber': [], 'goblin-sneak': ['dagger', 'bag'],
  'wolf-rider': ['mace', 'wolf'], 'grubnaks-big-boss-troll': [], 'shard-guzzler': ['rocket'], 'goblin-grunt': ['frying-pan'],
  'rotgut-grenadier': ['spatula'], 'skullbasher-rusher': ['mace', 'shield'], 'junk-shaman': ['staff'], 'blastrat-sapper': ['bomb'],
};
// the owner's saved looks (factory-design/looks/<id>.json): item -> bone, binding
const R21_LOOKS = {
  'goblin-scrapper': { 'bowling-ball': 'RightHand' },
  'goblin-pebbler': { club: 'RightHand' },
  'goblin-sneak': { bag: 'neck', dagger: 'RightHand' },
  'rotgut-grenadier': { spatula: 'RightHand' },
  'goblin-bomber': {},
};
function glbJson(buf) {
  // GLB: 12-byte header, then chunk 0 (JSON): length (4), type (4), data
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}
const r21Fig = async (page, uid) => ((await renderStats(page)).figures || []).find((f) => f.uid === uid) || {};
const r21Place = (ids, owner = 'player') => ids.map((cardId, i) => ({ cardId, owner, row: owner === 'player' ? 6 : 1, col: 3 + (i % 8) }));

test('AC350: the 12 new goblin models are copied in, meshopt-compressed and small', async ({ request }) => {
  for (const [id, items] of Object.entries(R21_NEW)) {
    const mj = await request.get(`/models/creatures/${id}/models.json`);
    expect(mj.ok(), `${id}/models.json`).toBe(true);
    const info = await mj.json();
    for (const a of ['idle', 'walk', 'attack', 'hit', 'defeat']) expect(typeof info.actions[a], `${id} action ${a}`).toBe('number');
    let folderBytes = 0;
    for (const file of ['char.glb', ...items.map((p) => `${p}.glb`)]) {
      const res = await request.get(`/models/creatures/${id}/${file}`);
      expect(res.ok(), `${id}/${file}`).toBe(true);
      const body = await res.body();
      expect(body.subarray(0, 4).toString('latin1'), `${id}/${file} is a GLB`).toBe('glTF');
      expect(glbJson(body).extensionsUsed || [], `${id}/${file} is meshopt-compressed`).toContain('EXT_meshopt_compression');
      expect(body.length, `${id}/${file} size`).toBeLessThanOrEqual(4 * 1024 * 1024);
      folderBytes += body.length;
    }
    expect(folderBytes, `${id} total size`).toBeLessThanOrEqual(6 * 1024 * 1024);
  }
});

for (const [label, ids] of [['first eight', Object.keys(R21_GOBLINS).slice(0, 8)], ['last eight', Object.keys(R21_GOBLINS).slice(8)]]) {
  test(`AC351: every goblin unit shows its 3D model on the board, not a token (${label})`, async ({ page }) => {
    test.setTimeout(45000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await start(page, quiet({ board: r21Place(ids) }));
    if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
    const s = await getState(page);
    await expect.poll(async () => {
      const figs = (await renderStats(page)).figures || [];
      return ids.filter((id) => (figs.find((f) => f.cardId === id) || {}).source !== `${id}.glb`);
    }, { timeout: 25000, message: 'goblins still showing a token' }).toEqual([]);
    const figs = (await renderStats(page)).figures;
    for (const c of s.board.creatures) {
      const f = figs.find((x) => x.uid === c.uid);
      expect(f, c.cardId).toBeTruthy();
      expect([f.row, f.col], `${c.cardId} stands on its square`).toEqual([c.row, c.col]);
      // owner change (Ken, Oct 30): every unit at its saved Studio height: regular units small (about 0.35-0.55 squares), only the special big ones large (Troll 1.57)
      expect(f.height, `${c.cardId} height`).toBeGreaterThanOrEqual(0.3);
      expect(f.height, `${c.cardId} height`).toBeLessThanOrEqual(1.7);
      for (const a of ['idle', 'walk', 'attack', 'hit', 'defeat']) expect(f.animations, `${c.cardId} ${a}`).toContain(a);
      expect(f.currentAnimation, c.cardId).toBe('idle');
    }
    expect(errors).toEqual([]);
  });
}

test('AC352: items sit on the bones from the owner looks and every carried item is attached', async ({ page }) => {
  const ids = [...new Set([...Object.keys(R21_LOOKS), ...Object.keys(R21_NEW)])];
  test.setTimeout(45000);
  await start(page, quiet({ board: r21Place(ids.slice(0, 8)).concat(r21Place(ids.slice(8)).map((p) => ({ ...p, row: 5 }))) }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  await expect.poll(async () => {
    const figs = (await renderStats(page)).figures || [];
    return ids.filter((id) => (figs.find((f) => f.cardId === id) || {}).source !== `${id}.glb`).length;
  }, { timeout: 25000 }).toBe(0);
  const figs = (await renderStats(page)).figures;
  for (const id of ids) {
    const f = figs.find((x) => x.cardId === id);
    const items = f.items || [];
    for (const name of R21_NEW[id] || []) expect(items.map((i) => i.name), `${id} carries ${name}`).toContain(name);
    for (const [name, bone] of Object.entries(R21_LOOKS[id] || {})) {
      const it = items.find((i) => i.name === name);
      expect(it, `${id} item ${name}`).toBeTruthy();
      expect(it.bone, `${id} ${name} bone`).toBe(bone);
      expect(it.matchesLook, `${id} ${name} uses the owner's saved position/rotation/scale`).toBe(true);
    }
    expect(items.map((i) => i.name).some((n) => /solid/i.test(n)), `${id} has no editor "Solid part"`).toBe(false);
  }
});

test('AC353: goblin models play walk, attack, hit and defeat with their own clips', async ({ page }) => {
  await start(page, quiet({ board: [
    { cardId: 'goblin-sneak', owner: 'player', row: 6, col: 8 },
    { cardId: 'goblin-grunt', owner: 'player', row: 6, col: 10 },
    { cardId: 'grubnaks-big-boss-troll', owner: 'opponent', row: 5, col: 10 },
  ] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  const s = await getState(page);
  const thief = at(s, 6, 8), grunt = at(s, 6, 10), troll = at(s, 5, 10);
  await expect.poll(async () => [thief, grunt, troll].every(Boolean) && (await r21Fig(page, troll.uid)).source, { timeout: 20000 }).toBe('grubnaks-big-boss-troll.glb');
  let moveAct = null, atkAct = null;
  for (let i = 0; i < 3 && !(moveAct && atkAct); i++) {
    const l = await legal(page);
    moveAct = l.find((a) => a.type === 'move' && a.creatureUid === thief.uid);
    atkAct = l.find((a) => a.type === 'attack' && a.creatureUid === grunt.uid && a.target && (a.target.uid === troll.uid || (a.target.row === 5 && a.target.col === 10)));
    if (!(moveAct && atkAct)) await done(page);
  }
  expect(moveAct && atkAct, 'move and attack are legal').toBeTruthy();
  expect((await act(page, moveAct)).ok).toBe(true);
  expect((await act(page, atkAct)).ok).toBe(true); // 2 damage to the 5/6 troll, its 5 strike back defeats the 2/3 grunt
  await expect.poll(async () => {
    const log = (await renderStats(page)).creatureAnimLog || [];
    const has = (uid, a) => log.some((e) => e.uid === uid && e.anim === a);
    return { walk: has(thief.uid, 'walk'), attack: has(grunt.uid, 'attack'), hit: has(troll.uid, 'hit'), defeat: has(grunt.uid, 'defeat') };
  }, { timeout: 10000 }).toEqual({ walk: true, attack: true, hit: true, defeat: true });
  await expect.poll(async () => (await r21Fig(page, thief.uid)).currentAnimation, { timeout: 8000 }).toBe('idle');
});

test('AC354: a model that fails to load falls back to the token and the match keeps going', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/models/creatures/goblin-grunt/**', (r) => r.abort());
  await start(page, quiet({ board: [
    { cardId: 'goblin-grunt', owner: 'player', row: 6, col: 9 },
    { cardId: 'goblin-sneak', owner: 'player', row: 6, col: 7 },
  ] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  await expect.poll(async () => ((await renderStats(page)).figures || []).find((f) => f.cardId === 'goblin-sneak')?.source, { timeout: 20000 }).toBe('goblin-sneak.glb');
  const grunt = ((await renderStats(page)).figures || []).find((f) => f.cardId === 'goblin-grunt');
  expect(grunt, 'the grunt still shows').toBeTruthy();
  expect(grunt.source).toBe('placeholder');
  const before = (await getState(page)).phase;
  await done(page);
  expect((await getState(page)).phase).not.toBe(before);
  expect(errors).toEqual([]);
});

test('AC355: models load once and are reused; Gnome and Dwarf units without a model are unchanged', async ({ page }) => {
  const fetched = {};
  page.on('request', (r) => { const m = r.url().match(/\/models\/creatures\/([^/]+)\/char\.glb/); if (m) fetched[m[1]] = (fetched[m[1]] || 0) + 1; });
  await start(page, quiet({ board: [
    ...[3, 4, 5, 6].map((col) => ({ cardId: 'skullbasher-rusher', owner: 'player', row: 6, col })),
    { cardId: 'gnome-prospector', owner: 'player', row: 6, col: 9 },
  ] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  await expect.poll(async () => ((await renderStats(page)).figures || []).filter((f) => f.source === 'skullbasher-rusher.glb').length, { timeout: 20000 }).toBe(4);
  expect(fetched['skullbasher-rusher'], 'char.glb downloaded once for 4 copies').toBe(1);
  // owner change (Ken, Oct 30): the Gemsinger Miner now has its own model (loaded once, like any unit)
  await expect.poll(async () => (((await renderStats(page)).figures || []).find((f) => f.cardId === 'gnome-prospector') || {}).source, { timeout: 20000 }).toBe('gnome-prospector.glb');
  expect(fetched['gnome-prospector']).toBe(1);
  // Grubnak (the Commander) has his own model since round 12b-1; only other non-goblin units must not fetch one
  expect(Object.keys(fetched).filter((k) => !(k in R21_GOBLINS) && k !== 'grubnak' && k !== 'gnome-prospector')).toEqual([]);
});

test('AC357: Gnome and Dwarf units show their 3D models (character only); the clockwork beetle has no skeleton', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page, quiet({ board: [
    { cardId: 'dwarf-miner', owner: 'player', row: 6, col: 3 },
    { cardId: 'gnome-tinker', owner: 'player', row: 6, col: 5 },
    { cardId: 'clockwork-beetle', owner: 'player', row: 6, col: 7 },
  ] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  await expect.poll(async () => ((await renderStats(page)).figures || []).filter((f) => /\.glb$/.test(f.source || '')).length, { timeout: 25000 }).toBe(3);
  for (const f of (await renderStats(page)).figures) expect(f.model, f.cardId).toBe('finished');
  expect(errors).toEqual([]);
});

// AC356 (Round 21 report screenshots) removed in Round 24: screenshot-only, proved nothing and timed out.

// ======================= Round 22 (owner, Oct 25) =======================
const r22Fig = async (page, uid) => ((await renderStats(page)).figures || []).find((f) => f.uid === uid) || {};
const sqCenter = async (page, row, col) => {
  const q = await page.evaluate(([r, c]) => window.oreheart.squareQuad(r, c), [row, col]);
  return { x: q.reduce((a, p) => a + p.x, 0) / q.length, y: q.reduce((a, p) => a + p.y, 0) / q.length };
};
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test.describe('round 22 controls and hand 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('AC357: left-click selects your unit and lights its squares, clicking a lit square moves it; right-click opens its card with its ability menu', async ({ page }) => {
    let s = await start(page, quiet({ board: [
      { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 5 },
      { cardId: 'goblin-grunt', owner: 'opponent', row: 2, col: 10 },
    ] }));
    s = await toAction(page);
    const uid = at(s, 6, 5).uid;
    await page.getByLabel('Bowler Brawler, row 6, column 5', { exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.oreheart.getSelected())).toBe(uid);
    await expect(page.getByRole('dialog', { name: 'Bowler Brawler', exact: true })).toHaveCount(0);
    await expect.poll(async () => ((await arenaInfo(page)).highlights || []).length).toBeGreaterThan(0);
    const to = await sqCenter(page, 5, 5);
    await page.mouse.click(to.x, to.y);
    await expect.poll(async () => (at(await getState(page), 5, 5) || {}).uid).toBe(uid);
    // right-click: card + ability menu for your own unit, state unchanged
    const before = await getState(page);
    await page.getByLabel('Bowler Brawler, row 5, column 5', { exact: true }).click({ button: 'right' });
    const dlg = page.getByRole('dialog', { name: 'Bowler Brawler', exact: true });
    await expect(dlg).toBeVisible();
    await expect(dlg.getByRole('button', { name: /^Strike/ })).toHaveCount(1);
    expect(await getState(page)).toEqual(before);
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    // an enemy unit: right-click shows its card, no ability menu
    await page.getByLabel(/^Goblin Grunt|, row 2, column 10$/).first().click({ button: 'right' });
    const enemy = page.getByRole('dialog').filter({ has: page.locator('[data-card-id="goblin-grunt"]') });
    await expect(enemy).toBeVisible();
    await expect(enemy.getByRole('button', { name: /^Strike/ })).toHaveCount(0);
  });

  test('AC358: clicking a hand card opens its close-up with Play this card, then a click on a highlighted square plays it', async ({ page }) => {
    await start(page, quiet({ playerHand: ['goblin-scrounger', 'goblin-scrapper'], playerCrystals: 3 }));
    const hand = page.getByLabel('Your hand', { exact: true });
    const miner = hand.locator('button:has([data-card-id="goblin-scrounger"])').first();
    await miner.click();
    const dlg = page.getByRole('dialog').filter({ has: page.locator('[data-card-id="goblin-scrounger"]') });
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'Play this card', exact: true }).click();
    await expect(dlg).toBeHidden();
    await expect.poll(async () => ((await arenaInfo(page)).highlights || []).length).toBeGreaterThan(0);
    const sq = await sqCenter(page, 7, 5);
    await page.mouse.click(sq.x, sq.y);
    await expect.poll(async () => ((at(await getState(page), 7, 5)) || {}).cardId).toBe('goblin-scrounger');
  });
});

test('AC359: Bowler Brawler holds his flaming ball in his hand and spins it on a finger when idle', async ({ page }) => {
  await start(page, quiet({ board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 5 }] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  const uid = at(await getState(page), 6, 5).uid;
  await expect.poll(async () => (await r22Fig(page, uid)).source, { timeout: 20000 }).toBe('goblin-scrapper.glb');
  const f = await r22Fig(page, uid);
  for (const a of ['idle', 'walk', 'bowl', 'spinBall', 'basketShot', 'hit', 'defeat']) expect(f.animations, a).toContain(a);
  expect(f.ball).toMatchObject({ state: 'hand', bone: 'RightHand', bodyPenetrations: 0 });
  expect(f.ball.minGroundClearance).toBeGreaterThanOrEqual(-0.01);
  const flame = (f.effects || []).find((e) => e.name === 'Flame');
  expect(flame, 'the owner Flame effect is on the ball').toBeTruthy();
  expect(flame).toMatchObject({ type: 'flame', attachedTo: 'bowling-ball', visible: true });
  expect(flame.settings).toMatchObject({ cCore: '#238b5a', cMid: '#00f088', cTip: '#00ff04' });
  await page.evaluate(async () => await window.oreheart.advanceIdle(20));
  await expect.poll(async () => ((await renderStats(page)).creatureAnimLog || []).some((e) => e.uid === uid && e.anim === 'spinBall'), { timeout: 10000 }).toBe(true);
});

test('AC360: Bowler Brawler bowls (Strike and attack): ball back, swing, release, roll along the ground; nothing clips; a new ball returns to his hand', async ({ page }) => {
  test.setTimeout(60000); // Round 23: model load + two full throws took longer than 30 s on the test machine
  await start(page, quiet({ playerCrystals: 6, board: [
    { cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 5 },
    { cardId: 'goblin-grunt', owner: 'opponent', row: 6, col: 6 },
    { cardId: 'goblin-scrounger', owner: 'opponent', row: 3, col: 5 },
  ] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  let s = await toAction(page);
  const uid = at(s, 6, 5).uid;
  await expect.poll(async () => (await r22Fig(page, uid)).source, { timeout: 20000 }).toBe('goblin-scrapper.glb');
  const bowls = async () => ((await renderStats(page)).creatureAnimLog || []).filter((e) => e.uid === uid && e.anim === 'bowl').length;
  const cleanThrow = async (n) => {
    await expect.poll(bowls, { timeout: 10000 }).toBe(n);
    await expect.poll(async () => (await r22Fig(page, uid)).ball?.state, { timeout: 10000 }).toBe('hand');
    const b = (await r22Fig(page, uid)).ball;
    const order = ['swingBack', 'release', 'roll'].map((p) => b.log.lastIndexOf(p));
    expect(order.every((k) => k >= 0) && order[0] < order[1] && order[1] < order[2], `ball log ${b.log}`).toBe(true);
    expect(b.bodyPenetrations).toBe(0);
    expect(b.minGroundClearance).toBeGreaterThanOrEqual(-0.01);
  };
  // Strike straight up column 5
  expect((await act(page, { type: 'ability', creatureUid: uid, ability: 'strike', target: { row: 5, col: 5 } })).ok).toBe(true);
  await cleanThrow(1);
  // his normal attack (a later Action phase) uses the same bowling throw
  let atk = null;
  for (let k = 0; k < 5 && !atk; k++) {
    await done(page);
    atk = (await legal(page)).find((a) => a.type === 'attack' && a.creatureUid === uid);
  }
  expect(atk, 'an attack is legal').toBeTruthy();
  expect((await act(page, atk)).ok).toBe(true);
  await cleanThrow(2);
});

test('AC361: summoning Bowler Brawler plays his basketball shot: the ball flies up and lands dead (no bounce, no roll)', async ({ page }) => {
  await start(page, quiet({ playerHand: ['goblin-scrapper'], playerCrystals: 9 }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  const card = (await getState(page)).players.player.hand[0].uid;
  const sum = (await legal(page)).find((a) => a.type === 'summon' && a.uid === card);
  expect((await act(page, sum)).ok).toBe(true);
  const uid = at(await getState(page), sum.row, sum.col).uid;
  await expect.poll(async () => ((await renderStats(page)).creatureAnimLog || []).some((e) => e.uid === uid && e.anim === 'basketShot'), { timeout: 20000 }).toBe(true);
  await expect.poll(async () => (await r22Fig(page, uid)).ball?.state, { timeout: 10000 }).toBe('hand');
  const b = (await r22Fig(page, uid)).ball;
  const order = ['shoot', 'fly', 'land'].map((p) => b.log.indexOf(p));
  expect(order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2], `ball log ${b.log}`).toBe(true);
  expect(b.lastLanding).toEqual({ bounces: 0, rollDistance: 0 });
  expect(b.minGroundClearance).toBeGreaterThanOrEqual(-0.01);
  expect(b.bodyPenetrations).toBe(0);
});

test('AC362: every Crystal Node shows the owner look effects in its owner color; Low graphics keeps only the main glow', async ({ page, request }) => {
  const look = await (await request.get('/models/mines/crystal-node-look.json')).json();
  expect(look.effects.length).toBe(9);
  const want = { player: (c) => c[1] > c[0] + 40 && c[1] > c[2] + 20, // goblins green
    gnome: (c) => c[0] > c[1] + 40 && c[2] > c[1] + 40, // gnomes purple
    dwarf: (c) => c[2] > c[0] + 40 && c[2] >= c[1], // dwarves blue
    neutral: (c) => Math.min(...c) >= 0xd0 };
  const check = async (enemyKind) => {
    if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
    await expect.poll(async () => ((await renderStats(page)).mineModels || []).length, { timeout: 15000 }).toBe(3);
    for (const m of (await renderStats(page)).mineModels) {
      expect(m.effects.length).toBe(9);
      look.effects.forEach((e, i) => {
        expect(m.effects[i].type).toBe(e.effectType);
        m.effects[i].localPosition.forEach((v, k) => expect(Math.abs(v - e.localPosition[k])).toBeLessThanOrEqual(0.01));
        for (const [k, v] of Object.entries(e.settings)) if (k !== 'color') expect(m.effects[i].settings[k]).toBeCloseTo(v, 2);
      });
      const kind = m.owner === 'player' ? 'player' : m.owner === 'opponent' ? enemyKind : 'neutral';
      for (const e of m.effects) expect(want[kind](hexRgb(e.color)), `${kind} mine effect ${e.color}`).toBe(true);
    }
  };
  const board = (enemyMiner) => [
    { cardId: 'goblin-scrounger', owner: 'player', row: 3, col: 2, minedMine: M1 },
    { cardId: enemyMiner, owner: 'opponent', row: 5, col: 4, minedMine: M2 },
  ];
  await start(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle', setup: { opponentHand: [], board: board('gnome-prospector') } });
  await check('gnome');
  await newMatch(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: { opponentHand: [], board: board('dwarf-miner') } });
  await check('dwarf');
  await page.evaluate(() => window.oreheart.setGraphics('low'));
  await newMatch(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: { opponentHand: [] } });
  await expect.poll(async () => ((await renderStats(page)).mineModels || []).length, { timeout: 15000 }).toBe(3);
  for (const m of (await renderStats(page)).mineModels) {
    expect(m.effects.length).toBe(1);
    expect(m.effects[0]).toMatchObject({ name: 'Glow', type: 'glow' });
  }
});

// ======================= Round 23 (owner, Oct 25) =======================
// owner layout (src/content/owner-layout.json, HUD piece "hand"): overlap 0.2, angle 4, arc 1.45, popScale 1.6
const R23_HAND = ['shiv-rat', 'goblin-pebbler', 'fireball', 'goblin-slinger', 'soul-shard', 'goblin-scrapper', 'goblin-scrounger'];
const r23Fan = async (page) => (await handHover(page)).fan || [];
const r23Tops = async (page) => {
  const btns = handButtons(page); const n = await btns.count(); const tops = [];
  for (let i = 0; i < n; i++) tops.push((await btns.nth(i).boundingBox()).y);
  return tops;
};
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
// starts a quiet match, turns the test flag off (real play behaviour) and parks the mouse on the board
async function r23Start(page) {
  await start(page, quiet({ playerHand: R23_HAND, playerCrystals: 9, playerDeck: SHARDS, opponentDeck: SHARDS }));
  await page.evaluate(() => { window.__app.test = false; });
  const mid = await sqCenter(page, 4, 7);
  await page.mouse.move(mid.x, mid.y);
  await expect.poll(async () => (await handHover(page)).raisedIndex, { timeout: 3000 }).toBe(-1);
  const tops = await r23Tops(page);
  await page.waitForTimeout(600); // let the resting fan settle before measuring
  return { mid, restTop: median(await r23Tops(page)) || median(tops) };
}
// moves the real mouse onto the visible strip of hand card i (left part, cards overlap to the right)
// Owner change (Forge, Oct 29): a press takes the card drawn under the pointer (Ken's rule). r23HoverCard's aim point sits at the
// resting card's mid-height, which is BELOW the card once it has risen, where a neighbour is drawn. Before grabbing, park the mouse
// on the raised card's drawn band (same x, y inside the card) so the grab takes the card that was hovered.
async function r23Grip(page, from) {
  // wait until the raised card has stopped moving (its rise is a .12 s transition; slower under load)
  await expect.poll(async () => page.evaluate(() => { const el = document.querySelector('.hand-card.popped:not(.popclone)'); if (!el) return 'none'; const b = el.getBoundingClientRect(); const k = [b.left, b.top, b.width].map(Math.round).join(','); const same = el.__gripKey === k; el.__gripKey = k; return same ? 'still' : k; }), { timeout: 1500, intervals: [80, 80, 80, 80, 120, 120, 200, 200, 300] }).toMatch(/still|none/);
  const up = await page.evaluate(([x]) => {
    const el = document.querySelector('.hand-card.popped:not(.popclone)'); if (!el) return null;
    const b = el.getBoundingClientRect(); return { x: Math.max(b.left + 8, Math.min(b.right - 8, x)), y: b.top + b.height * 0.45 };
  }, [from.x]);
  if (!up) return from;
  await page.mouse.move(up.x, up.y, { steps: 2 });
  await page.waitForTimeout(100);
  return up;
}
async function r23HoverCard(page, i) {
  const b = await handButtons(page).nth(i).boundingBox();
  const p = { x: b.x + Math.min(b.width * 0.12, 18), y: b.y + b.height * 0.5 };
  await page.mouse.move(p.x, Math.min(p.y, page.viewportSize().height - 4), { steps: 6 });
  return p;
}

for (const vp of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
  test.describe(`round 23 hand at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test(`AC363: the fan follows Ken's Oct 30 hand spec — every card shows at least 50 %, a flat fan (at most 1.4° per card, no arc) (${vp.width}x${vp.height})`, async ({ page }) => {
      // owner check change (Ken, Oct 30 hand spec): was the owner layout's overlap 0.26, 4° per card, arc 1.45 ("they kind of blend together"; "do less of a fan")
      await r23Start(page);
      const fan = await r23Fan(page);
      expect(fan.length).toBe(7);
      const w = fan[0].width, h = fan[0].height;
      const btns = handButtons(page);
      for (let i = 0; i < 7; i++) {
        const b = await btns.nth(i).boundingBox();
        expect(Math.abs(b.x + b.width / 2 - fan[i].cx), `fan[${i}] matches the drawn card`).toBeLessThanOrEqual(w * 0.6);
      }
      for (let i = 1; i < 7; i++) {
        const gap = fan[i].cx - fan[i - 1].cx;
        expect(gap / w, `gap ${i}`).toBeGreaterThanOrEqual(0.5);
        expect(gap / w, `gap ${i}`).toBeLessThanOrEqual(0.7);
      }
      for (let i = 0; i < 7; i++) {
        expect(Math.abs(fan[i].rotateDeg), `card ${i} angle ${fan[i].rotateDeg}`).toBeLessThanOrEqual(3.6);
        if (i) expect(fan[i].rotateDeg - fan[i - 1].rotateDeg, `card ${i} turn`).toBeGreaterThanOrEqual(0);
        if (i) expect(fan[i].rotateDeg - fan[i - 1].rotateDeg, `card ${i} turn`).toBeLessThanOrEqual(1.45);
        const drop = (fan[i].cy - fan[3].cy) / h;
        expect(Math.abs(drop), `card ${i} arc ${drop.toFixed(3)}`).toBeLessThanOrEqual(0.02);
      }
      // hovering a card straightens it and enlarges it 1.6x
      await r23HoverCard(page, 3);
      await expect.poll(async () => (await handHover(page)).raisedIndex, { timeout: 2000 }).toBe(3);
      await expect.poll(async () => { const f = (await r23Fan(page))[3]; return Math.abs(f.rotateDeg) <= 1 && Math.abs(f.scale - 1.6) <= 0.1; }, { timeout: 2000 }).toBe(true);
    });

    test(`AC364: grabbing a card tucks the rest of the hand, and it stays tucked after a play or a cancel (${vp.width}x${vp.height})`, async ({ page }) => {
      const { restTop } = await r23Start(page);
      const tuckedOk = async () => { const t = await r23Tops(page); return t.every((y) => y >= restTop - 6); };
      // hover raises the hand
      await r23HoverCard(page, 6);
      await expect.poll(async () => median(await r23Tops(page)), { timeout: 2000 }).toBeLessThan(restTop - 20);
      // grab the Miner (last card) and drag toward the back row in steps
      const target = await sqCenter(page, 7, 6);
      const from = await r23Grip(page, await r23HoverCard(page, 6));
      await page.mouse.down();
      await page.mouse.move(from.x, from.y - 30, { steps: 3 });
      await page.mouse.move((from.x + target.x) / 2, (from.y + target.y) / 2, { steps: 5 });
      await expect.poll(tuckedOk, { message: 'rest of the hand tucks once a card is grabbed', timeout: 1200 }).toBe(true);
      await page.mouse.move(target.x, target.y, { steps: 5 });
      expect(await tuckedOk()).toBe(true);
      await page.mouse.up();
      await expect.poll(async () => (await getState(page)).players.player.hand.length, { timeout: 3000 }).toBe(6);
      await page.waitForTimeout(700);
      expect(await tuckedOk(), 'still tucked after the play').toBe(true);
      // grab another card and drop it on an empty middle square (illegal) -> cancelled, hand stays down
      const from2 = await r23HoverCard(page, 0);
      await page.mouse.down();
      const mid = await sqCenter(page, 3, 7);
      await page.mouse.move(from2.x, from2.y - 30, { steps: 3 });
      await page.mouse.move(mid.x, mid.y, { steps: 8 });
      await expect.poll(tuckedOk, { timeout: 1200 }).toBe(true);
      await page.mouse.up();
      await page.waitForTimeout(700);
      expect((await getState(page)).players.player.hand.length).toBe(6);
      expect(await tuckedOk(), 'still tucked after a cancel').toBe(true);
      expect((await handHover(page)).raisedIndex).toBe(-1);
    });

    test(`AC365: the hand tucks within about a third of a second when the mouse leaves it, also onto the enlarged card (${vp.width}x${vp.height})`, async ({ page }) => {
      const { restTop, mid } = await r23Start(page);
      // leave onto the board
      await r23HoverCard(page, 2);
      await expect.poll(async () => median(await r23Tops(page)), { timeout: 2000 }).toBeLessThan(restTop - 20);
      await page.mouse.move(mid.x, mid.y, { steps: 4 });
      await expect.poll(async () => (await handHover(page)).raised, { timeout: 500 }).toBe(false);
      await expect.poll(async () => median(await r23Tops(page)), { timeout: 1500 }).toBeGreaterThanOrEqual(restTop - 6);
      // leave upward onto the enlarged card's part above the fan
      await r23HoverCard(page, 3);
      await expect.poll(async () => (await handHover(page)).raisedIndex, { timeout: 2000 }).toBe(3);
      await page.waitForTimeout(500);
      const others = (await r23Tops(page)).filter((_, i) => i !== 3);
      const big = await handButtons(page).nth(3).boundingBox();
      const above = { x: big.x + big.width / 2, y: Math.max(2, Math.min(...others) - 12) };
      expect(above.y, 'the enlarged card reaches above the fan').toBeGreaterThan(big.y);
      await page.mouse.move(above.x, above.y, { steps: 4 });
      await expect.poll(async () => (await handHover(page)).raised, { timeout: 500 }).toBe(false);
      await expect.poll(async () => median(await r23Tops(page)), { timeout: 1500 }).toBeGreaterThanOrEqual(restTop - 6);
    });
  });
}

test('AC366: flying units hover, bob and sway above their square with a ground shadow; walkers stand on the ground', async ({ page }) => {
  await start(page, quiet({ board: [
    { cardId: 'gyrocopter-ace', owner: 'player', row: 6, col: 5 },
    { cardId: 'dwarf-miner', owner: 'player', row: 6, col: 8 },
  ] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  const fig = async (id) => ((await renderStats(page)).figures || []).find((f) => f.cardId === id) || {};
  await expect.poll(async () => (await fig('gyrocopter-ace')).flying != null, { timeout: 20000 }).toBe(true);
  const fl = (await fig('gyrocopter-ace')).flying;
  if (fl.source === 'default') expect(fl).toMatchObject({ hoverSquares: 0.7, /* owner change (Ken, Oct 30): hover twice as high */ floatSquares: 0.06, floatsPerSecond: 0.6, swayDeg: 3, groundShadow: true });
  expect(fl.hoverSquares).toBeGreaterThan(0);
  const lifts = [], sways = [];
  for (let i = 0; i < 8; i++) {
    const f = await fig('gyrocopter-ace');
    lifts.push(f.lift); sways.push(f.swayNowDeg);
    expect(f.row === 6 && f.col === 5).toBe(true);
    await page.waitForTimeout(150);
  }
  for (const l of lifts) {
    expect(l).toBeGreaterThanOrEqual(fl.hoverSquares - fl.floatSquares - 0.01);
    expect(l).toBeLessThanOrEqual(fl.hoverSquares + fl.floatSquares + 0.01);
  }
  expect(Math.max(...lifts) - Math.min(...lifts), 'it bobs').toBeGreaterThan(0.005);
  for (const sw of sways) expect(Math.abs(sw)).toBeLessThanOrEqual(fl.swayDeg + 0.5);
  expect((await fig('gyrocopter-ace')).groundShadow).toBe(fl.groundShadow);
  const dwarf = await fig('dwarf-miner');
  expect(dwarf.flying == null).toBe(true);
  expect(Math.abs(dwarf.lift || 0)).toBeLessThanOrEqual(0.01);
});

test('AC367: Gnome and Dwarf models have their own heights; the Clockwork Beetle slides when it moves', async ({ page }) => {
  test.setTimeout(45000);
  const want = { 'dwarf-miner': 1.048, shieldbeard: 1.179, 'gnome-tinker': 0.773, 'spark-gnome': 0.799, 'queen-brunhilda-stonebeard': 1.441, 'ram-rider': 1.31, 'the-great-steam-golem': 2.882, 'clockwork-beetle': 0.786 }; // owner check change (Ken, Oct 31): real-world heights (Ledger's table, squares; was the Oct 30 Studio heights). AC430 measures them on the board.
  const ids = Object.keys(want);
  const s = await start(page, quiet({ board: ids.map((cardId, i) => ({ cardId, owner: 'player', row: i < 4 ? 6 : 4, col: 3 + 2 * (i % 4) })) }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  await expect.poll(async () => ((await renderStats(page)).figures || []).filter((f) => /\.glb$/.test(f.source || '')).length, { timeout: 30000 }).toBe(ids.length);
  for (const f of (await renderStats(page)).figures.filter((x) => x.cardId in want)) {
    expect(Math.abs(f.height - want[f.cardId]), `${f.cardId} height ${f.height}`).toBeLessThanOrEqual(0.08);
  }
  const beetle = at(s, 4, 9);
  expect(beetle.cardId).toBe('clockwork-beetle');
  await toAction(page);
  expect((await act(page, { type: 'move', creatureUid: beetle.uid, row: 3, col: 9 })).ok).toBe(true);
  await expect.poll(async () => ((await renderStats(page)).creatureAnimLog || []).some((e) => e.uid === beetle.uid && e.anim === 'walk'), { timeout: 5000 }).toBe(true);
  await expect.poll(async () => { const f = ((await renderStats(page)).figures || []).find((x) => x.uid === beetle.uid); return f && f.row === 3 && f.col === 9; }, { timeout: 5000 }).toBe(true);
});

test('AC368: Card Comp vs Card Comp watch bar sits bottom-right; Pause, Play and Exit to menu work', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page, 7);
  await page.evaluate(async () => await window.oreheart.newMatch({ mode: 'compvscomp', seed: 7, skipMulligan: true, paused: true,
    playerCommander: 'grubnak', opponentCommander: 'sproingle' }));
  const play = page.getByRole('button', { name: 'Play', exact: true });
  await expect(play).toBeVisible();
  const b = await play.boundingBox();
  expect(b.x + b.width / 2, 'watch bar on the right').toBeGreaterThan(1920 * 0.5);
  expect(b.y + b.height / 2, 'watch bar at the bottom').toBeGreaterThan(1080 * 0.5);
  await play.click();
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toBeVisible();
  await pause.click();
  await expect(play).toBeVisible();
  const t = (await getState(page)).turn;
  await page.waitForTimeout(1500);
  expect((await getState(page)).turn, 'paused: no turn passes').toBe(t);
  await page.getByRole('button', { name: 'Exit to menu', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
});


// ======================= Round 26 (owner, Oct 28): owner edits, model clips, failing checks =======================
// Round 24's skull-throw checks (AC369–AC371) were retired: the owner rejected the flying skull (Round 26 item 0).
// Owner Model Editor setups (factory-design/design/models/editor-setups-2026-10-28.json, partsTableLook): card -> [bone, pos, rotDeg, scale, part]
const R26_SETUPS = {"goblin-bomber":[],"goblin-grunt":[["RightHand",[-13.281,9.76,19.154],[126.389,-36.031,38.735],[43.449,43.449,43.449],"frying-pan"]],"goblin-pebbler":[["RightHand",[-9.231,12.794,2.402],[27,11,52],[25,25,25],"club"]],"goblin-scrapper":[["RightHand",[-3.51,8.733,-1.595],[50.405,1.159,166.638],[23,23,23],"bowling-ball"]],"goblin-slinger":[["RightHand",[-4.733,9.93,4.184],[7.674,57.734,67.236],[19,19,19],"skull-mace"]],"goblin-sneak":[["neck",[-5.34,1.862,-14.029],[8.548,3.663,3.154],[15,15,15],"bag"],["RightHand",[8.502,7.038,-9.251],[159.362,-37.54,-90.548],[29,29,29],"dagger"]],"junk-shaman":[["RightHand",[5.156,-7.33,3.734],[-10.17,-24.8,-150.09],[52.566,52.566,52.566],"staff"]],"rotgut-grenadier":[["RightHand",[18.162,-9.844,27.054],[35.239,-53.157,-88.87],[43,62.78,32.68],"spatula"]],"shiv-rat":[["Spine",[0.756,-10.807,-6.926],[176.37,0.217,178.765],[19,19,19],"backpack"],["RightHand",[-8.478,10.344,13.399],[132.296,-65.655,54.851],[26,26,26],"dagger"]],"skullbasher-rusher":[["RightHand",[-8.9,18.747,8.443],[-8.725,65.398,73.206],[36,36,36],"mace"],["LeftHand",[-3.667,7.628,-2.335],[-157.797,-59.618,-151.009],[37,37,37],"shield"]],"gyrocopter-ace":[["Spine02",[1,8.127,-15.443],[-178.557,0.345,175.676],[53,53,53],"gyro-wings-oct25"],["Spine02",[2.731,7.516,-13.38],[-84.27,23.646,2.952],[62.608,56.172,69.629],"gyro-wings-oct25"]],"gnome-tinker":[["RightHand",[-5.106,4.336,10.391],[-91.862,22.237,178.441],[29.826,29.826,29.826],"scepter-oct25"],["LeftForeArm",[-6.589,20.19,0.021],[-110.166,-61.024,179.49],[29.536,29.536,29.536],"crystal-shield-oct25"],["Hips",[-12.29,-9.118,25.184],[5.886,46.054,92.626],[16.542,16.542,16.542],"wrench-oct27"]]};
 // owner change (Ken, Oct 30): Junk Shaman staff upright, hand-gripping (Ledger)
const dragCard = (page) => page.evaluate(async () => await window.oreheart.getDragCard());
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// grabs hand card i with the real mouse (test flag must be off) and moves it onto square (row, col) in steps
async function r26Grab(page, i, row, col) {
  const from = await r23Grip(page, await r23HoverCard(page, i));
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 30, { steps: 3 });
  const to = await sqCenter(page, row, col);
  await page.mouse.move(to.x, to.y, { steps: 10 });
  return { from, to };
}
async function r26Play(page, i, row, col) { await r26Grab(page, i, row, col); await page.mouse.up(); }
const quad4 = async (page, row, col) => page.evaluate(([r, c]) => window.oreheart.squareQuad(r, c), [row, col]);
const BANK_Q = (crystals, bank, hand = ['shiv-rat', 'shiv-rat']) => ({ ai: false, playerCommander: 'borgo', opponentCommander: 'grubnak', factionLock: false,
  setup: { opponentHand: [], playerHand: hand, playerCrystals: crystals, playerBank: bank, playerDeck: SHARDS, opponentDeck: SHARDS } });
async function bankStart(page, crystals, bank, hand) {
  await start(page, BANK_Q(crystals, bank, hand));
  await page.evaluate(() => { window.__app.test = false; });
  await page.mouse.move(10, 10);
}
const flowBank = async (page) => { const p = (await getState(page)).players.player; return [p.crystals, p.bank]; };

test.describe('round 26 at 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('AC370/AC372: the dragged card stays centered on the pointer; the square under it is highlighted; it grows back over the hand', async ({ page }) => {
    await r23Start(page);
    const from = await r23Grip(page, await r23HoverCard(page, 6));
    const w0 = (await r23Fan(page))[6].width;
    await page.mouse.down();
    // Owner change (Forge, Oct 29): the grab now starts on the raised card, so 'over the hand' is just below the board's bottom edge (no square under the pointer)
    const handY = Math.max(from.y + 30, (await page.evaluate(() => Math.max(...[...Array(13)].flatMap((_, k) => window.oreheart.squareQuad(7, k + 1).map((q) => q.y))))) + 8);
    await page.mouse.move(from.x, handY, { steps: 4 });
    const card = page.getByLabel('Dragged card', { exact: true });
    await expect(card).toBeVisible();
    await page.waitForTimeout(200); // Owner change (Forge, Oct 29): the grabbed card glides to the pointer; measure it settled, not mid-glide
    let b = await card.boundingBox();
    expect(near(b.x + b.width / 2, from.x, 6) && near(b.y + b.height / 2, handY, 6), 'centered over the hand').toBe(true);
    for (const [r, c] of [[7, 6], [6, 8]]) {
      const p = await sqCenter(page, r, c);
      await page.mouse.move(p.x, p.y, { steps: 8 });
      await page.waitForTimeout(300);
      b = await card.boundingBox();
      expect(near(b.x + b.width / 2, p.x, 6) && near(b.y + b.height / 2, p.y, 6), `centered over square ${r},${c}`).toBe(true);
      const d = await dragCard(page);
      expect(d.highlight, 'highlight follows the pointer').toMatchObject({ row: r, col: c });
    }
    expect((await dragCard(page)).highlight.legal).toBe(false); // (6,8) is not a summon square
    await page.mouse.move(from.x, handY, { steps: 8 });
    await page.waitForTimeout(300);
    await expect.poll(async () => Math.abs((await dragCard(page)).width - w0) / w0, { message: 'grows back over the hand', timeout: 2000 }).toBeLessThanOrEqual(0.05); // Owner change (Forge, Oct 29): the grow-back is a 150 ms ease; wait for it instead of a fixed 300 ms (slow check machines)
    await page.mouse.up();
  });

  test('AC371: 300 ms after stopping over a square the card takes that square\'s on-screen shape (near and far square)', async ({ page }) => {
    await r23Start(page);
    // Owner change (Oct 28, 1beebd5): the card keeps its own shape over a square: 88% of the square's smaller on-screen side, centred, inside the square (cardInSquare, DRAG_FX.fit)
    const len = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
    const sides = (k) => ({ w: (len(k[0], k[1]) + len(k[3], k[2])) / 2, h: (len(k[0], k[3]) + len(k[1], k[2])) / 2 });
    const sortQuad = (k) => { const byY = [...k].sort((a, b) => a.y - b.y); const top = byY.slice(0, 2).sort((a, b) => a.x - b.x), bot = byY.slice(2, 4).sort((a, b) => a.x - b.x); return [top[0], top[1], bot[1], bot[0]]; };
    const inside = (pt, k) => { let s = 0; for (let i = 0; i < 4; i++) { const a = k[i], b = k[(i + 1) % 4]; const cr = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x); if (Math.abs(cr) > 1e-6) { if (s === 0) s = Math.sign(cr); else if (Math.sign(cr) !== s) return false; } } return true; };
    // the card's own shape, measured while it is still held over the hand (no square under it)
    const from = await r23Grip(page, await r23HoverCard(page, 6));
    await page.mouse.down();
    await page.mouse.move(from.x, from.y - 30, { steps: 3 });
    await page.waitForTimeout(300);
    const d0 = await dragCard(page);
    expect(d0.corners.length).toBe(4);
    const own = sides(sortQuad(d0.corners));
    for (const [r, c] of [[7, 6], [2, 7]]) {
      const p = await sqCenter(page, r, c);
      await page.mouse.move(p.x, p.y, { steps: 6 });
      await page.waitForTimeout(300);
      const d = await dragCard(page);
      const q = sortQuad(await quad4(page, r, c));
      expect(d.corners.length).toBe(4);
      const cs = sortQuad(d.corners), sz = sides(cs), sq = sides(q);
      expect(Math.abs(sz.w / sz.h - own.w / own.h) / (own.w / own.h), `own shape kept over ${r},${c}`).toBeLessThanOrEqual(0.03);
      expect(Math.abs(Math.max(sz.w, sz.h) - 0.88 * Math.min(sq.w, sq.h)), `88% of square ${r},${c}`).toBeLessThanOrEqual(4);
      for (const pt of cs) expect(inside(pt, q), `inside square ${r},${c}`).toBe(true);
      const cc = { x: cs.reduce((a, k) => a + k.x, 0) / 4, y: cs.reduce((a, k) => a + k.y, 0) / 4 };
      expect(Math.hypot(cc.x - p.x, cc.y - p.y), `centred on square ${r},${c}`).toBeLessThanOrEqual(4);
      expect(d.opacity).toBeGreaterThanOrEqual(0.8);
    }
    await page.mouse.move(10, 10, { steps: 6 });
    await page.mouse.up();
  });

  test('AC373: dropping on a highlighted legal square plays the card there exactly as before', async ({ page }) => {
    await r23Start(page);
    const before = await getState(page);
    await r26Grab(page, 6, 7, 6); // Grubgrabber Miner
    expect((await dragCard(page)).highlight).toMatchObject({ row: 7, col: 6, legal: true });
    await page.mouse.up();
    await expect.poll(async () => { const c = at(await getState(page), 7, 6); return c && c.cardId; }, { timeout: 3000 }).toBe('goblin-scrounger');
    const s = await getState(page);
    expect(s.players.player.hand.length).toBe(before.players.player.hand.length - 1);
    expect(s.players.player.crystals).toBe(before.players.player.crystals - 1);
    expect(await dragCard(page)).toBeFalsy();
  });

  test('AC375: the 3D canvas draws at the device pixel ratio; no scroll bars at 1920x1080, 2560x1080 and 3840x2160', async ({ page }) => {
    await start(page, quiet({}));
    for (const vp of [{ width: 1920, height: 1080 }, { width: 2560, height: 1080 }, { width: 3840, height: 2160 }]) {
      await page.setViewportSize(vp);
      await expect.poll(async () => { const c = (await renderStats(page)).canvas; return c && c.pixelRatio === 1 && near(c.bufferWidth, c.cssWidth, 2) && near(c.bufferHeight, c.cssHeight, 2); }, { timeout: 5000 }).toBe(true);
      const sc = await page.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight }));
      expect(sc.x <= 0 && sc.y <= 0, `no scroll bars at ${vp.width}x${vp.height}`).toBe(true);
    }
  });

  test('AC377: a payment that needs the Bank asks first; Yes pays Flow then Bank, No cancels', async ({ page }) => {
    await bankStart(page, 2, 3);
    const dlg = page.getByRole('dialog', { name: 'Use your banked crystals?' });
    await r26Play(page, 0, 7, 6); // Shiv Rat, cost 4
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'No', exact: true }).click();
    await expect(dlg).toBeHidden();
    expect(await flowBank(page)).toEqual([2, 3]);
    expect((await getState(page)).players.player.hand.length).toBe(2);
    expect(at(await getState(page), 7, 6)).toBeUndefined();
    await r26Play(page, 0, 7, 6);
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect.poll(async () => flowBank(page)).toEqual([0, 1]);
    expect(at(await getState(page), 7, 6).cardId).toBe('shiv-rat');
  });

  test('AC378: with enough Flow there is no question and the Bank is unchanged', async ({ page }) => {
    await bankStart(page, 4, 3);
    await r26Play(page, 0, 7, 6);
    await expect.poll(async () => flowBank(page)).toEqual([0, 3]);
    await expect(page.getByRole('dialog', { name: 'Use your banked crystals?' })).toHaveCount(0);
  });

  test('AC379: "Don\'t ask again" stops the question; the Settings switch brings it back, also after reload', async ({ page }) => {
    await bankStart(page, 2, 7);
    const dlg = page.getByRole('dialog', { name: 'Use your banked crystals?' });
    await r26Play(page, 0, 7, 6);
    await dlg.getByRole('checkbox', { name: "Don't ask again" }).check();
    await dlg.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect.poll(async () => flowBank(page)).toEqual([0, 5]);
    await r26Play(page, 0, 7, 7);
    await expect.poll(async () => flowBank(page)).toEqual([0, 1]);
    await expect(dlg).toHaveCount(0);
    await page.goto('/?test=1');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Ask before using banked crystals: Off' }).click();
    await expect(page.getByRole('button', { name: 'Ask before using banked crystals: On' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ask before using banked crystals: On' })).toBeVisible();
    await page.waitForFunction(() => !!window.oreheart);
    await newMatch(page, BANK_Q(2, 3));
    await page.evaluate(() => { window.__app.test = false; });
    await page.mouse.move(10, 10);
    await r26Play(page, 0, 7, 6);
    await expect(dlg).toBeVisible();
  });

  test('AC380: Commander speech bubbles are about 35% smaller', async ({ page }) => {
    await start(page, quiet({}));
    await page.evaluate(async () => await window.oreheart.showCommanderSpeech('player', 'Hah!'));
    const bubble = page.getByLabel('Commander speech', { exact: true }).first();
    await expect(bubble).toBeVisible();
    const sc = (await page.evaluate(async () => await window.oreheart.getUiScales())).commanderSpeech;
    expect(sc.scale).toBeGreaterThanOrEqual(0.6);
    expect(sc.scale).toBeLessThanOrEqual(0.7);
    const b = await bubble.boundingBox();
    const ratio = b.width / sc.unscaledWidth;
    expect(ratio, 'drawn width / old width').toBeGreaterThanOrEqual(0.6);
    expect(ratio).toBeLessThanOrEqual(0.7);
  });

  test('AC382: after any move this phase, Done ends the phase with no question', async ({ page }) => {
    const s = await start(page, { ai: false, setup: { playerHand: ['goblin-scrounger', 'goblin-scrounger'], playerCrystals: 2 } });
    expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 6 })).ok).toBe(true);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect.poll(async () => (await getState(page)).phase).toBe('action');
    await expect(page.getByRole('dialog', { name: /Moves still available/ })).toHaveCount(0);
  });

  test('AC383/AC384: with no move made, Done opens a drop-up above it in the Menu style; Go back keeps the phase, Continue ends it', async ({ page }) => {
    await start(page, { ai: false, setup: { board: [{ cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 2 }] } });
    // Menu pop-up style to compare with
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const menuStyle = await page.getByRole('menu', { name: 'Match menu' }).evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, border: c.borderTopColor }; });
    await page.getByRole('button', { name: 'Menu', exact: true }).click(); // closes it again
    await expect(page.getByRole('menu', { name: 'Match menu' })).toBeHidden();
    await done(page); // -> action, ready Miner next to the mine at (4,2)
    const doneBtn = page.getByRole('button', { name: 'Done', exact: true });
    await doneBtn.click();
    const dlg = page.getByRole('dialog', { name: /Moves still available/ });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("Moves still available (miners haven't mined). Continue to the next phase?");
    const d = await dlg.boundingBox(), btn = await doneBtn.boundingBox();
    const gap = btn.y - (d.y + d.height);
    expect(gap, 'opens upward from Done').toBeGreaterThanOrEqual(-2);
    expect(gap).toBeLessThanOrEqual(12);
    const st = await dlg.evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, border: c.borderTopColor }; });
    expect(st).toEqual(menuStyle);
    const rgba = st.bg.match(/[\d.]+/g).map(Number);
    expect(rgba.length === 4 && rgba[3] < 1 && rgba[0] < 80 && rgba[1] < 80 && rgba[2] < 80, 'see-through dark').toBe(true);
    expect(st.border).toMatch(/^rgba?\(0, 0, 0/);
    await dlg.getByRole('button', { name: 'Go back', exact: true }).click();
    await expect(dlg).toBeHidden();
    expect((await getState(page)).phase).toBe('action');
    await doneBtn.click();
    await dlg.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect.poll(async () => (await getState(page)).activePlayer).toBe('opponent');
  });

  // Owner change (Oct 29, 73b62fb8/135b9f4e/cd698e7): no emblem picture and no skull/gear/hammer symbol above an owned mine; the mine's colour shows the owner
  test('AC385: a controlled mine shows no faction emblem picture and no emoji symbol', async ({ page }) => {
    for (const [cmd, miner] of [['grubnak', 'goblin-scrounger'], ['borgo', 'dwarf-miner']]) {
      const s = await (cmd === 'grubnak' ? start : newMatch)(page, { ai: false, playerCommander: cmd, setup: { board: [{ cardId: miner, owner: 'player', row: 5, col: 2 }] } });
      await done(page);
      expect((await act(page, { type: 'mine', creatureUid: at(s, 5, 2).uid, row: 4, col: 2 })).ok).toBe(true);
      await done(page); // mine control is recomputed at the next Draw phase (engine recolorMines)
      await expect.poll(async () => (await getState(page)).sites.find((x) => x.row === M1.row && x.col === M1.col).controller, { timeout: 5000 }).toBe('player');
      const site = siteBtn(page, M1);
      await expect(site.locator('img:visible')).toHaveCount(0, { timeout: 5000 }); // Owner change (Oct 29): the emblem picture is hidden
      await expect(site).not.toContainText(/💀|⚙️|🔨/);
    }
  });

  test('AC386: the Respond box is 1.3x bigger with buttons at least 44 px tall', async ({ page }) => {
    const s = await start(page, respondSetup);
    expect((await act(page, { type: 'cast', uid: handUid(s, 'opponent', 'fireball'), target: { row: 6, col: 4 } })).ok).toBe(true);
    const dlg = page.getByRole('dialog', { name: 'Respond?' });
    await expect(dlg).toBeVisible();
    const sc = (await page.evaluate(async () => await window.oreheart.getUiScales())).respond;
    const b = await dlg.boundingBox();
    for (const r of [b.width / sc.unscaledWidth, b.height / sc.unscaledHeight]) { expect(r).toBeGreaterThanOrEqual(1.25); expect(r).toBeLessThanOrEqual(1.35); }
    const btns = dlg.getByRole('button');
    for (let i = 0; i < await btns.count(); i++) expect((await btns.nth(i).boundingBox()).height).toBeGreaterThanOrEqual(44);
  });

  test('AC387: Junk Shaman lift — the character follows the pointer and lands on the square you click; 2 crystals paid', async ({ page }) => {
    let s = await start(page, q12({ playerCrystals: 4, board: [P('junk-shaman', 6, 9), O('dwarf-pickman', 2, 9)] }));
    s = await toAction(page);
    await page.evaluate(() => { window.__app.test = false; });
    const tos = (await legal(page)).filter((a) => a.type === 'ability' && a.ability === 'pickUp' && sameTarget(a.target, 2, 9)).map((a) => `${a.to.row},${a.to.col}`).sort();
    await page.locator(`[data-ability="pickUp"][data-creature-uid="${at(s, 6, 9).uid}"]`).click();
    const t = await sqCenter(page, 2, 9);
    await page.mouse.click(t.x, t.y);
    await expect.poll(async () => (await page.evaluate(async () => await window.oreheart.getLiftState())).active).toBe(true);
    const lift = await page.evaluate(async () => await window.oreheart.getLiftState());
    expect(lift.legalSquares.map((q) => `${q.row},${q.col}`).sort(), 'highlighted squares = legal landing squares').toEqual(tos);
    const p = await sqCenter(page, 7, 13);
    await page.mouse.move(p.x, p.y, { steps: 8 });
    expect((await page.evaluate(async () => await window.oreheart.getLiftState())).hover).toMatchObject({ row: 7, col: 13 });
    await page.mouse.click(p.x, p.y);
    await expect.poll(async () => { const c = at(await getState(page), 7, 13); return c && c.cardId; }).toBe('dwarf-pickman');
    expect((await getState(page)).players.player.crystals).toBe(2);
  });

  test('AC388: Junk Shaman lift — squares farther than 5 are not highlighted and do nothing; cancel pays nothing', async ({ page }) => {
    let s = await start(page, q12({ playerCrystals: 4, board: [P('junk-shaman', 6, 9), O('dwarf-pickman', 2, 9)] }));
    s = await toAction(page);
    await page.evaluate(() => { window.__app.test = false; });
    await page.locator(`[data-ability="pickUp"][data-creature-uid="${at(s, 6, 9).uid}"]`).click();
    const t = await sqCenter(page, 2, 9);
    await page.mouse.click(t.x, t.y);
    await expect.poll(async () => (await page.evaluate(async () => await window.oreheart.getLiftState())).active).toBe(true);
    const lift = await page.evaluate(async () => await window.oreheart.getLiftState());
    expect(lift.legalSquares.every((q) => Math.max(Math.abs(q.row - 6), Math.abs(q.col - 9)) <= 5)).toBe(true);
    const far = await sqCenter(page, 7, 2 + 1); // 6 columns from the Shaman
    await page.mouse.click(far.x, far.y);
    await page.waitForTimeout(300);
    expect(at(await getState(page), 2, 9).cardId).toBe('dwarf-pickman');
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await page.evaluate(async () => await window.oreheart.getLiftState())).active).toBe(false);
    s = await getState(page);
    expect(s.players.player.crystals).toBe(4);
    expect(at(s, 2, 9).cardId).toBe('dwarf-pickman');
  });

  test('AC389: hovering across the hand never flickers or turns cards see-through', async ({ page }) => {
    await r23Start(page);
    const fan = await r23Fan(page);
    await page.evaluate(() => {
      const btns = [...document.querySelector('[aria-label="Your hand"]').querySelectorAll('button')].filter((b) => b.querySelector('[data-card-id]'));
      window.__r26 = { min: 1, cls: btns.map(() => 0), run: true };
      const mo = new MutationObserver((ms) => ms.forEach((m) => { const i = btns.indexOf(m.target); if (i >= 0) window.__r26.cls[i]++; }));
      btns.forEach((b) => mo.observe(b, { attributes: true, attributeFilter: ['class'] }));
      const tick = () => {
        for (const b of btns) for (const e of [b, b.querySelector('[data-card-id]')]) window.__r26.min = Math.min(window.__r26.min, parseFloat(getComputedStyle(e).opacity));
        if (window.__r26.run) requestAnimationFrame(tick);
      };
      tick();
    });
    const y = Math.min(fan[3].cy + fan[3].height * 0.2, page.viewportSize().height - 4);
    const x0 = fan[0].cx - fan[0].width * 0.4, x1 = fan[6].cx + fan[6].width * 0.4;
    await page.mouse.move(x0, y, { steps: 4 });
    for (let k = 0; k <= 40; k++) await page.mouse.move(x0 + (x1 - x0) * k / 40, y);
    const sweep = await page.evaluate(() => window.__r26.cls.slice());
    await page.waitForTimeout(1000);
    const r = await page.evaluate(() => { window.__r26.run = false; return window.__r26; });
    expect(r.min, 'no hand card below 0.99 opacity').toBeGreaterThanOrEqual(0.99);
    sweep.forEach((n, i) => expect(n, `card ${i} pop class toggles during the sweep`).toBeLessThanOrEqual(4));
    expect(r.cls, 'no class changes while holding still').toEqual(sweep);
  });

  test('AC391/AC396: Skullflinger plays his normal attack clip, no flying skull is created, the hit lands', async ({ page }) => {
    test.setTimeout(60000);
    await start(page, quiet({ board: [
      { cardId: 'goblin-slinger', owner: 'player', row: 6, col: 5 },
      { cardId: 'grubnaks-big-boss-troll', owner: 'opponent', row: 3, col: 5 },
    ] }));
    if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
    let s = await getState(page);
    const sl = at(s, 6, 5), troll = at(s, 3, 5);
    await expect.poll(async () => (await r22Fig(page, sl.uid)).source, { timeout: 20000 }).toBe('goblin-slinger.glb');
    let atk = null;
    for (let k = 0; k < 5 && !atk; k++) { await done(page); atk = (await legal(page)).find((a) => a.type === 'attack' && a.creatureUid === sl.uid); }
    expect(atk).toBeTruthy();
    expect((await act(page, atk)).ok).toBe(true);
    expect(at(await getState(page), 3, 5).health).toBe(troll.health - sl.attack);
    await expect.poll(async () => ((await renderStats(page)).creatureAnimLog || []).some((e) => e.uid === sl.uid && e.anim === 'attack' && ['OH_Attack', 'Skull_Throw'].includes(e.clip)), { timeout: 10000 }).toBe(true);
    for (let k = 0; k < 6; k++) {
      const st = await renderStats(page);
      expect((st.projectiles || []).filter((p) => p.shooterUid === sl.uid), 'no flying skull').toEqual([]);
      expect((st.projectileLog || []).filter((p) => p.shooterUid === sl.uid)).toEqual([]);
      await page.waitForTimeout(250);
    }
    await expect.poll(async () => ((await renderStats(page)).creatureAnimLog || []).some((e) => e.uid === troll.uid && e.anim === 'hit'), { timeout: 5000 }).toBe(true);
  });
});

test.describe('round 26 high-density screen', () => {
  test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  test('AC375: with deviceScaleFactor 2 the 3D drawing buffer is 2x its CSS size', async ({ page }) => {
    await start(page, quiet({}));
    if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
    await expect.poll(async () => { const c = (await renderStats(page)).canvas; return c && c.pixelRatio === 2 && near(c.bufferWidth, 2 * c.cssWidth, 2) && near(c.bufferHeight, 2 * c.cssHeight, 2); }, { timeout: 5000 }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  });
});

test.describe('round 26 first click', () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test('AC376: the first click asks for fullscreen once; a refusal shows no error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      window.__fs = 0;
      Element.prototype.requestFullscreen = function () { window.__fs++; return Promise.reject(new Error('refused')); };
    });
    await page.goto('/');
    await page.mouse.click(40, 40);
    await expect.poll(async () => page.evaluate(() => window.__fs)).toBe(1);
    await page.mouse.click(60, 60);
    await page.mouse.click(80, 80);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__fs)).toBe(1);
    expect(errors).toEqual([]);
  });
});

for (const vp of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 844, height: 390 }]) {
  test.describe(`round 26 layout ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test(`AC374: the full hand shows at least 50 % of every card (Ken, Oct 30) and every card is on screen at its tucked rest (${vp.width}x${vp.height})`, async ({ page }) => {
      // owner check change (Ken, Oct 30 hand spec): was "spaced 0.26 of a card"
      await r23Start(page);
      const fan = await r23Fan(page);
      expect(fan.length).toBe(7);
      for (let i = 1; i < 7; i++) {
        const g = (fan[i].cx - fan[i - 1].cx) / fan[0].width;
        expect(g).toBeGreaterThanOrEqual(0.5); expect(g).toBeLessThanOrEqual(0.7);
      }
      const btns = handButtons(page);
      for (let i = 0; i < 7; i++) {
        const b = await btns.nth(i).boundingBox();
        expect(b.x >= -1 && b.x + b.width <= vp.width + 1 && await restTuckedOk(page, b, vp.height), `card ${i} on screen at its tucked rest (Ken, Oct 30)`).toBe(true);
      }
    });

    test(`AC381: the mine-all pickaxe badge is fully visible and uncovered (${vp.width}x${vp.height})`, async ({ page }) => {
      await start(page, { ai: false, setup: { board: [
        { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 2 },
        { cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 3 },
      ] } });
      await done(page);
      const badge = siteBtn(page, M1).locator('[data-mine-badge]');
      await expect(badge).toBeVisible();
      // Owner change (Oct 28, 9d92f74): the badge is Ken's pickaxe picture; the ×2 count sits beside it on the site, not inside the badge
      await expect(badge.locator('img.pk-img')).toBeVisible();
      await expect(siteBtn(page, M1)).toContainText('×2');
      const ok = await badge.evaluate((e) => {
        // Owner change (Oct 29, 73b62fb8): the badge has pointer-events:none so units can be grabbed; ignore that while checking it is not covered
        const els = [e, ...e.querySelectorAll('*')], saved = els.map((x) => x.style.getPropertyValue('pointer-events'));
        els.forEach((x) => x.style.setProperty('pointer-events', 'auto', 'important'));
        try {
        const r = e.getBoundingClientRect();
        if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) return 'outside the window';
        const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2]];
        for (const [x, y] of pts) { const h = document.elementFromPoint(x, y); // The board's own 3D canvas draws over its page layer in 3D mode; its own mine button and the board canvas are not covers; any other UI is
        if (!h || !(h === e || e.contains(h) || h === e.closest('.site-mark') || (h.tagName === 'CANVAS' && h.closest('.board')))) return `covered at ${Math.round(x)},${Math.round(y)}`; }
        return 'ok';
        } finally { els.forEach((x, i) => { if (saved[i]) x.style.setProperty('pointer-events', saved[i]); else x.style.removeProperty('pointer-events'); }); }
      });
      expect(ok).toBe('ok');
    });
  });
}

test.describe('round 26 Respond on a phone', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('AC386: at 844x390 the Respond box and all its buttons are fully on screen', async ({ page }) => {
    const s = await start(page, respondSetup);
    expect((await act(page, { type: 'cast', uid: handUid(s, 'opponent', 'fireball'), target: { row: 6, col: 4 } })).ok).toBe(true);
    const dlg = page.getByRole('dialog', { name: 'Respond?' });
    await expect(dlg).toBeVisible();
    const inView = (b) => b.x >= -1 && b.y >= -1 && b.x + b.width <= 845 && b.y + b.height <= 391;
    expect(inView(await dlg.boundingBox())).toBe(true);
    const btns = dlg.getByRole('button');
    for (let i = 0; i < await btns.count(); i++) expect(inView(await btns.nth(i).boundingBox())).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  });
});

// Models: owner Model Editor parts and OH_ clip maps
const glbClips = async (request, id) => {
  const buf = await (await request.get(`/models/creatures/${id}/char.glb`)).body();
  return (JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8')).animations || []).map((a) => a.name);
};
async function r26Models(page, request, ids) {
  const board = ids.map((id, i) => ({ cardId: id, owner: 'player', row: 7 - (i % 2), col: 3 + Math.floor(i / 2) * 2 }));
  await start(page, quiet({ board }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  const s = await getState(page);
  for (const [i, id] of ids.entries()) {
    const c = at(s, board[i].row, board[i].col);
    expect(c && c.cardId).toBe(id);
    const want = R26_SETUPS[id] || [];
    // AC392 / AC393 / AC394: every part from the owner's setups file is attached with the same bone and transform, and loads
    await expect.poll(async () => {
      const parts = (await r22Fig(page, c.uid)).parts || [];
      return want.every(([bone, pos, rot, scale]) => parts.some((p) => p.loaded === true && p.bone === bone
        && pos.every((v, k) => near(p.pos[k], v, 0.001)) && rot.every((v, k) => near(p.rotDeg[k], v, 0.001)) && scale.every((v, k) => near(p.scale[k], v, 0.001))));
    }, { message: `${id}: parts like the Model Editor`, timeout: 40000 }).toBe(true);
    // AC390: the idle clip is the one named in models.json "clips"
    const mj = await (await request.get(`/models/creatures/${id}/models.json`)).json();
    // owner change (Ken / Spring, Oct 30): a card whose idle slot is { pack: "random" } (src/content/anim-slots.json) idles with a random shared-pack idle instead
    const packIdle = ((await page.evaluate(() => (window.__animSlotLog || []).slice())) || []).some((e) => e.id === id && e.role === 'idle' && e.how === 'pack-random');
    if (packIdle) await expect.poll(async () => (await r22Fig(page, c.uid)).currentClip, { message: `${id} pack idle`, timeout: 10000 }).toMatch(/^biped-idle-\d+$/);
    else if (mj.clips && mj.clips.idle) await expect.poll(async () => (await r22Fig(page, c.uid)).currentClip, { message: `${id} idle clip`, timeout: 10000 }).toBe(mj.clips.idle);
  }
}

test('AC390/AC392/AC393: Goblin figures carry their parts exactly as in the owner\'s Model Editor and idle on their OH_ clip', async ({ page, request }) => {
  test.setTimeout(120000);
  await r26Models(page, request, ['goblin-grunt', 'goblin-slinger', 'junk-shaman', 'shiv-rat', 'skullbasher-rusher', 'goblin-scrapper']);
});

test('AC390/AC394: Thunderwing Gyronaut and Aegis Tinkerer have their gear, events.json and a clips map whose clips exist', async ({ page, request }) => {
  test.setTimeout(90000);
  for (const id of ['gyrocopter-ace', 'gnome-tinker']) {
    const mj = await (await request.get(`/models/creatures/${id}/models.json`)).json();
    expect(mj.clips && Object.keys(mj.clips).length, `${id} clips map`).toBeTruthy();
    expect((await request.get(`/models/creatures/${id}/events.json`)).ok(), `${id} events.json`).toBe(true);
    const clips = await glbClips(request, id);
    for (const [role, name] of Object.entries(mj.clips)) expect(clips, `${id} ${role} -> ${name}`).toContain(name);
  }
  await r26Models(page, request, ['gyrocopter-ace', 'gnome-tinker']);
});

// ---------- Ken (Oct 30): stacking effects (approved plan factory-design/design/stacking-effects-proposal.md) ----------
const stk = (s, row, col) => at(s, row, col) || {};
const cast = (page, s, cardId, target) => act(page, { type: 'cast', uid: handUid(s, 'player', cardId), target });

test('AC397: Venom Shiv stacks: 2 then 3 damage a turn, never more than 3; the clock keeps the longer', async ({ page }) => {
  let s = await start(page, q12({ playerHand: ['venom-shiv', 'venom-shiv', 'venom-shiv', 'venom-shiv'], playerCrystals: 20, playerBank: 20, board: [O('dwarf-pickman', 2, 9)] }));
  expect((await cast(page, s, 'venom-shiv', { row: 2, col: 9 })).ok).toBe(true);
  s = await getState(page);
  expect([stk(s, 2, 9).poison, stk(s, 2, 9).poisonStacks]).toEqual([7, 1]);
  expect((await cast(page, s, 'venom-shiv', { row: 2, col: 9 })).ok).toBe(true);
  s = await getState(page);
  expect([stk(s, 2, 9).poison, stk(s, 2, 9).poisonStacks]).toEqual([7, 2]);
  const hp = stk(s, 2, 9).health;
  await passTurn(page); // the opponent's turn starts: 2 poison damage, no healing
  s = await getState(page);
  expect(stk(s, 2, 9).health).toBe(hp - 2);
  expect(stk(s, 2, 9).poison).toBe(6);
  await passTurn(page);
  s = await getState(page);
  expect((await cast(page, s, 'venom-shiv', { row: 2, col: 9 })).ok).toBe(true);
  s = await getState(page);
  expect((await cast(page, s, 'venom-shiv', { row: 2, col: 9 })).ok).toBe(true);
  s = await getState(page);
  expect(stk(s, 2, 9).poisonStacks).toBe(3); // a fourth dagger stays at the cap
  expect(stk(s, 2, 9).poison).toBe(7);
  const hp2 = stk(s, 2, 9).health;
  await passTurn(page);
  s = await getState(page);
  expect(stk(s, 2, 9).health).toBe(hp2 - 3);
});

test('AC398: a fresh dagger on a nearly-finished poison sets 7 turns, not 7 more', async ({ page }) => {
  let s = await start(page, q12({ playerHand: ['venom-shiv'], playerCrystals: 9, board: [O('dwarf-pickman', 2, 9, { poison: 3, poisonStacks: 1 })] }));
  expect((await cast(page, s, 'venom-shiv', { row: 2, col: 9 })).ok).toBe(true);
  s = await getState(page);
  expect([stk(s, 2, 9).poison, stk(s, 2, 9).poisonStacks]).toEqual([7, 2]);
});

test('AC399: two Ironclad Bulwarks block the next two hits, the third lands', async ({ page }) => {
  let s = await start(page, q12({ playerHand: ['shield-bubble', 'shield-bubble'], playerCrystals: 9,
    board: [P('dwarf-pickman', 5, 9), O('goblin-grunt', 4, 9), O('goblin-pebbler', 4, 8), O('goblin-scrounger', 4, 10)] }));
  expect((await cast(page, s, 'shield-bubble', { row: 5, col: 9 })).ok).toBe(true);
  s = await getState(page);
  expect((await cast(page, s, 'shield-bubble', { row: 5, col: 9 })).ok).toBe(true);
  s = await getState(page);
  expect(stk(s, 5, 9).bubbles).toBe(2);
  const full = stk(s, 5, 9).health;
  await passTurn(page); await done(page); // the opponent's Action phase
  for (const [r, c, left] of [[4, 9, 1], [4, 8, 0]]) {
    s = await getState(page);
    expect((await act(page, { type: 'attack', creatureUid: at(s, r, c).uid, target: { row: 5, col: 9 } })).ok).toBe(true);
    s = await getState(page);
    expect(stk(s, 5, 9).health, `blocked by bubble ${left + 1}`).toBe(full);
    expect(stk(s, 5, 9).bubbles || 0).toBe(left);
  }
  s = await getState(page);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 4, 10).uid, target: { row: 5, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(stk(s, 5, 9).health).toBeLessThan(full);
});

test('AC400: Thunderhorn Blast stacks once: +1, then +2, a third is still +2; gone next turn', async ({ page }) => {
  let s = await start(page, q12({ playerHand: ['battle-cry', 'battle-cry', 'battle-cry'], playerCrystals: 20, board: [P('goblin-grunt', 5, 9), O('grubnaks-big-boss-troll', 4, 9)] }));
  s = await toAction(page);
  const g = at(s, 5, 9), base = g.attack;
  const deal = async () => (await preview(page, g.uid, { row: 4, col: 9 })).youDeal;
  expect(await deal()).toBe(base);
  for (const want of [base + 1, base + 2, base + 2]) {
    s = await getState(page);
    expect((await cast(page, s, 'battle-cry', null)).ok).toBe(true);
    expect(await deal()).toBe(want);
  }
  await passTurn(page); await passTurn(page);
  expect(await deal()).toBe(base);
});

test('AC401: Troll Tyrants: two give Goblins +2, three still +2', async ({ page }) => {
  const tyrants = (n) => Array.from({ length: n }, (_, i) => P('grubnaks-big-boss-troll', 7, 3 + i * 2));
  for (const [n, plus] of [[1, 1], [2, 2], [3, 2]]) {
    let s = await start(page, q12({ board: [P('goblin-grunt', 5, 9), O('grubnaks-big-boss-troll', 4, 9), ...tyrants(n)] }));
    s = await toAction(page);
    const g = at(s, 5, 9);
    expect((await preview(page, g.uid, { row: 4, col: 9 })).youDeal, `${n} Tyrants`).toBe(g.attack + plus);
  }
});

test('AC402: Junk Boost: next to the Bowler Brawler and the Junk Shaman a Goblin gets +2 on its own turn', async ({ page }) => {
  let s = await start(page, q12({ board: [P('goblin-grunt', 5, 9), P('goblin-scrapper', 5, 8), P('junk-shaman', 5, 10), O('grubnaks-big-boss-troll', 4, 9)] }));
  s = await toAction(page);
  const g = at(s, 5, 9);
  expect((await preview(page, g.uid, { row: 4, col: 9 })).youDeal).toBe(g.attack + 2);
  s = await newMatch(page, q12({ board: [P('goblin-grunt', 5, 9), P('goblin-scrapper', 5, 8), O('grubnaks-big-boss-troll', 4, 9)] }));
  s = await toAction(page);
  expect((await preview(page, at(s, 5, 9).uid, { row: 4, col: 9 })).youDeal).toBe(at(s, 5, 9).attack + 1);
});

test('AC403: two Grudge Hurler hits root for its next two turns; a third does not make it three', async ({ page }) => {
  let s = await start(page, q12({ board: [P('axe-thrower', 6, 9, { attack: 1 }), P('axe-thrower', 6, 5, { attack: 1 }), P('axe-thrower', 6, 13, { attack: 1 }), O('dwarf-pickman', 2, 9)] }));
  s = await toAction(page);
  const turn = s.turn;
  expect((await act(page, { type: 'attack', creatureUid: at(s, 6, 9).uid, target: { row: 2, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(stk(s, 2, 9).rootUntil).toBe(turn + 2);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 6, 5).uid, target: { row: 2, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(stk(s, 2, 9).rootUntil).toBe(turn + 4);
  expect((await act(page, { type: 'attack', creatureUid: at(s, 6, 13).uid, target: { row: 2, col: 9 } })).ok).toBe(true);
  s = await getState(page);
  expect(stk(s, 2, 9).rootUntil).toBe(turn + 4);
  await done(page); await done(page); // opponent's Action: rooted
  s = await getState(page);
  expect((await legal(page)).some((a) => a.type === 'move' && a.creatureUid === at(s, 2, 9).uid)).toBe(false);
  await done(page); await passTurn(page); await done(page); // its next Action: still rooted
  s = await getState(page);
  expect((await legal(page)).some((a) => a.type === 'move' && a.creatureUid === at(s, 2, 9).uid)).toBe(false);
  await done(page); await passTurn(page); await done(page); // the one after: free
  s = await getState(page);
  expect((await legal(page)).some((a) => a.type === 'move' && a.creatureUid === at(s, 2, 9).uid)).toBe(true);
});

test('AC404: exceptions: Ward refreshes, never stacks; a shielded Riot Shield Bearer cannot be lifted by the Junk Shaman', async ({ page }) => {
  let s = await start(page, q12({ playerCrystals: 9, board: [P('glyphshield-warden', 6, 9), P('glyphshield-warden', 6, 11), P('dwarf-pickman', 6, 10)] }));
  s = await toAction(page);
  const ward = async (r, c) => ability(page, s, r, c, 'ward', { target: { row: 6, col: 10 } });
  expect((await ward(6, 9)).ok).toBe(true);
  s = await getState(page);
  const w1 = stk(s, 6, 10).wardUntil;
  expect((await ward(6, 11)).ok).toBe(true);
  s = await getState(page);
  expect(stk(s, 6, 10).wardUntil).toBe(w1);
  s = await newMatch(page, q12({ playerCrystals: 9, board: [P('junk-shaman', 6, 9), O('dwarf-miner', 4, 9, { lockedUntil: 7 }), O('dwarf-pickman', 4, 11)] }));
  s = await toAction(page);
  const lifts = (await legal(page)).filter((a) => a.type === 'ability' && a.ability === 'pickUp');
  const from = (r, c) => lifts.some((a) => a.target && a.target.row === r && a.target.col === c);
  expect(from(4, 11), 'can lift a normal unit').toBe(true);
  expect(from(4, 9), 'cannot lift a shielded Riot Shield Bearer').toBe(false);
});

test('AC405: the stacking cards say so, and a stacked poison shows x2', async ({ page }) => {
  await openTest(page);
  const text = async (id) => (await page.evaluate(async (x) => await window.oreheart.getCard(x), id)).text;
  expect(await text('venom-shiv')).toMatch(/Stacks: each extra dagger adds 1 damage a turn \(up to 3\)\./);
  expect(await text('shield-bubble')).toMatch(/Stacks: two Bulwarks block the next two hits\./);
  expect(await text('battle-cry')).toMatch(/Stacks once: two Blasts give \+2\./);
  expect(await text('grubnaks-big-boss-troll')).toMatch(/Two Tyrants: \+2\./);
  expect(await text('goblin-scrapper')).toMatch(/up to \+2 with the Junk Shaman/);
  expect(await text('junk-shaman')).toMatch(/up to \+2 with the Bowler Brawler/);
  expect(await text('axe-thrower')).toMatch(/A second hit holds it one turn longer\./);
  const cfg = await page.evaluate(async () => await window.oreheart.getConfig());
  expect([cfg.stackCap, cfg.auraStackCap, cfg.rootStackCap]).toEqual([3, 2, 2]);
});
// Owner rule (Ken, Oct 30): Miners "can't attack their first turn, but they can mine their first turn"; from the owner's next turn on they attack like any creature.
test('AC409: a Miner summoned this turn can mine but not attack; from its next turn it attacks with normal strike-back', async ({ page }) => {
  // mine at (4,4); Tunnel lets the Goblin Miner come down at (5,4), beside the mine and beside an enemy Boneknocker (1/2) at (5,5)
  // Owner check change (Ken, Oct 31: Tunnel only beside a mine your side owns): a player Scrapper at (3,4) has mined (4,4), so the player owns it
  let s = await start(page, quiet({ playerDeck: SHARDS, opponentDeck: SHARDS, playerHand: ['goblin-scrounger'], playerCrystals: 5, board: [O('goblin-pebbler', 5, 5), P('goblin-scrapper', 3, 4, { minedMine: { row: 4, col: 4 } })] }));
  expect(s.sites.find((x) => x.row === 4 && x.col === 4).controller).toBe('player');
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrounger'), row: 5, col: 4 })).ok).toBe(true);
  s = await getState(page);
  const uid = at(s, 5, 4).uid;
  expect(at(s, 5, 4).summonedThisTurn).toBe(true);
  await done(page); // -> Action, same turn
  let legalNow = await legal(page);
  expect(legalNow.some((a) => a.type === 'attack' && a.creatureUid === uid), 'no attack the turn it is played').toBe(false);
  expect(legalNow.some((a) => a.type === 'mine' && a.creatureUid === uid && a.row === 4 && a.col === 4), 'but it can mine').toBe(true);
  expect(legalNow.some((a) => a.type === 'mineAt' && a.row === 4 && a.col === 4), 'tap-to-mine counts it as ready').toBe(true);
  expect((await act(page, { type: 'mine', creatureUid: uid, row: 4, col: 4 })).ok).toBe(true);
  s = await getState(page);
  expect(creature(s, uid).hasMined).toBe(true);
  await done(page); // end Action -> opponent's turn
  await passTurn(page); // opponent passes -> player's turn 2
  await done(page); // -> Action
  s = await getState(page);
  expect(s.turn).toBe(3); // the player's second turn
  const hp = at(s, 5, 5).health; // 1/2 Boneknocker (+1 Health from Borgo)
  legalNow = await legal(page);
  expect(legalNow.some((a) => a.type === 'attack' && a.creatureUid === uid && sameTarget(a.target, 5, 5)), 'its next turn: attack is legal').toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: uid, target: { row: 5, col: 5 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 5, 5).health, 'the Boneknocker takes 1 damage from the Miner').toBe(hp - 1);
  expect(creature(s, uid), 'the 1-Health Miner falls to the normal strike-back').toBeUndefined();
});

test('AC410: a Smith Miner summoned as a Miner follows the same rule: move or mine now, attack from its next turn', async ({ page }) => {
  // one Scrapsmith comes down from hand onto the back row at (7,4) beside an enemy at (6,5); a second one stands beside mine (4,4) as if just summoned
  let s = await start(page, quiet({ playerDeck: SHARDS, opponentDeck: SHARDS, playerHand: ['goblin-smith-miner'], playerCrystals: 5,
    board: [P('goblin-smith-miner', 5, 4, { summonedThisTurn: true }), O('goblin-pebbler', 5, 5), O('goblin-pebbler', 6, 5)] }));
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-smith-miner'), row: 7, col: 4 })).ok).toBe(true);
  s = await getState(page);
  const back = at(s, 7, 4).uid, mid = at(s, 5, 4).uid;
  expect(at(s, 7, 4).summonedThisTurn).toBe(true);
  await done(page); // -> Action
  let legalNow = await legal(page);
  for (const u of [back, mid]) expect(legalNow.some((a) => a.type === 'attack' && a.creatureUid === u), 'no attack on the summon turn').toBe(false);
  expect(legalNow.some((a) => a.type === 'move' && a.creatureUid === back), 'it may move').toBe(true);
  expect(legalNow.some((a) => a.type === 'mine' && a.creatureUid === mid && a.row === 4 && a.col === 4), 'it may mine').toBe(true);
  expect((await act(page, { type: 'mine', creatureUid: mid, row: 4, col: 4 })).ok).toBe(true);
  await done(page);
  await passTurn(page);
  await done(page); // player's second turn, Action
  s = await getState(page);
  const hp = at(s, 6, 5).health;
  legalNow = await legal(page);
  expect(legalNow.some((a) => a.type === 'attack' && a.creatureUid === back && sameTarget(a.target, 6, 5)), 'next turn the back-row Smith Miner can attack').toBe(true);
  expect(legalNow.some((a) => a.type === 'attack' && a.creatureUid === mid && sameTarget(a.target, 5, 5)), 'and so can the one that mined').toBe(true);
  expect((await act(page, { type: 'attack', creatureUid: back, target: { row: 6, col: 5 } })).ok).toBe(true);
  s = await getState(page);
  expect(at(s, 6, 5).health).toBe(hp - 1);
});

test('AC411: the Miner cards say "Can\'t attack the turn it\'s played" and no card says Miners never attack', async ({ page }) => {
  await openTest(page);
  const card = async (id) => await page.evaluate(async (x) => await window.oreheart.getCard(x), id);
  for (const id of ['goblin-scrounger', 'gnome-prospector']) {
    const c = await card(id);
    expect(c.text, id).toMatch(/Can't attack the turn it's played\./);
    expect(c.shortText, id).toMatch(/Can't attack the turn it's played\./);
    expect(c.longText, id).toMatch(/Can't attack the turn it's played/);
    expect(c.longText, id).not.toMatch(/never attack/i);
  }
  for (const id of ['goblin-smith-miner', 'gnome-smith-miner', 'dwarf-smith-miner']) {
    const c = await card(id);
    expect(c.longText, id).toMatch(/can mine or move that turn, but can't attack until its next turn/);
    expect(c.longText, id).not.toMatch(/never attack/i);
  }
  const bearer = await card('dwarf-miner'); // Riot Shield Bearer (a Miner again since Oct 31): its short text keeps the Riot Shield
  expect(bearer.text).toMatch(/Riot Shield/);
  expect(bearer.text).not.toMatch(/turn it's played/);

// ---------- Owner (Ken, Oct 30): close-up ✕ Close, the computer's played card, the enemy discard pile, the Bulwark bubble ----------
});

test.describe('Oct 30 Ken at 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  const visBoxes = (loc) => loc.evaluateAll((els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => e.getBoundingClientRect().toJSON()));

  test('AC413: the card close-up has a small ✕ Close at the card\'s top-right; outside tap and Esc still close it', async ({ page }) => {
    await start(page, quiet({ playerHand: ['fireball'], board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 5 }] }));
    await page.waitForTimeout(800);
    const unit = page.getByLabel('Bowler Brawler, row 6, column 5', { exact: true });
    const dlg = page.getByRole('dialog', { name: 'Bowler Brawler', exact: true });
    await unit.click({ button: 'right' });
    await expect(dlg).toBeVisible();
    const x = dlg.getByRole('button', { name: 'Close', exact: true });
    await expect(x).toBeVisible();
    await expect(x).toHaveText('✕');
    const f = await dlg.locator('[data-card-id="goblin-scrapper"]').first().boundingBox(), xb = await x.boundingBox();
    expect(xb.width).toBeLessThanOrEqual(64); // small
    expect(xb.x + xb.width / 2).toBeGreaterThan(f.x + f.width * 0.8); // top-right of the card
    expect(xb.y + xb.height / 2).toBeLessThan(f.y + f.height * 0.15);
    await x.click();
    await expect(dlg).toBeHidden();
    await unit.click({ button: 'right' });
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    await unit.click({ button: 'right' });
    await expect(dlg).toBeVisible();
    await page.mouse.click(15, 540);
    await expect(dlg).toBeHidden();
  });

  test('AC414: the computer\'s played card pops up big in the middle for about a second, then is laid down on its discard pile', async ({ page }) => {
    const W = 1920, H = 1080;
    await page.goto('/?test=1&seed=123&fx=1');
    await page.waitForFunction(() => !!window.oreheart);
    // the normal close-up size, to compare with
    await newMatch(page, quiet({ playerHand: ['soul-shard'] }));
    await page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: /./ }).first().click();
    const view = page.getByRole('dialog').filter({ has: page.locator('[data-card-id="soul-shard"]') });
    await expect(view).toBeVisible();
    const closeUp = await view.locator('[data-card-id="soul-shard"]').first().boundingBox();
    await page.keyboard.press('Escape');
    const s = await newMatch(page, { ...quiet({ opponentHand: ['soul-shard'] }), firstPlayer: 'opponent' });
    const pile = page.getByRole('button', { name: 'Enemy discard pile', exact: true });
    await expect(pile).toHaveAttribute('data-count', '0');
    expect((await act(page, { type: 'playCrystal', uid: s.players.opponent.hand[0].uid })).ok).toBe(true);
    const big = page.locator('[aria-label="Card reveal"][data-side="opponent"][data-stage="big"]');
    await expect(big).toHaveCount(1);
    await expect(big).toHaveAttribute('data-hold-ms', '1100'); // about a second in play (automated runs hold it longer)
    expect(await pile.getAttribute('data-count'), 'the pile waits for the card to land').toBe('0');
    // pin it (a tap) so the slow check machines can measure it, then tap again to let it go
    const card = page.locator('[aria-label="Card reveal"][data-side="opponent"]').first();
    await card.click({ force: true });
    await expect(card).toHaveAttribute('data-pinned', 'true');
    await expect(big).toHaveCount(1);
    let b = null; // measured once its quick pop-in is over
    await expect.poll(async () => { [b] = await visBoxes(big); return b ? b.height : 0; }, { timeout: 3000 }).toBeGreaterThan(closeUp.height * 1.1); // bigger than the close-up (as big as the screen allows)
    expect(Math.abs(b.x + b.width / 2 - W / 2)).toBeLessThanOrEqual(W * 0.03);
    expect(Math.abs(b.y + b.height / 2 - H / 2)).toBeLessThanOrEqual(H * 0.05);
    expect(b.height).toBeLessThanOrEqual(H);
    await card.click({ force: true });
    // laid down: it leaves the middle, slides left onto the pile and the pile shows it face-up
    await expect(page.locator('[aria-label="Card reveal"][data-side="opponent"]')).toHaveCount(0, { timeout: 5000 });
    await expect(pile).toHaveAttribute('data-count', '1');
    await expect(pile).toHaveAttribute('data-top', 'soul-shard');
  });

  test('AC415: the enemy discard pile sits face-up on the left; tapping it fans the cards out at half the hand size, scrollable, each opens its close-up', async ({ page }) => {
    const W = 1920;
    let s = await start(page, { ...quiet({ opponentHand: Array(9).fill('soul-shard'), playerHand: ['goblin-scrapper', 'fireball'] }), firstPlayer: 'opponent' });
    for (const c of s.players.opponent.hand) expect((await act(page, { type: 'playCrystal', uid: c.uid })).ok).toBe(true);
    const pile = page.getByRole('button', { name: 'Enemy discard pile', exact: true });
    await expect(pile).toHaveAttribute('data-count', '9');
    await expect(pile).toHaveAttribute('data-top', 'soul-shard');
    const pb = await pile.boundingBox(), deck = await page.getByLabel('Your deck', { exact: true }).boundingBox();
    expect(pb.x + pb.width / 2).toBeLessThan(W * 0.12); // left side (your deck is on the right)
    expect(deck.x + deck.width / 2).toBeGreaterThan(W * 0.5);
    expect(await pile.locator('.hand-card').count(), 'face-up top card').toBe(1);
    await pile.click();
    const dlg = page.getByRole('dialog', { name: 'Enemy discard pile', exact: true });
    await expect(dlg).toBeVisible();
    const list = dlg.getByRole('list', { name: 'Enemy discard pile cards' });
    const cards = list.getByRole('listitem');
    await expect(cards).toHaveCount(9);
    const handCard = await page.getByLabel('Your hand', { exact: true }).locator('[data-card-id]').first().evaluate((e) => e.offsetWidth);
    const cw = await cards.first().evaluate((e) => e.offsetWidth);
    expect(cw / handCard).toBeGreaterThanOrEqual(0.35); expect(cw / handCard).toBeLessThanOrEqual(0.65);
    const sc = await list.evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth, ox: getComputedStyle(e).overflowX }));
    expect(['auto', 'scroll']).toContain(sc.ox);
    // drag sideways scrolls it, like the hand
    const lb = await list.boundingBox();
    if (sc.sw > sc.cw + 2) {
      await page.mouse.move(lb.x + lb.width * 0.7, lb.y + lb.height / 2);
      await page.mouse.down();
      await page.mouse.move(lb.x + lb.width * 0.3, lb.y + lb.height / 2, { steps: 8 });
      await page.mouse.up();
      expect(await list.evaluate((e) => e.scrollLeft)).toBeGreaterThan(20);
    }
    await cards.first().click();
    const view = page.getByRole('dialog', { name: 'Soul Shard', exact: true });
    await expect(view).toBeVisible();
    await expect(view.locator('[data-card-id="soul-shard"]')).toHaveCount(1);
    await view.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(view).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
  });

  test('AC416: an Ironclad Bulwark shows a bubble around the unit in its faction colour; it pops when it blocks a hit', async ({ page }) => {
    let s = await start(page, q12({ playerHand: ['shield-bubble'], playerCrystals: 9,
      board: [P('dwarf-pickman', 5, 9), O('goblin-grunt', 4, 9), O('goblin-pebbler', 4, 8)] }));
    const fig = async (uid) => (await page.evaluate(async () => await window.oreheart.getRenderStats())).figures.find((f) => f.uid === uid);
    const uid = stk(s, 5, 9).uid;
    expect((await fig(uid)).bubble).toBe(false);
    expect((await cast(page, s, 'shield-bubble', { row: 5, col: 9 })).ok).toBe(true);
    await expect.poll(async () => (await fig(uid)).bubble).toBe(true);
    expect((await fig(uid)).bubbleColor).toBe('#2f5fd8'); // Dwarves: blue (goblins green #3ee06a, gnomes purple #9b4dff)
    await passTurn(page); await done(page); // the opponent's Action phase
    s = await getState(page);
    expect((await act(page, { type: 'attack', creatureUid: at(s, 4, 9).uid, target: { row: 5, col: 9 } })).ok).toBe(true);
    await expect.poll(async () => (await fig(uid)).bubble).toBe(false);
    expect((await fig(uid)).bubblePops).toBe(1);
  });
});

// ---------- Ken (Oct 30): no T-poses, and legs move while walking ----------
test('AC418: every rigged unit leaves its bind pose once loaded, and plays a walk or run clip while it moves', async ({ page }) => {
  test.setTimeout(90000);
  const ids = ['gnome-cogger', 'dwarf-pickman', 'gnome-prospector', 'goblin-scrounger', 'the-great-steam-golem', 'queen-brunhilda-stonebeard', 'overclocked-conduit', 'goblin-grunt'];
  const s = await start(page, quiet({ board: ids.map((cardId, i) => ({ cardId, owner: 'player', row: i < 4 ? 6 : 5, col: 2 + 3 * (i % 4) + (i < 4 ? 0 : 1) })) }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  await expect.poll(async () => ((await renderStats(page)).figures || []).filter((f) => /\.glb$/.test(f.source || '')).length, { timeout: 40000 }).toBe(ids.length);
  await page.waitForTimeout(800);
  for (const f of (await renderStats(page)).figures) {
    expect(f.poseDelta, `${f.cardId} is not in its bind pose (T-pose)`).toBeGreaterThan(0.05);
    expect(f.diag && f.diag.tracks, `${f.cardId} idle clip has tracks`).toBeGreaterThan(0);
  }
  await toAction(page);
  const walker = at(s, 6, 2);
  const mv = (await legal(page)).find((a) => a.type === 'move' && a.creatureUid === walker.uid);
  expect(mv).toBeTruthy();
  expect((await act(page, mv)).ok).toBe(true);
  await expect.poll(async () => { const f = ((await renderStats(page)).figures || []).find((x) => x.uid === walker.uid); return f && f.moving ? f.currentAnimation : 'done'; }, { timeout: 8000 }).toMatch(/walk|run|done/);
  const log = (await renderStats(page)).creatureAnimLog || [];
  expect(log.some((e) => e.uid === walker.uid && e.anim === 'walk'), 'the walker played its walk clip').toBe(true);
});

// Ken (Oct 30): "a gnome riding the plow ... vibrating with a little smoke effect ... wheels and tracks moving ... driving it, and ramming people"
test('AC419: the Gnome Plow is a gnome seated on his plow: the plow is its mount, its wheels spin while it moves, and he plays the ride clip at rest', async ({ page }) => {
  test.setTimeout(60000);
  const s = await start(page, quiet({ board: [{ cardId: 'phase-stalker', owner: 'player', row: 6, col: 3 }, { cardId: 'dwarf-pickman', owner: 'opponent', row: 2, col: 11 }] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  const plow = at(s, 6, 3);
  const fig = async () => ((await renderStats(page)).figures || []).find((f) => f.uid === plow.uid) || {};
  await expect.poll(async () => (await fig()).model === 'finished' && /\.glb$/.test((await fig()).source || ''), { timeout: 30000 }).toBe(true);
  expect(await page.evaluate(() => (window.__sharedPack.units || {})['phase-stalker'])).toMatch(/^retargeted \d+/);
  await expect.poll(async () => (await fig()).currentClip, { timeout: 8000 }).toBe('biped-ride-01');
  const f0 = await fig();
  expect(f0.items.map((i) => i.name + '@' + i.bone)).toContain('plow@ground');
  expect(f0.poseDelta, 'not in its bind pose').toBeGreaterThan(0.05);
  expect(Math.abs(f0.height - 0.852), 'owner check change (Ken via Ledger, Oct 31): height is the real-world table value (3.25 ft = 0.852 squares), not the old Studio 0.48').toBeLessThanOrEqual(0.08);
  const rig = () => page.evaluate(() => { const r = window.__plowRigs || []; return r.length ? JSON.parse(JSON.stringify(r[r.length - 1])) : null; });
  const r0 = await rig();
  expect(r0, 'plow rig').toBeTruthy();
  expect(r0).toMatchObject({ wheels: 8, tracks: 2, exhaust: true });
  await expect.poll(async () => (await rig()).puffs, { timeout: 8000 }).toBeGreaterThan(0); // exhaust smoke at rest
  await toAction(page);
  const mv = (await legal(page)).filter((a) => a.type === 'move' && a.creatureUid === plow.uid).sort((a, b) => Math.max(Math.abs(b.row - 6), Math.abs(b.col - 3)) - Math.max(Math.abs(a.row - 6), Math.abs(a.col - 3)))[0];
  expect(mv).toBeTruthy();
  const turns0 = (await rig()).wheelTurns;
  expect((await act(page, mv)).ok).toBe(true);
  await expect.poll(async () => Math.abs((await rig()).wheelTurns - turns0), { timeout: 8000 }).toBeGreaterThan(0.3); // the wheels roll along the ground
  await expect.poll(async () => { const f = await fig(); return f.row === mv.row && f.col === mv.col && !f.moving; }, { timeout: 8000 }).toBe(true);
  const log = ((await renderStats(page)).creatureAnimLog || []).filter((e) => e.uid === plow.uid && e.anim === 'walk');
  expect(log.length, 'drove (walk role)').toBeGreaterThan(0);
  expect(log.every((e) => e.clip === 'biped-ride-01'), 'he stays seated while the plow drives').toBe(true);
  await expect.poll(async () => (await fig()).currentClip, { timeout: 8000 }).toBe('biped-ride-01');
});

// Oct 31 (Ken: "I can't move any of the characters"): units are 3x tall, so their bodies stand over the squares behind them.
// A tap or click on the unit's body (not its own square) must select it, and a tap on a lit square then moves it.
for (const dev of [{ name: 'phone touch', use: { viewport: { width: 812, height: 375 }, hasTouch: true, isMobile: true } }, { name: 'desktop mouse', use: { viewport: { width: 1568, height: 782 } } }]) {
  test.describe(`AC420 ${dev.name}`, () => {
    test.use(dev.use);
    test(`AC420: tapping a 3x unit's body selects it and a tap on a lit square moves it (${dev.name})`, async ({ page }) => {
      await start(page, quiet({ playerHand: [], board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 9 }] }));
      await done(page);
      const fig = async () => (await renderStats(page)).figures.find((f) => f.row === 6 && f.col === 9);
      await expect.poll(async () => ((await fig())?.screenBox?.height || 0), { timeout: 15000 }).toBeGreaterThan(20);
      const sb = (await fig()).screenBox;
      const body = { x: sb.x + sb.width / 2, y: sb.y + sb.height * 0.3 };
      const own = await sq2s(page, 6, 9);
      expect(body.y, 'the body point is above the unit\'s own square').toBeLessThan(own.y - 15);
      const tap = (p) => (dev.use.hasTouch ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));
      await tap(body);
      await expect.poll(async () => (await page.evaluate(async () => (await window.oreheart.getArena()).highlights)).some((h) => h.row === 6 && h.col === 10), { timeout: 5000 }).toBe(true);
      const to = await sq2s(page, 6, 10);
      await tap(to);
      await expect.poll(async () => { const c = at(await getState(page), 6, 10); return c && c.cardId; }, { timeout: 8000 }).toBe('goblin-scrapper');
    });
  });
}

// Oct 31 (Ken via Forge): "a unit standing behind a mine must be tappable, and the pickaxe must stay easy to tap". The pickaxe picture
// itself mines; its extra tap padding goes to a unit whose body is under the pointer.
test('AC421: the pickaxe picture mines; a tap on its padding over a unit behind the mine selects that unit', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await start(page, quiet({ playerDeck: SHARDS, opponentDeck: SHARDS, board: [
    { cardId: 'goblin-scrapper', owner: 'player', row: M2.row - 1, col: M2.col },
    { cardId: 'goblin-scrounger', owner: 'player', row: M2.row + 1, col: M2.col },
  ] }));
  await done(page);
  let s = await getState(page);
  const behind = at(s, M2.row - 1, M2.col).uid;
  const pk = page.locator(`.site-mark[data-row="${M2.row}"][data-col="${M2.col}"] .pk-img`);
  await expect(pk).toBeVisible();
  await expect.poll(async () => (((await renderStats(page)).figures.find((f) => f.row === M2.row - 1 && f.col === M2.col) || {}).screenBox || {}).height || 0, { timeout: 15000 }).toBeGreaterThan(20);
  const ib = await pk.boundingBox();
  // just outside the picture, still inside the pickaxe's tap padding, on the unit's body
  const pad = { x: ib.x + ib.width + 6, y: ib.y + ib.height * 0.3 };
  const hitPk = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.pickaxe'), [pad.x, pad.y]);
  expect(hitPk, 'the point is on the pickaxe padding').toBe(true);
  await page.mouse.click(pad.x, pad.y);
  await expect.poll(async () => await page.evaluate(async () => await window.oreheart.getSelected())).toBe(behind);
  s = await getState(page);
  expect(at(s, M2.row + 1, M2.col).hasMined, 'the padding tap over the unit did not mine').toBeFalsy();
  await page.keyboard.press('Escape');
  await page.mouse.click(ib.x + ib.width / 2, ib.y + ib.height / 2);
  await expect.poll(async () => at(await getState(page), M2.row + 1, M2.col).hasMined).toBe(true);
});

// ---------------------------------------------------------------- Oct 31 (Anvil): the computer plays by the rules
// Ken: "The opposing team is cheating ... putting units they don't even have crystals for out ... right at my side ... multiple ...
// They need to have a deck. And play by the rules." Cause: the dwarves' basic Miner card is the Riot Shield Bearer, a Fighter since
// Round 12c, so the "one free basic Miner when broke and no Miner on the battlefield" rule never saw a Miner on the board and a broke
// Dwarf side got a free Bearer again and again, each Tunnelling next to any mine. The game now counts the basic Miner card itself,
// and every computer action goes through a referee (game.ts aiAudit) that refuses anything the player could not do.
test('AC422: a broke Dwarf side gets exactly ONE free Riot Shield Bearer; the second costs 2 and is refused without crystals', async ({ page }) => {
  let s = await start(page, { ai: false, setup: { playerHand: ['dwarf-miner', 'dwarf-miner', 'dwarf-miner'], playerCrystals: 0 }, playerCommander: 'borgo', opponentCommander: 'grubnak' });
  const uids = s.players.player.hand.filter((c) => c.cardId === 'dwarf-miner').map((c) => c.uid);
  expect(uids.length).toBe(3);
  const first = (await legal(page)).filter((a) => a.type === 'summon');
  expect(first.length, 'the first Bearer is free').toBeGreaterThan(0);
  expect((await act(page, first[0])).ok).toBe(true);
  s = await getState(page);
  if (s.pendingResponse) await act(page, { type: 'pass' });
  s = await getState(page);
  expect(s.board.creatures.filter((c) => c.cardId === 'dwarf-miner').length).toBe(1);
  expect(s.players.player.crystals + s.players.player.bank).toEqual(0);
  expect((await legal(page)).filter((a) => a.type === 'summon').length, 'no second free Bearer').toBe(0);
  for (const row of [7, 1, 4]) for (const col of [1, 3, 5, 7]) {
    const r = await act(page, { type: 'summon', uid: uids[1], row, col });
    expect(r.ok, `a second free Bearer at ${row},${col}`).toBe(false);
  }
  // with 2 crystals the second one is paid for, like any card
  s = await newMatch(page, { ai: false, setup: { playerHand: ['dwarf-miner', 'dwarf-miner'], playerCrystals: 2, board: [{ cardId: 'dwarf-miner', owner: 'player', row: 7, col: 5 }] }, playerCommander: 'borgo', opponentCommander: 'grubnak' });
  expect((await act(page, { type: 'summon', uid: s.players.player.hand[0].uid, row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  if (s.pendingResponse) await act(page, { type: 'pass' });
  expect((await getState(page)).players.player.crystals).toEqual(0);
});

test('AC423: over a whole computer-vs-computer match on every difficulty, every computer action passes the same rule check as the player, every summon is paid, in its deploy zone and from its own deck, and the thinking never touches the match', async ({ page }) => {
  test.setTimeout(240000);
  await openTest(page, 5);
  for (const [i, difficulty] of ['easy', 'normal', 'hard'].entries()) {
    // test mode + Card Comp vs Card Comp, not paused: the whole match plays out at once and the referee counts every computer action
    const s = await page.evaluate(async ([d, seed]) => await window.oreheart.newMatch({ mode: 'compvscomp', difficulty: d, seed, skipMulligan: true,
      playerCommander: ['grubnak', 'borgo', 'sproingle'][seed % 3], opponentCommander: ['borgo', 'sproingle', 'grubnak'][seed % 3] }), [difficulty, 31 + i]);
    const audit = await page.evaluate(async () => await window.oreheart.getAiAudit());
    expect(s.difficulty).toBe(difficulty);
    expect(s.phase === 'over' || s.turn > 20, `${difficulty}: the match played out (turn ${s.turn})`).toBe(true);
    expect(audit.checked, `${difficulty}: computer actions were refereed`).toBeGreaterThan(50);
    expect(audit.summons, `${difficulty}: the computer summoned`).toBeGreaterThan(5);
    expect(audit.refused, `${difficulty}: illegal computer actions refused: ${audit.last}`).toBe(0);
    expect(audit.unpaid, `${difficulty}: unpaid summons: ${audit.last}`).toBe(0);
    expect(audit.offZone, `${difficulty}: summons outside the deploy zone: ${audit.last}`).toBe(0);
    expect(audit.foreign, `${difficulty}: cards not from its own deck: ${audit.last}`).toBe(0);
    expect(audit.touched, `${difficulty}: the computer's thinking changed the real match: ${audit.last}`).toBe(0);
  }
  // the referee really refuses: a forced illegal computer action (a Grunt on the PLAYER's back row with 0 crystals) is counted and never applied
  const forced = await page.evaluate(async () => {
    window.__aiForceNext = (st) => ({ type: 'summon', uid: st.players.opponent.hand[0].uid, row: 7, col: 5 });
    await window.oreheart.newMatch({ mode: 'standard', ai: true, difficulty: 'hard', seed: 9, skipMulligan: true, setup: { firstPlayer: 'opponent', opponentHand: ['goblin-grunt'], opponentCrystals: 0 } });
    const st = await window.oreheart.getState();
    return { audit: await window.oreheart.getAiAudit(), grunts: st.board.creatures.filter((c) => c.cardId === 'goblin-grunt').length, turn: st.turn };
  });
  expect(forced.audit.refused, 'the forced illegal summon was refused').toBeGreaterThan(0);
  expect(forced.grunts, 'and never applied').toBe(0);
});

// ---------------------------------------------------------------- Oct 31 (Anvil): the computer thinks off the main thread
// Ken: "The game seems kind of stuttery and laggy." Hard's search (up to 1.2 s a turn in 50-300 ms chunks) ran on the main thread and
// froze the animation on every chunk. In a live match the thinking now runs in a Web Worker (game.ts aiWorker / ai.worker.ts) and the
// answer is applied when it comes back; test mode keeps the synchronous path so replays stay the same. ?aiworker=1 forces the worker.
test('AC424: the computer opponent thinks in a Web Worker in a live match: the worker answers, its moves are applied and pass the referee', async ({ page }) => {
  test.setTimeout(90000);
  await page.goto('/?test=1&seed=5&aiworker=1');
  await page.waitForFunction(() => !!window.oreheart);
  await page.evaluate(async () => await window.oreheart.newMatch({ mode: 'standard', ai: true, difficulty: 'hard', seed: 5, skipMulligan: true, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: { firstPlayer: 'opponent' } }));
  // the opponent's whole first turn is played by worker answers: wait until it is the player's turn
  let info = null, trail = [];
  for (let i = 0; i < 200; i++) {
    const s0 = await getState(page); info = await page.evaluate(async () => await window.oreheart.getAiInfo());
    trail.push(`${s0.turn}/${s0.phase}/${s0.priority}/r${info.replies}`);
    if (s0.activePlayer === 'player' && s0.priority === 'player' && s0.turn >= 2) break;
    await page.waitForTimeout(300);
  }
  const why = () => `trail: ${trail.filter((x, i) => i === 0 || x !== trail[i - 1]).join(' > ')}`;
  const audit = await page.evaluate(async () => await window.oreheart.getAiAudit());
  const s = await getState(page);
  expect(info.worker, 'the worker was used; ' + why()).toBe(true);
  expect(info.replies, 'the worker answered; ' + why()).toBeGreaterThan(1);
  expect(audit.checked).toBeGreaterThan(1);
  expect(audit.refused, `refused: ${audit.last}`).toBe(0);
  expect(s.turn).toBe(2);
  expect(s.board.creatures.some((c) => c.owner === 'opponent'), 'the computer deployed through the worker').toBe(true);
  // without the flag a test-mode page keeps the synchronous path (replay checks depend on it)
  await page.goto('/?test=1&seed=5');
  await page.waitForFunction(() => !!window.oreheart);
  await page.evaluate(async () => await window.oreheart.newMatch({ mode: 'standard', ai: true, difficulty: 'hard', seed: 5, skipMulligan: true, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: { firstPlayer: 'opponent' } }));
  expect((await page.evaluate(async () => await window.oreheart.getAiInfo())).worker).toBe(false);
  expect((await getState(page)).activePlayer).toBe('player');
});

// ---------- Ken (Oct 31 playtest): hand double-click, discard pile, drag icons, no ability overlays, smooth hand (AC440-AC449) ----------
// Ken (Oct 31): "when I double click a card in my hand, it doesn't automatically play the card". A person's double-click is
// often ~300 ms apart (the old 250 ms window missed it); two clicks / taps 300 ms apart must play the card.
const hk31 = (extra) => ({ ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: { opponentHand: [], ...extra } });
async function hk31Play(page, W, H, touch) {
  const s = await start(page, hk31({ playerHand: ['goblin-scrounger', 'goblin-scrapper', 'fireball'], playerCrystals: 3 }));
  await page.waitForTimeout(600);
  const card = page.getByLabel('Your hand', { exact: true }).locator('button:has([data-card-id="goblin-scrounger"])').first();
  const b = await card.boundingBox();
  const p = { x: b.x + b.width * 0.3, y: Math.min(b.y + 20, H - 5) };
  if (!touch) { await page.mouse.move(p.x, p.y); await page.waitForTimeout(500); }
  // the page's clock is held still and moved exactly 300 ms between the two presses, so a slow machine can't stretch or squeeze the gap
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  if (touch) { await page.touchscreen.tap(p.x, p.y); await page.clock.runFor(300); await page.touchscreen.tap(p.x, p.y); }
  else { await page.mouse.click(p.x, p.y); await page.clock.runFor(300); await page.mouse.click(p.x, p.y); }
  await page.clock.runFor(600);
  await page.clock.resume();
  await page.waitForTimeout(300);
  expect(await page.getByRole('dialog').count(), 'no card view opened: the double-click plays the card').toBe(0);
  let hl = [];
  await expect.poll(async () => { hl = ((await arenaInfo(page)).highlights || []).filter((x) => x.kind === 'summon' || x.kind === 'move'); return hl.length; }).toBeGreaterThan(0);
  // tap a lit square that sits clear of the hand
  let target = null;
  for (const q of hl) { const c = await sqCenter(page, q.row, q.col); if (c.y < H * 0.7 && c.x > W * 0.15 && c.x < W * 0.85 && !at(s, q.row, q.col)) { target = { ...q, ...c }; break; } }
  expect(target, 'a lit square on screen').toBeTruthy();
  if (touch) await page.touchscreen.tap(target.x, target.y); else await page.mouse.click(target.x, target.y);
  await expect.poll(async () => ((at(await getState(page), target.row, target.col)) || {}).cardId).toBe('goblin-scrounger');
}
test.describe('Oct 31 Ken hand double-click 1920x1080', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  test('AC440: a mouse double-click (clicks 300 ms apart) on a hand creature lights its squares; a click on one deploys it (1920x1080)', async ({ page }) => {
    await hk31Play(page, 1920, 1080, false);
  });
});
test.describe('Oct 31 Ken hand double-tap 844x390', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  test('AC441: a double tap (taps 300 ms apart) on a hand creature lights its squares; a tap on one deploys it (844x390 touch)', async ({ page }) => {
    await hk31Play(page, 844, 390, true);
  });
});

// Oct 31 (Anvil). Ken: "it goes through like spurts of lag. Especially like when you mine or make a lot of movements." Cause: fitHand (window size)
// and renderHand (cards) shared one cache key, so EVERY action threw the whole hand away and rebuilt it (60 ms of the 80 ms a mine action cost).
test('AC425: a mine action or a move no longer rebuilds the hand: the same card elements stay, and the action returns quickly', async ({ page }) => {
  await start(page, { ai: false, skipMulligan: true, mines: [{ row: 4, col: 4 }, { row: 4, col: 7 }, { row: 4, col: 10 }], setup: { firstPlayer: 'player', playerCrystals: 6, playerHand: ['goblin-grunt', 'goblin-slinger', 'venom-shiv', 'goblin-scrounger', 'shiv-rat'],
    board: [{ cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 4 }, { cardId: 'goblin-grunt', owner: 'player', row: 6, col: 6 }, { cardId: 'goblin-slinger', owner: 'player', row: 6, col: 8 }, { cardId: 'dwarf-stoneback', owner: 'opponent', row: 2, col: 5 }] } });
  await act(page, { type: 'done' });
  await page.waitForTimeout(600);
  const mark = async () => page.evaluate(() => { const els = [...document.querySelectorAll('.hand-card:not(.popclone)')]; els.forEach((e, i) => { e.dataset.ac425 = String(i + 1); }); return els.length; });
  const kept = async () => page.evaluate(() => [...document.querySelectorAll('.hand-card:not(.popclone)')].filter((e) => e.dataset.ac425).length);
  const s = await getState(page);
  const miner = s.board.creatures.find((c) => c.cardId === 'goblin-scrounger' && c.owner === 'player');
  const mine = (await legal(page)).find((a) => a.type === 'mine' && a.creatureUid === miner.uid);
  expect(mine).toBeTruthy();
  const n = await mark();
  expect(n).toBe(5);
  const t = await page.evaluate(async (a) => { const t0 = performance.now(); const r = await window.oreheart.act(a); return { ok: r.ok, ms: performance.now() - t0 }; }, mine);
  expect(t.ok).toBe(true);
  expect(await kept(), 'the hand cards were rebuilt by a mine action').toBe(5);
  expect(t.ms, 'a mine action took ' + Math.round(t.ms) + ' ms').toBeLessThan(45);
  const grunt = s.board.creatures.find((c) => c.cardId === 'goblin-grunt' && c.owner === 'player');
  const mv = (await legal(page)).find((a) => a.type === 'move' && a.creatureUid === grunt.uid && a.row === 5);
  expect(mv).toBeTruthy();
  expect((await act(page, mv)).ok).toBe(true);
  expect(await kept(), 'the hand cards were rebuilt by a move').toBe(5);
  // a real hand change still rebuilds it: summoning a card next turn removes that card
  await page.waitForTimeout(300);
});

// ---------- Oct 31 playtest (Ken): Choose Your Commander (AC460–AC464) ----------
// Ken: "the background box that the commander cards sit in, I don't want that. Just take that out. And when you click the goblin king, I don't want
// his 3D image to pop up anymore. Just leave it his card, selected, and put arrows on either side of the card so you can page through the commanders.
// Instead of [the] change commander [button], just have the arrows ... Forward and back. I would also like the game mode, standard ... comp versus comp
// ... on the right-hand side. And the fight doesn't fit inside the button that it's in. It looks awkward."
// Forge (Ken approved): the deck picker sits on the right-hand side under the game modes, with room for four named starter decks.
const SEL_SIZES = [[1920, 1080], [844, 390]];
const cardPanelProblems = (page) => page.evaluate(() => {
  const zone = document.querySelector('[data-menu-piece="cCards"]');
  if (!zone) return ['no cCards box'];
  const bad = [];
  if (document.querySelector('[data-screen="select"] .cmd-wall')) bad.push('cmd-wall element');
  for (const e of [zone, ...zone.querySelectorAll('*')]) {
    if (e.closest('.cmd-card,.cmd-arrow')) continue;
    const c = getComputedStyle(e);
    const alpha = (c.backgroundColor.match(/rgba?\(([^)]+)\)/) || [0, '0,0,0,0'])[1].split(',').map(Number)[3];
    if (!(alpha === 0 || c.backgroundColor === 'transparent')) bad.push(`${e.className} background ${c.backgroundColor}`);
    if (c.backgroundImage !== 'none') bad.push(`${e.className} background-image`);
    if (/blur\(/.test(c.backdropFilter || c.webkitBackdropFilter || '')) bad.push(`${e.className} backdrop blur`);
    if (c.boxShadow !== 'none') bad.push(`${e.className} box-shadow`);
  }
  return bad;
});

test('AC460: Choose Your Commander has no panel behind the Commander cards (row and chosen, 1920x1080 and 844x390)', async ({ page }) => {
  for (const [W, H] of SEL_SIZES) {
    await page.setViewportSize({ width: W, height: H });
    await toSelect(page);
    expect(await cardPanelProblems(page), `${W}x${H} row`).toEqual([]);
    await page.getByRole('button', { name: COMMANDERS[0], exact: true }).click();
    expect(await cardPanelProblems(page), `${W}x${H} chosen`).toEqual([]);
  }
});

test('AC461: clicking a Commander card opens no 3D viewer or pop-up; his card stays selected', async ({ page }) => {
  for (const [W, H] of SEL_SIZES) {
    await page.setViewportSize({ width: W, height: H });
    for (const n of COMMANDERS) {
      await toSelect(page);
      const card = page.getByRole('button', { name: n, exact: true });
      await card.click();
      await page.waitForTimeout(800);
      await expect(card, `${W}x${H} ${n}`).toBeVisible();
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('[data-screen="select"] canvas, [data-screen="select"] .viewer3d, .cmd-stage')).toHaveCount(0);
      expect((await selectState(page)).model).toBeNull();
    }
  }
});

test('AC462: the Previous / Next commander arrows sit either side of the card and page through the Commanders, wrapping, also with the keyboard', async ({ page }) => {
  const IDS = ['grubnak', 'sproingle', 'borgo'];
  for (const [W, H] of SEL_SIZES) {
    await page.setViewportSize({ width: W, height: H });
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.removeItem('oreheart.picks'));
    await toSelect(page);
    await expect(page.getByRole('button', { name: 'Change Commander', exact: true })).toHaveCount(0);
    const prev = page.getByRole('button', { name: 'Previous commander', exact: true });
    const next = page.getByRole('button', { name: 'Next commander', exact: true });
    for (const a of [prev, next]) { await expect(a).toBeVisible(); expect(await a.evaluate((e) => e.tagName)).toBe('BUTTON'); }
    await page.getByRole('button', { name: COMMANDERS[0], exact: true }).click();
    const shows = async (i, how) => {
      expect((await selectState(page)).commanderId, how).toBe(IDS[i]);
      const card = page.getByRole('button', { name: COMMANDERS[i], exact: true });
      await expect(card, how).toBeVisible();
      await expect(card, how).toHaveAttribute('aria-pressed', 'true');
      for (let j = 0; j < 3; j++) if (j !== i) await expect(page.getByRole('button', { name: COMMANDERS[j], exact: true }), how).toBeHidden();
      const c = await box(card), p = await box(prev), n = await box(next);
      expect(p.x + p.width, `${W}x${H} ${how} previous arrow left of the card`).toBeLessThanOrEqual(c.x + 1);
      expect(n.x, `${W}x${H} ${how} next arrow right of the card`).toBeGreaterThanOrEqual(c.x + c.width - 1);
      for (const a of [p, n]) expect(a.y < c.y + c.height && a.y + a.height > c.y, `${W}x${H} ${how} arrow beside the card`).toBe(true);
      for (const a of [p, n]) expect(a.width >= 40 && a.height >= 40, `${W}x${H} arrow big enough to tap`).toBe(true);
    };
    await shows(0, 'start');
    await next.click(); await shows(1, 'next 1');
    await next.click(); await shows(2, 'next 2');
    await next.click(); await shows(0, 'next wraps');
    await prev.click(); await shows(2, 'previous wraps');
    await expect(deckRow(page).getByRole('button', { name: 'Dwarf Warband, 60 cards, ready', exact: true })).toBeVisible();
    await page.keyboard.press('ArrowRight'); await shows(0, 'ArrowRight wraps');
    await page.keyboard.press('ArrowLeft'); await shows(2, 'ArrowLeft wraps');
    await page.keyboard.press('ArrowLeft'); await shows(1, 'ArrowLeft');
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1), `${W}x${H} no page scroll`).toBe(true);
  }
});

test('AC463: the game modes sit in the right third of the screen, with the deck picker under them (room for four starter decks), at 1920x1080 and 844x390', async ({ page }) => {
  for (const [W, H] of SEL_SIZES) {
    await page.setViewportSize({ width: W, height: H });
    await toSelect(page);
    const g = await box(page.getByRole('group', { name: 'Game mode', exact: true }));
    expect(g.x, `${W}x${H} mode group in the right third`).toBeGreaterThanOrEqual(W * 2 / 3 - 1);
    expect(g.x + g.width, `${W}x${H} mode group on screen`).toBeLessThanOrEqual(W + 1);
    for (const m of MODES) {
      const b = await box(page.getByRole('button', { name: m, exact: true }));
      expect(b.x >= W * 2 / 3 - 1 && b.x + b.width <= W + 1 && b.y >= -1 && b.y + b.height <= H + 1, `${W}x${H} ${m} in the right third, on screen`).toBe(true);
    }
    const d = await box(deckRow(page));
    expect(d.x, `${W}x${H} deck picker in the right third`).toBeGreaterThanOrEqual(W * 2 / 3 - 1);
    expect(d.y, `${W}x${H} deck picker under the modes`).toBeGreaterThanOrEqual(g.y + g.height - 1);
    expect(d.y + d.height, `${W}x${H} deck picker on screen`).toBeLessThanOrEqual(H + 1);
    const fit = await deckRow(page).evaluate((list) => {
      const rows = [...list.querySelectorAll('.dslot')];
      const r0 = rows[0].getBoundingClientRect(), r1 = rows[1].getBoundingClientRect();
      return Math.floor((list.clientHeight + (r1.top - r0.bottom)) / (r1.top - r0.top));
    });
    expect(fit, `${W}x${H} four deck rows fit`).toBeGreaterThanOrEqual(4);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), `${W}x${H} no page scroll`).toBe(true);
  }
});

test('AC464: Fight! and the other silver buttons on Choose Your Commander hold their text inside the button with at least 6 px to spare', async ({ page }) => {
  const textInside = (loc) => loc.evaluate((e) => {
    const r = document.createRange(); r.selectNodeContents(e);
    const t = r.getBoundingClientRect(), b = e.getBoundingClientRect();
    return { l: t.left - b.left, r: b.right - t.right, t: t.top - b.top, b: b.bottom - t.bottom, tw: t.width, th: t.height, sw: e.scrollWidth, cw: e.clientWidth };
  });
  for (const [W, H] of SEL_SIZES) {
    await page.setViewportSize({ width: W, height: H });
    await toSelect(page);
    await page.mouse.move(1, 1);
    // the phone keeps the mode / difficulty choices as plain text (no frames); Fight! is framed at both sizes
    const names = W > 1000 ? ['Fight!', ...MODES, 'Easy', 'Normal', 'Hard'] : ['Fight!'];
    for (const n of names) {
      const btnLoc = page.getByRole('button', { name: n, exact: true });
      const p = await textInside(btnLoc);
      expect(p.tw, `${W}x${H} ${n} has text`).toBeGreaterThan(0);
      for (const k of ['l', 'r', 't', 'b']) expect(p[k], `${W}x${H} ${n} text padding ${k}`).toBeGreaterThanOrEqual(6);
      expect(p.sw, `${W}x${H} ${n} no overflow`).toBeLessThanOrEqual(p.cw + 1);
      const b = await box(btnLoc);
      expect(b.x >= -1 && b.y >= -1 && b.x + b.width <= W + 1 && b.y + b.height <= H + 1, `${W}x${H} ${n} on screen`).toBe(true);
    }
    expect(await unframed(page, ['Fight!']), `${W}x${H} Fight! keeps the silver art`).toEqual([]);
  }
});
// Ken (Oct 31): "when you go to shuffle through them, there's like a card in the background ... two cards shifted offset. And when you
// slide through the cards, it doesn't feel smooth ... It looks jerky, and blurry. Play with the speed some, the spacing is fine".
// The second card was the raised card's helper copy (.popclone) sliding in behind it from the old spot. With real motion on (test
// mode's no-animation switch removed), every frame while the pointer slides across the hand must show ONE card per hand card: the
// helper copy sits exactly on its card and only paints the strip the card leaves out; every hand motion is a 120-220 ms ease.
for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`Oct 31 Ken smooth hand ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });
    test(`AC442: sliding across the hand shows one card per hand card in every frame (no offset second card), eased 120-220 ms (${W}x${H})`, async ({ page }) => {
      await start(page, hk31({ playerHand: ['goblin-scrounger', 'goblin-scrapper', 'fireball', 'goblin-grunt', 'shiv-rat', 'soul-shard', 'goblin-pebbler'], playerCrystals: 3 }));
      await page.evaluate(() => { document.body.classList.remove('test'); window.__app.test = false; });
      await page.waitForTimeout(1200);
      const cards = page.getByLabel('Your hand', { exact: true }).locator('.hand-card:not(.popclone)');
      const n = await cards.count();
      expect(n).toBe(7);
      const boxes = []; for (let i = 0; i < n; i++) boxes.push(await cards.nth(i).boundingBox());
      await page.evaluate(() => {
        window.__ac442 = { frames: 0, bad: [], durs: new Set() }; const t0 = performance.now();
        const f = () => {
          const S = window.__ac442, hand = document.querySelector('.hand');
          const real = [...hand.querySelectorAll('.hand-card:not(.popclone)')], clones = [...hand.querySelectorAll('.hand-card.popclone')];
          const pops = real.filter((e) => e.classList.contains('popped'));
          S.frames++;
          if (clones.length > pops.length) S.bad.push(`${Math.round(performance.now() - t0)} ms: ${clones.length} helper copies for ${pops.length} raised cards`);
          for (const c of clones) {
            const p = pops[0], a = c.getBoundingClientRect(), b = p && p.getBoundingClientRect();
            const off = b ? Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width)) : 999;
            if (off > 1.5) S.bad.push(`${Math.round(performance.now() - t0)} ms: helper copy ${Math.round(off)} px off its card`);
            if (getComputedStyle(c).clipPath === 'none') S.bad.push('helper copy paints the whole card');
          }
          for (const e of real) for (const d of getComputedStyle(e).transitionDuration.split(',')) S.durs.add(parseFloat(d) * (/ms/.test(d) ? 1 : 1000));
          if (performance.now() - t0 < 3500) requestAnimationFrame(f);
        };
        requestAnimationFrame(f);
      });
      const y = H - 6;
      await page.mouse.move(boxes[1].x + 8, y, { steps: 3 });
      await page.waitForTimeout(700);
      for (let i = 2; i < 6; i++) { await page.mouse.move(boxes[i].x + 8, y, { steps: 5 }); await page.waitForTimeout(260); }
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => ({ frames: window.__ac442.frames, bad: window.__ac442.bad.slice(0, 6), durs: [...window.__ac442.durs] }));
      expect(r.frames, 'frames sampled').toBeGreaterThan(5);
      expect(r.bad, 'one card per hand card in every frame').toEqual([]);
      const moving = r.durs.filter((d) => d > 0);
      expect(moving.length, 'the hand cards move with a transition').toBeGreaterThan(0);
      for (const d of moving) { expect(d, 'hand motion duration (ms)').toBeGreaterThanOrEqual(120); expect(d).toBeLessThanOrEqual(220); }
      expect((await handHover(page)).popMs).toBeGreaterThanOrEqual(120);
      expect((await handHover(page)).popMs).toBeLessThanOrEqual(220);
    });
  });
}

// Ken (Oct 31): "On the cards with special abilities, like tunnel, you have it over the card, just remove that. Remove all those special
// ability ... overlays. On the cards." No tag or badge is layered over a card face anywhere (hand, close-up, Deck Builder); the card's own
// face (.ohcard, which carries the printed text) stays. Only the play glow may sit with it.
const strayOverlays = (loc) => loc.evaluateAll((cards) => {
  const out = [];
  for (const card of cards) for (const k of card.children) {
    if (k.classList.contains('ohcard') || k.hasAttribute('data-card-glow') || k.classList.contains('drag-id') || k.classList.contains('pop-hit')) continue;
    const cs = getComputedStyle(k), r = k.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || r.width < 1 || r.height < 1) continue;
    out.push(`${card.getAttribute('aria-label') || card.dataset.cardId || '?'}: ${k.className || k.tagName} "${(k.textContent || '').trim().slice(0, 20)}"`);
  }
  return out;
});
for (const [W, H] of [[1920, 1080], [844, 390]]) {
  test.describe(`Oct 31 Ken no ability overlays ${W}x${H}`, () => {
    test.use({ viewport: { width: W, height: H } });
    test(`AC443: no ability tag (Tunnel! or any other) is drawn over cards in the hand, the close-up or the Deck Builder (${W}x${H})`, async ({ page }) => {
      await start(page, hk31({ playerHand: ['goblin-scrounger', 'goblin-smith-miner', 'goblin-scrapper', 'fireball', 'soul-shard'], playerCrystals: 5 }));
      await page.waitForTimeout(600);
      const hand = page.getByLabel('Your hand', { exact: true });
      await expect(hand.locator('.hand-card[data-card-id]')).toHaveCount(5);
      expect(await strayOverlays(hand.locator('.hand-card')), 'hand').toEqual([]);
      await expect(page.locator('.tunnel-tag')).toHaveCount(0);
      await expect(hand.getByRole('button', { name: 'Goblin Miner', exact: true })).not.toContainText('Tunnel!');
      // the close-up of the Tunnel card
      await hand.locator('button:has([data-card-id="goblin-scrounger"])').first().click();
      const view = page.getByRole('dialog').filter({ has: page.locator('[data-card-id="goblin-scrounger"]') });
      await expect(view).toBeVisible();
      expect(await strayOverlays(view.locator('.hand-card')), 'close-up').toEqual([]);
      await expect(view).not.toContainText('Tunnel!');
      await page.keyboard.press('Escape');
      // the Deck Builder's card faces
      await openDecks(page);
      const tile = allCards(page).getByRole('button', { name: 'Goblin Miner', exact: true });
      await expect(tile).toBeVisible();
      expect(await strayOverlays(allCards(page).locator('.hand-card')), 'deck builder').toEqual([]);
      await expect(page.locator('.tunnel-tag')).toHaveCount(0);
      await expect(tile).not.toContainText('Tunnel!');
    });
  });
}

// Ken (Oct 31): "The gnomes when you click and drag the unit, it has the gear icon ... The gear icon is for the dwarves, and the eye icon
// is for the gnomes." The icon that follows a dragged unit is its faction's emblem: dwarves gear, gnomes eye, goblins their goblin king.
// Mouse at 1920x1080; finger (touch pointer events through the browser's touch input) at 844x390.
const K31_UNITS = [['goblin-grunt', 'goblins', 'goblin', 6, 4], ['gnome-cogger', 'gnomes', 'eye', 6, 7], ['dwarf-pickman', 'dwarves', 'gear', 6, 10]];
for (const [W, H, touch] of [[1920, 1080, false], [844, 390, true]]) {
  test.describe(`Oct 31 Ken drag icons ${W}x${H}`, () => {
    test.use(touch ? { viewport: { width: W, height: H }, hasTouch: true, isMobile: true } : { viewport: { width: W, height: H } });
    test(`AC444: dragging a unit shows its own faction emblem: dwarves gear, gnomes eye, goblins goblin (${touch ? 'touch' : 'mouse'} ${W}x${H})`, async ({ page }) => {
      test.setTimeout(90000);
      const EMB31 = [];
      const cdp = touch ? await page.context().newCDPSession(page) : null;
      const touchAt = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
      for (const [cardId, faction, icon, row, col] of K31_UNITS) {
        await start(page, hk31({ board: [{ cardId, owner: 'player', row, col }] })); // one unit per match: nothing left over from the last drag
        await toAction(page);
        await page.waitForTimeout(800);
        // press on the unit's body, just above its square (the stat badge with the ability button sits on the square at phone size)
        const quad = await page.evaluate(([r, c]) => window.oreheart.squareQuad(r, c), [row, col]);
        const c0 = await sqCenter(page, row, col), topY = Math.min(...quad.map((v) => v.y));
        const p = { x: c0.x, y: topY - (c0.y - topY) * 0.6 };
        const q = { x: p.x + 4, y: p.y - (touch ? 24 : 50) }; // a short drag up the board
        if (touch) { await touchAt('touchStart', p.x, p.y); for (let i = 1; i <= 6; i++) await touchAt('touchMove', p.x + (q.x - p.x) * i / 6, p.y + (q.y - p.y) * i / 6); }
        else { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(q.x, q.y, { steps: 6 }); }
        const g = page.locator('.ghost.tk');
        await expect(g, `${cardId}: a drag icon follows the ${touch ? 'finger' : 'pointer'}`).toHaveCount(1);
        await expect(g).toHaveAttribute('data-faction', faction);
        await expect(g).toHaveAttribute('data-icon', icon);
        const src = await g.locator('img').getAttribute('src');
        expect(src, `${cardId}: the emblem picture`).toMatch(/\/art\/card-format\/images\/.+\.webp$/);
        EMB31.push(src);
        await expect(g).not.toContainText('⚙');
        if (touch) await touchAt('touchEnd', q.x, q.y); else await page.mouse.up();
        await expect(g).toHaveCount(0);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500); // two quick touches would count as a double tap
      }
      // the three emblems are three different pictures
      expect(new Set(EMB31).size).toBe(3);
    });
  });
}

// Ken (Oct 31): the enemy discard pile "moved up just a touch. And when I click it ... pop out from the left-hand side. Like it's just sliding
// out. And it doesn't need a frame around it. Just have the cards pop out." Pile a little higher (was 24 % down); its cards slide out from the
// left edge at the pile's height with no panel, title or dimming; still scrollable; Escape or a tap outside closes it.
for (const [W, H, touch] of [[1920, 1080, false], [844, 390, true]]) {
  test.describe(`Oct 31 Ken discard pile ${W}x${H}`, () => {
    test.use(touch ? { viewport: { width: W, height: H }, hasTouch: true, isMobile: true } : { viewport: { width: W, height: H } });
    test(`AC445: the enemy discard pile sits a touch higher; its cards slide out from the left with no frame; Escape / outside closes it (${W}x${H})`, async ({ page }) => {
      const s = await start(page, { ...hk31({ opponentHand: Array(9).fill('soul-shard') }), firstPlayer: 'opponent' });
      for (const c of s.players.opponent.hand) expect((await act(page, { type: 'playCrystal', uid: c.uid })).ok).toBe(true);
      const pile = page.getByRole('button', { name: 'Enemy discard pile', exact: true });
      await expect(pile).toHaveAttribute('data-count', '9', { timeout: 15000 });
      const pb = await pile.boundingBox();
      expect(pb.y / H, 'a touch higher than before (24 %)').toBeLessThan(0.22);
      expect(pb.y / H).toBeGreaterThan(0.12);
      expect(pb.x + pb.width / 2).toBeLessThan(W * 0.15);
      const open = async () => { if (touch) await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2); else await pile.click(); };
      await open();
      const dlg = page.getByRole('dialog', { name: 'Enemy discard pile', exact: true });
      await expect(dlg).toBeVisible();
      const cards = dlg.getByRole('list', { name: 'Enemy discard pile cards' }).getByRole('listitem');
      await expect(cards).toHaveCount(9);
      const look = await dlg.evaluate((d) => {
        const ov = d.parentElement, cs = getComputedStyle(d), os = getComputedStyle(ov), h2 = d.querySelector('h2'), hb = h2 && h2.getBoundingClientRect();
        const card = d.querySelector('[role=listitem]'), ks = getComputedStyle(card);
        const vis = (pe) => { const c = getComputedStyle(d, pe).content; return c && c !== 'none' && c !== 'normal'; };
        return { ovBg: os.backgroundImage === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(os.backgroundColor), frame: cs.borderImageSource !== 'none' || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none' || cs.backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) || vis('::before') || vis('::after'),
          title: hb ? hb.width > 2 && hb.height > 2 : false, anim: ks.animationName, dur: parseFloat(ks.animationDuration) * 1000 };
      });
      expect(look.ovBg, 'no dimming behind the cards').toBe(true);
      expect(look.frame, 'no frame or panel around the cards').toBe(false);
      expect(look.title, 'no visible title').toBe(false);
      expect(look.anim, 'the cards slide out').toBe('eDiscardSlide');
      expect(look.dur).toBeGreaterThanOrEqual(150); expect(look.dur).toBeLessThanOrEqual(500);
      const first = await cards.first().boundingBox();
      expect(first.x, 'they come out at the left edge').toBeLessThan(W * 0.06);
      expect(Math.abs(first.y - pb.y), 'at the pile\'s height').toBeLessThan(H * 0.08);
      const ox = await dlg.getByRole('list', { name: 'Enemy discard pile cards' }).evaluate((e) => getComputedStyle(e).overflowX);
      expect(['auto', 'scroll']).toContain(ox);
      await page.keyboard.press('Escape');
      await expect(dlg).toBeHidden();
      await open();
      await expect(dlg).toBeVisible();
      if (touch) await page.touchscreen.tap(W * 0.6, H * 0.75); else await page.mouse.click(W * 0.6, H * 0.75);
      await expect(dlg).toBeHidden();
    });
  });
}

// ---------- Oct 31 (Ken via Ledger): real-world unit heights replace the 3x rule ----------
// Ledger's table (studio/unit-heights-feet.json): squares tall, crystal mine = 5 ft = 1.31 squares. A unit's standing body (idle pose, feet to the top of the
// head / helmet, hands and held items not counted; the rider on a mount) stands table x characterSizes.creatures (owner layout) squares tall on the board.
const UNIT_SQUARES = { 'dwarf-miner': 1.048, 'dwarf-smith-miner': 1.048, 'dwarf-stoneback': 1.074, 'deepforge-crossbowman': 1.14, 'dwarf-pickman': 1.153, 'barrelback-courier': 1.153, 'shieldbeard': 1.179, 'axe-thrower': 1.179, 'brewmaster': 1.179, 'oathbound-pikeman': 1.179, 'ironhammer-berserker': 1.205, 'rune-splitter': 1.205, 'crystal-drunk-delver': 1.218, 'grimhold-ravager': 1.218, 'ram-rider': 1.31, 'queen-brunhilda-stonebeard': 1.441, 'gnome-prospector': 0.655, 'gnome-smith-miner': 0.694, 'gnome-widget': 0.734, 'hexwright-apprentice': 0.76, 'gnome-tinker': 0.773, 'clockwork-beetle': 0.786, 'spark-gnome': 0.799, 'gnome-cogger': 0.812, 'gnome-illusionist': 0.838, 'glyphshield-warden': 0.838, 'phase-stalker': 0.852, 'runic-siphoner': 0.878, 'gyrocopter-ace': 0.917, 'gearward-sentinel': 1.179, 'overclocked-conduit': 1.179, 'the-great-steam-golem': 2.882, 'goblin-scrounger': 0.786, 'goblin-smith-miner': 0.825, 'blastrat-sapper': 0.825, 'goblin-pebbler': 0.852, 'goblin-bomber': 0.865, 'goblin-sneak': 0.865, 'goblin-grunt': 0.865, 'goblin-slinger': 0.891, 'shiv-rat': 0.904, 'skullbasher-rusher': 0.904, 'rotgut-grenadier': 0.93, 'goblin-scrapper': 0.969, 'shard-guzzler': 0.969, 'junk-shaman': 1.009, 'wolf-rider': 1.048, 'grubnaks-big-boss-troll': 1.638 };
for (const vp of [{ name: 'desktop', width: 1920, height: 1080 }, { name: 'phone', width: 844, height: 390 }]) {
  test(`AC430: every unit stands at its real-world table height x creatures (within 8 %); the Troll Tyrant and Arcane Colossus are the tallest; none covers the board (${vp.name})`, async ({ page, request }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const lay = await (await request.get('/owner-layouts/final-draft/layout.json')).json();
    const K = +((lay.characterSizes || {}).creatures ?? 1) || 1;
    await openTest(page);
    const ids = Object.keys(UNIT_SQUARES);
    const sq = []; for (const r of [1, 2, 3, 5, 6, 7]) for (let c = 1; c <= 13; c += 2) sq.push([r, c]);
    const best = {}, boardTop = {};
    for (let s = 0; s < ids.length; s += sq.length) {
      const batch = ids.slice(s, s + sq.length);
      await page.evaluate(async (bd) => await window.oreheart.newMatch({ mode: 'standard', ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', factionLock: false, mines: [{ row: 4, col: 2 }, { row: 4, col: 6 }, { row: 4, col: 10 }], setup: { opponentHand: [], board: bd } }), batch.map((cardId, i) => ({ cardId, owner: 'player', row: sq[i][0], col: sq[i][1] })));
      if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
      await expect.poll(async () => ((await renderStats(page)).figures || []).filter((f) => f.standH != null).length, { timeout: 60000 }).toBe(batch.length);
      // the idle moves: the tallest moment over ~3 s counts (the game scales on the idle's tallest frame)
      for (let i = 0; i < 12; i++) {
        for (const f of (await renderStats(page)).figures) { best[f.cardId] = Math.max(best[f.cardId] || 0, f.standH); boardTop[f.cardId] = Math.max(boardTop[f.cardId] || 0, f.boardH || 0, f.standH); }
        await page.waitForTimeout(250);
      }
    }
    const off = ids.filter((id) => !(Math.abs(best[id] - UNIT_SQUARES[id] * K) <= UNIT_SQUARES[id] * K * 0.08)).map((id) => `${id} ${best[id]} vs ${+(UNIT_SQUARES[id] * K).toFixed(3)}`);
    expect(off, 'units off their table height').toEqual([]);
    const tallest = ids.slice().sort((a, b) => best[b] - best[a]).slice(0, 2).sort();
    expect(tallest).toEqual(['grubnaks-big-boss-troll', 'the-great-steam-golem']);
    expect(Math.abs(best['gnome-prospector'] - 0.66 * K)).toBeLessThanOrEqual(0.66 * K * 0.08);
    expect(Math.abs(best['dwarf-miner'] - 1.05 * K)).toBeLessThanOrEqual(1.05 * K * 0.08);
    expect(Math.max(...Object.values(boardTop)), 'no unit taller than ~2.9 squares').toBeLessThanOrEqual(2.95 * K);
  });
}

// ---------- Oct 31 (Ken: "The gnome commander doesn't have his staff. ... the gemslinger miner doesn't have his pickaxe.") ----------
for (const vp of [{ name: 'desktop', width: 1920, height: 1080 }, { name: 'phone', width: 844, height: 390 }]) {
  test(`AC431: units and Commanders carry their gear: Knobbin's staff, the Gemsinger Miner's pickaxe, the Riot Shield Bearer's tower shield (${vp.name})`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await start(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle', factionLock: false, setup: { opponentHand: [], board: [
      { cardId: 'gnome-prospector', owner: 'player', row: 6, col: 4 },
      { cardId: 'dwarf-miner', owner: 'player', row: 6, col: 7 },
      { cardId: 'overclocked-conduit', owner: 'player', row: 6, col: 10 },
    ] } });
    if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
    const item = async (cardId, name) => (((await renderStats(page)).figures.find((f) => f.cardId === cardId) || {}).items || []).find((i) => i.name === name);
    for (const [cardId, name, bone] of [['gnome-prospector', 'pickaxe', 'RightHand'], ['dwarf-miner', 'tower-shield', 'LeftForeArm'], ['overclocked-conduit', 'pickaxe', 'RightHand'], ['overclocked-conduit', 'pickaxe-2', 'LeftHand']]) {
      await expect.poll(async () => !!(await item(cardId, name)), { timeout: 30000, message: `${cardId} ${name} attached` }).toBe(true);
      const it = await item(cardId, name);
      expect(it.bone, `${cardId} ${name} bone`).toBe(bone);
      expect(it.visible, `${cardId} ${name} visible`).toBe(true);
      expect(it.size, `${cardId} ${name} has a real size`).toBeGreaterThan(0.15);
      expect(it.size, `${cardId} ${name} not giant`).toBeLessThan(2.5);
    }
    const staff = async () => ((((await renderStats(page)).commanderModels || []).find((c) => c.commanderId === 'sproingle') || {}).items || []).find((i) => i.name === 'staff');
    await expect.poll(async () => !!(await staff()), { timeout: 30000, message: "Knobbin's staff attached" }).toBe(true);
    const st = await staff();
    expect(st.bone).toBe('RightHand');
    expect(st.visible).toBe(true);
    expect(st.size).toBeGreaterThan(0.3);
  });
}

// ---------- Oct 31 (Ken: "the fireball graphic looks awful. It's so tiny ... make it like an event that's happening ... completely serious, but absolutely ridiculous.") ----------
// Brush's painted spell FX (public/art/spell-fx, studio/spell-fx-spec.json) replace the emoji glyphs; they play in the 3D board scene.
const SFX_LAYERS = ['core', 'glow', 'particles', 'ring', 'debris', 'word'];
const sfxLog = (page) => page.evaluate(() => window.oreheart.getSpellFxLog());
const sfxNow = (page) => page.evaluate(() => window.oreheart.getSpellFxNow());
const sfxClear = (page) => page.evaluate(() => window.oreheart.clearSpellFxLog());
const sfxAt = (page, id, ms) => page.evaluate(([i, m]) => window.oreheart.getSpellFxAt(i, m), [id, ms]);
/** samples the live FX inside the page every ~25 ms until none is left (or maxMs) */
const sfxSamples = (page, maxMs = 5000) => page.evaluate(async (max) => {
  const out = [], t0 = performance.now();
  let seen = false;
  while (performance.now() - t0 < max) {
    const n = window.oreheart.getSpellFxNow();
    out.push({ ms: Math.round(performance.now() - t0), ...n });
    if (n.active.length) seen = true; else if (seen) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  return out;
}, maxMs);
const sfxSetup = (extra) => ({ ai: false, playerCommander: 'grubnak', opponentCommander: 'sproingle', factionLock: false, setup: { opponentHand: [], playerCrystals: 20, playerDeck: SHARDS, ...extra } });

test('AC470: every spell has its six painted FX layers on disk, PC and phone sets, and the FX spec is loaded', async ({ page, request }) => {
  test.setTimeout(60000);
  await openTest(page);
  const spec = await page.evaluate(() => window.oreheart.getSpellFxSpec());
  expect(spec.loaded).toBe(true);
  expect([...spec.spells].sort()).toEqual([...SPELLS].sort());
  for (const id of SPELLS) {
    const f = spec.files[id];
    expect(f.pc.length, id).toBe(6);
    expect(f.phone.length, id).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(f.pc[i], `${id} pc ${SFX_LAYERS[i]}`).toBe(`/art/spell-fx/${id}/${id}-${SFX_LAYERS[i]}.webp`);
      expect(f.phone[i], `${id} phone ${SFX_LAYERS[i]}`).toBe(`/art/spell-fx/${id}/${id}-${SFX_LAYERS[i]}-m.webp`);
    }
    for (const u of [...f.pc, ...f.phone]) {
      const r = await request.get(u);
      expect(r.status(), u).toBe(200);
      expect(r.headers()['content-type'] || '', u).toMatch(/image\/webp/);
      expect((await r.body()).length, u).toBeGreaterThan(2000);
    }
  }
  // the spell visual ids are the painted FX now (one per spell)
  for (const id of ['fireball', 'meteor-strike', 'venom-shiv']) expect((await page.evaluate(async (x) => await window.oreheart.getCard(x), id)).visual).toMatch(/-painted-/);
});

test('AC471: Searing Arcane Orb plays as an event: 3 beats in order, flat ring at the target, slow-mo, light shake, the FWOOSH! word pops and holds; the match goes on', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  let s = await start(page, sfxSetup({ playerHand: ['fireball', 'goblin-scrapper'], board: [{ cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 6 }] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  const hp = at(s, 3, 6).health;
  await sfxClear(page);
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'fireball'), target: { row: 3, col: 6 } })).ok).toBe(true);
  // the engine resolved it at once (the FX is timing only)
  s = await getState(page);
  const t = at(s, 3, 6);
  expect(!t || t.health === hp - 3, 'the Orb dealt its 3 damage right away').toBe(true);
  const samples = await sfxSamples(page);
  const log = (await sfxLog(page)).filter((e) => e.spell === 'fireball');
  expect(log.length).toBe(1);
  const L = log[0];
  expect(L.path).toBe('sky_fall'); // owner check change (Ken, Oct 31): it falls from the sky now
  expect(L.caster).toBe('player');
  expect(L.from).toEqual({ row: 7, col: 2 }); // Grubnak casts from his Stronghold
  expect(L.target).toEqual({ row: 3, col: 6 });
  expect(L.beats.map((b) => b.beat)).toEqual(['windup', 'travel_impact', 'aftermath']);
  expect(L.beats[0].startMs).toBe(0);
  expect(L.beats[1].startMs).toBe(L.beats[0].ms);
  expect(L.beats[2].startMs).toBe(L.beats[0].ms + L.beats[1].ms);
  // owner check change (Ken, Oct 31: "I want the fireball to crash a little sooner. Or a little slower."): a slower, clear 0.8 s arc and the crash at about 1.2 s; the whole Orb about 1.8 s
  expect(L.impactMs, 'the crash lands at about 1.2 s').toBeGreaterThanOrEqual(1100);
  expect(L.impactMs).toBeLessThanOrEqual(1300);
  expect(L.impactMs - L.beats[0].ms, 'a visible flight').toBeGreaterThanOrEqual(700);
  expect(L.totalMs).toBeGreaterThanOrEqual(1600);
  expect(L.totalMs).toBeLessThanOrEqual(1900);
  expect(L.layers).toEqual(SFX_LAYERS);
  expect(L.slowmo).toEqual({ factor: 0.35, ms: 300, atMs: L.impactMs });
  expect(L.shake.px).toBeGreaterThan(0);
  expect(L.shake.px).toBeLessThanOrEqual(6);
  expect(L.shake.ms).toBeLessThanOrEqual(250);
  expect(L.word.text).toBe('FWOOSH!');
  expect(L.word.peak).toBe(1.25);
  expect(L.word.holdMs).toBeGreaterThanOrEqual(600);
  expect(L.ring).toMatchObject({ flat: true, at: { row: 3, col: 6 } });
  expect(L.reduced).toBe(false);
  expect(L.textures).toBe('pc');
  expect(L.files.every((f) => /\/art\/spell-fx\/fireball\/fireball-[a-z]+\.webp$/.test(f))).toBe(true);
  // the timeline (computed state of each layer at points of the FX's own clock)
  const imp = L.impactMs, w = L.beats[0].ms, tr = imp - w;
  // owner check change (Ken, Oct 31: "the fireball and the meteor both need to come from like a random part from the top down. Not from the
  // ground up."): the Orb gathers high in the sky (never at the Stronghold) and falls onto the target
  expect(L.path).toBe('sky_fall');
  for (const ms of [60, 300, w - 20]) {
    const f = await sfxAt(page, L.id, ms);
    expect(f.beat).toBe('windup');
    expect(f.layers.core.y, `the Orb gathers up in the sky (${ms} ms)`).toBeGreaterThan(6);
  }
  const flight = [];
  for (const k of [0.1, 0.2, 0.3, 0.5, 0.7]) flight.push(await sfxAt(page, L.id, w + tr * k));
  expect(flight.every((f) => f.beat === 'travel_impact' && f.layers.core.visible)).toBe(true);
  expect(Math.max(...flight.map((f) => f.layers.core.y)), 'a high arc').toBeGreaterThan(2.5);
  const hit = await sfxAt(page, L.id, imp + 60);
  expect(hit.layers.core.visible, 'the Orb is spent at impact').toBe(false);
  expect(hit.layers.ring).toMatchObject({ visible: true, sprite: false, cell: { row: 3, col: 6 } });
  expect(hit.layers.ring.normalY, 'the ring lies flat on the board').toBeGreaterThan(0.99);
  expect(hit.layers.ring.y).toBeLessThan(0.1);
  const size = L.word.sizeSquares;
  expect((await sfxAt(page, L.id, imp - 10)).layers.word.visible).toBe(false);
  expect((await sfxAt(page, L.id, imp + 132)).layers.word.scale / size, 'the word pops to 1.25').toBeCloseTo(1.25, 1);
  expect((await sfxAt(page, L.id, imp + 300)).layers.word.scale / size, 'then settles at 1.0').toBeCloseTo(1, 2);
  expect((await sfxAt(page, L.id, imp + 220 + 600)).layers.word.alpha, 'still fully readable 600 ms after the pop').toBe(1);
  expect((await sfxAt(page, L.id, L.totalMs - 5)).beat).toBe('aftermath');
  expect((await sfxAt(page, L.id, L.totalMs - 5)).layers.core.visible).toBe(false);
  // live: the FX really ran on the page clock, with the slow-mo: once past the impact, the FX clock trails the real clock by 300 x 0.65 = 195 ms
  const fs = samples.map((x) => x.active.find((a) => a.spell === 'fireball')).filter(Boolean);
  expect(fs.length, 'the FX was live').toBeGreaterThan(2);
  for (const f of fs) {
    const lag = f.realMs - f.localMs;
    if (f.localMs < imp - 5) expect(lag, `no slow-mo before the impact (${f.localMs} ms)`).toBeLessThanOrEqual(5);
    else if (f.localMs > imp + 300 * 0.35 + 5) expect(Math.abs(lag - 195), `0.35x for 300 ms at the impact (${f.localMs} ms)`).toBeLessThanOrEqual(6);
  }
  // the whole event: its spec length plus the slow-mo, then nothing left
  await expect.poll(async () => (await sfxNow(page)).active.length, { timeout: 4000 }).toBe(0);
  // the match carries on normally
  s = await getState(page);
  expect(s.players.player.discard.some((c) => c.cardId === 'fireball')).toBe(true);
  expect((await act(page, { type: 'done' })).ok).toBe(true);
});

test('AC472: Starfall covers the 3x3, Venom Shiv is thrown at its target, Thunderhorn glow stays on each buffed unit while the buff lasts, countered cards shatter into shards', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  // Starfall Cataclysm: falls from the sky onto the centre, the ring covers the whole 3x3
  let s = await start(page, sfxSetup({ playerHand: ['meteor-strike'], board: [{ cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 6 }, { cardId: 'goblin-scrapper', owner: 'opponent', row: 2, col: 7 }] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  await sfxClear(page);
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'meteor-strike'), target: { row: 3, col: 6 } })).ok).toBe(true);
  let L = (await sfxLog(page)).find((e) => e.spell === 'meteor-strike');
  expect(L.path).toBe('sky_fall');
  expect(L.area.cells.length).toBe(9);
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) expect(L.area.cells).toContainEqual({ row: 3 + dr, col: 6 + dc });
  expect(L.area.ringSquares, 'the ring is wider than the 3x3').toBeGreaterThanOrEqual(3);
  expect(L.ring.at).toEqual({ row: 3, col: 6 });
  expect(L.slowmo.factor).toBe(0.35);
  expect(L.shake.px).toBeLessThanOrEqual(6);
  let w = L.beats[0].ms, tr = L.impactMs - w;
  let f = await sfxAt(page, L.id, w + tr * 0.3);
  expect(f.layers.core.visible && f.layers.core.y > 3, 'the meteor falls from high up').toBe(true);
  f = await sfxAt(page, L.id, L.impactMs + (L.ring.ms - 20));
  expect(f.layers.ring.scale, 'the ring grows over the whole 3x3').toBeGreaterThanOrEqual(3);
  expect(f.layers.ring.cell).toEqual({ row: 3, col: 6 });
  await expect.poll(async () => (await sfxNow(page)).active.length, { timeout: 5000 }).toBe(0);
  // Venom Shiv: thrown straight from the caster to the target, low (not an arc)
  s = await newMatch(page, sfxSetup({ playerHand: ['venom-shiv'], board: [{ cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 6 }] }));
  await sfxClear(page);
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'venom-shiv'), target: { row: 3, col: 6 } })).ok).toBe(true);
  L = (await sfxLog(page)).find((e) => e.spell === 'venom-shiv');
  expect(L.path).toBe('throw');
  expect(L.from).toEqual({ row: 7, col: 2 });
  expect(L.target).toEqual({ row: 3, col: 6 });
  expect(L.ring.at).toEqual({ row: 3, col: 6 });
  w = L.beats[0].ms; tr = L.impactMs - w;
  const v0 = (await sfxAt(page, L.id, w + 5)).layers.core, v1 = (await sfxAt(page, L.id, w + tr * 0.5)).layers.core, v2 = (await sfxAt(page, L.id, L.impactMs - 5)).layers.core;
  expect(v1.visible).toBe(true);
  expect(v1.y, 'a throw, not a lob').toBeLessThan(2.4);
  expect(v1.x, 'flying towards the target').toBeGreaterThan(v0.x);
  expect(v2.cell, 'arrives at the target').toEqual({ row: 3, col: 6 });
  await expect.poll(async () => (await sfxNow(page)).active.length, { timeout: 5000 }).toBe(0);
  // Thunderhorn Blast: the glow stays on each of the caster's units for the rest of the turn, then goes
  s = await newMatch(page, sfxSetup({ playerHand: ['battle-cry'], board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 6 }, { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 9 }, { cardId: 'goblin-scrapper', owner: 'opponent', row: 2, col: 9 }] }));
  const mine = s.board.creatures.filter((c) => c.owner === 'player').map((c) => c.uid).sort();
  await sfxClear(page);
  expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'battle-cry') })).ok).toBe(true);
  L = (await sfxLog(page)).find((e) => e.spell === 'battle-cry');
  expect(L.path).toBe('at_caster');
  expect([...L.units].sort()).toEqual(mine);
  await expect.poll(async () => (await sfxNow(page)).active.length, { timeout: 5000 }).toBe(0);
  await page.waitForTimeout(400);
  let g = (await sfxNow(page)).buffGlows;
  expect(g.filter((x) => x.side === 'player').map((x) => x.uid).sort(), 'a glow on every buffed unit after the FX').toEqual(mine);
  expect(g.every((x) => x.visible && Math.abs(x.alpha - 0.35) < 0.02)).toBe(true);
  expect(g.some((x) => x.side === 'opponent')).toBe(false);
  await passTurn(page); // the buff ends with the turn
  await expect.poll(async () => (await sfxNow(page)).buffGlows.length, { timeout: 5000 }).toBe(0);
  // Snuff Out: the countered Orb shatters into shards and the counter's FX lands on it
  s = await newMatch(page, respondR6(['fizzle'], 3));
  await sfxClear(page);
  await castFireball(page, s);
  s = await getState(page);
  expect((await act(page, { type: 'respond', uid: handUid(s, 'player', 'fizzle') })).ok).toBe(true);
  let lg = await sfxLog(page);
  expect(lg.find((e) => e.kind === 'shards' && e.countered === 'fireball')?.count).toBeGreaterThan(0);
  expect(lg.find((e) => e.spell === 'fizzle')).toMatchObject({ kind: 'counter', path: 'drop_in', countered: 'fireball', target: { row: 1, col: 12 } });
  expect(lg.some((e) => e.spell === 'fireball'), 'a countered spell never plays').toBe(false);
  // Pickpocket!: the countered summon shatters on its square
  s = await newMatch(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: { playerHand: ['goblin-scrapper'], playerCrystals: 5, opponentHand: ['hold-it'], opponentCrystals: 4 } });
  expect((await act(page, { type: 'summon', uid: handUid(s, 'player', 'goblin-scrapper'), row: 7, col: 1 })).ok).toBe(true);
  s = await getState(page);
  await sfxClear(page);
  expect((await act(page, { type: 'respond', uid: handUid(s, 'opponent', 'hold-it') })).ok).toBe(true);
  lg = await sfxLog(page);
  expect(lg.find((e) => e.kind === 'shards' && e.countered === 'goblin-scrapper')).toMatchObject({ at: { row: 7, col: 1 } });
  expect(lg.find((e) => e.spell === 'hold-it')).toMatchObject({ kind: 'counter', path: 'swipe', target: { row: 7, col: 1 } });
  // Hex Reversal (disabled in decks, FX kept): the copied spell plays back from the reflector after the reflection
  await sfxClear(page);
  await page.evaluate(() => { const a = window.__app; a.animate(a.game.state, [
    { type: 'counter', cardId: 'mirror-hex', player: 'player', countered: 'fireball', ckind: 'cast' },
    { type: 'spell', player: 'player', cardId: 'fireball', target: { commander: 'opponent' } }]); });
  lg = await sfxLog(page);
  const hex = lg.find((e) => e.spell === 'mirror-hex'), back = lg.find((e) => e.spell === 'fireball');
  expect(hex).toMatchObject({ kind: 'counter', slowmo: { factor: 0.35, ms: 300 } });
  expect(back).toMatchObject({ kind: 'replay', caster: 'player', from: { row: 7, col: 2 } });
  expect(back.delayMs).toBe(hex.totalMs);
});

test.describe('spell FX on a phone (844x390, touch)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });
  test('AC473: phones load the -m files, the FX still plays, and no JS task over 100 ms during a fireball', async ({ page }) => {
    test.setTimeout(60000);
    let s = await start(page, sfxSetup({ playerHand: ['fireball'], board: [{ cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 6 }] }));
    if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
    expect((await page.evaluate(() => window.oreheart.getSpellFxSpec())).phone).toBe(true);
    await page.waitForTimeout(1500); // the FX textures warm up after the match opens
    const watch = (ms) => page.evaluate((m) => new Promise((res) => { const out = []; const o = new PerformanceObserver((l) => { for (const e of l.getEntries()) out.push(Math.round(e.duration)); }); o.observe({ type: 'longtask' }); setTimeout(() => { o.disconnect(); res(out); }, m); }), ms);
    const castWatched = async () => {
      const st = await getState(page);
      const during = watch(2800);
      await page.waitForTimeout(50);
      expect((await act(page, { type: 'cast', uid: handUid(st, 'player', 'fireball'), target: { row: 3, col: 6 } })).ok).toBe(true);
      return during;
    };
    // yardstick: the same cast with the FX switched off (automated runs draw in software, where one 3D frame alone can take ~100 ms)
    await page.evaluate(() => window.oreheart.setSpellFxEnabled(false));
    const base = await castWatched();
    await page.evaluate(() => window.oreheart.setSpellFxEnabled(true));
    s = await newMatch(page, sfxSetup({ playerHand: ['fireball'], board: [{ cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 6 }] }));
    await page.waitForTimeout(1500);
    await sfxClear(page);
    const long = await castWatched();
    const L = (await sfxLog(page)).find((e) => e.spell === 'fireball');
    expect(L.reduced).toBe(true);
    expect(L.textures).toBe('phone');
    expect(L.files.every((f) => /-m\.webp$/.test(f))).toBe(true);
    const n = await sfxNow(page);
    expect(n.perf.updates, 'the FX was drawn').toBeGreaterThan(0);
    for (const ms of [200, L.impactMs + 60, L.totalMs - 200]) expect(Object.values((await sfxAt(page, L.id, ms)).layers).some((x) => x.visible), `FX visible at ${ms} ms`).toBe(true);
    // the FX's own JavaScript is tiny: no FX step over 16 ms, starting it under 50 ms
    expect(n.perf.maxUpdateMs, 'slowest FX frame step (ms)').toBeLessThanOrEqual(16);
    expect(n.perf.maxPlayMs, 'starting the FX (ms)').toBeLessThanOrEqual(50);
    // no JS task over 100 ms during the fireball; where the page is slower than that without the FX too, the FX adds no long task of its own
    const cap = Math.max(100, Math.max(0, ...base) * 1.3 + 50);
    expect(Math.max(0, ...long), `long tasks during the fireball: [${long.join(', ')}] ms; same cast without FX: [${base.join(', ')}] ms`).toBeLessThanOrEqual(cap);
  });
});

test('AC474: the emoji glyph spell FX are gone: no glyph sticker on a cast', async ({ page }) => {
  test.setTimeout(60000);
  let s = await start(page, sfxSetup({ playerHand: ['fireball', 'battle-cry'], board: [{ cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 6 }, { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 6 }] }));
  if (!(await renderStats(page)).webgl) test.skip(true, 'WebGL unavailable');
  const GLYPHS = ['🙏', '🗡', '🕳', '🔥', '📣', '☄', '✚', '🛡', '💨', '💫', '✋', '⚡', '🪞'];
  const glyphCheck = () => page.evaluate((G) => {
    const els = document.querySelectorAll('.fxv, .fxv-card, .fxv-result, .fxv-g, .fxv-g2, .fxv-g3');
    const fx = document.querySelector('.fx');
    const txt = fx ? fx.textContent || '' : '';
    return { els: els.length, glyph: G.some((g) => txt.includes(g)) };
  }, GLYPHS);
  for (const [id, a] of [['fireball', { target: { row: 3, col: 6 } }], ['battle-cry', {}]]) {
    await sfxClear(page);
    s = await getState(page);
    expect((await act(page, { type: 'cast', uid: handUid(s, 'player', id), ...a })).ok).toBe(true);
    for (let i = 0; i < 8; i++) {
      expect(await glyphCheck(), `${id} sample ${i}`).toEqual({ els: 0, glyph: false });
      await page.waitForTimeout(150);
    }
    expect((await sfxLog(page)).some((e) => e.spell === id), `${id} played its painted FX`).toBe(true);
  }
});

// ---------- Oct 31 (Forge): the two spell FX leftovers ----------
// Starfall: the units in the 3x3 take their hit flash when the meteor LANDS (the FX's impact), not at the cast. Desperate Plunder: gems fly from the
// caster into that side's Flow counter at impact and pulse it on landing.
test('AC475: Starfall Cataclysm: every unit in the 3x3 is hit at the meteor\'s impact, none before it', async ({ page }) => {
  test.setTimeout(90000);
  await start(page, { ai: false, skipMulligan: true, playerCommander: 'sproingle', opponentCommander: 'grubnak', mines: [{ row: 3, col: 3 }, { row: 4, col: 7 }, { row: 5, col: 11 }],
    setup: { firstPlayer: 'player', playerCrystals: 9, playerHand: ['meteor-strike'], factionLock: false,
      board: [{ cardId: 'goblin-grunt', owner: 'opponent', row: 2, col: 5 }, { cardId: 'goblin-scrapper', owner: 'opponent', row: 2, col: 6 }, { cardId: 'goblin-sneak', owner: 'opponent', row: 3, col: 6 }] }, factionLock: false });
  const s0 = await getState(page);
  const foes = s0.board.creatures.filter((c) => c.owner === 'opponent');
  await expect.poll(async () => { const f = ((await renderStats(page)).figures || []).filter((x) => foes.some((c) => c.uid === x.uid)); return f.length === 3 && f.every((x) => x.model === 'finished'); }, { timeout: 45000 }).toBe(true);
  const cast = (await legal(page)).find((a) => a.type === 'cast' && a.target && a.target.row === 2 && a.target.col === 6) || (await legal(page)).find((a) => a.type === 'cast' && a.target && a.target.row === 3 && a.target.col === 6);
  expect(cast, 'Starfall can target the middle of the three').toBeTruthy();
  await page.evaluate(() => window.oreheart.clearSpellFxLog());
  expect((await act(page, cast)).ok).toBe(true);
  let fx = null;
  await expect.poll(async () => { fx = ((await page.evaluate(() => window.oreheart.getSpellFxLog())) || []).find((x) => x.spell === 'meteor-strike' && x.kind === 'cast'); return !!fx; }, { timeout: 8000 }).toBe(true);
  const impactAt = fx.startedAt + fx.impactMs;
  const hitAt = async () => { const log = (await renderStats(page)).creatureAnimLog || []; return foes.map((c) => { const e = log.find((x) => x.uid === c.uid && (x.anim === 'hit' || x.anim === 'defeat' || x.anim === 'knockback')); return e ? e.at : 0; }); };
  await expect.poll(async () => (await hitAt()).every((t) => t > 0), { timeout: 15000, message: 'every unit in the 3x3 reacts' }).toBe(true);
  const at = await hitAt();
  for (const [i, t] of at.entries()) {
    expect(t, `${foes[i].cardId} was hit ${Math.round(impactAt - t)} ms BEFORE the meteor landed`).toBeGreaterThanOrEqual(impactAt - 40);
    expect(t - impactAt, `${foes[i].cardId} reacted long after the impact`).toBeLessThan(2500);
  }
});

test('AC476: Desperate Plunder: gems fly from the caster into its Flow counter at impact and land', async ({ page }) => {
  test.setTimeout(60000);
  for (const [W, H] of [[1920, 1080], [844, 390]]) {
    await page.setViewportSize({ width: W, height: H });
    await start(page, { ai: false, skipMulligan: true, playerCommander: 'grubnak', opponentCommander: 'borgo',
      setup: { firstPlayer: 'player', playerCrystals: 9, playerHand: ['prospectors-prayer'], factionLock: false }, factionLock: false });
    const cast = (await legal(page)).find((a) => a.type === 'cast');
    expect(cast, 'Desperate Plunder can be cast').toBeTruthy();
    await page.evaluate(() => window.oreheart.clearSpellFxLog());
    expect((await act(page, cast)).ok).toBe(true);
    let fx = null;
    await expect.poll(async () => { fx = ((await page.evaluate(() => window.oreheart.getSpellFxLog())) || []).find((x) => x.spell === 'prospectors-prayer' && x.kind === 'cast'); return !!(fx && fx.gems); }, { timeout: 8000 }).toBe(true);
    const g = fx.gems;
    expect(g.to, `${W}x${H} into the caster's Flow counter`).toBe('player-flow-crystal');
    expect(g.count, `${W}x${H} a handful of gems`).toBeGreaterThanOrEqual(5);
    expect(Math.abs(g.startsAt - (fx.startedAt + fx.impactMs)), `${W}x${H} the gems leave at impact`).toBeLessThanOrEqual(5);
    await expect.poll(async () => (((await page.evaluate(() => window.oreheart.getSpellFxLog())) || []).find((x) => x.id === fx.id)?.gems?.landedAt) || 0, { timeout: 12000, message: 'the gems land' }).toBeGreaterThan(0);
    const landed = ((await page.evaluate(() => window.oreheart.getSpellFxLog())) || []).find((x) => x.id === fx.id).gems.landedAt;
    expect(landed - g.startsAt, `${W}x${H} the flight takes about its own time`).toBeGreaterThanOrEqual(g.flightMs - 40);
  }
});

// Oct 31 (Ken via Forge): "What happened to the silver Oreheart logo? That we replaced. You went back to the gold one." The silver logo is Ken's
// Oct 24 brand logo (public/art/logo-wide.webp = the Menu Builder's built-in picture `logo`); the intro and main menu pieces showed the older gold
// Menu Builder picture (img:025dre / img:zlqfpp). Both now use the silver one.
test('AC477: the intro and main menu show the silver OREHEART logo (Ken\'s Oct 24 brand logo), never the old gold one', async ({ page }) => {
  for (const [W, H] of [[1920, 1080], [844, 390]]) {
    await page.setViewportSize({ width: W, height: H });
    for (const [url, where] of [['/?test=1&seed=3', 'main menu'], ['/?test=1&seed=3&intro=1', 'intro']]) {
      await page.goto(url);
      await page.waitForFunction(() => !!window.oreheart);
      const img = page.locator('.mb-pc[data-id="mainLogo"] img, .mb-pc[data-id="introLogo"] img').first();
      await expect(img, `${W}x${H} ${where}: logo shown`).toBeVisible({ timeout: 10000 });
      await expect.poll(async () => img.evaluate((e) => e.complete && e.naturalWidth), { timeout: 8000 }).toBeGreaterThan(0);
      const info = await img.evaluate((e) => ({ src: new URL(e.currentSrc || e.src, location.href).pathname, w: e.naturalWidth, h: e.naturalHeight }));
      expect(info.src, `${W}x${H} ${where}: the silver logo file`).toBe('/art/logo-wide.webp');
      expect([info.w, info.h], `${W}x${H} ${where}: the silver logo is 1600x533 (the old gold one was 1200x400)`).toEqual([1600, 533]);
      const gold = await page.evaluate(() => [...document.querySelectorAll('img')].filter((e) => /img-(025dre|zlqfpp)\.webp/.test(e.currentSrc || e.src) && e.offsetParent).length);
      expect(gold, `${W}x${H} ${where}: no gold logo anywhere on screen`).toBe(0);
    }
  }
});

// ---------- Oct 31 (Ken): the computer plays like a person ----------
// "The opposing side plays stuff too fast ... a barrage ... he played a card. The card covered my screen. And then he threw a fireball and blew
// my stuff up. I didn't even get to see him get blown up." Each computer action waits until the board is calm (no walking, attack, hit, death,
// knock-back, summon, spell FX or card reveal), then a beat; its card pops up and is laid aside BEFORE it resolves; a spell's target squares light up.
for (const vp of [{ name: 'desktop', width: 1920, height: 1080, touch: false }, { name: 'phone', width: 844, height: 390, touch: true }]) {
  test.describe(`AC478 (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch });
    test(`AC478: the computer's actions never overlap, and its card is shown and laid aside before it resolves (${vp.name})`, async ({ page }) => {
      test.setTimeout(150000);
      await page.goto('/?test=1&seed=5&aiworker=1&fx=1');
      await page.waitForFunction(() => !!window.oreheart);
      await page.evaluate(async () => await window.oreheart.newMatch({ mode: 'standard', ai: true, difficulty: 'hard', seed: 5, skipMulligan: true, playerCommander: 'grubnak', opponentCommander: 'sproingle', factionLock: false,
        setup: { firstPlayer: 'opponent', opponentCrystals: 12, opponentHand: ['fireball', 'gnome-tinker', 'spark-gnome'],
          board: [{ cardId: 'goblin-grunt', owner: 'player', row: 4, col: 6 }, { cardId: 'goblin-scrapper', owner: 'player', row: 4, col: 8 }, { cardId: 'gnome-cogger', owner: 'opponent', row: 3, col: 6 }] } }));
      // the computer's whole first turn, paced
      for (let i = 0; i < 400; i++) { const s = await getState(page); if (s.activePlayer === 'player' && s.priority === 'player' && s.turn >= 2) break; await page.waitForTimeout(300); }
      const s = await getState(page);
      expect(s.activePlayer, 'the computer finished its turn').toBe('player');
      const { paceLog, aiLog } = await page.evaluate(async () => await window.oreheart.getAiPace());
      const plays = paceLog.filter((p) => ['summon', 'cast', 'playCrystal', 'minerUpgrade'].includes(p.type));
      expect(plays.length, 'the computer played cards').toBeGreaterThanOrEqual(2);
      // no two actions overlap: when each one is played the board is calm (only its own target marker may show)
      for (const p of paceLog) expect(['', 'target'], `${p.type} ${p.cardId || ''} was played while '${p.busyAtApply}' was still going`).toContain(p.busyAtApply);
      // actions are one after another with a beat in between
      for (let i = 1; i < paceLog.length; i++) if (paceLog[i].beatMs) expect(paceLog[i].at - paceLog[i - 1].at, `${paceLog[i].type} came right after ${paceLog[i - 1].type}`).toBeGreaterThanOrEqual(paceLog[i].beatMs - 30);
      // every card was revealed and gone (laid aside, or landed on its square) before it resolved
      for (const p of plays) {
        const gone = aiLog.filter((x) => x.kind === 'revealGone' && x.cardId === p.cardId && x.at <= p.at);
        expect(gone.length, `${p.cardId}: its reveal was laid aside before it resolved`).toBeGreaterThan(0);
        expect(p.previewMs, `${p.cardId}: a clear "here's what I'm playing" moment`).toBeGreaterThanOrEqual(900);
      }
      // a spell's target lights up before it resolves
      const casts = plays.filter((p) => p.type === 'cast');
      for (const p of casts) expect(aiLog.some((x) => x.kind === 'target' && x.cardId === p.cardId && x.at <= p.at), `${p.cardId}: target shown first`).toBe(true);
      // no reveal is left on screen now
      await expect(page.locator('.reveal.opp-play')).toHaveCount(0, { timeout: 5000 });
    });
  });
}

// ---------- Oct 31 (Ken's playtest of the pacing preview) ----------
// Ken: "while the card is up, on the center of the screen that he's playing, it's too big ... make it the same size as the card when it pops out of
// my hand ... I don't want him blocking my cards. Covering my cards. Ever."
for (const vp of [{ name: 'desktop', width: 1920, height: 1080 }, { name: 'phone', width: 844, height: 390 }]) {
  test.describe(`AC479 (${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test(`AC479: the computer's card shows at the hand pop-out size and never covers the player's hand, tucked or raised (${vp.name})`, async ({ page }) => {
      await page.goto('/?test=1&seed=3&fx=1');
      await page.waitForFunction(() => !!window.oreheart);
      await page.evaluate(async () => await window.oreheart.newMatch({ ai: false, skipMulligan: true, setup: { firstPlayer: 'player', playerHand: ['goblin-grunt', 'goblin-slinger', 'fireball', 'goblin-bomber', 'shiv-rat', 'goblin-sneak'] } }));
      await page.waitForTimeout(800);
      // the player's pop-out size: hover a hand card (it rises and enlarges), as AC164 does
      const card = page.getByLabel('Your hand', { exact: true }).getByRole('button', { name: 'Searing Arcane Orb', exact: true });
      const b0 = await card.boundingBox();
      await page.mouse.move(b0.x + b0.width / 2, Math.min(vp.height - 4, b0.y + 10));
      await expect.poll(async () => (await card.boundingBox()).width, { timeout: 5000 }).toBeGreaterThan(b0.width * 1.15);
      await page.waitForTimeout(500);
      const popW = (await card.boundingBox()).width;
      await page.mouse.move(vp.width / 2, vp.height * 0.3); await page.waitForTimeout(600);
      expect(popW, 'a hand card pops out').toBeGreaterThan(40);
      for (const raised of [false, true]) {
        const r = await page.evaluate(async (raised) => {
          const a = window.__app; a.openHand(raised, !raised); await new Promise((res) => setTimeout(res, 450));
          void a.reveal('fireball', null, 'opponent'); await new Promise((res) => setTimeout(res, 450));
          const rv = document.querySelector('.reveal.opp-play'); const b = rv.getBoundingClientRect();
          const hand = [...document.querySelectorAll('.hand .hand-card')].map((c) => c.getBoundingClientRect()).filter((x) => x.width);
          const hit = hand.filter((x) => x.left < b.right && x.right > b.left && x.top < b.bottom && x.bottom > b.top).length;
          rv._finish?.(); await new Promise((res) => setTimeout(res, 900));
          return { w: b.width, top: b.top, bottom: b.bottom, hit, cards: hand.length };
        }, raised);
        expect(r.cards, 'the hand is there').toBeGreaterThan(0);
        expect(r.hit, `${vp.name}, hand ${raised ? 'raised' : 'tucked'}: the computer's card covers none of the player's cards`).toBe(0);
        expect(r.w, `${vp.name}: not bigger than the pop-out (${Math.round(popW)} px)`).toBeLessThanOrEqual(popW * 1.04);
        if (vp.name === 'desktop') expect(r.w, `${vp.name}: the same size as the pop-out (${Math.round(popW)} px)`).toBeGreaterThanOrEqual(popW * 0.96);
        expect(r.top).toBeGreaterThanOrEqual(0);
      }
    });
  });
}

// Ken: "chat bubbles on top of each other ... no chat bubble completely overlays [another] ... the whack and stuff, it should be visible for a little
// bit longer, and then like float up ... I don't want it covering any of the chat bubbles or anything covering the unit that it's happening to"
test('AC480: comic words and speech bubbles never overlap each other, sit above the unit (never on it), and stay about 1.5 s', async ({ page }) => {
  for (const [W, H] of [[1920, 1080], [844, 390]]) {
    await page.setViewportSize({ width: W, height: H });
    await start(page, { ai: false, skipMulligan: true, setup: { firstPlayer: 'player', board: [{ cardId: 'goblin-grunt', owner: 'player', row: 5, col: 6 }, { cardId: 'dwarf-stoneback', owner: 'opponent', row: 4, col: 6 }, { cardId: 'goblin-scrapper', owner: 'player', row: 5, col: 7 }] } });
    await expect.poll(async () => ((await renderStats(page)).figures || []).filter((f) => f.model === 'finished').length, { timeout: 30000 }).toBeGreaterThanOrEqual(3);
    const r = await page.evaluate(async () => {
      const a = window.__app;
      a.pop('whack', 5, 6); a.pop('bonk', 5, 6); a.pop('clang', 4, 6); a.unitSay('unit-reporting', 5, 6, true); a.burst('CRUNCH!', 5, 7); a.pop('bonk', 5, 7); a.pop('whack', 4, 6);
      await new Promise((res) => setTimeout(res, 300));
      const els = [...document.querySelectorAll('.fx .pop-img, .fx .speech, .fx .burst')];
      const boxes = els.map((e) => { const [x, y, w, h] = (e.dataset.box || '0,0,0,0').split(',').map(Number); return { x0: x, y0: y, x1: x + w, y1: y + h, row: +e.dataset.row || 0, col: +e.dataset.col || 0, kind: e.className }; });
      const tops = {}; for (const k of ['5,6', '4,6', '5,7']) { const [rr, cc] = k.split(',').map(Number); tops[k] = a.view.topAt(rr, cc); }
      await new Promise((res) => setTimeout(res, 1000));
      const stillAt1300 = [...document.querySelectorAll('.fx .pop-img')].length;
      return { boxes, tops, stillAt1300 };
    });
    expect(r.boxes.length).toBeGreaterThanOrEqual(7);
    for (let i = 0; i < r.boxes.length; i++) for (let j = i + 1; j < r.boxes.length; j++) {
      const a = r.boxes[i], b = r.boxes[j];
      const ov = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
      expect(ov, `${W}x${H}: ${a.kind} and ${b.kind} overlap`).toBe(0);
    }
    for (const b of r.boxes) {
      const t = r.tops[`${b.row},${b.col}`];
      if (t) expect(b.y1, `${W}x${H}: a ${b.kind} covers the unit it is about (box bottom ${Math.round(b.y1)} below its top ${Math.round(t.top)})`).toBeLessThanOrEqual(t.top + 2);
    }
    expect(r.stillAt1300, `${W}x${H}: the words are still readable after 1.3 s`).toBeGreaterThan(0);
  }
});

// Ken: "on the clink animation when they do the mining, it needs to be on the object they're hitting ... the clanks need to be on the crystal. Not on the player."
test('AC481: the mining CLINK sits above the crystal being mined, not on the miner', async ({ page }) => {
  await start(page, { ai: false, skipMulligan: true, mines: [{ row: 4, col: 4 }, { row: 4, col: 7 }, { row: 4, col: 10 }], setup: { firstPlayer: 'player', board: [{ cardId: 'goblin-scrounger', owner: 'player', row: 5, col: 4 }] } });
  await act(page, { type: 'done' });
  const s = await getState(page);
  const miner = s.board.creatures.find((c) => c.cardId === 'goblin-scrounger');
  const mine = (await legal(page)).find((a) => a.type === 'mine' && a.creatureUid === miner.uid);
  expect(mine).toBeTruthy();
  expect((await act(page, mine)).ok).toBe(true);
  const clink = page.locator('.fx .pop-img[data-pop="clink"]').first();
  await expect(clink).toBeAttached({ timeout: 3000 });
  expect([await clink.getAttribute('data-row'), await clink.getAttribute('data-col')], 'the CLINK is on the mine').toEqual([String(mine.row), String(mine.col)]);
});

// Ken: "the fireball and the meteor both need to come from like a random part from the top down. Not from the ground up."
test('AC482: the Fireball and the Starfall meteor fall from high above, from a different direction each cast, and never rise from the ground or the Stronghold', async ({ page }) => {
  test.setTimeout(90000);
  const skies = [];
  for (const [spell, i] of [['fireball', 0], ['fireball', 1], ['fireball', 2], ['meteor-strike', 0], ['meteor-strike', 1]]) {
    let s = await start(page, sfxSetup({ playerHand: [spell], board: [{ cardId: 'goblin-scrapper', owner: 'opponent', row: 3, col: 6 }] }));
    await page.evaluate(() => window.oreheart.clearSpellFxLog());
    expect((await act(page, { type: 'cast', uid: handUid(s, 'player', spell), target: { row: 3, col: 6 } })).ok).toBe(true);
    let L = null;
    await expect.poll(async () => { L = (await sfxLog(page)).find((e) => e.spell === spell); return !!L; }, { timeout: 8000 }).toBe(true);
    expect(L.path, `${spell} falls from the sky`).toBe('sky_fall');
    expect(L.sky.dy, `${spell} starts high above`).toBeGreaterThan(8);
    expect(L.sky.dz, `${spell} comes in from the far side (the top of the screen)`).toBeLessThan(0);
    const w = L.beats[0].ms, imp = L.impactMs;
    const ys = [];
    for (const ms of [30, w - 20, w + 10, w + (imp - w) * 0.5, imp - 30]) { const f = await sfxAt(page, L.id, ms); if (f.layers.core.visible) ys.push(f.layers.core.y); }
    expect(ys.length, `${spell}: the core is seen on its way`).toBeGreaterThanOrEqual(2);
    for (let k = 1; k < ys.length; k++) expect(ys[k], `${spell}: it only ever goes DOWN (${ys.join(', ')})`).toBeLessThanOrEqual(ys[k - 1] + 0.01);
    expect(Math.min(...ys), `${spell}: it is never down at the Stronghold before it lands`).toBeGreaterThan(0.3);
    skies.push(`${L.sky.dx},${L.sky.dz}`);
  }
  expect(new Set(skies).size, `a different direction each cast (${skies.join(' | ')})`).toBeGreaterThanOrEqual(4);
});

// Ken: "the done button and the menu button. They're still not centered. And the done button is a little too big. It should be more the size of the menu button."
test('AC483: the Done button is the size of the Menu button, both have their contents centred, and Done stays clear of the deck pile', async ({ page }) => {
  for (const [W, H] of [[1920, 1080], [844, 390]]) {
    await page.setViewportSize({ width: W, height: H });
    await start(page, { ai: false, skipMulligan: true, setup: { firstPlayer: 'player' } });
    await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
    const m = await page.evaluate(() => {
      const r = (e) => { const b = e.getBoundingClientRect(); return { x0: b.left, x1: b.right, y0: b.top, y1: b.bottom, w: b.width, h: b.height }; };
      const text = (e) => { const tn = [...e.querySelectorAll('*'), e].flatMap((x) => [...x.childNodes]).find((n) => n.nodeType === 3 && n.textContent.trim()); const rg = document.createRange(); rg.selectNodeContents(tn); return r(rg); };
      const menu = document.querySelector('.match .o-menu .menu-btn'), done = document.querySelector('.match .btn.o-text.done-btn');
      const icon = getComputedStyle(done, '::before'), iw = parseFloat(icon.width) || 0, gap = parseFloat(getComputedStyle(done).columnGap) || 0;
      const deck = document.querySelector('.match [aria-label="Your deck"]');
      return { menu: r(menu), done: r(done), mt: text(menu), dt: text(done), iw, gap, deck: deck ? r(deck) : null };
    });
    expect(Math.abs(m.done.w - m.menu.w), `${W}x${H}: Done ${Math.round(m.done.w)} px wide, Menu ${Math.round(m.menu.w)}`).toBeLessThanOrEqual(2);
    expect(Math.abs(m.done.h - m.menu.h), `${W}x${H}: Done ${Math.round(m.done.h)} px tall, Menu ${Math.round(m.menu.h)}`).toBeLessThanOrEqual(2);
    const mc = (m.mt.x0 + m.mt.x1) / 2, bc = (m.menu.x0 + m.menu.x1) / 2;
    expect(Math.abs(mc - bc), `${W}x${H}: Menu's word is centred`).toBeLessThanOrEqual(m.menu.w * 0.04);
    const g0 = m.dt.x0 - m.iw - m.gap, dc = (g0 + m.dt.x1) / 2, dbc = (m.done.x0 + m.done.x1) / 2;
    expect(Math.abs(dc - dbc), `${W}x${H}: Done's icon and word are centred together`).toBeLessThanOrEqual(m.done.w * 0.04);
    for (const [t, b, n] of [[m.mt, m.menu, 'Menu'], [m.dt, m.done, 'Done']]) expect(Math.abs((t.y0 + t.y1) / 2 - (b.y0 + b.y1) / 2), `${W}x${H}: ${n} is centred top to bottom`).toBeLessThanOrEqual(b.h * 0.12);
    if (m.deck) expect(m.done.x0 - m.done.w * 0.3, `${W}x${H}: Done's left gem stays clear of the deck pile`).toBeGreaterThanOrEqual(m.deck.x1 - 1);
  }
});
