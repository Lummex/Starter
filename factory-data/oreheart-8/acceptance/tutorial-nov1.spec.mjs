import { test, expect } from '@playwright/test';

// Ken, Nov 1: the tutorial is graphic and hands-on ("explain it to a five-year-old"): one small board per lesson, a big picture card,
// then the game talks to the player one short line at a time (no text box) while Brush's pointing hand sits on the REAL control or
// animates the real drag; each lesson only unlocks the next when the player has done it. Muted (Ken heard the checks on his PC).
test.use({ launchOptions: { args: ['--mute-audio'] } });

// ---------- helpers (copied from acceptance.spec.mjs) ----------
async function openTest(page, seed = 123) {
  await page.goto(`/?test=1&seed=${seed}`);
  await page.waitForFunction(() => !!window.oreheart);
}
const getState = (page) => page.evaluate(async () => await window.oreheart.getState());
const act = (page, a) => page.evaluate(async (x) => await window.oreheart.act(x), a);
async function skipIntro(page) {
  const intro = page.getByLabel('Intro', { exact: true });
  await intro.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await intro.isVisible()) await intro.click({ position: { x: 30, y: 30 } });
  await expect(intro).toBeHidden({ timeout: 5000 });
}
async function openMenu(page) {
  await page.goto('/');
  await skipIntro(page);
  const offer = page.getByRole('dialog', { name: 'Welcome to Oreheart!' });
  await expect(offer).toBeVisible();
  await offer.getByRole('button', { name: 'Skip' }).click();
  await expect(offer).toBeHidden();
}
async function realDrag(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 10, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps });
  await page.waitForTimeout(150);
  await page.mouse.up();
}
const sq2s = (page, row, col) => page.evaluate(async ([r, c]) => await window.oreheart.squareToScreen(r, c), [row, col]);
// ---------- tutorial helpers ----------
const STEPS = ['card', 'controls', 'move', 'order', 'chase', 'chain', 'ranged', 'fight', 'commander', 'swap'];
const step = async (page) => (await getState(page)).tutorial?.step;
const waitStep = (page, s, timeout = 10000) => expect.poll(() => step(page), { timeout }).toBe(s);
const line = (page) => page.getByLabel('Tutorial tip', { exact: true });
const words = (t) => t.trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
async function lesson(page, s) {
  await page.evaluate((x) => window.__app.beginTutorial(x), s);
  const card = page.locator('.tut-intro .tut-card');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Try it!' }).click();
  await expect(card).toBeHidden();
  await page.waitForTimeout(250);
}
const me = async (page) => (await getState(page)).board.creatures.find((c) => c.owner === 'player');
const foes = async (page) => (await getState(page)).board.creatures.filter((c) => c.owner === 'opponent');
const centre = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 30) }; };
/** where the pointing hand's ring is now (screen px) */
const ringAt = (page) => page.evaluate(() => { const r = document.querySelector('.tut-layer .tut-ring'); if (!r) return null; const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
const inside = (p, b, pad = 8) => p && b && p.x >= b.x - pad && p.x <= b.x + b.width + pad && p.y >= b.y - pad && p.y <= b.y + b.height + pad;

test('TUT1: How to Play -> Tutorial opens lesson 1: a big picture card, one short line, Try it! (1920x1080)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openMenu(page);
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  const card = page.locator('.tut-intro .tut-card');
  await expect(card).toBeVisible();
  const pic = card.locator('img.tut-big-pic');
  await expect(pic).toHaveAttribute('src', /\/art\/tutorial\/card-drag\.webp$/);
  await expect.poll(() => pic.evaluate((i) => i.complete && i.naturalWidth)).toBe(960);
  expect((await pic.boundingBox()).width).toBeGreaterThanOrEqual(240);
  expect(words(await card.locator('.tut-say').innerText())).toBeLessThanOrEqual(12);
  expect(await step(page)).toBe('card');
  await card.getByRole('button', { name: 'Try it!' }).click();
  // the game talks: big lettering, no box, and the pointing hand animates the drag from the card to the square
  await expect(line(page)).toBeVisible();
  await expect(line(page)).toContainText(/Drag this card onto the board/i);
  const look = await line(page).evaluate((e) => { const cs = getComputedStyle(e), say = getComputedStyle(e.querySelector('.tut-say')); return { bg: cs.backgroundColor, img: cs.backgroundImage, border: cs.borderTopWidth, pe: cs.pointerEvents, font: parseFloat(say.fontSize) }; });
  expect(look.img).toBe('none');
  expect(look.bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect(look.border).toBe('0px');
  expect(look.pe).toBe('none'); // it never catches a touch (only its small Skip button does)
  expect(look.font).toBeGreaterThanOrEqual(28);
  const hand = page.locator('.tut-layer img.tut-hand');
  await expect(hand).toHaveAttribute('src', /hand-pointing\.webp$/);
  await expect(page.locator('.tut-layer .tut-ghost')).toHaveCount(1); // a drag gesture, not just a point
  const target = await sq2s(page, 7, 6);
  await expect.poll(async () => { const r = await ringAt(page); return r && Math.hypot(r.x - target.x, r.y - target.y) < 12; }).toBe(true);
});

test('TUT2: lesson 1 is done by really dragging the card onto the board; lesson 2 unlocks only then', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await lesson(page, 'card');
  await page.waitForTimeout(800);
  expect(await step(page)).toBe('card');
  const card = page.getByLabel('Your hand', { exact: true }).locator('[data-card-id]').first();
  const b = await card.boundingBox();
  await realDrag(page, { x: b.x + b.width / 2, y: Math.min(b.y + 30, 1075) }, await sq2s(page, 7, 6));
  await expect.poll(async () => (await getState(page)).board.creatures.filter((c) => c.owner === 'player').length).toBe(1);
  await waitStep(page, 'controls');
  await expect(page.locator('.tut-intro .tut-card img.tut-big-pic')).toBeVisible();
});

test('TUT3: lesson 2 walks a whole turn: the hand points at Flow, the phases, Menu (twice) and Done (twice); each must be clicked', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await lesson(page, 'controls');
  const controls = [
    ['Flow', page.locator('[data-role=player-flow-crystal]')],
    ['phases', page.locator('.match .phase').first()],
    ['Menu', page.getByRole('button', { name: 'Menu', exact: true })],
    ['Menu', page.getByRole('button', { name: 'Menu', exact: true })],
    ['Done', page.getByRole('button', { name: 'Done', exact: true })],
    ['Done', page.getByRole('button', { name: 'Done', exact: true })],
  ];
  for (const [i, [name, loc]] of controls.entries()) {
    await expect(line(page)).toHaveAttribute('data-beat', String(i));
    await expect(line(page)).toContainText(new RegExp(name === 'phases' ? 'phases' : name, 'i'));
    const box = await loc.boundingBox();
    await expect.poll(async () => inside(await ringAt(page), box, 12), { message: `the ring is on ${name}` }).toBe(true);
    await page.waitForTimeout(200);
    expect(await line(page).getAttribute('data-beat')).toBe(String(i)); // nothing moves on by itself
    await page.mouse.click(...Object.values(await centre(loc)));
  }
  await waitStep(page, 'move');
  expect((await getState(page)).turn).toBeGreaterThan(1);
});

