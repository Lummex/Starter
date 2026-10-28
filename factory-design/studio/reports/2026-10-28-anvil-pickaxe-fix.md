# 2026-10-28 Anvil: mine-all pickaxe fully visible (small owner fix, no factory round)

Job: from Forge (Ken asked Oct 28: fix it without running the whole factory).

## Cause
The pickaxe badge (span.pickaxe[data-mine-badge], app.ts renderSites ~2113) is a child of the mine's .site-mark. Since Round 11, layout() (~1261) puts an inline clip-path on .site-mark = the mine square's screen shape, so only the square is clickable. The pickaxe sits above the mark (bottom:100%), so the clip cut off everything except the bottom ~6px of the handle.

## Fix (one CSS rule, nothing else changed)
src/style.css, after .pickaxe[data-mine-badge]: `.site-mark.ready{clip-path:none!important}` (only while the pickaxe shows). Commit 5c959d4 on factory/issue-8: "Owner fix: mine-all pickaxe fully visible (Ken, Oct 28)".
Side effect: while the pickaxe shows, the click area is the mark's box instead of the exact square shape (a bit larger at the corners). The pickaxe itself was already meant to be clickable (pointer-events:auto).

## Checks
- Old preview vqwc8zlrr: drew the badge on a mine (same DOM as the game) -> only the bottom of the handle shows. Added the new rule live -> whole pickaxe (head + handle) shows. Screenshots taken.
- Factory - preview only run #14 started (deploy oreheart-8-4gl49odvv-lummex.vercel.app, commit 5c959d4). The GitHub job hit its time limit after 20 min while Vercel still had it QUEUED; the Vercel deploy itself is still queued.
- NOT yet checked on the new preview (desktop + phone): it has not been built yet. See below.

## Blocker: Vercel build queue jammed
Every push to the repo also builds the old Git-connected projects (factory-2, oreheart-4, oreheart1-6, starter, starter-dashboard), and many sessions are pushing owner fixes. About 17 builds were queued; no oreheart-8 build started in 40+ min. Options for Ken: (a) wait; (b) press Start Building Now on the oreheart-8 deployment (paid on-demand build); (c) disconnect Git from the old projects (Settings > Git > Disconnect; my permission check blocks me).

Nothing put live. No factory round.
