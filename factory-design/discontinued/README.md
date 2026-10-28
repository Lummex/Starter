# Discontinued list (Sweep)

Last checked: **Oct 27, 2026** by Sweep (cleanup).

**Team rule (from Ken):** anything on this list, or inside any `_discontinued` folder, is **not used**. Don't look at it. Don't use it. Nothing here has been deleted.

Times are Ken's local time (Pacific). "Today" = Oct 27, so anything made Oct 27 was left alone.

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
4. **Old game branches:** `factory/issue-2`, `factory/issue-4`, `factory/issue-6` (last change Oct 13; the game is `factory/issue-8`). Look unused.
5. **Leftover upload folders on main:** `oreheart-upload/` (Oct 13, early design + factory copy), `factory/STEP-2-factory-folder/config.json` (Oct 13). Nothing in the factory code or workflows points at them.
6. **Old round notes on main:** `factory-design/round-9b-queued.md`, `factory-design/round9c/` (Oct 20–21). `round-8b-queued.md` is still mentioned in OREHEART-HANDOFF.md, so leave that one.
7. **Vercel:** two projects not in the team list: `starter` (818 preview builds, all from `blender-queue`; last change Oct 20) and `starter-dashboard`. Ask before treating them as old.
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
