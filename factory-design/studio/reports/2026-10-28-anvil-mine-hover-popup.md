# 2026-10-28 Anvil – remove mine miners-count hover pop-up

Job: Forge (Ken's request, Oct 28), fourth of four small owner fixes, fast path (no factory round).

## Done
- Waited until the three earlier fixes were on factory/issue-8 (pickaxe 5c959d4, mine icon layer c96705a, hand flutter d4b453b).
- Commit **2f49dd3** on factory/issue-8: "Owner fix: remove mine miners-count hover pop-up (Ken, Oct 28)". Removed the two mouse hover listeners on the mine button (src/ui/app.ts ~line 949) that opened/closed the "Crystal site" info box on hover. Nothing else changed: mining by tap, owner emblem, pickaxe badge, rules, other tooltips all untouched. Tap (with no ready miners) and press-and-hold still open the info box with a Close button.
- Ran "Factory — preview only" #17 (branch factory/issue-8, app projects/oreheart-8): Build step passed. Preview URL: https://oreheart-8-396k2t0zp-lummex.vercel.app . GitHub cancelled the job at 20 min while Vercel was still building, so the deploy state is unknown.

## Not done / blocked
- Testing: my Chrome tools got "Permission denied for this action on this domain" on the vercel.app preview. None of the 4 fixes are tested in the game. Ken needs to allow the site in Claude in Chrome (or test himself).
- Nothing live.

## Open question for Ken
- Should tapping a mine (when no miner is ready) also stop showing the info box? Left in for now because the job said hover only.
