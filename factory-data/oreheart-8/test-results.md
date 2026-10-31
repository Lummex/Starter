# Automated check results

554 of 570 checks passed after 5 build round(s).

- ✅ landscape phone viewport 844x390 › AC24: menu and full-screen match fit a 844x390 landscape phone
- ✅ landscape phone viewport 740x360 › AC24: menu and full-screen match fit a 740x360 landscape phone
- ✅ landscape phone viewport 667x375 › AC24: menu and full-screen match fit a 667x375 landscape phone
- ✅ portrait phone viewport › AC24: upright phone shows the rotate message
- ✅ computer browser window, tall and narrow › AC24b: a computer window never shows the rotate message and keeps the 16:9 shape
- ✅ AC1: main menu has exactly Play, Deck Builder, How to Play, Settings, Quit and no page errors
- ✅ AC1: starting a test-mode match causes no page errors
- ✅ AC2: menu -> choose Commander -> mulligan -> match
- ✅ AC3: Rules page with pictures and Back
- ✅ AC4: Settings graphics toggle switches and persists
- ✅ AC5: window.oreheart only in test mode; seeds are deterministic
- ✅ AC6: grubnak Warband starter deck is 60 cards: 22 Miners, 48 creatures, 8 spells, 4 Crystal cards
- ✅ AC6: sproingle Warband starter deck is 60 cards: 22 Miners, 48 creatures, 8 spells, 4 Crystal cards
- ✅ AC6: borgo Warband starter deck is 60 cards: 22 Miners, 48 creatures, 8 spells, 4 Crystal cards
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
- ✅ AC11: Tunnel only onto empty spaces next to a mine your side owns; nothing beside a neutral or enemy mine (Ken, Oct 31)
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
- ✅ AC25: first visit offers the tutorial; Skip is remembered
- ❌ AC25: Tutorial button opens the guided match with tips and Skip Tutorial
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
- ✅ landscape layout details › AC43: the hand rests fully on screen at the bottom and rises on hover (Round 17)
- ✅ landscape layout details › AC44: deck piles on each player's right and Commander hearts
- ✅ hearts and turn display 844x390 › AC51: Commander hearts never cover creature labels; turn display top-right (844x390)
- ✅ hearts and turn display 740x360 › AC51: Commander hearts never cover creature labels; turn display top-right (740x360)
- ✅ hearts and turn display 667x375 › AC51: Commander hearts never cover creature labels; turn display top-right (667x375)
- ✅ hand pop-out at 2x › AC59: a hovered hand card rises to about 1.6x and stays fully on-screen
- ✅ phone-size match screenshot › AC90: the match screen renders full screen at 844x390 with no page errors
- ✅ AC36: flow preview, mine ring numbers and mine info
- ✅ AC38: swapping places with your own creature uses only the dragged creature's action
- ✅ AC37: the confirm pop-up sits above the countdown
- ✅ AC40: 13 x 7 board; 3 random, corner-mirrored mines from the seed; Strongholds at (7,2) and (1,12); fixed tutorial layout
- ✅ AC41: the moves drop-up says miners have not mined; after any move Done asks nothing (Round 26)
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
- ✅ AC50: Smith Miners never Tunnel; a basic Miner Tunnels only beside a mine the player owns; no Tunnel! tag on any card (Ken, Oct 31)
- ✅ AC52: one crystal type — two counters only; Heart of the Fallen puts 4 into the Bank
- ✅ AC53: the Respond pop-up has a standalone "Play Soul Cluster" button that keeps it open
- ✅ AC54: nothing can mine from 2 spaces away — only the 8 adjacent spaces
- ✅ AC55: casting a spell shows "GRUBNAK CASTS SEARING ARCANE ORB!" over the Stronghold; Commanders never attack
- ✅ AC56: Settings has "Card reveals: Normal" / "Fast", saved across reloads
- ✅ AC57: the Commander picker uses the new Commander names
- ✅ AC58: tapping a mine mines with exactly the ready Miners next to it
- ✅ AC58: mineAt action matches the tap; hovering a mine only shows its info
- ✅ AC60: Deck Builder shows card faces with full text and filters them
- ✅ AC61: Deck Builder problems use the exact messages and counts
- ✅ AC62: up to 5 saved decks persist after a reload
- ✅ AC64: Deploy auto-skips with an unplayable hand; Action skips once nothing can act
- ✅ AC64: Done with only a Crystal card, an Instant or an unplaceable card shows no pop-up
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
- ✅ AC75 + AC125: the tutorial runs to the end, teaching only the current rules
- ✅ AC76: the Last turn recap lists what the enemy did
- ✅ AC77: a mine with ready Miners shows the swinging pickaxe count; it goes once they mined
- ✅ AC79: main menu shows the logo as the h1, the tagline and the five plaques
- ✅ AC80: every Goblin creature has a finished figure; Gnomes and Dwarves are finished when they have a model, else placeholders
- ✅ AC82: every card has a tagline and a flavor line
- ❌ AC84: finished Goblin figures, Grubnak, Strongholds and mines on the battlefield
- ✅ AC85: poking a Goblin figure plays a reaction and changes nothing
- ✅ AC86: CREDITS.md lists fonts, card pictures and every outside asset file
- ✅ AC87: sound stays locked until the first tap
- ✅ AC88: volume sliders and the match mute button are remembered
- ✅ AC89: Low graphics turns off bloom, shadows and particles and uses fewer draw calls
- ✅ AC90: the built dist folder stays under 250 MB
- ✅ AC93: the cut-out deck image is used on every deck pile outside the match
- ✅ AC95: Redraw Hand = the whole hand back and a same-size new hand from the reshuffled deck, once; part of a hand is never legal
- ✅ AC406: Keep Hand leaves the opening hand exactly as it was
- ✅ AC407: the computer redraws a hand with no affordable fighter and keeps a workable one
- ✅ AC95: the Mulligan screen shows one straight row, Keep Hand / Redraw Hand, and Redraws left: 1
- ✅ AC408: How to Play tells the new rule, not the old 5-4-3 one
- ✅ AC97: card reveals never block the game and can be pinned
- ✅ AC98: right-clicking a creature shows its card and changes nothing; left-click only selects (owner, Oct 25)
- ✅ AC99: the Card pop-ups switch skips reveals but never effects, and is remembered
- ✅ display mode on a PC window › AC103: Display mode Auto / PC / Phone, remembered, without extra menu buttons
- ✅ straight-on road board and corner HUD at 844x390 › AC104: straight-on road perspective, Commanders in the corners, HUD around them
- ✅ straight-on road board and corner HUD at 844x390 › AC105: the enemy hand is smaller than the player hand
- ✅ both hands at 844x390 › AC115: the enemy hand is always on-screen and the hand shows all 15 cards in a dock row (Ken, Oct 30)
- ✅ both hands at 844x390 › AC116: a right-clicked creature shows its card at hovered-hand-card size, fully on-screen
- ✅ both hands at 844x390 › AC117: the deck picker shows the starter decks as named stacks
- ✅ title layout and ornaments › AC123: "Welcome to Oreheart!" never overlaps the logo or the Tutorial button; no frame ornaments on any screen (844x390)
- ✅ title layout and ornaments › AC123: "Welcome to Oreheart!" never overlaps the logo or the Tutorial button; no frame ornaments on any screen (1280x720)
- ✅ round 4 phone screenshots (844x390) › AC134: mulligan, spell cards per faction, a creature close-up and a menu screen render without errors
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
- ✅ AC100: spells play step by step and nothing vanishes without a cause
- ✅ AC101: SewerSlide Bomber carries a bomb: drop, KA-BOOM, then 1 damage to the adjacent enemy
- ✅ AC102: the Respond pop-up only lists playable options
- ✅ AC106: zoom in, drag-to-attack still works, Re-center resets
- ✅ AC108: title screen uses the painted cavern background with the logo, without errors
- ✅ AC109: Strongholds stand in the corners: player (7,2), enemy (1,12)
- ✅ AC110: random mines are always corner-mirrored, fair, away from both Strongholds and never on the same square
- ✅ AC111: decks of 50 to 100 cards and at most 20 Crystal cards
- ✅ AC112/AC128: twelve legal 60-card starter decks: Warband, Mine Rush, Arcane Hoard and Expedition for each faction
- ✅ AC417: every starter deck is exactly 60 cards, legal for its Commander, and a match deals from it
- ✅ AC113: matches use the chosen starter decks; the opponent deck can be any of the four
- ✅ AC114: the computer plays the Warband style to the end of a match
- ✅ AC114: the computer plays the Mine Rush style to the end of a match
- ✅ AC114: the computer plays the Arcane Hoard style to the end of a match
- ✅ AC114: the computer plays the Expedition style to the end of a match
- ✅ AC121: Deck Builder deck art has no frame; painted background
- ✅ AC122: one ornate control style everywhere: no default browser controls or scrollbars
- ✅ AC124: every spell has its own visual, played step by step
- ✅ AC127: mulligan cards are double size, one row, on-screen (1280x720)
- ✅ AC127: mulligan cards are double size, one row, on-screen (844x390)
- ✅ AC129: faction spells — names, factions, deck validation and the casting lock
- ✅ AC131: Venom Shiv poisons for 7 of the target’s turns (1 damage each, no healing); Hex Reversal is disabled
- ✅ AC135: one font everywhere: Alegreya SC Italic, bundled, no metal or textured letters
- ✅ AC136: cards are never stretched (Deck Builder at 2 and 8 per row, mulligan, hand) at several window sizes
- ✅ AC137: menu buttons are plain white text with a hover glow, no boxes or borders
- ✅ AC138: every menu screen fills the window edge to edge at 844x390, 1280x720, 1920x1080 and rescales live
- ✅ AC140: the cards-per-row slider goes from 2 to 8
- ✅ AC141: the deck carousel shows only my decks plus a New Deck slot; arrows, keys and dragging pick the deck
- ✅ AC142: a card dragged from the grid shows at its 3-per-row size and lands in the deck
- ✅ AC143: the deck list always shows about 8 rows; it scrolls inside its panel
- ✅ AC144: starter decks can be removed (in-game confirm) and restored; at least one deck always remains
- ✅ AC145: Copy to my decks makes an editable saved copy and leaves the starter deck unchanged; my decks can be removed
- ✅ AC146: Choose Your Commander: big glowing Commander cards that stand out, big decks and text, filling the screen
- ✅ AC149: the cover-fit painted view keeps both Commanders whole at every window shape (Round 8a)
- ✅ AC150: no black bars at any window shape
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
- ✅ AC168: bold titles and main actions, regular body text, only four weights
- ✅ round 6a screenshots (1920x1080) › AC173: match with hand at rest and popped out, deck builder close-up and card back render without errors (1920x1080)
- ✅ round 6a screenshots (844x390) › AC173: match with hand at rest and popped out, deck builder close-up and card back render without errors (844x390)
- ✅ round 7 hand (1920x1080) › AC174: hovered hand cards always retract; only one pops at a time; nothing stays stuck (1920x1080)
- ✅ round 7 hand (1920x1080) › AC175: hand cards follow the owner layout (about 34% of the height), fully on screen at rest (1920x1080)
- ✅ round 7 hand (844x390) › AC174: hovered hand cards always retract; only one pops at a time; nothing stays stuck (844x390)
- ✅ round 7 hand (844x390) › AC175: hand cards follow the owner layout (about 34% of the height), fully on screen at rest (844x390)
- ✅ round 7 screenshots (1920x1080) › AC184: Grubnak in a match and in the 3D viewer render without errors
- ✅ arena homography 1920x1080 › AC188: square centers follow the homography of the owner's corners (1920x1080)
- ✅ arena homography 844x390 › AC188: square centers follow the homography of the owner's corners (844x390)
- ✅ arena highlights 1920x1080 › AC189: drag highlights are the legal summon squares on the painted floor; drop uses the mapping
- ✅ arena pan 1920x1080 › AC191: keys, WASD and dragging empty board pan the view, always clamped to the painting
- ✅ arena HUD 1920x1080 › AC192: the HUD stays fixed while zooming and panning; Recenter and double-click reset the view
- ✅ arena drags 1920x1080 › AC194: dragging a hand card or a creature never pans the view
- ✅ round 8a screenshots 1920x1080 › AC195: the painted arena match fully zoomed out and zoomed in renders without errors (1920x1080)
- ✅ round 8a screenshots 844x390 › AC195: the painted arena match fully zoomed out and zoomed in renders without errors (844x390)
- ✅ hand never rises while dragging 1920x1080 › AC200: dragging a creature or panning across the hand never raises it
- ✅ round 8b pop-out 1920x1080 › AC201: the pop-out is about 70% of the window height, eased 150-200 ms (1920x1080)
- ✅ round 8b pop-out 844x390 › AC201: the pop-out is about 70% of the window height, eased 150-200 ms (844x390)
- ✅ round 9a owner layout 1920x1080 › AC212: every HUD piece sits where the owner's layout puts it (1920x1080)
- ✅ round 9a owner layout 844x390 › AC212: every HUD piece sits where the owner's layout puts it (844x390)
- ✅ round 9a hand 1920x1080 › AC218: hovering raises the whole card, neighbors move aside, moving across shuffles (1920x1080)
- ✅ round 9a hand 844x390 › AC218: hovering raises the whole card, neighbors move aside, moving across shuffles (844x390)
- ✅ round 9a screenshots 1920x1080 › AC227: match at rest, raised card, open menu and a Crystal Flow stream render without errors (1920x1080)
- ✅ round 9a screenshots 844x390 › AC227: match at rest, raised card, open menu and a Crystal Flow stream render without errors (844x390)
- ❌ round 9c arena › AC228: the arena canvas draws every frame and the screen center is not the plain board color
- ✅ round 9c arena › AC229: all 57 owner effects (54 arena + 3 Crystal Flow), 2 cut-outs, no arena errors; unknown effect types are skipped
- ✅ AC169: Deck Builder close-up fills the height, has no scrollbar or Close, and dismisses on click or Esc
- ✅ AC170: deck list + and - change counts at once, without moving the row; rapid clicks all count
- ✅ AC171: no "All cards" text and no corner ornaments on any menu screen
- ✅ AC172: crystal mines use the owner's Crystal Node model, about 1.3 squares tall and inside its square, in the owner's faction color; unowned mines are white (owner, Oct 24)
- ✅ AC176: the owner's card back and deck-pile pictures are used exactly
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
- ✅ AC190: cover-fit with no black bars at 16:9, 4:3, 21:9 and phone; max zoom about 2.5 px per painting pixel
- ✅ AC191: at zoom 1 on a 4:3 window the view pans sideways but never past the edges
- ✅ AC193: the Meshy crystal mine is saved once and used for every mine, tinted by owner
- ✅ AC196: the player Commander faces the opponent and turns back after a look-back
- ✅ AC197: impatience starts after about 20 s idle and stops on an action
- ✅ AC198: the hand glow is brightest at the card edge and fades outward
- ✅ AC199: the hand hover box fits 1 card(s) and a point above it does not raise the hand
- ✅ AC199: the hand hover box fits 4 card(s) and a point above it does not raise the hand
- ✅ AC199: the hand hover box fits 8 card(s) and a point above it does not raise the hand
- ✅ AC203: dragging a card onto the deck list adds one copy; a plain click opens the close-up
- ✅ AC204: adding cards by double-click, drag and + never moves the panel, the grid or the cards
- ✅ AC205: every deck entry on Choose Your Commander has the same size, also for long names and when selected
- ✅ AC206: choosing a Commander hides the other two and shows only his decks; the arrows page on, Esc brings the row back, a second click keeps him selected
- ✅ AC207: choosing Grubnak shows only his card, selected: no 3D model pops up
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
- ✅ AC230: Commanders stand on the ground inside their strongholds, upright, facing the owner turn
- ❌ AC231: the stronghold never moves; Grubnak emotes in place and returns to his turn
- ✅ AC232: the owner menus file, pictures, sound and main menu picture are shipped
- ✅ round 9c menus 1920x1080 › AC233: main menu, Deck Builder and Choose Your Commander pieces sit in the owner boxes
- ✅ round 9c menus 1920x1080 › AC234: the intro plays first, the logo crashes in with dirt, owner sounds fire on time, then the main menu
- ✅ round 9c screenshots 1920x1080 › AC242: screenshots of the match with the arena, Commander close-ups, every menu screen and a creature close-up (1920x1080)
- ✅ round 9c screenshots 844x390 › AC242: screenshots of the match with the arena, Commander close-ups, every menu screen and a creature close-up (844x390)
- ✅ round 10 at 1920x1080 › AC243: drag highlights are bright in the faction color; attack squares are red
- ✅ round 10 at 1920x1080 › AC244: only the opponent's played cards pop up, big in the middle, then onto the enemy discard pile at the left (owner, Oct 30)
- ✅ round 10 at 1920x1080 › AC246: the mine click area is only its own square; clicking inside it mines (Round 11)
- ✅ round 10 at 1920x1080 › AC249: Crystal Flow streams end at the Flow crystal counters in faction colors
- ✅ round 10 at 1920x1080 › AC250: card close-up fills 80–100 % of the height, no scrollbar, a ✕ Close (owner, Oct 30); outside click and Esc close it
- ✅ round 10 at 1920x1080 › AC251: the resting hand is fully on screen (Round 17); hovering raises it
- ✅ round 10 at 1920x1080 › AC256: Round 10 screenshots render without errors
- ✅ round 11 at 1920x1080 › AC257: "Click to begin" gate, then the intro crash sound and thunder actually play
- ✅ round 11 at 1920x1080 › AC258: Tense Cycle plays continuously through every menu and only changes when a match starts
- ✅ round 11 at 1920x1080 › AC259: main menu button words are white, bold and styled as in menus.json
- ✅ round 11 at 1920x1080 › AC260: Settings "Square highlights" panel: defaults, live preview, saved, applied in a match, Reset to default
- ✅ round 11 at 1920x1080 › AC261: unit rings use faction colors, grey out after acting; "Unit rings" settings are saved and applied
- ✅ round 11 at 1920x1080 › AC262: a creature standing behind a mine can be selected by clicking it; the mine square still mines
- ✅ round 11 at 1920x1080 › AC263: only the opponent's played cards pop up, one big card at a time, all laid on the enemy discard pile (owner, Oct 30)
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
- ✅ AC254: Tunnel — drag-and-drop next to an owned mine works and the AI uses the same rule
- ✅ AC275: creature model files are saved once with models.json; the game never calls Meshy
- ✅ AC276: Goblin Miner stands on the board as its new model with its gear and animations
- ✅ AC278: the Deck Builder 3D viewer shows the new Goblin Miner model with its animation buttons
- ✅ AC276: Boneknocker stands on the board as its new model with its gear and animations
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
- ✅ round 12d screenshots (1920x1080) › AC315: hand, close-up, Deck Builder, Choose Your Commander and reference cards render without errors
- ✅ Deck Builder top bar 1920x1080 › AC322: search, filters and Cards per row never overlap (1920x1080)
- ✅ Deck Builder top bar 1280x720 › AC322: search, filters and Cards per row never overlap (1280x720)
- ✅ Deck Builder top bar 844x390 › AC322: search, filters and Cards per row never overlap (844x390)
- ✅ title card stack 1920x1080 › AC323: the Begin gate shows a fanned Oreheart deck with Click to begin over it (1920x1080)
- ✅ title card stack 844x390 › AC323: the Begin gate shows a fanned Oreheart deck with Click to begin over it (844x390)
- ✅ Round 13 screenshots 1920x1080 › AC325: title, Deck Builder with spells, hand with spells, spell close-up and an ability button render without errors
- ✅ round 14 owner text style 1920x1080 › AC326: every HUD text uses the owner's size, bold and italic, in white (1920x1080)
- ✅ round 14 owner text style 844x390 › AC326: every HUD text uses the owner's size, bold and italic, in white (844x390)
- ✅ round 14 Done text 1920x1080 › AC326: the Done button uses the owner's size 5.7 in white when it shows
- ✅ round 14 fanned hand 1920x1080 › AC327: your hand is a flat fan (at most 1.4° per card, no arc; Ken, Oct 30), hover straightens and pops the card 1.6x
- ✅ round 14 fanned hand 1920x1080 › AC328: the enemy hand is a fan of card backs, 9° apart, at most 6 shown
- ✅ round 14 crystal flow 1920x1080 › AC329: shards fly from the mine to each side's Flow crystal icon, which pulses on arrival
- ✅ round 15 unit badges 1920x1080 › AC335: every unit has the owner stat badge: faction metal frame, type icon, live white Russo One numbers under its feet
- ✅ round 15 screenshots 1920x1080 › AC337: facing, a miner at a node, the bowling ball, white-text menus and the unit badges render without errors
- ✅ round 17 fixes at 844x390 › AC346: Choose Your Commander fits a phone with nothing overlapping or cut off
- ✅ round 17 fixes at 844x390 › AC347: the hand is "Your hand" with data-card-id buttons, an even fan fully on screen, and a raised card never covers most of the board
- ✅ round 17 screenshots › AC348: fight menu with modes, a Card Play match with stances and a Card Comp vs Card Comp match render without errors (1920x1080)
- ✅ round 17 screenshots › AC348: fight menu with modes, a Card Play match with stances and a Card Comp vs Card Comp match render without errors (844x390)
- ✅ round 22 controls and hand 1920x1080 › AC357: left-click selects your unit and lights its squares, clicking a lit square moves it; right-click opens its card with its ability menu
- ✅ round 22 controls and hand 1920x1080 › AC358: clicking a hand card opens its close-up with Play this card, then a click on a highlighted square plays it
- ✅ AC295: Goblin Chef Smack knocks its target back 2 and is not Ranged
- ✅ AC296: Goblin Rocket Rider rides to any space, explodes 3x3 for its Attack, then attacks once; it is a Fighter (Round 14)
- ✅ AC297: Rat-Tunnel Ambush moves a creature next to a mine and it can still attack
- ✅ AC298: Voldawright Shockwave (1): adjacent enemies take 1 and are knocked back 1
- ✅ AC299: Glyphshield Warden gets Shield 1 each turn; Ward (2, once per turn) stops all damage to an ally for a round
- ✅ AC300: Gnome Plow (2) moves in a straight line and knocks creatures in its path aside 1-2 spaces
- ✅ AC301: Unweave cancels any enemy spell; Snuff Out only spells costing 3 or less
- ✅ AC302: Riot Shield Bearer can't attack and can't die for its first 3 turns, but it can still move
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
- ✅ AC318: units with activated abilities show a round ability button above them
- ✅ AC319: ability buttons are greyed when unaffordable, on enemy units, or already used
- ✅ AC320: clicking the Strike button and a target pays 2 and knocks the enemy sideways; hover shows the ability text
- ✅ AC321: Deck Builder — three Commander portraits by the title, no logo, other factions hidden not locked
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
- ✅ AC341: Mine Control — a Miner attacks an adjacent enemy Miner only if it survives, and mines when crystals are low
- ✅ AC342: Guard — Fighters stay within 2 spaces of the stronghold or a Miner and hit enemies that come near
- ✅ AC343: switching the stance mid-turn changes the next unit's choice
- ✅ AC344: a Card Comp vs Card Comp match plays to the end with no input; watch bar, stances and Rematch
- ✅ AC345: the four stance buttons sit on the right edge, vertically centered, big enough to tap (1920x1080 and 844x390)
- ✅ AC349: bonus draws — +1 card per 4 crystals mined, +1 for holding every mine
- ✅ AC350: the 12 new goblin models are copied in, meshopt-compressed and small
- ✅ AC351: every goblin unit shows its 3D model on the board, not a token (first eight)
- ✅ AC351: every goblin unit shows its 3D model on the board, not a token (last eight)
- ✅ AC352: items sit on the bones from the owner looks and every carried item is attached
- ✅ AC353: goblin models play walk, attack, hit and defeat with their own clips
- ✅ AC354: a model that fails to load falls back to the token and the match keeps going
- ✅ AC355: models load once and are reused; Gnome and Dwarf units without a model are unchanged
- ✅ AC357: Gnome and Dwarf units show their 3D models (character only); the clockwork beetle has no skeleton
- ✅ round 23 hand at 1920x1080 › AC363: the fan follows Ken's Oct 30 hand spec — every card shows at least 50 %, a flat fan (at most 1.4° per card, no arc) (1920x1080)
- ❌ round 23 hand at 1920x1080 › AC364: grabbing a card tucks the rest of the hand, and it stays tucked after a play or a cancel (1920x1080)
- ✅ round 23 hand at 1920x1080 › AC365: the hand tucks within about a third of a second when the mouse leaves it, also onto the enlarged card (1920x1080)
- ✅ round 23 hand at 1366x768 › AC363: the fan follows Ken's Oct 30 hand spec — every card shows at least 50 %, a flat fan (at most 1.4° per card, no arc) (1366x768)
- ❌ round 23 hand at 1366x768 › AC364: grabbing a card tucks the rest of the hand, and it stays tucked after a play or a cancel (1366x768)
- ✅ round 23 hand at 1366x768 › AC365: the hand tucks within about a third of a second when the mouse leaves it, also onto the enlarged card (1366x768)
- ❌ round 26 at 1920x1080 › AC370/AC372: the dragged card stays centered on the pointer; the square under it is highlighted; it grows back over the hand
- ✅ round 26 at 1920x1080 › AC371: 300 ms after stopping over a square the card takes that square's on-screen shape (near and far square)
- ❌ round 26 at 1920x1080 › AC373: dropping on a highlighted legal square plays the card there exactly as before
- ❌ round 26 at 1920x1080 › AC375: the 3D canvas draws at the device pixel ratio; no scroll bars at 1920x1080, 2560x1080 and 3840x2160
- ✅ round 26 at 1920x1080 › AC377: a payment that needs the Bank asks first; Yes pays Flow then Bank, No cancels
- ✅ round 26 at 1920x1080 › AC378: with enough Flow there is no question and the Bank is unchanged
- ✅ round 26 at 1920x1080 › AC379: "Don't ask again" stops the question; the Settings switch brings it back, also after reload
- ✅ round 26 at 1920x1080 › AC380: Commander speech bubbles are about 35% smaller
- ✅ round 26 at 1920x1080 › AC382: after any move this phase, Done ends the phase with no question
- ✅ round 26 at 1920x1080 › AC383/AC384: with no move made, Done opens a drop-up above it in the Menu style; Go back keeps the phase, Continue ends it
- ✅ round 26 at 1920x1080 › AC385: a controlled mine shows no faction emblem picture and no emoji symbol
- ✅ round 26 at 1920x1080 › AC386: the Respond box is 1.3x bigger with buttons at least 44 px tall
- ✅ round 26 at 1920x1080 › AC387: Junk Shaman lift — the character follows the pointer and lands on the square you click; 2 crystals paid
- ✅ round 26 at 1920x1080 › AC388: Junk Shaman lift — squares farther than 5 are not highlighted and do nothing; cancel pays nothing
- ✅ round 26 at 1920x1080 › AC389: hovering across the hand never flickers or turns cards see-through
- ✅ round 26 at 1920x1080 › AC391/AC396: Skullflinger plays his normal attack clip, no flying skull is created, the hit lands
- ✅ round 26 high-density screen › AC375: with deviceScaleFactor 2 the 3D drawing buffer is 2x its CSS size
- ✅ round 26 first click › AC376: the first click asks for fullscreen once; a refusal shows no error
- ✅ round 26 layout 1920x1080 › AC374: the full hand shows at least 50 % of every card (Ken, Oct 30) and every card is on screen at its tucked rest (1920x1080)
- ✅ round 26 layout 1920x1080 › AC381: the mine-all pickaxe badge is fully visible and uncovered (1920x1080)
- ✅ round 26 layout 1366x768 › AC374: the full hand shows at least 50 % of every card (Ken, Oct 30) and every card is on screen at its tucked rest (1366x768)
- ✅ round 26 layout 1366x768 › AC381: the mine-all pickaxe badge is fully visible and uncovered (1366x768)
- ✅ round 26 layout 844x390 › AC374: the full hand shows at least 50 % of every card (Ken, Oct 30) and every card is on screen at its tucked rest (844x390)
- ✅ round 26 layout 844x390 › AC381: the mine-all pickaxe badge is fully visible and uncovered (844x390)
- ✅ round 26 Respond on a phone › AC386: at 844x390 the Respond box and all its buttons are fully on screen
- ✅ Oct 30 Ken at 1920x1080 › AC413: the card close-up has a small ✕ Close at the card's top-right; outside tap and Esc still close it
- ✅ Oct 30 Ken at 1920x1080 › AC414: the computer's played card pops up big in the middle for about a second, then is laid down on its discard pile
- ✅ Oct 30 Ken at 1920x1080 › AC415: the enemy discard pile sits face-up on the left; tapping it fans the cards out at half the hand size, scrollable, each opens its close-up
- ✅ Oct 30 Ken at 1920x1080 › AC416: an Ironclad Bulwark shows a bubble around the unit in its faction colour; it pops when it blocks a hit
- ✅ AC420 phone touch › AC420: tapping a 3x unit's body selects it and a tap on a lit square moves it (phone touch)
- ✅ AC420 desktop mouse › AC420: tapping a 3x unit's body selects it and a tap on a lit square moves it (desktop mouse)
- ✅ Oct 31 Ken hand double-click 1920x1080 › AC440: a mouse double-click (clicks 300 ms apart) on a hand creature lights its squares; a click on one deploys it (1920x1080)
- ❌ Oct 31 Ken hand double-tap 844x390 › AC441: a double tap (taps 300 ms apart) on a hand creature lights its squares; a tap on one deploys it (844x390 touch)
- ✅ AC359: Bowler Brawler holds his flaming ball in his hand and spins it on a finger when idle
- ✅ AC360: Bowler Brawler bowls (Strike and attack): ball back, swing, release, roll along the ground; nothing clips; a new ball returns to his hand
- ✅ AC361: summoning Bowler Brawler plays his basketball shot: the ball flies up and lands dead (no bounce, no roll)
- ✅ AC362: every Crystal Node shows the owner look effects in its owner color; Low graphics keeps only the main glow
- ✅ AC366: flying units hover, bob and sway above their square with a ground shadow; walkers stand on the ground
- ✅ AC367: Gnome and Dwarf models have their own heights; the Clockwork Beetle slides when it moves
- ❌ AC368: Card Comp vs Card Comp watch bar sits bottom-right; Pause, Play and Exit to menu work
- ✅ AC390/AC392/AC393: Goblin figures carry their parts exactly as in the owner's Model Editor and idle on their OH_ clip
- ✅ AC390/AC394: Thunderwing Gyronaut and Aegis Tinkerer have their gear, events.json and a clips map whose clips exist
- ✅ AC397: Venom Shiv stacks: 2 then 3 damage a turn, never more than 3; the clock keeps the longer
- ✅ AC398: a fresh dagger on a nearly-finished poison sets 7 turns, not 7 more
- ✅ AC399: two Ironclad Bulwarks block the next two hits, the third lands
- ✅ AC400: Thunderhorn Blast stacks once: +1, then +2, a third is still +2; gone next turn
- ✅ AC401: Troll Tyrants: two give Goblins +2, three still +2
- ✅ AC402: Junk Boost: next to the Bowler Brawler and the Junk Shaman a Goblin gets +2 on its own turn
- ✅ AC403: two Grudge Hurler hits root for its next two turns; a third does not make it three
- ✅ AC404: exceptions: Ward refreshes, never stacks; a shielded Riot Shield Bearer cannot be lifted by the Junk Shaman
- ✅ AC405: the stacking cards say so, and a stacked poison shows x2
- ✅ AC409: a Miner summoned this turn can mine but not attack; from its next turn it attacks with normal strike-back
- ✅ AC410: a Smith Miner summoned as a Miner follows the same rule: move or mine now, attack from its next turn
- ✅ AC411: the Miner cards say "Can't attack the turn it's played" and no card says Miners never attack
- ✅ AC418: every rigged unit leaves its bind pose once loaded, and plays a walk or run clip while it moves
- ❌ AC419: the Gnome Plow is a gnome seated on his plow: the plow is its mount, its wheels spin while it moves, and he plays the ride clip at rest
- ✅ AC421: the pickaxe picture mines; a tap on its padding over a unit behind the mine selects that unit
- ✅ AC422: a broke Dwarf side gets exactly ONE free Riot Shield Bearer; the second costs 2 and is refused without crystals
- ✅ AC423: over a whole computer-vs-computer match on every difficulty, every computer action passes the same rule check as the player, every summon is paid, in its deploy zone and from its own deck, and the thinking never touches the match
- ✅ AC424: the computer opponent thinks in a Web Worker in a live match: the worker answers, its moves are applied and pass the referee
- ✅ AC425: a mine action or a move no longer rebuilds the hand: the same card elements stay, and the action returns quickly
- ✅ AC460: Choose Your Commander has no panel behind the Commander cards (row and chosen, 1920x1080 and 844x390)
- ✅ AC461: clicking a Commander card opens no 3D viewer or pop-up; his card stays selected
- ✅ AC462: the Previous / Next commander arrows sit either side of the card and page through the Commanders, wrapping, also with the keyboard
- ✅ AC463: the game modes sit in the right third of the screen, with the deck picker under them (room for four starter decks), at 1920x1080 and 844x390
- ✅ Oct 31 Ken smooth hand 1920x1080 › AC442: sliding across the hand shows one card per hand card in every frame (no offset second card), eased 120-220 ms (1920x1080)
- ✅ Oct 31 Ken smooth hand 844x390 › AC442: sliding across the hand shows one card per hand card in every frame (no offset second card), eased 120-220 ms (844x390)
- ✅ Oct 31 Ken no ability overlays 1920x1080 › AC443: no ability tag (Tunnel! or any other) is drawn over cards in the hand, the close-up or the Deck Builder (1920x1080)
- ✅ Oct 31 Ken no ability overlays 844x390 › AC443: no ability tag (Tunnel! or any other) is drawn over cards in the hand, the close-up or the Deck Builder (844x390)
- ✅ Oct 31 Ken drag icons 1920x1080 › AC444: dragging a unit shows its own faction emblem: dwarves gear, gnomes eye, goblins goblin (mouse 1920x1080)
- ✅ Oct 31 Ken drag icons 844x390 › AC444: dragging a unit shows its own faction emblem: dwarves gear, gnomes eye, goblins goblin (touch 844x390)
- ✅ Oct 31 Ken discard pile 1920x1080 › AC445: the enemy discard pile sits a touch higher; its cards slide out from the left with no frame; Escape / outside closes it (1920x1080)
- ✅ Oct 31 Ken discard pile 844x390 › AC445: the enemy discard pile sits a touch higher; its cards slide out from the left with no frame; Escape / outside closes it (844x390)
- ❌ spell FX on a phone (844x390, touch) › AC473: phones load the -m files, the FX still plays, and no JS task over 100 ms during a fireball
- ✅ AC478 (desktop) › AC478: the computer's actions never overlap, and its card is shown and laid aside before it resolves (desktop)
- ✅ AC478 (phone) › AC478: the computer's actions never overlap, and its card is shown and laid aside before it resolves (phone)
- ✅ login screen 1920x1080 › AC504: login screen buttons are present, ≥44 px and on screen at 1920x1080
- ✅ login screen 1366x768 › AC504: login screen buttons are present, ≥44 px and on screen at 1366x768
- ✅ login screen 844x390 › AC504: login screen buttons are present, ≥44 px and on screen at 844x390
- ✅ online on a phone › AC504: login page loads on a phone-size viewport with no page errors
- ✅ AC464: Fight! and the other silver buttons on Choose Your Commander hold their text inside the button with at least 6 px to spare
- ✅ AC430: every unit stands at its real-world table height x creatures (within 8 %); the Troll Tyrant and Arcane Colossus are the tallest; none covers the board (desktop)
- ✅ AC430: every unit stands at its real-world table height x creatures (within 8 %); the Troll Tyrant and Arcane Colossus are the tallest; none covers the board (phone)
- ✅ AC431: units and Commanders carry their gear: Knobbin's staff, the Gemsinger Miner's pickaxe, the Riot Shield Bearer's tower shield (desktop)
- ✅ AC431: units and Commanders carry their gear: Knobbin's staff, the Gemsinger Miner's pickaxe, the Riot Shield Bearer's tower shield (phone)
- ✅ AC470: every spell has its six painted FX layers on disk, PC and phone sets, and the FX spec is loaded
- ✅ AC471: Searing Arcane Orb plays as an event: 3 beats in order, flat ring at the target, slow-mo, light shake, the FWOOSH! word pops and holds; the match goes on
- ❌ AC472: Starfall covers the 3x3, Venom Shiv is thrown at its target, Thunderhorn glow stays on each buffed unit while the buff lasts, countered cards shatter into shards
- ✅ AC474: the emoji glyph spell FX are gone: no glyph sticker on a cast
- ❌ AC475: Starfall Cataclysm: every unit in the 3x3 is hit at the meteor's impact, none before it
- ✅ AC476: Desperate Plunder: gems fly from the caster into its Flow counter at impact and land
- ✅ AC477: the intro and main menu show the silver OREHEART logo (Ken's Oct 24 brand logo), never the old gold one
- ✅ AC500: the database checks are present (run by the factory with run-supabase.sh)
- ✅ AC502 + AC544: online switch and env-guard files and their unit tests exist
- ✅ AC527: secret scan passes on the repo and both dist folders
- ✅ AC528 + AC529: dist sizes; the game calls no admin_ function except am_i_admin; admin has no game art
- ✅ AC530: REPORT.md has Ken's SQL lines, the lawyer reminder, editor updates and the status list
- ✅ AC501: ?test=1 without online=1 goes straight to the menu with hooks and no login or test bar
- ✅ AC503: Play offline (practice) opens the menu and a vs-computer match makes no /rest/v1/ request
- ❌ AC505: 13+ sign-up, confirmation email, then avatar, welcome and menu
- ✅ AC506: username messages and the Create account button rule
- ✅ AC507: wrong password and unconfirmed email messages; Send the email again sends one
- ✅ AC508: forgot password email opens Set a new password; new works, old fails
- ✅ AC509: new account has 359 traceable starter cards, matching collection and sign-up coins
- ✅ AC510: reload keeps the player signed in; Sign out returns to the login screen
- ✅ AC531: age question is neutral, birth year never sent, first answer remembered
- ✅ AC532: under-13 form asks only for a parent email; sign-up is pending with a parent email queued
- ✅ AC533: waiting child sees the waiting screen; server refuses play actions; offline works
- ✅ AC534: parent consent page approves once; the child can then save; confirmation queued
- ✅ AC535: withdraw link blocks the child again
- ✅ AC536: under-13 deck names are plain and the builder has no Rename
- ✅ AC537: expired link message; resend makes a new link; second resend refused
- ✅ AC538: consent tables and outbox are closed to players and anon; sent payloads hold no tokens
- ✅ AC545: consent page shows the whole draft notice, DRAFT marker, Contact us; no email address anywhere
- ✅ AC511: a deck saved in the Deck Builder is there on another computer
- ✅ AC512: local decks are imported once and stay in the browser
- ✅ AC513: server refuses unknown cards; the builder shows the refusal and keeps edits
- ✅ AC514: a vs-computer match starts with a server deck
- ✅ AC515: player direct writes are refused and change nothing
- ✅ AC516: a player reads only their own profile, wallet and decks
- ✅ AC517: logged out, only the public functions work
- ✅ AC518: a non-admin sees "Not an admin" after 2-step and is refused by admin functions
- ✅ AC519 + AC520: admin password-only goes to 2-step; then the player list finds players and shows money spent
- ✅ AC520: admin list paging works with more than 25 players
- ✅ AC521 + AC543: player cards have ids; Card lookup shows owners, origin and history; transfer shows both owners
- ✅ AC522: grant coins needs a reason, is idempotent and audited
- ✅ AC523: ban for 3 days blocks saving and shows the ban message; unban restores; both audited
- ✅ AC524: ban needs a reason; admins cannot ban themselves or other admins
- ✅ AC525: audit log is newest first and players cannot change it
- ✅ AC526: admin site security headers and robots.txt
- ✅ AC539: admin rename refuses bad names and shows the new name in the game
- ✅ AC540: a bad word added in Settings blocks names at once; bad entries refused; audited
- ✅ AC541: sign-up coins setting applies to new players only
- ✅ AC542: under-13 state for the admin; admin withdraw blocks and is audited; no tokens shown
- ✅ AC544: the game shows the TEST SERVER bar; server_kind cannot be changed
- ✅ AC546: Contact us reaches the Inbox; answer queues a reply; rate limit; closed to players

## Failures

```
✗ AC25: Tutorial button opens the guided match with tips and Skip Tutorial
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Skip Tutorial' })
    - locator resolved to <button type="button" class="btn tip-skip">Skip Tutorial</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling


  1283 |   await expect(tip).toBeVisible();
✗ AC84: finished Goblin figures, Grubnak, Strongholds and mines on the battlefield
Error: gnome-prospector

expect(received).toBe(expected) // Object.is equality

Expected: "finished"
Received: "placeholder"

  2895 |     const c = s.board.creatures.find((x) => x.uid === f.uid);
  2896 |     expect(c, f.uid).toBeTruthy();
> 2897 |     expect(f.model, f.cardId).toBe(c.cardId.startsWith('gnome') && !GD_MODELS.includes(c.cardId) ? 'placeholder' : 'finished'); // owner change (Ken, Oct 30): the Gemsinger Miner has its 3D model
       |                               ^
  2898 |   }
✗ round 9c arena › AC228: the arena canvas draws every frame and the screen center is not the plain board color
Error: arena draw calls in window 0

expect(received).toBeGreaterThan(expected)

Expected: > 1292
Received:   1292

  6747 |       expect(a, 'canvas[data-arena-canvas] exists').toBeGreaterThanOrEqual(0);
  6748 |       await page.waitForTimeout(500);
> 6749 |       expect(await arenaDraws(page), `arena draw calls in window ${i}`).toBeGreaterThan(a);
       |                                                                         ^
  6750 |     }
✗ AC231: the stronghold never moves; Grubnak emotes in place and returns to his turn
Error: stronghold moved during laugh

expect(received).toEqual(expected) // deep equality

- Expected  - 8
+ Received  + 8

  Array [
-   0.89513,
+   -0.65393,
    0,
+   -0.44108,
✗ round 23 hand at 1920x1080 › AC364: grabbing a card tucks the rest of the hand, and it stays tucked after a play or a cancel (1920x1080)
Error: Timeout 1200ms exceeded while waiting on the predicate

  10016 |       await page.mouse.move(from.x, from.y - 30, { steps: 3 });
  10017 |       await page.mouse.move((from.x + target.x) / 2, (from.y + target.y) / 2, { steps: 5 });
> 10018 |       await expect.poll(tuckedOk, { message: 'rest of the hand tucks once a card is grabbed', timeout: 1200 }).toBe(true);
        |       ^
  10019 |       await page.mouse.move(target.x, target.y, { steps: 5 });
  10020 |       expect(await tuckedOk()).toBe(true);
  10021 |       await page.mouse.up();
    at /home/runner/work/Starter/Starter/factory/.run-tests/acceptance.spec.mjs:10018:7
✗ round 23 hand at 1366x768 › AC364: grabbing a card tucks the rest of the hand, and it stays tucked after a play or a cancel (1366x768)
Error: rest of the hand tucks once a card is grabbed

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 1200ms exceeded while waiting on the predicate

  10016 |       await page.mouse.move(from.x, from.y - 30, { steps: 3 });
  10017 |       await page.mouse.move((from.x + target.x) / 2, (from.y + target.y) / 2, { steps: 5 });
✗ round 26 at 1920x1080 › AC370/AC372: the dragged card stays centered on the pointer; the square under it is highlighted; it grows back over the hand
Error: grows back over the hand

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 0.05
Received:    0.45833333229445733

Call Log:
- Timeout 2000ms exceeded while waiting on the predicate

  10186 |     await page.mouse.move(from.x, handY, { steps: 8 });
  10187 |     await page.waitForTimeout(300);
✗ round 26 at 1920x1080 › AC373: dropping on a highlighted legal square plays the card there exactly as before
Error: Timeout 3000ms exceeded while waiting on the predicate

  10230 |     expect((await dragCard(page)).highlight).toMatchObject({ row: 7, col: 6, legal: true });
  10231 |     await page.mouse.up();
> 10232 |     await expect.poll(async () => { const c = at(await getState(page), 7, 6); return c && c.cardId; }, { timeout: 3000 }).toBe('goblin-scrounger');
        |     ^
  10233 |     const s = await getState(page);
  10234 |     expect(s.players.player.hand.length).toBe(before.players.player.hand.length - 1);
  10235 |     expect(s.players.player.crystals).toBe(before.players.player.crystals - 1);
    at /home/runner/work/Starter/Starter/factory/.run-tests/acceptance.spec.mjs:10232:5
✗ round 26 at 1920x1080 › AC375: the 3D canvas draws at the device pixel ratio; no scroll bars at 1920x1080, 2560x1080 and 3840x2160
Error: Timeout 5000ms exceeded while waiting on the predicate

  10241 |     for (const vp of [{ width: 1920, height: 1080 }, { width: 2560, height: 1080 }, { width: 3840, height: 2160 }]) {
  10242 |       await page.setViewportSize(vp);
> 10243 |       await expect.poll(async () => { const c = (await renderStats(page)).canvas; return c && c.pixelRatio === 1 && near(c.bufferWidth, c.cssWidth, 2) && near(c.bufferHeight, c.cssHeight, 2); }, { timeout: 5000 }).toBe(true);
        |       ^
  10244 |       const sc = await page.evaluate(() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight }));
  10245 |       expect(sc.x <= 0 && sc.y <= 0, `no scroll bars at ${vp.width}x${vp.height}`).toBe(true);
  10246 |     }
    at /home/runner/work/Starter/Starter/factory/.run-tests/acceptance.spec.mjs:10243:7
✗ Oct 31 Ken hand double-tap 844x390 › AC441: a double tap (taps 300 ms apart) on a hand creature lights its squares; a tap on one deploys it (844x390 touch)
Error: a lit square on screen

expect(received).toBeTruthy()

Received: null

  11187 |   let target = null;
  11188 |   for (const q of hl) { const c = await sqCenter(page, q.row, q.col); if (c.y < H * 0.7 && c.x > W * 0.15 && c.x < W * 0.85 && !at(s, q.row, q.col)) { target = { ...q, ...c }; break; } }
> 11189 |   expect(target, 'a lit square on screen').toBeTruthy();
        |                                            ^
  11190 |   if (touch) await page.touchscreen.tap(target.x, target.y); else await page.mouse.click(target.x, target.y);
  11191 |   await expect.poll(async () => ((at(await getState(page), target.row, target.col)) || {}).cardId).toBe('goblin-scrounger');
✗ AC368: Card Comp vs Card Comp watch bar sits bottom-right; Pause, Play and Exit to menu work
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Play', exact: true })
    - locator resolved to <button type="button" class="btn wb-pause">Play</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action


✗ AC419: the Gnome Plow is a gnome seated on his plow: the plow is its mount, its wheels spin while it moves, and he plays the ride clip at rest
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0.3
Received:   0

Call Log:
- Timeout 8000ms exceeded while waiting on the predicate

  11008 |   const turns0 = (await rig()).wheelTurns;
  11009 |   expect((await act(page, mv)).ok).toBe(true);
> 11010 |   await expect.poll(async () => Math.abs((await rig()).wheelTurns - turns0), { timeout: 8000 }).toBeGreaterThan(0.3); // the wheels roll along the ground
        |   ^
✗ spell FX on a phone (844x390, touch) › AC473: phones load the -m files, the FX still plays, and no JS task over 100 ms during a fireball
Error: long tasks during the fireball: [90, 2975] ms; same cast without FX: [107, 90] ms

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 189.1
Received:    2975

  11863 |     // no JS task over 100 ms during the fireball; where the page is slower than that without the FX too, the FX adds no long task of its own
  11864 |     const cap = Math.max(100, Math.max(0, ...base) * 1.3 + 50);
> 11865 |     expect(Math.max(0, ...long), `long tasks during the fireball: [${long.join(', ')}] ms; same cast without FX: [${base.join(', ')}] ms`).toBeLessThanOrEqual(cap);
        |                                                                                                                                            ^
  11866 |   });
✗ AC472: Starfall covers the 3x3, Venom Shiv is thrown at its target, Thunderhorn glow stays on each buffed unit while the buff lasts, countered cards shatter into shards
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 1

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate

  11763 |   expect(f.layers.ring.scale, 'the ring grows over the whole 3x3').toBeGreaterThanOrEqual(3);
  11764 |   expect(f.layers.ring.cell).toEqual({ row: 3, col: 6 });
> 11765 |   await expect.poll(async () => (await sfxNow(page)).active.length, { timeout: 5000 }).toBe(0);
        |   ^
✗ AC475: Starfall Cataclysm: every unit in the 3x3 is hit at the meteor's impact, none before it
Error: every unit in the 3x3 reacts

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

Call Log:
- Timeout 15000ms exceeded while waiting on the predicate

  11909 |   const impactAt = fx.startedAt + fx.impactMs;
  11910 |   const hitAt = async () => { const log = (await renderStats(page)).creatureAnimLog || []; return foes.map((c) => { const e = log.find((x) => x.uid === c.uid && (x.anim === 'hit' || x.anim === 'defeat' || x.anim === 'knockback')); return e ? e.at : 0; }); };
✗ AC505: 13+ sign-up, confirmation email, then avatar, welcome and menu
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Sign in', exact: true })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('heading', { name: 'Sign in', exact: true })


```