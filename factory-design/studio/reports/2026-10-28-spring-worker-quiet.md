# Spring – quiet Blender worker (Oct 28)

Job from Forge (Ken OK'd: "Yes, Spring can change the Blender worker"). Problem: every worker push to blender-queue made
Vercel queue builds; 347 piled up overnight and blocked the game preview.

## Before I changed anything
- No Blender job was running: worker starr-f0fad5 status "idle", last job (rotgut-grenadier-runway-death-r3) done at 10:01 UTC.
- Since then: one "idle" commit every ~15 min (26 of the last 100 commits on blender-queue). The last job alone made ~35
  commits (claim, busy, 8 stages, heartbeats every 90 s, one commit per uploaded file, done, idle).
- The change is on main only. The worker on Ken's PC keeps running the old code until he reinstalls (worker.py is not
  auto-updated), so nothing changed live.

## What changed (factory/blender-worker/worker.py + README.md on main; blender_ops unchanged)
1. **No idle commits.** The status file `blender-jobs/_workers/<id>.json` is written only when the state really changes
   (kept in memory; on start it reads the file and writes nothing if it already says "idle"). No 15-minute "I'm alive"
   commit. Restarts make no commits. "busy" rides in the job's claim commit and "idle" in the job's final commit.
2. **One commit per job stage; all results in ONE commit.** New `GitHub.commit_files` writes several files in one commit
   (git data API: blobs → tree → commit → fast-forward ref update). The result files go up together with the final
   state (awaiting_review / completed / failed). A failed validation still uploads its results (same commit as "failed").
3. **Heartbeats:** the job is still re-read every 90 s to catch a cancel (a read, no commit). The lease is now 15 min
   (was 5) and is renewed with a commit only when the last write is 10 min old, so normal stages make no heartbeat commits.
   Crash recovery still works; it just waits up to 15 min instead of 5.
4. **Commit messages end with `[skip ci] [vercel skip]`.** Vercel itself does not skip on these words (docs: only
   `git.deploymentEnabled` in vercel.json, or the project's Ignored Build Step / ignore command, which can read
   `VERCEL_GIT_COMMIT_MESSAGE` or the branch). They help if an ignore-build command checks for them.
- Safety rules unchanged: compare-and-swap on job.json (now checked inside the one-commit write, and the branch update is
  fast-forward only), allowed job types, references check, anim-script allowlist, retry cap, cancel/stop/pause.

## Test (offline rig: factory-design/studio/agents/spring-worker-test/quiet/, real worker.py, fake GitHub at the HTTP level, virtual clock)
| | old worker.py | new worker.py |
|---|---|---|
| idle hour | 4 commits | 0 |
| 10 restarts in a row | 10 | 0 |
| one job (18 result files) | 31 | 8 |
| hour with one job | 37 | 8 |

Also checked with the new code: result files on the branch byte-identical to the local results; failing job stops at
retries 2/2 (3 runs); failed validation uploads results with "failed"; cancel from the dashboard mid-job → cancelled;
crash mid-job + restart after the lease → recovered (retries 1) and finished; a 23-min Claude stage → 2 heartbeat commits,
longest gap between job writes 630 s (lease 900 s); `--check` still works (1 "checked" commit). Every commit carried the tag.
A real job also makes more preview files than the test, so the old code makes ~35-40 commits per real job, the new ~8-10.

## For Ken: reinstall (one reinstall also brings the retry fix from this morning)
1. Make sure no Blender job is running (Oreheart Studio / ask Spring).
2. On GitHub, Lummex/Starter → Code → Download ZIP (main). Unzip it.
3. Open the unzipped `factory/blender-worker` folder and double-click `Install-Blender-Worker.cmd`.
4. When it asks for the key, just press Enter (keeps the saved key). Answer the autostart question as before.
5. Done: the worker restarts by itself. Spring can confirm it on GitHub (no more "idle" commits every 15 minutes).
Added to Oreheart Studio → Waiting for you (decisions/blender-worker-quiet-reinstall).

## Still worth doing (Anvil/Forge, not done here)
- Vercel will still queue a (skipped) build for each worker commit until the projects ignore the blender-queue branch.
  Cleanest: in each Git-connected Vercel project, make the Ignored Build Step exit early for branch `blender-queue`
  (`VERCEL_GIT_COMMIT_REF`). Note: the `git.deploymentEnabled` lines in vercel.json on main most likely don't help here:
  Vercel reads vercel.json from the pushed commit, and blender-queue has none (not checked in Vercel's logs). The worker now makes ~5-10x fewer commits either way.
- The dashboard's own job writes (blender.js) and agents queuing jobs also push to blender-queue.
