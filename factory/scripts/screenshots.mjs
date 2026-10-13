// Takes desktop + phone screenshots of a running site. Usage: node screenshots.mjs <baseURL> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2];
const out = process.argv[3];
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const errors = [];
for (const [name, viewport] of [['desktop', { width: 1366, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
  } catch (e) {
    errors.push(`${name}: could not load page (${e.message.split('\n')[0]})`);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, `home-${name}.png`), fullPage: true });
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(out, 'page-errors.txt'), errors.join('\n') || 'none');
console.log(`screenshots saved to ${out}${errors.length ? ` (${errors.length} page errors)` : ''}`);
