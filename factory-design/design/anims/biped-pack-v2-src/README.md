# biped-pack-v2 build (Spring, 2026-10-30)
v2 = all 32 v1 clips (sources in ../biped-pack-v1-src) + 25 Mixamo clips (Ken OK, Oct 30; royalty-free per Adobe's Mixamo FAQ).
Raw Mixamo FBX files are NOT in the repo: they live on Ken's PC in art/mixamo/ (skin-less FBX, 30 fps, X Bot).
1. `blender -b --factory-startup --python packbuild.py -- --rig goblin-grunt-plain.glb --clips ../biped-pack-v1-src/clips.json --anims ../biped-pack-v1-src --mix mix.json --out out` (mixret.py: Mixamo -> pack rig, align retarget, wrist softening, strip_xz = in place)
2. `python slim.py out/pack.glb pre.glb`
3. `python groundfix.py pre.glb biped-pack-v2.glb <plain units dir> ground.json` (Hips lift so nothing sinks on goblin/gnome/dwarf/golem)
4. `python packcheck.py biped-pack-v2.glb <plain units dir> chk`
