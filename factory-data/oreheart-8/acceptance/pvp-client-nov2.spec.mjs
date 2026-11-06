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
/** A random hand may hold nothing to summon: give this page a creature and crystals (stand-in server only), and wait until both pages have the new move number. */
async function sureSummon(me, them) {
  const v = await view(me);
  await fetch(`http://127.0.0.1:${MOCK_PORT}/debug/give?matchId=${v.matchId}&user=${encodeURIComponent(v.names.me)}&card=goblin-grunt`);
  await expect.poll(async () => (await view(me)).seq, { timeout: 8000 }).toBeGreaterThan(v.seq);
  await expect.poll(async () => (await view(them)).seq, { timeout: 8000 }).toBeGreaterThan(v.seq);
  return (await me.evaluate(async () => await window.oreheart.legalActions())).find((x) => x.type === 'summon');
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

test('AC673: a refused join is never quiet: a wrong code and your own code each put the reason in a box that has to be closed, and the button comes back', async ({ browser }) => {
  test.setTimeout(60000);
  const id = uniq();
  const a = await openAs(browser, 'alice' + id);
  await atMenu(a);
  const made = await hook(a, 'create', 'grubnak', 'goblin-warband'); // the hook lands on the code screen; a reload keeps the code live and goes back to the menu
  expect(made.ok).toBe(true);
  await a.goto(a.url()); await atMenu(a);
  await a.click('[data-testid=pvp-play-friend]');
  await a.click('[data-testid=pvp-join]');
  const wrong = made.code === 'ZZZZZZ' ? 'YYYYYY' : 'ZZZZZZ';
  await a.fill('[data-testid=pvp-code-input]', wrong);
  await a.click('[data-testid=pvp-join-go]');
  const box = a.locator('[data-testid=pvp-join-refused]');
  await expect(box).toBeVisible();
  await expect(box).toContainText(wrong);
  await expect(box).toContainText(/six letters/i);
  await expect(a.locator('[data-testid=pvp-join-go]')).toBeEnabled();
  await a.keyboard.press('Escape');
  await expect(box).toHaveCount(0);
  await a.fill('[data-testid=pvp-code-input]', made.code); // my own code, from this same signed-in window
  await a.click('[data-testid=pvp-join-go]');
  await expect(box).toBeVisible();
  await expect(box).toContainText(/same player/i);
  await expect(box).toContainText(/Incognito/);
  await expect(a.locator('.net-alert')).toContainText(/same player/i);
  await a.click('[data-testid=pvp-refused-ok]');
  await expect(box).toHaveCount(0);
  await expect(a.locator('[data-testid=pvp-join-go]')).toBeEnabled();
  await closeAll(a);
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

// ---- Gauge's list (Nov 2): Respond pace and the menu layout
test('AC610: holding no counter you can play, there is no Respond dialog and no click: a small note shows and the browser answers by itself after about 2 s; a window running out is never a timeout', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  await keepHands(a, b);
  const [me, them] = await whoseTurn(a, b);
  let autoSeen = 0;
  for (let i = 0; i < 4 && !autoSeen; i++) {
    const legal = await me.evaluate(async () => await window.oreheart.legalActions());
    const summon = legal.find((x) => x.type === 'summon');
    if (!summon) break;
    const r = await me.evaluate(async (x) => await window.oreheart.act(x), summon);
    expect(r && r.ok).toBe(true);
    await expect.poll(async () => (await view(them)).state.board.creatures.length, { timeout: 10000 }).toBeGreaterThan(0); // Nov 4: the unit lands at once, no window per unit
    expect(await me.evaluate(async () => await window.oreheart.act({ type: 'done' }))).toMatchObject({ ok: true }); // Done opens the one window for the phase
    await expect.poll(async () => { const v = await view(them); return !!(v.state.pendingResponse && v.state.pendingResponse.responder === 'player'); }, { timeout: 10000 }).toBe(true);
    const t0 = Date.now();
    await expect(them.locator('[data-testid=pvp-auto-pass], .respond-dlg').first()).toBeVisible({ timeout: 5000 });
    if (await them.locator('[data-testid=pvp-auto-pass]').count()) {
      autoSeen++;
      await expect(them.locator('.respond-dlg')).toHaveCount(0);
      await expect.poll(async () => (await view(them)).state.pendingResponse, { timeout: 6000 }).toBeNull();
      const ms = Date.now() - t0;
      expect(ms, 'answered by itself after about 2 s').toBeGreaterThan(1200);
      expect(ms).toBeLessThan(4500);
      await expect(them.locator('[data-testid=pvp-auto-pass]')).toHaveCount(0);
      expect((await view(them)).timeouts.me).toBe(0);
    } else {
      await them.getByRole('button', { name: 'Let it happen' }).click(); // this hand could respond: the normal dialog, try the next summon
      await expect.poll(async () => (await view(them)).state.pendingResponse, { timeout: 6000 }).toBeNull();
    }
    await expect.poll(async () => (await view(me)).state.pendingResponse, { timeout: 6000 }).toBeNull();
  }
  expect(autoSeen, 'at least one window answered by itself').toBeGreaterThan(0);
  await closeAll(a, b);
});

test('AC671: a holder who clicks "Let it happen" at once looks the same as holding nothing: the window lasts at least 2 s for the attacker, no pass is refused', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  await keepHands(a, b);
  const [me, them] = await whoseTurn(a, b);
  const v = await view(them);
  const give = await fetch(`http://127.0.0.1:${MOCK_PORT}/debug/give?matchId=${v.matchId}&user=${encodeURIComponent(v.names.me)}&card=hold-it`);
  expect((await give.json()).ok).toBe(true);
  await expect.poll(async () => (await view(them)).state.players.player.hand.some((h) => h.cardId === 'hold-it'), { timeout: 8000 }).toBe(true);
  const held = await view(them);
  const vm = await view(me); // the attacker's random hand may have nothing to summon: give it a creature and crystals too
  await fetch(`http://127.0.0.1:${MOCK_PORT}/debug/give?matchId=${vm.matchId}&user=${encodeURIComponent(vm.names.me)}&card=goblin-grunt`);
  await expect.poll(async () => (await view(me)).seq, { timeout: 8000 }).toBeGreaterThan(vm.seq); // the gift moved the match on: act from the new move number
  await expect.poll(async () => (await view(them)).seq, { timeout: 8000 }).toBeGreaterThan(vm.seq);
  await expect.poll(async () => (await me.evaluate(async () => await window.oreheart.legalActions())).some((x) => x.type === 'summon'), { timeout: 8000 }).toBe(true);
  const summon = (await me.evaluate(async () => await window.oreheart.legalActions())).find((x) => x.type === 'summon');
  expect(await me.evaluate(async (x) => await window.oreheart.act(x), summon)).toMatchObject({ ok: true });
  await expect.poll(async () => (await view(me)).state.board.creatures.some((c) => c.uid === summon.uid), { timeout: 8000 }).toBe(true);
  expect(await me.evaluate(async () => await window.oreheart.act({ type: 'done' }))).toMatchObject({ ok: true }); // the window comes at Done
  await expect.poll(async () => { const w = await view(me); return !!w.state.pendingResponse; }, { timeout: 8000 }).toBe(true);
  const t0 = Date.now();
  const letIt = them.getByRole('button', { name: 'Let it happen' });
  await letIt.click({ timeout: 8000 });
  await expect(them.locator('.respond-dlg')).toHaveCount(0);
  if (Date.now() - t0 < 1000) await expect(them.locator('[data-testid=pvp-auto-pass]')).toBeVisible(); // the same note as holding nothing, not a frozen board (a click after the 2 s has no wait left to show it for)
  await expect.poll(async () => (await view(me)).state.pendingResponse, { timeout: 8000, intervals: [50] }).toBeNull();
  const ms = Date.now() - t0;
  expect(ms, 'the attacker waited at least about 2 s').toBeGreaterThan(1500);
  expect(ms, 'well before the 12 s run-out').toBeLessThan(9000);
  expect(held.state.players.player.hand.some((h) => h.cardId === 'hold-it')).toBe(true);
  const log = await hook(them, 'actLog');
  expect((log || []).filter((e) => !e.ok), 'no refused answers: ' + JSON.stringify(log)).toEqual([]);
  await closeAll(a, b);
});

test('AC675: PvP has no wait per unit: a placed unit lands at once on both screens, the next card is playable immediately, and the one Respond window comes at Done', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  await keepHands(a, b);
  const [me, them] = await whoseTurn(a, b);
  const summon = await sureSummon(me, them);
  expect(summon).toBeTruthy();
  // act, and read the board this instant: the unit is real and there is no window
  const r = await me.evaluate((x) => { const r = window.oreheart.act(x); const figs = window.oreheart.figuresNow().filter((f) => f.uid === x.uid); const st = window.oreheart.getState(); return { r, figs, pend: !!st.pendingResponse, onBoard: st.board.creatures.some((c) => c.uid === x.uid), next: window.oreheart.legalActions().filter((l) => l.type === 'summon' || l.type === 'done').length }; }, summon);
  expect(r.r.ok).toBe(true);
  expect(r.pend, 'no window per unit: ' + JSON.stringify(r)).toBe(false);
  expect(r.onBoard).toBe(true);
  expect(r.figs.length, 'the figure is on the board at the drop').toBe(1);
  expect(r.figs[0]).toMatchObject({ row: summon.row, col: summon.col, ghost: false });
  expect(r.next, 'the next play is open at once').toBeGreaterThan(0);
  // the other player sees it land (mirrored square), with no answer asked of them yet
  await expect.poll(() => them.evaluate((uid) => { const f = window.oreheart.figuresNow().find((f) => f.uid === uid); const st = window.oreheart.getState(); return f ? { row: f.row, col: f.col, pend: !!st.pendingResponse } : null; }, summon.uid), { timeout: 8000 }).toEqual({ row: 8 - summon.row, col: 14 - summon.col, pend: false });
  // Done: the one window for the phase, with that unit in it
  expect(await me.evaluate(async () => await window.oreheart.act({ type: 'done' }))).toMatchObject({ ok: true });
  await expect.poll(async () => { const v = await view(them); return v.state.pendingResponse && v.state.pendingResponse.kind; }, { timeout: 8000 }).toBe('deploy');
  expect((await view(them)).state.pendingResponse.summons.some((s) => s.uid === summon.uid)).toBe(true);
  await expect.poll(async () => (await view(me)).state.phase, { timeout: 15000 }).toBe('action'); // the window closes (2 s hold), the phase moves on
  const log = await hook(me, 'actLog');
  expect(log.filter((e) => !e.ok)).toEqual([]);
  await closeAll(a, b);
});

