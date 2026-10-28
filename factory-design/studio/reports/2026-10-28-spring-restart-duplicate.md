# Spring – restart run stood down (Oct 28, ~08:10–08:20 UTC)

Job: Forge's RESTART (Ken: "go ahead and restart Spring") – Part 1 Blender, Part 2 Runway refs, Part 3 dwarf-smith-miner rig check.

## What happened
- Two Spring runs started from the same restart at almost the same time.
- At start (08:11) my checks showed nothing done yet: no death/throw/backstab jobs on blender-queue, all 4 takes approved by Ken in Oreheart Studio.
- The other run queued `goblin-grunt-runway-death` at 08:10:34; the worker claimed it at 08:11:39. My own job file with the **same id** went up at 08:12:39 and overwrote theirs while the worker was designing.
- Fixed at 08:14:14: put the other run's job.json back (status running, their request/animations, worker lease kept, history note added). The worker keeps running the other run's spec (it reads the spec once at claim), so nothing was lost.
- The other run also committed the Part 2 Runway jobs (Bowler Brawler, Thunderwing) on main at 08:13:28.
- So I stopped: Parts 1 and 2 are being done by the other Spring run. I made no Runway calls, no Studio writes, no Model Editor changes. Cost of this run: $0.

## Part 3 finding (dwarf-smith-miner), for whoever finishes it
- The worker only allows job types `inspect` and `animate` (factory/blender-worker/README.md, Security; worker.py refuses anything else). `animate` needs a model that already has a skeleton (it keys bones through the ctx API and splices clips onto the existing joints).
- dwarf-smith-miner has 0 bones (Studio characters note), so **no allowlisted job can rig it**. Missing: a new `rig` job type (Blender auto-rig / armature + skin weights step in blender_ops, plus allowlist entry in worker.py) – needs Ken's OK to change worker code, and Ken must re-run the installer for worker.py changes.

## Lesson
- Before uploading a job file, re-check blender-queue commits in the last few minutes, and never reuse a job id that already exists – a second run can start at the same moment.
