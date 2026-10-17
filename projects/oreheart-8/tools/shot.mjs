import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const [,, url, out, ...steps] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto(url); await p.waitForTimeout(1500);
for (const s of steps) {
  if (s.startsWith('click:')) await p.getByRole('button', { name: s.slice(6), exact: true }).first().click();
  else if (s.startsWith('eval:')) await p.evaluate(s.slice(5));
  else if (s.startsWith('wait:')) await p.waitForTimeout(+s.slice(5));
  else if (s.startsWith('shot:')) await p.screenshot({ path: s.slice(5) });
}
await p.screenshot({ path: out });
console.log('errors', errs);
await b.close();
