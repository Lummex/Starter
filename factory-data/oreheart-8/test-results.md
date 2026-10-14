# Automated check results

35 of 38 checks passed after 3 build round(s).

- ❌ phone viewport › AC20: menu and match fit a phone screen
- ❌ AC1: main menu loads without page errors
- ✅ AC1: starting a test-mode match causes no page errors
- ❌ AC2: menu -> choose Commander -> mulligan -> match
- ✅ AC3: How to Play page with pictures and Back
- ✅ AC4: graphics toggle switches and persists
- ✅ AC5: window.oreheart only in test mode; seeds are deterministic
- ✅ AC6: grubnak starter deck follows the deck rules
- ✅ AC6: sproingle starter deck follows the deck rules
- ✅ AC6: borgo starter deck follows the deck rules
- ✅ AC7: opening sequence, first-player skip, extra card and turn-1 income
- ✅ AC8: HUD elements and Done button advance phases
- ✅ AC9: majority control with Gatherer bonus
- ✅ AC9: tie means nobody controls; underdog bonus applies
- ✅ AC9: shared column 3 counts for two sites
- ✅ AC10: summoning rules, Grubnak discount, Tunnel and summoning sickness
- ✅ AC10: Unique card limited to one on the battlefield; Borgo +1 Health
- ✅ AC11: movement in 8 directions, move 2 only for move-2 creatures
- ✅ AC12: type advantage kills before strike back; defeated go to discard
- ✅ AC12: strike back with type advantage, damage stays
- ✅ AC12: Guard forces adjacent melee attackers to hit it
- ✅ AC12: Ranged hits 2 away with no strike back, blocked by a creature in between
- ✅ AC13: Fireball deals 3 damage and can be paid with any color
- ✅ AC13: only one Crystal card per turn
- ✅ AC13: upgrade costs 6 and is limited to one per creature
- ✅ AC14: Fizzle counters Fireball; crystals still spent
- ✅ AC14: Hold It! returns a summoned creature to hand
- ✅ AC14: Respond dialog — Let it happen
- ✅ AC14: Respond dialog — cast Shield Bubble saves the creature
- ✅ AC15: deck-out deals 1 damage per failed draw
- ✅ AC16: reducing enemy Commander to 0 shows Victory!
- ✅ AC16: surrender from the match menu shows Defeat
- ✅ AC16: surrender action via API
- ✅ AC17: easy AI completes its turn and hands it back
- ✅ AC17: normal AI completes its turn and hands it back
- ✅ AC17: Normal AI defeats a passive player before turn 40
- ✅ AC18: hand cards are buttons and open a card view
- ✅ AC19: illegal actions are rejected and state is unchanged

## Failures

```
✗ phone viewport › AC20: menu and match fit a phone screen
Error: expect(locator).toBeInViewport() failed

Locator: getByRole('button', { name: 'Play' })
Expected: in viewport
Error: strict mode violation: getByRole('button', { name: 'Play' }) resolved to 2 elements:
    1) <button type="button" class="btn primary">Play</button> aka getByRole('button', { name: 'Play', exact: true })
    2) <button class="btn " type="button">How to Play</button> aka getByRole('button', { name: 'How to Play' })

Call log:
  - Expect "toBeInViewport" with timeout 7000ms
  - waiting for getByRole('button', { name: 'Play' })

✗ AC1: main menu loads without page errors
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Play' })
Expected: visible
Error: strict mode violation: getByRole('button', { name: 'Play' }) resolved to 2 elements:
    1) <button type="button" class="btn primary">Play</button> aka getByRole('button', { name: 'Play', exact: true })
    2) <button class="btn " type="button">How to Play</button> aka getByRole('button', { name: 'How to Play' })

Call log:
  - Expect "toBeVisible" with timeout 7000ms
  - waiting for getByRole('button', { name: 'Play' })

✗ AC2: menu -> choose Commander -> mulligan -> match
Error: locator.click: Error: strict mode violation: getByRole('button', { name: 'Play' }) resolved to 2 elements:
    1) <button type="button" class="btn primary">Play</button> aka getByRole('button', { name: 'Play', exact: true })
    2) <button class="btn " type="button">How to Play</button> aka getByRole('button', { name: 'How to Play' })

Call log:
  - waiting for getByRole('button', { name: 'Play' })


  65 | test('AC2: menu -> choose Commander -> mulligan -> match', async ({ page }) => {
  66 |   await page.goto('/?test=1&seed=7');
> 67 |   await page.getByRole('button', { name: 'Play' }).click();
     |                                                    ^
```