## What was built
Oreheart is a comic-style fantasy card battle for the browser. You play Goblins, Gnomes or Dwarves against a computer opponent (Easy, Normal or Hard), fighting over three crystal mines on a 13×7 board. This round's goal was to make every card actually do what its text says, including special abilities such as slides, shockwaves, wards and decoys, with new on-screen controls for aiming them.

## Try these things
- Start from the intro screen, then pick Play, choose a Commander and finish the mulligan.
- Drag a creature card from your hand onto a glowing square on your side of the board.
- Select a creature and try its special ability, using drag-to-aim or the tap menu.
- Cast a spell card on an enemy and watch the result.
- Open the Deck Builder and look at the starter decks.
- Open the preview on a phone held sideways and check that the match fits the screen.

## Automated checks
281 of 394 checks passed, so 113 failed. The failures are spread across the board layout, hand pop-out, creature labels, Deck Builder, some menus, the Ranged attack and card text. They also include some basic rule checks (Shield, Commander damage, Snuff Out, Pickpocket) and two starter-deck card counts. The latest team note says the earlier failures are mostly old checks that no longer match the owner's updated card data, but I could not confirm that for each one. Treat the failures as unresolved. They may be outdated tests or real bugs.

## Things to know
- The desktop screenshot shows only the intro screen, with dirt lettering reading "I AM A GAME DEVELOPER". It looks like leftover placeholder text. It never shows an actual match, so I could not see the new abilities in the screenshots.
- The phone screenshot is a "Please rotate your phone" message on a dark screen. That is expected in portrait, but it also shows no match.
- No page errors were recorded.
- The build notes I found are from an earlier round (9c), not this one. They say the Deck Builder and Commander screens don't fully use the owner's menu layouts yet.

## Recommendation
Request changes: over a quarter of the checks fail, and the screenshots don't show the new abilities working. Please confirm which failures are outdated tests and which are real bugs, and replace the placeholder intro text.
