## What was built
Round 10 of the Oreheart card game: stronger colored highlights when dragging, played cards popping up at the screen edges, touching mines, a clickable whole mine, and new rules (a dying basic Miner draws a card, Ranged shoots in straight lines up to 5 squares, Crystal cards and Tunnel usable any time). It also adds Crystal Flow into the HUD counters, a bigger card close-up, a lower-tucked hand, and flat mines with a ground glow.

## Try these things
- Start a match, drag a hand card or creature: squares should glow in your faction color, and attack squares should be red.
- Play a few cards: yours should pop up at the right edge, the enemy's at the left, stacking up to 3.
- Click a mine anywhere on its model (even the crystal tip). It should mine.
- Click a card: the close-up should fill most of the screen height. Click outside it, or press Esc, to close it.
- Check the hand sits low with about a quarter showing, then rises when you hover it.
- Pick Grubnak on "Choose Your Commander" and check the other Commanders hide and "Change Commander" works.

## Automated checks
313 of 332 checks passed; 19 failed.
- 8 failures come from older checks that contradict the new Round 10 rules (for example mines now may touch, Tunnel summons off the back row, and the hand now rests lower). Probably not real bugs.
- Not explained by the rule changes: a dying basic Miner not drawing a card (AC247, a Round 10 feature); the Round 10 mine-glow details not reported (AC252); updated rule texts missing "dies/draw" wording (AC255).
- Also failing: the Commander is turned about 79° off his intended facing (AC230); "Change Commander" is blocked by deck pictures covering it (AC206); the 3D viewer shows on a spell-like card close-up (AC209); some Deck Builder text isn't the right color (AC210); one mine test timed out (AC245).

## Things to know
- The only screenshots provided are the opening screen (an "I AM A GAME DEVELOPER" dirt-lettering intro, looking intact) and the phone-upright screen asking you to rotate. None show the new Round 10 features, so I couldn't confirm them visually.
- The builder admitted the drag-highlight attack squares, enemy pop-up stack and flow stream were never checked in a browser.

## Recommendation
Request changes: several Round 10 items (Miner death draw, rule texts, mine glow, Commander facing) fail their checks and weren't visually verified.
