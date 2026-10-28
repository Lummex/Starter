# Ledger – Round 27 body shrink (Oct 28, 2026)

Job from Forge (Ken OK'd, Oct 28 ~08:10: "It's okay to shrink the dwarf"). Done in my own Chrome tab. Game branch (factory/issue-8) not touched; no round started.

## Size (measured, not guessed)
- Game now, with Round 26 in: **95.38 MB** (all of `projects/oreheart-8/public/` on factory/issue-8; 1 MB = 1,000,000 bytes). My earlier "94.9 MB" was 0.5 MB too low.
- Plus the 15 Round 27 parts (4.81 MB) → **100.19 MB** – would have been over 100.
- Step 1, all 15 dwarf bodies 1024 → 512 px: −3.03 MB → **97.17 MB**. Not enough.
- Step 2, so **I also shrank all 13 gnome bodies** still at 1024 px (gyrocopter-ace was already 512): −4.74 MB → **92.43 MB after Round 27**. Under 95 MB with ~2.6 MB spare. (Clockwork beetle alone saved 2.0 MB: it had a 2.1 MB PNG picture.)
- Goblins untouched.

## Delivered on main
- `factory-design/design/models/round27-shrunk/` – 28 files `<card>-char.glb` (21.84 MB in total, were 29.61 MB) + `README.md` (card, old size, new size, game size).
- `factory-design/design/models/editor-setups-2026-10-28b.md` – new section "Body textures 1024 → 512 px" telling the builder to copy each file over `public/models/creatures/<card>/char.glb`, and the SIZE section replaced with the real numbers.

## Checks
- Every original first matched the game's `char.glb` on factory/issue-8 (git hash) – these are the game's own models.
- Textures only: JPEG stays JPEG at the same quality (85), the beetle's PNG stays PNG.
- After upload, in Chrome: fetched each new file from main and the original from factory/issue-8, decoded every accessor (meshopt decoder) and compared: **all identical** (131/131 per body, 4/4 for the beetle). Nodes, skins, meshes, materials and the 5 clips per body: identical. Every picture decodes at **512 × 512**. File hashes on main = my files.
- Also in my box: every non-picture byte range and the glTF JSON (apart from offsets) identical.
- Not looked at in a 3D viewer (no three.js here); the pictures are just smaller, nothing moves.

## Editors
- The Studio's Model Editor keeps the full 1024 px bodies (sharper for editing). Ken's look numbers don't change, because textures don't move anything. If Ken wants the Studio to use the exact game files too, Wright would publish them (I did not change the Studio).

## For Anvil / Forge
- Round 27 builder: copy the 28 files as listed; nothing else changes (models.json, events.json, clips, PARTS all the same).