test('AC678: boom boom boom: three units in a row with no wait between them (drop-to-next-card-playable well under half a second each, nothing on the network), and the server agrees', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  await keepHands(a, b);
  const [me, them] = await whoseTurn(a, b);
  const v = await view(me);
  for (const card of ['goblin-grunt', 'goblin-grunt', 'goblin-grunt']) await fetch(`http://127.0.0.1:${MOCK_PORT}/debug/give?matchId=${v.matchId}&user=${encodeURIComponent(v.names.me)}&card=${card}`);
  await expect.poll(async () => (await view(me)).seq, { timeout: 8000 }).toBeGreaterThanOrEqual(v.seq + 3);
  await expect.poll(async () => (await view(them)).seq, { timeout: 8000 }).toBeGreaterThanOrEqual(v.seq + 3);
  const t = await me.evaluate(() => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      const s = window.oreheart.legalActions().find((l) => l.type === 'summon');
      if (!s) { out.push({ i, noSummon: true }); break; }
      const r = window.oreheart.act(s);
      const nextOpen = window.oreheart.legalActions().some((l) => l.type === 'summon' || l.type === 'done');
      out.push({ i, ok: r.ok, ms: Math.round(performance.now() - t0), nextOpen, onBoard: window.oreheart.getState().board.creatures.length });
    }
    return out;
  });
  expect(t.length, JSON.stringify(t)).toBe(3);
  for (const x of t) { expect(x.ok, JSON.stringify(t)).toBe(true); expect(x.nextOpen).toBe(true); expect(x.ms, 'local rules only, no network: ' + JSON.stringify(t)).toBeLessThan(400); }
  expect(t[2].onBoard).toBeGreaterThanOrEqual(3);
  // the server took all three in order, and the other screen shows all three
  await expect.poll(async () => (await view(me)).state.board.creatures.length, { timeout: 10000 }).toBeGreaterThanOrEqual(3);
  await expect.poll(async () => (await view(them)).state.board.creatures.filter((c) => c.owner === 'opponent').length, { timeout: 10000 }).toBeGreaterThanOrEqual(3);
  expect((await hook(me, 'actLog')).filter((e) => !e.ok)).toEqual([]);
  await closeAll(a, b);
});

