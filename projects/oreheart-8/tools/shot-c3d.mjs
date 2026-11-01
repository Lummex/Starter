import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const [,, id, anim, out, t] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1400, height: 520 } });
p.on('pageerror', (e) => console.log('ERR', String(e))); p.on('console', (m) => m.type() === 'error' && console.log('CON', m.text()));
await p.goto(`http://localhost:5199/${id === 'grubnak' ? 'g3d-preview.html?anim=' + anim + '&t=' + (t || 0.5) : 'c3d-preview.html?id=' + id + '&anim=' + anim + '&t=' + (t || 0.6)}${process.argv[6] ? '&tune=' + encodeURIComponent(process.argv[6]) : ''}`);
await p.waitForFunction(() => document.title.startsWith('ready'), null, { timeout: 60000 });
console.log(await p.title());
await p.screenshot({ path: out }); await b.close();
