# Ledger – Studio default looks exported for Round 27 (Oct 28, 2026)

Job from Forge (Oct 28). Read from Oreheart Studio only (library + modelSetups), in my own Chrome tab.

## What I did
- Found **18** cards with a new default look saved today (04:49–05:38 UTC); no others.
- Exported them to `factory-design/design/models/editor-setups-2026-10-28b.json` + `.md`, with paste-ready `PARTS` entries, and **15 new part files** in `factory-design/design/models/parts/` (textures shrunk to 256 px, shape untouched).
- The first file (`editor-setups-2026-10-28.json`, Round 26) is unchanged.
- Studio: set `characters/<card>.steps.editors.note` to "exported for Round 27" on 17 cards (Grubnak has no `characters` record; kenNote not touched).

## Checks
- All 18 bodies in the Studio are **byte-identical** to the game's `char.glb` (git hash vs factory/issue-8).
- Grubnak's scepter is the same file as the game's (only 4 bytes of padding differ, checked part by part).
- Every new part: all non-picture bytes identical to the Studio file, glTF JSON identical apart from offsets, every picture decodes at 256 px. (Not loaded in a 3D viewer – no three.js in my workspace.)

## Matches the game now?
- **dwarf-pickman**: yes (no items).
- **goblin-scrapper, junk-shaman**: not yet, but their looks are unchanged since the first file, so Round 26 makes them match. Nothing new for Round 27.
- **cmd-grubnak**: body and scepter file match; scepter placement differs (game uses its own fit). Optional change in grubnak3d.ts.
- **Other 14**: body matches, but the game has none of their items yet (shield, packs, hammers, guns, rifle, pistol, warhammer, tower shield, pickaxe, crystal backpack, ram mount).
- **ram-rider**: the game has no ram at all; needs the ram as a mount (small code change for Ken's exact seat).
- **shieldbeard**: medic pack exported; **shoulder-pad shield is a placeholder only** (Sketch → Clay first).

## SIZE – needs Ken
- Adds **4.81 MB** → game about **99.7 MB** (over 95, under 100).
- To get back under 95: shrink body textures 1024 → 512 px on these 18 bodies (measured −3.55 MB → ~96.2 MB) and on the other ~13 dwarf/gnome bodies (estimated −2.5 MB → ~93.7 MB). Shape never touched. **Waiting for Ken's OK; nothing shrunk in the game.**

## Not done / for others
- Other editors (Game Editor, Arena Editor, Menu Builder) were not changed; they are still separate artifacts. Card Editor/Art Studio not affected by 3D looks.
- Brewmaster crystal hammer and Grubnak junk throne exist in the Studio but are not in Ken's saved looks – not exported.
