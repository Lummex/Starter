# Anvil-online report: the Deck Builder in design D (Nov 6, 2026)

Branch `pvp-nov2` on Lummex/Starter. Nothing is live; TEST database only. Preview link: https://oreheart-8-quoswc2a4-lummex.vercel.app (Deck Builder only, b3b8042f); the later preview https://oreheart-8-7e99crrof-lummex.vercel.app (46772db9) has it together with Regions and the three follow-ups

## What changed
The Deck Builder is now the approved design-D screen (studio/screens-D-nov5/set2/deck-builder-pc.png and -phone.png, Ken: "looks great make it so", Nov 5), online and offline:
- **Your decks** (left): a vertical list of your saved decks with the Commander, Valid / Not ready and the card count, "n of max" in the title, + New Deck, Rename.
- **Deck check** (left, below): the deck problems as a ✓ / ✗ list, the counts, and the deck rules in words.
- **Card pool** (middle): the "N of M shown" count, the Faction / Type / Cost / Rarity dropdowns as silver chips, the cards-per-row slider, the search line, the card grid. Every tile shows "2/3 in deck" and the owned copies / lock as before; the selected card is outlined.
- **Card detail** (right of the pool): the selected card large, its name, faction · kind · rarity · cost, the full text, "In this deck n / limit · own m", Add to deck / Take one out / See it large. Signed in, the same Upgrade panel as the close-up (your copies, Hold / Upgrade, Combine, the five looks) sits inline under the card; the card above follows the look you click.
- **Deck** (right): the deck's name and size with the deck picture, the Commander portraits, the crystal curve with "avg cost · crystal cards", the deck list (+ / − and the per-copy tier chips), Auto-fill, Play, and the big SAVE DECK button; the hall picture behind still follows the faction filter.
- Phone landscape (≤ 900 px): Decks / Cards / List tabs in the header, the card detail on the right.
- Online the top bar and "‹ Dashboard" are the dashboard's; offline a plain Back.

Code: `src/ui/decks.ts` (the same builders, re-placed; a detail column; the vertical deck list) and a new sheet `src/ui/deck-d.css` (every rule `!important` under the `html body:not(#_a):not(#_b):not(#_c) #app .dash.deck-d` prefix, because the older sheets reach these classes with `!important` rules of their own; lessons in studio/team-lessons.md). The old Menu Builder zones of the screen are kept in `projects/oreheart-8/_discontinued/menu-builder-deck-zones-nov6/deck-zones.json`.

Not built (not in the game yet, so no dead buttons): Import code / Share deck from the mockup; a Delete button in the deck list (Remove stays on Choose Your Commander).

## For Ledger (the Menu Builder)
The `deck` screen in `src/content/menus.json` (pieces dTitle, dFilters, dSlider, dGrid, dDecks, dList, dCount, dActions, dBack) is no longer read by the game, the same as the Commander screen's cTitle / cCards / cDecks / cStart / cBack since Nov 6. The Menu Builder should either retire those two screens (keep only `intro` and `main`, which the game still draws from the file) or grow a "design D" mode that edits the D kit's measures (column widths, panel padding, the em scale) instead of free boxes. Until then, moving those pieces in the editor changes nothing in the game; AC233 now checks that neither screen has owner boxes.

## Checks
Ran on the built game (vite build, preview on 4178, mock PvP server): 36 Deck Builder checks pass (AC60/61/62/70/71/121/135/136/137/138/140/141/142/143/144/145/148/158/167/168/169/170/171/183/233/238/239/240/241/242/316/321/674/686/687/688/689; AC209 skipped, no Grubnak models.json on the rig) plus the deck-related sweep (AC1/72/73/93/95/113/129/146/162/19/203/205/206/213/282/285/338/417/423/460-464/483/511/512/514/516/536/656/666); AC111, AC205 and AC672 were failing from earlier days and are fixed in 46772db9.
Check changes, all named in their titles: AC137 (unboxed buttons) now only confirms the Deck Builder's five buttons exist, the way Settings was handled (a D screen); AC158 (no text under 14 px at phone size) skips the D screens, which use the D kit's phone sizes (it had been failing on the D Settings screen since Nov 6); AC233 (owner boxes) checks the main menu's boxes and that the two D screens fill the window with no owner boxes (it had been failing on the Commander screen since Nov 6).
Also fixed in passing: the Upgrade panel wrote a literal "null" under the five looks of a card with upgrade art (close-up and inline).
Not run: the full hidden suite; a real phone.
