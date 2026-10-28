# Anvil report - mine icon drawn under the 3D units (Oct 28)

Job: from Forge (Ken, Oct 28: fix it with Anvil, not the factory). Second small fix on top of the other Anvil run's pickaxe fix.

## What was wrong
The faction emblem on an owned crystal mine (`.mine-emblem` img inside the `.site-mark` button, z-index 25) is an HTML overlay above the transparent 3D canvas. So it was always drawn on top of the 3D units, even a unit standing in front of the mine.

## What I changed (commit c96705a on factory/issue-8, "Owner fix: mine icon drawn under 3D units (Ken, Oct 28)")
An HTML overlay can't sit between 3D objects, so the emblem is now drawn inside the 3D scene:
- src/ui/scene.ts: each owned mine gets a THREE.Sprite with the faction emblem picture (same picture, from mineEmblemUrl). It is depth-tested, so units in front of the mine cover it. Each frame it sits on the mine's square centre, moved 0.55 of a square toward the camera along the view line (same spot on screen as before), so the mine's own crystal stays behind it. Size 0.42 of a square (about the old size).
- src/ui/app.ts: in 3D the old HTML emblem is kept but hidden (visibility:hidden), so the pickaxe badge layout and the data-mine-emblem markers stay the same. 2D (flat) mode is unchanged.
- Nothing else touched (pickaxe fix 5c959d4 is underneath and unchanged).

## Preview
- Ran "Factory — preview only" (#15, branch factory/issue-8, app projects/oreheart-8). It deployed commit c96705a (pickaxe fix + this fix): https://oreheart-8-k2ffmsal0-lummex.vercel.app
- **Not checked yet:** after ~55 min the Vercel deployment was still "Queued". Every commit on factory/issue-8 and blender-queue also starts Git builds in factory-2, oreheart-4, oreheart1-6, starter and starter-dashboard, and those kept going first. I did not press "Start Building Now" (it uses paid On-Demand Concurrent Builds).
- So there are no screenshots yet and I do not claim it is fixed. Next step: when the preview is Ready, start a match, put a unit in front of an owned mine, and take screenshots (unit over emblem, emblem visible when nothing is in front, pickaxe fully visible). If the emblem looks off (size/spot, or the crystal covers it), adjust 0.55 / 0.42 in scene.ts.

## Nothing live
No production, no factory round, nothing deleted.
