import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// A valid 1x1 PNG, used as a fake "photo" for the Photo Count page.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

async function goTo(page, linkName) {
  await page.getByRole('navigation').getByRole('link', { name: linkName, exact: true }).click();
}

async function addPart(page, name, qty, low = 0) {
  await page.getByRole('textbox', { name: 'Part name', exact: true }).fill(name);
  await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill(String(qty));
  await page.getByRole('spinbutton', { name: 'Low-stock alert at', exact: true }).fill(String(low));
  await page.getByRole('button', { name: 'Add part', exact: true }).click();
}

function partRow(page, name) {
  return page.getByRole('row').filter({ hasText: name });
}

// Returns the "On truck" cell for a part on the Inventory page.
async function onTruckCell(page, name) {
  await expect(page.getByRole('columnheader', { name: 'On truck', exact: true })).toBeVisible();
  const headers = await page.getByRole('columnheader').allTextContents();
  const idx = headers.findIndex((h) => h.trim() === 'On truck');
  expect(idx).toBeGreaterThanOrEqual(0);
  return partRow(page, name).locator('td').nth(idx);
}

async function expectOnTruck(page, name, qty) {
  const cell = await onTruckCell(page, name);
  await expect(cell).toHaveText(String(qty));
}

async function usePartsRecord(page, { job = '', bad = false, text }) {
  await goTo(page, 'Use Parts');
  await expect(page.getByRole('heading', { level: 1, name: 'Use Parts' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Job number', exact: true }).fill(job);
  if (bad) {
    await page.getByRole('radio', { name: 'Bad part (not usable)' }).check();
  } else {
    await page.getByRole('radio', { name: 'Used on job' }).check();
  }
  await page.getByRole('textbox', { name: 'Parts used', exact: true }).fill(text);
  await page.getByRole('button', { name: 'Record', exact: true }).click();
}

test('AC1: app loads with empty inventory and no errors', async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/favicon/i.test(msg.text())) consoleErrors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Truck Inventory', exact: true })).toBeVisible();
  await expect(page.getByRole('banner').getByText('Chas Roberts Truck Inventory').first()).toBeVisible();
  await expect(page.getByText('Total items on truck: 0')).toBeVisible();
  await expect(page.getByText('No parts yet. Add your first part above.')).toBeVisible();

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('AC2: navigation links open each page', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto('/');
  const pages = [
    ['Parts List', 'Parts List'],
    ['Quick Add', 'Quick Add'],
    ['Photo Count', 'Photo Count'],
    ['Use Parts', 'Use Parts'],
    ['Restock', 'Restock List'],
    ['Reports', 'Reports'],
    ['Inventory', 'Truck Inventory'],
  ];
  for (const [link, heading] of pages) {
    await goTo(page, link);
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
  }
  expect(pageErrors).toEqual([]);
});

test('AC3: adding a part shows it in the table and updates the total', async ({ page }) => {
  await page.goto('/');
  await addPart(page, 'Angle stop', 3, 1);
  await expect(page.getByText('Added 3 to Angle stop (now 3).')).toBeVisible();
  await expect(partRow(page, 'Angle stop')).toHaveCount(1);
  await expectOnTruck(page, 'Angle stop', 3);
  await expect(page.getByText('Total items on truck: 3')).toBeVisible();

  await addPart(page, 'Copper coupling', 10, 2);
  await expect(page.getByText('Total items on truck: 13')).toBeVisible();
  await expect(page.getByText('No parts yet. Add your first part above.')).toHaveCount(0);
});

test('AC4: add form validates name and quantity', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Add part', exact: true }).click();
  await expect(page.getByText('Please enter a part name.')).toBeVisible();

  await page.getByRole('textbox', { name: 'Part name', exact: true }).fill('Angle stop');
  await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('-1');
  await page.getByRole('button', { name: 'Add part', exact: true }).click();
  await expect(page.getByText('Quantity must be a whole number of 0 or more.')).toBeVisible();

  await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('');
  await page.getByRole('button', { name: 'Add part', exact: true }).click();
  await expect(page.getByText('Quantity must be a whole number of 0 or more.')).toBeVisible();

  await expect(page.getByText('Total items on truck: 0')).toBeVisible();
  await expect(page.getByText('No parts yet. Add your first part above.')).toBeVisible();
});

test('AC5: adding a matching name merges quantities', async ({ page }) => {
  await page.goto('/');
  await addPart(page, 'Angle stop', 2, 1);
  await expect(page.getByText('Added 2 to Angle stop (now 2).')).toBeVisible();
  await addPart(page, 'angle stops', 3, 1);
  await expect(page.getByText('Added 3 to Angle stop (now 5).')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: /angle stop/i })).toHaveCount(1);
  await expectOnTruck(page, 'Angle stop', 5);
  await expect(page.getByText('Total items on truck: 5')).toBeVisible();
});

