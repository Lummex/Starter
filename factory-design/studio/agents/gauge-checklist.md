# Gauge – Quality Check: character checklist

Run this for **every character** after Clay (model), Spring (animation) and Ledger (Model Editor) say it is done, and before Anvil builds. Nothing goes to Ken until every **Must have** passes.

**Must** = blocks the character. **Nice** = report it, does not block.

Where things live (branch factory/issue-8 unless noted):
- Game files: `projects/oreheart-8/public/models/creatures/<id>/` (char.glb, part .glb files, models.json, events.json)
- Game code that loads them: `src/ui/creature3d.ts` (PARTS list, LOOKS heights, which clips it plays)
- Cards: `src/content/cards.json` (name, abilities, text)
- Owner card art (binding): `public/art/owner/<faction>/<card-id>-card-art.webp` (a few are .png with an older name, e.g. boneknocker, shiv-rat)
- Model Editor: https://claude.ai/artifact/5isEcqgnmtqRHJUWAmqRDd, database collection `library`, one doc per card (accessories, lookJson, final, refs, note)
- Motion References: https://claude.ai/artifact/U9YiTAL4juKxjLgvNeKEe8, database collection `takes` (parts[].status "approved")

How Gauge looks at a model: in my own Chrome tab, open a page on cdn.jsdelivr.net, load three.js 0.160 + GLTFLoader + MeshoptDecoder from there, fetch the GLB from raw.githubusercontent.com, then measure it in code and render it from the front, side and back (with the parts attached the same way the game attaches them). Use get_page_text to read long results.

---

## 1. Model

| # | Check | How to check | Level |
|---|---|---|---|
| 1.1 | File loads (valid GLB) | GLTFLoader with MeshoptDecoder loads char.glb with no error; glTF version 2; extensionsRequired are ones the game supports (EXT_meshopt_compression, KHR_mesh_quantization). | Must |
| 1.2 | Rigged | Has a SkinnedMesh and a skin; bones include Hips, Spine, Head, LeftHand, RightHand, LeftFoot, RightFoot (the game attaches parts to these). | Must |
| 1.3 | Faces front (+Z) | In rest pose the left hand is at +X and the right hand at −X, toes point to +Z; front render shows the face. | Must |
| 1.4 | Stands on the ground | Rest-pose lowest point is y = 0 (the game also re-grounds it); feet are not far below the floor in idle. | Must |
| 1.5 | Height right for its type | Compare the game height (LOOKS / DEFAULT_H in creature3d.ts) with the Model Editor height (editorScene main item scale) and with the other characters: goblins ≈ same band, gnomes ≈ 0.8× goblins, big units (troll, golem, riders) taller. Game and editor must agree. | Must |
| 1.6 | Matches the owner's card art | Side-by-side: card art vs front/side/back renders. Colors, outfit, hair/hat/hood, build, weapon. | Must |
| 1.7 | Original name only | cards.json name is original (no names from other games, films or brands); the same name is used in the Model Editor. | Must |
| 1.8 | Model sheet approved | Model Editor `refs[]` sheet status is "approved" (not "redraw"). | Must |
| 1.9 | Reasonable size | char.glb ≈ 1–2 MB after compression; textures shrunk, geometry untouched. | Nice |

## 2. Accessories

| # | Check | How to check | Level |
|---|---|---|---|
| 2.1 | Every item from the card art exists | List items in the card art (weapons, tools, shields, backpacks, bags, belts, wings, mounts). Each has a part file in the game folder and an entry in PARTS (creature3d.ts) and in the editor `accessories`. | Must |
| 2.2 | Right bone | Weapon in the correct hand (the hand the card art shows; default RightHand), shield on the left arm/hand, packs on Spine/neck, mounts under the rider. | Must |
| 2.3 | Sits in the hand / on the body | Render rest + idle from front and both sides: the grip is inside the hand, the item is not floating in the air or behind the back. | Must |
| 2.4 | No clipping | Item does not go through the body or under the floor in idle, walk and attack. | Must |
| 2.5 | Same placement as the owner's editor look | If the editor look has a transform for the item, the game uses that same bone + position/rotation/scale (a `look` entry in PARTS), not the auto-fit. | Must |
| 2.6 | Effects | Effects in the editor look (flame, glow, twinkles, orbs) also show in the game. | Nice |

