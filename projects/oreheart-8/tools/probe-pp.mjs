import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:4173/?test=1&seed=3&fx=1'); await p.waitForTimeout(1500);
await p.evaluate(() => window.oreheart.newMatch({ playerCommander: 'grubnak' })); await p.waitForTimeout(6000);
console.log(JSON.stringify(await p.evaluate(() => window.oreheart.getPiecePoses().pFort)));
console.log(JSON.stringify(await p.evaluate(() => window.oreheart.getPiecePoses().pCmd)));
await b.close();