test('AC6: edit a part quantity and delete a part', async ({ page }) => {
  await page.goto('/');
  await addPart(page, 'Angle stop', 5, 1);
  await addPart(page, 'Copper coupling', 4, 1);
  await expect(page.getByText('Total items on truck: 9')).toBeVisible();

  await partRow(page, 'Angle stop').getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Edit part' })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Part name', exact: true })).toHaveValue('Angle stop');
  await dialog.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('8');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectOnTruck(page, 'Angle stop', 8);
  await expect(page.getByText('Total items on truck: 12')).toBeVisible();

  page.once('dialog', async (d) => {
    expect(d.message()).toContain('Delete Copper coupling from the truck?');
    await d.accept();
  });
  await partRow(page, 'Copper coupling').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(partRow(page, 'Copper coupling')).toHaveCount(0);
  await expect(page.getByText('Total items on truck: 8')).toBeVisible();
});

test('AC7: search filters the parts table', async ({ page }) => {
  await page.goto('/');
  await addPart(page, 'Angle stop', 2, 0);
  await addPart(page, 'Copper coupling', 4, 0);
  const search = page.getByPlaceholder('Search parts');
  await search.fill('COPPER');
  await expect(partRow(page, 'Copper coupling')).toHaveCount(1);
  await expect(partRow(page, 'Angle stop')).toHaveCount(0);
  await search.fill('zzz-nothing');
  await expect(page.getByText('No parts match your search.')).toBeVisible();
  await search.fill('');
  await expect(partRow(page, 'Angle stop')).toHaveCount(1);
  await expect(partRow(page, 'Copper coupling')).toHaveCount(1);
});

test('AC8: low parts show a Low badge', async ({ page }) => {
  await page.goto('/');
  await addPart(page, 'Angle stop', 1, 2);
  await addPart(page, 'Copper coupling', 10, 2);
  await expect(partRow(page, 'Angle stop').getByText('Low', { exact: true })).toBeVisible();
  await expect(partRow(page, 'Copper coupling').getByText('Low', { exact: true })).toHaveCount(0);
});

