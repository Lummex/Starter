## What was built
Oreheart, a comic-style fantasy card battle in the browser. You pick a Commander and a deck, then fight a computer opponent on a painted swamp arena over three crystal mines. This round was meant to add no new features and only fix the failing checks from the previous round.

## Try these things
- Open the preview, click through the intro, and check the main menu (Play, Deck Builder, How to Play, Settings, Quit).
- Click Play and try the "Choose Your Commander" screen on a phone-sized window. Check whether the buttons and deck names overlap.
- Start a match, then drag a creature card from your hand onto a square on your home row.
- Move the mouse over your hand cards. One card should rise and straighten. Check that it doesn't stick or cover the board.
- Click Done to end your turn and watch the computer play.
- Open the Menu (top-left) and try Settings and Give up.

## Automated checks
342 of 399 checks passed. 57 failed. In plain terms:
- About 15 failures are the Choose Your Commander screen. The test can't click the start button because the "Fight!" button sits on top of it. That could be a real layout fault or a check that is out of date. I can't tell which.
- About 10 failures are the hand of cards. The checks could not find any hand cards in those tests. I can't tell whether the hand is broken or the checks are wrong.
- The rest cover Ranged attacks, the Corpsman Brewlord ability, mine-tapping, unit facing after a move, Crystal Flow shard counts, font weights, and Deck Builder layout.
- The window.oreheart test hook is visible outside test mode (AC5). This is minor.

## Things to know
- The goal of this round was to make every check pass. 57 still fail, so that goal was not met.
- Phone screenshots show real problems:
  - On Choose Your Commander, deck names, "Remove", "Copy to my decks" and Easy/Normal text overlap and are cut off.
  - In the match, a large raised card covers much of the board.
- Desktop screenshots look good. The menu and the painted arena render properly. In the match, the hand is mostly tucked off the bottom of the screen.
- The mines look plain white rather than coloured.

## Recommendation
Request changes: 57 checks still fail, and the phone layout of Choose Your Commander looks cramped and overlapping.
