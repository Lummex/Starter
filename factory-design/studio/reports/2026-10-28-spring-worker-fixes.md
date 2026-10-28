# 2026-10-28 – Spring – Blender worker fixes (retry loop + reference pictures)

Job from Forge, Ken OK'd it (Oct 28, "Yeah"). Only the two agreed changes; everything else the same.

## First: the goblin job
goblin-bomber-runway-idlebox was running when I started, so I left the worker alone until it finished.
It finished at 03:26 UTC: **awaiting_review**, validation ok, 2 new clips **OH_Idle_v2** and **OH_Idle_ShadowBox** (90 frames each),
all old clips untouched (worst calibration error 0.0012 % of height). Previews: feet planted, guard and punches in the boxing clip, calm sway in the idle.
Results: blender-queue → blender-jobs/goblin-bomber-runway-idlebox/out/. Still to do: bundle into the Model Editor and both programs for Ken's approval.

## What changed on main (factory/blender-worker/)
1. **Retry loop (worker.py, failure handler).** Every failure now counts one retry (`retries` + 1). The job goes back to `queued` only while
   `retry_on_failure` is on and `retries` < `max_retries`; after that it stays `failed` with "Stopped (no retries left)". With max_retries 2 a job runs at most 3 times. History entries now carry `retries` and `next`.
2. **Reference pictures (worker.py, Runner.fetch_references).** Built into the normal job start (progress stage "references", 20 %), right before Claude Code designs.
   Same rules as the old hotfix: pictures only (.jpg/.jpeg/.png), only from factory-design/runway/ or factory-design/runway-jobs/, max 120, saved as data,
   refs/<path minus first two folders>. New: if any picture is missing or not allowed, the job stops **before** Claude Code runs (no wasted usage).
   No reload trick: it works on every start, also right after a restart.
- glbtool.py: only a note added; the old hotfix skips the new Runner (`_oh_refs = 1`), so nothing runs twice. README: two lines about retries and references.
- Safety rules unchanged: outbound HTTPS only, port 9876 not exposed, allowlisted job types/scripts, nothing from job text or downloads is run, sources read-only, results only in the job's own out/, no credentials in GitHub.

## Test (real worker.py, offline)
The worker's own code was run with stand-ins for GitHub, Blender and Claude Code (factory-design/studio/agents/spring-worker-test/).
Each start is a fresh process, like a restart on Ken's PC. The fake Claude Code writes no animation, so every run fails on purpose.

| Code | Starts | refs/ seen by Claude Code | End state |
|---|---|---|---|
| Old (main before) | 6 (I stopped it) | 0 pictures every time | still `queued`, retries 0: endless loop |
| New | 3 | 4 of 4 pictures every time | `failed`, retries 2/2 |
| New, one picture missing | 3 | Claude Code never started | `failed`, retries 2/2 |

The old code shows exactly the two bugs we saw live. Also checked: reloading glbtool leaves the new code alone.

## Not done yet: the live worker
**worker.py only reaches Ken's PC through the installer.** The worker auto-updates only blender_ops/ and prompts/, never worker.py.
So the PC still runs the old worker.py until Ken re-installs:
download the factory/blender-worker folder from main, double-click Install-Blender-Worker.cmd, press Enter at the key question (keeps the saved key), answer y/n for autostart.
After that I run a small live test (job with references that fails on purpose) to check refs/ and the stop after max_retries on the real PC.
