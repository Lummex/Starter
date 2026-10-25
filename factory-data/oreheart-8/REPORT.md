## What was built
This round puts 3D goblin models on the battlefield in place of flat tokens: 12 new models, each carrying its own gear, with walk, attack, hit and defeat animations. If a model fails to load, the game falls back to a token and the match keeps going. The model files were also shrunk so the whole game stays under the 40 MB limit.

## Try these things
- Click Play, pick Grubnak, start a match, and play a Goblin Miner onto your back row. Check that it appears as a 3D goblin with its gear.
- Play several different goblin cards (Boneknocker, Shiv Rat, Scrapsmith Miner). Each should look different.
- Move a goblin, then attack with one. Watch for walk, attack and hit animations, and a defeat animation when one dies.
- Open the Deck Builder, click a goblin card and look at its 3D viewer.
- Play a Gnome or Dwarf unit. It should still look like it did before.
- Resize to phone width and check the board and hand still fit.

## Automated checks
389 of 420 checks passed. Two failures are about this round's work:
- Goblin attack animation: one check found that the attack animation was not playing, though walk, hit and defeat were. Goblins may not visibly attack.
- Model reuse: one check found Grubnak's model loading more than once, instead of once and reused. This is a performance concern, not something you'd see.

The other 29 failures are older checks, mostly about hand layout, hover behavior, the Commander turning to look back, impatience animations, the Commander-choice screen and the Mine Control stance. Many of these were already failing before this round. A few look like slow-loading timeouts.

## Things to know
- The screenshots show the menu and the match at its very start. No goblin models were visible on the board in them, so I could not confirm the models look right. Please check them yourself.
- In the phone screenshot, a raised hand card covers much of the board. The "Tunnel!" tags also overlap there.
- No page errors were recorded.

## Recommendation
Request changes: the goblin attack animation failed its check, I couldn't see any goblin models in the screenshots, and a number of older checks are still failing.