test('AC679: armed counters: in PvP an attack resolves at once with no Respond window (under 600 ms on both screens); a counter set ahead of time on the defender fires by itself, paid then, and stays secret until it fires', async ({ browser }) => {
  test.setTimeout(150000);
  const { a, b } = await pair(browser);
  await keepHands(a, b);
  let [me, them] = await whoseTurn(a, b);
  const v0 = await view(me);
  expect(v0.state.attackMode, 'the referee runs the match in armed mode').toBe('armed');
  // two units face to face in the middle (real coordinates), one each, on free squares
  const taken = new Set(v0.state.sites.map((x) => x.row + ',' + x.col));
  let spot = null;
  for (let r = 3; r <= 5 && !spot; r++) for (let c = 4; c <= 9 && !spot; c++) if (!taken.has(r + ',' + c) && !taken.has(r + ',' + (c + 1))) spot = { r, c };
  expect(spot).toBeTruthy();
  const place = async (pg, card, r, c) => { const v = await view(pg); const x = await (await fetch(`http://127.0.0.1:${MOCK_PORT}/debug/place?matchId=${v.matchId}&user=${encodeURIComponent(v.names.me)}&card=${card}&row=${r}&col=${c}`)).json(); expect(x.ok, JSON.stringify(x)).toBe(true); return x.uid; };
  await place(me, 'goblin-grunt', spot.r, spot.c);
  await place(them, 'goblin-grunt', spot.r, spot.c + 1);
  await fetch(`http://127.0.0.1:${MOCK_PORT}/debug/give?matchId=${v0.matchId}&user=${encodeURIComponent((await view(them)).names.me)}&card=shield-bubble`);
  await expect.poll(async () => (await view(them)).state.board.creatures.length, { timeout: 8000 }).toBe(2);
  await expect.poll(async () => (await view(me)).state.players.opponent.hand.length, { timeout: 8000 }).toBeGreaterThan(0);
  // my turn passes with nothing done; the defender's turn: they set Shield Bubble on their unit (costs nothing yet, card stays in hand, I never see it)
  for (const _ of [1, 2]) { await expect.poll(async () => { const v = await view(me); return v.state.priority === 'player' && !v.state.pendingResponse; }, { timeout: 8000 }).toBe(true); expect(await me.evaluate(async () => await window.oreheart.act({ type: 'done' }))).toMatchObject({ ok: true }); }
  await expect.poll(async () => { const v = await view(them); return v.state.activePlayer === 'player' && v.state.priority === 'player' && !v.state.pendingResponse; }, { timeout: 10000 }).toBe(true);
  const armed = await them.evaluate(() => {
    const st = window.oreheart.getState(); const hand = st.players.player.hand.length, funds = st.players.player.crystals + st.players.player.bank;
    const arm = window.oreheart.legalActions().find((l) => l.type === 'arm' && l.target && l.target.row && st.board.creatures.some((c) => c.owner === 'player' && c.row === l.target.row && c.col === l.target.col));
    if (!arm) return { arm: null, legal: window.oreheart.legalActions() };
    const r = window.oreheart.act(arm);
    const st2 = window.oreheart.getState();
    return { arm, ok: r.ok, handAfter: st2.players.player.hand.length, hand, fundsAfter: st2.players.player.crystals + st2.players.player.bank, funds, set: st2.armed.player.length };
  });
  expect(armed.arm, 'an arm action on the defender\'s own unit: ' + JSON.stringify(armed.legal || '')).toBeTruthy();
  expect(armed.ok).toBe(true);
  expect(armed.handAfter, 'the card stays in the hand').toBe(armed.hand);
  expect(armed.fundsAfter, 'arming is free until it fires').toBe(armed.funds);
  expect(armed.set).toBe(1);
  await them.waitForTimeout(1500);
  const badge = await them.evaluate(() => ({ badges: document.querySelectorAll('.hand-card .armed-badge').length, cards: document.querySelectorAll('.hand-card').length, armed: window.oreheart.getState().armed, hand: window.oreheart.getState().players.player.hand.map((h) => h.uid).join(','), dom: [...document.querySelectorAll('.hand-card')].map((e) => e.dataset.uid + '/' + e.className.replace(/\s+/g, '.')).join(' ') }));
  expect(badge.badges, 'the SET badge on the hand card: ' + JSON.stringify(badge) + ' log=' + JSON.stringify(await hook(them, 'actLog'))).toBeGreaterThan(0);
  await expect.poll(async () => (await view(them)).state.armed.player.length, { timeout: 8000 }).toBe(1); // the server has it
  expect((await view(me)).state.armed.opponent, 'secret from the attacker').toEqual([]);
  // the defender ends their turn (no Done window: nothing deployed); my turn, straight to Action, attack their unit
  for (const _ of [1, 2]) { await expect.poll(async () => { const v = await view(them); return v.state.priority === 'player' && !v.state.pendingResponse; }, { timeout: 8000 }).toBe(true); expect(await them.evaluate(async () => await window.oreheart.act({ type: 'done' }))).toMatchObject({ ok: true }); }
  await expect.poll(async () => { const v = await view(me); return v.state.activePlayer === 'player' && v.state.phase === 'deploy' && !v.state.pendingResponse; }, { timeout: 10000 }).toBe(true);
  expect(await me.evaluate(async () => await window.oreheart.act({ type: 'done' }))).toMatchObject({ ok: true });
  await expect.poll(async () => (await view(me)).state.phase, { timeout: 8000 }).toBe('action');
  const theirsHpBefore = (await view(them)).state.board.creatures.find((c) => c.owner === 'player').health;
  const t = await me.evaluate(async () => {
    const atk = window.oreheart.legalActions().find((l) => l.type === 'attack');
    if (!atk) return { atk: null, legal: window.oreheart.legalActions() };
    const t0 = performance.now();
    const r = window.oreheart.act(atk);
    let sawWindow = false, done = 0;
    while (performance.now() - t0 < 8000) {
      const st = window.oreheart.getState();
      if (st.pendingResponse) sawWindow = true;
      const u = st.board.creatures.find((c) => c.uid === atk.creatureUid);
      if (u && u.hasAttacked) { done = performance.now() - t0; break; }
      await new Promise((f) => setTimeout(f, 10));
    }
    return { atk, ok: r.ok, sawWindow, ms: Math.round(done) };
  });
  expect(t.atk, 'an attack is legal: ' + JSON.stringify(t.legal || '')).toBeTruthy();
  expect(t.ok).toBe(true);
  expect(t.sawWindow, 'no Respond window on an attack').toBe(false);
  expect(t.ms, 'the attack is settled on the attacker\'s screen').toBeGreaterThan(0);
  expect(t.ms).toBeLessThan(600);
  // the defender's screen: the counter fired (card gone from the hand, paid), the bubble took the hit, no window either
  const d = await them.evaluate(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 8000) { const st = window.oreheart.getState(); if (st.armed.player.length === 0) break; await new Promise((f) => setTimeout(f, 10)); }
    const st = window.oreheart.getState();
    return { ms: Math.round(performance.now() - t0), hand: st.players.player.hand.length, set: st.armed.player.length, pend: !!st.pendingResponse, hp: st.board.creatures.find((c) => c.owner === 'player').health, discard: st.players.player.discard.map((c) => c.cardId) };
  });
  expect(d.set, 'the counter fired').toBe(0);
  expect(d.pend).toBe(false);
  expect(d.discard).toContain('shield-bubble');
  expect(d.hp, 'the unit lives (the bubble took a hit; a second hit of the same swing may land)').toBeGreaterThan(0);
  expect((await view(me)).state.pendingResponse).toBeNull();
  expect((await hook(me, 'actLog')).filter((e) => !e.ok)).toEqual([]);
  expect((await hook(them, 'actLog')).filter((e) => !e.ok)).toEqual([]);
  await closeAll(a, b);
});