## 3. Animations

| # | Check | How to check | Level |
|---|---|---|---|
| 3.1 | Full set exists | GLB has clips for: idle, walk, attack, hit, defeat (death), plus the reactions every unit needs (react_knockback, react_bonk, react_bowled, react_backstab, react_lifted), plus each card's special moves from its abilities (e.g. bowl → OH_Special, shaman lift → OH_Special, ranged → a throw/shoot clip, flying → hover + fly, deathKnock → death with a shockwave event). | Must |
| 3.2 | Right names, all linked | Every clip in models.json `clips` exists in the GLB; every OH_ clip in the GLB is in `clips` and in events.json; durations in events.json match the GLB (±0.05 s). | Must |
| 3.3 | The game actually plays them | creature3d.ts plays the named clips (until Round 25 it plays `actions` by position, i.e. the old Meshy clips). | Must |
| 3.4 | Loops cleanly | For idle, walk, hover and lifted: the pose at the first and last frame is the same (bone angle difference < 2°, hips do not jump). | Must |
| 3.5 | Stays facing front | Render the idle at 8 points in time from the front: the face stays toward the camera (small sway is fine; turning sideways or away is not). | Must |
| 3.6 | No sliding feet | Idle: feet stay planted (foot drift < ~3% of height). Walk is in place: feet lift and land, they do not skate. Hit/death do not slide the body out of its square. | Must |
| 3.7 | No broken limbs | Bone lengths stay the same in every clip (stretch < 1%), no NaN poses, nothing bends backwards (check renders). | Must |
| 3.8 | Events | Attack has a "hit" event on the hand; throws have a release event; special moves have their events (ball_release, lift_start/lift_end, shockwave). | Must |
| 3.9 | Matches the approved Motion Reference | If Motion References has a take for this character with parts[].status "approved", the clip follows it. Takes that are "waiting" or "redraw" are not approved: a clip made from them still needs Ken. | Must (when an approved part exists) |
| 3.10 | Open animation requests done | Editor `animRequests` with status "wanted" are done or agreed with Ken. | Nice |

## 4. Editors

| # | Check | How to check | Level |
|---|---|---|---|
| 4.1 | Same model version | Model Editor `library/<id>` note and clip list match the game GLB's clips; `final`/`look` are marked synced. | Must |
| 4.2 | Accessories show in the editor | Every game part is in editor `accessories` and in the saved look, and the other way round. | Must |
| 4.3 | Animations show in the editor | Editor look `animations` lists the same clips as the game GLB. | Must |
| 4.4 | Arenas and cards match | Card name/art in cards.json and card-art.json match the editor name and the owner art; arena layout uses the same unit. | Must |

## 5. Game files

| # | Check | How to check | Level |
|---|---|---|---|
| 5.1 | All files present | `public/models/creatures/<id>/` has char.glb, models.json, events.json, and every part .glb listed in PARTS. | Must |
| 5.2 | Files agree | models.json clips ↔ GLB ↔ events.json (see 3.2); models.json `parts` ↔ PARTS in creature3d.ts. | Must |
| 5.3 | Size budget | Sum of everything under `projects/oreheart-8/public/` (GitHub tree sizes) stays under 95 MB; anything that would pass 100 MB needs Ken first. | Must |

## Verdict
- **PASS**: every Must is OK.
- **FAIL**: any Must is not OK. List each one with the agent who fixes it: Clay = model, Spring = animation, Ledger = Model Editor, Anvil = game files/code, Brush/Sketch = art. Send through Forge.
