# Anvil report: drag card keeps its shape (Oct 28)

Job from Forge (Ken's fifth small fix, fast path, no factory round).

## What Ken asked
When a dragged card is over the board it shrank onto the square but stretched to fit it. Ken: keep the card's shape, a bit smaller than the square.

## What I did
- Waited for the other four fixes on factory/issue-8 (pickaxe 5c959d4, mine icon layer c96705a, hand flutter d4b453b, miners-count pop-up removed 2f49dd3), then committed on top: **1beebd5** "Owner fix: drag card keeps its shape, a bit smaller than the square (Ken, Oct 28)".
- projects/oreheart-8/src/ui/app.ts: new cardInSquare() + DRAG_FX.fit = 0.88. Over a square the card now goes to an upright, aspect-correct shape at 88% of the square's smaller on-screen side, centred, mapped through the square's corners (follows perspective; far squares give a smaller card). The square highlight still uses the full square. Grab point, grow-back over the hand and drop are untouched.
- Math checked offline (sample perspective square: card aspect 0.722 vs real 0.714, height 88% of the square).
- Ran Factory - preview only #18 (factory/issue-8, projects/oreheart-8): Vercel deployment oreheart-8-47j8b29wj (source 1beebd5 = all 5 fixes).

## Not done / open
- The preview is **stuck Queued in Vercel** (60+ min, like every oreheart-8 preview today). Every push also builds the old Git-connected projects (factory-2, oreheart-4, oreheart1-6, starter-dashboard), which jams the team's build queue. I did not press Start Building Now (paid) or change Vercel settings. So the 5 fixes are **not tested in a preview yet**. Ken was told by notification.
- Editors: DRAG_FX is marked 'mirrored in the editors'. The new fit 0.88 value should be added to the Studio's copy (Wright publishes the Studio page).
- Since then other sessions pushed more fixes to factory/issue-8 (arrows, lifted unit, square colours, full screen toggle, mine-all icon); newer previews will include those too.

Nothing live, no factory round, nothing deleted.