test('AC682: modes: the menu offers Ranked, Unranked and Play a friend with a rank line; two players who pick Unranked are paired by the queue and land in the same match (seat a = the longer wait); a practice code says it pays nothing', async ({ browser }) => {
  test.setTimeout(120000);
  const id = uniq();
  const a = await openAs(browser, 'alice' + id), b = await openAs(browser, 'bob' + id);
  await atMenu(a); await atMenu(b);
  for (const t of ['pvp-ranked', 'pvp-unranked', 'pvp-play-friend']) await expect(a.locator(`[data-testid="${t}"]`)).toBeVisible();
  await expect(a.locator('[data-testid="pvp-rank"]')).toContainText(/Ranked: 1000 Sapphire III/, { timeout: 10000 });
  // Alice waits in the unranked queue; Bob joins it 3 s later and the server pairs them
  const pa = a.evaluate(() => window.oreheart.pvp.queue('unranked', 'grubnak', 'goblin-warband'));
  await expect(a.locator('[data-testid="pvp-queue-status"]')).toContainText(/Looking for an opponent \(rating 1000/, { timeout: 10000 });
  await a.waitForTimeout(3000);
  const rb = await b.evaluate(() => window.oreheart.pvp.queue('unranked', 'borgo', 'dwarf-warband'));
  expect(rb && rb.ok && rb.matchId, JSON.stringify(rb)).toBeTruthy();
  const ra = await pa;
  expect(ra && ra.ok && ra.matchId, JSON.stringify(ra)).toBeTruthy();
  expect(ra.matchId).toBe(rb.matchId);
  await inMatch(a); await inMatch(b);
  const va = await view(a), vb = await view(b);
  expect(va.state.players.player.commanderId).toBe('grubnak');
  expect(vb.state.players.player.commanderId).toBe('borgo');
  expect(va.names.them).toBe(vb.names.me);
  // the server knows the mode
  const m = await (await fetch(`http://127.0.0.1:${MOCK_PORT}/debug/views?matchId=${va.matchId}&user=${encodeURIComponent(va.names.me)}`)).json();
  expect(m.ok).toBe(true);
  await closeAll(a, b);
  // a practice code: the screen says so and the server marks the code
  const c = await openAs(browser, 'carol' + id);
  await atMenu(c);
  await c.locator('[data-testid="pvp-play-friend"]').click();
  await c.locator('[data-testid="pvp-practice"]').click();
  await expect(c.locator('[data-testid="pvp-practice-note"]')).toContainText(/pays and counts nothing/);
  const made = await hook(c, 'create', 'grubnak', 'goblin-warband', true);
  expect(made && made.ok && made.code, JSON.stringify(made)).toBeTruthy();
  await closeAll(c);
});

test('AC683: upgraded cards in a match: a Mythic in the hand shows its stars; dropping it makes the entrance on BOTH screens (overlay under 1.5 s, KA-BOOM, the name), the unit keeps a halo, and the next play is open at once', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  await keepHands(a, b);
  const [me, them] = await whoseTurn(a, b);
  const v = await view(me);
  await fetch(`http://127.0.0.1:${MOCK_PORT}/debug/give?matchId=${v.matchId}&user=${encodeURIComponent(v.names.me)}&card=goblin-grunt`);
  await fetch(`http://127.0.0.1:${MOCK_PORT}/debug/tier?matchId=${v.matchId}&user=${encodeURIComponent(v.names.me)}&card=goblin-grunt&tier=5`);
  await expect.poll(async () => { const x = await view(me); return x.tiers && x.tiers.me && x.tiers.me['goblin-grunt']; }, { timeout: 8000 }).toBe(5);
  await expect.poll(async () => { const x = await view(them); return x.tiers && x.tiers.them && x.tiers.them['goblin-grunt']; }, { timeout: 8000 }).toBe(5);
  // the hand card wears five stars (both players know; the other player's hand is hidden anyway)
  await expect.poll(() => me.evaluate(() => { const el = [...document.querySelectorAll('.hand-card')].find((e) => e.dataset.tier === '5'); return el ? el.querySelectorAll('.oh-stars[data-tier="5"] i').length : 0; }), { timeout: 8000 }).toBe(5);
  const t = await me.evaluate(() => {
    const st = window.oreheart.getState();
    const hc = st.players.player.hand.find((h) => h.cardId === 'goblin-grunt');
    const s = window.oreheart.legalActions().find((l) => l.type === 'summon' && l.uid === hc.uid);
    if (!s) return { s: null, legal: window.oreheart.legalActions().length };
    const t0 = performance.now();
    const r = window.oreheart.act(s);
    const nextOpen = window.oreheart.legalActions().some((l) => l.type === 'summon' || l.type === 'done');
    const ov = document.querySelector('.tier-entrance');
    return { s, ok: r.ok, ms: Math.round(performance.now() - t0), nextOpen, overlay: ov ? { tier: ov.dataset.tier, owner: ov.dataset.owner, text: ov.textContent } : null };
  });
  expect(t.s, 'the Mythic can be summoned: ' + JSON.stringify(t)).toBeTruthy();
  expect(t.ok).toBe(true);
  expect(t.nextOpen, 'the next play is open the same instant').toBe(true);
  expect(t.overlay, 'the entrance overlay on the player\'s own screen').toMatchObject({ tier: '5', owner: 'player' });
  expect(t.overlay.text).toMatch(/plays a MYTHIC!/);
  // the other screen gets the same entrance, with the summoner's name
  await expect.poll(() => them.evaluate(() => { const ov = document.querySelector('.tier-entrance'); return ov ? ov.dataset.tier + ':' + ov.dataset.owner : ''; }), { timeout: 8000 }).toBe('5:opponent');
  expect(await them.evaluate(() => document.querySelector('.tier-entrance').textContent)).toContain((await view(me)).names.me);
  // it is gone within 1.5 s and the unit keeps its halo on both screens
  await expect.poll(() => me.evaluate(() => !!document.querySelector('.tier-entrance')), { timeout: 2500 }).toBe(false);
  await expect.poll(() => me.evaluate((uid) => { const u = window.oreheart.unitTiers().find((x) => x.uid === uid); return u ? u.tier + ':' + u.halo : ''; }, t.s.uid), { timeout: 8000 }).toBe('5:true');
  await expect.poll(() => them.evaluate((uid) => { const u = window.oreheart.unitTiers().find((x) => x.uid === uid); return u ? u.tier + ':' + u.halo : ''; }, t.s.uid), { timeout: 8000 }).toBe('5:true');
  expect((await hook(me, 'actLog')).filter((e) => !e.ok)).toEqual([]);
  await closeAll(a, b);
});

