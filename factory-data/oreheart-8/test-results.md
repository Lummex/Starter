# Automated check results

160 of 161 checks passed after 3 build round(s).

- ✅ landscape phone viewport 844x390 › AC24: menu and full-screen match fit a 844x390 landscape phone
- ✅ landscape phone viewport 740x360 › AC24: menu and full-screen match fit a 740x360 landscape phone
- ✅ landscape phone viewport 667x375 › AC24: menu and full-screen match fit a 667x375 landscape phone
- ✅ portrait phone viewport › AC24: upright phone shows the rotate message
- ✅ landscape layout details › AC43: the hand rests tucked half below the edge and slides up on hover
- ✅ landscape layout details › AC44: deck piles on each player's right and Commander hearts
- ✅ hearts and turn display 844x390 › AC51: Commander hearts never cover creature labels; turn display top-right (844x390)
- ✅ hearts and turn display 740x360 › AC51: Commander hearts never cover creature labels; turn display top-right (740x360)
- ✅ hearts and turn display 667x375 › AC51: Commander hearts never cover creature labels; turn display top-right (667x375)
- ✅ hand pop-out at 2x › AC59: a hovered hand card doubles in size and stays fully on-screen
- ✅ compact stat pill › AC66: creature labels are compact pills with Attack, Health, Movement
- ✅ phone-size match screenshot › AC90: the match screen renders full screen at 844x390 with no page errors
- ✅ display mode on a PC window › AC103: Display mode Auto / PC / Phone, remembered, without extra menu buttons
- ✅ diagonal board and grouped HUD at 844x390 › AC104: player bottom-left, enemy top-right, HUD grouped
- ✅ diagonal board and grouped HUD at 844x390 › AC105: the enemy hand is smaller than the player hand
- ✅ AC1: main menu has exactly Play, Tutorial, Decks, Rules, Settings and no page errors
- ✅ AC1: starting a test-mode match causes no page errors
- ✅ AC2: menu -> choose Commander -> mulligan -> match
- ✅ AC3: Rules page with pictures and Back
- ✅ AC4: Settings graphics toggle switches and persists
- ✅ AC5: window.oreheart only in test mode; seeds are deterministic
- ✅ AC6: grubnak starter deck is 40 creatures, 6 spells (with Snuff Out), 4 Crystal cards
- ✅ AC6: sproingle starter deck is 40 creatures, 6 spells (with Snuff Out), 4 Crystal cards
- ✅ AC6: borgo starter deck is 40 creatures, 6 spells (with Snuff Out), 4 Crystal cards
- ✅ AC7: opening — start with 0 crystals, pool resets to flow, extra card for second player
- ✅ AC8: HUD elements, hidden timer, Done advances Deploy -> Action -> Enemy turn
- ✅ AC9: example (a) — 1 Gemsinger Miner vs 2 Grubgrabber Miners: enemy owns the mine, enemy gets 4, you get 1 (+2 underdog)
- ✅ AC9: one crystal type — every card costs plain crystals, Flow is a single number
- ✅ AC9: example (b) — 2 vs 2 tie: mine is neutral, each side gets the full 4
- ✅ AC9: mining at an enemy-owned mine pays half — Miner 1, Fighter 0; own or neutral pays full
- ✅ AC9: examples (c) and (d) — pool is set to flow, unspent crystals last through the enemy turn
- ✅ AC9: example (e) — the pool never goes above 16
- ✅ AC39: mining is an action — Gatherer 2, Fighter 1, nothing without mining; pool set to last turn's mining
- ✅ AC10: back-row summoning, Grubnak discount, summoning sickness, Mangewolf Rider
- ✅ AC10: row in front only when the back row is full; nothing when both are full
- ✅ AC10: Unique card limited to one on the battlefield; Borgo +1 Health
- ✅ AC11: Tunnel only while more mines are in the enemy color
- ✅ AC12: movement in 8 directions, move 2 only for move-2 creatures
- ✅ AC12: each creature moves OR attacks, never both; Thunderhorn Ram Rider (Charge) can do both
- ✅ AC13: simultaneous hits — 1/2 beats 1/1, two 1/1s defeat each other
- ✅ AC13: Shieldbeard vs Scrapper — type advantage defeats it, strike back still lands
- ✅ AC13: strike back with type advantage defeats the attacker
- ✅ AC13: Guard forces adjacent melee attackers to hit it
- ✅ AC13: Ranged hits anything within 2 spaces, over creatures, with no strike back
- ✅ AC14: creatures heal at the start of their owner's turn; damaged Health is marked
- ✅ AC15: Aegis Tinkerer gives Shield 1, which blocks exactly 1 damage
- ✅ AC16: Commander damage equals Attack and never resets
- ✅ AC17: Infernal Orb deals 3 damage for 3 crystals
- ✅ AC17: only one Crystal card per round; it goes to the Bank
- ✅ AC17: Desperate Plunder costs 1 and gives 3 Flow only when behind on mines
- ✅ AC17: crystal-bought upgrades are gone
- ✅ AC18: Snuff Out counters Infernal Orb; crystals still spent
- ✅ AC18: Snuff Out cannot cancel a spell costing more than 3
- ✅ AC18: Not Today! returns a summoned creature to hand
- ✅ AC18: Respond dialog — Let it happen
- ✅ AC18: Respond dialog — cast Bastion Ward saves the creature
- ✅ AC19: deck-out deals 1 damage per failed draw
- ✅ AC20: reducing enemy Commander to 0 shows Victory!
- ✅ AC20: surrender from the match menu shows Defeat
- ✅ AC20: surrender action via API
- ✅ AC21: easy AI completes its turn and hands it back
- ✅ AC21: normal AI completes its turn and hands it back
- ✅ AC78: hard AI completes its turn and hands it back
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
- ✅ AC29: moves left ignores Instants, Crystal cards and the Miner swap
- ✅ AC29: with auto-skip on, an empty turn passes by itself; a phase with moves left does not
- ✅ AC30: creature labels show Attack, Health, Movement and darken after acting
- ✅ AC31: Moves still available pop-up — Go back and Continue
- ✅ AC31: no pop-up on timeout, and Settings can turn it off
- ✅ AC32: countdown appears only in the last 10 seconds; 0 ends just the phase
- ✅ AC33: Gatherer swap moves one basic Gatherer from deck to hand, once per turn
- ✅ AC34: free Miner only when Flow + Bank cannot pay and no Miner is on the battlefield
- ✅ AC35: a Gatherer summoned this turn can move or mine but not attack; a Fighter can do nothing
- ✅ AC36: flow preview, mine ring numbers and mine info
- ✅ AC38: swapping places with your own creature uses only the dragged creature's action
- ✅ AC37: the confirm pop-up sits above the countdown
- ✅ AC40: 13 x 7 board; 3 random, mirrored mines from the seed; fixed tutorial layout
- ✅ AC41: the moves pop-up names miners that have not mined
- ✅ AC42: Ranged creatures show the bow icon on the board and in the hand
- ✅ AC45: Miner names, roles and badges
- ✅ AC46: Miner upgrades — Smith gives +1 Attack and +1 Health, basic Miner +1 Health; they stack, persist and heal
- ✅ AC46: a basic Miner played onto your creature gives exactly +1 Health; the free Miner can never upgrade
- ✅ AC46: dropping a Smith Miner on your creature upgrades it at once (no choice pop-up)
- ✅ AC47: Crystal Bank persists, has no cap and is spent after Flow
- ✅ AC48: playing a Crystal card never ends the phase or turn
- ✅ AC49: an unaffordable counterspell opens no Respond window (Round 2)
- ✅ AC49: "Soul Cluster + Snuff Out" plays both and cancels the enemy spell
- ✅ AC49: a Crystal card played alone in the Respond window keeps it open and funds the counterspell
- ✅ AC50: Smith Miners never Tunnel; the Tunnel! tag shows only when behind
- ✅ AC52: one crystal type — two counters only; Heart of the Fallen puts 4 into the Bank
- ✅ AC53: the Respond pop-up has a standalone "Play Soul Cluster" button that keeps it open
- ✅ AC54: nothing can mine from 2 spaces away — only the 8 adjacent spaces
- ✅ AC55: casting a spell shows "GRUBNAK CASTS INFERNAL ORB!" over the Stronghold; Commanders never attack
- ✅ AC56: Settings has "Card reveals: Normal" / "Fast", saved across reloads
- ✅ AC57: every card shows its full ability text, in the hand and in the card view; names follow the rename table
- ✅ AC57: the Commander picker uses the new Commander names
- ✅ AC58: tapping a mine mines with exactly the ready Miners next to it
- ✅ AC58: mineAt action matches the tap; hovering a mine only shows its info
- ✅ AC60: Deck Builder shows card faces with full text and filters them
- ✅ AC61: Deck Builder problems use the exact messages and counts
- ✅ AC62: up to 5 saved decks persist after a reload
- ✅ AC63: the 15 new cards have the exact printed stats
- ✅ AC63: new card abilities with exact numbers
- ✅ AC64: Deploy auto-skips with an unplayable hand; Action skips once nothing can act
- ✅ AC64: Done with only a Crystal card, an Instant or an unplaceable card shows no pop-up
- ✅ AC65: every creature carries the weapon of its type
- ✅ AC67: ending your turn with 9 Flow saves 0 into the Bank
- ✅ AC67: ending your turn with 10 Flow saves 1 into the Bank
- ✅ AC67: ending your turn with 16 Flow saves 1 into the Bank
- ✅ AC67: savings applies to the opponent at the end of its own turn
- ✅ AC68: a hand of only affordable spells does not count as moves left
- ✅ AC68: with auto-skip on, a spells-only turn passes by itself
- ✅ AC69: previewAttack matches the real attack exactly
- ✅ AC69: dragging a creature over an enemy shows the attack preview; letting go elsewhere cancels
- ✅ AC70: double-click and + add cards; single click only enlarges; copy limit and cost chart
- ✅ AC71: Auto-fill completes a legal deck; Rename and Save
- ✅ AC72: select screen — Commander cards, deck stacks, difficulty and Fight! (no dropdowns)
- ✅ AC72: "+ New Deck" on the select screen opens the Deck Builder
- ✅ AC73: the select screen remembers the last Commander, deck and difficulty
- ✅ AC74: match-end summary, Play again with the same choices, and Menu
- ✅ AC75: the tutorial runs to the end, teaching only the current rules
- ✅ AC76: the Last turn recap lists what the enemy did
- ✅ AC77: a mine with ready Miners shows the swinging pickaxe count; it goes once they mined
- ✅ AC79: main menu shows the logo as the h1, the tagline and the five plaques
- ✅ AC80: every Goblin creature has a finished figure; Gnomes and Dwarves are placeholders
- ✅ AC81: every Goblin creature has a committed WebP card picture and an art entry
- ✅ AC82: every card has a tagline and a flavor line
- ✅ AC83: a Goblin hand card uses the new card face with its picture and rarity
- ✅ AC84: finished Goblin figures, Grubnak, Strongholds and mines on the battlefield
- ✅ AC85: poking a Goblin figure plays a reaction and changes nothing
- ✅ AC86: CREDITS.md lists fonts, card pictures and every outside asset file
- ✅ AC87: sound stays locked until the first tap
- ✅ AC88: volume sliders and the match mute button are remembered
- ✅ AC89: Low graphics turns off bloom, shadows and particles and uses fewer draw calls
- ✅ AC90: the built dist folder stays under 40 MB
- ✅ AC91: card faces use the faction frame, stat slots, type icon and rarity colors
- ✅ AC92: every card has short and long text; Full explanation shows the long text
- ✅ AC93: the cut-out deck image is used on every deck pile
- ✅ AC94: Commander select shows borderless full-art Commander cards without stats
- ✅ AC95: up to 3 mulligans — 5 -> 5 -> 4 -> 3, then no more
- ✅ AC95: the Mulligan screen shows one straight row and counts mulligans left
- ✅ AC96: dialogs float with no box; buttons are ornate
- ✅ AC97: card reveals never block the game and can be pinned
- ✅ AC98: tapping a creature shows its card and changes nothing
- ✅ AC99: the Card pop-ups switch skips reveals but never effects, and is remembered
- ❌ AC100: spells play step by step and nothing vanishes without a cause
- ✅ AC101: Blastrat Sapper carries a bomb: drop, KA-BOOM, then 1 damage to the adjacent enemy
- ✅ AC102: the Respond pop-up only lists playable options
- ✅ AC106: zoom in, drag-to-attack still works, Re-center resets
- ✅ AC107: Deck Builder logo, smart search and cards per row
- ✅ AC108: title screen uses the painted cavern background with the logo, without errors

## Failures

```
✗ AC100: spells play step by step and nothing vanishes without a cause
Error: expect(received).toBeUndefined()

Received: {"ale": 0, "attack": 2, "blinkUsed": false, "bubble": false, "cardId": "goblin-scrapper", "col": 3, "hasAttacked": false, "hasMined": false, "hasMoved": false, "health": 1, "lockedUntil": 0, "maxHealth": 4, "minedMine": null, "movedDistance": 0, "owner": "opponent", "row": 3, "shield": 0, "summonedThisTurn": false, "uid": "u103", "upgrades": {"attack": 0, "health": 0}}

  3315 |   await clearFx(page);
  3316 |   await castOrb(page, 3, 3);
> 3317 |   expect(at(await getState(page), 3, 3)).toBeUndefined();
       |                                          ^
  3318 |   let log = await fxLog(page);
  3319 |   const e = idx(log, (x) => x.kind === 'effect' && x.cardId === 'fireball');
  3320 |   const i = idx(log, (x) => x.kind === 'impact', e);
    at /home/runner/work/Starter/Starter/factory/.run-tests/acceptance.spec.mjs:3317:42
```