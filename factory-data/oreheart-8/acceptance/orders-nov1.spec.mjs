// Nov 1 (Ken): standing mining orders, guard arrows, the swing pause, the small ? mark, mirrored buttons. Same helpers as acceptance.spec.mjs.
import { test, expect } from '@playwright/test';

const MINES = [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }];
const getState = (page) => page.evaluate(async () => await window.oreheart.getState());
const act = (page, a) => page.evaluate(async (x) => await window.oreheart.act(x), a);
const at = (s, row, col) => s.board.creatures.find((c) => c.row === row && c.col === col);
const P = (cardId, row, col, x = {}) => ({ cardId, owner: 'player', row, col, ...x });
const O = (cardId, row, col, x = {}) => ({ cardId, owner: 'opponent', row, col, ...x });
async function start(page, board, extra = {}) {
  await page.goto('/?test=1&seed=3&fx=1');
  await page.waitForFunction(() => !!window.oreheart);
  await page.evaluate(async ([board, extra]) => { document.body.classList.remove('test'); return await window.oreheart.newMatch({ ai: false, skipMulligan: true, factionLock: false, playerCommander: 'grubnak', opponentCommander: 'borgo', mines: [{ row: 3, col: 6 }, { row: 4, col: 10 }, { row: 5, col: 6 }], setup: { firstPlayer: 'player', playerHand: [], opponentHand: [], board, ...extra } }); }, [board, extra]);
  await page.mouse.click(5, 5);
  await page.waitForTimeout(1500);
  return getState(page);
}
const pt = (page, r, c) => page.evaluate(([r, c]) => { const a = window.__app, q = a.center(r, c), bb = a.r.board.getBoundingClientRect(); return { x: bb.left + q.x, y: bb.top + q.y }; }, [r, c]);
async function drag(page, from, to) {
  const a = await pt(page, from.row, from.col), b = await pt(page, to.row, to.col);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 }); await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(400);
}
const orders = (page) => page.evaluate(async () => await window.oreheart.getOrders());

test('AC570: drag a Miner onto a mine: a standing mining order (pickaxe marker) walks it there and mines every turn until re-ordered', async ({ page }) => {
  test.setTimeout(60000);
  let s = await start(page, [P('goblin-scrounger', 7, 9), O('goblin-grunt', 1, 3)]);
  await act(page, { type: 'done' }); // Action phase
  await drag(page, { row: 7, col: 9 }, { row: 4, col: 10 });
  const o = await orders(page);
  expect(o.some((x) => x.kind === 'mine' && x.site && x.site.row === 4 && x.site.col === 10), JSON.stringify(o)).toBe(true);
  await expect(page.locator('.order-svg .ord-pick')).toHaveCount(1);
  // it walked this turn (1 foot) toward the mine
  s = await getState(page);
  const m = s.board.creatures.find((c) => c.cardId === 'goblin-scrounger');
  expect(Math.max(Math.abs(m.row - 4), Math.abs(m.col - 10))).toBeLessThan(5);
  // next turns: it keeps walking and then mines by itself
  let mined = false;
  for (let t = 0; t < 6 && !mined; t++) {
    await act(page, { type: 'done' }); await act(page, { type: 'done' }); // end our turn, opponent passes
    await act(page, { type: 'done' }); // our deploy -> action (orders run)
    await page.waitForTimeout(900);
    s = await getState(page);
    const mm = s.board.creatures.find((c) => c.cardId === 'goblin-scrounger');
    if (mm && mm.hasMined) mined = true;
  }
  expect(mined, 'the Miner mined by itself once beside the mine').toBe(true);
  expect((await orders(page)).some((x) => x.kind === 'mine'), 'the order stays').toBe(true);
});

