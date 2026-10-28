# 2026-10-28 · Spring · Bare Knuckle Lunatic: idle + shadow boxing redraw

Job from Forge (Ken's request): redraw the goblin-bomber motion reference following Ken's note on take goblin-bomber-idle ("first three seconds standing idle with movement, second 3 seconds shadow boxing like a boxer training").

## What I made
One 6-second clip per view. Part 1 (0–3 s) idle: breathing, sway, weight shift, arms relaxed. Part 2 (3–6 s) shadow boxing: guard up, light bounce, jabs and hooks, then back to the start pose.

| View | Job id / clip | Runway task | Motion References take |
|---|---|---|---|
| front | factory-design/runway/goblin-bomber-idle-box-front/clip.mp4 | 9a1634e3-c2bd-4fb2-be86-0e26a085b678 | goblin-bomber-idle-box-front (take A) |
| side | factory-design/runway/goblin-bomber-idle-box-side/clip.mp4 | d7ff432c-91ad-4fb2-9079-eec730c01531 | goblin-bomber-idle-box-side (take B) |
| back | factory-design/runway/goblin-bomber-idle-box-back/clip.mp4 | 6b1cee4b-d167-448b-ac5c-1c4a59c9d04e | goblin-bomber-idle-box-back (take C) |

Each take: status waiting, parts = Part 1 idle 0–3, Part 2 shadow-boxing 3–6, chosen false. The old take goblin-bomber-idle was not touched.
Board: https://claude.ai/artifact/U9YiTAL4juKxjLgvNeKEe8 (checked in Chrome: 3 new cards show, video plays, 0:06 long, Part 2 marker at 3 s).

## Settings (cheapest, per Ken)
- Prices checked on docs.dev.runwayml.com (Oct 28): grok_imagine_1_5_lite at 480p = 2 credits/s + 1 credit for the start image. That is the cheapest image-to-video model (gen4_turbo 5/s, gen4.5 12/s).
- Model grok_imagine_1_5_lite, ratio auto_480p (544x544 output, square start image), 6 s (this model allows 1–15 s, so the full 3 + 3 split worked).
- No variations, no retries needed (all 3 succeeded first time). Workflow run #4: https://github.com/Lummex/Starter/actions/runs/40608191863
- **Cost: about 13 credits per clip, 39 credits total ≈ $0.39** (the old gen4.5 clips cost about 72 credits each).
- factory/scripts/runway-videos.mjs already supported per-job "model" and "ratio" (default stays gen4.5), so no script change was needed.

## Start images
New front/side/back renders: factory-design/runway-jobs/goblin-bomber--front/side/back.jpg (960x960). Made from Ken's saved Model Editor scene GLB (library/goblin-bomber "final"), character only: no helper box, no 6 ft height person, no grid or gizmos. Pose = first frame of OH_Idle (relaxed standing). The old goblin-bomber--start.jpg is kept as is.

## Check
- Clips exist on main (downloaded all 3 clip.mp4 + info.json + contact sheets).
- Front and side: idle then shadow boxing as asked, face mostly still.
- **Back view problem:** in Part 2 he turns round to face the camera for about a second (with a made-up face), then turns back. Usable for the idle half only. Did not redo it (cheapest-settings rule). A redo would cost about $0.13 if Ken wants it.
- Low resolution (480p) as asked; fine for reference.
