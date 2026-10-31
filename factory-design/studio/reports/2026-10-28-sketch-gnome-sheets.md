# 2026-10-28 – Sketch – Gnome model sheets redo (Gearward Sentinel, Gemsinger Miner)

Job from Forge. Both sheets had failed on Oct 27 (wrong sheet / no sheet; the old art machine was out of credits).

## What I did
- Card paintings taken from `projects/oreheart-8/public/art/owner/gnome/<card>-card-art.webp` (branch factory/issue-8).
- Made both sheets in Ken's ChatGPT app (own Chrome tabs), card painting attached, prompt "Create an image (landscape 3:2). ...". 1536x1024 PNGs.
- Looked at each sheet next to its card painting.
- Uploaded both to Oreheart Studio as assets, added them to `library/<card>.refs` (no status) and set `characters/<card>.steps.sheet` to "waiting" (+ `images.sheet`).

| Card | Studio asset | Sheet |
|---|---|---|
| gearward-sentinel | 9513014b6b2183a63eae856db977a0e6 | brass robot front/side/back + spiked mace + gear-wheel shield |
| gnome-prospector (Gemsinger Miner) | 386bde26c534c3bd13d415fdf2f3be9c | gnome front/side/back + crystal pickaxe (4 views) |

## How close to the card
- Gearward Sentinel: very close. Riveted brass/bronze body, one blue eye, chest gear, blue chest seams, two pipes, round shoulders and feet, the same mace and gear shield. Off: the eye is centered (on the card it's a little to one side), the back view adds a glowing gear core the card doesn't show, and the hands are half-closed fists, not open. The little gnome girl on the card is left out on purpose.
- Gemsinger Miner: very close. Helmet with blue crystal lamp, round glasses, pointed ears, brown hair, torn purple tunic with pale trim, blue cuffs, belt with pouches, crystal vials and gear buckle, big buckled boots. Off: the pickaxe has two equal crystal blades (on the card the back is a shorter spike). The library still lists a "crystal crate backpack" that isn't in the card painting, so the sheet has no backpack.

## GitHub
Uploaded 2026-10-29 after Forge said the Round 26 preview was out: both sheets to factory-design/art-made/, this report, and factory-design/studio/agents/sketch.md (new).
