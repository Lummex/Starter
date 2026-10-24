import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const [,, w, h, out, extra] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:4173/?test=1&seed=3&fx=1'); await p.waitForTimeout(1500);
await p.evaluate(() => window.oreheart.newMatch({}));
await p.waitForTimeout(3000); await p.getByRole('button',{name:'Keep Hand'}).click().catch(()=>{}); await p.waitForTimeout(5000);
await p.screenshot({ path: out + '-0.png' });
if (extra) { const r = await p.evaluate(extra); console.log(JSON.stringify(r)?.slice(0, 1500)); await p.waitForTimeout(3000); await p.screenshot({ path: out + '-1.png' }); }
console.log('errors', errs.slice(0, 5));
await b.close();
