# Automated check results

70 of 73 checks passed after 3 build round(s).

- ✅ landscape phone viewport 844x390 › AC24: menu and full-screen match fit a 844x390 landscape phone
- ✅ landscape phone viewport 740x360 › AC24: menu and full-screen match fit a 740x360 landscape phone
- ✅ landscape phone viewport 667x375 › AC24: menu and full-screen match fit a 667x375 landscape phone
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
- ✅ AC7: opening — start with 0 crystals, pool resets to flow, extra card for second player
- ✅ AC8: HUD elements, hidden timer, Done advances Deploy -> Action -> Enemy turn
- ✅ AC9: example (a) — 1 Gnome Miner vs 2 Goblin Miners: mine is green, Goblins get 4 green, Gnomes 2 green
- ✅ AC9: off-color crystals are worth half toward creatures (rounded down)
- ✅ AC9: example (b) — 2 vs 2 tie: mine is white, 4 white is worth 2 toward creatures and 4 toward spells
- ✅ AC9: examples (c) and (d) — pool is set to flow, unspent crystals last through the enemy turn
- ✅ AC9: example (e) — the pool never goes above 16
- ✅ AC9: a creature touching two mines counts at only one
- ✅ AC10: back-row summoning, Grubnak discount, summoning sickness, Wolf Rider
- ✅ AC10: row in front only when the back row is full; nothing when both are full
- ✅ AC10: Unique card limited to one on the battlefield; Borgo +1 Health
- ✅ AC11: Tunnel only while more mines are in the enemy color
- ❌ AC12: movement in 8 directions, move 2 only for move-2 creatures
- ✅ AC12: each creature moves OR attacks, never both; Ram Rider (Charge) can do both
- ✅ AC13: simultaneous hits — 1/2 beats 1/1, two 1/1s defeat each other
- ✅ AC13: Shieldbeard vs Scrapper — type advantage defeats it, strike back still lands
- ✅ AC13: strike back with type advantage defeats the attacker
- ✅ AC13: Guard forces adjacent melee attackers to hit it
- ✅ AC13: Ranged hits anything within 2 spaces, over creatures, with no strike back
- ❌ AC14: creatures heal at the start of their owner's turn; damaged Health is marked
- ✅ AC15: Gnome Tinker gives Shield 1, which blocks exactly 1 damage
- ❌ AC16: Commander damage equals Attack and never resets
- ✅ AC17: Fireball deals 3 damage and can be paid with any color
- ✅ AC17: only one Crystal card per turn
- ✅ AC17: Prospector's Prayer costs 1 and gives 3 own-color crystals only when behind on mines
- ✅ AC17: upgrades cost 3 / 3 / 5 / 8 paid like creatures, one per creature; Heavy Armor adds +3 Health
- ✅ AC18: Fizzle counters Fireball; crystals still spent
- ✅ AC18: Fizzle cannot cancel a spell costing more than 3
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
- ✅ AC27: creature costs match the revision 3 table; basic Gatherers are 1/1 for 1
- ✅ AC27: summoning spends exactly the new costs
- ✅ AC28: phase banner appears when a phase begins
- ✅ AC28: auto-skipped phases show no banner; ENEMY TURN does
- ✅ AC29: moves left ignores Instants, upgrades and the Gatherer swap
- ✅ AC29: with auto-skip on, an empty turn passes by itself; a phase with moves left does not
- ✅ AC30: creature labels show Attack, Health, Movement and darken after acting
- ✅ AC31: Moves still available pop-up — Go back and Continue
- ✅ AC31: no pop-up on timeout, and Settings can turn it off
- ✅ AC32: countdown appears only in the last 10 seconds; 0 ends just the phase
- ✅ AC33: Gatherer swap moves one basic Gatherer from deck to hand, once per turn
- ✅ AC34: free Gatherer when broke (flow 0, no mine in your color, no Gatherer)
- ✅ AC35: a Gatherer summoned this turn can move but not attack
- ✅ AC36: flow preview, mine ring numbers and mine info
- ✅ AC38: swapping places with your own creature uses only the dragged creature's action
- ✅ AC37: the confirm pop-up sits above the countdown

## Failures

```
✗ AC12: movement in 8 directions, move 2 only for move-2 creatures
Error: expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true

  506 |   const moves = (await legal(page)).filter((a) => a.type === 'move');
  507 |   expect(moves.some((a) => a.creatureUid === scrap && a.row === 5 && a.col === 1)).toBe(true);
> 508 |   expect(moves.some((a) => a.creatureUid === scrap && a.row === 5 && a.col === 2)).toBe(false);
      |                                                                                    ^
  509 |   expect(moves.some((a) => a.creatureUid === scrap && a.row === 4 && a.col === 2)).toBe(false);
  510 |   expect(moves.some((a) => a.creatureUid === wolf && a.row === 4 && a.col === 6)).toBe(false);
  511 |   expect(moves.some((a) => a.creatureUid === wolf && a.row === 4 && a.col === 7)).toBe(true);
✗ AC14: creatures heal at the start of their owner's turn; damaged Health is marked
Error: expect(received).toBe(expected) // Object.is equality

Expected: 3
Received: 2

  685 |   s = await getState(page);
  686 |   expect(at(s, 5, 4).health).toBe(3);
> 687 |   expect(at(s, 2, 6).health).toBe(3); // opponent Shieldbeard: 4 - 2 (Grubnak gives no Health)
      |                              ^
  688 |   await expect(label).toHaveAttribute('data-damaged', 'true');
  689 |   await expect(label).toContainText('3');
  690 |   await done(page); // -> opponent's turn 2
✗ AC16: Commander damage equals Attack and never resets
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

  765 |   expect((await act(page, { type: 'cast', uid: handUid(s, 'player', 'battle-cry') })).ok).toBe(true);
  766 |   await done(page);
> 767 |   expect((await act(page, { type: 'attack', creatureUid: queen, target: { commander: 'opponent' } })).ok).toBe(true);
      |                                                                                                           ^
  768 |   expect((await act(page, { type: 'attack', creatureUid: scrap, target: { commander: 'opponent' } })).ok).toBe(true);
  769 |   s = await getState(page);
  770 |   expect(s.players.opponent.health).toBe(4); // 13 - 6 - 3
```