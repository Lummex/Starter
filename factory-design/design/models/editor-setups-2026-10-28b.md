# Studio setups for the game – second batch (Oct 28, 2026, for Round 27)

Made by Ledger from Ken's saved default looks in **Oreheart Studio** (Model Editor room; database `library`, field `setup`), saved Oct 28 between 04:49 and 05:38 UTC.
Data file: `editor-setups-2026-10-28b.json` (same folder). New accessory files: `parts/`. Smaller body files (textures only): `round27-shrunk/` (see "Body textures" below).
The first file (`editor-setups-2026-10-28.json`) is used by Round 26 and is unchanged.

18 cards: axe-thrower, barrelback-courier, brewmaster, cmd-grubnak, crystal-drunk-delver, deepforge-crossbowman, dwarf-miner, dwarf-pickman, dwarf-stoneback, goblin-scrapper, grimhold-ravager, ironhammer-berserker, junk-shaman, oathbound-pikeman, queen-brunhilda-stonebeard, ram-rider, rune-splitter, shieldbeard. (No other card has a new setup today.)

## How to read the numbers

Same rules as the first file:
- **Everything is local to a bone of the raw GLB.** Load the character GLB as-is, find the bone by name, `bone.add(part)` with the raw `scene` of the accessory GLB (no re-centring). The game already does this for `PARTS` entries that have a `look` (creature3d.ts).
- **position** = bone-local units (Meshy rig under `Armature` at scale 0.01, so 20 or 30 is normal). **rotationDeg** = degrees, Euler **XYZ**. **scale** per axis = size × stretch (`partsTableLook.scale` already multiplied out).
- Parts were placed on the **rest pose**; during clips they follow the bone.
- `model.sameFileAsGame: true` = the game's `char.glb` is byte-identical to the Studio's model (checked by git hash). **True for all 18.**
- `height` (per card) is the Studio size. **Heights are binding since Ken's Oct 28 evening rule**: the exact game numbers are in "Heights from Ken's Studio setups" at the end of this file. `mainPlacement` = small offsets/tilts of the body in the Studio; the game stands figures on the ground and centres them, so these are not used.
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

## Body textures (Round 27, Ken OK Oct 28)

Ken OK'd shrinking body pictures to stay under 95 MB: dwarves ("It's okay to shrink the dwarf"), gnomes (~21:05, "make sure it doesn't mess up the textures"), goblins (~22:00 via Forge: 512 px, 768 px where 512 looks noticeably worse) and the crystal node maps (~22:00). **Builder: copy each file from `round27-shrunk/` over the game file** (keep the name `char.glb`). Full table with bytes: `round27-shrunk/README.md`.

- 512 px: 15 dwarves, 10 gnomes, 8 goblins (goblin-bomber, goblin-grunt, goblin-scrapper, goblin-slinger, goblin-sneak, rotgut-grenadier, shard-guzzler, grubnaks-big-boss-troll).
- 768 px (512 looked noticeably softer in side-by-side close-ups): clockwork-beetle, the-great-steam-golem, gnome-tinker, junk-shaman, skullbasher-rusher, blastrat-sapper, wolf-rider.
- Crystal node: `round27-shrunk/mines-crystal-node.glb` → `public/models/mines/crystal-node.glb` (3 maps 1024 → 512 px).
- Option A (decision `r27-size-option-a` = Yes, Oct 29): `round27-shrunk/` shiv-rat, goblin-scrounger and goblin-smith-miner bodies (768 → 512 px), plus `grubnak-throne.glb` → `public/models/creatures/grubnak/throne.glb` (normal + metal/rough maps 512 px, **colour map stays 768**). **Boneknocker (goblin-pebbler) is not shrunk.** Don't use the old `option-a-needs-ken/` folder.
- Only the pictures changed (Lanczos, the original's JPEG quality tables and 4:2:0, PNG stays PNG, normal maps re-normalised). Geometry, UVs, bones, skin weights, clips and the glTF JSON (apart from byte offsets) are byte-identical to the game's files; every original was checked against factory/issue-8 by git hash first.
- The Studio's Model Editor keeps its full-size bodies for editing; the look numbers do not change (textures don't move anything).

