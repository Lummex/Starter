// Oreheart Online, Nov 2 (Ken: "some daily quests ... coins and stuff to buy packs ... a nice foil pack ... It rips open"):
// coins, packs, collection, daily quests and the animated pack opening (contract oreheart-pvp-nov2-contract.md, part 4).
// AC640–AC656 run with no database: test pages open the screens with stand-in data (?test=1&econ=shop|collection|quests|pack)
// and window.oreheart.packs drives the pack opening. AC657–AC666 need the local Supabase (needDb() skips them otherwise).
import { test, expect } from '@playwright/test';

// ---------- helpers ----------
async function openEcon(page, kind, extra = '') {
  await page.goto(`/?test=1&econ=${kind}${extra}`);
  await expect(page.locator(`[data-screen="econ-${kind}"]`)).toBeVisible({ timeout: 15000 });
  await page.waitForFunction(() => !!(window.oreheart && window.oreheart.packs));
}
const packState = (page) => page.evaluate(() => window.oreheart.packs.state());
async function appDir() {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.APP_DIR && path.resolve(process.env.APP_DIR),
    path.resolve(here, '../../../projects/oreheart-8'),
    path.resolve(process.cwd(), 'projects/oreheart-8'),
    path.resolve(process.cwd(), '../projects/oreheart-8'),
  ].filter(Boolean);
  const dir = candidates.find((d) => fs.existsSync(path.join(d, 'package.json')));
  expect(dir, `app folder not found in ${candidates.join(', ')}`).toBeTruthy();
  return { fs, path, dir };
}
/** opens a stand-in pack, plays the rip, and waits for the face-down row */
async function ripToCards(page, pack = 'standard', force) {
  await openEcon(page, 'shop');
  await page.evaluate(([p, f]) => window.oreheart.packs.open(p, f), [pack, force]);
  await expect(page.locator('[data-screen="econ-pack"]')).toBeVisible();
  await expect.poll(async () => (await packState(page)).phase).toBe('idle');
  await page.locator('.pko-tilt').click();
  await expect.poll(async () => (await packState(page)).phase, { timeout: 8000 }).toBe('cards');
}

