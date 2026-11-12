import { test, expect } from '@playwright/test';

// Tutorial v2 (Nov 8; Ledger's spec studio/specs/tutorial-v2.md; Ken: "When the finger goes to point at the stuff, it's kind of confusing.
// It needs to say ... click the menu here underneath the finger"). One pointer component: the fingertip ON the target, a word bubble right
// beside it (what it is, what to do), a ring, a veil on the tour; six parts; idle help; no timer. Muted.
test.use({ launchOptions: { args: ['--mute-audio'] } });

async function openTest(page, seed = 123) {
  await page.goto(`/?test=1&seed=${seed}&fx=1`);
  await page.waitForFunction(() => !!window.oreheart);
  await page.evaluate(() => document.body.classList.remove('test'));
}
const getState = (page) => page.evaluate(async () => await window.oreheart.getState());
const info = (page) => page.evaluate(() => window.oreheart.tutorialStep());
async function chapter(page, ch) {
  await page.evaluate((c) => window.__app.beginTutorial(c), ch);
  const go = page.getByTestId('tut-go');
  await expect(go).toBeVisible();
  await go.click();
  await expect.poll(async () => (await info(page))?.mode).toBe('step');
}
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
const inside = (p, r, pad = 4) => p && r && p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
const overlaps = (a, b) => !(a.x + a.w <= b.x || a.x >= b.x + b.w || a.y + a.h <= b.y || a.y >= b.y + b.h);
/** one step forward the way a player would: OK, press the target, or (goals) the test hook */
/** OK on the bubble (a direct press: the 3D board makes headless frames slow, and Playwright's "stable" wait takes seconds per click) */
const ok = (page) => page.evaluate(() => document.querySelector('[data-testid=tut-ok]')?.click());
async function forward(page, s) {
  if (s.advance === 'ok') { await ok(page); return; }
  if (s.advance === 'target' || ['tour-emote-send', 'card-play', 'tap-unit'].includes(s.step)) { if (s.rect) await page.mouse.click(s.rect.x + s.rect.w / 2, s.rect.y + s.rect.h / 2); return; }
  const a = await page.evaluate(() => window.oreheart.tutorialAction());
  if (a) await page.evaluate((x) => window.__app.game.act(x), a);
}
/** press a click-target step's target (again, if the hand was still sliding in), until the step moves on */
async function pressUntil(page, from, to) {
  for (let i = 0; i < 4; i++) {
    const s = await info(page);
    if (s.step !== from) break;
    if (s.rect) await page.mouse.click(s.rect.x + s.rect.w / 2, s.rect.y + s.rect.h / 2);
    try { await expect.poll(async () => (await info(page)).step, { timeout: 2500 }).toBe(to); return; } catch { /* again */ }
  }
  await expect.poll(async () => (await info(page)).step).toBe(to);
}
const TEXT = async (page) => page.evaluate(() => window.__tut2text || null);

for (const vp of [{ width: 1920, height: 1080, touch: false }, { width: 1024, height: 768, touch: false }, { width: 844, height: 390, touch: true }]) {
  test(`TUT2-1: parts 1-3 at ${vp.width}x${vp.height}: every fingertip sits on its target, every bubble is on screen (12 px) and never covers the target; the words say ${vp.touch ? 'Tap' : 'Click'}`, async ({ browser }) => {
    test.setTimeout(240000);
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch });
    const page = await ctx.newPage();
    await openTest(page);
    for (const ch of ['ch1', 'ch2', 'ch3']) {
      await chapter(page, ch);
      let last = '', same = 0;
      for (let i = 0; i < 80; i++) {
        await page.waitForTimeout(450);
        const s = await info(page);
        if (!s || s.chapter !== ch) break;
        if (s.step === last) { same++; expect(same, `stuck on ${s.step}`).toBeLessThan(16); } else { same = 0; last = s.step; } // patient: under a full run's load the hand slides in slowly
        if (same === 0) {
          const b = s.bubbleRect;
          expect(b, s.step).toBeTruthy();
          expect(b.x >= 11 && b.y >= 11 && b.x + b.w <= vp.width - 11 && b.y + b.h <= vp.height - 11, `${s.step}: bubble on screen ${JSON.stringify(b)}`).toBe(true);
          if (s.rect) {
            expect(inside(s.fingerTip, s.rect), `${s.step}: fingertip ${JSON.stringify(s.fingerTip)} in ${JSON.stringify(s.rect)}`).toBe(true);
            expect(overlaps(b, s.rect), `${s.step}: the bubble covers its target`).toBe(false);
          }
          const txt = await page.getByTestId('tut-bubble').innerText();
          expect(txt).not.toMatch(/\{click\}|\{Click\}/);
          if (/lick|ap /.test(txt)) expect(txt).toMatch(vp.touch ? /\bTap\b|\btap\b/ : /\bClick\b|\bclick\b/);
        }
        await forward(page, s);
      }
    }
    await ctx.close();
  });
}

