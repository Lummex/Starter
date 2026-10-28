# 2026-10-28 Anvil – square highlight colours in the in-match menu (fix 8 of 8)

Job from Forge (Ken's fast-path owner fix, no factory round). Nothing live.

## What I did
- Waited until fix 7 ("lifted unit follows the pointer...", b0db357) was on factory/issue-8, then built on top of it.
- Settings already had a "Square highlights" panel (edge, glow, attack colour, strength, glow size, edge thickness, inner fill, pulse, pulse speed, Reset to default). I moved it into one shared method `highlightPanel(fac, onReset)` in src/ui/app.ts. Settings and the match Menu now both use it: same controls, same saved setting (localStorage oreheart.highlights via fx-settings.ts setHighlights). Changes show on the board right away (CSS variables).
- New Menu item "Square highlights" (under Settings) opens it in the game's normal dialog box, with the player's faction for default colours. Close button; Reset rebuilds the box.
- Commit d6a8871 on factory/issue-8: "Owner fix: square highlight colours in the in-match menu (Ken, Oct 28)". Only app.ts changed.

## Preview: NOT tested
- Ran Factory — preview only #21 -> oreheart-8-r91j0l7ro-lummex.vercel.app . Timed out on GitHub after 20 min; on Vercel it is still **Queued**.
- Every oreheart-8 preview since ~1 h ago (fixes 1-8, runs #14-#23) is Queued on Vercel. Cause: Vercel build slots are taken by **starter-dashboard** production builds (one per commit to main; many agents commit to main), and old git-connected projects **oreheart1-6, oreheart-4, factory-2** also queue builds for every commit.
- Fix needs Ken in Vercel: disconnect Git (or set Ignored Build Step) on starter-dashboard, oreheart1-6, oreheart-4, factory-2, and cancel their queued builds. I can't (my permission check blocked Vercel Disconnect earlier today).
- So none of the 8 fixes could be checked in a preview. None are claimed as working.

## Note
- More commits landed on factory/issue-8 after mine (full screen / windowed toggle 7af662c, mine-all pickaxe icon art 9d92f74, ...), so the next preview will hold more than these 8 fixes.
