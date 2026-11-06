import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const [,, w, h, tag='match', act=''] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:4173/?test=1&seed=3'); await p.waitForTimeout(1000);
await p.evaluate(() => window.oreheart.newMatch({}));
await p.waitForTimeout(3000); await p.getByRole('button',{name:'Keep Hand'}).click().catch(()=>{}); await p.waitForTimeout(4000);
if (act==='menu') { await p.locator('.menu-btn').click(); await p.waitForTimeout(900); }
if (act==='hover') { await p.mouse.move(+w*0.4, +h*0.97); await p.waitForTimeout(900); }
await p.screenshot({ path: `screenshots/r9a-${w}x${h}-${tag}.png` });
console.log('errors', errs.slice(0, 5));
await b.close();
