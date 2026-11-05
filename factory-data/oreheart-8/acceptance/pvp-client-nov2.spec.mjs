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

test('AC675: a placed unit stands on its square at once, on both screens, before the server or the other player has answered; it counts as arriving until the Respond window closes', async ({ browser }) => {
  test.setTimeout(120000);
  const { a, b } = await pair(browser);
  await keepHands(a, b);
  const [me, them] = await whoseTurn(a, b);
  const summon = await sureSummon(me, them);
  expect(summon).toBeTruthy();
  // act, then read the board in the SAME breath: no answer from anyone can have arrived yet
  // (figuresNow reads the board this instant; getRenderStats waits for it to settle, which can be after the window)
  const r = await me.evaluate((x) => { const r = window.oreheart.act(x); const figs = window.oreheart.figuresNow().filter((f) => f.uid === x.uid); const st = window.oreheart.getState(); return { r, figs, pend: !!st.pendingResponse, onBoard: st.board.creatures.some((c) => c.uid === x.uid) }; }, summon);
  expect(r.r.ok).toBe(true);
  expect(r.pend, 'the window opened locally at once: ' + JSON.stringify(r)).toBe(true);
  expect(r.figs.length, 'the figure is already on the board').toBe(1);
  expect(r.figs[0].ghost, 'arriving while the window is open: ' + JSON.stringify(r)).toBe(true);
  expect(r.figs[0].row).toBe(summon.row); expect(r.figs[0].col).toBe(summon.col);
  // the other player sees the arriving unit too (mirrored square), while their window is still open
  const seenByThem = async () => them.evaluate((uid) => { const f = window.oreheart.figuresNow().find((f) => f.uid === uid); const st = window.oreheart.getState(); return f ? { ghost: f.ghost, row: f.row, col: f.col, pend: st.pendingResponse && [st.pendingResponse.row, st.pendingResponse.col], onBoard: st.board.creatures.some((c) => c.uid === uid) } : null; }, summon.uid);
  await expect.poll(seenByThem, { timeout: 8000 }).not.toBeNull();
  const got = await seenByThem();
  expect(got, 'arriving unit on the other screen: ' + JSON.stringify(got)).toMatchObject({ ghost: true, row: 8 - summon.row, col: 14 - summon.col });
  // the window closes (2 s hold): the unit is real and solid on both screens
  await expect.poll(async () => (await view(me)).state.board.creatures.some((c) => c.uid === summon.uid), { timeout: 10000 }).toBe(true);
  await expect.poll(() => me.evaluate((uid) => { const f = window.oreheart.figuresNow().find((f) => f.uid === uid); return f && f.ghost; }, summon.uid), { timeout: 8000 }).toBe(false);
  await expect.poll(() => them.evaluate((uid) => { const f = window.oreheart.figuresNow().find((f) => f.uid === uid); return f && f.ghost; }, summon.uid), { timeout: 8000 }).toBe(false);
  const log = await hook(me, 'actLog');
  expect(log.filter((e) => !e.ok)).toEqual([]);
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
  expect(r).toMatchObject({ real: true, shimmer: false, ghost: true, born: true });
  // no second spawn when the window closes: the same figure just turns solid
  await expect.poll(() => me.evaluate((uid) => { const f = window.oreheart.figuresNow().find((f) => f.uid === uid); return f && f.ghost; }, summon.uid), { timeout: 10000 }).toBe(false);
  expect(await me.evaluate((uid) => window.oreheart.figuresNow().find((f) => f.uid === uid), summon.uid)).toMatchObject({ real: true, shimmer: false, born: false });
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
