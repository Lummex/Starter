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
  expect((await packState(page)).cards).toHaveLength(11);
});

test('AC641: ripping runs idle -> ripping -> cards: the pack shakes, the top strip tears off (it moves), plenty of foil shreds fly, and the eleven cards come out face down', async ({ page }) => {
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
  expect(seen.shreds, 'foil shreds').toBeGreaterThanOrEqual(30);
  expect(seen.shreds).toBeLessThanOrEqual(100);
  const cards = page.locator('.pko-card');
  await expect(cards).toHaveCount(11);
  for (let i = 0; i < 11; i++) { await expect(cards.nth(i)).toBeVisible(); await expect(cards.nth(i)).toHaveAttribute('data-flipped', 'false'); }
  await expect(page.locator('.pko-shred')).toHaveCount(0, { timeout: 4000 }); // the shreds clean themselves up
});

test('AC642: the player flips each card by clicking it (a 3D Y-turn shows the real card face); after all 11 the phase is done with "Open another" and "Done"', async ({ page }) => {
  await ripToCards(page);
  const cards = page.locator('.pko-card');
  for (let i = 0; i < 11; i++) {
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
  await expect.poll(async () => (await packState(page)).flipped, { timeout: 5000 }).toBe(11);
  expect((await packState(page)).phase).toBe('done');
  // skip from idle
  await page.evaluate(() => window.oreheart.packs.open('standard'));
  await expect.poll(async () => (await packState(page)).phase).toBe('idle');
  await page.evaluate(() => window.oreheart.packs.skip());
  expect((await packState(page)).phase).toBe('cards');
  await expect(page.locator('.pko-card')).toHaveCount(11);
  await page.evaluate(() => window.oreheart.packs.skip());
  const st = await packState(page);
  expect(st.phase).toBe('done');
  expect(st.flipped).toBe(11);
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

for (const vp of [{ name: 'PC', width: 1920, height: 1080, minW: 150 }, { name: 'PC small', width: 1280, height: 720, minW: 100 }, { name: 'phone', width: 844, height: 390, minW: 70 }]) {
  test(`AC646: the pack opening fits the screen (${vp.name} ${vp.width}x${vp.height}): pack, eleven cards (Ken, Nov 5: 3 Standard Miners + 8) in one row and the buttons all inside the view`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await openEcon(page, 'pack');
    const inside = async (sel) => page.locator(sel).evaluateAll((els, [W, H]) => els.filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= W + 1 && r.bottom <= H + 1; }), [vp.width, vp.height]);
    expect(await inside('.pko-stage')).toEqual([true]);
    expect(await inside('.pko-rip-btn')).toEqual([true]);
    await page.evaluate(() => window.oreheart.packs.skip());
    await page.evaluate(() => window.oreheart.packs.skip());
    await page.waitForTimeout(800);
    expect(await inside('.pko-card')).toEqual(Array(11).fill(true));
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

test('AC650: the Shop sells the one Oreheart pack (Ken, Nov 6: no Junkpile, Gizmo or Deepforge; no kind pills) as four bundles with its painted pack, the single pack at 100 with "opened today", and the odds in plain words; Back closes it', async ({ page }) => {
  await openEcon(page, 'shop');
  const kinds = page.locator('.shop-kinds .net-race');
  await expect(kinds).toHaveCount(1);
  await expect(page.locator('.shop-kinds')).toBeHidden(); // one kind: no pills (they return by themselves if an admin turns a second kind on)
  const tiles = page.locator('.shop-bundle');
  await expect(tiles).toHaveCount(4);
  const artOf = async () => tiles.first().locator('img.pko-sealed').getAttribute('src');
  expect(await artOf()).toBe('/art/packs/pack-general.webp');
  await expect(tiles.first().locator('.shop-price')).toContainText('100');
  await expect(tiles.first().locator('.shop-promise')).toHaveText(/^\d+ opened today$/);
  await expect(page.locator('.shop-odds')).toHaveText('11 cards: 3 Standard Miners, 4 Common, 2 Uncommon, 1 Rare, 1 Rare or better: Rare 78%, Ultra Rare 20%, Legendary 2%');
  await expect(page.getByTestId('coin-chip').first()).toContainText('500');
  await expect(tiles.first().locator('.shop-free'), 'the free pack ribbon').toHaveText('FREE');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.econ-screen')).toHaveCount(0);
});

test('AC651: buying in the Shop plays the opening for that pack (the free pack first, then 100 coins); Done returns to the Shop; with too few coins the button reads "Need 100 coins" with a quest hint', async ({ page }) => {
  await openEcon(page, 'shop');
  await page.locator('.shop-bundle[data-size="1"] .shop-buy').click();
  await expect(page.locator('[data-screen="econ-pack"] .pko-stage')).toHaveAttribute('data-pack-art', 'general');
  await page.evaluate(() => { window.oreheart.packs.skip(); window.oreheart.packs.skip(); });
  expect(await page.evaluate(() => window.oreheart.packs.coins())).toEqual({ coins: 500, free_packs: 0 });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('[data-screen="econ-shop"]')).toBeVisible();
  for (let i = 0; i < 5; i++) { // 500 coins (zero start, Nov 4) = five 100-coin packs
    await page.locator('.shop-bundle[data-size="1"] .shop-buy').click();
    await expect(page.locator('[data-screen="econ-pack"]')).toBeVisible();
    await page.evaluate(() => { window.oreheart.packs.skip(); window.oreheart.packs.skip(); });
    if (i < 4) await expect(page.getByRole('button', { name: /^Open another \(100\)$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
  }
  expect((await page.evaluate(() => window.oreheart.packs.coins())).coins).toBe(0);
  const buy = page.locator('.shop-bundle[data-size="1"] .shop-buy');
  await expect(buy).toBeDisabled();
  await expect(buy).toHaveText('Need 100 coins');
  await expect(page.locator('.shop-bundle[data-size="1"] .shop-hint')).toHaveText('Finish quests to earn coins, or pay with Oreshards'); // Nov 7
  await expect(page.locator('.shop-bundle[data-size="1"] .shop-promise')).toHaveText('6 opened today'); // the free pack and the five bought ones
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
  await page.getByRole('group', { name: 'Rarity' }).getByRole('button', { name: 'Legendary' }).click(); // Ken, Nov 5: the top rarity reads Legendary
  const rar = await page.locator('.col-card:not([hidden])').evaluateAll((els) => els.map((e) => e.dataset.rarity));
  expect(rar.length).toBeGreaterThan(0);
  expect(new Set(rar)).toEqual(new Set(['collector']));
});

test('AC680: upgraded cards: a pack can drop one (forced here): its tier art or stars show on the flipped card with an UPGRADED tag, the hint names it; every card face carries its tier stars (one dim star on an Original)', async ({ page }) => {
  await ripToCards(page, 'standard', 'tier5');
  await page.evaluate(() => window.oreheart.packs.flipAll());
  await expect.poll(async () => (await packState(page)).phase, { timeout: 8000 }).toBe('done');
  const first = page.locator('.pko-card').first();
  await expect(first).toHaveAttribute('data-tier', '5');
  expect(await first.evaluate((e) => e.classList.contains('pko-upgraded'))).toBe(true);
  await expect(first.locator('.pko-upg')).toHaveText('MYTHIC');
  expect(await first.locator('.oh-stars[data-tier="5"] i').count()).toBe(5);
  const art = await first.evaluate((e) => { const im = e.querySelector('.pko-front .ly img'); return im ? im.getAttribute('src') : ''; });
  const id = await first.getAttribute('data-card-id');
  const painted = await page.evaluate((i) => window.oreheart.hasUpgradeArt ? window.oreheart.hasUpgradeArt(i) : null, id);
  if (painted) expect(art).toBe(`/art/upgrades/${id}/5.webp`);
  await expect(page.locator('.pko-hint')).toContainText('UPGRADED');
  // the other seven are Originals: one dim star each, no tag
  const others = page.locator('.pko-card:not(.pko-upgraded)');
  expect(await others.count()).toBe(10);
  expect(await others.first().locator('.oh-stars[data-tier="1"] i').count()).toBe(1);
  expect(await others.first().locator('.pko-upg').count()).toBe(0);
});

test('AC681: the Collection shows each card at its best tier with a tier tag and an Upgraded filter; the close-up of an owned card has the Upgrade panel: keep one copy, tick others, Combine raises the worth and the stars (looks only)', async ({ page }) => {
  await openEcon(page, 'collection');
  const tiles = page.locator('.col-card');
  await expect.poll(() => tiles.count()).toBeGreaterThan(50);
  // a card with 4 copies (a Common on the stand-in page)
  const id = await page.locator('.col-card[data-owned="4"]').first().getAttribute('data-card-id');
  const tile = page.locator(`.col-card[data-card-id="${id}"]`); // by id: its owned count changes below
  await expect(tile).toHaveAttribute('data-tier', '1');
  await tile.click();
  const panel = page.locator('[data-testid="upgrade-panel"]');
  await expect(panel).toBeVisible();
  const rows = panel.locator('.col-upg-row');
  await expect.poll(() => rows.count()).toBe(4);
  await expect(rows.first()).toHaveClass(/keep/);
  const btn = panel.locator('.col-upg-btn');
  await expect(btn).toBeDisabled();
  await rows.nth(1).locator('.col-upg-pick').click(); // Hold -> Upgrade (Ken, Nov 5: per copy)
  await expect(panel.locator('.col-upg-status')).toContainText('= 2: Enhanced!');
  await expect(btn).toBeEnabled();
  await btn.click();
  await page.locator('[data-testid="upgrade-confirm"] .col-upg-ok').click(); // the confirm box first
  await expect.poll(() => rows.count()).toBe(3);
  await expect(rows.first()).toHaveAttribute('data-tier', '2');
  await expect(panel.locator('.col-upg-status')).toContainText('Worth 2');
  // the close-up card and the tile now show Enhanced: two stars, the tag, the Upgraded filter finds it
  expect(await page.locator('.col-big > .ohcard .oh-stars[data-tier="2"] i').count()).toBe(2);
  await page.keyboard.press('Escape');
  await expect(tile).toHaveAttribute('data-tier', '2');
  await expect(tile).toHaveAttribute('data-owned', '3');
  await expect(tile.locator('.col-tier')).toHaveText('Enhanced');
  await page.getByRole('group', { name: 'Owned' }).getByRole('button', { name: 'Upgraded' }).click();
  const shown = await page.locator('.col-card:not([hidden])').evaluateAll((els) => els.map((e) => e.dataset.tier));
  expect(shown.length).toBeGreaterThan(0);
  expect(shown.every((t) => Number(t) > 1)).toBe(true);
  // the stat numbers are the card's own (looks only)
  const card = await page.evaluate((i) => window.oreheart.getCard(i), id);
  expect(await tile.locator('.ohcard').evaluate((e) => e.textContent)).toContain(card.name);
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
  await expect(done.locator('.q-paid')).toHaveText(/^\+\d+$/);
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

test('AC657: a new player has 500 coins and owns no cards (zero start, Ken Nov 4); the menu shows the coin chip and Shop / Collection / Quests', async ({ page }) => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  expect(await coinsOf(u.id)).toBe(500);
  expect(await ownedTotal(c)).toBe(0);
  await gameToMenu(page, u);
  const bar = page.getByRole('group', { name: 'Coins and packs' });
  await expect(bar.getByTestId('coin-chip')).toContainText('500');
  for (const b of ['Shop', 'Collection', 'Quests']) await expect(bar.getByRole('button', { name: b })).toBeVisible();
  await bar.getByRole('button', { name: 'Collection' }).click();
  await expect(page.locator('.col-count')).toHaveText(/^You own 0 cards/);
});

test('AC658: shop_info lists the one active pack (Oreheart; Ken, Nov 6: the faction packs are switched off), each slot\'s odds summing to exactly 100%; the Shop screen shows its four bundles', async ({ page }) => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  const { data, error } = await c.rpc('shop_info');
  expect(error, error && error.message).toBeNull();
  expect(data.packs.map((p) => p.id).sort()).toEqual(['standard']);
  for (const p of data.packs) {
    expect(p.slots.reduce((n, s) => n + s.count, 0)).toBe(11);
    for (const s of p.slots) expect(Object.values(s.odds).reduce((a, b) => a + b, 0), `${p.id} slot ${s.slot_no}`).toBe(10000);
  }
  expect(data.coins).toBe(500);
  await gameToMenu(page, u);
  await page.getByRole('group', { name: 'Coins and packs' }).getByRole('button', { name: 'Shop' }).click();
  await expect(page.locator('.shop-pack')).toHaveCount(4);
});

test('AC659: opening a pack costs 100 coins and adds exactly 11 card instances; the opening animation shows those 11 cards', async ({ page }) => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  const before = await ownedTotal(c);
  const { data, error } = await c.rpc('open_pack', { p_pack_type: 'standard', p_idem_key: key(), p_use_free: false });
  expect(error, error && error.message).toBeNull();
  expect(data.cards).toHaveLength(11);
  expect(data.price_paid).toBe(100);
  expect(data.coins_after).toBe(200);
  expect(await coinsOf(u.id)).toBe(200);
  expect(await ownedTotal(c)).toBe(before + 11);
  // through the game screens
  await gameToMenu(page, u);
  await page.getByRole('group', { name: 'Coins and packs' }).getByRole('button', { name: 'Shop' }).click();
  await page.locator('.shop-pack[data-pack="standard"] .shop-buy').click();
  await expect(page.locator('[data-screen="econ-pack"]')).toBeVisible({ timeout: 15000 });
  const st = await page.evaluate(() => window.oreheart.packs.state());
  expect(st.cards).toHaveLength(11);
  await expect.poll(() => coinsOf(u.id)).toBe(100);
  await page.evaluate(() => { window.oreheart.packs.skip(); window.oreheart.packs.skip(); });
  await expect(page.getByTestId('coin-chip').first()).toContainText('100');
});

test('AC660: the same idem key twice is one opening and one charge', async () => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  const k = key();
  const a = await c.rpc('open_pack', { p_pack_type: 'standard', p_idem_key: k, p_use_free: false });
  const b = await c.rpc('open_pack', { p_pack_type: 'standard', p_idem_key: k, p_use_free: false });
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

test('AC666: decks can only use the copies a player owns: a new player owns none, so a deck with one Shiv Rat is refused by the server and the deck builder allows 0', async ({ page }) => {
  needDb();
  const u = await makeUser();
  const c = await loginApi(u);
  const { data: rows } = await c.rpc('my_collection');
  expect((rows || []).length, 'zero start: nothing owned').toBe(0);
  const deck = (n) => Array(30).fill('goblin-scrounger').concat(Array(n).fill('shiv-rat'), Array(4).fill('goblin-grunt'), Array(4).fill('goblin-slinger'), Array(4).fill('skullbasher-rusher'), Array(4).fill('goblin-pebbler'));
  const bad = await c.rpc('save_deck', { p_id: null, p_name: 'Too many rats', p_commander: 'grubnak', p_cards: deck(1) });
  expect(bad.error).not.toBeNull();
  expect(bad.error.message).toMatch(/you own 0 of /i);
  await gameToMenu(page, u);
  await expect.poll(() => page.evaluate(() => window.oreheart.packs.deckLimit('shiv-rat')), { timeout: 10000 }).toMatchObject({ owned: 0, limit: 0 });
});

test('AC674: zero start in the Deck Builder: with no cards of your own it says so in plain words, Auto-fill adds nothing you do not own, and the Shop is one tap away', async ({ page }) => {
  await openEcon(page, 'shop'); // loads the economy module and its test hooks
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('[data-screen=econ-shop]')).toHaveCount(0);
  expect(await page.evaluate(() => window.oreheart.packs.setOwned({}))).toBe(true);
  for (const w of await page.locator('.overlay.welcome').all()) await w.evaluate((e) => e.remove());
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  const note = page.getByTestId('db-empty');
  await expect(note).toBeVisible();
  await expect(note).toContainText(/empty/i);
  await expect(note).toContainText(/starter decks/i);
  await expect(page.locator('.db-tile.unowned').first()).toBeVisible();
  await page.getByRole('button', { name: 'Auto-fill' }).click();
  await expect.poll(() => page.locator('.db-list li').count()).toBeLessThanOrEqual(20); // only free crystals could go in, never an unowned card
  expect(await page.evaluate(() => [...document.querySelectorAll('.db-list li')].map((li) => li.textContent).filter((t) => !/Shard|Geode|Cluster|Motherlode|Heart/i.test(t)))).toEqual([]);
  await page.getByTestId('db-empty-shop').click();
  await expect(page.locator('[data-screen=econ-shop]')).toBeVisible();
});

test('AC686: Deck Builder close-up, signed in (Ken, Nov 5): the Upgrade panel stands where the 3D model was: your copies, Combine, and the five looks (owned lit, the rest locked with the copies they take); a look click shows it large; Commanders too', async ({ page }) => {
  await openEcon(page, 'shop'); // loads the economy module and its test hooks
  await page.getByRole('button', { name: 'Back' }).click();
  expect(await page.evaluate(() => window.oreheart.packs.setOwned({ 'goblin-grunt': 4, 'commander-grubnak': 2 }))).toBe(true);
  for (const w of await page.locator('.overlay.welcome').all()) await w.evaluate((e) => e.remove());
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  const tile = page.locator('.db-tile[data-card="goblin-grunt"]');
  await expect(tile).toBeVisible();
  await tile.focus();
  await page.keyboard.press('Enter');
  const zoom = page.locator('.cardzoom');
  const panel = zoom.locator('[data-testid="upgrade-panel"]');
  await expect(panel).toBeVisible();
  expect(await zoom.locator('.viewer3d').count()).toBe(0);
  await expect(zoom).toHaveClass(/with-upg/);
  const rows = panel.locator('.col-upg-row');
  await expect.poll(() => rows.count()).toBe(4);
  const looks = panel.locator('.upg-look');
  await expect(looks).toHaveCount(5);
  await expect(looks.nth(0)).toHaveClass(/lit/);
  await expect(looks.nth(1)).toHaveClass(/locked/);
  await expect(looks.nth(1).locator('.upg-look-need')).toHaveText('2 copies'); // the test page's Common steps
  await expect(looks.nth(4).locator('.upg-look-name')).toHaveText('Mythic');
  await looks.nth(4).click();
  await expect(zoom).toHaveCount(1); // the look click did not close the close-up
  expect(await zoom.locator('.cz-oh > .ohcard .oh-stars[data-tier="5"] i').count()).toBe(5);
  await expect(looks.nth(4)).toHaveAttribute('aria-pressed', 'true');
  // combine two copies: Enhanced, and its look lights up
  await rows.nth(1).locator('.col-upg-pick').click(); // Hold -> Upgrade
  await expect(panel.locator('.col-upg-status')).toContainText('= 2: Enhanced!');
  await panel.locator('.col-upg-btn').click();
  await page.locator('[data-testid="upgrade-confirm"] .col-upg-ok').click();
  await expect.poll(() => rows.count()).toBe(3);
  await expect(looks.nth(1)).toHaveClass(/lit/);
  expect(await zoom.locator('.cz-oh > .ohcard .oh-stars[data-tier="2"] i').count()).toBe(2);
  await page.keyboard.press('Escape');
  await expect(zoom).toHaveCount(0);
  // a Commander (double-click its portrait): two copies, the panel, the five looks
  await page.locator('.db-cmdcard[data-cmd="grubnak"]').dblclick();
  await expect(page.locator('.cardzoom [data-testid="upgrade-panel"]')).toBeVisible();
  await expect.poll(() => page.locator('.cardzoom .col-upg-row').count()).toBe(2);
  await expect(page.locator('.cardzoom .upg-look')).toHaveCount(5);
  await page.keyboard.press('Escape');
});

test('AC687: offline (nobody signed in) the Deck Builder close-up has no Upgrade panel: the card and its 3D model as before', async ({ page }) => {
  await page.goto('/?test=1');
  for (const w of await page.locator('.overlay.welcome').all()) await w.evaluate((e) => e.remove());
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  const tile = page.locator('.db-tile[data-card]').first();
  await expect(tile).toBeVisible();
  await tile.focus();
  await page.keyboard.press('Enter');
  const zoom = page.locator('.cardzoom');
  await expect(zoom).toBeVisible();
  await page.waitForTimeout(800);
  expect(await zoom.locator('[data-testid="upgrade-panel"]').count()).toBe(0);
  expect(await zoom.evaluate((e) => e.classList.contains('with-upg'))).toBe(false);
  await page.keyboard.press('Escape');
});

test('AC688: per-copy combine (Ken, Nov 5): one TARGET, Hold / Upgrade toggles on the other copies, "Upgrade to next level" picks the cheapest copies, "Combine with N copies" picks by number and tier; a confirm box says what goes and what stays, names the decks left short, and goes red when every copy would go', async ({ page }) => {
  await openEcon(page, 'shop');
  await page.getByRole('button', { name: 'Back' }).click();
  expect(await page.evaluate(() => window.oreheart.packs.setOwned({ 'goblin-grunt': 6 }, [{ name: 'Junk Pile', cards: Array(4).fill('goblin-grunt'), commander: 'grubnak' }]))).toBe(true);
  for (const w of await page.locator('.overlay.welcome').all()) await w.evaluate((e) => e.remove());
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  const tile = page.locator('.db-tile[data-card="goblin-grunt"]');
  await tile.focus();
  await page.keyboard.press('Enter');
  const panel = page.locator('.cardzoom [data-testid="upgrade-panel"]');
  await expect(panel).toBeVisible();
  const rows = panel.locator('.col-upg-row');
  await expect.poll(() => rows.count()).toBe(6);
  await expect(rows.first().locator('.col-upg-keeptag')).toHaveText('TARGET');
  await expect(rows.nth(1).locator('.col-upg-pick')).toHaveText('Hold');
  await expect(panel.locator('.col-upg-btn')).toBeDisabled();
  // one tap: the cheapest copies for the next tier (the test page's Common steps: Enhanced at worth 2)
  const next = panel.locator('.col-upg-next');
  await expect(next).toBeVisible();
  await expect(next).toContainText('Upgrade to Enhanced (uses 1 copy)');
  await next.click();
  await expect(panel.locator('.col-upg-row.picked')).toHaveCount(1);
  await expect(panel.locator('.col-upg-row.picked .col-upg-pick')).toHaveText('Upgrade');
  await expect(panel.locator('.col-upg-status')).toContainText('= 2: Enhanced!');
  await expect(panel.locator('.upg-look.reach')).toHaveAttribute('data-tier', '2');
  // the confirm box: 1 copy goes, 5 stay, the deck of 4 is fine
  await panel.locator('.col-upg-btn').click();
  const box = page.locator('[data-testid="upgrade-confirm"]');
  await expect(box).toBeVisible();
  await expect(box).toContainText('combines 1 copy');
  await expect(box).toContainText('5 copies left after');
  expect(await box.locator('.col-upg-warn').count()).toBe(0);
  expect(await box.locator('.col-upg-danger').count()).toBe(0);
  await box.locator('.col-upg-ok').click();
  await expect.poll(() => rows.count()).toBe(5);
  await expect(rows.first()).toHaveAttribute('data-tier', '2');
  // the quick pick: 4 plain copies by number; the box warns about the deck (only 1 left, Junk Pile uses 4) in red
  await panel.locator('.col-upg-qn').fill('4');
  await panel.locator('.col-upg-qgo').click();
  await expect(panel.locator('.col-upg-row.picked')).toHaveCount(4);
  await expect(panel.locator('.col-upg-status')).toContainText('= 6: Overcharged!');
  await panel.locator('.col-upg-btn').click();
  await expect(box).toBeVisible();
  await expect(box.locator('.col-upg-warn')).toContainText('Only 1 left to play. Your deck Junk Pile uses 4. Are you sure?');
  await expect(box.locator('.col-upg-danger')).toContainText('every copy');
  await box.locator('.col-upg-cancel').click();
  await expect(box).toHaveCount(0);
  await expect.poll(() => rows.count()).toBe(5); // nothing was combined
  await page.keyboard.press('Escape');
});

test('AC689: the Deck Builder knows which copy goes in (Ken, Nov 5): a card with an Enhanced copy shows "Enhanced ×1 · Original ×3" on its tile; in the deck list each copy is a chip, the best copy first, and a tap swaps a slot to another tier that has a spare copy', async ({ page }) => {
  await openEcon(page, 'shop');
  await page.getByRole('button', { name: 'Back' }).click();
  expect(await page.evaluate(() => window.oreheart.packs.setOwned({ 'goblin-grunt': [2, 1, 1, 1], 'goblin-scrounger': 5 }))).toBe(true);
  for (const w of await page.locator('.overlay.welcome').all()) await w.evaluate((e) => e.remove());
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  const tile = page.locator('.db-tile[data-card="goblin-grunt"]');
  await expect(tile.locator('.db-tiersum')).toHaveText('Enhanced ×1 · Original ×3');
  expect(await page.locator('.db-tile[data-card="goblin-scrounger"] .db-tiersum:not([hidden])').count()).toBe(0); // all plain: no summary
  // three copies into the deck (Nov 7: the tile's + adds one; a double-click opens the big view)
  for (let i = 0; i < 3; i++) await tile.getByTestId('db-plus').click();
  const li = page.locator('.db-list li', { hasText: 'Snotskull Grunt' });
  await expect(li.locator('.db-cnt')).toHaveText('3 ×');
  const chips = li.locator('.db-tier');
  await expect(chips).toHaveCount(3);
  await expect(chips.nth(0)).toHaveAttribute('data-tier', '2'); // the best copy first
  await expect(chips.nth(1)).toHaveAttribute('data-tier', '1');
  expect(await page.evaluate(() => window.__dbTiers().filter((x) => x.id === 'goblin-grunt').map((x) => x.tier))).toEqual([2, 1, 1]);
  // tap the Enhanced slot: it becomes a plain copy (a plain one is spare); tap again: back to Enhanced
  await chips.nth(0).click();
  await expect(li.locator('.db-tier').nth(0)).toHaveAttribute('data-tier', '1');
  expect(await page.evaluate(() => window.__dbTiers().filter((x) => x.id === 'goblin-grunt').map((x) => x.tier))).toEqual([1, 1, 1]);
  await li.locator('.db-tier').nth(0).click();
  await expect(li.locator('.db-tier').nth(0)).toHaveAttribute('data-tier', '2');
  // a plain card has no chips
  const sc = page.locator('.db-tile[data-card="goblin-scrounger"]');
  await sc.getByTestId('db-plus').click();
  expect(await page.locator('.db-list li', { hasText: 'Goblin Miner' }).locator('.db-tier').count()).toBe(0);
});

test('AC690: the shop sells bundles (Ken, Nov 5): 1, 6, 24 (+3 free, the big one) and the 99 chest (+16 free, Best Value), a price per pack on each, the guarantees and the bad-luck shield in words; buying the 24 puts 27 sealed packs in My Packs', async ({ page }) => {
  await openEcon(page, 'shop');
  const tiles = page.locator('.shop-bundle');
  await expect(tiles).toHaveCount(4);
  expect(await tiles.evaluateAll((els) => els.map((e) => e.dataset.size))).toEqual(['1', '6', '24', '99']);
  expect(await tiles.evaluateAll((els) => els.map((e) => e.dataset.packs))).toEqual(['1', '6', '27', '115']);
  await expect(tiles.nth(2)).toHaveClass(/shop-big/);
  await expect(tiles.nth(2).locator('[data-testid="bundle-bonus"]')).toHaveText('+3 FREE');
  await expect(tiles.nth(3).locator('[data-testid="bundle-bonus"]')).toHaveText('+16 FREE');
  await expect(tiles.nth(3).locator('[data-testid="best-value"]')).toHaveText('BEST VALUE');
  await expect(tiles.nth(3)).toHaveClass(/shop-bundle-chest/);
  expect(await tiles.locator('[data-testid="per-pack"]').evaluateAll((els) => els.map((e) => e.textContent))).toEqual(['100 per pack', '100 per pack', '~89 per pack', '~86 per pack']);
  await expect(tiles.nth(2).locator('[data-testid="bundle-promise"]')).toContainText('one upgraded card at Overcharged or better, at least 2 Legendaries'); // Nov 7 (Ken)
  await expect(tiles.nth(3).locator('[data-testid="bundle-promise"]')).toContainText('one upgraded card at Radiant or better, at least 10 Legendaries, one of them new to you, the chest card back'); // Nov 7 (Ken)
  await expect(page.getByTestId('shop-shield')).toContainText('20 packs in a row without a Legendary, and the 20th brings one'); // Nov 7 (Ken: every 20 packs)
  await expect(page.locator('.shop-odds')).toContainText('Rare 78%');
  // 500 coins: only the single pack is affordable; the stand-in player gets coins for the 24
  await expect(tiles.nth(2).locator('.shop-buy')).toBeDisabled();
  await expect(page.locator('.shop-stash-row[data-free="true"]')).toHaveAttribute('data-n', '1'); // the stand-in's free quest pack waits in My Packs
  expect(await page.locator('.shop-stash-row[data-pack="standard"]:not([data-free])').count()).toBe(0);
  await page.evaluate(() => window.oreheart.packs.giveCoins(5000));
  await page.evaluate(() => window.oreheart.packs.screen('shop'));
  await expect(page.locator('[data-screen="econ-shop"]')).toBeVisible();
  const buy24 = page.locator('.shop-bundle[data-size="24"] .shop-buy');
  await expect(buy24).toHaveText('Buy 27 packs for 2,400');
  await buy24.click();
  const row = page.locator('.shop-stash-row[data-pack="standard"]:not([data-free])');
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row).toHaveAttribute('data-n', '27');
  await expect(row).toContainText('27 sealed');
  expect((await page.evaluate(() => window.oreheart.packs.coins())).coins).toBe(5500 - 2400);
});

test('AC691: My Packs opens one at a time with the rip (then "Open another (N left)" takes the next sealed one), or several with the slider: one big rip, every card in a grid rarest first with the Rare-or-better and upgraded ones lit, and a summary', async ({ page }) => {
  await openEcon(page, 'shop');
  await page.evaluate(() => window.oreheart.packs.giveCoins(5000));
  await page.evaluate(() => window.oreheart.packs.screen('shop'));
  await expect(page.locator('.shop-bundle[data-size="6"] .shop-buy')).toBeEnabled();
  await page.locator('.shop-bundle[data-size="6"] .shop-buy').click();
  const row = page.locator('.shop-stash-row[data-pack="standard"]:not([data-free])');
  await expect(row).toHaveAttribute('data-n', '6', { timeout: 10000 });
  // one at a time: the normal rip scene
  await row.locator('.shop-open-one').click();
  await expect(page.getByTestId('pack-scene')).toBeVisible();
  await page.evaluate(() => window.oreheart.packs.skip());
  await page.evaluate(() => window.oreheart.packs.flipAll());
  await expect.poll(async () => (await packState(page)).phase, { timeout: 8000 }).toBe('done');
  const again = page.locator('.pko-again');
  await expect(again).toHaveText('Open another (6 left)'); // 5 sealed from the bundle plus the free quest pack
  await again.click();
  await expect.poll(async () => (await packState(page)).phase, { timeout: 8000 }).toBe('idle');
  await page.locator('.pko-leave').click();
  await expect(page.locator('[data-screen="econ-shop"]')).toBeVisible();
  await expect(row).toHaveAttribute('data-n', '4');
  // several at once: the slider, then the stack rip and the grid
  const slider = row.locator('.shop-slider');
  await expect(slider).toHaveAttribute('max', '4');
  await slider.fill('3');
  await expect(row.locator('.shop-open-n')).toHaveText('Open 3');
  await row.locator('.shop-open-n').click();
  const multi = page.getByTestId('multi-scene');
  await expect(multi).toBeVisible();
  await expect(multi).toHaveAttribute('data-count', '3');
  await page.evaluate(() => window.__ohMulti.skip());
  await expect.poll(() => page.evaluate(() => window.__ohMulti.state().phase)).toBe('done');
  const cards = multi.locator('.pkm-card');
  await expect(cards).toHaveCount(33);
  const ranks = await cards.evaluateAll((els) => els.map((e) => ({ r: e.dataset.rarity, t: Number(e.dataset.tier) })));
  const order = { collector: 4, 'ultra-rare': 3, rare: 2, uncommon: 1, common: 0 };
  for (let i = 1; i < ranks.length; i++) expect(order[ranks[i].r] * 10 + ranks[i].t).toBeLessThanOrEqual(order[ranks[i - 1].r] * 10 + ranks[i - 1].t);
  expect(await multi.locator('.pkm-card.pko-r-rare.pkm-hi').count()).toBeGreaterThan(0);
  await expect(page.getByTestId('multi-summary')).toContainText('3 packs, 33 cards');
  await page.locator('.pko-done').click();
  await expect(page.locator('[data-screen="econ-shop"]')).toBeVisible();
  await expect(row).toHaveAttribute('data-n', '1');
});

test('AC692: the 24-bundle keeps its promise: after its last pack the grid holds an Overcharged-or-better card (lit, tagged UPGRADED or GUARANTEED) and the summary says so', async ({ page }) => {
  await openEcon(page, 'shop');
  await page.evaluate(() => window.oreheart.packs.giveCoins(5000));
  await page.evaluate(() => window.oreheart.packs.screen('shop'));
  await expect(page.locator('.shop-bundle[data-size="24"] .shop-buy')).toBeEnabled();
  await page.locator('.shop-bundle[data-size="24"] .shop-buy').click();
  const row = page.locator('.shop-stash-row[data-pack="standard"]:not([data-free])');
  await expect(row).toHaveAttribute('data-n', '27', { timeout: 10000 });
  await row.locator('.shop-slider').fill('27');
  await row.locator('.shop-open-n').click();
  const multi = page.getByTestId('multi-scene');
  await expect(multi).toHaveAttribute('data-count', '27');
  await page.evaluate(() => window.__ohMulti.skip());
  await expect.poll(() => page.evaluate(() => window.__ohMulti.state().phase)).toBe('done');
  const best = await multi.locator('.pkm-card[data-tier]').evaluateAll((els) => Math.max(...els.map((e) => Number(e.dataset.tier) || 1)));
  expect(best).toBeGreaterThanOrEqual(3);
  const top = multi.locator('.pkm-card').first();
  await expect(top).toHaveClass(/pkm-hi/);
  expect(await page.evaluate(() => window.oreheart.packs.coins().coins)).toBe(5500 - 2400);
});

test('AC693: the Main Dashboard (design D, Ken Nov 5) is the signed-in main menu: top bar with name, rank charm, coins and free packs; Your rank with the 10-step ladder; the daily quests; Play with the four modes and Find a match; the six tiles with real counts; What\'s new tabs from the news table; events with Join / Remind me disabled', async ({ page }) => {
  await openEcon(page, 'shop');
  await page.getByRole('button', { name: 'Back' }).click();
  expect(await page.evaluate(() => window.oreheart.packs.setOwned({ 'goblin-grunt': 4, 'shiv-rat': 2 }, [{ name: 'Junk Pile', cards: Array(4).fill('goblin-grunt'), commander: 'grubnak' }]))).toBe(true);
  await page.evaluate(() => window.__app.showMenu());
  const dash = page.locator('main.dash[data-dash="1"]');
  await expect(dash).toBeVisible({ timeout: 10000 });
  await expect(dash.getByTestId('dash-who')).toContainText('Sapphire III');
  await expect(dash.getByTestId('dash-coins')).toContainText('500');
  await expect(dash.getByTestId('dash-free')).toContainText('1 free pack');
  await expect(dash.getByTestId('dash-server')).toContainText('online');
  const rank = dash.getByTestId('dash-rank');
  await expect(rank).toContainText('Sapphire III');
  await expect(rank).toContainText('Rating 1,250');
  await expect(rank).toContainText('#84 on the server');
  await expect(rank).toContainText('18 wins · 9 losses');
  await expect(rank).toContainText('Progress to Sapphire II');
  expect(await rank.locator('.ladder img').count()).toBe(10);
  await expect(rank.locator('.ladder img.on')).toHaveAttribute('src', '/art/ui/rank-charms/sapphire.webp');
  await expect(rank).toContainText('ends in');
  await expect(dash.getByTestId('dash-quests').locator('.q')).toHaveCount(3);
  await expect(dash.getByTestId('dash-quests')).toContainText('Free pack in 4 days');
  // Play: Ranked is on by default; the sub line follows the mode
  const play = dash.getByTestId('dash-play');
  await expect(play.locator('.chip.on')).toHaveText('Ranked');
  await play.locator('.chip[data-mode="unranked"]').click();
  await expect(play.locator('.chip.on')).toHaveText('Unranked');
  await expect(play.locator('.play-sub')).toContainText('Unranked');
  await expect(dash.getByTestId('dash-find')).toContainText('Find a match');
  // the tiles carry real counts
  await expect(dash.getByTestId('dash-decks')).toContainText('1 deck');
  await expect(dash.getByTestId('dash-collection')).toContainText('2 /');
  await expect(dash.getByTestId('dash-shop')).toContainText('1 free pack waiting');
  await expect(dash.getByTestId('dash-questtile')).toContainText('1 of 3 today');
  // What's new: the seeded patch first, the tabs switch, events with disabled buttons
  const news = dash.getByTestId('dash-news');
  await expect(news).toContainText('Patch 0.9.5');
  await expect(news.locator('.sec.new')).toHaveText('New');
  await news.getByRole('tab', { name: 'News' }).click();
  await expect(news).toContainText('Welcome to the test server');
  const events = dash.getByTestId('dash-events');
  await expect(events.locator('.ev')).toHaveCount(2);
  await expect(events.getByRole('button', { name: /Join/ })).toBeDisabled();
  await expect(events.getByRole('button', { name: /Remind me/ })).toBeDisabled();
  // a tile opens its screen and Back comes home to the dashboard
  await dash.getByTestId('dash-shop').click();
  await expect(page.locator('[data-screen="econ-shop"]')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('main.dash[data-dash="1"]')).toBeVisible({ timeout: 10000 });
  await page.locator('main.dash').getByTestId('dash-settings').click();
  await expect(page.locator('[data-screen="settings"]')).toBeVisible();
});

test('AC694: Rankings from the dashboard: the top ten with rank charms and ratings, the caller\'s row pinned, the 10-step ladder with shares, the season countdown, season rewards "coming soon"; Back returns to the dashboard; and at phone landscape the dashboard shows Play, six small tiles and one tabbed side panel', async ({ page }) => {
  await openEcon(page, 'shop');
  await page.getByRole('button', { name: 'Back' }).click();
  expect(await page.evaluate(() => window.oreheart.packs.setOwned({ 'goblin-grunt': 4 }))).toBe(true);
  await page.evaluate(() => window.__app.showMenu());
  const dash = page.locator('main.dash[data-dash="1"]');
  await expect(dash).toBeVisible({ timeout: 10000 });
  await dash.getByTestId('dash-rankings').click();
  const rk = page.locator('main.dash.rankings');
  await expect(rk).toBeVisible({ timeout: 10000 });
  const rows = rk.getByTestId('rank-row');
  await expect(rows).toHaveCount(11); // ten on top and the caller's own row (#84)
  await expect(rows.first()).toContainText('Snagtooth');
  await expect(rows.first()).toContainText('Oreheart');
  await expect(rows.last()).toHaveClass(/me/);
  await expect(rows.last()).toContainText('84');
  expect(await rk.getByTestId('rank-ladder').locator('.ladder-big > div').count()).toBe(10);
  await expect(rk.getByTestId('rank-ladder').locator('.ladder-big > div.on')).toContainText('Sapphire');
  await expect(rk.getByTestId('rank-ladder')).toContainText('Season ends in');
  await expect(rk).toContainText('Coming soon: rewards');
  await rk.getByRole('button', { name: '‹ Dashboard' }).click();
  await expect(page.locator('main.dash[data-dash="1"]')).toBeVisible({ timeout: 10000 });
  // phone landscape
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('main.dash .small')).toBeVisible();
  await expect(page.locator('main.dash .pside')).toBeVisible();
  await expect(page.locator('main.dash .col.left')).toBeHidden();
  await expect(page.locator('main.dash .pside .rkmini')).toContainText('Sapphire III');
  await expect(page.locator('main.dash .pside .tabs button[aria-selected="true"]')).toHaveText('Quests');
  await expect(page.locator('main.dash .pside .q')).toHaveCount(3);
  await page.locator('main.dash .pside').getByRole('tab', { name: 'Patch notes' }).click();
  await expect(page.locator('main.dash .pside')).toContainText('Patch 0.9.5');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

// ---- Gauge's list (Nov 2)
test('AC667: while an economy screen is up the keyboard can never reach the menu behind it (the menu is inert), and it comes back on Back', async ({ page }) => {
  await openEcon(page, 'shop');
  const reached = [];
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press('Tab');
    reached.push(await page.evaluate(() => { const a = document.activeElement; return a && a.closest('[data-screen=title]') ? a.textContent.trim().slice(0, 30) : null; }));
  }
  expect(reached.filter(Boolean)).toEqual([]);
  await expect(page.locator('[data-screen=title]')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('[data-screen=econ-shop]')).toHaveCount(0);
  await expect(page.locator('[data-screen=title]')).not.toHaveAttribute('inert', '');
});

test('AC668: the Collection keeps Back on screen however far it scrolls; a double tap on a pack card flips it and does not zoom; the pack scene has a way out before the rip', async ({ page }) => {
  await openEcon(page, 'collection');
  await page.locator('.col-card').first().waitFor();
  await page.evaluate(() => { const s = document.querySelector('.econ-screen'); s.scrollTop = s.scrollHeight; });
  const b = await page.getByRole('button', { name: 'Back' }).boundingBox();
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeLessThan(120);
  await openEcon(page, 'pack');
  await expect(page.locator('.pko-leave')).toBeVisible();
  await page.evaluate(() => window.oreheart.packs.skip());
  await expect(page.locator('.pko-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('pko-card')), 'no focus ring forced on a card after a mouse rip').toBe(false);
  await page.locator('.pko-card').first().dblclick();
  await expect(page.locator('.pko-card').first()).toHaveAttribute('data-flipped', 'true');
  await page.waitForTimeout(300);
  await expect(page.locator('.col-zoom')).toHaveCount(0);
});

test('AC669: FREE, NEW and the shop text are readable (white on a dark or painted chip), and the odds never split a number from its percent sign', async ({ page }) => {
  await openEcon(page, 'shop');
  const fill = await page.locator('.shop-free').first().evaluate((e) => getComputedStyle(e).webkitTextFillColor);
  expect(fill).toBe('rgb(255, 255, 255)');
  await expect(page.locator('.shop-odds').first()).toContainText('78%');
  const pale = await page.locator('.shop-free').first().evaluate((e) => getComputedStyle(e).backgroundImage);
  expect(pale).toContain('/art/shop-badges/badge-burst-green.webp'); // Nov 7 (Ken): Brush's painted badge, the word written on it (no pale chip)
});

test('AC697: Buy Oreshards (Ken, Nov 6, Stripe): the four bundles at the plan\'s prices with their bonuses, the no-refund line, a tap asks the server for Stripe\'s page (never the game), the one-way convert, the Shop\'s shard counter with its +, and an under-13 account without a parent sees a message instead', async ({ page }) => {
  test.setTimeout(60000);
  await openEcon(page, 'oreshards');
  const cards = page.locator('[data-testid="shard-bundles"] .shard-bundle');
  await expect(cards).toHaveCount(6); // Nov 7 (Ken): "$1 to $100"
  const seen = await cards.evaluateAll((els) => els.map((e) => ({ id: e.dataset.bundle, price: e.querySelector('.shard-buy').textContent.trim(), amount: e.querySelector('.shard-amount b').textContent.trim(), bonus: (e.querySelector('[data-testid="shard-bonus"]') || {}).textContent || '' })));
  expect(seen).toEqual([
    { id: 'pouch', price: '$0.99', amount: '100', bonus: '' },
    { id: 'sack', price: '$4.99', amount: '550', bonus: '+10% bonus' },
    { id: 'chest', price: '$9.99', amount: '1,200', bonus: '+20% bonus' },
    { id: 'hoard', price: '$19.99', amount: '2,600', bonus: '+30% bonus' },
    { id: 'vault', price: '$49.99', amount: '7,000', bonus: '+40% bonus' },
    { id: 'mountain', price: '$99.99', amount: '15,000', bonus: '+50% bonus' },
  ]);
  await expect(page.locator('.shard-bundle[data-bundle="mountain"] [data-testid="shard-best"]')).toHaveText('BEST VALUE');
  await expect(page.locator('[data-testid="shard-fine"]')).toContainText('not refundable');
  await expect(page.locator('[data-testid="shard-count"] b')).toHaveText('0');
  // a tap asks the server (stand-in) for the Stripe page for THAT bundle, from this page's own origin; the game never builds a payment itself
  await page.locator('[data-testid="shard-buy-chest"]').click();
  await expect.poll(() => page.evaluate(() => window.oreheart.oreshards.state().lastCheckout), { timeout: 8000 }).toEqual({ bundle: 'chest', origin: new URL(page.url()).origin });
  await expect(page.locator('[data-testid="oreshards-alert"]')).toContainText('Stripe');
  // the convert is one way and shows up in the balance and the coins
  expect(await page.evaluate(() => window.oreheart.oreshards.give(500))).toBe(true);
  await page.evaluate(() => window.oreheart.oreshards.open());
  await expect(page.locator('[data-testid="shard-count"] b')).toHaveText('500');
  await expect(page.locator('[data-testid="shard-purchase"]')).toHaveCount(1);
  const coinsBefore = Number((await page.locator('[data-testid="coin-chip"] .econ-coins-n').first().textContent()).replace(/,/g, ''));
  await page.locator('[data-testid="shard-convert-n"]').fill('120');
  await page.locator('[data-testid="shard-convert-btn"]').click();
  await expect(page.locator('[data-testid="shard-count"] b')).toHaveText('380');
  await expect.poll(() => page.locator('[data-testid="coin-chip"] .econ-coins-n').first().textContent().then((s) => Number(s.replace(/,/g, '')))).toBe(coinsBefore + 120);
  expect(await page.locator('body').textContent()).not.toMatch(/coins? (into|to) oreshards/i);
  // the Pack Shop shows the shard counter with its + which opens this screen
  await openEcon(page, 'shop');
  await expect(page.locator('[data-testid="shard-chip"] .econ-coins-n')).toHaveText('0'); // a fresh page: the stand-in balance starts again
  await page.locator('[data-testid="buy-oreshards"]').click();
  await expect(page.locator('[data-screen="econ-oreshards"]')).toBeVisible();
  // an under-13 account without an approved parent: no bundles, a plain message
  await page.goto('/?test=1&econ=oreshards&kid=1');
  await expect(page.locator('[data-screen="econ-oreshards"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="shard-blocked"]')).toContainText('parent must approve');
  await expect(page.locator('[data-testid="shard-bundles"] .shard-bundle')).toHaveCount(0);
});

// ---------- Nov 7 fix batch ----------
async function signedInDash(page) {
  await openEcon(page, 'shop');
  await page.getByRole('button', { name: 'Back' }).click();
  expect(await page.evaluate(() => window.oreheart.packs.setOwned({ 'goblin-grunt': 4 }, [{ name: 'Junk Pile', cards: Array(4).fill('goblin-grunt'), commander: 'grubnak' }]))).toBe(true);
  await page.evaluate(() => window.__app.showMenu());
  await expect(page.locator('main.dash[data-dash="1"]')).toBeVisible({ timeout: 10000 });
}
/** opens the Exit box from the top bar on screen and proves its buttons take the clicks (nothing behind can be clicked) */
async function exitBoxWorks(page, where) {
  const exit = page.locator('[data-testid=dash-exit]:visible').last();
  await expect(exit, where + ': Exit in the top bar').toBeVisible({ timeout: 10000 });
  await exit.click();
  const box = page.locator('[data-testid=exit-dialog]');
  await expect(box, where).toBeVisible();
  const hit = await page.evaluate(() => {
    const b = document.querySelector('[data-testid=exit-stay]'); const r = b.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const ov = document.querySelector('[data-testid=exit-dialog]');
    const corner = document.elementFromPoint(4, innerHeight - 4); // a spot outside the box: the backdrop, never the screen behind
    return { onButton: !!at && (at === b || b.contains(at)), inert: !!b.closest('[inert]'), backdrop: !!corner && ov.contains(corner) };
  });
  expect(hit, where + ': ' + JSON.stringify(hit)).toEqual({ onButton: true, inert: false, backdrop: true });
  await page.locator('[data-testid=exit-stay]').click();
  await expect(box, where + ': Stay closes it').toHaveCount(0);
}

test('AC700: the Exit box (Ken, Nov 7: from the cards screen the clicks went through to the cards) takes every click from every screen with the top bar: Dashboard, Collection, Shop, Quests, Deck Builder, Rankings', async ({ page }) => {
  test.setTimeout(120000);
  await signedInDash(page);
  await exitBoxWorks(page, 'Dashboard');
  for (const [kind, label] of [['collection', 'Collection'], ['shop', 'Shop'], ['quests', 'Quests']]) {
    await page.evaluate((k) => window.__app.showMenu(), kind);
    await page.locator(`[data-testid=dash-${kind === 'quests' ? 'questtile' : kind}]`).click();
    await expect(page.locator(`[data-screen="econ-${kind}"]`)).toBeVisible({ timeout: 10000 });
    await exitBoxWorks(page, label);
  }
  await page.evaluate(() => window.__app.showMenu());
  await page.locator('[data-testid=dash-decks]').click();
  await page.waitForTimeout(800);
  await exitBoxWorks(page, 'Deck Builder');
  await page.evaluate(() => window.__app.showMenu());
  await page.locator('[data-testid=dash-rankings]').click();
  await page.waitForTimeout(800);
  await exitBoxWorks(page, 'Rankings');
});

test('AC701: the Dashboard has a Tutorial button (Ken, Nov 7) next to Find a match; it starts the guided match (the Nov 1 tutorial)', async ({ page }) => {
  await signedInDash(page);
  const tut = page.locator('[data-testid=dash-tutorial]');
  await expect(tut).toBeVisible();
  await expect(tut).toHaveText('Tutorial');
  const [a, b] = await Promise.all([tut.boundingBox(), page.locator('[data-testid=dash-find]').boundingBox()]);
  expect(Math.abs(a.y - b.y), 'same row as Find a match').toBeLessThan(4);
  await tut.click();
  await expect(page.locator('main.match')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.evaluate(() => !!(window.oreheart.getState() && window.oreheart.getState().tutorial)), { timeout: 10000 }).toBe(true);
});

// ---------- Nov 7: feedback, the beta welcome, card backs ----------
async function signedInDashWith(page, extra) {
  await openEcon(page, 'shop', extra);
  await page.getByRole('button', { name: 'Back' }).click();
  expect(await page.evaluate(() => window.oreheart.packs.setOwned({ 'goblin-grunt': 4 }, [{ name: 'Junk Pile', cards: Array(4).fill('goblin-grunt'), commander: 'grubnak' }]))).toBe(true);
  await page.evaluate(() => window.__app.showMenu());
  await expect(page.locator('main.dash[data-dash="1"]')).toBeVisible({ timeout: 10000 });
}

test('AC702: the bug button (Ken, Nov 7): from the Dashboard top bar a box opens with Bug / Idea / Other, a 1000-character text box with a counter and a picture option; Send saves it with what the game knows and says thanks; Settings has it too', async ({ page }) => {
  test.setTimeout(90000);
  await signedInDashWith(page, '');
  await page.locator('[data-testid=dash-feedback]').click();
  const box = page.locator('[data-testid=fb-dialog]');
  await expect(box).toBeVisible();
  await expect(box.locator('[data-testid=fb-kind-bug]')).toHaveAttribute('aria-checked', 'true');
  await box.locator('[data-testid=fb-kind-idea]').click();
  await expect(box.locator('[data-testid=fb-kind-idea]')).toHaveAttribute('aria-checked', 'true');
  expect(await box.locator('[data-testid=fb-text]').getAttribute('maxlength')).toBe('1000');
  await box.locator('[data-testid=fb-send]').click();
  await expect(box.locator('[data-testid=fb-error]')).toContainText('a little more');
  await box.locator('[data-testid=fb-text]').fill('More goblins with tiny hats, please');
  await expect(box.locator('[data-testid=fb-count]')).toHaveText('35 / 1000');
  await box.locator('[data-testid=fb-send]').click();
  await expect(box).toHaveCount(0);
  await expect(page.locator('.econ-toast')).toContainText('Thanks!');
  const sent = await page.evaluate(() => window.oreheart.feedback.sent());
  expect(sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ kind: 'idea', message: 'More goblins with tiny hats, please' });
  expect(sent[0].meta.screen).toBeTruthy();
  expect(sent[0].meta.device).toMatch(/·/);
  expect(sent[0].meta.build).toBeTruthy();
  // a stray click outside never throws away a typed report
  await page.locator('[data-testid=dash-feedback]').click();
  await box.locator('[data-testid=fb-text]').fill('half typed');
  await page.mouse.click(5, 5);
  await expect(box).toBeVisible();
  await box.locator('[data-testid=fb-cancel]').click();
  // Settings has the same button
  await page.evaluate(() => window.__app.showSettings());
  await expect(page.locator('[data-testid=set-feedback]')).toBeVisible({ timeout: 10000 });
});

test('AC703: the beta welcome (Ken, Nov 7) shows once after sign-in with the Founder card back; "Wear it now" puts it on; the Collection\'s Card backs lists Oreheart and Founder and switches between them', async ({ page }) => {
  test.setTimeout(90000);
  await signedInDashWith(page, '&beta=1');
  const w = page.locator('[data-testid=beta-welcome]');
  await expect(w).toBeVisible({ timeout: 10000 });
  await expect(w).toContainText('Welcome, brave tester!');
  await expect(w).toContainText('bug button');
  await expect(w.locator('img.beta-back')).toHaveAttribute('src', /sleeves\/founder\.webp$/);
  await page.mouse.click(5, 5); // a choice, not a stray click
  await expect(w).toBeVisible();
  await w.locator('[data-testid=beta-wear]').click();
  await expect(w).toHaveCount(0);
  expect(await page.evaluate(() => window.oreheart.cosmetics.equipped())).toBe('founder');
  // only once: the Dashboard again shows no welcome
  await page.evaluate(() => window.__app.showMenu());
  await expect(page.locator('main.dash[data-dash="1"]')).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.locator('[data-testid=beta-welcome]')).toHaveCount(0);
  // Collection -> Card backs: both owned, Founder on; switch to Oreheart and back
  await page.locator('[data-testid=dash-collection]').click();
  await expect(page.locator('[data-screen="econ-collection"]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-testid=col-card-backs]').click();
  const pick = page.locator('[data-testid=cb-dialog]');
  await expect(pick).toBeVisible();
  await expect(pick.locator('[data-testid=cb-founder]')).toHaveAttribute('aria-checked', 'true');
  await expect(pick.locator('[data-testid=cb-default]')).toBeVisible();
  // the picker is above the Collection and takes the click (the Nov 7 pop-up fix)
  const hit = await page.evaluate(() => { const b = document.querySelector('[data-testid=cb-default]'); const r = b.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!at && (at === b || b.contains(at)); });
  expect(hit).toBe(true);
  await pick.locator('[data-testid=cb-default]').click();
  await expect(pick.locator('[data-testid=cb-default]')).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => window.oreheart.cosmetics.equipped())).toBe('default');
  await pick.locator('[data-testid=cb-close]').click();
});

test('AC705: Card Sleeves in the Shop (Ken, Nov 7): six sleeves with Oreshard prices; Preview shows the back at card size; Buy asks first, then takes the Oreshards and the sleeve is owned; Wear puts it on, and Collection → Card backs lists it', async ({ page }) => {
  test.setTimeout(90000);
  await openEcon(page, 'shop');
  const box = page.locator('[data-testid=shop-sleeves]');
  await expect(box.locator('.sl-item')).toHaveCount(6, { timeout: 10000 });
  await expect(box.locator('[data-testid=sl-balance]')).toHaveText('1000 Oreshards');
  expect(await box.locator('.sl-item .sl-art img').evaluateAll((els) => els.map((e) => e.getAttribute('src')))).toEqual(
    ['goblin-junkpile', 'gnome-arcane', 'dwarf-deepforge', 'crystal-mine', 'piglet-stampede', 'skullfang-arena'].map((id) => `/art/sleeves/${id}.webp`));
  // every picture really loads (Brush's art is in the build)
  expect(await box.locator('.sl-item .sl-art img').evaluateAll(async (els) => { await Promise.all(els.map((e) => (e.complete ? null : new Promise((r) => { e.onload = e.onerror = r; })))); return els.every((e) => e.naturalWidth > 0); })).toBe(true);
  // preview
  await box.locator('[data-testid=sl-preview-piglet-stampede]').click();
  const pv = page.locator('[data-testid=sl-preview]');
  await expect(pv).toBeVisible();
  await expect(pv.locator('img.sl-big').first()).toHaveAttribute('src', '/art/sleeves/piglet-stampede.webp');
  await pv.locator('[data-testid=sl-preview-close]').click();
  await expect(pv).toHaveCount(0);
  // buy: asks first; Cancel changes nothing; Buy takes the price
  await box.locator('[data-testid=sl-buy-piglet-stampede]').click();
  await expect(box.locator('.sl-ask')).toContainText('350 of your 1000 Oreshards?');
  await box.locator('[data-testid=sl-confirm-piglet-stampede]').click();
  await expect(box.locator('[data-testid=sl-owned-piglet-stampede]')).toHaveText('Owned', { timeout: 10000 });
  await expect(box.locator('[data-testid=sl-balance]')).toHaveText('650 Oreshards');
  await expect(box.locator('[data-testid=sl-buy-piglet-stampede]')).toHaveCount(0);
  // too expensive: 500 > 650? no; buy two more to run out, then the third says not enough
  await box.locator('[data-testid=sl-buy-skullfang-arena]').click();
  await box.locator('[data-testid=sl-confirm-skullfang-arena]').click();
  await expect(box.locator('[data-testid=sl-balance]')).toHaveText('150 Oreshards');
  await box.locator('[data-testid=sl-buy-gnome-arcane]').click();
  await box.locator('[data-testid=sl-confirm-gnome-arcane]').click();
  await expect(box.locator('[data-testid=sl-note]')).toContainText('Not enough Oreshards');
  // wear it
  await box.locator('[data-testid=sl-wear-piglet-stampede]').click();
  await expect(box.locator('[data-testid=sl-owned-piglet-stampede]')).toHaveText('Wearing');
  expect(await page.evaluate(() => window.oreheart.cosmetics.equipped())).toBe('piglet-stampede');
  const mine = await page.evaluate(() => window.oreheart.cosmetics.mine());
  expect(mine.card_backs.map((b) => b.item)).toEqual(expect.arrayContaining(['default', 'piglet-stampede', 'skullfang-arena']));
});

// ---------- Nov 7 (Ken): the Deck Builder: one click picks, a double-click opens the big view; the best copy first; greyed when none can go in; the name field ----------
test('AC707: Deck Builder (Ken, Nov 7): a click only picks a card; + adds the BEST copy still free and the tile steps down Overcharged -> Enhanced -> Original with the count; none left (or none owned) greys it and turns + off; a double-click opens the big view in full colour with your copies per tier, Put in deck and View 3D; the deck name is a field at the top', async ({ page }) => {
  test.setTimeout(90000);
  await openEcon(page, 'shop');
  await page.getByRole('button', { name: 'Back' }).click();
  expect(await page.evaluate(() => window.oreheart.packs.setOwned({ 'goblin-grunt': [3, 2, 1], 'goblin-scrounger': 2 }))).toBe(true);
  for (const w of await page.locator('.overlay.welcome').all()) await w.evaluate((e) => e.remove());
  await page.getByRole('button', { name: 'Deck Builder', exact: true }).click();
  const tile = page.locator('.db-tile[data-card="goblin-grunt"]');
  await expect(tile).toBeVisible();
  const faceTier = () => tile.locator('.db-tface').getAttribute('data-tier');
  // the best copy shows first, with the copies left and the tiers
  await expect.poll(faceTier).toBe('3');
  await expect(tile.getByTestId('db-left')).toHaveText('×3');
  await expect(tile.locator('.db-tiersum')).toHaveText('Overcharged ×1 · Enhanced ×1 · Original ×1');
  // one click: picked (the detail column), nothing pops up
  await tile.click();
  await page.waitForTimeout(500);
  await expect(page.locator('.cardzoom')).toHaveCount(0);
  await expect(page.locator('.db-detail .db-dname')).toHaveText('Snotskull Grunt');
  // + adds the best copy; the tile steps down to the next best
  const plus = tile.getByTestId('db-plus');
  await plus.click();
  await expect.poll(faceTier).toBe('2');
  await expect(tile.getByTestId('db-left')).toHaveText('×2');
  await plus.click();
  await expect.poll(faceTier).toBe('1');
  await plus.click();
  expect(await page.evaluate(() => window.__dbTiers().filter((x) => x.id === 'goblin-grunt').map((x) => x.tier))).toEqual([3, 2, 1]);
  await expect(tile).toHaveClass(/\bout\b/);
  await expect(plus).toBeDisabled();
  await expect(tile.getByTestId('db-left')).toHaveText('×0');
  await expect(tile).toHaveAttribute('title', 'All copies in deck');
  // a card you don't own: greyed, + off, and it can't go in
  const none = page.locator('.db-tile[data-card="goblin-slinger"]');
  await expect(none).toHaveClass(/\bout\b/);
  await expect(none.getByTestId('db-plus')).toBeDisabled();
  await expect(none).toHaveAttribute('title', "You don't own this card yet");
  expect(await page.evaluate(() => window.__dbTiers().some((x) => x.id === 'goblin-slinger'))).toBe(false);
  // − takes the plainest copy out: Original comes back to the pool
  await tile.getByTestId('db-minus').click();
  await expect.poll(faceTier).toBe('1');
  await expect(tile.getByTestId('db-left')).toHaveText('×1');
  await expect(plus).toBeEnabled();
  // a double-click: the big view, in full colour, the ladder with your copies per tier, Put in deck, View 3D
  await tile.dblclick();
  const zoom = page.locator('.cardzoom');
  await expect(zoom).toBeVisible();
  const big = zoom.locator('.cz-oh > .ohcard');
  await expect(big).toBeVisible();
  expect(await big.evaluate((e) => [getComputedStyle(e).filter, getComputedStyle(e).opacity])).toEqual(['none', '1']);
  await expect(zoom.getByTestId('upg-have-3')).toHaveText('You have 1');
  await expect(zoom.getByTestId('upg-have-4')).toHaveText('None yet');
  await expect(zoom.getByTestId('upg-indeck-3')).toHaveText('1 in deck');
  await expect(zoom.getByTestId('upg-put-3')).toBeDisabled(); // the Overcharged copy is in the deck already
  await expect(zoom.getByTestId('upg-put-1')).toBeEnabled();
  await expect(zoom.getByTestId('view-3d')).toBeVisible();
  await zoom.getByTestId('upg-put-1').click();
  await expect(zoom.getByTestId('upg-indeck-1')).toHaveText('1 in deck');
  await page.keyboard.press('Escape');
  await expect(zoom).toHaveCount(0);
  expect(await page.evaluate(() => window.__dbTiers().filter((x) => x.id === 'goblin-grunt').map((x) => x.tier).sort())).toEqual([1, 2, 3]);
  // a card you don't own still opens large, in full colour
  await none.dblclick();
  await expect(zoom).toBeVisible();
  expect(await zoom.locator('.cz-oh > .ohcard, .cz-img').first().evaluate((e) => [getComputedStyle(e).filter, getComputedStyle(e).opacity])).toEqual(['none', '1']);
  await page.keyboard.press('Escape');
  // the deck name: a field at the top, a fun default after the Commander, 24 letters at most
  const name = page.getByTestId('db-name');
  await expect(name).toHaveValue("Grubnak's Deck 1");
  await name.fill('Junk Lords of the Big Pile Forever More');
  await expect(name).toHaveValue('Junk Lords of the Big Pi');
  await name.press('Enter');
  await expect(page.locator('[data-part="deck-name"]')).toHaveText('Junk Lords of the Big Pi');
});

// ---------- Nov 7 (Ken): "they can purchase the currency ... so they can actually buy packs" ----------
test('AC709: every bundle shows coins OR Oreshards; short of Oreshards the button offers to get more; with enough, a bundle is bought with Oreshards (coins untouched); the Shop has an Oreshards -> Coins button', async ({ page }) => {
  test.setTimeout(60000);
  await openEcon(page, 'shop');
  const six = page.locator('.shop-bundle[data-size="6"]');
  await expect(six.getByTestId('shard-price')).toHaveText('600');
  await expect(six.getByTestId('buy-shards-6')).toContainText('Get more Oreshards');
  await expect(page.getByTestId('shop-convert')).toBeVisible();
  // get 1,000 stand-in Oreshards, back to the shop: the button buys
  expect(await page.evaluate(() => window.oreheart.oreshards.give(1000))).not.toBe(false);
  await page.getByTestId('shop-convert').click();
  await expect(page.locator('[data-testid="shard-convert"]')).toBeVisible();
  await page.evaluate(() => window.oreheart.packs.screen('shop')); // back to the shop without a reload (the stand-in Oreshards live in the page)
  await expect(page.locator('[data-screen="econ-shop"] .shop-bundle[data-size="6"]')).toBeVisible();
  const coins0 = await page.evaluate(() => window.oreheart.oreshards.state().coins);
  const btn = page.locator('.shop-bundle[data-size="6"]').getByTestId('buy-shards-6');
  await expect(btn).toContainText('600 Oreshards');
  await btn.click();
  await expect(page.locator('.econ-toast')).toContainText('6 packs are waiting in My Packs');
  expect(await page.evaluate(() => window.oreheart.oreshards.state().oreshards)).toBe(400);
  expect(await page.evaluate(() => window.oreheart.oreshards.state().coins)).toBe(coins0);
});

test('AC711: the emote dial against the computer (Ken, Nov 7): a click on your avatar opens up to 8 emotes, on screen and apart (PC and phone); a pick pops from your avatar; Friends? is off against the computer', async ({ page }) => {
  test.setTimeout(90000);
  for (const size of [{ width: 1920, height: 1080 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await page.goto('/?test=1');
    await page.waitForFunction(() => !!window.oreheart && !!window.oreheart.newMatch);
    await page.evaluate(() => window.oreheart.newMatch({ ai: false, skipMulligan: true, setup: { firstPlayer: 'player' } }));
    const av = page.locator('[data-testid=emote-avatar]');
    await expect(av).toBeVisible({ timeout: 15000 });
    await av.click();
    const picks = page.locator('[data-testid=emote-dial] .emote-pick');
    await expect(picks).toHaveCount(8);
    const boxes = await picks.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
    for (const [l, t, r, b] of boxes) expect(l >= 0 && t >= 0 && r <= size.width && b <= size.height, `${size.width}: on screen ${l},${t},${r},${b}`).toBe(true);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const [p, q] = [boxes[i], boxes[j]]; expect(Math.hypot((p[0] + p[2]) / 2 - (q[0] + q[2]) / 2, (p[1] + p[3]) / 2 - (q[1] + q[3]) / 2) >= p[2] - p[0] - 0.5, `${size.width}: picks ${i} and ${j} overlap`).toBe(true); } // round buttons: centres a width apart
    await expect(page.locator('[data-testid=emote-dial] [data-emote="free-starter/friends"]')).toBeDisabled();
    await expect(page.locator('[data-testid=emote-mute]')).toHaveCount(0);
    await page.locator('[data-testid=emote-dial] [data-emote="free-starter/good-game"]').click();
    await expect(page.locator('[data-testid=emote-pop][data-from=me][data-emote="free-starter/good-game"]')).toBeVisible();
    const pop = await page.locator('[data-testid=emote-pop] img').first().getAttribute('src');
    expect(pop).toBe('/art/emotes/free-starter/good-game.webp');
  }
});

test('AC713: Frames and Emotes in the Shop (Ken, Nov 7): six frames for coins or Oreshards, never Founder or Producer; the free set plus three packs with singles; buying a frame and a pack works; Collection "Frames & emotes" wears the frame and sets the wheel', async ({ page }) => {
  test.setTimeout(90000);
  await signedInDashWith(page, '');
  await page.locator('[data-testid=dash-coins]').click();
  await expect(page.locator('[data-screen="econ-shop"]')).toBeVisible({ timeout: 10000 });
  const fr = page.locator('[data-testid=shop-frames]');
  await expect(fr.locator('.cos-item')).toHaveCount(6, { timeout: 10000 });
  expect(await fr.locator('.cos-item').evaluateAll((els) => els.map((e) => e.dataset.frame))).not.toContain('producer');
  expect(await fr.locator('.cos-item').evaluateAll((els) => els.map((e) => e.dataset.frame))).not.toContain('founder');
  await expect(fr.locator('.av-frame').first()).toHaveAttribute('src', /\/art\/avatar-frames\/[a-z-]+\.webp$/);
  await fr.locator('[data-testid="frame-buy-skullfang-coins"]').click();
  await expect(fr.locator('[data-testid="frame-wear-skullfang"]')).toBeVisible({ timeout: 10000 });
  await fr.locator('[data-testid="frame-wear-skullfang"]').click();
  await expect(fr.locator('.cos-item[data-frame=skullfang] .cos-owned')).toHaveText('Wearing');
  const em = page.locator('[data-testid=shop-emotes]');
  await expect(em.locator('.cos-pack')).toHaveCount(4, { timeout: 10000 });
  await expect(em.locator('.cos-pack[data-pack=free-starter] .cos-owned')).toHaveText('Free for everyone');
  await expect(em.locator('.cos-emote')).toHaveCount(28);
  await em.locator('[data-testid="emote-pack-goblin-grumbles-shards"]').click();
  await expect(em.locator('.cos-pack[data-pack=goblin-grumbles] .cos-owned')).toHaveText('All yours', { timeout: 10000 });
  // Collection -> Frames & emotes
  await page.evaluate(() => window.__app.showMenu());
  await expect(page.locator('main.dash[data-dash="1"]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-testid=dash-collection]').click();
  await expect(page.locator('[data-screen="econ-collection"]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-testid=col-looks]').click();
  const d = page.locator('[data-testid=looks-dialog]');
  await expect(d).toBeVisible();
  await expect(d.locator('[data-testid=looks-frame-skullfang]')).toHaveAttribute('aria-checked', 'true');
  await d.locator('[data-testid=looks-frame-none]').click();
  await expect(d.locator('[data-testid=looks-frame-none]')).toHaveAttribute('aria-checked', 'true');
  const wheel = d.locator('[data-testid=looks-wheel] .cos-emote');
  expect(await wheel.count()).toBeGreaterThanOrEqual(16); // 10 free + 6 bought
  await d.locator('[data-testid=looks-close]').click();
});

test('AC714: the beta welcome also gives the Founder frame and 32 Founder avatars (Ken, Nov 7): pick one or keep your own; Wear puts on the Founder back and frame, and the picked avatar', async ({ page }) => {
  test.setTimeout(90000);
  await signedInDashWith(page, '&beta=1');
  const w = page.locator('[data-testid=beta-welcome]');
  await expect(w).toBeVisible({ timeout: 10000 });
  await expect(w.locator('img.beta-frame')).toHaveAttribute('src', /frames\/founder\.webp$/);
  const grid = w.locator('[data-testid=beta-avatars]');
  await expect(grid.locator('.cos-item')).toHaveCount(33); // keep mine + 32
  await expect(w.locator('[data-testid=beta-keep-avatar]')).toHaveAttribute('aria-checked', 'true');
  await w.locator('[data-testid=beta-avatar-founder-latino-girl]').click();
  await expect(w.locator('[data-testid=beta-avatar-founder-latino-girl]')).toHaveAttribute('aria-checked', 'true');
  await w.locator('[data-testid=beta-wear]').click();
  await expect(w).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.oreheart.cosmetics.equipped())).toBe('founder');
  await expect(page.locator('[data-testid=dash-who] .av-fw[data-frame=founder]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid=dash-who] img.av')).toHaveAttribute('src', /avatars\/founder-latino-girl\.webp$/);
});

// ---------- Nov 7 (Ken: "There should be no overlapping buttons. That's a fail. Buttons that don't have the text centered in them, that's a fail.")
// Every visible, pressable button on the Shop (packs, bundles, Oreshards, sleeves, frames, emotes, My Packs) and the Dashboard: no two overlap, and every
// label button has its label (with its icon) centred and inside its padding. PC 1920 / 1366, tablet 1024, phone 812x375; the whole screen, scrolled through.
const LAYOUT_AUDIT = () => {
  const vis = (e) => { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return null; let r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return null;
    let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const ps = getComputedStyle(p); if (/(hidden|auto|scroll|clip)/.test(ps.overflow + ps.overflowX + ps.overflowY)) { const q = p.getBoundingClientRect(); box = { l: Math.max(box.l, q.left), t: Math.max(box.t, q.top), r: Math.min(box.r, q.right), b: Math.min(box.b, q.bottom) }; } }
    return box.r - box.l > 2 && box.b - box.t > 2 ? box : null; };
  const name = (e) => (e.getAttribute('data-testid') || e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const btns = [...document.querySelectorAll('button, [role=button], a.btn, .net-btn')].filter((e) => !e.closest('[aria-hidden=true]') && !e.closest('.overlay[hidden]'));
  const uniq = btns.filter((e) => !btns.some((o) => o !== e && o.contains(e)));
  // only buttons a player can see and press: the topmost thing at some point of the button is the button (or inside it)
  const onTop = (e, r) => { const pts = [[.5, .5], [.2, .5], [.8, .5], [.5, .25], [.5, .75]]; return pts.some(([fx, fy]) => { const x = r.l + (r.r - r.l) * fx, y = r.t + (r.b - r.t) * fy; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false; const at = document.elementFromPoint(x, y); return !!at && (at === e || e.contains(at) || at.contains(e)); }); };
  const boxes = uniq.map((e) => ({ e, r: vis(e) })).filter((x) => x.r && onTop(x.e, x.r));
  const overlaps = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].r, c = boxes[j].r, w = Math.min(a.r, c.r) - Math.max(a.l, c.l), h = Math.min(a.b, c.b) - Math.max(a.t, c.t);
    if (w > 1.5 && h > 1.5) overlaps.push(`${name(boxes[i].e)} x ${name(boxes[j].e)} (${Math.round(w)}x${Math.round(h)})`);
  }
  const br0 = (e) => e.getBoundingClientRect();
  const offCentre = [];
  for (const { e, r } of boxes) {
    { const cs0 = getComputedStyle(e); const plain = (cs0.backgroundImage === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(cs0.backgroundColor) && cs0.boxShadow === 'none' && !(parseFloat(cs0.borderTopWidth) > 0 && cs0.borderTopStyle !== 'none') && !(parseFloat(cs0.borderLeftWidth) > 0 && cs0.borderLeftStyle !== 'none')); if (plain && !getComputedStyle(e, '::before').backgroundImage.includes('url') ) continue; }
    if (br0(e).height > 90 || [...e.querySelectorAll('img')].some((im) => im.getBoundingClientRect().height > 44)) continue; // picture tiles (cards, packs), not label buttons
    const tn = [...e.querySelectorAll('*')].concat([e]).flatMap((n) => [...n.childNodes]).filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!tn.length) continue;
    const rg = document.createRange(); let L = 1e9, T = 1e9, R = -1e9, B = -1e9;
    for (const n of tn) { rg.selectNodeContents(n); for (const q of rg.getClientRects()) { if (q.width < 1) continue; L = Math.min(L, q.left); T = Math.min(T, q.top); R = Math.max(R, q.right); B = Math.max(B, q.bottom); } }
    if (L > R) continue;
    const br = e.getBoundingClientRect(), cs = getComputedStyle(e);
    const cl = br.left + parseFloat(cs.borderLeftWidth), cr = br.right - parseFloat(cs.borderRightWidth), ct = br.top + parseFloat(cs.borderTopWidth), cb = br.bottom - parseFloat(cs.borderBottomWidth);
    // icons inside the button count as content too: centre the whole content (text + images) in the button
    for (const im of [...e.querySelectorAll('*')].filter((k) => k.matches('img, svg, .ico, i') || (getComputedStyle(k).backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(k).backgroundColor)))) { const q = im.getBoundingClientRect(); if (q.width > 1 && q.height > 1 && q.left >= br.left - 1 && q.right <= br.right + 1) { L = Math.min(L, q.left); R = Math.max(R, q.right); T = Math.min(T, q.top); B = Math.max(B, q.bottom); } }
    const dx = (L + R) / 2 - (cl + cr) / 2, dy = (T + B) / 2 - (ct + cb) / 2;
    const tolX = Math.max(3, (cr - cl) * 0.04), tolY = Math.max(3, (cb - ct) * 0.12);
    const pl = cl + parseFloat(cs.paddingLeft), pr = cr - parseFloat(cs.paddingRight);
    const clipped = R > Math.max(pr, cr - (cr - cl) * 0.5) + 1.5 || L < Math.min(pl, cl + (cr - cl) * 0.5) - 1.5; // the label stays inside the padding (where gem caps sit)
    if (Math.abs(dx) > tolX || Math.abs(dy) > tolY || clipped) offCentre.push(`${name(e)} dx ${dx.toFixed(1)} dy ${dy.toFixed(1)}${clipped ? ' TEXT OUTSIDE' : ''}`);
  }
  return { buttons: boxes.length, overlaps, offCentre };
};
async function auditScrolled(page) {
  return page.evaluate(async (fnSrc) => {
    const fn = eval('(' + fnSrc + ')');
    const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)).sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth)[0] || document.scrollingElement;
    const all = { buttons: 0, overlaps: new Set(), offCentre: new Set() };
    for (let y = 0; y <= sc.scrollHeight; y += Math.max(200, sc.clientHeight * 0.8)) { sc.scrollTop = y; await new Promise((r) => setTimeout(r, 150)); const r = fn(); all.buttons = Math.max(all.buttons, r.buttons); r.overlaps.forEach((x) => all.overlaps.add(x)); r.offCentre.forEach((x) => all.offCentre.add(x)); }
    sc.scrollTop = 0;
    return { buttons: all.buttons, overlaps: [...all.overlaps], offCentre: [...all.offCentre] };
  }, LAYOUT_AUDIT.toString());
}
test('AC715: Shop and Dashboard layout (Ken, Nov 7): no overlapping buttons and every button label centred, at 1920x1080, 1366x768, 1024x768 and 812x375, scrolled through the whole Shop; the Shop panel frame never cuts through its content', async ({ page }) => {
  test.setTimeout(240000);
  for (const [w, h] of [[1920, 1080], [1366, 768], [1024, 768], [812, 375]]) {
    await page.setViewportSize({ width: w, height: h });
    await signedInDashWith(page, '');
    const dash = await auditScrolled(page);
    expect(dash.overlaps, `${w}x${h} Dashboard: overlapping buttons`).toEqual([]);
    expect(dash.offCentre, `${w}x${h} Dashboard: off-centre labels`).toEqual([]);
    await page.locator('[data-testid=dash-coins]').first().evaluate((e) => e.click());
    await expect(page.locator('[data-screen="econ-shop"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid=shop-frames] .cos-item')).toHaveCount(6, { timeout: 10000 });
    await expect(page.locator('[data-testid=shop-emotes] .cos-pack')).toHaveCount(4, { timeout: 10000 });
    await page.waitForTimeout(600);
    const shop = await auditScrolled(page);
    expect(shop.buttons, `${w}x${h}: the Shop's buttons were measured`).toBeGreaterThan(15);
    expect(shop.overlaps, `${w}x${h} Shop: overlapping buttons`).toEqual([]);
    expect(shop.offCentre, `${w}x${h} Shop: off-centre labels`).toEqual([]);
    // the frame of the Shop panel is the panel's own border: nothing drawn inside the scrolling box can slice through the sleeves
    const frameLayer = await page.evaluate(() => { const b = document.querySelector('.dash.skin .skin-body'); const cs = getComputedStyle(b, '::before'); return cs.content !== 'none' && cs.display !== 'none' && cs.position === 'absolute'; });
    expect(frameLayer, `${w}x${h}: no frame layer scrolling inside the Shop panel`).toBe(false);
  }
});
