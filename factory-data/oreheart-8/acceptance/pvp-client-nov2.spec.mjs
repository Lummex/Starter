// Nov 2 (Helper C): the PvP client (friend matches by 6-letter code) against Anvil's local mock server (projects/oreheart-8/tools/pvp-mock-server.mjs,
// in-memory, the same referee as the real `match` function, fake sign-in by the x-mock-user header). No database needed: the pages are opened with
// ?test=1&pvp=mock&user=<name>, which signs them in as <name> without Supabase. The spec starts the mock server itself when port 4310 is closed
// (and stops it at the end); start it by hand with `node tools/pvp-mock-server.mjs` from projects/oreheart-8 to keep it running between runs.
import { test, expect } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.resolve(HERE, '../../../projects/oreheart-8');
const MOCK = process.env.PVP_MOCK_SERVER || path.join(GAME_DIR, 'tools/pvp-mock-server.mjs');
const MOCK_PORT = 4310;

// one worker, in order: the checks share the mock server this file may start
test.describe.configure({ mode: 'default' });

const portOpen = (port) => new Promise((res) => { const s = net.connect(port, '127.0.0.1'); s.once('connect', () => { s.destroy(); res(true); }); s.once('error', () => res(false)); });
let server = null;
test.beforeAll(async () => {
  if (await portOpen(MOCK_PORT)) return;
  if (!fs.existsSync(path.join(GAME_DIR, 'tools/.build/pvp-server.mjs'))) spawnSync(process.execPath, [path.join(GAME_DIR, 'tools/bundle-engine.mjs')], { cwd: GAME_DIR, stdio: 'ignore' }); // the mock server runs the bundled referee
  server = spawn(process.execPath, [MOCK, String(MOCK_PORT)], { cwd: GAME_DIR, stdio: 'ignore' });
  for (let i = 0; i < 100 && !(await portOpen(MOCK_PORT)); i++) await new Promise((r) => setTimeout(r, 200));
  if (!(await portOpen(MOCK_PORT))) throw new Error('the PvP mock server did not start: ' + MOCK);
});
test.afterAll(async () => { if (server) { server.kill(); server = null; } });

// ---------- helpers ----------
const uniq = () => Math.random().toString(36).slice(2, 8);
async function openAs(browser, user, size = { width: 1600, height: 900 }) {
  const ctx = await browser.newContext({ viewport: size });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('oreheart.tutorialSeen', '1'); } catch { /* ignore */ } });
  await page.goto(`/?test=1&pvp=mock&user=${encodeURIComponent(user)}`);
  await page.waitForFunction(() => !!window.oreheart && !!window.oreheart.pvp);
  return page;
}
const atMenu = (page) => expect(page.locator('[data-testid=pvp-play-friend]')).toBeVisible({ timeout: 15000 });
const view = (page) => page.evaluate(async () => await window.oreheart.pvp.view());
const seqOf = (page) => page.evaluate(async () => await window.oreheart.pvp.seq());
const hook = (page, name, ...args) => page.evaluate(async ([n, a]) => await window.oreheart.pvp[n](...a), [name, args]);
const inMatch = (page) => expect(page.locator('main.match')).toBeVisible({ timeout: 20000 });

/** Two signed-in pages and a started match (made with the hooks, which drive the same screens as the buttons). */
async function pair(browser, size) {
  const id = uniq();
  const a = await openAs(browser, 'alice' + id, size), b = await openAs(browser, 'bob' + id, size);
  await atMenu(a); await atMenu(b);
  const made = await hook(a, 'create', 'grubnak', 'goblin-warband');
  expect(made && made.ok, 'create: ' + JSON.stringify(made)).toBe(true);
  const joined = await hook(b, 'join', made.code, 'borgo', 'dwarf-warband');
  expect(joined && joined.ok, 'join: ' + JSON.stringify(joined)).toBe(true);
  await inMatch(b); await inMatch(a);
  return { a, b, id, code: made.code };
}
/** Both players keep their opening hands (mulligan) through the server. */
async function keepHands(a, b) {
  for (let i = 0; i < 20; i++) {
    let acted = false;
    for (const p of [a, b]) {
      const v = await view(p);
      if (v && v.state.phase === 'mulligan' && v.state.priority === 'player') { await hook(p, 'act', { type: 'mulligan', redraw: false, uids: [] }); acted = true; }
    }
    const va = await view(a), vb = await view(b);
    if (va.state.phase !== 'mulligan' && vb.state.phase !== 'mulligan' && va.seq === vb.seq) return;
    if (!acted) await a.waitForTimeout(300);
  }
  throw new Error('the mulligan did not finish');
}
/** The page whose turn it is (it holds priority in Deploy/Action), and the other one. */
async function whoseTurn(a, b) {
  for (let i = 0; i < 30; i++) {
    const va = await view(a), vb = await view(b);
    if (va.seq === vb.seq) {
      if (va.state.priority === 'player' && !va.state.pendingResponse) return [a, b];
      if (vb.state.priority === 'player' && !vb.state.pendingResponse) return [b, a];
    }
    await a.waitForTimeout(250);
  }
  throw new Error('nobody holds priority');
}
async function closeAll(...pages) { for (const p of pages) await p.context().close().catch(() => {}); }