// =====================================================================
// Offline (stand-in data, no database)
// =====================================================================
test('AC640: the pack opening screen shows the painted foil pack (sealed, shine, the four pack looks) with a "Rip it open!" button and its phase is idle', async ({ page }) => {
  await openEcon(page, 'pack');
  const scene = page.locator('.pko-scene');
  await expect(scene).toHaveAttribute('data-phase', 'idle');
  const img = page.locator('.pko-stage img.pko-sealed');
  await expect(img).toBeVisible();
  expect(await img.evaluate((i) => i.complete && i.naturalWidth > 0), 'the painted pack loaded').toBe(true);
  expect(await img.getAttribute('src')).toMatch(/\/art\/packs\/pack-(general|goblin|gnome|dwarf)\.webp$/);
  await expect(page.locator('.pko-stage .pko-shine')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Rip it open!' })).toBeVisible();
  for (const n of ['general', 'goblin', 'gnome', 'dwarf']) for (const part of ['', '-body', '-top', '-shine']) {
    const r = await page.request.get(`/art/packs/pack-${n}${part}.webp`);
    expect(r.ok(), `pack-${n}${part}.webp is served`).toBe(true);
  }
  expect((await packState(page)).cards).toHaveLength(8);
});

test('AC641: ripping runs idle -> ripping -> cards: the pack shakes, the top strip tears off (it moves), 20-40 foil shreds fly, and the eight cards come out face down', async ({ page }) => {
  await openEcon(page, 'pack');
  const seen = await page.evaluate(async () => {
    const out = { phases: [], shreds: 0, topMoved: false, shaking: false, sealedHidden: false };
    const scene = document.querySelector('.pko-scene');
    const top = document.querySelector('.pko-top');
    const mo = new MutationObserver(() => { const p = scene.dataset.phase; if (out.phases[out.phases.length - 1] !== p) out.phases.push(p); });
    mo.observe(scene, { attributes: true, attributeFilter: ['data-phase'] });
    out.phases.push(scene.dataset.phase);
    document.querySelector('.pko-tilt').click();
    const t0 = performance.now();
    while (performance.now() - t0 < 4000 && scene.dataset.phase !== 'cards') {
      out.shreds = Math.max(out.shreds, document.querySelectorAll('.pko-shred').length);
      if (document.querySelector('.pko-shaking')) out.shaking = true;
      if (top.getAnimations().length) out.topMoved = true;
      if (getComputedStyle(document.querySelector('.pko-main')).opacity === '0') out.sealedHidden = true;
      await new Promise((r) => setTimeout(r, 30));
    }
    mo.disconnect();
    return out;
  });
  expect(seen.phases).toEqual(['idle', 'ripping', 'cards']);
  expect(seen.shaking, 'the pack shakes first').toBe(true);
  expect(seen.topMoved, 'the torn strip flies off').toBe(true);
  expect(seen.sealedHidden, 'the sealed pack gives way to the torn pieces').toBe(true);
  expect(seen.shreds, 'foil shreds').toBeGreaterThanOrEqual(20);
  expect(seen.shreds).toBeLessThanOrEqual(40);
  const cards = page.locator('.pko-card');
  await expect(cards).toHaveCount(8);
  for (let i = 0; i < 8; i++) { await expect(cards.nth(i)).toBeVisible(); await expect(cards.nth(i)).toHaveAttribute('data-flipped', 'false'); }
  await expect(page.locator('.pko-shred')).toHaveCount(0, { timeout: 4000 }); // the shreds clean themselves up
});

test('AC642: the player flips each card by clicking it (a 3D Y-turn shows the real card face); after all 8 the phase is done with "Open another" and "Done"', async ({ page }) => {
  await ripToCards(page);
  const cards = page.locator('.pko-card');
  for (let i = 0; i < 8; i++) {
    await cards.nth(i).click();
    await expect(cards.nth(i)).toHaveAttribute('data-flipped', 'true');
    expect((await packState(page)).flipped).toBe(i + 1);
  }
  await expect.poll(async () => (await packState(page)).phase).toBe('done');
  // turned by rotateY(180deg): the first matrix value ends at -1 once the 0.55 s turn has finished
  await expect.poll(() => cards.last().locator('.pko-flip').evaluate((e) => +((getComputedStyle(e).transform.match(/^matrix3d\(([-\d.e]+)/) || [])[1] ?? 1)), { timeout: 3000 }).toBeLessThan(-0.999);
  const face = cards.first().locator('.pko-front .ohcard');
  await expect(face).toHaveCount(1);
  const ids = (await packState(page)).cards.map((c) => c.card_id);
  expect(await cards.first().getAttribute('data-card-id')).toBe(ids[0]);
  await expect(page.getByRole('button', { name: /^Open another/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
});

test('AC643: "Flip all" and the packs.flipAll() hook turn every card; skip() jumps straight to the face-down row, then to all face up', async ({ page }) => {
  await ripToCards(page);
  await page.getByRole('button', { name: 'Flip all' }).click();
  await expect.poll(async () => (await packState(page)).flipped, { timeout: 5000 }).toBe(8);
  expect((await packState(page)).phase).toBe('done');
  // skip from idle
  await page.evaluate(() => window.oreheart.packs.open('dwarf'));
  await expect.poll(async () => (await packState(page)).phase).toBe('idle');
  await page.evaluate(() => window.oreheart.packs.skip());
  expect((await packState(page)).phase).toBe('cards');
  await expect(page.locator('.pko-card')).toHaveCount(8);
  await page.evaluate(() => window.oreheart.packs.skip());
  const st = await packState(page);
  expect(st.phase).toBe('done');
  expect(st.flipped).toBe(8);
});

test('AC644: rarity glow grows with rarity and is never gold: Common none, Uncommon silver rim, Rare blue-white bloom, Ultra Rare violet bloom, Collector rainbow shimmer', async ({ page }) => {
  const glowOf = async () => page.evaluate(() => [...document.querySelectorAll('.pko-card')].map((c) => {
    const g = getComputedStyle(c.querySelector('.pko-glow'));
    const b = getComputedStyle(c.querySelector('.pko-glow'), '::before');
    return { r: c.dataset.rarity, cls: c.className, display: g.display, shadow: g.boxShadow, opacity: g.opacity, rainbow: b.backgroundImage };
  }));
  const seen = {};
  for (const force of ['Rare', 'Ultra Rare', 'Collector']) {
    await ripToCards(page, 'standard', force);
    await page.evaluate(() => window.oreheart.packs.flipAll());
    await expect.poll(async () => (await packState(page)).phase, { timeout: 5000 }).toBe('done');
    await page.waitForTimeout(900);
    for (const g of await glowOf()) seen[g.r] = g;
  }
  for (const r of ['common', 'uncommon', 'rare', 'ultra-rare', 'collector']) {
    expect(seen[r], `a ${r} card was pulled`).toBeTruthy();
    expect(seen[r].cls).toContain('pko-r-' + r);
  }
  expect(seen.common.display).toBe('none');
  const blur = (s) => Math.max(0, ...[...String(s).matchAll(/px (\d+(?:\.\d+)?)px/g)].map((m) => +m[1]));
  expect(blur(seen.uncommon.shadow)).toBeGreaterThan(0);
  expect(blur(seen.rare.shadow)).toBeGreaterThan(blur(seen.uncommon.shadow));
  expect(blur(seen['ultra-rare'].shadow)).toBeGreaterThan(blur(seen.rare.shadow));
  expect(seen['ultra-rare'].shadow, 'violet bloom').toMatch(/rgb\(180, 92, 255|rgba\(180, 92, 255/);
  expect(seen.collector.rainbow, 'rainbow shimmer').toContain('conic-gradient');
  for (const g of Object.values(seen)) expect(String(g.shadow), 'no gold').not.toMatch(/255, 215, 0|212, 169, 79|255, 211, 107/);
  for (const r of ['uncommon', 'rare', 'ultra-rare', 'collector']) expect(+seen[r].opacity).toBeGreaterThan(0.5);
});

test('AC645: a "NEW" tag shows on (only) the cards the server marks is_new, once they are turned', async ({ page }) => {
  await ripToCards(page, 'standard', 'Collector');
  const st = await packState(page);
  const cards = page.locator('.pko-card');
  for (let i = 0; i < 8; i++) await expect(cards.nth(i).locator('.pko-new')).toHaveCount(st.cards[i].is_new ? 1 : 0);
  expect(st.cards.some((c) => c.is_new), 'the stand-in pull has a new card').toBe(true);
  await page.evaluate(() => window.oreheart.packs.flipAll());
  await expect.poll(async () => (await packState(page)).phase, { timeout: 5000 }).toBe('done');
  const i = st.cards.findIndex((c) => c.is_new);
  await expect(cards.nth(i).locator('.pko-new')).toHaveText('NEW');
  await expect.poll(() => cards.nth(i).locator('.pko-new').evaluate((e) => +getComputedStyle(e).opacity)).toBeGreaterThan(0.9);
});

for (const vp of [{ name: 'PC', width: 1920, height: 1080, minW: 150 }, { name: 'PC small', width: 1280, height: 720, minW: 110 }, { name: 'phone', width: 844, height: 390, minW: 70 }]) {
  test(`AC646: the pack opening fits the screen (${vp.name} ${vp.width}x${vp.height}): pack, eight cards in one row and the buttons all inside the view`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await openEcon(page, 'pack');
    const inside = async (sel) => page.locator(sel).evaluateAll((els, [W, H]) => els.filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= W + 1 && r.bottom <= H + 1; }), [vp.width, vp.height]);
    expect(await inside('.pko-stage')).toEqual([true]);
    expect(await inside('.pko-rip-btn')).toEqual([true]);
    await page.evaluate(() => window.oreheart.packs.skip());
    await page.evaluate(() => window.oreheart.packs.skip());
    await page.waitForTimeout(800);
    expect(await inside('.pko-card')).toEqual(Array(8).fill(true));
    expect(await inside('.pko-done')).toEqual([true]);
    const r = await page.locator('.pko-card').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((b) => ({ w: b.width, top: Math.round(b.top) })));
    expect(new Set(r.map((x) => x.top)).size, 'one row').toBe(1);
    expect(Math.min(...r.map((x) => x.w)), 'cards big enough to see').toBeGreaterThanOrEqual(vp.minW);
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.querySelector('.econ-screen').scrollWidth]);
    expect(Math.max(...sw)).toBeLessThanOrEqual(vp.width + 1);
  });
}

test('AC647: smooth on PC and phones: every animation in the pack opening moves only transform and opacity', async ({ page }) => {
  await openEcon(page, 'pack');
  const props = await page.evaluate(async () => {
    const seen = new Set();
    const grab = () => { for (const a of document.getAnimations()) { const t = a.effect && a.effect.target; if (!t || !t.closest || !t.closest('.pko-scene') || t.closest('.ohcard')) continue; /* card faces are the owner's Card Format (its own holo shimmer) */ if (a.effect.getKeyframes) for (const k of a.effect.getKeyframes()) for (const p of Object.keys(k)) if (!['offset', 'computedOffset', 'easing', 'composite'].includes(p)) seen.add(p); if (a.transitionProperty) seen.add(a.transitionProperty); } };
    document.querySelector('.pko-tilt').click();
    const t0 = performance.now();
    while (performance.now() - t0 < 2600) { grab(); await new Promise((r) => setTimeout(r, 40)); }
    await window.oreheart.packs.flipAll();
    const t1 = performance.now();
    while (performance.now() - t1 < 1200) { grab(); await new Promise((r) => setTimeout(r, 40)); }
    return [...seen];
  });
  expect(props.length).toBeGreaterThan(0);
  for (const p of props) expect(['transform', 'opacity', 'translate', 'rotate', 'scale'], `animated property ${p}`).toContain(p);
});

test('AC648: prefers-reduced-motion shortens the whole rip (cards out in well under a second, few shreds)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openEcon(page, 'pack');
  const r = await page.evaluate(async () => {
    const scene = document.querySelector('.pko-scene');
    let shreds = 0;
    const t0 = performance.now();
    document.querySelector('.pko-tilt').click();
    while (scene.dataset.phase !== 'cards' && performance.now() - t0 < 5000) { shreds = Math.max(shreds, document.querySelectorAll('.pko-shred').length); await new Promise((res) => setTimeout(res, 10)); }
    return { ms: performance.now() - t0, shreds };
  });
  expect(r.ms).toBeLessThan(900);
  expect(r.shreds).toBeLessThanOrEqual(10);
});

