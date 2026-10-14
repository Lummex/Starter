import { test, expect } from '@playwright/test';

async function openScreen(page, name) {
  await page.goto('/');
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

async function startBattle(page) {
  await openScreen(page, 'Play');
  await page.getByRole('button', { name: 'Start Battle' }).click();
  await expect(page.getByTestId('turn-indicator')).toHaveText('Your Turn', { timeout: 15000 });
}

async function numberOf(page, testId) {
  const txt = (await page.getByTestId(testId).textContent()) || '';
  return parseInt(txt.replace(/[^0-9-]/g, ''), 10);
}

test('AC1: app loads without errors and shows the main menu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await expect(page).toHaveTitle(/OreHeart/);
  await expect(page.getByRole('heading', { name: 'OreHeart', level: 1 })).toBeVisible();
  await expect(page.getByText('Gold: 300')).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('AC2: main menu navigation to every screen and back', async ({ page }) => {
  for (const name of ['Play', 'Collection', 'Deck Builder', 'Shop', 'How to Play', 'Settings']) {
    await openScreen(page, name);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'OreHeart', level: 1 })).toBeVisible();
  }
});

test('AC3: PWA manifest and service worker are present', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifestUrl = new URL(href, page.url()).toString();
  const res = await request.get(manifestUrl);
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m.name).toBe('OreHeart');
  expect(m.display).toBe('fullscreen');
  expect(m.orientation).toBe('portrait');
  const sizes = (m.icons || []).map((i) => i.sizes).join(' ');
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  const sw = await request.get('/sw.js');
  expect(sw.ok()).toBeTruthy();
});

