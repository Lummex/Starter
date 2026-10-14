# Automated check results

49 of 51 checks passed after 3 build round(s).

- ✅ landscape phone viewport › AC24: menu and match fit a landscape phone screen
- ✅ portrait phone viewport › AC24: upright phone shows the rotate message
- ✅ AC1: main menu has exactly Play, Tutorial, Rules, Settings and no page errors
- ✅ AC1: starting a test-mode match causes no page errors
- ✅ AC2: menu -> choose Commander -> mulligan -> match
- ✅ AC3: Rules page with pictures and Back
- ✅ AC4: Settings graphics toggle switches and persists
- ✅ AC5: window.oreheart only in test mode; seeds are deterministic
- ✅ AC6: grubnak starter deck is 40 creatures, 6 spells (with Fizzle), 4 Crystal cards
- ✅ AC6: sproingle starter deck is 40 creatures, 6 spells (with Fizzle), 4 Crystal cards
- ✅ AC6: borgo starter deck is 40 creatures, 6 spells (with Fizzle), 4 Crystal cards
- ✅ AC7: opening — 0 starting crystals, turn 1 gives exactly 1, extra card for second player
- ✅ AC8: HUD elements, 30/45 second timers, Done advances Deploy -> Action -> Enemy turn
- ✅ AC9: majority control with Gatherer bonus (exact income)
- ✅ AC9: tie means nobody controls; no underdog bonus while nobody holds a site
- ✅ AC9: underdog bonus +2 when the enemy controls a site
- ✅ AC9: shared column 3 counts for two sites
- ✅ AC10: back-row summoning, Grubnak discount, summoning sickness, Wolf Rider
- ✅ AC10: row in front only when the back row is full; nothing when both are full
- ✅ AC10: Unique card limited to one on the battlefield; Borgo +1 Health
- ✅ AC11: Tunnel only while the enemy controls more sites
- ✅ AC12: movement in 8 directions, move 2 only for move-2 creatures
- ✅ AC12: each creature moves OR attacks, never both; Ram Rider (Charge) can do both
- ✅ AC13: simultaneous hits — 1/2 beats 1/1, two 1/1s defeat each other
- ✅ AC13: Shieldbeard vs Scrapper — type advantage defeats it, strike back still lands
- ✅ AC13: strike back with type advantage defeats the attacker
- ✅ AC13: Guard forces adjacent melee attackers to hit it
- ✅ AC13: Ranged hits 2 away with no strike back, blocked by a creature in between
- ❌ AC14: creatures heal at the start of their owner's turn; damaged Health is marked
- ✅ AC15: Gnome Tinker gives Shield 1, which blocks exactly 1 damage
- ❌ AC16: Commander damage equals Attack and never resets
- ✅ AC17: Fireball deals 3 damage and can be paid with any color
- ✅ AC17: only one Crystal card per turn
- ✅ AC17: upgrades cost 6, one per creature; Heavy Armor adds +3 Health
- ✅ AC18: Fizzle counters Fireball; crystals still spent
- ✅ AC18: Hold It! returns a summoned creature to hand
- ✅ AC18: Respond dialog — Let it happen
- ✅ AC18: Respond dialog — cast Shield Bubble saves the creature
- ✅ AC19: deck-out deals 1 damage per failed draw
- ✅ AC20: reducing enemy Commander to 0 shows Victory!
- ✅ AC20: surrender from the match menu shows Defeat
- ✅ AC20: surrender action via API
- ✅ AC21: easy AI completes its turn and hands it back
- ✅ AC21: normal AI completes its turn and hands it back
- ✅ AC21: Normal AI defeats a passive player before turn 60
- ✅ AC22: hand cards are buttons and open a card view
- ✅ AC23: illegal actions are rejected and state is unchanged
- ✅ AC25: first visit offers the tutorial; Skip is remembered
- ✅ AC25: Tutorial button opens the guided match with tips and Skip Tutorial
- ✅ AC25: tutorial steps start at summon and advance after a back-row summon
- ✅ AC26: printed creature Health is at most 6

## Failures

```
✗ AC14: creatures heal at the start of their owner's turn; damaged Health is marked
Error: expect(received).toBe(expected) // Object.is equality

Expected: 3
Received: 2

  571 |   s = await getState(page);
  572 |   expect(at(s, 5, 4).health).toBe(3);
> 573 |   expect(at(s, 2, 6).health).toBe(3); // opponent Shieldbeard: 4 - 2 (Grubnak gives no Health)
      |                              ^
  574 |   await expect(label).toHaveAttribute('data-damaged', 'true');
  575 |   await expect(label).toContainText('3');
  576 |   await done(page); // -> opponent's turn 2
✗ AC16: Commander damage equals Attack and never resets
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

  649 |   expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'battle-cry') })).ok).toBe(true);
  650 |   await done(page);
> 651 |   expect((await act(page, { type: 'attack', creatureUid: queen, target: { commander: 'opponent' } })).ok).toBe(true);
      |                                                                                                           ^
  652 |   expect((await act(page, { type: 'attack', creatureUid: scrap, target: { commander: 'opponent' } })).ok).toBe(true);
  653 |   s = await getState(page);
  654 |   expect(s.players.opponent.health).toBe(4); // 13 - 6 - 3
```