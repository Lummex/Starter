# Spring: Studio batch (Oct 28, about 08:05 to 10:15 UTC)

Job from Forge (Oct 28): take Ken's Oreheart Studio approvals and requests through the animation process. The Studio's database is the one place for data (HANDBOOK: old programs are backup-only, so I wrote only to the Studio, not to Motion References or the Checklist).

Run notes: my first try at this run stopped because Ken's Chrome was disconnected. Ken then said "skip" to redoing the 3 deleted death takes and "run it now". A second Spring session started the same batch at the same time, re-queued my first Blender job by mistake, saw the clash and stood down (its report: 2026-10-28-spring-restart-duplicate.md). Everything after that was done once, by this run.

## A. Blender clips from the takes Ken approved (both parts approved in Studio `takes`)
One job at a time on blender-queue. Every result was checked by me: the worker's own validation, plus my own per-frame check of the exported GLB (lowest point against the floor, hips drift, loop seam, per-joint floor clearance), plus the worker's final renders.

| Card | New clip | Job (blender-queue/blender-jobs/...) | Result |
|---|---|---|---|
| goblin-grunt (Snotskull Grunt) | OH_Death, 120 f (4 s): wobble, sit, tip back, lie still | goblin-grunt-runway-death-r3 | OK. Lies ON the floor (lowest point +1.7% of his height). As he sits down (frames 56-64, about 0.3 s) his bottom dips up to 5% of his height into the floor. |
| rotgut-grenadier (Goblin Chef) | OH_Death, 120 f (4 s): wobble, sit, tip back, lie still (head tilted so the chef hat stays out of the floor) | rotgut-grenadier-runway-death-r3 | OK while lying (lowest point +1.75%). As he sits down (frames 56-64, about 0.3 s) his bottom dips up to 9% of his height into the floor. The worker lost this job once (PC/worker restart, recovered on its own, retries 1); no loop. |
| goblin-slinger (Skullflinger) | OH_Attack, 120 f (4 s): wind-up, overhand throw, new skull, ready again | goblin-slinger-runway-throw | OK. projectile_release at frame 50 (1.67 s) on RightHand; preview skull hidden at 50, new one shown at 75. No flying skull in the clip. Feet stay on the floor (drift 1% of height), clean loop. |
| goblin-sneak (Backstabbing Thief) | OH_Attack_Backstab, 105 f (3.5 s): sneak crouch, one quick jab ('hit' at frame 75), back to standing | goblin-sneak-runway-backstab | OK. Old OH_Attack kept. Feet dip about 1.5% of his height into the floor during the crouch (small). Clean loop. |

Death retries (honest record):
- Try 1 (grunt and grenadier) and try 2 sank the lying body 11-21% of their height under the floor. The worker's validation does not check the floor; my checker caught it (checked against Blender's own numbers on the Idle pose: they match).
- The cause: Claude in the worker places the JOINTS at sensible heights, but the mesh is thick around them (big boots, rags, the chef hat), and it cannot measure that. The fix that worked: I measured "how far the skin hangs below each joint" on the failed try and wrote that table into the next job ("put every joint at least this high").
- Mistake I made: I edited the grenadier job.json 5 seconds after the worker had claimed it, so that run used the old text. Rule from now on: never edit a queued job; make a new job id (-r2, -r3).

## B. Runway references (step 1) Ken asked for in the Studio
Cheapest settings: grok_imagine_1_5_lite, 480p, 6 s, front view only, prompts under 1000 characters. Runway run #7, all 4 made on the first try, none blocked.
- New start pictures from Ken's saved Studio looks (`library/<card>.final`): goblin-scrapper--front-ball.jpg (bowling ball in his right hand, in front of him) and gyrocopter-ace--front-v2.jpg (wings and propeller on her back). The old goblin-scrapper--front.jpg had no ball, so I did not reuse it.

| Take (Studio `takes`) | Part 1 / Part 2 | My check |
|---|---|---|
| goblin-scrapper-idle-bowl | Idle / Bowling attack | Idle is very calm. In the bowl the ball swings up by his shoulder, not low behind his hip, then rolls off toward the camera. |
| goblin-scrapper-spin-shot | Ball spin on a finger / Basketball shot | The spin happens up beside his head (Ken said before that the ball was too close to his head). The shot goes up and lands in front of him and stays there. |
| gyrocopter-ace-hover-fly | Hover idle / Fly forward | In the hover her feet stay near the floor and the wings barely move. When flying she tips toward the camera and the backpack propeller shows above her (on the pack, not her head). |
| gyrocopter-ace-spark-knock | Spark throw / Knocked back | A spark appears in her right hand and she flicks it forward. She tips back and settles. |

All 4 are in the Studio `takes` as waiting (both parts). `characters/goblin-scrapper` and `characters/gyrocopter-ace` have steps.runway set to waiting, with a note. Ken's own notes were left untouched.

## C. dwarf-smith-miner skeleton
Not possible with the worker as it is. worker.py only allows `ALLOWED_JOB_TYPES = {'inspect', 'animate'}`, and 'animate' needs a model that already has a skeleton. There is no rigging job. The model is also not in the game files yet (no creatures/dwarf-smith-miner/char.glb on factory/issue-8). What's missing: a new 'rig' job type in the worker (a code change plus a reinstall on Ken's PC, so Ken's OK first), and the source model put where the worker can read it. Nothing was queued. Studio `characters/dwarf-smith-miner` steps.blender note says this.

## Model Editor versions (for Wright: only Wright publishes the Studio page)
Please add these as NEW bundled versions (don't switch the cards' src; Ken picks them). Each GLB holds all the old clips plus the new one:
- goblin-grunt-v5 "Snotskull Grunt + death (Oct 28)" from blender-queue: blender-jobs/goblin-grunt-runway-death-r3/out/char.glb
- goblin-slinger-v5 "Skullflinger + throw (Oct 28)" from blender-queue: blender-jobs/goblin-slinger-runway-throw/out/char.glb
- goblin-sneak-v5 "Backstabbing Thief + backstab (Oct 28)" from blender-queue: blender-jobs/goblin-sneak-runway-backstab/out/char.glb
- rotgut-grenadier-v5 "Goblin Chef + death (Oct 28)" from blender-queue: blender-jobs/rotgut-grenadier-runway-death-r3/out/char.glb

Studio `characters/<card>` steps.blender is set to waiting for all 4 cards, with a note on where to watch and the honest gaps.

Open point for Ken: the short sit-down dip in both deaths. A 4th try (same clearance-table method, for the sit pose) could fix it, if Ken wants.

## Not done (as told)
- goblin-scrapper death (part 2 still waiting) and Bare Knuckle Lunatic (Ken set part 1 back to waiting).
- The 3 death takes Ken deleted (goblin-pebbler, goblin-slinger, goblin-sneak): Ken said skip.

## Cost
- Runway: 4 clips × (6 s × 2 + 1) = 52 credits, about $0.52.
- Blender worker: 8 runs on Ken's PC (grunt ×3, grenadier ×3, slinger, sneak), about 5-20 min each, about 1 h 50 min in total. No paid API cost.
- Meshy: none.
