# Clay – Overclocked Aethervein 3D model (Oct 29, 2026)

Job from Forge: make the model for Overclocked Aethervein (card `overclocked-conduit`, gnomes, Rare Gatherer) from Ken's approved robot sheet (Studio asset 243089945f59d64421482be881f7190d; `factory-design/art-made/model-sheet-redo-overclocked-conduit-oct28-chatgpt.png`). Ken's note: "He doesn't need the shield drawn" → no shield.

## What I did
- Meshy input: the three body views cut from the sheet's top row (front / side / back). The shield and pickaxe are separate drawings lower on the sheet, so they are not in the input at all. The figures were cut out by shape (side and back touch on the sheet) and the steam puffs were painted out. Files: `factory-design/meshy-jobs/overclocked-conduit--char-{front,side,back}.jpg`, job `overclocked-conduit` in jobs.json (commit c68c70d).
- Meshy run ONCE: workflow run #7 (05:25–05:30 UTC), rigged like the other units. Output `factory-design/models/overclocked-conduit/char.glb` + `models.json` (commit 9afe33b), 18,866,532 bytes raw.
- Checked: 20,733 triangles (40,015 vertices), the standard 24-bone Meshy skeleton (Hips … RightToeBase), 6 moves: Idle, Casual_Walk, Heavy_Hammer_Swing (attack), Hit_Reaction, Dead, Charged_Axe_Chop (mine, because it is a Gatherer). Height 1.008 (idle, first frame).
- Textures shrunk only (2048 → 512 px, every map JPEG q88 4:2:0, the same as the Oct 28 rigged dwarves). Every non-picture byte and the glTF JSON are identical to Meshy's file (checked by script). Close-ups at 2048 / 768 / 512 look the same, so 512 it is.

## Files (factory-design/design/models/)
| File | Bytes | What |
|---|---|---|
| `overclocked-conduit-oct29.glb` | 2,938,556 | 512 px textures, plain GLB (the body file) |
| `overclocked-conduit-oct29-packed.glb` | 2,016,032 | the same file, lossless meshopt pack (decoded and compared: every byte identical; same method as the Round 27 dwarves) |

Size: this body adds 2.94 MB to the game, or 2.02 MB packed. Ledger should count it in the budget before it goes in.

## Check by eye (picture: `2026-10-29-clay-aethervein-check.jpg`)
- Matches the sheet and the card art: brass-and-purple riveted robot, glowing blue glass tank on top, blue eyes, blue arm tubes and knee/shoulder lights, gears, dark grey hands. No shield.
- **Off 1 – idle hides the grin.** The toothy grin is in the model (clear in the rest pose, walk and attack). On this robot the face is on its body, so the "head" bone sits in the face. Meshy's Idle tilts that bone and folds the plate above the eyes down over the mouth (Idle 0 and Idle 0.5 in the picture). That's for Spring: pick or tune an idle that doesn't bend the head this far.
- **Off 2 – two small grey flags on the pipe tops.** These are leftovers of the steam puffs (thin wisps I didn't fully paint out of the input). They're small, but visible up close. Fixing them would need a second Meshy run (Ken's OK) with cleaner input, or a parts cover-up in the editor.
- Colour reads a bit more gold and less purple than the sheet; the shape is a little lumpier than the clean drawing (normal for Meshy).
- Card flavour says "four arms, four pickaxes"; the approved sheet (and so the model) has two arms. The pickaxe is not made yet (character only, like the other gnomes).

## For others
- Wright: bundle `factory-design/design/models/overclocked-conduit-oct29.glb` in the Studio Model Editor as key `overclocked-conduit-oct29` ("Overclocked Aethervein (robot, Oct 29)"). Then `library/overclocked-conduit.src = {key:"overclocked-conduit-oct29", kind:"bundled"}`.
- Spring: body type **biped** (two arms, two legs, the standard 24-bone rig). See Off 1 about the idle.
- Studio: `characters/overclocked-conduit.steps.model` = waiting for Ken's eye.
