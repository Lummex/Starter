# "Approve here" opens the right card, Oct 28 2026

Ken asked Wright directly (follow-up to the Studio Checklist job): "Approve here" should land on the actual card, not just open the editor.

## What changed
- **Model Editor** (https://claude.ai/artifact/5isEcqgnmtqRHJUWAmqRDd, version 68): understands two link endings.
  - `#<card-id>` opens the Cards & models list with that card opened and scrolled into view (art, sheet, notes, accessories).
  - `#scene-<card-id>` loads that card straight into the 3D scene (with its setup and accessories).
  Nothing else in the editor changed (small add-on next to the library loader).
- **Motion References** (https://claude.ai/artifact/U9YiTAL4juKxjLgvNeKEe8): `#<character-id>` shows only that character's videos.
- **Studio Checklist**: every "Approve here" now adds the card: Card art / Reference sheet go to `#<id>`, 3D model / Model Editor / Blender / Editors go to `#scene-<id>`, Runway goes to Motion References `#<id>`.

## Checked
In my own tab: `#dwarf-smith-miner` opened Anvilsworn Miner's card in the list; `#scene-goblin-scrapper` put Bowler Brawler (with bowling ball) in the scene; Motion References `#gyrocopter-ace` showed only Thunderwing Gyronaut.

## For other agents
Any program or report can link straight to a card the same way, e.g. https://claude.ai/artifact/5isEcqgnmtqRHJUWAmqRDd#scene-gyrocopter-ace. Ledger: the code is the `DEEP` / `readDeep` / `tryDeep` block after `libLoad` in the Model Editor; please keep it when you republish.