test('AC9: inventory persists after reload', async ({ page }) => {
  await page.goto('/');
  await addPart(page, 'Angle stop', 7, 1);
  await expect(page.getByText('Total items on truck: 7')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Truck Inventory', exact: true })).toBeVisible();
  await expectOnTruck(page, 'Angle stop', 7);
  await expect(page.getByText('Total items on truck: 7')).toBeVisible();
});

test('AC10: Quick Add reads a spoken-style list and saves it', async ({ page }) => {
  await page.goto('/');
  await addPart(page, 'Angle stop', 1, 0);
  await goTo(page, 'Quick Add');
  await expect(page.getByRole('heading', { level: 1, name: 'Quick Add' })).toBeVisible();

  await page
    .getByRole('textbox', { name: 'What do you want to add?' })
    .fill('add 3 angle stops and 2 90 degree elbows');
  await page.getByRole('button', { name: 'Read list', exact: true }).click();

  await expect(page.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible();
  const angleRow = page.getByRole('row').filter({ hasText: /angle stop/i });
  await expect(angleRow).toHaveCount(1);
  await expect(angleRow).toContainText('3');
  await expect(angleRow).toContainText('Already on truck');
  const elbowRow = page.getByRole('row').filter({ hasText: /90 degree elbow/i });
  await expect(elbowRow).toHaveCount(1);
  await expect(elbowRow).toContainText('2');
  await expect(elbowRow).toContainText('New part');

  await page.getByRole('button', { name: 'Save to inventory', exact: true }).click();
  await expect(page.getByText('Saved 2 parts to inventory.')).toBeVisible();

  await goTo(page, 'Inventory');
  await expectOnTruck(page, 'Angle stop', 4);
  await expectOnTruck(page, '90 degree elbow', 2);
  await expect(page.getByText('Total items on truck: 6')).toBeVisible();
});

test('AC11: voice button or unsupported notice is shown', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto('/');
  for (const link of ['Quick Add', 'Use Parts']) {
    await goTo(page, link);
    await expect(
      page
        .getByRole('button', { name: 'Start talking' })
        .or(page.getByText("Voice input isn't supported in this browser. Type instead."))
        .first()
    ).toBeVisible();
  }
  expect(pageErrors).toEqual([]);
});

test('AC12: Photo Count tap-to-count adds parts to inventory', async ({ page }) => {
  await page.goto('/');
  await goTo(page, 'Photo Count');
  await expect(page.getByRole('heading', { level: 1, name: 'Photo Count' })).toBeVisible();

  await page.getByLabel('Take or choose a photo').setInputFiles({
    name: 'bin.png',
    mimeType: 'image/png',
    buffer: PNG_1PX,
  });
  const photo = page.getByRole('img', { name: 'Your photo' });
  await expect(photo).toBeVisible();
  await expect(page.getByText('Tap each part in the photo to count it.')).toBeVisible();
  await expect(page.getByText('Counted: 0', { exact: true })).toBeVisible();

  await photo.click({ position: { x: 20, y: 20 } });
  await photo.click({ position: { x: 60, y: 60 } });
  await photo.click({ position: { x: 100, y: 30 } });
  await expect(page.getByText('Counted: 3', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Undo last tap' }).click();
  await expect(page.getByText('Counted: 2', { exact: true })).toBeVisible();

  await page.getByRole('combobox', { name: 'Part name' }).or(page.getByRole('textbox', { name: 'Part name' })).first().fill('Copper coupling');
  await page.getByRole('button', { name: 'Add to inventory', exact: true }).click();
  await expect(page.getByText('Added 2 to Copper coupling (now 2).')).toBeVisible();

  await goTo(page, 'Inventory');
  await expectOnTruck(page, 'Copper coupling', 2);
  await expect(page.getByText('Total items on truck: 2')).toBeVisible();
});

test('AC13: using parts on a job subtracts them from the truck', async ({ page }) => {
  await page.goto('/');
  await addPart(page, 'Angle stop', 5, 0);
  await addPart(page, '90 degree elbow', 6, 0);

  await usePartsRecord(page, {
    job: '1001',
    text: "I'm using two angle stops and two 90 degree elbows",
  });
  await expect(page.getByText(/Recorded for job 1001:/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Parts used', exact: true })).toHaveValue('');

  await goTo(page, 'Inventory');
  await expectOnTruck(page, 'Angle stop', 3);
  await expectOnTruck(page, '90 degree elbow', 4);
  await expect(page.getByText('Total items on truck: 7')).toBeVisible();
});

test('AC14: Use Parts refuses invalid records and changes nothing', async ({ page }) => {
  await page.goto('/');
  await addPart(page, 'Angle stop', 1, 0);

  await usePartsRecord(page, { job: '', text: '1 angle stop' });
  await expect(page.getByText('Please enter a job number.')).toBeVisible();

  await usePartsRecord(page, { job: '1001', text: '1 widget' });
  await expect(page.getByText(/Not on your truck: widget/)).toBeVisible();

  await usePartsRecord(page, { job: '1001', text: '2 angle stops' });
  await expect(page.getByText('Not enough Angle stop on the truck (have 1, need 2).')).toBeVisible();

  await usePartsRecord(page, { job: '1001', text: '' });
  await expect(page.getByText('Please list the parts you used.')).toBeVisible();

  await goTo(page, 'Inventory');
  await expectOnTruck(page, 'Angle stop', 1);
  await expect(page.getByText('Total items on truck: 1')).toBeVisible();
});

test('AC15: bad part goes to restock list, not to the job, and can be replaced', async ({ page }) => {
  await page.goto('/');
  await addPart(page, 'Angle stop', 5, 0);

  await usePartsRecord(page, { job: '1001', bad: true, text: '1 angle stop' });
  await expect(page.getByText('Recorded bad part: 1 × Angle stop. Added to your restock list.')).toBeVisible();

  await goTo(page, 'Inventory');
  await expectOnTruck(page, 'Angle stop', 4);

  await goTo(page, 'Reports');
  const badRow = page.getByRole('row').filter({ hasText: 'Bad part' });
  await expect(badRow).toHaveCount(1);
  await expect(badRow).toContainText('Angle stop');
  await expect(badRow).toContainText('—');
  await expect(badRow).not.toContainText('1001');

  await goTo(page, 'Restock');
  await expect(page.getByRole('heading', { name: 'Replace bad parts' })).toBeVisible();
  await expect(page.getByText(/Angle stop\s*[×x]\s*1/)).toBeVisible();
  await page.getByRole('button', { name: 'Mark replaced' }).click();
  await expect(page.getByText('No bad parts to replace.')).toBeVisible();

  await goTo(page, 'Inventory');
  await expectOnTruck(page, 'Angle stop', 5);
});

test('AC16: Restock page lists parts running low', async ({ page }) => {
  await page.goto('/');
  await goTo(page, 'Restock');
  await expect(page.getByText('Nothing is running low.')).toBeVisible();
  await expect(page.getByText('No bad parts to replace.')).toBeVisible();

  await goTo(page, 'Inventory');
  await addPart(page, 'Angle stop', 1, 2);
  await addPart(page, 'Copper coupling', 10, 2);

  await goTo(page, 'Restock');
  await expect(page.getByRole('heading', { name: 'Running low' })).toBeVisible();
  await expect(page.getByText('Angle stop: have 1, alert at 2')).toBeVisible();
  await expect(page.getByText(/Copper coupling: have/)).toHaveCount(0);
  await expect(page.getByText('Nothing is running low.')).toHaveCount(0);
});

test('AC17: Reports shows history and filters by job number', async ({ page }) => {
  await page.goto('/');
  await goTo(page, 'Reports');
  await expect(page.getByText('No history yet.')).toBeVisible();

  await goTo(page, 'Inventory');
  await addPart(page, 'Angle stop', 10, 0);
  await addPart(page, 'Copper coupling', 10, 0);
  await usePartsRecord(page, { job: '1001', text: '3 angle stops, 1 copper coupling' });
  await expect(page.getByText(/Recorded for job 1001:/)).toBeVisible();
  await usePartsRecord(page, { job: '2002', text: '2 angle stops' });
  await expect(page.getByText(/Recorded for job 2002:/)).toBeVisible();
  await usePartsRecord(page, { job: '1001', bad: true, text: '1 copper coupling' });
  await expect(page.getByText(/Recorded bad part/)).toBeVisible();

  await goTo(page, 'Reports');
  for (const h of ['Date', 'Type', 'Part', 'Qty', 'Job number']) {
    await expect(page.getByRole('columnheader', { name: h, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('row').filter({ hasText: 'Used on job' })).toHaveCount(3);
  await expect(page.getByRole('row').filter({ hasText: 'Added' })).toHaveCount(2);
  await expect(page.getByRole('row').filter({ hasText: 'Bad part' })).toHaveCount(1);

  await page.getByRole('textbox', { name: 'Filter by job number' }).fill('1001');
  await expect(page.getByText('Parts used on job 1001: 4')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Used on job' })).toHaveCount(2);
  await expect(page.getByRole('row').filter({ hasText: '2002' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Bad part' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Added' })).toHaveCount(0);
});

test('AC18: Reports downloads inventory and history CSV files', async ({ page }) => {
  await page.goto('/');
  await addPart(page, 'Angle stop', 4, 1);
  await goTo(page, 'Reports');

  const [invDl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download inventory CSV' }).click(),
  ]);
  expect(invDl.suggestedFilename()).toBe('truck-inventory.csv');
  const inv = fs.readFileSync(await invDl.path(), 'utf8').replace(/^﻿/, '');
  const invLines = inv.split(/\r?\n/).filter((l) => l.trim() !== '');
  expect(invLines[0]).toBe('Part,Category,On truck,Low at');
  expect(invLines[1]).toContain('Angle stop');
  expect(invLines[1]).toContain('4');

  const [histDl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download history CSV' }).click(),
  ]);
  expect(histDl.suggestedFilename()).toBe('truck-history.csv');
  const hist = fs.readFileSync(await histDl.path(), 'utf8').replace(/^﻿/, '');
  const histLines = hist.split(/\r?\n/).filter((l) => l.trim() !== '');
  expect(histLines[0]).toBe('Date,Type,Part,Qty,Job number');
  expect(histLines.length).toBeGreaterThanOrEqual(2);
  expect(histLines[1]).toContain('Added');
  expect(histLines[1]).toContain('Angle stop');
});

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('AC19: works on a phone-sized screen', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Truck Inventory', exact: true })).toBeVisible();

    await goTo(page, 'Reports');
    await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible();
    await goTo(page, 'Inventory');
    await expect(page.getByRole('heading', { level: 1, name: 'Truck Inventory', exact: true })).toBeVisible();

    await addPart(page, 'Angle stop', 2, 0);
    await expect(page.getByText('Total items on truck: 2')).toBeVisible();

    let overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await goTo(page, 'Parts List');
    await expect(page.getByRole('heading', { level: 1, name: 'Parts List', exact: true })).toBeVisible();
    await expect(page.getByText('Total items: 2')).toBeVisible();

    overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    expect(pageErrors).toEqual([]);
  });
});

// Returns the cell in a given column for a part's row on the Parts List page.
async function partsListCell(page, name, column) {
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toHaveCount(1);
  const table = page.getByRole('table').filter({ has: row });
  const headers = await table.getByRole('columnheader').allTextContents();
  const idx = headers.findIndex((h) => h.trim() === column);
  expect(idx).toBeGreaterThanOrEqual(0);
  return row.locator('td').nth(idx);
}

async function addPartWithCategory(page, name, qty, low, category) {
  await page.getByRole('textbox', { name: 'Part name', exact: true }).fill(name);
  await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill(String(qty));
  await page.getByRole('spinbutton', { name: 'Low-stock alert at', exact: true }).fill(String(low));
  await page.getByRole('combobox', { name: 'Category', exact: true }).selectOption(category);
  await page.getByRole('button', { name: 'Add part', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: `to ${name}` })).toBeVisible();
}

test('AC20: Parts List shows every part grouped by category with totals', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto('/');
  await goTo(page, 'Parts List');
  await expect(page.getByRole('heading', { level: 1, name: 'Parts List', exact: true })).toBeVisible();
  await expect(page.getByText('No parts yet. Add parts on the Inventory page.')).toBeVisible();
  await expect(page.getByText('Different parts: 0')).toBeVisible();
  await expect(page.getByText('Total items: 0')).toBeVisible();

  await goTo(page, 'Inventory');
  await addPartWithCategory(page, 'Angle stop', 3, 1, 'Plumbing');
  await addPartWithCategory(page, 'Copper coupling', 2, 2, 'Plumbing');
  await addPartWithCategory(page, 'Capacitor', 1, 0, 'Air conditioning');
  await addPartWithCategory(page, 'Wire nut', 0, 0, 'Electrical');

  await goTo(page, 'Parts List');
  await expect(page.getByRole('heading', { level: 1, name: 'Parts List', exact: true })).toBeVisible();
  await expect(page.getByText('No parts yet. Add parts on the Inventory page.')).toHaveCount(0);
  await expect(page.getByText('Different parts: 4')).toBeVisible();
  await expect(page.getByText('Total items: 6')).toBeVisible();

  await expect(page.getByRole('heading', { level: 2, name: 'Plumbing', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Air conditioning', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Electrical', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Other', exact: true })).toHaveCount(0);

  await expect(page.getByText('Plumbing total: 5 items')).toBeVisible();
  await expect(page.getByText('Air conditioning total: 1 item', { exact: true })).toBeVisible();
  await expect(page.getByText('Electrical total: 0 items')).toBeVisible();

  // Wire nut has 0 left but is still listed.
  await expect(await partsListCell(page, 'Wire nut', 'On truck')).toHaveText('0');
  await expect(await partsListCell(page, 'Wire nut', 'Status')).toHaveText('Out');
  await expect(await partsListCell(page, 'Copper coupling', 'Status')).toHaveText('Low');
  await expect(await partsListCell(page, 'Angle stop', 'Status')).toHaveText('OK');
  await expect(await partsListCell(page, 'Angle stop', 'On truck')).toHaveText('3');
  await expect(await partsListCell(page, 'Angle stop', 'Low at')).toHaveText('1');

  // Angle stop and Copper coupling are in the same (Plumbing) table, A→Z.
  const plumbingTable = page.getByRole('table').filter({ hasText: 'Angle stop' });
  await expect(plumbingTable.getByRole('row').filter({ hasText: 'Copper coupling' })).toHaveCount(1);
  await expect(plumbingTable.getByRole('row').filter({ hasText: 'Capacitor' })).toHaveCount(0);
  const plumbingText = await plumbingTable.innerText();
  expect(plumbingText.indexOf('Angle stop')).toBeLessThan(plumbingText.indexOf('Copper coupling'));

  // Persists after reload.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Parts List', exact: true })).toBeVisible();
  await expect(page.getByText('Different parts: 4')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('AC21: Parts List updates after use and can be searched', async ({ page }) => {
  await page.goto('/');
  await addPart(page, 'Angle stop', 5, 1);
  await addPart(page, '90 degree elbow', 4, 1);
  await usePartsRecord(page, { job: '1001', text: '2 angle stops and 2 90 degree elbows' });
  await expect(page.getByText(/Recorded for job 1001/)).toBeVisible();

  await goTo(page, 'Parts List');
  await expect(page.getByRole('heading', { level: 1, name: 'Parts List', exact: true })).toBeVisible();
  await expect(page.getByText('Total items: 5')).toBeVisible();
  await expect(await partsListCell(page, 'Angle stop', 'On truck')).toHaveText('3');
  await expect(await partsListCell(page, '90 degree elbow', 'On truck')).toHaveText('2');

  const search = page.getByPlaceholder('Search parts list');
  await search.fill('ELBOW');
  await expect(page.getByRole('row').filter({ hasText: '90 degree elbow' })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Angle stop' })).toHaveCount(0);
  await expect(page.getByText('Total items: 5')).toBeVisible();

  await search.fill('zzz-nothing');
  await expect(page.getByText('No parts match your search.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '90 degree elbow' })).toHaveCount(0);

  await search.fill('');
  await expect(page.getByRole('row').filter({ hasText: 'Angle stop' })).toHaveCount(1);
});

test('AC22: Parts List print button opens the print dialog', async ({ page }) => {
  await page.addInitScript(() => {
    window.__printCalls = 0;
    window.print = () => {
      window.__printCalls += 1;
    };
  });
  await page.goto('/');
  await addPart(page, 'Angle stop', 2, 0);
  await goTo(page, 'Parts List');
  await page.getByRole('button', { name: 'Print parts list', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__printCalls)).toBe(1);
});

test('AC23: branding shows the Chas Roberts name, logo and red/blue theme', async ({ page }) => {
  const failedImages = [];
  page.on('response', (res) => {
    if (/logo/i.test(res.url()) && res.status() >= 400) failedImages.push(res.url());
  });
  await page.goto('/');
  await expect(page).toHaveTitle('Chas Roberts Truck Inventory');

  const header = page.getByRole('banner');
  await expect(header.getByText('Chas Roberts Truck Inventory').first()).toBeVisible();
  const logo = header.getByRole('img', { name: 'Chas Roberts logo' });
  await expect(logo).toBeVisible();
  await expect
    .poll(() => logo.evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  expect(failedImages).toEqual([]);

  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bodyBg).toBe('rgb(255, 255, 255)');

  const navBg = await page.getByRole('navigation').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(navBg).toBe('rgb(0, 115, 187)');

  const btnBg = await page
    .getByRole('button', { name: 'Add part', exact: true })
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(btnBg).toBe('rgb(224, 20, 76)');

  // Title stays the same on other pages.
  await goTo(page, 'Parts List');
  await expect(page.getByRole('heading', { level: 1, name: 'Parts List' })).toBeVisible();
  await expect(page).toHaveTitle('Chas Roberts Truck Inventory');
});