test('AC684: the connection clock and the average wait (Ken, Nov 5): while searching a timer counts up locally ("Searching… 0:02"), the average wait line shows ("not enough players yet" with no recent pairings, "~m:ss" once there are), the clock never sends a request of its own; a friend code shows the clock too', async ({ browser }) => {
  test.setTimeout(120000);
  const id = uniq();
  const a = await openAs(browser, 'alice' + id);
  await atMenu(a);
  const pa = a.evaluate(() => window.oreheart.pvp.queue('unranked', 'grubnak', 'goblin-warband'));
  const timer = a.locator('[data-testid="pvp-wait-timer"]');
  await expect(timer).toBeVisible({ timeout: 15000 });
  await expect(timer).toHaveText(/^Searching… 0:0\d$/);
  await expect(a.locator('[data-testid="pvp-wait-avg"]')).toHaveText('Average wait: not enough players yet');
  const t0 = await timer.textContent();
  await a.waitForTimeout(2200);
  const t1 = await timer.textContent();
  expect(t1).not.toBe(t0);
  expect(Number(t1.slice(-1)) - Number(t0.slice(-1))).toBeGreaterThanOrEqual(2);
  // the clock ticks without network: the act log has only the queue polls (one every 2 s, not every second)
  const calls = await a.evaluate(() => performance.getEntriesByType('resource').filter((e) => /\/match\b/.test(e.name)).length);
  expect(calls, 'the menu makes a couple of calls (my_match, rank), then one queue poll every 2 s: never one a second').toBeLessThan(9);
  await a.evaluate(() => window.oreheart.pvp.leave());
  await pa.catch(() => null);
  await closeAll(a);
  // three quick pairings, then a searcher sees a real average
  const names = [];
  for (let i = 0; i < 3; i++) {
    const x = await openAs(browser, 'x' + i + id), y = await openAs(browser, 'y' + i + id);
    await atMenu(x); await atMenu(y);
    const px = x.evaluate(() => window.oreheart.pvp.queue('unranked', 'grubnak', 'goblin-warband'));
    await expect(x.locator('[data-testid="pvp-wait-timer"]')).toBeVisible({ timeout: 10000 });
    const ry = await y.evaluate(() => window.oreheart.pvp.queue('unranked', 'borgo', 'dwarf-warband'));
    expect(ry && ry.ok && ry.matchId, JSON.stringify(ry)).toBeTruthy();
    await px;
    names.push(x, y);
  }
  await closeAll(...names);
  const z = await openAs(browser, 'z' + id);
  await atMenu(z);
  const pz = z.evaluate(() => window.oreheart.pvp.queue('ranked', 'grubnak', 'goblin-warband'));
  await expect(z.locator('[data-testid="pvp-wait-avg"]')).toHaveText('Average wait: not enough players yet', { timeout: 10000 }); // ranked has none
  await z.evaluate(() => window.oreheart.pvp.leave());
  await pz.catch(() => null);
  const pz2 = z.evaluate(() => window.oreheart.pvp.queue('unranked', 'grubnak', 'goblin-warband'));
  await expect(z.locator('[data-testid="pvp-wait-avg"]')).toHaveText(/^Average wait right now: ~\d+:\d\d$/, { timeout: 10000 }); // unranked has three
  await z.evaluate(() => window.oreheart.pvp.leave());
  await pz2.catch(() => null);
  // a friend code shows the clock while waiting
  const made = await hook(z, 'create', 'grubnak', 'goblin-warband');
  expect(made && made.ok).toBe(true);
  await expect(z.locator('[data-testid="pvp-wait-timer"]')).toHaveText(/^Waiting… 0:0\d$/, { timeout: 10000 });
  await closeAll(z);
});

