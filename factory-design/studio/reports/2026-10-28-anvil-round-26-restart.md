# Anvil report: Round 26 restart (Oct 28, late) — job from Forge

Ken's OK (quoted by Forge, ~22:45 UTC): "Yes, the one and yes, the two." (restart Round 26; shrink gnome bodies too).

## Why the old run was cancelled
Run 40644497657 hit GitHub's 3-hour job limit (`timeout-minutes: 180`; annotation "The job has exceeded the maximum execution time of 3h0m0s"). It had already planned, built, inspected and written its report (commits 78b5c24, 23019fb, 6f76fff, 6b2f9ac, c55fc1b on factory/issue-8; 400 of 463 checks passed, reviewer said "Request changes"). After the reviewer (08:47 UTC) it waited in the Vercel preview deploy (Vercel queue jam) until the limit cut it off at 09:33. So: no preview link, no "ready" comment, and #8 still carries the stale label `factory:building`. The Round 26 code itself is on the branch.

## Brief changes
- Round 26 (commit 28b65ac on main): new "Restart note": continue from the code already on the branch, and keep Ken's 10 owner fixes (5c959d4 … 9d92f74) exactly. A1.2 + AC371: the dragged card keeps its own shape at 88 % of the square (owner fix 1beebd5) instead of filling the square. A5, A7, A9, A10 and AC395 now point at the owner fixes (pickaxe visible + Ken's own pickaxe picture, emblem as 3D sprite, Shaman carry, no-flutter hover) so the builder doesn't redo them.
- Round 27 (same commit): gnome line quotes Ken's OK (all 28 bodies: 15 dwarves + 13 gnomes); header no longer says "build #56 still running". Not started.

## Vercel queue
Not jammed at 22:40 UTC: one starter-dashboard production build running, nothing queued.

## Start
Adding `factory:revise` to issue #8 was blocked by my permission check. Ken must add it. Nothing started, nothing shipped.

## Risk
The build itself took ~2 h 15 min. If Vercel queues the preview for more than ~45 min again, the run will be cut off the same way. Agents should avoid committing to main while the build is near its end. Raising the 180-minute limit needs Ken's OK.
