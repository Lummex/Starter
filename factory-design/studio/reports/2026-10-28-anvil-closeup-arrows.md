# Anvil report: arrows to cycle cards in the close-up (Oct 28)

Job: sixth small owner fix from Forge (Ken's request, fast path, no factory round). Ken also checked in directly mid-run; I told him it works.

## What changed (factory/issue-8)
- Commit 11d9ed3 (app.ts) + the style.css commit before it, both "Owner fix: arrows to cycle cards in the close-up (Ken, Oct 28)". Made on top of the 5 earlier owner fixes.
- Clicking a hand card opens the big close-up. Now there's a round gold arrow on each side of the card (same look as "Play this card").
- Right arrow / → key = next card in the hand; left arrow / ← key = previous card; wraps around at both ends. Sideways swipe on the card does the same on phones. Arrows are 52–68 px (easy to tap) and hidden when the hand has only one card.
- Each step opens that card's own close-up, so Play / Cast always acts on the card shown.

## Checks
- New code type-checked with tsc --strict.
- Preview (Factory — preview only, run #19): https://oreheart-8-6h02wbaaj-lummex.vercel.app (all 6 fixes). The GitHub job hit its 20-minute limit because Vercel kept the deploy queued about 1.5 h (known jam); the deploy built later at the same link.
- Tested in the preview: arrows show beside the close-up; right arrow and → key step forward; left from the first card wraps to the last; only one close-up open at a time; after stepping to Goblin Miner, "Play this card" lit up its squares (it played the card shown).
- Screenshots were sent to Ken in chat (close-up with arrows, after pressing right, card shown → played).

## The 6 fixes in this preview
1. Mine-all pickaxe fully visible: in the preview, not checked by me.
2. Mine icon drawn under 3D units: in the preview, not checked by me.
3. Hand cards don't flutter on hover: in the preview, not checked by me.
4. Mine miners-count hover pop-up removed: works (no pop-up when hovering a mine).
5. Drag card keeps its shape: in the preview, not checked by me.
6. Close-up arrows: works.

Nothing live. Production untouched.