test('AC685: PvP mulligan at the same time (Ken, Nov 5): both players see their own hand and the Mulligan choice at once; after one confirms they see "Waiting for opponent…" while the other still picks; the match starts when both have; hands stay hidden from each other', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  // both are asked at the same moment (no "your friend first")
  for (const p of [a, b]) {
    await expect.poll(() => p.evaluate(() => { const st = window.oreheart.getState(); return st && st.phase === 'mulligan' && window.oreheart.legalActions().some((l) => l.type === 'mulligan'); }), { timeout: 15000 }).toBe(true);
    await expect(p.getByRole('button', { name: 'Keep Hand' })).toBeVisible({ timeout: 10000 });
    expect(await p.evaluate(() => { const st = window.oreheart.getState(); return st.players.player.hand.length > 0 && st.players.opponent.hand.every((h) => h.hidden); })).toBe(true);
  }
  // Bob (seat b) keeps first; Alice still has her choice open, Bob waits
  await b.getByRole('button', { name: 'Keep Hand' }).click();
  await expect(b.getByTestId('mull-wait')).toHaveText('Waiting for opponent…', { timeout: 10000 });
  await expect.poll(async () => (await view(a)).state.mulliganDone, { timeout: 10000 }).toEqual({ player: false, opponent: true });
  await expect(a.getByRole('button', { name: 'Keep Hand' })).toBeVisible();
  await a.getByRole('button', { name: 'Keep Hand' }).click();
  for (const p of [a, b]) await expect.poll(async () => (await view(p)).state.phase, { timeout: 10000 }).toBe('deploy');
  expect(await b.getByTestId('mull-wait').count()).toBe(0);
  expect((await hook(a, 'actLog')).filter((e) => !e.ok)).toEqual([]);
  expect((await hook(b, 'actLog')).filter((e) => !e.ok)).toEqual([]);
  await closeAll(a, b);
});

test('AC677: a card dropped from the hand spawns its REAL model at once (models load with the hand), and a model still on its way is a shimmer, never a pawn', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  await keepHands(a, b);
  const [me, them] = await whoseTurn(a, b);
  const summon = await sureSummon(me, them);
  const cardId = await me.evaluate((uid) => window.oreheart.getState().players.player.hand.find((h) => h.uid === uid).cardId, summon.uid);
  await expect.poll(() => me.evaluate((id) => window.oreheart.modelsReady([id]), cardId), { timeout: 20000 }).toBe(true); // in the hand = already loaded, nothing on the board yet
  const r = await me.evaluate((x) => { window.oreheart.act(x); return window.oreheart.figuresNow().find((f) => f.uid === x.uid); }, summon);
  expect(r, 'on the board at the drop').toBeTruthy();
  expect(r).toMatchObject({ real: true, shimmer: false, ghost: false, born: true });
  await expect.poll(() => me.evaluate((uid) => window.oreheart.figuresNow().find((f) => f.uid === uid).born, summon.uid), { timeout: 5000 }).toBe(false); // the spawn hop ends, the figure stays the same one
  // the other player: if the model was not there yet it is a shimmer that becomes the real model, never a pawn
  await expect.poll(() => them.evaluate((uid) => { const f = window.oreheart.figuresNow().find((f) => f.uid === uid); return f && (f.real || f.shimmer); }, summon.uid), { timeout: 15000 }).toBe(true);
  await expect.poll(() => them.evaluate((uid) => { const f = window.oreheart.figuresNow().find((f) => f.uid === uid); return f && f.real; }, summon.uid), { timeout: 20000 }).toBe(true);
  await closeAll(a, b);
});