## SIZE (measured Oct 29, after Round 26)

Measured Oct 29 after Round 26, at factory/issue-8 commit `dc569cf` (all of `projects/oreheart-8/public/`, 1 MB = 1,000,000 bytes): game now **93.60 MB**; + 15 parts 98.40; − 15 dwarf bodies 95.38; − 13 gnome bodies 91.72; + 2 rigged models 96.70; − 12 goblin bodies 94.55; + pickaxe + sceptre 95.62; − crystal node maps 95.17; − option A (4 files) **94.71 MB**. Full table: `round27-shrunk/README.md`. (This replaces the Oct 28 numbers.)

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

## Rigged models (Round 27; Ken, Oct 28: put both rigged models in)

Clay's rigged Anvilsworn Miner and Thane Borgo Gravelgrim (Meshy, 24 bones). Ken wants both in Round 27; Studio `library/<card>.src` = `anvilsworn-miner-rig-oct28` / `borgo-rig-oct28` (same bytes as the files on main). **Their setups were made by Forge/Ledger** (Oct 28 ~22:25 UTC, saved with the Model Editor's "Save as default look") from Ken's other setups and the card art; **Ken still has to check them** (`characters/<card>.steps.editor` = waiting). If Ken changes them, these numbers are updated.

| Card | Body (file → game) | Studio body scale | Item | Bone | position | rotationDeg (XYZ) | scale |
|---|---|---|---|---|---|---|---|
| dwarf-smith-miner (Anvilsworn Miner) | `anvilsworn-miner-rig-oct28.glb` → `dwarf-smith-miner/char.glb` | 1 | Pickaxe (`stonebreaker-pickaxe`, `parts/stonebreaker-pickaxe.glb` → `dwarf-smith-miner/pickaxe.glb`) | RightHand | [-6.164, 15.149, 10.053] | [-66.649, 52.929, 128.399] | 38 |
| cmd-borgo (Thane Borgo Gravelgrim) | `borgo-rig-oct28.glb` → `cmd-borgo/char.glb` | 1 | Gear sceptre (`borgo-sceptre`, `parts/borgo-sceptre.glb` → `cmd-borgo/sceptre.glb`) | LeftHand | [-2.502, -5.086, 3.574] | [8.993, 35.932, 157.604] | 50 |

- How they were made: body scale 1 like all of Ken's dwarves (1.0 squares; open decision `dwarf-heights`). The Miner holds the pickaxe the way Ken's Gemdrunk Deepdelver holds his (same angle to the body, grip moved onto the hand); the card art shows only a pickaxe, so the Stonebreaker hammer is not used. Borgo holds the sceptre upright in his **left** hand as in his card art, foot on the ground. **No throne** for Borgo: Ken's commander setup (Grubnak) doesn't use one.
- Parts: the Studio's own GLBs with textures 512 → 256 px (like the other parts); geometry and all other bytes identical. pickaxe 660,548 → 497,300 bytes, sceptre 754,452 → 576,524.
- Clips: Idle, Casual_Walk, Heavy_Hammer_Swing, Hit_Reaction, Dead (+ Charged_Axe_Chop on the Miner).
- Heights: idle-0 raw heights 0.9432 (Miner) and 1.0005 (Borgo) → `LOOKS.height` 0.943 and 1.001 (scale 1). Studio standing height 1.0 for both (setupSummary: Miner 1.02 tall with the pickaxe, Borgo 1.00).