test('TUT2-2: a click-target step waits for its target (an outside click or Enter does nothing); an OK step goes on with OK and with Enter', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await chapter(page, 'ch1');
  expect((await info(page)).step).toBe('tour-hello');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await info(page)).step).toBe('tour-menu');
  const s = await info(page);
  expect(s.advance).toBe('target');
  await expect(page.getByTestId('tut-ok')).toHaveCount(0);
  await page.mouse.click(960, 540); // the veil: nothing happens
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  expect((await info(page)).step).toBe('tour-menu');
  // 1.2 -> 1.3 -> 1.4: the menu opens, then closes, and is closed at the next step
  await page.mouse.click(s.rect.x + s.rect.w / 2, s.rect.y + s.rect.h / 2);
  await expect.poll(async () => (await info(page)).step).toBe('tour-menu-panel');
  expect(await page.evaluate(() => !!window.__app.r.menuWrap?.classList.contains('open'))).toBe(true);
  await ok(page);
  await expect.poll(async () => (await info(page)).step).toBe('tour-menu-close');
  const s2 = await info(page);
  await page.mouse.click(s2.rect.x + s2.rect.w / 2, s2.rect.y + s2.rect.h / 2);
  await expect.poll(async () => (await info(page)).step).toBe('tour-emote');
  expect(await page.evaluate(() => !!window.__app.r.menuWrap?.classList.contains('open'))).toBe(false);
});

test('TUT2-3: reading a card: every part has its data-part in the open card view; closing the view during the tour opens it again', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await chapter(page, 'ch2');
  expect((await info(page)).step).toBe('card-open');
  await pressUntil(page, 'card-open', 'card-cost');
  for (const p of ['cost', 'attack', 'health', 'move', 'typeIcon', 'name', 'text', 'rarity', 'rarityGem', 'frame']) await expect(page.locator(`.dialog .card-view-face [data-part="${p}"]`).first()).toHaveCount(1);
  await expect(page.getByTestId('tut-bubble')).toContainText('He costs 2 crystals'); // Grubnak: Goblins cost 1 less (the Grunt's card says 3)
  await page.evaluate(() => document.querySelector('.dialog .cv-close')?.click());
  await expect(page.locator('.dialog .card-view-face')).toHaveCount(1, { timeout: 3000 });
  expect((await info(page)).step).toBe('card-cost');
});

test.describe.configure({ timeout: 120000 });

test('TUT2-4: units: the Strike button is dark at 0 Flow (aria-disabled); pressing it shows "not available" and goes on; tapping the unit opens its orders', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await page.evaluate(() => { window.__fl = []; const f = window.__app.flash.bind(window.__app); window.__app.flash = (x) => { window.__fl.push(x); return f(x); }; });
  await chapter(page, 'ch3');
  for (let i = 0; i < 12; i++) { const s = await info(page); if (s.step === 'ability-off') break; await ok(page); await page.waitForTimeout(250); }
  const s = await info(page);
  expect(s.step).toBe('ability-off');
  await expect(page.locator('.ab-btn[data-ability=strike]').first()).toHaveAttribute('aria-disabled', 'true');
  await page.mouse.click(s.rect.x + s.rect.w / 2, s.rect.y + s.rect.h / 2);
  await expect.poll(async () => (await info(page)).step).toBe('enemy-stats');
  expect((await page.evaluate(() => window.__fl)).some((x) => /not available/i.test(x))).toBe(true);
  await ok(page);
  const t = await info(page);
  expect(t.step).toBe('tap-unit');
  await page.mouse.click(t.rect.x + t.rect.w / 2, t.rect.y + t.rect.h / 2);
  await expect.poll(async () => (await info(page)).step).toBe('stances');
  await expect(page.locator('.stance-bar')).toBeVisible();
});