// ---------- checks ----------
test('AC630: Play a friend: Make a code shows the code big; the friend types it in ("I have a code") and both pages open the same match', async ({ browser }) => {
  test.setTimeout(90000);
  const id = uniq();
  const a = await openAs(browser, 'alice' + id), b = await openAs(browser, 'bob' + id);
  await atMenu(a); await atMenu(b);
  await a.click('[data-testid=pvp-play-friend]');
  await a.click('[data-testid=pvp-make]');
  await expect(a.locator('.pvp-cmd[data-commander]')).toHaveCount(3);
  await a.click('.pvp-cmd[data-commander=sproingle]');
  await a.click('[data-testid=pvp-create]');
  const codeEl = a.locator('.pvp-code[data-code]');
  await expect(codeEl).toBeVisible();
  const code = await codeEl.getAttribute('data-code');
  expect(code).toMatch(/^[A-HJ-NP-Z]{6}$/);
  await expect(a.locator('.pvp-letter')).toHaveCount(6);
  const fs = await a.locator('.pvp-letter').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(fs, 'the code is big').toBeGreaterThanOrEqual(28);
  await expect(a.locator('[data-testid=pvp-copy]')).toBeVisible();
  await expect(a.locator('.pvp-waiting')).toContainText('Waiting for your friend');
  await b.click('[data-testid=pvp-play-friend]');
  await b.click('[data-testid=pvp-join]');
  await b.fill('[data-testid=pvp-code-input]', code.toLowerCase());
  await expect(b.locator('[data-testid=pvp-code-input]')).toHaveValue(code);
  await b.click('.pvp-cmd[data-commander=borgo]');
  await b.click('[data-testid=pvp-join-go]');
  await inMatch(b);
  await inMatch(a); // the host learns of it by polling `room` every 2 s
  const va = await view(a), vb = await view(b);
  expect(va.matchId).toBe(vb.matchId);
  expect(va.mySide).not.toBe(vb.mySide);
  expect(va.names.them).toBe('bob' + id);
  expect(vb.names.them).toBe('alice' + id);
  // each browser plays as engine side 'player' with its own Commander
  expect(va.state.players.player.commanderId).toBe('sproingle');
  expect(vb.state.players.player.commanderId).toBe('borgo');
  expect(va.state.players.opponent.commanderId).toBe('borgo');
  // the name plate shows the friend's name
  await expect(a.locator('main.match')).toContainText('bob' + id);
  await closeAll(a, b);
});

test('AC631: room codes in plain words: six letters without I or O; a wrong code and your own code are refused with a friendly message', async ({ browser }) => {
  test.setTimeout(60000);
  const id = uniq();
  const a = await openAs(browser, 'alice' + id);
  await atMenu(a);
  const made = await hook(a, 'create', 'grubnak', 'goblin-warband');
  expect(made.ok).toBe(true);
  const own = await hook(a, 'join', made.code, 'grubnak', 'goblin-warband');
  expect(own.ok).toBe(false);
  expect(own.error).toMatch(/your own code/i);
  const b = await openAs(browser, 'bob' + id);
  await atMenu(b);
  await b.click('[data-testid=pvp-play-friend]');
  await b.click('[data-testid=pvp-join]');
  await b.fill('[data-testid=pvp-code-input]', 'io-io1');
  await expect(b.locator('[data-testid=pvp-code-input]')).toHaveValue('');
  await expect(b.locator('[data-testid=pvp-join-go]')).toBeDisabled();
  const wrong = made.code === 'ZZZZZZ' ? 'YYYYYY' : 'ZZZZZZ';
  await b.fill('[data-testid=pvp-code-input]', wrong);
  await b.click('[data-testid=pvp-join-go]');
  await expect(b.locator('.net-alert')).not.toBeEmpty();
  const msg = await b.locator('.net-alert').textContent();
  expect(msg, 'plain words, not a server code').not.toMatch(/[{}]|undefined|null|Error:/);
  await closeAll(a, b);
});

