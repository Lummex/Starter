# Oreheart — Phase 1a build brief

Read this brief first, then the full design document: `factory-design/design/oreheart-gdd-v2.md` (the source of truth for every rule, number and card). The screen layout reference is `factory-design/design/oreheart-mockup.jpg`.

## Revision 5 (third owner playtest) — read this first

The design document is the source of truth; where anything disagrees, the design doc wins, then this section, then Revision 4, 3 and 2.

1. **Hand cards pop out:** on mouse hover, the card slides up out of the fan by about 1 inch (~60 px at phone landscape scale), slightly larger and in front; on touch, press-and-hold does the same before a drag.
2. **Summoning sickness:** creatures placed this turn can't move, attack or mine (unless their ability says so), and show darkened with a grey ring. **Gatherers (Miners) have no summoning sickness:** they can move or mine (not attack) the turn they're placed, and stay bright with a yellow ring. (The last build wrongly darkened fresh Gatherers.)
3. **Fix the 3 faulty acceptance tests** from the last report: AC12 (moving onto your own creature is now a legal swap), AC14 (expected Health should be 2, not 3), AC16 (the test pressed Done once too often). Re-derive their expectations from the spec; don't weaken the game.
4. **Creature ring:** yellow = can still act this turn; dark grey = has acted (moved, attacked or mined) or can't act yet. Resets at the start of its owner's turn, together with the darkening.
5. **Ranged markers:** a 🏹 icon next to Attack on Ranged cards (and "Ranged" in the ability text); Ranged 3D figures carry a visible ranged weapon and show 🏹 in their floating stats.
6. **Mining is an action, every turn:** in the Action phase a creature on one of the 8 spaces around a mine can be dragged onto that mine to MINE, as its one action (instead of move or attack). Each mining action makes 2 crystals (Gatherer) or 1 (Fighter) in the mine's color; the player's pool at the start of their next turn is SET to what was mined on their previous turn (cap 16). Creatures standing next to a mine without mining make nothing. Mining creatures show a pickaxe icon until their owner's next turn. Add MINE to the engine's legal actions, the AI and the tutorial.
7. **Mine color counts miners only:** at the start of each turn, the side with more creatures that mined that mine on their owner's last turn (and are still adjacent) sets its color; tie or no miners = neutral white. Remove the old "a creature touching two mines counts at only one" rule: the player chooses the mine by dragging.
8. **Board 13 wide × 7 deep:** Strongholds at the center of rows 1 and 7 (column 7); home rows 1–2 and 6–7 as before. **3 mines placed at random each match** in rows 3–5 only, mirrored between halves (row 3 ↔ row 5, same column): either one on row 4 plus a mirrored pair on rows 3 and 5, or all three on row 4. Mines at least 2 spaces apart and never adjacent to a Stronghold. Use the match's seeded RNG (so `?seed=` reproduces the layout); the tutorial uses a fixed layout. The camera still fits the whole board edge to edge in landscape.
9. **Mining glow and warnings:** when a creature that can mine is picked up, its mine glows with a pickaxe (a third color, distinct from blue move spaces and red attack targets). Mining counts as a move left for auto-skip and for the "Moves still available" pop-up, which names miners that haven't mined. Free Gatherer when broke: "mined nothing on your last turn" replaces "flow 0".
10. **Deck piles:** each player's deck pile at full hand-card size on that player's right: yours bottom-right (Done button and phase name move up above it), the enemy's top-left as seen from your side (enemy card backs shift right to make room). Show the card count.
11. **Commander Health by the Commander:** a big glowing heart with the number floating right by each Commander (above your Commander's head; beside the enemy Commander so it never goes off-screen), shaking and popping red damage numbers when hit. Keep the accessible HTML Health readouts (they can be small).

Unit tests with exact numbers: mining yields (Gatherer 2, Fighter 1, nothing without the mine action), pool set to last turn's mining, mine color from miners only, Gatherer can move/mine but not attack on its summon turn while a Fighter can do nothing, mirrored mine layout for several seeds (always 3 mines in rows 3–5, mirrored, spacing rules), 13 × 7 board bounds.

## Revision 4 (economy redesign: Crystal Flow) — read this first

Revision 4 replaces the crystal economy and adds swapping. The design document ("Crystals and site control: Crystal Flow") is the source of truth; where anything disagrees, the design doc wins, then this section, then Revision 3, then Revision 2.

1. **Crystal Flow replaces mining income.** At the start of a player's turn their crystal pool is SET (not added) to their flow: for each of their creatures on the 8 spaces around a mine, Gatherer = 2, Fighter = 1. Unspent crystals stay in the pool through the enemy's turn (Instants, counterspells) and are replaced at the start of the owner's next turn.
2. **Pool cap 16**, whatever the source (flow, Crystal cards, abilities, underdog bonus).
3. **Mine color:** at the start of each turn, the side with more creatures (count, not flow) around a mine sets its color; in a mixed deck, the faction with most creatures there. Tie = neutral (white).
4. **Crystals come in the mine's color for every side's creatures there.** The pool is tracked per color: green, blue, purple, white.
5. **Paying:** creatures and upgrades: own-color crystals pay 1 each, any other color or white pays ½ each (sum the halves, round down). Spells: any color pays 1 each. Auto-pay the cheapest way (creatures use own color first; spells use off-color and white first). Affordable cards glow in hand.
6. **A creature touching two mines counts at only one** (the mine where its side has more creatures; if equal, the one where it adds more).
7. **Starting crystals 0.** The free-Gatherer rule now reads: flow 0, no mine in your color, no Gatherer on the battlefield → summon one Gatherer free. Underdog bonus: +2 crystals of your own color when no mine is in your color and at least one is in the enemy's. Tunnel: when more mines are in the enemy's color than yours.
8. **Required examples (unit tests, exact numbers):** (a) 1 Gnome Miner vs 2 Goblin Miners at a mine → mine green, Goblins get 4 green, Gnomes get 2 green worth 1 toward a Gnome creature; (b) 2 Miners vs 2 Miners → neutral, each side gets 4 white worth 2 toward creatures, 4 toward spells; (c) 3 own Miners at an own-color mine → pool 6; one dies → next turn 4; (d) unspent crystals still available on the enemy's turn, then reset to flow (not added) on your next turn; (e) pool never exceeds 16.
9. **New spell and upgrade costs** exactly as in the design doc tables (Prospector's Prayer 1, Tunnel Rush 2, Healing Light 2, Shield Bubble 2, Fireball 3, Fizzle 3 (cancels spells costing 3 or less), Battle Cry 4, Hold It! 4, Second Wind 5, Spell Snap 5, Meteor Strike 7, Mirror Hex 7; upgrades 3 / 3 / 5 / 8). Prospector's Prayer: if fewer mines are in your color than in the enemy's, gain 3 crystals of your own color this turn.
10. **Swapping places:** in the Action phase, dragging a creature onto one of your own creatures within its move range swaps them. Only the dragged creature uses its action. Never with enemies. Swap targets glow in a different color from empty spaces. Add this to the legal actions, the AI and the tutorial.
11. **Mine display:** each mine shows a ring in its current color and floating per-side flow numbers; the crystal counters show the pool per color and next turn's flow.

The tutorial, Rules page and AI must use Crystal Flow and swapping. Rebalance starter decks if needed so a player can usually afford something by turn 3.

## Revision 3 (second owner playtest) — read this first

The owner played revision 2. The design document has been updated with every change below; where anything disagrees, the design doc wins, then this section, then the Revision 2 list.

1. **Landscape fills the whole screen:** no black bars or letterboxing on any phone held sideways (test at 844×390, 740×360 and 667×375). The battlefield is the full-screen 3D view, zoomed as large as possible so the whole 7×7 board stays visible on small phones.
2. **Everything else overlays the battlefield:** hand, enemy card backs, crystal counters, deck pile, phase, Done and Commander Health float on top of it.
3. **Stronghold placement:** your Stronghold and Commander sit as low as possible, just behind your hand cards but still visible; the enemy Stronghold sits right at the top edge.
4. **Bigger hand cards** that are readable on a phone. While you drag a card or a creature, the hand slides down out of the way so your back row is reachable, then comes back.
5. **No faction picker:** remove any faction-choice step. You pick a Commander (and, until the deck builder exists, that faction's starter deck comes with it).
6. **Check Thane Borgo:** "Your creatures get +1 Health" must apply (a Dwarf 1/3 under Thane is a 1/4). The last report had a failing check about this; verify the engine, not just the test.
7. **Phase banners:** a big center-screen comic-style banner ("YOUR TURN", "DEPLOY", "ACTION", "ENEMY TURN") for about 1.5 seconds, then fades. Phases that are auto-skipped show no banner.
8. **Auto-skip:** when the current player has no legal action left in a phase (ignoring Instants, upgrades and the Gatherer swap), the game moves to the next phase after about 1 second.
9. **No Stronghold income:** remove the Stronghold trickle (income is now Crystal Flow, see Revision 4).
10. **Creature numbers:** every creature on the battlefield shows Attack, Health and Movement.
11. **Acted creatures darken:** a creature that has moved or attacked, or can't act yet, turns darker and duller (NOT grey) until the start of its owner's turn.
12. **New creature costs:** Attack + Health, +1 for a small ability, +2 for a big one; a 1/1 costs 1. All basic Gatherers (Goblin Scrounger, Gnome Prospector, Dwarf Miner) are now 1/1 costing 1. Use the exact costs in the design doc's card tables. Rebuild the starter decks for the new costs: about 8 Gatherers and plenty of cheap creatures.
13. **Ranged:** a Ranged creature can attack any enemy, or the enemy Commander, up to 2 spaces away in any direction (Chebyshev distance ≤ 2), even over other creatures. No strike back on ranged attacks. Example that must work: an Axe Thrower two spaces from an enemy can attack it.
14. **"Moves still available" pop-up:** pressing Done while legal moves remain (same rule as auto-skip) shows a center pop-up "Moves still available! Continue to the next phase?" with Continue and Go back. Never shown when the timer runs out. A Settings switch turns it off.
15. **Phase timer:** each timed phase lasts 50 seconds. Nothing is shown for the first 40; then a big center-screen countdown 10 → 0; at 0 the phase ends (not the whole turn). Replaces the burning rope. Owner settings: hidden seconds 40, countdown seconds 10. No timer in the tutorial or in test mode.
16. **Gatherer swap:** once per turn in Deploy, if no Gatherer is in hand, discard any card (or none if the hand is empty) to move your cheapest basic Gatherer from the deck to your hand.
17. **Free Gatherer when broke:** with 0 crystals, no controlled site and no Gatherer on the battlefield, you may summon one Gatherer for free that turn.
18. **Gatherers can move (not attack) the turn they're summoned.**
19. **Income preview:** next to the crystal counter show "+N next turn"; tapping a site shows who controls it and what it pays.
20. **Overlay order:** confirm pop-up above the countdown above phase banners; a banner waits until nothing else is showing.

The tutorial, Rules page and computer opponent must all follow these rules (the AI uses the Gatherer swap and free Gatherer, and respects auto-skip). Add unit tests with exact numbers for items 6, 8, 9, 12 (sample costs), 13, 16, 17 and 18, and test-mode hooks so the acceptance tests can check the phase timer without waiting (for example `window.oreheart.setPhaseTimeLeft(seconds)`).

## Revision 2 (owner playtest changes) — read this first

The owner played the first build. The design document has been updated with every change below; where this brief and the design doc disagree, the design doc wins.

1. **Menu buttons:** the main menu buttons are exactly **Play**, **Tutorial**, **Rules** and **Settings**. No other button or link on the menu may contain the word "Play" (the first build's "How to Play" made the automated checks unable to find the Play button).
2. **Bug: Commander damage.** A creature attacking the Commander removes exactly its Attack from the Commander's Health (a ⚔️5 creature deals 5, plus any Attack bonuses it has, such as Battle Cry). Type advantage doesn't apply to Commanders. The first build got this wrong.
3. **Landscape screen** (phone held sideways), laid out as described in "Match screen" below.
4. **Move OR attack:** in the Action phase each creature either moves or attacks, never both, unless it has Charge.
5. **Guided tutorial match** (see "Tutorial match" in the design doc).
6. **Starter decks:** 50 cards = 40 creatures, 6 spells (including 1 Fizzle) and 4 Crystal cards. The mix lives in the content data so the owner can change it.
7. **Slow, small start:** (superseded by Revision 3: starting crystals 1, no Stronghold trickle.) The underdog bonus only applies when the enemy controls at least one site (the first build gave everyone +2 on turn 1). Tunnel only works while the enemy controls more sites than you.
8. **Back-row summoning:** creatures are summoned on your back row only (row 7 for you, row 1 for the enemy); only if it's full, on the row in front of it.
9. **Simultaneous fights:** in melee both creatures hit each other at the same moment; the defender strikes back even if the hit defeats it. ⚔️1 ❤️2 vs ⚔️1 ❤️1: the 1/1 dies, the 1/2 survives. Two 1/1s defeat each other. Ranged attacks still get no strike back; Sneaky still prevents it.
10. **Creatures heal every turn:** at the start of its owner's turn (Draw phase), every creature heals back to full Health. Damage lasts until then, so creatures can team up within a turn. **Commander damage never resets.**
11. **Healing cards reworked:** new keyword **Shield X** (blocks the next X damage; lasts until the start of your next turn). Gnome Tinker, Brewmaster, Madame Sprocket and Heavy Armor are changed as in the design doc.
12. **Damaged creatures** show their current Health in red until they heal.
13. **Phase timers:** superseded by Revision 3 item 15.
14. **Printed creature Health is at most 6** (Big Boss Troll, Steam Golem and Queen Brunhilda now have 6).

Unit tests must cover each of rules 2 and 7–11 with exact numbers.

**Goal of phase 1a:** one complete, playable match against a computer opponent, built on a clean, server-ready rules engine. The question this build answers is "is the battle fun?" Visuals are simple placeholders; art, collection and online come in later phases. Do a smaller scope *well* rather than everything shallowly.

## In scope

1. **Rules engine** (the most important part)
   - Pure TypeScript in its own folder (for example `src/engine/`), with no DOM, rendering, timers or browser APIs inside it, so it can later run unchanged on a server.
   - Game state is plain serializable data. The engine exposes: create a match, list the legal actions for the current player, apply an action, and read events (for animations).
   - All randomness (deck shuffles, coin flip) uses a seeded random number generator passed into the engine.
   - Implements every match rule in the design doc: the 7×7 grid, home rows, Strongholds, the 3 crystal sites and control (majority on the 8 surrounding spaces, ties = nobody, shared columns 3 and 5), site color switching, Crystal Flow income (see Revision 4), the underdog bonus, endless sites, Tunnel, card costs (creatures in faction color, spells in any color), Crystal cards (1 per turn, Crystal Eaters as specified, max 10 per deck), turn phases (Draw, Deploy, Action, End; in the Action phase each creature either moves OR attacks, never both, unless it has Charge), first player skips their first draw and the second player draws 1 extra card, mulligan, movement in 8 directions (move 2 for Ultra Rare/Collector/Veteran), melee/ranged/strike back/type advantage/Guard/Flying, simultaneous melee hits, full creature healing at the start of the owner's turn, Shield, Commander damage that stays, Unique cards, upgrades (Deploy phase, 1 per creature, costs as specified), Regular spells, Instants, counterspells and the Respond window, back-row summoning (front home row only when the back row is full), deck-out damage, Commander abilities, Commander at 0 Health retreats (match over), surrender.
2. **Content as data files** (JSON, not hard-coded): factions, crystal colors, Commanders, cards, abilities, and a `game-config.json` with every tunable number (phase timer seconds, timer hidden seconds, countdown seconds, respond window seconds, starting crystals, income values, underdog bonus, deck size, copy limits, Crystal card limit, upgrade costs, deck-out damage). The engine reads these; nothing balance-related is hard-coded.
3. **Cards:** all 41 starter cards from the design doc (creatures, spells, counterspells, Crystal cards, Crystal Eaters), the 3 starter Commanders (Grubnak the Goblin Boss, Professor Sproingle, Thane Borgo Anvilbottom). Add Commons as needed so each faction has a ready-made **50-card starter deck** that follows the deck rules: 40 creatures, 6 spells (including 1 Fizzle) and 4 Crystal cards. Keep every card and name original; never use names from other games (Warcraft, Warhammer, Magic: The Gathering, Hearthstone, Pokémon, etc.).
4. **Computer opponent:** Easy and Normal, built on the engine's legal-action list. Normal should contest crystal sites, protect its Gatherers, attack the Commander when it can, and use spells and counterspells sensibly. It must take its turn within a few seconds.
5. **Match screen** (LANDSCAPE: phone held sideways; also works with a mouse; show a "please rotate your phone" message if held upright), in the style of the mockup but laid out for a wide screen: the battlefield fills the whole screen (no black bars) viewed at an angle like a tabletop, enemy Stronghold at the top edge, yours just behind your hand; everything else floats over it: your hand along the bottom edge, enemy card backs along the top edge, crystal counters and deck pile on the left, phase/Done/Commander Health on the right:
   - A 3D scene (Three.js is fine) with a simple painted-looking ground, no visible grid lines; three glowing crystal formations that change color with control; two Strongholds with a simple Commander figure (top half) showing basic emote reactions.
   - Creatures as simple, readable placeholder 3D figures (colored by faction with the faction symbol), each showing Attack, Health and Movement.
   - Your hand fanned in a rainbow arc along the bottom; swipe or mouse-wheel scrolls through it; unlimited hand size. Opponent's card backs fanned at the top. Visible deck piles that shrink.
   - Drag a card onto the battlefield to summon (valid spaces glow); press, lift and drag a creature to move; drag onto an enemy to attack; spaces it can reach glow.
   - Crystal counters per color, current phase, phase timer (hidden for 40 seconds, then a 10-second center-screen countdown), a Done button, the Respond window for Instants, Commander Health for both sides.
   - Readable full-size card view on tap. Simple attack, damage-number and defeat animations, and a retreat scene at the end.
6. **Screens:** main menu (buttons Play, Tutorial, Rules, Settings) → pick Commander and difficulty → match → win/lose screen → back to menu. The **Tutorial** is the guided tutorial match from the design doc, offered automatically the first time the game is opened. **Rules** is a short page with text and pictures.

## Out of scope for phase 1a (later phases)

Booster packs, collection, deck builder, gold and shards, the full 120-card Core Set, polished art, poke reactions, sound and music, online play, accounts, the Owner Console, cosmetics, daily quests, taunts, rankings, notifications.

## Testing requirements (so the factory's inspectors can check it)

- Add a **test mode** turned on by the URL `?test=1`: phase timers paused, the AI makes moves instantly, and the shuffle seed fixed (`?seed=123` sets it).
- In test mode, expose `window.oreheart` with: `getState()` (the engine state as plain data), `legalActions()`, `act(action)` and `newMatch(options)`, so tests can drive a match without dragging in 3D.
- Key on-screen elements must be real HTML with accessible names: the phase name, timer, Done button, crystal counters, Commander Health for both sides, the Respond dialog and the win/lose screen.
- Write unit tests for the rules engine covering site control, income (including the turn-1 opening: exactly 1 crystal), back-row summoning, simultaneous combat, start-of-turn healing, Shield, Commander damage equal to Attack, Instants/counterspells, Crystal card limits and win/retreat. Also add a test-mode hook `window.oreheart.startTutorial()`.

## Performance

Smooth on a mid-range Android phone in Chrome; looks best on high-end phones. Include a simple Low/High graphics toggle.
