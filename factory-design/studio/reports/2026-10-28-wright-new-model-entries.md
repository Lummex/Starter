# Wright: new Model Editor entries (Oct 28, 2026)

Job from Forge (Oct 28): add Clay's two rigged remakes and Spring's four v5 versions to the Model Editor room in Oreheart Studio as NEW entries. Nothing replaced; no card `src` changed.

## Done (Studio version 21, still pinned)
| Key | Name in the Model Editor | Source | Check |
|---|---|---|---|
| anvilsworn-miner-rig-oct28 | Anvilsworn Miner rigged (Oct 28) | main: factory-design/design/models/anvilsworn-miner-rig-oct28.glb | sha256 1db86888…a9a58 = Clay's; 24 bones; 6 clips |
| borgo-rig-oct28 | Borgo rigged (Oct 28) | main: factory-design/design/models/borgo-rig-oct28.glb | sha256 2c36bf35…8a425 = Clay's; 24 bones; 5 clips |
| goblin-grunt-v5 | Snotskull Grunt + death (Oct 28) | blender-queue: blender-jobs/goblin-grunt-runway-death-r3/out/char.glb | 24 bones; 15 clips incl. OH_Death |
| goblin-slinger-v5 | Skullflinger + throw (Oct 28) | blender-queue: blender-jobs/goblin-slinger-runway-throw/out/char.glb | 24 bones; 15 clips incl. OH_Attack (throw) |
| goblin-sneak-v5 | Backstabbing Thief + backstab (Oct 28) | blender-queue: blender-jobs/goblin-sneak-runway-backstab/out/char.glb | 24 bones; 15 clips incl. OH_Attack_Backstab |
| rotgut-grenadier-v5 | Goblin Chef + death (Oct 28) | blender-queue: blender-jobs/rotgut-grenadier-runway-death-r3/out/char.glb | 24 bones; 15 clips incl. OH_Death |

- Files: `models/<key>.glb.txt` (base64) added to the Studio's published files; entries added to the bundled list in `model-editor.html`; room cache bumped to `?v=19`. Read back from the live Studio: all 7 files byte-identical to what I sent.
- Size: adds about 12.6 MB of GLB to the Studio page (not the game). Game size unchanged.

## Checked live
- Anvilsworn Miner rigged: opened in the Studio's Model Editor in Chrome, loaded, and played Heavy_Hammer_Swing (arms swing, mesh bends cleanly).
- The other five: NOT watched playing live. Their files are byte-identical in the Studio and are valid rigged GLBs with the listed clips, and they use the same loading path as the Anvilsworn one. My Chrome tab stopped drawing the 3D view (background tab), and a local headless test was blocked (three.js CDN/npm not reachable from my workspace; fetching it through Ken's Chrome was refused by a permission check).

## Side effect, fixed
Picking from the dropdown by typing added about 20 copies of the Anvilsworn model to the editor's scratch scene (saved in Ken's browser). I removed them one by one; the scene is back to Grudge Hurler + shield. No database records were written.

## Next
- Ken: open Model Editor → "Add a card model or accessory…" → pick any of the six to look at them.
- After Ken approves: Ledger sets `library/<card>.src = {key, kind:"bundled"}` (dwarf-smith-miner, cmd-borgo, goblin-grunt, goblin-slinger, goblin-sneak, rotgut-grenadier).
