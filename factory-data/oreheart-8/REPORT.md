## What was built
This round changes the board and the deck rules. The camera now looks straight down the board like a road. Each Stronghold sits in its own corner: yours at the bottom-left and the enemy's at the top-right. Mines are placed as mirror images corner to corner. Decks can now hold 50–100 cards, with up to 20 Crystal cards. There are nine ready-made starter decks, three per faction (Warband, Arcane Hoard, Horde), and the computer picks one of its own faction's. Both hands were also moved clear of the Commanders.

## Try these things
- Start a match and check that the board looks straight-on, with your Commander at the bottom-left and the enemy's at the top-right.
- Look at your hand along the bottom and the enemy's card backs along the top. Scroll your hand with the left and right buttons, and check that no enemy card is cut off.
- On the Commander select screen, pick each Commander and check the deck row. You should see that faction's three decks first, then the other six.
- Tap a creature and check that its card pops up at a readable size.
- Open Decks and try Auto-fill. Check the new "50 to 100 cards" and "20 Crystal cards" messages.
- Play the Tutorial all the way through, because its layout was redrawn.

## Automated checks
170 of 172 checks passed. Two failed:
- **AC9 example (b)** and **AC27 (summoning costs)**. Both are older tests that summon a creature on row 7, column 2. That space is now your Stronghold, and the new rules say nothing can be placed there. The builder believes these are outdated tests rather than game bugs. The summoning cost rules themselves were not what failed.

## Things to know
- The two failing tests were not fixed. They need updating by someone, or the owner could decide the rule should work differently.
- The screenshot folder only contains the title screen (desktop and phone). The phone-size match and deck-picker screenshots were not there, so I couldn't inspect them. The phone image shows only "Please rotate your phone".
- The desktop title screen has a "Welcome" pop-up whose text overlaps the Tutorial menu button. This is cosmetic.
- The builder says the oversized Commanders slightly overlap neighbouring spaces, though creatures there can still be tapped.
- Visual polish and the new 3D models are not part of this round.

## Recommendation
Request changes: two older tests fail because they conflict with the new Stronghold rule, and the match and deck-picker screenshots needed to check the new layout weren't available.
