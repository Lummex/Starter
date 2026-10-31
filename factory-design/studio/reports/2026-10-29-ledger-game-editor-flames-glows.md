# 2026-10-29 – Ledger – Game Editor matches Anvil's flame/glow fixes

Job from Forge (after Anvil's owner fixes, factory/issue-8 cd698e7, owner-layout.json at 9289c3e).

## Oreheart Game Editor (https://claude.ai/artifact/FihA5STvHpanWxG8pT11Jc), version 28
- Built-in "skull arena final draft" effects (`DEFAULT_ARENA`, also loaded on first open) = the game's owner-layout.json effects now: 6 flames Brightness 0.40, glows 1.725 / 1.357 / 0.805 ×5, plus the 3 crystal flows and the small position fixes that were already in the game. Cut-outs, arena, corners and look were already the same.
- Flame Brightness slider now 0.1–1.5 (same range as the game's arena-fx.ts). Flame drawing already used Brightness the same way as the game (particles × strength, halo 0.35 × strength).
- Glow Brightness slider max 1.5 → 1.75 (so 1.725 fits). Glow drawing caps at 1 like the game.
- New saved layout in the editor's list: **"Game now (Oct 29: flames 0.40, torch glows x1.15)"** = Ken's "final deaft 1" with only these 13 numbers changed. Ken's own saves are untouched.
- Checked in Chrome: the page loads; the built-in effects show 57 effects incl. the 3 flows; a flame shows Brightness 0.4 on the new slider.

## Not changed
- Oreheart Arena Editor (UrRDUmZnyQi3ZqVLgrhw9F, Oct 20): the older tool, replaced by the Game Editor. No flame Brightness and no layout data. Left as is.
- No editor shows the mine counters or the owned-mine emblems/symbols.
- The game's own arena-fx.ts still has glow Brightness max 1.5 (`SLIDERS.glow`). Only matters if the game's built-in FX editor is used; tell Anvil if it should be 1.75.
