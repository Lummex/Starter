# Anvil — Phase A screens to silver (2026-10-31)

Ken: "I like the login. The theme is gold and not the silver. So that needs to be changed."

- factory/issue-12 commit 49d2cdc: every online screen (login, sign-up, birth date, parent email, consent and withdraw pages, forgot/reset password, avatar, welcome, Profile, Contact us, wrong server, can't reach, TEST SERVER bar, the menu's Profile button and Offline chip) now uses the game's silver gem panel and gem-framed buttons. The admin site got a silver palette, silver panels and CSS gem buttons (no pictures allowed there).
- Look only: no flow, text, rule or test-hook changes. Type check clean, both sites build, admin dist still has no images.
- Checked at 1600x900 and 844x390 against a local stand-in server: all buttons on screen, at least 44 px, no clipped text, no gold colours.
- Preview: https://oreheart-8-kevvp2ufr-lummex.vercel.app (Factory — preview only #52); live check: silver login, TEST SERVER bar, connected to the test server.
- Avatars today: the picker shows card art. List = projects/oreheart-8/src/content/avatar-cards.json (65 card ids) and the server's matching settings row `avatar_cards`; picture = pictureOf(card) = /art/cards/<id>.webp (or the owner art path); tiles are 84 px tall, cover-cropped, and 96x96 on Profile.

## Avatars (Ken: "Implement the avatars.")
- factory/issue-12 0d908b9: Brush's painted portraits in the picker (circles in silver rings, grouped by race, race filter; Goggle Rogue first) and in Profile (with a new "Change avatar" button). 16 of 61 pictures are in; the rest appear when their files are dropped into public/art/avatars.
- TEST database: migration 20261031000002 (portrait ids allowed) applied by "Supabase — deploy" #2 after its throwaway-copy tests; 221/221 checks pass locally.
- Preview: https://oreheart-8-p712qsvvt-lummex.vercel.app (Factory — preview only #54).
