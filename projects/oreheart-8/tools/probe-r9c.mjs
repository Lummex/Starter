// Real-browser check (round 9c): the arena canvas draws every frame, all owner effects are present, centre pixel is not the plain board colour.
import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
import sharp from 'sharp';
import fs from 'node:fs';
const layout = JSON.parse(fs.readFileSync('src/content/owner-layout.json', 'utf8'));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = []; p.on('console', (m) => { if (m.type() === 'error' && /arena/i.test(m.text())) errs.push(m.text()); });
await p.goto('http://localhost:4173/?test=1&seed=3'); await p.waitForTimeout(800);
await p.evaluate(() => window.oreheart.newMatch({})); await p.waitForTimeout(4000);
const a = await p.evaluate(() => window.oreheart.getArena());
const png = await p.screenshot();
const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
const i = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
const px = [data[i], data[i + 1], data[i + 2]];
const flow = layout.effects.filter((e) => e.type === 'flow').length;
const checks = {
  effects54: a.effects.length === layout.effects.length - flow, flow3: a.flowEffects === flow && flow === 3,
  cutouts: a.foregroundCutouts === (layout.foregroundCutouts || []).length, draws: a.arenaDrawCalls > 0,
  centreNotPlain: !(px[0] === 42 && px[1] === 29 && px[2] === 56), noArenaErrors: errs.length === 0,
};
console.log(JSON.stringify({ px, effects: a.effects.length, flow: a.flowEffects, cutouts: a.foregroundCutouts, draws: a.arenaDrawCalls, checks }));
await b.close();
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
