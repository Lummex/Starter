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

## Body textures 1024 → 512 px (Round 27, Ken OK Oct 28)

Ken OK'd shrinking body textures to stay under 95 MB ("It's okay to shrink the dwarf", Oct 28). **Builder: replace each `char.glb` below with the file from `factory-design/design/models/round27-shrunk/`** (copy it over, keep the name `char.glb`). Nothing else changes: same clips, bones, `models.json` and `events.json`.

- All 15 dwarf bodies were not enough (game would be ~97.2 MB), so **all 13 gnome bodies at 1024 px were shrunk too** (gyrocopter-ace is already 512 px since Round 26). Goblins are untouched.
- Only the pictures changed (1024 → 512 px, same format: JPEG stays JPEG at the same quality, clockwork-beetle's PNG stays PNG). Geometry, UVs, bones, skin weights and animation clips are byte-identical to the game's current `char.glb` (every non-picture byte range and every accessor compared).
- Every original was first checked to be byte-identical to factory/issue-8 (git hash), so these are the game's own models, not older ones.
- The Studio's Model Editor keeps its full 1024 px bodies for editing; the look numbers do not change (textures don't move anything).

| File (in `round27-shrunk/`) | Faction | Old bytes | New bytes | Replaces `public/models/creatures/` |
|---|---|---|---|---|
| axe-thrower-char.glb | dwarves | 961,544 | 756,472 | axe-thrower/char.glb |
| barrelback-courier-char.glb | dwarves | 926,008 | 729,988 | barrelback-courier/char.glb |
| brewmaster-char.glb | dwarves | 902,916 | 710,212 | brewmaster/char.glb |
| crystal-drunk-delver-char.glb | dwarves | 994,884 | 803,552 | crystal-drunk-delver/char.glb |
| deepforge-crossbowman-char.glb | dwarves | 863,928 | 680,296 | deepforge-crossbowman/char.glb |
| dwarf-miner-char.glb | dwarves | 941,100 | 728,780 | dwarf-miner/char.glb |
| dwarf-pickman-char.glb | dwarves | 1,002,084 | 806,884 | dwarf-pickman/char.glb |
| dwarf-stoneback-char.glb | dwarves | 941,036 | 731,260 | dwarf-stoneback/char.glb |
| grimhold-ravager-char.glb | dwarves | 963,176 | 750,296 | grimhold-ravager/char.glb |
| ironhammer-berserker-char.glb | dwarves | 968,716 | 773,704 | ironhammer-berserker/char.glb |
| oathbound-pikeman-char.glb | dwarves | 967,356 | 771,532 | oathbound-pikeman/char.glb |
| queen-brunhilda-stonebeard-char.glb | dwarves | 971,608 | 759,704 | queen-brunhilda-stonebeard/char.glb |
| ram-rider-char.glb | dwarves | 956,372 | 763,072 | ram-rider/char.glb |
| rune-splitter-char.glb | dwarves | 971,104 | 767,920 | rune-splitter/char.glb |
| shieldbeard-char.glb | dwarves | 1,026,396 | 798,748 | shieldbeard/char.glb |
| clockwork-beetle-char.glb | gnomes | 3,242,480 | 1,230,460 | clockwork-beetle/char.glb |
| gearward-sentinel-char.glb | gnomes | 951,772 | 748,524 | gearward-sentinel/char.glb |
| glyphshield-warden-char.glb | gnomes | 1,019,184 | 788,848 | glyphshield-warden/char.glb |
| gnome-cogger-char.glb | gnomes | 1,053,268 | 810,340 | gnome-cogger/char.glb |
| gnome-illusionist-char.glb | gnomes | 889,316 | 681,684 | gnome-illusionist/char.glb |
| gnome-smith-miner-char.glb | gnomes | 950,228 | 736,676 | gnome-smith-miner/char.glb |
| gnome-tinker-char.glb | gnomes | 1,005,104 | 767,712 | gnome-tinker/char.glb |
| gnome-widget-char.glb | gnomes | 977,620 | 751,572 | gnome-widget/char.glb |
| hexwright-apprentice-char.glb | gnomes | 979,220 | 760,804 | hexwright-apprentice/char.glb |
| phase-stalker-char.glb | gnomes | 1,057,264 | 834,800 | phase-stalker/char.glb |
| runic-siphoner-char.glb | gnomes | 986,524 | 760,092 | runic-siphoner/char.glb |
| spark-gnome-char.glb | gnomes | 1,043,048 | 801,860 | spark-gnome/char.glb |
| the-great-steam-golem-char.glb | gnomes | 1,091,764 | 834,352 | the-great-steam-golem/char.glb |
| **Total (28 bodies)** | | **29,605,020** | **21,840,144** | saves **7,764,876** |

## SIZE (Ken OK'd the body shrink, Oct 28)

Measured from the factory/issue-8 file list (all of `projects/oreheart-8/public/`, 1 MB = 1,000,000 bytes):
- Game now (Round 26 is in): **95.38 MB**. (My earlier "about 94.9 MB" was too low; the real number is 95.38.)
- + the 15 new parts above (+4.81 MB) → **100.19 MB** without shrinking – that would have been over 100 MB.
- − 15 dwarf bodies at 512 px (−3.03 MB) → 97.17 MB (not enough).
- − 13 gnome bodies at 512 px (−4.74 MB) → **92.43 MB after Round 27**. Under 95 MB with about 2.6 MB to spare.

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
