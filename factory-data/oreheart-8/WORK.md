# Round 17 work items — fixes first, then three game modes (Standard, Card Play, Card Comp vs Card Comp)

Order (brief "Round 17"): A. fixes R17.1–R17.4, then B. modes R17.5–R17.8. Commit + push after each numbered step. Failing checks and messages: `test-results.md`.
Checks changed by the planner (contradicted the newer round): every `Start` click → **"Fight!"** (R17.1); the Round 10 quarter-tuck expectations in AC43, AC163, AC174, AC175, AC251 and the other R9a/R12a hand checks → **fully on screen at rest** (R17.2). If another check really contradicts a newer round, change it and add a line here.

## Rules & cards
- `mode` in state + `newMatch({ mode, stance, unitAutoPlay, paused })`; hooks `setMode`, `setStance`, `getStance`, `stanceChoice(uid)`, `autoActStep()` (test mode only) (AC338–AC344). `src/main.ts`, `src/game.ts`.
- Card Play: no player move/attack/mine/swap in `legalActions`, `act` rejects them; units act one by one in reading order in the player's Action phase (AC339).
- Stance AI: Aggressive, Mine Control (survival via `previewAttack`, "low crystals" rule), Guard (≤ 2 of stronghold (7,2)/Miners), Free-for-all = full AI (AC340–AC343). New `src/ai/stances.ts`, reuse `src/ai/*`.
- Card Comp vs Card Comp: AI drives both sides incl. mulligan; pause / speed; plays to a winner; Rematch keeps mode (AC344).
- `window.oreheart` undefined without `?test=1` (AC5).
- Remaining rules failures from test-results: AC15 (Shield), AC58 (`mineAt`/tap mines every ready Miner), AC109, AC248/AC266/AC286 (Ranged ranges and lines), AC284 (artPos data), AC331/AC332 (Brewlord), AC333 (facing kept).

## 3D & visuals
- Mines show their normal crystal/owner color, never plain white (R17.3).
- Card Play / Comp vs Comp units use their normal move/attack/mine animations when acting on their own; speed multiplier scales them (R17.6).
- Crystal Flow shard count by Flow (AC330); unit rings (AC261); no black bars (AC150).

## Interface
- Choose Your Commander: delete the hidden "Start" button, one visible **Fight!**; add mode buttons Standard / Card Play / Card Comp vs Card Comp (remembered); phone 844×390 layout with nothing overlapping or cut off (AC2, AC72–AC74, AC146, AC206, AC208, AC236, AC338, AC346). `src/ui/select*.ts`.
- Hand: restore `aria-label="Your hand"` with `button[data-card-id]`; even fan fully on screen at rest; hover raise/pop one at a time, nothing sticks; raised card < half a phone screen; drag up plays, sideways reorders (AC43, AC155, AC163, AC174, AC175, AC199, AC251, AC264, AC270, AC272, AC327, AC347). `src/ui/hand.ts`.
- Stance column (`aria-label="Stance"`, 4 buttons with icon, label, `title`, faction-color glow, `aria-pressed`) on the right edge, vertically centered (AC338, AC345).
- Card Play bar: 1× / 2× speed toggle + Done. Watch bar for Comp vs Comp: Pause/Play, 1×/2×/4×, Exit to menu; Done hidden; Rematch on the end screen (AC344).
- Remaining interface failures: AC95/AC127/AC136 (mulligan), AC115/AC117, AC143/AC204 (Deck Builder), AC168/AC326 (font weights/sizes), AC177/AC198 (glow), AC223 (music), AC259 (menu text), AC311/AC316 (card faces), AC335 (unit badges).

## Other
- AC134/AC348 screenshot flows render without errors; AC273 owner files byte-identical.
- Report: pass count + the Round 17 screenshots (fight menu with modes, Card Play with stances, Comp vs Comp watch bar, Aggressive and Mine Control step sequences) at 1920×1080 and 844×390.
