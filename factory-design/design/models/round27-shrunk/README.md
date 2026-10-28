# Round 27 – smaller body files (textures only)

Made by Ledger, Oct 28, 2026 (job from Forge, Ken OK'd: "It's okay to shrink the dwarf").
Each file is the game's current `public/models/creatures/<card>/char.glb` (factory/issue-8, git hash checked) with its body picture shrunk from 1024 to 512 px. Geometry, UVs, bones, skin weights and clips are unchanged (every accessor and every non-picture byte compared with the original: identical).

Builder: copy `<card>-char.glb` over `public/models/creatures/<card>/char.glb`. How this fits Round 27: `../editor-setups-2026-10-28b.md`.

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

## Game size (Ken OK'd the body shrink, Oct 28)

Measured from the factory/issue-8 file list (all of `projects/oreheart-8/public/`, 1 MB = 1,000,000 bytes):
- Game now (Round 26 is in): **95.38 MB**. (My earlier "about 94.9 MB" was too low; the real number is 95.38.)
- + the 15 new Round 27 parts in `../parts/` (+4.81 MB) → **100.19 MB** without shrinking – that would have been over 100 MB.
- − 15 dwarf bodies at 512 px (−3.03 MB) → 97.17 MB (not enough).
- − 13 gnome bodies at 512 px (−4.74 MB) → **92.43 MB after Round 27**. Under 95 MB with about 2.6 MB to spare.

