import { test, expect } from '@playwright/test';

// ---------- helpers ----------

const MENU_BUTTONS = ['Play', 'Collection', 'Deck Builder', 'Shop', 'How to Play', 'Settings'];

async function num(locator) {
  const text = (await locator.textContent()) || '';
  const m = text.match(/-?\d+/);
  if (!m) throw new Error(`No number in "${text}"`);
  return parseInt(m[0], 10);
}

async function expectNum(locator, value, timeout = 15_000) {
  await expect.poll(async () => { try { return await num(locator); } catch { return NaN; } }, { timeout }).toBe(value);
}

async function goHome(page, query = '') {
  await page.goto('/' + (query ? `?${query}` : ''));
  await expect(page.getByRole('heading', { name: 'Oreheart', exact: true })).toBeVisible();
}

async function waitForApi(page) {
  await page.waitForFunction(() => window.oreheart && Array.isArray(window.oreheart.cards) && window.oreheart.cards.length > 0);
}

/** Open Play screen from main menu, pick options, start, handle mulligan. */
async function startMatch(page, { deck = 'Wildwood Starter', mode = 'Quick Battle', difficulty = 'Easy', keep = true, waitYourTurn = true } = {}) {
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Play', exact: true })).toBeVisible();
  await page.getByLabel('Deck').selectOption({ label: deck });
  await page.getByRole('radio', { name: new RegExp(`^${mode}`) }).check();
  await page.getByRole('radio', { name: new RegExp(`^${difficulty}`) }).check();
  await page.getByRole('button', { name: 'Start Match' }).click();
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Your Starting Hand' }) });
  await expect(dialog).toBeVisible();
  if (!keep) return dialog;
  await dialog.getByRole('button', { name: 'Keep Hand' }).click();
  await expect(dialog).toBeHidden();
  if (waitYourTurn) await expect(page.getByTestId('turn-banner')).toHaveText(/Your Turn/, { timeout: 20_000 });
  return dialog;
}

const tile = (page, r, c) => page.getByTestId(`tile-${r}-${c}`);
const handCards = (page) => page.getByTestId('hand-card');
const handCard = (page, id) => page.locator(`[data-testid="hand-card"][data-card="${id}"]`).first();
const unitIn = (page, r, c) => tile(page, r, c).getByTestId('unit');

/** End turn and wait until it is our turn again (detected by +1 Wood income). */
async function endTurnAndWait(page) {
  const wood = page.getByTestId('res-wood');
  const before = await num(wood);
  await page.getByRole('button', { name: 'End Turn' }).click();
  await expectNum(wood, before + 1, 25_000);
  await expect(page.getByTestId('turn-banner')).toHaveText(/Your Turn/, { timeout: 20_000 });
}

const TEST_HAND = 'hand=acorn-sprout,mossy-turtle,beaver-builder,thornback-hedgehog';

// ---------- AC1 / AC2: load + navigation ----------

test('AC1: main menu loads with no uncaught page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await goHome(page);
  await expect(page).toHaveTitle(/Oreheart/);
  for (const name of MENU_BUTTONS) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expectNum(page.getByTestId('gold'), 50);
  await page.waitForTimeout(500);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('AC2: every menu button opens its screen and Back returns', async ({ page }) => {
  await goHome(page);
  for (const name of MENU_BUTTONS) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Oreheart', exact: true })).toBeVisible();
  }
});

// ---------- AC3: PWA ----------

test('AC3: installable PWA manifest and offline service worker', async ({ page, context }) => {
  await goHome(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await page.evaluate(async (h) => (await fetch(h)).json(), href);
  expect(manifest.name).toBe('Oreheart');
  expect(manifest.short_name).toBe('Oreheart');
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.orientation).toBe('portrait');
  const sizes = (manifest.icons || []).map((i) => i.sizes).join(' ');
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');

  const hasSw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  expect(hasSw).toBe(true);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 15_000 }).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Oreheart', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await context.setOffline(false);
});

// ---------- AC4–AC8: rules API ----------

