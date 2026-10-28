# Round 27

**DRAFT (Anvil, Oct 28) — not started.** Ken has not said "start" yet. Round 26 (build #56) is still running. Sections D and E are filled in after Ken reviews the Round 26 preview.

**When started, this is the whole job.** The game is `projects/oreheart-8` on branch `factory/issue-8`. Older round sections in `oreheart-phase-1b-brief.md` are history only. If `factory-data/oreheart-8/SPEC.md` still lists Round 26 work, replace that part with this round.

## Rules for this round (owner)
- **Change nothing that is not listed here.** No new game rules, no new or changed card numbers (cost, attack, health, move, range), no new cards, no renamed things.
- **Do not touch `factory-data/oreheart-8/acceptance`** (never delete, move, rename or commit anything in `factory-data/`). Do not run `git add`, `git commit` or any git command: the factory saves your work itself.
- **Size:** keep the built `dist/` under **95 MB** (AC90). Only shrink textures; never simplify, re-mesh or re-quantize geometry and never touch UVs, bones, skin weights or clips. If something can't fit, leave it out and say so in REPORT.md.
- **Owner art is binding.** Use existing art and models only; never invent a picture, emblem, icon or model. No Meshy.
- **Editors must match the game.** Every value you copy or change goes in `factory-data/oreheart-8/REPORT.md` under **"Editor updates needed"** (what, which file, which editor).
- **Order** (stop cleanly at a working state if the budget runs out): **C** (size) first, then **A**, then **B**, then **D**, then **E**. In REPORT.md list each item as Done / Partly / Not started.

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
6. Brewmaster's crystal hammer is not in Ken's look: do not add it. Heights stay as they are now.

Done when:
- **AC400** For each of the 14 bone-attached parts above and Grubnak's scepter, the part's parent bone and local position/rotation/scale in a match equal the setups file within 0.001.
- **AC401** Every part file above loads in a match (no missing GLB, no console error) and follows its bone during idle/walk/attack.
- **AC402** Shieldbeard has the medic pack and no shoulder-pad shield; Brewmaster has the keg pack and no crystal hammer; Dwarf Pickman, Bowler Brawler and Junk Shaman look the same as in the Round 26 build.

---

## B. Ram Rider rides his ram

Card `ram-rider` (Thunderhorn Ram Rider). Today the game shows the rider with **no ram**. Ken's Studio setup (`editor-setups-2026-10-28b.json` → `cards['ram-rider'].accessories[0].mount`) puts the ram on the ground and the rider seated on it. This needs a small code change in `creature3d.ts` (a `mount: true` part, not a bone attachment).

1. For a `PARTS` entry with `mount: true` (`ram-rider` → `ram.glb`): build the figure as a group: the **ram** stands on the ground at `[0.011, 0.473, 0.006]`, rotation `[0, 0, 0]`, scale `0.53`; the **rider** is a child of the ram at `[-0.017, -0.217, -0.328]`, rotation `[0, 0, 0]`, scale `2` (rider world scale 1.06), exactly as in the Studio.
2. The whole group (ram + rider) stands on the ground, is centred on its square, faces and moves like other units, and keeps the unit's current game height/footprint (scale the group, not the parts against each other).
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

## Editor updates needed (write in REPORT.md)
- Every `PARTS` value copied in A (14 parts + Grubnak scepter) and the ram mount values from B.
- The list of `char.glb` files replaced in C: **the Studio's Model Editor models (`models/<key>.glb.txt`) must be updated to the same shrunk files** so game and Studio stay byte-identical (Wright publishes the Studio page; Ledger updates `library`).
- Every `clips` map / `events.json` added in D.
- Size of `dist/` at the end.
