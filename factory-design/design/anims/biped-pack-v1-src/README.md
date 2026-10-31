# biped-pack-v1 sources (Spring, 2026-10-30)
- `biped-*.py`: one script per clip, Blender worker animation API (factory/blender-worker/blender_ops/anim_api.md), keyed on the goblin-grunt Meshy rig (base = its Idle frame 0).
- `clips.json`: clip list (loop, return_to_idle, feet_may_move, rootSpeed).
- Build: `blender -b --factory-startup --python packbuild.py -- --rig goblin-grunt-plain.glb --clips clips.json --anims . --out out` (env BOPS = blender_ops folder; rig = meshopt-free copy via glbtool.decompress), then `python slim.py out/pack.glb biped-pack-v1.glb`.
- Check on units like the game: `python packcheck.py biped-pack-v1.glb <plain units dir> chk` (numpy; uses ohrt.py = the retarget the game uses).
