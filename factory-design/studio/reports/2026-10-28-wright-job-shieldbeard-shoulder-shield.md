# Job: shoulder-pad shield for Ironwall Shieldbeard (Oct 28 2026)

From Ken, directly to Wright. Forge: please pass on in order: **Sketch → (Ken approves) → Clay → (Ken approves) → Ledger**.

Card: **Ironwall Shieldbeard** (card id `shieldbeard`, dwarves). Ken calls him the "Iron Wall Shield Bearer". Studio: https://claude.ai/artifact/PrZreWSayBrALDPvQwsVmn#shieldbeard--sheet

## What Ken wants (his words, tidied)
"He needs a giant shoulder pad shield. A shield that looks like a shoulder pad. On the card art you'll see it on his **right** shoulder. Draw it, model it, and put it on his 3D model."

## What the card art shows (reference crop: shieldbeard-shoulder-shield-ref.png, next to this file)
- A huge, slightly curved rectangular plate, mounted on his right shoulder. It rises well above his helmet and covers his back/side like a wall.
- Deep blue paint, worn and chipped. Thick iron/gold rim with rivets.
- A big gold gear emblem on the face, matching the gears on his helmet and pauldrons.
- The card art is binding: match it. Original names only.

## Steps
1. **Sketch:** a model reference sheet for the accessory alone (front / side / back, plain background), plus one view of it sitting on his right shoulder. Put it in the Studio for Ken to approve (Shieldbeard → Reference sheet step, now "Working · Sketch").
2. **Clay (after Ken approves the sheet):** make it in Meshy, once, as a part (no rig). Shrink textures only (512, or 1024 for a big piece) and keep the game under 95 MB. Add the .glb to the Model Editor as accessory `shoulder-shield` on `library/shieldbeard` (the entry is already there with sheet/model = "needed"). The game files (projects/oreheart-8/public/models/creatures/shieldbeard/) and models.json need updating too: anything put in the game must update every editor.
3. **Ledger:** attach it in the Model Editor to his right shoulder/upper-arm bone (the Model Editor's auto-attach only does hands/back, so use "Attached to"). Check it in his idle and walk so it doesn't clip his head. Save as the default look. Ken approves in the Studio.

Nothing goes live without Ken's OK. The old body model stays as is; nothing is deleted.

## Status now
- Studio, Shieldbeard: Reference sheet = Working · Sketch; 3D character = Working · Clay (body still approved, shield next); Model Editor setup note mentions the attach.
- Model Editor library: new accessory "Shoulder-pad shield" (sheet needed, model needed).
