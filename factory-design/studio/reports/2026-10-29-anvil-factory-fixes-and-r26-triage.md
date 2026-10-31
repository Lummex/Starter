# Anvil report: factory fixes + Round 26 failing-check triage (Oct 29) — job from Forge

## 1. Factory fixes (on main)
- bd7f8ad (lib.mjs + pipeline.mjs): the planner now reads ALL owner comments on #8 (pages of 100). Before, it read only the first 100 of 122 comments, so the 4 newest owner comments (Oct 24-28) were missing.
- bd7f8ad + 795515a (builder.md): during each builder turn the hidden tests are removed from the checkout and from factory/.run-tests (an old leftover copy). .git is moved into the locked work folder, so the builder can't read old commits or commit. Everything is restored afterwards, even after a crash.
- Checked: test harness (throwaway repo, Node 20), 17/17 pass on the exact files now on main (795515a). The old code fails the paging test. The chmod lock only works on Linux (GitHub), so it couldn't be tested here.
- Remaining gap: the repo is public, so tests can still be downloaded from GitHub. Closing that is Ken's call (move the tests out of the public repo).
- Vercel: only starter-dashboard built from Git (main + blender-queue). Ken switched it to dashboard/ changes only (Oct 29).

## 2. Round 26: 40 failing checks (3 helpers on Fable, read-only; code claims spot-checked)
A. Hand press picks the wrong card (builder commit 26ae022a, app.ts hitCard/_slot): clicking or grabbing a raised card opens or drags its right-hand neighbour. Real bug. AC22, AC271, AC311, AC315, AC358, AC364 x2. -> quick direct fix (~10 lines app.ts).
   AC370/372: a drag over an illegal square inside the raised-hand band counts as "reorder", so no red outline. -> quick direct fix.
B. Test-mode slowness hacks by the builder (scene.ts ~1099-1115: frame throttle, "starved" switch to low mine effects, stats() waits 4 s). Test-only, players unaffected. AC375 x2, AC353, AC362, AC366, AC390/394. -> quick direct fix (time-based movement, stats() after 1 frame, starved flag doesn't change stats).
   Page too slow under software graphics on the CI machine: AC95, AC110, AC127, AC190, AC196, AC197, AC206, AC256, AC261. -> Round 27 item "test-mode performance + 3D fallback hooks". Some may pass after B's fix.
C. Other real bugs: AC383/384 Done drop-up uses the old panel style (1-line direct fix; the check also wants a black border while the Menu's is gold, so the check needs Ken's call). AC380 bubble measured mid-animation (test-only direct fix). AC368 Card Comp vs Card Comp freezes the page (known; Round 27).
D. Stale checks, need Ken's OK to update (no game change): AC58 x2 (Rocket Rider is now a Fighter; mine hover pop-up removed by Ken), AC135 + AC168 (Ken's layout has non-italic deck counts and Play button), AC176 (deck-builder pile picture changed), AC216 (Menu now 8 items: Ken added Square highlights + Full screen), AC318 (ability button now sits in the stat badge, Oct 25), AC341 (dwarves beat goblins, so the check's setup is wrong), AC345 (stance column slides out on hover, Oct 25), AC371 (88% card fit, Ken Oct 28), AC381 x3 (pickaxe badge structure + pointer-events, owner fixes), AC385 (mine emblem removed by Ken; check also looks before control changes).
Owner fixes committed after the build (9289c3e, 73b62fb, 135b9f4, cd698e7) change none of the 40, except AC381/AC385, where they confirm the checks are stale.
