## What was built
Oreheart, a browser fantasy card battle (Goblins, Gnomes, Dwarves) against a computer opponent, with a deck builder, tutorial, 3D characters, a painted arena and music. This latest round (12d) redraws every card face using your own card-format renderer and removes the old card frames.

## Try these things
- Open the preview and click through the intro to the main menu. Check that it looks like your menu design.
- Play, pick Grubnak, and start a match. Look at the cards in your hand: do they use the new card format and fit their text?
- Hover a hand card to raise it. Drag one onto a legal square to summon it.
- Open the Deck Builder and click a card to see the close-up.
- Try Sproingle and Borgo as well as Grubnak. Several tests for them failed.
- Open the preview on a phone held sideways.

## Automated checks
276 of 400 checks passed. 124 failed. The failures fall into three groups:
- **Newest card work (about 12 checks):** the new card renderer, 420:624 card size, artwork positioning and the 8 reference cards. These are the point of this round, so they matter most.
- **Card rules (about 25 checks):** many Round 12c cards (knockback, Ranged ranges, Crystal cards, Rocket Rider and others) did not behave as the spec describes.
- **Older checks (the rest):** many look for a card named "Gutripper Brawler" in the hand and don't find it. Others can't select Sproingle or Borgo. The cause may be renamed or reworked cards, or it may be real bugs. I couldn't tell which.

## Things to know
- The screenshots are not useful. The desktop one shows only dirt with "I AM A GAME DEVELOPER" in it, which looks like a placeholder or the intro animation. The phone one is only the "Please rotate your phone" message. Neither shows cards, the board or the menus, so I couldn't confirm how anything looks.
- The builder's notes are out of date. They describe round 9c, not 12d.
- The builder's own notes say some screens, such as the Deck Builder and Choose Your Commander, don't fully use your menu layout.
- The size limit on the built game (AC90) failed.

## Recommendation
Request changes: nearly a third of the checks fail, including the card-face work this round was meant to deliver, and the screenshots don't show the real game.
