# 2026-10-28 Anvil: lifted unit follows the pointer (7th small fix)

Job from Forge (Ken, Oct 28; fast path, no factory round).

## What I did
- Waited until fix 6 ("arrows to cycle cards in the close-up", 11d9ed3) was on factory/issue-8, then committed on top:
  **b0db357 "Owner fix: lifted unit follows the pointer and loops its lifted animation (Ken, Oct 28)"** (src/ui/app.ts, scene.ts, creature3d.ts).
- How it works:
  - creature3d.ts: also loads the `react_lifted` and `special` clips from models.json `clips` (by name, e.g. OH_React_Lifted / OH_Special). New anims `lifted` (loops) and `special`. While `special` plays it loops between its `lift_start` and `lift_end` events from events.json (Junk Shaman: 0.73 s to 1.93 s), so the Shaman holds the lift. `has(name)` tells if a model has a clip.
  - scene.ts: new `setCarry({uid, holder, x, y} | null)`. The carried 3D unit goes to the board point under the pointer, raised 0.45 above the board, with a small bob. It plays `lifted`; units without that clip play idle plus a gentle dangle sway. The holder (Shaman) plays `special`. On null both go back to their normal idle.
  - app.ts (beginLandingPick): on the 3D board the flat ghost token is hidden and the real unit is carried. The square under it still lights up (same hover/lift-hover classes as before). Drop, Esc and right-click work as before.
  - Card rules are unchanged (shamanLiftTargets / shamanLandingSquares / shamanLiftAction untouched).
- Ran "Factory — preview only" #20 (run 40738762822). The vite build passed (no errors). Vercel deploy oreheart-8-e95v6egi5-lummex.vercel.app was queued, and GitHub cancelled the job after 20 min.

## Not tested yet: Vercel queue jammed
- Every preview since #14 timed out the same way. Vercel shows all oreheart-8 deploys (5c959d4 … 9d92f74) as "Queued".
- Cause: Git auto-deploys. Every push (Blender worker "idle" status commits on blender-queue, notes and reports on main, each fix on factory/issue-8) starts a build in about 6 projects (starter, factory-2, oreheart1-6, oreheart-4, oreheart-8, starter-dashboard), and the team runs one build at a time.
- Fix needs Ken: turn off Git auto-deploys for the old projects (Settings → Git → Disconnect, or Ignored Build Step), and/or cancel the queued ones. I didn't do that (it changes shared settings and was blocked for me before).

## Status of the 7 fixes (none checked in a running preview)
1. mine-all pickaxe fully visible (5c959d4): on branch, not tested by me
2. mine icon drawn under 3D units (c96705a): on branch, not tested by me
3. hand cards don't flutter on hover (d4b453b): on branch, not tested by me
4. drag card keeps its shape (1beebd5): on branch, not tested by me
5. remove mine miners-count pop-up (2f49dd3): on branch, not tested by me
6. arrows to cycle cards in the close-up (11d9ed3): on branch, not tested by me
7. lifted unit follows the pointer (b0db357): on branch, builds, not tested in a preview yet

Also on the branch after mine (from other runs): d6a8871 square highlight colours, 7af662c full screen toggle, 9d92f74 Ken's mine-all pickaxe icon.

Nothing went live.
