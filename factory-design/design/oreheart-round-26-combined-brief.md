# Oreheart — Round 26 (combined round: owner edits, model clips, failing checks) — owner, Oct 28 — READ THIS FIRST

**This is the current round. It is the whole job.** The game is `projects/oreheart-8` on branch `factory/issue-8`.

- **Round 24 (Skullflinger skull throw) and Round 25 (card drag on its own) are discontinued as separate rounds.** Do not build them from any older text. Round 25's card-drag work is folded into this brief (item A1). The skull throw that build #55 already put in the game stays exactly as it is: do not remove, redo or extend it.
- If `factory-data/oreheart-8/SPEC.md` still lists Round 24 or Round 25 work, replace that part of the spec with this round. Older round sections in `oreheart-phase-1b-brief.md` are history only.

## Rules for this round (owner)
- **Change nothing that is not listed here.** No new game rules, no new or changed card numbers (cost, attack, health, move, range), no new cards, no renamed things.
- **Do not touch `factory-data/oreheart-8/acceptance`** (never delete, move, rename or commit anything in `factory-data/`). Do not run `git add`, `git commit` or any git command: the factory saves your work itself.
- **Size:** the game is at **92.2 MB**. Keep the built `dist/` under **95 MB** (AC90). Only shrink textures (lower resolution / re-encode); never simplify, re-mesh or re-quantize model geometry and never touch UVs. If something can't fit, leave it out and say so in REPORT.md.
- **Owner art is binding.** Use existing art only; never invent a picture, emblem or icon.
- **Editors must match the game.** Every value you choose or change below goes in `factory-data/oreheart-8/REPORT.md` under **"Editor updates needed"** (what, which file, which editor).
- **Priority if the budget runs out** — do them in this order and stop cleanly at a working state:
  1. A1 card drag, A2 full screen, A6 Done button, A3 paying, A8 Respond window, A10 card flicker,
  2. then A4, A5, A7, A9,
  3. then part B (models),
  4. then part C (failing checks).
  In REPORT.md, list each item as Done / Partly / Not started.

---

## Part A — the owner's edits

### A1. Card drag (owner's top priority)
Owner's words: "I want the mouse pointer in the center of the card, but I want the card to shrink down — as I hover it over, I want it to shrink down like I'm placing it down. So the card should be the same size as the square, so I can see what square I'm placing it in. Also, when the cards are fanned out in my hand, they're too close together."

Where it lives now: `src/ui/app.ts` `cardPointerDown()` builds `.hand-card.dragged-card`, `drag()` moves it; `src/style.css` hangs it by its top-right corner (`transform-origin:100% 0; translate(-100%,0) … rotate(24deg …)`). `cellAt(x,y)` finds the square under the pointer, `squareQuad(row,col)` gives its four on-screen corners, `layoutHand()` spaces the fan with `hand.overlap` from `src/content/owner-layout.json` (HUD piece role `player-hand`).

1. The pointer is in the **exact center** of the dragged card (mouse and touch) for the whole drag. No corner-hang, no offset, no 24° lean. Keep the small pick-up pop and a gentle tilt (≤ 8°, around the center).
2. Over a board square the card **smoothly shrinks (~150 ms) to exactly that square's on-screen size and perspective** (a `matrix3d` from the card box onto `squareQuad`), still centered on the pointer. Moving between squares changes shape smoothly; in gaps keep the nearest square's shape. The card may be ~85% opaque while shrunk.
3. The square under the card is **highlighted** (bright outline above the board, visible around the card). Legal square = normal highlight color; illegal = muted red.
4. Back over the hand (or off the board) it **grows back** to its normal held size.
5. Dropping works exactly as now (places on the highlighted square; illegal drops refused). Reordering the hand, tap-to-enlarge, spells, Crystal cards, Smith swaps unchanged. Works on touch and with Graphics: Low.
6. **Hand overlap 0.2 → 0.26** in `owner-layout.json` (`hand.overlap`), still read from there (no hard-coded number), still squeezing to fit small screens.

