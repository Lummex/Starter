## What was built
Oreheart, a fantasy card battle in the browser. You pick a Commander (Goblin, Gnome or Dwarf) and play one full match against a computer opponent on Easy or Normal. There is also a guided tutorial match, a Rules page and a Settings page with a graphics toggle. The screen is landscape, and a phone held upright shows "Please rotate your phone". The visuals are simple placeholders.

## Try these things
- On first visit, the "Welcome to Oreheart!" box appears. Try "Start Tutorial" and follow the tips.
- Click Play, choose Professor Sproingle and Normal, then Start Match. Keep your hand and play a few turns: drop a creature on your back row, move it toward a crystal and press Done.
- Click a card in your hand to read it. Drag it onto the board to summon or cast it.
- Open Settings and switch Graphics between High and Low. Reload and check it is remembered.
- Open Rules and read the sections and pictures.
- Open Menu in a match and try Surrender. You should see "Defeat" and "Back to Menu".

## Automated checks
49 of 51 checks passed. Two failed:
- **Healing and damaged-Health marking:** the test expected a Dwarf creature to have 3 Health after taking 2 damage from 4. The game shows 2, which is correct arithmetic. The builder believes the test is wrong.
- **Commander damage:** the test ended turns in the wrong order, so its attack happened on the opponent's turn and was refused. The builder believes the test is wrong and the game is right.

I couldn't confirm either claim independently. Neither failure shows a visible problem in the game.

## Things to know
- The screenshots only show the main menu with the welcome box, and the rotate message on a phone. I saw no screenshots of the match screen, so its look and layout are unchecked by me. Please look at it in the preview.
- The menu text behind the welcome box looks dim, which is normal while the box is open.
- Starter decks repeat many Common cards, and no new card names were added.
- Champion's Crown also adds +3 current Health, and Glowing Geode is one-per-board. These are builder choices.
- There is no sound, and the art is placeholder.

## Recommendation
Ready to approve, provided the match screen looks and plays acceptably in the preview.
