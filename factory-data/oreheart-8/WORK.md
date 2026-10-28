# Round 26: owner edits, model clips, failing checks

Read "Round 26" at the top of SPEC.md and `factory-design/design/oreheart-round-26-combined-brief.md`. Rounds 24/25 are discontinued. Change nothing else; no rule or card-number changes. dist < 95 MB (AC90, now 92.2 MB); never touch model geometry/UVs. Every chosen value goes in REPORT.md "Editor updates needed". Priority: R26.0 → A1, A2, A6, A3, A8, A10 → A4, A5, A7, A9 → B → C.

Checks changed by the planner: AC369/AC371 (skull throw) removed; AC363 gap now 0.23–0.29; AC41, AC31, AC37 use the new Done drop-up. New: AC370–AC396.

## 3D & visuals
- R26.0 FIRST: remove the Round 24 skull projectile/bonk (commit `7018719` parts only) from `creature3d.ts`/`scene.ts`/`style.css`/`BUILD_NOTES.md`; Skullflinger keeps his attack clip, no projectile entries (AC391, AC396).
- A2: renderer `setPixelRatio(devicePixelRatio)` (cap 2 only on Low), resize on window/fullscreen changes; `getRenderStats().canvas` hook (AC375). `src/ui/scene.ts`.
- B11: clips strictly by name from `models.json` `clips`/`events.json`, no positional fallback; `figures[].currentClip`; list missing clips (AC390). `src/ui/creature3d.ts`.
- B12: copy every `partsTableLook` from `factory-design/design/models/editor-setups-2026-10-28.json` into `PARTS`; copy part GLBs from `factory-design/design/models/parts/` (Shiv Rat backpack + dagger, Tinker scepter/shield/wrench, Gyronaut wings + v4 char.glb); `figures[].parts` hook (AC392, AC393).
- B13/B14: `events.json` + `clips` map for `gyrocopter-ace` and `gnome-tinker`, names that exist in their GLB (AC394).
- C: Bowler Brawler bowling/basket-shot checks (AC360, AC361).

## Interface
- A1: drag card centered on pointer with `aria-label="Dragged card"`, ~150 ms matrix3d shrink onto `squareQuad`, square outline (legal / muted red), grow back over hand; `getDragCard()` hook; owner-layout hand overlap 0.26 (AC370–AC374, AC363). `src/ui/app.ts` cardPointerDown/drag/layoutHand, `style.css`, `src/content/owner-layout.json`.
- A2: first click calls `requestFullscreen()` once per visit, errors swallowed (AC376).
- A6: Done drop-up above the Done button in Match-menu style with the exact text; no question after any move this phase; replaces `remindMoves` (AC382–AC384, AC31, AC37, AC41).
- A3 UI: "Use your banked crystals?" dialog (Yes / No / "Don't ask again"), Settings toggle "Ask before using banked crystals: On/Off", skipped in test mode/act/AI (AC377–AC379).
- A8: Respond box 1.3×, text ~1.3×, buttons ≥ 44 px, fits 844×390; `getUiScales().respond` (AC386).
- A10: find and fix hover flicker/see-through; cause in REPORT.md (AC389).
- A4: Commander `.speech` scale 0.65 with `aria-label="Commander speech"`; `showCommanderSpeech` + `getUiScales().commanderSpeech` hooks (AC380).
- A5: pickaxe badge gets `data-mine-badge`, never clipped/covered (AC381).
- A7: owned-mine emblem `<img>` from `format.json` byFaction instead of `FSYM` emoji (AC385).
- C: phone/odd-window HUD and hand offsets (AC24, AC138, AC188, AC212), Tutorial Skip (AC25), Card Comp watch bar Pause (AC344, AC368).

## Rules & cards
- A3: pay Flow first, then Bank, for creatures, spells and abilities; pending payment waits for the Bank question (AC377–AC379).
- A9: Junk Shaman lift by player clicks: lift mode, legal squares = engine `pickUp` destinations, Esc/right-click cancel unpaid; AI keeps `bestShaman`; `getLiftState()` hook (AC387, AC388).
- A6 support: track "moved this phase" for the Done logic (AC382).
- C: Mine Control stance, decide from GDD (AC341).

## Other
- Run the full suite; REPORT.md: Done/Partly/Not started per item, Editor updates needed, dist size, the flicker cause, missing clips, Shaman limits enforced.
