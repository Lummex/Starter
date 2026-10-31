# Round 28 — Move orders (owner request, Oct 28, 2026)

Written by Forge (CEO) from Ken's own words. This is the whole job for Round 28.

**Order change (Ken, Oct 29, in Wright's chat): "I'd like to skip 27 and go to 28 ... I want to finish up some models ... So I can get them all done at one time." and "Okay, make it happen." So Round 28 is built first, DIRECTLY on factory/issue-8 by Anvil with helpers (no factory round); Round 27 waits until Ken's models are done.**

## Ken's words (summary)
"When I'm moving players, I want to be able to grab a unit and click any square I want … drop it there, and it'll show you how many moves it takes them to get there. And it will automatically move each turn till he gets there … a little cancel icon on it to cancel his movements … it automatically shows the spaces and highlights the path he's gonna take, the shortest path, and it will go around players … If I grab it and move it onto … an enemy unit … I want it to automatically follow that unit wherever it goes, and when it gets to it, do its first attack on its turn."

## What to build

### M1. Drag a unit to any square
- In the owner's movement phase, the player can drag (or click-then-click) one of their own units onto ANY board square, including squares beyond the unit's move range this turn.
- Squares inside this turn's range behave exactly as today (normal move, no order created).
- Done when: dragging a unit to a square 3+ turns away creates a move order instead of being refused.

### M2. Path preview
- While dragging and after dropping, draw the SHORTEST legal path (same movement rules as normal moves; goes around units and blocked squares), highlight its squares, and show the number of turns it will take (e.g. "3 turns") at the destination.
- Done when: the path avoids occupied/blocked squares and the turn count equals ceil(path length / unit's move per turn).

### M3. Auto-move each turn
- At the start of the owner's movement phase each turn, every unit with a move order walks along its path using its normal move for that turn (same animation as a normal move), then stops.
- Re-plan the path each turn if something now blocks it; if no path exists, the unit waits and keeps the order.
- The order ends when the unit reaches the square.
- Done when: a unit with a 3-turn order arrives on turn 3 without any further input, and re-routes around a unit placed in its way.

### M4. Cancel
- A unit with an order shows a small path marker and a small ✕ icon above it. Clicking ✕ cancels the order. Moving the unit by hand also replaces the order.
- Done when: ✕ removes the order and the path highlight; a manual move replaces it.

### M5. Chase order (drop on an enemy)
- Dropping a unit on an ENEMY unit creates a chase order: each turn it moves toward that enemy (re-planning as the enemy moves), and as soon as the enemy is in its attack range on its turn, it makes its first attack automatically (normal attack rules, costs and responses apply).
- The chase ends when the enemy is defeated, the attack happens, or the player cancels.
- Done when: a chasing unit follows a moving enemy for 2+ turns and attacks automatically when in range.

## Rules for the builder
- Normal game rules still apply: move range per turn, costs, can't pass through units, response windows. NO new rules and NO card number changes.
- Orders are a convenience layer on top of normal moves; the computer opponent is unchanged.
- Change nothing else. Do not touch factory-data/oreheart-8/acceptance. Keep the game under 95 MB.
- Every editor must still match the game.
- Works with mouse and touch (phone).
