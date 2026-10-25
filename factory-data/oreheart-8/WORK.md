# Round 17 finish: keep the owner's Oct 24 changes, bonus draws, fix the last failing checks

Read "Round 17 finish" at the top of SPEC.md. The owner edited the game directly on Oct 24 ("Owner: …" commits). **Never revert those edits** (bonus draws, white unowned mines, no yellow unit ring, badge size, pop-ups/speech bubbles/banners/end pictures, deck pictures, Back bottom-left). Failing checks and messages: `test-results.md`.
Checks rewritten by the planner (they contradicted current card data or newer rules): AC15, AC109, AC143, AC204, AC260, AC261, AC266, AC332, AC335. New: AC349. Fix the game, not these checks.

## Rules & cards
- Bonus draws (owner rule, already in `src/engine/engine.ts`): make sure it works in test mode with `newMatch({ mines, setup })`, keep `tests/round20.test.ts` passing. If an older hand-count check now breaks only because of the bonus draw, note it in the report (AC349, AC7).
- Restore Skullflinger to owner data: `range: 6`, text/shortText/longText "Hits up to 6 spaces away" (AC248, AC284, AC286). `src/content/cards.json`.
- `mineAt` and tapping a mine mine with every ready Miner next to it; `data-ready-miners` counts them all (AC58). `src/engine`, `src/ui/scene.ts`.
- Mine Control stance: a Miner attacks an adjacent enemy Miner when `previewAttack` says it survives and crystals are not low (AC341). `src/ai/stances.ts`.
- Flow stream log `flow` equals the side's current Flow (AC330).

## 3D & visuals
- Arena checks time out: make the arena/pan/zoom and Round 10 screenshot flows fast enough to finish under 30 s (AC40, AC190, AC191, AC256).
- Unit rings: faction colors, grey after acting, settings applied (AC261). The yellow CSS ring stays hidden (owner).

## Interface
- Hand: rests as an even fan fully on screen, below the board; hover raises one card and it always retracts; neighbors go back down (AC174, AC218, AC272); drag from the hand plays (AC270). `src/ui/hand.ts`.
- `data-playable="false"` on cards you can't afford/place, updating at once (AC155).
- Fonts: only Alegreya SC italic 400/700 on non-card text, no weight 100 / normal style (AC135, AC168).
- Spell card faces have separate name and text elements in Deck Builder and hand (AC316).
- Settings highlight panel values reach `getHighlightSettings` in test mode (AC260).

## Other
- Owner Goblin paintings and `grubnak-on-throne-art.png` served byte-identical at `/art/owner/goblin/` (AC273).
- Report: pass count, plus 1920×1080 screenshots of a bonus-draw message and a match at rest.
