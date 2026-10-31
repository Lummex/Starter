# Round 26 finish: make Round 26 work, fix the failing checks

Read "This run (Round 26 finish)" at the top of SPEC.md, then `factory-design/design/oreheart-round-26-combined-brief.md`. No new features, and no rule or card-number changes. Last run: 400/463 passed. Fix the game, not the checks. dist must stay under 95 MB (AC90). Never touch model geometry or UVs. Put every value you choose in REPORT.md under "Editor updates needed".

Checks the planner changed: AC358 (the drag part was removed because it contradicted the centered drag in R26 A1) and AC265 (tilt is now ≤ 8° and may be 0). Every other failing check is still valid.

Priority: the two root causes (hand hover pop, 16:9 frame) → Round 26 items → everything else.

## Interface
- ROOT CAUSE 1: hovering a hand card no longer pops it to `popScale` 1.6 (33.81 % card → about 54 % of the height), only one card at a time, and it always retracts. This was probably broken by the A10 flicker fix (`popTarget`, `handBoxes`, 90 ms hold). Restore the pop without bringing back the flicker (AC389 must still pass). Affects AC59, AC164, AC174, AC218, AC272, AC347, AC364, AC365. `src/ui/app.ts` layoutHand/pointerenter, `style.css`.
- ROOT CAUSE 2: on computer windows the match must keep the owner's 16:9 letterbox (`#app` aspect 16:9, never stretched). The R26 "fills the window" change broke this. The arena cover-fit runs inside that frame. Affects AC24b, AC149, AC150, AC190, AC191, AC192, AC200.
- A1 drag card: centered on the pointer, shrinks onto the square, grows back to its starting width (±5 %) over the hand. `getDragCard()` must return the pointer and box (AC370–AC373, AC358 no NaN). Hand overlap 0.26 from owner-layout, every card fully on screen at 1920×1080, 1366×768 and 844×390 (AC374, AC347). Hand reorder and drag-to-play with real pointer events must still work: the Goblin Miner drag places the Miner and not its neighbour (AC264, AC265, AC269).
- A6 Done drop-up: no move this phase → drop-up above Done, "Go back" keeps the phase and "Continue" ends it (AC31, AC383, AC384).
- A2: the first click calls `requestFullscreen` once (AC376).
- A5: the pickaxe badge `data-mine-badge` shows the right text and is never covered (AC381). A7: a controlled mine shows the faction emblem `<img>` (AC385).
- AC326: `enemy-deck-count` italic must follow owner-layout (false).
- AC318: the ability button sits above the unit (below the computed y).
- AC345: the four stance buttons are fully on screen at the right edge (Aggressive was at x = 2062 at 1920 wide).
- AC95, AC134, AC148, AC176, AC206, AC256, AC261: these time out on locators (Mulligan click, hover, Change Commander). Find what is covering or missing (probably the hand/fullscreen changes) and fix it.

## Rules & cards
- A9 Junk Shaman lift: the highlighted squares must equal the engine `pickUp` legal destinations exactly (67 squares were lit and 1 was expected). Pay 2 crystals (AC387, AC388).
- AC341 Mine Control stance: a Miner next to an enemy Miner it can beat and survive attacks instead of mining. Check the GDD stance text and fix the AI.
- AC58: tapping a mine (and the `mineAt` action) mines with all ready Miners next to it (2 expected, 1 happened).
- AC40, AC110: random mines must stay corner-mirrored, fair, away from both Strongholds and never on the same square for every seed tested.

## 3D & visuals
- A2 pixel ratio: `setPixelRatio(devicePixelRatio)`, resize on window and fullscreen changes, `getRenderStats().canvas` hook, no scroll bars at 2560×1080 or 3840×2160 (AC375 ×2). `src/ui/scene.ts`.
- B12 parts: copy every `partsTableLook` from `factory-design/design/models/editor-setups-2026-10-28.json` into `PARTS` exactly (goblin-grunt failed), along with the parts GLBs. `figures[].parts` (AC390, AC392, AC393).
- B13/B14: gyrocopter-ace and gnome-tinker get their gear, `events.json` and a clips map whose clips exist in the GLB (AC394).
- AC196/AC197: the Commander faces the opponent and returns after a look-back. Impatience starts only after about 20 s idle (it started before 10 s).
- AC361: Bowler Brawler's basketball shot lands dead (0 bounces).

## Other
- Run the full suite. REPORT.md: each item marked Done/Partly/Not started, Editor updates needed, dist size, the real cause of both root causes, and missing clips.
