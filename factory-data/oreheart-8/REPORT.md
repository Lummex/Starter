## What was built
This is the latest round of Oreheart, the browser card battle. It adds the owner's Oct 24 changes (bonus card draws for mining, white unowned mines), three game modes (Standard, Card Play, Card Comp vs Card Comp), and fixes for earlier failing checks. The title, menu, mulligan screen and painted arena all show up and look finished.

## Try these things
- Click through the title and main menu (Play, Deck Builder, How to Play, Settings), then pick a Commander and start a match.
- On Choose Your Commander, try the three modes. In Card Play, use the four stance buttons on the right edge.
- Start a Card Comp vs Card Comp match and see whether it plays to the end by itself.
- In a match, hover and drag a hand card onto the board. Check that the raised hand doesn't hide too much of the board.
- Open the Deck Builder and try the card close-up and the Commander portraits.
- Mine with several Miners and watch for the bonus card draw on the next turn.

## Automated checks
386 of 412 checks passed. 26 failed. Most are layout or animation checks. The ones that matter most for play:
- A Card Comp vs Card Comp match did not finish in the test.
- The Mine Control stance chose "mine" where the test expected "attack".
- Tapping a mine counted 1 ready Miner where the test expected 2.
- The raised hand covers part of the board in three window sizes.
- Playable hand cards still show a glow when they shouldn't.
- Commander look-back and impatience animations didn't trigger in time.
- Several Deck Builder and Choose Your Commander layout checks failed, as did font-weight checks, a Ranged range check and the tutorial's Skip button.

## Things to know
- Screenshots: the title, menu and mulligan screens look good on desktop. On the phone-size screen, the match is cramped. The raised hand card covers much of the board, and Commander names are clipped at the edges.
- In the desktop mulligan screenshot, the "Grubnak Rotgut" label overlaps the faded Commander name behind it.
- The match start screenshot only shows the mulligan, so I couldn't see a full game in progress.
- I only read the opening of the spec, since the file is very large.

## Recommendation
Request changes: 26 checks still fail, including the new Card Comp match and the hand covering the board, and the phone layout looks cramped.
