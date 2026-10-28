## What was built
This round gives the Skullflinger goblin a new skull-throwing attack: a skull leaves his hand, flies to the target, bonks off it and bounces away. It also re-checked earlier work, including the card hand layout and Bowler Brawler's moves, and fixed a few bugs. No rules or card numbers changed.

## Try these things
- Start a match as Grubnak and summon a Skullflinger. Attack an enemy with it and watch for the skull throw and bonk.
- Hover over, then drag, cards in your hand. The hand should fan out, rise on hover and tuck away when you leave it.
- Summon a Bowler Brawler (costs 6) and try his Strike ability.
- Open the Menu in the top-left corner during a match.
- Open the preview in a phone-sized window and in a wide computer window. Check that nothing is cut off.

## Automated checks
404 of 438 checks passed. 34 failed:
- **Likely out of date (about 6):** these tests expect things the owner has since changed. Examples are Goblin Rocket Rider being a Miner and the 4:3 window shape. The builder says the game is correct.
- **Timeouts (about 8):** the test computer was too slow to run them in parallel. The builder says they passed when run alone. I did not see that myself.
- **Possibly real (the rest):**
  - Menu and board placement on some phone-sized and non-16:9 windows is off by up to about 75 pixels.
  - A few font and weight checks failed.
  - The match-screen Mulligan check timed out.
  - Some hand-fan spacing and tuck checks failed.
  - Bowler Brawler's basketball summon and the Skullflinger skull timing checks failed.

## Things to know
- The skull throw was never seen mid-air in a screenshot, because the test machine was too slow. Judge it yourself in the preview.
- The builder's notes say this round was budget-limited, and several earlier problems are listed as "not addressed".
- The screenshots look good. The title screen and the desktop match are styled and complete. The phone match looks fine, but the enlarged hand card covers a lot of the board.
- I only saw some of the screenshots, because the phone home and menu images were not all available.

## Recommendation
Request changes: 34 checks still fail, and some of those look like real layout bugs on phones. The skull throw has not been seen working.