test('AC4: card set has exactly 80 valid cards', async ({ page }) => {
  await goHome(page);
  await waitForApi(page);
  const cards = await page.evaluate(() => window.oreheart.cards);
  expect(cards.length).toBe(80);
  const ids = new Set(cards.map((c) => c.id));
  expect(ids.size).toBe(80);
  const byFaction = (f) => cards.filter((c) => c.faction === f);
  expect(byFaction('wildwood').length).toBe(24);
  expect(byFaction('shimmerfolk').length).toBe(24);
  expect(byFaction('ironclad').length).toBe(24);
  expect(byFaction('spell').length).toBe(8);
  for (const c of cards) {
    expect(c.id, c.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(['common', 'rare', 'epic', 'legendary']).toContain(c.rarity);
    const total = (c.cost.wood || 0) + (c.cost.crystal || 0) + (c.cost.iron || 0);
    expect(total, `${c.name} cost`).toBeGreaterThanOrEqual(1);
    expect(total, `${c.name} cost`).toBeLessThanOrEqual(5);
    if (c.type === 'creature') {
      const max = c.rarity === 'legendary' ? 6 : 4;
      for (const v of [c.attack, c.defense]) {
        expect(v, c.name).toBeGreaterThanOrEqual(1);
        expect(v, c.name).toBeLessThanOrEqual(max);
      }
      expect(c.arrows.length, c.name).toBeGreaterThanOrEqual(1);
      for (const a of c.arrows) expect(['F', 'B', 'L', 'R', 'FL', 'FR', 'BL', 'BR', 'FF', 'BB', 'LL', 'RR']).toContain(a);
    } else {
      expect(c.type).toBe('spell');
      expect(c.faction).toBe('spell');
      expect(c.cost.crystal, c.name).toBeGreaterThanOrEqual(1);
    }
  }
  const legendaries = cards.filter((c) => c.rarity === 'legendary' && c.type === 'creature');
  expect(legendaries.length).toBeGreaterThanOrEqual(3);
});

const ALL8 = ['F', 'B', 'L', 'R', 'FL', 'FR', 'BL', 'BR'];
// id, rarity, [wood, crystal, iron], attack, defense, arrows, ability keywords
const STARTERS = [
  ['beaver-builder', 'common', [1, 0, 0], 1, 1, ['F'], ['Worker', 'Builder']],
  ['acorn-sprout', 'common', [1, 0, 0], 1, 2, ['F'], []],
  ['thornback-hedgehog', 'common', [2, 0, 0], 2, 2, ['FL', 'FR', 'BL', 'BR'], []],
  ['mossy-turtle', 'common', [2, 0, 0], 1, 4, ['F'], []],
  ['owl-ranger', 'rare', [3, 0, 0], 2, 2, ['FF'], ['Flying']],
  ['bramble-elf', 'rare', [3, 0, 0], 3, 2, ['F', 'L', 'R'], ['Swift']],
  ['barkbeard-treant', 'epic', [4, 0, 0], 3, 4, ['F', 'L', 'R'], ['Builder']],
  ['old-oakheart', 'legendary', [4, 0, 1], 4, 5, ['F', 'B', 'L', 'R'], ['palisade']],
  ['gem-gnome', 'common', [0, 1, 0], 1, 1, ['F'], ['Worker']],
  ['spark-wisp', 'common', [0, 1, 0], 2, 1, ['F'], ['Flying']],
  ['prism-fox', 'common', [0, 2, 0], 3, 1, ['F', 'B'], ['Swap']],
  ['glimmer-bat', 'rare', [0, 2, 0], 2, 1, ['FL', 'FR'], ['Flying', 'Swift']],
  ['starcap-wizard', 'rare', [0, 3, 0], 3, 2, ['FF'], []],
  ['crystal-golemling', 'epic', [0, 3, 1], 2, 4, ['F', 'L', 'R'], ['Leap']],
  ['prismatica-rainbow-dragon', 'legendary', [0, 5, 0], 5, 3, ALL8, ['Flying']],
  ['goblin-miner', 'common', [0, 0, 1], 1, 1, ['F'], ['Worker']],
  ['tin-knight', 'common', [0, 0, 2], 3, 2, ['F', 'L', 'R'], []],
  ['grumble-orc', 'common', [0, 0, 2], 3, 3, ['F'], []],
  ['dwarf-smith', 'rare', [1, 0, 2], 2, 3, ['F'], ['Builder']],
  ['cannon-crab', 'rare', [0, 0, 3], 3, 3, ['L', 'R', 'FF'], []],
  ['boar-rider', 'epic', [0, 0, 4], 4, 3, ['F', 'FL', 'FR'], ['Charge', 'Swift']],
  ['sir-rivetbeard', 'legendary', [0, 0, 5], 5, 5, ['F', 'B', 'L', 'R'], []],
];
const STARTER_SPELLS = [
  ['zap', 'common', [0, 1, 0]],
  ['frost-snap', 'common', [0, 2, 0]],
  ['blink', 'rare', [0, 2, 0]],
  ['rockfall', 'rare', [0, 2, 1]],
  ['overgrowth', 'epic', [2, 2, 0]],
];

test('AC5: the 27 starter cards match the design document exactly', async ({ page }) => {
  await goHome(page);
  await waitForApi(page);
  const cards = await page.evaluate(() => window.oreheart.cards);
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  for (const [id, rarity, [w, c, i], atk, def, arrows, kws] of STARTERS) {
    const card = byId[id];
    expect(card, `missing ${id}`).toBeTruthy();
    expect(card.type, id).toBe('creature');
    expect(card.rarity, id).toBe(rarity);
    expect([card.cost.wood || 0, card.cost.crystal || 0, card.cost.iron || 0], id).toEqual([w, c, i]);
    expect(card.attack, id).toBe(atk);
    expect(card.defense, id).toBe(def);
    expect([...card.arrows].sort(), id).toEqual([...arrows].sort());
    for (const k of kws) expect(card.ability.toLowerCase(), id).toContain(k.toLowerCase());
  }
  expect(byId['tin-knight'].faction).toBe('ironclad');
  expect(byId['mossy-turtle'].faction).toBe('wildwood');
  expect(byId['gem-gnome'].faction).toBe('shimmerfolk');
  for (const [id, rarity, [w, c, i]] of STARTER_SPELLS) {
    const card = byId[id];
    expect(card, `missing ${id}`).toBeTruthy();
    expect(card.type, id).toBe('spell');
    expect(card.rarity, id).toBe(rarity);
    expect([card.cost.wood || 0, card.cost.crystal || 0, card.cost.iron || 0], id).toEqual([w, c, i]);
  }
});

test('AC6: starter decks are valid and validateDeck enforces deck rules', async ({ page }) => {
  await goHome(page);
  await waitForApi(page);
  const r = await page.evaluate(() => {
    const o = window.oreheart;
    const out = {};
    for (const f of ['wildwood', 'shimmerfolk', 'ironclad']) {
      const d = o.starterDecks[f];
      out[f] = { len: d.length, valid: o.validateDeck(d).valid, cheap: d.filter((id) => { const c = o.cards.find((x) => x.id === id); return c.cost.wood + c.cost.crystal + c.cost.iron <= 2; }).length,
        legendary: d.filter((id) => o.cards.find((x) => x.id === id).rarity === 'legendary').length };
    }
    out.zap = o.starterDecks.shimmerfolk.filter((id) => id === 'zap').length;
    out.tinKnight = o.starterDecks.ironclad.filter((id) => id === 'tin-knight').length;
    const nonLeg = o.cards.filter((c) => c.rarity !== 'legendary').map((c) => c.id).slice(0, 15);
    const base = nonLeg.flatMap((id) => [id, id]); // 30 cards, 2 each
    out.base = o.validateDeck(base).valid;
    out.short = o.validateDeck(base.slice(0, 29)).valid;
    out.long = o.validateDeck([...base, nonLeg[0]]).valid;
    const three = [...base]; three[29] = nonLeg[0];
    out.three = o.validateDeck(three).valid;
    const twoLeg = [...base.slice(0, 28), 'old-oakheart', 'old-oakheart'];
    out.twoLeg = o.validateDeck(twoLeg).valid;
    const oneLeg = [...base.slice(0, 28), 'old-oakheart', nonLeg[14]];
    out.oneLeg = o.validateDeck(oneLeg).valid;
    out.errorsIsArray = Array.isArray(o.validateDeck(base.slice(0, 29)).errors);
    return out;
  });
  for (const f of ['wildwood', 'shimmerfolk', 'ironclad']) {
    expect(r[f].len, f).toBe(30);
    expect(r[f].valid, f).toBe(true);
    expect(r[f].cheap, f).toBeGreaterThanOrEqual(16);
    expect(r[f].legendary, f).toBe(0);
  }
  expect(r.zap).toBe(2);
  expect(r.tinKnight).toBe(2);
  expect(r.base).toBe(true);
  expect(r.short).toBe(false);
  expect(r.long).toBe(false);
  expect(r.three).toBe(false);
  expect(r.twoLeg).toBe(false);
  expect(r.oneLeg).toBe(true);
  expect(r.errorsIsArray).toBe(true);
});

test('AC7: resolveAttack follows the combat rules', async ({ page }) => {
  await goHome(page);
  await waitForApi(page);
  const r = await page.evaluate(() => {
    const ra = window.oreheart.resolveAttack;
    const knight = { attack: 3, defense: 2, faction: 'ironclad' };
    return {
      example: ra({ attacker: knight, defender: { attack: 1, defense: 4, faction: 'wildwood' }, defenderStrikesBack: false, gangUp: 0 }),
      noType: ra({ attacker: knight, defender: { attack: 1, defense: 4, faction: 'ironclad' }, defenderStrikesBack: false, gangUp: 0 }),
      gang: ra({ attacker: knight, defender: { attack: 1, defense: 4, faction: 'ironclad' }, defenderStrikesBack: false, gangUp: 1 }),
      both: ra({ attacker: knight, defender: { attack: 3, defense: 3, faction: 'ironclad' }, defenderStrikesBack: true, gangUp: 0 }),
      flank: ra({ attacker: knight, defender: { attack: 3, defense: 3, faction: 'ironclad' }, defenderStrikesBack: false, gangUp: 0 }),
      survive: ra({ attacker: { attack: 1, defense: 3, faction: 'ironclad' }, defender: { attack: 2, defense: 4, faction: 'ironclad' }, defenderStrikesBack: true, gangUp: 0 }),
      woodCrystal: ra({ attacker: { attack: 2, defense: 2, faction: 'wildwood' }, defender: { attack: 1, defense: 3, faction: 'shimmerfolk' }, defenderStrikesBack: false, gangUp: 0 }),
      crystalIron: ra({ attacker: { attack: 2, defense: 2, faction: 'shimmerfolk' }, defender: { attack: 1, defense: 3, faction: 'ironclad' }, defenderStrikesBack: false, gangUp: 0 }),
      wrongWay: ra({ attacker: { attack: 2, defense: 2, faction: 'wildwood' }, defender: { attack: 1, defense: 3, faction: 'ironclad' }, defenderStrikesBack: false, gangUp: 0 }),
    };
  });
  expect(r.example).toMatchObject({ attackValue: 4, defenderKnockedOut: true, attackerKnockedOut: false });
  expect(r.noType).toMatchObject({ attackValue: 3, defenderKnockedOut: false, attackerKnockedOut: false });
  expect(r.gang).toMatchObject({ attackValue: 4, defenderKnockedOut: true });
  expect(r.both).toMatchObject({ defenderKnockedOut: true, attackerKnockedOut: true });
  expect(r.flank).toMatchObject({ defenderKnockedOut: true, attackerKnockedOut: false });
  expect(r.survive).toMatchObject({ defenderKnockedOut: false, attackerKnockedOut: false });
  expect(r.woodCrystal).toMatchObject({ attackValue: 3, defenderKnockedOut: true });
  expect(r.crystalIron).toMatchObject({ attackValue: 3, defenderKnockedOut: true });
  expect(r.wrongWay).toMatchObject({ attackValue: 2, defenderKnockedOut: false });
});

test('AC8: mode numbers and gold rewards match the design document', async ({ page }) => {
  await goHome(page);
  await waitForApi(page);
  const r = await page.evaluate(() => ({
    modes: window.oreheart.modes,
    gold: ['easy', 'normal', 'hard'].map((d) => [window.oreheart.goldReward(d, true), window.oreheart.goldReward(d, false)]),
  }));
  expect(r.modes.quick).toMatchObject({ hearts: 5, siteAmount: 15, kingdomTarget: 10 });
  expect(r.modes.standard).toMatchObject({ hearts: 10, siteAmount: 30, kingdomTarget: 15 });
  expect(r.modes.epic).toMatchObject({ hearts: 15, siteAmount: 50, kingdomTarget: 20 });
  expect(r.gold).toEqual([[10, 5], [20, 10], [35, 17]]);
});

// ---------- AC9–AC23: match ----------

test('AC9: Play screen options and mulligan dialog', async ({ page }) => {
  await goHome(page, 'seed=1&first=you&ai=off');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const deck = page.getByLabel('Deck');
  for (const d of ['Wildwood Starter', 'Shimmerfolk Starter', 'Ironclad Starter']) {
    await expect(deck.locator('option', { hasText: d })).toHaveCount(1);
  }
  for (const m of ['Quick Battle', 'Standard', 'Epic War', 'Easy', 'Normal', 'Hard']) {
    await expect(page.getByRole('radio', { name: new RegExp(`^${m}`) })).toHaveCount(1);
  }
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const dialog = await startMatch(page, { keep: false });
  await expect(dialog.getByTestId('mulligan-card')).toHaveCount(4);
  await dialog.getByRole('button', { name: 'Keep Hand' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('turn-banner')).toHaveText(/Your Turn/, { timeout: 20_000 });
});

test('AC10: mulligan redraw keeps 4 cards and happens only once', async ({ page }) => {
  await goHome(page, 'seed=2&first=you&ai=off');
  const dialog = await startMatch(page, { keep: false });
  const cards = dialog.getByTestId('mulligan-card');
  await cards.nth(0).click();
  await cards.nth(1).click();
  await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Redraw Selected' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('turn-banner')).toHaveText(/Your Turn/, { timeout: 20_000 });
  await expect(handCards(page)).toHaveCount(5); // 4 after redraw + 1 turn draw
  await endTurnAndWait(page);
  await expect(page.getByRole('heading', { name: 'Your Starting Hand' })).toHaveCount(0);
});

test('AC11: board layout, sites and hearts in Quick Battle', async ({ page }) => {
  await goHome(page, 'seed=3&first=you&ai=off');
  await startMatch(page);
  await expect(page.getByRole('grid', { name: 'Board' })).toBeVisible();
  await expect(page.locator('[data-testid^="tile-"]')).toHaveCount(49);
  for (let r = 1; r <= 7; r++) for (let c = 1; c <= 7; c++) await expect(tile(page, r, c)).toHaveCount(1);
  await expect.poll(() => tile(page, 4, 2).evaluate((el) => (el.textContent || '') + ' ' + (el.getAttribute('aria-label') || ''))).toContain('Forest');
  await expect.poll(() => tile(page, 4, 4).evaluate((el) => (el.textContent || '') + ' ' + (el.getAttribute('aria-label') || ''))).toContain('Crystal Mine');
  await expect.poll(() => tile(page, 4, 6).evaluate((el) => (el.textContent || '') + ' ' + (el.getAttribute('aria-label') || ''))).toContain('Iron Mine');
  for (const s of ['forest', 'crystal', 'iron']) await expectNum(page.getByTestId(`site-${s}`), 15);
  await expect(tile(page, 4, 2).getByTestId('site-forest')).toHaveCount(1);
  await expect(tile(page, 4, 4).getByTestId('site-crystal')).toHaveCount(1);
  await expect(tile(page, 4, 6).getByTestId('site-iron')).toHaveCount(1);
  await expectNum(page.getByTestId('hearts-enemy'), 5);
  await expectNum(page.getByTestId('hearts-you'), 5);
  for (const b of ['Move', 'Attack', 'Gather', 'Build', 'Turn', 'Upgrade', 'End Turn', 'Undo', 'Hint', 'Menu']) {
    await expect(page.getByRole('button', { name: b, exact: true })).toBeVisible();
  }
});

test('AC12: Standard mode uses 30-resource sites and 10 hearts', async ({ page }) => {
  await goHome(page, 'seed=4&first=you&ai=off');
  await startMatch(page, { mode: 'Standard' });
  for (const s of ['forest', 'crystal', 'iron']) await expectNum(page.getByTestId(`site-${s}`), 30);
  await expectNum(page.getByTestId('hearts-enemy'), 10);
  await expectNum(page.getByTestId('hearts-you'), 10);
});

test('AC13: first player starts turn 1 with 3/3/3 and 5 cards', async ({ page }) => {
  await goHome(page, 'seed=5&first=you&ai=off');
  await startMatch(page);
  await expectNum(page.getByTestId('res-wood'), 3);
  await expectNum(page.getByTestId('res-crystal'), 3);
  await expectNum(page.getByTestId('res-iron'), 3);
  await expect(handCards(page)).toHaveCount(5);
  await expectNum(page.getByTestId('deck-count'), 25);
});

test('AC14: second player gets +1 Crystal', async ({ page }) => {
  await goHome(page, 'seed=6&first=enemy&ai=off');
  await startMatch(page);
  await expectNum(page.getByTestId('res-wood'), 3);
  await expectNum(page.getByTestId('res-crystal'), 4);
  await expectNum(page.getByTestId('res-iron'), 3);
});

test('AC15: summoning a creature onto a home-row tile pays its cost', async ({ page }) => {
  await goHome(page, `seed=7&first=you&ai=off&${TEST_HAND}`);
  await startMatch(page);
  await handCard(page, 'acorn-sprout').click();
  await expect(tile(page, 6, 1)).toHaveAttribute('data-highlight', 'summon');
  await expect(tile(page, 7, 7)).toHaveAttribute('data-highlight', 'summon');
  await expect(tile(page, 5, 1)).not.toHaveAttribute('data-highlight', 'summon');
  await expect(tile(page, 3, 1)).not.toHaveAttribute('data-highlight', 'summon');
  await tile(page, 3, 1).click();
  await expect(unitIn(page, 3, 1)).toHaveCount(0);
  await tile(page, 6, 1).click();
  const unit = unitIn(page, 6, 1);
  await expect(unit).toHaveAttribute('data-owner', 'you');
  await expect(unit).toHaveAttribute('data-card', 'acorn-sprout');
  await expectNum(page.getByTestId('res-wood'), 2);
  await expect(page.locator('[data-testid="hand-card"][data-card="acorn-sprout"]')).toHaveCount(0);
  await expect(handCards(page)).toHaveCount(4);
});

test('AC16: unaffordable cards are disabled and cannot be played', async ({ page }) => {
  await goHome(page, `seed=8&first=you&ai=off&res=0,0,0&${TEST_HAND}`);
  await startMatch(page);
  await expectNum(page.getByTestId('res-wood'), 1);
  const turtle = handCard(page, 'mossy-turtle');
  await expect(turtle).toHaveAttribute('aria-disabled', 'true');
  await expect(handCard(page, 'acorn-sprout')).not.toHaveAttribute('aria-disabled', 'true');
  await turtle.click({ force: true });
  await tile(page, 6, 2).click();
  await expect(unitIn(page, 6, 2)).toHaveCount(0);
  await expectNum(page.getByTestId('res-wood'), 1);
  await expect(page.locator('[data-testid="hand-card"][data-card="mossy-turtle"]')).toHaveCount(1);
});

test('AC17: Undo reverts a summon and refunds the cost', async ({ page }) => {
  await goHome(page, `seed=9&first=you&ai=off&${TEST_HAND}`);
  await startMatch(page);
  await handCard(page, 'acorn-sprout').click();
  await tile(page, 6, 1).click();
  await expect(unitIn(page, 6, 1)).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(unitIn(page, 6, 1)).toHaveCount(0);
  await expectNum(page.getByTestId('res-wood'), 3);
  await expect(page.locator('[data-testid="hand-card"][data-card="acorn-sprout"]')).toHaveCount(1);
  await expect(handCards(page)).toHaveCount(5);
});

test('AC18: creatures wait a turn, then move and gather', async ({ page }) => {
  test.setTimeout(90_000);
  await goHome(page, `seed=10&first=you&ai=off&${TEST_HAND}`);
  await startMatch(page);
  await handCard(page, 'acorn-sprout').click();
  await tile(page, 6, 1).click();
  await expect(unitIn(page, 6, 1)).toHaveCount(1);
  // Summoning sickness: no move highlight this turn
  await unitIn(page, 6, 1).click();
  await expect(tile(page, 5, 1)).not.toHaveAttribute('data-highlight', 'move');

  await endTurnAndWait(page);
  await unitIn(page, 6, 1).click();
  await expect(tile(page, 5, 1)).toHaveAttribute('data-highlight', 'move');
  await tile(page, 5, 1).click();
  await expect(unitIn(page, 5, 1)).toHaveAttribute('data-card', 'acorn-sprout');
  await expect(unitIn(page, 6, 1)).toHaveCount(0);

  await endTurnAndWait(page);
  const wood = await num(page.getByTestId('res-wood'));
  const forest = await num(page.getByTestId('site-forest'));
  await unitIn(page, 5, 1).click();
  await page.getByRole('button', { name: 'Gather', exact: true }).click();
  await expectNum(page.getByTestId('res-wood'), wood + 1);
  await expectNum(page.getByTestId('site-forest'), forest - 1);
  await expect(unitIn(page, 5, 1)).toHaveAttribute('data-acted', 'true');
});

test('AC19: End Turn hands play to the AI, which summons creatures', async ({ page }) => {
  test.setTimeout(90_000);
  await goHome(page, 'seed=11&first=you');
  await startMatch(page, { difficulty: 'Normal' });
  const hand = await handCards(page).count();
  const deck = await num(page.getByTestId('deck-count'));
  const crystal = await num(page.getByTestId('res-crystal'));
  const iron = await num(page.getByTestId('res-iron'));
  await endTurnAndWait(page);
  await expect(handCards(page)).toHaveCount(hand + 1);
  await expectNum(page.getByTestId('deck-count'), deck - 1);
  await expectNum(page.getByTestId('res-crystal'), crystal + 1);
  await expectNum(page.getByTestId('res-iron'), iron + 1);
  let enemyUnits = await page.locator('[data-testid="unit"][data-owner="enemy"]').count();
  if (enemyUnits === 0) {
    await endTurnAndWait(page);
    enemyUnits = await page.locator('[data-testid="unit"][data-owner="enemy"]').count();
  }
  expect(enemyUnits).toBeGreaterThanOrEqual(1);
});

test('AC20: hand size never exceeds 8', async ({ page }) => {
  test.setTimeout(120_000);
  await goHome(page, 'seed=12&first=you&ai=off');
  await startMatch(page);
  await expect(handCards(page)).toHaveCount(5);
  for (const expected of [6, 7, 8, 8, 8]) {
    await endTurnAndWait(page);
    await expect(handCards(page)).toHaveCount(expected);
  }
});

test('AC21: Kingdom victory awards gold', async ({ page }) => {
  await goHome(page, 'seed=13&first=you&ai=off&res=9,9,9');
  await expectNum(page.getByTestId('gold'), 50);
  await startMatch(page, { waitYourTurn: false });
  await expect(page.getByRole('heading', { name: 'Victory!' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('+10 gold')).toBeVisible();
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await expect(page.getByRole('heading', { name: 'Oreheart', exact: true })).toBeVisible();
  await expectNum(page.getByTestId('gold'), 60);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
});

test('AC22: Surrender shows Defeat and pays half gold', async ({ page }) => {
  await goHome(page, 'seed=14&first=you&ai=off');
  await startMatch(page);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Surrender', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, surrender' }).click();
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible();
  await expect(page.getByText('+5 gold')).toBeVisible();
  await page.getByRole('button', { name: 'Main Menu' }).click();
  await expectNum(page.getByTestId('gold'), 55);
});

test('AC23: an unfinished match can be continued after reload', async ({ page }) => {
  await goHome(page, `seed=15&first=you&ai=off&${TEST_HAND}`);
  await startMatch(page);
  await handCard(page, 'acorn-sprout').click();
  await tile(page, 6, 1).click();
  await expect(unitIn(page, 6, 1)).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(unitIn(page, 6, 1)).toHaveAttribute('data-card', 'acorn-sprout');
  await expectNum(page.getByTestId('res-wood'), 2);
  await expect(handCards(page)).toHaveCount(4);
});

// ---------- AC24–AC28: meta screens ----------

test('AC24: Collection shows all cards and filters work', async ({ page }) => {
  await goHome(page);
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Collection', exact: true })).toBeVisible();
  const cards = page.getByTestId('collection-card');
  await expect(cards.filter({ visible: true })).toHaveCount(80);
  await expectNum(page.getByTestId('owned-total'), 90);
  await page.getByLabel('Faction').selectOption({ label: 'Shimmerfolk' });
  await expect(cards.filter({ visible: true })).toHaveCount(24);
  const factions = await cards.filter({ visible: true }).evaluateAll((els) => els.map((e) => e.getAttribute('data-faction')));
  expect(new Set(factions)).toEqual(new Set(['shimmerfolk']));
  await page.getByLabel('Faction').selectOption({ label: 'All' });
  await page.getByLabel('Type').selectOption({ label: 'Spell' });
  await expect(cards.filter({ visible: true })).toHaveCount(8);
  const spellFactions = await cards.filter({ visible: true }).evaluateAll((els) => els.map((e) => e.getAttribute('data-faction')));
  expect(new Set(spellFactions)).toEqual(new Set(['spell']));
});

test('AC25: buying a booster pack spends gold and adds 5 cards', async ({ page }) => {
  await goHome(page, 'seed=16');
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shop', exact: true })).toBeVisible();
  await expectNum(page.getByTestId('gold'), 50);
  const buy = page.getByRole('button', { name: 'Buy Booster Pack (50 gold)' });
  await buy.click();
  await page.getByRole('button', { name: 'Reveal All' }).click();
  await expect(page.getByTestId('pack-card')).toHaveCount(5);
  await expectNum(page.getByTestId('gold'), 0);
  await expect(buy).toBeDisabled();
  await page.reload();
  await expectNum(page.getByTestId('gold'), 0);
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expectNum(page.getByTestId('owned-total'), 95);
});

test('AC26: Deck Builder enforces copies and saves a 30-card deck', async ({ page }) => {
  test.setTimeout(90_000);
  await goHome(page);
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deck Builder', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New Deck' }).click();
  await page.getByLabel('Deck name').fill('My Test Deck');
  const addKnight = page.getByRole('button', { name: 'Add Tin Knight', exact: true });
  await addKnight.click();
  await addKnight.click();
  await expect(addKnight).toBeDisabled();
  await expect(page.getByTestId('deck-size')).toHaveText(/2\s*\/\s*30/);
  const save = page.getByRole('button', { name: 'Save Deck' });
  await expect(save).toBeDisabled();
  for (let i = 0; i < 60; i++) {
    if (/30\s*\/\s*30/.test((await page.getByTestId('deck-size').textContent()) || '')) break;
    await page.getByRole('button', { name: /^Add /, disabled: false }).first().click();
  }
  await expect(page.getByTestId('deck-size')).toHaveText(/30\s*\/\s*30/);
  await expect(page.getByRole('button', { name: /^Add /, disabled: false })).toHaveCount(0);
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('My Test Deck')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByLabel('Deck').locator('option', { hasText: 'My Test Deck' })).toHaveCount(1);
});

