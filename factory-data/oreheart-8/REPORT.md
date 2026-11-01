## What was built
This round added player accounts to Oreheart: a sign-in screen, account creation with a birth-year question, a parent-approval path for under-13s, decks saved on the server, a Profile page and ban handling. "Play offline (practice)" keeps the game working as before. The existing game was not meant to change.

## Try these things
- Open the preview and click through the intro. Check that the main menu shows Play, Deck Builder, How to Play, Settings and Quit.
- Start a match (Play, then pick a Commander, then Fight!). Drag a card from your hand onto the board.
- If the preview is connected to the test server, you should see a login screen. Try "Create account" and "Forgot password?".
- On that login screen, choose "Play offline (practice)" and make sure the game starts normally.
- Try the Deck Builder: add cards and save a deck.
- Open the preview on a phone held sideways and check the menu and match fit the screen.

## Automated checks
554 of 570 checks passed. 16 failed:
- **Sign-up (1):** the 13+ sign-up, confirmation email and welcome flow failed. This is the main feature of this round, so treat it as unproven.
- **Hand dragging and touch (6):** dragging a card, the hand tucking away, dropping a card on a square, and double-tapping on a phone.
- **Display (2):** sharpness on high-density screens, and the animated board look.
- **Visuals and spell effects (5):** Starfall and Venom Shiv effects, phone spell effects, the stronghold and Grubnak movement, and the Gnome Plow model.
- **Other (2):** the Tutorial button and the Card Comp watch bar.

The builder says many of these are outdated checks or timeouts. I could not confirm that.

## Things to know
- The screenshots show only the offline game, not the new login or sign-up screens. I could not see those.
- The home, menu and match screens look correct, styled and uncramped on desktop and phone. There were no page errors.
- The builder's notes say nothing was tested against a live server, and the game download is over 95 MB.
- The builder left several older failing checks unfixed and called them outdated.

## Recommendation
Request changes: the new sign-up flow, which is the point of this round, failed its check and was never seen working, and 15 other checks also failed.
