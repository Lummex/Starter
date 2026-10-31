# Round 26 notes (interface)

## A10 hover flicker / see-through (cause and fix)
Every hand card (and the enlarged "popclone" copy) carried `transition: ... opacity .18s` plus the `.hand-card.dragging{opacity:.3}` rule.
When a card was entered, `pointerenter` could fire again on a card that was already popped (overlapping fan, the card moves under the pointer),
which removed and re-added the pop (clone + placeholder) and re-started the opacity fade, so cards flashed see-through.
Fix: opacity is no longer transitioned on the fan, only a card that is being dragged or off-hand may have opacity below 1
(`.match .hand .hand-card:not(.dragging):not(.offhand){opacity:1!important}`), and `pointerenter` ignores a card that is already popped.
The drag shrink opacity (85%) is set inline only on the floating `.dragged-card`, never on hand cards.
This was fixed by reading the code; it was not reproduced in a browser here.

## Hand spacing
`layoutHand` used `cw * max(0.54, overlap)`, which ignored `overlap`. It is now `cw * overlap` (0.26 from owner-layout.json) as AC374 requires,
still squeezed to fit the hand box.

## Shaman lift limits enforced (A9)
Pick-up target within 5 spaces of the Shaman (not shielded), landing square empty and within 5 of the Shaman (engine `shamanLandingSquares`),
pay 2 (Flow first, asks about Bank unless disabled). The AI still uses `bestShaman`.
