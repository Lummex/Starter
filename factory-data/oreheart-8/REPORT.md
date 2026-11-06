## What was built
This round was a clean-up of the Oreheart card battle game: making the last round's new features (card dragging, "Done" pop-up, mine emblems, full-screen sharpness and more) work, and fixing older broken checks. No new features or rule changes were intended.

## Try these things
- On the main menu, hover and click Play, then pick a Commander and deck and start a match.
- Drag a card from your hand onto a lit square on the board and see if it plays there.
- Hover over your hand: the cards should rise and neighbours should move aside.
- Click "Done" without making a move and see whether a "go back / continue" pop-up appears.
- Click a crystal mine with a Miner next to it, and try the Menu in the top-left.
- Open the preview on a phone held sideways and play a few turns.

## Automated checks
423 of 463 checks passed. 40 failed. Many relate to Round 26's own new items:
- Dragged card staying centered on the pointer and shrinking onto the square.
- The "Done" drop-up.
- The mine emblem and pickaxe badge.
- Sharp full-screen drawing, and smaller speech bubbles.
- The round ability buttons, the Card Comp watch bar, the Mine Control stance, mulligan layout and some model animations.

The rest are older checks (mine tapping, fonts, menu list, card close-ups). The builder says some of these checks are outdated or time out on a slow test machine, but I couldn't confirm that.

## Things to know
- The screenshots show the menu and match looking finished and styled. No page errors were recorded. The phone match screenshot looks cramped: a large card close-up covers much of the board, and the "Tunnel" label is cut off.
- The match screenshot shows three white mines with "+0/+0" labels and no units yet. That fits the very start of a match.
- The builder's notes are old and don't cover this round's work.
- The previous test file reports the Menu holding two extra items ("Square highlights", "Windowed"), which contradicts the owner's six-item menu.

## Recommendation
Request changes: 40 of 463 checks still fail, including several of this round's own headline features, so the build did not meet its goal.
