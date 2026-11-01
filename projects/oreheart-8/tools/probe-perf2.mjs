import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await p.goto('http://127.0.0.1:4173/?test=1&seed=123'); await p.waitForTimeout(1200);
await p.evaluate(() => window.oreheart.newMatch({ mines: [{row:4,col:2},{row:4,col:4},{row:4,col:6}], factionLock: false, ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: { opponentHand: [], board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 }, { cardId: 'gnome-tinker', owner: 'opponent', row: 2, col: 11 }] } }));
await p.waitForTimeout(1500);
await p.mouse.move(960, 500);
for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -240); await p.waitForTimeout(120); }
const t = async (label) => { const t0 = Date.now(); for (let i = 0; i < 6; i++) await p.keyboard.press(i < 3 ? 'ArrowLeft' : 'ArrowRight'); console.log(label, Math.round((Date.now() - t0) / 6)); };
await t('base');
console.log(await p.evaluate(() => [...new Set([...document.querySelectorAll('.match *')].map((e) => e.className && typeof e.className === 'string' ? e.className.split(' ')[0] : ''))].join(' ')));
for (const sel of ['.mine-tag,.mine,.mine-label,.mine-ring', '.token', '.tk-stats', '.cell', '.hud', '.flowhud', '.phase']) {
  await p.evaluate((s) => document.querySelectorAll(s).forEach((e) => (e.style.display = 'none')), sel);
  await t('hide ' + sel);
}
await b.close();