test('TUT2-5: the first battle wins: the scripted fight is HIT + BLOCK for the Grunt and MISS for the dwarf (dwarf on 1, Grunt unhurt); then the enemy Commander falls to 0', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await page.evaluate(() => window.oreheart.setCombatRules && window.oreheart.setCombatRules({ dice: 'real' }));
  await chapter(page, 'ch4');
  let saw = false;
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(350);
    const s = await info(page);
    if (!s || s.chapter !== 'ch4') break;
    if (s.step === 'dice' && !saw) {
      saw = true;
      const st = await getState(page);
      const dwarf = st.board.creatures.find((c) => c.owner === 'opponent'), grunt = st.board.creatures.find((c) => c.owner === 'player' && c.cardId === 'goblin-grunt');
      expect(dwarf.health, 'dwarf: HIT then BLOCK').toBe(1);
      expect(grunt.health, 'grunt: the strike back MISSED').toBe(grunt.maxHealth);
    }
    if (s.step === 'win') { const st = await getState(page); expect(st.phase).toBe('over'); expect(st.players.opponent?.health ?? st.players[1]?.health ?? 0).toBe(0); break; }
    await forward(page, s);
  }
  expect(saw).toBe(true);
  expect((await info(page)).step).toBe('win');
});

test('TUT2-6: the practice skirmish: the test hook plays every goal, each one affordable (no "not available"), and wins', async ({ page }) => {
  test.setTimeout(240000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await page.evaluate(() => { window.__fl = []; const f = window.__app.flash.bind(window.__app); window.__app.flash = (x) => { window.__fl.push(x); return f(x); }; });
  await chapter(page, 'ch5');
  for (let i = 0; i < 200; i++) {
    await page.waitForTimeout(200);
    const st = await getState(page);
    if (st.phase === 'over') break;
    const a = await page.evaluate(() => window.oreheart.tutorialAction());
    if (a) await page.evaluate((x) => window.__app.game.act(x), a);
  }
  const st = await getState(page);
  expect(st.phase).toBe('over');
  expect(st.winner).toBe('player');
  expect(Math.ceil(st.turn / 2), 'rounds').toBeLessThanOrEqual(8);
  const s = await info(page);
  expect(s.goals.length).toBe(13);
  expect((await page.evaluate(() => window.__fl)).some((x) => /not available/i.test(x))).toBe(false);
  await expect(page.getByTestId('tut2-end')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('tut-tricks')).toBeVisible();
});

test('TUT2-7: idle help: after 10 s the bubble shows the step\'s hint; on a skirmish goal the finger appears too', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await chapter(page, 'ch1');
  await ok(page);
  await expect.poll(async () => (await info(page)).step).toBe('tour-menu');
  await page.evaluate(() => window.oreheart.tutorialIdle(11000));
  await expect(page.getByTestId('tut-bubble')).toContainText('the finger is pointing at');
  await chapter(page, 'ch5');
  await expect(page.getByTestId('tut-finger')).toHaveCount(0);
  await page.evaluate(() => window.oreheart.tutorialIdle(11000));
  await expect(page.getByTestId('tut-finger')).toHaveCount(1);
  await expect(page.getByTestId('tut-bubble')).toContainText(/Drag the Miner card/);
});

test('TUT2-8: no clock in the tutorial: the timer bar stays hidden and the phase never ends by itself', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await chapter(page, 'ch1');
  const p0 = (await getState(page)).phase;
  await page.waitForTimeout(20000);
  expect((await getState(page)).phase).toBe(p0);
  await expect(page.locator('.countdown')).toBeHidden();
});

test('TUT2-9: the bubble layer is above an open card view (the OK button is the top element), with no word-by-word animation', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await chapter(page, 'ch2');
  await pressUntil(page, 'card-open', 'card-cost');
  const ok = page.getByTestId('tut-ok');
  const b = await ok.boundingBox();
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.getAttribute('data-testid'), [b.x + b.width / 2, b.y + b.height / 2])).toBe('tut-ok');
  await expect(page.locator('.tut2-bubble .tut-w')).toHaveCount(0);
});

test('TUT2-10: Skip asks once, then goes back where the tutorial started (the front menu offline)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openMenu(page);
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  await expect(page.getByTestId('tut-picker')).toBeVisible();
  await page.getByTestId('tut-pick-all').click();
  await page.getByTestId('tut-go').click();
  await page.getByTestId('tut-end').first().click(); // Nov 11: End tutorial leaves; Skip goes to the next step
  await expect(page.getByTestId('tut-skip-ask')).toBeVisible();
  await page.getByTestId('tut-skip-no').click();
  await expect(page.getByTestId('tut-skip-ask')).toHaveCount(0);
  await page.getByTestId('tut-end').first().click();
  await page.getByTestId('tut-skip-yes').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oreheart' })).toBeVisible();
  await expect(page.locator('.tut2-layer')).toHaveCount(0);
});

