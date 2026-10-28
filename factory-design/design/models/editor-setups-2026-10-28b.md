# Studio setups for the game – second batch (Oct 28, 2026, for Round 27)

Made by Ledger from Ken's saved default looks in **Oreheart Studio** (Model Editor room; database `library`, field `setup`), saved Oct 28 between 04:49 and 05:38 UTC.
Data file: `editor-setups-2026-10-28b.json` (same folder). New accessory files: `parts/`.
The first file (`editor-setups-2026-10-28.json`) is used by Round 26 and is unchanged.

18 cards: axe-thrower, barrelback-courier, brewmaster, cmd-grubnak, crystal-drunk-delver, deepforge-crossbowman, dwarf-miner, dwarf-pickman, dwarf-stoneback, goblin-scrapper, grimhold-ravager, ironhammer-berserker, junk-shaman, oathbound-pikeman, queen-brunhilda-stonebeard, ram-rider, rune-splitter, shieldbeard. (No other card has a new setup today.)

## How to read the numbers

Same rules as the first file:
- **Everything is local to a bone of the raw GLB.** Load the character GLB as-is, find the bone by name, `bone.add(part)` with the raw `scene` of the accessory GLB (no re-centring). The game already does this for `PARTS` entries that have a `look` (creature3d.ts).
- **position** = bone-local units (Meshy rig under `Armature` at scale 0.01, so 20 or 30 is normal). **rotationDeg** = degrees, Euler **XYZ**. **scale** per axis = size × stretch (`partsTableLook.scale` already multiplied out).
- Parts were placed on the **rest pose**; during clips they follow the bone.
- `model.sameFileAsGame: true` = the game's `char.glb` is byte-identical to the Studio's model (checked by git hash). **True for all 18.**
- `height` is information only (Ken: only final game heights matter). `mainPlacement` = small offsets/tilts of the body in the Studio; the game stands figures on the ground and centres them, so these are not used.
- `effects` and `editorOnly` (solid-part / cut-out boxes) are listed for completeness; they are not models.

## Does the Studio look match the game now? (factory/issue-8, checked Oct 28)

