# Discontinued list (Sweep)

Last checked: **Oct 28, 2026** by Sweep (cleanup). Newest: section 6 (large models backed up to Ken's PC).

**Team rule (from Ken):** anything on this list, or inside any `_discontinued` folder, is **not used**. Don't look at it. Don't use it. Nothing here has been deleted.

Times are Ken's local time (Pacific). "Today" = Oct 27, so anything made Oct 27 was left alone.

---

## 0. Deleted Oct 28 (Ken's OK)

Ken said "yes" directly to Sweep on Oct 28 (Studio decision `delete-old-builds-oct28` marked answered). Sweep **permanently deleted** everything listed in this section at about 1:30 pm Pacific. This is the only time anything was deleted; the rest of this file is still "listed, not deleted".

The commit SHAs are recorded so the code can be restored from git history (e.g. from closed PRs #3, #5, #7).

### GitHub Lummex/Starter — issues
| Issue | Title | State (Oct 28) |
|---|---|---|
| #1 | hard wood floor refinishing website | closed |
| #2 | truck inventory tracker | closed |
| #4 | OreHeart (old version) | open |
| #6 | Oreheart1 (old version) | open |

### GitHub Lummex/Starter — branches (last commit SHA, Oct 28)
| Branch | Last commit SHA | Open pull request on it |
|---|---|---|
| factory/issue-2 | `d8a78daf33064d3f3416a9f530d8c62d4db63a81` | #3 "Factory: truck inventory tracker (#2)" |
| factory/issue-4 | `1e3ff810121cd51190e94999ad3036a7cee9d65a` | #5 "Factory: OreHeart (#4)" |
| factory/issue-6 | `6a2b614c6f5c5031fc9985781a9d95d3a0c7876e` | #7 "Factory: Oreheart1 (#6)" |

Deleting the branches closed PRs #3, #5, #7; those PR pages keep the commits, so the code can still be restored from them.

### Vercel (team Lummex) — projects
- `starter` (already disconnected from Git)
- `factory-2` (already disconnected from Git)

### Keep — do NOT touch
Issue #8, issue #11 (Hoardfire idea), branches `main`, `factory/issue-8` (`9d92f743…`), `blender-queue`; Vercel `oreheart-8` (oreheart.cards) and `starter-dashboard`; everything in projects/, factory-data/, factory/, dashboard/, factory-design/.

---

## 1. What was moved

**Nothing was moved this run.** Sweep has no tool that can move files on Ken's PC (only list/read/write), and the rule says don't copy-and-delete. So everything below is **listed** instead. A `~/Downloads/_discontinued/` folder can be made next time a move tool is available.

---

## 2. Discontinued (do not use)

### Ken's Downloads folder (still sitting in Downloads, not moved)
All made **Oct 26** by the animation/Blender runs. Their finished results live in GitHub (`blender-queue`) and the editor.

- `ohanim-*` — **86 files** (Oct 26): Blender job outputs for goblin-bomber, goblin-grunt, goblin-pebbler, goblin-scrapper, goblin-slinger, goblin-sneak, junk-shaman, rotgut-grenadier, shiv-rat, skullbasher-rusher (`*-sig-a/b`, `*-reactions-r1/r2/r2a/r2b` .glb, -events.json, -anim-*.py.txt)
- `oh-models-snapshot-1.json` (Oct 26)
- `oh-slinger-prev-events.json` (Oct 26)
- Folders `oh-up`, `oh-up2`, `oh-up3`, `oh-up4`, `oh-up5` (contents dated Oct 26: char.glb / events.json / models.json upload bundles)

### GitHub `blender-queue` branch — finished jobs older than today (47)
Job folders under `blender-jobs/` (left in place; GitHub has no "move"):

- Cancelled (1): `goblin-grunt-reactions-r2`
- Completed (2): `goblin-slinger-inspect-001`, `goblin-slinger-inspect-002`
- Awaiting review, finished Oct 26 (44):
`goblin-bomber-reactions-r1`, `goblin-bomber-reactions-r2`, `goblin-bomber-sig-a`, `goblin-bomber-sig-b`,
`goblin-grunt-reactions-r1`, `goblin-grunt-reactions-r2a`, `goblin-grunt-reactions-r2b`, `goblin-grunt-sig-a`, `goblin-grunt-sig-b`,
`goblin-pebbler-reactions-r1`, `goblin-pebbler-reactions-r2`, `goblin-pebbler-sig-a`, `goblin-pebbler-sig-b`,
`goblin-scrapper-reactions-r1`, `goblin-scrapper-reactions-r2`, `goblin-scrapper-sig-a`, `goblin-scrapper-sig-b`,
`goblin-slinger-reactions-r1`, `goblin-slinger-reactions-r2`, `goblin-slinger-sig-a`, `goblin-slinger-skull-throw-001` … `-004`,
`goblin-sneak-reactions-r1`, `goblin-sneak-reactions-r2`, `goblin-sneak-sig-a`, `goblin-sneak-sig-b`,
`junk-shaman-reactions-r1`, `junk-shaman-reactions-r2`, `junk-shaman-sig-a`, `junk-shaman-sig-b`,
`rotgut-grenadier-reactions-r1`, `rotgut-grenadier-reactions-r2`, `rotgut-grenadier-sig-a`, `rotgut-grenadier-sig-b`,
`shiv-rat-reactions-r1`, `shiv-rat-reactions-r2`, `shiv-rat-sig-a`, `shiv-rat-sig-b`,
`skullbasher-rusher-reactions-r1`, `skullbasher-rusher-reactions-r2`, `skullbasher-rusher-sig-a`, `skullbasher-rusher-sig-b`

Still live, NOT discontinued: `blender-jobs/README.md`, `blender-jobs/_workers/`, and the 4 `gyrocopter-ace-runway-*` jobs (today).

### Model Editor — bundled models no card uses (17)
Checked every card in the editor's `library`: its `src`, its accessories, and the models it borrows animations from. These files are not used by any of them (newer copies replaced them). Files stay in the editor; just don't use them.

| Old file (`models/…glb.txt`) | Replaced by |
|---|---|
| goblin-bomber-v2 | goblin-bomber-v4 |
| goblin-grunt-v2 | goblin-grunt-v4 |
| goblin-scrapper-v2 | goblin-scrapper-v4 |
| goblin-slinger-v2, goblin-slinger-v3 | goblin-slinger-v4 |
| goblin-sneak-v2 | goblin-sneak-v4 |
| junk-shaman-v2 | junk-shaman-v4 |
| rotgut-grenadier-v2 | rotgut-grenadier-v4 |
| shiv-rat-v2 | shiv-rat-v4 |
| skullbasher-rusher-v2 | skullbasher-rusher-v4 |
| goblin-pebbler-char | goblin-pebbler-v4 |
| shiv-rat-dagger | shiv-rat-v2-dagger |
| goblin-smith-miner-char, -hammer, -pickaxe | goblin-smith-miner-v2 (+ v2 backpack/pickaxe) |
| grubnak-fortress, grubnak-scepter | grubnak3d-throne, grubnak3d-scepter |

Careful — these look old but ARE still used: the `-v2` **accessories** (frying-pan, bowling-ball, skull-mace, bag/dagger, staff, spatula, backpack, mace/shield), `grubnak` (old body, 3 cards borrow its animations), `shiv-rat-char` and `goblin-scrounger-char` (animations borrowed).

---

## 3. Not sure — Ken please decide

1. **Downloads, made today (Oct 27) — left alone:** `ohmain-*` (4), `ohbw-*` (3: worker.py, glbtool.py, animate.md), `ohg-*` (11 gyrocopter clips/sheets), `ohgy*` (15), `oh-gnome-tinker-wrench.glb`, `oh-bomber-idle-clip.mp4`, `oh-bomber-idle-sheet.jpg`, folders `oh-gy1`, `oh-gy2`, `oh-rw1`–`oh-rw4`, `oh-wrench`. Sweep can list these next time once they're a day old.
2. **Downloads check may be incomplete:** the folder has more than 2,000 items and the listing tool stops at 2,000, so a few more oh-* files may exist.
3. **Editor models:** `crystal-node-hd` (full-detail crystal node, no card uses it), `gnome-smith-miner-oct25` (newer Arcsmith body not yet used, but its pickaxe IS used), `gyrocopter-ace-oct25` (not the card's model, but still named in the gyrocopter's saved look).
4. **Old game branches:** `factory/issue-2`, `factory/issue-4`, `factory/issue-6` (last change Oct 13; the game is `factory/issue-8`). Look unused. *(Oct 28: deleted with Ken's OK, see section 0.)*
5. **Leftover upload folders on main:** `oreheart-upload/` (Oct 13, early design + factory copy), `factory/STEP-2-factory-folder/config.json` (Oct 13). Nothing in the factory code or workflows points at them.
6. **Old round notes on main:** `factory-design/round-9b-queued.md`, `factory-design/round9c/` (Oct 20–21). `round-8b-queued.md` is still mentioned in OREHEART-HANDOFF.md, so leave that one.
7. **Vercel:** two projects not in the team list: `starter` (818 preview builds, all from `blender-queue`; last change Oct 20) and `starter-dashboard`. Ask before treating them as old. *(Oct 28: `starter` deleted with Ken's OK, see section 0; `starter-dashboard` is kept.)*
8. **Old Blender worker copy** on Ken's PC: Sweep can't see running programs. Only the copy in `%LOCALAPPDATA%\OreheartBlenderWorker` is the real one.

---

## 4. Vercel preview builds (count only, nothing changed)

| Project | Owner | Preview builds | …made before today | Production builds | Notes |
|---|---|---|---|---|---|
| oreheart-8 | game (in use) | 49 | 48 | 11 | all from factory/issue-8 |
| factory-2 | Ken | 958 | 716 | 198 | 782 from blender-queue |
| oreheart-4 | Ken | 911 | 679 | 197 | 740 from blender-queue |
| oreheart1-6 | Ken | 923 | 684 | 193 | 754 from blender-queue |
| truck-inventory-tracker-2 | Ken | 910 | 685 | 198 | 732 from blender-queue |
| starter-dashboard | ? | 777 | 532 | 199 | 764 from blender-queue |
| starter | ? | 818 | 573 | 1 | all from blender-queue |

**Worth knowing:** every push to `blender-queue` starts a new preview build in **6 Vercel projects** at once (about 4,500 wasted builds so far). The worker queue never needs a website. Fixing this is a Vercel setting ("Ignored Build Step"), which Sweep is not allowed to change — Forge/Anvil should decide.

---

## 5. Old round briefs (Anvil, Oct 28)

Both were folded into Round 26 (`factory-design/design/oreheart-round-26-combined-brief.md`). Nothing was deleted.

- `factory-design/discontinued/round-24-skullflinger-skull-throw-brief.md` — the Round 24 section copied out of `oreheart-phase-1b-brief.md` (it was on hold; build #55 built it by mistake). The owner rejected the skull throw build #55 put in the game; Round 26 item (0) removes it. In `oreheart-phase-1b-brief.md` that section is now replaced by a pointer to Round 26.
- `factory-design/discontinued/oreheart-round-25-card-drag-brief.md` — the Round 25 card-drag brief. The old file `factory-design/design/oreheart-round-25-card-drag-brief.md` now only says "discontinued, read Round 26".

---

## 6. Large models moved to Ken's PC (Oct 28)

Job from Forge (Ken's request, Oct 28 ~21:05 UTC): back up every file under `factory-design/models/` on **main** that is **larger than 3 MB** (the full-size Meshy originals) to Ken's PC, then remove them from main. The resized models (`factory-design/design/models/`), every `models.json`, notes and all files of 3 MB or less stay.

- **Backup folder on Ken's PC:** `C:\Users\kentu\Downloads\_discontinued\Large Models\<card>\<file>.glb` (same sub-paths as on GitHub).
- **Copied from main at commit** `58bd8e4abd51a23bb616f37dcfc6b636cac8c65a`.
- **Checked:** all **90 / 90** files on the PC have the exact GitHub size **and** the same git blob SHA-1 (read back from the PC and hashed). Total **777,862,320 bytes (about 778 MB)**.
- **Deleted from GitHub main?** **Not yet.** Deleting needs Ken's own "Yes" in Oreheart Studio -> Waiting for you -> decision `delete-large-models-oct28`. Until then the 90 files are still on main (and they stay in git history either way). `models.json` stays, so Meshy will not re-make these models.
- Extra copies named `LargeModels__<card>__<file>.glb` are also loose in Ken's Downloads folder (the browser saves there first; Sweep has no tool to move or delete them). They are the same files; Ken can delete them, or Sweep tidies them when a move tool is available.

| # | Path under factory-design/models/ | Bytes | Git SHA-1 | On PC, verified |
|---|---|---|---|---|
| 1 | `anvilsworn-miner-rig/char.glb` | 15,849,732 | `2c9b4008097f593dded21b6f60a08b51670f4e9b` | yes |
| 2 | `axe-thrower/char.glb` | 5,649,268 | `75e2c923736873f11608c5f9069882fd7eb42c41` | yes |
| 3 | `axe-thrower/shield.glb` | 10,701,692 | `37d3e5d9852c26a521be4b0047118eb17862b6ea` | yes |
| 4 | `barrelback-courier/barrel-pack.glb` | 12,327,600 | `7f6450b7e8e7dce294271ba013a860ff1b1bd472` | yes |
| 5 | `barrelback-courier/char.glb` | 5,471,436 | `1f1492f9fc1fc6f521c0daa8a8e5146eb94e9275` | yes |
| 6 | `blastrat-sapper/bomb.glb` | 12,596,360 | `8339e2ea6febbffa3325d4effd2b26dd00c7d771` | yes |
| 7 | `blastrat-sapper/char.glb` | 6,186,616 | `b3a4935cf1ef7231060c7ecbedf364e4e16f321b` | yes |
| 8 | `borgo-rig/char.glb` | 15,074,964 | `140aebb0ece74032924724b1130677118ddae0a5` | yes |
| 9 | `brewmaster/char.glb` | 5,363,616 | `087976e4648f258c08379cf5d26bcbc8e601ea7c` | yes |
| 10 | `brewmaster/crystal-hammer.glb` | 8,872,784 | `5eef92e0b5342179cf0d9485a4a3f8e9991e28e2` | yes |
| 11 | `brewmaster/keg-pack.glb` | 13,357,804 | `80b2fb05cdb2bbff2afe14132580da9425db834e` | yes |
| 12 | `clockwork-beetle/char.glb` | 15,813,428 | `6d83baae410365420b4f54c9bde56a2fcfd95d0a` | yes |
| 13 | `crystal-drunk-delver/char.glb` | 5,674,832 | `bfb95f3f71b39ffffb152dfdb6635d7a4d7fa2f5` | yes |
| 14 | `crystal-drunk-delver/crystal-backpack.glb` | 12,486,788 | `d662b1384e43690eb585d68be68e3d7ef6e3ecbc` | yes |
| 15 | `crystal-drunk-delver/pickaxe.glb` | 8,233,128 | `dfddc184caf6c4fba8a03b17d6f194959350f26b` | yes |
| 16 | `deepforge-crossbowman/char.glb` | 5,133,304 | `92bf735a19ed99e275f83fdbda209868f442a026` | yes |
| 17 | `deepforge-crossbowman/crystal-gun.glb` | 9,694,344 | `2562d7037b9b1219817898cbef8769c3f2003184` | yes |
| 18 | `dwarf-miner/char.glb` | 5,682,444 | `d32551305c5f92e3fe66a0df477c4c3e6d5027d0` | yes |
| 19 | `dwarf-miner/tower-shield.glb` | 9,528,328 | `81f0c9eed6ecaf4009cee341bb113f78f4982fe7` | yes |
| 20 | `dwarf-pickman/char.glb` | 5,704,236 | `3c6bc3cdcde6f1a9578cf5226abea92facc47bdc` | yes |
| 21 | `dwarf-stoneback/char.glb` | 5,584,036 | `e9bc9b1c83654671e48eab22c83210cd7d39abdf` | yes |
| 22 | `dwarf-stoneback/hammer.glb` | 9,708,004 | `127c3d00287a71cc94bb31934cdb6f043b7e6912` | yes |
| 23 | `gearward-sentinel/char.glb` | 5,722,768 | `63651ed568e1d3c5421d151eb4b3da564ab3a6f7` | yes |
| 24 | `gearward-sentinel/mace.glb` | 11,258,796 | `3adb7928d72e6280eb98a024df5fc0fb117fa3fc` | yes |
| 25 | `glyphshield-warden/char.glb` | 6,052,888 | `4ad0e57cea7f0417db7081883868009f2c458c67` | yes |
| 26 | `glyphshield-warden/shield.glb` | 10,158,484 | `7c3ce3670be904cf56393fb9ae247f6963875c60` | yes |
| 27 | `gnome-cogger/char.glb` | 6,240,624 | `7f1bf546a6bdf7a51e33c7e76789e706af8c38bd` | yes |
| 28 | `gnome-cogger/mace.glb` | 11,139,312 | `c1e14de4021ec4f5f4fd28c027de1c6ae8e05caf` | yes |
| 29 | `gnome-illusionist/char.glb` | 5,613,216 | `650a20efe50e2ca2028434239ea6c7edd7ebd701` | yes |
| 30 | `gnome-smith-miner/char.glb` | 5,640,212 | `c054a51f61f347a7d6e00142b5ed3f9feb3067b1` | yes |
| 31 | `gnome-smith-miner/pickaxe.glb` | 9,695,284 | `56bdb3776d6f4a541dcc599186bca59edcbb9b42` | yes |
| 32 | `gnome-tinker/char.glb` | 6,141,788 | `1ef7e842e0ad25f409a29600930e410eee8b159c` | yes |
| 33 | `gnome-tinker/crystal-shield.glb` | 10,068,860 | `9a359f575407b1def58f8302a6c8c8648e36927d` | yes |
| 34 | `gnome-tinker/scepter.glb` | 10,711,984 | `43ff8d9bf2dcb8a43b0b2eaa15f69c454e583154` | yes |
| 35 | `gnome-tinker/wrench.glb` | 8,551,312 | `e9ccf9b955c2c4ccc916d6fbaf0a46a856cf5f67` | yes |
| 36 | `gnome-widget/char.glb` | 5,968,916 | `750b71351eca3903497d0e6b91f21b0cdfd09461` | yes |
| 37 | `goblin-bomber/char.glb` | 5,671,012 | `20bcc783a5bba5d5cef1f755c84e689e89281a1c` | yes |
| 38 | `goblin-grunt/char.glb` | 5,956,296 | `29063c4e470ef949cc89d0d0e7c5ba655c35bca8` | yes |
| 39 | `goblin-grunt/frying-pan.glb` | 8,542,248 | `3323e0bfa79bd6e6297063103547fa1b4b3ef956` | yes |
| 40 | `goblin-scrapper/bowling-ball.glb` | 14,051,928 | `dfcc7d573ab5fdd454c8d25aa69ba880a9019cc6` | yes |
| 41 | `goblin-scrapper/char.glb` | 5,633,032 | `0da116b6b51825ebe07b0ecd43cc44bbcb24156a` | yes |
| 42 | `goblin-slinger/char.glb` | 6,381,204 | `eb74bbef67ef553c56fff4e855bedb469653abf5` | yes |
| 43 | `goblin-slinger/skull-mace.glb` | 9,976,368 | `0af20ed48ceacf84c6f4000e6d724de28e789341` | yes |
| 44 | `goblin-smith-miner/backpack.glb` | 11,217,288 | `70e7d1ea8157f535cb153a35619157b4e6906dea` | yes |
| 45 | `goblin-smith-miner/char.glb` | 5,833,256 | `81d6ba5f5d96e991bf21851722fc2a0a4083cc49` | yes |
| 46 | `goblin-smith-miner/pickaxe.glb` | 8,986,528 | `7c1945cbbae48bd07df0162c0629533ab3cba739` | yes |
| 47 | `goblin-sneak/bag.glb` | 11,432,388 | `e873334b7cecbebe1b4924581584a66b795b2326` | yes |
| 48 | `goblin-sneak/char.glb` | 5,809,684 | `2a8a304f6347fb248d9946bc7b9084bf53afa421` | yes |
| 49 | `goblin-sneak/dagger.glb` | 8,213,096 | `2ff72311a621cc034d0d1c7ebcba39c24bd5e4c5` | yes |
| 50 | `grimhold-ravager/char.glb` | 5,725,000 | `d4bf693bd90653add711737738311889025ab248` | yes |
| 51 | `grimhold-ravager/hammer.glb` | 9,213,148 | `d78b6a01b824216a5ee51da131944dc235e84d1d` | yes |
| 52 | `grubnaks-big-boss-troll/char.glb` | 5,934,812 | `a17e3ba5766383edb37a09454f8b73f6ff721ff1` | yes |
| 53 | `gyrocopter-ace/char.glb` | 5,677,016 | `d98ca161946251d13115e570d43b0158e5878d9e` | yes |
| 54 | `gyrocopter-ace/gyro-wings.glb` | 12,998,896 | `7ae831a15e706ddd6a649e99a7dfdef077076ac5` | yes |
| 55 | `hexwright-apprentice/char.glb` | 5,860,192 | `dc75c8b7b5f3ec78a3fac27e185dbceb0a5f62ec` | yes |
| 56 | `hexwright-apprentice/staff.glb` | 10,534,044 | `2c25aadce9ac161b2472b6bc2426ae7629d78e75` | yes |
| 57 | `ironhammer-berserker/char.glb` | 5,599,544 | `9caf3668b003e52003f8d3e19076a828607eff8b` | yes |
| 58 | `ironhammer-berserker/crystal-pistol.glb` | 10,120,664 | `b322a6c555f2c80d0d0d6bbf2a3ee76125f4a34b` | yes |
| 59 | `junk-shaman/char.glb` | 7,015,192 | `63bbc0c018d9643f2af468d63c671c78e167d56b` | yes |
| 60 | `junk-shaman/staff.glb` | 13,118,960 | `2b8170c3395e6d169b46621d6a4a69e26a4f2647` | yes |
| 61 | `oathbound-pikeman/char.glb` | 5,580,044 | `8e3920a683ac676c2d5c6aeea1d011cde4eeb735` | yes |
| 62 | `oathbound-pikeman/rifle.glb` | 10,202,716 | `0e7b129e2366eccb25c9e54341c30a11171edb2b` | yes |
| 63 | `phase-stalker/char.glb` | 6,045,300 | `050972f7e718ed4e140ddf3afae1214a1a149745` | yes |
| 64 | `phase-stalker/plow.glb` | 13,900,928 | `63a94d425a5f416ec13e078c032c3dddcedfdd4b` | yes |
| 65 | `queen-brunhilda-stonebeard/char.glb` | 5,601,960 | `83f1ba29e757a0da36130128c1262b13a75a4fd5` | yes |
| 66 | `queen-brunhilda-stonebeard/warhammer.glb` | 10,094,428 | `6b5b7f7e03722df7086b9f9c241255cd75e2eee8` | yes |
| 67 | `ram-rider/char.glb` | 5,564,776 | `2e2fad729722015781745c462848c210bb27c190` | yes |
| 68 | `ram-rider/ram.glb` | 12,963,220 | `e8c570112808fb66981ea4f75766e6cce26f85de` | yes |
| 69 | `rotgut-grenadier/char.glb` | 6,128,612 | `a9cc7e4288aee55e95edea3a42434f3efcba8237` | yes |
| 70 | `rotgut-grenadier/spatula.glb` | 9,639,844 | `d23900619570c45ef570c6a4c0a9332d8804ae78` | yes |
| 71 | `rune-splitter/char.glb` | 5,584,060 | `2487cb859e91fb3d1dc2908420c3cf4967cb5429` | yes |
| 72 | `rune-splitter/crystal-hammer.glb` | 10,476,868 | `977122c5492f68a4eb8d166cc5f876fabc7cff10` | yes |
| 73 | `runic-siphoner/char.glb` | 5,857,436 | `9ec96cd48da5b430b0730cbdb809b1d6ae99038e` | yes |
| 74 | `runic-siphoner/staff.glb` | 10,388,908 | `c6ba86c27b6cbd1877a70849db6cbfbee3121521` | yes |
| 75 | `shard-guzzler/char.glb` | 5,996,232 | `f8f00a9b93f581443457f030608cf1b47f8c70ef` | yes |
| 76 | `shard-guzzler/rocket.glb` | 13,212,972 | `3ced2e0eb8cd151b80dd07eceed28b41bbf05b4f` | yes |
| 77 | `shieldbeard/char.glb` | 5,933,732 | `cb84e7bfa65b744be2d685fe2ee252a823ae4d52` | yes |
| 78 | `shieldbeard/medic-pack.glb` | 11,088,832 | `5e013de591e3c14ff1eb2d0dfb0a666e536c5d08` | yes |
| 79 | `shiv-rat/backpack.glb` | 10,457,196 | `3208c0fc740cd7a85fa2f6ce49db86b028756140` | yes |
| 80 | `shiv-rat/char.glb` | 6,387,176 | `4a29b6e3ba9d04d69eba01c2bf5534a90ea18a99` | yes |
| 81 | `shiv-rat/dagger.glb` | 8,091,488 | `c2db85f20fd31dace53e1cb78d48d1995755f0f2` | yes |
| 82 | `skullbasher-rusher/char.glb` | 5,547,636 | `d0d611ccaa78c0731d5a8c4d2a9b539b7e12f11d` | yes |
| 83 | `skullbasher-rusher/mace.glb` | 11,207,436 | `6476eaa0a44e3756feedf6ecd4b69ecc860ea606` | yes |
| 84 | `skullbasher-rusher/shield.glb` | 11,140,316 | `1e0ab23b213a22ee4b8300431fb9a384104c6fce` | yes |
| 85 | `spark-gnome/char.glb` | 6,112,556 | `ef9d4b419e11b2a6493b11616dbce164f4916bf5` | yes |
| 86 | `spark-gnome/staff.glb` | 9,666,792 | `9624842148fc827e5178a613faf65eb5ee3dd502` | yes |
| 87 | `the-great-steam-golem/char.glb` | 6,564,260 | `8beb34a664a0f737d976a9109fd87282ba8ee2fe` | yes |
| 88 | `wolf-rider/char.glb` | 6,309,188 | `6e0209985bd90384279443739858edb62c9ce502` | yes |
| 89 | `wolf-rider/mace.glb` | 10,320,652 | `6d000212efa5e6d739938802b40c6920bc933dcf` | yes |
| 90 | `wolf-rider/wolf.glb` | 14,635,772 | `ab06d932644921ff1841168ae9085448b8abf3ec` | yes |
