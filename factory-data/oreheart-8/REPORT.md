## What was built
This round rebuilds the match screen. The camera now looks down at the battlefield at the owner's angle and zoom, with painted sky above the far side. The score display, phase tracker, Menu, decks and hand sit at the owner's chosen screen positions. It also adds glowing "flow" particles streaming from mines to Strongholds, a glow on cards you can play right now, ruby-heart health icons, and card reveals that last 5.5 seconds. The game rules are unchanged.

## Try these things
- Start a match and check that both Commanders are fully visible and no part of the screen has black bars. Try resizing the window.
- Hover or click "Menu" at the right side. "Last turn", "Mute", "Card pop-ups", "Recenter" and "Surrender" should slide out.
- Look at your hand. Cards you can afford and play should glow gold. Hover the hand to see it pop up.
- Watch the mines. Particles should flow into the Stronghold of whoever owns the mine. Try Settings > "Flow particles".
- Play a card and check that the reveal lasts about 5 seconds. Check that "Done" appears only on your own turn, in the middle of the screen.
- Look at the top-left and top-right crystals (Flow and bank numbers) and the phase tracker.

## Automated checks
217 of 218 checks passed. The one failure, AC36, is an older check that expects the income text to read "+0 next turn". The game now shows "Next +0", as this round's spec asks. It is a wording mismatch in the old test, not a broken feature.

## Things to know
- I could only view the title-screen screenshots (desktop and phone). They look good: no unstyled or broken elements. The phone shot just shows "Please rotate your phone" because it was taken upright.
- I did not see screenshots of the match screen itself. The automated checks say they rendered, but I can't confirm the look. Please check the match in the preview.
- The builder admits that on a phone, the enemy crystal's text and the phase tracker overlap a little in the top-right.
- The builder also says the enemy Commander may sit partly under the enemy crystal on some window shapes.
- The ruby heart picture was drawn in code rather than painted with the image tool.
- Tiny phone-sized text in the Deck Builder was reported earlier. This round's checks say nothing is under about 14 px.

## Recommendation
Request changes: the match screen, the heart of this round, has no screenshots I could inspect, and the builder reports overlaps on phones. Check the preview first. If the match looks right, it can be approved.
