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

## Goblins (12; 8 at 512 px, 4 at 768 px because 512 px looked noticeably softer)

Ken's OK via Forge (Oct 28 ~22:00): "shrink the 12 goblin bodies still at 1024 px to 512 px, the same careful way as the gnomes; any that look noticeably worse go to 768 px". Checked side by side in three.js (front, face and body close-ups, idle t=0): junk-shaman (busy trinket/skull detail and face), skullbasher-rusher and blastrat-sapper (skull emblems), wolf-rider (face seams, badge) looked noticeably softer at 512 → 768. Started from the game's own files (git hash checked; blastrat-sapper, shard-guzzler, wolf-rider and the troll are the game's older files, not the Studio's v2).

| File | Picture size | Old bytes | New bytes | Saves | Replaces public/models/creatures/ |
|---|---|---|---|---|---|
| goblin-bomber-char.glb | 512 px | 1,750,232 | 1,555,396 | 194,836 | goblin-bomber/char.glb |
| goblin-grunt-char.glb | 512 px | 1,771,464 | 1,561,272 | 210,192 | goblin-grunt/char.glb |
| goblin-scrapper-char.glb | 512 px | 1,758,032 | 1,571,184 | 186,848 | goblin-scrapper/char.glb |
| goblin-slinger-char.glb | 512 px | 1,820,844 | 1,579,920 | 240,924 | goblin-slinger/char.glb |
| goblin-sneak-char.glb | 512 px | 1,734,596 | 1,543,196 | 191,400 | goblin-sneak/char.glb |
| rotgut-grenadier-char.glb | 512 px | 1,753,248 | 1,535,232 | 218,016 | rotgut-grenadier/char.glb |
| shard-guzzler-char.glb | 512 px | 1,167,172 | 951,664 | 215,508 | shard-guzzler/char.glb |
| grubnaks-big-boss-troll-char.glb | 512 px | 1,160,960 | 949,984 | 210,976 | grubnaks-big-boss-troll/char.glb |
| junk-shaman-char.glb | 768 px | 2,012,352 | 1,868,860 | 143,492 | junk-shaman/char.glb |
| skullbasher-rusher-char.glb | 768 px | 1,672,568 | 1,573,348 | 99,220 | skullbasher-rusher/char.glb |
| blastrat-sapper-char.glb | 768 px | 1,207,472 | 1,090,932 | 116,540 | blastrat-sapper/char.glb |
| wolf-rider-char.glb | 768 px | 1,263,280 | 1,136,908 | 126,372 | wolf-rider/char.glb |
| **Goblins total** | | 19,072,220 | 16,917,896 | 2,154,324 | |

## Crystal node (mines)

Ken's OK via Forge (~22:00): "also do your option b, the crystal node maps, if needed" (needed). Colour, metal/rough and normal map 1024 → 512 px (normal map re-normalised). The fine crack lines are a little softer; no seams or colour change.

| File | Old bytes | New bytes | Saves | Replaces public/ |
|---|---|---|---|---|
| mines-crystal-node.glb | 1,740,316 | 1,284,372 | 455,944 | models/mines/crystal-node.glb |

## Option A: 4 more goblin files (decision `r27-size-option-a` = Yes, Oct 29)

Decided Yes (Forge, Oct 29; Ken: non-visual calls are Forge's). Checked by eye in three.js, original and new side by side (front and close-ups, idle t=0). Pictures: `../../../studio/reports/2026-10-29-ledger-r27-option-a/`.

- Shiv Rat, Goblin Miner (scrounger) and Scrapsmith Miner (goblin-smith-miner): 768 → 512 px. They look the same.
- **Grubnak's throne:** only the normal map and the metal/rough map go 768 → 512 px. **The colour map stays 768 px**, because at 512 the skull banners were blurry even at full view. Its colour picture, geometry and glTF JSON (apart from byte offsets) are byte-for-byte the original.
- **Boneknocker (goblin-pebbler) is NOT shrunk.** The skull on its hood looked noticeably softer at 512, so it keeps the game's current file (Ken's goblin rule: noticeably worse stays 768).

| File | Picture size | Old bytes | New bytes | Saves | Replaces public/models/creatures/ |
|---|---|---|---|---|---|
| shiv-rat-char.glb | 512 px | 1,406,596 | 1,334,164 | 72,432 | shiv-rat/char.glb |
| goblin-scrounger-char.glb | 512 px | 899,600 | 816,096 | 83,504 | goblin-scrounger/char.glb |
| goblin-smith-miner-char.glb | 512 px | 852,472 | 780,612 | 71,860 | goblin-smith-miner/char.glb |
| grubnak-throne.glb | colour 768 px; normal + metal/rough 512 px | 1,138,204 | 909,944 | 228,260 | grubnak/throne.glb |
| **Total** | | 4,296,872 | 3,840,816 | 456,056 | |

The folder `option-a-needs-ken/` is **not used** (superseded: it holds the all-512 throne and Boneknocker). Builder: don't copy anything from it.

## Game size for Round 27 (Ledger, Oct 29, measured after Round 26)

Measured from the factory/issue-8 file list at commit `dc569cf464c9102294776993a2b110b77d06db00` (all of `projects/oreheart-8/public/`, 1 MB = 1,000,000 bytes). All 46 files this folder replaces still have the "Old bytes" sizes listed above.

| Step | Bytes | MB |
|---|---|---|
| Game files now (after Round 26) | 93,596,499 | 93.60 |
| + 15 Round 27 parts (item A) | +4,808,392 | 98.40 |
| − 15 dwarf bodies | −3,025,808 | 95.38 |
| − 13 gnome bodies | −3,661,804 | 91.72 |
| + Clay's two rigged models (Anvilsworn Miner 2,603,600 + Borgo 2,384,088) | +4,987,688 | 96.70 |
| − 12 goblin bodies | −2,154,324 | 94.55 |
| + Miner's pickaxe 497,300 + Borgo's sceptre 576,524 (parts/, 256 px) | +1,073,824 | 95.62 |
| − crystal node maps | −455,944 | 95.17 |
| − option A (4 files above) | −456,056 | **94.71** |

**Round 27 total: 94,712,467 bytes = 94.71 MB, under 95 (0.29 MB to spare).** Owner fixes added to factory/issue-8 after `dc569cf` count on top of this.
