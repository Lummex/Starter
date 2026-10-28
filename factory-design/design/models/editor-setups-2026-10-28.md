# Model Editor setups for the game (Oct 28, 2026)

Made by Ledger from Ken's saved setups in the Model Editor (database `library`, field `setup`).
Data file: `editor-setups-2026-10-28.json` (same folder). New accessory files: `parts/`.

## How to read the numbers

- **Everything is local to a bone of the raw GLB.** Load the character's GLB as-is (GLTFLoader, meshopt), find the bone by name, `bone.add(part)`, where `part` is the raw `scene` of the accessory GLB (no re-centring, no normalising). The game already does exactly this for parts that have a `look` in `PARTS` (creature3d.ts, `if (pc.look) {...}`).
- **position**: bone-local units (the Meshy rig sits under `Armature` with scale 0.01, so numbers like 27 or scale 23 are normal).
- **rotationDeg**: degrees, three.js Euler order **XYZ** (`part.rotation.set(x, y, z, 'XYZ')` after converting to radians).
- **scale**: the editor keeps one size number plus a `stretch` per axis. For the game, scale per axis = size × stretch. `partsTableLook.scale` already has this multiplied out.
- **partsTableLook** = ready to paste as `look: { bone, pos, rot, scale }` in `PARTS`.
- Ken placed the parts on the **rest pose** (no clip playing). During clips the parts simply follow the bone.
- These numbers only fit when the game uses **the same character GLB and the same accessory GLB** as the editor:
  - `model.sameFileAsGame: true` = the game's `char.glb` is byte-identical to the editor's model (checked by git hash). True for 11 of 12; **false for the Gyronaut** (see below).
  - `inGame.sameShapeAndOrigin: true` = the game's part file has the same shape, size and origin as the editor's (checked by measuring the vertices). False only for the **Shiv Rat dagger**.
