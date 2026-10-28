# Round 27

**DRAFT (Anvil, Oct 28) — not started.** Ken has not said "start" yet. Round 26 (build #56) is still running. Sections D and E are filled in after Ken reviews the Round 26 preview.

**When started, this is the whole job.** The game is `projects/oreheart-8` on branch `factory/issue-8`. Older round sections in `oreheart-phase-1b-brief.md` are history only. If `factory-data/oreheart-8/SPEC.md` still lists Round 26 work, replace that part with this round.

## Rules for this round (owner)
- **Change nothing that is not listed here.** No new game rules, no new or changed card numbers (cost, attack, health, move, range), no new cards, no renamed things.
- **Do not touch `factory-data/oreheart-8/acceptance`** (never delete, move, rename or commit anything in `factory-data/`). Do not run `git add`, `git commit` or any git command: the factory saves your work itself.
- **Size:** keep the built `dist/` under **95 MB** (AC90). Only shrink textures; never simplify, re-mesh or re-quantize geometry and never touch UVs, bones, skin weights or clips. If something can't fit, leave it out and say so in REPORT.md.
- **Owner art is binding.** Use existing art and models only; never invent a picture, emblem, icon or model. No Meshy.
- **Editors must match the game.** Every value you copy or change goes in `factory-data/oreheart-8/REPORT.md` under **"Editor updates needed"** (what, which file, which editor).
- **Order** (stop cleanly at a working state if the budget runs out): **C** (size) first, then **A**, then **B**, then **H** (heights), then **D**, then **E**. In REPORT.md list each item as Done / Partly / Not started.

---

## C. Smaller body textures (do this first — Ken OK'd the shrink, Oct 28)

Ledger made shrunk copies of the game's own body files: `factory-design/design/models/round27-shrunk/<card>-char.glb` (on **main**; read its `README.md`). Each is the game's current `public/models/creatures/<card>/char.glb` with only its body picture shrunk 1024 → 512 px. Geometry, UVs, bones, skin weights and clips are unchanged.

1. Copy each `round27-shrunk/<card>-char.glb` over `public/models/creatures/<card>/char.glb`. Copy the bytes as they are; do not re-export or re-compress.
   - **15 dwarf bodies:** axe-thrower, barrelback-courier, brewmaster, crystal-drunk-delver, deepforge-crossbowman, dwarf-miner, dwarf-pickman, dwarf-stoneback, grimhold-ravager, ironhammer-berserker, oathbound-pikeman, queen-brunhilda-stonebeard, ram-rider, rune-splitter, shieldbeard.
   - **13 gnome bodies** *(only if Ken has OK'd the gnome shrink by the time the round starts — see note)*: clockwork-beetle, gearward-sentinel, glyphshield-warden, gnome-cogger, gnome-illusionist, gnome-smith-miner, gnome-tinker, gnome-widget, hexwright-apprentice, phase-stalker, runic-siphoner, spark-gnome, the-great-steam-golem.
2. Do not shrink anything else.

Size (Ledger's measurement, Oct 28): game now 95.38 MB; + item A parts 4.81 MB = 100.19 MB; − 15 dwarf bodies (3.03 MB) = 97.17 MB (still over 95); − 13 gnome bodies (4.74 MB) = **92.43 MB**. So the gnome bodies are needed to end under 95 MB.

> **Note for Ken/Forge before starting:** Ken's OK quoted in Ledger's README is "It's okay to shrink the dwarf". Without the gnome bodies the game ends at about 97.2 MB (over 95). Confirm the gnome shrink, or drop some of item A, before starting.

Done when:
- **AC397** Each replaced `char.glb` is byte-identical to its `round27-shrunk/` file; for each one the glTF meshes, accessors (vertex/UV/skin data), node/bone list and animation clip names are identical to the previous build's file.
- **AC398** Every replaced creature still loads and plays idle/walk/attack in a match (no missing texture, no console error).
- **AC399** Built `dist/` at the end of the round is **under 95 MB** (also AC90). Write the final size in REPORT.md.

---

## A. Ken's 18 saved Studio looks in the game

Ledger exported Ken's saved looks from Oreheart Studio (Model Editor room) to **`factory-design/design/models/editor-setups-2026-10-28b.json`** + **`.md`** on main. The `.md` has the table of what to do per card and **paste-ready `PARTS` entries** for `src/ui/creature3d.ts`. The accessory GLBs are in **`factory-design/design/models/parts/`** (textures already at 256 px; nothing else changed). All 18 bodies are byte-identical to the Studio's models.

1. Copy these part files into the game (new files; nothing replaced):

| From `factory-design/design/models/parts/` | To `public/models/creatures/` | Bone |
|---|---|---|
| axe-thrower-shield-oct25.glb | axe-thrower/shield.glb | RightHand |
| barrelback-courier-barrel-pack-oct25.glb | barrelback-courier/barrel-pack.glb | Spine02 |
| brewmaster-keg-pack-oct25.glb | brewmaster/keg-pack.glb | Spine02 |
| crystal-drunk-delver-pickaxe-oct25.glb | crystal-drunk-delver/pickaxe.glb | RightHand |
| crystal-drunk-delver-crystal-backpack-oct25.glb | crystal-drunk-delver/crystal-backpack.glb | Spine02 |
| deepforge-crossbowman-crystal-gun-oct25.glb | deepforge-crossbowman/crystal-gun.glb | RightHand |
| dwarf-miner-tower-shield-oct25.glb | dwarf-miner/tower-shield.glb | LeftForeArm |
| dwarf-stoneback-hammer-oct25.glb | dwarf-stoneback/hammer.glb | RightHand |
| grimhold-ravager-hammer-oct25.glb | grimhold-ravager/hammer.glb | RightHand |
| ironhammer-berserker-crystal-pistol-oct25.glb | ironhammer-berserker/crystal-pistol.glb | RightHand |
| oathbound-pikeman-rifle-oct25.glb | oathbound-pikeman/rifle.glb | RightHand |
| queen-brunhilda-stonebeard-warhammer-oct25.glb | queen-brunhilda-stonebeard/warhammer.glb | RightHand |
| rune-splitter-crystal-hammer-oct25.glb | rune-splitter/crystal-hammer.glb | RightHand |
| shieldbeard-medic-pack-oct25.glb | shieldbeard/medic-pack.glb | Spine02 |
| ram-rider-ram-oct25.glb | ram-rider/ram.glb | (mount — item B) |

2. Paste the `PARTS` entries from the `.md` ("Paste-ready PARTS entries") into `creature3d.ts` for those cards. Values are bone-local (`bone.add(part)` with the raw accessory scene, no re-centring), rotation in degrees Euler XYZ, placed on the rest pose. Bone names are case-sensitive.
3. **Grubnak's scepter** (`cmd-grubnak`, `src/ui/grubnak3d.ts`): place it with Ken's look instead of `attachPart(len 1.05, grip 0.12)`: `{ bone: 'RightHand', pos: [-2.754, 16.04, 5.84], rot: [-117, 34, 153], scale: [74.48, 76, 76] }`. Keep his throne and the existing scepter glow/twinkle.
4. **No change** for `dwarf-pickman` (already matches), `goblin-scrapper` and `junk-shaman` (same as Round 26's file).
5. **Shieldbeard:** add only the medic pack. **Leave the shoulder-pad shield out** (not made yet).
6. Brewmaster's crystal hammer is not in Ken's look: do not add it. Heights: see section **H** (Ken, Oct 28 evening: heights now follow his Studio setups).

Done when:
- **AC400** For each of the 14 bone-attached parts above and Grubnak's scepter, the part's parent bone and local position/rotation/scale in a match equal the setups file within 0.001.
- **AC401** Every part file above loads in a match (no missing GLB, no console error) and follows its bone during idle/walk/attack.
- **AC402** Shieldbeard has the medic pack and no shoulder-pad shield; Brewmaster has the keg pack and no crystal hammer; Dwarf Pickman, Bowler Brawler and Junk Shaman look the same as in the Round 26 build.

---

## B. Ram Rider rides his ram

Card `ram-rider` (Thunderhorn Ram Rider). Today the game shows the rider with **no ram**. Ken's Studio setup (`editor-setups-2026-10-28b.json` → `cards['ram-rider'].accessories[0].mount`) puts the ram on the ground and the rider seated on it. This needs a small code change in `creature3d.ts` (a `mount: true` part, not a bone attachment).

1. For a `PARTS` entry with `mount: true` (`ram-rider` → `ram.glb`): build the figure as a group: the **ram** stands on the ground at `[0.011, 0.473, 0.006]`, rotation `[0, 0, 0]`, scale `0.53`; the **rider** is a child of the ram at `[-0.017, -0.217, -0.328]`, rotation `[0, 0, 0]`, scale `2` (rider world scale 1.06), exactly as in the Studio.
2. The whole group (ram + rider) stands on the ground, is centred on its square, faces and moves like other units, and has Ken's Studio size: no extra scale on the group (see **H** step 4; Studio group height 1.376 squares).
3. The rider keeps playing his own clips (Idle, Casual_Walk, Heavy_Hammer_Swing, Hit_Reaction, Dead, or his `clips` map). If `ram.glb` has clips, play its idle/walk with the rider's idle/walk (by name, list them in REPORT.md); if it has none, it holds its rest pose and moves with the unit. On death both disappear together.
4. Write the mount values and the code change in REPORT "Editor updates needed".

Done when:
- **AC403** In a match the Ram Rider shows a ram (`ram.glb` loaded) with the rider as its child at the local position/rotation/scale above within 0.001; the ram's lowest point is on the board (within 0.02 of ground level).
- **AC404** The Ram Rider moves, attacks, gets hit and dies with the ram attached; the rider's clips play; no other unit changes.

---

## D. New moves Ken approved (placeholder — add if approved)

Spring is making Blender moves now. **Only moves Ken has approved in Oreheart Studio by the time the round starts go in** (Studio `library/<card>.animApprovals[<clip>].status == "approved"`, read right before starting; Bare Knuckle Lunatic v5 also needs `decisions/bkl-v5` answered "yes"). For each approved move, Spring/Ledger put the new `char.glb` (or clip) on main and the builder adds it to that card's `models.json` `clips` map and `events.json`.

| Card (id) | Move | Clip role | Status on Oct 28 |
|---|---|---|---|
| Snotskull Grunt (`goblin-grunt`) | grunt death | `death` | being made — add if approved |
| Goblin Chef (`rotgut-grenadier`) | death | `death` | being made — add if approved |
| Skullflinger (`goblin-slinger`) | throw | `attack` (keep: no flying-skull projectile unless Ken asks) | being made — add if approved |
| Backstabbing Thief (`goblin-sneak`) | backstab | `attack` | being made — add if approved |
| Bare Knuckle Lunatic (`goblin-bomber`) | v5 idle + shadow boxing | `idle` (+ shadow boxing as idle variety / `special`) | being made; decision `bkl-v5` open — add if approved |

For each approved row, fill in before starting: file path on main, clip names in the GLB, the `clips` map lines, and the `events.json` events (e.g. `hit` time for attacks, `projectile_release` only if Ken asks).

Done when (only for rows that go in):
- **AC405** The card's `models.json` `clips` map and `events.json` name the new clip(s), and every name exists in its `char.glb`.
- **AC406** In a match that card plays the new clip for its role (mixer's active clip name), and attack hits still land when the `events.json` says.
- **AC407** Size stays under 95 MB after the new files (AC399).

---

## E. Round 26 leftovers (placeholder)

Filled in after Ken and Gauge review the Round 26 preview (build #56): anything from Round 26 that is Partly / Not started / wrong, written as its own item with "done when" checks. Empty until then.

---

## H. Heights from Ken's Studio setups (Ken, Oct 28: heights matter now)

**Ken's Studio setup is the look, including height and scale.** Ledger measured every character that has a saved Studio setup and wrote the exact game numbers in **`factory-design/design/models/editor-setups-2026-10-28b.md`** → section **"Heights from Ken's Studio setups"** (table + **paste-ready `LOOKS`**), data in **`editor-setups-2026-10-28b.json`** → `heightsForGame`. This covers the 12 Round 26 cards, the 18 Round 27 cards and every other character with a Studio setup (47 in all; 42 get a `LOOKS` line).

1. In `src/ui/creature3d.ts` replace the whole `LOOKS` object with the paste-ready one (42 entries). `LOOKS.height` = Ken's Studio body scale × that model's idle-0 height, so the game draws each body at exactly Ken's Studio size (the game normalises on the idle pose; do not round these numbers). Keep `stretch` as given (Bowler Brawler `[1, 0.93, 1]`).
2. Cards without a `LOOKS` line keep `DEFAULT_H` (no Studio setup yet). `LOOKS` already wins over `DEFAULT_H`; only the mount code path reads `DEFAULT_H` directly (see 4).
3. **Grubnak** (`src/ui/grubnak3d.ts`): body scale `ck = 1.22` (Ken's Studio scale on the raw GLB) instead of `SEAT.k * tH / H0`. Throne unchanged.
4. **Ram Rider** (with item B): build ram + rider 1:1 in Studio units with **no extra scale on the group** (ram scale 0.53, rider scale 2 on the ram → rider world scale 1.06); only lift the group so its lowest point is on the board. Studio group height 1.376 squares.
5. Things that follow a unit's height must use the new height, not a fixed 1.1: status icons above the head, the drunk icon, the hit/selection area. The acting ring stays on the ground. Nothing else changes size (board, mines, strongholds, cards).
6. **Dwarves** are 1.0 board squares tall in the Studio while goblins are 0.41–0.53 and gnomes 0.25–0.45. Ledger asked Ken (`decisions/dwarf-heights` in Oreheart Studio). Read it right before starting: if Ken answered **"resize"**, do not change the 15 dwarf heights (leave them as now) and say so in REPORT.md; otherwise use the table.
7. Not in this round (listed in the .md): Mangewolf Rider (game files differ from the Studio's), the Gnome Plow's plow, Arcsmith Miner (needs Ken), hover/floating differences, accessories of cards not in A.

Done when:
- **AC408** For every card in the paste-ready `LOOKS` list, the figure in a match has `heightSpaces` equal to the table's `LOOKS.height` (±0.001) and stretch as listed; the body's skinned height in its idle clip at t=0 is `LOOKS.height × stretch[1]` board squares (±1%).
- **AC409** Grubnak's body scale on the board is 1.22 (±0.005) with the throne unchanged; the Ram Rider group has ram scale 0.53 and rider world scale 1.06 (±0.001), group lowest point on the board (±0.02).
- **AC410** In a match a dwarf next to a goblin shows the Studio ratio (e.g. Grudge Hurler 0.977 vs Snotskull Grunt 0.412 in idle) — or, if Ken answered "resize", dwarves are unchanged and REPORT.md says so.
- **AC411** Accessories still sit where Ken put them after the resize (they are bone children, so they scale with the body): AC400 still passes.
- **AC412** Status icons, hit areas and other height-based UI follow the new heights (no icon floating far above a small goblin); no console errors.
- **AC413** REPORT.md "Editor updates needed" lists the final `LOOKS` values and the Grubnak/Ram Rider numbers.

---

## Editor updates needed (write in REPORT.md)
- Every `PARTS` value copied in A (14 parts + Grubnak scepter) and the ram mount values from B.
- The list of `char.glb` files replaced in C: **the Studio's Model Editor models (`models/<key>.glb.txt`) must be updated to the same shrunk files** so game and Studio stay byte-identical (Wright publishes the Studio page; Ledger updates `library`).
- Every `clips` map / `events.json` added in D.
- The final `LOOKS` values, Grubnak's body scale and the Ram Rider group values from H.
- Size of `dist/` at the end.