Done when:
- **AC370** Real mouse drag (test flag OFF, `page.mouse` in several steps): the dragged card's bounding-box center is within 6 px of the pointer, over the hand and over the board.
- **AC371** 300 ms after the pointer stops over a square, the card's on-screen corners are within 4 px of `squareQuad` for that square (check one near and one far square).
- **AC372** The square under the card has the highlight and the highlight follows the pointer; back over the hand the card's width is within 5% of its starting width.
- **AC373** Dropping on a highlighted legal square plays the card there exactly as before (unit appears, crystals spent as before).
- **AC374** Full hand: neighbouring cards are 0.26 × card width apart at 1920×1080 (or squeezed only when they would not fit) and every card is fully on screen at 1920×1080, 1366×768 and 844×390.

### A2. Full screen at native resolution
1. The game draws at the screen's real pixel density: the 3D renderer uses `setPixelRatio(window.devicePixelRatio)` (cap at 2 only when Graphics: Low) and resizes on window/fullscreen changes, so it is crisp on widescreen monitors and 4K. 2D canvases (if any) are sized by `devicePixelRatio` too. The match fills the whole window (keep the owner's 16:9 letterbox on computers; no stretching).
2. On the **first click/tap anywhere** (e.g. "Click to begin"), request real browser fullscreen (`document.documentElement.requestFullscreen()`; ignore the error if the browser refuses, e.g. iPhone). Do it only once per visit; Esc leaves fullscreen as normal and the game keeps working.

Done when:
- **AC375** With `deviceScaleFactor: 2` the 3D canvas's drawing buffer is 2× its CSS size (or 2× capped as above) and the page has no scroll bars at 1920×1080, 2560×1080 and 3840×2160.
- **AC376** The first click calls `requestFullscreen` once (spy on it); later clicks do not call it again; a refused request causes no error on screen.

