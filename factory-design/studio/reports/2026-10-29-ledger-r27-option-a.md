# 2026-10-29 – Ledger – Round 27 option A (4 goblin files) + size after Round 26

Job from Forge (decision `r27-size-option-a` = Yes, decided by Forge).

## What I checked
Rendered original (game file) and new file side by side in three.js r170, front view and close-ups, idle t=0. Pictures are in `2026-10-29-ledger-r27-option-a/`.
- **Shiv Rat, Goblin Miner (scrounger), Scrapsmith Miner** at 512 px: they look the same. Used.
- **Boneknocker (goblin-pebbler)** at 512 px: the skull on its hood was noticeably softer, so it is **not used** and stays at 768.
- **Grubnak's throne** with all maps at 512 px: the skull banners were blurry even at full view. I remade it with the **colour map kept at 768** and only the normal and metal/rough maps at 512. It looks the same as the original and saves 228,260 bytes.
- Mistake I caught: my first "colour stays 768" build kept the wrong picture. The throne's colour is image 1 (`textures[0].source = 1`), not image 0. I saw it by eye, then rebuilt the file and checked it again.

## Result
- Files: `factory-design/design/models/round27-shrunk/` shiv-rat-char.glb, goblin-scrounger-char.glb, goblin-smith-miner-char.glb, grubnak-throne.glb (README updated). The old `option-a-needs-ken/` folder is not used.
- Game size measured at factory/issue-8 `dc569cf` (after Round 26) is 93,596,499 B. All 46 files Round 27 replaces are unchanged. **Round 27 total: 94,712,467 B = 94.71 MB** (0.29 MB under 95). Owner fixes after dc569cf add on top.