test('TUT4: lesson 3: drag the goblin to walk; the feet show its steps (3 feet = 3 steps)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await lesson(page, 'move');
  await expect(page.locator('.tut-feet .tut-foot')).toHaveCount(3);
  await expect(page.locator('.tut-feet .tut-foot.on')).toHaveCount(3);
  await expect(page.locator('.tut-layer .tut-ghost')).toHaveCount(1);
  const u = await me(page);
  await realDrag(page, await sq2s(page, u.row, u.col), await sq2s(page, 6, 7));
  await expect.poll(async () => { const c = await me(page); return c && c.col; }).toBe(7);
  await waitStep(page, 'order');
});

test('TUT5: lesson 4: tap the goblin, pick Guard on its stance bar, then drag far away for a green move order', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await lesson(page, 'order');
  let u = await me(page);
  await expect.poll(async () => { const r = await ringAt(page), p = await sq2s(page, u.row, u.col); return r && Math.hypot(r.x - p.x, r.y - p.y) < 14; }).toBe(true);
  const p = await sq2s(page, u.row, u.col);
  await page.mouse.click(p.x, p.y);
  const guard = page.locator('.stance-bar [data-stance=guard]');
  await expect(guard).toBeVisible();
  await expect(line(page)).toHaveAttribute('data-beat', '1');
  await guard.click();
  await expect(line(page)).toHaveAttribute('data-beat', '2');
  await expect(line(page)).toContainText(/far away/i);
  u = await me(page);
  await realDrag(page, await sq2s(page, u.row, u.col), await sq2s(page, 2, 9));
  await waitStep(page, 'chase');
});