test('TUT2-11: on a REAL page (no test hooks) the emote step goes on when "Hello!" is sent (Ken, Nov 11: it got stuck)', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openMenu(page);
  await page.evaluate(() => localStorage.removeItem('oreheart.tutorialSeen'));
  await page.getByRole('button', { name: 'How to Play', exact: true }).click();
  await page.getByRole('button', { name: 'Tutorial', exact: true }).click();
  await page.getByTestId('tut-pick-all').click();
  await page.getByTestId('tut-go').click();
  const step = () => page.evaluate(() => document.querySelector('[data-testid=tut-bubble]')?.dataset.step || null);
  for (let i = 0; i < 12 && (await step()) !== 'tour-emote'; i++) {
    if (await page.getByTestId('tut-ok').count()) await page.evaluate(() => document.querySelector('[data-testid=tut-ok]').click());
    else { const r = await page.evaluate(() => { const q = document.querySelector('.tut2-ring:not(.extra)')?.getBoundingClientRect(); return q ? { x: q.left + q.width / 2, y: q.top + q.height / 2 } : null; }); if (r) await page.mouse.click(r.x, r.y); }
    await page.waitForTimeout(500);
  }
  expect(await step()).toBe('tour-emote');
  await page.locator('[data-testid=emote-avatar]').click();
  await expect.poll(step).toBe('tour-emote-send');
  await page.locator('.emote-pick[data-emote="free-starter/hello"]').click({ force: true });
  await expect.poll(step, { timeout: 8000 }).toBe('tour-emote-mute');
});

test('TUT2-12: every bubble has Skip and End tutorial: Skip goes to the next step (all of part 1), End asks once and leaves; the buttons never overlap and their words are centred', async ({ page }) => {
  test.setTimeout(150000);
  for (const vp of [{ width: 1920, height: 1080 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(vp);
    await openTest(page);
    await chapter(page, 'ch1');
    const seen = [];
    for (let i = 0; i < 30; i++) {
      const s = await info(page);
      if (!s || s.chapter !== 'ch1') break;
      seen.push(s.step);
      const btns = await page.evaluate(() => [...document.querySelectorAll('[data-testid=tut-bubble] .tut2-row .btn')].map((b) => { const r = b.getBoundingClientRect(); const t = document.createRange(); t.selectNodeContents(b); const tr = t.getBoundingClientRect(); return { id: b.dataset.testid, x: r.left, y: r.top, w: r.width, h: r.height, tx: tr.left + tr.width / 2 - (r.left + r.width / 2), ty: tr.top + tr.height / 2 - (r.top + r.height / 2), fits: tr.width <= r.width + 1 }; }));
      expect(btns.map((b) => b.id), s.step).toEqual(expect.arrayContaining(['tut-skip', 'tut-end']));
      for (let a = 0; a < btns.length; a++) {
        expect(Math.abs(btns[a].tx) <= 3 && Math.abs(btns[a].ty) <= 3 && btns[a].fits, `${vp.width} ${s.step} ${btns[a].id}: words centred and inside`).toBe(true);
        for (let c = a + 1; c < btns.length; c++) { const A = btns[a], B = btns[c]; expect(A.x + A.w <= B.x + 0.5 || B.x + B.w <= A.x + 0.5 || A.y + A.h <= B.y + 0.5 || B.y + B.h <= A.y + 0.5, `${vp.width} ${s.step}: ${A.id} / ${B.id} overlap`).toBe(true); }
      }
      await page.evaluate(() => document.querySelector('[data-testid=tut-skip]').click());
      await page.waitForTimeout(250);
    }
    expect(seen.length, `${vp.width}: Skip walked every part-1 step: ${seen.join(',')}`).toBeGreaterThanOrEqual(19);
    await expect.poll(async () => (await info(page))?.chapter).toBe('ch2');
  }
  await page.getByTestId('tut-end').first().click();
  await expect(page.getByTestId('tut-skip-ask')).toBeVisible();
  await page.getByTestId('tut-skip-yes').click();
  await expect(page.locator('.tut2-layer')).toHaveCount(0);
});

test('TUT2-13: a target off the screen gets an arrow at the edge instead of a finger', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openTest(page);
  await chapter(page, 'ch1');
  await page.evaluate(() => document.querySelector('[data-testid=tut-ok]').click());
  await expect.poll(async () => (await info(page)).step).toBe('tour-menu');
  await page.evaluate(() => { const m = window.__app.r.menuBtn; m.style.transform = 'translate(-4000px, -4000px)'; });
  await expect(page.getByTestId('tut-edge')).toBeVisible();
  await expect(page.getByTestId('tut-finger')).toBeHidden();
});