test('AC632: the first player\'s Deploy works through the server and the other page sees it (mirrored), at the same seq', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  await keepHands(a, b);
  const [me, them] = await whoseTurn(a, b);
  const v0 = await view(me);
  expect(v0.state.phase).toBe('deploy');
  const legal = await me.evaluate(async () => await window.oreheart.legalActions());
  const summon = legal.find((x) => x.type === 'summon');
  expect(summon, 'a creature can be summoned on turn 1').toBeTruthy();
  const r = await me.evaluate(async (x) => await window.oreheart.act(x), summon); // the screen's own path (NetGame.act)
  expect(r && r.ok).toBe(true);
  await expect.poll(async () => (await view(them)).seq, { timeout: 10000 }).toBeGreaterThan(v0.seq);
  // the summon opens a Respond window for the other player (always, in PvP): let it happen
  const vt = await view(them);
  if (vt.state.pendingResponse && vt.state.pendingResponse.responder === 'player') {
    const pr = await hook(them, 'act', { type: 'pass' });
    expect(pr.ok, JSON.stringify(pr)).toBe(true);
  }
  await expect.poll(async () => (await view(them)).state.board.creatures.filter((c) => c.owner === 'opponent').length, { timeout: 10000 }).toBe(1);
  await expect.poll(async () => (await view(me)).seq === (await view(them)).seq, { timeout: 10000 }).toBe(true);
  const mine = (await view(me)).state.board.creatures.find((c) => c.owner === 'player');
  const seen = (await view(them)).state.board.creatures.find((c) => c.owner === 'opponent');
  expect(mine.cardId).toBe(seen.cardId);
  expect(seen.row).toBe(8 - mine.row);
  expect(seen.col).toBe(14 - mine.col);
  // and on the other page's board itself
  await expect.poll(async () => (await them.evaluate(async () => await window.oreheart.getState())).board.creatures.length, { timeout: 5000 }).toBe(1);
  await closeAll(a, b);
});

test('AC633: an out-of-turn act from the page hooks is refused by the server with an error, and the board stays unchanged', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  await keepHands(a, b);
  const [me, them] = await whoseTurn(a, b);
  const before = await view(them);
  const r = await hook(them, 'act', { type: 'done' });
  expect(r.ok).toBe(false);
  expect(String(r.error || '')).not.toBe('');
  const after = await view(them);
  expect(after.seq).toBe(before.seq);
  expect(JSON.stringify(after.state.board)).toBe(JSON.stringify(before.state.board));
  expect((await view(me)).seq).toBe(before.seq);
  // a stale seq is refused too
  const stale = await them.evaluate(async () => (await (await fetch('http://127.0.0.1:4310/match', { method: 'POST', headers: { 'content-type': 'application/json', 'x-mock-user': new URLSearchParams(location.search).get('user') }, body: JSON.stringify({ op: 'act', matchId: await window.oreheart.pvp.matchId(), seq: -5, action: { type: 'done' } }) })).json()));
  expect(stale.ok).toBe(false);
  await closeAll(a, b);
});

test('AC634: reloading a page mid-match brings it straight back into the same match at the same seq', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  await keepHands(a, b);
  const v0 = await view(b);
  await b.reload();
  await b.waitForFunction(() => !!window.oreheart && !!window.oreheart.pvp);
  await inMatch(b);
  await expect.poll(async () => (await view(b))?.matchId, { timeout: 15000 }).toBe(v0.matchId);
  expect(await seqOf(b)).toBe(v0.seq);
  await closeAll(a, b);
});

test('AC635: "Give up match!" (forfeit) ends the match for both; the result screen offers only "Back to menu"', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  const r = await hook(a, 'forfeit');
  expect(r && r.ok, JSON.stringify(r)).toBe(true);
  await expect.poll(async () => (await view(b)).status, { timeout: 10000 }).toBe('over');
  expect((await view(a)).status).toBe('over');
  expect((await view(a)).result.won).toBe(false);
  expect((await view(b)).result.won).toBe(true);
  for (const p of [a, b]) {
    await expect(p.locator('main.end')).toBeVisible({ timeout: 15000 });
    await expect(p.getByRole('button', { name: 'Back to menu' })).toBeVisible();
    await expect(p.getByRole('button', { name: /Play again|Rematch/ })).toHaveCount(0);
  }
  await b.getByRole('button', { name: 'Back to menu' }).click();
  await atMenu(b);
  await expect(b.locator('[data-testid=pvp-back-to-match]')).toHaveCount(0);
  await closeAll(a, b);
});