test('TUT6: lesson 4b: drag onto the dwarf (red chase line); press Done and next turn it attacks by itself', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await lesson(page, 'chase');
  const u0 = await me(page), [d] = await foes(page);
  await realDrag(page, await sq2s(page, u0.row, u0.col), await sq2s(page, d.row, d.col));
  await expect.poll(async () => (await page.evaluate(() => window.oreheart.getOrders())).some((o) => o.kind === 'chase')).toBe(true);
  await expect.poll(async () => (await me(page)).col).toBeGreaterThan(u0.col); // the first leg walks right away
  await expect(line(page)).toContainText(/Done/);
  const doneBtn = page.getByRole('button', { name: 'Done', exact: true });
  await expect.poll(async () => inside(await ringAt(page), await doneBtn.boundingBox(), 12)).toBe(true);
  expect(await step(page)).toBe('chase');
  await doneBtn.click();
  // the enemy passes, the next Deploy passes by itself, and the order walks on and attacks
  await waitStep(page, 'chain', 15000);
});

test('TUT7: lesson 5: chained targets: drag onto a dwarf, then tap two more (1, 2, 3)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await lesson(page, 'chain');
  const u = await me(page);
  const near = (await foes(page)).sort((a, b) => Math.max(Math.abs(a.row - u.row), Math.abs(a.col - u.col)) - Math.max(Math.abs(b.row - u.row), Math.abs(b.col - u.col)));
  await realDrag(page, await sq2s(page, u.row, u.col), await sq2s(page, near[0].row, near[0].col));
  await expect(line(page)).toHaveAttribute('data-beat', '1');
  for (const [k, f] of near.slice(1).entries()) {
    await expect(line(page)).toContainText(k ? /3/ : /2/);
    const p = await sq2s(page, f.row, f.col);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(300);
  }
  await waitStep(page, 'ranged');
});

test('TUT8: lesson 6: the archer\'s 8 straight lines are drawn; shooting the dwarf on a line ends the lesson', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await lesson(page, 'ranged');
  const n = await page.locator('.tut-layer .tut-lines line').count();
  expect(n).toBeGreaterThanOrEqual(6);
  expect(n).toBeLessThanOrEqual(8);
  await expect(page.locator('.tut-layer .tut-lines line.hit')).toHaveCount(1);
  const a = await page.evaluate(() => window.oreheart.tutorialAction());
  expect(a.type).toBe('attack');
  expect((await act(page, a)).ok).toBe(true);
  await waitStep(page, 'fight');
});

test('TUT9: lesson 7 (fight): HIT 3-6, MISS 1-2, BLOCK 1 or 6 with dice; one real attack with the real dice ends it', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await page.evaluate(() => window.oreheart.setCombatRules({ dice: 'roll', blockFaces: [1, 6], hitFrom: 3, blockCap: 3, armoredExtraFace: 2 }));
  await page.evaluate(() => window.__app.beginTutorial('fight'));
  const card = page.locator('.tut-intro .tut-card');
  await expect(card.locator('img.tut-pic')).toHaveCount(3);
  const pips = async (cls) => card.locator(`.tut-swing.${cls} .tut-die`).evaluateAll((d) => d.map((x) => +x.dataset.n));
  expect(await pips('hit')).toEqual([3, 4, 5, 6]);
  expect(await pips('miss')).toEqual([1, 2]);
  expect(await pips('block')).toEqual([1, 6]);
  await expect(card).toContainText(/2 can't always kill a 2/);
  for (const w of await card.locator('img.tut-pic').all()) expect((await w.boundingBox()).width).toBeGreaterThanOrEqual(240);
  await card.getByRole('button', { name: 'Try it!' }).click();
  const before = await getState(page);
  const u = before.board.creatures.find((c) => c.owner === 'player'), d = before.board.creatures.find((c) => c.owner === 'opponent');
  expect([u.attack, d.health]).toEqual([2, 2]);
  await realDrag(page, await sq2s(page, u.row, u.col), await sq2s(page, d.row, d.col));
  await waitStep(page, 'commander');
});