test('AC676: same-faction match: on this screen the opponent units wear ruby rings and your own keep the normal colour; different factions are unchanged (display only, no server)', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => !!window.oreheart && !!window.oreheart.newMatch);
  const setup = { playerHand: [], opponentHand: [], board: [{ owner: 'player', cardId: 'goblin-grunt', row: 5, col: 4 }, { owner: 'opponent', cardId: 'goblin-grunt', row: 3, col: 10 }] };
  const rings = async (opp) => {
    await page.evaluate(([setup, opp]) => { window.oreheart.newMatch({ playerCommander: 'grubnak', opponentCommander: opp, setup, skipMulligan: true, seed: 3 }); }, [setup, opp]);
    await expect.poll(async () => (await page.evaluate(async () => (await window.oreheart.getRenderStats()).unitRings)).length, { timeout: 15000 }).toBe(2);
    const r = await page.evaluate(async () => (await window.oreheart.getRenderStats()).unitRings);
    return Object.fromEntries(r.map((x) => [x.side, x.color.toLowerCase()]));
  };
  const same = await rings('grubnak');
  expect(same.opponent, 'opponent ring in the mirror look: ' + JSON.stringify(same)).toBe('#ff3b4a');
  expect(same.player).not.toBe('#ff3b4a');
  // the opponent's Commander too, and only theirs (the two Grubnaks start out sharing one set of materials)
  await expect.poll(() => page.evaluate(() => window.oreheart.commanderLook().opponent), { timeout: 15000 }).toBeGreaterThan(0);
  expect((await page.evaluate(() => window.oreheart.commanderLook())).player).toBe(0);
  const diff = await rings('borgo');
  expect(diff.opponent).not.toBe('#ff3b4a');
  await expect.poll(() => page.evaluate(() => window.oreheart.commanderLook()), { timeout: 15000 }).toEqual({ player: 0, opponent: 0 });
  expect(diff.player).toBe(same.player);
  // the ruby look is a material change on the opponent's figures only
  const marked = await page.evaluate(() => window.oreheart.figuresNow().length);
  expect(marked).toBe(2);
});

test('AC672: the deck list opens as a painted list, not the browser\'s, and picking one changes the deck', async ({ browser }) => {
  test.setTimeout(60000);
  const a = await openAs(browser, 'deck' + uniq());
  await atMenu(a);
  await a.click('[data-testid=pvp-play-friend]');
  await a.click('[data-testid=pvp-make]');
  const open = a.locator('[data-testid=pvp-deck-open]');
  await expect(open).toBeVisible();
  const first = await open.textContent();
  await open.click();
  const items = a.locator('.pvp-deck-item');
  await expect(a.locator('.pvp-deck-menu')).toBeVisible();
  expect(await items.count()).toBeGreaterThan(1);
  const other = items.filter({ hasNotText: first }).first();
  const name = await other.textContent();
  await other.click();
  await expect(a.locator('.pvp-deck-menu')).toBeHidden();
  await expect(open).toHaveText(name);
  expect(await a.locator('[data-testid=pvp-deck]').evaluate((e) => e.selectedOptions[0].textContent)).toBe(name);
  await a.keyboard.press('Enter');
  await expect(a.locator('.pvp-deck-menu')).toBeVisible();
  await a.keyboard.press('Escape');
  await expect(a.locator('.pvp-deck-menu')).toBeHidden();
  const bg = await open.evaluate((e) => getComputedStyle(e).backgroundImage);
  expect(bg).toContain('frame-chip');
  await a.locator('.pvp-cmd[data-commander=borgo]').click();
  await expect(open).not.toHaveText(name); // another Commander's decks
  await closeAll(a);
});

for (const size of [{ width: 1600, height: 900 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
  test(`AC611: the signed-in menu extras sit clear of the logo and the menu words, on screen (${size.width}x${size.height})`, async ({ browser }) => {
    const page = await openAs(browser, 'lay' + uniq(), size);
    await atMenu(page);
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, n: (e.textContent || e.dataset.id || '').trim().slice(0, 20) }; };
      const extras = [...document.querySelectorAll('.menu-side .net-btn, .menu-side .econ-coins')].map(box);
      const fixed = [...document.querySelectorAll('.mb-pc[data-id=mainLogo], .mb-btn, .title-display')].map(box);
      return { extras, fixed, w: innerWidth, h: innerHeight };
    });
    expect(r.extras.length).toBeGreaterThanOrEqual(5);
    for (const e of r.extras) {
      expect(e.l, e.n).toBeGreaterThanOrEqual(0); expect(e.t, e.n).toBeGreaterThanOrEqual(0);
      expect(e.r, e.n).toBeLessThanOrEqual(r.w); expect(e.b, e.n).toBeLessThanOrEqual(r.h);
      for (const f of r.fixed) expect(e.l < f.r && f.l < e.r && e.t < f.b && f.t < e.b, e.n + ' overlaps ' + f.n).toBe(false);
    }
    await closeAll(page);
  });
}

