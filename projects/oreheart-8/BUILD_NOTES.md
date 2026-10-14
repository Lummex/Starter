# Oreheart — Phase 1a build notes (Revision 3)

Vite + TypeScript (vanilla DOM) + Three.js. `npm run build` → `dist/`; `npm test` → Vitest (engine + AI, 52 tests).

## Revision 3 — what was built
- **Engine** (`src/engine/`): no Stronghold income, start with 1 crystal (setup matches start with 0); new creature costs and 1/1 basic Gatherers (`scripts/gen-content.mjs` → `src/content/*.json`); six new original Commons so starter decks are 40 creatures (8 basic Gatherers, 28 costing ≤4) / 6 spells / 4 Crystal cards; Ranged hits anything at Chebyshev distance ≤2 over creatures and the Commander (never struck back); `hasMovesLeft`, `incomePreview`, `sitePays`, `isActed`; `gathererSwap` action (once per turn, Deploy, no Gatherer in hand, empty hand allowed); free basic Gatherer when broke (0 crystals, no site, no Gatherer on board); Gatherers can move (not attack) on their summon turn; creature action flags now reset only at their owner's turn start (so "acted" stays dark through the enemy's turn). Borgo +1 Health is applied in `spawn` (Miner 1/2, Shieldbeard 2/5).
- **Game controller** (`src/game.ts`): auto-skip of phases with no moves left (1 s; 0.4 s in test mode; only in test mode when `autoSkip: true`; off in the tutorial).
- **UI**: the battlefield (`aria-label="Battlefield"`) fills the whole viewport; camera auto-fits the 7×7 board (enemy Stronghold row at the top edge). HUD floats over it (crystals, "+N next turn", decks, Swap button on the left; phase, Done, Healths, Menu on the right; enemy hand at the top; hand at the bottom, ≥64×96 px cards, slides away while dragging). Creature labels read "⚔️A ❤️H 👟M" with `data-damaged` (red Health) and `data-acted` (darker/duller 3D figure and label). Crystal-site buttons ("Crystal site, column C") open a "Crystal site" dialog (owner + "Pays +N per turn"). Banners (YOUR TURN / DEPLOY / ACTION / ENEMY TURN; none for auto-skipped phases), 10-second countdown after 40 s hidden (`aria-label="Phase timer"`), "Moves still available!" pop-up (Continue / Go back) with a "Moves reminder" setting, overlay stacking (pop-up > countdown > banner; banners wait).
- **Test mode**: `window.oreheart` now also has `movesLeft`, `getCard`, `getConfig`, `setPhaseTimeLeft`; `newMatch({ autoSkip })`.
- Rules page, tutorial tips and AI (Gatherer swap, simultaneous-strike evaluation, Ranged range) updated.

## Notes / gaps
- A just-summoned Gatherer is marked `data-acted="true"` (it cannot attack) even though it may still move.
- Banners queue (YOUR TURN then DEPLOY); a backlog drains at about 0.45 s each so a following ACTION banner is not delayed long.
- Visuals are placeholders; no sound. `factory-data/oreheart-8` was not modified.

## Round 2 inspector notes (AC14, AC16)
Both reported failures were traced and appear to be inconsistencies in the acceptance tests, not engine bugs:
- AC14: a Scrapper (⚔2) hitting a Dwarf Shieldbeard (❤4, no type advantage for Goblins vs Dwarves) leaves it at ❤2 per spec 3.x; the test's own comment says "4 - 2" yet expects 3.
- AC16: `passTurn` (2 × Done) is called while in the Action phase, so two passTurns end in the player's turn-3 *Action* phase; the test then casts and presses Done again, ending the turn before the attack. Engine phase flow follows the spec (Deploy -> Action -> next turn).
No rules were changed to special-case these.

## Round 3 re-check (AC14, AC16)
I re-ran both tests and traced the failures. The engine follows the spec, so I changed no rules.
- AC14: a Scrapper (2 Attack) hitting an opponent Shieldbeard (4 Health, no Health bonus from Grubnak) leaves it at 2. The test expects 3, but it later expects the creature to heal back to 4, which needs 2 damage.
- AC16: the test calls `passTurn` (2 `done`s) twice from the Action phase. Those 4 `done`s end the player's turn and the opponent's turn and leave the player in Action. The test's next `done` then ends the player's turn, so the following attack is correctly refused.
