# Anvil report: full screen / windowed toggle (Oct 28)

Job: NINTH small owner fix from Forge (Ken, Oct 28; fast path, no factory round). Nothing live.

## What I did
- Waited until all 8 earlier owner fixes were on factory/issue-8 (last: "square highlight colours in the in-match menu", d6a8871), then committed on top:
  **7af662c "Owner fix: full screen / windowed toggle in the menu (Ken, Oct 28)"** (only src/ui/app.ts, +55 lines).
- In-match Menu: new item after "Square highlights". It reads "Full screen" while windowed and "Windowed" while in full screen (aria-pressed = current state). Uses requestFullscreen / exitFullscreen (plus webkit versions). Same menu style (it is a normal o-menu-item).
- Main Settings: new button under Display mode, "Screen: Windowed" / "Screen: Full screen" (shows the current mode; click switches). Same button style as "Graphics: High".
- Updates by itself on Esc (fullscreenchange), F11 and window resize. If the browser is in F11 full screen (which a page cannot leave), clicking shows a short note "Press F11 to go back to a window".
- Where full screen is not allowed (e.g. iPhone Safari): the menu item is left out and Settings shows "Full screen: not available on this device". A refused request does nothing (no error).
- Choosing either mode turns off the automatic "full screen on first tap" (R26.A2) for that visit, so the game never fights the player's choice.
- Native sharp resolution: the toggle only changes the window size; the existing Round 26 resize path redraws at the new size. (Not visible-tested yet, see below.)
- Editors: the menu list lives in code (app.ts), not in Oreheart Studio or the Game Editor layout, so no editor data changed.

## Checks
- The new code type-checks (tsc --strict on the inserted code) and the preview job's Build step (vite build) passed.
- Tested the same toggle code live on an older preview's Settings screen (vqwc8zlrr): button matches the Settings style; label flips Windowed → Full screen → Windowed on fullscreenchange; a refused request leaves everything as it was. Screenshot taken.
- Real full screen could not be entered from my automated Chrome tab (Chrome answers "not granted" to automated clicks). Ken's own click should work; please try it.

## Preview: NOT ready (Vercel queue jam)
- Factory — preview only run #22 started; preview link: https://oreheart-8-g59tuud42-lummex.vercel.app (built from 7af662c, all 9 fixes).
- Vercel shows it (and all 9 oreheart-8 previews since 52 min before) as **Queued**. Only starter-dashboard production builds get the one build slot, because every commit to main (agents' notes/reports) starts a new one. The Actions jobs hit their 20 min limit; the Vercel deploys stay queued and should build later at the same link.
- Not done without Ken: "Start Building Now" (paid on-demand builds), cancelling other queued deploys, changing starter-dashboard / old projects' build settings.
- Fix suggestion for Ken: in Vercel, set starter-dashboard (and factory-2, oreheart-4, oreheart1-6, starter) Settings → Build and Deployment → Ignored Build Step = "Don't build anything" (or disconnect Git), then the oreheart-8 previews run.

## The 9 fixes: status
None could be play-tested in the new preview yet (still queued). All 9 commits are on factory/issue-8:
1. Mine-all pickaxe fully visible (5c959d4) - on branch, not yet tested in preview
2. Mine icon drawn under 3D units (c96705a) - same
3. Hand cards don't flutter on hover (d4b453b) - same
4. Remove mine miners-count hover pop-up (2f49dd3) - same
5. Drag card keeps its shape, a bit smaller than the square (1beebd5) - same
6. Arrows to cycle cards in the close-up (11d9ed3) - same
7. Lifted unit follows the pointer and loops its lifted animation (b0db357) - same
8. Square highlight colours in the in-match menu (d6a8871) - same
9. Full screen / windowed toggle (7af662c) - code built OK; logic tested on old preview; in-game test waiting for preview
(After mine, another session added 9d92f74 "Owner art: Ken's mine-all pickaxe icon".)
