# Spring – Bare Knuckle Lunatic (goblin-bomber): Blender clips from the approved Runway take

Date: 2026-10-28 · Job from Forge (Ken approved both parts of goblin-bomber-idle-box-front). Ken OK'd the worker fix directly in my chat.

## Result
- Blender job **blender-jobs/goblin-bomber-runway-idlebox** (branch blender-queue) is done: status awaiting_review, "2 animation(s) built and checked: OH_Idle_v2, OH_Idle_ShadowBox".
- Source: game char.glb on factory/issue-8. Output out/char.glb (1.96 MB, meshopt) = same model and all 15 old clips + the 2 new ones. Old clips untouched (worker calibration error 0.001%).
- **OH_Idle_v2** (Part 1, idle): 90 frames / 3.0 s, loop. Breathing, sway, weight shift right ~f30 / left ~f60.
- **OH_Idle_ShadowBox** (Part 2, idle special): 90 frames / 3.0 s, loop. Guard f9, left jab f15-17, right cross f26-28, left hook f38-40, right hook f49-51, guard f62, lowers fists f69-76, settled f82-90; small hip bounce every 10 frames.
- Naming: events.json had no idle variants yet, so new names; the game still uses OH_Idle until Ken approves and Ledger/Anvil wire them in.

## My own checks (exported GLB, own renderer, front view)
- Both clips exist, exactly 3.0 s / 90 frames, loop seam = 0 (first and last key identical on every channel).
- Face front: hips yaw −0.56° the whole clip (the old OH_Idle is turned −28° to −52°).
- Feet planted: foot drift 0.04% (idle) / 0.24% (shadow box) of his height. Nothing below the floor (lowest vertex −0.1% of height).
- No broken limbs in 13 front frames per clip (images: img/2026-10-28-goblin-bomber-OH_Idle_v2-front.jpg, img/2026-10-28-goblin-bomber-OH_Idle_ShadowBox-front.jpg).
- Compared with the video: shadow boxing follows the order (guard, jab, cross, hooks, lower). Differences Ken may notice: (1) both clips start/end in the model's rest stance, arms a bit wider out than the video's relaxed arms; (2) idle motion is subtle; (3) punches are compact, closer to the face than the video's full reach; no lunge (feet kept planted on purpose).

## Made reviewable
- Model Editor: new bundled model **"Bare Knuckle Lunatic + new idle & shadow boxing (Oct 28, for review)"** (models/goblin-bomber-v5.glb.txt, published as version 69; file checked byte-for-byte). The card still uses goblin-bomber-v4 – nothing switched.
- Studio Checklist characters/goblin-bomber: steps.runway = approved, steps.blender = waiting with where-to-look note. kenNote untouched.

## Worker fix (earlier in this run)
- First tries failed 5x: the worker's reference-picture hotfix was off after a restart (it only switches on when glbtool reloads after a script update), and a failed job re-queues forever without counting retries. I paused the job, Ken OK'd a one-line note in factory/blender-worker/prompts/animate.md on main (makes the worker reload), I re-queued, and it ran normally (~10 min incl. one revision round).
- For whoever owns the worker: put "references" support into worker.py itself, and count retries on failure.

## Not done (by design)
- Nothing in game files or production. Next after Ken's OK: Ledger, then Gauge, then Anvil.