test('AC27: settings persist and Reset Progress restores the starting state', async ({ page }) => {
  await goHome(page, 'seed=17');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const sound = page.getByRole('checkbox', { name: 'Sound' });
  const music = page.getByRole('checkbox', { name: 'Music' });
  await expect(sound).toBeChecked();
  await expect(music).toBeChecked();
  await sound.uncheck();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Sound' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Music' })).toBeChecked();
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  // Spend gold, then reset
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.getByRole('button', { name: 'Buy Booster Pack (50 gold)' }).click();
  await expectNum(page.getByTestId('gold'), 0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset Progress' }).click();
  await page.getByRole('button', { name: 'Yes, reset' }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expectNum(page.getByTestId('gold'), 50);
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expectNum(page.getByTestId('owned-total'), 90);
});

test('AC28: How to Play tutorial steps through with Next and Previous', async ({ page }) => {
  await goHome(page);
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'How to Play', exact: true })).toBeVisible();
  await expect(page.getByText(/Step 1 of \d+/)).toBeVisible();
  const next = page.getByRole('button', { name: 'Next', exact: true });
  let found = false;
  for (let i = 0; i < 12; i++) {
    if (await page.getByRole('heading', { name: 'Combat', exact: true }).isVisible()) { found = true; break; }
    await next.click();
  }
  expect(found).toBe(true);
  const stepText = (await page.getByText(/Step \d+ of \d+/).textContent()) || '';
  const n = parseInt(stepText.match(/Step (\d+)/)[1], 10);
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByText(new RegExp(`Step ${n - 1} of`))).toBeVisible();
});

