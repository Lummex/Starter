# Clay – rigged remakes: Anvilsworn Miner + Thane Borgo Gravelgrim (Oct 28, 2026)

Job from Forge (Ken's OK to re-run Meshy for these two only: "redo the model in Meshy and make sure it puts the rigging in it"). Ken also asked in Clay's chat (mid-run): put them in Oreheart Studio for his approval and editing.

## Result
Both new models are made, rigged and checked. **Waiting for Ken** in Oreheart Studio → Waiting for you.

| Card | Old model | New file (main) | Bytes | Skeleton | Clips |
|---|---|---|---|---|---|
| Anvilsworn Miner (`dwarf-smith-miner`) | `stonebreaker-miner`: 0 bones, red beard (card art has a black beard) | `factory-design/design/models/anvilsworn-miner-rig-oct28.glb` | 2,603,600 | 24 bones | Idle, Casual_Walk, Heavy_Hammer_Swing, Hit_Reaction, Dead, Charged_Axe_Chop (mine) |
| Thane Borgo Gravelgrim (`cmd-borgo`) | `borgo`: 0 bones | `factory-design/design/models/borgo-rig-oct28.glb` | 2,384,088 | 24 bones | Idle, Casual_Walk, Heavy_Hammer_Swing, Hit_Reaction, Dead |

Full-size Meshy originals kept: `factory-design/models/anvilsworn-miner-rig/` and `factory-design/models/borgo-rig/` (char.glb + models.json with task ids). Nothing was overwritten or deleted; old models stay.
Notes and check pictures: `factory-design/design/models/rigged-remakes-oct28.md`, `*-check.png`.

## How
1. References: Anvilsworn = Ken's approved sheet (Studio asset 028dd2…, A-pose + gear, approved Oct 28) cropped into front/side/back. Borgo = the Studio's `refs/cmd-borgo/borgo-front/side/back.webp` (from the Gear-Crowned commander sheet; the front view's right glove is slightly cut off at the picture edge, as in the original ref). Both match the owner card art.
2. Uploaded the 6 view pictures + two new jobs (`anvilsworn-miner-rig`, `borgo-rig`) to `factory-design/meshy-jobs/` (new ids, so the "made once" skip and old models are untouched).
3. Ran **Meshy workflow run #6** (`ONLY=anvilsworn-miner-rig,borgo-rig`), ~10 min. `meshy-models.mjs` already rigs by default (Meshy rigging API, humanoid, then Meshy animations), so **no script change was needed**.
4. Checked the real files in Chrome (parsed the GLB, did the skinning maths myself, drew pictures):
   - 24 bones with the same names/order as our other characters; weights sum to 1.000 on every vertex; 23/22 bones carry weight.
   - Test pose (arms up, leg kick, head turn, lean) and walk/attack frames bend the mesh cleanly.
   - Faces front (+Z), feet on the ground, height 1.0.
   - Looks match the card art and sheets.
5. Shrunk textures only (2048 → 512 px, JPEG): 15.8 MB → 2.6 MB and 15.1 MB → 2.4 MB. Every non-picture byte is identical to Meshy's original.

## Studio (ArtifactData, pinned writes)
- `characters/dwarf-smith-miner.steps.model` = **waiting** (link = check picture asset `732fd287…`).
- `characters/cmd-borgo` **created** (commanders had no characters doc) with `steps.model` = **waiting** (check picture `f042577c…`); art approved, everything else not started.
- `library/dwarf-smith-miner.pendingModel` and `library/cmd-borgo.pendingModel` added (key, repo path, bones, clips). **`src` unchanged** until Ken approves.

## For Wright (only Wright publishes the Studio page)
Please add two new Model Editor entries (new files, nothing replaced):
- `models/anvilsworn-miner-rig-oct28.glb.txt` ← base64 of `factory-design/design/models/anvilsworn-miner-rig-oct28.glb` (sha256 1db86888…a9a58), key `anvilsworn-miner-rig-oct28`, name "Anvilsworn Miner rigged (Oct 28)".
- `models/borgo-rig-oct28.glb.txt` ← `factory-design/design/models/borgo-rig-oct28.glb` (sha256 2c36bf35…8a425), key `borgo-rig-oct28`, name "Borgo rigged (Oct 28)".
Then Ken can open and edit them in the Model Editor. After Ken approves: Ledger sets `library/<card>.src = {key, kind:"bundled"}`.

## For Anvil (Round 27, only after Ken approves)
Neither card has a model in the game yet. Size: game after Round 27 ≈ 92.43 MB; these add ≈ 5.0 MB (≈ 97.4 MB) – **over 95 MB**. ≈ 2.2 MB of each file is mesh + clips, which we may not shrink. Ken needs to choose (one now, one later, or something else) before both go in.
Also: the old `animRequests` "Skeleton + default moves (Blender)" on both library docs are now covered by these models if Ken approves (left as they are; not mine to close).

## Meshy credits used
Not reported by the API in this run. Estimate from Meshy's price list: per model about 30 (multi-image to 3D with texture) + 5 (rig) + animations (≈3 each) → roughly **50–80 credits total** for both. Exact numbers: Meshy account → usage (task ids in models.json).

## Not done / open
- Model Editor entries need Wright (see above).
- Ken's approval.
