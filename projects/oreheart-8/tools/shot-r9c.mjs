import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const errs = [];
for (const [w, h] of [[1920, 1080], [844, 390]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:4173/?test=1&seed=3'); await p.waitForTimeout(3300);
  await p.screenshot({ path: `screenshots/r9c-${w}x${h}-intro-crash.png` });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `screenshots/r9c-${w}x${h}-intro.png` });
  await p.waitForTimeout(3800);
  await p.screenshot({ path: `screenshots/r9c-${w}x${h}-main.png` });
  console.log('screen after intro', await p.evaluate(() => document.querySelector('[data-screen]')?.dataset.screen));
  await p.evaluate(() => window.oreheart.newMatch({}));
  await p.waitForTimeout(3000); await p.getByRole('button', { name: 'Keep Hand' }).click().catch(() => {}); await p.waitForTimeout(4500);
  await p.screenshot({ path: `screenshots/r9c-${w}x${h}-match.png` });
  const info = await p.evaluate(async () => { const r = await window.oreheart.getRenderStats(); const a = window.oreheart.getArena(); return { cm: r.commanders, ar: a && (a.arena || a), }; });
  console.log(w, JSON.stringify(info).slice(0, 1500));
  await p.close();
}
console.log('errors', errs.slice(0, 8));
await b.close();
