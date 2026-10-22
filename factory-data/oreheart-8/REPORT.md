## What was built
This is Round 11 of Oreheart, the card battle game. It adds a "Click to begin" screen so the intro sounds and music can play. It also adds new Settings panels for square highlights and unit rings, tighter mine clicking, a draggable and reorderable hand, and Ranged range raised to 7. The build notes I was given only cover earlier rounds, so I can't confirm from them what the builder says it finished this round.

## Try these things
- Open the preview, click "Click to begin", and check that the intro crash sound and thunder play, then the main menu.
- Click through Deck Builder, Settings and Choose Your Commander. Check that the menu music keeps playing without restarting.
- Open Settings and look for "Square highlights" and "Unit rings". Change a colour, reload the page, and see if it stuck.
- Start a match and drag cards sideways in your hand to reorder them. Check that the real card face follows your finger or mouse.
- Click a creature standing behind a mine. It should be selected, not start mining. Then click the mine's own square, which should mine.
- Check a Ranged unit: the shot should reach 7 squares and stop at the first unit.

## Automated checks
334 of 343 checks passed. Nine failed:
- **Menu music (AC258):** the test couldn't find the "Fight!" button, so the music check never finished. Music may still work, but this wasn't confirmed.
- **Square highlights settings (AC260):** the test hit an error reading the highlight settings, so the new panel isn't confirmed working.
- **Unit rings settings (AC261):** after a page reload the game didn't come back up in the test, so saving the ring colour isn't confirmed.
- **Six older checks (AC96, 109, 139, 209, 210, 239):** these concern button styling, Stronghold squares, Deck Builder layout, the 3D viewer and text colours. The build notes admit several conflict with newer owner layouts. Some are probably stale, but I couldn't verify that.

## Things to know
- The desktop screenshot shows the intro: dirt-textured "I AM A GAME DEVELOPER" lettering on a mine background. It looks intentional but is the owner's placeholder text. The phone screenshot is the "Please rotate your phone" message, which is expected in portrait.
- Only two screenshots exist, both of the intro or gate. I saw no match, menu or Settings screenshots, so the new panels weren't visually checked.
- The Deck Builder and Choose Your Commander screens still don't use the owner's menu layout, according to the notes.

## Recommendation
Request changes: three of the new Round 11 features (menu music, highlight settings, ring settings) failed their checks and weren't visually confirmed.