// ---------- AC29 / AC30: phone + helpers ----------

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('AC29: main menu and match screen fit a phone without horizontal scroll', async ({ page }) => {
    await goHome(page, 'seed=18&first=you&ai=off');
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await startMatch(page);
    overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole('grid', { name: 'Board' })).toBeInViewport();
    await expect(tile(page, 7, 7)).toBeInViewport();
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeInViewport();
    await expect(handCards(page).first()).toBeInViewport();
    await expect(page.getByTestId('res-wood')).toBeInViewport();
    const box = await tile(page, 4, 4).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(38);
  });
});

test('AC30: selecting a creature highlights moves and Hint gives a suggestion', async ({ page }) => {
  await goHome(page, `seed=19&first=you&ai=off&${TEST_HAND}`);
  await startMatch(page);
  await handCard(page, 'acorn-sprout').click();
  await tile(page, 6, 3).click();
  await expect(unitIn(page, 6, 3)).toHaveCount(1);
  await endTurnAndWait(page);
  await unitIn(page, 6, 3).click();
  await expect(tile(page, 5, 3)).toHaveAttribute('data-highlight', 'move');
  await expect(tile(page, 6, 2)).toHaveAttribute('data-highlight', 'move');
  await expect(tile(page, 6, 4)).toHaveAttribute('data-highlight', 'move');
  await expect(tile(page, 4, 3)).not.toHaveAttribute('data-highlight', 'move');
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  const status = page.getByRole('status').filter({ hasText: /\w+/ });
  await expect(status.first()).toBeVisible();
});