test('TUT10: lesson 8: hit the enemy Commander once (20 -> less), then the Miner swap, the marker signs and You\'re ready', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await lesson(page, 'commander');
  expect((await getState(page)).players.opponent.health).toBe(20);
  const u = await me(page);
  await realDrag(page, await sq2s(page, u.row, u.col), await sq2s(page, 1, 12));
  await expect.poll(async () => (await getState(page)).players.opponent.health).toBeLessThan(20);
  await waitStep(page, 'swap');
  await page.locator('.tut-intro .tut-card').getByRole('button', { name: 'Try it!' }).click();
  const swap = page.getByRole('button', { name: 'Swap for a Miner', exact: true });
  await expect(swap).toBeVisible();
  await expect.poll(async () => inside(await ringAt(page), await swap.boundingBox(), 12)).toBe(true);
  await swap.click();
  await expect(line(page)).toHaveAttribute('data-beat', '1');
  const card = page.getByLabel('Your hand', { exact: true }).locator('[data-card-id]').first();
  await page.mouse.click(...Object.values(await centre(card)));
  const legend = page.getByRole('dialog', { name: 'Marker signs' });
  await expect(legend).toBeVisible({ timeout: 10000 });
  await expect(legend.locator('.tut-legend li')).toHaveCount(6);
  for (const s of ['Walk here', 'Melee attack', 'Ranged attack', 'Target', 'Guard', 'No orders yet']) await expect(legend).toContainText(s);
  await legend.getByRole('button', { name: 'Finish!' }).click();
  expect(await step(page)).toBe('complete');
  const ready = page.getByRole('dialog', { name: "You're ready!" });
  await expect(ready).toBeVisible();
  await ready.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose Your Commander' })).toBeVisible();
});

test('TUT11: Skip Tutorial goes back to the menu and leaves nothing behind', async ({ page }) => {
  await openTest(page);
  await lesson(page, 'move');
  await page.getByRole('button', { name: 'Skip Tutorial' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
  await expect(page.locator('.tut-layer, .tut-intro, .tut-tip')).toHaveCount(0);
});

test('TUT12: the lessons run in order and the engine only unlocks the next after the goal (tutorialAction)', async ({ page }) => {
  await openTest(page);
  await page.evaluate(() => window.oreheart.startTutorial());
  expect(await step(page)).toBe('card');
  expect((await getState(page)).tutorial.done).toBe(false);
  const a = await page.evaluate(() => window.oreheart.tutorialAction());
  expect(a.type).toBe('summon');
  await page.locator('.tut-intro .tut-card').getByRole('button', { name: 'Try it!' }).click();
  expect((await act(page, a)).ok).toBe(true);
  await waitStep(page, 'controls');
});

for (const vp of [{ width: 1920, height: 1080 }, { width: 844, height: 390 }]) {
  test(`TUT13: every lesson fits the screen: picture cards on screen with pictures >= 240 px, short lines, the spoken line clear of the target (${vp.width}x${vp.height})`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize(vp);
    await openTest(page);
    for (const s of STEPS) {
      await page.evaluate((x) => window.__app.beginTutorial(x), s);
      const card = page.locator('.tut-intro .tut-card');
      await expect(card).toBeVisible();
      await page.waitForTimeout(400); // the pop-in
      const cb = await card.boundingBox();
      expect(cb.x >= 0 && cb.y >= 0 && cb.x + cb.width <= vp.width + 1 && cb.y + cb.height <= vp.height + 1, `${s}: card on screen ${JSON.stringify(cb)}`).toBe(true);
      for (const img of await card.locator('img.tut-pic').all()) {
        await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
        expect((await img.boundingBox()).width, `${s}: picture width`).toBeGreaterThanOrEqual(239);
      }
      const intro = (await card.locator('.tut-say').innerText()) + ' ' + ((await card.locator('.tut-sub').count()) ? await card.locator('.tut-sub').innerText() : '');
      expect(words(intro), `${s}: "${intro}"`).toBeLessThanOrEqual(13);
      await card.getByRole('button', { name: 'Try it!' }).click();
      await expect(line(page)).toBeVisible();
      const said = (await line(page).locator('.tut-say').innerText()) + ' ' + ((await line(page).locator('.tut-sub').count()) ? await line(page).locator('.tut-sub').innerText() : '');
      expect(words(said), `${s}: "${said}"`).toBeLessThanOrEqual(12);
      const lb = await line(page).locator('.tut-say').boundingBox();
      expect(lb.x >= 0 && lb.x + lb.width <= vp.width + 1, `${s}: spoken line on screen`).toBe(true);
      await page.waitForTimeout(300);
      const r = await ringAt(page);
      if (r) expect(inside(r, lb, 0), `${s}: the line covers the pointed target`).toBe(false);
    }
  });
}
