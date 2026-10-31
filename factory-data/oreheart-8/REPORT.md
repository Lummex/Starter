## What was built
This round added player accounts to Oreheart: a login screen, sign-up with a "When were you born?" question (under-13s need a parent's email approval), server-saved decks, a Profile, and a Contact us form. It also adds a "Play offline (practice)" option that works like the game does today. A small email sender for parent approvals and the admin back counter are meant to go with it.

## Try these things
- Open the preview and look for the login screen. Check that "Play offline (practice)" opens the normal menu.
- Start a vs-computer match offline and play a few turns.
- Try creating an account, once with an adult birth date and once with an under-13 date.
- Open Deck Builder after signing in, then check that your deck is still there after you sign out and back in.
- Open Profile and the Contact us form.
- On a phone held sideways, check that the menu and match fit the screen.

## Automated checks
553 of 570 checks passed. 17 failed:
- **Account-related (4):** one check says "Play offline" may still talk to the server. A non-admin may not be refused properly in the admin site. The file-size check and the owner-notes check (SQL lines, lawyer reminder) also failed. These are the ones that matter most for this launch.
- **Older look-and-feel checks (13):** 3D mines and figures, black bars at some window shapes, hand tucking, a double-tap on phones, the Gnome Plow, and the Starfall spell. The spec said these were already failing and not to be worked on.

## Things to know
- The screenshots (home, menu, match, desktop and phone) look fine. The intro logo shows first, and the board, hand and buttons are styled and readable.
- The screenshots show only the offline game. The login screen and sign-up flow were never captured, so I couldn't check them visually.
- The builder's notes are from an earlier round and say nothing about this round's account work.

## Recommendation
Request changes: the account and admin checks failed, and the offline mode may still contact the server. The login screens haven't been seen.