### A3. Paying: Flow first, then Bank, ask before using the Bank
1. Every payment (creatures, spells, abilities like Junk Shaman's "Pay 2") takes **Flow crystals first, then Bank** for the rest. (Same total cost as now; this only fixes the order if it differs.)
2. If a payment needs **any Bank crystals**, first show a small pop-up: **"Use your banked crystals?"** with **Yes** / **No** and a **"Don't ask again"** checkbox. Yes = pay and play; No = cancel (card goes back to hand, nothing spent). Ticking "Don't ask again" + Yes stops the question from then on.
3. In **Settings** add a switch **"Ask before using banked crystals"** (on by default; turning it on brings the question back). Save it like the other settings.
4. The computer opponent never sees the pop-up. Test mode (`window.__app.test = true`) skips it like the other pop-ups.

Done when:
- **AC377** With Flow 2, Bank 3, playing a cost-4 card shows the pop-up; Yes leaves Flow 0, Bank 1; No leaves Flow 2, Bank 3 and the card in hand.
- **AC378** With enough Flow, no pop-up appears and the Bank is unchanged.
- **AC379** "Don't ask again" + Yes → next Bank payment has no pop-up; turning the Settings switch back on brings it back (also after reload).

### A4. Commander chat bubbles smaller
Commander speech bubbles (`.speech`, `public/art/speech/`) about **35% smaller** than now, same position anchor, still readable. Unit speech bubbles unchanged. Put the new scale in REPORT "Editor updates needed".
- **AC380** A commander `.speech` bubble's width is 60–70% of what it was in the previous build at 1920×1080.

### A5. Mine-all pickaxe fully visible
The "mine with every ready Miner" pickaxe badge on the crystal mines (`span.pickaxe` with `×N`, app.ts ~line 2061) is fully visible: not clipped by the mine, the board edge, a parent's `overflow`, or other HUD pieces, at all screen sizes. Same look otherwise.
- **AC381** When the badge shows, its whole bounding box is inside the viewport and not covered (`elementFromPoint` at its center and 4 corners inset 2 px returns the badge or its children) at 1920×1080, 1366×768 and 844×390.

### A6. Done button
1. When you press **Done**: if you made **any move this phase** (played a card, moved, attacked, mined, used an ability), the phase ends **with no question**.
2. If you made **no move this phase** and moves are still available, show a **drop-up menu that opens upward from the Done button**, in the same style as the match **Menu** pop-up (see-through dark box, black border, same font and buttons): text **"Moves still available (miners haven't mined). Continue to the next phase?"** with **Continue** and **Go back**. Continue = end the phase; Go back = close it. Clicking outside also closes it.
3. If no move is possible at all, Done ends the phase without the question (as auto-skip does now). This replaces the old centered "Moves still available!" dialog (`remindMoves`, app.ts ~1945); keep the existing setting that turns reminders off working for the new drop-up.

Done when:
- **AC382** After playing one card, Done ends the phase immediately with no dialog.
- **AC383** With no move made and a ready Miner next to a mine, Done opens the drop-up: its bottom edge is within 12 px above the Done button's top edge, it has the text above, Continue ends the phase, Go back keeps the phase.
- **AC384** The drop-up's background is semi-transparent dark and its border black, matching the Menu pop-up's computed styles.

### A7. Mine owner shows the faction emblem
The owner overlay on a controlled mine (now the faction symbol emoji, e.g. 💀, from `FSYM`, app.ts ~line 2053) shows the **owning faction's emblem picture** instead. Use the owner's existing emblem art from the Card Format (`public/art/card-format/format.json` → spell layer "Prismatic Crystal World Emblem" `byFaction`): goblins `images/2298e4af.webp`, gnomes `images/42e54bde.webp`, dwarves `images/e56e3c50.webp`. Use exactly that mapping (read it from format.json, do not swap colors). Do not draw a new emblem. Unowned mines unchanged.
- **AC385** A mine controlled by a Goblin player shows an `img` whose src ends with the goblin emblem file; a Gnome/Dwarf-controlled mine shows theirs; no 💀/⚙️/🔨 emoji remains on mines.

### A8. Respond window bigger and easier
The "Respond?" window (`openRespond`, app.ts ~2318/2404): **30% bigger** box, bigger text (~1.3×), buttons compact but easy to click (at least 44 px tall, clear gaps between them). Must still fit fully on a phone held sideways (844×390) without scrolling the page. Timer and logic unchanged.
- **AC386** At 1920×1080 the Respond box is 1.25–1.35× its previous width and height; every button is ≥ 44 px tall; at 844×390 the box and all buttons are fully on screen.

### A9. Junk Shaman lift: you choose where it lands
Card rule (unchanged): *Pay 2: pick up one character within 5 spaces (ally or enemy) and move it to any space within 5 spaces of this card.* Today the game picks the landing square itself (`bestShaman`, app.ts ~3057).
1. After choosing the character to lift, it **follows the mouse/finger** (lifted a little above the board) and the **legal landing squares are highlighted**; the square under the pointer gets the strong highlight (same style as A1).
2. **Clicking/tapping a highlighted square drops it there.** Clicking an illegal square does nothing; Esc / right-click / clicking the Shaman again cancels with nothing paid.
3. Keep every rule limit: pick-up target within 5 spaces of the Shaman, landing square within 5 spaces of the Shaman, landing square must be empty (and allowed for that unit), pay 2 (Flow first, A3), once per the existing limits. The computer opponent keeps using `bestShaman`. Write the limits you enforce in REPORT.md.
- **AC387** With the test flag OFF, using the lift then clicking a chosen legal square puts that character exactly on that square; 2 crystals are paid.
- **AC388** Squares farther than 5 from the Shaman are not highlighted and clicking them does nothing; cancel pays nothing.

### A10. Cards flicker / go see-through on hover — find and fix
Hovering hand cards (and the close-up) sometimes makes them flicker or turn see-through. Find the real cause (likely candidates: hover/pop classes toggled every frame by `pointerenter`/`pointerleave` on overlapping cards (app.ts ~2250), an `opacity` transition fighting the pop animation, or the shrink-opacity from A1 leaking onto hand cards) and fix it. Write the cause in REPORT.md.
- **AC389** Moving the mouse slowly across the whole hand (≥ 40 steps) and holding still on a card for 1 s: no hand card's computed opacity goes below 0.99 and the hovered card's pop class does not toggle more than once per card entered.

---

## Part B — models: use the new clips and the owner's Model Editor setups

### B11. Play the OH_ clips, not old Meshy clips by position
`src/ui/creature3d.ts` picks clips by name **or by position** from the old Meshy list (`c.animations[i]`, line ~112) and only reads `events.json` for attacks. Change it so that, for every creature:
1. If `models.json` has a **`clips` map** (e.g. `idle → OH_Idle`, `walk → OH_Walk`, `attack → OH_Attack`, `hit → OH_Hit`, `death → OH_Death`, reactions, `special`) and/or `events.json` lists clips, use **those clip names**. Never fall back to "the clip at the same position".
2. If a role has no clip in the map (e.g. no `OH_Death` yet), use the old Meshy clip for that role **by name** only, and list it in REPORT.md as "missing clip".
3. Events in `events.json` (e.g. `projectile_release`) keep working (Skullflinger's throw must stay the same).
- **AC390** For every creature with a `clips` map, the clip playing in idle/walk/attack/hit is the one named in the map (check `current()` / the mixer's active clip name).
- **AC391** Skullflinger still plays `Skull_Throw` with the release at the `events.json` time (AC358–AC360 keep passing).

### B12. Parts placed like the owner's Model Editor
The owner's Model Editor setups are exported (by Ledger) to **`factory-design/design/models/editor-setups-2026-10-28.json`** on main (plus any parts GLBs it lists, next to it). Read that file. For each character in it, copy the **accessory setup** (bone, position, rotation, scale) into `PARTS` in `creature3d.ts` so weapons/items sit exactly like in the editor: grunt (frying pan at his side, not behind his back), slinger (skull in hand), junk-shaman (staff as in the editor), skullbasher-rusher (mace + big shield in left hand), shiv-rat (dagger + **backpack**), and any others in the file. Copy listed part GLBs into `public/models/creatures/<id>/`. **Heights stay as they are now** (the owner says they don't matter yet).
- **AC392** For each character in the setups file, each part's bone and local position/rotation/scale in the game match the file within 0.001.
- **AC393** Every part listed in the setups file loads (no missing GLB) — e.g. `shiv-rat/backpack.glb`.

### B13. Thunderwing Gyronaut (`gyrocopter-ace`) gear and clips
Add its gear (gyro wings / propeller) from the setups file (B12), use the newest gyronaut model/parts listed there, and add `events.json` + a `clips` map in its `models.json` for the clips its GLB actually has (OH_ names where present). If OH_ clips are not in the GLB yet, map the existing clips by name and list what is missing.
### B14. Aegis Tinkerer (`gnome-tinker`) gear and clips
Same as B13: scepter, crystal shield and wrench from the setups file, `events.json` + `clips` map.
- **AC394** `gyrocopter-ace` and `gnome-tinker` each have `events.json` and a `clips` map whose clip names all exist in their `char.glb`, and every part in the setups file for them is attached in a match.

(Only use what is in the setups file and the model folders. Do not make, re-export or re-compress any model's geometry. No Meshy.)

---

## Part C — fix the failing checks the factory reported
Fix the game (not the checks), unless the check is out of date because of an owner change; then update that check and say why in REPORT.md.
1. **Phone / odd-window layout off by up to 75 px** (HUD/hand position checks at phone and unusual window sizes).
2. **Tutorial Skip** button.
3. **Mine Control stance** (decide from the GDD whether a Miner should mine or attack there; fix whichever is wrong).
4. **Card Comp vs Card Comp watch mode Pause** (watch bar is bottom-right, scale 0.58 by the owner: keep that; Pause/Play/Exit must work).
5. **Bowler Brawler bowling** check.
- **AC395** All five pass, and every other existing check keeps passing (only update checks that test the old corner-hung drag card, the old centered "Moves still available" dialog or the old mine emoji).

---

## Editor updates needed (write in REPORT.md)
Hand overlap 0.26; drag shrink time, opacity, highlight colors, tilt limit; pixel-ratio cap; Bank pop-up setting; commander bubble scale; Done drop-up style; mine emblem mapping; Respond window sizes; Shaman lift highlight colors; every PARTS value copied from the setups file and every clips map added. Size of `dist/` at the end.
