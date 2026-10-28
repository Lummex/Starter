# Round 27 – smaller body files (textures only)

Made by Ledger, Oct 28, 2026. Dwarves: Ken's OK "It's okay to shrink the dwarf". Gnomes: Ken's OK via Forge (~21:05, "shrink the gnome textures, but make sure it doesn't mess up the textures"); remade and checked by eye on Oct 28 evening (report `factory-design/studio/reports/2026-10-28-ledger-gnome-shrink.md`, side-by-side pictures in `../../../studio/reports/2026-10-28-ledger-gnome-shrink/`).

Each file is the game's current `public/models/creatures/<card>/char.glb` (factory/issue-8, git hash checked) with only its body picture(s) made smaller (Lanczos, same JPEG quality tables and 4:2:0 as the original, PNG stays PNG; the beetle's normal map is re-normalised after resizing). Geometry, UVs, bones, skin weights, clips and the glTF JSON (apart from byte offsets) are unchanged: every non-picture byte compared with the original, identical.

Builder: copy `<card>-char.glb` over `public/models/creatures/<card>/char.glb`. Copy the bytes as they are. How this fits Round 27: `../editor-setups-2026-10-28b.md`.

The first gnome set (all 13 at 512 px, Oct 28 morning) is kept in `_discontinued/gnome-bodies-oct28-first/` (not in use).

## Dwarves (15, all 1024 → 512 px)

| File | Old bytes | New bytes | Replaces public/models/creatures/ |
|---|---|---|---|
| axe-thrower-char.glb | 961,544 | 756,472 | axe-thrower/char.glb |
| barrelback-courier-char.glb | 926,008 | 729,988 | barrelback-courier/char.glb |
| brewmaster-char.glb | 902,916 | 710,212 | brewmaster/char.glb |
| crystal-drunk-delver-char.glb | 994,884 | 803,552 | crystal-drunk-delver/char.glb |
| deepforge-crossbowman-char.glb | 863,928 | 680,296 | deepforge-crossbowman/char.glb |
| dwarf-miner-char.glb | 941,100 | 728,780 | dwarf-miner/char.glb |
| dwarf-pickman-char.glb | 1,002,084 | 806,884 | dwarf-pickman/char.glb |
| dwarf-stoneback-char.glb | 941,036 | 731,260 | dwarf-stoneback/char.glb |
| grimhold-ravager-char.glb | 963,176 | 750,296 | grimhold-ravager/char.glb |
| ironhammer-berserker-char.glb | 968,716 | 773,704 | ironhammer-berserker/char.glb |
| oathbound-pikeman-char.glb | 967,356 | 771,532 | oathbound-pikeman/char.glb |
| queen-brunhilda-stonebeard-char.glb | 971,608 | 759,704 | queen-brunhilda-stonebeard/char.glb |
| ram-rider-char.glb | 956,372 | 763,072 | ram-rider/char.glb |
| rune-splitter-char.glb | 971,104 | 767,920 | rune-splitter/char.glb |
| shieldbeard-char.glb | 1,026,396 | 798,748 | shieldbeard/char.glb |
| **Dwarves total** | 14,358,228 | 11,332,420 | saves 3,025,808 |

## Gnomes (13; 10 at 512 px, 3 at 768 px because 512 px looked noticeably softer)

| File | Picture size | Old bytes | New bytes | Saves | Replaces public/models/creatures/ |
|---|---|---|---|---|---|
| clockwork-beetle-char.glb | 768 px (3 maps: colour, metal/rough, normal) | 3,242,480 | 2,092,496 | 1,149,984 | clockwork-beetle/char.glb |
| gearward-sentinel-char.glb | 512 px | 951,772 | 748,516 | 203,256 | gearward-sentinel/char.glb |
| glyphshield-warden-char.glb | 512 px | 1,019,184 | 788,848 | 230,336 | glyphshield-warden/char.glb |
| gnome-cogger-char.glb | 512 px | 1,053,268 | 810,336 | 242,932 | gnome-cogger/char.glb |
| gnome-illusionist-char.glb | 512 px | 889,316 | 681,684 | 207,632 | gnome-illusionist/char.glb |
| gnome-smith-miner-char.glb | 512 px | 950,228 | 736,668 | 213,560 | gnome-smith-miner/char.glb |
| gnome-tinker-char.glb | 768 px | 1,005,104 | 870,484 | 134,620 | gnome-tinker/char.glb |
| gnome-widget-char.glb | 512 px | 977,620 | 751,568 | 226,052 | gnome-widget/char.glb |
| hexwright-apprentice-char.glb | 512 px | 979,220 | 760,792 | 218,428 | hexwright-apprentice/char.glb |
| phase-stalker-char.glb | 512 px | 1,057,264 | 834,792 | 222,472 | phase-stalker/char.glb |
| runic-siphoner-char.glb | 512 px | 986,524 | 760,084 | 226,440 | runic-siphoner/char.glb |
| spark-gnome-char.glb | 512 px | 1,043,048 | 801,856 | 241,192 | spark-gnome/char.glb |
| the-great-steam-golem-char.glb | 768 px | 1,091,764 | 946,864 | 144,900 | the-great-steam-golem/char.glb |
| **Gnomes total** | | 15,246,792 | 11,584,988 | 3,661,804 | |

## Game size for Round 27 (Ledger, Oct 28 evening, measured)

Measured from the factory/issue-8 file list (all of `projects/oreheart-8/public/`, 1 MB = 1,000,000 bytes):

| Step | Bytes | MB |
|---|---|---|
| Game files now (Round 26 parts are in) | 93,580,935 | 93.58 |
| + 15 Round 27 parts (item A) | +4,808,392 | 98.39 |
| − 15 dwarf bodies | −3,025,808 | 95.36 |
| − 13 gnome bodies (this set) | −3,661,804 | 91.70 |
| + Clay's two rigged models (Anvilsworn Miner 2,603,600 + Borgo 2,384,088), if Ken approves them | +4,987,688 | **96.69** |

**Over 95 MB with both rigged models.** Without them: 91.70 MB. Section H (heights) adds no files. Ken needs to choose what else shrinks — options in the report. (My earlier "95.38 MB now" is out of date: today's game files measure 93.58 MB.)
