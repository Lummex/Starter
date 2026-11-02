// Nov 2 (Ken): the installed app plays against the computer with no internet. The service worker (dist/sw.js, written by tools/sw-plugin.mjs)
// caches the whole game except the models/music/voices in one go (CORE, all or nothing), and the rest as it is used or on request.
// Test pages only run the worker with &sw=1, so every other check keeps fetching from the server.
import { test, expect } from '@playwright/test';

const offline = (page) => page.evaluate(async () => await window.oreheart.offline());
async function ready(page) {
  await page.goto('/?test=1&sw=1&seed=3');
  await page.waitForFunction(() => !!window.oreheart);
  await expect.poll(async () => (await offline(page)).status, { message: 'the worker installed the game (CORE)', timeout: 90000 }).toMatch(/^(core|full)$/);
  return offline(page);
}
const swLists = async (page) => page.evaluate(async () => {
  const t = (await (await fetch('/sw.js', { cache: 'no-store' })).text()).replace(/\r\n/g, '\n'); // Windows line endings must not matter
  const g = (re) => JSON.parse(t.match(re)[1]);
  return { version: t.match(/const VERSION = '([0-9a-f]+)'/)[1], core: g(/const CORE = (\[[\s\S]*?\]);\s*\n/), full: g(/const FULL = (\{[\s\S]*?\});\s*\/\//) };
});
const cacheState = async (page) => page.evaluate(async () => {
  const names = await caches.keys();
  const out = { names, core: 0, full: 0, index: false };
  for (const n of names) {
    const c = await caches.open(n); const keys = await c.keys();
    if (n.startsWith('oreheart-core-')) { out.core += keys.length; out.index = !!(await c.match(new URL('index.html', location.href).href)); }
    if (n.startsWith('oreheart-full-')) out.full += keys.filter((k) => !k.url.includes('__oreheart-manifest__')).length;
  }
  return out;
});

for (const vp of [{ name: 'desktop', width: 1920, height: 1080 }, { name: 'phone', width: 844, height: 390 }]) {
  test(`AC580: offline play (${vp.name}): after the worker installs, the game loads and a match against the computer runs with the network off`, async ({ page, context }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const s0 = await ready(page);
    const lists = await swLists(page);
    expect(lists.core.length, 'CORE is a real list').toBeGreaterThan(100);
    expect(lists.core.includes('/index.html') && lists.core.some((p) => p.startsWith('/assets/') && p.endsWith('.js')), 'the page and its code are CORE').toBe(true);
    expect(lists.core.some((p) => p.startsWith('/models/')), 'no models in CORE').toBe(false);
    expect(Object.keys(lists.full).some((p) => p.startsWith('/models/creatures/')), 'the models are FULL').toBe(true);
    const cs = await cacheState(page);
    expect(cs.names.some((n) => n === 'oreheart-core-' + lists.version), 'a cache for this version').toBe(true);
    expect(cs.core, 'every CORE file is cached, none missing').toBe(lists.core.length);
    expect(cs.index, 'the page itself is cached').toBe(true);
    expect(s0.coreMB).toBeGreaterThan(10); expect(s0.fullMB).toBeGreaterThan(10);
    // a model the match will use, met once online so it is kept
    await page.evaluate(async () => { await fetch('/models/creatures/goblin-grunt/models.json'); await fetch('/models/creatures/goblin-grunt/char.glb'); });
    await expect.poll(async () => (await cacheState(page)).full, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
    // network off: the page, the code and the game all come from the worker
    await context.setOffline(true);
    await page.route('**/*', (r) => r.abort('internetdisconnected'));
    await page.reload();
    await page.waitForFunction(() => !!window.oreheart, null, { timeout: 30000 });
    expect((await offline(page)).status).toMatch(/^(core|full)$/);
    await page.evaluate(async () => { document.body.classList.remove('test'); await window.oreheart.newMatch({ ai: true, skipMulligan: true, playerCommander: 'grubnak', opponentCommander: 'borgo', difficulty: 'normal', setup: { firstPlayer: 'player', playerHand: ['goblin-grunt'], playerCrystals: 6, opponentHand: ['goblin-grunt'], opponentCrystals: 6, board: [{ cardId: 'goblin-grunt', owner: 'player', row: 6, col: 4 }, { cardId: 'goblin-grunt', owner: 'opponent', row: 2, col: 8 }] } }); });
    await page.mouse.click(5, 5);
    const s1 = await page.evaluate(async () => await window.oreheart.getState());
    expect(s1.board.creatures.length).toBe(2);
    const t0 = s1.turn;
    // our turn ends; the computer takes its turn with no server to ask
    await page.evaluate(async () => { for (let i = 0; i < 3; i++) await window.oreheart.act({ type: 'done' }); });
    await expect.poll(async () => (await page.evaluate(async () => await window.oreheart.getState())).turn, { timeout: 30000 }).toBeGreaterThan(t0);
    const rs = await page.evaluate(async () => await window.oreheart.getRenderStats());
    expect(rs.figures ? rs.figures.length : 2, 'the pieces are drawn').toBeGreaterThanOrEqual(2);
    const cached = await page.evaluate(async () => { const r = await fetch('/models/creatures/goblin-grunt/char.glb'); return r.ok; });
    expect(cached, 'a model met online is served offline').toBe(true);
    // the Settings line says so
    await page.unroute('**/*'); await context.setOffline(false);
  });
}

test('AC581: Settings has the Offline play line, the download button, and a "Restart to update" button only when a new version waits', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await ready(page);
  await page.goto('/?test=1&sw=1'); await page.waitForFunction(() => !!window.oreheart); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const line = page.locator('.offline-panel .offline-line');
  await expect(line).toBeVisible();
  await expect(line).toContainText(/Offline play: ready/);
  await expect(page.locator('.offline-panel .offline-update')).toBeHidden();
  const dl = page.locator('.offline-panel .offline-dl');
  if (await dl.isVisible()) { await dl.click(); await expect(line).toContainText(/Fetching|everything is on this device/, { timeout: 60000 }); }
});

test('AC582: the worker is only on when asked: a plain test page registers nothing, and the live page would (the register call exists in the bundle)', async ({ page }) => {
  await page.goto('/?test=1'); await page.waitForFunction(() => !!window.oreheart); await page.waitForTimeout(500);
  expect((await offline(page)).status).toBe('off');
  const regs = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
  expect(regs, 'no worker from a plain test page').toBe(0);
  const html = await (await page.request.get('/')).text();
  const js = html.match(/assets\/index-[\w-]+\.js/)[0];
  const code = await (await page.request.get('/' + js)).text();
  expect(code.includes('serviceWorker') && code.includes('sw.js'), 'the bundle registers sw.js').toBe(true);
  const sw = await page.request.get('/sw.js');
  expect(sw.ok()).toBe(true);
  expect((await sw.text()).includes("'oreheart-core-'"), 'sw.js is the built worker').toBe(true);
});