- **Bone names** (all 12 use the same 24-bone Meshy rig): Hips, Spine, Spine01, Spine02, neck, Head, head_end, headfront, LeftShoulder, LeftArm, LeftForeArm, LeftHand, RightShoulder, RightArm, RightForeArm, RightHand, LeftUpLeg, LeftLeg, LeftFoot, LeftToeBase, RightUpLeg, RightLeg, RightFoot, RightToeBase. Names are case-sensitive (`neck` is lower case).
- **A part attached to another part** (Gyronaut's second wings): `partsTableLook` already folds both transforms into one bone-local transform on Spine02 (checked: same matrix to within 0.0005).
- **height** is information only (Ken, Oct 28: only the final game heights matter). `bodyHeightSquares` = editor size of the body alone (1 unit = 1 board square).
- `effects` (glow, orbs, flame, twinkles) and `editorOnly` (the "keep a part solid" boxes) are listed for completeness; they are not models.
- `clips` = the clip names inside the editor's GLB for that card.

## What the builder needs to do (per card)

| Card | What changes in PARTS / files |
|---|---|
| goblin-bomber | nothing (bare fists) |
| goblin-grunt | add `look` to frying-pan |
| goblin-pebbler | same `look` as the game has now |
| goblin-scrapper | **new ball numbers** (Oct 28 fix: the ball no longer sinks into the floor) |
| goblin-slinger | add `look` to skull-mace |
| goblin-sneak | same as the game has now |
| junk-shaman | **new staff numbers** (Oct 28: staff held upright, like the card art) |
| rotgut-grenadier | same as the game has now |
| shiv-rat | add **backpack.glb** (new) and **replace dagger.glb** (the game has an older, thinner dagger), both from `parts/`; add both `look`s |
| skullbasher-rusher | add `look` to mace; shield moves from LeftForeArm to **LeftHand** with Ken's bigger size |
| gyrocopter-ace | **replace char.glb** with `parts/gyrocopter-ace-v4-char.glb` (Oct 27 model with OH_Hover, OH_Fly, OH_Attack, OH_Hit); add the two gyro-wings parts (same file `gyro-wings.glb`) |
| gnome-tinker | add scepter, crystal-shield, wrench (all new, from `parts/`) |

Suggested file names in the game folder `public/models/creatures/<card>/`: see `parts-snippet.ts` below (file field).

## New files in `parts/`

All are the editor's own GLBs, decoded from `models/<key>.glb.txt`. Only the **textures were shrunk** (1024 → 512 px, or 512 → 256 px for the small Tinker items) to fit the size budget. Geometry, UVs, bones and clips are byte-identical to the editor files (checked by decoding every accessor).

| File | Bytes | Goes to |
|---|---|---|
| shiv-rat-v2-backpack.glb | 441,828 | shiv-rat/backpack.glb (new) |
| shiv-rat-v2-dagger.glb | 330,656 | shiv-rat/dagger.glb (replaces 139,184) |
| gyrocopter-ace-gyro-wings-oct25.glb | 570,912 | gyrocopter-ace/gyro-wings.glb (new) |
| gyrocopter-ace-v4-char.glb | 1,125,672 | gyrocopter-ace/char.glb (replaces 914,964) |
| gnome-tinker-scepter-oct25.glb | 309,916 | gnome-tinker/scepter.glb (new) |
| gnome-tinker-crystal-shield-oct25.glb | 277,828 | gnome-tinker/crystal-shield.glb (new) |
| gnome-tinker-wrench-oct27.glb | 733,400 | gnome-tinker/wrench.glb (new; its size is mostly geometry, not shrinkable) |
| **Total** | **3,790,212** | net game growth after the two replacements: **+2,736,064 bytes** |

Game was 92.2 MB → about **94.9 MB** after this. That is under 95 MB but only just. Anything else added must shrink textures elsewhere first.

## Paste-ready PARTS entries

`len`, `grip` and `rot` are only used when there is no `look`; they are placeholders here.

```ts
'goblin-bomber': [],
'goblin-grunt': [{ name: 'frying-pan', file: 'frying-pan.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-13.281, 9.76, 19.154], rot: [126.389, -36.031, 38.735], scale: [43.449, 43.449, 43.449] } }],
'goblin-pebbler': [{ name: 'club', file: 'club.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-9.231, 12.794, 2.402], rot: [27, 11, 52], scale: [25, 25, 25] } }],
'goblin-scrapper': [{ name: 'bowling-ball', file: 'bowling-ball.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-3.51, 8.733, -1.595], rot: [50.405, 1.159, 166.638], scale: [23, 23, 23] } }],
'goblin-slinger': [{ name: 'skull-mace', file: 'skull-mace.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-4.733, 9.93, 4.184], rot: [7.674, 57.734, 67.236], scale: [19, 19, 19] } }],
'goblin-sneak': [{ name: 'bag', file: 'bag.glb', bone: ['neck'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'neck', pos: [-5.34, 1.862, -14.029], rot: [8.548, 3.663, 3.154], scale: [15, 15, 15] } },
  { name: 'dagger', file: 'dagger.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [8.502, 7.038, -9.251], rot: [159.362, -37.54, -90.548], scale: [29, 29, 29] } }],
'junk-shaman': [{ name: 'staff', file: 'staff.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [6.217, -15.298, 17.834], rot: [110.02, -62.427, -52.655], scale: [53, 53, 53] } }],
'rotgut-grenadier': [{ name: 'spatula', file: 'spatula.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [18.162, -9.844, 27.054], rot: [35.239, -53.157, -88.87], scale: [43, 62.78, 32.68] } }],
'shiv-rat': [{ name: 'backpack', file: 'backpack.glb', bone: ['Spine'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine', pos: [0.756, -10.807, -6.926], rot: [176.37, 0.217, 178.765], scale: [19, 19, 19] } },
  { name: 'dagger', file: 'dagger.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-8.478, 10.344, 13.399], rot: [132.296, -65.655, 54.851], scale: [26, 26, 26] } }],
'skullbasher-rusher': [{ name: 'mace', file: 'mace.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-8.9, 18.747, 8.443], rot: [-8.725, 65.398, 73.206], scale: [36, 36, 36] } },
  { name: 'shield', file: 'shield.glb', bone: ['LeftHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'LeftHand', pos: [-3.667, 7.628, -2.335], rot: [-157.797, -59.618, -151.009], scale: [37, 37, 37] } }],
'gyrocopter-ace': [{ name: 'gyro-wings', file: 'gyro-wings.glb', bone: ['Spine02'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine02', pos: [1, 8.127, -15.443], rot: [-178.557, 0.345, 175.676], scale: [53, 53, 53] } },
  { name: 'gyro-wings-2', file: 'gyro-wings.glb', bone: ['Spine02'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine02', pos: [2.731, 7.516, -13.38], rot: [-84.27, 23.646, 2.952], scale: [62.608, 56.172, 69.629] } }],
'gnome-tinker': [{ name: 'scepter', file: 'scepter.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-5.106, 4.336, 10.391], rot: [-91.862, 22.237, 178.441], scale: [29.826, 29.826, 29.826] } },
  { name: 'crystal-shield', file: 'crystal-shield.glb', bone: ['LeftForeArm'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'LeftForeArm', pos: [-6.589, 20.19, 0.021], rot: [-110.166, -61.024, 179.49], scale: [29.536, 29.536, 29.536] } },
  { name: 'wrench', file: 'wrench.glb', bone: ['Hips'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Hips', pos: [-12.29, -9.118, 25.184], rot: [5.886, 46.054, 92.626], scale: [16.542, 16.542, 16.542] } }],
```
