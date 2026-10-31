# Anvil report, 2026-10-31: Oct 31 playtest batch (lag, notes 1-7, real-world heights, gear, Bearer skin)

Branch factory/issue-8 at 2772cc66 (on top of the cheating fix 41823716). Preview: https://oreheart-8-putdnyzry-lummex.vercel.app (Factory — preview only run 41183744091)

## What changed
1. **Lag** (Ken: "stuttery and laggy ... spurts of lag, especially when you mine or make a lot of movements"). Two causes, both fixed:
   - The computer's thinking ran on the main thread (Hard: up to 1.2 s a turn in 50-300 ms chunks), freezing the drawing. It now thinks in a Web Worker in live matches (test mode stays synchronous, so replay checks are unchanged). Enemy turn in Chrome: 38 fps with frames up to 1 s -> 57 fps, longest frame 81 ms.
   - Every action rebuilt the whole hand (two caches shared one key). A mine action cost 81 ms, now 14; a move 10-12 ms, no long tasks. The acting ring is no longer searched through every model every frame.
2. **Choose Your Commander** (note 1): no box behind the cards; a click selects the card, no 3D pop-up; arrows either side page through the Commanders (keyboard arrows too); game modes and the deck picker on the right (room for the four starter decks per faction); Fight!, mode and difficulty text fit inside the silver art. Two Menu Builder pieces moved (cCards, cDecks) in both menus.json copies: Ledger/Wright to mirror in the Studio.
3. **Missing equipment** (note 2): the gear that was missing had no game wiring (not the resize). Now showing: the Gemsinger Miner's pickaxe, Knobbin's staff, Gearward Sentinel mace + gear shield, Aethervein's two pickaxes, Arcsmith's pickaxe; items load with the body. Ledger owes Studio placements for the ones placed by the grip rule (list sent to Ledger).
4. **Real-world unit heights** (Ledger's table from Ken): every model is measured standing (idle, body only) and scaled so it stands table squares × creatures (creatures back to 1). Riders set the mount's scale. Troll Tyrant and Arcane Colossus are the tallest; no unit over 2.9 squares. The 3x rule and the soft cap are gone.
5. **Enemy discard pile** (note 3): a touch higher; cards slide out from the left edge, no frame; still scrolls; Escape or a tap outside closes.
6. **Drag icon per faction** (note 4): dwarves gear, gnomes eye, goblins the goblin-king emblem (Card Format art).
7. **Ability overlays** (note 5): the "Tunnel!" tag is gone; nothing is layered over cards.
8. **Hand** (note 6): the ghost was the raised card's helper copy sliding in from the old spot while the card jumped; both now move together in one 160 ms ease-out, no fixed GPU layer (no blur), whole-pixel landing. Positions and spacing unchanged.
9. **Double-click to play** (note 7): the double-click window was 250 ms, too short; now 380 ms for mouse and touch.
10. **Riot Shield Bearer**: Clay's dark-skin recolour.

## Checks
New: AC422-AC425 (free Bearer once; referee over full AI matches; worker path; no hand rebuild), AC430-431 (heights, gear), AC440-445 (double-click/tap, smooth hand, no overlays, drag icon, discard pile), AC460-464 (Choose Your Commander). Owner check changes (Ken, Oct 31): AC50, AC146, AC206-208, AC218, AC254, AC282, AC346, AC367, AC419.
Full suite on the merged build: 455 passed, 5 flaky (pass on rerun), 20 failed. Rerun alone and against the untouched base 90410c08: AC219, AC261, AC364, AC368, AC370/372 fail the same way on the base (pre-existing); AC379 fails on the base and passes now; AC190, AC256, AC362, AC375 were load timeouts and pass alone; AC212/AC326 are the known Windows line-ending byte counts; AC419 was the Gnome Plow height pinned at the old Studio value (owner check change). Unit tests: 185 pass, 8 long-standing failures (owner assets, round 12b models, R8 cards).

## What to try (Ken)
- Play a Hard match: the enemy turn should stay smooth; mine and move several units in a row.
- Choose Your Commander: arrows, click a card, modes and decks on the right, Fight! text.
- Look for gear: Knobbin's staff, the Gemsinger's pickaxe, Gearward, Aethervein; unit sizes (Troll, Colossus, gnomes smaller).
- Enemy discard pile; drag a gnome and a dwarf (icons); hand focus motion; double-click a card.
