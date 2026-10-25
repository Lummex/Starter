## What was built
This round of Oreheart, the goblin/gnome/dwarf card battle game, added glowing effects on the Crystal Nodes (the mines) in each player's colour. It also gave Bowler Brawler his bowling throw, finger-spin and basketball-shot moves, with a green-flame ball. It also fixed a batch of earlier failing checks, including click controls and the hand of cards. The builder says it was short on budget, so some of this was never fully tested.

## Try these things
- Start a match and look at the Crystal Nodes. They should glow in your colour once owned, and white while unowned.
- Summon Bowler Brawler (it costs 6 crystals, so it may take a few turns). Watch the basketball-shot entrance, the idle finger spin, and his Strike.
- Left-click one of your units to select it, then right-click it. The right-click should open its card and any ability buttons.
- Click a card in your hand. A close-up should open with a "Play this card" or "Cast this spell" button. Also try dragging a card onto the board.
- In Settings, switch to Low graphics and check that the effects calm down and the game still looks fine.
- Try the phone-size view too.

## Automated checks
403 of 426 checks passed. 23 failed:
- About 10 timed out because the test machine was overloaded, not because the game broke (the builder re-ran several alone and they passed). These cover the Commander look-back and impatience emotes, panning, Low graphics, and some screenshots.
- 4 look like out-of-date tests. They concern Goblin Rocket Rider now being a Fighter, a summon test that gives the opponent no crystals, and a model-loading check that doesn't expect Grubnak's 3D model.
- The hand-layout check failed at three screen sizes. Hand cards overlap the bottom of the board, which the builder says is intentional (the owner's closer fan).
- Real, unresolved failures: the Tutorial "Skip" button test, the Mine Control stance (a Miner mined where the test expected an attack), the Card Comp vs Card Comp watch mode (no Pause button), and the Bowler Brawler bowling test.

## Things to know
- The home, menu and match screenshots look polished and complete, with no errors logged. The phone view fits the screen.
- In the match screenshot the hand overlaps the board's bottom edge and the Done and phase text. Nothing is broken, but it is a bit crowded.
- Bowler Brawler's motions and the node effects were never checked in a browser by the builder, so judge them yourself.
- The builder skipped several checks as "outdated" on its own judgement.

## Recommendation
Request changes: several real failures remain (Tutorial skip, Mine Control stance, Card Comp watch mode, Bowler Brawler bowling), and the new visuals were not tested.