```ts
'dwarf-smith-miner': [{ name: 'pickaxe', file: 'pickaxe.glb', bone: ['RightHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'RightHand', pos: [-6.164, 15.149, 10.053], rot: [-66.649, 52.929, 128.399], scale: [38, 38, 38] } }],
'cmd-borgo': [{ name: 'sceptre', file: 'sceptre.glb', bone: ['LeftHand'], len: 0.4, grip: 0.5, rot: [0, 0, 0], look: { bone: 'LeftHand', pos: [-2.502, -5.086, 3.574], rot: [8.993, 35.932, 157.604], scale: [50, 50, 50] } }],
```

## Heights from Ken's Studio setups (binding, Ken Oct 28 evening)

**Ken, Oct 28: heights DO matter now.** The game must match Ken's Studio setups for height and scale too. This replaces "height is information only" above. The data is in the JSON under **`heightsForGame`** (one entry per character with a saved Studio setup — 47 characters, read from Oreheart Studio `library/<card>.setup` on Oct 28 at 18:10 UTC).

### How the numbers work
- In the Studio, 1 unit = 1 board square (the Studio's grid square), and the game board uses the same unit (one square = 1 world unit). Ken's body **scale** (× stretch) multiplies the raw model.
- The game sizes a unit in `makeCreature3d` (creature3d.ts): it measures the body in **its idle clip at time 0** and scales it so that height = `LOOKS[id].height` (× `stretch[1]`).
- So the exact game number is **`LOOKS.height = Studio body scale × the model's idle-0 height`** (raw GLB units). With that, the game draws the body at exactly Ken's Studio scale. This is why some LOOKS heights differ a little from the Studio's standing height (e.g. Marksmen Gunner: Studio 1.000 standing, idle pose is 4.5% taller → LOOKS 1.045). Same body size, different pose.
- Measured on the real files: Studio models (Artifact files) for the setup, and the game's `char.glb` on factory/issue-8 for the idle clip. 39 bodies are byte-identical (git hash); the Gyronaut's game body is the Studio v4 with shrunk textures (same geometry). For 4 older game bodies the idle height was measured on the game file itself (marked †). Checked twice: my own decoder and three.js 0.170 (the game's version, `skinBox` exactly as the game does it) gave the same numbers to 4 decimals.
- Accessories: every accessory placement in this file and in the Round 26 file (`editor-setups-2026-10-28.json`) was re-checked against the Studio tonight: **all the same** (bone, position, rotation, scale). Ken's 17:36–17:46 UTC re-saves changed only body sizes.

### Table (squares; "today" = what the game uses now)

| Card | Studio body scale | Studio standing height | Game today | **LOOKS.height** | stretch | Round 27 |
|---|---|---|---|---|---|---|
| axe-thrower (Grudge Hurler) | 1 | 1 | 0.95 | **0.977** |  | yes |
| barrelback-courier (Barrelback Courier) | 1 | 1 | 0.95 | **1.006** |  | yes |
| blastrat-sapper (SewerSlide Bomber) | 0.55 | 0.55 | 1.1 | **0.558** † |  | yes (the game body is an older file than the Studio one: same body scale, LOOKS measured on the game file) |
| brewmaster (Corpsman Brewlord) | 1 | 1 | 0.95 | **0.988** |  | yes |
| clockwork-beetle (Iron Scarab Automaton) | 0.48 | 0.706 | 0.9 | **0.706** |  | yes |
| cmd-grubnak (Grubnak Rotgut Goblin King) | 1.22 | 1.83 | 1.1 | **—** |  | yes: commander, grubnak3d.ts body scale ck = 1.22 (no LOOKS entry); throne unchanged |
| crystal-drunk-delver (Gemdrunk Deepdelver) | 1 | 1 | 0.95 | **0.957** |  | yes |
| deepforge-crossbowman (Marksmen Gunner) | 1 | 1 | 0.95 | **1.045** |  | yes |
| dwarf-miner (Riot Shield Bearer) | 1 | 1 | 0.95 | **1.058** |  | yes |
| dwarf-pickman (Ironjaw Big Back) | 1 | 1 | 0.95 | **0.95** |  | yes |
| dwarf-stoneback (Granite Oathkeeper) | 1 | 1 | 0.95 | **1.001** |  | yes |
| dwarf-smith-miner (Anvilsworn Miner, rigged Oct 28) | 1 | 1 | — (not in the game yet) | **0.943** | | yes (R): setup by Forge/Ledger, waiting for Ken's check |
| cmd-borgo (Thane Borgo Gravelgrim, rigged Oct 28) | 1 | 1 | — (not in the game yet) | **1.001** | | yes (R): commander, setup by Forge/Ledger, waiting for Ken's check |
| gearward-sentinel (Gearward Sentinel) | 0.318 | 0.318 | 0.85 | **0.322** |  | yes |
| glyphshield-warden (Glyphshield Warden) | 0.38 | 0.38 | 0.85 | **0.38** |  | yes |
| gnome-cogger (Voldawright) | 0.25 | 0.25 | 0.85 | **0.261** |  | yes |
| gnome-illusionist (Mirrorveil Illusionist) | 0.32 | 0.32 | 0.85 | **0.313** |  | yes |
| gnome-prospector (Gemsinger Miner) | 0.499 | 0.848 | 0.85 | **—** |  | no: not in the game |
| gnome-smith-miner (Arcsmith Miner) | 0.44 | 0.836 | 0.85 | **—** |  | no: NEEDS KEN, the saved setup holds a different model (static gemsinger-miner in the hand of gemsinger-anim at scale 0.22), not the game body |
| gnome-tinker (Aegis Tinkerer) | 0.4 | 0.4 | 0.85 | **0.407** |  | yes |
| gnome-widget (Brawler Adept) | 0.45 | 0.45 | 0.85 | **0.456** |  | yes |
| goblin-bomber (Bare Knuckle Lunatic) | 0.48 | 0.48 | 0.97 | **0.468** |  | yes |
| goblin-grunt (Snotskull Grunt) | 0.41 | 0.41 | 1.1 | **0.412** |  | yes |
| goblin-pebbler (Boneknocker) | 0.41 | 0.41 | 1.011 | **0.397** |  | yes |
| goblin-scrapper (Bowler Brawler) | 0.53 | 0.493 | 1.188 | **0.525** | [1, 0.93, 1] | yes |
| goblin-scrounger (Goblin Miner) | 0.46 | 0.46 | 1.1 | **0.451** |  | yes |
| goblin-slinger (Skullflinger) | 0.46 | 0.46 | 1.1 | **0.465** |  | yes |
| goblin-smith-miner (Scrapsmith Miner) | 0.38 | 0.38 | 1.1 | **0.366** † |  | yes (the game body is an older file than the Studio one: same body scale, LOOKS measured on the game file) |
| goblin-sneak (Backstabbing Thief) | 0.46 | 0.46 | 0.982 | **0.463** |  | yes |
| grimhold-ravager (Grimhold Ravager) | 1 | 1 | 0.95 | **0.989** |  | yes |
| grubnaks-big-boss-troll (Troll Tyrant) | 1 | 1.6 | 1.4 | **1.568** † |  | yes (the game body is an older file than the Studio one: same body scale, LOOKS measured on the game file) |
| gyrocopter-ace (Thunderwing Gyronaut) | 0.29 | 0.29 | 0.85 | **0.303** |  | yes |
| hexwright-apprentice (Hexslinger Apprentice) | 0.38 | 0.38 | 0.85 | **0.384** |  | yes |
| ironhammer-berserker (Bloodbeard Berserker) | 1 | 1 | 0.95 | **1.036** |  | yes |
| junk-shaman (Junk Shaman) | 0.44 | 0.44 | 1.1 | **0.472** |  | yes |
| oathbound-pikeman (Oathbound Overwatch) | 1 | 1 | 0.95 | **1.005** |  | yes |
| phase-stalker (Gnome Plow) | 0.4774 | 0.477 | 0.85 | **0.499** |  | yes (height only); in the Studio he rides a plow, which is not in the game yet |
| queen-brunhilda-stonebeard (Queen Brunhilda) | 1 | 1 | 1.05 | **0.991** |  | yes |
| ram-rider (Thunderhorn Ram Rider) | 1.06 | 1.06 | 1.35 | **—** |  | yes: mount (brief B + H): ram + rider 1:1 in Studio units, no extra group scale |
| rotgut-grenadier (Goblin Chef) | 0.53 | 0.53 | 1.219 | **0.532** |  | yes |
| rune-splitter (Door Splitter) | 1 | 1 | 0.95 | **0.993** |  | yes |
| runic-siphoner (Soul Stone Siphoner) | 0.3 | 0.3 | 0.85 | **0.3** |  | yes |
| shard-guzzler (Goblin Rocket Rider) | 0.54 | 0.54 | 1.1 | **0.54** † |  | yes (the game body is an older file than the Studio one: same body scale, LOOKS measured on the game file) |
| shieldbeard (Ironwall Shieldbeard) | 1 | 1 | 0.95 | **0.977** |  | yes |
| shiv-rat (Shiv Rat) | 0.39 | 0.351 | 1.1 | **0.355** |  | yes |
| skullbasher-rusher (Skullbasher Rusher) | 0.44 | 0.44 | 1.1 | **0.446** |  | yes |
| spark-gnome (Stormcaller Savant) | 0.31 | 0.31 | 0.85 | **0.317** |  | yes |
| the-great-steam-golem (The Arcane Colossus) | 1.19 | 1.904 | 1.6 | **2.112** |  | yes |
| wolf-rider (Mangewolf Rider) | 0.4743 | 0.474 | 1.35 | **—** |  | no: mount (Studio wolf scale 0.56 + rider 0.847 on it); the game wolf and rider files differ from the Studio ones |

† game body is an older file than the Studio's (same body scale applied to the game file).

### Paste-ready `LOOKS` (creature3d.ts) — replaces the whole `LOOKS` object
```ts
export const LOOKS: Record<string, { height: number; stretch: [number, number, number] }> = {
  'axe-thrower': { height: 0.977, stretch: [1, 1, 1] },
  'barrelback-courier': { height: 1.006, stretch: [1, 1, 1] },
  'blastrat-sapper': { height: 0.558, stretch: [1, 1, 1] },
  'brewmaster': { height: 0.988, stretch: [1, 1, 1] },
  'clockwork-beetle': { height: 0.706, stretch: [1, 1, 1] },
  'crystal-drunk-delver': { height: 0.957, stretch: [1, 1, 1] },
  'deepforge-crossbowman': { height: 1.045, stretch: [1, 1, 1] },
  'dwarf-miner': { height: 1.058, stretch: [1, 1, 1] },
  'dwarf-pickman': { height: 0.95, stretch: [1, 1, 1] },
  'dwarf-stoneback': { height: 1.001, stretch: [1, 1, 1] },
'dwarf-smith-miner': { height: 0.943, stretch: [1, 1, 1] },
'cmd-borgo': { height: 1.001, stretch: [1, 1, 1] },
  'gearward-sentinel': { height: 0.322, stretch: [1, 1, 1] },
  'glyphshield-warden': { height: 0.38, stretch: [1, 1, 1] },
  'gnome-cogger': { height: 0.261, stretch: [1, 1, 1] },
  'gnome-illusionist': { height: 0.313, stretch: [1, 1, 1] },
  'gnome-tinker': { height: 0.407, stretch: [1, 1, 1] },
  'gnome-widget': { height: 0.456, stretch: [1, 1, 1] },
  'goblin-bomber': { height: 0.468, stretch: [1, 1, 1] },
  'goblin-grunt': { height: 0.412, stretch: [1, 1, 1] },
  'goblin-pebbler': { height: 0.397, stretch: [1, 1, 1] },
  'goblin-scrapper': { height: 0.525, stretch: [1, 0.93, 1] },
  'goblin-scrounger': { height: 0.451, stretch: [1, 1, 1] },
  'goblin-slinger': { height: 0.465, stretch: [1, 1, 1] },
  'goblin-smith-miner': { height: 0.366, stretch: [1, 1, 1] },
  'goblin-sneak': { height: 0.463, stretch: [1, 1, 1] },
  'grimhold-ravager': { height: 0.989, stretch: [1, 1, 1] },
  'grubnaks-big-boss-troll': { height: 1.568, stretch: [1, 1, 1] },
  'gyrocopter-ace': { height: 0.303, stretch: [1, 1, 1] },
  'hexwright-apprentice': { height: 0.384, stretch: [1, 1, 1] },
  'ironhammer-berserker': { height: 1.036, stretch: [1, 1, 1] },
  'junk-shaman': { height: 0.472, stretch: [1, 1, 1] },
  'oathbound-pikeman': { height: 1.005, stretch: [1, 1, 1] },
  'phase-stalker': { height: 0.499, stretch: [1, 1, 1] },
  'queen-brunhilda-stonebeard': { height: 0.991, stretch: [1, 1, 1] },
  'rotgut-grenadier': { height: 0.532, stretch: [1, 1, 1] },
  'rune-splitter': { height: 0.993, stretch: [1, 1, 1] },
  'runic-siphoner': { height: 0.3, stretch: [1, 1, 1] },
  'shard-guzzler': { height: 0.54, stretch: [1, 1, 1] },
  'shieldbeard': { height: 0.977, stretch: [1, 1, 1] },
  'shiv-rat': { height: 0.355, stretch: [1, 1, 1] },
  'skullbasher-rusher': { height: 0.446, stretch: [1, 1, 1] },
  'spark-gnome': { height: 0.317, stretch: [1, 1, 1] },
  'the-great-steam-golem': { height: 2.112, stretch: [1, 1, 1] },
};
```
Cards not in this list keep `DEFAULT_H` (they have no Studio setup yet).

### Special cases
- **Grubnak (cmd-grubnak, commander):** grubnak3d.ts sizes him from the throne (`ck = SEAT.k × throne height / idle height`). Ken's Studio body scale is **1.22** (standing height 1.83 squares). Set `ck = 1.22` (the raw GLB times 1.22, same as the Studio). Keep the throne size as it is now (the throne is not in Ken's setup).
- **Thunderhorn Ram Rider (ram-rider):** mount. Build the ram + rider group **1:1 in Studio units, with no extra group scale**: ram at `[0.011, 0.473, 0.006]`, rot `[0,0,0]`, scale `0.53`; rider child of the ram at `[-0.017, -0.217, -0.328]`, rot `[0,0,0]`, scale `2` (rider world scale 1.06). Then lift the whole group so its lowest point is on the board. Studio group height **1.376 squares**. The mount code must not use `DEFAULT_H` for it any more.
- **Mangewolf Rider (wolf-rider):** mount in the Studio (wolf scale 0.56, rider 0.847 on the wolf, mace on RightShoulder). The game's rider and wolf files are not the Studio's files, so **not in Round 27** (needs the Studio files in the game first).
- **Gnome Plow (phase-stalker):** in the Studio he rides a **plow** (plow world scale 0.45; he sits on it at scale 1.061 → body scale 0.477). The plow is not in the game. Round 27 sets only his height (0.499). The plow needs its own job (part file + mount, size check).
- **Arcsmith Miner (gnome-smith-miner):** the Studio setup's main model is the static `gemsinger-miner` held in the hand of the animated `gemsinger-anim` (scale 0.22), not the game's body. No usable height → **needs Ken** (re-save his look on the right model).
- **gnome-prospector:** not in the game; listed for completeness.
- **Floating in the Studio:** Gearward Sentinel's feet are 0.38 above the floor, Goblin Rocket Rider 0.62 (fly on, hover 0), Iron Scarab −0.08. The game stands figures on the board; not changed in Round 27 (Ken's call).
- **Hover:** the Gyronaut's Studio setup has hover **off**; the game hovers him by default (0.35). Not changed in Round 27 – ask Ken.
- **Dwarves are all 1.0 tall in the Studio** (saved 04:56–05:38 UTC, before the evening re-sizing of goblins and gnomes). Asked Ken in the Studio: `decisions/dwarf-heights`. Builder: if Ken answered "resize", leave dwarf heights as they are and wait for Ledger's new numbers.

