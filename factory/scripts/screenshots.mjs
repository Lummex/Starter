// Takes desktop + phone screenshots of a running site. Usage: node screenshots.mjs <baseURL> <outDir>
// Waits for loading screens to finish, then (best effort) clicks through a "Click to begin" gate,
// the main menu's Play and Start, and a mulligan "Keep", so the reviewer sees real screens, not a splash.
// Phone is shot sideways (landscape), since games often ask to rotate a portrait phone.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2];
const out = process.argv[3];
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const notes = [];

async function settle(page, ms = 1500) {
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
  await page.waitForTimeout(ms);
}
async function clickText(page, re) {
  // Prefer a real button; fall back to any visible text match.
  for (const loc of [page.getByRole('button', { name: re }), page.getByText(re)]) {
    const n = await loc.count().catch(() => 0);
    for (let i = 0; i < Math.min(n, 5); i++) {
      const el = loc.nth(i);
      try { if (await el.isVisible()) { try { await el.click({ timeout: 3000 }); } catch { await el.evaluate((e) => e.click()); } return true; } } catch {}
    }
  }
  return false;
}

for (const [name, viewport] of [['desktop', { width: 1366, height: 768 }], ['phone', { width: 844, height: 390 }]]) {
  const page = await browser.newPage({ viewport, hasTouch: name === 'phone' });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    errors.push(`${name}: could not load page (${e.message.split('\n')[0]})`);
  }
  await settle(page, 4000); // let intro/loading screens finish
  const shot = async (step) => { await page.screenshot({ path: path.join(out, `${step}-${name}.png`) }); notes.push(`${step}-${name}.png`); };
  await shot('1-home');
  // Begin gate: "Click to begin" / "Tap to begin" / "Press any key"
  if (await clickText(page, /(click|tap) to (begin|start)|press any key/i)) await settle(page, 3000);
  else { await page.mouse.click(viewport.width / 2, viewport.height / 2); await settle(page, 3000); }
  await clickText(page, /^skip$/i);
  await shot('2-menu');
  // Into a match: Play -> Start -> Keep hand
  if (await clickText(page, /^play$/i)) {
    await settle(page, 2000);
    await shot('3-before-match');
    if (await clickText(page, /^(start|fight!?)$/i)) {
      await settle(page, 5000);
      await shot('4-match-start');
      for (let t = 0; t < 6; t++) { if (await clickText(page, /^keep( hand)?$/i)) { await settle(page, 4000); await shot('5-match'); break; } await page.waitForTimeout(1500); }
    }
  }
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(out, 'page-errors.txt'), errors.join('\n') || 'none');
fs.writeFileSync(path.join(out, 'README.txt'), 'Screens in order (name-viewport):\n' + notes.join('\n') + '\n\nNote: the first shot is taken 4 seconds after load; a short intro/loading picture before the menu is normal and is NOT a broken game.\n');
console.log(`screenshots saved to ${out}: ${notes.join(', ')}${errors.length ? ` (${errors.length} page errors)` : ''}`);
