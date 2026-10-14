# Oreheart — Phase 1a build notes (Revision 6)

Vite + TypeScript (vanilla DOM) + Three.js. `npm run build` → `dist/`; `npm test` → Vitest (engine + AI, 26 tests).

## Revision 6 — what was built
- **Miner rename**: basic Miners are "Goblin/Gnome/Dwarf Miner" (ids unchanged, old names as `flavor`), ⛏️/⚔️/⚒️ badges on hand cards, card view and board labels, pickaxe on Miner figures, hammer + anvil on Smith figures. "Gatherer" no longer appears in visible text.
- **Smith Miners** (`*-smith-miner`, cost 2, role `Smith`): summon as a Miner, or the new `smith` action (`uid, creatureUid, stat`) in Deploy for a permanent +1 Attack / +1 Health (`upgrades` on the creature, `data-upgrades` + pips on labels). Drag glow: blue spaces, gold creatures; "Smith upgrade" dialog. Old upgrades/Upgrade button/`upgradeCosts` removed. Decks: 5 basic Miners + 3 Smith each.
- **Crystal Bank**: `players.X.bank` (no cap, never resets), Crystal cards fill it, Flow spent first (exact pairing rule of R6.4), `setup.playerBank/opponentBank`, counters read "Flow N · Bank M". `playCrystal` never changes phase/turn; legal in own Deploy and as responder in a Respond window; one per round per player (counter resets in own Draw).
- **Free Miner**: basic Miner costs 0 only if Flow + Bank can't pay and no Miner is on the battlefield. **Tunnel** only for basic Miners while behind on mines; "Tunnel!" tag on the hand card.
- **Respond window**: opens for any matching Instant (affordable or not); 12 s countdown bar (`progressbar` "Respond time left", frozen full in test mode); buttons: card name / "Crystal X + Instant" combo (`respond` with `crystalUid`) / disabled "… — need N more"; enemy card shown full size with a target line; "Let it happen".
- **UI**: turn display top-right (no box, big outlined text, two lines), hearts on each Stronghold's bottom wall shrunk to avoid label overlap, Rules page rewritten, tutorial gains a `smith` step.
- **AI**: uses Smith upgrades on strong Fighters, summons Smiths as Miners otherwise, plays Crystal cards in Deploy.
- Tests added for Smith persistence, Bank order, Crystal in Respond, unaffordable window, free Miner, Tunnel.

## Notes / gaps
- `scripts/gen-content.mjs` was stale (7×7 board) and has been removed; content JSON is edited directly.
- Standalone Crystal-card play during a Respond window is available through the API (`playCrystal`); the dialog only offers the Crystal + Instant combos.
- Heart overlap avoidance is geometric (shrinks the heart); verified at 844×390 only.
- Visuals are placeholders; no sound.

---

# Oreheart — Phase 1a build notes (Revision 5)

Vite + TypeScript (vanilla DOM) + Three.js. `npm run build` → `dist/`; `npm test` → Vitest (engine + AI).

## Revision 5 — what was built
- **Board 13×7**, Strongholds at (1,7)/(7,7), `boardWidth/boardHeight/mineCount` in config. **3 random mirrored mines** per match (seeded; rows 3–5; spacing ≥ 2); `newMatch({ mines })` override (illegal layout throws/rejects); tutorial uses a fixed layout from `tutorial.json`.
- **Mining action** `{type:'mine', creatureUid, row, col}`: Gatherer 2, Fighter 1, one action per creature (no move/attack after, no mine after moving). Gatherers are never summoning-sick for move/mine. `minedMine` pays out at the owner's next Draw (pool SET, cap 16, underdog +2, Geodes), mine colors recomputed only at Draw phases / creation from miners only; `minedLastTurn`; `players.X.flow`, `sites[i].flow/miners` are previews; "+N next turn" uses them. Setup board accepts `minedMine` and `summonedThisTurn`.
- **UI**: drag onto a mine (amber pickaxe glow), "N miners haven't mined" line in the Moves pop-up, yellow/dark-grey creature rings (`data-acted`, `data-mining`), 🏹 on Ranged cards/labels + bow on 3D figures, hand pop-out on hover/touch-and-hold, full-size deck piles (yours bottom-right, enemy top-left), glowing Commander hearts with damage pop-ups, "Crystal site, row R, column C" / "Mine flow, row R, column C" labels, Rules text.
- **Tutorial** steps: summon, move, mine, spend, swap, fight, spell, commander, complete.
- **AI** mines (Gatherers first) and reads mine positions from state.
- Tests in `tests/engine.test.ts` were rewritten for the new board (mining, layouts for 30 seeds, bounds, colors, free Gatherer, underdog).

