## What was built
This round (8b) reworks the game after your playtest. Your Commander now faces the enemy and turns to look at you, and gets impatient if you wait too long. Cards in your hand glow differently, pop out smaller and more smoothly, and creatures show small painted sword, heart and boot icons. The Deck Builder lets you drag cards into the deck list without the layout jumping. "Choose Your Commander" is redone, and body text is now brown-gold.

## Try these things
- Start a match and wait about 20 seconds without clicking. Grubnak should turn to you and look annoyed. Click anywhere and he should turn back.
- Hover over your hand. Check that only that card pops out, at roughly 70% of the screen height, and that it glides smoothly. Then drag a creature across the hand. The hand should not rise.
- Look at a creature on the board. The stats should be small icons with white numbers on them.
- Open Decks, then drag a card onto the deck list. The panels should not shift. Click a card to see the close-up.
- On Choose Your Commander, click Grubnak. The other two should disappear, his 3D model should pop up, and only his decks should show. Check that Fight! is bottom-right, then try "Change Commander" or Esc.
- Check that menu text looks brown-gold rather than white.

## Automated checks
282 of 283 checks passed. The one failure is a test that clicks Sproingle and then picks a saved Grubnak-faction deck, "Miner Rush". Under your new rule, Sproingle only shows his own decks, so that deck is correctly missing. The builder believes the test is out of date, not the game. The check is about the select screen remembering your last choices, so please try that yourself: pick a Commander, deck and difficulty, start a match, then return to the menu.

## Things to know
- The two screenshots I could review show only the title menu and the "rotate your phone" message. They look fine, but they don't show the new features, so I couldn't confirm those visually.
- No new Commander animation was bought. Impatience reuses existing clips (surprised, point, head shake), so it may look less polished than a dedicated animation.
- The stat icons are painted by the builder's own script, not by the image service.
- At phone size the Deck Builder was noted earlier as dense, with small text.

## Recommendation
Ready to approve
