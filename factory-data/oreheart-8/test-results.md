# Automated check results

404 of 438 checks passed after 5 build round(s).

- ❌ landscape phone viewport 844x390 › AC24: menu and full-screen match fit a 844x390 landscape phone
- ❌ landscape phone viewport 740x360 › AC24: menu and full-screen match fit a 740x360 landscape phone
- ✅ landscape phone viewport 667x375 › AC24: menu and full-screen match fit a 667x375 landscape phone
- ✅ portrait phone viewport › AC24: upright phone shows the rotate message
- ✅ computer browser window, tall and narrow › AC24b: a computer window never shows the rotate message and keeps the 16:9 shape
- ✅ AC1: main menu has exactly Play, Deck Builder, How to Play, Settings, Quit and no page errors
- ✅ AC1: starting a test-mode match causes no page errors
- ✅ AC2: menu -> choose Commander -> mulligan -> match
- ✅ AC3: Rules page with pictures and Back
- ✅ AC4: Settings graphics toggle switches and persists
- ✅ AC5: window.oreheart only in test mode; seeds are deterministic
- ✅ AC6: grubnak Warband starter deck is 100 cards: 30 + 20 Miners, 38 Fighters, 7 spells, 5 Crystal cards
- ✅ AC6: sproingle Warband starter deck is 100 cards: 30 + 20 Miners, 38 Fighters, 7 spells, 5 Crystal cards
- ✅ AC6: borgo Warband starter deck is 100 cards: 30 + 20 Miners, 38 Fighters, 7 spells, 5 Crystal cards
- ✅ AC7: opening — start with 0 crystals, pool resets to flow, extra card for second player
- ✅ AC8: HUD elements, hidden timer, Done advances Deploy -> Action -> Enemy turn
- ✅ AC9: example (a) — 1 Gemsinger Miner vs 2 Goblin Miners: enemy owns the mine, enemy gets 4, you get 1 (+2 underdog)
- ✅ AC9: one crystal type — every card costs plain crystals, Flow is a single number
- ✅ AC9: example (b) — 2 vs 2 tie: mine is neutral, each side gets the full 4
- ✅ AC9: mining at an enemy-owned mine pays half — Miner 1, Fighter 0; own or neutral pays full
- ✅ AC9: examples (c) and (d) — pool is set to flow, unspent crystals last through the enemy turn
- ✅ AC9: example (e) — the pool never goes above 16
- ✅ AC39: mining is an action — Gatherer 2, Fighter 1, nothing without mining; pool set to last turn's mining
- ✅ AC10: back-row summoning, Grubnak discount, summoning sickness, Mangewolf Rider
- ✅ AC10: row in front only when the back row is full; nothing when both are full
- ✅ AC10: Unique card limited to one on the battlefield; Borgo +1 Health
- ✅ AC11: Tunnel works from turn 1 on every empty space next to any mine (Round 10)
- ✅ AC12: movement in 8 directions, move 2 only for move-2 creatures
- ✅ AC12: each creature moves OR attacks, never both; Thunderhorn Ram Rider (Charge) can do both
- ✅ AC13: simultaneous hits — 1/2 beats 1/1, two 1/1s defeat each other
- ✅ AC13: Shieldbeard vs Scrapper — type advantage defeats it, strike back still lands
- ✅ AC13: strike back with type advantage defeats the attacker
- ✅ AC13: Guard forces adjacent melee attackers to hit it
- ✅ AC13: Ranged shoots up to its card range (Grudge Hurler 5, Skullflinger 6) in 8 straight lines, stops at the first unit, no strike back (Round 22)
- ✅ AC14: creatures heal at the start of their owner's turn; damaged Health is marked
- ✅ AC15: Aegis Tinkerer gives Shield 1, which blocks exactly 1 damage
- ✅ AC16: Commander damage equals Attack and never resets
- ✅ AC17: Searing Arcane Orb deals 3 damage for 3 crystals
- ✅ AC17: Crystal cards have no once-per-round limit; each goes to the Bank (Round 10)
- ✅ AC17: crystal-bought upgrades are gone
- ✅ AC18: Snuff Out counters Searing Arcane Orb; crystals still spent
- ✅ AC18: Snuff Out cannot cancel a spell costing more than 3
- ✅ AC18: Pickpocket! returns a summoned creature to hand
- ✅ AC18: Respond dialog — Let it happen
- ✅ AC18: Respond dialog — cast Ironclad Bulwark saves the creature
- ✅ AC19: deck-out deals 1 damage per failed draw
- ✅ AC20: reducing enemy Commander to 0 shows Victory!
- ✅ AC20: giving up from the match menu shows Defeat
- ✅ AC20: surrender action via API
- ✅ AC21: easy AI completes its turn and hands it back
- ✅ AC21: normal AI completes its turn and hands it back
- ✅ AC78: hard AI completes its turn and hands it back
- ✅ AC21: Normal AI defeats a passive player before turn 60
- ✅ AC22: hand cards are buttons and open a card view
- ✅ AC23: illegal actions are rejected and state is unchanged
- ✅ landscape layout details › AC43: the hand rests fully on screen at the bottom and rises on hover (Round 17)
- ✅ landscape layout details › AC44: deck piles on each player's right and Commander hearts
- ✅ hearts and turn display 844x390 › AC51: Commander hearts never cover creature labels; turn display top-right (844x390)
- ✅ hearts and turn display 740x360 › AC51: Commander hearts never cover creature labels; turn display top-right (740x360)
- ✅ hearts and turn display 667x375 › AC51: Commander hearts never cover creature labels; turn display top-right (667x375)
- ✅ hand pop-out at 2x › AC59: a hovered hand card rises to about 1.6x and stays fully on-screen
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
- ✅ AC40: 13 x 7 board; 3 random, corner-mirrored mines from the seed; Strongholds at (7,2) and (1,12); fixed tutorial layout
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
- ✅ AC50: Smith Miners never Tunnel; the Tunnel! tag shows from turn 1 (Round 10)
- ✅ AC52: one crystal type — two counters only; Heart of the Fallen puts 4 into the Bank
- ✅ AC53: the Respond pop-up has a standalone "Play Soul Cluster" button that keeps it open
- ✅ AC54: nothing can mine from 2 spaces away — only the 8 adjacent spaces
- ✅ AC55: casting a spell shows "GRUBNAK CASTS SEARING ARCANE ORB!" over the Stronghold; Commanders never attack
- ✅ AC56: Settings has "Card reveals: Normal" / "Fast", saved across reloads
- ✅ AC57: the Commander picker uses the new Commander names
- ❌ AC58: tapping a mine mines with exactly the ready Miners next to it
- ❌ AC58: mineAt action matches the tap; hovering a mine only shows its info
- ✅ AC60: Deck Builder shows card faces with full text and filters them
- ✅ AC61: Deck Builder problems use the exact messages and counts
- ✅ AC62: up to 5 saved decks persist after a reload
- ✅ AC64: Deploy auto-skips with an unplayable hand; Action skips once nothing can act
- ✅ AC64: Done with only a Crystal card, an Instant or an unplaceable card shows no pop-up
- ✅ AC67: ending your turn with 9 Flow saves 0 into the Bank
- ✅ AC67: ending your turn with 10 Flow saves 1 into the Bank
- ✅ AC67: ending your turn with 16 Flow saves 1 into the Bank
- ✅ phone-size match screenshot › AC90: the match screen renders full screen at 844x390 with no page errors
- ✅ display mode on a PC window › AC103: Display mode Auto / PC / Phone, remembered, without extra menu buttons
- ✅ straight-on road board and corner HUD at 844x390 › AC104: straight-on road perspective, Commanders in the corners, HUD around them
- ✅ straight-on road board and corner HUD at 844x390 › AC105: the enemy hand is smaller than the player hand
- ✅ both hands at 844x390 › AC115: the enemy hand is always on-screen and the hand shows about 7 cards, then scrolls
- ✅ both hands at 844x390 › AC116: a right-clicked creature shows its card at hovered-hand-card size, fully on-screen
- ✅ both hands at 844x390 › AC117: the deck picker shows the nine starter decks as named stacks
- ✅ title layout and ornaments › AC123: "Welcome to Oreheart!" never overlaps the logo or the Tutorial button; no frame ornaments on any screen (844x390)
- ✅ title layout and ornaments › AC123: "Welcome to Oreheart!" never overlaps the logo or the Tutorial button; no frame ornaments on any screen (1280x720)
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
- ✅ AC75 + AC125: the tutorial runs to the end, teaching only the current rules
- ✅ AC76: the Last turn recap lists what the enemy did
- ✅ AC77: a mine with ready Miners shows the swinging pickaxe count; it goes once they mined
- ✅ AC79: main menu shows the logo as the h1, the tagline and the five plaques
- ✅ AC80: every Goblin creature has a finished figure; Gnomes and Dwarves are finished when they have a model, else placeholders
- ✅ AC82: every card has a tagline and a flavor line
- ✅ AC84: finished Goblin figures, Grubnak, Strongholds and mines on the battlefield
- ✅ AC85: poking a Goblin figure plays a reaction and changes nothing
- ✅ AC86: CREDITS.md lists fonts, card pictures and every outside asset file
- ✅ AC87: sound stays locked until the first tap
- ✅ AC88: volume sliders and the match mute button are remembered
- ✅ AC89: Low graphics turns off bloom, shadows and particles and uses fewer draw calls
- ✅ AC90: the built dist folder stays under 95 MB
- ✅ AC93: the cut-out deck image is used on every deck pile outside the match
- ✅ AC95: up to 3 mulligans — 5 -> 5 -> 4 -> 3, then no more
- ✅ AC95: the Mulligan screen shows one straight row and counts mulligans left
- ✅ AC97: card reveals never block the game and can be pinned
- ✅ AC98: right-clicking a creature shows its card and changes nothing; left-click only selects (owner, Oct 25)
- ✅ AC99: the Card pop-ups switch skips reveals but never effects, and is remembered
- ✅ AC100: spells play step by step and nothing vanishes without a cause
- ✅ AC101: SewerSlide Bomber carries a bomb: drop, KA-BOOM, then 1 damage to the adjacent enemy
- ✅ AC102: the Respond pop-up only lists playable options
- ✅ AC106: zoom in, drag-to-attack still works, Re-center resets
- ✅ AC108: title screen uses the painted cavern background with the logo, without errors
- ✅ AC109: Strongholds stand in the corners: player (7,2), enemy (1,12)
- ✅ AC110: random mines are always corner-mirrored, fair, away from both Strongholds and never on the same square
- ✅ AC111: decks of 50 to 100 cards and at most 20 Crystal cards
- ✅ AC112/AC128: nine legal 100-card starter decks: Warband, Arcane Hoard and Horde for each faction
- ✅ AC113: matches use the chosen starter decks; the opponent deck can be any of the three
- ✅ AC114: the computer plays the Warband style to the end of a match
- ✅ AC114: the computer plays the Arcane Hoard style to the end of a match
- ✅ AC114: the computer plays the Horde style to the end of a match
- ✅ AC121: Deck Builder deck art has no frame; painted background
- ✅ AC122: one ornate control style everywhere: no default browser controls or scrollbars
- ✅ AC124: every spell has its own visual, played step by step
- ❌ round 4 phone screenshots (844x390) › AC134: mulligan, spell cards per faction, a creature close-up and a menu screen render without errors
- ✅ round 5a screenshots (1920x1080) › AC148: Deck Builder, Choose Your Commander and a spell card per faction render without errors (1920x1080)
- ✅ round 5a screenshots (844x390) › AC148: Deck Builder, Choose Your Commander and a spell card per faction render without errors (844x390)
- ✅ owner HUD layout 1920x1080 › AC151: HUD pieces sit at the owner's positions and never cover a Commander (1920x1080)
- ✅ owner HUD layout 844x390 › AC151: HUD pieces sit at the owner's positions and never cover a Commander (844x390)
- ✅ readable sizes at 844x390 › AC158: no text below about 14 px on any screen at phone size
- ✅ round 5b screenshots (1920x1080) › AC160: match, Menu popped out and hand popped out render without errors (1920x1080)
- ✅ round 5b screenshots (2560x1080) › AC160: match, Menu popped out and hand popped out render without errors (2560x1080)
- ✅ round 5b screenshots (844x390) › AC160: match, Menu popped out and hand popped out render without errors (844x390)
- ✅ round 6a match layout 1920x1080 › AC161: Done sits bottom-right under the deck and nothing invisible blocks the board (1920x1080)
- ✅ round 6a match layout 1920x1080 › AC163: the hand is 2x, centered, overlapping, fully on screen at rest and rises on hover (1920x1080)
- ✅ round 6a match layout 1920x1080 › AC164: the hovered card rises to 48-60% of the height on the top layer (1920x1080)
- ✅ round 6a match layout 1920x1080 › AC166: enemy hand centered with the deck to its left; nothing covers a Commander (1920x1080)
- ✅ round 6a match layout 844x390 › AC161: Done sits bottom-right under the deck and nothing invisible blocks the board (844x390)
- ✅ round 6a match layout 844x390 › AC163: the hand is 2x, centered, overlapping, fully on screen at rest and rises on hover (844x390)
- ✅ round 6a match layout 844x390 › AC164: the hovered card rises to 48-60% of the height on the top layer (844x390)
- ✅ round 6a match layout 844x390 › AC166: enemy hand centered with the deck to its left; nothing covers a Commander (844x390)
- ✅ round 6a screenshots (1920x1080) › AC173: match with hand at rest and popped out, deck builder close-up and card back render without errors (1920x1080)
- ✅ round 6a screenshots (844x390) › AC173: match with hand at rest and popped out, deck builder close-up and card back render without errors (844x390)
- ✅ round 7 hand (1920x1080) › AC174: hovered hand cards always retract; only one pops at a time; nothing stays stuck (1920x1080)
- ✅ round 7 hand (1920x1080) › AC175: hand cards follow the owner layout (about 34% of the height), fully on screen at rest (1920x1080)
- ✅ round 7 hand (844x390) › AC174: hovered hand cards always retract; only one pops at a time; nothing stays stuck (844x390)
- ✅ round 7 hand (844x390) › AC175: hand cards follow the owner layout (about 34% of the height), fully on screen at rest (844x390)
- ❌ AC127: mulligan cards are double size, one row, on-screen (1280x720)
- ❌ AC127: mulligan cards are double size, one row, on-screen (844x390)
- ✅ AC129: faction spells — names, factions, deck validation and the casting lock
- ✅ AC131: Venom Shiv poisons for 7 of the target’s turns (1 damage each, no healing); Hex Reversal is disabled
- ❌ AC135: one font everywhere: Alegreya SC Italic, bundled, no metal or textured letters
- ✅ AC136: cards are never stretched (Deck Builder at 2 and 8 per row, mulligan, hand) at several window sizes
- ✅ AC137: menu buttons are plain white text with a hover glow, no boxes or borders
- ❌ AC138: every menu screen fills the window edge to edge at 844x390, 1280x720, 1920x1080 and rescales live
- ✅ AC140: the cards-per-row slider goes from 2 to 8
- ✅ AC141: the deck carousel shows only my decks plus a New Deck slot; arrows, keys and dragging pick the deck
- ✅ AC142: a card dragged from the grid shows at its 3-per-row size and lands in the deck
- ✅ AC143: the deck list always shows about 8 rows; it scrolls inside its panel
- ✅ AC144: starter decks can be removed (in-game confirm) and restored; at least one deck always remains
- ✅ AC145: Copy to my decks makes an editable saved copy and leaves the starter deck unchanged; my decks can be removed
- ✅ AC146: Choose Your Commander: big glowing Commander cards that stand out, big decks and text, filling the screen
- ❌ AC149: the cover-fit painted view keeps both Commanders whole at every window shape (Round 8a)
- ❌ AC150: no black bars at any window shape
- ✅ AC152: Flow and bank numbers sit on both crystals with name, Flow and Next beside them
- ✅ AC153: the phase tracker shows whose turn, the turn number and the current phase
- ✅ AC154: the match Menu hides its items until hovered or tapped; Mute and Recenter work
- ✅ AC155: playable hand cards glow, the others do not, and it updates at once
- ✅ AC156: Done shows only when needed, bottom-right, as plain text
- ✅ AC157: mulligan, Respond, surrender and match-end controls are plain text
- ✅ AC159: longer card reveals, ruby hearts with white numbers, Flow particles setting
- ✅ AC162: no hand counts for either player; deck numbers stay
- ✅ AC165: face-down cards use the original Oreheart card back
- ✅ AC167: every text outside the card faces is plain white #ffffff (title, Rules, Settings, Deck Builder, Choose Your Commander, match)
- ❌ AC168: bold titles and main actions, regular body text, only four weights
- ✅ AC169: Deck Builder close-up fills the height, has no scrollbar or Close, and dismisses on click or Esc
- ✅ AC170: deck list + and - change counts at once, without moving the row; rapid clicks all count
- ✅ AC171: no "All cards" text and no corner ornaments on any menu screen
- ✅ AC172: crystal mines use the owner's Crystal Node model, about 1.3 squares tall and inside its square, in the owner's faction color; unowned mines are white (owner, Oct 24)
- ✅ round 7 screenshots (1920x1080) › AC184: Grubnak in a match and in the 3D viewer render without errors
- ✅ arena homography 1920x1080 › AC188: square centers follow the homography of the owner's corners (1920x1080)
- ❌ arena homography 844x390 › AC188: square centers follow the homography of the owner's corners (844x390)
- ✅ arena highlights 1920x1080 › AC189: drag highlights are the legal summon squares on the painted floor; drop uses the mapping
- ❌ arena pan 1920x1080 › AC191: keys, WASD and dragging empty board pan the view, always clamped to the painting
- ✅ arena HUD 1920x1080 › AC192: the HUD stays fixed while zooming and panning; Recenter and double-click reset the view
- ✅ arena drags 1920x1080 › AC194: dragging a hand card or a creature never pans the view
- ✅ round 8a screenshots 1920x1080 › AC195: the painted arena match fully zoomed out and zoomed in renders without errors (1920x1080)
- ✅ round 8a screenshots 844x390 › AC195: the painted arena match fully zoomed out and zoomed in renders without errors (844x390)
- ✅ hand never rises while dragging 1920x1080 › AC200: dragging a creature or panning across the hand never raises it
- ✅ round 8b pop-out 1920x1080 › AC201: the pop-out is about 70% of the window height, eased 150-200 ms (1920x1080)
- ✅ round 8b pop-out 844x390 › AC201: the pop-out is about 70% of the window height, eased 150-200 ms (844x390)
- ✅ round 9a owner layout 1920x1080 › AC212: every HUD piece sits where the owner's layout puts it (1920x1080)
- ❌ round 9a owner layout 844x390 › AC212: every HUD piece sits where the owner's layout puts it (844x390)
- ✅ round 9a hand 1920x1080 › AC218: hovering raises the whole card, neighbors move aside, moving across shuffles (1920x1080)
- ✅ round 9a hand 844x390 › AC218: hovering raises the whole card, neighbors move aside, moving across shuffles (844x390)
- ✅ round 9a screenshots 1920x1080 › AC227: match at rest, raised card, open menu and a Crystal Flow stream render without errors (1920x1080)
- ❌ AC176: the owner's card back and deck-pile pictures are used exactly
- ✅ AC177: a popped card keeps the at-rest glow thickness and opacity
- ✅ AC178: glow colors contrast with each faction frame
- ✅ AC179: crystal mines are about 1.3 spaces tall and fit inside their square (owner, Oct 24)
- ✅ AC180: Grubnak model files are saved once with models.json; the game never calls Meshy
- ✅ AC181: Grubnak is the Meshy model on his fortress with the scepter, about 2.4 tall, idling
- ✅ AC182: Grubnak plays cast, defeat and celebrate at the right moments
- ✅ AC183: no "View Grubnak in 3D" button remains on Choose Your Commander or the Deck Builder (Round 8b)
- ✅ AC185: the owner's arena pictures and layout are loaded unchanged
- ✅ AC186: all 54 arena effects are drawn, off-painting pools are clipped, two foreground cut-outs
- ✅ AC187: no grid lines are drawn, even while dragging a card
- ❌ AC190: cover-fit with no black bars at 16:9, 4:3, 21:9 and phone; max zoom about 2.5 px per painting pixel
- ❌ AC191: at zoom 1 on a 4:3 window the view pans sideways but never past the edges
- ✅ AC193: the Meshy crystal mine is saved once and used for every mine, tinted by owner
- ❌ AC196: the player Commander faces the opponent and turns back after a look-back
- ❌ AC197: impatience starts after about 20 s idle and stops on an action
- ✅ AC198: the hand glow is brightest at the card edge and fades outward
- ✅ AC199: the hand hover box fits 1 card(s) and a point above it does not raise the hand
- ✅ AC199: the hand hover box fits 4 card(s) and a point above it does not raise the hand
- ✅ AC199: the hand hover box fits 8 card(s) and a point above it does not raise the hand
- ✅ AC203: dragging a card onto the deck list adds one copy; a plain click opens the close-up
- ✅ AC204: adding cards by double-click, drag and + never moves the panel, the grid or the cards
- ✅ AC205: every deck entry on Choose Your Commander has the same size, also for long names and when selected
- ❌ AC206: choosing a Commander hides the other two and shows only his decks; Change Commander, Esc and a second click bring the row back
- ✅ AC207: Grubnak's 3D model pops up in front of his card when he is chosen
- ✅ AC208: Fight! sits bottom-right in both states at 1920x1080 and 844x390
- ✅ AC209: the Deck Builder close-up shows the 3D viewer beside Grubnak's card and dismisses correctly
- ✅ AC213: the enemy deck and card fan are upside down with a readable deck count
- ✅ AC215: themes follow each side's Commander faction; goblin corner frames only for a Goblin player
- ✅ AC216: the drop-down Menu has the owner's six items, closes properly and Give up asks first
- ✅ AC217: Settings, Sound Effects, Background music and How to play open their controls
- ✅ AC219: the opening hand deals in one card at a time
- ✅ AC221: mines are the code-built owner mine with all its parts
- ✅ AC222: Crystal Flow streams run from owned mines to each side's Flow crystal when Flow is gained
- ✅ AC223: menu music on menus, match music in matches, crossfades, Mute silences both
- ✅ AC224: the music and sound effects volume sliders work and are remembered
- ✅ AC225: savings land in the bank piece
- ✅ AC226: the in-game editor (round 9b) is not built yet
- ✅ round 9a screenshots 844x390 › AC227: match at rest, raised card, open menu and a Crystal Flow stream render without errors (844x390)
- ✅ round 9c arena › AC228: the arena canvas draws every frame and the screen center is not the plain board color
- ✅ round 9c arena › AC229: all 57 owner effects (54 arena + 3 Crystal Flow), 2 cut-outs, no arena errors; unknown effect types are skipped
- ✅ round 9c menus 1920x1080 › AC233: main menu, Deck Builder and Choose Your Commander pieces sit in the owner boxes
- ✅ round 9c menus 1920x1080 › AC234: the intro plays first, the logo crashes in with dirt, owner sounds fire on time, then the main menu
- ✅ round 9c screenshots 1920x1080 › AC242: screenshots of the match with the arena, Commander close-ups, every menu screen and a creature close-up (1920x1080)
- ✅ round 9c screenshots 844x390 › AC242: screenshots of the match with the arena, Commander close-ups, every menu screen and a creature close-up (844x390)
- ✅ round 10 at 1920x1080 › AC243: drag highlights are bright in the faction color; attack squares are red
- ✅ round 10 at 1920x1080 › AC244: only the opponent's played cards pop up, at the left edge (Round 11)
- ✅ round 10 at 1920x1080 › AC246: the mine click area is only its own square; clicking inside it mines (Round 11)
- ✅ round 10 at 1920x1080 › AC249: Crystal Flow streams end at the Flow crystal counters in faction colors
- ✅ round 10 at 1920x1080 › AC250: card close-up fills 80–100 % of the height, no scrollbar, no Close; outside click and Esc close it
- ✅ round 10 at 1920x1080 › AC251: the resting hand is fully on screen (Round 17); hovering raises it
- ❌ round 10 at 1920x1080 › AC256: Round 10 screenshots render without errors
- ✅ round 11 at 1920x1080 › AC257: "Click to begin" gate, then the intro crash sound and thunder actually play
- ✅ round 11 at 1920x1080 › AC258: Tense Cycle plays continuously through every menu and only changes when a match starts
- ✅ round 11 at 1920x1080 › AC259: main menu button words are white, bold and styled as in menus.json
- ✅ round 11 at 1920x1080 › AC260: Settings "Square highlights" panel: defaults, live preview, saved, applied in a match, Reset to default
- ❌ round 11 at 1920x1080 › AC261: unit rings use faction colors, grey out after acting; "Unit rings" settings are saved and applied
- ✅ round 11 at 1920x1080 › AC262: a creature standing behind a mine can be selected by clicking it; the mine square still mines
- ✅ round 11 at 1920x1080 › AC263: only the opponent's played cards pop up, left edge, at most 3 stacked
- ✅ round 11 at 1920x1080 › AC264: dragging a card sideways in the hand reorders it, the hand stays up, and the order is kept
- ✅ round 11 at 1920x1080 › AC265: dragging a card shows the real card face, floating and tilting; the hand tucks while over the board
- ✅ round 11 at 1920x1080 › AC266: Ranged range 7 — the shot stops at the first unit, also your own
- ✅ round 11 at 1920x1080 › AC267: Round 11 screenshots render without errors
- ✅ round 12a drag-to-play at 1920x1080 › AC269: dragging Goblin Miner from the raised hand onto a legal home-row square summons it (1920x1080)
- ✅ round 12a drag-to-play at 1920x1080 › AC270: a drag from the tucked hand also plays; a drop back in the hand or on an illegal square plays nothing (1920x1080)
- ✅ round 12a drag-to-play at 1568x782 › AC269: dragging Goblin Miner from the raised hand onto a legal home-row square summons it (1568x782)
- ✅ round 12a drag-to-play at 1568x782 › AC270: a drag from the tucked hand also plays; a drop back in the hand or on an illegal square plays nothing (1568x782)
- ✅ round 12a at 1920x1080 › AC271: dragging a targeted spell onto an enemy casts it there; a Crystal card dragged over the board is played
- ✅ round 12a at 1920x1080 › AC273: owner card paintings and Grubnak's on-throne portrait are used unchanged
- ✅ round 12a at 1920x1080 › AC274: Round 12a screenshots render without errors
- ✅ round 12a hand layout at 1920x1080 › AC272: the raised hand is an even fan fully on screen, hovered card bigger (1920x1080)
- ✅ round 12a hand layout at 1568x782 › AC272: the raised hand is an even fan fully on screen, hovered card bigger (1568x782)
- ✅ round 12a hand layout at 1366x768 › AC272: the raised hand is an even fan fully on screen, hovered card bigger (1366x768)
- ✅ AC230: Commanders stand on the ground inside their strongholds, upright, facing the owner turn
- ✅ AC231: the stronghold never moves; Grubnak emotes in place and returns to his turn
- ✅ AC232: the owner menus file, pictures, sound and main menu picture are shipped
- ✅ AC235: a click skips the intro; Quit returns to it; How to Play opens Rules with a Tutorial button
- ✅ AC236: menu buttons go where the owner file says; the main menu picture is cover-fit
- ✅ AC237: menus play the music the owner file names (tense-cycle)
- ✅ AC238: saved deck entries glow in their faction color; the deck name text is white (Round 15)
- ✅ AC239: every creature card close-up has a 3D viewer; spells do not
- ✅ AC240: Play action in the Deck Builder (disabled with a reason while illegal); double-click a saved deck starts a match
- ✅ AC241: Deck Builder text colors: deck list lines and counts white, Back bold
- ✅ AC245: random mines may touch; every layout keeps the placement rules
- ✅ AC247: a basic Miner dying draws its owner a card; Smith Miners and upgrades do not
- ✅ AC248: Ranged straight lines also apply to previewAttack and the Commander
- ✅ AC252: mines have no ring, a flat glow-rubble decal that stays white (owner, Oct 24: the ground never changes color), and sit level at equal height
- ✅ AC253: several Crystal cards in one turn, in Deploy and Action, never ending the phase
- ✅ AC254: Tunnel from turn 1 — drag-and-drop next to a mine works and the AI uses the same rule
- ✅ AC275: creature model files are saved once with models.json; the game never calls Meshy
- ✅ AC276: Goblin Miner stands on the board as its new model with its gear and animations
- ✅ AC278: the Deck Builder 3D viewer shows the new Goblin Miner model with its animation buttons
- ✅ AC276: Boneknocker stands on the board as its new model with its gear and animations
- ✅ round 12d screenshots (1920x1080) › AC315: hand, close-up, Deck Builder, Choose Your Commander and reference cards render without errors
- ✅ Deck Builder top bar 1920x1080 › AC322: search, filters and Cards per row never overlap (1920x1080)
- ✅ Deck Builder top bar 1280x720 › AC322: search, filters and Cards per row never overlap (1280x720)
- ✅ Deck Builder top bar 844x390 › AC322: search, filters and Cards per row never overlap (844x390)
- ✅ title card stack 1920x1080 › AC323: the Begin gate shows a fanned Oreheart deck with Click to begin over it (1920x1080)
- ✅ title card stack 844x390 › AC323: the Begin gate shows a fanned Oreheart deck with Click to begin over it (844x390)
- ✅ AC278: the Deck Builder 3D viewer shows the new Boneknocker model with its animation buttons
- ✅ AC276: Shiv Rat stands on the board as its new model with its gear and animations
- ✅ AC278: the Deck Builder 3D viewer shows the new Shiv Rat model with its animation buttons
- ✅ AC276: Scrapsmith Miner stands on the board as its new model with its gear and animations
- ✅ AC278: the Deck Builder 3D viewer shows the new Scrapsmith Miner model with its animation buttons
- ✅ AC277: Goblin Miner plays its mine and walk animations
- ✅ AC279: seated Grubnak and his throne are saved once; the fortress and scepter are gone
- ✅ AC280: Grubnak sits on his junk throne as player and as enemy Commander, holding his staff
- ✅ AC281: the throne stands on the ground in the stronghold spot facing 146 degrees; Grubnak sits on it
- ✅ AC282: Choose Your Commander and the Deck Builder viewer show the seated Grubnak
- ✅ AC284: card data carries artPos framing (default 1/0/0) and the owner text
- ✅ AC285: Betty Fizzlebottom is archived: not on Choose Your Commander and not in any starter deck
- ✅ AC286: per-card Ranged ranges: Skullflinger 6, Gyronaut 2, Gunner 7, Hexslinger any distance but not through allies
- ✅ AC287: Starfall Cataclysm deals exactly 4 to everything in a 3x3 area
- ✅ AC288: Venom Shiv: 1 damage at the start of each of the target's next 7 turns, and no healing meanwhile
- ✅ AC289: SewerSlide Bomber pays 1, runs in a line until it hits something, then Ka-booms
- ✅ AC290: Scrapsmith Miner draws a card when it dies (its own text)
- ✅ AC291: Bare Knuckle Lunatic knocks every adjacent unit back 1 when defeated
- ✅ AC292: Backstabbing Thief steals 1 crystal for each enemy it defeats
- ✅ AC293: Bowler Brawler Strike (2) rolls a ball along a line; every creature on it is knocked 1-2 spaces sideways like a pin
- ✅ AC293: Bowler Brawler shows the owner's Strike text
- ✅ AC294: Junk Shaman pays 2 to move any character within 5 to a space within 5 of it
- ✅ AC295: Goblin Chef Smack knocks its target back 2 and is not Ranged
- ✅ AC296: Goblin Rocket Rider rides to any space, explodes 3x3 for its Attack, then attacks once; it is a Fighter (Round 14)
- ✅ AC297: Rat-Tunnel Ambush moves a creature next to a mine and it can still attack
- ✅ AC298: Voldawright Shockwave (1): adjacent enemies take 1 and are knocked back 1
- ✅ AC299: Glyphshield Warden gets Shield 1 each turn; Ward (2, once per turn) stops all damage to an ally for a round
- ✅ AC300: Gnome Plow (2) moves in a straight line and knocks creatures in its path aside 1-2 spaces
- ✅ AC301: Unweave cancels any enemy spell; Snuff Out only spells costing 3 or less
- ✅ AC302: Riot Shield Bearer can't move or attack and can't die for its first 3 turns
- ✅ AC303: Queen Brunhilda takes at most 3 from a hit; Bloodbeard Grit +1 Attack after surviving
- ✅ AC304: Gemdrunk Deepdelver gets +1 Attack per banked crystal; Grudge Hurler roots its target
- ✅ AC305: Ram Rider pays 2 to move any distance; Oathbound Overwatch attacks at any distance; Barrelback acts at once
- ✅ AC306: Ironclad Bulwark makes the next hit do 0; Field Bandage heals to full; Emergency Rations heals the Commander 4
- ✅ AC307: Crystal cards: Soul Shard +1, Soul Cluster +2, Heart +4, Motherlode +3 and next creature 2 cheaper, Geode +1 Flow each turn
- ✅ AC308: Desperate Plunder gives +3 Flow each turn while the opponent has more Flow, and stops once you have more
- ✅ AC309: every Round 12c card reports its ability as built, and close-ups show the owner text
- ✅ AC310: the game loads the owner card format and renders every layout at 420:624
- ✅ AC311: every card face uses the new renderer, and the old frames are gone
- ✅ AC312: the 8 reference cards render at 420x624 with their name and cost, and text fits
- ✅ AC313: a card's artPos is honored in the art layer
- ✅ AC314: the three card-format fonts are bundled locally and loaded
- ✅ AC316: spell faces show their name and text without dark boxes (Deck Builder and hand)
- ✅ AC317: every card face applies its owner artPos exactly
- ❌ AC318: units with activated abilities show a round ability button above them
- ✅ AC319: ability buttons are greyed when unaffordable, on enemy units, or already used
- ✅ AC320: clicking the Strike button and a target pays 2 and knocks the enemy sideways; hover shows the ability text
- ✅ AC321: Deck Builder — three Commander portraits by the title, no logo, other factions hidden not locked
- ✅ Round 13 screenshots 1920x1080 › AC325: title, Deck Builder with spells, hand with spells, spell close-up and an ability button render without errors
- ✅ round 14 owner text style 1920x1080 › AC326: every HUD text uses the owner's size, bold and italic, in white (1920x1080)
- ✅ round 14 owner text style 844x390 › AC326: every HUD text uses the owner's size, bold and italic, in white (844x390)
- ✅ round 14 Done text 1920x1080 › AC326: the Done button uses the owner's size 5.7 in white when it shows
- ✅ round 14 fanned hand 1920x1080 › AC327: your hand is a fan (4° per card, arc), hover straightens and pops the card 1.6x
- ✅ round 14 fanned hand 1920x1080 › AC328: the enemy hand is a fan of card backs, 9° apart, at most 6 shown
- ✅ round 14 crystal flow 1920x1080 › AC329: shards fly from the mine to each side's Flow crystal icon, which pulses on arrival
- ✅ round 15 unit badges 1920x1080 › AC335: every unit has the owner stat badge: faction metal frame, type icon, live white Russo One numbers under its feet
- ✅ round 15 screenshots 1920x1080 › AC337: facing, a miner at a node, the bowling ball, white-text menus and the unit badges render without errors
- ✅ round 17 fixes at 844x390 › AC346: Choose Your Commander fits a phone with nothing overlapping or cut off
- ❌ round 17 fixes at 844x390 › AC347: the hand is "Your hand" with data-card-id buttons, an even fan fully on screen, and a raised card never covers most of the board
- ✅ round 17 screenshots › AC348: fight menu with modes, a Card Play match with stances and a Card Comp vs Card Comp match render without errors (1920x1080)
- ✅ round 17 screenshots › AC348: fight menu with modes, a Card Play match with stances and a Card Comp vs Card Comp match render without errors (844x390)
- ✅ round 22 controls and hand 1920x1080 › AC357: left-click selects your unit and lights its squares, clicking a lit square moves it; right-click opens its card with its ability menu
- ✅ round 22 controls and hand 1920x1080 › AC358: clicking a hand card opens its close-up with Play this card; the dragged card hangs below-left of the pointer, tilted
- ❌ round 23 hand at 1920x1080 › AC363: the fan uses the owner layout — overlap 0.2, 4° per card, arc 1.45 (1920x1080)
- ❌ round 23 hand at 1920x1080 › AC364: grabbing a card tucks the rest of the hand, and it stays tucked after a play or a cancel (1920x1080)
- ✅ round 23 hand at 1920x1080 › AC365: the hand tucks within about a third of a second when the mouse leaves it, also onto the enlarged card (1920x1080)
- ❌ round 23 hand at 1366x768 › AC363: the fan uses the owner layout — overlap 0.2, 4° per card, arc 1.45 (1366x768)
- ❌ round 23 hand at 1366x768 › AC364: grabbing a card tucks the rest of the hand, and it stays tucked after a play or a cancel (1366x768)
- ✅ round 23 hand at 1366x768 › AC365: the hand tucks within about a third of a second when the mouse leaves it, also onto the enlarged card (1366x768)
- ✅ AC324: Knobbin and Thane Borgo can be picked and a match starts with the chosen Commander
- ✅ AC330: more shards per mine when that side's Flow is higher (2 at Flow 1 up to about 12)
- ✅ AC331: Corpsman Brewlord heals an adjacent wounded dwarf once per turn; the dwarf is Drunk for 2 rounds and can't be healed
- ✅ AC332: on the enemy's turn, Brewlord saves an adjacent dwarf from a lethal hit: it survives with 1 Health and is Drunk
- ✅ AC333: a unit faces the way it moved and keeps that facing a full round later (state and data-facing)
- ✅ AC334: an attacker faces its target and a miner faces the node it mined; both keep it one turn later
- ✅ AC336: badge numbers update with damage (and the Health number stays live text)
- ✅ AC338: Choose Your Commander has one visible Fight! button and the three modes; the mode is remembered; Standard is the default and unchanged
- ✅ AC339: in Card Play the player plays cards but can never move, attack or mine with units by hand; units act on their own
- ✅ AC340: Aggressive — a Fighter next to the enemy Commander hits it; a far Fighter moves toward it
- ❌ AC341: Mine Control — a Miner attacks an adjacent enemy Miner only if it survives, and mines when crystals are low
- ✅ AC342: Guard — Fighters stay within 2 spaces of the stronghold or a Miner and hit enemies that come near
- ✅ AC343: switching the stance mid-turn changes the next unit's choice
- ✅ AC344: a Card Comp vs Card Comp match plays to the end with no input; watch bar, stances and Rematch
- ❌ AC345: the four stance buttons sit on the right edge, vertically centered, big enough to tap (1920x1080 and 844x390)
- ✅ AC349: bonus draws — +1 card per 4 crystals mined, +1 for holding every mine
- ✅ AC350: the 12 new goblin models are copied in, meshopt-compressed and small
- ✅ AC351: every goblin unit shows its 3D model on the board, not a token (first eight)
- ✅ AC351: every goblin unit shows its 3D model on the board, not a token (last eight)
- ✅ AC352: items sit on the bones from the owner looks and every carried item is attached
- ✅ AC353: goblin models play walk, attack, hit and defeat with their own clips
- ✅ AC354: a model that fails to load falls back to the token and the match keeps going
- ✅ AC355: models load once and are reused; Gnome and Dwarf units without a model are unchanged
- ✅ AC357: Gnome and Dwarf units show their 3D models (character only); the clockwork beetle has no skeleton
- ✅ AC359: Bowler Brawler holds his flaming ball in his hand and spins it on a finger when idle
- ✅ AC360: Bowler Brawler bowls (Strike and attack): ball back, swing, release, roll along the ground; nothing clips; a new ball returns to his hand
- ❌ AC361: summoning Bowler Brawler plays his basketball shot: the ball flies up and lands dead (no bounce, no roll)
- ❌ AC362: every Crystal Node shows the owner look effects in its owner color; Low graphics keeps only the main glow
- ✅ AC366: flying units hover, bob and sway above their square with a ground shadow; walkers stand on the ground
- ✅ AC367: Gnome and Dwarf models have their own heights; the Clockwork Beetle slides when it moves
- ✅ AC368: Card Comp vs Card Comp watch bar sits bottom-right; Pause, Play and Exit to menu work
- ❌ AC369/AC370: Skullflinger plays Skull_Throw, a skull leaves his right hand at ~0.63 s, bonks the target and bounces away, all gone within 1.5 s
- ✅ AC371: Skullflinger's model keeps its 5 old clips plus Skull_Throw, and events.json gives the release time and bone