test('AC695: server regions (Ken, Nov 5): the lobby lists US East, Central and West with a ping and live counts (online, playing, waiting) and the nearest is lit; a tap switches the server and the dashboard pill names it; two players on different servers are not paired, "Search all regions" is offered after the fallback time (4 s on the stand-in server) and taking it pairs them', async ({ browser }) => {
  test.setTimeout(120000);
  const id = uniq();
  const a = await openAs(browser, 'alice' + id), b = await openAs(browser, 'bob' + id);
  await atMenu(a); await atMenu(b);
  // the picker in the lobby's left column
  await a.locator('[data-testid="pvp-ranked"]').click();
  const picker = a.locator('[data-testid="lobby-server"]');
  await expect(picker).toBeVisible({ timeout: 10000 });
  for (const r of ['us-east', 'us-central', 'us-west']) {
    const row = picker.locator(`[data-testid="region-${r}"]`);
    await expect(row).toBeVisible();
    await expect(row.locator('[data-testid="region-ping"]')).toHaveText(/^\d+ ms$/, { timeout: 10000 });
    await expect(row.locator('.cnt')).toHaveText(/^\d+ online · \d+ playing · \d+ waiting$/);
  }
  await expect(picker.locator('[data-testid="region-us-east"]')).toHaveAttribute('aria-checked', 'true'); // the nearest by ping
  await expect(picker.locator('[data-testid="region-note"]')).toContainText(/nearest by ping/);
  expect(await a.evaluate(() => window.oreheart.pvp.region())).toBe('us-east');
  // a tap switches the server (remembered on this browser)
  await picker.locator('[data-testid="region-us-west"]').click();
  await expect(picker.locator('[data-testid="region-us-west"]')).toHaveAttribute('aria-checked', 'true');
  await expect(picker.locator('[data-testid="region-note"]')).toContainText(/Your server is US West/);
  expect(await a.evaluate(() => window.oreheart.pvp.region())).toBe('us-west');
  expect(await a.evaluate(() => localStorage.getItem('oreheart.region'))).toBe('us-west');
  // Alice (West) and Bob (East) wait in the same mode and are NOT paired; after the fallback Alice is offered every region
  const pa = a.evaluate(() => window.oreheart.pvp.queue('unranked', 'grubnak', 'goblin-warband', 'us-west'));
  await expect(a.locator('[data-testid="pvp-queue-status"]')).toContainText(/Looking for an opponent \(rating 1000/, { timeout: 10000 });
  const pb = b.evaluate(() => window.oreheart.pvp.queue('unranked', 'borgo', 'dwarf-warband', 'us-east'));
  await expect(b.locator('[data-testid="pvp-queue-status"]')).toContainText(/Looking for an opponent \(rating 1000/, { timeout: 10000 });
  await a.waitForTimeout(2500);
  expect(await a.locator('main.match').count(), 'West and East must not meet by themselves').toBe(0);
  const offer = a.locator('[data-testid="pvp-queue-any"]');
  await expect(offer).toBeVisible({ timeout: 10000 }); // ~4 s after the wait began on the stand-in server
  await expect(a.locator('[data-testid="pvp-queue-anybox"]')).toContainText(/Nobody near in US West yet · 1 waiting elsewhere/);
  await offer.click();
  await expect(a.locator('[data-testid="pvp-queue-anynote"]')).toHaveText('Searching every server');
  const ra = await pa, rb = await pb;
  expect(ra && ra.ok && ra.matchId, JSON.stringify(ra)).toBeTruthy();
  expect(rb && rb.ok && rb.matchId, JSON.stringify(rb)).toBeTruthy();
  expect(ra.matchId).toBe(rb.matchId);
  await inMatch(a); await inMatch(b);
  await closeAll(a, b);
  // the hook can ask for every region from the start, and the dashboard's server pill names the chosen server
  const c = await openAs(browser, 'carol' + id), d = await openAs(browser, 'dan' + id);
  await atMenu(c); await atMenu(d);
  expect(await c.evaluate(() => window.oreheart.pvp.region())).toBe('us-east'); // the Dashboard's server pill (data-testid dash-server, "US East · online") is not on the mock-menu pages these checks use (Nov 6: ?pvp=mock keeps the old menu); it is looked at on the TEST preview
  const pc = c.evaluate(() => window.oreheart.pvp.queue('ranked', 'grubnak', 'goblin-warband', 'us-central', true));
  await expect(c.locator('[data-testid="pvp-queue-anynote"]')).toHaveText('Searching every server', { timeout: 10000 });
  const rd = await d.evaluate(() => window.oreheart.pvp.queue('ranked', 'borgo', 'dwarf-warband', 'us-west'));
  expect(rd && rd.ok && rd.matchId, JSON.stringify(rd)).toBeTruthy();
  const rc = await pc;
  expect(rc.matchId).toBe(rd.matchId);
  await closeAll(c, d);
});

test('AC696: Commander copies (Ken, Nov 6): the player picks WHICH Commander copy fights; the server takes a copy he owns (else his best), and the board shows that tier on BOTH screens', async ({ browser }) => {
  test.setTimeout(120000);
  const id = uniq();
  const a = await openAs(browser, 'alice' + id), b = await openAs(browser, 'bob' + id);
  await atMenu(a); await atMenu(b);
  // alice owns an Overcharged Grubnak (the mock's collection) and picked it; bob asks for a Mythic Borgo he does not own
  const own = await (await fetch(`http://127.0.0.1:${MOCK_PORT}/debug/tier?user=${encodeURIComponent('alice' + id)}&card=commander-grubnak&tier=3`)).json();
  expect(own.ok, 'mock collection: ' + JSON.stringify(own)).toBe(true);
  await a.evaluate(() => localStorage.setItem('oreheart.cmdTier', JSON.stringify({ grubnak: 3 })));
  await b.evaluate(() => localStorage.setItem('oreheart.cmdTier', JSON.stringify({ borgo: 5 })));
  const made = await hook(a, 'create', 'grubnak', 'goblin-warband');
  expect(made && made.ok, 'create: ' + JSON.stringify(made)).toBe(true);
  const joined = await hook(b, 'join', made.code, 'borgo', 'dwarf-warband');
  expect(joined && joined.ok, 'join: ' + JSON.stringify(joined)).toBe(true);
  await inMatch(b); await inMatch(a);
  await expect.poll(async () => { const x = await view(a); return x && x.tiers && x.tiers.me ? x.tiers.me['commander-grubnak'] : null; }, { timeout: 8000 }).toBe(3);
  await expect.poll(async () => { const x = await view(b); return x && x.tiers && x.tiers.them ? x.tiers.them['commander-grubnak'] : null; }, { timeout: 8000 }).toBe(3);
  expect(((await view(b)).tiers.me || {})['commander-borgo'] || 1, 'a copy he does not own is not granted').toBe(1);
  // the board: alice's own Commander wears tier 3 and bob's stays Original, on both screens
  await expect.poll(() => a.evaluate(() => (window.oreheart.commanderTiers ? window.oreheart.commanderTiers() : null)), { timeout: 15000 }).toEqual({ player: 3, opponent: 1 });
  await expect.poll(() => b.evaluate(() => (window.oreheart.commanderTiers ? window.oreheart.commanderTiers() : null)), { timeout: 15000 }).toEqual({ player: 1, opponent: 3 });
  await closeAll(a, b);
});