test('AC649: rip and flip sounds are small synthesized files (each under 100 KB) and the pack pictures are each under 400 KB', async () => {
  const { fs, path, dir } = await appDir();
  const pk = path.join(dir, 'public/art/packs');
  for (const f of ['rip.ogg', 'card-flip.ogg', 'crinkle.ogg', 'rare-sting.ogg']) {
    const p = path.join(pk, 'sfx', f);
    expect(fs.existsSync(p), f).toBe(true);
    expect(fs.statSync(p).size, f).toBeLessThan(100 * 1024);
  }
  for (const f of fs.readdirSync(pk).filter((x) => x.endsWith('.webp'))) expect(fs.statSync(path.join(pk, f)).size, f).toBeLessThan(400 * 1024);
});

test('AC650: the Shop shows the four packs (Oreheart, Junkpile, Gizmo, Deepforge) with their painted pack, price 100, "opened today" and the odds in plain words; Back closes it', async ({ page }) => {
  await openEcon(page, 'shop');
  const packs = page.locator('.shop-pack');
  await expect(packs).toHaveCount(4);
  await expect(packs.locator('h2')).toHaveText(['Oreheart Pack', 'Junkpile Pack', 'Gizmo Pack', 'Deepforge Pack']);
  const arts = await packs.locator('img.pko-sealed').evaluateAll((els) => els.map((i) => i.getAttribute('src')));
  expect(arts).toEqual(['/art/packs/pack-general.webp', '/art/packs/pack-goblin.webp', '/art/packs/pack-gnome.webp', '/art/packs/pack-dwarf.webp']);
  for (let i = 0; i < 4; i++) {
    await expect(packs.nth(i).locator('.shop-price')).toContainText('100');
    await expect(packs.nth(i).locator('.shop-today')).toHaveText(/^\d+ opened today$/);
    await expect(packs.nth(i).locator('.shop-odds')).toHaveText('8 cards: 5 Common, 2 Uncommon, 1 Rare or better: Rare 85 %, Ultra Rare 13 %, Collector 2 %');
  }
  await expect(page.getByTestId('coin-chip').first()).toContainText('300');
  await expect(packs.first().locator('.shop-free'), 'the free pack ribbon').toHaveText('FREE');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.econ-screen')).toHaveCount(0);
});

