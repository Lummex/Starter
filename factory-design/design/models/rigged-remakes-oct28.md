# Rigged remakes (Clay, Oct 28, 2026)

Job from Forge; Ken OK'd re-running Meshy for these two only ("redo the model in Meshy and make sure it puts the rigging in it").
**Waiting for Ken's approval** in Oreheart Studio (characters/<card>.steps.model = "waiting"). Not in the game. Do not add to Round 27 until Ken approves.

| File (this folder) | Card | Bytes | Replaces in the Studio (after Ken's OK) |
|---|---|---|---|
| `anvilsworn-miner-rig-oct28.glb` | Anvilsworn Miner (`dwarf-smith-miner`) | 2,603,600 | `stonebreaker-miner` (0 bones, red beard) |
| `borgo-rig-oct28.glb` | Thane Borgo Gravelgrim (`cmd-borgo`) | 2,384,088 | `borgo` (0 bones) |

Check pictures: `anvilsworn-miner-rig-oct28-check.png`, `borgo-rig-oct28-check.png` (front / side / back / test pose / walk / attack).

## What they are
- Made by the Meshy workflow run #6 (meshy-models.yml, `ONLY=anvilsworn-miner-rig,borgo-rig`): multi-image-to-3D → Meshy auto-rig (humanoid) → Meshy animations.
- Full-size Meshy originals (kept, untouched): `factory-design/models/anvilsworn-miner-rig/char.glb` (15,849,732 bytes) and `factory-design/models/borgo-rig/char.glb` (15,074,964 bytes), with `models.json` (Meshy task ids).
- Inputs: `factory-design/meshy-jobs/anvilsworn-miner-rig--char-{front,side,back}.jpg` (cropped from Ken's approved Anvilsworn sheet, A-pose + gear, Oct 24, approved Oct 28) and `borgo-rig--char-{front,side,back}.jpg` (the Studio's Borgo front/side/back refs from the Gear-Crowned commander sheet).
- Character only. Accessories already exist and are unchanged: `stonebreaker-pickaxe`, `stonebreaker-hammer` (miner); `borgo-sceptre`, `borgo-throne` (Borgo).

## Checked (Clay, in Chrome, on the real files)
- **Skeleton:** 24 bones, same names and order as our other characters: Hips, Spine02, Spine01, Spine, neck, Head, head_end, headfront, Left/Right Shoulder, Arm, ForeArm, Hand, Left/Right UpLeg, Leg, Foot, ToeBase.
- **Weights:** every vertex's weights add up to 1.000; 23 (miner) / 22 (Borgo) bones carry weight. Test pose (arms up, leg kick, head turn, lean) bends the mesh cleanly, no torn or flying vertices.
- **Clips:** Idle, Casual_Walk, Heavy_Hammer_Swing, Hit_Reaction, Dead (+ Charged_Axe_Chop = "mine" for the miner). Walk and attack frames play correctly on the skin.
- **Faces front** (+Z, toes ahead of ankles), stands on the ground (lowest point y = 0), height 1.0 like the other units.
- **Looks:** matches the card art and the approved sheets (miner: black beard, blue/gold armour, lamp helmet, back roll; Borgo: red braided beard, gear crown, blue robe with gear banner, gold-trimmed cape).
- **Size:** textures only shrunk 2048 → 512 px (base colour, normal and metal/rough maps; all saved as JPEG). Geometry, UVs, bones, skin weights and clips are byte-identical to Meshy's original (every non-picture byte compared).
  Mesh: miner 34,993 verts / 20,730 tris; Borgo 32,495 verts / 20,587 tris.

## Size warning for the builder
Game after Round 27 is about 92.43 MB (Ledger). These two add about 5.0 MB together (≈ 97.4 MB), over 95 MB. Most of each file (≈ 2.2 MB) is mesh + animation data, which we may not shrink. Ken must decide before both go in (e.g. one per round, or drop the Dead/Hit clips — needs his OK).

## sha256
- anvilsworn-miner-rig-oct28.glb `1db86888db52f2058d090fb7a95ff945cd7fefd20260db887e03b097b73a9a58`
- borgo-rig-oct28.glb `2c36bf351dc5ba491fcf1b3b71061d8b9a3b5cbe5dccb1fd0a0fbf56edf8a425`