test('AC4: play screen offers deck, difficulty and start', async ({ page }) => {
  await openScreen(page, 'Play');
  const deck = page.getByLabel('Deck', { exact: true });
  await expect(deck).toBeVisible();
  await expect(deck.locator('option', { hasText: 'Starter Deck' })).toHaveCount(1);
  await expect(page.getByRole('radio', { name: /Easy/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Normal/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /Hard/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Battle' })).toBeVisible();
});

test('AC5: battle starts with correct initial state', async ({ page }) => {
  await startBattle(page);
  for (const mine of ['Left Mine', 'Center Mine', 'Right Mine']) {
    await expect(page.getByText(mine, { exact: true }).first()).toBeVisible();
    await expect(page.locator(`[aria-label="${mine}"]`).first()).toHaveAttribute('data-control', 'none');
  }
  await expect(page.getByText(/Left.Center Pass/).first()).toBeVisible();
  await expect(page.getByText(/Center.Right Pass/).first()).toBeVisible();
  await expect(page.getByTestId('player-health')).toHaveText('25');
  await expect(page.getByTestId('enemy-health')).toHaveText('25');
  await expect(page.getByTestId('turn-number')).toHaveText('Turn 1');
  await expect(page.getByTestId('player-ore')).toHaveText('2');
  await expect(page.getByTestId('player-income')).toHaveText('+2');
  const hand = page.getByRole('region', { name: 'Your hand' });
  expect(await hand.getByRole('button').count()).toBeGreaterThanOrEqual(4);
  await expect(page.getByRole('button', { name: 'Your Center Mine slot 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible();
});

test('AC6: playing a creature places it and spends Ore', async ({ page }) => {
  await startBattle(page);
  const hand = page.getByRole('region', { name: 'Your hand' });
  const before = await hand.getByRole('button').count();
  const cost = (await hand.getByRole('button', { name: /, 1 Ore, Creature/ }).count()) > 0 ? 1 : 2;
  const card = hand.getByRole('button', { name: new RegExp(`, ${cost} Ore, Creature`) }).first();
  await expect(card).toBeVisible();
  await card.click();
  await page.getByRole('button', { name: 'Your Center Mine slot 1', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Your Center Mine slot 1: / })).toBeVisible();
  await expect(page.getByTestId('player-ore')).toHaveText(String(2 - cost));
  await expect(hand.getByRole('button')).toHaveCount(before - 1);
});

test('AC7: ending the turn lets the AI play and returns to the player', async ({ page }) => {
  await startBattle(page);
  await page.getByRole('button', { name: 'End Turn' }).click();
  await expect(page.getByTestId('turn-number')).toHaveText('Turn 2', { timeout: 30000 });
  await expect(page.getByTestId('turn-indicator')).toHaveText('Your Turn', { timeout: 30000 });
  expect(await numberOf(page, 'player-ore')).toBeGreaterThanOrEqual(4);
});

test('AC8: conceding shows Defeat and gives no gold', async ({ page }) => {
  await startBattle(page);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Concede', exact: true }).click();
  await expect(page.getByText('Concede this game?')).toBeVisible();
  await page.getByRole('button', { name: 'Concede', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Menu' }).click();
  await expect(page.getByRole('heading', { name: 'OreHeart', level: 1 })).toBeVisible();
  await expect(page.getByText('Gold: 300')).toBeVisible();
});

test('AC9: collection counts and filters', async ({ page }) => {
  await openScreen(page, 'Collection');
  await expect(page.getByText('Unique cards: 20 / 80')).toBeVisible();
  await expect(page.getByText('Total cards: 40')).toBeVisible();
  await expect(page.getByText('Showing 80 of 80 cards')).toBeVisible();
  await page.getByLabel('Faction', { exact: true }).selectOption('Fire');
  await expect(page.getByText('Showing 20 of 80 cards')).toBeVisible();
  await page.getByLabel('Rarity', { exact: true }).selectOption('Legendary');
  await expect(page.getByText('Showing 2 of 80 cards')).toBeVisible();
  await page.getByLabel('Faction', { exact: true }).selectOption('All');
  await expect(page.getByText('Showing 8 of 80 cards')).toBeVisible();
  await page.getByLabel('Rarity', { exact: true }).selectOption('All');
  await page.getByLabel('Owned only').check();
  await expect(page.getByText('Showing 20 of 80 cards')).toBeVisible();
});

test('AC10: deck builder rules, save and persistence', async ({ page }) => {
  await openScreen(page, 'Deck Builder');
  await expect(page.getByText('Decks (1/5)')).toBeVisible();
  await expect(page.getByText('Starter Deck').first()).toBeVisible();
  await page.getByRole('button', { name: 'New Deck' }).click();
  await page.getByLabel('Deck name').fill('Test Deck');
  const add = page.getByRole('button', { name: /^Add / }).first();
  await add.click();
  await add.click();
  await expect(page.getByText('Cards: 2/30')).toBeVisible();
  await add.click();
  await expect(page.getByText('Max 2 copies')).toBeVisible();
  await expect(page.getByText('Cards: 2/30')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Deck' })).toBeDisabled();
  await page.getByRole('button', { name: 'Auto-Fill' }).click();
  await expect(page.getByText('Cards: 30/30')).toBeVisible();
  await page.getByRole('button', { name: 'Save Deck' }).click();
  await expect(page.getByText('Decks (2/5)')).toBeVisible();
  await expect(page.getByText('Test Deck').first()).toBeVisible();
  await page.reload();
  await openScreen(page, 'Deck Builder');
  await expect(page.getByText('Decks (2/5)')).toBeVisible();
  await expect(page.getByText('Test Deck').first()).toBeVisible();
});

test('AC11: buying a booster pack', async ({ page }) => {
  await openScreen(page, 'Shop');
  await expect(page.getByText('100 Gold').first()).toBeVisible();
  await page.getByRole('button', { name: /Buy Booster Pack/ }).click();
  await expect(page.getByRole('button', { name: 'Reveal card 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal All' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Gold: 200')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Gold: 200')).toBeVisible();
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByText('Total cards: 45')).toBeVisible();
});

test('AC12: how to play explains the core concepts with pictures', async ({ page }) => {
  await openScreen(page, 'How to Play');
  for (const h of ['Mines', 'Ore', 'Walls', 'Passes']) {
    await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
  }
  expect(await page.getByRole('img').count()).toBeGreaterThanOrEqual(4);
});

test('AC13: settings persist and reset progress works', async ({ page }) => {
  await openScreen(page, 'Settings');
  const sound = page.getByLabel('Sound effects');
  await expect(sound).toBeChecked();
  await sound.uncheck();
  await page.reload();
  await openScreen(page, 'Settings');
  await expect(page.getByLabel('Sound effects')).not.toBeChecked();

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Shop', exact: true }).click();
  await page.getByRole('button', { name: /Buy Booster Pack/ }).click();
  await page.getByRole('button', { name: 'Reveal All' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Gold: 200')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset Progress' }).click();
  await expect(page.getByText('Reset all progress? This cannot be undone.')).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.goto('/');
  await expect(page.getByText('Gold: 300')).toBeVisible();
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByText('Total cards: 40')).toBeVisible();
});

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('AC14: menu and battle fit a phone screen', async ({ page }) => {
    await page.goto('/');
    for (const name of ['Play', 'Collection', 'Deck Builder', 'Shop', 'How to Play', 'Settings']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    await startBattle(page);
    await expect(page.getByRole('button', { name: 'End Turn' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Your Left Mine slot 1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Your Right Mine slot 1', exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