test('AC651: buying in the Shop plays the opening for that pack (the free pack first, then 100 coins); Done returns to the Shop; with too few coins the button reads "Need 100 coins" with a quest hint', async ({ page }) => {
  await openEcon(page, 'shop');
  await page.locator('.shop-pack[data-pack="goblin"] .shop-buy').click();
  await expect(page.locator('[data-screen="econ-pack"] .pko-stage')).toHaveAttribute('data-pack-art', 'goblin');
  await page.evaluate(() => { window.oreheart.packs.skip(); window.oreheart.packs.skip(); });
  expect(await page.evaluate(() => window.oreheart.packs.coins())).toEqual({ coins: 300, free_packs: 0 });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('[data-screen="econ-shop"]')).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.locator('.shop-pack[data-pack="standard"] .shop-buy').click();
    await expect(page.locator('[data-screen="econ-pack"]')).toBeVisible();
    await page.evaluate(() => { window.oreheart.packs.skip(); window.oreheart.packs.skip(); });
    if (i < 2) await expect(page.getByRole('button', { name: /^Open another \(100\)$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  }
  expect((await page.evaluate(() => window.oreheart.packs.coins())).coins).toBe(0);
  const buy = page.locator('.shop-pack[data-pack="standard"] .shop-buy');
  await expect(buy).toBeDisabled();
  await expect(buy).toHaveText('Need 100 coins');
  await expect(page.locator('.shop-pack[data-pack="standard"] .shop-hint')).toHaveText('Finish quests to earn coins');
  await expect(page.locator('.shop-pack[data-pack="standard"] .shop-today')).toHaveText('3 opened today');
});

test('AC652: the Collection shows every card with "×N" for owned ones, unowned ones greyed with a lock, the counts line, and the faction / rarity / owned filters', async ({ page }) => {
  await openEcon(page, 'collection');
  const tiles = page.locator('.col-card');
  await expect.poll(() => tiles.count()).toBeGreaterThan(50);
  const n = await tiles.count();
  await expect(page.locator('.col-count')).toHaveText(new RegExp(`^You own \\d+ cards? \\(\\d+ of ${n} different\\)$`));
  const info = await tiles.evaluateAll((els) => els.map((e) => ({ owned: e.dataset.owned, unowned: e.classList.contains('unowned'), badge: e.querySelector('.col-badge')?.textContent || '', lock: !!e.querySelector('.col-lock'), opacity: +getComputedStyle(e.querySelector('.ohcard')).opacity })));
  for (const t of info) {
    if (t.owned === 'free') expect(t.badge).toBe('∞');
    else if (+t.owned > 0) { expect(t.badge).toBe('×' + t.owned); expect(t.unowned).toBe(false); }
    else { expect(t.unowned).toBe(true); expect(t.lock).toBe(true); expect(t.opacity).toBeLessThan(0.6); }
  }
  expect(info.some((t) => t.unowned)).toBe(true);
  await page.getByRole('group', { name: 'Faction' }).getByRole('button', { name: 'Goblins' }).click();
  const shownIds = await page.locator('.col-card:not([hidden])').evaluateAll((els) => els.map((e) => e.dataset.cardId));
  expect(shownIds.length).toBeGreaterThan(5);
  for (const id of shownIds) expect((await page.evaluate((i) => window.oreheart.getCard(i), id)).faction).toBe('goblins');
  await page.getByRole('group', { name: 'Faction' }).getByRole('button', { name: 'All' }).click();
  await page.getByRole('group', { name: 'Owned' }).getByRole('button', { name: 'Missing' }).click();
  const missing = await page.locator('.col-card:not([hidden])').evaluateAll((els) => els.map((e) => e.classList.contains('unowned')));
  expect(missing.length).toBeGreaterThan(0);
  expect(missing.every(Boolean)).toBe(true);
  await page.getByRole('group', { name: 'Owned' }).getByRole('button', { name: 'All' }).click();
  await page.getByRole('group', { name: 'Rarity' }).getByRole('button', { name: 'Collector' }).click();
  const rar = await page.locator('.col-card:not([hidden])').evaluateAll((els) => els.map((e) => e.dataset.rarity));
  expect(rar.length).toBeGreaterThan(0);
  expect(new Set(rar)).toEqual(new Set(['collector']));
});

test('AC653: Daily Quests shows each quest with name, text, a progress bar, the coin reward, a Done tick when paid, days left, one Reroll a day, and the streak line', async ({ page }) => {
  await openEcon(page, 'quests');
  const rows = page.locator('.q-row');
  await expect(rows).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(rows.nth(i).locator('.q-name')).not.toHaveText('');
    await expect(rows.nth(i).locator('.q-text')).not.toHaveText('');
    await expect(rows.nth(i).getByRole('progressbar')).toHaveCount(1);
    await expect(rows.nth(i).locator('.q-progress')).toHaveText(/^\d+ \/ \d+$/);
  }
  const done = page.locator('.q-row[data-done="true"]');
  await expect(done).toHaveCount(1);
  await expect(done.locator('.q-paid')).toHaveText(/^✔ \+\d+$/);
  await expect(done.locator('.q-reroll')).toHaveCount(0);
  await expect(page.locator('.q-row[data-done="false"]').first()).toContainText(/\d+ days? left|Ends today/);
  await expect(page.locator('.q-row[data-done="false"] .q-reward').first()).toHaveText(/^\+\d+$/);
  await expect(page.getByTestId('quest-streak')).toHaveText(/^Quest streak: \d+ days? \(free pack at 7\)$/);
  const rerolls = page.getByRole('button', { name: /^Reroll / });
  await expect(rerolls).toHaveCount(2);
  const before = await rows.nth(1).getAttribute('data-quest');
  await rerolls.first().click();
  await expect(page.getByRole('button', { name: /^Reroll / })).toHaveCount(0); // one reroll a day
  expect(await page.locator('.q-row').nth(1).getAttribute('data-quest')).not.toBe(before);
  const filled = await page.locator('.q-row[data-done="true"] .q-fill').evaluate((e) => getComputedStyle(e).transform);
  expect(filled).toMatch(/^matrix\(1, 0, 0, 1,/);
});

test('AC654: the quest summary hook counts only my side from real engine events (and a match under 3 turns counts nothing)', async ({ page }) => {
  await openEcon(page, 'quests');
  const r = await page.evaluate(() => {
    const ev = [{ type: 'turnStart', player: 'player', turn: 1 }, { type: 'summon', uid: 'a', cardId: 'goblin-scrounger', owner: 'player' }, { type: 'summon', uid: 'b', cardId: 'dwarf-miner', owner: 'opponent' },
      { type: 'swing', uid: 'a', targetUid: 'b', result: 'hit' }, { type: 'swing', uid: 'b', targetUid: 'a', result: 'hit' }, { type: 'damage', commander: 'opponent', amount: 2 }, { type: 'damage', commander: 'player', amount: 5 }];
    const st = (turn) => ({ turn, winner: 'player', players: { player: { commanderId: 'grubnak' }, opponent: { commanderId: 'borgo' } }, board: { creatures: [] } });
    return { long: window.oreheart.packs.summarize(ev, st(5)), short: window.oreheart.packs.summarize(ev, st(2)) };
  });
  expect(r.long).toMatchObject({ turns: 5, won: true, wins: 1, battles: 1, commander: 'grubnak', creaturesPlayed: 1, hitsLanded: 1, commanderDamage: 2, cardsByFaction: { goblins: 1, gnomes: 0, dwarves: 0 } });
  expect(r.short).toMatchObject({ creaturesPlayed: 0, hitsLanded: 0, wins: 0, commanderDamage: 0 });
});

test('AC655: the economy screens use the silver kit, never gold', async ({ page }) => {
  for (const kind of ['shop', 'quests', 'collection', 'pack']) {
    await openEcon(page, kind);
    const gold = await page.evaluate(() => {
      const bad = [];
      for (const e of document.querySelectorAll('.econ-screen, .econ-screen *')) {
        if (e.closest('.ohcard')) continue; // card faces are the owner's Card Format
        const s = getComputedStyle(e);
        for (const v of [s.color, s.backgroundColor, s.borderTopColor, s.boxShadow]) if (/rgba?\((255, 215, 0|212, 169, 79|255, 211, 107)/.test(v)) bad.push(e.className + ' ' + v);
      }
      return bad;
    });
    expect(gold, kind).toEqual([]);
  }
});

test('AC656: offline play is unchanged: without a signed-in player the deck builder shows no owned counts and no economy screen opens on a normal test page', async ({ page }) => {
  await page.goto('/?test=1');
  await page.waitForFunction(() => !!window.oreheart);
  await page.waitForTimeout(500);
  await expect(page.locator('.econ-bar')).toHaveCount(0);
  await expect(page.locator('.econ-screen')).toHaveCount(0);
  expect(await page.evaluate(() => !!(window.oreheart.packs))).toBe(false);
});

// =====================================================================
// With the local Supabase (needDb), every test makes its own users
// =====================================================================
const SB_URL = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;
const SB_TEST_ADMIN = process.env.SUPABASE_TEST_ADMIN_KEY; // test-runner only, never in app code
const ONLINE = '/?test=1&online=1';
const PW = 'Goodpass123x';
const letters = (n) => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]).join('');
const newEmail = () => `t-${letters(12)}@test.local`;
const newName = () => 'T' + letters(11);
const needDb = () => test.skip(!SB_URL || !SB_ANON || !SB_TEST_ADMIN, 'local Supabase not configured');
async function sbClient(key, headers) {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(SB_URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: headers ? { headers } : undefined });
}
const anonDb = (headers) => sbClient(SB_ANON, headers);
const runnerDb = () => sbClient(SB_TEST_ADMIN);
async function eulaVersion() {
  const { fs, path, dir } = await appDir();
  return JSON.parse(fs.readFileSync(path.join(dir, 'src/content/eula.json'), 'utf8')).version;
}
async function makeUser({ age = '13_plus', confirmed = true, username = newName(), email = newEmail() } = {}) {
  const db = await runnerDb();
  const { data, error } = await db.auth.admin.createUser({ email, password: PW, email_confirm: confirmed, user_metadata: { username, age_group: age, eula_version: await eulaVersion() } });
  expect(error, error && error.message).toBeNull();
  return { id: data.user.id, email, username, password: PW };
}
async function loginApi(u) {
  const c = await anonDb();
  const { error } = await c.auth.signInWithPassword({ email: u.email, password: u.password });
  expect(error, error && error.message).toBeNull();
  return c;
}
async function totpCode(secret) {
  const m = await import('otplib');
  if (m.authenticator) return m.authenticator.generate(secret);
  if (m.generateSync) return m.generateSync({ secret });
  return await m.generate({ secret });
}
async function makeAdmin() {
  const u = await makeUser();
  const { error } = await (await runnerDb()).from('roles').insert({ user_id: u.id, role: 'admin', granted_by: u.id });
  expect(error, error && error.message).toBeNull();
  const c = await loginApi(u);
  const { data: f, error: e1 } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'f' + letters(6) });
  expect(e1, e1 && e1.message).toBeNull();
  const { error: e2 } = await c.auth.mfa.challengeAndVerify({ factorId: f.id, code: await totpCode(f.totp.secret) });
  expect(e2, e2 && e2.message).toBeNull();
  return { ...u, c };
}
async function gameSignIn(page, u, url = ONLINE) {
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByLabel('Email', { exact: true }).fill(u.email);
  await page.getByLabel('Password', { exact: true }).fill(u.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function gameToMenu(page, u, url = ONLINE) {
  await gameSignIn(page, u, url);
  const menuH = page.getByRole('button', { name: 'Profile', exact: true });
  const avatar = page.getByRole('heading', { name: 'Choose your avatar' });
  await expect(menuH.or(avatar)).toBeVisible({ timeout: 15000 });
  if (await avatar.isVisible()) {
    await page.getByRole('group', { name: 'Avatars' }).getByRole('button').first().click();
    await expect(page.getByRole('heading', { name: /^Welcome to the Skullfang Arena/ })).toBeVisible();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  const imported = page.getByText(/^Imported \d+ decks?/);
  if (await imported.isVisible().catch(() => false)) await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(menuH).toBeVisible();
}
const coinsOf = async (id) => (await (await runnerDb()).from('wallets').select('coins').eq('user_id', id).single()).data.coins;
const ownedTotal = async (c) => { const { data, error } = await c.rpc('my_collection'); expect(error, error && error.message).toBeNull(); return (data || []).reduce((n, r) => n + Number(r.count), 0); };
const key = () => 'k' + letters(20);
async function setCoins(u, target) {
  const ad = await makeAdmin();
  const now = await coinsOf(u.id);
  if (now !== target) { const { error } = await ad.c.rpc('admin_grant_coins', { p_user: u.id, p_amount: target - now, p_reason: 'economy test', p_idem_key: key() }); expect(error, error && error.message).toBeNull(); }
  expect(await coinsOf(u.id)).toBe(target);
}

test('AC657: a new player has 300 coins and the starter collection; the menu shows the coin chip and Shop / Collection / Quests', async ({ page }) => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  expect(await coinsOf(u.id)).toBe(300);
  expect(await ownedTotal(c)).toBeGreaterThan(0);
  await gameToMenu(page, u);
  const bar = page.getByRole('group', { name: 'Coins and packs' });
  await expect(bar.getByTestId('coin-chip')).toContainText('300');
  for (const b of ['Shop', 'Collection', 'Quests']) await expect(bar.getByRole('button', { name: b })).toBeVisible();
  await bar.getByRole('button', { name: 'Collection' }).click();
  await expect(page.locator('.col-count')).toHaveText(/^You own [1-9]\d* cards/);
});

test('AC658: shop_info lists the 4 active packs, each slot\'s odds summing to exactly 100 %; the Shop screen shows them', async ({ page }) => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  const { data, error } = await c.rpc('shop_info');
  expect(error, error && error.message).toBeNull();
  expect(data.packs.map((p) => p.id).sort()).toEqual(['dwarf', 'gnome', 'goblin', 'standard']);
  for (const p of data.packs) {
    expect(p.slots.reduce((n, s) => n + s.count, 0)).toBe(8);
    for (const s of p.slots) expect(Object.values(s.odds).reduce((a, b) => a + b, 0), `${p.id} slot ${s.slot_no}`).toBe(10000);
  }
  expect(data.coins).toBe(300);
  await gameToMenu(page, u);
  await page.getByRole('group', { name: 'Coins and packs' }).getByRole('button', { name: 'Shop' }).click();
  await expect(page.locator('.shop-pack')).toHaveCount(4);
});

test('AC659: opening a pack costs 100 coins and adds exactly 8 card instances; the opening animation shows those 8 cards', async ({ page }) => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  const before = await ownedTotal(c);
  const { data, error } = await c.rpc('open_pack', { p_pack_type: 'standard', p_idem_key: key(), p_use_free: false });
  expect(error, error && error.message).toBeNull();
  expect(data.cards).toHaveLength(8);
  expect(data.price_paid).toBe(100);
  expect(data.coins_after).toBe(200);
  expect(await coinsOf(u.id)).toBe(200);
  expect(await ownedTotal(c)).toBe(before + 8);
  // through the game screens
  await gameToMenu(page, u);
  await page.getByRole('group', { name: 'Coins and packs' }).getByRole('button', { name: 'Shop' }).click();
  await page.locator('.shop-pack[data-pack="goblin"] .shop-buy').click();
  await expect(page.locator('[data-screen="econ-pack"]')).toBeVisible({ timeout: 15000 });
  const st = await page.evaluate(() => window.oreheart.packs.state());
  expect(st.cards).toHaveLength(8);
  await expect.poll(() => coinsOf(u.id)).toBe(100);
  await page.evaluate(() => { window.oreheart.packs.skip(); window.oreheart.packs.skip(); });
  await expect(page.getByTestId('coin-chip').first()).toContainText('100');
});

