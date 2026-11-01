import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://127.0.0.1:4173/?test=1'); await p.waitForTimeout(1200);
await p.evaluate(() => window.oreheart.newMatch({ ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: { opponentHand: [], board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 6, col: 3 }, { cardId: 'gnome-tinker', owner: 'opponent', row: 2, col: 11 }] } }));
await p.waitForTimeout(1500);
await p.mouse.move(960, 500);
for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -240); await p.waitForTimeout(120); }
console.log('fps', await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2000) res(n / 2); else requestAnimationFrame(f); }; f(); })));
console.log('sync', await p.evaluate(() => { const t0 = performance.now(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' })); const t1 = performance.now(); document.body.getBoundingClientRect(); return [t1 - t0, performance.now() - t1]; }));
await p.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] }); });
const cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
for (let i = 0; i < 6; i++) await p.keyboard.press('ArrowLeft');
const prof = (await cdp.send('Profiler.stop')).profile;
const self = new Map(); const dt = prof.timeDeltas; const idIdx = new Map(prof.nodes.map((n) => [n.id, n]));
prof.samples.forEach((id, i) => { const n = idIdx.get(id); const k = n.callFrame.functionName + ' ' + n.callFrame.url.split('/').pop() + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + dt[i]); });
console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + Math.round(v / 1000)).join('\n'));
for (const k of ['ArrowLeft', 'w']) {
let t = Date.now();
for (let i = 0; i < 40; i++) await p.keyboard.press(k);
console.log(k, '40 keys ms', Date.now() - t);
}
console.log('longtasks', await p.evaluate(() => window.__lt));
console.log(await p.evaluate(() => { const r = []; for (const k of ['ArrowLeft','ArrowRight']) { const t0 = performance.now(); for (let i = 0; i < 5; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: k })); r.push(performance.now() - t0); } return r; }));
await b.close();
