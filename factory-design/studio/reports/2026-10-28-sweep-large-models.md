# Sweep report: large models backup (Oct 28, 2026)

**Job from:** Forge, passing on Ken's request (Oct 28 ~21:05 UTC): back up all big Meshy originals to Ken's PC, then delete them from GitHub and keep only the resized models.

## Scope
Every file under `factory-design/models/` on **main** larger than 3 MB: **90 files, 777,862,320 bytes (~778 MB)**, at main commit `58bd8e4a`. Nothing else was touched (not projects/, factory-data/, factory-design/design/models/, pictures, the game branch, or small files such as models.json).

## Done
1. **Copied all 90 to Ken's PC:** `C:\Users\kentu\Downloads\_discontinued\Large Models\<card>\<file>.glb`. The `_discontinued` folder was there already but empty; `Large Models` is new.
2. **Checked all 90 on the PC:** read each file back from the PC and compared it with GitHub. Every file has the same size **and** the same git SHA-1. No file failed.
3. **Wrote the full list** (path, size, SHA) in `factory-design/discontinued/README.md`, section 6 "Large models moved to Ken's PC (Oct 28)".

## NOT done yet: deleting them from GitHub
I did **not** delete the 90 files from main. The team rule (and my notes, after the Oct 28 builds job) is that a delete needs **Ken's own yes**, in his chat or in the Studio. An OK passed along inside a job message isn't enough.
- Asked Ken in Oreheart Studio → **Waiting for you** → `delete-large-models-oct28` (Yes / No / note).
- When he says Yes: delete exactly the 90 paths in README section 6 from main with the commit message "Move 90 large Meshy originals to Ken's PC backup (Ken OK, Oct 28)", then check that projects/ and factory-design/design/models/ are unchanged and the repo size dropped.
- Note: deleting from main does not shrink git history; the files are still in old commits. The repo download only gets smaller if history is rewritten, which is a separate decision.

## Checks
- Game branch `factory/issue-8`, `projects/`, `factory-design/design/models/`: **unchanged** (nothing on GitHub was changed except the 3 notes files below).
- `models.json` stays in each folder, so the Meshy workflow skips these models and won't pay to remake them.
- Places that mention the big files (no code depends on them, docs only): `factory-design/design/models/rigged-remakes-oct28.md` and `reports/2026-10-28-clay-rigged-remakes.md` say the anvilsworn-miner-rig and borgo-rig originals are "kept"; `factory/scripts/meshy-models.mjs` and `meshy-models.yml` write to `factory-design/models/`. Worth a look before the delete.

## Left over on Ken's PC
The browser saves downloads into the top of Downloads first, so there are also 90 loose copies named `LargeModels__<card>__<file>.glb` (~778 MB) plus `sweep-largemodels-manifest.tsv`, `sweep-src-*.md` and the `sweep-upload-1028-lm` folder. They are duplicates. I have no tool to move or delete files on the PC, so Ken can delete them, or I'll move them into `_discontinued` when I have one.