test('AC660: the same idem key twice is one opening and one charge', async () => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  const k = key();
  const a = await c.rpc('open_pack', { p_pack_type: 'gnome', p_idem_key: k, p_use_free: false });
  const b = await c.rpc('open_pack', { p_pack_type: 'gnome', p_idem_key: k, p_use_free: false });
  expect(a.error).toBeNull(); expect(b.error).toBeNull();
  expect(b.data.opening_id).toBe(a.data.opening_id);
  expect(b.data.cards).toEqual(a.data.cards);
  expect(await coinsOf(u.id)).toBe(200);
});

test('AC661: a player with 50 coins is refused (nothing charged, no cards) and the Shop button reads "Need 100 coins"', async ({ page }) => {
  needDb();
  const u = await makeUser();
  await setCoins(u, 50);
  const c = await loginApi(u);
  const before = await ownedTotal(c);
  const { error } = await c.rpc('open_pack', { p_pack_type: 'standard', p_idem_key: key(), p_use_free: false });
  expect(error).not.toBeNull();
  expect(await coinsOf(u.id)).toBe(50);
  expect(await ownedTotal(c)).toBe(before);
  await gameToMenu(page, u);
  await page.getByRole('group', { name: 'Coins and packs' }).getByRole('button', { name: 'Shop' }).click();
  const buy = page.locator('.shop-pack[data-pack="standard"] .shop-buy');
  await expect(buy).toHaveText('Need 100 coins');
  await expect(buy).toBeDisabled();
});

