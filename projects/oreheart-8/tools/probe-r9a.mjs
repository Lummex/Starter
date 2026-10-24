import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://localhost:4173/?test=1&seed=3'); await p.waitForTimeout(800);
await p.mouse.click(10, 10); await p.waitForTimeout(1800);
console.log('menu music', JSON.stringify((await p.evaluate(() => oreheart.getAudioState())).music));
await p.evaluate(() => oreheart.newMatch({}));
await p.waitForTimeout(1500);
await p.getByRole('button',{name:'Keep Hand'}).click().catch(()=>{});
await p.waitForTimeout(2500);
console.log('match music', JSON.stringify((await p.evaluate(() => oreheart.getAudioState())).music));
const hud = await p.evaluate(() => oreheart.getHud());
const L = JSON.parse((await import('fs')).readFileSync('src/content/owner-layout.json','utf8')).hud;
let bad = [];
for (const piece of L) { if (!piece.role || piece.parent) continue; const a = hud.pieces[piece.role]; if (!a) { bad.push('missing '+piece.role); continue; }
  const ex = piece.x/100*1920, ey = piece.y/100*1080, ew = piece.w/100*1920, eh = piece.h/100*1080;
  if (Math.abs(a.x-ex)>19 || Math.abs(a.y-ey)>11 || Math.abs(a.w-ew)>19 && !piece.rot) bad.push(piece.role+' '+JSON.stringify([a.x,a.y,a.w,a.h])+' vs '+JSON.stringify([ex,ey,ew,eh])); }
console.log('hud bad', bad);
console.log(JSON.stringify({themes:hud.themes,bank:hud.bankPictures,gem:hud.gemPictures,frames:hud.cornerFrames,badge:hud.bankBadgeOnCrystal}));
console.log('deal', JSON.stringify(await p.evaluate(() => oreheart.getDealState())));
const rs = await p.evaluate(async () => { const s = await oreheart.getRenderStats(); return { cf: s.crystalFlow, mm: s.mineModel, mh: s.mineModels?.map(m=>m.height), sc: s.commanders ? undefined : 0 }; });
console.log(JSON.stringify(rs));
console.log('cmd', JSON.stringify((await p.evaluate(async () => (await oreheart.getRenderStats()).commanderModels))?.map?.(c=>[c.side,c.scepterBone,c.source])));
await p.locator('.menu-btn').click(); await p.waitForTimeout(500);
console.log('menu', JSON.stringify((await p.evaluate(() => oreheart.getHud())).menu));
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
console.log('menu after esc', JSON.stringify((await p.evaluate(() => oreheart.getHud())).menu.open));
// hover a card
await p.mouse.move(520, 1000); await p.waitForTimeout(900);
console.log('hover', JSON.stringify(await p.evaluate(() => { const c=document.querySelector('.hand-card.popped:not(.popclone)'); const cl=document.querySelector('.popclone'); const r=(cl||c)?.getBoundingClientRect(); return {popped:!!c, clone:!!cl, bottom:r&&r.bottom, top:r&&r.top, aside:[...document.querySelectorAll('.hand-card')].map(x=>x.dataset.aside||'')}; })));
await p.screenshot({ path: 'screenshots/r9a-1920x1080-hover.png' });
console.log('errors', errs.slice(0,3));
await b.close();
