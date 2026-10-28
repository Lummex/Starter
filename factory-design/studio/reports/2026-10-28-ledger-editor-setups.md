# Ledger – Model Editor setups for the game (Oct 28, 2026)

Job from Forge (Ken OK'd, Oct 28). Follows Gauge's first check (2026-10-28-gauge-first-check.md).

## Delivered (on main)
- `factory-design/design/models/editor-setups-2026-10-28.json` – Ken's saved editor setup for all 12 cards: model version + clip names, every accessory (name, GLB, kind, bone, position, rotation, scale, stretch) and a paste-ready `partsTableLook` for `PARTS` in creature3d.ts. Heights included as information only.
- `factory-design/design/models/editor-setups-2026-10-28.md` – how to read the numbers (bone-local, degrees, Euler XYZ, scale × stretch), per-card to-do list, paste-ready PARTS entries.
- `factory-design/design/models/parts/` – 7 GLBs the game does not have yet (3,790,212 bytes total).

## Checked
- Character GLBs: 11 of 12 are byte-identical to the game's `char.glb` (git hash). **Gyronaut differs**: the editor has the Oct 27 model with OH_Hover/OH_Fly/OH_Attack/OH_Hit; the game still has the old one → new file in `parts/`.
- Accessory GLBs already in the game: same shape, size and origin as the editor's (vertex bounds compared), so the editor numbers fit. **Exception: Shiv Rat dagger** – the game has an older, thinner dagger → replacement in `parts/`.
- Missing from the game: Shiv Rat backpack, Gyronaut gyro wings (used twice), Tinkerer scepter, crystal shield, wrench.
- My math reproduces the editor's own world positions exactly (ball centre -0.213, 0.047, 0.046; staff -0.300, 0.244, 0.194), so the exported numbers are right.
- New `parts/` files: textures shrunk only; every accessor (geometry, UVs, bones, clips) decoded and compared: identical.

## Size
- Net game growth if Anvil adds everything (dagger and Gyronaut char replace old files): **+2.74 MB → about 94.9 MB**. Under 95 MB, but just. The Gyronaut body texture was shrunk 1024 → 512 px to get there (the full one is still in the editor if Ken prefers it; that would be ~95.1 MB).

## Editor fixes (Gauge)
- **Bowler Brawler ball sank into the floor** (rest: 5.6% of a square under the floor; OH_Walk: 10%). Ball raised 0.106 squares in his right hand, same turn and size. Now: rest +0.050, OH_Idle +0.006, OH_Walk +0.000 (bottom of ball vs floor). Still dips a little in the old Meshy Idle/Casual_Walk (-0.005 / -0.031), which the game stops using in Round 25. Checked in the editor (front view: hand on top of the ball, ball clear of the floor).
- **Junk Shaman staff**: Ken's setup held it level (pointing forward, 88° from upright). The card art shows it upright, so it now stands straight up in his right hand, same grip point on the staff, glowing head on top (top at 0.83, bottom 0.12 above the floor). Stays above the floor in rest/OH_Idle/OH_Walk. Checked in the editor.
- Both saved through the editor's own "Save as default look" (setup, look file, combined GLB and preview all updated). Only those numbers changed (compared the database before/after).
- **Ken's old setups are kept** as saves in the editor's Save & load list: "Backup Oct 28 - Bowler Brawler (Ken setup before ball fix)" and "Backup Oct 28 - Junk Shaman (Ken setup before staff fix)". One click on Load brings either back.
- Also in that list: three "Ledger proposal Oct 28 …" saves I used for checking. Not needed any more; I did not delete them (Ken's call).

## Open
- Ken: OK the upright staff (or Load the backup if he prefers the old one).
- Anvil: copy the PARTS entries, add the 7 files, switch Gyronaut char.glb, then events.json + clips for Gyronaut/Tinkerer (not part of this job).
- Editor docs still show synced: false until the game round lands; I'll mark them synced after Anvil's round is in.
- Two Chrome tabs: my first editor tab dropped out of my tab group mid-job (it may still be open in Ken's Chrome, with nothing unsaved that matters). Ken can close it.