test('AC662: 10 parallel openings with 10 different keys and 300 coins give exactly 3 openings and 0 coins', async () => {
  needDb();
  const u = await makeUser();
  const cs = await Promise.all(Array.from({ length: 10 }, () => loginApi(u)));
  const before = await ownedTotal(cs[0]);
  const res = await Promise.all(cs.map((c) => c.rpc('open_pack', { p_pack_type: 'standard', p_idem_key: key(), p_use_free: false })));
  expect(res.filter((r) => !r.error)).toHaveLength(3);
  expect(await coinsOf(u.id)).toBe(0);
  expect(await ownedTotal(cs[0])).toBe(before + 24);
});

test('AC663: the Quests screen shows the 3 quests dealt today (one easy, one medium, one hard)', async ({ page }) => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  const { data, error } = await c.rpc('my_quests');
  expect(error, error && error.message).toBeNull();
  expect(data.quests).toHaveLength(3);
  expect(data.quests.map((q) => q.tier).sort()).toEqual(['easy', 'hard', 'medium']);
  await gameToMenu(page, u);
  await page.getByRole('group', { name: 'Coins and packs' }).getByRole('button', { name: 'Quests' }).click();
  await expect(page.locator('.q-row')).toHaveCount(3);
  await expect(page.getByTestId('quest-streak')).toBeVisible();
});