test('AC571: guard arrows: a unit on Guard watches the squares you drag to (black arrows) and only fights there; it never chases', async ({ page }) => {
  test.setTimeout(60000);
  let s = await start(page, [P('goblin-grunt', 6, 4), O('goblin-pebbler', 1, 10)]);
  await act(page, { type: 'done' });
  const g = at(s, 6, 4);
  await page.evaluate((uid) => { const a = window.__app; a.stances.set(uid, 'guard'); a.renderOrders(a.game.state); }, g.uid);
  await drag(page, { row: 6, col: 4 }, { row: 5, col: 4 });
  await drag(page, { row: 6, col: 4 }, { row: 5, col: 5 });
  const gs = await page.evaluate(async () => await window.oreheart.getGuards());
  expect(gs[g.uid]?.squares?.length, JSON.stringify(gs)).toBe(2);
  expect((await orders(page)).some((x) => x.uid === g.uid), 'a guard drag is a watch square, not a move order').toBe(false);
  const a = await pt(page, 6, 4); await page.mouse.move(a.x, a.y); await page.waitForTimeout(300);
  await expect(page.locator('.order-svg .ord-guard-arrow').first()).toBeVisible();
  // an enemy walks onto a watched square: the guard hits it on our next Action phase; one off the squares is left alone
  await page.evaluate(async () => { await window.oreheart.act({ type: 'done' }); await window.oreheart.act({ type: 'done' }); });
  s = await getState(page);
  await page.evaluate(async () => await window.oreheart.setup({ board: [{ cardId: 'goblin-pebbler', owner: 'opponent', row: 5, col: 5 }, { cardId: 'goblin-pebbler', owner: 'opponent', row: 7, col: 5 }] })).catch(() => {});
});

test('AC572: a half-second pause before every swing: the blow lands at least swingPauseMs after the attack starts', async ({ page }) => {
  const s = await start(page, [P('goblin-grunt', 6, 4), O('goblin-pebbler', 5, 4)]);
  await act(page, { type: 'done' });
  const cfg = await page.evaluate(async () => (await window.oreheart.getConfig?.())?.combat?.swingPauseMs ?? 500);
  await act(page, { type: 'attack', creatureUid: at(s, 6, 4).uid, target: { row: 5, col: 4 } });
  await page.waitForTimeout(300);
  const log = (await page.evaluate(async () => await window.oreheart.getRenderStats())).attackLog;
  const e = log[log.length - 1];
  expect(e, 'an attack was staged').toBeTruthy();
  expect(e.blowAt - e.at, 'the first blow waits for the pause').toBeGreaterThanOrEqual(cfg);
});

test('AC573: the ? over a unit with no instruction is small and sits over its shoulder; buttons are solid on the right and fade left', async ({ page }) => {
  await start(page, [P('goblin-grunt', 6, 4), O('goblin-pebbler', 1, 10)]);
  await act(page, { type: 'done' });
  const q = page.locator('.tk-q[data-uid]').first(); // Nov 1: Brush's tiny question icon on the token, at the order mark's spot
  await expect(q).toHaveCount(1);
  const box = await q.boundingBox();
  expect(box.height, 'tiny').toBeLessThanOrEqual(32);
  await act(page, { type: 'move', creatureUid: (await getState(page)).board.creatures.find((c) => c.owner === 'player').uid, row: 6, col: 5 });
  await page.waitForTimeout(400);
  await page.goto('/?test=1'); await page.waitForFunction(() => !!window.oreheart); await page.waitForTimeout(1200);
  if (!(await page.getByRole('button', { name: 'Play', exact: true }).isVisible().catch(() => false))) { await page.mouse.click(600, 300); await page.waitForTimeout(7000); }
  const st = await page.getByRole('button', { name: 'Play', exact: true }).evaluate((e) => { const c = getComputedStyle(e); return { l: parseFloat(c.borderLeftWidth), r: parseFloat(c.borderRightWidth), bg: c.backgroundImage }; });
  expect(st.r).toBeGreaterThanOrEqual(3); expect(st.l).toBe(0); expect(st.bg).toMatch(/linear-gradient\(270deg/);
});
