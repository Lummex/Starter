# Oreheart — Round 25 brief: placing cards (drag) and a wider hand (owner, Oct 28)

Read this first. This round is **small and only about the feel of dragging a card from the hand onto the board, plus the spacing of the hand fan**. The game is `projects/oreheart-8` on branch `factory/issue-8`. Everything else stays exactly as it is now.

**Not in this round:** Round 24 (Skullflinger's skull throw, at the top of `oreheart-phase-1b-brief.md`) is on hold and must **not** be built now. Do not change rules, numbers, menus, models, art, sounds, arenas, camera or test hooks. Do not touch any 3D model file.

## The owner's words
> "When I go to lay the cards down, it clicks and hovers, which is kind of cool, but it's still hard to place. I don't want the card pointing to the edge. I want the mouse pointer in the center of the card, but I want the card to shrink down — as I hover it over, I want it to shrink down like I'm placing it down. So the card should be the same size as the square, so I can see what square I'm placing it in. Also, when the cards are fanned out in my hand, they're too close together. They need to be a little bit wider spacing."

## How it works now (for orientation)
- `src/ui/app.ts` `cardPointerDown()` builds the dragged card (`.hand-card.dragged-card`) and `drag()` sets its `left/top` to the pointer.
- `src/style.css` `.hand-card.dragged-card` hangs the card by its **top-right corner** below-left of the pointer: `transform-origin:100% 0; transform:translate(-100%,0) translate(-6px,6px) rotate(calc(24deg + var(--tilt)*.4))`. That corner-hang and the 24° lean are what the owner doesn't want.
- `drag()` already finds the square under the pointer with `this.cellAt(x, y)` and adds the class `hover` to that cell; `this.squareQuad(row, col)` gives a square's four on-screen corners (the board is drawn in perspective).
- `layoutHand()` spaces the fan as `cw * HD0.overlap`, where `overlap` comes from the owner's layout (`src/content/owner-layout.json`, HUD piece role `player-hand`, `hand.overlap` = **0.2**), and already squeezes when the fan would not fit.

## A. Holding the card (owner's top priority)
1. **The pointer sits in the exact center of the dragged card** (mouse and touch), from the moment the drag starts until it ends. No corner-hang, no offset, no 24° lean. Keep the nice pick-up feel: the small lift/pop when it is picked up and the slight tilt that follows the movement (`--tilt`), but tilt around the card's center and keep it gentle (at most about 8°).
2. While the pointer is over the hand area (or anywhere off the board), the card is shown at its normal held size, upright, centered on the pointer.

## B. Shrinking onto the square
1. When the pointer moves over a board square, the dragged card **smoothly shrinks (about 150 ms, smooth ease) until it is exactly the size and shape of that square on screen**, as if it were being laid down flat on it. Use `squareQuad(row, col)` so it matches the square including the board's perspective (the far squares are smaller and narrower than the near ones); a CSS `matrix3d` projective transform from the card's box onto the square's four corners is the expected way. The card stays centered on the pointer while it follows the mouse; only its size/shape comes from the square under it.
2. Moving from one square to the next updates the size/shape smoothly (no jumping or flicker). In the gaps between squares or at the board edge, keep the shape of the nearest square.
3. **Highlight the square under the card** clearly so the owner can see where it will land: a bright outline/glow on that square, drawn above the board and visible through/around the shrunk card (the card can be slightly see-through, about 85% opacity, while it is shrunk). If that square is a legal place for this card, use the normal highlight color; if it is not legal, show the outline in a muted red so he knows it won't land there. Legal squares keep their existing glow as now.
4. Moving back over the hand (or off the board) smoothly grows the card back to its normal held size.
5. **Dropping works exactly as now**: releasing places the card on the square under the pointer (the highlighted one). Illegal drops are refused as now. Reordering cards inside the hand, tapping a card for the close-up, spells, Crystal cards, Smith swaps and every existing drag rule stay the same.
6. Works the same on a phone (touch) and with Graphics: Low.

## C. Wider hand fan
1. Spread the hand cards about **30% wider apart**: change the owner layout value `hand.overlap` in `src/content/owner-layout.json` (HUD piece role `player-hand`) from **0.2 to 0.26**, and keep `layoutHand()` reading it from there (no new hard-coded number).
2. Keep the existing squeeze rule: if the hand does not fit the screen at that spacing, it squeezes back down so no card runs off-screen. Check with a full hand at 1920×1080, 1366×768 and a phone held sideways (e.g. 844×390): all cards on screen, card names still readable, hover/pop/tuck behavior unchanged.

## D. Checks to add (keep every existing check passing; update only checks that test the old corner-hang position)
- **AC361** During a real mouse drag (test flag OFF, `page.mouse` in several steps), the center of the dragged card's bounding box is within 6 px of the pointer, both over the hand and over the board.
- **AC362** With the pointer over a board square, after 300 ms the dragged card's on-screen corners are within 4 px of that square's corners (`squareQuad`) — check one near square and one far square.
- **AC363** The square under the dragged card has the highlight; moving to another square moves the highlight; back over the hand the card returns to its normal size (width within 5% of its starting width).
- **AC364** Dropping on a highlighted legal square plays the card there exactly as before (unit appears on that square, crystals spent as before).
- **AC365** With a full hand, neighbouring hand cards are 0.26 × card width apart at 1920×1080 (or squeezed only when they would not fit), and every hand card is fully on screen at 1920×1080, 1366×768 and 844×390.

## E. Owner rules (every round)
- Keep the built `dist/` under **95 MB** (AC90). No model, texture or art changes in this round.
- **Editors must match the game.** In `factory-data/oreheart-8/REPORT.md` under the heading **"Editor updates needed"**, list: the hand `overlap` change (0.2 → 0.26, Game Editor hand settings) and the drag settings you chose (shrink time, see-through amount, highlight colors, tilt limit), so the owner's Game Editor/layout editor can show the same.
- **Do not run `git add`, `git commit` or any other git command.** The factory saves your work itself. (The last factory run stopped because `factory-data/oreheart-8/acceptance` went missing during the build; never delete, move or commit anything in `factory-data/`.)