test('AC664: a quest_report of a 5-turn won match advances "Pick a Fight" and pays nothing until it is done; the same ref twice adds nothing; the second battle pays once', async () => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  let q = (await c.rpc('my_quests')).data;
  let pf = q.quests.find((x) => x.quest_id === 'pick-a-fight');
  if (!pf) {
    const db = await runnerDb();
    const today = q.today;
    const exp = new Date(Date.parse(today + 'T00:00:00Z') + 3 * 864e5).toISOString().slice(0, 10);
    const { error } = await db.from('player_quests').insert({ user_id: u.id, quest_id: 'pick-a-fight', params: {}, dealt_on: today, progress: 0, target: 2, expires_on: exp });
    expect(error, error && error.message).toBeNull();
    q = (await c.rpc('my_quests')).data;
    pf = q.quests.find((x) => x.quest_id === 'pick-a-fight');
  }
  expect(pf).toBeTruthy();
  const start = pf.progress;
  const sum = { turns: 5, won: true, commander: 'grubnak', battles: 1, wins: 1, creaturesPlayed: 0, cardsByFaction: { goblins: 0, gnomes: 0, dwarves: 0 }, cost7Plays: 0, hitsLanded: 0, hitsBlocked: 0, unitsDefeated: 0, commanderDamage: 0, mineHoldTurns: 0, minerMines: 0 };
  const coins0 = await coinsOf(u.id);
  const ref = 'practice:' + crypto.randomUUID();
  const r1 = await c.rpc('quest_report', { p_summary: sum, p_ref: ref });
  expect(r1.error, r1.error && r1.error.message).toBeNull();
  const after1 = r1.data.quests.find((x) => x.id === pf.id);
  expect(after1.progress).toBe(start + 1);
  expect(after1.done).toBe(false);
  expect(await coinsOf(u.id), 'nothing paid before the quest is done').toBe(coins0);
  const r2 = await c.rpc('quest_report', { p_summary: sum, p_ref: ref });
  const again = (r2.data ? r2.data.quests : (await c.rpc('my_quests')).data.quests).find((x) => x.id === pf.id);
  expect(again.progress, 'the same match counts once').toBe(start + 1);
  const r3 = await c.rpc('quest_report', { p_summary: sum, p_ref: 'practice:' + crypto.randomUUID() });
  expect(r3.error, r3.error && r3.error.message).toBeNull();
  const done = r3.data.quests.find((x) => x.id === pf.id);
  expect(done.done).toBe(true);
  expect(await coinsOf(u.id)).toBe(coins0 + done.reward);
});

