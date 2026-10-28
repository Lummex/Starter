# Anvil report – hand cards flutter on hover (Oct 28)

Job: third small fix from Forge (Ken found it, fast path, no factory round). Nothing put live.

## What I did
- Waited until both other fixes were on factory/issue-8: "mine-all pickaxe fully visible" (5c959d4) and "mine icon drawn under 3D units" (c96705a).
- Committed **d4b453b** "Owner fix: hand cards don't flutter on hover (Ken, Oct 28)" on top (only projects/oreheart-8/src/ui/app.ts).

## Cause
Hover boxes were measured from the cards' current on-screen shape. When a card popped, its neighbours slid aside 20 % of a card width and lost their arc, so the boxes moved under a still mouse; the 80 ms safety loop then saw "pointer not on the popped card" and retracted everything, the cards slid back, and it repeated.

## Fix (app.ts)
- `layoutHand()` stores a fixed slot per card (resting layout, one spacing wide, centred on the card; end cards also own their outer half). `handBoxes()` uses these slots, so popping or moving aside never moves a hover box.
- New `popTarget()`: the popped card keeps its slot plus a 10 px margin; a new target (a neighbour, or leaving the hand) must hold for 90 ms before anything changes.
- `watchPop()` and the 80 ms loop use `popTarget()`. Switching to a neighbour is one step (old card down, new card up), with no retract-all and no tuck in between. Leaving the hand still tucks it.
- A card's own pointerenter no longer pops it while another card is up (the sticky rule decides).
- Look unchanged: cards rise on hover, neighbours move aside, wider fan, hand tucks when you leave.

## Checks
- The patched file passes the TypeScript parser with no errors. It changes only the hand code; the pickaxe and mine-icon changes are intact in the same file.
- **Not yet tested in a preview.** "Factory — preview only" run #16 timed out after 20 minutes waiting on Vercel. Its deployment (oreheart-8-43xduknv6-lummex.vercel.app) and every oreheart-8 deployment since 5c959d4 are still "Queued" after more than an hour.
- Cause of the queue: every commit to main also builds starter-dashboard, factory-2, oreheart-4 and oreheart1-6 (all Git-connected). Today's many agent commits keep all the build slots busy.

## Open
- Ken: OK to set the old projects (factory-2, oreheart-4, oreheart1-6, starter-dashboard) to "Only build production" or disconnect them from Git? That would free the queue. Changing them was blocked for me before.
- Once the preview builds: test slow mouse moves across the hand and holding on card edges, then check the pickaxe and the mine icon.