| Card | Body | Items | What the builder does |
|---|---|---|---|
| axe-thrower | same | game has none | add **shield** (RightHand) |
| barrelback-courier | same | game has none | add **barrel-pack** (Spine02) |
| brewmaster | same | game has none | add **keg-pack** (Spine02). Crystal hammer exists but is not in Ken's look – not exported |
| cmd-grubnak | same | scepter file is the same (only padding differs), but the game places it with `attachPart` (len 1.05, grip 0.12), not Ken's numbers | optional: use Ken's scepter look in grubnak3d.ts (see below). Game keeps its throne (not in Ken's setup). Scepter glows/twinkles listed in `effects` |
| crystal-drunk-delver | same | game has none | add **pickaxe** (RightHand) + **crystal-backpack** (Spine02) |
| deepforge-crossbowman | same | game has none | add **crystal-gun** (RightHand) |
| dwarf-miner | same | game has none | add **tower-shield** (LeftForeArm) |
| dwarf-pickman | same | none in either | **matches already** – nothing to do |
| dwarf-stoneback | same | game has none | add **hammer** (RightHand) |
| goblin-scrapper | same | ball numbers differ from game now | **same as the first file** (Round 26 brings the game in line). Nothing new for Round 27 |
| grimhold-ravager | same | game has none | add **hammer** (RightHand) |
| ironhammer-berserker | same | game has none | add **crystal-pistol** (RightHand) |
| junk-shaman | same | game staff has no `look` yet | **same as the first file** (Round 26). Nothing new for Round 27 |
| oathbound-pikeman | same | game has none | add **rifle** (RightHand) |
| queen-brunhilda-stonebeard | same | game has none | add **warhammer** (RightHand) |
| ram-rider | same | game has **no ram** | add **ram** as a mount (needs a small code change for Ken's exact placement, see JSON `mount`) |
| rune-splitter | same | game has none | add **crystal-hammer** (RightHand) |
| shieldbeard | same | game has none | add **medic-pack** (Spine02). **Shoulder-pad shield: placeholder only** – not made yet (Sketch draws it, Clay makes it). Nothing to build for it now |

## New files in `parts/`

All are the Studio's own GLBs (`models/<key>.glb.txt`, decoded). Only the **textures were shrunk to 256 px** (from 512; the ram from 1024). Geometry, UVs and all other bytes are identical to the Studio files (checked by comparing every non-image byte range and the glTF JSON; every new picture decodes).

| File | Bytes | Goes to `public/models/creatures/` |
|---|---|---|
| axe-thrower-shield-oct25.glb | 335,984 | axe-thrower/shield.glb (new) |
| barrelback-courier-barrel-pack-oct25.glb | 387,532 | barrelback-courier/barrel-pack.glb (new) |
| brewmaster-keg-pack-oct25.glb | 403,584 | brewmaster/keg-pack.glb (new) |
| crystal-drunk-delver-pickaxe-oct25.glb | 229,252 | crystal-drunk-delver/pickaxe.glb (new) |
| crystal-drunk-delver-crystal-backpack-oct25.glb | 406,968 | crystal-drunk-delver/crystal-backpack.glb (new) |
| deepforge-crossbowman-crystal-gun-oct25.glb | 291,020 | deepforge-crossbowman/crystal-gun.glb (new) |
| dwarf-miner-tower-shield-oct25.glb | 280,912 | dwarf-miner/tower-shield.glb (new) |
| dwarf-stoneback-hammer-oct25.glb | 239,036 | dwarf-stoneback/hammer.glb (new) |
| grimhold-ravager-hammer-oct25.glb | 256,112 | grimhold-ravager/hammer.glb (new) |
| ironhammer-berserker-crystal-pistol-oct25.glb | 292,024 | ironhammer-berserker/crystal-pistol.glb (new) |
| oathbound-pikeman-rifle-oct25.glb | 316,064 | oathbound-pikeman/rifle.glb (new) |
| queen-brunhilda-stonebeard-warhammer-oct25.glb | 280,216 | queen-brunhilda-stonebeard/warhammer.glb (new) |
| ram-rider-ram-oct25.glb | 408,672 | ram-rider/ram.glb (new) |
| rune-splitter-crystal-hammer-oct25.glb | 317,540 | rune-splitter/crystal-hammer.glb (new) |
| shieldbeard-medic-pack-oct25.glb | 363,476 | shieldbeard/medic-pack.glb (new) |
| **Total** | **4,808,392** | nothing is replaced |

## SIZE – needs Ken's OK

- Game after Round 26: about **94.9 MB**. This export adds **4.81 MB** → about **99.7 MB**. That is **over 95 MB** (still under 100 MB).
- Already squeezed: these parts are at 256 px. Going to 128 px saves only ~0.7 MB more (the rest is geometry, which we never touch).
- **Textures that could be shrunk to get back under 95 MB** (shape untouched):
  - Body texture 1024 → 512 px on the 18 bodies in this batch: saves **3.55 MB** (measured: ~0.2 MB each; Grubnak 0.08 MB) → about **96.2 MB**.
  - The same on the other dwarf/gnome bodies already in the game (gearward-sentinel, glyphshield-warden, gnome-cogger, gnome-illusionist, gnome-smith-miner, gnome-tinker, gnome-widget, gyrocopter-ace, hexwright-apprentice, phase-stalker, runic-siphoner, spark-gnome, the-great-steam-golem): about **2.5 MB** more (estimate, ~0.2 MB each, not measured) → about **93.7 MB**.
  - Only with Ken's OK. Nothing has been shrunk in the game.

## Grubnak scepter (optional, grubnak3d.ts)

Ken's look: `{ bone: 'RightHand', pos: [-2.754, 16.04, 5.84], rot: [-117, 34, 153], scale: [74.48, 76, 76] }` (body scale 1.22 in the Studio is information only). Today the game fits the scepter with `attachPart(len 1.05, grip 0.12, rot [90,0,0])`.

## Paste-ready PARTS entries

`len`, `grip` and `rot` are only used when there is no `look`; placeholders here. Bone names are case-sensitive.

```ts
'axe-thrower': [{ name: 'shield', file: 'shield.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-12.652, 21.111, 0.103], rot: [-58.52, 43.389, -47.797], scale: [17, 17, 17] } }],
'barrelback-courier': [{ name: 'barrel-pack', file: 'barrel-pack.glb', bone: ['Spine02'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine02', pos: [3.631, 13.995, -18.271], rot: [-160.68, -0.629, 176.305], scale: [28.026, 28.026, 28.026] } }],
'brewmaster': [{ name: 'keg-pack', file: 'keg-pack.glb', bone: ['Spine02'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine02', pos: [3.052, 10.711, -23.178], rot: [-167.137, 7.3, 175.685], scale: [24.348, 24.348, 24.348] } }],
'crystal-drunk-delver': [{ name: 'pickaxe', file: 'pickaxe.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-11.916, 9.542, 10.035], rot: [-47.527, 43.36, 126.79], scale: [29.769, 29.769, 29.769] } },
{ name: 'crystal-backpack', file: 'crystal-backpack.glb', bone: ['Spine02'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine02', pos: [-22.899, -0.026, -8.549], rot: [1.154, 39.312, 0.926], scale: [23.689, 23.689, 23.689] } }],
'deepforge-crossbowman': [{ name: 'crystal-gun', file: 'crystal-gun.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-13.667, 14.213, 10.056], rot: [124.622, -40.578, -4.098], scale: [33.745, 33.745, 33.745] } }],
'dwarf-miner': [{ name: 'tower-shield', file: 'tower-shield.glb', bone: ['LeftForeArm'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'LeftForeArm', pos: [3.309, 4.936, 12.344], rot: [-35.451, -2.837, 156.794], scale: [43, 43, 43] } }],
'dwarf-pickman': [],
'dwarf-stoneback': [{ name: 'hammer', file: 'hammer.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-7.435, 10.978, 9.103], rot: [127.903, -62.14, 44.02], scale: [31.335, 31.335, 31.335] } }],
'goblin-scrapper': [{ name: 'bowling-ball', file: 'bowling-ball.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-3.51, 8.733, -1.595], rot: [50.405, 1.159, 166.638], scale: [23, 23, 23] } }],
'grimhold-ravager': [{ name: 'hammer', file: 'hammer.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-7.368, 14.973, 3.457], rot: [-39.361, 49.914, 95.703], scale: [31.019, 31.019, 31.019] } }],
'ironhammer-berserker': [{ name: 'crystal-pistol', file: 'crystal-pistol.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-1.882, 21.222, -1.587], rot: [168.899, -32.158, 92.346], scale: [16.176, 16.176, 16.176] } }],
'junk-shaman': [{ name: 'staff', file: 'staff.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [6.217, -15.298, 17.834], rot: [110.02, -62.427, -52.655], scale: [53, 53, 53] } }],
'oathbound-pikeman': [{ name: 'rifle', file: 'rifle.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-44.159, 16.494, 20.613], rot: [163.196, -28.673, 7.516], scale: [79.963, 79.963, 79.963] } }],
'queen-brunhilda-stonebeard': [{ name: 'warhammer', file: 'warhammer.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-6.749, 6.967, 10.796], rot: [31.091, 75.481, 74.138], scale: [31.171, 31.171, 31.171] } }],
'ram-rider': [{ name: 'ram', file: 'ram.glb', bone: [], len: 0.9, grip: 0.5, rot: [0, 0, 0], mount: true } /* exact Studio look: ram at [0.011, 0.473, 0.006] scale 0.53; rider on the ram at [-0.017, -0.217, -0.328] scale 2 (see JSON mount) */],
'rune-splitter': [{ name: 'crystal-hammer', file: 'crystal-hammer.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-5.945, 14.395, 2.713], rot: [-90.58, 40.418, 154.032], scale: [31.285, 31.285, 31.285] } }],
'shieldbeard': [{ name: 'medic-pack', file: 'medic-pack.glb', bone: ['Spine02'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'Spine02', pos: [2.392, 13.129, -18.358], rot: [-154.103, -0.121, 171.756], scale: [25.761, 25.761, 25.761] } }],
```
