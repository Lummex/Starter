## What was built
Oreheart, a fantasy card battle for the browser. Goblins, Gnomes and Dwarves fight over three crystal sites, and you win by taking the enemy Commander from 20 Health to 0. It has one full match against a computer opponent (Easy or Normal), all 41 starter cards, three Commanders, a menu, a How to Play page and a Graphics High/Low switch. The 3D figures are simple placeholders.

## Try these things
- On the main menu, click Play, pick a Commander and difficulty, then Start Match. Keep your hand at the Mulligan prompt.
- On the match screen, click Done to step through Deploy, Movement and Attack, then watch the computer take its turn.
- Click a card in your hand to read it. Drag a card onto the board to summon it or cast it.
- Open How to Play, then press Back.
- Click "Graphics: High" to switch it to Low, reload the page, and check that Low is remembered.
- Open Menu during a match and try Surrender. You should see "Defeat" and a way back to the menu.

## Automated checks
35 of 38 checks passed. Three failed, and all three have the same cause. The tests look for a button named "Play" but also find "How to Play", so they can't tell the two apart. The builder's notes say this was fixed, but it wasn't: "How to Play" is still a normal button. The failed checks cover:
- main menu loading
- the Commander → Mulligan → match flow
- the phone-screen fit

The menu itself appears to work, so this is probably a test-matching problem. But those three checks never got past the menu, so none of them confirmed what they were meant to.

## Things to know
- I only had menu screenshots, and they look fine on desktop and phone: styled, centered, no cramped spacing, no page errors. There were no screenshots of the match screen, so I couldn't check its layout, the 3D scene or the hand fan.
- The phone fit of the match screen is not confirmed.
- Not included, as planned: sound, polished art, deck building and online play.

## Recommendation
Request changes: fix the "Play" / "How to Play" button naming so the three failed checks can pass, then confirm the match screen on a phone.