## Notes / gaps
- Free Gatherer still also requires an empty pool or an enemy-held mine (kept from round 2).
- The old per-revision test suites for the 7×7 board were replaced, not ported one by one.
- Visuals are placeholders; no sound.

---

# Oreheart — Phase 1a build notes (Revision 4)

Vite + TypeScript (vanilla DOM) + Three.js. `npm run build` → `dist/`; `npm test` → Vitest (engine + AI, 64 tests).

## Revision 4 — what was built (on top of revision 3, below)
- **Crystal Flow** (`src/engine/engine.ts`): mine assignment (a creature touching two mines counts at one), mine color from the side with more creatures (tie = white), per-mine and per-player flow in state, pool set to flow at the Draw phase (+ underdog bonus only when the enemy holds a mine and you hold none), 4-color pool, cap 16 (excess removed white first), starting crystals 0. Creatures/upgrades: own color 1, others ½ (rounded down); spells: any color. Free Gatherer keyed to flow 0 / no mine in your color / no Gatherer on board. New spell costs, upgrade costs 3/3/5/8, Fizzle cancels cost ≤3, Prospector's Prayer +3.
- **Swapping**: a `move` onto an own creature within move range swaps (only the dragged creature gets `hasMoved`; `swap` event); in legal actions, AI and tutorial (new `swap` step).
- **UI**: white crystal counter with next-turn flow per color (CSS `data-flow` label so the counter text is just the number), "+N next turn", mine rings, `Mine flow, column C` overlays, site dialog (Controlled by / Color / Your flow / Enemy flow), gold swap glow, Rules and tutorial text.
- **AI**: swaps, spreads Fighters off crowded mines, half-value upgrade affordability.
- Tests: brief examples (a)–(e), half rounding, two-mine creature, swap, costs, Prayer, underdog.

## Round 2 fixes
- Free Gatherer now also requires an empty pool **or** an enemy-held mine (so a player holding crystals with no opposing mine pays the normal cost; still free with 0 crystals, and still free with crystals when the enemy holds a mine).
- Unresolved (believed inconsistent with spec/other tests): AC12 expects no move onto an own creature directly ahead (conflicts with swapping, 3.8); AC14 expects 1 damage from a Scrapper (Attack 2); AC16 attacks after one `done` too many in the turn flow.

## Notes / gaps
- The spec example "1 blue + 8 green pays a 5-cost Gnome, leaving 1 green" conflicts with its own rounding rule (1 + 8/2 = 5 uses all 8 green); the engine follows the rule.
- A swap counts as a move for auto-skip, as the spec says "any move".

---

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

## Round 4 triage (AC12, AC14, AC16)
Re-ran the acceptance file locally; the engine follows the spec, so no rules changed.
- AC12 expects a move onto a space held by an own creature to be absent from `legalActions()`, but AC38 and the spec's swapping rule require that swap to be a legal `move`.
- AC14: enemy Shieldbeard (4 Health) hit by a 2-Attack Scrapper (no type advantage) is at 2, not 3.
- AC16: the test's four `done`s leave the player in Action on turn 3; its next `done` ends the turn, so the following attack is correctly refused.

## Round 2 fixes
- Spell/crystal cards have no `abilities`; all `.abilities.includes/some` calls are now null-safe (fixed hand-render crash that broke AC9/17/46/50).
- AI: fighters stop mining after turn 5 so they advance; Normal AI beats a passive player well before turn 60.
