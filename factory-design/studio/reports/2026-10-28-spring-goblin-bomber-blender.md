# Spring – Bare Knuckle Lunatic (goblin-bomber): Blender job from the approved Runway take

Date: 2026-10-28 · Job from Forge (Ken approved both parts of goblin-bomber-idle-box-front).

## What I did
- Read the game's goblin-bomber models.json + events.json (factory/issue-8) and the Model Editor library doc (bundled key goblin-bomber-v4 = same clip set as the game: OH_Idle, OH_Walk, OH_Attack, OH_Death, OH_Hit, 5 reactions, plus old Meshy clips). No idle variants exist yet in events.json, so I named the new clips OH_Idle_v2 and OH_Idle_ShadowBox.
- Looked at both frame sheets myself (idle f01–f03 has a small step and f12 raises fists; shadow-boxing f05 has a big sliding lunge: told the animator to ignore those and keep feet planted).
- Wrote Blender job **blender-jobs/goblin-bomber-runway-idlebox/job.json** on blender-queue: source = game char.glb on factory/issue-8; two clips, 90 frames each (3 s), loop, base_pose "rest", face front, feet planted, both start/end in the same relaxed pose; references = goblin-bomber--front.jpg + all 24 frames (idle + shadow-boxing).

## What went wrong
- The worker (starr-f0fad5) picked it up in ~1 min but failed 5 times in a row in ~30 s each: "Claude Code did not write anims/OH_Idle_v2.py".
- Cause (from the worker code on main): the reference-picture support is a hotfix in blender_ops/glbtool.py that only switches on when the worker reloads glbtool after a script update. If the worker was restarted since Oct 27, the hotfix is never active, so refs/ stays empty, and the job (correctly) tells the animator not to write anything without refs.
- Second bug: a failed job goes back to "queued" without counting a retry, so it loops forever (one Claude Code run per minute). I paused the job (status failed, cancel_requested true) at 02:51 UTC so it stops using Ken's Claude usage. Checked: it stays paused.

## Blocked
- My fix was to add a short "Reference pictures" note to factory/blender-worker/prompts/animate.md on main (any change there makes the worker reload glbtool and switch the refs hotfix on). The permission check blocked that upload ("Modify Shared Resources"), so I stopped as Forge asked. Nothing was changed on main except this report and my notes.

## To unblock (pick one)
1. Ken (or whoever may edit the worker) OKs a tiny change in factory/blender-worker/prompts/ or blender_ops/ on main; then I re-queue the job (status queued, cancel_requested false).
2. Or Ken restarts nothing — but just touching a worker file on main is enough. A restart alone does NOT help (it makes it worse).
3. Longer term (Ledger/whoever owns the worker): put references support into worker.py itself and count retries on failure.

## Not done yet
- No exported GLB, no Model Editor bundle (plan: models/goblin-bomber-v5.glb.txt = v4 + the 2 new clips, listed as "Bare Knuckle Lunatic + Runway idle (Oct 28)" like gyrocopter-ace-v4), Studio Checklist not changed (blender step not started). Nothing in the game files.
