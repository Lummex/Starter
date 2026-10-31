import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const [,, w, h, out] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:4173/?test=1&seed=3&fx=1'); await p.waitForTimeout(1500);
const board = [['goblin-scrounger', 5, 5], ['goblin-pebbler', 5, 7], ['shiv-rat', 6, 6], ['goblin-smith-miner', 6, 8]].map(([c, r, k]) => ({ owner: 'player', cardId: c, row: r, col: k }))
  .concat([['goblin-scrounger', 2, 8], ['goblin-pebbler', 2, 6]].map(([c, r, k]) => ({ owner: 'opponent', cardId: c, row: r, col: k })));
await p.evaluate((bd) => window.oreheart.newMatch({ setup: { board: bd, playerCommander: 'grubnak' } , playerCommander: 'grubnak' }), board);
await p.waitForTimeout(9000);
await p.screenshot({ path: out + '-board.png' });
await p.mouse.move(+w * 0.19, +h * 0.57); for (let i = 0; i < 12; i++) await p.mouse.wheel(0, -120); await p.waitForTimeout(2500);
await p.screenshot({ path: out + '-zoom-throne.png' });
console.log(JSON.stringify(await p.evaluate(() => window.oreheart.getPiecePoses && Object.keys(window.oreheart.getPiecePoses()))));
console.log('errors', errs.slice(0, 5));
await b.close();
