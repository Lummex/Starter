import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const [,, w, h, out] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:4173/?test=1&seed=3&fx=1'); await p.waitForTimeout(1200);
await p.evaluate(() => window.oreheart.newMatch({}));
await p.waitForTimeout(2500); await p.getByRole('button', { name: 'Keep Hand' }).click().catch(() => {}); await p.waitForTimeout(3500);
const info = await p.evaluate(() => { const l = window.oreheart.legalActions().filter((a) => a.type === 'summon'); return { n: l.length, uids: [...new Set(l.map((a) => a.uid))], ph: window.oreheart.getState().phase }; });
console.log(JSON.stringify(info));
const cards = await p.$$('.hand .hand-card:not(.popclone)');
console.log('cards', cards.length);
let done = false;
for (const c of cards) {
  const uid = await c.getAttribute('data-uid');
  if (!info.uids.includes(uid)) continue;
  const bb = await c.boundingBox();
  const vy = Math.min(bb.y + 40, +h - 15), vx = bb.x + bb.width / 2;
  await p.mouse.move(vx, vy); await p.waitForTimeout(700);
  const bb2 = await c.boundingBox();
  const sx = vx, sy = Math.min(bb2.y + 60, +h - 15);
  await p.mouse.move(sx, sy); await p.waitForTimeout(200);
  console.log('at', sx, sy, await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&(e.className+' '+e.tagName+' '+(e.closest('[data-uid]')?.dataset.uid))},[sx,sy]));
  await p.mouse.down();
  for (let i = 1; i <= 12; i++) { await p.mouse.move(sx + i * 3, sy - i * 25); await p.waitForTimeout(30); }
  await p.waitForTimeout(300);
  console.log('ghost', await p.evaluate(()=>!!document.querySelector('.dragged-card')));
  const t = await p.evaluate(() => { const g = [...document.querySelectorAll('.cell.glow')]; if (!g.length) return null; const r = g[Math.floor(g.length / 2)].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, n: g.length, row: g[0].dataset.row }; });
  console.log('target', JSON.stringify(t));
  await p.screenshot({ path: out + '-drag.png' });
  if (t) { await p.mouse.move(t.x, t.y, { steps: 5 }); await p.waitForTimeout(100); }
  await p.mouse.up(); await p.waitForTimeout(1500);
  const after = await p.evaluate(() => window.oreheart.getState().board.creatures.filter((c) => c.owner === 'player').length);
  console.log('player creatures after', after);
  done = true; break;
}
await p.screenshot({ path: out + '-after.png' });
await b.close();