test('AC665: a 2-turn match report counts for nothing', async () => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  const q0 = (await c.rpc('my_quests')).data;
  const sum = { turns: 2, won: true, commander: 'grubnak', battles: 1, wins: 1, creaturesPlayed: 30, cardsByFaction: { goblins: 10, gnomes: 10, dwarves: 10 }, cost7Plays: 5, hitsLanded: 50, hitsBlocked: 20, unitsDefeated: 20, commanderDamage: 20, mineHoldTurns: 5, minerMines: 20 };
  const r = await c.rpc('quest_report', { p_summary: sum, p_ref: 'practice:' + crypto.randomUUID() });
  expect(r.error, r.error && r.error.message).toBeNull();
  for (const x of r.data.quests) expect(x.progress).toBe(q0.quests.find((y) => y.id === x.id).progress);
});

test('AC666: decks can only use the copies a player owns: a 5th copy of a card owned 4 times is refused by the server and the deck builder caps it at 4', async ({ page }) => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  const { data: rows } = await c.rpc('my_collection');
  const owned = Object.fromEntries((rows || []).map((r) => [r.card_id, Number(r.count)]));
  expect(owned['shiv-rat'], 'starter collection has 4 Shiv Rats').toBe(4);
  const deck = (n) => Array(30).fill('goblin-scrounger').concat(Array(n).fill('shiv-rat'), Array(4).fill('goblin-grunt'), Array(4).fill('goblin-slinger'), Array(4).fill('skullbasher-rusher'), Array(4).fill('goblin-pebbler'));
  const bad = await c.rpc('save_deck', { p_id: null, p_name: 'Too many rats', p_commander: 'grubnak', p_cards: deck(5) });
  expect(bad.error).not.toBeNull();
  expect(bad.error.message).toMatch(/you own 4 of Shiv Rat/i);
  await gameToMenu(page, u);
  await expect.poll(() => page.evaluate(() => window.oreheart.packs.deckLimit('shiv-rat')), { timeout: 10000 }).toMatchObject({ owned: 4 });
  const lim = await page.evaluate(() => window.oreheart.packs.deckLimit('shiv-rat'));
  expect(lim.limit).toBeLessThanOrEqual(4);
  expect(lim.limit).toBe(Math.min(4, lim.copyLimit));
});