## Failures

```
✗ landscape phone viewport 844x390 › AC24: menu and full-screen match fit a 844x390 landscape phone
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 1
Received:    75.328125

  1189 |       await expect(field).toBeVisible();
  1190 |       const box = await field.boundingBox();
> 1191 |       expect(box.x).toBeLessThanOrEqual(1);
       |                     ^
  1192 |       expect(box.y).toBeLessThanOrEqual(1);
  1193 |       expect(box.x + box.width).toBeGreaterThanOrEqual(w - 1);
  1194 |       expect(box.y + box.height).toBeGreaterThanOrEqual(h - 1);
✗ landscape phone viewport 740x360 › AC24: menu and full-screen match fit a 740x360 landscape phone
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 1
Received:    50

  1189 |       await expect(field).toBeVisible();
  1190 |       const box = await field.boundingBox();
> 1191 |       expect(box.x).toBeLessThanOrEqual(1);
       |                     ^
  1192 |       expect(box.y).toBeLessThanOrEqual(1);
  1193 |       expect(box.x + box.width).toBeGreaterThanOrEqual(w - 1);
  1194 |       expect(box.y + box.height).toBeGreaterThanOrEqual(h - 1);
✗ AC58: tapping a mine mines with exactly the ready Miners next to it
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByRole('button', { name: 'Crystal site, row 4, column 6', exact: true })
Expected: "2"
Received: "1"
Timeout:  7000ms

Call log:
  - Expect "toHaveAttribute" with timeout 7000ms
  - waiting for getByRole('button', { name: 'Crystal site, row 4, column 6', exact: true })
    8 × locator resolved to <button data-row="4" data-col="6" data-mk="x1" type="button" data-ready-miners="1" class="site-mark ready" aria-label="Crystal site, row 4, column 6">…</button>
      - unexpected value "1"
✗ AC58: mineAt action matches the tap; hovering a mine only shows its info
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

  2247 |   expect((await act(page, { type: 'mineAt', row: M3.row, col: M3.col })).ok).toBe(true);
  2248 |   s = await getState(page);
> 2249 |   expect(at(s, 3, 6).hasMined && at(s, 5, 7).hasMined).toBe(true);
       |                                                        ^
  2250 |   expect(at(s, 3, 5).hasMined).toBe(false);
  2251 |   expect((await act(page, { type: 'mineAt', row: M3.row, col: M3.col })).ok).toBe(false); // nobody left there
  2252 | });
✗ round 4 phone screenshots (844x390) › AC134: mulligan, spell cards per faction, a creature close-up and a menu screen render without errors
TimeoutError: page.goto: Timeout 15000ms exceeded.
Call log:
  - navigating to "http://127.0.0.1:4173/?test=1&seed=123", waiting until "load"


  3 | // ---------- helpers ----------
  4 | async function openTest(page, seed = 123) {
> 5 |   await page.goto(`/?test=1&seed=${seed}`);
    |              ^
  6 |   await page.waitForFunction(() => !!window.oreheart);
  7 | }
  8 | // fixed mine layout used by setup tests (a legal "all three on row 4" layout)
✗ AC127: mulligan cards are double size, one row, on-screen (1280x720)
TimeoutError: locator.boundingBox: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: 'Mulligan' }).locator('[data-card-id]').first()


  3756 |     await page.waitForTimeout(600);
  3757 |     const boxes = [];
> 3758 |     for (let i = 0; i < 5; i++) boxes.push(await faces.nth(i).boundingBox());
       |                                                               ^
  3759 |     boxes.sort((a, b) => a.x - b.x);
  3760 |     for (const [i, b] of boxes.entries()) {
  3761 |       expect(b.height, `face ${i} height`).toBeGreaterThanOrEqual(vp.min);
✗ AC127: mulligan cards are double size, one row, on-screen (844x390)
TimeoutError: locator.boundingBox: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: 'Mulligan' }).locator('[data-card-id]').nth(2)


  3756 |     await page.waitForTimeout(600);
  3757 |     const boxes = [];
> 3758 |     for (let i = 0; i < 5; i++) boxes.push(await faces.nth(i).boundingBox());
       |                                                               ^
  3759 |     boxes.sort((a, b) => a.x - b.x);
  3760 |     for (const [i, b] of boxes.entries()) {
  3761 |       expect(b.height, `face ${i} height`).toBeGreaterThanOrEqual(vp.min);
✗ AC135: one font everywhere: Alegreya SC Italic, bundled, no metal or textured letters
Error: match

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "100 [style normal]",
+   "100 [style normal]",
+ ]
✗ AC138: every menu screen fills the window edge to edge at 844x390, 1280x720, 1920x1080 and rescales live
Error: title 844x390 at the top-left corner

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

  4055 |   }, screen);
  4056 |   expect(r.missing, `${where}: data-screen="${screen}"`).toBeUndefined();
> 4057 |   expect(Math.abs(r.x) <= 2 && Math.abs(r.y) <= 2, `${where} at the top-left corner`).toBe(true);
       |                                                                                       ^
  4058 |   expect(Math.abs(r.w - r.W) <= 2 && Math.abs(r.h - r.H) <= 2, `${where} ${r.w}x${r.h} fills ${r.W}x${r.H}`).toBe(true);
✗ AC149: the cover-fit painted view keeps both Commanders whole at every window shape (Round 8a)
Error: 1920x1200: cover-fit default view, both Commanders whole

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 7000ms exceeded while waiting on the predicate

  4350 |   for (const [W, H] of SHAPES_5B) {
  4351 |     await page.setViewportSize({ width: W, height: H });
✗ AC150: no black bars at any window shape
Error: 1920x1200 battlefield fills the window

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

  4391 |     await page.waitForTimeout(800);
  4392 |     const bf = await page.getByLabel('Battlefield', { exact: true }).boundingBox();
> 4393 |     expect(bf.x <= 1 && bf.y <= 1 && bf.width >= W - 2 && bf.height >= H - 2, `${W}x${H} battlefield fills the window`).toBe(true);
       |                                                                                                                         ^
  4394 |     expect(await blackEdges(page), `${W}x${H} black bars`).toEqual([]);
✗ AC168: bold titles and main actions, regular body text, only four weights
Error: title

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Play [style normal]",
+ ]

✗ arena homography 844x390 › AC188: square centers follow the homography of the owner's corners (844x390)
Error: square 1,1 x

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 3
Received:    75.32812499999994

  5460 |     const next = expectedCenter(layout, ar.arenaPicture, cam, r, c === 13 ? 12 : c + 1);
  5461 |     const tol = Math.max(3, 0.05 * Math.abs(next.x - want.x));
> 5462 |     expect(Math.abs(got.x - want.x), `square ${r},${c} x`).toBeLessThanOrEqual(tol);
       |                                                            ^
  5463 |     expect(Math.abs(got.y - want.y), `square ${r},${c} y`).toBeLessThanOrEqual(tol);
✗ arena pan 1920x1080 › AC191: keys, WASD and dragging empty board pan the view, always clamped to the painting
Test timeout of 30000ms exceeded.
✗ round 9a owner layout 844x390 › AC212: every HUD piece sits where the owner's layout puts it (844x390)
Error: enemy-deck x

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 4.9
Received:    75.51633333333336

  6233 |         const offY = H > fh ? ((p.y + p.h / 2) < 33.33 ? 0 : (p.y + p.h / 2) > 66.67 ? H - fh : (H - fh) / 2) : 0;
  6234 |         const want = { x: offX + p.x / 100 * fw, y: offY + p.y / 100 * fh, width: p.w / 100 * fw, height: p.h / 100 * fh };
> 6235 |         for (const k of ['x', 'y', 'width', 'height']) expect(Math.abs(got.rect[k] - want[k]), `${p.role} ${k}`).toBeLessThanOrEqual(W === 1920 ? W * 0.01 : tol);
       |                                                                                                                  ^
  6236 |         expect(Math.abs(norm360((got.rot || 0) - (p.rot || 0))), `${p.role} rot`).toBeLessThanOrEqual(3);
✗ AC176: the owner's card back and deck-pile pictures are used exactly
TimeoutError: locator.evaluate: Timeout 10000ms exceeded.
Call log:
  - waiting for getByLabel('Deck pile', { exact: true }).locator('img[src*="deck-pile"]').first()


  5182 |   return bad;
  5183 | });
> 5184 | const pileSize = (pile) => pile.locator('img[src*="deck-pile"]').first().evaluate((i) => [i.naturalWidth, i.naturalHeight]);
       |                                                                          ^
  5185 |
  5186 | test('AC176: the owner\'s card back and deck-pile pictures are used exactly', async ({ page }) => {
  5187 |   await start(page, quiet({ opponentHand: ['goblin-scrapper', 'fireball', 'soul-shard'], playerDeck: SHARDS, opponentDeck: SHARDS.slice(0, 5) }));
✗ AC190: cover-fit with no black bars at 16:9, 4:3, 21:9 and phone; max zoom about 2.5 px per painting pixel
Error: 1600x1200 cover scale

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 0.01
Received:    0.24960127591706535

  5612 |     const c = await camera(page);
  5613 |     expect(c.zoom, `${W}x${H} zoom`).toBeCloseTo(1, 3);
> 5614 |     expect(Math.abs(c.minScale - cover) / cover, `${W}x${H} cover scale`).toBeLessThanOrEqual(0.01);
       |                                                                           ^
  5615 |     expect(Math.abs(c.scale - cover) / cover).toBeLessThanOrEqual(0.01);
✗ AC191: at zoom 1 on a 4:3 window the view pans sideways but never past the edges
Error: expect(received).toBeLessThan(expected)

Expected: < -20
Received:   0

  5693 |   await page.waitForTimeout(800);
  5694 |   const v1 = (await camera(page)).view;
> 5695 |   expect(v1.x).toBeLessThan(v0.x - 20);
       |                ^
  5696 |   expect(v1.x).toBeGreaterThanOrEqual(-0.5);
  5697 |   for (let i = 0; i < 120; i++) await page.keyboard.press('ArrowRight');
  5698 |   await page.waitForTimeout(800);
✗ AC196: the player Commander faces the opponent and turns back after a look-back
Error: Timeout 10000ms exceeded while waiting on the predicate

  5846 | test('AC196: the player Commander faces the opponent and turns back after a look-back', async ({ page }) => {
  5847 |   await start(page, { ...quiet({ playerHand: HAND_R7, playerCrystals: 4, board: BOARD_5B }), firstPlayer: 'player' });
> 5848 |   await expect.poll(async () => (await cmdEntry(page, 'player')).emoteLog, { timeout: 10000 }).toContain('lookBack');
       |   ^
  5849 |   await expect.poll(async () => { const c = await cmdEntry(page, 'player'); return c.facingDeg <= 15 && c.emote === 'none'; }, { timeout: 10000, message: 'back to facing the opponent' }).toBe(true);
  5850 |   const p = await cmdEntry(page, 'player');
  5851 |   expect(p.turnMs).toBeGreaterThanOrEqual(400);
    at /home/runner/work/Starter/Starter/factory/.run-tests/acceptance.spec.mjs:5848:3
✗ AC197: impatience starts after about 20 s idle and stops on an action
Error: not impatient after 10 s

expect(received).not.toBe(expected) // Object.is equality

Expected: not "impatient"

  5859 |   await page.evaluate(async () => await window.oreheart.advanceIdle(10));
  5860 |   await page.waitForTimeout(300);
> 5861 |   expect((await cmdEntry(page, 'player')).emote, 'not impatient after 10 s').not.toBe('impatient');
       |                                                                                  ^
  5862 |   await page.evaluate(async () => await window.oreheart.advanceIdle(11));
  5863 |   await expect.poll(async () => { const c = await cmdEntry(page, 'player'); return c.emote === 'impatient' && c.facingDeg >= 120; }, { timeout: 5000 }).toBe(true);
✗ AC206: choosing a Commander hides the other two and shows only his decks; Change Commander, Esc and a second click bring the row back
Test timeout of 30000ms exceeded.
✗ round 10 at 1920x1080 › AC256: Round 10 screenshots render without errors
Test timeout of 30000ms exceeded.
✗ round 11 at 1920x1080 › AC261: unit rings use faction colors, grey out after acting; "Unit rings" settings are saved and applied
Test timeout of 30000ms exceeded.
✗ AC318: units with activated abilities show a round ability button above them
Error: expect(received).toBeLessThan(expected)

Expected: < 390.60154834540884
Received:   402.328125

  8626 |   const b = await strike.boundingBox();
  8627 |   expect(Math.abs(b.x + b.width / 2 - c.x)).toBeLessThanOrEqual(Math.abs(n.x - c.x) * 0.6 + 2);
> 8628 |   expect(b.y + b.height / 2).toBeLessThan(c.y);
       |                              ^
  8629 |   const list = await page.evaluate(async () => await window.oreheart.getAbilityButtons());
  8630 |   expect(list.some((x) => x.ability === 'strike' && x.cardId === 'goblin-scrapper' && x.cost === 2 && x.enabled === true)).toBe(true);
  8631 |   expect(list.some((x) => x.ability === 'pickUp' && x.cardId === 'junk-shaman')).toBe(true);
✗ round 17 fixes at 844x390 › AC347: the hand is "Your hand" with data-card-id buttons, an even fan fully on screen, and a raised card never covers most of the board
Error: every hand card fully on screen at rest

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 4000ms exceeded while waiting on the predicate

  9317 |     const cards = page.getByLabel('Your hand', { exact: true }).locator('button[data-card-id]');
  9318 |     await expect(cards).toHaveCount(5);
✗ round 23 hand at 1920x1080 › AC363: the fan uses the owner layout — overlap 0.2, 4° per card, arc 1.45 (1920x1080)
Error: gap 1

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 0.23
Received:    0.5400149835066268

  9787 |         const gap = fan[i].cx - fan[i - 1].cx;
  9788 |         expect(gap / w, `gap ${i}`).toBeGreaterThanOrEqual(0.17);
> 9789 |         expect(gap / w, `gap ${i}`).toBeLessThanOrEqual(0.23);
       |                                     ^
  9790 |       }
✗ round 23 hand at 1920x1080 › AC364: grabbing a card tucks the rest of the hand, and it stays tucked after a play or a cancel (1920x1080)
Test timeout of 30000ms exceeded.
✗ round 23 hand at 1366x768 › AC363: the fan uses the owner layout — overlap 0.2, 4° per card, arc 1.45 (1366x768)
Error: gap 1

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 0.23
Received:    0.5400528291458332

  9787 |         const gap = fan[i].cx - fan[i - 1].cx;
  9788 |         expect(gap / w, `gap ${i}`).toBeGreaterThanOrEqual(0.17);
> 9789 |         expect(gap / w, `gap ${i}`).toBeLessThanOrEqual(0.23);
       |                                     ^
  9790 |       }
✗ round 23 hand at 1366x768 › AC364: grabbing a card tucks the rest of the hand, and it stays tucked after a play or a cancel (1366x768)
Error: Timeout 2000ms exceeded while waiting on the predicate

  9806 |       // hover raises the hand
  9807 |       await r23HoverCard(page, 6);
> 9808 |       await expect.poll(async () => median(await r23Tops(page)), { timeout: 2000 }).toBeLessThan(restTop - 20);
       |       ^
  9809 |       // grab the Miner (last card) and drag toward the back row in steps
  9810 |       const target = await sqCenter(page, 7, 6);
  9811 |       const from = await r23HoverCard(page, 6);
    at /home/runner/work/Starter/Starter/factory/.run-tests/acceptance.spec.mjs:9808:7
✗ AC341: Mine Control — a Miner attacks an adjacent enemy Miner only if it survives, and mines when crystals are low
Error: expect(received).toBe(expected) // Object.is equality

Expected: "attack"
Received: "mine"

  9195 |   await toAction(page);
  9196 |   let ch = await stanceChoice(page, uid);
> 9197 |   expect(ch.type).toBe('attack');
       |                   ^
  9198 |   expect(sameTarget(ch.target, 5, 5)).toBe(true);
  9199 |   // would die in the trade (1/1 vs 1/1) -> mines instead
  9200 |   s = await start(page, cardPlay({ ...base, board: board(false) }, 'minecontrol'));
✗ AC345: the four stance buttons sit on the right edge, vertically centered, big enough to tap (1920x1080 and 844x390)
Error: 1920x1080 Aggressive on screen

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 1921
Received:    2062

  9276 |     for (const [i, b] of boxes.entries()) {
  9277 |       expect(b.x + b.width, `${W}x${H} ${STANCES[i]} at the right edge`).toBeGreaterThanOrEqual(W * 0.9);
> 9278 |       expect(b.x + b.width, `${W}x${H} ${STANCES[i]} on screen`).toBeLessThanOrEqual(W + 1);
       |                                                                  ^
  9279 |       expect(b.height, `${W}x${H} ${STANCES[i]} height`).toBeGreaterThanOrEqual(W >= 1920 ? 60 : 40);
✗ AC361: summoning Bowler Brawler plays his basketball shot: the ball flies up and lands dead (no bounce, no roll)
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 20000ms exceeded while waiting on the predicate

  9693 |   expect((await act(page, sum)).ok).toBe(true);
  9694 |   const uid = at(await getState(page), sum.row, sum.col).uid;
> 9695 |   await expect.poll(async () => ((await renderStats(page)).creatureAnimLog || []).some((e) => e.uid === uid && e.anim === 'basketShot'), { timeout: 20000 }).toBe(true);
       |   ^
✗ AC362: every Crystal Node shows the owner look effects in its owner color; Low graphics keeps only the main glow
Error: Test timeout of 30000ms exceeded

  9734 |   await page.evaluate(() => window.oreheart.setGraphics('low'));
  9735 |   await newMatch(page, { ai: false, playerCommander: 'grubnak', opponentCommander: 'borgo', setup: { opponentHand: [] } });
> 9736 |   await expect.poll(async () => ((await renderStats(page)).mineModels || []).length, { timeout: 15000 }).toBe(3);
       |   ^
  9737 |   for (const m of (await renderStats(page)).mineModels) {
  9738 |     expect(m.effects.length).toBe(1);
  9739 |     expect(m.effects[0]).toMatchObject({ name: 'Glow', type: 'glow' });
    at /home/runner/work/Starter/Starter/factory/.run-tests/acceptance.spec.mjs:9736:3
✗ AC369/AC370: Skullflinger plays Skull_Throw, a skull leaves his right hand at ~0.63 s, bonks the target and bounces away, all gone within 1.5 s
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 700
Received:    1090.6000000000001

  9965 |   expect(p.spawnOffset, 'spawned at the RightHand bone').toBeLessThanOrEqual(0.1);
  9966 |   expect(p.contactMs - p.releaseMs, 'lobbed flight time').toBeGreaterThanOrEqual(250);
> 9967 |   expect(p.contactMs - p.releaseMs).toBeLessThanOrEqual(700);
       |                                     ^
  9968 |   expect(p.removedMs - p.releaseMs, 'removed within 1.5 s of the throw').toBeLessThanOrEqual(1500);
  9969 |   expect(p.maxHeightAfterContact, 'bounces up after the bonk').toBeGreaterThan(p.heightAtContact + 0.05);
  9970 |   expect(((await renderStats(page)).projectiles || []).filter((q) => q.shooterUid === sl.uid)).toEqual([]);
```