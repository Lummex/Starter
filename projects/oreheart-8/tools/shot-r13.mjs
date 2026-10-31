// Round 13 screenshots: title, Deck Builder (3 commanders + spells filter), a real match with a hand of spells, spell close-up, ability button in use.
// Usage: start `npx vite --port 5199`, then `node tools/shot-r13.mjs`. Goes past the intro into a real match (no dirt "developer" screen).
import { chromium } from '/home/runner/work/Starter/Starter/factory/node_modules/playwright/index.mjs';
const URL = process.env.URL || 'http://localhost:5199';
const OUT = 'screenshots/';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(`${URL}/?test=1&begin=1&intro=1&seed=3`); await p.waitForTimeout(2500);
await p.screenshot({ path: OUT + 'r13-title-1920x1080.png' });
await p.evaluate(() => (window).__app.menuGo('deck')); await p.waitForTimeout(1500);
await p.click('[data-cmd=sproingle]'); await p.waitForTimeout(400);
await p.evaluate(() => { const s = document.querySelector('#f-type'); });
await p.screenshot({ path: OUT + 'r13-deckbuilder-1920x1080.png' });
await p.evaluate(() => (window).oreheart.newMatch({ playerCommander: 'grubnak', opponentCommander: 'sproingle', setup: {
  playerHand: ['prospectors-prayer', 'healing-light', 'fizzle', 'venom-shiv', 'goblin-scrounger', 'fireball'],
  board: [{ cardId: 'goblin-scrapper', owner: 'player', row: 4, col: 5 }, { cardId: 'blastrat-sapper', owner: 'player', row: 6, col: 5 }, { cardId: 'gnome-cogger', owner: 'opponent', row: 3, col: 9 }, { cardId: 'goblin-grunt', owner: 'opponent', row: 4, col: 9 }] } }));
await p.waitForTimeout(2500);
await p.mouse.move(960, 1060); await p.waitForTimeout(900);
await p.screenshot({ path: OUT + 'r13-hand-spells-1920x1080.png' });
await p.evaluate(() => (window).__app.closeUp('venom-shiv')); await p.waitForTimeout(900);
await p.screenshot({ path: OUT + 'r13-spell-closeup-1920x1080.png' });
await p.mouse.click(30, 500); await p.waitForTimeout(500);
for (let i = 0; i < 4; i++) { const ph = await p.evaluate(() => (window).oreheart.getState().phase); if (ph === 'action') break; await p.evaluate(() => { const o = (window).oreheart; const l = o.legalActions(); o.act(l.find((x) => x.type === 'keep') || l.find((x) => x.type === 'done') || l[0]); }); await p.waitForTimeout(700); }
await p.evaluate(() => { const a = (window).__app; a.game.state.players.player.bank = 6; a.update(a.game.state, []); });
await p.waitForTimeout(500);
await p.locator('.ab-btn[data-ability=bowl]').click(); await p.waitForTimeout(500);
await p.screenshot({ path: OUT + 'r13-ability-button-1920x1080.png' });
await b.close();