### Accessories in Studio setups that the game does not place with Ken's numbers yet (later round; not in Round 27)
Bone-local, rest pose, degrees XYZ; scale per axis = size × stretch.

- glyphshield-warden: **Shield** (`glyphshield-warden-shield-oct25`) → `{ bone: 'LeftForeArm', pos: [-0.289, 25.921, 0.524], rot: [-114.616, -54.523, 103.055], scale: [28.912, 28.912, 28.912] }`
- gnome-cogger: **Mace** (`gnome-cogger-mace-oct25`) → `{ bone: 'RightHand', pos: [-16.476, -10.052, 6.626], rot: [-106.963, -35.01, 84.605], scale: [32.833, 32.833, 32.833] }`
- gnome-illusionist: **scepter** (`gnome-tinker-scepter-oct25`) → `{ bone: 'RightHand', pos: [-4.622, 8.047, -4.596], rot: [101.222, 26.475, 166.891], scale: [33.62, 54.12, 35.26] }`
- hexwright-apprentice: **Staff** (`hexwright-apprentice-staff-oct25`) → `{ bone: 'RightHand', pos: [-8.889, 11.139, 14.226], rot: [-153.173, -64.937, 132.76], scale: [52.968, 52.968, 52.968] }`
- runic-siphoner: **Staff** (`runic-siphoner-staff-oct25`) → `{ bone: 'RightHand', pos: [-5.934, 11.383, -0.229], rot: [67.927, -40.258, -143.624], scale: [20, 41.4, 20] }`
- spark-gnome: **Staff** (`spark-gnome-staff-oct25`) → `{ bone: 'RightHand', pos: [-2.63, 8.57, 0.056], rot: [-128.277, -22.025, 141.36], scale: [41, 51.25, 41] }`
- goblin-smith-miner: **backpack** (`goblin-smith-miner-v2-backpack`) → `{ bone: 'Spine', pos: [-0.433, -3.961, -21.861], rot: [-171.766, -1.658, 178.565], scale: [27, 27, 27] }`
- goblin-smith-miner: **pickaxe** (`goblin-smith-miner-v2-pickaxe`) → `{ bone: 'RightHand', pos: [-6.511, 12.749, 3.197], rot: [-40.737, 34.712, 127.272], scale: [31, 31, 31] }`
- goblin-scrounger: **Backpack** (`goblin-scrounger-backpack`) → `{ bone: 'neck', pos: [0, -5.255, -19.583], rot: [10.936, 0, 0], scale: [30, 30, 30] }`
- goblin-scrounger: **Pickaxe** (`goblin-scrounger-pickaxe`) → `{ bone: 'RightHand', pos: [-3.465, 13.904, 6.753], rot: [149.353, -82.984, 76.943], scale: [24, 24, 24] }`
- blastrat-sapper: **bomb** (`blastrat-sapper-v2-bomb`) → `{ bone: 'Head', pos: [-3.251, 61.74, -14.749], rot: [-3.792, -15.043, 3.072], scale: [51, 51, 51] }`
- shard-guzzler: **rocket** (`shard-guzzler-v2-rocket`) → `{ bone: 'Hips', pos: [1.993, -21.521, 10.023], rot: [-155.921, 76.047, 114.401], scale: [66.355, 55.487, 55.487] }`
- wolf-rider: **mace** (`wolf-rider-v2-mace`) → `{ bone: 'RightShoulder', pos: [23.684, 7.312, 11.167], rot: [27.902, -67.31, -110.12], scale: [61, 61, 61] }`