test('AC636: the turn bar follows the server deadline (aria-valuenow), never a local reset; no pause, speed or Card Play controls in a friend match', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  await keepHands(a, b);
  const [me] = await whoseTurn(a, b);
  const bar = me.locator('.turn-bar');
  await expect(bar).toBeVisible();
  for (let i = 0; i < 2; i++) {
    const v = await view(me);
    const expected = Math.ceil(Math.min(120, Math.max(0, (Date.parse(v.deadline) - Date.now()) / 1000)));
    const shown = +(await bar.getAttribute('aria-valuenow'));
    expect(Math.abs(shown - expected), `bar ${shown} vs server ${expected}`).toBeLessThanOrEqual(2);
    await me.waitForTimeout(2200);
  }
  // the local test hook that sets the phase clock does nothing in PvP: the server owns the clock
  await me.evaluate(() => window.oreheart.setPhaseTimeLeft(3));
  const v = await view(me);
  const expected = Math.ceil(Math.min(120, (Date.parse(v.deadline) - Date.now()) / 1000));
  expect(Math.abs(+(await bar.getAttribute('aria-valuenow')) - expected)).toBeLessThanOrEqual(2);
  for (const p of [a, b]) {
    await expect(p.locator('.mode-ui, .watch-bar, .wb-pause, .wb-speed')).toHaveCount(0);
    expect(await p.evaluate(() => window.__app.game.mode)).toBe('standard');
  }
  await closeAll(a, b);
});

test('AC637: phone size (844x390 landscape): the code screen and the join screen fit on one screen', async ({ browser }) => {
  test.setTimeout(60000);
  const id = uniq();
  const a = await openAs(browser, 'alice' + id, { width: 844, height: 390 });
  await atMenu(a);
  const fits = async (sel) => a.evaluate((s) => {
    const W = innerWidth, H = innerHeight;
    return [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map((e) => { const r = e.getBoundingClientRect(); return { s: e.className, ok: r.left >= -1 && r.top >= -1 && r.right <= W + 1 && r.bottom <= H + 1 }; });
  }, sel);
  const menuBtn = (await fits('[data-testid=pvp-play-friend]'));
  expect(menuBtn.every((x) => x.ok), JSON.stringify(menuBtn)).toBe(true);
  await a.click('[data-testid=pvp-play-friend]');
  await a.click('[data-testid=pvp-make]');
  const pick = await fits('.pvp-cmd, [data-testid=pvp-create], .pvp-deck');
  expect(pick.length).toBeGreaterThanOrEqual(5);
  expect(pick.every((x) => x.ok), JSON.stringify(pick)).toBe(true);
  await a.click('[data-testid=pvp-create]');
  await expect(a.locator('.pvp-code[data-code]')).toBeVisible();
  const code = await fits('.pvp-letter, [data-testid=pvp-copy], .pvp-cancel, .pvp-waiting');
  expect(code.length).toBe(9);
  expect(code.every((x) => x.ok), JSON.stringify(code)).toBe(true);
  expect(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await a.click('.pvp-cancel');
  await a.click('[data-testid=pvp-join]');
  const join = await fits('[data-testid=pvp-code-input], .pvp-cmd, [data-testid=pvp-join-go]');
  expect(join.every((x) => x.ok), JSON.stringify(join)).toBe(true);
  await closeAll(a);
});

test('AC638: hidden information: the page only ever holds its own hand; the friend\'s hand and both decks are card backs, rng is 0', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  for (const p of [a, b]) {
    const st = await p.evaluate(async () => await window.oreheart.getState());
    expect(st.pvp).toBe(true);
    expect(st.players.opponent.hand.length).toBeGreaterThan(0);
    expect(st.players.opponent.hand.every((c) => c.hidden && !c.cardId)).toBe(true);
    expect(st.players.player.hand.every((c) => !!c.cardId)).toBe(true);
    expect(st.players.player.deck.every((c) => c.hidden && !c.cardId)).toBe(true);
    expect(st.players.opponent.deck.every((c) => c.hidden && !c.cardId)).toBe(true);
    expect(st.rng).toBe(0);
    // the enemy hand shows card backs only
    await expect(p.locator('.enemy-hand .back')).not.toHaveCount(0);
  }
  await closeAll(a, b);
});

test('AC639: "Back to your match" on the main menu while a match is active re-opens it at the same seq; offline test pages have no "Play a friend"', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  const v0 = await view(a);
  await a.evaluate(() => window.__app.showMenu());
  await expect(a.locator('[data-testid=pvp-back-to-match]')).toBeVisible({ timeout: 10000 });
  await a.click('[data-testid=pvp-back-to-match]');
  await inMatch(a);
  await expect.poll(async () => (await view(a))?.matchId).toBe(v0.matchId);
  expect(await seqOf(a)).toBeGreaterThanOrEqual(v0.seq);
  // a plain offline test page: no friend matches
  const ctx = await browser.newContext();
  const off = await ctx.newPage();
  await off.goto('/?test=1');
  await off.waitForFunction(() => !!window.oreheart);
  await expect(off.locator('main.menu-screen')).toBeVisible();
  await expect(off.locator('[data-testid=pvp-play-friend]')).toHaveCount(0);
  await ctx.close();
  await closeAll(a, b);
});
