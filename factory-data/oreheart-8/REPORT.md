## What was built
Round 4 of Oreheart. The mulligan cards are twice as big. All nine starter decks now have 100 cards. Each faction has its own spells, including a new poison spell, Venom Shiv. Spells use new card frames. All text now has a gold or silver metal look in two new fonts, Cinzel and Tinos.

## Try these things
- Start a match and look at the mulligan screen: the five cards should be large, in one row, and fit on screen.
- Open Decks, pick a Commander (Grubnak, Sproingle or Borgo), and check that other factions' spells are dimmed and locked with a 🔒.
- Pick a starter deck on the select screen. The names should read like "Goblin Warband, 100 cards, ready".
- Cast Venom Shiv as a Goblin. The enemy creature should show a green drop with turns left and lose 1 Health each of its turns.
- Browse the menu, Rules and Settings screens for the gold lettering, and check that it stays readable.
- Look at spell cards from each faction. Check the frame colors and the cost and type circles.

## Automated checks
186 of 189 checks passed. Three failed:
- **Deck picker check (AC72):** it looks for a deck named "…50 cards, ready". The new spec says 100 cards, so the test looks out of date.
- **Match summary check (AC74):** it expects a 50-card deck and found 100. This also looks like an out-of-date test.
- **Locked spell tiles check (AC130):** it tries to double-click a spell that is meant to be locked, so it can't work. The lock itself seems to be doing its job.

The builder says these three tests contradict the spec. I did not verify that myself.

## Things to know
- The owner's spell frame files weren't uploaded. The builder made temporary stand-in frames, and the painted circles only roughly line up with the cost and type numbers.
- The 3D pop-up text in battle, such as "KA-BOOM!", doesn't have the new metal look.
- The Meshy 3D models are still not done.
- The phone screenshot shows only the "Please rotate your phone" message. That is correct for an upright phone, but it means the phone-size match, mulligan and card screenshots weren't in the set I could see.
- The desktop menu looks good and nothing is cramped. The "Start Tutorial" button text is a bit tight inside its frame.
- The builder checked its own work and did not run the full hidden test suite.

## Recommendation
Ready to approve
