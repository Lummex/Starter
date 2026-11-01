import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://127.0.0.1:4173/?test=1&seed=3'); await p.waitForTimeout(1200);
await p.evaluate(() => window.oreheart.newMatch({}));
await p.waitForTimeout(2500); await p.getByRole('button', { name: 'Keep Hand' }).click().catch(() => {}); await p.waitForTimeout(2000);
for (const [W, H] of [[1920,1080],[1920,1200],[2560,1080],[1600,1200],[844,390]]) {
  await p.setViewportSize({ width: W, height: H }); await p.waitForTimeout(800);
  console.log(W, H, JSON.stringify(await p.evaluate(() => { const c = window.oreheart.getCamera(); const r = window.oreheart.screenRects(); return { v: c.view, pc: r.playerCommander, oc: r.opponentCommander }; })));
}
await b.close();
