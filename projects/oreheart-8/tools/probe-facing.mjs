import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:4173/?test=1&seed=3'); await p.waitForTimeout(800);
await p.evaluate(() => window.oreheart.newMatch({}));
await p.waitForTimeout(3000); await p.getByRole('button',{name:'Keep Hand'}).click().catch(()=>{});
const f = () => p.evaluate(async () => { const c = (await window.oreheart.getRenderStats()).commanders.player; return c.facing + '/' + c.impatience + '/' + c.yaw; });
for (let i = 0; i < 8; i++) { console.log(i, await f()); await p.waitForTimeout(700); }
await p.evaluate(() => window.oreheart.setIdleMs(1500));
await p.waitForTimeout(3500); console.log('impatient', await f());
await p.evaluate(() => window.oreheart.setIdleMs(20000));
await p.mouse.click(600, 150); await p.waitForTimeout(1500); console.log('after act', await f());
await b.close();
