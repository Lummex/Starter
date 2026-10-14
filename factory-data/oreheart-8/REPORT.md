## What was built
Oreheart, a fantasy card battle in the browser. You play one full match against a computer opponent (Easy or Normal), or a guided tutorial match. The newest rules are in: crystals come from creatures standing next to mines, mines change color, and you can swap places with your own creatures. The game is meant for a phone held sideways.

## Try these things
- Open the preview and choose "Start Tutorial" in the welcome pop-up. Follow the tips through the first steps: summon, move, swap.
- Press Play, pick a Commander and difficulty, then Start Match. Keep your hand and play a few turns.
- Drag a card onto your back row to summon it. Then drag a creature next to a mine and watch the mine's color and the "+N next turn" number change.
- Tap a crystal site to see who controls it and what it pays.
- Check Rules and Settings (the Graphics toggle). Turn your phone upright to see the "rotate" message.

## Automated checks
70 of 73 checks passed. Three failed:
- **Movement test (AC12):** it expects that you can't move onto your own creature. The newer swap rule says you can, so the test appears to conflict with the spec.
- **Healing test (AC14):** it expects a creature to have 3 Health left, but the correct figure under the rules is 2. The test's own numbers look wrong.
- **Commander damage test (AC16):** the test presses Done once too often, so its attack is correctly refused.

The builder believes all three are mistakes in the tests, not in the game. I couldn't confirm that independently.

## Things to know
- The only screenshots available show the menu welcome pop-up and the "rotate your phone" screen. Both look clean. There are no screenshots of the match screen, so its look, its layout and the 3D battlefield are unchecked here. Judge them in the preview.
- A just-summoned Gatherer looks "darkened" even though it can still move.
- Visuals are simple placeholders and there is no sound.

## Recommendation
Request changes: the three failing checks are unresolved, and no match-screen screenshots were available to confirm the layout. Approve only if the preview looks and plays well.
