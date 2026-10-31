# 2026-10-29 – Ledger – every editor/layout copy matches the game's flames/glows; body types; Menu Builder picture

Job from Forge (overnight), after Gauge's check (gauge-overnight/B-editors.md).

## Flame/glow numbers (game: flames 0.40; glows 1.725 / 1.357 / 0.805 ×5)
- Local layout JSONs, only those 13 numbers changed (flames get `strength` where they had none): layouts/final-draft/layout.json, github-upload/final-draft/layout.json, arena/skullfang-arena-layout.json, arena/skull-arena-1.json, editors/owner-tools/arena-editor/skull-arena-final-draft.json.
- Local editors:
  - Oreheart Arena Editor.html, arena-editor-source.html and owner-tools/arena-editor/index.html now have the game's flame Brightness (135b9f4: slider 0.1–1.5, particles and halo × strength, default 1) and a glow max of 1.75. Checked: the page loads and the flame panel shows Brightness 0.1–1.5.
  - Local Game Editor.html and github-upload/owner-tools/game-editor-source.html: built-in effects = the game's, flame slider 0.1–1.5, glow max 1.75 (same as the online Game Editor v28).
- Main (factory-design): owner-layouts/final-draft/layout.json, owner-tools/game-editor-source.html, design/references/skullfang-arena-layout.json and design/references/arena-editor-source.html, same changes.
- **Not done:** Ken's 4 saved layouts inside the online Game Editor (gameLayouts: final draft, final deaft 1, game layout, game layout draft 1). The safety check refused overwriting them, and Forge agreed: they stay as Ken saved them (on his morning list: update them himself or tell Forge to). "Game now (Oct 29)" in the same list already has the right numbers. The sentToClaude history docs are left as they were sent.
- Left for others: the online Arena Editor, Menu Builder and Card Editor (Wright). factory/issue-8's public/owner-layouts/final-draft/layout.json and src/content/arena-layout.json (glows old, unused by the game) are Anvil's.

## Menu Builder (local editors/Oreheart Menu Builder.html)
- The built-in `menubg` is now the game's exact file public/art/menu-front-oct29.webp, which is Ken's front-menu-background-oct29-v2, re-encoded at 1670x942. It used to be the old cavern picture. Help text updated. Checked: the Main menu screen shows the new picture. The game's soft dark glow behind the buttons is CSS and is not in the builder.

## Animation slots: bodyType
- Studio library: `bodyType` set on all 69 cards (only that field added; checked):
  - rider: wolf-rider, ram-rider, phase-stalker
  - flyer: gyrocopter-ace, shard-guzzler
  - multileg: clockwork-beetle
  - biped: the rest (spells, crystals and the crystal node too)
- Spring has been told.
