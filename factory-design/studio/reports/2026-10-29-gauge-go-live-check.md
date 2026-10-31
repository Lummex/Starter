# Gauge report: overnight check + go-live GO/NO-GO (Oct 29) — job from Forge

Ken (via Forge, Oct 29): "26 and 28. You can go ahead and make that live ... As long as you test it out and it doesn't break anything first." Report only; nothing was changed.

## Verdict: GO
- Preview tested: https://oreheart-8-7d7yb4xxs-lummex.vercel.app (Vercel deployment 52tgyqvy8J56HxQLSBc8Xi1txmTg, "Preview factory/issue-8" run 40847462824, factory/issue-8 head 3ffab4a: Round 26 + Ken's owner fixes + Round 28 move orders + front menu v2).
- No blocking problems at 844x390 (phone) or 1600x900 (desktop, mouse).
- Ken does the Promote to Production click himself.

## How I split it (helpers, all report-only)
- A (Opus): first look at the menu-v1 preview 5j7i7w5h8; stopped by the account spend limit (429), replaced by D/E.
- B (Opus): Studio vs game vs editors. C (Opus): Aethervein model.
- D (Fable): full play test, phone 844x390. E (Fable): full play test, desktop 1600x900.
- Gauge: size check, preview link from the run log, spot checks of B and C (flame/glow numbers on GitHub, Aethervein renders).

## Game play test (D + E)
- Front menu shows Ken's v2 picture (checked by eye against art/main-menu/front-menu-background-oct29-v2.webp); no old cavern picture. PASS
- Full matches: phone 23 turns to the result screen; desktop 26 turns, then Give up → defeat screen → Menu. PASS
- Zero console errors; every network request 200/206 (art, speech, banners, music, all .glb/models.json). PASS
- Deploy by card drag, hover/press raised card, Done + drop-up, 50 s timers, computer turns, Crystal Flow (+2 beside a mine). PASS
- Ken's owner fixes: no mine counters or skulls; flames and glows show; desktop drag-pan, wheel zoom, arrow keys. PASS
- Round 28: M1 order, M2 dots + "N turns" while dragging, M3 one step per turn by itself and clears on arrival, M4 ✕ cancel, M5 "Chase" label + re-route. PASS. The chase auto-attack was likely seen on desktop (enemy lost 1 HP, order cleared), not 100% proven.
- Tutorial starts from the Welcome box; tip box drags by its handle; Skip returns to the menu. PASS
- Card-drag tweaks vs the approved l9l66hs8m: no regression. Row above home refuses drops; home row deploys and now glows during a drag.
- Not verified (tool limits): full screen toggle (embedded browser blocks it), real pinch, the red outline on an illegal square (hidden under the dragged card), the dragged card's level-out tilt.

## Size: PASS
- dist ≈ 94,967,649 bytes (public/ 93,562,616 from the GitHub tree at 3ffab4a + JS 1,221,518 + CSS 182,809 measured on the preview + index.html). Anvil's build says 94,978,702. Both are under 95,000,000; only ~20–30 KB left.

## Cosmetic list for Anvil (after go-live)
1. Phone: the Welcome / Start Tutorial box sits on the Auto/PC/Phone switch; "Phone" can't be tapped while it shows.
2. Phone: Choose Your Commander deck strip runs under the mode list (third deck and "Copy to my decks" clipped).
3. Phone: defeat screen is taller than 390 px (title clipped, Play again / Menu need a scroll).
4. Big card view has no close button and Escape doesn't close it (tapping outside works).
5. Tutorial tip says "Grubgrabber Miner" but the card is "Goblin Miner".
6. The computer's revealed cards are drawn top-left over the arena.
7. Desktop: the Done drop-up buttons and the give-up dialog are overlapped by the turn text / big countdown digit.
8. Already in the approved build: on phone the open hand fan covers board rows 5–7, so units there (and their ✕) get grabbed as cards until the hand tucks.

## For Ken to decide (visual / design)
- Desktop dragged card is ~10% smaller than before (225 vs 254 px) and now smaller than the raised hand card. On phone the dragged card (154x228) hides much of the board, same as before.
- With no crystals and every unit on an order, turns auto-pass very fast (turn 2 → 14 in ~20 s), leaving no moment to press ✕.
- Try full screen and pinch once on the real phone.

## Studio vs game vs editors (B, C; Studio at the version read Oct 29 ~08:30 UTC)
1. Card Editor backgrounds: FAIL. Frame pictures and faction map match the game (gnome purple/light blue/silver, no gold; dwarf blue/gold). But a fresh Card Editor starts with the old gold gnome / purple dwarf frames until "Card format final 1.0" is loaded (Wright); spells/instants/crystals share one white-and-gold frame for all factions (Ken's call); old gold gnome frames still fallbacks in the game (Anvil); goblin frames have purple trims (Ken's call).
2. Model Editor animation slots: PASS. 35 slots = the 35 rows of studio/animation-slots-proposal.md ("34" was a miscount); blank / "No animation" / filtered clips / "Have an agent create a new animation…". Data gap: all 69 library rows have no body type, so mounts, beetle and gyrocopter default to two legs (Ledger).
3. Flames and glows: FAIL. Game (src/content/owner-layout.json): flames 0.4, glows 0.805 / 1.357 / 1.725. Editors and layout copies: 0.61 and 0.7 / 1.18 / 1.5 (Gauge re-checked on GitHub). The Arena Editor (online + local) has no flame-brightness setting, so its flames look 2.5x brighter (Ledger, Wright publishes). The game's public/owner-layouts/final-draft/layout.json is stale (Anvil; not read by scene.ts).
4. Menu background in editors: FAIL. Online Menu Builder (VszkXj…) and the local Menu Builder still show the old cavern picture (Wright, Ledger).
5. Aethervein (overclocked-conduit): two arms PASS, no shield PASS, Idle face FAIL (the brow plate folds over the grin through the whole Idle; Spring), not in the game yet (expected; on hold for the gnome silver recolour). Model metal is brass/gold, but Ken's note asks for purple / light blue / silver.

Full helper notes: Forge's shared notes folder, gauge-overnight/ (A-game.md, B-editors.md, C-aethervein.md, GO-phone.md, GO-desktop.md).
